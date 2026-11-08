/* F1 Finance demos, shared tweaks (loaded first by every demo page).
   1. One tap runs it: after a visitor taps the run button, the confirmation step is accepted for them.
   2. Replays run 5% slower so people can read along: the page clock, timers, animation frames and
      CSS animations all run at 0.95 speed, so everything stays in step.
   Further down: 3. web-demo wording, 4. narration loader, 5. client systems panel,
   6. results stay in view after Skip, close buttons on document close-ups, "Reopen document",
      and Escape closing only the topmost thing. */
(function () {
  var RATE = 0.95;

  // ---- 1. slow the clock evenly -------------------------------------------------------------------
  try {
    var perf = window.performance, realNow = perf.now.bind(perf), p0 = realNow();
    var scaledNow = function () { return p0 + (realNow() - p0) * RATE; };
    perf.now = scaledNow;
    var RealDate = Date, d0 = RealDate.now(), dRealNow = RealDate.now;
    window.__ffRealNow = function () { return dRealNow.call(RealDate); }; // wall-clock time for narration timing
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
      '@media (max-width:440px){.ff-sys-hdr>span{display:none}.ff-sys-hdr{min-width:40px;justify-content:center}}' +
      /* while the narration caption bar is docked at the bottom, the panel stops above it so the captions stay readable */
      'html.ffn-bar .ffs-ov{bottom:var(--ffn-res,0px)}';
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
    // Escape is handled in section 6 (it closes only the topmost thing on screen)
    window.__ffSystems = { isOpen: function () { return !!(ov && !ov.hidden); }, close: close, open: function (app, extra) { open(app, extra); }, ready: function () { return ready; } };
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

// ---- 6. results stay in view, and every document close-up can be closed.
//      * Each document close-up (the bundle's .flight-card inside .flight-layer) gets a visible close button.
//      * "Skip to Results" (and the results screen itself) sends the close-ups away (html.ff-past hides
//        .flight-layer), so the calculations panel is never covered. The replay's own timing is untouched:
//        the close-up animations keep running unseen and end on their own.
//      * The close-up that was on screen can be reopened: a "Reopen document" button joins the replay
//        controls and opens a copy of it in a small viewer with a close button (and a link to the same file
//        in the client systems when the demo has them).
//      * Escape closes only the topmost thing: the viewer, then the client systems, then a close-up, then a
//        dialog stacked over the replay. It never closes the replay or its results. ----
(function () {
  try {
    var de = document.documentElement;
    var past = false, awaitRun = false, last = null, dismissed = null, viewer = null, chip = null, btnX = null, loopOn = false, lastFocus = null;
    var css = document.createElement('style');
    css.textContent =
      'html.ff-past .flight-layer:not(.ffv-layer),.flight-layer.ff-dismissed{visibility:hidden !important;opacity:0 !important;pointer-events:none !important}' +
      '.ffv-x{position:fixed;z-index:4700;display:none;align-items:center;justify-content:center;width:40px;height:40px;padding:0;border:0;border-radius:999px;background:rgba(255,255,255,.96);color:#14303a;cursor:pointer;' +
      'box-shadow:0 8px 22px -8px rgba(16,28,64,.55),0 0 0 1px rgba(16,28,64,.12);touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
      '.ffv-x.is-on{display:inline-flex}.ffv-x:hover{background:#fff;box-shadow:0 10px 26px -8px rgba(16,28,64,.6),0 0 0 1px rgba(16,28,64,.2)}' +
      '.ffv-x:focus-visible,.ffv-head button:focus-visible{outline:2px solid #5fd4c4;outline-offset:2px}.ffv-x svg{width:18px;height:18px}' +
      '.ff-doc-reopen{display:inline-flex !important;align-items:center;gap:6px}.ff-doc-reopen svg{width:16px;height:16px;flex:none}' +
      '.ffv-m{display:none}' +
      /* phones: the results controls (Replay, Details, Systems, Document) stay on one row */
      '@media (max-width:700px){.property-play-controls:has(> .ff-doc-reopen):not(:has(> .ff-live-run))>.button{flex-basis:calc(25% - 6px)}}' +
      '.ffv-ov{position:fixed;inset:0;z-index:2147483500;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,24,28,.58);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}' +
      'html.ffn-bar .ffv-ov,html.ffn-bar .ffl-root{bottom:var(--ffn-res,0px)}.ffv-ov[hidden]{display:none}' +
      '.ffv-panel{width:min(1000px,100%);max-height:100%;display:flex;flex-direction:column;background:#f3f6f8;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.55)}' +
      '.ffv-head{flex:none;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px;padding-top:calc(6px + env(safe-area-inset-top));background:#082d33;color:#cfe9e5;font:600 13px/1.2 "Segoe UI",-apple-system,BlinkMacSystemFont,system-ui,sans-serif}' +
      '.ffv-head>span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ffv-head button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 12px;border-radius:9px;border:1px solid rgba(95,208,195,.35);background:transparent;color:#fff;font:inherit;cursor:pointer}' +
      '.ffv-head button[hidden]{display:none}.ffv-head button svg{width:16px;height:16px;flex:none}' +
      '.ffv-head button:hover{background:rgba(95,208,195,.15)}.ffv-head button.ffv-close{width:40px;padding:0;font-size:22px;line-height:1}' +
      '.ffv-body{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:14px}' +
      '.ffv-layer{position:static !important;inset:auto !important;z-index:auto !important;display:block !important;overflow:visible !important;pointer-events:auto !important;visibility:visible !important;opacity:1 !important}' +
      '.ffv-layer .flight-veil,.ffv-layer .flight-sheen{display:none !important}' +
      '.ffv-layer .flight-card{position:relative !important;left:auto !important;top:auto !important;transform:none !important;opacity:1 !important;width:100% !important;height:auto !important;max-width:none !important;max-height:none !important;margin:0 !important;contain:none !important;box-shadow:0 2px 12px rgba(16,28,64,.12),0 0 0 1px rgba(16,28,64,.08) !important}' +
      '.ffv-layer .flight-sheet{overflow:auto !important;flex:none !important}' +
      '.ffv-layer .flight-page{position:relative !important;inset:auto !important;transform:none !important}' +
      '.ffv-layer .flight-excel table{width:max-content !important;min-width:100%;table-layout:auto !important}' +
      '.ffv-layer .flight-excel th,.ffv-layer .flight-excel td{white-space:nowrap !important;overflow:visible !important;max-width:none !important}' +
      '.ffv-layer *{animation:none !important;transition:none !important}' +
      '@media (max-width:640px){.ffv-ov{padding:0}.ffv-panel{width:100%;height:100%;border-radius:0}.ffv-body{padding:8px}.ffv-w{display:none}.ffv-m{display:inline}}';
    (document.head || document.documentElement).appendChild(css);

    var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    var DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
    var label = function (b) { return ((b.getAttribute('aria-label') || b.textContent || '') + '').replace(/\s+/g, ' ').trim(); };
    var shown = function (el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    var pres = function () { return document.querySelector('section.dialog.is-presentation'); };
    var stop = function (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); };
    var ACT_PLAY = '[data-action="playback-pause"],[data-action="playback-play"],[data-action="playback-skip"],[data-action="pause-run"],[data-action="resume-run"],[data-action="skip-to-results"]';
    var playing = function (d) {
      if (d.querySelector(ACT_PLAY)) return true;
      var bs = d.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) if (/^(Pause|Resume|Skip to (the End|Results))$/i.test(label(bs[i])) && shown(bs[i])) return true;
      return false;
    };
    var resultsUp = function (d) {
      if (!d || playing(d)) return false;
      if (d.querySelector('[data-action="review"],[data-action="evidence"]')) return true;
      var bs = d.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) if (/^(Review Figures|Replay)/i.test(label(bs[i])) && shown(bs[i])) return true;
      return false;
    };
    var docTitle = function (card) {
      var t = card && card.querySelector('.flight-label-text');
      var kind = t && t.querySelector('span') ? t.querySelector('span').textContent.trim() : '';
      var name = t && t.querySelector('strong') ? t.querySelector('strong').textContent.trim() : (t ? t.textContent.trim() : '');
      return { kind: kind, name: name || 'Document' };
    };
    var liveCard = function () {
      var cs = document.querySelectorAll('.flight-layer:not(.ffv-layer):not(.ff-dismissed) .flight-card');
      return cs.length ? cs[cs.length - 1] : null;
    };

    // ---- the close button on a document close-up ----
    var hideCard = function (card) {
      if (!card) return;
      dismissed = card;
      var layer = card.closest('.flight-layer');
      if (layer) layer.classList.add('ff-dismissed');
      if (btnX) btnX.classList.remove('is-on');
    };
    var track = function () {
      var card = past ? null : liveCard(), on = false;
      if (card) {
        var r = card.getBoundingClientRect(), op = 1;
        try { op = +getComputedStyle(card).opacity; } catch (e) { }
        if (r.width > 160 && r.height > 120 && op > 0.6 && r.top < innerHeight - 60) {
          if (!btnX) {
            btnX = document.createElement('button');
            btnX.type = 'button';
            btnX.className = 'ffv-x';
            btnX.setAttribute('aria-label', 'Close this document. The replay keeps playing.');
            btnX.title = 'Close this document';
            btnX.innerHTML = X;
            btnX.addEventListener('click', function (e) { stop(e); hideCard(liveCard()); });
            document.body.appendChild(btnX);
          }
          btnX.style.top = Math.max(8, r.top + 10) + 'px';
          btnX.style.left = Math.min(innerWidth - 48, r.right - 50) + 'px';
          on = true;
        }
      }
      if (btnX) btnX.classList.toggle('is-on', on);
      if (card) requestAnimationFrame(track); else loopOn = false;
    };
    var watchCard = function (card) {
      if (!card) return;
      var layer = card.closest('.flight-layer');
      if (layer && layer.classList.contains('ff-dismissed') && card !== dismissed) layer.classList.remove('ff-dismissed');
      if (!past) last = card; // after Skip the one that was on screen stays the one to reopen
      if (!loopOn) { loopOn = true; requestAnimationFrame(track); }
    };
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var a = ms[i].addedNodes;
        for (var j = 0; j < a.length; j++) {
          var n = a[j]; if (n.nodeType !== 1 || (n.closest && n.closest('.ffv-layer'))) continue;
          var c = n.classList && n.classList.contains('flight-card') ? n : (n.querySelector ? n.querySelector('.flight-card') : null);
          if (c) watchCard(c);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });

    // ---- the viewer for the last close-up ----
    var closeViewer = function () {
      if (!viewer || viewer.hidden) return;
      viewer.hidden = true;
      viewer.querySelector('.ffv-body').innerHTML = '';
      if (lastFocus && lastFocus.focus && lastFocus.isConnected) { try { lastFocus.focus(); } catch (e) { } }
    };
    var openViewer = function () {
      if (!last) return;
      lastFocus = document.activeElement;
      var t = docTitle(last);
      if (!viewer) {
        viewer = document.createElement('div');
        viewer.className = 'ffv-ov';
        viewer.hidden = true;
        viewer.setAttribute('role', 'dialog');
        viewer.setAttribute('aria-modal', 'true');
        viewer.innerHTML = '<div class="ffv-panel"><div class="ffv-head"><span></span><button type="button" class="ffv-sys" hidden>' + DOC + '<span class="ffv-w">Open in client files</span><span class="ffv-m">Files</span></button><button type="button" class="ffv-close" aria-label="Close the document">×</button></div><div class="ffv-body"></div></div>';
        viewer.querySelector('.ffv-close').addEventListener('click', closeViewer);
        viewer.addEventListener('click', function (e) { if (e.target === viewer) closeViewer(); });
        viewer.querySelector('.ffv-sys').addEventListener('click', function () {
          var nm = viewer.getAttribute('data-name') || '';
          closeViewer();
          if (window.__ffSystems) window.__ffSystems.open('charterfold', '&file=' + encodeURIComponent(nm));
        });
        document.body.appendChild(viewer);
      }
      viewer.setAttribute('aria-label', t.name);
      viewer.setAttribute('data-name', t.name);
      viewer.querySelector('.ffv-head > span').textContent = (t.kind ? t.kind + ' · ' : '') + t.name;
      viewer.querySelector('.ffv-sys').hidden = !(window.__ffSystems && window.__ffSystems.ready());
      var layer = document.createElement('div');
      layer.className = 'flight-layer ffv-layer';
      var copy = last.cloneNode(true);
      copy.removeAttribute('style');
      [].slice.call(copy.querySelectorAll('.flight-sheet, .flight-page')).forEach(function (n) { n.removeAttribute('style'); });
      layer.appendChild(copy);
      var body = viewer.querySelector('.ffv-body');
      body.innerHTML = '';
      body.appendChild(layer);
      viewer.hidden = false;
      setTimeout(function () { var x = viewer.querySelector('.ffv-close'); if (x) x.focus(); }, 30);
    };

    // ---- "Reopen document" in the replay controls ----
    var placeChip = function () {
      var d = past && last ? pres() : null, ctl = d ? d.querySelector('.property-play-controls') : null;
      // it lives in the replay controls; views without them (the figures review) simply do not show it
      if (!ctl) { if (chip) { chip.remove(); chip = null; } return; }
      if (chip && chip.isConnected && chip.parentNode === ctl) return;
      if (chip) chip.remove();
      var ref = [].slice.call(ctl.querySelectorAll('button')).filter(function (x) { return /^Details$/i.test(label(x)); })[0];
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = (ref ? ref.className : 'button is-quiet') + ' ff-doc-reopen';
      var t = docTitle(last);
      chip.title = 'Reopen ' + t.name;
      chip.setAttribute('aria-label', 'Reopen the document ' + t.name);
      chip.innerHTML = DOC + '<span class="ffv-w">Reopen document</span><span class="ffv-m">Document</span>';
      chip.addEventListener('click', function (e) { e.stopPropagation(); openViewer(); });
      ctl.appendChild(chip);
    };
    var setPast = function (v) {
      if (v === past) { placeChip(); return; }
      past = v;
      de.classList.toggle('ff-past', v);
      if (v) { if (btnX) btnX.classList.remove('is-on'); }
      else { last = null; closeViewer(); }
      placeChip();
    };

    // the visitor's taps: Skip sends the close-ups away; a new run or Replay brings them back
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('button');
      if (!b || b.closest('.ffv-ov, .ffs-ov') || b.classList.contains('ff-doc-reopen') || b.classList.contains('ffv-x')) return;
      var act = b.getAttribute('data-action') || '', lb = label(b);
      if (/^(playback-skip|skip-to-results|replay-to-results)$/.test(act) || /^Skip to (the End|Results)/i.test(lb)) { setPast(true); return; }
      if ((b.matches('button.simple-primary, .simple-primary button') && !pres()) || /^(run-again|replay)$/.test(act) || (/^(Replay|Run Again)/i.test(lb) && pres())) { setPast(false); awaitRun = true; }
    }, true);
    // the results screen came up (or the replay window closed)
    setInterval(function () {
      try {
        var d = pres();
        if (!d) { if (past) setPast(false); awaitRun = false; if (viewer && !viewer.hidden && !document.querySelector('section.dialog')) closeViewer(); return; }
        if (awaitRun) { if (playing(d)) awaitRun = false; else return; }
        if (!past && resultsUp(d)) setPast(true); else if (past) placeChip();
      } catch (x) { }
    }, 300);

    // ---- Escape: only the topmost thing ----
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      try {
        if (window.__ffSystems && window.__ffSystems.isOpen()) { stop(e); window.__ffSystems.close(); return; }
        if (window.__ffLive && window.__ffLive.isOpen()) { stop(e); window.__ffLive.close(); return; }
        if (viewer && !viewer.hidden) { stop(e); closeViewer(); return; }
        var card = past ? null : liveCard(), cop = 0;
        try { cop = card ? +getComputedStyle(card).opacity : 0; } catch (x) { }
        if (card && shown(card) && cop > 0.3) { stop(e); hideCard(card); return; }
        var ds = [].slice.call(document.querySelectorAll('section.dialog')).filter(shown);
        if (!ds.length) return;
        var top = ds[ds.length - 1];
        if (!top.classList.contains('is-presentation')) {
          if (ds.length < 2) return; // a single ordinary dialog closes as before
          stop(e);
          var c = top.querySelector('.dialog-close') || top.querySelector('.dialog-actions .is-quiet:not(:disabled)');
          if (c) c.click();
          return;
        }
        // the replay or its results is topmost: Escape folds an open menu inside it, or steps back from a view
        // opened inside it (the recorded steps, the figures review), and never closes the window
        stop(e);
        var open = [].slice.call(top.querySelectorAll('[aria-expanded="true"]')).filter(shown);
        if (open.length) { open[open.length - 1].click(); return; }
        var back = [].slice.call(top.querySelectorAll('button')).filter(function (b) { return shown(b) && /^(Back to Presentation|Back to Processing View)$/i.test(label(b)); })[0];
        if (back) back.click();
      } catch (x) { }
    }, true);
  } catch (e) { /* never block the demo */ }
})();

// ---- 7. "Try your own numbers" (demo/live/, by agent LIVE): the loader adds its buttons and panel on the demos it
//         supports and does nothing elsewhere. Escape closes its panel through window.__ffLive (section 6). ----
(function(){try{var s=document.createElement('script');s.src='../live/loader.js';s.async=true;(document.head||document.documentElement).appendChild(s);}catch(e){}})();

// ---- 8. never show a broken image or film (retry once, then a clean fallback) ----
(function () {
  var LOGO = /HANGS-Construction-(color|reverse)\.svg/i;
  var css = document.createElement('style');
  css.textContent = '.ff-logo-text{display:inline-flex;align-items:center;font:700 15px/1 system-ui,sans-serif;letter-spacing:.04em;color:currentColor;white-space:nowrap}';
  (document.head || document.documentElement).appendChild(css);
  document.addEventListener('error', function (e) {
    var el = e.target; if (!el || !el.tagName) return;
    var tag = el.tagName;
    if (tag === 'IMG') {
      var src = el.getAttribute('src') || '';
      if (!el.getAttribute('data-ff-retry') && src && src.indexOf('data:') !== 0) {
        el.setAttribute('data-ff-retry', '1');
        el.src = src.split('?')[0] + '?r=' + Date.now();
        return;
      }
      if (LOGO.test(src)) {
        var span = document.createElement('span'); span.className = 'ff-logo-text ' + (el.className || '');
        span.textContent = 'HANGS Construction'; span.style.height = (el.height || 28) + 'px';
        el.replaceWith(span); return;
      }
      if (!el.getAttribute('alt')) { el.hidden = true; return; }
      var t = document.createElement('span'); t.textContent = el.getAttribute('alt'); t.className = el.className; el.replaceWith(t);
    } else if (tag === 'VIDEO' || tag === 'SOURCE') {
      var v = tag === 'VIDEO' ? el : el.parentElement; if (!v) return;
      // keep the poster frame; drop the film so no broken player shows
      try { v.removeAttribute('src'); [].slice.call(v.querySelectorAll('source')).forEach(function (s) { s.remove(); }); v.load(); } catch (x) {}
      if (!v.getAttribute('poster')) v.style.visibility = 'hidden';
    }
  }, true);
})();
