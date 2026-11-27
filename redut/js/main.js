/* РЕДУТ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens. Ввод: стрелки/WASD (движок) — ход, Пробел/Z/J — опора (у последней опоры
   ещё раз — снять), X/K/F/Shift — вспышка; тач (площадки): виртуальный стик (js/stick.js) + ◈ опора + ✦ вспышка (кольцо заряда) + II пауза.
   Геймпад — движком: стик/крестовина — ход, A (Space) — опора, B (KeyX) и курки — вспышка. Площадка (v2.8–2.10): таблица «redut»,
   «Без рекламы», ещё один шанс и +1 жизнь за ролик, межстраничная между волнами. Титул — живая демо-партия на фоне меню.
   Сохранения: при первом запуске после переделки (2026-11) старый рекорд танковой версии сбрасывается (ключ arcade.redut.ver). */
(function (global) {
  'use strict';
  var R = global.REDUT, L = R.logic;
  // ---------- Переделка 2026-11: рекорд прежней игры (другая механика и очки) сбрасывается один раз, с уведомлением на титуле ----------
  var VER_KEY = 'arcade.redut.ver', notice = false;
  try {
    var ls = global.localStorage;
    if (ls.getItem(VER_KEY) !== '2') {
      if (ls.getItem('arcade.best.redut') || ls.getItem('arcade.players.redut')) notice = true;
      ls.removeItem('arcade.best.redut'); ls.removeItem('arcade.players.redut'); ls.setItem(VER_KEY, '2');
    }
  } catch (e) {}
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#060a13', panel: '#101a2c', ink: '#eef2fa', muted: '#97a3ba', accent: '#ffd86b', grid: '#182741' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8d858', muted: '#a8a8b8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.SCREEN_H, gameId: 'redut', leaderboard: 'redut', strings: R.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  R.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  R.ui.init(g);
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'), {});
  function pal() { return g.themeName === 'retro' ? R.classic : R.modern; }
  g.useStandardScreens({ lives: L.K.LIVES });

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0, playSince = 0, wasReady = false;
  function S() { return game.state(); }
  function sync() { if (game) { var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.wave; } }
  function toast(text, color, x, y, big) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.3, big: big }); if (toasts.length > 8) toasts.shift(); }
  function burst(x, y, color, n, speed, life, size) { g.particles.spawn(x, y + L.HUD, { color: color, count: n, speed: speed, life: life, size: size || (pal().pixel ? 4 : 3) }); }
  function onEvent(type, d) {
    R.sfx(g, type, d);
    var P = pal(), s = game ? S() : null;
    if (type === 'kill') {
      burst(d.x, d.y, d.type === 'snuff' ? P.snuffRing : d.type === 'armor' ? P.shell : d.type === 'leap' ? P.leapEye : P.mistEdge, d.type === 'armor' ? 16 : 10, 110, 0.5);
      toast('+' + d.pts, d.mult > 1 ? P.accent : P.ink, d.x, d.y - 8);
    } else if (type === 'zap') burst(d.x, d.y, P.beam, 4, 70, 0.25, 2);
    else if (type === 'bossHit') burst(d.x, d.y, P.beam, 5, 90, 0.3, 3);
    else if (type === 'bossDie') { burst(d.x, d.y, P.maw, 70, 240, 1.3, 4); burst(d.x, d.y, P.eaterEdge, 40, 180, 1.0, 4); toast('+' + d.pts, P.accent, d.x, d.y - 30, true); shakeT = 1.2; }
    else if (type === 'pylon') burst(d.x, d.y, P.pylon, 10, 80, 0.4, 2);
    else if (type === 'unpylon') burst(d.x, d.y, P.pylon, 6, 60, 0.3, 2);
    else if (type === 'pylonDie') { burst(d.x, d.y, P.pylonDim, 14, 100, 0.5); toast(g.t('pylonDie'), P.bad, d.x, d.y - 18); }
    else if (type === 'noPlace') { if (s && s.hero) toast(g.t(d.why === 'max' ? 'noMax' : d.why === 'len' ? 'noLen' : 'noNear'), P.warn, s.hero.x, s.hero.y - 20); }
    else if (type === 'flare') { burst(d.x, d.y, P.flare, 30, 200, 0.6); shakeT = Math.max(shakeT, 0.15); }
    else if (type === 'hurt') { burst(d.x, d.y, P.hero, 22, 140, 0.8); shakeT = Math.max(shakeT, 0.3); }
    else if (type === 'coreHit') { burst(d.x, d.y, P.bad, 14, 110, 0.5); toast(g.t('coreHit'), P.bad, L.CX, L.CY - 40, true); shakeT = Math.max(shakeT, 0.35); }
    else if (type === 'splat') burst(d.x, d.y, P.mistEdge, 8, 80, 0.4);
    else if (type === 'bossSpawn') toast(g.t('b_eater'), P.boss, L.CX, 120, true);
    else if (type === 'wave') { toasts = []; wasReady = false; }
    else if (type === 'clear') { if (g.adReady && g.adReady() && s.wave < s.maxWave) s.hold = true; }
    else if (type === 'win') { sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 900); }
    else if (type === 'gameover') { sync(); setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 700); }
    sync();
  }
  function newGame(o) {
    game = R.Game(Object.assign({ onEvent: onEvent, rng: L.mulberry32((Date.now() ^ 0x5bd1e995) >>> 0) }, o || {}));
    R.current = game; toasts = []; shakeT = 0; wasReady = false; game.start(); sync();
  }

  // ---------- Титул: живая демо-партия ----------
  var demo = null, demoT = 0;
  function newDemo() { demo = R.Game({ rng: L.mulberry32(11), noHints: true, wave: 3 }); demo.start(); demo.state().introT = 0.1; }
  function demoStep(dt) {
    if (!demo || demo.state().phase === 'over') newDemo();
    var s = demo.state(), h = s.hero; demoT += dt;
    s.coreHp = s.coreMax; h.inv = 1; if (s.phase === 'clear') { s.clearT = 0; }
    var a = demoT * 1.5, tx = L.CX + Math.cos(a) * 86, ty = L.CY + Math.sin(a) * 86;
    demo.setDir(tx - h.x, ty - h.y); demo.update(Math.min(dt, 0.05));
    if (s.phase === 'clear' || s.phase === 'won') newDemo();
  }
  var title = g.scenes.title, menu = g.menu.get('title');
  title.update = function (dt) { demoStep(dt); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    if (!demo) newDemo();
    R.ui.render(this, ctx, demo.state(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.55)' : 'rgba(6,10,19,.5)'; ctx.fillRect(0, 0, W, 190); ctx.fillRect(0, 430, W, H - 430);
    R.ui.txt(this, this.t('title'), W / 2, 96, { size: 62, align: 'center', color: P.accent, weight: 900 }, P);
    R.ui.txt(this, this.t('subtitle'), W / 2, 134, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false, maxWidth: 430 }, P);
    var mf = menuFit(menu, 456, 34, 446, H - 24); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) R.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, 168, { size: 13, align: 'center', color: th.ink, weight: 700, shadow: false }, P);
    if (notice) R.ui.txt(this, this.t('migrated'), W / 2, H - 8, { size: 10, align: 'center', color: P.good, weight: 700, shadow: false, maxWidth: W - 20 }, P);
    this.menu._drawHint('title');
  };
  // Финалы — поверх мира
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') R.ui.render(this, this.ctx, game ? game.state() : demo.state(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8–2.10): таблица «redut», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «redut», GamePush — числовое поле игрока «redut» + лидерборд; товар no_ads
  // (постоянный). Список — promo/redut/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'redut';
  g.persist('arcade.best.redut', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): две жизни, маяк ≥ 3, вспышка вокруг маяка; бонус в паузе — +1 жизнь и +1 к маяку (до двух раз за партию)
  g.useRewardedContinue({ revive: function () { if (game && game.reviveAd()) sync(); } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  // Конец волны: если площадка готова показать межстраничную — карточка «дальше», ролик по действию игрока
  var holdGoing = false;
  function holdGo() {
    if (!game || !game.state().hold || holdGoing) return;
    holdGoing = true; g.adBreak().then(function () { holdGoing = false; if (game) game.state().hold = false; });
  }
  g.canvas.addEventListener('pointerdown', function () { if (g._sceneName === 'play') holdGo(); });

  // ---------- Ввод: доп. клавиши и тач-кнопка вспышки ----------
  var PLACE = { KeyZ: 1, KeyJ: 1 }, FLARE = { KeyX: 1, KeyK: 1, KeyF: 1, ShiftLeft: 1, ShiftRight: 1 };
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }
  function doPlace() { if (!inPlay()) return; if (S().hold) { holdGo(); return; } game.place(); }
  function doFlare() { if (!inPlay()) return; if (S().hold) { holdGo(); return; } game.flare(); }
  addEventListener('keydown', function (e) {
    if (!(PLACE[e.code] || FLARE[e.code])) return;
    if (g._sceneName === 'play') e.preventDefault();
    if (e.repeat) return;
    if (PLACE[e.code]) doPlace(); else doFlare();
  });
  (function () {
    var b = document.getElementById('bFlare'); if (!b) return;
    var on = function (e) { if (!Arcade.touchOk(e)) return; doFlare(); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
  })();

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (a === 'pause') this.pause();
      else if (a === 'action' || a === 'start') doPlace();
    },
    update: function (dt) {
      if (!game) return;
      var d = this.input.dir, dx = d.x || 0, dy = d.y || 0;
      if (stick.active) { dx = stick.x; dy = stick.y; }
      game.setDir(inPlay() || g.time - playSince > 0.05 ? dx : 0, inPlay() || g.time - playSince > 0.05 ? dy : 0);
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      var s = S(), rd = s.charge >= L.K.CHARGE_MAX;
      if (rd && !wasReady && s.phase === 'play') R.sfx(g, 'flareReady');
      wasReady = rd; sync();
    },
    draw: function (ctx) { if (game) R.ui.render(this, ctx, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 5 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  R.app = { g: g, game: function () { return game; }, newGame: newGame };   // для отладки/автотестов в браузере (newGame({wave}))
})(typeof window !== 'undefined' ? window : globalThis);
