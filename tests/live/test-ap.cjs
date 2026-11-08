// AP review: the live checks reproduce the recorded findings, summary, full-cost table and draft entries; edits recompute.
const T = require('./_src.cjs'), C = T.calcOf('accounting'), L = T.lib;
const amt = (rows, label) => { const r = rows.find(r => r.measure === label); return r ? r.value : null; };
(async () => {
  const x = await C.extract(T.source('accounting')), R = x.recorded;
  const c0 = C.calc(L.clone(x.inputs));
  T.eq('finding count', c0.findings.length, R.findings.length);
  R.findings.forEach((f, i) => { const g = c0.findings[i] || {}; T.eq('finding ' + i + ' doc', g.doc, f.doc); T.eq('finding ' + i + ' check', g.check, f.check); T.eq('finding ' + i + ' result', g.result, f.result); T.eq('finding ' + i + ' amount', g.amount, f.amount); T.eq('finding ' + i + ' clause', String(g.clause).split(',')[0], f.id.split(':')[0]); });
  const s = c0.summary;
  [['Documents checked', 'docsChecked'], ['Findings to fix before paying', 'fix'], ['Findings on hold', 'hold'], ['Findings that need a person', 'person'], ['Asset cost sent to expense', 'assetToExpense'], ['Duplicate payments stopped', 'duplicates'], ['Misstated in the books', 'misstated'], ['Invoices waiting for approval', 'approvals'], ['Invoices waiting for a document', 'documents']]
    .forEach(p => T.eq('summary ' + p[0], s[p[1]], amt(R.summary, p[0])));
  const fc = R.fullCost; // Full Cost worksheet: row 8 full cost, row 10 short, columns B..D
  ['B', 'C', 'D'].forEach((col, i) => { T.eq('full cost ' + col, c0.fullCost[i].full, L.cell(fc, col + '8')); T.eq('short ' + col, c0.fullCost[i].short, L.cell(fc, col + '10')); });
  const recDraft = R.drafts.filter(r => r && /^DJ-/.test(String(r[0])));
  const recDebits = {}; recDraft.forEach(r => { if (r[3]) recDebits[r[0]] = L.round2((recDebits[r[0]] || 0) + r[3]); });
  T.eq('draft entry count', c0.drafts.length, Object.keys(recDebits).length);
  c0.drafts.forEach(d => { T.eq(d.id + ' debit', d.debit, recDebits[d.id]); T.eq(d.id + ' balances', d.debit, d.credit); });
  let I = L.clone(x.inputs); I.bills.find(b => b.invoiceNo === 'CPM-0412').approver = 'Jordan Hale'; let c = C.calc(I);
  T.eq('CFO approves CPM-0412: findings', c.findings.length, 14); T.eq('CFO approves: waiting for approval', c.summary.approvals, 37213.60);
  I = L.clone(x.inputs); I.vendors.find(v => v.code === 'BCP').w9 = true; c = C.calc(I);
  T.eq('W-9 arrives: waiting for a document', c.summary.documents, 2336.88);
  I = L.clone(x.inputs); I.bills.find(b => b.invoiceNo === 'SWR-8134').lines[0].amount = 14300; c = C.calc(I);
  T.ok('SWR-8134 entered right: BOOK-1 gone', !c.findings.some(f => f.code === 'BOOK')); T.eq('misstated down by 270', c.summary.misstated, 69554.56);
  I = L.clone(x.inputs); I.threshold = 7000; c = C.calc(I);
  T.eq('threshold 7,000: total station no longer an asset', c.summary.assetToExpense, 20413.40);
  I = L.clone(x.inputs); const tcf = I.bills.find(b => b.invoiceNo === 'TCF-2812'); I.bills.push(Object.assign(L.clone(tcf), { entryId: 'AP-10499', invoiceNo: 'TCF 2812' })); c = C.calc(I);
  T.eq('new duplicate caught', c.findings.filter(f => f.code === 'DUP').length, 2); T.eq('duplicates stopped', c.summary.duplicates, 51015);
  I = L.clone(x.inputs); Object.assign(I.bills.find(b => b.invoiceNo === 'MLE-1402'), { approver: 'Morgan Lee', approved: 10333.60 }); c = C.calc(I);
  T.ok('MLE-1402 fully approved: no approval finding', !c.findings.some(f => f.doc === 'MLE-1402'));
  I = L.clone(x.inputs); I.invoices.find(v => v.invoiceNo === 'SWR-8135').date = '2026-11-02'; c = C.calc(I);
  T.ok('November invoice: no cutoff accrual', !c.findings.some(f => f.code === 'CUT'));
  I = L.clone(x.inputs); I.bills.find(b => b.invoiceNo === 'QBP-3077').lines[0] = { account: '1400', accountName: 'Construction in Progress', job: '27-05', costCode: '15-400', amount: 8460 }; c = C.calc(I);
  T.ok('QBP-3077 recoded: JOB-1 gone', !c.findings.some(f => f.doc === 'QBP-3077'));
  T.done('accounting (AP review)');
})().catch(e => { console.error(e); process.exit(1); });
