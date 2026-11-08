/* F1 Finance demos · "Try your own numbers" · 13-week cash flow forecast.
   extract(src, inflateRaw) reads the recorded run's workbook (13-Week Cash Forecast Workpapers.xlsx: every dated
   cash line, the minimum balance, the Section 7.3 covenant, the construction line and last week's forecast) into
   editable inputs; calc(inputs) rebuilds the 13-week table, the low week, the minimum-balance and covenant headroom
   checks and the flags the way the recorded workpapers do. No DOM. */
(function (root, factory) {
  var L = (root && root.FFLive && root.FFLive.lib) || (typeof require === 'function' ? require('../lib.js') : null);
  var m = factory(L);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.FFLive = root.FFLive || {}; (root.FFLive.calc = root.FFLive.calc || {})['accounting-cashflow'] = m; }
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  var r2 = L.round2;
  var RECEIPTS = ['Contract payments, expected', 'Customer deposits', 'Construction loan draws, expected', 'Other receipts'];
  var DISB = ['Vendor runs: open bills at November 2', 'Vendor runs: committed construction costs', 'Payroll', 'Construction loan interest', 'Equipment loan principal and interest', 'Office rent', 'Insurance premiums', 'Referral commissions', 'Utilities and bank charges', 'Equipment purchase (discretionary)'];

  function extract(src, inflateRaw) {
    return src.binary(/\/preparation\/workbook$/).then(function (buf) { return L.readXlsx(buf, inflateRaw); }).then(function (wb) {
      var C = L.cell, F = wb['Forecast'], CL = wb['Cash Lines'], MC = wb['Minimum and Covenant'], RC = wb['Receipts'], VA = wb['Variance'], SU = wb['Summary'], FI = wb['Findings'];
      var start = L.fromSerial(C(F, 'C5'));
      var receiptsCats = [], disbCats = [], sect = '';
      for (var i = 7; i < 25; i++) { var lab = (F[i] || [])[0]; if (!lab) continue; if (/^Receipts/.test(lab)) { sect = 'r'; continue; } if (/^Disbursements/.test(lab)) { sect = 'd'; continue; } if (/^Total/.test(lab)) continue; if (sect === 'r') receiptsCats.push(lab); else if (sect === 'd') disbCats.push(lab); }
      // planned (not yet submitted) draws, and receipts listed without a signed contract
      var planned = [], left = [];
      RC.forEach(function (r) {
        if (!r) return;
        if (/^Draw \d+ .*Planned/i.test(String(r[0]))) planned.push(String(r[0]).replace(/\s.*$/, '') + ' ' + String(r[0]).split(/\s+/)[1]);
        if (/^No:/i.test(String(r[9] || ''))) left.push({ date: typeof r[6] === 'number' ? L.fromSerial(r[6]) : '', category: 'Contract payments, expected', line: String(r[0]).replace(/\s*[·�]\s*/g, ', ') + ' (' + String(r[1]) + ')', amount: +r[5] || 0, status: 'Listed; no signed contract', include: false, noContract: true, rule: 'CF-2' });
      });
      var lines = [];
      for (var k = 4; k < CL.length; k++) {
        var r = CL[k] || []; if (typeof r[0] !== 'number' || !r[3]) continue;
        var desc = String(r[4] || '');
        lines.push({ date: L.fromSerial(r[0]), category: String(r[3]), line: desc, amount: +r[5] || 0, rule: r[6] || '', status: r[7] || '', include: true,
          assumed: r[3] === 'Construction loan draws, expected' && planned.some(function (p) { return desc.indexOf(p + ',') === 0 || desc.indexOf(p + ' ') === 0; }),
          discretionary: /discretionary/i.test(String(r[3])) });
      }
      left.forEach(function (x) { lines.push(x); });
      var conflict = FI.filter(function (r) { return r && /Payment Date Conflict/.test(String(r[0])); })[0];
      var lastWeek = [];
      for (var w = 14; w < 26; w++) { var vr = VA[w] || []; if (/^Week \d+/.test(String(vr[0]))) lastWeek.push({ week: +/^Week (\d+)/.exec(vr[0])[1], ending: +vr[2] || 0 }); }
      var recorded = {
        opening: +C(F, 'C7'), endings: 'CDEFGHIJKLMNO'.split('').map(function (c) { return +C(F, c + '27'); }),
        receipts: +C(F, 'P13'), disb: +C(F, 'P25'), ending: +C(F, 'O27'), low: +C(F, 'C32'), lowWeek: +C(SU, 'B9'), below: +C(MC, 'C36'),
        monthEnds: [5, 6, 7].map(function (rr) { return { unrestricted: +C(MC, 'E' + rr), headroom: +C(MC, 'G' + rr) }; }),
        headroom: +C(SU, 'B16'), variance: +C(SU, 'B17'), billings: +C(SU, 'B14'), draws: +C(RC, 'C24'), planned: +C(RC, 'C25'), available: +C(RC, 'C29'),
        withoutDraws: [+C(MC, 'E10'), +C(MC, 'E9')], restoreA: +C(MC, 'E39'), flags: +C(SU, 'B18')
      };
      return {
        inputs: {
          start: start, weeks: 13, opening: recorded.opening,
          minimum: +C(MC, 'C21'), covenantMin: +C(MC, 'F5'), petty: +C(MC, 'D5'),
          monthEnds: [5, 6, 7].map(function (rr) { return L.fromSerial(C(MC, 'B' + rr)); }),
          commitment: +C(RC, 'C27'), loanBalance: +C(RC, 'C28'),
          receiptsCats: receiptsCats.length ? receiptsCats : RECEIPTS, disbCats: disbCats.length ? disbCats : DISB,
          lines: lines,
          lastWeek: lastWeek,
          conflict: conflict ? { item: conflict[1], amount: +conflict[4] || 0, found: conflict[5], rule: conflict[6] } : null
        },
        recorded: recorded, entity: 'HANGS Construction Services LLC'
      };
    });
  }

  function calc(inp) {
    var W = +inp.weeks || 13, start = inp.start, end = L.addDays(start, W * 7 - 1);
    var cats = (inp.receiptsCats || RECEIPTS).concat(inp.disbCats || DISB);
    var grid = {}; cats.forEach(function (c) { grid[c] = []; for (var i = 0; i < W; i++) grid[c].push(0); });
    var used = [], outside = [], monthOf = function (dt) { for (var m = 0; m < inp.monthEnds.length; m++) if (L.d(dt) <= L.d(inp.monthEnds[m])) return m + 1; return inp.monthEnds.length + 1; };
    (inp.lines || []).forEach(function (x, ix) {
      if (!x.include) return;
      if (!L.validDate(x.date) || L.d(x.date) < L.d(start) || L.d(x.date) > L.d(end)) { outside.push(x); return; }
      var wk = Math.floor(L.daysBetween(start, x.date) / 7) + 1;
      if (!grid[x.category]) { grid[x.category] = []; for (var i = 0; i < W; i++) grid[x.category].push(0); cats.push(x.category); }
      grid[x.category][wk - 1] = r2(grid[x.category][wk - 1] + (+x.amount || 0));
      used.push({ ix: ix, week: wk, month: monthOf(x.date), line: x });
    });
    var rc = cats.filter(function (c) { return (inp.receiptsCats || RECEIPTS).indexOf(c) >= 0 || (L.sum(grid[c]) > 0 && (inp.disbCats || DISB).indexOf(c) < 0); });
    var dc = cats.filter(function (c) { return rc.indexOf(c) < 0; });
    var weeks = [], open = +inp.opening || 0;
    for (var w = 0; w < W; w++) {
      var rec = L.sum(rc, function (c) { return grid[c][w]; }), dis = L.sum(dc, function (c) { return grid[c][w]; });
      var net = r2(rec + dis), endc = r2(open + net);
      weeks.push({ week: w + 1, of: L.addDays(start, w * 7), through: L.addDays(start, w * 7 + 6), opening: open, receipts: rec, disb: dis, net: net, ending: endc, above: r2(endc - (+inp.minimum || 0)), below: endc < (+inp.minimum || 0) });
      open = endc;
    }
    var low = weeks.reduce(function (m, x) { return x.ending < m.ending ? x : m; }, weeks[0]);
    var belowBy = low.ending < (+inp.minimum || 0) ? r2((+inp.minimum || 0) - low.ending) : 0;
    var totalR = L.sum(weeks, function (x) { return x.receipts; }), totalD = L.sum(weeks, function (x) { return x.disb; });
    var allNet = L.sum(used, function (u) { return u.line.amount; });
    var proof = r2((+inp.opening || 0) + allNet - weeks[W - 1].ending);
    // month-end Section 7.3 minimum liquidity: operating cash + petty cash
    var monthEnds = inp.monthEnds.map(function (me, i) {
      var op = r2((+inp.opening || 0) + L.sum(used, function (u) { return u.month <= i + 1 ? u.line.amount : 0; }));
      var unr = r2(op + (+inp.petty || 0)), head = r2(unr - (+inp.covenantMin || 0));
      var assumed = L.sum(used, function (u) { return u.line.assumed && u.month <= i + 1 ? u.line.amount : 0; });
      var without = r2(unr - assumed);
      return { date: me, operating: op, petty: +inp.petty || 0, unrestricted: unr, minimum: +inp.covenantMin || 0, headroom: head, pct: inp.covenantMin ? Math.round(head / inp.covenantMin * 10000) / 10000 : 0, meets: unr >= (+inp.covenantMin || 0), withoutAssumed: without, assumed: assumed, meetsWithout: without >= (+inp.covenantMin || 0) };
    });
    var minHead = monthEnds.reduce(function (m, x) { return x.headroom < m.headroom ? x : m; }, monthEnds[0]);
    var draws = L.sum(used, function (u) { return u.line.category === 'Construction loan draws, expected' ? u.line.amount : 0; });
    var assumed = L.sum(used, function (u) { return u.line.assumed ? u.line.amount : 0; });
    var available = r2((+inp.commitment || 0) - (+inp.loanBalance || 0) - draws);
    var lowDisc = L.sum(used, function (u) { return u.week === low.week && u.line.discretionary ? -u.line.amount : 0; });
    var contracts = L.sum(used, function (u) { return u.line.category === 'Contract payments, expected' ? u.line.amount : 0; });
    var payroll = -L.sum(used, function (u) { return u.line.category === 'Payroll' ? u.line.amount : 0; });

    var flags = [];
    if (belowBy > 0) {
      var outs = used.filter(function (u) { return u.week === low.week && u.line.amount < 0; }).sort(function (a, b) { return a.line.amount - b.line.amount; }).slice(0, 3);
      flags.push({ flag: 'Below the Minimum Balance', item: 'Week ' + low.week + ', ' + L.shortDate(low.of) + ' to ' + L.shortDate(low.through), result: 'Needs a Decision', amount: belowBy, rule: 'PAY-8, CF-6', note: 'Week ' + low.week + ' ends at ' + L.money(low.ending) + ', ' + L.money(belowBy) + ' below the ' + L.money(inp.minimum) + ' minimum. Largest payments that week: ' + outs.map(function (u) { return u.line.line + ' ' + L.money(-u.line.amount); }).join('; ') + '.' });
    }
    weeks.forEach(function (x) { if (x.below && x.week !== low.week) flags.push({ flag: 'Below the Minimum Balance', item: 'Week ' + x.week, result: 'Needs a Decision', amount: r2((+inp.minimum || 0) - x.ending), rule: 'PAY-8, CF-6', note: 'Week ' + x.week + ' ends at ' + L.money(x.ending) + '.' }); });
    monthEnds.forEach(function (m) { if (!m.meets) flags.push({ flag: 'Below the Section 7.3 Minimum Liquidity', item: L.longDate(m.date), result: 'Covenant Breach Projected', amount: r2(-m.headroom), rule: 'CF-7, Section 7.3', note: 'Unrestricted cash ' + L.money(m.unrestricted) + ' against ' + L.money(m.minimum) + '.' }); });
    if (inp.conflict) {
      var still = (inp.lines || []).filter(function (x) { return x.include && /PO-27-0511/.test(x.line); })[0];
      flags.push({ flag: 'Payment Date Conflict', item: inp.conflict.item, result: 'Dates Conflict', amount: still ? -still.amount : inp.conflict.amount, rule: inp.conflict.rule, note: 'Recorded document finding, not recalculated: ' + inp.conflict.found + '.', fixed: true });
    }
    (inp.lines || []).forEach(function (x) { if (x.noContract) flags.push({ flag: 'Expected Receipt Without a Signed Contract', item: x.line, result: x.include ? 'Included Against CF-2' : 'Left Out of the Forecast', amount: +x.amount || 0, rule: 'CF-2, PAY-8', note: x.include ? 'Included in the forecast although CF-2 forecasts a contract payment only once the contract is signed.' : 'Listed on the billing schedule, left out until the contract is signed.' }); });
    if (assumed > 0) flags.push({ flag: 'Planned Draws Assumed', item: used.filter(function (u) { return u.line.assumed; }).map(function (u) { return u.line.line.split(',')[0]; }).join(' and '), result: 'Controller to Confirm', amount: assumed, rule: 'CF-2, CF-7', note: 'In the forecast but not yet submitted to the lender.' });
    if (available < -0.004) flags.push({ flag: 'Draws Exceed the Construction Line', item: 'CL commitment', result: 'Needs a Decision', amount: -available, rule: 'CF-2', note: 'Draws in the forecast exceed what is left of the commitment.' });

    var checks = [
      { label: 'Proof: opening plus every cash line equals week ' + W + ' ending', ok: Math.abs(proof) < 0.005, detail: 'Difference ' + L.money(proof) },
      { label: 'Every week at or above the ' + L.money(inp.minimum) + ' minimum (PAY-8)', ok: belowBy === 0, detail: belowBy ? 'Lowest: week ' + low.week + ' at ' + L.money(low.ending) + ', ' + L.money(belowBy) + ' short' : 'Lowest: week ' + low.week + ' at ' + L.money(low.ending) },
      { label: 'Every month-end meets Section 7.3 (' + L.money(inp.covenantMin) + ')', ok: monthEnds.every(function (m) { return m.meets; }), detail: 'Lowest headroom ' + L.money(minHead.headroom) + ' at ' + L.longDate(minHead.date) },
      { label: 'Month-ends without the planned draws', ok: monthEnds.every(function (m) { return m.meetsWithout; }) ? true : 'warn', detail: monthEnds.map(function (m) { return L.shortDate(m.date) + ' ' + L.money(m.withoutAssumed) + (m.meetsWithout ? '' : ' (below)'); }).join('; ') },
      { label: 'Draws fit the construction line', ok: available >= -0.004, detail: L.money(available) + ' left after the draws in the forecast' }
    ];
    if (outside.length) checks.push({ label: 'Lines outside the 13 weeks', ok: 'warn', detail: outside.length + ' line(s) dated outside ' + L.shortDate(start) + ' to ' + L.shortDate(end) + ' are not counted' });
    var restore = belowBy > 0 ? [
      { option: 'Delay the discretionary purchase(s) in week ' + low.week, amount: lowDisc, endsAt: r2(low.ending + lowDisc), restores: r2(low.ending + lowDisc) >= (+inp.minimum || 0) },
      { option: 'Draw on the construction line before week ' + low.week + ', at least the shortfall', amount: belowBy, endsAt: r2(low.ending + belowBy), restores: belowBy <= available + 0.004 }
    ] : [];
    var lw = (inp.lastWeek || []).map(function (x) { var ours = weeks[x.week - 1]; return { week: x.week, ours: ours ? ours.ending : 0, last: x.ending, change: ours ? r2(ours.ending - x.ending) : 0 }; });
    return { cats: { receipts: rc, disb: dc }, grid: grid, weeks: weeks, low: low, belowBy: belowBy, totalR: totalR, totalD: totalD, ending: weeks[W - 1].ending, proof: proof, monthEnds: monthEnds, minHead: minHead, draws: draws, assumed: assumed, available: available, contracts: contracts, payroll: payroll, flags: flags, checks: checks, restore: restore, variance: lw, outside: outside };
  }

  function compare(c) {
    var o = { receipts: c.totalR, disb: c.totalD, ending: c.ending, low: c.low.ending, lowWeek: c.low.week, below: c.belowBy, headroom: c.minHead.headroom, draws: c.draws, planned: c.assumed, available: c.available, billings: c.contracts };
    c.weeks.forEach(function (w) { o['week' + w.week] = w.ending; });
    c.monthEnds.forEach(function (m, i) { o['monthEnd' + (i + 1)] = m.unrestricted; o['headroom' + (i + 1)] = m.headroom; });
    var v12 = c.variance.filter(function (x) { return x.week === 12; })[0]; if (v12) o.variance = v12.change;
    return o;
  }
  return { id: 'accounting-cashflow', extract: extract, calc: calc, compare: compare };
});
