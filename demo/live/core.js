/* F1 Finance demos · "Try your own numbers" · the panel (DOM).
   Opens over the replay, which keeps its state underneath. Two modes:
     Recorded run  - the recorded run's inputs and figures, recalculated from the demo's own data files (read-only)
     Your numbers  - the same inputs, editable; every figure and check recalculates as you type
   Nothing is saved or sent. Escape closes this panel only. */
(function () {
  'use strict';
  var W = window, FF = W.FFLive = W.FFLive || {}, L = FF.lib;
  FF.ui = FF.ui || {};
  var cache = {};

  // ---- tiny DOM helper --------------------------------------------------------------------------------
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids == null ? [] : [].concat(kids)).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return e;
  }
  FF.h = h;

  // ---- formatting -----------------------------------------------------------------------------------------
  function fmt(v, f) {
    if (v == null || v === '') return '';
    switch (f) {
      case 'money': return L.money(v, { dollar: false, paren: true });
      case 'usd': return L.money(v);
      case 'int': return L.int(v);
      case 'pct': return L.pct(v);
      case 'date': return L.validDate(v) ? L.shortDate(v) + ', ' + String(v).slice(0, 4) : String(v);
      case 'bool': return v ? 'Yes' : 'No';
      default: return String(v);
    }
  }
  FF.fmt = fmt;
  function inputText(v, type) {
    if (type === 'money') return v === '' || v == null ? '' : L.money(v, { dollar: false });
    if (type === 'pct') return v == null ? '' : String(Math.round(v * 1e6) / 1e4);
    if (type === 'int') return v == null ? '' : String(v);
    return v == null ? '' : String(v);
  }
  function parse(s, type) {
    if (type === 'money') return L.round2(L.num(s));
    if (type === 'int') return Math.round(L.num(s));
    if (type === 'pct') return L.num(s) / 100;
    if (type === 'number') return L.num(s);
    return s;
  }

  // ---- the panel --------------------------------------------------------------------------------------------
  function Panel(id, cfg) {
    this.id = id; this.cfg = cfg; this.calc = FF.calc[id]; this.ui = FF.ui[id];
    this.mode = 'mine'; this.rec = null; this.mine = null; this.data = null; this.timer = 0;
  }
  Panel.prototype.build = function () {
    var self = this, ui = this.ui;
    this.root = h('div', { class: 'ffl-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Try your own numbers: ' + ui.title });
    this.btnRec = h('button', { type: 'button', 'data-mode': 'recorded', 'aria-pressed': 'false', onclick: function () { self.setMode('recorded'); } }, 'Recorded run');
    this.btnMine = h('button', { type: 'button', 'data-mode': 'mine', 'aria-pressed': 'true', onclick: function () { self.setMode('mine'); } }, 'Your numbers');
    this.btnReset = h('button', { type: 'button', class: 'ffl-btn', title: 'Put every input back to the recorded run', onclick: function () { self.reset(); } }, [icon('reset'), 'Reset to recorded']);
    this.btnCsv = h('button', { type: 'button', class: 'ffl-btn', title: 'Download these results as a CSV file', onclick: function () { self.download(); } }, [icon('down'), 'Download CSV']);
    this.btnX = h('button', { type: 'button', class: 'ffl-btn ffl-x', 'aria-label': 'Close and return to the replay', title: 'Close (Esc)', onclick: function () { FF.close(); } }, '×');
    this.head = h('div', { class: 'ffl-head' }, [
      h('div', { class: 'ffl-title' }, [h('h2', { text: 'Try your own numbers · ' + ui.title }), h('p', { text: ui.sub })]),
      h('div', { class: 'ffl-modes', role: 'group', 'aria-label': 'Which numbers to show' }, [this.btnRec, this.btnMine]),
      h('div', { class: 'ffl-actions' }, [this.btnReset, this.btnCsv]),
      this.btnX
    ]);
    this.banner = h('div', { class: 'ffl-banner', role: 'status', 'aria-live': 'polite' });
    this.keys = h('div', { class: 'ffl-keys', 'aria-label': 'Key figures' });
    this.inCol = h('section', { class: 'ffl-col ffl-inputs', 'aria-label': 'Inputs' });
    this.outCol = h('section', { class: 'ffl-col ffl-results', 'aria-label': 'Results', tabindex: '-1' });
    this.body = h('div', { class: 'ffl-body' }, [this.inCol, this.outCol]);
    this.loading = h('div', { class: 'ffl-loading' }, [h('span', { class: 'ffl-spin' }), 'Reading the recorded run’s files…']);
    this.panel = h('div', { class: 'ffl-panel' }, [this.head, this.loading]);
    this.root.appendChild(this.panel);
    this.root.addEventListener('click', function (e) { if (e.target === self.root) FF.close(); });
    // typing in the panel never reaches the replay's own keyboard shortcuts
    ['keydown', 'keyup', 'keypress'].forEach(function (t) { self.root.addEventListener(t, function (e) { e.stopPropagation(); }); });
    document.body.appendChild(this.root);
  };
  Panel.prototype.load = function () {
    var self = this;
    var p = cache[this.id] || (cache[this.id] = this.calc.extract(sourceFor(this.id), inflateRaw));
    return p.then(function (data) {
      self.data = data;
      self.rec = L.clone(data.inputs);
      self.recRes = self.calc.calc(self.rec);
      if (!self.mine) self.mine = L.clone(data.inputs);
      self.panel.removeChild(self.loading);
      self.panel.appendChild(self.banner); self.panel.appendChild(self.keys); self.panel.appendChild(self.body);
      self.render();
    }, function (err) {
      delete cache[self.id];
      self.loading.textContent = 'The recorded run’s files could not be read here (' + (err && err.message || err) + '). The replay is unaffected.';
    });
  };
  Panel.prototype.cur = function () { return this.mode === 'mine' ? this.mine : this.rec; };
  Panel.prototype.setMode = function (m) {
    if (m === this.mode) return;
    this.mode = m; this.render();
  };
  Panel.prototype.reset = function () {
    if (!this.rec) return;
    this.mine = L.clone(this.rec); this.mode = 'mine'; this.render();
  };
  Panel.prototype.changes = function () { return diffCount(this.rec, this.mine); };
  Panel.prototype.render = function () {
    var self = this, edit = this.mode === 'mine';
    this.btnRec.setAttribute('aria-pressed', String(!edit)); this.btnMine.setAttribute('aria-pressed', String(edit));
    this.btnReset.disabled = !edit;
    var st = this.inCol.scrollTop, st2 = this.outCol.scrollTop, bt = this.body.scrollTop;
    this.inCol.textContent = '';
    this.inCol.appendChild(h('div', { class: 'ffl-colhead' }, [h('h3', { text: edit ? 'Inputs · your numbers' : 'Inputs · recorded run' }), h('span', { class: 'ffl-pill ' + (edit ? 'is-mine' : 'is-rec'), text: edit ? 'Editable' : 'Read-only' })]));
    this.ctx = makeCtx(this, this.cur(), this.rec, edit);
    this.ui.inputs(this.ctx, this.inCol);
    this.renderResults();
    this.inCol.scrollTop = st; this.outCol.scrollTop = st2; this.body.scrollTop = bt;
  };
  Panel.prototype.renderResults = function () {
    var edit = this.mode === 'mine', res, err = null;
    try { res = this.calc.calc(this.cur()); } catch (e) { err = e; }
    var st = this.outCol.scrollTop;
    this.outCol.textContent = '';
    this.outCol.appendChild(h('div', { class: 'ffl-colhead' }, [h('h3', { text: edit ? 'Results · your numbers' : 'Results · recorded run' }), h('span', { class: 'ffl-pill ' + (edit ? 'is-mine' : 'is-rec'), text: edit ? 'Your numbers' : 'Recorded run' })]));
    if (err) { this.outCol.appendChild(h('div', { class: 'ffl-card' }, [h('h4', { text: 'These inputs cannot be calculated yet' }), h('p', { class: 'ffl-note', text: String(err && err.message || err) })])); return; }
    this.res = res;
    var rctx = makeCtx(this, this.cur(), this.rec, edit);
    rctx.res = res; rctx.recRes = this.recRes;
    this.ui.results(rctx, this.outCol, res, this.recRes);
    this.outCol.scrollTop = st;
    // banner
    var n = edit ? this.changes() : 0;
    this.banner.className = 'ffl-banner' + (edit ? ' is-mine' : '');
    this.banner.textContent = '';
    if (edit) {
      this.banner.appendChild(h('span', { class: 'ffl-pill is-mine', text: 'Your numbers' }));
      this.banner.appendChild(h('span', null, n ? [h('b', { text: n + (n === 1 ? ' input changed' : ' inputs changed') }), ' from the recorded run. Figures and checks recalculate as you type. Nothing is saved or sent; the replay behind this panel is unchanged.']
        : [h('b', { text: 'Starting from the recorded run.' }), ' Edit any white field and every figure and check recalculates. With no changes the figures match the replay to the cent.']));
    } else {
      this.banner.appendChild(h('span', { class: 'ffl-pill is-rec', text: 'Recorded run' }));
      this.banner.appendChild(h('span', null, [h('b', { text: 'The recorded run’s inputs and figures,' }), ' recalculated here from its own files; they match the replay to the cent. Switch to Your numbers to edit.']));
    }
    // key figures
    this.keys.textContent = '';
    var self = this;
    (this.ui.keys(res, this.recRes) || []).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'ffl-key' + (k.tone ? ' is-' + k.tone : ''), onclick: function () { self.outCol.focus({ preventScroll: true }); (self.body.scrollHeight > self.body.clientHeight ? self.outCol : self.outCol).scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, [
        h('span', { text: k.label }), h('strong', { text: k.value }), edit && k.rec != null && k.rec !== k.value ? h('em', { text: 'Recorded ' + k.rec }) : null
      ]);
      self.keys.appendChild(b);
    });
  };
  Panel.prototype.changed = function () {
    var self = this; clearTimeout(this.timer);
    this.timer = setTimeout(function () { self.renderResults(); }, 120);
  };
  Panel.prototype.download = function () {
    if (!this.res) return;
    var edit = this.mode === 'mine', n = edit ? this.changes() : 0;
    var rows = [['F1 Finance', 'Try your own numbers', this.ui.title], ['Company', this.data.entity || 'HANGS Construction Services LLC'],
      ['Mode', edit ? (n ? 'Your numbers (' + n + ' inputs changed from the recorded run)' : 'Your numbers (same as the recorded run)') : 'Recorded run'],
      ['Note', 'Demonstration data. A person reviews every figure; nothing here is filed, posted or paid.'], []];
    rows = rows.concat(this.ui.csv(this.res, this.cur(), this.recRes, edit));
    var blob = new Blob(['﻿' + L.csv(rows)], { type: 'text/csv;charset=utf-8' });
    var a = h('a', { href: URL.createObjectURL(blob), download: 'f1-finance-' + this.id + '-' + (edit ? 'your-numbers' : 'recorded-run') + '.csv' });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  function diffCount(a, b) {
    if (a === b) return 0;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.0005 ? 0 : 1;
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return (a == null ? '' : String(a)) === (b == null ? '' : String(b)) ? 0 : 1;
    var n = 0;
    if (Array.isArray(a) || Array.isArray(b)) {
      a = a || []; b = b || []; var m = Math.max(a.length, b.length);
      for (var i = 0; i < m; i++) n += (i < a.length && i < b.length) ? diffCount(a[i], b[i]) : 1;
      return n;
    }
    var keys = {}; for (var k in a) keys[k] = 1; for (var k2 in b) keys[k2] = 1;
    for (var kk in keys) if (kk.charAt(0) !== '_') n += diffCount(a[kk], b[kk]);
    return n;
  }
  FF.diffCount = diffCount;

  // ---- context the per-demo modules build with -----------------------------------------------------------------
  function makeCtx(panel, cur, rec, edit) {
    var ctx = { edit: edit, cur: cur, rec: rec, panel: panel, h: h, fmt: fmt, L: L };
    function mark(input, obj, key, recObj, type) {
      var changed = edit && recObj != null && diffCount(obj[key], recObj[key]) > 0;
      if (edit && recObj == null) changed = true;
      input.classList.toggle('is-changed', !!changed);
    }
    function bind(input, obj, key, type, recObj, opt) {
      opt = opt || {};
      var ev = type === 'check' || type === 'select' || type === 'date' || opt.structural ? 'change' : 'input';
      input.addEventListener(ev, function () {
        var v = type === 'check' ? input.checked : type === 'select' && input._vals ? input._vals[input.selectedIndex] : parse(input.value, type);
        if (type === 'date' && v && !L.validDate(v)) return;
        obj[key] = v;
        mark(input, obj, key, recObj, type);
        if (opt.onChange) opt.onChange(v);
        if (opt.structural) panel.render(); else panel.changed();
      });
      if (type === 'money' || type === 'int' || type === 'pct') input.addEventListener('blur', function () { input.value = inputText(obj[key], type); });
      mark(input, obj, key, recObj, type);
    }
    // an input element for obj[key]
    ctx.input = function (obj, key, type, recObj, opt) {
      opt = opt || {}; type = type || 'text';
      var ro = !edit || opt.readOnly, el;
      if (type === 'select') {
        el = h('select', { class: 'ffl-in' + (opt.cls ? ' ' + opt.cls : ''), disabled: ro ? true : null, 'aria-label': opt.label || key });
        el._vals = (opt.options || []).map(function (o) { return typeof o === 'object' ? o.value : o; });
        (opt.options || []).forEach(function (o) { var val = typeof o === 'object' ? o.value : o, lab = typeof o === 'object' ? o.label : o; el.appendChild(h('option', { value: val, selected: String(obj[key]) === String(val) ? true : null }, lab)); });
      } else if (type === 'check') {
        el = h('input', { type: 'checkbox', disabled: ro ? true : null, 'aria-label': opt.label || key });
        el.checked = !!obj[key];
      } else {
        var isNum = type === 'money' || type === 'int' || type === 'pct' || type === 'number';
        el = h('input', { class: 'ffl-in' + (isNum ? ' is-num' : '') + (opt.cls ? ' ' + opt.cls : ''), type: type === 'date' ? 'date' : 'text', inputmode: isNum ? (type === 'int' ? 'numeric' : 'decimal') : null, readonly: ro ? true : null, 'aria-label': opt.label || key, value: inputText(obj[key], type), spellcheck: 'false', autocomplete: 'off' });
      }
      if (!ro) bind(el, obj, key, type, recObj, opt); else el.tabIndex = opt.label ? 0 : -1;
      return el;
    };
    ctx.field = function (label, obj, key, type, recObj, opt) {
      opt = opt || {}; opt.label = opt.label || label;
      var el = ctx.input(obj, key, type, recObj, opt);
      if (type === 'check') return h('label', { class: 'ffl-field' }, [h('span', { text: label }), h('span', { class: 'ffl-check' }, [el, opt.checkText || ''])]);
      return h('label', { class: 'ffl-field' }, [h('span', { text: label }), el, opt.help ? h('small', { text: opt.help }) : null]);
    };
    ctx.card = function (title, sub, kids) { return h('div', { class: 'ffl-card' }, [title ? h('h4', { text: title }) : null, sub ? h('p', { class: 'ffl-sub', text: sub }) : null].concat(kids || [])); };
    ctx.note = function (text, ro) { return h('p', { class: 'ffl-note' + (ro ? ' is-ro' : '') }, text); };
    ctx.fields = function (kids) { return h('div', { class: 'ffl-fields' }, kids); };
    // editable list: cols [{key,label,type,options,cls,readOnly,get(row,i)}]
    ctx.table = function (cols, rows, recRows, opt) {
      opt = opt || {};
      var thead = h('tr', null, cols.map(function (c) { return h('th', { class: /money|int|pct|number/.test(c.type) || c.num ? 'is-num' : null, text: c.label }); }).concat(edit && opt.remove !== false && opt.add ? [h('th', { class: 'ffl-sr', text: 'Remove' })] : []));
      var body = h('tbody');
      rows.forEach(function (row, i) {
        var recRow = recRows && recRows[i];
        var tr = h('tr', { class: opt.rowClass ? opt.rowClass(row, i) : null });
        cols.forEach(function (c) {
          var td = h('td', { class: (/money|int|pct|number/.test(c.type) || c.num) ? 'is-num' : (c.wrap ? 'is-wrap' : null) });
          if (c.get) td.appendChild(document.createTextNode(c.get(row, i)));
          else td.appendChild(ctx.input(row, c.key, c.type, recRow || null, { label: c.label + ' ' + (i + 1), options: c.options, cls: c.cls, readOnly: c.readOnly || (c.readOnlyIf && c.readOnlyIf(row, i)), structural: c.structural, onChange: c.onChange && function (v) { c.onChange(row, v, i); } }));
          tr.appendChild(td);
        });
        if (edit && opt.add && opt.remove !== false) tr.appendChild(h('td', null, h('button', { type: 'button', class: 'ffl-rm', 'aria-label': 'Remove row ' + (i + 1), title: 'Remove this row', onclick: function () { rows.splice(i, 1); panel.render(); } }, '×')));
        body.appendChild(tr);
      });
      var wrap = h('div', null, [h('div', { class: 'ffl-scroll' }, h('table', { class: 'ffl-table' }, [h('thead', null, thead), body]))]);
      if (edit && opt.add) wrap.appendChild(h('button', { type: 'button', class: 'ffl-btn ffl-add', onclick: function () { rows.push(opt.add()); panel.render(); } }, '+ ' + (opt.addLabel || 'Add a row')));
      return wrap;
    };
    // read-only data table: cols [{label, key|get, fmt, num, wrap}], rows
    ctx.data = function (cols, rows, opt) {
      opt = opt || {};
      var thead = h('tr', null, cols.map(function (c) { return h('th', { class: c.num || /money|int|usd|pct/.test(c.fmt) ? 'is-num' : null, text: c.label }); }));
      var body = h('tbody', null, rows.map(function (r, i) {
        return h('tr', { class: opt.rowClass ? opt.rowClass(r, i) : (r._strong ? 'is-strong' : null) }, cols.map(function (c) {
          var v = c.get ? c.get(r, i) : r[c.key];
          var cls = (c.num || /money|int|usd|pct/.test(c.fmt) ? 'is-num' : '') + (c.wrap ? ' is-wrap' : '') + (c.cls ? ' ' + (typeof c.cls === 'function' ? c.cls(r, i) || '' : c.cls) : '');
          return h('td', { class: cls.trim() || null }, v instanceof Node ? v : fmt(v, c.fmt));
        }));
      }));
      return h('div', { class: 'ffl-scroll' }, h('table', { class: 'ffl-table' }, [h('thead', null, thead), body]));
    };
    // figures: rows [{label, v, r, fmt, strong, sub}] -> Your numbers vs Recorded
    ctx.figures = function (rows) {
      var cols = edit ? [{ label: 'Line', get: function (r) { return r.label; }, wrap: true }, { label: 'Your numbers', get: function (r) { return fmt(r.v, r.fmt || 'money'); }, num: true, cls: function (r) { return diffCount(r.v, r.r) ? 'is-diff' : ''; } }, { label: 'Recorded run', get: function (r) { return fmt(r.r, r.fmt || 'money'); }, num: true }]
        : [{ label: 'Line', get: function (r) { return r.label; }, wrap: true }, { label: 'Recorded run', get: function (r) { return fmt(r.v, r.fmt || 'money'); }, num: true }];
      return ctx.data(cols, rows, { rowClass: function (r) { return r.strong ? 'is-strong' : r.sub ? 'is-sub' : null; } });
    };
    ctx.checks = function (list) {
      return h('ul', { class: 'ffl-checks' }, list.map(function (c) {
        var tone = c.ok === true ? 'ok' : c.ok === 'warn' ? 'warn' : 'bad';
        return h('li', { class: 'is-' + tone }, [h('i', { 'aria-hidden': 'true', text: tone === 'ok' ? '✓' : tone === 'warn' ? '!' : '×' }), h('b', { text: c.label + (tone === 'ok' ? '' : tone === 'warn' ? ' · review' : ' · fails') }), h('span', { text: c.detail || '' })]);
      }));
    };
    ctx.tag = function (text, tone) { return h('span', { class: 'ffl-tag is-' + (tone || 'info'), text: text }); };
    ctx.sources = function (list) { return h('ol', { class: 'ffl-sources' }, list.map(function (s) { return h('li', null, s.url ? [h('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.title })].concat(s.note ? [' · ' + s.note] : []) : s.title); })); };
    ctx.rerender = function () { panel.render(); };
    ctx.changed = function () { panel.changed(); };
    return ctx;
  }

  function icon(n) {
    var p = { reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>', down: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>' }[n];
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = p; return s;
  }

  // ---- the demo's own data files (relative to the demo page) -------------------------------------------------
  function sourceFor(id) {
    var get = function (p, bin) { return fetch(p, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return bin ? r.arrayBuffer().then(function (b) { return new Uint8Array(b); }) : r.text(); }); };
    return L.makeSource(function (p) { return get(p, false); }, function (p) { return get(p, true); }, /^tax-/.test(id) ? ['data/manifest.json', 'data/routes.json'] : ['data/routes.json', 'data/manifest.json']);
  }
  function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('this browser cannot open the workbook (no DecompressionStream)'));
    var s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  // ---- open / close ------------------------------------------------------------------------------------------
  var current = null, lastFocus = null;
  FF.open = function (id) {
    if (!FF.calc[id] || !FF.ui[id]) return;
    lastFocus = document.activeElement;
    if (current && current.id === id) { current.root.hidden = false; }
    else { if (current) current.root.remove(); current = new Panel(id); current.build(); current.load(); }
    document.documentElement.classList.add('ffl-lock');
    setTimeout(function () { try { current.btnX.focus(); } catch (e) { } }, 30);
  };
  FF.close = function () {
    if (!current || current.root.hidden) return;
    current.root.hidden = true;
    document.documentElement.classList.remove('ffl-lock');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
  };
  FF.isOpen = function () { return !!(current && !current.root.hidden); };
  FF.panel = function () { return current; };
  // Escape closes this panel only, and never reaches the replay underneath
  W.addEventListener('keydown', function (e) {
    if (!FF.isOpen()) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopImmediatePropagation(); FF.close(); return; }
    if (e.key === 'Tab') {   // keep focus inside the panel
      var f = [].slice.call(current.root.querySelectorAll('button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled]),summary,a[href],[tabindex="0"]')).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  // demo/tweaks.js handles Escape first (window, capture) and stops it once the replay's results are up; it closes the
  // client systems through window.__ffSystems. Let that same step close this panel too: systems first if both are open.
  W.__ffLive = { isOpen: function () { return FF.isOpen(); }, close: function () { FF.close(); } };
  try {
    var sys = W.__ffSystems;
    if (sys && !sys.__ffl) {
      var wrap = {}; for (var k in sys) wrap[k] = sys[k];
      wrap.__ffl = true;
      wrap.isOpen = function () { return sys.isOpen() || FF.isOpen(); };
      wrap.close = function () { if (sys.isOpen()) sys.close(); else FF.close(); };
      W.__ffSystems = wrap;
    }
  } catch (e) { }
  ['keyup', 'keypress'].forEach(function (t) { W.addEventListener(t, function (e) { if (FF.isOpen() && (e.key === 'Escape' || e.key === 'Esc')) e.stopImmediatePropagation(); }, true); });
})();
