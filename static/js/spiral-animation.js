/**
 * CineSense — spiral-animation.js
 * Vanilla JS port of spiral-animation.tsx (React + TypeScript → plain JS).
 * Exposes:  initSpiralAnimation(canvas, options) → { pause, resume, destroy, setSpeed }
 *
 * Requires GSAP 3.x to be loaded (window.gsap).
 * PCCSL 508 – Machine Learning Lab | CSE, FISAT
 */
'use strict';

(function (global) {

  /* ─────────────────────────────────────────────────────────────────────────
     Vector helpers  (identical to TypeScript originals, types stripped)
  ───────────────────────────────────────────────────────────────────────── */
  function Vector2D(x, y) { this.x = x; this.y = y; }
  Vector2D.random = function (min, max) { return min + Math.random() * (max - min); };

  function Vector3D(x, y, z) { this.x = x; this.y = y; this.z = z; }
  Vector3D.random = function (min, max) { return min + Math.random() * (max - min); };

  /* ─────────────────────────────────────────────────────────────────────────
     Star  (multi-phase motion — direct port, TypeScript types stripped)
  ───────────────────────────────────────────────────────────────────────── */
  function Star(cameraZ, cameraTravelDistance) {
    this.angle            = Math.random() * Math.PI * 2;
    this.distance         = 30 * Math.random() + 15;
    this.rotationDirection= Math.random() > 0.5 ? 1 : -1;
    this.expansionRate    = 1.2 + Math.random() * 0.8;
    this.finalScale       = 0.7 + Math.random() * 0.6;

    this.dx = this.distance * Math.cos(this.angle);
    this.dy = this.distance * Math.sin(this.angle);

    this.spiralLocation = (1 - Math.pow(1 - Math.random(), 3.0)) / 1.3;

    var lerp = function (a, b, t) { return a * (1 - t) + b * t; };
    this.z = lerp(
      Vector2D.random(0.5 * cameraZ, cameraTravelDistance + cameraZ),
      cameraTravelDistance / 2,
      0.3 * this.spiralLocation
    );
    this.strokeWeightFactor = Math.pow(Math.random(), 2.0);
  }

  Star.prototype.render = function (p, ctrl) {
    var spiralPos = ctrl.spiralPath(this.spiralLocation);
    var q = p - this.spiralLocation;
    if (q <= 0) return;

    var displacementProgress = ctrl.constrain(4 * q, 0, 1);

    /* ── Mixed easing (linear → power → elastic) ── */
    var linearEasing  = displacementProgress;
    var elasticEasing = ctrl.easeOutElastic(displacementProgress);
    var powerEasing   = Math.pow(displacementProgress, 2);
    var easing;

    if (displacementProgress < 0.3) {
      easing = ctrl.lerp(linearEasing, powerEasing, displacementProgress / 0.3);
    } else if (displacementProgress < 0.7) {
      var t = (displacementProgress - 0.3) / 0.4;
      easing = ctrl.lerp(powerEasing, elasticEasing, t);
    } else {
      easing = elasticEasing;
    }

    /* ── Position per phase ── */
    var screenX, screenY;

    if (displacementProgress < 0.3) {
      // Phase 1: straight movement (30%)
      var r = easing / 0.3;
      screenX = ctrl.lerp(spiralPos.x, spiralPos.x + this.dx * 0.3, r);
      screenY = ctrl.lerp(spiralPos.y, spiralPos.y + this.dy * 0.3, r);

    } else if (displacementProgress < 0.7) {
      // Phase 2: curved arc (40%)
      var midProgress  = (displacementProgress - 0.3) / 0.4;
      var curveStrength= Math.sin(midProgress * Math.PI) * this.rotationDirection * 1.5;
      var baseX  = spiralPos.x + this.dx * 0.3;
      var baseY  = spiralPos.y + this.dy * 0.3;
      var targetX= spiralPos.x + this.dx * 0.7;
      var targetY= spiralPos.y + this.dy * 0.7;
      var perpX  = -this.dy * 0.4 * curveStrength;
      var perpY  =  this.dx * 0.4 * curveStrength;
      screenX = ctrl.lerp(baseX, targetX, midProgress) + perpX * midProgress;
      screenY = ctrl.lerp(baseY, targetY, midProgress) + perpY * midProgress;

    } else {
      // Phase 3: spiral expansion (30%)
      var finalProgress  = (displacementProgress - 0.7) / 0.3;
      var baseXf = spiralPos.x + this.dx * 0.7;
      var baseYf = spiralPos.y + this.dy * 0.7;
      var targetDistance = this.distance * this.expansionRate * 1.5;
      var spiralTurns    = 1.2 * this.rotationDirection;
      var spiralAngle    = this.angle + spiralTurns * finalProgress * Math.PI;
      var targetXf = spiralPos.x + targetDistance * Math.cos(spiralAngle);
      var targetYf = spiralPos.y + targetDistance * Math.sin(spiralAngle);
      screenX = ctrl.lerp(baseXf, targetXf, finalProgress);
      screenY = ctrl.lerp(baseYf, targetYf, finalProgress);
    }

    /* ── 2D screen → 3D space ── */
    var vx = (this.z - ctrl._cameraZ) * screenX / ctrl._viewZoom;
    var vy = (this.z - ctrl._cameraZ) * screenY / ctrl._viewZoom;
    var position = new Vector3D(vx, vy, this.z);

    /* ── Size animation ── */
    var sizeMultiplier;
    if (displacementProgress < 0.6) {
      sizeMultiplier = 1.0 + displacementProgress * 0.2;
    } else {
      var ts = (displacementProgress - 0.6) / 0.4;
      sizeMultiplier = 1.2 * (1.0 - ts) + this.finalScale * ts;
    }
    var dotSize = 8.5 * this.strokeWeightFactor * sizeMultiplier;
    ctrl.showProjectedDot(position, dotSize);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     AnimationController
     options: { starCount, speedMultiplier, opacity }
  ───────────────────────────────────────────────────────────────────────── */
  function AnimationController(canvas, ctx, opts) {
    opts = opts || {};

    this._canvas  = canvas;
    this._ctx     = ctx;
    this._time    = 0;
    this._stars   = [];
    this._speedMultiplier = opts.speedMultiplier || 1;

    /* Constants (original values) */
    this._changeEventTime     = 0.32;
    this._cameraZ             = -400;
    this._cameraTravelDistance= 3400;
    this._startDotYOffset     = 28;
    this._viewZoom            = 100;
    this._trailLength         = 80;

    /* Star count: cap for mobile / low-end */
    var mobile    = window.innerWidth < 768;
    var lowEnd    = (navigator.hardwareConcurrency || 4) < 4;
    var maxStars  = (mobile || lowEnd) ? 2500 : 5000;
    this._numberOfStars = Math.min(opts.starCount || maxStars, maxStars);

    /* Seeded random — fix double-create bug: build stars exactly once
       using the seeded generator, restore Math.random afterwards.       */
    var originalRandom = Math.random;
    var seed = 1234;
    Math.random = function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (var i = 0; i < this._numberOfStars; i++) {
      this._stars.push(new Star(this._cameraZ, this._cameraTravelDistance));
    }
    Math.random = originalRandom;   // restore

    this._setupTimeline();
  }

  AnimationController.prototype._setupTimeline = function () {
    var self = this;
    var duration = 15 / this._speedMultiplier;

    // Kill any previous timeline cleanly
    if (this._timeline) { this._timeline.kill(); }

    this._timeline = gsap.timeline({ repeat: -1 });
    this._timeline.to(this, {
      _time: 1,
      duration: duration,
      ease: 'none',
      onUpdate: function () { self._render(); }
    });
  };

  /* ── Math helpers ── */
  AnimationController.prototype.ease = function (p, g) {
    if (p < 0.5) return 0.5 * Math.pow(2 * p, g);
    return 1 - 0.5 * Math.pow(2 * (1 - p), g);
  };

  AnimationController.prototype.easeOutElastic = function (x) {
    var c4 = (2 * Math.PI) / 4.5;
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return Math.pow(2, -8 * x) * Math.sin((x * 8 - 0.75) * c4) + 1;
  };

  AnimationController.prototype.map = function (value, s1, e1, s2, e2) {
    return s2 + (e2 - s2) * ((value - s1) / (e1 - s1));
  };

  AnimationController.prototype.constrain = function (v, min, max) {
    return Math.min(Math.max(v, min), max);
  };

  AnimationController.prototype.lerp = function (a, b, t) {
    return a * (1 - t) + b * t;
  };

  /* ── Spiral path ── */
  AnimationController.prototype.spiralPath = function (p) {
    p = this.constrain(1.2 * p, 0, 1);
    p = this.ease(p, 1.8);
    var turns = 6;
    var theta = 2 * Math.PI * turns * Math.sqrt(p);
    var r     = 170 * Math.sqrt(p);
    return new Vector2D(
      r * Math.cos(theta),
      r * Math.sin(theta) + this._startDotYOffset
    );
  };

  /* ── Rotate ── */
  AnimationController.prototype.rotate = function (v1, v2, p, orientation) {
    var mx = (v1.x + v2.x) / 2, my = (v1.y + v2.y) / 2;
    var dx = v1.x - mx,          dy = v1.y - my;
    var angle  = Math.atan2(dy, dx);
    var o      = orientation ? -1 : 1;
    var r      = Math.sqrt(dx * dx + dy * dy);
    var bounce = Math.sin(p * Math.PI) * 0.05 * (1 - p);
    return new Vector2D(
      mx + r * (1 + bounce) * Math.cos(angle + o * Math.PI * this.easeOutElastic(p)),
      my + r * (1 + bounce) * Math.sin(angle + o * Math.PI * this.easeOutElastic(p))
    );
  };

  /* ── 3D → 2D projection ── */
  AnimationController.prototype.showProjectedDot = function (position, sizeFactor) {
    var t2 = this.constrain(this.map(this._time, this._changeEventTime, 1, 0, 1), 0, 1);
    var newCameraZ = this._cameraZ + this.ease(Math.pow(t2, 1.2), 1.8) * this._cameraTravelDistance;

    if (position.z > newCameraZ) {
      var depth = position.z - newCameraZ;
      var x  = this._viewZoom * position.x / depth;
      var y  = this._viewZoom * position.y / depth;
      var sw = 400 * sizeFactor / depth;
      this._ctx.lineWidth = sw;
      this._ctx.beginPath();
      this._ctx.arc(x, y, 0.5, 0, Math.PI * 2);
      this._ctx.fill();
    }
  };

  /* ── Draw start dot ── */
  AnimationController.prototype._drawStartDot = function () {
    if (this._time > this._changeEventTime) {
      var dy  = this._cameraZ * this._startDotYOffset / this._viewZoom;
      var pos = new Vector3D(0, dy, this._cameraTravelDistance);
      this.showProjectedDot(pos, 2.5);
    }
  };

  /* ── Draw trail ── */
  AnimationController.prototype._drawTrail = function (t1) {
    for (var i = 0; i < this._trailLength; i++) {
      var f    = this.map(i, 0, this._trailLength, 1.1, 0.1);
      var sw   = (1.3 * (1 - t1) + 3.0 * Math.sin(Math.PI * t1)) * f;
      this._ctx.fillStyle = 'white';
      this._ctx.lineWidth = sw;

      var pathTime = t1 - 0.00015 * i;
      var position = this.spiralPath(pathTime);
      var offset   = new Vector2D(position.x + 5, position.y + 5);
      var rotated  = this.rotate(
        position, offset,
        Math.sin(this._time * Math.PI * 2) * 0.5 + 0.5,
        i % 2 === 0
      );
      this._ctx.beginPath();
      this._ctx.arc(rotated.x, rotated.y, sw / 2, 0, Math.PI * 2);
      this._ctx.fill();
    }
  };

  /* ── Main render ── */
  AnimationController.prototype._render = function () {
    if (this._paused) return;
    var ctx    = this._ctx;
    var canvas = this._canvas;
    if (!ctx) return;

    var W = canvas.width, H = canvas.height;

    // Fill background — use logical size (pre-DPR)
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, W, H);

    var cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.translate(cx, cy);

    var t1 = this.constrain(this.map(this._time, 0, this._changeEventTime + 0.25, 0, 1), 0, 1);
    var t2 = this.constrain(this.map(this._time, this._changeEventTime, 1, 0, 1), 0, 1);

    ctx.rotate(-Math.PI * this.ease(t2, 2.7));

    this._drawTrail(t1);

    ctx.fillStyle = 'white';
    for (var i = 0; i < this._stars.length; i++) {
      this._stars[i].render(t1, this);
    }

    this._drawStartDot();
    ctx.restore();
  };

  /* ── Public controls ── */
  AnimationController.prototype.pause  = function () {
    this._paused = true;
    if (this._timeline) this._timeline.pause();
  };
  AnimationController.prototype.resume = function () {
    this._paused = false;
    if (this._timeline) this._timeline.play();
  };
  AnimationController.prototype.destroy = function () {
    if (this._timeline) { this._timeline.kill(); this._timeline = null; }
    this._stars = [];
  };

  /**
   * Change playback speed without rebuilding stars.
   * @param {number} multiplier  1 = normal, 2 = 2× faster, 0.5 = half speed
   */
  AnimationController.prototype.setSpeed = function (multiplier) {
    this._speedMultiplier = multiplier;
    if (this._timeline) {
      this._timeline.timeScale(multiplier);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Public factory  initSpiralAnimation(canvas, options)
     options: {
       starCount      : number   (default: auto, capped at 5000 / 2500 mobile)
       speedMultiplier: number   (default: 1)
       opacity        : number   (0-1, default: 1, applied via CSS on canvas)
       onReady        : function (called once after first render)
     }
     Returns: { pause, resume, destroy, setSpeed }
  ───────────────────────────────────────────────────────────────────────── */
  function initSpiralAnimation(canvas, opts) {
    if (!canvas || typeof gsap === 'undefined') return null;
    opts = opts || {};

    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    /* Reduced-motion: skip entirely */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas.style.display = 'none';
      return {
        pause:   function () {},
        resume:  function () {},
        destroy: function () {},
        setSpeed:function () {}
      };
    }

    var dpr = window.devicePixelRatio || 1;
    var ctrl = null;

    /* ── Size canvas to cover full viewport ── */
    function resize() {
      var W = canvas.offsetWidth  || window.innerWidth;
      var H = canvas.offsetHeight || window.innerHeight;

      // Reset transform BEFORE scaling to avoid stacking scales on resize
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.scale(dpr, dpr);
    }

    resize();

    /* ── Build controller ── */
    ctrl = new AnimationController(canvas, ctx, opts);

    if (opts.opacity != null) {
      canvas.style.opacity = opts.opacity;
    }

    if (typeof opts.onReady === 'function') {
      // Fire after first gsap tick
      gsap.delayedCall(0.1, opts.onReady);
    }

    /* ── Debounced resize ── */
    var resizeTimer = null;
    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        ctrl.pause();
        resize();
        // Rebuild controller to keep stars proportional (stars reference canvas center)
        ctrl.destroy();
        ctrl = new AnimationController(canvas, ctx, opts);
        if (canvas.dataset.paused === 'true') ctrl.pause();
      }, 250);
    }
    window.addEventListener('resize', handleResize, { passive: true });

    /* ── Pause when tab hidden ── */
    function onVisChange() {
      if (document.hidden) ctrl.pause(); else ctrl.resume();
    }
    document.addEventListener('visibilitychange', onVisChange);

    /* ── Pause when canvas off-screen (IntersectionObserver) ── */
    var io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            canvas.dataset.paused = 'false';
            ctrl.resume();
          } else {
            canvas.dataset.paused = 'true';
            ctrl.pause();
          }
        });
      }, { threshold: 0.01 });
      io.observe(canvas);
    }

    /* ── Public API ── */
    return {
      pause:  function () { canvas.dataset.paused = 'true';  ctrl.pause();  },
      resume: function () { canvas.dataset.paused = 'false'; ctrl.resume(); },
      setSpeed: function (m) { ctrl.setSpeed(m); },
      destroy: function () {
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', onVisChange);
        if (io) { io.disconnect(); io = null; }
        clearTimeout(resizeTimer);
        if (ctrl) { ctrl.destroy(); ctrl = null; }
      }
    };
  }

  /* Export to global */
  global.initSpiralAnimation = initSpiralAnimation;

}(window));
