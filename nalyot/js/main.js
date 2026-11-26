/* НАЛЁТ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп 1–2 игрока — g.usePlayers (пункт «Игроки»,
   клавиши 1/2, подсказка, тач — только И1). Титул — панорама «Ржавого двора» под меню.
   Тач (волна 6, площадки): виртуальный стик (js/stick.js) — бег, прицел вверх, присесть; ⤒ прыжок, ● огонь, ✸ граната;
   «Автоприцел» (пункт меню только на тач-экране, по умолчанию вкл.) — прицел сам наводится на ближнюю цель в кадре и ствол стреляет.
   Геймпад — движком по раскладке usePlayers: A — прыжок, B — граната, X и правый триггер — огонь (g.gamepad.configure). */
(function (global) {
  'use strict';
  var N = global.NALYOT, L = N.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#101216', panel: '#171a20', ink: '#f2efe8', muted: '#9aa0aa', accent: '#ffb347', grid: '#2a2e36' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.VIEW_W, height: L.SCREEN_H, gameId: 'nalyot', leaderboard: 'nalyot', strings: N.STR, theme: 'modern', lives: 3, themes: themes });
  N.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  N.ui.init(g);
  function rnd() { return g.themeName === 'retro' ? N.classic : N.modern; }

  g.useStandardScreens({ lives: 3 });
  // Кооп за одной клавиатурой — движок (g.usePlayers + g.input.player(i)), как в katakomby/ и zvero-otryad/.
  g.usePlayers({
    bind: L.BIND, actions: ['jump', 'grenade'], pad: pad,
    touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'fire' },
    hint: ['ru', 'en', 'tr', 'es', 'pt'].reduce(function (o, l) { o[l] = [N.STR[l].hint1, N.STR[l].hint2]; return o; }, {})
  });

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0;
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.3 }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!game || !d || d.x == null) return;
    var S = game.state(), sx = d.x - S.cam.x, sy = d.y + L.HUD, pix = rnd().P.pixel, sz = pix ? 4 : 3;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: d.type === 'drone' ? '#c8ccd4' : '#c87a3a', count: d.type === 'wagon' ? 26 : 10, speed: 120, life: 0.5, size: sz });
    else if (type === 'block') g.particles.spawn(sx, sy, { color: '#8a6a4a', count: 22, speed: 150, life: 0.7, size: sz + 1 });
    else if (type === 'boom') g.particles.spawn(sx, sy, { color: '#ffb04a', count: d.r > 60 ? 18 : 10, speed: 160, life: 0.4, size: sz });
    else if (type === 'bossHit' || type === 'hit') g.particles.spawn(sx, sy, { color: '#ffe0a0', count: 3, speed: 70, life: 0.2, size: 2 });
    else if (type === 'bossDie') g.particles.spawn(sx, sy, { color: '#ff7a3a', count: 60, speed: 240, life: 1.3, size: sz + 1 });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: rnd().P.hero[d.pi], count: 18, speed: 120, life: 0.7, size: sz });
    else if (type === 'armor') g.particles.spawn(sx, sy, { color: '#c8a06a', count: 10, speed: 100, life: 0.4, size: sz });
    else if (type === 'rescue') g.particles.spawn(sx, sy, { color: '#ffd25a', count: 14, speed: 90, life: 0.6, size: sz });
  }
  function onEvent(type, d) {
    N.sfx(g, type, d); fx(type, d);
    var P = rnd().P;
    if (type === 'rescue') toast(g.t('rescue'), P.good, d.x, d.y - 20);
    else if (type === 'pickup') toast(d.kind === 'w' ? g.t('w_' + d.w) : g.t('pk_' + d.kind), P.accent, d.x, d.y - 20);
    else if (type === 'weaponOut') { var h = game.state().heroes[d.pi]; toast(g.t('weaponOut'), P.muted, h.x, h.y - 50); }
    else if (type === 'armor') toast(g.t('armorLost'), P.warn, d.x, d.y - 24);
    else if (type === 'extraLife') { var h2 = game.state().heroes[d.pi]; toast(g.t('extraLife'), P.good, h2.x, h2.y - 60); }
    else if (type === 'board') toast(g.t('board'), P.accent, d.x, d.y - 70);
    else if (type === 'eject') toast(g.t('eject'), P.accent, d.x, d.y - 20);
    if (type === 'boom' && d.r > 60 || type === 'kotelBoom' || type === 'stomp') shakeT = Math.max(shakeT, 0.25);
    if (type === 'bossDie') shakeT = 1.2;
    sync();
    if (type === 'mission' && d.mission > 1 && g._sceneName === 'play' && g.adReady()) { cardM = d.mission - 1; g.goto('card'); }   // межстраничная — по нажатию на карточке миссии (Яндекс 4.4)
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame(o) {
    game = N.Game(Object.assign({ players: g.input.playerCount, onEvent: onEvent }, o || {}));
    N.current = game; toasts = []; shakeT = 0; game.start(); sync();
  }
  [0, 1].forEach(function (pi) {
    g.input.player(pi).onPress(function (name) {
      if (!game) return;
      if (name === 'jump') game.jump(pi); else if (name === 'grenade') game.grenade(pi);
    });
  });
  // Тач-кнопки прыжка и гранаты (только И1)
  function tbtn(sel, fn) {
    var b = pad && pad.querySelector(sel); if (!b) return;
    var on = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play' && game) fn(); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
  }
  tbtn('[data-jump]', function () { game.jump(0); });
  tbtn('[data-gren]', function () { game.grenade(0); });

  // ---------- Тач (волна 6): стик и автоприцел ----------
  var AIM_KEY = 'arcade.nalyot.aim', aimOn = true;
  try { aimOn = localStorage.getItem(AIM_KEY) !== '0'; } catch (e) {}
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'));
  function touchMode() { return g.input.device === 'touch' || g.input.touchOnly; }
  var aimItem = { key: 'aim', label: function () { return g.t('aim') + ': ' + g.t(aimOn ? 'on' : 'off'); },
    onSelect: function () { aimOn = !aimOn; try { localStorage.setItem(AIM_KEY, aimOn ? '1' : '0'); } catch (e) {} } };
  function syncAim() { if (touchMode()) g.menu.addItem(Object.assign({ after: 'players' }, aimItem)); else g.menu.removeItem('aim'); }   // пункт — только на тач-экране
  syncAim(); g.input.onDevice(syncAim);
  // геймпад: A — прыжок, B — граната, X и правый триггер — огонь (первая клавиша «fire» раскладки игрока)
  if (g.gamepad) g.gamepad.configure({ actions: { a: 'jump', b: 'grenade', x: 'fire', rt: 'fire' } });

  // ---------- Фон экранов движка и титул ----------
  var demo = N.Game({ players: 1, rng: L.mulberry32(7) }).start(), demoT = 0;
  function demoState() {
    var S = demo.state();
    S.cam.x = 1800 * (0.5 + 0.5 * Math.sin(demoT * 0.05 - 1.5)); S.time = demoT; S.banner = 0;
    S.heroes[0].alive = false; S.heroes[0].deadT = 0;
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, W = this.W, H = this.H;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    N.ui.world(this, ctx, demoState(), r, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.5)' : 'rgba(10,10,14,.5)'; ctx.fillRect(0, 0, W, H);
    var pw = 500, ph = Math.min(H - 70, Math.max(362, 220 + menu.items.length * 30)), px = (W - pw) / 2, py = 30;
    N.ui.panel(ctx, px, py, pw, ph, P, P.line);
    N.ui.txt(this, this.t('title'), W / 2, py + 64, { size: 58, align: 'center', color: P.accent, weight: 900 }, P);
    N.ui.txt(this, this.t('subtitle'), W / 2, py + 90, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    // герои отряда
    var two = g.input.playerCount === 2, hx = two ? [W / 2 - 40, W / 2 + 40] : [W / 2];
    hx.forEach(function (x, i) {
      var fake = { id: i, x: x, y: py + 146, face: i ? -1 : 1, aim: { x: i ? -1 : 1, y: 0 }, alive: true, onGround: true, vx: 0, crouch: false, weapon: 'rivet', armor: 1, gunT: 0, meleeT: 0, runT: 0, hh: 32, deadT: 0 };
      r.hero(ctx, fake, demoT, 2);
    });
    var mf = menuFit(menu, py + 190, 30, py + 176, py + ph - 34); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) N.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    this.menu._drawHint('title');
  };
  // Финалы и пауза — поверх мира
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') N.ui.world(this, this.ctx, game ? game.state() : demoState(), rnd(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8/2.9): таблица лидеров «nalyot», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «nalyot», GamePush — числовое поле игрока «nalyot» + лидерборд; товар no_ads
  // (постоянный). Список — promo/nalyot/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'nalyot';
  g.persist('arcade.best.nalyot', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): выбывшие возвращаются с 1 жизнью в кадр (неуязвимость 3 с); бонус в паузе — +1 жизнь И1
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы», «Автоприцел»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  // ---------- Карточка «миссия выполнена» (только когда площадка готова показать межстраничную): нажатие → реклама → следующая миссия ----------
  var cardM = 0, cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), r = rnd(), P = r.P;
      if (game) N.ui.world(this, ctx, game.state(), r, { bare: true }); else this.clear();
      ctx.fillStyle = 'rgba(8,8,12,.76)'; ctx.fillRect(0, 0, this.W, this.H);
      N.ui.txt(this, N.ui.up(P, this.t('cardDone')), this.W / 2, this.H / 2 - 34, { size: 30, align: 'center', color: th.accent, weight: 900, maxWidth: this.W - 40 }, P);
      N.ui.txt(this, this.t('cardMis') + ' ' + cardM + '/' + L.MISSIONS.length + (game ? ' · ' + this.t('score') + ': ' + game.state().score : ''), this.W / 2, this.H / 2 + 6, { size: 16, align: 'center', color: th.ink, weight: 700, maxWidth: this.W - 40 }, P);
      N.ui.txt(this, this.t('cardNext'), this.W / 2, this.H / 2 + 44, { size: 14, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 40 }, P);
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), on = pi < g.input.playerCount, dx = 0, dy = 0;
        if (on) { dx = (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0); dy = (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0); }
        if (pi === 0 && stick.active) { dx = Math.abs(stick.x) > 0.35 ? Math.sign(stick.x) : 0; dy = Math.abs(stick.y) > 0.55 ? Math.sign(stick.y) : 0; }
        var auto = pi === 0 && aimOn && touchMode(), hh = game.state().heroes[pi];
        game.setAuto(pi, auto); game.setDir(pi, dx, dy);
        game.setFire(pi, on && (P.pressed('fire') || (auto && hh && hh.autoT)));   // автоприцел (тач): есть цель — огонь
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) N.ui.render(this, ctx, game.state(), rnd(), { toasts: toasts, shake: shakeT > 0 ? (rnd().P.pixel ? 4 : 5) * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  g.start('title');
  N.app = { g: g, game: function () { return game; }, newGame: newGame };   // для отладки/автотестов в браузере (newGame({mission}))
})(typeof window !== 'undefined' ? window : globalThis);
