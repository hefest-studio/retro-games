/* ПОДГОРЬЕ · сборка: фреймворк Гефест Arcade (engine.js) + мир (world.js), физика, враги, боссы, логика (game.js),
   рендер обеих тем, HUD/карта (ui.js), сохранения (save.js), звук и музыка.
   Сцены: title (свой рисунок, «Играть» → слоты), slots (3 слота: выбор/новая/стереть), play, pause (карта мира + меню), win.
   Ввод: ←→/AD — бег; Пробел/Z/K — прыжок; X/J — искра (держать — заряд); ↑+X — вверх; C/Shift — рывок; F/V — крюк;
   E/Q — луч; ↓+X в воздухе — молот; ↓+прыжок — с мостков; ↑ — наковальня/лифт/горн; P/Esc — пауза с картой. */
(function (global) {
  'use strict';
  var P = global.PODGORYE, Rr = P.R, UI = P.UI, SV = P.SV, VW = Rr.VW, VH = Rr.VH, TS = Rr.TS;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120c08', panel: '#1c140e', ink: '#f6ece0', muted: '#b8a48e', accent: '#f0a64a', grid: '#2a1e16', good: '#9ce08a', bad: '#ff7a5a', warn: '#ffd36a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'podgorye', strings: P.STR, theme: 'modern', themes: themes });
  P.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  try { SV.legacy(); } catch (e) {}

  var W = P.WORLD(), game = null, slot = 1, banners = [], fx = [], shakeT = 0, lastWin = null, introT = 0;
  function S() { return game.state(); }
  function banner(title, sub, o) { o = o || {}; var life = o.life || 3; if (o.front) banners.unshift({ title: title, sub: sub, a: life, life: life, big: o.big, icon: o.icon }); else banners.push({ title: title, sub: sub, a: life, life: life, big: o.big, icon: o.icon }); if (banners.length > 5) banners.length = 5; }
  function burst(x, y, col, n, sp, life) { for (var i = 0; i < (n || 8); i++) { var a = Math.random() * 6.283, v = (sp || 6) * (0.3 + Math.random()); fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: life || 0.5, max: life || 0.5, col: col }); } if (fx.length > 300) fx.splice(0, fx.length - 300); }
  function musicFor(zone) { var id = W.zones[zone].music; return P.MUSIC[id] || P.MUSIC.gates; }
  function sync() { if (!game) return; g.state.score = game.percent(); g.state.level = S().zone + 1; }
  function writeSlot() { if (!game) return; try { SV.save(slot, game.snapshot()); } catch (e) {} }

  function onEvent(type, d) {
    d = d || {};
    P.sfx(g, type, d);
    var retro = g.themeName === 'retro', s = game ? S() : null;
    switch (type) {
      case 'zone': g.setMusic(musicFor(d.zone)); if (s && s.t > 0.5 || introT <= 0) banner(g.t('z' + d.zone), '', { big: true, life: 2.6, front: true }); break;
      case 'save': SV.save(slot, d.data); banner(g.t('saved'), '', { life: 1.8 }); burst(s.hero.x, s.hero.y - 1, retro ? '#ffff55' : '#ffd27a', 14, 5); break;
      case 'ability': banner(g.t('got') + ': ' + g.t('ab_' + d.ab), g.t('ab_' + d.ab + '_d'), { life: 5, icon: 'ab:' + d.ab, front: true }); burst(d.x, d.y - 1, retro ? '#ffff55' : '#ffe08a', 26, 7, 0.9); writeSlot(); break;
      case 'vessel': banner(g.t('vessel'), g.t('vessel_d'), { life: 3, icon: 'vessel' }); burst(d.x, d.y - 1, '#ff6a3a', 18, 6); writeSlot(); break;
      case 'tank': banner(g.t('tank'), g.t('tank_d'), { life: 3, icon: 'tank' }); burst(d.x, d.y - 1, '#9fe4ff', 18, 6); writeSlot(); break;
      case 'upgrade': banner(g.t('up:' + d.up), g.t('up:' + d.up + '_d'), { life: 4, icon: 'up:' + d.up }); burst(d.x, d.y - 1, '#e0b04c', 20, 6); writeSlot(); break;
      case 'forge': banner(g.t('forgeLit'), g.t('forgeN') + ': ' + d.n + ' / 5', { life: 3.5, front: true }); shakeT = 0.3; writeSlot(); break;
      case 'sealOpen': banner(g.t('sealOpen'), '', { life: 5 }); break;
      case 'liftOn': banner(g.t('liftOn'), '', { life: 1.6 }); break;
      case 'bossStart': g.setMusic(d.id === 'scale' ? P.MUSIC.final : P.MUSIC.boss); banner(g.t('boss') + ': ' + g.t('b_' + d.id), '', { big: true, life: 2.2, front: true }); shakeT = 0.3; break;
      case 'bossDown': g.setMusic(musicFor(S().zone)); banner(g.t('b_' + d.id) + ' — ' + g.t('bossDown'), '', { big: true, life: 3 }); burst(d.x, d.y, '#ffb040', 40, 10, 1.2); shakeT = 0.6; writeSlot(); break;
      case 'phase2': banner(g.t('phase2'), '', { life: 2.2, front: true }); shakeT = 0.5; break;
      case 'hurt': shakeT = 0.18; burst(d.x, d.y - 1, retro ? '#ff5555' : '#ff7a5a', 8, 5); break;
      case 'die': shakeT = 0.4; burst(d.x, d.y - 1, '#ffd27a', 30, 7, 1); break;
      case 'kill': burst(d.x, d.y, retro ? '#ffff55' : '#ffb070', 10, 6); break;
      case 'hit': burst(d.x, d.y, '#ffffff', 3, 3, 0.25); break;
      case 'hitWall': burst(d.x, d.y, retro ? '#ffff55' : '#ffd27a', 3, 3, 0.2); break;
      case 'clang': burst(d.x, d.y, '#cfd8e0', 4, 4, 0.25); break;
      case 'slamLand': shakeT = 0.15; burst(s.hero.x, s.hero.y, retro ? '#aaaaaa' : '#c8b8a0', 12, 6); break;
      case 'open': burst(d.x, d.y, d.kind === 9 ? '#fff0a0' : '#a89070', 16, 6, 0.7); shakeT = 0.12; break;
      case 'splash': burst(s.hero.x, s.hero.y - 0.3, retro ? '#55ffff' : '#9fe4ff', 10, 5); break;
      case 'shatter': burst(d.x, d.y, '#cfefff', 8, 5); break;
      case 'slam': if (d.x != null) shakeT = 0.2; break;
      case 'win': lastWin = d; var rec = SV.record(d.time, d.pct); lastWin.rec = rec; writeSlot(); sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 600); break;
    }
    sync();
  }
  function newGame(data) {
    game = P.Game({ onEvent: onEvent, save: data || null, seed: (Date.now() & 0xffff) + 1 });
    banners = []; fx = []; lastWin = null; introT = data ? 0 : 9;
    game.start(); sync();
    if (!data) { banner(g.t('intro1'), g.t('intro2'), { life: 5.5 }); banner(g.t('z0'), g.t('intro3'), { life: 5 }); }
    else banner(g.t('z' + S().zone), '', { big: true, life: 2.2 });
    P.current = game;
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({});
  var title = g.scenes.title, tmenu = g.menu.get('title');
  tmenu.items[0].onSelect = function () { g.goto('slots'); };
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', th = this.th();
    UI.titleArt(g, ctx, this.time);
    var pw = 400, ph = 250, x0 = (VW - pw) / 2, y0 = 70;
    UI.panel(g, ctx, x0, y0, pw, ph, retro, 0.78);
    this.text(this.t('title'), VW / 2, y0 + 50, { size: retro ? 40 : 46, align: 'center', color: th.accent, weight: 900 });
    this.text(this.t('subtitle'), VW / 2, y0 + 74, { size: 11, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), VW / 2, y0 + 90, { size: 9, align: 'center', color: th.muted, weight: 600 });
    tmenu.draw(this, VW / 2, y0 + 124, 26);
    var rc = SV.records(), line = [];
    if (rc.time) line.push(this.t('bestTime') + ': ' + UI.clock(rc.time));
    if (rc.pct) line.push(this.t('bestPct') + ': ' + rc.pct + '%');
    if (line.length) this.text(line.join(' · '), VW / 2, y0 + ph - 12, { size: 11, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), VW / 2, VH - 10, { size: 9, align: 'center', color: th.muted, weight: 600 });
  };
  // слоты
  var slotSel = 0, slotConfirm = false, slotsData = [];
  g.scene('slots', {
    realtime: true,
    enter: function () { slotsData = SV.list(); slotConfirm = false; },
    press: function (a) {
      if (slotConfirm) { slotConfirm = false; return; }
      if (a === 'up') { slotSel = (slotSel + 2) % 3; this.audio.beep(600, 0.03); }
      else if (a === 'down') { slotSel = (slotSel + 1) % 3; this.audio.beep(600, 0.03); }
      else if (a === 'action' || a === 'start') { slot = slotSel + 1; var d = slotsData[slotSel]; pendingLoad = d || null; pendingNew = true; this.goto('play'); }
      else if (a === 'pause') this.goto('title');
    },
    draw: function (ctx) { UI.slotsScreen(g, ctx, slotsData, slotSel, slotConfirm, this.time); }
  });
  g.canvas.addEventListener('click', function (e) {
    if (g._sceneName !== 'slots') return;
    var r = g.canvas.getBoundingClientRect(), y = (e.clientY - r.top) * (VH / r.height), i = Math.floor((y - 80) / 76);
    if (i >= 0 && i < 3) { if (slotSel === i) g.scenes.slots.press.call(g, 'action'); else slotSel = i; }
  });
  var pendingLoad = null, pendingNew = false;
  // пауза: карта мира + меню
  var pmenu = g.menu.get('pause');
  g.scenes.pause.draw = function (ctx) {
    var retro = g.themeName === 'retro', th = this.th();
    if (game) g.scenes.play.draw.call(this, ctx);
    ctx.fillStyle = retro ? 'rgba(0,0,0,0.75)' : 'rgba(6,4,2,0.66)'; ctx.fillRect(0, 0, VW, VH);
    if (game) UI.worldMap(g, ctx, S(), 34, null);
    this.text(this.t('pause'), 50, VH - 66, { size: 14, color: th.warn, weight: 900 });
    pmenu.draw(this, VW / 2, VH - 70, 22);
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.scenes.win.draw = function (ctx) {
    var retro = g.themeName === 'retro', th = this.th();
    UI.titleArt(g, ctx, this.time); ctx.fillStyle = retro ? 'rgba(0,0,0,0.65)' : 'rgba(8,4,2,0.55)'; ctx.fillRect(0, 0, VW, VH);
    this.text(this.t('endTitle'), VW / 2, 110, { size: retro ? 26 : 30, align: 'center', color: th.accent, weight: 900 });
    this.text(this.t('endSub'), VW / 2, 136, { size: 12, align: 'center', color: th.ink, weight: 700 });
    if (lastWin) {
      var rc = SV.records();
      this.text(this.t('time') + ': ' + UI.clock(lastWin.time) + '   ' + this.t('pct') + ': ' + lastWin.pct + '%   ' + this.t('deaths') + ': ' + lastWin.deaths, VW / 2, 178, { size: 14, align: 'center', color: th.ink, weight: 800 });
      this.text(this.t('bestTime') + ': ' + UI.clock(rc.time || lastWin.time) + (lastWin.rec && lastWin.rec.time ? ' ★' : '') + '   ' + this.t('bestPct') + ': ' + rc.pct + '%' + (lastWin.rec && lastWin.rec.pct ? ' ★' : ''), VW / 2, 202, { size: 12, align: 'center', color: th.muted, weight: 700 });
    }
    this.text(this.t('tapstart'), VW / 2, VH - 24, { size: 12, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60, held = {}, pad = {};
  var JUMPK = { KeyZ: 1, KeyK: 1 }, SHOOTK = { KeyX: 1, KeyJ: 1 }, DASHK = { KeyC: 1, ShiftLeft: 1, ShiftRight: 1 }, HOOKK = { KeyF: 1, KeyV: 1 }, BEAMK = { KeyE: 1, KeyQ: 1 };
  function anyHeld(set) { for (var k in set) if (held[k]) return true; return false; }
  var playSince = 0;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (pendingNew || !game) { pendingNew = false; newGame(pendingLoad); pendingLoad = null; g.setMusic(musicFor(S().zone)); }
      playSince = g.time;
    },
    press: function (a) {
      if (!game) return;
      var s = S();
      if (s.phase === 'lift') {
        if (a === 'up' || a === 'left') game.liftMove(-1); else if (a === 'down' || a === 'right') game.liftMove(1);
        else if (a === 'action' || a === 'start') game.liftGo(); else if (a === 'pause') game.liftCancel();
        return;
      }
      if (a === 'pause') { this.pause(); return; }
    },
    update: function (dt) {
      if (!game) return;
      if (shakeT > 0) shakeT -= dt; if (introT > 0) introT -= dt;
      var dir = this.input.dir, live = g.time - playSince > 0.15, s = S();
      if (s.phase === 'lift') { game.setInput({}); }
      else game.setInput({ x: live ? dir.x : 0, y: live ? dir.y : 0,
        jump: live && (this.input.pressed('action') || anyHeld(JUMPK)),
        shoot: live && (anyHeld(SHOOTK) || pad.shoot), dash: live && (anyHeld(DASHK) || pad.dash),
        hook: live && (anyHeld(HOOKK) || pad.hook), beam: live && (anyHeld(BEAMK) || pad.beam) });
      if (anyHeld({ KeyX: 1 }) && held.lift && s.phase === 'lift') game.liftCancel();
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      for (var i = fx.length - 1; i >= 0; i--) { var p = fx[i]; p.life -= dt; if (p.life <= 0) { fx.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 12 * dt; }
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var s = S(), retro = g.themeName === 'retro';
      Rr.draw(this, ctx, s, { shake: shakeT > 0 ? 5 : 0, after: function (cam) {
        fx.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.col; var sz = retro ? 3 : 2; ctx.fillRect(p.x * TS - cam.x - sz / 2, p.y * TS - cam.y - sz / 2, sz, sz); });
        ctx.globalAlpha = 1;
      } });
      UI.hud(this, ctx, s, {});
      UI.banners(this, ctx, banners, this.current === this.scenes.play ? 1 / 60 : 0);
      if (s.phase === 'dead') { ctx.fillStyle = retro ? 'rgba(0,0,0,0.6)' : 'rgba(10,4,2,' + Math.min(0.7, (1.6 - s.deadT) * 0.6) + ')'; ctx.fillRect(0, 0, VW, VH); this.text(this.t('dead'), VW / 2, VH / 2, { size: 16, align: 'center', color: this.th().warn, weight: 800 }); }
      if (s.phase === 'lift') UI.liftMenu(this, ctx, s, game);
    }
  });

  // ---------- клавиши, тач-кнопки ----------
  addEventListener('keydown', function (e) {
    var c = e.code, ip = g._sceneName === 'play';
    if (JUMPK[c] || SHOOTK[c] || DASHK[c] || HOOKK[c] || BEAMK[c]) { if (ip) e.preventDefault(); held[c] = true; }
    if (ip && game && S().phase === 'lift' && SHOOTK[c]) game.liftCancel();
    if (g._sceneName === 'slots') {
      if (slotConfirm && (c === 'KeyX' || c === 'Delete')) { SV.clear(slotSel + 1); slotsData = SV.list(); slotConfirm = false; e.preventDefault(); return; }
      if (!slotConfirm && (c === 'KeyX' || c === 'Delete' || c === 'Backspace') && slotsData[slotSel]) { slotConfirm = true; e.preventDefault(); }
    }
  });
  addEventListener('keyup', function (e) { held[e.code] = false; });
  addEventListener('blur', function () { held = {}; pad = {}; });
  function hold(id, name) {
    var b = document.getElementById(id); if (!b) return;
    var on = function (e) { e.preventDefault(); pad[name] = true; b.classList.add('on'); }, off = function (e) { e.preventDefault(); pad[name] = false; b.classList.remove('on'); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', function () { if (pad[name]) { pad[name] = false; b.classList.remove('on'); } });
  }
  hold('bShoot', 'shoot'); hold('bDash', 'dash'); hold('bHook', 'hook'); hold('bBeam', 'beam');
  (function () {
    var b = document.getElementById('bPause'); if (!b) return;
    var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') { if (game && S().phase === 'lift') game.liftCancel(); else g.pause(); } else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  })();

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, padEl = document.querySelector('.pad');
    var padFixed = padEl && getComputedStyle(padEl).position === 'fixed';
    var padH = padEl && !padFixed && getComputedStyle(padEl).display !== 'none' ? padEl.offsetHeight + 16 : 0;
    var w = Math.min(1280, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
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
  P.app = { g: g, game: function () { return game; }, clearBanners: function () { banners.length = 0; }, slot: function () { return slot; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
