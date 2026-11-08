/* F1 Finance demos · "Try your own numbers" · bank reconciliation panel content. */
(function () {
  'use strict';
  var FF = window.FFLive, L = FF.lib;
  var RESULTS = ['Book Before Close', 'Needs a Person', 'Follow Up'];

  FF.ui['accounting-bankrec'] = {
    title: 'Bank Reconciliation · October 2026',
    sub: 'HANGS Construction Services LLC · Cobalt Harbor account ending 4417 · GL 1010 Cash - Operating',

    inputs: function (x, host) {
      var I = x.cur, R = x.rec;
      host.appendChild(x.card('Balances', null, [
        x.fields([
          x.field('Statement date', I, 'statementDate', 'date', R),
          x.field('Balance per bank statement', I, 'bankEnding', 'money', R),
          x.field('Balance per books, GL 1010', I, 'book', 'money', R),
          x.field('Stale after (days, CASH-4)', I, 'staleDays', 'int', R)
        ])
      ]));
      host.appendChild(x.card('Outstanding checks', 'Written in the books, not yet cleared by the bank. Subtracted from the bank balance.', [
        x.table([
          { key: 'ref', label: 'Check', type: 'text', cls: 'is-narrow' },
          { key: 'date', label: 'Dated', type: 'date', structural: true },
          { key: 'who', label: 'Payee', type: 'text', cls: 'is-wide' },
          { key: 'amount', label: 'Amount', type: 'money' },
          { label: 'Days out', get: function (r) { return L.validDate(r.date) && L.validDate(I.statementDate) ? String(L.daysBetween(r.date, I.statementDate)) : ''; }, num: true }
        ], I.checks, R.checks, { add: function () { return { ref: '', date: I.statementDate, who: '', amount: 0 }; }, addLabel: 'Add an outstanding check' })
      ]));
      host.appendChild(x.card('Deposits in transit', 'Recorded in the books, not yet on the statement. Added to the bank balance.', [
        x.table([
          { key: 'ref', label: 'Deposit', type: 'text', cls: 'is-narrow' },
          { key: 'date', label: 'Dated', type: 'date' },
          { key: 'who', label: 'Source', type: 'text', cls: 'is-wide' },
          { key: 'amount', label: 'Amount', type: 'money' }
        ], I.dit, R.dit, { add: function () { return { ref: 'DEP-', date: I.statementDate, who: '', amount: 0 }; }, addLabel: 'Add a deposit in transit' })
      ]));
      host.appendChild(x.card('Bank errors', 'Mistakes on the bank’s side. Positive adds to the bank balance, negative subtracts. The bank corrects them; no book entry.', [
        x.table([
          { key: 'desc', label: 'What the bank got wrong', type: 'text', cls: 'is-wide' },
          { key: 'amount', label: 'Adjust bank by', type: 'money' }
        ], I.bankErrors, R.bankErrors, { add: function () { return { desc: '', amount: 0 }; }, addLabel: 'Add a bank error' }),
        I.bankErrors.length ? null : x.note('None in the recorded run.')
      ]));
      host.appendChild(x.card('Book adjustments', 'Items on the statement the books do not have yet. Positive adds to the book balance, negative subtracts. Each becomes a proposed entry; nothing is posted.', [
        x.table([
          { key: 'desc', label: 'Item', type: 'text', cls: 'is-wide' },
          { key: 'amount', label: 'Adjust books by', type: 'money' },
          { key: 'account', label: 'Other account', type: 'text', cls: 'is-wide' },
          { key: 'result', label: 'Result', type: 'select', options: RESULTS }
        ], I.adjustments, R.adjustments, { add: function () { return { desc: '', amount: 0, account: '', result: 'Book Before Close' }; }, addLabel: 'Add a book adjustment' })
      ]));
      host.appendChild(x.card('Opening tie to September', 'The statement and the books start where the signed September reconciliation ended.', [
        x.fields([
          x.field('Bank, September 30, per October statement', I.opening, 'bankStatement', 'money', R.opening),
          x.field('Bank, per signed September rec', I.opening, 'bankPriorRec', 'money', R.opening),
          x.field('GL 1010, September 30', I.opening, 'glOpening', 'money', R.opening),
          x.field('Adjusted book balance, September rec', I.opening, 'bookPriorRec', 'money', R.opening)
        ])
      ]));
    },

    results: function (x, host, c, r) {
      host.appendChild(x.card(c.reconciled ? 'Reconciled to the cent' : 'Not reconciled', c.reconciled ? 'Adjusted bank balance equals adjusted book balance (CASH-1).' : 'The difference must be $0.00 before close. Nothing is plugged.', [x.checks(c.checks)]));
      var I = x.cur;
      host.appendChild(x.card('Reconciliation', null, [x.figures([
        { label: 'Balance per bank, ' + (L.validDate(I.statementDate) ? L.longDate(I.statementDate) : ''), v: I.bankEnding, r: x.rec.bankEnding },
        { label: 'Add: deposits in transit', v: c.dit, r: r.dit },
        { label: 'Less: outstanding checks', v: -c.oc, r: -r.oc },
        { label: 'Bank errors', v: c.errs, r: r.errs },
        { label: 'Adjusted bank balance', v: c.adjBank, r: r.adjBank, strong: true },
        { label: 'Balance per books, GL 1010', v: I.book, r: x.rec.book },
        { label: 'Book adjustments, net', v: c.net, r: r.net },
        { label: 'Adjusted book balance', v: c.adjBook, r: r.adjBook, strong: true },
        { label: 'Unexplained difference (must be $0.00)', v: c.diff, r: r.diff, strong: true }
      ])]));
      host.appendChild(x.card('Reconciling items and findings', 'One row per item. A person decides each one.', [
        x.data([
          { label: 'Finding', key: 'finding', wrap: true },
          { label: 'Check', key: 'check' },
          { label: 'Result', get: function (f) { return x.tag(f.result, /Book Before|Follow/.test(f.result) ? 'info' : /Investigate|Ask/.test(f.result) ? 'bad' : 'warn'); } },
          { label: 'Amount', key: 'amount', fmt: 'money' }
        ], c.findings),
        x.note(c.findings.length + ' open items, ' + c.proposed + ' proposed entries. Recorded run: ' + r.openItems + ' and ' + r.proposed + '.')
      ]));
      var rows = [];
      c.entries.forEach(function (e) { e.lines.forEach(function (ln, i) { rows.push({ id: i ? '' : e.id, account: ln.account, dr: ln.dr || null, cr: ln.cr || null }); }); });
      host.appendChild(x.card('Proposed entries (not posted)', 'For a person to post after the Controller’s review (CASH-6).', [
        rows.length ? x.data([{ label: 'Entry', key: 'id' }, { label: 'Account', key: 'account', wrap: true }, { label: 'Debit', key: 'dr', fmt: 'money' }, { label: 'Credit', key: 'cr', fmt: 'money' }], rows) : x.note('No book adjustments, so no entries.')
      ]));
      host.appendChild(x.card('Read-only in this panel', null, [x.note('The line-by-line matching of the October register to the statement (Deposits and Payments tabs) is what produced these outstanding items in the recorded run; here you edit the resulting lists directly rather than the statement itself.', true)]));
    },

    keys: function (c, r) {
      return [
        { label: 'Adjusted bank balance', value: L.money(c.adjBank), rec: L.money(r.adjBank) },
        { label: 'Adjusted book balance', value: L.money(c.adjBook), rec: L.money(r.adjBook) },
        { label: 'Unexplained difference', value: L.money(c.diff), rec: L.money(r.diff), tone: c.reconciled ? 'ok' : 'bad' },
        { label: 'Result', value: c.reconciled ? 'Reconciled' : 'Not reconciled', tone: c.reconciled ? 'ok' : 'bad' },
        { label: 'Open items', value: String(c.openItems), rec: String(r.openItems) }
      ];
    },

    csv: function (c, I, r, edit) {
      var rows = [['Reconciliation line', edit ? 'Your numbers' : 'Recorded run', 'Recorded run']];
      rows.push(['Balance per bank', L.plain(I.bankEnding), '']);
      rows.push(['Deposits in transit', L.plain(c.dit), L.plain(r.dit)]);
      rows.push(['Outstanding checks', L.plain(c.oc), L.plain(r.oc)]);
      rows.push(['Bank errors', L.plain(c.errs), L.plain(r.errs)]);
      rows.push(['Adjusted bank balance', L.plain(c.adjBank), L.plain(r.adjBank)]);
      rows.push(['Balance per books', L.plain(I.book), '']);
      rows.push(['Book adjustments, net', L.plain(c.net), L.plain(r.net)]);
      rows.push(['Adjusted book balance', L.plain(c.adjBook), L.plain(r.adjBook)]);
      rows.push(['Unexplained difference', L.plain(c.diff), L.plain(r.diff)]);
      rows.push(['Result', c.reconciled ? 'Reconciled to the cent' : 'Not reconciled', r.reconciled ? 'Reconciled to the cent' : 'Not reconciled']);
      rows.push([]); rows.push(['Finding', 'Check', 'Result', 'Amount', 'Note']);
      c.findings.forEach(function (f) { rows.push([f.finding, f.check, f.result, L.plain(f.amount), f.note || '']); });
      rows.push([]); rows.push(['Proposed entry', 'Account', 'Debit', 'Credit']);
      c.entries.forEach(function (e) { e.lines.forEach(function (ln) { rows.push([e.id, ln.account, ln.dr ? L.plain(ln.dr) : '', ln.cr ? L.plain(ln.cr) : '']); }); });
      rows.push([]); rows.push(['Outstanding check', 'Dated', 'Payee', 'Amount']);
      I.checks.forEach(function (k) { rows.push([k.ref, k.date, k.who, L.plain(k.amount)]); });
      rows.push(['Deposit in transit', 'Dated', 'Source', 'Amount']);
      I.dit.forEach(function (k) { rows.push([k.ref, k.date, k.who, L.plain(k.amount)]); });
      return rows;
    }
  };
})();
