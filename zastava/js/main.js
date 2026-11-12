/* ЗАСТАВА · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js)
   + рендеры retro/modern + звук. Сцены title/pause/win/gameover — g.useStandardScreens,
   титул переопределён: живая демо-волна на фоне + меню движка. Ввод: клавиши, тач-кнопки, палец по полю. */
(function (global) {
  'use strict';
  var Z = global.ZASTAVA, L = Z.logic;
  // Палитры движка (меню, пауза, финалы) — ночь над мастерской, оранжевый акцент студии
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0a0b14', panel: '#17141f', ink: '#f1ece6', muted: '#a49cae', accent: '#ff8a3d', grid: '#2a2438' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#fc9838', muted: '#a8a8a8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'zastava', strings: Z.STR, theme: 'modern', lives: 3, themes: themes });
  Z.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  Z.ui.init(g);

  function rnd() { return g.themeName === 'retro' ? Z.classic : Z.modern; }
  var game = null, toasts = [], fx = [], playSince = 0;

  // Сложность волны — через g.difficulty движка (база + шаг на волну, с потолком)
  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.wave; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.9 && Math.abs(toasts[i].y - y) < 16) y -= 18;
    toasts.push({ text: text, color: color, x: Math.max(60, Math.min(L.W - 60, x)), y: y, t: 1.4 });
  }
  function ring(x, y, color, r, life) { fx.push({ x: x, y: y, color: color, r: r || 22, t: life || 0.4, life: life || 0.4 }); }

  var KC = { tick: '#e08a4c', gear: '#f2c96a', drill: '#86d8c6' }, KR = { tick: '#fc9838', gear: '#ffff55', drill: '#55ffff' };
  function visual(type, d) {
    var retro = g.themeName === 'retro', sz = retro ? 4 : 3, P = rnd().P;
    if (type === 'kill') { var c = (retro ? KR : KC)[d.type]; g.particles.spawn(d.x, d.y, { color: c, count: 10, speed: 90, life: 0.45, size: sz }); ring(d.x, d.y, c, 16, 0.3); }
    else if (type === 'probeKill') { g.particles.spawn(d.x, d.y, { color: '#ffd15e', count: 18, speed: 120, life: 0.6, size: sz }); ring(d.x, d.y, '#ffd15e', 30, 0.5); toast('+' + d.pts, '#ffd15e', d.x, d.y + 20); }
    else if (type === 'birdKill') { g.particles.spawn(d.x, d.y, { color: retro ? '#ff55ff' : '#e2a06a', count: 16, speed: 120, life: 0.6, size: sz }); ring(d.x, d.y, '#ff8a3d', 26, 0.45); if (d.pts >= 150) toast('+' + d.pts, P.accent, d.x, d.y); }
    else if (type === 'birdHit' || type === 'bossCore') { g.particles.spawn(d.x, d.y, { color: '#ffb03a', count: 8, speed: 80, life: 0.35, size: sz }); }
    else if (type === 'deflect' || type === 'clang') { g.particles.spawn(d.x, d.y, { color: '#9fd6ff', count: 5, speed: 70, life: 0.25, size: 2 }); }
    else if (type === 'bossSeg') { g.particles.spawn(d.x, d.y, { color: d.broken ? '#d47a44' : '#c3cad3', count: d.broken ? 9 : 4, speed: 80, life: 0.35, size: sz }); }
    else if (type === 'bossDie') { g.particles.spawn(d.x, d.y, { color: '#ff6a2a', count: 50, speed: 220, life: 1.2, size: sz + 1 }); g.particles.spawn(d.x, d.y, { color: '#fff3c8', count: 24, speed: 130, life: 0.9, size: sz }); ring(d.x, d.y, '#ff6a2a', 90, 0.9); }
    else if (type === 'playerHit') { g.particles.spawn(d.x, d.y, { color: P.accent, count: 22, speed: 130, life: 0.8, size: sz }); ring(d.x, d.y, '#ff5d3a', 40, 0.6); }
    else if (type === 'clash') g.particles.spawn(d.x, d.y, { color: '#ffffff', count: 4, speed: 50, life: 0.2, size: 2 });
    else if (type === 'bunker') g.particles.spawn(d.x, d.y, { color: retro ? '#a85400' : '#8a919a', count: 3, speed: 40, life: 0.25, size: 2 });
    else if (type === 'life') toast(g.t('extra'), P.good, L.W / 2, L.PLAYER_Y - 40);
  }

  function onEvent(type, d) {
    Z.sfx(g, type, d); visual(type, d);
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') { g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play' && game && game.state().over) g.gameover(); }, 1100); }
  }

  function newGame() {
    game = Z.Game({ lives: 3, wave: 1, difficulty: diff, onEvent: onEvent });
    game.start(); Z.current = game; toasts = []; fx = []; sync();
  }

  // ---------- Стандартные экраны + фон на всех экранах ----------
  g.useStandardScreens({ lives: 3 });
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this); };
  // Пауза: P / Esc ещё раз — продолжить
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // Финалы: своя подпись при «ржавь дошла до земли»
  var goScene = g.scenes.gameover, goDraw = goScene.draw;
  goScene.draw = function (ctx) {
    goDraw.call(this, ctx);
    if (game && game.state().invaded) Z.ui.txt(this, Z.ui.up(rnd().P, this.t('invaded')), this.W / 2, this.H / 2 + 46, { size: 13, align: 'center', color: this.th().bad, weight: 800 }, rnd().P);
  };

  // ---------- Титул: демо-волна «играет сама» ----------
  var demo = null, demoSeed = 5, demoWaves = [1, 3, 5, 2, 6, 4, 10], demoTgt = 0;
  function makeDemo() {
    var s = demoSeed++, rng = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    demo = Z.Game({ wave: demoWaves[demoSeed % demoWaves.length], maxWave: 99, lives: 99, rng: rng }).start();
  }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(), px = S.player.x, best = null;
    function consider(x) { if (best == null || Math.abs(x - px) < Math.abs(best - px)) best = x; }
    if (S.fleet) demo._shooters().forEach(function (a) { consider(demo._alienPos(a).x); });
    S.birds.forEach(function (b) { if (b.alive && !(b.shield && b.state === 'form')) consider(b.x); });
    if (S.boss && S.boss.alive) consider(S.boss.x);
    demoTgt = best == null ? L.W / 2 : best + Math.sin(S.time * 1.3) * 6;
    var d = demoTgt - px; demo.setDir(Math.abs(d) < 3 ? 0 : d);
    if (Math.abs(d) < 8) demo.action();
    demo.update(dt);
    if (S.over || S.time > 40 || S.phase === 'clear') makeDemo();
  }

  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H;
    r.draw(ctx, demo.state(), this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.74)' : 'rgba(8,9,18,.72)'; ctx.fillRect(0, 0, W, H);
    var pw = 380, ph = 340, px = (W - pw) / 2, py = 140;
    if (retro) {
      ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = P.hudLine; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = P.panel;
      Z.ui.roundRect(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#3a2f48'; ctx.lineWidth = 1; Z.ui.roundRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke();
    }
    Z.ui.txt(this, this.t('title'), W / 2, py + 62, { size: 48, align: 'center', color: P.accent, weight: 900 }, P);
    // ряд паразитов под заголовком
    var types = ['drill', 'gear', 'tick', 'gear', 'drill'], fr = Math.floor(this.time * 2) % 2;
    for (var i = 0; i < 5; i++) {
      var ax = W / 2 + (i - 2) * 40, ay = py + 92;
      if (retro) { /* пиксель-арт */ var SP = Z.classic.SPR[types[i]][fr], col = { tick: '#fc9838', gear: '#ffff55', drill: '#55ffff' }[types[i]];
        for (var rr = 0; rr < SP.length; rr++) for (var c = 0; c < SP[rr].length; c++) { var ch = SP[rr].charAt(c); if (ch === '.') continue; ctx.fillStyle = ch === '#' ? col : ch === 'o' ? '#ff5555' : ch === 'w' ? '#fff' : '#000'; ctx.fillRect(ax - 13 + c * 2, ay - 9 + rr * 2, 2, 2); } }
      else Z.modern.alien[types[i]](ctx, ax, ay, fr, this.time + i);
    }
    Z.ui.txt(this, this.t('subtitle'), W / 2, py + 132, { size: 13, align: 'center', color: th.muted, weight: 600 }, P);
    menu.draw(this, W / 2, py + 176, 32);
    if (this.state.best) Z.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 16, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    Z.ui.txt(this, this.t('hint'), W / 2, H - 34, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
  };

  // ---------- Игровая сцена ----------
  var touchX = null;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return;
      if (a === 'pause') { this.pause(); return; }
      if (a === 'action') game.action();
    },
    update: function (dt) {
      if (!game) return;
      var dx = this.input.dir.x;
      if (!dx && touchX != null) { var d = touchX - game.state().player.x; dx = Math.abs(d) < 4 ? 0 : d; }
      game.setDir(dx);
      game.setFire(this.input.pressed('action'));
      game.update(Math.min(dt, 1 / 30));
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      for (i = 0; i < fx.length; i++) fx[i].t -= dt;
      fx = fx.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) rnd().draw(ctx, game.state(), this, { toasts: toasts, fx: fx }); else this.clear(); }
  });

  // ---------- Палец по полю: лафет едет за пальцем, короткий тап — выстрел ----------
  var cv = g.canvas, touch = null;
  function canvasX(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) * (g.W / r.width); }
  function live() { return g._sceneName === 'play' && game && g.time - playSince > 0.25; }
  cv.addEventListener('touchstart', function (e) {
    if (!live()) return; e.preventDefault();
    var t = e.changedTouches[0]; touch = { id: t.identifier, at: Date.now(), cx: t.clientX, moved: false }; touchX = canvasX(t);
  }, { passive: false });
  cv.addEventListener('touchmove', function (e) {
    if (!touch || !live()) return; e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (t.identifier !== touch.id) continue; if (Math.abs(t.clientX - touch.cx) > 8) touch.moved = true; touchX = canvasX(t); }
  }, { passive: false });
  cv.addEventListener('touchend', function (e) {
    if (!touch) return;
    if (live()) { e.preventDefault(); if (!touch.moved && Date.now() - touch.at < 300) game.action(); }
    touch = null; touchX = null;
  }, { passive: false });
  cv.addEventListener('mousedown', function () { if (live()) game.action(); });

  g.start('title');
  Z.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
