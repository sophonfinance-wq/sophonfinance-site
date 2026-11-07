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
})();
