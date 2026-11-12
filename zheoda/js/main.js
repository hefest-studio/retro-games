/* ЖЕОДА · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: пещера «Устье» на фоне
   (камера плывёт) + меню движка с пунктом «Эпизод». Хаб (карта жеод) и уровни — внутри сцены play.
   Ввод: g.input.setPlayers (стрелки/WASD/ZX, тач-кнопки), удержание огня — автоогонь. */
(function (global) {
  'use strict';
  var Z = global.ZHEODA, L = Z.logic, UI = Z.ui, OY = UI.OY, TS = UI.T;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0d0b16', panel: '#17132a', ink: '#f1ecff', muted: '#a59cc0', accent: '#ffb347', grid: '#2b2442' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f4dc4c', muted: '#a6a2b4', ink: '#f8f6ee', good: '#52d878', bad: '#f2584a', warn: '#f4dc4c' })
  };
  var W = 640, H = 400;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'zheoda', strings: Z.STR, theme: 'modern', lives: 3, themes: themes });
  Z.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  var BIND = { p1: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], jump: ['ArrowUp', 'KeyW', 'KeyZ', 'KeyK'], fire: ['Space', 'KeyX', 'KeyJ'], down: ['ArrowDown', 'KeyS'] } };
  g.input.setPlayers({ bind: BIND, actions: ['fire', 'down', 'jump'], repeat: [], touch: { L: 'left', R: 'right', U: 'jump', D: 'down', A: 'fire' }, count: 1 });
  var I = g.input.player(0);

  function rnd() { return g.themeName === 'retro' ? Z.classic : Z.modern; }
  var game = null, toasts = [], lastToast = {};
  var Store = Arcade.Store, REACHED = 'arcade.zheoda.reached';
  var episode = 1;
  function reached() { return Store.getNum ? Store.getNum(REACHED, 1) : +(Store.get(REACHED, '1')) || 1; }

  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }
  function scr(x, y) { return UI.toScreen(game.state(), rnd().P, x, y); }
  function toast(text, color, x, y, big, key) {
    if (key) { var n = Date.now(); if (lastToast[key] && n - lastToast[key] < 900) return; lastToast[key] = n; }
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 1.0 && Math.abs(toasts[i].y - y) < 14 && Math.abs(toasts[i].x - x) < 80) y -= 16;
    toasts.push({ text: text, color: color, x: Math.max(70, Math.min(W - 70, x)), y: Math.max(OY + 16, y), t: 1.4, big: !!big });
  }
  function fx(type, d) {
    if (!game || d.x == null) return;
    var R = rnd(), P = R.P, sz = P.pixel ? 4 : 3, s = scr(d.x, d.y), E = P.E;
    var C = {
      crystal: P.pixel ? E[13] : '#d9a6ff', gem: P.pixel ? E[12] : '#ff8fc0', wall: P.pixel ? E[7] : '#8b7aa8', blast: P.pixel ? E[14] : '#ffb347',
      kill: P.pixel ? E[10] : '#c9b8e6', dissolve: P.pixel ? E[10] : '#6dff8a', hurt: P.pixel ? E[12] : '#ff5d6c', die: P.pixel ? E[3] : '#2bb3a3', shatter: P.pixel ? E[7] : '#c9b8e6',
      spark: P.pixel ? E[14] : '#ffe9a6', flip: P.pixel ? E[11] : '#7ae7ff', bossHit: P.pixel ? E[13] : '#e2c4ff', bossDie: P.pixel ? E[13] : '#c77dff',
      secret: P.pixel ? E[14] : '#ffd34d', key: '#ffffff', slam: P.pixel ? E[13] : '#c77dff', heal: P.pixel ? E[12] : '#ff8fa0'
    }[type];
    if (!C) return;
    var cnt = { dissolve: 12, crystal: 10, gem: 14, wall: 12, blast: 30, kill: 12, hurt: 8, die: 24, shatter: 8, spark: 4, flip: 16, bossHit: 8, bossDie: 60, secret: 18, key: 10, slam: 14, heal: 10 }[type];
    g.particles.spawn(s.x, s.y, { color: C, count: cnt, speed: type === 'blast' || type === 'bossDie' ? 200 : 100, life: type === 'bossDie' ? 1.2 : 0.55, size: sz });
  }
  function onEvent(type, d) {
    Z.sfx(g, type, d); fx(type, d);
    var P = rnd().P, S = game && game.state(), s;
    if (type === 'crystal') { s = scr(d.x, d.y); toast('+' + L.SCORE.crystal, P.accent, s.x, s.y - 12); }
    else if (type === 'exitOpen') toast(g.t('exitOpen'), P.good, W / 2, OY + 120, true);
    else if (type === 'secret') { s = scr(d.x, d.y); toast(g.t('secret') + ' +' + L.SCORE.secret, P.accent, s.x, s.y - 20, true); }
    else if (type === 'key') { s = scr(d.x, d.y); toast(g.t('key_' + d.k), P.keys[d.k], s.x, s.y - 18, true); }
    else if (type === 'door') { s = scr(d.x, d.y); toast(g.t('door'), P.ink, s.x, s.y - 18); }
    else if (type === 'ammo') { s = scr(d.x, d.y); toast(g.t('ammo') + ' ' + d.ammo, P.accent, s.x, s.y - 16); }
    else if (type === 'dyn') { s = scr(d.x, d.y); toast(g.t('dyn'), P.bad, s.x, s.y - 16); }
    else if (type === 'heal') { s = scr(d.x, d.y); toast(g.t('heal'), P.good, s.x, s.y - 16); }
    else if (type === 'gem') { s = scr(d.x, d.y); toast(g.t('gem') + ' +' + L.SCORE.gem, P.accent, s.x, s.y - 16); }
    else if (type === 'empty' && S) { s = scr(S.pl.x + 0.35, S.pl.y); toast(g.t('noammo'), P.bad, s.x, s.y - 10, false, 'empty'); }
    else if (type === 'flip') toast(g.t('gravity'), P.pixel ? P.E[11] : '#7ae7ff', W / 2, OY + 150, false, 'flip');
    else if (type === 'lever') toast(g.t(d.on ? 'leverOn' : 'leverOff'), d.on ? P.good : P.bad, W / 2, OY + 150);
    else if (type === 'kill') { s = scr(d.x, d.y); toast('+' + L.SCORE.kill, P.ink, s.x, s.y - 10); }
    else if (type === 'bossHit' && S && S.boss && S.boss.hp === Math.floor(S.boss.max / 2) - 1) toast(g.t('enrage'), P.bad, W / 2, OY + 120, true);
    else if (type === 'bossDie') toast('+' + L.SCORE.boss, P.accent, W / 2, OY + 120, true);
    else if (type === 'level' || type === 'hub') toasts = [];
    if (type === 'hub' && d.open > reached()) Store.set(REACHED, String(d.open));
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }

  function newGame() {
    var start = episode === 2 && reached() >= 9 ? 9 : 1;
    game = Z.Game({ lives: 3, level: start, difficulty: diff, onEvent: onEvent, rng: Math.random });
    game.start(); Z.current = game; toasts = []; sync();
  }

  // ---------- Стандартные экраны ----------
  g.menu.addItem({ key: 'episode', after: 'play',
    label: function () { return g.t('episode') + ': ' + episode + (reached() >= 9 ? '' : ' (2 — ' + g.t('hubLocked') + ')'); },
    onSelect: function () { if (reached() >= 9) { episode = episode === 1 ? 2 : 1; g.audio.beep(700, 0.04); } else g.audio.beep(180, 0.06); } });
  g.useStandardScreens({ lives: 3 });
  g.menu.setHint(function () { return [{ text: g.t('hint'), dim: true }]; }, 'title');
  UI.init(g);
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); var R = rnd(); R.bg(this.ctx, this, demo ? demo.state() : null, null); };

  // ---------- Титул: «Устье» на фоне, камера плывёт ----------
  var demo = Z.Game({ rng: L.mulberry32(5), noEnemies: false }).start(); demo.enter(1);
  var DS = demo.state();
  DS.banner = 0;
  var menu = g.scenes.title._menu, title = g.scenes.title;
  title.update = function (dt) {
    DS.time += dt;
    var span = Math.max(0, DS.cols - L.VIEW_W);
    DS.cam.x = span / 2 + Math.sin(DS.time * 0.15) * span / 2; DS.cam.y = Math.max(0, DS.rows - L.VIEW_H);
    DS.pl.x = DS.cam.x + 3; DS.pl.face = Math.cos(DS.time * 0.15) > 0 ? 1 : -1; DS.pl.vx = 0;
  };
  title.draw = function (ctx) {
    var th = this.th(), R = rnd(), P = R.P, retro = P.pixel;
    UI.drawWorld(ctx, DS, this, R, { noHero: false });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.7)' : 'rgba(10,8,18,.62)'; ctx.fillRect(0, 0, W, H);
    var pw = 540, ph = 330, px0 = (W - pw) / 2, py0 = 22;
    UI.panel(ctx, px0, py0, pw, ph, P, retro ? P.line : '#3a3156');
    // заголовок + кристаллы по бокам
    UI.txt(this, this.t('title'), W / 2, py0 + 62, { size: 48, align: 'center', color: P.accent, weight: 900 }, P);
    R.item(ctx, '*', px0 + 110, py0 + 46, this.time, { cx: 0, cy: 0 });
    R.item(ctx, '*', px0 + pw - 110, py0 + 46, this.time + 1, { cx: 0, cy: 0 });
    UI.txt(this, this.t('subtitle'), W / 2, py0 + 92, { size: 13, align: 'center', color: th.muted, weight: 600 }, P);
    // героиня у меню
    R.hero(ctx, px0 + 70, py0 + 190, { w: L.PW, h: L.PH, vx: 0, ground: true, gs: 1, face: 1 }, this.time, DS);
    menu.draw(this, W / 2, py0 + 134, 30);
    if (this.state.best) UI.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py0 + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    this.menu._drawHint('title');
  };

  // ---------- Игровая сцена (хаб + уровни) ----------
  var STEP = L.STEP;
  function act(name) {
    if (!game || g._sceneName !== 'play') return;
    var S = game.state();
    if (S.phase === 'hub') { if (name === 'fire' || name === 'jump') game.enter(); return; }
    if (name === 'fire') game.fire();
    else if (name === 'down') game.down();
  }
  I.onPress(act);
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (!game) return;
      var S = game.state();
      if (S.phase === 'hub') {
        if (a === 'left') game.hubMove(-1); else if (a === 'right') game.hubMove(1);
        else if (a === 'start') game.enter();
      }
    },
    update: function (dt) {
      if (!game) return;
      var S = game.state(), n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      game.setInput(I.dir.x, I.pressed('jump'));
      if (S.phase === 'play' && I.pressed('fire') && S.ammo > 0) game.fire();   // удержание — автоогонь (кулдаун в логике)
      for (var k = 0; k < n; k++) game.update(STEP);
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var S = game.state(), R = rnd();
      if (S.phase === 'hub') { UI.hub(this, ctx, S, R); return; }
      UI.drawWorld(ctx, S, this, R);
      UI.hud(this, ctx, S, R);
      UI.banner(this, ctx, S, R);
      UI.toasts(this, ctx, toasts, R.P);
    }
  });
  // Хаб: клик/тап по узлу карты — выбрать, повторный — войти
  var cv = g.canvas;
  function hubTap(cx, cy) {
    if (g._sceneName !== 'play' || !game || game.state().phase !== 'hub') return;
    var r = cv.getBoundingClientRect(), x = (cx - r.left) * W / r.width, y = (cy - r.top) * H / r.height, S = game.state();
    var nodes = UI.hubNodes(g);
    for (var i = 0; i < nodes.length && i < S.maxLevel; i++) {
      if (Math.hypot(nodes[i].x - x, nodes[i].y - y) < 24) {
        if (i + 1 === S.hubSel) game.enter(); else game.hubMove(i + 1 - S.hubSel);
        return;
      }
    }
  }
  cv.addEventListener('mousedown', function (e) { hubTap(e.clientX, e.clientY); });
  cv.addEventListener('touchstart', function (e) { if (game && game.state().phase === 'hub' && g._sceneName === 'play') { e.preventDefault(); hubTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY); } }, { passive: false });

  g.start('title');
  Z.app = { g: g, game: function () { return game; }, demo: demo };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
