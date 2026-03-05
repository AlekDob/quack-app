#!/usr/bin/env node
/**
 * Compares current Knip results against baseline (.knip-baseline.json).
 * Usage: npx knip --reporter json 2>/dev/null | node scripts/knip-compare.cjs
 *    or: npm run health:compare
 */
const fs = require('fs');
const path = require('path');

const baselinePath = path.join(__dirname, '..', '.knip-baseline.json');

if (!fs.existsSync(baselinePath)) {
  console.error('No baseline found. Run: npm run health:baseline');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const input = fs.readFileSync('/dev/stdin', 'utf8');
const j = JSON.parse(input);

const srcFiles = j.files.filter(f => f.startsWith('src/')).length;
const pkgIssue = j.issues.find(i => i.file === 'package.json') || {};
let unusedExports = 0;
let unusedTypes = 0;
for (const issue of j.issues) {
  unusedExports += (issue.exports || []).length;
  unusedTypes += (issue.types || []).length;
}
const unusedDeps = (pkgIssue.dependencies || []).length;
const unusedDevDeps = (pkgIssue.devDependencies || []).length;
const debtScore = srcFiles + unusedExports + unusedTypes + unusedDeps + unusedDevDeps;

const metrics = [
  { name: 'Dead Files (src/)', baseline: baseline.srcFiles, current: srcFiles },
  { name: 'Unused Exports', baseline: baseline.unusedExports, current: unusedExports },
  { name: 'Unused Types', baseline: baseline.unusedTypes, current: unusedTypes },
  { name: 'Unused Deps', baseline: baseline.unusedDeps, current: unusedDeps },
  { name: 'Unused DevDeps', baseline: baseline.unusedDevDeps, current: unusedDevDeps },
  { name: 'DEBT SCORE', baseline: baseline.debtScore, current: debtScore },
];

function pad(str, len, right) {
  str = String(str);
  if (right) return str.padEnd(len);
  return str.padStart(len);
}

console.log('');
console.log('  Codebase Health — Knip Comparison');
console.log(`  Baseline: ${baseline.generated} | Current: ${new Date().toISOString().split('T')[0]}`);
console.log('');
console.log(`  ${pad('Metric', 22, true)} ${pad('Before', 8)} ${pad('Now', 8)} ${pad('Delta', 8)}`);
console.log('  ' + '-'.repeat(50));

for (const m of metrics) {
  const delta = m.current - m.baseline;
  const arrow = delta < 0 ? '↓' : delta > 0 ? '↑' : '=';
  const icon = delta < 0 ? '✅' : delta === 0 ? '➖' : '🔴';
  const sign = delta > 0 ? '+' : '';
  const prefix = m.name === 'DEBT SCORE' ? '★ ' : '  ';
  const deltaStr = `${sign}${delta} ${arrow}`;
  console.log(`  ${pad(prefix + m.name, 22, true)} ${pad(m.baseline, 8)} ${pad(m.current, 8)} ${pad(deltaStr, 8)} ${icon}`);
}

console.log('  ' + '-'.repeat(50));
const pct = baseline.debtScore > 0
  ? (((baseline.debtScore - debtScore) / baseline.debtScore) * 100).toFixed(1)
  : 0;

if (debtScore < baseline.debtScore) {
  console.log(`\n  🎉 Debt reduced by ${pct}% (${baseline.debtScore} → ${debtScore})\n`);
} else if (debtScore === baseline.debtScore) {
  console.log(`\n  ➖ No change in debt score.\n`);
} else {
  console.log(`\n  ⚠️  Debt increased by ${Math.abs(pct)}% (${baseline.debtScore} → ${debtScore})\n`);
}
