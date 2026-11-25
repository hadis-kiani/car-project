/* ============================================================
   NIRO CITY — UI: منوها، گاراژ، انتخاب مسیر، نتایج، ذخیره‌سازی
   ============================================================ */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  var Data = root.NitroData;
  var Race = root.NitroRace;
  var CarFactory = root.NitroCarFactory;
  var AudioMan = root.NitroAudio;

  function $(id) { return document.getElementById(id); }
  function faNum(n) { return Number(Math.round(n)).toLocaleString('fa-IR'); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var SCREENS = ['screen-menu', 'screen-setup', 'screen-garage', 'screen-results', 'screen-hud'];
  var ORDERED_CARS = Data.CARS.slice().sort(function (a, b) { return a.price - b.price; });

  function App() {
    this.audio = new AudioMan.AudioEngine();
    this.save = Data.loadSave();
    this.sel = { trackId: Data.TRACKS[0].id, tod: this.save.settings.tod || 'night', laps: 2, difficulty: this.save.settings.difficulty || 'pro' };
    this.currentRace = null;
    this.previewCarId = this.save.selectedId;
    this.garageReady = false;
    this._previewRAF = null;
    this._thumbs = {};
    this._previewSpin = 0;
    this._lastPreviewTime = 0;
    this._applyAudioMute();
    this._bindMenu();
    this._bindSetup();
    this._bindGarage();
    this._bindResults();
    this._bindSettings();
    this._syncCoins();
    this._syncRecordUI();
    this._updateSetupBar();
    this._renderTrackBests();
    /* اولین لمس کاربر = فعال‌سازی صدا + پد منو */
    var self = this;
    var firstGesture = function () {
      self.audio.init();
      self.audio.resume();
      self.audio.setMuted(self.save.settings.muted);
      if (self._currentScreen() === 'screen-menu') self.audio.startMenuPad();
      window.removeEventListener('pointerdown', firstGesture);
    };
    window.addEventListener('pointerdown', firstGesture);
  }

  /* ============ عمومی ============ */
  App.prototype._currentScreen = function () {
    var vis = document.querySelector('.screen.visible');
    return vis ? vis.id : 'screen-menu';
  };
  App.prototype.show = function (id) {
    SCREENS.forEach(function (s) {
      var el = $(s);
      if (el) el.classList.toggle('visible', s === id);
    });
    if (id !== 'screen-garage') this._stopPreviewLoop();
    if (id === 'screen-garage') this._startPreviewLoop();
    this._syncCoins();
    this._syncRecordUI();
  };
  App.prototype.persist = function () { Data.saveSave(this.save); };
  App.prototype._syncCoins = function () {
    ['menu-coins', 'setup-coins', 'garage-coins'].forEach(function (id) {
      var el = $(id); if (el) el.textContent = faNum(this.save.coins);
    }, this);
  };
  App.prototype._syncRecordUI = function () {
    var el = $('menu-wins');
    if (el) el.textContent = faNum(this.save.stats.wins);
  };
  App.prototype.toast = function (msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    var self = this;
    this._toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  };
  App.prototype._click = function () { this.audio.init(); this.audio.click(); };
  App.prototype._applyAudioMute = function () {
    this.audio.muted = !!this.save.settings.muted;
  };

  /* ============ منوی اصلی ============ */
  App.prototype._bindMenu = function () {
    var self = this;
    $('btn-start-race').addEventListener('click', function () {
      self._click();
      self.audio.stopMenuPad();
      self.show('screen-setup');
    });
    $('btn-garage').addEventListener('click', function () {
      self._click();
      self.audio.stopMenuPad();
      self.show('screen-garage');
      self._openGarage();
    });
    $('btn-settings').addEventListener('click', function () {
      self._click();
      self._syncSettingsUI();
      $('settings-modal').classList.add('visible');
    });
    document.querySelectorAll('.back-btn[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self._click();
        var dest = btn.getAttribute('data-goto');
        self.show(dest === 'menu' ? 'screen-menu' : dest);
        if (dest === 'menu') self.audio.startMenuPad();
      });
    });
  };

  /* ============ تنظیمات ============ */
  App.prototype._bindSettings = function () {
    var self = this;
    $('btn-close-settings').addEventListener('click', function () { self._click(); $('settings-modal').classList.remove('visible'); });
    $('settings-modal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('visible'); });
    $('setting-quality').querySelectorAll('.choice-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        self.save.settings.quality = chip.getAttribute('data-q');
        self.persist(); self._syncSettingsUI(); self._click();
      });
    });
    $('setting-camera').querySelectorAll('.choice-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        self.save.settings.camera = chip.getAttribute('data-cam');
        self.persist(); self._syncSettingsUI(); self._click();
      });
    });
    $('setting-mute').querySelectorAll('.choice-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        self.save.settings.muted = chip.getAttribute('data-mute') === 'on';
        self.persist(); self.audio.setMuted(self.save.settings.muted); self._syncSettingsUI(); self._click();
      });
    });
    $('btn-reset-save').addEventListener('click', function () {
      if (window.confirm('تمام پیشرفت، ماشین‌های خریداری‌شده و رکوردها حذف شود؟')) {
        self.save = Data.resetSave();
        self.persist();
        window.location.reload();
      }
    });
  };
  App.prototype._syncSettingsUI = function () {
    var q = this.save.settings.quality, cam = this.save.settings.camera, muted = !!this.save.settings.muted;
    $('setting-quality').querySelectorAll('.choice-chip').forEach(function (c) { c.classList.toggle('selected', c.getAttribute('data-q') === q); });
    $('setting-camera').querySelectorAll('.choice-chip').forEach(function (c) { c.classList.toggle('selected', c.getAttribute('data-cam') === cam); });
    $('setting-mute').querySelectorAll('.choice-chip').forEach(function (c) { c.classList.toggle('selected', (c.getAttribute('data-mute') === 'on') === muted); });
  };

  /* ============ انتخاب مسیر ============ */
  App.prototype._bindSetup = function () {
    var self = this;
    this._renderTrackCards();
    $('tod-list').innerHTML = Data.TOD.map(function (t) {
      return '<button class="choice-chip tod-chip" data-tod="' + t.id + '"><span class="tod-sky tod-' + t.id + '"></span>' + t.name + '</button>';
    }).join('');
    $('tod-list').querySelectorAll('.choice-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { self.sel.tod = chip.getAttribute('data-tod'); self._syncSetupChoices(); self._click(); });
    });
    $('diff-group').innerHTML = Data.DIFFICULTY.map(function (d) {
      return '<button class="choice-chip" data-diff="' + d.id + '">' + d.name + '</button>';
    }).join('');
    $('diff-group').querySelectorAll('.choice-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { self.sel.difficulty = chip.getAttribute('data-diff'); self._syncSetupChoices(); self._click(); });
    });
    $('laps-group').querySelectorAll('.choice-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { self.sel.laps = parseInt(chip.getAttribute('data-laps'), 10); self._syncSetupChoices(); self._click(); });
    });
    $('btn-change-car').addEventListener('click', function () {
      self._click();
      self.show('screen-garage');
      self._openGarage();
    });
    $('btn-launch').addEventListener('click', function () {
      self._click();
      self.audio.beep(true);
      self._launchRace();
    });
    this._syncSetupChoices();
  };

  App.prototype._syncSetupChoices = function () {
    $('tod-list').querySelectorAll('.choice-chip').forEach(function (c) { c.classList.toggle('selected', c.getAttribute('data-tod') === this.sel.tod); }, this);
    $('diff-group').querySelectorAll('.choice-chip').forEach(function (c) { c.classList.toggle('selected', c.getAttribute('data-diff') === this.sel.difficulty); }, this);
    $('laps-group').querySelectorAll('.choice-chip').forEach(function (c) { c.classList.toggle('selected', parseInt(c.getAttribute('data-laps'), 10) === this.sel.laps); }, this);
    $('track-list').querySelectorAll('.track-card').forEach(function (c) { c.classList.toggle('selected', c.getAttribute('data-track') === this.sel.trackId); }, this);
  };

  App.prototype._updateSetupBar = function () {
    var car = Data.getCar(this.save.selectedId);
    var cls = Data.CLASS_LABELS[car.cls];
    $('setup-car-name').textContent = car.name;
    var classEl = $('setup-car-class');
    classEl.textContent = cls.name;
    classEl.style.color = cls.color;
    classEl.style.borderColor = cls.color;
  };

  App.prototype._renderTrackBests = function () {
    var self = this;
    $('track-list').querySelectorAll('.track-card').forEach(function (card) {
      var id = card.getAttribute('data-track');
      var best = self.save.bestLaps[id];
      var el = card.querySelector('.track-best');
      if (el) el.textContent = best ? ('بهترین دور: ' + Race.formatTime(best)) : 'هنوز رکوردی ثبت نشده — اولین باش!';
    });
  };

  App.prototype._renderTrackCards = function () {
    var list = $('track-list');
    list.innerHTML = '';
    var self = this;
    Data.TRACKS.forEach(function (track) {
      var card = document.createElement('button');
      card.className = 'track-card';
      card.setAttribute('data-track', track.id);
      var metaLaps = track.lapsSuggested + ' دور پیشنهادی';
      card.innerHTML =
        '<canvas class="track-canvas" width="360" height="158"></canvas>' +
        '<div class="track-body">' +
          '<div class="track-name">' + track.name + '</div>' +
          '<div class="track-en">' + track.en + '</div>' +
          '<div class="track-desc">' + track.desc + '</div>' +
          '<div class="track-meta"><span>' + track.lengthKm + ' کیلومتر</span><span>' + metaLaps + '</span><span>جایزه تا ' + faNum(track.rewardBase) + ' 🪙</span></div>' +
          '<div class="track-best"></div>' +
        '</div>';
      card.addEventListener('click', function () {
        self.sel.trackId = track.id;
        self._syncSetupChoices();
        self._click();
      });
      list.appendChild(card);
      self._drawTrackPreview(card.querySelector('canvas'), track);
    });
    this._renderTrackBests();
  };

  App.prototype._drawTrackPreview = function (canvas, track) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    var pts = track.points;
    var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    pts.forEach(function (p) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
    });
    /* نمونه‌های نرم از نقاط کنترل با معادلهٔ کوادرتیک */
    var smooth = [];
    var n = pts.length;
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      for (var t = 0; t < 1; t += 0.08) {
        var mt = 1 - t;
        smooth.push([
          mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
          mt * mt * p0[2] + 2 * mt * t * p1[2] + t * t * p2[2]
        ]);
      }
    }
    var scale = Math.min((W - 46) / (maxX - minX || 1), (H - 30) / (maxZ - minZ || 1));
    var ox = (W - (maxX - minX) * scale) / 2, oy = (H - (maxZ - minZ) * scale) / 2;
    var px = function (x, z) { return [ox + (x - minX) * scale, oy + (z - minZ) * scale]; };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    smooth.forEach(function (p, i) {
      var q = px(p[0], p[1]);
      if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = track.env === 'desert' ? '#ffb35c' : track.env === 'mountain' ? '#7cf29b' : '#00e5ff';
    ctx.lineWidth = 4.5;
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;
    var s0 = px(pts[0][0], pts[0][2]);
    ctx.fillStyle = '#ffe45e';
    ctx.beginPath(); ctx.arc(s0[0], s0[1], 4.5, 0, Math.PI * 2); ctx.fill();
  };

  /* ============ گاراژ ============ */
  App.prototype._bindGarage = function () {
    var self = this;
    $('car-prev').addEventListener('click', function () { self._stepCar(-1); });
    $('car-next').addEventListener('click', function () { self._stepCar(1); });
    $('btn-buy').addEventListener('click', function () { self._buyOrSelect(); });
    window.addEventListener('resize', function () { self._resizePreview(); });
  };

  App.prototype._openGarage = function () {
    this.previewCarId = this.previewCarId || this.save.selectedId;
    if (!this.garageReady) this._buildPreviewScene();
    this._rebuildPreviewCar();
    this._refreshGarageUI();
    this._renderCarStrip();
    this._resizePreview();
    this._generateThumbnails();
  };

  App.prototype._stepCar = function (dir) {
    var idx = ORDERED_CARS.findIndex(function (c) { return c.id === this.previewCarId; }, this);
    if (idx < 0) idx = 0;
    idx = (idx + dir + ORDERED_CARS.length) % ORDERED_CARS.length;
    this.previewCarId = ORDERED_CARS[idx].id;
    this._rebuildPreviewCar();
    this._refreshGarageUI();
    this._markStripSelection();
    this._click();
  };

  App.prototype._buildPreviewScene = function () {
    var canvas = $('garage-canvas');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    this.garageScene = scene;
    this.garageRenderer = renderer;
    this.garageCamera = new THREE.PerspectiveCamera(38, 1.4, 0.1, 100);

    /* محیط استودیویی برای بازتاب بدنه */
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0d1220, side: THREE.BackSide })));
    var strip1 = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strip1.position.set(0, 8, 6); envScene.add(strip1);
    var strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 16), new THREE.MeshBasicMaterial({ color: 0x66e0ff }));
    strip2.position.set(-9, 4, 0); envScene.add(strip2);
    var strip3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 16), new THREE.MeshBasicMaterial({ color: 0xff66d9 }));
    strip3.position.set(9, 4, 0); envScene.add(strip3);
    scene.environment = pmrem.fromScene(envScene, 0.08).texture;
    pmrem.dispose();

    /* سکوی نمایش */
    var platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.55, 3.75, 0.22, 44),
      new THREE.MeshStandardMaterial({ color: 0x161a26, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.3 })
    );
    platform.position.y = 0.11;
    platform.receiveShadow = true;
    scene.add(platform);
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.56, 0.045, 10, 60),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.225;
    scene.add(ring);
    var ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(3.0, 0.02, 8, 60),
      new THREE.MeshBasicMaterial({ color: 0xff2fd6 })
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.225;
    scene.add(ring2);

    /* نورها */
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x141018, 0.95));
    var key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(5.5, 7.5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0005;
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x9be8ff, 0.8);
    fill.position.set(-6, 3.2, 2.5);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xff7ae0, 1.15);
    rim.position.set(0.5, 4.5, -7.5);
    scene.add(rim);

    this.platform = platform;
    this.garageReady = true;
  };

  App.prototype._previewOptions = function (car) {
    var save = this.save;
    return {
      body: car.body,
      paint: Data.carPaint(save, car.id),
      finish: Data.carFinish(save, car.id),
      rim: Data.carRim(save, car.id),
      rimColorHex: (Data.RIM_COLORS.find(function (r) { return r.id === Data.carRimColor(save, car.id); }) || {}).hex || '#d7d9de',
      tire: Data.carTire(save, car.id),
      glow: (Data.GLOWS.find(function (g) { return g.id === Data.carGlow(save, car.id) && g.hex; }) || {}).hex || null
    };
  };

  App.prototype._disposePreviewGroup = function () {
    if (!this.previewGroup) return;
    this.previewGroup.traverse(function (obj) { if (obj.geometry) obj.geometry.dispose(); });
    this.garageScene.remove(this.previewGroup);
    this.previewGroup = null;
  };

  App.prototype._rebuildPreviewCar = function () {
    if (!this.garageReady) return;
    this._disposePreviewGroup();
    var car = Data.getCar(this.previewCarId);
    var group = CarFactory.buildCar(this._previewOptions(car));
    group.position.y = 0.22;
    this.garageScene.add(group);
    this.previewGroup = group;
  };

  App.prototype._resizePreview = function () {
    if (!this.garageReady) return;
    var canvas = $('garage-canvas');
    var parent = canvas.parentElement;
    if (!parent) return;
    var w = parent.clientWidth, h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    this.garageRenderer.setSize(w, h, false);
    this.garageCamera.aspect = w / h;
    this.garageCamera.updateProjectionMatrix();
  };

  App.prototype._startPreviewLoop = function () {
    if (this._previewRAF) return;
    var self = this;
    this._lastPreviewTime = performance.now();
    var loop = function (t) {
      self._previewRAF = requestAnimationFrame(loop);
      var dt = Math.min(0.05, (t - self._lastPreviewTime) / 1000);
      self._lastPreviewTime = t;
      if (self.previewGroup) {
        self._previewSpin += dt * 0.45;
        self.previewGroup.rotation.y = self._previewSpin;
      }
      if (self.garageCamera && self.garageRenderer) {
        var ang = self._previewSpin * 0.35;
        var radius = 7.0;
        self.garageCamera.position.set(Math.sin(ang) * radius * 0.42, 2.15, Math.cos(ang * 0.8) * 0 + 6.35);
        self.garageCamera.lookAt(0, 0.62, 0);
        self.garageRenderer.render(self.garageScene, self.garageCamera);
      }
    };
    this._previewRAF = requestAnimationFrame(loop);
  };
  App.prototype._stopPreviewLoop = function () {
    if (this._previewRAF) cancelAnimationFrame(this._previewRAF);
    this._previewRAF = null;
  };

  App.prototype._refreshGarageUI = function () {
    var car = Data.getCar(this.previewCarId);
    var save = this.save;
    var cls = Data.CLASS_LABELS[car.cls];
    var rar = Data.RARITY_LABELS[car.rarity];
    var eff = Data.effectiveStats(car, save);

    $('spec-name').textContent = car.name;
    $('spec-model').textContent = car.brand + ' · ' + car.model;
    $('spec-desc').textContent = car.desc;
    var classEl = $('spec-class');
    classEl.textContent = cls.name; classEl.style.color = cls.color; classEl.style.borderColor = cls.color;
    var rarEl = $('spec-rarity');
    rarEl.textContent = rar.name; rarEl.style.color = rar.color; rarEl.style.borderColor = rar.color;

    var setBar = function (barId, numId, value) {
      $(barId).style.width = clamp(value, 0, 100) + '%';
      $(numId).textContent = faNum(value);
    };
    setBar('bar-speed', 'num-speed', car.speed);
    setBar('bar-accel', 'num-accel', car.accel);
    setBar('bar-handling', 'num-handling', car.handling);
    setBar('bar-braking', 'num-braking', car.braking);
    $('chip-topspeed').textContent = faNum(eff.topKmh);
    $('chip-year').textContent = car.year;

    var idx = ORDERED_CARS.findIndex(function (c) { return c.id === car.id; });
    $('preview-counter').textContent = faNum(idx + 1) + ' / ' + faNum(ORDERED_CARS.length);

    this._renderUpgrades(car);
    this._renderCustomization(car);
    this._renderBuyButton(car);
  };

  App.prototype._renderUpgrades = function (car) {
    var save = this.save;
    var container = $('upgrade-rows');
    var upg = Data.carUpgrades(save, car.id);
    var html = '';
    Data.UPGRADES.forEach(function (u) {
      var lvl = upg[u.id];
      var maxed = lvl >= Data.UPGRADE_MAX;
      var cost = maxed ? 0 : Data.upgradeCost(car.price, lvl);
      var pips = '';
      for (var i = 0; i < Data.UPGRADE_MAX; i++) pips += '<span class="pip' + (i < lvl ? ' on' : '') + '"></span>';
      html += '<div class="upgrade-row">' +
        '<div class="upg-info"><div class="upg-name">' + u.name + '</div><div class="upg-desc">' + u.desc + '</div><div class="upg-pips">' + pips + '</div></div>' +
        '<button class="upg-btn' + (maxed ? ' maxed' : '') + '" data-upg="' + u.id + '" ' + (maxed ? 'disabled' : '') + '>' +
          (maxed ? 'MAX' : '🪙 ' + faNum(cost)) +
        '</button>' +
      '</div>';
    });
    container.innerHTML = html;
    var self = this;
    container.querySelectorAll('.upg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-upg');
        var u2 = Data.carUpgrades(self.save, car.id);
        var lvl = u2[id];
        if (lvl >= Data.UPGRADE_MAX) return;
        var cost = Data.upgradeCost(car.price, lvl);
        if (self.save.coins < cost) {
          self.audio.denied();
          self.toast('اعتبار کافی نیست! 🪙 ' + faNum(cost) + ' لازم دارید');
          return;
        }
        self.save.coins -= cost;
        if (!self.save.upgrades[car.id]) self.save.upgrades[car.id] = { engine: 0, tires: 0, brakes: 0 };
        self.save.upgrades[car.id][id] = lvl + 1;
        self.persist();
        self.audio.coin();
        self._syncCoins();
        self._refreshGarageUI();
        self._rebuildPreviewCar();
        self.toast('ارتقا انجام شد! سطح ' + faNum(lvl + 1));
      });
    });
  };

  App.prototype._renderCustomization = function (car) {
    var save = this.save;
    var self = this;
    /* رنگ بدنه */
    var paintGrid = $('paint-grid');
    var curPaint = Data.carPaint(save, car.id).toLowerCase();
    paintGrid.innerHTML = Data.PAINTS.map(function (p) {
      return '<button class="paint-swatch' + (p.hex.toLowerCase() === curPaint ? ' selected' : '') + '" data-hex="' + p.hex + '" title="' + p.name + '" style="background:radial-gradient(circle at 34% 32%, ' + shadeHex(p.hex, 60) + ', ' + p.hex + ' 58%, ' + shadeHex(p.hex, -55) + ')"></button>';
    }).join('');
    paintGrid.querySelectorAll('.paint-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.save.paints[car.id] = btn.getAttribute('data-hex');
        self.persist(); self._rebuildPreviewCar(); self._renderCustomization(car); self._click();
      });
    });
    /* پرداخت */
    var finishRow = $('finish-row');
    var curFinish = Data.carFinish(save, car.id);
    finishRow.innerHTML = Data.FINISHES.map(function (f) {
      return '<button class="choice-chip' + (f.id === curFinish ? ' selected' : '') + '" data-finish="' + f.id + '">' + f.name + '</button>';
    }).join('');
    finishRow.querySelectorAll('.choice-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.save.finishes[car.id] = btn.getAttribute('data-finish');
        self.persist(); self._rebuildPreviewCar(); self._renderCustomization(car); self._click();
      });
    });
    /* رینگ‌ها */
    var rimGrid = $('rim-grid');
    var curRim = Data.carRim(save, car.id);
    rimGrid.innerHTML = '';
    Data.RIMS.forEach(function (rim) {
      var cell = document.createElement('button');
      cell.className = 'rim-cell' + (rim.id === curRim ? ' selected' : '');
      cell.setAttribute('data-rim', rim.id);
      var cv = document.createElement('canvas');
      cv.width = cv.height = 56;
      drawRimIcon(cv.getContext('2d'), rim.id, (Data.RIM_COLORS.find(function (r) { return r.id === Data.carRimColor(save, car.id); }) || {}).hex || '#d7d9de');
      cell.appendChild(cv);
      var lbl = document.createElement('span');
      lbl.textContent = rim.name;
      cell.appendChild(lbl);
      cell.addEventListener('click', function () {
        self.save.rims[car.id] = rim.id;
        self.persist(); self._rebuildPreviewCar(); self._renderCustomization(car); self._click();
      });
      rimGrid.appendChild(cell);
    });
    /* رنگ رینگ */
    var rimColorRow = $('rimcolor-row');
    var curRimColor = Data.carRimColor(save, car.id);
    rimColorRow.innerHTML = Data.RIM_COLORS.map(function (r) {
      return '<button class="choice-chip' + (r.id === curRimColor ? ' selected' : '') + '" data-rimcolor="' + r.id + '"><span class="glow-dot" style="color:' + r.hex + ';background:' + r.hex + '"></span>' + r.name + '</button>';
    }).join('');
    rimColorRow.querySelectorAll('.choice-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.save.rimColors[car.id] = btn.getAttribute('data-rimcolor');
        self.persist(); self._rebuildPreviewCar(); self._renderCustomization(car); self._click();
      });
    });
    /* لاستیک‌ها */
    var tireList = $('tire-list');
    var curTire = Data.carTire(save, car.id);
    tireList.innerHTML = '';
    Data.TIRES.forEach(function (tire) {
      var item = document.createElement('button');
      item.className = 'tire-item' + (tire.id === curTire ? ' selected' : '');
      item.setAttribute('data-tire', tire.id);
      item.innerHTML = '<span class="tire-icon"></span><span><span class="tire-name">' + tire.name + '</span><br><span class="tire-desc">' + tire.desc + '</span></span>';
      item.addEventListener('click', function () {
        self.save.tires[car.id] = tire.id;
        self.persist(); self._rebuildPreviewCar(); self._renderCustomization(car); self._click();
      });
      tireList.appendChild(item);
    });
    /* زیرنور */
    var glowRow = $('glow-row');
    var curGlow = Data.carGlow(save, car.id);
    glowRow.innerHTML = Data.GLOWS.map(function (g) {
      var dot = g.hex ? '<span class="glow-dot" style="color:' + g.hex + ';background:' + g.hex + '"></span>' : '∅';
      return '<button class="choice-chip' + (g.id === curGlow ? ' selected' : '') + '" data-glow="' + g.id + '" title="' + g.name + '">' + dot + '</button>';
    }).join('');
    glowRow.querySelectorAll('.choice-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.save.glows[car.id] = btn.getAttribute('data-glow');
        self.persist(); self._rebuildPreviewCar(); self._renderCustomization(car); self._click();
      });
    });
  };

  App.prototype._renderBuyButton = function (car) {
    var btn = $('btn-buy');
    var owned = this.save.owned.indexOf(car.id) !== -1;
    var selected = this.save.selectedId === car.id;
    btn.classList.remove('owned', 'selected-car', 'locked');
    if (selected) {
      btn.textContent = '✓ ماشین فعلی شما';
      btn.classList.add('selected-car');
    } else if (owned) {
      btn.textContent = 'انتخاب این ماشین';
      btn.classList.add('owned');
    } else {
      btn.textContent = 'خرید — 🪙 ' + faNum(car.price);
      btn.classList.add('locked');
    }
  };

  App.prototype._buyOrSelect = function () {
    var car = Data.getCar(this.previewCarId);
    var owned = this.save.owned.indexOf(car.id) !== -1;
    if (owned) {
      this.save.selectedId = car.id;
      this.persist();
      this.audio.coin();
      this._refreshGarageUI();
      this._markStripSelection();
      this._updateSetupBar();
      this.toast('«' + car.name + '» انتخاب شد');
      return;
    }
    if (this.save.coins < car.price) {
      this.audio.denied();
      this.toast('اعتبار کافی نیست! به ' + faNum(car.price - this.save.coins) + ' 🪙 دیگر نیاز دارید');
      return;
    }
    this.save.coins -= car.price;
    this.save.owned.push(car.id);
    this.save.selectedId = car.id;
    this.persist();
    this.audio.coin();
    this._syncCoins();
    this._refreshGarageUI();
    this._renderCarStrip();
    this._updateSetupBar();
    this.toast('🎉 «' + car.name + '» به گاراژ شما اضافه شد!');
  };

  App.prototype._renderCarStrip = function () {
    var strip = $('car-strip');
    var self = this;
    strip.innerHTML = '';
    ORDERED_CARS.forEach(function (car) {
      var owned = self.save.owned.indexOf(car.id) !== -1;
      var selected = self.save.selectedId === car.id;
      var chip = document.createElement('button');
      chip.className = 'car-chip' + (selected ? ' selected' : '') + (owned ? '' : ' locked');
      chip.setAttribute('data-car', car.id);
      var cls = Data.CLASS_LABELS[car.cls];
      chip.innerHTML =
        '<img alt="' + car.name + '" src="' + (self._thumbs[car.id] || TRANSPARENT_PIXEL) + '">' +
        '<div class="chip-name">' + car.name + '</div>' +
        '<div class="chip-class" style="color:' + cls.color + '">' + cls.name + '</div>' +
        (owned ? '<div class="chip-owned">✓ در مالکیت شما</div>' : '<div class="chip-price">🪙 ' + faNum(car.price) + '</div>');
      chip.addEventListener('click', function () {
        self.previewCarId = car.id;
        self._rebuildPreviewCar();
        self._refreshGarageUI();
        self._markStripSelection();
        self._click();
      });
      strip.appendChild(chip);
    });
  };

  App.prototype._markStripSelection = function () {
    var strip = $('car-strip');
    strip.querySelectorAll('.car-chip').forEach(function (chip) {
      var id = chip.getAttribute('data-car');
      chip.classList.toggle('selected', id === this.previewCarId);
    }, this);
  };

  /* بندانگشتی سه‌بعدی برای هر ماشین (یک‌بار رندر و کش می‌شود) */
  var TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  App.prototype._generateThumbnails = function () {
    var self = this;
    var pending = ORDERED_CARS.filter(function (c) { return !self._thumbs[c.id]; });
    if (!pending.length) return;
    /* رندرر مشترک کوچک */
    var thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 168; thumbCanvas.height = 96;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: thumbCanvas, antialias: true, alpha: true });
    } catch (e) { return; }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    var scene = new THREE.Scene();
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 8, 8), new THREE.MeshBasicMaterial({ color: 0x1a2030, side: THREE.BackSide })));
    var white = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    white.position.set(0, 4, 2); envScene.add(white);
    scene.environment = pmrem.fromScene(envScene, 0.05).texture;
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.25));
    var key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(4, 6, 4); scene.add(key);
    var fill = new THREE.DirectionalLight(0x9be8ff, 0.7);
    fill.position.set(-5, 3, 1); scene.add(fill);
    var cam = new THREE.PerspectiveCamera(34, 168 / 96, 0.1, 60);
    cam.position.set(4.6, 2.1, 5.2);
    cam.lookAt(0, 0.5, 0);

    var i = 0;
    function step() {
      if (i >= pending.length) {
        /* به‌روزرسانی تصاویر در استریپ */
        document.querySelectorAll('#car-strip .car-chip').forEach(function (chip) {
          var id = chip.getAttribute('data-car');
          var img = chip.querySelector('img');
          if (img && self._thumbs[id]) img.src = self._thumbs[id];
        });
        renderer.dispose();
        return;
      }
      var car = pending[i++];
      var owned = self.save.owned.indexOf(car.id) !== -1;
      var group = CarFactory.buildCar({
        body: car.body,
        paint: owned ? Data.carPaint(self.save, car.id) : '#5b606e',
        finish: 'gloss',
        rim: 'sport', rimColorHex: '#d7d9de',
        tire: 'street', glow: null
      });
      group.rotation.y = 0.62;
      scene.add(group);
      renderer.render(scene, cam);
      self._thumbs[car.id] = thumbCanvas.toDataURL('image/png');
      scene.remove(group);
      group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      setTimeout(step, 24);
    }
    setTimeout(step, 60);
  };

  /* ============ راه‌اندازی مسابقه ============ */
  App.prototype._launchRace = function () {
    var self = this;
    if (this.currentRace) { this.currentRace.dispose(); this.currentRace = null; }
    this.show('screen-hud');
    this.audio.stopMenuPad();
    /* بازنشانی HUD */
    $('hud-pos').textContent = '1';
    $('hud-lap').textContent = 'دور ۱/' + this.sel.laps;
    $('hud-time').textContent = '۰۰:۰۰.۰۰';
    $('hud-best').textContent = '--:--.--';
    $('hud-speed').textContent = '۰';
    $('hud-gear').textContent = '1';
    var touch = $('touch-controls');
    if (touch) touch.classList.toggle('on', ('ontouchstart' in window) || navigator.maxTouchPoints > 0);
    this.save.settings.tod = this.sel.tod;
    this.save.settings.difficulty = this.sel.difficulty;
    this.persist();

    this.currentRace = new Race.RaceSession({
      container: $('race-container'),
      trackId: this.sel.trackId,
      tod: this.sel.tod,
      laps: this.sel.laps,
      difficulty: this.sel.difficulty,
      carId: this.save.selectedId,
      save: this.save,
      audio: this.audio,
      callbacks: {
        onFinish: function (result) { self._onRaceFinish(result); },
        onQuit: function () {
          self.currentRace = null;
          self.show('screen-menu');
          self.audio.startMenuPad();
        },
        onRestart: function () {
          self.currentRace = null;
          self._launchRace();
        }
      }
    });
  };

  App.prototype._onRaceFinish = function (result) {
    /* آزادسازی دنیای مسابقه؛ صفحه نتایج روی خودش رندر می‌شود */
    if (this.currentRace) { this.currentRace.dispose(); this.currentRace = null; }
    /* ذخیره در رکوردها */
    var save = this.save;
    save.coins += result.coins;
    save.stats.races += 1;
    if (result.win) save.stats.wins += 1;
    var newBest = false;
    if (result.bestLap) {
      var prev = save.bestLaps[result.trackId];
      if (!prev || result.bestLap < prev) { save.bestLaps[result.trackId] = result.bestLap; newBest = true; }
    }
    var prevTotal = save.bestTotal[result.trackId];
    if (!prevTotal || result.totalTime < prevTotal) save.bestTotal[result.trackId] = result.totalTime;
    if (result.driftScore > (save.stats.driftBest || 0)) save.stats.driftBest = result.driftScore;
    this.persist();
    this._syncCoins();
    this._syncRecordUI();
    this._renderTrackBests();

    /* پر کردن کارت نتایج */
    var medal = result.place === 1 ? '🥇' : result.place === 2 ? '🥈' : result.place === 3 ? '🥉' : '🏳️';
    $('result-medal').textContent = medal;
    $('result-title').textContent = result.win ? 'برنده شدید!' : 'رتبهٔ ' + faNum(result.place) + ' ام';
    var track = Data.TRACKS.find(function (t) { return t.id === result.trackId; });
    var todName = (Data.TOD.find(function (t) { return t.id === result.tod; }) || {}).name || '';
    $('result-track').textContent = (track ? track.name : '') + ' · ' + todName;
    $('result-place').textContent = faNum(result.place);
    $('result-place-coins').textContent = faNum(result.placeReward);
    $('result-drift-score').textContent = faNum(result.driftScore);
    $('result-drift-coins').textContent = faNum(result.driftBonus);
    $('result-total-coins').textContent = faNum(result.coins);
    $('result-best-lap').textContent = result.bestLap ? Race.formatTime(result.bestLap) : '--:--.--';
    $('result-total-time').textContent = Race.formatTime(result.totalTime);
    $('result-new-best').classList.toggle('hidden', !newBest);

    this.show('screen-results');
  };

  App.prototype._bindResults = function () {
    var self = this;
    $('btn-retry').addEventListener('click', function () {
      self._click();
      if (self.currentRace) { self.currentRace.dispose(); self.currentRace = null; }
      self._launchRace();
    });
    $('btn-results-garage').addEventListener('click', function () {
      self._click();
      if (self.currentRace) { self.currentRace.dispose(); self.currentRace = null; }
      self.show('screen-garage');
      self._openGarage();
    });
    $('btn-results-menu').addEventListener('click', function () {
      self._click();
      if (self.currentRace) { self.currentRace.dispose(); self.currentRace = null; }
      self.show('screen-menu');
      self.audio.startMenuPad();
    });
  };

  /* ============ ابزار رنگ ============ */
  function shadeHex(hex, amt) {
    var n = parseInt(hex.replace('#', ''), 16);
    var r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 0xff) + amt, 0, 255), b = clamp((n & 0xff) + amt, 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function drawRimIcon(g, style, colorHex) {
    var c = 28, dark = shadeHex(colorHex, -80), light = shadeHex(colorHex, 70);
    g.clearRect(0, 0, 56, 56);
    g.fillStyle = '#0d0d10';
    g.beginPath(); g.arc(c, c, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = colorHex; g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
    g.fillStyle = colorHex;
    var i, a;
    if (style === 'steel') {
      g.beginPath(); g.arc(c, c, 16, 0, Math.PI * 2); g.fillStyle = light; g.fill();
      g.fillStyle = '#0d0d10';
      for (i = 0; i < 5; i++) { a = i / 5 * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * 9.5, c + Math.sin(a) * 9.5, 2.4, 0, Math.PI * 2); g.fill(); }
    } else if (style === 'mesh') {
      g.lineWidth = 2.2; g.strokeStyle = light;
      for (i = 0; i < 10; i++) {
        a = i / 10 * Math.PI * 2;
        g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 19, c + Math.sin(a) * 19); g.stroke();
        g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a + 0.3) * 19, c + Math.sin(a + 0.3) * 19); g.stroke();
      }
    } else if (style === 'turbine') {
      g.lineWidth = 3.4; g.strokeStyle = light;
      for (i = 0; i < 9; i++) {
        a = i / 9 * Math.PI * 2;
        g.beginPath(); g.moveTo(c + Math.cos(a) * 4, c + Math.sin(a) * 4);
        g.quadraticCurveTo(c + Math.cos(a + 0.55) * 12, c + Math.sin(a + 0.55) * 12, c + Math.cos(a + 0.42) * 20, c + Math.sin(a + 0.42) * 20);
        g.stroke();
      }
    } else { /* sport */
      for (i = 0; i < 5; i++) {
        a = i / 5 * Math.PI * 2 - Math.PI / 2;
        g.save(); g.translate(c, c); g.rotate(a);
        g.fillStyle = i % 2 ? colorHex : light;
        g.beginPath(); g.moveTo(-4.4, -5); g.lineTo(-6.4, -19); g.lineTo(6.4, -19); g.lineTo(4.4, -5); g.closePath(); g.fill();
        g.restore();
      }
    }
    g.fillStyle = dark; g.beginPath(); g.arc(c, c, 4.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = light; g.beginPath(); g.arc(c, c, 2.2, 0, Math.PI * 2); g.fill();
  }

  root.NitroUI = { App: App };
})(typeof window !== 'undefined' ? window : globalThis);
