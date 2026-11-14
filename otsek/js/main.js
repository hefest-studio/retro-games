/* ОТСЕК · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2,
   подсказка). Ввод: ход (left/right/up/down), огонь (держишь — направление и луч фонаря не поворачиваются),
   действие (двери, терминалы, пульт), смена оружия. В терминале: ↑↓ — выбор, ←→ — вкладка, огонь — взять, действие — выход.
   Тач — крестовина + ● огонь (через движок) и ◆ действие / ⇄ оружие (свои кнопки), только И1. */
(function (global) {
  'use strict';
  var OT = global.OTSEK, L = OT.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0b0e11', panel: '#12171b', ink: '#eef1f2', muted: '#9aa6ad', accent: '#d6e04f', grid: '#262e33' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#e0e040', muted: '#a8a8b8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.VIEW_W, height: L.SCREEN_H, gameId: 'otsek', strings: OT.STR, theme: 'modern', lives: 3, themes: themes });
  OT.g = g;
  var pad = document.querySelector('.pad');
  OT.ui.init(g);
  function pal() { return g.themeName === 'retro' ? OT.classic : OT.modern; }

  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND, actions: ['fire', 'use', 'swap'], pad: pad,
    touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'fire' },
    hint: { ru: [OT.STR.ru.hint1, OT.STR.ru.hint2], en: [OT.STR.en.hint1, OT.STR.en.hint2] }
  });
  g.input.bindDpad(pad);

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0, prevDir = [{}, {}];
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y, big, screen) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.4, big: big, screen: screen }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!d || d.x == null) return;
    var P = pal(), c = OT.ui.cam, sx = d.x - c.x, sy = d.y - c.y + L.HUD, sz = P.pixel ? 4 : 3;
    if (sx < -40 || sy < -40 || sx > g.W + 40 || sy > g.H + 40) return;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: d.type === 'nest' ? P.nestHole : d.type === 'carpet' ? P.carpet : P.ember, count: d.type === 'nest' ? 26 : d.type === 'carpet' ? 16 : 8, speed: 110, life: 0.45, size: sz });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: P.hero[d.pi], count: 24, speed: 140, life: 0.8, size: sz });
    else if (type === 'breach') g.particles.spawn(sx, sy, { color: P.partEdge, count: 18, speed: 120, life: 0.5, size: sz });
    else if (type === 'bossDie') g.particles.spawn(sx, sy, { color: P.core, count: 80, speed: 240, life: 1.4, size: sz + 1 });
    else if (type === 'door') g.particles.spawn(sx, sy, { color: P.doorPath, count: 10, speed: 70, life: 0.4, size: 2 });
    else if (type === 'wallHit' && d.k === 'c') g.particles.spawn(sx, sy, { color: P.cutter, count: 5, speed: 60, life: 0.25, size: 2 });
  }
  function onEvent(type, d) {
    OT.sfx(g, type, d); fx(type, d);
    var P = pal(), W = L.VIEW_W;
    if (type === 'card') toast(g.t('card'), P.card, d.x, d.y - 14, true);
    else if (type === 'pickup') toast(g.t(d.kind === 'ammo' ? 'ammoUp' : d.kind), d.kind === 'med' ? P.good : d.kind === 'cache' ? P.accent : P.token, d.x, d.y - 12, d.kind === 'cache');
    else if (type === 'doorDenied') toast(g.t('denied'), P.bad, d.x, d.y - 20, true);
    else if (type === 'empty') toast(g.t('empty'), P.bad, d.x, d.y - 26, false);
    else if (type === 'breach') toast(g.t('breach'), P.partEdge, d.x, d.y - 14, false);
    else if (type === 'console') toast(g.t('console'), P.bad, W / 2, L.HUD + 150, true, true);
    else if (type === 'blast') toast(g.t('blast'), P.bad, W / 2, L.HUD + 180, true, true);
    else if (type === 'buy') toast(g.t('bought') + ': ' + g.t('s_' + d.id), P.termScreen, W / 2, L.HUD + 20, false, true);
    if (type === 'heroDie' || type === 'door' || type === 'breach') shakeT = Math.max(shakeT, 0.22);
    if (type === 'heroHurt') shakeT = Math.max(shakeT, 0.08);
    if (type === 'bossDie' || type === 'blast') shakeT = 1.2;
    if (type === 'alarm') shakeT = 0.6;
    sync();
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame(o) {
    game = OT.Game(Object.assign({ players: g.input.playerCount, onEvent: onEvent, seed: Math.floor(Math.random() * 1e6) }, o || {}));
    OT.current = game; toasts = []; shakeT = 0; prevDir = [{}, {}]; game.start(); sync();
  }
  function act(pi, name) {
    if (!game || g._sceneName !== 'play') return;
    var S = game.state();
    if (S.phase === 'term') {
      if (S.term.pi !== pi) return;
      if (name === 'use') game.termClose(); else if (name === 'fire') game.termBuy(); else if (name === 'swap') game.termTab(1);
      return;
    }
    if (name === 'use') game.use(pi); else if (name === 'swap') game.swap(pi);
  }
  [0, 1].forEach(function (pi) { g.input.player(pi).onPress(function (name) { act(pi, name); }); });
  // терминал с клавиатуры: каждое нажатие стрелки/WASD того, кто у терминала (в одиночку — обе раскладки)
  addEventListener('keydown', function (e) {
    if (!game || g._sceneName !== 'play' || game.state().phase !== 'term') return;
    var pi = game.state().term.pi, maps = g.input.playerCount === 2 ? [L.BIND['p' + (pi + 1)]] : [L.BIND.p1, L.BIND.p2];
    maps.forEach(function (m) {
      if (m.up.indexOf(e.code) >= 0) game.termMove(-1); else if (m.down.indexOf(e.code) >= 0) game.termMove(1);
      else if (m.left.indexOf(e.code) >= 0) game.termTab(-1); else if (m.right.indexOf(e.code) >= 0) game.termTab(1);
    });
  });
  // свои тач-кнопки (◆ действие, ⇄ оружие) — И1
  if (pad) pad.querySelectorAll('[data-act]').forEach(function (b) {
    var name = b.getAttribute('data-act');
    var on = function (e) { e.preventDefault(); act(0, name); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
  });

  // ---------- Титул: палуба во тьме, луч фонаря и рой ----------
  var demo = OT.Game({ players: 2, seed: 7, rng: L.mulberry32(3) }).start(), demoT = 0;
  (function () {
    var S = demo.state(), D = S.D, r = D.rooms.filter(function (q) { return q.c !== D.start && q.c !== D.goal && q.x1 - q.x0 >= 8; })[0] || D.rooms[1];
    S.banner = 0; S.enemies = [];
    S.heroes[0].x = (r.x0 + 2) * L.T; S.heroes[0].y = r.crow * L.T; S.heroes[1].x = (r.x0 + 1) * L.T; S.heroes[1].y = (r.crow + 1.5) * L.T;
    var rng = L.mulberry32(5);
    for (var i = 0; i < 14; i++) demo._spawn('tick', (r.x0 + 5 + rng() * (r.x1 - r.x0 - 5)) * L.T, (r.y0 + 1 + rng() * (r.y1 - r.y0 - 1)) * L.T, { awake: true, vx: -1, vy: 0 });
    demo._spawn('carpet', (r.x1 - 1) * L.T, (r.crow + 1) * L.T, { awake: true });
    demo._spawn('spike', (r.x1) * L.T, (r.y0 + 1) * L.T, { awake: true });
  })();
  function demoState() {
    var S = demo.state();
    S.heroes.forEach(function (h, i) { h.out = i >= g.input.playerCount; var a = Math.sin(demoT * 0.7 + i * 1.4) * 0.7; h.face = [Math.cos(a), Math.sin(a)]; });
    S.enemies.forEach(function (e) { e.t += 0.016; e.vx = Math.cos(e.t * 0.7 + e.id); e.vy = Math.sin(e.t * 0.9 + e.id); });
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    OT.ui.render(this, ctx, demoState(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.35)' : 'rgba(4,6,8,.35)'; ctx.fillRect(0, 0, W, H);
    var pw = 420, ph = 330, px = (W - pw) / 2, py = 40;
    OT.ui.panel(ctx, px, py, pw, ph, P, P.accent);
    OT.ui.txt(this, this.t('title'), W / 2, py + 70, { size: 60, align: 'center', color: P.accent, weight: 900 }, P);
    OT.ui.txt(this, this.t('subtitle'), W / 2, py + 96, { size: 11, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    menu.draw(this, W / 2, py + 146, 30);
    if (this.state.best) OT.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    this.menu._drawHint('title');
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') OT.ui.render(this, this.ctx, game ? game.state() : demoState(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var S = game.state();
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), on = pi < g.input.playerCount && pi < S.heroes.length;
        var mx = on ? (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0) : 0, my = on ? (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0) : 0;
        if (S.phase === 'term') {
          if (S.term.pi === pi && pi === 0) {   // тач-крестовина листает терминал (клавиатура — по keydown ниже)
            var tc = g.input._touch, tx = (tc.right ? 1 : 0) - (tc.left ? 1 : 0), ty = (tc.down ? 1 : 0) - (tc.up ? 1 : 0), pd = prevDir[pi];
            if (ty && ty !== pd.ty) game.termMove(ty); if (tx && tx !== pd.tx) game.termTab(tx);
            prevDir[pi] = { tx: tx, ty: ty };
          }
          if (pi < S.heroes.length) { game.setMove(pi, 0, 0); game.setFire(pi, false); }
        } else if (pi < S.heroes.length) { game.setMove(pi, mx, my); game.setFire(pi, on && P.pressed('fire')); prevDir[pi] = {}; }
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) OT.ui.render(this, ctx, game.state(), pal(), { toasts: toasts, game: game, shake: shakeT > 0 ? 5 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  OT.app = { g: g, game: function () { return game; }, newGame: newGame, demo: demo };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
