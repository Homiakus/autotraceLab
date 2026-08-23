import React, { useState, useRef, useCallback, useMemo } from 'react';
import { BlockNode, EdgeConnection, Point, RoutingOptions, BenchmarkMetrics, Port, PortSide, BlockShape } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Move, Eye, Tag, GitCommit, Sparkles, Zap, Plus, Image as ImageIcon, Lock } from 'lucide-react';
import { getPortCoordinatesAccurate as getPortCoordinates } from '../algorithms/blockGeometry';
import { LeeDebugWave } from '../algorithms/leeWaveRouter';
import { computeOptimizedLabels, OptimizedLabelPosition } from '../algorithms/labelLayout';
import { generateOrthogonalPathWithBridges } from '../algorithms/bridgeJumps';
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

  // Port wiring interaction (supports both drag-to-connect and tap-to-connect)
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    portId: string;
    isOutput: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });

  // Visual overlays
  const [showObstacles, setShowObstacles] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [showBridgeJumps, setShowBridgeJumps] = useState(options.jumpBridges);
  const [showInspector, _setShowInspector] = useState(true);

  // Compute mathematically optimized, non-overlapping label layout
  const optimizedLabels = useMemo(() => {
    return computeOptimizedLabels(nodes, edges, customLabelPositions, options.labelClearance || 14);
  }, [nodes, edges, customLabelPositions, options.labelClearance]);

  // Selected items
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId) || null, [edges, selectedEdgeId]);

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
      });
      setMousePos({ x: pos.x, y: pos.y });
    } else {
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
    });
  };

  // Port wiring release / complete (Drag mode)
  const handlePortMouseUp = (e: React.MouseEvent, targetNode: BlockNode, targetPort: Port) => {
    e.stopPropagation();
    if (!connectingFrom) return;

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

      {/* Floating Bento HUD: Metrics & Algorithm Info */}
      <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-20 flex flex-col gap-1.5 pointer-events-none max-w-[calc(100vw-6rem)] sm:max-w-xl">
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
          {nodes.map((node) => {
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
            {nodes.map(n => (
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

        {/* 3. Routed Edges Layer with IEEE Bridge Hops */}
        <g id="routed-edges-layer">
          {edges.map(edge => {
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

        {/* 5. Render Block Nodes (Flexible Shapes, Images, 4-way Fixed/Adaptive Ports) */}
        <g id="block-nodes-layer">
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isDragging = draggingNodeId === node.id;
            const allPorts: Port[] = [...(node.inputs || []), ...(node.outputs || [])];
            const shape: BlockShape = node.shape || 'rounded';
            const hasImage = Boolean(node.imageUrl);
            const showTitleOverlay = node.showTitleOverlay ?? true;

            const strokeColor = isSelected
              ? '#60a5fa'
              : isDragging
              ? '#3b82f6'
              : 'rgba(255,255,255,0.12)';
            const strokeWidthVal = isSelected ? '2' : '1';

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
                      fill={hasImage ? 'rgba(15, 23, 42, 0.85)' : '#1e293b'}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />

                    {/* Left Mini Accent Dot */}
                    <circle cx="10" cy="11" r="3" fill={node.color || '#3b82f6'} />

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
                      x={node.width - 24}
                      y="14"
                      fill="#94a3b8"
                      fontSize="7.5"
                      textAnchor="end"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {node.category.toUpperCase()}
                    </text>

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
                        fontSize="8.5"
                        textAnchor="middle"
                        fill={node.isPinned ? '#f59e0b' : '#94a3b8'}
                      >
                        📌
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
