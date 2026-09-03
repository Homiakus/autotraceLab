import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateProcessScenario, type ProcessScenarioProfile } from '../src/processDomain';

function loadScenario(path: string): ProcessScenarioProfile {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as ProcessScenarioProfile;
}

const microscope = loadScenario('examples/inventor/scanning_microscope_process.json');
const validation = validateProcessScenario(microscope);

assert.equal(validation.ok, true, validation.errors.join('\n'));
assert.equal(validation.errors.length, 0);
assert.equal(microscope.schemaVersion, '1.0');
assert.equal(microscope.domain, 'microscopy');
assert.deepEqual(
  microscope.blocks.map(block => block.key),
  ['position-tile', 'autofocus', 'capture-tile', 'stitch-dataset'],
);
assert.ok(microscope.blocks.every(block => block.time.value === null));
assert.deepEqual(microscope.blocks[1].dependencies, ['b1']);
assert.deepEqual(microscope.blocks[2].dependencies, ['b2']);
assert.deepEqual(microscope.blocks[3].dependencies, ['b3']);
assert.equal(microscope.metadata?.durationStatus, 'unknown');
assert.equal(microscope.metadata?.evidenceRepository, 'Homiakus/ScannerPro');

const componentRefsByBlock = microscope.metadata?.componentRefsByBlock as Record<string, string[]> | undefined;
const stateRefsByBlock = microscope.metadata?.stateRefsByBlock as Record<string, string[]> | undefined;
assert.deepEqual(componentRefsByBlock?.b1, [
  'scanning-microscope.product.instance.instance-scanningmicroscope-sample-stage',
]);
assert.deepEqual(stateRefsByBlock?.b1, ['scanning-microscope.state.running']);
assert.deepEqual(stateRefsByBlock?.b2, ['scanning-microscope.state.running']);
assert.deepEqual(stateRefsByBlock?.b3, [
  'scanning-microscope.state.running',
  'scanning-microscope.state.capture-complete',
]);
assert.deepEqual(stateRefsByBlock?.b4, ['scanning-microscope.state.stitching']);

console.log('Inventor integration fixtures OK: scanning microscope process scenario validated.');
