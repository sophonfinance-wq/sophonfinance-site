/* F1 Finance demos · "Try your own numbers" · Form 1040 (tax year 2025) calculation.
   extract(src) reads the recorded run's W-2s, 1099s, Schedule A records, estimated payments and the workpapers'
   own rule values (married filing jointly) into editable inputs; calc(inputs) rebuilds the return the same way
   the recorded workpapers do. Values for the other filing statuses are the published 2025 amounts (cited). No DOM. */
(function (root, factory) {
  var L = (root && root.FFLive && root.FFLive.lib) || (typeof require === 'function' ? require('../lib.js') : null);
  var m = factory(L);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.FFLive = root.FFLive || {}; (root.FFLive.calc = root.FFLive.calc || {})['tax-1040'] = m; }
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  var r2 = L.round2;

  // 2025 brackets (taxable income where each rate ends), Rev. Proc. 2024-40 section 3.01 as kept by P.L. 119-21.
  var RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
  var STATUS = {
    single: { label: 'Single', brackets: [11925, 48475, 103350, 197300, 250525, 626350], std: 15750, salt: 40000, saltPhase: 500000, saltFloor: 10000, qd0: 48350, qd15: 533400, ctcPhase: 200000, addlMed: 200000, niit: 200000, amtEx: 88100, amtPhase: 626350, amt26: 239100, mort: 750000, prior110: 150000 },
    mfj: { label: 'Married filing jointly', brackets: [23850, 96950, 206700, 394600, 501050, 751600], std: 31500, salt: 40000, saltPhase: 500000, saltFloor: 10000, qd0: 96700, qd15: 600050, ctcPhase: 400000, addlMed: 250000, niit: 250000, amtEx: 137000, amtPhase: 1252700, amt26: 239100, mort: 750000, prior110: 150000 },
    mfs: { label: 'Married filing separately', brackets: [11925, 48475, 103350, 197300, 250525, 375800], std: 15750, salt: 20000, saltPhase: 250000, saltFloor: 5000, qd0: 48350, qd15: 300000, ctcPhase: 200000, addlMed: 125000, niit: 125000, amtEx: 68500, amtPhase: 626350, amt26: 119550, mort: 375000, prior110: 75000 },
    hoh: { label: 'Head of household', brackets: [17000, 64850, 103350, 197300, 250500, 626350], std: 23625, salt: 40000, saltPhase: 500000, saltFloor: 10000, qd0: 64750, qd15: 566700, ctcPhase: 200000, addlMed: 200000, niit: 200000, amtEx: 88100, amtPhase: 626350, amt26: 239100, mort: 750000, prior110: 150000 }
  };
  var SOURCES = {
    brackets: { title: 'Instructions for Form 1040 (2025): Tax Table and Tax Computation Worksheet', url: 'https://www.irs.gov/instructions/i1040gi' },
    std: { title: 'Instructions for Form 1040 (2025): standard deduction', url: 'https://www.irs.gov/instructions/i1040gi' },
    qdcg: { title: 'Instructions for Form 1040 (2025): Qualified Dividends and Capital Gain Tax Worksheet', url: 'https://www.irs.gov/instructions/i1040gi' },
    salt: { title: 'Instructions for Schedule A (2025), line 5e', url: 'https://www.irs.gov/instructions/i1040sca' },
    mort: { title: 'Publication 936 (2025), Home Mortgage Interest Deduction', url: 'https://www.irs.gov/publications/p936' },
    charity: { title: 'Publication 526 (2025), Charitable Contributions', url: 'https://www.irs.gov/publications/p526' },
    ctc: { title: 'Instructions for Schedule 8812 (2025)', url: 'https://www.irs.gov/instructions/i1040s8' },
    addl: { title: 'Instructions for Form 8959 (2025)', url: 'https://www.irs.gov/instructions/i8959' },
    niit: { title: 'Instructions for Form 8960 (2025)', url: 'https://www.irs.gov/instructions/i8960' },
    amt: { title: 'Instructions for Form 6251 (2025)', url: 'https://www.irs.gov/instructions/i6251' },
    est: { title: 'Instructions for Form 2210 (2025)', url: 'https://www.irs.gov/instructions/i2210' }
  };

  // Tax Computation Worksheet rows (rate, subtraction) for amounts of $100,000 or more, derived from the brackets.
  function tcw(br) {
    var rows = [], below = 0, prev = 0, taxAt = [];
    for (var i = 0; i < br.length; i++) { below += (br[i] - prev) * RATES[i]; taxAt.push(below); prev = br[i]; }
    for (var k = 2; k < RATES.length; k++) {
      var start = br[k - 1], sub = r2(start * RATES[k] - taxAt[k - 1]);
      if (k === 2) start = 100000;
      rows.push({ over: k === 2 ? 100000 : br[k - 1], upTo: br[k] || Infinity, rate: RATES[k], sub: sub });
    }
    return rows;
  }
  function exactTax(x, br) { var t = 0, prev = 0; for (var i = 0; i < RATES.length; i++) { var top = i < br.length ? br[i] : Infinity; if (x > prev) t += (Math.min(x, top) - prev) * RATES[i]; prev = top; } return t; }
  // Form 1040 tax: Tax Table below $100,000 (tax on the midpoint of the row, whole dollars), worksheet above.
  function taxOn(x, st, rows) {
    x = Math.max(0, x);
    if (x <= 0) return 0;
    if (x < 100000) {
      var lo, hi;
      if (x < 5) { lo = 0; hi = 5; } else if (x < 15) { lo = 5; hi = 15; } else if (x < 25) { lo = 15; hi = 25; }
      else if (x < 3000) { lo = Math.floor(x / 25) * 25; hi = lo + 25; } else { lo = Math.floor(x / 50) * 50; hi = lo + 50; }
      return Math.round(exactTax((lo + hi) / 2, st.brackets));
    }
    var best = -Infinity; rows.forEach(function (r) { best = Math.max(best, x * r.rate - r.sub); });
    return r2(best);
  }

  // ---- read the recorded run --------------------------------------------------------------------------
  function extract(src) {
    var W = function (n) { return src.json(new RegExp('/preparation/worksheet/' + n + '$')); };
    var E = function (n) { return src.json(new RegExp('/preparation/evidence/' + n + '$')); };
    return Promise.all([W('Income'), W('Itemized'), W('Tax'), W('Credits and Payments'), W('Other Taxes'), W('Estimated Tax'),
      E('E03 Forms W-2'), E('E04 Forms 1099'), E('E06 Mortgage'), E('E07 Taxes Paid'), E('E08 Gifts'), E('E09 Estimates'), E('E02 Prior Return'), src.json(/\/preparation$/)]).then(function (a) {
      var inc = a[0].rows, ita = a[1].rows, tax = a[2].rows, cp = a[3].rows, ot = a[4].rows, est = a[5].rows;
      var w2 = a[6].rows, f99 = a[7].rows, mort = a[8].rows, txp = a[9].rows, gifts = a[10].rows, esti = a[11].rows, prior = a[12].rows, prep = a[13];
      var C = L.cell;
      // the workpapers' own rule values for a joint return
      var mfj = L.clone(STATUS.mfj);
      mfj.std = +C(ita, 'B26'); mfj.salt = +C(ita, 'B11'); mfj.saltPhase = +C(ita, 'B12'); mfj.saltRate = +C(ita, 'B13'); mfj.saltFloor = +C(ita, 'B14');
      mfj.qd0 = +C(tax, 'B20'); mfj.qd15 = +C(tax, 'B27'); mfj.qdRate15 = +C(tax, 'B46'); mfj.qdRate20 = +C(tax, 'B47');
      mfj.tcw = [41, 42, 43, 44, 45].map(function (r) { return { rate: +C(tax, 'B' + r), sub: +C(tax, 'C' + r) }; });
      mfj.ctc = +C(cp, 'B12'); mfj.addlMed = +C(ot, 'B11'); mfj.addlRate = +C(ot, 'B13'); mfj.medRate = +C(ot, 'B16');
      mfj.niit = +C(ot, 'B24'); mfj.niitRate = +C(ot, 'B27'); mfj.amtEx = +C(ot, 'B37'); mfj.amtRate = +C(ot, 'B39');
      mfj.estCur = +C(est, 'C9'); mfj.estPrior = +C(est, 'C11');
      // W-2s
      var wh = L.findRow(w2, 0, /^Form$/), W2 = [];
      for (var i = wh + 1; i < w2.length; i++) { var r = w2[i]; if (!r || !/^W-2/.test(String(r[0]))) break; W2.push({ employee: r[1], employer: r[2], box1: r[4], box2: r[5], box5: r[8], box6: r[9] }); }
      // Schedule A records
      var sales = 0, realEstate = 0; var th = L.findRow(txp, 1, /^Type$/);
      for (var j = th + 1; j < txp.length; j++) { var t = txp[j]; if (!t || !/^\d{4}-/.test(String(t[0]))) continue; if (/real estate/i.test(t[1])) realEstate = r2(realEstate + t[3]); else if (/sales/i.test(t[1])) sales = r2(sales + t[3]); }
      var gh = L.findRow(gifts, 0, /^Date$/), giftList = [];
      for (var g = gh + 1; g < gifts.length; g++) { var gr = gifts[g]; if (!gr || !/^\d{4}-/.test(String(gr[0]))) continue; giftList.push({ date: gr[0], org: gr[1], amount: gr[2], ack: !/^None/i.test(String(gr[4])) || +gr[2] < 250 }); }
      var mortgages = [{ lender: String(C(mort, 'B8')) + ' (Form 1098)', interest: +C(mort, 'B9'), form1098: true }, { lender: String(C(mort, 'B13')) + ' (payoff statement, no Form 1098)', interest: +C(mort, 'B18'), form1098: false }];
      var eh = L.findRow(esti, 0, /^Installment$/), ests = [];
      for (var e = eh + 1; e < esti.length; e++) { var er = esti[e]; if (!er || typeof er[0] !== 'number') continue; ests.push({ due: er[1], date: er[2], amount: er[3], creditedTo: String(er[5]) }); }
      var recorded = {}; (prep.items || []).forEach(function (it) { recorded[it.id] = it.value; });
      var inputs = {
        status: 'mfj',
        w2: W2,
        interest: +C(inc, 'B11'), ordDiv: +C(inc, 'B13'), qualDiv: +C(inc, 'B12'), capGain: +C(tax, 'B17') || 0, adjustments: +C(inc, 'B15') || 0,
        salesTax: sales, realEstate: realEstate, otherTaxes: 0,
        mortgages: mortgages, acquisitionDebt: +C(mort, 'B10'),
        gifts: giftList,
        qbi: +C(tax, 'B10') || 0, sched1A: +C(tax, 'B11') || 0,
        children: +C(cp, 'B11'), otherDependents: 0,
        estimates: ests, priorApplied: +C(prior, 'B16') || 0,
        priorTax: +C(prior, 'B13'), priorAgi: +C(prior, 'B11'),
        rules: { mfj: mfj }
      };
      return { inputs: inputs, recorded: recorded, entity: 'Celeste and Brennan Whitford (demonstration clients)' };
    });
  }

  function rulesFor(inp) {
    var base = L.clone(STATUS[inp.status] || STATUS.mfj), own = (inp.rules || {})[inp.status];
    if (own) for (var k in own) base[k] = own[k];
    base.saltRate = base.saltRate || 0.3; base.qdRate15 = base.qdRate15 || 0.15; base.qdRate20 = base.qdRate20 || 0.2;
    base.ctc = base.ctc || 2200; base.addlRate = base.addlRate || 0.009; base.medRate = base.medRate || 0.0145; base.niitRate = base.niitRate || 0.038; base.amtRate = base.amtRate || 0.26;
    base.estCur = base.estCur || 0.9; base.estPrior = base.estPrior || 1.1;
    if (!base.tcw) base.tcw = tcw(base.brackets); else { var der = tcw(base.brackets); base.tcw = base.tcw.map(function (r, i) { return { over: der[i].over, upTo: der[i].upTo, rate: r.rate, sub: r.sub }; }); }
    return base;
  }

  // ---- calculate ----------------------------------------------------------------------------------------
  function calc(inp) {
    var S = rulesFor(inp), out = { rules: S, lines: {}, sa: {}, qd: {}, s2: {}, amt: {}, est: {}, notes: [] };
    var l = out.lines;
    var w2 = inp.w2 || [];
    l.L1a = L.sum(w2, function (w) { return w.box1; }); l.L1z = l.L1a;
    l.L2b = +inp.interest || 0; l.L3a = Math.min(+inp.qualDiv || 0, +inp.ordDiv || 0); l.L3b = +inp.ordDiv || 0; l.L7 = +inp.capGain || 0;
    l.L9 = r2(l.L1z + l.L2b + l.L3b + l.L7);
    l.L10 = +inp.adjustments || 0;
    l.L11 = r2(l.L9 - l.L10);
    var agi = l.L11;

    // Schedule A
    var sa = out.sa;
    sa.L5a = r2((+inp.salesTax || 0)); sa.L5b = +inp.realEstate || 0; sa.L5c = +inp.otherTaxes || 0;
    sa.L5d = r2(sa.L5a + sa.L5b + sa.L5c);
    sa.limit = r2(Math.max(S.saltFloor, S.salt - Math.max(0, agi - S.saltPhase) * S.saltRate));
    sa.L5e = r2(Math.min(sa.L5d, sa.limit));
    var interest = L.sum(inp.mortgages || [], function (m) { return m.interest; }), debt = +inp.acquisitionDebt || 0;
    sa.mortgageAll = interest;
    sa.mortgageShare = debt > S.mort ? S.mort / debt : 1;
    sa.L8e = sa.mortgageShare < 1 ? r2(interest * sa.mortgageShare) : interest;
    var gifts = inp.gifts || [];
    sa.giftsAll = L.sum(gifts, function (g) { return g.amount; });
    sa.giftsNoAck = L.sum(gifts, function (g) { return (+g.amount >= 250 && !g.ack) ? g.amount : 0; });
    sa.giftsAllowed = r2(sa.giftsAll - sa.giftsNoAck);
    sa.charityCap = r2(agi * 0.6);
    sa.L11 = r2(Math.min(sa.giftsAllowed, Math.max(0, sa.charityCap)));
    sa.carryover = r2(sa.giftsAllowed - sa.L11);
    sa.L14 = sa.L11;
    sa.L17 = r2(sa.L5e + sa.L8e + sa.L14);
    l.std = S.std;
    l.itemizes = sa.L17 > S.std;
    l.L12e = r2(Math.max(sa.L17, S.std));
    l.L13a = +inp.qbi || 0; l.L13b = +inp.sched1A || 0;
    l.L14 = r2(l.L12e + l.L13a + l.L13b);
    l.L15 = r2(Math.max(0, agi - l.L14));
    var ti = l.L15;

    // Qualified Dividends and Capital Gain Tax Worksheet
    var q = out.qd;
    q.w1 = ti; q.w2 = l.L3a; q.w3 = Math.max(0, l.L7); q.w4 = r2(q.w2 + q.w3); q.w5 = r2(Math.max(0, q.w1 - q.w4));
    q.w6 = S.qd0; q.w7 = Math.min(q.w1, q.w6); q.w8 = Math.min(q.w5, q.w7); q.w9 = r2(q.w7 - q.w8);
    q.w10 = Math.min(q.w1, q.w4); q.w11 = q.w9; q.w12 = r2(q.w10 - q.w11);
    q.w13 = S.qd15; q.w14 = Math.min(q.w1, q.w13); q.w15 = r2(q.w5 + q.w9); q.w16 = r2(Math.max(0, q.w14 - q.w15));
    q.w17 = Math.min(q.w12, q.w16); q.w18 = r2(q.w17 * S.qdRate15); q.w19 = r2(q.w9 + q.w17); q.w20 = r2(q.w10 - q.w19); q.w21 = r2(q.w20 * S.qdRate20);
    q.w22 = taxOn(q.w5, S, S.tcw); q.w23 = r2(q.w18 + q.w21 + q.w22); q.w24 = taxOn(q.w1, S, S.tcw); q.w25 = Math.min(q.w23, q.w24);
    q.used = q.w4 > 0;
    l.L16 = q.used ? q.w25 : q.w24;

    // Form 6251 screen (no preference items other than the state and local tax deduction)
    var a = out.amt;
    a.ti = ti; a.saltBack = l.itemizes ? sa.L5e : 0; a.amti = r2(a.ti + a.saltBack);
    a.exemption = Math.max(0, r2(S.amtEx - Math.max(0, a.amti - S.amtPhase) * 0.25));
    a.base = r2(Math.max(0, a.amti - a.exemption));
    a.qdInside = Math.min(a.base, q.w4);
    var ordinary = r2(a.base - a.qdInside);
    var ordTax = ordinary <= S.amt26 ? r2(ordinary * S.amtRate) : r2(S.amt26 * S.amtRate + (ordinary - S.amt26) * 0.28);
    // dividends inside the AMT base keep their 0% / 15% / 20% rates, using the regular worksheet's ordinary income
    var room0 = Math.max(0, S.qd0 - q.w5), at0 = Math.min(a.qdInside, room0);
    var room15 = Math.max(0, S.qd15 - q.w5 - at0), at15 = Math.min(r2(a.qdInside - at0), room15), at20 = r2(a.qdInside - at0 - at15);
    var split = r2(ordTax + at15 * S.qdRate15 + at20 * S.qdRate20);
    var flat = a.base <= S.amt26 ? r2(a.base * S.amtRate) : r2(S.amt26 * S.amtRate + (a.base - S.amt26) * 0.28);
    a.tmt = a.qdInside > 0 ? Math.min(split, flat) : flat;
    a.L17 = r2(Math.max(0, a.tmt - l.L16));
    l.L17 = a.L17;
    l.L18 = r2(l.L16 + l.L17);

    // child tax credit and credit for other dependents (Schedule 8812)
    var kids = Math.max(0, Math.floor(+inp.children || 0)), others = Math.max(0, Math.floor(+inp.otherDependents || 0));
    var maxCredit = kids * S.ctc + others * 500, over = Math.max(0, agi - S.ctcPhase);
    var reduction = over > 0 ? Math.ceil(over / 1000) * 50 : 0;
    var credit = Math.max(0, maxCredit - reduction);
    l.L19 = r2(Math.min(l.L18, credit));
    var earned = l.L1z;
    l.L28 = kids ? r2(Math.max(0, Math.min(r2(credit - l.L19), kids * 1700, Math.max(0, (earned - 2500) * 0.15)))) : 0;
    l.ctcMax = maxCredit; l.ctcReduction = reduction;
    l.L22 = r2(Math.max(0, l.L18 - l.L19));

    // Schedule 2: Additional Medicare Tax (Form 8959) and net investment income tax (Form 8960)
    var s2 = out.s2;
    s2.medWages = L.sum(w2, function (w) { return w.box5; }); s2.addlOver = r2(Math.max(0, s2.medWages - S.addlMed)); s2.L11 = r2(s2.addlOver * S.addlRate);
    s2.medWithheld = L.sum(w2, function (w) { return w.box6; }); s2.regular = r2(s2.medWages * S.medRate); s2.addlWithheld = r2(Math.max(0, s2.medWithheld - s2.regular));
    s2.nii = r2(l.L2b + l.L3b + Math.max(0, l.L7)); s2.magiOver = r2(Math.max(0, agi - S.niit)); s2.niiBase = Math.min(s2.nii, s2.magiOver); s2.L12 = r2(s2.niiBase * S.niitRate);
    s2.L21 = r2(s2.L11 + s2.L12);
    l.L23 = s2.L21;
    l.L24 = r2(l.L22 + l.L23);

    // payments
    l.L25a = L.sum(w2, function (w) { return w.box2; });
    l.L25c = s2.addlWithheld;
    l.L25d = r2(l.L25a + l.L25c);
    var ests = inp.estimates || [];
    l.L26 = r2(L.sum(ests, function (x) { return String(x.creditedTo) === '2025' ? x.amount : 0; }) + (+inp.priorApplied || 0));
    l.notCredited = L.sum(ests, function (x) { return String(x.creditedTo) === '2025' ? 0 : x.amount; });
    l.L33 = r2(l.L25d + l.L26 + l.L28);
    l.L34 = r2(Math.max(0, l.L33 - l.L24));
    l.L37 = r2(Math.max(0, l.L24 - l.L33));

    // estimated tax: required annual payment (Form 2210 Part I) and the four installments
    var e = out.est;
    e.cur = r2(l.L24 * S.estCur);
    e.priorRate = (+inp.priorAgi || 0) > S.prior110 ? S.estPrior : 1;
    e.prior = r2((+inp.priorTax || 0) * e.priorRate);
    e.required = (+inp.priorTax || 0) > 0 ? Math.min(e.cur, e.prior) : e.cur;
    e.withholding = l.L25d;
    var dues = ['2025-04-15', '2025-06-16', '2025-09-15', '2026-01-15'];
    e.rows = dues.map(function (due, i) {
      var share = (i + 1) / 4, req = r2(e.required * share), wh = r2(e.withholding * share);
      var paid = L.sum(ests, function (x) { return String(x.creditedTo) === '2025' && L.validDate(x.date) && L.d(x.date) <= L.d(due) ? x.amount : 0; });
      return { due: due, share: share, required: req, withholding: wh, estimates: paid, shortfall: r2(Math.max(0, req - wh - paid)) };
    });
    e.small = r2(l.L24 - l.L25d) < 1000;
    e.penaltyRisk = !e.small && e.rows.some(function (x) { return x.shortfall > 0; });

    // checks
    var checks = out.checks = [];
    checks.push({ label: 'Qualified dividends are inside ordinary dividends', ok: (+inp.qualDiv || 0) <= (+inp.ordDiv || 0), detail: L.money(+inp.qualDiv || 0) + ' of ' + L.money(+inp.ordDiv || 0) });
    checks.push({ label: 'Deduction: itemized vs standard', ok: true, detail: (l.itemizes ? 'Itemized ' + L.money(sa.L17) + ' beats the standard ' : 'Standard deduction ' ) + L.money(S.std) + (l.itemizes ? '' : ' beats itemized ' + L.money(sa.L17)) });
    checks.push({ label: 'SALT limit', ok: sa.L5d <= sa.limit ? true : 'warn', detail: L.money(sa.L5d) + ' paid; limit ' + L.money(sa.limit) + (sa.L5d > sa.limit ? ', ' + L.money(r2(sa.L5d - sa.limit)) + ' not deductible' : '') });
    checks.push({ label: 'Mortgage interest within the acquisition-debt limit', ok: sa.mortgageShare >= 1 ? true : 'warn', detail: L.money(debt) + ' of debt vs ' + L.money(S.mort) + (sa.mortgageShare < 1 ? ': interest prorated to ' + L.money(sa.L8e) + ' (Publication 936 worksheet, simplified to average balance)' : '') });
    checks.push({ label: 'Gifts of $250 or more have a written acknowledgment', ok: sa.giftsNoAck > 0 ? 'warn' : true, detail: sa.giftsNoAck > 0 ? L.money(sa.giftsNoAck) + ' left out until the acknowledgment arrives' : 'All acknowledged' });
    checks.push({ label: 'Cash gifts within 60% of AGI', ok: sa.carryover > 0 ? 'warn' : true, detail: sa.carryover > 0 ? L.money(sa.carryover) + ' carries forward' : 'Limit ' + L.money(sa.charityCap) });
    checks.push({ label: 'Alternative minimum tax screen', ok: a.L17 > 0 ? 'warn' : true, detail: 'Tentative minimum tax ' + L.money(a.tmt) + ' vs regular tax ' + L.money(l.L16) + (a.L17 > 0 ? ': AMT ' + L.money(a.L17) : ': no AMT') });
    checks.push({ label: 'Estimated tax penalty (Form 2210)', ok: e.penaltyRisk ? 'warn' : true, detail: e.small ? 'Under $1,000 owed after withholding: no penalty' : e.penaltyRisk ? 'Shortfall at an installment; Form 2210 may apply' : 'No shortfall at any installment' });
    checks.push({ label: 'Payments tie', ok: true, detail: 'Line 33 ' + L.money(l.L33) + ' less line 24 ' + L.money(l.L24) + ' = ' + (l.L34 > 0 ? 'refund ' + L.money(l.L34) : 'owe ' + L.money(l.L37)) });
    if (l.notCredited > 0) out.notes.push(L.money(l.notCredited) + ' of estimated payments is credited by the IRS to another year and is left off line 26; the refund would be ' + L.money(r2(l.L34 + l.notCredited)) + (l.L37 > 0 ? ' (or the amount owed lower)' : '') + ' if it is moved to 2025.');
    return out;
  }

  function compare(c) {
    var l = c.lines, sa = c.sa, s2 = c.s2;
    return { line1a: l.L1a, line2b: l.L2b, line3a: l.L3a, line3b: l.L3b, line9: l.L9, line11: l.L11, line12e: l.L12e, line15: l.L15, line16: l.L16, line19: l.L19, line22: l.L22, line23: l.L23, line24: l.L24, line25a: l.L25a, line26: l.L26, line33: l.L33, line34: l.L34,
      'sa-5a': sa.L5a, 'sa-5b': sa.L5b, 'sa-5d': sa.L5d, 'sa-5e': sa.L5e, 'sa-8e': sa.L8e, 'sa-11': sa.L11, 's2-11': s2.L11, 's2-12': s2.L12 };
  }

  return { id: 'tax-1040', extract: extract, calc: calc, compare: compare, STATUS: STATUS, SOURCES: SOURCES, taxOn: taxOn, tcw: tcw };
});
