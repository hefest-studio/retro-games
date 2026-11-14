/* ОТБОЙНИК · сборка на фреймворке Гефест Arcade (engine.js): сцены title/pause/win/gameover — g.useStandardScreens,
   логика — js/game.js, рендер — js/render.js, SFX — js/audio.js, музыка — js/music.js (Arcade.tracks.otboynik).
   Клавиатура (в игре): Z / ← / A — левый флиппер, M / → / D — правый, пробел — пуск шара, ↑ / W / X — встряска.
   M в игре — правый флиппер (звук — в меню паузы); вне игры M, как везде, — звук.
   Между волнами: ← → — выбор карты/места, пробел или Enter — взять/поставить. Тач: левая/правая половина поля — флипперы
   (тап — и пуск шара), кнопки «встряска» и «пауза»; карты и места выбираются тапом. */
(function (global) {
  'use strict';
  var OB = global.OTBOYNIK, L = OB.logic, R = OB.render;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#24180f', panel: '#3a2618', ink: '#fbf1de', muted: '#c9b08a', accent: '#e0a33a', grid: '#3a2618', good: '#3fae5c', bad: '#d8452e', warn: '#e7a321' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', ink: '#ffffff', muted: '#ccaa77', accent: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'otboynik', strings: OB.STR, theme: 'modern', lives: 1, themes: themes });
  OB.g = g;
  function pal() { return g.themeName === 'retro' ? R.PR : R.PM; }
  g.useStandardScreens({ lives: 1 });
  g.menu.setHint(function () { return [g.t('hint1'), { text: g.t('hint2'), dim: true }]; }, 'title');

  var WAVE_KEY = 'arcade.otboynik.wave';
  function bestWave() { return Arcade.Store.getNum(WAVE_KEY, 0); }

  // ---------- игра ----------
  var game = null, toasts = [], shakeT = 0;
  function sync() { if (game) { var S = game.state(); g.state.score = S.score; g.state.level = S.wave; } }
  function toast(text, color, x, y, big) { toasts.push({ text: text, color: color, x: x, y: y, t: 1.2, big: big }); if (toasts.length > 8) toasts.shift(); }
  function onEvent(type, d) {
    OB.sfx(g, type, d); var P = pal(); d = d || {};
    if (type === 'kill') { g.particles.spawn(d.x, d.y, { color: d.type === 'ram' ? P.iron : d.type === 'cart' ? P.wood : d.type === 'fly' ? P.copper : P.tin, count: d.type === 'ram' ? 22 : 12, speed: 120, life: 0.5, size: 3 }); toast('+' + L.ENEMY[d.type].pts, P.accent2, d.x, d.y - 10); }
    else if (type === 'gate') { toast('−' + d.dmg, P.bad, d.x, d.y - 24, true); shakeT = Math.max(shakeT, 0.25); g.particles.spawn(d.x, d.y, { color: P.door, count: 10, speed: 90, life: 0.5, size: 3 }); }
    else if (type === 'drain') toast(g.t('drain'), P.bad, 240, 690);
    else if (type === 'bump') g.particles.spawn(d.x, d.y, { color: d.type === 'forge' ? P.coal : P.brass, count: 5, speed: 70, life: 0.3, size: 2 });
    else if (type === 'tilt') { toast(g.t('tilt') + ' ' + d.n + '/2', P.warn, 240, 560); shakeT = 0.15; }
    else if (type === 'tiltLock') { toast(g.t('tiltLock'), P.bad, 240, 560, true); shakeT = 0.4; }
    else if (type === 'waveClear') toast(g.t('waveClear') + ' · ' + g.t('bonus') + ' +' + d.bonus, P.good, 240, 160, true);
    else if (type === 'split') toast('×2', P.accent2, d.x, d.y - 26, true);
    else if (type === 'bossHit') g.particles.spawn(d.x, d.y, { color: P.brass, count: 6, speed: 110, life: 0.4, size: 3 });
    else if (type === 'bossDie') { g.particles.spawn(d.x, d.y, { color: P.coal, count: 80, speed: 240, life: 1.2, size: 4 }); shakeT = 1; }
    sync();
    if (type === 'win') { finish(); g.win(); }
    else if (type === 'gameover') { finish(); g.gameover(); }
  }
  function finish() { sync(); var S = game.state(), w = Math.min(S.waveReached, L.WAVES + 1); if (w > bestWave()) Arcade.Store.set(WAVE_KEY, String(w)); }
  function newGame() { game = OB.Game({ seed: Math.floor(Math.random() * 1e9), onEvent: onEvent }).start(); OB.current = game; toasts = []; shakeT = 0; sync(); }
  function inPlay() { return game && g._sceneName === 'play'; }
  function releaseAll() { if (game) { game.setFlip('L', false); game.setFlip('R', false); } held = {}; touches = {}; }

  // ---------- клавиатура (до ввода движка: M в игре — флиппер, а не звук) ----------
  var KL = ['KeyZ', 'ArrowLeft', 'KeyA'], KR = ['KeyM', 'ArrowRight', 'KeyD'], KT = ['ArrowUp', 'KeyW', 'KeyX'];
  var held = {};
  function flipState() { if (!game) return; var l = false, r = false, k; for (k in held) { if (!held[k]) continue; if (KL.indexOf(k) >= 0) l = true; if (KR.indexOf(k) >= 0) r = true; }
    for (k in touches) { if (touches[k] === 'L') l = true; else if (touches[k] === 'R') r = true; } game.setFlip('L', l); game.setFlip('R', r); }
  addEventListener('keydown', function (e) {
    if (!inPlay()) return;
    var c = e.code, S = game.state(), mine = KL.indexOf(c) >= 0 || KR.indexOf(c) >= 0 || KT.indexOf(c) >= 0 || c === 'Space';
    if (c === 'KeyM') { e.preventDefault(); e.stopImmediatePropagation(); }
    if (!mine && c !== 'Enter' && c !== 'NumpadEnter') return;
    if (mine) e.preventDefault();
    if (S.phase === 'cards' || S.phase === 'slot') {
      if (e.repeat) return;
      if (KL.indexOf(c) >= 0) game.moveSel(-1); else if (KR.indexOf(c) >= 0) game.moveSel(1);
      else if (c === 'Space' || c === 'Enter' || c === 'NumpadEnter') game.confirm();
      return;
    }
    if (S.phase !== 'wave') return;
    if (c === 'Space') { if (!e.repeat) game.launch(); return; }
    if (KT.indexOf(c) >= 0) { if (!e.repeat) game.tilt(); return; }
    held[c] = true; flipState();
  }, true);
  addEventListener('keyup', function (e) { if (held[e.code]) { held[e.code] = false; flipState(); } if (e.code === 'KeyM' && inPlay()) e.stopImmediatePropagation(); }, true);
  addEventListener('blur', releaseAll);

  // ---------- тач / мышь по полю ----------
  var cv = g.canvas, touches = {};
  function now() { return global.performance ? performance.now() : Date.now(); }
  function pt(cx, cy) { var r = cv.getBoundingClientRect(); return { x: (cx - r.left) * L.W / r.width, y: (cy - r.top) * L.H / r.height }; }
  function tapUI(p) {
    var S = game.state();
    if (S.phase === 'cards') { for (var i = 0; i < S.offer.length; i++) { var q = S.offer[i]._rect || R.cardRect(i, S.offer.length); if (p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h) { game.chooseCard(i); return true; } } return true; }
    if (S.phase === 'slot') { var best = -1, bd = 46; game.freeSlots().forEach(function (k) { var s = L.SLOTS[k], d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; best = k; } }); if (best >= 0) game.placeSlot(best); return true; }
    return false;
  }
  function down(id, cx, cy) {
    if (!inPlay() || now() - g.input._armedAt < 200) return false;   // тап, которым запустили игру из меню, не выбирает карту
    var p = pt(cx, cy);
    if (tapUI(p)) return true;
    if (game.state().phase !== 'wave') return true;
    if (game.waiting()) game.launch();
    touches[id] = p.x < L.W / 2 ? 'L' : 'R'; flipState(); return true;
  }
  function up(id) { if (touches[id]) { delete touches[id]; flipState(); } }
  cv.addEventListener('touchstart', function (e) { if (!inPlay()) return; e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; down(t.identifier, t.clientX, t.clientY); } }, { passive: false });
  cv.addEventListener('touchend', function (e) { for (var i = 0; i < e.changedTouches.length; i++) up(e.changedTouches[i].identifier); }, { passive: false });
  cv.addEventListener('touchcancel', function (e) { for (var i = 0; i < e.changedTouches.length; i++) up(e.changedTouches[i].identifier); });
  cv.addEventListener('mousedown', function (e) { if (down('m', e.clientX, e.clientY)) e.preventDefault(); });
  addEventListener('mouseup', function () { up('m'); });
  var bT = document.getElementById('bTilt'), bP = document.getElementById('bPause');
  function onBtn(el, fn) { if (!el) return; var h = function (e) { e.preventDefault(); fn(); }; el.addEventListener('touchstart', h, { passive: false }); el.addEventListener('mousedown', h); }
  onBtn(bT, function () { if (inPlay() && game.state().phase === 'wave') game.tilt(); });
  onBtn(bP, function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  // ---------- заставка: стол «играет сам» ----------
  var demo = OB.Game({ seed: 11, hp: 999 }).start();
  (function () { var S = demo.state(); demo.chooseCard(0); if (S.phase === 'slot') demo.placeSlot(1); S.hp = 999; S.hpMax = 999;
    [['forge', 0], ['bell', 2], ['splitter', 4]].forEach(function (q) { if (!demo.owned(q[0]) && S.buildings.every(function (b) { return b.slot !== q[1]; })) { var s = L.SLOTS[q[1]]; S.buildings.push({ type: q[0], lvl: 1, slot: q[1], x: s.x, y: s.y, r: L.BUILD[q[0]].r, flash: 0, cd: 0 }); } }); })();
  function demoTick(dt) {
    var S = demo.state(); S.hp = 999; S.hpMax = 999;
    if (S.phase !== 'wave') { demo.confirm(); demo.confirm(); }
    if (demo.waiting()) demo.launch();
    ['L', 'R'].forEach(function (k) { var f = L.FLIP[k]; demo.setFlip(k, S.balls.some(function (b) { return Math.hypot(b.x - (f.x + (k === 'L' ? 40 : -40)), b.y - f.y - 10) < 42 && b.vy > -50; })); });
    demo.update(Math.min(dt, 1 / 30));
    S.enemies.forEach(function (e) { if (e.y > 640) e.dead = true; });
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoTick(dt); };
  title.draw = function (ctx) {
    var P = pal(), th = this.th(), W = this.W;
    R.draw(this, ctx, demo.state(), P, { bare: true });
    ctx.fillStyle = P.retro ? 'rgba(0,0,0,.45)' : 'rgba(24,14,6,.45)'; ctx.fillRect(0, 0, W, this.H);
    var pw = 380, ph = 330, px = (W - pw) / 2, py = 150;
    R.panel(ctx, px, py, pw, ph, P, P.accent2);
    R.txt(ctx, this.t('title'), W / 2, py + 66, { size: this.i18n.lang === 'en' ? 40 : 50, align: 'center', color: P.accent2, weight: 900 }, P);
    R.txt(ctx, this.t('subtitle'), W / 2, py + 92, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    menu.draw(this, W / 2, py + 140, 32);
    var bw = bestWave();
    if (this.state.best || bw) R.txt(ctx, this.t('best') + ': ' + (this.state.best | 0) + (bw ? ' · ' + this.t('reach') + ': ' + (bw > L.WAVES ? this.t('boss') : this.t('bestWave') + ' ' + bw) : ''), W / 2, py + ph - 18, { size: 12, align: 'center', color: th.muted, weight: 600, shadow: false }, P);
    this.menu._drawHint('title');
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    if (this._sceneName === 'win' || this._sceneName === 'gameover') R.draw(this, this.ctx, game ? game.state() : demo.state(), pal(), { bare: true });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); releaseAll(); },
    press: function (a) { if (a === 'pause') { releaseAll(); this.pause(); } },
    update: function (dt) {
      if (!game) return;
      game.update(Math.min(dt, 1 / 30));
      if (shakeT > 0) shakeT -= dt;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) R.draw(this, ctx, game.state(), pal(), { toasts: toasts, shake: shakeT > 0 ? 6 * Math.min(1, shakeT * 3) : 0 }); else this.clear(); }
  });

  // тема страницы следует за темой игры
  var lastTheme = '';
  (function themeSync() { if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); } requestAnimationFrame(themeSync); })();

  g.start('title');
  OB.app = { g: g, game: function () { return game; }, newGame: newGame, demo: demo };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
