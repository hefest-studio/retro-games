/* ОРУЖЕЙНИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js, save.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован; в меню — «Ввести пароль» и «Сбросить прогресс»;
   своя сцена pass — ввод пароля. Сцена play: выбор цеха → этап → трофей → выбор… → Чёрная Домна.
   Ввод: ←→/AD — бег; Пробел/Z/K/↑/W — прыжок; X/J/Ctrl — выстрел (удерживать — заряд наруча); ↓+прыжок или C/Shift — подкат;
   Q/E — смена оружия, 1–9 — прямой выбор; F — фляга; тач: дпад, ● прыжок, ✦ огонь, ⤳ подкат, ⟳ оружие, ⚱ фляга, II пауза. */
(function (global) {
  'use strict';
  var OZ = global.ORUZH, L = OZ.logic, R = OZ.R;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0e0a08', panel: '#1d140f', ink: '#f6ece2', muted: '#b39a86', accent: '#ff9a3d', good: '#8ad97a', bad: '#ff5a4a', warn: '#ffd34d', grid: '#33241a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffaa00', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var W = R.W, H = R.H;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'oruzheynik', strings: OZ.STR, theme: 'modern', lives: L.LIVES, themes: themes });
  OZ.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var store = OZ.save.store(global.localStorage || { getItem: function () { return null; }, setItem: function () {} });

  var game = null, ui = { toasts: [], banner: null, msg: null, shake: 0, sel: 0, selMsg: '' }, playSince = 0, extra = { fire: false, jump: false, slide: false }, pad = { fire: false, slide: false };
  function S() { return game.state(); }
  function th() { return g.th(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = Math.max(1, s.stage + 1); }
  function toast(text, color, x, y, big) { ui.toasts.push({ text: text, color: color, x: x, y: y, t: big ? 1.8 : 1.1, big: !!big }); if (ui.toasts.length > 10) ui.toasts.shift(); }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.6 }; }
  var FX = OZ.renderFx;

  function onEvent(type, d) {
    d = d || {};
    OZ.sfx(g, type, d);
    var s = game ? S() : null, t = th();
    switch (type) {
      case 'stage': {
        ui.toasts = []; FX.clear(); g.setMusic(OZ.MUSIC.stage);
        var lv = s.lv, title = lv.fort ? g.t('s_' + lv.key) : g.t('s_' + lv.boss);
        var sub = lv.fort ? (lv.fort === 3 ? g.t('rush') + ' · ' + g.t('finale') : g.t('boss') + ': ' + g.t('b_' + lv.boss)) : g.t('boss') + ': ' + g.t('b_' + lv.boss);
        ui.banner = { title: title, sub: sub, a: 2.6 };
        break;
      }
      case 'bossIntro':
        if (!d.rematch) g.setMusic(OZ.MUSIC.boss);
        ui.banner = { title: g.t('b_' + d.key), sub: d.rematch ? g.t('rush') : d.finale || d.phase2 ? g.t('finale') : g.t('s_' + (s.lv.fort ? s.lv.key : s.lv.boss)), a: 1.8 };
        break;
      case 'miniIntro': toast(g.t('f_' + d.type), t.warn, s.hero.x + 4, s.hero.y - 3, true); break;
      case 'bossHit': if (d.weak) { toast(g.t('weakHit'), t.warn, d.x, d.y - 1.2, true); FX.puff(d.x, d.y, '#ffe9a0', 10, 6, 0.4); } break;
      case 'bossDie': FX.puff(d.x, d.y, '#ffb35c', 40, 9, 1.2, true); FX.puff(d.x, d.y, '#ffffff', 16, 5, 0.6); ui.shake = 0.6; toast('+' + d.pts, t.accent, d.x, d.y - 1.5, true); break;
      case 'kill': FX.puff(d.x, d.y, d.mini ? '#ffb35c' : '#c9b49a', d.mini ? 24 : 8, 6, 0.5, true); if (d.mini) toast('+' + d.pts, t.accent, d.x, d.y - 1, true); break;
      case 'hit': FX.puff(d.x, d.y, '#ffe1a8', 3, 4, 0.2); break;
      case 'hurt': ui.shake = Math.max(ui.shake, 0.25); FX.puff(d.x, d.y, '#ff6a4d', 6, 5, 0.3); break;
      case 'die': ui.shake = 0.4; FX.puff(d.x, d.y, '#e09a44', 26, 7, 1.0, true); FX.puff(d.x, d.y, '#3fa34d', 8, 4, 0.8, true); msg(g.t('d_' + d.why, ''), t.bad, 1.6); break;
      case 'pickup': if (d.k === 'tank') toast(g.t('flask'), t.good, d.x, d.y - 1.4, true); else if (d.k === 'life') toast(g.t('life'), t.good, d.x, d.y - 1.4, true); break;
      case 'tank': msg(g.t('tank'), t.good, 1.4); break;
      case 'noEnergy': if (s) toast(g.t('noEnergy'), t.muted, s.hero.x, s.hero.y - 2.2); break;
      case 'checkpoint': if (s) toast(g.t('checkpoint'), t.muted, s.hero.x, s.hero.y - 2.2); break;
      case 'gateOpen': FX.puff(d.x, d.y, '#ffd34d', 10, 4, 0.5); break;
      case 'stomp': case 'crash': ui.shake = Math.max(ui.shake, 0.2); break;
      case 'got': g.setMusic(OZ.MUSIC.stage); break;
      case 'clear': break;
      case 'win': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().won) g.win(); }, 2200); break;
      case 'gameover': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().over) g.gameover(); }, 1200); break;
    }
    sync();
  }
  function ensureGame() { if (!game) { game = OZ.Game({ onEvent: onEvent, store: store, rng: L.mulberry32((Date.now() & 0xffff) + 1) }); game.start(); OZ.current = game; } return game; }
  function newRun() { ensureGame(); game.newRun(); ui.toasts = []; ui.banner = null; ui.msg = null; ui.sel = firstOpen(); ui.selMsg = ''; FX.clear(); sync(); }
  function firstOpen() { var s = S(); for (var i = 0; i < 8; i++) if (!s.prog.beaten[i]) return i; return 8; }

  // ---------- стандартные экраны и меню ----------
  g.useStandardScreens({ lives: L.LIVES });
  g.menu.addItem({ key: 'pass', after: 'play', label: function () { return g.t('passEnter'); }, onSelect: function () { g.goto('pass'); } });
  var resetArm = 0;
  g.menu.addItem({ key: 'reset', label: function () { return resetArm > g.time ? g.t('resetQ') : g.t('reset'); },
    onSelect: function () { if (resetArm > g.time) { ensureGame().resetProgress(); resetArm = 0; titleNote = { text: g.t('resetDone'), a: 2 }; } else resetArm = g.time + 3; } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var retro = g.themeName === 'retro', K = R.HERO[retro ? 'r' : 'm'];
      R.heroFig(ctx, this.W / 2, this.H / 2 - 60, 1, { run: 0, air: false, shoot: name === 'win' }, K, retro, this.time);
      if (game) { var p = S().prog; this.text(g.t('pass') + ': ' + R.fmtPass(OZ.save.encode(p)), this.W / 2, this.H / 2 + 56, { size: 13, align: 'center', color: th().accent, weight: 800 }); }
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title'), titleNote = null;
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', Wc = this.W, Hc = this.H, t = this.time, Pc = th();
    ctx.imageSmoothingEnabled = !retro;
    ctx.fillStyle = retro ? '#000000' : '#0e0a08'; ctx.fillRect(0, 0, Wc, Hc);
    if (!retro) { var gr = ctx.createRadialGradient(Wc * 0.22, Hc * 0.7, 10, Wc * 0.22, Hc * 0.7, 300); gr.addColorStop(0, 'rgba(255,140,60,.22)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    // шестерни цеха на фоне
    R.gearShape(ctx, Wc - 70, 70, 54, 12, t * 0.2, retro ? '#331a00' : '#24190f', retro ? '#000' : '#0e0a08');
    R.gearShape(ctx, Wc - 140, 140, 32, 9, -t * 0.34, retro ? '#331a00' : '#24190f', retro ? '#000' : '#0e0a08');
    // пол мастерской и герой с наручем
    ctx.fillStyle = retro ? '#442200' : '#2a1d15'; ctx.fillRect(0, Hc - 64, Wc, 64);
    ctx.fillStyle = retro ? '#884400' : '#4a3424'; ctx.fillRect(0, Hc - 64, Wc, 4);
    var K = R.HERO[retro ? 'r' : 'm'];
    ctx.save(); ctx.translate(96, Hc - 64); ctx.scale(2.2, 2.2);
    R.heroFig(ctx, 0, 0, 1, { run: 0, air: false, shoot: Math.floor(t / 1.5) % 2 === 1, charge: (t % 3) > 1.6 ? (t % 3) - 1.6 : 0, wcol: retro ? '#ffaa44' : '#ffb35c' }, K, retro, t);
    ctx.restore();
    this.text(this.t('title'), Wc / 2 + 60, 64, { size: retro ? 40 : 46, align: 'center', color: Pc.accent, weight: 900 });
    this.text(this.t('subtitle'), Wc / 2 + 60, 88, { size: retro ? 11 : 12, align: 'center', color: Pc.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2 + 60, 105, { size: retro ? 9 : 10, align: 'center', color: Pc.muted, weight: 600 });
    // трофеи
    var p = ensureGame().state().prog;
    for (var i = 0; i < 8; i++) { var k = L.WEAP[i + 1].k; R.weaponIcon(ctx, k, Wc / 2 - 50 + i * 30, 128, 1.1, p.beaten[i] ? (retro ? R.WCOLR : R.WCOL)[k] : (retro ? '#444444' : '#3a3029')); }
    menu.draw(this, Wc / 2 + 60, 166, 26);
    var line = [];
    if (this.state.best) line.push(this.t('best') + ': ' + this.state.best);
    line.push(this.t('pass') + ': ' + R.fmtPass(OZ.save.encode(p)));
    this.text(line.join('   '), Wc / 2 + 60, Hc - 36, { size: 11, align: 'center', color: Pc.muted, weight: 700 });
    if (titleNote && titleNote.a > 0) { titleNote.a -= 1 / 60; this.text(titleNote.text, Wc / 2 + 60, Hc - 52, { size: 11, align: 'center', color: Pc.warn, weight: 800 }); }
    this.text(this.t('hint'), Wc / 2, Hc - 12, { size: retro ? 9 : 10, align: 'center', color: Pc.muted, weight: 600 });
  };

  // ---------- ввод пароля ----------
  var pass = { d: [1, 1, 1, 1, 1, 1], pos: 0, note: '', noteA: 0 };
  g.scene('pass', {
    realtime: true,
    enter: function () { var c = OZ.save.encode(ensureGame().state().prog); pass.d = c.split('').map(Number); pass.pos = 0; pass.note = ''; },
    update: function (dt) { if (pass.noteA > 0) pass.noteA -= dt; },
    press: function (a) {
      if (a === 'left') pass.pos = (pass.pos + 5) % 6;
      else if (a === 'right') pass.pos = (pass.pos + 1) % 6;
      else if (a === 'up') pass.d[pass.pos] = pass.d[pass.pos] % 8 + 1;
      else if (a === 'down') pass.d[pass.pos] = (pass.d[pass.pos] + 6) % 8 + 1;
      else if (a === 'action' || a === 'start') submitPass();
      else if (a === 'pause') this.goto('title');
      g.audio.beep(600, 0.03);
    },
    draw: function () {
      var retro = g.themeName === 'retro', Pc = th(), cx = this.W / 2;
      this.clear();
      this.text(this.t('passTitle'), cx, 90, { size: 22, align: 'center', color: Pc.accent, weight: 900 });
      for (var i = 0; i < 6; i++) {
        var x = cx - 150 + i * 50 + (i >= 3 ? 20 : 0), on = i === pass.pos;
        this.ctx.fillStyle = on ? (retro ? '#442200' : '#3a2616') : (retro ? '#111111' : '#1d140f'); this.ctx.fillRect(x - 18, 130, 36, 50);
        this.ctx.strokeStyle = on ? Pc.accent : Pc.muted; this.ctx.lineWidth = on ? 3 : 1; this.ctx.strokeRect(x - 18, 130, 36, 50);
        this.text(String(pass.d[i]), x, 166, { size: 28, align: 'center', color: on ? Pc.accent : Pc.ink, weight: 900 });
      }
      this.text('—', cx + 10 - 5, 162, { size: 20, align: 'center', color: Pc.muted, weight: 900 });
      this.text(this.t('passHint'), cx, 220, { size: 11, align: 'center', color: Pc.muted, weight: 600 });
      if (pass.noteA > 0) this.text(pass.note, cx, 256, { size: 14, align: 'center', color: pass.ok ? Pc.good : Pc.bad, weight: 900 });
    }
  });
  function submitPass() {
    var ok = ensureGame().applyPassword(pass.d.join(''));
    pass.ok = ok; pass.note = ok ? g.t('passOk') : g.t('passBad'); pass.noteA = 1.6;
    if (ok) setTimeout(function () { if (g._sceneName === 'pass') g.goto('title'); }, 700);
  }

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  function moveSel(a) {
    var c = ui.sel;
    if (a === 'left') c = c === 8 ? 3 : c % 4 === 0 ? c : c - 1;
    else if (a === 'right') c = c === 8 ? 8 : c % 4 === 3 ? 8 : c + 1;
    else if (a === 'up') c = c === 8 ? 8 : c >= 4 ? c - 4 : c;
    else if (a === 'down') c = c === 8 ? 8 : c < 4 ? c + 4 : c;
    if (c !== ui.sel) { ui.sel = c; ui.selMsg = ''; g.audio.beep(520, 0.03); }
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newRun(); playSince = g.time; },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (!game) return;
      var s = S();
      if (s.phase === 'select') {
        if (a === 'left' || a === 'right' || a === 'up' || a === 'down') moveSel(a);
        else if (a === 'action' || a === 'start') {
          if (game.canPick(ui.sel)) { game.pick(ui.sel); playSince = g.time; }
          else { ui.selMsg = g.t('locked'); g.audio.beep(160, 0.08); }
        }
      } else if (s.phase === 'got' && (a === 'action' || a === 'start')) { if (game.continueAfterGot()) ui.sel = firstOpen(); }
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
      var dir = this.input.dir, live = g.time - playSince > 0.18 && s.phase === 'stage';
      game.setInput({
        dx: live ? dir.x : 0,
        down: live && dir.y > 0,
        jump: live && (this.input.pressed('action') || dir.y < 0 || extra.jump),
        fire: live && (extra.fire || pad.fire),
        slide: live && (extra.slide || pad.slide)
      });
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      if (s.phase === 'got' && s.phaseT > 4.4) ui.sel = firstOpen();
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      OZ.render(g, ctx, S(), { toasts: ui.toasts, banner: ui.banner, msg: ui.msg, shake: ui.shake > 0 ? 10 * ui.shake / 0.4 : 0, sel: ui.sel, selMsg: ui.selMsg }, game);
    }
  });

  // ---------- доп. клавиши ----------
  var FIRE = { KeyX: 1, KeyJ: 1, ControlLeft: 1, ControlRight: 1 }, JUMP = { KeyZ: 1, KeyK: 1 }, SLIDE = { KeyC: 1, ShiftLeft: 1, ShiftRight: 1 }, held = {};
  function recompute() {
    extra.fire = !!(held.KeyX || held.KeyJ || held.ControlLeft || held.ControlRight);
    extra.jump = !!(held.KeyZ || held.KeyK); extra.slide = !!(held.KeyC || held.ShiftLeft || held.ShiftRight);
  }
  function inStage() { return g._sceneName === 'play' && game && S().phase === 'stage'; }
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (FIRE[e.code] || JUMP[e.code] || SLIDE[e.code]) { held[e.code] = true; recompute(); if (ip) e.preventDefault(); return; }
    if (g._sceneName === 'pass') { var m = /^(?:Digit|Numpad)([1-8])$/.exec(e.code); if (m) { pass.d[pass.pos] = +m[1]; pass.pos = Math.min(5, pass.pos + 1); g.audio.beep(600, 0.03); } return; }
    if (!inStage() || e.repeat) return;
    if (e.code === 'KeyQ') game.cycleWeapon(-1);
    else if (e.code === 'KeyE' || e.code === 'Tab') { game.cycleWeapon(1); e.preventDefault(); }
    else if (e.code === 'KeyF') game.useTank();
    else { var mm = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); if (mm) game.selectWeapon(+mm[1] - 1); }
  });
  addEventListener('keyup', function (e) { if (FIRE[e.code] || JUMP[e.code] || SLIDE[e.code]) { held[e.code] = false; recompute(); } });
  addEventListener('blur', function () { held = {}; recompute(); pad.fire = pad.slide = false; });
  // тач-кнопки
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { e.preventDefault(); on(); b.classList.add('on'); }, h0 = function (e) { e.preventDefault(); off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) h0(new Event('x')); });
  }
  function tap(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { e.preventDefault(); fn(); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  hold('bFire', function () { pad.fire = true; }, function () { pad.fire = false; });
  hold('bSlide', function () { pad.slide = true; }, function () { pad.slide = false; });
  tap('bWpn', function () { if (inStage()) game.cycleWeapon(1); });
  tap('bTank', function () { if (inStage()) game.useTank(); });
  tap('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

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
  OZ.app = { g: g, game: function () { return game; }, ui: ui };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
