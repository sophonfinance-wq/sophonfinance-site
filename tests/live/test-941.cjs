// Form 941: the live calculation reproduces the recorded run exactly, then recomputes edits correctly.
const T = require('./_src.cjs'), C = T.calcOf('tax-941'), L = T.lib;
(async () => {
  const x = await C.extract(T.source('tax-941'));
  // 1. unchanged inputs reproduce every recorded figure (32 items read from the run's preparation file)
  const c0 = C.calc(L.clone(x.inputs)), cmp = C.compare(c0);
  const ids = Object.keys(x.recorded); T.ok('recorded items present', ids.length >= 30, ids.length);
  ids.forEach(k => T.eq('recorded ' + k, cmp[k], x.recorded[k]));
  // literal anchors from the replay's figures panel
  T.eq('line 12', c0.lines.L12, 690018.44); T.eq('line 14', c0.lines.L14, 0); T.eq('line 7', c0.lines.L7, 0.30); T.eq('line 5d col 1', c0.lines.L5d1, 114280.41);
  T.ok('all checks pass on the recorded run', c0.checks.every(k => k.ok === true), JSON.stringify(c0.checks.filter(k => k.ok !== true)));
  T.eq('due dates', c0.deposits.map(d => d.due).join(','), '2026-07-13,2026-07-27,2026-08-10,2026-08-24,2026-09-08,2026-09-21');
  // 2. edits
  let I = L.clone(x.inputs); I.paydays[0].gross += 1000; let c = C.calc(I);
  T.eq('edit gross: line 2', c.lines.L2, 2537715.88); T.eq('edit gross: 5a col 1', c.lines.L5a1, 2499827.60); T.eq('edit gross: 5a col 2', c.lines.L5a2, 309978.62);
  T.eq('edit gross: 5c col 1', c.lines.L5c1, 2632731.98); T.eq('edit gross: 5c col 2', c.lines.L5c2, 76349.23);
  T.ok('edit gross: line 7 flagged (withholding no longer matches wages)', c.checks.find(k => /Line 7/.test(k.label)).ok === 'warn');
  const s = C.statutory(I); I.paydays.forEach((p, i) => Object.assign(p, s[i])); c = C.calc(I);
  T.ok('statutory shares: line 7 small', Math.abs(c.lines.L7) < 0.05, c.lines.L7);
  T.eq('statutory shares: Schedule B total = line 12', c.schedTotal, c.lines.L12);
  T.ok('deposits now short: balance due > 0 and the deposit check fails', c.lines.L14 > 0 && c.checks.find(k => /Line 13/.test(k.label)).ok === false);
  I = L.clone(x.inputs); I.rates.base = 176100; c = C.calc(I);
  T.eq('wage base 176,100: 5a col 1 down by 8,400', c.lines.L5a1, 2490427.60);
  I = L.clone(x.inputs); I.deposits[0].date = '2026-07-15'; c = C.calc(I);
  T.eq('late deposit: 2 days', c.deposits[0].late, 2); T.eq('late deposit: 2% penalty estimate', c.deposits[0].penalty, 2137.42);
  T.ok('late deposit: timeliness check fails', c.checks.find(k => /due date/.test(k.label)).ok === false);
  I = L.clone(x.inputs); I.deposits[1].amount -= 500; c = C.calc(I);
  T.eq('short deposit: line 13', c.lines.L13, 689518.44); T.eq('short deposit: line 14', c.lines.L14, 500);
  I = L.clone(x.inputs); I.deposits[1].amount += 250; c = C.calc(I);
  T.eq('over-deposit: line 15 overpayment', c.lines.L15, 250); T.eq('over-deposit: line 14', c.lines.L14, 0);
  I = L.clone(x.inputs); I.credit11 = 1000; c = C.calc(I);
  T.eq('credit: line 12', c.lines.L12, 689018.44); T.eq('credit: Schedule B total follows', c.schedTotal, 689018.44); T.eq('credit: first payday reduced', c.sched[0].liability, 105871.15);
  I = L.clone(x.inputs); I.paydays[2].tips = 2000; c = C.calc(I);
  T.eq('tips: 5b col 2', c.lines.L5b2, 248); T.eq('tips: line 2', c.lines.L2, 2538715.88); T.eq('tips: 5c col 1', c.lines.L5c1, 2633731.98);
  // deposit rules
  T.eq('semiweekly Wed payday', C.dueDate('2026-07-08', 5000, true).date, '2026-07-15');
  T.eq('semiweekly Sat payday', C.dueDate('2026-07-11', 5000, true).date, '2026-07-17');
  T.eq('semiweekly with Labor Day', C.dueDate('2026-09-02', 5000, true).date, '2026-09-10');
  T.eq('monthly, 15th on a Saturday', C.dueDate('2026-07-10', 5000, false).date, '2026-08-17');
  T.eq('$100,000 next business day over Labor Day', C.dueDate('2026-09-04', 118621.12, true).date, '2026-09-08');
  T.done('tax-941');
})().catch(e => { console.error(e); process.exit(1); });
