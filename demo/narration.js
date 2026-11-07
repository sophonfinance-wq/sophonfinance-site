/* F1 Finance demos: spoken narration with captions (loaded by tweaks.js).
   Each demo can have demo/narration/<id>/cues.json:
     { "voice": "...", "cues": [ { "id", "trigger": "start"|"stage:N"|"end"|"skip", "text", "file", "duration" } ] }
   No cues file, no narration. Nothing here may ever stop the demo itself from working. */
(function () {
  'use strict';
  if (window.__ffNarration) return;
  var m = location.pathname.match(/\/demo\/([^\/]+)\/?/);
  if (!m) return;
  var DEMO = m[1];
  var self = document.currentScript && document.currentScript.src;
  var BASE = self ? new URL('narration/' + DEMO + '/', self).href : '../narration/' + DEMO + '/';
  var KEY = 'ffNarration';
  var RM = false;
  try { RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }

  var S = window.__ffNarration = {
    demo: DEMO, cues: null, on: true, session: 0, active: false, stage: 0, ended: false,
    played: [], log: [], current: null, pending: null, paused: false, unlocked: false
  };
  try { S.on = localStorage.getItem(KEY) !== 'off'; } catch (e) { }
  var log = function (s) { try { S.log.push(Math.round(performance.now()) + ' ' + s); if (S.log.length > 200) S.log.shift(); } catch (e) { } };

  // ---- audio: one element, unlocked inside the visitor's tap (iPhone Safari needs that) ----------
  var audio = null;
  try {
    audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
  } catch (e) { audio = null; }
  S.audioState = function () { return audio ? { paused: audio.paused, t: Math.round(audio.currentTime * 100) / 100, src: (audio.src || '').split('/').pop().slice(0, 20), vol: audio.volume } : null; };
  var SILENT ='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

  // ---- captions + speaker toggle ----------------------------------------------------------------
  var dock, cap, capText, toggle, built = false;
  function css() {
    var st = document.createElement('style');
    st.id = 'ff-narration-css';
    st.textContent =
      '.ffn-dock{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;align-items:flex-end;gap:10px;' +
      'padding:0 max(12px,env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));pointer-events:none;' +
      'font:500 15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}' +
      '.ffn-dock[hidden]{display:none}' +
      '.ffn-cap{pointer-events:auto;flex:1 1 auto;max-width:760px;min-width:0;display:flex;gap:10px;align-items:flex-start;padding:11px 16px 12px;border-radius:16px;' +
      'background:rgba(9,47,53,.92);color:#f2fbf9;box-shadow:0 14px 34px -14px rgba(5,30,34,.55),0 0 0 1px rgba(95,212,196,.22) inset;' +
      '-webkit-backdrop-filter:blur(10px) saturate(1.2);backdrop-filter:blur(10px) saturate(1.2);transition:opacity .28s ease,transform .28s ease}' +
      '.ffn-cap.is-off{opacity:0;transform:translateY(8px);pointer-events:none}' +
      '.ffn-cap i{flex:none;width:8px;height:8px;margin-top:7px;border-radius:50%;background:#5fd4c4;box-shadow:0 0 0 4px rgba(95,212,196,.18)}' +
      '.ffn-cap.is-speaking i{animation:ffnPulse 1.6s ease-in-out infinite}' +
      '.ffn-cap p{margin:0;min-width:0;overflow-wrap:break-word;text-wrap:pretty}' +
      '.ffn-toggle{pointer-events:auto;flex:none;display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 13px 0 11px;border-radius:999px;border:0;cursor:pointer;' +
      'background:rgba(9,47,53,.92);color:#e9f7f4;font:600 13px/1 inherit;font-family:inherit;box-shadow:0 10px 26px -12px rgba(5,30,34,.55),0 0 0 1px rgba(95,212,196,.25) inset;' +
      '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
      '.ffn-toggle svg{width:18px;height:18px;flex:none}' +
      '.ffn-toggle[aria-pressed="false"]{background:rgba(255,255,255,.94);color:#0c3b43;box-shadow:0 10px 26px -12px rgba(5,30,34,.4),0 0 0 1px rgba(12,59,67,.16) inset}' +
      '.ffn-toggle:focus-visible{outline:2px solid #5fd4c4;outline-offset:2px}' +
      '@keyframes ffnPulse{0%,100%{box-shadow:0 0 0 3px rgba(95,212,196,.15)}50%{box-shadow:0 0 0 7px rgba(95,212,196,.32)}}' +
      /* phones: the caption gets the full width; the round speaker button sits just above its right corner */
      '@media (max-width:600px){.ffn-dock{flex-direction:column;align-items:stretch;gap:8px;padding-bottom:calc(8px + env(safe-area-inset-bottom))}' +
      '.ffn-cap{max-width:none;padding:9px 13px 10px;border-radius:14px;font-size:14px;line-height:1.4}.ffn-cap.is-off{display:none}.ffn-cap i{margin-top:6px}' +
      '.ffn-toggle{order:-1;align-self:flex-end;width:40px;padding:0;justify-content:center}.ffn-toggle span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}' +
      /* while the narration bar is up on a phone, lift the pinned file graphic above it */
      '@media (max-width:600px){html.ffn-up:has(.flight-layer .flight-card) .source-flow-route{bottom:calc(var(--ffn-h,0px) + 6px)}}' +
      '@media (prefers-reduced-motion:reduce){.ffn-cap,.ffn-cap.is-off{transition:none;transform:none}.ffn-cap.is-speaking i{animation:none}}';
    (document.head || document.documentElement).appendChild(st);
  }
  var ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
  function build() {
    if (built || !document.body) return;
    built = true;
    css();
    dock = document.createElement('div');
    dock.className = 'ffn-dock';
    dock.hidden = true;
    dock.setAttribute('data-ffn', '');
    cap = document.createElement('div');
    cap.className = 'ffn-cap is-off';
    cap.setAttribute('role', 'status');
    cap.setAttribute('aria-live', 'polite');
    cap.innerHTML = '<i aria-hidden="true"></i><p></p>';
    capText = cap.querySelector('p');
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ffn-toggle';
    toggle.addEventListener('click', function (e) { e.stopPropagation(); setOn(!S.on, true); });
    dock.appendChild(cap);
    dock.appendChild(toggle);
    document.body.appendChild(dock);
    paintToggle();
  }
  function paintToggle() {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', S.on ? 'true' : 'false');
    toggle.setAttribute('aria-label', S.on ? 'Narration on. Turn narration off' : 'Narration off. Turn narration on');
    toggle.title = S.on ? 'Narration on' : 'Narration off';
    toggle.innerHTML = (S.on ? ICON_ON : ICON_OFF) + '<span>' + (S.on ? 'Narration on' : 'Narration off') + '</span>';
  }
  function measure() {
    try { if (dock && !dock.hidden) document.documentElement.style.setProperty('--ffn-h', (dock.offsetHeight + Math.max(0, lastLift)) + 'px'); } catch (e) { }
  }
  function showCaption(text) {
    if (!cap) return;
    capText.textContent = text;
    cap.classList.remove('is-off');
    cap.classList.add('is-speaking');
    measure();
  }
  var hideT = 0;
  function hideCaption(delay) {
    if (!cap) return;
    clearTimeout(hideT);
    cap.classList.remove('is-speaking');
    hideT = setTimeout(function () { if (!S.current) { cap.classList.add('is-off'); measure(); } }, delay || 0);
  }
  function showDock(v) { build(); if (dock) dock.hidden = !v; document.documentElement.classList.toggle('ffn-up', !!v); if (!v) hideCaption(0); else measure(); }

  // ---- cue playback -------------------------------------------------------------------------------
  function cueFor(trigger) {
    if (!S.cues) return null;
    for (var i = 0; i < S.cues.length; i++) if (S.cues[i].trigger === trigger) return S.cues[i];
    return null;
  }
  var capTimer = 0, fadeT = 0;
  function stopAudio() {
    clearTimeout(capTimer); clearInterval(fadeT); clearInterval(cutT);
    if (audio) { try { audio.pause(); audio.volume = 1; } catch (e) { } }
  }
  function finished(session) {
    if (session !== S.session) return;
    clearTimeout(capTimer);
    var c = S.current; S.current = null;
    if (c) log('done ' + c.id);
    if (S.pending && S.on && S.active) { var n = S.pending; S.pending = null; play(n); }
    else hideCaption(900);
  }
  function play(c) {
    if (!c) return;
    if (S.played.indexOf(c.id) < 0) S.played.push(c.id);
    S.current = c;
    var session = S.session;
    log('play ' + c.id);
    showCaption(c.text);
    clearTimeout(capTimer);
    // if the sound cannot play, the caption still shows for the clip's length and the queue moves on
    var fallback = function () { clearTimeout(capTimer); capTimer = setTimeout(function () { finished(session); }, Math.max(2500, (c.duration || 6) * 1000)); };
    if (!audio || !c.file) { fallback(); return; }
    try {
      stopAudio();
      audio.onended = function () { finished(session); };
      audio.onerror = function () { log('audio error ' + c.id); fallback(); };
      audio.src = BASE + c.file;
      audio.volume = 1;
      var p = audio.play();
      if (p && p.catch) p.catch(function (err) { log('play blocked ' + c.id + ' ' + (err && err.name)); fallback(); });
      // safety net: never hang the queue on a clip that stalls
      capTimer = setTimeout(function () { log('stall ' + c.id); finished(session); }, ((c.duration || 10) + 6) * 1000);
    } catch (e) { fallback(); }
  }
  // newest stage wins; the clip already speaking finishes its sentence first
  function enqueue(c, now) {
    if (!c || !S.on || !S.active) return;
    if (S.played.indexOf(c.id) >= 0 || (S.current && S.current.id === c.id)) return;
    if (S.paused) { S.pending = c; return; }
    if (S.current && !now) { S.pending = c; log('queue ' + c.id); armCut(); return; }
    S.pending = null;
    play(c);
  }
  // The replay has moved on while a clip is still speaking: stop at the end of the current sentence
  // (cues.json "breaks" = pauses between sentences, in seconds) and go straight to the newest stage.
  // The opening line is never cut for stage 1 (they belong together), and the closing line is never cut.
  var cutT = 0;
  function armCut() {
    clearInterval(cutT);
    var c = S.current, n = S.pending;
    if (!c || !n || !audio || !c.breaks || !c.breaks.length) return;
    if (c.trigger === 'end' || (c.trigger === 'start' && n.trigger === 'stage:1')) return;
    var session = S.session;
    cutT = setInterval(function () {
      try {
        if (session !== S.session || S.current !== c || !S.pending) { clearInterval(cutT); return; }
        if (audio.paused) return;
        var t = audio.currentTime, b = null;
        for (var i = 0; i < c.breaks.length; i++) if (c.breaks[i] > t - 0.12) { b = c.breaks[i]; break; }
        if (b === null) { clearInterval(cutT); return; } // last sentence: let it finish
        if (t >= b) { clearInterval(cutT); log('cut ' + c.id + ' at ' + t.toFixed(2)); try { audio.pause(); } catch (e) { } finished(session); }
      } catch (e) { clearInterval(cutT); }
    }, 50);
  }
  function interruptWith(c) {
    if (!c || !S.on || !S.active) return;
    if (S.played.indexOf(c.id) >= 0 || (S.current && S.current.id === c.id)) return;
    S.pending = null;
    if (S.current && audio && !audio.paused && !RM) {
      // short fade so the cut is soft
      var session = S.session; clearInterval(fadeT);
      fadeT = setInterval(function () {
        try { audio.volume = Math.max(0, audio.volume - 0.2); } catch (e) { }
        if (!audio || audio.volume <= 0.05) { clearInterval(fadeT); if (session === S.session) { S.current = null; play(c); } }
      }, 40);
      return;
    }
    S.current = null; play(c);
  }

  // ---- one narration session per run ------------------------------------------------------------
  function begin(gesture) {
    S.session++; S.active = true; S.stage = 0; S.ended = false; S.played = []; S.current = null; S.pending = null; S.paused = false; S.sawPres = false; S.sawRun = false;
    S.armedAt = Date.now();
    stopAudio();
    showDock(true);
    log('begin ' + S.session);
    if (!S.on) return;
    var c = cueFor('start');
    if (c) { if (gesture) S.unlocked = true; play(c); }
    else if (gesture && audio && !S.unlocked) { try { audio.src = SILENT; var p = audio.play(); if (p && p.catch) p.catch(function () { }); S.unlocked = true; } catch (e) { } }
  }
  function end(reason) {
    if (!S.active) return;
    log('end ' + reason);
    S.active = false; S.session++; S.current = null; S.pending = null; S.paused = false;
    stopAudio();
    showDock(false);
  }
  function setOn(v, gesture) {
    S.on = v;
    try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) { }
    paintToggle();
    if (!v) { S.session++; S.current = null; S.pending = null; stopAudio(); hideCaption(0); return; }
    if (!S.active) return;
    // turned back on mid-run: speak where the replay is now
    S.session++; S.current = null; S.pending = null;
    var c = S.ended ? (cueFor('end') || cueFor('skip')) : (S.stage ? cueFor('stage:' + S.stage) : cueFor('start'));
    if (c) { S.played = S.played.filter(function (x) { return x !== c.id; }); play(c); }
  }

  // ---- reading the replay's state from the page ---------------------------------------------------
  function pres() { return document.querySelector('section.dialog.is-presentation'); }
  function runningStage(d) {
    var pills = d.querySelectorAll('.property-overview > *');
    if (pills.length) {
      for (var i = 0; i < pills.length; i++) if (/\b(running|active|current)\b/.test(pills[i].className) || pills[i].getAttribute('aria-current')) return i + 1;
      var done = 0; for (var j = 0; j < pills.length; j++) if (/\bdone\b/.test(pills[j].className)) done++;
      return done === pills.length ? -1 : 0;
    }
    var a = d.querySelector('[aria-current="step"], .stage.is-active, .is-running');
    if (a && a.parentNode) return [].indexOf.call(a.parentNode.children, a) + 1;
    return 0;
  }
  function isEnd(d) {
    if (!d) return false;
    // playback controls mean the replay is still running (after Replay the old results buttons can linger)
    if (d.querySelector('[data-action="playback-pause"], [data-action="playback-skip"], [data-action="pause-run"], [data-action="resume-run"], [data-action="skip-to-results"]')) return false;
    // results buttons + every stage pill done (a Replay of the recorded steps keeps the results buttons up while it plays)
    if (d.querySelector('[data-action="review"], [data-action="evidence"]')) return d.querySelectorAll('.property-overview > *').length ? runningStage(d) === -1 : true;
    var bs = d.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) if (/^(Review Figures|Replay)/i.test((bs[i].textContent || '').trim())) return true;
    return false;
  }
  function isPausedUI(d) {
    var b = d.querySelector('[data-action="playback-pause"], [data-action="pause-run"], [data-action="playback-play"], [data-action="resume-run"]');
    return !!(b && /^(Play|Resume|Continue)/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()));
  }
  // keep the captions and the speaker button clear of the replay's own buttons at the bottom of the screen
  var lastLift = -1;
  function lift(d) {
    if (!dock) return;
    var h = window.innerHeight, top = h, bs = d.querySelectorAll('button, a.button, [role="button"]');
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i]; if (b.closest('.flight-layer, .flight-card, [data-ffn]')) continue;
      var r = b.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.top < h * 0.6 || r.top >= h) continue;
      if (r.top < top) top = r.top;
    }
    var v = top < h ? Math.round(h - top + 6) : 0;
    if (v !== lastLift) { lastLift = v; dock.style.bottom = v + 'px'; measure(); }
  }
  function tick() {
    try {
      if (!S.active) return;
      var d = pres();
      if (!d) {
        // another dialog on top (e.g. "Stop this run?"): wait quietly; it may come back
        if (S.sawPres && document.querySelector('section.dialog')) { if (S.current && audio && !audio.paused) try { audio.pause(); } catch (e) { } S.held = true; return; }
        // the replay window closed (Stop Run, Close, Exit), or it never opened
        if (S.sawPres || Date.now() - S.armedAt > 8000) end(S.sawPres ? 'closed' : 'no replay');
        return;
      }
      if (S.held) { S.held = false; if (S.current && audio && S.on && !S.paused) try { var hp = audio.play(); if (hp && hp.catch) hp.catch(function () { }); } catch (e) { } }
      S.sawPres = true;
      lift(d);
      // after Replay the old results screen is still up for a moment: wait until the replay is running again
      if (!S.sawRun && (runningStage(d) > 0 || d.querySelector('[data-action="playback-pause"], [data-action="pause-run"]'))) S.sawRun = true;
      if (S.sawRun && isEnd(d)) {
        if (!S.ended) { S.ended = true; log('end screen'); var e = cueFor('end'); if (e) { S.pending = null; enqueue(e); } }
        return;
      }
      var paused = isPausedUI(d);
      if (paused !== S.paused) {
        S.paused = paused; log(paused ? 'pause' : 'resume');
        if (paused) { if (audio && S.current) try { audio.pause(); } catch (e) { } clearTimeout(capTimer); }
        else if (S.current && audio) { try { var p = audio.play(); if (p && p.catch) p.catch(function () { finished(S.session); }); } catch (e) { } capTimer = setTimeout(function () { finished(S.session); }, ((S.current.duration || 10) + 6) * 1000); if (S.pending) armCut(); }
        else if (S.pending) { var n = S.pending; S.pending = null; play(n); }
      }
      var st = runningStage(d);
      // after Skip the replay fast-forwards through the stages; the closing line is already speaking
      if (st > 0 && st !== S.stage) { S.stage = st; log('stage ' + st); if (!S.ended) enqueue(cueFor('stage:' + st)); }
    } catch (e) { }
  }

  // ---- the visitor's taps -------------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-ffn]')) return;
      var b = t.closest('button');
      if (!b) return;
      var label = (b.getAttribute('aria-label') || b.textContent || '').trim();
      var act = b.getAttribute('data-action') || '';
      // the run button, or Replay / Run Again: start narrating, inside this tap
      if ((b.matches('button.simple-primary, .simple-primary button') && !pres()) || /^(run-again|replay)$/.test(act) || (/^Replay/i.test(label) && pres())) {
        if (S.cues) begin(true); else { S.wantBegin = true; if (audio && !S.unlocked) { try { audio.src = SILENT; var p = audio.play(); if (p && p.catch) p.catch(function () { }); S.unlocked = true; } catch (x) { } } }
        return;
      }
      if (!S.active) return;
      if (/^(playback-skip|skip-to-results|replay-to-results)$/.test(act) || /^Skip to (the End|Results)/i.test(label)) {
        S.ended = true; log('skip');
        var c = cueFor('skip') || cueFor('end');
        if (c) interruptWith(c);
        return;
      }
      if (/^(stop|confirm-stop)$/.test(act) || /^Stop Run$/i.test(label)) {
        // stopping: hush at once; the window closing ends the session
        S.session++; S.current = null; S.pending = null; stopAudio(); hideCaption(0);
        if (act === 'confirm-stop') end('stop');
        return;
      }
      if (/dialog-close/.test(b.className) || /^(Close|Exit)$/i.test(label)) { setTimeout(tick, 60); }
    } catch (x) { }
  }, true);

  window.addEventListener('pagehide', function () { end('pagehide'); });
  document.addEventListener('visibilitychange', function () {
    try { if (document.hidden && S.current && audio) audio.pause(); else if (!document.hidden && S.current && audio && !S.paused && S.on) { var p = audio.play(); if (p && p.catch) p.catch(function () { }); } } catch (e) { }
  });

  // ---- load the cues ------------------------------------------------------------------------------
  try {
    // index.json lists the demos that have narration, so demos without it make no failing request
    fetch(new URL('../index.json', BASE).href, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (ix) {
      if (!ix || !ix.demos || ix.demos.indexOf(DEMO) < 0) return null;
      return fetch(BASE + 'cues.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; });
    }).then(function (j) {
      var list = j && (j.cues || j);
      if (!list || !list.length) return;
      S.cues = list;
      if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
      setInterval(tick, 200);
      if (S.wantBegin && pres()) { S.wantBegin = false; begin(false); }
      // warm the cache so clips start without a gap
      var i = 0, warm = function () { if (i >= list.length) return; var f = list[i++].file; if (!f) return warm(); fetch(BASE + f).then(warm, warm); };
      setTimeout(warm, 1500);
    }).catch(function () { });
  } catch (e) { }
})();
