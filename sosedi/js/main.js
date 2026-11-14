/* СОСЕДИ · сборка: фреймворк Гефест Arcade (engine.js) + уровни (levels.js) + логика (game.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; кооп 1–2 игрока — g.usePlayers (пункт «Игроки», клавиши 1/2,
   подсказка раскладок). Камера — по середине между героями (логика не даёт им разойтись дальше кадра).
   Тач (только И1): дпад, ● бросок (держать — очередь), ⇄ сменить оружие, II пауза. Рекорд — arcade.best.sosedi (движок). */
(function (global) {
  'use strict';
  var SO = global.SOSEDI, L = SO.logic, LV = SO.levels, R = SO.R, VW = R.VW, VH = R.VH, HUD = R.HUD, TS = LV.TS;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#1b1612', panel: '#241d18', ink: '#f6efe4', muted: '#b3a796', accent: '#ffb547', grid: '#3a2e24', good: '#7bd389', bad: '#ff6b5a', warn: '#ffd166' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', ink: '#f8f8f8', muted: '#b0b0b0', accent: '#f8d030', good: '#58f858', bad: '#f85858', warn: '#f8d030' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'sosedi', strings: SO.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  SO.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  function retro() { return g.themeName === 'retro'; }

  g.useStandardScreens({ lives: L.K.LIVES });
  g.usePlayers({
    bind: {
      p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], fire: ['Space', 'Slash', 'ControlRight'], swap: ['Comma', 'Period', 'ShiftRight'] },
      p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], fire: ['KeyF', 'ShiftLeft'], swap: ['KeyG', 'KeyQ'] }
    },
    actions: ['fire', 'swap'], pad: pad, touch: { L: 'left', R: 'right', U: 'up', D: 'down', A: 'fire' },
    hint: { ru: [SO.STR.ru.hint1, SO.STR.ru.hint2], en: [SO.STR.en.hint1, SO.STR.en.hint2] }
  });

  // ---------- игра, камера, всплывашки ----------
  var game = null, cam = { x: 0, y: 0 }, toasts = [], banner = null, shake = 0, endInfo = null;
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.level = s.level; g.state.lives = s.heroes.reduce(function (a, h) { return a + Math.max(0, h.lives); }, 0); }
  function toast(text, x, y, color, big) { toasts.push({ text: text, x: x, y: y, t: 1.3, color: color || '#fff', big: big }); if (toasts.length > 14) toasts.shift(); }
  function showBanner(title, lines, dur, color) { banner = { title: title, lines: lines || [], a: dur || 2, dur: dur || 2, color: color }; }
  function th() { return g.th(); }
  function burst(x, y, col, n, sp) { var sx = (x - cam.x) * R.Z, sy = (y - cam.y) * R.Z + HUD; g.particles.spawn(sx, sy, { color: col, count: n || 10, speed: sp || 90, life: 0.5, size: retro() ? 3 : 2 }); }

  function onEvent(type, d) {
    d = d || {};
    SO.sfx(g, type, d);
    var s = game ? S() : null, cp = R.C(), t = th();
    switch (type) {
      case 'level':
        R.invalidate(); toasts = []; cam.snap = true;
        g.setMusic(d.bonus ? Arcade.tracks['sosedi:bonus'] : d.boss ? Arcade.tracks['sosedi:boss'] : Arcade.tracks.sosedi);
        if (d.bonus) showBanner(g.t('bonusTitle'), [g.t('bonusGoal').replace('{n}', L.K.BONUS_T)], 2.6, '#ffd23f');
        else {
          var waitN = s.neighbors.filter(function (n) { return !n.secret; }).length;
          showBanner(d.n + '. ' + g.t('l' + d.n), [g.t('d_' + d.style), d.boss ? g.t('goalBoss') : g.t('goal').replace('{n}', waitN)], 2.4);
        }
        break;
      case 'bossIntro': setTimeout(function () { if (game && S().boss) showBanner(g.t('b_' + d.kind), [g.t('bs_' + d.kind)], 2.4, t.bad); }, 1700); break;
      case 'saved': toast(g.t('n_' + d.type) + ' — ' + g.t('saved'), d.x, d.y - 26, t.good, true); toast('+' + d.pts + (d.bonus ? '  +1' : ''), d.x, d.y - 12, '#ffd23f'); burst(d.x, d.y - 8, '#ffd23f', 14, 110); break;
      case 'lost': toast(g.t('n_' + d.type) + ' — ' + g.t('lost'), d.x, d.y - 26, t.bad, true); burst(d.x, d.y - 8, '#c9a0ff', 16, 120); shake = 0.25; break;
      case 'grab': toast(g.t('grab'), d.x, d.y - 36, t.bad, false); break;
      case 'kill': toast('+' + d.pts, d.x, d.y - 12, '#fff'); burst(d.x, d.y, d.how === 'bubble' ? '#a8e8f8' : (d.type === 'bear' ? '#9a6236' : cp.tin), d.type === 'bear' ? 18 : 10, 100); break;
      case 'hit': if (d.how === 'water') burst(d.x, d.y, cp.water, 3, 50); break;
      case 'pickup': toast(g.t('k_' + d.kind), d.x, d.y - 14, d.kind === 'ticket' ? '#ffd23f' : t.ink, d.kind === 'ticket' || d.kind === 'bag'); burst(d.x, d.y, '#ffe08a', 8, 60); break;
      case 'door': toast(g.t('door'), d.x, d.y - 12, t.good); R.invalidate(); break;
      case 'nokey': toast(g.t('nokey'), d.x, d.y - 12, t.warn); break;
      case 'crack': toast(g.t('crack'), d.x, d.y - 16, '#ffd23f', true); R.invalidate(); shake = 0.2; break;
      case 'boom': shake = Math.max(shake, 0.15); break;
      case 'exitOpen': toast(g.t('exitOpen'), cam.x + VW / R.Z / 2, cam.y + 50, t.good, true); break;
      case 'portal': burst(d.fx, d.fy, '#a8743a', 14, 90); burst(d.x, d.y, '#ffe08a', 14, 90); toast(g.t('portal'), d.x, d.y - 26, '#ffd23f', true); cam.snap = true; break;
      case 'noAmmo': if (s) { var h = s.heroes[d.pi]; toast(g.t('noAmmo'), h.x, h.y - 26, t.muted); } break;
      case 'block': toast(g.t('block'), d.x, d.y - 26, '#f04878'); break;
      case 'hurt': burst(d.x, d.y - 6, t.bad, 8, 80); shake = Math.max(shake, 0.18); break;
      case 'die': burst(d.x, d.y - 6, '#ffd23f', 22, 130); shake = 0.35; break;
      case 'life': toast(g.t('life'), d.x, d.y - 30, t.good, true); break;
      case 'bossHit': if (Math.random() < 0.3) burst(d.x, d.y - 10, cp.tin, 3, 70); break;
      case 'bossDie': burst(d.x, d.y - 10, '#ffd23f', 50, 220); burst(d.x, d.y - 10, cp.tin, 40, 180); shake = 0.8; toast('+5000', d.x, d.y - 40, '#ffd23f', true); break;
      case 'thud': shake = 0.3; break;
      case 'drum': if (d.big) shake = 0.25; break;
      case 'spawnerDie': burst(d.x, d.y, cp.box, 20, 120); toast('+500', d.x, d.y - 16, '#ffd23f'); break;
      case 'clear':
        var ls = [g.t('cSaved') + ': ' + d.saved + '   ' + g.t('cLost') + ': ' + d.lost + '   ' + g.t('cBonus') + ' +' + d.bonus];
        if (d.perfect) ls.push(g.t('perfect')); if (d.moved) ls.push(g.t('moved')); if (d.ticket) ls.push(g.t('ticketNext'));
        showBanner(g.t('clear'), ls, 2.4, t.good); break;
      case 'bonusEnd': showBanner(g.t('bonusEnd'), [g.t('bonusGot') + ': ' + d.saved], 2.4, '#ffd23f'); break;
      case 'gameover': endInfo = { why: d.why, level: s.level, saved: s.savedTotal }; setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') { sync(); g.gameover(); } }, 1400); break;
      case 'win': endInfo = { why: null, level: s.level, saved: s.savedTotal }; setTimeout(function () { if (g._sceneName === 'play') { sync(); g.win(); } }, 600); break;
    }
    sync();
  }
  function newGame() {
    game = SO.Game({ players: g.input.playerCount, onEvent: onEvent, seed: (Date.now() & 0xffff) + 1 });
    SO.current = game; toasts = []; banner = null; endInfo = null; game.start(); sync();
  }
  [0, 1].forEach(function (pi) {
    g.input.player(pi).onPress(function (name) { if (game && name === 'swap') game.swap(pi, 1); });
  });

  // ---------- камера ----------
  function updCam(dt) {
    var s = S(), M = game.level(), hs = s.heroes.filter(function (h) { return !h.out; });
    if (!hs.length) return;
    var mx = 0, my = 0; hs.forEach(function (h) { mx += h.x; my += h.y; }); mx /= hs.length; my /= hs.length;
    var vw = VW / R.Z, vh = (VH - HUD) / R.Z, tx = Math.max(0, Math.min(M.w * TS - vw, mx - vw / 2)), ty = Math.max(0, Math.min(M.h * TS - vh, my - vh / 2));
    if (cam.snap) { cam.x = tx; cam.y = ty; cam.snap = false; }
    else { var k = Math.min(1, dt * 6); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; }
  }
  function drawPlay(ctx, t) {
    var s = S(), M = game.level(), c2 = cam;
    if (shake > 0) c2 = { x: cam.x + (Math.random() - 0.5) * 6 * Math.min(1, shake * 3), y: cam.y + (Math.random() - 0.5) * 6 * Math.min(1, shake * 3) };
    R.setRetro(retro());
    ctx.fillStyle = th().bg; ctx.fillRect(0, 0, VW, VH);
    R.world(ctx, s, M, c2, t);
    // всплывающие надписи
    toasts.forEach(function (o) {
      var a = Math.min(1, o.t / 0.4), x = (o.x - c2.x) * R.Z, y = (o.y - c2.y) * R.Z + HUD - (1.3 - o.t) * 18;
      ctx.globalAlpha = a; R.txt(ctx, o.text, x, y, { size: o.big ? 12 : 10, align: 'center', color: o.color, stroke: retro() ? '#000' : 'rgba(0,0,0,.75)', lw: 3, w: 900 }); ctx.globalAlpha = 1;
    });
    R.hud(g, ctx, s, M);
    if (banner) {
      var k = Math.min(1, banner.a / 0.3, (banner.dur - banner.a) / 0.2 + 0.2), bh = 40 + banner.lines.length * 18, by = HUD + 60;
      ctx.globalAlpha = Math.max(0, k);
      R.rrect(ctx, VW / 2 - 230, by, 460, bh, 10, retro() ? '#000' : 'rgba(20,14,10,.82)');
      if (retro()) { ctx.strokeStyle = th().accent; ctx.lineWidth = 2; ctx.strokeRect(VW / 2 - 230, by, 460, bh); }
      R.txt(ctx, banner.title, VW / 2, by + 26, { size: 20, align: 'center', color: banner.color || th().accent, w: 900 });
      banner.lines.forEach(function (l, i) { R.txt(ctx, l, VW / 2, by + 48 + i * 18, { size: 12, align: 'center', color: th().ink, w: 700 }); });
      ctx.globalAlpha = 1;
    }
  }

  // ---------- титул: двор с соседями и игрушками ----------
  var demo = null, demoT = 0;
  function makeDemo() {
    demo = SO.Game({ players: 2, rng: L.mulberry32(7), seed: 7 }).start();
    demo._load(1); var s = demo.state(); s.toys = []; s.pickups = []; s.spawners.forEach(function (q) { q.t = 1e9; });
    var M = demo.level(), sx = M.start.x * TS, sy = M.start.y * TS;
    s.heroes[0].x = sx - 50; s.heroes[0].y = sy + 70; s.heroes[1].x = sx + 50; s.heroes[1].y = sy + 74;
    var types = ['clown', 'goose', 'bear', 'top', 'puppet', 'mouse', 'clown', 'goose'];
    types.forEach(function (ty, i) { demo._spawnToy(ty, sx - 220 + i * 62, sy + 130 + (i % 2) * 18); });
    var nbs = ['granny', 'postman', 'twins', 'fisher', 'teacher', 'fireman', 'baker', 'gardener'];
    s.neighbors = nbs.map(function (ty, i) { return { id: 900 + i, type: ty, x: sx - 230 + i * 66, y: sy - 120 + (i % 2) * 14, state: 'wait', t: i, panic: 0, grab: 0 }; });
  }
  var title = g.scenes.title, tmenu = title._menu;
  title.update = function (dt) {
    demoT += Math.min(dt, 0.05);
    if (!demo) return; var s = demo.state();
    s.toys.forEach(function (o, i) { o.t += dt; o.x += Math.sin(demoT * 0.7 + i) * 0.3; o.flash = 0; });
    s.neighbors.forEach(function (n, i) { n.t += dt; n.panic = (Math.floor(demoT + i) % 5) === 0 ? 1 : 0; });
    s.heroes.forEach(function (h, i) { h.moving = true; h.walkT = demoT; h.fx = Math.cos(demoT * 0.6 + i * 3); h.fy = Math.sin(demoT * 0.6 + i * 3); h.inv = 0; h.out = i >= g.input.playerCount; });
  };
  title.draw = function (ctx) {
    if (!demo) makeDemo();
    var rt = retro(), t = th(), s = demo.state(), M = demo.level(); R.setRetro(rt);
    var c0 = { x: M.start.x * TS - VW / R.Z / 2, y: M.start.y * TS - (VH - HUD) / R.Z / 2 };
    R.world(ctx, s, M, c0, demoT);
    ctx.fillStyle = rt ? 'rgba(0,0,0,.55)' : 'rgba(20,14,10,.5)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = rt ? '#000' : '#1b1612'; ctx.fillRect(0, 0, VW, HUD);
    var pw = 380, ph = 262, px = (VW - pw) / 2, py = 40;
    R.rrect(ctx, px, py, pw, ph, 14, rt ? '#000' : 'rgba(27,22,18,.92)');
    ctx.strokeStyle = t.accent; ctx.lineWidth = 2; if (rt) ctx.strokeRect(px, py, pw, ph); else { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, 14) : ctx.rect(px, py, pw, ph); ctx.stroke(); }
    var tt = this.t('title');
    ctx.save(); ctx.textAlign = 'center'; ctx.font = rt ? 'bold 50px "Courier New", monospace' : '900 56px Inter, system-ui, sans-serif';
    if (rt) { ctx.fillStyle = '#f04878'; ctx.fillText(tt, VW / 2 + 3, py + 59); ctx.fillStyle = '#f8d030'; ctx.fillText(tt, VW / 2, py + 56); }
    else { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(tt, VW / 2 + 3, py + 59); var gr = ctx.createLinearGradient(0, py + 18, 0, py + 62); gr.addColorStop(0, '#fff2b8'); gr.addColorStop(0.55, '#ffb547'); gr.addColorStop(1, '#e2672f'); ctx.fillStyle = gr; ctx.fillText(tt, VW / 2, py + 56); }
    ctx.restore();
    R.txt(ctx, this.t('subtitle'), VW / 2, py + 78, { size: 11, align: 'center', color: t.ink, w: 700 });
    R.txt(ctx, this.t('sub2'), VW / 2, py + 94, { size: 10, align: 'center', color: t.muted, w: 600 });
    tmenu.draw(this, VW / 2, py + 128, 28);
    if (this.state.best) R.txt(ctx, this.t('best') + ': ' + this.state.best, VW / 2, py + ph - 8, { size: 11, align: 'center', color: t.muted, w: 700 });
    ctx.fillStyle = rt ? '#000' : 'rgba(20,14,10,.85)'; ctx.fillRect(0, VH - 90, VW, 50);
    this.menu._drawHint('title');
  };

  // ---------- финалы и пауза ----------
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); }, onSelect: function () { g.goto('play'); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name];
    sc.draw = function (ctx) {
      if (game) drawPlay(ctx, this.time); else this.clear();
      this.overlay(this.t(name), this.t('score') + ': ' + (this.state.score | 0) + (this.state.best ? '   ' + this.t('best') + ': ' + this.state.best : ''), name === 'win' ? this.th().good : this.th().bad);
      if (endInfo) {
        var y = this.H / 2 + 40;
        if (endInfo.why) R.txt(ctx, this.t('why_' + endInfo.why), this.W / 2, y, { size: 13, align: 'center', color: this.th().ink, w: 700 });
        R.txt(ctx, this.t('reached') + ': ' + endInfo.level + '/20 · ' + this.t('savedTotal') + ': ' + endInfo.saved, this.W / 2, y + 20, { size: 12, align: 'center', color: this.th().muted, w: 700 });
      }
      R.txt(ctx, this.t('tapstart'), this.W / 2, this.H - 24, { size: 12, align: 'center', color: this.th().muted, w: 600 });
    };
  });

  // ---------- игровая сцена ----------
  var playSince = 0;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) { newGame(); cam.snap = true; } playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var live = g.time - playSince > 0.12, s = S();
      for (var pi = 0; pi < s.heroes.length; pi++) {
        var P = g.input.player(pi), dir = P.dir;
        game.setInput(pi, { x: dir.x, y: dir.y, fire: live && P.pressed('fire') });
      }
      game.update(Math.min(dt, 0.05));
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      if (shake > 0) shake -= dt;
      toasts.forEach(function (o) { o.t -= dt; }); toasts = toasts.filter(function (o) { return o.t > 0; });
      updCam(dt); sync();
    },
    draw: function (ctx) { if (!game) { this.clear(); return; } drawPlay(ctx, this.time); }
  });

  // ---------- тач-кнопка «сменить» ----------
  (function () {
    var b = document.getElementById('bSwap');
    if (b) { var h = function (e) { e.preventDefault(); if (game && g._sceneName === 'play') game.swap(0, 1); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  })();

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, pd = document.querySelector('.pad');
    var padFixed = pd && getComputedStyle(pd).position === 'fixed';
    var padH = pd && !padFixed && getComputedStyle(pd).display !== 'none' ? pd.offsetHeight + 16 : 0;
    var w = Math.min(1120, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); R.invalidate(); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  SO.app = { g: g, game: function () { return game; }, cam: cam, newGame: newGame };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
