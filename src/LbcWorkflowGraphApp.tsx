import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  ChevronDown,
  Download,
  GitBranch,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { DiagramCanvas } from './components/DiagramCanvas';
import { CreateBlockModal } from './components/CreateBlockModal';
import { AppearanceModal } from './components/AppearanceModal';
import { ToastContainer } from './components/ToastContainer';
import { LBC_AUTOMATION_COLORS, LBC_PHASES, LBC_PLATFORMS, LbcPlatform } from './data/lbcWorkflowData';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from './data/weightPresets';
import { routeOrthogonalAStar } from './algorithms/orthogonalAStarRouter';
import { runSugiyamaLayout } from './algorithms/sugiyamaLayout';
import { calculateBenchmarkMetrics } from './algorithms/metrics';
import { BlockNode, EdgeConnection, HierarchyBreadcrumb, RoutingOptions, SubcircuitDefinition } from './types';
import { toast } from './utils/toastService';
import { LabTraceWorkbench } from './labtrace/LabTraceWorkbench';
import type { LabTraceProgressiveScene } from './labtrace/types';

const DEFAULT_PLATFORM_IDS = ['thinprep-5000', 'surepath-classic', 'novaprep'];
const PLATFORM_COLORS = ['#d9468d', '#2fb995', '#4aa7d8', '#d29a43'];

const ROUTING_OPTIONS: RoutingOptions = {
  gridSize: 10,
  obstacleClearance: 18,
  bendPenalty: 42,
  crossingPenalty: 35,
  channelSpacing: 16,
  portExitOffset: 24,
  adaptivePortExitOffset: true,
  smoothCorners: true,
  cornerRadius: 8,
  jumpBridges: true,
  pinAlignment: true,
  artifactCleaning: true,
  labelClearance: 16,
  weights: DEFAULT_OPTIMIZATION_WEIGHTS,
};

interface LbcScene extends LabTraceProgressiveScene<{ domain: 'lbc'; platformIds: string[] }> {
  subcircuits: Record<string, SubcircuitDefinition>;
}

function safeId(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function createStageSubcircuit(platform: LbcPlatform, accent: string): SubcircuitDefinition {
  const nodes: BlockNode[] = platform.stages.map((stage, index) => {
    const stageId = `${platform.id}-stage-${index}`;
    const row = Math.floor(index / 4);
    const column = index % 4;
    return {
      id: stageId,
      title: stage.title,
      subtitle: stage.time,
      description: [
        stage.description,
        stage.operator ? `Человек: ${stage.operator}` : '',
        stage.machine ? `Автомат: ${stage.machine}` : '',
        stage.note ? `Примечание: ${stage.note}` : '',
      ].filter(Boolean).join('\n\n'),
      semanticType: LBC_PHASES.find((phase) => phase.id === stage.phase)?.title,
      category: stage.automation === 'manual' ? 'source' : stage.automation === 'qc' ? 'sink' : 'processor',
      x: 130 + column * 250,
      y: 110 + row * 205,
      width: 196,
      height: 112,
      shape: 'rounded',
      autoSize: false,
      color: LBC_AUTOMATION_COLORS[stage.automation] || accent,
      routingClearance: 16,
      preferredFlow: 'left-to-right',
      inputs: [{
        id: `${stageId}-in`,
        name: index === 0 ? 'VIAL_IN' : 'MATERIAL_IN',
        type: 'input',
        side: 'left',
        placementMode: 'fixed',
        relativePosition: 0.52,
        dataType: 'mechanical',
        description: 'Вход материала или стекла с предыдущего этапа',
      }],
      outputs: [{
        id: `${stageId}-out`,
        name: index === platform.stages.length - 1 ? 'SLIDE_OUT' : 'MATERIAL_OUT',
        type: 'output',
        side: 'right',
        placementMode: 'fixed',
        relativePosition: 0.52,
        dataType: 'mechanical',
        description: 'Выход материала или стекла на следующий этап',
      }],
    };
  });

  const edges: EdgeConnection[] = nodes.slice(0, -1).map((node, index) => ({
    id: `${platform.id}-flow-${index}`,
    sourceBlockId: node.id,
    sourcePortId: node.outputs[0].id,
    targetBlockId: nodes[index + 1].id,
    targetPortId: nodes[index + 1].inputs[0].id,
    label: LBC_PHASES[index + 1]?.title || 'следующий этап',
    dataType: 'mechanical',
    color: accent,
  }));

  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  return {
    id: `sub-${platform.id}`,
    name: `${platform.vendor} ${platform.name}`,
    description: platform.principle,
    category: 'processor',
    nodes,
    edges,
    externalInputs: [{
      id: `${platform.id}-vial-in`,
      name: 'VIAL_IN',
      type: 'input',
      side: 'left',
      dataType: 'mechanical',
      internalNodeId: firstNode.id,
      internalPortId: firstNode.inputs[0].id,
    }],
    externalOutputs: [{
      id: `${platform.id}-slide-out`,
      name: 'SLIDE_OUT',
      type: 'output',
      side: 'right',
      dataType: 'mechanical',
      internalNodeId: lastNode.id,
      internalPortId: lastNode.outputs[0].id,
    }],
  };
}

function createOverviewScene(platforms: LbcPlatform[]): LbcScene {
  const laneGap = 185;
  const centerY = 90 + ((Math.max(platforms.length, 1) - 1) * laneGap) / 2;
  const source: BlockNode = {
    id: 'lbc-sample-input',
    title: 'Приём и идентификация',
    subtitle: 'VIAL + LIS ID',
    description: 'Общий вход образца перед разветвлением по сравниваемым платформам.',
    semanticType: 'Sample intake',
    category: 'source',
    x: 70,
    y: centerY,
    width: 205,
    height: 176,
    shape: 'rounded',
    color: '#4aa7d8',
    inputs: [{ id: 'lab-vial-in', name: 'LAB_IN', type: 'input', side: 'left', placementMode: 'fixed', relativePosition: 0.5, dataType: 'mechanical' }],
    outputs: [
      ...platforms.map((platform, index) => ({
        id: `sample-bus-${platform.id}`,
        name: `SAMPLE_${index + 1}`,
        type: 'output' as const,
        side: 'right' as const,
        placementMode: 'fixed' as const,
        relativePosition: (index + 1) / (platforms.length + 2),
        dataType: 'mechanical',
      })),
      {
        id: 'lis-id-bus',
        name: 'LIS_ID_BUS',
        type: 'output' as const,
        side: 'right' as const,
        placementMode: 'fixed' as const,
        relativePosition: (platforms.length + 1) / (platforms.length + 2),
        dataType: 'data',
      },
    ],
  };

  const qc: BlockNode = {
    id: 'lbc-final-qc',
    title: 'Финальный QC и выдача',
    subtitle: 'STAINED SLIDE OUT',
    description: 'Проверка идентичности, качества окраски, клеточного пятна и готовности стекла к выдаче.',
    semanticType: 'Quality control',
    category: 'sink',
    x: 1135,
    y: centerY - 30,
    width: 220,
    height: 150,
    shape: 'rounded',
    color: '#d9468d',
    inputs: platforms.map((platform, index) => ({
      id: `qc-in-${platform.id}`,
      name: `${platform.vendor.toUpperCase()}_${index + 1}`,
      type: 'input' as const,
      side: 'left' as const,
      placementMode: 'fixed' as const,
      relativePosition: (index + 1) / (platforms.length + 1),
      dataType: 'mechanical',
    })),
    outputs: [{ id: 'qc-release', name: 'RELEASED', type: 'output', side: 'right', placementMode: 'fixed', relativePosition: 0.5, dataType: 'control' }],
  };

  const nodes: BlockNode[] = [source];
  const edges: EdgeConnection[] = [];
  const subcircuits: Record<string, SubcircuitDefinition> = {};
  const children: NonNullable<LbcScene['children']> = {};

  platforms.forEach((platform, index) => {
    const accent = PLATFORM_COLORS[index % PLATFORM_COLORS.length];
    const y = 60 + index * laneGap;
    const equipmentId = `equipment-${platform.id}`;
    const equipment: BlockNode = {
      id: equipmentId,
      title: platform.name,
      subtitle: `${platform.vendor} | ${platform.throughput}`,
      description: `${platform.principle}\n\nЦикл: ${platform.totalTime}\nПроизводительность: ${platform.throughput}`,
      semanticType: platform.family,
      category: 'processor',
      x: 390,
      y,
      width: 270,
      height: 142,
      shape: 'chip_ic',
      color: accent,
      isSubcircuit: true,
      subcircuitId: `sub-${platform.id}`,
      subcircuitSummary: `${platform.stages.length} технологических этапов`,
      routingClearance: 20,
      preferredFlow: 'left-to-right',
      inputs: [
        { id: `${platform.id}-vial-in`, name: 'VIAL_IN', type: 'input', side: 'left', placementMode: 'fixed', relativePosition: 0.38, dataType: 'mechanical' },
        { id: `${platform.id}-lis-in`, name: 'LIS_ID', type: 'input', side: 'left', placementMode: 'fixed', relativePosition: 0.72, dataType: 'data' },
      ],
      outputs: [
        { id: `${platform.id}-slide-out`, name: platform.staining === 'integrated' ? 'STAINED_SLIDE' : 'PREP_SLIDE', type: 'output', side: 'right', placementMode: 'fixed', relativePosition: 0.4, dataType: 'mechanical' },
        { id: `${platform.id}-status-out`, name: 'STATUS', type: 'output', side: 'bottom', placementMode: 'fixed', relativePosition: 0.72, dataType: 'data' },
      ],
    };
    nodes.push(equipment);
    const subcircuit = createStageSubcircuit(platform, accent);
    subcircuits[equipment.subcircuitId!] = subcircuit;
    children[equipment.id] = {
      id: subcircuit.id,
      title: subcircuit.name,
      level: 'process',
      nodes: subcircuit.nodes,
      edges: subcircuit.edges,
      metadata: { domain: 'lbc', platformIds: [platform.id] },
    };

    edges.push({
        id: `sample-to-${platform.id}`,
        sourceBlockId: source.id,
        sourcePortId: `sample-bus-${platform.id}`,
        targetBlockId: equipment.id,
        targetPortId: `${platform.id}-vial-in`,
        label: 'образец + LIS ID',
        dataType: 'mechanical',
        color: accent,
      });

    if (platform.staining === 'integrated') {
      edges.push({
        id: `result-${platform.id}`,
        sourceBlockId: equipment.id,
        sourcePortId: `${platform.id}-slide-out`,
        targetBlockId: qc.id,
        targetPortId: `qc-in-${platform.id}`,
        label: 'окрашенное стекло',
        dataType: 'mechanical',
        color: accent,
      });
    } else {
      const stainerId = `stainer-${platform.id}`;
      const stainer: BlockNode = {
        id: stainerId,
        title: 'Внешняя Pap-окраска',
        subtitle: platform.name,
        description: 'Отдельный валидированный стейнер и передача rack между контурами.',
        semanticType: 'External Pap stainer',
        category: 'processor',
        x: 770,
        y: y + 4,
        width: 220,
        height: 132,
        shape: 'rounded',
        color: accent,
        inputs: [{ id: `${stainerId}-in`, name: 'PREP_SLIDE', type: 'input', side: 'left', placementMode: 'fixed', relativePosition: 0.5, dataType: 'mechanical' }],
        outputs: [{ id: `${stainerId}-out`, name: 'STAINED_SLIDE', type: 'output', side: 'right', placementMode: 'fixed', relativePosition: 0.5, dataType: 'mechanical' }],
      };
      nodes.push(stainer);
      edges.push(
        {
          id: `to-stainer-${platform.id}`,
          sourceBlockId: equipment.id,
          sourcePortId: `${platform.id}-slide-out`,
          targetBlockId: stainer.id,
          targetPortId: `${stainerId}-in`,
          label: 'готовое к окраске',
          dataType: 'mechanical',
          color: accent,
        },
        {
          id: `result-${platform.id}`,
          sourceBlockId: stainer.id,
          sourcePortId: `${stainerId}-out`,
          targetBlockId: qc.id,
          targetPortId: `qc-in-${platform.id}`,
          label: 'окрашенное стекло',
          dataType: 'mechanical',
          color: accent,
        },
      );
    }
  });

  nodes.push(qc);
  return {
    id: 'lbc-equipment-comparison',
    title: 'Сравнение LBC оборудования',
    level: 'overview',
    nodes,
    edges,
    children,
    metadata: { domain: 'lbc', platformIds: platforms.map((platform) => platform.id) },
    subcircuits,
  };
}

function downloadScene(nodes: BlockNode[], edges: EdgeConnection[], subcircuits: Record<string, SubcircuitDefinition>) {
  const payload = JSON.stringify({ version: 1, kind: 'lbc-equipment-comparison', nodes, edges, subcircuits }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lbc-equipment-comparison-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function LbcWorkflowGraphApp() {
  const [selectedIds, setSelectedIds] = useState(DEFAULT_PLATFORM_IDS);
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [fitViewSignal, setFitViewSignal] = useState(0);
  const selectedPlatforms = useMemo(
    () => selectedIds.map((id) => LBC_PLATFORMS.find((platform) => platform.id === id)).filter((platform): platform is LbcPlatform => Boolean(platform)),
    [selectedIds],
  );
  const initialScene = useMemo(() => createOverviewScene(selectedPlatforms), []);
  const [nodes, setNodes] = useState<BlockNode[]>(() => initialScene.nodes);
  const [edges, setEdges] = useState<EdgeConnection[]>(() => routeOrthogonalAStar(initialScene.nodes, initialScene.edges, ROUTING_OPTIONS));
  const [subcircuits, setSubcircuits] = useState<Record<string, SubcircuitDefinition>>(() => initialScene.subcircuits);
  const [hierarchyPath, setHierarchyPath] = useState<HierarchyBreadcrumb[]>([{ subcircuitId: null, name: 'Сравнение LBC оборудования' }]);
  const [activeSubcircuitId, setActiveSubcircuitId] = useState<string | null>(null);
  const rootSceneRef = useRef<{ nodes: BlockNode[]; edges: EdgeConnection[] } | null>(null);

  const metrics = useMemo(
    () => calculateBenchmarkMetrics(nodes, edges, 0, activeSubcircuitId ? 'Internal process' : 'Comparison lanes', 'Orthogonal A*', ROUTING_OPTIONS),
    [nodes, edges, activeSubcircuitId],
  );

  const applyScene = useCallback((scene: LbcScene) => {
    setNodes(scene.nodes);
    setEdges(routeOrthogonalAStar(scene.nodes, scene.edges, ROUTING_OPTIONS));
    setSubcircuits(scene.subcircuits);
    setHierarchyPath([{ subcircuitId: null, name: 'Сравнение LBC оборудования' }]);
    setActiveSubcircuitId(null);
    rootSceneRef.current = null;
    setFitViewSignal((value) => value + 1);
  }, []);

  const rebuildFromSelection = useCallback((nextIds: string[]) => {
    const platforms = nextIds
      .map((id) => LBC_PLATFORMS.find((platform) => platform.id === id))
      .filter((platform): platform is LbcPlatform => Boolean(platform));
    setSelectedIds(nextIds);
    applyScene(createOverviewScene(platforms));
  }, [applyScene]);

  const handleTogglePlatform = (platformId: string) => {
    if (selectedIds.includes(platformId)) {
      if (selectedIds.length === 1) {
        toast.info('Оставьте хотя бы одну платформу в схеме');
        return;
      }
      rebuildFromSelection(selectedIds.filter((id) => id !== platformId));
      return;
    }
    if (selectedIds.length >= 4) {
      toast.info('На одном полотне можно сравнить до четырёх платформ');
      return;
    }
    rebuildFromSelection([...selectedIds, platformId]);
  };

  const handleNodesChange = useCallback((nextNodes: BlockNode[]) => {
    setNodes(nextNodes);
    setEdges((currentEdges) => routeOrthogonalAStar(nextNodes, currentEdges, ROUTING_OPTIONS));
  }, []);

  const handleEdgesChange = useCallback((nextEdges: EdgeConnection[]) => {
    setEdges(routeOrthogonalAStar(nodes, nextEdges, ROUTING_OPTIONS));
  }, [nodes]);

  const handleAutoLayout = () => {
    const positioned = runSugiyamaLayout(nodes, edges, { layerSpacing: 250, nodeSpacing: 78, startX: 90, startY: 90 }).nodes;
    setNodes(positioned);
    setEdges(routeOrthogonalAStar(positioned, edges, ROUTING_OPTIONS));
    setFitViewSignal((value) => value + 1);
    toast.success('Блоки перекомпонованы, трассы пересчитаны');
  };

  const handleEnterSubcircuit = (subcircuitId: string, nodeTitle?: string) => {
    const subcircuit = subcircuits[subcircuitId];
    if (!subcircuit) return;
    rootSceneRef.current = { nodes, edges };
    setActiveSubcircuitId(subcircuitId);
    setHierarchyPath([
      { subcircuitId: null, name: 'Сравнение LBC оборудования' },
      { subcircuitId, name: nodeTitle || subcircuit.name },
    ]);
    setNodes(subcircuit.nodes);
    setEdges(routeOrthogonalAStar(subcircuit.nodes, subcircuit.edges, ROUTING_OPTIONS));
    setFitViewSignal((value) => value + 1);
  };

  const handleLeaveSubcircuit = () => {
    if (!activeSubcircuitId || !rootSceneRef.current) return;
    setSubcircuits((current) => ({
      ...current,
      [activeSubcircuitId]: { ...current[activeSubcircuitId], nodes, edges },
    }));
    setNodes(rootSceneRef.current.nodes);
    setEdges(routeOrthogonalAStar(rootSceneRef.current.nodes, rootSceneRef.current.edges, ROUTING_OPTIONS));
    rootSceneRef.current = null;
    setActiveSubcircuitId(null);
    setHierarchyPath([{ subcircuitId: null, name: 'Сравнение LBC оборудования' }]);
    setFitViewSignal((value) => value + 1);
  };

  const handleDuplicateNode = (node: BlockNode) => {
    const suffix = Date.now().toString(36);
    const duplicated: BlockNode = {
      ...node,
      id: `${safeId(node.id)}-copy-${suffix}`,
      title: `${node.title} (копия)`,
      x: node.x + 36,
      y: node.y + 36,
      isSubcircuit: false,
      subcircuitId: undefined,
      inputs: node.inputs.map((port) => ({ ...port, id: `${port.id}-copy-${suffix}` })),
      outputs: node.outputs.map((port) => ({ ...port, id: `${port.id}-copy-${suffix}` })),
    };
    handleNodesChange([...nodes, duplicated]);
  };

  const filteredPlatforms = LBC_PLATFORMS.filter((platform) =>
    `${platform.vendor} ${platform.name} ${platform.principle}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <LabTraceWorkbench
      className="lbc-graph-app"
      brand={(
        <>
        <button
          type="button"
          onClick={() => window.location.assign(window.location.pathname)}
          className="interactive-btn h-9 w-9 grid place-items-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          title="Вернуться в AutoTrace"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[#d9468d]" />
            <h1 className="truncate text-sm sm:text-base font-semibold tracking-tight">LabTrace | LBC Equipment</h1>
          </div>
          <p className="hidden sm:block text-[11px] text-[var(--text-tertiary)]">Интерактивная схема сравнения оборудования и технологических связей</p>
        </div>
        </>
      )}
      headerActions={(
        <>
          <button type="button" onClick={() => setIsCreateOpen(true)} className="interactive-btn hidden sm:flex h-9 items-center gap-2 rounded-lg bg-[#d9468d] px-3 text-xs font-semibold text-white hover:bg-[#e25c9c]">
            <Plus className="h-4 w-4" /> Новый блок
          </button>
          <button type="button" onClick={() => downloadScene(nodes, edges, subcircuits)} className="interactive-btn h-9 flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <Download className="h-4 w-4" /> <span className="hidden md:inline">Экспорт JSON</span>
          </button>
        </>
      )}
      sidebar={(
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Оборудование</h2>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--text-tertiary)]">Выберите до четырёх платформ. Двойной клик по прибору открывает его внутреннюю схему.</p>
                </div>
                <span className="font-mono text-[11px] text-[#d9468d]">{selectedIds.length}/4</span>
              </div>
              <label className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 focus-within:border-[#d9468d]">
                <Search className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти платформу" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--text-muted)]" />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredPlatforms.map((platform) => {
                const checked = selectedIds.includes(platform.id);
                return (
                  <label key={platform.id} className={`group flex cursor-pointer gap-3 rounded-lg px-3 py-3 transition-colors ${checked ? 'bg-[#d9468d]/10' : 'hover:bg-white/[0.035]'}`}>
                    <input type="checkbox" checked={checked} onChange={() => handleTogglePlatform(platform.id)} className="mt-0.5 h-4 w-4 accent-[#d9468d]" />
                    <span className="min-w-0">
                      <span className={`block truncate text-xs font-semibold ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{platform.name}</span>
                      <span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">{platform.vendor} | {platform.staining === 'integrated' ? 'окраска встроена' : 'внешняя окраска'}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="border-t border-[var(--border-subtle)] p-3 space-y-2">
              <button type="button" onClick={handleAutoLayout} className="interactive-btn flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]">
                <Sparkles className="h-4 w-4 text-[#d9468d]" /> Автокомпоновка
              </button>
              <button type="button" onClick={() => rebuildFromSelection(selectedIds)} className="interactive-btn flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <RotateCcw className="h-3.5 w-3.5" /> Сбросить расположение
              </button>
            </div>
          </div>
      )}
      toolbar={(
        <>
            <Boxes className="h-3.5 w-3.5 text-[#d9468d]" />
            <span>{nodes.length} блоков</span>
            <span className="text-[var(--border-strong)]">/</span>
            <span>{edges.length} связей</span>
            <span className="ml-auto hidden sm:inline">Потяните от порта к порту, чтобы создать связь</span>
            <ChevronDown className="hidden sm:block h-3.5 w-3.5 -rotate-90" />
        </>
      )}
      overlays={(
        <>
          <CreateBlockModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            existingNodes={nodes}
            initialTemplate={{ title: 'Новый этап', semanticType: 'LBC process block', color: '#d9468d', shape: 'rounded' }}
            onCreateBlock={(block) => handleNodesChange([...nodes, block])}
          />
          <AppearanceModal />
          <ToastContainer />
        </>
      )}
    >
            <DiagramCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onAddNode={() => setIsCreateOpen(true)}
              onDuplicateNode={handleDuplicateNode}
              onOpenCreateModal={() => setIsCreateOpen(true)}
              options={ROUTING_OPTIONS}
              metrics={metrics}
              activeLayoutName={activeSubcircuitId ? 'Внутренняя схема' : 'Сравнительные линии'}
              activeRoutingName="Orthogonal A*"
              fitViewSignal={fitViewSignal}
              subcircuits={subcircuits}
              hierarchyPath={hierarchyPath}
              onEnterSubcircuit={handleEnterSubcircuit}
              onNavigateHierarchy={(index) => { if (index === 0) handleLeaveSubcircuit(); }}
              onLeaveSubcircuit={handleLeaveSubcircuit}
              activeSubcircuit={activeSubcircuitId ? subcircuits[activeSubcircuitId] : null}
            />
    </LabTraceWorkbench>
  );
}
