/* ШПУЛЬКА · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендер обеих тем (render.js) + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул: шпулька летает сама на фоне + меню движка. Партия: 8 столов подряд,
   3 жизни (+1 после 3-го и 6-го), ИИ-бота нет. Ввод — ОДНА кнопка «держи»: Пробел / ↑ / W / Z / X / кнопка геймпада (движок даёт виртуальные
   клавиши) / мышь по холсту / тач — большая кнопка внизу или любой палец по холсту. Площадка: лидерборд, «Без рекламы», реклама за награду,
   adBreak между столами. */
(function (global) {
  'use strict';
  var SP = global.SPOOL, R = SP.render, C = SP.consts;
  var mig = { migrated: false, oldBest: 0, notice: false };
  try { mig = SP.save.migrate({ get: function (k) { return localStorage.getItem(k); }, set: function (k, v) { localStorage.setItem(k, v); }, del: function (k) { localStorage.removeItem(k); } }); } catch (e) { }
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#12100e', panel: '#241d16', ink: '#f6efe2', muted: '#a79b88', accent: '#ee8a3a', grid: '#4a3b2a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffaa00', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: 450, height: 660, gameId: 'sosedi', leaderboard: 'sosedi', strings: SP.STR, theme: 'modern', lives: C.LIVES, themes: themes });
  SP.g = g; SP.ui.init(g);
  var pad = document.getElementById('pad');
  var TUT_KEY = 'arcade.sosedi.tut';
  g.persist(TUT_KEY, 'max'); g.persist('arcade.best.sosedi', 'max');
  function tutSeen() { return Arcade.Store.getNum(TUT_KEY, 0) > 0; }
  function P() { return R.pal(g); }

  g.useStandardScreens({ lives: C.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  var LB = 'sosedi';
  function lbSubmit(score) { if (score > 0) g.leaderboard.submit(score | 0, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: 'sosedi', label: function () { return g.t('lbAll'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbSubmit(g.state.best); });   // облако слито: рекорд с другого устройства — в таблицу
  g.useOwnGames(); g.useShortcut(); g.useReview({ minSessions: 3, gap: 3 });
  // «ещё шанс»: после последней жизни — продолжить стол с 1 жизнью; бонус в паузе — запасная нитка (гасит один удар, раз за партию)
  g.useRewardedContinue({ revive: function () { if (game) game.revive(); } });
  g.useRewardedBonus({ key: 'rwShield', scene: 'pause', label: function () { return g.t('rwBonus'); }, available: function () { return !!game && game.state().shield < 1; }, grant: function () { if (game) game.addShield(); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- партия ----------
  var game = null, toasts = [], tutT = 0, lastLevel = -1;
  function toast(text, color, x, y, size) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2, size: size }); if (toasts.length > 6) toasts.shift(); }
  function burst(x, y, color, n, sp) { var G = R.geo(g), p = R.pt(G, x, y); g.particles.spawn(p.x, p.y, { color: color, count: n, speed: sp || 110, life: 0.5, size: P().pixel ? 4 : 3 }); }
  function onEvent(type, d) {
    SP.sfx(g, type, d); var pal = P();
    if (type === 'button') { toast('+' + d.pts, d.combo > 1 ? pal.warnT : pal.ink, d.x, d.y - 8, 14 + Math.min(d.combo, 5) * 2); burst(d.x, d.y, '#f4efe1', 6, 90); }
    else if (type === 'hurt') { burst(d.x, d.y, pal.bad, 22, 150); g.rumble({ ms: 200, strong: 0.7, weak: 0.4 }); }
    else if (type === 'shield') { toast(g.t('shield'), pal.warnT, d.x, d.y - 20, 15); burst(d.x, d.y, pal.warnT, 12, 100); }
    else if (type === 'life') toast(g.t('life'), pal.good, 225, 300, 20);
    else if (type === 'snap') burst(d.x, d.y, pal.pinRust, 10, 90);
    else if (type === 'hook') burst(d.x, d.y, pal.thread, 4, 50);
    else if (type === 'exitOpen') toast(g.t('exitOpen'), pal.good, d.x, d.y - 24, 15);
    else if (type === 'clear') { burst(225, 300, pal.good, 30, 160); if (d.level >= 1) g.adBreak(); }
    else if (type === 'level') { toast(g.t('go'), pal.accent, 225, 480, 26); tutT = 0; R.resetTrail(); }
  }
  function sync() { if (!game) return; var S = game.state(); g.state.lives = Math.max(0, S.lives); g.state.level = S.level + 1; g.state.score = S.score; }
  function newRun() { toasts = []; tutT = 0; R.resetTrail(); game = SP.Game({ level: 0, onEvent: onEvent }); SP.current = game; sync(); toast(g.t('go'), P().accent, 225, 480, 26); }

  // ---------- титул: шпулька летает сама ----------
  var demo = null, demoSeed = 3, demoT = 0, demoH = 0, demoOn = false;
  function makeDemo() { var s = demoSeed++; demo = SP.Game({ level: s % 6, lives: 9 }); demoT = 0; demoH = 0; }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(); demoT += dt; demoH -= dt;
    if (S.mode !== 'play') { if (S.mode === 'clear') demo.step(dt); else makeDemo(); return; }
    if (demoH <= 0) { demoOn = !demoOn; demoH = demoOn ? 0.5 + Math.random() * 1.1 : 0.2 + Math.random() * 0.7; demo.setHold(demoOn); }
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
    var bx = W / 2, by = py + (L ? 82 : 112), r = 20; R.disc(ctx, bx, by, r, pal.woodDk, pal.pixel); R.disc(ctx, bx, by, r - 3, pal.wood, pal.pixel); R.disc(ctx, bx, by, r * 0.62, pal.thread, pal.pixel);
    this.text(this.t('subtitle'), W / 2, py + (L ? 108 : 148), { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24, minSize: 9 });
    var top = py + (L ? 132 : 188), mf = menuFit(menu, top, 32, top - 6, py + ph - (L ? 24 : 52)); menu.draw(this, W / 2, mf[0], mf[1]);
    var foot = this.state.best ? this.t('best') + ': ' + this.state.best : ''; if (mig.oldBest) foot += (foot ? ' · ' : '') + this.t('oldBest') + ': ' + mig.oldBest;
    if (foot) this.text(foot, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 });
    if (mig.notice) this.text(this.t('migrated'), W / 2, py + ph + 14, { size: 10, align: 'center', color: pal.good, weight: 700, maxWidth: W - 30 });
    this.text(this.t(this.input.touchOnly ? 'hintTouch' : 'hint'), W / 2, H - (L ? 4 : 18), { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: W - 20 });
  };
  { var tm = g.menu.get('title'); tm.items[tm.indexOf('play')].onSelect = function () { g.resetRun(); game = null; g.goto('play'); }; }

  // ---------- ввод: одна кнопка «держи» ----------
  var HOLD_KEYS = { Space: 1, ArrowUp: 1, KeyW: 1, KeyZ: 1, KeyX: 1, KeyJ: 1, ShiftLeft: 1, ShiftRight: 1 };
  var forced = null;   // служебное: промо/видео задают «держи» программно (SPOOL.app.force)
  var keys = {}, padOn = false, ptrOn = {}, ptrN = 0;
  function held() { for (var k in keys) if (keys[k]) return true; return padOn || ptrN > 0; }
  function clearHold() { keys = {}; padOn = false; ptrOn = {}; ptrN = 0; if (hookBtn) hookBtn.classList.remove('on'); if (game) game.setHold(false); }
  addEventListener('keydown', function (e) { if (HOLD_KEYS[e.code]) keys[e.code] = true; });
  addEventListener('keyup', function (e) { if (HOLD_KEYS[e.code]) keys[e.code] = false; });
  addEventListener('blur', clearHold);
  var hookBtn = pad && pad.querySelector('[data-act="hook"]');
  if (hookBtn) {
    var on = function (e) { if (!Arcade.touchOk(e)) return; padOn = true; hookBtn.classList.add('on'); }, off = function (e) { if (e && e.type.indexOf('mouse') === 0 && !Arcade.touchOk(e)) return; padOn = false; hookBtn.classList.remove('on'); };
    hookBtn.addEventListener('touchstart', on, { passive: false }); hookBtn.addEventListener('mousedown', on);
    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (n) { hookBtn.addEventListener(n, off, { passive: false }); });
  }
  var cv = g.canvas;   // мышь/палец по холсту во время партии — тоже «держи»
  cv.addEventListener('pointerdown', function (e) { if (g._sceneName !== 'play') return; ptrOn[e.pointerId] = 1; ptrN = Object.keys(ptrOn).length; try { cv.setPointerCapture(e.pointerId); } catch (er) { } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { cv.addEventListener(n, function (e) { if (ptrOn[e.pointerId]) { delete ptrOn[e.pointerId]; ptrN = Object.keys(ptrOn).length; } }); });
  var pb = pad && pad.querySelector('[data-pause]');
  if (pb) { var hp = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; pb.addEventListener('touchstart', hp, { passive: false }); pb.addEventListener('mousedown', hp); }

  // ---------- игровая сцена ----------
  function tutText() {
    if (!game) return ''; var S = game.state(), t = g.input.touchOnly || g.input.device === 'touch' ? '' : 'K';
    if (S.level === 0 && !tutSeen()) return tutT < 9 ? g.t('tut' + t + '1') : tutT < 30 ? g.t('tut' + t + '2') : '';
    if (S.level === 1 && tutT < 10) return g.t('tut' + t + '3');
    if (S.level === 3 && tutT < 9) return g.t('tut' + t + '4');
    return '';
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { clearHold(); if (!(d && d.resume) || !game) { newRun(); } },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return; var S = game.state();
      game.setHold(forced == null ? held() : forced); game.step(Math.min(dt, 1 / 30)); tutT += dt;
      var i; for (i = 0; i < toasts.length; i++) toasts[i].t -= dt; toasts = toasts.filter(function (o) { return o.t > 0; });
      if (S.level !== lastLevel) { lastLevel = S.level; if (S.level >= 1) g.storeSet(TUT_KEY, '1'); }
      sync();
      if (S.mode === 'gameover') { lbSubmit(S.score); g.gameover(); } else if (S.mode === 'victory') { lbSubmit(S.score); g.win(); }
    },
    draw: function (ctx) { if (game) R.draw(ctx, game.state(), this, { toasts: toasts, score: game.state().score, tutText: tutText() }); else this.clear(); }
  });

  global.__i18nScenes = [];   // для tools/promo/i18n-overflow.mjs
  g.start('title');
  SP.app = { g: g, force: function (v) { forced = v; }, game: function () { return game; }, newRun: newRun, clear: function () { toasts = []; tutT = 99; }, toast: function (t) { toast(t, P().accent, 225, 300, 22); },
    setLevel: function (lv) { toasts = []; game = SP.Game({ level: lv, onEvent: onEvent }); SP.current = game; sync(); tutT = 99; R.resetTrail(); return game; } };
})(typeof window !== 'undefined' ? window : globalThis);
