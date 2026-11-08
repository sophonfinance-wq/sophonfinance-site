// (d) "Try your own numbers" calculation tests, no browser: each live calculation (demo/live/calc/<demo>.js) reproduces
// the recorded run exactly on unchanged inputs, then recomputes edits correctly.
//   node tests/live/run-all.cjs      (exit code 1 if any fails)
const { execFileSync } = require('child_process'), path = require('path');
let bad = 0;
for (const f of ['test-941.cjs', 'test-1040.cjs', 'test-bankrec.cjs', 'test-ap.cjs', 'test-cash13.cjs']) {
  try { process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, f)]).toString()); }
  catch (e) { bad++; process.stdout.write((e.stdout || '').toString() + (e.stderr || '').toString()); console.log(f + ' FAILED'); }
}
console.log(bad ? bad + ' live-calculation test file(s) failed' : 'All live-calculation tests passed');
process.exit(bad ? 1 : 0);
