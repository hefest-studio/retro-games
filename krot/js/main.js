/* МУРАВЕЙНИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендер обеих тем (render.js) + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул: колония сама ходит по туннелям на фоне + меню движка. Партия: 8 ярусов
   подряд, 3 жизни (+1 после 2-го, 4-го и 6-го яруса). ИИ-бота в игре нет. Ввод: стрелки/WASD/геймпад — вести колонну (движок), Пробел/A — обвал;
   тач — плавающий стик (держи в сторону) + кнопка ▼ «Обвал». Площадка: лидерборд, «Без рекламы», реклама за награду, adBreak между ярусами. */
(function (global) {
  'use strict';
  var MU = global.MURAV, R = MU.render, C = MU.consts;
  var mig = { migrated: false, oldBest: 0, notice: false };
  try { mig = MU.save.migrate({ get: function (k) { return localStorage.getItem(k); }, set: function (k, v) { localStorage.setItem(k, v); }, del: function (k) { localStorage.removeItem(k); } }); } catch (e) { }
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#15110d', panel: '#221a12', ink: '#f7efe0', muted: '#a99c86', accent: '#ffb23e', grid: '#4a3b2a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: 450, height: 660, gameId: 'krot', leaderboard: 'krot', strings: MU.STR, theme: 'modern', lives: C.LIVES, themes: themes });
  MU.g = g; MU.ui.init(g);
  var pad = document.getElementById('pad');
  var TUT_KEY = 'arcade.krot.tut';
  g.persist(TUT_KEY, 'max'); g.persist('arcade.best.krot', 'max');
  function tutSeen() { return Arcade.Store.getNum(TUT_KEY, 0) > 0; }
  function P() { return R.pal(g); }

  g.useStandardScreens({ lives: C.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  var LB = 'krot';
  function lbSubmit(score) { if (score > 0) g.leaderboard.submit(score | 0, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: 'krot', label: function () { return g.t('lbAll'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbSubmit(g.state.best); });   // облако слито: рекорд с другого устройства — в таблицу
  g.useOwnGames(); g.useShortcut(); g.useReview({ minSessions: 3, gap: 3 });
  // «ещё шанс»: после последней жизни — продолжить ярус с 1 жизнью; бонус в паузе — два муравья в колонию (раз за партию)
  g.useRewardedContinue({ revive: function () { if (game) game.revive(); } });
  g.useRewardedBonus({ key: 'rwAnts', scene: 'pause', label: function () { return g.t('rwBonus'); }, available: function () { return !!game && game.state().ants.length <= 8 && !game.state().pend; }, grant: function () { if (game) game.addAnts(2); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- партия ----------
  var game = null, toasts = [], tutT = 0, lastLevel = -1;
  function toast(text, color, x, y, size) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2, size: size }); if (toasts.length > 6) toasts.shift(); }
  function burst(x, y, color, n, sp) { var G = R.geo(g), p = R.pt(G, x, y); g.particles.spawn(p.x, p.y, { color: color, count: n, speed: sp || 110, life: 0.5, size: P().pixel ? 4 : 3 }); }
  function onEvent(type, d) {
    MU.sfx(g, type, d); var pal = P();
    if (type === 'dig') burst(d.x, d.y, pal.pixel ? '#5555ff' : '#e3b867', 3, 60);
    else if (type === 'pick') burst(d.x, d.y, pal.crumb, 6, 80);
    else if (type === 'deliver') { toast('+' + d.pts, d.n > 1 ? pal.warn : pal.ink, d.x, 1.1, 14 + Math.min(d.n, 5) * 2); burst(d.x, 0.5, pal.warn, 8, 90); }
    else if (type === 'hatch') { toast(g.t('hatch'), pal.good, d.x, 1.2, 14); burst(d.x, d.y, pal.good, 8, 80); }
    else if (type === 'collapse') { d.cells.forEach(function (c) { burst(c[0], c[1], pal.pixel ? '#5555ff' : '#c9913f', 8, 100); }); g.rumble({ ms: 160, strong: 0.5, weak: 0.5 }); }
    else if (type === 'entomb') toast(g.t('entomb'), pal.good, 5, 6, 18);
    else if (type === 'bite') { toast(g.t('bite'), pal.bad, d.x, d.y - 0.5, 16); burst(d.x, d.y, pal.bad, 12, 120); g.rumble({ ms: 120, strong: 0.4, weak: 0.3 }); }
    else if (type === 'hurt') { burst(d.x, d.y, pal.bad, 22, 150); g.rumble({ ms: 220, strong: 0.7, weak: 0.4 }); }
    else if (type === 'life') toast(g.t('life'), pal.good, 5, 6, 20);
    else if (type === 'clear') { burst(5, 0.5, pal.good, 30, 160); if (d.level >= 1) g.adBreak(); }
    else if (type === 'level') { toast(g.t('go'), pal.accent, 5, 3, 26); tutT = 0; }
  }
  function sync() { if (!game) return; var S = game.state(); g.state.lives = Math.max(0, S.lives); g.state.level = S.level + 1; g.state.score = S.score; }
  function newRun() { toasts = []; tutT = 0; game = MU.Game({ level: 0, seed: (Math.random() * 1e9) | 0, onEvent: onEvent }); MU.current = game; sync(); toast(g.t('go'), P().accent, 5, 3, 26); }

  // ---------- титул: колония сама ходит по туннелям ----------
  var demo = null, demoSeed = 3, demoT = 0;
  function makeDemo() { var s = demoSeed++; demo = MU.Game({ level: s % 3, seed: s, lives: 9, length: 4 }); demo.state().beetles = []; demoT = 0; }
  makeDemo();
  function demoDir(S) {   // жадный автопилот: к ближайшей крошке, с грузом — домой
    var h = S.ants[0], load = S.ants.filter(function (a) { return a.c; }).length, home = load >= 2 || !S.crumbs.some(function (c) { return c.on; }), tx, ty, best = 1e9;
    if (home) { if (h.y === 0) return h.x < 5 ? 1 : 3; tx = h.x; ty = 0; }
    else S.crumbs.forEach(function (c) { var dd = Math.abs(c.x - h.x) + Math.abs(c.y - h.y); if (c.on && dd < best) { best = dd; tx = c.x; ty = c.y; } });
    var dx = tx - h.x, dy = ty - h.y, ds = [];
    if (Math.abs(dy) >= Math.abs(dx)) { if (dy) ds.push(dy < 0 ? 0 : 2); if (dx) ds.push(dx < 0 ? 3 : 1); } else { if (dx) ds.push(dx < 0 ? 3 : 1); if (dy) ds.push(dy < 0 ? 0 : 2); }
    ds.push(2, 1, 3, 0);
    for (var i = 0; i < ds.length; i++) { var d = ds[i], x = h.x + C.DX[d], y = h.y + C.DY[d]; if (x < 0 || y < 0 || x >= C.COLS || y >= C.ROWS || S.map[y][x] === '#' || S.ants.some(function (a) { return a.x === x && a.y === y; })) continue; return d; }
    return -1;
  }
  function demoStep(dt) {
    var S = demo.state(); demoT += dt;
    if (S.mode !== 'play') { if (S.mode === 'clear' && S.clearT > 0.3) S.clearT = 0.3; if (S.mode === 'clear' && S.level >= C.MAX_LEVEL - 1 || S.mode === 'victory') makeDemo(); else if (S.mode === 'dying') makeDemo(); }
    demo.setDir(S.mode === 'play' ? demoDir(S) : -1); S.inv = 5; demo.step(Math.min(dt, 1 / 30)); S.beetles = []; if (demoT > 45) makeDemo();
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(dt); };
  title.draw = function (ctx) {
    var th = this.th(), pal = R.pal(this), W = this.W, H = this.H, L = R.land(this), S = demo.state();
    R.bare(ctx, S, this);
    ctx.fillStyle = pal.pixel ? 'rgba(0,0,0,.78)' : 'rgba(16,11,6,.74)'; ctx.fillRect(0, 0, W, H);
    var pw = Math.min(400, W - 30), ph = Math.min(L ? H - 24 : 350, H - 40), px = (W - pw) / 2, py = (H - ph) / 2;
    if (pal.pixel) { ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = pal.line; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = th.panel; R.rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#4a3b2a'; ctx.lineWidth = 1; R.rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke(); }
    this.text(this.t('title'), W / 2, py + (L ? 30 : 46), { size: L ? 32 : 36, align: 'center', color: pal.accent, weight: 900, maxWidth: pw - 30 });
    var by = py + (L ? 80 : 108); for (var i = 0; i < 5; i++) R.antIcon(ctx, W / 2 - 60 + i * 30, by, 11, pal);
    this.text(this.t('subtitle'), W / 2, py + (L ? 108 : 148), { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24, minSize: 9 });
    var top = py + (L ? 132 : 188), mf = menuFit(menu, top, 32, top - 6, py + ph - (L ? 24 : 52)); menu.draw(this, W / 2, mf[0], mf[1]);
    var foot = this.state.best ? this.t('best') + ': ' + this.state.best : ''; if (mig.oldBest) foot += (foot ? ' · ' : '') + this.t('oldBest') + ': ' + mig.oldBest;
    if (foot) this.text(foot, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 });
    if (mig.notice) this.text(this.t('migrated'), W / 2, py + ph + 14, { size: 10, align: 'center', color: pal.good, weight: 700, maxWidth: W - 30 });
    this.text(this.t(this.input.touchOnly ? 'hintTouch' : 'hint'), W / 2, H - (L ? 4 : 18), { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: W - 20 });
  };
  { var tm = g.menu.get('title'); tm.items[tm.indexOf('play')].onSelect = function () { g.resetRun(); game = null; g.goto('play'); }; }

  // ---------- ввод ----------
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'), {});
  function heldDir() {
    var dx = 0, dy = 0, d = g.input.dir;
    if (stick.active) { dx = stick.x; dy = stick.y; if (Math.hypot(dx, dy) < 0.45) { dx = 0; dy = 0; } } else if (d) { dx = d.x; dy = d.y; }
    if (!dx && !dy) return -1;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  }
  var bB = pad && pad.querySelector('[data-act="collapse"]');
  if (bB) {
    var on = function (e) { if (!Arcade.touchOk(e)) return; if (game && g._sceneName === 'play') game.collapse(); bB.classList.add('on'); }, off = function (e) { if (e && e.type.indexOf('mouse') === 0 && !Arcade.touchOk(e)) return; bB.classList.remove('on'); };
    bB.addEventListener('touchstart', on, { passive: false }); bB.addEventListener('mousedown', on);
    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (n) { bB.addEventListener(n, off, { passive: false }); });
  }
  var pb = pad && pad.querySelector('[data-pause]');
  if (pb) { var hp = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; pb.addEventListener('touchstart', hp, { passive: false }); pb.addEventListener('mousedown', hp); }
  addEventListener('blur', function () { if (game) game.setDir(-1); });

  // ---------- игровая сцена ----------
  function tutText() {
    if (!game) return ''; var S = game.state(), t = g.input.touchOnly || g.input.device === 'touch' ? '' : 'K';
    if (S.level === 0 && !tutSeen()) return tutT < 9 ? g.t('tut' + t + '1') : tutT < 40 ? g.t('tut' + t + '2') : '';
    if (S.level === 1 && tutT < 10) return g.t('tut' + t + '3');
    if (S.level === 3 && tutT < 14) return g.t('tut' + t + '4');
    if (S.level === 6 && tutT < 9) return g.t('tut' + t + '5');
    return '';
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) { newRun(); } if (game) game.setDir(-1); },
    press: function (a) { if (a === 'pause') this.pause(); else if (a === 'action' && game) game.collapse(); },
    update: function (dt) {
      if (!game) return; var S = game.state();
      game.setDir(heldDir()); game.step(Math.min(dt, 1 / 30)); tutT += dt;
      var i; for (i = 0; i < toasts.length; i++) toasts[i].t -= dt; toasts = toasts.filter(function (o) { return o.t > 0; });
      if (S.level !== lastLevel) { lastLevel = S.level; if (S.level >= 1) g.storeSet(TUT_KEY, '1'); }
      sync();
      if (S.mode === 'gameover') { lbSubmit(S.score); g.gameover(); } else if (S.mode === 'victory') { lbSubmit(S.score); g.win(); }
    },
    draw: function (ctx) { if (game) R.draw(ctx, game.state(), this, { toasts: toasts, score: game.state().score, tutText: tutText() }); else this.clear(); }
  });

  global.__i18nScenes = [];   // для tools/promo/i18n-overflow.mjs
  g.start('title');
  MU.app = { g: g, game: function () { return game; }, newRun: newRun, clear: function () { toasts = []; tutT = 99; }, toast: function (t) { toast(t, P().warn, 5, 4, 20); },
    setLevel: function (lv, len) { toasts = []; game = MU.Game({ level: lv, seed: 7, length: len || 4, onEvent: onEvent }); MU.current = game; sync(); tutT = 99; return game; } };
})(typeof window !== 'undefined' ? window : globalThis);
