import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'src');
const primaryViews = [
  'UniversalProcessMathApp.tsx',
  'UniversalProcessSimulationApp.tsx',
  'UniversalProcessRiskApp.tsx',
  'UniversalProcessBatchApp.tsx',
  'UniversalProcessDigitalTwinApp.tsx',
  'UniversalProcessReliabilityApp.tsx',
  'UniversalProcessOptimizerApp.tsx',
  'UniversalProcessLabApp.tsx',
];

const forbiddenRuntimeMarkers = [
  'autotrace:generic-process-math:v1',
  'autotrace:resource-simulation:v1',
  'autotrace:batch-simulation:v1',
  'simulateResourceConstrainedProcess(',
  'runProcessMonteCarlo(',
  'simulateBatchCycleProcess(',
  'simulateStochasticDigitalTwin(',
  'runReliabilityMonteCarlo(',
  'simulateUnifiedStochasticBatchTwin(',
  'optimizeUnifiedBatchPolicy(',
];

for (const file of primaryViews) {
  const content = readFileSync(resolve(root, file), 'utf8');
  for (const token of forbiddenRuntimeMarkers) {
    assert.equal(
      content.includes(token),
      false,
      `${file} must not depend on legacy production token: ${token}`,
    );
  }

  // LBC is allowed only through the Domain Pack boundary. Mentions in explanatory UI prose
  // are harmless; importing the raw platform catalog into a primary universal view is not.
  assert.equal(
    /import\s*{[^}]*\bLBC_PLATFORMS\b[^}]*}\s*from\s*['"][^'"]+['"]/.test(content),
    false,
    `${file} must not import raw LBC_PLATFORMS; use LBC_DOMAIN_PACK instead`,
  );
}

const main = readFileSync(resolve(root, 'main.tsx'), 'utf8');
const staticRouteImports = main
  .split('\n')
  .filter(line => /^import\s+.+from\s+['"]\.\/(?:Process|UniversalProcess|GenericProcess|LbcWorkflow|NativeProcessMath|App)/.test(line));
assert.deepEqual(staticRouteImports, [], `route apps must be lazy-loaded, found: ${staticRouteImports.join(' | ')}`);

const expectedLazyRoutes = [
  './GenericProcessMathApp.tsx',
  './ProcessSimulationApp.tsx',
  './ProcessRiskApp.tsx',
  './ProcessBatchApp.tsx',
  './ProcessBatchRiskApp.tsx',
  './ProcessDigitalTwinApp.tsx',
  './ProcessReliabilityApp.tsx',
  './ProcessUnifiedTwinApp.tsx',
  './ProcessUnifiedOptimizerApp.tsx',
  './UniversalProcessMathApp.tsx',
  './UniversalProcessSimulationApp.tsx',
  './UniversalProcessRiskApp.tsx',
  './UniversalProcessBatchApp.tsx',
  './UniversalProcessDigitalTwinApp.tsx',
  './UniversalProcessReliabilityApp.tsx',
  './UniversalProcessOptimizerApp.tsx',
];
for (const modulePath of expectedLazyRoutes) {
  assert.ok(main.includes(`import('${modulePath}')`), `missing lazy route: ${modulePath}`);
}

console.log('processPrimaryRouteBoundaryTest: OK');
