/* ДРУЖИНА · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер (render.js,
   палитры modern.js / classic.js) + интерфейс (ui.js) + звук. Сцены title/pause/win/gameover — g.useStandardScreens;
   кооп 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2, подсказка, тач — только И1).
   В сцене play сначала выбор героя (в коопе — разные), затем бой; при выбывании всех — «Продолжить?». */
(function (global) {
  'use strict';
  var D = global.DRUZHINA, L = D.logic, Store = Arcade.Store;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#101216', panel: '#171a20', ink: '#f3eee4', muted: '#9ea3ad', accent: '#f0a03c', grid: '#2a2e36' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#1a1c2c', accent: '#ffcd75', muted: '#94b0c2' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.VIEW_W, height: L.SCREEN_H, gameId: 'druzhina', strings: D.STR, theme: 'modern', lives: 3, themes: themes });
  D.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  D.ui.init(g);
  function pal() { return g.themeName === 'retro' ? D.classic : D.modern; }

  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND, actions: ['attack', 'jump', 'magic', 'back'], pad: pad,
    touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'attack' },
    hint: { ru: [D.STR.ru.hint1, D.STR.ru.hint2], en: [D.STR.en.hint1, D.STR.en.hint2] }
  });

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0, sel = null;
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, z) { toasts.push({ text: text, color: color, x: x, z: z, t: 1.3 }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!game || !d || d.x == null) return;
    var S = game.state(), sx = d.x - S.cam, sy = L.FLOOR_TOP + (d.z || 0) - (d.h || 0), P = pal(), sz = P.pixel ? 6 : 3;
    if (type === 'hit') g.particles.spawn(sx, sy, { color: d.knee ? '#ffe0a0' : '#fff2c0', count: 6, speed: 150, life: 0.25, size: sz });
    else if (type === 'block') g.particles.spawn(sx, sy, { color: '#a8d0ff', count: 6, speed: 120, life: 0.2, size: sz });
    else if (type === 'kill') g.particles.spawn(sx, sy - 40, { color: d.boss ? '#ff7a3a' : '#c8ccd4', count: d.boss ? 50 : 12, speed: d.boss ? 240 : 130, life: d.boss ? 1.2 : 0.5, size: sz });
    else if (type === 'thud') g.particles.spawn(sx, sy, { color: '#b89a70', count: d.big ? 14 : 6, speed: 90, life: 0.35, size: sz });
    else if (type === 'pickup') g.particles.spawn(sx, sy - 10, { color: d.kind === 'jug' ? '#6aaaff' : '#ffd080', count: 10, speed: 90, life: 0.5, size: sz });
    else if (type === 'drop') g.particles.spawn(sx, sy - 30, { color: '#ffe080', count: 6, speed: 80, life: 0.3, size: sz });
    else if (type === 'respawn') g.particles.spawn(sx, sy - 40, { color: '#fff0c0', count: 20, speed: 160, life: 0.5, size: sz });
  }
  function onEvent(type, d) {
    D.sfx(g, type, d); fx(type, d);
    var P = pal(), S = game && game.state();
    if (type === 'pickup') toast(g.t(d.kind), d.kind === 'jug' ? P.magic : P.good, d.x, d.z);
    else if (type === 'mount' && S) { var h = S.heroes[d.pi]; toast(g.t('mount'), P.accent, h.x, h.z); }
    else if (type === 'noMagic' && S) { var h2 = S.heroes[d.pi]; toast(g.t('noMagic'), P.muted, h2.x, h2.z); }
    else if (type === 'extraLife' && S) toast(g.t('extraLife'), P.good, S.cam + 480, 60);
    if (type === 'thud' && d.big || type === 'bossAct' && d.move === 'slam') shakeT = Math.max(shakeT, 0.25);
    if (type === 'spell') shakeT = Math.max(shakeT, 0.4);
    if (type === 'bossDie') shakeT = 1.0;
    sync();
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame(heroes, o) {
    game = D.Game(Object.assign({ players: heroes.length, heroes: heroes, onEvent: onEvent }, o || {}));
    D.current = game; toasts = []; shakeT = 0; game.start(); sync();
  }

  // ---------- Выбор героя ----------
  function startSelect() {
    var n = g.input.playerCount, saved = (Store.get('druzhina.heroes', '0,1') || '0,1').split(',').map(Number);
    sel = { n: n, cur: [saved[0] || 0, saved[1] == null ? 1 : saved[1]], ready: [false, false], prev: [0, 0] };
    if (n === 2 && sel.cur[0] === sel.cur[1]) sel.cur[1] = (sel.cur[0] + 1) % 3;
    game = null;
  }
  function selMove(p, d) {
    if (sel.ready[p]) return;
    var c = sel.cur[p];
    for (var k = 0; k < 3; k++) { c = (c + d + 3) % 3; if (!(sel.n === 2 && sel.ready[1 - p] && sel.cur[1 - p] === c)) break; }
    sel.cur[p] = c; g.audio.beep(600, 0.03);
  }
  function selConfirm(p) {
    if (p >= sel.n) return;
    if (sel.ready[p]) { sel.ready[p] = false; return; }
    if (sel.n === 2 && sel.ready[1 - p] && sel.cur[1 - p] === sel.cur[p]) { g.audio.beep(160, 0.06); return; }
    sel.ready[p] = true; g.audio.beep(880, 0.06);
    if (sel.n === 2 && !sel.ready[1 - p] && sel.cur[1 - p] === sel.cur[p]) selMove(1 - p, 1);
    if (sel.ready.slice(0, sel.n).every(Boolean)) {
      var hs = sel.cur.slice(0, sel.n).map(function (i) { return L.HERO_KEYS[i]; });
      Store.set('druzhina.heroes', sel.cur.join(','));
      sel = null; newGame(hs);
    }
  }

  // ---------- Действия игроков ----------
  [0, 1].forEach(function (pi) {
    g.input.player(pi).onPress(function (name) {
      if (sel) { if (name === 'attack' || name === 'jump') selConfirm(pi); return; }
      if (!game) return;
      var S = game.state();
      if (S.phase === 'continue') { if (name === 'attack') game.continue_(); return; }
      if (name === 'attack') game.attack(pi); else if (name === 'jump') game.jump(pi);
      else if (name === 'magic') game.magic(pi); else if (name === 'back') game.special(pi);
    });
  });
  function tbtn(selr, fn) {
    var b = pad && pad.querySelector(selr); if (!b) return;
    var on = function (e) { e.preventDefault(); if (g._sceneName === 'play') fn(); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
  }
  tbtn('[data-jump]', function () { if (sel) selConfirm(0); else if (game) game.jump(0); });
  tbtn('[data-magic]', function () { if (game && !sel) game.magic(0); });
  tbtn('[data-back]', function () { if (game && !sel) game.special(0); });

  // ---------- Титул и фон экранов движка ----------
  var demo = D.Game({ players: 2, heroes: ['zhdan', 'olha'], rng: L.mulberry32(7) }).start(), demoT = 0;
  function demoState() {
    var S = demo.state(); S.time = demoT; S.banner = 0;
    S.cam = 600 * (0.5 + 0.5 * Math.sin(demoT * 0.06 - 1.5));
    S.heroes.forEach(function (h) { h.state = 'out'; h.out = true; });
    S.foes = []; S.mounts = []; S.items = []; S.spells = []; S.projs = [];
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    D.ui.drawWorld(this, ctx, demoState(), P, {});
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.45)' : 'rgba(10,10,14,.45)'; ctx.fillRect(0, 0, W, H);
    var pw = 520, ph = 392, px = (W - pw) / 2, py = 30;
    D.ui.panel(ctx, px, py, pw, ph, P, P.line);
    D.ui.txt(this, this.t('title'), W / 2, py + 66, { size: 60, align: 'center', color: P.accent, weight: 900 }, P);
    D.ui.txt(this, this.t('subtitle'), W / 2, py + 92, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    // дружина
    var two = g.input.playerCount === 2;
    var row = two ? ['zhdan', 'secha', 'olha'] : ['zhdan', 'secha', 'olha'];
    row.forEach(function (k, i) { D.render.portrait(ctx, P, k, W / 2 + (i - 1) * 70, py + 196, 0.9, demoT + i * 1.3, Math.floor(demoT * 0.7 + i) % 3 === 0 ? 'over' : 'idle'); });
    menu.draw(this, W / 2, py + 236, 30);
    if (this.state.best) D.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    this.menu._drawHint('title');
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') D.ui.drawWorld(this, this.ctx, game ? game.state() : demoState(), pal(), {});
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || (!game && !sel)) startSelect(); },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (a === 'start' && game && game.state().phase === 'continue') game.continue_();
      if (a === 'start' && sel) selConfirm(0);
    },
    update: function (dt) {
      if (sel) {
        for (var p = 0; p < sel.n; p++) {
          var dx = g.input.player(p).dir.x;
          if (dx && dx !== sel.prev[p]) selMove(p, dx);
          sel.prev[p] = dx;
        }
        demoT += dt; return;
      }
      if (!game) return;
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), on = pi < g.input.playerCount, dir = on ? P.dir : { x: 0, y: 0 };
        game.setDir(pi, dir.x, dir.y);
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) {
      var P = pal();
      if (sel) { D.ui.drawWorld(this, ctx, demoState(), P, {}); D.ui.select(this, ctx, sel, P, demoT); return; }
      if (game) D.ui.render(this, ctx, game.state(), P, { toasts: toasts, shake: shakeT > 0 ? 6 * Math.min(1, shakeT * 3) : 0 });
      else this.clear();
    }
  });

  g.start('title');
  D.app = { g: g, game: function () { return game; }, newGame: newGame, sel: function () { return sel; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
