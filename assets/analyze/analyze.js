/* F1 Finance: "Try it on your own files".
   Shell: the small card under the demo options, the full-screen results view, and a lazy loader.
   Visitors' files are read ONLY inside this browser tab. Nothing is uploaded, posted, stored or tracked.
   Heavy parts (core.js, the analyzer modules, SheetJS and pdf.js from cdnjs) load on first use only.
   To add an analyzer: add an entry to MANIFEST below and a module file that calls F1Analyze.define(id, {...}). */
(function () {
  'use strict';
  if (window.F1Analyze) return;
  var me = document.currentScript;
  var BASE = me && me.src ? me.src.replace(/[^\/]*(\?.*)?$/, '') : 'assets/analyze/';
  var VER = '1';
  var LIBS = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  };

  var SRI = {}; // subresource integrity for the pinned CDN files
  SRI[LIBS.xlsx] = 'sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA==';
  SRI[LIBS.pdf] = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==';

  // Option id (from DEMO[m].subjects[].id in index.html) -> analyzer.
  var MANIFEST = {
    'accounting-bankrec': {
      label: 'Bank reconciliation', module: 'a-bankrec.js', min: 2,
      need: 'Your bank statement (Excel, CSV or text PDF) and the ledger cash detail for the same month (Excel or CSV).',
      samples: ['samples/bank-statement-oct-2026.pdf', 'samples/gl-cash-detail-oct-2026.xlsx'],
      sampleNote: 'Sample: Larkspur Coffee Roasters, October 2026 bank statement (PDF) and ledger cash detail.'
    },
    'accounting': {
      label: 'AP review', module: 'a-ap.js', min: 1,
      need: 'An export of vendor bills or invoices (Excel or CSV): vendor, invoice number, date, amount, account.',
      samples: ['samples/ap-invoices-oct-2026.xlsx'],
      sampleNote: 'Sample: Larkspur Coffee Roasters, October 2026 vendor bills.'
    },
    'tax-941': {
      label: 'Form 941', module: 'a-941.js', min: 1,
      need: 'A payroll register (Excel or CSV): one row per employee per pay date, with wages and taxes withheld.',
      samples: ['samples/payroll-register-2026.xlsx'],
      sampleNote: 'Sample: Larkspur Coffee Roasters payroll register, January to September 2026.'
    }
  };
  var LABEL_TO_ID = {};
  Object.keys(MANIFEST).forEach(function (k) { LABEL_TO_ID[MANIFEST[k].label.toLowerCase()] = k; });

  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root, cur = null, files = [], defs = {}, loading = {};

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kb(n) { return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }

  // ---------- loading ----------
  function loadScript(url) {
    if (loading[url]) return loading[url];
    loading[url] = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = url; s.async = true;
      if (/^https:/.test(url)) { s.crossOrigin = 'anonymous'; if (SRI[url]) s.integrity = SRI[url]; s.referrerPolicy = 'no-referrer'; }
      s.onload = function () { res(); };
      s.onerror = function () { delete loading[url]; rej(new Error('load:' + url)); };
      document.head.appendChild(s);
    });
    return loading[url];
  }
  function loadCore() { return loadScript(BASE + 'core.js?v=' + VER); }
  function loadModule(id) {
    var m = MANIFEST[id];
    return loadCore().then(function () { return loadScript(BASE + m.module + '?v=' + VER); });
  }
  function warm() { if (cur && MANIFEST[cur]) loadModule(cur).catch(function () {}); }

  // ---------- selection tracking ----------
  function readSelected() {
    var subj = document.getElementById('demoSubj'); if (!subj) return null;
    var b = subj.querySelector('button[aria-pressed="true"]'); if (!b) return null;
    var id = b.getAttribute('data-id');
    if (id) return id;
    var t = (b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.nodeValue : b.textContent || '').trim().toLowerCase();
    return LABEL_TO_ID[t] || ('label:' + t);
  }
  function select(id) {
    if (!root) return;
    if (id === cur) return;
    cur = id; files = []; render();
  }

  // ---------- card ----------
  var ICON_LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 4.5 5.6v5.6c0 4.7 3.1 8.5 7.5 10 4.4-1.5 7.5-5.3 7.5-10V5.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.6 12.1 2.4 2.4 4.5-4.7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5V4.5m0 0-4 4m4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 14.5v3.2a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-3.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

  function render() {
    root.innerHTML = '';
    var m = MANIFEST[cur];
    if (!m) {
      root.className = 'f1a f1a-quiet';
      root.appendChild(el('p', 'f1a-soon', 'Your-file analysis for this option is coming soon.'));
      return;
    }
    root.className = 'f1a';
    var card = el('div', 'f1a-card');
    card.innerHTML =
      '<div class="f1a-head"><span class="f1a-lock">' + ICON_LOCK + '</span><div class="f1a-ht">' +
      '<b>Try it on your own files <span class="f1a-dash">&mdash;</span> <span class="f1a-keep">they stay on your device</span></b>' +
      '<span class="f1a-what"><i>' + esc(m.label) + '.</i> ' + esc(m.need) + '</span></div></div>' +
      '<label class="f1a-drop" tabindex="-1"><input type="file" multiple accept=".xlsx,.xls,.csv,.pdf,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">' +
      '<span class="f1a-up">' + ICON_UP + '</span><span class="f1a-dt"><span><b class="f1a-pick">Choose files</b><span class="f1a-or"> or drop them here</span></span><small>Excel, CSV or PDF. Read in this browser only; nothing is uploaded.</small></span></label>' +
      '<ul class="f1a-files" hidden></ul>' +
      '<div class="f1a-row"><button type="button" class="f1a-go" disabled>Analyze my files</button>' +
      '<button type="button" class="f1a-sample">Use sample files</button></div>' +
      '<p class="f1a-msg" role="status" aria-live="polite"></p>';
    root.appendChild(card);
    var input = card.querySelector('input'), drop = card.querySelector('.f1a-drop'), list = card.querySelector('.f1a-files');
    var go = card.querySelector('.f1a-go'), msg = card.querySelector('.f1a-msg');
    function refresh() {
      list.innerHTML = '';
      list.hidden = !files.length;
      files.forEach(function (f, i) {
        var li = el('li', null, '<span class="f1a-fn">' + esc(f.name) + '</span><small>' + kb(f.size) + '</small>');
        var x = el('button', 'f1a-rm', '<span aria-hidden="true">&times;</span>'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + f.name);
        x.addEventListener('click', function () { files.splice(i, 1); refresh(); });
        li.appendChild(x); list.appendChild(li);
      });
      go.disabled = files.length < m.min; go.hidden = !files.length;
      msg.textContent = files.length && files.length < m.min ? 'Add ' + (m.min - files.length) + ' more file: this needs ' + (m.min === 2 ? 'both the bank statement and the ledger cash detail.' : m.min + ' files.') : '';
    }
    function add(list2) {
      [].slice.call(list2 || []).forEach(function (f) {
        if (!/\.(xlsx|xlsm|xls|csv|pdf|txt)$/i.test(f.name) && !/pdf|csv|sheet|excel/.test(f.type || '')) { msg.textContent = f.name + ' is not an Excel, CSV or PDF file.'; return; }
        if (files.some(function (g) { return g.name === f.name && g.size === f.size; })) return;
        if (f.size > 40 * 1048576) { msg.textContent = f.name + ' is larger than 40 MB; please export just the period you need.'; return; }
        files.push(f);
      });
      refresh();
    }
    input.addEventListener('change', function () { add(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer) add(e.dataTransfer.files); });
    card.addEventListener('pointerdown', warm, { once: true });
    card.addEventListener('focusin', warm, { once: true });
    drop.addEventListener('dragenter', warm, { once: true });
    go.addEventListener('click', function () {
      if (files.length < m.min) { refresh(); return; }
      var picked = files.slice();
      files = []; refresh(); // the card forgets the files once they are handed to the analysis
      start(cur, picked, false);
    });
    card.querySelector('.f1a-sample').addEventListener('click', function () { start(cur, null, true); });
    refresh();
  }

  // ---------- full-screen view ----------
  var view, vBody, vTitle, vSub, lastFocus, prevOverflow = '';
  function buildView() {
    if (view) return;
    view = el('div', 'f1a-view');
    view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true'); view.setAttribute('aria-labelledby', 'f1aVT');
    view.hidden = true;
    view.innerHTML = '<div class="f1a-bar"><span class="f1a-bar-t"><b id="f1aVT"></b><span class="f1a-bar-s"></span></span>' +
      '<button class="f1a-x" type="button" aria-label="Exit the analysis"><span>Exit</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>' +
      '<div class="f1a-body" tabindex="-1"></div>';
    document.body.appendChild(view);
    vBody = view.querySelector('.f1a-body'); vTitle = view.querySelector('#f1aVT'); vSub = view.querySelector('.f1a-bar-s');
    view.querySelector('.f1a-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && view && !view.hidden) { e.stopPropagation(); close(); }
    }, true);
  }
  var runId = 0;
  function open(title, sub) {
    buildView();
    vTitle.textContent = title; vSub.textContent = sub || '';
    vBody.innerHTML = ''; vBody.scrollTop = 0;
    lastFocus = document.activeElement;
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    view.hidden = false;
    requestAnimationFrame(function () { view.classList.add('on'); });
    view.querySelector('.f1a-x').focus({ preventScroll: true });
  }
  function close() {
    if (!view || view.hidden) return;
    runId++;
    view.classList.remove('on'); view.hidden = true; vBody.innerHTML = '';
    document.documentElement.style.overflow = prevOverflow === 'hidden' ? '' : prevOverflow;
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  // progress steps
  var STEPS = ['Read files', 'Detect columns', 'Match and calculate', 'Run checks'];
  function progress() {
    var wrap = el('div', 'f1a-prog');
    wrap.innerHTML = '<p class="f1a-prog-h">Working on this device. Your files are not uploaded.</p><ol>' + STEPS.map(function (s) { return '<li><i aria-hidden="true"></i><span>' + s + '</span><small></small></li>'; }).join('') + '</ol>';
    vBody.innerHTML = ''; vBody.appendChild(wrap);
    var lis = wrap.querySelectorAll('li');
    return {
      el: wrap,
      step: function (i, state, note) {
        var li = lis[i]; if (!li) return;
        li.className = state || '';
        if (note != null) li.querySelector('small').textContent = note;
      },
      wait: function () { return new Promise(function (r) { setTimeout(r, reduced ? 0 : 260); }); }
    };
  }

  function readFile(f) {
    if (f.arrayBuffer) return f.arrayBuffer();
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsArrayBuffer(f); });
  }

  function start(id, list, sample) {
    var m = MANIFEST[id]; if (!m) return;
    var my = ++runId;
    open(m.label + (sample ? ' · sample files' : ''), sample ? m.sampleNote : 'Your files, analyzed on this device');
    var pg = progress();
    pg.step(0, 'on', sample ? 'Loading the sample files' : 'Opening ' + list.length + ' file' + (list.length > 1 ? 's' : ''));
    var needPdf = sample ? m.samples.some(function (s) { return /\.pdf$/i.test(s); }) : list.some(function (f) { return /\.pdf$/i.test(f.name) || /pdf/.test(f.type || ''); });
    var libs = [loadModule(id), loadScript(LIBS.xlsx)];
    if (needPdf) libs.push(loadScript(LIBS.pdf));
    var got = sample
      ? Promise.all(m.samples.map(function (s) {
          return fetch(BASE + s + '?v=' + VER).then(function (r) { if (!r.ok) throw new Error('sample'); return r.arrayBuffer(); })
            .then(function (buf) { return { name: s.split('/').pop(), size: buf.byteLength, buf: buf }; });
        }))
      : Promise.all(list.map(function (f) { return readFile(f).then(function (buf) { return { name: f.name, size: f.size, type: f.type, buf: buf }; }); }));
    Promise.all([Promise.all(libs), got]).then(function (r) {
      if (my !== runId) return;
      if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
      return window.F1Core.run({ id: id, def: defs[id], meta: m, files: r[1], sample: sample, ui: api.ui, pg: pg, alive: function () { return my === runId; } });
    }).catch(function (err) {
      if (my !== runId) return;
      var load = err && /^load:/.test(err.message);
      api.ui.error(load ? 'The file reader could not load. Check your connection and try again; your files were not sent anywhere.' : 'Something went wrong reading the files. ' + (err && err.message ? '(' + err.message + ')' : ''));
    });
  }

  var api = {
    define: function (id, def) { defs[id] = def; },
    select: function (id) { select(id); },
    manifest: MANIFEST, libs: LIBS, base: BASE,
    ui: {
      body: function () { return vBody; },
      setSub: function (s) { if (vSub) vSub.textContent = s; },
      close: close,
      reduced: reduced,
      error: function (text, extra) {
        vBody.innerHTML = '';
        var box = el('div', 'f1a-err');
        box.innerHTML = '<b>We could not analyze this</b><p>' + esc(text) + '</p>' + (extra || '') + '<button type="button" class="f1a-go">Back to the page</button>';
        box.querySelector('button').addEventListener('click', close);
        vBody.appendChild(box);
      }
    }
  };
  window.F1Analyze = api;

  function init() {
    root = document.getElementById('f1Analyze');
    var subj = document.getElementById('demoSubj');
    if (!root || !subj) return;
    var sync = function () { var id = readSelected(); if (id) select(id); };
    new MutationObserver(sync).observe(subj, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    sync();
    if (!cur) { cur = '__none'; render(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
