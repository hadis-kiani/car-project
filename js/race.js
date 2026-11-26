/* ============================================================
   NIRO CITY — Race: فیزیک آرکید، هوش مصنوعی، دوربین، HUD
   ============================================================ */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  var Data = root.NitroData;
  var World = root.NitroWorld;
  var CarFactory = root.NitroCarFactory;
  var AudioMan = root.NitroAudio;

  var AI_PAINTS = ['#d7d9de', '#ffb703', '#1d6fd1', '#0f7b3d', '#fb5607', '#5a189a', '#e9e9ec', '#0b0b0e'];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function formatTime(sec) {
    if (!isFinite(sec)) return '--:--.--';
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60), c = Math.floor((sec % 1) * 100);
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s) + '.' + (c < 10 ? '0' + c : c);
  }

  /* ============================================================
     RaceSession
     opts: { container, trackId, tod, laps, difficulty, save, audio, callbacks: { onFinish, onQuit } }
     ============================================================ */
  function RaceSession(opts) {
    this.opts = opts;
    this.save = opts.save;
    this.audio = opts.audio || new AudioMan.AudioEngine();
    var track = Data.TRACKS.find(function (t) { return t.id === opts.trackId; }) || Data.TRACKS[0];
    this.track = track;
    this.tod = opts.tod || 'night';
    this.laps = opts.laps || 2;
    this.difficulty = Data.DIFFICULTY.find(function (d) { return d.id === opts.difficulty; }) || Data.DIFFICULTY[1];
    this.carId = (opts.carId) || this.save.selectedId;
    this.state = 'boot'; // boot → countdown → racing → finished
    this.disposed = false;
    this._raf = null;
    this._clock = { last: 0 };
    this.keys = {};
    this.touch = { left: false, right: false, gas: false, brake: false, drift: false };
    this.camMode = this.save.settings.camera === 'cockpit' ? 'cockpit' : 'chase';
    this.paused = false;
    this.racingTime = 0;
    this.countdownT = 3.6;
    this.countdownStep = 4;
    this.driftScore = 0;
    this.driftHold = 0;
    this.offroad = false;
    this.wrongWayT = 0;
    this.skidQuads = [];
    this.skidTimer = 0;
    this._skidGeo = null;
    this.shake = 0;
    this.hudTimer = 0;
    this.lastSeg = null;
    this.resultSent = false;
    /* ---------- چالش ---------- */
    this.challenge = opts.challenge || null;
    this.maxKmh = 0;
    this.challengeLiveDone = false;
    this._initScene();
    this._initPlayer();
    this._initAI();
    this._bindInput();
    this._setState('countdown');
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  /* ---------- صحنه ---------- */
  RaceSession.prototype._initScene = function () {
    var container = this.opts.container;
    container.innerHTML = '';
    var scene = new THREE.Scene();
    this.scene = scene;
    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    var quality = this.save.settings.quality || 'high';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = quality === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(66, container.clientWidth / container.clientHeight, 0.12, 2200);
    this.camera.position.set(0, 4, 10);

    this.world = World.buildRaceWorld(scene, renderer, this.track, this.tod);
    scene.fog.far = this.tod === 'night' ? 520 : this.tod === 'sunset' ? 700 : 860;

    this._resizeHandler = this._onResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);
  };

  RaceSession.prototype._onResize = function () {
    var c = this.opts.container;
    if (!c || !this.renderer) return;
    var w = c.clientWidth, h = c.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /* ---------- بازیکن ---------- */
  RaceSession.prototype._initPlayer = function () {
    var car = Data.getCar(this.carId);
    var save = this.save;
    this.carDef = car;
    this.stats = Data.effectiveStats(car, save);
    var paint = Data.carPaint(save, car.id);
    this.player = CarFactory.buildCar({
      body: car.body, style: car.style, paint: paint, finish: Data.carFinish(save, car.id),
      rim: Data.carRim(save, car.id), rimColorHex: (Data.RIM_COLORS.find(function (r) { return r.id === Data.carRimColor(save, car.id); }) || {}).hex || '#d7d9de',
      tire: Data.carTire(save, car.id), glow: (Data.GLOWS.find(function (g) { return g.id === Data.carGlow(save, car.id) && g.hex; }) || {}).hex || null
    });
    var grid = this.world.startGrid[0];
    this.playerCar = this.player;
    this.player.position.copy(grid.pos);
    this.player.rotation.order = 'YXZ';
    this.player.rotation.y = grid.yaw;
    this.scene.add(this.player);

    this.ppos = grid.pos.clone();
    this.yaw = grid.yaw;
    this.vel = new THREE.Vector3();
    this.sf = 0; this.sl = 0;
    this.steerVis = 0;
    this.segHint = grid.index;
    this.gridDist = this.world.samples[grid.index].cum || 0;
    this.lap = 1;
    this.lapStart = 0;
    this.bestLap = Infinity;
    this.lapTimes = [];
    this.progress = 0;    // کل فاصلهٔ طی‌شده (متر)
    this.segFloat = grid.index;
    this.prevSegIdx = grid.index;
    this.finished = false;

    /* چراغ جلو برای شب */
    if (this.tod === 'night') {
      var head = new THREE.SpotLight(0xd8e9ff, 1.7, 62, 0.46, 0.55, 1.4);
      head.position.set(0, 1.05, 1.6);
      var tgt = new THREE.Object3D();
      tgt.position.set(0, 0.4, 16);
      this.player.add(tgt);
      head.target = tgt;
      this.player.add(head);
      this.headlight = head;
    }
  };

  /* ---------- هوش مصنوعی ---------- */
  RaceSession.prototype._initAI = function () {
    var ai = [];
    var skill = this.difficulty.skill;
    var count = this.difficulty.aiCount;
    // انتخاب حریفان: از کاتالوگ، به ترتیب تصادفی قطعی بر اساس مسیر+ماشین
    var seed = 0;
    var key = this.track.id + '|' + this.carId;
    for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    var pool = Data.CARS.filter(function (c) { return c.id !== this.carId; }, this).slice();
    // مرتب‌سازی تصادفی
    for (var j = pool.length - 1; j > 0; j--) {
      var k = Math.floor(rnd() * (j + 1));
      var tmp = pool[j]; pool[j] = pool[k]; pool[k] = tmp;
    }
    var totalLen = this.world.length;
    for (var n = 0; n < count; n++) {
      var cDef = pool[n % pool.length];
      var paint = AI_PAINTS[(n * 3 + 1) % AI_PAINTS.length];
      var mesh = CarFactory.buildCar({ body: cDef.body, style: cDef.style, paint: paint, finish: n % 3 === 0 ? 'pearl' : 'gloss', rim: n % 2 ? 'sport' : 'mesh', rimColorHex: '#d7d9de', tire: 'sport', glow: null });
      var slot = n + 1; // جایگاه ۱..count در گرید (۰ = بازیکن)
      var grid = this.world.startGrid[Math.min(slot, this.world.startGrid.length - 1)];
      mesh.rotation.order = 'YXZ';
      mesh.position.copy(grid.pos);
      mesh.rotation.y = grid.yaw;
      this.scene.add(mesh);
      var topMS = (cDef.topKmh / 3.6) * (0.80 + 0.18 * skill) * (0.94 + rnd() * 0.10);
      ai.push({
        def: cDef, mesh: mesh,
        laneLat: (slot % 2 === 0 ? -1 : 1) * this.world.halfWidth * 0.45,
        lanePhase: rnd() * Math.PI * 2,
        speed: 0,
        topMS: topMS,
        accel: (5.0 + Math.pow(cDef.accel / 100, 1.12) * 8.6) * (0.75 + 0.35 * skill),
        aiDist: 0, // پر می‌شود در attachGrid
        gridSlot: slot,
        lap: 1,
        finished: false,
        finishTime: 0,
        pushX: 0, pushZ: 0,
        hitCooldown: 0
      });
    }
    // محاسبهٔ aiDist اولیه از موقعیت گرید
    var self = this;
    ai.forEach(function (a) {
      var best = 0, bd = Infinity;
      for (var i2 = 0; i2 < self.world.samples.length; i2++) {
        var s = self.world.samples[i2];
        var d2 = (s.pos.x - a.mesh.position.x) * (s.pos.x - a.mesh.position.x) + (s.pos.z - a.mesh.position.z) * (s.pos.z - a.mesh.position.z);
        if (d2 < bd) { bd = d2; best = i2; }
      }
      a.aiDist = self.world.samples[best].cum;
      a.segIdx = best;
    });
    this.ai = ai;
  };

  /* میان‌یابی موقعیت روی مرکزخط جاده در فاصلهٔ s متر */
  RaceSession.prototype._trackPointAt = function (dist, out) {
    var samples = this.world.samples, n = samples.length, total = this.world.length;
    var d = ((dist % total) + total) % total;
    // باینری سرچ روی cum
    var lo = 0, hi = n - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (samples[mid].cum <= d) lo = mid; else hi = mid - 1;
    }
    var s0 = samples[lo], s1 = samples[(lo + 1) % n];
    var segLen = (lo + 1 < n ? (s1.cum - s0.cum) : (total - s0.cum + 0)) || 1;
    var t = clamp((d - s0.cum) / segLen, 0, 1);
    out.pos.lerpVectors(s0.pos, s1.pos, t);
    out.tangent.lerpVectors(s0.tangent, s1.tangent, t).normalize();
    out.side.lerpVectors(s0.side, s1.side, t).normalize();
    out.index = lo;
    return out;
  };

  /* ---------- ورودی ---------- */
  RaceSession.prototype._bindInput = function () {
    var self = this;
    this._keyDown = function (e) {
      var k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
      self.keys[k] = true;
      if (k === 'c') self.toggleCamera();
      if (k === 'escape') self.togglePause();
      if (k === 'm') { self.audio.setMuted(!self.audio.muted); self._syncMuteButton(); }
    };
    this._keyUp = function (e) { self.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', this._keyDown, { passive: false });
    window.addEventListener('keyup', this._keyUp);

    /* دکمه‌های لمسی */
    var bindHold = function (id, prop) {
      var el = document.getElementById(id);
      if (!el) return;
      var on = function (e) { e.preventDefault(); self.touch[prop] = true; el.classList.add('active'); };
      var off = function (e) { if (e) e.preventDefault(); self.touch[prop] = false; el.classList.remove('active'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    bindHold('touch-left', 'left');
    bindHold('touch-right', 'right');
    bindHold('touch-gas', 'gas');
    bindHold('touch-brake', 'brake');
    bindHold('touch-drift', 'drift');

    var q = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    q('btn-pause', function () { self.togglePause(); });
    q('btn-cam', function () { self.toggleCamera(); });
    q('btn-mute', function () { self.audio.setMuted(!self.audio.muted); self._syncMuteButton(); });
    q('btn-resume', function () { self.togglePause(); });
    q('btn-restart', function () { var cb = self.opts.callbacks.onRestart; self.dispose(); if (cb) cb(); });
    q('btn-quit', function () { var cb = self.opts.callbacks.onQuit; self.dispose(); if (cb) cb(); });
    this._syncMuteButton();
  };

  RaceSession.prototype._syncMuteButton = function () {
    var el = document.getElementById('btn-mute');
    if (el) el.textContent = this.audio.muted ? '🔇' : '🔊';
  };

  RaceSession.prototype.toggleCamera = function () {
    if (this.disposed) return;
    this.camMode = this.camMode === 'chase' ? 'cockpit' : 'chase';
    var int = this.player.userData.interior;
    if (int) int.visible = this.camMode === 'cockpit';
    this._flashMsg(this.camMode === 'cockpit' ? 'دوربین کابین' : 'دوربین تعقیب', 0.9);
  };

  RaceSession.prototype.togglePause = function () {
    if (this.state !== 'racing' && this.state !== 'countdown') return;
    this.paused = !this.paused;
    var overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.toggle('visible', this.paused);
    if (this.paused) { this.audio.setScreech(0); this.audio.setWind(0); }
  };

  /* ---------- پیام وسط صفحه ---------- */
  RaceSession.prototype._flashMsg = function (text, seconds) {
    var el = document.getElementById('hud-msg');
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    var self = this;
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(function () { el.classList.remove('visible'); }, (seconds || 1.4) * 1000);
  };

  /* ============================================================
     حلقهٔ اصلی
     ============================================================ */
  RaceSession.prototype._tick = function (t) {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._tick);
    var last = this._clock.last || t;
    var dt = clamp((t - last) / 1000, 0, 0.05);
    this._clock.last = t;
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }

    if (this.state === 'countdown') this._updateCountdown(dt);
    else if (this.state === 'racing' || this.state === 'finished') this._updateRace(dt);

    this._updateCamera(dt);
    this._updateHUD(dt);
    this._updateSun();
    this.renderer.render(this.scene, this.camera);
  };

  RaceSession.prototype._updateCountdown = function (dt) {
    var prev = this.countdownT;
    this.countdownT -= dt;
    var step = Math.ceil(this.countdownT);
    if (step !== this.countdownStep) {
      this.countdownStep = step;
      var el = document.getElementById('countdown-num');
      if (step >= 1) { if (el) { el.textContent = String(step); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } this.audio.beep(false); }
    }
    if (this.countdownT <= 0) {
      this._setState('racing');
      document.getElementById('countdown-overlay').classList.remove('visible');
      this.audio.beep(true);
      this.lapStart = 0;
      this.racingTime = 0;
      this._flashMsg('شروع!', 1.0);
    }
    // دور موتور درجا با گاز نوسان
    var rev = 0.15 + 0.1 * Math.abs(Math.sin(performance.now() * 0.004));
    this.audio.updateEngine(rev, 0.3, 0, false);
    // چرخ‌ها ثابت، فقط دوربین آرام به پشت ماشین می‌رود
    this.sf = 0; this.sl = 0; this.vel.set(0, 0, 0);
  };

  RaceSession.prototype._setState = function (s) {
    this.state = s;
    var hc = document.getElementById('hud-challenge');
    if (hc) hc.classList.toggle('hidden', !this.challenge || s === 'finished');
    if (s === 'countdown') {
      var el = document.getElementById('countdown-overlay');
      if (el) el.classList.add('visible');
      var num = document.getElementById('countdown-num');
      if (num) { num.textContent = '3'; }
    }
  };

  /* ---------- به‌روزرسانی مسابقه ---------- */
  RaceSession.prototype._updateRace = function (dt) {
    var raceActive = this.state === 'racing' && !this.finished;
    var k = this.keys, tc = this.touch;
    var throttle = (raceActive && (k['arrowup'] || k['w'] || tc.gas)) ? 1 : 0;
    var brake    = (raceActive && (k['arrowdown'] || k['s'] || tc.brake)) ? 1 : 0;
    /* left = steering toward the driver's left; with yaw measured from +Z and the car facing +sin/+cos(yaw),
       left must INCREASE yaw. Positive steerIn turns the car left. */
    var steerIn  = 0;
    if (raceActive && (k['arrowleft'] || k['a'] || tc.left)) steerIn += 1;
    if (raceActive && (k['arrowright'] || k['d'] || tc.right)) steerIn -= 1;
    var handbrake = raceActive && (k[' '] || tc.drift);

    if (this.state === 'finished') { throttle = 0.25; steerIn = 0; } // رهاشدن آرام بعد از خط پایان

    this.racingTime += this.state === 'racing' ? dt : 0;

    var st = this.stats;
    var fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    var right = new THREE.Vector3(fwd.z, 0, -fwd.x);

    var near = this.world.findNearest(this.ppos, this.segHint);
    this.segHint = near.index;
    var tangent = near.sample.tangent;
    var lateral = near.lateral;
    var halfW = this.world.halfWidth;
    this.offroad = Math.abs(lateral) > halfW - 0.35;

    /* نیروی موتور در جهت جلو */
    var topMS = st.topKmh / 3.6;
    if (throttle > 0) this.sf += st.accel * (1 - this.sf / topMS) * throttle * dt;
    /* ترمز / دنده عقب */
    if (brake) {
      if (this.sf > 0.7) this.sf -= st.brake * dt;
      else this.sf = Math.max(this.sf - 5.6 * dt, -9);
    }
    /* شیب جاده */
    var fwdTan = tangent.x * fwd.x + tangent.z * fwd.z;
    var slopeSign = fwdTan >= 0 ? 1 : -1;
    this.sf -= 9.81 * tangent.y * slopeSign * 0.85 * dt;
    /* مقاومت غلطیدن + آفرود */
    var rolling = 0.42;
    if (this.offroad) rolling += 3.4;
    if (Math.abs(this.sf) > 0.05) this.sf -= Math.sign(this.sf) * Math.min(Math.abs(this.sf), rolling * dt);
    /* درگ هوا */
    this.sf -= Math.sign(this.sf) * 0.00035 * this.sf * this.sf * dt;
    /* ترمز دستی سرعت را کم می‌کند */
    if (handbrake) this.sf -= Math.sign(this.sf) * Math.min(Math.abs(this.sf), 2.1 * dt);

    /* گریپ جانبی */
    var grip = st.grip * (handbrake ? 0.32 : 1.0);
    this.sl *= Math.exp(-grip * dt);
    /* انتقال وزن هنگام شتاب/ترمز */
    this.sl += -fwd.x * 0 + 0; // جایگاه برای ثبات عددی

    /* فرمان */
    this.steerVis = lerp(this.steerVis, steerIn, 1 - Math.exp(-9 * dt));
    var speedAbs = Math.abs(this.sf);
    var steerFactor = clamp(1.32 - speedAbs / 58, 0.33, 1.32) * clamp(speedAbs / 5 + 0.28, 0, 1);
    var yawGain = st.yawGain * (handbrake ? 1.85 : 1.0);
    var yawRate = this.steerVis * yawGain * 1.62 * steerFactor;
    this.yaw += yawRate * dt * (this.sf >= -0.5 ? 1 : -1);

    /* بازترکیب سرعت */
    fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    right.set(fwd.z, 0, -fwd.x);
    this.vel.copy(fwd).multiplyScalar(this.sf).addScaledVector(right, this.sl);
    this.ppos.addScaledVector(this.vel, dt);

    /* ارتفاع جاده */
    var near2 = this.world.findNearest(this.ppos, this.segHint);
    this.segHint = near2.index;
    var roadY = near2.sample.pos.y || 0;
    var roadPitch = Math.atan2(near2.sample.tangent.y, Math.hypot(near2.sample.tangent.x, near2.sample.tangent.z));

    /* -------- برخورد با موانع ثابت -------- */
    var carR = 1.02;
    var colliders = this.world.colliders;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var dx = this.ppos.x - c.x, dz = this.ppos.z - c.z;
      var rr = c.r + carR;
      var d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 0.0001) {
        var d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
        var push = rr - d;
        this.ppos.x += nx * push; this.ppos.z += nz * push;
        var vn = this.vel.x * nx + this.vel.z * nz;
        if (vn < 0) {
          this.vel.x -= nx * vn * 1.42;
          this.vel.z -= nz * vn * 1.42;
          if (vn < -3.4) { this.audio.crash(clamp(-vn / 14, 0.25, 1)); this.shake = Math.max(this.shake, clamp(-vn / 22, 0.2, 0.7)); }
        }
        // بازمحاسبهٔ مؤلفه‌ها
        this.sf = this.vel.dot(fwd);
        this.sl = this.vel.dot(right);
      }
    }
    /* دیوار/گاردریل نامرئی بیرون پیست */
    var maxOff = halfW + 2.6;
    if (Math.abs(near2.lateral) > maxOff) {
      var over = Math.abs(near2.lateral) - maxOff;
      var sgn = Math.sign(near2.lateral);
      this.ppos.addScaledVector(near2.sample.side, -sgn * over);
      var vn2 = this.vel.dot(near2.sample.side) * sgn;
      if (vn2 > 0) {
        this.vel.addScaledVector(near2.sample.side, -sgn * vn2 * 1.35);
        if (vn2 > 3.2) { this.audio.crash(0.3); this.shake = Math.max(this.shake, 0.25); }
      }
      this.sf = this.vel.dot(fwd);
      this.sl = this.vel.dot(right);
    }

    /* -------- پیشرفت روی مسیر و دورها -------- */
    var newIdx = near2.index;
    var wrapForward = this.prevSegIdx > this.world.samples.length - 60 && newIdx < 60;
    var wrapBackward = this.prevSegIdx < 60 && newIdx > this.world.samples.length - 60;
    /* عبور از خط استارت در شروع مسابقه (گرید پشت خط است) دور محسوب نمی‌شود */
    var armLap = this.progress > this.world.length * 0.5;
    if (this.state === 'racing') {
      if (wrapForward && armLap) this._onLapComplete();
      else if (wrapBackward) { /* عبور به عقب — نادیده */ }
    }
    this.prevSegIdx = newIdx;
    this.progress += Math.max(0, this.sf * dt);

    /* -------- هوش مصنوعی -------- */
    for (var a = 0; a < this.ai.length; a++) this._updateAICar(this.ai[a], dt);

    /* برخورد بازیکن با AI */
    for (var b2 = 0; b2 < this.ai.length; b2++) {
      var car = this.ai[b2];
      var ddx = this.ppos.x - car.mesh.position.x, ddz = this.ppos.z - car.mesh.position.z;
      var dd2 = ddx * ddx + ddz * ddz;
      var minD = 2.18;
      if (dd2 < minD * minD && dd2 > 0.001) {
        var dd = Math.sqrt(dd2), nx = ddx / dd, nz = ddz / dd;
        var ov = minD - dd;
        this.ppos.x += nx * ov * 0.62; this.ppos.z += nz * ov * 0.62;
        car.aiDist -= ov * 0.4;
        car.speed *= 0.86;
        var vn3 = this.vel.x * nx + this.vel.z * nz;
        if (vn3 < 0) {
          this.vel.x -= nx * vn3 * 1.35;
          this.vel.z -= nz * vn3 * 1.35;
          if (vn3 < -3.0) { this.audio.crash(clamp(-vn3 / 16, 0.2, 0.85)); this.shake = Math.max(this.shake, 0.3); }
          this.sf = this.vel.dot(fwd);
          this.sl = this.vel.dot(right);
        }
      }
    }

    /* -------- اعمال تبدیل‌ها به مدل -------- */
    this.player.position.set(this.ppos.x, roadY, this.ppos.z);
    var rollTarget = clamp(-this.steerVis * speedAbs * 0.0021, -0.085, 0.085) + (handbrake && Math.sign(this.steerVis) !== 0 ? Math.sign(this.steerVis) * 0.03 : 0);
    this.player.rotation.y = this.yaw;
    this.player.rotation.x = -roadPitch;
    this.player.rotation.z = lerp(this.player.rotation.z, rollTarget, 1 - Math.exp(-7 * dt));
    /* چرخش و فرمان چرخ‌ها */
    var wSpin = (this.sf / 0.335) * dt;
    var ud = this.player.userData;
    for (var w = 0; w < ud.wheels.length; w++) ud.wheels[w].rotation.x += wSpin;
    for (var s2 = 0; s2 < ud.steers.length; s2++) ud.steers[s2].rotation.y = this.steerVis * 0.42;
    /* ترمز: نوار قرمز روشن‌تر */
    if (ud.tailMat) ud.tailMat.emissiveIntensity = (brake || handbrake) ? 3.1 : 1.5;
    /* فرمان داخل کابین */
    if (ud.steeringWheel) ud.steeringWheel.rotation.z = -this.steerVis * 1.05;

    /* -------- ردگیری بیشترین سرعت (برای چالش سرعت) -------- */
    var kmhNow = Math.abs(this.sf) * 3.6;
    if (kmhNow > this.maxKmh) this.maxKmh = kmhNow;

    /* -------- دریفت -------- */
    var drifting = Math.abs(this.sl) > 2.7 && Math.abs(this.sf) > 9;
    if (drifting && this.state === 'racing') {
      this.driftScore += Math.abs(this.sl) * Math.abs(this.sf) * dt * 0.55;
      this.driftHold = 1.6;
      this.audio.setScreech(clamp(Math.abs(this.sl) / 9, 0.25, 1));
    } else {
      this.driftHold = Math.max(0, this.driftHold - dt);
      this.audio.setScreech(this.offroad ? 0.10 : 0);
    }

    /* -------- رد لاستیک روی آسفالت -------- */
    var hardSlip = Math.abs(this.sl) > 3.1;
    var handBraking = handbrake && Math.abs(this.sf) > 7;
    if ((hardSlip || handBraking) && this.state === 'racing' && !this.offroad) {
      this.skidTimer -= dt;
      if (this.skidTimer <= 0) { this.skidTimer = 0.030; this._addSkidMark(near2); }
    }
    for (var sq = this.skidQuads.length - 1; sq >= 0; sq--) {
      var quad = this.skidQuads[sq];
      quad.age += dt;
      var life = Math.max(0, 1 - quad.age / 16);
      quad.mat.opacity = 0.5 * life;
      if (life <= 0) {
        this.scene.remove(quad.mesh); quad.mat.dispose();
        this.skidQuads.splice(sq, 1);
      }
    }

    /* -------- صدای موتور و باد -------- */
    var speedFrac = clamp(Math.abs(this.sf) / topMS, 0, 1);
    var gearFloat = speedFrac * 5.999;
    var gear = Math.min(6, Math.floor(gearFloat) + 1);
    var gearFrac = gearFloat - Math.floor(gearFloat);
    if (speedFrac < 0.02) gear = 1;
    var rpm = clamp(0.20 + gearFrac * 0.78 + throttle * 0.06, 0, 1.02);
    if (gear !== this._lastGear) { if (this._lastGear) this.audio.gearShift(); this._lastGear = gear; }
    this.audio.updateEngine(rpm, throttle, speedFrac, drifting);
    this.audio.setWind(speedFrac);

    /* -------- مسیر اشتباه -------- */
    var along = this.vel.x * tangent.x + this.vel.z * tangent.z;
    if (along < -3 && speedAbs > 6 && this.state === 'racing') {
      this.wrongWayT += dt;
      if (this.wrongWayT > 1.1) this._flashMsg('مسیر اشتباه! دور بزنید', 0.8);
    } else this.wrongWayT = 0;

    /* -------- پایان مسابقه برای AI (برای رتبه‌بندی) -------- */
    for (var f = 0; f < this.ai.length; f++) {
      var aCar = this.ai[f];
      if (!aCar.finished && aCar.lap > this.laps) { aCar.finished = true; aCar.finishTime = this.racingTime; }
    }
  };

  RaceSession.prototype._addSkidMark = function (near) {
    var MAXQ = 110;
    while (this.skidQuads.length >= MAXQ) { var oldQ = this.skidQuads.shift(); this.scene.remove(oldQ.mesh); oldQ.mat.dispose(); }
    if (!this._skidGeo) this._skidGeo = new THREE.PlaneGeometry(1.62, 0.85); // عرض دو چرخ عقب
    var ud = this.player.userData;
    var W = ud.bodyWidth || 1.9, L = ud.bodyLength || 4.4, wr = ud.wheelRadius || 0.33;
    var localZ = -(L/2 - wr - 0.42);
    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // مرکز محور عقب در فضای جهان
    var cx = this.ppos.x + localZ * sy;
    var cz = this.ppos.z + localZ * cy;
    var baseY = (near && near.sample && near.sample.pos.y != null ? near.sample.pos.y : (this.player.position.y || 0));
    var mat = new THREE.MeshBasicMaterial({ color: 0x080808, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    var mesh = new THREE.Mesh(this._skidGeo, mat);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = this.yaw;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, baseY + 0.016, cz);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.skidQuads.push({ mesh: mesh, mat: mat, age: 0 });
  };

  RaceSession.prototype._updateAICar = function (ai, dt) {
    /* رابربند: عقب‌افتاده سریع‌تر، پیش‌افتاده آهسته‌تر */
    var playerTotal = this.gridDist + this.progress;
    var myTotal = ai.aiDist;
    var diff = playerTotal - myTotal;
    var rubber = diff > 30 ? 1.10 : diff < -45 ? 0.90 : 1.0;
    var target = ai.topMS * rubber;
    /* کاهش سرعت در پیچ‌های تند */
    var ahead = this._trackPointAt(ai.aiDist + 14, { pos: new THREE.Vector3(), tangent: new THREE.Vector3(), side: new THREE.Vector3() });
    var here = this._trackPointAt(ai.aiDist, { pos: new THREE.Vector3(), tangent: new THREE.Vector3(), side: new THREE.Vector3() });
    var curvature = ahead.tangent.angleTo(here.tangent);
    var cornerTarget = clamp(1.35 / Math.max(curvature, 0.001) * 0.16, 0.42, 1) * ai.topMS * rubber;
    target = Math.min(target, cornerTarget);
    /* شتاب */
    if (ai.speed < target) ai.speed = Math.min(target, ai.speed + ai.accel * dt);
    else ai.speed = Math.max(target, ai.speed - 14 * dt);
    /* نویز حرکت طبیعی */
    ai.lanePhase += dt * 0.7;
    var lane = ai.laneLat + Math.sin(ai.aiDist * 0.012 + ai.lanePhase) * 0.7;
    var totalLen = this.world.length;
    var prevDist = ai.aiDist;
    ai.aiDist += ai.speed * dt;
    /* دور شمار AI */
    if (Math.floor(ai.aiDist / totalLen) > Math.floor(prevDist / totalLen)) ai.lap++;
    /* موقعیت رندر */
    var pt = this._trackPointAt(ai.aiDist, here);
    ai.hitCooldown = Math.max(0, ai.hitCooldown - dt);
    var px = pt.pos.x + pt.side.x * lane, pz = pt.pos.z + pt.side.z * lane;
    var py = pt.pos.y || 0;
    ai.mesh.position.set(px, py, pz);
    ai.mesh.rotation.y = Math.atan2(pt.tangent.x, pt.tangent.z);
    ai.mesh.rotation.x = -Math.atan2(pt.tangent.y, Math.hypot(pt.tangent.x, pt.tangent.z));
    ai.mesh.rotation.z = clamp(Math.sin(ai.aiDist * 0.01 + ai.lanePhase) * -0.02, -0.05, 0.05);
    /* چرخ‌ها */
    var ud = ai.mesh.userData;
    var wSpin = (ai.speed / 0.335) * dt;
    for (var i = 0; i < ud.wheels.length; i++) ud.wheels[i].rotation.x += wSpin;
    var turnSign = Math.sign(here.tangent.z * ahead.tangent.x - here.tangent.x * ahead.tangent.z) || 0;
    for (var s = 0; s < ud.steers.length; s++) ud.steers[s].rotation.y = clamp(curvature * turnSign, -0.4, 0.4) * 0.8;
  };

  /* ============================================================
     چالش‌ها: محاسبهٔ پیشرفت هدف
     ============================================================ */
  RaceSession.prototype._challengeProgress = function (place) {
    var ch = this.challenge;
    if (!ch) return 0;
    var v = 0;
    if (ch.type === 'position') {
      /* هرچه رتبه بهتر، پیشرفت بیشتر */
      v = Math.max(0, 8 - (place || 8)) / 7;
      if ((place || 8) <= ch.target) v = 1;
    } else if (ch.type === 'drift') {
      v = this.driftScore / ch.target;
    } else if (ch.type === 'lapTime') {
      /* تا وقتی دوری زده نشده، بر اساس بهترین دور */
      if (this.bestLap < Infinity) v = this.bestLap <= ch.target ? 1 : clamp(ch.target / this.bestLap, 0, 0.99);
      else v = 0;
    } else if (ch.type === 'topSpeed') {
      v = this.maxKmh / ch.target;
    } else if (ch.type === 'time') {
      if (this.finished && this.racingTime) v = this.racingTime <= ch.target ? 1 : clamp(ch.target / this.racingTime, 0, 0.99);
      else v = this.racingTime > 0 ? clamp((this.lap - 1 + clamp(this.progress / this.world.length, 0, 1)) / this.laps, 0, 0.98) : 0;
    }
    return clamp(v, 0, 1);
  };

  RaceSession.prototype._challengeText = function () {
    var ch = this.challenge;
    if (!ch) return '';
    switch (ch.type) {
      case 'position': return 'رتبهٔ ' + ch.target + ' یا بهتر';
      case 'drift':    return ch.target.toLocaleString('fa-IR') + ' امتیاز دریفت';
      case 'lapTime':  return 'دور زیر ' + formatTime(ch.target);
      case 'topSpeed': return 'سرعت ' + ch.target + ' km/h';
      case 'time':     return 'پایان زیر ' + formatTime(ch.target);
      default: return '—';
    }
  };

  RaceSession.prototype._challengeStatusText = function (place, frac) {
    var ch = this.challenge;
    if (!ch) return '';
    if (ch.type === 'drift')   return 'دریفت فعلی: ' + Math.floor(this.driftScore).toLocaleString('fa-IR');
    if (ch.type === 'topSpeed')return 'بیشترین سرعت: ' + Math.round(this.maxKmh) + ' km/h';
    if (ch.type === 'lapTime') return this.bestLap < Infinity ? 'بهترین دور: ' + formatTime(this.bestLap) : 'هنوز دوری کامل نشده';
    if (ch.type === 'position')return 'جایگاه فعلی: ' + (place || 1);
    if (ch.type === 'time')    return 'زمان: ' + formatTime(this.racingTime);
    return '';
  };

  /* آیا هدف چالش برآورده شده؟ (در پایان مسابقه) */
  RaceSession.prototype._challengePassed = function (place) {
    var ch = this.challenge;
    if (!ch) return false;
    if (ch.type === 'position') return place <= ch.target;
    if (ch.type === 'drift')    return this.driftScore >= ch.target;
    if (ch.type === 'lapTime')  return this.bestLap < Infinity && this.bestLap <= ch.target;
    if (ch.type === 'topSpeed') return this.maxKmh >= ch.target;
    if (ch.type === 'time')     return this.racingTime <= ch.target;
    return false;
  };

  RaceSession.prototype._onLapComplete = function () {
    var lapTime = this.lapStart === 0 ? this.racingTime : this.racingTime - this.lapStart;
    this.lapTimes.push(lapTime);
    if (lapTime < this.bestLap) this.bestLap = lapTime;
    this.lapStart = this.racingTime;
    if (this.lap >= this.laps) {
      this.finished = true;
      this._setState('finished');
      this.audio.win();
      var self = this;
      setTimeout(function () { if (!self.disposed) self._sendResult(); }, 1600);
    } else {
      this.lap++;
      this._flashMsg(this.lap === this.laps ? 'دور آخر!' : 'دور ' + this.lap, 1.4);
      this.audio.coin();
    }
  };

  RaceSession.prototype._sendResult = function () {
    if (this.resultSent) return;
    this.resultSent = true;
    /* رتبه‌بندی بر اساس فاصلهٔ کل */
    var pTotal = this.gridDist + this.progress;
    var ahead = 0;
    for (var i = 0; i < this.ai.length; i++) if (this.ai[i].aiDist > pTotal + 1) ahead++;
    var place = ahead + 1;
    var driftBonus = Math.min(800, Math.floor(this.driftScore / 150));
    var scale = (this.track.rewardBase || 2500) / 2500;
    var placeReward = Math.round((Data.PLACE_REWARDS[place - 1] || 300) * this.difficulty.reward * scale / 10) * 10;
    var coins = placeReward + driftBonus;
    /* ---------- چالش ---------- */
    var chPassed = this._challengePassed(place);
    var chFrac = this._challengeProgress(place);
    var challenge = null;
    if (this.challenge) {
      var bonus = chPassed ? Math.round(this.challenge.reward * (Data.CHALLENGE_BONUS || 1.8)) : 0;
      coins += bonus;
      challenge = {
        id: this.challenge.id,
        name: this.challenge.name,
        icon: this.challenge.icon,
        type: this.challenge.type,
        target: this.challenge.target,
        goalText: this._challengeText(),
        passed: chPassed,
        progress: chFrac,
        bonus: bonus,
        statusText: this._challengeStatusText(place, chFrac),
        value: this.challenge.type === 'topSpeed' ? Math.round(this.maxKmh) : null
      };
    }
    this.opts.callbacks.onFinish({
      place: place,
      coins: coins,
      challenge: challenge,
      topSpeed: Math.round(this.maxKmh),
      placeReward: placeReward,
      driftBonus: driftBonus,
      driftScore: Math.floor(this.driftScore),
      bestLap: this.bestLap === Infinity ? null : this.bestLap,
      totalTime: this.racingTime,
      trackId: this.track.id,
      tod: this.tod,
      carId: this.carId,
      win: place === 1
    });
  };

  /* ---------- دوربین ---------- */
  RaceSession.prototype._updateCamera = function (dt) {
    var cam = this.camera;
    var ud = this.player.userData;
    if (this.camMode === 'cockpit') {
      if (ud.interior) ud.interior.visible = true;
      var eyeH = (ud.cameraY || 0.92);
      var fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      var base = this.player.position;
      var eye = base.clone().addScaledVector(fwd, 0.18);
      eye.y = base.y + eyeH;
      cam.position.lerp(eye, 1 - Math.exp(-14 * dt));
      var look = base.clone().addScaledVector(fwd, 24);
      look.y = base.y + eyeH - 0.10;
      cam.lookAt(look);
      cam.fov = lerp(cam.fov, 74, 0.1);
      cam.updateProjectionMatrix();
      return;
    }
    if (ud.interior) ud.interior.visible = false;
    var speed = Math.abs(this.sf);
    var speedN = clamp(speed / (this.stats.topKmh / 3.6), 0, 1);
    var fwd2 = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    var dist = 6.6 + speedN * 2.6;
    var height = 3.15 + speedN * 0.5;
    var ideal = this.ppos.clone().addScaledVector(fwd2, -dist);
    ideal.y = (this.player.position.y || 0) + height;
    // کمی جانبی با دریفت برای سینمایی‌تر شدن
    var right = new THREE.Vector3(fwd2.z, 0, -fwd2.x);
    ideal.addScaledVector(right, clamp(-this.sl * 0.06, -1.3, 1.3));
    var lerpK = 1 - Math.exp(-4.6 * dt);
    cam.position.lerp(ideal, lerpK);
    /* جلوگیری از فرورفتن دوربین در زمین */
    var groundY = (this.player.position.y || 0);
    if (cam.position.y < groundY + 1.15) cam.position.y = groundY + 1.15;
    var look2 = this.ppos.clone().addScaledVector(fwd2, 6.2);
    look2.y = (this.player.position.y || 0) + 1.28;
    /* لرزش */
    if (this.shake > 0.01) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake *= Math.exp(-3.2 * dt);
    } else this.shake = 0;
    cam.lookAt(look2);
    var targetFov = 66 + speedN * 13 + (this.driftHold > 0 ? 2.5 : 0);
    cam.fov = lerp(cam.fov, targetFov, 1 - Math.exp(-6 * dt));
    cam.updateProjectionMatrix();
  };

  /* ---------- خورشید همراه ماشین (برای سایهٔ درست) ---------- */
  RaceSession.prototype._updateSun = function () {
    var sun = this.world.sun;
    if (!sun) return;
    var p = this.player.position;
    var dir = sun.position.clone().sub(sun.target.position).normalize();
    sun.target.position.set(p.x, 0, p.z);
    sun.position.set(p.x + dir.x * 150, dir.y * 150 + p.y * 0, p.z + dir.z * 150);
    sun.target.updateMatrixWorld();
  };

  /* ---------- HUD ---------- */
  RaceSession.prototype._updateHUD = function (dt) {
    this.hudTimer -= dt;
    if (this.hudTimer > 0) return;
    this.hudTimer = 0.05;
    var speedKmh = Math.round(Math.abs(this.sf) * 3.6);
    var el = document.getElementById('hud-speed');
    if (el) el.textContent = String(speedKmh);
    var topMS = this.stats.topKmh / 3.6;
    var speedFrac = clamp(Math.abs(this.sf) / topMS, 0, 1);
    var gearFloat = speedFrac * 5.999;
    var gear = speedFrac < 0.02 ? 1 : Math.min(6, Math.floor(gearFloat) + 1);
    var gearEl = document.getElementById('hud-gear');
    if (gearEl) gearEl.textContent = String(gear);
    var gearFrac = speedFrac < 0.02 ? 0.12 : gearFloat - Math.floor(gearFloat);
    var rpmFill = document.getElementById('hud-rpm-fill');
    if (rpmFill) {
      rpmFill.style.width = Math.round(clamp(0.14 + gearFrac * 0.86, 0, 1) * 100) + '%';
      rpmFill.classList.toggle('redline', gearFrac > 0.82);
    }
    var lapEl = document.getElementById('hud-lap');
    if (lapEl) lapEl.textContent = 'دور ' + Math.min(this.lap, this.laps) + '/' + this.laps;
    var timeEl = document.getElementById('hud-time');
    if (timeEl) timeEl.textContent = formatTime(this.racingTime);
    var bestEl = document.getElementById('hud-best');
    if (bestEl) bestEl.textContent = (this.bestLap === Infinity) ? '--:--.--' : formatTime(this.bestLap);
    /* جایگاه */
    var pTotal = this.gridDist + this.progress;
    var place = 1;
    for (var i = 0; i < this.ai.length; i++) if (this.ai[i].aiDist > pTotal) place++;
    var posEl = document.getElementById('hud-pos');
    if (posEl) posEl.textContent = String(place);
    /* دریفت */
    var driftEl = document.getElementById('hud-drift');
    if (driftEl) {
      if (this.driftHold > 0 && this.driftScore > 40) {
        driftEl.textContent = 'DRIFT +' + Math.floor(this.driftScore);
        driftEl.classList.add('visible');
      } else {
        driftEl.classList.remove('visible');
        if (this.driftHold <= 0) this.driftScore = 0;
      }
    }
    this._drawMinimap();

    /* ---------- کارت هدف چالش ---------- */
    if (this.challenge) {
      var ch = this.challenge;
      var cName = document.getElementById('hc-name');
      var cGoal = document.getElementById('hc-goal');
      var cIcon = document.getElementById('hc-icon');
      var cBar = document.getElementById('hc-bar-fill');
      var cStat = document.getElementById('hc-status');
      var card = document.getElementById('hud-challenge');
      if (cIcon) cIcon.textContent = ch.icon;
      if (cName) cName.textContent = ch.name;
      if (cGoal) cGoal.textContent = this._challengeText();
      var frac = this._challengeProgress(place);
      if (cBar) cBar.style.width = Math.round(frac * 100) + '%';
      if (cStat) cStat.textContent = this._challengeStatusText(place, frac);
      if (card) {
        card.classList.toggle('done', frac >= 1);
        card.classList.toggle('failing', frac < 0.34 && this.racingTime > 4);
      }
      /* اعلام زندهٔ تکمیل هدف (در حین مسابقه) */
      if (this.state === 'racing' && !this.challengeLiveDone &&
          (ch.type === 'drift' || ch.type === 'topSpeed' || ch.type === 'lapTime') && frac >= 1) {
        this.challengeLiveDone = true;
        this._flashMsg('🎯 هدف چالش محقق شد!', 1.7);
        this.audio.win();
      }
    }
  };

  RaceSession.prototype._drawMinimap = function () {
    var canvas = document.getElementById('minimap');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    var samples = this.world.samples;
    var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (var i = 0; i < samples.length; i += 4) {
      var p = samples[i].pos;
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
    var scale = Math.min((W - 22) / (maxX - minX), (H - 22) / (maxZ - minZ));
    var ox = (W - (maxX - minX) * scale) / 2, oy = (H - (maxZ - minZ) * scale) / 2;
    var px = function (x, z) { return [ox + (x - minX) * scale, oy + (z - minZ) * scale]; };
    /* مسیر */
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var j = 0; j <= samples.length; j += 3) {
      var s = samples[j % samples.length];
      var pt = px(s.pos.x, s.pos.z);
      if (j === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]);
    }
    ctx.stroke();
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    /* خط شروع */
    var s0 = px(samples[0].pos.x, samples[0].pos.z);
    ctx.fillStyle = '#ffe45e';
    ctx.fillRect(s0[0] - 3.5, s0[1] - 3.5, 7, 7);
    /* حریفان */
    for (var a = 0; a < this.ai.length; a++) {
      var mp = px(this.ai[a].mesh.position.x, this.ai[a].mesh.position.z);
      ctx.fillStyle = '#ff5d5d';
      ctx.beginPath(); ctx.arc(mp[0], mp[1], 2.6, 0, Math.PI * 2); ctx.fill();
    }
    /* بازیکن */
    var pp = px(this.ppos.x, this.ppos.z);
    ctx.fillStyle = '#ffe45e';
    ctx.beginPath(); ctx.arc(pp[0], pp[1], 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };

  /* ---------- تخلیه ---------- */
  RaceSession.prototype.dispose = function () {
    this.disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup', this._keyUp);
    clearTimeout(this._msgTimer);
    this.audio.setScreech(0);
    this.audio.setWind(0);
    if (this.scene) World.disposeScene(this.scene);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer = null;
    this.scene = null;
  };

  root.NitroRace = { RaceSession: RaceSession, formatTime: formatTime };
})(typeof window !== 'undefined' ? window : globalThis);
