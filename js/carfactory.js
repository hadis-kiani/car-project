/* ============================================================
   NIRO CITY — Car Factory: ساخت رویه‌ای و واقع‌گرایانهٔ ماشین‌ها
   هر کلاس بدنه (اسپرت/هایپر/کلاسیک/...) پروفایل و ابعاد خاص خودش را دارد.
   رینگ‌ها و لاستیک‌ها با Canvas با کیفیت بالا رندر می‌شوند.
   ============================================================ */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  if (!THREE) { console.error('THREE not loaded'); return; }

  /* ---------- ابعاد بدنه‌ها ---------- */
  var BODY = {
    super:   { L: 4.55, W: 1.98, belt: 0.665, roof: 0.985, wr: 0.335, ww: 0.36, wing: true,  sideIntake: true,  classic:false },
    hyper:   { L: 4.65, W: 2.02, belt: 0.66,  roof: 0.97,  wr: 0.34,  ww: 0.38, wing: true,  sideIntake: true,  classic:false, gtWing: true },
    sport:   { L: 4.40, W: 1.88, belt: 0.72,  roof: 1.015, wr: 0.325, ww: 0.30, wing: false, sideIntake: false, classic:false },
    muscle:  { L: 4.85, W: 1.92, belt: 0.735, roof: 1.085, wr: 0.345, ww: 0.33, wing: false, sideIntake: false, classic:false, ducktail: true },
    classic: { L: 4.35, W: 1.72, belt: 0.72,  roof: 1.12,  wr: 0.34,  ww: 0.22, wing: false, sideIntake: false, classic:true },
    luxury:  { L: 4.95, W: 1.95, belt: 0.795, roof: 1.16,  wr: 0.34,  ww: 0.28, wing: false, sideIntake: false, classic:false, chrome: true }
  };

  function paintMaterial(hex, finish) {
    var m;
    if (finish === 'matte') {
      m = new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.15, roughness: 0.78, clearcoat: 0, clearcoatRoughness: 0.6, envMapIntensity: 0.7 });
    } else if (finish === 'pearl') {
      m = new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.72, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.35 });
    } else { /* gloss */
      m = new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.62, roughness: 0.30, clearcoat: 1.0, clearcoatRoughness: 0.10, envMapIntensity: 1.25 });
    }
    return m;
  }
  var GLASS  = function(){ return new THREE.MeshStandardMaterial({ color: 0x0d141a, metalness: 0.95, roughness: 0.06, envMapIntensity: 1.7 }); };
  var TRIM   = function(){ return new THREE.MeshStandardMaterial({ color: 0x121316, metalness: 0.35, roughness: 0.72 }); };
  var CHROME = function(){ return new THREE.MeshStandardMaterial({ color: 0xe8e9ec, metalness: 1.0, roughness: 0.14, envMapIntensity: 1.5 }); };
  var CARBON = function(){ return new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.6, roughness: 0.38 }); };

  /* ---------- پروفایل بدنه (نمایش جانبی) ---------- */
  function lowerBodyShape(b) {
    var L = b.L, s = new THREE.Shape();
    var belt = b.belt, nose, tail;
    if (b.classic) {
      nose = belt - 0.13; tail = belt + 0.02;
      s.moveTo(-L/2 + 0.02, 0.34);
      s.quadraticCurveTo(-L/2 - 0.04, belt - 0.05, -L/2 + 0.18, tail);          // دماغهٔ دم
      s.quadraticCurveTo(-L*0.28, tail + 0.015, -L*0.10, belt - 0.02);          // دم‌صندوق
      s.quadraticCurveTo(L*0.18, belt - 0.06, L*0.33, nose + 0.06);             // کاپوت کشیده
      s.quadraticCurveTo(L/2 - 0.02, nose + 0.05, L/2 - 0.01, nose - 0.10);     // نوک گرد
      s.quadraticCurveTo(L/2 + 0.03, 0.26, L/2 - 0.12, 0.20);                   // زیر سپر
      s.lineTo(L/2 - 0.30, 0.145);
      s.lineTo(-L/2 + 0.30, 0.145);
      s.lineTo(-L/2 + 0.08, 0.21);
      s.closePath();
      return s;
    }
    if (b.muscle) {
      nose = belt - 0.21; tail = belt + 0.015;
      s.moveTo(-L/2 + 0.03, 0.36);
      s.lineTo(-L/2 - 0.01, tail - 0.02);
      s.quadraticCurveTo(-L/2 + 0.05, tail + 0.02, -L/2 + 0.42, tail);          // لبهٔ دم
      s.quadraticCurveTo(-L*0.1, tail - 0.035, L*0.05, belt - 0.03);            // ترانک صاف
      s.lineTo(L*0.33, nose + 0.10);                                            // کاپوت تخت بلند
      s.quadraticCurveTo(L/2 - 0.05, nose + 0.09, L/2, nose - 0.06);            // جلوی تخت
      s.lineTo(L/2 - 0.02, 0.24);
      s.lineTo(L/2 - 0.32, 0.155);
      s.lineTo(-L/2 + 0.32, 0.155);
      s.lineTo(-L/2 + 0.06, 0.24);
      s.closePath();
      return s;
    }
    if (b.luxury) {
      nose = belt - 0.245; tail = belt + 0.03;
      s.moveTo(-L/2 + 0.02, 0.40);
      s.quadraticCurveTo(-L/2 - 0.05, tail - 0.08, -L/2 + 0.16, tail);
      s.quadraticCurveTo(-L*0.22, tail + 0.02, -L*0.02, belt - 0.01);           // صندوق سه‌جعبه
      s.quadraticCurveTo(L*0.16, belt - 0.02, L*0.30, nose + 0.05);             // کاپوت
      s.quadraticCurveTo(L/2 - 0.04, nose + 0.04, L/2 - 0.01, nose - 0.12);     // جلوی عمودی
      s.quadraticCurveTo(L/2 + 0.04, 0.27, L/2 - 0.14, 0.21);                   // سپر
      s.lineTo(L/2 - 0.34, 0.155);
      s.lineTo(-L/2 + 0.34, 0.155);
      s.lineTo(-L/2 + 0.08, 0.27);
      s.closePath();
      return s;
    }
    if (b.roof >= 1.0 && b === BODY.sport) { /* handled below */ }
    if (belt < 0.70) {
      /* super / hyper : wedge خمیده */
      nose = belt - 0.27; tail = belt + 0.055;
      s.moveTo(-L/2 + 0.02, 0.30);
      s.lineTo(-L/2 - 0.03, tail - 0.045);                                      // لبهٔ اردکی دم
      s.quadraticCurveTo(-L/2 + 0.10, tail + 0.02, -L/2 + 0.45, tail - 0.01);   // ducktail
      s.quadraticCurveTo(-L*0.18, tail - 0.075, L*0.02, belt - 0.055);          // عرشهٔ شیب‌دار
      s.quadraticCurveTo(L*0.22, belt - 0.10, L*0.36, nose + 0.045);            // کاپوت قوزدار
      s.quadraticCurveTo(L/2 - 0.03, nose + 0.03, L/2 + 0.01, nose - 0.085);    // نوک تیز
      s.quadraticCurveTo(L/2 + 0.045, 0.225, L/2 - 0.13, 0.175);                // اسپلیتر
      s.lineTo(L/2 - 0.33, 0.125);
      s.lineTo(-L/2 + 0.33, 0.125);
      s.lineTo(-L/2 + 0.05, 0.205);
      s.closePath();
      return s;
    }
    /* sport (911-ish): بینی گرد و کاپوت شیب‌دار */
    nose = belt - 0.235; tail = belt + 0.055;
    s.moveTo(-L/2 + 0.02, 0.33);
    s.quadraticCurveTo(-L/2 - 0.04, tail - 0.06, -L/2 + 0.15, tail);            // دم گرد
    s.quadraticCurveTo(-L*0.20, tail + 0.012, L*0.02, belt - 0.075);            // عقب تا وسط
    s.quadraticCurveTo(L*0.24, belt - 0.13, L*0.38, nose + 0.05);               // کاپوت 911
    s.quadraticCurveTo(L/2 - 0.02, nose + 0.035, L/2 + 0.01, nose - 0.10);      // نوک گرد
    s.quadraticCurveTo(L/2 + 0.04, 0.24, L/2 - 0.14, 0.185);
    s.lineTo(L/2 - 0.33, 0.135);
    s.lineTo(-L/2 + 0.33, 0.135);
    s.lineTo(-L/2 + 0.07, 0.225);
    s.closePath();
    return s;
  }

  function cabinShape(b) {
    var L = b.L, s = new THREE.Shape(), belt = b.belt + 0.005, roof = b.roof;
    var frontBase, roofFront, roofRear, rearBase;
    if (b.classic) {
      frontBase = -L*0.06; roofFront = -L*0.20; roofRear = -L*0.34; rearBase = -L*0.47;
      s.moveTo(frontBase + 0.30, belt);
      s.quadraticCurveTo(frontBase + 0.02, belt + 0.06, roofFront, roof - 0.015);
      s.quadraticCurveTo((roofFront+roofRear)/2, roof + 0.012, roofRear, roof - 0.02);
      s.quadraticCurveTo(rearBase - 0.10, belt + 0.16, rearBase - 0.06, belt);
      s.closePath(); return s;
    }
    if (b.roof >= 1.1 && !b.classic && b.belt > 0.78) { /* luxury */
      frontBase = L*0.13; roofFront = L*0.02; roofRear = -L*0.24; rearBase = -L*0.38;
      s.moveTo(frontBase + 0.16, belt);
      s.quadraticCurveTo(frontBase - 0.06, belt + 0.10, roofFront, roof - 0.02);
      s.quadraticCurveTo((roofFront+roofRear)/2, roof + 0.015, roofRear, roof - 0.025);
      s.quadraticCurveTo(rearBase - 0.06, belt + 0.10, rearBase - 0.10, belt);
      s.closePath(); return s;
    }
    if (b.muscle) {
      frontBase = L*0.075; roofFront = -L*0.02; roofRear = -L*0.19; rearBase = -L*0.42;
      s.moveTo(frontBase + 0.22, belt);
      s.quadraticCurveTo(frontBase, belt + 0.10, roofFront, roof - 0.02);
      s.quadraticCurveTo((roofFront+roofRear)/2, roof + 0.018, roofRear, roof - 0.03);
      s.quadraticCurveTo(rearBase, belt + 0.05, rearBase - 0.05, belt);
      s.closePath(); return s;
    }
    if (b.belt < 0.70) { /* super / hyper */
      frontBase = L*0.115; roofFront = -L*0.075; roofRear = -L*0.26; rearBase = -L*0.335;
      s.moveTo(frontBase + 0.24, belt);
      s.quadraticCurveTo(frontBase - 0.02, belt + 0.115, roofFront, roof - 0.02);
      s.quadraticCurveTo((roofFront+roofRear)/2, roof + 0.02, roofRear, roof - 0.03);
      s.quadraticCurveTo(rearBase + 0.02, belt + 0.02, rearBase - 0.045, belt);
      s.closePath(); return s;
    }
    /* sport fastback */
    frontBase = L*0.10; roofFront = -L*0.055; roofRear = -L*0.235; rearBase = -L*0.365;
    s.moveTo(frontBase + 0.26, belt);
    s.quadraticCurveTo(frontBase - 0.02, belt + 0.115, roofFront, roof - 0.02);
    s.quadraticCurveTo((roofFront+roofRear)/2, roof + 0.02, roofRear, roof - 0.03);
    s.quadraticCurveTo(rearBase + 0.02, belt + 0.04, rearBase - 0.05, belt);
    s.closePath(); return s;
  }

  function roofCapShape(b) {
    /* لایهٔ باریک بدنه‌رنگ روی سقفِ شیشه‌ای */
    var L = b.L, s = new THREE.Shape(), r = b.roof;
    var f, rr;
    if (b.classic) { f = -L*0.205; rr = -L*0.335; }
    else if (b.belt > 0.78 && b.roof > 1.1) { f = L*0.015; rr = -L*0.235; }
    else if (b.muscle) { f = -L*0.025; rr = -L*0.185; }
    else if (b.belt < 0.70) { f = -L*0.078; rr = -L*0.255; }
    else { f = -L*0.058; rr = -L*0.232; }
    s.moveTo(f, r + 0.004);
    s.lineTo(rr, r + 0.004);
    s.lineTo(rr + 0.02, r + 0.028);
    s.lineTo(f - 0.02, r + 0.028);
    s.closePath();
    return s;
  }

  /* ---------- بوم‌های رینگ روی Canvas ---------- */
  var rimCache = {};
  function rimTexture(style, colorHex) {
    var key = style + ':' + colorHex;
    if (rimCache[key]) return rimCache[key];
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    var cx = 128, cy = 128;
    var base = colorHex, dark = shade(base, -70), light = shade(base, 65), mid = shade(base, -25);
    // پس‌زمینهٔ شیار رینگ
    var bg = g.createRadialGradient(cx, cy, 30, cx, cy, 126);
    bg.addColorStop(0, '#0c0c0e'); bg.addColorStop(0.75, '#17171a'); bg.addColorStop(1, '#050506');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
    // دیسک ترمز سوراخ‌دار (پشت پره‌ها دیده می‌شود)
    var disc = g.createRadialGradient(cx, cy, 34, cx, cy, 96);
    disc.addColorStop(0, '#3a3a3f'); disc.addColorStop(0.55, '#55555c'); disc.addColorStop(0.8, '#2c2c31'); disc.addColorStop(1, '#191920');
    g.fillStyle = disc; g.beginPath(); g.arc(cx, cy, 94, 0, Math.PI*2); g.fill();
    // شیارهای خنک‌کنندهٔ دیسک
    g.strokeStyle = 'rgba(12,12,16,0.85)'; g.lineWidth = 5;
    for (var dd = 0; dd < 12; dd++) {
      var da = (dd / 12) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx + Math.cos(da) * 52, cy + Math.sin(da) * 52); g.lineTo(cx + Math.cos(da + 0.35) * 88, cy + Math.sin(da + 0.35) * 88); g.stroke();
    }
    // سوراخ‌های دیسک
    g.fillStyle = '#0a0a0d';
    for (var hp = 0; hp < 18; hp++) {
      var ha = (hp / 18) * Math.PI * 2 + 0.17;
      g.beginPath(); g.arc(cx + Math.cos(ha) * 70, cy + Math.sin(ha) * 70, 3.1, 0, Math.PI*2); g.fill();
    }
    // هاب دیسک (تیره‌تر)
    g.fillStyle = '#232329'; g.beginPath(); g.arc(cx, cy, 36, 0, Math.PI*2); g.fill();
    // لبهٔ بیرونی
    g.beginPath(); g.arc(cx, cy, 122, 0, Math.PI*2); g.lineWidth = 14;
    g.strokeStyle = mid; g.stroke();
    g.beginPath(); g.arc(cx, cy, 114, 0, Math.PI*2); g.lineWidth = 3; g.strokeStyle = light; g.stroke();

    if (style === 'sport') {
      for (var i = 0; i < 5; i++) {
        var a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.save(); g.translate(cx, cy); g.rotate(a);
        var grad = g.createLinearGradient(0, -16, 0, -110);
        grad.addColorStop(0, dark); grad.addColorStop(0.35, base); grad.addColorStop(1, light);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(-13, -34); g.lineTo(-22, -104); g.lineTo(22, -104); g.lineTo(13, -34);
        g.closePath(); g.fill();
        g.restore();
      }
    } else if (style === 'mesh') {
      g.lineWidth = 7; g.strokeStyle = base;
      for (var j = 0; j < 10; j++) {
        var a1 = (j / 10) * Math.PI * 2 - Math.PI / 2;
        g.save(); g.translate(cx, cy); g.rotate(a1);
        g.beginPath(); g.moveTo(0, -26); g.lineTo(0, -106); g.stroke();
        g.rotate(0.32);
        g.beginPath(); g.moveTo(0, -26); g.lineTo(0, -106); g.stroke();
        g.restore();
      }
      g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI*2); g.lineWidth = 8; g.strokeStyle = mid; g.stroke();
    } else if (style === 'steel') {
      var d2 = g.createRadialGradient(cx, cy, 8, cx, cy, 108);
      d2.addColorStop(0, light); d2.addColorStop(0.45, base); d2.addColorStop(0.85, mid); d2.addColorStop(1, dark);
      g.fillStyle = d2;
      g.beginPath(); g.arc(cx, cy, 104, 0, Math.PI*2); g.fill();
      g.fillStyle = '#101012';
      for (var k = 0; k < 5; k++) {
        var a2 = (k / 5) * Math.PI * 2 - Math.PI / 2;
        g.beginPath();
        g.ellipse(cx + Math.cos(a2) * 62, cy + Math.sin(a2) * 62, 11, 17, a2 + Math.PI/2, 0, Math.PI*2);
        g.fill();
      }
      g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI*2); g.fillStyle = light; g.fill();
    } else { /* turbine */
      for (var t = 0; t < 9; t++) {
        var a3 = (t / 9) * Math.PI * 2 - Math.PI / 2;
        g.save(); g.translate(cx, cy); g.rotate(a3); g.transform(1, 0, 0.38, 1, 0, 0);
        var grad3 = g.createLinearGradient(0, -20, 0, -106);
        grad3.addColorStop(0, '#0e0e10'); grad3.addColorStop(0.5, base); grad3.addColorStop(1, '#f4f4f6');
        g.fillStyle = grad3;
        g.beginPath();
        g.moveTo(-10, -28); g.lineTo(-17, -100); g.lineTo(15, -100); g.lineTo(9, -28);
        g.closePath(); g.fill();
        g.restore();
      }
    }
    // درپوش مرکزی + پیچ‌ها
    var hub = g.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 30);
    hub.addColorStop(0, light); hub.addColorStop(1, mid);
    g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI*2); g.fillStyle = hub; g.fill();
    g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI*2); g.lineWidth = 2; g.strokeStyle = dark; g.stroke();
    g.fillStyle = '#0b0b0c';
    for (var l = 0; l < 5; l++) {
      var a4 = (l / 5) * Math.PI * 2;
      g.beginPath(); g.arc(cx + Math.cos(a4) * 15, cy + Math.sin(a4) * 15, 2.6, 0, Math.PI*2); g.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
    rimCache[key] = tex;
    return tex;
  }
  function shade(hex, amt) {
    var n = parseInt(hex.replace('#', ''), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var gg = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    var b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
  }

  var sidewallCache = {};
  function sidewallTexture(tireId) {
    if (sidewallCache[tireId]) return sidewallCache[tireId];
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(128,128,58,128,128,128);
    grad.addColorStop(0, '#1b1b1d'); grad.addColorStop(0.82, '#131314'); grad.addColorStop(1, '#26262a');
    g.fillStyle = grad; g.fillRect(0,0,256,256);
    var ring = tireId === 'sport' ? '#d1342c' : tireId === 'slick' ? '#e3b341' : '#3a3a3e';
    g.strokeStyle = ring; g.lineWidth = tireId === 'street' ? 5 : 8;
    g.beginPath(); g.arc(128,128,112,0,Math.PI*2); g.stroke();
    g.beginPath(); g.arc(128,128,84,0,Math.PI*2); g.lineWidth = 3; g.strokeStyle = '#2e2e33'; g.stroke();
    if (tireId !== 'street') {
      // نوشته‌های دیوارهٔ لاستیک مسابقه‌ای
      g.save(); g.translate(128, 128);
      g.fillStyle = tireId === 'slick' ? '#c8a83a' : '#d8d8dc';
      g.font = 'bold 15px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('N I T R O', 0, -97); g.fillText('R A C I N G', 0, 97);
      g.font = '11px Arial'; g.fillStyle = '#5a5a60';
      g.fillText('295/30 ZR21', 0, -80); g.fillText('295/30 ZR21', 0, 80);
      g.restore();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
    sidewallCache[tireId] = tex;
    return tex;
  }

  function glowTexture(hex) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64,64,4,64,64,62);
    grad.addColorStop(0, hex); grad.addColorStop(0.4, hex + '88'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0,0,128,128);
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  /* ============================================================
     buildCar — ساخت کامل ماشین
     opts: { body, paint, finish, rim, rimColor, tire, glow, brakeLights }
     ============================================================ */
  function buildCar(opts) {
    var b = BODY[opts.body] || BODY.sport;
    var L = b.L, W = b.W;
    var group = new THREE.Group();
    group.name = 'car';

    var paintMat  = paintMaterial(opts.paint || '#c1121f', opts.finish || 'gloss');
    var glassMat  = GLASS(), trimMat = TRIM(), chromeMat = CHROME(), carbonMat = CARBON();

    /* ---- بدنهٔ اصلی ---- */
    var bodyDepth = W - 0.17;
    var bodyGeo = new THREE.ExtrudeGeometry(lowerBodyShape(b), {
      depth: bodyDepth, bevelEnabled: true, bevelThickness: 0.085, bevelSize: 0.072, bevelSegments: 3, steps: 1, curveSegments: 26
    });
    bodyGeo.translate(0, 0, -bodyDepth / 2);
    var bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
    bodyMesh.rotation.y = -Math.PI / 2;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    /* ---- کابین شیشه‌ای ---- */
    var cabDepth = W - 0.42;
    var cabGeo = new THREE.ExtrudeGeometry(cabinShape(b), {
      depth: cabDepth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 2, steps: 1, curveSegments: 22
    });
    cabGeo.translate(0, 0, -cabDepth / 2);
    var cabMesh = new THREE.Mesh(cabGeo, glassMat);
    cabMesh.rotation.y = -Math.PI / 2;
    cabMesh.castShadow = true;
    group.add(cabMesh);

    /* ---- کلاهک سقف بدنه‌رنگ ---- */
    var roofDepth = cabDepth * 0.82;
    var roofGeo = new THREE.ExtrudeGeometry(roofCapShape(b), {
      depth: roofDepth, bevelEnabled: false, steps: 1, curveSegments: 8
    });
    roofGeo.translate(0, 0, -roofDepth / 2);
    var roofMesh = new THREE.Mesh(roofGeo, paintMat);
    roofMesh.rotation.y = -Math.PI / 2;
    group.add(roofMesh);

    /* ---- اسپویلر ---- */
    if (b.wing) {
      var wingY = b.roof + 0.10, wingZ = -L/2 + 0.22;
      var supGeo = new THREE.BoxGeometry(0.055, 0.20, 0.30);
      [-1, 1].forEach(function (s) {
        var sup = new THREE.Mesh(supGeo, b.gtWing ? carbonMat : paintMat);
        sup.position.set(s * (W/2 - 0.33), wingY - 0.08, wingZ);
        group.add(sup);
      });
      var wingGeo = new THREE.BoxGeometry(W * (b.gtWing ? 0.86 : 0.78), 0.045, b.gtWing ? 0.44 : 0.30);
      var wing = new THREE.Mesh(wingGeo, b.gtWing ? carbonMat : paintMat);
      wing.position.set(0, wingY + 0.035, wingZ);
      wing.rotation.x = b.gtWing ? -0.16 : -0.09;
      wing.castShadow = true;
      group.add(wing);
      if (b.gtWing) {
        var endGeo = new THREE.BoxGeometry(0.03, 0.16, 0.46);
        [-1, 1].forEach(function (s) {
          var end = new THREE.Mesh(endGeo, carbonMat);
          end.position.set(s * (W * 0.43), wingY + 0.02, wingZ);
          group.add(end);
        });
      }
    } else if (b.ducktail) {
      var lip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.78, 0.035, 0.16), paintMat);
      lip.position.set(0, b.belt + 0.075, -L/2 + 0.14);
      lip.rotation.x = 0.16;
      group.add(lip);
    }

    /* ---- ورودی‌های جانبی (سوپر/هایپر) ---- */
    if (b.sideIntake) {
      var intakeGeo = new THREE.BoxGeometry(0.06, 0.20, 0.72);
      [-1, 1].forEach(function (s) {
        var intake = new THREE.Mesh(intakeGeo, carbonMat);
        intake.position.set(s * (W/2 + 0.005), b.belt - 0.13, -L*0.18);
        intake.rotation.x = 0; intake.rotation.z = -0.06 * s;
        group.add(intake);
      });
    }

    /* ---- چراغ‌های جلو ---- */
    var headMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, emissive: 0xcfe0ff, emissiveIntensity: 1.6, metalness: 0.1, roughness: 0.2 });
    var tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 1.5, metalness: 0.1, roughness: 0.3 });
    var hz = L/2 - 0.14, hy = b.belt - 0.255;
    if (b.classic) {
      [-1, 1].forEach(function (s) {
        var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.09, 20), chromeMat);
        ring.rotation.x = Math.PI / 2 - 0.18; ring.position.set(s * (W/2 - 0.33), hy, hz); group.add(ring);
        var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.095, 20),
          new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffdf94, emissiveIntensity: 1.35 }));
        lens.rotation.x = Math.PI / 2 - 0.18; lens.position.set(s * (W/2 - 0.33), hy, hz + 0.008); group.add(lens);
        var tlens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 16), tailMat);
        tlens.rotation.x = Math.PI / 2; tlens.position.set(s * (W/2 - 0.33), hy + 0.01, -hz); group.add(tlens);
      });
      // سپرهای کروم کلاسیک
      [1, -1].forEach(function (dir) {
        var bumper = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.075, 0.1), chromeMat);
        bumper.position.set(0, 0.235, dir * (L/2 + 0.015));
        group.add(bumper);
      });
    } else {
      var drlMat = new THREE.MeshStandardMaterial({ color: 0xe8fbff, emissive: 0xbfefff, emissiveIntensity: 2.6, metalness: 0.1, roughness: 0.25 });
      [-1, 1].forEach(function (s) {
        var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.075, 0.10), headMat);
        head.position.set(s * (W/2 - 0.36), hy, hz);
        head.rotation.x = -0.20;
        head.rotation.y = -s * 0.16;
        group.add(head);
        // نوار نور روز (DRL) بالای چراغ — چشم عصبانی مدرن
        var drl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.028, 0.06), drlMat);
        drl.position.set(s * (W/2 - 0.36), hy + 0.075, hz + 0.012);
        drl.rotation.x = -0.20;
        drl.rotation.y = -s * 0.16;
        drl.rotation.z = s * 0.13; // زاویهٔ پلنگی رو به مرکز
        group.add(drl);
      });
      // نوار عقب تمام‌عرض
      var tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 0.055, 0.08), tailMat);
      tail.position.set(0, b.belt - 0.115, -L/2 - 0.015);
      group.add(tail);
    }

    /* ---- جلوپنجره / اسپلیتر / دیفیوزر / اگزوز ---- */
    if (b.classic) {
      var grille = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.05), chromeMat);
      grille.position.set(0, b.belt - 0.28, L/2 - 0.02); group.add(grille);
    } else {
      var grille2 = new THREE.Mesh(new THREE.BoxGeometry(W * 0.42, 0.10, 0.05), trimMat);
      grille2.position.set(0, b.belt - 0.25, L/2 - 0.035); group.add(grille2);
      var splitter = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.045, 0.24), carbonMat);
      splitter.position.set(0, 0.135, L/2 - 0.05); group.add(splitter);
      var diffuser = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 0.075, 0.16), carbonMat);
      diffuser.position.set(0, 0.15, -L/2 - 0.02); group.add(diffuser);
      if (b.sideIntake) { // فین‌های دیفیوزر برای سوپر/هایپر
        [-0.27, -0.135, 0, 0.135, 0.27].forEach(function (fx) {
          var finD = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.095, 0.15), trimMat);
          finD.position.set(fx, 0.148, -L/2 - 0.035);
          group.add(finD);
        });
      }
      var exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.09, 12), CHROME());
      [-1, 1].forEach(function (s) {
        var ex = exhaust.clone();
        ex.rotation.x = Math.PI / 2;
        ex.position.set(s * 0.16, 0.165, -L/2 - 0.06);
        group.add(ex);
      });
    }

    /* ---- کالیپر ترمز (ثابت به بدنه، پشت رینگ) ---- */
    var caliperMat = new THREE.MeshStandardMaterial({ color: 0xd52f1f, metalness: 0.45, roughness: 0.32, emissive: 0x2a0602, emissiveIntensity: 0.7 });
    var caliperGeo = new THREE.BoxGeometry(0.085, 0.135, 0.05);
    [[(W/2 - 0.155), 1], [-(W/2 - 0.155), -1]].forEach(function (cfg) {
      var wx = cfg[0];
      [[(L/2 - 0.335 - 0.42), 1], [-(L/2 - 0.335 - 0.42), -1]].forEach(function (wz) {
        var cal = new THREE.Mesh(caliperGeo, caliperMat);
        var r = 0.185;
        cal.position.set(wx, 0.335 + r * 0.72, wz[0] - r * 0.72);
        cal.rotation.x = -0.75;
        group.add(cal);
      });
    });

    /* ---- رکاب‌های کربنی کناری ---- */
    if (!b.classic) {
      [-1, 1].forEach(function (s) {
        var skirt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, L * 0.5), carbonMat);
        skirt.position.set(s * (W/2 + 0.012), 0.155, -0.1);
        group.add(skirt);
      });
    }

    /* ---- باله کوسهٔ سقف ---- */
    if (!b.classic) {
      var fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.14), carbonMat);
      fin.position.set(0, b.roof + 0.045, -L * 0.21);
      group.add(fin);
    }

    /* ---- ثبت‌پلاک جلو و عقب ---- */
    var plateTex = (function () {
      var c = document.createElement('canvas'); c.width = 128; c.height = 40;
      var g2 = c.getContext('2d');
      g2.fillStyle = '#eef0f2'; g2.fillRect(0, 0, 128, 40);
      g2.strokeStyle = '#1c1f26'; g2.lineWidth = 4; g2.strokeRect(2, 2, 124, 36);
      g2.fillStyle = '#1c1f26'; g2.font = 'bold 24px Tahoma, Arial'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText('NITRO·01', 64, 21);
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    })();
    [[1, L/2 + 0.028], [-1, -L/2 - 0.028]].forEach(function (cfg) {
      var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.105), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5, metalness: 0.1 }));
      plate.position.set(0, 0.315, cfg[1]);
      plate.rotation.y = cfg[0] === 1 ? 0 : Math.PI;
      group.add(plate);
    });

    /* ---- آینه‌ها ---- */
    [-1, 1].forEach(function (s) {
      var stalk = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.10), trimMat);
      stalk.position.set(s * (W/2 + 0.02), b.belt + 0.02, L*0.085); group.add(stalk);
      var mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.12), b.classic ? chromeMat : paintMat);
      mirror.position.set(s * (W/2 + 0.065), b.belt + 0.045, L*0.085); group.add(mirror);
    });

    /* ---- چرخ‌ها ---- */
    var tireTex = sidewallTexture(opts.tire || 'street');
    var rimTex  = rimTexture(opts.rim || 'sport', (opts.rimColorHex || '#d7d9de'));
    var tireSide = new THREE.MeshStandardMaterial({ map: tireTex, roughness: 0.92, metalness: 0.0 });
    var capMat   = new THREE.MeshStandardMaterial({ map: rimTex, roughness: 0.25, metalness: 0.85, envMapIntensity: 1.3 });
    var tireCap  = new THREE.MeshStandardMaterial({ map: tireTex, roughness: 0.9 });
    var wheelW = b.ww, wr = b.wr;
    var tireGeo = new THREE.CylinderGeometry(wr, wr, wheelW, 30, 1, false);
    tireGeo.rotateZ(Math.PI / 2);
    var rimGeo = new THREE.CylinderGeometry(wr * 0.64, wr * 0.64, wheelW + 0.016, 26, 1, false);
    rimGeo.rotateZ(Math.PI / 2);

    var wheels = [], steers = [];
    var wheelOffsets = [
      { x:  (W/2 - wheelW/2 + 0.035), z:  (L/2 - wr - 0.42), steer: true  },
      { x: -(W/2 - wheelW/2 + 0.035), z:  (L/2 - wr - 0.42), steer: true  },
      { x:  (W/2 - wheelW/2 + 0.035), z: -(L/2 - wr - 0.42), steer: false },
      { x: -(W/2 - wheelW/2 + 0.035), z: -(L/2 - wr - 0.42), steer: false }
    ];
    wheelOffsets.forEach(function (off) {
      var steerGroup = new THREE.Group();
      steerGroup.position.set(off.x, wr, off.z);
      var spin = new THREE.Group();
      var tire = new THREE.Mesh(tireGeo, [tireSide, tireCap, tireCap]);
      tire.castShadow = true;
      var rim = new THREE.Mesh(rimGeo, [trimMat, capMat, capMat]);
      spin.add(tire); spin.add(rim);
      steerGroup.add(spin);
      group.add(steerGroup);
      wheels.push(spin);
      if (off.steer) steers.push(steerGroup);
    });

    /* ---- زیرنور نئون ---- */
    var glowLight = null, glowPlane = null;
    if (opts.glow) {
      glowLight = new THREE.PointLight(opts.glow, 1.35, 6.2, 2.0);
      glowLight.position.set(0, 0.42, 0);
      group.add(glowLight);
      var gmat = new THREE.MeshBasicMaterial({ map: glowTexture(opts.glow), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.7, L + 1.4), gmat);
      glowPlane.rotation.x = -Math.PI / 2;
      glowPlane.position.y = 0.055;
      group.add(glowPlane);
    }

    /* ---- کابین داخلی ساده برای نمای داخل ---- */
    var interior = new THREE.Group();
    var dash = new THREE.Mesh(new THREE.BoxGeometry(W - 0.55, 0.10, 0.30), new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.85 }));
    dash.position.set(0, b.belt - 0.16, L*0.115);
    interior.add(dash);
    var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.028, 10, 26), new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.6 }));
    wheel.position.set(-(W/2) + 0.62, b.belt - 0.13, L*0.085);
    wheel.rotation.x = -0.42;
    interior.add(wheel);
    interior.visible = false; // فقط در دوربین کابین
    group.add(interior);

    group.userData = {
      bodyLength: L, bodyWidth: W, wheelRadius: b.wr,
      cameraY: b.belt + (b.roof - b.belt) * 0.60 + 0.05,
      wheels: wheels, steers: steers, tailMat: tailMat, headMat: headMat, drlMat: (typeof drlMat !== 'undefined' ? drlMat : null),
      glowLight: glowLight, interior: interior, steeringWheel: wheel
    };
    return group;
  }

  function setHeadlights(carGroup, on) {
    var ud = carGroup.userData || {};
    if (ud.headMat) ud.headMat.emissiveIntensity = on ? 3.2 : 0.35;
    if (ud.drlMat) ud.drlMat.emissiveIntensity = on ? 3.4 : 0.25;
    if (ud.headSpots) ud.headSpots.forEach(function (s) { s.visible = !!on; });
    carGroup.userData.headlightsOn = !!on;
  }
  function addHeadlightBeams(carGroup) {
    var ud = carGroup.userData || {};
    var L = ud.bodyLength || 4.4, W = ud.bodyWidth || 1.9;
    var spots = [];
    [-1, 1].forEach(function (s) {
      var spot = new THREE.SpotLight(0xd8ecff, 2.2, 55, 0.5, 0.55, 1.3);
      spot.position.set(s * (W/2 - 0.36), 0.62, L/2 - 0.1);
      var tgt = new THREE.Object3D();
      tgt.position.set(s * (W/2 - 0.36), 0.25, 16);
      carGroup.add(tgt);
      spot.target = tgt;
      carGroup.add(spot);
      spots.push(spot);
    });
    carGroup.userData.headSpots = spots;
    return spots;
  }
  root.NitroCarFactory = { buildCar: buildCar, BODY: BODY, setHeadlights: setHeadlights, addHeadlightBeams: addHeadlightBeams };
})(typeof window !== 'undefined' ? window : globalThis);
