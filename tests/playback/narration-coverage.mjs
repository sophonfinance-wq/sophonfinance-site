// Narration coverage: plays every narrated demo to the end in headless Chrome/Edge (DevTools Protocol, no packages)
// and checks that its spoken lines actually play.
//
//   node tests/playback/narration-coverage.mjs [--demos=tax-941,accounting|all] [--conc=8] [--via-home=tax-941,audit]
//                                              [--width=1440] [--json=out.json] [--require-browser]
//
// Each demo is opened the way a visitor opens it: --via-home ids go through the homepage chooser (index.html, the
// machine tab, the subject button, "Run the demo") into the #demoFrame iframe; the rest open demo/<id>/ directly.
// One tap on the run button, then the replay plays at its normal speed to the results. From window.__ffNarration it
// records the cues that played vs the cues a full run should play (every cue except "skip"), the stages seen vs the
// stage numbers the cues expect, whether the closing line played, and any "play blocked".
// A demo FAILS when no cue plays, only the opening line plays, fewer than 80% of its cues play, or the closing
// line never plays. Exit code 0 when every demo passes.
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, extname, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.WebSocket === 'undefined') {
  const r = spawnSync(process.execPath, ['--experimental-websocket', ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : (process.argv.includes('--' + k) ? true : d); };
const INDEX = JSON.parse(readFileSync(join(ROOT, 'demo/narration/index.json'), 'utf8')).demos;
let demos = String(arg('demos', 'all')); demos = demos === 'all' ? INDEX : demos.split(',');
const VIA_HOME = new Set(String(arg('via-home', 'tax-941,accounting-bankrec,audit-cash')).split(',').filter(Boolean));
const WIDTH = +arg('width', 1440), CONC = +arg('conc', 8), MAX_MS = +arg('max', 9 * 60) * 1000;
// --strict-autoplay: the browser default (sound only after a real tap) instead of --autoplay-policy=no-user-gesture-required;
// the run button is then pressed with real mouse events, the way a visitor taps it
const STRICT = !!arg("strict-autoplay", false), TAP = STRICT || !!arg("tap", false);
// --fast-tap: tap the run button the moment it shows, before the narration has loaded; --latency=ms: a slow phone network
// --slow-narration=ms: the test server holds back narration.js and the cue files, so the visitor taps the run button
// before the narration is ready (what a phone on a slow connection sees); implies --fast-tap
const SLOWN = +arg("slow-narration", 0), FAST = SLOWN > 0 || !!arg("fast-tap", false), LATENCY = +arg("latency", 0);
const REQUIRE = !!arg('require-browser', false) || process.env.CI === 'true';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function findBrowser() {
  const c = [process.env.CHROME_PATH, process.env.BROWSER_PATH];
  if (process.platform === 'win32') {
    const pf = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const b of pf) c.push(join(b, 'Google/Chrome/Application/chrome.exe'), join(b, 'Microsoft/Edge/Application/msedge.exe'));
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      const w = spawnSync('which', [n], { encoding: 'utf8' }); if (w.status === 0 && w.stdout.trim()) c.push(w.stdout.trim());
    }
  }
  return c.find(p => p && existsSync(p));
}
const BROWSER = findBrowser();
if (!BROWSER) { console.log(`narration-coverage: no Chrome, Chromium or Edge found${REQUIRE ? '' : ': skipped'}`); process.exit(REQUIRE ? 1 : 0); }

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (SLOWN && /\/demo\/narration(\.js|\/.*\.json)$/.test(p)) await sleep(SLOWN);
    let f = normalize(join(ROOT, p)); if (!f.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end(); }
    let st; try { st = await stat(f); } catch { res.writeHead(404); return res.end(); }
    if (st.isDirectory()) { if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); } f = join(f, 'index.html'); }
    let b; for (let i = 0; ; i++) { try { b = await readFile(f); break; } catch (e) { if (i < 20 && /EBUSY|EPERM|EACCES/.test(e.code)) { await sleep(150); continue; } throw e; } }
    res.writeHead(200, { 'Content-Type': T[extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': b.length, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : b);
  } catch { try { res.writeHead(500); res.end(); } catch { } }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const prof = mkdtempSync(join(os.tmpdir(), 'f1-narration-'));
const flags = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-dev-shm-usage', '--disable-features=CalculateNativeWinOcclusion',
  `--user-data-dir=${prof}`, '--remote-debugging-port=0', `--window-size=${WIDTH},900`, 'about:blank'];
if (process.platform === 'linux') flags.unshift('--no-sandbox');
const br = spawn(BROWSER, flags, { stdio: 'ignore' });
let CDP_PORT = 0;
for (let i = 0; i < 120 && !CDP_PORT; i++) { try { CDP_PORT = +readFileSync(join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await sleep(250); } }
if (!CDP_PORT) { console.log('narration-coverage: the browser did not start'); try { br.kill(); } catch { } server.close(); process.exit(1); }
for (let i = 0; i < 80; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch { await sleep(250); } }
console.log(`narration-coverage: ${BROWSER}, site ${BASE}, ${demos.length} demos, ${CONC} at a time`);

async function openPage() {
  const t = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || { error: d.error }); pending.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').slice(0, 200));
  };
  await send('Runtime.enable'); await send('Page.enable');
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || r.exceptionDetails.text }; return r.result?.value; };
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: WIDTH < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: WIDTH < 768 });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  if (LATENCY) { await send('Network.enable'); await send('Network.emulateNetworkConditions', { offline: false, latency: LATENCY, downloadThroughput: 1.5e6 / 8 * 10, uploadThroughput: 750e3 / 8 }); }
  return { send, ev, errors, close() { try { send('Page.close'); ws.close(); } catch { } } };
}

const J = JSON.stringify;
// W = the demo's window (the page itself, or the homepage iframe's window)
const PROBE = W => `(() => { const w = ${W}; if (!w || !w.document) return null; const doc = w.document; const S = w.__ffNarration;
  const d = doc.querySelector('section.dialog.is-presentation');
  const pills = d ? [...d.querySelectorAll('.property-overview > *')].map(p => p.className.replace(/\\s+/g, ' ').trim()) : [];
  const alt = d ? !!d.querySelector('[aria-current="step"], .stage.is-active, .is-running') : false;
  const btns = d ? [...d.querySelectorAll('button')].map(b => (b.getAttribute('data-action') || '') + ':' + (b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 24)) : [];
  return { path: w.location.pathname, hasS: !!S, cues: S && S.cues ? S.cues.map(c => ({ id: c.id, trigger: c.trigger })) : null, played: S ? S.played.slice() : [], log: S ? S.log.slice() : [],
    active: S ? S.active : false, ended: S ? S.ended : false, current: S && S.current ? S.current.id : null, pending: S && S.pending ? S.pending.id : null, stage: S ? S.stage : 0,
    pres: !!d, pills, alt, btns }; })()`;

async function runOne(demo) {
  const P = await openPage(); const home = VIA_HOME.has(demo);
  const W = home ? `(document.getElementById('demoFrame') || {}).contentWindow` : 'window';
  const r = { demo, home, notes: [] };
  try {
    if (home) {
      await P.send('Page.navigate', { url: BASE + '/' });
      for (let i = 0; i < 60; i++) { await sleep(250); if (await P.ev(`document.readyState === 'complete'`)) break; }
      await P.ev(`try { localStorage.removeItem('ffNarration'); localStorage.removeItem('ffCaptions'); } catch (e) {}`);
      const m = demo.split('-')[0];
      // the machine tab, then the subject button, then "Run the demo"
      const picked = await P.ev(`(() => { const t = document.querySelector('.demo-sw button[data-m=${J(m)}]'); if (t) t.click();
        const b = document.querySelector('#demoSubj button[data-id=${J(demo)}], button[data-id=${J(demo)}]'); if (!b) return 'no subject button'; b.click();
        const g = document.getElementById('demoGo'); if (!g || g.hidden) return 'no go button'; g.click(); return document.getElementById('demoFrame').getAttribute('src'); })()`);
      r.notes.push('home: ' + picked);
      r.label = await P.ev(`(() => { const b = document.querySelector('button[data-id=${J(demo)}]'); return b ? b.firstChild.textContent : ''; })()`);
    } else {
      await P.send('Page.navigate', { url: `${BASE}/demo/${demo}/` });
      await P.ev(`try { localStorage.removeItem('ffNarration'); localStorage.removeItem('ffCaptions'); } catch (e) {}`);
    }
    // wait for the demo and its cues
    let s = null;
    for (let i = 0; i < 120; i++) { await sleep(250); s = await P.ev(PROBE(W)); if (s && (s.cues || FAST) && await P.ev(`(() => { const w = ${W}; return !!(w && [...w.document.querySelectorAll('button.simple-primary, .simple-primary button')].find(b => b.getBoundingClientRect().width > 1 && !b.disabled)); })()`)) break; }
    if (!s || !s.cues) r.notes.push('cues never loaded (narration ' + (s && s.hasS ? 'running' : 'missing') + ')');
    if (FAST) await sleep(1500); // the page is up and the button works; the narration is still on its way
    // one tap on the run button
    const run = await P.ev(`(() => { const w = ${W}; const b = [...w.document.querySelectorAll('button.simple-primary, .simple-primary button')].find(b => b.getBoundingClientRect().width > 1 && !b.disabled); if (!b) return 'NF'; if (TAP) { const r = b.getBoundingClientRect(), f = w.frameElement ? w.frameElement.getBoundingClientRect() : { left: 0, top: 0 }; w.__ffTapAt = [f.left + r.left + r.width / 2, f.top + r.top + r.height / 2]; } else b.click(); return b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40); })()`.replace("TAP", J(TAP)));
    if (TAP) { const [x, y] = await P.ev(`(${W}).__ffTapAt`); for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await P.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 }); }
    r.run = run;
    const t0 = Date.now(); const pillsSeen = new Map(); let endAt = 0, presSeen = false;
    while (Date.now() - t0 < MAX_MS) {
      await sleep(1000);
      s = await P.ev(PROBE(W)); if (!s) continue;
      if (s.pres) presSeen = true;
      const key = s.pills.length + ' ' + s.pills.join(' | ');
      if (s.pres && !pillsSeen.has(key)) pillsSeen.set(key, Math.round((Date.now() - t0) / 1000));
      if (s.log.some(l => / end screen$/.test(l)) && !s.current && !s.pending) { if (!endAt) endAt = Date.now(); if (Date.now() - endAt > 2500) break; }
      if (presSeen && !s.pres && Date.now() - t0 > 20000) { r.notes.push('replay closed'); break; }
      if (!presSeen && Date.now() - t0 > 25000) { r.notes.push('replay never opened'); break; }
    }
    r.secs = Math.round((Date.now() - t0) / 1000);
    r.state = s;
    r.pillHistory = [...pillsSeen.entries()].slice(0, 40).map(([k, t]) => t + 's ' + k);
  } catch (e) { r.notes.push('aborted: ' + e.message); }
  r.errors = P.errors.slice(0, 5);
  P.close();
  // score it
  const s = r.state || {}; const cues = s.cues || []; const want = cues.filter(c => c.trigger !== 'skip');
  const played = (s.played || []).filter(id => want.some(c => c.id === id));
  const startCue = cues.find(c => c.trigger === 'start'), endCue = cues.find(c => c.trigger === 'end');
  const expStages = [...new Set(want.map(c => (/^stage:(\d+)/.exec(c.trigger) || [])[1]).filter(Boolean).map(Number))].sort((a, b) => a - b);
  const seenStages = [...new Set((s.log || []).map(l => (/ stage (\d+)$/.exec(l) || [])[1]).filter(Boolean).map(Number))].sort((a, b) => a - b);
  const blocked = (s.log || []).filter(l => /play blocked|audio error|stall/.test(l));
  r.score = { played: played.length, total: want.length, missed: want.filter(c => !played.includes(c.id)).map(c => c.trigger), expStages, seenStages,
    endPlayed: !!(endCue && played.includes(endCue.id)), blocked, endScreen: (s.log || []).some(l => / end screen$/.test(l)) };
  const sc = r.score, onlyStart = sc.played === 1 && startCue && played.includes(startCue.id);
  r.fail = !sc.total ? 'no cues' : sc.played === 0 ? 'no cue played' : onlyStart ? 'only the opening line played' : sc.played / sc.total < 0.8 ? `only ${sc.played}/${sc.total} played` : !sc.endPlayed ? 'closing line never played' : '';
  console.log(`${r.fail ? 'FAIL' : 'ok  '} ${demo.padEnd(24)} ${String(sc.played).padStart(2)}/${String(sc.total).padEnd(2)} stages seen [${sc.seenStages}] expected [${sc.expStages}] end:${sc.endPlayed ? 'y' : 'n'}${sc.blocked.length ? ' BLOCKED ' + sc.blocked.length : ''}${home ? ' (via homepage)' : ''} ${r.secs}s${r.fail ? '  <- ' + r.fail + (sc.missed.length ? '; missed ' + sc.missed.join(' ') : '') : ''}${r.notes.length ? '  [' + r.notes.join('; ') + ']' : ''}`);
  return r;
}

const out = []; let next = 0;
await Promise.all(Array.from({ length: Math.min(CONC, demos.length) }, async () => { while (next < demos.length) { const d = demos[next++]; out.push(await runOne(d)); } }));
const failed = out.filter(r => r.fail);
console.log('\n##### NARRATION COVERAGE');
for (const d of demos) { const r = out.find(x => x.demo === d); console.log(`${r.fail ? 'FAIL' : 'ok  '} ${d.padEnd(24)} ${r.score.played}/${r.score.total}${r.fail ? '  ' + r.fail : ''}`); }
console.log(failed.length ? `\n${failed.length} of ${out.length} demos FAILED` : `\nall ${out.length} demos narrate`);
const jp = arg('json', null); if (jp) writeFileSync(String(jp), JSON.stringify(out, null, 1));
try { br.kill(); } catch { } server.close();
await sleep(500); try { rmSync(prof, { recursive: true, force: true }); } catch { }
process.exit(failed.length ? 1 : 0);
