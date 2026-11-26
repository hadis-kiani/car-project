/* ============================================================
   NIRO CITY — نقطه ورود بازی
   boot → loader (نوار پیشرفت) → App
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

  function hideLoader() {
    var el = document.getElementById('screen-loader');
    if (el) { el.classList.remove('visible'); el.classList.remove('loader-leaving'); }
  }

  function startApp() {
    if (root.nitroApp) return;
    hideLoader();
    try {
      root.nitroApp = new root.NitroUI.App();
    } catch (err) {
      console.error(err);
      showFatal('خطا در راه‌اندازی بازی:<br>' + (err && err.message ? err.message : err));
    }
  }

  function boot() {
    if (root.nitroApp || root.nitroLoader) return; // محافظت در برابر اجرای دوباره
    if (!root.THREE) { showFatal('کتابخانهٔ سه‌بعدی بارگذاری نشد. اتصال اینترنت یا فایل‌های بازی را بررسی کنید.'); return; }

    /* محیط تست: بدون صفحهٔ بارگذاری */
    if (root.__NITRO_SKIP_LOADER__) { startApp(); return; }

    if (!root.NitroLoader || !root.NitroCarFactory) { startApp(); return; }

    /* اگر به هر دلیلی موتور سه‌بعدی ساخته نشد، کمتر از ۸ ثانیه وارد نشویم */
    setTimeout(function () {
      if (!root.nitroApp && root.nitroLoader && root.nitroLoader.done === false) {
        root.nitroLoader.target = 100;
      }
    }, 8000);

    root.nitroLoader = new root.NitroLoader.Loader(function () {
      root.nitroLoader = null;
      startApp();
      if (root.nitroApp) {
        root.nitroApp.show('screen-menu');
        root.nitroApp.audio.startMenuPad();
      }
    });
    root.nitroLoader.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
