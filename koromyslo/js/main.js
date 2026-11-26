/* КОРОМЫСЛО · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендер обеих тем (render.js) + звук + вызов дня.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: коромысло «играет само» на фоне + меню движка.
   Ввод: палец/мышь по полю (над чашей — призрак и предпросмотр стрелки, отпускание/клик — бросок), ← → и пробел, геймпад (движок). */
(function (global) {
  'use strict';
  var K = global.KOROMYSLO, L = K.logic, R = K.render, G = L.GEO;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#11202a', panel: '#1c2430', ink: '#f3efe6', muted: '#9aa3ad', accent: '#f0b44c', grid: '#33404c' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: G.W, height: G.H, gameId: 'koromyslo', leaderboard: 'koromyslo', strings: K.STR, theme: 'modern', lives: 3, themes: themes });
  K.g = g;
  K.ui.init(g);

  var game = null, toasts = [], fx = [], playSince = 0, preview = -1, daily = null, lastDaily = null, lastTick = -1;

  // Сложность уровня — через g.difficulty движка (база + шаг на уровень, с потолком)
  function diff(level, base, step, max) { var keep = g.state.level; g.state.level = level; var v = g.difficulty(base, step, max); g.state.level = keep; return v; }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }
  function toast(text, color, x, y, size) { for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 1.0 && Math.abs(toasts[i].y - y) < 24) y -= 26; toasts.push({ text: text, color: color, x: Math.max(70, Math.min(G.W - 70, x)), y: y, t: 1.4, size: size }); }
  function P() { return R.pal(g); }

  // ---------- обучение (первая партия): флаг в localStorage и облаке ----------
  var TUT_KEY = 'arcade.koromyslo.tut';
  g.persist(TUT_KEY, 'max');
  function tutSeen() { return Arcade.Store.getNum(TUT_KEY, 0) > 0; }

  function visual(type, d) {
    var S = game && game.state(), pal = P();
    if (type === 'clear') {
      [d.a, d.b].forEach(function (i) { var h = R.hook(i, S.angle); g.particles.spawn(h.x, h.y + G.HANG - 30, { color: pal.accent, count: 14 + d.n * 2, speed: 110, life: 0.6, size: pal.pixel ? 4 : 3 }); fx.push({ kind: 'ring', x: h.x, y: h.y + G.HANG - 20, r: 30, color: pal.accent, t: 0.45, life: 0.45 }); });
      toast('+' + d.pts + (d.mult > 1 ? '  ×' + d.mult : ''), pal.accent, G.CX, 250, 20);
      if (d.mult > 1) toast(g.t('combo') + ' ×' + d.mult, pal.warn, G.CX, 220, 16);
    } else if (type === 'tip') {
      fx.push({ kind: 'flash', color: pal.bad, t: 0.35, life: 0.35 });
      d.dumped.forEach(function (p) { var h = R.hook(p.pan, S.angle), y = h.y + G.HANG - 4;
        p.ws.forEach(function (w, k) { y -= R.wSize(w.v).h + 2; fx.push({ kind: 'fallw', x: h.x, y: y + R.wSize(w.v).h, vx: (L.SIDE[p.pan] * 60) + (k - 1) * 20, vy: -80 - k * 20, rot: 0, vr: L.SIDE[p.pan] * (2 + k), v: w.v, rust: w.rust, t: 1.6 }); }); });
      toast(g.t(d.jam ? 'jam' : 'tip'), pal.bad, G.CX, 240, 24); g.rumble({ ms: 220, strong: 0.7, weak: 0.4 });
    } else if (type === 'even') toast(g.t('even') + ' +' + d.pts, pal.good, G.CX, 250, 16);
    else if (type === 'level') { toast(g.t('levelUp') + ' ' + d.level, pal.good, G.CX, 200, 26); }
    else if (type === 'land' && d.rust) { var hh = R.hook(d.pan, S.angle); g.particles.spawn(hh.x, hh.y + G.HANG - 20, { color: pal.rust, count: 8, speed: 60, life: 0.4, size: 3 }); }
  }

  function onEvent(type, d) {
    K.sfx(g, type, d); visual(type, d); sync();
    if (type === 'tutDone') g.storeSet(TUT_KEY, '1');
    if (type === 'level' && g._sceneName === 'play' && g.adReady()) { cardL = d.level; g.goto('card'); }   // межстраничная — по нажатию на карточке уровня (Яндекс 4.4)
    if (type === 'gameover') { g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play' && game && game.state().over) g.gameover(); }, 1200); }
  }

  function newGame() {
    g.resetRun();
    game = K.Game({ rng: daily ? daily.rng() : undefined, tutorial: !daily && !tutSeen(), difficulty: diff, onEvent: onEvent });
    game.start(); K.current = game; toasts = []; fx = []; preview = -1; sync();
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: 3 });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };   // P / Esc ещё раз — продолжить

  // ---------- вызов дня (одинаковые гирьки для всех на день; рекорд дня и серия — в облако) ----------
  var STORE = { get: function (k) { return Arcade.Store.get(k, null); }, set: function (k, v) { g.storeSet(k, v); } };
  g.persist(K.daily.KEY_BEST, 'max'); g.persist(K.daily.KEY_STREAK, 'max');
  function srvTime() { try { var p = g.platform, t = p && typeof p.serverTime === 'function' ? p.serverTime() : null; return (typeof t === 'number' && isFinite(t) && t > 1e12) ? t : null; } catch (e) { return null; } }
  var dayCache = null;
  function today() { var t = srvTime(), key = t ? K.daily.dateKey(t, 3) : K.daily.dateKey(Date.now()); if (!dayCache || dayCache.key !== key) dayCache = K.daily.Daily(STORE, key); return dayCache; }
  function startRun(isDaily) { daily = isDaily ? today() : null; g.state.score = 0; g.state.lives = 3; g.state.level = 1; g.resetRun(); game = null; g.goto('play'); }
  g.menu.addItem({ key: 'daily', scene: 'title', after: 'play', label: function () { return g.t('daily') + ' · ' + today().label; }, onSelect: function () { startRun(true); } });
  { var tm = g.menu.get('title'); tm.items[tm.indexOf('play')].onSelect = function () { startRun(false); }; }

  // ---------- площадка (движок v2.8/2.9): таблицы koromyslo / koromysloDaily, «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборды с техническими именами «koromyslo», «koromysloDaily»; GamePush — числовые поля игрока с теми же именами;
  // товар no_ads (постоянный). Список — promo/koromyslo/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'koromyslo';
  g.persist('arcade.best.koromyslo', 'max');
  function lbSubmit(board, score) { if (score > 0) g.leaderboard.submit(score | 0, { board: board }); }
  function lbBest() { lbSubmit(LB, g.state.best); var b = today().best(); if (b) lbSubmit('koromysloDaily', b); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('lbAll'); } }, { id: 'koromysloDaily', label: function () { return g.t('daily'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) { dayCache = null; lbBest(); } });   // облако слито: рекорды с другого устройства — в таблицы
  g.useOwnGames(); g.useShortcut(); g.useReview({ minSessions: 3, gap: 3 });
  // «Ещё один шанс» (раз за партию): 1 жизнь, крайние чаши пустеют; бонус в паузе — +1 жизнь (до 3)
  g.useRewardedContinue({ revive: function () { if (game) { game.reviveAd(); sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // Меню вмещает пункты площадки: если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // финал партии: рекорд дня, серия, таблицы
  function finishRun() {
    lastDaily = null;
    if (daily) { var r = daily.submit(g.state.score); lastDaily = { label: daily.label, best: r.best, isNew: r.isNew, streak: r.streak }; lbSubmit('koromysloDaily', g.state.score); }
    lbSubmit(LB, g.state.best); daily = null;
  }
  ['win', 'gameover'].forEach(function (n) {
    var sc = g.scenes[n], en = sc.enter, dr = sc.draw;
    sc.enter = function (d) { en.call(this, d); finishRun(); };
    sc.draw = function (ctx) {
      dr.call(this, ctx); if (!lastDaily) return; var th = this.th();
      this.text(lastDaily.isNew ? this.t('dailyNew') : this.t('dailyBest') + ' ' + lastDaily.label + ': ' + lastDaily.best, this.W / 2, this.H / 2 + 52, { size: 15, align: 'center', color: lastDaily.isNew ? th.good : th.ink, weight: 800, maxWidth: this.W - 30 });
      if (lastDaily.streak) this.text(this.t('streak') + ': ' + lastDaily.streak, this.W / 2, this.H / 2 + 76, { size: 13, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 30 });
    };
  });

  // ---------- карточка «уровень N» (только когда площадка готова показать межстраничную): нажатие → реклама → дальше ----------
  var cardL = 0, cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), pal = P();
      if (game) R.draw(ctx, game.state(), this, { limit: game.params().limit, daily: !!daily }); else this.clear();
      ctx.fillStyle = 'rgba(6,8,14,.76)'; ctx.fillRect(0, 0, this.W, this.H);
      this.text(this.t('levelUp') + ' ' + cardL, this.W / 2, this.H / 2 - 30, { size: 34, align: 'center', color: pal.accent, weight: 900, maxWidth: this.W - 40 });
      if (game) this.text(this.t('score') + ': ' + game.state().score, this.W / 2, this.H / 2 + 8, { size: 16, align: 'center', color: th.ink, weight: 700, maxWidth: this.W - 40 });
      this.text(this.t('cardNext'), this.W / 2, this.H / 2 + 46, { size: 14, align: 'center', color: th.muted, weight: 600, maxWidth: this.W - 40 });
    }
  });

  // ---------- титул: коромысло «играет само» ----------
  var demo = null, demoSeed = 3, demoWait = 0.6;
  function makeDemo() { var s = demoSeed++; demo = K.Game({ rng: L.mulberry32(s), level: 2 + (s % 3) }).start(); demo._S.fuseMax = 0; }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state();
    if (S.phase === 'aim' && S.cur) { demo._S.fuseMax = 0; demoWait -= dt; if (demoWait <= 0) { var m = L.bestMove(S.pans, S.cur.v, { limit: demo.params().limit, noise: 10, rng: Math.random }); if (m >= 0) { demo.setCursor(m); demo.drop(m); } demoWait = 0.7 + Math.random() * 0.4; } }
    demo.update(dt);
    if (S.over || S.time > 60) makeDemo();
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); };
  title.draw = function (ctx) {
    var th = this.th(), pal = P(), W = this.W, H = this.H;
    R.draw(ctx, demo.state(), this, { bare: true });
    ctx.fillStyle = pal.pixel ? 'rgba(0,0,0,.72)' : 'rgba(8,12,18,.66)'; ctx.fillRect(0, 0, W, H);
    var pw = 380, ph = 470, px = (W - pw) / 2, py = 150;
    if (pal.pixel) { ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = pal.line; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = th.panel; R.rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#3a4656'; ctx.lineWidth = 1; R.rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke(); }
    this.text(this.t('title'), W / 2, py + 60, { size: 42, align: 'center', color: pal.accent, weight: 900, maxWidth: pw - 30 });
    // маленькое коромысло под заголовком: качается
    var a = Math.sin(this.time * 1.4) * 0.16, cx = W / 2, cy = py + 96;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.fillStyle = pal.beam; ctx.fillRect(-80, -3, 160, 6); ctx.restore();
    [-1, 1].forEach(function (sd, k) { var hx = cx + sd * 70 * Math.cos(a), hy = cy + sd * 70 * Math.sin(a); ctx.strokeStyle = pal.chain; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + 22); ctx.stroke(); R.weight(ctx, hx, hy + 44, k ? 3 : 2, false, pal); });
    ctx.fillStyle = pal.beamDk; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 9, cy + 16); ctx.lineTo(cx - 9, cy + 16); ctx.closePath(); ctx.fill();
    this.text(this.t('subtitle'), W / 2, py + 170, { size: 13, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24, minSize: 9 });
    var mf = menuFit(menu, py + 214, 32, py + 196, py + ph - 40); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, W / 2, py + ph - 16, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 });
    var d = today(), b = d.best(), s = d.streak();
    this.text(this.t('dailyBest') + ' ' + d.label + ': ' + (b || '—') + (s ? '  ·  ' + this.t('streak') + ': ' + s : ''), W / 2, H - 112, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: W - 30 });
    this.text(this.t(this.input.touchOnly ? 'hintTouch' : 'hint'), W / 2, H - 40, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: W - 20 });
  };

  // ---------- игровая сцена ----------
  function tutText(S) { return S.tut < 0 ? '' : g.t(['tut1', 'tut2', 'tut3', 'tut2'][S.tut]); }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return; var S = game.state();
      if (a === 'pause') { this.pause(); return; }
      if (a === 'left' || a === 'right') { game.moveCursor(a === 'left' ? -1 : 1); preview = S.cursor; K.sfx(g, 'move'); }
      else if (a === 'action' || a === 'down') { if (S.phase === 'aim') game.drop(S.cursor); }
    },
    update: function (dt) {
      if (!game) return;
      game.update(Math.min(dt, 1 / 30));
      var S = game.state();
      if (S.phase === 'aim' && S.fuseMax > 0 && S.fuse < 2) { var tk = Math.floor(S.fuse * 2); if (tk !== lastTick) { lastTick = tk; K.sfx(g, 'tick', { last: tk === 0 }); } } else lastTick = -1;
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      for (i = 0; i < fx.length; i++) { var f = fx[i]; f.t -= dt; if (f.kind === 'fallw') { f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; } }
      fx = fx.filter(function (o) { return o.t > 0 && (o.kind !== 'fallw' || o.y < G.H + 60); });
      sync();
    },
    draw: function (ctx) { if (game) { var S = game.state(); R.draw(ctx, S, this, { toasts: toasts, fx: fx, preview: preview >= 0 ? preview : S.cursor, limit: game.params().limit, daily: !!daily, tutText: tutText(S) }); } else this.clear(); }
  });

  // ---------- палец / мышь по полю ----------
  var cv = g.canvas, down = false;
  function canvasPt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (g.W / r.width), y: (e.clientY - r.top) * (g.H / r.height) }; }
  function panUnder(x) { var best = 0, bd = 1e9; for (var i = 0; i < L.PANS; i++) { var dd = Math.abs(R.panX(i) - x); if (dd < bd) { bd = dd; best = i; } } return best; }
  function live() { return g._sceneName === 'play' && game && g.time - playSince > 0.25; }
  cv.addEventListener('pointerdown', function (e) {
    if (g._sceneName === 'card') { e.preventDefault(); cardGo(); return; }
    if (!live()) return; var p = canvasPt(e); if (p.y < 60) return;
    e.preventDefault(); down = true; preview = panUnder(p.x); game.setCursor(preview);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!live()) return; var p = canvasPt(e);
    if (down || e.pointerType === 'mouse') { var i = panUnder(p.x); if (i !== preview) { preview = i; game.setCursor(i); } }
  });
  cv.addEventListener('pointerup', function (e) {
    if (!down) return; down = false; if (!live()) return; var p = canvasPt(e); e.preventDefault();
    var i = panUnder(p.x); game.setCursor(i); preview = e.pointerType === 'mouse' ? i : -1;
    if (game.state().phase === 'aim') game.drop(i);
  });
  cv.addEventListener('pointercancel', function () { down = false; });
  cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') preview = -1; });
  document.getElementById('bPause').addEventListener('click', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  g.start('title');
  K.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
