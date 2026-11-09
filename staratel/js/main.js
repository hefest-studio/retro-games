/* ==========================================================================
   СТАРАТЕЛЬ · Погружение — точка входа
   ========================================================================== */
(function () {
  'use strict';

  function fatal(message) {
    try {
      console.error('[СТАРАТЕЛЬ]', message);
      var box = document.getElementById('fatal');
      if (!box) {
        box = document.createElement('pre');
        box.id = 'fatal';
        box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999;margin:0;padding:12px 16px;' +
          'background:#20040c;color:#ff9fbc;font:12px/1.5 monospace;white-space:pre-wrap;border-top:2px solid #ff4d6d';
        document.body.appendChild(box);
      }
      box.textContent = 'СТАРАТЕЛЬ: ' + message;
    } catch (e) { /* никак */ }
  }

  window.addEventListener('error', function (ev) {
    fatal((ev.message || String(ev.error || 'unknown error')));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    fatal('promise: ' + String(ev.reason || 'unknown'));
  });

  function boot() {
    if (!window.LR || !window.LR.Game || !window.LR.Renderer || !window.LR.UI) {
      fatal('Не загрузились модули игры (game.js / render.js / ui.js).');
      return;
    }
    var levels = window.LR_LEVELS || [];
    if (!Array.isArray(levels) || levels.length === 0) {
      fatal('Не загрузились уровни (js/levels.js).');
      return;
    }

    var canvas = document.getElementById('game');
    if (!canvas) { fatal('Не найден canvas #game.'); return; }

    var game = new window.LR.Game(levels, { audio: window.LR.audio || null });
    var renderer = new window.LR.Renderer(canvas);
    var audio = window.LR.audio || null;
    var ui = new window.LR.UI({ game: game, renderer: renderer, audio: audio });
    ui.init();

    window.__LODE = { game: game, renderer: renderer, ui: ui, levels: levels };

    var last = (window.performance && performance.now) ? performance.now() : Date.now();
    function frame(now) {
      var t = (window.performance && performance.now) ? now : Date.now();
      var dt = (t - last) / 1000;
      last = t;
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > 0.1) dt = 0.1;
      try {
        ui.tick(dt);
      } catch (err) {
        fatal(err && err.stack ? err.stack : String(err));
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
