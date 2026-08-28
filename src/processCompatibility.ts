import {
  ProcessAttributeValue,
  ProcessBatchCompatibilityPolicy,
  ProcessBatchCompatibilityRule,
  ProcessChangeoverPolicy,
  ProcessJobDescriptor,
} from './processDomain';

function stableValue(value: ProcessAttributeValue | undefined): string {
  if (value === undefined) return '__missing__';
  if (value === null) return '__null__';
  return `${typeof value}:${String(value)}`;
}

function equals(a: ProcessAttributeValue | undefined, b: ProcessAttributeValue | undefined): boolean {
  return stableValue(a) === stableValue(b);
}

function pairMatches(
  pair: [ProcessAttributeValue, ProcessAttributeValue],
  a: ProcessAttributeValue | undefined,
  b: ProcessAttributeValue | undefined,
): boolean {
  return (equals(pair[0], a) && equals(pair[1], b)) || (equals(pair[0], b) && equals(pair[1], a));
}

function ruleApplies(rule: ProcessBatchCompatibilityRule, blockId: string): boolean {
  return !rule.blockId || rule.blockId === blockId;
}

export function areJobsCompatible(
  a: ProcessJobDescriptor,
  b: ProcessJobDescriptor,
  blockId: string,
  policies: ProcessBatchCompatibilityPolicy[] | undefined,
): boolean {
  const rules = (policies || [])
    .filter(policy => !policy.blockIds?.length || policy.blockIds.includes(blockId))
    .flatMap(policy => policy.rules)
    .filter(rule => ruleApplies(rule, blockId));

  for (const rule of rules) {
    const av = a.attributes?.[rule.attribute];
    const bv = b.attributes?.[rule.attribute];
    const missingA = av === undefined || av === null;
    const missingB = bv === undefined || bv === null;

    if (missingA || missingB) {
      const behavior = rule.missingValue || 'separate';
      if (behavior === 'allow') continue;
      if (behavior === 'reject') return false;
      if (missingA !== missingB) return false;
      continue;
    }

    if (rule.mode === 'same' && !equals(av, bv)) return false;
    if (rule.mode === 'different' && equals(av, bv)) return false;
    if (rule.mode === 'allowed-set') {
      const allowed = rule.allowedValues || [];
      if (!allowed.some(value => equals(value, av)) || !allowed.some(value => equals(value, bv))) return false;
    }
    if (rule.mode === 'forbidden-pairs' && (rule.forbiddenPairs || []).some(pair => pairMatches(pair, av, bv))) return false;
  }
  return true;
}

export function isJobCompatibleWithBatch(
  job: ProcessJobDescriptor,
  batch: ProcessJobDescriptor[],
  blockId: string,
  policies: ProcessBatchCompatibilityPolicy[] | undefined,
): boolean {
  return batch.every(existing => areJobsCompatible(job, existing, blockId, policies));
}

export function partitionCompatibleJobs(
  jobs: ProcessJobDescriptor[],
  blockId: string,
  policies: ProcessBatchCompatibilityPolicy[] | undefined,
  capacity = Number.POSITIVE_INFINITY,
): ProcessJobDescriptor[][] {
  const groups: ProcessJobDescriptor[][] = [];
  const limit = Math.max(1, Math.floor(capacity));
  for (const job of jobs) {
    const target = groups.find(group => group.length < limit && isJobCompatibleWithBatch(job, group, blockId, policies));
    if (target) target.push(job);
    else groups.push([job]);
  }
  return groups;
}

export function setupStateForJob(job: ProcessJobDescriptor, policy: ProcessChangeoverPolicy): string {
  return policy.stateAttributes
    .map(attribute => `${attribute}=${stableValue(job.attributes?.[attribute])}`)
    .join('|');
}

export function changeoverSeconds(
  previousState: string | null | undefined,
  nextState: string,
  policy: ProcessChangeoverPolicy,
): number {
  const from = previousState ?? policy.initialState ?? '__initial__';
  if (from === nextState) return Math.max(0, Number(policy.sameStateSeconds) || 0);
  const explicit = policy.matrixSeconds?.[from]?.[nextState];
  if (Number.isFinite(explicit)) return Math.max(0, Number(explicit));
  return Math.max(0, Number(policy.defaultSeconds) || 0);
}

export interface ChangeoverSequenceStep {
  jobId: string;
  setupState: string;
  changeoverSeconds: number;
  cumulativeChangeoverSeconds: number;
}

/**
 * Deterministic nearest-changeover heuristic. It is deliberately generic and
 * side-effect free, so the same policy can later be consumed by DES, a planner,
 * a UI preview, or a host application.
 */
export function orderJobsByChangeover(
  jobs: ProcessJobDescriptor[],
  policy: ProcessChangeoverPolicy,
): ChangeoverSequenceStep[] {
  const remaining = [...jobs];
  const result: ChangeoverSequenceStep[] = [];
  let state: string | null = policy.initialState || null;
  let cumulative = 0;

  while (remaining.length) {
    let bestIndex = 0;
    let bestState = setupStateForJob(remaining[0], policy);
    let bestCost = changeoverSeconds(state, bestState, policy);
    for (let index = 1; index < remaining.length; index += 1) {
      const candidateState = setupStateForJob(remaining[index], policy);
      const cost = changeoverSeconds(state, candidateState, policy);
      if (cost < bestCost || (cost === bestCost && remaining[index].id.localeCompare(remaining[bestIndex].id) < 0)) {
        bestIndex = index;
        bestState = candidateState;
        bestCost = cost;
      }
    }
    const [job] = remaining.splice(bestIndex, 1);
    cumulative += bestCost;
    result.push({ jobId: job.id, setupState: bestState, changeoverSeconds: bestCost, cumulativeChangeoverSeconds: cumulative });
    state = bestState;
  }
  return result;
}
