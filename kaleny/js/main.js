/* КАЛЁНЫЙ ДВОР · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендер обеих тем (render.js) + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул: ИИ играет матч на фоне + меню движка; карточка между матчами (card) —
   отсюда межстраничная реклама. Турнир: 7 матчей, 2 попытки на переигровку. Быстрый матч: серия побед. Кооп 1–2 игрока — g.usePlayers.
   Ввод: стрелки/WASD/геймпад (движок), тач — плавающий стик + ● бросок/пас (держи — накал) + ◆ ловля/уклон. */
(function (global) {
  'use strict';
  var KL = global.KALENY, R = KL.render, LG = KL.logic, GEO = LG.GEO;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#14161c', panel: '#1f232c', ink: '#f1ece2', muted: '#98a0ac', accent: '#ee8a3a', grid: '#3a4150' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffaa00', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: GEO.W, height: GEO.H, gameId: 'kaleny', leaderboard: 'kaleny', strings: KL.STR, theme: 'modern', lives: 2, themes: themes });
  KL.g = g; KL.ui.init(g);
  var pad = document.getElementById('pad');
  var MATCHES = 7, RETRIES = 2;

  var game = null, toasts = [], fx = [], tour = { match: 0, score: 0, retries: RETRIES }, mode = 'tour', quick = { streak: 0, level: 1 }, last = null, endT = -1, needNew = false, playSince = 0, tutT = 0, tickN = -1;
  var TUT_KEY = 'arcade.kaleny.tut', STREAK_KEY = 'arcade.kaleny.streak';
  g.persist(TUT_KEY, 'max'); g.persist(STREAK_KEY, 'max'); g.persist('arcade.best.kaleny', 'max');
  function tutSeen() { return Arcade.Store.getNum(TUT_KEY, 0) > 0; }
  function P() { return R.pal(g, game ? game.state().level : 0); }
  function nPlayers() { return g.players ? g.players.count() : 1; }
  function humans() { return nPlayers() === 2 ? [0, 2] : [1]; }

  // ---------- стандартные экраны, кооп, площадка ----------
  g.useStandardScreens({ lives: RETRIES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.usePlayers({
    bind: { p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], throw: ['Space', 'Slash', 'KeyZ'], catch: ['KeyX', 'Period', 'KeyC'] },
            p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], throw: ['KeyF'], catch: ['KeyG'] } },
    actions: ['throw', 'catch'], pad: pad,
    hint: ['ru', 'en', 'tr', 'es', 'pt'].reduce(function (o, l) { o[l] = [KL.STR[l].hint1, KL.STR[l].hint2]; return o; }, {})
  });
  var LB = 'kaleny';
  function lbSubmit(score) { if (score > 0) g.leaderboard.submit(score | 0, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: 'kaleny', label: function () { return g.t('lbAll'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbSubmit(g.state.best); });   // облако слито: рекорд с другого устройства — в таблицу
  g.useOwnGames(); g.useShortcut(); g.useReview({ minSessions: 3, gap: 3 });
  // «ещё матч»: после проигранного турнира — переиграть тот же матч (раз за турнир); бонус в паузе — выбывший подмастерье возвращается
  g.useRewardedContinue({ revive: function () { tour.retries = 0; needNew = true; } });
  g.useRewardedBonus({ key: 'rwBack', scene: 'pause', label: function () { return g.t('rwBonus'); }, available: function () { return !!game && game.canReinforce(); }, grant: function () { if (game) game.reinforce(); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- матч ----------
  function toast(text, color, x, y, size) { toasts.push({ text: text, color: color, x: Math.max(60, Math.min(GEO.W - 60, x)), y: y, t: 1.2, size: size }); if (toasts.length > 7) toasts.shift(); }
  function burst(x, y, color, n, sp) { var s = R.toScreen(g, x, y); g.particles.spawn(s.x, s.y, { color: color, count: n, speed: sp || 120, life: 0.55, size: P().pixel ? 4 : 3 }); }
  function ring(x, y, color) { fx.push({ x: x, y: y, r: 22, color: color, t: 0.4, life: 0.4 }); }
  function mine(d) { return d.team === 0; }
  function onEvent(type, d) {
    KL.sfx(g, type, d); var pal = P();
    if (type === 'catch') { toast(g.t(d.perfect ? 'perfect' : 'catch'), d.perfect ? pal.warn : pal.good, d.x, d.y - 30, d.perfect ? 24 : 18); ring(d.x, d.y, d.perfect ? '#fff2b8' : pal.good); burst(d.x, d.y, R.heatColor(pal, d.heat), d.perfect ? 26 : 12, 140); if (mine(d)) g.storeSet(TUT_KEY, '1'); }
    else if (type === 'hit') { toast(g.t('out'), mine(d) ? pal.bad : pal.good, d.x, d.y - 26, 18); burst(d.x, d.y, pal.team[d.team], 20, 150); if (mine(d)) g.rumble({ ms: 160, strong: 0.6, weak: 0.3 }); }
    else if (type === 'wound') { toast(d.team === 0 ? '−1' : '+1', mine(d) ? pal.bad : pal.good, d.x, d.y - 26, 16); burst(d.x, d.y, pal.team[d.team], 10, 110); if (mine(d)) g.rumble({ ms: 120, strong: 0.4, weak: 0.2 }); }
    else if (type === 'dodge') toast(g.t('dodge'), pal.muted, d.x, d.y - 26, 13);
    else if (type === 'burn') { toast(g.t('burn'), pal.bad, d.x, d.y - 26, 18); burst(d.x, d.y, '#ff8c1a', 14, 100); }
    else if (type === 'revive') { toast(g.t('revive'), pal.good, d.x, d.y - 26, 18); ring(d.x, d.y, pal.good); }
    else if (type === 'time') toast(g.t('timeUp'), pal.warn, GEO.W / 2, 380, 28);
    else if (type === 'wall' || type === 'plate') burst(d.x, d.y, pal.plate, 3, 50);
    else if (type === 'steam') burst(d.x, d.y, pal.steam, 6, 40);
    else if (type === 'end') endT = 0;
  }
  function level() { return mode === 'tour' ? Math.min(MATCHES - 1, tour.match) : quick.level; }
  function newMatch() {
    toasts = []; fx = []; endT = -1; last = null; needNew = false; tickN = -1;
    game = KL.Game({ level: level(), humans: humans(), rng: Math.random, onEvent: onEvent }).start(); KL.current = game;
    game.state(); toast(g.t('go'), P().accent, GEO.W / 2, 400, 30); sync();
  }
  function sync() { if (!game) return; g.state.lives = tour.retries; g.state.level = level() + 1; if (mode === 'tour') g.state.score = tour.score; }
  function startRun(m) {
    mode = m; g.resetRun();
    if (m === 'tour') { tour = { match: 0, score: 0, retries: RETRIES }; g.state.score = 0; g.state.lives = RETRIES; } else { quick.streak = 0; quick.level = 1; g.state.score = 0; }
    game = null; g.goto('play');
  }
  { var tm = g.menu.get('title'); tm.items[tm.indexOf('play')].onSelect = function () { startRun('tour'); };
    g.menu.addItem({ key: 'quick', scene: 'title', after: 'play', label: function () { return g.t('quick') + (quick.best ? ' · ' + quick.best : ''); }, onSelect: function () { startRun('quick'); } }); }

  function matchOver() {   // игровая сцена → итог матча
    var S = game.state(), res = S.result; last = { result: res, points: S.points, match: level() + 1, left: Math.round(S.left), alive: game.counts()[0], perfect: S.stats[0].perfect };
    if (mode === 'tour') {
      if (res === 'win') {
        tour.score += S.points; g.state.score = tour.score;
        if (tour.match >= MATCHES - 1) { lbSubmit(tour.score); g.win(); return; }
        tour.match++;
      } else if (res === 'lose') {
        if (tour.retries <= 0) { lbSubmit(tour.score); g.state.lives = 0; g.gameover(); return; }
        tour.retries--; g.state.lives = tour.retries;
      }
    } else {
      if (res === 'win') { quick.streak++; quick.level = Math.min(6, 1 + quick.streak); g.storeSet(STREAK_KEY, String(Math.max(Arcade.Store.getNum(STREAK_KEY, 0), quick.streak))); }
      else if (res === 'lose') { quick.streak = 0; quick.level = 1; }
    }
    g.goto('card');
  }
  var cardGoing = false;
  function cardGo() {
    if (cardGoing || g._sceneName !== 'card') return; cardGoing = true;
    var pr = last && last.result === 'win' ? g.adBreak() : Promise.resolve(false);
    pr.then(function () { cardGoing = false; if (g._sceneName === 'card') { needNew = true; g.goto('play'); } });
  }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('title'); },
    update: function () { },
    draw: function (ctx) {
      var th = this.th(), pal = P(), W = this.W, H = this.H, L = R.land(this), cx = W / 2, y0 = L ? 70 : 170;
      if (game) R.bare(ctx, game.state(), this); else this.clear();
      ctx.fillStyle = 'rgba(6,8,14,.8)'; ctx.fillRect(0, 0, W, H);
      var res = last ? last.result : 'win', col = res === 'win' ? pal.good : res === 'lose' ? pal.bad : pal.warn;
      this.text(this.t(res === 'win' ? 'matchWin' : res === 'lose' ? 'matchLose' : 'matchDraw'), cx, y0, { size: L ? 34 : 34, align: 'center', color: col, weight: 900, maxWidth: W - 40 });
      if (last && res === 'win') { this.text(this.t('points') + ': +' + last.points, cx, y0 + 40, { size: 18, align: 'center', color: th.ink, weight: 800, maxWidth: W - 40 }); }
      if (mode === 'tour') {
        this.text(this.t('total') + ': ' + tour.score, cx, y0 + 70, { size: 16, align: 'center', color: th.muted, weight: 700, maxWidth: W - 40 });
        if (res !== 'win') this.text(this.t('retry') + ': ' + tour.retries, cx, y0 + 96, { size: 16, align: 'center', color: th.muted, weight: 700, maxWidth: W - 40 });
      } else this.text(this.t('streak') + ': ' + quick.streak + (Arcade.Store.getNum(STREAK_KEY, 0) ? '  ·  ' + this.t('best') + ': ' + Arcade.Store.getNum(STREAK_KEY, 0) : ''), cx, y0 + 70, { size: 16, align: 'center', color: th.muted, weight: 700, maxWidth: W - 40 });
      var nl = level(), nxt = (mode === 'tour' ? this.t('match') + ' ' + (nl + 1) + ' / ' + MATCHES + ' · ' : '') + this.t('rival' + (nl % 7));
      this.text(nxt, cx, y0 + 150, { size: 17, align: 'center', color: pal.accent, weight: 800, maxWidth: W - 40 });
      this.text(this.t('arena_' + LG.ARENAS[nl % LG.ARENAS.length].id), cx, y0 + 178, { size: 14, align: 'center', color: th.muted, weight: 700, maxWidth: W - 40 });
      this.text(this.t(res === 'win' ? 'nextUp' : 'tryAgain'), cx, y0 + 226, { size: 15, align: 'center', color: th.ink, weight: 700, maxWidth: W - 40 });
    }
  });
  var cv0 = g.canvas;
  cv0.addEventListener('pointerdown', function (e) { if (g._sceneName === 'card') { e.preventDefault(); cardGo(); } });

  // ---------- титул: ИИ играет матч на фоне ----------
  var demo = null, demoSeed = 5;
  function makeDemo() { var s = demoSeed++; demo = KL.Game({ seed: s, level: 1 + (s % 4), humans: [] }).start(); }
  makeDemo();
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demo.update(Math.min(dt, 1 / 30)); var S = demo.state(); if (S.phase !== 'play' || S.time > 70) makeDemo(); };
  title.draw = function (ctx) {
    var th = this.th(), pal = R.pal(this, demo.state().level), W = this.W, H = this.H, L = R.land(this);
    R.bare(ctx, demo.state(), this);
    ctx.fillStyle = pal.pixel ? 'rgba(0,0,0,.74)' : 'rgba(8,10,14,.7)'; ctx.fillRect(0, 0, W, H);
    var pw = Math.min(400, W - 30), ph = Math.min(L ? H - 24 : 560, H - 40), px = (W - pw) / 2, py = (H - ph) / 2 - (L ? 0 : 20);
    if (pal.pixel) { ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = pal.line; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = th.panel; R.rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#3a4656'; ctx.lineWidth = 1; R.rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke(); }
    this.text(this.t('title'), W / 2, py + (L ? 42 : 62), { size: L ? 34 : 38, align: 'center', color: pal.accent, weight: 900, maxWidth: pw - 30 });
    var bx = W / 2, by = py + (L ? 70 : 100); R.disc(ctx, bx - 20, by, 9, R.heatColor(pal, 0.5 + 0.5 * Math.sin(this.time * 3)), pal.pixel); R.disc(ctx, bx + 20, by, 9, R.heatColor(pal, 0.5 + 0.5 * Math.sin(this.time * 3 + 2)), pal.pixel);
    this.text(this.t('subtitle'), W / 2, py + (L ? 92 : 134), { size: 13, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24, minSize: 9 });
    var top = py + (L ? 118 : 178), mf = menuFit(menu, top, 32, top - 6, py + ph - (L ? 24 : 52)); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 });
    this.text(this.t(this.input.touchOnly ? 'hintTouch' : 'hint'), W / 2, H - (L ? 4 : 30), { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: W - 20 });
  };

  // ---------- ввод ----------
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'), {}), tA = false;
  function wdir(dx, dy) { return R.land(g) ? { x: dy, y: -dx } : { x: dx, y: dy }; }   // экранное направление → мировое (в альбоме вперёд = вправо)
  function holdBtn(b, down, up) {
    var on = function (e) { if (!Arcade.touchOk(e)) return; down(e); b.classList.add('on'); }, off = function (e) { if (e.type.indexOf('mouse') === 0 && !Arcade.touchOk(e)) return; up(e); b.classList.remove('on'); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (n) { b.addEventListener(n, off, { passive: false }); });
  }
  var bA = pad && pad.querySelector('[data-act="throw"]'), bB = pad && pad.querySelector('[data-act="catch"]');
  if (bA) holdBtn(bA, function () { tA = true; }, function () { tA = false; });
  if (bB) holdBtn(bB, function () { if (game && g._sceneName === 'play') game.pressB(humans()[0]); }, function () { });
  addEventListener('blur', function () { tA = false; });
  [0, 1].forEach(function (pi) { g.input.player(pi).onPress(function (name) { if (name === 'catch' && game && g._sceneName === 'play') { var h = humans(); if (pi < h.length) game.pressB(h[pi]); } }); });
  KL.aimOf = function (u) { return game ? game.pickTarget(u, u.in.mx, u.in.my) : null; };
  function feed() {
    var h = humans(), S = game.state();
    h.forEach(function (uid, pi) {
      var Pl = g.input.player(pi), d = Pl.dir, dx = d.x, dy = d.y;
      if (pi === 0 && stick.active) { dx = stick.x; dy = stick.y; }
      var w = wdir(dx, dy), a = Pl.pressed('throw') || (pi === 0 && tA);
      game.setInput(uid, w.x, w.y, a);
    });
  }

  // ---------- игровая сцена ----------
  function tutText() {
    if (mode !== 'tour' || tour.match > 0 || tutSeen() || tutT > 22) return '';
    var t = g.input.touchOnly || g.input.device === 'touch' ? '' : 'K'; return g.t(tutT < 9 ? 'tut' + t + '1' : 'tut' + t + '2');
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game || needNew) { newMatch(); tutT = 0; } playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return; var S = game.state();
      feed(); game.update(Math.min(dt, 1 / 30)); tutT += dt;
      var i; for (i = 0; i < toasts.length; i++) toasts[i].t -= dt; toasts = toasts.filter(function (o) { return o.t > 0; });
      for (i = 0; i < fx.length; i++) fx[i].t -= dt; fx = fx.filter(function (o) { return o.t > 0; });
      if (S.left > 0 && S.left < 5) { var tk = Math.ceil(S.left); if (tk !== tickN) { tickN = tk; KL.sfx(g, 'tick', { last: tk === 1 }); } }
      if (S.phase === 'over') { endT += dt; if (endT > 1.4) { endT = -1; matchOver(); } }
      sync();
    },
    draw: function (ctx) { if (game) R.draw(ctx, game.state(), this, { toasts: toasts, fx: fx, api: game, score: mode === 'tour' ? tour.score : quick.streak, matchNo: level() + 1, tutText: tutText() }); else this.clear(); }
  });
  var pb = pad && pad.querySelector('[data-pause]');   // кнопку паузы подключает usePlayers (data-pause)

  global.__i18nScenes = ['card'];   // для tools/promo/i18n-overflow.mjs: проверить и карточку между матчами
  g.start('title');
  KL.app = { clear: function () { toasts = []; fx = []; tutT = 99; }, g: g, game: function () { return game; }, tour: function () { return tour; }, newMatch: newMatch, setMode: function (m) { mode = m; } };
})(typeof window !== 'undefined' ? window : globalThis);
