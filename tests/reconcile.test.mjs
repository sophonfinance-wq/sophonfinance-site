// (c) Per-demo reconciliation, recomputed from what visitors see (demo/<id>/systems.json and the recorded workpapers),
// no browser:
//   1. trial balances foot: debits = credits, every balance column nets to zero, opening + period activity = closing
//      per account, preliminary + adjustments = adjusted;
//   2. balance sheets balance: assets = liabilities + equity + current-year income, for every complete trial balance;
//   3. complete journals balance (every journal of a ledger made of whole journal entries), and every proposed entry;
//   4. every tie-out the client-systems ledger states about footing is true;
//   5. bank reconciliation (accounting-bankrec): bank side and book side recomputed from their lines, difference $0.00;
//      every "Unexplained difference" a demo's workpapers state is $0.00;
//   6. 13-week cash (accounting-cashflow): each week opens with the last week's ending cash, opening + receipts +
//      disbursements = ending, totals add, and the workbook's own proof is zero.
//
//   node tests/reconcile.test.mjs [demo ...]
import path from 'node:path';
import { DEMO, readJSON, readText, exists, walk, readXlsx, demos, suite, money, isMain } from './lib/util.mjs';

const C = x => Math.round(Number(x || 0) * 100); // cents
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));

export function run(ids = only.length ? only : demos()) {
  const t = suite('reconciliation: trial balances, balance sheets, journals, bank rec, 13-week cash');
  for (const id of ids) {
    const p = path.join(DEMO, id, 'systems.json');
    if (!exists(p)) { t.note(`${id}: no systems.json (no client-systems ledger to reconcile)`); continue; }
    const S = readJSON(p), L = S.ledgerwyn;
    if (!L) continue;
    const type = new Map((L.accounts || []).map(a => [a.no, a.type]));

    // ---- 1-2. trial balance ------------------------------------------------------------------------------------
    if (L.tb && L.tb.rows && L.tb.rows.length) {
      const cols = L.tb.cols, rows = L.tb.rows;
      const sum = key => rows.reduce((s, r) => s + C(r.v[key]), 0);
      const by = kind => cols.filter(c => c.kind === kind);
      // A complete trial balance has every account (equity and liabilities included); some demos show only the
      // accounts their review covers (cash, receivables), which cannot foot on their own.
      const complete = L.complete !== false && (L.accounts || []).some(a => a.type === 'Equity') && (L.accounts || []).some(a => a.type === 'Liability');
      if (!complete) t.note(`${id}: the trial balance shows ${rows.length} accounts (the review's accounts only), so it is checked row by row, not for footing`);
      // debit and credit columns foot
      if (complete) for (const [d, c] of [[by('debit'), by('credit')], [by('periodDebit'), by('periodCredit')]]) {
        d.forEach((dc, i) => { const cc = c[i]; if (cc) t.eq(sum(dc.key), sum(cc.key), `${id}: trial balance "${dc.label}" = "${cc.label}" (${money(sum(dc.key) / 100)})`); });
      }
      // a debit/credit trial balance's balance column is debit less credit, row by row
      if (by('debit').length === 1 && by('credit').length === 1 && by('balance').length === 1) {
        const [dk, ck, bk] = [by('debit')[0].key, by('credit')[0].key, by('balance')[0].key];
        const off = rows.filter(r => C(r.v[dk]) - C(r.v[ck]) !== C(r.v[bk]));
        t.ok(!off.length, `${id}: every trial balance row's balance = debit - credit`, off.slice(0, 3).map(r => r.no).join(', '));
      }
      // complete trial balances: each balance column nets to zero and the balance sheet balances
      if (complete) {
        for (const bc of by('balance')) {
          t.eq(sum(bc.key), 0, `${id}: trial balance "${bc.label}" nets to zero (debits = credits)`);
          const g = k => rows.filter(r => k(type.get(r.no))).reduce((s, r) => s + C(r.v[bc.key]), 0);
          const A = g(x => x === 'Asset'), Li = -g(x => x === 'Liability'), E = -g(x => x === 'Equity');
          const NI = -g(x => x && !['Asset', 'Liability', 'Equity'].includes(x));
          const unknown = rows.filter(r => !type.get(r.no)).map(r => r.no);
          t.ok(A === Li + E + NI && !unknown.length, `${id}: balance sheet balances at "${bc.label}": assets ${money(A / 100)} = liabilities ${money(Li / 100)} + equity ${money(E / 100)} + income ${money(NI / 100)}`, unknown.length ? 'accounts without a type: ' + unknown.join(', ') : '');
        }
      }
      // opening + activity = closing, account by account
      const bal = by('balance');
      const act = by('activity'), pd = by('periodDebit'), pc = by('periodCredit'), adj = by('adjustment');
      if (bal.length === 2 && (act.length === 1 || (pd.length === 1 && pc.length === 1) || adj.length)) {
        const [o, c] = bal; const off = [];
        for (const r of rows) {
          const move = act.length === 1 ? C(r.v[act[0].key]) : adj.length ? adj.reduce((s, a) => s + C(r.v[a.key]), 0) : C(r.v[pd[0].key]) - C(r.v[pc[0].key]);
          if (C(r.v[o.key]) + move !== C(r.v[c.key])) off.push(`${r.no}: ${money(r.v[o.key])} + ${money(move / 100)} ≠ ${money(r.v[c.key])}`);
        }
        t.ok(!off.length, `${id}: "${o.label}" + ${adj.length ? 'adjustments' : 'period activity'} = "${c.label}" for all ${rows.length} accounts`, off.slice(0, 4).join('\n'));
      }
    }

    // ---- 3. journals --------------------------------------------------------------------------------------------
    const js = L.journals || [];
    const net = j => j.lines.reduce((s, l) => s + C(l.dr) - C(l.cr), 0);
    if (js.length && js.every(j => j.lines.length >= 2)) {
      const off = js.filter(j => net(j) !== 0);
      t.ok(!off.length, `${id}: all ${js.length} ledger journals balance (debits = credits)`, off.slice(0, 4).map(j => `${j.id}: off by ${money(net(j) / 100)}`).join('\n'));
    }
    const pe = L.proposed || [];
    if (pe.length) {
      const off = pe.filter(j => net(j) !== 0);
      t.ok(!off.length, `${id}: all ${pe.length} proposed entries balance`, off.map(j => `${j.id}: off by ${money(net(j) / 100)}`).join('\n'));
    }
    // ---- 4. the ledger's own footing tie-outs -------------------------------------------------------------------
    for (const tie of (L.ties || []).filter(x => /foot/i.test(x.title))) t.ok(tie.ok, `${id}: ${tie.title}`, tie.detail || '');

    // ---- 5. unexplained differences in the recorded workpapers --------------------------------------------------
    const sheets = recordedSheets(id);
    for (const sh of sheets) for (const r of sh.rows || []) {
      if (r && /^Unexplained difference$/i.test(String(r[0] || '').trim()) && typeof r[1] === 'number') t.eq(r[1], 0, `${id}: "${sh.name}" unexplained difference is $0.00`);
    }
  }
  if (ids.includes('accounting-bankrec')) bankRec(t);
  if (ids.includes('accounting-cashflow')) cash13(t);
  return t.done();
}

// worksheets the accounting demos recorded (data/json/*worksheet*.json: { name, rows })
function recordedSheets(id) {
  const dir = path.join(DEMO, id, 'data', 'json');
  if (!exists(dir)) return [];
  return walk(dir).filter(f => /worksheet/.test(path.basename(f))).map(f => { try { const d = readJSON(f); return Array.isArray(d.rows) ? d : null; } catch { return null; } }).filter(Boolean);
}

function bankRec(t) {
  const sh = recordedSheets('accounting-bankrec').find(s => s.name === 'Reconciliation');
  if (!t.ok(!!sh, 'bank rec: the Reconciliation worksheet is recorded')) return;
  const rows = sh.rows.filter(r => r && r[0]);
  const val = re => { const r = rows.find(r => re.test(String(r[0]))); return r ? C(r[1]) : null; };
  const side = (startRe, endRe) => {
    const i = rows.findIndex(r => startRe.test(String(r[0]))), j = rows.findIndex(r => endRe.test(String(r[0])));
    let v = C(rows[i][1]); const parts = [money(rows[i][1])];
    for (const r of rows.slice(i + 1, j)) { if (/^Add/i.test(r[0])) { v += C(r[1]); parts.push('+ ' + money(r[1])); } else if (/^Less/i.test(r[0])) { v -= C(r[1]); parts.push('- ' + money(r[1])); } }
    return [v, parts.join(' ')];
  };
  const [bank, bp] = side(/^Balance per bank/, /^Adjusted bank balance/);
  const [book, kp] = side(/^Balance per books/, /^Adjusted book balance/);
  t.eq(bank, val(/^Adjusted bank balance/), `bank rec: adjusted bank balance recomputed: ${bp} = ${money(bank / 100)}`);
  t.eq(book, val(/^Adjusted book balance/), `bank rec: adjusted book balance recomputed: ${kp} = ${money(book / 100)}`);
  t.eq(bank - book, 0, 'bank rec: difference between the two sides is $0.00');
  t.eq(val(/^Unexplained difference/), 0, 'bank rec: the workpaper states an unexplained difference of $0.00');
  t.ok(/Reconciled to the cent/.test(JSON.stringify(rows)), 'bank rec: the workpaper says "Reconciled to the cent"');
}

function cash13(t) {
  const f = walk(path.join(DEMO, 'accounting-cashflow', 'data', 'files')).find(x => path.basename(x) === '13-Week Cash Forecast Workpapers.xlsx');
  if (!t.ok(!!f, '13-week cash: the forecast workbook is published')) return;
  const rows = Array.from(readXlsx(f, 'Forecast'), r => r || []);
  const row = re => rows.find(r => re.test(String(r[0] || '').trim()));
  const weekRow = row(/^Week$/);
  const weeks = weekRow.map((v, i) => [v, i]).filter(([v]) => typeof v === 'number').map(([, i]) => i);
  t.eq(weeks.length, 13, '13-week cash: thirteen weeks');
  const i0 = rows.indexOf(row(/^Opening cash$/)), iR = rows.indexOf(row(/^Total receipts$/)), iD = rows.indexOf(row(/^Total disbursements$/));
  const iN = rows.indexOf(row(/^Net cash flow$/)), iE = rows.indexOf(row(/^Ending cash$/));
  const recLines = rows.slice(rows.indexOf(row(/^Receipts/)) + 1, iR), disLines = rows.slice(rows.indexOf(row(/^Disbursements$/)) + 1, iD);
  const bad = [];
  weeks.forEach((c, k) => {
    const open = C(rows[i0][c]), rec = C(rows[iR][c]), dis = C(rows[iD][c]), net = C(rows[iN][c]), end = C(rows[iE][c]);
    if (recLines.reduce((s, r) => s + C(r[c]), 0) !== rec) bad.push(`week ${k + 1}: receipt lines do not add to total receipts`);
    if (disLines.reduce((s, r) => s + C(r[c]), 0) !== dis) bad.push(`week ${k + 1}: disbursement lines do not add to total disbursements`);
    if (rec + dis !== net) bad.push(`week ${k + 1}: receipts + disbursements ≠ net cash flow`);
    if (open + net !== end) bad.push(`week ${k + 1}: ${money(open / 100)} + ${money(net / 100)} ≠ ending ${money(end / 100)}`);
    if (k && open !== C(rows[iE][weeks[k - 1]])) bad.push(`week ${k + 1} opens at ${money(open / 100)}, week ${k} ended at ${money(rows[iE][weeks[k - 1]])}`);
  });
  t.ok(!bad.length, `13-week cash rolls forward: each week opens with the prior week's ending cash and opening + receipts + disbursements = ending (week 1 ${money(rows[i0][weeks[0]])} to week 13 ${money(rows[iE][weeks[12]])})`, bad.slice(0, 5).join('\n'));
  const proof = row(/^Proof/);
  if (proof) t.eq(C(proof[2]), 0, '13-week cash: the workbook proof (opening plus every cash line, less week 13 ending) is $0.00');
  const low = row(/^Lowest week-ending cash$/), last = row(/^Ending cash, week 13$/);
  if (low) t.eq(C(low[2]), Math.min(...weeks.map(c => C(rows[iE][c]))), `13-week cash: lowest week-ending cash ${money(low[2])} is the minimum of the thirteen weeks`);
  if (last) t.eq(C(last[2]), C(rows[iE][weeks[12]]), '13-week cash: "Ending cash, week 13" matches the week 13 column');
  // the opening cash is the October bank reconciliation's adjusted balance
  const rec = recordedSheets('accounting-bankrec').find(s => s.name === 'Reconciliation');
  const adj = rec && rec.rows.find(r => r && /^Adjusted bank balance/.test(r[0]));
  if (adj) t.eq(C(rows[i0][weeks[0]]), C(adj[1]), `13-week cash: week 1 opens at the October bank rec's adjusted balance ${money(adj[1])}`);
}

if (isMain(import.meta.url)) { const r = run(); process.exit(r.fail ? 1 : 0); }
