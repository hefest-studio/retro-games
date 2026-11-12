/* ЭСКАДРИЛЬЯ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: живой «демо-полёт» на фоне + меню движка.
   Ввод: стрелки/WASD, Пробел — огонь (удержание), X / Shift / K — петля; тач: дпад, ●, ↻; палец по полю — вести самолёт
   (пока палец на поле — огонь идёт сам). */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA, L = E.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0a3a55', panel: '#121926', ink: '#f2eee6', muted: '#9ba7b8', accent: '#ff8a3d', grid: '#24324a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#fc9838', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'eskadrilya', strings: E.STR, theme: 'modern', lives: 3, themes: themes });
  E.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  function rnd() { return g.themeName === 'retro' ? E.classic : E.modern; }
  var game = null, toasts = [], fx = [], playSince = 0, shake = 0;

  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.9 && Math.abs(toasts[i].y - y) < 16) y -= 18;
    toasts.push({ text: text, color: color, x: Math.max(70, Math.min(L.W - 70, x)), y: y, t: 1.4 });
  }
  function ring(x, y, color, r, life) { fx.push({ x: x, y: y, color: color, r: r || 22, t: life || 0.4, life: life || 0.4 }); }
  function loopNow() { if (g._sceneName === 'play' && game && g.time - playSince > 0.15) game.loop(); }
  E.ui.init(g, loopNow);

  var PKC = { fuel: '#5fe0a0', wing: '#3fc1b0', loop: '#c08cff', power: '#ff8a3d' };
  function visual(type, d) {
    var retro = g.themeName === 'retro', sz = retro ? 4 : 3, P = rnd().P;
    if (type === 'kill') {
      var big = d.type === 'blimp', c = d.red ? '#ff6a4a' : big ? '#ff8a3d' : d.type === 'swift' ? '#c7d3df' : '#e0a060';
      g.particles.spawn(d.x, d.y, { color: c, count: big ? 40 : 12, speed: big ? 170 : 100, life: big ? 0.9 : 0.45, size: sz });
      if (big) g.particles.spawn(d.x, d.y, { color: '#5a5e68', count: 20, speed: 60, life: 1.1, size: sz + 1 });
      ring(d.x, d.y, c, big ? 50 : 18, big ? 0.7 : 0.3);
      if (big || d.red) toast('+' + d.pts, P.accent, d.x, d.y);
    } else if (type === 'groundKill') {
      g.particles.spawn(d.x, d.y, { color: '#ffb03a', count: 18, speed: 110, life: 0.6, size: sz });
      g.particles.spawn(d.x, d.y, { color: '#4a4a52', count: 12, speed: 50, life: 1.0, size: sz + 1 });
      ring(d.x, d.y, '#ff8a3d', 26, 0.45);
    } else if (type === 'hitAir' || type === 'groundHit' || type === 'turretHit') g.particles.spawn(d.x, d.y, { color: '#ffd27a', count: 3, speed: 60, life: 0.2, size: 2 });
    else if (type === 'clang') g.particles.spawn(d.x, d.y, { color: '#cfe6ff', count: 3, speed: 60, life: 0.2, size: 2 });
    else if (type === 'turretKill') { g.particles.spawn(d.x, d.y, { color: '#ff6a2a', count: 26, speed: 140, life: 0.8, size: sz }); ring(d.x, d.y, '#ff6a2a', 40, 0.6); toast('+' + d.pts, P.accent, d.x, d.y); shake = 0.25; }
    else if (type === 'bossSink') { g.particles.spawn(d.x, d.y, { color: '#ff6a2a', count: 70, speed: 240, life: 1.4, size: sz + 1 }); g.particles.spawn(d.x, d.y + 80, { color: '#dff4ff', count: 40, speed: 120, life: 1.2, size: sz }); ring(d.x, d.y, '#ff6a2a', 120, 1.0); toast('+' + d.pts, P.good, d.x, d.y - 40); shake = 0.6; }
    else if (type === 'hurt') { g.particles.spawn(d.x, d.y, { color: '#ff5d3a', count: 8, speed: 90, life: 0.35, size: sz }); ring(d.x, d.y, '#ff5d3a', 22, 0.35); shake = 0.18; }
    else if (type === 'lowEnergy') toast(g.t('low'), P.bad, L.W / 2, 470);
    else if (type === 'wingLost') { g.particles.spawn(d.x, d.y, { color: '#3fc1b0', count: 16, speed: 110, life: 0.6, size: sz }); toast(g.t('wing_lost'), P.bad, d.x, d.y - 20); }
    else if (type === 'pickup') { ring(d.x, d.y, PKC[d.kind], 30, 0.5); toast(g.t('pk_' + d.kind), PKC[d.kind], d.x, d.y - 30); }
    else if (type === 'loop') ring(d.x, d.y - 16, '#c08cff', 34, 0.6);
    else if (type === 'playerLost') { g.particles.spawn(d.x, d.y, { color: '#ff8a3d', count: 40, speed: 170, life: 1.0, size: sz }); g.particles.spawn(d.x, d.y, { color: '#3a3a40', count: 20, speed: 70, life: 1.2, size: sz + 1 }); ring(d.x, d.y, '#ff5d3a', 50, 0.7); shake = 0.4; }
    else if (type === 'life') toast(g.t('extra'), P.good, L.W / 2, 420);
    else if (type === 'bossAnchor') toast(g.t('anchored'), P.bad, L.W / 2, 520);
  }

  function onEvent(type, d) {
    E.sfx(g, type, d); visual(type, d);
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') { g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play' && game && game.state().over) g.gameover(); }, 1300); }
  }

  function newGame() {
    game = E.Game({ lives: 3, level: 1, difficulty: diff, onEvent: onEvent });
    game.start(); E.current = game; toasts = []; fx = []; shake = 0; sync();
  }

  // ---------- Стандартные экраны; фон пауз/финалов — кадр игры ----------
  g.useStandardScreens({ lives: 3 });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {
    baseClear.call(this, c);
    var S = game ? game.state() : demo ? demo.state() : null;
    if (S) { rnd().draw(this.ctx, S, this, { bare: true }); this.ctx.fillStyle = 'rgba(0,0,0,.35)'; this.ctx.fillRect(0, 0, this.W, this.H); }
  };

  // ---------- Титул: демо-полёт «играет сам» ----------
  var demo = null, demoSeed = 3, demoLv = [1, 3, 5, 2, 7, 4, 8, 6];
  function makeDemo() {
    var s = demoSeed++, rng = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    demo = E.Game({ level: demoLv[demoSeed % demoLv.length], maxLevel: 99, lives: 99, rng: rng }).start();
    var S = demo.state(); S.banner = 0; S.dist = 200 + rng() * 600; S.player.wing = [true, true];
  }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(), P = S.player, best = null, by = 520;
    S.air.forEach(function (e) { if (e.alive && e.y < P.y - 40 && (best == null || Math.abs(e.x - P.x) < Math.abs(best - P.x))) best = e.x; });
    if (best == null) S.ground.forEach(function (gg) { var y = demo._sy(gg.wy); if (gg.alive && y > 60 && y < P.y - 60 && (best == null || Math.abs(gg.x - P.x) < Math.abs(best - P.x))) best = gg.x; });
    var tx = best == null ? L.W / 2 + Math.sin(S.time * 0.7) * 120 : best, dx = tx - P.x;
    var dodge = 0;
    S.bullets.forEach(function (b) { if (b.vy > 0 && b.y < P.y && P.y - b.y < 120 && Math.abs(b.x - P.x) < 20) dodge = b.x < P.x ? 1 : -1; });
    demo.setDir(dodge || (Math.abs(dx) < 4 ? 0 : dx), Math.abs(P.y - by) < 6 ? 0 : by - P.y);
    demo.setFire(true);
    demo.update(dt);
    S.player.energy = Math.max(S.player.energy, 40);
    if (S.over || S.time > 45 || S.phase === 'clear' || S.stage === 'boss' && S.time > 30) makeDemo();
  }

  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H;
    r.draw(ctx, demo.state(), this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.66)' : 'rgba(6,14,24,.6)'; ctx.fillRect(0, 0, W, H);
    var pw = 392, ph = 356, px = (W - pw) / 2, py = 128;
    if (retro) {
      ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = P.hudLine; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = P.panel;
      E.ui.roundRect(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#2c3a52'; ctx.lineWidth = 1; E.ui.roundRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke();
    }
    E.ui.txt(this, this.t('title'), W / 2, py + 58, { size: retro ? 38 : 42, align: 'center', color: P.accent, weight: 900 }, P);
    // звено под заголовком
    var t = this.time, bob = Math.sin(t * 2) * 2;
    if (retro) { E.classic.spr(ctx, E.classic.SPR.plane, W / 2, py + 92 + bob, 3, '#fc9838', { o: '#aa5500', x: '#ffff55' }); [-1, 1].forEach(function (s) { E.classic.spr(ctx, E.classic.SPR.plane, W / 2 + s * 48, py + 102 - bob, 2, '#55ffff', { o: '#aaaaaa', x: '#ffff55' }); }); }
    else { E.modern.plane(ctx, W / 2, py + 92 + bob, 1, E.modern.OWN, 0, t, 1, 0); [-1, 1].forEach(function (s) { E.modern.plane(ctx, W / 2 + s * 50, py + 102 - bob, 0.74, E.modern.MATE, 0, t + s, 1, 0); }); }
    E.ui.txt(this, this.t('subtitle'), W / 2, py + 136, { size: retro ? 11 : 13, align: 'center', color: th.ink, weight: 700 }, P);
    E.ui.txt(this, this.t('subtitle2'), W / 2, py + 154, { size: retro ? 10 : 12, align: 'center', color: th.muted, weight: 600 }, P);
    menu.draw(this, W / 2, py + 196, 32);
    if (this.state.best) E.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 16, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    E.ui.txt(this, this.t('hint'), W / 2, H - 30, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
  };

  // ---------- Игровая сцена ----------
  var drag = null;   // { id, sx, sy, px, py, tx, ty }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return;
      if (a === 'pause') { this.pause(); return; }
      if (a === 'action') game.fire();
    },
    update: function (dt) {
      if (!game) return;
      var dx = this.input.dir.x, dy = this.input.dir.y, S = game.state();
      if (!dx && !dy && drag && drag.tx != null) {
        var ex = drag.tx - S.player.x, ey = drag.ty - S.player.y;
        dx = Math.abs(ex) < 5 ? 0 : ex; dy = Math.abs(ey) < 5 ? 0 : ey;
      }
      game.setDir(dx, dy);
      game.setFire(this.input.pressed('action') || !!drag);
      game.update(Math.min(dt, 1 / 30));
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      for (i = 0; i < fx.length; i++) fx[i].t -= dt;
      fx = fx.filter(function (o) { return o.t > 0; });
      if (shake > 0) shake -= dt;
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var s = shake > 0 && g._sceneName === 'play' ? shake * 10 : 0;
      ctx.save(); if (s) ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      rnd().draw(ctx, game.state(), this, { toasts: toasts, fx: fx });
      ctx.restore();
    }
  });

  // ---------- Петля с клавиатуры: X / K / Shift ----------
  addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (e.code === 'KeyX' || e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (g._sceneName === 'play') { e.preventDefault(); loopNow(); } }
  });

  // ---------- Палец/мышь по полю: самолёт идёт за указателем (со смещением), огонь — пока держишь ----------
  var cv = g.canvas;
  function canvasPt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (g.W / r.width), y: (e.clientY - r.top) * (g.H / r.height) }; }
  function live() { return g._sceneName === 'play' && game && g.time - playSince > 0.25; }
  cv.addEventListener('pointerdown', function (e) {
    if (!live()) return; e.preventDefault();
    var p = canvasPt(e), S = game.state();
    drag = { id: e.pointerId, sx: p.x, sy: p.y, px: S.player.x, py: S.player.y, tx: S.player.x, ty: S.player.y };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id || !live()) return; e.preventDefault();
    var p = canvasPt(e);
    drag.tx = Math.max(L.PX0, Math.min(L.PX1, drag.px + (p.x - drag.sx) * 1.3));
    drag.ty = Math.max(L.PY0, Math.min(L.PY1, drag.py + (p.y - drag.sy) * 1.3));
  });
  function endDrag(e) { if (drag && (!e || e.pointerId === drag.id)) drag = null; }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('dblclick', function (e) { e.preventDefault(); loopNow(); });

  g.start('title');
  E.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
