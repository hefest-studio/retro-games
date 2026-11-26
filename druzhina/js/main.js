/* ДРУЖИНА · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + общий рендер (render.js,
   палитры modern.js / classic.js) + интерфейс (ui.js) + звук. Сцены title/pause/win/gameover — g.useStandardScreens;
   кооп 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2, подсказка, тач — только И1).
   В сцене play сначала выбор героя (в коопе — разные), затем бой; при выбывании всех — «Продолжить?».
   Тач (волна 6, площадки): виртуальный стик (js/stick.js) — ход вдоль и вглубь, дважды в сторону — бег; ● удар (если враги
   и спереди, и сзади — «спина»: удар по обе стороны), ⤒ прыжок, ✦ магия. Геймпад — движком: A — удар, B — прыжок, X — магия, Y — «спина». */
(function (global) {
  'use strict';
  var D = global.DRUZHINA, L = D.logic, Store = Arcade.Store;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#101216', panel: '#171a20', ink: '#f3eee4', muted: '#9ea3ad', accent: '#f0a03c', grid: '#2a2e36' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#1a1c2c', accent: '#ffcd75', muted: '#94b0c2' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.VIEW_W, height: L.SCREEN_H, gameId: 'druzhina', leaderboard: 'druzhina', strings: D.STR, theme: 'modern', lives: 3, themes: themes });
  D.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  D.ui.init(g);
  function pal() { return g.themeName === 'retro' ? D.classic : D.modern; }

  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND, actions: ['attack', 'jump', 'magic', 'back'], pad: pad,
    touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'attack' },
    hint: ['ru', 'en', 'tr', 'es', 'pt'].reduce(function (o, l) { o[l] = [D.STR[l].hint1, D.STR[l].hint2]; return o; }, {})
  });

  // ---------- Игра ----------
  var game = null, toasts = [], shakeT = 0, sel = null;
  function sync() { if (game) g.state.score = game.state().score; }
  function toast(text, color, x, z) { toasts.push({ text: text, color: color, x: x, z: z, t: 1.3 }); if (toasts.length > 8) toasts.shift(); }
  function fx(type, d) {
    if (!game || !d || d.x == null) return;
    var S = game.state(), sx = d.x - S.cam, sy = L.FLOOR_TOP + (d.z || 0) - (d.h || 0), P = pal(), sz = P.pixel ? 6 : 3;
    if (type === 'hit') g.particles.spawn(sx, sy, { color: d.knee ? '#ffe0a0' : '#fff2c0', count: 6, speed: 150, life: 0.25, size: sz });
    else if (type === 'block') g.particles.spawn(sx, sy, { color: '#a8d0ff', count: 6, speed: 120, life: 0.2, size: sz });
    else if (type === 'kill') g.particles.spawn(sx, sy - 40, { color: d.boss ? '#ff7a3a' : '#c8ccd4', count: d.boss ? 50 : 12, speed: d.boss ? 240 : 130, life: d.boss ? 1.2 : 0.5, size: sz });
    else if (type === 'thud') g.particles.spawn(sx, sy, { color: '#b89a70', count: d.big ? 14 : 6, speed: 90, life: 0.35, size: sz });
    else if (type === 'pickup') g.particles.spawn(sx, sy - 10, { color: d.kind === 'jug' ? '#6aaaff' : '#ffd080', count: 10, speed: 90, life: 0.5, size: sz });
    else if (type === 'drop') g.particles.spawn(sx, sy - 30, { color: '#ffe080', count: 6, speed: 80, life: 0.3, size: sz });
    else if (type === 'respawn') g.particles.spawn(sx, sy - 40, { color: '#fff0c0', count: 20, speed: 160, life: 0.5, size: sz });
  }
  function onEvent(type, d) {
    D.sfx(g, type, d); fx(type, d);
    var P = pal(), S = game && game.state();
    if (type === 'pickup') toast(g.t(d.kind), d.kind === 'jug' ? P.magic : P.good, d.x, d.z);
    else if (type === 'mount' && S) { var h = S.heroes[d.pi]; toast(g.t('mount'), P.accent, h.x, h.z); }
    else if (type === 'noMagic' && S) { var h2 = S.heroes[d.pi]; toast(g.t('noMagic'), P.muted, h2.x, h2.z); }
    else if (type === 'extraLife' && S) toast(g.t('extraLife'), P.good, S.cam + 480, 60);
    if (type === 'thud' && d.big || type === 'bossAct' && d.move === 'slam') shakeT = Math.max(shakeT, 0.25);
    if (type === 'spell') shakeT = Math.max(shakeT, 0.4);
    if (type === 'bossDie') shakeT = 1.0;
    sync();
    if (type === 'stage' && d.stage > 1 && g._sceneName === 'play' && g.adReady()) { cardSt = d.stage - 1; g.goto('card'); }   // межстраничная — по нажатию на карточке этапа (Яндекс 4.4)
    if (type === 'win') { sync(); g.win(); }
    else if (type === 'gameover') { sync(); g.gameover(); }
  }
  function newGame(heroes, o) {
    game = D.Game(Object.assign({ players: heroes.length, heroes: heroes, onEvent: onEvent }, o || {}));
    D.current = game; toasts = []; shakeT = 0; game.start(); sync();
  }

  // ---------- Выбор героя ----------
  function startSelect() {
    var n = g.input.playerCount, saved = (Store.get('druzhina.heroes', '0,1') || '0,1').split(',').map(Number);
    sel = { n: n, cur: [saved[0] || 0, saved[1] == null ? 1 : saved[1]], ready: [false, false], prev: [0, 0] };
    if (n === 2 && sel.cur[0] === sel.cur[1]) sel.cur[1] = (sel.cur[0] + 1) % 3;
    game = null;
  }
  function selMove(p, d) {
    if (sel.ready[p]) return;
    var c = sel.cur[p];
    for (var k = 0; k < 3; k++) { c = (c + d + 3) % 3; if (!(sel.n === 2 && sel.ready[1 - p] && sel.cur[1 - p] === c)) break; }
    sel.cur[p] = c; g.audio.beep(600, 0.03);
  }
  function selConfirm(p) {
    if (p >= sel.n) return;
    if (sel.ready[p]) { sel.ready[p] = false; return; }
    if (sel.n === 2 && sel.ready[1 - p] && sel.cur[1 - p] === sel.cur[p]) { g.audio.beep(160, 0.06); return; }
    sel.ready[p] = true; g.audio.beep(880, 0.06);
    if (sel.n === 2 && !sel.ready[1 - p] && sel.cur[1 - p] === sel.cur[p]) selMove(1 - p, 1);
    if (sel.ready.slice(0, sel.n).every(Boolean)) {
      var hs = sel.cur.slice(0, sel.n).map(function (i) { return L.HERO_KEYS[i]; });
      Store.set('druzhina.heroes', sel.cur.join(','));
      sel = null; newGame(hs);
    }
  }

  // ---------- Действия игроков ----------
  [0, 1].forEach(function (pi) {
    g.input.player(pi).onPress(function (name) {
      if (sel) { if (name === 'attack' || name === 'jump') selConfirm(pi); return; }
      if (!game) return;
      var S = game.state();
      if (S.phase === 'continue') { if (name === 'attack') game.continue_(); return; }
      if (name === 'attack' && pi === 0 && touchMode() && game.surrounded(0)) game.special(0);   // тач: окружили — «спина»
      else if (name === 'attack') game.attack(pi); else if (name === 'jump') game.jump(pi);
      else if (name === 'magic') game.magic(pi); else if (name === 'back') game.special(pi);
    });
  });
  function tbtn(selr, fn) {
    var b = pad && pad.querySelector(selr); if (!b) return;
    var on = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') fn(); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
  }
  tbtn('[data-jump]', function () { if (sel) selConfirm(0); else if (game) game.jump(0); });
  tbtn('[data-magic]', function () { if (game && !sel) game.magic(0); });
  tbtn('[data-back]', function () { if (game && !sel) game.special(0); });

  // ---------- Тач (волна 6): стик; геймпад ----------
  function touchMode() { return g.input.device === 'touch' || g.input.touchOnly; }
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'), {
    onFlick: function (dx) { if (sel && dx && g._sceneName === 'play') selMove(0, dx); }   // выбор героя — рывком стика
  });
  if (g.gamepad) g.gamepad.configure({ actions: { a: 'attack', b: 'jump', x: 'magic', y: 'back' } });
  g.canvas.addEventListener('pointerdown', function (e) {   // тап по полю: «Продолжить?» и выбор героя
    if (g._sceneName !== 'play' || e.pointerType === 'mouse') return;
    if (game && game.state().phase === 'continue') { e.preventDefault(); game.continue_(); }
  });

  // ---------- Титул и фон экранов движка ----------
  var demo = D.Game({ players: 2, heroes: ['zhdan', 'olha'], rng: L.mulberry32(7) }).start(), demoT = 0;
  function demoState() {
    var S = demo.state(); S.time = demoT; S.banner = 0;
    S.cam = 600 * (0.5 + 0.5 * Math.sin(demoT * 0.06 - 1.5));
    S.heroes.forEach(function (h) { h.state = 'out'; h.out = true; });
    S.foes = []; S.mounts = []; S.items = []; S.spells = []; S.projs = [];
    return S;
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += Math.min(dt, 0.05); };
  title.draw = function (ctx) {
    var th = this.th(), P = pal(), W = this.W, H = this.H;
    D.ui.drawWorld(this, ctx, demoState(), P, {});
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.45)' : 'rgba(10,10,14,.45)'; ctx.fillRect(0, 0, W, H);
    var pw = 520, ph = Math.min(H - 50, Math.max(392, 290 + menu.items.length * 30)), px = (W - pw) / 2, py = 26;
    D.ui.panel(ctx, px, py, pw, ph, P, P.line);
    D.ui.txt(this, this.t('title'), W / 2, py + 66, { size: 60, align: 'center', color: P.accent, weight: 900 }, P);
    D.ui.txt(this, this.t('subtitle'), W / 2, py + 92, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    // дружина
    var two = g.input.playerCount === 2;
    var row = two ? ['zhdan', 'secha', 'olha'] : ['zhdan', 'secha', 'olha'];
    row.forEach(function (k, i) { D.render.portrait(ctx, P, k, W / 2 + (i - 1) * 70, py + 196, 0.9, demoT + i * 1.3, Math.floor(demoT * 0.7 + i) % 3 === 0 ? 'over' : 'idle'); });
    var mf = menuFit(menu, py + 236, 30, py + 226, py + ph - 34); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) D.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    this.menu._drawHint('title');
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') D.ui.drawWorld(this, this.ctx, game ? game.state() : demoState(), pal(), {});
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8/2.9): таблица лидеров «druzhina», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «druzhina», GamePush — числовое поле игрока «druzhina» + лидерборд; товар no_ads
  // (постоянный). Список — promo/druzhina/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'druzhina';
  g.persist('arcade.best.druzhina', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию, после своих продолжений): дружина встаёт с 1 жизнью; бонус в паузе — +1 жизнь И1
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  // ---------- Карточка «этап пройден» (только когда площадка готова показать межстраничную): нажатие → реклама → следующий этап ----------
  var cardSt = 0, cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), P = pal();
      if (game) D.ui.drawWorld(this, ctx, game.state(), P, {}); else this.clear();
      ctx.fillStyle = 'rgba(10,10,14,.76)'; ctx.fillRect(0, 0, this.W, this.H);
      D.ui.txt(this, this.t('cardDone'), this.W / 2, this.H / 2 - 34, { size: 30, align: 'center', color: th.accent, weight: 900, maxWidth: this.W - 40 }, P);
      D.ui.txt(this, this.t('level') + ' ' + cardSt + '/' + (game ? game.state().maxStage : 6) + (game ? ' · ' + this.t('score') + ': ' + game.state().score : ''), this.W / 2, this.H / 2 + 6, { size: 16, align: 'center', color: th.ink, weight: 700, maxWidth: this.W - 40 }, P);
      D.ui.txt(this, this.t('cardNext'), this.W / 2, this.H / 2 + 44, { size: 14, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 40 }, P);
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || (!game && !sel)) startSelect(); },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (a === 'start' && game && game.state().phase === 'continue') game.continue_();
      if (a === 'start' && sel) selConfirm(0);
    },
    update: function (dt) {
      if (sel) {
        for (var p = 0; p < sel.n; p++) {
          var dx = g.input.player(p).dir.x;
          if (dx && dx !== sel.prev[p]) selMove(p, dx);
          sel.prev[p] = dx;
        }
        demoT += dt; return;
      }
      if (!game) return;
      for (var pi = 0; pi < 2; pi++) {
        var P = g.input.player(pi), on = pi < g.input.playerCount, dir = on ? P.dir : { x: 0, y: 0 }, dx = dir.x, dy = dir.y;
        if (pi === 0 && stick.active) { dx = Math.abs(stick.x) > 0.35 ? Math.sign(stick.x) : 0; dy = Math.abs(stick.y) > 0.35 ? Math.sign(stick.y) : 0; }
        game.setDir(pi, dx, dy);
      }
      game.update(Math.min(dt, 0.05));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) {
      var P = pal();
      if (sel) { D.ui.drawWorld(this, ctx, demoState(), P, {}); D.ui.select(this, ctx, sel, P, demoT); return; }
      if (game) D.ui.render(this, ctx, game.state(), P, { toasts: toasts, shake: shakeT > 0 ? 6 * Math.min(1, shakeT * 3) : 0 });
      else this.clear();
    }
  });

  g.start('title');
  D.app = { g: g, game: function () { return game; }, newGame: newGame, sel: function () { return sel; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
