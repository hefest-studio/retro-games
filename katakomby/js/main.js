/* КАТАКОМБЫ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Переделка 2026-11 «Огненный обруч»: одна кнопка — бросить / вернуть бронзовый обруч (рикошетит, режет тварей);
   у огня он загорается и зажигает холодные чаши; горят все — печать спуска открыта.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2,
   подсказка, тач — только И1). Тач (площадки): виртуальный стик (js/stick.js) + ● — обруч, II — пауза; на тач-экране
   автоприцел броска шире. Геймпад — движком по раскладке usePlayers: стик/крестовина — ход, A — обруч. */
(function (global) {
  'use strict';
  var K = global.KATAKOMBY, L = K.logic;
  var TH = Arcade.themes || {};
  // Прежние правила (логова, ключи, еда, два класса героев) давали другие очки: рекорд уходит в «прежний рекорд», выбор героев стирается
  var LS = null; try { LS = global.localStorage; } catch (e) {}
  var migratedOld = K.migrate(LS), oldBest = 0;
  try { oldBest = parseInt((LS && LS.getItem('arcade.katakomby.oldBest')) || '0', 10) || 0; } catch (e) {}
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#060807', panel: '#121715', ink: '#eef2ec', muted: '#93a199', accent: '#ff9a3c', grid: '#26302c' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffaa00', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.VIEW_W, height: L.SCREEN_H, gameId: 'katakomby', leaderboard: 'katakomby', strings: K.STR, theme: 'modern', lives: 1, themes: themes });
  K.g = g;
  var pad = document.querySelector('.pad');
  K.ui.init(g);
  function rnd() { return g.themeName === 'retro' ? K.classic : K.modern; }

  g.useStandardScreens({ lives: 1 });
  // Кооп за одной клавиатурой — движок (g.usePlayers + g.input.player(i))
  g.usePlayers({
    bind: L.BIND, actions: ['fire'], pad: pad,
    touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'fire' },
    hint: ['ru', 'en', 'tr', 'es', 'pt'].reduce(function (o, l) { o[l] = [K.STR[l].hint1, K.STR[l].hint2]; return o; }, {})
  });
  g.input.bindDpad(pad);

  // ---------- Игра ----------
  var game = null, toasts = [];
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, y, big, screen) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2, big: big, screen: screen }); if (toasts.length > 8) toasts.shift(); }
  function touchMode() { return g.input.device === 'touch' || g.input.touchOnly; }
  function fx(type, d) {
    if (!game || !d || d.x == null) return;
    var S = game.state(), P = rnd().P, sx = d.x - S.cam.x, sy = d.y - S.cam.y + L.HUD, sz = P.pixel ? 4 : 3;
    if (type === 'kill') g.particles.spawn(sx, sy, { color: d.src === 'light' ? P.fire : P.enemy[d.type], count: 8, speed: 80, life: 0.45, size: sz });
    else if (type === 'light') g.particles.spawn(sx, sy - 6, { color: P.fire, count: 22, speed: 120, life: 0.7, size: sz });
    else if (type === 'snuff') g.particles.spawn(sx, sy - 6, { color: '#aab4b0', count: 14, speed: 60, life: 0.8, size: sz });
    else if (type === 'ignite') g.particles.spawn(sx, sy - 4, { color: P.fireHot, count: 8, speed: 70, life: 0.4, size: 2 });
    else if (type === 'gate') g.particles.spawn(sx, sy, { color: '#9aa4ae', count: 16, speed: 90, life: 0.6, size: sz });
    else if (type === 'chest') g.particles.spawn(sx, sy, { color: '#e8c070', count: 14, speed: 100, life: 0.5, size: sz });
    else if (type === 'bossHit') g.particles.spawn(sx, sy, { color: P.fire, count: 12, speed: 120, life: 0.4, size: sz });
    else if (type === 'bossDie') { g.particles.spawn(sx, sy, { color: '#c8d0dc', count: 50, speed: 220, life: 1.2, size: sz + 1 }); g.particles.spawn(sx, sy, { color: P.fire, count: 24, speed: 120, life: 0.9, size: sz }); }
    else if (type === 'hurt') g.particles.spawn(sx, sy, { color: P.bad, count: 3, speed: 50, life: 0.25, size: 2 });
    else if (type === 'heroDie') g.particles.spawn(sx, sy, { color: P.hero[d.pi], count: 20, speed: 110, life: 0.8, size: sz });
    else if (type === 'gust') g.particles.spawn(sx, sy, { color: '#c8d0dc', count: 30, speed: 260, life: 0.6, size: sz });
  }
  function onEvent(type, d) {
    K.sfx(g, type, d); fx(type, d);
    var P = rnd().P;
    if (type === 'light') toast(g.t('t_light'), P.fire, d.x, d.y - 22);
    else if (type === 'snuff') toast(g.t('t_snuff'), P.muted, d.x, d.y - 22);
    else if (type === 'gate') toast(g.t('t_gate'), P.ink, d.x, d.y - 14);
    else if (type === 'seal') toast(g.t('t_seal'), P.good, L.VIEW_W / 2, L.HUD + 90, true, true);
    else if (type === 'chest') toast(g.t('t_chest'), '#e8c070', d.x, d.y - 12);
    else if (type === 'kill' && d.mult > 1) toast('×' + d.mult + ' ' + g.t('t_mult'), P.fireHot, d.x, d.y - 14);
    sync();
    if (type === 'upgradeOpen' && g._sceneName === 'play' && g.adReady && g.adReady()) g.goto('card');   // межстраничная — по нажатию на карточке
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame() {
    game = K.Game({ players: g.input.playerCount, onEvent: onEvent, wideAim: touchMode() });
    K.current = game; toasts = []; game.start(); sync(); migratedOld = 0;
  }

  // ---------- Фон экранов движка и титул: этаж с горящими чашами, медленная панорама ----------
  var demo = K.Game({ players: 1, floor: 3, rng: L.mulberry32(7), noTutorial: true }).start(), demoT = 0;
  demo.state().lamps.forEach(function (l, i) { if (i % 2 === 0) l.lit = true; });
  demo.state().banner = 0;
  function demoState() {
    var S = demo.state(), pw = S.W * L.T, ph = S.H * L.T;
    S.cam.x = (pw - L.VIEW_W) * (0.5 + 0.5 * Math.sin(demoT * 0.07));
    S.cam.y = Math.max(0, (ph - L.VIEW_H) * (0.5 + 0.5 * Math.sin(demoT * 0.05 + 1)));
    S.time = demoT;
    var h = S.heroes[0]; h.ghost = true; h.x = S.cam.x + L.VIEW_W / 2; h.y = S.cam.y + L.VIEW_H / 2;
    S.ghostLight = { x: h.x, y: h.y };
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, W = this.W, H = this.H;
    ctx.fillStyle = P.void; ctx.fillRect(0, 0, W, H);
    K.ui.world(this, ctx, demoState(), r, { bare: true });
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.5)' : 'rgba(5,7,6,.5)'; ctx.fillRect(0, 0, W, H);
    var pw = 460, ph = Math.min(H - 60, Math.max(330, 210 + menu.items.length * 30)), px = (W - pw) / 2, py = 40;
    K.ui.panel(ctx, px, py, pw, ph, P, P.line);
    K.ui.txt(this, this.t('title'), W / 2, py + 62, { size: 54, align: 'center', color: P.accent, weight: 900, maxWidth: pw - 40 }, P);
    K.ui.txt(this, this.t('subtitle'), W / 2, py + 88, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 30 }, P);
    // обходчица с обручем, который то горит, то остывает
    var hot = Math.floor(this.time / 1.6) % 2 === 0;
    r.heroBody(ctx, W / 2 - 22, py + 116, 1, 0, P.hero[0], 1.2);
    r.hoopRing(ctx, W / 2 + 4, py + 118, this.time * 3, hot, 1.3);
    r.lamp(ctx, { x: W / 2 + 40, y: py + 120, lit: hot, hearth: false, tx: 3, ty: 1, flash: 0 }, this.time);
    var mf = menuFit(menu, py + 170, 30, py + 150, py + ph - 40);
    menu.draw(this, W / 2, mf[0], mf[1]);
    var foot = this.state.best ? this.t('best') + ': ' + this.state.best : '';
    if (oldBest) foot += (foot ? ' · ' : '') + this.t('oldBest') + ': ' + oldBest;
    if (foot) K.ui.txt(this, foot, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 30 }, P);
    if (migratedOld) K.ui.txt(this, this.t('migrated'), W / 2, py + ph + 22, { size: 12, align: 'center', color: P.warn, weight: 700, maxWidth: W - 40 }, P);
    this.menu._drawHint('title');
  };
  // Финалы и пауза — поверх тёмного этажа
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover' || this._sceneName === 'continue') K.ui.world(this, this.ctx, game ? game.state() : demoState(), rnd(), { bare: true });
  };
  // P/Esc на паузе — продолжить (кроме пунктов меню паузы)
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8–2.10): таблица лидеров «katakomby», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «katakomby», GamePush — числовое поле игрока «katakomby» + лидерборд; товар no_ads
  // (постоянный). Список — promo/katakomby/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'katakomby';
  g.persist('arcade.best.katakomby', 'max');   // рекорд — и в облако
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): на том же месте с 60% здоровья, ближние твари рассеяны; бонус в паузе — полное здоровье и горящий обруч
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwHeal', scene: 'pause', label: function () { return g.t('rwHeal'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- Карточка «этаж пройден» (только когда площадка готова показать межстраничную): нажатие → реклама → выбор навыка ----------
  var cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), r = rnd(), P = r.P;
      if (game) K.ui.world(this, ctx, game.state(), r, { bare: true }); else this.clear();
      ctx.fillStyle = 'rgba(4,6,5,.78)'; ctx.fillRect(0, 0, this.W, this.H);
      K.ui.txt(this, K.ui.up(P, this.t('cardClear')), this.W / 2, this.H / 2 - 34, { size: 30, align: 'center', color: th.accent, weight: 900, maxWidth: this.W - 40 }, P);
      var S = game && game.state();
      K.ui.txt(this, this.t('floor') + ' ' + (S ? S.floor + '/' + S.maxFloor + ' · ' + this.t('score') + ': ' + S.score : ''), this.W / 2, this.H / 2 + 6, { size: 16, align: 'center', color: th.ink, weight: 700, maxWidth: this.W - 40 }, P);
      K.ui.txt(this, this.t('cardNext'), this.W / 2, this.H / 2 + 44, { size: 14, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 40 }, P);
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- Тач: стик (И1) ----------
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'));

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      game.setWideAim(touchMode());
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), dx = 0, dy = 0, on = pi < g.input.playerCount;
        if (on) { dx = (P.pressed('right') ? 1 : 0) - (P.pressed('left') ? 1 : 0); dy = (P.pressed('down') ? 1 : 0) - (P.pressed('up') ? 1 : 0); }
        if (pi === 0 && stick.active) { dx = stick.x; dy = stick.y; }
        game.setDir(pi, dx, dy); game.setFire(pi, on && P.pressed('fire'));
      }
      game.update(Math.min(dt, 0.05));
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) K.ui.render(this, ctx, game.state(), rnd(), { toasts: toasts }); else this.clear(); }
  });

  g.start('title');
  K.app = { g: g, game: function () { return game; }, demo: demo };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
