/* КАТЫШ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендер обеих тем (render.js) + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул: шар катается сам на фоне + меню движка. Партия: 8 гумен подряд,
   3 жизни (+1 после 3-го и 6-го), ИИ-бота нет. Ввод: стрелки/WASD/геймпад — направление катания (движок), Пробел/A — тормоз;
   тач — плавающий стик (смахни/держи в сторону) + ◆ тормоз. Площадка: лидерборд, «Без рекламы», реклама за награду, adBreak между гумнами. */
(function (global) {
  'use strict';
  var KT = global.KATYSH, R = KT.render, C = KT.consts;
  var mig = { migrated: false, oldBest: 0, notice: false };
  try { mig = KT.save.migrate({ get: function (k) { return localStorage.getItem(k); }, set: function (k, v) { localStorage.setItem(k, v); }, del: function (k) { localStorage.removeItem(k); } }); } catch (e) { }
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#17130f', panel: '#241d16', ink: '#f6efe2', muted: '#a79b88', accent: '#ee8a3a', grid: '#4a3b2a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffaa00', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: 450, height: 660, gameId: 'hrum', leaderboard: 'hrum', strings: KT.STR, theme: 'modern', lives: C.LIVES, themes: themes });
  KT.g = g; KT.ui.init(g);
  var pad = document.getElementById('pad');
  var TUT_KEY = 'arcade.hrum.tut';
  g.persist(TUT_KEY, 'max'); g.persist('arcade.best.hrum', 'max');
  function tutSeen() { return Arcade.Store.getNum(TUT_KEY, 0) > 0; }
  function P() { return R.pal(g); }

  g.useStandardScreens({ lives: C.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  var LB = 'hrum';
  function lbSubmit(score) { if (score > 0) g.leaderboard.submit(score | 0, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: 'hrum', label: function () { return g.t('lbAll'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbSubmit(g.state.best); });   // облако слито: рекорд с другого устройства — в таблицу
  g.useOwnGames(); g.useShortcut(); g.useReview({ minSessions: 3, gap: 3 });
  // «ещё шанс»: после последней жизни — продолжить гумно с 1 жизнью; бонус в паузе — щит от одного кота (раз за партию)
  g.useRewardedContinue({ revive: function () { if (game) game.revive(); } });
  g.useRewardedBonus({ key: 'rwShield', scene: 'pause', label: function () { return g.t('rwBonus'); }, available: function () { return !!game && game.state().shield < 1; }, grant: function () { if (game) game.addShield(); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- партия ----------
  var game = null, toasts = [], tutT = 0, lastLevel = -1, needNew = false, held = -1;
  function toast(text, color, x, y, size) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2, size: size }); if (toasts.length > 6) toasts.shift(); }
  function burst(x, y, color, n, sp) { var G = R.geo(g), p = R.pt(G, x, y); g.particles.spawn(p.x, p.y, { color: color, count: n, speed: sp || 110, life: 0.5, size: P().pixel ? 4 : 3 }); }
  function onEvent(type, d) {
    KT.sfx(g, type, d); var pal = P();
    if (type === 'seed') { toast('+' + d.pts, d.chain > 1 ? pal.warn : pal.ink, d.x, d.y - 0.4, 14 + Math.min(d.chain, 5) * 2); burst(d.x, d.y, '#f4efe1', 6, 90); if (d.chain === 3) toast(g.t('chain') + ' ×3', pal.warn, d.x, d.y - 1.2, 16); }
    else if (type === 'hurt') { burst(d.x, d.y, pal.bad, 22, 150); g.rumble({ ms: 200, strong: 0.7, weak: 0.4 }); }
    else if (type === 'shield') { toast(g.t('shield'), pal.warn, d.x, d.y - 0.6, 16); burst(d.x, d.y, pal.warn, 12, 100); }
    else if (type === 'life') toast(g.t('life'), pal.good, 6, 8, 20);
    else if (type === 'brake') burst(game.state().hero.x, game.state().hero.y, '#ffffff', 5, 60);
    else if (type === 'hay') burst(d.x, d.y, pal.pixel ? '#ffff55' : '#efc84e', 5, 70);
    else if (type === 'clear') { burst(6, 8, pal.good, 30, 160); if (d.level >= 1) g.adBreak(); }
    else if (type === 'level') { toast(g.t('go'), pal.accent, 6, 8, 26); tutT = 0; }
  }
  function sync() { if (!game) return; var S = game.state(); g.state.lives = Math.max(0, S.lives); g.state.level = S.level + 1; g.state.score = S.score; }
  function newRun() { toasts = []; tutT = 0; game = KT.Game({ level: 0, seed: (Math.random() * 1e9) | 0, onEvent: onEvent }); KT.current = game; sync(); toast(g.t('go'), P().accent, 6, 9, 26); }

  // ---------- титул: шар катится сам ----------
  var demo = null, demoSeed = 3, demoT = 0;
  function makeDemo() { var s = demoSeed++; demo = KT.Game({ level: 1 + (s % 5), seed: s, lives: 9 }); demoT = 0; }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(); demoT += dt;
    if (S.mode !== 'play' && S.mode !== 'dying') { makeDemo(); return; }
    if (S.mode === 'play' && !S.hero.moving) { var tries = 0, d; do { d = Math.floor(Math.random() * 4); tries++; } while (!demo.canRoll(d) && tries < 12); demo.setDir(d); }
    S.inv = 5; demo.step(Math.min(dt, 1 / 30)); if (demoT > 40) makeDemo();
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(dt); };
  title.draw = function (ctx) {
    var th = this.th(), pal = R.pal(this), W = this.W, H = this.H, L = R.land(this), S = demo.state();
    R.bare(ctx, S, this);
    ctx.fillStyle = pal.pixel ? 'rgba(0,0,0,.76)' : 'rgba(14,10,6,.72)'; ctx.fillRect(0, 0, W, H);
    var pw = Math.min(400, W - 30), ph = Math.min(L ? H - 24 : 350, H - 40), px = (W - pw) / 2, py = (H - ph) / 2;
    if (pal.pixel) { ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = pal.line; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = th.panel; R.rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#4a3b2a'; ctx.lineWidth = 1; R.rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke(); }
    this.text(this.t('title'), W / 2, py + (L ? 30 : 46), { size: L ? 34 : 40, align: 'center', color: pal.accent, weight: 900, maxWidth: pw - 30 });
    var bx = W / 2, by = py + (L ? 82 : 112), r = 20; R.disc(ctx, bx, by, r, pal.ballDk, pal.pixel); R.disc(ctx, bx, by, r - 3, pal.ball, pal.pixel); R.disc(ctx, bx, by + 2, r * 0.55, pal.ham, pal.pixel);
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
  function wdir(dx, dy) { return R.land(g) ? { x: dy, y: -dx } : { x: dx, y: dy }; }   // экранное направление → мировое
  function heldDir() {
    var dx = 0, dy = 0, d = g.input.dir;
    if (stick.active) { dx = stick.x; dy = stick.y; if (Math.hypot(dx, dy) < 0.45) { dx = 0; dy = 0; } } else if (d) { dx = d.x; dy = d.y; }
    if (!dx && !dy) return -1;
    var w = wdir(Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0, Math.abs(dx) >= Math.abs(dy) ? 0 : Math.sign(dy));
    return w.y < 0 ? 0 : w.x > 0 ? 1 : w.y > 0 ? 2 : 3;
  }
  function feed() {
    var hd = heldDir(), S = game.state();
    if (hd < 0) { held = -1; return; }
    if (hd !== held) { held = hd; game.setDir(hd); }
    else if (!S.hero.moving && S.want < 0 && game.canRoll(hd)) game.setDir(hd);      // держишь сторону — катится дальше после остановки
  }
  var bB = pad && pad.querySelector('[data-act="brake"]');
  if (bB) {
    var on = function (e) { if (!Arcade.touchOk(e)) return; if (game && g._sceneName === 'play') game.brake(); bB.classList.add('on'); }, off = function (e) { if (e && e.type.indexOf('mouse') === 0 && !Arcade.touchOk(e)) return; bB.classList.remove('on'); };
    bB.addEventListener('touchstart', on, { passive: false }); bB.addEventListener('mousedown', on);
    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (n) { bB.addEventListener(n, off, { passive: false }); });
  }
  var pb = pad && pad.querySelector('[data-pause]');
  if (pb) { var hp = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; pb.addEventListener('touchstart', hp, { passive: false }); pb.addEventListener('mousedown', hp); }
  addEventListener('blur', function () { held = -1; });

  // ---------- игровая сцена ----------
  function tutText() {
    if (!game) return ''; var S = game.state(), t = g.input.touchOnly || g.input.device === 'touch' ? '' : 'K';
    if (S.level === 0 && !tutSeen()) return tutT < 8 ? g.t('tut' + t + '1') : tutT < 30 ? g.t('tut' + t + '2') : '';
    if (S.level === 1 && tutT < 10) return g.t('tut' + t + '3');
    if (S.level === 4 && tutT < 9) return g.t('tut' + t + '4');
    return '';
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) { newRun(); } held = -1; },
    press: function (a) { if (a === 'pause') this.pause(); else if (a === 'action' && game) game.brake(); },
    update: function (dt) {
      if (!game) return; var S = game.state();
      feed(); game.step(Math.min(dt, 1 / 30)); tutT += dt;
      var i; for (i = 0; i < toasts.length; i++) toasts[i].t -= dt; toasts = toasts.filter(function (o) { return o.t > 0; });
      if (S.level !== lastLevel) { lastLevel = S.level; if (S.level >= 1) g.storeSet(TUT_KEY, '1'); }
      sync();
      if (S.mode === 'gameover') { lbSubmit(S.score); g.gameover(); } else if (S.mode === 'victory') { lbSubmit(S.score); g.win(); }
    },
    draw: function (ctx) { if (game) R.draw(ctx, game.state(), this, { toasts: toasts, score: game.state().score, tutText: tutText() }); else this.clear(); }
  });

  global.__i18nScenes = [];   // для tools/promo/i18n-overflow.mjs
  g.start('title');
  KT.app = { g: g, game: function () { return game; }, newRun: newRun, clear: function () { toasts = []; tutT = 99; }, setLevel: function (lv) { toasts = []; game = KT.Game({ level: lv, seed: 7, onEvent: onEvent }); KT.current = game; sync(); tutT = 99; return game; } };
})(typeof window !== 'undefined' ? window : globalThis);
