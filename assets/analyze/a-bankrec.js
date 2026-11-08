/* F1 Finance in-browser analysis: bank reconciliation (option id "accounting-bankrec").
   Inputs: bank statement (xlsx/csv/pdf) + general-ledger cash detail (xlsx/csv). All math in integer cents. */
(function () {
  'use strict';
  var U = window.F1Core.util, money = U.money, sum = U.sum, plural = U.plural;

  var BANK = [
    { key: 'date', label: 'Date', type: 'date', req: true, guess: true, syn: ['date', 'posting date', 'posted date', 'post date', 'transaction date', 'effective date', 'value date', 'trans date'], not: ['due'] },
    { key: 'desc', label: 'Description', type: 'text', guess: true, syn: ['description', 'transaction description', 'memo', 'narrative', 'payee', 'name', 'transaction', 'particulars'] },
    { key: 'amount', label: 'Amount (signed)', type: 'money', syn: ['amount', 'transaction amount', 'net amount', 'amount usd'] },
    { key: 'deposit', label: 'Deposits / credits', type: 'money', syn: ['deposit', 'credit', 'money in', 'deposit credit', 'additions', 'credit amount', 'deposit amount', 'paid in'] },
    { key: 'withdrawal', label: 'Withdrawals / debits', type: 'money', syn: ['withdrawal', 'debit', 'money out', 'withdrawal debit', 'subtractions', 'debit amount', 'withdrawal amount', 'paid out', 'check amount'] },
    { key: 'check', label: 'Check number', type: 'int', syn: ['check number', 'check', 'serial number', 'check serial'] },
    { key: 'balance', label: 'Running balance', type: 'money', syn: ['balance', 'running balance', 'ledger balance', 'daily balance', 'available balance', 'account balance'] },
    { key: 'type', label: 'Type (debit/credit)', type: 'text', syn: ['type', 'transaction type', 'details', 'debit credit', 'credit debit', 'dr cr', 'indicator'] }
  ];
  var GL = [
    { key: 'date', label: 'Date', type: 'date', req: true, guess: true, syn: ['date', 'transaction date', 'posting date', 'entry date', 'ledger date', 'journal date', 'trans date', 'effective date'], not: ['due'] },
    { key: 'type', label: 'Transaction type', type: 'text', syn: ['type', 'transaction type', 'source', 'journal', 'entry type', 'source type'] },
    { key: 'ref', label: 'Number / check no.', type: 'int', syn: ['number', 'reference', 'reference number', 'check number', 'document number', 'doc number', 'transaction number', 'entry number', 'je number'] },
    { key: 'name', label: 'Name / payee', type: 'text', syn: ['name', 'payee', 'vendor', 'customer', 'source name', 'payee name'] },
    { key: 'desc', label: 'Memo / description', type: 'text', guess: true, syn: ['memo', 'description', 'memo description', 'explanation', 'line description', 'details', 'narration'] },
    { key: 'account', label: 'Account', type: 'text', syn: ['account', 'account name', 'ledger account', 'account number', 'cash account'] },
    { key: 'split', label: 'Offset account (split)', type: 'text', syn: ['split', 'offset account', 'contra account', 'other account', 'distribution account', 'offsetting account'] },
    { key: 'amount', label: 'Amount (signed)', type: 'money', syn: ['amount', 'net amount', 'signed amount', 'net'] },
    { key: 'debit', label: 'Debit (money in)', type: 'money', syn: ['debit', 'debit amount', 'receipts', 'deposit'] },
    { key: 'credit', label: 'Credit (money out)', type: 'money', syn: ['credit', 'credit amount', 'disbursements', 'payment'] },
    { key: 'balance', label: 'Running balance', type: 'money', syn: ['balance', 'running balance', 'ending balance'] }
  ];
  var GROUP_B = [{ keys: ['amount', 'deposit', 'withdrawal'], label: 'An amount column, or deposit and withdrawal columns' }];
  var GROUP_G = [{ keys: ['amount', 'debit', 'credit'], label: 'An amount column, or debit and credit columns' }];

  var OUT_WORDS = /\b(check|chk|cheque|withdraw\w*|debit|dr|fee|fees|charge|service charge|payment|pmt|bill ?pay\w*|ach debit|purchase|pos|nsf|returned|return item|transfer to|wire out|expense|payroll|paid)\b/i;
  var IN_WORDS = /\b(deposit\w*|credit|cr|interest|transfer from|wire in|received|receipt|sales receipt|refund)\b/i;
  var BAL_ROW = /\b(beginning|opening|starting|previous|balance forward|brought forward|ending|closing)\b.*\bbalance\b|\bbalance (forward|brought forward)\b/i;

  function chrono(recs) {
    // keep file order for same-date rows; flip a newest-first export
    var up = 0, down = 0;
    for (var i = 1; i < recs.length; i++) { if (recs[i].date > recs[i - 1].date) up++; else if (recs[i].date < recs[i - 1].date) down++; }
    var a = recs.map(function (r, i) { r._i = i; return r; });
    if (down > up) a = a.slice().reverse().map(function (r, i) { r._i = i; return r; });
    return a.slice().sort(function (x, y) { return x.date - y.date || x._i - y._i; });
  }

  function prepBank(input) {
    var out = { txns: [], begin: null, end: null, periodStart: null, periodEnd: null, signNote: '', files: [], warnings: [] };
    (input.bank || []).forEach(function (src) {
      out.files.push(src.file);
      if (src.pdf) {
        var s = src.stmt;
        s.txns.forEach(function (t) { out.txns.push({ date: t.date, desc: t.desc, amt: t.amt, check: t.check, bal: t.bal, src: 'PDF ' + t._row }); });
        if (s.begin != null) out.begin = s.begin; if (s.end != null) out.end = s.end;
        out.periodStart = s.periodStart; out.periodEnd = s.periodEnd;
        out.signNote = 'Read from the PDF text; money in or out taken from the column it sits in, then confirmed against the running balance.';
        return;
      }
      var recs = [], hasNeg = false, cols = src.cols;
      src.records.forEach(function (r) {
        var d = r.desc || r.type || '';
        if (r.date == null && r.balance != null && BAL_ROW.test(d)) { if (/beginning|opening|starting|previous|forward/i.test(d)) out.begin = r.balance; else out.end = r.balance; return; }
        if (BAL_ROW.test(d) && r.amount == null && r.deposit == null && r.withdrawal == null) { if (r.balance != null) { if (/beginning|opening|starting|previous|forward/i.test(d)) out.begin = r.balance; else out.end = r.balance; } return; }
        if (r.date == null) return;
        if (/^total/i.test(d)) return;
        var amt = null;
        if (cols.deposit != null || cols.withdrawal != null) {
          if (r.deposit) amt = Math.abs(r.deposit);
          if (r.withdrawal) amt = (amt || 0) - Math.abs(r.withdrawal);
          if (amt == null && r.amount != null) amt = r.amount;
        } else amt = r.amount;
        if (amt == null || amt === 0) return;
        if (amt < 0) hasNeg = true;
        recs.push({ date: r.date, desc: d, type: r.type || '', amt: amt, check: r.check || null, bal: r.balance, src: src.file + ' row ' + r._row });
      });
      recs = chrono(recs);
      if (cols.deposit == null && cols.withdrawal == null && !hasNeg) {
        // all amounts positive: decide direction
        var how = 'words';
        if (cols.type != null && recs.some(function (r) { return OUT_WORDS.test(r.type) || IN_WORDS.test(r.type); })) how = 'type';
        else if (cols.balance != null) how = 'balance';
        var prev = out.begin;
        recs.forEach(function (r) {
          if (how === 'type') { if (OUT_WORDS.test(r.type) && !IN_WORDS.test(r.type)) r.amt = -r.amt; }
          else if (how === 'balance') { if (prev != null && r.bal != null && r.bal - prev === -r.amt) r.amt = -r.amt; else if (prev == null && r.bal != null) { /* first row: infer later */ } }
          else if (OUT_WORDS.test(r.desc) && !IN_WORDS.test(r.desc)) r.amt = -r.amt;
          if (r.bal != null) prev = r.bal;
        });
        out.signNote = how === 'type' ? 'All amounts were positive, so money in or out was read from the type column.' : how === 'balance' ? 'All amounts were positive, so money in or out was read from the change in the running balance.' : 'All amounts were positive, so money in or out was inferred from the description words (deposit, check, fee and so on). Please confirm.';
        if (how === 'words') out.warnings.push('The bank file has no negative amounts, no debit/credit columns and no running balance, so money in or out was inferred from descriptions.');
      } else if (!out.signNote) out.signNote = cols.deposit != null || cols.withdrawal != null ? 'Money in and out read from the deposit and withdrawal columns.' : 'Signed amounts: positive is money in, negative is money out.';
      recs.forEach(function (r) {
        if (!r.check) { var m = (r.desc + ' ' + r.type).match(/\b(?:check|chk|ck|cheque)\s*(?:no\.?|number|#)?\s*(\d{3,7})\b/i); if (m) r.check = +m[1]; }
        out.txns.push(r);
      });
      if (out.end == null) { var lb = recs.filter(function (r) { return r.bal != null; }).pop(); if (lb) out.end = lb.bal; }
      if (out.begin == null && recs.length && recs[0].bal != null) out.begin = recs[0].bal - recs[0].amt;
    });
    out.txns = chrono(out.txns);
    return out;
  }

  function prepGL(input, stmtEnd) {
    var out = { txns: [], begin: null, end: null, endFrom: '', files: [], signNote: '', after: [], cashName: '' };
    var accCount = {};
    (input.gl || []).forEach(function (src) {
      out.files.push(src.file);
      var cols = src.cols, recs = [], hasNeg = false;
      src.records.forEach(function (r) {
        var d = [r.name, r.desc].filter(Boolean).join(' — ') || r.type || r.refText || '';
        var anyAmt = r.amount != null || r.debit != null || r.credit != null;
        if ((BAL_ROW.test(d) || /beginning balance|opening balance/i.test(r.type || '')) && !anyAmt) { if (r.balance != null) { if (/ending|closing/i.test(d)) out.endRow = r.balance; else out.begin = r.balance; } return; }
        if (r.date == null) { if (/^total/i.test(d) || /^total/i.test(r.account || '')) return; return; }
        if (/^total/i.test(d)) return;
        var amt = null;
        if (cols.debit != null || cols.credit != null) { if (r.debit) amt = Math.abs(r.debit); if (r.credit) amt = (amt || 0) - Math.abs(r.credit); if (amt == null && r.amount != null) amt = r.amount; }
        else amt = r.amount;
        if (amt == null || amt === 0) return;
        if (amt < 0) hasNeg = true;
        if (r.account) accCount[r.account] = (accCount[r.account] || 0) + 1;
        var refNum = r.ref != null && /^\s*\d{3,7}\s*$/.test(r.refText || '') ? r.ref : null;
        if (!refNum) { var m = (d + ' ' + (r.type || '')).match(/\b(?:check|chk|ck|cheque)\s*(?:no\.?|number|#)?\s*(\d{3,7})\b/i); if (m) refNum = +m[1]; }
        recs.push({ date: r.date, desc: d, type: r.type || '', ref: r.refText || '', check: refNum, amt: amt, bal: r.balance, split: r.split || '', account: r.account || '', src: src.file + ' row ' + r._row });
      });
      recs = chrono(recs);
      if (cols.debit == null && cols.credit == null && !hasNeg) {
        var how = cols.balance != null ? 'balance' : cols.type != null ? 'type' : 'words', prev = out.begin;
        recs.forEach(function (r) {
          if (how === 'balance' && prev != null && r.bal != null) { if (r.bal - prev === -r.amt) r.amt = -r.amt; }
          else if (how !== 'balance') { var w = how === 'type' ? r.type : r.desc; if (/\b(check|bill payment|expense|payroll|payment to|withdrawal|transfer out|fee|credit card payment)\b/i.test(w) || (how === 'words' && OUT_WORDS.test(w) && !IN_WORDS.test(w))) r.amt = -r.amt; }
          if (r.bal != null) prev = r.bal;
        });
        out.signNote = 'Ledger amounts were all positive, so direction was read from the ' + (how === 'balance' ? 'running balance' : how === 'type' ? 'transaction type' : 'description words') + '.';
      } else out.signNote = cols.debit != null || cols.credit != null ? 'Ledger debits are money into cash, credits are money out.' : 'Ledger amounts are signed: positive is money in, negative is money out.';
      recs.forEach(function (r) { out.txns.push(r); });
    });
    out.txns = chrono(out.txns);
    var keys = Object.keys(accCount).sort(function (a, b) { return accCount[b] - accCount[a]; });
    out.cashName = keys[0] || 'Cash';
    out.multiAccount = keys.length > 1 ? keys : null;
    // ending balance as of the statement date
    var inPeriod = out.txns.filter(function (t) { return stmtEnd == null || t.date <= stmtEnd; });
    out.after = out.txns.filter(function (t) { return stmtEnd != null && t.date > stmtEnd; });
    var lastBal = inPeriod.filter(function (t) { return t.bal != null; }).pop();
    if (lastBal) { out.end = lastBal.bal; out.endFrom = 'the running balance on the last ledger line on or before the statement date'; }
    else if (out.begin != null) { out.end = out.begin + sum(inPeriod, function (t) { return t.amt; }); out.endFrom = 'the beginning balance plus the ledger activity through the statement date'; }
    else if (out.endRow != null && !out.after.length) { out.end = out.endRow; out.endFrom = 'the ending balance line in the ledger file'; }
    out.txns = inPeriod;
    return out;
  }

  function stmtDates(bank) {
    var ds = bank.txns.map(function (t) { return t.date; });
    var end = bank.periodEnd || (ds.length ? Math.max.apply(null, ds) : null);
    var start = bank.periodStart || (ds.length ? Math.min.apply(null, ds) : null);
    if (!bank.periodEnd && end != null) { var p = U.parts(end); var eom = U.endOfMonth(p.y, p.m); if (eom - end <= 4) end = eom; }
    if (!bank.periodStart && start != null) { var q = U.parts(start); if (q.d <= 5) start = U.dn(q.y, q.m, 1); }
    return { start: start, end: end };
  }

  function words(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !/^\d+$/.test(w); }); }
  function sim(a, b) { var A = words(a), B = words(b); if (!A.length || !B.length) return 0; var n = 0; A.forEach(function (w) { if (B.indexOf(w) >= 0) n++; }); return n / Math.max(A.length, B.length); }
  function transposed(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    if (a === b || (a - b) % 9 !== 0) return null;
    var sa = String(a), sb = String(b);
    if (sa.length !== sb.length) return null;
    var diff = [];
    for (var i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) diff.push(i);
    if (diff.length === 2 && sa[diff[0]] === sb[diff[1]] && sa[diff[1]] === sb[diff[0]]) return [sa[diff[0]], sa[diff[1]]];
    return null;
  }
  function subset(target, cands, maxK) {
    var best = null;
    (function go(i, acc, picked) {
      if (best) return;
      if (picked.length >= 2 && acc === target) { best = picked.slice(); return; }
      if (picked.length >= maxK || i >= cands.length) return;
      for (var j = i; j < cands.length && !best; j++) {
        var v = cands[j].amt, na = acc + v;
        if (Math.abs(na) > Math.abs(target)) continue;
        picked.push(cands[j]); go(j + 1, na, picked); picked.pop();
      }
    })(0, 0, []);
    return best;
  }

  function analyze(input, opts, C) {
    var bank = prepBank(input);
    var sd = stmtDates(bank);
    if (opts.stmtEnd != null) sd.end = opts.stmtEnd;
    var gl = prepGL(input, sd.end);
    var bankEnd = opts.bankEnd != null ? opts.bankEnd : bank.end;
    var glEnd = opts.glEnd != null ? opts.glEnd : gl.end;
    var B = bank.txns.filter(function (t) { return sd.end == null || t.date <= sd.end; }).map(function (t, i) { return Object.assign({ id: 'B' + i, side: 'bank' }, t); });
    var G = gl.txns.map(function (t, i) { return Object.assign({ id: 'G' + i, side: 'gl' }, t); });
    var used = {}, matches = [], errors = [];
    function take(b, g, how, extra) { b.forEach(function (x) { used[x.id] = 1; }); g.forEach(function (x) { used[x.id] = 1; }); var m = Object.assign({ b: b, g: g, how: how }, extra || {}); matches.push(m); return m; }
    function freeG() { return G.filter(function (g) { return !used[g.id]; }); }

    // 1. check number + amount
    B.forEach(function (b) {
      if (!b.check || used[b.id]) return;
      var same = freeG().filter(function (g) { return g.check === b.check; });
      if (!same.length) return;
      var exact = same.filter(function (g) { return g.amt === b.amt; })[0];
      if (exact) { take([b], [exact], 'Check number and amount'); return; }
      var g = same.sort(function (x, y) { return Math.abs(x.amt - b.amt) - Math.abs(y.amt - b.amt); })[0];
      if ((g.amt < 0) !== (b.amt < 0)) return;
      var tr = transposed(b.amt, g.amt);
      var m = take([b], [g], tr ? 'Check number; amount transposed' : 'Check number; amount differs', { diff: b.amt - g.amt, transposition: tr });
      errors.push(m);
    });
    // 2. exact amount within 5 days
    B.slice().sort(function (x, y) { return x.date - y.date; }).forEach(function (b) {
      if (used[b.id]) return;
      var c = freeG().filter(function (g) { return g.amt === b.amt && Math.abs(b.date - g.date) <= 5 && !(b.check && g.check && b.check !== g.check); });
      if (!c.length) return;
      c.sort(function (x, y) { return (Math.abs(b.date - x.date) - sim(b.desc, x.desc) * 2) - (Math.abs(b.date - y.date) - sim(b.desc, y.desc) * 2); });
      take([b], [c[0]], 'Same amount within 5 days');
    });
    // 3. one-to-many (several ledger lines deposited together, or one ledger line split at the bank)
    B.forEach(function (b) {
      if (used[b.id]) return;
      var c = freeG().filter(function (g) { return (g.amt > 0) === (b.amt > 0) && g.date <= b.date + 1 && g.date >= b.date - 7 && Math.abs(g.amt) < Math.abs(b.amt); })
        .sort(function (x, y) { return Math.abs(b.date - x.date) - Math.abs(b.date - y.date); }).slice(0, 12);
      var s = subset(b.amt, c, 4);
      if (s) take([b], s, 'One bank line = ' + s.length + ' ledger lines');
    });
    freeG().forEach(function (g) {
      if (used[g.id]) return;
      var c = B.filter(function (b) { return !used[b.id] && (b.amt > 0) === (g.amt > 0) && b.date >= g.date - 1 && b.date <= g.date + 7 && Math.abs(b.amt) < Math.abs(g.amt); })
        .sort(function (x, y) { return Math.abs(g.date - x.date) - Math.abs(g.date - y.date); }).slice(0, 12);
      var s = subset(g.amt, c, 4);
      if (s) take(s, [g], s.length + ' bank lines = one ledger line');
    });
    // 4. transpositions without check numbers
    B.forEach(function (b) {
      if (used[b.id]) return;
      var c = freeG().filter(function (g) { return (g.amt > 0) === (b.amt > 0) && Math.abs(b.date - g.date) <= 5 && transposed(b.amt, g.amt) && !(b.check && g.check && b.check !== g.check); });
      if (!c.length) return;
      var g = c[0], m = take([b], [g], 'Amount transposed', { diff: b.amt - g.amt, transposition: transposed(b.amt, g.amt) });
      errors.push(m);
    });
    // 5. duplicates in the books
    var dups = [];
    freeG().forEach(function (g) {
      var twin = G.filter(function (o) { return o.id !== g.id && o.amt === g.amt && Math.abs(o.date - g.date) <= 2 && (sim(o.desc, g.desc) >= 0.6 || (o.ref && o.ref === g.ref && !/^\s*$/.test(o.ref))) && (used[o.id] || o._i < g._i); })[0];
      if (twin && !(g.check && twin.check && g.check !== twin.check)) { used[g.id] = 1; dups.push({ g: g, twin: twin }); }
    });
    var bankDups = [];
    B.forEach(function (b) {
      if (used[b.id]) return;
      var twin = B.filter(function (o) { return o.id !== b.id && used[o.id] && o.amt === b.amt && o.date === b.date && sim(o.desc, b.desc) >= 0.8; })[0];
      if (twin) bankDups.push({ b: b, twin: twin });
    });

    // 6. classify what is left
    var os = [], dit = [], bankOnly = [], priorItems = [];
    freeG().forEach(function (g) { if (g.amt < 0) os.push(g); else dit.push(g); });
    var firstCheck = null; G.forEach(function (g) { if (g.check && (firstCheck == null || g.check < firstCheck)) firstCheck = g.check; });
    B.forEach(function (b) {
      if (used[b.id]) return;
      var d = (b.desc + ' ' + (b.type || '')).toLowerCase(), kind;
      if (bankDups.some(function (x) { return x.b === b; })) kind = 'duplicate';
      else if (/interest|int earned|int pd|dividend/.test(d) && b.amt > 0) kind = 'interest';
      else if (/\bnsf\b|returned (item|check|deposit)|return(ed)? item|insufficient|chargeback|deposited item returned|rtn/.test(d) && !/fee/.test(d) && b.amt < 0) kind = 'nsf';
      else if (/fee|service charge|svc ch|maint|charge|overdraft/.test(d) && b.amt < 0) kind = 'fee';
      else if (b.check && b.amt < 0 && (firstCheck == null || b.check < firstCheck)) kind = 'priorCheck';
      else if (b.amt > 0 && /deposit/.test(d) && sd.start != null && b.date <= sd.start + 4) kind = 'priorDeposit';
      else kind = 'other';
      b.kind = kind;
      if (kind === 'priorCheck' || kind === 'priorDeposit') priorItems.push(b); else bankOnly.push(b);
    });

    // reconciliation
    var ditT = sum(dit, function (t) { return t.amt; }), osT = sum(os, function (t) { return -t.amt; });
    var adjBank = bankEnd == null ? null : bankEnd + ditT - osT;
    var bookAdj = [];
    var KIND = { interest: 'Interest earned', nsf: 'Returned / NSF item', fee: 'Bank fee', other: 'Bank item not in the books', duplicate: 'Possible duplicate bank posting' };
    bankOnly.forEach(function (b) { bookAdj.push({ label: KIND[b.kind] + ': ' + b.desc, date: b.date, amt: b.amt, kind: b.kind, ref: b }); });
    errors.forEach(function (m) { bookAdj.push({ label: (m.transposition ? 'Transposition: ' : 'Recorded amount differs: ') + m.g[0].desc + (m.g[0].check ? ' (check ' + m.g[0].check + ')' : ''), date: m.g[0].date, amt: m.diff, kind: 'error', ref: m }); });
    dups.forEach(function (d) { bookAdj.push({ label: 'Duplicate entry: ' + d.g.desc, date: d.g.date, amt: -d.g.amt, kind: 'dup', ref: d }); });
    var adjBook = glEnd == null ? null : glEnd + sum(bookAdj, function (x) { return x.amt; });
    var unexplained = adjBank != null && adjBook != null ? adjBank - adjBook : null;

    // exceptions
    var ex = [];
    if (unexplained != null && unexplained !== 0) {
      var t9 = Math.abs(unexplained) % 900 === 0 && Math.abs(unexplained) >= 900 ? ' The difference is divisible by 9, which often points to a transposed figure.' : '';
      ex.push({ sev: 'high', title: 'Unexplained difference after reconciling items', amount: unexplained, detail: 'Adjusted bank ' + money(adjBank) + ' vs adjusted book ' + money(adjBook) + '. Check the ending balances used and any items listed below.' + t9 });
    }
    errors.forEach(function (m) {
      var g = m.g[0], b = m.b[0];
      ex.push({ sev: 'high', title: (m.transposition ? 'Likely transposition' : 'Amount differs') + (g.check ? ': check ' + g.check : ': ' + g.desc), amount: m.diff,
        detail: 'Books ' + money(g.amt) + ' on ' + U.fdate(g.date) + ', bank ' + money(b.amt) + ' on ' + U.fdate(b.date) + '. ' + (m.transposition ? 'The difference ' + money(Math.abs(m.diff)) + ' is divisible by 9 and the digits ' + m.transposition[0] + ' and ' + m.transposition[1] + ' are swapped. ' : '') + 'Correct the book entry (proposed entry below).' });
    });
    dups.forEach(function (d) { ex.push({ sev: 'high', title: 'Possible duplicate entry in the books', amount: d.g.amt, detail: d.g.desc + ' on ' + U.fdate(d.g.date) + ' appears twice; only one cleared the bank. Reverse the extra entry if confirmed.' }); });
    bankOnly.forEach(function (b) {
      if (b.kind === 'nsf') ex.push({ sev: 'high', title: 'Returned item (NSF): ' + b.desc, amount: b.amt, detail: 'The bank reversed a deposit on ' + U.fdate(b.date) + '. Record it against the customer’s receivable and follow up for payment.' });
      else if (b.kind === 'fee') ex.push({ sev: 'low', title: 'Bank fee not yet in the books: ' + b.desc, amount: b.amt, detail: U.fdate(b.date) + '. Record to bank charges.' });
      else if (b.kind === 'interest') ex.push({ sev: 'low', title: 'Interest not yet in the books', amount: b.amt, detail: b.desc + ' on ' + U.fdate(b.date) + '. Record to interest income.' });
      else if (b.kind === 'duplicate') ex.push({ sev: 'med', title: 'Possible duplicate bank posting: ' + b.desc, amount: b.amt, detail: 'Same amount, date and description as another bank line on ' + U.fdate(b.date) + '. Ask the bank if it is not in the books.' });
      else ex.push({ sev: 'med', title: 'Bank item not found in the books: ' + b.desc, amount: b.amt, detail: U.fdate(b.date) + '. Find the source and record it, or explain it.' });
    });
    priorItems.forEach(function (b) { ex.push({ sev: 'med', title: (b.kind === 'priorCheck' ? 'Check ' + b.check + ' cleared but is not in this ledger detail' : 'Early-month deposit not in this ledger detail'), amount: b.amt, detail: 'Probably ' + (b.kind === 'priorCheck' ? 'outstanding' : 'in transit') + ' on last month’s reconciliation, so it is not treated as a book adjustment. Confirm against last month’s list.' }); });
    var stale = os.filter(function (g) { return sd.end - g.date > 60; }), staleD = dit.filter(function (g) { return sd.end - g.date > 5; });
    stale.forEach(function (g) { ex.push({ sev: 'med', title: 'Stale outstanding item: ' + g.desc, amount: g.amt, detail: 'Written ' + U.fdate(g.date) + ', still not cleared ' + (sd.end - g.date) + ' days later. Consider voiding or contacting the payee.' }); });
    staleD.forEach(function (g) { ex.push({ sev: 'med', title: 'Deposit in transit is ' + (sd.end - g.date) + ' days old', amount: g.amt, detail: g.desc + ' recorded ' + U.fdate(g.date) + ' but not on the statement. Deposits normally clear in 1 to 2 business days; confirm it was deposited.' }); });
    if (bank.begin != null && bankEnd != null) {
      var foot = bank.begin + sum(bank.txns.filter(function (t) { return sd.end == null || t.date <= sd.end; }), function (t) { return t.amt; });
      if (foot !== bankEnd) ex.push({ sev: 'high', title: 'Statement does not foot', amount: bankEnd - foot, detail: 'Beginning balance ' + money(bank.begin) + ' plus the transactions read (' + money(foot - bank.begin) + ') gives ' + money(foot) + ', not the ending balance ' + money(bankEnd) + '. Some lines may not have been read; the Excel or CSV export is more reliable.' });
    }
    if (gl.after.length) ex.push({ sev: 'low', title: plural(gl.after.length, 'ledger line') + ' dated after the statement date left out', amount: sum(gl.after, function (t) { return t.amt; }), detail: 'They belong to next month’s reconciliation.' });
    if (gl.multiAccount) ex.push({ sev: 'med', title: 'The ledger file has more than one account', detail: 'Accounts found: ' + gl.multiAccount.slice(0, 5).join(', ') + '. Export the cash account only for a clean match.' });
    bank.warnings.forEach(function (w) { ex.push({ sev: 'med', title: 'Please confirm the bank amount signs', detail: w }); });

    // proposed entries
    var cash = gl.cashName || 'Cash', je = [], n = 0;
    function entry(dr, cr, amt, memo) { n++; je.push({ no: n, acct: dr, dr: Math.abs(amt), cr: null, memo: memo }); je.push({ no: n, acct: '    ' + cr, dr: null, cr: Math.abs(amt), memo: '' }); }
    bankOnly.forEach(function (b) {
      if (b.kind === 'fee') entry('Bank service charges', cash, b.amt, b.desc + ' ' + U.fdate(b.date));
      else if (b.kind === 'interest') entry(cash, 'Interest income', b.amt, b.desc + ' ' + U.fdate(b.date));
      else if (b.kind === 'nsf') entry('Accounts receivable (customer of the returned deposit)', cash, b.amt, b.desc + ' ' + U.fdate(b.date));
      else if (b.amt > 0) entry(cash, 'Suspense (research)', b.amt, b.desc + ' ' + U.fdate(b.date));
      else entry('Suspense (research)', cash, b.amt, b.desc + ' ' + U.fdate(b.date));
    });
    errors.forEach(function (m) {
      var g = m.g[0], other = g.split || 'Account on the original entry';
      if (m.diff > 0) entry(cash, other, m.diff, 'Correct ' + (g.check ? 'check ' + g.check : g.desc) + ' to the cleared amount ' + money(m.b[0].amt));
      else entry(other, cash, m.diff, 'Correct ' + (g.check ? 'check ' + g.check : g.desc) + ' to the cleared amount ' + money(m.b[0].amt));
    });
    dups.forEach(function (d) {
      var other = d.g.split || 'Account on the duplicated entry';
      if (d.g.amt < 0) entry(cash, other, d.g.amt, 'Reverse duplicate: ' + d.g.desc + ' ' + U.fdate(d.g.date));
      else entry(other, cash, d.g.amt, 'Reverse duplicate: ' + d.g.desc + ' ' + U.fdate(d.g.date));
    });

    // tables
    var recRows = [
      { item: 'Balance per bank statement' + (sd.end != null ? ', ' + U.fdate(sd.end) : ''), amt: bankEnd, _cls: 'is-sub' },
      { item: 'Add: deposits in transit (' + dit.length + ')', amt: ditT },
      { item: 'Less: outstanding checks and payments (' + os.length + ')', amt: -osT },
      { item: 'Adjusted bank balance', amt: adjBank, _cls: 'is-tot' },
      { item: 'Balance per books' + (sd.end != null ? ', ' + U.fdate(sd.end) : ''), amt: glEnd, _cls: 'is-sub' }
    ];
    bookAdj.forEach(function (x) { recRows.push({ item: (x.amt >= 0 ? 'Add: ' : 'Less: ') + x.label, amt: x.amt }); });
    recRows.push({ item: 'Adjusted book balance', amt: adjBook, _cls: 'is-tot' });
    recRows.push({ item: 'Unexplained difference', amt: unexplained, _cls: unexplained ? 'is-bad' : 'is-ok' });
    var bankFirst = B.length;
    var matchedRows = [];
    matches.forEach(function (m) {
      var len = Math.max(m.b.length, m.g.length);
      for (var i = 0; i < len; i++) {
        var b = m.b[i], g = m.g[i];
        matchedRows.push({ bdate: b ? b.date : null, bdesc: b ? b.desc : '', bamt: b ? b.amt : null, gdate: g ? g.date : null, gdesc: g ? g.desc : '', gamt: g ? g.amt : null, how: i === 0 ? m.how : '″', _cls: m.diff ? 'is-warn' : '' });
      }
    });
    matchedRows.sort(function (a, b) { return (a.bdate || a.gdate) - (b.bdate || b.gdate); });
    var gcols = [{ k: 'date', label: 'Date', t: 'date' }, { k: 'ref', label: 'No.' }, { k: 'desc', label: 'Description' }, { k: 'amt', label: 'Amount', t: 'money' }, { k: 'age', label: 'Days', t: 'num' }];
    function grow(g) { return { date: g.date, ref: g.check || g.ref || '', desc: g.desc, amt: g.amt, age: sd.end != null ? sd.end - g.date : null }; }
    var osT2 = { desc: 'Total', amt: -osT }, ditT2 = { desc: 'Total', amt: ditT };
    var bcols = [{ k: 'date', label: 'Date', t: 'date' }, { k: 'kind', label: 'Kind' }, { k: 'desc', label: 'Description' }, { k: 'amt', label: 'Amount', t: 'money' }];
    var KN = { interest: 'Interest', nsf: 'Returned item', fee: 'Fee', other: 'Not in books', duplicate: 'Possible duplicate', priorCheck: 'Prior-month check', priorDeposit: 'Prior-month deposit' };
    var bankOnlyRows = bankOnly.concat(priorItems).map(function (b) { return { date: b.date, kind: KN[b.kind], desc: b.desc, amt: b.amt }; });
    var errRows = errors.map(function (m) { return { date: m.g[0].date, item: (m.transposition ? 'Transposition' : 'Amount differs') + (m.g[0].check ? ', check ' + m.g[0].check : ''), book: m.g[0].amt, bank: m.b[0].amt, diff: m.diff }; })
      .concat(dups.map(function (d) { return { date: d.g.date, item: 'Duplicate: ' + d.g.desc, book: d.g.amt, bank: null, diff: -d.g.amt }; }));
    var jeCols = [{ k: 'no', label: '#', t: 'num' }, { k: 'acct', label: 'Account' }, { k: 'dr', label: 'Debit', t: 'money' }, { k: 'cr', label: 'Credit', t: 'money' }, { k: 'memo', label: 'Memo' }];
    var mCols = [{ k: 'bdate', label: 'Bank date', t: 'date' }, { k: 'bdesc', label: 'Bank description' }, { k: 'bamt', label: 'Bank amount', t: 'money' }, { k: 'gdate', label: 'Book date', t: 'date' }, { k: 'gdesc', label: 'Book description' }, { k: 'gamt', label: 'Book amount', t: 'money' }, { k: 'how', label: 'Matched by' }];
    var recCols = [{ k: 'item', label: 'Reconciliation' }, { k: 'amt', label: 'Amount', t: 'money' }];
    var errCols = [{ k: 'date', label: 'Date', t: 'date' }, { k: 'item', label: 'Item' }, { k: 'book', label: 'Books', t: 'money' }, { k: 'bank', label: 'Bank', t: 'money' }, { k: 'diff', label: 'Correction', t: 'money' }];

    var bankMatched = B.filter(function (b) { return used[b.id]; }).length;
    var period = sd.end != null ? U.monthName(U.parts(sd.end).y, U.parts(sd.end).m) : '';
    var res = {
      title: 'Bank reconciliation' + (period ? ', ' + period : ''),
      subtitle: (bank.files.concat(gl.files)).join(' + '),
      file: 'F1-bank-reconciliation' + (sd.end != null ? '-' + U.iso(sd.end) : ''),
      headline: [
        { label: 'Matched', value: bankMatched + ' of ' + bankFirst, sub: 'bank lines matched to the books' },
        { label: 'Outstanding checks', value: money(osT), sub: plural(os.length, 'item') },
        { label: 'Deposits in transit', value: money(ditT), sub: plural(dit.length, 'item') },
        { label: 'Bank-only items', value: money(sum(bankOnly, function (b) { return b.amt; })), sub: plural(bankOnly.length, 'item') + ' to record' },
        { label: 'Unexplained difference', value: unexplained == null ? 'n/a' : money(unexplained), sub: unexplained === 0 ? 'Reconciled' : 'Needs work', tone: unexplained === 0 ? 'ok' : 'bad' }
      ],
      controls: [
        { type: 'money', key: 'bankEnd', label: 'Statement ending balance', value: bankEnd },
        { type: 'money', key: 'glEnd', label: 'Book (ledger) ending balance', value: glEnd },
        { type: 'date', key: 'stmtEnd', label: 'Statement date', value: sd.end }
      ],
      exceptions: ex,
      sections: [
        { title: 'Reconciliation', open: true, table: { cols: recCols, rows: recRows, form: true } },
        { title: 'Proposed entries (not posted)', open: true, note: 'For review and approval. Nothing has been posted to your books.', table: { cols: jeCols, rows: je }, empty: 'No entries needed.' },
        { title: 'Outstanding checks and payments', table: { cols: gcols, rows: os.map(grow), total: osT2 }, empty: 'None.' },
        { title: 'Deposits in transit', table: { cols: gcols, rows: dit.map(grow), total: ditT2 }, empty: 'None.' },
        { title: 'Bank-only items', table: { cols: bcols, rows: bankOnlyRows }, empty: 'None.' },
        { title: 'Book errors (transpositions, differences, duplicates)', table: { cols: errCols, rows: errRows }, empty: 'None found.' },
        { title: 'Matched items', table: { cols: mCols, rows: matchedRows }, limit: 120 }
      ],
      how: [
        'Bank lines read: ' + B.length + ' (' + bank.signNote + ')',
        'Ledger lines read: ' + G.length + ' through the statement date (' + gl.signNote + ')' + (gl.after.length ? '; ' + gl.after.length + ' later lines left out.' : '.'),
        'Statement ending balance: ' + (opts.bankEnd != null ? 'confirmed or entered by you' : bank.end != null ? 'from the statement' : 'not found') + '. Book ending balance: ' + (opts.glEnd != null ? 'confirmed or entered by you' : gl.endFrom ? 'from ' + gl.endFrom : 'not found') + '.',
        'Matching order: (1) same check number and amount; (2) same amount within 5 days, nearest date first; (3) one bank line equal to 2 to 4 ledger lines (or the reverse) within a week; (4) amounts that differ only by two swapped digits (difference divisible by 9) within 5 days.',
        'Unmatched ledger payments are outstanding checks; unmatched ledger receipts are deposits in transit. Unmatched bank lines are sorted into fees, interest, returned items and other items by their descriptions.',
        'Reconciliation: bank balance + deposits in transit − outstanding checks = adjusted bank; book balance ± bank-only items ± book corrections = adjusted book; the two should be equal.',
        'All amounts are added in whole cents, so there is no rounding.'
      ],
      sheets: [
        { name: 'Reconciliation', title: 'Bank reconciliation ' + period + ' (draft for review)', table: { cols: recCols, rows: recRows } },
        { name: 'Exceptions', table: { cols: [{ k: 'sev', label: 'Severity' }, { k: 'title', label: 'Exception' }, { k: 'amount', label: 'Amount', t: 'money' }, { k: 'detail', label: 'Detail' }], rows: ex } },
        { name: 'Proposed entries', table: { cols: jeCols, rows: je } },
        { name: 'Outstanding', table: { cols: gcols, rows: os.map(grow), total: osT2 } },
        { name: 'Deposits in transit', table: { cols: gcols, rows: dit.map(grow), total: ditT2 } },
        { name: 'Bank only', table: { cols: bcols, rows: bankOnlyRows } },
        { name: 'Book errors', table: { cols: errCols, rows: errRows } },
        { name: 'Matched', table: { cols: mCols, rows: matchedRows } }
      ]
    };
    return res;
  }

  window.F1Analyze.define('accounting-bankrec', {
    roles: [
      { key: 'bank', label: 'Bank statement', pdf: true, need: true, fields: BANK, groups: GROUP_B, hint: /bank|statement|stmt|checking|chk|acct\s*\d/i },
      { key: 'gl', label: 'Ledger cash detail', need: true, fields: GL, groups: GROUP_G, hint: /ledger|\bgl\b|general|book|cash detail|journal|transaction detail|quickbooks|qbo/i }
    ],
    settings: function (input) {
      var bank = prepBank(input), sd = stmtDates(bank), gl = prepGL(input, sd.end);
      return [
        { key: 'bankEnd', label: 'Statement ending balance', type: 'money', value: bank.end, required: true, hint: 'From the statement. We read it from the running balance or the PDF when we can.' },
        { key: 'glEnd', label: 'Book (ledger) ending balance', type: 'money', value: gl.end, required: true, hint: 'The cash account balance in your books on the statement date.' }
      ];
    },
    analyze: analyze
  });
})();
