/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header, ActiveTab } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { DiagramCanvas } from './components/DiagramCanvas';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import { ResearchPaperView } from './components/ResearchPaperView';
import { StepVisualizerModal } from './components/StepVisualizerModal';
import { CodeExportView } from './components/CodeExportView';
import { NlpOptimizationModal } from './components/NlpOptimizationModal';
import { CreateBlockModal } from './components/CreateBlockModal';
import { NLPOptimizationResult } from './algorithms/nlpOptimizer';
import { Sliders, Sparkles, Plus, Layers, Play, Zap } from 'lucide-react';

import {
  BlockNode,
  EdgeConnection,
  LayoutAlgorithmType,
  RoutingAlgorithmType,
  RoutingOptions,
  BenchmarkMetrics,
} from './types';
import { PRESET_TOPOLOGIES, PresetTopology } from './data/presets';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from './data/weightPresets';

import { runSugiyamaLayout } from './algorithms/sugiyamaLayout';
import { runForceDirectedLayout } from './algorithms/forceLayout';
import { runOrthogonalGridLayout } from './algorithms/orthogonalGridLayout';
import { routeOrthogonalAStar } from './algorithms/orthogonalAStarRouter';
import { routeLeeWave, LeeDebugWave } from './algorithms/leeWaveRouter';
import { routeManhattanChannel } from './algorithms/manhattanChannelRouter';
import { routeSmoothSplines } from './algorithms/splineRouter';
import { runUnifiedCoOptimization } from './algorithms/unifiedOptimizer';
import { calculateBenchmarkMetrics } from './algorithms/metrics';
import { findDeterministicFreeSlot, applyBlockAutoSizing } from './algorithms/blockGeometry';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas');
  const [selectedPreset, setSelectedPreset] = useState<PresetTopology>(PRESET_TOPOLOGIES[0]);
  const [isMobileControlOpen, setIsMobileControlOpen] = useState(false);

  const [nodes, setNodes] = useState<BlockNode[]>(PRESET_TOPOLOGIES[0].nodes);
  const [edges, setEdges] = useState<EdgeConnection[]>(PRESET_TOPOLOGIES[0].edges);

  const [layoutAlgorithm, setLayoutAlgorithm] = useState<LayoutAlgorithmType>('sugiyama');
  const [routingAlgorithm, setRoutingAlgorithm] = useState<RoutingAlgorithmType>('orthogonal_astar');

  const [routingOptions, setRoutingOptions] = useState<RoutingOptions>({
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
  const [isNlpModalOpen, setIsNlpModalOpen] = useState(false);
  const [isCreateBlockModalOpen, setIsCreateBlockModalOpen] = useState(false);
  const [customStepperSteps, setCustomStepperSteps] = useState<any[] | null>(null);

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
  const executeLayoutAndRoute = useCallback(
    (targetLayout: LayoutAlgorithmType = layoutAlgorithm, baseNodes = nodes, baseEdges = edges) => {
      let positionedNodes = baseNodes;

      if (targetLayout === 'sugiyama') {
        const res = runSugiyamaLayout(baseNodes, baseEdges);
        positionedNodes = res.nodes;
      } else if (targetLayout === 'orthogonal_grid') {
        const res = runOrthogonalGridLayout(baseNodes, baseEdges);
        positionedNodes = res.nodes;
      } else if (targetLayout === 'force_directed') {
        const res = runForceDirectedLayout(baseNodes, baseEdges);
        positionedNodes = res.nodes;
      }

      setNodes(positionedNodes);
      const routedEdges = computeRouting(positionedNodes, baseEdges);
      setEdges(routedEdges);
    },
    [layoutAlgorithm, nodes, edges, computeRouting]
  );

  // Initial execution on mount
  useEffect(() => {
    executeLayoutAndRoute('sugiyama', PRESET_TOPOLOGIES[0].nodes, PRESET_TOPOLOGIES[0].edges);
  }, []);

  // Run unified joint layout & artifact-free routing co-optimization
  const handleRunCoOptimization = useCallback(() => {
    const tStart = performance.now();
    const result = runUnifiedCoOptimization(nodes, edges, routingOptions);
    const duration = performance.now() - tStart;

    setNodes(result.nodes);
    setEdges(result.edges);

    const m = calculateBenchmarkMetrics(
      result.nodes,
      result.edges,
      duration,
      'Unified Co-Optimization',
      'Artifact-Free Orthogonal',
      routingOptions
    );
    m.straightWiresCount = result.straightWiresCount;
    m.eliminatedArtifactsCount = result.eliminatedArtifactsCount;
    m.portAlignmentScore = result.alignmentScore;
    setCurrentMetrics(m);
  }, [nodes, edges, routingOptions]);

  // Handle NLP optimization result apply
  const handleApplyNlpOptimization = (result: NLPOptimizationResult) => {
    setNodes(result.nodes);
    setEdges(result.edges);
    const m = calculateBenchmarkMetrics(
      result.nodes,
      result.edges,
      15,
      'Non-Linear Programming (NLP)',
      'Projected Gradient + Barrier',
      routingOptions
    );
    setCurrentMetrics(m);
  };

  const handleOpenStepperWithSteps = (steps: any[]) => {
    setCustomStepperSteps(steps);
    setActiveTab('stepper');
  };

  // Handle scenario preset change
  const handleSelectPreset = (preset: PresetTopology) => {
    setSelectedPreset(preset);
    setNodes(preset.nodes);
    executeLayoutAndRoute(layoutAlgorithm, preset.nodes, preset.edges);
  };

  // Handle layout algorithm change
  const handleLayoutChange = (newLayout: LayoutAlgorithmType) => {
    setLayoutAlgorithm(newLayout);
    executeLayoutAndRoute(newLayout, nodes, edges);
  };

  // Handle routing algorithm change
  const handleRoutingChange = (newRouting: RoutingAlgorithmType) => {
    setRoutingAlgorithm(newRouting);
  };

  // Trigger routing recompute whenever routing parameters or algorithm changes
  useEffect(() => {
    const updated = computeRouting(nodes, edges);
    setEdges(updated);
  }, [routingAlgorithm, routingOptions]);

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

  // Handle adding a custom configured block from modal
  const handleCreateCustomBlock = (newNode: BlockNode) => {
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    const routed = computeRouting(newNodes, edges);
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
    },
    [nodes, edges, computeRouting]
  );

  // Handle adding a new functional block deterministically (rule/2.md §2.5, §81)
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
  };

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
    <div className="min-h-screen bg-[#0c0d10] text-[#e0e2e5] flex flex-col font-sans selection:bg-blue-600/30 selection:text-white">
      {/* Top Global Navigation Bar */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Body View Switching */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'canvas' && (
          <div className="flex-1 flex flex-col lg:flex-row w-full h-[calc(100dvh-3.75rem)] relative">
            {/* Left Control & Configuration Sidebar / Mobile Drawer */}
            <ControlPanel
              selectedPresetId={selectedPreset.id}
              onSelectPreset={preset => {
                handleSelectPreset(preset);
                setIsMobileControlOpen(false);
              }}
              layoutAlgorithm={layoutAlgorithm}
              onLayoutChange={handleLayoutChange}
              routingAlgorithm={routingAlgorithm}
              onRoutingChange={handleRoutingChange}
              options={routingOptions}
              onOptionsChange={setRoutingOptions}
              onRunLayout={() => {
                executeLayoutAndRoute(layoutAlgorithm, nodes, edges);
                setIsMobileControlOpen(false);
              }}
              onRunCoOptimization={() => {
                handleRunCoOptimization();
                setIsMobileControlOpen(false);
              }}
              onOpenNlpModal={() => {
                setIsNlpModalOpen(true);
                setIsMobileControlOpen(false);
              }}
              onOpenCreateBlockModal={() => {
                setIsCreateBlockModalOpen(true);
                setIsMobileControlOpen(false);
              }}
              onAddBlock={category => {
                handleAddBlock(category);
                setIsMobileControlOpen(false);
              }}
              onOpenBenchmark={() => {
                setActiveTab('benchmark');
                setIsMobileControlOpen(false);
              }}
              onOpenStepper={() => {
                setActiveTab('stepper');
                setIsMobileControlOpen(false);
              }}
              isOpenOnMobile={isMobileControlOpen}
              onCloseMobile={() => setIsMobileControlOpen(false)}
            />

            {/* Interactive Graph & Edge Canvas */}
            <div className="flex-1 p-2 sm:p-3 bg-[#0c0d10] overflow-hidden relative">
              <DiagramCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onAddNode={handleAddBlock}
                onDuplicateNode={handleDuplicateNode}
                onOpenCreateModal={() => setIsCreateBlockModalOpen(true)}
                onRunCoOptimization={handleRunCoOptimization}
                onOpenNlpModal={() => setIsNlpModalOpen(true)}
                options={routingOptions}
                metrics={currentMetrics}
                debugWaveCells={debugWaveCells}
                activeLayoutName={getLayoutDisplayName(layoutAlgorithm)}
                activeRoutingName={getRoutingDisplayName(routingAlgorithm)}
              />

              {/* Floating Bottom Action Bar for Mobile Devices */}
              <div className="lg:hidden absolute bottom-3 left-3 right-3 z-30 flex items-center gap-2 pointer-events-auto">
                <button
                  id="mobile-btn-open-controls"
                  onClick={() => setIsMobileControlOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#16181d]/95 backdrop-blur-md border border-white/15 text-white shadow-2xl font-mono text-xs font-semibold active:scale-95 transition-transform"
                >
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <span>Параметры</span>
                </button>

                <button
                  id="mobile-btn-nlp-modal"
                  onClick={() => setIsNlpModalOpen(true)}
                  title="Нелинейное программирование (NLP)"
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 active:from-blue-500 active:to-indigo-500 text-white font-mono text-xs font-bold shadow-2xl active:scale-95 transition-transform"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>NLP</span>
                </button>

                <button
                  id="mobile-btn-co-optimize"
                  onClick={handleRunCoOptimization}
                  title="Запустить совместную оптимизацию"
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 active:from-cyan-500 active:to-blue-500 text-white font-mono text-xs font-bold shadow-2xl active:scale-95 transition-transform"
                >
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>Opt</span>
                </button>

                <button
                  id="mobile-btn-create-modal"
                  onClick={() => setIsCreateBlockModalOpen(true)}
                  title="Создать блок или компонент"
                  className="flex items-center justify-center p-2.5 rounded-xl bg-emerald-700/80 border border-emerald-500/40 text-emerald-200 shadow-2xl active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'benchmark' && (
          <div className="flex-1 overflow-y-auto h-[calc(100dvh-3.75rem)]">
            <BenchmarkPanel
              nodes={nodes}
              edges={edges}
              options={routingOptions}
            />
          </div>
        )}

        {activeTab === 'research' && (
          <div className="flex-1 overflow-y-auto h-[calc(100dvh-3.75rem)]">
            <ResearchPaperView />
          </div>
        )}

        {activeTab === 'stepper' && (
          <div className="flex-1 overflow-y-auto h-[calc(100dvh-3.75rem)]">
            <StepVisualizerModal
              nodes={nodes}
              edges={edges}
              customSteps={customStepperSteps}
              onApplyLayout={(newNodes, newEdges) => {
                setNodes(newNodes);
                setEdges(newEdges);
                setCustomStepperSteps(null);
                setActiveTab('canvas');
              }}
              onClose={() => {
                setCustomStepperSteps(null);
                setActiveTab('canvas');
              }}
            />
          </div>
        )}

        {activeTab === 'code' && (
          <div className="flex-1 overflow-y-auto h-[calc(100dvh-3.75rem)]">
            <CodeExportView />
          </div>
        )}
      </main>

      {/* Interactive Non-Linear Programming (NLP) Optimizer & Criteria Modal */}
      <NlpOptimizationModal
        isOpen={isNlpModalOpen}
        onClose={() => setIsNlpModalOpen(false)}
        nodes={nodes}
        edges={edges}
        options={routingOptions}
        onOptionsChange={setRoutingOptions}
        onApplyOptimization={handleApplyNlpOptimization}
        onOpenStepperWithSteps={handleOpenStepperWithSteps}
      />

      {/* Flexible Block Creation Modal (Image / Shape / Fixed & Adaptive Ports) */}
      <CreateBlockModal
        isOpen={isCreateBlockModalOpen}
        onClose={() => setIsCreateBlockModalOpen(false)}
        onCreateBlock={handleCreateCustomBlock}
      />
    </div>
  );
}
