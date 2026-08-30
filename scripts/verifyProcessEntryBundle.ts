import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const htmlPath = resolve(dist, 'index.html');
assert.ok(existsSync(htmlPath), 'dist/index.html missing; run production build first');

const html = readFileSync(htmlPath, 'utf8');
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i)
  || html.match(/<script[^>]+src="([^"]+)"[^>]+type="module"/i);
assert.ok(entryMatch, 'could not locate Vite module entry in dist/index.html');
const entryPath = resolve(dist, entryMatch[1].replace(/^\//, ''));
assert.ok(existsSync(entryPath), `entry bundle missing: ${entryPath}`);
const entry = readFileSync(entryPath, 'utf8');

const forbiddenEntryMarkers = [
  'autotrace:generic-process-math:v1',
  'autotrace:resource-simulation:v1',
  'autotrace:batch-simulation:v1',
  'simulateStochasticDigitalTwin',
  'simulateUnifiedStochasticBatchTwin',
  'optimizeUnifiedBatchPolicy',
];
for (const marker of forbiddenEntryMarkers) {
  assert.equal(entry.includes(marker), false, `initial entry bundle contains legacy marker: ${marker}`);
}

const assetDir = resolve(dist, 'assets');
const jsAssets = readdirSync(assetDir).filter(file => file.endsWith('.js'));
assert.ok(jsAssets.length >= 8, `expected route code splitting to produce multiple JS chunks, got ${jsAssets.length}`);

const entryBytes = statSync(entryPath).size;
console.log(`verifyProcessEntryBundle: OK · entry=${entryBytes} bytes · jsChunks=${jsAssets.length}`);
