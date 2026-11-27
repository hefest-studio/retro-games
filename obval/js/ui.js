/* ОБВАЛ · DOM-обвязка: выбор ориентации холста (портрет 450×800 или альбом 800×450 — по окну), подгонка под окно без прокрутки,
   подписи страницы по языку, тема страницы. Рисование — js/render.js. OBVAL.ui */
(function (global) {
  'use strict';
  var SW = global.OBVAL = global.OBVAL || {};
  function $(id) { return document.getElementById(id); }
  function viewport() {
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth), vh = Math.min(innerHeight, (global.visualViewport && global.visualViewport.height) || innerHeight);
    return { w: vw, h: vh };
  }
  function orient(g) {   // альбом, если окно заметно шире высоты; размер холста меняем только при смене ориентации
    var v = viewport(), wantL = v.w >= v.h * 1.15, isL = g.W > g.H;
    if (wantL !== isL) { g.W = wantL ? 800 : 450; g.H = wantL ? 450 : 660; g.canvas.width = g.W; g.canvas.height = g.H; }
  }
  function fit(g) {
    orient(g);
    var c = g.canvas, pad = $('pad'), foot = $('foot'), v = viewport(), cs = pad && getComputedStyle(pad), fs = foot && getComputedStyle(foot);
    var padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 12 : 0, footH = fs && fs.display !== 'none' ? foot.offsetHeight + 16 : 0;
    var top = g.W > g.H && cs && cs.position === 'fixed' ? 24 : 34;
    var availW = Math.min(v.w - 12, 1280), availH = v.h - padH - footH - top - 6;
    var w = Math.max(200, Math.floor(Math.min(availW, availH * g.W / g.H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - v.h;   // страховка от прокрутки (площадки)
    if (over > 0 && w > 200) { w = Math.max(200, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
  }
  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; var f = $('foot'); if (f) f.innerHTML = g.t('foot');
      var pb = document.querySelector('[data-pause]'); if (pb) { pb.title = g.t('pause'); pb.setAttribute('aria-label', g.t('pause')); }
      document.querySelectorAll('[data-act]').forEach(function (b) { b.setAttribute('aria-label', g.t(b.getAttribute('data-act'))); b.title = g.t(b.getAttribute('data-act')); });
      fit(g);
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }
  SW.ui = {
    init: function (g) {
      fit(g); addEventListener('resize', function () { fit(g); }); addEventListener('orientationchange', function () { setTimeout(function () { fit(g); }, 120); });
      if (document.documentElement) new MutationObserver(function () { fit(g); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-input'] });
      (function loop() { sync(g); requestAnimationFrame(loop); })();
    },
    fit: fit
  };
})(typeof window !== 'undefined' ? window : globalThis);
