import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { GraphProcessBlock } from './processGraphMath';

export const PROCESS_MATH_PROFILE_STORAGE_KEY = 'autotrace:process-math-profile:v2';
export const LEGACY_PROCESS_MATH_STORAGE_KEY = 'autotrace:generic-process-math:v1';

export interface LegacyProcessMathModel {
  name: string;
  blocks: GraphProcessBlock[];
  batchSize: number;
  summaryFormula: string;
}

export interface ProcessMathProfileMetadata {
  summaryFormula: string;
  sourceTemplateRef?: string;
}

function metadataObject(profile: ProcessScenarioProfile): Record<string, unknown> {
  return profile.metadata && typeof profile.metadata === 'object' ? profile.metadata : {};
}

export function getProcessMathMetadata(profile: ProcessScenarioProfile): ProcessMathProfileMetadata {
  const raw = metadataObject(profile).processMath;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>;
    return {
      summaryFormula: typeof value.summaryFormula === 'string' && value.summaryFormula.trim()
        ? value.summaryFormula
        : 'critical.time',
      sourceTemplateRef: typeof value.sourceTemplateRef === 'string' ? value.sourceTemplateRef : undefined,
    };
  }
  return { summaryFormula: 'critical.time' };
}

export function withProcessMathMetadata(
  profile: ProcessScenarioProfile,
  patch: Partial<ProcessMathProfileMetadata>,
): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  const current = getProcessMathMetadata(next);
  next.metadata = {
    ...metadataObject(next),
    processMath: {
      ...current,
      ...patch,
    },
  };
  return next;
}

export function createBlankProcessMathScenario(): ProcessScenarioProfile {
  return withProcessMathMetadata({
    schemaVersion: '1.0',
    id: 'process-math-custom',
    name: 'Новый технологический процесс',
    domain: 'generic',
    jobs: [{ id: 'job-1', priority: 0, attributes: {} }],
    blocks: [
      {
        id: 'receipt',
        key: 'receipt',
        title: 'Приём и регистрация',
        automation: 'manual',
        time: { value: 2, unit: 'min' },
        dependencies: [],
      },
      {
        id: 'processing',
        key: 'processing',
        title: 'Автоматическая обработка',
        automation: 'automatic',
        time: { value: 12, unit: 'min' },
        dependencies: ['receipt'],
      },
      {
        id: 'qc',
        key: 'qc',
        title: 'Финальный контроль',
        automation: 'qc',
        time: { value: null, unit: 's', formula: 'max(30, receipt.time / 4)' },
        dependencies: ['processing'],
      },
    ],
    resources: [],
    metadata: { createdBy: 'process-math-v2' },
  }, { summaryFormula: 'total.time / batch.count' });
}

function nextGeneratedJobId(used: Set<string>, index: number): string {
  const base = `job-${index + 1}`;
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function resizeProcessScenarioJobs(
  profile: ProcessScenarioProfile,
  requestedCount: number,
): ProcessScenarioProfile {
  const count = Math.max(1, Math.floor(Number(requestedCount) || 1));
  const next = cloneProcessScenario(profile);
  if (next.jobs.length >= count) {
    next.jobs = next.jobs.slice(0, count);
    return next;
  }

  const sourceJobs = next.jobs.length ? [...next.jobs] : [{ id: 'job-template', priority: 0, attributes: {} }];
  const used = new Set(next.jobs.map(job => job.id));
  while (next.jobs.length < count) {
    const index = next.jobs.length;
    const source = sourceJobs[index % sourceJobs.length];
    const id = nextGeneratedJobId(used, index);
    used.add(id);
    next.jobs.push({
      ...JSON.parse(JSON.stringify(source)),
      id,
    });
  }
  return next;
}

export function migrateLegacyProcessMathModel(model: LegacyProcessMathModel): ProcessScenarioProfile {
  const count = Math.max(1, Math.floor(Number(model.batchSize) || 1));
  return withProcessMathMetadata({
    schemaVersion: '1.0',
    id: 'migrated-process-math',
    name: model.name || 'Импортированный процесс',
    domain: 'generic',
    jobs: Array.from({ length: count }, (_, index) => ({ id: `job-${index + 1}`, priority: 0, attributes: {} })),
    blocks: JSON.parse(JSON.stringify(model.blocks || [])) as GraphProcessBlock[],
    resources: [],
    metadata: {
      migratedFrom: LEGACY_PROCESS_MATH_STORAGE_KEY,
    },
  }, { summaryFormula: model.summaryFormula || 'critical.time' });
}
