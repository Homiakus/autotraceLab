import {
  LBC_PLATFORMS,
  LbcEvidenceLevel,
  LbcPlatform,
  LbcStage,
} from '../data/lbcWorkflowData';
import { ProcessScenarioProfile } from '../processDomain';
import {
  ProcessDomainPackManifest,
  ProcessDomainPackRegistry,
} from '../processDomainPack';
import { GraphProcessBlock } from '../processGraphMath';
import { ProcessTimeInput, extractInitialDuration } from '../processMath';

export const LBC_DOMAIN_PACK_ID = 'lbc-cytology';
export const LBC_DOMAIN_PACK_VERSION = '1.0.0';

export interface LbcScenarioOptions {
  jobCount?: number;
  defaultPriority?: number;
  timingOverrides?: Record<string, ProcessTimeInput>;
}

export interface LbcBlockEvidence {
  blockId: string;
  phase: LbcStage['phase'];
  sourceTime: string;
  evidence: LbcEvidenceLevel;
  description: string;
  operator?: string;
  machine?: string;
  note?: string;
  sourceUrl?: string;
}

export interface LbcTimingReadiness {
  totalBlocks: number;
  timedBlocks: number;
  unresolvedBlockIds: string[];
  coveragePercent: number;
  simulationReady: boolean;
}

function clampJobCount(value: number | undefined): number {
  return Math.max(1, Math.floor(Number(value) || 1));
}

function stageIdentity(stage: LbcStage, index: number, phaseOccurrence: number): { id: string; key: string } {
  const suffix = phaseOccurrence > 1 ? `_${phaseOccurrence}` : '';
  return {
    id: `${stage.phase}_${index + 1}`,
    key: `${stage.phase}${suffix}`,
  };
}

function buildBlocks(
  platform: LbcPlatform,
  timingOverrides: Record<string, ProcessTimeInput> | undefined,
): { blocks: GraphProcessBlock[]; evidence: Record<string, LbcBlockEvidence> } {
  const phaseCounts = new Map<LbcStage['phase'], number>();
  const blocks: GraphProcessBlock[] = [];
  const evidence: Record<string, LbcBlockEvidence> = {};
  let previousId: string | undefined;

  platform.stages.forEach((stage, index) => {
    const occurrence = (phaseCounts.get(stage.phase) || 0) + 1;
    phaseCounts.set(stage.phase, occurrence);
    const identity = stageIdentity(stage, index, occurrence);
    const extracted = extractInitialDuration(stage.time);
    const override = timingOverrides?.[identity.id] || timingOverrides?.[identity.key];
    const time = override ? { ...override } : extracted;

    blocks.push({
      id: identity.id,
      key: identity.key,
      title: stage.title,
      automation: stage.automation,
      time,
      dependencies: previousId ? [previousId] : [],
    });

    evidence[identity.id] = {
      blockId: identity.id,
      phase: stage.phase,
      sourceTime: stage.time,
      evidence: stage.evidence,
      description: stage.description,
      operator: stage.operator,
      machine: stage.machine,
      note: stage.note,
      sourceUrl: stage.sourceUrl,
    };
    previousId = identity.id;
  });

  return { blocks, evidence };
}

export function evaluateLbcTimingReadiness(profile: ProcessScenarioProfile): LbcTimingReadiness {
  const unresolvedBlockIds = profile.blocks
    .filter(block => block.time.value == null && !block.time.formula?.trim())
    .map(block => block.id);
  const timedBlocks = profile.blocks.length - unresolvedBlockIds.length;
  return {
    totalBlocks: profile.blocks.length,
    timedBlocks,
    unresolvedBlockIds,
    coveragePercent: profile.blocks.length ? (timedBlocks / profile.blocks.length) * 100 : 0,
    simulationReady: profile.blocks.length > 0 && unresolvedBlockIds.length === 0,
  };
}

export function lbcPlatformToProcessScenario(
  platform: LbcPlatform,
  options: LbcScenarioOptions = {},
): ProcessScenarioProfile {
  const jobCount = clampJobCount(options.jobCount);
  const { blocks, evidence } = buildBlocks(platform, options.timingOverrides);
  const readiness = evaluateLbcTimingReadiness({
    schemaVersion: '1.0',
    id: `lbc-${platform.id}`,
    name: `${platform.vendor} ${platform.name}`,
    domain: 'laboratory.cytology.lbc',
    jobs: [{ id: 'sample-1' }],
    blocks,
    resources: [],
  });

  return {
    schemaVersion: '1.0',
    id: `lbc-${platform.id}`,
    name: `${platform.vendor} ${platform.name}`,
    description: platform.principle,
    domain: 'laboratory.cytology.lbc',
    jobs: Array.from({ length: jobCount }, (_, index) => ({
      id: `sample-${index + 1}`,
      priority: Number(options.defaultPriority) || 0,
      priorityClass: 'routine',
      attributes: {
        sampleType: 'cervical-cytology',
        preparation: 'lbc',
        platformId: platform.id,
        vendor: platform.vendor,
        family: platform.family,
        stainingMode: platform.staining,
      },
    })),
    blocks,
    resources: [],
    objectives: [
      { id: 'cycle-time', metric: 'p95CycleSeconds', goal: 'minimize', weight: 0.6 },
      { id: 'throughput', metric: 'throughputPerHour', goal: 'maximize', weight: 0.4 },
    ],
    metadata: {
      domainPackId: LBC_DOMAIN_PACK_ID,
      domainPackVersion: LBC_DOMAIN_PACK_VERSION,
      platformId: platform.id,
      vendor: platform.vendor,
      family: platform.family,
      principle: platform.principle,
      statedTotalTime: platform.totalTime,
      statedThroughput: platform.throughput,
      stainingMode: platform.staining,
      registrationRu: platform.registrationRu,
      regulatoryNote: platform.regulatoryNote,
      sourcePage: platform.sourcePage,
      lbcEvidenceByBlock: evidence,
      timingReadiness: readiness,
    },
  };
}

export function createLbcDomainPack(platforms: LbcPlatform[] = LBC_PLATFORMS): ProcessDomainPackManifest {
  return {
    schemaVersion: '1.0',
    id: LBC_DOMAIN_PACK_ID,
    version: LBC_DOMAIN_PACK_VERSION,
    name: 'Liquid-Based Cytology',
    description: 'LBC workflow templates expressed through the same universal process profile used by manufacturing, service and compute scenarios.',
    vocabulary: {
      job: 'sample',
      jobs: 'samples',
      operation: 'laboratory step',
      operations: 'workflow',
      resource: 'instrument / station',
      resources: 'instruments / stations',
      batch: 'rack / batch',
      priority: 'priority',
      retry: 'repeat preparation',
      changeover: 'cleaning / setup',
      compatibility: 'batch compatibility',
      throughput: 'slides/hour',
      cycleTime: 'sample turnaround time',
      waitTime: 'queue time',
    },
    jobAttributes: [
      { key: 'sampleType', label: 'Sample type', dataType: 'string', required: true, defaultValue: 'cervical-cytology', group: 'sample' },
      { key: 'preparation', label: 'Preparation', dataType: 'enum', required: true, allowedValues: ['lbc'], defaultValue: 'lbc', group: 'sample' },
      { key: 'platformId', label: 'Platform', dataType: 'string', required: true, group: 'workflow' },
      { key: 'vendor', label: 'Vendor', dataType: 'string', required: true, group: 'workflow' },
      { key: 'family', label: 'Technology family', dataType: 'string', group: 'workflow' },
      { key: 'stainingMode', label: 'Staining mode', dataType: 'enum', allowedValues: ['integrated', 'external', 'optional'], group: 'workflow' },
    ],
    profileTemplates: platforms.map(platform => ({
      id: platform.id,
      name: `${platform.vendor} · ${platform.name}`,
      description: platform.principle,
      profile: lbcPlatformToProcessScenario(platform),
      tags: ['lbc', platform.family.toLowerCase(), platform.staining],
    })),
    defaultObjectives: [
      { id: 'cycle-time', metric: 'p95CycleSeconds', goal: 'minimize', weight: 0.6 },
      { id: 'throughput', metric: 'throughputPerHour', goal: 'maximize', weight: 0.4 },
    ],
    metadata: {
      source: 'src/data/lbcWorkflowData.ts',
      timingPolicy: 'Published or explicitly estimated timings are parsed; unresolved timings remain null and must not be invented by the adapter.',
    },
  };
}

export const LBC_DOMAIN_PACK = createLbcDomainPack();

export function registerLbcDomainPack(registry: ProcessDomainPackRegistry): void {
  const validation = registry.registerPack(LBC_DOMAIN_PACK);
  if (!validation.ok) {
    throw new Error(`LBC domain pack is invalid: ${validation.errors.join('; ')}`);
  }
}
