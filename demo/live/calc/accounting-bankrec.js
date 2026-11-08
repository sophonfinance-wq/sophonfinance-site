/* F1 Finance demos · "Try your own numbers" · October bank reconciliation.
   extract(src) reads the recorded run's reconciliation, outstanding items, findings, proposed entries and the
   opening tie into editable inputs; calc(inputs) proves the reconciliation the way the recorded workpapers do:
   adjusted bank balance = adjusted book balance, to the cent (CASH-1). No DOM. */
(function (root, factory) {
  var L = (root && root.FFLive && root.FFLive.lib) || (typeof require === 'function' ? require('../lib.js') : null);
  var m = factory(L);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.FFLive = root.FFLive || {}; (root.FFLive.calc = root.FFLive.calc || {})['accounting-bankrec'] = m; }
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  var r2 = L.round2;
  var HOLIDAYS = ['2026-11-11', '2026-11-26', '2026-12-25', '2027-01-01'];
  function bizDaysBetween(a, b) { var n = 0, t = a; while (L.d(t) < L.d(b)) { t = L.addDays(t, 1); var w = L.dow(t); if (w !== 0 && w !== 6 && HOLIDAYS.indexOf(t) < 0) n++; } return n; }

  function extract(src) {
    var W = function (n) { return src.json(new RegExp('/preparation/worksheet/' + n + '$')); };
    return Promise.all([W('Reconciliation'), W('Outstanding'), W('Findings'), W('Proposed Entries'), W('Opening Tie'), W('Summary'), src.json(/\/preparation\/evidence\/E01 Bank Statement$/)]).then(function (a) {
      var rec = a[0].rows, os = a[1].rows, fi = a[2].rows, pe = a[3].rows, ot = a[4].rows, su = a[5].rows, st = a[6].rows;
      var C = L.cell;
      var end = st.filter(function (r) { return r && r[1] === 'Ending balance'; })[0];
      var statementDate = end ? end[0] : '2026-10-31';
      var checks = [], dit = [], part = 'checks';
      os.slice(4).forEach(function (r) {
        if (!r || r[0] == null) return;
        if (/^Outstanding checks$/i.test(r[0])) { part = 'dit'; return; }
        if (/^Deposits in transit$/i.test(r[0])) return;
        var item = { ref: String(r[0]).replace(/\s*\(.*\)$/, '').replace(/^(Check|Deposit)\s+/, ''), date: r[1], who: r[2], amount: +r[4] || 0 };
        if (part === 'checks') checks.push(item); else dit.push(item);
      });
      // book adjustments: the reconciliation's book-side lines, with the finding's name and the proposed entry's account
      var entries = []; var cur = null;
      pe.slice(3).forEach(function (r) { if (!r || !r[0]) { cur = null; return; } if (!cur || cur.id !== r[0]) { cur = { id: r[0], lines: [] }; entries.push(cur); } cur.lines.push({ account: r[2], dr: +r[3] || 0, cr: +r[4] || 0 }); });
      var adj = [];
      var bookRows = [11, 12, 13];
      bookRows.forEach(function (rowNo, i) {
        var lab = String(C(rec, 'A' + rowNo) || ''), amt = +C(rec, 'B' + rowNo) || 0;
        var sign = /^Less/i.test(lab) ? -1 : 1;
        var f = fi[3 + i] || [], e = entries[i] || { lines: [] };
        var other = e.lines.filter(function (x) { return !/^1010\b/.test(String(x.account)); })[0];
        adj.push({ desc: f[0] || lab.replace(/^(Less|Add):\s*/i, ''), amount: r2(sign * amt), account: other ? other.account : '', result: f[3] || 'Book Before Close', source: String(C(rec, 'C' + rowNo) || '') });
      });
      var recorded = {
        bankEnding: +C(rec, 'B5'), dit: +C(rec, 'B6'), oc: +C(rec, 'B7'), adjBank: +C(rec, 'B8'), book: +C(rec, 'B10'), adjBook: +C(rec, 'B14'), diff: +C(rec, 'B16'),
        net: +C(su, 'B10'), openItems: +C(su, 'B13'), proposed: +C(su, 'B14'),
        findings: fi.slice(3).filter(function (r) { return r && r[0]; }).map(function (r) { return { finding: r[0], item: r[1], check: r[2], result: r[3], amount: r[4] }; })
      };
      return {
        inputs: {
          statementDate: statementDate, account: 'Cobalt Harbor x4417 · GL 1010 Cash - Operating',
          bankEnding: recorded.bankEnding, book: recorded.book,
          checks: checks, dit: dit, bankErrors: [], adjustments: adj,
          opening: { bankStatement: +C(ot, 'B5'), bankPriorRec: +C(ot, 'B6'), glOpening: +C(ot, 'B8'), bookPriorRec: +C(ot, 'B9') },
          staleDays: 90, ditBizDays: 5
        },
        recorded: recorded, entity: 'HANGS Construction Services LLC'
      };
    });
  }

  function calc(inp) {
    var sd = inp.statementDate;
    var dit = L.sum(inp.dit || [], function (x) { return x.amount; });
    var oc = L.sum(inp.checks || [], function (x) { return x.amount; });
    var errs = L.sum(inp.bankErrors || [], function (x) { return x.amount; });
    var adjBank = r2((+inp.bankEnding || 0) + dit - oc + errs);
    var net = L.sum(inp.adjustments || [], function (x) { return x.amount; });
    var adjBook = r2((+inp.book || 0) + net);
    var diff = r2(adjBank - adjBook);
    var findings = [], entries = [], n = 0;
    (inp.adjustments || []).forEach(function (a) {
      if (Math.abs(+a.amount || 0) < 0.005) return;
      var amt = Math.abs(+a.amount), acct = a.account || '(account to choose)';
      n++; var id = 'PJ-' + ('00' + n).slice(-3);
      entries.push({ id: id, lines: a.amount < 0 ? [{ account: acct, dr: amt }, { account: '1010 Cash - Operating', cr: amt }] : [{ account: '1010 Cash - Operating', dr: amt }, { account: acct, cr: amt }] });
      findings.push({ finding: a.desc, item: 'Books', check: a.amount < 0 ? 'Book side, less' : 'Book side, add', result: a.result || 'Book Before Close', amount: amt, entry: id });
    });
    (inp.bankErrors || []).forEach(function (e) { if (Math.abs(+e.amount || 0) >= 0.005) findings.push({ finding: e.desc || 'Bank error', item: 'Statement', check: 'Bank side', result: 'Ask the Bank', amount: Math.abs(+e.amount) }); });
    var stale = [];
    (inp.checks || []).forEach(function (c) {
      var days = L.validDate(c.date) && L.validDate(sd) ? L.daysBetween(c.date, sd) : null;
      c._days = days;
      if (days != null && days > (+inp.staleDays || 90)) { stale.push(c); findings.push({ finding: 'Stale Check ' + c.ref, item: 'Check ' + c.ref, check: 'Timing Items', result: 'Follow Up', amount: +c.amount || 0, note: days + ' days outstanding (CASH-4): contact the payee, then void and reissue or hold for unclaimed property' }); }
    });
    (inp.dit || []).forEach(function (x) {
      var bd = L.validDate(x.date) && L.validDate(sd) ? bizDaysBetween(x.date, sd) : null;
      var late = bd != null && bd > (+inp.ditBizDays || 5);
      findings.push({ finding: (late ? 'Old Deposit in Transit ' : 'Deposit ') + x.ref + (late ? '' : ' in Transit'), item: x.ref, check: 'Timing Items', result: late ? 'Investigate' : 'Follow Up', amount: +x.amount || 0, note: late ? bd + ' business days before the statement date (CASH-5)' : 'Must clear within five business days of the statement date (CASH-5)' });
    });
    var o = inp.opening || {};
    var tieBank = r2((+o.bankStatement || 0) - (+o.bankPriorRec || 0)), tieBook = r2((+o.glOpening || 0) - (+o.bookPriorRec || 0));
    var checks = [
      { label: 'Unexplained difference is $0.00 (CASH-1)', ok: Math.abs(diff) < 0.005, detail: Math.abs(diff) < 0.005 ? 'Reconciled to the cent' : 'Not reconciled: ' + L.money(diff) + ' left. Find it before close; nothing is plugged.' },
      { label: 'Opening bank balance ties to the signed September reconciliation', ok: Math.abs(tieBank) < 0.005, detail: 'Difference ' + L.money(tieBank) },
      { label: 'Opening GL balance ties to the September adjusted book balance', ok: Math.abs(tieBook) < 0.005, detail: 'Difference ' + L.money(tieBook) },
      { label: 'Stale checks (over ' + (+inp.staleDays || 90) + ' days, CASH-4)', ok: stale.length ? 'warn' : true, detail: stale.length ? stale.map(function (c) { return c.ref + ' ' + L.money(c.amount) + ', ' + c._days + ' days'; }).join('; ') : 'None' },
      { label: 'Proposed entries balance', ok: entries.every(function (e) { return Math.abs(L.sum(e.lines, function (x) { return x.dr; }) - L.sum(e.lines, function (x) { return x.cr; })) < 0.005; }), detail: entries.length + ' proposed, none posted (CASH-6)' }
    ];
    return { dit: dit, oc: oc, errs: errs, adjBank: adjBank, net: net, adjBook: adjBook, diff: diff, reconciled: Math.abs(diff) < 0.005, findings: findings, entries: entries, openItems: findings.length, proposed: entries.length, tie: { bank: tieBank, book: tieBook }, checks: checks };
  }

  function compare(c) { return { dit: c.dit, oc: c.oc, adjBank: c.adjBank, adjBook: c.adjBook, diff: c.diff, net: c.net, openItems: c.openItems, proposed: c.proposed }; }
  return { id: 'accounting-bankrec', extract: extract, calc: calc, compare: compare };
});
