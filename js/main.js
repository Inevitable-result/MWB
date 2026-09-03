/* =========================================================
   MWB LABS — main.js
   GSAP + ScrollTrigger. One entry point, one init per concern.
   ========================================================= */

(function () {
  'use strict';

  var hasGSAP = typeof window.gsap !== 'undefined';
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = motionQuery.matches;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------------------------------------------------------
     NAVIGATION
     --------------------------------------------------------- */
  function initNavigation() {
    var nav = $('#nav');
    var toggle = $('#navToggle');
    var overlay = $('#navOverlay');
    var overlayLinks = $$('a', overlay);
    var open = false;
    var lastFocus = null;

    // translucent bar after the first screen-ish of scroll
    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    function setOpen(next) {
      if (next === open) return;
      open = next;
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);

      if (open) {
        lastFocus = document.activeElement;
        overlay.hidden = false;
        toggle.querySelector('.nav__toggle-label').textContent = 'Close';
        if (hasGSAP && !reduced) {
          gsap.to(overlay, { clipPath: 'inset(0% 0 0% 0)', duration: .6, ease: 'power3.inOut' });
          gsap.fromTo(overlayLinks,
            { yPercent: 60, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: .5, stagger: .05, delay: .18, ease: 'power3.out' });
        } else {
          overlay.style.clipPath = 'inset(0% 0 0% 0)';
        }
        overlayLinks[0].focus({ preventScroll: true });
      } else {
        toggle.querySelector('.nav__toggle-label').textContent = 'Menu';
        var finish = function () { overlay.hidden = true; };
        if (hasGSAP && !reduced) {
          gsap.to(overlay, { clipPath: 'inset(0 0 100% 0)', duration: .45, ease: 'power3.inOut', onComplete: finish });
        } else {
          overlay.style.clipPath = 'inset(0 0 100% 0)';
          finish();
        }
        if (lastFocus) lastFocus.focus({ preventScroll: true });
      }
    }

    toggle.addEventListener('click', function () { setOpen(!open); });
    overlayLinks.forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });

    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab') return;
      // keep focus inside the overlay while it is open
      var first = overlayLinks[0];
      var last = overlayLinks[overlayLinks.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // close if the viewport grows into desktop nav
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });

    // active section highlighting
    var links = $$('.nav__links a');
    if ('IntersectionObserver' in window && links.length) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) { a.classList.remove('is-current'); });
          if (map[entry.target.id]) map[entry.target.id].classList.add('is-current');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) {
        var sec = document.getElementById(id);
        if (sec) io.observe(sec);
      });
    }
  }

  /* ---------------------------------------------------------
     POINTER: custom follower + background glow
     --------------------------------------------------------- */
  function initPointer() {
    if (reduced) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var cursor = $('#cursor');
    var glow = $('#gridGlow');
    var x = 0, y = 0, cx = 0, cy = 0;

    window.addEventListener('mousemove', function (e) {
      x = e.clientX; y = e.clientY;
      cursor.classList.add('is-on');
      glow.classList.add('is-on');
      glow.style.setProperty('--mx', x + 'px');
      glow.style.setProperty('--my', y + 'px');
    }, { passive: true });

    (function loop() {
      cx += (x - cx) * .18;
      cy += (y - cy) * .18;
      cursor.style.transform = 'translate3d(' + (cx - 13) + 'px,' + (cy - 13) + 'px,0)';
      requestAnimationFrame(loop);
    })();

    document.addEventListener('mouseover', function (e) {
      var hot = e.target.closest('a, button, .card, .project__media');
      cursor.classList.toggle('is-hot', !!hot);
    });
  }

  /* ---------------------------------------------------------
     HERO
     --------------------------------------------------------- */
  function initHeroAnimation() {
    var lines = $$('.hero__title .line > span');
    var visual = $('#sys');
    var nodes = $$('[data-depth]', visual);

    if (!hasGSAP || reduced) return;

    // GSAP owns the transform on these, so re-declare the CSS centering it replaces
    gsap.set(nodes, { xPercent: -50, yPercent: -50 });

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.hero__eyebrow', { y: 14, opacity: 0, duration: .6 })
      .from(lines, { yPercent: 108, duration: .9, stagger: .08 }, '-=.3')
      .from('.hero__sub', { y: 18, opacity: 0, duration: .7 }, '-=.5')
      .from('.hero__ctas > *', { y: 16, opacity: 0, duration: .6, stagger: .08 }, '-=.45')
      .from(nodes, { scale: .82, opacity: 0, duration: .7, stagger: .07 }, '-=.9');

    // wires: dash animation without the paid DrawSVG plugin
    $$('.wire').forEach(function (path) {
      var len = path.getTotalLength();
      gsap.fromTo(path,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 1.2, delay: .5, ease: 'power2.out',
          onComplete: function () { path.style.strokeDasharray = '4 6'; } });
    });

    // idle drift so the system feels alive
    gsap.to('.sys__chip', { y: -8, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .4 });
    gsap.to('.sys__node--out', { boxShadow: '0 0 34px rgba(184,255,61,.28)', duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    var mm = gsap.matchMedia();

    // pointer parallax — desktop only
    mm.add('(hover: hover) and (pointer: fine) and (min-width: 1024px)', function () {
      var handler = function (e) {
        var rx = (e.clientX / window.innerWidth - .5);
        var ry = (e.clientY / window.innerHeight - .5);
        nodes.forEach(function (el) {
          var d = parseFloat(el.dataset.depth) || 1;
          gsap.to(el, { x: rx * d * 16, y: ry * d * 16, duration: .9, ease: 'power2.out', overwrite: 'auto' });
        });
      };
      window.addEventListener('mousemove', handler, { passive: true });
      return function () { window.removeEventListener('mousemove', handler); gsap.set(nodes, { x: 0, y: 0 }); };
    });

    // hero dissolves into the next section as the story starts
    mm.add('(min-width: 768px)', function () {
      gsap.to('.hero__visual', {
        yPercent: -12, opacity: .25, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: .6 }
      });
      gsap.to('.hero__copy', {
        yPercent: -6, opacity: .35, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: .6 }
      });
    });
  }

  /* ---------------------------------------------------------
     CAPABILITY MARQUEE
     --------------------------------------------------------- */
  function initMarquee() {
    var wrap = $('[data-marquee]');
    var track = $('#marqueeTrack');
    if (!wrap || !track) return;

    if (reduced || !hasGSAP) return; // stays natively scrollable

    track.innerHTML += track.innerHTML; // seamless second copy
    track.style.paddingInline = '0';     // padding would break the loop seam
    wrap.style.overflow = 'hidden';

    var half = track.scrollWidth / 2;
    var anim = gsap.to(track, {
      x: -half, duration: half / 55, ease: 'none', repeat: -1,
      modifiers: { x: function (v) { return (parseFloat(v) % half) + 'px'; } }
    });

    ScrollTrigger.create({
      trigger: wrap,
      start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { self.isActive ? anim.play() : anim.pause(); }
    });
  }

  /* ---------------------------------------------------------
     GENERIC SCROLL REVEALS
     --------------------------------------------------------- */
  function initScrollAnimations() {
    if (!hasGSAP) return;

    if (reduced) {
      gsap.set('.reveal, .reveal-line', { clearProps: 'all' });
      return;
    }

    ScrollTrigger.batch('.reveal', {
      start: 'top 88%',
      onEnter: function (batch) {
        gsap.from(batch, { y: 26, opacity: 0, duration: .75, ease: 'power3.out', stagger: .07, overwrite: true });
      }
    });

    // editorial line reveals (bridge + "anything")
    $$('.bridge__title .line > span').forEach(function (el) {
      gsap.from(el, {
        yPercent: 110, duration: .9, ease: 'power3.out',
        scrollTrigger: { trigger: '.bridge__title', start: 'top 78%' }
      });
    });

    gsap.from('.reveal-line', {
      y: 40, opacity: 0, filter: 'blur(6px)', duration: .8, stagger: .09, ease: 'power3.out',
      scrollTrigger: { trigger: '.anything__list', start: 'top 74%' }
    });

    gsap.from('.contact__title', {
      y: 34, opacity: 0, duration: .9, ease: 'power3.out',
      scrollTrigger: { trigger: '.contact', start: 'top 72%' }
    });
  }

  /* ---------------------------------------------------------
     PROBLEM → SOLUTION TRANSFORMATION
     --------------------------------------------------------- */
  function initProblem() {
    var mess = $('#flowMess');
    var mwb = $('#flowMwb');
    var better = $('#flowBetter');
    var count = $('#stepCount');
    if (!mess || !hasGSAP) return;

    if (reduced) return;

    var tl = gsap.timeline({
      scrollTrigger: { trigger: '#problemVisual', start: 'top 75%' }
    });

    tl.from('#flowMess .flow li', { y: 12, opacity: 0, duration: .4, stagger: .07, ease: 'power2.out' })
      .from(mwb, { y: 20, opacity: 0, duration: .5 }, '-=.1')
      .from('#flowMwb .flow li', { scale: .9, opacity: 0, duration: .4, stagger: .08 }, '-=.2')
      .from(better, { y: 20, opacity: 0, duration: .55 }, '-=.15');

    if (count) {
      var obj = { v: 0 };
      gsap.to(obj, {
        v: 6, duration: 1, ease: 'power1.out',
        scrollTrigger: { trigger: mess, start: 'top 70%' },
        onUpdate: function () { count.textContent = Math.round(obj.v); }
      });
    }
  }

  /* ---------------------------------------------------------
     SERVICE CARDS
     --------------------------------------------------------- */
  function initServices() {
    if (!hasGSAP || reduced) return;
    gsap.from('.card', {
      y: 40, opacity: 0, duration: .7, stagger: .07, ease: 'power3.out',
      scrollTrigger: { trigger: '.cards', start: 'top 82%' }
    });
  }

  /* ---------------------------------------------------------
     NEED → SOLUTION (interactive)
     --------------------------------------------------------- */
  function initNeedFlow() {
    var picker = $('.need__picker');
    if (!picker) return;

    var scenarios = [
      {
        quote: '"We spend hours every week manually processing customer requests."',
        out: ['Workflow automation', 'Internal dashboard', 'AI assistant', 'CRM integration'],
        result: 'Less manual work.'
      },
      {
        quote: '"Nobody can find anything. It\'s all in inboxes and spreadsheets."',
        out: ['Central data model', 'Search + permissions', 'Reporting layer', 'Tool integrations'],
        result: 'One source of truth.'
      },
      {
        quote: '"We know what to build. We just have no way to build it."',
        out: ['Product definition', 'UI/UX design', 'MVP engineering', 'Launch + iteration'],
        result: 'A product in market.'
      }
    ];

    var quote = $('#needQuote');
    var out = $('#needOut');
    var result = $('#needResult');
    var chips = $$('.chip', picker);

    function render(i) {
      var s = scenarios[i];
      quote.textContent = s.quote;
      out.innerHTML = s.out.map(function (t) { return '<li>' + t + '</li>'; }).join('');
      result.textContent = s.result;

      if (hasGSAP && !reduced) {
        gsap.from([quote, result], { y: 12, opacity: 0, duration: .45, ease: 'power2.out' });
        gsap.from(out.children, { y: 10, opacity: 0, duration: .4, stagger: .06, ease: 'power2.out' });
      }
    }

    chips.forEach(function (chip, i) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('is-active'); c.setAttribute('aria-selected', 'false'); });
        chip.classList.add('is-active');
        chip.setAttribute('aria-selected', 'true');
        render(i);
      });
    });

    if (hasGSAP && !reduced) {
      gsap.from('.need__flow > *', {
        y: 24, opacity: 0, duration: .6, stagger: .1, ease: 'power3.out',
        scrollTrigger: { trigger: '.need__flow', start: 'top 78%' }
      });
    }
  }

  /* ---------------------------------------------------------
     PROCESS — scroll-driven storytelling
     --------------------------------------------------------- */
  function initProcess() {
    var steps = $$('.step');
    var progress = $('#processProgress');
    if (!steps.length || !hasGSAP) return;

    if (reduced) {
      steps.forEach(function (s) { s.classList.add('is-active'); });
      if (progress) progress.style.height = '100%';
      return;
    }

    steps.forEach(function (step) {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 62%',
        end: 'bottom 42%',
        onToggle: function (self) { step.classList.toggle('is-active', self.isActive); }
      });
      // y only — opacity is the active/inactive state and belongs to CSS
      gsap.from(step, {
        y: 30, duration: .6, ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 88%' }
      });
    });

    ScrollTrigger.create({
      trigger: '#processSteps',
      start: 'top 65%',
      end: 'bottom 55%',
      onUpdate: function (self) {
        if (progress) progress.style.height = (self.progress * 100).toFixed(2) + '%';
      }
    });
  }

  /* ---------------------------------------------------------
     WORK — parallax on media
     --------------------------------------------------------- */
  function initCaseStudies() {
    if (!hasGSAP || reduced) return;

    var mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', function () {
      $$('.project').forEach(function (p) {
        gsap.from(p, {
          y: 48, opacity: 0, duration: .8, ease: 'power3.out',
          scrollTrigger: { trigger: p, start: 'top 82%' }
        });
        gsap.fromTo($('img', p), { yPercent: -5 }, {
          yPercent: 5, ease: 'none',
          scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: .5 }
        });
      });

      var whoImg = $('[data-parallax]');
      if (whoImg) {
        gsap.fromTo(whoImg, { yPercent: -6 }, {
          yPercent: 6, ease: 'none',
          scrollTrigger: { trigger: whoImg.parentNode, start: 'top bottom', end: 'bottom top', scrub: .5 }
        });
      }
    });

    mm.add('(max-width: 767px)', function () {
      gsap.from('.project', {
        y: 28, opacity: 0, duration: .6, ease: 'power3.out',
        stagger: .1,
        scrollTrigger: { trigger: '.projects', start: 'top 85%' }
      });
    });
  }

  /* ---------------------------------------------------------
     MICROINTERACTIONS — magnetic buttons
     --------------------------------------------------------- */
  function initInteractions() {
    if (!hasGSAP || reduced) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    $$('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - r.left - r.width / 2) * .28,
          y: (e.clientY - r.top - r.height / 2) * .38,
          duration: .5, ease: 'power3.out'
        });
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.4)' });
      });
    });
  }

  /* ---------------------------------------------------------
     CONTACT FORM
     --------------------------------------------------------- */
  function initContactForm() {
    var form = $('#contactForm');
    if (!form) return;

    // Connect a real endpoint here (Formspree, Resend, your own API, …).
    // Leave null to keep the demo in local/simulated mode.
    var ENDPOINT = null;

    var status = $('#formStatus');
    var submit = $('#submitBtn');
    var needsValue = $('#needsValue');
    var chips = $$('#needChips .chip');
    var selected = [];

    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', function () {
        var v = chip.dataset.value;
        var i = selected.indexOf(v);
        if (i > -1) selected.splice(i, 1); else selected.push(v);
        chip.classList.toggle('is-active', i === -1);
        chip.setAttribute('aria-pressed', String(i === -1));
        needsValue.value = selected.join(', ');
      });
    });

    function setError(id, message) {
      var input = document.getElementById(id);
      var err = document.getElementById('err-' + id);
      input.closest('.field').classList.toggle('has-error', !!message);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (err) err.textContent = message || '';
      return !message;
    }

    function validate() {
      var ok = true;
      var name = $('#name').value.trim();
      var email = $('#email').value.trim();
      var message = $('#message').value.trim();

      ok = setError('name', name ? '' : 'Add your name so we know who we\'re talking to.') && ok;
      ok = setError('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'Enter an email address we can reply to.') && ok;
      ok = setError('message', message.length >= 10 ? '' : 'A sentence or two is enough — what isn\'t working?') && ok;
      return ok;
    }

    ['name', 'email', 'message'].forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('input', function () {
        if (el.closest('.field').classList.contains('has-error')) validate();
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form__status';
      status.textContent = '';

      if (!validate()) {
        status.classList.add('is-bad');
        status.textContent = 'Check the highlighted fields.';
        var firstBad = $('.field.has-error input, .field.has-error textarea');
        if (firstBad) firstBad.focus();
        return;
      }

      var payload = Object.fromEntries(new FormData(form).entries());
      submit.disabled = true;
      submit.firstChild.textContent = 'Sending ';

      var request = ENDPOINT
        ? fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(function (r) { if (!r.ok) throw new Error(r.status); })
        : new Promise(function (res) { setTimeout(res, 700); }); // demo mode

      request.then(function () {
        form.reset();
        chips.forEach(function (c) { c.classList.remove('is-active'); c.setAttribute('aria-pressed', 'false'); });
        selected = [];
        needsValue.value = '';
        status.classList.add('is-ok');
        status.textContent = ENDPOINT
          ? 'Request sent. We reply within one business day.'
          : 'Request captured. Connect an endpoint in js/main.js to deliver it.';
      }).catch(function () {
        status.classList.add('is-bad');
        status.textContent = 'That didn\'t send. Email hello@mwblabs.com and we\'ll pick it up there.';
      }).then(function () {
        submit.disabled = false;
        submit.firstChild.textContent = 'Send request ';
      });
    });
  }

  /* ---------------------------------------------------------
     IMAGES — no broken visuals, no layout shift
     --------------------------------------------------------- */
  function initImages() {
    $$('img[data-fallback]').forEach(function (img) {
      img.addEventListener('error', function () {
        img.classList.add('is-failed');
        var holder = img.closest('.project__media, .who__figure');
        if (holder) holder.classList.add('is-failed');
      });
      img.addEventListener('load', function () {
        if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
      });
    });
  }

  /* ---------------------------------------------------------
     REDUCED MOTION — react to a live preference change
     --------------------------------------------------------- */
  function initReducedMotion() {
    motionQuery.addEventListener('change', function () {
      window.location.reload();
    });
  }

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  function boot() {
    $('#year').textContent = new Date().getFullYear();

    initReducedMotion();
    initNavigation();
    initImages();
    initPointer();
    initHeroAnimation();
    initMarquee();
    initScrollAnimations();
    initProblem();
    initServices();
    initNeedFlow();
    initProcess();
    initCaseStudies();
    initInteractions();
    initContactForm();

    if (hasGSAP && window.ScrollTrigger) {
      window.addEventListener('load', function () { ScrollTrigger.refresh(); });
      var t;
      window.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(function () { ScrollTrigger.refresh(); }, 200);
      }, { passive: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
