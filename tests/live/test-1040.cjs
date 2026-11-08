// Form 1040: the live calculation reproduces the recorded run exactly, then recomputes edits correctly.
const T = require('./_src.cjs'), C = T.calcOf('tax-1040'), L = T.lib;
(async () => {
  const x = await C.extract(T.source('tax-1040'));
  const c0 = C.calc(L.clone(x.inputs)), cmp = C.compare(c0);
  const ids = Object.keys(x.recorded); T.ok('recorded items present', ids.length >= 20, ids.length);
  ids.forEach(k => T.eq('recorded ' + k, cmp[k], x.recorded[k]));
  T.eq('line 34 refund', c0.lines.L34, 4669.02); T.eq('line 16', c0.lines.L16, 34584.65); T.eq('AMT tentative', c0.amt.tmt, 20672.31); T.eq('2210 required', c0.est.required, 29997.88);
  // the workpapers' own Tax Computation Worksheet rows equal the ones derived from the brackets
  const der = C.tcw(C.STATUS.mfj.brackets); x.inputs.rules.mfj.tcw.forEach((r, i) => { T.eq('TCW rate ' + i, der[i].rate, r.rate); T.eq('TCW subtraction ' + i, der[i].sub, r.sub); });
  // single filer, same facts (hand-computed)
  let I = L.clone(x.inputs); I.status = 'single'; let c = C.calc(I);
  T.eq('single: taxable income', c.lines.L15, 214893.86); T.eq('single: tax on line 5', c.qd.w22, 35781.53); T.eq('single: line 16', c.lines.L16, 41181.53);
  T.eq('single: AMT', c.lines.L17, 0); T.eq('single: tentative minimum tax', c.amt.tmt, 33386.31); T.eq('single: CTC phased out', c.lines.L19, 0);
  T.eq('single: Additional Medicare', c.s2.L11, 612); T.eq('single: NIIT', c.s2.L12, 1449.33); T.eq('single: total tax', c.lines.L24, 43242.86); T.eq('single: amount owed', c.lines.L37, 5242.86);
  // standard deduction wins
  I = L.clone(x.inputs); I.mortgages = []; I.gifts = []; I.realEstate = 0; c = C.calc(I);
  T.ok('standard deduction used', !c.lines.itemizes); T.eq('std: taxable income', c.lines.L15, 239140.36);
  // CTC phase-out, joint
  I = L.clone(x.inputs); I.w2[0].box1 += 150000; c = C.calc(I);
  T.eq('CTC reduced by $1,050', c.lines.L19, 1150);
  // Tax Table below $100,000
  I = L.clone(x.inputs); I.w2 = [{ employee: 'A', employer: 'B', box1: 50000, box2: 0, box5: 50000, box6: 725 }]; I.interest = 0; I.ordDiv = 0; I.qualDiv = 0; I.mortgages = []; I.gifts = []; I.realEstate = 0; I.salesTax = 0; I.children = 0; c = C.calc(I);
  T.eq('table: taxable income', c.lines.L15, 18500); T.eq('table: tax on the $18,500-18,550 row', c.lines.L16, 1853);
  // EST-01 resolved
  I = L.clone(x.inputs); I.estimates[3].creditedTo = '2025'; c = C.calc(I);
  T.eq('EST-01 moved: line 26', c.lines.L26, 8000); T.eq('EST-01 moved: refund', c.lines.L34, 6669.02);
  // SALT phase-down
  I = L.clone(x.inputs); I.w2[0].box1 += 300000; I.realEstate = 50000; c = C.calc(I);
  T.eq('SALT limit at MAGI 570,640.36', c.sa.limit, 18807.89);
  T.done('tax-1040');
})().catch(e => { console.error(e); process.exit(1); });
