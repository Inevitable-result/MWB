/* =========================================================
   MWB LABS — main.js  (v2)

   Architecture
   ------------
   Everything scroll-driven lives inside ONE gsap.matchMedia()
   context. GSAP owns the lifecycle: when a breakpoint or the
   motion preference changes it reverts every tween, kills every
   ScrollTrigger it created and re-runs the block. That is what
   removes the duplicate-trigger / stale-position class of bug —
   not timeouts.

   Reveals are fromTo + once, never .from(). A .from() records
   its start values at creation; after a refresh those values are
   stale, and an element scrolled past can be left at opacity 0
   forever. That was the "second pass" bug.
   ========================================================= */

(function () {
  'use strict';

  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    // mobile URL-bar show/hide fires resize constantly; refreshing there causes jumps
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var app = { lenis: null, mm: null, refreshQueued: false };

  /* Motion tuning per breakpoint. Mobile gets shorter distances,
     shorter durations and a later start, so content is on screen
     before it is asked to animate — the page never looks empty
     waiting for a stagger chain to finish. */
  var DESKTOP_TUNE = { y: 24, duration: .7, stagger: .06, start: 'top 88%' };
  var MOBILE_TUNE = { y: 16, duration: .45, stagger: .04, start: 'top 92%' };
  var TUNE = DESKTOP_TUNE;

  function debounce(fn, wait) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, wait); };
  }

  /* =========================================================
     SMOOTH SCROLL
     Lenis on fine pointers only. Touch keeps native scrolling —
     smoothing a touchscreen just adds perceived lag.
     ========================================================= */
  function initSmoothScroll() {
    if (prefersReduced || !window.Lenis) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    var lenis = new Lenis({
      lerp: 0.11,            // conservative: settles in ~3 frames, no rubber band
      wheelMultiplier: 0.85, // tames the fast Linux/X11 wheel step
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false         // GSAP's ticker drives it — one RAF loop, not two
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    app.lenis = lenis;
  }

  /* Anchor navigation has to go through whichever scroller is active,
     or the nav overshoots and ScrollTrigger positions read stale. */
  function scrollToTarget(target) {
    var offset = -(parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-h'), 10) || 64) - 8;

    if (app.lenis) {
      app.lenis.scrollTo(target, { offset: offset, duration: 1.1 });
    } else {
      var y = target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  }

  function initAnchors() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      scrollToTarget(target);
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, '', id);
    });
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */
  function initNavigation() {
    var nav = $('#nav');
    var toggle = $('#navToggle');
    var overlay = $('#navOverlay');
    var overlayLinks = $$('a', overlay);
    var open = false;
    var lastFocus = null;

    var stuck = false;
    window.addEventListener('scroll', function () {
      var next = window.scrollY > 24;
      if (next === stuck) return;            // one class write per state change
      stuck = next;
      nav.classList.toggle('is-stuck', stuck);
    }, { passive: true });

    function setOpen(next) {
      if (next === open) return;
      open = next;
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);
      if (app.lenis) open ? app.lenis.stop() : app.lenis.start();

      if (open) {
        lastFocus = document.activeElement;
        overlay.hidden = false;
        toggle.querySelector('.nav__toggle-label').textContent = 'Close';
        if (hasGSAP && !prefersReduced) {
          gsap.to(overlay, { clipPath: 'inset(0% 0 0% 0)', duration: .55, ease: 'power3.inOut' });
          gsap.fromTo(overlayLinks, { yPercent: 60, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: .5, stagger: .05, delay: .15, ease: 'power3.out' });
        } else {
          overlay.style.clipPath = 'inset(0% 0 0% 0)';
        }
        overlayLinks[0].focus({ preventScroll: true });
      } else {
        toggle.querySelector('.nav__toggle-label').textContent = 'Menu';
        var finish = function () { overlay.hidden = true; };
        if (hasGSAP && !prefersReduced) {
          gsap.to(overlay, { clipPath: 'inset(0 0 100% 0)', duration: .4, ease: 'power3.inOut', onComplete: finish });
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
      var first = overlayLinks[0], last = overlayLinks[overlayLinks.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });

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

  /* =========================================================
     IMAGES — graceful failure, one refresh for the whole batch
     ========================================================= */
  function initImages() {
    var queueRefresh = debounce(function () {
      if (hasGSAP) ScrollTrigger.refresh();
    }, 200);

    $$('img[data-fallback]').forEach(function (img) {
      img.addEventListener('error', function () {
        img.classList.add('is-failed');
        var holder = img.closest('.wcard__media, .who__figure');
        if (holder) holder.classList.add('is-failed');
        queueRefresh();
      });
      img.addEventListener('load', queueRefresh);
    });
  }

  /* =========================================================
     REFRESH LIFECYCLE
     Layout changes invalidate every measured trigger position.
     Refresh on the events that actually change layout, and only
     on a real width change — not on every mobile scroll-resize.
     ========================================================= */
  function initRefreshLifecycle() {
    if (!hasGSAP) return;

    var queueRefresh = debounce(function () { ScrollTrigger.refresh(); }, 150);

    // webfonts swap in after first paint and change every text metric
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueRefresh);
    window.addEventListener('load', queueRefresh);

    var lastWidth = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastWidth) return; // height-only = URL bar, ignore
      lastWidth = window.innerWidth;
      queueRefresh();
    }, { passive: true });

    window.addEventListener('orientationchange', queueRefresh);

    // bfcache restore returns with stale positions
    window.addEventListener('pageshow', function (e) { if (e.persisted) ScrollTrigger.refresh(); });
  }

  /* =========================================================
     ANIMATION HELPERS
     ========================================================= */

  // Level 3 reveal. fromTo + once = correct on every pass, and the
  // trigger kills itself afterwards instead of living forever.
  function reveal(targets, opts) {
    opts = opts || {};
    var els = typeof targets === 'string' ? $$(targets) : targets;
    if (!els.length) return;
    gsap.fromTo(els,
      { y: opts.y != null ? Math.min(opts.y, TUNE.y) : TUNE.y, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1,
        duration: opts.duration || TUNE.duration,
        ease: 'power3.out',
        stagger: opts.stagger != null ? Math.min(opts.stagger, TUNE.stagger) : TUNE.stagger,
        scrollTrigger: {
          trigger: opts.trigger || els[0],
          start: opts.start || TUNE.start,
          once: true
        }
      });
  }

  /* =========================================================
     HERO
     ========================================================= */
  function initHero() {
    var visual = $('#sys');
    var nodes = $$('[data-depth]', visual);
    var lines = $$('.hero__title .line > span');

    // GSAP writes its own transform matrix, which would drop the
    // translate(-50%,-50%) these are centred with
    gsap.set(nodes, { xPercent: -50, yPercent: -50 });

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('.hero__eyebrow', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6 })
      .fromTo(lines, { yPercent: 108 }, { yPercent: 0, duration: .9, stagger: .08 }, '-=.3')
      .fromTo('.hero__sub', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .7 }, '-=.55')
      .fromTo('.hero__ctas > *', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .08 }, '-=.45')
      .fromTo(nodes, { scale: .84, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .75, stagger: .07 }, '-=.9');

    // wires draw themselves, then settle back to the dashed idle state
    $$('.wire').forEach(function (path) {
      var len = path.getTotalLength();
      gsap.fromTo(path,
        { strokeDasharray: len, strokeDashoffset: len },
        {
          strokeDashoffset: 0, duration: 1.2, delay: .45, ease: 'power2.out',
          onComplete: function () { path.style.strokeDasharray = '4 6'; }
        });
    });

    // Level 1 — ambient. Two slow loops, nothing else.
    gsap.to('.sys__chip', { y: -7, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .5 });
    gsap.to('.sys__core-mark', { opacity: .55, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  /* The hero doesn't just fade out — the grid keeps travelling into
     the problem section, so the two chapters read as one surface. */
  function initHeroTransition() {
    gsap.to('#heroGrid', {
      yPercent: 12, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6, invalidateOnRefresh: true }
    });
    gsap.to('.hero__visual', {
      yPercent: -10, autoAlpha: .25, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: .6, invalidateOnRefresh: true }
    });
    gsap.to('.hero__copy', {
      yPercent: -5, autoAlpha: .4, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: .6, invalidateOnRefresh: true }
    });

    // the thread that carries the eye between chapters
    $$('[data-thread]').forEach(function (thread) {
      gsap.fromTo(thread, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: thread, start: 'top 92%', end: 'bottom 65%', scrub: .5, invalidateOnRefresh: true }
      });
    });
  }

  function initPointerFX() {
    var cursor = $('#cursor');
    var glow = $('#gridGlow');
    var nodes = $$('#sys [data-depth]');
    var x = 0, y = 0, cx = 0, cy = 0, active = false;

    var onMove = function (e) {
      x = e.clientX; y = e.clientY;
      if (!active) { active = true; cursor.classList.add('is-on'); glow.classList.add('is-on'); }
      glow.style.setProperty('--mx', x + 'px');
      glow.style.setProperty('--my', y + 'px');

      var rx = (x / window.innerWidth - .5), ry = (y / window.innerHeight - .5);
      nodes.forEach(function (el) {
        var d = parseFloat(el.dataset.depth) || 1;
        gsap.to(el, { x: rx * d * 14, y: ry * d * 14, duration: .9, ease: 'power2.out', overwrite: 'auto' });
      });
    };

    var tick = function () {
      cx += (x - cx) * .18; cy += (y - cy) * .18;
      cursor.style.transform = 'translate3d(' + (cx - 12) + 'px,' + (cy - 12) + 'px,0)';
    };

    var onOver = function (e) {
      cursor.classList.toggle('is-hot', !!e.target.closest('a, button, .card, .wcard'));
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver);
    gsap.ticker.add(tick); // shares GSAP's loop instead of opening another RAF

    return function () {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      gsap.ticker.remove(tick);
      gsap.set(nodes, { x: 0, y: 0 });
      cursor.classList.remove('is-on');
      glow.classList.remove('is-on');
    };
  }

  function initMagnetic() {
    var cleanups = [];
    $$('.magnetic').forEach(function (el) {
      var move = function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - r.left - r.width / 2) * .25,
          y: (e.clientY - r.top - r.height / 2) * .35,
          duration: .5, ease: 'power3.out'
        });
      };
      var leave = function () { gsap.to(el, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.4)' }); };
      el.addEventListener('mousemove', move);
      el.addEventListener('mouseleave', leave);
      cleanups.push(function () {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
        gsap.set(el, { x: 0, y: 0 });
      });
    });
    return function () { cleanups.forEach(function (fn) { fn(); }); };
  }

  /* =========================================================
     CAPABILITY MARQUEE
     Ticker-driven modulo instead of a fixed-distance tween, so a
     resize or a late font load can't drift the seam.
     ========================================================= */
  function initMarquee() {
    var wrap = $('[data-marquee]');
    var track = $('#marqueeTrack');
    if (!wrap || !track) return;

    if (!track.dataset.doubled) {
      track.innerHTML += track.innerHTML;
      track.style.paddingInline = '0';
      track.dataset.doubled = '1';
    }
    wrap.style.overflow = 'hidden';

    var half = track.scrollWidth / 2;
    var x = 0, speed = 42, visible = true;

    var measure = function () { half = track.scrollWidth / 2; };
    var tick = function (time, delta) {
      if (!visible || !half) return;
      x -= speed * delta / 1000;
      if (-x >= half) x += half;
      gsap.set(track, { x: x });
    };

    var st = ScrollTrigger.create({
      trigger: wrap, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { visible = self.isActive; }
    });

    ScrollTrigger.addEventListener('refreshInit', measure);
    gsap.ticker.add(tick);

    return function () {
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener('refreshInit', measure);
      st.kill();
      gsap.set(track, { x: 0 });
    };
  }

  /* =========================================================
     PROBLEM STORY — scrubbed, so it reads in both directions
     ========================================================= */
  function initProblemStory(isDesktop) {
    var count = $('#stepCount');

    // On desktop the visual is sticky, so scrubbing reads as a
    // transformation. On mobile the card scrolls past in one gesture:
    // scrubbing there would make it play in fragments, so it runs once.
    var tl = gsap.timeline({
      scrollTrigger: isDesktop
        ? { trigger: '#problemVisual', start: 'top 78%', end: 'bottom 70%', scrub: .7, invalidateOnRefresh: true }
        : { trigger: '#problemVisual', start: 'top 85%', once: true }
    });

    tl.fromTo('#flowMess .flow li', { y: 10, autoAlpha: .25 },
        { y: 0, autoAlpha: 1, stagger: .06, duration: .4 })
      .to('#flowMess .flow li', { autoAlpha: .35, color: '#A1A1AA', duration: .3, stagger: .04 }, '+=.15')
      .fromTo('#flowMwb', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4 }, '-=.25')
      .fromTo('#flowMwb .flow li', { scale: .9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, stagger: .08, duration: .35 }, '-=.2')
      .fromTo('#flowBetter', { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .45 }, '-=.1');

    if (count) {
      var obj = { v: 0 };
      gsap.to(obj, {
        v: 6, duration: 1, ease: 'power1.out',
        scrollTrigger: { trigger: '#flowMess', start: 'top 72%', once: true },
        onUpdate: function () { count.textContent = Math.round(obj.v); }
      });
    }

    reveal('.problem__copy > .reveal', { trigger: '.problem__copy' });
    reveal('.problem__list li', { y: 16, stagger: .05, trigger: '.problem__list' });
  }

  /* =========================================================
     SERVICES
     ========================================================= */
  function initServices() {
    reveal('.services .sec-head .reveal', { trigger: '.services .sec-head' });
    gsap.fromTo('.card', { y: 36, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: .7, ease: 'power3.out', stagger: .07,
        scrollTrigger: { trigger: '.cards', start: 'top 84%', once: true }
      });
  }

  /* =========================================================
     NEED → SOLUTION (interaction, not scroll)
     ========================================================= */
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

    var quote = $('#needQuote'), out = $('#needOut'), result = $('#needResult');
    var chips = $$('.chip', picker);

    function render(i) {
      var s = scenarios[i];
      quote.textContent = s.quote;
      out.innerHTML = s.out.map(function (t) { return '<li>' + t + '</li>'; }).join('');
      result.textContent = s.result;

      if (typeof gsap !== 'undefined' && !prefersReduced) {
        gsap.fromTo([quote, result], { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .45, ease: 'power2.out' });
        gsap.fromTo(out.children, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, stagger: .06, ease: 'power2.out' });
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
  }

  function initNeedReveal() {
    reveal('.need .sec-head .reveal', { trigger: '.need .sec-head' });
    reveal('.need__flow > *', { y: 22, stagger: .09, trigger: '.need__flow', start: 'top 80%' });
    gsap.fromTo('.need__arrow span', { scaleY: 0 }, {
      scaleY: 1, duration: .5, ease: 'power2.out', stagger: .2,
      scrollTrigger: { trigger: '.need__flow', start: 'top 78%', once: true }
    });
  }

  /* =========================================================
     PROCESS — progress rail via transform, not height
     ========================================================= */
  function initProcess() {
    var steps = $$('.step');
    var progress = $('#processProgress');

    steps.forEach(function (step) {
      ScrollTrigger.create({
        trigger: step, start: 'top 62%', end: 'bottom 42%',
        onToggle: function (self) { step.classList.toggle('is-active', self.isActive); }
      });
      // y only — opacity is the active state and belongs to CSS
      gsap.fromTo(step, { y: 28 }, {
        y: 0, duration: .6, ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 88%', once: true }
      });
    });

    if (progress) {
      gsap.fromTo(progress, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: {
          trigger: '#processSteps', start: 'top 65%', end: 'bottom 55%',
          scrub: .4, invalidateOnRefresh: true
        }
      });
    }

    reveal('.process .sec-head .reveal', { trigger: '.process .sec-head' });
  }

  /* =========================================================
     SELECTED WORK
     Two separate strategies, never both at once. matchMedia builds
     one and reverts it before building the other, so the horizontal
     track and the mobile deck can never fight over the same nodes.
     ========================================================= */

  function makeMeter(cards) {
    var bar = $('#workBar'), idx = $('#workIdx');
    return function (p) {
      if (bar) gsap.set(bar, { scaleX: p });
      if (!idx) return;
      var n = Math.min(cards.length, Math.max(1, Math.ceil(p * cards.length)));
      idx.textContent = ('0' + n).slice(-2);
    };
  }

  /* The card height is whatever the viewport has left after the nav,
     the section header and the meter — measured, not guessed, so a
     720px laptop and a 1440px monitor both get a card that fits. */
  function measureWorkTrack() {
    var section = $('#work'), head = $('.work__head');
    if (!section || !head) return;

    var sectionCS = getComputedStyle(section);
    var headCS = getComputedStyle(head);
    var navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;

    var used = navH
      + head.getBoundingClientRect().height
      + (parseFloat(headCS.marginBottom) || 0)
      + (parseFloat(sectionCS.paddingTop) || 0)
      + (parseFloat(sectionCS.paddingBottom) || 0);

    var available = window.innerHeight - used - 16;   // 16 = breathing room
    var height = Math.max(240, Math.min(560, available));
    section.style.setProperty('--work-track-h', Math.round(height) + 'px');
  }

  function initSelectedWorkDesktop(cards, setMeter) {
    var section = $('#work');
    var viewport = $('#workViewport');
    var track = $('#workTrack');

    // focusing an off-screen card makes the browser scroll the
    // container, which desyncs the pinned track
    var onVpScroll = function () { if (viewport.scrollLeft !== 0) viewport.scrollLeft = 0; };
    viewport.addEventListener('scroll', onVpScroll);

    var distance = function () {
      return Math.max(0, track.scrollWidth - viewport.clientWidth);
    };

    var tween = gsap.to(track, {
      x: function () { return -distance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: function () { return '+=' + Math.max(distance(), 1); },
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: .8,
        invalidateOnRefresh: true,
        onUpdate: function (self) { setMeter(self.progress); },
        onRefresh: function (self) { setMeter(self.progress); }
      }
    });

    cards.forEach(function (card) {
      gsap.fromTo($('.wcard__body', card), { y: 26, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: .5, ease: 'power2.out',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 92%', once: true }
      });
      var img = $('img', card);
      if (img) {
        gsap.fromTo(img, { scale: 1.12, xPercent: -2 }, {
          scale: 1, xPercent: 2, ease: 'none',
          scrollTrigger: {
            trigger: card, containerAnimation: tween,
            start: 'left right', end: 'right left', scrub: true
          }
        });
      }
    });

    // both run before ScrollTrigger measures anything on a refresh
    var onRefreshInit = function () {
      measureWorkTrack();
      gsap.set(track, { x: 0 });
    };
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
    measureWorkTrack();

    return function () {
      viewport.removeEventListener('scroll', onVpScroll);
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
      gsap.set(track, { x: 0 });
      $('#work').style.removeProperty('--work-track-h');
    };
  }

  /* Mobile: a deck. The stacking itself is position:sticky in CSS —
     it is correct in both directions, at any scroll speed, with no
     JS involved. GSAP only adds the entrance and the depth cue. */
  function initSelectedWorkMobile(cards, setMeter) {
    cards.forEach(function (card, i) {
      gsap.fromTo(card, { y: 36, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: .5, ease: 'power2.out',
        scrollTrigger: { trigger: card, start: 'top 92%', once: true }
      });

      // the card being covered settles back into the stack.
      // scale only — y and autoAlpha belong to the entrance above,
      // and two tweens writing one property is how cards get stuck
      // half-faded after scrolling up.
      if (i < cards.length - 1) {
        gsap.to(card, {
          scale: .965, ease: 'none',
          scrollTrigger: {
            trigger: cards[i + 1],
            start: 'top 85%',
            end: 'top 35%',
            scrub: .4,
            invalidateOnRefresh: true
          }
        });
      }

      ScrollTrigger.create({
        trigger: card, start: 'top 55%', end: 'bottom 45%',
        onToggle: function (self) { if (self.isActive) setMeter((i + 1) / cards.length); }
      });
    });
  }

  function initSelectedWork(isDesktop) {
    var track = $('#workTrack');
    var cards = $$('.wcard', track);
    if (!track || !cards.length) return;

    reveal('.work__head .reveal', { trigger: '.work__head' });
    var setMeter = makeMeter(cards);

    return isDesktop
      ? initSelectedWorkDesktop(cards, setMeter)
      : initSelectedWorkMobile(cards, setMeter);
  }

  /* =========================================================
     REMAINING CHAPTERS
     ========================================================= */
  function initWhyMWB() {
    reveal('.why .sec-head .reveal', { trigger: '.why .sec-head' });
    reveal('.why__row', { y: 20, stagger: .06, trigger: '.why__list' });
    reveal('.who__copy > .reveal', { stagger: .06, trigger: '.who__copy' });
    reveal('.who__item', { y: 18, stagger: .06, trigger: '.who__items' });

    var whoImg = $('.who__figure img');
    if (whoImg) {
      gsap.fromTo(whoImg, { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: {
          trigger: '.who__figure', start: 'top bottom', end: 'bottom top',
          scrub: .5, invalidateOnRefresh: true
        }
      });
    }
  }

  function initEditorialMoments() {
    $$('.bridge__title .line > span').forEach(function (el) {
      gsap.fromTo(el, { yPercent: 110 }, {
        yPercent: 0, duration: .9, ease: 'power3.out',
        scrollTrigger: { trigger: '.bridge__title', start: 'top 80%', once: true }
      });
    });
    reveal('.bridge__sub', { start: 'top 88%' });

    gsap.fromTo('.reveal-line', { y: 36, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: .8, stagger: .08, ease: 'power3.out',
      scrollTrigger: { trigger: '.anything__list', start: 'top 76%', once: true }
    });
    reveal('.anything__foot', { start: 'top 90%' });

    reveal('.strip__title', { trigger: '.strip' });
  }

  function initFinalCTA() {
    gsap.fromTo('.contact__title', { y: 30, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: .85, ease: 'power3.out',
      scrollTrigger: { trigger: '.contact', start: 'top 74%', once: true }
    });
    reveal('.contact__copy .reveal', { stagger: .08, trigger: '.contact__copy', start: 'top 78%' });
    reveal('.form > *', { y: 18, stagger: .05, trigger: '.form', start: 'top 82%' });
  }

  /* =========================================================
     CONTACT FORM
     ========================================================= */
  function initContactForm() {
    var form = $('#contactForm');
    if (!form) return;

    // Connect a real endpoint here (Formspree, Resend, your own API…).
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
      ok = setError('name', $('#name').value.trim() ? '' : 'Add your name so we know who we\'re talking to.') && ok;
      ok = setError('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('#email').value.trim()) ? '' : 'Enter an email address we can reply to.') && ok;
      ok = setError('message', $('#message').value.trim().length >= 10 ? '' : 'A sentence or two is enough — what isn\'t working?') && ok;
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
        : new Promise(function (res) { setTimeout(res, 700); });

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

  /* =========================================================
     RESPONSIVE ANIMATION CONTEXT
     One matchMedia. GSAP reverts and rebuilds everything inside
     it when a condition flips, so no duplicates can accumulate.
     ========================================================= */
  function initResponsiveAnimations() {
    if (!hasGSAP) return;

    app.mm = gsap.matchMedia();

    app.mm.add({
      isDesktop: '(min-width: 1024px)',
      isMobile: '(max-width: 1023px)',
      finePointer: '(hover: hover) and (pointer: fine)',
      motionOK: '(prefers-reduced-motion: no-preference)'
    }, function (ctx) {
      var c = ctx.conditions;

      // Reduced motion: content stays exactly as authored, no tweens at all.
      if (!c.motionOK) {
        $$('.step').forEach(function (s) { s.classList.add('is-active'); });
        return;
      }

      TUNE = c.isDesktop ? DESKTOP_TUNE : MOBILE_TUNE;

      var cleanups = [];

      initHero();
      initHeroTransition();
      cleanups.push(initMarquee());
      initEditorialMoments();
      initProblemStory(c.isDesktop);
      initServices();
      initNeedReveal();
      initProcess();
      cleanups.push(initSelectedWork(c.isDesktop));
      initWhyMWB();
      initFinalCTA();

      if (c.finePointer) {
        cleanups.push(initPointerFX());
        cleanups.push(initMagnetic());
      }

      return function () {
        cleanups.forEach(function (fn) { if (typeof fn === 'function') fn(); });
      };
    });
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function boot() {
    $('#year').textContent = new Date().getFullYear();

    initSmoothScroll();
    initAnchors();
    initNavigation();
    initImages();
    initRefreshLifecycle();
    initNeedFlow();
    initContactForm();
    initResponsiveAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
