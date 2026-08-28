import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
  exports?: Record<string, unknown>;
  files?: string[];
};

for (const key of ['.', './process', './domain-packs/lbc', './schemas/process-scenario.json', './schemas/process-domain-pack.json']) {
  assert.ok(pkg.exports?.[key], `package export ${key} is missing`);
}
assert.ok(pkg.files?.includes('schemas'), 'schemas directory must be included in the npm package');

for (const file of [
  'dist/lib/index.js',
  'dist/lib/index.cjs',
  'dist/lib/sdk/index.d.ts',
  'dist/lib/process/index.d.ts',
  'dist/lib/domainPacks/lbc.d.ts',
  'schemas/process-scenario.schema.json',
  'schemas/process-domain-pack.schema.json',
]) {
  await access(path.join(root, file));
}

const esm = await import(pathToFileURL(path.join(root, 'dist/lib/index.js')).href);
assert.equal(typeof esm.simulateUniversalScenario, 'function');
assert.equal(typeof esm.buildProcessTemplateCatalog, 'function');
assert.equal(esm.LBC_DOMAIN_PACK?.id, 'lbc-cytology');

const require = createRequire(import.meta.url);
const cjs = require(path.join(root, 'dist/lib/index.cjs')) as Record<string, unknown>;
assert.equal(typeof cjs.simulateUniversalScenario, 'function');
assert.equal(typeof cjs.buildProcessTemplateCatalog, 'function');
assert.equal((cjs.LBC_DOMAIN_PACK as { id?: string } | undefined)?.id, 'lbc-cytology');

const dryRun = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' })) as Array<{
  files?: Array<{ path: string }>;
}>;
const packedFiles = new Set((dryRun[0]?.files || []).map(file => file.path));
for (const file of [
  'schemas/process-scenario.schema.json',
  'schemas/process-domain-pack.schema.json',
  'dist/lib/process/index.d.ts',
  'dist/lib/domainPacks/lbc.d.ts',
]) {
  assert.ok(packedFiles.has(file), `npm pack is missing ${file}`);
}

console.log('verifyProcessPackageSurface: OK');
