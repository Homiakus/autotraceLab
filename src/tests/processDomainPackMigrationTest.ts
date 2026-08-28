import assert from 'node:assert/strict';
import {
  BUILT_IN_PROCESS_DOMAIN_PACKS,
  LBC_DOMAIN_PACK,
  LBC_DOMAIN_PACK_ID,
  ProcessDomainPackRegistry,
  buildProcessTemplateCatalog,
  createBlankProcessMathScenario,
  createScenarioFromTemplateRef,
  evaluateLbcTimingReadiness,
  getProcessMathMetadata,
  lbcPlatformToProcessScenario,
  migrateLegacyProcessMathModel,
  parseProcessTemplateRef,
  processTemplateRef,
  resizeProcessScenarioJobs,
  simulateUniversalScenario,
  validateProcessDomainPack,
  validateProcessScenario,
} from '../sdk/index';
import { LBC_PLATFORMS } from '../data/lbcWorkflowData';
import { extractInitialDuration } from '../processMath';

{
  const validation = validateProcessDomainPack(LBC_DOMAIN_PACK);
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(LBC_DOMAIN_PACK.id, LBC_DOMAIN_PACK_ID);
  assert.equal(LBC_DOMAIN_PACK.profileTemplates?.length, LBC_PLATFORMS.length);
}

for (const platform of LBC_PLATFORMS) {
  const profile = lbcPlatformToProcessScenario(platform);
  const validation = validateProcessScenario(profile);
  assert.equal(validation.ok, true, `${platform.id}: ${validation.errors.join('; ')}`);
  assert.equal(profile.blocks.length, platform.stages.length, `${platform.id}: every source stage must become one universal block`);
  assert.equal(profile.jobs.length, 1);
  assert.equal(profile.domain, 'laboratory.cytology.lbc');
  assert.equal(profile.jobs[0].attributes?.platformId, platform.id);

  const evidence = profile.metadata?.lbcEvidenceByBlock as Record<string, { sourceTime?: string }>;
  assert.equal(Object.keys(evidence || {}).length, platform.stages.length, `${platform.id}: evidence metadata must remain 1:1 with source stages`);

  platform.stages.forEach((stage, index) => {
    const block = profile.blocks[index];
    const extracted = extractInitialDuration(stage.time);
    assert.deepEqual(block.time, extracted, `${platform.id}/${block.id}: adapter must use the same conservative timing parser`);
    assert.equal(evidence[block.id]?.sourceTime, stage.time);
  });

  const readiness = evaluateLbcTimingReadiness(profile);
  assert.equal(readiness.totalBlocks, platform.stages.length);
  assert.equal(readiness.timedBlocks + readiness.unresolvedBlockIds.length, readiness.totalBlocks);
}

{
  const platform = LBC_PLATFORMS[0];
  const base = lbcPlatformToProcessScenario(platform);
  const timingOverrides = Object.fromEntries(base.blocks.map(block => [block.id, { value: 1, unit: 's' as const }]));
  const ready = lbcPlatformToProcessScenario(platform, { jobCount: 3, timingOverrides });
  const readiness = evaluateLbcTimingReadiness(ready);
  assert.equal(readiness.simulationReady, true);
  assert.equal(readiness.coveragePercent, 100);
  const simulation = simulateUniversalScenario(ready, 77);
  assert.equal(simulation.ok, true, simulation.errors.join('; '));
  assert.equal(simulation.jobsByIndex.length, 3);
}

{
  const registry = new ProcessDomainPackRegistry();
  const registration = registry.registerPack(LBC_DOMAIN_PACK);
  assert.equal(registration.ok, true, registration.errors.join('; '));
  const firstPlatform = LBC_PLATFORMS[0];
  const profile = registry.createProfile(LBC_DOMAIN_PACK_ID, firstPlatform.id);
  assert.equal(profile.metadata?.domainPackId, LBC_DOMAIN_PACK_ID);
  assert.equal(profile.metadata?.templateId, firstPlatform.id);
}

{
  const packs = [...BUILT_IN_PROCESS_DOMAIN_PACKS, LBC_DOMAIN_PACK];
  const catalog = buildProcessTemplateCatalog(packs);
  const refs = catalog.map(item => item.ref);
  assert.equal(new Set(refs).size, refs.length, 'template refs must remain globally unique across domain packs');
  assert.ok(catalog.some(item => item.packId === 'generic-manufacturing'));
  assert.ok(catalog.some(item => item.packId === 'generic-service'));
  assert.ok(catalog.some(item => item.packId === 'generic-compute'));
  assert.ok(catalog.some(item => item.packId === LBC_DOMAIN_PACK_ID));

  const lbcRef = processTemplateRef(LBC_DOMAIN_PACK_ID, LBC_PLATFORMS[0].id);
  assert.deepEqual(parseProcessTemplateRef(lbcRef), { packId: LBC_DOMAIN_PACK_ID, templateId: LBC_PLATFORMS[0].id });
  const scenario = createScenarioFromTemplateRef(packs, lbcRef);
  assert.ok(scenario);
  assert.equal(scenario?.metadata?.domainPackId, LBC_DOMAIN_PACK_ID);
  assert.equal(parseProcessTemplateRef('broken'), null);
}

{
  const blank = createBlankProcessMathScenario();
  assert.equal(validateProcessScenario(blank).ok, true);
  assert.equal(getProcessMathMetadata(blank).summaryFormula, 'total.time / batch.count');

  const expanded = resizeProcessScenarioJobs(blank, 5);
  assert.equal(expanded.jobs.length, 5);
  assert.equal(new Set(expanded.jobs.map(job => job.id)).size, 5);
  const shrunk = resizeProcessScenarioJobs(expanded, 2);
  assert.equal(shrunk.jobs.length, 2);

  const migrated = migrateLegacyProcessMathModel({
    name: 'Legacy math',
    batchSize: 4,
    summaryFormula: 'critical.time',
    blocks: blank.blocks,
  });
  assert.equal(migrated.jobs.length, 4);
  assert.equal(migrated.metadata?.migratedFrom, 'autotrace:generic-process-math:v1');
  assert.equal(getProcessMathMetadata(migrated).summaryFormula, 'critical.time');
  assert.equal(validateProcessScenario(migrated).ok, true);
}

console.log('processDomainPackMigrationTest: OK');
