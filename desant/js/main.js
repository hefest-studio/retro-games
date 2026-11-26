/* ДЕСАНТ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2,
   подсказка). Ввод: ход (8 направлений), огонь (держишь — направление ствола зафиксировано, стрейф), граната /
   выход из танкетки. «Продолжить?» — огнём любого игрока или Enter. Тач (И1): стик слева, ● огонь, ✸ граната, II пауза. */
(function (global) {
  'use strict';
  var DS = global.DESANT, L = DS.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#11171a', panel: '#182024', ink: '#f2f4f2', muted: '#a9b2b4', accent: '#ea6a12', grid: '#2a3438' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ea6a12', muted: '#c8d4dc' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.VIEW_H, gameId: 'desant', strings: DS.STR, theme: 'modern', lives: 3, themes: themes });
  DS.g = g;
  var pad = document.querySelector('.pad');
  function pal() { return g.themeName === 'retro' ? DS.palettes.retro : DS.palettes.modern; }
  function syncBody() { document.body.setAttribute('data-theme', g.themeName === 'retro' ? 'retro' : 'modern'); }
  var baseSet = g.setTheme; g.setTheme = function (n) { baseSet.call(this, n); syncBody(); }; syncBody();

  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND, actions: ['fire', 'nade'], pad: pad,
    touch: { A: 'fire' },
    hint: { ru: [DS.STR.ru.hint1, DS.STR.ru.hint2], en: [DS.STR.en.hint1, DS.STR.en.hint2] }
  });
  g.input.bindDpad(pad);

  // ---------- Тач-стик (И1): 8 секторов → зажатые направления движка ----------
  var stick = document.querySelector('.stick'), knob = stick && stick.querySelector('.knob');
  function setStick(dx, dy) {
    var tc = g.input._touch, d = Math.hypot(dx, dy), on = d > 12, a = Math.atan2(dy, dx), k = Math.round(a / (Math.PI / 4));
    var dir = on ? L.oct(Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)) : [0, 0];
    tc.left = dir[0] < 0; tc.right = dir[0] > 0; tc.up = dir[1] < 0; tc.down = dir[1] > 0;
    if (knob) { var m = Math.min(d, 34), f = d ? m / d : 0; knob.style.transform = 'translate(' + (dx * f) + 'px,' + (dy * f) + 'px)'; }
  }
  if (stick) {
    var sid = null;
    var center = function () { var r = stick.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    stick.addEventListener('touchstart', function (e) { Arcade.touchOk(e); var tch = e.changedTouches[0]; sid = tch.identifier; var c = center(); setStick(tch.clientX - c[0], tch.clientY - c[1]); }, { passive: false });
    stick.addEventListener('touchmove', function (e) { Arcade.touchOk(e); for (var i = 0; i < e.changedTouches.length; i++) { var tch = e.changedTouches[i]; if (tch.identifier === sid) { var c = center(); setStick(tch.clientX - c[0], tch.clientY - c[1]); } } }, { passive: false });
    var end = function (e) { Arcade.touchOk(e); sid = null; setStick(0, 0); };
    stick.addEventListener('touchend', end, { passive: false }); stick.addEventListener('touchcancel', end, { passive: false });
    var md = false;
    stick.addEventListener('mousedown', function (e) { if (!Arcade.touchOk(e)) return; md = true; var c = center(); setStick(e.clientX - c[0], e.clientY - c[1]); });
    addEventListener('mousemove', function (e) { if (md) { var c = center(); setStick(e.clientX - c[0], e.clientY - c[1]); } });
    addEventListener('mouseup', function () { if (md) { md = false; setStick(0, 0); } });
  }

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0;
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y, big, screen) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.4, big: big, screen: screen }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!d || d.x == null || !game) return;
    var P = pal(), sx = d.x, sy = d.y - game.state().camY, sz = P.pixel ? 4 : 3;
    if (sy < -40 || sy > g.H + 40) return;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: d.type === 'rifle' || d.type === 'grenadier' ? P.foe.coat2 : P.boss, count: d.type === 'rifle' ? 8 : 22, speed: 110, life: 0.45, size: sz });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: P.hero[d.pi].smock, count: 22, speed: 140, life: 0.8, size: sz });
    else if (type === 'crate') g.particles.spawn(sx, sy, { color: P.crate, count: 10, speed: 90, life: 0.4, size: sz });
    else if (type === 'bossDie' || type === 'partDie') g.particles.spawn(sx, sy, { color: P.bossCore, count: type === 'bossDie' ? 80 : 24, speed: 220, life: 1.1, size: sz + 1 });
    else if (type === 'wallHit' && d.t === L.SOLID) g.particles.spawn(sx, sy, { color: P.pbullet, count: 2, speed: 40, life: 0.18, size: 2 });
    else if (type === 'armor') g.particles.spawn(sx, sy, { color: P.ink, count: 3, speed: 70, life: 0.2, size: 2 });
  }
  function onEvent(type, d) {
    DS.sfx(g, type, d); fx(type, d);
    var P = pal(), W = L.W;
    if (type === 'pickup') toast(g.t('p_' + d.kind), P.item[d.kind] === P.item.nade ? P.good : P.item[d.kind], d.x, d.y - 14, d.kind === 'spread' || d.kind === 'rapid');
    else if (type === 'checkpoint') toast(g.t('checkpoint'), P.accent, W / 2, 140, true, true);
    else if (type === 'life') toast(g.t('life'), P.good, W / 2, 170, true, true);
    else if (type === 'board') toast(g.t('board'), P.tank, d.x, d.y - 26, false);
    else if (type === 'noFuel') toast(g.t('noFuel'), P.bad, d.x, d.y - 26, false);
    else if (type === 'noNade') toast(g.t('noNade'), P.bad, d.x, d.y - 20, false);
    else if (type === 'bossDie') toast(g.t('bossDown'), P.good, W / 2, 220, true, true);
    if (type === 'boom') shakeT = Math.max(shakeT, d.enemy ? 0.1 : 0.14);
    if (type === 'heroDie' || type === 'tankDie') shakeT = Math.max(shakeT, 0.3);
    if (type === 'bossDie') shakeT = 1.4;
    sync();
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame(o) {
    game = DS.Game(Object.assign({ players: g.input.playerCount, onEvent: onEvent, seed: Math.floor(Math.random() * 1e6) }, o || {}));
    DS.current = game; toasts = []; shakeT = 0; game.start(); sync();
  }
  function act(pi, name) {
    if (!game || g._sceneName !== 'play') return;
    var S = game.state();
    if (S.phase === 'cont') { if (name === 'fire' || name === 'nade') game.cont(); return; }
    if (name === 'nade') game.nade(pi);
  }
  [0, 1].forEach(function (pi) { g.input.player(pi).onPress(function (name) { act(pi, name); }); });
  if (pad) pad.querySelectorAll('[data-act]').forEach(function (b) {
    var name = b.getAttribute('data-act');
    var on = function (e) { if (!Arcade.touchOk(e)) return; act(0, name); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
  });

  // ---------- Титул: десант идёт через тайгу ----------
  var demo = DS.Game({ players: 2, seed: 5, rng: L.mulberry32(9) }).start(), demoT = 0;
  (function () {
    var S = demo.state(); S.banner = 0; S.camY = S.D.h * L.T - L.VIEW_H - 700; S.pending = [];
    S.heroes.forEach(function (h, i) { h.x = L.W / 2 + (i ? 40 : -40); h.inv = 0; });
  })();
  function demoState() {
    var S = demo.state();
    S.time += 0.016;
    S.heroes.forEach(function (h, i) { h.out = i >= g.input.playerCount; h.moving = true; h.y = S.camY + 470 + i * 26; h.face = [Math.round(Math.sin(demoT * 0.5 + i * 2)), -1]; });
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); var S = demo.state(); S.camY -= 22 * Math.min(dt, 0.05); if (S.camY < 900) S.camY = S.D.h * L.T - L.VIEW_H - 700; };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    DS.render(ctx, this, demoState(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.35)' : 'rgba(8,12,14,.38)'; ctx.fillRect(0, 0, W, H);
    var pw = 400, ph = 330, px = (W - pw) / 2, py = 70;
    DS.ui.panel(ctx, P, px, py, pw, ph, P.accent);
    DS.ui.txt(ctx, P, this.t('title'), W / 2, py + 70, { size: this.i18n.lang === 'en' ? 40 : 54, align: 'center', color: P.accent, weight: 900 });
    DS.ui.txt(ctx, P, this.t('subtitle'), W / 2, py + 98, { size: 11, align: 'center', color: th.muted, weight: 600, shadow: false });
    menu.draw(this, W / 2, py + 150, 30);
    if (this.state.best) DS.ui.txt(ctx, P, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false });
    this.menu._drawHint('title');
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') DS.render(this.ctx, this, game ? game.state() : demoState(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) {
      if (a === 'pause') this.pause();
      else if (a === 'start' && game && game.state().phase === 'cont') game.cont();
    },
    update: function (dt) {
      if (!game) return;
      var S = game.state();
      for (var pi = 0; pi < S.heroes.length; pi++) {
        var P = g.input.player(pi), on = pi < g.input.playerCount;
        var mx = on ? (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0) : 0, my = on ? (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0) : 0;
        game.setMove(pi, mx, my); game.setFire(pi, on && P.pressed('fire'));
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) DS.render(ctx, this, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 5 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  DS.app = { g: g, game: function () { return game; }, newGame: newGame, demo: demo };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
