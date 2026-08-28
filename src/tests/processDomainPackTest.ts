import assert from 'node:assert/strict';
import { simulateUniversalScenario } from '../processUniversalCompiler';
import {
  ProcessDomainPackRegistry,
  validateJobAgainstPack,
  validateProcessDomainPack,
} from '../processDomainPack';
import {
  BUILT_IN_PROCESS_DOMAIN_PACKS,
  MANUFACTURING_DOMAIN_PACK,
  registerBuiltInProcessDomainPacks,
} from '../processBuiltInPacks';
import {
  parseProcessDomainPack,
  parseProcessScenario,
  serializeProcessDomainPack,
  serializeProcessScenario,
} from '../processProfileIO';
import { legacyResourceModelToProcessScenario } from '../processLegacyAdapters';

{
  for (const pack of BUILT_IN_PROCESS_DOMAIN_PACKS) {
    const validation = validateProcessDomainPack(pack);
    assert.equal(validation.ok, true, `${pack.id}: ${validation.errors.join('; ')}`);
  }
}

{
  const registry = new ProcessDomainPackRegistry();
  registerBuiltInProcessDomainPacks(registry);
  assert.equal(registry.listPacks().length, 3);

  const profile = registry.createProfile('generic-manufacturing', 'cell');
  assert.equal(profile.metadata?.domainPackId, 'generic-manufacturing');
  assert.equal(profile.metadata?.domainPackVersion, '1.0.0');

  registry.registerRuntimeAdapter({
    id: 'manufacturing-runtime-test',
    packId: 'generic-manufacturing',
    deriveJobAttributes: job => ({ family: String(job.attributes?.product || 'unknown').toLowerCase() }),
    validateJob: job => job.attributes?.product ? [] : [`${job.id}: product required by runtime adapter`],
    customMetrics: result => ({ customEfficiency: result.stats.throughputPerHour || 0 }),
  });

  const prepared = registry.prepareProfile('generic-manufacturing', profile);
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.profile.jobs[0].attributes?.family, 'a');

  const simulation = simulateUniversalScenario(prepared.profile, 10);
  assert.equal(simulation.ok, true, simulation.errors.join('; '));
  const metrics = registry.collectCustomMetrics('generic-manufacturing', simulation, prepared.profile);
  assert.ok(Number(metrics.customEfficiency) > 0);

  assert.equal(registry.unregisterPack('generic-manufacturing'), true);
  assert.equal(registry.listRuntimeAdapters('generic-manufacturing').length, 0, 'removing a pack must remove its runtime adapters');
}

{
  const json = serializeProcessDomainPack(MANUFACTURING_DOMAIN_PACK);
  const parsed = parseProcessDomainPack(json);
  assert.equal(parsed.ok, true, parsed.errors.join('; '));
  assert.equal(parsed.value?.id, MANUFACTURING_DOMAIN_PACK.id);

  const profile = MANUFACTURING_DOMAIN_PACK.profileTemplates![0].profile;
  const profileJson = serializeProcessScenario(profile);
  const profileParsed = parseProcessScenario(profileJson);
  assert.equal(profileParsed.ok, true, profileParsed.errors.join('; '));
  assert.equal(profileParsed.value?.jobs.length, profile.jobs.length);

  const future = parseProcessScenario('{"schemaVersion":"2.0"}');
  assert.equal(future.ok, false, 'unknown schema version must fail closed instead of being guessed');
}

{
  const errors = validateJobAgainstPack({ id: 'bad', attributes: { product: 12 } }, MANUFACTURING_DOMAIN_PACK);
  assert.ok(errors.some(error => error.includes('expected string')));
}

{
  const migrated = legacyResourceModelToProcessScenario({
    name: 'Legacy demo',
    batchSize: 3,
    releaseIntervalSeconds: 15,
    blocks: [{ id: 'op', key: 'op', title: 'Operation', automation: 'automatic', time: { value: 1, unit: 'min' }, dependencies: [] }],
    resources: [{ id: 'machine', name: 'Machine', capacity: 1 }],
    requirementsByBlock: { op: [{ resourceId: 'machine', units: 1 }] },
  });
  assert.equal(migrated.jobs.length, 3);
  assert.equal(migrated.arrivals?.kind, 'fixed');
  assert.equal(migrated.metadata?.migratedFrom, 'autotrace:resource-simulation:v1');
  const simulation = simulateUniversalScenario(migrated, 11);
  assert.equal(simulation.ok, true, simulation.errors.join('; '));
}

console.log('processDomainPackTest: OK');
