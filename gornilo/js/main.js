/* ГОРНИЛО · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2,
   подсказка). Ввод «два стика»: ходьба (left/right/up/down) и огонь (aimL/aimR/aimU/aimD) — раздельно, по 8 направлений.
   Тач — два виртуальных стика в .pad (только И1). Титул — арена с толпой заготовок под меню. */
(function (global) {
  'use strict';
  var GR = global.GORNILO, L = GR.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#121216', panel: '#18181e', ink: '#f3eee4', muted: '#a3a9b3', accent: '#ff8f3f', grid: '#2a2a32' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f89838', muted: '#a8a8a8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.SCREEN_H, gameId: 'gornilo', strings: GR.STR, theme: 'modern', lives: 3, themes: themes });
  GR.g = g;
  var pad = document.querySelector('.pad');
  GR.ui.init(g);
  function pal() { return g.themeName === 'retro' ? GR.classic : GR.modern; }

  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND, actions: ['aimL', 'aimR', 'aimU', 'aimD'], pad: pad,
    hint: { ru: [GR.STR.ru.hint1, GR.STR.ru.hint2], en: [GR.STR.en.hint1, GR.STR.en.hint2] }
  });

  // ---------- Тач: два виртуальных стика (И1) ----------
  var stick = { move: [0, 0], aim: [0, 0] };
  function oct(dx, dy) { var a = Math.atan2(dy, dx), k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; return [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][k]; }
  if (pad) pad.querySelectorAll('[data-stick]').forEach(function (el) {
    var which = el.getAttribute('data-stick'), nub = el.querySelector('i'), id = null;
    function setV(e) {
      var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy, R = r.width / 2, d = Math.hypot(dx, dy);
      var k = d > R ? R / d : 1; if (nub) nub.style.transform = 'translate(' + (dx * k * 0.6) + 'px,' + (dy * k * 0.6) + 'px)';
      stick[which] = d > R * 0.25 ? oct(dx, dy) : [0, 0];
    }
    function end() { id = null; stick[which] = [0, 0]; if (nub) nub.style.transform = ''; }
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); id = e.pointerId; try { el.setPointerCapture(id); } catch (x) {}
      setV(e);
      if (which === 'aim' && game && game.state().phase === 'cont' && g._sceneName === 'play') game.cont();
    });
    el.addEventListener('pointermove', function (e) { if (e.pointerId === id) { e.preventDefault(); setV(e); } });
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  });

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0;
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y, big) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.3, big: big }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!game || !d || d.x == null) return;
    var P = pal(), sx = d.x, sy = d.y + L.HUD, sz = P.pixel ? 4 : 3;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: d.type === 'runner' ? P.runner : d.type === 'roller' ? P.rollerBand : P.blank, count: d.type === 'roller' ? 30 : 7, speed: d.type === 'roller' ? 160 : 110, life: 0.45, size: sz });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: P.hero[d.pi], count: 26, speed: 150, life: 0.8, size: sz });
    else if (type === 'power' || type === 'gold') g.particles.spawn(sx, sy, { color: P.warn, count: 12, speed: 90, life: 0.5, size: 2 });
    else if (type === 'partDie') g.particles.spawn(sx, sy, { color: P.core, count: 34, speed: 180, life: 0.9, size: sz + 1 });
    else if (type === 'bossDie') g.particles.spawn(sx, sy, { color: P.core, count: 80, speed: 260, life: 1.4, size: sz + 1 });
    else if (type === 'slam') g.particles.spawn(sx, sy, { color: P.anvilTop, count: 16, speed: 120, life: 0.4, size: sz });
  }
  function onEvent(type, d) {
    GR.sfx(g, type, d); fx(type, d);
    var P = pal(), S = game ? game.state() : null;
    if (type === 'power') toast(g.t('w_' + d.kind), P.pick[d.kind] || P.warn, d.x, d.y - 16, true);
    else if (type === 'gold') toast(g.t('gold'), P.pick.gold, d.x, d.y - 12);
    else if (type === 'extraLife') { var h = S.heroes[d.pi]; toast(g.t('extraLife'), P.good, h.x, h.y - 30, true); }
    else if (type === 'wave' && d.n > 1) toast(g.t('wave') + ' ' + d.n + '/' + d.of, P.accent, L.W / 2, 96, true);
    else if (type === 'roomClear') toast('+' + d.bonus, P.good, L.W / 2, 170, false);
    else if (type === 'coreOpen') toast(g.t('coreOpen'), P.core, d.x, d.y - 60, true);
    else if (type === 'continue') toast(g.t('continued'), P.warn, L.W / 2, 240, true);
    if (type === 'heroDie' || type === 'partDie' || type === 'slam' || (type === 'kill' && d.type === 'roller')) shakeT = Math.max(shakeT, 0.25);
    if (type === 'boom' && d.r > 40) shakeT = Math.max(shakeT, 0.12);
    if (type === 'bossDie') shakeT = 1.4;
    sync();
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame(o) {
    game = GR.Game(Object.assign({ players: g.input.playerCount, onEvent: onEvent, seed: Math.floor(Math.random() * 1e6) }, o || {}));
    GR.current = game; toasts = []; shakeT = 0; game.start(); sync();
  }
  [0, 1].forEach(function (pi) {
    g.input.player(pi).onPress(function () { if (game && game.state().phase === 'cont') game.cont(); });
  });

  // ---------- Титул: арена с толпой заготовок ----------
  var demo = GR.Game({ players: 2, rng: L.mulberry32(5), seed: 3 }).start(), demoT = 0;
  (function () {
    var S = demo.state(), r = L.mulberry32(9);
    S.banner = 0; S.roomState = 'fight';
    for (var i = 0; i < 46; i++) { var a = r() * Math.PI * 2, d = 150 + r() * 120; demo._spawn(i % 9 === 0 ? 'runner' : 'blank', 320 + Math.cos(a) * d * 1.3, 250 + Math.sin(a) * d * 0.75); }
    demo._spawn('shield', 150, 330); demo._spawn('shield', 500, 160); demo._spawn('roller', 520, 380);
    S.heroes.forEach(function (h, i) { h.x = 300 + i * 40; h.y = 260; h.inv = 0; });
  })();
  function demoState() {
    var S = demo.state();
    S.enemies.forEach(function (e) { e.ang = Math.atan2(260 - e.y, 320 - e.x) + Math.sin(demoT * 2 + e.id) * 0.4; });
    S.heroes.forEach(function (h, i) { h.alive = i < g.input.playerCount; h.ang = demoT * (i ? -0.9 : 0.8); h.moving = true; });
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    GR.ui.render(this, ctx, demoState(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.45)' : 'rgba(10,10,14,.45)'; ctx.fillRect(0, 0, W, H);
    var pw = 400, ph = 340, px = (W - pw) / 2, py = 50;
    GR.ui.panel(ctx, px, py, pw, ph, P, P.accent);
    GR.ui.txt(this, this.t('title'), W / 2, py + 70, { size: 58, align: 'center', color: P.accent, weight: 900 }, P);
    GR.ui.txt(this, this.t('subtitle'), W / 2, py + 96, { size: 11, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    menu.draw(this, W / 2, py + 150, 30);
    if (this.state.best) GR.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    this.menu._drawHint('title');
  };
  // Финалы и пауза — поверх арены
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') GR.ui.render(this, this.ctx, game ? game.state() : demoState(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) {
      if (a === 'pause') this.pause();
      else if ((a === 'start' || a === 'action') && game && game.state().phase === 'cont') game.cont();
    },
    update: function (dt) {
      if (!game) return;
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), on = pi < g.input.playerCount, mx = 0, my = 0, ax = 0, ay = 0;
        if (on) {
          mx = (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0); my = (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0);
          ax = (P.pressed('aimR') ? 1 : 0) - (P.pressed('aimL') ? 1 : 0); ay = (P.pressed('aimD') ? 1 : 0) - (P.pressed('aimU') ? 1 : 0);
          if (pi === 0) { if (!mx && !my) { mx = stick.move[0]; my = stick.move[1]; } if (!ax && !ay) { ax = stick.aim[0]; ay = stick.aim[1]; } }
        }
        if (pi < game.state().heroes.length) { game.setMove(pi, mx, my); game.setAim(pi, ax, ay); }
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) GR.ui.render(this, ctx, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 5 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  GR.app = { g: g, game: function () { return game; }, newGame: newGame, stick: stick };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
