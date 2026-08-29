import React, { useState } from 'react';
import {
  LayoutAlgorithmType,
  RoutingAlgorithmType,
  RoutingOptions,
  BlockNode,
  EdgeConnection,
  OptimizationWeights,
  WeightPresetId,
} from '../types';
import { PRESET_TOPOLOGIES, PresetTopology } from '../data/presets';
import { WEIGHT_PRESETS, DEFAULT_OPTIMIZATION_WEIGHTS } from '../data/weightPresets';
import {
  Play,
  Sliders,
  Layers,
  Route,
  Cpu,
  Plus,
  Compass,
  Scale,
  ShieldCheck,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Palette,
  Check,
  Bot,
  Wand2,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  tuneRoutingParametersWithAI,
  AITunedParametersResult,
} from '../algorithms/aiParameterTuner';
import { toast } from '../utils/toastService';

interface ControlPanelProps {
  selectedPresetId: string;
  onSelectPreset: (preset: PresetTopology) => void;
  layoutAlgorithm: LayoutAlgorithmType;
  onLayoutChange: (layout: LayoutAlgorithmType) => void;
  routingAlgorithm: RoutingAlgorithmType;
  onRoutingChange: (routing: RoutingAlgorithmType) => void;
  options: RoutingOptions;
  onOptionsChange: (options: RoutingOptions) => void;
  onRunLayout: () => void;
  onRunCoOptimization?: () => void;
  onOpenNlpModal?: () => void;
  onOpenCreateBlockModal?: () => void;
  onAddBlock: (category: BlockNode['category']) => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
  nodes?: BlockNode[];
  edges?: EdgeConnection[];
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedPresetId,
  onSelectPreset,
  layoutAlgorithm,
  onLayoutChange,
  routingAlgorithm,
  onRoutingChange,
  options,
  onOptionsChange,
  onRunLayout,
  onRunCoOptimization,
  onOpenNlpModal,
  onOpenCreateBlockModal,
  onAddBlock,
  isOpenOnMobile = false,
  onCloseMobile,
  nodes = [],
  edges = [],
}) => {
  const { accent } = useTheme();
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AITunedParametersResult | null>(null);
  const [isAiExpanded, setIsAiExpanded] = useState(true);

  const handleRunAITuning = async (promptOverride?: string) => {
    const promptToUse = promptOverride !== undefined ? promptOverride : aiPrompt;
    setIsAiLoading(true);
    try {
      const res = await tuneRoutingParametersWithAI(nodes, edges, promptToUse);
      setAiResult(res);
      onOptionsChange({
        ...options,
        ...res.options,
        weights: res.weights || options.weights,
      });
      toast.success(`✨ ${res.profileName}`, res.reasoning, 4000);
    } catch (err: any) {
      toast.error('Ошибка подбора параметров', err?.message || 'Не удалось выполнить подбор');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenOnMobile && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      <aside
        id="control-panel-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] bg-[var(--surface-primary)] border-r border-[var(--border-subtle)] flex flex-col h-full lg:h-[calc(100dvh-5.5rem)] overflow-y-auto transition-transform duration-300 ease-out shadow-2xl lg:shadow-none lg:static lg:w-84 lg:flex-shrink-0 lg:translate-x-0 ${
          isOpenOnMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex lg:hidden items-center justify-between p-3.5 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)] sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-bold text-[var(--text-primary)] uppercase font-mono tracking-wider">
              Панель Параметров
            </span>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Закрыть панель"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 space-y-4">
          {/* 1. Presets / Scenarios Bento Card */}
          <div className="bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-1.5 font-mono">
                <Cpu className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Топологии и Сценарии</span>
              </span>
              <span className="text-[9px] font-mono text-[var(--text-tertiary)] uppercase">Preset</span>
            </div>

            <div className="space-y-1.5">
              {PRESET_TOPOLOGIES.map(preset => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    id={`preset-btn-${preset.id}`}
                    onClick={() => onSelectPreset(preset)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--accent)]/30'
                        : 'bg-[var(--surface-sunken)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-[var(--accent)] shadow-sm' : 'bg-[var(--text-tertiary)]'
                          }`}
                        />
                        <span className="text-xs font-semibold">{preset.name}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                        {preset.nodes.length} узлов
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 line-clamp-1 leading-relaxed pl-3.5">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Block Placement Algorithm Bento Card */}
          <div className="bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-1.5 font-mono">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Фаза 1: Размещение Блоков</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Sugiyama
              </span>
            </div>

            <div className="space-y-1.5">
              <button
                id="layout-algo-sugiyama"
                onClick={() => onLayoutChange('sugiyama')}
                className="w-full text-left p-2.5 rounded-lg border transition-all bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-xs font-semibold">Sugiyama Framework</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]">
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] leading-tight pl-3">
                  Послойное ранжирование (DAG Layering) + барицентрическая сортировка + соосность пинов.
                </p>
              </button>
            </div>
          </div>

          {/* 3. Edge Routing Algorithm Bento Card */}
          <div className="bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-1.5 font-mono">
                <Route className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Фаза 2: Трассировка Связей</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                A* Engine
              </span>
            </div>

            <div className="space-y-1.5">
              <button
                id="routing-algo-orthogonal_astar"
                onClick={() => onRoutingChange('orthogonal_astar')}
                className="w-full text-left p-2.5 rounded-lg border transition-all bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                    <span className="text-xs font-semibold">Orthogonal A* Router</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]">
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] leading-tight pl-3">
                  Ортогональный A* с 4-сторонними нормалями выходов портов, эшелонированием каналов и G¹ скруглениями.
                </p>
              </button>
            </div>
          </div>

          {/* 4. Fine-Tuning Routing Options Bento Card */}
          <div className="bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-1.5 font-mono">
                <Sliders className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span>Параметры Оптимизации</span>
              </span>
              <span className="text-[9px] font-mono text-[var(--text-tertiary)]">Config</span>
            </div>

            {/* AI Auto-Tuner Smart Assistant Box */}
            <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-2.5 space-y-2 relative overflow-hidden transition-all shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-purple-300 font-mono">
                    AI Auto-Tune (LLM)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAiExpanded(!isAiExpanded)}
                  className="p-1 rounded text-purple-400 hover:text-purple-200 transition-colors"
                  title="Свернуть/Развернуть AI подбор"
                >
                  {isAiExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {isAiExpanded && (
                <div className="space-y-2 pt-1 animate-fade-in">
                  {/* Quick Intent Pills */}
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleRunAITuning('eda compact pcb плотная плата')}
                      disabled={isAiLoading}
                      className="px-1.5 py-1 rounded bg-purple-900/30 border border-purple-500/20 text-purple-200 hover:bg-purple-800/40 hover:border-purple-400/40 transition-all text-left flex items-center gap-1 truncate disabled:opacity-50"
                    >
                      <span>⚡</span> <span className="truncate">Плата EDA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunAITuning('presentation ux clean просторно красиво')}
                      disabled={isAiLoading}
                      className="px-1.5 py-1 rounded bg-purple-900/30 border border-purple-500/20 text-purple-200 hover:bg-purple-800/40 hover:border-purple-400/40 transition-all text-left flex items-center gap-1 truncate disabled:opacity-50"
                    >
                      <span>🎨</span> <span className="truncate">Презентация</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunAITuning('bus dense mcu pins шина выводов')}
                      disabled={isAiLoading}
                      className="px-1.5 py-1 rounded bg-purple-900/30 border border-purple-500/20 text-purple-200 hover:bg-purple-800/40 hover:border-purple-400/40 transition-all text-left flex items-center gap-1 truncate disabled:opacity-50"
                    >
                      <span>🔌</span> <span className="truncate">Шина MCU</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunAITuning('zero straight laser bends минимум поворотов')}
                      disabled={isAiLoading}
                      className="px-1.5 py-1 rounded bg-purple-900/30 border border-purple-500/20 text-purple-200 hover:bg-purple-800/40 hover:border-purple-400/40 transition-all text-left flex items-center gap-1 truncate disabled:opacity-50"
                    >
                      <span>📏</span> <span className="truncate">0-Изгибов</span>
                    </button>
                  </div>

                  {/* Custom Prompt Input & Trigger */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !isAiLoading) {
                          handleRunAITuning();
                        }
                      }}
                      placeholder="Промпт: напр. компактно для ГОСТ..."
                      className="flex-1 px-2 py-1 text-[11px] rounded bg-[var(--surface-sunken)] border border-purple-500/30 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-purple-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleRunAITuning()}
                      disabled={isAiLoading}
                      className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                      title="Запустить автоподбор параметров"
                    >
                      {isAiLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                      <span>AI</span>
                    </button>
                  </div>

                  {/* AI Explanation / Reasoning Output */}
                  {aiResult && (
                    <div className="p-2 rounded bg-purple-950/40 border border-purple-500/20 text-[10px] space-y-1">
                      <div className="flex items-center justify-between text-purple-300 font-semibold font-mono">
                        <span className="truncate">✨ {aiResult.profileName}</span>
                        <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          {aiResult.source === 'gemini_llm' ? 'Gemini 2.5' : 'Heuristics'}
                        </span>
                      </div>
                      <p className="text-[10px] text-purple-200/80 leading-snug">
                        {aiResult.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clearance */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-[var(--text-secondary)] mb-1">
                <span>Зазор от блоков (Clearance):</span>
                <span className="text-[var(--accent)] font-bold">{options.obstacleClearance} px</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="5"
                value={options.obstacleClearance}
                onChange={e => onOptionsChange({ ...options, obstacleClearance: Number(e.target.value) })}
                className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
              />
            </div>

            {/* Min Wire Distance / Channel Spacing */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-[var(--text-secondary)] mb-1">
                <span className="text-cyan-400">Расстояние между связями:</span>
                <span className="text-cyan-400 font-bold">{options.minWireDistance || options.channelSpacing || 16} px</span>
              </div>
              <input
                type="range"
                min="8"
                max="40"
                step="2"
                value={options.minWireDistance || options.channelSpacing || 16}
                onChange={e => {
                  const val = Number(e.target.value);
                  onOptionsChange({ ...options, minWireDistance: val, channelSpacing: val });
                }}
                className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Label Clearance */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-[var(--text-secondary)] mb-1">
                <span className="text-amber-400">Отступ подписей:</span>
                <span className="text-amber-400 font-bold">{options.labelClearance ?? 14} px</span>
              </div>
              <input
                type="range"
                min="8"
                max="32"
                step="2"
                value={options.labelClearance ?? 14}
                onChange={e => onOptionsChange({ ...options, labelClearance: Number(e.target.value) })}
                className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Corner Radius */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-[var(--text-secondary)] mb-1">
                <span className="text-purple-400">Радиус скругления углов:</span>
                <span className="text-purple-400 font-bold">{(options.cornerRadius ?? 12) === 0 ? '0 px (Острый 90°)' : `${options.cornerRadius ?? 12} px`}</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="2"
                value={options.cornerRadius ?? 12}
                onChange={e => {
                  const r = Number(e.target.value);
                  onOptionsChange({ ...options, cornerRadius: r, smoothCorners: r > 0 });
                }}
                className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Adaptive Corner Radius toggle */}
            <label className="flex items-center justify-between text-[11px] text-[var(--text-primary)] pt-0.5 cursor-pointer">
              <span className="font-mono text-xs text-purple-400 font-semibold">Вариативное скругление</span>
              <input
                type="checkbox"
                checked={options.adaptiveCornerRadius !== false}
                onChange={e => onOptionsChange({ ...options, adaptiveCornerRadius: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-default)] bg-[var(--surface-sunken)] text-purple-500 focus:ring-purple-400"
              />
            </label>

            {/* Bend Penalty */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-[var(--text-secondary)] mb-1">
                <span>Штраф изгиба (Bend Penalty):</span>
                <span className="text-[var(--accent)] font-bold">{options.bendPenalty}</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={options.bendPenalty}
                onChange={e => onOptionsChange({ ...options, bendPenalty: Number(e.target.value) })}
                className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
              />
            </div>

            {/* Port Exit Stub */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-[var(--text-secondary)] mb-1">
                <span className="text-emerald-400">Базовый вылет из порта (Stub):</span>
                <span className="text-emerald-400 font-bold">{options.portExitOffset} px</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                step="5"
                value={options.portExitOffset}
                onChange={e => onOptionsChange({ ...options, portExitOffset: Number(e.target.value) })}
                className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Pin-to-Pin Alignment toggle */}
            <label className="flex items-center justify-between text-[11px] text-[var(--text-primary)] pt-1 cursor-pointer">
              <span className="font-mono text-xs text-cyan-400 font-semibold">Соосность пинов (0-Bend)</span>
              <input
                type="checkbox"
                checked={options.pinAlignment !== false}
                onChange={e => onOptionsChange({ ...options, pinAlignment: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-default)] bg-[var(--surface-sunken)] text-cyan-500 focus:ring-cyan-400"
              />
            </label>

            {/* Artifact Cleaning toggle */}
            <label className="flex items-center justify-between text-[11px] text-[var(--text-primary)] pt-1 cursor-pointer">
              <span className="font-mono text-xs text-indigo-400">Фильтр паразитных изгибов</span>
              <input
                type="checkbox"
                checked={options.artifactCleaning !== false}
                onChange={e => onOptionsChange({ ...options, artifactCleaning: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-default)] bg-[var(--surface-sunken)] text-indigo-500 focus:ring-indigo-400"
              />
            </label>

            {/* Jump Bridges (IEEE Line Hops) toggle */}
            <label className="flex items-center justify-between text-[11px] text-[var(--text-primary)] pt-1 cursor-pointer">
              <span className="font-mono text-xs">Мостики пересечений (IEEE 315)</span>
              <input
                type="checkbox"
                checked={options.jumpBridges}
                onChange={e => onOptionsChange({ ...options, jumpBridges: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-default)] bg-[var(--surface-sunken)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
            </label>
          </div>

          {/* 5. Optimization Criteria Weights (Pareto Multi-Objective) Bento Card */}
          <div className="bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 font-mono">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span>Веса Критериев Оптимальности</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Pareto
              </span>
            </div>

            {/* Presets dropdown / pill buttons */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-tertiary)]">Пресет весов функции цели:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {WEIGHT_PRESETS.map(preset => {
                  const currentWeights = options.weights || DEFAULT_OPTIMIZATION_WEIGHTS;
                  const isMatch =
                    currentWeights.crossingWeight === preset.weights.crossingWeight &&
                    currentWeights.straightnessWeight === preset.weights.straightnessWeight &&
                    currentWeights.g1SplineWeight === preset.weights.g1SplineWeight;
                  return (
                    <button
                      key={preset.id}
                      id={`weight-preset-${preset.id}`}
                      onClick={() => {
                        onOptionsChange({
                          ...options,
                          weights: { ...preset.weights },
                        });
                      }}
                      className={`px-2 py-1.5 rounded-lg text-left text-[10px] border transition-all truncate ${
                        isMatch
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold ring-1 ring-emerald-500/30'
                          : 'bg-[var(--surface-sunken)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-primary)]'
                      }`}
                      title={preset.description}
                    >
                      {preset.id === 'zero_crossings_straight'
                        ? '⭐ Zero Cross + Laser'
                        : preset.id === 'organic_g1'
                        ? '〰️ Organic G1'
                        : preset.id === 'compact_eda'
                        ? '📏 Compact EDA'
                        : '⚖️ Balanced'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* 1. Crossing Weight (Priority #1) */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-[var(--text-primary)] mb-0.5">
                  <span className="flex items-center gap-1 font-semibold text-rose-400">
                    <ShieldCheck className="w-3 h-3 text-rose-400" />
                    <span>Минимизация пересечений:</span>
                  </span>
                  <span className="text-rose-400 font-bold font-mono">
                    {options.weights?.crossingWeight ?? 95}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={options.weights?.crossingWeight ?? 95}
                  onChange={e =>
                    onOptionsChange({
                      ...options,
                      weights: {
                        ...(options.weights || DEFAULT_OPTIMIZATION_WEIGHTS),
                        crossingWeight: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              {/* 2. Straightness Weight (Priority #2) */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-[var(--text-primary)] mb-0.5">
                  <span className="flex items-center gap-1 font-semibold text-cyan-400">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    <span>Прямолинейность (Laser):</span>
                  </span>
                  <span className="text-cyan-400 font-bold font-mono">
                    {options.weights?.straightnessWeight ?? 90}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={options.weights?.straightnessWeight ?? 90}
                  onChange={e =>
                    onOptionsChange({
                      ...options,
                      weights: {
                        ...(options.weights || DEFAULT_OPTIMIZATION_WEIGHTS),
                        straightnessWeight: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* 6. Primary Action Buttons */}
          <div className="space-y-2 pt-1">
            {onOpenNlpModal && (
              <button
                id="btn-open-nlp-modal"
                onClick={onOpenNlpModal}
                className="w-full flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all active:scale-[0.98] group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-wider">Нелинейная Оптимизация (NLP)</span>
                </div>
                <span className="text-[10px] text-blue-100/90 font-normal mt-0.5">
                  D_opt блоков • S_opt стрелок • Заморозка узлов
                </span>
              </button>
            )}

            {onRunCoOptimization && (
              <button
                id="btn-run-co-optimization"
                onClick={onRunCoOptimization}
                className="w-full flex flex-col items-center justify-center p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:via-blue-500 hover:to-indigo-500 text-white shadow-md border border-cyan-400/30 transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-200 group-hover:rotate-45 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-wider">Сквозная Оптимизация</span>
                </div>
                <span className="text-[10px] text-cyan-100/80 font-normal mt-0.5">
                  Совместный расчет блоков + трасс без изгибов
                </span>
              </button>
            )}

            <button
              id="btn-run-relayout"
              onClick={onRunLayout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] text-xs font-semibold uppercase tracking-wider border border-[var(--border-default)] transition-all active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-[var(--text-primary)]" />
              <span>Пересчитать Схему (Раздельно)</span>
            </button>

            {/* Add custom node dropdown / buttons */}
            <div className="bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)] p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-mono tracking-widest block">
                  Блоки и компоненты
                </span>
                {onOpenCreateBlockModal && (
                  <button
                    id="btn-open-create-modal"
                    onClick={onOpenCreateBlockModal}
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Конструктор</span>
                  </button>
                )}
              </div>

              {onOpenCreateBlockModal && (
                <button
                  id="btn-create-flexible-block"
                  onClick={onOpenCreateBlockModal}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ Создать Блок (Схема / Фото)</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  id="btn-add-logic"
                  onClick={() => onAddBlock('logic')}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-sunken)] hover:bg-[var(--surface-primary)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center gap-1 font-mono"
                >
                  <Plus className="w-3 h-3 text-purple-400" />
                  <span>Logic (Gate)</span>
                </button>
                <button
                  id="btn-add-proc"
                  onClick={() => onAddBlock('processor')}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-sunken)] hover:bg-[var(--surface-primary)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center gap-1 font-mono"
                >
                  <Plus className="w-3 h-3 text-emerald-400" />
                  <span>Proc (Task)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
