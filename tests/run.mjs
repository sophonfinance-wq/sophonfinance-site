// npm test: every suite in one run.
//   (a) content.test.mjs      typos and sentence joins, assets (exact case, tracked), listed terms
//   (b) consistency.test.mjs  audit figures vs demo/audit-canonical.json, 940 vs W-2, L&I rates, cross-demo ties
//   (c) reconcile.test.mjs    trial balances, balance sheets, journals, bank rec, 13-week cash
//   (d) live/run-all.cjs      "Try your own numbers" calculations
//   (e) playback/playback.mjs a fast subset in a headless browser (skipped without a browser unless CI=true)
//
//   node tests/run.mjs [--no-playback]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const t0 = Date.now();
const rows = [];

for (const [name, file] of [['content', 'content.test.mjs'], ['consistency', 'consistency.test.mjs'], ['reconciliation', 'reconcile.test.mjs']]) {
  const mod = await import(new URL('./' + file, import.meta.url));
  const r = mod.run();
  rows.push({ name, ok: !r.fail, detail: `${r.pass} passed, ${r.fail} failed${r.known ? ` (${r.known} expected until fixed)` : ''}`, known: r.known, fail: r.fail });
}

const sub = (name, args) => {
  console.log(`\n## ${name}`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: path.resolve(HERE, '..') });
  rows.push({ name, ok: r.status === 0, detail: r.status === 0 ? 'passed' : `failed (exit ${r.status})`, fail: r.status === 0 ? 0 : 1, known: 0 });
};
sub('live calculations', [path.join(HERE, 'live', 'run-all.cjs')]);
if (!process.argv.includes('--no-playback')) sub('playback (fast subset)', [path.join(HERE, 'playback', 'playback.mjs'), '--subset', '--quick']);

console.log('\n================ SUMMARY ================');
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(24)} ${r.detail}`);
const failed = rows.filter(r => !r.ok);
const onlyKnown = failed.length && failed.every(r => r.known && r.known === r.fail);
console.log(`\n${failed.length ? (onlyKnown ? 'FAILED, but only on checks labelled "EXPECTED UNTIL FIXED" (see above)' : 'FAILED') : 'ALL PASSED'} in ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(failed.length ? 1 : 0);
