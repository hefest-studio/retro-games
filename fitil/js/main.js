/* ФИТИЛЬ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп за одной клавиатурой — g.usePlayers
   (пункт «Игроки: 1/2», клавиши 1/2, подсказка раскладок, тач — только И1); свой пункт меню
   «Огонь по своим» — g.menu.addItem. Титул переопределён: поле первого уровня на фоне + меню движка. */
(function (global) {
  'use strict';
  var F = global.FITIL, L = F.logic, T = F.ui.T, OY = F.ui.OY;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#10131b', panel: '#161b26', ink: '#eef2f8', muted: '#97a1b4', accent: '#ff8a3d', grid: '#232a38' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffaa00', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.COLS * T, H = OY + L.ROWS * T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'fitil', leaderboard: 'fitil', strings: F.STR, theme: 'modern', lives: 3, themes: themes });
  F.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  function rnd() { return g.themeName === 'retro' ? F.classic : F.modern; }
  var game = null, toasts = [];
  // «Огонь по своим» (только кооп): по умолчанию выключен, выбор хранится
  var FF_KEY = 'arcade.ff.fitil', ff = Arcade.Store.get(FF_KEY, '0') === '1';

  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.level = s.level; g.state.lives = s.players[0].lives; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.9 && Math.abs(toasts[i].y - y) < 16 && Math.abs(toasts[i].x - x) < 80) y -= 18;
    toasts.push({ text: text, color: color, x: Math.max(70, Math.min(W - 70, x)), y: y, t: 1.4 });
  }
  function sx(c) { return c * T + T / 2; }
  function sy(r) { return OY + r * T + T / 2; }

  function fx(type, d) {
    var R = rnd(), P = R.P, sz = P.pixel ? 4 : 3;
    if (type === 'boom') g.particles.spawn(sx(d.x), sy(d.y), { color: P.pixel ? '#ffff55' : '#ffb02e', count: 10, speed: 120, life: 0.45, size: sz });
    else if (type === 'crate') g.particles.spawn(sx(d.x), sy(d.y), { color: P.pixel ? '#ffaa55' : '#c07a38', count: 6, speed: 70, life: 0.4, size: sz });
    else if (type === 'kill') g.particles.spawn(sx(d.x), sy(d.y), { color: P.en[d.type] || P.accent, count: 14, speed: 110, life: 0.6, size: sz });
    else if (type === 'die') g.particles.spawn(sx(d.x), sy(d.y), { color: P.pl[d.player], count: 22, speed: 140, life: 0.8, size: sz });
    else if (type === 'bossHit') g.particles.spawn(sx(d.x), sy(d.y), { color: '#ff5a3a', count: 16, speed: 130, life: 0.6, size: sz });
    else if (type === 'bossDie') { g.particles.spawn(sx(d.x), sy(d.y), { color: '#aaaaaa', count: 50, speed: 220, life: 1.2, size: sz + 1 }); g.particles.spawn(sx(d.x), sy(d.y), { color: '#ff5a3a', count: 24, speed: 140, life: 0.9, size: sz }); }
    else if (type === 'power') g.particles.spawn(sx(d.x), sy(d.y), { color: P.pw[d.kind], count: 10, speed: 80, life: 0.5, size: sz });
  }

  function onEvent(type, d) {
    F.sfx(g, type, d); fx(type, d);
    var P = rnd().P;
    if (type === 'power') toast(g.t('pw_' + d.kind), P.pw[d.kind], sx(d.x), sy(d.y) - 16);
    else if (type === 'kill') toast('+' + d.score, P.en[d.type] || P.ink, sx(d.x), sy(d.y) - 12);
    else if (type === 'open') toast(g.t('open'), P.good, sx(d.x), sy(d.y) - 16);
    else if (type === 'life') toast(g.t('life'), P.good, W / 2, OY + 40);
    else if (type === 'die' && d.lives <= 0) toast(g.t(d.player ? 'p2' : 'p1') + ' · ' + g.t('down'), P.bad, sx(d.x), sy(d.y) - 16);
    else if (type === 'level') toasts = [];
    sync();
    if (type === 'level' && d.level > 1 && g._sceneName === 'play' && g.adReady()) { cardLv = d.level - 1; g.goto('card'); }   // межстраничная — по нажатию на карточке уровня (Яндекс 4.4)
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }

  function newGame() {
    g.resetRun();
    game = F.Game({ players: g.input.playerCount, lives: 3, level: 1, friendlyFire: ff, difficulty: diff, onEvent: onEvent });
    game.start(); F.current = game; toasts = []; sync();
  }

  // ---------- Стандартные экраны, кооп, свой пункт меню ----------
  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND,
    actions: ['bomb', 'det'], repeat: [], pad: pad, touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'bomb' },
    hint: { ru: [F.STR.ru.hint1, F.STR.ru.hint2], en: [F.STR.en.hint1, F.STR.en.hint2], tr: [F.STR.tr.hint1, F.STR.tr.hint2], es: [F.STR.es.hint1, F.STR.es.hint2], pt: [F.STR.pt.hint1, F.STR.pt.hint2] }
  });
  g.menu.addItem({ key: 'ff', after: 'players',
    label: function () { return g.t('ff') + ': ' + (ff ? g.t('on') : g.t('off')); },
    onSelect: function () { ff = !ff; Arcade.Store.set(FF_KEY, ff ? '1' : '0'); if (game) game.setFF(ff); g.audio.beep(700, 0.04); } });
  [0, 1].forEach(function (pi) {
    g.input.player(pi).onPress(function (name) {
      if (!game) return;
      if (name === 'bomb') game.bomb(pi); else if (name === 'det') game.detonate(pi);
    });
  });
  F.ui.init(g, function () { if (game && g._sceneName === 'play') game.detonate(0); });

  // ---------- Площадка (движок v2.8/2.9): таблица лидеров «fitil», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «fitil», GamePush — числовое поле игрока «fitil» + лидерборд; товар no_ads
  // (постоянный). Список — promo/fitil/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'fitil';
  g.persist('arcade.best.fitil', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): по 1 жизни, старт уровня с неуязвимостью; бонус в паузе — +1 жизнь
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }
  // ---------- Карточка «люк пройден» (только когда площадка готова показать межстраничную): нажатие → реклама → дальше ----------
  var cardLv = 0, cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), P = rnd().P;
      if (game) rnd().draw(ctx, game.state(), this, { toasts: [] }); else this.clear();
      ctx.fillStyle = 'rgba(8,10,16,.74)'; ctx.fillRect(0, 0, this.W, this.H);
      F.ui.txt(this, this.t('clear'), this.W / 2, this.H / 2 - 30, { size: 30, align: 'center', color: th.accent, weight: 900, maxWidth: this.W - 40 }, P);
      F.ui.txt(this, this.t('ready') + ' ' + cardLv + '/' + L.LEVELS.length + (game ? ' · ' + this.t('score') + ': ' + game.state().score : ''), this.W / 2, this.H / 2 + 8, { size: 16, align: 'center', color: th.ink, weight: 700, maxWidth: this.W - 40 }, P);
      F.ui.txt(this, this.t('cardNext'), this.W / 2, this.H / 2 + 46, { size: 14, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 40 }, P);
    }
  });
  g.canvas.addEventListener('mousedown', function () { if (g._sceneName === 'card') cardGo(); });
  g.canvas.addEventListener('touchstart', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } }, { passive: false });

  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this); };

  // ---------- Титул: поле на фоне + меню движка ----------
  var demo = F.Game({ rng: (function () { var s = 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(), players: 2 }).start();
  var menu = g.scenes.title._menu, title = g.scenes.title;
  title.update = function (dt) { demo.state().time += dt; };
  title.draw = function (ctx) {
    var th = this.th(), R = rnd(), P = R.P, retro = P.pixel, Wc = this.W, Hc = this.H;
    R.draw(ctx, demo.state(), this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.78)' : 'rgba(10,12,18,.76)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 400, ph = 352, px = (Wc - pw) / 2, py = 56;
    F.ui.panel(ctx, px, py, pw, ph, P, retro ? P.line : null);
    F.ui.txt(this, this.t('title'), Wc / 2, py + 62, { size: 48, align: 'center', color: P.accent, weight: 900, maxWidth: pw - 30 }, P);
    // шнур с искрой под заголовком
    var fy = py + 80, t = this.time;
    ctx.fillStyle = retro ? '#aa5500' : '#c8b48a';
    for (var i = 0; i < 40; i++) ctx.fillRect(Wc / 2 - 100 + i * 5, fy + Math.round(Math.sin(i * 0.6) * 2), 4, 2);
    var spk = (t * 60) % 200;
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(Wc / 2 - 100 + spk - 3, fy - 3, 7, 7);
    F.ui.txt(this, this.t('subtitle'), Wc / 2, py + 108, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 20 }, P);
    var mf = menuFit(menu, py + 146, 30, py + 128, py + ph - 30); menu.draw(this, Wc / 2, mf[0], mf[1]);
    if (this.state.best) F.ui.txt(this, this.t('best') + ': ' + this.state.best, Wc / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    this.menu._drawHint('title');
  };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var S = game.state();
      for (var pi = 0; pi < S.players.length; pi++) { var dir = g.input.player(pi).dir; game.setDir(pi, dir.x, dir.y); }
      game.update(Math.min(dt, 0.05));
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) rnd().draw(ctx, game.state(), this, { toasts: toasts }); else this.clear(); }
  });

  g.start('title');
  F.app = { g: g, game: function () { return game; }, ff: function () { return ff; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
