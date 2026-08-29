/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { DiagramCanvas } from './components/DiagramCanvas';
import { ToastContainer } from './components/ToastContainer';
import { toast } from './utils/toastService';

import {
  BlockNode,
  EdgeConnection,
  LayoutAlgorithmType,
  RoutingAlgorithmType,
  RoutingOptions,
  BenchmarkMetrics,
  SubcircuitDefinition,
  HierarchyBreadcrumb,
  ExternalPortBinding,
  PortSide,
  Port,
} from './types';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from './data/weightPresets';

import { routeOrthogonalAStar } from './algorithms/orthogonalAStarRouter';
import { routeLeeWave, LeeDebugWave } from './algorithms/leeWaveRouter';
import { routeManhattanChannel } from './algorithms/manhattanChannelRouter';
import { routeSmoothSplines } from './algorithms/splineRouter';
import { calculateBenchmarkMetrics } from './algorithms/metrics';
import { findDeterministicFreeSlot, applyBlockAutoSizing } from './algorithms/blockGeometry';

interface HierarchyStackFrame {
  subcircuitId: string | null;
  name: string;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  parentNodeId?: string;
}

export default function App() {
  // Hierarchical Subcircuits State
  const [subcircuits, setSubcircuits] = useState<Record<string, SubcircuitDefinition>>({});
  const [hierarchyPath, setHierarchyPath] = useState<HierarchyBreadcrumb[]>([
    { subcircuitId: null, name: 'Схема' },
  ]);
  const [hierarchyStack, setHierarchyStack] = useState<HierarchyStackFrame[]>([]);

  const [nodes, setNodes] = useState<BlockNode[]>([]);
  const [edges, setEdges] = useState<EdgeConnection[]>([]);

  const [layoutAlgorithm] = useState<LayoutAlgorithmType>('sugiyama');
  const [routingAlgorithm] = useState<RoutingAlgorithmType>('orthogonal_astar');

  const [routingOptions] = useState<RoutingOptions>({
    gridSize: 10,
    obstacleClearance: 15,
    bendPenalty: 35,
    crossingPenalty: 25,
    channelSpacing: 14,
    portExitOffset: 20,
    adaptivePortExitOffset: true,
    smoothCorners: true,
    jumpBridges: false,
    pinAlignment: true,
    artifactCleaning: true,
    weights: DEFAULT_OPTIMIZATION_WEIGHTS,
  });

  const [debugWaveCells, setDebugWaveCells] = useState<LeeDebugWave[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<BenchmarkMetrics | undefined>(undefined);

  // Recalculate edge routing whenever nodes, routing algorithm, or options change
  const computeRouting = useCallback(
    (currentNodes: BlockNode[], currentEdges: EdgeConnection[]): EdgeConnection[] => {
      const tStart = performance.now();
      let routed: EdgeConnection[] = [];
      let debugCells: LeeDebugWave[] = [];

      if (routingAlgorithm === 'orthogonal_astar') {
        routed = routeOrthogonalAStar(currentNodes, currentEdges, routingOptions);
      } else if (routingAlgorithm === 'lee_wave') {
        const leeRes = routeLeeWave(currentNodes, currentEdges, routingOptions);
        routed = leeRes.edges;
        debugCells = leeRes.debugWaveCells;
      } else if (routingAlgorithm === 'manhattan_channel') {
        routed = routeManhattanChannel(currentNodes, currentEdges, routingOptions);
      } else if (routingAlgorithm === 'smooth_spline') {
        routed = routeSmoothSplines(currentNodes, currentEdges, routingOptions);
      }

      const duration = performance.now() - tStart;
      setDebugWaveCells(debugCells);

      // Compute metrics
      const layoutName =
        layoutAlgorithm === 'sugiyama'
          ? 'Sugiyama (Послойный)'
          : layoutAlgorithm === 'orthogonal_grid'
          ? 'Orthogonal Grid'
          : layoutAlgorithm === 'force_directed'
          ? 'Force-Directed'
          : 'Manual';

      const routerName =
        routingAlgorithm === 'orthogonal_astar'
          ? 'Orthogonal A*'
          : routingAlgorithm === 'lee_wave'
          ? 'Lee Maze Wave'
          : routingAlgorithm === 'manhattan_channel'
          ? 'Manhattan Channel'
          : 'Smooth Spline';

      const m = calculateBenchmarkMetrics(currentNodes, routed, duration, layoutName, routerName, routingOptions);
      setCurrentMetrics(m);

      return routed;
    },
    [routingAlgorithm, routingOptions, layoutAlgorithm]
  );

  // Run full layout placement + routing
  // Active subcircuit definition if currently viewing inside a subcircuit
  const currentBreadcrumb = hierarchyPath[hierarchyPath.length - 1];
  const activeSubcircuitId = currentBreadcrumb?.subcircuitId;
  const activeSubcircuit = activeSubcircuitId ? subcircuits[activeSubcircuitId] || null : null;

  // Enter into a subcircuit
  const handleEnterSubcircuit = useCallback(
    (subcircuitId: string, nodeTitle?: string, parentNodeId?: string) => {
      let sub = subcircuits[subcircuitId];
      if (!sub) {
        // Create an empty subcircuit if it doesn't exist yet
        sub = {
          id: subcircuitId,
          name: nodeTitle || 'Подсхема',
          category: 'processor',
          nodes: [],
          edges: [],
          externalInputs: [],
          externalOutputs: [],
        };
        setSubcircuits(prev => ({ ...prev, [subcircuitId]: sub }));
      }

      // Push current canvas state to hierarchy stack
      const currentLevelName = hierarchyPath[hierarchyPath.length - 1]?.name || 'Схема';
      setHierarchyStack(prev => [
        ...prev,
        {
          subcircuitId: activeSubcircuitId || null,
          name: currentLevelName,
          nodes,
          edges,
          parentNodeId,
        },
      ]);

      // Set new active path
      setHierarchyPath(prev => [
        ...prev,
        { subcircuitId, name: nodeTitle || sub.name, parentNodeId },
      ]);

      // Set nodes and edges to subcircuit internals
      setNodes(sub.nodes);
      const routed = computeRouting(sub.nodes, sub.edges);
      setEdges(routed);

      toast.info(`Вход в подсхему: ${nodeTitle || sub.name}`);
    },
    [subcircuits, hierarchyPath, activeSubcircuitId, nodes, edges, computeRouting]
  );

  // Leave active subcircuit and return to parent
  const handleLeaveSubcircuit = useCallback(() => {
    if (hierarchyStack.length === 0) return;

    const parentFrame = hierarchyStack[hierarchyStack.length - 1];
    const newStack = hierarchyStack.slice(0, -1);

    // Save current subcircuit internals back to subcircuits dictionary
    if (activeSubcircuitId) {
      setSubcircuits(prev => {
        const existing = prev[activeSubcircuitId] || {
          id: activeSubcircuitId,
          name: 'Подсхема',
          nodes: [],
          edges: [],
          externalInputs: [],
          externalOutputs: [],
        };
        return {
          ...prev,
          [activeSubcircuitId]: {
            ...existing,
            nodes,
            edges,
          },
        };
      });
    }

    // Restore parent nodes and edges
    let parentNodes = parentFrame.nodes;
    // If we have parentNodeId and activeSubcircuit, sync its ports
    if (parentFrame.parentNodeId && activeSubcircuit) {
      parentNodes = parentNodes.map(n => {
        if (n.id === parentFrame.parentNodeId) {
          const syncInputs: Port[] = activeSubcircuit.externalInputs.map(extIn => ({
            id: extIn.id,
            name: extIn.name,
            type: 'input',
            side: extIn.side,
            placementMode: 'adaptive',
            dataType: extIn.dataType || 'signal',
          }));
          const syncOutputs: Port[] = activeSubcircuit.externalOutputs.map(extOut => ({
            id: extOut.id,
            name: extOut.name,
            type: 'output',
            side: extOut.side,
            placementMode: 'adaptive',
            dataType: extOut.dataType || 'signal',
          }));
          return {
            ...n,
            inputs: syncInputs.length > 0 ? syncInputs : n.inputs,
            outputs: syncOutputs.length > 0 ? syncOutputs : n.outputs,
          };
        }
        return n;
      });
    }

    setHierarchyStack(newStack);
    setHierarchyPath(prev => prev.slice(0, -1));
    setNodes(parentNodes);
    const routed = computeRouting(parentNodes, parentFrame.edges);
    setEdges(routed);
    toast.info(`Возврат на уровень: ${parentFrame.name}`);
  }, [hierarchyStack, activeSubcircuitId, activeSubcircuit, nodes, edges, computeRouting]);

  const handleNavigateHierarchy = useCallback(
    (targetIndex: number) => {
      if (targetIndex >= hierarchyPath.length - 1) return;
      const stepsToGoUp = hierarchyPath.length - 1 - targetIndex;
      for (let i = 0; i < stepsToGoUp; i++) {
        handleLeaveSubcircuit();
      }
    },
    [hierarchyPath, handleLeaveSubcircuit]
  );

  // Group selected nodes into a new Subcircuit
  const handleGroupSelectionIntoSubcircuit = useCallback(
    (selectedNodeIds: string[]) => {
      if (selectedNodeIds.length === 0) return;
      const selectedSet = new Set(selectedNodeIds);
      const selectedNodes = nodes.filter(n => selectedSet.has(n.id));
      const remainingNodes = nodes.filter(n => !selectedSet.has(n.id));

      const newSubcircuitId = `subcircuit_${Date.now()}`;
      const newSubcircuitTitle = `Subcircuit (${selectedNodes.length} Blocks)`;

      // Identify internal edges vs boundary crossing edges
      const internalEdges: EdgeConnection[] = [];
      const externalIncomingEdges: EdgeConnection[] = [];
      const externalOutgoingEdges: EdgeConnection[] = [];
      const remainingEdges: EdgeConnection[] = [];

      for (const e of edges) {
        const isSrcIn = selectedSet.has(e.sourceBlockId);
        const isDstIn = selectedSet.has(e.targetBlockId);
        if (isSrcIn && isDstIn) {
          internalEdges.push(e);
        } else if (!isSrcIn && isDstIn) {
          externalIncomingEdges.push(e);
        } else if (isSrcIn && !isDstIn) {
          externalOutgoingEdges.push(e);
        } else {
          remainingEdges.push(e);
        }
      }

      // Map boundary edges to external ports
      const externalInputs: ExternalPortBinding[] = externalIncomingEdges.map((e, idx) => ({
        id: `ext_in_${idx}`,
        name: e.label || `IN_${idx + 1}`,
        type: 'input',
        side: 'left',
        internalNodeId: e.targetBlockId,
        internalPortId: e.targetPortId,
      }));

      const externalOutputs: ExternalPortBinding[] = externalOutgoingEdges.map((e, idx) => ({
        id: `ext_out_${idx}`,
        name: e.label || `OUT_${idx + 1}`,
        type: 'output',
        side: 'right',
        internalNodeId: e.sourceBlockId,
        internalPortId: e.sourcePortId,
      }));

      const newSubcircuitDef: SubcircuitDefinition = {
        id: newSubcircuitId,
        name: newSubcircuitTitle,
        category: 'processor',
        nodes: selectedNodes,
        edges: internalEdges,
        externalInputs,
        externalOutputs,
      };

      // Calculate center position for the new collapsed block
      const minX = Math.min(...selectedNodes.map(n => n.x));
      const minY = Math.min(...selectedNodes.map(n => n.y));

      const collapsedBlockId = `block_${newSubcircuitId}`;
      const collapsedBlock: BlockNode = {
        id: collapsedBlockId,
        title: newSubcircuitTitle,
        subtitle: 'Подсхема (Двойной клик для входа)',
        category: 'processor',
        x: minX,
        y: minY,
        width: 190,
        height: 120,
        isSubcircuit: true,
        subcircuitId: newSubcircuitId,
        subcircuitSummary: `Содержит ${selectedNodes.length} блоков и ${internalEdges.length} внутренних связей`,
        inputs: externalInputs.map(p => ({
          id: p.id,
          name: p.name,
          type: 'input',
          side: p.side,
          placementMode: 'adaptive',
          dataType: 'signal',
        })),
        outputs: externalOutputs.map(p => ({
          id: p.id,
          name: p.name,
          type: 'output',
          side: p.side,
          placementMode: 'adaptive',
          dataType: 'signal',
        })),
        color: '#8b5cf6',
      };

      // Rewire external incoming/outgoing edges to point to collapsed block
      const rewiredIncoming: EdgeConnection[] = externalIncomingEdges.map((e, idx) => ({
        ...e,
        targetBlockId: collapsedBlockId,
        targetPortId: externalInputs[idx].id,
      }));

      const rewiredOutgoing: EdgeConnection[] = externalOutgoingEdges.map((e, idx) => ({
        ...e,
        sourceBlockId: collapsedBlockId,
        sourcePortId: externalOutputs[idx].id,
      }));

      const updatedNodes = [...remainingNodes, collapsedBlock];
      const updatedEdges = [...remainingEdges, ...rewiredIncoming, ...rewiredOutgoing];

      setSubcircuits(prev => ({ ...prev, [newSubcircuitId]: newSubcircuitDef }));
      setNodes(updatedNodes);
      const routed = computeRouting(updatedNodes, updatedEdges);
      setEdges(routed);

      toast.success('Подсхема успешно создана', `Сгруппировано ${selectedNodes.length} компонентов`);
    },
    [nodes, edges, computeRouting]
  );

  // Add an external port to the active subcircuit
  const handleAddExternalPort = useCallback(
    (type: 'input' | 'output', side: PortSide) => {
      if (!activeSubcircuitId) return;
      setSubcircuits(prev => {
        const sub = prev[activeSubcircuitId];
        if (!sub) return prev;
        const newPortId = `ext_${type}_${Date.now().toString().slice(-4)}`;
        const newPortName = `${type === 'input' ? 'EXT_IN' : 'EXT_OUT'}_${(type === 'input' ? sub.externalInputs.length : sub.externalOutputs.length) + 1}`;
        const newBinding: ExternalPortBinding = {
          id: newPortId,
          name: newPortName,
          type,
          side,
          internalNodeId: sub.nodes[0]?.id || '',
          internalPortId: (type === 'input' ? sub.nodes[0]?.inputs[0]?.id : sub.nodes[0]?.outputs[0]?.id) || '',
        };
        return {
          ...prev,
          [activeSubcircuitId]: {
            ...sub,
            externalInputs: type === 'input' ? [...sub.externalInputs, newBinding] : sub.externalInputs,
            externalOutputs: type === 'output' ? [...sub.externalOutputs, newBinding] : sub.externalOutputs,
          },
        };
      });
      toast.info(`Добавлен внешний порт: ${type.toUpperCase()}`);
    },
    [activeSubcircuitId]
  );

  // Update binding between external port and internal block port
  const handleUpdateExternalPortBinding = useCallback(
    (portId: string, internalNodeId: string, internalPortId: string) => {
      if (!activeSubcircuitId) return;
      setSubcircuits(prev => {
        const sub = prev[activeSubcircuitId];
        if (!sub) return prev;
        const updateList = (list: ExternalPortBinding[]) =>
          list.map(p => (p.id === portId ? { ...p, internalNodeId, internalPortId } : p));
        return {
          ...prev,
          [activeSubcircuitId]: {
            ...sub,
            externalInputs: updateList(sub.externalInputs),
            externalOutputs: updateList(sub.externalOutputs),
          },
        };
      });
      toast.success('Соединение с внешним портом обновлено');
    },
    [activeSubcircuitId]
  );

  // Delete external port from active subcircuit
  const handleDeleteExternalPort = useCallback(
    (portId: string) => {
      if (!activeSubcircuitId) return;
      setSubcircuits(prev => {
        const sub = prev[activeSubcircuitId];
        if (!sub) return prev;
        return {
          ...prev,
          [activeSubcircuitId]: {
            ...sub,
            externalInputs: sub.externalInputs.filter(p => p.id !== portId),
            externalOutputs: sub.externalOutputs.filter(p => p.id !== portId),
          },
        };
      });
      toast.info('Внешний порт удален');
    },
    [activeSubcircuitId]
  );

  // Handle node movement from canvas
  const handleNodesChange = (updatedNodes: BlockNode[]) => {
    setNodes(updatedNodes);
    const routed = computeRouting(updatedNodes, edges);
    setEdges(routed);
  };

  // Handle edge additions / deletions from canvas
  const handleEdgesChange = (updatedEdges: EdgeConnection[]) => {
    const routed = computeRouting(nodes, updatedEdges);
    setEdges(routed);
  };

  // Handle duplicating an existing block
  const handleDuplicateNode = useCallback(
    (nodeToDup: BlockNode) => {
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
      const updated = [...nodes, duplicatedNode];
      setNodes(updated);
      const reRouted = computeRouting(updated, edges);
      setEdges(reRouted);
      toast.info(`Дубликат блока создан: ${nodeToDup.title}`);
    },
    [nodes, edges, computeRouting]
  );

  // Handle adding a new functional block deterministically
  const handleAddBlock = (category: BlockNode['category']) => {
    const newId = `node_${Date.now()}`;
    const titles: Record<string, string> = {
      logic: 'Логический Вентиль NOR',
      processor: 'Обработчик Задач',
      source: 'Генератор Сигналов',
      sink: 'Приёмник Данных',
      storage: 'Кэш / Хранилище',
      custom: 'Пользовательский Блок',
    };

    const initialWidth = 150;
    const initialHeight = 80;
    const slot = findDeterministicFreeSlot(nodes, initialWidth, initialHeight);

    const rawNode: BlockNode = {
      id: newId,
      title: titles[category] || 'Новый Блок',
      category,
      x: slot.x,
      y: slot.y,
      width: initialWidth,
      height: initialHeight,
      shape: category === 'logic' ? 'diamond' : 'rounded',
      autoSize: true,
      inputs: [
        { id: `${newId}_in1`, name: 'In A', type: 'input', side: 'left', placementMode: 'adaptive', dataType: 'signal' },
        { id: `${newId}_in2`, name: 'In B', type: 'input', side: 'left', placementMode: 'adaptive', dataType: 'signal' },
      ],
      outputs: [
        { id: `${newId}_out`, name: 'Out Res', type: 'output', side: 'right', placementMode: 'adaptive', dataType: 'signal' },
      ],
      color: category === 'logic' ? '#8b5cf6' : category === 'processor' ? '#10b981' : '#3b82f6',
    };

    const newNode = applyBlockAutoSizing(rawNode);
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    const routed = computeRouting(newNodes, edges);
    setEdges(routed);
    toast.success(`Блок "${newNode.title}" добавлен`);
  };

  const handleLoadDiagram = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result;
          if (typeof text !== 'string') return;
          const data = JSON.parse(text);
          const loadedNodes: BlockNode[] = Array.isArray(data?.nodes) ? data.nodes : [];
          const loadedEdges: EdgeConnection[] = Array.isArray(data?.edges) ? data.edges : [];
          if (loadedNodes.length === 0) {
            toast.error('Некорректный файл', 'В файле не найдено поле "nodes" с блоками схемы');
            return;
          }
          setNodes(loadedNodes);
          setSubcircuits(data.subcircuits || {});
          setHierarchyPath([{ subcircuitId: null, name: data.name || 'Загруженная схема' }]);
          setHierarchyStack([]);
          const routed = computeRouting(loadedNodes, loadedEdges);
          setEdges(routed);
          toast.success('Диаграмма загружена', `${loadedNodes.length} блоков, ${loadedEdges.length} связей`);
        } catch (err) {
          console.error('Failed to parse diagram file:', err);
          toast.error('Ошибка чтения файла', 'Не удалось разобрать JSON-файл диаграммы');
        }
      };
      reader.readAsText(file);
    },
    [computeRouting]
  );

  const getLayoutDisplayName = (type: LayoutAlgorithmType) => {
    switch (type) {
      case 'sugiyama':
        return 'Sugiyama Layered (Послойный)';
      case 'orthogonal_grid':
        return 'Orthogonal Grid / TSM';
      case 'force_directed':
        return 'Force-Directed Flow';
      default:
        return 'Manual';
    }
  };

  const getRoutingDisplayName = (type: RoutingAlgorithmType) => {
    switch (type) {
      case 'orthogonal_astar':
        return 'Orthogonal A* (Normal-Aware)';
      case 'lee_wave':
        return 'Lee Maze Wave Router';
      case 'manhattan_channel':
        return 'Manhattan Channel Router';
      case 'smooth_spline':
        return 'Smooth Splines (Bézier)';
      default:
        return 'Orthogonal';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-[var(--accent)]/30 selection:text-[var(--text-primary)] transition-colors duration-200">
      <Header onLoadDiagram={handleLoadDiagram} />

      <main className="flex-1 flex overflow-hidden p-3 sm:p-4">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <DiagramCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onAddNode={handleAddBlock}
            onDuplicateNode={handleDuplicateNode}
            options={routingOptions}
            metrics={currentMetrics}
            debugWaveCells={debugWaveCells}
            activeLayoutName={getLayoutDisplayName(layoutAlgorithm)}
            activeRoutingName={getRoutingDisplayName(routingAlgorithm)}
            subcircuits={subcircuits}
            hierarchyPath={hierarchyPath}
            onEnterSubcircuit={handleEnterSubcircuit}
            onNavigateHierarchy={handleNavigateHierarchy}
            onLeaveSubcircuit={handleLeaveSubcircuit}
            activeSubcircuit={activeSubcircuit}
            onGroupSelectionIntoSubcircuit={handleGroupSelectionIntoSubcircuit}
            onAddExternalPort={handleAddExternalPort}
            onUpdateExternalPortBinding={handleUpdateExternalPortBinding}
            onDeleteExternalPort={handleDeleteExternalPort}
          />
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
