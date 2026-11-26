/* ПУЗЫРЬ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Переделка 2026-11: главная механика — пузырь на трубке: держи кнопку — раздуваешь, отпускаешь — хлопок, волна воздуха
   сдувает врагов кувырком; в ванне с расплавом (проём в полу) враг переплавляется.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп за одной клавиатурой — g.usePlayers
   (пункт «Игроки: 1/2», клавиши 1/2 на заставке, подсказка раскладок, тач — только И1).
   Второй игрок входит «на лету»: клавиша 2 (или Num 2) прямо в игре. Титул: живой уровень на фоне + меню движка.
   Геймпад (движок): стик/крестовина — бег, A — прыжок, B — пузырь (держать). Площадка: лидеры «puzyr», «Без рекламы»,
   «ещё один шанс» и +1 жизнь за рекламу, межстраничная — карточкой между уровнями (только если площадка готова её показать). */
(function (global) {
  'use strict';
  var Z = global.PUZYR, L = Z.logic, T = Z.ui.T, OY = Z.ui.OY;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120f19', panel: '#1a1524', ink: '#f4efe8', muted: '#a59cb4', accent: '#ffb347', grid: '#2a2236' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.COLS * T, H = OY + L.ROWS * T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'puzyr', leaderboard: 'puzyr', strings: Z.STR, theme: 'modern', lives: 3, themes: themes });
  Z.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  function rnd() { return g.themeName === 'retro' ? Z.classic : Z.modern; }
  var game = null, toasts = [], tut = { blasted: false, melted: false }, playSince = 0;

  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.level = Math.min(30, s.level); g.state.lives = Math.max(0, s.players[0].lives); }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 1.0 && Math.abs(toasts[i].y - y) < 14 && Math.abs(toasts[i].x - x) < 60) y -= 16;
    toasts.push({ text: text, color: color, x: Math.max(60, Math.min(W - 60, x)), y: Math.max(OY + 16, y), t: 1.4, big: !!big });
  }
  function px(x) { return x * T; }
  function py(y) { return OY + y * T; }

  function fx(type, d) {
    var P = rnd().P, sz = P.pixel ? 4 : 3;
    if (type === 'melt') { g.particles.spawn(px(d.x), py(d.y), { color: '#ffb347', count: 22, speed: 150, life: 0.7, size: sz }); g.particles.spawn(px(d.x), py(d.y), { color: '#ffe14d', count: 10, speed: 90, life: 0.5, size: sz }); }
    else if (type === 'blast') g.particles.spawn(px(d.x), py(d.y), { color: P.pixel ? '#55ffff' : '#d7f7ff', count: 8 + Math.round((d.power || 0) * 8), speed: 90, life: 0.35, size: sz - 1 });
    else if (type === 'bonk' || type === 'thud' || type === 'knock' || type === 'bop') g.particles.spawn(px(d.x), py(d.y), { color: P.en[d.type] || '#ffffff', count: 6, speed: 70, life: 0.3, size: sz - 1 });
    else if (type === 'zap') g.particles.spawn(px(d.x), py(d.y), { color: P.en[d.type] || P.accent, count: 12, speed: 100, life: 0.5, size: sz });
    else if (type === 'die') g.particles.spawn(px(d.x), py(d.y), { color: P.pl[d.player], count: 22, speed: 140, life: 0.8, size: sz });
    else if (type === 'reflect' || type === 'douse') g.particles.spawn(px(d.x), py(d.y), { color: '#cfefff', count: 6, speed: 60, life: 0.3, size: sz });
    else if (type === 'bossHit') g.particles.spawn(px(d.x), py(d.y), { color: '#ff6a3d', count: 14, speed: 120, life: 0.5, size: sz });
    else if (type === 'bossDie') { g.particles.spawn(px(d.x), py(d.y), { color: '#ffd34d', count: 50, speed: 220, life: 1.2, size: sz + 1 }); g.particles.spawn(px(d.x), py(d.y), { color: '#ff7a1f', count: 30, speed: 160, life: 1, size: sz }); }
  }

  function onEvent(type, d) {
    d = d || {};
    Z.sfx(g, type, d); fx(type, d);
    var P = rnd().P;
    if (type === 'melt') { tut.melted = true; toast('+' + d.score + (d.combo > 1 ? ' ×' + Math.min(5, d.combo) : ''), d.combo > 1 ? P.melt : P.accent, px(d.x), py(d.y) - 30, d.combo > 1); }
    else if (type === 'blast') tut.blasted = true;
    else if (type === 'knock') toast(g.t('knock') + ' +' + d.score, P.ink, px(d.x), py(d.y) - 14);
    else if (type === 'bossHit') toast('-1', P.bad, px(d.x), py(d.y) - 10);
    else if (type === 'bossFall') toast(g.t('bossFall'), P.melt, W / 2, OY + 70, true);
    else if (type === 'life') toast(g.t('life'), P.good, W / 2, OY + 40, true);
    else if (type === 'join') toast(g.t('p' + (d.player + 1)) + ' · ' + g.t('join'), P.pl[d.player], px(L.SPAWNS[d.player].x), py(L.SPAWNS[d.player].y) - 50, true);
    else if (type === 'die' && d.lives <= 0) toast(g.t(d.player ? 'p2' : 'p1') + ' · ' + g.t('out'), P.bad, px(d.x), py(d.y) - 16);
    else if (type === 'bossDie') toast('+' + d.score, P.letter, px(d.x), py(d.y) - 30, true);
    else if (type === 'level') toasts = [];
    else if (type === 'rest') setTimeout(function () { maybeCard(d.level); }, 0);
    sync();
    if (type === 'win') setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 500);
    else if (type === 'gameover') { g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play' && game && game.state().over) g.gameover(); }, 900); }
  }

  function newGame() {
    game = Z.Game({ players: g.input.playerCount, lives: 3, level: 1, difficulty: diff, onEvent: onEvent,
      waitAfter: function () { return g._sceneName === 'play' && !!(g.adReady && g.adReady()); } });
    game.start(); Z.current = game; toasts = []; tut = { blasted: false, melted: false }; sync();
  }

  // ---------- Стандартные экраны, кооп, геймпад ----------
  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND,
    actions: ['jump', 'blow'], repeat: [], pad: pad, touch: { L: 'left', R: 'right', U: 'jump', A: 'blow' },
    hint: { ru: [Z.STR.ru.hint1, Z.STR.ru.hint2], en: [Z.STR.en.hint1, Z.STR.en.hint2], tr: [Z.STR.tr.hint1, Z.STR.tr.hint2], es: [Z.STR.es.hint1, Z.STR.es.hint2], pt: [Z.STR.pt.hint1, Z.STR.pt.hint2] }
  });
  if (g.gamepad && g.gamepad.configure) g.gamepad.configure({ actions: { a: 'jump', b: 'blow' } });
  // Второй игрок входит прямо в игре: клавиша 2 — «старт второго игрока»
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play' || !game || e.repeat) return;
    if (e.code !== 'Digit2' && e.code !== 'Numpad2') return;
    if (g.input.touchOnly) return;
    if (game.join(1)) { if (g.input.playerCount !== 2) g.players.set(2); }
  });
  Z.ui.init(g);

  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this); };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Площадка (движок v2.8–2.10): таблица «puzyr», «Без рекламы», реклама за награду ----------
  // Консоль: Яндекс — лидерборд «puzyr», GamePush — числовое поле игрока «puzyr» + лидерборд; товар no_ads (постоянный).
  // Список — promo/puzyr/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'puzyr';
  g.persist('arcade.best.puzyr', 'max');   // рекорд — и в облако (ключ прежний: рекорды игроков сайта сохраняются)
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });
  // «Ещё один шанс» (раз за партию): все игроки возвращаются с 3 жизнями, уровень продолжается; бонус в паузе — +1 жизнь каждому
  g.useRewardedContinue({ revive: function () { if (game) { game.revive(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // Меню вмещает пункты площадки: если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- Карточка «уровень пройден» (только когда площадка готова показать межстраничную) ----------
  var cardLv = 0, cardGoing = false;
  function maybeCard(lv) {
    if (!game) return;
    if (g._sceneName === 'play' && g.adReady && g.adReady()) { cardLv = lv; g.goto('card'); }
    else game.proceed();
  }
  function cardGo() {
    if (cardGoing || g._sceneName !== 'card') return; cardGoing = true;
    g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') { if (game) game.proceed(); playSince = g.time; g.goto('play', { resume: true }); } });
  }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') { if (game) game.proceed(); this.goto('play', { resume: true }); } },
    draw: function (ctx) {
      var th = this.th(), r = rnd(), P = r.P;
      if (game) r.draw(ctx, game.state(), this, { bare: true }); else this.clear();
      ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.78)' : 'rgba(14,10,20,.78)'; ctx.fillRect(0, 0, this.W, this.H);
      Z.ui.txt(this, Z.ui.up(P, this.t('cardDone')), this.W / 2, this.H / 2 - 30, { size: 26, align: 'center', color: th.accent, weight: 900, maxWidth: this.W - 30 }, P);
      Z.ui.txt(this, this.t('level') + ' ' + cardLv + '/30' + (game ? ' · ' + this.t('score') + ': ' + game.state().score : ''), this.W / 2, this.H / 2 + 4, { size: 14, align: 'center', color: th.ink, weight: 700, maxWidth: this.W - 30 }, P);
      Z.ui.txt(this, this.t('cardNext'), this.W / 2, this.H / 2 + 36, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 30 }, P);
    }
  });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- Титул: живой уровень на фоне (враги ходят, Колба хлопает) + меню движка ----------
  var demo = null, DS = null, demoT = 0, demoLv = [6, 12, 3, 18, 9, 24], demoK = 0;
  function makeDemo() {
    demo = Z.Game({ rng: L.mulberry32(7 + demoK), players: 2, level: demoLv[demoK++ % demoLv.length], maxLevel: 99 }).start(); DS = demo.state();
    DS.phase = 'play'; DS.enemies.forEach(function (e) { e.spawnT = 0; }); demoT = 0;
  }
  makeDemo();
  function demoStep(dt) {
    demoT += dt;
    DS.players.forEach(function (p, i) {
      p.inv = 99; var tgt = null, bd = 1e9;
      DS.enemies.forEach(function (e) { var d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 3; if (Math.abs(e.y - p.y) < 1.2 && d < bd) { bd = d; tgt = e; } });
      var dir = tgt && Math.abs(tgt.x - p.x) > 3 ? Math.sign(tgt.x - p.x) : 0;
      var blow = !!tgt && Math.abs(tgt.x - p.x) <= 4 && (Math.floor(demoT * 1.4 + i) % 3 !== 0);
      demo.setInput(i, dir, false, blow);
    });
    demo.update(Math.min(dt, 1 / 30));
    if (DS.phase !== 'play' || DS.enemies.length < 2 || demoT > 40) makeDemo();
  }
  var menu = g.scenes.title._menu, title = g.scenes.title;
  title.update = function (dt) { demoStep(dt); };
  title.draw = function (ctx) {
    var th = this.th(), R = rnd(), P = R.P, retro = P.pixel, Wc = this.W, Hc = this.H;
    R.draw(ctx, DS, this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.72)' : 'rgba(14,10,20,.66)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 460, ph = 380, px0 = (Wc - pw) / 2, py0 = 44;
    Z.ui.panel(ctx, px0, py0, pw, ph, P, retro ? P.line : null);
    // заголовок из стеклянных шаров
    var word = this.t('title'), n = word.length, sp = Math.min(retro ? 46 : 50, (pw - 60) / n), rad = Math.min(22, sp * 0.45), x0 = Wc / 2 - (n - 1) * sp / 2, ty = py0 + 52;
    for (var i = 0; i < n; i++) {
      var bx = x0 + i * sp, by = ty + Math.sin(this.time * 2.2 + i * 0.8) * 4;
      if (retro) { var q = Math.round(rad); ctx.fillStyle = '#000044'; ctx.fillRect(bx - q, by - q, q * 2, q * 2); ctx.fillStyle = '#55ffff'; ctx.fillRect(bx - q, by - q, q * 2, 3); ctx.fillRect(bx - q, by + q - 3, q * 2, 3); ctx.fillRect(bx - q, by - q, 3, q * 2); ctx.fillRect(bx + q - 3, by - q, 3, q * 2); }
      else Z.modern.glassBall(ctx, bx, by, rad, i % 2 ? 'rgba(143,240,255,.85)' : 'rgba(255,209,102,.85)', this.time * 0.5 + i, null);
      Z.ui.txt(this, word[i], bx, by + rad * 0.45, { size: Math.round(rad * 1.25), align: 'center', color: i % 2 ? (retro ? '#55ffff' : '#8ff0ff') : P.accent, weight: 900 }, P);
    }
    Z.ui.txt(this, this.t('subtitle'), Wc / 2, py0 + 98, { size: 11, align: 'center', color: th.ink, weight: 600, maxWidth: pw - 24 }, P);
    Z.ui.txt(this, this.t('sub2'), Wc / 2, py0 + 116, { size: 11, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 }, P);
    // герои по бокам: Колба раздувает пузырь
    var ch = (this.time * 0.8) % 1.3;
    if (retro) { Z.classic.face(ctx, px0 + 36, py0 + 170, 0, 1.4); Z.classic.face(ctx, px0 + pw - 36, py0 + 170, 1, 1.4); }
    else { Z.modern.hero(ctx, px0 + 34, py0 + 200, 0, 1, { t: this.time, ground: true, charge: Math.min(1, ch) }); Z.modern.hero(ctx, px0 + pw - 34, py0 + 200, 1, -1, { t: this.time, ground: true }); }
    var mf = menuFit(menu, py0 + 150, 28, py0 + 138, py0 + ph - 34);
    menu.draw(this, Wc / 2, mf[0], mf[1]);
    if (this.state.best) Z.ui.txt(this, this.t('best') + ': ' + this.state.best, Wc / 2, py0 + ph - 12, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    this.menu._drawHint('title');
  };

  // ---------- Обучение 1-го уровня: подсказки рисунком у героя и над ванной ----------
  function touchMode() { return g.input.device === 'touch' || g.input.touchOnly; }
  function tutor(ctx, S) {
    if (S.level !== 1 || S.phase !== 'play') return;
    var p = S.players[0]; if (!p || !p.alive) return;
    var P = rnd().P, blink = Math.floor(g.time * 3) % 2, sz = P.pixel ? 10 : 12;
    var key = touchMode() ? '◯' : (g.padActive && g.padActive() ? (g.prompt ? g.prompt('b') : 'B') : (Z.ui.up(P, 'Space')));
    if (!tut.blasted) {
      var msg = p.charging ? g.t('tipRelease') : key + ' · ' + g.t('tipHold');
      Z.ui.txt(g, Z.ui.up(P, msg), Math.max(90, Math.min(W - 90, px(p.x))), py(p.y) - 46, { size: sz, align: 'center', color: blink ? P.accent : P.ink, weight: 900 }, P);
    } else if (!tut.melted && S.vats.length) {
      var v = S.vats[0], vx = px(v.x), vy = py(L.ROWS - 1) - 8;
      ctx.fillStyle = blink ? P.melt : P.accent;
      ctx.beginPath(); ctx.moveTo(vx - 9, vy - 18); ctx.lineTo(vx + 9, vy - 18); ctx.lineTo(vx, vy - 4); ctx.closePath(); ctx.fill();
      Z.ui.txt(g, Z.ui.up(P, g.t('tipVat')), vx, vy - 26, { size: sz, align: 'center', color: P.melt, weight: 900 }, P);
    }
  }

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60, held = [true, true];
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; held = [true, true]; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var S = game.state(), n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var pi = 0; pi < S.players.length; pi++) {
        var I = g.input.player(pi), b = I.pressed('blow');
        if (!b) held[pi] = false;   // клавиша старта/«Продолжить» (пробел) не раздувает пузырь, пока её не отпустят
        game.setInput(pi, I.dir.x, I.pressed('jump'), b && !held[pi]);
        var p = S.players[pi];
        if (p && p.charging) Z.sfx(g, 'inflate', { k: Math.min(1, p.charge / L.CHARGE_MAX) });
      }
      if (S.phase !== 'rest') for (var k = 0; k < n; k++) game.update(STEP);
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      rnd().draw(ctx, game.state(), this, { toasts: toasts });
      tutor(ctx, game.state());
    }
  });

  g.start('title');
  Z.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
