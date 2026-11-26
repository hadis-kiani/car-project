/* ============================================================
   NITRO CITY — نقطه ورود بازی + صفحهٔ بارگذاری با نوار پیشرفت
   ============================================================ */
(function (root) {
  'use strict';

  var FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function faNum(n) { return String(n).replace(/[0-9]/g, function (d) { return FA[d]; }); }

  function showFatal(msg) {
    hideLoading();
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#05070d;color:#ffb1b1;font-family:Tahoma;z-index:9999;text-align:center;padding:30px;line-height:2';
    div.innerHTML = '<div><h1 style="color:#00e5ff;font-size:2rem">نیترو سیتی</h1><p>' + msg + '</p></div>';
    document.body.appendChild(div);
  }

  function hideLoading() {
    var s = document.getElementById('loading-screen');
    if (s) s.classList.add('hide');
  }

  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function preloadImage(src, cb) {
    var img = new Image();
    img.onload = function () { cb(true); };
    img.onerror = function () { cb(false); };
    img.src = src;
  }

  function startApp() {
    if (root.nitroApp) return; // محافظت در برابر اجرای دوباره
    if (!root.THREE) { showFatal('کتابخانهٔ سه‌بعدی بارگذاری نشد. اتصال اینترنت یا فایل‌های بازی را بررسی کنید.'); return; }
    if (!webglAvailable()) { showFatal('مرورگر شما از WebGL پشتیبانی نمی‌کند. لطفاً Chrome یا Firefox جدید استفاده کنید.'); return; }
    try {
      root.nitroApp = new root.NitroUI.App();
    } catch (err) {
      console.error(err);
      showFatal('خطا در راه‌اندازی بازی:<br>' + (err && err.message ? err.message : err));
    }
  }

  /* ---------- صفحهٔ بارگذاری با نوار پیشرفت ---------- */
  function runLoadingScreen() {
    var screen = document.getElementById('loading-screen');
    var fill = document.getElementById('loading-fill');
    var pct = document.getElementById('loading-pct');
    var status = document.getElementById('loading-status');
    var tip = document.getElementById('loading-tip');

    var TIPS = [
      'در حال آماده‌سازی آسفالت…',
      'پیشنهاد: در پیچ‌های تند، کمی قبل از رأس ترمز بگیرید.',
      'دریفت = کلید سکه جایزه در چالش‌ها.',
      'ماشین‌های کلاسیک سبک‌اند ولی در خط راست کندتر.',
      'با کلید C دوربین کابین/تعقیب را عوض کنید.',
      'در شب، چراغ‌های جلو ماشین روشن می‌شود.'
    ];
    var tipIdx = 0;

    function setProgress(p, msg) {
      if (fill) fill.style.width = p + '%';
      if (pct) pct.textContent = faNum(p) + '٪';
      if (msg && status) status.textContent = msg;
    }

    setProgress(0, 'بارگذاری موتور سه‌بعدی…');
    if (tip) tip.textContent = TIPS[0];

    /* چرخش نکته‌ها */
    var tipTimer = setInterval(function () {
      tipIdx = (tipIdx + 1) % TIPS.length;
      if (!tip) return;
      tip.style.opacity = '0';
      setTimeout(function () { tip.textContent = TIPS[tipIdx]; tip.style.opacity = '1'; }, 180);
    }, 2300);

    /* پیش‌بارگذاری تصویر اصلی (تنها دارایی خارجی واقعی) */
    var imgReady = false;
    preloadImage('assets/hero.jpg', function () { imgReady = true; });
    /* اگر تصویر کند شد، پس از مهلت بازش نمی‌گیریم */
    setTimeout(function () { imgReady = true; }, 2600);

    var progress = 0, target = 14, t0 = performance.now();
    var iv = setInterval(function () {
      progress += (target - progress) * 0.16 + 0.45;
      if (progress > target) progress = target;
      setProgress(Math.min(99, Math.round(progress)), null);

      if (progress > 9 && target < 40) { target = 44; if (status) status.textContent = 'آماده‌سازی بافت‌ها و مسیرها…'; }
      if (imgReady && progress > 38 && target < 78) { target = 82; if (status) status.textContent = 'ساخت خودروها و گاراژ…'; }
      if (progress > 76 && target < 100) { target = 100; if (status) status.textContent = 'روشن کردن نئون‌های شهر…'; }

      var elapsed = performance.now() - t0;
      if (progress >= 99.4 && imgReady && elapsed >= 2400) {
        clearInterval(iv);
        clearInterval(tipTimer);
        setProgress(100, 'آماده!');
        setTimeout(function () {
          startApp();
          hideLoading();
        }, 420);
      } else if (progress >= 99.4 && imgReady) {
        if (status) status.textContent = 'آماده‌سازی نهایی…';
      }
    }, 55);
  }

  function boot() {
    if (root.nitroApp) return;
    var loading = document.getElementById('loading-screen');
    /* اگر صفحهٔ بارگذاری نبود یا سه‌بعدی لود نشده بود، مستقیم راه‌اندازی کن */
    if (!loading || !root.NitroUI) { startApp(); return; }
    runLoadingScreen();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
