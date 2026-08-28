import { GraphProcessBlock, analyzeGraphProcess } from '../processGraphMath';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number | null | undefined, expected: number, message: string): void {
  if (actual == null || Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const blocks: GraphProcessBlock[] = [
  {
    id: 'a', key: 'receipt', title: 'Приём', automation: 'manual',
    time: { value: 1, unit: 'min' }, dependencies: [],
  },
  {
    id: 'b', key: 'prep', title: 'Подготовка', automation: 'automatic',
    time: { value: 2, unit: 'min' }, dependencies: ['a'],
  },
  {
    id: 'c', key: 'aliquot', title: 'Аликвота', automation: 'automatic',
    time: { value: 30, unit: 's' }, dependencies: ['a'],
  },
  {
    id: 'd', key: 'join', title: 'Объединение', automation: 'mixed',
    time: { value: null, unit: 's', formula: 'max(prep.time / 12, 10)' }, dependencies: ['b', 'c'],
  },
];

const analysis = analyzeGraphProcess(blocks, {
  batchSize: 4,
  summaryFormula: 'critical.time / batch.count',
});

assertClose(analysis.results.a.seconds, 60, 'receipt duration');
assertClose(analysis.results.b.seconds, 120, 'prep duration');
assertClose(analysis.results.c.seconds, 30, 'aliquot duration');
assertClose(analysis.results.d.seconds, 10, 'formula duration');
assertClose(analysis.stats.totalStageSeconds, 220, 'sum of all stage durations');
assertClose(analysis.stats.criticalPathSeconds, 190, 'DAG critical path should choose A-B-D branch');
assertClose(analysis.stats.manualSeconds, 60, 'manual duration');
assertClose(analysis.stats.automaticSeconds, 150, 'automatic duration');
assert(analysis.stats.bottleneckBlockId === 'b', 'prep should be the bottleneck');
assertClose(analysis.stats.throughputPerHour, 4 / (190 / 3600), 'critical-path throughput');
assert(analysis.summaryFormula?.ok, 'summary formula should evaluate');
assertClose(analysis.summaryFormula?.value, 47.5, 'summary formula result');
assert(!analysis.stats.hasCycle, 'valid DAG must not report a cycle');

// Formula can reference a block appearing later in UI order: fixed-point resolver should converge.
const outOfOrder: GraphProcessBlock[] = [
  {
    id: 'derived', key: 'derived', title: 'Вычисляемый', automation: 'automatic',
    time: { value: null, unit: 's', formula: 'base.time * 2' }, dependencies: ['base'],
  },
  {
    id: 'base', key: 'base', title: 'База', automation: 'manual',
    time: { value: 15, unit: 's' }, dependencies: [],
  },
];
const reordered = analyzeGraphProcess(outOfOrder);
assertClose(reordered.results.derived.seconds, 30, 'fixed-point formula resolution');
assertClose(reordered.stats.criticalPathSeconds, 45, 'dependency graph is independent from UI order');

const cyclic: GraphProcessBlock[] = [
  { id: 'x', key: 'x', title: 'X', automation: 'automatic', time: { value: 1, unit: 's' }, dependencies: ['y'] },
  { id: 'y', key: 'y', title: 'Y', automation: 'automatic', time: { value: 1, unit: 's' }, dependencies: ['x'] },
];
const cycleAnalysis = analyzeGraphProcess(cyclic);
assert(cycleAnalysis.stats.hasCycle, 'cycle must be detected');
assert(cycleAnalysis.stats.cycleBlockIds.length === 2, 'both cycle blocks should be reported');

const duplicateKeys: GraphProcessBlock[] = [
  { id: 'p1', key: 'same', title: 'P1', automation: 'manual', time: { value: 1, unit: 's' }, dependencies: [] },
  { id: 'p2', key: 'same', title: 'P2', automation: 'manual', time: { value: 1, unit: 's' }, dependencies: [] },
];
const duplicateAnalysis = analyzeGraphProcess(duplicateKeys);
assert(Boolean(duplicateAnalysis.results.p2.error), 'duplicate math keys must be rejected');

console.log('processGraphMathTest: OK');
