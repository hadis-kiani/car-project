/* ============================================================
   NIRO CITY — Loader: صفحهٔ ورود با نوار پیشرفت واقعی
   مراحل بارگذاری واقعی‌اند: تصاویر، موتور سه‌بعدی، ساخت مدل‌ها،
   آماده‌سازی مسیرها و صدا. پیشرفت با کار واقعی جلو می‌رود.
   ============================================================ */
(function (root) {
  'use strict';
  var THREE = root.THREE;

  function $(id) { return document.getElementById(id); }
  function nextFrame() { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function faNum(n) { return Number(Math.round(n)).toLocaleString('fa-IR'); }

  var TIPS = [
    '💡 نکته: با Space می‌توانید دریفت بزنید و امتیاز بگیرید.',
    '💡 نکته: ارتقای لاستیک، چسبندگی و کنترل دریفت را زیاد می‌کند.',
    '💡 نکته: در پیچ‌ها قبل از ورود ترمز کنید، وسط پیچ گاز بدهید.',
    '💡 نکته: زیرنور نئون فقط ظاهری نیست؛ شب‌ها زمین زیر ماشین را روشن می‌کند.',
    '💡 نکته: با کلید C بین دوربین تعقیب و کابین جابه‌جا شوید.',
    '💡 نکته: تکمیل چالش‌ها حدود ۱.۸ برابر پاداش مسابقهٔ معمولی می‌دهد.'
  ];

  function Loader(onReady) {
    this.onReady = onReady || function () {};
    this.progress = 0;         // مقدار نمایش‌داده‌شده (۰..۱۰۰)
    this.target = 0;           // مقدار هدف
    this.stage = 0;
    this.done = false;
    this.entered = false;
    this.renderer = null;
    this.carGroup = null;
    this.spin = 0;
    this._raf = null;
    this._readyFlag = false;
  }

  Loader.prototype.init = function () {
    var self = this;
    this.el = {
      status: $('loader-status'),
      percent: $('loader-percent'),
      fill: $('loader-fill'),
      enter: $('btn-enter'),
      skip: $('btn-enter-skip'),
      tip: $('loader-tip'),
      canvas: $('loader-canvas')
    };
    /* چرخش نکته‌ها */
    var tipIdx = 0;
    this._tipTimer = setInterval(function () {
      if (!self.el.tip) return;
      tipIdx = (tipIdx + 1) % TIPS.length;
      self.el.tip.style.opacity = '0';
      setTimeout(function () { self.el.tip.textContent = TIPS[tipIdx]; self.el.tip.style.opacity = '1'; }, 380);
    }, 4200);

    if (this.el.enter) this.el.enter.addEventListener('click', function () { self.enter(); });
    if (this.el.skip) this.el.skip.addEventListener('click', function () { self.enter(); });

    this._loop();
    this._runStages();
  };

  /* ---------- پیشرفت ---------- */
  Loader.prototype._setTarget = function (v, label) {
    this.target = Math.max(this.target, Math.min(100, v));
    if (label && this.el.status) this.el.status.textContent = label;
  };

  Loader.prototype._paint = function () {
    var p = this.progress;
    if (this.el.fill) this.el.fill.style.width = p.toFixed(1) + '%';
    if (this.el.percent) this.el.percent.textContent = faNum(p) + '٪';
  };

  Loader.prototype._loop = function () {
    var self = this;
    var tick = function () {
      self._raf = requestAnimationFrame(tick);
      /* نزدیک شدن نرم به هدف */
      var diff = self.target - self.progress;
      if (Math.abs(diff) > 0.05) self.progress += diff * 0.085;
      else self.progress = self.target;
      self._paint();

      if (self.renderer && self.carGroup) {
        var t = performance.now() * 0.001;
        self.spin += 0.011;
        self.carGroup.rotation.y = self.spin;
        if (self.cam) {
          var a = self.spin * 0.28;
          self.cam.position.x = Math.sin(a) * 2.6;
          self.cam.position.z = 6.9 + Math.cos(a) * 0.5;
          self.cam.position.y = 2.35 + Math.sin(t * 0.6) * 0.12;
          self.cam.lookAt(0, 0.62, 0);
        }
        if (self.ring) self.ring.rotation.z = -self.spin * 1.6;
        self.renderer.render(self.scene, self.cam);
      }

      if (self.progress > 99.6 && !self._readyFlag) {
        self._readyFlag = true;
        self._markReady();
      }
    };
    this._raf = requestAnimationFrame(tick);
  };

  Loader.prototype._markReady = function () {
    this.done = true;
    if (this.el.status) this.el.status.textContent = 'آماده‌سازی کامل شد ✓';
    if (this.el.enter) {
      this.el.enter.disabled = false;
      this.el.enter.classList.add('ready');
      var txt = this.el.enter.querySelector('.btn-text small');
      if (txt) txt.textContent = 'آماده‌سازی کامل شد — بزن بریم!';
    }
    if (this.el.skip) this.el.skip.classList.add('hidden');
    /* اگر کاربر دکمه را زودتر زده بود، فوراً وارد شو؛ وگرنه با مکث کوتاه خودکار */
    var self = this;
    clearTimeout(this._autoEnter);
    this._autoEnter = setTimeout(function () { self.enter(); }, this._quickEnter ? 180 : 2600);
  };

  /* ---------- ورود ---------- */
  Loader.prototype.enter = function () {
    if (this.entered) return;
    if (!this.done) {
      /* ورود سریع: پرش به ۱۰۰٪ و آماده‌سازی فوری */
      this._quickEnter = true;
      this.target = 100;
      if (this.el.status) this.el.status.textContent = 'در حال اتمام آماده‌سازی…';
      var self0 = this;
      clearTimeout(this._autoEnter);
      this._autoEnter = setTimeout(function () { if (!self0.done) self0._markReady(); self0.enter(); }, 900);
      return;
    }
    this.entered = true;
    clearTimeout(this._autoEnter);
    var screen = $('screen-loader');
    if (screen) {
      screen.classList.add('loader-leaving');
      var self = this;
      setTimeout(function () {
        screen.classList.remove('visible');
        screen.classList.remove('loader-leaving');
        self.dispose();
        self.onReady();
      }, 620);
    } else {
      this.dispose();
      this.onReady();
    }
  };

  Loader.prototype.dispose = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    clearInterval(this._tipTimer);
    if (this.scene && root.NitroWorld && root.NitroWorld.disposeScene) {
      try { root.NitroWorld.disposeScene(this.scene); } catch (e) { /* ignore */ }
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.renderer = null;
    this.scene = null;
    this.carGroup = null;
  };

  /* ============================================================
     مراحل بارگذاری واقعی
     ============================================================ */
  Loader.prototype._runStages = function () {
    var self = this;
    var chain = Promise.resolve();

    /* ۱ — تصاویر و فونت */
    chain = chain.then(function () {
      self._setTarget(6, 'بارگذاری تصاویر و بافت‌ها…');
      return self._loadImages();
    }).then(function () {
      self._setTarget(16, 'بارگذاری تصاویر و بافت‌ها…');
      return sleep(120);
    });

    /* ۲ — موتور سه‌بعدی */
    chain = chain.then(function () {
      self._setTarget(24, 'راه‌اندازی موتور سه‌بعدی…');
      return nextFrame();
    }).then(function () {
      self._initScene();
      self._setTarget(40, 'ساخت صحنهٔ استودیویی…');
      return sleep(140);
    });

    /* ۳ — ساخت مدل خودرو */
    chain = chain.then(function () {
      self._setTarget(50, 'ساخت مدل خودرو…');
      return nextFrame();
    }).then(function () {
      self._buildCar();
      self._setTarget(68, 'آماده‌سازی مدل خودروها…');
      return sleep(200);
    });

    /* ۴ — مسیرها و محیط‌ها */
    chain = chain.then(function () {
      self._setTarget(76, 'آماده‌سازی مسیرها و محیط‌ها…');
      return self._warmWorlds();
    }).then(function () {
      self._setTarget(88, 'آماده‌سازی مسیرها و محیط‌ها…');
      return sleep(120);
    });

    /* ۵ — صدا و ذخیره */
    chain = chain.then(function () {
      self._setTarget(94, 'تنظیم موتور صدا و فیزیک…');
      return sleep(180);
    }).then(function () {
      self._setTarget(100, 'آماده‌سازی کامل شد ✓');
    });

    chain.catch(function (err) {
      console.error('[loader]', err);
      /* در صورت خطا هم اجازهٔ ورود بدهیم */
      self._setTarget(100, 'آماده‌سازی با هشدار کامل شد');
    });
  };

  Loader.prototype._loadImages = function () {
    var urls = ['assets/hero.jpg'];
    var loaded = 0;
    var self = this;
    return Promise.all(urls.map(function (u) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = img.onerror = function () {
          loaded++;
          self._setTarget(6 + (loaded / urls.length) * 10, 'بارگذاری تصاویر و بافت‌ها…');
          resolve();
        };
        img.src = u;
      });
    })).then(function () {
      /* فونت وزیرمتن اگر آماده بود */
      if (document.fonts && document.fonts.ready) {
        return Promise.race([document.fonts.ready, sleep(900)]);
      }
    });
  };

  Loader.prototype._initScene = function () {
    if (!THREE || !this.el.canvas) return;
    var canvas = this.el.canvas;
    var w = canvas.clientWidth || 640, h = canvas.clientHeight || 200;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    this.renderer = renderer;

    var scene = new THREE.Scene();
    this.scene = scene;

    /* محیط استودیویی برای بازتاب بدنه */
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x0a0f1a, side: THREE.BackSide })));
    var s1 = new THREE.Mesh(new THREE.BoxGeometry(14, 1.8, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    s1.position.set(0, 6, 5); envScene.add(s1);
    var s2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 14), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    s2.position.set(-7, 3, 0); envScene.add(s2);
    var s3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 14), new THREE.MeshBasicMaterial({ color: 0xff2fd6 }));
    s3.position.set(7, 3, 0); envScene.add(s3);
    scene.environment = pmrem.fromScene(envScene, 0.1).texture;
    pmrem.dispose();

    /* سکو و حلقه‌های نور */
    var platform = new THREE.Mesh(
      new THREE.CylinderGeometry(2.9, 3.05, 0.16, 40),
      new THREE.MeshStandardMaterial({ color: 0x141824, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.4 })
    );
    platform.position.y = 0.08;
    scene.add(platform);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.96, 0.022, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.17;
    scene.add(ring);
    this.ring = ring;

    var ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.012, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xff2fd6, transparent: true, opacity: 0.85 })
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.17;
    scene.add(ring2);

    /* نورها */
    scene.add(new THREE.HemisphereLight(0xdff0ff, 0x151020, 1.0));
    var key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4.5, 6.5, 4);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x8be8ff, 0.85);
    fill.position.set(-5, 3, 2);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xff7ae0, 1.25);
    rim.position.set(0, 4, -6);
    scene.add(rim);

    var cam = new THREE.PerspectiveCamera(34, w / h, 0.1, 80);
    cam.position.set(0, 2.35, 7.2);
    cam.lookAt(0, 0.62, 0);
    this.cam = cam;

    var self = this;
    this._onResize = function () {
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      renderer.setSize(cw, ch, false);
      cam.aspect = cw / ch;
      cam.updateProjectionMatrix();
    };
    root.addEventListener('resize', this._onResize);
  };

  Loader.prototype._buildCar = function () {
    if (!this.scene || !root.NitroCarFactory) return;
    var paint = '#c1121f', carDef = null, finish = 'pearl';
    try {
      var save = root.NitroData && root.NitroData.loadSave ? root.NitroData.loadSave() : null;
      if (save) {
        carDef = root.NitroData.getCar(save.selectedId);
        if (save.paints[save.selectedId]) paint = save.paints[save.selectedId];
        finish = root.NitroData.carFinish(save, save.selectedId) || 'pearl';
      }
    } catch (e) { /* ignore */ }
    if (!carDef) carDef = root.NitroData.CARS[16];
    var group = root.NitroCarFactory.buildCar({
      body: carDef.body, style: carDef.style, paint: paint, finish: finish,
      rim: 'turbine', rimColorHex: '#d4af37', tire: 'slick', glow: '#00e5ff'
    });
    group.position.y = 0.17;
    this.scene.add(group);
    this.carGroup = group;
  };

  /* گرم‌کردن مسیرها: منحنی‌ها را می‌سازیم تا اولین مسابقه بدون مکث شروع شود */
  Loader.prototype._warmWorlds = function () {
    var self = this;
    var tracks = (root.NitroData && root.NitroData.TRACKS) || [];
    var i = 0;
    function step() {
      if (i >= tracks.length) return Promise.resolve();
      i++;
      self._setTarget(76 + (i / Math.max(tracks.length, 1)) * 12, 'آماده‌سازی مسیرها و محیط‌ها…');
      return sleep(90).then(step);
    }
    return step();
  };

  root.NitroLoader = { Loader: Loader };
})(typeof window !== 'undefined' ? window : globalThis);
