/* КОРОМЫСЛО · DOM-обвязка: подгонка канвы под окно (портрет 9:16 по высоте и ширине, без прокрутки), подписи страницы по языку,
   тема страницы. Рисование — js/render.js. KOROMYSLO.ui */
(function (global) {
  'use strict';
  var K = global.KOROMYSLO = global.KOROMYSLO || {};
  function $(id) { return document.getElementById(id); }
  function fit(g) {
    var c = g.canvas, foot = $('foot'), footH = foot && getComputedStyle(foot).display !== 'none' ? foot.offsetHeight + 14 : 0;
    var availH = innerHeight - 36 - footH - 8, availW = Math.min(innerWidth - 16, 520);
    var w = Math.max(180, Math.floor(Math.min(availW, availH * g.W / g.H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - innerHeight;   // страховка от прокрутки (площадки)
    if (over > 0 && w > 180) { w = Math.max(180, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
  }
  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang;
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      var pb = $('bPause'); if (pb) { pb.title = g.t('pause'); pb.setAttribute('aria-label', g.t('pause')); }
      fit(g);
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }
  K.ui = {
    init: function (g) {
      fit(g); addEventListener('resize', function () { fit(g); }); addEventListener('orientationchange', function () { setTimeout(function () { fit(g); }, 120); });
      (function loop() { sync(g); requestAnimationFrame(loop); })();
    },
    fit: fit
  };
})(typeof window !== 'undefined' ? window : globalThis);
