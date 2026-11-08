/* F1 Finance in-browser analysis: core engine.
   Reads spreadsheets (SheetJS) and text PDFs (pdf.js) from memory, detects columns, shows a mapping step when unsure,
   runs an analyzer module and renders the results. All money is integer cents. Nothing leaves the device. */
(function () {
  'use strict';
  var A = window.F1Analyze;
  var C = {};
  var DAY = 864e5;

  // ---------------- small utils ----------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function dn(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / DAY); }
  function parts(n) { var d = new Date(n * DAY); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() }; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function iso(n) { if (n == null) return ''; var p = parts(n); return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
  function fdate(n) { if (n == null) return ''; var p = parts(n); return pad(p.m) + '/' + pad(p.d) + '/' + p.y; }
  function ldate(n) { if (n == null) return ''; var p = parts(n); return MON[p.m - 1].slice(0, 3) + ' ' + p.d + ', ' + p.y; }
  function monthName(y, m) { return MON[m - 1] + ' ' + y; }
  function endOfMonth(y, m) { return dn(y, m + 1, 1) - 1; }
  function daysInMonth(y, m) { return parts(dn(y, m + 1, 1) - 1).d; }
  function money(c, o) {
    if (c == null || isNaN(c)) return '';
    var neg = c < 0, a = Math.abs(Math.round(c)), d = Math.floor(a / 100), ce = a % 100;
    var s = String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + pad(ce);
    if (!(o && o.noSign)) s = '$' + s;
    return neg ? '\u2212' + s : s;
  }
  // round(c * num / den), half away from zero, integers only
  function pct(c, num, den) { var s = c < 0 ? -1 : 1; return s * Math.floor((Math.abs(c) * num * 2 + den) / (2 * den)); }
  function sum(a, f) { var t = 0; for (var i = 0; i < a.length; i++) t += f ? (f(a[i]) || 0) : (a[i] || 0); return t; }
  function plural(n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); }

  // US federal holidays (date the holiday falls on, plus the observed weekday when it falls on a weekend)
  var holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    var h = {};
    function nth(m, wd, k) { var first = dn(y, m, 1), w = parts(first).w; return first + ((wd - w + 7) % 7) + (k - 1) * 7; }
    function last(m, wd) { var e = endOfMonth(y, m), w = parts(e).w; return e - ((w - wd + 7) % 7); }
    function fixed(m, d, name) { var n = dn(y, m, d), w = parts(n).w; h[n] = name; if (w === 6) h[n - 1] = name + ' (observed)'; if (w === 0) h[n + 1] = name + ' (observed)'; }
    fixed(1, 1, "New Year's Day"); h[nth(1, 1, 3)] = 'Martin Luther King Jr. Day'; h[nth(2, 1, 3)] = "Washington's Birthday";
    h[last(5, 1)] = 'Memorial Day'; fixed(6, 19, 'Juneteenth'); fixed(7, 4, 'Independence Day'); h[nth(9, 1, 1)] = 'Labor Day';
    h[nth(10, 1, 2)] = 'Columbus Day'; fixed(11, 11, 'Veterans Day'); h[nth(11, 4, 4)] = 'Thanksgiving Day'; fixed(12, 25, 'Christmas Day');
    return (holCache[y] = h);
  }

  // ---------------- value parsing ----------------
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function mk(y, m, d) {
    if (y < 100) y += y < 70 ? 2000 : 1900;
    if (m < 1 || m > 12 || d < 1 || y < 1950 || y > 2100) return null;
    if (d > daysInMonth(y, m)) return null;
    return dn(y, m, d);
  }
  function fromSerial(v) { return Math.floor(v) - 25569; }
  // returns a day number, or null. ctx: {year, serial}
  function parseDate(v, ctx) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : dn(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') return ctx && ctx.serial && v > 20000 && v < 80000 ? fromSerial(v) : null;
    var s = String(v).trim().replace(/\s+/g, ' '), m;
    if (!s) return null;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T ].*)?$/))) return mk(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})(?:\s.*)?$/))) {
      var a = +m[1], b = +m[2];
      if (a > 12 && b <= 12) return mk(+m[3], b, a);
      return mk(+m[3], a, b);
    }
    if ((m = s.match(/^(\d{1,2})[-\/](\d{1,2})$/)) && ctx && ctx.year) return mk(ctx.year, +m[1], +m[2]);
    if ((m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})\.?[\s\-,]+(\d{2}|\d{4})$/)) && MONTHS[m[2].toLowerCase().slice(0, 3)]) return mk(+m[3], MONTHS[m[2].toLowerCase().slice(0, 3)], +m[1]);
    if ((m = s.match(/^(?:[A-Za-z]{3,9},?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/)) && MONTHS[m[1].toLowerCase().slice(0, 3)]) return mk(+m[3], MONTHS[m[1].toLowerCase().slice(0, 3)], +m[2]);
    if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})$/)) && MONTHS[m[1].toLowerCase().slice(0, 3)] && ctx && ctx.year) return mk(ctx.year, MONTHS[m[1].toLowerCase().slice(0, 3)], +m[2]);
    if ((m = s.match(/^(\d{8})$/))) { var y8 = +s.slice(0, 4); if (y8 > 1950 && y8 < 2100) return mk(y8, +s.slice(4, 6), +s.slice(6, 8)); }
    if (ctx && ctx.serial && /^\d{5}(\.\d+)?$/.test(s)) { var n = +s; if (n > 20000 && n < 80000) return fromSerial(n); }
    return null;
  }
  // money -> integer cents, or null
  function parseMoney(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? Math.round(Number((v * 100).toFixed(4))) : null;
    if (typeof v === 'boolean') return null;
    var s = String(v).trim();
    if (!s) return null;
    var neg = false;
    s = s.replace(/\s+/g, '').replace(/^(USD|US\$)/i, '').replace(/(USD)$/i, '');
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/(CR|DR)$/i, '');
    if (/[-\u2212]$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
    if (/^[-\u2212]/.test(s)) { neg = !neg; s = s.slice(1); }
    s = s.replace(/^\$/, '');
    if (/^[-\u2212]/.test(s)) { neg = !neg; s = s.slice(1); }
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d*)?$|^\.\d+$/.test(s)) return null;
    s = s.replace(/,/g, '');
    var p = s.split('.'), whole = p[0] ? parseInt(p[0], 10) : 0, frac = (p[1] || '') + '000';
    var c = whole * 100 + parseInt(frac.slice(0, 2), 10) + (parseInt(frac.charAt(2), 10) >= 5 ? 1 : 0);
    return neg ? -c : c;
  }
  function parseInt2(v) { if (v == null || v === '') return null; var s = String(v).trim().replace(/\.0+$/, ''); return /^\d{1,9}$/.test(s) ? parseInt(s, 10) : null; }
  function txt(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }

  // ---------------- header normalization and matching ----------------
  var ABBR = { ss: 'social security', soc: 'social', sec: 'security', oasdi: 'social security', fed: 'federal', fit: 'federal income tax', fwt: 'federal income tax', fitw: 'federal income tax',
    wh: 'withheld', withholding: 'withheld', w: 'withheld', withhold: 'withheld', med: 'medicare', mcare: 'medicare', amt: 'amount', no: 'number', num: 'number', nbr: 'number', inv: 'invoice',
    acct: 'account', desc: 'description', descr: 'description', chk: 'check', ck: 'check', cheque: 'check', emp: 'employee', ee: 'employee', er: 'employer', dt: 'date', txn: 'transaction',
    trans: 'transaction', tran: 'transaction', ref: 'reference', bal: 'balance', addl: 'additional', yr: 'year', gl: 'ledger', dr: 'debit', cr: 'credit', vend: 'vendor', qtr: 'quarter',
    hrs: 'hours', pd: 'paid', fica: '', taxes: 'tax', wages: 'wages', wage: 'wages', amounts: 'amount', payments: 'payment', deposits: 'deposit', withdrawals: 'withdrawal', debits: 'debit', credits: 'credit', checks: 'check' };
  function norm(h) {
    var s = String(h == null ? '' : h).toLowerCase().replace(/w\/h/g, ' withheld ').replace(/#/g, ' number ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
    if (!s) return '';
    return s.split(' ').map(function (t) { return ABBR.hasOwnProperty(t) ? ABBR[t] : t; }).join(' ').replace(/\s+/g, ' ').trim();
  }
  function prepFields(fields) {
    fields.forEach(function (f) {
      if (f._syn) return;
      f._syn = (f.syn || []).map(function (s) { var n = norm(s); return { s: n, t: n.split(' ') }; });
      f._not = (f.not || []).concat(f.allowYtd ? [] : ['ytd', 'year to date']).map(norm);
    });
  }
  function synScore(h, f) {
    if (!h) return 0;
    var ht = h.split(' '), best = 0;
    for (var k = 0; k < f._not.length; k++) { var nt = f._not[k].split(' '); if (nt.every(function (t) { return ht.indexOf(t) >= 0; })) return 0; }
    for (var i = 0; i < f._syn.length; i++) {
      var sy = f._syn[i];
      if (h === sy.s) return 1;
      if (sy.t.every(function (t) { return ht.indexOf(t) >= 0; })) best = Math.max(best, 0.55 + 0.4 * sy.t.length / ht.length);
    }
    return best;
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }

  function typeOk(f, v, ctx) {
    if (v == null || v === '') return null;
    if (f.type === 'date') return parseDate(v, { serial: true, year: ctx && ctx.year }) != null;
    if (f.type === 'money') return parseMoney(v) != null;
    if (f.type === 'int') return parseInt2(v) != null || /\d{3,}/.test(String(v));
    return typeof v === 'string' ? !/^[-$\d.,()\s]+$/.test(v) : false;
  }
  function colStats(rows, start, c, f, ctx) {
    var ok = 0, n = 0, vals = {};
    for (var r = start; r < rows.length && n < 400; r++) {
      var v = rows[r] ? rows[r][c] : null; var t = typeOk(f, v, ctx);
      if (t == null) continue; n++; if (t) ok++; vals[String(v)] = 1;
    }
    return { ratio: n ? ok / n : 0, n: n, distinct: Object.keys(vals).length };
  }

  // Find header row and columns for a set of fields.
  function detectTable(rows, fields, ctx, forceHr) {
    prepFields(fields);
    var forced = forceHr != null;
    var best = { score: 0, r: forced ? forceHr : -1, cols: {}, hs: {} };
    var r0 = forced ? Math.max(forceHr, 0) : 0, maxR = forced ? (forceHr >= 0 ? forceHr + 1 : 0) : Math.min(rows.length, 40);
    for (var r = r0; r < maxR; r++) {
      var row = rows[r] || [], texts = 0;
      for (var c0 = 0; c0 < row.length; c0++) if (typeof row[c0] === 'string' && row[c0].trim() && parseMoney(row[c0]) == null) texts++;
      if (texts < 2 && !forced) continue;
      var pairs = [];
      fields.forEach(function (f, fi) { for (var c = 0; c < row.length; c++) { if (typeof row[c] !== 'string') continue; var s = synScore(norm(row[c]), f); if (s > 0) pairs.push({ fi: fi, c: c, s: s + (f.req ? 0.001 : 0) }); } });
      pairs.sort(function (a, b) { return b.s - a.s; });
      var cols = {}, hs = {}, usedC = {}, score = 0;
      pairs.forEach(function (p) { var k = fields[p.fi].key; if (cols[k] != null || usedC[p.c]) return; cols[k] = p.c; hs[k] = Math.min(1, p.s); usedC[p.c] = 1; score += p.s; });
      if (score > best.score + 0.01 || forced) best = { score: score, r: r, cols: cols, hs: hs };
    }
    if (best.score < 1.2 && !forced) best = { score: 0, r: -1, cols: {}, hs: {} };
    var start = best.r + 1, out = { headerRow: best.r, cols: best.cols, conf: {}, how: {}, uncertain: false, notes: [] };
    // validate header-picked columns against the data
    fields.forEach(function (f) {
      var c = out.cols[f.key]; if (c == null) return;
      if (f.type === 'text') { out.conf[f.key] = best.hs[f.key]; out.how[f.key] = 'header'; return; }
      var st = colStats(rows, start, c, f, ctx);
      if (st.n && st.ratio < 0.55) { delete out.cols[f.key]; out.notes.push(f.label + ': the column titled like it does not hold ' + f.type + ' values'); return; }
      out.conf[f.key] = best.hs[f.key] * (st.n ? 0.5 + 0.5 * st.ratio : 0.8); out.how[f.key] = 'header';
    });
    // fill missing required fields from the data shape
    var used = {}; Object.keys(out.cols).forEach(function (k) { used[out.cols[k]] = 1; });
    var width = 0; for (var r2 = Math.max(0, start); r2 < Math.min(rows.length, start + 60); r2++) width = Math.max(width, (rows[r2] || []).length);
    fields.forEach(function (f) {
      if (out.cols[f.key] != null || !f.req || !f.guess) return;
      var bc = -1, bs = 0;
      for (var c = 0; c < width; c++) {
        if (used[c]) continue;
        var st = colStats(rows, start, c, f, ctx);
        var s = st.ratio * (st.n > 2 ? 1 : 0.3) * (f.type === 'text' ? Math.min(1, st.distinct / 4) : 1);
        if (s > bs) { bs = s; bc = c; }
      }
      if (bc >= 0 && bs >= 0.7) { out.cols[f.key] = bc; used[bc] = 1; out.conf[f.key] = 0.5; out.how[f.key] = 'data'; }
    });
    out.headers = [];
    for (var c3 = 0; c3 < Math.max(width, best.r >= 0 ? (rows[best.r] || []).length : 0); c3++) {
      var hv = best.r >= 0 ? txt((rows[best.r] || [])[c3]) : '';
      var ex = ''; for (var r3 = start; r3 < Math.min(rows.length, start + 8); r3++) { var vv = (rows[r3] || [])[c3]; if (vv != null && vv !== '') { ex = txt(vv); break; } }
      out.headers.push({ c: c3, label: colName(c3) + (hv ? ' \u00b7 ' + hv : ''), example: ex.slice(0, 24) });
    }
    return out;
  }
  function reqProblems(fields, cols, groups) {
    var probs = [];
    fields.forEach(function (f) { if (f.req === true && cols[f.key] == null) probs.push(f.label); });
    (groups || []).forEach(function (g) { if (!g.keys.some(function (k) { return cols[k] != null; })) probs.push(g.label); });
    return probs;
  }

  // Extract typed records from rows using a mapping
  function extract(rows, map, fields, ctx) {
    var start = map.headerRow + 1, out = [], skipped = 0;
    for (var r = start; r < rows.length; r++) {
      var row = rows[r]; if (!row) continue;
      var rec = { _row: r + 1, _raw: row }, any = false;
      fields.forEach(function (f) {
        var c = map.cols[f.key]; if (c == null) return;
        var v = row[c], pv;
        if (f.type === 'date') pv = parseDate(v, { serial: true, year: ctx && ctx.year });
        else if (f.type === 'money') pv = parseMoney(v);
        else if (f.type === 'int') { pv = parseInt2(v); if (pv == null) { var mm = String(v == null ? '' : v).match(/\b(\d{3,7})\b/); pv = mm ? parseInt(mm[1], 10) : null; } rec[f.key + 'Text'] = txt(v); }
        else pv = txt(v);
        if (pv != null && pv !== '') any = true;
        rec[f.key] = pv === '' ? null : pv;
      });
      if (!any) continue;
      // repeated header rows inside the data
      if (map.headerRow >= 0 && rows[map.headerRow] && row.length && fields.some(function (f) { var c = map.cols[f.key]; return c != null && f.type !== 'text' && txt(row[c]) && txt(row[c]) === txt(rows[map.headerRow][c]); })) { skipped++; continue; }
      out.push(rec);
    }
    return { records: out, skipped: skipped };
  }

  // ---------------- file reading ----------------
  function isPdf(f, u8) { return /\.pdf$/i.test(f.name) || (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46); }
  function isZipOrOle(u8) { return (u8[0] === 0x50 && u8[1] === 0x4b) || (u8[0] === 0xd0 && u8[1] === 0xcf); }
  function friendly(msg, detail) { var e = new Error(msg); e.friendly = true; e.detail = detail; return e; }

  function readSheetFile(f) {
    var X = window.XLSX, u8 = new Uint8Array(f.buf), wb;
    try {
      if (!isZipOrOle(u8) && (/\.(csv|txt)$/i.test(f.name) || u8.length && u8[0] !== 0x3c)) {
        var text = new TextDecoder('utf-8').decode(u8).replace(/^\ufeff/, '');
        if (/\ufffd/.test(text)) text = new TextDecoder('windows-1252').decode(u8);
        wb = X.read(text, { type: 'string', raw: true });
      } else {
        wb = X.read(u8, { type: 'array', cellDates: false, cellNF: true, cellText: false });
      }
    } catch (e) {
      if (/password|encrypt/i.test(String(e && e.message))) throw friendly(f.name + ' is password protected. Please save an unprotected copy and try again.');
      throw friendly(f.name + ' could not be opened as a spreadsheet. Please export it again as .xlsx or .csv.');
    }
    var sheets = wb.SheetNames.map(function (name) {
      var ws = wb.Sheets[name]; if (!ws || !ws['!ref']) return { name: name, rows: [] };
      var rg = X.utils.decode_range(ws['!ref']), rows = [];
      var maxR = Math.min(rg.e.r, rg.s.r + 50000), maxC = Math.min(rg.e.c, rg.s.c + 80);
      for (var r = rg.s.r; r <= maxR; r++) {
        var row = [], any = false;
        for (var c = rg.s.c; c <= maxC; c++) {
          var cell = ws[X.utils.encode_cell({ r: r, c: c })], v = null;
          if (cell) {
            if (cell.t === 'n') {
              if (cell.z && X.SSF.is_date(cell.z) && cell.v > 0 && cell.v < 2958465) { var p = X.SSF.parse_date_code(cell.v); v = p.y + '-' + pad(p.m) + '-' + pad(p.d); }
              else v = cell.v;
            } else if (cell.t === 'd') { v = cell.v instanceof Date ? cell.v.getFullYear() + '-' + pad(cell.v.getMonth() + 1) + '-' + pad(cell.v.getDate()) : String(cell.v); }
            else if (cell.t === 's' || cell.t === 'str') v = cell.v;
            else if (cell.t === 'b') v = cell.v ? 'TRUE' : 'FALSE';
            if (typeof v === 'string') { v = v.trim(); if (!v) v = null; }
          }
          row[c - rg.s.c] = v; if (v != null) any = true;
        }
        rows.push(any ? row : []);
      }
      return { name: name, rows: rows };
    });
    return { name: f.name, kind: 'sheet', sheets: sheets.filter(function (s) { return s.rows.length; }) };
  }

  function readPdfFile(f) {
    var lib = window.pdfjsLib;
    if (!lib) return Promise.reject(friendly('The PDF reader did not load. Check your connection and try again.'));
    return lib.getDocument({ data: new Uint8Array(f.buf.slice(0)), isEvalSupported: false, disableFontFace: true }).promise.then(function (doc) {
      var pages = [], chain = Promise.resolve();
      for (var i = 1; i <= Math.min(doc.numPages, 60); i++) (function (i) {
        chain = chain.then(function () { return doc.getPage(i).then(function (pg) { return pg.getTextContent().then(function (tc) { pages.push({ n: i, items: tc.items }); }); }); });
      })(i);
      return chain.then(function () { return { pages: pages, num: doc.numPages }; });
    }, function (e) {
      if (e && /password/i.test(e.name + ' ' + e.message)) throw friendly(f.name + ' is password protected. Please download the statement again without a password, or upload the Excel or CSV export.');
      throw friendly(f.name + ' could not be read as a PDF. Please upload the Excel or CSV export instead.');
    }).then(function (res) {
      var lines = [], chars = 0;
      res.pages.forEach(function (p) {
        var items = p.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
          chars += it.str.trim().length;
          return { x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || 8, s: it.str };
        });
        items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
        var cur = null;
        items.forEach(function (it) {
          if (cur && Math.abs(cur.y - it.y) <= Math.max(2, it.h * 0.35)) cur.items.push(it);
          else { cur = { page: p.n, y: it.y, items: [it] }; lines.push(cur); }
        });
      });
      lines.forEach(function (ln) {
        ln.items.sort(function (a, b) { return a.x - b.x; });
        var merged = [];
        ln.items.forEach(function (it) {
          var last = merged[merged.length - 1];
          if (last && it.x - (last.x + last.w) < Math.max(1.2, it.h * 0.25)) { last.s += it.s; last.w = it.x + it.w - last.x; }
          else merged.push({ x: it.x, w: it.w, h: it.h, s: it.s });
        });
        merged.forEach(function (m) { m.s = m.s.replace(/\s+/g, ' ').trim(); });
        ln.cells = merged.filter(function (m) { return m.s; });
        ln.text = ln.cells.map(function (m) { return m.s; }).join(' ');
      });
      if (chars < 40) throw friendly('This PDF is an image (a scan or photo), so there is no text to read. Please upload the Excel or CSV export of the statement instead.');
      return { name: f.name, kind: 'pdf', lines: lines, pages: res.num };
    });
  }
  function readAll(files) {
    return Promise.all(files.map(function (f) {
      var u8 = new Uint8Array(f.buf.slice(0, 8));
      if (!f.buf.byteLength) return Promise.reject(friendly(f.name + ' is empty.'));
      if (isPdf(f, u8)) return readPdfFile(f);
      return Promise.resolve().then(function () { return readSheetFile(f); });
    }));
  }

  // ---------------- PDF bank statement parsing ----------------
  var MONEY_RE = /^\(?[-\u2212]?\$?\s?(\d{1,3}(,\d{3})+|\d+)\.\d{2}\)?(-|\s?CR|\s?DR)?$/i;
  var DATE_START = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?)\b/i;
  function pdfStatement(pdf) {
    var lines = pdf.lines, all = lines.map(function (l) { return l.text; }).join('\n'), out = { txns: [], warnings: [] };
    var ym = all.match(/\b(20\d\d)\b/); var year = ym ? +ym[1] : null;
    var DT = '((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})';
    var pm = all.match(new RegExp(DT + '\\s*(?:-|\u2013|\u2014|to|through|thru)\\s*' + DT, 'i'));
    if (pm) { out.periodStart = parseDate(pm[1]); out.periodEnd = parseDate(pm[2]); if (out.periodEnd) year = parts(out.periodEnd).y; }
    function findBal(re) { for (var i = 0; i < lines.length; i++) { if (re.test(lines[i].text)) { var cs = lines[i].cells; for (var k = cs.length - 1; k >= 0; k--) { if (MONEY_RE.test(cs[k].s)) return parseMoney(cs[k].s); } var mm = lines[i].text.match(/\(?-?\$?\d[\d,]*\.\d{2}\)?/g); if (mm) return parseMoney(mm[mm.length - 1]); } } return null; }
    out.begin = findBal(/\b(beginning|opening|previous|starting)\s+(statement\s+)?balance\b/i);
    out.end = findBal(/\b(ending|closing|new)\s+(statement\s+)?balance\b/i);
    var hdr = null, section = 0;
    var cols = {};
    var ctx = { year: year };
    var last = null;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], t = ln.text;
      if (/\bdate\b/i.test(t) && /(balance|withdraw|deposit|debit|credit|amount)/i.test(t) && !DATE_START.test(t)) {
        hdr = ln; cols = {};
        ln.cells.forEach(function (c) {
          var s = c.s.toLowerCase(), right = c.x + c.w;
          if (/withdraw|debit|checks? paid|payments?|charges/.test(s)) cols.out = right;
          else if (/deposit|credit|additions/.test(s)) cols['in'] = right;
          else if (/balance/.test(s)) cols.bal = right;
          else if (/amount/.test(s)) cols.amt = right;
          else if (/check|ref|number|no\.?$/.test(s)) cols.chk = c.x;
        });
        last = null; continue;
      }
      if (/^(deposits|credits|other credits|additions|deposits and (other )?credits)\b/i.test(t) && !DATE_START.test(t)) { section = 1; last = null; continue; }
      if (/^(checks|withdrawals|debits|other debits|electronic (withdrawals|debits)|fees|service charges|checks paid|withdrawals and (other )?debits)\b/i.test(t) && !DATE_START.test(t)) { section = -1; last = null; continue; }
      var dm = t.match(DATE_START);
      if (!dm) {
        if (last && !ln.cells.some(function (c) { return MONEY_RE.test(c.s); }) && t.length < 80 && !/page \d|continued|balance/i.test(t)) last.desc += ' ' + t;
        else last = null;
        continue;
      }
      var date = parseDate(dm[1].replace(/,/g, ''), ctx); if (date == null) { last = null; continue; }
      var cells = ln.cells.slice(), moneyCells = [], descParts = [], chk = null;
      var rest = t.slice(dm[0].length).trim();
      cells.forEach(function (c, k) {
        if (k === 0 && DATE_START.test(c.s)) { var leftover = c.s.slice(c.s.match(DATE_START)[0].length).trim(); if (leftover) descParts.push(leftover); return; }
        if (MONEY_RE.test(c.s)) moneyCells.push(c);
        else if (/^\d{3,7}$/.test(c.s) && (cols.chk != null ? Math.abs(c.x - cols.chk) < 40 : true) && !chk) chk = +c.s;
        else descParts.push(c.s);
      });
      if (!moneyCells.length) { last = null; continue; }
      var desc = descParts.join(' ').trim() || rest;
      if (/^(beginning|opening|ending|closing) balance/i.test(desc)) { last = null; continue; }
      var amt = null, bal = null;
      if (cols.out != null || cols['in'] != null || cols.bal != null || cols.amt != null) {
        moneyCells.forEach(function (c) {
          var right = c.x + c.w, best = null, bd = 1e9;
          ['out', 'in', 'bal', 'amt'].forEach(function (k) { if (cols[k] == null) return; var d = Math.abs(cols[k] - right); if (d < bd) { bd = d; best = k; } });
          var v = parseMoney(c.s);
          if (best === 'out') amt = -Math.abs(v); else if (best === 'in') amt = Math.abs(v); else if (best === 'bal') bal = v; else if (best === 'amt') amt = v;
        });
      } else {
        amt = parseMoney(moneyCells[0].s);
        if (moneyCells.length > 1) bal = parseMoney(moneyCells[moneyCells.length - 1].s);
      }
      if (amt == null) { last = null; continue; }
      var cm = desc.match(/\b(?:check|chk|ck)\s*(?:no\.?|number|#)?\s*(\d{3,7})\b/i); if (!chk && cm) chk = +cm[1];
      var tx = { date: date, desc: desc, amt: amt, bal: bal, check: chk, signFrom: 'column', _row: 'p' + ln.page };
      if (cols.out == null && cols['in'] == null) {
        if (section) { tx.amt = section * Math.abs(amt); tx.signFrom = 'section'; }
        else if (amt > 0 && /\b(check|chk|withdraw|debit|fee|charge|payment|pmt|ach debit|purchase|nsf|returned|transfer to)\b/i.test(desc) && !/\b(deposit|credit|interest|transfer from)\b/i.test(desc)) { tx.amt = -amt; tx.signFrom = 'words'; }
      }
      out.txns.push(tx); last = tx;
    }
    // use the running balance to confirm or fix signs
    var prev = out.begin;
    out.txns.forEach(function (tx) {
      if (tx.bal != null && prev != null) {
        var d = tx.bal - prev;
        if (d === -tx.amt && tx.amt !== 0) { tx.amt = d; tx.signFrom = 'balance'; }
      }
      if (tx.bal != null) prev = tx.bal;
    });
    if (out.end == null) { var lb = out.txns.filter(function (t) { return t.bal != null; }).pop(); if (lb) out.end = lb.bal; }
    out.year = year;
    if (!out.txns.length) out.warnings.push('No transaction lines with a date and an amount were found in the PDF.');
    return out;
  }

  // ---------------- role assignment ----------------
  function bestTable(file, role, ctx) {
    var best = null;
    file.sheets.forEach(function (sh, si) {
      var d = detectTable(sh.rows, role.fields, ctx);
      var s = 0; role.fields.forEach(function (f) { if (d.cols[f.key] != null) s += (d.conf[f.key] || 0.4) * (f.req ? 2 : 1); });
      var nameHint = role.hint && role.hint.test(file.name + ' ' + sh.name) ? 1.5 : 0;
      var probs = reqProblems(role.fields, d.cols, role.groups).length;
      s += nameHint - probs * 2;
      if (!best || s > best.score) best = { sheet: si, det: d, score: s };
    });
    return best;
  }
  function assignRoles(def, parsed, ctx) {
    var tables = [];
    parsed.forEach(function (file, fi) {
      if (file.kind === 'pdf') { var pr = def.roles.filter(function (r) { return r.pdf; })[0]; tables.push({ fi: fi, file: file, role: pr ? pr.key : 'ignore', pdf: true, scores: {} }); return; }
      if (!file.sheets.length) { tables.push({ fi: fi, file: file, role: 'ignore', empty: true, scores: {} }); return; }
      var t = { fi: fi, file: file, scores: {}, per: {} };
      def.roles.forEach(function (r) { var b = bestTable(file, r, ctx); t.per[r.key] = b; t.scores[r.key] = b ? b.score : -99; });
      tables.push(t);
    });
    // assign: single-instance roles get the best-scoring file; others take what fits
    var taken = {};
    var single = def.roles.filter(function (r) { return !r.multi; });
    single.forEach(function (r) {
      var cand = tables.filter(function (t) { return !t.role && !t.pdf && !t.empty; }).sort(function (a, b) { return (b.scores[r.key] - b.scores[otherKey(r)]) - (a.scores[r.key] - a.scores[otherKey(r)]); });
      if (r.pdf && tables.some(function (t) { return t.pdf && t.role === r.key; })) { taken[r.key] = 1; return; }
      if (cand.length) { cand[0].role = r.key; taken[r.key] = 1; }
    });
    function otherKey(r) { var o = def.roles.filter(function (x) { return x.key !== r.key; })[0]; return o ? o.key : r.key; }
    tables.forEach(function (t) {
      if (t.role) return;
      var multi = def.roles.filter(function (r) { return r.multi; })[0];
      if (multi) t.role = multi.key; else t.role = 'ignore';
    });
    tables.forEach(function (t) { if (!t.pdf && t.role !== 'ignore' && t.per && t.per[t.role]) { t.sheet = t.per[t.role].sheet; t.map = t.per[t.role].det; } });
    return tables;
  }
  function roleOf(def, key) { return def.roles.filter(function (r) { return r.key === key; })[0]; }

  // ---------------- mapping step ----------------
  // mode: 'columns' (detection unsure), 'settings' (columns fine, a figure is missing), 'remap' (visitor asked)
  function mappingStep(ctxRun, tables, settings, problems, mode) {
    var def = ctxRun.def, ui = ctxRun.ui, body = ui.body();
    return new Promise(function (resolve) {
      body.innerHTML = '';
      var wrap = el('div', 'f1a-map');
      if (mode === 'settings') wrap.innerHTML = '<h3>One more figure</h3><p class="f1a-lead">Your columns were recognised, but ' + esc(problems.join('; ').toLowerCase()) + ' is not in the files. Please enter it from your records, then continue.</p>';
      else if (mode === 'remap') wrap.innerHTML = '<h3>Adjust columns</h3><p class="f1a-lead">Change any column match or figure below, then continue to recalculate.</p>';
      else wrap.innerHTML = '<h3>Check the columns</h3><p class="f1a-lead">We were not sure about some of the columns' + (problems.length ? ' (' + esc(problems.join('; ')) + ')' : '') + '. Our best guesses are filled in; adjust anything that is wrong, then continue.</p>';
      var holder = wrap;
      if (mode === 'settings') { holder = el('details', 'f1a-mapmore'); holder.innerHTML = '<summary>Column matches (found automatically)</summary>'; }
      tables.forEach(function (t, ti) {
        var box = el('section', 'f1a-mapbox');
        var head = '<div class="f1a-maph"><b>' + esc(t.file.name) + '</b>';
        if (def.roles.length > 1 || t.role === 'ignore') {
          head += '<label class="f1a-role">This file is <select data-role="' + ti + '">' + def.roles.map(function (r) { return '<option value="' + r.key + '"' + (t.role === r.key ? ' selected' : '') + '>' + esc(r.label) + '</option>'; }).join('') + '<option value="ignore"' + (t.role === 'ignore' ? ' selected' : '') + '>Not used</option></select></label>';
        }
        head += '</div>';
        box.innerHTML = head;
        var grid = el('div', 'f1a-mapgrid');
        box.appendChild(grid);
        function drawGrid() {
          grid.innerHTML = '';
          if (t.pdf) { grid.innerHTML = '<p class="f1a-note">Read from the PDF text: ' + (t.stmt ? plural(t.stmt.txns.length, 'transaction') : 'no transactions') + '.</p>'; return; }
          if (t.role === 'ignore' || t.empty) { grid.innerHTML = '<p class="f1a-note">' + (t.empty ? 'This file looks empty.' : 'This file will not be used.') + '</p>'; return; }
          var role = roleOf(def, t.role), sh = t.file.sheets[t.sheet || 0];
          if (!t.map || t.mapRole !== t.role) { t.map = detectTable(sh.rows, role.fields, ctxRun.ctx); t.mapRole = t.role; }
          var rowsHtml = '';
          if (t.file.sheets.length > 1) rowsHtml += '<label class="f1a-fld"><span>Sheet</span><select data-sheet>' + t.file.sheets.map(function (s, si) { return '<option value="' + si + '"' + (si === (t.sheet || 0) ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label>';
          var hopts = '<option value="-1"' + (t.map.headerRow < 0 ? ' selected' : '') + '>No header row</option>';
          for (var r = 0; r < Math.min(sh.rows.length, 30); r++) { var preview = (sh.rows[r] || []).filter(function (v) { return v != null && v !== ''; }).slice(0, 4).map(txt).join(' | '); if (!preview) continue; hopts += '<option value="' + r + '"' + (r === t.map.headerRow ? ' selected' : '') + '>Row ' + (r + 1) + ': ' + esc(preview.slice(0, 60)) + '</option>'; }
          rowsHtml += '<label class="f1a-fld"><span>Header row</span><select data-hdr>' + hopts + '</select></label>';
          role.fields.forEach(function (f) {
            if (f.hide) return;
            var c = t.map.cols[f.key], unsure = c == null ? (f.req ? ' is-miss' : '') : (t.map.conf[f.key] < 0.75 ? ' is-unsure' : '');
            var o = '<option value="">' + (f.req === true ? 'Choose a column' : 'Not in this file') + '</option>' + t.map.headers.map(function (h) { return '<option value="' + h.c + '"' + (h.c === c ? ' selected' : '') + '>' + esc(h.label) + (h.example ? ' (e.g. ' + esc(h.example) + ')' : '') + '</option>'; }).join('');
            rowsHtml += '<label class="f1a-fld' + unsure + '"><span>' + esc(f.label) + (f.req === true ? ' <em>required</em>' : '') + '</span><select data-f="' + f.key + '">' + o + '</select></label>';
          });
          if (role.groups) role.groups.forEach(function (g) { rowsHtml += '<p class="f1a-note">' + esc(g.label) + '</p>'; });
          grid.innerHTML = rowsHtml;
          var shSel = grid.querySelector('[data-sheet]');
          if (shSel) shSel.addEventListener('change', function () { t.sheet = +shSel.value; t.map = null; drawGrid(); });
          grid.querySelector('[data-hdr]').addEventListener('change', function (e) {
            var hr = +e.target.value, det = detectTableAt(sh.rows, role.fields, hr, ctxRun.ctx); t.map = det; t.mapRole = t.role; drawGrid();
          });
          [].forEach.call(grid.querySelectorAll('[data-f]'), function (s) {
            s.addEventListener('change', function () { var k = s.getAttribute('data-f'); if (s.value === '') delete t.map.cols[k]; else { Object.keys(t.map.cols).forEach(function (kk) { if (t.map.cols[kk] === +s.value && kk !== k) delete t.map.cols[kk]; }); t.map.cols[k] = +s.value; } t.map.conf[k] = 1; drawGrid(); });
          });
        }
        drawGrid();
        var rs = box.querySelector('[data-role]');
        if (rs) rs.addEventListener('change', function () { t.role = rs.value; t.map = null; if (t.role !== 'ignore' && t.per && t.per[t.role]) t.sheet = t.per[t.role].sheet; drawGrid(); });
        holder.appendChild(box);
      });
      if (settings && settings.length) {
        var sb = el('section', 'f1a-mapbox');
        sb.innerHTML = '<div class="f1a-maph"><b>Figures we need</b></div>';
        var g = el('div', 'f1a-mapgrid');
        settings.forEach(function (s) {
          var val = s.type === 'money' ? (s.value == null ? '' : (s.value / 100).toFixed(2)) : s.type === 'date' ? (s.value == null ? '' : iso(s.value)) : (s.value == null ? '' : s.value);
          g.innerHTML += '<label class="f1a-fld' + (s.required && s.value == null ? ' is-miss' : '') + '"><span>' + esc(s.label) + (s.required ? ' <em>required</em>' : '') + '</span><input data-s="' + s.key + '" ' + (s.type === 'date' ? 'type="date"' : 'inputmode="decimal" type="text"') + ' value="' + esc(val) + '" placeholder="' + (s.type === 'money' ? '0.00' : '') + '">' + (s.hint ? '<small>' + esc(s.hint) + '</small>' : '') + '</label>';
        });
        sb.appendChild(g); wrap.appendChild(sb);
      }
      if (holder !== wrap) wrap.appendChild(holder);
      var bar = el('div', 'f1a-mapbar');
      bar.innerHTML = '<p class="f1a-maperr" role="alert"></p><button type="button" class="f1a-go">Continue</button>';
      wrap.appendChild(bar);
      body.appendChild(wrap); body.scrollTop = 0;
      bar.querySelector('button').addEventListener('click', function () {
        var err = [];
        tables.forEach(function (t) {
          if (t.pdf || t.role === 'ignore' || t.empty) return;
          var role = roleOf(def, t.role), p = reqProblems(role.fields, t.map.cols, role.groups);
          if (p.length) err.push(t.file.name + ': ' + p.join(', '));
        });
        def.roles.forEach(function (r) { if (r.need && !tables.some(function (t) { return t.role === r.key; })) err.push('Choose which file is the ' + r.label.toLowerCase()); });
        var vals = {};
        (settings || []).forEach(function (s) {
          var inp = wrap.querySelector('[data-s="' + s.key + '"]'), v = inp.value.trim(), pv = null;
          if (v) { pv = s.type === 'money' ? parseMoney(v) : s.type === 'date' ? parseDate(v) : +v; if (pv == null || (typeof pv === 'number' && isNaN(pv))) err.push(s.label + ' is not a valid ' + (s.type === 'money' ? 'amount' : s.type)); }
          if (pv == null && s.required) err.push(s.label + ' is required');
          vals[s.key] = pv;
        });
        if (err.length) { bar.querySelector('.f1a-maperr').textContent = err.join('. ') + '.'; return; }
        resolve(vals);
      });
    });
  }
  function detectTableAt(rows, fields, hr, ctx) { return detectTable(rows, fields, ctx, hr); }

  // ---------------- results rendering ----------------
  var SEV = { high: 'Needs attention', med: 'Review', low: 'Note' };
  function cellHtml(col, v) {
    if (v == null || v === '') return '';
    if (col.t === 'money') return money(v);
    if (col.t === 'date') return fdate(v);
    if (col.t === 'pct') return (v * 100).toFixed(1) + '%';
    return esc(v);
  }
  function tableHtml(tb, limit) {
    var n = tb.rows.length, lim = limit || 150;
    var h = '<div class="f1a-tw' + (tb.form ? ' is-form' : '') + '"><table><thead><tr>' + tb.cols.map(function (c) { return '<th' + (c.t === 'money' || c.t === 'num' || c.t === 'pct' ? ' class="n"' : '') + '>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>';
    tb.rows.slice(0, lim).forEach(function (r) {
      h += '<tr' + (r._cls ? ' class="' + r._cls + '"' : '') + '>' + tb.cols.map(function (c) { var v = r[c.k]; return '<td' + (c.t === 'money' || c.t === 'num' || c.t === 'pct' ? ' class="n' + (c.t === 'money' && v < 0 ? ' neg' : '') + '"' : c.t === 'date' ? ' class="d"' : '') + '>' + cellHtml(c, v) + '</td>'; }).join('') + '</tr>';
    });
    h += '</tbody>' + (tb.total ? '<tfoot><tr>' + tb.cols.map(function (c) { var v = tb.total[c.k]; return '<td' + (c.t === 'money' || c.t === 'num' ? ' class="n"' : '') + '>' + cellHtml(c, v) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table></div>';
    if (n > lim) h += '<p class="f1a-note">Showing the first ' + lim + ' of ' + n + ' rows. The download has all of them.</p>';
    return h;
  }
  function renderResult(ctxRun, res, rerun) {
    var ui = ctxRun.ui, body = ui.body();
    body.innerHTML = '';
    var w = el('div', 'f1a-res');
    var h = '';
    h += '<header class="f1a-rh"><div><h3>' + esc(res.title) + '</h3>' + (res.subtitle ? '<p>' + esc(res.subtitle) + '</p>' : '') + '</div>' +
      '<div class="f1a-acts"><button type="button" class="f1a-go f1a-dl"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v10m0 0-4-4m4 4 4-4M5 18.5h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Download results (.xlsx)</button>' +
      (ctxRun.canRemap ? '<button type="button" class="f1a-ghost f1a-remap">Adjust columns</button>' : '') + '</div></header>';
    h += '<p class="f1a-dl-note" hidden></p>';
    h += '<div class="f1a-tiles">' + res.headline.map(function (t) { return '<div class="f1a-tile' + (t.tone ? ' is-' + t.tone : '') + '"><span>' + esc(t.label) + '</span><b>' + esc(t.value) + '</b>' + (t.sub ? '<small>' + esc(t.sub) + '</small>' : '') + '</div>'; }).join('') + '</div>';
    if (res.controls && res.controls.length) {
      var summ = res.controls.map(function (c) {
        if (c.type === 'select') { var o = c.options.filter(function (o) { return String(o.v) === String(c.value); })[0]; return o ? o.t.replace(/\s*\(.*\)$/, '') : ''; }
        return c.value == null ? '' : c.type === 'money' ? money(c.value) : c.type === 'date' ? fdate(c.value) : String(c.value);
      }).filter(Boolean).join(' · ');
      h += '<details class="f1a-ctl-d"' + (ctxRun.ctlOpen ? ' open' : '') + '><summary><b>Figures used</b> <small>' + esc(summ) + '</small><span class="f1a-chg">Change</span></summary><div class="f1a-ctl">' + res.controls.map(function (c) {
        if (c.type === 'select') return '<label><span>' + esc(c.label) + '</span><select data-c="' + c.key + '">' + c.options.map(function (o) { return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(c.value) ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select></label>';
        var v = c.type === 'money' ? (c.value == null ? '' : money(c.value, { noSign: true }).replace('−', '-')) : c.type === 'date' ? iso(c.value) : (c.value == null ? '' : c.value);
        if (c.type === 'money' && c.value < 0) v = '-' + v.replace(/^[-−]/, '');
        return '<label><span>' + esc(c.label) + '</span><input data-c="' + c.key + '" ' + (c.type === 'date' ? 'type="date"' : 'type="text" inputmode="decimal"') + ' value="' + esc(v) + '" placeholder="' + esc(c.placeholder || '') + '"></label>';
      }).join('') + '</div></details>';
    }
    var ex = res.exceptions || [];
    var order = { high: 0, med: 1, low: 2 };
    ex.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    h += '<section class="f1a-sec"><h4>Exceptions <span class="f1a-cnt">' + ex.length + '</span></h4>';
    if (!ex.length) h += '<p class="f1a-ok">No exceptions found by these checks.</p>';
    else h += '<ul class="f1a-ex">' + ex.map(function (e) { return '<li class="is-' + e.sev + '"><span class="f1a-sev">' + SEV[e.sev] + '</span><b>' + esc(e.title) + (e.amount != null ? ' <span class="f1a-amt">' + money(e.amount) + '</span>' : '') + '</b>' + (e.detail ? '<p>' + esc(e.detail) + '</p>' : '') + '</li>'; }).join('') + '</ul>';
    h += '</section>';
    (res.sections || []).forEach(function (s, i) {
      var open = s.open ? ' open' : '';
      h += '<details class="f1a-sec f1a-det"' + open + '><summary><h4>' + esc(s.title) + (s.table ? ' <span class="f1a-cnt">' + s.table.rows.length + '</span>' : '') + '</h4></summary>' + (s.note ? '<p class="f1a-note">' + esc(s.note) + '</p>' : '') + (s.table ? (s.table.rows.length ? tableHtml(s.table, s.limit) : '<p class="f1a-note">' + esc(s.empty || 'None.') + '</p>') : '') + (s.foot ? '<p class="f1a-note">' + esc(s.foot) + '</p>' : '') + '</details>';
    });
    h += '<details class="f1a-sec f1a-det f1a-how"><summary><h4>How this was calculated</h4></summary><ul>' + (res.how || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>';
    h += '<footer class="f1a-foot"><p class="f1a-disc"><b>Draft analysis for review \u2014 not tax or accounting advice; a professional reviews and signs.</b></p>' +
      '<p>Your files were read inside this browser tab. Nothing was uploaded or stored; closing this view clears it.</p>' +
      (res.sources && res.sources.length ? '<p>Sources: ' + res.sources.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>'; }).join(' \u00b7 ') + '</p>' : '') + '</footer>';
    w.innerHTML = h;
    body.appendChild(w);
    body.scrollTop = 0;
    w.querySelector('.f1a-dl').addEventListener('click', function () { download(res, w.querySelector('.f1a-dl-note')); });
    var rm = w.querySelector('.f1a-remap'); if (rm) rm.addEventListener('click', function () { ctxRun.remap(); });
    [].forEach.call(w.querySelectorAll('[data-c]'), function (inp) {
      inp.addEventListener('change', function () {
        var c = res.controls.filter(function (x) { return x.key === inp.getAttribute('data-c'); })[0], v = inp.value.trim(), pv;
        if (c.type === 'money') pv = v === '' ? null : parseMoney(v); else if (c.type === 'date' || c.parse === 'date') pv = parseDate(v); else if (c.type === 'number') pv = v === '' ? null : +v; else pv = v;
        if (v !== '' && (pv == null || (typeof pv === 'number' && isNaN(pv)))) { inp.classList.add('is-bad'); return; }
        var st = body.scrollTop, o = {}; o[c.key] = pv; ctxRun.ctlOpen = true; rerun(o, st);
      });
    });
  }
  function download(res, note) {
    var X = window.XLSX, wb = X.utils.book_new();
    (res.sheets || []).forEach(function (sh) {
      var aoa = [], types = [];
      if (sh.title) { aoa.push([sh.title]); types.push(null); }
      if (sh.pre) sh.pre.forEach(function (r) { aoa.push(r); types.push(null); });
      if (sh.table) {
        aoa.push(sh.table.cols.map(function (c) { return c.label; })); types.push(null);
        sh.table.rows.forEach(function (r) { aoa.push(sh.table.cols.map(function (c) { var v = r[c.k]; if (v == null) return null; if (c.t === 'money') return v / 100; if (c.t === 'date') return v + 25569; if (c.k === 'sev' && SEV[v]) return SEV[v]; return v; })); types.push(sh.table.cols); });
        if (sh.table.total) { aoa.push(sh.table.cols.map(function (c) { var v = sh.table.total[c.k]; return v == null ? null : c.t === 'money' ? v / 100 : v; })); types.push(sh.table.cols); }
      }
      var ws = X.utils.aoa_to_sheet(aoa);
      aoa.forEach(function (row, ri) {
        var t = types[ri]; if (!t) return;
        t.forEach(function (c, ci) { var a = X.utils.encode_cell({ r: ri, c: ci }), cell = ws[a]; if (!cell || cell.t !== 'n') return; if (c.t === 'money') cell.z = '#,##0.00;-#,##0.00'; else if (c.t === 'date') cell.z = 'mm/dd/yyyy'; else if (c.t === 'pct') cell.z = '0.0%'; });
      });
      var widths = []; aoa.forEach(function (row) { row.forEach(function (v, i) { var l = v == null ? 0 : String(typeof v === 'number' ? v.toFixed(2) : v).length; widths[i] = Math.min(60, Math.max(widths[i] || 8, l + 2)); }); });
      ws['!cols'] = widths.map(function (w) { return { wch: w }; });
      X.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
    });
    var data = X.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    var blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var name = (res.file || 'f1-analysis') + '.xlsx';
    var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|Twitter/i.test(navigator.userAgent || '');
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
    if (note) { note.hidden = false; note.textContent = inApp ? 'If nothing downloaded, this in-app browser may block downloads: open this page in Safari or Chrome (menu \u2026 then Open in browser) and run it again.' : 'Saved as ' + name + ' (created on this device).'; }
  }

  // ---------------- run ----------------
  function tick() { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); }
  C.run = function (run) {
    var def = run.def, pg = run.pg, ui = run.ui;
    if (!def) { ui.error('This analyzer is not available right now.'); return; }
    run.ctx = {};
    var parsed, tables, settingsVals = {}, opts = {};
    function fail(e) {
      if (!run.alive()) return;
      if (e && e.friendly) ui.error(e.message);
      else { ui.error('Something unexpected happened while analyzing. ' + (e && e.message ? '(' + e.message + ')' : '')); if (window.console) console.warn(e); }
    }
    function build() {
      var input = {};
      def.roles.forEach(function (r) { input[r.key] = []; });
      tables.forEach(function (t) {
        if (t.role === 'ignore' || t.empty) return;
        if (t.pdf) { input[t.role].push({ file: t.file.name, pdf: true, stmt: t.stmt }); return; }
        var role = roleOf(def, t.role), sh = t.file.sheets[t.sheet || 0];
        var ex = extract(sh.rows, t.map, role.fields, run.ctx);
        var pre = []; for (var r = 0; r < Math.max(0, t.map.headerRow); r++) { var tx = (sh.rows[r] || []).filter(function (v) { return v != null; }).map(txt).join(' '); if (tx) pre.push(tx); }
        input[t.role].push({ file: t.file.name, sheet: sh.name, records: ex.records, skipped: ex.skipped, cols: t.map.cols, map: t.map, pre: pre, rows: sh.rows });
      });
      return input;
    }
    function analyzeAndRender(scrollTo) {
      var input = build();
      var res = def.analyze(input, Object.assign({}, settingsVals, opts), C);
      renderResult(run, res, function (o, st) { Object.assign(opts, o); analyzeAndRender(st); });
      if (scrollTo) ui.body().scrollTop = scrollTo;
      if (res.subtitle) ui.setSub(res.subtitle);
    }
    function settingsFor(input) { return def.settings ? def.settings(input, C) : []; }
    run.canRemap = true;
    run.remap = function () {
      var input = build(), st = settingsFor(input);
      st.forEach(function (s) { if (settingsVals[s.key] != null) s.value = settingsVals[s.key]; });
      mappingStep(run, tables, st, [], 'remap').then(function (vals) { settingsVals = vals; opts = {}; analyzeAndRender(); }).catch(fail);
    };
    return readAll(run.files).then(function (p) {
      if (!run.alive()) return;
      parsed = p;
      pg.step(0, 'done', p.map(function (f) { return f.name; }).join(', '));
      pg.step(1, 'on', '');
      return pg.wait();
    }).then(function () {
      if (!run.alive()) return;
      tables = assignRoles(def, parsed, run.ctx);
      tables.forEach(function (t) { if (t.pdf) t.stmt = pdfStatement(t.file); });
      var problems = [];
      tables.forEach(function (t) {
        if (t.pdf) { if (t.stmt && !t.stmt.txns.length) throw friendly('We could not find transactions in ' + t.file.name + '. If it is a scanned statement, please upload the Excel or CSV export instead.'); return; }
        if (t.empty || t.role === 'ignore') return;
        var role = roleOf(def, t.role), p = reqProblems(role.fields, t.map.cols, role.groups);
        if (p.length) problems.push(t.file.name + ': ' + p.join(', ') + ' not found');
        role.fields.forEach(function (f) { if (f.req && t.map.cols[f.key] != null && (t.map.conf[f.key] || 0) < 0.75 && problems.indexOf(t.file.name + ': unsure about ' + f.label) < 0) problems.push(t.file.name + ': unsure about ' + f.label); });
        if (role.groups) role.groups.forEach(function (g) { var got = g.keys.filter(function (k) { return t.map.cols[k] != null; }); got.forEach(function (k) { if ((t.map.conf[k] || 0) < 0.75) problems.push(t.file.name + ': unsure about the amount columns'); }); });
      });
      def.roles.forEach(function (r) { if (r.need && !tables.some(function (t) { return t.role === r.key; })) problems.push('no file looks like the ' + r.label.toLowerCase()); });
      if (def.validate) problems = problems.concat(def.validate(tables, C) || []);
      problems = problems.filter(function (p, i) { return problems.indexOf(p) === i; });
      var detected = tables.filter(function (t) { return t.role !== 'ignore'; }).map(function (t) { var r = roleOf(def, t.role); return (r ? r.label : t.role) + ': ' + t.file.name; }).join('; ');
      pg.step(1, problems.length ? 'warn' : 'done', problems.length ? 'Please confirm a few columns' : detected);
      var input = build(), st = settingsFor(input);
      var missing = st.filter(function (s) { return s.required && s.value == null; });
      if (problems.length || missing.length) {
        return pg.wait().then(function () { return problems.length ? mappingStep(run, tables, st, problems.concat(missing.map(function (s) { return s.label + ' needed'; })), 'columns') : mappingStep(run, tables, st, missing.map(function (s) { return s.label; }), 'settings'); }).then(function (vals) {
          settingsVals = vals; ui.body().innerHTML = ''; ui.body().appendChild(pg.el); pg.step(1, 'done', 'Columns confirmed');
        });
      }
    }).then(function () {
      if (!run.alive()) return;
      pg.step(2, 'on', ''); return pg.wait();
    }).then(function () {
      if (!run.alive()) return;
      pg.step(2, 'done', ''); pg.step(3, 'on', ''); return pg.wait();
    }).then(function () {
      if (!run.alive()) return;
      pg.step(3, 'done', '');
      return tick().then(function () { if (run.alive()) analyzeAndRender(); });
    }).catch(fail);
  };

  // exports for analyzers
  C.util = { esc: esc, dn: dn, parts: parts, iso: iso, fdate: fdate, ldate: ldate, money: money, pct: pct, sum: sum, plural: plural, holidays: holidays, endOfMonth: endOfMonth,
    monthName: monthName, MON: MON, DOW: DOW, parseDate: parseDate, parseMoney: parseMoney, txt: txt, norm: norm, daysInMonth: daysInMonth };
  C.detectTable = detectTable; C.pdfStatement = pdfStatement; C.extract = extract;
  window.F1Core = C;
})();
