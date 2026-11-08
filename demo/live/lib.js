/* F1 Finance demos · "Try your own numbers" · shared helpers (no DOM).
   Used by the browser panel and by the Node tests (S\qa\live-tests). Plain JS, no build step. */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else { root.FFLive = root.FFLive || {}; root.FFLive.lib = lib; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- numbers ------------------------------------------------------------------------------------
  // Excel's ROUND(x, 2): half away from zero on the decimal value, not on the binary double.
  function round2(x) {
    x = +x || 0;
    var s = x < 0 ? -1 : 1, a = Math.abs(x) * 100;
    var r = Math.round(a + 1e-7 * Math.max(1, a / 1e6));
    var v = s * r / 100;
    return v === 0 ? 0 : v;
  }
  function sum(arr, f) { var t = 0; for (var i = 0; i < arr.length; i++) t += f ? (+f(arr[i], i) || 0) : (+arr[i] || 0); return round2(t); }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    var s = String(v).trim();
    if (!s) return 0;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[$\s]/g, ''));
    s = s.replace(/[^0-9.]/g, '');
    var n = parseFloat(s);
    if (!isFinite(n)) return 0;
    return neg ? -n : n;
  }
  function money(v, opt) {
    opt = opt || {};
    v = round2(v);
    var neg = v < 0, a = Math.abs(v);
    var s = a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (opt.dollar !== false) s = '$' + s;
    return neg ? (opt.paren ? '(' + s + ')' : '-' + s) : s;
  }
  function plain(v) { return round2(v).toFixed(2); }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 2 : d).replace(/\.?0+$/, '') + '%'; }
  function int(v) { return Math.round(+v || 0).toLocaleString('en-US'); }

  // ---- dates (ISO yyyy-mm-dd, computed in UTC so time zones never shift a day) ------------------------
  var MS = 86400000;
  function d(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function iso(t) { var x = new Date(t); return x.getUTCFullYear() + '-' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + x.getUTCDate()).slice(-2); }
  function addDays(isoStr, n) { return iso(d(isoStr) + n * MS); }
  function dow(isoStr) { return new Date(d(isoStr)).getUTCDay(); }
  function daysBetween(a, b) { return Math.round((d(b) - d(a)) / MS); }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(d(s)) && iso(d(s)) === s; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(s, withDay) { if (!validDate(s)) return String(s || ''); var x = new Date(d(s)); return (withDay ? DAYS[x.getUTCDay()] + ', ' : '') + MONTHS[x.getUTCMonth()] + ' ' + x.getUTCDate() + ', ' + x.getUTCFullYear(); }
  function shortDate(s) { if (!validDate(s)) return String(s || ''); var x = new Date(d(s)); return MONTHS[x.getUTCMonth()].slice(0, 3) + ' ' + x.getUTCDate(); }
  // Excel serial day number -> ISO date
  function fromSerial(n) { return iso(Date.UTC(1899, 11, 30) + Math.round(+n) * MS); }

  // ---- CSV ----------------------------------------------------------------------------------------------
  function csvCell(v) { if (v == null) return ''; var s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }

  // ---- masking: identifiers show their last four only ------------------------------------------------
  function mask(v) { var s = String(v || '').replace(/\s/g, ''); if (s.length <= 4) return s; return '•••' + s.slice(-4); }

  // ---- the demo's recorded data ----------------------------------------------------------------------------
  // Tax demos keep data/manifest.json ({route: {f, t}}); accounting demos keep data/routes.json ({route: {file, type}}).
  // makeSource(readText, readBinary, [first index file, fallback]) -> { json(re), binary(re), has(re) } where re matches a route.
  function makeSource(readText, readBinary, order) {
    var indexP = null, files = order || ['data/manifest.json', 'data/routes.json'];
    function index() {
      if (!indexP) indexP = readText(files[0]).then(function (t) { return { map: JSON.parse(t) }; }, function () {
        return readText(files[1]).then(function (t) { return { map: JSON.parse(t) }; });
      });
      return indexP;
    }
    function find(re) {
      return index().then(function (ix) {
        var keys = Object.keys(ix.map);
        for (var i = 0; i < keys.length; i++) if (re.test(keys[i])) { var e = ix.map[keys[i]]; return 'data/' + (e.f || e.file); }
        throw new Error('Not in the recording: ' + re);
      });
    }
    return {
      json: function (re) { return find(re).then(readText).then(function (t) { return JSON.parse(t); }); },
      binary: function (re) { return find(re).then(readBinary); },
      has: function (re) { return find(re).then(function () { return true; }, function () { return false; }); }
    };
  }

  // ---- a small .xlsx reader: cached cell values only (the workbook stores them) ----------------------
  // inflateRaw(Uint8Array) -> Promise<Uint8Array>
  function readZip(buf) {
    var u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength), eocd = -1;
    for (var i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a zip file');
    var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), out = {};
    for (var k = 0; k < n; k++) {
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      var name = utf8(u.subarray(off + 46, off + 46 + nl));
      var lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true), start = lho + 30 + lnl + lel;
      out[name] = { method: method, data: u.subarray(start, start + csize) };
      off += 46 + nl + el + cl;
    }
    return out;
  }
  function utf8(b) { if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(b); return Buffer.from(b).toString('utf8'); }
  function xmlText(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (m, c) { return String.fromCharCode(+c); }).replace(/&#x([0-9a-f]+);/gi, function (m, c) { return String.fromCharCode(parseInt(c, 16)); }).replace(/&amp;/g, '&'); }
  function colIndex(ref) { var m = /^([A-Z]+)/.exec(ref), c = 0; for (var i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64); return c - 1; }
  function readXlsx(buf, inflateRaw) {
    var z = readZip(buf);
    function get(name) {
      name = name.replace(/^\//, '');
      var e = z[name]; if (!e) return Promise.resolve(null);
      if (e.method === 0) return Promise.resolve(utf8(e.data));
      return inflateRaw(e.data).then(utf8);
    }
    return Promise.all([get('xl/workbook.xml'), get('xl/_rels/workbook.xml.rels'), get('xl/sharedStrings.xml')]).then(function (a) {
      var wb = a[0], rels = a[1], ss = a[2], shared = [];
      if (ss) { var re = /<si>([\s\S]*?)<\/si>/g, m; while ((m = re.exec(ss))) { var t = '', r2 = /<t[^>]*>([\s\S]*?)<\/t>/g, mm; while ((mm = r2.exec(m[1]))) t += mm[1]; shared.push(xmlText(t)); } }
      var relMap = {}, rm, rre = /<Relationship\b([^>]*)\/?>/g;
      while ((rm = rre.exec(rels))) { var id = /\bId="([^"]+)"/.exec(rm[1]), tg = /\bTarget="([^"]+)"/.exec(rm[1]); if (id && tg) relMap[id[1]] = tg[1]; }
      var sheets = [], sm, sre = /<sheet\b([^>]*)\/?>/g;
      while ((sm = sre.exec(wb))) { var nm = /\bname="([^"]+)"/.exec(sm[1]), rid = /\br:id="([^"]+)"/.exec(sm[1]); if (nm && rid) sheets.push({ name: xmlText(nm[1]), target: relMap[rid[1]] }); }
      return Promise.all(sheets.map(function (s) {
        var t = s.target.charAt(0) === '/' ? s.target : 'xl/' + s.target.replace(/^\.\//, '');
        return get(t).then(function (x) { return { name: s.name, xml: x || '' }; });
      })).then(function (list) {
        var out = {};
        list.forEach(function (s) {
          var rows = [], rre2 = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, r;
          while ((r = rre2.exec(s.xml))) {
            var ri = +r[1] - 1, row = [], cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c;
            while ((c = cre.exec(r[2]))) {
              var ref = /\br="([A-Z]+\d+)"/.exec(c[1]); if (!ref) continue;
              var type = (/\bt="([^"]+)"/.exec(c[1]) || [])[1], body = c[2] || '', v = null;
              if (type === 'inlineStr') { var t2 = '', ir = /<t[^>]*>([\s\S]*?)<\/t>/g, im; while ((im = ir.exec(body))) t2 += im[1]; v = xmlText(t2); }
              else { var vm = /<v>([\s\S]*?)<\/v>/.exec(body); if (vm) { if (type === 's') v = shared[+vm[1]]; else if (type === 'str' || type === 'e') v = xmlText(vm[1]); else if (type === 'b') v = vm[1] === '1'; else v = +vm[1]; } }
              row[colIndex(ref[1])] = v;
            }
            for (var q = 0; q < row.length; q++) if (row[q] === undefined) row[q] = null;
            rows[ri] = row;
          }
          for (var p = 0; p < rows.length; p++) if (!rows[p]) rows[p] = [];
          out[s.name] = rows;
        });
        return out;
      });
    });
  }

  // ---- worksheet helpers (rows are arrays, row 1 = index 0) --------------------------------------------
  function cell(rows, ref) { var m = /^([A-Z]+)(\d+)$/.exec(ref); var r = rows[+m[2] - 1]; return r ? (r[colIndex(m[1])] == null ? null : r[colIndex(m[1])]) : null; }
  function findRow(rows, col, re) { for (var i = 0; i < rows.length; i++) { var r = rows[i] || []; if (re.test(String(r[col] == null ? '' : r[col]))) return i; } return -1; }

  // ---- results comparison -----------------------------------------------------------------------------
  function same(a, b) { if (typeof a === 'number' || typeof b === 'number') return Math.abs(round2(+a) - round2(+b)) < 0.005; return String(a) === String(b); }

  return {
    round2: round2, sum: sum, num: num, money: money, plain: plain, pct: pct, int: int,
    d: d, iso: iso, addDays: addDays, dow: dow, daysBetween: daysBetween, validDate: validDate, longDate: longDate, shortDate: shortDate, fromSerial: fromSerial,
    MONTHS: MONTHS, DAYS: DAYS,
    csv: csv, mask: mask, makeSource: makeSource, readXlsx: readXlsx, readZip: readZip, cell: cell, findRow: findRow, colIndex: colIndex, same: same,
    clone: function (o) { return JSON.parse(JSON.stringify(o)); }
  };
});
