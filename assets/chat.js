/* Fast Finance assistant: answers questions about the firm from a built-in knowledge base.
   Anything it cannot answer is handed to the contact form. */
(function () {
  var TILE = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="9" fill="#0c3b43"/><path d="M19 50V14h27v7.5H26.5v8H41v7.5H26.5V50z" fill="#fff"/><rect x="44" y="41" width="6" height="9" fill="#5fd0c3"/><rect x="36" y="45" width="6" height="5" fill="#5fd0c3"/></svg>';

  var KB = [
    { id: 'about', k: ['what', 'services', 'service', 'offer', 'offering', 'help', 'everything', 'firm', 'company', 'about', 'sophon', 'sophonfinance', 'overview'],
      a: 'Fast Finance is a digital AI accounting firm and an AI engineering firm. Our automated machines handle <b>tax</b>, <b>month-end accounting</b> and <b>audit</b> work, and our <b>marketing division</b> makes films, ads, apps and launch campaigns. If a process in your business runs on documents and numbers, we can automate it.',
      c: ['Tax services', 'Accounting', 'Audit', 'Marketing', 'Book a consultation'] },
    { id: 'tax', k: ['tax', 'taxes', 'return', 'returns', '1065', 'k-1', 'k1', 'irs', 'payroll', 'excise', 'filing', 'filings', 'partnership', 'form', 'forms'],
      a: 'The <b>Tax Machine</b> prepares partnership returns (Form 1065 and K-1s), state returns and quarterly payroll filings from your own books, checking each rule against the official source. It prepares the draft; your reviewer signs and files. <a href="#services" data-open="0">Watch the Tax Machine</a>' },
    { id: 'acct', k: ['accounting', 'bookkeeping', 'books', 'month', 'month-end', 'close', 'invoice', 'invoices', 'ap', 'payable', 'payables', 'vendor', 'vendors', 'ledger', 'reconcile', 'reconciliation', 'bills'],
      a: 'The <b>Accounting Machine</b> runs the month-end invoice review. Every vendor invoice is matched to the books, your policy book and the vendor file. It flags bills entered twice, asset costs sent to expense, missing approvals and W-9s, then drafts the entries and a memo. Nothing is posted or paid until a person approves. <a href="#services" data-open="1">Watch the Accounting Machine</a>' },
    { id: 'audit', k: ['audit', 'audits', 'auditing', 'auditor', 'workpapers', 'materiality', 'sampling', 'cpa', 'findings', 'confirmations', 'assurance'],
      a: 'The <b>Audit Machine</b> builds year-end audit workpapers: materiality, sampling, unrecorded bills, journal testing and confirmations. Every amount traces back to the document it came from, and it drafts findings for the CPA, who reaches the conclusion. <a href="#services" data-open="2">Watch the Audit Machine</a>' },
    { id: 'mkt', k: ['marketing', 'iphone', 'android', 'ios', 'mobile', 'store', 'ads', 'ad', 'advertising', 'video', 'videos', 'film', 'films', 'commercial', 'commercials', 'app', 'apps', 'brand', 'branding', 'social', 'tiktok', 'campaign', 'campaigns', 'content', 'website', 'websites'],
      a: 'Our <b>marketing division</b> makes brand films, short-form ads, <b>mobile apps for iPhone and Android</b> and launch campaigns for corporations, founders and personal brands. Recent work includes the Model Macros fitness app and TikTok spots, and product films for GoPlay. <a href="#marketing">See the work</a>' },
    { id: 'ind', k: ['industry', 'industries', 'sector', 'sectors', 'construction', 'healthcare', 'medical', 'retail', 'estate', 'manufacturing', 'nonprofit', 'restaurant', 'restaurants', 'startup', 'startups', 'business', 'businesses', 'corporation', 'corporations', 'enterprise'],
      a: 'Every industry. Our engineers have worked across all of them, so we shape the machines around how your business already runs.' },
    { id: 'team', k: ['team', 'engineers', 'engineer', 'experience', 'experienced', 'background', 'who', 'kpmg', 'microsoft', 'dynamics', 'uber', 'qualified', 'trust', 'credentials'],
      a: 'Our AI engineers previously worked at <b>KPMG, Microsoft, General Dynamics and Uber</b>, with more than 30 years of engineering experience. We are AI engineering partners with <b>ENASAL AI Engineering</b>.' },
    { id: 'ins', k: ['insured', 'insurance', 'liability', 'coverage', 'risk', 'bonded', 'protected'],
      a: 'Yes. We are fully insured for every engagement.' },
    { id: 'price', k: ['price', 'prices', 'pricing', 'cost', 'costs', 'fee', 'fees', 'quote', 'rate', 'rates', 'charge', 'budget', 'expensive', 'cheap', 'afford'],
      a: 'Pricing depends on scope: which machines, how many entities and how often they run. Book a free consultation and we will quote it. <a href="#contact">Book a consultation</a>' },
    { id: 'contact', k: ['contact', 'consultation', 'consult', 'call', 'meeting', 'meet', 'talk', 'email', 'phone', 'reach', 'schedule', 'book', 'demo', 'start', 'started', 'hire', 'sign-up', 'signup'],
      a: 'Book a free consultation with the form on this page, or email <a href="mailto:contact@sophonfinance.com">contact@sophonfinance.com</a>. We reply within one business day. <a href="#contact">Open the form</a>' },
    { id: 'custom', k: ['custom', 'automate', 'automation', 'automated', 'build', 'integrate', 'integration', 'workflow', 'workflows', 'ai', 'engineering', 'machine', 'machines', 'software', 'system', 'systems', 'process', 'processes', 'bot', 'agent', 'agents'],
      a: 'Yes. We design and build custom AI machines for your own workflows, from reading documents to producing workpapers and reports. Tell us what you want automated and we will scope it in a free consultation. <a href="#contact">Tell us about it</a>' },
    { id: 'localai', k: ['local', 'private', 'on-premise', 'onprem', 'premise', 'llm', 'model', 'models', 'gpt', 'chatgpt', 'own', 'server', 'servers', 'architecture', 'infrastructure', 'enterprise', 'expenses', 'costs', 'savings', 'scale'],
      a: 'We architect <b>local AI systems for large corporations</b>: the AI runs inside your own environment on the latest, smartest and lowest-cost models, to cut expenses while your data stays with you. We design the architecture, build it and hand it over. <a href="#services" data-open="4">Watch AI services</a>' },
    { id: 'speed', k: ['fast', 'speed', 'long', 'quick', 'quickly', 'turnaround', 'time', 'minutes', 'days', 'hours'],
      a: 'Fast. A full Tax Machine run takes about five minutes, and the month-end invoice review about eight and a half. The training videos show real runs, shortened for viewing.' },
    { id: 'people', k: ['replace', 'accountant', 'accountants', 'sign', 'signature', 'human', 'humans', 'people', 'person', 'review', 'approve', 'control', 'staff', 'jobs'],
      a: 'The machines prepare the work and your people keep control. Your reviewer or CPA reviews, signs and files; nothing is posted, paid or filed by a machine.' },
    { id: 'data', k: ['data', 'security', 'secure', 'privacy', 'private', 'confidential', 'safe', 'safety', 'compliance'],
      a: 'Every machine produces drafts for a person to approve. We go through your data and access requirements in the consultation. Please don&rsquo;t put client data in the website form.' },
    { id: 'enasal', k: ['enasal', 'partner', 'partners', 'partnership', 'built', 'creator', 'created'],
      a: 'ENASAL AI Engineering is our AI engineering partner. The Fast Finance machines are created by ENASAL | SophonFinance.com.' },
    { id: 'hi', k: ['hi', 'hello', 'hey', 'yo', 'sup', 'morning', 'afternoon', 'evening', 'thanks', 'thank'],
      a: 'Hi! Ask me anything about Fast Finance: the machines, marketing, industries, the team or how to get started.',
      c: ['What do you do?', 'Which industries?', 'Who are your engineers?', 'Book a consultation'] }
  ];
  var CHIP_Q = {
    'Tax services': 'tax', 'Accounting': 'accounting invoices', 'Audit': 'audit', 'Marketing': 'marketing',
    'Book a consultation': 'book consultation', 'What do you do?': 'what services', 'Which industries?': 'industries',
    'Who are your engineers?': 'engineers team', 'Are you insured?': 'insured', 'Pricing': 'pricing'
  };

  var css = document.createElement('style');
  css.textContent = [
    '.ffc-btn{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:250;display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:12px 20px 12px 16px;border:0;border-radius:999px;background:linear-gradient(135deg,#0c3b43,#0e9384);color:#fff;font:600 13.5px/1 "Source Sans 3","Segoe UI",Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;box-shadow:0 14px 34px -12px rgba(12,59,67,.6),0 0 0 4px rgba(95,208,195,.18)}',
    '.ffc-btn svg{width:22px;height:22px}',
    '.ffc-btn[aria-expanded="true"]{display:none}',
    '.ffc{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:251;width:380px;max-width:calc(100vw - 36px);height:560px;max-height:calc(100vh - 110px);display:none;flex-direction:column;background:#fff;border:1px solid #dbe9e7;border-radius:20px;overflow:hidden;box-shadow:0 30px 70px -24px rgba(12,59,67,.45);font-family:"Source Sans 3","Segoe UI",Arial,sans-serif}',
    '.ffc.open{display:flex}',
    '.ffc-head{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;background:linear-gradient(135deg,#eaf7f5,#fff);border-bottom:1px solid #dbe9e7}',
    '.ffc-head svg{width:36px;height:36px;flex:none}',
    '.ffc-head b{display:block;font:600 15px/1.1 Jost,"Segoe UI",Arial,sans-serif;color:#0c3b43;letter-spacing:.06em;text-transform:uppercase}',
    '.ffc-head span{display:block;font-size:12.5px;color:#5b6d73;margin-top:3px}',
    '.ffc-x{margin-left:auto;width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:#0f2730;font-size:24px;line-height:1;cursor:pointer}',
    '.ffc-x:hover{background:#eaf7f5}',
    '.ffc-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:radial-gradient(rgba(14,147,132,.10) 1px,transparent 1.2px) 0 0/18px 18px}',
    '.ffc-m{max-width:86%;padding:11px 14px;border-radius:16px;font-size:15px;line-height:1.5}',
    '.ffc-m.bot{align-self:flex-start;background:#f1f8f7;border:1px solid #dbe9e7;color:#2c3a40;border-bottom-left-radius:6px}',
    '.ffc-m.me{align-self:flex-end;background:#0e9384;color:#fff;border-bottom-right-radius:6px}',
    '.ffc-m a{font-weight:600;color:#0a7469}',
    '.ffc-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.ffc-chips button{border:1px solid #bfe3dd;background:#fff;color:#0c3b43;border-radius:999px;padding:8px 12px;font:600 13px/1 "Source Sans 3","Segoe UI",Arial,sans-serif;cursor:pointer}',
    '.ffc-chips button:hover{background:#eaf7f5}',
    '.ffc-dots{align-self:flex-start;display:flex;gap:4px;padding:12px 14px}',
    '.ffc-dots i{width:7px;height:7px;border-radius:50%;background:#8fd3c9;animation:ffcb 1s infinite ease-in-out}',
    '.ffc-dots i:nth-child(2){animation-delay:.15s}.ffc-dots i:nth-child(3){animation-delay:.3s}',
    '@keyframes ffcb{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}',
    '.ffc-form{display:flex;gap:8px;padding:12px;border-top:1px solid #dbe9e7;background:#fff}',
    '.ffc-form input{flex:1;min-width:0;font:400 16px/1.3 "Source Sans 3","Segoe UI",Arial,sans-serif;border:1px solid #cfe0dd;border-radius:999px;padding:11px 16px;color:#2c3a40}',
    '.ffc-form input:focus{outline:2px solid #0e9384;outline-offset:-1px}',
    '.ffc-form button{border:0;border-radius:999px;background:#0e9384;color:#fff;padding:0 18px;font:600 13px/1 "Source Sans 3","Segoe UI",Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}',
    '@media (max-width:600px){.ffc{right:0;left:0;bottom:0;width:100%;max-width:none;height:78vh;max-height:none;border-radius:20px 20px 0 0}.ffc-btn{padding:12px 16px 12px 14px}}'
  ].join('\n');
  document.head.appendChild(css);

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<button class="ffc-btn" id="ffcBtn" type="button" aria-expanded="false" aria-controls="ffc">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>Ask Fast Finance</button>' +
    '<section class="ffc" id="ffc" role="dialog" aria-label="Fast Finance assistant">' +
      '<div class="ffc-head">' + TILE + '<div><b>Fast Finance</b><span>Ask about our services</span></div>' +
      '<button class="ffc-x" id="ffcX" type="button" aria-label="Close chat">&times;</button></div>' +
      '<div class="ffc-log" id="ffcLog" aria-live="polite"></div>' +
      '<form class="ffc-form" id="ffcForm"><input id="ffcIn" type="text" autocomplete="off" placeholder="Ask a question" aria-label="Your question"><button type="submit">Send</button></form>' +
    '</section>';
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

  var btn = document.getElementById('ffcBtn'), box = document.getElementById('ffc'), log = document.getElementById('ffcLog'),
      form = document.getElementById('ffcForm'), inp = document.getElementById('ffcIn'), started = false, last = '';

  function add(cls, html) { var d = document.createElement('div'); d.className = cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function chips(list) {
    var d = add('ffc-chips', '');
    list.forEach(function (t) { var b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = function () { ask(t, CHIP_Q[t] || t); }; d.appendChild(b); });
  }
  function match(q) {
    var words = q.toLowerCase().replace(/[^a-z0-9\- ]/g, ' ').split(/\s+/).filter(Boolean), best = null, bestScore = 0;
    KB.forEach(function (it) {
      var s = 0;
      words.forEach(function (w) {
        it.k.forEach(function (k) {
          if (w === k) s += 2;
          else if (k.length >= 4 && w.length >= 4 && (w.indexOf(k) === 0 || k.indexOf(w) === 0)) s += 1;
        });
      });
      if (it.id === 'about') s *= 0.6; // the overview only wins when nothing more specific does
      if (s > bestScore) { bestScore = s; best = it; }
    });
    return bestScore >= 1.2 ? best : null;
  }
  function ask(shown, q) {
    add('ffc-m me', esc(shown)); last = shown;
    var dots = add('ffc-dots', '<i></i><i></i><i></i>');
    setTimeout(function () {
      dots.remove();
      var it = match(q || shown);
      if (it) { add('ffc-m bot', it.a); if (it.c) chips(it.c); return; }
      var m = add('ffc-m bot', 'Good question. Our team can answer that one properly. <a href="#contact" class="ffc-send">Send it to us</a> and we will reply within one business day.');
      var a = m.querySelector('.ffc-send');
      a.onclick = function () { var t = document.querySelector('.cf textarea'); if (t && !t.value) t.value = last; close(); };
    }, 450);
  }
  function open() {
    box.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    if (!started) {
      started = true;
      add('ffc-m bot', 'Hi, I&rsquo;m the Fast Finance assistant. We automate tax, accounting and audit work and run a marketing division, for any industry. What can we do for you?');
      chips(['What do you do?', 'Tax services', 'Accounting', 'Audit', 'Marketing', 'Which industries?', 'Are you insured?', 'Pricing', 'Book a consultation']);
    }
    if (window.matchMedia('(min-width:601px)').matches) setTimeout(function () { inp.focus(); }, 50);
  }
  function close() { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }

  btn.onclick = open;
  document.getElementById('ffcX').onclick = close;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
  log.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a) return;
    var o = a.getAttribute('data-open');
    if (o !== null) { var t = document.getElementById('t' + o); if (t) t.click(); }
    if (window.matchMedia('(max-width:600px)').matches) close();
  });
  form.onsubmit = function (e) { e.preventDefault(); var q = inp.value.trim(); if (!q) return; inp.value = ''; ask(q); };
})();
