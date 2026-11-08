/* F1 Finance demos · "Try your own numbers" · Form 1040 panel content. */
(function () {
  'use strict';
  var FF = window.FFLive, L = FF.lib, C = FF.calc['tax-1040'];
  var STATUS_OPTS = Object.keys(C.STATUS).map(function (k) { return { value: k, label: C.STATUS[k].label }; });

  FF.ui['tax-1040'] = {
    title: 'Form 1040 · Tax Year 2025',
    sub: 'Celeste and Brennan Whitford (demonstration clients; Celeste is paid by HANGS Construction Services LLC) · SSNs end 4417 and 2093',

    inputs: function (x, host) {
      var h = x.h, I = x.cur, R = x.rec;
      host.appendChild(x.card('Filing status and family', null, [
        x.fields([
          x.field('Filing status', I, 'status', 'select', R, { options: STATUS_OPTS, structural: true, help: 'Changes the brackets, standard deduction and thresholds' }),
          x.field('Children under 17 with an SSN', I, 'children', 'int', R, { help: '$2,200 each (2025)' }),
          x.field('Other dependents', I, 'otherDependents', 'int', R, { help: '$500 each' })
        ])
      ]));
      host.appendChild(x.card('Wages (Forms W-2)', 'Box 1 wages, box 2 income tax withheld, box 5 Medicare wages and box 6 Medicare tax withheld.', [
        x.table([
          { key: 'employee', label: 'Employee', type: 'text' },
          { key: 'employer', label: 'Employer', type: 'text', cls: 'is-wide' },
          { key: 'box1', label: 'Box 1 wages', type: 'money' },
          { key: 'box2', label: 'Box 2 withheld', type: 'money' },
          { key: 'box5', label: 'Box 5 Medicare wages', type: 'money' },
          { key: 'box6', label: 'Box 6 Medicare withheld', type: 'money' }
        ], I.w2, R.w2, { add: function () { return { employee: '', employer: '', box1: 0, box2: 0, box5: 0, box6: 0 }; }, addLabel: 'Add a Form W-2' })
      ]));
      host.appendChild(x.card('Interest, dividends and gains', null, [
        x.fields([
          x.field('Taxable interest (line 2b)', I, 'interest', 'money', R),
          x.field('Ordinary dividends (line 3b)', I, 'ordDiv', 'money', R),
          x.field('Qualified dividends (line 3a)', I, 'qualDiv', 'money', R, { help: 'Part of ordinary dividends' }),
          x.field('Net long-term capital gain (line 7)', I, 'capGain', 'money', R, { help: 'None in the recorded run' }),
          x.field('Adjustments to income (line 10)', I, 'adjustments', 'money', R)
        ])
      ]));
      host.appendChild(x.card('Itemized deductions (Schedule A)', 'The larger of itemized and the standard deduction is used.', [
        x.fields([
          x.field('General sales tax, actual receipts (5a)', I, 'salesTax', 'money', R, { help: 'Washington has no income tax' }),
          x.field('Real estate taxes, main home (5b)', I, 'realEstate', 'money', R),
          x.field('Personal property taxes (5c)', I, 'otherTaxes', 'money', R),
          x.field('Home acquisition debt (average balance)', I, 'acquisitionDebt', 'money', R, { help: 'Interest is limited above $750,000' })
        ]),
        h('h5', { class: 'ffl-sub', text: 'Mortgage interest' }),
        x.table([
          { key: 'lender', label: 'Lender', type: 'text', cls: 'is-wide' },
          { key: 'interest', label: 'Interest paid in 2025', type: 'money' },
          { key: 'form1098', label: 'Form 1098 received', type: 'check' }
        ], I.mortgages, R.mortgages, { add: function () { return { lender: '', interest: 0, form1098: true }; }, addLabel: 'Add a mortgage' }),
        h('h5', { class: 'ffl-sub', text: 'Gifts to charity by cash or check' }),
        x.table([
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'org', label: 'Organization', type: 'text', cls: 'is-wide' },
          { key: 'amount', label: 'Amount', type: 'money' },
          { key: 'ack', label: 'Written acknowledgment', type: 'check' }
        ], I.gifts, R.gifts, { add: function () { return { date: '2025-12-31', org: '', amount: 0, ack: true }; }, addLabel: 'Add a gift' }),
        x.note('A gift of $250 or more counts only with a contemporaneous written acknowledgment (CHAR-01 in the recorded run).')
      ]));
      host.appendChild(x.card('Other deductions', null, [
        x.fields([
          x.field('Qualified business income deduction (13a)', I, 'qbi', 'money', R, { help: 'Entered, not computed here' }),
          x.field('Schedule 1-A deductions (13b)', I, 'sched1A', 'money', R, { help: 'Entered, not computed here' })
        ]),
        x.note('Lines 13a and 13b are entered as amounts: their own worksheets (Form 8995, Schedule 1-A) are not part of this demo. The recorded run had neither. The additional standard deduction for age 65 or blindness is not modeled; neither spouse qualifies in the recorded run.', true)
      ]));
      host.appendChild(x.card('Estimated tax payments', 'Line 26 counts only payments the IRS credits to 2025 (EST-01 in the recorded run).', [
        x.table([
          { key: 'due', label: 'Installment due', type: 'date' },
          { key: 'date', label: 'Paid on', type: 'date' },
          { key: 'amount', label: 'Amount', type: 'money' },
          { key: 'creditedTo', label: 'IRS credits it to', type: 'select', options: [{ value: '2025', label: '2025' }, { value: '2026', label: '2026' }] }
        ], I.estimates, R.estimates, { add: function () { return { due: '2026-01-15', date: '2026-01-15', amount: 0, creditedTo: '2025' }; }, addLabel: 'Add a payment' }),
        x.fields([
          x.field('2024 overpayment applied to 2025', I, 'priorApplied', 'money', R),
          x.field('2024 total tax (for the safe harbor)', I, 'priorTax', 'money', R),
          x.field('2024 AGI', I, 'priorAgi', 'money', R, { help: 'Over $150,000: 110% safe harbor' })
        ])
      ]));
    },

    results: function (x, host, c, r) {
      var l = c.lines, q = r.lines, sa = c.sa, sr = r.sa, s2 = c.s2, t2 = r.s2, S = c.rules;
      host.appendChild(x.card('Cross-checks', null, [x.checks(c.checks)].concat(c.notes.map(function (n) { return x.note(n); }))));
      host.appendChild(x.card('Form 1040', S.label + '. 2025 amounts.', [x.figures([
        { label: 'Line 1a/1z · Wages', v: l.L1z, r: q.L1z },
        { label: 'Line 2b · Taxable interest', v: l.L2b, r: q.L2b },
        { label: 'Line 3a · Qualified dividends', v: l.L3a, r: q.L3a, sub: true },
        { label: 'Line 3b · Ordinary dividends', v: l.L3b, r: q.L3b },
        { label: 'Line 7 · Capital gain', v: l.L7, r: q.L7 },
        { label: 'Line 9 · Total income', v: l.L9, r: q.L9, strong: true },
        { label: 'Line 10 · Adjustments', v: l.L10, r: q.L10 },
        { label: 'Line 11 · Adjusted gross income', v: l.L11, r: q.L11, strong: true },
        { label: 'Line 12e · ' + (l.itemizes ? 'Itemized deductions' : 'Standard deduction'), v: l.L12e, r: q.L12e },
        { label: 'Line 13a/13b · Other deductions', v: r2(l.L13a + l.L13b), r: r2(q.L13a + q.L13b) },
        { label: 'Line 15 · Taxable income', v: l.L15, r: q.L15, strong: true },
        { label: 'Line 16 · Tax' + (c.qd.used ? ' (qualified dividend worksheet)' : ''), v: l.L16, r: q.L16 },
        { label: 'Line 17 · Alternative minimum tax', v: l.L17, r: q.L17 },
        { label: 'Line 19 · Child tax credit / other dependents', v: l.L19, r: q.L19 },
        { label: 'Line 22 · Tax after credits', v: l.L22, r: q.L22 },
        { label: 'Line 23 · Other taxes (Schedule 2)', v: l.L23, r: q.L23 },
        { label: 'Line 24 · Total tax', v: l.L24, r: q.L24, strong: true },
        { label: 'Line 25a · Withholding, Forms W-2', v: l.L25a, r: q.L25a },
        { label: 'Line 25c · Additional Medicare withheld (Form 8959)', v: l.L25c, r: q.L25c },
        { label: 'Line 26 · 2025 estimated payments', v: l.L26, r: q.L26 },
        { label: 'Line 28 · Additional child tax credit', v: l.L28, r: q.L28 },
        { label: 'Line 33 · Total payments', v: l.L33, r: q.L33, strong: true },
        { label: 'Line 34 · Overpaid (refund)', v: l.L34, r: q.L34, strong: true },
        { label: 'Line 37 · Amount you owe', v: l.L37, r: q.L37, strong: true }
      ])]));
      host.appendChild(x.card('Schedule A', null, [x.figures([
        { label: '5a · General sales taxes', v: sa.L5a, r: sr.L5a },
        { label: '5b · Real estate taxes', v: sa.L5b, r: sr.L5b },
        { label: '5d · Add lines 5a to 5c', v: sa.L5d, r: sr.L5d },
        { label: 'SALT limit (line 5e worksheet)', v: sa.limit, r: sr.limit, sub: true },
        { label: '5e · State and local taxes, the smaller', v: sa.L5e, r: sr.L5e },
        { label: '8e · Home mortgage interest' + (sa.mortgageShare < 1 ? ' (prorated)' : ''), v: sa.L8e, r: sr.L8e },
        { label: '11 · Gifts by cash or check', v: sa.L11, r: sr.L11 },
        { label: '17 · Total itemized deductions', v: sa.L17, r: sr.L17, strong: true },
        { label: 'Standard deduction, ' + S.label.toLowerCase(), v: S.std, r: r.rules.std, sub: true }
      ])]));
      var qd = c.qd, qr = r.qd;
      host.appendChild(x.card('Qualified Dividends and Capital Gain Tax Worksheet', 'Tax below $100,000 comes from the Tax Table (tax on the middle of the $50 row); $100,000 and up from the Tax Computation Worksheet.', [x.figures([
        { label: '1 · Taxable income', v: qd.w1, r: qr.w1 },
        { label: '4 · Qualified dividends and capital gain', v: qd.w4, r: qr.w4 },
        { label: '5 · Ordinary income', v: qd.w5, r: qr.w5 },
        { label: '6 · 0% limit', v: qd.w6, r: qr.w6, sub: true },
        { label: '9 · Taxed at 0%', v: qd.w9, r: qr.w9 },
        { label: '13 · 15% limit', v: qd.w13, r: qr.w13, sub: true },
        { label: '17 · Taxed at 15%', v: qd.w17, r: qr.w17 },
        { label: '18 · Tax at 15%', v: qd.w18, r: qr.w18 },
        { label: '20 · Taxed at 20%', v: qd.w20, r: qr.w20 },
        { label: '21 · Tax at 20%', v: qd.w21, r: qr.w21 },
        { label: '22 · Tax on line 5 (regular rates)', v: qd.w22, r: qr.w22 },
        { label: '23 · Add lines 18, 21 and 22', v: qd.w23, r: qr.w23 },
        { label: '24 · Tax on all taxable income (regular rates)', v: qd.w24, r: qr.w24 },
        { label: '25 · Tax, the smaller (line 16)', v: qd.w25, r: qr.w25, strong: true }
      ])]));
      host.appendChild(x.card('Schedule 2 · other taxes', null, [x.figures([
        { label: 'Form 8959 · Medicare wages, all W-2s', v: s2.medWages, r: t2.medWages },
        { label: 'Over the ' + L.money(S.addlMed) + ' threshold', v: s2.addlOver, r: t2.addlOver, sub: true },
        { label: 'Line 11 · Additional Medicare Tax (0.9%)', v: s2.L11, r: t2.L11 },
        { label: 'Additional Medicare withheld by employers', v: s2.addlWithheld, r: t2.addlWithheld, sub: true },
        { label: 'Form 8960 · Net investment income', v: s2.nii, r: t2.nii },
        { label: 'MAGI over the ' + L.money(S.niit) + ' threshold', v: s2.magiOver, r: t2.magiOver, sub: true },
        { label: 'Line 12 · Net investment income tax (3.8%)', v: s2.L12, r: t2.L12 },
        { label: 'Line 21 · Total other taxes', v: s2.L21, r: t2.L21, strong: true },
        { label: 'Form 6251 · AMT income (taxable income + SALT)', v: c.amt.amti, r: r.amt.amti },
        { label: 'Exemption after phase-out', v: c.amt.exemption, r: r.amt.exemption, sub: true },
        { label: 'Tentative minimum tax', v: c.amt.tmt, r: r.amt.tmt },
        { label: 'Alternative minimum tax', v: c.amt.L17, r: r.amt.L17, strong: true }
      ]), x.note('The AMT is a screen, like the recorded run’s: AMT income is taxable income plus the state and local tax deduction, with no other preference items.')]));
      var e = c.est;
      host.appendChild(x.card('Estimated tax (Form 2210 screen)', 'Required annual payment: the smaller of ' + Math.round(S.estCur * 100) + '% of the 2025 tax (' + L.money(e.cur) + ') and ' + Math.round(e.priorRate * 100) + '% of the 2024 tax (' + L.money(e.prior) + ').', [
        x.data([
          { label: 'Installment due', get: function (z) { return L.shortDate(z.due) + ', ' + z.due.slice(0, 4); } },
          { label: 'Required, cumulative', key: 'required', fmt: 'money' },
          { label: 'Withholding, cumulative', key: 'withholding', fmt: 'money' },
          { label: 'Estimates paid by then', key: 'estimates', fmt: 'money' },
          { label: 'Shortfall', key: 'shortfall', fmt: 'money' }
        ], e.rows),
        x.note('Withholding is treated as paid evenly through the year, as on the recorded run’s Estimated Tax tab.')
      ]));
      host.appendChild(x.card('Rule values and sources', 'Married filing jointly uses the values in the recorded run’s own workpapers; the other statuses use the published 2025 amounts.', [
        x.data([
          { label: 'Rule', key: 'k' }, { label: S.label, key: 'v' }
        ], [
          { k: 'Standard deduction', v: L.money(S.std) },
          { k: 'Brackets end at (10% to 35%)', v: S.brackets.map(function (b) { return L.money(b, { dollar: true }).replace('.00', ''); }).join(' · ') },
          { k: 'Qualified dividends 0% / 15% limits', v: L.money(S.qd0) + ' / ' + L.money(S.qd15) },
          { k: 'SALT limit, phase-down start, floor', v: L.money(S.salt) + ', ' + L.money(S.saltPhase) + ', ' + L.money(S.saltFloor) },
          { k: 'Child tax credit, phase-out start', v: L.money(S.ctc) + ' a child, ' + L.money(S.ctcPhase) },
          { k: 'Additional Medicare / NIIT thresholds', v: L.money(S.addlMed) + ' / ' + L.money(S.niit) },
          { k: 'AMT exemption, phase-out start, 26% band', v: L.money(S.amtEx) + ', ' + L.money(S.amtPhase) + ', ' + L.money(S.amt26) },
          { k: 'Mortgage acquisition-debt limit', v: L.money(S.mort) }
        ]),
        x.sources(Object.keys(C.SOURCES).map(function (k) { return C.SOURCES[k]; }).concat([{ title: 'Rev. Proc. 2024-40 (2025 inflation adjustments) as amended by P.L. 119-21 for the standard deduction, SALT limit and child tax credit', url: 'https://www.irs.gov/pub/irs-drop/rp-24-40.pdf' }]))
      ]));
    },

    keys: function (c, r) {
      var l = c.lines, q = r.lines, bad = c.checks.filter(function (k) { return k.ok === false; }).length, warn = c.checks.filter(function (k) { return k.ok === 'warn'; }).length;
      return [
        { label: 'Line 11 · AGI', value: L.money(l.L11), rec: L.money(q.L11) },
        { label: 'Line 15 · taxable income', value: L.money(l.L15), rec: L.money(q.L15) },
        { label: 'Line 24 · total tax', value: L.money(l.L24), rec: L.money(q.L24) },
        { label: l.L37 > 0 ? 'Line 37 · amount you owe' : 'Line 34 · refund', value: L.money(l.L37 > 0 ? l.L37 : l.L34), rec: L.money(q.L34), tone: l.L37 > 0 ? 'bad' : 'ok' },
        { label: 'Checks', value: (c.checks.length - bad - warn) + ' clear, ' + warn + ' to review', tone: bad ? 'bad' : warn ? 'warn' : 'ok' }
      ];
    },

    csv: function (c, I, r, edit) {
      var l = c.lines, q = r.lines, rows = [['Form 1040 line', edit ? 'Your numbers' : 'Recorded run', 'Recorded run']];
      [['1z Wages', 'L1z'], ['2b Taxable interest', 'L2b'], ['3a Qualified dividends', 'L3a'], ['3b Ordinary dividends', 'L3b'], ['7 Capital gain', 'L7'], ['9 Total income', 'L9'], ['10 Adjustments', 'L10'], ['11 Adjusted gross income', 'L11'], ['12e Deduction', 'L12e'], ['13a QBI deduction', 'L13a'], ['13b Schedule 1-A', 'L13b'], ['15 Taxable income', 'L15'], ['16 Tax', 'L16'], ['17 AMT', 'L17'], ['19 Child tax credit', 'L19'], ['22 Tax after credits', 'L22'], ['23 Other taxes', 'L23'], ['24 Total tax', 'L24'], ['25a W-2 withholding', 'L25a'], ['25c Additional Medicare withheld', 'L25c'], ['26 Estimated payments', 'L26'], ['28 Additional child tax credit', 'L28'], ['33 Total payments', 'L33'], ['34 Overpaid', 'L34'], ['37 Amount you owe', 'L37']]
        .forEach(function (p) { rows.push(['Line ' + p[0], L.plain(l[p[1]]), L.plain(q[p[1]])]); });
      rows.push([]); rows.push(['Schedule A', '', '']);
      [['5d State and local taxes', 'L5d'], ['5e After the limit', 'L5e'], ['8e Mortgage interest', 'L8e'], ['11 Gifts', 'L11'], ['17 Total itemized', 'L17']].forEach(function (p) { rows.push(['Line ' + p[0], L.plain(c.sa[p[1]]), L.plain(r.sa[p[1]])]); });
      rows.push(['Schedule 2 line 11 Additional Medicare Tax', L.plain(c.s2.L11), L.plain(r.s2.L11)]);
      rows.push(['Schedule 2 line 12 Net investment income tax', L.plain(c.s2.L12), L.plain(r.s2.L12)]);
      rows.push([]); rows.push(['Check', 'Result', 'Detail']);
      c.checks.forEach(function (k) { rows.push([k.label, k.ok === true ? 'Pass' : k.ok === 'warn' ? 'Review' : 'Fail', k.detail]); });
      rows.push([]); rows.push(['Filing status', c.rules.label]);
      return rows;
    }
  };
  function r2(v) { return L.round2(v); }
})();
