// 13-week cash: reproduces the recorded workbook (read from its .xlsx) exactly; edits recompute.
const T = require('./_src.cjs'), C = T.calcOf('accounting-cashflow'), L = T.lib;
(async () => {
  const x = await C.extract(T.source('accounting-cashflow'), T.inflateRaw), R = x.recorded;
  const c0 = C.calc(L.clone(x.inputs)), cmp = C.compare(c0);
  R.endings.forEach((e, i) => T.eq('week ' + (i + 1) + ' ending', cmp['week' + (i + 1)], e));
  ['receipts', 'disb', 'ending', 'low', 'lowWeek', 'below', 'headroom', 'draws', 'planned', 'available', 'billings', 'variance'].forEach(k => T.eq('recorded ' + k, cmp[k], R[k]));
  R.monthEnds.forEach((m, i) => { T.eq('month-end ' + (i + 1), cmp['monthEnd' + (i + 1)], m.unrestricted); T.eq('headroom ' + (i + 1), cmp['headroom' + (i + 1)], m.headroom); });
  T.eq('Dec 31 without Draw 9', c0.monthEnds[1].withoutAssumed, R.withoutDraws[0]); T.eq('Jan 31 without Draws 9 and 10', c0.monthEnds[2].withoutAssumed, R.withoutDraws[1]);
  T.eq('restore option A', c0.restore[0].endsAt, R.restoreA); T.eq('flag count', c0.flags.length, R.flags); T.eq('proof', c0.proof, 0);
  T.eq('literal: low', c0.low.ending, 209598.57); T.eq('literal: ending', c0.ending, 1484745.39);
  let I = L.clone(x.inputs); I.lines.find(l => /KRE-Q-2290/.test(l.line)).include = false; let c = C.calc(I);
  T.eq('purchase delayed: week 6', c.weeks[5].ending, 304398.57); T.eq('purchase delayed: below by', c.belowBy, 0); T.eq('purchase delayed: ending', c.ending, 1579545.39); T.eq('purchase delayed: flags', c.flags.length, 3);
  I = L.clone(x.inputs); I.opening += 100000; c = C.calc(I);
  T.eq('opening +100k: low', c.low.ending, 309598.57); T.eq('opening +100k: below by', c.belowBy, 0); T.eq('opening +100k: week 13', c.ending, 1584745.39);
  I = L.clone(x.inputs); I.lines.find(l => /^Draw 10/.test(l.line)).include = false; c = C.calc(I);
  T.eq('no Draw 10: Jan month-end', c.monthEnds[2].unrestricted, 895325.39); T.eq('no Draw 10: week 11', c.weeks[10].ending, 725657.72); T.eq('no Draw 10: assumed', c.assumed, 174368);
  I = L.clone(x.inputs); I.lines.find(l => l.noContract).include = true; c = C.calc(I);
  T.eq('Site 27 included: week 13', c.ending, 1932010.39); T.eq('Site 27 included: flag', c.flags.find(f => /Signed Contract/.test(f.flag)).result, 'Included Against CF-2');
  I = L.clone(x.inputs); I.covenantMin = 1100000; c = C.calc(I);
  T.ok('covenant 1.1M: November below', !c.monthEnds[0].meets && c.flags.some(f => /7\.3/.test(f.flag)));
  I = L.clone(x.inputs); I.lines.push({ date: '2026-12-08', category: 'Payroll', line: 'Bonus', amount: -300000, include: true }); c = C.calc(I);
  T.eq('bonus week 6: low', c.low.ending, -90401.43); T.eq('bonus: restore B not enough', c.restore[1].restores, false);
  T.done('accounting-cashflow');
})().catch(e => { console.error(e); process.exit(1); });
