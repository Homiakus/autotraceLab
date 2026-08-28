import assert from 'node:assert/strict';
import { cloneProcessScenario, validateProcessScenario } from '../processDomain';
import {
  areJobsCompatible,
  changeoverSeconds,
  orderJobsByChangeover,
  partitionCompatibleJobs,
  setupStateForJob,
} from '../processCompatibility';
import { simulateUniversalScenario } from '../processUniversalCompiler';
import { scoreUniversalScenario } from '../processUniversalObjectives';
import {
  GENERIC_COMPUTE_PROFILE,
  GENERIC_MANUFACTURING_PROFILE,
  GENERIC_SERVICE_PROFILE,
  PROCESS_PROFILE_CATALOG,
} from '../processProfiles';

for (const profile of PROCESS_PROFILE_CATALOG) {
  const validation = validateProcessScenario(profile);
  assert.equal(validation.ok, true, `${profile.id}: ${validation.errors.join('; ')}`);
  const result = simulateUniversalScenario(profile);
  assert.equal(result.ok, true, `${profile.id}: ${result.errors.join('; ')}`);
  assert.equal(result.jobsByIndex.length, profile.jobs.length);
  assert.ok(result.stats.makespanSeconds > 0);
}

{
  const profile = GENERIC_MANUFACTURING_PROFILE;
  const a = profile.jobs.find(job => job.attributes?.finish === 'black')!;
  const b = profile.jobs.find(job => job.attributes?.finish === 'white')!;
  assert.equal(areJobsCompatible(a, a, 'finish', profile.compatibility), true);
  assert.equal(areJobsCompatible(a, b, 'finish', profile.compatibility), false);
  const groups = partitionCompatibleJobs(profile.jobs, 'finish', profile.compatibility, 6);
  assert.ok(groups.length >= 2);
  assert.ok(groups.every(group => new Set(group.map(job => job.attributes?.finish)).size === 1));
}

{
  const policy = GENERIC_MANUFACTURING_PROFILE.changeovers![0];
  const jobs = GENERIC_MANUFACTURING_PROFILE.jobs.slice(0, 4);
  const state = setupStateForJob(jobs[0], policy);
  assert.equal(changeoverSeconds(state, state, policy), 0);
  assert.equal(changeoverSeconds('other', state, policy), 180);
  const sequence = orderJobsByChangeover(jobs, policy);
  assert.equal(sequence.length, jobs.length);
  assert.ok(sequence.at(-1)!.cumulativeChangeoverSeconds >= 0);
}

{
  const result = simulateUniversalScenario(GENERIC_COMPUTE_PROFILE);
  const scored = scoreUniversalScenario(result, GENERIC_COMPUTE_PROFILE.objectives!);
  assert.ok(scored.score >= 0 && scored.score <= 1);
  assert.equal(scored.objectives.length, 2);
}

{
  const result = simulateUniversalScenario(GENERIC_SERVICE_PROFILE);
  const custom = scoreUniversalScenario(result, [
    { id: 'custom-quality', metric: 'qualityScore', goal: 'maximize', weight: 1 },
  ], { qualityScore: 0.98 });
  assert.ok(custom.score > 0);
}

{
  const invalid = cloneProcessScenario(GENERIC_COMPUTE_PROFILE);
  invalid.resources = [];
  const validation = validateProcessScenario(invalid);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(error => error.includes('Unknown resource')));
}

console.log('processUniversalDomainTest: OK');
