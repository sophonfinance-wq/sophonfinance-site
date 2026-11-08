/* F1 Finance demos · "Try your own numbers" · October AP review.
   extract(src) reads the recorded run's capture export (invoices on file), ledger export (bills in the books),
   vendor file and policy book (approvers, cost code guide) into editable inputs; calc(inputs) runs the same
   checks the recorded review ran (CAP-1, CAP-2, DUP-1, ENT-1, JOB-1, APR-1, APR-2, BOOK-1, VEN-1, DOC-1, CUT-1),
   in the same order, and builds the findings, the summary, the full-cost table and the draft entries. No DOM. */
(function (root, factory) {
  var L = (root && root.FFLive && root.FFLive.lib) || (typeof require === 'function' ? require('../lib.js') : null);
  var m = factory(L);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.FFLive = root.FFLive || {}; (root.FFLive.calc = root.FFLive.calc || {})['accounting'] = m; }
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  var r2 = L.round2;
  var RESULT = { CAP: 'Fix Before Paying', DUP: 'Fix Before Paying', ENT: 'Fix Before Paying', JOB: 'Fix Before Paying', BOOK: 'Fix Before Paying', APR: 'On Hold', VEN: 'On Hold', DOC: 'On Hold', CUT: 'Needs a Person' };
  var CHECK = { CAP: 'Full Cost', DUP: 'Paper vs Books', ENT: 'Right Entity', JOB: 'Job & Coding', APR: 'Approvals', BOOK: 'Paper vs Books', VEN: 'Vendor File', DOC: 'Paper vs Books', CUT: 'Paper vs Books' };
  var ORDER = ['CAP', 'DUP', 'ENT', 'JOB', 'APR', 'BOOK', 'VEN', 'DOC', 'CUT'];
  var ASSET_TYPES = ['asset', 'item'], READY_TYPES = ['setup', 'freight', 'install'];

  function norm(no) { return String(no || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function isAssetAccount(a) { var n = parseInt(a, 10); return n >= 1500 && n <= 1599; }
  function parseLimit(v) { if (v == null || v === '') return Infinity; if (typeof v === 'number') return v > 0 ? v : Infinity; if (/no limit/i.test(v)) return Infinity; var n = L.num(v); return n > 0 ? n : Infinity; }
  function jobsOf(v) { if (v == null) return []; if (/^all$/i.test(String(v).trim())) return ['*']; return String(v).split(/[,;\s]+/).filter(Boolean); }

  // ---- read the recorded run --------------------------------------------------------------------------
  function extract(src) {
    var E = function (n) { return src.json(new RegExp('/preparation/evidence/' + n + '$')); };
    return Promise.all([E('E01 Capture Invoices'), E('E02 Capture Lines'), E('E03 Ledger Bills'), E('E04 Ledger Lines'), E('E05 Vendor File'), E('E07 Policy Book'), src.json(/\/preparation\/worksheet\/Findings$/), src.json(/\/preparation\/worksheet\/Summary$/), src.json(/\/preparation\/worksheet\/Full Cost$/), src.json(/\/preparation\/worksheet\/Draft Entries$/), src.json(/\/run\/output-summary$|\/output-summary$/)]).then(function (a) {
      var ci = a[0].rows, cl = a[1].rows, lb = a[2].rows, ll = a[3].rows, vf = a[4].rows, pb = a[5].rows;
      var invoices = ci.slice(1).filter(function (r) { return r && r[0]; }).map(function (r) {
        return { capId: r[0], vendorCode: r[1], vendor: r[2], invoiceNo: r[3], date: r[4], billTo: r[5], job: r[6] || '', subtotal: +r[7] || 0, tax: +r[8] || 0, total: +r[10] || 0, lines: [] };
      });
      var byCap = {}; invoices.forEach(function (i) { byCap[i.capId] = i; });
      cl.slice(1).forEach(function (r) { if (r && byCap[r[0]]) byCap[r[0]].lines.push({ desc: r[2], qty: +r[3] || 0, unit: +r[4] || 0, amount: +r[5] || 0, type: r[6] || 'service', taxed: /^y/i.test(String(r[7])) }); });
      var bills = lb.slice(1).filter(function (r) { return r && r[0]; }).map(function (r) {
        return { entryId: r[0], vendorCode: r[1], vendor: r[2], invoiceNo: r[3], date: r[4], entity: r[5], approver: r[6], approved: +r[8] || 0, lines: [] };
      });
      var byEntry = {}; bills.forEach(function (b) { byEntry[b.entryId] = b; });
      ll.slice(1).forEach(function (r) { if (r && byEntry[r[0]]) byEntry[r[0]].lines.push({ account: String(r[2]), accountName: r[3], job: r[4] || '', costCode: r[5] || '', amount: +r[6] || 0 }); });
      var vendors = vf.slice(1).filter(function (r) { return r && r[0]; }).map(function (r) { return { code: r[0], vendor: r[1], added: r[3], w9: /^y/i.test(String(r[4])) }; });
      // policy book: clauses, Appendix A approvers, Appendix B cost code guide
      var clauses = {}, approvers = [], guide = [], mode = '';
      pb.forEach(function (r) {
        if (!r || !r.length) { mode = mode === 'clauses' ? 'after' : mode; return; }
        if (r[0] === 'Clause') { mode = 'clauses'; return; }
        if (r[0] === 'Approver ID') { mode = 'approvers'; return; }
        if (r[0] === 'Words on the Invoice') { mode = 'guide'; return; }
        if (mode === 'clauses' && /^[A-Z]+-\d/.test(r[0])) clauses[r[0]] = { title: r[1], page: r[2], text: r[3] };
        else if (mode === 'approvers') approvers.push({ name: r[1], role: r[2], limit: parseLimit(r[3]), jobs: String(r[4] || '') });
        else if (mode === 'guide') guide.push({ words: String(r[0]).split(/\s*,\s*/), code: r[1], label: r[2] });
      });
      var t = (/(\$[\d,]+)/.exec((clauses['CAP-1'] || {}).text || '') || [])[1];
      var recorded = {
        findings: a[6].rows.slice(3).filter(function (r) { return r && r[0]; }).map(function (r) { return { doc: r[1], check: r[2], result: r[3], amount: r[4], id: r[0] }; }),
        summary: a[7].rows.slice(4).filter(function (r) { return r && r[0]; }).map(function (r) { return { measure: r[0], value: r[1] }; }),
        fullCost: a[8].rows, drafts: a[9].rows
      };
      return {
        inputs: { periodEnd: '2026-10-31', home: 'HANGS Construction Services LLC', threshold: t ? L.num(t) : 5000, invoices: invoices, bills: bills, vendors: vendors, approvers: approvers, guide: guide },
        recorded: recorded, clauses: clauses, entity: 'HANGS Construction Services LLC'
      };
    });
  }

  // ---- calculate ----------------------------------------------------------------------------------------
  function costCode(inv, guide) {
    for (var i = 0; i < (inv.lines || []).length; i++) {
      var d = String(inv.lines[i].desc || '').toLowerCase();
      for (var g = 0; g < guide.length; g++) for (var w = 0; w < guide[g].words.length; w++) { var word = String(guide[g].words[w]).toLowerCase().trim(); if (word && d.indexOf(word) >= 0) return guide[g]; }
    }
    return null;
  }
  function approverOf(name, list) { name = String(name || '').trim().toLowerCase(); for (var i = 0; i < list.length; i++) if (String(list[i].name).trim().toLowerCase() === name) return list[i]; return null; }
  function canApprove(a, amount, job) {
    if (!a) return false;
    if (amount > parseLimit(a.limit) + 0.004) return false;
    var jobs = jobsOf(a.jobs);
    if (jobs.indexOf('*') >= 0) return true;
    return jobs.indexOf(job || '00-YD') >= 0;
  }
  function neededApprover(amount, job, list) {
    var sorted = list.slice().sort(function (x, y) { return parseLimit(x.limit) - parseLimit(y.limit); });
    for (var i = 0; i < sorted.length; i++) if (canApprove(sorted[i], amount, job)) return sorted[i];
    return null;
  }

  function calc(inp) {
    var invs = inp.invoices || [], bills = inp.bills || [], vendors = inp.vendors || [], apprs = inp.approvers || [], guide = inp.guide || [];
    var threshold = +inp.threshold || 0, home = inp.home;
    var vend = {}; vendors.forEach(function (v) { vend[String(v.code).toUpperCase()] = v; });
    var key = function (code, no) { return String(code || '').toUpperCase() + '|' + norm(no); };
    var invBy = {}; invs.forEach(function (i, ix) { var k = key(i.vendorCode, i.invoiceNo); if (!invBy[k]) invBy[k] = { inv: i, ix: ix }; });
    var billTotal = function (b) { return L.sum(b.lines || [], function (x) { return x.amount; }); };

    // documents in the order the books first reach them, then invoices the books never reached
    var docs = [], docBy = {};
    var seen = {};
    bills.forEach(function (b) {
      var k = key(b.vendorCode, b.invoiceNo);
      if (!docBy[k]) { docBy[k] = { key: k, inv: invBy[k] ? invBy[k].inv : null, bills: [], dups: [] }; docs.push(docBy[k]); }
      var total = billTotal(b), prior = docBy[k].bills.filter(function (x) { return Math.abs(billTotal(x) - total) < 0.005; })[0];
      if (prior) docBy[k].dups.push({ bill: b, of: prior }); else docBy[k].bills.push(b);
    });
    invs.forEach(function (i) { var k = key(i.vendorCode, i.invoiceNo); if (!docBy[k]) { docBy[k] = { key: k, inv: i, bills: [], dups: [] }; docs.push(docBy[k]); } });

    var findings = [], fullCost = [], drafts = [], requests = [], docsChecked = 0, n = 0;
    function draft(entity, lines) { n++; var id = 'DJ-' + ('00' + n).slice(-3); drafts.push({ id: id, entity: entity, lines: lines, debit: L.sum(lines, function (x) { return x.dr; }), credit: L.sum(lines, function (x) { return x.cr; }) }); return id; }
    function add(doc, code, amount, text, clause, extra) {
      var f = { doc: doc, code: code, clause: clause || code + '-1', check: CHECK[code], result: RESULT[code], amount: r2(amount), text: text };
      for (var k in extra || {}) f[k] = extra[k];
      findings.push(f); return f;
    }

    docs.forEach(function (D) {
      var inv = D.inv, b0 = D.bills[0], docNo = inv ? inv.invoiceNo : b0.invoiceNo;
      if (inv || b0) docsChecked++;
      var out = {};
      var vcode = String((inv || b0).vendorCode || '').toUpperCase(), v = vend[vcode];
      if (inv && b0) {
        var lines = b0.lines || [], booked = billTotal(b0);
        // CAP-1 / CAP-2: every item of $threshold or more carries its full cost
        var assets = inv.lines.filter(function (x) { return ASSET_TYPES.indexOf(x.type) >= 0 && (+x.unit || +x.amount) >= threshold; });
        if (assets.length) {
          var price = L.sum(assets, function (x) { return x.amount; });
          var ready = L.sum(inv.lines, function (x) { return READY_TYPES.indexOf(x.type) >= 0 ? x.amount : 0; });
          var taxedAll = L.sum(inv.lines, function (x) { return x.taxed ? x.amount : 0; });
          var taxedQ = L.sum(inv.lines, function (x) { return x.taxed && (assets.indexOf(x) >= 0 || READY_TYPES.indexOf(x.type) >= 0) ? x.amount : 0; });
          var tax = taxedAll > 0 ? r2((+inv.tax || 0) * taxedQ / taxedAll) : (+inv.tax || 0);
          var full = r2(price + ready + tax), cap = L.sum(lines, function (x) { return isAssetAccount(x.account) ? x.amount : 0; });
          var short = r2(full - cap), item = assets.map(function (x) { return x.desc; }).join('; ');
          fullCost.push({ doc: docNo, item: item, price: price, ready: ready, tax: tax, full: full, capitalized: cap, short: short });
          if (short > 0.004) {
            var assetLine = lines.filter(function (x) { return isAssetAccount(x.account); })[0];
            var dr = assetLine ? assetLine.account + ' ' + assetLine.accountName : '1500 Equipment';
            var left = short, cr = [];
            lines.forEach(function (x) { if (!isAssetAccount(x.account) && left > 0.004) { var amt = Math.min(left, x.amount); cr.push({ account: x.account + ' ' + x.accountName, cr: r2(amt) }); left = r2(left - amt); } });
            if (left > 0.004) cr.push({ account: '2000 Accounts Payable', cr: left });
            var id = draft(home, [{ account: dr, dr: short }].concat(cr));
            add(docNo, 'CAP', short, cap > 0 ? 'Asset cost short: ' + L.money(full) + ' full cost, ' + L.money(cap) + ' capitalized; ' + L.money(short) + ' of delivery, setup, installation or sales tax went to expense.' : 'Asset expensed: ' + item + ' costs ' + L.money(price) + ' and is used for years, so the whole ' + L.money(full) + ' belongs in a fixed-asset account.', cap > 0 ? 'CAP-2' : 'CAP-1', { draft: id, label: cap > 0 ? 'Asset Cost Short' : 'Asset Expensed' });
          }
        }
        // DUP-1: the same invoice entered again (different spacing or punctuation is the same invoice)
        D.dups.forEach(function (d) {
          var t = billTotal(d.bill);
          var id = draft(home, [{ account: '2000 Accounts Payable', dr: t }].concat(d.bill.lines.map(function (x) { return { account: x.account + ' ' + x.accountName + (x.job ? ' · Job ' + x.job : ''), cr: x.amount }; })));
          add(docNo, 'DUP', t, 'Entered twice: ' + d.of.entryId + ' as “' + d.of.invoiceNo + '” and ' + d.bill.entryId + ' as “' + d.bill.invoiceNo + '”. Same vendor, same ' + L.money(t) + '. Paying both pays twice.', 'DUP-1', { draft: id, label: 'Entered Twice' });
        });
        // ENT-1: booked in the entity named on the invoice
        if (String(inv.billTo || '').trim() && String(inv.billTo).trim() !== String(b0.entity || '').trim()) {
          var exp = lines.map(function (x) { return { account: x.account + ' ' + x.accountName, cr: x.amount }; });
          var id1 = draft(b0.entity, [{ account: '1900 Due From ' + inv.billTo, dr: booked }].concat(exp));
          var id2 = draft(inv.billTo, lines.map(function (x) { return { account: x.account + ' ' + x.accountName, dr: x.amount }; }).concat([{ account: '2900 Due To ' + b0.entity, cr: booked }]));
          add(docNo, 'ENT', booked, 'Billed to ' + inv.billTo + ', booked in ' + b0.entity + '. Record it through Due To and Due From.', 'ENT-1', { draft: id1 + ', ' + id2, label: 'Wrong Entity' });
        }
        // JOB-1: construction costs go to the job and cost code on the invoice
        var g = inv.job ? costCode(inv, guide) : null;
        if (g) {
          var right = lines.length > 0 && lines.every(function (x) { return String(x.account) === '1400' && String(x.job) === String(inv.job) && String(x.costCode) === String(g.code); });
          if (!right) {
            var to = '1400 Construction in Progress · Job ' + inv.job + ' · ' + g.code;
            var id3 = draft(home, [{ account: to, dr: booked }].concat(lines.map(function (x) { return { account: x.account + ' ' + x.accountName + (x.job ? ' · Job ' + x.job : '') + (x.costCode ? ' · ' + x.costCode : ''), cr: x.amount }; })));
            var was = lines.map(function (x) { return x.account + (x.job ? ' Job ' + x.job : ' no job') + (x.costCode ? ' ' + x.costCode : ''); }).join(', ');
            add(docNo, 'JOB', booked, 'Invoice says Job ' + inv.job + ', ' + g.code + ' ' + g.label + '; booked to ' + was + '.', 'JOB-1', { draft: id3, label: 'Wrong Job' });
          }
        }
        // APR-1 / APR-2: an approver whose limit and jobs cover the full invoice total
        var ap = approverOf(b0.approver, apprs), total = +inv.total || 0, job = inv.job || '';
        var apOk = ap && canApprove(ap, +b0.approved || 0, job), full2 = (+b0.approved || 0) + 0.004 >= total;
        if (!ap || !apOk || !full2) {
          var need = neededApprover(total, job, apprs), why;
          if (!ap) why = (b0.approver || 'No one') + ' is not on the approver list.';
          else if (!full2) why = 'Approval covers ' + L.money(+b0.approved || 0) + ', not the invoice total ' + L.money(total) + (total > parseLimit(ap.limit) + 0.004 ? ', which is over ' + ap.name + '’s ' + L.money(parseLimit(ap.limit)) + ' limit (APR-1 too)' : '') + '.';
          else if ((+b0.approved || 0) > parseLimit(ap.limit) + 0.004) why = ap.name + ' (' + ap.role + ') approved ' + L.money(+b0.approved || 0) + ', over the ' + L.money(parseLimit(ap.limit)) + ' limit.';
          else why = ap.name + ' approved it, but Job ' + (job || '00-YD') + ' is not one of ' + ap.name + '’s jobs.';
          var clause = !full2 && ap ? (total > parseLimit(ap.limit) + 0.004 ? 'APR-2, APR-1' : 'APR-2') : 'APR-1';
          add(docNo, 'APR', total, why + (need ? ' ' + need.name + ' (' + need.role + ') needs to approve it.' : ''), clause, { label: 'Waiting for Approval', code2: !full2 ? 'APR-2' : 'APR-1' });
          if (need) requests.push({ what: need.name + '’s approval for ' + docNo, from: need.name + ', ' + need.role, doc: docNo });
        }
        // BOOK-1: entered exactly as the invoice says
        if (Math.abs(r2(booked - total)) > 0.004) {
          var diff = r2(total - booked), main = lines[0] || { account: '1400', accountName: 'Construction in Progress' };
          var id4 = diff > 0 ? draft(home, [{ account: main.account + ' ' + main.accountName, dr: diff }, { account: '2000 Accounts Payable', cr: diff }]) : draft(home, [{ account: '2000 Accounts Payable', dr: -diff }, { account: main.account + ' ' + main.accountName, cr: -diff }]);
          add(docNo, 'BOOK', Math.abs(diff), 'Booked ' + L.money(booked) + ', invoice says ' + L.money(total) + '.' + (Math.round(Math.abs(diff) * 100) % 900 === 0 ? ' The gap divides by 9, the usual sign of swapped digits.' : ''), 'BOOK-1', { draft: id4, label: 'Entered Wrong' });
        }
      }
      // VEN-1: a signed W-9 before a new vendor is paid
      if (!v || !v.w9) {
        var amt = inv ? +inv.total || 0 : (b0 ? billTotal(b0) : 0);
        add(docNo, 'VEN', amt, (v ? v.vendor : vcode) + ' has no signed Form W-9 on file. Hold the payment until it arrives.', 'VEN-1', { label: 'Waiting for a Document' });
        requests.push({ what: 'Signed Form W-9 from ' + (v ? v.vendor : vcode), from: v ? v.vendor : vcode, doc: docNo });
      }
      // DOC-1: no invoice, no payment
      if (!inv && b0) {
        add(docNo, 'DOC', billTotal(b0), b0.entryId + ' is booked for ' + L.money(billTotal(b0)) + ' with no invoice on file.', 'DOC-1', { label: 'Waiting for a Document' });
        requests.push({ what: 'Invoice ' + b0.invoiceNo + ' from ' + b0.vendor, from: b0.vendor, doc: docNo });
      }
      // CUT-1: work in the month with no bill in the books
      if (inv && !b0 && L.validDate(inv.date) && L.d(inv.date) <= L.d(inp.periodEnd)) {
        var g2 = inv.job ? costCode(inv, guide) : null;
        var acct = inv.job ? '1400 Construction in Progress · Job ' + inv.job + (g2 ? ' · ' + g2.code : '') : 'Expense account (a person codes it)';
        var id5 = draft(home, [{ account: acct, dr: +inv.total || 0 }, { account: '2100 Accrued Liabilities', cr: +inv.total || 0 }]);
        add(docNo, 'CUT', +inv.total || 0, 'Invoice dated ' + L.longDate(inv.date) + ' is not in the books. Accrue it in the period, reverse when the bill is entered; a person decides whether the work belongs in the period.', 'CUT-1', { draft: id5, label: 'Not in the Books' });
      }
    });
    // in each document, findings follow the policy order
    var docOrder = {}; docs.forEach(function (D, i) { docOrder[D.inv ? D.inv.invoiceNo : D.bills[0].invoiceNo] = i; });
    findings.sort(function (a, b) { return (docOrder[a.doc] - docOrder[b.doc]) || (ORDER.indexOf(a.code) - ORDER.indexOf(b.code)); });

    var S = function (codes) { return L.sum(findings, function (f) { return codes.indexOf(f.code) >= 0 ? f.amount : 0; }); };
    var aprDocs = {}; findings.forEach(function (f) { if (f.code === 'APR') aprDocs[f.doc] = f.amount; });
    var summary = {
      docsChecked: docsChecked,
      fix: findings.filter(function (f) { return f.result === 'Fix Before Paying'; }).length,
      hold: findings.filter(function (f) { return f.result === 'On Hold'; }).length,
      person: findings.filter(function (f) { return f.result === 'Needs a Person'; }).length,
      assetToExpense: S(['CAP']), duplicates: S(['DUP']), misstated: S(['CAP', 'DUP', 'ENT', 'JOB', 'BOOK', 'CUT']),
      approvals: L.sum(Object.keys(aprDocs), function (k) { return aprDocs[k]; }), documents: S(['VEN', 'DOC'])
    };
    var checks = [
      { label: 'Every draft entry balances', ok: drafts.every(function (d) { return Math.abs(d.debit - d.credit) < 0.005; }), detail: drafts.length + ' draft entries, nothing posted' },
      { label: 'Every invoice and booked bill was checked', ok: true, detail: summary.docsChecked + ' documents: ' + invs.length + ' invoices on file, ' + bills.length + ' bills in the books' },
      { label: 'Clear to pay', ok: true, detail: (summary.docsChecked - Object.keys(findings.reduce(function (m, f) { m[f.doc] = 1; return m; }, {})).length) + ' documents clear to pay' }
    ];
    return { findings: findings, summary: summary, fullCost: fullCost, drafts: drafts, requests: requests, checks: checks, docs: docs.map(function (D) { return { key: D.key, doc: D.inv ? D.inv.invoiceNo : D.bills[0].invoiceNo, inv: D.inv, bills: D.bills.map(function (b) { return b.entryId; }), dups: D.dups.map(function (d) { return d.bill.entryId; }) }; }) };
  }

  return { id: 'accounting', extract: extract, calc: calc, norm: norm, RESULT: RESULT, CHECK: CHECK, ASSET_TYPES: ASSET_TYPES, READY_TYPES: READY_TYPES };
});
