/* СПУТНИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Переделка 2026-11: главная механика — калильный жар (скользи у раскалённой кромки — мощнее огонь) и закалка (кольцо пара).
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: демо-полёт на фоне + меню движка.
   Ввод: стрелки/WASD — полёт, огонь автоматический; Пробел/X/Z/K/Shift — закалка;
   тач (площадки): виртуальный стик слева (js/stick.js) — полёт; ◆ — закалка; II — пауза.
   Геймпад (движок): стик/крестовина — полёт, A (Space) и B (KeyX) — закалка. */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK, L = Sp.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#05060f', panel: '#15131f', ink: '#f1ece6', muted: '#a49cae', accent: '#ff8a3d', grid: '#2a2640' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'sputnik', leaderboard: 'sputnik', strings: Sp.STR, theme: 'modern', lives: 3, themes: themes });
  Sp.g = g;

  function rnd() { return g.themeName === 'retro' ? Sp.classic : Sp.modern; }
  var game = null, toasts = [], fx = [], playSince = 0;

  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.level; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.9 && Math.abs(toasts[i].y - y) < 14) y -= 16;
    toasts.push({ text: text, color: color, x: Math.max(60, Math.min(L.W - 60, x)), y: Math.max(50, y), t: 1.4 });
  }
  function ring(x, y, color, r, life) { fx.push({ x: x, y: y, color: color, r: r || 20, t: life || 0.4, life: life || 0.4 }); }
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }
  function quenchAct() { if (inPlay()) game.quench(); }
  Sp.ui.init(g, quenchAct);

  var KC = { moth: '#c88ad8', dart: '#dfe5ee', turret: '#b9a3a0', walker: '#c9a77a', mine: '#b4bac4', stinger: '#d6a32a', ingot: '#ffb05a', guard: '#ff8a3d' };
  var KR = { moth: '#ff55ff', dart: '#ffffff', turret: '#aa5500', walker: '#ffff55', mine: '#aaaaaa', stinger: '#ffff55', ingot: '#ffff55', guard: '#ff5555' };
  function visual(type, d) {
    if (!game) return;
    var S = game.state(), retro = g.themeName === 'retro', sz = retro ? 4 : 3, P = rnd().P, x = (d.x || 0) - S.cx, y = d.y || 0, sh = S.ship;
    switch (type) {
      case 'kill': { var c = (retro ? KR : KC)[d.type] || '#fff'; g.particles.spawn(x, y, { color: c, count: 10, speed: 90, life: 0.45, size: sz }); ring(x, y, c, 14, 0.3);
        if (d.heat >= 10) toast('+' + d.heat + ' ' + g.t('heat'), P.heat[2], x, y - 14); break; }
      case 'skim': g.particles.spawn(x, y + (d.side === 'c' ? 2 : -2), { color: d.k > 0.6 ? '#fff1c8' : '#ffb05a', count: 2, speed: 70, life: 0.3, size: retro ? 2 : 1.6 }); break;
      case 'tier': if (d.up) { toast(g.t('t' + d.tier), P.heat[d.tier], sh.x - S.cx, sh.y - 22); ring(sh.x - S.cx, sh.y, P.heat[d.tier], 22, 0.35); } break;
      case 'quench': g.particles.spawn(x, y, { color: retro ? '#ffffff' : '#dff2ff', count: 24, speed: 160, life: 0.6, size: sz }); toast(g.t('quench'), P.steam, x, y - 24); break;
      case 'douse': g.particles.spawn(x, y, { color: retro ? '#aaaaaa' : '#c8d8e8', count: Math.min(12, 2 + d.n * 2), speed: 60, life: 0.5, size: 2 }); break;
      case 'clang': case 'wallHit': g.particles.spawn(x, y, { color: retro ? '#aaaaaa' : '#c3cad3', count: 3, speed: 50, life: 0.2, size: 2 }); break;
      case 'bossHit': case 'partHit': g.particles.spawn(x, y, { color: '#ffd27a', count: 6, speed: 80, life: 0.3, size: sz }); break;
      case 'partDie': g.particles.spawn(x, y, { color: '#ff6a2a', count: 24, speed: 140, life: 0.7, size: sz }); ring(x, y, '#ff6a2a', 40, 0.6); toast('+800', P.accent, x, y - 10); break;
      case 'guardDie': g.particles.spawn(x, y, { color: '#ff6a2a', count: 36, speed: 170, life: 0.9, size: sz }); ring(x, y, '#ff8a3d', 60, 0.7); toast('+2000', P.accent, x, y - 20); break;
      case 'bossDie': g.particles.spawn(x, y, { color: '#ff6a2a', count: 60, speed: 240, life: 1.3, size: sz + 1 }); g.particles.spawn(x, y, { color: '#fff3c8', count: 30, speed: 140, life: 1, size: sz }); ring(x, y, '#ff6a2a', 110, 1); toast('+' + d.pts, P.accent, x, y - 30); break;
      case 'playerHit': g.particles.spawn(x, y, { color: P.accent, count: 26, speed: 140, life: 0.8, size: sz }); ring(x, y, '#ff5d3a', 40, 0.6); break;
      case 'checkpoint': toast(g.t('cp'), P.good, L.W / 2, 70); break;
      case 'life': toast(g.t('extra'), P.good, L.W / 2, 90); break;
    }
  }
  function onEvent(type, d) {
    Sp.sfx(g, type, d); visual(type, d || {});
    sync();
    if (type === 'win') setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 600);
    else if (type === 'gameover') { g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play' && game && game.state().over) g.gameover(); }, 1200); }
    else if (type === 'clear' && d.level < game.state().maxLevel) setTimeout(function () { maybeCard(d.level); }, 2300);
  }
  function newGame() {
    game = Sp.Game({ lives: 3, level: 1, difficulty: diff, onEvent: onEvent });
    game.start(); Sp.current = game; toasts = []; fx = []; sync();
  }

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: 3 });
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this, null); };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8/2.9): таблица лидеров «sputnik», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «sputnik», GamePush — числовое поле игрока «sputnik» + лидерборд; товар no_ads
  // (постоянный). Список — promo/sputnik/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'sputnik';
  g.persist('arcade.best.sputnik', 'max');   // рекорд — и в облако (ключ прежний: рекорды игроков сайта сохраняются)
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): после последнего корабля — 1 корабль у контрольной точки; бонус в паузе — +1 корабль и полный жар
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- Карточка «уровень пройден» (только когда площадка готова показать межстраничную): нажатие → реклама → следующий уровень ----------
  var cardLv = 0, cardGoing = false;
  function maybeCard(lv) { if (g._sceneName === 'play' && game && g.adReady && g.adReady()) { cardLv = lv; g.goto('card'); } }
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') { playSince = g.time; g.goto('play', { resume: true }); } }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), r = rnd(), P = r.P;
      if (game) r.draw(ctx, game.state(), this, { bare: true, game: game }); else this.clear();
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.78)' : 'rgba(5,6,15,.78)'; ctx.fillRect(0, 0, this.W, this.H);
      Sp.ui.txt(this, this.t('cardDone'), this.W / 2, this.H / 2 - 30, { size: 26, align: 'center', color: th.accent, weight: 900, maxWidth: this.W - 30 }, P);
      Sp.ui.txt(this, this.t('level') + ' ' + cardLv + '/' + L.LEVELS.length + (game ? ' · ' + this.t('score') + ': ' + game.state().score : ''), this.W / 2, this.H / 2 + 4, { size: 14, align: 'center', color: th.ink, weight: 700, maxWidth: this.W - 30 }, P);
      Sp.ui.txt(this, this.t('cardNext'), this.W / 2, this.H / 2 + 36, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 30 }, P);
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- Титул: демо-полёт «играет сам» (скользит у кромки, закаляет) ----------
  var demo = null, demoSeed = 3, demoLv = [1, 2, 3, 4, 5, 6];
  function makeDemo() {
    var s = demoSeed++, rng = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    demo = Sp.Game({ level: demoLv[demoSeed % demoLv.length], maxLevel: 99, lives: 99, rng: rng }).start();
    demo._heat(40);
  }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(), sh = S.ship, look = sh.x + 40, c = demo._ceilY(look), f = demo._floorY(look), ty, tgt = null;
    S.enemies.forEach(function (e) { if (e.alive && !(e.warn > 0) && e.x > sh.x + 20 && e.x - S.cx < L.W && (!tgt || e.x < tgt.x)) tgt = e; });
    if (S.boss && S.boss.alive) tgt = S.boss.weak;
    ty = S.heat < 70 ? f - 26 : (c + f) / 2;   // мало жара — к полу у кромки
    if (tgt && S.heat >= 35) ty = ty * 0.3 + tgt.y * 0.7;
    ty = Math.max(c + 24, Math.min(f - 22, ty));
    var tx = S.cx + 110;
    demo.setDir(Math.abs(tx - sh.x) < 4 ? 0 : tx - sh.x, Math.abs(ty - sh.y) < 3 ? 0 : ty - sh.y);
    if (S.bullets.some(function (b) { return Math.hypot(b.x - sh.x, b.y - sh.y) < 40; })) demo.quench();
    demo.update(dt);
    if (S.over || S.time > 30 || S.phase === 'clear' || S.deaths > 0) makeDemo();
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H;
    r.draw(ctx, demo.state(), this, { bare: true, game: demo });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.72)' : 'rgba(5,6,15,.66)'; ctx.fillRect(0, 0, W, H);
    var pw = 420, ph = 300, px = (W - pw) / 2, py = 30;
    Sp.ui.panel(this, ctx, px, py, pw, ph, retro ? P.hudLine : '#3a2f48', P);
    Sp.ui.txt(this, this.t('title'), W / 2, py + 48, { size: retro ? 38 : 42, align: 'center', color: P.accent, weight: 900, maxWidth: pw - 120 }, P);
    // корабль под заголовком, накаляется и остывает
    var t = this.time, hh = 50 + 50 * Math.sin(t * 1.3);
    r.ship(ctx, W / 2, py + 72, t, { heat: hh });
    Sp.ui.txt(this, this.t('subtitle'), W / 2, py + 100, { size: retro ? 9 : 11, align: 'center', color: th.ink, weight: 600, maxWidth: pw - 24 }, P);
    Sp.ui.txt(this, this.t('sub2'), W / 2, py + 116, { size: retro ? 8 : 10, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 }, P);
    var mf = menuFit(menu, py + 146, 26, py + 130, py + ph - 30);
    menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) Sp.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 12, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
    Sp.ui.txt(this, this.t('hint'), W / 2, H - 12, { size: retro ? 9 : 10, align: 'center', color: th.muted, weight: 600, maxWidth: W - 20 }, P);
  };

  // ---------- Подсказки 1-го уровня (рисунком у корабля; текста — пара слов) ----------
  function touchMode() { return g.input.device === 'touch' || g.input.touchOnly; }
  function tutor(ctx, S) {
    if (S.level !== 1 || S.phase !== 'play' || S.ship.dead) return;
    var P = rnd().P, sh = S.ship, x = sh.x - S.cx, y = sh.y, blink = Math.floor(g.time * 3) % 2;
    if (!S.tutor.quench && S.heat < L.QUENCH_MIN && S.cx < 1500) {   // стрелка вниз к кромке
      var fy = game._floorY(sh.x), ay = Math.min(fy - 14, y + 26);
      ctx.fillStyle = blink ? P.heat[1] : P.heat[2];
      ctx.beginPath(); ctx.moveTo(x - 6, ay - 8); ctx.lineTo(x + 6, ay - 8); ctx.lineTo(x, ay); ctx.closePath(); ctx.fill();
      Sp.ui.txt(g, Sp.ui.up(P, g.t('tipSkim')), x + 12, ay - 1, { size: P.pixel ? 9 : 10, color: P.heat[1], weight: 800 }, P);
    } else if (S.tutor.quench && !S.tutor.quenched && S.heat >= L.QUENCH_MIN) {   // кнопка закалки
      var lbl = (touchMode() ? '◆' : g.prompt ? g.prompt('a') : 'Space') + ' · ' + g.t('tipQuench');
      Sp.ui.txt(g, Sp.ui.up(P, lbl), x, y - 22, { size: P.pixel ? 9 : 11, align: 'center', color: blink ? P.steam : P.heat[2], weight: 900 }, P);
    }
  }

  // ---------- Игровая сцена ----------
  var stick = global.ArcadeStick.create(document.querySelector('.pad [data-stick]'));
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); else if (a === 'action') quenchAct(); },
    update: function (dt) {
      if (!game) return;
      var dir = this.input.dir;
      if (stick.active) dir = { x: Math.abs(stick.x) > 0.3 ? stick.x : 0, y: Math.abs(stick.y) > 0.3 ? stick.y : 0 };
      game.setDir(dir.x, dir.y);
      game.update(Math.min(dt, 1 / 30));
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      for (i = 0; i < fx.length; i++) fx[i].t -= dt;
      fx = fx.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      rnd().draw(ctx, game.state(), this, { toasts: toasts, fx: fx, game: game });
      tutor(ctx, game.state());
    }
  });

  // ---------- Доп. клавиши: X/Z/K/J/Shift — закалка ----------
  var QK = { KeyX: 1, KeyZ: 1, KeyK: 1, KeyJ: 1, ShiftLeft: 1, ShiftRight: 1 };
  addEventListener('keydown', function (e) {
    if (QK[e.code] && g._sceneName === 'play') { e.preventDefault(); if (!e.repeat) quenchAct(); }
  });

  g.start('title');
  Sp.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
