/* ============================================================
   NIRO CITY — World: جاده، محیط، آسمان، نورپردازی سه زمان روز
   buildRaceWorld(scene, renderer, trackDef, todId) → داده‌های مسیر
   ============================================================ */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  if (!THREE) { console.error('THREE not loaded'); return; }

  var SEG = 420; // تعداد سگمنت‌های جاده

  /* ---------- ابزار Canvas ---------- */
  function mkCanvas(w, h, fn) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    return c;
  }
  function canvasTexture(c, repeatX, repeatY) {
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeatX) t.repeat.set(repeatX, repeatY || 1);
    t.anisotropy = 8;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  /* PRNG قطعی تا چیدمان شهر بین جلسات ثابت بماند */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- بافت‌های جاده ---------- */
  var roadTex = null, curbTex = null, checkerTex = null, walkTex = null;
  function buildSharedTextures() {
    if (roadTex) return;
    roadTex = canvasTexture(mkCanvas(256, 256, function (g) {
      g.fillStyle = '#33363c'; g.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 900; i++) {
        var v = 40 + Math.random() * 40;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 6) + ',0.35)';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      g.fillStyle = '#e8e8e8';
      g.fillRect(0, 10, 256, 7); g.fillRect(0, 239, 256, 7);      // خطوط کناری
      g.fillStyle = '#f5c518';
      g.fillRect(18, 122, 130, 12);                                // خط وسطچین
    }), 1, 1);
    curbTex = canvasTexture(mkCanvas(128, 32, function (g) {
      for (var j = 0; j < 4; j++) { g.fillStyle = j % 2 ? '#c1121f' : '#f1f1f1'; g.fillRect(j * 32, 0, 32, 32); }
    }), 1, 1);
    checkerTex = canvasTexture(mkCanvas(128, 32, function (g) {
      for (var x = 0; x < 16; x++) for (var y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#0c0c0c' : '#f5f5f5'; g.fillRect(x * 8, y * 8, 8, 8); }
    }), 1, 1);
    walkTex = canvasTexture(mkCanvas(128, 128, function (g) {
      g.fillStyle = '#55585e'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#45484e'; g.lineWidth = 3;
      for (var k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(0, k * 32); g.lineTo(128, k * 32); g.moveTo(k * 32, 0); g.lineTo(k * 32, 128); g.stroke(); }
    }), 1, 1);
  }

  /* ---------- نمونه‌برداری منحنی ---------- */
  function sampleTrack(trackDef) {
    var pts = trackDef.points.map(function (p) { return new THREE.Vector3(p[0], p[1] || 0, p[2]); });
    var curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.55);
    var raw = curve.getSpacedPoints(SEG);
    raw.pop(); // بسته است
    var samples = [], cum = 0, total = curve.getLength();
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i];
      var pNext = raw[(i + 1) % raw.length], pPrev = raw[(i - 1 + raw.length) % raw.length];
      var tangent = pNext.clone().sub(pPrev).normalize();
      var side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      if (i > 0) cum += raw[i].distanceTo(raw[i - 1]);
      samples.push({ pos: p, tangent: tangent, side: side, cum: cum });
    }
    return { curve: curve, samples: samples, length: total };
  }

  /* جستجوی نزدیک‌ترین سگمنت با اشاره‌گر (پنجرهٔ محلی) */
  function findNearest(samples, pos, hint) {
    var n = samples.length;
    if (hint === undefined || hint === null) {
      var best = 0, bd = Infinity;
      for (var i = 0; i < n; i += 2) { var d = samples[i].pos.distanceToSquared(pos); if (d < bd) { bd = d; best = i; } }
      hint = best;
    }
    var half = 26, i0 = (hint - half + n) % n;
    var bestIdx = hint, bestD = Infinity;
    for (var k = 0; k <= half * 2; k++) {
      var idx = (i0 + k) % n;
      var dd = samples[idx].pos.distanceToSquared(pos);
      if (dd < bestD) { bestD = dd; bestIdx = idx; }
    }
    var s = samples[bestIdx];
    var toCar = pos.clone().sub(s.pos);
    var lateral = toCar.dot(s.side);
    return { index: bestIdx, dist: Math.sqrt(bestD), lateral: lateral, sample: s };
  }

  /* ---------- روبون جاده ---------- */
  function buildRibbon(samples, getOffsetY, halfWidthFn, vRepeatEvery, material, yLift) {
    var n = samples.length;
    var verts = [], uvs = [], idx = [];
    var cum = 0;
    for (var i = 0; i < n; i++) {
      var s = samples[i];
      var hw = halfWidthFn(i);
      var y = (s.pos.y || 0) + (yLift || 0);
      var left = s.pos.clone().addScaledVector(s.side, hw); left.y = y + (getOffsetY ? getOffsetY(i, 1) : 0);
      var right = s.pos.clone().addScaledVector(s.side, -hw); right.y = y + (getOffsetY ? getOffsetY(i, -1) : 0);
      verts.push(left.x, left.y, left.z, right.x, right.y, right.z);
      if (i > 0) cum += samples[i].pos.distanceTo(samples[i - 1]);
      var u = cum / (vRepeatEvery || 7);
      uvs.push(u, 0, u, 1);
    }
    for (var j = 0; j < n; j++) {
      var a = j * 2, bIdx = ((j + 1) % n) * 2;
      idx.push(a, a + 1, bIdx, bIdx, a + 1, bIdx + 1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  /* روبون عمودی (گاردریل) */
  function buildGuardRail(samples, sideSign, halfWidth, yBot, yTop, material) {
    var n = samples.length, verts = [], uvs = [], idx = [];
    var cum = 0;
    for (var i = 0; i < n; i++) {
      var s = samples[i];
      var off = s.pos.clone().addScaledVector(s.side, sideSign * halfWidth);
      if (i > 0) cum += samples[i].pos.distanceTo(samples[i - 1]);
      var u = cum / 6;
      verts.push(off.x, (s.pos.y || 0) + yBot, off.z, off.x, (s.pos.y || 0) + yTop, off.z);
      uvs.push(u, 0, u, 1);
    }
    for (var j = 0; j < n; j++) {
      var a = j * 2, b = ((j + 1) % n) * 2;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }

  /* ---------- بافت آسمان ---------- */
  var SKY = {
    day:    { top: '#2f6fd0', mid: '#6fa8e0', horizon: '#bfe0f2', sun: { x: 0.72, y: 0.30, r: 26, color: '#fffbe8', glow: 'rgba(255,250,220,0.55)' }, fog: 0xb9d2e4, fogNear: 150, fogFar: 850, hemiSky: 0xbdd9ff, hemiGround: 0x51604c, hemiInt: 0.85, sunColor: 0xfff3dd, sunInt: 1.35, amb: 0.32, exposure: 1.02, emissive: 0.12, envInt: 1.0 },
    sunset: { top: '#2a1846', mid: '#83355c', horizon: '#ff9a4a', sun: { x: 0.5, y: 0.475, r: 40, color: '#ffd9a0', glow: 'rgba(255,150,70,0.6)' }, fog: 0xcf8a63, fogNear: 110, fogFar: 700, hemiSky: 0xffc189, hemiGround: 0x3d2b26, hemiInt: 0.66, sunColor: 0xffc98a, sunInt: 1.22, amb: 0.22, exposure: 1.1, emissive: 0.62, envInt: 1.1 },
    night:  { top: '#01040f', mid: '#070d20', horizon: '#131f38', sun: { x: 0.62, y: 0.22, r: 15, color: '#e8eeff', glow: 'rgba(190,210,255,0.35)' }, fog: 0x080d1a, fogNear: 80, fogFar: 520, hemiSky: 0x33508f, hemiGround: 0x05070c, hemiInt: 0.42, sunColor: 0xa9c2ff, sunInt: 0.5, amb: 0.17, exposure: 0.98, emissive: 1.05, envInt: 0.85 },
    rain:   { top: '#3d4a5c', mid: '#5d6d80', horizon: '#8fa3b5', sun: { x: 0.5, y: 0.4, r: 30, color: '#dfe8f0', glow: 'rgba(200,215,230,0.25)' }, fog: 0x6b7d8f, fogNear: 55, fogFar: 420, hemiSky: 0x9fb4c8, hemiGround: 0x2e3a33, hemiInt: 0.72, sunColor: 0xc9d6e2, sunInt: 0.55, amb: 0.30, exposure: 0.95, emissive: 0.55, envInt: 1.25 }
  };

  function buildSky(scene, todId) {
    var p = SKY[todId] || SKY.night;
    var tex = canvasTexture(mkCanvas(64, 512, function (g) {
      var grad = g.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, p.top); grad.addColorStop(0.55, p.mid); grad.addColorStop(0.86, p.horizon); grad.addColorStop(1, p.horizon);
      g.fillStyle = grad; g.fillRect(0, 0, 64, 512);
    }), 1, 1);
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
    scene.add(sky);
    // خورشید / ماه
    var sunCanvas = mkCanvas(128, 128, function (g) {
      var rg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      rg.addColorStop(0, p.sun.color); rg.addColorStop(0.28, p.sun.color); rg.addColorStop(0.29, p.sun.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    });
    var sunTex = new THREE.CanvasTexture(sunCanvas);
    var sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
    var elev = todId === 'sunset' ? 0.06 : todId === 'day' ? 0.42 : 0.38;
    sun.position.set(Math.cos(0.8) * 1400, elev * 1300, Math.sin(0.8) * 1400);
    sun.scale.set(todId === 'sunset' ? 620 : 380, todId === 'sunset' ? 620 : 380, 1);
    scene.add(sun);
    // هالهٔ افق (غروبِ نارنجی / شهرهای شب)
    if (todId !== 'day') {
      var glowTex = canvasTexture(mkCanvas(128, 128, function (g) {
        var rg = g.createRadialGradient(64, 64, 2, 64, 64, 62);
        if (todId === 'sunset') { rg.addColorStop(0, 'rgba(255,166,88,0.95)'); rg.addColorStop(0.4, 'rgba(255,110,70,0.42)'); rg.addColorStop(1, 'rgba(255,90,60,0)'); }
        else { rg.addColorStop(0, 'rgba(96,128,220,0.55)'); rg.addColorStop(0.42, 'rgba(70,80,160,0.28)'); rg.addColorStop(1, 'rgba(60,60,140,0)'); }
        g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      }), 1, 1);
      var horiz = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, opacity: 0.95 }));
      horiz.position.set(Math.cos(0.8) * 1250, todId === 'sunset' ? 30 : 20, Math.sin(0.8) * 1250);
      horiz.scale.set(1500, todId === 'sunset' ? 560 : 420, 1);
      scene.add(horiz);
    }
    // ستاره‌ها در شب
    if (todId === 'night') {
      // لایهٔ جرقه‌های درخشان‌تر روی ستاره‌های ریز
      var sparkGeo = new THREE.BufferGeometry();
      var sparkPos = [];
      var rndS = mulberry32(555777);
      for (var si = 0; si < 70; si++) {
        var stheta = rndS() * Math.PI * 2, sphi = rndS() * Math.PI * 0.35;
        var sr = 1440;
        sparkPos.push(sr * Math.sin(sphi) * Math.cos(stheta), sr * Math.cos(sphi), sr * Math.sin(sphi) * Math.sin(stheta));
      }
      sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparkPos, 3));
      var sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xfff6d8, size: 7, sizeAttenuation: false, fog: false, transparent: true, opacity: 1 }));
      scene.add(sparks);
      var starGeo = new THREE.BufferGeometry();
      var starPos = [];
      var rnd = mulberry32(987654);
      for (var i = 0; i < 420; i++) {
        var theta = rnd() * Math.PI * 2, phi = rnd() * Math.PI * 0.42;
        var r = 1450;
        starPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 3.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
      scene.add(stars);
    }
    // ابرها (روز و غروب)
    if (todId !== 'night') {
      var cloudTex = canvasTexture(mkCanvas(256, 128, function (g) {
        g.clearRect(0, 0, 256, 128);
        for (var i = 0; i < 9; i++) {
          var cx = 30 + Math.random() * 196, cy = 55 + Math.random() * 30, r = 16 + Math.random() * 26;
          var rg = g.createRadialGradient(cx, cy, 2, cx, cy, r);
          var alpha = todId === 'day' ? 0.85 : 0.7;
          rg.addColorStop(0, 'rgba(255,255,255,' + alpha + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        }
      }), 1, 1);
      var rnd2 = mulberry32(1234);
      for (var ci = 0; ci < 9; ci++) {
        var cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: todId === 'sunset' ? 0xffc9a3 : 0xffffff, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
        var ang = rnd2() * Math.PI * 2;
        cloud.position.set(Math.cos(ang) * 950, 190 + rnd2() * 130, Math.sin(ang) * 950);
        cloud.scale.set(260 + rnd2() * 180, 110 + rnd2() * 70, 1);
        scene.add(cloud);
      }
    }
    return p;
  }

  /* نور محیط برای بازتاب بدنهٔ ماشین (PMREM از یک صحنهٔ کوچک) */
  function makeEnvironment(renderer, todId) {
    var p = SKY[todId] || SKY.night;
    var envScene = new THREE.Scene();
    var skyGeo = new THREE.SphereGeometry(50, 16, 12);
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.top), side: THREE.BackSide })));
    var ground = new THREE.Mesh(new THREE.CircleGeometry(50, 16), new THREE.MeshBasicMaterial({ color: 0x1c1c1f }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -4; envScene.add(ground);
    var sunBall = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), new THREE.MeshBasicMaterial({ color: p.sun.color }));
    sunBall.position.set(20, 22, -15); envScene.add(sunBall);
    var strip = new THREE.Mesh(new THREE.BoxGeometry(30, 1.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strip.position.set(-12, 6, 10); envScene.add(strip);
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envMap = pmrem.fromScene(envScene, 0.06).texture;
    pmrem.dispose();
    skyGeo.dispose(); ground.geometry.dispose(); sunBall.geometry.dispose(); strip.geometry.dispose();
    return envMap;
  }

  /* ---------- بافت ساختمان‌ها ---------- */
  function buildingTexturePair(variant, rand) {
    var W = 128, H = 256;
    var baseColors = ['#2b303c', '#332f2b', '#232a34', '#2e3330'];
    var base = baseColors[variant % baseColors.length];
    var map = mkCanvas(W, H, function (g) {
      g.fillStyle = base; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, W, 10);
      for (var r = 0; r < 16; r++) {
        for (var c = 0; c < 6; c++) {
          var lit = rand() < 0.42;
          g.fillStyle = lit ? '#ffd9a0' : '#141821';
          g.fillRect(8 + c * 20, 12 + r * 15, 12, 8);
        }
      }
    });
    var rand2 = mulberry32(rand() * 1e9);
    var emissive = mkCanvas(W, H, function (g) {
      g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
      for (var r = 0; r < 16; r++) {
        for (var c = 0; c < 6; c++) {
          var lit = rand2() < 0.42;
          if (lit) { g.fillStyle = '#ffc978'; g.fillRect(8 + c * 20, 12 + r * 15, 12, 8); }
        }
      }
    });
    return { map: canvasTexture(map, 1, 1), emissive: canvasTexture(emissive, 1, 1) };
  }

  /* ---------- المان‌های شهری ---------- */
  var NEON_WORDS = [['TURBO', '#00e5ff'], ['NITRO', '#ff2fd6'], ['SPEED', '#7CFC00'], ['RACING', '#ffb703'], ['V8', '#ff5d5d'], ['DRIFT', '#00ffa3'], ['شتاب', '#00e5ff'], ['پترو', '#ffa200'], ['GAS', '#e8e8e8'], ['OCTANE', '#9d4edd']];

  function placeCity(scene, trackDef, samples, halfW, rng, todP, colliders) {
    var bbox = trackDef.points.reduce(function (bb, p) {
      return { minX: Math.min(bb.minX, p[0]), maxX: Math.max(bb.maxX, p[0]), minZ: Math.min(bb.minZ, p[2]), maxZ: Math.max(bb.maxZ, p[2]) };
    }, { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 });
    var bTex = [buildingTexturePair(0, mulberry32(11)), buildingTexturePair(1, mulberry32(22)), buildingTexturePair(3, mulberry32(33))];
    var placed = 0, attempts = 0;
    while (placed < 105 && attempts < 900) {
      attempts++;
      var w = 10 + rng() * 17, d = 10 + rng() * 17, h = 9 + Math.pow(rng(), 1.6) * 58;
      if (rng() < 0.10) h = 55 + rng() * 35; // برجک
      var x = bbox.minX - 35 + rng() * (bbox.maxX - bbox.minX + 70);
      var z = bbox.minZ - 35 + rng() * (bbox.maxZ - bbox.minZ + 70);
      var minD = Infinity;
      for (var i = 0; i < samples.length; i += 3) {
        var dx = samples[i].pos.x - x, dz = samples[i].pos.z - z;
        var dd = Math.sqrt(dx * dx + dz * dz) - Math.max(w, d) * 0.72;
        if (dd < minD) minD = dd;
      }
      if (minD < halfW + 5.2) continue;
      var t = bTex[Math.floor(rng() * 3)];
      var mat = new THREE.MeshStandardMaterial({
        map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: todP.emissive,
        roughness: 0.85, metalness: 0.12
      });
      var box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      box.position.set(x, h / 2 - 0.05, z);
      box.rotation.y = Math.floor(rng() * 4) * Math.PI / 2;
      box.castShadow = true; box.receiveShadow = true;
      scene.add(box);
      if (h > 52) { // چراغ قرمز برج
        var beacon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 2.4 }));
        beacon.position.set(x, h + 0.4, z);
        scene.add(beacon);
      }
      if (h > 26) { // نوار نئون لبه‌بام روی برج‌های بلند
        var NEON_EDGE = [0x00e5ff, 0xff2fd6, 0xffb703, 0x00ffa3, 0x9d4edd];
        var edgeColor = NEON_EDGE[Math.floor(rng() * NEON_EDGE.length)];
        var edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.32, d + 0.35),
          new THREE.MeshStandardMaterial({ color: 0x050505, emissive: edgeColor, emissiveIntensity: todP.emissive * 1.7, roughness: 0.6 }));
        edge.position.set(x, h + 0.08, z);
        edge.rotation.y = box.rotation.y;
        scene.add(edge);
      }
      colliders.push({ x: x, z: z, r: Math.max(w, d) * 0.68 });
      placed++;
    }
    /* حلقهٔ دوردست از برج‌های سیلوئتی */
    var farMat = new THREE.MeshStandardMaterial({ color: 0x141a26, roughness: 1 });
    for (var f = 0; f < 42; f++) {
      var ang = rng() * Math.PI * 2, dist = 130 + rng() * 120;
      var cx2 = (bbox.minX + bbox.maxX) / 2 + Math.cos(ang) * dist, cz2 = (bbox.minZ + bbox.maxZ) / 2 + Math.sin(ang) * dist;
      var fh = 26 + rng() * 65;
      var far = new THREE.Mesh(new THREE.BoxGeometry(16 + rng() * 22, fh, 16 + rng() * 22), farMat);
      far.position.set(cx2, fh / 2, cz2);
      scene.add(far);
    }
    /* تابلوهای نئون کنار جاده */
    var neonTex = {};
    NEON_WORDS.forEach(function (nw) {
      var word = nw[0], color = nw[1];
      neonTex[word] = canvasTexture(mkCanvas(256, 128, function (g) {
        g.fillStyle = '#07070c'; g.fillRect(0, 0, 256, 128);
        g.strokeStyle = color; g.lineWidth = 5; g.shadowColor = color; g.shadowBlur = 26;
        g.strokeRect(10, 10, 236, 108);
        g.fillStyle = color; g.font = 'bold 54px Tahoma, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(word, 128, 68);
      }), 1, 1);
    });
    for (var sIdx = 60, sideT = 1; sIdx < samples.length; sIdx += 34, sideT *= -1) {
      var smp = samples[sIdx];
      var px = smp.pos.x + smp.side.x * sideT * (halfW + 2.6);
      var pz = smp.pos.z + smp.side.z * sideT * (halfW + 2.6);
      var py = (smp.pos.y || 0);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.6, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6, metalness: 0.5 }));
      pole.position.set(px, py + 2.3, pz);
      scene.add(pole);
      var word2 = NEON_WORDS[Math.floor(rng() * NEON_WORDS.length)];
      var panel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.14),
        new THREE.MeshStandardMaterial({ map: neonTex[word2[0]], emissive: 0xffffff, emissiveMap: neonTex[word2[0]], emissiveIntensity: todP.emissive * 1.35, roughness: 0.4 }));
      panel.position.set(px, py + 5.0, pz);
      panel.rotation.y = Math.atan2(smp.side.x * sideT, smp.side.z * sideT) + Math.PI;
      scene.add(panel);
      colliders.push({ x: px, z: pz, r: 0.6 });
    }
    /* چراغ‌های خیابانی */
    var headMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe9b0, emissiveIntensity: todP.emissive * 2.1 });
    var poolTex = canvasTexture(mkCanvas(64, 64, function (g) {
      var rg = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      rg.addColorStop(0, 'rgba(255,230,160,0.55)'); rg.addColorStop(1, 'rgba(255,230,160,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    }), 1, 1);
    for (var lIdx = 20, sideL = 1; lIdx < samples.length; lIdx += 17, sideL *= -1) {
      var ls = samples[lIdx];
      var lx = ls.pos.x + ls.side.x * sideL * (halfW + 1.15);
      var lz = ls.pos.z + ls.side.z * sideL * (halfW + 1.15);
      var ly = ls.pos.y || 0;
      var lpole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.3, 7), new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.5, metalness: 0.6 }));
      lpole.position.set(lx, ly + 2.65, lz);
      scene.add(lpole);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1.7), lpole.material);
      var armAng = Math.atan2(-ls.side.x * sideL, -ls.side.z * sideL);
      arm.position.set(lx - ls.side.x * sideL * 0.75, ly + 5.25, lz - ls.side.z * sideL * 0.75);
      arm.rotation.y = armAng;
      scene.add(arm);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.10, 0.72), headMat);
      head.position.set(lx - ls.side.x * sideL * 1.45, ly + 5.18, lz - ls.side.z * sideL * 1.45);
      head.rotation.y = armAng;
      scene.add(head);
      if (todP.emissive > 0.5) { // حوضچهٔ نور روی جاده — فقط شب و غروب
        var pool = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 7.6),
          new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(lx - ls.side.x * sideL * 1.45, ly + 0.035, lz - ls.side.z * sideL * 1.45);
        scene.add(pool);
      }
      colliders.push({ x: lx, z: lz, r: 0.32 });
    }
  }

  /* ---------- المان‌های کویری بزرگراه ---------- */
  function placeDesert(scene, trackDef, samples, halfW, rng, todP, colliders) {
    var bbox = trackDef.points.reduce(function (bb, p) {
      return { minX: Math.min(bb.minX, p[0]), maxX: Math.max(bb.maxX, p[0]), minZ: Math.min(bb.minZ, p[2]), maxZ: Math.max(bb.maxZ, p[2]) };
    }, { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 });
    /* مزاهای دوردست */
    var mesaMat = new THREE.MeshStandardMaterial({ color: 0x6e4632, roughness: 1 });
    var mesaMat2 = new THREE.MeshStandardMaterial({ color: 0x7d5340, roughness: 1 });
    for (var m = 0; m < 16; m++) {
      var ang = rng() * Math.PI * 2, dist = 180 + rng() * 260;
      var mx = (bbox.minX + bbox.maxX) / 2 + Math.cos(ang) * dist, mz = (bbox.minZ + bbox.maxZ) / 2 + Math.sin(ang) * dist;
      var mesa = new THREE.Mesh(new THREE.CylinderGeometry(14 + rng() * 22, 18 + rng() * 28, 10 + rng() * 24, 9), rng() < 0.5 ? mesaMat : mesaMat2);
      mesa.position.set(mx, mesa.geometry.parameters.height / 2 - 0.5, mz);
      scene.add(mesa);
    }
    /* بیلبوردها */
    var ads = [['NITRO COLA', 'طعم واقعی سرعت', '#ff2fd6'], ['ARAZ MOTOR', 'نمایندگی رسمی', '#00e5ff'], ['SPEED OIL', 'روغن مسابقه‌ای', '#ffb703'], ['NIRO FM', '۹۳.۵ تهران', '#7CFC00'], ['PETROFLY', 'بنزین سوپر', '#ff6b35'], ['TURBO TYRES', 'لاسیتک اسلیک', '#9d4edd']];
    var adTex = ads.map(function (ad) {
      var tex = canvasTexture(mkCanvas(512, 256, function (g) {
        var grad = g.createLinearGradient(0, 0, 512, 256);
        grad.addColorStop(0, '#0b0b12'); grad.addColorStop(1, '#1c1030');
        g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
        g.strokeStyle = ad[2]; g.lineWidth = 10; g.shadowColor = ad[2]; g.shadowBlur = 30;
        g.strokeRect(14, 14, 484, 228);
        g.fillStyle = ad[2]; g.font = 'bold 74px Tahoma'; g.textAlign = 'center';
        g.fillText(ad[0], 256, 118);
        g.fillStyle = '#f0f0f0'; g.font = '30px Tahoma'; g.shadowBlur = 6;
        g.fillText(ad[1], 256, 190);
      }), 1, 1);
      return tex;
    });
    var adPole = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.55, metalness: 0.6 });
    for (var i = 40, sideT = 1, adIdx = 0; i < samples.length; i += 26, sideT *= -1, adIdx++) {
      var s = samples[i];
      var px = s.pos.x + s.side.x * sideT * (halfW + 3.4);
      var pz = s.pos.z + s.side.z * sideT * (halfW + 3.4);
      var py = s.pos.y || 0;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 6.4, 8), adPole);
      pole.position.set(px, py + 3.2, pz);
      scene.add(pole);
      var board = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.6, 0.22),
        new THREE.MeshStandardMaterial({ map: adTex[adIdx % adTex.length], emissive: 0xffffff, emissiveMap: adTex[adIdx % adTex.length], emissiveIntensity: Math.max(0.35, todP.emissive * 0.9), roughness: 0.5 }));
      board.position.set(px, py + 7.2, pz);
      board.rotation.y = Math.atan2(s.side.x * sideT, s.side.z * sideT) + Math.PI;
      scene.add(board);
      colliders.push({ x: px, z: pz, r: 0.7 });
    }
    /* بوته‌های خشک */
    var bushMat = new THREE.MeshStandardMaterial({ color: 0x4d3d24, roughness: 1 });
    for (var bI = 0; bI < 90; bI++) {
      var bx = bbox.minX - 30 + rng() * (bbox.maxX - bbox.minX + 60);
      var bz = bbox.minZ - 30 + rng() * (bbox.maxZ - bbox.minZ + 60);
      var ok = true;
      for (var j = 0; j < samples.length; j += 3) {
        var dx = samples[j].pos.x - bx, dz = samples[j].pos.z - bz;
        if (dx * dx + dz * dz < (halfW + 2) * (halfW + 2)) { ok = false; break; }
      }
      if (!ok) continue;
      var bush = new THREE.Mesh(new THREE.SphereGeometry(0.5 + rng() * 0.7, 7, 6), bushMat);
      bush.scale.y = 0.62;
      bush.position.set(bx, 0.25, bz);
      scene.add(bush);
    }
    /* میله‌های بازتابنده */
    var reflMat = new THREE.MeshStandardMaterial({ color: 0xdadada, emissive: 0xffffff, emissiveIntensity: 0.55 });
    var postGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12);
    for (var pI = 10; pI < samples.length; pI += 17) {
      var ps = samples[pI];
      [-1, 1].forEach(function (sd) {
        var post = new THREE.Mesh(postGeo, reflMat);
        post.position.set(ps.pos.x + ps.side.x * sd * (halfW + 0.7), (ps.pos.y || 0) + 0.45, ps.pos.z + ps.side.z * sd * (halfW + 0.7));
        scene.add(post);
      });
    }
  }

  /* ---------- المان‌های کوهستانی ---------- */
  function placeMountain(scene, trackDef, samples, halfW, rng, todP, colliders) {
    var bbox = trackDef.points.reduce(function (bb, p) {
      return { minX: Math.min(bb.minX, p[0]), maxX: Math.max(bb.maxX, p[0]), minZ: Math.min(bb.minZ, p[2]), maxZ: Math.max(bb.maxZ, p[2]), maxY: Math.max(bb.maxY || 0, p[1] || 0) };
    }, { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, maxY: 0 });
    /* کوه‌های دوردست (مخروط‌های بزرگ) */
    var mtnMat = new THREE.MeshStandardMaterial({ color: 0x3e4750, roughness: 1, flatShading: true });
    var snowMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.9, flatShading: true });
    for (var m = 0; m < 22; m++) {
      var ang = rng() * Math.PI * 2, dist = 190 + rng() * 380;
      var mx = (bbox.minX + bbox.maxX) / 2 + Math.cos(ang) * dist, mz = (bbox.minZ + bbox.maxZ) / 2 + Math.sin(ang) * dist;
      var mh = 60 + rng() * 130;
      var mtn = new THREE.Mesh(new THREE.ConeGeometry(45 + rng() * 55, mh, 7), rng() < 0.4 ? snowMat : mtnMat);
      mtn.position.set(mx, mh / 2 - 42, mz);
      scene.add(mtn);
    }
    /* صخره‌ها */
    var rockMat = new THREE.MeshStandardMaterial({ color: 0x59616b, roughness: 1, flatShading: true });
    var rockMatLight = new THREE.MeshStandardMaterial({ color: 0x7c858f, roughness: 1, flatShading: true });
    for (var r = 0; r < 85; r++) {
      var side = rng() < 0.5 ? 1 : -1;
      var idx = Math.floor(rng() * samples.length);
      var s = samples[idx];
      var dist = halfW + 2.5 + Math.pow(rng(), 1.5) * 42;
      var rx = s.pos.x + s.side.x * side * dist + (rng() - 0.5) * 8;
      var rz = s.pos.z + s.side.z * side * dist + (rng() - 0.5) * 8;
      var sc = 0.7 + Math.pow(rng(), 2) * 4.2;
      var groundY = mountainHeightAt(rx, rz, samples, halfW);
      var rock = new THREE.Mesh(new THREE.IcosahedronGeometry(sc, 0), (s.pos.y || 0) > 14 ? rockMatLight : rockMat);
      rock.position.set(rx, groundY + sc * 0.25, rz);
      rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      rock.castShadow = sc > 1.6;
      scene.add(rock);
      if (dist < halfW + 7) colliders.push({ x: rx, z: rz, r: sc * 0.78 });
    }
    /* کاج‌ها */
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
    var pineMat = new THREE.MeshStandardMaterial({ color: 0x1d3a26, roughness: 0.95, flatShading: true });
    var pineMat2 = new THREE.MeshStandardMaterial({ color: 0x274a2e, roughness: 0.95, flatShading: true });
    for (var t = 0; t < 120; t++) {
      var side2 = rng() < 0.5 ? 1 : -1;
      var idx2 = Math.floor(rng() * samples.length);
      var s2 = samples[idx2];
      var dist2 = halfW + 3.4 + Math.pow(rng(), 1.4) * 55;
      var tx = s2.pos.x + s2.side.x * side2 * dist2 + (rng() - 0.5) * 10;
      var tz = s2.pos.z + s2.side.z * side2 * dist2 + (rng() - 0.5) * 10;
      var th = 1.6 + rng() * 2.6;
      var ty = mountainHeightAt(tx, tz, samples, halfW); // کف زمیتِ واقعی، نه ارتفاع جاده
      // کف جاده از ارتفاع نمونه حدس زده می‌شود؛ کمی پایین‌تر تا در شیب بشیند
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * th * 0.4, 0.14 * th * 0.4, th * 0.42, 6), trunkMat);
      trunk.position.set(tx, ty + th * 0.21, tz);
      scene.add(trunk);
      var cone1 = new THREE.Mesh(new THREE.ConeGeometry(th * 0.42, th * 0.95, 8), rng() < 0.5 ? pineMat : pineMat2);
      cone1.position.set(tx, ty + th * 0.42 + th * 0.42, tz);
      cone1.castShadow = true;
      scene.add(cone1);
      var cone2 = new THREE.Mesh(new THREE.ConeGeometry(th * 0.27, th * 0.66, 8), pineMat);
      cone2.position.set(tx, ty + th * 0.42 + th * 0.78, tz);
      scene.add(cone2);
      if (dist2 < halfW + 6) colliders.push({ x: tx, z: tz, r: 0.45 });
    }
    /* میله‌های برفی قرمز/سفید روی بخش‌های مرتفع */
    var stripeTex = canvasTexture(mkCanvas(16, 64, function (g) {
      g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 16, 64);
      g.fillStyle = '#d1342c';
      g.fillRect(0, 6, 16, 10); g.fillRect(0, 30, 16, 10); g.fillRect(0, 54, 16, 8);
    }), 1, 1);
    var poleMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: stripeTex, emissiveIntensity: 0.18 });
    var poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.15, 6);
    for (var p = 0; p < samples.length; p += 9) {
      var sp = samples[p];
      if ((sp.pos.y || 0) < 12) continue;
      [-1, 1].forEach(function (sd) {
        var poleM = new THREE.Mesh(poleGeo, poleMat);
        poleM.position.set(sp.pos.x + sp.side.x * sd * (halfW + 0.55), (sp.pos.y || 0) + 0.57, sp.pos.z + sp.side.z * sd * (halfW + 0.55));
        scene.add(poleM);
      });
    }
    /* تابلوهای هشدار پیچ */
    var chevTex = canvasTexture(mkCanvas(128, 64, function (g) {
      g.fillStyle = '#ffcf33'; g.fillRect(0, 0, 128, 64);
      g.fillStyle = '#111';
      for (var i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(14 + i * 40, 8); g.lineTo(34 + i * 40, 32); g.lineTo(14 + i * 40, 56); g.lineTo(24 + i * 40, 32); g.closePath(); g.fill();
      }
    }), 1, 1);
    var chevMat = new THREE.MeshStandardMaterial({ map: chevTex, emissive: 0xffffff, emissiveMap: chevTex, emissiveIntensity: 0.35 });
    var chevGeo = new THREE.PlaneGeometry(1.5, 0.75);
    for (var cI = 30; cI < samples.length; cI += 52) {
      var cs = samples[cI];
      var turn = cs.tangent.clone().cross(samples[(cI + 4) % samples.length].tangent).y;
      if (Math.abs(turn) < 0.06) continue;
      var chev = new THREE.Mesh(chevGeo, chevMat);
      var cside = turn > 0 ? 1 : -1;
      chev.position.set(cs.pos.x + cs.side.x * cside * (halfW + 0.9), (cs.pos.y || 0) + 1.15, cs.pos.z + cs.side.z * cside * (halfW + 0.9));
      chev.rotation.y = Math.atan2(-cs.side.x * cside, -cs.side.z * cside);
      scene.add(chev);
    }
  }

  /* ---------- زمین ---------- */
  function buildGround(scene, env, maxExtent) {
    var colors = { city: 0x1f2228, desert: 0x8a6b45, mountain: 0x41543a };
    var geo = new THREE.CircleGeometry(maxExtent + 900, 48);
    var mat = new THREE.MeshStandardMaterial({ color: colors[env] || 0x222222, roughness: 1 });
    var ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  /* ارتفاع شبه‌نویز قطعی برای دامنه‌ها */
  function pseudoNoise(x, z) {
    return Math.sin(x * 0.021 + Math.sin(z * 0.017) * 2.1) * Math.cos(z * 0.019 + Math.cos(x * 0.015) * 1.7)
         + 0.5 * Math.sin(x * 0.043 + z * 0.037)
         + 0.3 * Math.sin(x * 0.008 - z * 0.011 + 1.3);
  }
  function smoothstep(e0, e1, x) {
    var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  /* ارتفاع دقیق زمین کوهستانی در نقطهٔ (x,z) — همان فرمول مشٔ زمین تا اجسام روی سطح بشینند */
  function mountainHeightAt(x, z, samples, halfW) {
    var sumW = 0, sumH = 0, best = Infinity;
    for (var j = 0; j < samples.length; j += 2) {
      var dx = samples[j].pos.x - x, dz = samples[j].pos.z - z;
      var d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
      var w = 1 / (d2 + 1);
      sumW += w; sumH += (samples[j].pos.y || 0) * w;
    }
    var hRoad = sumH / sumW;
    var d = Math.sqrt(best);
    var n = pseudoNoise(x, z) * 0.5 + 0.5;
    var t = smoothstep(halfW + 2.3, halfW + 38, d);
    if (d < halfW + 2.3) return hRoad - 0.22;
    return hRoad - 0.22 + t * (4.5 + n * 15 + d * 0.055);
  }

  /* زمین بلند‌شدنی برای مسیر کوهستانی: دامنه‌هایی که کنار جاده سر‌به‌آسمان می‌کشند */
  function buildHeightfield(scene, samples, halfW) {
    var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    samples.forEach(function (s) {
      minX = Math.min(minX, s.pos.x); maxX = Math.max(maxX, s.pos.x);
      minZ = Math.min(minZ, s.pos.z); maxZ = Math.max(maxZ, s.pos.z);
    });
    var margin = 230;
    var W = (maxX - minX) + margin * 2, D = (maxZ - minZ) + margin * 2;
    var cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    var SX = 84, SZ = 84;
    var geo = new THREE.PlaneGeometry(W, D, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(cx, 0, cz);
    var posAttr = geo.attributes.position;
    var colors = new Float32Array(posAttr.count * 3);
    var grass = new THREE.Color(0x41543a), rock = new THREE.Color(0x59616b), snow = new THREE.Color(0xdfe5ec), dirt = new THREE.Color(0x4f4a3a);
    var tmp = new THREE.Color();
    for (var i = 0; i < posAttr.count; i++) {
      var x = posAttr.getX(i), z = posAttr.getZ(i);
      // ارتفاع زمین از همان تابع مشترک تا اجسام و مش هماهنگ باشند
      var d2min = Infinity;
      for (var j2 = 0; j2 < samples.length; j2 += 2) {
        var ddx = samples[j2].pos.x - x, ddz = samples[j2].pos.z - z;
        var dd2 = ddx * ddx + ddz * ddz;
        if (dd2 < d2min) d2min = dd2;
      }
      var d = Math.sqrt(d2min);
      var y = mountainHeightAt(x, z, samples, halfW);
      var t = smoothstep(halfW + 2.3, halfW + 38, d); // برای رنگ‌بندی دامنه‌ها
      posAttr.setY(i, y);
      // رنگ: خاک کنار جاده → چمن → سنگ → برف
      if (t < 0.08) tmp.copy(dirt);
      else if (y > 19) tmp.copy(snow).lerp(rock, Math.min(1, (26 - y) * 0.12));
      else if (t > 0.45 || y > 12) tmp.copy(rock).lerp(grass, Math.max(0, 1 - (t - 0.45) * 2.2));
      else tmp.copy(grass).lerp(rock, t * 0.7);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }


  /* ---------- باران ---------- */
  var rainPoints = null, rainVel = null;
  function buildRain(scene) {
    var N = 2600;
    var pos = new Float32Array(N * 3);
    rainVel = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      pos[i*3] = (Math.random()-0.5)*120;
      pos[i*3+1] = Math.random()*45;
      pos[i*3+2] = (Math.random()-0.5)*120;
      rainVel[i] = 18 + Math.random()*14;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({ color: 0xbdd7ee, size: 0.14, transparent: true, opacity: 0.65, sizeAttenuation: true });
    rainPoints = new THREE.Points(geo, mat);
    rainPoints.frustumCulled = false;
    scene.add(rainPoints);
    return rainPoints;
  }
  function updateRain(dt, center) {
    if (!rainPoints) return;
    var pos = rainPoints.geometry.attributes.position;
    var arr = pos.array;
    for (var i = 0; i < rainVel.length; i++) {
      arr[i*3+1] -= rainVel[i] * dt;
      arr[i*3] += 2.2 * dt; // باد ملایم
      if (arr[i*3+1] < 0) {
        arr[i*3+1] = 38 + Math.random()*8;
        arr[i*3] = center.x + (Math.random()-0.5)*120;
        arr[i*3+2] = center.z + (Math.random()-0.5)*120;
      }
    }
    pos.needsUpdate = true;
    rainPoints.position.set(center.x, 0, center.z);
  }

  /* ---------- درختان و فضای سبز شهری + تابلوهای راهنمایی ---------- */
  function placeGreenery(scene, samples, halfW, rng, colliders) {
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1 });
    var leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.95, flatShading: true });
    var leafMat2 = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.95, flatShading: true });
    var trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 2.2, 7);
    var crownGeo = new THREE.IcosahedronGeometry(1.5, 1);
    for (var i = 14; i < samples.length; i += 11) {
      var s = samples[i];
      var side = (i % 22 < 11) ? 1 : -1;
      var dist = halfW + 3.2 + rng()*2.2;
      var x = s.pos.x + s.side.x*side*dist, z = s.pos.z + s.side.z*side*dist;
      var y = s.pos.y || 0;
      var trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, y+1.1, z);
      trunk.scale.setScalar(0.8+rng()*0.7);
      scene.add(trunk);
      var crown = new THREE.Mesh(crownGeo, rng()<0.5?leafMat:leafMat2);
      crown.position.set(x, y+2.9+rng()*0.8, z);
      crown.scale.set(1+rng()*0.8, 0.85+rng()*0.5, 1+rng()*0.8);
      crown.castShadow = true;
      scene.add(crown);
      colliders.push({x:x, z:z, r:0.5});
    }
    // تابلوهای راهنمایی (سرعت / جهت)
    var signTex = canvasTexture(mkCanvas(128,128,function(g){
      g.fillStyle='#0b3d91'; g.fillRect(0,0,128,128);
      g.strokeStyle='#fff'; g.lineWidth=6; g.strokeRect(6,6,116,116);
      g.fillStyle='#fff'; g.font='bold 44px Tahoma'; g.textAlign='center';
      g.fillText('60',64,58); g.font='bold 20px Tahoma'; g.fillText('km/h',64,92);
    }),1,1);
    var signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 });
    var poleMat2 = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.7, roughness: 0.4 });
    for (var j = 30; j < samples.length; j += 55) {
      var s2 = samples[j];
      var sd = (j % 110 < 55) ? 1 : -1;
      var sx = s2.pos.x + s2.side.x*sd*(halfW+1.4), sz = s2.pos.z + s2.side.z*sd*(halfW+1.4);
      var sy = s2.pos.y || 0;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.6,6), poleMat2);
      pole.position.set(sx, sy+1.3, sz); scene.add(pole);
      var sign = new THREE.Mesh(new THREE.BoxGeometry(1.0,1.0,0.06), signMat);
      sign.position.set(sx, sy+2.7, sz);
      sign.rotation.y = Math.atan2(-s2.side.x*sd, -s2.side.z*sd);
      scene.add(sign);
      colliders.push({x:sx, z:sz, r:0.3});
    }
  }

  /* ============================================================
     buildRaceWorld — ورودی اصلی
     ============================================================ */
  function buildRaceWorld(scene, renderer, trackDef, todId) {
    buildSharedTextures();
    var todP = SKY[todId] || SKY.night;
    var colliders = [];
    var rng = mulberry32(hashStr(trackDef.id + ':' + todId));

    /* نمونه‌ها + منحنی */
    var sampled = sampleTrack(trackDef);
    var samples = sampled.samples;
    var halfW = trackDef.halfWidth;
    var maxExtent = 0;
    samples.forEach(function (s) { maxExtent = Math.max(maxExtent, Math.abs(s.pos.x), Math.abs(s.pos.z)); });

    /* آسمان و نور */
    buildSky(scene, todId);
    scene.fog = new THREE.Fog(todP.fog, todP.fogNear, todP.fogFar);
    var hemi = new THREE.HemisphereLight(todP.hemiSky, todP.hemiGround, todP.hemiInt);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(todP.sunColor, todP.sunInt);
    var sunDir = todId === 'sunset' ? new THREE.Vector3(-0.55, 0.38, -0.74) : todId === 'day' ? new THREE.Vector3(0.45, 0.85, 0.3) : todId === 'rain' ? new THREE.Vector3(0.3, 0.55, 0.2) : new THREE.Vector3(0.35, 0.8, 0.35);
    sun.position.copy(sunDir).multiplyScalar(160);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(sun.target);
    scene.add(new THREE.AmbientLight(0xffffff, todP.amb));

    /* بازتاب بدنه */
    var envMap = makeEnvironment(renderer, todId);
    scene.environment = envMap;

    /* زمین و جاده */
    if (trackDef.env === 'mountain') buildHeightfield(scene, samples, halfW);
    else buildGround(scene, trackDef.env, maxExtent);
    var wetRoad = todP.emissive > 0.5 || todId === 'rain';
    var roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: wetRoad ? 0.38 : 0.94, metalness: wetRoad ? 0.32 : 0.02, envMapIntensity: wetRoad ? 1.5 : 1.0 });
    var road = buildRibbon(samples, null, function () { return halfW; }, 7, roadMat, 0.0);
    scene.add(road);

    /* حاشیه‌ها */
    if (trackDef.env === 'city') {
      var walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.96 });
      [1, -1].forEach(function (sd) {
        var walk = buildRibbonOffset(samples, halfW + 0.18, halfW + 2.6, sd, walkMat, 0.088);
        walk.receiveShadow = true;
        scene.add(walk);
      });
    } else {
      /* شولدر شن/سنگ */
      var shMat = new THREE.MeshStandardMaterial({ color: trackDef.env === 'desert' ? 0x7a5c38 : 0x4b5541, roughness: 1 });
      [1, -1].forEach(function (sd) {
        var sh = buildRibbonOffset(samples, halfW + 0.01, halfW + 1.7, sd, shMat, 0.012);
        scene.add(sh);
      });
      /* گاردریل */
      var railTex = canvasTexture(mkCanvas(128, 32, function (g) {
        g.fillStyle = trackDef.env === 'desert' ? '#c8c8cc' : '#e8e8ea'; g.fillRect(0, 0, 128, 32);
        if (trackDef.env === 'mountain') { g.fillStyle = '#c1121f'; for (var x = 0; x < 4; x++) g.fillRect(x * 32, 0, 14, 32); }
        else { g.fillStyle = '#8a8a90'; g.fillRect(0, 12, 128, 8); }
      }), 1, 1);
      var railMat = new THREE.MeshStandardMaterial({ map: railTex, roughness: 0.35, metalness: 0.75, side: THREE.DoubleSide });
      [1, -1].forEach(function (sd) {
        var rail = buildGuardRail(samples, sd, halfW + 1.15, 0.34, 0.78, railMat);
        scene.add(rail);
      });
      /* پایه‌های گاردریل */
      var postGeo2 = new THREE.BoxGeometry(0.16, 0.78, 0.16);
      var postMat2 = new THREE.MeshStandardMaterial({ color: 0x54575e, roughness: 0.6, metalness: 0.6 });
      for (var rp = 0; rp < samples.length; rp += 6) {
        [1, -1].forEach(function (sd) {
          var s = samples[rp];
          var post = new THREE.Mesh(postGeo2, postMat2);
          post.position.set(s.pos.x + s.side.x * sd * (halfW + 1.15), (s.pos.y || 0) + 0.39, s.pos.z + s.side.z * sd * (halfW + 1.15));
          scene.add(post);
        });
      }
    }

    /* خط شروع + دروازه */
    (function buildGantry() {
      var s0 = samples[0];
      var y0 = s0.pos.y || 0;
      var ang = Math.atan2(s0.tangent.x, s0.tangent.z);
      var checker = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, 1.35),
        new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.8 }));
      checker.rotation.order = 'YXZ';
      checker.rotation.y = ang;
      checker.rotation.x = -Math.PI / 2;
      checker.position.set(s0.pos.x, y0 + 0.03, s0.pos.z);
      scene.add(checker);
      var postMat = new THREE.MeshStandardMaterial({ color: 0x141419, roughness: 0.4, metalness: 0.7 });
      var postGeo = new THREE.CylinderGeometry(0.28, 0.34, 5.6, 12);
      [1, -1].forEach(function (sd) {
        var post = new THREE.Mesh(postGeo, postMat);
        post.position.set(s0.pos.x + s0.side.x * sd * (halfW + 0.9), y0 + 2.8, s0.pos.z + s0.side.z * sd * (halfW + 0.9));
        post.castShadow = true;
        scene.add(post);
      });
      var gantryTex = canvasTexture(mkCanvas(512, 96, function (g) {
        g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 512, 96);
        g.strokeStyle = '#00e5ff'; g.lineWidth = 6; g.shadowColor = '#00e5ff'; g.shadowBlur = 22;
        g.strokeRect(6, 6, 500, 84);
        g.fillStyle = '#00e5ff'; g.font = 'bold 52px Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(trackDef.en, 256, 52);
      }), 1, 1);
      var beam = new THREE.Mesh(new THREE.BoxGeometry((halfW + 0.9) * 2 + 0.6, 1.15, 0.32),
        new THREE.MeshStandardMaterial({ map: gantryTex, emissive: 0xffffff, emissiveMap: gantryTex, emissiveIntensity: 1.5 }));
      beam.position.set(s0.pos.x, y0 + 5.15, s0.pos.z);
      beam.rotation.y = ang;
      scene.add(beam);
    })();

    /* محتوای هر محیط */
    if (trackDef.env === 'city') { placeCity(scene, trackDef, samples, halfW, rng, todP, colliders); placeGreenery(scene, samples, halfW, rng, colliders); }
    else if (trackDef.env === 'desert') placeDesert(scene, trackDef, samples, halfW, rng, todP, colliders);
    else placeMountain(scene, trackDef, samples, halfW, rng, todP, colliders);

    /* موقعیت‌های شروع (۸ ماشین، دو ردیف) */
    var startGrid = [];
    var backOffset = 7;
    for (var gIdx = 0; gIdx < 8; gIdx++) {
      var row = Math.floor(gIdx / 2), col = gIdx % 2;
      var back = backOffset + row * 5.2;
      var lat = col === 0 ? -halfW * 0.45 : halfW * 0.45;
      // با عقب‌رفتن روی نمونه‌ها به‌اندازهٔ فاصلهٔ موردنظر
      var dist = 0, cursor = 0;
      while (dist < back) {
        var a = samples[cursor].pos, b = samples[(cursor - 1 + samples.length) % samples.length].pos;
        dist += a.distanceTo(b);
        cursor = (cursor - 1 + samples.length) % samples.length;
        if (cursor === 0) break;
      }
      var gs = samples[cursor];
      var gx = gs.pos.x + gs.side.x * lat, gz = gs.pos.z + gs.side.z * lat;
      startGrid.push({
        pos: new THREE.Vector3(gx, gs.pos.y || 0, gz),
        yaw: Math.atan2(gs.tangent.x, gs.tangent.z),
        index: cursor
      });
    }

    var rainObj = (todId === 'rain') ? buildRain(scene) : null;
    return {
      rain: rainObj,
      curve: sampled.curve,
      samples: samples,
      length: sampled.length,
      halfWidth: halfW,
      findNearest: function (pos, hint) { return findNearest(samples, pos, hint); },
      startGrid: startGrid,
      colliders: colliders,
      sun: sun,
      tod: todP,
      envMap: envMap
    };
  }

  /* روبون افست بین دو شعاع (شولدر) */
  function buildRibbonOffset(samples, innerW, outerW, sideSign, material, yLift) {
    var n = samples.length, verts = [], uvs = [], idx = [];
    var cum = 0;
    for (var i = 0; i < n; i++) {
      var s = samples[i];
      var y = (s.pos.y || 0) + (yLift || 0);
      var inner = s.pos.clone().addScaledVector(s.side, sideSign * innerW); inner.y = y;
      var outer = s.pos.clone().addScaledVector(s.side, sideSign * outerW); outer.y = y - 0.012;
      if (sideSign === 1) verts.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
      else verts.push(outer.x, outer.y, outer.z, inner.x, inner.y, inner.z);
      if (i > 0) cum += samples[i].pos.distanceTo(samples[i - 1]);
      uvs.push(cum / 5, 0, cum / 5, 1);
    }
    for (var j = 0; j < n; j++) {
      var a = j * 2, b = ((j + 1) % n) * 2;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }

  /* تخلیهٔ کامل صحنه (آزادسازی حافظه GPU) — بافت‌های مشترک کش‌شده حفظ می‌شوند */
  function sharedTextures() {
    return [roadTex, curbTex, checkerTex, walkTex];
  }
  function disposeScene(scene) {
    var keep = sharedTextures();
    scene.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      mats.forEach(function (m) {
        ['map', 'emissiveMap', 'specularMap', 'normalMap', 'roughnessMap', 'alphaMap', 'lightMap'].forEach(function (k) {
          if (m[k] && m[k].dispose && keep.indexOf(m[k]) === -1) m[k].dispose();
        });
        if (m.dispose) m.dispose();
      });
    });
    if (scene.environment && scene.environment.dispose) scene.environment.dispose();
    scene.environment = null;
    scene.clear();
  }

  root.NitroWorld = { buildRaceWorld: buildRaceWorld, disposeScene: disposeScene, findNearest: findNearest, SKY: SKY, updateRain: updateRain };
})(typeof window !== 'undefined' ? window : globalThis);
