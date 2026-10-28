/**
 * CineSense — animations.js
 * Cinematic animation system: intro splash, curtains, projector,
 * floating posters, marquee lights, film reel, scroll reveal,
 * analysis effects, Web Audio sounds.
 *
 * PCCSL 508 – Machine Learning Lab | CSE, FISAT
 */
'use strict';

(function () {

  /* ── Utility ─────────────────────────────────────────────────────────────── */
  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = id => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);

  /* ── Sound ───────────────────────────────────────────────────────────────── */
  let soundEnabled = false;
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playClap() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      // Short noise burst → clap simulation
      const bufSize = ctx.sampleRate * 0.12;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 0.8;
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch (e) { /* silently ignore audio errors */ }
  }

  function playDing() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
    } catch (e) { /* ignore */ }
  }

  /* ── Spiral Intro ────────────────────────────────────────────────────────── */
  let _introSpiral = null;   // AnimationController handle for intro
  let _heroSpiral  = null;   // AnimationController handle for hero bg

  function initSpiralIntro() {
    const introEl  = document.getElementById('spiral-intro');
    if (!introEl) return;

    // ── Skip if already seen this session ──────────────────────────────────
    if (sessionStorage.getItem('cinesense_spiral_seen')) {
      introEl.classList.add('intro-done');
      startHeroSpiral();
      return;
    }

    // ── Skip entirely for prefers-reduced-motion ───────────────────────────
    if (prefersReducedMotion()) {
      introEl.classList.add('intro-done');
      startHeroSpiral();
      return;
    }

    // ── Canvas check ──────────────────────────────────────────────────────
    const canvas = document.getElementById('spiral-intro-canvas');
    if (!canvas || typeof initSpiralAnimation === 'undefined') {
      // Fallback: just hide intro and continue
      introEl.classList.add('intro-done');
      startHeroSpiral();
      return;
    }

    // Size canvas to full screen
    canvas.style.width  = '100%';
    canvas.style.height = '100%';
    canvas.width  = window.innerWidth  * (window.devicePixelRatio || 1);
    canvas.height = window.innerHeight * (window.devicePixelRatio || 1);

    // Start the spiral at full density + normal speed
    _introSpiral = initSpiralAnimation(canvas, { speedMultiplier: 1 });

    // ── Fade-in the UI after 2 s ──────────────────────────────────────────
    const ui        = document.getElementById('spiral-intro-ui');
    const enterBtn  = document.getElementById('spiral-enter-btn');
    const skipBtn   = document.getElementById('spiral-skip-btn');

    setTimeout(() => {
      if (ui) { ui.removeAttribute('aria-hidden'); ui.classList.add('visible'); }
      if (enterBtn) enterBtn.focus(); // keyboard accessibility
    }, 2000);

    // ── Dismiss handler ───────────────────────────────────────────────────
    function dismissIntro() {
      sessionStorage.setItem('cinesense_spiral_seen', '1');
      introEl.classList.add('intro-fading');
      setTimeout(() => {
        introEl.classList.add('intro-done');
        if (_introSpiral) { _introSpiral.destroy(); _introSpiral = null; }
        startHeroSpiral();
      }, 1150);
    }

    if (enterBtn) {
      enterBtn.addEventListener('click',   dismissIntro);
      enterBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismissIntro(); } });
    }
    if (skipBtn) {
      skipBtn.addEventListener('click',   dismissIntro);
      skipBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismissIntro(); } });
    }
  }

  /* ── Hero background spiral ───────────────────────────────────────────────── */
  function startHeroSpiral() {
    const heroCanvas = document.getElementById('hero-spiral-canvas');
    if (!heroCanvas || typeof initSpiralAnimation === 'undefined') return;
    if (prefersReducedMotion()) return;   // CSS already hides it via media query

    // Size it to the hero section
    const hero = document.getElementById('hero');
    const heroW = (hero ? hero.offsetWidth  : window.innerWidth);
    const heroH = (hero ? hero.offsetHeight : window.innerHeight);
    heroCanvas.style.width  = '100%';
    heroCanvas.style.height = '100%';

    _heroSpiral = initSpiralAnimation(heroCanvas, {
      starCount:       window.innerWidth < 768 ? 1000 : 2000,   // lighter for bg
      speedMultiplier: 0.55,   // slower, more ambient
    });

    // Pause hero spiral when hero scrolls out of view
    // (IntersectionObserver already wired inside initSpiralAnimation)
  }

  /* Public: speed-up hero spiral while analysis is running */
  function heroBurst() {
    if (_heroSpiral) {
      document.getElementById('hero-spiral-canvas')?.classList.add('analyzing');
      _heroSpiral.setSpeed(2.2);
    }
  }
  function heroSettle() {
    if (_heroSpiral) {
      document.getElementById('hero-spiral-canvas')?.classList.remove('analyzing');
      _heroSpiral.setSpeed(0.55);
    }
  }

  /* ── Theater Curtains ────────────────────────────────────────────────────── */
  function openCurtains(delay = 0) {
    const left  = $('curtain-left');
    const right = $('curtain-right');
    const cont  = $('curtain-container');
    if (!left || !right) return;

    if (prefersReducedMotion()) { cont && (cont.style.display = 'none'); return; }

    setTimeout(() => {
      left.classList.add('open');
      right.classList.add('open');
      setTimeout(() => { if (cont) cont.style.display = 'none'; }, 2300);
    }, delay);
  }

  /* ── Film Strips ─────────────────────────────────────────────────────────── */
  function buildFilmStrips() {
    const FRAME_COUNT = 40; // 40 frames × 2 for seamless loop
    ['strip-track', 'strip-track-rev'].forEach((cls, idx) => {
      const tracks = document.querySelectorAll(`.${cls.split(' ')[0]}`);
      tracks.forEach(track => {
        for (let i = 0; i < FRAME_COUNT * 2; i++) {
          const frame = document.createElement('div');
          frame.className = 'strip-frame';
          frame.innerHTML = '<div class="sprocket"></div><div class="sprocket"></div>';
          track.appendChild(frame);
        }
      });
    });
  }

  /* ── Projector Beam & Dust ───────────────────────────────────────────────── */
  function initProjector() {
    const canvas = $('projector-canvas');
    if (!canvas || prefersReducedMotion()) return;

    function resize() {
      canvas.width  = canvas.offsetWidth  || window.innerWidth;
      canvas.height = canvas.offsetHeight || window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const ctx = canvas.getContext('2d');
    let raf;
    let beamAngle = 0;
    const DUST_COUNT = 80;

    const dust = Array.from({ length: DUST_COUNT }, () => ({
      x:  Math.random() * 1,
      y:  Math.random(),
      r:  Math.random() * 1.2 + 0.3,
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0003,
      o:  Math.random() * 0.5 + 0.15,
    }));

    function draw() {
      if (document.hidden) { raf = requestAnimationFrame(draw); return; }
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Subtle beam from top-right
      beamAngle += 0.0008;
      const bx = W * 0.85 + Math.sin(beamAngle) * W * 0.06;
      const spread = 0.32;
      const grd = ctx.createLinearGradient(bx, 0, W * 0.4, H);
      grd.addColorStop(0, 'rgba(25,195,177,0.10)');
      grd.addColorStop(0.5, 'rgba(25,195,177,0.04)');
      grd.addColorStop(1, 'rgba(25,195,177,0)');

      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx - W * spread, H);
      ctx.lineTo(bx + W * spread * 0.3, H);
      ctx.closePath();
      ctx.fillStyle = grd;
      ctx.fill();

      // Flickering opacity
      ctx.globalAlpha = 0.85 + Math.sin(Date.now() * 0.04) * 0.15;

      // Dust particles
      dust.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(25,195,177,${p.o * 0.5})`;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }

    draw();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !raf) raf = requestAnimationFrame(draw);
    });
  }

  /* ── Floating Movie Posters ──────────────────────────────────────────────── */
  function initPosters() {
    const container = $('posters-container');
    if (!container || window.innerWidth < 769 || prefersReducedMotion()) return;

    const POSTERS = [
      { title: 'MIDNIGHT EXPRESS',   gradient: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' },
      { title: 'NEON HORIZON',       gradient: 'linear-gradient(135deg,#0d0d0d,#ff006e22,#8338ec22)' },
      { title: 'THE LAST FRAME',     gradient: 'linear-gradient(135deg,#2c2c2c,#4a0e0e,#1a0a0a)' },
      { title: 'VELVET SHADOW',      gradient: 'linear-gradient(135deg,#240046,#3c096c,#5a189a)' },
      { title: 'CRIMSON TIDE',       gradient: 'linear-gradient(135deg,#7b0000,#c0392b,#7b0000)' },
      { title: 'IRON ECHO',          gradient: 'linear-gradient(135deg,#1c1c1c,#3a3a3a,#1c1c1c)' },
      { title: 'SILVER SCREEN',      gradient: 'linear-gradient(135deg,#1a1a1a,#888,#1a1a1a)' },
      { title: 'GOLDEN HOUR',        gradient: 'linear-gradient(135deg,#0b3a4a,#19c3b1,#0b3a4a)' },
    ];

    const heroRect = container.getBoundingClientRect();
    const cards = [];

    POSTERS.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'poster-card';
      el.style.background = p.gradient;
      el.style.left = (8 + (i % 4) * 22 + Math.random() * 6) + '%';
      el.style.top  = (10 + Math.floor(i / 4) * 45 + Math.random() * 12) + '%';
      el.style.opacity = (0.12 + Math.random() * 0.18).toString();
      el.style.transform = `rotate(${(Math.random() - 0.5) * 18}deg)`;
      el.innerHTML = `<div class="poster-title">${p.title}</div>`;
      container.appendChild(el);

      const baseLeft = parseFloat(el.style.left);
      const baseTop  = parseFloat(el.style.top);
      cards.push({ el, baseLeft, baseTop, depth: 0.03 + Math.random() * 0.09 });
    });

    let mx = 0, my = 0;
    window.addEventListener('mousemove', e => {
      const cx = e.clientX / window.innerWidth  - 0.5;
      const cy = e.clientY / window.innerHeight - 0.5;
      mx += (cx - mx) * 0.08;
      my += (cy - my) * 0.08;
    }, { passive: true });

    (function animate() {
      if (document.hidden) { requestAnimationFrame(animate); return; }
      cards.forEach(c => {
        const dx = mx * c.depth * 120;
        const dy = my * c.depth * 80;
        c.el.style.transform = `translate(${dx}px,${dy}px) rotate(${(c.baseLeft - 20) * 0.3}deg)`;
      });
      requestAnimationFrame(animate);
    })();
  }

  /* ── Marquee Lights ──────────────────────────────────────────────────────── */
  function initMarqueeLights() {
    const frame = qs('.marquee-frame');
    const bulbsCont = $('marquee-bulbs');
    if (!frame || !bulbsCont || window.innerWidth < 769 || prefersReducedMotion()) return;

    const W = frame.offsetWidth || 680;
    const H = frame.offsetHeight || 200;
    const SPACING = 28;

    const positions = [];
    // Top edge
    for (let x = 0; x < W; x += SPACING) positions.push([x, 0]);
    // Right edge
    for (let y = 0; y < H; y += SPACING) positions.push([W, y]);
    // Bottom edge
    for (let x = W; x > 0; x -= SPACING) positions.push([x, H]);
    // Left edge
    for (let y = H; y > 0; y -= SPACING) positions.push([0, y]);

    positions.forEach(([x, y], i) => {
      const b = document.createElement('div');
      b.className = 'marquee-bulb';
      b.style.left = (x - 5) + 'px';
      b.style.top  = (y - 5) + 'px';
      b.style.animationDelay = (i * 0.05) + 's';
      bulbsCont.appendChild(b);
    });
  }

  /* ── Film Reel ───────────────────────────────────────────────────────────── */
  function buildReel() {
    const reel = qs('.film-reel');
    if (!reel || prefersReducedMotion()) return;

    // Hub
    const hub = document.createElement('div');
    hub.className = 'reel-hub';
    reel.appendChild(hub);

    // Spokes via SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 260 260');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    const cx = 130, cy = 130, r = 90;
    const angles = [0, 60, 120, 180, 240, 300];
    angles.forEach(deg => {
      const rad = (deg * Math.PI) / 180;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', cx + ''); line.setAttribute('y1', cy + '');
      line.setAttribute('x2', (cx + Math.cos(rad) * r) + '');
      line.setAttribute('y2', (cy + Math.sin(rad) * r) + '');
      line.setAttribute('stroke', 'rgba(25,195,177,0.35)');
      line.setAttribute('stroke-width', '4');
      svg.appendChild(line);
      // Sprocket hole at spoke tip
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', (cx + Math.cos(rad) * r) + '');
      circle.setAttribute('cy', (cy + Math.sin(rad) * r) + '');
      circle.setAttribute('r', '9');
      circle.setAttribute('fill', '#0a0a0a');
      circle.setAttribute('stroke', 'rgba(25,195,177,0.45)');
      circle.setAttribute('stroke-width', '1.5');
      svg.appendChild(circle);
    });
    reel.appendChild(svg);
  }

  /* ── Subtitle Rotator ────────────────────────────────────────────────────── */
  function initSubtitleRotator() {
    const el = $('subtitle-rotator');
    if (!el) return;
    const phrases = [
      'Blockbuster or box-office bomb?',
      'Let the AI be your critic.',
      'Lights. Camera. Sentiment.',
    ];
    let idx = 0;
    setInterval(() => {
      el.classList.add('fade-out');
      setTimeout(() => {
        idx = (idx + 1) % phrases.length;
        el.textContent = phrases[idx];
        el.classList.remove('fade-out');
      }, 520);
    }, 3200);
  }

  /* ── Custom Cursor ───────────────────────────────────────────────────────── */
  function initCursor() {
    const cursor = $('custom-cursor');
    if (!cursor || prefersReducedMotion()) return;

    let cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });

    const interactable = 'a,button,.btn-primary,.btn-clap,.example-pill,.icon-btn';
    document.addEventListener('mouseover', e => {
      if (e.target.closest(interactable)) cursor.classList.add('over-btn');
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest(interactable)) cursor.classList.remove('over-btn');
    });

    (function moveCursor() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cursor.style.left = cx + 'px'; cursor.style.top = cy + 'px';
      requestAnimationFrame(moveCursor);
    })();
  }

  /* ── Button Ripple ───────────────────────────────────────────────────────── */
  function initRipples() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('button, .btn-primary, .btn-clap, .btn-secondary');
      if (!btn) return;
      const r = document.createElement('span');
      r.className = 'ripple';
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
      btn.appendChild(r);
      setTimeout(() => r.remove(), 680);
    });
  }

  /* ── Scroll Reveal ───────────────────────────────────────────────────────── */
  function initScrollReveal() {
    if (prefersReducedMotion()) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          // Animate metric rings when card enters viewport
          e.target.querySelectorAll('.metric-ring-svg circle.prog').forEach(c => {
            c.style.strokeDashoffset = c.dataset.offset;
          });
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  }

  /* ── Card Tilt ───────────────────────────────────────────────────────────── */
  function initCardTilt() {
    if (prefersReducedMotion()) return;
    document.querySelectorAll('.glass-card, .metric-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        card.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ── Navbar Scroll ───────────────────────────────────────────────────────── */
  function initNavbarScroll() {
    const nav = qs('.navbar');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  /* ── Scroll Cue ──────────────────────────────────────────────────────────── */
  function initScrollCue() {
    const cue = $('scroll-cue');
    if (!cue) return;
    const hide = () => { cue.classList.add('hidden'); window.removeEventListener('scroll', hide); };
    window.addEventListener('scroll', hide, { passive: true });
  }

  /* ── GSAP Scroll Animations ──────────────────────────────────────────────── */
  function initGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('.section-title, .section-eyebrow, .about-text').forEach(el => {
      gsap.from(el, {
        y: 40, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      });
    });
  }

  /* ── Analysis Start ──────────────────────────────────────────────────────── */
  function animateAnalysisStart() {
    document.body.classList.add('analyzing');
    const overlay = $('loading-overlay');
    if (overlay) overlay.hidden = false;
    const rs = $('result-section');
    if (rs) rs.hidden = true;
    playClap();
    // Intensify the hero spiral to signal activity
    heroBurst();
  }

  /* ── Analysis Result ─────────────────────────────────────────────────────── */
  function animateAnalysisResult(label, confidence) {
    document.body.classList.remove('analyzing');
    const overlay = $('loading-overlay');
    if (overlay) overlay.hidden = true;
    // Settle the hero spiral back to ambient speed
    heroSettle();

    if (prefersReducedMotion()) return;

    const isPos = label === 'POSITIVE';
    // Spotlight
    const spotlight = $('result-spotlight');
    if (spotlight) {
      spotlight.className = 'result-spotlight ' + (isPos ? 'pos-light' : 'neg-light');
    }

    // Stamp
    const stamp = $('result-stamp');
    if (stamp) {
      stamp.textContent = isPos ? 'CERTIFIED FRESH' : 'ROTTEN';
      stamp.className = 'result-stamp ' + (isPos ? 'stamp-pos' : 'stamp-neg');
      setTimeout(() => stamp.classList.add('show'), 800);
    }

    if (isPos) {
      confettiBurst();
      playDing();
    } else {
      screenShake();
    }
  }

  /* ── Count-up ────────────────────────────────────────────────────────────── */
  function animateCountUp(el, target) {
    if (!el) return;
    const duration = 1500, start = performance.now();
    (function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      el.textContent = (ease * target).toFixed(1);
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* ── Stars ───────────────────────────────────────────────────────────────── */
  function animateStars(confidence) {
    const stars = document.querySelectorAll('.star');
    if (!stars.length) return;
    const filled = Math.round(confidence * 5);
    stars.forEach((s, i) => {
      setTimeout(() => {
        s.classList.toggle('filled', i < filled);
      }, i * 120);
    });
  }

  /* ── Screen Shake ────────────────────────────────────────────────────────── */
  function screenShake() {
    if (prefersReducedMotion()) return;
    document.body.classList.add('shaking');
    setTimeout(() => document.body.classList.remove('shaking'), 650);
  }

  /* ── Confetti ────────────────────────────────────────────────────────────── */
  function confettiBurst() {
    if (prefersReducedMotion()) return;
    const canvas = $('confetti-canvas');
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.width  = parent?.offsetWidth  || 600;
    canvas.height = parent?.offsetHeight || 300;
    const ctx = canvas.getContext('2d');

    const colors = ['#19c3b1','#5eead4','#34d399','#ff8a3d','#eaf2f5','#ff5d5d'];
    const particles = Array.from({ length: 65 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4 - 20,
      r: Math.random() * 6 + 2,
      color: colors[Math.random() * colors.length | 0],
      vy: Math.random() * 2 + 1,
      vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * Math.PI * 2,
      rotv: (Math.random() - 0.5) * 0.15,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));

    let frame = 0;
    const MAX = 90;
    (function draw() {
      if (frame++ > MAX) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotv; p.vy += 0.04;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / MAX);
        if (p.shape === 'rect') ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      requestAnimationFrame(draw);
    })();
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */
  window.CineSenseAnimations = {
    soundClap:            playClap,
    toggleSound:          (on) => { soundEnabled = on; },
    animateAnalysisStart: animateAnalysisStart,
    animateAnalysisResult:animateAnalysisResult,
    animateCountUp:       animateCountUp,
    animateStars:         animateStars,
    heroBurst:            heroBurst,   // speed-up hero spiral while loading
    heroSettle:           heroSettle,  // settle hero spiral after result
  };

  /* ── Init ────────────────────────────────────────────────────────────────── */
  function init() {
    // Spiral intro replaces the old countdown-reticle splash
    // (initSpiralIntro defers to startHeroSpiral on dismiss)
    initSpiralIntro();

    initCursor();
    buildFilmStrips();
    initProjector();
    initPosters();
    initMarqueeLights();
    buildReel();
    initSubtitleRotator();
    initScrollReveal();
    initCardTilt();
    initRipples();
    initNavbarScroll();
    initScrollCue();

    // Open curtains: immediately if intro already seen, else after spiral intro finishes
    const spiralSeen = sessionStorage.getItem('cinesense_spiral_seen');
    openCurtains(spiralSeen ? 200 : 5200);

    // GSAP ScrollTrigger — runs after deferred scripts load
    if (typeof ScrollTrigger !== 'undefined') initGSAP();
    else window.addEventListener('load', () => { if (typeof ScrollTrigger !== 'undefined') initGSAP(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
