// Shared helpers for the F1 Finance site tests. Plain Node (>= 20), no packages.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEMO = path.join(ROOT, 'demo');

// OneDrive (the owner's working copy) can hold a file for a moment: retry reads on EBUSY/EPERM.
function retry(fn) {
  for (let i = 0; ; i++) {
    try { return fn(); } catch (e) {
      if (i < 40 && /EBUSY|EPERM|EACCES|EAGAIN/.test(e.code || '')) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150); continue; }
      throw e;
    }
  }
}
export const readText = p => retry(() => fs.readFileSync(p, 'utf8'));
export const readBin = p => retry(() => fs.readFileSync(p));
export const readJSON = p => JSON.parse(readText(p));
export const exists = p => fs.existsSync(p);

// Demo folders that are demos (have an index.html), optionally by family.
export function demos(re = /^(tax|accounting|audit)/) {
  return fs.readdirSync(DEMO, { withFileTypes: true })
    .filter(d => d.isDirectory() && re.test(d.name) && exists(path.join(DEMO, d.name, 'index.html')))
    .map(d => d.name).sort();
}

export function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// Files tracked by git (what GitHub Pages serves). null when git is unavailable.
let _tracked;
export function tracked() {
  if (_tracked !== undefined) return _tracked;
  try {
    _tracked = new Set(execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { maxBuffer: 1 << 28 }).toString().split('\0').filter(Boolean));
  } catch { _tracked = null; }
  return _tracked;
}
export const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

// ---- zip / xlsx / docx / pdf text -----------------------------------------------------------------------------
export function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const n = buf.readUInt16LE(eocd + 10); let off = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let k = 0; k < n; k++) {
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28), xlen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32), lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    const lnlen = buf.readUInt16LE(lho + 26), lxlen = buf.readUInt16LE(lho + 28);
    const data = buf.subarray(lho + 30 + lnlen + lxlen, lho + 30 + lnlen + lxlen + csize);
    files[name] = () => (method === 0 ? data : zlib.inflateRawSync(data));
    off += 46 + nlen + xlen + clen;
  }
  return files;
}
export const xmlText = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, c) => String.fromCodePoint(+c)).replace(/&#x([0-9a-f]+);/gi, (m, c) => String.fromCodePoint(parseInt(c, 16))).replace(/&amp;/g, '&');
const colIndex = ref => { const m = /^([A-Z]+)/.exec(ref); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A worksheet (the first, or by name) as rows of cached values (numbers stay numbers). Row/column indexes are 0-based.
export function readXlsx(file, sheetName) {
  const z = unzip(readBin(file));
  const get = n => (z[n] ? z[n]().toString('utf8') : '');
  const shared = [];
  for (const si of get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(xmlText([...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join('')));
  let sheet = 'xl/worksheets/sheet1.xml';
  if (sheetName) {
    const wb = get('xl/workbook.xml'), rels = get('xl/_rels/workbook.xml.rels');
    const m = new RegExp(`<sheet [^>]*name="${escRe(sheetName)}"[^>]*r:id="([^"]+)"`).exec(wb);
    const t = m && (new RegExp(`Id="${m[1]}"[^>]*Target="([^"]+)"`).exec(rels) || new RegExp(`Target="([^"]+)"[^>]*Id="${m[1]}"`).exec(rels));
    if (!t) throw new Error(`no sheet "${sheetName}" in ${file}`);
    sheet = 'xl/' + t[1].replace(/^\/?xl\//, '');
  }
  const rows = [];
  for (const r of get(sheet).matchAll(/<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[2].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+\d+)"/.exec(c[1])[1], t = (/t="([^"]+)"/.exec(c[1]) || [])[1], body = c[2] || '';
      let v = null;
      if (t === 'inlineStr') v = xmlText([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));
      else { const vm = /<v>([\s\S]*?)<\/v>/.exec(body); if (vm) v = t === 's' ? shared[+vm[1]] : (t === 'str' || t === 'e') ? xmlText(vm[1]) : t === 'b' ? vm[1] === '1' : Number(vm[1]); }
      row[colIndex(ref)] = v;
    }
    rows[+r[1] - 1] = row;
  }
  return rows;
}

// .docx: body paragraphs (text) and tables (rows of cell texts).
export function readDocx(file) {
  const z = unzip(readBin(file)); const x = z['word/document.xml']().toString('utf8');
  const ptext = p => xmlText([...p.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join(''));
  const paras = s => [...s.matchAll(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>|<w:p\/>/g)].map(p => ptext(p[0]));
  const tables = [...x.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map(t => [...t[1].matchAll(/<w:tr(?: [^>]*)?>([\s\S]*?)<\/w:tr>/g)]
    .map(r => [...r[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map(c => paras(c[1]).join('\n').trim())));
  return { paragraphs: paras(x.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, '')), tables };
}

// All visible text of an office file (every xml part), for term scans.
export function officeText(file) {
  const z = unzip(readBin(file));
  return Object.keys(z).filter(n => n.endsWith('.xml')).map(n => xmlText(z[n]().toString('utf8').replace(/<[^>]+>/g, ' '))).join(' ');
}

// Best-effort PDF text: literal strings drawn by Tj/TJ in every (Flate) stream. ReportLab-style standard-font PDFs
// come out readable; hex/CID-encoded text is skipped.
export function pdfText(file) {
  const b = readBin(file); const out = [];
  let i = 0;
  while ((i = b.indexOf('stream', i)) >= 0) {
    if (b.toString('latin1', i - 3, i) === 'end') { i += 6; continue; }
    let s = i + 6; if (b[s] === 0x0d) s++; if (b[s] === 0x0a) s++;
    const e = b.indexOf('endstream', s); if (e < 0) break;
    const head = b.toString('latin1', Math.max(0, i - 400), i); const dict = head.slice(head.lastIndexOf('<<'));
    let data = b.subarray(s, e);
    const filters = (/\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(dict) || [, ''])[1].match(/\/\w+/g) || [];
    for (const f of filters) {
      if (!data) break;
      if (f === '/ASCII85Decode' || f === '/A85') data = a85(data);
      else if (f === '/FlateDecode' || f === '/Fl') { try { data = zlib.inflateSync(data); } catch { try { data = zlib.inflateSync(data, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch { data = null; } } }
      else data = null; // image or other filters: not text
    }
    if (data) {
      const t = data.toString('latin1');
      // text objects only (BT ... ET); other streams (images, fonts, attachments) are skipped
      const lit = s => s.slice(1, -1).replace(/\\(\d{1,3})/g, (x, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\([\s\S])/g, (x, c) => ({ n: '\n', r: '\r', t: '\t', b: '', f: '' }[c] ?? c));
      const STR = /\((?:\\[\s\S]|[^\\)])*\)/g;
      // a TJ array is one run of text (its pieces are kerning splits); separate Tj/'/" shows are separate runs
      if (/T[jJ]/.test(t)) for (const bt of t.matchAll(/(?:^|\s)BT\s([\s\S]*?)\sET(?=\s|$)/g)) for (const op of bt[1].matchAll(/\[((?:\((?:\\[\s\S]|[^\\)])*\)|[^\]])*)\]\s*TJ|(\((?:\\[\s\S]|[^\\)])*\))\s*(?:Tj|'|")/g)) out.push(op[1] != null ? [...op[1].matchAll(STR)].map(m => lit(m[0])).join('') : lit(op[2]));
    }
    i = e + 9;
  }
  return out.join(' ');
}
function a85(buf) {
  let s = buf.toString('latin1').replace(/\s/g, ''); if (s.startsWith('<~')) s = s.slice(2); const end = s.indexOf('~>'); if (end >= 0) s = s.slice(0, end);
  const out = []; let grp = [];
  const flush = (g, n) => { let v = 0; for (const c of g) v = v * 85 + (c - 33); for (let k = 0; k < n; k++) out.push((v >>> (24 - 8 * k)) & 255); };
  for (const ch of s) {
    if (ch === 'z' && !grp.length) { out.push(0, 0, 0, 0); continue; }
    grp.push(ch.charCodeAt(0)); if (grp.length === 5) { flush(grp, 4); grp = []; }
  }
  if (grp.length) { const n = grp.length - 1; while (grp.length < 5) grp.push(117); flush(grp, n); }
  return Buffer.from(out);
}

// ---- reporting --------------------------------------------------------------------------------------------------
export function suite(name) {
  const res = { name, pass: 0, fail: 0, known: 0, lines: [] };
  const fmt = d => (d ? '\n        ' + String(d).split('\n').join('\n        ') : '');
  const t = {
    ok(cond, msg, detail) {
      if (cond) { res.pass++; if (process.env.VERBOSE) res.lines.push('  ok    ' + msg); }
      else { res.fail++; res.lines.push('  FAIL  ' + msg + fmt(detail)); }
      return !!cond;
    },
    // A failure that is expected until another piece of work lands. It stays strict (it counts as a failure and
    // fails the run) but is labelled with the reason, and says so when it starts passing.
    expected(cond, msg, reason, detail) {
      if (cond) { res.pass++; res.lines.push('  ok    ' + msg + '  [listed as expected-to-fail (' + reason + '): it passes now, remove the label]'); }
      else { res.fail++; res.known++; res.lines.push('  FAIL  ' + msg + '\n        EXPECTED UNTIL FIXED: ' + reason + fmt(detail)); }
      return !!cond;
    },
    eq(a, b, msg, tol = 0.005) {
      const ok = typeof b === 'number' ? Math.abs(Number(a) - b) < tol : String(a) === String(b);
      return t.ok(ok, msg + (ok ? '' : ` (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`));
    },
    note(msg) { res.lines.push('  note  ' + msg); },
    done() {
      console.log(`\n## ${name}: ${res.pass} passed, ${res.fail} failed${res.known ? ` (${res.known} of them expected until fixed)` : ''}`);
      if (res.lines.length) console.log(res.lines.join('\n'));
      return res;
    },
    res,
  };
  return t;
}
export const money = v => (v < 0 ? '-$' : '$') + Math.abs(Number(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = s => Number(String(s).replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'));
export const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// true when the module is the script node was started with
export const isMain = url => { try { return !!process.argv[1] && fs.realpathSync(fileURLToPath(url)) === fs.realpathSync(process.argv[1]); } catch { return false; } };
