/* ГЛУБЬ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: стартовый экран шахты + меню движка.
   Ввод: ←→/AD — ходить; Пробел/Z/↑/W — прыжок; ↑↓ — лестницы; X/Shift/K — крот (с ↓ — вниз); Tab/C — карта;
   тач: дпад, ● — прыжок, ⛏ — крот, ▦ — карта, II — пауза. */
(function (global) {
  'use strict';
  var Gb = global.GLUB, L = Gb.logic, T = Gb.ui.T, OY = Gb.ui.OY;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0d0b11', panel: '#17131c', ink: '#f3ede4', muted: '#a69cae', accent: '#ffb347', grid: '#2a2431' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.COLS * T, H = OY + L.ROWS * T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'glub', strings: Gb.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  Gb.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var Store = Arcade.Store, TKEY = 'arcade.besttime.glub';

  function rnd() { return g.themeName === 'retro' ? Gb.classic : Gb.modern; }
  var game = null, toasts = [], playSince = 0, mapOpen = false, fade = 0, intro = 0, extraJump = false, lastTime = null;
  function px(x) { return x * T; }
  function py(y) { return OY + y * T; }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.crystals.length; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > toasts[i].life - 0.5 && Math.abs(toasts[i].y - y) < 16) y -= 18;
    var life = big ? 2.2 : 1.4;
    toasts.push({ text: text, color: color, x: Math.max(80, Math.min(W - 80, x)), y: Math.max(OY + 20, y), t: life, life: life, big: !!big });
  }
  function bestTime() { var v = parseFloat(Store.get(TKEY, '0')); return v > 0 ? v : null; }

  function onEvent(type, d) {
    d = d || {};
    Gb.sfx(g, type, d);
    var P = rnd().P, CC = rnd().CC, sz = P.pixel ? 4 : 3, retro = P.pixel;
    switch (type) {
      case 'crystal':
        toast(g.t('c' + d.cid) + ' · ' + d.n + '/8', CC[d.cid], px(d.x), py(d.y) - 20, true);
        g.particles.spawn(px(d.x), py(d.y), { color: CC[d.cid], count: 30, speed: 150, life: 0.9, size: sz }); break;
      case 'gateOpen': toast(g.t('gateOpen'), P.accent, W / 2, OY + 90, true); break;
      case 'beacon': if (d.fresh) toast(g.t('beacon'), P.good, px(d.x), py(d.y) - 50); else toast(g.t('refill'), P.good, px(d.x), py(d.y) - 50);
        g.particles.spawn(px(d.x), py(d.y) - 30, { color: retro ? '#55ffff' : '#7ff6ff', count: 14, speed: 80, life: 0.6, size: sz }); break;
      case 'nugget': toast('+' + d.pts, P.accent, px(d.x), py(d.y) - 12); g.particles.spawn(px(d.x), py(d.y), { color: '#ffd35a', count: 8, speed: 70, life: 0.4, size: sz }); break;
      case 'tank': toast(g.t('tank'), P.good, px(d.x), py(d.y) - 20); break;
      case 'stun': toast(g.t('stun'), P.warn, px(d.x), py(d.y) - 16); g.particles.spawn(px(d.x), py(d.y) + 54, { color: retro ? '#aaaaaa' : '#9b8a78', count: 14, speed: 90, life: 0.5, size: sz }); break;
      case 'thud': { var Hh = game.state().hero; g.particles.spawn(px(Hh.x), py(Hh.y), { color: retro ? '#aaaaaa' : '#9b8a78', count: 6, speed: 50, life: 0.3, size: sz }); break; }
      case 'hurt': g.particles.spawn(px(d.x), py(d.y), { color: P.bad, count: 12, speed: 110, life: 0.5, size: sz }); break;
      case 'die': g.particles.spawn(px(d.x), py(d.y), { color: '#ffd166', count: 40, speed: 170, life: 1, size: sz }); break;
      case 'dug': toast(g.t('dug'), P.soft, px(d.x), py(d.y) - 20); g.particles.spawn(px(d.x), py(d.y), { color: retro ? '#aa5500' : '#b07a48', count: 24, speed: 120, life: 0.7, size: sz + 1 }); break;
      case 'clank': toast(g.t('clank'), P.muted, px(d.x), py(d.y) - 16); g.particles.spawn(px(d.x), py(d.y), { color: '#ffffff', count: 5, speed: 60, life: 0.2, size: 2 }); break;
      case 'kill': toast('+' + d.pts, P.accent, px(d.x), py(d.y) - 16); g.particles.spawn(px(d.x), py(d.y), { color: retro ? '#aa5500' : '#d98b52', count: 16, speed: 110, life: 0.5, size: sz }); break;
      case 'room': fade = retro ? 0 : 0.5; toasts = toasts.filter(function (o) { return o.big; }); break;
      case 'win': {
        var bt = bestTime(); if (!bt || d.time < bt) Store.set(TKEY, String(Math.round(d.time * 10) / 10));
        lastTime = d.time; sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 1400); break;
      }
      case 'gameover': sync(); g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 600); break;
    }
    sync();
  }
  function newGame() {
    game = Gb.Game({ onEvent: onEvent }); game.start(); Gb.current = game;
    toasts = []; mapOpen = false; fade = 0; intro = 3; lastTime = null; sync();
  }
  function moleAct() { if (g._sceneName === 'play' && game && !mapOpen && g.time - playSince > 0.15) game.mole(); }
  function mapAct() { if (g._sceneName === 'play' && game && game.state().phase === 'play') { mapOpen = !mapOpen; g.audio.beep(mapOpen ? 660 : 440, 0.05, 'triangle', 0.03); } }
  Gb.ui.init(g, { mole: moleAct, map: mapAct });

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
      if (name === 'win' && lastTime != null) Gb.ui.txt(this, this.t('time') + ': ' + Gb.ui.clock(lastTime) + (bt ? '   ' + this.t('bestTime') + ': ' + Gb.ui.clock(bt) : ''), this.W / 2, y, { size: 14, align: 'center', color: P.accent, weight: 700 }, P);
      else if (game) Gb.ui.txt(this, this.t('crystal') + ': ' + game.state().crystals.length + '/8 · ' + this.t('time') + ': ' + Gb.ui.clock(game.state().time), this.W / 2, y, { size: 13, align: 'center', color: P.muted, weight: 700 }, P);
    };
  });

  // ---------- Титул: стартовый экран шахты + меню движка ----------
  var demo = Gb.Game({ rng: L.mulberry32(3) }).start(), DS = demo.state();
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { DS.time += dt; DS.hero.face = Math.sin(DS.time * 0.4) > 0 ? 1 : -1; };
  title.draw = function (ctx) {
    var th = this.th(), R = rnd(), P = R.P, retro = P.pixel, Wc = this.W, Hc = this.H;
    R.draw(ctx, DS, this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.7)' : 'rgba(8,6,12,.55)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 430, ph = 318, x0 = (Wc - pw) / 2, y0 = 46;
    Gb.ui.panel(ctx, x0, y0, pw, ph, P, retro ? P.line : '#4a3d55');
    Gb.ui.txt(this, this.t('title'), Wc / 2, y0 + 56, { size: retro ? 44 : 50, align: 'center', color: P.accent, weight: 900 }, P);
    for (var k = 1; k <= 8; k++) R.crystalIcon(ctx, Wc / 2 - 77 + (k - 1) * 22, y0 + 76, k, 6, true, this.time);
    Gb.ui.txt(this, this.t('subtitle'), Wc / 2, y0 + 104, { size: retro ? 10 : 12, align: 'center', color: th.ink, weight: 700 }, P);
    Gb.ui.txt(this, this.t('sub2'), Wc / 2, y0 + 121, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, P);
    var HH = { x: 0, y: 0, face: 1, ground: true, climb: false, walkT: 0, stun: 0 };
    R.hero(ctx, x0 + 46, y0 + 260, HH, this.time, {});
    R.mole(ctx, x0 + pw - 50, y0 + 252, -1, this.time, false);
    menu.draw(this, Wc / 2, y0 + 160, 28);
    var bt = bestTime(), line = [];
    if (this.state.best) line.push(this.t('best') + ': ' + this.state.best);
    if (bt) line.push(this.t('bestTime') + ': ' + Gb.ui.clock(bt));
    if (line.length) Gb.ui.txt(this, line.join(' · '), Wc / 2, y0 + ph - 14, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
    Gb.ui.txt(this, this.t('hint'), Wc / 2, Hc - 14, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, P);
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
      R.draw(ctx, S, this, { toasts: toasts, fade: fade, intro: intro > 0 && S.time < 3 ? intro : 0 });
      if (mapOpen) Gb.ui.mapOverlay(this, ctx, S, R.P, R);
    }
  });

  // ---------- Доп. клавиши ----------
  var JUMP = { KeyZ: 1, KeyJ: 1 }, MOLE = { KeyX: 1, KeyK: 1, ShiftLeft: 1, ShiftRight: 1 }, MAP = { Tab: 1, KeyC: 1 }, held = {};
  addEventListener('keydown', function (e) {
    var inPlay = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extraJump = true; if (inPlay) e.preventDefault(); }
    if (MOLE[e.code] && !e.repeat && inPlay) { e.preventDefault(); moleAct(); }
    if (MAP[e.code] && !e.repeat && inPlay) { e.preventDefault(); mapAct(); }
    if (e.code === 'Tab' && inPlay) e.preventDefault();
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extraJump = !!(held.KeyZ || held.KeyJ); } });
  addEventListener('blur', function () { held = {}; extraJump = false; });

  g.start('title');
  Gb.app = { g: g, game: function () { return game; }, map: function () { return mapOpen; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
