/* ТАЙНИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js)
   + рендеры retro/modern + звук. Сцены title/pause/win/gameover — g.useStandardScreens,
   титул переопределён: живая башня (камера плывёт по ярусу) + меню движка.
   Ввод: стрелки/WASD (зажатие), пробел / Z / X — выстрел, тач-крестовина и кнопка огня (bindDpad). */
(function (global) {
  'use strict';
  var K = global.TAYNIK, L = K.logic;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0b0d12', panel: '#141a22', ink: '#eef2f8', muted: '#8d98a8', accent: '#ff8a3d', grid: '#232a35' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#fc9838', muted: '#a4a4a4' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'taynik', strings: K.STR, theme: 'modern', lives: 3, themes: themes });
  K.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  K.ui.init(g);

  function rnd() { return g.themeName === 'retro' ? K.classic : K.modern; }
  var game = null, toasts = [], parts = [], playSince = 0;

  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 1.0 && Math.abs(toasts[i].y - y) < 14 && Math.abs(toasts[i].x - x) < 80) y -= 16;
    toasts.push({ text: text, color: color, x: x, y: y, t: 1.4 });
  }
  function burst(x, y, color, n, speed, life) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, t: life, life: life, color: color, size: 2 + Math.random() * 1.5 });
    }
  }
  var ECOL = { spider: '#d9783a', spark: '#ffd36b', ghost: '#e1eefa', cham: '#46c2a2' };
  function onEvent(type, d) {
    K.sfx(g, type, d);
    var P = rnd().P;
    switch (type) {
      case 'kill': burst(d.x, d.y, ECOL[d.type] || '#fff', 14, 110, 0.6); toast('+' + d.pts, P.accent, d.x, d.y - 12); break;
      case 'hit': burst(d.x, d.y, ECOL[d.type] || '#fff', 6, 70, 0.35); break;
      case 'spark': burst(d.x, d.y, '#9fd8ff', 4, 50, 0.25); break;
      case 'treasure': burst(d.x, d.y, d.type === 'gem' ? '#9ff3ff' : '#ffd36b', 10, 80, 0.5); toast(g.t('t_' + d.type) + ' +' + d.pts, d.type === 'gem' ? '#9ff3ff' : P.warn, d.x, d.y - 10); break;
      case 'ammo': toast(g.t('t_ammo') + ' ' + d.ammo, '#9fd8ff', d.x, d.y - 10); break;
      case 'oil': burst(d.x, d.y, '#ff8a6a', 8, 60, 0.5); toast(g.t('t_oil') + ' +35', P.good, d.x, d.y - 10); break;
      case 'map': toast(g.t('t_map'), P.accent, d.x, d.y - 10); break;
      case 'lamp': burst(d.x, d.y, '#ffe08a', 14, 90, 0.6); toast(g.t('t_lamp') + ' +' + L.PTS.lamp, P.warn, d.x, d.y - 8); break;
      case 'reveal': toast(g.t('t_reveal'), P.bad, d.x, d.y - 14); break;
      case 'empty': if (game) toast(g.t('t_empty'), P.bad, game.state().hero.x, game.state().hero.y - 26); break;
      case 'hurt': burst(d.x, d.y, '#ff5d6c', 8, 80, 0.4); break;
      case 'die': burst(d.x, d.y, d.reason === 'acid' ? '#8cff6a' : '#ffb03a', 22, 130, 0.8); break;
      case 'extra': if (game) toast(g.t('t_extra'), P.good, game.state().hero.x, game.state().hero.y - 30); break;
      case 'level': toasts = []; parts = []; break;
    }
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }
  function newGame() {
    game = K.Game({ lives: 3, level: 1, onEvent: onEvent });
    game.start(); K.current = game; toasts = []; parts = []; sync();
  }

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: 3 });
  var pauseSc = g.scenes.pause, basePress = pauseSc.press;
  pauseSc.press = function (a) { if (a === 'pause') { this.goto('play', { resume: true }); return; } if (basePress) basePress.call(this, a); };

  // ---------- Титул: камера плывёт по ярусу башни ----------
  var demo = null;
  function makeDemo() {
    var seed = 20261113;
    var r = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    demo = K.Game({ level: 3, rng: r }).start().state();
  }
  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) {
    if (!demo) makeDemo();
    demo.time += dt;
    var lv = demo.lv, k = demo.time * 0.05;
    demo.cam.x = (lv.pw - L.VW) * (0.5 + 0.5 * Math.sin(k));
    demo.cam.y = (lv.ph - L.VH) * (0.5 + 0.5 * Math.sin(k * 1.7 + 1));
  };
  title.draw = function (ctx) {
    if (!demo) makeDemo();
    var th = this.th(), r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H;
    K.ui.frame(this, ctx, demo, r, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.45)' : 'rgba(8,10,14,.32)'; ctx.fillRect(0, 0, W, H);
    var pw = 400, ph = 300, px = (W - pw) / 2, py = 30;
    K.ui.box(ctx, P, px, py, pw, ph, retro ? P.hudLine : '#2c3644', 18);
    K.ui.txt(this, this.t('title'), W / 2, py + 58, { size: retro ? 40 : 44, align: 'center', color: P.accent, weight: 900 }, P);
    var hy = py + 102, hh = { x: W / 2 - 40, y: hy, vx: 0, mode: 'ground', face: 1 };
    ctx.save(); ctx.translate(hh.x, hy); ctx.scale(2, 2); ctx.translate(-hh.x, -hy); r.hero(ctx, hh, g.time); ctx.restore();
    var R = { x: W / 2 + 40, top: hy - 34, bot: hy - 6, kind: 'link' };
    if (retro) { ctx.fillStyle = '#fcd8a8'; ctx.fillRect(R.x - 1, R.top, 2, R.bot - R.top); }
    else { ctx.strokeStyle = P.rope; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(R.x, R.top); ctx.lineTo(R.x, R.bot); ctx.stroke(); }
    var hc = { x: R.x, y: hy - 4, vx: 0, mode: 'rope', face: 1 };
    ctx.save(); ctx.translate(hc.x, hc.y); ctx.scale(1.4, 1.4); ctx.translate(-hc.x, -hc.y); r.hero(ctx, hc, g.time); ctx.restore();
    K.ui.txt(this, this.t('subtitle'), W / 2, py + 126, { size: retro ? 9 : 10, align: 'center', color: th.muted, weight: 600 }, P);
    menu.draw(this, W / 2, py + 164, 30);
    if (this.state.best) K.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    K.ui.txt(this, this.t('hint'), W / 2, H - 16, { size: 10, align: 'center', color: th.muted, weight: 600 }, P);
  };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return;
      if (a === 'pause') { this.pause(); return; }
      if (a === 'action' && g.time - playSince > 0.12) game.fire();
    },
    update: function (dt) {
      if (!game) return;
      var inp = this.input, live = g.time - playSince > 0.12;
      game.setInput(live ? { l: inp.pressed('left'), r: inp.pressed('right'), u: inp.pressed('up'), d: inp.pressed('down') } : {});
      game.update(dt);
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      for (i = 0; i < parts.length; i++) { var p = parts[i]; p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
      parts = parts.filter(function (p) { return p.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) K.ui.frame(this, ctx, game.state(), rnd(), { toasts: toasts, fx: parts }); else this.clear(); }
  });

  // Z / X — тоже выстрел (пробел — действие движка)
  addEventListener('keydown', function (e) {
    if ((e.code === 'KeyZ' || e.code === 'KeyX') && g._sceneName === 'play' && game && !e.repeat) { e.preventDefault(); game.fire(); }
  });

  g.start('title');
  K.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
