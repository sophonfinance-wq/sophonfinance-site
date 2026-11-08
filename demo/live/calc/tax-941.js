/* F1 Finance demos · "Try your own numbers" · Form 941 (Q3 2026) calculation.
   extract(src) reads the recorded run's own files (payroll register, year-to-date file, deposit log, workpapers)
   into editable inputs; calc(inputs) rebuilds lines 1 to 15, Schedule B and the deposit checks the same way the
   recorded workpapers do (same rounding, same order). No DOM. */
(function (root, factory) {
  var L = (root && root.FFLive && root.FFLive.lib) || (typeof require === 'function' ? require('../lib.js') : null);
  var m = factory(L);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.FFLive = root.FFLive || {}; (root.FFLive.calc = root.FFLive.calc || {})['tax-941'] = m; }
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  var r2 = L.round2;

  // District of Columbia legal holidays (deposit due dates skip these, Publication 15 "Legal holiday").
  var HOLIDAYS = ['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25', '2027-01-01', '2027-01-18'];
  function isBiz(s) { var w = L.dow(s); return w !== 0 && w !== 6 && HOLIDAYS.indexOf(s) < 0; }
  function nextBiz(s) { var t = L.addDays(s, 1); while (!isBiz(t)) t = L.addDays(t, 1); return t; }
  function onOrNextBiz(s) { while (!isBiz(s)) s = L.addDays(s, 1); return s; }

  // Deposit due date for one payday (Publication 15, section 11).
  function dueDate(payday, liability, semiweekly) {
    if (!L.validDate(payday)) return { date: '', why: 'Payday date needed' };
    if (liability >= 100000) return { date: nextBiz(payday), why: '$100,000 next-day rule: next business day' };
    if (!semiweekly) {
      var x = new Date(L.d(payday)), y = x.getUTCFullYear(), m = x.getUTCMonth() + 1; if (m === 12) { y++; m = 1; } else m++;
      return { date: onOrNextBiz(y + '-' + ('0' + m).slice(-2) + '-15'), why: 'Monthly schedule: 15th of the next month' };
    }
    var w = L.dow(payday), periodEnd, due;
    if (w >= 3 && w <= 5) { periodEnd = L.addDays(payday, 5 - w); due = L.addDays(periodEnd, 5); }   // Wed-Fri -> following Wednesday
    else { periodEnd = L.addDays(payday, (2 - w + 7) % 7); due = L.addDays(periodEnd, 3); }   // Sat-Tue -> following Friday
    // at least three business days after the period closes
    var n = 0, t = periodEnd; while (L.d(t) < L.d(due)) { t = L.addDays(t, 1); if (isBiz(t)) n++; }
    while (n < 3 || !isBiz(due)) { due = L.addDays(due, 1); if (isBiz(due)) n++; }
    return { date: due, why: 'Semiweekly: ' + (w >= 3 && w <= 5 ? 'Wednesday to Friday payday, due the following Wednesday' : 'Saturday to Tuesday payday, due the following Friday') };
  }

  // ---- read the recorded run --------------------------------------------------------------------------
  function extract(src) {
    var W = function (name) { return src.json(new RegExp('/preparation/worksheet/' + name.replace(/ /g, ' ') + '$')); };
    var E = function (name) { return src.json(new RegExp('/preparation/evidence/' + name + '$')); };
    return Promise.all([W('Social Security and Medicare'), E('E05 Register'), E('E02 Year to Date'), E('E06 Deposits'), W('Summary'), src.json(/\/preparation$/)]).then(function (a) {
      var ssm = a[0].rows, reg = a[1].rows, ytd = a[2].rows, dep = a[3].rows, sum = a[4].rows, prep = a[5];
      var rates = {
        ss: +L.cell(ssm, 'B8'), med: +L.cell(ssm, 'B9'), addl: +L.cell(ssm, 'B10'),
        base: +L.cell(ssm, 'B14'), addlThreshold: +L.cell(ssm, 'B15')
      };
      // payday blocks: each ends with its "Payday total" row
      var hdr = L.findRow(reg, 0, /^Payroll$/), paydays = [], paychecks = {};
      for (var i = hdr + 1; i < reg.length; i++) {
        var r = reg[i]; if (!r || r[0] == null) continue;
        if (r[4] === 'Payday total') {
          paydays.push({ payroll: r[0], date: r[1], periodStart: r[2], periodEnd: r[3], gross: r[11], k401: r[12], s125: r[13], fit: r[14], ssW: r[15], medW: r[16], addlW: r[17], tips: 0, checks: +String(r[5]).replace(/\D/g, '') || 0 });
        } else if (/^E-\d+/.test(String(r[4]))) {
          (paychecks[r[4]] = paychecks[r[4]] || { id: r[4], name: r[5], by: {} }).by[r[0]] = r2((+r[11] || 0) - (+r[13] || 0));
        }
      }
      // line 1: paychecks on the payroll whose pay period includes September 12
      var line1 = 0;
      paydays.forEach(function (p) { if (L.d(p.periodStart) <= L.d('2026-09-12') && L.d('2026-09-12') <= L.d(p.periodEnd)) line1 = p.checks; });
      // employees whose Q3 wages cross the Social Security wage base or the Additional Medicare threshold
      var yh = L.findRow(ytd, 0, /^Employee$/), ytdBy = {};
      for (var j = yh + 1; j < ytd.length; j++) { var y = ytd[j]; if (y && /^E-\d+/.test(String(y[0]))) ytdBy[y[0]] = { ss: +y[10] || 0, med: +y[12] || 0 }; }
      var capped = [];
      Object.keys(paychecks).forEach(function (id) {
        var pc = paychecks[id], yy = ytdBy[id] || { ss: 0, med: 0 };
        var wages = paydays.map(function (p) { return pc.by[p.payroll] || 0; }), q3 = L.sum(wages);
        if (yy.ss + q3 > rates.base || yy.med + q3 > rates.addlThreshold) capped.push({ id: id, name: pc.name, ssYtd: yy.ss, medYtd: yy.med, wages: wages });
      });
      // deposit log
      var dh = L.findRow(dep, 0, /^Payroll$/), deposits = [];
      for (var k = dh + 1; k < dep.length; k++) { var dr = dep[k]; if (dr && typeof dr[0] === 'number') deposits.push({ payroll: dr[0], date: dr[2], ack: L.mask(dr[3]), amount: dr[6] }); }
      var recorded = {}; (prep.items || []).forEach(function (it) { recorded[it.id] = it.value; });
      var cites = {}; ((prep.research || {}).rules || []).forEach(function (r) { cites[r.id] = { title: r.sourceTitle, url: r.sourceUrl, rule: r.ruleOrLimit }; });
      var credit = +L.cell(sum, 'B15') || 0;
      var inputs = {
        rates: rates, line1: line1, credit11: credit, lookbackOver50k: true,
        paydays: paydays.map(function (p) { return { payroll: p.payroll, date: p.date, gross: p.gross, k401: p.k401, s125: p.s125, tips: 0, fit: p.fit, ssW: p.ssW, medW: p.medW, addlW: p.addlW }; }),
        capped: capped,
        deposits: paydays.map(function (p) { var dd = deposits.filter(function (x) { return x.payroll === p.payroll; })[0] || { date: '', amount: 0, ack: '' }; return { payroll: p.payroll, date: dd.date, amount: dd.amount, ack: dd.ack }; })
      };
      return { inputs: inputs, recorded: recorded, cites: cites, entity: prep.entity };
    });
  }

  // ---- calculate ----------------------------------------------------------------------------------------
  function calc(inp) {
    var R = inp.rates, P = inp.paydays, n = P.length;
    var m5a = R.ss * 2, m5c = R.med * 2, m5d = R.addl;   // 0.124, 0.029, 0.009
    // wages paid past the Social Security wage base, and Additional Medicare wages, employee by employee
    var pastBy = P.map(function () { return 0; }), addlBy = P.map(function () { return 0; }), line5d1 = 0, people = [];
    (inp.capped || []).forEach(function (e) {
      var left = Math.max(0, r2(R.base - (+e.ssYtd || 0))), cum = +e.medYtd || 0, rows = [];
      for (var j = 0; j < n; j++) {
        var w = +(e.wages || [])[j] || 0, ssw = Math.min(w, left), past = r2(w - ssw);
        var over = r2(Math.max(0, cum + w - R.addlThreshold) - Math.max(0, cum - R.addlThreshold));
        rows.push({ wage: w, baseLeft: left, ssWages: ssw, past: past, addl: over });
        left = r2(left - ssw); cum = r2(cum + w);
        pastBy[j] = r2(pastBy[j] + past); addlBy[j] = r2(addlBy[j] + over);
      }
      var q3 = L.sum(e.wages || []);
      var d1 = r2(Math.max(0, (+e.medYtd || 0) + q3 - R.addlThreshold) - Math.max(0, (+e.medYtd || 0) - R.addlThreshold));
      line5d1 = r2(line5d1 + d1);
      people.push({ id: e.id, name: e.name, q3: q3, past: L.sum(rows, function (x) { return x.past; }), addl: d1, rows: rows });
    });
    var T = function (k) { return L.sum(P, function (p) { return p[k]; }); };
    var gross = T('gross'), k401 = T('k401'), s125 = T('s125'), tips = T('tips'), fit = T('fit'), ssW = T('ssW'), medW = T('medW'), addlW = T('addlW');
    var pastTotal = L.sum(pastBy);
    var L2 = r2(gross - k401 - s125 + tips), L3 = fit;
    var medWagesNoTips = r2(gross - s125);
    var L5c1 = r2(medWagesNoTips + tips), L5c2 = r2(L5c1 * m5c);
    var L5a1 = r2(medWagesNoTips - pastTotal), L5a2 = r2(L5a1 * m5a);
    var L5b1 = tips, L5b2 = r2(L5b1 * m5a);
    var L5d1 = line5d1, L5d2 = r2(L5d1 * m5d);
    var L5e = r2(L5a2 + L5b2 + L5c2 + L5d2);
    var L6 = r2(L3 + L5e);
    var empShare = r2(r2(L5a1 * R.ss) + r2(L5b1 * R.ss) + r2(L5c1 * R.med) + L5d2);
    var L7 = r2(ssW + medW + addlW - empShare);
    var L10 = r2(L6 + L7);
    var L11 = Math.min(Math.max(0, +inp.credit11 || 0), Math.max(0, L10));
    var L12 = r2(L10 - L11);
    var dep = inp.deposits || [];
    var L13 = L.sum(dep, function (x) { return x.amount; });
    var L14 = Math.max(0, r2(L12 - L13)), L15 = Math.max(0, r2(L13 - L12));

    // Schedule B: each payday's liability on the date wages were paid
    var creditLeft = L11;
    var sched = P.map(function (p, j) {
      var med = r2((+p.gross || 0) - (+p.s125 || 0) + (+p.tips || 0)), ss = r2((+p.gross || 0) - (+p.s125 || 0) - pastBy[j] + (+p.tips || 0));
      var B = +p.fit || 0, C = r2((+p.ssW || 0) + (+p.medW || 0) + (+p.addlW || 0));
      var D = r2(ss * R.ss) + r2(med * R.med);
      var E = r2(B + C + D);
      var cr = Math.min(creditLeft, E); creditLeft = r2(creditLeft - cr);
      return { payroll: p.payroll, date: p.date, fit: B, employee: C, employer: r2(D), medWages: med, ssWages: ss, past: pastBy[j], addlWages: addlBy[j], credit: cr, liability: r2(E - cr) };
    });
    var months = {};
    sched.forEach(function (s) { var k = String(s.date).slice(0, 7); months[k] = r2((months[k] || 0) + s.liability); });
    var monthKeys = Object.keys(months).sort();
    var schedTotal = L.sum(sched, function (s) { return s.liability; });

    // deposit schedule and timeliness
    var semi = !!inp.lookbackOver50k, became = false;
    var deposits = sched.map(function (s, j) {
      var dp = dep[j] || { date: '', amount: 0 };
      var due = dueDate(s.date, s.liability, semi || became);
      if (s.liability >= 100000) became = true;
      var amt = +dp.amount || 0, diff = r2(s.liability - amt);
      var allow = Math.max(100, r2(s.liability * 0.02));
      var late = L.validDate(dp.date) && L.validDate(due.date) ? Math.max(0, L.daysBetween(due.date, dp.date)) : null;
      var status, ok;
      if (!L.validDate(dp.date)) { status = 'No deposit date'; ok = false; }
      else if (diff > 0.004 && diff > allow) { status = 'Short by ' + L.money(diff); ok = false; }
      else if (late > 0) { status = late + (late === 1 ? ' day' : ' days') + ' late'; ok = false; }
      else if (diff > 0.004) { status = 'Short by ' + L.money(diff) + ', inside the $100 / 2% allowance if made up'; ok = 'warn'; }
      else if (diff < -0.004) { status = 'Over by ' + L.money(-diff); ok = 'warn'; }
      else { status = 'On time and in full'; ok = true; }
      var rate = late == null || late <= 0 ? 0 : late <= 5 ? 0.02 : late <= 15 ? 0.05 : 0.10;
      var penalty = r2(rate * Math.min(amt, s.liability)) + (diff > 0.004 && diff > allow ? r2(0.10 * diff) : 0);
      return { payroll: s.payroll, payday: s.date, liability: s.liability, date: dp.date, amount: amt, diff: diff, due: due.date, why: due.why, late: late, status: status, ok: ok, penalty: r2(penalty) };
    });

    // checks
    var paychecks = (+inp.line1 || 0) * n;
    var checks = [];
    checks.push({ label: 'Schedule B total equals line 12', ok: Math.abs(r2(schedTotal - L12)) < 0.005, detail: L.money(schedTotal) + ' vs ' + L.money(L12) + ', difference ' + L.money(r2(schedTotal - L12)) });
    checks.push({ label: 'Line 13 deposits equal line 12', ok: Math.abs(r2(L13 - L12)) < 0.005, detail: L14 > 0 ? 'Balance due ' + L.money(L14) + ' (line 14)' : L15 > 0 ? 'Overpaid ' + L.money(L15) + ' (line 15)' : 'Deposits ' + L.money(L13) + ' cover line 12 to the cent' });
    checks.push({ label: 'Each deposit matches its payday liability', ok: deposits.every(function (x) { return Math.abs(x.diff) < 0.005; }) ? true : deposits.some(function (x) { return x.ok === false; }) ? false : 'warn', detail: deposits.filter(function (x) { return Math.abs(x.diff) >= 0.005; }).map(function (x) { return L.shortDate(x.payday) + ' ' + L.money(x.diff); }).join('; ') || 'All six to the cent' });
    checks.push({ label: 'Every deposit made by its due date', ok: deposits.every(function (x) { return x.late === 0; }), detail: deposits.filter(function (x) { return x.late !== 0; }).map(function (x) { return L.shortDate(x.payday) + ': ' + x.status; }).join('; ') || 'All on or before the due date' });
    checks.push({ label: 'Line 7 is only fractions of cents', ok: Math.abs(L7) <= Math.max(1, paychecks * 0.02) ? true : 'warn', detail: L.money(L7) + (Math.abs(L7) <= Math.max(1, paychecks * 0.02) ? ' (within $0.02 a paycheck)' : ': larger than rounding. The withheld amounts do not match the wages entered; use “Withheld at the statutory rates” or check the register.') });
    var capOk = true, capDetail = [];
    for (var j2 = 0; j2 < n; j2++) { var cw = L.sum(inp.capped || [], function (e) { return (e.wages || [])[j2]; }); if (cw > sched[j2].medWages + 0.004) { capOk = false; capDetail.push(L.shortDate(P[j2].date) + ': employees listed ' + L.money(cw) + ' > payday Medicare wages ' + L.money(sched[j2].medWages)); } }
    checks.push({ label: 'Wage-base employees fit inside each payday', ok: capOk, detail: capOk ? 'Their wages are part of the payday totals' : capDetail.join('; ') });
    checks.push({ label: 'Deposit schedule', ok: true, detail: (semi ? 'Semiweekly (lookback taxes over $50,000): line 16 third box, Schedule B attached' : became ? 'Monthly by lookback, but a $100,000 day made it semiweekly: Schedule B attached' : 'Monthly schedule depositor: line 16 second box, monthly amounts') + (L12 < 2500 ? '. Line 12 under $2,500: may be paid with a timely return' : '') });

    return {
      lines: { L1: +inp.line1 || 0, L2: L2, L3: L3, L5a1: L5a1, L5a2: L5a2, L5b1: L5b1, L5b2: L5b2, L5c1: L5c1, L5c2: L5c2, L5d1: L5d1, L5d2: L5d2, L5e: L5e, L6: L6, L7: L7, L10: L10, L11: L11, L12: L12, L13: L13, L14: L14, L15: L15 },
      totals: { gross: gross, k401: k401, s125: s125, tips: tips, ssW: ssW, medW: medW, addlW: addlW, past: pastTotal, empShare: empShare },
      people: people, sched: sched, months: monthKeys.map(function (k) { return { month: k, liability: months[k] }; }), schedTotal: schedTotal,
      deposits: deposits, semiweekly: semi || became, checks: checks
    };
  }

  // employee shares at the statutory rates, payday by payday (fills ssW, medW, addlW)
  function statutory(inp) {
    var c = calc(inp);
    return c.sched.map(function (s) { return { ssW: r2(s.ssWages * inp.rates.ss), medW: r2(s.medWages * inp.rates.med), addlW: r2(s.addlWages * inp.rates.addl) }; });
  }

  // the recorded figures this calculation must reproduce (preparation item id -> calc value)
  function compare(c) {
    var l = c.lines, out = { 'line-1': l.L1, 'line-2': l.L2, 'line-3': l.L3, 'line-5a-1': l.L5a1, 'line-5a-2': l.L5a2, 'line-5c-1': l.L5c1, 'line-5c-2': l.L5c2, 'line-5d-1': l.L5d1, 'line-5d-2': l.L5d2, 'line-5e': l.L5e, 'line-6': l.L6, 'line-7': l.L7, 'line-10': l.L10, 'line-12': l.L12, 'line-13': l.L13, 'line-14': l.L14, 'schedule-b-total': c.schedTotal };
    c.months.forEach(function (m, i) { out['schedule-b-month-' + (i + 1)] = m.liability; });
    c.sched.forEach(function (s) { out['schedule-b-' + s.payroll] = s.liability; });
    c.deposits.forEach(function (x) { out['deposit-' + x.payroll] = x.amount; });
    return out;
  }

  return { id: 'tax-941', extract: extract, calc: calc, statutory: statutory, compare: compare, dueDate: dueDate, HOLIDAYS: HOLIDAYS };
});
