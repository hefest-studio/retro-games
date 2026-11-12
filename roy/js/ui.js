/* РОЙ · DOM-обвязка: подгонка canvas под экран, локализация подписей страницы,
   тема страницы, тач-кнопка паузы. ROY.ui.init(g) */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};
  function $(id) { return document.getElementById(id); }

  // Canvas вписывается и по ширине, и по высоте окна (портрет 3:4).
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 20 : 0;
    var availH = innerHeight - padH - 64;
    var w = Math.min(480, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
    w = Math.max(240, Math.floor(w));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }

  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang;
      document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      var pb = $('bPause'); if (pb) pb.title = g.t('pause');
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  R.ui = {
    init: function (g) {
      fit(g); addEventListener('resize', function () { fit(g); });
      sync(g); setInterval(function () { sync(g); }, 250);
      var pb = $('bPause');
      if (pb) {
        var onPause = function (e) {
          e.preventDefault();
          if (g._sceneName === 'play') g.pause();
          else if (g._sceneName === 'pause') g.goto('play', { resume: true });
        };
        pb.addEventListener('touchstart', onPause, { passive: false }); pb.addEventListener('click', onPause);
      }
    },
    fit: fit, sync: sync
  };
})(typeof window !== 'undefined' ? window : globalThis);
