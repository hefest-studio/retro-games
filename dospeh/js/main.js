/* ДОСПЕХ · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens (титул и финалы перерисованы). Сцена play: уровни, «Продолжить?»,
   экран конца первого круга, второй круг.
   Ввод: ←→/AD — ход; Пробел/Z/K — прыжок; ↑/W, ↓/S — лестница, ↓ — присед; X/J/Ctrl — бросок (в золотом доспехе держи — особый удар);
   тач: дпад, ● прыжок, ✦ бросок, II пауза. */
(function (global) {
  'use strict';
  var D = global.DOSPEH, L = D.logic, R = D.R, FX = D.fx;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120c0e', panel: '#1f1517', ink: '#f4ebe2', muted: '#b09a8c', accent: '#e8913a', good: '#8ad97a', bad: '#ff5a4a', warn: '#ffd34d', grid: '#33242a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ff8800', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: R.W, height: R.H, gameId: 'dospeh', strings: D.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  D.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  var game = null, ui = { toasts: [], banner: null, msg: null, shake: 0, contT: 0 }, playSince = 0, keys = { fire: false, jump: false }, pad = { fire: false };
  function S() { return game.state(); }
  function th() { return g.th(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.li + 1; }
  function toast(text, color, x, y, big) { ui.toasts.push({ text: text, color: color, x: x, y: y, t: big ? 1.8 : 1.1, big: !!big }); if (ui.toasts.length > 10) ui.toasts.shift(); }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.6 }; }

  function onEvent(type, d) {
    d = d || {};
    D.sfx(g, type, d);
    var s = game ? S() : null, t = th();
    switch (type) {
      case 'level':
        ui.toasts = []; FX.clear(); g.setMusic(D.MUSIC.stage);
        ui.banner = { title: g.t('lv_' + d.key), sub: (d.loop === 2 ? g.t('loop2') + ' · ' : '') + g.t('b_' + d.key), a: 2.4 };
        break;
      case 'loop2': ui.banner = { title: g.t('loopStart'), sub: g.t('lv_' + s.lv.key), a: 2.6 }; break;
      case 'bossIntro': g.setMusic(D.MUSIC.boss); ui.banner = { title: g.t('b_' + s.lv.key), sub: g.t('lv_' + s.lv.key), a: 1.6 }; break;
      case 'bossHit': FX.puff(d.x, d.y, '#ffe1a8', 4, 5, 0.25); break;
      case 'clink': toast(g.t('clink'), t.muted, d.x, d.y - 1.5); FX.puff(d.x, d.y, '#c8d0d8', 3, 4, 0.2); break;
      case 'bossDie': FX.puff(d.x, d.y, '#ffb35c', 40, 9, 1.2, true); FX.puff(d.x, d.y, '#ffffff', 16, 5, 0.6); ui.shake = 0.6; toast('+' + d.pts, t.accent, d.x, d.y - 1.5, true); break;
      case 'kill': FX.puff(d.x, d.y, d.type === 'kite' ? '#c8d4dc' : '#ff9a4a', 10, 6, 0.5, true); break;
      case 'hit': FX.puff(d.x, d.y, '#ffe1a8', 3, 4, 0.2); break;
      case 'armorOff': ui.shake = Math.max(ui.shake, 0.3); FX.puff(d.x, d.y, '#c8793a', 14, 7, 0.8, true); FX.puff(d.x, d.y, '#9aa0a8', 8, 5, 0.6, true); msg(g.t('armorOff'), t.bad, 1.2); break;
      case 'die': ui.shake = 0.4; FX.puff(d.x, d.y, '#e09a44', 26, 7, 1.0, true); FX.puff(d.x, d.y, '#efe6d2', 10, 4, 0.8, true); msg(g.t('d_' + d.why, ''), t.bad, 1.6); break;
      case 'pickup':
        if (d.k === 'arm') toast(g.t('armorUp'), t.good, d.x, d.y - 1.4, true);
        else if (d.k === 'gold') msg(g.t('goldUp'), t.warn, 2.4);
        else if (d.k === 'hammer') { msg(g.t('hammerGot'), t.warn, 2); FX.puff(d.x, d.y, '#ffd24a', 20, 6, 0.8); }
        else if (d.k.indexOf('w:') === 0) toast(g.t('w_' + d.k.slice(2)), t.ink, d.x, d.y - 1.4, true);
        break;
      case 'chest': FX.puff(d.x, d.y - 0.5, '#ffd24a', 10, 5, 0.5); toast('+' + L.PTS.chest, t.accent, d.x, d.y - 1.4); break;
      case 'trap': msg(g.t('trap'), t.bad, 1.2); break;
      case 'charged': if (s) toast(g.t('charged'), t.warn, s.hero.x, s.hero.y - 2.4); break;
      case 'special': ui.shake = Math.max(ui.shake, 0.25); FX.puff(d.x, d.y, '#ffd24a', 24, 9, 0.6); break;
      case 'life': msg(g.t('life'), t.good, 1.4); break;
      case 'checkpoint': toast(g.t('checkpoint'), t.muted, d.x, d.y - 2.4, true); break;
      case 'rise': FX.puff(d.x, d.y, '#8a5a3a', 6, 3, 0.6, true); break;
      case 'splash': FX.puff(d.x, L.R - 0.4, s && s.lv.liquid === 'lava' ? '#ffb040' : '#c4621e', 8, 5, 0.5, true); break;
      case 'stomp': ui.shake = Math.max(ui.shake, 0.2); break;
      case 'clear':
        if (d.final) { ui.banner = { title: g.t('b_forge'), sub: g.t('clear'), a: 3 }; }
        else ui.banner = { title: g.t('clear'), sub: d.bonus ? '+' + d.bonus + ' ' + g.t('bonus') : '', a: 3 };
        g.stopMusic && g.stopMusic();
        break;
      case 'loopEnd': g.stopMusic && g.stopMusic(); break;
      case 'continueQ': ui.contT = 9; g.stopMusic && g.stopMusic(); break;
      case 'continued': g.setMusic(D.MUSIC.stage); break;
      case 'win': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'won') g.win(); }, 2400); break;
      case 'gameover': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') g.gameover(); }, 900); break;
    }
    sync();
  }
  function newGame() {
    game = D.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1) });
    D.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear();
    game.start(); sync();
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: L.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var retro = g.themeName === 'retro';
      ctx.save(); ctx.translate(this.W / 2, this.H / 2 - 40); ctx.scale(2, 2); R.heroFig(ctx, 0, 0, 1, { armor: name === 'win' ? 2 : 0, t: this.time, throwT: name === 'win' ? 1 : 0 }, retro); ctx.restore();
      if (name === 'win') this.text(this.t('winText'), this.W / 2, this.H / 2 + 50, { size: 11, align: 'center', color: th().ink, weight: 700 });
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', Wc = this.W, Hc = this.H, t = this.time, Pc = th(), P = R.PAL.wastes;
    ctx.imageSmoothingEnabled = !retro;
    if (retro) { ctx.fillStyle = P.r.sky; ctx.fillRect(0, 0, Wc, Hc); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.65, P.sky[1]); gr.addColorStop(1, P.sky[2]); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    // кучи окалины и трубы
    ctx.fillStyle = retro ? P.r.far : P.far;
    for (var i = 0; i < 5; i++) { var x = i * 120 - 20; ctx.beginPath(); ctx.moveTo(x, Hc); ctx.lineTo(x + 40, Hc - 110 - (i % 2) * 20); ctx.lineTo(x + 70, Hc - 95); ctx.lineTo(x + 120, Hc); ctx.fill(); if (i % 2) { ctx.fillRect(x + 90, Hc - 170, 9, 120); ctx.fillRect(x + 86, Hc - 176, 17, 7); } }
    ctx.fillStyle = retro ? P.r.body : P.body; ctx.fillRect(0, Hc - 50, Wc, 50);
    ctx.fillStyle = retro ? P.r.top : P.top; ctx.fillRect(0, Hc - 50, Wc, 5);
    // витязь в доспехе с копьём
    ctx.save(); ctx.translate(92, Hc - 50); ctx.scale(2.6, 2.6);
    R.heroFig(ctx, 0, 0, 1, { armor: Math.floor(t / 3) % 2 ? 2 : 1, t: t, throwT: (t % 2) < 0.3 ? 1 : 0 }, retro);
    ctx.restore();
    R.weaponFig(ctx, 'spear', 92 + 26 + ((t % 2) < 0.3 ? (t % 2) * 300 : 0), Hc - 50 - 50, 2, 0, retro);
    this.text(this.t('title'), Wc / 2 + 60, 62, { size: retro ? 42 : 48, align: 'center', color: Pc.accent, weight: 900 });
    this.text(this.t('subtitle'), Wc / 2 + 60, 86, { size: retro ? 11 : 13, align: 'center', color: Pc.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2 + 60, 103, { size: retro ? 8 : 9, align: 'center', color: Pc.muted, weight: 600 });
    menu.draw(this, Wc / 2 + 60, 134, 24);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, Wc / 2 + 60, Hc - 62, { size: 11, align: 'center', color: Pc.warn, weight: 800 });
    this.text(this.t('hint'), Wc / 2, Hc - 14, { size: retro ? 8 : 9, align: 'center', color: retro ? '#ffffff' : '#f4ebe2', weight: 600 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return;
      var s = S();
      if (s.phase === 'cont') {
        if (a === 'action' || a === 'start') { game.continueGame(); playSince = g.time; }
        else if (a === 'pause') game.giveUp();
        return;
      }
      if (s.phase === 'loopEnd') { if (a === 'action' || a === 'start') game.skipLoopEnd(); else if (a === 'pause') this.pause(); return; }
      if (a === 'pause') this.pause();
    },
    update: function (dt) {
      if (!game) return;
      var s = S(), i;
      for (i = 0; i < ui.toasts.length; i++) { ui.toasts[i].t -= dt; ui.toasts[i].y -= dt * 0.6; }
      ui.toasts = ui.toasts.filter(function (q) { return q.t > 0; });
      if (ui.banner) { ui.banner.a -= dt; if (ui.banner.a <= 0) ui.banner = null; }
      if (ui.msg) { ui.msg.a -= dt; if (ui.msg.a <= 0) ui.msg = null; }
      if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt);
      FX.step(dt);
      if (s.phase === 'cont') { ui.contT -= dt; if (ui.contT <= 0) game.giveUp(); }
      var dir = this.input.dir, live = g.time - playSince > 0.18 && s.phase === 'play';
      game.setInput({
        dx: live ? dir.x : 0, up: live && dir.y < 0, down: live && dir.y > 0,
        jump: live && (this.input.pressed('action') || keys.jump),
        fire: live && (keys.fire || pad.fire)
      });
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      sync();
    },
    draw: function (ctx) { if (!game) { this.clear(); return; } D.render(g, ctx, S(), ui); }
  });

  // ---------- доп. клавиши ----------
  var FIRE = { KeyX: 1, KeyJ: 1, ControlLeft: 1, ControlRight: 1 }, JUMP = { KeyZ: 1, KeyK: 1 }, held = {};
  function recompute() { keys.fire = !!(held.KeyX || held.KeyJ || held.ControlLeft || held.ControlRight); keys.jump = !!(held.KeyZ || held.KeyK); }
  addEventListener('keydown', function (e) {
    if (FIRE[e.code] || JUMP[e.code]) { held[e.code] = true; recompute(); if (g._sceneName === 'play') e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { if (FIRE[e.code] || JUMP[e.code]) { held[e.code] = false; recompute(); } });
  addEventListener('blur', function () { held = {}; recompute(); pad.fire = false; });
  // тач-кнопки
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { e.preventDefault(); on(); b.classList.add('on'); }, h0 = function (e) { e.preventDefault(); off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) h0(new Event('x')); });
  }
  hold('bFire', function () { pad.fire = true; }, function () { pad.fire = false; });
  var bp = document.getElementById('bPause');
  if (bp) { var hp = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; bp.addEventListener('touchstart', hp, { passive: false }); bp.addEventListener('mousedown', hp); }

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, padEl = document.querySelector('.pad');
    var padFixed = padEl && getComputedStyle(padEl).position === 'fixed';
    var padH = padEl && !padFixed && getComputedStyle(padEl).display !== 'none' ? padEl.offsetHeight + 16 : 0;
    var w = Math.min(1100, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
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
  D.app = { g: g, game: function () { return game; }, ui: ui };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
