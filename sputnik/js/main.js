/* СПУТНИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js) + рендеры retro/modern + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул переопределён: демо-полёт на фоне + меню движка.
   Ввод: стрелки/WASD — полёт; Пробел/Z/J — огонь (удержание — заряд); X/K/Shift — дрон; тач-дпад, ● и ◎. */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK, L = Sp.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#05060f', panel: '#15131f', ink: '#f1ece6', muted: '#a49cae', accent: '#ff8a3d', grid: '#2a2640' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'sputnik', strings: Sp.STR, theme: 'modern', lives: 3, themes: themes });
  Sp.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  function rnd() { return g.themeName === 'retro' ? Sp.classic : Sp.modern; }
  var game = null, toasts = [], fx = [], playSince = 0, extraFire = false;

  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.9 && Math.abs(toasts[i].y - y) < 14) y -= 16;
    toasts.push({ text: text, color: color, x: Math.max(60, Math.min(L.W - 60, x)), y: Math.max(50, y), t: 1.4 });
  }
  function ring(x, y, color, r, life) { fx.push({ x: x, y: y, color: color, r: r || 20, t: life || 0.4, life: life || 0.4 }); }
  function droneAct() { if (g._sceneName === 'play' && game && g.time - playSince > 0.15) game.drone(); }
  Sp.ui.init(g, droneAct);

  var KC = { moth: '#c88ad8', dart: '#dfe5ee', turret: '#b9a3a0', walker: '#c9a77a', mine: '#b4bac4', stinger: '#d6a32a', pod: '#e8f1ff', guard: '#ff8a3d' };
  var KR = { moth: '#ff55ff', dart: '#ffffff', turret: '#aa5500', walker: '#ffff55', mine: '#aaaaaa', stinger: '#ffff55', pod: '#ffffff', guard: '#ff5555' };
  function visual(type, d) {
    if (!game) return;
    var S = game.state(), retro = g.themeName === 'retro', sz = retro ? 4 : 3, P = rnd().P, x = (d.x || 0) - S.cx, y = d.y || 0;
    switch (type) {
      case 'kill': { var c = (retro ? KR : KC)[d.type] || '#fff'; g.particles.spawn(x, y, { color: c, count: 10, speed: 90, life: 0.45, size: sz }); ring(x, y, c, 14, 0.3); break; }
      case 'burn': g.particles.spawn(x, y, { color: '#ffb05a', count: 3, speed: 50, life: 0.3, size: 2 }); break;
      case 'absorb': g.particles.spawn(x, y, { color: '#fff3c8', count: 3, speed: 40, life: 0.2, size: 2 }); break;
      case 'clang': case 'ricochet': case 'wallHit': g.particles.spawn(x, y, { color: retro ? '#aaaaaa' : '#c3cad3', count: 3, speed: 50, life: 0.2, size: 2 }); break;
      case 'bossHit': case 'partHit': g.particles.spawn(x, y, { color: '#ffd27a', count: 6, speed: 80, life: 0.3, size: sz }); break;
      case 'partDie': g.particles.spawn(x, y, { color: '#ff6a2a', count: 24, speed: 140, life: 0.7, size: sz }); ring(x, y, '#ff6a2a', 40, 0.6); toast('+800', P.accent, x, y - 10); break;
      case 'guardDie': g.particles.spawn(x, y, { color: '#ff6a2a', count: 36, speed: 170, life: 0.9, size: sz }); ring(x, y, '#ff8a3d', 60, 0.7); toast('+2000', P.accent, x, y - 20); break;
      case 'bossDie': g.particles.spawn(x, y, { color: '#ff6a2a', count: 60, speed: 240, life: 1.3, size: sz + 1 }); g.particles.spawn(x, y, { color: '#fff3c8', count: 30, speed: 140, life: 1, size: sz }); ring(x, y, '#ff6a2a', 110, 1); toast('+' + d.pts, P.accent, x, y - 30); break;
      case 'playerHit': g.particles.spawn(x, y, { color: P.accent, count: 26, speed: 140, life: 0.8, size: sz }); ring(x, y, '#ff5d3a', 40, 0.6); break;
      case 'pickup': { var cap = game.state(); toast(g.t('cap_' + d.type), Sp.ui.CAPCOL[d.type], cap.ship.x - cap.cx, cap.ship.y - 20); break; }
      case 'beam': ring(x + 20, y, '#9fe6ff', 10 + d.c * 14, 0.25); break;
      case 'checkpoint': toast(g.t('cp'), P.good, L.W / 2, 70); break;
      case 'life': toast(g.t('extra'), P.good, L.W / 2, 90); break;
      case 'droneAttach': { var D = S.drone; ring(D.x - S.cx, D.y, '#ffb05a', 16, 0.3); break; }
    }
  }
  function onEvent(type, d) {
    Sp.sfx(g, type, d); visual(type, d || {});
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') { g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play' && game && game.state().over) g.gameover(); }, 1200); }
  }
  function newGame() {
    game = Sp.Game({ lives: 3, level: 1, difficulty: diff, onEvent: onEvent });
    game.start(); Sp.current = game; toasts = []; fx = []; sync();
  }

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: 3 });
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this, null); };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- Титул: демо-полёт «играет сам» ----------
  var demo = null, demoSeed = 3, demoLv = [1, 2, 3, 4, 5, 6], nextTap = 0, tapOn = false;
  function makeDemo() {
    var s = demoSeed++, rng = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    demo = Sp.Game({ level: demoLv[demoSeed % demoLv.length], maxLevel: 99, lives: 99, rng: rng }).start();
    demo._pickup(['R', 'S', 'V'][demoSeed % 3]); demo._pickup('O');
  }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(), sh = S.ship, look = sh.x + 60, ty = (demo._ceilY(look) + demo._floorY(look)) / 2, tgt = null;
    S.enemies.forEach(function (e) { if (e.alive && e.x > sh.x + 20 && e.x - S.cx < L.W && (!tgt || e.x < tgt.x)) tgt = e; });
    if (S.boss && S.boss.alive) tgt = S.boss.weak;
    if (tgt) ty = ty * 0.4 + tgt.y * 0.6;
    var tx = S.cx + 110;
    demo.setDir(Math.abs(tx - sh.x) < 4 ? 0 : tx - sh.x, Math.abs(ty - sh.y) < 4 ? 0 : ty - sh.y);
    if (S.time > nextTap) { tapOn = !tapOn; demo.setFire(tapOn); nextTap = S.time + (tapOn ? 0.05 : 0.1); }
    demo.update(dt);
    if (S.over || S.time > 30 || S.phase === 'clear' || S.deaths > 0) makeDemo();
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H;
    r.draw(ctx, demo.state(), this, { bare: true, game: demo });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.72)' : 'rgba(5,6,15,.66)'; ctx.fillRect(0, 0, W, H);
    var pw = 400, ph = 286, px = (W - pw) / 2, py = 38;
    Sp.ui.panel(this, ctx, px, py, pw, ph, retro ? P.hudLine : '#3a2f48', P);
    Sp.ui.txt(this, this.t('title'), W / 2, py + 50, { size: retro ? 40 : 44, align: 'center', color: P.accent, weight: 900 }, P);
    // корабль и дрон под заголовком
    var t = this.time;
    r.ship(ctx, W / 2 - 18, py + 76, t, {});
    r.drone(ctx, W / 2 + 6 + Math.sin(t * 2) * 2, py + 76, t, { spin: t * 3 });
    Sp.ui.txt(this, this.t('subtitle'), W / 2, py + 108, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, P);
    menu.draw(this, W / 2, py + 142, 28);
    if (this.state.best) Sp.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 11, align: 'center', color: th.muted, weight: 600 }, P);
    Sp.ui.txt(this, this.t('hint'), W / 2, H - 12, { size: retro ? 9 : 10, align: 'center', color: th.muted, weight: 600 }, P);
  };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var dir = this.input.dir;
      game.setDir(dir.x, dir.y);
      game.setFire((this.input.pressed('action') || extraFire) && g.time - playSince > 0.12);
      game.update(Math.min(dt, 1 / 30));
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      for (i = 0; i < fx.length; i++) fx[i].t -= dt;
      fx = fx.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) rnd().draw(ctx, game.state(), this, { toasts: toasts, fx: fx, game: game }); else this.clear(); }
  });

  // ---------- Доп. клавиши: Z/J — огонь, X/K/Shift — дрон ----------
  var FIRE = { KeyZ: 1, KeyJ: 1 }, DRONE = { KeyX: 1, KeyK: 1, ShiftLeft: 1, ShiftRight: 1 }, held = {};
  addEventListener('keydown', function (e) {
    if (FIRE[e.code]) { held[e.code] = true; extraFire = true; if (g._sceneName === 'play') e.preventDefault(); }
    if (DRONE[e.code] && !e.repeat) { if (g._sceneName === 'play') { e.preventDefault(); droneAct(); } }
  });
  addEventListener('keyup', function (e) { if (FIRE[e.code]) { held[e.code] = false; extraFire = !!(held.KeyZ || held.KeyJ); } });
  addEventListener('blur', function () { held = {}; extraFire = false; });

  g.start('title');
  Sp.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
