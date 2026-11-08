// (e) Playback regression test: drives each demo in headless Chrome/Edge over the DevTools Protocol (no packages).
//
//   node tests/playback/playback.mjs [--demos=tax-941,accounting,...|all] [--widths=1440,500,390] [--quick] [--shots]
//                                    [--conc=3] [--require-browser]
//   npm run test:playback        every demo at 1440, 500 and 390 px
//   npm test                     a fast subset (see SUBSET below) when a browser is available
//
// Browser: $CHROME_PATH, else Google Chrome / Chromium / Microsoft Edge from the usual install places. Without one the
// test is skipped (exit 0) unless --require-browser (or CI=true) is given.
//
// For each demo and width it checks:
//   1. one tap on the run button opens the replay and it plays (Pause / Skip controls show);
//   2. a document close-up shows a visible close button and Escape closes only the close-up: the replay stays open
//      and keeps playing;
//   3. a view opened inside the replay (Details) or a dialog over it: Escape closes only that;
//   4. after "Skip to Results" no document close-up covers the results (checked for 12 s), and the results stay up;
//   5. "Reopen document" opens the viewer with a visible close button; Escape closes only the viewer;
//   6. Client Systems and "Try your own numbers" open over the results; Escape closes only them; the results
//      controls do not overlap;
//   7. Escape with nothing else open leaves the results up (never closes the replay or returns it to in-progress);
//   8. narration: the caption bar does not overlap the replay window; tapping the caption hides captions;
//   9. the close button still exits the replay; no console errors along the way.
// Exit code 0 when every check passes, 1 otherwise.
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, extname, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node 20 has WebSocket only behind a flag: re-run this script with it.
if (typeof globalThis.WebSocket === 'undefined') {
  const r = spawnSync(process.execPath, ['--experimental-websocket', ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : (process.argv.includes('--' + k) ? true : d); };
const ALL = readdirDemos();
// the fast subset run by `npm test`: the demos the owner's findings named (941 draft PDF, 1099 vendor master,
// 1040 prior-year PDF, AP review with its policy book) on desktop, and the 941 on a phone
const SUBSET = 'tax-941@1440,tax-1099@1440,tax-1040@1440,accounting@1440,tax-941@390';
let jobsArg = arg('jobs', null);
let demos = String(arg('demos', 'tax-941,tax-1099,tax-1040,accounting,accounting-cashflow,audit-wip'));
demos = demos === 'all' ? ALL : demos.split(',');
const widths = String(arg('widths', '1440,500,390')).split(',').map(Number);
const SHOTS = !!arg('shots', false), QUICK = !!arg('quick', false);
const REQUIRE = !!arg('require-browser', false) || process.env.CI === 'true';
const OUT = join(os.tmpdir(), 'f1-playback-shots'); if (SHOTS) { mkdirSync(OUT, { recursive: true }); console.log('screenshots: ' + OUT); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function readdirDemos() { return readdirSync(ROOT + '/demo', { withFileTypes: true }).filter(d => d.isDirectory() && /^(tax|accounting|audit)/.test(d.name) && existsSync(ROOT + '/demo/' + d.name + '/index.html')).map(d => d.name).sort(); }

function findBrowser() {
  const c = [process.env.CHROME_PATH, process.env.BROWSER_PATH];
  if (process.platform === 'win32') {
    const pf = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const b of pf) c.push(join(b, 'Google/Chrome/Application/chrome.exe'), join(b, 'Microsoft/Edge/Application/msedge.exe'));
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      const w = spawnSync('which', [n], { encoding: 'utf8' }); if (w.status === 0 && w.stdout.trim()) c.push(w.stdout.trim());
    }
  }
  return c.find(p => p && existsSync(p));
}
const BROWSER = findBrowser();
if (!BROWSER) {
  console.log(`playback: no Chrome, Chromium or Edge found (set CHROME_PATH)${REQUIRE ? '' : ': skipped'}`);
  process.exit(REQUIRE ? 1 : 0);
}

// ---------- static server (GitHub Pages-like, case-sensitive paths) ----------
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
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

// ---------- browser ----------
const prof = mkdtempSync(join(os.tmpdir(), 'f1-playback-'));
const flags = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-dev-shm-usage',
  `--user-data-dir=${prof}`, '--remote-debugging-port=0', '--window-size=1440,900', 'about:blank'];
if (process.platform === 'linux') flags.unshift('--no-sandbox'); // CI runners cannot use the setuid sandbox
const edge = spawn(BROWSER, flags, { stdio: 'ignore' });
let CDP_PORT = 0;
for (let i = 0; i < 120 && !CDP_PORT; i++) { try { CDP_PORT = +readFileSync(join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await sleep(250); } }
if (!CDP_PORT) { console.log('playback: the browser did not start: ' + BROWSER); try { edge.kill(); } catch { } server.close(); process.exit(1); }
for (let i = 0; i < 80; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch { await sleep(250); } }
console.log(`playback: ${BROWSER} (DevTools port ${CDP_PORT}), site ${BASE}`);

async function openPage() {
  const t = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || { error: d.error }); pending.delete(d.id); return; }
    const P = d.params;
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (P.exceptionDetails.exception?.description || P.exceptionDetails.text || '').slice(0, 240));
    if (d.method === 'Runtime.consoleAPICalled' && P.type === 'error') errors.push('console.error: ' + P.args.map(a => a.value ?? a.description).join(' ').slice(0, 240));
    if (d.method === 'Log.entryAdded' && P.entry.level === 'error' && !/favicon|chrome-extension|DOMMonitor/.test(P.entry.text + P.entry.url)) errors.push('log: ' + P.entry.text.slice(0, 200) + ' ' + (P.entry.url || ''));
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || r.exceptionDetails.text }; return r.result?.value; };
  const key = async k => { const c = { Escape: ['Escape', 27] }[k]; await send('Input.dispatchKeyEvent', { type: 'keyDown', key: c[0], code: c[0], windowsVirtualKeyCode: c[1] }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: c[0], code: c[0], windowsVirtualKeyCode: c[1] }); };
  const tap = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
  return {
    errors, send, ev, key, tap,
    async viewport(w) { const m = w < 768; await send('Emulation.setDeviceMetricsOverride', { width: w, height: m ? 844 : 900, deviceScaleFactor: m ? 2 : 1, mobile: m }); },
    async go(url) { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(250); if (await ev(`document.readyState === 'complete' && !!document.querySelector('#root') && document.querySelector('#root').innerText.trim().length > 20`) === true) break; } await sleep(900); },
    async shot(p) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(p, Buffer.from(r.data, 'base64')); },
    close() { try { send('Page.close'); ws.close(); } catch { } },
  };
}

// ---------- page probes ----------
const J = JSON.stringify;
const CLICK = (re, scope = 'document') => `(() => { const re = new RegExp(${J(re)}, 'i'); const vis = e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const e = [...${scope}.querySelectorAll('button, a, [role=button]')].filter(vis).find(e => re.test((e.getAttribute('aria-label') || e.innerText || '').replace(/\\s+/g, ' ').trim()));
  if (!e) return 'NF'; if (e.disabled) return 'DISABLED'; e.click(); return (e.innerText || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50); })()`;
const STATE = `(() => { const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const d = document.querySelector('section.dialog.is-presentation');
  const lab = b => (b.getAttribute('aria-label') || b.textContent || '').replace(/\\s+/g, ' ').trim();
  const bs = d ? [...d.querySelectorAll('button')].filter(vis) : [];
  const playing = !!(d && (d.querySelector('[data-action="playback-pause"],[data-action="playback-skip"],[data-action="pause-run"],[data-action="resume-run"],[data-action="skip-to-results"]') || bs.some(b => /^(Pause|Resume|Skip to (the End|Results))$/i.test(lab(b)))));
  const results = !!(d && !playing && bs.some(b => /^(Review Figures|Replay)/i.test(lab(b))));
  const cards = [...document.querySelectorAll('.flight-layer:not(.ffv-layer) .flight-card, .flight-layer:not(.ffv-layer) .tape-flight')].filter(c => { const s = getComputedStyle(c.closest('.flight-layer')); const cs = getComputedStyle(c); return vis(c) && s.visibility !== 'hidden' && +s.opacity > 0.05 && +cs.opacity > 0.3; });
  const x = document.querySelector('.ffv-x.is-on');
  const dialogs = [...document.querySelectorAll('section.dialog')].filter(vis).length;
  const dock = document.querySelector('.ffn-dock');
  return { pres: !!d, playing, results, cards: cards.length, cardTitle: cards[0] ? (cards[0].querySelector('.flight-label-text') || cards[0]).innerText.replace(/\\s+/g, ' ').slice(0, 60) : '',
    closeBtn: !!x && vis(x), dialogs, ffPast: document.documentElement.classList.contains('ff-past'),
    chip: vis(document.querySelector('.ff-doc-reopen')), viewer: vis(document.querySelector('.ffv-ov:not([hidden]) .ffv-panel')), viewerClose: vis(document.querySelector('.ffv-ov:not([hidden]) .ffv-close')),
    viewerDoc: vis(document.querySelector('.ffv-ov:not([hidden]) .ffv-layer .flight-card')),
    systems: vis(document.querySelector('.ffs-ov:not([hidden]) .ffs-panel')),
    dock: !!(dock && !dock.hidden), bar: document.documentElement.classList.contains('ffn-bar'), dockTop: dock && !dock.hidden ? Math.round(dock.getBoundingClientRect().top) : null,
    presBottom: d ? Math.round(d.getBoundingClientRect().bottom) : null, capText: dock ? (dock.querySelector('.ffn-cap p') || {}).textContent || '' : '' }; })()`;
// is any document close-up drawn over the results panel?
const COVERED = `(() => { const d = document.querySelector('section.dialog.is-presentation'); if (!d) return 'no replay';
  const panel = d.querySelector('.calc-panel, .property-result, .run-panel') || d; const r = panel.getBoundingClientRect(); const hits = [];
  for (const fx of [.25, .5, .75]) for (const fy of [.3, .5, .7]) { const x = r.left + r.width * fx, y = Math.max(r.top, 0) + Math.min(r.height, innerHeight) * fy;
    const top = document.elementFromPoint(x, y); if (top && top.closest('.flight-layer:not(.ffv-layer)')) hits.push(top.className); }
  return hits.length ? 'covered by ' + hits[0] : 'clear'; })()`;

// ---------- the test ----------
const results = []; let failures = 0;
async function runOne(demo, width) {
  const log = [], fails = [];
  const ok = (cond, msg) => { log.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); return cond; };
  const P = await openPage(); await P.viewport(width);
  const tag = `${demo}@${width}`;
  try {
    await P.go(`${BASE}/demo/${demo}/`);
    await P.ev(`try { localStorage.removeItem('ffCaptions'); localStorage.removeItem('ffNarration'); } catch (e) {}`);
    const hasNarr = await P.ev(`fetch('../narration/index.json').then(r => r.json()).then(j => j.demos.includes(${J(demo)})).catch(() => false)`);
    // 1. one tap runs it
    // the run button is the page's button.simple-primary (labels differ per demo)
    let run = 'NF';
    for (let i = 0; i < 20 && run === 'NF'; i++) {
      run = await P.ev(`(() => { const b = [...document.querySelectorAll('button.simple-primary, .simple-primary button')].find(b => b.getBoundingClientRect().width > 1 && !b.disabled); if (!b) return 'NF'; b.click(); return b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 50); })()`);
      if (run === 'NF') await sleep(500);
    }
    let s; for (let i = 0; i < 40; i++) { await sleep(250); s = await P.ev(STATE); if (s.playing) break; }
    if (!ok(s.pres && s.playing, `one tap opens the replay and it plays (run button "${run}")`)) throw new Error('no replay');

    // 2. a document close-up: visible close button; Escape hides only it
    let card = false;
    for (let i = 0; i < (QUICK ? 40 : 100); i++) { await sleep(250); s = await P.ev(STATE); if (s.cards && s.closeBtn && s.cardTitle) { card = true; break; } if (s.results) break; }
    if (card) {
      ok(true, `close-up "${s.cardTitle}" shows a close button`);
      if (SHOTS) await P.shot(`${OUT}/${demo}-${width}-1-closeup.png`);
      await P.key('Escape'); await sleep(350); s = await P.ev(STATE);
      ok(s.pres && s.playing && s.cards === 0, `Escape closes only the close-up (replay open: ${s.pres}, playing: ${s.playing}, close-ups left: ${s.cards})`);
    } else log.push('NOTE no document close-up came up before the end (nothing to close)');

    // 3. a view opened inside the replay ("Details" = Show All Recorded Steps) or a dialog stacked over it:
    //    Escape closes only that view or dialog, and the replay keeps playing
    const det = await P.ev(CLICK('^(Details|Show All Recorded Steps)$', "document.querySelector('section.dialog.is-presentation')"));
    if (det !== 'NF') {
      await sleep(700); s = await P.ev(STATE);
      const SUB = `(() => { const v = e => e.getBoundingClientRect().width > 1; return [...document.querySelectorAll('section.dialog [aria-expanded="true"]')].filter(v).length + [...document.querySelectorAll('section.dialog button')].filter(b => v(b) && /^(Back to Presentation|Back to Processing View)$/i.test((b.getAttribute('aria-label') || b.textContent || '').trim())).length; })()`;
      const sub = await P.ev(SUB);
      if (s.dialogs >= 2 || sub) {
        // a document close-up drawn over the view is the topmost thing (Escape would close it first): wait for a gap
        for (let i = 0; i < 40 && s.cards; i++) { await sleep(150); s = await P.ev(STATE); }
        // a close-up can still fade in between the check and the key press; Escape then (correctly) closes that
        // close-up first, so allow up to three presses, each closing exactly one thing
        let s2, sub2;
        for (let k = 0; k < 3; k++) { await P.key('Escape'); await sleep(600); s2 = await P.ev(STATE); sub2 = await P.ev(SUB); if (!sub2 || !s2.pres) break; }
        ok(s2.pres && s2.dialogs === 1 && !sub2 && s2.playing, `Escape closes only the "${det}" view (dialogs ${s.dialogs}->${s2.dialogs}, sub-views ${sub}->${sub2}, replay open: ${s2.pres}, playing: ${s2.playing})`);
        s = s2;
      } else log.push(`NOTE "${det}" opened no view or dialog`);
      if (!s.pres) throw new Error('replay closed');
    }

    // 4. Skip to Results: nothing covers the results
    for (let i = 0; i < 40 && !card; i++) { await sleep(250); s = await P.ev(STATE); if (s.cards) break; }
    const sk = await P.ev(CLICK('^Skip to (the End|Results)'));
    ok(sk !== 'NF', `Skip to Results button (${sk})`);
    let cover = 'clear', coverAt = -1, upAt = -1;
    for (let i = 0; i < 48; i++) { await sleep(250); s = await P.ev(STATE); const c = await P.ev(COVERED); if (c !== 'clear' && c !== 'no replay' && coverAt < 0) { cover = c; coverAt = i; } if (s.results && upAt < 0) upAt = i; }
    ok(cover === 'clear', `after Skip nothing covers the results for 12 s (${cover}${coverAt >= 0 ? ' at ' + coverAt * 0.25 + ' s' : ''})`);
    for (let i = 0; i < 120 && !s.results; i++) { await sleep(500); s = await P.ev(STATE); }
    ok(s.results, 'results screen is up after Skip');
    ok(s.cards === 0, `no close-up visible on the results (${s.cards})`);
    if (SHOTS) await P.shot(`${OUT}/${demo}-${width}-2-results.png`);

    // 5. Reopen document -> viewer with close button; Escape closes only the viewer
    if (s.chip) {
      await P.ev(`document.querySelector('.ff-doc-reopen').click()`); await sleep(500); s = await P.ev(STATE);
      ok(s.viewer && s.viewerClose && s.viewerDoc, `"Reopen document" opens the viewer with the document and a close button`);
      if (SHOTS) await P.shot(`${OUT}/${demo}-${width}-3-viewer.png`);
      await P.key('Escape'); await sleep(400); s = await P.ev(STATE);
      ok(!s.viewer && s.pres && s.results, `Escape closes only the viewer (viewer: ${s.viewer}, results: ${s.results})`);
      await P.ev(`document.querySelector('.ff-doc-reopen').click()`); await sleep(400);
      await P.ev(`document.querySelector('.ffv-ov .ffv-close').click()`); await sleep(300); s = await P.ev(STATE);
      ok(!s.viewer && s.results, 'the viewer close button closes it');
    } else ok(!card, `"Reopen document" offered when a document was seen (seen: ${card})`);

    // 6. Client Systems over the results; Escape closes only it
    const sys = await P.ev(`(() => { const b = [...document.querySelectorAll('section.dialog.is-presentation .ff-sys-open')].find(b => b.getBoundingClientRect().width > 1); if (!b) return 'NF'; b.click(); return 'ok'; })()`);
    if (sys === 'ok') {
      await sleep(1500); s = await P.ev(STATE);
      ok(s.systems, 'Client Systems panel opens');
      if (SHOTS) await P.shot(`${OUT}/${demo}-${width}-4-systems.png`);
      await P.key('Escape'); await sleep(400); s = await P.ev(STATE);
      ok(!s.systems && s.pres && s.results, `Escape closes only Client Systems (systems: ${s.systems}, results: ${s.results})`);
    } else log.push('NOTE no Client Systems button in this demo');

    // 6b. the replay controls on the results do not overlap each other (Replay, Details, Systems, Try your own
    //     numbers, Reopen document) and sit inside the screen
    const ovl = await P.ev(`(() => { const c = document.querySelector('section.dialog.is-presentation .property-play-controls'); if (!c) return 'no controls';
      const bs = [...c.children].filter(b => b.getBoundingClientRect().width > 1).map(b => ({ t: (b.innerText || '').replace(/\\s+/g, ' ').trim(), r: b.getBoundingClientRect() }));
      const bad = []; for (let i = 0; i < bs.length; i++) { const a = bs[i].r; if (a.left < -1 || a.right > innerWidth + 1) bad.push(bs[i].t + ' off-screen'); if (a.right - a.left < 24) bad.push(bs[i].t + ' too narrow');
        for (let j = i + 1; j < bs.length; j++) { const b = bs[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(bs[i].t + ' / ' + bs[j].t); } }
      return bad.length ? bad.join('; ') : 'ok ' + bs.map(b => b.t).join(' | '); })()`);
    ok(/^ok|no controls/.test(ovl), `results controls do not overlap (${ovl})`);
    // 6c. "Try your own numbers" (demo/live) where offered: its panel opens and Escape closes only it
    const lv = await P.ev(`(() => { const b = [...document.querySelectorAll('section.dialog.is-presentation .ff-live-open')].find(b => b.getBoundingClientRect().width > 1); if (!b) return 'NF'; b.click(); return 'ok'; })()`);
    if (lv === 'ok') {
      let lo = false; for (let i = 0; i < 30 && !lo; i++) { await sleep(300); lo = await P.ev(`!!(window.__ffLive && window.__ffLive.isOpen())`); }
      ok(lo, '"Try your own numbers" panel opens');
      if (SHOTS) await P.shot(`${OUT}/${demo}-${width}-4b-live.png`);
      await P.key('Escape'); await sleep(500); s = await P.ev(STATE);
      const lo2 = await P.ev(`!!(window.__ffLive && window.__ffLive.isOpen())`);
      ok(!lo2 && s.pres && s.results, `Escape closes only the "Try your own numbers" panel (panel: ${lo2}, results: ${s.results})`);
    }

    // 7. Escape on the results themselves does nothing
    await P.key('Escape'); await sleep(500); await P.key('Escape'); await sleep(700); s = await P.ev(STATE);
    ok(s.pres && s.results && !s.playing, `Escape never closes the results or restarts the replay (open: ${s.pres}, results: ${s.results}, playing: ${s.playing})`);

    // 7b. the figures review inside the results: Escape steps back to the results, never closes the window
    const rv = await P.ev(CLICK('^Review Figures', "document.querySelector('section.dialog.is-presentation')"));
    if (rv !== 'NF') {
      await sleep(1500);
      if (SHOTS) await P.shot(`${OUT}/${demo}-${width}-5-review.png`);
      await P.key('Escape'); await sleep(900); s = await P.ev(STATE);
      ok(s.pres && s.results && !s.playing, `Escape on the figures review returns to the results (open: ${s.pres}, results: ${s.results}, playing: ${s.playing})`);
    }

    // 8. narration caption bar
    if (hasNarr) {
      ok(s.dock, 'narration controls are up');
      if (s.bar) {
        ok(s.dockTop !== null && s.presBottom !== null && s.dockTop >= s.presBottom - 1, `caption bar sits below the replay window (bar top ${s.dockTop}, window bottom ${s.presBottom})`);
        await P.ev(`document.querySelector('.ffn-cap').click()`); await sleep(400); s = await P.ev(STATE);
        const cc = await P.ev(`(() => { const b = document.querySelector('.ffn-cc'); return b && b.getBoundingClientRect().width > 1 ? b.getAttribute('aria-pressed') : 'missing'; })()`);
        ok(!s.bar && s.dock && cc === 'false', `tapping the caption hides captions, CC button offers them back (bar: ${s.bar}, cc: ${cc})`);
        await P.ev(`document.querySelector('.ffn-cc').click()`); await sleep(400); s = await P.ev(STATE);
        ok(s.bar, 'CC brings the captions back');
      } else log.push('NOTE caption bar not shown at the end (no caption spoken)');
    }

    // 9. Exit still works
    await P.ev(`(() => { const d = document.querySelector('section.dialog.is-presentation'); const x = d && d.querySelector('.dialog-close'); if (x) x.click(); })()`);
    await sleep(900); s = await P.ev(STATE);
    if (s.pres) { const c = await P.ev(CLICK('^(Close|Exit|Leave|Yes)')); await sleep(700); s = await P.ev(STATE); }
    ok(!s.pres, 'the close button exits the replay');
    ok(!s.bar && !s.ffPast, 'page state resets after exit (no caption bar, close-ups allowed again)');
  } catch (e) { ok(false, 'aborted: ' + e.message); }
  const errs = P.errors.filter(e => !/DOMMonitor|chrome-extension|net::ERR_ABORTED|play\(\) request was interrupted/.test(e));
  ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  P.close();
  failures += fails.length;
  results.push({ demo, width, fails });
  console.log(`\n=== ${tag}: ${fails.length ? fails.length + ' FAILED' : 'all passed'}\n  ` + log.join('\n  '));
}


const CONC = +(arg('conc', 3));
const jobs = [];
if (arg('subset', false)) jobsArg = SUBSET;
if (jobsArg) for (const j of String(jobsArg).split(',')) { const [d, w] = j.split('@'); jobs.push([d, +(w || 1440)]); }
else for (const w of widths) for (const d of demos) jobs.push([d, w]);
let next = 0;
await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, async () => { while (next < jobs.length) { const [d, w] = jobs[next++]; await runOne(d, w); } }));
console.log('\n##### PLAYBACK SUMMARY');
for (const r of results) console.log(`${r.fails.length ? 'FAIL' : 'ok  '} ${r.demo}@${r.width}${r.fails.length ? ': ' + r.fails.join('; ') : ''}`);
console.log(failures ? `\n${failures} playback check(s) failed` : `\nall playback checks passed (${results.length} demo runs)`);
try { edge.kill(); } catch { } server.close();
await sleep(500); try { rmSync(prof, { recursive: true, force: true }); } catch { }
process.exit(failures ? 1 : 0);
