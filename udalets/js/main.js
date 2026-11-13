/* УДАЛЕЦ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js, levels.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован, в паузе — «Заново уровень».
   Ввод: ←→/AD — ходить; ↑/W/Пробел/Z — прыжок; X/K/Ctrl — выстрел; Shift/C — ранец вкл/выкл (в полёте — стрелки);
   тач: дпад, ● — прыжок, ✷ — выстрел, ⇡ — ранец, II — пауза. */
(function (global) {
  'use strict';
  var U = global.UDALETS, L = U.logic, R = U.R, T = L.T, HUD = R.HUD;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120d0b', panel: '#1a1411', ink: '#f4eee6', muted: '#a49a92', accent: '#ffc24a', grid: '#2e2622' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = L.COLS * T, H = HUD + L.ROWS * T;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'udalets', strings: U.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  U.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  var game = null, toasts = [], banner = null, playSince = 0, extraJump = false;
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.level; }
  function scr(x, y) { var B = L.roomBox(S().LV, S().room); return { x: (x - B.x0) * T, y: HUD + (y - B.y0) * T }; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (Math.abs(toasts[i].y - y) < 0.7 && toasts[i].t > toasts[i].life - 0.6) y -= 0.8;
    var life = big ? 2.2 : 1.3; toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big });
  }
  function P() { return g.themeName === 'retro' ? R.PR : R.PM; }
  function lvName(n) { return g.t('lv' + n); }
  function showBanner(title, sub, dur) { banner = { title: title, sub: sub, a: dur || 2.4 }; }
  function burst(x, y, color, n, sp) { var p = scr(x, y); g.particles.spawn(p.x, p.y, { color: color, count: n || 14, speed: sp || 110, life: 0.6, size: g.themeName === 'retro' ? 4 : 3 }); }

  var GEMC = { '.': '#d9b25a', g: '#3fdc7a', b: '#3f8cff', R: '#ff3d5a' };
  function onEvent(type, d) {
    d = d || {};
    U.sfx(g, type, d);
    var C = P(), s = game ? S() : null;
    switch (type) {
      case 'level': toasts = []; showBanner(g.t('level') + ' ' + d.level + ' · ' + lvName(d.level), g.t('intro')); break;
      case 'item':
        if (GEMC[d.k]) { toast('+' + d.pts, C.accent, d.x, d.y - 0.6); burst(d.x, d.y, GEMC[d.k], 10, 80); }
        else if (d.k === 'G') toast(g.t('gun'), C.good, d.x, d.y - 1, true);
        else if (d.k === 'A') toast(g.t('ammo'), C.good, d.x, d.y - 0.8);
        else if (d.k === 'J') toast(g.t('jet'), C.good, d.x, d.y - 1, true);
        else if (d.k === 'F') toast(g.t('fuel'), C.good, d.x, d.y - 0.8);
        else if (d.k === '+') { toast(g.t('life'), C.bad, d.x, d.y - 0.8, true); burst(d.x, d.y, '#ff5d6c', 18); }
        break;
      case 'cup': toast(g.t('cupGot'), C.accent, d.x, d.y - 1.2, true); burst(d.x, d.y, '#ffd25a', 30, 160); break;
      case 'kill': toast('+' + d.pts, C.accent, d.x, d.y - 0.8); burst(d.x, d.y, d.k === 'w' ? '#c98a3a' : d.k === 'v' ? '#9aa4b2' : '#ff8a3d', 18, 130); break;
      case 'die': burst(d.x, d.y - 0.7, '#ffd166', 34, 170); burst(d.x, d.y - 0.7, C.bad, 16, 90); break;
      case 'respawn': break;
      case 'empty': if (s) toast(g.t('empty'), C.bad, s.hero.x, s.hero.y - 2); break;
      case 'fuelOut': if (s) toast(g.t('fuelOut'), C.bad, s.hero.x, s.hero.y - 2); break;
      case 'life': if (s) toast(g.t('life'), C.bad, s.hero.x, s.hero.y - 2.2, true); break;
      case 'clear': showBanner(g.t('clear'), g.t('timeBonus') + ' +' + d.bonus, 1.6); break;
      case 'warp': toasts = []; showBanner(g.t('warp'), g.t('bonusTime') + ': ' + L.BONUS_TIME + ' ' + g.t('sec'), 2); break;
      case 'bonusEnd': toasts = []; showBanner(g.t('bonusEnd'), lvName(s.level), 1.4); break;
      case 'restart': toasts = []; showBanner(g.t('restarted'), g.t('level') + ' ' + s.level + ' · ' + lvName(s.level), 2); break;
      case 'room': toasts = toasts.filter(function (q) { return q.big; }); break;
      case 'win': sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 1500); break;
      case 'gameover': sync(); g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 900); break;
    }
    sync();
  }
  function newGame() { game = U.Game({ onEvent: onEvent }); toasts = []; game.start(); U.current = game; sync(); }
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }
  function fireAct() { if (inPlay()) game.fire(); }
  function jetAct() { if (inPlay()) game.jet(); }

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: L.LIVES });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (game) { game.restartLevel(); sync(); } if (game && game.state().over) g.gameover(); else g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      if (!game) return;
      var s = S(), Pc = P();
      if (name === 'win') R.cup(ctx, this.W / 2, this.H / 2 - 90, this.time, g.themeName === 'retro', 1.6);
      this.text(this.t('level') + ': ' + (s.won ? 10 : s.level) + '/10', this.W / 2, this.H / 2 + 46, { size: 13, align: 'center', color: Pc.muted, weight: 700 });
    };
  });

  // ---------- Титул ----------
  var title = g.scenes.title, menu = g.menu.get('title'), demoLV = L.build(U.LEVELS[0], 1);
  title.draw = function (ctx) {
    var isRetro = g.themeName === 'retro', Pc = P(), Wc = this.W, Hc = this.H, th = this.th();
    ctx.fillStyle = isRetro ? '#000' : '#120d0b'; ctx.fillRect(0, 0, Wc, Hc);
    ctx.drawImage(R.roomLayer(demoLV, 0, isRetro), 0, HUD);
    ctx.fillStyle = isRetro ? 'rgba(0,0,0,.72)' : 'rgba(10,7,6,.6)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 420, ph = 330, x0 = (Wc - pw) / 2, y0 = 30;
    if (isRetro) { ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, pw, ph); ctx.fillStyle = '#5555ff'; ctx.fillRect(x0, y0, pw, 3); ctx.fillRect(x0, y0 + ph - 3, pw, 3); ctx.fillRect(x0, y0, 3, ph); ctx.fillRect(x0 + pw - 3, y0, 3, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(26,20,17,.94)'; R.rr(ctx, x0, y0, pw, ph, 16); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#4a3a2e'; ctx.lineWidth = 1.5; R.rr(ctx, x0 + 0.75, y0 + 0.75, pw - 1.5, ph - 1.5, 16); ctx.stroke(); }
    var tt = this.t('title');
    this.text(isRetro ? tt : tt, Wc / 2, y0 + 58, { size: isRetro ? 44 : 50, align: 'center', color: Pc.accent, weight: 900, font: isRetro ? '"Courier New", monospace' : undefined });
    R.cup(ctx, Wc / 2 - (isRetro ? 150 : 160), y0 + 42, this.time, isRetro); R.cup(ctx, Wc / 2 + (isRetro ? 150 : 160), y0 + 42, this.time + 0.7, isRetro);
    this.text(this.t('subtitle'), Wc / 2, y0 + 86, { size: isRetro ? 11 : 13, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2, y0 + 105, { size: isRetro ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
    var HH = { x: 0, y: 0, vx: 0, vy: 0, face: 1, ground: true, walkT: this.time * 3, jet: false };
    R.hero(ctx, x0 + 50, y0 + ph - 30, HH, this.time, { retro: isRetro, gun: true, jetOwned: true });
    R.enemy(ctx, { k: 'f', dir: -1, cd: 1 }, x0 + pw - 52, y0 + ph - 80 + Math.sin(this.time * 2.6) * 6, this.time, isRetro);
    R.enemy(ctx, { k: 'w', dir: -1, cd: 1 }, x0 + pw - 50, y0 + ph - 30, this.time, isRetro);
    menu.draw(this, Wc / 2, y0 + 150, 30);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, Wc / 2, y0 + ph - 16, { size: 12, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), Wc / 2, Hc - 14, { size: isRetro ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (q) { return q.t > 0; });
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      var dir = this.input.dir, live = g.time - playSince > 0.15;
      var jump = live && (this.input.pressed('action') || this.input.pressed('up') || extraJump);
      game.setInput(dir.x, live ? dir.y : 0, jump);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      U.render(this, ctx, S(), { toasts: toasts, banner: banner });
    }
  });

  // ---------- Доп. клавиши и тач-кнопки ----------
  var JUMP = { KeyZ: 1, KeyJ: 1 }, FIRE = { KeyX: 1, KeyK: 1, ControlLeft: 1, ControlRight: 1, KeyF: 1 }, JET = { ShiftLeft: 1, ShiftRight: 1, KeyC: 1, KeyV: 1 }, held = {};
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extraJump = true; if (ip) e.preventDefault(); }
    if (FIRE[e.code] && ip) { e.preventDefault(); if (!e.repeat) fireAct(); }
    if (JET[e.code] && ip && !e.repeat) { e.preventDefault(); jetAct(); }
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extraJump = !!(held.KeyZ || held.KeyJ); } });
  addEventListener('blur', function () { held = {}; extraJump = false; });
  function tap(id, fn) {
    var b = document.getElementById(id); if (!b) return;
    var h = function (e) { e.preventDefault(); fn(); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  }
  tap('bFire', fireAct); tap('bJet', jetAct);
  tap('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, pad = document.querySelector('.pad');
    var padFixed = pad && getComputedStyle(pad).position === 'fixed';
    var padH = pad && !padFixed && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var w = Math.min(1000, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  U.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
