// "Try your own numbers" calculation tests (copied from the QA round's qa/live-tests; run from tests/live).
// Disk-backed version of the browser's data source: the same lib.makeSource over the demo folder.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const SITE = process.env.FF_SITE || path.resolve(__dirname, '..', '..');
const lib = require(path.join(SITE, 'demo/live/lib.js'));
function source(demo) {
  const base = path.join(SITE, 'demo', demo);
  // OneDrive can hold a file for a moment (EBUSY): retry
  const read = (p, enc) => new Promise((res, rej) => { let n = 0; const go = () => fs.readFile(path.join(base, p), enc, (e, t) => e ? (/EBUSY|EPERM|EACCES/.test(e.code) && n++ < 40 ? setTimeout(go, 150) : rej(e)) : res(t)); go(); });
  const readText = p => read(p, 'utf8');
  const readBin = p => read(p).then(b => new Uint8Array(b));
  return lib.makeSource(readText, readBin, /^tax-/.test(demo) ? ['data/manifest.json', 'data/routes.json'] : ['data/routes.json', 'data/manifest.json']);
}
const inflateRaw = u8 => Promise.resolve(new Uint8Array(zlib.inflateRawSync(Buffer.from(u8))));
function calcOf(demo) { return require(path.join(SITE, 'demo/live/calc', demo + '.js')); }
let fails = 0, passes = 0;
function eq(label, got, want, tol = 0.005) {
  const ok = typeof want === 'number' ? Math.abs(+got - want) < tol : String(got) === String(want);
  if (ok) passes++; else { fails++; console.log('  FAIL ' + label + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }
  return ok;
}
function ok(label, cond, extra) { if (cond) passes++; else { fails++; console.log('  FAIL ' + label + (extra ? ' ' + extra : '')); } }
function done(name) { console.log(`${name}: ${passes} passed, ${fails} failed`); process.exitCode = fails ? 1 : 0; return fails; }
module.exports = { SITE, lib, source, inflateRaw, calcOf, eq, ok, done };
