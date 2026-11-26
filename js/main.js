/* ============================================================
   NIRO CITY — نقطه ورود بازی
   ============================================================ */
(function (root) {
  'use strict';

  function showFatal(msg) {
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#05070d;color:#ffb1b1;font-family:Tahoma;z-index:9999;text-align:center;padding:30px;line-height:2';
    div.innerHTML = '<div><h1 style="color:#00e5ff;font-size:2rem">نیترو سیتی</h1><p>' + msg + '</p></div>';
    document.body.appendChild(div);
  }

  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function runLoadingSequence(onDone) {
    var fill = document.getElementById('loading-bar-fill');
    var pct = document.getElementById('loading-percent');
    var status = document.getElementById('loading-status');
    var screenLoading = document.getElementById('screen-loading');
    var screenMenu = document.getElementById('screen-menu');

    if (!fill || !screenLoading || !screenMenu) {
      onDone();
      return;
    }

    var steps = [
      { p: 20, text: 'در حال بارگذاری موتور سه‌بعدی...' },
      { p: 45, text: 'آماده‌سازی ۱۸ مدل خودروی واقعی...' },
      { p: 72, text: 'بارگذاری پیست‌های مسابقه و نورپردازی...' },
      { p: 92, text: 'تنظیم فیزیک دریفت و صدای موتور...' },
      { p: 100, text: 'آمادهٔ حرکت! 🏁' }
    ];

    var i = 0;
    function nextStep() {
      if (i >= steps.length) {
        setTimeout(function () {
          screenLoading.classList.remove('visible');
          screenMenu.classList.add('visible');
          onDone();
        }, 260);
        return;
      }
      var s = steps[i++];
      fill.style.width = s.p + '%';
      if (pct) pct.textContent = s.p.toLocaleString('fa-IR') + '٪';
      if (status) status.textContent = s.text;
      setTimeout(nextStep, 220);
    }
    setTimeout(nextStep, 120);
  }

  function boot() {
    if (root.nitroApp) return; // محافظت در برابر اجرای دوباره
    if (!root.THREE) { showFatal('کتابخانهٔ سه‌بعدی بارگذاری نشد. اتصال اینترنت یا فایل‌های بازی را بررسی کنید.'); return; }
    if (!webglAvailable()) { showFatal('مرورگر شما از WebGL پشتیبانی نمی‌کند. لطفاً Chrome یا Firefox جدید استفاده کنید.'); return; }
    try {
      runLoadingSequence(function () {
        root.nitroApp = new root.NitroUI.App();
      });
    } catch (err) {
      console.error(err);
      showFatal('خطا در راه‌اندازی بازی:<br>' + (err && err.message ? err.message : err));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
