/* F1 Finance demos · "Try your own numbers" · loader.
   Hook (one line in demo/tweaks.js, loaded first by every demo page):
     (function(){try{var s=document.createElement('script');s.src='../live/loader.js';s.async=true;(document.head||document.documentElement).appendChild(s);}catch(e){}})();
   On a supported demo (/demo/<id>/) this adds a "Try your own numbers" button to the page header and to the replay's
   controls (shown during and at the end of the run). The button opens a full-screen panel that recalculates the
   recorded run from the demo's own data files, with a Recorded run / Your numbers switch. The replay itself is
   never touched: it stays the default and keeps its state under the panel. Other demos: this file does nothing. */
(function () {
  'use strict';
  try {
    var DEMOS = {
      'tax-941': 'Form 941',
      'tax-1040': 'Form 1040',
      'accounting-bankrec': 'Bank Reconciliation',
      'accounting': 'AP Review',
      'accounting-cashflow': '13-Week Cash'
    };
    var m = /\/demo\/([a-z0-9-]+)\/(index\.html)?$/i.exec(location.pathname);
    if (!m || !DEMOS[m[1]] || window.__ffLiveLoader) return;
    window.__ffLiveLoader = true;
    var ID = m[1];
    var me = document.currentScript && document.currentScript.src;
    var BASE = me ? me.replace(/[^\/]*$/, '') : '../live/';

    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = BASE + 'live.css';
    (document.head || document.documentElement).appendChild(css);

    var loading = null;
    function script(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('could not load ' + src)); }; document.head.appendChild(s); }); }
    function load() {
      if (!loading) loading = script(BASE + 'lib.js').then(function () { return script(BASE + 'calc/' + ID + '.js'); }).then(function () { return script(BASE + 'core.js'); }).then(function () { return script(BASE + 'ui/' + ID + '.js'); });
      return loading;
    }
    function open(btn) {
      if (btn) btn.setAttribute('aria-busy', 'true');
      load().then(function () { if (btn) btn.removeAttribute('aria-busy'); window.FFLive.open(ID); }, function (e) { loading = null; if (btn) btn.removeAttribute('aria-busy'); if (window.console) console.warn('F1 Finance: ' + e.message); });
    }

    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 7h8"/><path d="M8 11.5h2M12 11.5h2M16 11.5h0M8 15.5h2M12 15.5h2"/><path d="M16 14.5v3"/></svg>';
    var TITLE = 'Edit the key inputs and recalculate this ' + DEMOS[ID] + ' live. The recorded replay stays as it is.';
    function entry(cls, extra, label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = cls + ' ff-live-open ' + extra;
      b.title = TITLE;
      b.setAttribute('aria-label', 'Try your own numbers');
      b.setAttribute('aria-haspopup', 'dialog');
      b.innerHTML = ICON + label;
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(b); });
      return b;
    }
    var textOf = function (x) { return (x.textContent || '').replace(/\s+/g, ' ').trim(); };
    function place() {
      // the page header, next to History
      if (!document.querySelector('.ff-live-hdr')) {
        var hist = [].slice.call(document.querySelectorAll('button.simple-nav-link, a.simple-nav-link')).filter(function (x) { return /^History$/i.test(textOf(x)); })[0];
        if (hist && hist.parentNode) hist.parentNode.insertBefore(entry(hist.className.replace(/\bff-[\w-]+/g, '').trim(), 'ff-live-hdr', '<span>Try <span class="ffl-word">your </span>own numbers</span>'), hist);
      }
      // the replay's controls, during the run and on the results / end view
      [].slice.call(document.querySelectorAll('.property-play-controls')).forEach(function (ctl) {
        if (ctl.querySelector('.ff-live-run')) return;
        var btns = [].slice.call(ctl.querySelectorAll('button'));
        var ref = btns.filter(function (x) { return /^Details$/i.test(textOf(x)); })[0] || btns.filter(function (x) { return /^Replay$/i.test(textOf(x)); })[0];
        var nb = entry(ref ? ref.className.replace(/\bff-[\w-]+/g, '').trim() : 'button is-quiet', 'ff-live-run', '<span>Try <span class="ffl-word">your </span>own numbers</span>');
        if (ref && ref.parentNode === ctl) ctl.insertBefore(nb, ref); else ctl.appendChild(nb);
      });
    }
    var waiting = false;
    function schedule() { if (waiting) return; waiting = true; setTimeout(function () { waiting = false; try { place(); } catch (e) { } }, 150); }
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule); else schedule();
    // warm the panel's files once the page is idle, so the first tap opens quickly
    setTimeout(function () { load().catch(function () { loading = null; }); }, 4000);
    window.FFLiveOpen = function () { open(null); };
  } catch (e) { /* never block the demo */ }
})();
