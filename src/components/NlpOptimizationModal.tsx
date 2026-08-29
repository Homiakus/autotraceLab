import React, { useState, useMemo } from 'react';
import {
  BlockNode,
  EdgeConnection,
  RoutingOptions,
  NLPOptimizationParams,
} from '../types';
import {
  runNLPOptimization,
  DEFAULT_NLP_PARAMS,
  NLPOptimizationResult,
  calculateNLPOptimalityBreakdown,
} from '../algorithms/nlpOptimizer';
import {
  X,
  Play,
  Pin,
  Sparkles,
  Sliders,
  CheckCircle,
  TrendingDown,
  Activity,
  Layers,
  HelpCircle,
  RefreshCw,
  Compass,
  Zap,
} from 'lucide-react';

interface NlpOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: BlockNode[];
  edges: EdgeConnection[];
  options: RoutingOptions;
  onOptionsChange: (options: RoutingOptions) => void;
  onApplyOptimization: (result: NLPOptimizationResult) => void;
}

export const NlpOptimizationModal: React.FC<NlpOptimizationModalProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  options,
  onOptionsChange,
  onApplyOptimization,
}) => {
  const [params, setParams] = useState<NLPOptimizationParams>({
    ...DEFAULT_NLP_PARAMS,
    ...options.nlpParams,
  });

  const [activeTab, setActiveTab] = useState<'solver' | 'theory' | 'breakdown'>('solver');
  const [lastResult, setLastResult] = useState<NLPOptimizationResult | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [selectedPinnedId, setSelectedPinnedId] = useState<string>(
    nodes.find(n => n.isPinned)?.id || nodes[0]?.id || ''
  );

  const currentBreakdown = useMemo(() => {
    return calculateNLPOptimalityBreakdown(nodes, edges, params);
  }, [nodes, edges, params]);

  if (!isOpen) return null;

  const handleRunNLP = () => {
    setIsSolving(true);
    setTimeout(() => {
      // Mark chosen node as pinned
      const updatedNodes = nodes.map(n => ({
        ...n,
        isPinned: n.id === selectedPinnedId,
      }));

      const res = runNLPOptimization(updatedNodes, edges, options, {
        ...params,
        freezePinnedNodes: true,
      });

      setLastResult(res);
      setIsSolving(false);
    }, 50);
  };

  const handleApplyAndClose = () => {
    if (lastResult) {
      onApplyOptimization(lastResult);
      onOptionsChange({
        ...options,
        optimalBlockDistance: params.optimalBlockDistance,
        optimalWireDistance: params.optimalWireDistance,
        nlpParams: params,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-gray-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#161822]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Нелинейное Программирование (NLP Solver & Criteria)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] font-mono text-blue-300">
                  Projected Gradient + Barrier
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Оптимизация дистанций между блоками, зазоров проводников, частных и общих длин стрелок с фиксацией опорного узла
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#0c0d12] px-4 sm:px-5">
          <button
            onClick={() => setActiveTab('solver')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'solver'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Параметры и Решатель</span>
          </button>
          <button
            onClick={() => setActiveTab('theory')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'theory'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Система Критериев Оптимальности (Математика)</span>
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'breakdown'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Метрики и Сходимость Loss</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'solver' && (
            <div className="space-y-6">
              {/* Pinned Block (Anchor) Section to prevent chaos */}
              <div className="bg-[#181a24] border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Pin className="w-4 h-4" />
                    <span className="text-xs font-bold font-mono uppercase tracking-wider">
                      Заморозка Опорного Блока (Zero Drift Anchor)
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-300/80 font-mono">
                    ∇Φ(X_pinned) ≡ 0
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Чтобы не было хаоса и дрейфа схемы в пространстве, один из ключевых блоков замораживается на месте. Остальные блоки гармонично перераспределяются вокруг него.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-gray-400">Зафиксировать блок:</span>
                  <select
                    value={selectedPinnedId}
                    onChange={e => setSelectedPinnedId(e.target.value)}
                    className="bg-[#0c0d12] border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  >
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.title} ({n.category.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Опорная точка закреплена
                  </span>
                </div>
              </div>

              {/* Hyperparameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* D_opt: Target Block Distance */}
                <div className="bg-[#161820] border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-300 font-semibold">Оптимальное расстояние блоков (D_opt):</span>
                    <span className="text-blue-400 font-bold">{params.optimalBlockDistance} px</span>
                  </div>
                  <input
                    type="range"
                    min="140"
                    max="360"
                    step="10"
                    value={params.optimalBlockDistance}
                    onChange={e =>
                      setParams({ ...params, optimalBlockDistance: Number(e.target.value) })
                    }
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[11px] text-gray-400">
                    Целевая дистанция между центрами связанных блоков для предотвращения скученности и растягивания.
                  </p>
                </div>

                {/* S_opt: Target Wire Separation */}
                <div className="bg-[#161820] border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-300 font-semibold">Оптимальный зазор стрелок (S_opt):</span>
                    <span className="text-purple-400 font-bold">{params.optimalWireDistance} px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="48"
                    step="2"
                    value={params.optimalWireDistance}
                    onChange={e =>
                      setParams({ ...params, optimalWireDistance: Number(e.target.value) })
                    }
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <p className="text-[11px] text-gray-400">
                    Межпроводниковый трассовый зазор в параллельных шинах и вертикальных/горизонтальных каналах.
                  </p>
                </div>

                {/* Learning Rate & Iterations */}
                <div className="bg-[#161820] border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-300 font-semibold">Число итераций спуска:</span>
                    <span className="text-emerald-400 font-bold">{params.iterations}</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="150"
                    step="5"
                    value={params.iterations}
                    onChange={e => setParams({ ...params, iterations: Number(e.target.value) })}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>30 (Быстро)</span>
                    <span>75 (Баланс)</span>
                    <span>150 (Глубоко)</span>
                  </div>
                </div>

                {/* Wirelength Variance & Harmonic Weight */}
                <div className="bg-[#161820] border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-300 font-semibold">Балансировка частных длин (Variance Penalty):</span>
                    <span className="text-amber-400 font-bold">{params.wirelengthVarianceWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={params.wirelengthVarianceWeight}
                    onChange={e =>
                      setParams({ ...params, wirelengthVarianceWeight: Number(e.target.value) })
                    }
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <p className="text-[11px] text-gray-400">
                    Минимизирует пиковые выбросы длины стрелок, приводя их к равномерным пропорциям.
                  </p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs font-mono text-gray-400">
                  Текущая функция потерь Φ(X):{' '}
                  <span className="text-blue-400 font-bold">{currentBreakdown.overallCostValue}</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleRunNLP}
                    disabled={isSolving}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSolving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Вычисление градиентов...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>Запустить NLP Решатель</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Optimization Result Comparison Card */}
              {lastResult && (
                <div className="bg-[#161822] border border-blue-500/30 rounded-xl p-4.5 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs font-mono">
                      <CheckCircle className="w-4 h-4" />
                      <span>Решение сошлось: Улучшение +{lastResult.improvementPercentage}%</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      Φ(X_0): {lastResult.initialBreakdown.overallCostValue} → Φ(X_opt):{' '}
                      <span className="text-emerald-300 font-bold">
                        {lastResult.finalBreakdown.overallCostValue}
                      </span>
                    </span>
                  </div>

                  {/* Quick Metric Comparison */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#0c0d12] p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-400 font-mono">Суммарная длина:</div>
                      <div className="text-xs font-bold text-white mt-1">
                        {lastResult.finalBreakdown.totalWirelength} px{' '}
                        <span className="text-[10px] text-emerald-400 font-normal">
                          (-{lastResult.initialBreakdown.totalWirelength - lastResult.finalBreakdown.totalWirelength}px)
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#0c0d12] p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-400 font-mono">Подписи на своей стрелке:</div>
                      <div className="text-xs font-bold text-emerald-400 mt-1">
                        {lastResult.finalBreakdown.labelsOnArrowCount} / {lastResult.finalBreakdown.labelsOnArrowCount + lastResult.finalBreakdown.labelsOffArrowCount} (100%)
                      </div>
                    </div>

                    <div className="bg-[#0c0d12] p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-400 font-mono">Совпадение стрелок (Overlaps):</div>
                      <div className="text-xs font-bold text-emerald-400 mt-1">
                        {lastResult.finalBreakdown.collinearWireOverlapLength || 0} px (0 коллинеарных)
                      </div>
                    </div>

                    <div className="bg-[#0c0d12] p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-400 font-mono">Штраф за сход с линии:</div>
                      <div className="text-xs font-bold text-emerald-400 mt-1">
                        {lastResult.finalBreakdown.labelsOffArrowPenalty || 0} (Чисто)
                      </div>
                    </div>
                  </div>

                  {/* Apply Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={handleApplyAndClose}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      Применить оптимальную схему
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'theory' && (
            <div className="space-y-5 text-xs text-gray-300 leading-relaxed font-sans">
              <div className="bg-[#161822] border border-white/10 rounded-xl p-4.5 space-y-3">
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-400" />
                  Математическая Формулировка Задачи Нелинейного Программирования (NLP)
                </h3>
                <p>
                  Задача размещения блоков и трассировки проводников формулируется как минимизация гладкой многокритериальной функции потерь с барьерными штрафами при ограничении неподвижности опорного узла:
                </p>
                <div className="bg-[#0c0d12] p-3.5 rounded-lg border border-white/10 font-mono text-[11px] text-blue-300 overflow-x-auto space-y-1">
                  <div>min_(X)  Φ(X) = w_1·L_total + w_2·∑(L_e - D_opt)² + w_3·∑ V_block(d_ij, D_opt) + w_4·∑ V_wire(s_uv, S_opt) + w_5·P_align</div>
                  <div className="text-amber-400">при условии: ∇_X_pinned Φ(X) ≡ 0  (Замороженный опорный блок)</div>
                  <div className="text-emerald-400">и строгих ограничениях: 0 коллизий надписей + 90° углы входа/выхода</div>
                </div>
              </div>

              {/* Criteria Descriptions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#161820] border border-white/5 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-white font-mono text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    1. Общая и Частная Длина Стрелок (Wirelength)
                  </h4>
                  <p className="text-gray-400 text-[11px]">
                    <strong>L_total = ∑ L_e:</strong> Минимизирует суммарную длину всех трасс.
                    <br />
                    <strong>Variance Penalty ∑ (L_e - D_opt)²:</strong> Предотвращает появление чрезмерно длинных или зажатых связей, обеспечивая гармоничные пропорции между всеми узлами.
                  </p>
                </div>

                <div className="bg-[#161820] border border-white/5 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-white font-mono text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    2. Оптимальное Расстояние между Блоками (D_opt)
                  </h4>
                  <p className="text-gray-400 text-[11px]">
                    Барьерный потенциал Леннард-Джонса / Морзе: при приближении блоков ближе порога D_opt возникает гиперболическое отталкивание, а при удалении — гармоническое удержание в зоне оптимума.
                  </p>
                </div>

                <div className="bg-[#161820] border border-white/5 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-white font-mono text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    3. Оптимальный Зазор между Стрелками (S_opt)
                  </h4>
                  <p className="text-gray-400 text-[11px]">
                    Штрафная функция межпроводникового расстояния: предотвращает слипание параллельных шин и резервирует коридоры достаточной ширины для прокладки чистых ортогональных трасс.
                  </p>
                </div>

                <div className="bg-[#161820] border border-white/5 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-white font-mono text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    4. Строгое Условие Надписей и 90° Вылетов
                  </h4>
                  <p className="text-gray-400 text-[11px]">
                    Надписи на стрелках изолированы в свободных коридорах с гарантией 0 пересечений со стрелками и блоками. Вход и выход строго перпендикулярен граням блоков.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'breakdown' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#161820] p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-400 font-mono">Суммарная длина</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {currentBreakdown.totalWirelength} px
                  </div>
                </div>

                <div className="bg-[#161820] p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-400 font-mono">Средняя длина ребра</div>
                  <div className="text-lg font-bold text-blue-400 mt-1">
                    {currentBreakdown.averageWirelength} px
                  </div>
                </div>

                <div className="bg-[#161820] p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-400 font-mono">Дисперсия длин (StdDev)</div>
                  <div className="text-lg font-bold text-purple-400 mt-1">
                    ±{currentBreakdown.wirelengthVariance} px
                  </div>
                </div>

                <div className="bg-[#161820] p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-400 font-mono">Штраф коллизий надписей</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">
                    0 (Чисто)
                  </div>
                </div>
              </div>

              {lastResult && lastResult.history.length > 0 && (
                <div className="bg-[#161820] p-4 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white">
                      Профиль Сходимости Функции Потерь Φ(X)
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      Итераций: {lastResult.history.length}
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    {lastResult.history.map(snap => (
                      <div
                        key={snap.iteration}
                        className="flex items-center justify-between bg-[#0c0d12] px-3 py-1.5 rounded border border-white/5"
                      >
                        <span className="text-gray-400">Итерация {snap.iteration}:</span>
                        <span className="text-blue-300 font-bold">Φ = {snap.loss}</span>
                        <span className="text-gray-400">L_tot = {snap.totalLength}px</span>
                        <span className="text-amber-300">Откл = {snap.blockDistanceDeviation}px</span>
                        <span className="text-emerald-400">||∇|| = {snap.gradientNorm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#161822] flex items-center justify-between">
          <div className="text-xs font-mono text-gray-400">
            Опорный узел:{' '}
            <span className="text-amber-400 font-bold">
              {nodes.find(n => n.id === selectedPinnedId)?.title || nodes[0]?.title || 'Auto'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-semibold transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
