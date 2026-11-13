/* УГОЛЁК · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: стартовый экран шахты + меню движка.
   Ввод: ←→/AD — ходить; Пробел/Z/↑/W — прыжок; ↑↓ — лестницы и верёвки; Tab/C — карта;
   тач: дпад, ● — прыжок, ▦ — карта, II — пауза. */
(function (global) {
  'use strict';
  var U = global.UGOLYOK, L = U.logic, T = U.ui.T, OY = U.ui.OY;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0f0c0b', panel: '#191311', ink: '#f4ece6', muted: '#a8998f', accent: '#ff6b3d', grid: '#2c2421' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ff5555', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.COLS * T, H = OY + L.ROWS * T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'ugolyok', strings: U.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  U.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var Store = Arcade.Store, TKEY = 'arcade.besttime.ugolyok';

  function rnd() { return g.themeName === 'retro' ? U.classic : U.modern; }
  var game = null, toasts = [], playSince = 0, mapOpen = false, fade = 0, intro = 0, extraJump = false, lastTime = null, lastWhy = null;
  function px(x) { return x * T; }
  function py(y) { return OY + y * T; }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.coal; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > toasts[i].life - 0.5 && Math.abs(toasts[i].y - y) < 16) y -= 18;
    var life = big ? 2.2 : 1.3;
    toasts.push({ text: text, color: color, x: Math.max(90, Math.min(W - 90, x)), y: Math.max(OY + 20, y), t: life, life: life, big: !!big });
  }
  function bestTime() { var v = parseFloat(Store.get(TKEY, '0')); return v > 0 ? v : null; }

  function onEvent(type, d) {
    d = d || {};
    U.sfx(g, type, d);
    var R = rnd(), P = R.P, sz = P.pixel ? 4 : 3, retro = P.pixel;
    switch (type) {
      case 'coal':
        toast('+' + L.PTS.coal + ' · ' + d.n + '/' + d.total, P.accent, px(d.x), py(d.y) - 14);
        g.particles.spawn(px(d.x), py(d.y), { color: retro ? '#ffaa00' : '#ff8a3a', count: 14, speed: 90, life: 0.5, size: sz }); break;
      case 'roomClear': toast(g.t('roomClear') + ' +' + d.pts, P.good, W / 2, OY + 70, true); break;
      case 'key': toast(g.t('k' + d.key), R.KC[d.key], px(d.x), py(d.y) - 24, true);
        g.particles.spawn(px(d.x), py(d.y), { color: R.KC[d.key], count: 24, speed: 130, life: 0.8, size: sz }); break;
      case 'helmet': toast(g.t('helmet'), P.helmet, px(d.x), py(d.y) - 30, true); break;
      case 'helmetEnd': if (game) { var Hh = game.state().hero; toast(g.t('helmetEnd'), P.muted, px(Hh.x), py(Hh.y) - 60); } break;
      case 'gear': toast('+' + d.pts, P.warn, px(d.x), py(d.y) - 20); g.particles.spawn(px(d.x), py(d.y) - 10, { color: '#ffd35a', count: 10, speed: 80, life: 0.4, size: sz }); break;
      case 'life': toast(g.t('life'), P.good, W / 2, OY + 96, true); break;
      case 'gateOpen': toast(g.t('gateOpen'), P.accent, W / 2, OY + 120, true); break;
      case 'beacon': toast(g.t('beacon'), P.good, px(d.x), py(d.y) - 50);
        g.particles.spawn(px(d.x), py(d.y) - 30, { color: retro ? '#ffff55' : '#ffd27a', count: 14, speed: 80, life: 0.6, size: sz }); break;
      case 'slam': g.particles.spawn(px(d.x), py(d.y), { color: retro ? '#aaaaaa' : '#a89a8e', count: 8, speed: 70, life: 0.35, size: sz }); break;
      case 'thud': { var H0 = game.state().hero; g.particles.spawn(px(H0.x), py(H0.y), { color: retro ? '#aaaaaa' : '#8f8378', count: 6, speed: 50, life: 0.3, size: sz }); break; }
      case 'die': lastWhy = d.why; g.particles.spawn(px(d.x), py(d.y), { color: retro ? '#ffaa00' : '#ff8a3a', count: 40, speed: 170, life: 1, size: sz });
        g.particles.spawn(px(d.x), py(d.y), { color: retro ? '#aaaaaa' : '#6a727e', count: 20, speed: 120, life: 0.9, size: sz + 1 }); break;
      case 'respawn': lastWhy = null; break;
      case 'room': fade = retro ? 0 : 0.45; toasts = toasts.filter(function (o) { return o.big; }); break;
      case 'win': {
        var bt = bestTime(); if (!bt || d.time < bt) Store.set(TKEY, String(Math.round(d.time * 10) / 10));
        lastTime = d.time; sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 1600); break;
      }
      case 'gameover': sync(); g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 600); break;
    }
    sync();
  }
  function newGame() {
    game = U.Game({ onEvent: onEvent }); game.start(); U.current = game;
    toasts = []; mapOpen = false; fade = 0; intro = 3; lastTime = null; lastWhy = null; sync();
  }
  function mapAct() { if (g._sceneName === 'play' && game && game.state().phase === 'play') { mapOpen = !mapOpen; g.audio.beep(mapOpen ? 660 : 440, 0.05, 'triangle', 0.03); } }
  U.ui.init(g, { map: mapAct });

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: L.LIVES });
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this); };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var P = rnd().P, bt = bestTime(), y = this.H / 2 + 42;
      if (name === 'win' && lastTime != null) U.ui.txt(this, this.t('time') + ': ' + U.ui.clock(lastTime) + (bt ? '   ' + this.t('bestTime') + ': ' + U.ui.clock(bt) : ''), this.W / 2, y, { size: 14, align: 'center', color: P.accent, weight: 700 }, P);
      else if (game) U.ui.txt(this, this.t('coal') + ': ' + game.state().coal + '/' + game.state().total + ' · ' + this.t('time') + ': ' + U.ui.clock(game.state().time), this.W / 2, y, { size: 13, align: 'center', color: P.muted, weight: 700 }, P);
    };
  });

  // ---------- Титул: стартовый экран шахты + меню движка ----------
  var demo = U.Game({}).start(), DS = demo.state();
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { DS.time += dt; DS.hero.face = Math.sin(DS.time * 0.4) > 0 ? 1 : -1; };
  title.draw = function (ctx) {
    var th = this.th(), R = rnd(), P = R.P, retro = P.pixel, Wc = this.W, Hc = this.H;
    R.draw(ctx, DS, this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.7)' : 'rgba(10,7,6,.55)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 440, ph = 318, x0 = (Wc - pw) / 2, y0 = 46;
    U.ui.panel(ctx, x0, y0, pw, ph, P, retro ? P.line : '#5a4236');
    U.ui.txt(this, this.t('title'), Wc / 2, y0 + 56, { size: retro ? 44 : 50, align: 'center', color: P.accent, weight: 900 }, P);
    for (var k = 0; k < 5; k++) R.coalIcon(ctx, Wc / 2 - 44 + k * 22, y0 + 76, 7, this.time + k);
    U.ui.txt(this, this.t('subtitle'), Wc / 2, y0 + 104, { size: retro ? 10 : 12, align: 'center', color: th.ink, weight: 700 }, P);
    U.ui.txt(this, this.t('sub2'), Wc / 2, y0 + 121, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, P);
    var HH = { x: 0, y: 0, face: 1, ground: true, climb: false, walkT: 0 };
    R.hero(ctx, x0 + 48, y0 + 262, HH, this.time, { fire: 0.6 });
    menu.draw(this, Wc / 2, y0 + 160, 28);
    var bt = bestTime(), line = [];
    if (this.state.best) line.push(this.t('best') + ': ' + this.state.best);
    if (bt) line.push(this.t('bestTime') + ': ' + U.ui.clock(bt));
    if (line.length) U.ui.txt(this, line.join(' · '), Wc / 2, y0 + ph - 14, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
    U.ui.txt(this, this.t('hint'), Wc / 2, Hc - 14, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, P);
  };

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      if (fade > 0) fade = Math.max(0, fade - dt * 3);
      if (mapOpen) return;
      if (intro > 0) intro -= dt;
      var dir = this.input.dir, live = g.time - playSince > 0.15;
      game.setInput(dir.x, live ? dir.y : 0, live && (this.input.pressed('action') || extraJump));
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var S = game.state(), R = rnd();
      R.draw(ctx, S, this, { toasts: toasts, fade: fade, intro: intro > 0 && S.time < 3 ? intro : 0, why: lastWhy });
      if (mapOpen) U.ui.mapOverlay(this, ctx, S, R.P, R, game);
    }
  });

  // ---------- Доп. клавиши ----------
  var JUMP = { KeyZ: 1, KeyJ: 1 }, MAP = { Tab: 1, KeyC: 1 }, held = {};
  addEventListener('keydown', function (e) {
    var inPlay = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extraJump = true; if (inPlay) e.preventDefault(); }
    if (MAP[e.code] && !e.repeat && inPlay) { e.preventDefault(); mapAct(); }
    if (e.code === 'Tab' && inPlay) e.preventDefault();
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extraJump = !!(held.KeyZ || held.KeyJ); } });
  addEventListener('blur', function () { held = {}; extraJump = false; });

  g.start('title');
  U.app = { g: g, game: function () { return game; }, map: function () { return mapOpen; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
