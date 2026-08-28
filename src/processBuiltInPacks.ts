import { ProcessDomainPackManifest, ProcessDomainPackRegistry } from './processDomainPack';
import {
  GENERIC_COMPUTE_PROFILE,
  GENERIC_MANUFACTURING_PROFILE,
  GENERIC_SERVICE_PROFILE,
} from './processProfiles';

export const MANUFACTURING_DOMAIN_PACK: ProcessDomainPackManifest = {
  schemaVersion: '1.0',
  id: 'generic-manufacturing',
  version: '1.0.0',
  name: 'Generic Manufacturing',
  description: 'Reusable vocabulary and templates for discrete/batch manufacturing without industry-specific scheduler code.',
  vocabulary: {
    job: 'order', jobs: 'orders', operation: 'operation', operations: 'routing', resource: 'work center', resources: 'work centers', batch: 'batch', changeover: 'setup', throughput: 'output', cycleTime: 'lead time',
  },
  jobAttributes: [
    { key: 'product', label: 'Product', dataType: 'string', required: true, group: 'routing' },
    { key: 'material', label: 'Material', dataType: 'string', group: 'routing' },
    { key: 'finish', label: 'Finish', dataType: 'string', group: 'batching' },
  ],
  profileTemplates: [{ id: 'cell', name: 'Manufacturing cell', profile: GENERIC_MANUFACTURING_PROFILE, tags: ['batch', 'changeover'] }],
  defaultObjectives: GENERIC_MANUFACTURING_PROFILE.objectives,
};

export const SERVICE_DOMAIN_PACK: ProcessDomainPackManifest = {
  schemaVersion: '1.0',
  id: 'generic-service',
  version: '1.0.0',
  name: 'Generic Service Operations',
  description: 'Queues, teams, priorities and review stages for service/request workflows.',
  vocabulary: {
    job: 'request', jobs: 'requests', operation: 'step', operations: 'workflow', resource: 'team', resources: 'teams', batch: 'group', priority: 'priority', retry: 'reopen', cycleTime: 'resolution time', waitTime: 'queue time',
  },
  jobAttributes: [
    { key: 'channel', label: 'Channel', dataType: 'string', required: true },
    { key: 'customerTier', label: 'Customer tier', dataType: 'string' },
  ],
  profileTemplates: [{ id: 'queue', name: 'Service queue', profile: GENERIC_SERVICE_PROFILE, tags: ['queue', 'priority'] }],
  defaultObjectives: GENERIC_SERVICE_PROFILE.objectives,
};

export const COMPUTE_DOMAIN_PACK: ProcessDomainPackManifest = {
  schemaVersion: '1.0',
  id: 'generic-compute',
  version: '1.0.0',
  name: 'Generic Compute Pipeline',
  description: 'Compute jobs, worker pools and latency/throughput objectives.',
  vocabulary: {
    job: 'job', jobs: 'jobs', operation: 'stage', operations: 'pipeline', resource: 'worker pool', resources: 'worker pools', batch: 'micro-batch', throughput: 'jobs/hour', cycleTime: 'latency', waitTime: 'queue latency',
  },
  jobAttributes: [
    { key: 'model', label: 'Model', dataType: 'string' },
    { key: 'tenant', label: 'Tenant', dataType: 'string' },
    { key: 'accelerator', label: 'Accelerator', dataType: 'string', defaultValue: 'gpu' },
  ],
  profileTemplates: [{ id: 'pipeline', name: 'Compute pipeline', profile: GENERIC_COMPUTE_PROFILE, tags: ['compute', 'latency'] }],
  defaultObjectives: GENERIC_COMPUTE_PROFILE.objectives,
};

export const BUILT_IN_PROCESS_DOMAIN_PACKS: ProcessDomainPackManifest[] = [
  MANUFACTURING_DOMAIN_PACK,
  SERVICE_DOMAIN_PACK,
  COMPUTE_DOMAIN_PACK,
];

export function registerBuiltInProcessDomainPacks(registry: ProcessDomainPackRegistry): void {
  for (const pack of BUILT_IN_PROCESS_DOMAIN_PACKS) {
    const validation = registry.registerPack(pack);
    if (!validation.ok) throw new Error(`Built-in domain pack ${pack.id} is invalid: ${validation.errors.join('; ')}`);
  }
}
