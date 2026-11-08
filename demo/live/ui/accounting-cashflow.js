/* F1 Finance demos · "Try your own numbers" · 13-week cash flow panel content. */
(function () {
  'use strict';
  var FF = window.FFLive, L = FF.lib;

  FF.ui['accounting-cashflow'] = {
    title: '13-Week Cash Forecast · Nov 2, 2026 to Jan 31, 2027',
    sub: 'HANGS Construction Services LLC · operating account ending 4417 (GL 1010) · expected receipts are not cash until received',

    inputs: function (x, host) {
      var h = x.h, I = x.cur, R = x.rec;
      var cats = I.receiptsCats.concat(I.disbCats);
      host.appendChild(x.card('Opening cash and limits', null, [
        x.fields([
          x.field('Opening cash, ' + L.shortDate(I.start), I, 'opening', 'money', R, { help: 'October bank rec, adjusted book balance' }),
          x.field('Minimum balance (PAY-8)', I, 'minimum', 'money', R, { help: 'Every week-end, after payroll' }),
          x.field('Section 7.3 minimum liquidity', I, 'covenantMin', 'money', R, { help: 'Unrestricted cash at each month-end' }),
          x.field('Petty cash (unrestricted)', I, 'petty', 'money', R, { help: 'Restricted retainage is excluded' }),
          x.field('Construction line commitment', I, 'commitment', 'money', R),
          x.field('Construction line balance, Oct 31', I, 'loanBalance', 'money', R)
        ])
      ]));
      host.appendChild(x.card('Cash lines', 'Every dated receipt (positive) and payment (negative). The forecast puts each in its Monday-to-Sunday week. Untick “In” to leave a line out; tick “Assumed” for receipts that are not yet committed (planned draws).', [
        x.table([
          { key: 'include', label: 'In', type: 'check' },
          { key: 'date', label: 'Date', type: 'date' },
          { label: 'Week', get: function (r) { if (!L.validDate(r.date)) return ''; var w = Math.floor(L.daysBetween(I.start, r.date) / 7) + 1; return w >= 1 && w <= I.weeks ? String(w) : 'out'; }, num: true },
          { key: 'category', label: 'Category', type: 'select', options: cats, cls: 'is-wide' },
          { key: 'line', label: 'Line', type: 'text', cls: 'is-wide' },
          { key: 'amount', label: 'Amount', type: 'money' },
          { key: 'assumed', label: 'Assumed', type: 'check' },
          { key: 'discretionary', label: 'Discretionary', type: 'check' }
        ], I.lines, R.lines, { add: function () { return { date: I.start, category: 'Other receipts', line: '', amount: 0, rule: '', status: '', include: true, assumed: false, discretionary: false }; }, addLabel: 'Add a cash line', rowClass: function (r) { return r.include ? null : 'is-sub'; } }),
        x.note('Week numbers refresh when the inputs redraw (switch modes, add or remove a line).')
      ]));
    },

    results: function (x, host, c, r) {
      var I = x.cur, h = x.h;
      host.appendChild(x.card('Checks', null, [x.checks(c.checks)]));
      // the 13-week table
      var W = c.weeks, cols = [{ label: 'Week', get: function (row) { return row.label; }, wrap: true }].concat(W.map(function (w) { return { label: String(w.week), get: function (row) { return row.vals[w.week - 1]; }, num: true, fmt: 'money' }; })).concat([{ label: '13 weeks', get: function (row) { return row.total; }, num: true, fmt: 'money' }]);
      var rows = [];
      rows.push({ label: 'Week of', vals: W.map(function (w) { return L.shortDate(w.of); }), total: '', _txt: true });
      rows.push({ label: 'Opening cash', vals: W.map(function (w) { return w.opening; }), total: W[0].opening });
      c.cats.receipts.forEach(function (k) { rows.push({ label: k, vals: c.grid[k], total: L.sum(c.grid[k]), _sub: true }); });
      rows.push({ label: 'Total receipts', vals: W.map(function (w) { return w.receipts; }), total: c.totalR, _strong: true });
      c.cats.disb.forEach(function (k) { rows.push({ label: k, vals: c.grid[k], total: L.sum(c.grid[k]), _sub: true }); });
      rows.push({ label: 'Total disbursements', vals: W.map(function (w) { return w.disb; }), total: c.totalD, _strong: true });
      rows.push({ label: 'Net cash flow', vals: W.map(function (w) { return w.net; }), total: L.round2(c.totalR + c.totalD) });
      rows.push({ label: 'Ending cash', vals: W.map(function (w) { return w.ending; }), total: c.ending, _strong: true });
      if (x.edit) rows.push({ label: 'Ending cash, recorded run', vals: r.weeks.map(function (w) { return w.ending; }), total: r.ending, _sub: true });
      rows.push({ label: 'Above (below) the minimum', vals: W.map(function (w) { return w.above; }), total: '' });
      var tbl = x.data(cols.map(function (cc, i) { if (i === 0) return cc; return { label: cc.label, num: true, get: function (row) { var v = cc.get(row); return row._txt || typeof v !== 'number' ? v : FF.fmt(v, 'money'); }, cls: function (row, ri) { var wk = i; return row.label === 'Above (below) the minimum' && typeof row.vals[wk - 1] === 'number' && row.vals[wk - 1] < 0 ? 'is-neg' : ''; } }; }), rows, { rowClass: function (row) { return row._strong ? 'is-strong' : row._sub ? 'is-sub' : null; } });
      host.appendChild(x.card('13-week forecast', 'Lowest week: week ' + c.low.week + ' (' + L.shortDate(c.low.of) + ' to ' + L.shortDate(c.low.through) + ') at ' + L.money(c.low.ending) + '.', [tbl]));
      host.appendChild(x.card('Summary', null, [x.figures([
        { label: 'Opening cash', v: I.opening, r: x.rec.opening },
        { label: 'Receipts, 13 weeks (expected, not cash)', v: c.totalR, r: r.totalR },
        { label: 'Disbursements, 13 weeks', v: c.totalD, r: r.totalD },
        { label: 'Ending cash, week 13', v: c.ending, r: r.ending, strong: true },
        { label: 'Lowest week', v: c.low.week, r: r.low.week, fmt: 'int' },
        { label: 'Lowest week-ending cash', v: c.low.ending, r: r.low.ending, strong: true },
        { label: 'Below the ' + L.money(I.minimum) + ' minimum by', v: c.belowBy, r: r.belowBy },
        { label: 'Contract payments in the forecast', v: c.contracts, r: r.contracts },
        { label: 'Payroll, 13 weeks', v: c.payroll, r: r.payroll },
        { label: 'Construction draws in the forecast', v: c.draws, r: r.draws },
        { label: 'Of which assumed, not yet submitted', v: c.assumed, r: r.assumed },
        { label: 'Construction line still available', v: c.available, r: r.available },
        { label: 'Lowest month-end headroom, Section 7.3', v: c.minHead.headroom, r: r.minHead.headroom, strong: true }
      ])]));
      host.appendChild(x.card('Minimum liquidity, Section 7.3', 'Unrestricted cash = operating cash + petty cash, at each month-end. Not less than ' + L.money(I.covenantMin) + '.', [
        x.data([
          { label: 'Month-end', get: function (m) { return L.longDate(m.date); } },
          { label: 'Operating cash', key: 'operating', fmt: 'money' },
          { label: 'Unrestricted', key: 'unrestricted', fmt: 'money' },
          { label: 'Headroom', key: 'headroom', fmt: 'money' },
          { label: 'Result', get: function (m) { return x.tag(m.meets ? 'Meets 7.3' : 'Below 7.3', m.meets ? 'ok' : 'bad'); } },
          { label: 'Without assumed draws', key: 'withoutAssumed', fmt: 'money' },
          { label: '', get: function (m) { return x.tag(m.meetsWithout ? 'Meets' : 'Below', m.meetsWithout ? 'ok' : 'warn'); } }
        ], c.monthEnds),
        x.note('Sections 7.1 and 7.2 are balance sheet covenants tested in the monthly reporting package; a cash forecast does not project them.')
      ]));
      host.appendChild(x.card('Flags for the Controller', 'A person decides each one; nothing is paid, posted or drawn.', [
        c.flags.length ? x.data([
          { label: 'Flag', key: 'flag', wrap: true }, { label: 'Item', key: 'item', wrap: true }, { label: 'Result', get: function (f) { return x.tag(f.result, /Breach|Decision|Exceed/.test(f.result) ? 'bad' : /Left Out|Confirm/.test(f.result) ? 'info' : 'warn'); } }, { label: 'Amount', key: 'amount', fmt: 'money' }, { label: 'Rule', key: 'rule' }, { label: 'What it means', key: 'note', wrap: true }
        ], c.flags) : x.note('No flags.')
      ]));
      if (c.restore.length) host.appendChild(x.card('What would restore week ' + c.low.week + ' (CF-6): a person chooses', null, [
        x.data([{ label: 'Option', key: 'option', wrap: true }, { label: 'Amount', key: 'amount', fmt: 'money' }, { label: 'Week ' + c.low.week + ' ends at', key: 'endsAt', fmt: 'money' }, { label: 'Restores it?', get: function (o) { return x.tag(o.restores ? 'Yes' : 'No', o.restores ? 'ok' : 'bad'); } }], c.restore)
      ]));
      host.appendChild(x.card('Change from last week’s forecast', 'Week-ending cash in this forecast against last week’s, for the twelve weeks both cover. Last week’s figures are read-only (they come from last week’s file).', [
        x.data([{ label: 'Week', key: 'week' }, { label: 'This forecast', key: 'ours', fmt: 'money' }, { label: 'Last week’s', key: 'last', fmt: 'money' }, { label: 'Change', key: 'change', fmt: 'money' }], c.variance)
      ]));
      host.appendChild(x.card('Read-only in this panel', null, [x.note('The payment date conflict on PO-27-0511 is a comparison of two documents (the signed purchase order against the billing forecast) and is shown as the recorded run found it. The payables, payroll calendar and loan interest that produced each cash line are not recalculated: edit the cash lines themselves.', true)]));
    },

    keys: function (c, r) {
      return [
        { label: 'Ending cash, week 13', value: L.money(c.ending), rec: L.money(r.ending) },
        { label: 'Lowest week', value: 'Week ' + c.low.week + ' · ' + L.money(c.low.ending), rec: 'Week ' + r.low.week + ' · ' + L.money(r.low.ending), tone: c.belowBy ? 'bad' : 'ok' },
        { label: 'Below the minimum by', value: L.money(c.belowBy), rec: L.money(r.belowBy), tone: c.belowBy ? 'bad' : 'ok' },
        { label: 'Lowest 7.3 headroom', value: L.money(c.minHead.headroom), rec: L.money(r.minHead.headroom), tone: c.minHead.headroom < 0 ? 'bad' : 'ok' },
        { label: 'Flags', value: String(c.flags.length), rec: String(r.flags.length), tone: c.flags.length ? 'warn' : 'ok' }
      ];
    },

    csv: function (c, I, r, edit) {
      var rows = [['Week'].concat(c.weeks.map(function (w) { return 'Week ' + w.week; })).concat(['13 weeks'])];
      rows.push(['Week of'].concat(c.weeks.map(function (w) { return w.of; })).concat(['']));
      rows.push(['Opening cash'].concat(c.weeks.map(function (w) { return L.plain(w.opening); })).concat([L.plain(I.opening)]));
      c.cats.receipts.concat(c.cats.disb).forEach(function (k) { rows.push([k].concat(c.grid[k].map(L.plain)).concat([L.plain(L.sum(c.grid[k]))])); });
      rows.push(['Total receipts'].concat(c.weeks.map(function (w) { return L.plain(w.receipts); })).concat([L.plain(c.totalR)]));
      rows.push(['Total disbursements'].concat(c.weeks.map(function (w) { return L.plain(w.disb); })).concat([L.plain(c.totalD)]));
      rows.push(['Ending cash'].concat(c.weeks.map(function (w) { return L.plain(w.ending); })).concat([L.plain(c.ending)]));
      rows.push(['Ending cash, recorded run'].concat(r.weeks.map(function (w) { return L.plain(w.ending); })).concat([L.plain(r.ending)]));
      rows.push([]); rows.push(['Month-end', 'Unrestricted cash', 'Section 7.3 minimum', 'Headroom', 'Result', 'Without assumed draws']);
      c.monthEnds.forEach(function (m) { rows.push([m.date, L.plain(m.unrestricted), L.plain(m.minimum), L.plain(m.headroom), m.meets ? 'Meets 7.3' : 'Below 7.3', L.plain(m.withoutAssumed)]); });
      rows.push([]); rows.push(['Flag', 'Item', 'Result', 'Amount', 'Rule', 'Note']);
      c.flags.forEach(function (f) { rows.push([f.flag, f.item, f.result, L.plain(f.amount), f.rule, f.note]); });
      rows.push([]); rows.push(['Check', 'Result', 'Detail']);
      c.checks.forEach(function (k) { rows.push([k.label, k.ok === true ? 'Pass' : k.ok === 'warn' ? 'Review' : 'Fail', k.detail]); });
      rows.push([]); rows.push(['Cash line date', 'Category', 'Line', 'Amount', 'In the forecast', 'Assumed']);
      I.lines.forEach(function (l) { rows.push([l.date, l.category, l.line, L.plain(l.amount), l.include ? 'Yes' : 'No', l.assumed ? 'Yes' : '']); });
      return rows;
    }
  };
})();
