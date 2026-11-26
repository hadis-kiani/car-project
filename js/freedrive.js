/* ============================================================
   NIRO CITY — Free Drive: رانندگی آزاد بدون مسابقه
   W/S گاز و ترمز · A/D فرمان · Space ترمز دستی · C دوربین
   R بازنشانی · L چراغ · Esc توقف
   ============================================================ */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  var Data = root.NitroData;
  var World = root.NitroWorld;
  var CarFactory = root.NitroCarFactory;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function FreeDriveSession(opts) {
    this.opts = opts;
    this.save = opts.save;
    this.audio = opts.audio;
    var track = Data.TRACKS.find(function (t) { return t.id === opts.trackId; }) || Data.TRACKS[0];
    this.track = track;
    var weather = Data.WEATHERS.find(function (w) { return w.id === opts.weather; }) || Data.WEATHERS[0];
    this.weather = weather;
    this.tod = weather.tod;
    this.carId = opts.carId || this.save.selectedId;
    this.disposed = false;
    this.keys = {};
    this.touch = { left: false, right: false, gas: false, brake: false, drift: false };
    this.camMode = this.save.settings.camera === 'cockpit' ? 'cockpit' : 'chase';
    this.camModes = ['chase', 'hood', 'cockpit'];
    this.paused = false;
    this.sf = 0; this.sl = 0;
    this.steerVis = 0;
    this.shake = 0;
    this.hudTimer = 0;
    this.headlightsOn = this.save.settings.headlights !== false || this.tod === 'night' || this.tod === 'rain';
    this._initScene();
    this._initPlayer();
    this._bindInput();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
    if (this.audio && this.audio.setRain) this.audio.setRain(this.tod === 'rain' ? 1 : 0);
    if (this.audio && this.save.settings.music !== false && this.audio.startMusic) this.audio.startMusic();
  }

  FreeDriveSession.prototype._initScene = function () {
    var container = this.opts.container;
    container.innerHTML = '';
    var scene = new THREE.Scene();
    this.scene = scene;
    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    var quality = this.save.settings.quality || 'medium';
    var pr = quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pr));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.world ? 1.05 : 1.05;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(66, container.clientWidth / container.clientHeight, 0.12, 2200);
    this.camera.position.set(0, 4, 10);
    this.world = World.buildRaceWorld(scene, renderer, this.track, this.tod);
    renderer.toneMappingExposure = this.world.tod.exposure || 1.05;
    this._resizeHandler = this._onResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);
  };

  FreeDriveSession.prototype._onResize = function () {
    var c = this.opts.container;
    if (!c || !this.renderer) return;
    var w = c.clientWidth, h = c.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  FreeDriveSession.prototype._initPlayer = function () {
    var car = Data.getCar(this.carId);
    var save = this.save;
    this.carDef = car;
    this.stats = Data.effectiveStats(car, save);
    this.player = CarFactory.buildCar({
      body: car.body, paint: Data.carPaint(save, car.id), finish: Data.carFinish(save, car.id),
      rim: Data.carRim(save, car.id),
      rimColorHex: (Data.RIM_COLORS.find(function (r) { return r.id === Data.carRimColor(save, car.id); }) || {}).hex || '#d7d9de',
      tire: Data.carTire(save, car.id),
      glow: (Data.GLOWS.find(function (g) { return g.id === Data.carGlow(save, car.id) && g.hex; }) || {}).hex || null
    });
    CarFactory.addHeadlightBeams(this.player);
    CarFactory.setHeadlights(this.player, this.headlightsOn);
    var grid = this.world.startGrid[0];
    this.player.position.copy(grid.pos);
    this.player.rotation.order = 'YXZ';
    this.player.rotation.y = grid.yaw;
    this.scene.add(this.player);
    this.ppos = grid.pos.clone();
    this.startPos = grid.pos.clone();
    this.startYaw = grid.yaw;
    this.yaw = grid.yaw;
    this.vel = new THREE.Vector3();
    this.segHint = grid.index;
    this.offroad = false;
    this.skidQuads = [];
    this.skidTimer = 0;
    this._skidGeo = null;
    this.driftScore = 0;
    this.driftHold = 0;
  };

  FreeDriveSession.prototype.resetCar = function () {
    this.ppos.copy(this.startPos);
    this.yaw = this.startYaw;
    this.sf = 0; this.sl = 0;
    this.vel.set(0, 0, 0);
    this._flashMsg('بازنشانی ماشین', 0.9);
  };

  FreeDriveSession.prototype.toggleCamera = function () {
    var i = this.camModes.indexOf(this.camMode);
    this.camMode = this.camModes[(i + 1) % this.camModes.length];
    var names = { chase: 'دوربین تعقیب', hood: 'دوربین کاپوت', cockpit: 'دوربین کابین' };
    this._flashMsg(names[this.camMode], 0.9);
  };

  FreeDriveSession.prototype.toggleHeadlights = function () {
    this.headlightsOn = !this.headlightsOn;
    CarFactory.setHeadlights(this.player, this.headlightsOn);
    this.save.settings.headlights = this.headlightsOn;
    Data.saveSave(this.save);
    this._flashMsg(this.headlightsOn ? 'چراغ‌ها روشن 💡' : 'چراغ‌ها خاموش', 0.9);
  };

  FreeDriveSession.prototype._bindInput = function () {
    var self = this;
    this._keyDown = function (e) {
      var k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
      self.keys[k] = true;
      if (k === 'c') self.toggleCamera();
      if (k === 'r') self.resetCar();
      if (k === 'l') self.toggleHeadlights();
      if (k === 'escape') self.togglePause();
      if (k === 'm') { self.audio.setMuted(!self.audio.muted); self._syncMuteButton(); }
    };
    this._keyUp = function (e) { self.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', this._keyDown, { passive: false });
    window.addEventListener('keyup', this._keyUp);
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
    bindHold('touch-left', 'left'); bindHold('touch-right', 'right');
    bindHold('touch-gas', 'gas'); bindHold('touch-brake', 'brake'); bindHold('touch-drift', 'drift');
    var q = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    q('btn-pause', function () { self.togglePause(); });
    q('btn-cam', function () { self.toggleCamera(); });
    q('btn-mute', function () { self.audio.setMuted(!self.audio.muted); self._syncMuteButton(); });
    q('btn-resume', function () { self.togglePause(); });
    q('btn-restart', function () { self.resetCar(); self.togglePause(); });
    q('btn-quit', function () { var cb = self.opts.callbacks.onQuit; self.dispose(); if (cb) cb(); });
    this._syncMuteButton();
  };

  FreeDriveSession.prototype._syncMuteButton = function () {
    var el = document.getElementById('btn-mute');
    if (el) el.textContent = this.audio.muted ? '🔇' : '🔊';
  };

  FreeDriveSession.prototype.togglePause = function () {
    this.paused = !this.paused;
    var overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.toggle('visible', this.paused);
    if (this.paused) { this.audio.setScreech(0); this.audio.setWind(0); }
  };

  FreeDriveSession.prototype._flashMsg = function (text, seconds) {
    var el = document.getElementById('hud-msg');
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    var self = this;
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(function () { el.classList.remove('visible'); }, (seconds || 1.4) * 1000);
  };

  FreeDriveSession.prototype._tick = function (t) {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._tick);
    var last = this._clockLast || t;
    var dt = clamp((t - last) / 1000, 0, 0.05);
    this._clockLast = t;
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }
    this._update(dt);
    this._updateCamera(dt);
    this._updateHUD(dt);
    this._updateSun();
    if (this.world.rain && World.updateRain) World.updateRain(dt, this.ppos);
    this.renderer.render(this.scene, this.camera);
  };

  FreeDriveSession.prototype._update = function (dt) {
    var k = this.keys, tc = this.touch;
    var throttle = (k['arrowup'] || k['w'] || tc.gas) ? 1 : 0;
    var brake = (k['arrowdown'] || k['s'] || tc.brake) ? 1 : 0;
    var steerIn = 0;
    if (k['arrowleft'] || k['a'] || tc.left) steerIn += 1;
    if (k['arrowright'] || k['d'] || tc.right) steerIn -= 1;
    var handbrake = !!(k[' '] || tc.drift);

    var st = this.stats;
    var fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    var right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    var near = this.world.findNearest(this.ppos, this.segHint);
    this.segHint = near.index;
    var tangent = near.sample.tangent;
    var halfW = this.world.halfWidth;
    this.offroad = Math.abs(near.lateral) > halfW - 0.35;
    var wetGrip = this.tod === 'rain' ? 0.72 : 1.0;

    var topMS = st.topKmh / 3.6;
    if (throttle > 0) this.sf += st.accel * (1 - this.sf / topMS) * throttle * dt;
    if (brake) {
      if (this.sf > 0.7) { this.sf -= st.brake * dt; if (this.audio.setBrake) this.audio.setBrake(clamp(Math.abs(this.sf)/30,0,0.5)); }
      else this.sf = Math.max(this.sf - 5.6 * dt, -9);
    } else if (this.audio.setBrake) this.audio.setBrake(0);
    var fwdTan = tangent.x * fwd.x + tangent.z * fwd.z;
    this.sf -= 9.81 * tangent.y * (fwdTan >= 0 ? 1 : -1) * 0.85 * dt;
    var rolling = 0.42 + (this.offroad ? 3.4 : 0);
    if (Math.abs(this.sf) > 0.05) this.sf -= Math.sign(this.sf) * Math.min(Math.abs(this.sf), rolling * dt);
    this.sf -= Math.sign(this.sf) * 0.00035 * this.sf * this.sf * dt;
    if (handbrake) this.sf -= Math.sign(this.sf) * Math.min(Math.abs(this.sf), 2.1 * dt);

    var grip = st.grip * wetGrip * (handbrake ? 0.32 : 1.0);
    this.sl *= Math.exp(-grip * dt);
    this.steerVis = lerp(this.steerVis, steerIn, 1 - Math.exp(-9 * dt));
    var speedAbs = Math.abs(this.sf);
    var steerFactor = clamp(1.32 - speedAbs / 58, 0.33, 1.32) * clamp(speedAbs / 5 + 0.28, 0, 1);
    var yawGain = st.yawGain * (handbrake ? 1.85 : 1.0) * (this.tod === 'rain' ? 1.08 : 1.0);
    this.yaw += this.steerVis * yawGain * 1.62 * steerFactor * dt * (this.sf >= -0.5 ? 1 : -1);

    fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    right.set(fwd.z, 0, -fwd.x);
    this.vel.copy(fwd).multiplyScalar(this.sf).addScaledVector(right, this.sl);
    this.ppos.addScaledVector(this.vel, dt);

    var near2 = this.world.findNearest(this.ppos, this.segHint);
    this.segHint = near2.index;
    var roadY = near2.sample.pos.y || 0;
    var roadPitch = Math.atan2(near2.sample.tangent.y, Math.hypot(near2.sample.tangent.x, near2.sample.tangent.z));

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
          this.vel.x -= nx * vn * 1.42; this.vel.z -= nz * vn * 1.42;
          if (vn < -3.4) { this.audio.crash(clamp(-vn / 14, 0.25, 1)); this.shake = Math.max(this.shake, clamp(-vn / 22, 0.2, 0.7)); }
        }
        this.sf = this.vel.dot(fwd); this.sl = this.vel.dot(right);
      }
    }
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
      this.sf = this.vel.dot(fwd); this.sl = this.vel.dot(right);
    }

    this.player.position.set(this.ppos.x, roadY, this.ppos.z);
    var rollTarget = clamp(-this.steerVis * speedAbs * 0.0021, -0.085, 0.085);
    this.player.rotation.y = this.yaw;
    this.player.rotation.x = -roadPitch;
    this.player.rotation.z = lerp(this.player.rotation.z, rollTarget, 1 - Math.exp(-7 * dt));
    var wSpin = (this.sf / 0.335) * dt;
    var ud = this.player.userData;
    for (var w = 0; w < ud.wheels.length; w++) ud.wheels[w].rotation.x += wSpin;
    for (var s2 = 0; s2 < ud.steers.length; s2++) ud.steers[s2].rotation.y = this.steerVis * 0.42;
    if (ud.tailMat) ud.tailMat.emissiveIntensity = (brake || handbrake) ? 3.1 : 1.5;
    if (ud.steeringWheel) ud.steeringWheel.rotation.z = -this.steerVis * 1.05;

    var drifting = Math.abs(this.sl) > 2.7 && Math.abs(this.sf) > 9;
    if (drifting) {
      this.driftScore += Math.abs(this.sl) * Math.abs(this.sf) * dt * 0.55;
      this.driftHold = 1.6;
      this.audio.setScreech(clamp(Math.abs(this.sl) / 9, 0.25, 1));
    } else {
      this.driftHold = Math.max(0, this.driftHold - dt);
      this.audio.setScreech(this.offroad ? 0.10 : 0);
    }
    var hardSlip = Math.abs(this.sl) > 3.1;
    var handBraking = handbrake && Math.abs(this.sf) > 7;
    if ((hardSlip || handBraking) && !this.offroad) {
      this.skidTimer -= dt;
      if (this.skidTimer <= 0) { this.skidTimer = 0.030; this._addSkidMark(near2); }
    }
    for (var sq = this.skidQuads.length - 1; sq >= 0; sq--) {
      var quad = this.skidQuads[sq];
      quad.age += dt;
      var life = Math.max(0, 1 - quad.age / 16);
      quad.mat.opacity = 0.5 * life;
      if (life <= 0) { this.scene.remove(quad.mesh); quad.mat.dispose(); this.skidQuads.splice(sq, 1); }
    }
    var speedFrac = clamp(Math.abs(this.sf) / topMS, 0, 1);
    var gearFloat = speedFrac * 5.999;
    var gear = Math.min(6, Math.floor(gearFloat) + 1);
    var gearFrac = gearFloat - Math.floor(gearFloat);
    if (speedFrac < 0.02) gear = 1;
    var rpm = clamp(0.20 + gearFrac * 0.78 + throttle * 0.06, 0, 1.02);
    if (gear !== this._lastGear) { if (this._lastGear) this.audio.gearShift(); this._lastGear = gear; }
    this.audio.updateEngine(rpm, throttle, speedFrac, drifting);
    this.audio.setWind(speedFrac);
  };

  FreeDriveSession.prototype._addSkidMark = function (near) {
    var MAXQ = 110;
    while (this.skidQuads.length >= MAXQ) { var oldQ = this.skidQuads.shift(); this.scene.remove(oldQ.mesh); oldQ.mat.dispose(); }
    if (!this._skidGeo) this._skidGeo = new THREE.PlaneGeometry(1.62, 0.85);
    var ud = this.player.userData;
    var L = ud.bodyLength || 4.4, wr = ud.wheelRadius || 0.33;
    var localZ = -(L/2 - wr - 0.42);
    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
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

  FreeDriveSession.prototype._updateCamera = function (dt) {
    var cam = this.camera;
    var ud = this.player.userData;
    var fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    var base = this.player.position;
    if (this.camMode === 'cockpit') {
      if (ud.interior) ud.interior.visible = true;
      var eyeH = (ud.cameraY || 0.92);
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
    if (this.camMode === 'hood') {
      if (ud.interior) ud.interior.visible = false;
      var eye2 = base.clone().addScaledVector(fwd, 1.55);
      eye2.y = base.y + 1.02;
      cam.position.lerp(eye2, 1 - Math.exp(-16 * dt));
      var look2 = base.clone().addScaledVector(fwd, 30);
      look2.y = base.y + 0.85;
      cam.lookAt(look2);
      cam.fov = lerp(cam.fov, 70, 0.1);
      cam.updateProjectionMatrix();
      return;
    }
    if (ud.interior) ud.interior.visible = false;
    var speed = Math.abs(this.sf);
    var speedN = clamp(speed / (this.stats.topKmh / 3.6), 0, 1);
    var dist = 6.6 + speedN * 2.6;
    var height = 3.15 + speedN * 0.5;
    var ideal = this.ppos.clone().addScaledVector(fwd, -dist);
    ideal.y = (this.player.position.y || 0) + height;
    var right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    ideal.addScaledVector(right, clamp(-this.sl * 0.06, -1.3, 1.3));
    cam.position.lerp(ideal, 1 - Math.exp(-4.6 * dt));
    var groundY = (this.player.position.y || 0);
    if (cam.position.y < groundY + 1.15) cam.position.y = groundY + 1.15;
    var look3 = this.ppos.clone().addScaledVector(fwd, 6.2);
    look3.y = (this.player.position.y || 0) + 1.28;
    if (this.shake > 0.01) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake *= Math.exp(-3.2 * dt);
    } else this.shake = 0;
    cam.lookAt(look3);
    cam.fov = lerp(cam.fov, 66 + speedN * 13 + (this.driftHold > 0 ? 2.5 : 0), 1 - Math.exp(-6 * dt));
    cam.updateProjectionMatrix();
  };

  FreeDriveSession.prototype._updateSun = function () {
    var sun = this.world.sun;
    if (!sun) return;
    var p = this.player.position;
    var dir = sun.position.clone().sub(sun.target.position).normalize();
    sun.target.position.set(p.x, 0, p.z);
    sun.position.set(p.x + dir.x * 150, dir.y * 150, p.z + dir.z * 150);
    sun.target.updateMatrixWorld();
  };

  FreeDriveSession.prototype._updateHUD = function (dt) {
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
    if (lapEl) lapEl.textContent = 'رانندگی آزاد';
    var timeEl = document.getElementById('hud-time');
    if (timeEl) timeEl.textContent = this.weather.icon + ' ' + this.weather.name;
    var bestEl = document.getElementById('hud-best');
    if (bestEl) bestEl.textContent = this.track.name;
    var posEl = document.getElementById('hud-pos');
    if (posEl) posEl.textContent = '∞';
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
  };

  FreeDriveSession.prototype._drawMinimap = function () {
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
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 7; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var j = 0; j <= samples.length; j += 3) {
      var s = samples[j % samples.length];
      var pt = px(s.pos.x, s.pos.z);
      if (j === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]);
    }
    ctx.stroke();
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2.2; ctx.stroke();
    var pp = px(this.ppos.x, this.ppos.z);
    ctx.fillStyle = '#ffe45e';
    ctx.beginPath(); ctx.arc(pp[0], pp[1], 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; ctx.stroke();
  };

  FreeDriveSession.prototype.dispose = function () {
    this.disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup', this._keyUp);
    clearTimeout(this._msgTimer);
    this.audio.setScreech(0); this.audio.setWind(0);
    if (this.audio.setRain) this.audio.setRain(0);
    if (this.audio.stopMusic) this.audio.stopMusic();
    if (this.scene) World.disposeScene(this.scene);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer = null; this.scene = null;
  };

  root.NitroFreeDrive = { FreeDriveSession: FreeDriveSession };
})(typeof window !== 'undefined' ? window : globalThis);
