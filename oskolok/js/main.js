/* ОСКОЛОК · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук.
   Сцены движка: title (перерисован, + «Продолжить» — сохранение главы), pause (+ «Эпизод заново»), win, gameover; своя — play
   (внутри неё и кат-сцены движком). Ввод: ←→/AD — бег; ↑/W/Z — прыжок; Пробел/X/J — резонатор (нажать — импульс,
   удерживать — щит); C/K/Shift — заряд → пробой; F/E — прицел дрона (стрелки, F/Пробел — лететь), клик/тап — дрон в точку,
   R — вернуть дрона; ↓/S — рычаг. Тач: дпад, ● резонатор, ✦ заряд, ✧ дрон, II — пауза. */
(function (global) {
  'use strict';
  var O = global.OSKOLOK, L = O.logic, R = O.R, K = L.K, VW = R.VW, VH = R.VH, TS = R.TS;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#070a14', panel: '#101626', ink: '#eef6ff', muted: '#93a6c4', accent: '#7ee8fa', grid: '#18233a', good: '#8cff9a', bad: '#ff7a7a', warn: '#ffd36a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: R.E.C, muted: R.E.l, ink: R.E.w, good: R.E.G, bad: R.E.R, warn: R.E.y })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'oskolok', strings: O.STR, theme: 'modern', themes: themes });
  O.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var Store = Arcade.Store, SAVE = 'arcade.save.oskolok', TKEY = 'arcade.besttime.oskolok', EKEY = 'arcade.endings.oskolok';

  var game = null, banner = null, hint = null, seen = {}, playSince = 0, shakeT = 0, lastWin = null, wantContinue = false, aim = null;
  function S() { return game.state(); }
  function loadSave() { try { var o = JSON.parse(Store.get(SAVE, 'null')); return o && o.chapter >= 1 && o.chapter <= O.CHAPTERS ? o : null; } catch (e) { return null; } }
  function writeSave(ch) { Store.set(SAVE, JSON.stringify({ chapter: ch, elapsed: Math.round(S().time * 10) / 10, deaths: S().deaths })); }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  function bestTime() { var v = parseFloat(Store.get(TKEY, '0')); return v > 0 ? v : null; }
  function endings() { var s = Store.get(EKEY, ''); return s ? s.split('') : []; }
  function clock(t) { t = Math.max(0, Math.round(t)); var m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function showHint(key, dur) { if (seen[key]) return; seen[key] = 1; hint = { text: g.t(key), a: dur || 5 }; }
  function sync() { if (!game) return; var s = S(); g.state.level = s.ch; g.state.score = Math.max(0, s.idx * 100 + (s.phase === 'won' ? Math.max(0, 3600 - Math.round(s.time)) : 0)); }

  function onEvent(type, d) {
    d = d || {};
    O.sfx(g, type, d);
    var s = game ? S() : null, P = g.th();
    var burst = function (x, y, col, n, sp) { g.particles.spawn(x * TS, y * TS, { color: col, count: n || 10, speed: sp || 80, life: 0.5, size: g.themeName === 'retro' ? 4 : 2.5 }); };
    switch (type) {
      case 'chapter': if (d.ch > 1) writeSave(d.ch); break;
      case 'screen':
        aim = null;
        if (d.ep === 1 && !d.restart) banner = { title: g.t('chapter') + ' ' + d.ch + ' · ' + g.t('ch' + d.ch), sub: '', a: 3.2, life: 3.2, big: true };
        else if (!d.restart) banner = { title: d.ch + ' · ' + d.ep, sub: '', a: 1.6, life: 1.6 };
        if (d.idx === 0) showHint('h_move', 5);
        if (d.idx === 2) setTimeout(function () { if (game && S().idx === 2) showHint('h_lever', 4); }, 600);
        if (d.idx === 4) showHint('h_breach', 6);
        if (d.idx === 5) showHint('h_crystal', 5);
        if (d.idx === 7) showHint('h_pulse', 6);
        if (d.idx === 10) showHint('h_dark', 5);
        break;
      case 'dronePick': setTimeout(function () { if (game) showHint('h_drone', 6); }, 4200); break;
      case 'alert': if (s && s.idx === 2) showHint('h_shield', 5); break;
      case 'glass': burst(d.x, d.y, g.themeName === 'retro' ? R.E.C : '#bff4ff', 6, 120); break;
      case 'shatter': burst(d.x, d.y - 1, g.themeName === 'retro' ? R.E.B : '#c8d4ff', 22, 140); shakeT = 0.15; break;
      case 'reflect': burst(d.x, d.y, g.themeName === 'retro' ? R.E.y : '#ffe8a0', 8, 90); break;
      case 'shardBreak': burst(d.x, d.y, g.themeName === 'retro' ? R.E.C : '#bff4ff', 4, 60); break;
      case 'crash': burst(d.x, d.y - 0.3, g.themeName === 'retro' ? R.E.C : '#d8f6ff', 14, 110); shakeT = 0.12; break;
      case 'crumble': burst(d.x, d.y, g.themeName === 'retro' ? R.E.l : '#9b8fb8', 6, 50); break;
      case 'breach': shakeT = 0.1; break;
      case 'fade': burst(d.x, d.y - 1, g.themeName === 'retro' ? R.E.m : '#3b2a52', 18, 70); break;
      case 'die': shakeT = 0.25; burst(d.x, d.y - 0.8, P.bad, 14, 100); aim = null; break;
      case 'win': {
        clearSave(); var bt = bestTime(); if (!bt || d.time < bt) Store.set(TKEY, String(Math.round(d.time)));
        var en = endings(); if (en.indexOf(d.ending) < 0) { en.push(d.ending); Store.set(EKEY, en.sort().join('')); }
        lastWin = d; sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 200); break;
      }
    }
    sync();
  }
  function newGame() {
    var sv = wantContinue ? loadSave() : null; wantContinue = false;
    if (!sv) clearSave();
    game = O.Game({ onEvent: onEvent, chapter: sv ? sv.chapter : 1, elapsed: sv ? sv.elapsed : 0 });
    banner = null; hint = null; seen = sv ? { h_move: 1, h_lever: 1, h_shield: 1, h_drone: 1 } : {}; lastWin = null; aim = null;
    game.start(); if (sv) S().deaths = sv.deaths || 0;
    O.current = game; sync();
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({});
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + g.t('chapter') + ' ' + sv.chapter + ' · ' + g.t('ch' + sv.chapter) : g.t('cont') + ' —'; },
    onSelect: function () { if (!loadSave()) { g.audio.beep(200, 0.06); return; } wantContinue = true; g.state.score = 0; g.goto('play'); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (game && (S().phase === 'play' || S().phase === 'dead')) game.restartScreen(); aim = null; g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.scenes.win.draw = function (ctx) {
    var retro = g.themeName === 'retro', th = g.th(); this.clear();
    R.titleArt(ctx, retro, this.time); ctx.fillStyle = retro ? 'rgba(0,0,0,.7)' : 'rgba(4,8,18,.66)'; ctx.fillRect(0, 0, VW, VH);
    this.text(this.t('win'), VW / 2, 120, { size: 44, align: 'center', color: th.accent, weight: 900 });
    if (lastWin) {
      this.text(this.t(lastWin.ending === 'B' ? 'endB' : 'endA'), VW / 2, 156, { size: 16, align: 'center', color: th.ink, weight: 800 });
      var bt = bestTime();
      this.text(this.t('time') + ': ' + clock(lastWin.time) + (bt ? '   ' + this.t('bestTime') + ': ' + clock(bt) : '') + '   ' + this.t('deaths') + ': ' + (lastWin.deaths + 1), VW / 2, 190, { size: 13, align: 'center', color: th.muted, weight: 700 });
      this.text(this.t('endings') + ': ' + endings().length + ' / 2', VW / 2, 214, { size: 12, align: 'center', color: th.muted, weight: 700 });
    }
    this.text(this.t('tapstart'), VW / 2, VH - 24, { size: 12, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', th = this.th();
    R.titleArt(ctx, retro, this.time);
    ctx.fillStyle = retro ? 'rgba(0,0,0,.55)' : 'rgba(4,8,18,.45)'; ctx.fillRect(0, 0, VW, VH);
    var pw = 380, ph = 300, x0 = (VW - pw) / 2, y0 = 26;
    if (retro) { ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, pw, ph); ctx.fillStyle = R.E.c; ctx.fillRect(x0, y0, pw, 2); ctx.fillRect(x0, y0 + ph - 2, pw, 2); ctx.fillRect(x0, y0, 2, ph); ctx.fillRect(x0 + pw - 2, y0, 2, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(10,16,30,.86)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, pw, ph, 14) : ctx.rect(x0, y0, pw, ph); ctx.fill(); ctx.restore(); }
    // заголовок с «гранью»
    this.text(this.t('title'), VW / 2, y0 + 56, { size: retro ? 44 : 50, align: 'center', color: th.accent, weight: 900 });
    if (!retro) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(VW / 2 - 120, y0 + 20); ctx.lineTo(VW / 2 - 60, y0 + 20); ctx.lineTo(VW / 2 - 100, y0 + 60); ctx.closePath(); ctx.fill(); }
    this.text(this.t('subtitle'), VW / 2, y0 + 82, { size: retro ? 11 : 12, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), VW / 2, y0 + 100, { size: retro ? 9 : 10, align: 'center', color: th.muted, weight: 600 });
    menu.draw(this, VW / 2, y0 + 136, 26);
    var bt = bestTime(), en = endings(), line = [];
    if (bt) line.push(this.t('bestTime') + ': ' + clock(bt));
    if (en.length) line.push(this.t('endings') + ': ' + en.length + ' / 2');
    if (line.length) this.text(line.join(' · '), VW / 2, y0 + ph - 14, { size: 11, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), VW / 2, VH - 10, { size: retro ? 9 : 10, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60, held = {}, pad = { charge: false, res: false };
  var JUMPK = { KeyZ: 1 }, RESK = { KeyX: 1, KeyJ: 1 }, CHK = { KeyC: 1, KeyK: 1, ShiftLeft: 1, ShiftRight: 1 }, DRK = { KeyF: 1, KeyE: 1 };
  function anyHeld(set) { for (var k in set) if (held[k]) return true; return false; }
  function aimToggle() {
    if (!game || S().phase !== 'play' || !S().drone.have) return;
    if (!aim) { var h = S().hero, d = S().drone; aim = { x: Math.max(0.5, Math.min(31.5, h.x + h.face * 5)), y: Math.max(0.5, h.y - 3), since: g.time }; }
    else { game.sendDrone(aim.x, aim.y); aim = null; }
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (a === 'pause') { aim = null; this.pause(); return; }
      if (!game) return;
      if (S().phase === 'cut' && (a === 'action' || a === 'start')) { game.skip(); return; }
      if (aim && (a === 'action' || a === 'start')) aimToggle();
    },
    update: function (dt) {
      if (!game) return;
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      if (hint) { hint.a -= dt; if (hint.a <= 0) hint = null; }
      if (shakeT > 0) shakeT -= dt;
      var dir = this.input.dir, live = g.time - playSince > 0.15, s = S();
      if (aim) {
        aim.x = Math.max(0.3, Math.min(31.7, aim.x + dir.x * 10 * dt)); aim.y = Math.max(0.3, Math.min(17.7, aim.y + dir.y * 10 * dt));
        if (s.phase !== 'play') aim = null;
        game.setInput({});
      } else {
        game.setInput({ x: live ? dir.x : 0, jump: live && (dir.y < 0 || anyHeld(JUMPK)), down: live && dir.y > 0,
          res: live && (this.input.pressed('action') || anyHeld(RESK) || pad.res), charge: live && (anyHeld(CHK) || pad.charge) });
      }
      var sl = aim ? 0.3 : 1, n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP * sl);
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      R.draw(this, ctx, S(), { banner: banner, hint: hint, aim: aim, shake: shakeT > 0 ? 4 : 0 });
    }
  });

  // ---------- доп. клавиши, тач-кнопки, клик по канве ----------
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play', c = e.code;
    if (JUMPK[c] || RESK[c] || CHK[c] || DRK[c] || c === 'KeyR') {
      if (ip) e.preventDefault();
      if (DRK[c] && !held[c] && ip) aimToggle();
      if (c === 'KeyR' && ip && game) { game.recallDrone(); aim = null; }
      held[c] = true;
    }
  });
  addEventListener('keyup', function (e) { held[e.code] = false; });
  addEventListener('blur', function () { held = {}; pad.charge = pad.res = false; });
  function hold(id, on, off) {
    var b = document.getElementById(id); if (!b) return;
    var h1 = function (e) { e.preventDefault(); on(); b.classList.add('on'); }, h0 = function (e) { e.preventDefault(); off(); b.classList.remove('on'); };
    b.addEventListener('touchstart', h1, { passive: false }); b.addEventListener('touchend', h0, { passive: false }); b.addEventListener('touchcancel', h0, { passive: false });
    b.addEventListener('mousedown', h1); b.addEventListener('mouseup', h0); b.addEventListener('mouseleave', function () { if (b.classList.contains('on')) { off(); b.classList.remove('on'); } });
  }
  hold('bCharge', function () { pad.charge = true; }, function () { pad.charge = false; });
  hold('bDrone', function () { if (g._sceneName === 'play') { if (game && S().phase === 'cut') game.skip(); else aimToggle(); } }, function () {});
  (function () {
    var b = document.getElementById('bPause'); if (!b) return;
    var h = function (e) { e.preventDefault(); aim = null; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  })();
  function canvasPoint(e) {
    if (g._sceneName !== 'play' || !game) return;
    var s = S(); if (s.phase === 'cut') { game.skip(); return; }
    if (s.phase !== 'play' || !s.drone.have) return;
    var r = g.canvas.getBoundingClientRect(), x = (e.clientX - r.left) * (VW / r.width) / TS, y = (e.clientY - r.top) * (VH / r.height) / TS;
    game.sendDrone(x, y); aim = null;
  }
  g.canvas.addEventListener('mousedown', function (e) { canvasPoint(e); });
  g.canvas.addEventListener('touchstart', function (e) { if (g._sceneName === 'play') { e.preventDefault(); canvasPoint(e.changedTouches[0]); } }, { passive: false });

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, padEl = document.querySelector('.pad');
    var padFixed = padEl && getComputedStyle(padEl).position === 'fixed';
    var padH = padEl && !padFixed && getComputedStyle(padEl).display !== 'none' ? padEl.offsetHeight + 16 : 0;
    var w = Math.min(1180, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
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
  O.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
