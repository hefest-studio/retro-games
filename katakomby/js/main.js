/* КАТАКОМБЫ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп 1–2 игрока — g.usePlayers (пункт «Игроки»,
   клавиши 1/2, подсказка, тач — только И1); свои пункты меню — выбор героя И1/И2. Титул — тёмный этаж
   с медленной панорамой под меню. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY, L = K.logic, Store = Arcade.Store;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#07060a', panel: '#15121b', ink: '#efe9f4', muted: '#9a90a8', accent: '#f0a64a', grid: '#2a2433' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffaa00', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.VIEW_W, height: L.SCREEN_H, gameId: 'katakomby', strings: K.STR, theme: 'modern', lives: 1, themes: themes });
  K.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  K.ui.init(g);
  function rnd() { return g.themeName === 'retro' ? K.classic : K.modern; }

  g.useStandardScreens({ lives: 1 });
  // Кооп за одной клавиатурой — движок (g.usePlayers + g.input.player(i)), как в redut/ и zvero-otryad/.
  g.usePlayers({
    bind: L.BIND,
    actions: ['bomb'], pad: pad, touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'fire' },
    hint: { ru: [K.STR.ru.hint1, K.STR.ru.hint2], en: [K.STR.en.hint1, K.STR.en.hint2] }
  });

  // ---------- Выбор героев (пункты меню; хранится в arcade.katakomby.hero1/2) ----------
  var CLS = ['smith', 'spark'];
  var heroes = [Store.get('arcade.katakomby.hero1', 'smith'), Store.get('arcade.katakomby.hero2', 'spark')].map(function (c, i) { return CLS.indexOf(c) >= 0 ? c : CLS[i]; });
  [0, 1].forEach(function (i) {
    g.menu.addItem({ key: 'hero' + (i + 1), after: i ? 'hero1' : 'players',
      label: function () { return g.t('hero' + (i + 1)) + ': ' + g.t('cls_' + heroes[i]) ; },
      onSelect: function () { heroes[i] = heroes[i] === 'smith' ? 'spark' : 'smith'; Store.set('arcade.katakomby.hero' + (i + 1), heroes[i]); g.audio.beep(700, 0.04); } });
  });

  // ---------- Игра ----------
  var game = null, toasts = [];
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2 }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!game || !d || d.x == null) return;
    var S = game.state(), P = rnd().P, sx = d.x - S.cam.x, sy = d.y - S.cam.y + L.HUD, sz = P.pixel ? 4 : 3;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: P.enemy[d.type], count: 8, speed: 80, life: 0.45, size: sz });
    else if (type === 'lairDie') g.particles.spawn(sx, sy, { color: '#c9b8ff', count: 24, speed: 140, life: 0.8, size: sz + 1 });
    else if (type === 'lairHit' || type === 'bossHit') g.particles.spawn(sx, sy, { color: '#ffd0a0', count: 4, speed: 60, life: 0.25, size: 2 });
    else if (type === 'bossDie') { g.particles.spawn(sx, sy, { color: '#ff5a8a', count: 50, speed: 220, life: 1.2, size: sz + 1 }); g.particles.spawn(sx, sy, { color: '#ffe6a0', count: 24, speed: 120, life: 0.9, size: sz }); }
    else if (type === 'hurt') g.particles.spawn(sx, sy, { color: P.bad, count: 3, speed: 50, life: 0.25, size: 2 });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: P.hero[d.pi], count: 20, speed: 110, life: 0.8, size: sz });
  }
  function onEvent(type, d) {
    K.sfx(g, type, d); fx(type, d);
    var P = rnd().P;
    if (type === 'key' || type === 'chest' || type === 'food' || type === 'potion') toast(g.t('pk_' + type), type === 'food' ? P.good : type === 'potion' ? '#9aa6ff' : '#ffd25a', d.x, d.y - 12);
    else if (type === 'door') toast(g.t('door'), '#ffd25a', d.x, d.y - 12);
    else if (type === 'bomb') toast(g.t('bomb'), '#ffffff', d.x, d.y - 22);
    sync();
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame() {
    game = K.Game({ players: g.input.playerCount, heroes: heroes.slice(), onEvent: onEvent });
    K.current = game; toasts = []; game.start(); sync();
  }
  [0, 1].forEach(function (pi) { g.input.player(pi).onPress(function (name) { if (game && name === 'bomb') game.bomb(pi); }); });
  // Тач-кнопка зелья (только И1)
  var bb = pad && pad.querySelector('[data-bomb]');
  if (bb) {
    var onBomb = function (e) { e.preventDefault(); if (g._sceneName === 'play' && game) game.bomb(0); };
    bb.addEventListener('touchstart', onBomb, { passive: false }); bb.addEventListener('mousedown', onBomb);
  }

  // ---------- Фон экранов движка и титул ----------
  var demo = K.Game({ players: 1, floor: 3, rng: L.mulberry32(7) }).start(), demoT = 0;
  function demoState() {
    var S = demo.state(), pw = S.W * L.T, ph = S.H * L.T;
    S.cam.x = (pw - L.VIEW_W) * (0.5 + 0.5 * Math.sin(demoT * 0.07));
    S.cam.y = Math.max(0, (ph - L.VIEW_H) * (0.5 + 0.5 * Math.sin(demoT * 0.05 + 1)));
    S.time = demoT;
    var h = S.heroes[0]; h.ghost = true; h.x = S.cam.x + L.VIEW_W / 2; h.y = S.cam.y + L.VIEW_H / 2;
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, W = this.W, H = this.H;
    ctx.fillStyle = P.void; ctx.fillRect(0, 0, W, H);
    K.ui.world(this, ctx, demoState(), r, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.55)' : 'rgba(7,6,10,.55)'; ctx.fillRect(0, 0, W, H);
    var pw = 460, ph = 400, px = (W - pw) / 2, py = 54;
    K.ui.panel(ctx, px, py, pw, ph, P, P.line);
    K.ui.txt(this, this.t('title'), W / 2, py + 62, { size: 54, align: 'center', color: P.accent, weight: 900 }, P);
    K.ui.txt(this, this.t('subtitle'), W / 2, py + 88, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    var two = g.input.playerCount === 2;
    if (!two) { ctx.font = '700 11px ' + (P.font || th.font); var tw = ctx.measureText(this.t('clsd_' + heroes[0])).width; }
    var hx = two ? W / 2 - 150 : W / 2 - (tw + 18) / 2;
    r.heroBody(ctx, heroes[0], hx, py + 112, 1, 0, P.hero[0], 1);
    K.ui.txt(this, this.t('clsd_' + heroes[0]), hx + 18, py + 117, { size: 11, color: P.hero[0], weight: 700 }, P);
    if (two) {
      r.heroBody(ctx, heroes[1], W / 2 + 150, py + 112, -1, 0, P.hero[1], 1);
      K.ui.txt(this, this.t('clsd_' + heroes[1]), W / 2 + 132, py + 117, { size: 11, align: 'right', color: P.hero[1], weight: 700 }, P);
    }
    menu.draw(this, W / 2, py + 160, 30);
    if (this.state.best) K.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    this.menu._drawHint('title');
  };
  // Финалы и пауза — поверх тёмного этажа
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') K.ui.world(this, this.ctx, game ? game.state() : demoState(), rnd(), { bare: true });
  };

  // P/Esc на паузе — продолжить (кроме пунктов меню паузы)
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), dx = 0, dy = 0;
        if (pi < g.input.playerCount) { dx = (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0); dy = (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0); }
        game.setDir(pi, dx, dy); game.setFire(pi, pi < g.input.playerCount && P.pressed('fire'));
      }
      game.update(Math.min(dt, 0.05));
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) K.ui.render(this, ctx, game.state(), rnd(), { toasts: toasts }); else this.clear(); }
  });

  g.start('title');
  K.app = { g: g, game: function () { return game; }, heroes: heroes };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
