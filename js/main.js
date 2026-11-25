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

  function boot() {
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
