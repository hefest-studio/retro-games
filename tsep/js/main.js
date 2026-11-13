/* ЦЕПЬ · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens (титул и финалы перерисованы); свои пункты меню: «Продолжить»
   (сохранение в начале этажа), «Пароль» (сцена pwd), в паузе — «Этаж заново». Сцена play: этажи, «Продолжить?».
   Ввод: ←→/AD — ход; Пробел/Z/K — прыжок; X/J — удар цепью (↑ + удар — наискось вверх); C/I/Shift — орудие; ↑↓ — лестница, ↓ — присед;
   тач: дпад, ● прыжок, ✦ цепь, ◆ орудие, II пауза. */
(function (global) {
  'use strict';
  var T = global.TSEP, L = T.logic, R = T.R, FX = T.fx;
  var TH = Arcade.themes || {}, Store = Arcade.Store, SAVE = 'arcade.save.tsep';
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0b1416', panel: '#142024', ink: '#eef4f2', muted: '#94a8a6', accent: '#d8b25a', good: '#7fe0b0', bad: '#ff6a55', warn: '#ffd36a', grid: '#22343a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8c838', muted: '#a8a8a8', ink: '#ffffff', good: '#58f8a8', bad: '#f85838', warn: '#f8d878' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: R.W, height: R.H, gameId: 'tsep', strings: T.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  T.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  var game = null, ui = { toasts: [], banner: null, msg: null, shake: 0, contT: 0 }, playSince = 0, keys = { atk: false, jump: false, sub: false }, pad = { atk: false, sub: false };
  var floorStart = null, pendingStart = null;
  function S() { return game.state(); }
  function th() { return g.th(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.fi + 1; }
  function toast(text, color, x, y, big) { ui.toasts.push({ text: text, color: color, x: x, y: y, t: big ? 1.8 : 1.1, big: !!big }); if (ui.toasts.length > 10) ui.toasts.shift(); }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.6 }; }
  function loadSave() { try { var o = JSON.parse(Store.get(SAVE, 'null')); return o && o.fi >= 0 && o.fi <= 5 && (o.fi <= T.BRANCH || o.route) ? o : null; } catch (e) { return null; } }
  function writeSave(o) { Store.set(SAVE, JSON.stringify(o)); }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }

  function onEvent(type, d) {
    d = d || {};
    T.sfx(g, type, d);
    var s = game ? S() : null, t = th();
    switch (type) {
      case 'level':
        ui.toasts = []; FX.clear(); g.setMusic(T.MUSIC.stage);
        if (s) { floorStart = game.saveData(); writeSave(floorStart); }
        ui.banner = { title: g.t('floor').toUpperCase() + ' ' + (d.fi + 1) + ' · ' + g.t('f_' + d.key), sub: g.t('b_' + T.FLOORS[d.key].boss), code: s ? g.t('pwdIs') + ': ' + L.encode(floorStart) : '', a: 2.8 };
        break;
      case 'bossIntro': g.setMusic(d.final ? T.MUSIC.heart : T.MUSIC.boss); ui.banner = { title: g.t('b_' + d.k), sub: g.t('f_' + s.key), a: 1.6 }; break;
      case 'bossHit': FX.puff(d.x, d.y, '#ffe6a0', 5, 5, 0.25); ui.shake = Math.max(ui.shake, 0.12); break;
      case 'bossDie': FX.puff(d.x, d.y, '#ffd36a', 40, 9, 1.2, true); FX.puff(d.x, d.y, '#ffffff', 16, 5, 0.6); ui.shake = 0.7; toast('+' + d.pts, t.accent, d.x, d.y - 1.5, true); g.stopMusic && g.stopMusic(); break;
      case 'hit': FX.puff(d.x, d.y, '#ffe6a0', 4, 4, 0.2); break;
      case 'kill': FX.puff(d.x, d.y, '#d6b25a', 10, 6, 0.5, true); FX.puff(d.x, d.y, '#9aa6ae', 6, 4, 0.4, true); toast('+' + d.pts, t.ink, d.x, d.y - 0.8); break;
      case 'lamp': FX.puff(d.x, d.y, '#cdf2ff', 10, 5, 0.4); FX.puff(d.x, d.y, '#d6b25a', 4, 3, 0.4, true); break;
      case 'clank': FX.puff(d.x, d.y, '#c9d3da', 6, 4, 0.25); break;
      case 'hurt': ui.shake = Math.max(ui.shake, 0.25); FX.puff(d.x, d.y, '#ff8a6a', 8, 5, 0.4, true); break;
      case 'die': ui.shake = 0.4; FX.puff(d.x, d.y - 1, '#5b8fb0', 18, 7, 1.0, true); FX.puff(d.x, d.y - 1, '#ea6a12', 10, 5, 0.8, true); msg(g.t('d_' + d.why, d.why), t.bad, 1.6); break;
      case 'pickup':
        if (d.k === 'chain') break;
        if (L.SUB[d.k]) toast(g.t('s_' + d.k), t.accent, d.x, d.y - 1.4, true);
        else if (d.k === 'core') msg(g.t('coreGot'), t.warn, 2);
        else if (d.k === 'oil') toast('+HP', t.good, d.x, d.y - 1.2);
        else if (d.k === 'token') toast('+500', t.warn, d.x, d.y - 1.2);
        break;
      case 'chain': msg(g.t('chainUp') + ' · ' + d.lvl + '/3', t.warn, 1.8); if (s) FX.puff(s.hero.x, s.hero.y - 1, '#d6b25a', 16, 6, 0.6); break;
      case 'nosparks': if (s) toast(g.t('nosparks'), t.muted, s.hero.x, s.hero.y - 2.4); break;
      case 'freeze': msg(g.t('freeze'), '#bfe8ff', 1.2); break;
      case 'life': msg(g.t('life'), t.good, 1.4); break;
      case 'checkpoint': toast(g.t('checkpoint'), t.muted, d.x, d.y - 2.6, true); break;
      case 'stomp': ui.shake = Math.max(ui.shake, 0.3); break;
      case 'thud': ui.shake = Math.max(ui.shake, 0.1); break;
      case 'flame': FX.puff(d.x, d.y - 0.3, '#ff8a3a', 8, 4, 0.4); break;
      case 'branch': ui.banner = { title: g.t('branch'), sub: '1 — ' + g.t('route_A') + '   ·   2 — ' + g.t('route_B'), a: 3.2 }; break;
      case 'clear': ui.banner = { title: g.t('clear'), sub: (d.route ? g.t('route_' + d.route) + ' · ' : '') + (d.bonus ? '+' + d.bonus + ' ' + g.t('bonus') : ''), a: 2.8 }; g.stopMusic && g.stopMusic(); break;
      case 'continueQ': ui.contT = 9; g.stopMusic && g.stopMusic(); break;
      case 'continued': g.setMusic(T.MUSIC.stage); break;
      case 'win': sync(); clearSave(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'won') g.win(); }, 3000); break;
      case 'gameover': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') g.gameover(); }, 900); break;
    }
    sync();
  }
  function newGame(start) {
    game = T.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1), start: start || null });
    T.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear();
    game.start(); sync();
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + g.t('floor').toLowerCase() + ' ' + (sv.fi + 1) : g.t('cont') + ' —'; },
    onSelect: function () { var sv = loadSave(); if (!sv) return; pendingStart = sv; g.goto('play'); } });
  g.menu.addItem({ key: 'pwd', after: 'continue', label: function () { return g.t('pwd'); }, onSelect: function () { g.goto('pwd'); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (floorStart) { pendingStart = floorStart; game = null; g.goto('play'); } } });
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var retro = g.themeName === 'retro';
      ctx.save(); ctx.translate(this.W / 2, this.H / 2 - 36); ctx.scale(2, 2);
      R.heroFig(ctx, 0, 0, 1, { t: this.time, atk: name === 'win' ? { ph: 'hit', k: 1, up: true } : null, hurt: name !== 'win' }, retro);
      if (name === 'win') R.chainFig(ctx, 9, -22, 1, { ph: 'hit', k: 1 }, 34, true, this.time, retro);
      ctx.restore();
      if (name === 'win') this.text(this.t('winText'), this.W / 2, this.H / 2 + 50, { size: 11, align: 'center', color: th().ink, weight: 700 });
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', Wc = this.W, Hc = this.H, t = this.time, Pc = th(), P = R.PAL.works, Q = retro ? P.r : P;
    ctx.imageSmoothingEnabled = !retro;
    if (retro) { ctx.fillStyle = Q.sky; ctx.fillRect(0, 0, Wc, Hc); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.6, P.sky[1]); gr.addColorStop(1, P.sky[2]); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    // неподвижные шестерни башни и циферблат
    ctx.fillStyle = Q.far; R.gear(ctx, Q.far, 70, 70, 60, 12, 0.2, null); R.gear(ctx, Q.far, 150, 170, 38, 10, 0.5, null); R.gear(ctx, Q.far, 460, 220, 70, 14, 0.1, null);
    ctx.strokeStyle = Q.top; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(80, 70, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(80, 70); ctx.lineTo(80, 48); ctx.moveTo(80, 70); ctx.lineTo(96, 76); ctx.stroke();
    // пол
    ctx.fillStyle = Q.body; ctx.fillRect(0, Hc - 50, Wc, 50); ctx.fillStyle = Q.top; ctx.fillRect(0, Hc - 50, Wc, 5); ctx.fillStyle = Q.rim; ctx.fillRect(0, Hc - 50, Wc, 1);
    // звонарь с цепью: замах-удар по кругу
    var cyc = t % 2.2, A = cyc < 0.6 ? { ph: 'wind', k: cyc / 0.6 } : cyc < 0.85 ? { ph: 'hit', k: 1 } : cyc < 1.2 ? { ph: 'rec', k: 1 - (cyc - 0.85) / 0.35 } : null;
    ctx.save(); ctx.translate(86, Hc - 50); ctx.scale(2.4, 2.4);
    R.heroFig(ctx, 0, 0, 1, { t: t, atk: A }, retro);
    if (A) R.chainFig(ctx, 9, -22, 1, A, 40, false, t, retro);
    ctx.restore();
    this.text(this.t('title'), Wc / 2 + 70, 60, { size: retro ? 44 : 50, align: 'center', color: Pc.accent, weight: 900 });
    this.text(this.t('subtitle'), Wc / 2 + 70, 84, { size: retro ? 10 : 12, align: 'center', color: Pc.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2 + 70, 100, { size: retro ? 8 : 9, align: 'center', color: Pc.muted, weight: 600 });
    menu.draw(this, Wc / 2 + 70, 126, 20);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, Wc / 2 + 70, Hc - 60, { size: 11, align: 'center', color: Pc.warn, weight: 800 });
    this.text(this.t('hint'), Wc / 2, Hc - 16, { size: retro ? 8 : 9, align: 'center', color: retro ? '#ffffff' : '#eef4f2', weight: 600 });
  };

  // ---------- ввод пароля ----------
  var pw = { s: [0, 0, 0, 0, 0], i: 0, bad: 0 };
  g.scene('pwd', {
    realtime: true,
    enter: function () { pw.i = 0; pw.bad = 0; },
    update: function (dt) { if (pw.bad > 0) pw.bad -= dt; },
    press: function (a) {
      var n = L.ALPH.length;
      if (a === 'up') pw.s[pw.i] = (pw.s[pw.i] + 1) % n;
      else if (a === 'down') pw.s[pw.i] = (pw.s[pw.i] + n - 1) % n;
      else if (a === 'left') pw.i = (pw.i + 4) % 5;
      else if (a === 'right') pw.i = (pw.i + 1) % 5;
      else if (a === 'action' || a === 'start') {
        var code = pw.s.map(function (k) { return L.ALPH[k]; }).join(''), d = L.decode(code);
        if (d) { pendingStart = { fi: d.fi, route: d.route, chain: d.chain, sub: d.sub, sparks: d.sparks, score: 0 }; this.goto('play'); }
        else { pw.bad = 1.5; this.audio.beep(160, 0.15, 'sawtooth'); }
        return;
      } else if (a === 'pause') { this.goto('title'); return; }
      this.audio.beep(700, 0.03);
    },
    draw: function (ctx) {
      this.clear(); var Pc = th(), Wc = this.W, retro = g.themeName === 'retro';
      this.text(this.t('pwdTitle'), Wc / 2, 70, { size: 20, align: 'center', color: Pc.accent, weight: 900 });
      for (var i = 0; i < 5; i++) {
        var x = Wc / 2 - 100 + i * 50, y = 110;
        ctx.strokeStyle = i === pw.i ? Pc.accent : Pc.muted; ctx.lineWidth = i === pw.i ? 2 : 1; ctx.strokeRect(x - 18, y, 36, 44);
        this.text(L.ALPH[pw.s[i]], x, y + 31, { size: 24, align: 'center', color: Pc.ink, weight: 900 });
        if (i === pw.i) { this.text('▲', x, y - 6, { size: 10, align: 'center', color: Pc.accent }); this.text('▼', x, y + 58, { size: 10, align: 'center', color: Pc.accent }); }
      }
      if (pw.bad > 0) this.text(this.t('pwdBad'), Wc / 2, 200, { size: 12, align: 'center', color: Pc.bad, weight: 800 });
      this.text(this.t('pwdHint'), Wc / 2, this.H - 30, { size: retro ? 9 : 10, align: 'center', color: Pc.muted, weight: 600 });
    }
  });

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) { newGame(pendingStart); pendingStart = null; } playSince = g.time; },
    press: function (a) {
      if (!game) return;
      var s = S();
      if (s.phase === 'cont') {
        if (a === 'action' || a === 'start') { game.continueGame(); playSince = g.time; }
        else if (a === 'pause') game.giveUp();
        return;
      }
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
        atk: live && (keys.atk || pad.atk), sub: live && (keys.sub || pad.sub)
      });
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      sync();
    },
    draw: function (ctx) { if (!game) { this.clear(); return; } T.render(g, ctx, S(), ui); }
  });

  // ---------- доп. клавиши ----------
  var ATK = { KeyX: 1, KeyJ: 1 }, JUMP = { KeyZ: 1, KeyK: 1 }, SUBK = { KeyC: 1, KeyI: 1, ShiftLeft: 1, ShiftRight: 1 }, held = {};
  function recompute() { keys.atk = !!(held.KeyX || held.KeyJ); keys.jump = !!(held.KeyZ || held.KeyK); keys.sub = !!(held.KeyC || held.KeyI || held.ShiftLeft || held.ShiftRight); }
  addEventListener('keydown', function (e) {
    if (ATK[e.code] || JUMP[e.code] || SUBK[e.code]) { held[e.code] = true; recompute(); if (g._sceneName === 'play') e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { if (ATK[e.code] || JUMP[e.code] || SUBK[e.code]) { held[e.code] = false; recompute(); } });
  addEventListener('blur', function () { held = {}; recompute(); pad.atk = pad.sub = false; });
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { e.preventDefault(); on(); b.classList.add('on'); }, h0 = function (e) { e.preventDefault(); off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) h0(new Event('x')); });
  }
  hold('bAtk', function () { pad.atk = true; }, function () { pad.atk = false; });
  hold('bSub', function () { pad.sub = true; }, function () { pad.sub = false; });
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
  T.app = { g: g, game: function () { return game; }, ui: ui, newGame: newGame };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
