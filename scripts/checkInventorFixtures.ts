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

console.log('Inventor integration fixtures OK: scanning microscope process scenario validated.');
