import assert from 'node:assert/strict';
import {
  PROCESS_CORE_API_VERSION,
  PROCESS_SCENARIO_SCHEMA_VERSION,
  PROCESS_DOMAIN_PACK_SCHEMA_VERSION,
  ProcessDomainPackRegistry,
  MANUFACTURING_DOMAIN_PACK,
  serializeProcessScenario,
  parseProcessScenario,
  simulateUniversalScenario,
  scoreUniversalScenario,
} from '../sdk/index';

assert.equal(PROCESS_CORE_API_VERSION, '1.0.0');
assert.equal(PROCESS_SCENARIO_SCHEMA_VERSION, '1.0');
assert.equal(PROCESS_DOMAIN_PACK_SCHEMA_VERSION, '1.0');

const registry = new ProcessDomainPackRegistry();
const validation = registry.registerPack(MANUFACTURING_DOMAIN_PACK);
assert.equal(validation.ok, true, validation.errors.join('; '));

const profile = registry.createProfile('generic-manufacturing', 'cell');
const roundTrip = parseProcessScenario(serializeProcessScenario(profile));
assert.equal(roundTrip.ok, true, roundTrip.errors.join('; '));

const simulation = simulateUniversalScenario(roundTrip.value!, 1234);
assert.equal(simulation.ok, true, simulation.errors.join('; '));
assert.ok(simulation.stats.makespanSeconds > 0);
assert.ok(simulation.policyStats.changeoverPoliciesApplied > 0);

const score = scoreUniversalScenario(simulation, profile.objectives || []);
assert.ok(score.score >= 0 && score.score <= 1);

console.log('processPublicApiTest: OK');
