/* F1 Finance demos · "Try your own numbers" · AP review panel content. */
(function () {
  'use strict';
  var FF = window.FFLive, L = FF.lib, C = FF.calc['accounting'];
  var TYPES = ['asset', 'item', 'setup', 'freight', 'install', 'service', 'material', 'rental', 'fee'];
  var TONE = { 'Fix Before Paying': 'bad', 'On Hold': 'warn', 'Needs a Person': 'info' };

  function docTitle(d) { return d.inv ? d.inv.invoiceNo : d.bills[0] ? d.bills[0].invoiceNo : ''; }

  FF.ui['accounting'] = {
    title: 'AP Review · October 2026',
    sub: 'HANGS Construction Services LLC · invoices on file against bills in the books, under the Finance Policy Book v3.2',

    inputs: function (x, host) {
      var h = x.h, I = x.cur, R = x.rec;
      var recInv = {}; R.invoices.forEach(function (v) { recInv[v.capId] = v; });
      var recBill = {}; R.bills.forEach(function (b) { recBill[b.entryId] = b; });
      var res = C.calc(I);
      var byEntry = {}; I.bills.forEach(function (b) { byEntry[b.entryId] = b; });
      host.appendChild(x.card('Settings', null, [
        x.fields([
          x.field('Period end', I, 'periodEnd', 'date', R),
          x.field('Capitalization threshold (CAP-1)', I, 'threshold', 'money', R, { help: 'Per item, not per invoice' }),
          x.field('Paying entity', I, 'home', 'text', R)
        ])
      ]));
      // one card per document: the invoice on file and the bill(s) in the books
      var list = h('div');
      res.docs.forEach(function (d) {
        var inv = d.inv, bills = d.bills.concat(d.dups).map(function (id) { return byEntry[id]; }).filter(Boolean);
        var b0 = bills[0];
        var summary = h('summary', null, [
          h('b', { text: docTitle({ inv: inv, bills: bills }) }),
          h('span', { class: 'ffl-dmeta', text: (inv ? inv.vendor : b0.vendor) + ' · ' + (inv ? 'invoice ' + L.money(inv.total) : 'no invoice on file') + ' · ' + (b0 ? 'booked ' + L.money(L.sum(b0.lines, function (l) { return l.amount; })) + (bills.length > 1 ? ' (+' + (bills.length - 1) + ' more)' : '') : 'not in the books') }),
          h('span', { class: 'ffl-dflags' })
        ]);
        var body = h('div', { class: 'ffl-docbody' });
        if (inv) {
          var ri = recInv[inv.capId];
          body.appendChild(h('div', null, [
            h('h5', { text: 'Invoice on file · ' + inv.capId }),
            x.fields([
              x.field('Vendor code', inv, 'vendorCode', 'text', ri, { structural: true }),
              x.field('Vendor', inv, 'vendor', 'text', ri),
              x.field('Invoice no.', inv, 'invoiceNo', 'text', ri, { structural: true }),
              x.field('Invoice date', inv, 'date', 'date', ri),
              x.field('Bill to', inv, 'billTo', 'text', ri),
              x.field('Job on the invoice', inv, 'job', 'text', ri, { help: 'Blank: yard or overhead' }),
              x.field('Sales tax', inv, 'tax', 'money', ri),
              x.field('Invoice total', inv, 'total', 'money', ri)
            ]),
            x.table([
              { key: 'desc', label: 'Line', type: 'text', cls: 'is-wide' },
              { key: 'qty', label: 'Qty', type: 'number', cls: 'is-narrow' },
              { key: 'unit', label: 'Unit price', type: 'money' },
              { key: 'amount', label: 'Amount', type: 'money' },
              { key: 'type', label: 'Type', type: 'select', options: TYPES },
              { key: 'taxed', label: 'Taxed', type: 'check' }
            ], inv.lines, ri ? ri.lines : null, { add: function () { return { desc: '', qty: 1, unit: 0, amount: 0, type: 'service', taxed: false }; }, addLabel: 'Add an invoice line' }),
            x.edit ? h('button', { type: 'button', class: 'ffl-btn ffl-add', onclick: function () { I.invoices.splice(I.invoices.indexOf(inv), 1); x.rerender(); } }, 'Remove this invoice') : null
          ]));
        }
        bills.forEach(function (b) {
          var rb = recBill[b.entryId], names = I.approvers.map(function (a) { return a.name; });
          if (b.approver && names.indexOf(b.approver) < 0) names.push(b.approver);
          body.appendChild(h('div', null, [
            h('h5', { text: 'Bill in the books · ' + b.entryId }),
            x.fields([
              x.field('Vendor code', b, 'vendorCode', 'text', rb, { structural: true }),
              x.field('Invoice no. as entered', b, 'invoiceNo', 'text', rb, { structural: true }),
              x.field('Entry date', b, 'date', 'date', rb),
              x.field('Entity booked in', b, 'entity', 'text', rb),
              x.field('Approved by', b, 'approver', 'select', rb, { options: names.concat(['']).map(function (n) { return { value: n, label: n || '(no approver)' }; }) }),
              x.field('Approved amount', b, 'approved', 'money', rb)
            ]),
            x.table([
              { key: 'account', label: 'Account', type: 'text', cls: 'is-narrow' },
              { key: 'accountName', label: 'Account name', type: 'text' },
              { key: 'job', label: 'Job', type: 'text', cls: 'is-narrow' },
              { key: 'costCode', label: 'Cost code', type: 'text', cls: 'is-narrow' },
              { key: 'amount', label: 'Amount', type: 'money' }
            ], b.lines, rb ? rb.lines : null, { add: function () { return { account: '1400', accountName: 'Construction in Progress', job: '', costCode: '', amount: 0 }; }, addLabel: 'Add a book line' }),
            x.edit ? h('button', { type: 'button', class: 'ffl-btn ffl-add', onclick: function () { I.bills.splice(I.bills.indexOf(b), 1); x.rerender(); } }, 'Remove this bill') : null
          ]));
        });
        list.appendChild(h('details', { class: 'ffl-doc', 'data-doc': d.doc }, [summary, body]));
      });
      var seq = I.invoices.length + 1, seqB = I.bills.length + 1;
      host.appendChild(x.card('Invoices and bills', res.docs.length + ' documents. Open one to edit the paper, the books, or both. The flags beside each show its findings, live.', [
        list,
        x.edit ? h('div', { class: 'ffl-actions' }, [
          h('button', { type: 'button', class: 'ffl-btn', onclick: function () { I.invoices.push({ capId: 'CAP-' + (1000 + seq + 100), vendorCode: '', vendor: '', invoiceNo: 'NEW-' + seq, date: I.periodEnd, billTo: I.home, job: '', subtotal: 0, tax: 0, total: 0, lines: [{ desc: '', qty: 1, unit: 0, amount: 0, type: 'service', taxed: false }] }); x.rerender(); } }, '+ Add an invoice'),
          h('button', { type: 'button', class: 'ffl-btn', onclick: function () { I.bills.push({ entryId: 'AP-' + (10400 + seqB + 100), vendorCode: '', vendor: '', invoiceNo: 'NEW-' + seqB, date: I.periodEnd, entity: I.home, approver: '', approved: 0, lines: [{ account: '1400', accountName: 'Construction in Progress', job: '', costCode: '', amount: 0 }] }); x.rerender(); } }, '+ Add a booked bill')
        ]) : null
      ]));
      host.appendChild(x.card('Approvers (Policy Book, Appendix A)', 'Project managers approve on their own jobs only. A blank limit means no limit. An invoice with no job counts as the yard (00-YD).', [
        x.table([
          { key: 'name', label: 'Name', type: 'text', structural: true },
          { key: 'role', label: 'Role', type: 'text' },
          { key: 'limit', label: 'Limit', type: 'money' },
          { key: 'jobs', label: 'Jobs', type: 'text' }
        ], I.approvers, R.approvers, { add: function () { return { name: '', role: 'Project Manager', limit: 10000, jobs: '' }; }, addLabel: 'Add an approver' })
      ]));
      host.appendChild(x.card('Vendor file', 'VEN-1: no payment to a vendor without a signed Form W-9.', [
        x.table([
          { key: 'code', label: 'Code', type: 'text', cls: 'is-narrow' },
          { key: 'vendor', label: 'Vendor', type: 'text', cls: 'is-wide' },
          { key: 'added', label: 'Added', type: 'date' },
          { key: 'w9', label: 'Signed W-9', type: 'check' }
        ], I.vendors, R.vendors, { add: function () { return { code: '', vendor: '', added: I.periodEnd, w9: false }; }, addLabel: 'Add a vendor' })
      ]));
      host.appendChild(x.card('Cost code guide (Policy Book, Appendix B)', 'Read-only: the words on an invoice that decide its cost code for JOB-1.', [
        x.data([{ label: 'Words on the invoice', get: function (g) { return g.words.join(', '); }, wrap: true }, { label: 'Cost code', key: 'code' }, { label: 'Label', key: 'label' }], I.guide)
      ]));
    },

    results: function (x, host, c, r) {
      var s = c.summary, q = r.summary;
      // live flags on the document cards
      var byDoc = {}; c.findings.forEach(function (f) { (byDoc[f.doc] = byDoc[f.doc] || []).push(f); });
      var pnl = x.panel && x.panel.inCol;
      if (pnl) [].slice.call(pnl.querySelectorAll('.ffl-doc[data-doc]')).forEach(function (el) {
        var box = el.querySelector('.ffl-dflags'); if (!box) return; box.textContent = '';
        var fs = byDoc[el.getAttribute('data-doc')] || [];
        if (!fs.length) box.appendChild(x.tag('Clear', 'ok'));
        fs.forEach(function (f) { box.appendChild(x.tag(f.clause, TONE[f.result] || 'info')); });
      });
      host.appendChild(x.card('Summary', null, [x.figures([
        { label: 'Documents checked', v: s.docsChecked, r: q.docsChecked, fmt: 'int' },
        { label: 'Findings to fix before paying', v: s.fix, r: q.fix, fmt: 'int' },
        { label: 'Findings on hold', v: s.hold, r: q.hold, fmt: 'int' },
        { label: 'Findings that need a person', v: s.person, r: q.person, fmt: 'int' },
        { label: 'Asset cost sent to expense', v: s.assetToExpense, r: q.assetToExpense },
        { label: 'Duplicate payments stopped', v: s.duplicates, r: q.duplicates },
        { label: 'Misstated in the books', v: s.misstated, r: q.misstated, strong: true },
        { label: 'Invoices waiting for approval', v: s.approvals, r: q.approvals },
        { label: 'Invoices waiting for a document', v: s.documents, r: q.documents }
      ]), x.checks(c.checks)]));
      host.appendChild(x.card('Findings', 'One row per finding, in document order. A person decides each one; nothing is posted or paid.', [
        c.findings.length ? x.data([
          { label: 'Document', key: 'doc' },
          { label: 'Clause', key: 'clause' },
          { label: 'Check', key: 'check' },
          { label: 'Result', get: function (f) { return x.tag(f.result, TONE[f.result] || 'info'); } },
          { label: 'Amount at issue', key: 'amount', fmt: 'money' },
          { label: 'What was found', key: 'text', wrap: true }
        ], c.findings) : x.note('No findings: every document passes every check.')
      ]));
      host.appendChild(x.card('Full cost of assets (CAP-1, CAP-2)', 'Every item of ' + L.money(x.cur.threshold) + ' or more carries its delivery, setup, installation and sales tax.', [
        c.fullCost.length ? x.data([
          { label: 'Document', key: 'doc' }, { label: 'Item', key: 'item', wrap: true }, { label: 'Price', key: 'price', fmt: 'money' }, { label: 'Ready to use', key: 'ready', fmt: 'money' }, { label: 'Sales tax', key: 'tax', fmt: 'money' }, { label: 'Full cost', key: 'full', fmt: 'money' }, { label: 'Capitalized', key: 'capitalized', fmt: 'money' }, { label: 'Short', key: 'short', fmt: 'money' }
        ], c.fullCost) : x.note('No items at or over the threshold.')
      ]));
      var rows = [];
      c.drafts.forEach(function (d) { d.lines.forEach(function (ln, i) { rows.push({ id: i ? '' : d.id, entity: i ? '' : d.entity, account: ln.account, dr: ln.dr || null, cr: ln.cr || null }); }); });
      host.appendChild(x.card('Draft entries (not posted)', 'For a person to post in the accounting system.', [
        rows.length ? x.data([{ label: 'Draft', key: 'id' }, { label: 'Entity', key: 'entity', wrap: true }, { label: 'Account', key: 'account', wrap: true }, { label: 'Debit', key: 'dr', fmt: 'money' }, { label: 'Credit', key: 'cr', fmt: 'money' }], rows) : x.note('No entries needed.')
      ]));
      host.appendChild(x.card('Requests', 'Held invoices wait on these.', [
        c.requests.length ? x.data([{ label: 'What', key: 'what', wrap: true }, { label: 'From', key: 'from' }, { label: 'Document', key: 'doc' }], c.requests) : x.note('Nothing to request.')
      ]));
      host.appendChild(x.card('Read-only in this panel', null, [x.note('Two context notes in the recorded findings come from documents outside these lists and are not recalculated: the bill history behind the QBP-3077 coding note, and the vendor-file dates quoted in the narrative. The checks themselves all run live.', true)]));
    },

    keys: function (c, r) {
      var s = c.summary, q = r.summary;
      return [
        { label: 'Findings', value: String(c.findings.length), rec: String(r.findings.length), tone: c.findings.length ? 'warn' : 'ok' },
        { label: 'Fix before paying', value: String(s.fix), rec: String(q.fix), tone: s.fix ? 'bad' : 'ok' },
        { label: 'Misstated in the books', value: L.money(s.misstated), rec: L.money(q.misstated) },
        { label: 'Waiting for approval', value: L.money(s.approvals), rec: L.money(q.approvals) },
        { label: 'Waiting for a document', value: L.money(s.documents), rec: L.money(q.documents) }
      ];
    },

    csv: function (c, I, r, edit) {
      var s = c.summary, q = r.summary, rows = [['Measure', edit ? 'Your numbers' : 'Recorded run', 'Recorded run']];
      [['Documents checked', 'docsChecked', 0], ['Findings to fix before paying', 'fix', 0], ['Findings on hold', 'hold', 0], ['Findings that need a person', 'person', 0], ['Asset cost sent to expense', 'assetToExpense', 1], ['Duplicate payments stopped', 'duplicates', 1], ['Misstated in the books', 'misstated', 1], ['Invoices waiting for approval', 'approvals', 1], ['Invoices waiting for a document', 'documents', 1]]
        .forEach(function (p) { rows.push([p[0], p[2] ? L.plain(s[p[1]]) : s[p[1]], p[2] ? L.plain(q[p[1]]) : q[p[1]]]); });
      rows.push([]); rows.push(['Document', 'Clause', 'Check', 'Result', 'Amount at issue', 'What was found']);
      c.findings.forEach(function (f) { rows.push([f.doc, f.clause, f.check, f.result, L.plain(f.amount), f.text]); });
      rows.push([]); rows.push(['Draft', 'Entity', 'Account', 'Debit', 'Credit']);
      c.drafts.forEach(function (d) { d.lines.forEach(function (ln) { rows.push([d.id, d.entity, ln.account, ln.dr ? L.plain(ln.dr) : '', ln.cr ? L.plain(ln.cr) : '']); }); });
      rows.push([]); rows.push(['Request', 'From', 'Document']);
      c.requests.forEach(function (k) { rows.push([k.what, k.from, k.doc]); });
      rows.push([]); rows.push(['Invoice', 'Vendor', 'Date', 'Bill to', 'Job', 'Tax', 'Total']);
      I.invoices.forEach(function (v) { rows.push([v.invoiceNo, v.vendor, v.date, v.billTo, v.job, L.plain(v.tax), L.plain(v.total)]); });
      rows.push(['Bill', 'Invoice as entered', 'Entity', 'Approver', 'Approved', 'Booked']);
      I.bills.forEach(function (b) { rows.push([b.entryId, b.invoiceNo, b.entity, b.approver, L.plain(b.approved), L.plain(L.sum(b.lines, function (l) { return l.amount; }))]); });
      return rows;
    }
  };
})();
