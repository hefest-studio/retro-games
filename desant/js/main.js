/* ЗАРЕВО (папка desant) · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens. Один боец. Ввод: ход (8 направлений), огонь (держишь — направление ствола
   зафиксировано, стрейф), огненный вал (нажал — идёт, ещё раз — отбой). Тач — стик (js/stick.js) + ● огонь и ▲ вал; геймпад — движком:
   A — огонь, B — вал. Площадка (v2.8–2.10): таблица «desant», «Без рекламы», ещё один шанс и +1 жизнь за ролик, межстраничная между зонами. */
(function (global) {
  'use strict';
  var DS = global.DESANT, L = DS.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#11171a', panel: '#182024', ink: '#f2f4f2', muted: '#a9b2b4', accent: '#ea6a12', grid: '#2a3438' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ea6a12', muted: '#c8d4dc' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.VIEW_H, gameId: 'desant', leaderboard: 'desant', strings: DS.STR, theme: 'modern', lives: 3, themes: themes });
  DS.g = g;
  var pad = document.querySelector('.pad');
  function pal() { return g.themeName === 'retro' ? DS.palettes.retro : DS.palettes.modern; }

  // ---------- Страница: подгонка холста, подписи, тема ----------
  function fit() {
    var c = g.canvas, cs = pad && getComputedStyle(pad);
    var padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 16 : 0;
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth), vh = Math.min(innerHeight, (global.visualViewport && global.visualViewport.height) || innerHeight);
    var availW = Math.min(vw - 16, 640), availH = vh - padH - (padH ? 70 : 40);
    var w = Math.max(240, Math.floor(Math.min(availW, availH * g.W / g.H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - vh;
    if (over > 0 && w > 240) { w = Math.max(240, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
  }
  var lastLang = null, lastTheme = null;
  function syncPage() {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme === 'retro' ? 'retro' : 'modern'); }
  }
  addEventListener('resize', fit); fit(); setTimeout(fit, 50); syncPage();
  g.input.bindDpad(pad);
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'), {});

  g.useStandardScreens({ lives: 3 });
  g.input.setPlayers({ bind: L.BIND, actions: ['fire', 'bar'], touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'fire' }, count: 1 });
  g.menu.setHint(function () { return [g.t('hint1'), g.t('hint2')].map(function (s, i) { return { text: s, dim: i === 1 }; }); }, 'title');
  var pb = pad && pad.querySelector('[data-pause]');
  if (pb) {
    var hp = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    pb.addEventListener('touchstart', hp, { passive: false }); pb.addEventListener('mousedown', hp);
  }

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0, tipMoveT = 0, tipDone = false;
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y, big, screen) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.4, big: big, screen: screen }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!d || d.x == null || !game) return;
    var P = pal(), sx = d.x, sy = d.y - game.state().camY, sz = P.pixel ? 4 : 3;
    if (sy < -40 || sy > g.H + 40) return;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: d.type === 'rifle' || d.type === 'grenadier' ? P.foe.coat2 : P.boss, count: d.type === 'rifle' ? 8 : 22, speed: 110, life: 0.45, size: sz });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: P.hero[0].smock, count: 22, speed: 140, life: 0.8, size: sz });
    else if (type === 'crate') g.particles.spawn(sx, sy, { color: P.crate, count: 10, speed: 90, life: 0.4, size: sz });
    else if (type === 'burn') g.particles.spawn(sx, sy, { color: P.bar[1], count: 3, speed: 70, life: 0.4, size: 2 });
    else if (type === 'bossDie' || type === 'partDie') g.particles.spawn(sx, sy, { color: P.bossCore, count: type === 'bossDie' ? 80 : 24, speed: 220, life: 1.1, size: sz + 1 });
    else if (type === 'wallHit' && d.t === L.SOLID) g.particles.spawn(sx, sy, { color: P.pbullet, count: 2, speed: 40, life: 0.18, size: 2 });
    else if (type === 'armor') g.particles.spawn(sx, sy, { color: P.ink, count: 3, speed: 70, life: 0.2, size: 2 });
  }
  function onEvent(type, d) {
    DS.sfx(g, type, d); fx(type, d);
    var P = pal(), W = L.W, S = game ? game.state() : null;
    if (type === 'pickup') toast(g.t('p_' + d.kind), d.kind === 'shell' ? P.bar[1] : P.item[d.kind], d.x, d.y - 14, d.kind === 'spread' || d.kind === 'rapid');
    else if (type === 'checkpoint') toast(g.t('checkpoint'), P.accent, W / 2, 140, true, true);
    else if (type === 'life') toast(g.t('life'), P.good, W / 2, 170, true, true);
    else if (type === 'noCharge') toast(g.t('noCharge'), P.bad, d.x, d.y - 20, false);
    else if (type === 'tip') toast(g.t('tipBar'), P.bar[1], W / 2, 190, true, true);
    else if (type === 'continue') toast(g.t('continued'), P.warn, W / 2, 170, true, true);
    else if (type === 'bossDie') toast(g.t('bossDown'), P.good, W / 2, 220, true, true);
    if (type === 'boom') shakeT = Math.max(shakeT, 0.1);
    if (type === 'barStart') shakeT = Math.max(shakeT, 0.12);
    if (type === 'heroDie') shakeT = Math.max(shakeT, 0.3);
    if (type === 'bossDie') shakeT = 1.4;
    sync();
    if (type === 'clear' && S && S.zone < S.maxZone && g.adReady && g.adReady()) S.hold = true;
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame(o) {
    game = DS.Game(Object.assign({ onEvent: onEvent, seed: Math.floor(Math.random() * 1e6) }, o || {}));
    DS.current = game; toasts = []; shakeT = 0; tipMoveT = 0; tipDone = false; game.start(); sync();
  }
  function act(name) {
    if (!game || g._sceneName !== 'play') return;
    var S = game.state();
    if (S.phase === 'cont') { if (name === 'fire' || name === 'bar') game.cont(); return; }
    if (S.hold && (name === 'fire' || name === 'bar')) { holdGo(); return; }
    if (name === 'bar') game.bar();
  }
  g.input.player(0).onPress(act);
  var bb = pad && pad.querySelector('[data-bar]');
  if (bb) { var onBar = function (e) { if (!Arcade.touchOk(e)) return; act('bar'); }; bb.addEventListener('touchstart', onBar, { passive: false }); bb.addEventListener('mousedown', onBar); }

  // ---------- Титул: панорама тайги под меню ----------
  var demo = DS.Game({ seed: 5, rng: L.mulberry32(9) }).start(), demoT = 0;
  (function () {
    var S = demo.state(); S.banner = 0; S.camY = S.D.h * L.T - L.VIEW_H - 700; S.pending = [];
    S.heroes[0].inv = 0; S.heroes[0].x = L.W / 2;
  })();
  function demoState() {
    var S = demo.state();
    S.time += 0.016;
    var h = S.heroes[0]; h.moving = true; h.y = S.camY + 470; h.face = [Math.round(Math.sin(demoT * 0.5)), -1];
    var bar = S.bar; bar.st = 'run'; bar.y = S.camY + 300 + Math.sin(demoT * 0.7) * 20;
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); var S = demo.state(); S.camY -= 22 * Math.min(dt, 0.05); if (S.camY < 900) S.camY = S.D.h * L.T - L.VIEW_H - 700; };
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    syncPage();
    DS.render(ctx, this, demoState(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.35)' : 'rgba(8,12,14,.42)'; ctx.fillRect(0, 0, W, H);
    var pw = 420, ph = 360, px = (W - pw) / 2, py = 60;
    DS.ui.panel(ctx, P, px, py, pw, ph, P.accent);
    DS.ui.txt(ctx, P, this.t('title'), W / 2, py + 70, { size: this.i18n.lang === 'ru' ? 54 : 40, align: 'center', color: P.accent, weight: 900 });
    this.text(this.t('subtitle'), W / 2, py + 98, { size: 11, align: 'center', color: th.muted, weight: 600, font: P.font, maxWidth: pw - 24 });
    var mf = menuFit(menu, py + 150, 30, py + 136, py + ph - 40); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) DS.ui.txt(ctx, P, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false });
    this.menu._drawHint('title');
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') DS.render(this.ctx, this, game ? game.state() : demoState(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8–2.10): таблица «desant», «Без рекламы», реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «desant», GamePush — числовое поле игрока «desant» + лидерборд; товар no_ads (постоянный).
  // Список — promo/desant/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'desant';
  g.persist('arcade.best.desant', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });
  // «Ещё один шанс» (раз за партию): боец встаёт на месте с 1 жизнью и полным зарядом; бонус в паузе — +1 жизнь (до двух раз за партию)
  g.useRewardedContinue({ revive: function () { if (game && game.reviveAd()) sync(); } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // Конец зоны: если площадка готова показать межстраничную — карточка «дальше», ролик по действию игрока
  var holdGoing = false;
  function holdGo() {
    if (!game || !game.state().hold || holdGoing) return;
    holdGoing = true; g.adBreak().then(function () { holdGoing = false; if (game) game.state().hold = false; });
  }
  g.canvas.addEventListener('pointerdown', function () { if (g._sceneName === 'play') holdGo(); });

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) {
      if (a === 'pause') this.pause();
      else if ((a === 'start' || a === 'action') && game && game.state().phase === 'cont') game.cont();
      else if ((a === 'start' || a === 'action') && game && game.state().hold) holdGo();
    },
    update: function (dt) {
      if (!game) return;
      var P = g.input.player(0), dx = (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0), dy = (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0);
      if (stick.active) { dx = stick.x; dy = stick.y; }
      game.setMove(0, dx, dy); game.setFire(0, P.pressed('fire'));
      var S = game.state();
      if (S.zone === 1 && S.phase === 'play') { tipMoveT += dt; if (tipMoveT > 0.4 && !tipDone) { tipDone = true; toast(g.t(g.input.touchOnly ? 'tipMove' : 'hint1'), pal().muted, L.W / 2, 200, false, true); } }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { syncPage(); if (game) DS.render(ctx, this, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 5 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  DS.app = { g: g, game: function () { return game; }, newGame: newGame, demo: demo, clearToasts: function () { toasts = []; tipDone = true; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
