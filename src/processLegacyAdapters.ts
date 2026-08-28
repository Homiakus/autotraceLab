import { GraphProcessBlock } from './processGraphMath';
import { ProcessScenarioProfile } from './processDomain';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';

export interface LegacyResourceSimulationModel {
  name: string;
  blocks: GraphProcessBlock[];
  resources: ProcessResource[];
  requirementsByBlock: Record<string, ProcessResourceRequirement[]>;
  batchSize: number;
  releaseIntervalSeconds: number;
}

export interface LegacyResourceAdapterOptions {
  id?: string;
  domain?: string;
  jobIdPrefix?: string;
  defaultPriority?: number;
  metadata?: Record<string, unknown>;
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '') || 'scenario';
}

/**
 * Migration adapter for the pre-Universal Resource Simulation local-storage model.
 * It deliberately adds no domain semantics: generated jobs are generic and hosts may
 * enrich attributes through a Domain Pack runtime adapter afterwards.
 */
export function legacyResourceModelToProcessScenario(
  model: LegacyResourceSimulationModel,
  options: LegacyResourceAdapterOptions = {},
): ProcessScenarioProfile {
  const count = Math.max(1, Math.floor(Number(model.batchSize) || 1));
  const prefix = options.jobIdPrefix || 'job';
  return {
    schemaVersion: '1.0',
    id: options.id || `legacy-${slug(model.name)}`,
    name: model.name,
    domain: options.domain,
    jobs: Array.from({ length: count }, (_, index) => ({
      id: `${prefix}-${index + 1}`,
      priority: Number(options.defaultPriority) || 0,
      attributes: {},
    })),
    blocks: JSON.parse(JSON.stringify(model.blocks)) as GraphProcessBlock[],
    resources: model.resources.map(resource => ({ ...resource })),
    requirementsByBlock: JSON.parse(JSON.stringify(model.requirementsByBlock || {})) as Record<string, ProcessResourceRequirement[]>,
    arrivals: { kind: 'fixed', intervalSeconds: Math.max(0, Number(model.releaseIntervalSeconds) || 0) },
    metadata: {
      ...(options.metadata || {}),
      migratedFrom: 'autotrace:resource-simulation:v1',
    },
  };
}
