// (b) Cross-demo consistency, no browser:
//   1. audit storyline: every FY2026 revenue, net income and materiality figure stated by the 13 audit demos (recorded
//      data and active narration) is the canonical one in demo/audit-canonical.json (port of qa/check_audit_canonical.mjs);
//   2. Form 940 vs Forms W-2/W-3: the 940's Q4 is projected and reconciles to the W-2 Q4 to the cent (port of
//      qa/content/check_940_w2.py), and the 940 demo flags it (figures-panel note, "Projected ·" tape rows);
//   3. workers' comp (tax-lni): the rates document adds up and the run used its rates (port of check_lni_rates.py);
//   4. tie-outs between demos from the client-systems datasets: Form 941 vs the W-2 ledger, W-3 box 1, 940 vs W-2
//      ledger, 1120 on the audited FY2026 figures, 1040 dividends = 60% of HANGS's calendar-2025 dividends, estimates' prior-year
//      tax = 1120 total tax, the June 30 fiscal year everywhere, one entity record everywhere (port of systems/ties.js).
//
//   node tests/consistency.test.mjs [--verbose]
import path from 'node:path';
import fs from 'node:fs';
import { DEMO, readText, readJSON, exists, walk, readXlsx, readDocx, suite, money, num, round2, isMain } from './lib/util.mjs';

const VERBOSE = process.argv.includes('--verbose') || !!process.env.VERBOSE;



export function run() {
  const t = suite('consistency: audit figures, 940 vs W-2, L&I rates, cross-demo ties');
  auditCanonical(t);
  form940(t);
  lniRates(t);
  ties(t);
  return t.done();
}

// ---------------------------------------------------------------------------------------------------------------
function auditCanonical(t) {
  const canon = readJSON(path.join(DEMO, 'audit-canonical.json'));
  const DEMOS = ['audit', 'audit-access', 'audit-ar', 'audit-assets', 'audit-cash', 'audit-controls', 'audit-covenant', 'audit-journals',
    'audit-liabilities', 'audit-payroll', 'audit-review', 'audit-subsequent', 'audit-wip'];
  const C = { revenue: num(canon.revenue), net: num(canon.netIncome), mat: num(canon.materiality), pm: num(canon.performanceMateriality), ct: num(canon.clearlyTrivial) };
  const R = canon.interimReview;
  const RV = { revenue: num(R.revenue), mat: num(R.materiality), pm: num(R.performanceMateriality), ct: num(R.clearlyTrivial) };
  // derived values follow the plan
  const p = canon.plan;
  t.eq(Math.floor(C.revenue * Number(p.rate) / p.roundDownTo) * p.roundDownTo, C.mat, 'canonical materiality = revenue x rate, rounded down');
  t.eq(C.mat * Number(p.performance), C.pm, 'canonical performance materiality = materiality x performance share');
  t.eq(C.mat * Number(p.trivial), C.ct, 'canonical clearly trivial = materiality x trivial share');
  t.eq(Math.floor(RV.revenue * Number(p.rate) / p.roundDownTo) * p.roundDownTo, RV.mat, 'interim review materiality follows the same plan');

  const AMT = '\\$([\\d,]+(?:\\.\\d\\d)?)';
  const RULES = [
    ['mat', new RegExp(`(?<![Pp]erformance |of |half of |times |the )\\b[Mm]ateriality,? (?:of |is |at )?(?:proposed at )?${AMT}`, 'g')],
    ['mat', new RegExp(`(?:the |against |of )${AMT}(?:\\.00)? (?:year-end audit’s |year-end audit's )?materiality`, 'g')],
    ['mat', new RegExp(`rounded down,? to ${AMT}`, 'g')],
    ['mat', new RegExp(`year-end audit’s (?:is |stays )?${AMT}`, 'g')],
    ['pm', new RegExp(`[Pp]erformance materiality,? (?:of )?${AMT}`, 'g')],
    ['pm', new RegExp(`the ${AMT} performance materiality`, 'g')],
    ['ct', new RegExp(`[Cc]learly trivial (?:of )?${AMT}`, 'g')],
    ['revenue', new RegExp(`(?:[Cc]ontract revenue|[Rr]evenue)(?: for the year)? ${AMT} x 0\\.5%`, 'g')],
    ['revenue', new RegExp(`(?:year’s|year's|FY2026) ${AMT} of (?:contract )?revenue`, 'g')],
    ['revenue', new RegExp(`0\\.5% of ${AMT} of revenue`, 'g')],
    ['revenue', new RegExp(`(?:audit’s|audit's) (?:is |stays )?\\$[\\d,.]+, on ${AMT} of revenue`, 'g')],
    ['revenue', new RegExp(`revenue \\(?FY2026\\)?,? ${AMT}`, 'gi')],
    ['net', new RegExp(`[Bb]ook income,? ${AMT}`, 'g')],
    ['net', new RegExp(`(?:[Nn]et income|year’s|year's) ${AMT} of (?:net )?income`, 'g')],
    ['net', new RegExp(`${AMT} of net income`, 'g')],
    ['net', new RegExp(`FY2026 net income,? ${AMT}`, 'g')],
    ['net', new RegExp(`[Bb]ook income rose from ${AMT} to ${AMT}`, 'g'), 2],
  ];
  const CELL_RE = /"([^"]{0,40}(?:[Mm]ateriality|[Cc]learly [Tt]rivial)[^"]{0,90})"\s*,\s*"?(-?\d+(?:\.\d+)?)"?/g;
  const cellKind = label => {
    const l = label.toLowerCase();
    if (/threshold|share|half|times|%|rate|percent/.test(l) && !/rounded down/.test(l)) return null;
    if (/performance/.test(l)) return 'pm';
    if (/clearly trivial/.test(l)) return 'ct';
    if (/benchmark/.test(l) && /revenue/.test(l)) return 'revenue';
    if (/benchmark|income/.test(l)) return 'net';
    if (/materiality/.test(l)) return 'mat';
    return null;
  };
  const expected = (demo, kind, ctx) => {
    if (demo === 'audit-review') {
      const interim = /interim review|review materiality|Review Materiality|the quarter|quarter’s|[Rr]eview plan/.test(ctx);
      // the text right before the amount names the year-end audit ("the FY2026 year-end audit’s stays $340,000.00, on $68,989,500.00 of revenue")
      const annual = /(?:year-end audit’s|year-end audit's|FY2026 Year-End Audit)[^$]{0,12}(?:\$[\d,.]+, on )?$/.test(ctx);
      if (kind === 'revenue') return annual ? [C.revenue] : [RV.revenue];
      if (kind === 'mat') return annual ? [C.mat] : interim ? [RV.mat, C.mat] : [RV.mat];
      if (kind === 'pm') return [RV.pm];
      if (kind === 'ct') return [RV.ct];
      return [C.net];
    }
    return { revenue: [C.revenue], mat: [C.mat], pm: [C.pm], ct: [C.ct], net: [C.net] }[kind];
  };

  for (const demo of DEMOS) {
    const dir = path.join(DEMO, demo, 'data');
    if (!exists(dir)) { t.ok(false, `audit ${demo}: has recorded data`); continue; }
    const seen = { revenue: new Set(), mat: new Set(), pm: new Set(), ct: new Set(), net: new Set() };
    const bad = [];
    const sources = walk(dir).filter(f => f.endsWith('.json')).map(f => [path.relative(dir, f), readText(f)]);
    const cuesPath = path.join(DEMO, 'narration', demo, 'cues.json');
    if (exists(cuesPath)) {
      const cues = readJSON(cuesPath);
      sources.push(['narration cues', JSON.stringify((cues.cues || []).map(c => c.text))]);
      for (const c of cues.cues || []) for (const m of c.text.matchAll(/[Mm]ateriality(?:, the size of mistake that matters)?:? (?:at )?\$([\d,]+)/g)) {
        const v = num(m[1]); const ok = demo === 'audit-review' ? [RV.mat, C.mat] : [C.mat]; seen.mat.add(v);
        if (!ok.includes(v)) bad.push(`narration cue ${c.id} says materiality ${money(v)}: "${c.text}"`);
      }
    }
    for (const [file, s0] of sources) {
      const s = s0.replace(/\\u2019/g, '’').replace(/\\"/g, '"');
      for (const [kind, re0, group = 1] of RULES) {
        const re = new RegExp(re0.source, 'gd'); // d: group positions
        for (const m of s.matchAll(re)) {
          const v = num(m[group]);
          const ctx = s.slice(Math.max(0, m.index - 160), m.index + m[0].length + 60);
          if (kind === 'mat' && /\b(?:half|times|share) of\b[^$]{0,25}$/.test(s.slice(Math.max(0, m.index - 40), m.index))) continue;
          seen[kind].add(v);
          // audit-review: judge the amount by the text before it (up to its own $ sign)
          const ok = expected(demo, kind, demo === 'audit-review' ? s.slice(Math.max(0, m.index - 160), m.indices[group][0] - 1) : ctx);
          if (!ok.includes(v)) bad.push(`${file}: ${kind} ${money(v)} (expected ${ok.map(money).join(' or ')}) in “…${ctx.replace(/\s+/g, ' ').slice(100, 300)}…”`);
        }
      }
      CELL_RE.lastIndex = 0;
      for (const m of s.matchAll(CELL_RE)) {
        const kind = cellKind(m[1]); if (!kind) continue;
        const v = num(m[2]); if (!(v > 999)) continue;
        const ctx = s.slice(Math.max(0, m.index - 60), m.index + m[0].length + 20);
        seen[kind].add(v);
        const ok = expected(demo, kind, ctx);
        if (!ok.includes(v)) bad.push(`${file}: cell ${kind} ${money(v)} (expected ${ok.map(money).join(' or ')}) in “${ctx.replace(/\s+/g, ' ').slice(0, 200)}”`);
      }
    }
    if (demo === 'audit-review') {
      const all = sources.map(x => x[1]).join(' ');
      if (!/[Ii]nterim review materiality/.test(all)) bad.push('the review threshold is not labelled "interim review materiality"');
      if (!all.includes(money(C.mat))) bad.push(`the review never states the FY2026 annual materiality ${money(C.mat)} beside its own`);
    }
    const uniq = [...new Set(bad)];
    const fmt = k => [...seen[k]].sort((a, b) => a - b).map(money).join(', ') || '-';
    const msg = `audit ${demo}: FY2026 figures match demo/audit-canonical.json (materiality ${fmt('mat')} | performance ${fmt('pm')} | trivial ${fmt('ct')} | revenue ${fmt('revenue')} | net income ${fmt('net')})`;
    const detail = (VERBOSE ? uniq : uniq.slice(0, 6)).join('\n') + (!VERBOSE && uniq.length > 6 ? `\n… ${uniq.length - 6} more (--verbose)` : '');
    t.ok(!uniq.length, msg, detail); // strict for all 13 audit demos
  }
}

// ---------------------------------------------------------------------------------------------------------------
const cents = x => Math.round(Number(x || 0) * 100);
function one(demo, name) {
  const g = walk(path.join(DEMO, demo, 'data', 'files')).filter(f => path.basename(f) === name);
  if (g.length !== 1) throw new Error(`${demo}: expected one "${name}", found ${g.length}`);
  return g[0];
}
const rowsFrom = (file, start = 8) => readXlsx(file).slice(start - 1).filter(Boolean);

function form940(t) {
  let proj, ledger, ann, h1, reg;
  try {
    proj = rowsFrom(one('tax-940', 'Q4 2026 payroll projection.xlsx')).filter(r => String(r[0] || '').startsWith('E-'));
    ledger = rowsFrom(one('tax-w2', '2026 payroll ledger by pay run.xlsx')).filter(r => r[2] === 'Q4 2026');
    ann = new Map(rowsFrom(one('tax-w2', '2026 earnings by employee.xlsx')).filter(r => String(r[0] || '').startsWith('E-')).map(r => [r[0], r]));
    h1 = new Map(rowsFrom(one('tax-940', 'Q2 2026 year-to-date wages by employee.xlsx')).filter(r => String(r[0] || '').startsWith('E-')).map(r => [r[0], r]));
    reg = rowsFrom(one('tax-940', 'Q3 2026 payroll register.xlsx'));
  } catch (e) { t.ok(false, 'Form 940 / W-2 client files found', e.message); return; }
  const pOct = proj.reduce((s, r) => s + cents(r[3]), 0), pND = proj.reduce((s, r) => s + cents(r[5]), 0);
  const aOct = ledger.filter(r => String(r[1]).startsWith('2026-10')).reduce((s, r) => s + cents(r[3]) + cents(r[4]), 0);
  const aND = ledger.filter(r => ['11', '12'].includes(String(r[1]).slice(5, 7))).reduce((s, r) => s + cents(r[3]) + cents(r[4]), 0);
  t.eq(pOct + pND, 307053056, `Form 940 Q4 gross = $3,070,530.56 (October ${money(pOct / 100)} paid + ${money(pND / 100)} projected)`);
  t.eq(aOct + aND, 314723756, 'Forms W-2 Q4 gross = $3,147,237.56 (seven Q4 pay runs)');
  t.eq(pOct, aOct, 'October agrees to the cent between the 940 projection and the W-2 ledger');
  const diff = aOct + aND - pOct - pND;
  t.ok(diff === 7670700 && aND - pND === diff, `the $76,707.00 difference is all in November and December (${money(diff / 100)})`);

  const q3 = new Map(), q3s = new Map();
  for (const r of reg) if (String(r[4] || '').startsWith('E-')) { q3.set(r[4], (q3.get(r[4]) || 0) + cents(r[11])); q3s.set(r[4], (q3s.get(r[4]) || 0) + cents(r[13])); }
  let more = 0, hire = 0, futaA = 0, futaP = 0; const hires = [];
  for (const e of [...new Set([...ann.keys(), ...proj.map(r => r[0])])].sort()) {
    const pr = proj.find(r => r[0] === e), a = ann.get(e), h = h1.get(e);
    const act = a ? cents(a[6]) - (h ? cents(h[5]) : 0) - (q3.get(e) || 0) : 0;
    const est = pr ? cents(pr[3]) + cents(pr[5]) : 0;
    if (pr && String(pr[2]).startsWith('Planned hire')) { hire += act - est; hires.push(e); } else more += act - est;
    futaA += a ? Math.min(700000, cents(a[6]) - cents(a[8])) : 0;
    futaP += Math.min(700000, (h ? cents(h[5]) - cents(h[7]) : 0) + (q3.get(e) || 0) - (q3s.get(e) || 0) + (pr ? cents(pr[3]) + cents(pr[5]) - cents(pr[4]) - cents(pr[6]) : 0));
  }
  t.eq(more, 8096300, 'existing staff: November and December pay is $80,963.00 over the projection');
  t.ok(hire === -425600 && hires.length === 1, `one planned hire (${hires.join(', ')}) is $4,256.00 under the projection (${money(hire / 100)})`);
  t.eq(more + hire, diff, 'the two parts add to the difference');
  t.eq(round2((futaA - futaP) * 0.006 / 100), -23.76, 'FUTA changes only for the new hire: -$23.76 of tax');
  // the planned hire is the same person the W-2s report (one name per employee id across the two demos)
  for (const e of hires) {
    const pName = proj.find(r => r[0] === e)[1], a = ann.get(e);
    t.ok(a && String(a[1]).trim() === String(pName).trim(), `${e} is the same person in the 940 projection and the W-2s ("${pName}" vs "${a ? a[1] : 'missing'}")`);
  }
  // flags on the published 940 demo
  const assets = path.join(DEMO, 'tax-940', 'assets');
  const bundle = fs.readdirSync(assets).filter(f => f.endsWith('.js')).map(f => readText(path.join(assets, f))).join('');
  t.ok(bundle.includes('Q4 is projected.') && bundle.includes('$76,707.00') && bundle.includes('$3,147,237.56'), 'the 940 figures panel says Q4 is projected and shows the $76,707.00 reconciliation to $3,147,237.56');
  const css = fs.readdirSync(assets).filter(f => f.endsWith('.css')).map(f => readText(path.join(assets, f))).join('');
  t.ok(css.includes('.calc-note'), 'the projection note is styled (.calc-note)');
  const tapes = [];
  for (const f of walk(path.join(DEMO, 'tax-940', 'data', 'j'))) (function w(o) {
    if (Array.isArray(o)) o.forEach(w);
    else if (o && typeof o === 'object') { if (typeof o.label === 'string' && 'amount' in o && 'kind' in o) tapes.push(o); Object.values(o).forEach(w); }
  })(readJSON(f));
  const q4 = tapes.filter(x => /\bQ4\b/.test(x.label) && !x.label.includes('Wages up to'));
  t.ok(q4.length && q4.every(x => x.label.startsWith('Projected · ')), `${q4.length} Q4 rows in the recorded run, all labelled "Projected · ..."`, [...new Set(q4.filter(x => !x.label.startsWith('Projected')).map(x => x.label))].join('\n'));
  const gross = q4.filter(x => x.label.includes('Gross Pay'));
  t.ok(gross.length && gross.every(x => x.kind === 'open' && x.amount === '3070530.56'), `${gross.length} Q4 gross pay rows in the amber "open" style at 3,070,530.56`);
}

// ---------------------------------------------------------------------------------------------------------------
function lniRates(t) {
  const DIR = path.join(DEMO, 'tax-lni');
  const docs = walk(path.join(DIR, 'data', 'files')).filter(f => path.basename(f) === 'Workers comp rates for 2026.docx');
  if (!t.ok(docs.length === 1, `L&I: one rates document published (${docs.length})`)) return;
  const d = readDocx(docs[0]);
  const fp = d.paragraphs.find(p => p.startsWith('Experience factor:'));
  if (!t.ok(!!fp, 'L&I: the document states the experience factor')) return;
  const factor = Number(fp.split(':')[1].trim());
  const tables = d.tables;
  t.ok(tables.length === 2, `L&I: two tables (base rates, experience-rated rates): ${tables.length}`);
  const [base, rated] = tables;
  t.eq(base[0].join('|'), 'Class|Description|Accident fund|Stay at Work|Medical aid|Supplemental pension|Base rate', 'L&I: base table header');
  t.eq(rated[0].join('|'), 'Class|Accident fund|Stay at Work|Medical aid|Supplemental pension|Hourly rate|Employee share per hour', 'L&I: rated table header');
  const u = x => Math.round(Number(x) * 10000); // rates have four decimals: compare in ten-thousandths
  const B = new Map(base.slice(1).map(r => [r[0], r.slice(2, 7).map(u)]));
  const R = new Map(rated.slice(1).map(r => [r[0], r.slice(1, 7).map(u)]));
  t.ok([...B.keys()].sort().join() === [...R.keys()].sort().join() && B.size === 6, `L&I: the same six classes in both tables (${[...B.keys()].sort().join(', ')})`);
  const rates = new Map();
  for (const code of [...B.keys()].sort()) {
    const [af, saw, maf, spf, total] = B.get(code), [raf, rsaw, rmaf, rspf, hourly] = R.get(code) || [];
    t.eq(af + saw + maf + spf, total, `L&I ${code}: base parts add to the base rate ${total / 10000}`);
    t.eq(raf + rsaw + rmaf + rspf, hourly, `L&I ${code}: experience-rated parts add to the hourly rate ${hourly / 10000}`);
    t.ok([[af, raf], [saw, rsaw], [maf, rmaf]].every(([b, r]) => Math.abs(b * factor - r) <= 1) && rspf === spf, `L&I ${code}: rated parts = base x ${factor} (to the rounding); supplemental pension not rated`);
    t.eq(Math.round(factor * (af + saw + maf) + spf), hourly, `L&I ${code}: hourly rate = factor x (AF + SAW + MA) + SP`);
    rates.set(code, hourly);
  }
  const S = readJSON(path.join(DIR, 'systems.json'));
  const doc = (S.charterfold && S.charterfold.documents || []).find(x => x.name === 'Workers comp rates for 2026.docx');
  if (t.ok(!!doc, 'L&I: the client-systems panel lists the rates document')) {
    const ptables = (doc.preview && doc.preview.blocks || []).filter(b => b.t === 'table').map(b => b.rows);
    t.ok(JSON.stringify(ptables) === JSON.stringify(tables), 'L&I: the client-systems preview shows the same two tables as the document');
    t.ok(exists(path.join(DIR, ...decodeURIComponent(doc.url).split('/'))), 'L&I: the client-systems document link exists: ' + doc.url);
  }
  const blob = walk(path.join(DIR, 'data', 'j')).map(readText).join('\n');
  const m = /((?:\d{4} [\d,]+ hours x \$[\d.]+ = \$[\d,]+\.\d\d; )+\d{4} [\d,]+ hours x \$[\d.]+ = \$[\d,]+\.\d\d)\. Total premium \$([\d,]+\.\d\d)/.exec(blob);
  if (t.ok(!!m, 'L&I: the premium calculation line is in the recorded run')) {
    let tot = 0;
    for (const [, code, hours, rate, amt] of m[1].matchAll(/(\d{4}) ([\d,]+) hours x \$([\d.]+) = \$([\d,]+\.\d\d)/g)) {
      t.eq(u(rate), rates.get(code), `L&I: the premium uses class ${code} at $${rate}, the document's hourly rate`);
      t.eq(Math.round(num(hours) * u(rate) / 100), cents(num(amt)), `L&I: ${code} ${hours} h x $${rate} = $${amt}`);
      tot += cents(num(amt));
    }
    t.ok(tot === cents(num(m[2])) && tot === 11146907, `L&I: class premiums add to the total premium $${m[2]} (expected $111,469.07)`);
  }
  t.ok(blob.includes('92,296.72') || blob.includes('92296.72'), 'L&I: employer share $92,296.72 in the recorded run');
}

// ---------------------------------------------------------------------------------------------------------------
function ties(t) {
  const load = id => { const p = path.join(DEMO, id, 'systems.json'); return exists(p) ? readJSON(p) : null; };
  const sumLines = (S, f) => { let s = 0; S.ledgerwyn.journals.forEach(j => j.lines.forEach(l => { if (f(j, l)) s += (l.dr || 0) - (l.cr || 0); })); return s; };
  const check = (S, rx) => (S.taxrules.checks.find(c => rx.test(c.title)) || {});
  const q3 = j => j.date >= '2026-07-01' && j.date <= '2026-09-30';
  const tie = (title, a, b) => t.ok(a != null && b != null && Math.abs(a - b) < 0.01, `${title} [${a == null ? '-' : money(a)} vs ${b == null ? '-' : money(b)}]`);
  const t941 = load('tax-941'), w2 = load('tax-w2'), t940 = load('tax-940'), t1120 = load('tax-1120'), t1040 = load('tax-1040');
  if (!t.ok(t941 && w2 && t940 && t1120 && t1040, 'systems.json present for tax-941, tax-w2, tax-940, tax-1120, tax-1040')) return;
  const reg = check(t941, /^Register gross pay vs ledger payroll wages/).left;
  tie('Form 941: Q3 ledger wage postings (5110, 6110) = Q3 register gross pay', sumLines(t941, (j, l) => /^PR-/.test(j.id) && (l.no === '5110' || l.no === '6110') && l.dr), reg);
  const sb = check(t941, /^Schedule B total vs line 12/).left;
  tie('Form 941: deposits debited to 2210 = Schedule B total (line 12)', sumLines(t941, (j, l) => l.no === '2210' && l.dr > 0), sb);
  tie('Forms W-2 ledger, Q3 pay runs: wages (5110, 6110) = Form 941 Q3 register gross pay', sumLines(w2, (j, l) => /^PR-/.test(j.id) && q3(j) && (l.no === '5110' || l.no === '6110')), reg);
  tie('Forms W-2 ledger, Q3 pay runs: federal tax credited to 2210 = Form 941 line 12', -sumLines(w2, (j, l) => q3(j) && l.no === '2210'), sb);
  const box1c = w2.taxrules.checks.find(c => /^W-3 box 1 /i.test(c.title)) || {}, box1 = box1c.left;
  tie('Form W-3 box 1 = the four Forms 941 line 2 (W-2 workpapers)', box1c.left, box1c.right);
  const wages = sumLines(w2, (j, l) => l.no === '5110' || l.no === '6110'), k401 = -sumLines(w2, (j, l) => l.no === '2250'), s125 = -sumLines(w2, (j, l) => l.no === '2260');
  tie('Forms W-2: 2026 ledger wages less 401(k) (2250) and Section 125 (2260) = Form W-3 box 1', wages - k401 - s125, box1);
  tie('Form 940 shows the same 2026 payroll ledger as the Forms W-2 demo (wage postings)', sumLines(t940, (j, l) => l.no === '5110' || l.no === '6110'), wages);
  // Form 1120 (FY July 1, 2025 - June 30, 2026) on the audited FY2026 books: page 1 and Schedule M-1 start from the
  // canonical audit figures, and the board's dividends in account 3100 are the canonical dividends.
  const canon = readJSON(path.join(DEMO, 'audit-canonical.json'));
  const run = id => { const dir = path.join(DEMO, id, 'data'), m = readJSON(path.join(dir, 'manifest.json'));
    const get = rx => { const k = Object.keys(m).find(k => rx.test(k)); return k ? readJSON(path.join(dir, ...m[k].f.split('/'))) : null; };
    const prep = get(/\/preparation$/) || { items: [] };
    return { item: id2 => (prep.items.find(i => i.id === id2) || {}).value, ev: name => get(new RegExp('/preparation/evidence/' + name + '$')) }; };
  const rowOf = (ev, label) => ((ev && ev.rows || []).find(r => Array.isArray(r) && r[0] === label) || [])[1];
  const r1120 = run('tax-1120'), r1040 = run('tax-1040'), rEst = run('tax-estimates');
  tie('Form 1120 line 1a gross receipts = the audited FY2026 revenue (audit-canonical)', r1120.item('line1a'), num(canon.revenue));
  tie('Form 1120 Schedule M-1 line 1 net income per books = the audited FY2026 net income (audit-canonical)', r1120.item('m1-1'), num(canon.netIncome));
  const div3100 = sumLines(t1120, (j, l) => l.no === '3100');
  tie('Form 1120: board dividends in the FY2026 ledger (3100) = the audited FY2026 dividends (audit-canonical)', div3100, num(canon.dividends));
  // Calendar 2025 = the FY2026 ledger's 2025 dividends + the FY2025 dividends dated in 2025 (from the FY2025 return).
  const prior = r1120.ev('E02 Prior Return');
  const priorDates = String(rowOf(prior, 'Dividend dates') || '').split(/,\s*/).filter(Boolean);
  const priorEach = priorDates.length ? Number(rowOf(prior, 'Schedule M-2 line 5a dividends')) / priorDates.length : null;
  const ledgerDiv = t1120.ledgerwyn.journals.filter(j => j.lines.some(l => l.no === '3100' && l.dr > 0));
  const dates2025 = [...priorDates.filter(d => d.startsWith('2025-')), ...ledgerDiv.filter(j => j.date.startsWith('2025-')).map(j => j.date)].sort();
  const cal2025 = priorDates.filter(d => d.startsWith('2025-')).length * priorEach + sumLines(t1120, (j, l) => l.no === '3100' && j.date.startsWith('2025-'));
  tie('HANGS dividends paid in calendar 2025 (FY2025 return dates + FY2026 ledger 3100) = the board total in the 1040 letter', cal2025, Number(rowOf(r1040.ev('E05 HANGS Letter'), 'Dividends paid, all shareholders')));
  tie('Form 1040 line 3b qualified dividends = 60% of HANGS calendar-2025 dividends', r1040.item('line3b'), round2(cal2025 * 0.6));
  const letterDates = String(rowOf(r1040.ev('E05 HANGS Letter'), 'Board dividend dates') || '').split(/,\s*/).filter(Boolean).sort();
  t.ok(letterDates.length === 4 && JSON.stringify(letterDates) === JSON.stringify(dates2025), `the 1040 letter's dividend dates = HANGS's 2025 dividend dates [${letterDates.join(', ')} vs ${dates2025.join(', ')}]`);
  // FY2027 estimates: the prior-year tax and the FY2026 credit come from the new Form 1120.
  tie('Estimates: FY2027 prior-year tax = Form 1120 line 31 total tax', rEst.item('prior-tax'), r1120.item('line31'));
  tie('Estimates: FY2026 overpayment credited to FY2027 = Form 1120 line 36', rEst.item('credit'), r1120.item('line36'));
  // fiscal-year labels: the company's fiscal year ends June 30 in every demo; the accounting periods follow it.
  const FYE = 'Fiscal year ending June 30', bad = [], stale = [];
  for (const id of fs.readdirSync(DEMO)) {
    const S = load(id); if (!S || !S.charterfold || !S.company || !/^HANGS Construction Services/.test(S.company.name)) continue;
    const f = S.charterfold.fields.find(x => x.key === 'fiscalYear'); if (!f || f.value !== FYE) bad.push(`${id}: ${f ? f.value : '-'}`);
  }
  t.ok(!bad.length, `HANGS's fiscal year reads "${FYE}" in every demo`, bad.join('\n'));
  for (const id of fs.readdirSync(DEMO).filter(d => /^(tax|accounting)/.test(d))) {
    const dir = path.join(DEMO, id); if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of walk(dir).filter(f => f.endsWith('.json'))) if (readText(f).includes('FY2026 period 10')) stale.push(path.relative(DEMO, f));
  }
  t.ok(!stale.length, 'tax and accounting data use the June 30 fiscal calendar (November 2026 = "FY2027 period 4", no "FY2026 period 10")', stale.join('\n'));
  // one entity record across every demo of the company
  const recs = new Map();
  for (const id of fs.readdirSync(DEMO)) { const S = load(id); if (!S || !S.company || !S.charterfold) continue; const k = JSON.stringify(S.charterfold.fields.map(f => [f.label, f.value])); if (!recs.has(S.company.name)) recs.set(S.company.name, new Map()); const m = recs.get(S.company.name); m.set(k, (m.get(k) || []).concat(id)); }
  for (const [name, m] of recs) t.ok(m.size === 1, `the entity record for ${name} is the same in all ${[...m.values()].flat().length} demos`, [...m.values()].map(v => v.join(', ')).join('\n'));
}

if (isMain(import.meta.url)) { const r = run(); process.exit(r.fail ? 1 : 0); }
