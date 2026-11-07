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
    '.sys-restore, .simple-filing:has(.simple-filing-badge.is-coming), a[href*="/api/hangs/accounting/export/"], .ff-hidden{ display:none !important; }' +
    (/audit-covenant/.test(location.pathname) ? '.app-button[data-app="ledgerwyn"], .app-button[data-app="charterfold"], .app-button[data-app="vellumrow"], .app-button[data-app="quillpost"]{ display:none !important; }' : '');
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
