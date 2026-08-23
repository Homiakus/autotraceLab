import React, { useState } from 'react';
import {
  LayoutAlgorithmType,
  RoutingAlgorithmType,
  RoutingOptions,
  BlockNode,
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
  BarChart2,
  Plus,
  Compass,
  Scale,
  ShieldCheck,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

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
  onOpenBenchmark: () => void;
  onOpenStepper: () => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
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
  onOpenBenchmark,
  onOpenStepper,
  isOpenOnMobile = false,
  onCloseMobile,
}) => {
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
        className={`fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] bg-[#16181d] border-r border-white/10 flex flex-col h-full lg:h-[calc(100dvh-3.75rem)] overflow-y-auto transition-transform duration-300 ease-out shadow-2xl lg:shadow-none lg:static lg:w-84 lg:flex-shrink-0 lg:translate-x-0 ${
          isOpenOnMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex lg:hidden items-center justify-between p-3.5 border-b border-white/10 bg-[#0c0d10] sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Панель Параметров
            </span>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            title="Закрыть панель"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 space-y-4">
        {/* 1. Presets / Scenarios Bento Card */}
        <div className="bg-[#0c0d10]/80 rounded-xl border border-white/5 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 font-mono">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>Топологии и Сценарии</span>
            </span>
            <span className="text-[9px] font-mono text-gray-500 uppercase">Preset</span>
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
                      ? 'bg-blue-600/15 border-blue-500/40 text-white shadow-sm ring-1 ring-blue-500/20'
                      : 'bg-[#16181d]/70 border-white/5 text-gray-300 hover:bg-[#1f2229] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-blue-400 shadow-sm shadow-blue-400' : 'bg-gray-600'
                        }`}
                      />
                      <span className="text-xs font-semibold">{preset.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {preset.nodes.length} узлов
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 line-clamp-1 leading-relaxed pl-3.5">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Block Placement Algorithm Bento Card */}
        <div className="bg-[#0c0d10]/80 rounded-xl border border-white/5 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 font-mono">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Фаза 1: Размещение Блоков</span>
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Placement
            </span>
          </div>

          <div className="space-y-1.5">
            {[
              {
                id: 'sugiyama' as LayoutAlgorithmType,
                name: 'Sugiyama Framework',
                badge: 'Recommended',
                desc: 'Послойное ранжирование + барицентрическая сортировка.',
              },
              {
                id: 'orthogonal_grid' as LayoutAlgorithmType,
                name: 'Orthogonal Grid / TSM',
                badge: 'Matrix',
                desc: 'Дискретная сетка слотов с сохранением ортогональных осей.',
              },
              {
                id: 'force_directed' as LayoutAlgorithmType,
                name: 'Force-Directed Flow',
                badge: 'Physics',
                desc: 'Физическая симуляция пружин с гравитацией портов.',
              },
            ].map(algo => {
              const isSelected = layoutAlgorithm === algo.id;
              return (
                <button
                  key={algo.id}
                  id={`layout-algo-${algo.id}`}
                  onClick={() => onLayoutChange(algo.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/50 text-white ring-1 ring-blue-500/20'
                      : 'bg-[#16181d]/70 border-white/5 text-gray-300 hover:bg-[#1f2229] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                      <span className="text-xs font-semibold">{algo.name}</span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        algo.badge === 'Recommended'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : 'bg-white/5 text-gray-400'
                      }`}
                    >
                      {algo.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight pl-3">{algo.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Edge Routing Algorithm Bento Card */}
        <div className="bg-[#0c0d10]/80 rounded-xl border border-white/5 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 font-mono">
              <Route className="w-3.5 h-3.5 text-blue-400" />
              <span>Фаза 2: Трассировка Связей</span>
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Routing
            </span>
          </div>

          <div className="space-y-1.5">
            {[
              {
                id: 'orthogonal_astar' as RoutingAlgorithmType,
                name: 'Orthogonal A* Router',
                badge: 'Recommended',
                desc: 'A* с нормалями выходов портов и штрафами за повороты.',
              },
              {
                id: 'lee_wave' as RoutingAlgorithmType,
                name: 'Lee Maze Wave',
                badge: 'Exact BFS',
                desc: 'Волновой фронт распространения потенциала по сетке.',
              },
              {
                id: 'manhattan_channel' as RoutingAlgorithmType,
                name: 'Manhattan Channel',
                badge: 'O(1) Fast',
                desc: 'Z/L/C коридоры между свободными интервалами.',
              },
              {
                id: 'smooth_spline' as RoutingAlgorithmType,
                name: 'Smooth Splines (Bézier)',
                badge: 'Curves',
                desc: 'Плавные кубические сплайны с нормальными касательными.',
              },
            ].map(algo => {
              const isSelected = routingAlgorithm === algo.id;
              return (
                <button
                  key={algo.id}
                  id={`routing-algo-${algo.id}`}
                  onClick={() => onRoutingChange(algo.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/50 text-white ring-1 ring-blue-500/20'
                      : 'bg-[#16181d]/70 border-white/5 text-gray-300 hover:bg-[#1f2229] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-400' : 'bg-gray-600'}`} />
                      <span className="text-xs font-semibold">{algo.name}</span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        algo.badge === 'Recommended'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : 'bg-white/5 text-gray-400'
                      }`}
                    >
                      {algo.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight pl-3">{algo.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Fine-Tuning Routing Options Bento Card */}
        <div className="bg-[#0c0d10]/80 rounded-xl border border-white/5 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 font-mono">
              <Sliders className="w-3.5 h-3.5 text-gray-400" />
              <span>Параметры Оптимизации</span>
            </span>
            <span className="text-[9px] font-mono text-gray-500">Config</span>
          </div>

          {/* Clearance */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-1">
              <span>Зазор от блоков (Clearance):</span>
              <span className="text-blue-400 font-bold">{options.obstacleClearance} px</span>
            </div>
            <input
              type="range"
              min="5"
              max="35"
              step="5"
              value={options.obstacleClearance}
              onChange={e => onOptionsChange({ ...options, obstacleClearance: Number(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Min Wire Distance / Channel Spacing */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-1">
              <span className="text-cyan-300">Расстояние между стрелками:</span>
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
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Label Clearance */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-1">
              <span className="text-amber-300">Отступ подписей (Label Clearance):</span>
              <span className="text-amber-400 font-bold">{options.labelClearance ?? 14} px</span>
            </div>
            <input
              type="range"
              min="8"
              max="32"
              step="2"
              value={options.labelClearance ?? 14}
              onChange={e => onOptionsChange({ ...options, labelClearance: Number(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Corner Radius */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-1">
              <span className="text-purple-300">Радиус скругления углов:</span>
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
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Adaptive Corner Radius toggle */}
          <label className="flex items-center justify-between text-[11px] text-gray-300 pt-0.5 cursor-pointer">
            <span className="font-mono text-xs text-purple-300 font-semibold">Вариативное скругление (Adaptive)</span>
            <input
              type="checkbox"
              checked={options.adaptiveCornerRadius !== false}
              onChange={e => onOptionsChange({ ...options, adaptiveCornerRadius: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-[#16181d] text-purple-500 focus:ring-purple-400"
            />
          </label>

          {/* Bend Penalty */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-1">
              <span>Штраф изгиба (Bend Penalty):</span>
              <span className="text-blue-400 font-bold">{options.bendPenalty}</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              step="5"
              value={options.bendPenalty}
              onChange={e => onOptionsChange({ ...options, bendPenalty: Number(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Port Exit Stub */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-1">
              <span className="text-emerald-300">Базовый вылет из порта (Stub):</span>
              <span className="text-emerald-400 font-bold">{options.portExitOffset} px</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              step="5"
              value={options.portExitOffset}
              onChange={e => onOptionsChange({ ...options, portExitOffset: Number(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Adaptive Port Exit Stub toggle */}
          <label className="flex items-center justify-between text-[11px] text-gray-300 pt-0.5 cursor-pointer">
            <div>
              <span className="font-mono text-xs text-emerald-300 font-semibold block">Адаптивный вылет (Adaptive Stubs)</span>
              <span className="text-[10px] text-gray-400">Автоподбор длины по расстоянию и препятствиям</span>
            </div>
            <input
              type="checkbox"
              checked={options.adaptivePortExitOffset !== false}
              onChange={e => onOptionsChange({ ...options, adaptivePortExitOffset: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-[#16181d] text-emerald-500 focus:ring-emerald-400"
            />
          </label>

          {/* Pin-to-Pin Alignment toggle */}
          <label className="flex items-center justify-between text-[11px] text-gray-300 pt-1 cursor-pointer">
            <span className="font-mono text-xs text-cyan-400 font-semibold">Соосность пинов (0-Bend)</span>
            <input
              type="checkbox"
              checked={options.pinAlignment !== false}
              onChange={e => onOptionsChange({ ...options, pinAlignment: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-[#16181d] text-cyan-500 focus:ring-cyan-400"
            />
          </label>

          {/* Artifact Cleaning toggle */}
          <label className="flex items-center justify-between text-[11px] text-gray-300 pt-1 cursor-pointer">
            <span className="font-mono text-xs text-indigo-300">Фильтр паразитных изгибов</span>
            <input
              type="checkbox"
              checked={options.artifactCleaning !== false}
              onChange={e => onOptionsChange({ ...options, artifactCleaning: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-[#16181d] text-indigo-500 focus:ring-indigo-400"
            />
          </label>

          {/* Jump Bridges (IEEE Line Hops) toggle */}
          <label className="flex items-center justify-between text-[11px] text-gray-300 pt-1 cursor-pointer">
            <span className="font-mono text-xs">Мостики пересечений (IEEE 315)</span>
            <input
              type="checkbox"
              checked={options.jumpBridges}
              onChange={e => onOptionsChange({ ...options, jumpBridges: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-[#16181d] text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>

        {/* 5. Optimization Criteria Weights (Pareto Multi-Objective) Bento Card */}
        <div className="bg-[#0c0d10]/80 rounded-xl border border-white/5 p-3.5 space-y-3">
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
            <span className="text-[10px] font-mono text-gray-400">Пресет весов функции цели:</span>
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
                        : 'bg-[#16181d] border-white/5 text-gray-400 hover:text-gray-200 hover:bg-[#1f2229]'
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
              <div className="flex justify-between text-[11px] font-mono text-gray-300 mb-0.5">
                <span className="flex items-center gap-1 font-semibold text-rose-400">
                  <ShieldCheck className="w-3 h-3 text-rose-400" />
                  <span>Минимизация пересечений:</span>
                </span>
                <span className="text-rose-400 font-bold font-mono">
                  {options.weights?.crossingWeight ?? 95}%
                </span>
              </div>
              <p className="text-[9px] text-gray-500 mb-1">Приоритет №1: пересечения связей, наложения на блоки</p>
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
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            {/* 2. Straightness Weight (Priority #2) */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-gray-300 mb-0.5">
                <span className="flex items-center gap-1 font-semibold text-cyan-400">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  <span>Прямолинейность (Laser):</span>
                </span>
                <span className="text-cyan-400 font-bold font-mono">
                  {options.weights?.straightnessWeight ?? 90}%
                </span>
              </div>
              <p className="text-[9px] text-gray-500 mb-1">Основная длина линий строго прямая без паразитных ступенек</p>
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
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* 3. G1 Spline Weight */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-gray-300 mb-0.5">
                <span className="flex items-center gap-1 font-semibold text-indigo-400">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>G¹ Сплайн-гладкость:</span>
                </span>
                <span className="text-indigo-400 font-bold font-mono">
                  {options.weights?.g1SplineWeight ?? 65}%
                </span>
              </div>
              <p className="text-[9px] text-gray-500 mb-1">Плавные касательные переходы Безье в концах и поворотах</p>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={options.weights?.g1SplineWeight ?? 65}
                onChange={e =>
                  onOptionsChange({
                    ...options,
                    weights: {
                      ...(options.weights || DEFAULT_OPTIMIZATION_WEIGHTS),
                      g1SplineWeight: Number(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* 4. Port Alignment */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-0.5">
                <span>Соосность портов (Pin Align):</span>
                <span className="text-blue-400 font-bold font-mono">
                  {options.weights?.portAlignmentWeight ?? 80}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={options.weights?.portAlignmentWeight ?? 80}
                onChange={e =>
                  onOptionsChange({
                    ...options,
                    weights: {
                      ...(options.weights || DEFAULT_OPTIMIZATION_WEIGHTS),
                      portAlignmentWeight: Number(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* 5. Clearance Weight */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-0.5">
                <span>Отступ от блоков (Clearance):</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {options.weights?.clearanceWeight ?? 90}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={options.weights?.clearanceWeight ?? 90}
                onChange={e =>
                  onOptionsChange({
                    ...options,
                    weights: {
                      ...(options.weights || DEFAULT_OPTIMIZATION_WEIGHTS),
                      clearanceWeight: Number(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* 6. Wirelength Weight (Secondary) */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-0.5">
                <span>Минимизация длины (HPWL):</span>
                <span className="text-amber-400 font-bold font-mono">
                  {options.weights?.wirelengthWeight ?? 15}%
                </span>
              </div>
              <p className="text-[9px] text-gray-500 mb-1">Вторично: не ухудшает распутывание перекрестков</p>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={options.weights?.wirelengthWeight ?? 15}
                onChange={e =>
                  onOptionsChange({
                    ...options,
                    weights: {
                      ...(options.weights || DEFAULT_OPTIMIZATION_WEIGHTS),
                      wirelengthWeight: Number(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* 7. Bend Penalty Weight (Secondary) */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-0.5">
                <span>Штраф изгибов (Bends):</span>
                <span className="text-purple-400 font-bold font-mono">
                  {options.weights?.bendWeight ?? 25}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={options.weights?.bendWeight ?? 25}
                onChange={e =>
                  onOptionsChange({
                    ...options,
                    weights: {
                      ...(options.weights || DEFAULT_OPTIMIZATION_WEIGHTS),
                      bendWeight: Number(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>
        </div>

        {/* 5. Primary Bento Action Buttons */}
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1f2229] hover:bg-[#282c35] text-gray-200 hover:text-white text-xs font-semibold uppercase tracking-wider border border-white/10 transition-all active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-gray-300" />
            <span>Пересчитать Схему (Раздельно)</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-open-stepper"
              onClick={onOpenStepper}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#121316] hover:bg-[#1f2229] text-gray-300 hover:text-white text-xs font-medium border border-white/5 transition-colors font-mono"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>4 Фазы</span>
            </button>

            <button
              id="btn-open-benchmark"
              onClick={onOpenBenchmark}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#121316] hover:bg-[#1f2229] text-gray-300 hover:text-white text-xs font-medium border border-white/5 transition-colors font-mono"
            >
              <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Матрица</span>
            </button>
          </div>

          {/* Add custom node dropdown / buttons */}
          <div className="bg-[#0c0d10]/60 rounded-xl border border-white/5 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 uppercase font-mono tracking-widest block">
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
                className="w-full py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Создать Блок (Схема / Фото)</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <button
                id="btn-add-logic"
                onClick={() => onAddBlock('logic')}
                className="px-2.5 py-1.5 rounded-lg bg-[#16181d] hover:bg-[#1f2229] text-[11px] text-gray-300 border border-white/5 flex items-center justify-center gap-1 font-mono"
              >
                <Plus className="w-3 h-3 text-purple-400" />
                <span>Logic (Gate)</span>
              </button>
              <button
                id="btn-add-proc"
                onClick={() => onAddBlock('processor')}
                className="px-2.5 py-1.5 rounded-lg bg-[#16181d] hover:bg-[#1f2229] text-[11px] text-gray-300 border border-white/5 flex items-center justify-center gap-1 font-mono"
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
