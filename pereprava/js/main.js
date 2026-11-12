/* ПЕРЕПРАВА · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js)
   + рендеры retro/modern + звук. Сцены title/pause/win/gameover — g.useStandardScreens,
   титул переопределён: живой двор (транспорт и канал движутся) + меню движка.
   Ввод: стрелки/WASD (нажатие — прыжок, удержание — повтор, нажатие во время прыжка — в буфер),
   тач-кнопки (bindDpad), свайпы и тап (вперёд) по канве. */
(function (global) {
  'use strict';
  var K = global.PEREPRAVA, L = K.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0f1318', panel: '#141a21', ink: '#eef2f8', muted: '#8d98a8', accent: '#ff8a3d', grid: '#232b35' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#fc9838', muted: '#a4a4a4' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'pereprava', strings: K.STR, theme: 'modern', lives: 3, themes: themes });
  K.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  K.ui.init(g);

  function rnd() { return g.themeName === 'retro' ? K.classic : K.modern; }
  var game = null, toasts = [], playSince = 0, queued = null, lastMove = 0, holdDir = null, holdSince = 0;
  var HOLD_DELAY = 0.28, HOLD_RATE = 0.2, BUFFER = 0.14;

  // Сложность уровня — через g.difficulty движка (множитель скорости 1.0, без шага: кривая — в buildLevel)
  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.9 && Math.abs(toasts[i].y - y) < 16) y -= 18;
    toasts.push({ text: text, color: color, x: Math.max(70, Math.min(L.W - 70, x)), y: y, t: 1.4 });
  }
  function fx(type, d) {
    var pix = rnd().P.pixel, sz = pix ? 4 : 3;
    if (type === 'die') {
      var wet = d.reason === 'water' || d.reason === 'edge' || d.reason === 'fish';
      g.particles.spawn(d.x, d.y, { color: wet ? '#8fd8ff' : '#ffb03a', count: wet ? 14 : 18, speed: wet ? 70 : 120, life: 0.6, size: sz });
    } else if (type === 'bay' || type === 'prize' || type === 'mate') {
      g.particles.spawn(d.x, L.rowY(0) + L.RH / 2, { color: type === 'prize' ? '#ffd36b' : '#ff8a3d', count: 14, speed: 90, life: 0.6, size: sz });
    }
  }
  function onEvent(type, d) {
    K.sfx(g, type, d); fx(type, d);
    var P = rnd().P, by = L.rowY(1) + 10;
    if (type === 'bay') toast(g.t('t_bay') + ' +' + (L.PTS.bay + d.secs * L.PTS.sec), P.accent, d.x, by);
    else if (type === 'prize') toast(g.t('t_prize') + ' +' + L.PTS.prize, P.warn, d.x, by + 18);
    else if (type === 'mate') toast(g.t('t_mate') + ' +' + L.PTS.mate, P.good, d.x, by + 36);
    else if (type === 'pickup' && game) toast(g.t('t_pickup'), P.good, d.x, L.rowY(game.state().hero.row) - 4);
    else if (type === 'extra') toast(g.t('t_extra'), P.good, L.W / 2, L.rowY(L.START) - 10);
    else if (type === 'trap') toast(g.t('t_trap'), P.bad, d.x, by);
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }

  function newGame() {
    game = K.Game({ lives: 3, level: 1, difficulty: diff, onEvent: onEvent });
    game.start(); K.current = game; toasts = []; queued = null; holdDir = null; sync();
  }
  function move(dir) {
    if (!game) return;
    var S = game.state();
    if (S.phase !== 'play') return;
    if (S.hero.hop) { queued = { dir: dir, at: g.time }; return; }
    if (game.move(dir)) lastMove = g.time;
  }

  // ---------- Стандартные экраны + фон двора на всех экранах ----------
  g.useStandardScreens({ lives: 3 });
  // P/Esc на паузе — продолжить (меню паузы движка остаётся)
  var pauseSc = g.scenes.pause, basePress = pauseSc.press;
  pauseSc.press = function (a) { if (a === 'pause') { this.goto('play', { resume: true }); return; } if (basePress) basePress.call(this, a); };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this); };

  // ---------- Титул: живой двор без героя ----------
  var demo = null, demoLevels = [3, 6, 8, 10, 5], demoI = 0;
  function makeDemo() { demo = K.Game({ level: demoLevels[demoI++ % demoLevels.length], maxLevel: 99, lives: 99, rng: function () { return 0.5; } }).start(); demo.state().banner = 0; }
  makeDemo();
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) {
    var S = demo.state(); S.timer = 99; S.banner = 0; S.hero.row = L.START; S.hero.hop = null;
    demo.update(Math.min(dt, 0.05));
    if (S.time > 40) makeDemo();
  };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H;
    r.draw(ctx, demo.state(), this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.66)' : 'rgba(10,13,17,.62)'; ctx.fillRect(0, 0, W, H);
    var pw = 384, ph = 340, px = (W - pw) / 2, py = 140;
    K.ui.box(ctx, P, px, py, pw, ph, retro ? P.hudLine : '#2c3644', 18);
    K.ui.txt(this, this.t('title'), W / 2, py + 62, { size: retro ? 44 : 46, align: 'center', color: P.accent, weight: 900 }, P);
    if (retro) K.classic.lifeIcon(ctx, W / 2, py + 92, true);
    else { K.modern.hero(ctx, W / 2 - 46, py + 94, 'right', 0, 1.35, false, g.time); K.modern.gear(ctx, W / 2, py + 94, 12, 8, g.time, '#ffd36b'); K.modern.washer(ctx, W / 2 + 46, py + 96, 1.15, g.time, -1); }
    K.ui.txt(this, this.t('subtitle'), W / 2, py + 132, { size: 13, align: 'center', color: th.muted, weight: 600 }, P);
    menu.draw(this, W / 2, py + 176, 32);
    if (this.state.best) K.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 16, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    K.ui.txt(this, this.t('hint'), W / 2, H - 22, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
  };

  // ---------- Игровая сцена ----------
  var DIRK = { up: 'up', down: 'down', left: 'left', right: 'right' };
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; queued = null; holdDir = null; },
    press: function (a) {
      if (!game) return;
      if (a === 'pause') { this.pause(); return; }
      if (g.time - playSince < 0.12) return;
      if (DIRK[a]) { move(a); holdDir = a; holdSince = g.time; }
    },
    update: function (dt) {
      if (!game) return;
      var S = game.state();
      // буфер: нажатие во время прыжка срабатывает при приземлении
      if (queued && !S.hero.hop && S.phase === 'play') { if (g.time - queued.at <= BUFFER + 0.15) { if (game.move(queued.dir)) lastMove = g.time; } queued = null; }
      // удержание: повтор прыжков
      var dx = this.input.dir.x, dy = this.input.dir.y;
      var held = dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : dx > 0 ? 'right' : null;
      if (held !== holdDir) { holdDir = held; holdSince = g.time; }
      if (held && S.phase === 'play' && !S.hero.hop && g.time - holdSince > HOLD_DELAY && g.time - lastMove > HOLD_RATE) { if (game.move(held)) lastMove = g.time; }
      game.update(dt);
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) rnd().draw(ctx, game.state(), this, { toasts: toasts }); else this.clear(); }
  });

  // ---------- Свайпы и тап по канве ----------
  var cv = g.canvas, touch = null;
  function live() { return g._sceneName === 'play' && game && g.time - playSince > 0.2; }
  cv.addEventListener('touchstart', function (e) {
    if (!live()) return; e.preventDefault();
    var t = e.changedTouches[0]; touch = { id: t.identifier, x: t.clientX, y: t.clientY, at: Date.now() };
  }, { passive: false });
  cv.addEventListener('touchmove', function (e) { if (touch && live()) e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchend', function (e) {
    if (!touch) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i]; if (t.identifier !== touch.id) continue;
      if (live()) {
        e.preventDefault();
        var dx = t.clientX - touch.x, dy = t.clientY - touch.y, ad = Math.max(Math.abs(dx), Math.abs(dy));
        if (ad >= 18) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        else if (Date.now() - touch.at < 300) move('up');   // короткий тап — прыжок вперёд
      }
      touch = null;
    }
  }, { passive: false });

  g.start('title');
  K.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
