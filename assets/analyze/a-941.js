/* F1 Finance in-browser analysis: Form 941 (option id "tax-941").
   Input: payroll register, one row per employee per pay date. Integer cents throughout.

   Figures (verified Nov 2026 against official sources):
   - Social Security wage base: 2024 $168,600; 2025 $176,100; 2026 $184,500; 2027 $192,300.
       SSA, Contribution and Benefit Base: https://www.ssa.gov/oact/cola/cbb.html
       SSA, 2026 COLA Fact Sheet: https://www.ssa.gov/news/en/cola/factsheets/2026.html
       SSA, 2027 COLA Fact Sheet: https://www.ssa.gov/news/en/cola/factsheets/2027.html
   - Rates: Social Security 6.2% employee + 6.2% employer (12.4% on line 5a/5b); Medicare 1.45% + 1.45% (2.9% on 5c),
     no wage base; Additional Medicare Tax 0.9% withheld on wages over $200,000 paid to an employee in the calendar year
     (employee only, line 5d). Line 1 uses the pay period including the 12th of the quarter's third month. Line 7 is the
     fractions-of-cents adjustment. $2,500 de minimis and $100,000 next-day deposit rules.
       IRS, Instructions for Form 941 (03/2026): https://www.irs.gov/instructions/i941 */
(function () {
  'use strict';
  var U = window.F1Core.util, money = U.money, sum = U.sum, plural = U.plural, pct = U.pct;
  var WAGE_BASE = { 2024: 16860000, 2025: 17610000, 2026: 18450000, 2027: 19230000 };
  var ADDL_THRESHOLD = 20000000;
  var SOURCES = [
    { label: 'SSA contribution and benefit base', url: 'https://www.ssa.gov/oact/cola/cbb.html' },
    { label: 'SSA 2026 COLA fact sheet ($184,500)', url: 'https://www.ssa.gov/news/en/cola/factsheets/2026.html' },
    { label: 'IRS Instructions for Form 941 (03/2026)', url: 'https://www.irs.gov/instructions/i941' }
  ];

  var FIELDS = [
    { key: 'employee', label: 'Employee', type: 'text', req: true, guess: true, syn: ['employee', 'employee name', 'name', 'worker', 'full name', 'staff', 'team member'], not: ['id', 'number', 'ssn', 'code'] },
    { key: 'empId', label: 'Employee ID', type: 'text', syn: ['employee id', 'employee number', 'id', 'employee code', 'file number', 'badge'] },
    { key: 'payDate', label: 'Pay date', type: 'date', req: true, guess: true, syn: ['pay date', 'check date', 'payment date', 'date paid', 'paid date', 'payroll date', 'pay day', 'date'], not: ['period', 'start', 'end', 'begin', 'hire', 'term', 'birth'] },
    { key: 'pStart', label: 'Pay period start', type: 'date', syn: ['period start', 'pay period start', 'period begin', 'period beginning', 'start date', 'period from', 'begin date'] },
    { key: 'pEnd', label: 'Pay period end', type: 'date', syn: ['period end', 'pay period end', 'period ending', 'end date', 'period to', 'week ending', 'period end date'] },
    { key: 'gross', label: 'Gross wages', type: 'money', req: true, guess: true, syn: ['gross wages', 'gross pay', 'gross', 'total gross', 'gross earnings', 'total wages', 'wages', 'gross compensation', 'total pay', 'earnings'], not: ['social security', 'medicare', 'federal', 'taxable', 'net', 'state', 'tips'] },
    { key: 'tips', label: 'Reported tips', type: 'money', syn: ['tips', 'reported tips', 'cash tips', 'tip income', 'social security tips', 'tips reported', 'charged tips'], not: ['allocated'] },
    { key: 'fit', label: 'Federal income tax withheld', type: 'money', syn: ['federal income tax', 'federal withheld', 'federal income tax withheld', 'federal tax', 'federal income', 'federal tax withheld'], not: ['wages', 'taxable', 'state', 'employer', 'unemployment', 'futa'] },
    { key: 'ssWages', label: 'Social Security wages', type: 'money', syn: ['social security wages', 'taxable social security wages', 'social security taxable wages', 'social security taxable', 'social security gross'], not: ['employer', 'tips'] },
    { key: 'ssTax', label: 'Social Security withheld', type: 'money', syn: ['social security tax', 'social security withheld', 'employee social security', 'social security tax withheld', 'social security'], not: ['wages', 'employer', 'taxable', 'tips', 'gross'] },
    { key: 'medWages', label: 'Medicare wages', type: 'money', syn: ['medicare wages', 'taxable medicare wages', 'medicare taxable wages', 'medicare wages and tips', 'medicare taxable', 'medicare gross'], not: ['employer', 'additional'] },
    { key: 'medTax', label: 'Medicare withheld', type: 'money', syn: ['medicare tax', 'medicare withheld', 'employee medicare', 'medicare tax withheld', 'medicare'], not: ['wages', 'employer', 'additional', 'taxable', 'gross'] },
    { key: 'addl', label: 'Additional Medicare withheld', type: 'money', syn: ['additional medicare', 'additional medicare tax', 'additional medicare withheld'], not: ['wages'] }
  ];

  function qOf(n) { var p = U.parts(n); return { y: p.y, q: Math.ceil(p.m / 3) }; }
  function qKey(o) { return o.y + '-Q' + o.q; }

  function analyze(input, opts) {
    var src = input.pr || [], files = src.map(function (s) { return s.file; });
    var has = {}; src.forEach(function (s) { Object.keys(s.cols).forEach(function (k) { has[k] = true; }); });
    var rows = [];
    src.forEach(function (s) {
      s.records.forEach(function (r) {
        if (!r.employee && !r.empId) return;
        if (/^(total|totals|grand total|company total|report total)\b/i.test(r.employee || '')) return;
        if (r.payDate == null || r.gross == null) return;
        rows.push({ emp: r.employee || r.empId, key: (r.empId ? 'id:' + r.empId : 'n:' + String(r.employee).toLowerCase().replace(/\s+/g, ' ')), date: r.payDate, pS: r.pStart, pE: r.pEnd,
          gross: r.gross, tips: r.tips || 0, fit: r.fit || 0, ssW: r.ssWages, ssT: r.ssTax, medW: r.medWages, medT: r.medTax, addl: r.addl, src: s.file + ' row ' + r._row });
      });
    });
    // do wage columns include tips?
    function inclTips(f) { var yes = 0, no = 0; rows.forEach(function (r) { if (!r.tips || r[f] == null) return; if (r[f] === r.gross + r.tips) yes++; else no++; }); return yes > no; }
    var ssInclTips = has.ssWages && has.tips && inclTips('ssW'), medInclTips = has.medWages && has.tips && inclTips('medW');

    // quarters present
    var qs = {}; rows.forEach(function (r) { var k = qKey(qOf(r.date)); qs[k] = (qs[k] || 0) + 1; });
    var qList = Object.keys(qs).sort();
    if (!qList.length) return emptyResult(files);
    var sel = opts.quarter && qs[opts.quarter] ? opts.quarter : qList[qList.length - 1];
    if (!opts.quarter && qList.length > 1) {
      // a quarter still in progress (no pay yet in its third month) is not the default
      var ly = +sel.slice(0, 4), lq = +sel.slice(-1);
      if (!rows.some(function (r) { var p = U.parts(r.date); return p.y === ly && p.m === lq * 3; })) sel = qList[qList.length - 2];
    }
    var Y = +sel.slice(0, 4), Q = +sel.slice(-1);
    var qStart = U.dn(Y, Q * 3 - 2, 1), qEnd = U.endOfMonth(Y, Q * 3);
    var base = WAGE_BASE[Y], baseNote = '';
    if (!base) { base = WAGE_BASE[2026]; baseNote = 'No Social Security wage base on file for ' + Y + '; the 2026 base was used. Update it before relying on line 5a.'; }

    // walk each employee's year in date order to get year-to-date figures
    rows.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : a.date - b.date; });
    var ytd = {}, earliest = {};
    rows.forEach(function (r) {
      var p = U.parts(r.date); if (p.y !== Y) return;
      var k = r.key, y = ytd[k] = ytd[k] || { ss: 0, med: 0, g: 0 };
      var gt = r.gross + r.tips;
      r.payAbove = Math.max(0, y.g + gt - base) - Math.max(0, y.g - base); y.g += gt; r.ytdPay = y.g;
      if (earliest[k] == null || r.date < earliest[k]) earliest[k] = r.date;
      var wages = r.ssW != null ? (ssInclTips ? r.ssW - r.tips : r.ssW) : r.gross;
      var medw = r.medW != null ? (medInclTips ? r.medW - r.tips : r.medW) : r.gross;
      var c0 = Math.min(y.ss, base), c1 = Math.min(Math.max(y.ss + wages, 0), base), c2 = Math.min(Math.max(y.ss + wages + r.tips, 0), base);
      r.ssWs = c1 - c0; r.ssTs = c2 - c1; r.ssAbove = wages + r.tips - (c2 - c0);
      r.ytdSsBefore = y.ss; y.ss += wages + r.tips; r.ytdSs = y.ss;
      r.medS = medw + r.tips;
      var a0 = Math.max(0, y.med - ADDL_THRESHOLD), a1 = Math.max(0, y.med + r.medS - ADDL_THRESHOLD);
      r.addlS = a1 - a0; y.med += r.medS; r.ytdMed = y.med;
      r.expSS = pct(r.ssWs + r.ssTs, 62, 1000);
      r.expMed = pct(r.medS, 145, 10000);
      r.expAddl = pct(r.addlS, 9, 1000);
      r.wages = wages;
    });
    var Qr = rows.filter(function (r) { return r.date >= qStart && r.date <= qEnd; });
    var outside = rows.length - Qr.length;
    var anyEarlier = rows.some(function (r) { return r.date < qStart && U.parts(r.date).y === Y; });

    // per-row withholding comparison
    var issues = { ss: [], med: [], overBaseWh: [] };
    Qr.forEach(function (r) {
      r.ssOk = true; r.medOk = true;
      if (has.ssTax) {
        var a = r.ssT || 0, d = a - r.expSS;
        if (Math.abs(d) > 1) { r.ssOk = false; if (r.expSS === 0 && a > 0 && r.ytdSsBefore >= base) issues.overBaseWh.push(r); else issues.ss.push(r); }
        r.ssDiff = d;
      }
      if (has.medTax) {
        var am = (r.medT || 0) + (has.addl ? (r.addl || 0) : 0), em = r.expMed + r.expAddl, dm = am - em;
        if (Math.abs(dm) > 1) { r.medOk = false; issues.med.push(r); }
        r.medDiff = dm;
      }
    });

    // Form 941 lines
    var L = {};
    L.l2 = sum(Qr, function (r) { return r.gross + r.tips; });
    L.l3 = sum(Qr, function (r) { return r.fit; });
    L.a1 = sum(Qr, function (r) { return r.ssWs; }); L.b1 = sum(Qr, function (r) { return r.ssTs; });
    L.c1 = sum(Qr, function (r) { return r.medS; }); L.d1 = sum(Qr, function (r) { return r.addlS; });
    L.a2 = pct(L.a1, 124, 1000); L.b2 = pct(L.b1, 124, 1000); L.c2 = pct(L.c1, 29, 1000); L.d2 = pct(L.d1, 9, 1000);
    L.e = L.a2 + L.b2 + L.c2 + L.d2;
    L.l6 = L.l3 + L.e;
    // line 7: employee share actually withheld (rows with errors treated as corrected) vs the employee share in line 5
    var actualEE = sum(Qr, function (r) {
      var ss = has.ssTax && r.ssOk ? (r.ssT || 0) : r.expSS;
      var md = has.medTax && r.medOk ? (r.medT || 0) + (has.addl ? (r.addl || 0) : 0) : r.expMed + r.expAddl;
      return ss + md;
    });
    var rawActualEE = has.ssTax && has.medTax ? sum(Qr, function (r) { return (r.ssT || 0) + (r.medT || 0) + (has.addl ? (r.addl || 0) : 0); }) : null;
    var eeX2 = L.a2 + L.b2 + L.c2 + 2 * L.d2;
    L.l7 = Math.round((2 * actualEE - eeX2) / 2);
    L.l10 = L.l6 + L.l7; L.l11 = 0; L.l12 = L.l10 - L.l11;
    var deposits = opts.deposits != null ? opts.deposits : null;
    if (deposits != null) { L.l13 = deposits; L.l14 = Math.max(0, L.l12 - deposits); L.l15 = Math.max(0, deposits - L.l12); }

    // line 1: pay period including the 12th of the third month
    var twelfth = U.dn(Y, Q * 3, 12), l1how, l1date = null, counted = {};
    if (has.pStart && has.pEnd && Qr.some(function (r) { return r.pS != null && r.pE != null; })) {
      Qr.forEach(function (r) { if (r.pS != null && r.pE != null && r.pS <= twelfth && r.pE >= twelfth && r.gross > 0) counted[r.key] = r.emp; });
      l1how = 'Counted employees paid for a pay period that includes ' + U.ldate(twelfth) + ' (from the period start and end columns).';
    } else {
      var later = Qr.filter(function (r) { return r.date >= twelfth; }).map(function (r) { return r.date; });
      l1date = later.length ? Math.min.apply(null, later) : null;
      if (l1date == null) { var before = Qr.filter(function (r) { return U.parts(r.date).m === Q * 3; }).map(function (r) { return r.date; }); if (before.length) l1date = Math.max.apply(null, before); }
      Qr.forEach(function (r) { if (l1date != null && r.date === l1date && r.gross > 0) counted[r.key] = r.emp; });
      l1how = 'No pay-period dates in the file, so the first pay date on or after ' + U.ldate(twelfth) + (l1date != null ? ' (' + U.fdate(l1date) + ')' : '') + ' was taken as the pay period that includes the 12th. Confirm with your pay calendar.';
    }
    L.l1 = Object.keys(counted).length;

    // monthly and per-pay-date liability (Schedule B / line 16)
    var byDate = {};
    Qr.forEach(function (r) {
      var ss = has.ssTax && r.ssOk ? (r.ssT || 0) : r.expSS, md = has.medTax && r.medOk ? (r.medT || 0) + (has.addl ? (r.addl || 0) : 0) : r.expMed + r.expAddl;
      var er = pct(r.ssWs + r.ssTs, 62, 1000) + pct(r.medS, 145, 10000);
      byDate[r.date] = (byDate[r.date] || 0) + r.fit + ss + md + er;
    });
    var dates = Object.keys(byDate).map(Number).sort(function (a, b) { return a - b; });
    var liabT = sum(dates, function (d) { return byDate[d]; }), resid = L.l12 - liabT;
    if (dates.length && resid) byDate[dates[dates.length - 1]] += resid;
    var months = [0, 0, 0];
    dates.forEach(function (d) { months[U.parts(d).m - (Q * 3 - 2)] += byDate[d]; });
    var bigDay = dates.filter(function (d) { return byDate[d] >= 10000000; });

    // employee summary
    var emps = {};
    Qr.forEach(function (r) {
      var e = emps[r.key] = emps[r.key] || { emp: r.emp, n: 0, gross: 0, tips: 0, fit: 0, ssW: 0, ssT: 0, ssE: 0, medW: 0, medT: 0, medE: 0, addlW: 0, ytdSs: 0, rows: [] };
      e.n++; e.gross += r.gross; e.tips += r.tips; e.fit += r.fit; e.ssW += r.ssWs + r.ssTs; e.ssT += r.ssT || 0; e.ssE += r.expSS; e.medW += r.medS; e.medT += (r.medT || 0) + (has.addl ? (r.addl || 0) : 0); e.medE += r.expMed + r.expAddl; e.addlW += r.addlS; e.ytdSs = r.ytdSs; e.rows.push(r);
    });
    var empList = Object.keys(emps).map(function (k) { var e = emps[k]; e.key = k; return e; }).sort(function (a, b) { return b.gross - a.gross; });

    // exceptions
    var ex = [];
    if (baseNote) ex.push({ sev: 'high', title: 'Wage base not on file for ' + Y, detail: baseNote });
    empList.forEach(function (e) {
      var above = sum(e.rows, function (r) { return r.payAbove; });
      if (above > 0) {
        var hit = e.rows.filter(function (r) { return r.ytdPay >= base; })[0];
        ex.push({ sev: 'med', title: e.emp + ' passed the ' + Y + ' Social Security wage base', amount: above, detail: 'Year-to-date pay reached ' + money(base) + (hit ? ' with the ' + U.fdate(hit.date) + ' pay' : '') + '. About ' + money(above) + ' of this quarter’s pay is above the base, so no Social Security tax is due on it (line 5a counts only Social Security wages up to the base); Medicare still applies.' });
      }
    });
    function rowsTxt(list, f) { return list.slice(0, 4).map(function (r) { return U.fdate(r.date) + ' withheld ' + money(f === 'ss' ? r.ssT || 0 : (r.medT || 0) + (has.addl ? r.addl || 0 : 0)) + ', expected ' + money(f === 'ss' ? r.expSS : r.expMed + r.expAddl); }).join('; ') + (list.length > 4 ? '; and ' + (list.length - 4) + ' more' : ''); }
    function byEmp(list) { var m = {}; list.forEach(function (r) { (m[r.key] = m[r.key] || []).push(r); }); return m; }
    var ob = byEmp(issues.overBaseWh);
    Object.keys(ob).forEach(function (k) { var l = ob[k], amt = sum(l, function (r) { return r.ssT || 0; }); ex.push({ sev: 'high', title: 'Social Security withheld after the wage base: ' + l[0].emp, amount: amt, detail: rowsTxt(l, 'ss') + '. Refund or reduce the employee’s Social Security and correct the register; line 5a excludes these wages and line 7 assumes the correction.' }); });
    var sb = byEmp(issues.ss);
    Object.keys(sb).forEach(function (k) { var l = sb[k]; ex.push({ sev: 'high', title: 'Social Security withheld is not 6.2%: ' + l[0].emp, amount: sum(l, function (r) { return r.ssDiff; }), detail: rowsTxt(l, 'ss') + '. Fix the withholding (collect or refund) before filing; line 7 assumes the correct amount.' }); });
    var mb = byEmp(issues.med);
    Object.keys(mb).forEach(function (k) {
      var l = mb[k], addl = l.some(function (r) { return r.addlS > 0; });
      ex.push({ sev: 'high', title: 'Medicare withheld is not 1.45%' + (addl ? ' (+0.9% Additional Medicare over $200,000)' : '') + ': ' + l[0].emp, amount: sum(l, function (r) { return r.medDiff; }), detail: rowsTxt(l, 'med') + '. Correct the withholding before filing; line 7 assumes the correct amount.' });
    });
    if (has.fit) empList.forEach(function (e) { if (e.gross > 0 && e.fit === 0) ex.push({ sev: 'med', title: 'No federal income tax withheld: ' + e.emp, amount: e.gross, detail: 'Paid ' + money(e.gross) + ' this quarter with no federal withholding. Confirm the Form W-4 (for example, a valid exempt claim) or correct it.' }); });
    else ex.push({ sev: 'high', title: 'No federal income tax column found', detail: 'Line 3 is $0.00. Map the federal withholding column with Adjust columns if the register has one.' });
    if (!has.ssTax || !has.medTax) ex.push({ sev: 'med', title: 'Employee Social Security or Medicare withheld not in the file', detail: 'The withholding could not be checked, and line 7 is $0.00 because the actual amounts withheld are unknown.' });
    var negs = Qr.filter(function (r) { return r.gross < 0 || r.fit < 0 || (r.ssT || 0) < 0 || (r.medT || 0) < 0; });
    negs.forEach(function (r) { ex.push({ sev: 'med', title: 'Negative pay: ' + r.emp + ' on ' + U.fdate(r.date), amount: r.gross, detail: 'A reversal or correction. It reduces this quarter’s wages and taxes; confirm it relates to this quarter, not an earlier one (prior-quarter corrections go on Form 941-X).' }); });
    if (Q > 1 && !anyEarlier) ex.push({ sev: 'med', title: 'No earlier ' + Y + ' pay in the file', detail: 'The wage-base and $200,000 checks assume nobody was paid earlier in ' + Y + '. Upload the year-to-date register for an accurate check.' });
    if (Math.abs(L.l7) > Math.max(100, Qr.length)) ex.push({ sev: 'med', title: 'Line 7 is larger than normal rounding', amount: L.l7, detail: 'Fractions-of-cents adjustments are usually a few cents. Check the withholding rows above.' });
    if (bigDay.length) ex.push({ sev: 'high', title: '$100,000 next-day deposit rule', detail: 'Tax liability of $100,000 or more on ' + bigDay.map(U.fdate).join(', ') + ': the deposit is due the next business day and you become a semiweekly depositor.' });
    if (rawActualEE != null && rawActualEE !== actualEE) ex.push({ sev: 'low', title: 'Line 7 if the errors are not corrected', amount: Math.round((2 * rawActualEE - eeX2) / 2), detail: 'With the register as is, line 7 would be this amount instead of ' + money(L.l7) + ', and line 12 would change by the same difference. Correcting the employees’ withholding is the cleaner fix.' });

    // tables
    var formRows = [
      { ln: '1', d: 'Number of employees who received wages for the pay period including ' + U.ldate(twelfth), v: L.l1, num: true },
      { ln: '2', d: 'Wages, tips and other compensation', v: L.l2 },
      { ln: '3', d: 'Federal income tax withheld', v: L.l3 },
      { ln: '5a', d: 'Taxable Social Security wages ' + money(L.a1) + ' × 0.124', v: L.a2 },
      { ln: '5b', d: 'Taxable Social Security tips ' + money(L.b1) + ' × 0.124', v: L.b2 },
      { ln: '5c', d: 'Taxable Medicare wages and tips ' + money(L.c1) + ' × 0.029', v: L.c2 },
      { ln: '5d', d: 'Wages subject to Additional Medicare withholding ' + money(L.d1) + ' × 0.009', v: L.d2 },
      { ln: '5e', d: 'Total Social Security and Medicare taxes', v: L.e, _cls: 'is-sub' },
      { ln: '6', d: 'Total taxes before adjustments (lines 3 + 5e + 5f)', v: L.l6, _cls: 'is-sub' },
      { ln: '7', d: 'Current quarter’s adjustment for fractions of cents', v: L.l7 },
      { ln: '8–9', d: 'Sick pay; tips and group-term life insurance (not in the file)', v: 0 },
      { ln: '10', d: 'Total taxes after adjustments', v: L.l10, _cls: 'is-sub' },
      { ln: '11', d: 'Qualified small business payroll tax credit (enter from Form 8974 if any)', v: 0 },
      { ln: '12', d: 'Total taxes after adjustments and nonrefundable credits', v: L.l12, _cls: 'is-tot' }
    ];
    if (deposits != null) formRows.push({ ln: '13', d: 'Total deposits for this quarter (entered)', v: L.l13 }, { ln: '14', d: 'Balance due', v: L.l14 }, { ln: '15', d: 'Overpayment', v: L.l15 });
    formRows.push({ ln: '16', d: 'Month 1 / 2 / 3 liability: ' + months.map(function (m) { return money(m); }).join(' / '), v: sum(months), _cls: 'is-sub' });
    formRows.forEach(function (r) { r.amt = r.num ? null : r.v; r.cnt = r.num ? r.v : null; });
    var fCols = [{ k: 'ln', label: 'Line' }, { k: 'd', label: 'Description' }, { k: 'cnt', label: 'Count', t: 'num' }, { k: 'amt', label: 'Amount', t: 'money' }];
    var mNames = [U.MON[Q * 3 - 3], U.MON[Q * 3 - 2], U.MON[Q * 3 - 1]];
    var monthRows = months.map(function (m, i) { return { m: 'Month ' + (i + 1) + ' (' + mNames[i] + ')', amt: m }; });
    var mCols = [{ k: 'm', label: 'Month' }, { k: 'amt', label: 'Tax liability', t: 'money' }];
    var dRows = dates.map(function (d) { return { date: d, amt: byDate[d] }; });
    var dCols = [{ k: 'date', label: 'Pay date (liability day)', t: 'date' }, { k: 'amt', label: 'Tax liability', t: 'money' }];
    var eCols = [{ k: 'emp', label: 'Employee' }, { k: 'n', label: 'Pays', t: 'num' }, { k: 'gross', label: 'Gross wages', t: 'money' }, { k: 'tips', label: 'Tips', t: 'money' }, { k: 'fit', label: 'Federal w/h', t: 'money' },
      { k: 'ssW', label: 'SS wages (taxable)', t: 'money' }, { k: 'ssT', label: 'SS withheld', t: 'money' }, { k: 'ssE', label: 'SS expected', t: 'money' }, { k: 'medW', label: 'Medicare wages', t: 'money' }, { k: 'medT', label: 'Medicare withheld', t: 'money' }, { k: 'medE', label: 'Medicare expected', t: 'money' }, { k: 'ytdSs', label: 'YTD SS wages', t: 'money' }, { k: 'l1', label: 'In line 1' }];
    empList.forEach(function (e) { e.l1 = counted[e.key] ? 'Yes' : ''; e._cls = (e.ssT !== e.ssE && Math.abs(e.ssT - e.ssE) > e.n) || (Math.abs(e.medT - e.medE) > e.n) ? 'is-warn' : ''; });
    var eTot = { emp: 'Total', gross: sum(empList, function (e) { return e.gross; }), tips: sum(empList, function (e) { return e.tips; }), fit: L.l3, ssW: L.a1 + L.b1, ssT: sum(empList, function (e) { return e.ssT; }), ssE: sum(empList, function (e) { return e.ssE; }), medW: L.c1, medT: sum(empList, function (e) { return e.medT; }), medE: sum(empList, function (e) { return e.medE; }) };
    var exCols = [{ k: 'sev', label: 'Severity' }, { k: 'title', label: 'Exception' }, { k: 'amount', label: 'Amount', t: 'money' }, { k: 'detail', label: 'Detail' }];
    var qName = 'Q' + Q + ' ' + Y + ' (' + mNames[0].slice(0, 3) + '–' + mNames[2].slice(0, 3) + ')';
    var dep = L.l12 < 250000 ? 'Line 12 is under $2,500: if the prior quarter was also under $2,500 you may pay with the return instead of depositing (de minimis rule).' : 'Monthly depositors enter the three months on line 16; semiweekly depositors file Schedule B with the liability by pay date (table below). Your status depends on the lookback period ($50,000).';

    return {
      title: 'Form 941, ' + qName,
      subtitle: files.join(' + '),
      file: 'F1-Form-941-' + Y + '-Q' + Q,
      headline: [
        { label: 'Line 12 total taxes', value: money(L.l12), sub: qName },
        { label: 'Line 2 wages', value: money(L.l2), sub: plural(empList.length, 'employee') + ' paid' },
        { label: 'Line 1 employees', value: String(L.l1), sub: 'pay period incl. ' + U.MON[Q * 3 - 1].slice(0, 3) + ' 12' },
        { label: 'Exceptions', value: String(ex.filter(function (e) { return e.sev !== 'low'; }).length), sub: 'to review before filing', tone: ex.some(function (e) { return e.sev === 'high'; }) ? 'bad' : 'ok' }
      ],
      controls: [
        { type: 'select', key: 'quarter', label: 'Quarter', value: sel, options: qList.map(function (k) { return { v: k, t: k.replace('-', ' ') + ' (' + qs[k] + ' rows)' }; }) },
        { type: 'money', key: 'deposits', label: 'Deposits made (optional, line 13)', value: deposits, placeholder: '0.00' }
      ],
      exceptions: ex,
      sections: [
        { title: 'Form 941 lines', open: true, table: { cols: fCols, rows: formRows, form: true }, foot: 'Line 1: ' + l1how },
        { title: 'Monthly tax liability (line 16)', open: true, note: dep, table: { cols: mCols, rows: monthRows, total: { m: 'Total (equals line 12)', amt: sum(months) } }, foot: resid ? 'A rounding difference of ' + money(resid) + ' between per-check and quarter totals was placed on the last pay date so the months add to line 12.' : '' },
        { title: 'Liability by pay date (Schedule B)', table: { cols: dCols, rows: dRows } },
        { title: 'Employees', table: { cols: eCols, rows: empList, total: eTot } }
      ],
      how: [
        'Read ' + plural(rows.length, 'pay row') + ' from ' + files.join(', ') + '; ' + plural(Qr.length, 'row') + ' fall in ' + qName + (outside ? ' and ' + outside + ' outside it (used only for year-to-date totals in ' + Y + ')' : '') + '.',
        'Social Security: each employee’s ' + Y + ' wages plus tips are added in pay-date order; only pay up to the ' + money(base) + ' wage base counts for line 5a/5b, taxed at 12.4% (6.2% employee + 6.2% employer).',
        'Medicare: all wages and tips at 2.9% (1.45% + 1.45%), no limit. Additional Medicare: 0.9% employee-only withholding on each employee’s ' + Y + ' Medicare wages over $200,000 (line 5d).',
        (has.ssWages ? 'Social Security wages taken from the register’s column' + (ssInclTips ? ' (which already includes tips)' : '') : 'No Social Security wages column, so gross wages were used (pre-tax deductions such as cafeteria plans would reduce them)') + '. ' + (has.medWages ? 'Medicare wages from the register’s column' + (medInclTips ? ' (includes tips)' : '') + '.' : 'No Medicare wages column, so gross wages were used.'),
        'Each pay row’s expected employee Social Security and Medicare are rounded to the cent and compared with what was withheld; differences over one cent are listed as exceptions.',
        'Line 7 is the employee share actually withheld (with listed errors treated as corrected) minus the employee share implied by line 5, the fractions-of-cents adjustment.',
        'Liability per pay date: federal withholding + employee Social Security and Medicare withheld + employer 6.2% and 1.45% on that pay. ' + l1how,
        'Line 2 adds reported tips to gross wages. Lines 5f, 8, 9 and 11 need information not in a payroll register and are shown as zero. Whole-cent integer arithmetic is used throughout.'
      ],
      sources: SOURCES,
      sheets: [
        { name: 'Form 941', title: 'Form 941 ' + qName + ' (draft for review)', table: { cols: fCols, rows: formRows } },
        { name: 'Exceptions', table: { cols: exCols, rows: ex } },
        { name: 'Monthly liability', table: { cols: mCols, rows: monthRows } },
        { name: 'Schedule B by date', table: { cols: dCols, rows: dRows } },
        { name: 'Employees', table: { cols: eCols, rows: empList, total: eTot } },
        { name: 'Sources', pre: [['Social Security wage base ' + Y, base / 100], ['Additional Medicare threshold', 200000]].concat(SOURCES.map(function (s) { return [s.label, s.url]; })) }
      ]
    };
  }
  function emptyResult(files) {
    return { title: 'Form 941', subtitle: files.join(' + '), headline: [{ label: 'Pay rows', value: '0', sub: 'no rows with a pay date and gross wages', tone: 'bad' }], exceptions: [{ sev: 'high', title: 'No payroll rows found', detail: 'Use Adjust columns to point at the pay date, employee and gross wages columns.' }], sections: [], how: [], sources: SOURCES, sheets: [{ name: 'Empty', pre: [['No rows found']] }] };
  }

  window.F1Analyze.define('tax-941', {
    roles: [{ key: 'pr', label: 'Payroll register', multi: true, need: true, fields: FIELDS, hint: /payroll|register|pay|wages|941/i }],
    analyze: analyze
  });
})();
