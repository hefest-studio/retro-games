/* ЗВЕРО-ОТРЯД · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js, levels.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens. Ввод — g.usePlayers: И1 — стрелки (↑ прыжок, ↓ упереться / в соло — сменить зверя),
   И2 — WASD; в соло обе раскладки ведут одного активного зверя, второй стоит якорем. Тач (площадки): виртуальный стик (js/stick.js) + прыжок + смена зверя
   + пауза. Геймпад — движком: стик/крестовина — ход, A — прыжок, B — упереться / сменить. Площадка (v2.8–2.10): таблица «zvero», «Без рекламы»,
   ещё один шанс и +1 жизнь за ролик, межстраничная между уровнями. Титул — живая демо-партия на фоне меню.
   Сохранения: при первом запуске после переделки (2026-11) старый рекорд платформера сбрасывается (ключ arcade.zvero-otryad.ver). */
(function (global) {
  'use strict';
  var Z = global.ZVERO, L = Z.logic;
  // ---------- Переделка 2026-11: рекорд прежней игры (другая механика и очки) сбрасывается один раз, с уведомлением на титуле ----------
  var VER_KEY = 'arcade.zvero-otryad.ver', notice = false;
  try {
    var ls = global.localStorage;
    if (ls.getItem(VER_KEY) !== '2') {
      if (ls.getItem('arcade.best.zvero-otryad')) notice = true;
      ls.removeItem('arcade.best.zvero-otryad'); ls.setItem(VER_KEY, '2');
    }
  } catch (e) {}
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#1b1410', panel: '#2a1d13', ink: '#f6efe3', muted: '#c2ad90', accent: '#ffcf5a', grid: '#3a2a1b' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8d858', muted: '#a8a8b8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'zvero-otryad', leaderboard: 'zvero', strings: Z.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  Z.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  Z.ui.init(g);
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'), {});
  function pal() { return g.themeName === 'retro' ? Z.classic : Z.modern; }
  g.useStandardScreens({ lives: L.K.LIVES });
  // Кооп за одной клавиатурой — движок: пункт «Игроки», клавиши 1/2, подсказка; тач и геймпад — по раскладке
  g.usePlayers({
    bind: { p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], jump: ['ArrowUp', 'Space', 'Slash'], hold: ['ArrowDown', 'KeyX', 'Period'] },
            p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], jump: ['KeyW', 'KeyF'], hold: ['KeyS', 'KeyG'] } },
    actions: ['jump', 'hold'], pad: pad, touch: { A: 'jump', B: 'hold' },
    hint: { ru: ['Пыж/Тяпа: ← → ход · ↑ / пробел прыжок · ↓ сменить зверя · ↑ в воздухе — выбрать канат', 'И2 (Тяпа): A D ход · W прыжок · S упереться · 1/2 — игроки'],
            en: ['Pyzh/Tyapa: ← → move · ↑ / space jump · ↓ switch beast · ↑ in the air — reel the rope', 'P2 (Tyapa): A D move · W jump · S brace · 1/2 — players'] }
  });

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0, playSince = 0, tautT = 0;
  function S() { return game.state(); }
  function sync() { if (game) { var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.lv + 1; } }
  function toast(text, color, x, y, big) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2, big: big }); if (toasts.length > 8) toasts.shift(); }
  function burst(x, y, color, n, speed, life, size) { g.particles.spawn(x, y, { color: color, count: n, speed: speed, life: life, size: size || (pal().pixel ? 4 : 3) }); }
  function onEvent(type, d) {
    Z.sfx(g, type, d);
    var P = pal(), s = game ? S() : null;
    if (type === 'star') { burst(d.x, d.y, P.star, 12, 110, 0.6); toast('+100', P.star, d.x, d.y - 10); }
    else if (type === 'kill') { burst(d.x, d.y, P.bug, 14, 130, 0.5); toast('+100', P.ink, d.x, d.y - 12); }
    else if (type === 'die') { burst(d.x, d.y, d.i ? P.tyapa : P.pyzh, 24, 170, 0.8); shakeT = Math.max(shakeT, 0.3); }
    else if (type === 'respawn') burst(d.x, d.y - 16, P.accent, 10, 90, 0.5);
    else if (type === 'land') burst(d.x, d.y, P.dust, 6, 60, 0.3, 3);
    else if (type === 'plate') { burst(d.c * L.TS + 16, d.r * L.TS + 26, P.plateOn, 8, 60, 0.4, 2); }
    else if (type === 'gate') { burst(d.c * L.TS + 16, d.r * L.TS + 16, P.gateBand, 8, 70, 0.4, 2); }
    else if (type === 'bossHit') { burst(d.x, d.y, P.bossEye, 26, 220, 0.9); toast(g.t('b_boss') + ' ' + '★'.repeat(Math.max(0, 3 - d.hp)), P.accent, d.x, d.y - 70, true); shakeT = 0.6; }
    else if (type === 'bossBash') shakeT = Math.max(shakeT, 0.35);
    else if (type === 'bossDie') { burst(d.x, d.y, P.gear, 60, 260, 1.4, 4); burst(d.x, d.y, P.bossEye, 40, 200, 1.1, 4); shakeT = 1.1; toast('+1000', P.accent, d.x, d.y - 80, true); }
    else if (type === 'gearHit') burst(d.x, d.y, P.gear, 8, 90, 0.4, 3);
    else if (type === 'clear') { burst(s.exit.x, s.exit.y - 30, P.accent, 30, 160, 0.9); if (g.adReady && g.adReady() && !d.final) s.hold = true; }
    else if (type === 'win') { sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 1300); }
    else if (type === 'gameover') { sync(); setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 900); }
    else if (type === 'level') { toasts = []; tautT = 0; }
    sync();
  }
  function newGame() {
    game = Z.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() ^ 0x5bd1e995) >>> 0), players: g.input.playerCount, noHints: false });
    Z.current = game; toasts = []; shakeT = 0; game.start(0); sync();
  }

  // ---------- Титул: живая демо-партия ----------
  var demo = null, demoT = 0, demoJ = 0;
  function newDemo() { demo = Z.Game({ rng: L.mulberry32(11), noHints: true, players: 2 }); demo.start(0); var s = demo.state(); s.phase = 'play'; s.lives = 99; demoT = 0; demoJ = 0; }
  function demoStep(dt) {
    if (!demo || demo.state().phase !== 'play') newDemo();
    var s = demo.state(), a = s.an[0], b = s.an[1]; demoT += dt; demoJ -= dt;
    var dir = Math.sin(demoT * 0.35) > 0 ? 1 : -1; if (a.x > 560) dir = -1; if (a.x < 90) dir = 1;
    var dir2 = a.x > b.x + 70 ? 1 : a.x < b.x - 70 ? -1 : (Math.sin(demoT * 0.9) > 0.3 ? 1 : 0);
    if (b.x > 560 && dir2 > 0) dir2 = 0;
    demo.setInput(0, dir, false, false); demo.setInput(1, dir2, false, false);
    if (demoJ <= 0) { demo.jump(Math.floor(demoT) % 2); demoJ = 1.1; }
    demo.update(Math.min(dt, 0.05));
    s.an[0].inv = 0; s.an[1].inv = 0;
  }
  var title = g.scenes.title, menu = g.menu.get('title');
  title.update = function (dt) { demoStep(dt); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    if (!demo) newDemo();
    Z.ui.render(this, ctx, demo.state(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.55)' : 'rgba(18,11,7,.55)'; ctx.fillRect(0, 0, W, 190); ctx.fillRect(0, 285, W, H - 285);
    Z.ui.txt(this, this.t('title'), W / 2, 98, { size: 72, align: 'center', color: P.accent, weight: 900 }, P);
    Z.ui.txt(this, this.t('subtitle'), W / 2, 142, { size: 18, align: 'center', color: th.muted, weight: 600, shadow: false, maxWidth: 700 }, P);
    var mf = menuFit(menu, 316, 32, 312, H - 120); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) Z.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, 176, { size: 15, align: 'center', color: th.ink, weight: 700, shadow: false }, P);
    if (notice) Z.ui.txt(this, this.t('migrated'), W / 2, H - 10, { size: 12, align: 'center', color: P.good, weight: 700, shadow: false, maxWidth: W - 20 }, P);
    this.menu._drawHint('title');
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') Z.ui.render(this, this.ctx, game ? game.state() : demo.state(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8–2.10): таблица «zvero», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «zvero», GamePush — числовое поле игрока «zvero» + лидерборд; товар no_ads
  // (постоянный). Список — promo/zvero-otryad/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'zvero';
  g.persist('arcade.best.zvero-otryad', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });
  // «Ещё один шанс» (раз за партию): 3 жизни, текущий уровень заново; бонус в паузе — +1 жизнь (пока их меньше девяти)
  g.useRewardedContinue({ revive: function () { if (game && game.reviveAd()) sync(); } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // «Уровень заново» — в паузе (без потери жизни)
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (game) { game.restart(); sync(); toasts = []; } g.goto('play', { resume: true }); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  // Конец уровня: если площадка готова показать межстраничную — карточка «дальше», ролик по действию игрока
  var holdGoing = false;
  function holdGo() {
    if (!game || !game.state().hold || holdGoing) return;
    holdGoing = true; g.adBreak().then(function () { holdGoing = false; if (game) game.state().hold = false; });
  }
  g.canvas.addEventListener('pointerdown', function () { if (g._sceneName === 'play') holdGo(); });

  // ---------- Ввод ----------
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }
  [0, 1].forEach(function (i) {
    g.input.player(i).onPress(function (name) {
      if (!inPlay()) return;
      if (S().hold) { holdGo(); return; }
      if (name === 'jump') game.jump(i);
      else if (name === 'hold' && g.input.playerCount === 1) game.swap();
    });
  });

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; game.setPlayers(g.input.playerCount); },
    press: function (a) {
      if (a === 'pause') this.pause();
      else if ((a === 'action' || a === 'start') && game && S().hold) holdGo();
    },
    update: function (dt) {
      if (!game) return;
      var pl = g.input.playerCount; game.setPlayers(pl);
      var p0 = g.input.player(0), p1 = g.input.player(1), d0 = p0.dir, d1 = p1.dir, on = inPlay() || g.time - playSince > 0.05;
      var x0 = stick.active ? stick.x : d0.x, up0 = d0.y < 0 || p0.pressed('jump') || (stick.active && stick.y < -0.5);
      if (pl === 1) game.setInput(0, on ? x0 : 0, on && up0, false);
      else { game.setInput(0, on ? x0 : 0, on && up0, p0.pressed('hold')); game.setInput(1, on ? d1.x : 0, on && (d1.y < 0 || p1.pressed('jump')), p1.pressed('hold')); }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      var s = S(), tt = s.rope.tension > 0.4 && s.phase === 'play'; if (tt && !tautT) Z.sfx(g, 'taut'); tautT = tt ? 1 : 0;
      sync();
    },
    draw: function (ctx) { if (game) Z.ui.render(this, ctx, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 5 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  Z.app = { g: g, game: function () { return game; }, newGame: newGame };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
