import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  BlockNode,
  EdgeConnection,
  Point,
  RoutingOptions,
  BenchmarkMetrics,
  Port,
  PortSide,
  BlockShape,
  SubcircuitDefinition,
  HierarchyBreadcrumb,
  ExternalPortBinding,
} from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Eye,
  Tag,
  GitCommit,
  Sparkles,
  Zap,
  Plus,
  Image as ImageIcon,
  Lock,
  Layers,
  ChevronRight,
  ArrowUpRight,
  CornerUpLeft,
  FolderPlus,
  CheckSquare,
  Boxes,
  Unlink,
  X as CloseIcon,
} from 'lucide-react';
import { getPortCoordinatesAccurate as getPortCoordinates } from '../algorithms/blockGeometry';
import { LeeDebugWave } from '../algorithms/leeWaveRouter';
import { computeOptimizedLabels, OptimizedLabelPosition } from '../algorithms/labelLayout';
import { generateOrthogonalPathWithBridges } from '../algorithms/bridgeJumps';
import { simplifyOrthogonalPath } from '../algorithms/orthogonalAStarRouter';
import { InspectorPanel } from './InspectorPanel';

interface DiagramCanvasProps {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  onNodesChange: (nodes: BlockNode[]) => void;
  onEdgesChange: (edges: EdgeConnection[]) => void;
  onAddNode: (category: BlockNode['category']) => void;
  onDuplicateNode?: (node: BlockNode) => void;
  onOpenCreateModal?: () => void;
  onRunCoOptimization?: () => void;
  onOpenNlpModal?: () => void;
  options: RoutingOptions;
  metrics?: BenchmarkMetrics;
  debugWaveCells?: LeeDebugWave[];
  activeLayoutName: string;
  activeRoutingName: string;

  // Hierarchical Subcircuits (Подсхемы и надсхемы)
  subcircuits?: Record<string, SubcircuitDefinition>;
  hierarchyPath?: HierarchyBreadcrumb[];
  onEnterSubcircuit?: (subcircuitId: string, nodeTitle?: string, parentNodeId?: string) => void;
  onNavigateHierarchy?: (index: number) => void;
  onLeaveSubcircuit?: () => void;
  activeSubcircuit?: SubcircuitDefinition | null;
  onGroupSelectionIntoSubcircuit?: (nodeIds: string[]) => void;
  onAddExternalPort?: (type: 'input' | 'output', side: PortSide) => void;
  onUpdateExternalPortBinding?: (portId: string, internalNodeId: string, internalPortId: string) => void;
  onDeleteExternalPort?: (portId: string) => void;
}

export const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onAddNode: _onAddNode,
  onDuplicateNode,
  onOpenCreateModal,
  onRunCoOptimization,
  onOpenNlpModal,
  options,
  metrics,
  debugWaveCells = [],
  activeLayoutName,
  activeRoutingName,
  subcircuits = {},
  hierarchyPath = [],
  onEnterSubcircuit,
  onNavigateHierarchy,
  onLeaveSubcircuit,
  activeSubcircuit = null,
  onGroupSelectionIntoSubcircuit,
  onAddExternalPort,
  onUpdateExternalPortBinding,
  onDeleteExternalPort,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Touch gesture pinch state
  const touchPinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialPan: Point;
  } | null>(null);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Custom user label positions from interactive drag
  const [customLabelPositions, setCustomLabelPositions] = useState<Map<string, Point>>(new Map());
  const [draggingLabelEdgeId, setDraggingLabelEdgeId] = useState<string | null>(null);
  const [dragLabelOffset, setDragLabelOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredPortKey, setHoveredPortKey] = useState<string | null>(null);

  // Port wiring interaction (supports both drag-to-connect and tap-to-connect, including external rail ports)
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    portId: string;
    isOutput: boolean;
    x: number;
    y: number;
    isExternal?: boolean;
    extPortId?: string;
    extType?: 'input' | 'output';
  } | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });

  // Visual overlays
  const [showObstacles, setShowObstacles] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [showBridgeJumps, setShowBridgeJumps] = useState(options.jumpBridges);
  const [showInspector, _setShowInspector] = useState(true);

  // Multi-selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // Listen to Escape key to exit subcircuit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedNodeId || selectedEdgeId || selectedNodeIds.size > 0) {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setSelectedNodeIds(new Set());
        } else if (hierarchyPath.length > 1 && onLeaveSubcircuit) {
          onLeaveSubcircuit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hierarchyPath, onLeaveSubcircuit, selectedNodeId, selectedEdgeId, selectedNodeIds]);

  // Compute mathematically optimized, non-overlapping label layout
  const optimizedLabels = useMemo(() => {
    return computeOptimizedLabels(nodes, edges, customLabelPositions, options.labelClearance || 14);
  }, [nodes, edges, customLabelPositions, options.labelClearance]);

  // Selected items
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId) || null, [edges, selectedEdgeId]);

  // 10k Scale Viewport Culling Virtualization
  const viewportBounds = useMemo(() => {
    const margin = 350; // extra buffer in world coordinates
    const w = containerRef.current?.clientWidth || 1920;
    const h = containerRef.current?.clientHeight || 1080;
    const minX = -pan.x / zoom - margin;
    const maxX = (w - pan.x) / zoom + margin;
    const minY = -pan.y / zoom - margin;
    const maxY = (h - pan.y) / zoom + margin;
    return { minX, maxX, minY, maxY };
  }, [pan, zoom, containerRef.current]);

  const visibleNodes = useMemo(() => {
    if (nodes.length <= 150) return nodes;
    return nodes.filter(n => {
      const right = n.x + n.width;
      const bottom = n.y + n.height;
      return (
        right >= viewportBounds.minX &&
        n.x <= viewportBounds.maxX &&
        bottom >= viewportBounds.minY &&
        n.y <= viewportBounds.maxY
      );
    });
  }, [nodes, viewportBounds]);

  const visibleEdges = useMemo(() => {
    if (edges.length <= 150) return edges;
    return edges.filter(e => {
      const pts = e.path;
      if (!pts || pts.length < 2) return true;
      for (let i = 0; i < pts.length; i++) {
        if (
          pts[i].x >= viewportBounds.minX &&
          pts[i].x <= viewportBounds.maxX &&
          pts[i].y >= viewportBounds.minY &&
          pts[i].y <= viewportBounds.maxY
        ) {
          return true;
        }
      }
      return false;
    });
  }, [edges, viewportBounds]);

  // Subcircuit Boundary Box for External I/O Rails
  const subcircuitBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 100, maxX: 800, minY: 80, maxY: 500, width: 700, height: 420 };
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + n.height));
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [nodes]);

  // External I/O Wires for Active Subcircuit (Connects external rails to internal blocks)
  const externalWires = useMemo(() => {
    if (!activeSubcircuit) return [];
    const wires: Array<{
      id: string;
      extPortId: string;
      type: 'input' | 'output';
      name: string;
      nodeId: string;
      portId: string;
      nodeTitle: string;
      path: Point[];
      pathString: string;
      color: string;
      label: string;
      labelPos: Point;
      isBound: boolean;
    }> = [];

    const railLeftX = subcircuitBounds.minX - 170;
    const railRightX = subcircuitBounds.maxX + 25;
    const railTopY = Math.max(20, subcircuitBounds.minY - 30);

    // 1. External Inputs -> Internal block ports
    activeSubcircuit.externalInputs.forEach((extIn, idx) => {
      if (!extIn.internalNodeId || !extIn.internalPortId) return;
      const targetNode = nodes.find(n => n.id === extIn.internalNodeId);
      if (!targetNode) return;

      const pinX = railLeftX + 10 + 125;
      const pinY = railTopY + 32 + idx * 36 + 12;
      const targetPos = getPortCoordinates(targetNode, extIn.internalPortId, false);

      const p0: Point = { x: pinX, y: pinY };
      const p1: Point = { x: pinX + 24, y: pinY };
      const pN: Point = { x: targetPos.x, y: targetPos.y };
      const pN_1: Point = {
        x: targetPos.x + targetPos.normal.dx * 20,
        y: targetPos.y + targetPos.normal.dy * 20,
      };

      let rawPath: Point[];
      if (targetPos.side === 'left') {
        const midX = Math.max(p1.x + 16, Math.min(pN_1.x - 16, (p1.x + pN_1.x) / 2));
        rawPath = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pN_1.y }, pN_1, pN];
      } else if (targetPos.side === 'top' || targetPos.side === 'bottom') {
        rawPath = [p0, p1, { x: pN_1.x, y: p1.y }, pN_1, pN];
      } else {
        const midY = Math.max(subcircuitBounds.minY - 40, Math.min(p1.y, pN_1.y) - 30);
        rawPath = [p0, p1, { x: p1.x, y: midY }, { x: pN_1.x, y: midY }, pN_1, pN];
      }

      const cleanPath = simplifyOrthogonalPath(rawPath);
      const pathString = generateOrthogonalPathWithBridges(
        cleanPath,
        `ext_in_${extIn.id}`,
        edges,
        showBridgeJumps,
        options.smoothCorners,
        options.weights,
        options
      );

      const midIdx = Math.floor(cleanPath.length / 2);
      const labelPos = cleanPath[midIdx] || { x: (p0.x + pN.x) / 2, y: (p0.y + pN.y) / 2 };

      wires.push({
        id: `ext_in_${extIn.id}`,
        extPortId: extIn.id,
        type: 'input',
        name: extIn.name,
        nodeId: targetNode.id,
        portId: extIn.internalPortId,
        nodeTitle: targetNode.title,
        path: cleanPath,
        pathString,
        color: '#818cf8',
        label: `${extIn.name} → ${extIn.internalPortId}`,
        labelPos,
        isBound: true,
      });
    });

    // 2. Internal block ports -> External Outputs
    activeSubcircuit.externalOutputs.forEach((extOut, idx) => {
      if (!extOut.internalNodeId || !extOut.internalPortId) return;
      const srcNode = nodes.find(n => n.id === extOut.internalNodeId);
      if (!srcNode) return;

      const pinX = railRightX + 10;
      const pinY = railTopY + 32 + idx * 36 + 12;
      const srcPos = getPortCoordinates(srcNode, extOut.internalPortId, true);

      const p0: Point = { x: srcPos.x, y: srcPos.y };
      const p1: Point = {
        x: srcPos.x + srcPos.normal.dx * 20,
        y: srcPos.y + srcPos.normal.dy * 20,
      };
      const pN: Point = { x: pinX, y: pinY };
      const pN_1: Point = { x: pinX - 24, y: pinY };

      let rawPath: Point[];
      if (srcPos.side === 'right') {
        const midX = Math.min(pN_1.x - 16, Math.max(p1.x + 16, (p1.x + pN_1.x) / 2));
        rawPath = [p0, p1, { x: midX, y: p1.y }, { x: midX, y: pN_1.y }, pN_1, pN];
      } else if (srcPos.side === 'top' || srcPos.side === 'bottom') {
        rawPath = [p0, p1, { x: p1.x, y: pN_1.y }, pN_1, pN];
      } else {
        const midY = Math.max(subcircuitBounds.maxY + 40, Math.max(p1.y, pN_1.y) + 30);
        rawPath = [p0, p1, { x: p1.x, y: midY }, { x: pN_1.x, y: midY }, pN_1, pN];
      }

      const cleanPath = simplifyOrthogonalPath(rawPath);
      const pathString = generateOrthogonalPathWithBridges(
        cleanPath,
        `ext_out_${extOut.id}`,
        edges,
        showBridgeJumps,
        options.smoothCorners,
        options.weights,
        options
      );

      const midIdx = Math.floor(cleanPath.length / 2);
      const labelPos = cleanPath[midIdx] || { x: (p0.x + pN.x) / 2, y: (p0.y + pN.y) / 2 };

      wires.push({
        id: `ext_out_${extOut.id}`,
        extPortId: extOut.id,
        type: 'output',
        name: extOut.name,
        nodeId: srcNode.id,
        portId: extOut.internalPortId,
        nodeTitle: srcNode.title,
        path: cleanPath,
        pathString,
        color: '#c084fc',
        label: `${extOut.internalPortId} → ${extOut.name}`,
        labelPos,
        isBound: true,
      });
    });

    return wires;
  }, [activeSubcircuit, nodes, edges, subcircuitBounds, showBridgeJumps, options]);

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(Math.max(0.3, zoom * zoomFactor), 2.8);
    setZoom(newZoom);
  };


  const handleFitToScreen = useCallback(() => {
    if (nodes.length === 0 || !containerRef.current) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + n.height));

    const contentWidth = maxX - minX + 220;
    const contentHeight = maxY - minY + 220;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const targetZoom = Math.min(1.2, Math.max(0.35, Math.min(scaleX, scaleY) * 0.9));

    setZoom(targetZoom);
    setPan({
      x: (containerWidth - (maxX + minX) * targetZoom) / 2,
      y: (containerHeight - (maxY + minY) * targetZoom) / 2,
    });
  }, [nodes]);

  // Handle canvas mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingFrom(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const currentCanvasY = (e.clientY - rect.top - pan.y) / zoom;
    setMousePos({ x: currentCanvasX, y: currentCanvasY });

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (draggingNodeId) {
      const updatedNodes = nodes.map(n => {
        if (n.id === draggingNodeId) {
          const rawX = currentCanvasX - dragOffset.x;
          const rawY = currentCanvasY - dragOffset.y;
          const snap = options.gridSize || 10;
          const x = Math.max(20, Math.round(rawX / snap) * snap);
          const y = Math.max(20, Math.round(rawY / snap) * snap);
          return { ...n, x, y };
        }
        return n;
      });
      onNodesChange(updatedNodes);
    } else if (draggingLabelEdgeId) {
      const newPos: Point = {
        x: Math.round(currentCanvasX - dragLabelOffset.x),
        y: Math.round(currentCanvasY - dragLabelOffset.y),
      };
      setCustomLabelPositions(prev => {
        const next = new Map(prev);
        next.set(draggingLabelEdgeId, newPos);
        return next;
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setDraggingLabelEdgeId(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchPinchRef.current = {
        initialDist: dist,
        initialZoom: zoom,
        initialPan: { ...pan },
      };
      setIsPanning(false);
      setDraggingNodeId(null);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
        setIsPanning(true);
        setPanStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (e.touches.length === 2 && touchPinchRef.current) {
      // Pinch to zoom move
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const scale = dist / touchPinchRef.current.initialDist;
      const newZoom = Math.min(2.8, Math.max(0.3, touchPinchRef.current.initialZoom * scale));
      setZoom(newZoom);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const currentCanvasX = (touch.clientX - rect.left - pan.x) / zoom;
      const currentCanvasY = (touch.clientY - rect.top - pan.y) / zoom;
      setMousePos({ x: currentCanvasX, y: currentCanvasY });

      if (isPanning) {
        setPan({
          x: touch.clientX - panStart.x,
          y: touch.clientY - panStart.y,
        });
      } else if (draggingNodeId) {
        const updatedNodes = nodes.map(n => {
          if (n.id === draggingNodeId) {
            const rawX = currentCanvasX - dragOffset.x;
            const rawY = currentCanvasY - dragOffset.y;
            const snap = options.gridSize || 10;
            const x = Math.max(20, Math.round(rawX / snap) * snap);
            const y = Math.max(20, Math.round(rawY / snap) * snap);
            return { ...n, x, y };
          }
          return n;
        });
        onNodesChange(updatedNodes);
      } else if (draggingLabelEdgeId) {
        const newPos: Point = {
          x: Math.round(currentCanvasX - dragLabelOffset.x),
          y: Math.round(currentCanvasY - dragLabelOffset.y),
        };
        setCustomLabelPositions(prev => {
          const next = new Map(prev);
          next.set(draggingLabelEdgeId, newPos);
          return next;
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchPinchRef.current = null;
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
      setDraggingNodeId(null);
      setDraggingLabelEdgeId(null);
    }
  };

  // Node drag start
  const handleNodeMouseDown = (e: React.MouseEvent, node: BlockNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingNodeId(node.id);
    setDragOffset({
      x: canvasX - node.x,
      y: canvasY - node.y,
    });
  };

  const handleNodeTouchStart = (e: React.TouchEvent, node: BlockNode) => {
    e.stopPropagation();
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = (touch.clientX - rect.left - pan.x) / zoom;
    const canvasY = (touch.clientY - rect.top - pan.y) / zoom;

    setDraggingNodeId(node.id);
    setDragOffset({
      x: canvasX - node.x,
      y: canvasY - node.y,
    });
  };

  // Label drag start
  const handleLabelMouseDown = (e: React.MouseEvent, edgeId: string, labelInfo: OptimizedLabelPosition) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingLabelEdgeId(edgeId);
    setDragLabelOffset({
      x: canvasX - labelInfo.x,
      y: canvasY - labelInfo.y,
    });
  };

  // Port wiring start (Drag and Tap-to-Connect)
  const handlePortInteraction = (node: BlockNode, port: Port) => {
    const pos = getPortCoordinates(node, port.id, port.type === 'output');

    if (!connectingFrom) {
      // Start connection
      setConnectingFrom({
        nodeId: node.id,
        portId: port.id,
        isOutput: port.type === 'output',
        x: pos.x,
        y: pos.y,
        isExternal: false,
      });
      setMousePos({ x: pos.x, y: pos.y });
    } else {
      // If we were connecting from an external port to this internal block port
      if (connectingFrom.isExternal && connectingFrom.extPortId && onUpdateExternalPortBinding) {
        onUpdateExternalPortBinding(connectingFrom.extPortId, node.id, port.id);
        setConnectingFrom(null);
        return;
      }

      // Already connecting -> check if target is different block
      if (connectingFrom.nodeId !== node.id) {
        let srcBlock = connectingFrom.nodeId;
        let srcPort = connectingFrom.portId;
        let dstBlock = node.id;
        let dstPort = port.id;

        if (!connectingFrom.isOutput && port.type === 'output') {
          srcBlock = node.id;
          srcPort = port.id;
          dstBlock = connectingFrom.nodeId;
          dstPort = connectingFrom.portId;
        }

        const newEdge: EdgeConnection = {
          id: `e_${Date.now()}`,
          sourceBlockId: srcBlock,
          sourcePortId: srcPort,
          targetBlockId: dstBlock,
          targetPortId: dstPort,
          color: '#3b82f6',
          label: `${srcPort} → ${dstPort}`,
        };
        onEdgesChange([...edges, newEdge]);
      }
      setConnectingFrom(null);
    }
  };

  const handlePortMouseDown = (e: React.MouseEvent, node: BlockNode, port: Port) => {
    e.stopPropagation();
    const pos = getPortCoordinates(node, port.id, port.type === 'output');
    setConnectingFrom({
      nodeId: node.id,
      portId: port.id,
      isOutput: port.type === 'output',
      x: pos.x,
      y: pos.y,
      isExternal: false,
    });
  };

  // Port wiring release / complete (Drag mode)
  const handlePortMouseUp = (e: React.MouseEvent, targetNode: BlockNode, targetPort: Port) => {
    e.stopPropagation();
    if (!connectingFrom) return;

    // If dragged from external rail port to internal block port
    if (connectingFrom.isExternal && connectingFrom.extPortId && onUpdateExternalPortBinding) {
      onUpdateExternalPortBinding(connectingFrom.extPortId, targetNode.id, targetPort.id);
      setConnectingFrom(null);
      return;
    }

    if (connectingFrom.nodeId !== targetNode.id) {
      let srcBlock = connectingFrom.nodeId;
      let srcPort = connectingFrom.portId;
      let dstBlock = targetNode.id;
      let dstPort = targetPort.id;

      // If dragging from input to output, swap
      if (!connectingFrom.isOutput && targetPort.type === 'output') {
        srcBlock = targetNode.id;
        srcPort = targetPort.id;
        dstBlock = connectingFrom.nodeId;
        dstPort = connectingFrom.portId;
      }

      const newEdge: EdgeConnection = {
        id: `e_${Date.now()}`,
        sourceBlockId: srcBlock,
        sourcePortId: srcPort,
        targetBlockId: dstBlock,
        targetPortId: dstPort,
        color: '#3b82f6',
        label: `${srcPort} → ${dstPort}`,
      };
      onEdgesChange([...edges, newEdge]);
      setConnectingFrom(null);
    }
  };

  // External Rail Port Handlers (Drag & Tap-to-Connect)
  const handleExternalPortMouseDown = (
    e: React.MouseEvent,
    extPort: ExternalPortBinding,
    type: 'input' | 'output',
    idx: number
  ) => {
    e.stopPropagation();
    const railX = type === 'input' ? subcircuitBounds.minX - 170 : subcircuitBounds.maxX + 25;
    const railY = Math.max(20, subcircuitBounds.minY - 30);
    const pinX = type === 'input' ? railX + 10 + 125 : railX + 10;
    const pinY = railY + 32 + idx * 36 + 12;

    setConnectingFrom({
      nodeId: type === 'input' ? `__ext_in__${extPort.id}` : `__ext_out__${extPort.id}`,
      portId: extPort.id,
      isOutput: type === 'input',
      x: pinX,
      y: pinY,
      isExternal: true,
      extPortId: extPort.id,
      extType: type,
    });
  };

  const handleExternalPortMouseUp = (
    e: React.MouseEvent,
    extPort: ExternalPortBinding
  ) => {
    e.stopPropagation();
    if (!connectingFrom) return;

    // If dragged from internal block to this external rail port
    if (!connectingFrom.isExternal && onUpdateExternalPortBinding) {
      onUpdateExternalPortBinding(extPort.id, connectingFrom.nodeId, connectingFrom.portId);
    }
    setConnectingFrom(null);
  };

  const handleExternalPortInteraction = (
    extPort: ExternalPortBinding,
    type: 'input' | 'output',
    idx: number
  ) => {
    const railX = type === 'input' ? subcircuitBounds.minX - 170 : subcircuitBounds.maxX + 25;
    const railY = Math.max(20, subcircuitBounds.minY - 30);
    const pinX = type === 'input' ? railX + 10 + 125 : railX + 10;
    const pinY = railY + 32 + idx * 36 + 12;

    if (!connectingFrom) {
      setConnectingFrom({
        nodeId: type === 'input' ? `__ext_in__${extPort.id}` : `__ext_out__${extPort.id}`,
        portId: extPort.id,
        isOutput: type === 'input',
        x: pinX,
        y: pinY,
        isExternal: true,
        extPortId: extPort.id,
        extType: type,
      });
      setMousePos({ x: pinX, y: pinY });
    } else {
      if (!connectingFrom.isExternal && onUpdateExternalPortBinding) {
        onUpdateExternalPortBinding(extPort.id, connectingFrom.nodeId, connectingFrom.portId);
      }
      setConnectingFrom(null);
    }
  };

  // Node & Edge Updates from Inspector
  const handleUpdateNode = (updatedNode: BlockNode) => {
    onNodesChange(nodes.map(n => (n.id === updatedNode.id ? updatedNode : n)));
  };

  const handleUpdateEdge = (updatedEdge: EdgeConnection) => {
    onEdgesChange(edges.map(e => (e.id === updatedEdge.id ? updatedEdge : e)));
  };

  const handleDeleteNode = (nodeId: string) => {
    onNodesChange(nodes.filter(n => n.id !== nodeId));
    onEdgesChange(edges.filter(e => e.sourceBlockId !== nodeId && e.targetBlockId !== nodeId));
    setSelectedNodeId(null);
  };

  const handleDeleteEdge = (edgeId: string) => {
    onEdgesChange(edges.filter(e => e.id !== edgeId));
    setSelectedEdgeId(null);
  };

  // Duplicate block helper
  const handleDuplicateBlock = useCallback(
    (nodeToDup: BlockNode) => {
      if (onDuplicateNode) {
        onDuplicateNode(nodeToDup);
        return;
      }
      const newId = `node_${Date.now()}`;
      const duplicatedNode: BlockNode = {
        ...nodeToDup,
        id: newId,
        title: `${nodeToDup.title} (Copy)`,
        x: nodeToDup.x + 30,
        y: nodeToDup.y + 30,
        inputs: nodeToDup.inputs.map((p, i) => ({ ...p, id: `p_in_${Date.now()}_${i}` })),
        outputs: nodeToDup.outputs.map((p, i) => ({ ...p, id: `p_out_${Date.now()}_${i}` })),
      };
      onNodesChange([...nodes, duplicatedNode]);
      setSelectedNodeId(newId);
    },
    [nodes, onNodesChange, onDuplicateNode]
  );

  // Drag and Drop image file onto canvas directly
  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldX = Math.round((clientX - pan.x) / zoom);
    const worldY = Math.round((clientY - pan.y) / zoom);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        const newBlock: BlockNode = {
          id: `img_node_${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          subtitle: 'Image Component',
          category: 'custom',
          x: worldX - 80,
          y: worldY - 50,
          width: 160,
          height: 100,
          color: '#8b5cf6',
          shape: 'rounded',
          imageUrl: event.target.result,
          imageFit: 'contain',
          imageOpacity: 1.0,
          showTitleOverlay: true,
          inputs: [
            {
              id: `p_in_${Date.now()}_1`,
              name: 'IN',
              type: 'input',
              side: 'left',
              placementMode: 'adaptive',
              relativePosition: 0.5,
              dataType: 'signal',
            },
          ],
          outputs: [
            {
              id: `p_out_${Date.now()}_1`,
              name: 'OUT',
              type: 'output',
              side: 'right',
              placementMode: 'adaptive',
              relativePosition: 0.5,
              dataType: 'signal',
            },
          ],
        };
        onNodesChange([...nodes, newBlock]);
        setSelectedNodeId(newBlock.id);
      }
    };
    reader.readAsDataURL(file);
  };

  // Color mappings for port data types (rule/2.md §14, §15)
  const getPortColor = (port: Port) => {
    if (port.color) return port.color;
    switch (port.dataType) {
      case 'power':
        return '#f59e0b';
      case 'clock':
        return '#10b981';
      case 'bus':
        return '#8b5cf6';
      case 'control':
        return '#f43f5e';
      case 'trigger':
        return '#ec4899';
      case 'data':
        return '#06b6d4';
      case 'analog':
        return '#eab308';
      case 'ground':
        return '#64748b';
      case 'network':
        return '#a855f7';
      case 'mechanical':
        return '#78716c';
      case 'custom':
        return '#94a3b8';
      case 'signal':
      default:
        if (port.type === 'output') return '#38bdf8';
        if (port.type === 'inout') return '#14b8a6';
        if (port.type === 'passive') return '#94a3b8';
        return '#3b82f6';
    }
  };

  return (
    <div
      ref={containerRef}
      id="diagram-canvas-container"
      className="relative w-full h-full bg-[#0c0d10] overflow-hidden select-none cursor-crosshair border border-white/5 rounded-2xl flex flex-col justify-between touch-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      {/* Background Radial Grid Pattern */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#252a35_1px,transparent_1px)] bg-[size:20px_20px]"
          style={{
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />
      )}

      {/* Floating Bento HUD: Metrics, Algorithm Info & Hierarchy Breadcrumbs */}
      <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-20 flex flex-col gap-1.5 pointer-events-none max-w-[calc(100vw-6rem)] sm:max-w-xl">
        {/* Hierarchy Breadcrumbs Trail */}
        {hierarchyPath && hierarchyPath.length > 0 && (
          <div className="bg-[#16181d]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-purple-500/30 shadow-2xl flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-gray-300 font-mono pointer-events-auto">
            <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            {hierarchyPath.map((item, idx) => {
              const isLast = idx === hierarchyPath.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />}
                  <button
                    onClick={() => onNavigateHierarchy?.(idx)}
                    className={`transition-colors truncate max-w-[140px] sm:max-w-[200px] cursor-pointer ${
                      isLast
                        ? 'font-bold text-purple-200 bg-purple-500/20 px-2 py-0.5 rounded'
                        : 'text-gray-400 hover:text-purple-300 hover:underline'
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </button>
                </React.Fragment>
              );
            })}
            {hierarchyPath.length > 1 && onLeaveSubcircuit && (
              <button
                onClick={onLeaveSubcircuit}
                title="Подняться в надсхему (Esc)"
                className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 text-[10px] font-bold transition-all cursor-pointer"
              >
                <CornerUpLeft className="w-3 h-3" />
                <span>Наверх (Esc)</span>
              </button>
            )}
          </div>
        )}

        {/* Group selection into Subcircuit banner */}
        {selectedNodeIds.size > 1 && onGroupSelectionIntoSubcircuit && (
          <div className="bg-purple-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-purple-400/50 shadow-xl flex items-center gap-2 text-xs font-mono text-purple-200 pointer-events-auto animate-fade-in">
            <Boxes className="w-4 h-4 text-purple-300 animate-pulse" />
            <span className="text-[11px]">Выделено: <b>{selectedNodeIds.size}</b> блоков</span>
            <button
              onClick={() => {
                onGroupSelectionIntoSubcircuit(Array.from(selectedNodeIds));
                setSelectedNodeIds(new Set());
              }}
              className="ml-auto px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition-all active:scale-95 shadow cursor-pointer"
              title="Сгруппировать выделенные блоки в многоуровневую подсхему"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Свернуть в подсхему</span>
            </button>
          </div>
        )}

        <div className="bg-[#16181d]/90 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-white/10 shadow-2xl flex flex-wrap items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs text-gray-300 font-mono pointer-events-auto">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
            <span className="text-gray-400 uppercase text-[9px] sm:text-[10px]">Layout:</span>
            <span className="font-semibold text-white truncate max-w-[90px] sm:max-w-none">{activeLayoutName}</span>
          </div>
          <span className="text-white/20">/</span>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-gray-400 uppercase text-[9px] sm:text-[10px]">Router:</span>
            <span className="font-semibold text-blue-400 truncate max-w-[80px] sm:max-w-none">{activeRoutingName}</span>
          </div>
          {metrics && (
            <>
              <span className="hidden sm:inline text-white/20">|</span>
              <span className="text-emerald-400 font-bold">{metrics.executionTimeMs} ms</span>
              <span className="hidden sm:inline text-gray-400">({metrics.bendCount} изгибов, {metrics.crossingsCount} перес.)</span>
            </>
          )}

          {onOpenNlpModal && (
            <button
              id="canvas-hud-nlp-solver"
              onClick={onOpenNlpModal}
              title="Открыть Нелинейное Программирование и Критерии Оптимальности (NLP)"
              className="ml-auto sm:ml-2 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] sm:text-[11px] font-bold tracking-wide transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
              <span className="hidden xs:inline sm:inline">NLP Solver</span>
              <span className="inline xs:hidden sm:hidden">NLP</span>
            </button>
          )}

          {onRunCoOptimization && (
            <button
              id="canvas-hud-co-optimize"
              onClick={onRunCoOptimization}
              title="Запустить сквозную совместную оптимизацию размещения и трасс"
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] sm:text-[11px] font-semibold tracking-wide transition-all active:scale-95 shadow-sm"
            >
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-200" />
              <span className="hidden xs:inline sm:inline">Co-Opt</span>
            </button>
          )}

          {onOpenCreateModal && (
            <button
              id="canvas-hud-create-block"
              onClick={onOpenCreateModal}
              title="Создать гибкий блок или компонент с изображением"
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-[11px] font-bold tracking-wide transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
              <span className="hidden xs:inline sm:inline">+ Создать Блок</span>
            </button>
          )}
        </div>
      </div>


      {/* Floating Zoom & Display Controls */}
      <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-20 flex items-center gap-0.5 sm:gap-1 bg-[#16181d]/90 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-2xl">
        <button
          id="btn-zoom-in"
          onClick={() => setZoom(z => Math.min(2.8, z * 1.15))}
          title="Приблизить"
          className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          id="btn-zoom-out"
          onClick={() => setZoom(z => Math.max(0.3, z * 0.85))}
          title="Отдалить"
          className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          id="btn-zoom-fit"
          onClick={handleFitToScreen}
          title="Вписать всю схему"
          className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <div className="w-px h-3 sm:h-4 bg-white/10 mx-0.5 sm:mx-1" />
        
        {/* Toggle Bridge Jumps (IEEE Line Hops) */}
        <button
          id="btn-toggle-bridge-jumps"
          onClick={() => setShowBridgeJumps(!showBridgeJumps)}
          title="Мостики пересечений линий (IEEE 315 Bridge Jumps)"
          className={`p-1.5 sm:p-2 rounded-lg transition-colors ${showBridgeJumps ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-white/5 text-gray-400'}`}
        >
          <GitCommit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Toggle Edge Labels */}
        <button
          id="btn-toggle-edge-labels"
          onClick={() => setShowEdgeLabels(!showEdgeLabels)}
          title="Включить/выключить подписи стрелок"
          className={`p-1.5 sm:p-2 rounded-lg transition-colors ${showEdgeLabels ? 'bg-purple-500/20 text-purple-300' : 'hover:bg-white/5 text-gray-400'}`}
        >
          <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          id="btn-toggle-obstacles"
          onClick={() => setShowObstacles(!showObstacles)}
          title="Показать буферные зоны препятствий"
          className={`hidden sm:inline-flex p-1.5 sm:p-2 rounded-lg transition-colors ${showObstacles ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
        >
          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          id="btn-toggle-grid"
          onClick={() => setShowGrid(!showGrid)}
          title="Переключить фоновую сетку"
          className={`hidden sm:inline-flex p-1.5 sm:p-2 rounded-lg transition-colors ${showGrid ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5 text-gray-400'}`}
        >
          <Move className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>

      {/* Floating Port / Node / Edge Inspector Drawer */}
      {showInspector && (selectedNode || selectedEdge) && (
        <InspectorPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onUpdateNode={handleUpdateNode}
          onUpdateEdge={handleUpdateEdge}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onDuplicateNode={handleDuplicateBlock}
          onEnterSubcircuit={onEnterSubcircuit}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
        />
      )}

      {/* Main SVG Surface */}
      <svg
        id="diagram-main-svg"
        className="w-full h-full absolute inset-0 overflow-visible"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          {/* Arrowhead Markers with high contrast and strict collinear alignment */}
          <marker
            id="arrow-default"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto"
          >
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#3b82f6" />
          </marker>
          <marker
            id="arrow-hover"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7.5"
            markerHeight="7.5"
            orient="auto"
          >
            <path d="M 0 1 L 9.5 5 L 0 9 z" fill="#60a5fa" />
          </marker>
          <marker
            id="arrow-selected"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7.5"
            markerHeight="7.5"
            orient="auto"
          >
            <path d="M 0 1 L 9.5 5 L 0 9 z" fill="#ec4899" />
          </marker>

          {/* Dynamic Clip Paths for each Node based on shape geometry */}
          {visibleNodes.map((node) => {
            const w = node.width;
            const h = node.height;
            const shape: BlockShape = node.shape || 'rounded';

            if (shape === 'chip_ic') {
              return (
                <clipPath id={`clip-shape-${node.id}`} key={`clip-${node.id}`}>
                  <path
                    d={`M 0 8 Q 0 0 8 0 L ${w / 2 - 10} 0 A 8 8 0 0 0 ${w / 2 + 10} 0 L ${w - 8} 0 Q ${w} 0 ${w} 8 L ${w} ${h - 8} Q ${w} ${h} ${w - 8} ${h} L 8 ${h} Q 0 ${h} 0 ${h - 8} Z`}
                  />
                </clipPath>
              );
            }
            if (shape === 'rectangle') {
              return (
                <clipPath id={`clip-shape-${node.id}`} key={`clip-${node.id}`}>
                  <rect x="0" y="0" width={w} height={h} />
                </clipPath>
              );
            }
            if (shape === 'hexagon') {
              return (
                <clipPath id={`clip-shape-${node.id}`} key={`clip-${node.id}`}>
                  <polygon
                    points={`${w * 0.16},0 ${w * 0.84},0 ${w},${h * 0.5} ${w * 0.84},${h} ${w * 0.16},${h} 0,${h * 0.5}`}
                  />
                </clipPath>
              );
            }
            if (shape === 'diamond') {
              return (
                <clipPath id={`clip-shape-${node.id}`} key={`clip-${node.id}`}>
                  <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} />
                </clipPath>
              );
            }
            // default rounded
            return (
              <clipPath id={`clip-shape-${node.id}`} key={`clip-${node.id}`}>
                <rect x="0" y="0" width={w} height={h} rx="12" />
              </clipPath>
            );
          })}
        </defs>

        {/* 1. Obstacle buffer boxes */}
        {showObstacles && (
          <g id="obstacle-buffers" opacity="0.25">
            {visibleNodes.map(n => (
              <rect
                key={`obs-${n.id}`}
                x={n.x - options.obstacleClearance}
                y={n.y - options.obstacleClearance}
                width={n.width + options.obstacleClearance * 2}
                height={n.height + options.obstacleClearance * 2}
                fill="#f43f5e"
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                rx="12"
              />
            ))}
          </g>
        )}

        {/* 2. Debug Wave Cells */}
        {debugWaveCells.length > 0 && (
          <g id="wavefront-debug-cells" opacity="0.6">
            {debugWaveCells.map((cell, idx) => (
              <g key={`wc-${idx}`}>
                <rect
                  x={cell.x - 6}
                  y={cell.y - 6}
                  width="12"
                  height="12"
                  fill="#1d4ed8"
                  opacity="0.25"
                  rx="2"
                />
                <text
                  x={cell.x}
                  y={cell.y + 3}
                  fontSize="7"
                  textAnchor="middle"
                  fill="#93c5fd"
                  fontFamily="monospace"
                >
                  {cell.val}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* 3. Subcircuit Boundary I/O Rails (Внешние входы и выходы) */}
        {activeSubcircuit && (
          <g id="subcircuit-boundary-rails" className="select-none pointer-events-auto">
            {/* Left Rail (External Inputs) */}
            <g transform={`translate(${subcircuitBounds.minX - 170}, ${Math.max(20, subcircuitBounds.minY - 30)})`}>
              <rect
                x="0"
                y="0"
                width="145"
                height={Math.max(140, Math.max(subcircuitBounds.height + 60, (activeSubcircuit.externalInputs.length + 2) * 36 + 20))}
                rx="10"
                fill="#12131a"
                stroke="#8b5cf6"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                opacity="0.92"
                className="shadow-2xl"
              />
              <g transform="translate(10, 16)">
                <text
                  x="62"
                  y="0"
                  fill="#c084fc"
                  fontSize="8.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  ◀ ВНЕШНИЕ ВХОДЫ (IN)
                </text>
              </g>

              {activeSubcircuit.externalInputs.map((extIn, idx) => {
                const portY = 32 + idx * 36;
                const isHovered = hoveredPortKey === `ext_in_${extIn.id}`;
                const isConnecting = connectingFrom?.isExternal && connectingFrom?.extPortId === extIn.id;
                const isBound = Boolean(extIn.internalNodeId && extIn.internalPortId);
                const targetNode = nodes.find(n => n.id === extIn.internalNodeId);

                return (
                  <g
                    key={extIn.id}
                    transform={`translate(10, ${portY})`}
                    className="group"
                    onMouseEnter={() => setHoveredPortKey(`ext_in_${extIn.id}`)}
                    onMouseLeave={() => setHoveredPortKey(null)}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="125"
                      height="26"
                      rx="5"
                      fill={isConnecting ? '#312e81' : isHovered ? '#1e1b4b' : '#14142b'}
                      stroke={isConnecting ? '#38bdf8' : isBound ? '#6366f1' : '#374151'}
                      strokeWidth={isConnecting || isHovered ? '1.5' : '1'}
                    />
                    <text x="8" y="12" fill="#e0e7ff" fontSize="8.5" fontWeight="600" fontFamily="monospace">
                      {extIn.name}
                    </text>
                    <text x="8" y="21" fill={isBound ? '#a5b4fc' : '#6b7280'} fontSize="6.5" fontFamily="monospace">
                      {isBound ? `→ ${targetNode?.title?.slice(0, 12) || extIn.internalNodeId}:${extIn.internalPortId}` : 'не подключен'}
                    </text>

                    {/* Interactive Contact Pin Circle */}
                    <circle
                      cx="125"
                      cy="13"
                      r={isHovered || isConnecting ? 6 : 4.5}
                      fill={isConnecting ? '#38bdf8' : isBound ? '#818cf8' : '#475569'}
                      stroke={isBound ? '#c084fc' : '#1e1b4b'}
                      strokeWidth="1.5"
                      className="cursor-pointer transition-all hover:scale-125"
                      onMouseDown={(e) => handleExternalPortMouseDown(e, extIn, 'input', idx)}
                      onMouseUp={(e) => handleExternalPortMouseUp(e, extIn)}
                      onClick={() => handleExternalPortInteraction(extIn, 'input', idx)}
                    />

                    {/* Delete / Unbind Button */}
                    {onDeleteExternalPort && (
                      <g
                        transform="translate(108, 3)"
                        className="opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteExternalPort(extIn.id);
                        }}
                      >
                        <circle cx="5" cy="5" r="5" fill="#ef4444" opacity="0.85" />
                        <text x="5" y="7.5" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">×</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {onAddExternalPort && (
                <g
                  transform={`translate(10, ${36 + activeSubcircuit.externalInputs.length * 36})`}
                  className="cursor-pointer group"
                  onClick={() => onAddExternalPort('input', 'left')}
                >
                  <rect x="0" y="0" width="125" height="20" rx="4" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2 2" />
                  <text x="62" y="13.5" fill="#c084fc" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    + Внешний Вход
                  </text>
                </g>
              )}
            </g>

            {/* Right Rail (External Outputs) */}
            <g transform={`translate(${subcircuitBounds.maxX + 25}, ${Math.max(20, subcircuitBounds.minY - 30)})`}>
              <rect
                x="0"
                y="0"
                width="145"
                height={Math.max(140, Math.max(subcircuitBounds.height + 60, (activeSubcircuit.externalOutputs.length + 2) * 36 + 20))}
                rx="10"
                fill="#12131a"
                stroke="#8b5cf6"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                opacity="0.92"
                className="shadow-2xl"
              />
              <g transform="translate(10, 16)">
                <text
                  x="62"
                  y="0"
                  fill="#c084fc"
                  fontSize="8.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  ВНЕШНИЕ ВЫХОДЫ (OUT) ▶
                </text>
              </g>

              {activeSubcircuit.externalOutputs.map((extOut, idx) => {
                const portY = 32 + idx * 36;
                const isHovered = hoveredPortKey === `ext_out_${extOut.id}`;
                const isConnecting = connectingFrom?.isExternal && connectingFrom?.extPortId === extOut.id;
                const isBound = Boolean(extOut.internalNodeId && extOut.internalPortId);
                const srcNode = nodes.find(n => n.id === extOut.internalNodeId);

                return (
                  <g
                    key={extOut.id}
                    transform={`translate(10, ${portY})`}
                    className="group"
                    onMouseEnter={() => setHoveredPortKey(`ext_out_${extOut.id}`)}
                    onMouseLeave={() => setHoveredPortKey(null)}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="125"
                      height="26"
                      rx="5"
                      fill={isConnecting ? '#312e81' : isHovered ? '#1e1b4b' : '#14142b'}
                      stroke={isConnecting ? '#38bdf8' : isBound ? '#6366f1' : '#374151'}
                      strokeWidth={isConnecting || isHovered ? '1.5' : '1'}
                    />
                    <text x="117" y="12" fill="#e0e7ff" fontSize="8.5" fontWeight="600" textAnchor="end" fontFamily="monospace">
                      {extOut.name}
                    </text>
                    <text x="117" y="21" fill={isBound ? '#a5b4fc' : '#6b7280'} fontSize="6.5" textAnchor="end" fontFamily="monospace">
                      {isBound ? `← ${srcNode?.title?.slice(0, 12) || extOut.internalNodeId}:${extOut.internalPortId}` : 'не подключен'}
                    </text>

                    {/* Interactive Contact Pin Circle */}
                    <circle
                      cx="0"
                      cy="13"
                      r={isHovered || isConnecting ? 6 : 4.5}
                      fill={isConnecting ? '#38bdf8' : isBound ? '#c084fc' : '#475569'}
                      stroke={isBound ? '#a855f7' : '#1e1b4b'}
                      strokeWidth="1.5"
                      className="cursor-pointer transition-all hover:scale-125"
                      onMouseDown={(e) => handleExternalPortMouseDown(e, extOut, 'output', idx)}
                      onMouseUp={(e) => handleExternalPortMouseUp(e, extOut)}
                      onClick={() => handleExternalPortInteraction(extOut, 'output', idx)}
                    />

                    {/* Delete / Unbind Button */}
                    {onDeleteExternalPort && (
                      <g
                        transform="translate(7, 3)"
                        className="opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteExternalPort(extOut.id);
                        }}
                      >
                        <circle cx="5" cy="5" r="5" fill="#ef4444" opacity="0.85" />
                        <text x="5" y="7.5" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">×</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {onAddExternalPort && (
                <g
                  transform={`translate(10, ${36 + activeSubcircuit.externalOutputs.length * 36})`}
                  className="cursor-pointer group"
                  onClick={() => onAddExternalPort('output', 'right')}
                >
                  <rect x="0" y="0" width="125" height="20" rx="4" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2 2" />
                  <text x="62" y="13.5" fill="#c084fc" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    + Внешний Выход
                  </text>
                </g>
              )}
            </g>
          </g>
        )}

        {/* 3.5. External I/O Wires Layer (Traces connecting Rails <-> Internal Blocks) */}
        {activeSubcircuit && externalWires.length > 0 && (
          <g id="external-io-wires-layer">
            {externalWires.map((wire) => {
              const isHovered = hoveredEdgeId === wire.id || hoveredPortKey === wire.id;
              const isSelected = selectedEdgeId === wire.id;
              const wireColor = isSelected ? '#ec4899' : isHovered ? '#60a5fa' : wire.color;

              return (
                <g
                  key={wire.id}
                  id={`ext-wire-${wire.id}`}
                  className="cursor-pointer transition-all duration-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEdgeId(wire.id);
                    setSelectedNodeId(null);
                  }}
                  onMouseEnter={() => setHoveredEdgeId(wire.id)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                >
                  {/* Thick transparent hit area */}
                  <path
                    d={wire.pathString}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                  />

                  {/* Glow on hover/select */}
                  {(isHovered || isSelected) && (
                    <path
                      d={wire.pathString}
                      fill="none"
                      stroke={wireColor}
                      strokeWidth="6"
                      strokeOpacity="0.35"
                    />
                  )}

                  {/* Primary Wire Path */}
                  <path
                    d={wire.pathString}
                    fill="none"
                    stroke={wireColor}
                    strokeWidth={isSelected ? '2.5' : isHovered ? '2.2' : '1.75'}
                    strokeDasharray={wire.type === 'input' ? '6 3' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd="url(#arrow-default)"
                  />

                  {/* External Wire Label Badge */}
                  {showEdgeLabels && (
                    <g
                      transform={`translate(${wire.labelPos.x}, ${wire.labelPos.y})`}
                      className="pointer-events-none select-none font-mono"
                    >
                      <rect
                        x="-38"
                        y="-8"
                        width="76"
                        height="16"
                        rx="4"
                        fill="#12131a"
                        stroke={wireColor}
                        strokeWidth="1"
                        opacity="0.95"
                      />
                      <text
                        x="0"
                        y="3"
                        fill="#e0e7ff"
                        fontSize="7.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="ui-monospace, monospace"
                      >
                        {wire.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* 4. Routed Edges Layer with IEEE Bridge Hops */}
        <g id="routed-edges-layer">
          {visibleEdges.map(edge => {
            const isHovered = hoveredEdgeId === edge.id;
            const isSelected = selectedEdgeId === edge.id;
            const pathString = generateOrthogonalPathWithBridges(
              edge.path || [],
              edge.id,
              edges,
              showBridgeJumps,
              options.smoothCorners,
              options.weights,
              options
            );
            const edgeColor = isSelected ? '#ec4899' : isHovered ? '#60a5fa' : edge.color || '#3b82f6';
            const markerId = isSelected ? 'arrow-selected' : isHovered ? 'arrow-hover' : 'arrow-default';

            const labelInfo = optimizedLabels.get(edge.id);

            return (
              <g
                key={edge.id}
                id={`edge-group-${edge.id}`}
                className="cursor-pointer transition-all duration-100"
                onClick={e => {
                  e.stopPropagation();
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                }}
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseLeave={() => setHoveredEdgeId(null)}
              >
                {/* Thick invisible path for easy clicking & hover */}
                <path
                  d={pathString}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="18"
                />

                {/* Glow backlight on hover/select */}
                {(isHovered || isSelected) && (
                  <path
                    d={pathString}
                    fill="none"
                    stroke={edgeColor}
                    strokeWidth="6"
                    strokeOpacity="0.35"
                  />
                )}

                {/* Primary Wire Path */}
                <path
                  d={pathString}
                  fill="none"
                  stroke={edgeColor}
                  strokeWidth={isSelected ? '2.5' : isHovered ? '2.2' : '1.75'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={`url(#${markerId})`}
                />

                {/* Optional Leader Line for Displaced Labels */}
                {showEdgeLabels && edge.label && labelInfo && labelInfo.hasLeaderLine && (
                  <g opacity="0.6">
                    <line
                      x1={labelInfo.anchorPoint.x}
                      y1={labelInfo.anchorPoint.y}
                      x2={labelInfo.x}
                      y2={labelInfo.y}
                      stroke={edgeColor}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={labelInfo.anchorPoint.x}
                      cy={labelInfo.anchorPoint.y}
                      r="2"
                      fill={edgeColor}
                    />
                  </g>
                )}

                {/* Edge Label Badge with Anti-Collision Optimization & Dragging */}
                {showEdgeLabels && edge.label && labelInfo && (
                  <g
                    transform={`translate(${labelInfo.x}, ${labelInfo.y})`}
                    className="pointer-events-auto select-none transition-transform hover:scale-105 cursor-move"
                    onMouseDown={e => handleLabelMouseDown(e, edge.id, labelInfo)}
                  >
                    {/* Bento Pill Box */}
                    <rect
                      x={-labelInfo.width / 2}
                      y={-labelInfo.height / 2}
                      width={labelInfo.width}
                      height={labelInfo.height}
                      rx="6"
                      fill="#16181d"
                      stroke={isSelected ? '#ec4899' : isHovered ? '#60a5fa' : 'rgba(255,255,255,0.18)'}
                      strokeWidth={isSelected ? '1.5' : '1'}
                      className="shadow-xl"
                    />

                    {/* Edge Accent Dot */}
                    <circle
                      cx={-labelInfo.width / 2 + 7}
                      cy="0"
                      r="2.5"
                      fill={edgeColor}
                    />

                    {/* Edge Label Text */}
                    <text
                      x={3}
                      y="3.5"
                      fill={isSelected ? '#ffffff' : isHovered ? '#ffffff' : '#cbd5e1'}
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* 4. Active Connection Line when Dragging a Port */}
        {connectingFrom && (
          <g id="active-wire-connecting">
            <line
              x1={connectingFrom.x}
              y1={connectingFrom.y}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <circle cx={mousePos.x} cy={mousePos.y} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
          </g>
        )}

        {/* 5. Render Block Nodes (Flexible Shapes, Images, 4-way Fixed/Adaptive Ports, Hierarchical Subcircuits) */}
        <g id="block-nodes-layer">
          {visibleNodes.map((node) => {
            const isSelected = selectedNodeId === node.id || selectedNodeIds.has(node.id);
            const isDragging = draggingNodeId === node.id;
            const allPorts: Port[] = [...(node.inputs || []), ...(node.outputs || [])];
            const shape: BlockShape = node.shape || 'rounded';
            const hasImage = Boolean(node.imageUrl);
            const showTitleOverlay = node.showTitleOverlay ?? true;

            const strokeColor = isSelected
              ? '#60a5fa'
              : node.isSubcircuit
              ? '#a855f7'
              : isDragging
              ? '#3b82f6'
              : 'rgba(255,255,255,0.12)';
            const strokeWidthVal = isSelected ? '2' : node.isSubcircuit ? '1.5' : '1';

            // Shape path rendering helper
            let shapeElement = null;
            if (shape === 'chip_ic') {
              const d = `M 0 8 Q 0 0 8 0 L ${node.width / 2 - 10} 0 A 8 8 0 0 0 ${node.width / 2 + 10} 0 L ${node.width - 8} 0 Q ${node.width} 0 ${node.width} 8 L ${node.width} ${node.height - 8} Q ${node.width} ${node.height} ${node.width - 8} ${node.height} L 8 ${node.height} Q 0 ${node.height} 0 ${node.height - 8} Z`;
              shapeElement = (
                <path
                  d={d}
                  fill="#16181d"
                  stroke={strokeColor}
                  strokeWidth={strokeWidthVal}
                  strokeDasharray={node.isSubcircuit ? '4 2' : undefined}
                  className="shadow-2xl"
                />
              );
            } else if (shape === 'rectangle') {
              shapeElement = (
                <rect
                  x="0"
                  y="0"
                  width={node.width}
                  height={node.height}
                  fill="#16181d"
                  stroke={strokeColor}
                  strokeWidth={strokeWidthVal}
                  strokeDasharray={node.isSubcircuit ? '4 2' : undefined}
                  className="shadow-2xl"
                />
              );
            } else if (shape === 'hexagon') {
              const pts = `${node.width * 0.16},0 ${node.width * 0.84},0 ${node.width},${node.height * 0.5} ${node.width * 0.84},${node.height} ${node.width * 0.16},${node.height} 0,${node.height * 0.5}`;
              shapeElement = (
                <polygon
                  points={pts}
                  fill="#16181d"
                  stroke={strokeColor}
                  strokeWidth={strokeWidthVal}
                  strokeDasharray={node.isSubcircuit ? '4 2' : undefined}
                  className="shadow-2xl"
                />
              );
            } else if (shape === 'circle') {
              const radius = Math.min(node.width, node.height) / 2;
              shapeElement = (
                <circle
                  cx={node.width / 2}
                  cy={node.height / 2}
                  r={radius}
                  fill="#16181d"
                  stroke={strokeColor}
                  strokeWidth={strokeWidthVal}
                  strokeDasharray={node.isSubcircuit ? '4 2' : undefined}
                  className="shadow-2xl"
                />
              );
            } else if (shape === 'diamond') {
              const pts = `${node.width / 2},0 ${node.width},${node.height / 2} ${node.width / 2},${node.height} 0,${node.height / 2}`;
              shapeElement = (
                <polygon
                  points={pts}
                  fill="#16181d"
                  stroke={strokeColor}
                  strokeWidth={strokeWidthVal}
                  strokeDasharray={node.isSubcircuit ? '4 2' : undefined}
                  className="shadow-2xl"
                />
              );
            } else {
              // Default Rounded Bento Box
              shapeElement = (
                <rect
                  x="0"
                  y="0"
                  width={node.width}
                  height={node.height}
                  rx="12"
                  fill="#16181d"
                  stroke={strokeColor}
                  strokeWidth={strokeWidthVal}
                  strokeDasharray={node.isSubcircuit ? '4 2' : undefined}
                  className="shadow-2xl"
                />
              );
            }

            return (
              <g
                key={node.id}
                id={`block-node-${node.id}`}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onTouchStart={(e) => handleNodeTouchStart(e, node)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (node.isSubcircuit && node.subcircuitId && onEnterSubcircuit) {
                    onEnterSubcircuit(node.subcircuitId, node.title, node.id);
                  }
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                {/* 1. Base Geometry Container */}
                {shapeElement}

                {/* 2. Custom Image Representation (if present) */}
                {hasImage && node.imageUrl && (
                  <image
                    href={node.imageUrl}
                    x="0"
                    y={showTitleOverlay ? 22 : 0}
                    width={node.width}
                    height={showTitleOverlay ? Math.max(20, node.height - 22) : node.height}
                    preserveAspectRatio={
                      node.imageFit === 'cover'
                        ? 'xMidYMid slice'
                        : node.imageFit === 'fill'
                        ? 'none'
                        : 'xMidYMid meet'
                    }
                    clipPath={`url(#clip-shape-${node.id})`}
                    opacity={node.imageOpacity ?? 1.0}
                  />
                )}

                {/* Chip IC Pin 1 Orientation Dot */}
                {shape === 'chip_ic' && (
                  <circle cx="12" cy="12" r="2.5" fill="#f59e0b" opacity="0.8" />
                )}

                {/* 3. Node Top Header (if overlay enabled or no image) */}
                {(!hasImage || showTitleOverlay) && (
                  <>
                    <path
                      d={`M 0 10 Q 0 0 10 0 L ${node.width - 10} 0 Q ${node.width} 0 ${node.width} 10 L ${node.width} 22 L 0 22 Z`}
                      fill={hasImage ? 'rgba(15, 23, 42, 0.85)' : node.isSubcircuit ? 'rgba(59, 7, 100, 0.7)' : '#1e293b'}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />

                    {/* Left Mini Accent Dot */}
                    <circle cx="10" cy="11" r="3" fill={node.color || (node.isSubcircuit ? '#c084fc' : '#3b82f6')} />

                    {/* Node Title */}
                    <text
                      x="18"
                      y="14.5"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="system-ui, sans-serif"
                    >
                      {node.title.length > 20 ? `${node.title.slice(0, 19)}…` : node.title}
                    </text>

                    {/* Node Category Tag */}
                    <text
                      x={node.width - (node.isSubcircuit ? 42 : 24)}
                      y="14"
                      fill={node.isSubcircuit ? '#c084fc' : '#94a3b8'}
                      fontSize="7.5"
                      textAnchor="end"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {node.isSubcircuit ? 'SUBCIRCUIT' : node.category.toUpperCase()}
                    </text>

                    {/* Enter Subcircuit Drill-down Button in Header */}
                    {node.isSubcircuit && node.subcircuitId && (
                      <g
                        transform={`translate(${node.width - 38}, 3)`}
                        className="cursor-pointer group"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (node.subcircuitId && onEnterSubcircuit) {
                            onEnterSubcircuit(node.subcircuitId, node.title, node.id);
                          }
                        }}
                        title="Войти в подсхему (Двойной клик)"
                      >
                        <rect x="0" y="0" width="16" height="16" rx="4" fill="rgba(168, 85, 247, 0.35)" stroke="#a855f7" strokeWidth="1" />
                        <path d="M 4 8 L 12 8 M 9 5 L 12 8 L 9 11" stroke="#f3e8ff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </g>
                    )}

                    {/* Pin / Freeze Button on Node Header */}
                    <g
                      transform={`translate(${node.width - 20}, 3)`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = nodes.map((n) =>
                          n.id === node.id ? { ...n, isPinned: !n.isPinned } : n
                        );
                        onNodesChange(updated);
                      }}
                      title={
                        node.isPinned
                          ? 'Узел заморожен (неподвижен при оптимизации ∇Φ=0)'
                          : 'Заморозить узел от перемещений'
                      }
                    >
                      <rect
                        x="0"
                        y="0"
                        width="16"
                        height="16"
                        rx="3"
                        fill={node.isPinned ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.06)'}
                        stroke={node.isPinned ? '#f59e0b' : 'transparent'}
                        strokeWidth="1"
                      />
                      <text
                        x="8"
                        y="11.5"
                        fill={node.isPinned ? '#fbbf24' : '#64748b'}
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="system-ui"
                      >
                        {node.isPinned ? '🔒' : '🔓'}
                      </text>
                    </g>
                  </>
                )}

                {/* Subtitle / Model info if no image */}
                {!hasImage && node.subtitle && (
                  <text
                    x="10"
                    y={node.height - 8}
                    fill="#64748b"
                    fontSize="7.5"
                    fontFamily="monospace"
                  >
                    {node.subtitle}
                  </text>
                )}

                {/* 4. RENDER ALL 4-SIDED PORTS (Fixed & Adaptive with Visual Distinction) */}
                {allPorts.map((port) => {
                  const portPos = getPortCoordinates(node, port.id, port.type === 'output');
                  const localX = portPos.x - node.x;
                  const localY = portPos.y - node.y;
                  const side: PortSide = portPos.side;
                  const portColor = getPortColor(port);
                  const isPortHovered = hoveredPortKey === `${node.id}-${port.id}`;
                  const isConnectingSource =
                    connectingFrom?.nodeId === node.id && connectingFrom?.portId === port.id;
                  const isFixed = port.placementMode === 'fixed';

                  // Calculate text alignment & offsets
                  let textX = localX;
                  let textY = localY;
                  let textAnchor: 'start' | 'middle' | 'end' = 'start';

                  switch (side) {
                    case 'left':
                      textX = 10;
                      textY = localY + 3.5;
                      textAnchor = 'start';
                      break;
                    case 'right':
                      textX = node.width - 10;
                      textY = localY + 3.5;
                      textAnchor = 'end';
                      break;
                    case 'top':
                      textX = localX;
                      textY = 32;
                      textAnchor = 'middle';
                      break;
                    case 'bottom':
                      textX = localX;
                      textY = node.height - 8;
                      textAnchor = 'middle';
                      break;
                  }

                  return (
                    <g
                      key={`port-group-${port.id}`}
                      id={`port-${node.id}-${port.id}`}
                      className="cursor-crosshair group"
                      onMouseDown={(e) => handlePortMouseDown(e, node, port)}
                      onMouseUp={(e) => handlePortMouseUp(e, node, port)}
                      onMouseEnter={() => setHoveredPortKey(`${node.id}-${port.id}`)}
                      onMouseLeave={() => setHoveredPortKey(null)}
                    >
                      {/* Active Connecting Ring Pulse */}
                      {isConnectingSource && (
                        <circle
                          cx={localX}
                          cy={localY}
                          r="10"
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth="2"
                          className="animate-pulse"
                        />
                      )}

                      {/* PORT PIN GEOMETRY: Square Pad for Fixed, Circle for Adaptive */}
                      {isFixed ? (
                        // Fixed Port: Square EDA Pin Pad
                        <rect
                          x={localX - (isPortHovered || isConnectingSource ? 5.5 : 4.5)}
                          y={localY - (isPortHovered || isConnectingSource ? 5.5 : 4.5)}
                          width={isPortHovered || isConnectingSource ? 11 : 9}
                          height={isPortHovered || isConnectingSource ? 11 : 9}
                          rx="1.5"
                          fill={portColor}
                          stroke="#0c0d10"
                          strokeWidth="1.5"
                          className="transition-all duration-150"
                        />
                      ) : (
                        // Adaptive Port: Smooth Circular Contact
                        <circle
                          cx={localX}
                          cy={localY}
                          r={isPortHovered || isConnectingSource ? 6 : 4.5}
                          fill={portColor}
                          stroke="#0c0d10"
                          strokeWidth="1.5"
                          className="transition-all duration-150"
                        />
                      )}

                      {/* Direction indicator triangle */}
                      <polygon
                        points={
                          side === 'right'
                            ? `${localX + 1.5},${localY} ${localX - 1.5},${localY - 2} ${localX - 1.5},${localY + 2}`
                            : side === 'left'
                            ? `${localX - 1.5},${localY} ${localX + 1.5},${localY - 2} ${localX + 1.5},${localY + 2}`
                            : side === 'top'
                            ? `${localX},${localY - 1.5} ${localX - 2},${localY + 1.5} ${localX + 2},${localY + 1.5}`
                            : `${localX},${localY + 1.5} ${localX - 2},${localY - 1.5} ${localX + 2},${localY - 1.5}`
                        }
                        fill="#0c0d10"
                      />

                      {/* Large Hitbox for Touch / Click */}
                      <circle
                        cx={localX}
                        cy={localY}
                        r="14"
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePortInteraction(node, port);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          handlePortInteraction(node, port);
                        }}
                      />

                      {/* Port Label inside container */}
                      {(!hasImage || showTitleOverlay) && (
                        <text
                          x={textX}
                          y={textY}
                          fill={isPortHovered ? '#ffffff' : '#cbd5e1'}
                          fontSize="8"
                          fontWeight="500"
                          textAnchor={textAnchor}
                          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                        >
                          {port.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Canvas Quick Legend / Help (Responsive on mobile) */}
      <div className="hidden md:flex absolute bottom-4 left-4 z-20 items-center gap-3 bg-[#16181d]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-[10px] text-gray-400 font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Signals</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Bus</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Clock</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Power</span>
        </div>
        <span className="text-white/20">|</span>
        <span>Tap port to wire • Drag node to move • Pinch to zoom</span>
      </div>
    </div>
  );
};
