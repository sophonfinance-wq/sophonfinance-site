/* F1 Finance demos · "Try your own numbers" · Form 941 panel content. */
(function () {
  'use strict';
  var FF = window.FFLive, L = FF.lib, C = FF.calc['tax-941'];
  var MONTH = function (k) { var p = k.split('-'); return L.MONTHS[+p[1] - 1] + ' ' + p[0]; };

  FF.ui['tax-941'] = {
    title: 'Form 941 · Q3 2026',
    sub: 'HANGS Construction Services LLC · EIN ••-•••7890 (demonstration) · Third quarter, July 1 to September 30, 2026',

    inputs: function (x, host) {
      var h = x.h, I = x.cur, R = x.rec;
      // rates
      host.appendChild(x.card('Rates and limits', 'The recorded run’s 2026 values, from its own workpapers (Social Security and Medicare tab). Change them only to see what a different rule would do.', [
        x.fields([
          x.field('Social Security rate, each share (%)', I.rates, 'ss', 'pct', R.rates, { help: '6.2% (line 5a uses 12.4%)' }),
          x.field('Medicare rate, each share (%)', I.rates, 'med', 'pct', R.rates, { help: '1.45% (line 5c uses 2.9%)' }),
          x.field('Additional Medicare rate (%)', I.rates, 'addl', 'pct', R.rates, { help: 'Employee only, 0.9%' }),
          x.field('2026 Social Security wage base', I.rates, 'base', 'money', R.rates, { help: '$184,500 (SSA, 90 FR 49047)' }),
          x.field('Additional Medicare threshold', I.rates, 'addlThreshold', 'money', R.rates, { help: '$200,000 of wages in the year' })
        ])
      ]));
      // paydays
      host.appendChild(x.card('Paydays: wages, tips and withholding', 'One row per Q3 payday, from the payroll register’s payday totals. Employee shares are what the payroll system actually withheld (line 7 compares them with the statutory amounts).', [
        x.table([
          { key: 'payroll', label: 'Payroll', get: function (r) { return String(r.payroll); } },
          { key: 'date', label: 'Payday', type: 'date' },
          { key: 'gross', label: 'Gross pay', type: 'money' },
          { key: 'k401', label: '401(k)', type: 'money' },
          { key: 's125', label: 'Section 125', type: 'money' },
          { key: 'tips', label: 'Tips reported', type: 'money' },
          { key: 'fit', label: 'Federal income tax withheld', type: 'money' },
          { key: 'ssW', label: 'Social Security withheld', type: 'money' },
          { key: 'medW', label: 'Medicare withheld', type: 'money' },
          { key: 'addlW', label: 'Additional Medicare withheld', type: 'money' }
        ], I.paydays, R.paydays),
        x.edit ? h('button', { type: 'button', class: 'ffl-btn ffl-add', title: 'Set each payday’s employee shares to 6.2%, 1.45% and 0.9% of its taxable wages', onclick: function () {
          var s = C.statutory(I); I.paydays.forEach(function (p, i) { p.ssW = s[i].ssW; p.medW = s[i].medW; p.addlW = s[i].addlW; }); x.rerender();
        } }, 'Set employee shares to the statutory rates') : null,
        x.note('Federal income tax withheld is the payroll system’s own figure; the recorded run does not recompute withholding either. 401(k) deferrals leave income tax wages only; Section 125 premiums leave all three wage bases.')
      ]));
      // wage-base employees
      host.appendChild(x.card('Employees past the caps', 'Employees whose year passes the Social Security wage base or the $200,000 Additional Medicare threshold. Their Q3 Medicare wages are part of the payday totals above; the panel works out, paycheck by paycheck, what passes each limit.', [
        x.table([
          { key: 'id', label: 'Employee', type: 'text', cls: 'is-narrow' },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'ssYtd', label: 'SS wages to June 30', type: 'money' },
          { key: 'medYtd', label: 'Medicare wages to June 30', type: 'money' }
        ].concat(I.paydays.map(function (p, j) {
          return { key: j, label: 'Q3 wages, ' + (L.validDate(p.date) ? L.shortDate(p.date) : 'payday ' + (j + 1)), type: 'money' };
        })), I.capped.map(function (e) { return wagesView(e); }), R.capped.map(function (e) { return wagesView(e); }), {
          add: function () { return { id: 'E-', name: '', ssYtd: 0, medYtd: 0, wages: I.paydays.map(function () { return 0; }) }; }, addLabel: 'Add an employee'
        }),
        x.note('Year-to-date wages at June 30 come from the Q2 year-to-date file; Q3 wages are each paycheck’s gross pay less Section 125, from the register.')
      ]));
      // credits and line 1
      host.appendChild(x.card('Line 1, credits and deposit schedule', null, [
        x.fields([
          x.field('Line 1 · employees paid for the period including Sept 12', I, 'line1', 'int', R, { help: 'Payroll 20 had 93 paychecks' }),
          x.field('Line 11 · research payroll tax credit (Form 8974)', I, 'credit11', 'money', R, { help: 'None in the recorded run' }),
          x.field('Lookback-period taxes over $50,000', I, 'lookbackOver50k', 'select', R, { options: [{ value: true, label: 'Yes: semiweekly depositor' }, { value: false, label: 'No: monthly depositor' }], help: 'July 1, 2024 to June 30, 2025' })
        ]),
        x.note('Sick and family leave credits are not on the 2026 form (they ended for leave after September 30, 2021), so the only credit line is line 11. Lines 5f, 8 and 9 (section 3121(q) tips, sick pay, tips and life insurance adjustments) were zero in the recorded run and stay at zero here.', true)
      ]));
      // deposits
      host.appendChild(x.card('Federal tax deposits (EFTPS)', 'One deposit per payday, from the deposit log. Acknowledgment numbers show their last four digits only.', [
        x.table([
          { label: 'For payday', get: function (r, i) { var p = I.paydays[i]; return p ? L.shortDate(p.date) + ' (payroll ' + p.payroll + ')' : ''; } },
          { key: 'date', label: 'Deposit date', type: 'date' },
          { key: 'amount', label: 'Amount deposited', type: 'money' },
          { label: 'EFT acknowledgment', get: function (r) { return r.ack || ''; } }
        ], I.deposits, R.deposits)
      ]));
      function wagesView(e) {
        // expose wages[j] as row[j] so the table can bind to them
        var v = e;
        for (var j = 0; j < I.paydays.length; j++) (function (jj) { if (!Object.getOwnPropertyDescriptor(v, jj)) Object.defineProperty(v, jj, { get: function () { return (v.wages || [])[jj] || 0; }, set: function (val) { v.wages = v.wages || []; v.wages[jj] = val; }, enumerable: false, configurable: true }); })(j);
        return v;
      }
    },

    results: function (x, host, c, r) {
      var l = c.lines, q = r.lines;
      host.appendChild(x.card('Cross-checks', null, [x.checks(c.checks)]));
      host.appendChild(x.card('Form 941, Part 1', 'Lines 1 to 15, built the same way as the recorded workpapers (each line rounded to the cent where they round).', [x.figures([
        { label: 'Line 1 · Employees, pay period including September 12', v: l.L1, r: q.L1, fmt: 'int' },
        { label: 'Line 2 · Wages, tips and other compensation', v: l.L2, r: q.L2 },
        { label: 'Line 3 · Federal income tax withheld', v: l.L3, r: q.L3 },
        { label: 'Line 5a col. 1 · Taxable Social Security wages', v: l.L5a1, r: q.L5a1, sub: true },
        { label: 'Line 5a col. 2 · × 0.124', v: l.L5a2, r: q.L5a2 },
        { label: 'Line 5b col. 1 · Taxable Social Security tips', v: l.L5b1, r: q.L5b1, sub: true },
        { label: 'Line 5b col. 2 · × 0.124', v: l.L5b2, r: q.L5b2 },
        { label: 'Line 5c col. 1 · Taxable Medicare wages and tips', v: l.L5c1, r: q.L5c1, sub: true },
        { label: 'Line 5c col. 2 · × 0.029', v: l.L5c2, r: q.L5c2 },
        { label: 'Line 5d col. 1 · Wages subject to Additional Medicare withholding', v: l.L5d1, r: q.L5d1, sub: true },
        { label: 'Line 5d col. 2 · × 0.009', v: l.L5d2, r: q.L5d2 },
        { label: 'Line 5e · Total Social Security and Medicare taxes', v: l.L5e, r: q.L5e, strong: true },
        { label: 'Line 6 · Total taxes before adjustments', v: l.L6, r: q.L6 },
        { label: 'Line 7 · Fractions of cents', v: l.L7, r: q.L7 },
        { label: 'Line 10 · Total taxes after adjustments', v: l.L10, r: q.L10 },
        { label: 'Line 11 · Credits', v: l.L11, r: q.L11 },
        { label: 'Line 12 · Total taxes after adjustments and credits', v: l.L12, r: q.L12, strong: true },
        { label: 'Line 13 · Total deposits for the quarter', v: l.L13, r: q.L13 },
        { label: 'Line 14 · Balance due', v: l.L14, r: q.L14, strong: true },
        { label: 'Line 15 · Overpayment', v: l.L15, r: q.L15, strong: true }
      ])]));
      host.appendChild(x.card('Schedule B · tax liability by payday', 'Each payday’s liability: income tax withheld, the employee shares withheld, and the employer’s 6.2% and 1.45%.', [
        x.data([
          { label: 'Payday', get: function (s) { return s._label || L.shortDate(s.date) + ' (payroll ' + s.payroll + ')'; } },
          { label: 'Income tax', key: 'fit', fmt: 'money' },
          { label: 'Employee shares', key: 'employee', fmt: 'money' },
          { label: 'Employer share', key: 'employer', fmt: 'money' },
          { label: 'Liability', key: 'liability', fmt: 'money' }
        ].concat(x.edit ? [{ label: 'Recorded', get: function (s, i) { return s._rec != null ? FF.fmt(s._rec, 'money') : FF.fmt((r.sched[i] || {}).liability, 'money'); }, num: true }] : []), c.sched.concat(c.months.map(function (m, i) { return { _label: 'Month ' + (i + 1) + ' (' + MONTH(m.month) + ')', liability: m.liability, _rec: (r.months[i] || {}).liability, _strong: false }; }))
          .concat([{ _label: 'Total liability for the quarter', liability: c.schedTotal, _rec: r.schedTotal, _strong: true }]))
      ]));
      host.appendChild(x.card('Deposits · due dates and timeliness', c.semiweekly ? 'Semiweekly schedule. A payday carrying $100,000 or more of tax is due the next business day; weekends and District of Columbia holidays are not business days.' : 'Monthly schedule: due the 15th of the next month (a $100,000 day still makes it due the next business day).', [
        x.data([
          { label: 'Payday', get: function (d) { return L.shortDate(d.payday); } },
          { label: 'Liability', key: 'liability', fmt: 'money' },
          { label: 'Deposited', key: 'amount', fmt: 'money' },
          { label: 'Due', get: function (d) { return d.due ? L.longDate(d.due, true) : ''; } },
          { label: 'Made', get: function (d) { return d.date ? L.shortDate(d.date) : ''; } },
          { label: 'Result', get: function (d) { return x.tag(d.status, d.ok === true ? 'ok' : d.ok === 'warn' ? 'warn' : 'bad'); } },
          { label: 'Penalty (estimate)', key: 'penalty', fmt: 'money' }
        ], c.deposits),
        x.note('Penalty estimate: 2% of a deposit made 1 to 5 days late, 5% for 6 to 15 days, 10% after that or for a shortfall outside the $100 / 2% allowance (Publication 15, section 11). A person confirms any penalty.')
      ]));
      host.appendChild(x.card('Employees past the caps', null, [
        x.data([
          { label: 'Employee', get: function (p) { return p.id + ' ' + p.name; } },
          { label: 'Q3 Medicare wages', key: 'q3', fmt: 'money' },
          { label: 'Past the SS wage base', key: 'past', fmt: 'money' },
          { label: 'Over $200,000 (line 5d)', key: 'addl', fmt: 'money' }
        ], c.people),
        x.note('Wages past the base leave line 5a; Additional Medicare applies from the paycheck that crosses $200,000 to the end of the year, whatever the employee’s filing status.')
      ]));
      host.appendChild(x.card('Read-only in this panel', null, [
        x.note('The recorded run’s ties to the ledger (register vs accounts 2210, 2250, 2260, 5110 and 6110) and the open worker-status item for Tomas Arvelo (LABOR-01) depend on the client’s ledger and documents, which this panel does not edit. They are not recalculated here; see the replay’s review package.', true),
        x.sources([
          { title: 'Instructions for Form 941 (03/2026)', url: 'https://www.irs.gov/instructions/i941' },
          { title: 'Instructions for Schedule B (Form 941) (06/2025)', url: 'https://www.irs.gov/instructions/i941sb' },
          { title: 'Publication 15 (2026), Employer’s Tax Guide: deposits, penalties, Additional Medicare', url: 'https://www.irs.gov/publications/p15' },
          { title: 'SSA: 2026 contribution and benefit base, 90 FR 49047', url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-03/pdf/2025-19763.pdf' },
          { title: '26 CFR 31.3102-4, Additional Medicare Tax withholding', url: 'https://www.law.cornell.edu/cfr/text/26/31.3102-4' }
        ])
      ]));
    },

    keys: function (c, r) {
      var bad = c.checks.filter(function (k) { return k.ok === false; }).length, warn = c.checks.filter(function (k) { return k.ok === 'warn'; }).length;
      return [
        { label: 'Line 12 · total taxes', value: L.money(c.lines.L12), rec: L.money(r.lines.L12) },
        { label: 'Line 13 · deposits', value: L.money(c.lines.L13), rec: L.money(r.lines.L13) },
        { label: c.lines.L15 > 0 ? 'Line 15 · overpayment' : 'Line 14 · balance due', value: L.money(c.lines.L15 > 0 ? c.lines.L15 : c.lines.L14), rec: L.money(r.lines.L14), tone: c.lines.L14 > 0 ? 'bad' : 'ok' },
        { label: 'Schedule B total', value: L.money(c.schedTotal), rec: L.money(r.schedTotal) },
        { label: 'Cross-checks', value: (c.checks.length - bad - warn) + ' of ' + c.checks.length + ' pass', tone: bad ? 'bad' : warn ? 'warn' : 'ok' }
      ];
    },

    csv: function (c, I, r, edit) {
      var l = c.lines, q = r.lines, rows = [['Form 941 line', edit ? 'Your numbers' : 'Recorded run', 'Recorded run']];
      [['Line 1 Employees', 'L1'], ['Line 2 Wages, tips and other compensation', 'L2'], ['Line 3 Federal income tax withheld', 'L3'], ['Line 5a col 1 Taxable Social Security wages', 'L5a1'], ['Line 5a col 2', 'L5a2'], ['Line 5b col 1 Taxable Social Security tips', 'L5b1'], ['Line 5b col 2', 'L5b2'], ['Line 5c col 1 Taxable Medicare wages and tips', 'L5c1'], ['Line 5c col 2', 'L5c2'], ['Line 5d col 1 Additional Medicare wages', 'L5d1'], ['Line 5d col 2', 'L5d2'], ['Line 5e Total Social Security and Medicare', 'L5e'], ['Line 6 Total taxes before adjustments', 'L6'], ['Line 7 Fractions of cents', 'L7'], ['Line 10 Total taxes after adjustments', 'L10'], ['Line 11 Credits', 'L11'], ['Line 12 Total taxes after adjustments and credits', 'L12'], ['Line 13 Total deposits', 'L13'], ['Line 14 Balance due', 'L14'], ['Line 15 Overpayment', 'L15']]
        .forEach(function (p) { rows.push([p[0], p[1] === 'L1' ? l[p[1]] : L.plain(l[p[1]]), p[1] === 'L1' ? q[p[1]] : L.plain(q[p[1]])]); });
      rows.push([]); rows.push(['Schedule B payday', 'Income tax', 'Employee shares', 'Employer share', 'Liability', 'Deposit due', 'Deposited', 'Deposit date', 'Result']);
      c.sched.forEach(function (s, i) { var d = c.deposits[i]; rows.push([s.date, L.plain(s.fit), L.plain(s.employee), L.plain(s.employer), L.plain(s.liability), d.due, L.plain(d.amount), d.date, d.status]); });
      c.months.forEach(function (m, i) { rows.push(['Month ' + (i + 1) + ' ' + m.month, '', '', '', L.plain(m.liability)]); });
      rows.push(['Total liability', '', '', '', L.plain(c.schedTotal)]);
      rows.push([]); rows.push(['Cross-check', 'Result', 'Detail']);
      c.checks.forEach(function (k) { rows.push([k.label, k.ok === true ? 'Pass' : k.ok === 'warn' ? 'Review' : 'Fail', k.detail]); });
      rows.push([]); rows.push(['Inputs: payday', 'Gross pay', '401(k)', 'Section 125', 'Tips', 'Income tax withheld', 'SS withheld', 'Medicare withheld', 'Additional Medicare withheld']);
      I.paydays.forEach(function (p) { rows.push([p.date, L.plain(p.gross), L.plain(p.k401), L.plain(p.s125), L.plain(p.tips), L.plain(p.fit), L.plain(p.ssW), L.plain(p.medW), L.plain(p.addlW)]); });
      rows.push(['Rates', 'SS ' + I.rates.ss, 'Medicare ' + I.rates.med, 'Additional ' + I.rates.addl, 'Wage base ' + I.rates.base, 'Threshold ' + I.rates.addlThreshold]);
      return rows;
    }
  };
})();
