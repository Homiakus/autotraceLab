import {
  ProcessScenarioProfile,
  cloneProcessScenario,
  validateProcessScenario,
} from './processDomain';
import {
  ProcessDomainPackManifest,
  validateProcessDomainPack,
} from './processDomainPack';

export interface ProcessParseResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
  warnings: string[];
}

function parseObject(text: string): ProcessParseResult<Record<string, unknown>> {
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, errors: ['JSON root must be an object'], warnings: [] };
    }
    return { ok: true, value: value as Record<string, unknown>, errors: [], warnings: [] };
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`], warnings: [] };
  }
}

/**
 * Strict version gate. Future migrations should be explicit functions rather than
 * silently interpreting an unknown schema with today's semantics.
 */
export function parseProcessScenario(text: string): ProcessParseResult<ProcessScenarioProfile> {
  const parsed = parseObject(text);
  if (!parsed.ok || !parsed.value) return parsed as ProcessParseResult<ProcessScenarioProfile>;
  if (parsed.value.schemaVersion !== '1.0') {
    return { ok: false, errors: [`Unsupported process scenario schemaVersion: ${String(parsed.value.schemaVersion)}`], warnings: [] };
  }
  const profile = parsed.value as unknown as ProcessScenarioProfile;
  const validation = validateProcessScenario(profile);
  return {
    ok: validation.ok,
    value: validation.ok ? cloneProcessScenario(profile) : undefined,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

export function serializeProcessScenario(profile: ProcessScenarioProfile, pretty = true): string {
  const validation = validateProcessScenario(profile);
  if (!validation.ok) throw new Error(`Cannot serialize invalid process scenario: ${validation.errors.join('; ')}`);
  return JSON.stringify(profile, null, pretty ? 2 : 0);
}

export function parseProcessDomainPack(text: string): ProcessParseResult<ProcessDomainPackManifest> {
  const parsed = parseObject(text);
  if (!parsed.ok || !parsed.value) return parsed as ProcessParseResult<ProcessDomainPackManifest>;
  if (parsed.value.schemaVersion !== '1.0') {
    return { ok: false, errors: [`Unsupported process domain pack schemaVersion: ${String(parsed.value.schemaVersion)}`], warnings: [] };
  }
  const pack = parsed.value as unknown as ProcessDomainPackManifest;
  const validation = validateProcessDomainPack(pack);
  return {
    ok: validation.ok,
    value: validation.ok ? JSON.parse(JSON.stringify(pack)) as ProcessDomainPackManifest : undefined,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

export function serializeProcessDomainPack(pack: ProcessDomainPackManifest, pretty = true): string {
  const validation = validateProcessDomainPack(pack);
  if (!validation.ok) throw new Error(`Cannot serialize invalid domain pack: ${validation.errors.join('; ')}`);
  return JSON.stringify(pack, null, pretty ? 2 : 0);
}
