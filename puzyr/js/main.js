/* ПУЗЫРЬ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп за одной клавиатурой — g.usePlayers
   (пункт «Игроки: 1/2», клавиши 1/2 на заставке, подсказка раскладок, тач — только И1).
   Второй игрок входит «на лету»: клавиша 2 (или Num 2) прямо в игре. Титул переопределён: уровень на фоне + меню движка. */
(function (global) {
  'use strict';
  var Z = global.PUZYR, L = Z.logic, T = Z.ui.T, OY = Z.ui.OY;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120f19', panel: '#1a1524', ink: '#f4efe8', muted: '#a59cb4', accent: '#ffb347', grid: '#2a2236' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.COLS * T, H = OY + L.ROWS * T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'puzyr', strings: Z.STR, theme: 'modern', lives: 3, themes: themes });
  Z.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  function rnd() { return g.themeName === 'retro' ? Z.classic : Z.modern; }
  var game = null, toasts = [];

  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.level = s.level; g.state.lives = s.players[0].lives; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 1.0 && Math.abs(toasts[i].y - y) < 14 && Math.abs(toasts[i].x - x) < 60) y -= 16;
    toasts.push({ text: text, color: color, x: Math.max(60, Math.min(W - 60, x)), y: Math.max(OY + 16, y), t: 1.4, big: !!big });
  }
  function px(x) { return x * T; }
  function py(y) { return OY + y * T; }

  function fx(type, d) {
    var R = rnd(), P = R.P, sz = P.pixel ? 4 : 3;
    if (type === 'pop' || type === 'burst') g.particles.spawn(px(d.x), py(d.y), { color: P.pixel ? '#55ffff' : '#cfefff', count: type === 'pop' ? 14 : 6, speed: 110, life: 0.45, size: sz });
    else if (type === 'zap') g.particles.spawn(px(d.x), py(d.y), { color: P.en[d.type] || P.accent, count: 12, speed: 100, life: 0.5, size: sz });
    else if (type === 'die') g.particles.spawn(px(d.x), py(d.y), { color: P.pl[d.player], count: 22, speed: 140, life: 0.8, size: sz });
    else if (type === 'item') g.particles.spawn(px(d.x), py(d.y), { color: P.letter, count: 8, speed: 70, life: 0.4, size: sz });
    else if (type === 'special') g.particles.spawn(px(d.x), py(d.y), { color: P.sp[d.kind], count: 18, speed: 130, life: 0.6, size: sz });
    else if (type === 'bossHit') g.particles.spawn(px(d.x), py(d.y), { color: '#ff6a3d', count: 14, speed: 120, life: 0.5, size: sz });
    else if (type === 'bossDie') { g.particles.spawn(px(d.x), py(d.y), { color: '#ffd34d', count: 50, speed: 220, life: 1.2, size: sz + 1 }); g.particles.spawn(px(d.x), py(d.y), { color: '#cfefff', count: 30, speed: 160, life: 1, size: sz }); }
    else if (type === 'escape') g.particles.spawn(px(d.x), py(d.y), { color: P.bad, count: 10, speed: 90, life: 0.5, size: sz });
    else if (type === 'douse') g.particles.spawn(px(d.x), py(d.y), { color: '#cfefff', count: 6, speed: 60, life: 0.3, size: sz });
  }

  function onEvent(type, d) {
    Z.sfx(g, type, d); fx(type, d);
    var P = rnd().P;
    if (type === 'pop') toast('+' + d.score, d.n ? P.letter : P.ink, px(d.x), py(d.y) - 12, d.n > 0);
    else if (type === 'zap') toast(g.t('en_' + d.type), P.bad, px(d.x), py(d.y) - 22);
    else if (type === 'item') toast('+' + d.score, P.good, px(d.x), py(d.y) - 10);
    else if (type === 'letter') toast(g.t('word')[d.letter], P.letter, px(d.x), py(d.y) - 10, true);
    else if (type === 'word') toast(g.t('wordDone'), P.letter, W / 2, OY + 60, true);
    else if (type === 'special') toast(g.t('sp_' + d.kind), P.sp[d.kind], px(d.x), py(d.y) - 22, true);
    else if (type === 'life') toast(g.t('life'), P.good, W / 2, OY + 40, true);
    else if (type === 'join') toast(g.t('p' + (d.player + 1)) + ' · ' + g.t('join'), P.pl[d.player], px(L.SPAWNS[d.player].x), py(L.SPAWNS[d.player].y) - 50, true);
    else if (type === 'die' && d.lives <= 0) toast(g.t(d.player ? 'p2' : 'p1') + ' · ' + g.t('out'), P.bad, px(d.x), py(d.y) - 16);
    else if (type === 'hurry') toast(g.t('hurry'), P.bad, W / 2, OY + 120, true);
    else if (type === 'bossDie') toast('+50000', P.letter, px(d.x), py(d.y) - 30, true);
    else if (type === 'level') toasts = [];
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }

  function newGame() {
    game = Z.Game({ players: g.input.playerCount, lives: 3, level: 1, difficulty: diff, onEvent: onEvent });
    game.start(); Z.current = game; toasts = []; sync();
  }

  // ---------- Стандартные экраны, кооп ----------
  g.useStandardScreens({ lives: 3 });
  g.usePlayers({
    bind: L.BIND,
    actions: ['blow'], repeat: [], pad: pad, touch: { L: 'left', R: 'right', U: 'jump', A: 'blow' },
    hint: { ru: [Z.STR.ru.hint1, Z.STR.ru.hint2], en: [Z.STR.en.hint1, Z.STR.en.hint2] }
  });
  [0, 1].forEach(function (pi) {
    g.input.player(pi).onPress(function (name) { if (game && name === 'blow') game.blow(pi); });
  });
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

  // ---------- Титул: уровень на фоне + меню движка ----------
  var demo = Z.Game({ rng: L.mulberry32(7), players: 2 }).start(), DS = demo.state();
  [[6, 6, 'cog'], [9.5, 4.2, null], [22, 5, 'spring'], [25.5, 8, 'letter'], [12, 15, 'fire'], [20, 13, 'soot'], [27, 17, null], [4.5, 12, 'bolt']].forEach(function (b, i) {
    var o = demo._mkBubble({ x: b[0], y: b[1], kind: b[2] === 'letter' || b[2] === 'fire' || b[2] === 'bolt' ? b[2] : 'plain', letter: 0 });
    if (b[2] && !o.kind.match(/letter|fire|bolt/)) { o.enemy = { type: b[2], angry: false }; o.trapT = 9; }
    o.t = i; o.life = 1e9; o.baseY = b[1];
  });
  DS.enemies.forEach(function (e) { e.spawnT = 0; });
  var menu = g.scenes.title._menu, title = g.scenes.title;
  title.update = function (dt) {
    DS.time += dt; DS.phase = 'ready';
    DS.bubbles.forEach(function (b) { b.t += dt; b.y = b.baseY + Math.sin(DS.time * 1.3 + b.id) * 0.35; });
    DS.players.forEach(function (p) { p.walk = 0; p.ground = true; });
  };
  title.draw = function (ctx) {
    var th = this.th(), R = rnd(), P = R.P, retro = P.pixel, Wc = this.W, Hc = this.H;
    R.draw(ctx, DS, this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.72)' : 'rgba(14,10,20,.66)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 440, ph = 330, px0 = (Wc - pw) / 2, py0 = 50;
    Z.ui.panel(ctx, px0, py0, pw, ph, P, retro ? P.line : null);
    // заголовок из «шаров»
    var word = this.t('title'), n = word.length, sp = retro ? 46 : 50, x0 = Wc / 2 - (n - 1) * sp / 2, ty = py0 + 58;
    for (var i = 0; i < n; i++) {
      var bx = x0 + i * sp, by = ty + Math.sin(this.time * 2.2 + i * 0.8) * 4;
      if (retro) { ctx.fillStyle = '#000044'; ctx.fillRect(bx - 21, by - 21, 42, 42); ctx.fillStyle = '#55ffff'; ctx.fillRect(bx - 21, by - 21, 42, 3); ctx.fillRect(bx - 21, by + 18, 42, 3); ctx.fillRect(bx - 21, by - 21, 3, 42); ctx.fillRect(bx + 18, by - 21, 3, 42); }
      else Z.modern.glassBall(ctx, bx, by, 22, i % 2 ? 'rgba(143,240,255,.85)' : 'rgba(255,209,102,.85)', this.time * 0.5 + i, null);
      Z.ui.txt(this, word[i], bx, by + 10, { size: 28, align: 'center', color: i % 2 ? (retro ? '#55ffff' : '#8ff0ff') : P.accent, weight: 900 }, P);
    }
    Z.ui.txt(this, this.t('subtitle'), Wc / 2, py0 + 112, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
    // герои по бокам
    if (retro) { Z.classic.face(ctx, px0 + 36, py0 + 160, 0, 1.4); Z.classic.face(ctx, px0 + pw - 36, py0 + 160, 1, 1.4); }
    else { Z.modern.hero(ctx, px0 + 40, py0 + 190, 0, 1, { t: this.time, ground: true }); Z.modern.hero(ctx, px0 + pw - 40, py0 + 190, 1, -1, { t: this.time, ground: true }); }
    menu.draw(this, Wc / 2, py0 + 150, 30);
    if (this.state.best) Z.ui.txt(this, this.t('best') + ': ' + this.state.best, Wc / 2, py0 + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    this.menu._drawHint('title');
  };

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var S = game.state(), n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var pi = 0; pi < S.players.length; pi++) {
        var I = g.input.player(pi);
        game.setInput(pi, I.dir.x, I.pressed('jump'));
      }
      for (var k = 0; k < n; k++) game.update(STEP);
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) rnd().draw(ctx, game.state(), this, { toasts: toasts }); else this.clear(); }
  });

  g.start('title');
  Z.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
