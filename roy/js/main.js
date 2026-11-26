/* РОЙ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; заставка своя (рой-демо на фоне + меню движка).
   Ввод: стрелки/WASD (полёт по x и y), Пробел — искра (удержание — по одной по откату), X/C/Shift — манок;
   геймпад — стик, A искра, B манок (движок шлёт KeyX); тач — стик (js/stick.js) + ● искра + ◆ манок, II — пауза.
   Площадка (движок v2.8/2.9): таблица лидеров «roy», «Без рекламы», «ещё шанс» и бонус в паузе за рекламу, реклама между волнами. */
(function (global) {
  'use strict';
  var R = global.ROY, C = R.consts;

  // Переделка 2026-11: правила и счёт новые — прежний рекорд (старые правила) уходит в «прежний рекорд», таблица начата заново
  var LS = null; try { LS = global.localStorage; } catch (e) {}
  var oldBest = R.migrate(LS), migrated = oldBest > 0;

  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0a0818', panel: '#16122a', ink: '#eef2f8', muted: '#a39cc0', accent: '#ffb02e', good: '#7dffb0', bad: '#ff5d6a', grid: '#2a2440' }),
    retro: Object.assign({}, TH.retro, { bg: '#000008', panel: '#000008', accent: '#fca044', muted: '#a4a4bc', ink: '#fcfcfc', good: '#80d010', bad: '#e40058' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: C.W, height: C.H, gameId: 'roy', leaderboard: 'roy', strings: R.STR, theme: 'modern', lives: 3, themes: themes });
  R.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  R.ui.init(g);
  var titleNote = migrated ? { text: g.t('migrated') + ' · ' + g.t('oldBest') + ': ' + oldBest, a: 9 } : null;

  function rnd() { return g.themeName === 'retro' ? R.classic : R.modern; }
  var game = null, playSince = 0;

  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.wave; }

  // частицы по событиям
  var FX = { modern: { gnat: '#b8f070', shell: '#8fb4dc', powder: '#ff6a3c', fire: '#ffb02e', ship: '#4fd2ff', hive: '#c58cff', lure: '#ff6ad5' },
    retro: { gnat: '#80d010', shell: '#6888fc', powder: '#f83800', fire: '#f87800', ship: '#3cbcfc', hive: '#b870f8', lure: '#f878f8' } };
  function fx(type, d) {
    var pal = FX[g.themeName] || FX.modern, sz = g.themeName === 'retro' ? 4 : 3;
    if (type === 'ignite') g.particles.spawn(d.x, d.y, { color: pal.fire, count: 6, speed: 60, life: 0.35, size: sz });
    else if (type === 'burnout') g.particles.spawn(d.x, d.y, { color: pal[d.kind] || pal.fire, count: 5, speed: 50, life: 0.4, size: sz - 1 });
    else if (type === 'crack') g.particles.spawn(d.x, d.y, { color: pal.shell, count: 8, speed: 80, life: 0.35, size: sz - 1 });
    else if (type === 'burst') { g.particles.spawn(d.x, d.y, { color: pal.lure, count: 18, speed: 140, life: 0.5, size: sz }); }
    else if (type === 'qhurt') g.particles.spawn(d.x, d.y, { color: pal.hive, count: 3, speed: 60, life: 0.25, size: 2 });
    else if (type === 'queen') { g.particles.spawn(d.x, d.y, { color: pal.hive, count: 40, speed: 200, life: 1.1, size: sz + 1 }); g.particles.spawn(d.x, d.y, { color: pal.fire, count: 24, speed: 120, life: 0.9, size: sz }); }
    else if (type === 'die') { g.particles.spawn(d.x, d.y, { color: pal.ship, count: 30, speed: 160, life: 0.9, size: sz }); g.particles.spawn(d.x, d.y, { color: '#ffffff', count: 12, speed: 90, life: 0.6, size: 3 }); }
  }

  function onEvent(type, d) {
    R.sfx(g, type, d); fx(type, d); sync();
    if (type === 'wave' && d.wave > 1 && g._sceneName === 'play' && g.adReady()) { cardW = d.wave - 1; g.goto('card'); }   // межстраничная — по нажатию на карточке (Яндекс 4.4)
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }
  function newGame() {
    g.resetRun();
    game = R.Game({ lives: 3, diff: function (b, s, m) { return g.difficulty(b, s, m); }, onEvent: onEvent });
    g.state.level = 1; game.start(); R.current = game; sync();
  }

  g.useStandardScreens({ lives: 3, subtitle: R.STR.ru.subtitle });
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this); };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка: лидеры «roy», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «roy», GamePush — числовое поле игрока «roy» + лидерборд; товар no_ads
  // (постоянный). Список — promo/roy/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'roy';
  g.persist('arcade.best.roy', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): 1 корабль на той же волне, рой отогнан; бонус в паузе — +1 корабль (до 5)
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // меню вмещает пункты площадки: шаг сжимается, если пунктов много (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- Карточка «улей погашен» (только когда площадка готова показать межстраничную): нажатие → реклама → дальше ----------
  var cardW = 0, cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), P = rnd().P, W = this.W, H = this.H;
      if (game) rnd().draw(ctx, game.state(), this, { bare: true }); else this.clear();
      ctx.fillStyle = 'rgba(6,6,14,.74)'; ctx.fillRect(0, 0, W, H);
      R.ui.txt(this, this.t('cardClear'), W / 2, H / 2 - 30, { size: 28, align: 'center', color: th.accent, maxWidth: W - 40 }, P);
      R.ui.txt(this, this.t('level') + ' ' + cardW + '/' + C.WAVES + (game ? ' · ' + this.t('score') + ': ' + game.state().score : ''), W / 2, H / 2 + 8, { size: 16, align: 'center', color: th.ink, maxWidth: W - 40 }, P);
      R.ui.txt(this, this.t('cardNext'), W / 2, H / 2 + 46, { size: 14, align: 'center', color: th.muted, weight: 600, maxWidth: W - 40 }, P);
    }
  });

  // ---------- Заставка: рой-демо «играет сам» ----------
  var demo = null, demoSeed = 3;
  function makeDemo() {
    var s = demoSeed++, rng = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    demo = R.Game({ lives: 99, rng: rng, startWave: 1 + (demoSeed % 4) }).start();
    var S = demo.state(); S.banner = null; S.tip = null; S.tut = 0;
  }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(), p = S.player, best = null;
    for (var i = 0; i < S.drones.length; i++) { var d = S.drones[i]; if (d.state === 'live' && (best == null || Math.abs(d.x - p.x) < Math.abs(best - p.x))) best = d.x; }
    if (S.lure && S.lure.state === 'hover') best = S.lure.x;
    var tx = best == null ? C.W / 2 : best, dx = tx - p.x;
    demo.setDir(Math.abs(dx) < 3 ? 0 : Math.max(-1, Math.min(1, dx / 30)), (585 - p.y) / 40);
    if (Math.abs(dx) < 8) demo.fire();
    if (S.t % 7 < 0.05) demo.lure();
    demo.update(dt); S.banner = null; S.tip = null;
    if (S.over || S.t > 45 || S.phase === 'clear') makeDemo();
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); if (titleNote && titleNote.a > 0) titleNote.a -= dt; };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, W = this.W, H = this.H, touch = this.input.touchOnly || this.input.device === 'touch';
    r.draw(ctx, demo.state(), this, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,8,.74)' : 'rgba(10,8,24,.72)'; ctx.fillRect(0, 0, W, H);
    var pw = 400, ph = 390, px = (W - pw) / 2, py = 84;
    R.ui.panel(ctx, px, py, pw, ph, P);
    R.ui.txt(this, this.t('title'), W / 2, py + 58, { size: 46, align: 'center', color: P.accent, weight: 900, maxWidth: pw - 30 }, P);
    R.ui.txt(this, this.t('subtitle'), W / 2, py + 88, { size: 13, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 }, P);
    // кто есть кто: значок, имя, очки
    var rows = [['gnat', '10 ' + this.t('ptsChain')], ['shell', '20 · ' + this.t('ptsShell')], ['powder', '15 · ' + this.t('ptsPowder')], ['queen', this.t('ptsQueen')]];
    for (var i = 0; i < rows.length; i++) {
      var cx = px + 24 + (i % 2) * 192, cy = py + 118 + Math.floor(i / 2) * 34;
      r.icon(ctx, rows[i][0], cx + 10, cy, this);
      R.ui.txt(this, this.t(rows[i][0]), cx + 30, cy - 3, { size: 12, color: th.ink, maxWidth: 150 }, P);
      R.ui.txt(this, rows[i][1], cx + 30, cy + 11, { size: 9, color: th.muted, weight: 600, maxWidth: 150 }, P);
    }
    var mf = menuFit(menu, py + 210, 30, py + 192, py + ph - 40); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) R.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 16, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    R.ui.txt(this, this.t(touch ? 'hintTouch1' : 'hint1'), W / 2, H - 92, { size: 13, align: 'center', color: th.ink, weight: 700, maxWidth: W - 24 }, P);
    R.ui.txt(this, this.t(touch ? 'hintTouch2' : 'hint2'), W / 2, H - 70, { size: 11, align: 'center', color: th.muted, weight: 600, maxWidth: W - 24 }, P);
    if (titleNote && titleNote.a > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, titleNote.a); R.ui.txt(this, titleNote.text, W / 2, H - 40, { size: 11, align: 'center', color: th.good, weight: 700, maxWidth: W - 20 }, P); ctx.restore(); }
  };

  // ---------- Игровая сцена ----------
  var stick = global.ArcadeStick ? global.ArcadeStick.create(pad && pad.querySelector('[data-stick]')) : { x: 0, y: 0, active: false };
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return;
      if (a === 'pause') { this.pause(); return; }
      if (a === 'action') game.fire();
    },
    update: function (dt) {
      if (!game) return;
      var dx = this.input.dir.x, dy = this.input.dir.y;
      if (stick.active) { dx = stick.x; dy = stick.y; }
      game.setDir(dx, dy);
      game.setFire(this.input.pressed('action'));
      game.update(Math.min(dt, 1 / 30));
      sync();
    },
    draw: function (ctx) { if (game) rnd().draw(ctx, game.state(), this); else this.clear(); }
  });
  // манок: X / C / Shift (геймпад B → KeyX), тач — ◆
  function live() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }
  var LURE_KEYS = { KeyX: 1, KeyC: 1, ShiftLeft: 1, ShiftRight: 1 };
  addEventListener('keydown', function (e) { if (LURE_KEYS[e.code] && !e.repeat && live()) { e.preventDefault(); game.lure(); } });
  if (pad) pad.querySelectorAll('[data-act="lure"]').forEach(function (b) {
    var on = function (e) { e.preventDefault(); if (live()) game.lure(); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
  });
  var cv = g.canvas;
  cv.addEventListener('touchstart', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } }, { passive: false });
  cv.addEventListener('mousedown', function () { if (g._sceneName === 'card') cardGo(); });

  g.start('title');
  R.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
