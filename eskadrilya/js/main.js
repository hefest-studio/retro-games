/* ЭСКАДРИЛЬЯ (HAZEWING) · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Переделка 2026-11 «Наводка и завеса». Сцены title/pause/win/gameover — g.useStandardScreens; титул свой: демо-полёт на фоне + меню.
   Ввод: стрелки/WASD (полёт), огонь автоматический, X / Пробел / Shift / K — дым (удержание); геймпад — стик, A/B — дым;
   тач — стик (js/stick.js) + ☁ дым, II — пауза; палец/мышь по полю — самолёт идёт за указателем.
   Площадка (движок v2.8–2.10): таблица лидеров «eskadrilya», «Без рекламы», «ещё шанс» и бонус в паузе за рекламу,
   межстраничная — по нажатию на карточке между перелётами. */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA, L = E.logic;

  // Переделка 2026-11: правила и счёт новые — прежний рекорд уходит в «прежний рекорд», рекорд начинается заново
  var LS = null; try { LS = global.localStorage; } catch (e) {}
  var oldBest = E.migrate(LS), migrated = oldBest > 0;

  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0a3a55', panel: '#121926', ink: '#f2eee6', muted: '#9ba7b8', accent: '#ff8a3d', good: '#5fe0a0', bad: '#ff5d6c', grid: '#24324a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#fc9838', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'eskadrilya', leaderboard: 'eskadrilya', strings: E.STR, theme: 'modern', lives: 3, themes: themes });
  E.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  E.ui.init(g);
  var titleNote = migrated ? { text: g.t('migrated') + ' · ' + g.t('oldBest') + ': ' + oldBest, a: 9 } : null;

  function rnd() { return g.themeName === 'retro' ? E.classic : E.modern; }
  var game = null, toasts = [], fx = [], playSince = 0, shake = 0, lastBroken = -9;

  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.9 && Math.abs(toasts[i].y - y) < 16) y -= 18;
    toasts.push({ text: text, color: color, x: Math.max(70, Math.min(L.W - 70, x)), y: y, t: 1.4 });
  }
  function ring(x, y, color, r, life) { fx.push({ x: x, y: y, color: color, r: r || 22, t: life || 0.4, life: life || 0.4 }); }

  var PKC = { smoke: '#d8dee8', patch: '#5fe0a0', power: '#ff8a3d' };
  function visual(type, d) {
    var retro = g.themeName === 'retro', sz = retro ? 4 : 3, P = rnd().P;
    if (type === 'kill') {
      var big = d.type === 'blimp', c = big ? '#ff8a3d' : d.type === 'swift' ? '#c7d3df' : '#e0a060';
      g.particles.spawn(d.x, d.y, { color: c, count: big ? 40 : 12, speed: big ? 170 : 100, life: big ? 0.9 : 0.45, size: sz });
      if (big) g.particles.spawn(d.x, d.y, { color: '#5a5e68', count: 20, speed: 60, life: 1.1, size: sz + 1 });
      ring(d.x, d.y, c, big ? 50 : 18, big ? 0.7 : 0.3);
      if (big || d.soot) toast('+' + d.pts + (d.soot ? ' ' + g.t('soot') : ''), d.soot ? P.good : P.accent, d.x, d.y);
    } else if (type === 'groundKill') {
      g.particles.spawn(d.x, d.y, { color: '#ffb03a', count: 18, speed: 110, life: 0.6, size: sz });
      g.particles.spawn(d.x, d.y, { color: '#4a4a52', count: 12, speed: 50, life: 1.0, size: sz + 1 });
      ring(d.x, d.y, '#ff8a3d', 26, 0.45);
      if (d.soot) toast('+' + d.pts + ' ' + g.t('soot'), P.good, d.x, d.y);
    } else if (type === 'hitAir' || type === 'groundHit' || type === 'podHit' || type === 'coreHit') g.particles.spawn(d.x, d.y, { color: '#ffd27a', count: 3, speed: 60, life: 0.2, size: 2 });
    else if (type === 'clang') g.particles.spawn(d.x, d.y, { color: '#cfe6ff', count: 3, speed: 60, life: 0.2, size: 2 });
    else if (type === 'aimBroken') {   // подпись «СОРВАЛ!» — не чаще раза в 0,8 с (в густой завесе срывов много), кольцо — всегда
      ring(d.x, d.y, '#e8ecf2', 20, 0.4); g.particles.spawn(d.x, d.y, { color: '#e8ecf2', count: 6, speed: 50, life: 0.35, size: sz - 1 });
      if (g.time - lastBroken > 0.8) { lastBroken = g.time; toast(g.t('broken'), P.ink, d.x, d.y - 18); }
    }
    else if (type === 'sooted') g.particles.spawn(d.x, d.y, { color: '#3a3a44', count: 8, speed: 40, life: 0.6, size: sz });
    else if (type === 'podKill') { g.particles.spawn(d.x, d.y, { color: '#ff6a2a', count: 26, speed: 140, life: 0.8, size: sz }); ring(d.x, d.y, '#ff6a2a', 40, 0.6); toast('+' + d.pts, P.accent, d.x, d.y); shake = 0.25; }
    else if (type === 'coreOpen') toast(g.t('coreOpen'), P.bad, L.W / 2, 300);
    else if (type === 'bossDown') { g.particles.spawn(d.x, d.y, { color: '#ff6a2a', count: 70, speed: 240, life: 1.4, size: sz + 1 }); g.particles.spawn(d.x, d.y, { color: '#5a5e68', count: 40, speed: 120, life: 1.2, size: sz }); ring(d.x, d.y, '#ff6a2a', 120, 1.0); toast('+' + d.pts, P.good, d.x, d.y + 70); shake = 0.6; }
    else if (type === 'hurt') { g.particles.spawn(d.x, d.y, { color: '#ff5d3a', count: 8, speed: 90, life: 0.35, size: sz }); ring(d.x, d.y, '#ff5d3a', 22, 0.35); shake = 0.18; }
    else if (type === 'pickup') { ring(d.x, d.y, PKC[d.kind], 30, 0.5); toast(g.t('pk_' + d.kind), PKC[d.kind], d.x, d.y - 30); }
    else if (type === 'playerLost') { g.particles.spawn(d.x, d.y, { color: '#ff8a3d', count: 40, speed: 170, life: 1.0, size: sz }); g.particles.spawn(d.x, d.y, { color: '#3a3a40', count: 20, speed: 70, life: 1.2, size: sz + 1 }); ring(d.x, d.y, '#ff5d3a', 50, 0.7); shake = 0.4; }
    else if (type === 'life') toast(g.t('extra'), P.good, L.W / 2, 420);
    else if (type === 'bossAnchor') toast(g.t('anchored'), P.bad, L.W / 2, 440);
  }

  function onEvent(type, d) {
    E.sfx(g, type, d); visual(type, d);
    sync();
    if (type === 'level' && d.level > 1 && g._sceneName === 'play' && g.adReady()) { cardL = d.level - 1; g.goto('card'); }   // межстраничная — по нажатию на карточке
    if (type === 'win') g.win();
    else if (type === 'gameover') { g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play' && game && game.state().over) g.gameover(); }, 1300); }
  }

  function newGame() {
    g.resetRun();
    game = E.Game({ lives: 3, level: 1, difficulty: diff, onEvent: onEvent });
    game.start(); E.current = game; toasts = []; fx = []; shake = 0; sync();
  }

  // ---------- Стандартные экраны; фон пауз/финалов — кадр игры ----------
  g.useStandardScreens({ lives: 3, subtitle: E.STR.ru.subtitle });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    var S = game ? game.state() : demo ? demo.state() : null;
    if (S) { rnd().draw(this.ctx, S, this, { bare: true }); this.ctx.fillStyle = 'rgba(0,0,0,.35)'; this.ctx.fillRect(0, 0, this.W, this.H); }
  };

  // ---------- Площадка: лидеры «eskadrilya», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «eskadrilya», GamePush — числовое поле игрока «eskadrilya» + лидерборд;
  // товар no_ads (постоянный). Список — promo/eskadrilya/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'eskadrilya';
  g.persist('arcade.best.eskadrilya', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });
  // «Ещё один шанс» (раз за партию): 1 самолёт на том же перелёте; бонус в паузе — +1 самолёт (до 5)
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // меню вмещает пункты площадки: шаг сжимается, если пунктов много (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- Карточка «Кузня сбита» между перелётами (только когда площадка готова показать межстраничную) ----------
  var cardL = 0, cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), P = rnd().P, W = this.W, H = this.H;
      if (game) rnd().draw(ctx, game.state(), this, { bare: true }); else this.clear();
      ctx.fillStyle = 'rgba(6,10,18,.74)'; ctx.fillRect(0, 0, W, H);
      E.ui.txt(this, this.t('cardClear'), W / 2, H / 2 - 30, { size: 28, align: 'center', color: th.accent, maxWidth: W - 40 }, P);
      E.ui.txt(this, this.t('level') + ' ' + cardL + '/' + L.LEVELS.length + (game ? ' · ' + this.t('score') + ': ' + game.state().score : ''), W / 2, H / 2 + 8, { size: 16, align: 'center', color: th.ink, maxWidth: W - 40 }, P);
      E.ui.txt(this, this.t('cardNext'), W / 2, H / 2 + 46, { size: 14, align: 'center', color: th.muted, weight: 600, maxWidth: W - 40 }, P);
    }
  });

  // ---------- Титул: демо-полёт «играет сам» (дымит на наводку) ----------
  var demo = null, demoSeed = 3, demoLv = [2, 3, 5, 4, 7, 6, 8];
  function makeDemo() {
    var s = demoSeed++, rng = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    demo = E.Game({ level: demoLv[demoSeed % demoLv.length], maxLevel: 99, lives: 99, rng: rng, noTut: true }).start();
    var S = demo.state(); S.banner = 0; S.dist = 200 + rng() * 600;
  }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(), P = S.player, best = null, by = 520;
    S.air.forEach(function (e) { if (e.alive && e.y < P.y - 40 && (best == null || Math.abs(e.x - P.x) < Math.abs(best - P.x))) best = e.x; });
    if (best == null) S.ground.forEach(function (gg) { var y = demo._sy(gg.wy); if (gg.alive && y > 60 && y < P.y - 60 && (best == null || Math.abs(gg.x - P.x) < Math.abs(best - P.x))) best = gg.x; });
    var tx = best == null ? L.W / 2 + Math.sin(S.time * 0.7) * 120 : best, dx = tx - P.x;
    var dodge = 0;
    S.bullets.forEach(function (b) { if (b.vy > 0 && b.y < P.y && P.y - b.y < 120 && Math.abs(b.x - P.x) < 20) dodge = b.x < P.x ? 1 : -1; });
    demo.setDir(dodge || (Math.abs(dx) < 4 ? 0 : Math.max(-1, Math.min(1, dx / 20))), Math.abs(P.y - by) < 6 ? 0 : (by - P.y) / 30);
    demo.setSmoke(S.aims.some(function (a) { return a.y < P.y - 40; }) && P.smoke > 20);
    demo.update(dt);
    P.hull = 3;
    if (S.over || S.time > 45 || S.phase === 'clear' || S.stage === 'boss' && S.time > 30) makeDemo();
  }

  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); if (titleNote && titleNote.a > 0) titleNote.a -= dt; };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H, touch = this.input.touchOnly || this.input.device === 'touch';
    r.draw(ctx, demo.state(), this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.66)' : 'rgba(6,14,24,.6)'; ctx.fillRect(0, 0, W, H);
    var pw = 400, ph = 400, px = (W - pw) / 2, py = 84;
    E.ui.panel(this, ctx, px, py, pw, ph, P.hudLine === '#24324a' ? '#2c3a52' : P.hudLine, P);
    E.ui.txt(this, this.t('title'), W / 2, py + 54, { size: retro ? 38 : 42, align: 'center', color: P.accent, weight: 900, maxWidth: pw - 30 }, P);
    E.ui.txt(this, this.t('subtitle'), W / 2, py + 80, { size: retro ? 10 : 12, align: 'center', color: th.ink, weight: 700, maxWidth: pw - 24 }, P);
    // кто есть кто: линия наводки → дым на линии → закопчённый враг ×2
    var t = this.time, lx = px + 34, rows = ['lg_aim', 'lg_smoke', 'lg_soot'];
    for (var i = 0; i < 3; i++) {
      var cy = py + 108 + i * 28;
      if (retro) { ctx.fillStyle = '#ff5555'; for (var k = 0; k < 5; k++) if (k % 2 === Math.floor(t * 6) % 2 || i) ctx.fillRect(lx - 18 + k * 8, cy - 1, 4, 3); }
      else { ctx.save(); ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.moveTo(lx - 20, cy); ctx.lineTo(lx + 22, cy); ctx.stroke(); ctx.restore(); }
      if (i >= 1) { ctx.fillStyle = retro ? '#ffffff' : 'rgba(230,234,240,.9)'; if (retro) ctx.fillRect(lx - 6, cy - 8, 14, 16); else { ctx.beginPath(); ctx.arc(lx, cy, 9, 0, Math.PI * 2); ctx.arc(lx + 8, cy + 2, 7, 0, Math.PI * 2); ctx.fill(); } }
      if (i === 2) { ctx.fillStyle = retro ? '#55ff55' : '#5fe0a0'; E.ui.txt(this, '×2', lx + 22, cy + 4, { size: 11, align: 'center', color: retro ? '#55ff55' : '#5fe0a0', weight: 900 }, P); }
      E.ui.txt(this, this.t(rows[i]), lx + 40, cy + 4, { size: 12, color: th.ink, weight: 600, maxWidth: pw - 90 }, P);
    }
    var mf = menuFit(menu, py + 214, 30, py + 196, py + ph - 40); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) E.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 16, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    E.ui.txt(this, this.t(touch ? 'hintTouch1' : 'hint1'), W / 2, H - 92, { size: 12, align: 'center', color: th.ink, weight: 700, maxWidth: W - 24 }, P);
    E.ui.txt(this, this.t(touch ? 'hintTouch2' : 'hint2'), W / 2, H - 70, { size: 11, align: 'center', color: th.muted, weight: 600, maxWidth: W - 24 }, P);
    if (titleNote && titleNote.a > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, titleNote.a); E.ui.txt(this, titleNote.text, W / 2, H - 40, { size: 11, align: 'center', color: th.good, weight: 700, maxWidth: W - 20 }, P); ctx.restore(); }
  };

  // ---------- Игровая сцена ----------
  var stick = global.ArcadeStick ? global.ArcadeStick.create(pad && pad.querySelector('[data-stick]')) : { x: 0, y: 0, active: false };
  var SMOKE_KEYS = { KeyX: 1, KeyK: 1, ShiftLeft: 1, ShiftRight: 1 }, keySmoke = {};
  var drag = null;   // { id, sx, sy, px, py, tx, ty }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) { if (!game) return; if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var dx = this.input.dir.x, dy = this.input.dir.y, S = game.state();
      if (stick.active) { dx = stick.x; dy = stick.y; }
      if (!dx && !dy && drag && drag.tx != null) {
        var ex = drag.tx - S.player.x, ey = drag.ty - S.player.y;
        dx = Math.abs(ex) < 5 ? 0 : Math.max(-1, Math.min(1, ex / 12)); dy = Math.abs(ey) < 5 ? 0 : Math.max(-1, Math.min(1, ey / 12));
      }
      game.setDir(dx, dy);
      game.setFire(true);
      var held = false; for (var k in keySmoke) if (keySmoke[k]) held = true;
      game.setSmoke(held || this.input.pressed('action') || E.ui.smokeHeld());
      game.update(Math.min(dt, 1 / 30));
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      for (i = 0; i < fx.length; i++) fx[i].t -= dt;
      fx = fx.filter(function (o) { return o.t > 0; });
      if (shake > 0) shake -= dt;
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var s = shake > 0 && g._sceneName === 'play' ? shake * 10 : 0;
      ctx.save(); if (s) ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      rnd().draw(ctx, game.state(), this, { toasts: toasts, fx: fx });
      ctx.restore();
    }
  });

  // ---------- Дым с клавиатуры (удержание): X / K / Shift (+ Пробел и геймпад A/B через движок) ----------
  addEventListener('keydown', function (e) { if (SMOKE_KEYS[e.code]) { keySmoke[e.code] = true; if (g._sceneName === 'play') e.preventDefault(); } });
  addEventListener('keyup', function (e) { if (SMOKE_KEYS[e.code]) keySmoke[e.code] = false; });
  addEventListener('blur', function () { keySmoke = {}; });

  // ---------- Палец/мышь по полю: самолёт идёт за указателем (со смещением) ----------
  var cv = g.canvas;
  function canvasPt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (g.W / r.width), y: (e.clientY - r.top) * (g.H / r.height) }; }
  function live() { return g._sceneName === 'play' && game && g.time - playSince > 0.25; }
  cv.addEventListener('pointerdown', function (e) {
    if (g._sceneName === 'card') { cardGo(); return; }
    if (!live()) return;
    var p = canvasPt(e), S = game.state();
    drag = { id: e.pointerId, sx: p.x, sy: p.y, px: S.player.x, py: S.player.y, tx: S.player.x, ty: S.player.y };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id || !live()) return;
    var p = canvasPt(e);
    drag.tx = Math.max(L.PX0, Math.min(L.PX1, drag.px + (p.x - drag.sx) * 1.3));
    drag.ty = Math.max(L.PY0, Math.min(L.PY1, drag.py + (p.y - drag.sy) * 1.3));
  });
  function endDrag(e) { if (drag && (!e || e.pointerId === drag.id)) drag = null; }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

  g.start('title');
  E.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
