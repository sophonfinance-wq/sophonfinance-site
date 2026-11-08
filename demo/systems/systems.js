/* F1 Finance client systems: one static app that renders the five mock systems from demo/<id>/systems.json.
   Read-only. Hash routes (#/<app>/<view>/<arg>?k=v) so the back button and deep links work. */
(function () {
  'use strict';
  var qs = new URLSearchParams(location.search);
  var DEMO = (qs.get('d') || '').replace(/[^a-z0-9-]/gi, '');
  var BASE = '../' + DEMO + '/';
  var APPS = [
    { id: 'ledgerwyn', name: 'Ledgerwyn', purpose: 'Ledger, Reports & Journals' },
    { id: 'charterfold', name: 'Charterfold', purpose: 'Entity, Owners & Documents' },
    { id: 'vellumrow', name: 'Vellumrow', purpose: 'Capture, Coding & Approval' },
    { id: 'quillpost', name: 'Quillpost', purpose: 'Messages & Attachments' },
    { id: 'taxrules', name: 'Tax Rules', purpose: 'Official Sources & Rule Checks' }
  ];
  var ALIAS = { accounting: 'ledgerwyn', records: 'charterfold', invoices: 'vellumrow', email: 'quillpost', confirmations: 'charterfold', rules: 'taxrules', research: 'taxrules' };
  var ICONS = {
    ledgerwyn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h7M8 12h7M8 16h4"/></svg>',
    charterfold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13h8"/></svg>',
    vellumrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="m9 15 2 2 4-4"/></svg>',
    quillpost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    taxrules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    csv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
  };
  var S = null, GL = [], ACC = {}, DOCS = {}, JIDX = {}, TABLES = {}, ROUTE = null;

  // ------------------------------------------------------------------ helpers
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n, blankZero) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '';
    n = Math.round(n * 100) / 100;
    if (blankZero && Math.abs(n) < 0.005) return '<span class="muted">–</span>';
    var s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? '(' + s + ')' : s;
  }
  function usd(n) { return (n === null || n === undefined || isNaN(n)) ? '' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function date(s) {
    if (!s) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return MON[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1];
    var t = Date.parse(s); if (isNaN(t)) return esc(s);
    var d = new Date(t); return MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function dateTime(s) {
    if (!s) return '';
    var t = Date.parse(s); if (isNaN(t)) return esc(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return date(s);
    var d = new Date(t);
    return MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function monthLabel(ym) { return MONTH[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }
  function fileUrl(u) { return u ? BASE + String(u).split('/').map(function (p) { return encodeURIComponent(decodeSafe(p)); }).join('/') : ''; }
  function decodeSafe(p) { try { return decodeURIComponent(p); } catch (e) { return p; } }
  function href(app, view, arg, q) {
    var h = '#/' + app + (view ? '/' + view : '') + (arg !== undefined && arg !== null && arg !== '' ? '/' + encodeURIComponent(arg) : '');
    var parts = []; if (q) Object.keys(q).forEach(function (k) { if (q[k] !== undefined && q[k] !== null && q[k] !== '') parts.push(k + '=' + encodeURIComponent(q[k])); });
    return h + (parts.length ? '?' + parts.join('&') : '');
  }
  function badge(text, kind) { return '<span class="badge b-' + esc(kind || 'info') + '">' + esc(text) + '</span>'; }
  function statusKind(s) {
    s = String(s || '').toLowerCase();
    if (/paid|posted|pass|filed|read and filed|agrees|balanced|closed/.test(s)) return 'pass';
    if (/hold|fail|differ|reject/.test(s)) return 'fail';
    if (/review|open|finding|flag|pending|draft|unsigned/.test(s)) return 'open';
    if (/proposed/.test(s)) return 'proposed';
    return 'info';
  }
  function acctName(no) { return ACC[no] ? ACC[no].name : 'Account ' + no; }
  function docIco(d) { var t = (d && (d.type || d.ext) || '').toLowerCase(); var k = /pdf/.test(t) ? 'pdf' : /excel|xls/.test(t) ? 'excel' : /word|doc/.test(t) ? 'word' : /email|eml/.test(t) ? 'email' : 'file'; var lbl = { pdf: 'PDF', excel: 'XLS', word: 'DOC', email: 'EML', file: 'FILE' }[k]; return '<span class="ico ' + k + '">' + lbl + '</span>'; }
  function size(n) { if (!n) return ''; return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  // ------------------------------------------------------------------ tables (sort, search, export, paging)
  var TID = 0;
  function table(cfg) {
    cfg.id = 't' + (++TID);
    var st = TABLES[cfg.id] = { cfg: cfg, sort: cfg.sort || null, q: '', limit: cfg.limit || 150 };
    var tools = '';
    if (cfg.search !== false) tools += '<div class="grow"><input class="search" type="search" placeholder="' + esc(cfg.placeholder || 'Search') + '" aria-label="Search this list" data-t="' + cfg.id + '"></div>';
    if (cfg.tools) tools += cfg.tools;
    if (cfg.csv) tools += '<button type="button" class="btn" data-csv="' + cfg.id + '">' + ICONS.csv + 'Export CSV</button>';
    var head = cfg.cols.map(function (c, i) { return '<th class="' + (c.num ? 'num ' : '') + (c.sort === false ? '' : 'sortable') + '" data-t="' + cfg.id + '" data-c="' + i + '" scope="col">' + esc(c.label) + '<span class="arrow"></span></th>'; }).join('');
    return '<div class="card flush">' + (cfg.title ? '<div class="card-h"><h2 class="grow">' + cfg.title + '</h2>' + (cfg.titleRight || '') + '</div>' : '') +
      (tools ? '<div class="bar">' + tools + '</div>' : '') +
      '<div class="tw"><table' + (cfg.cls ? ' class="' + cfg.cls + '"' : '') + '><thead><tr>' + head + '</tr></thead><tbody id="' + cfg.id + '-b"></tbody><tfoot id="' + cfg.id + '-f"></tfoot></table></div><div class="t-more" id="' + cfg.id + '-m"></div></div>';
  }
  function tableRows(st) {
    var cfg = st.cfg, rows = cfg.rows;
    if (st.q) {
      var q = st.q.toLowerCase();
      rows = rows.filter(function (r) { return (cfg.text ? cfg.text(r) : cfg.cols.map(function (c) { return c.csv ? c.csv(r) : c.val ? c.val(r) : ''; }).join(' ')).toString().toLowerCase().indexOf(q) >= 0; });
    }
    if (st.sort) {
      var c = cfg.cols[st.sort.c], dir = st.sort.dir;
      var get = c.val || c.csv || function () { return ''; };
      rows = rows.slice().sort(function (a, b) { var x = get(a), y = get(b); if (x === y) return 0; if (x === null || x === undefined || x === '') return 1; if (y === null || y === undefined || y === '') return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true })) * dir; });
    }
    return rows;
  }
  function drawTable(id) {
    var st = TABLES[id]; if (!st) return;
    var cfg = st.cfg, rows = tableRows(st);
    var body = document.getElementById(id + '-b'); if (!body) return;
    var shown = rows.slice(0, st.limit);
    body.innerHTML = shown.length ? shown.map(function (r) {
      var h = cfg.href ? cfg.href(r) : null;
      return '<tr' + (h ? ' class="link" data-href="' + esc(h) + '"' : '') + (cfg.rowCls ? ' class="' + cfg.rowCls(r) + (h ? ' link' : '') + '"' : '') + '>' + cfg.cols.map(function (c, i) {
        var v = c.html ? c.html(r) : esc(c.csv ? c.csv(r) : '');
        if (i === 0 && h && !c.noLink) v = '<a href="' + esc(h) + '">' + v + '</a>';
        return '<td class="' + (c.num ? 'num' : '') + (c.wrap ? ' wrap' : '') + '">' + v + '</td>';
      }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + cfg.cols.length + '"><div class="empty">' + esc(cfg.empty || 'Nothing matches.') + '</div></td></tr>';
    var foot = document.getElementById(id + '-f');
    foot.innerHTML = cfg.foot && rows.length ? cfg.foot(rows) : '';
    var more = document.getElementById(id + '-m');
    more.innerHTML = rows.length > st.limit ? 'Showing ' + st.limit.toLocaleString() + ' of ' + rows.length.toLocaleString() + ' <button type="button" class="btn" data-more="' + id + '">Show ' + Math.min(500, rows.length - st.limit) + ' more</button><button type="button" class="btn" data-all="' + id + '">Show all</button>' : (rows.length ? plural(rows.length, cfg.noun || 'line') : '');
    document.querySelectorAll('th[data-t="' + id + '"]').forEach(function (th) { var a = th.querySelector('.arrow'); a.textContent = st.sort && st.sort.c === +th.dataset.c ? (st.sort.dir > 0 ? '▲' : '▼') : ''; th.setAttribute('aria-sort', st.sort && st.sort.c === +th.dataset.c ? (st.sort.dir > 0 ? 'ascending' : 'descending') : 'none'); });
  }
  function csvOf(id) {
    var st = TABLES[id], cfg = st.cfg, rows = tableRows(st);
    var q = function (v) { v = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var out = [cfg.cols.map(function (c) { return q(c.label); }).join(',')];
    rows.forEach(function (r) { out.push(cfg.cols.map(function (c) { return q(c.csv ? c.csv(r) : c.val ? c.val(r) : ''); }).join(',')); });
    var blob = new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = (cfg.csv || 'export') .replace(/[^\w.-]+/g, '-') + (/\.csv$/.test(cfg.csv) ? '' : '.csv');
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.t || !TABLES[t.dataset.t]) return;
    TABLES[t.dataset.t].q = t.value.trim(); TABLES[t.dataset.t].limit = TABLES[t.dataset.t].cfg.limit || 150; drawTable(t.dataset.t);
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var th = t.closest('th.sortable');
    if (th && TABLES[th.dataset.t]) { var st = TABLES[th.dataset.t], c = +th.dataset.c; st.sort = st.sort && st.sort.c === c ? { c: c, dir: -st.sort.dir } : { c: c, dir: st.cfg.cols[c].num ? -1 : 1 }; drawTable(th.dataset.t); return; }
    var b = t.closest('[data-csv]'); if (b) { csvOf(b.dataset.csv); return; }
    b = t.closest('[data-more]'); if (b) { TABLES[b.dataset.more].limit += 500; drawTable(b.dataset.more); return; }
    b = t.closest('[data-all]'); if (b) { TABLES[b.dataset.all].limit = 1e9; drawTable(b.dataset.all); return; }
    var tr = t.closest('tr[data-href]');
    if (tr && !t.closest('a,button,input,select,summary')) { location.hash = tr.dataset.href; return; }
    var z = t.closest('img[data-zoom]');
    if (z) { var o = document.createElement('div'); o.className = 'zoom'; o.innerHTML = '<button type="button" aria-label="Close">×</button><img alt="' + esc(z.alt) + '" src="' + esc(z.src) + '">'; o.addEventListener('click', function (ev) { if (ev.target.tagName !== 'IMG') o.remove(); }); document.body.appendChild(o); return; }
    var tab = t.closest('[data-sheet]');
    if (tab) { var wrap = tab.closest('.sheets'); wrap.querySelectorAll('[data-sheet]').forEach(function (x) { x.classList.toggle('on', x === tab); }); wrap.querySelectorAll('.sheet-pane').forEach(function (p) { p.hidden = p.dataset.pane !== tab.dataset.sheet; }); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.nav) return;
    var q = Object.assign({}, ROUTE.q); q[t.dataset.nav] = t.type === 'checkbox' ? (t.checked ? '1' : '') : t.value;
    location.hash = href(ROUTE.app, ROUTE.view, ROUTE.arg, q);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var z = document.querySelector('.zoom'); if (z) z.remove(); else if (window.parent !== window) { try { window.parent.postMessage({ ffSystems: 'close' }, location.origin); } catch (er) {} } }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-href]')) { location.hash = e.target.dataset.href; }
  });

  // ------------------------------------------------------------------ boot
  function boot() {
    if (!DEMO) { fail('No demo was named. Open the systems from a demo page.'); return; }
    fetch(BASE + 'systems.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
      S = d; index();
      var app = ALIAS[qs.get('app')] || qs.get('app');
      if (!location.hash || location.hash.length < 3) {
        var start = APPS.some(function (a) { return a.id === app; }) ? app : 'ledgerwyn';
        var view = qs.get('app') === 'confirmations' ? 'documents' : '', arg = '';
        var want = (qs.get('file') || '').toLowerCase();
        if (want) { var hit = S.charterfold.documents.filter(function (d) { return d.name.toLowerCase() === want; })[0] || S.charterfold.documents.filter(function (d) { return want.indexOf(d.name.toLowerCase()) >= 0 || d.name.toLowerCase().indexOf(want) >= 0; })[0] || bestDoc(want); start = 'charterfold'; view = hit ? 'doc' : 'documents'; arg = hit ? hit.id : ''; }
        history.replaceState(null, '', location.pathname + location.search + href(start, view, arg));
      }
      route();
    }).catch(function (e) { fail('The client systems for this demo could not be loaded (' + esc(e.message) + ').'); });
  }
  // a document named loosely (e.g. the title on a replay close-up, "BPW-5188 · Bluepine Concrete Works"):
  // the file whose name and title share the most words with it, if most of the words match
  function bestDoc(want) {
    var words = function (s) { return (s || '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '').split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1; }); };
    var ws = words(want); if (!ws.length) return null;
    var best = null, top = 0;
    S.charterfold.documents.forEach(function (d) {
      var have = words(d.name + ' ' + (d.title || '')), n = 0;
      ws.forEach(function (w) { if (have.indexOf(w) >= 0) n++; });
      var sc = n / ws.length - have.length / 1000;
      if (sc > top) { top = sc; best = d; }
    });
    return top >= 0.6 ? best : null;
  }
  function fail(msg) { document.getElementById('app').innerHTML = '<div class="err card"><h1>Client systems</h1><p class="lead">' + msg + '</p></div>'; }
  function index() {
    var L = S.ledgerwyn;
    L.accounts.forEach(function (a) { ACC[a.no] = a; });
    GL = [];
    L.journals.forEach(function (j) { JIDX[j.id] = j; j.lines.forEach(function (l, i) { GL.push({ j: j, i: i, date: j.date, no: l.no, dr: l.dr || 0, cr: l.cr || 0, memo: l.memo || j.memo, job: l.job || '', ref: l.ref || j.ref || '' }); }); });
    (L.proposed || []).forEach(function (j) { JIDX[j.id] = j; });
    S.charterfold.documents.forEach(function (d) { DOCS[d.id] = d; });
    L.periods = Array.from(new Set(L.journals.map(function (j) { return (j.date || '').slice(0, 7); }).filter(Boolean))).sort();
    document.title = (S.company.name || 'Client') + ' · F1 Finance Client Systems';
  }
  window.addEventListener('hashchange', route);

  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?'), q = {};
    if (qi >= 0) { h.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeSafe(p.slice(1).join('=')); }); h = h.slice(0, qi); }
    var parts = h.split('/').map(decodeSafe);
    var app = ALIAS[parts[0]] || parts[0];
    if (!APPS.some(function (a) { return a.id === app; })) app = 'ledgerwyn';
    return { app: app, view: parts[1] || '', arg: parts.slice(2).join('/'), q: q };
  }
  var VIEWS = {};
  function route() {
    if (!S) return;
    ROUTE = parseRoute();
    TABLES = {}; TID = 0;
    var V = VIEWS[ROUTE.app];
    var subs = V.tabs();
    var view = ROUTE.view || subs[0][0];
    var html = '', after = null;
    try {
      var out = (V[view] || V[subs[0][0]])(ROUTE.arg, ROUTE.q);
      html = typeof out === 'string' ? out : out.html; after = out.after;
    } catch (e) { html = '<div class="card"><h2>This view could not be drawn</h2><p class="muted">' + esc(e.message) + '</p></div>'; if (window.console) console.warn(e); }
    var app = APPS.filter(function (a) { return a.id === ROUTE.app; })[0];
    document.getElementById('app').innerHTML =
      '<header class="top"><div class="top-row"><a class="brand" href="' + href(ROUTE.app) + '"><span class="mark">F1</span><span class="brand-text"><b>' + esc(app.name) + '</b><span>' + esc(app.purpose) + '</span></span></a>' +
      '<div class="top-co"><b>' + esc(S.company.name) + '</b><span>' + esc(S.run.period || '') + (S.run.period ? ' · ' : '') + 'F1 Finance ' + esc((S.product || '').replace(/^F1 Finance /, '')) + '</span></div></div>' +
      '<nav class="apps" aria-label="Client systems">' + APPS.map(function (a) { return '<a class="app-tab' + (a.id === ROUTE.app ? ' on' : '') + '" href="' + href(a.id) + '"' + (a.id === ROUTE.app ? ' aria-current="page"' : '') + '>' + ICONS[a.id] + '<span>' + esc(a.name) + '</span><small>' + esc(a.purpose) + '</small></a>'; }).join('') + '</nav>' +
      '<nav class="sub" aria-label="' + esc(app.name) + ' views">' + subs.map(function (s) { return '<a href="' + href(ROUTE.app, s[0]) + '" class="' + ((view === s[0] || (s[2] && s[2].indexOf(view) >= 0)) ? 'on' : '') + '">' + esc(s[1]) + '</a>'; }).join('') + '</nav></header>' +
      '<main id="main">' + html + '<p class="foot">Invented company and figures. A read-only view of the records behind one recorded F1 Finance run; nothing here is sent anywhere.</p></main>';
    Object.keys(TABLES).forEach(drawTable);
    if (after) after();
    window.scrollTo(0, 0);
  }
  function crumbs(items) { return '<div class="crumbs">' + items.map(function (x, i) { return i === items.length - 1 ? '<span>' + esc(x[0]) + '</span>' : '<a href="' + esc(x[1]) + '">' + esc(x[0]) + '</a><span aria-hidden="true">›</span>'; }).join(' ') + '</div>'; }
  function backLink(h, label) { return '<a class="back" href="' + esc(h) + '">‹ ' + esc(label || 'Back') + '</a>'; }
  function kpis(list) { return '<div class="kpis">' + list.map(function (k) { return '<div class="kpi">' + (k[2] ? '<a href="' + esc(k[2]) + '">' : '') + '<span>' + esc(k[0]) + '</span><b>' + k[1] + '</b>' + (k[2] ? '</a>' : '') + '</div>'; }).join('') + '</div>'; }

  // ================================================================== LEDGERWYN
  function balances(opts) {
    // opening + activity for a date range; journals mode
    var L = S.ledgerwyn, from = opts.from || '0000-00-00', to = opts.to || '9999-12-31';
    var rows = {};
    var get = function (no) { return rows[no] || (rows[no] = { no: no, open: 0, dr: 0, cr: 0, pdr: 0, pcr: 0 }); };
    if (L.opening) Object.keys(L.opening).forEach(function (no) { get(no).open = L.opening[no] || 0; });
    GL.forEach(function (l) { if (!l.date) return; var r = get(l.no); if (l.date < from) r.open += l.dr - l.cr; else if (l.date <= to) { r.dr += l.dr; r.cr += l.cr; } });
    if (opts.proposed) (L.proposed || []).forEach(function (j) { if (j.date && j.date > to) return; j.lines.forEach(function (l) { var r = get(l.no); r.pdr += l.dr || 0; r.pcr += l.cr || 0; }); });
    return Object.keys(rows).map(function (k) { var r = rows[k]; r.close = r.open + r.dr - r.cr; r.adj = r.close + r.pdr - r.pcr; return r; }).sort(function (a, b) { return a.no.localeCompare(b.no, 'en', { numeric: true }); });
  }
  function periodOptions(sel, allLabel) {
    var L = S.ledgerwyn;
    var o = '<option value="">' + esc(allLabel || 'Whole ledger') + '</option>';
    L.periods.forEach(function (p) { o += '<option value="' + p + '"' + (sel === p ? ' selected' : '') + '>' + monthLabel(p) + '</option>'; });
    return o;
  }
  function range(p) { if (!p) return {}; var y = +p.slice(0, 4), m = +p.slice(5, 7); var last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { from: p + '-01', to: p + '-' + String(last).padStart(2, '0') }; }
  function balCols() { var t = S.ledgerwyn.tb; return t ? t.cols.filter(function (c) { return c.kind === 'balance'; }) : []; }
  function mainBalCol() {
    var cols = balCols(); if (!cols.length) return null;
    var adj = cols.filter(function (c) { return /adjusted/i.test(c.label); })[0]; if (adj) return adj;
    var dated = cols.map(function (c) { return { c: c, t: Date.parse(c.label.replace(/^(balance|client trial balance,?|ledger balance)\s*/i, '')) }; }).filter(function (x) { return !isNaN(x.t); });
    if (dated.length) return dated.sort(function (a, b) { return b.t - a.t; })[0].c;
    return cols[0];
  }
  function glCount(no) { var n = 0; GL.forEach(function (l) { if (l.no === no) n++; }); return n; }

  VIEWS.ledgerwyn = {
    tabs: function () {
      var t = [['overview', 'Overview'], ['accounts', 'Chart of Accounts'], ['tb', 'Trial Balance'], ['gl', 'General Ledger'], ['journals', 'Journal Entries', ['journal']], ['reports', 'Reports'], ['ties', 'Tie-Outs']];
      return t;
    },
    overview: function () {
      var L = S.ledgerwyn;
      var dr = 0; GL.forEach(function (l) { dr += l.dr; });
      var k = [['Accounts', L.accounts.length.toLocaleString(), href('ledgerwyn', 'accounts')], ['Journal entries', L.journals.length.toLocaleString() + (L.proposed && L.proposed.length ? ' <small class="muted">+ ' + L.proposed.length + ' proposed</small>' : ''), href('ledgerwyn', 'journals')], ['Ledger lines', GL.length.toLocaleString(), href('ledgerwyn', 'gl')], ['Debits posted', usd(dr), href('ledgerwyn', 'tb')]];
      var other = L.entity && L.entity !== S.company.name;
      var html = '<h1>' + esc(L.entity || S.company.name) + ' ledger</h1>' + (other ? '<p class="note">' + esc((L.basis || []).slice(-1)[0] || ('Books of ' + L.entity + '.')) + '</p>' : '') + '<p class="lead">' + esc(L.mode === 'journals' ? (L.opening ? 'Posted journals roll forward from the opening balances; every report here is computed from them.' : 'The ledger extract this run worked from. Balances here are the activity of the posted journals.') : 'The client\'s trial balance with the general ledger detail behind it.') + '</p>' + kpis(k);
      var ok = L.ties.filter(function (t) { return t.ok; }).length;
      html += '<div class="grid side"><div>';
      if (L.periods.length) {
        var by = {}; GL.forEach(function (l) { var p = (l.date || '').slice(0, 7); by[p] = by[p] || { dr: 0, n: 0, j: {} }; by[p].dr += l.dr; by[p].n++; by[p].j[l.j.id] = 1; });
        html += table({ title: 'Activity by month', search: false, noun: 'month', cols: [
          { label: 'Month', csv: function (r) { return monthLabel(r); }, val: function (r) { return r; } },
          { label: 'Journals', num: true, html: function (r) { return Object.keys(by[r].j).length.toLocaleString(); }, val: function (r) { return Object.keys(by[r].j).length; } },
          { label: 'Lines', num: true, html: function (r) { return by[r].n.toLocaleString(); }, val: function (r) { return by[r].n; } },
          { label: 'Debits', num: true, html: function (r) { return money(by[r].dr); }, val: function (r) { return by[r].dr; }, csv: function (r) { return by[r].dr.toFixed(2); } }
        ], rows: L.periods, href: function (r) { return href('ledgerwyn', 'tb', '', { period: L.mode === 'journals' ? r : '' }); }, csv: DEMO + '-activity-by-month' });
      }
      html += '</div><div><div class="card"><h2>Where these books come from</h2><ul class="small" style="margin:0;padding-left:18px">' + L.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
        (L.tb ? '<p class="small muted" style="margin:10px 0 0">Trial balance: ' + esc(L.tb.file || L.tb.source) + '</p>' : '') +
        (L.notes || []).map(function (n) { return '<p class="note" style="margin:10px 0 0">' + esc(n) + '</p>'; }).join('') + '</div>' +
        '<div class="card"><h2>Tie-outs</h2><p class="small">' + ok + ' of ' + L.ties.length + ' agree. ' + '<a href="' + href('ledgerwyn', 'ties') + '">See each one</a></p>' +
        (L.complete ? '<p class="small" style="margin:0"><a href="' + href('ledgerwyn', 'reports', 'bs') + '">Balance sheet</a> · <a href="' + href('ledgerwyn', 'reports', 'is') + '">Income statement</a></p>' : '') + '</div></div></div>';
      return html;
    },
    accounts: function () {
      var L = S.ledgerwyn;
      return '<h1>Chart of accounts</h1><p class="lead">' + plural(L.accounts.length, 'account') + ' in use. Choose one to see its ledger lines.</p>' + table({
        cols: [
          { label: 'Account', csv: function (a) { return a.no; }, html: function (a) { return '<span class="mono">' + esc(a.no) + '</span>'; } },
          { label: 'Name', csv: function (a) { return a.name; } },
          { label: 'Type', csv: function (a) { return a.type; } },
          { label: 'Normal balance', csv: function (a) { return a.normal === 'debit' ? 'Debit' : 'Credit'; } },
          { label: 'Statement', csv: function (a) { return a.statement; } },
          { label: 'Ledger lines', num: true, val: function (a) { return glCount(a.no); }, html: function (a) { return glCount(a.no).toLocaleString(); }, csv: function (a) { return glCount(a.no); } }
        ], rows: L.accounts, href: function (a) { return href('ledgerwyn', 'gl', '', { acct: a.no }); }, csv: DEMO + '-chart-of-accounts', noun: 'account', placeholder: 'Search accounts'
      });
    },
    tb: function (arg, q) {
      var L = S.ledgerwyn;
      var html = '<h1>Trial balance</h1>';
      if (L.mode === 'journals') {
        var per = q.period || '', rg = range(per), withP = q.proposed === '1' && L.proposed && L.proposed.length;
        var rows = balances({ from: rg.from, to: rg.to, proposed: withP });
        var client = null, ccol = null;
        if (L.tb && !per) { ccol = L.tb.cols.filter(function (c) { return c.kind === 'balance' && !/^ledger balance/i.test(c.label); }).slice(-1)[0] || null; if (ccol) { client = {}; L.tb.rows.forEach(function (r) { client[r.no] = r.v[ccol.key]; }); } else client = null; }
        html += '<p class="lead">' + (per ? monthLabel(per) + ': balances brought forward, the month\'s postings and the closing balance.' : (L.opening ? 'Opening balances, every posted journal and the closing balance.' : 'Every posted journal in the ledger extract, by account.')) + ' Choose an account to see its lines.</p>';
        var cols = [
          { label: 'Account', csv: function (r) { return r.no; }, html: function (r) { return '<span class="mono">' + esc(r.no) + '</span>'; } },
          { label: 'Name', csv: function (r) { return acctName(r.no); } },
          { label: per ? 'Brought forward' : (L.opening ? 'Opening' : 'Opening'), num: true, val: function (r) { return r.open; }, html: function (r) { return money(r.open, true); }, csv: function (r) { return r.open.toFixed(2); } },
          { label: 'Debits', num: true, val: function (r) { return r.dr; }, html: function (r) { return money(r.dr, true); }, csv: function (r) { return r.dr.toFixed(2); } },
          { label: 'Credits', num: true, val: function (r) { return r.cr; }, html: function (r) { return money(r.cr, true); }, csv: function (r) { return r.cr.toFixed(2); } },
          { label: 'Closing', num: true, val: function (r) { return r.close; }, html: function (r) { return money(r.close, true); }, csv: function (r) { return r.close.toFixed(2); } }
        ];
        if (withP) cols.push({ label: 'Proposed', num: true, val: function (r) { return r.pdr - r.pcr; }, html: function (r) { return money(r.pdr - r.pcr, true); }, csv: function (r) { return (r.pdr - r.pcr).toFixed(2); } }, { label: 'Adjusted', num: true, val: function (r) { return r.adj; }, html: function (r) { return money(r.adj, true); }, csv: function (r) { return r.adj.toFixed(2); } });
        if (client) cols.push({ label: ccol.label, num: true, val: function (r) { return client[r.no]; }, html: function (r) { return client[r.no] === undefined || client[r.no] === null ? '' : money(client[r.no], true); }, csv: function (r) { return client[r.no] === undefined || client[r.no] === null ? '' : client[r.no].toFixed(2); } },
          { label: 'Difference', num: true, val: function (r) { return client[r.no] === undefined || client[r.no] === null ? null : r.close - client[r.no]; }, html: function (r) { if (client[r.no] === undefined || client[r.no] === null) return ''; var d = r.close - client[r.no]; return Math.abs(d) < 0.005 ? badge('Agrees', 'pass') : '<span style="color:var(--bad)">' + money(d) + '</span>'; }, csv: function (r) { return client[r.no] === undefined || client[r.no] === null ? '' : (r.close - client[r.no]).toFixed(2); } });
        var tools = '<label class="field">Period <select data-nav="period">' + periodOptions(per) + '</select></label>' + (L.proposed && L.proposed.length ? '<label class="check"><input type="checkbox" data-nav="proposed"' + (withP ? ' checked' : '') + '> Include ' + plural(L.proposed.length, 'proposed entry').replace('entrys', 'entries') + '</label>' : '');
        html += table({ cols: cols, rows: rows, tools: tools, noun: 'account', placeholder: 'Search accounts', csv: DEMO + '-trial-balance' + (per ? '-' + per : ''), href: function (r) { return href('ledgerwyn', 'gl', '', { acct: r.no, period: per }); },
          foot: function (rs) { var t = { open: 0, dr: 0, cr: 0, close: 0, p: 0, adj: 0, c: 0 }; rs.forEach(function (r) { t.open += r.open; t.dr += r.dr; t.cr += r.cr; t.close += r.close; t.p += r.pdr - r.pcr; t.adj += r.adj; if (client && client[r.no] !== undefined && client[r.no] !== null) t.c += client[r.no]; }); return '<tr><td></td><td>Totals' + (Math.abs(t.close) < 0.005 && Math.abs(t.dr - t.cr) < 0.005 ? ' ' + badge('Foots', 'pass') : '') + '</td><td class="num">' + money(t.open) + '</td><td class="num">' + money(t.dr) + '</td><td class="num">' + money(t.cr) + '</td><td class="num">' + money(t.close) + '</td>' + (withP ? '<td class="num">' + money(t.p) + '</td><td class="num">' + money(t.adj) + '</td>' : '') + (client ? '<td class="num">' + money(t.c) + '</td><td></td>' : '') + '</tr>'; } });
      } else {
        var T = L.tb;
        html += '<p class="lead">' + esc(T.file ? 'From ' + T.file + '.' : '') + ' Choose an account to see the ledger lines behind it.</p>';
        var cols2 = [
          { label: 'Account', csv: function (r) { return r.no; }, html: function (r) { return '<span class="mono">' + esc(r.no) + '</span>'; } },
          { label: 'Name', csv: function (r) { return acctName(r.no); } },
          { label: 'Type', csv: function (r) { return ACC[r.no] ? ACC[r.no].type : ''; } }
        ].concat(T.cols.map(function (c) { return { label: c.label, num: true, val: function (r) { return r.v[c.key]; }, html: function (r) { return money(r.v[c.key], true); }, csv: function (r) { return r.v[c.key] === null || r.v[c.key] === undefined ? '' : r.v[c.key].toFixed(2); } }; }))
          .concat([{ label: 'GL lines', num: true, val: function (r) { return glCount(r.no); }, html: function (r) { var n = glCount(r.no); return n ? n.toLocaleString() : '<span class="muted">–</span>'; } }]);
        html += table({ cols: cols2, rows: T.rows, noun: 'account', placeholder: 'Search accounts', csv: DEMO + '-trial-balance', href: function (r) { return href('ledgerwyn', 'gl', '', { acct: r.no }); },
          foot: function (rs) { return '<tr><td></td><td>Totals</td><td></td>' + T.cols.map(function (c) { var s = 0; rs.forEach(function (r) { s += r.v[c.key] || 0; }); return '<td class="num">' + money(s) + (c.kind === 'balance' && Math.abs(s) < 0.005 && rs.length === T.rows.length ? ' ' + badge('Foots', 'pass') : '') + '</td>'; }).join('') + '<td></td></tr>'; } });
        if (L.proposed && L.proposed.length) html += '<p class="note">' + plural(L.proposed.length, 'proposed entry').replace('entrys', 'entries') + ' from this run are not in these balances. <a href="' + href('ledgerwyn', 'journals', '', { status: 'Proposed' }) + '">Review them</a>.</p>';
      }
      return html;
    },
    gl: function (arg, q) {
      var L = S.ledgerwyn, acct = q.acct || '', per = q.period || '', rg = range(per);
      var rows = GL.filter(function (l) { return (!acct || l.no === acct) && (!per || (l.date >= rg.from && l.date <= rg.to)); });
      rows.sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || a.j.id.localeCompare(b.j.id) || a.i - b.i; });
      var run = null;
      if (acct) {
        var start = 0;
        if (L.mode === 'journals') { start = (L.opening && L.opening[acct]) || 0; if (per) GL.forEach(function (l) { if (l.no === acct && l.date < rg.from) start += l.dr - l.cr; }); }
        var bal = start; run = new Map(); rows.forEach(function (l) { bal += l.dr - l.cr; run.set(l, bal); });
      }
      var html = crumbs([['Ledger', href('ledgerwyn')], ['General ledger', href('ledgerwyn', 'gl')]].concat(acct ? [[acct + ' ' + acctName(acct), '']] : []));
      html += '<h1>' + (acct ? esc(acct + ' · ' + acctName(acct)) : 'General ledger') + '</h1>';
      if (acct && L.tb) { var tr = L.tb.rows.filter(function (r) { return r.no === acct; })[0]; if (tr) html += '<p class="lead">' + L.tb.cols.map(function (c) { return esc(c.label) + ': <b>' + usd(tr.v[c.key]) + '</b>'; }).join(' · ') + '</p>'; }
      if (acct && L.mode === 'journals') html += '<p class="lead">Balance brought forward ' + usd(run.size ? run.values().next().value - (rows[0].dr - rows[0].cr) : start) + ' · closing ' + usd(rows.length ? run.get(rows[rows.length - 1]) : start) + '</p>';
      var acctSel = '<label class="field">Account <select data-nav="acct"><option value="">All accounts</option>' + L.accounts.map(function (a) { return '<option value="' + esc(a.no) + '"' + (a.no === acct ? ' selected' : '') + '>' + esc(a.no + ' ' + a.name) + '</option>'; }).join('') + '</select></label>';
      var perSel = L.periods.length > 1 ? '<label class="field">Period <select data-nav="period">' + periodOptions(per, 'All periods') + '</select></label>' : '';
      var cols = [
        { label: 'Date', val: function (l) { return l.date; }, html: function (l) { return '<span class="nowrap">' + date(l.date) + '</span>'; }, csv: function (l) { return l.date; } },
        { label: 'Journal', val: function (l) { return l.j.id; }, html: function (l) { return '<a class="mono" href="' + esc(href('ledgerwyn', 'journal', l.j.id)) + '">' + esc(l.j.id) + '</a>'; }, csv: function (l) { return l.j.id; }, noLink: true },
        { label: 'Account', val: function (l) { return l.no; }, html: function (l) { return '<a class="mono" href="' + esc(href('ledgerwyn', 'gl', '', { acct: l.no, period: per })) + '">' + esc(l.no) + '</a><span class="sub-l">' + esc(acctName(l.no)) + '</span>'; }, csv: function (l) { return l.no + ' ' + acctName(l.no); } },
        { label: 'Description', html: function (l) { return esc(l.memo) + (l.ref ? '<span class="sub-l">Ref ' + esc(l.ref) + '</span>' : ''); }, csv: function (l) { return l.memo; }, wrap: true },
        { label: 'Job', csv: function (l) { return l.job; } },
        { label: 'Debit', num: true, val: function (l) { return l.dr; }, html: function (l) { return money(l.dr, true); }, csv: function (l) { return l.dr ? l.dr.toFixed(2) : ''; } },
        { label: 'Credit', num: true, val: function (l) { return l.cr; }, html: function (l) { return money(l.cr, true); }, csv: function (l) { return l.cr ? l.cr.toFixed(2) : ''; } }
      ];
      if (acct) cols.splice(2, 1);
      if (run) cols.push({ label: 'Balance', num: true, sort: false, html: function (l) { return money(run.get(l)); }, csv: function (l) { return run.get(l).toFixed(2); } });
      if (!rows.some(function (l) { return l.job; })) cols = cols.filter(function (c) { return c.label !== 'Job'; });
      html += table({ cols: cols, rows: rows, tools: acctSel + perSel, csv: DEMO + '-general-ledger' + (acct ? '-' + acct : '') + (per ? '-' + per : ''), href: function (l) { return href('ledgerwyn', 'journal', l.j.id); }, noun: 'line', placeholder: 'Search description, journal or reference', limit: 200,
        text: function (l) { return [l.j.id, l.no, acctName(l.no), l.memo, l.ref, l.job, l.dr, l.cr].join(' '); },
        foot: function (rs) { var d = 0, c = 0; rs.forEach(function (l) { d += l.dr; c += l.cr; }); var n = cols.length; var lead = n - (run ? 3 : 2); return '<tr><td colspan="' + lead + '">Totals for these lines</td><td class="num">' + money(d) + '</td><td class="num">' + money(c) + '</td>' + (run ? '<td></td>' : '') + '</tr>'; },
        empty: acct && !rows.length ? 'This account has no ledger lines in the extract; its balance comes from the trial balance.' : 'No lines match.' });
      return html;
    },
    journals: function (arg, q) {
      var L = S.ledgerwyn, status = q.status || '', per = q.period || '';
      var all = L.journals.concat(L.proposed || []);
      var rows = all.filter(function (j) { return (!status || j.status === status) && (!per || (j.date || '').slice(0, 7) === per); });
      var tot = function (j) { var s = 0; j.lines.forEach(function (l) { s += l.dr || 0; }); return s; };
      var html = '<h1>Journal entries</h1><p class="lead">' + plural(L.journals.length, 'posted entry').replace('entrys', 'entries') + (L.proposed && L.proposed.length ? ' and ' + plural(L.proposed.length, 'proposed entry').replace('entrys', 'entries') + ' from this run (not posted)' : '') + '.</p>';
      var chips = '<div class="chips">' + [['', 'All', all.length], ['Posted', 'Posted', L.journals.length]].concat(L.proposed && L.proposed.length ? [['Proposed', 'Proposed', L.proposed.length]] : []).map(function (c) { return '<a class="chip' + (status === c[0] ? ' on' : '') + '" href="' + href('ledgerwyn', 'journals', '', { status: c[0], period: per }) + '">' + c[1] + '<b>' + c[2].toLocaleString() + '</b></a>'; }).join('') + '</div>';
      html += table({ tools: chips + (L.periods.length > 1 ? '<label class="field">Period <select data-nav="period">' + periodOptions(per, 'All periods') + '</select></label>' : ''), cols: [
        { label: 'Journal', csv: function (j) { return j.id; }, html: function (j) { return '<span class="mono">' + esc(j.id) + '</span>'; } },
        { label: 'Date', val: function (j) { return j.date; }, html: function (j) { return '<span class="nowrap">' + date(j.date) + '</span>'; }, csv: function (j) { return j.date; } },
        { label: 'Description', csv: function (j) { return j.memo; }, html: function (j) { return esc(j.memo) + (j.ref ? '<span class="sub-l">Ref ' + esc(j.ref) + '</span>' : ''); }, wrap: true },
        { label: 'Source', csv: function (j) { return j.source || ''; } },
        { label: 'Status', csv: function (j) { return j.status; }, html: function (j) { return badge(j.status, j.status === 'Posted' ? 'posted' : 'proposed'); } },
        { label: 'Lines', num: true, val: function (j) { return j.lines.length; }, html: function (j) { return j.lines.length; } },
        { label: 'Amount', num: true, val: tot, html: function (j) { return money(tot(j)); }, csv: function (j) { return tot(j).toFixed(2); } }
      ], rows: rows, href: function (j) { return href('ledgerwyn', 'journal', j.id); }, csv: DEMO + '-journal-entries', noun: 'entry', placeholder: 'Search journals', limit: 200,
        text: function (j) { return [j.id, j.memo, j.ref, j.source, j.status, j.by].concat(j.lines.map(function (l) { return l.no + ' ' + acctName(l.no) + ' ' + (l.memo || ''); })).join(' '); } });
      return html;
    },
    journal: function (id) {
      var j = JIDX[id];
      if (!j) return '<div class="card"><h2>Journal not found</h2><p><a href="' + href('ledgerwyn', 'journals') + '">All journal entries</a></p></div>';
      var d = 0, c = 0; j.lines.forEach(function (l) { d += l.dr || 0; c += l.cr || 0; });
      var bills = S.vellumrow.bills.filter(function (b) { return b.je === j.id; });
      var html = crumbs([['Ledger', href('ledgerwyn')], ['Journal entries', href('ledgerwyn', 'journals')], [j.id, '']]);
      html += '<h1>' + esc(j.id) + ' ' + badge(j.status, j.status === 'Posted' ? 'posted' : 'proposed') + '</h1><p class="lead">' + esc(j.memo) + '</p>';
      html += '<div class="grid side"><div>' + table({ search: false, cols: [
        { label: 'Account', csv: function (l) { return l.no; }, html: function (l) { return '<a class="mono" href="' + esc(href('ledgerwyn', 'gl', '', { acct: l.no })) + '">' + esc(l.no) + '</a>'; }, noLink: true },
        { label: 'Name', csv: function (l) { return acctName(l.no); } },
        { label: 'Description', csv: function (l) { return (l.memo || '') + (l.support ? ' (support: ' + l.support + ')' : ''); }, wrap: true },
        { label: 'Job', csv: function (l) { return [l.job, l.cost].filter(Boolean).join(' / '); } },
        { label: 'Debit', num: true, val: function (l) { return l.dr; }, html: function (l) { return money(l.dr, true); }, csv: function (l) { return l.dr ? l.dr.toFixed(2) : ''; } },
        { label: 'Credit', num: true, val: function (l) { return l.cr; }, html: function (l) { return money(l.cr, true); }, csv: function (l) { return l.cr ? l.cr.toFixed(2) : ''; } }
      ], rows: j.lines, csv: DEMO + '-' + j.id, noun: 'line', foot: function () { return '<tr><td colspan="4">Totals ' + (Math.abs(d - c) < 0.005 ? badge('Balanced', 'pass') : badge('Out of balance by ' + usd(d - c), 'fail')) + '</td><td class="num">' + money(d) + '</td><td class="num">' + money(c) + '</td></tr>'; } }) + '</div>';
      html += '<div><div class="card"><dl class="dl" style="grid-template-columns:1fr">' +
        '<div><dt>Date</dt><dd>' + date(j.date) + '</dd></div>' + (j.ref ? '<div><dt>Reference</dt><dd>' + esc(j.ref) + '</dd></div>' : '') + (j.source ? '<div><dt>Source</dt><dd>' + esc(j.source) + '</dd></div>' : '') + (j.by ? '<div><dt>Entered by</dt><dd>' + esc(j.by) + '</dd></div>' : '') +
        '<div><dt>Status</dt><dd>' + esc(j.status === 'Posted' ? 'Posted to the ledger' : 'Proposed by this run. A person decides; nothing is posted.') + '</dd></div></dl></div>' +
        (bills.length ? '<div class="card"><h3>Vendor bill</h3>' + bills.map(function (b) { return '<p class="small" style="margin:0 0 6px"><a href="' + href('vellumrow', 'bill', b.id) + '">' + esc(b.vendor + ' ' + b.number) + '</a> · ' + usd(b.amount) + ' ' + badge(b.status, statusKind(b.status)) + '</p>'; }).join('') + '</div>' : '') +
        '</div></div>';
      return html;
    },
    reports: function (arg, q) {
      var L = S.ledgerwyn;
      var tabs = [];
      if (L.complete) tabs.push(['bs', 'Balance sheet'], ['is', 'Income statement']);
      if (L.aging && L.aging.ap) tabs.push(['ap', 'AP aging']);
      if (L.aging && L.aging.ar) tabs.push(['ar', 'AR aging']);
      tabs.push(['activity', 'Account activity']);
      var cur = tabs.some(function (t) { return t[0] === arg; }) ? arg : tabs[0][0];
      var html = '<h1>Reports</h1><div class="chips" style="margin:0 0 14px">' + tabs.map(function (t) { return '<a class="chip' + (t[0] === cur ? ' on' : '') + '" href="' + href('ledgerwyn', 'reports', t[0], q.period ? { period: q.period } : null) + '">' + t[1] + '</a>'; }).join('') + '</div>';
      if (!L.complete) html += '<p class="note">These books are an extract of the accounts this run worked on, so a balance sheet and income statement would not be complete. The account activity report shows what the extract holds.</p>';
      if (cur === 'bs' || cur === 'is') html += statement(cur, q);
      else if (cur === 'ap' || cur === 'ar') html += aging(cur);
      else html += activity(q);
      return html;
    },
    ties: function () {
      var L = S.ledgerwyn;
      var html = '<h1>Tie-outs</h1><p class="lead">Checks that the books agree with themselves and with the client\'s own reports. Worked out when this dataset was built from the recorded run.</p>';
      html += '<div class="card flush">' + (L.ties.length ? L.ties.map(function (t) {
        return '<div class="check-row"><span class="dot ' + (t.ok ? 'pass' : 'fail') + '">' + (t.ok ? '✓' : '!') + '</span><div class="grow"><div class="t">' + esc(t.title) + '</div>' +
          (t.left !== undefined && t.left !== null ? '<div class="v">Ledger ' + usd(t.left) + ' · other record ' + usd(t.right) + ' · difference ' + usd(t.diff || 0) + '</div>' : (!t.ok && t.diff ? '<div class="v">Difference: ' + esc(typeof t.diff === 'number' ? usd(t.diff) : t.diff) + '</div>' : '')) +
          (t.detail ? '<div class="d">' + esc(t.detail) + '</div>' : '') + '</div>' + badge(t.ok ? 'Agrees' : 'Differs', t.ok ? 'pass' : 'fail') + '</div>';
      }).join('') : '<div class="empty">No tie-outs for this extract.</div>') + '</div>';
      return html;
    }
  };
  function closingFor(q) {
    var L = S.ledgerwyn, map = {}, label;
    if (L.mode === 'journals') { var per = q.period || '', rg = range(per); balances({ to: rg.to }).forEach(function (r) { map[r.no] = r.close; }); label = per ? 'As of ' + date(rg.to) : 'As of ' + date(S.ledgerwyn.journals.length ? S.ledgerwyn.journals[S.ledgerwyn.journals.length - 1].date : S.run.periodEnd); }
    else { var c = L.tb.cols.filter(function (x) { return x.key === q.col; })[0] || mainBalCol(); L.tb.rows.forEach(function (r) { map[r.no] = r.v[c.key] || 0; }); label = c.label; }
    return { map: map, label: label };
  }
  function statement(kind, q) {
    var L = S.ledgerwyn, cl = closingFor(q), m = cl.map;
    var by = function (types) { return L.accounts.filter(function (a) { return types.indexOf(a.type) >= 0 && Math.abs(m[a.no] || 0) >= 0.005; }); };
    var sum = function (list, sign) { var s = 0; list.forEach(function (a) { s += (m[a.no] || 0) * sign; }); return s; };
    var line = function (a, sign) { return '<tr><td class="ind"><a href="' + href('ledgerwyn', 'gl', '', { acct: a.no }) + '"><span class="mono">' + esc(a.no) + '</span> ' + esc(a.name) + '</a></td><td class="num">' + money((m[a.no] || 0) * sign) + '</td></tr>'; };
    var sel = '';
    if (L.mode === 'journals' && L.periods.length > 1) sel = '<label class="field">As of <select data-nav="period"><option value="">End of ledger</option>' + L.periods.map(function (p) { return '<option value="' + p + '"' + (q.period === p ? ' selected' : '') + '>' + monthLabel(p) + '</option>'; }).join('') + '</select></label>';
    else if (L.mode !== 'journals' && balCols().length > 1) sel = '<label class="field">Column <select data-nav="col">' + balCols().map(function (c) { return '<option value="' + c.key + '"' + ((q.col || mainBalCol().key) === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('') + '</select></label>';
    var ni = -sum(by(['Revenue', 'Other Income', 'Cost of Sales', 'Expense', 'Other Expense', 'Income Tax']), 1);
    var html = '<div class="card flush"><div class="card-h"><h2 class="grow">' + (kind === 'bs' ? 'Balance sheet' : 'Income statement') + '</h2><span class="muted small">' + esc(cl.label) + '</span>' + sel + '<button type="button" class="btn" onclick="window.print()">Print</button></div><div class="tw"><table class="statement"><tbody>';
    if (kind === 'bs') {
      var as = by(['Asset']), li = by(['Liability']), eq = by(['Equity']);
      var ta = sum(as, 1), tl = sum(li, -1), te = sum(eq, -1) + ni;
      html += '<tr class="h"><td colspan="2">Assets</td></tr>' + as.map(function (a) { return line(a, 1); }).join('') + '<tr class="t"><td>Total assets</td><td class="num">' + money(ta) + '</td></tr>';
      html += '<tr class="h"><td colspan="2">Liabilities</td></tr>' + li.map(function (a) { return line(a, -1); }).join('') + '<tr class="t"><td>Total liabilities</td><td class="num">' + money(tl) + '</td></tr>';
      html += '<tr class="h"><td colspan="2">Equity</td></tr>' + eq.map(function (a) { return line(a, -1); }).join('') + (Math.abs(ni) >= 0.005 ? '<tr><td class="ind">Net income for the period (from the income statement)</td><td class="num">' + money(ni) + '</td></tr>' : '') + '<tr class="t"><td>Total equity</td><td class="num">' + money(te) + '</td></tr>';
      html += '<tr class="gt"><td>Total liabilities and equity ' + (Math.abs(ta - tl - te) < 0.01 ? badge('Equals total assets', 'pass') : badge('Off by ' + usd(ta - tl - te), 'fail')) + '</td><td class="num">' + money(tl + te) + '</td></tr>';
    } else {
      var rv = by(['Revenue']), cs = by(['Cost of Sales']), ex = by(['Expense']), oi = by(['Other Income']), oe = by(['Other Expense']), tx = by(['Income Tax']);
      var tr = sum(rv, -1), tc = sum(cs, 1), te2 = sum(ex, 1), to = sum(oi, -1) - sum(oe, 1), tt = sum(tx, 1);
      html += '<tr class="h"><td colspan="2">Revenue</td></tr>' + rv.map(function (a) { return line(a, -1); }).join('') + '<tr class="t"><td>Total revenue</td><td class="num">' + money(tr) + '</td></tr>';
      if (cs.length) html += '<tr class="h"><td colspan="2">Cost of revenue</td></tr>' + cs.map(function (a) { return line(a, 1); }).join('') + '<tr class="t"><td>Gross profit</td><td class="num">' + money(tr - tc) + '</td></tr>';
      if (ex.length) html += '<tr class="h"><td colspan="2">Operating expenses</td></tr>' + ex.map(function (a) { return line(a, 1); }).join('') + '<tr class="t"><td>Operating income</td><td class="num">' + money(tr - tc - te2) + '</td></tr>';
      if (oi.length || oe.length) html += '<tr class="h"><td colspan="2">Other income and expense</td></tr>' + oi.map(function (a) { return line(a, -1); }).join('') + oe.map(function (a) { return line(a, 1); }).join('');
      if (tx.length) html += '<tr class="h"><td colspan="2">Income tax</td></tr>' + tx.map(function (a) { return line(a, 1); }).join('');
      html += '<tr class="gt"><td>Net income</td><td class="num">' + money(tr - tc - te2 + to - tt) + '</td></tr>';
    }
    return html + '</tbody></table></div></div>';
  }
  function aging(kind) {
    var A = S.ledgerwyn.aging[kind], B = ['Current', '1-30', '31-60', '61-90', 'Over 90'];
    var by = {}; A.rows.forEach(function (r) { var p = by[r.party] = by[r.party] || { party: r.party, t: 0 }; p[r.bucket] = (p[r.bucket] || 0) + r.amount; p.t += r.amount; });
    var parties = Object.keys(by).map(function (k) { return by[k]; });
    var cols = [{ label: kind === 'ap' ? 'Vendor' : 'Customer', csv: function (p) { return p.party; } }].concat(B.map(function (b) { return { label: b, num: true, val: function (p) { return p[b] || 0; }, html: function (p) { return money(p[b] || 0, true); }, csv: function (p) { return (p[b] || 0).toFixed(2); } }; })).concat([{ label: 'Total', num: true, val: function (p) { return p.t; }, html: function (p) { return '<b>' + money(p.t) + '</b>'; }, csv: function (p) { return p.t.toFixed(2); } }]);
    var html = '<p class="lead">' + (kind === 'ap' ? 'Unpaid vendor bills' : 'Open customer invoices') + (A.asOf ? ' as of ' + date(A.asOf) : '') + ', from ' + esc(A.file || A.source) + '.</p>';
    html += table({ title: 'Summary', cols: cols, rows: parties, sort: { c: B.length + 1, dir: -1 }, csv: DEMO + '-' + kind + '-aging-summary', noun: kind === 'ap' ? 'vendor' : 'customer',
      foot: function (rs) { var t = { t: 0 }; rs.forEach(function (p) { B.forEach(function (b) { t[b] = (t[b] || 0) + (p[b] || 0); }); t.t += p.t; }); return '<tr><td>Total</td>' + B.map(function (b) { return '<td class="num">' + money(t[b] || 0) + '</td>'; }).join('') + '<td class="num">' + money(t.t) + '</td></tr>'; } });
    html += table({ title: 'Detail', cols: [
      { label: kind === 'ap' ? 'Vendor' : 'Customer', csv: function (r) { return r.party; } },
      { label: 'Invoice', csv: function (r) { return r.ref; } },
      { label: 'Invoice date', val: function (r) { return r.date; }, html: function (r) { return date(r.date); }, csv: function (r) { return r.date || ''; } },
      { label: 'Due', val: function (r) { return r.due; }, html: function (r) { return date(r.due); }, csv: function (r) { return r.due || ''; } },
      { label: 'Job', csv: function (r) { return r.job; } },
      { label: 'Bucket', csv: function (r) { return r.bucket; } },
      { label: 'Amount', num: true, val: function (r) { return r.amount; }, html: function (r) { return money(r.amount); }, csv: function (r) { return r.amount.toFixed(2); } }
    ], rows: A.rows, csv: DEMO + '-' + kind + '-aging-detail', noun: 'invoice', href: kind === 'ap' ? function (r) { var b = S.vellumrow.bills.filter(function (x) { return x.number === r.ref; })[0]; return b ? href('vellumrow', 'bill', b.id) : null; } : null });
    return html;
  }
  function activity(q) {
    var L = S.ledgerwyn, per = q.period || '', rg = range(per);
    var rows = L.mode === 'journals' ? balances({ from: rg.from, to: rg.to }) : L.accounts.map(function (a) { var r = { no: a.no, dr: 0, cr: 0 }; GL.forEach(function (l) { if (l.no === a.no) { r.dr += l.dr; r.cr += l.cr; } }); return r; });
    rows = rows.filter(function (r) { return r.dr || r.cr; });
    return table({ title: 'Account activity' + (per ? ', ' + monthLabel(per) : ''), tools: L.mode === 'journals' && L.periods.length > 1 ? '<label class="field">Period <select data-nav="period">' + periodOptions(per, 'Whole ledger') + '</select></label>' : '', cols: [
      { label: 'Account', csv: function (r) { return r.no; }, html: function (r) { return '<span class="mono">' + esc(r.no) + '</span>'; } },
      { label: 'Name', csv: function (r) { return acctName(r.no); } },
      { label: 'Type', csv: function (r) { return ACC[r.no] ? ACC[r.no].type : ''; } },
      { label: 'Debits', num: true, val: function (r) { return r.dr; }, html: function (r) { return money(r.dr, true); }, csv: function (r) { return r.dr.toFixed(2); } },
      { label: 'Credits', num: true, val: function (r) { return r.cr; }, html: function (r) { return money(r.cr, true); }, csv: function (r) { return r.cr.toFixed(2); } },
      { label: 'Net', num: true, val: function (r) { return r.dr - r.cr; }, html: function (r) { return money(r.dr - r.cr); }, csv: function (r) { return (r.dr - r.cr).toFixed(2); } }
    ], rows: rows, csv: DEMO + '-account-activity', noun: 'account', href: function (r) { return href('ledgerwyn', 'gl', '', { acct: r.no, period: per }); },
      foot: function (rs) { var d = 0, c = 0; rs.forEach(function (r) { d += r.dr; c += r.cr; }); return '<tr><td></td><td>Totals</td><td></td><td class="num">' + money(d) + '</td><td class="num">' + money(c) + '</td><td class="num">' + money(d - c) + '</td></tr>'; } });
  }

  // ================================================================== DOCUMENT VIEWER (shared)
  function docView(app, id, backHref, backLabel) {
    var d = DOCS[id];
    if (!d) return '<div class="card"><h2>Document not found</h2><p><a href="' + esc(backHref) + '">Back</a></p></div>';
    var p = d.preview;
    var html = crumbs([[backLabel, backHref], [d.name, '']]);
    html += '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">' + docIco(d) + '<div style="min-width:0;flex:1"><h1 style="overflow-wrap:anywhere">' + esc(d.title || d.name) + '</h1><p class="muted small" style="margin:0">' + esc([d.type, d.pageCount ? plural(d.pageCount, 'page') : '', size(d.size), d.folder].filter(Boolean).join(' · ')) + '</p></div>' +
      (d.url ? '<a class="btn" href="' + esc(fileUrl(d.url)) + '" target="_blank" rel="noopener">' + ICONS.ext + 'Open original</a>' : '') + '</div>';
    var body = '';
    if (d.pages && d.pages.length) body = '<div class="viewer">' + d.pages.map(function (u, i) { return '<img loading="lazy" data-zoom alt="' + esc(d.name + ', page ' + (i + 1)) + '" src="' + esc(fileUrl(u)) + '">'; }).join('') + '</div>' + (d.pageCount && d.pageCount > d.pages.length ? '<p class="note" style="margin-top:10px">' + plural(d.pages.length, 'page') + ' of ' + d.pageCount + ' shown here. ' + (d.url ? '<a href="' + esc(fileUrl(d.url)) + '" target="_blank" rel="noopener">Open the original</a> for the rest.' : '') + '</p>' : '');
    else if (p && p.kind === 'sheets') {
      body = '<div class="card flush sheets">' + (p.sheets.length > 1 ? '<div class="sheet-tabs" role="tablist">' + p.sheets.map(function (s, i) { return '<button type="button" role="tab" class="' + (i ? '' : 'on') + '" data-sheet="' + i + '">' + esc(s.name) + '</button>'; }).join('') + '</div>' : '') +
        p.sheets.map(function (s, i) { var w = 0; s.rows.forEach(function (r) { w = Math.max(w, r.length); }); return '<div class="sheet-pane tw" data-pane="' + i + '"' + (i ? ' hidden' : '') + '><table class="xl"><tbody>' + s.rows.map(function (r, ri) { var cells = ''; for (var c = 0; c < w; c++) { var v = r[c]; cells += '<td class="' + (typeof v === 'number' ? 'num' : '') + '">' + (typeof v === 'number' ? (Math.abs(v) >= 1000 || /\.\d/.test(String(v)) ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : v) : esc(v)) + '</td>'; } return '<tr><td>' + (ri + 1) + '</td>' + cells + '</tr>'; }).join('') + '</tbody></table></div>'; }).join('') + '</div>';
    }
    else if (p && p.kind === 'doc') body = '<div class="viewer"><div class="docx" style="width:100%">' + p.blocks.map(function (b) { return b.t === 'table' ? '<div class="tw"><table><tbody>' + b.rows.map(function (r, i) { return '<tr>' + r.map(function (c) { return (i ? '<td>' : '<td><b>') + esc(c) + (i ? '</td>' : '</b></td>'); }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : b.t === 'h' ? '<h3>' + esc(b.text) + '</h3>' : '<p>' + esc(b.text) + '</p>'; }).join('') + '</div></div>';
    else if (p && p.kind === 'email') body = mailCard({ from: p.from, to: p.to, cc: p.cc, date: p.date, subject: p.subject, body: p.body, attachments: (p.attachments || []).map(function (a) { var hit = S.charterfold.documents.filter(function (x) { return x.name === a.name; })[0]; return { name: a.name, size: a.size, doc: hit ? hit.id : null }; }) }, app);
    else if (d.url && d.ext === 'pdf') body = '<div class="viewer"><iframe title="' + esc(d.name) + '" src="' + esc(fileUrl(d.url)) + '"></iframe></div>';
    else body = '<div class="card"><p>This file opens in its own program. <a href="' + esc(fileUrl(d.url)) + '" target="_blank" rel="noopener">Open the original</a>.</p></div>';
    var meta = '<div class="card"><h3>File details</h3><dl class="dl" style="grid-template-columns:1fr">' +
      '<div><dt>File name</dt><dd>' + esc(d.name) + '</dd></div>' + (d.folder ? '<div><dt>Folder</dt><dd>' + esc(d.folder) + '</dd></div>' : '') + (d.origin ? '<div><dt>Came from</dt><dd>' + esc(d.origin) + '</dd></div>' : '') +
      (d.year ? '<div><dt>Year</dt><dd>' + esc(d.year) + '</dd></div>' : '') + (d.sha256 ? '<div><dt>SHA-256</dt><dd class="mono" style="font-size:11px">' + esc(d.sha256) + '</dd></div>' : '') + '</dl></div>';
    var used = [];
    S.quillpost.messages.forEach(function (m) { (m.attachments || []).forEach(function (a) { if (a.doc === d.id) used.push('<a href="' + href('quillpost', 'msg', m.id) + '">Attached to “' + esc(m.subject) + '”</a>'); }); });
    S.vellumrow.bills.forEach(function (b) { if (b.doc === d.id) used.push('<a href="' + href('vellumrow', 'bill', b.id) + '">Invoice ' + esc(b.number) + ', ' + esc(b.vendor) + '</a>'); });
    if (used.length) meta += '<div class="card"><h3>Linked records</h3><p class="small" style="margin:0;display:grid;gap:6px">' + used.join('') + '</p></div>';
    return html + '<div class="grid side"><div>' + body + '</div><div>' + meta + '</div></div>';
  }
  function docRow(d, app) {
    return '<li><a class="row-link" href="' + href(app, 'doc', d.id) + '">' + docIco(d) + '<span class="grow"><span class="t">' + esc(d.title && d.title !== d.name.replace(/\.[a-z0-9]+$/i, '') ? d.title : d.name) + '</span><span class="d">' + esc([d.title && d.title !== d.name.replace(/\.[a-z0-9]+$/i, '') ? d.name : '', d.type, d.pageCount ? plural(d.pageCount, 'page') : '', size(d.size)].filter(Boolean).join(' · ')) + '</span></span></a></li>';
  }

  // ================================================================== CHARTERFOLD
  VIEWS.charterfold = {
    tabs: function () { return [['profile', 'Entity Profile'], ['people', 'Owners & Officers'], ['documents', 'Document Cabinet', ['doc']], ['calendar', 'Filing Calendar']]; },
    profile: function () {
      var C = S.charterfold;
      var name = (C.fields.filter(function (f) { return f.key === 'legalName'; })[0] || {}).value || S.company.name;
      var logo = S.company.logo ? '<img src="' + esc(BASE + 'brand/' + S.company.logo) + '" alt="" style="height:44px;width:auto;margin-bottom:8px">' : '';
      var html = '<div class="card">' + logo + '<h1>' + esc(name) + '</h1><p class="muted" style="margin:0">Invented demonstration company. Identifiers show their last four digits only.</p></div>';
      html += '<div class="grid side"><div class="card"><h2>Entity record</h2><dl class="dl">' + C.fields.filter(function (f) { return f.key !== 'legalName'; }).map(function (f) { return '<div><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + (f.sources && f.sources.length ? '<small>Source: ' + esc(f.sources.slice(0, 2).join(', ')) + (f.sources.length > 2 ? ' and ' + (f.sources.length - 2) + ' more' : '') + '</small>' : '') + '</dd></div>'; }).join('') + '</dl></div>';
      html += '<div><div class="card"><h2>At a glance</h2><dl class="dl" style="grid-template-columns:1fr"><div><dt>Documents on file</dt><dd><a href="' + href('charterfold', 'documents') + '">' + plural(C.documents.length, 'document') + '</a></dd></div><div><dt>Owners and officers</dt><dd><a href="' + href('charterfold', 'people') + '">' + plural(C.people.length, 'person or entity').replace('entitys', 'entities').replace('person or entitys', 'people or entities') + '</a></dd></div><div><dt>Engagements and filings</dt><dd><a href="' + href('charterfold', 'calendar') + '">' + plural(C.calendar.length, 'item') + '</a></dd></div>' + (C.filed.length ? '<div><dt>Returns on file</dt><dd><a href="' + href('charterfold', 'calendar') + '">' + plural(C.filed.length, 'confirmation') + '</a></dd></div>' : '') + '</dl></div>' +
        (S.run.outputs.length ? '<div class="card"><h2>This run\'s package</h2>' + S.run.outputs.map(function (o) { return '<p class="small" style="margin:0 0 6px"><a href="' + esc(fileUrl(o.url)) + '" target="_blank" rel="noopener">' + esc(o.name) + '</a> <span class="muted">(' + (o.kind === 'return' ? 'draft' : 'workpapers') + ')</span></p>'; }).join('') + '</div>' : '') + '</div></div>';
      return html;
    },
    people: function () {
      var P = S.charterfold.people;
      var html = '<h1>Owners and officers</h1><p class="lead">From the company records in this engagement\'s files.</p>';
      if (!P.length) return html + '<div class="card"><p>The files in this engagement name no owners or officers. The entity record lists the finance contact.</p></div>';
      return html + table({ cols: [
        { label: 'Name', csv: function (p) { return p.name; }, html: function (p) { return '<b>' + esc(p.name) + '</b>'; } },
        { label: 'Kind', csv: function (p) { return p.kind || ''; } },
        { label: 'Role', csv: function (p) { return p.role; } },
        { label: 'Ownership', num: true, val: function (p) { return p.pct; }, html: function (p) { return p.pct === null || p.pct === undefined ? '<span class="muted">–</span>' : p.pct + '%'; }, csv: function (p) { return p.pct === null || p.pct === undefined ? '' : p.pct; } },
        { label: 'Source', csv: function (p) { return p.source || ''; } }
      ], rows: P, csv: DEMO + '-owners-and-officers', noun: 'record', search: P.length > 6,
        foot: function (rs) { var s = 0, any = false; rs.forEach(function (p) { if (p.pct !== null && p.pct !== undefined) { s += p.pct; any = true; } }); return any ? '<tr><td colspan="3">Total ownership</td><td class="num">' + (Math.round(s * 1000) / 1000) + '%</td><td></td></tr>' : ''; } });
    },
    documents: function (arg, q) {
      var docs = S.charterfold.documents, type = q.type || '';
      var types = {}; docs.forEach(function (d) { types[d.type] = (types[d.type] || 0) + 1; });
      var html = '<h1>Document cabinet</h1><p class="lead">' + plural(docs.length, 'document') + ' in this engagement. Open one to read it here.</p>';
      html += '<div class="chips" style="margin-bottom:12px"><a class="chip' + (!type ? ' on' : '') + '" href="' + href('charterfold', 'documents') + '">All<b>' + docs.length + '</b></a>' + Object.keys(types).sort().map(function (t) { return '<a class="chip' + (type === t ? ' on' : '') + '" href="' + href('charterfold', 'documents', '', { type: t }) + '">' + esc(t) + '<b>' + types[t] + '</b></a>'; }).join('') + '</div>';
      return html + table({ cols: [
        { label: 'Document', csv: function (d) { return d.name; }, html: function (d) { return '<span style="display:flex;gap:10px;align-items:center">' + docIco(d) + '<span><b>' + esc(d.title || d.name) + '</b>' + (d.title && d.title !== d.name.replace(/\.[a-z0-9]+$/i, '') ? '<span class="sub-l">' + esc(d.name) + '</span>' : '') + '</span></span>'; }, wrap: true },
        { label: 'Folder', csv: function (d) { return d.folder; } },
        { label: 'Type', csv: function (d) { return d.type; } },
        { label: 'Pages', num: true, val: function (d) { return d.pageCount || 0; }, html: function (d) { return d.pageCount || '<span class="muted">–</span>'; } },
        { label: 'Size', num: true, val: function (d) { return d.size || 0; }, html: function (d) { return size(d.size); } }
      ], rows: docs.filter(function (d) { return !type || d.type === type; }), href: function (d) { return href('charterfold', 'doc', d.id); }, csv: DEMO + '-documents', noun: 'document', placeholder: 'Search documents', sort: { c: 1, dir: 1 } });
    },
    doc: function (id) { return docView('charterfold', id, href('charterfold', 'documents'), 'Document cabinet'); },
    calendar: function () {
      var C = S.charterfold;
      var html = '<h1>Filing calendar</h1><p class="lead">This company\'s returns and engagements prepared with F1 Finance, with the one in this demo marked.</p>';
      html += table({ cols: [
        { label: 'Due', val: function (c) { return c.due || '9999'; }, html: function (c) { return c.due ? '<span class="nowrap">' + date(c.due) + '</span>' : '<span class="muted">' + esc(c.dueRule || 'When needed') + '</span>'; }, csv: function (c) { return c.due || c.dueRule || ''; } },
        { label: 'Filing or engagement', csv: function (c) { return c.item; }, html: function (c) { return '<b>' + esc(c.item) + '</b>' + (c.current ? ' ' + badge('This demo', 'info') : '') + '<span class="sub-l">' + esc(c.name !== c.item ? c.name : '') + '</span>'; }, wrap: true },
        { label: 'Agency', csv: function (c) { return c.agency; } },
        { label: 'Period', csv: function (c) { return c.period; } },
        { label: 'Status', csv: function (c) { return c.status; }, html: function (c) { return badge(c.status, statusKind(c.status)); } },
        { label: 'Open items', num: true, val: function (c) { return c.openItems; }, html: function (c) { return c.openItems || '<span class="muted">–</span>'; } }
      ], rows: C.calendar, csv: DEMO + '-filing-calendar', noun: 'item', search: C.calendar.length > 8, href: function (c) { return c.current ? href('taxrules', 'checks') : null; } });
      if (C.filed.length) html += table({ title: 'Returns on file', search: false, cols: [
        { label: 'Return', csv: function (f) { return f.item; } },
        { label: 'Filed', val: function (f) { return f.filed || ''; }, html: function (f) { return f.filed ? date(f.filed) : '<span class="muted">–</span>'; }, csv: function (f) { return f.filed || ''; } },
        { label: 'Confirmation', csv: function (f) { return f.ref; }, html: function (f) { return '<span class="mono">' + esc(f.ref) + '</span>'; } },
        { label: 'Seen in', csv: function (f) { return f.source; } }
      ], rows: C.filed, csv: DEMO + '-returns-on-file', noun: 'return' });
      return html;
    }
  };

  // ================================================================== VELLUMROW
  VIEWS.vellumrow = {
    tabs: function () { return [['approvals', 'Approval Queue'], ['bills', 'Invoices & Coding', ['bill']], ['inbox', 'Capture Inbox', ['doc']], ['vendors', 'Vendors'], ['trail', 'Audit Trail']].filter(function (t) { return t[0] !== 'vendors' || S.vellumrow.vendors; }); },
    approvals: function () {
      var V = S.vellumrow, B = V.bills;
      var order = ['Needs Review', 'Needs review', 'On hold', 'Captured', 'Approved', 'Posted', 'Paid'];
      var counts = {}; B.forEach(function (b) { counts[b.status] = (counts[b.status] || 0) + 1; });
      var html = '<h1>Approval queue</h1><p class="lead">' + (B.length ? plural(B.length, 'vendor invoice') + ' in this engagement. Items that need a person come first.' : 'No vendor invoices are part of this engagement. The run\'s own package waits here for a reviewer.') + '</p>';
      if (B.length) {
        html += '<div class="kpis">' + Object.keys(counts).sort(function (a, b) { return (order.indexOf(a) < 0 ? 9 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 9 : order.indexOf(b)); }).map(function (s) { return '<div class="kpi"><a href="' + href('vellumrow', 'bills', '', { status: s }) + '"><span>' + esc(s) + '</span><b>' + counts[s] + '</b></a></div>'; }).join('') + '</div>';
        var need = B.filter(function (b) { return /review|hold|captured/i.test(b.status); });
        html += '<div class="card flush"><div class="card-h"><h2 class="grow">Waiting on a person</h2><span class="muted small">' + need.length + '</span></div>' + (need.length ? '<ul class="list">' + need.slice(0, 60).map(function (b) { return '<li><a class="row-link" href="' + href('vellumrow', 'bill', b.id) + '"><span class="grow"><span class="t">' + esc(b.vendor) + ' · ' + esc(b.number) + '</span><span class="d">' + esc((b.findings[0] && b.findings[0].title) || b.hold || b.desc || '') + '</span></span><span class="num"><b>' + usd(b.amount) + '</b><br>' + badge(b.status, statusKind(b.status)) + '</span></a></li>'; }).join('') + '</ul>' + (need.length > 60 ? '<div class="t-more"><a href="' + href('vellumrow', 'bills', '', { status: need[0].status }) + '">See all ' + need.length + '</a></div>' : '') : '<div class="empty">Nothing is waiting. Every invoice is approved, posted or paid.</div>') + '</div>';
      }
      html += '<div class="card"><h2>Review package from this run</h2><p class="small">' + esc(S.run.status || '') + '</p><p class="small muted">' + esc(S.run.summary || '') + '</p>' +
        (S.run.outputImage ? '<div class="viewer" style="margin:10px 0"><img data-zoom alt="First page of the draft" src="' + esc(fileUrl(S.run.outputImage)) + '" style="max-height:420px"></div>' : '') +
        '<div class="chips">' + S.run.outputs.map(function (o) { return '<a class="btn" href="' + esc(fileUrl(o.url)) + '" target="_blank" rel="noopener">' + ICONS.ext + esc(o.name) + '</a>'; }).join('') + '</div>' +
        '<p class="small" style="margin:10px 0 0">Approver: ' + badge(S.family === 'audit' ? 'The CPA concludes' : 'A person reviews and signs', 'open') + '</p></div>';
      return html;
    },
    bills: function (arg, q) {
      var B = S.vellumrow.bills, st = q.status || '';
      var counts = {}; B.forEach(function (b) { counts[b.status] = (counts[b.status] || 0) + 1; });
      var html = '<h1>Invoices and coding</h1>';
      if (!B.length) return html + '<div class="card"><p>No vendor invoices are part of this engagement. See the <a href="' + href('vellumrow', 'inbox') + '">capture inbox</a> for the documents received.</p></div>';
      html += '<p class="lead">Each invoice with its general ledger coding, approval and posting.</p>';
      var chips = '<div class="chips"><a class="chip' + (!st ? ' on' : '') + '" href="' + href('vellumrow', 'bills') + '">All<b>' + B.length + '</b></a>' + Object.keys(counts).map(function (s) { return '<a class="chip' + (st === s ? ' on' : '') + '" href="' + href('vellumrow', 'bills', '', { status: s }) + '">' + esc(s) + '<b>' + counts[s] + '</b></a>'; }).join('') + '</div>';
      return html + table({ tools: chips, cols: [
        { label: 'Vendor', csv: function (b) { return b.vendor; }, html: function (b) { return '<b>' + esc(b.vendor) + '</b>'; }, wrap: true },
        { label: 'Invoice', csv: function (b) { return b.number; }, html: function (b) { return '<span class="mono">' + esc(b.number) + '</span>'; } },
        { label: 'Date', val: function (b) { return b.date || ''; }, html: function (b) { return '<span class="nowrap">' + date(b.date) + '</span>'; }, csv: function (b) { return b.date || ''; } },
        { label: 'Coding', csv: function (b) { return b.coding.map(function (c) { return c.no + ' ' + (c.name || ''); }).join('; '); }, html: function (b) { return b.coding.length ? esc(b.coding.slice(0, 2).map(function (c) { return c.no + ' ' + (c.name || ''); }).join('; ')) + (b.coding.length > 2 ? ' <span class="muted">+' + (b.coding.length - 2) + '</span>' : '') : '<span class="muted">Not coded</span>'; }, wrap: true },
        { label: 'Job', csv: function (b) { return b.job || ''; } },
        { label: 'Status', csv: function (b) { return b.status; }, html: function (b) { return badge(b.status, statusKind(b.status)); } },
        { label: 'Amount', num: true, val: function (b) { return b.amount; }, html: function (b) { return money(b.amount); }, csv: function (b) { return b.amount === null ? '' : b.amount.toFixed(2); } }
      ], rows: B.filter(function (b) { return !st || b.status === st; }), href: function (b) { return href('vellumrow', 'bill', b.id); }, csv: DEMO + '-invoices', noun: 'invoice', placeholder: 'Search vendor, invoice, account or job', limit: 200,
        text: function (b) { return [b.vendor, b.number, b.job, b.status, b.desc, b.approver].concat(b.coding.map(function (c) { return c.no + ' ' + c.name; })).join(' '); },
        foot: function (rs) { var s = 0; rs.forEach(function (b) { s += b.amount || 0; }); return '<tr><td colspan="6">Total</td><td class="num">' + money(s) + '</td></tr>'; } });
    },
    bill: function (id) {
      var b = S.vellumrow.bills.filter(function (x) { return x.id === id; })[0];
      if (!b) return '<div class="card"><h2>Invoice not found</h2><p><a href="' + href('vellumrow', 'bills') + '">All invoices</a></p></div>';
      var d = b.doc ? DOCS[b.doc] : null;
      var html = crumbs([['Invoices', href('vellumrow', 'bills')], [b.vendor + ' ' + b.number, '']]);
      html += '<h1>' + esc(b.vendor) + ' · <span class="mono">' + esc(b.number) + '</span> ' + badge(b.status, statusKind(b.status)) + '</h1>' + (b.desc ? '<p class="lead">' + esc(b.desc) + '</p>' : '');
      html += kpis([['Amount', usd(b.amount)], ['Invoice date', date(b.date) || '–'], ['Job', esc(b.job || '–')], ['Posted', b.je ? '<a class="mono" href="' + href('ledgerwyn', 'journal', b.je) + '">' + esc(b.je) + '</a>' : 'Not posted']]);
      html += '<div class="grid side"><div>';
      html += table({ title: 'Coding', search: false, cols: [
        { label: 'Account', csv: function (c) { return c.no; }, html: function (c) { return '<a class="mono" href="' + href('ledgerwyn', 'gl', '', { acct: c.no }) + '">' + esc(c.no) + '</a>'; }, noLink: true },
        { label: 'Name', csv: function (c) { return c.name; } },
        { label: 'Job / cost code', csv: function (c) { return [c.job, c.cost].filter(Boolean).join(' / '); } },
        { label: 'Amount', num: true, val: function (c) { return c.amount; }, html: function (c) { return money(c.amount); }, csv: function (c) { return c.amount === null || c.amount === undefined ? '' : c.amount.toFixed(2); } }
      ], rows: b.coding, empty: 'No coding is recorded for this invoice.', noun: 'line' });
      if (b.findings.length) html += '<div class="card flush"><div class="card-h"><h2>Findings</h2></div>' + b.findings.map(function (f) { return '<div class="check-row"><span class="dot ' + (f.severity === 'info' ? 'info' : 'open') + '">!</span><div class="grow"><div class="t">' + esc(f.title) + '</div>' + (f.detail ? '<div class="d">' + esc(f.detail) + '</div>' : '') + '</div></div>'; }).join('') + '</div>';
      if (d) html += '<div class="card flush"><div class="card-h"><h2 class="grow">Invoice document</h2><a class="btn" href="' + href('vellumrow', 'doc', d.id) + '">Open</a></div>' + (d.pages && d.pages.length ? '<div class="viewer" style="border-radius:0"><img data-zoom alt="' + esc(d.name) + '" src="' + esc(fileUrl(d.pages[0])) + '" style="max-height:520px"></div>' : '<p class="small" style="padding:0 14px">' + esc(d.name) + '</p>') + '</div>';
      html += '</div><div><div class="card"><h2>Approval</h2><dl class="dl" style="grid-template-columns:1fr">' +
        '<div><dt>Status</dt><dd>' + badge(b.status, statusKind(b.status)) + '</dd></div>' +
        '<div><dt>Approver</dt><dd>' + (b.approver ? esc(b.approver) + (b.approverRole ? '<small>' + esc(b.approverRole) + '</small>' : '') : '<span class="muted">Not recorded in these files</span>') + '</dd></div>' +
        (b.approvedAmount !== null && b.approvedAmount !== undefined ? '<div><dt>Approved amount</dt><dd>' + usd(b.approvedAmount) + (b.amount !== null && Math.abs(b.approvedAmount - b.amount) > 0.005 ? ' ' + badge('Differs from invoice', 'fail') : '') + '</dd></div>' : '') +
        (b.enteredBy ? '<div><dt>Entered by</dt><dd>' + esc(b.enteredBy) + '</dd></div>' : '') + (b.hold ? '<div><dt>Hold</dt><dd>' + esc(b.hold) + '</dd></div>' : '') +
        (b.due ? '<div><dt>Due</dt><dd>' + date(b.due) + '</dd></div>' : '') + (b.open !== null && b.open !== undefined ? '<div><dt>Open amount</dt><dd>' + usd(b.open) + '</dd></div>' : '') +
        (b.capture ? '<div><dt>Captured</dt><dd>' + esc([b.capture.arrived, b.capture.note].filter(Boolean).join('. ')) + '</dd></div>' : '') +
        '<div><dt>Seen in</dt><dd>' + esc(b.sources.join(', ')) + '</dd></div></dl></div>' +
        '<div class="card flush"><div class="card-h"><h2>History</h2></div><ul class="tl">' + b.history.map(function (h) { return '<li><div class="w">' + (h.at ? dateTime(h.at) : 'During this review') + '</div><div class="a">' + esc(h.action) + ' <span class="muted" style="font-weight:400">· ' + esc(h.actor || '') + '</span></div>' + (h.note ? '<div class="n">' + esc(h.note) + '</div>' : '') + '</li>'; }).join('') + '</ul></div></div></div>';
      return html;
    },
    inbox: function () {
      var I = S.vellumrow.inbox;
      var html = '<h1>Capture inbox</h1><p class="lead">Every document received for this engagement, how it arrived and when this run read it.</p>';
      return html + table({ cols: [
        { label: 'Document', csv: function (r) { return r.name; }, html: function (r) { return '<span style="display:flex;gap:10px;align-items:center">' + docIco({ type: r.type }) + '<b style="overflow-wrap:anywhere">' + esc(r.name) + '</b></span>'; }, wrap: true },
        { label: 'Arrived', csv: function (r) { return r.via; }, html: function (r) { return esc(r.from) + '<span class="sub-l">' + esc(r.via) + '</span>'; }, wrap: true },
        { label: 'Received', val: function (r) { return r.received || ''; }, html: function (r) { return r.received ? dateTime(r.received) : '<span class="muted">In the client folder</span>'; }, csv: function (r) { return r.received || ''; } },
        { label: 'Read by the run', val: function (r) { return r.readAt || ''; }, html: function (r) { return r.readAt ? dateTime(r.readAt) : '<span class="muted">–</span>'; }, csv: function (r) { return r.readAt || ''; } },
        { label: 'Status', csv: function (r) { return r.status; }, html: function (r) { return badge(r.status, statusKind(r.status)); } }
      ], rows: I, href: function (r) { return href('vellumrow', 'doc', r.doc); }, csv: DEMO + '-capture-inbox', noun: 'document', placeholder: 'Search documents' });
    },
    doc: function (id) { return docView('vellumrow', id, href('vellumrow', 'inbox'), 'Capture inbox'); },
    vendors: function () {
      var V = S.vellumrow.vendors;
      if (!V) return '<div class="card"><p>No vendor file is part of this engagement.</p></div>';
      return '<h1>Vendors</h1><p class="lead">From ' + esc(V.source) + '. Tax identification numbers show their last four digits only.</p>' + table({ cols: V.headers.map(function (h, i) { return { label: h, csv: function (r) { return r[i]; }, val: function (r) { return r[i]; }, num: typeof V.rows[0][i] === 'number', html: function (r) { return typeof r[i] === 'number' ? money(r[i]) : esc(r[i]); } }; }), rows: V.rows, csv: DEMO + '-vendors', noun: 'vendor', placeholder: 'Search vendors' });
    },
    trail: function () {
      var T = S.vellumrow.trail;
      var ops = { read: 'Read', check: 'Checked', calculate: 'Calculated', write: 'Wrote', research: 'Looked up', stage: 'Finished step' };
      return '<h1>Audit trail</h1><p class="lead">What this run did, in order, with the time of each step and the file it used.</p>' + table({ cols: [
        { label: 'Time', val: function (t) { return t.at; }, html: function (t) { return '<span class="nowrap">' + dateTime(t.at) + '</span>'; }, csv: function (t) { return t.at; } },
        { label: 'Action', csv: function (t) { return ops[t.op] || t.op; }, html: function (t) { return badge(ops[t.op] || t.op, t.op === 'check' ? 'pass' : 'info'); } },
        { label: 'What', csv: function (t) { return t.what; }, html: function (t) { return '<b>' + esc(t.what) + '</b>' + (t.result && t.result !== t.what ? '<span class="sub-l">' + esc(t.result) + '</span>' : ''); }, wrap: true },
        { label: 'File', csv: function (t) { return t.source; } },
        { label: 'By', csv: function (t) { return t.actor; } }
      ], rows: T, csv: DEMO + '-audit-trail', noun: 'step', placeholder: 'Search the trail', sort: { c: 0, dir: 1 } });
    }
  };

  // ================================================================== QUILLPOST
  function addr(s) { var m = /^(.*?)\s*<([^>]+)>$/.exec(String(s || '')); return m ? { n: m[1].replace(/^"|"$/g, '') || m[2], e: m[2] } : { n: String(s || ''), e: '' }; }
  function mailCard(m, app) {
    var f = addr(m.from);
    return '<div class="card flush"><div class="mail-h"><b>' + esc(m.subject) + '</b><div><span style="font-weight:600">' + esc(f.n) + '</span> <span class="muted">' + esc(f.e ? '<' + f.e + '>' : '') + '</span></div><div class="muted">To ' + esc(m.to) + (m.cc ? ' · Cc ' + esc(m.cc) : '') + '</div><div class="muted">' + dateTime(m.date) + '</div></div>' +
      '<div class="mail-body">' + esc(m.body) + '</div>' +
      ((m.attachments || []).length ? '<div class="atts">' + m.attachments.map(function (a) { var d = a.doc ? DOCS[a.doc] : null; var inner = docIco(d || { type: /\.pdf$/i.test(a.name) ? 'pdf' : /\.xls/i.test(a.name) ? 'excel' : /\.doc/i.test(a.name) ? 'word' : 'file' }) + '<span>' + esc(a.name) + '</span>' + (a.size ? '<small class="muted">' + size(a.size) + '</small>' : ''); return d ? '<a class="att" href="' + href(app, 'doc', d.id) + '">' + inner + '</a>' : '<span class="att" title="Attachment listed in the message">' + inner + '</span>'; }).join('') + '</div>' : '') + '</div>';
  }
  VIEWS.quillpost = {
    tabs: function () { return [['inbox', 'Mailbox', ['msg', 'doc', 'folder']]]; },
    inbox: function (arg, q) { return mailList(q.folder || 'Inbox', q, null); },
    folder: function (arg, q) { return mailList(arg || 'Inbox', q, null); },
    msg: function (id, q) { var m = S.quillpost.messages.filter(function (x) { return x.id === id; })[0]; return mailList(m ? m.folder : 'Inbox', q, m || null, id); },
    doc: function (id) { return docView('quillpost', id, href('quillpost'), 'Mailbox'); }
  };
  function mailList(folder, q, open, wantedId) {
    var Q = S.quillpost, search = (q.q || '').toLowerCase();
    var msgs = Q.messages.filter(function (m) { return m.folder === folder; });
    if (search) msgs = Q.messages.filter(function (m) { return [m.subject, m.from, m.to, m.body].concat((m.attachments || []).map(function (a) { return a.name; })).join(' ').toLowerCase().indexOf(search) >= 0; });
    var html = '<h1>Mailbox</h1>';
    if (!Q.messages.length) return html + '<div class="card"><p>No email is part of this engagement\'s files.</p></div>';
    html += '<div class="mail"><div><div class="card" style="padding:10px"><input class="search" type="search" placeholder="Search mail" aria-label="Search mail" value="' + esc(q.q || '') + '" data-nav="q"><div class="folders" style="margin-top:10px">' + Q.folders.filter(function (f) { return f.total || f.name === 'Inbox'; }).map(function (f) { return '<a class="' + (f.name === folder && !search ? 'on' : '') + '" href="' + href('quillpost', 'folder', f.name) + '"><span>' + esc(f.name) + '</span><span>' + (f.unread ? '<b>' + f.unread + '</b> / ' : '') + f.total + '</span></a>'; }).join('') + '</div></div>' +
      '<div class="card flush">' + (msgs.length ? msgs.map(function (m) { var f = addr(m.from); return '<a class="msg-item' + (m.read ? '' : ' unread') + '" href="' + href('quillpost', 'msg', m.id, search ? { q: q.q } : null) + '"' + (open && open.id === m.id ? ' style="background:var(--teal-100)"' : '') + '><div class="f"><span>' + esc(f.n) + '</span><span class="nowrap">' + date(m.date) + '</span></div><div class="s">' + (m.flagged ? '⚑ ' : '') + esc(m.subject) + ((m.attachments || []).length ? ' <span class="muted">📎' + m.attachments.length + '</span>' : '') + '</div><div class="p">' + esc((m.body || '').slice(0, 160)) + '</div></a>'; }).join('') : '<div class="empty">No messages' + (search ? ' match.' : ' in ' + esc(folder) + '.') + '</div>') + '</div></div>';
    if (wantedId && !open) html += '<div class="card"><h2>Message not found</h2></div>';
    else if (open) {
      var thread = Q.messages.filter(function (m) { return m.thread === open.thread && m.id !== open.id; });
      html += '<div>' + '<p style="margin:0 0 10px">' + backLink(href('quillpost', 'folder', open.folder), open.folder) + '</p>' + mailCard(open, 'quillpost') + (thread.length ? '<div class="card flush"><div class="card-h"><h3>In this conversation</h3></div><ul class="list">' + thread.map(function (m) { return '<li><a class="row-link" href="' + href('quillpost', 'msg', m.id) + '"><span class="grow"><span class="t">' + esc(addr(m.from).n) + '</span><span class="d">' + esc(m.subject) + '</span></span><span class="muted small nowrap">' + date(m.date) + '</span></a></li>'; }).join('') + '</ul></div>' : '') + '</div>';
    } else html += '<div class="card"><p class="muted" style="margin:0">Choose a message to read it and open its attachments.</p></div>';
    return html + '</div>';
  }

  // ================================================================== TAX RULES
  VIEWS.taxrules = {
    tabs: function () { var t = [['checks', 'Rule Checks'], ['sources', 'Official Sources', ['source']]]; if (S.taxrules.policies.length) t.push(['policies', 'Client Policies']); return t; },
    checks: function (arg, q) {
      var C = S.taxrules.checks, st = q.status || '';
      var label = { pass: 'Agrees', fail: 'Differs', open: 'Open item', finding: 'Finding', done: 'Completed', info: 'Note' };
      var counts = {}; C.forEach(function (c) { counts[c.status] = (counts[c.status] || 0) + 1; });
      var html = '<h1>Rule checks</h1><p class="lead">What this run checked, what agreed, and what is left for a person to decide.</p>';
      html += '<div class="kpis">' + ['pass', 'fail', 'open', 'finding', 'done'].filter(function (s) { return counts[s]; }).map(function (s) { return '<div class="kpi"><a href="' + href('taxrules', 'checks', '', { status: s }) + '"><span>' + label[s] + '</span><b>' + counts[s] + '</b></a></div>'; }).join('') + '</div>';
      html += '<div class="chips" style="margin-bottom:12px"><a class="chip' + (!st ? ' on' : '') + '" href="' + href('taxrules', 'checks') + '">All<b>' + C.length + '</b></a>' + Object.keys(counts).map(function (s) { return '<a class="chip' + (st === s ? ' on' : '') + '" href="' + href('taxrules', 'checks', '', { status: s }) + '">' + (label[s] || s) + '<b>' + counts[s] + '</b></a>'; }).join('') + '</div>';
      var groups = [];
      C.filter(function (c) { return !st || c.status === st; }).forEach(function (c) { var g = groups.filter(function (x) { return x.name === c.group; })[0]; if (!g) groups.push(g = { name: c.group, items: [] }); g.items.push(c); });
      if (!groups.length) html += '<div class="card"><div class="empty">No checks match.</div></div>';
      groups.forEach(function (g) {
        html += '<div class="card flush"><div class="card-h"><h2 class="grow">' + esc(g.name) + '</h2><span class="muted small">' + g.items.length + '</span></div>' + g.items.map(function (c) {
          var sym = { pass: '✓', fail: '✕', open: '!', finding: '!', done: '✓', info: 'i' }[c.status] || 'i';
          var vals = c.left !== undefined && c.left !== null ? '<div class="v">' + esc(c.leftLabel || 'Records') + ' ' + usd(c.left) + (c.right !== null && c.right !== undefined ? ' · ' + esc(c.rightLabel || 'Other') + ' ' + usd(c.right) : '') + (c.diff !== null && c.diff !== undefined ? ' · difference ' + usd(c.diff) : '') + '</div>' : (c.amount !== null && c.amount !== undefined ? '<div class="v">Amount ' + usd(c.amount) + '</div>' : '');
          return '<div class="check-row"><span class="dot ' + c.status + '">' + sym + '</span><div class="grow"><div class="t">' + esc(c.title) + '</div>' + (c.detail ? '<div class="d">' + esc(c.detail) + '</div>' : '') + vals + (c.source ? '<div class="v">File: ' + esc(String(c.source).split('/').pop()) + (c.at ? ' · ' + dateTime(c.at) : '') + '</div>' : '') + '</div>' + badge(label[c.status] || c.status, c.status) + '</div>';
        }).join('') + '</div>';
      });
      return html;
    },
    sources: function () {
      var R = S.taxrules.sources;
      var html = '<h1>Official sources</h1>';
      if (!R.length) return html + '<div class="card"><p>This run relies on the client\'s own records and policies; it looked up no outside rule. See <a href="' + href('taxrules', 'checks') + '">the checks</a>.</p></div>';
      html += '<p class="lead">' + (R.some(function (r) { return r.used; }) ? 'The rules this run looked up, with the passages it relied on. Links open the official page.' : 'This run worked from the client\'s records and policies. These official sources cover the same ground and are kept with the engagement for the reviewer.') + '</p>';
      return html + '<div class="card flush">' + R.map(function (r) {
        return '<details class="x"><summary><div class="check-row"><span class="dot info">§</span><div class="grow"><div class="t">' + esc(r.title) + '</div><div class="v">' + esc([r.issuer, r.year].filter(Boolean).join(' · ')) + (r.passages.length ? ' · ' + plural(r.passages.length, 'passage') : '') + '</div></div><a class="btn" href="' + esc(r.url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' + ICONS.ext + 'Official page</a></div></summary>' +
          (r.passages.length ? '<div class="passage">' + r.passages.map(function (p) { return '<p><b>' + esc(p.q) + '</b></p><blockquote>' + esc(p.a) + '</blockquote>'; }).join('') + '</div>' : '<div class="passage"><p class="muted">Open the official page for the text.</p></div>') + '</details>';
      }).join('') + '</div>';
    },
    policies: function () {
      var P = S.taxrules.policies;
      return '<h1>Client policies</h1><p class="lead">The client\'s own written rules this run applied, clause by clause.</p>' + table({ cols: [
        { label: 'Clause', csv: function (p) { return p.clause; }, html: function (p) { return '<span class="mono">' + esc(p.clause) + '</span>'; } },
        { label: 'Title', csv: function (p) { return p.title; }, html: function (p) { return '<b>' + esc(p.title) + '</b>'; } },
        { label: 'Text', csv: function (p) { return p.text; }, wrap: true },
        { label: 'Source', csv: function (p) { return p.source + (p.page ? ', page ' + p.page : ''); } }
      ], rows: P, csv: DEMO + '-policies', noun: 'clause', placeholder: 'Search policies' });
    }
  };

  boot();
})();
