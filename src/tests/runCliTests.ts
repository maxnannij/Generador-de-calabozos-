/**
 * Command-line runner for the QA Test Suite
 */
import { runTestSuite } from './testSuite';

console.log('Running DungeonForge Pro QA Test Suite...');
const summary = runTestSuite();

console.log(`\n========================================`);
console.log(`DUNGEONFORGE PRO QA TEST RESULTS`);
console.log(`========================================`);
console.log(`Total Tests Executed: ${summary.total}`);
console.log(`Passed: ${summary.passed}`);
console.log(`Failed: ${summary.failed}`);
console.log(`Duration: ${summary.durationMs}ms`);
console.log(`Seeds Tested in Monte Carlo Property Tests: ${summary.propertySeedsTested}`);
console.log(`Specific Door Test Cases Passed: ${summary.doorCasesPassed}/20`);
console.log(`\nInvariant Checks Passed:`);
summary.invariantsTested.forEach((inv, i) => {
  console.log(`  ${i + 1}. ${inv}`);
});

console.log(`\nDetailed Results:`);
summary.results.forEach((r) => {
  const status = r.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`  [${status}] [${r.category}] ${r.name} (${r.durationMs}ms)`);
  if (r.details) console.log(`         ↳ ${r.details}`);
});

if (summary.failed > 0) {
  process.exit(1);
} else {
  console.log(`\n>>> 100% OF TESTS PASSED CONFORMING TO SPECIFICATION. <<<`);
  process.exit(0);
}
