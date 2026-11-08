// (a) Content scan, no browser:
//   1. "andfile" and other glued / split sentence joins in the demo bundles (JSX text next to an expression), and
//      double spaces in the visible intro and page description text;
//   2. every image/video a demo references exists with the exact same case and is tracked by git (GitHub Pages is
//      case-sensitive), including systems.json images; brand/hero-loop.mp4 is the one known absence (see ASSET_OK);
//   3. the listed-term rules (tests/lib/terms.mjs) over everything a demo can show: bundle strings, recorded data,
//      systems.json, active narration captions, and the text of its xlsx/docx/pdf/eml files.
//
//   node tests/content.test.mjs [demo ...] [--verbose]
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DEMO, ROOT, demos, walk, readText, readJSON, exists, tracked, rel, officeText, pdfText, suite, isMain } from './lib/util.mjs';
import { parse, stringLiterals, joins } from './lib/js.mjs';
import { scanTerms } from './lib/terms.mjs';

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose') || !!process.env.VERBOSE;
const only = args.filter(a => !a.startsWith('--'));
const IDS = only.length ? only : demos();

// Known, documented asset absences. brand/hero-loop.mp4: the tax and accounting demo intros ask for a looping film the
// site does not ship; demo/tweaks.js catches the failed load and keeps the poster image (a runtime fallback), so the
// missing file is never seen as a broken frame.
const ASSET_OK = new Map([[/^demo\/(tax|accounting)[^/]*\/brand\/hero-loop\.mp4$/, 'brand/hero-loop.mp4 is not shipped on purpose: demo/tweaks.js falls back to the poster image']]);
// Sentences split into text nodes on purpose: short field labels in the mail views ("To " + recipient).
const SPLIT_OK = [/^"(To|Send to) ",/];
// A word and its plural ending (" invoice" + (n > 1 ? "s" : "")) are meant to touch.
const GLUE_OK = [/,\s*[\w$.]+\s*[><=!]+=?\s*[\w$.]+\s*\?\s*"e?s"\s*:\s*""$/];
// Listed terms still present in the audit demos, which Agent AUDIT owns (scratchpad audcommon). Strict (they fail the run),
// labelled until the audit design data takes the same renames as the tax demos.
const TERMS_PENDING = id => /^audit/.test(id) ? 'owned by Agent AUDIT (scratchpad audcommon): the audit design data still has the J-2619 and J-2625 job names the tax demos renamed (Rainier Commons Building B, Juniper Ridge Business Park, 9 flex buildings) and one listed word in the audit intro' : null;

export function run(ids = IDS) {
  const t = suite('content: typos, sentence joins, assets, listed terms');
  const git = tracked(), ignored = gitIgnored();
  if (!git) t.note('git is not available: the "tracked by git" part of the asset check is skipped');
  const uncommitted = [];

  for (const id of ids) {
    const base = path.join(DEMO, id);
    const bundles = exists(path.join(base, 'assets')) ? fs.readdirSync(path.join(base, 'assets')).filter(f => f.endsWith('.js')).map(f => path.join(base, 'assets', f)) : [];
    const html = readText(path.join(base, 'index.html'));

    // ---- 1. andfile, joins, double spaces --------------------------------------------------------------------
    const visible = []; // [where, text]
    for (const b of bundles) {
      const src = readText(b); let ast;
      try { ast = parse(src); } catch (e) { t.ok(false, `${id}: ${path.basename(b)} parses`, e.message); continue; }
      for (const j of joins(src, ast)) {
        if (j.kind === 'SPLIT' && SPLIT_OK.some(r => r.test(j.ctx))) continue;
        if (j.kind === 'GLUED' && GLUE_OK.some(r => r.test(j.ctx))) continue;
        t.ok(false, `${id}: no ${j.kind === 'GLUED' ? 'glued' : 'split'} sentence in ${rel(b)}`, j.ctx);
      }
      for (const s of stringLiterals(src, ast)) visible.push([rel(b), s]);
    }
    const meta = [...html.matchAll(/<meta\s+(?:name|property)="(?:description|og:description|twitter:description)"\s+content="([^"]*)"/g)].map(m => m[1]);
    const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || '';
    for (const s of [...meta, title]) visible.push([rel(path.join(base, 'index.html')), s]);
    const andfile = visible.filter(([, s]) => /andfile|andsign|reviewand|\b(?:and|or|to|the)(?:file|sign)\b/i.test(s));
    t.ok(!andfile.length, `${id}: no "andfile"-style glued words`, andfile.slice(0, 3).map(([w, s]) => `${w}: ${s.slice(0, 160)}`).join('\n'));
    // double spaces in prose: the page description and title, and the demo's intro and home note sentences
    const prose = visible.filter(([w, s]) => (w.endsWith('index.html') || /This web demo|Built by Enasal|Prepares a draft|recorded run|plays back/i.test(s)) && !/\n/.test(s));
    const dbl = prose.filter(([, s]) => /\S {2,}\S/.test(s));
    t.ok(!dbl.length, `${id}: no double spaces in the intro and page description`, dbl.slice(0, 3).map(([w, s]) => `${w}: ${JSON.stringify(s.slice(0, 160))}`).join('\n'));
    // the maker line names the brand (accounting family; see tests/README.md for the tax and audit footers)
    if (/^accounting/.test(id)) {
      const old = visible.filter(([, s]) => /with Sophon Finance/.test(s)).concat(exists(path.join(base, 'data', 'demo.json')) && /with Sophon Finance/.test(readText(path.join(base, 'data', 'demo.json'))) ? [['data/demo.json', 'footer']] : []);
      t.ok(!old.length, `${id}: maker line reads "Built by Enasal, with F1 Finance"`, old.slice(0, 3).map(([w, s]) => `${w}: ${s.slice(0, 120)}`).join('\n'));
    }

    // ---- 2. assets: exact case and tracked ---------------------------------------------------------------------
    const refs = new Set();
    for (const f of [path.join(base, 'index.html'), ...bundles, ...(exists(path.join(base, 'assets')) ? fs.readdirSync(path.join(base, 'assets')).filter(f => f.endsWith('.css')).map(f => path.join(base, 'assets', f)) : [])]) {
      for (const m of readText(f).matchAll(/["'`(](?:\.\/)?(brand\/[^"'`)\s${}]+\.(?:svg|png|jpe?g|webp|gif|mp4|ico))/g)) refs.add(`demo/${id}/${m[1]}`);
      for (const m of readText(f).matchAll(/(?:src|href)="(?:\.\/)?((?:assets|brand|data)\/[^"?#]+)"/g)) refs.add(`demo/${id}/${m[1]}`);
    }
    if (exists(path.join(base, 'systems.json'))) {
      const S = readJSON(path.join(base, 'systems.json'));
      if (S.company && S.company.logo) refs.add(`demo/${id}/brand/${S.company.logo}`);
      (function w(o) { if (typeof o === 'string') { if (/^(data|brand)\/.*\.(svg|png|jpe?g|webp|gif|pdf|xlsx|docx|eml)$/i.test(o)) refs.add(`demo/${id}/${decodeURIComponent(o)}`); } else if (o && typeof o === 'object') Object.values(o).forEach(w); })(S);
    }
    for (const m of [...html.matchAll(/(?:src|href)="\.\.\/([^"?#]+)"/g)]) refs.add(`demo/${m[1]}`);
    const missing = [];
    for (const r of refs) {
      const known = [...ASSET_OK].find(([re]) => re.test(r));
      const ok = exactExists(r);
      if (known) { if (!ok && VERBOSE) t.note(`${r}: ${known[1]}`); continue; }
      if (!ok) missing.push('missing (or the case differs): ' + r);
      else if (git && !git.has(r)) { if (ignored.has(r)) missing.push('ignored by git (GitHub Pages would 404): ' + r); else uncommitted.push(r); }
    }
    t.ok(!missing.length, `${id}: ${refs.size} referenced assets exist with exact case and are tracked`, missing.slice(0, 8).join('\n'));
    const logo = path.join(base, 'brand', 'HANGS-Construction-color.svg');
    if (exists(logo)) t.ok(/^<svg[\s>]|^<\?xml/.test(readText(logo).trimStart()), `${id}: HANGS logo is an SVG`);

    // ---- 3. listed terms ------------------------------------------------------------------------------------------
    const hits = [];
    const scan = (where, text) => { for (const h of scanTerms(text.replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]*/g, ' ').replace(/[A-Za-z0-9+/=]{80,}/g, ' '))) hits.push(`${h.label}: "${h.match}" in ${where}: …${h.context}…`); };
    for (const [w, s] of visible) scan(w, s);
    for (const f of walk(path.join(base, 'data')).concat(exists(path.join(base, 'systems.json')) ? [path.join(base, 'systems.json')] : [])) {
      const ext = path.extname(f).toLowerCase();
      try {
        if (['.json', '.html', '.eml', '.csv', '.txt', '.md'].includes(ext)) scan(rel(f), readText(f));
        else if (['.xlsx', '.docx'].includes(ext)) scan(rel(f), officeText(f));
        else if (ext === '.pdf') scan(rel(f), pdfText(f));
      } catch (e) { hits.push(`unreadable ${rel(f)}: ${e.message}`); }
    }
    const cues = path.join(DEMO, 'narration', id, 'cues.json');
    if (exists(cues)) for (const c of (readJSON(cues).cues || [])) scan(`narration ${id}/${c.id}`, c.text || '');
    const uniq = [...new Set(hits)];
    (TERMS_PENDING(id) ? (c, m, d) => t.expected(c, m, TERMS_PENDING(id), d) : t.ok)(!uniq.length, `${id}: no listed terms (${uniq.length} hit${uniq.length === 1 ? '' : 's'})`, (VERBOSE ? uniq : uniq.slice(0, 6)).join('\n') + (!VERBOSE && uniq.length > 6 ? `\n… ${uniq.length - 6} more (--verbose)` : ''));
  }
  // new files of a rebuild are untracked until the next commit (in CI everything checked out is tracked)
  if (uncommitted.length) t.note(`${uncommitted.length} referenced files exist but are not committed yet (${uncommitted.slice(0, 3).join(', ')}${uncommitted.length > 3 ? ', …' : ''}): commit them with the rebuild`);
  return t.done();
}

function gitIgnored() {
  try { return new Set(execFileSync('git', ['-C', ROOT, 'ls-files', '-o', '-i', '--exclude-standard', '-z', 'demo'], { maxBuffer: 1 << 28 }).toString().split('\0').filter(Boolean)); } catch { return new Set(); }
}

function exactExists(relPath) { // case-exact walk from the repo root
  let dir = ROOT;
  for (const part of relPath.split('/')) { let names; try { names = fs.readdirSync(dir); } catch { return false; } if (!names.includes(part)) return false; dir = path.join(dir, part); }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const r = run();
  process.exit(r.fail ? 1 : 0);
}
