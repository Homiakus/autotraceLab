import { runAllDiagnosticTests } from './testRunner';

console.log('================================================================');
console.log('  AUTOTRACE LAB - ALGORITHMIC CORRECTNESS & HEALTH TEST SUITE  ');
console.log('================================================================\n');

const summary = runAllDiagnosticTests();

let currentSuite = '';
for (const res of summary.results) {
  if (res.suite !== currentSuite) {
    currentSuite = res.suite;
    console.log(`\n📦 [SUITE] ${currentSuite}`);
    console.log('----------------------------------------------------------------');
  }
  const statusIcon = res.passed ? '✅' : '❌';
  console.log(`${statusIcon} ${res.name} (${res.durationMs}ms)`);
  console.log(`   ${res.message}`);
  if (!res.passed && res.details) {
    console.log(`   DETAILS:`, JSON.stringify(res.details, null, 2));
  }
}

console.log('\n================================================================');
console.log(`  SUMMARY: ${summary.passed}/${summary.total} PASSED, ${summary.failed} FAILED (${summary.durationMs}ms)`);
console.log('================================================================\n');

if (summary.failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Codebase integrity verified 100%.\n');
  process.exit(0);
}
