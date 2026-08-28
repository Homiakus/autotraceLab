import { ProcessScenarioProfile } from './processDomain';

const minute = (value: number) => ({ value, unit: 'min' as const });

export const GENERIC_MANUFACTURING_PROFILE: ProcessScenarioProfile = {
  schemaVersion: '1.0',
  id: 'generic-manufacturing-cell',
  name: 'Generic manufacturing cell',
  domain: 'manufacturing',
  description: 'Orders pass preparation, machine processing, batch finishing and inspection.',
  jobs: Array.from({ length: 12 }, (_, index) => ({
    id: `order-${index + 1}`,
    priority: index === 0 ? 50 : 0,
    priorityClass: index === 0 ? 'expedite' : 'normal',
    attributes: {
      product: index % 2 ? 'B' : 'A',
      material: index % 3 ? 'steel' : 'aluminium',
      finish: index % 2 ? 'black' : 'white',
    },
  })),
  blocks: [
    { id: 'prepare', key: 'prepare', title: 'Prepare', automation: 'manual', time: minute(2), dependencies: [] },
    { id: 'machine', key: 'machine', title: 'Machine', automation: 'automatic', time: minute(8), dependencies: ['prepare'] },
    { id: 'finish', key: 'finish', title: 'Batch finish', automation: 'automatic', time: minute(15), dependencies: ['machine'] },
    { id: 'inspect', key: 'inspect', title: 'Inspect', automation: 'qc', time: minute(2), dependencies: ['finish'] },
  ],
  resources: [
    { id: 'operator', name: 'Operator', capacity: 1 },
    { id: 'machine', name: 'Machine', capacity: 1 },
    { id: 'finish-line', name: 'Finish line', capacity: 1 },
    { id: 'inspection', name: 'Inspection station', capacity: 1 },
  ],
  requirementsByBlock: {
    prepare: [{ resourceId: 'operator', units: 1 }],
    machine: [{ resourceId: 'machine', units: 1 }],
    finish: [{ resourceId: 'finish-line', units: 1 }],
    inspect: [{ resourceId: 'inspection', units: 1 }],
  },
  batchPolicies: [{ blockId: 'finish', batchCapacity: 6, minBatchSize: 3, maxWaitSeconds: 600 }],
  compatibility: [{
    id: 'finish-color',
    blockIds: ['finish'],
    rules: [{ attribute: 'finish', mode: 'same', missingValue: 'separate' }],
  }],
  changeovers: [{
    id: 'machine-product-change',
    resourceId: 'machine',
    blockId: 'machine',
    stateAttributes: ['product', 'material'],
    defaultSeconds: 180,
    sameStateSeconds: 0,
  }],
  objectives: [
    { id: 'throughput', metric: 'throughputPerHour', goal: 'maximize', weight: 0.35 },
    { id: 'lead-time', metric: 'p95CycleSeconds', goal: 'minimize', weight: 0.35 },
    { id: 'fill', metric: 'averageBatchFillPercent', goal: 'maximize', weight: 0.30 },
  ],
};

export const GENERIC_SERVICE_PROFILE: ProcessScenarioProfile = {
  schemaVersion: '1.0',
  id: 'generic-service-queue',
  name: 'Generic service queue',
  domain: 'service',
  jobs: Array.from({ length: 20 }, (_, index) => ({
    id: `request-${index + 1}`,
    priority: index % 7 === 0 ? 20 : 0,
    priorityClass: index % 7 === 0 ? 'urgent' : 'normal',
    attributes: { channel: index % 2 ? 'email' : 'portal', customerTier: index % 4 === 0 ? 'gold' : 'standard' },
  })),
  arrivals: { kind: 'poisson', meanIntervalSeconds: 180 },
  blocks: [
    { id: 'triage', key: 'triage', title: 'Triage', automation: 'manual', time: minute(3), dependencies: [] },
    { id: 'work', key: 'work', title: 'Work', automation: 'manual', time: minute(12), dependencies: ['triage'] },
    { id: 'review', key: 'review', title: 'Review', automation: 'qc', time: minute(3), dependencies: ['work'] },
  ],
  resources: [
    { id: 'triage-team', name: 'Triage team', capacity: 1 },
    { id: 'specialist', name: 'Specialists', capacity: 3 },
    { id: 'reviewer', name: 'Reviewer', capacity: 1 },
  ],
  requirementsByBlock: {
    triage: [{ resourceId: 'triage-team', units: 1 }],
    work: [{ resourceId: 'specialist', units: 1 }],
    review: [{ resourceId: 'reviewer', units: 1 }],
  },
  objectives: [
    { id: 'response', metric: 'p95CycleSeconds', goal: 'minimize', weight: 0.6 },
    { id: 'wait', metric: 'averageWaitSeconds', goal: 'minimize', weight: 0.4 },
  ],
};

export const GENERIC_COMPUTE_PROFILE: ProcessScenarioProfile = {
  schemaVersion: '1.0',
  id: 'generic-compute-pipeline',
  name: 'Generic compute pipeline',
  domain: 'compute',
  jobs: Array.from({ length: 16 }, (_, index) => ({
    id: `job-${index + 1}`,
    priority: index % 8 === 0 ? 100 : 0,
    attributes: { model: index % 2 ? 'small' : 'large', tenant: `tenant-${index % 3}`, accelerator: 'gpu' },
  })),
  blocks: [
    { id: 'ingest', key: 'ingest', title: 'Ingest', automation: 'automatic', time: { value: 20, unit: 's' }, dependencies: [] },
    { id: 'infer', key: 'infer', title: 'Compute', automation: 'automatic', time: minute(2), dependencies: ['ingest'] },
    { id: 'publish', key: 'publish', title: 'Publish', automation: 'automatic', time: { value: 15, unit: 's' }, dependencies: ['infer'] },
  ],
  resources: [
    { id: 'ingest', name: 'Ingress workers', capacity: 2 },
    { id: 'gpu', name: 'GPU workers', capacity: 2 },
    { id: 'publish', name: 'Publish workers', capacity: 2 },
  ],
  requirementsByBlock: {
    ingest: [{ resourceId: 'ingest', units: 1 }],
    infer: [{ resourceId: 'gpu', units: 1 }],
    publish: [{ resourceId: 'publish', units: 1 }],
  },
  objectives: [
    { id: 'throughput', metric: 'throughputPerHour', goal: 'maximize', weight: 0.5 },
    { id: 'latency', metric: 'p95CycleSeconds', goal: 'minimize', weight: 0.5 },
  ],
};

export const PROCESS_PROFILE_CATALOG: ProcessScenarioProfile[] = [
  GENERIC_MANUFACTURING_PROFILE,
  GENERIC_SERVICE_PROFILE,
  GENERIC_COMPUTE_PROFILE,
];

export function getProcessProfile(id: string): ProcessScenarioProfile | undefined {
  return PROCESS_PROFILE_CATALOG.find(profile => profile.id === id);
}
