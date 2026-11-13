/* ЧЕРТОГ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js, levels.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован, в меню — «Продолжить» (сохранение уровня),
   в паузе — «Заново уровень». Ввод: ←→/AD — бег; Shift + стрелка — осторожный шаг; ↑/W — прыжок; ↓/S — вниз/пить;
   Пробел/X/J — выпад (вне боя — прыжок); тач: дпад, ● — выпад/прыжок, ⇧ — шаг (удерживать), II — пауза. */
(function (global) {
  'use strict';
  var C = global.CHERTOG, L = C.logic, R = C.R, K = L.K;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0d0907', panel: '#1a120d', ink: '#f6ece2', muted: '#b39a86', accent: '#ffb347', grid: '#33241a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = 640, H = 400;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'chertog', strings: C.STR, theme: 'modern', lives: K.HP0, themes: themes });
  C.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var Store = Arcade.Store, SAVE = 'arcade.save.chertog', TKEY = 'arcade.besttime.chertog';

  var game = null, toasts = [], banner = null, hint = null, msg = null, playSince = 0, extra = { atk: false, shift: false, up: false }, shakeT = 0, lastTime = null, wantContinue = false, seen = {};
  function S() { return game.state(); }
  function P() { return g.themeName === 'retro' ? R.PR : R.PM; }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.hp); g.state.level = s.level; }
  function loadSave() { try { var o = JSON.parse(Store.get(SAVE, 'null')); return o && o.level >= 1 && o.level <= C.LEVELS.length && o.time > 0 ? o : null; } catch (e) { return null; } }
  function writeSave(s) { Store.set(SAVE, JSON.stringify({ level: s.level, maxHp: s.maxHp, time: Math.round(s.timeLeft * 10) / 10, score: s.score, elapsed: Math.round(s.time * 10) / 10 })); }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  function bestTime() { var v = parseFloat(Store.get(TKEY, '0')); return v > 0 ? v : null; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (Math.abs(toasts[i].y - y) < 0.15 && toasts[i].t > toasts[i].life - 0.6) y -= 0.18;
    var life = big ? 2 : 1.3; toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big });
  }
  function showHint(key, once) { if (once && seen[key]) return; seen[key] = 1; hint = { text: g.t(key), a: 4.5, life: 4.5 }; }
  function showMsg(text, sub, color, dur) { msg = { text: text, sub: sub, color: color, a: dur || 2.2 }; }
  function burst(x, y, color, n, sp) {
    var s = S(), rm = s.room, sc = g.themeName === 'retro' ? 1 : 1;
    g.particles.spawn((x - rm.x * L.RW) * R.TW * sc, (y - rm.y * L.RH) * R.TH - 10, { color: color, count: n || 12, speed: sp || 90, life: 0.5, size: g.themeName === 'retro' ? 4 : 3 });
  }

  function onEvent(type, d) {
    d = d || {};
    C.sfx(g, type, d);
    var Pc = P(), s = game ? S() : null;
    switch (type) {
      case 'level':
        toasts = []; hint = null; msg = null;
        banner = { title: (d.level >= C.LEVELS.length ? g.t('final') : g.t('level') + ' ' + d.level) + ' · ' + g.t('l' + d.level), sub: d.level === 1 ? g.t('intro1') : g.t('introN'), a: 3, life: 3 };
        if (s) writeSave(s);
        if (d.level === 4) setTimeout(function () { if (game && S().level === 4) showHint('h_door', true); }, 3200);
        break;
      case 'restart': toasts = []; if (d.death) showMsg(g.t('again'), '', Pc.muted, 1.6); break;
      case 'spikes': if (s && !seen.h_step) showHint('h_step', true); break;
      case 'grab': if (s && s.level === 1) showHint('h_climb', true); break;
      case 'engage': showHint('h_fight', true); break;
      case 'plate': showHint('h_plate', true); toast('⟲', Pc.accent, d.x, d.y - 0.4); break;
      case 'chop': if (!seen.h_chop) showHint('h_chop', true); break;
      case 'door': showMsg(g.t('doorOpen'), '', Pc.good, 2.2); break;
      case 'slam': showMsg(g.t('slam'), '', Pc.bad, 1.8); shakeT = 0.25; break;
      case 'drink':
        if (d.kind === 'h') toast(g.t('heal'), Pc.good, d.x, d.y - 0.9);
        else if (d.kind === 'H') { toast(g.t('maxUp'), Pc.good, d.x, d.y - 0.9, true); burst(d.x, d.y - 0.4, '#7bd389', 24, 120); }
        else { toast(g.t('poison'), Pc.bad, d.x, d.y - 0.9, true); burst(d.x, d.y - 0.4, '#9a49c9', 16, 80); }
        break;
      case 'clang': burst(d.x, d.y - 0.42, '#ffffff', 8, 120); break;
      case 'hit': burst(d.x, d.y - 0.45, Pc.bad, 10, 100); break;
      case 'hurt': burst(s.hero.x, s.hero.y - 0.45, Pc.bad, 10, 90); shakeT = 0.18; break;
      case 'kill': toast(g.t(d.k) + ' — ' + g.t('killed') + '  +' + d.pts, Pc.accent, d.x, d.y - 0.9, true); break;
      case 'thud': shakeT = 0.2; break;
      case 'smash': burst(d.x, d.y, g.themeName === 'retro' ? '#aaaaaa' : '#8c8090', 10, 70); break;
      case 'crumble': shakeT = 0.08; break;
      case 'die': shakeT = 0.3; showMsg(g.t('d_' + d.why, ''), g.t('again'), Pc.bad, 2.2); burst(d.x, d.y - 0.4, Pc.bad, 18, 110); break;
      case 'boss': showMsg(g.t('bossDown'), '', Pc.accent, 3); break;
      case 'twin': showHint('h_twin'); hint.a = hint.life = 6.5; break;
      case 'twinDown': showMsg(g.t('twinDown'), '', Pc.good, 3); burst(d.x, d.y - 0.4, '#ffd2a0', 30, 160); shakeT = 0.3; setTimeout(function () { if (game && S().level === C.LEVELS.length) showHint('h_cage'); }, 1600); break;
      case 'room': toasts = toasts.filter(function (q) { return q.big; }); break;
      case 'clear': break;
      case 'win': {
        clearSave(); var bt = bestTime(); if (!bt || d.time < bt) Store.set(TKEY, String(Math.round(d.time)));
        lastTime = d.time; sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 1800); break;
      }
      case 'timeout': showMsg(g.t('timeup'), '', Pc.bad, 3); break;
      case 'gameover': clearSave(); sync(); g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 2200); break;
    }
    sync();
  }
  function newGame() {
    var sv = wantContinue ? loadSave() : null; wantContinue = false;
    if (!sv) clearSave();
    game = C.Game({ onEvent: onEvent, level: sv ? sv.level : 1, maxHp: sv ? sv.maxHp : K.HP0, time: sv ? sv.time : K.TIME, score: sv ? sv.score : 0, rng: L.mulberry32((Date.now() & 0xffff) + 1) });
    toasts = []; banner = null; hint = null; msg = null; seen = sv ? { h_step: 1, h_climb: 1, h_fight: 1, h_plate: 1, h_chop: 1 } : {}; lastTime = null;
    game.start(); if (sv) game.state().time = sv.elapsed || 0;
    C.current = game; sync();
  }

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: K.HP0 });
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + (sv.level >= C.LEVELS.length ? g.t('final') : g.t('level') + ' ' + sv.level) + ' · ' + R.clock(sv.time) : g.t('cont') + ' —'; },
    onSelect: function () { if (!loadSave()) { g.audio.beep(200, 0.06); return; } wantContinue = true; g.state.score = 0; g.goto('play'); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (game && game.state().phase === 'play') { game.restartLevel(false); sync(); } g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var Pc = P(), bt = bestTime(), y = this.H / 2 + 46;
      if (name === 'win') {
        R.figure(ctx, this.W / 2 - 40, this.H / 2 - 64, 1, { p: R.POSE.cheer }, R.LOOK.hero[g.themeName === 'retro' ? 'r' : 'm'], 0.9, 'hero', { retro: g.themeName === 'retro', noSword: true });
        R.figure(ctx, this.W / 2 + 40, this.H / 2 - 64, -1, { p: R.POSE.stand }, R.LOOK.master[g.themeName === 'retro' ? 'r' : 'm'], 0.9, 'master', { retro: g.themeName === 'retro', noSword: true });
        if (lastTime != null) this.text(this.t('time') + ': ' + R.clock(lastTime) + (bt ? '   ' + this.t('bestTime') + ': ' + R.clock(bt) : ''), this.W / 2, y, { size: 14, align: 'center', color: Pc.accent, weight: 700 });
      } else if (game) this.text(this.t('level') + ': ' + game.state().level + ' · ' + this.t('l' + game.state().level), this.W / 2, y, { size: 13, align: 'center', color: Pc.muted, weight: 700 });
    };
  });

  // ---------- Титул ----------
  var title = g.scenes.title, menu = g.menu.get('title'), demoLV = L.level(1), demoM = L.mapState(demoLV, {});
  title.draw = function (ctx) {
    var isRetro = g.themeName === 'retro', Pc = P(), Wc = this.W, Hc = this.H, th = this.th(), lay = R.roomLayer(demoLV, 2, 0, isRetro, demoM);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, Wc, Hc);
    ctx.imageSmoothingEnabled = !isRetro; ctx.drawImage(lay.cv, 0, 0, 640, 360);
    ctx.fillStyle = isRetro ? 'rgba(0,0,0,.72)' : 'rgba(10,6,4,.62)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 440, ph = 344, x0 = (Wc - pw) / 2, y0 = 26;
    if (isRetro) { ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, pw, ph); ctx.fillStyle = '#aa5500'; ctx.fillRect(x0, y0, pw, 3); ctx.fillRect(x0, y0 + ph - 3, pw, 3); ctx.fillRect(x0, y0, 3, ph); ctx.fillRect(x0 + pw - 3, y0, 3, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(26,18,13,.94)'; R.rr(ctx, x0, y0, pw, ph, 16); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#5a3d2a'; ctx.lineWidth = 1.5; R.rr(ctx, x0 + 0.75, y0 + 0.75, pw - 1.5, ph - 1.5, 16); ctx.stroke(); }
    this.text(this.t('title'), Wc / 2, y0 + 58, { size: isRetro ? 46 : 52, align: 'center', color: Pc.accent, weight: 900 });
    this.text(this.t('subtitle'), Wc / 2, y0 + 86, { size: isRetro ? 11 : 13, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2, y0 + 105, { size: isRetro ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
    // дуэль на титуле: герой и страж в стойке, поочерёдные выпады
    var tt = this.time % 2.4, hs = { st: tt < 0.6 ? 'lunge' : tt > 1.2 && tt < 1.6 ? 'parry' : 'en', t: tt < 0.6 ? tt : tt > 1.2 ? tt - 1.2 : tt };
    var gs = { st: tt > 1.2 && tt < 1.8 ? 'lunge' : tt < 0.4 ? 'parry' : 'en', t: tt > 1.2 ? tt - 1.2 : tt, id: 0, k: 'g' };
    var hp = R.heroPose({ st: hs.st, t: hs.t, x: 0, face: 1 }, { clock: this.time });
    R.figure(ctx, x0 + 46, y0 + ph - 18, 1, hp, R.LOOK.hero[isRetro ? 'r' : 'm'], 1, 'hero', { retro: isRetro, time: this.time });
    R.figure(ctx, x0 + pw - 46, y0 + ph - 18, -1, R.guardPose(gs, { clock: this.time }), R.LOOK.N[isRetro ? 'r' : 'm'], 1, 'N', { retro: isRetro, time: this.time });
    menu.draw(this, Wc / 2, y0 + 146, 29);
    var bt = bestTime(), line = [];
    if (this.state.best) line.push(this.t('best') + ': ' + this.state.best);
    if (bt) line.push(this.t('bestTime') + ': ' + R.clock(bt));
    if (line.length) this.text(line.join(' · '), Wc / 2, y0 + ph - 16, { size: 11, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), Wc / 2, Hc - 12, { size: isRetro ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60, FENCE = { en: 1, lunge: 1, parry: 1, adv: 1, ret: 1, recoil: 1, hit: 1 };
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
      if (hint) { hint.a -= dt; if (hint.a <= 0) hint = null; }
      if (msg) { msg.a -= dt; if (msg.a <= 0) msg = null; }
      if (shakeT > 0) shakeT -= dt;
      var dir = this.input.dir, live = g.time - playSince > 0.15, s = S(), fight = !!FENCE[s.hero.st];
      var act = live && (this.input.pressed('action') || extra.atk);
      game.setInput({ x: live ? dir.x : 0, up: live && (dir.y < 0 || extra.up || (act && !fight)), down: live && dir.y > 0, shift: extra.shift || padShift, atk: act && fight });
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      C.render(this, ctx, S(), { toasts: toasts, banner: banner, hint: hint, msg: msg, shake: shakeT > 0 ? 5 : 0 });
    }
  });

  // ---------- Доп. клавиши и тач-кнопки ----------
  var ATK = { KeyX: 1, KeyJ: 1, KeyK: 1, ControlLeft: 1, ControlRight: 1 }, SHIFT = { ShiftLeft: 1, ShiftRight: 1, KeyZ: 1 }, held = {}, padShift = false;
  function recompute() { extra.atk = !!(held.KeyX || held.KeyJ || held.KeyK || held.ControlLeft || held.ControlRight); extra.shift = !!(held.ShiftLeft || held.ShiftRight || held.KeyZ); }
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (ATK[e.code] || SHIFT[e.code]) { held[e.code] = true; recompute(); if (ip) e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { if (ATK[e.code] || SHIFT[e.code]) { held[e.code] = false; recompute(); } });
  addEventListener('blur', function () { held = {}; recompute(); padShift = false; });
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { e.preventDefault(); on(); b.classList.add('on'); }, h0 = function (e) { e.preventDefault(); off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) { off(); b.classList.remove('on'); } });
  }
  hold('bStep', function () { padShift = true; }, function () { padShift = false; });
  (function () {
    var b = document.getElementById('bPause'); if (!b) return;
    var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  })();

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, pad = document.querySelector('.pad');
    var padFixed = pad && getComputedStyle(pad).position === 'fixed';
    var padH = pad && !padFixed && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
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
  C.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
