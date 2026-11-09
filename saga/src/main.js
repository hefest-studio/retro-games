/* LOST VIKINGS · main — запуск, rAF-цикл, URL-параметры для скриншотов/тестов. */
(function () {
  "use strict";

  var game, audio, ui, lastTime = 0, drawWarned = false;
  var booted = false;

  function qs(name) {
    try {
      var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }

  function boot() {
    if (booted) return;
    booted = true;
    game = window.LV_GAME;
    audio = window.LV_AUDIO;
    ui = window.LV_UI;

    var levels = window.LV_LEVELS || [];

    game.init({
      levels: levels,
      audio: audio,
      onEvent: function (name, data) { ui.onGameEvent(name, data); }
    });

    ui.init({
      game: game,
      audio: audio,
      levels: levels,
      renderers: {
        retro: window.LV_RETRO,
        modern: window.LV_MODERN
      }
    });

    // URL-параметры: #shot=..., ?gfx=retro&lang=en&level=3&screen=play&mute=1
    var gfx = qs("gfx");
    if (gfx === "retro" || gfx === "modern") ui.debug.setGfx(gfx);
    var lang = qs("lang");
    if (lang === "ru" || lang === "en") ui.debug.setLang(lang);
    if (qs("mute") === "1") ui.debug.setAudioMuted(true);

    var level = parseInt(qs("level"), 10);
    if (level >= 1 && level <= levels.length) {
      var screen = qs("screen") || "play";
      if (screen === "intro") ui.debug.openIntro(level - 1);
      else ui.debug.beginLevel(level - 1);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && ui.getScreen() === "playing") ui.nav("pause");
    });

    window.LV = {
      game: game, ui: ui, audio: audio,
      version: "1.0.0",
      startLevel: function (n) { ui.debug.beginLevel((n | 0) - 1); }
    };

    requestAnimationFrame(loop);
  }

  function loop(ts) {
    var dt = lastTime ? Math.min(0.05, (ts - lastTime) / 1000) : 0;
    lastTime = ts;

    var world = ui.isWorldVisible();
    if (world) {
      try { game.update(dt); } catch (e) { warnOnce("update", e); }
    }

    var target = ui.getRenderTarget();
    if (target && target.renderer && target.canvas) {
      try {
        if (world) target.renderer.draw(game.getView());
        else target.renderer.drawTitle(target.canvas, ts / 1000);
      } catch (e) { warnOnce("draw", e); }
    }

    try { ui.frame(dt); } catch (e) { warnOnce("ui", e); }

    requestAnimationFrame(loop);
  }

  function warnOnce(kind, err) {
    if (drawWarned) return;
    drawWarned = true;
    try { console.error("LV " + kind + " error:", err && (err.stack || err.message || err)); } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
