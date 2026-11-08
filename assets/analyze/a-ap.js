/* F1 Finance in-browser analysis: AP review (option id "accounting").
   Input: an AP bill / invoice export. Flags duplicates, missing numbers, round amounts, weekend/holiday and
   after-period dates, possible capital items in expense accounts; vendor and account totals; aging. */
(function () {
  'use strict';
  var U = window.F1Core.util, money = U.money, sum = U.sum, plural = U.plural;

  var FIELDS = [
    { key: 'vendor', label: 'Vendor', type: 'text', req: true, guess: true, syn: ['vendor', 'vendor name', 'supplier', 'supplier name', 'payee', 'name', 'vendor display name', 'company'] },
    { key: 'inv', label: 'Invoice number', type: 'text', syn: ['invoice number', 'bill number', 'invoice', 'reference number', 'reference', 'document number', 'number', 'invoice id', 'bill'], not: ['date', 'amount', 'total'] },
    { key: 'date', label: 'Invoice date', type: 'date', req: true, guess: true, syn: ['invoice date', 'bill date', 'date', 'document date', 'transaction date', 'inv date'], not: ['due', 'paid', 'entered', 'posted'] },
    { key: 'due', label: 'Due date', type: 'date', syn: ['due date', 'due', 'date due', 'payment due'] },
    { key: 'amount', label: 'Amount', type: 'money', req: true, guess: true, syn: ['amount', 'total', 'invoice amount', 'bill amount', 'invoice total', 'total amount', 'gross amount', 'amount due', 'original amount'], not: ['tax amount', 'paid', 'discount'] },
    { key: 'open', label: 'Open balance', type: 'money', syn: ['open balance', 'balance due', 'balance', 'amount open', 'remaining', 'unpaid'] },
    { key: 'account', label: 'GL account', type: 'text', syn: ['account', 'gl account', 'expense account', 'account name', 'category', 'gl code', 'account code', 'expense category', 'distribution account'] },
    { key: 'desc', label: 'Description', type: 'text', syn: ['description', 'memo', 'line description', 'item description', 'details', 'item'] },
    { key: 'terms', label: 'Terms', type: 'text', syn: ['terms', 'payment terms'] }
  ];
  var EXPENSE_ACCT = /repair|maint|supplies|supply|small (tools|equipment)|minor equipment|tools|materials|office expense|consumable|janitorial|miscellaneous|general expense|cost of goods|cogs|expense/i;
  var CAPITAL_WORDS = /machine|equipment|espresso|roaster|oven|grinder|install|replacement|replace|roof|hvac|furnace|vehicle|truck|van|computer|laptop|server|furniture|build[- ]?out|remodel|renovation|compressor|forklift|generator|system/i;

  function normInv(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(^|[A-Z])0+(?=\d)/g, '$1'); }
  function normVendor(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|inc|incorporated|llc|l l c|co|corp|corporation|company|ltd|limited|lp|llp|pllc|pc)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
  function missingInv(s) { return !s || /^(n\/?a|none|tbd|-+|\?+|0+)$/i.test(String(s).trim()); }

  function collect(input) {
    var rows = [], files = [];
    (input.ap || []).forEach(function (src) {
      files.push(src.file);
      src.records.forEach(function (r) {
        if (!r.vendor && r.amount == null) return;
        if (/^(total|grand total|subtotal)\b/i.test(r.vendor || '') || /^(total|grand total)\b/i.test(r.inv || '')) return;
        if (r.amount == null) return;
        rows.push({ vendor: r.vendor || '(no vendor)', inv: r.inv || '', date: r.date, due: r.due, amt: r.amount, open: r.open, account: r.account || '', desc: r.desc || '', terms: r.terms || '', src: src.file + ' row ' + r._row, hasOpen: src.cols.open != null, hasInv: src.cols.inv != null });
      });
    });
    return { rows: rows, files: files };
  }
  function detectPeriod(rows) {
    var cnt = {}, best = null;
    rows.forEach(function (r) { if (r.date == null) return; var p = U.parts(r.date), k = p.y * 12 + p.m - 1; cnt[k] = (cnt[k] || 0) + 1; if (best == null || cnt[k] > cnt[best] || (cnt[k] === cnt[best] && k > best)) best = k; });
    if (best == null) return null;
    var y = Math.floor(best / 12), m = best % 12 + 1;
    return { y: y, m: m, end: U.endOfMonth(y, m), start: U.dn(y, m, 1) };
  }

  function analyze(input, opts) {
    var d = collect(input), rows = d.rows;
    var per = detectPeriod(rows);
    var periodEnd = opts.periodEnd != null ? opts.periodEnd : per ? per.end : null;
    var periodStart = periodEnd != null ? U.dn(U.parts(periodEnd).y, U.parts(periodEnd).m, 1) : null;
    var roundMin = opts.roundMin != null ? opts.roundMin : 100000;
    var capMin = opts.capMin != null ? opts.capMin : 500000;
    var ex = [], flags = {};
    function flag(r, f) { (flags[r.src] = flags[r.src] || []).push(f); }
    rows.forEach(function (r, i) { r.i = i; r.nv = normVendor(r.vendor); r.ni = normInv(r.inv); });

    // duplicates: same vendor + same normalized number
    var byKey = {};
    rows.forEach(function (r) { if (!r.ni) return; var k = r.nv + '|' + r.ni; (byKey[k] = byKey[k] || []).push(r); });
    var dupPairs = 0, dupAmt = 0, inDup = {};
    Object.keys(byKey).forEach(function (k) {
      var g = byKey[k]; if (g.length < 2) return;
      var amts = {}; g.forEach(function (r) { amts[r.amt] = (amts[r.amt] || 0) + 1; });
      g.forEach(function (r) { inDup[r.i] = 1; });
      var sameAmt = Object.keys(amts).length === 1;
      var numbers = g.map(function (r) { return '“' + r.inv + '”'; });
      var distinctFmt = g.some(function (r) { return r.inv !== g[0].inv; });
      if (sameAmt) {
        dupPairs += g.length - 1; dupAmt += g[0].amt * (g.length - 1);
        ex.push({ sev: 'high', title: 'Duplicate invoice: ' + g[0].vendor + ' ' + g[0].inv, amount: g[0].amt * (g.length - 1),
          detail: plural(g.length, 'entry', 'entries') + ' for ' + money(g[0].amt) + (distinctFmt ? ' with the number written differently (' + numbers.join(' vs ') + ')' : ' with the same number') + ', dated ' + g.map(function (r) { return U.fdate(r.date); }).join(' and ') + '. Pay once; void the extra.' });
      } else {
        var tr = g.length === 2 ? Math.abs(g[0].amt - g[1].amt) : 0;
        ex.push({ sev: 'high', title: 'Same invoice number, different amounts: ' + g[0].vendor + ' ' + g[0].inv,
          detail: g.map(function (r) { return money(r.amt) + ' on ' + U.fdate(r.date); }).join(' vs ') + '.' + (tr && tr % 900 === 0 ? ' The ' + money(tr) + ' difference is divisible by 9: possibly a keying error (transposed digits) on a duplicate.' : '') + ' Check against the vendor’s invoice before paying either.' });
      }
      g.forEach(function (r) { flag(r, sameAmt ? 'Duplicate' : 'Same number, different amount'); });
    });
    // same vendor + same amount, close dates, different or missing numbers
    var byVA = {};
    rows.forEach(function (r) { if (inDup[r.i]) return; var k = r.nv + '|' + r.amt; (byVA[k] = byVA[k] || []).push(r); });
    Object.keys(byVA).forEach(function (k) {
      var g = byVA[k]; if (g.length < 2) return;
      g.sort(function (a, b) { return (a.date || 0) - (b.date || 0); });
      for (var i = 1; i < g.length; i++) {
        var a = g[i - 1], b = g[i];
        if (a.date != null && b.date != null && b.date - a.date > 14) continue;
        ex.push({ sev: 'med', title: 'Possible duplicate: ' + a.vendor + ', same amount', amount: b.amt, detail: (a.inv || 'no number') + ' on ' + U.fdate(a.date) + ' and ' + (b.inv || 'no number') + ' on ' + U.fdate(b.date) + ', both ' + money(b.amt) + '. Confirm these are two separate purchases.' });
        flag(a, 'Possible duplicate'); flag(b, 'Possible duplicate');
      }
    });
    // per-row checks
    var missing = [], roundRows = [], wkRows = [], afterRows = [], capRows = [], negRows = [], noDate = [], dueBefore = [];
    rows.forEach(function (r) {
      if (r.hasInv && missingInv(r.inv)) { missing.push(r); flag(r, 'No invoice number'); }
      if (r.amt >= roundMin && r.amt % 100 === 0) { roundRows.push(r); flag(r, 'Round amount'); }
      if (r.amt < 0) { negRows.push(r); flag(r, 'Credit / negative'); }
      if (r.date == null) { noDate.push(r); flag(r, 'No date'); }
      else {
        var p = U.parts(r.date), hol = U.holidays(p.y)[r.date];
        if (p.w === 0 || p.w === 6 || hol) { wkRows.push({ r: r, why: hol || U.DOW[p.w] }); flag(r, hol ? 'Holiday' : 'Weekend'); }
        if (periodEnd != null && r.date > periodEnd) { afterRows.push(r); flag(r, 'After period'); }
        if (r.due != null && r.due < r.date) { dueBefore.push(r); flag(r, 'Due before invoice date'); }
      }
      if (r.amt >= capMin && (EXPENSE_ACCT.test(r.account) || (!r.account && CAPITAL_WORDS.test(r.desc))) && !/fixed asset|equipment \(asset\)|capital|property and equipment|furniture and fixtures|leasehold|vehicles?$/i.test(r.account)) {
        capRows.push(r); flag(r, 'Possible capital item');
      }
    });
    if (rows.length && !rows.some(function (r) { return r.hasInv; })) ex.push({ sev: 'med', title: 'No invoice number column', detail: 'Duplicates were checked by vendor and amount only. Use Adjust columns if the file has invoice numbers.' });
    if (!rows.some(function (r) { return r.account; })) ex.push({ sev: 'low', title: 'No account column', detail: 'The capital-item check and account totals need the GL account. Use Adjust columns if the file has one.' });
    if (missing.length) ex.push({ sev: 'med', title: plural(missing.length, 'invoice') + ' with no invoice number', amount: sum(missing, function (r) { return r.amt; }), detail: missing.slice(0, 6).map(function (r) { return r.vendor + ' ' + money(r.amt) + ' (' + U.fdate(r.date) + ')'; }).join('; ') + '. Without a number, duplicate checks are weaker; get the vendor’s invoice.' });
    if (roundRows.length) ex.push({ sev: 'low', title: plural(roundRows.length, 'round-dollar invoice') + ' of ' + money(roundMin) + ' or more', amount: sum(roundRows, function (r) { return r.amt; }), detail: roundRows.slice(0, 6).map(function (r) { return r.vendor + ' ' + money(r.amt); }).join('; ') + '. Round amounts can be estimates, deposits or retainers; check the support.' });
    wkRows.forEach(function (w) { ex.push({ sev: 'low', title: 'Dated on a ' + (/day$/.test(w.why) && U.DOW.indexOf(w.why) >= 0 ? w.why : 'holiday (' + w.why + ')') + ': ' + w.r.vendor + ' ' + (w.r.inv || ''), amount: w.r.amt, detail: U.ldate(w.r.date) + '. Unusual for most vendors; confirm the invoice is genuine.' }); });
    afterRows.forEach(function (r) { ex.push({ sev: 'med', title: 'Dated after the period: ' + r.vendor + ' ' + (r.inv || ''), amount: r.amt, detail: U.fdate(r.date) + ', after the period end ' + U.fdate(periodEnd) + '. It belongs in the next period unless the goods or services were received by ' + U.fdate(periodEnd) + ' (then accrue it).' }); });
    capRows.forEach(function (r) { ex.push({ sev: 'med', title: 'Possible capital item in an expense account: ' + r.vendor, amount: r.amt, detail: money(r.amt) + ' coded to “' + (r.account || 'no account') + '”' + (r.desc ? ' (' + r.desc + ')' : '') + '. At ' + money(capMin) + ' or more this may need to be capitalised and depreciated under your capitalisation policy.' }); });
    if (negRows.length) ex.push({ sev: 'low', title: plural(negRows.length, 'credit memo') + ' / negative amount', amount: sum(negRows, function (r) { return r.amt; }), detail: negRows.slice(0, 5).map(function (r) { return r.vendor + ' ' + money(r.amt); }).join('; ') + '. Make sure each is applied to the right bill.' });
    if (noDate.length) ex.push({ sev: 'med', title: plural(noDate.length, 'invoice') + ' with no readable date', detail: 'Rows: ' + noDate.slice(0, 6).map(function (r) { return r.src; }).join(', ') });
    if (dueBefore.length) ex.push({ sev: 'low', title: plural(dueBefore.length, 'invoice') + ' due before the invoice date', detail: dueBefore.slice(0, 5).map(function (r) { return r.vendor + ' ' + (r.inv || ''); }).join('; ') + '. Likely a keying error in the dates.' });

    // totals
    var total = sum(rows, function (r) { return r.amt; });
    function group(keyF) {
      var m = {}; rows.forEach(function (r) { var k = keyF(r) || '(blank)'; var g = m[k] = m[k] || { name: k, n: 0, amt: 0 }; g.n++; g.amt += r.amt; });
      return Object.keys(m).map(function (k) { var g = m[k]; g.share = total ? g.amt / total : 0; return g; }).sort(function (a, b) { return b.amt - a.amt; });
    }
    var vendors = group(function (r) { return r.vendor; }), accounts = group(function (r) { return r.account; });

    // aging as of period end
    var asOf = periodEnd != null ? periodEnd : null;
    var B = ['Not yet due', '1–30 days', '31–60 days', '61–90 days', 'Over 90 days'];
    var agingV = {}, bt = [0, 0, 0, 0, 0], dueAssumed = 0;
    rows.forEach(function (r) {
      var bal = r.hasOpen ? (r.open == null ? 0 : r.open) : r.amt;
      if (!bal || asOf == null || (r.date != null && r.date > asOf)) return;
      var due = r.due; if (due == null && r.date != null) { due = r.date + 30; dueAssumed++; }
      if (due == null) return;
      var late = asOf - due, b = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
      var v = agingV[r.vendor] = agingV[r.vendor] || { vendor: r.vendor, b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, tot: 0 };
      v['b' + b] += bal; v.tot += bal; bt[b] += bal;
    });
    var agingRows = Object.keys(agingV).map(function (k) { return agingV[k]; }).sort(function (a, b) { return b.tot - a.tot; });
    var pastDue = bt[1] + bt[2] + bt[3] + bt[4];
    var pastDueV = agingRows.filter(function (v) { return v.b1 + v.b2 + v.b3 + v.b4 > 0; }).length;
    if (bt[3] + bt[4] > 0) ex.push({ sev: 'med', title: 'Bills more than 60 days past due', amount: bt[3] + bt[4], detail: 'Check for disputes, unapplied credits or missed payments.' });

    var flaggedN = Object.keys(flags).length;
    var invCols = [{ k: 'vendor', label: 'Vendor' }, { k: 'inv', label: 'Invoice' }, { k: 'date', label: 'Date', t: 'date' }, { k: 'due', label: 'Due', t: 'date' }, { k: 'amt', label: 'Amount', t: 'money' }, { k: 'account', label: 'Account' }, { k: 'flags', label: 'Flags' }];
    var invRows = rows.map(function (r) { var f = flags[r.src]; return { vendor: r.vendor, inv: r.inv, date: r.date, due: r.due, amt: r.amt, account: r.account, flags: f ? f.filter(function (x, i) { return f.indexOf(x) === i; }).join(', ') : '', _cls: f ? 'is-warn' : '' }; });
    var flaggedRows = invRows.filter(function (r) { return r.flags; });
    var gCols = function (name) { return [{ k: 'name', label: name }, { k: 'n', label: 'Bills', t: 'num' }, { k: 'amt', label: 'Total', t: 'money' }, { k: 'share', label: 'Share', t: 'pct' }]; };
    var aCols = [{ k: 'vendor', label: 'Vendor' }, { k: 'b0', label: B[0], t: 'money' }, { k: 'b1', label: B[1], t: 'money' }, { k: 'b2', label: B[2], t: 'money' }, { k: 'b3', label: B[3], t: 'money' }, { k: 'b4', label: B[4], t: 'money' }, { k: 'tot', label: 'Total', t: 'money' }];
    var aTot = { vendor: 'Total', b0: bt[0], b1: bt[1], b2: bt[2], b3: bt[3], b4: bt[4], tot: sum(bt) };
    var pName = periodEnd != null ? U.monthName(U.parts(periodEnd).y, U.parts(periodEnd).m) : '';
    var mo = [];
    var yNow = periodEnd != null ? U.parts(periodEnd).y : new Date().getFullYear();
    for (var yy = yNow - 1; yy <= yNow + 1; yy++) for (var mm = 1; mm <= 12; mm++) mo.push({ v: U.iso(U.endOfMonth(yy, mm)), t: U.monthName(yy, mm) });
    if (periodEnd != null && !mo.some(function (o) { return o.v === U.iso(periodEnd); })) mo.push({ v: U.iso(periodEnd), t: 'Ending ' + U.fdate(periodEnd) });
    var exCols = [{ k: 'sev', label: 'Severity' }, { k: 'title', label: 'Exception' }, { k: 'amount', label: 'Amount', t: 'money' }, { k: 'detail', label: 'Detail' }];

    return {
      title: 'AP review' + (pName ? ', ' + pName : ''),
      subtitle: d.files.join(' + '),
      file: 'F1-AP-review' + (periodEnd != null ? '-' + U.iso(periodEnd).slice(0, 7) : ''),
      headline: [
        { label: 'Bills reviewed', value: String(rows.length), sub: money(total) + ' total' },
        { label: 'Flagged', value: String(flaggedN), sub: flaggedN ? 'bills with at least one flag' : 'no flags', tone: flaggedN ? 'warn' : 'ok' },
        { label: 'Duplicate exposure', value: money(dupAmt), sub: plural(dupPairs, 'extra copy', 'extra copies'), tone: dupAmt ? 'bad' : 'ok' },
        { label: 'Past due at ' + (asOf != null ? U.fdate(asOf) : 'period end'), value: money(pastDue), sub: plural(pastDueV, 'vendor') + ' with past-due bills' }
      ],
      controls: [
        { type: 'select', key: 'periodEnd', label: 'Period', value: periodEnd != null ? U.iso(periodEnd) : '', options: mo, parse: 'date' },
        { type: 'money', key: 'roundMin', label: 'Round-amount threshold', value: roundMin },
        { type: 'money', key: 'capMin', label: 'Capitalisation threshold', value: capMin }
      ],
      exceptions: ex,
      sections: [
        { title: 'Flagged bills', open: true, table: { cols: invCols, rows: flaggedRows }, empty: 'No bills flagged.' },
        { title: 'Totals by vendor', table: { cols: gCols('Vendor'), rows: vendors, total: { name: 'Total', n: rows.length, amt: total } } },
        { title: 'Totals by account', table: { cols: gCols('Account'), rows: accounts, total: { name: 'Total', n: rows.length, amt: total } } },
        { title: 'Aging at ' + (asOf != null ? U.fdate(asOf) : 'period end'), note: (rows.some(function (r) { return r.hasOpen; }) ? 'Uses the open balance column.' : 'Treats every bill in the file as unpaid (no open-balance column).') + (dueAssumed ? ' ' + plural(dueAssumed, 'bill') + ' had no due date, so net 30 from the invoice date was assumed.' : ''), table: { cols: aCols, rows: agingRows, total: aTot } },
        { title: 'All bills', table: { cols: invCols, rows: invRows }, limit: 150 }
      ],
      how: [
        'Read ' + plural(rows.length, 'bill') + ' from ' + d.files.join(', ') + '. The period (' + (pName || 'unknown') + ') is the month with the most invoice dates' + (opts.periodEnd != null ? ', as chosen by you' : '') + '.',
        'Duplicates: invoice numbers are compared after removing spaces, dashes, punctuation and leading zeros (so “BPW 5188” equals “BPW-5188”), within the same vendor (ignoring Inc, LLC, Co). Same number with the same amount is a duplicate; same number with different amounts is flagged. Same vendor and amount within 14 days with a different or missing number is a possible duplicate.',
        'Round amounts: whole-dollar bills (no cents) of ' + money(roundMin) + ' or more. Weekend and holiday dates use US federal holidays. After-period: invoice date later than ' + (periodEnd != null ? U.fdate(periodEnd) : 'the period end') + '.',
        'Possible capital items: ' + money(capMin) + ' or more coded to repairs, maintenance, supplies, tools, materials or similar expense accounts.',
        'Aging is measured from the due date to the period end' + (dueAssumed ? ' (net 30 assumed where no due date)' : '') + '. Totals are added in whole cents.'
      ],
      sheets: [
        { name: 'Exceptions', title: 'AP review ' + pName + ' (draft for review)', table: { cols: exCols, rows: ex } },
        { name: 'Flagged bills', table: { cols: invCols, rows: flaggedRows } },
        { name: 'By vendor', table: { cols: gCols('Vendor'), rows: vendors, total: { name: 'Total', n: rows.length, amt: total } } },
        { name: 'By account', table: { cols: gCols('Account'), rows: accounts, total: { name: 'Total', n: rows.length, amt: total } } },
        { name: 'Aging', table: { cols: aCols, rows: agingRows, total: aTot } },
        { name: 'All bills', table: { cols: invCols, rows: invRows } }
      ]
    };
  }

  window.F1Analyze.define('accounting', {
    roles: [{ key: 'ap', label: 'AP invoice export', multi: true, need: true, fields: FIELDS, hint: /ap|payable|bill|invoice|vendor/i }],
    analyze: analyze
  });
})();
