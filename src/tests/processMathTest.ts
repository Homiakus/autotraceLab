import {
  calculateProcessStats,
  evaluateFormula,
  resolveStageTimes,
  ProcessStageMathState,
} from '../processMath';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number | undefined, expected: number, message: string): void {
  if (actual == null || Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const arithmetic = evaluateFormula('2 + 3 * 4', {});
assert(arithmetic.ok, 'basic arithmetic should succeed');
assertClose(arithmetic.value, 14, 'operator precedence');

const functions = evaluateFormula('max(10, 20, 15) + avg(2, 4, 6)', {});
assert(functions.ok, 'functions should succeed');
assertClose(functions.value, 24, 'functions result');

const contextFormula = evaluateFormula('prep.time + stain.time / 2', {
  'prep.time': 90,
  'stain.time': 120,
});
assert(contextFormula.ok, 'context formula should succeed');
assertClose(contextFormula.value, 150, 'context variable result');

const divideByZero = evaluateFormula('10 / 0', {});
assert(!divideByZero.ok, 'division by zero should fail');

const stages: ProcessStageMathState[] = [
  { id: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 2, unit: 'min' } },
  { id: 'spin', title: 'Центрифуга', automation: 'automatic', time: { value: null, unit: 's', formula: 'prep.time * 2' } },
  { id: 'stain', title: 'Окраска', automation: 'external', time: { value: 1, unit: 'min' } },
];

const resolved = resolveStageTimes(stages, { 'batch.count': 4 });
assertClose(resolved.secondsByStage.prep, 120, 'minutes to seconds');
assertClose(resolved.secondsByStage.spin, 240, 'dependent formula');
assertClose(resolved.secondsByStage.stain, 60, 'seconds conversion');
assert(Object.keys(resolved.errorsByStage).length === 0, 'valid stages should have no errors');

const stats = calculateProcessStats(stages, resolved.secondsByStage, 4);
assertClose(stats.totalSeconds, 420, 'total process time');
assertClose(stats.manualSeconds, 120, 'manual time');
assertClose(stats.automaticSeconds, 240, 'automatic time');
assertClose(stats.externalSeconds, 60, 'external time');
assert(stats.bottleneckStageId === 'spin', 'spin should be bottleneck');
assertClose(stats.throughputPerHour ?? undefined, 4 / (420 / 3600), 'batch throughput');

console.log('processMathTest: OK');
