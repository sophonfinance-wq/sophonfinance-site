// Bank reconciliation: reproduces the recorded run exactly; the difference must be $0.00 to pass; edits recompute.
const T = require('./_src.cjs'), C = T.calcOf('accounting-bankrec'), L = T.lib;
(async () => {
  const x = await C.extract(T.source('accounting-bankrec'));
  const c0 = C.calc(L.clone(x.inputs)), cmp = C.compare(c0), R = x.recorded;
  ['dit', 'oc', 'adjBank', 'adjBook', 'diff', 'net', 'openItems', 'proposed'].forEach(k => T.eq('recorded ' + k, cmp[k], R[k]));
  T.eq('findings count', c0.findings.length, R.findings.length);
  R.findings.forEach((f, i) => { T.eq('finding ' + i + ' name', c0.findings[i].finding, f.finding); T.eq('finding ' + i + ' result', c0.findings[i].result, f.result); T.eq('finding ' + i + ' amount', c0.findings[i].amount, f.amount); });
  T.eq('adjusted bank', c0.adjBank, 1029176.48); T.ok('reconciled', c0.reconciled);
  T.eq('entries', c0.entries.map(e => e.id + ':' + e.lines.map(l => l.account.split(' ')[0] + (l.dr ? 'D' : 'C') + (l.dr || l.cr)).join('/')).join(' '), 'PJ-001:6950D115/1010C115 PJ-002:1010D212.47/7100C212.47 PJ-003:2000D27/1010C27');
  let I = L.clone(x.inputs); I.adjustments = I.adjustments.filter(a => !/Interest/.test(a.desc)); let c = C.calc(I);
  T.eq('interest left out: difference', c.diff, 212.47); T.ok('interest left out: fails', !c.reconciled && c.checks[0].ok === false);
  I = L.clone(x.inputs); I.checks.push({ ref: '10437', date: '2026-10-31', who: 'Test', amount: 500 }); I.bankEnding += 500; c = C.calc(I);
  T.ok('new check + matching bank balance: still reconciled', c.reconciled); T.eq('outstanding checks', c.oc, 41697.65);
  I = L.clone(x.inputs); I.bankErrors.push({ desc: 'Deposit posted short by the bank', amount: 100 }); I.bankEnding -= 100; c = C.calc(I);
  T.ok('bank error: reconciled', c.reconciled); T.ok('bank error: a finding', c.findings.some(f => f.result === 'Ask the Bank'));
  I = L.clone(x.inputs); I.checks[1].date = '2026-07-01'; c = C.calc(I);
  T.eq('second stale check', c.findings.filter(f => /^Stale/.test(f.finding)).length, 2);
  I = L.clone(x.inputs); I.dit[0].date = '2026-10-20'; c = C.calc(I);
  T.eq('old deposit in transit', c.findings.find(f => /DEP-1031/.test(f.finding)).result, 'Investigate');
  I = L.clone(x.inputs); I.opening.bankStatement += 10; c = C.calc(I);
  T.ok('opening tie breaks', c.checks[1].ok === false);
  T.done('accounting-bankrec');
})().catch(e => { console.error(e); process.exit(1); });
