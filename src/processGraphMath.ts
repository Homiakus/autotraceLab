import {
  ProcessFormulaContext,
  ProcessFormulaResult,
  ProcessTimeInput,
  evaluateFormula,
  toSeconds,
} from './processMath';

export type ProcessAutomationKind = 'manual' | 'automatic' | 'mixed' | 'wait' | 'external' | 'qc';

export interface GraphProcessBlock {
  id: string;
  key: string;
  title: string;
  automation: ProcessAutomationKind;
  time: ProcessTimeInput;
  dependencies: string[];
}

export interface GraphProcessBlockResult {
  id: string;
  key: string;
  seconds: number | null;
  error?: string;
  criticalFinishSeconds: number | null;
  isCriticalEnd: boolean;
}

export interface GraphProcessStats {
  totalStageSeconds: number;
  criticalPathSeconds: number;
  manualSeconds: number;
  automaticSeconds: number;
  mixedSeconds: number;
  waitSeconds: number;
  externalSeconds: number;
  qcSeconds: number;
  modeledBlocks: number;
  totalBlocks: number;
  coveragePercent: number;
  automationTimeSharePercent: number;
  bottleneckBlockId?: string;
  bottleneckBlockTitle?: string;
  bottleneckSeconds: number;
  throughputPerHour: number | null;
  hasCycle: boolean;
  cycleBlockIds: string[];
}

export interface GraphProcessAnalysis {
  results: Record<string, GraphProcessBlockResult>;
  stats: GraphProcessStats;
  context: ProcessFormulaContext;
  summaryFormula: ProcessFormulaResult | null;
  warnings: string[];
}

function normalizeKey(raw: string, fallback: string): string {
  const source = raw.trim() || fallback;
  const normalized = source
    .replace(/[^A-Za-zА-Яа-яЁё0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^([0-9])/, '_$1');
  return normalized || 'stage';
}

function classifyFormulaError(error?: string): 'dependency' | 'terminal' {
  if (!error) return 'terminal';
  return error.startsWith('Неизвестная переменная:') ? 'dependency' : 'terminal';
}

function resolveDurations(
  blocks: GraphProcessBlock[],
  extraContext: ProcessFormulaContext,
): {
  secondsById: Record<string, number>;
  errorsById: Record<string, string>;
  context: ProcessFormulaContext;
  effectiveKeys: Record<string, string>;
  warnings: string[];
} {
  const context: ProcessFormulaContext = { ...extraContext };
  const secondsById: Record<string, number> = {};
  const errorsById: Record<string, string> = {};
  const effectiveKeys: Record<string, string> = {};
  const warnings: string[] = [];
  const keyOwner = new Map<string, string>();

  for (const block of blocks) {
    const key = normalizeKey(block.key, block.id);
    effectiveKeys[block.id] = key;
    const owner = keyOwner.get(key);
    if (owner && owner !== block.id) {
      errorsById[block.id] = `Математический ключ «${key}» уже используется блоком ${owner}`;
    } else {
      keyOwner.set(key, block.id);
    }
  }

  const unresolved = new Set(blocks.filter(block => !errorsById[block.id]).map(block => block.id));
  let lastDependencyErrors: Record<string, string> = {};

  // Fixed-point resolution allows formulas to reference any block whose value can be resolved,
  // without forcing the UI order to equal dependency order.
  for (let pass = 0; pass < Math.max(2, blocks.length + 1) && unresolved.size > 0; pass += 1) {
    let progress = false;
    lastDependencyErrors = {};

    for (const block of blocks) {
      if (!unresolved.has(block.id)) continue;
      const expression = block.time.formula?.trim();
      let seconds: number | null = null;

      if (expression) {
        const evaluated = evaluateFormula(expression, context);
        if (!evaluated.ok || evaluated.value == null) {
          const message = evaluated.error || 'Ошибка формулы';
          if (classifyFormulaError(message) === 'dependency') {
            lastDependencyErrors[block.id] = message;
            continue;
          }
          errorsById[block.id] = message;
          unresolved.delete(block.id);
          progress = true;
          continue;
        }
        seconds = evaluated.value;
      } else if (block.time.value != null && Number.isFinite(block.time.value)) {
        seconds = toSeconds(block.time.value, block.time.unit);
      } else {
        errorsById[block.id] = 'Время или формула не заданы';
        unresolved.delete(block.id);
        progress = true;
        continue;
      }

      if (!Number.isFinite(seconds)) {
        errorsById[block.id] = 'Время должно быть конечным числом';
      } else if (seconds < 0) {
        errorsById[block.id] = 'Время не может быть отрицательным';
      } else {
        secondsById[block.id] = seconds;
        const key = effectiveKeys[block.id];
        context[`${key}.time`] = seconds;
        context[key] = seconds;
        progress = true;
      }
      unresolved.delete(block.id);
    }

    if (!progress) break;
  }

  for (const blockId of unresolved) {
    errorsById[blockId] = lastDependencyErrors[blockId] || 'Формула содержит циклическую или неразрешимую зависимость';
  }

  for (const block of blocks) {
    for (const dependency of block.dependencies) {
      if (!blocks.some(candidate => candidate.id === dependency)) {
        warnings.push(`Блок «${block.title}»: зависимость ${dependency} не найдена`);
      }
    }
  }

  return { secondsById, errorsById, context, effectiveKeys, warnings };
}

function calculateCriticalPath(
  blocks: GraphProcessBlock[],
  secondsById: Record<string, number>,
): {
  finishById: Record<string, number>;
  hasCycle: boolean;
  cycleBlockIds: string[];
  criticalEndId?: string;
  criticalPathSeconds: number;
} {
  const blockIds = new Set(blocks.map(block => block.id));
  const indegree: Record<string, number> = {};
  const children: Record<string, string[]> = {};

  for (const block of blocks) {
    indegree[block.id] = 0;
    children[block.id] = [];
  }

  for (const block of blocks) {
    const deps = Array.from(new Set(block.dependencies.filter(dep => blockIds.has(dep) && dep !== block.id)));
    indegree[block.id] = deps.length;
    for (const dep of deps) children[dep].push(block.id);
  }

  const queue = blocks.filter(block => indegree[block.id] === 0).map(block => block.id);
  const order: string[] = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    order.push(id);
    for (const child of children[id]) {
      indegree[child] -= 1;
      if (indegree[child] === 0) queue.push(child);
    }
  }

  const cycleBlockIds = blocks.filter(block => !order.includes(block.id)).map(block => block.id);
  const hasCycle = cycleBlockIds.length > 0;
  const finishById: Record<string, number> = {};

  for (const id of order) {
    const block = blocks.find(candidate => candidate.id === id)!;
    const duration = secondsById[id];
    if (!Number.isFinite(duration)) continue;
    const dependencyFinishes = block.dependencies
      .filter(dep => Number.isFinite(finishById[dep]))
      .map(dep => finishById[dep]);
    finishById[id] = duration + (dependencyFinishes.length ? Math.max(...dependencyFinishes) : 0);
  }

  let criticalEndId: string | undefined;
  let criticalPathSeconds = 0;
  for (const [id, finish] of Object.entries(finishById)) {
    if (finish > criticalPathSeconds) {
      criticalPathSeconds = finish;
      criticalEndId = id;
    }
  }

  return { finishById, hasCycle, cycleBlockIds, criticalEndId, criticalPathSeconds };
}

export function analyzeGraphProcess(
  blocks: GraphProcessBlock[],
  options: {
    batchSize?: number;
    summaryFormula?: string;
    extraContext?: ProcessFormulaContext;
  } = {},
): GraphProcessAnalysis {
  const batchSize = Number.isFinite(options.batchSize) && (options.batchSize ?? 0) > 0 ? Number(options.batchSize) : 1;
  const durationResult = resolveDurations(blocks, options.extraContext || {});
  const critical = calculateCriticalPath(blocks, durationResult.secondsById);

  let totalStageSeconds = 0;
  let manualSeconds = 0;
  let automaticSeconds = 0;
  let mixedSeconds = 0;
  let waitSeconds = 0;
  let externalSeconds = 0;
  let qcSeconds = 0;
  let bottleneckSeconds = 0;
  let bottleneckBlockId: string | undefined;
  let bottleneckBlockTitle: string | undefined;

  for (const block of blocks) {
    const seconds = durationResult.secondsById[block.id];
    if (!Number.isFinite(seconds)) continue;
    totalStageSeconds += seconds;
    if (seconds > bottleneckSeconds) {
      bottleneckSeconds = seconds;
      bottleneckBlockId = block.id;
      bottleneckBlockTitle = block.title;
    }
    switch (block.automation) {
      case 'manual': manualSeconds += seconds; break;
      case 'automatic': automaticSeconds += seconds; break;
      case 'mixed': mixedSeconds += seconds; break;
      case 'wait': waitSeconds += seconds; break;
      case 'external': externalSeconds += seconds; break;
      case 'qc': qcSeconds += seconds; break;
      default: break;
    }
  }

  const modeledBlocks = Object.keys(durationResult.secondsById).length;
  const automationDenominator = manualSeconds + automaticSeconds + mixedSeconds + waitSeconds + externalSeconds;
  const coveragePercent = blocks.length ? (modeledBlocks / blocks.length) * 100 : 0;
  const automationTimeSharePercent = automationDenominator > 0 ? (automaticSeconds / automationDenominator) * 100 : 0;
  const throughputPerHour = critical.criticalPathSeconds > 0
    ? batchSize / (critical.criticalPathSeconds / 3600)
    : null;

  const stats: GraphProcessStats = {
    totalStageSeconds,
    criticalPathSeconds: critical.criticalPathSeconds,
    manualSeconds,
    automaticSeconds,
    mixedSeconds,
    waitSeconds,
    externalSeconds,
    qcSeconds,
    modeledBlocks,
    totalBlocks: blocks.length,
    coveragePercent,
    automationTimeSharePercent,
    bottleneckBlockId,
    bottleneckBlockTitle,
    bottleneckSeconds,
    throughputPerHour,
    hasCycle: critical.hasCycle,
    cycleBlockIds: critical.cycleBlockIds,
  };

  const context: ProcessFormulaContext = {
    ...durationResult.context,
    'total.time': totalStageSeconds,
    'critical.time': critical.criticalPathSeconds,
    'manual.time': manualSeconds,
    'automatic.time': automaticSeconds,
    'mixed.time': mixedSeconds,
    'wait.time': waitSeconds,
    'external.time': externalSeconds,
    'qc.time': qcSeconds,
    'bottleneck.time': bottleneckSeconds,
    'batch.count': batchSize,
    'throughput.hour': throughputPerHour ?? 0,
    'coverage.percent': coveragePercent,
    'automation.percent': automationTimeSharePercent,
  };

  const summaryFormula = options.summaryFormula?.trim()
    ? evaluateFormula(options.summaryFormula, context)
    : null;

  const results: Record<string, GraphProcessBlockResult> = {};
  for (const block of blocks) {
    results[block.id] = {
      id: block.id,
      key: durationResult.effectiveKeys[block.id],
      seconds: Number.isFinite(durationResult.secondsById[block.id]) ? durationResult.secondsById[block.id] : null,
      error: durationResult.errorsById[block.id],
      criticalFinishSeconds: Number.isFinite(critical.finishById[block.id]) ? critical.finishById[block.id] : null,
      isCriticalEnd: critical.criticalEndId === block.id,
    };
  }

  const warnings = [...durationResult.warnings];
  if (critical.hasCycle) warnings.push(`Обнаружен цикл зависимостей: ${critical.cycleBlockIds.join(', ')}`);

  return { results, stats, context, summaryFormula, warnings };
}
