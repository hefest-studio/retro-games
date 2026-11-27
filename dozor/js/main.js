/* ОБОЗ (папка dozor) · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер с палитрами retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2,
   подсказка). Тач — виртуальный стик (js/stick.js) + ● огонь (через движок) и ⛓ заслон, только И1. Геймпад — движком по usePlayers:
   A — огонь, B — заслон. Площадка (v2.8–2.10): таблица «dozor», «Без рекламы», ещё один шанс и +1 жизнь за ролик, межстраничная между этапами.
   Титул — медленная панорама «Песчаного тракта» под меню. */
(function (global) {
  'use strict';
  var D = global.DOZOR, L = D.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#101216', panel: '#171a20', ink: '#f3eee4', muted: '#a3a9b3', accent: '#f0a050', grid: '#2a2e36' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8a838', muted: '#a8a8a8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.VIEW_W, height: L.SCREEN_H, gameId: 'dozor', leaderboard: 'dozor', strings: D.STR, theme: 'modern', lives: 3, themes: themes });
  D.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  D.ui.init(g);
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'), {});
  function pal() { return g.themeName === 'retro' ? D.classic : D.modern; }

  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND, actions: ['fire', 'sec'], pad: pad,
    touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'fire' },
    hint: ['ru', 'en', 'tr', 'es', 'pt'].reduce(function (o, l) { o[l] = [D.STR[l].hint1, D.STR[l].hint2]; return o; }, {})
  });

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0;
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y, big) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.3, big: big }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!game || !d || d.x == null) return;
    var S = game.state(), sx = d.x, sy = d.y - S.camY + L.HUD, P = pal(), sz = P.pixel ? 4 : 3;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: d.type === 'infantry' ? '#c8ccd4' : '#c87a3a', count: d.type === 'tank' || d.type === 'car' ? 24 : 10, speed: 120, life: 0.5, size: sz });
    else if (type === 'block') g.particles.spawn(sx, sy, { color: '#8a7a5a', count: 12, speed: 110, life: 0.5, size: sz });
    else if (type === 'depot') g.particles.spawn(sx, sy, { color: '#9a7a4a', count: 30, speed: 150, life: 0.8, size: sz + 1 });
    else if (type === 'wagDie') g.particles.spawn(sx, sy, { color: '#c87a3a', count: 16, speed: 130, life: 0.6, size: sz });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: P.hero[d.pi], count: 22, speed: 140, life: 0.8, size: sz });
    else if (type === 'hook') g.particles.spawn(sx, sy, { color: P.flag, count: 8, speed: 70, life: 0.4, size: 2 });
    else if (type === 'bossDie') g.particles.spawn(sx, sy, { color: '#ff7a3a', count: 60, speed: 240, life: 1.3, size: sz + 1 });
  }
  function onEvent(type, d) {
    D.sfx(g, type, d); fx(type, d);
    var P = pal(), S = game ? game.state() : null;
    if (type === 'hook') toast(S.heroes[d.pi].wag.length >= L.WAG.max ? g.t('full') : g.t('hook'), P.flag, d.x, d.y - 14);
    else if (type === 'wagCut') toast(g.t('cut'), P.warn, d.x, d.y - 20);
    else if (type === 'post') toast(g.t('post'), P.flag, d.x, d.y - 18);
    else if (type === 'wagLostFar') toast(g.t('wagLost'), P.muted, d.x, S.camY + L.VIEW_H - 16);
    else if (type === 'extraLife') { var h2 = S.heroes[d.pi]; toast(g.t('extraLife'), P.good, h2.x, h2.y - 40, true); }
    else if (type === 'trainWarn') toast(g.t('train'), P.bad, L.VIEW_W / 2, d.y - 30, true);
    else if (type === 'heli') toast(g.t('heli'), P.bad, L.VIEW_W / 2, S.camY + 120, true);
    else if (type === 'continue') toast(g.t('continued'), P.warn, L.VIEW_W / 2, S.camY + 300, true);
    if (type === 'boom' && d.r > 32 || type === 'depot' || type === 'heroDie') shakeT = Math.max(shakeT, 0.22);
    if (type === 'bossDie') shakeT = 1.4;
    sync();
    if (type === 'clear' && S.stage < S.maxStage && g.adReady && g.adReady()) S.hold = true;
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame(o) {
    game = D.Game(Object.assign({ players: g.input.playerCount, onEvent: onEvent }, o || {}));
    D.current = game; toasts = []; shakeT = 0; game.start(); sync();
  }
  [0, 1].forEach(function (pi) {
    g.input.player(pi).onPress(function (name) {
      if (!game) return;
      if (game.state().phase === 'cont') { if (name === 'fire' || name === 'sec') game.cont(); return; }
      if (game.state().hold && (name === 'fire' || name === 'sec')) { holdGo(); return; }
      if (name === 'sec') game.sec(pi);
    });
  });
  // Тач-кнопка заслона (только И1)
  var sb = pad && pad.querySelector('[data-sec]');   // ⛓ заслон
  if (sb) {
    var onSec = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play' && game) { if (game.state().phase === 'cont') game.cont(); else game.sec(0); } };
    sb.addEventListener('touchstart', onSec, { passive: false }); sb.addEventListener('mousedown', onSec);
  }

  // ---------- Титул: панорама поля ----------
  var demo = D.Game({ players: 1, rng: L.mulberry32(7) }).start(), demoT = 0;
  function demoState() {
    var S = demo.state();
    S.camY = Math.max(0, S.H * L.T - L.VIEW_H - 400 * (0.5 + 0.5 * Math.sin(demoT * 0.06 - 1.5)));
    S.banner = 0; S.heroes[0].alive = false;
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    D.ui.render(this, ctx, demoState(), P, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.5)' : 'rgba(10,10,14,.5)'; ctx.fillRect(0, 0, W, H);
    var pw = 400, ph = 420, px = (W - pw) / 2, py = 70;
    D.ui.panel(ctx, px, py, pw, ph, P, P.line);
    D.ui.txt(this, this.t('title'), W / 2, py + 66, { size: 56, align: 'center', color: P.accent, weight: 900 }, P);
    D.ui.txt(this, this.t('subtitle'), W / 2, py + 92, { size: 11, align: 'center', color: th.muted, weight: 600, shadow: false, maxWidth: 380 }, P);
    var two = g.input.playerCount === 2, hx = two ? [W / 2 - 34, W / 2 + 34] : [W / 2];
    hx.forEach(function (x, i) {
      D.render.hero(ctx, P, { id: i, x: x, y: py + 140, alive: true, inv: 0, ang: Math.sin(demoT * 1.2 + i) * 0.25, moving: true, carried: 0 }, demoT);
    });
    var mf = menuFit(menu, py + 200, 30, py + 186, py + ph - 40); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) D.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    this.menu._drawHint('title');
  };
  // Финалы и пауза — поверх мира
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') D.ui.render(this, this.ctx, game ? game.state() : demoState(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8/2.9): таблица «dozor», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «dozor», GamePush — числовое поле игрока «dozor» + лидерборд; товар no_ads
  // (постоянный). Список — promo/dozor/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'dozor';
  g.persist('arcade.best.dozor', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): все выбывшие встают с 1 жизнью и вагоном; бонус в паузе — +1 жизнь (до двух раз за партию)
  g.useRewardedContinue({ revive: function () { if (game && game.reviveAd()) sync(); } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  // Конец этапа: если площадка готова показать межстраничную — карточка «дальше», ролик по действию игрока
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
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), on = pi < g.input.playerCount, dx = 0, dy = 0;
        if (on) { dx = (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0); dy = (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0); }
        if (pi === 0 && stick.active) { dx = stick.x; dy = stick.y; }
        game.setDir(pi, dx, dy); game.setFire(pi, on && P.pressed('fire'));
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) D.ui.render(this, ctx, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 5 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  D.app = { g: g, game: function () { return game; }, newGame: newGame };   // для отладки/автотестов в браузере (newGame({stage}))
})(typeof window !== 'undefined' ? window : globalThis);
