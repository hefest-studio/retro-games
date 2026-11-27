/* ПОДКОП · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендер обеих тем (render.js) + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул: пескопад сам насыпает барханы на фоне + меню движка. Партия: 7 уровней подряд,
   3 жизни (+1 после 3-го и 6-го уровня). Ввод: стрелки/WASD/геймпад — ход, Z/Пробел/A — копать, X/B — сыпать, стрелка вверх/вниз + копать — над головой/под ногами;
   тач — плавающий стик + две кнопки (⛏ копать, ▼ сыпать). Площадка: лидерборд, «Без рекламы», реклама за награду, adBreak между уровнями. */
(function (global) {
  'use strict';
  var PK = global.PODKOP, R = PK.render, C = PK.consts;
  var mig = { migrated: false, oldBest: 0, notice: false };
  try { mig = PK.save.migrate({ get: function (k) { return localStorage.getItem(k); }, set: function (k, v) { localStorage.setItem(k, v); }, del: function (k) { localStorage.removeItem(k); } }); } catch (e) { }
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#10131f', panel: '#181c30', ink: '#eef1fb', muted: '#8f98b8', accent: '#ffc857', grid: '#37406a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: 450, height: 540, gameId: 'podkop', leaderboard: 'podkop', strings: PK.STR, theme: 'modern', lives: C.LIVES, themes: themes });
  PK.g = g; PK.ui.init(g);
  var pad = document.getElementById('pad');
  var TUT_KEY = 'arcade.podkop.tut';
  g.persist(TUT_KEY, 'max'); g.persist('arcade.best.podkop', 'max');
  function tutSeen() { return Arcade.Store.getNum(TUT_KEY, 0) > 0; }
  function P() { return R.pal(g); }

  g.useStandardScreens({ lives: C.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.menu.addItem({ key: 'retry', scene: 'pause', after: 'resume', label: function () { return g.t('retry'); }, onSelect: function () { if (game) game.restart(); g.goto('play', { resume: true }); } });
  var LB = 'podkop';
  function lbSubmit(score) { if (score > 0) g.leaderboard.submit(score | 0, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: 'podkop', label: function () { return g.t('lbAll'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbSubmit(g.state.best); });   // облако слито: рекорд с другого устройства — в таблицу
  g.useOwnGames(); g.useShortcut(); g.useReview({ minSessions: 3, gap: 3 });
  // «ещё шанс»: после последней жизни — продолжить уровень с 1 жизнью; бонус в паузе — 4 зерна в мешок (раз за партию)
  g.useRewardedContinue({ revive: function () { if (game) game.revive(); } });
  g.useRewardedBonus({ key: 'rwBonus', scene: 'pause', label: function () { return g.t('rwBonus'); }, available: function () { return !!game && game.state().mode === 'play' && game.state().hero.bag <= C.CAP - 4; }, grant: function () { if (game) game.addSand(4); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- партия ----------
  var game = null, toasts = [], tutT = 0, lastLevel = -1;
  function toast(text, color, x, y, size) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2, size: size }); if (toasts.length > 5) toasts.shift(); }
  function burst(x, y, color, n, sp) { if (!game) return; var G = R.geo(g, game.state()), p = R.pt(G, x, y); g.particles.spawn(p.x, p.y, { color: color, count: n, speed: sp || 110, life: 0.5, size: P().pixel ? 4 : 3 }); }
  function onEvent(type, d) {
    PK.sfx(g, type, d); var pal = P();
    if (type === 'dig') burst(d.x, d.y, pal.sand, 4, 60);
    else if (type === 'pour') burst(d.x, d.y, pal.sand, 3, 50);
    else if (type === 'bury') { toast(g.t('bury'), pal.good, d.x, d.y - 0.5, 14); burst(d.x, d.y, pal.sand, 16, 130); g.rumble({ ms: 120, strong: 0.4, weak: 0.3 }); }
    else if (type === 'hurt') { burst(d.x, d.y, pal.bad, 24, 150); g.rumble({ ms: 240, strong: 0.7, weak: 0.4 }); }
    else if (type === 'life') toast(g.t('life'), pal.good, 11, 8, 20);
    else if (type === 'clear') { burst(d.x || 11, 8, pal.good, 24, 150); if (d.level >= 1) g.adBreak(); }
    else if (type === 'level' || type === 'retry') { tutT = 0; }
  }
  function sync() { if (!game) return; var S = game.state(); g.state.lives = Math.max(0, S.lives); g.state.level = S.level + 1; g.state.score = S.score; }
  function newRun() { toasts = []; tutT = 0; game = PK.Game({ level: 0, seed: (Math.random() * 1e9) | 0, onEvent: onEvent }); PK.current = game; sync(); lastLevel = 0; }

  // ---------- титул: пескопад сам насыпает бархан ----------
  var demo = null, demoT = 0;
  function makeDemo() { demo = PK.Game({ level: 4, lives: 9 }); demo.state().hero.x = 15; demoT = 0; }
  makeDemo();
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoT += dt; demo.step(Math.min(dt, 1 / 30)); if (demoT > 40) makeDemo(); };
  title.draw = function (ctx) {
    var th = this.th(), pal = R.pal(this), W = this.W, H = this.H, L = R.land(this), S = demo.state();
    R.bare(ctx, S, this);
    ctx.fillStyle = pal.pixel ? 'rgba(0,0,0,.78)' : 'rgba(10,12,24,.74)'; ctx.fillRect(0, 0, W, H);
    var pw = Math.min(400, W - 30), ph = Math.min(L ? H - 24 : 350, H - 40), px = (W - pw) / 2, py = (H - ph) / 2;
    if (pal.pixel) { ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = pal.line; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = th.panel; R.rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#37406a'; ctx.lineWidth = 1; R.rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke(); }
    this.text(this.t('title'), W / 2, py + (L ? 30 : 46), { size: L ? 32 : 36, align: 'center', color: pal.accent, weight: 900, maxWidth: pw - 30 });
    var by = py + (L ? 70 : 92); for (var i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? pal.sand : pal.accent; var hh = 6 + Math.abs(3 - i) * -1.5 + 6; ctx.fillRect(W / 2 - 63 + i * 18, by + 14 - hh, 14, hh); }
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
  var touch = { dig: false, pour: false };
  function bindHold(sel, key) {
    var b = pad && pad.querySelector(sel); if (!b) return;
    var on = function (e) { if (!Arcade.touchOk(e)) return; touch[key] = true; b.classList.add('on'); }, off = function (e) { if (e && e.type.indexOf('mouse') === 0 && !Arcade.touchOk(e)) return; touch[key] = false; b.classList.remove('on'); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (n) { b.addEventListener(n, off, { passive: false }); });
  }
  bindHold('[data-act="dig"]', 'dig'); bindHold('[data-act="pour"]', 'pour');
  var pb = pad && pad.querySelector('[data-pause]');
  if (pb) { var hp = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; pb.addEventListener('touchstart', hp, { passive: false }); pb.addEventListener('mousedown', hp); }
  function readInput() {
    var d = g.input.dir, dx = d.x, dy = d.y, k = g.input.codes || {};
    if (stick.active) { dx = Math.abs(stick.x) > 0.4 ? Math.sign(stick.x) : 0; dy = Math.abs(stick.y) > 0.6 && Math.abs(stick.y) > Math.abs(stick.x) * 0.8 ? Math.sign(stick.y) : 0; }
    return { dx: dx, dy: dy, dig: !!(g.input.keys.action || k.KeyZ || k.KeyK || touch.dig), pour: !!(k.KeyX || k.KeyJ || touch.pour) };
  }
  addEventListener('blur', function () { if (game) game.setInput({}); touch.dig = touch.pour = false; });

  // ---------- игровая сцена ----------
  function tutText() {
    if (!game) return ''; var S = game.state(), k = g.input.touchOnly || g.input.device === 'touch' ? '' : 'K';
    if (S.mode !== 'play') return '';
    if (S.level === 0 && !tutSeen()) return tutT < 14 ? g.t('tut' + (k ? 'K' : '') + '1') : tutT < 40 ? g.t('tut' + (k ? 'K' : '') + '1b') : '';
    if (S.level >= 1 && tutT < 12) return g.t('tut' + (S.level + 1));
    return '';
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) { newRun(); } if (game) game.setInput({}); },
    press: function (a) { if (a === 'pause') this.pause(); else if ((a === 'action' || a === 'start') && game && game.state().mode === 'clear') game.skip(); },
    update: function (dt) {
      if (!game) return; var S = game.state();
      game.setInput(readInput()); game.step(Math.min(dt, 1 / 30)); tutT += dt;
      var i; for (i = 0; i < toasts.length; i++) toasts[i].t -= dt; toasts = toasts.filter(function (o) { return o.t > 0; });
      if (S.level !== lastLevel) { lastLevel = S.level; if (S.level >= 1) g.storeSet(TUT_KEY, '1'); toasts = []; }
      sync();
      if (S.mode === 'gameover') { lbSubmit(S.score); g.gameover(); } else if (S.mode === 'victory') { lbSubmit(S.score); g.win(); }
    },
    draw: function (ctx) { if (game) R.draw(ctx, game.state(), this, { toasts: toasts, tutText: tutText() }); else this.clear(); }
  });

  global.__i18nScenes = [];   // для tools/promo/i18n-overflow.mjs
  g.start('title');
  PK.app = { g: g, game: function () { return game; }, newRun: newRun, clear: function () { toasts = []; tutT = 99; }, toast: function (t) { toast(t, P().warn, 11, 8, 20); },
    setLevel: function (lv) { toasts = []; game = PK.Game({ level: lv, seed: 7, onEvent: onEvent }); PK.current = game; sync(); lastLevel = lv; tutT = 99; return game; } };
})(typeof window !== 'undefined' ? window : globalThis);
