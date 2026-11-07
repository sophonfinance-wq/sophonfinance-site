/* Scroll experience: progress line, reveal on scroll, counters, heading underlines, depth, spotlight.
   Everything is skipped when the visitor prefers reduced motion. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  // 1. Reading progress line
  var bar = document.createElement('div');
  bar.className = 'fx-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  if (reduce || !('IntersectionObserver' in window)) {
    root.classList.remove('fx');
    window.addEventListener('scroll', function () {
      var max = root.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0) + ')';
    }, { passive: true });
    return;
  }

  // 2. Reveal on scroll, with a small stagger inside each group
  var groups = [
    ['.techdiv h2, .techdiv .intro', 0], ['.td-grid > li', 70], ['.td-foot', 0],
    ['.mkt h2, .mkt .intro', 0], ['.case > div:first-child', 0], ['.reel', 80],
    ['.team h2', 0], ['.creds .cg', 120], ['.team-film', 0],
    ['.contact h2, .contact .lead', 0], ['.contact dl > dd, .contact dl > dt', 40], ['form.cf', 0],
    ['.promise', 0], ['.topband', 0], ['footer .f-grid > div', 80], ['.ours', 0]
  ];
  var items = [];
  groups.forEach(function (g) {
    [].slice.call(document.querySelectorAll(g[0])).forEach(function (el, i) {
      if (el.hasAttribute('data-r')) return;
      el.setAttribute('data-r', '');
      el.style.setProperty('--rd', Math.min(i * g[1], 480) + 'ms');
      items.push(el);
    });
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  items.forEach(function (el) { io.observe(el); });

  // 3. Counters for the numbers in the credentials
  var nums = [].slice.call(document.querySelectorAll('.creds .bf b')).filter(function (b) { return /^\d+\+?$/.test(b.textContent.trim()); });
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      var el = e.target, txt = el.textContent.trim(), end = parseInt(txt, 10), plus = txt.slice(-1) === '+', t0 = null;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / 1100), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
        el.textContent = v + (plus ? '+' : '');
        if (p < 1) requestAnimationFrame(step);
      }
      el.textContent = '0' + (plus ? '+' : '');
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  nums.forEach(function (n) { cio.observe(n); });

  // 4. Heading underline draws in under the accent word
  var heads = [].slice.call(document.querySelectorAll('section h2'));
  var hio = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('drawn'); hio.unobserve(e.target); } });
  }, { threshold: 0.6 });
  heads.forEach(function (h) { hio.observe(h); });

  // 5. Depth on scroll and the progress line, in one animation frame
  var player = document.querySelector('.stage .player');
  var film = document.querySelector('.team-film');
  var ticking = false;
  function frame() {
    ticking = false;
    var max = root.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0) + ')';
    if (player) {
      var r = player.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, -r.top / (r.height || 1)));
      player.style.transform = 'scale(' + (1 - p * 0.05).toFixed(4) + ')';
      player.style.opacity = (1 - p * 0.35).toFixed(3);
    }
    if (film) {
      var fr = film.getBoundingClientRect();
      var c = (fr.top + fr.height / 2 - innerHeight / 2) / innerHeight;
      var v = film.querySelector('video');
      if (v) v.style.translate = '0 ' + (c * -18).toFixed(1) + 'px';
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  window.addEventListener('resize', frame);
  frame();

  // 6. Spotlight that follows the mouse (desktop only)
  if (window.matchMedia('(pointer: fine)').matches) {
    [].slice.call(document.querySelectorAll('.tab, .td-card, .creds')).forEach(function (el) {
      el.classList.add('fx-spot');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }
})();
