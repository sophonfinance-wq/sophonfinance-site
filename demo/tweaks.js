/* F1 Finance demos, shared tweaks (loaded first by every demo page).
   1. One tap runs it: after a visitor taps the run button, the confirmation step is accepted for them.
   2. Replays run 5% slower so people can read along: the page clock, timers, animation frames and
      CSS animations all run at 0.95 speed, so everything stays in step. */
(function () {
  var RATE = 0.95;

  // ---- 1. slow the clock evenly -------------------------------------------------------------------
  try {
    var perf = window.performance, realNow = perf.now.bind(perf), p0 = realNow();
    var scaledNow = function () { return p0 + (realNow() - p0) * RATE; };
    perf.now = scaledNow;
    var RealDate = Date, d0 = RealDate.now(), dRealNow = RealDate.now;
    Date.now = function () { return d0 + (dRealNow() - d0) * RATE; };
    var rAF = window.requestAnimationFrame;
    if (rAF) window.requestAnimationFrame = function (cb) { return rAF.call(window, function () { cb(scaledNow()); }); };
    var sT = window.setTimeout, sI = window.setInterval;
    window.setTimeout = function (fn, ms) { var a = [].slice.call(arguments); a[1] = (+ms || 0) / RATE; return sT.apply(window, a); };
    window.setInterval = function (fn, ms) { var a = [].slice.call(arguments); a[1] = (+ms || 0) / RATE; return sI.apply(window, a); };
    var slowAnims = function () {
      if (!document.getAnimations) return;
      document.getAnimations().forEach(function (an) { if (an.playbackRate !== RATE) an.playbackRate = RATE; });
    };
    sI.call(window, slowAnims, 250);
  } catch (e) { /* never block the demo */ }

  // ---- 2. one tap runs it -------------------------------------------------------------------------
  var armed = 0;
  var css = document.createElement('style');
  css.textContent = 'html.ff-autostart section.dialog, html.ff-autostart .dialog-backdrop, html.ff-autostart [class*="backdrop"]{ opacity:0 !important; pointer-events:none !important; }';
  (document.head || document.documentElement).appendChild(css);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button.simple-primary, .simple-primary button');
    if (b) { armed = dRealNow(); document.documentElement.classList.add('ff-autostart'); }
  }, true);
  var accept = function () {
    if (!armed) return;
    if (dRealNow() - armed > 4000) { armed = 0; document.documentElement.classList.remove('ff-autostart'); return; }
    var dlg = document.querySelector('section.dialog');
    if (!dlg) return;
    var start = [].slice.call(dlg.querySelectorAll('button.is-primary')).filter(function (x) { return /^(Start|Run|Begin|Prepare)/i.test((x.textContent || '').trim()); })[0];
    if (start) {
      armed = 0;
      start.click();
      sT.call(window, function () { document.documentElement.classList.remove('ff-autostart'); }, 400);
    }
  };
  new MutationObserver(accept).observe(document.documentElement, { childList: true, subtree: true });

  // ---- 3. web-demo polish: replay wording, and hide controls that only work in the desktop machine ----
  var hide = document.createElement('style');
  hide.textContent =
    '.sys-restore, .simple-filing:has(.simple-filing-badge.is-coming), a[href*="/api/hangs/accounting/export/"], .ff-hidden{ display:none !important; }';
  (document.head || document.documentElement).appendChild(hide);
  var WORDS = [
    [/^Watch the Live (.+)$/, 'Watch the $1'],
    [/^Watch Live (.+)$/, 'Watch the $1'],
    [/^Live Calculations$/, 'Calculations'],
    [/^Live Log$/, 'Run Log'],
    [/^Live status$/i, 'Run status'],
    [/^Live, (\d+) lines?$/, 'Run log, $1 lines'],
    [/^Paused, reconnecting$/, 'Paused'],
    [/^(Demo )?Engine (On|Off)$/, 'Web Demo'],
    [/^Version [\d.]+, port \d+.*$/, 'Plays back one recorded run. Nothing is sent anywhere.'],
    [/^No runs yet\. Press the key to start one\.$/, 'No runs yet.'],
    [/^The engine ends the run and every process it started\..*$/, 'The playback stops here. You can start it again from the beginning.'],
    [/^Engine$/, 'Method']
  ];
  var DEAD = /^(Restore Demo Data|Add Document|Import Invoice|Attach Document)$/;
  var fixNode = function (n) {
    if (n.nodeType === 3) {
      var v = n.nodeValue, t = v.trim(); if (!t || t.length > 200) return;
      for (var i = 0; i < WORDS.length; i++) { if (WORDS[i][0].test(t)) { n.nodeValue = v.replace(t, t.replace(WORDS[i][0], WORDS[i][1])); return; } }
      return;
    }
    if (n.nodeType !== 1) return;
    if ((n.tagName === 'BUTTON' || n.tagName === 'A' || n.tagName === 'LABEL') && DEAD.test((n.textContent || '').trim())) n.classList.add('ff-hidden');
    var w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), c;
    while ((c = w.nextNode())) { if (c.nodeType === 3) fixNode(c); else if ((c.tagName === 'BUTTON' || c.tagName === 'A' || c.tagName === 'LABEL') && DEAD.test((c.textContent || '').trim())) c.classList.add('ff-hidden'); }
  };
  var pending = [], queued = false;
  var flush = function () { queued = false; var list = pending; pending = []; for (var i = 0; i < list.length; i++) fixNode(list[i]); };
  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.type === 'characterData') pending.push(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) pending.push(m.addedNodes[j]);
    }
    if (!queued) { queued = true; sT.call(window, flush, 30); }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener('DOMContentLoaded', function () { fixNode(document.body); });
})();

// ---- 4. spoken narration with captions (demo/narration.js; plays only where demo/narration/<id>/cues.json exists) ----
(function () {
  var load = function () {
    try {
      if (document.querySelector('script[data-ff-narration]')) return;
      var s = document.createElement('script');
      s.src = '../narration.js';
      s.async = true;
      s.setAttribute('data-ff-narration', '');
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { /* never block the demo */ }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();

// ---- 5. client systems: the system buttons open the shared systems app (demo/systems/) in a panel over the replay.
//         The replay keeps playing underneath; nothing here touches its clock or its state. ----
(function () {
  try {
    var m = /\/demo\/([a-z0-9-]+)\/(index\.html)?$/i.exec(location.pathname);
    if (!m || m[1] === 'systems') return;
    var DEMO = m[1];
    var APP = { ledgerwyn: 'ledgerwyn', charterfold: 'charterfold', vellumrow: 'vellumrow', quillpost: 'quillpost', taxrules: 'taxrules', confirmations: 'charterfold', accounting: 'ledgerwyn', records: 'charterfold', invoices: 'vellumrow', email: 'quillpost' };
    var ready = false, ov = null, frame = null, lastFocus = null;
    var css = document.createElement('style');
    css.textContent =
      '.ffs-ov{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,24,28,.58);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}' +
      '.ffs-ov[hidden]{display:none}' +
      '.ffs-panel{width:min(1280px,100%);height:min(920px,100%);display:flex;flex-direction:column;background:#f3f6f8;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.55)}' +
      '.ffs-head{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px;padding-top:calc(6px + env(safe-area-inset-top));background:#082d33;color:#cfe9e5;font:600 13px/1.2 "Segoe UI",-apple-system,BlinkMacSystemFont,system-ui,sans-serif}' +
      '.ffs-head span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ffs-head a,.ffs-head button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 12px;border-radius:9px;border:1px solid rgba(95,208,195,.35);background:transparent;color:#fff;font:inherit;text-decoration:none;cursor:pointer}' +
      '.ffs-head a:hover,.ffs-head button:hover{background:rgba(95,208,195,.15)}' +
      '.ffs-head button.ffs-x{width:40px;padding:0;font-size:22px;line-height:1}' +
      '.ffs-panel iframe{flex:1;width:100%;border:0;background:#f3f6f8}' +
      '.ff-sys-open{display:inline-flex !important;align-items:center;gap:6px}' +
      '.ff-sys-open svg{width:16px;height:16px;flex:none}' +
      'html.ffs-lock,html.ffs-lock body{overflow:hidden !important}' +
      '@media (max-width:640px){.ffs-ov{padding:0}.ffs-panel{width:100%;height:100%;border-radius:0}.ffs-head .ffs-new{display:none}.ff-sys-open .ffs-word{display:none}}' +
      '@media (max-width:440px){.ff-sys-hdr>span{display:none}.ff-sys-hdr{min-width:40px;justify-content:center}}';
    (document.head || document.documentElement).appendChild(css);

    var url = function (app, extra) { return '../systems/?d=' + encodeURIComponent(DEMO) + '&app=' + encodeURIComponent(app) + (extra || ''); };
    var close = function () {
      if (!ov || ov.hidden) return;
      ov.hidden = true;
      document.documentElement.classList.remove('ffs-lock');
      if (frame) frame.src = 'about:blank';
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    };
    var open = function (app, extra) {
      lastFocus = document.activeElement;
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'ffs-ov';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.setAttribute('aria-label', 'F1 Finance client systems');
        ov.innerHTML = '<div class="ffs-panel"><div class="ffs-head"><span>F1 Finance · Client systems</span><a class="ffs-new" target="_blank" rel="noopener">Open in a new tab</a><button type="button" class="ffs-x" aria-label="Close the client systems">×</button></div><iframe title="F1 Finance client systems"></iframe></div>';
        frame = ov.querySelector('iframe');
        ov.querySelector('.ffs-x').addEventListener('click', close);
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        document.body.appendChild(ov);
      }
      var u = url(app, extra);
      frame.src = u;
      ov.querySelector('.ffs-new').href = u;
      ov.hidden = false;
      document.documentElement.classList.add('ffs-lock');
      setTimeout(function () { var x = ov.querySelector('.ffs-x'); if (x) x.focus(); }, 30);
    };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov && !ov.hidden) close(); });
    window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.ffSystems === 'close') close(); });

    // the file a dead download link belongs to, so the document opens in the cabinet instead
    var fileNear = function (a) {
      for (var el = a; el && el !== document.body; el = el.parentElement) {
        var t = (el.textContent || '').slice(0, 2000);
        var mm = /([^\/\\\n]+?\.(pdf|xlsx|xls|docx|doc|eml|csv))\b/i.exec(t);
        if (mm) return mm[1].replace(/^.*?(\d{2} [A-Z][^\/]*\/)?/, '').trim();
      }
      return '';
    };

    document.addEventListener('click', function (e) {
      if (!ready || !e.target || !e.target.closest) return;
      var btn = e.target.closest('.app-button[data-app], .ff-sys-open');
      var link = btn ? null : e.target.closest('a[href]');
      var app = null, extra = '';
      if (btn) app = btn.classList.contains('ff-sys-open') ? 'ledgerwyn' : APP[btn.getAttribute('data-app')];
      else if (link) {
        var h = link.getAttribute('href') || '';
        var sm = /systems\.html\?(?:[^#]*&)?(?:system|s)=([a-z]+)/i.exec(h) || /^(?:https?:\/\/(?:localhost|127\.0\.0\.1)[^\/]*)?\/systems\/([a-z]+)/i.exec(h);
        if (sm) app = APP[sm[1].toLowerCase()];
        else if (/unavailable\.html$/i.test(h)) { app = 'charterfold'; var f = fileNear(link); extra = f ? '&file=' + encodeURIComponent(f) : ''; }
      }
      if (!app) return;
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      open(app, extra);
    }, true);

    // a "Client Systems" entry in the header, so demos without system buttons reach the systems too
    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
    var entry = function (cls, extra) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = cls + ' ff-sys-open ' + extra;
      b.title = 'The client’s ledger, records, invoices, mail and rule checks. The replay keeps playing.';
      b.setAttribute('aria-label', 'Client systems');
      b.innerHTML = ICON + '<span><span class="ffs-word">Client </span>Systems</span>';
      return b;
    };
    var placeEntry = function () {
      if (!ready) return;
      // on the start page, next to History
      if (!document.querySelector('.ff-sys-hdr')) {
        var hist = [].slice.call(document.querySelectorAll('button.simple-nav-link, a.simple-nav-link')).filter(function (x) { return /^History$/i.test((x.textContent || '').trim()); })[0];
        if (hist && hist.parentNode) hist.parentNode.insertBefore(entry(hist.className, 'ff-sys-hdr'), hist);
      }
      // while a replay plays, in its controls (the run covers the header)
      var ctl = document.querySelector('.property-play-controls');
      if (ctl && !ctl.querySelector('.ff-sys-run')) {
        var ref = [].slice.call(ctl.querySelectorAll('button')).filter(function (x) { return /^Details$/i.test((x.textContent || '').trim()); })[0];
        var nb = entry(ref ? ref.className : 'button is-quiet', 'ff-sys-run');
        if (ref && ref.nextSibling) ctl.insertBefore(nb, ref.nextSibling); else ctl.appendChild(nb);
      }
    };
    var waiting = false;
    new MutationObserver(function () { if (waiting) return; waiting = true; setTimeout(function () { waiting = false; placeEntry(); }, 150); }).observe(document.documentElement, { childList: true, subtree: true });

    // take over only when this demo's systems dataset exists
    var x = new XMLHttpRequest();
    x.open('HEAD', 'systems.json', true);
    x.onload = function () { if (x.status >= 200 && x.status < 300) { ready = true; placeEntry(); } };
    x.send();
  } catch (e) { /* never block the demo */ }
})();
