import {
  ProcessAttributeMap,
  ProcessAttributeValue,
  ProcessJobDescriptor,
  ProcessOptimizationObjective,
  ProcessScenarioProfile,
  cloneProcessScenario,
  validateProcessScenario,
} from './processDomain';
import { ProcessMetricSnapshot } from './processUniversalObjectives';
import { UniversalSimulationResult } from './processUniversalCompiler';

export type ProcessAttributeDataType = 'string' | 'number' | 'boolean' | 'enum';

export interface ProcessAttributeDefinition {
  key: string;
  label?: string;
  description?: string;
  dataType: ProcessAttributeDataType;
  required?: boolean;
  allowedValues?: ProcessAttributeValue[];
  defaultValue?: ProcessAttributeValue;
  unit?: string;
  group?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessVocabulary {
  job?: string;
  jobs?: string;
  operation?: string;
  operations?: string;
  resource?: string;
  resources?: string;
  batch?: string;
  priority?: string;
  retry?: string;
  changeover?: string;
  compatibility?: string;
  throughput?: string;
  cycleTime?: string;
  waitTime?: string;
  [term: string]: string | undefined;
}

export interface ProcessProfileTemplate {
  id: string;
  name: string;
  description?: string;
  profile: ProcessScenarioProfile;
  tags?: string[];
}

/** Portable, serializable pack manifest. No functions are allowed here. */
export interface ProcessDomainPackManifest {
  schemaVersion: '1.0';
  id: string;
  version: string;
  name: string;
  description?: string;
  vocabulary?: ProcessVocabulary;
  jobAttributes?: ProcessAttributeDefinition[];
  profileTemplates?: ProcessProfileTemplate[];
  defaultObjectives?: ProcessOptimizationObjective[];
  metadata?: Record<string, unknown>;
}

export interface ProcessDomainPackValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProcessJobValidationContext {
  pack: ProcessDomainPackManifest;
  profile?: ProcessScenarioProfile;
}

export interface ProcessRuntimeAdapter {
  id: string;
  packId: string;
  /** Optional runtime-only validation beyond the portable manifest. */
  validateJob?: (job: ProcessJobDescriptor, context: ProcessJobValidationContext) => string[];
  /** Optional derivation of additional attributes without changing the scheduler. */
  deriveJobAttributes?: (job: ProcessJobDescriptor, context: ProcessJobValidationContext) => ProcessAttributeMap;
  /** Optional application-specific numeric metrics for objectives/dashboards. */
  customMetrics?: (result: UniversalSimulationResult, profile: ProcessScenarioProfile) => ProcessMetricSnapshot;
}

function isAllowedValue(value: ProcessAttributeValue, allowed: ProcessAttributeValue[] | undefined): boolean {
  if (!allowed?.length) return true;
  return allowed.some(candidate => typeof candidate === typeof value && candidate === value);
}

export function validateProcessDomainPack(pack: ProcessDomainPackManifest): ProcessDomainPackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (pack.schemaVersion !== '1.0') errors.push(`Unsupported pack schemaVersion: ${pack.schemaVersion}`);
  if (!pack.id.trim()) errors.push('Pack id is required');
  if (!pack.version.trim()) errors.push('Pack version is required');
  if (!pack.name.trim()) errors.push('Pack name is required');

  const attributeKeys = new Set<string>();
  for (const attribute of pack.jobAttributes || []) {
    if (!attribute.key.trim()) errors.push('Attribute key cannot be empty');
    if (attributeKeys.has(attribute.key)) errors.push(`Duplicate attribute definition: ${attribute.key}`);
    attributeKeys.add(attribute.key);
    if (attribute.dataType === 'enum' && !attribute.allowedValues?.length) errors.push(`Enum attribute ${attribute.key} requires allowedValues`);
    if (attribute.defaultValue !== undefined && !isAllowedValue(attribute.defaultValue, attribute.allowedValues)) {
      errors.push(`Default value of ${attribute.key} is not in allowedValues`);
    }
  }

  const templateIds = new Set<string>();
  for (const template of pack.profileTemplates || []) {
    if (!template.id.trim()) errors.push('Template id cannot be empty');
    if (templateIds.has(template.id)) errors.push(`Duplicate template id: ${template.id}`);
    templateIds.add(template.id);
    const validation = validateProcessScenario(template.profile);
    if (!validation.ok) errors.push(`Template ${template.id}: ${validation.errors.join('; ')}`);
    warnings.push(...validation.warnings.map(warning => `Template ${template.id}: ${warning}`));
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateJobAgainstPack(
  job: ProcessJobDescriptor,
  pack: ProcessDomainPackManifest,
): string[] {
  const errors: string[] = [];
  for (const definition of pack.jobAttributes || []) {
    const value = job.attributes?.[definition.key];
    if ((value === undefined || value === null) && definition.required) {
      errors.push(`${job.id}: required attribute ${definition.key} is missing`);
      continue;
    }
    if (value === undefined || value === null) continue;
    if (definition.dataType === 'string' && typeof value !== 'string') errors.push(`${job.id}.${definition.key}: expected string`);
    if (definition.dataType === 'number' && typeof value !== 'number') errors.push(`${job.id}.${definition.key}: expected number`);
    if (definition.dataType === 'boolean' && typeof value !== 'boolean') errors.push(`${job.id}.${definition.key}: expected boolean`);
    if (definition.dataType === 'enum' && !isAllowedValue(value, definition.allowedValues)) errors.push(`${job.id}.${definition.key}: value is not allowed`);
  }
  return errors;
}

export class ProcessDomainPackRegistry {
  private packs = new Map<string, ProcessDomainPackManifest>();
  private adapters = new Map<string, ProcessRuntimeAdapter>();

  registerPack(pack: ProcessDomainPackManifest): ProcessDomainPackValidation {
    const validation = validateProcessDomainPack(pack);
    if (!validation.ok) return validation;
    this.packs.set(pack.id, JSON.parse(JSON.stringify(pack)) as ProcessDomainPackManifest);
    return validation;
  }

  unregisterPack(packId: string): boolean {
    const removed = this.packs.delete(packId);
    for (const [adapterId, adapter] of this.adapters) {
      if (adapter.packId === packId) this.adapters.delete(adapterId);
    }
    return removed;
  }

  getPack(packId: string): ProcessDomainPackManifest | undefined {
    const pack = this.packs.get(packId);
    return pack ? JSON.parse(JSON.stringify(pack)) as ProcessDomainPackManifest : undefined;
  }

  listPacks(): ProcessDomainPackManifest[] {
    return Array.from(this.packs.values())
      .map(pack => JSON.parse(JSON.stringify(pack)) as ProcessDomainPackManifest)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  registerRuntimeAdapter(adapter: ProcessRuntimeAdapter): void {
    if (!this.packs.has(adapter.packId)) throw new Error(`Cannot register adapter ${adapter.id}: pack ${adapter.packId} is not registered`);
    this.adapters.set(adapter.id, adapter);
  }

  unregisterRuntimeAdapter(adapterId: string): boolean {
    return this.adapters.delete(adapterId);
  }

  listRuntimeAdapters(packId?: string): ProcessRuntimeAdapter[] {
    return Array.from(this.adapters.values()).filter(adapter => !packId || adapter.packId === packId);
  }

  createProfile(packId: string, templateId: string): ProcessScenarioProfile {
    const pack = this.packs.get(packId);
    if (!pack) throw new Error(`Unknown process domain pack: ${packId}`);
    const template = pack.profileTemplates?.find(item => item.id === templateId);
    if (!template) throw new Error(`Unknown template ${templateId} in pack ${packId}`);
    const profile = cloneProcessScenario(template.profile);
    if (!profile.objectives?.length && pack.defaultObjectives?.length) {
      profile.objectives = JSON.parse(JSON.stringify(pack.defaultObjectives)) as ProcessOptimizationObjective[];
    }
    profile.metadata = { ...(profile.metadata || {}), domainPackId: pack.id, domainPackVersion: pack.version, templateId };
    return profile;
  }

  prepareProfile(packId: string, profile: ProcessScenarioProfile): { profile: ProcessScenarioProfile; errors: string[] } {
    const pack = this.packs.get(packId);
    if (!pack) return { profile: cloneProcessScenario(profile), errors: [`Unknown process domain pack: ${packId}`] };
    const prepared = cloneProcessScenario(profile);
    const errors: string[] = [];
    const adapters = this.listRuntimeAdapters(packId);

    for (const job of prepared.jobs) {
      job.attributes = { ...(job.attributes || {}) };
      for (const definition of pack.jobAttributes || []) {
        if ((job.attributes[definition.key] === undefined || job.attributes[definition.key] === null) && definition.defaultValue !== undefined) {
          job.attributes[definition.key] = definition.defaultValue;
        }
      }
      errors.push(...validateJobAgainstPack(job, pack));
      for (const adapter of adapters) {
        if (adapter.deriveJobAttributes) Object.assign(job.attributes, adapter.deriveJobAttributes(job, { pack, profile: prepared }));
        if (adapter.validateJob) errors.push(...adapter.validateJob(job, { pack, profile: prepared }));
      }
    }

    prepared.metadata = { ...(prepared.metadata || {}), domainPackId: pack.id, domainPackVersion: pack.version };
    return { profile: prepared, errors };
  }

  collectCustomMetrics(packId: string, result: UniversalSimulationResult, profile: ProcessScenarioProfile): ProcessMetricSnapshot {
    const pack = this.packs.get(packId);
    if (!pack) return {};
    return Object.assign({}, ...this.listRuntimeAdapters(packId).map(adapter => adapter.customMetrics?.(result, profile) || {}));
  }
}

export const processDomainPackRegistry = new ProcessDomainPackRegistry();
