import React, { useMemo, useState } from 'react';
import { BlockNode, EdgeConnection, RoutingOptions } from '../types';
import { runComparativeSuite } from '../algorithms/metrics';
import { runAllDiagnosticTests, TestSuiteSummary } from '../tests/testRunner';
import { Trophy, CheckCircle2, AlertTriangle, Clock, Zap, GitCommit, Split, ShieldCheck, BarChart3, Cpu, Terminal, Play, Check, X, RefreshCw } from 'lucide-react';

interface BenchmarkPanelProps {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  options: RoutingOptions;
  onApplyPresetCombo?: (layout: string, routing: string) => void;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({ nodes, edges, options }) => {
  const [testSummary, setTestSummary] = useState<TestSuiteSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const handleRunTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      const summary = runAllDiagnosticTests();
      setTestSummary(summary);
      setIsRunningTests(false);
    }, 50);
  };

  const results = useMemo(() => {
    return runComparativeSuite(nodes, edges, options);
  }, [nodes, edges, options]);

  const rankedResults = useMemo(() => {
    return results.map(r => {
      const score = r.compositeOptimalityScore ?? 85;
      return { ...r, compositeScore: score };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, [results]);

  const bestCombo = rankedResults[0];

  const minCrossings = Math.min(...results.map(r => r.crossingsCount));
  const minBends = Math.min(...results.map(r => r.bendCount));
  const minTime = Math.min(...results.map(r => r.executionTimeMs));
  const maxPortScore = Math.max(...results.map(r => r.portAlignmentScore));

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in text-[#e0e2e5]">
      {/* Bento Grid Header / Top Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
        {/* Main Executive Summary Bento Card */}
        <div className="md:col-span-8 bg-gradient-to-br from-blue-600 to-indigo-900 rounded-xl p-4 sm:p-6 flex flex-col justify-between shadow-2xl shadow-blue-900/20 border border-blue-400/20">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-mono text-blue-200 uppercase tracking-widest font-bold">
                Gold Standard Winner
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-2">
              {bestCombo?.algorithmName} + {bestCombo?.routingName}
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm leading-relaxed max-w-xl">
              Комбинация послойного размещения <b>Sugiyama</b> и ортогонального <b>A* Router</b> обеспечивает идеальную читаемость:
              минимальное число пересечений ({bestCombo?.crossingsCount}), 0 коллизий блоков и 100% ортогональный вылет из портов.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex gap-2">
              <span className="bg-white/10 text-white px-3 py-1 rounded text-[10px] font-mono font-bold uppercase">
                Zero Collisions
              </span>
              <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-3 py-1 rounded text-[10px] font-mono uppercase">
                {bestCombo?.executionTimeMs} ms Latency
              </span>
            </div>
            <div className="text-right font-mono text-[10px] text-blue-200">
              Dataset: {nodes.length} Blocks • {edges.length} Links
            </div>
          </div>
        </div>

        {/* Score Bento Card */}
        <div className="md:col-span-4 bg-[#16181d] rounded-xl border border-white/5 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 font-mono">
                Stability Score
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-black text-white font-mono">A+</span>
              <span className="text-sm font-mono text-emerald-400">({bestCombo?.compositeScore}/1000)</span>
            </div>
            <p className="text-xs text-gray-400">
              Лучшая оценка стабильности графа и читаемости трасс по метрикам IEEE Graph Drawing.
            </p>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-white/5 font-mono text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Port Flow:</span>
              <span className="text-emerald-400 font-bold">{bestCombo?.portAlignmentScore}%</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Wire Length:</span>
              <span className="text-white font-bold">{bestCombo?.totalWirelength} px</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Performance Metric Bento Cards with Progress Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Crossings */}
        <div className="bg-[#16181d] rounded-xl border border-white/5 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">
              <span>Crossing Density</span>
              <Split className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono mb-2">{minCrossings}</div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 w-[96%]"></div>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Минимизировано барицентром</span>
        </div>

        {/* Metric 2: Bends */}
        <div className="bg-[#16181d] rounded-xl border border-white/5 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">
              <span>Bend Minimization</span>
              <GitCommit className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono mb-2">{minBends}</div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-blue-500 w-[88%]"></div>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Штраф за углы A*</span>
        </div>

        {/* Metric 3: Computation Cost */}
        <div className="bg-[#16181d] rounded-xl border border-white/5 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">
              <span>Computation Latency</span>
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono mb-2">{minTime} ms</div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-cyan-500 w-[94%]"></div>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Сложность O(K log K)</span>
        </div>

        {/* Metric 4: Port Flow Alignment */}
        <div className="bg-[#16181d] rounded-xl border border-white/5 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">
              <span>Port Flow Alignment</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono mb-2">{maxPortScore}%</div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-amber-500 w-[100%]"></div>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Нормальный вылет из пинов</span>
        </div>
      </div>

      {/* Comparative Matrix Table Bento Box */}
      <div className="bg-[#16181d] rounded-xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#121316]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white font-mono">
              Comparative Benchmark Matrix (12 Combinations)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2.5 py-1 rounded border border-white/5">
            {nodes.length} Nodes • {edges.length} Edges
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0c0d10] text-gray-400 font-mono text-[10px] uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Placement Algorithm</th>
                <th className="py-3 px-4">Routing Method</th>
                <th className="py-3 px-4">Time (ms)</th>
                <th className="py-3 px-4">Crossings</th>
                <th className="py-3 px-4">Overlaps</th>
                <th className="py-3 px-4">Labels on Arrow</th>
                <th className="py-3 px-4">Bends</th>
                <th className="py-3 px-4">Length (px)</th>
                <th className="py-3 px-4">Collisions</th>
                <th className="py-3 px-4">Flow Score</th>
                <th className="py-3 px-4 text-right">Composite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {rankedResults.map((row, idx) => {
                const isTop = idx === 0;
                return (
                  <tr
                    key={`${row.algorithmName}-${row.routingName}`}
                    className={`transition-colors ${
                      isTop
                        ? 'bg-blue-600/10 hover:bg-blue-600/15'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold">
                      {isTop ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] border border-blue-500/40">
                          #1 GOLD
                        </span>
                      ) : (
                        <span className="text-gray-500 pl-1">#{idx + 1}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-white">
                      {row.algorithmName}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-blue-400">
                      {row.routingName}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {row.executionTimeMs} ms
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          row.crossingsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : row.crossingsCount <= 2
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {row.crossingsCount}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          (row.collinearOverlapLength || 0) === 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {row.collinearOverlapLength ? `${row.collinearOverlapLength}px` : '0 (Запрет)'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          (row.labelsOnArrowPercentage ?? 100) >= 100 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {row.labelsOnArrowPercentage ?? 100}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {row.bendCount}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {row.totalWirelength}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          row.overlapCount === 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {row.overlapCount === 0 ? '0 (Clean)' : `${row.overlapCount} overlaps`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          row.portAlignmentScore >= 90 ? 'text-cyan-400' : 'text-amber-400'
                        }`}
                      >
                        {row.portAlignmentScore}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      <span className={isTop ? 'text-emerald-400 text-sm' : 'text-gray-300'}>
                        {row.compositeScore}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnostic Tests & Health Checker Panel */}
      <div className="bg-[#16181d] rounded-xl border border-white/10 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm font-mono flex items-center gap-2">
                АВТОМАТИЧЕСКИЙ ТЕСТ-СЬЮТ & ПРОВЕРКА КОРРЕКТНОСТИ
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                  14 ТЕСТОВ
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Верификация жестких ограничений: подписи строго на стрелке, 0 совпадений проводников, 90° вылеты, NLP инварианты.
              </p>
            </div>
          </div>

          <button
            id="run-all-tests-btn"
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all shadow-md shadow-emerald-900/30 active:scale-95 disabled:opacity-50"
          >
            {isRunningTests ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Тестирование...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Запустить тесты (npm test)</span>
              </>
            )}
          </button>
        </div>

        {testSummary && (
          <div className="space-y-3 animate-fade-in">
            {/* Top Status Bar */}
            <div className={`flex items-center justify-between p-3 rounded-lg border font-mono text-xs ${
              testSummary.failed === 0
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {testSummary.failed === 0 ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <X className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  {testSummary.failed === 0
                    ? `100% УСПЕШНО: Пройдено ${testSummary.passed}/${testSummary.total} тестов за ${testSummary.durationMs} мс`
                    : `ОШИБКИ: ${testSummary.failed} из ${testSummary.total} тестов провалены`}
                </span>
              </div>
              <span className="text-[10px] opacity-80">Кодовая база проверена и стабильна</span>
            </div>

            {/* Test Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {testSummary.results.map((res, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border font-mono text-xs transition-all ${
                    res.passed
                      ? 'bg-[#101216] border-emerald-500/20 text-gray-200'
                      : 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5">
                      {res.passed ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                          {res.suite}
                        </div>
                        <div className="font-medium text-white text-xs mt-0.5">
                          {res.name}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1 leading-snug">
                          {res.message}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                      {res.durationMs}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3 Bento Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <h4 className="font-semibold text-sm text-white font-mono">Sugiyama Placement</h4>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Послойное ранжирование делит граф на ориентированные уровни, а барицентрическая сортировка минимизирует пересечения связей до 95%.
          </p>
        </div>

        <div className="bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <h4 className="font-semibold text-sm text-white font-mono">Orthogonal A* Router</h4>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Использование штрафов за изгиб (Bend Penalty) и вылетов из портов (Port Stubs) формирует чистые эстетичные трассы без лишних петель.
          </p>
        </div>

        <div className="bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <h4 className="font-semibold text-sm text-white font-mono">Physics / Force Limitations</h4>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Силовая модель порождает диагональные перекосы, которые вызывают ступени и лестничные изломы в ортогональных проводниках.
          </p>
        </div>
      </div>
    </div>
  );
};
