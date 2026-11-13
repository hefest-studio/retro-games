/* ТЕНЬ · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук + кат-сцены.
   Сцены движка: title (перерисован), pause (+ «Сцена заново»), win, gameover (+ продолжение с начала сцены), свои: play, cut.
   Ввод: ←→/AD — бег; Пробел/Z — прыжок; X/J — серп; C/K — крюк; V/Shift — приём (или ↑ + серп); ↓ — присед/подкат.
   Тач: дпад, ● прыжок, ⚔ серп, ⚓ крюк, ✦ приём, II — пауза. */
(function (global) {
  'use strict';
  var TEN = global.TEN, L = TEN.logic, R = TEN.R, FX = R.FX, VW = R.VW, VH = R.VH, E = R.E;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0b1018', panel: '#141b24', ink: '#eef3ee', muted: '#9fb0a6', accent: '#6fd38c', grid: '#1e2a24', good: '#6fd38c', bad: '#ff6a6a', warn: '#ffcf5a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: E.Gl, muted: E.l, ink: E.w, good: E.Gl, bad: E.R, warn: E.y })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'ten', strings: TEN.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  TEN.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  var game = null, toasts = [], banner = null, tip = null, tipsShown = {}, playSince = 0, cam = { x: null, y: null }, pending = null;
  var held = {}, pad = {};
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.act; }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (Math.abs(toasts[i].y - y) < 12 && Math.abs(toasts[i].x - x) < 100 && toasts[i].t > toasts[i].life - 0.5) y -= 13;
    var life = big ? 1.7 : 1.0; toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big });
    if (toasts.length > 14) toasts.shift();
  }
  function showBanner(title, sub, dur, lines) { banner = { title: title, sub: sub, a: dur || 2.4, dur: dur || 2.4, lines: lines }; }
  function showTip(key, dur) { if (tipsShown[key]) return; tipsShown[key] = 1; tip = { text: g.t(key), a: dur || 4 }; }

  function onEvent(type, d) {
    d = d || {};
    TEN.sfx(g, type, d);
    var s = game ? S() : null, P = s && s.hero;
    switch (type) {
      case 'scene':
        toasts = []; FX.clear(); cam.x = null; tip = null;
        if (d.scene === 4) showBanner(g.t('boss'), g.t('act') + ' ' + d.act + ' · ' + g.t('a' + d.act), 2.2);
        else showBanner(g.t('act') + ' ' + d.act + ' · ' + g.t('a' + d.act), g.t('scene') + ' ' + d.scene + ' / 3', 2.2);
        if (d.act === 1 && d.scene === 1) showTip('t_wall', 5);
        if (d.act === 1 && d.scene === 2) showTip('t_duct', 5);
        break;
      case 'walljump': if (P) FX.add(P.x - P.face * 6, P.y - 12, { n: 5, sp: 60, c: col('#c8d4cc', E.l), r: 3, puff: true, g: 0, life: 0.35 }); break;
      case 'cling': if (P) FX.add(P.x + P.cling * 6, P.y - 10, { n: 3, sp: 30, c: col('#c8d4cc', E.l), r: 2, life: 0.25 }); break;
      case 'land': if (P && d.v > 450) FX.add(P.x, P.y, { n: 6, sp: 50, a: -Math.PI / 2, spread: 2.6, c: col('#c8d4cc', E.l), r: 3, puff: true, g: 0, life: 0.35 }); break;
      case 'slide': if (P) FX.add(P.x, P.y - 2, { n: 6, sp: 60, c: col('#c8d4cc', E.l), r: 3, puff: true, g: -20, life: 0.35 }); break;
      case 'hook': FX.add(d.x, d.y, { n: 6, sp: 80, c: col('#ffe066', E.y), r: 2, life: 0.25, g: 0 }); break;
      case 'fling': if (P) FX.add(P.x, P.y - 12, { n: 8, sp: 90, c: col('#9be7b0', E.Gl), r: 2, life: 0.3, g: 0 }); break;
      case 'special':
        if (d.k === 'smoke') FX.add(d.x, d.y - 12, { n: 22, sp: 90, c: col('#9aa4ae', E.g), r: 6, puff: true, g: -30, life: 1.1 });
        else if (d.k === 'fire') FX.add(d.x + d.face * 10, d.y - 6, { n: 10, sp: 120, a: d.face > 0 ? 0 : Math.PI, spread: 0.8, c: col('#ff7a2a', E.R), r: 3, life: 0.4 });
        else if (d.k === 'whirl') FX.add(d.x, d.y - 12, { n: 14, sp: 140, c: col('#9be7b0', E.Gl), r: 2, life: 0.4, g: 0 });
        break;
      case 'noCharge': if (P) toast(g.t('noCharge'), col('#9fb0a6', E.l), P.x, P.y - 34); break;
      case 'kill': toast('+' + d.pts, col('#ffcf5a', E.y), d.x, d.y - 12); FX.add(d.x, d.y, { n: 16, sp: 160, c: col('#c0582c', E.R), r: 2.2 }); FX.add(d.x, d.y, { n: 5, sp: 50, c: col('#cfd6dc', E.l), r: 4, puff: true, g: -40, life: 0.6 }); break;
      case 'enemyHit': case 'bossHit': FX.add(d.x, d.y, { n: 5, sp: 90, life: 0.25, c: col('#ffe066', E.y), r: 1.6 }); break;
      case 'parry': toast(g.t('parry'), col('#dfe5ec', E.w), d.x, d.y - 8); FX.add(d.x, d.y, { n: 6, sp: 90, life: 0.2, c: col('#ffffff', E.w), r: 1.6 }); break;
      case 'lamp': FX.add(d.x, d.y, { n: 10, sp: 110, c: col('#ffcf6a', E.y), r: 2, life: 0.4 }); break;
      case 'pickup':
        var txt = d.item.indexOf('sp:') === 0 ? g.t('sp_' + d.item.slice(3)) : g.t('i_' + d.item);
        toast(txt, col('#9be7b0', E.Gl), d.x, d.y - 16, d.item.indexOf('sp:') === 0 || d.item === 'life'); break;
      case 'hurt': FX.add(d.x, d.y - 12, { n: 10, sp: 130, c: col('#ff6a6a', E.R), r: 2 }); cam.shake = 0.18; break;
      case 'die': FX.add(d.x, d.y - 12, { n: 24, sp: 170, c: col('#4f8a5c', E.Gm), r: 2.4 }); FX.add(d.x, d.y - 12, { n: 10, sp: 70, c: col('#9aa4ae', E.g), r: 5, puff: true, g: -50, life: 0.9 }); break;
      case 'alarm': cam.shake = 0.12; if (P) toast(g.t('alarm'), col('#ff5a4a', E.R), P.x, P.y - 40, true); break;
      case 'boom': FX.add(d.x, d.y, { n: 18, sp: 180, life: 0.4, c: col('#ff9a3a', E.R), r: 2.6, g: 100 }); break;
      case 'boss': showBanner(g.t('b_' + d.k), g.t('boss'), 1.8); break;
      case 'bossBump': cam.shake = 0.3; break;
      case 'bossDown': FX.add(d.x, d.y, { n: 40, sp: 240, c: col('#ff9a3a', E.R), r: 3, life: 0.9 }); showBanner(g.t('bossDown'), '', 2); break;
      case 'clear':
        if (!d.boss) showBanner(g.t('clear'), g.t('act') + ' ' + d.act + ' · ' + g.t('scene') + ' ' + d.scene, 2.1, [g.t('tTime') + ': ' + Math.round(d.time) + ' ' + (g.i18n.lang === 'ru' ? 'с' : 's') + '   ' + g.t('tBonus') + ': +' + d.bonus]);
        break;
      case 'life': if (P) toast(g.t('life'), col('#ff8aa0', E.R), P.x, P.y - 46, true); break;
      case 'respawn': cam.x = null; toasts = []; break;
      case 'cut': pending = { cut: d.after }; break;
      case 'win': sync(); pending = { cut: 6 }; break;
      case 'gameover': sync(); g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 900); break;
    }
    sync();
  }
  function newGame() { game = TEN.Game({ onEvent: onEvent }); toasts = []; banner = null; tip = null; FX.clear(); cam = { x: null, y: null }; pending = null; game.start(); TEN.current = game; sync(); }
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (game) { game.restartScene(); sync(); } if (game && S().over) g.gameover(); else g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      if (!game) return;
      var s = S(), rt = retro();
      R.hero(ctx, this.W / 2, this.H / 2 - 50, { face: 1, state: name === 'win' ? 'idle' : 'crouch', t: this.time, rt: rt, scale: 2.2 });
      this.text(this.t('act') + ': ' + (s.won ? 6 : s.act) + '/6', this.W / 2, this.H / 2 + 46, { size: 13, align: 'center', color: this.th().muted, weight: 700 });
      if (name === 'gameover' && s.over) this.text(this.t('contHint'), this.W / 2, this.H / 2 + 70, { size: 12, align: 'center', color: this.th().accent, weight: 700 });
    };
  });
  g.scenes.gameover.press = function (a) {
    if ((a === 'action' || a === 'start') && game && S().over) { game.continueGame(); sync(); this.goto('play', { resume: true }); return; }
    if (a === 'pause' || a === 'action' || a === 'start') this.goto('title');
  };

  // ---------- Титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var rt = retro(), Wc = this.W, Hc = this.H, th = this.th(), time = this.time;
    var bg = R.bgLayers(1, rt);
    if (bg) { ctx.drawImage(bg.sky, 0, 0); var fx = -((time * 10) % 1280); ctx.drawImage(bg.far, fx, 0); ctx.drawImage(bg.far, fx + 1280, 0); var mx = -((time * 30) % 1024); ctx.drawImage(bg.mid, mx, 30); ctx.drawImage(bg.mid, mx + 1024, 30); }
    for (var i = 0; i < 2; i++) { var ba = -Math.PI / 2 + Math.sin(time * 0.5 + i * 2.2) * 0.6, bx = 140 + i * 360; ctx.globalAlpha = rt ? 0.3 : 0.14; ctx.fillStyle = rt ? E.Y : '#fff3c8'; ctx.beginPath(); ctx.moveTo(bx, Hc); ctx.lineTo(bx + Math.cos(ba - 0.07) * 600, Hc + Math.sin(ba - 0.07) * 600); ctx.lineTo(bx + Math.cos(ba + 0.07) * 600, Hc + Math.sin(ba + 0.07) * 600); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = rt ? 'rgba(0,0,0,.5)' : 'rgba(6,10,14,.45)'; ctx.fillRect(0, 0, Wc, Hc);
    var tt = this.t('title');
    ctx.save(); ctx.textAlign = 'center';
    if (!rt) {
      ctx.font = '900 64px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(tt, Wc / 2 + 4, 78);
      var lg = ctx.createLinearGradient(0, 30, 0, 78); lg.addColorStop(0, '#d8ffe2'); lg.addColorStop(0.55, '#6fd38c'); lg.addColorStop(1, '#2f5e3d'); ctx.fillStyle = lg; ctx.fillText(tt, Wc / 2, 74);
      ctx.strokeStyle = 'rgba(184,154,100,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(Wc / 2 + 106, 60); ctx.quadraticCurveTo(Wc / 2 + 60, 96, Wc / 2 - 130, 84); ctx.stroke();
    } else { ctx.font = 'bold 56px "Courier New", monospace'; ctx.fillStyle = E.G; ctx.fillText(tt, Wc / 2 + 3, 75); ctx.fillStyle = E.Gl; ctx.fillText(tt, Wc / 2, 72); }
    ctx.restore();
    this.text(this.t('subtitle'), Wc / 2, 100, { size: rt ? 12 : 13, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2, 118, { size: rt ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
    // героиня на стене и страж с прожектором
    var hy = 300;
    ctx.fillStyle = rt ? E.d : '#2b2f3c'; ctx.fillRect(70, 150, 24, Hc - 150); ctx.fillStyle = rt ? E.R : '#c0703c'; ctx.fillRect(70, 150, 24, 3);
    R.hero(ctx, 100, 236 + Math.sin(time * 1.4) * 3, { face: 1, state: 'cling', t: time, rt: rt, scale: 2.4 });
    ctx.fillStyle = rt ? E.d : '#2b2f3c'; ctx.fillRect(470, hy, 170, Hc - hy); ctx.fillStyle = rt ? E.R : '#c0703c'; ctx.fillRect(470, hy, 170, 3);
    var gx = 560 + Math.sin(time * 0.6) * 40, gf = Math.cos(time * 0.6) > 0 ? 1 : -1;
    R.cone(ctx, gx, hy - 28, (gf > 0 ? 0.3 : Math.PI - 0.3) + Math.sin(time * 1.3) * 0.2, 150, 0.3, rt, false);
    R.enemy(ctx, { k: 'guard', x: gx, y: hy, face: gf, sx: 0, state: 'idle', cd: 0 }, time, rt, false);
    menu.draw(this, Wc / 2, 156, 28);
    var best = this.state.best;
    if (best) this.text(this.t('best') + ': ' + best, Wc / 2, 292, { size: 12, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), Wc / 2, Hc - 12, { size: rt ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- Кат-сцены ----------
  var cut = { idx: 0, i: 0, ch: 0 };
  function cutLines(ctx, text, maxW) {
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) { var tst = cur ? cur + ' ' + w : w; if (ctx.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; });
    if (cur) lines.push(cur); return lines;
  }
  function cutDone() {
    var idx = cut.idx;
    if (idx === 6) { g.win(); return; }
    if (idx > 0 && game && S().phase === 'cut') game.nextAct();
    g.goto('play', { resume: true });
  }
  g.scene('cut', {
    realtime: true,
    enter: function (d) { cut = { idx: d.idx || 0, i: 0, ch: 0 }; },
    update: function (dt) { cut.ch += dt * 42; },
    press: function (a) {
      var panels = TEN.STORY[cut.idx], P = panels[cut.i], txt = P[g.i18n.lang] || P.ru;
      if (a === 'pause') { cutDone(); return; }
      if (a !== 'action' && a !== 'start' && a !== 'right') return;
      if (cut.ch < txt.length) { cut.ch = txt.length; return; }
      cut.i++; cut.ch = 0; this.audio.beep(660, 0.04, 'triangle');
      if (cut.i >= panels.length) cutDone();
    },
    draw: function (ctx) {
      var rt = retro(), th = this.th(), panels = TEN.STORY[cut.idx], P = panels[Math.min(cut.i, panels.length - 1)], txt = P[g.i18n.lang] || P.ru;
      this.clear(rt ? '#000' : '#0a0d12');
      var px = 40, py = 22, pw = VW - 80, ph = 236;
      ctx.save(); ctx.translate(px, py); ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.clip();
      R.art(ctx, P.art, pw, ph, this.time, rt);
      if (!rt) { // полутон комикса
        ctx.globalAlpha = 0.08; ctx.fillStyle = '#000'; for (var y = 0; y < ph; y += 6) for (var x = (y / 6 % 2) * 3; x < pw; x += 6) ctx.fillRect(x, y, 2, 2); ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.strokeStyle = rt ? E.w : '#eef3ee'; ctx.lineWidth = rt ? 2 : 3; ctx.strokeRect(px, py, pw, ph);
      // подпись
      var by = py + ph + 12;
      ctx.fillStyle = rt ? '#000' : '#f4efe2'; ctx.fillRect(px, by, pw, 80); ctx.strokeStyle = rt ? E.w : '#1a1a1a'; ctx.lineWidth = 2; ctx.strokeRect(px, by, pw, 80);
      ctx.font = (rt ? 'bold 13px "Courier New", monospace' : '700 14px Inter, system-ui, sans-serif');
      var shown = txt.slice(0, Math.floor(cut.ch)), lines = cutLines(ctx, txt, pw - 28), acc = 0;
      lines.forEach(function (ln, k) { var part = shown.slice(acc, acc + ln.length); acc += ln.length + 1; g.text(part, px + 14, by + 24 + k * 19, { size: rt ? 13 : 14, weight: 700, color: rt ? E.w : '#1a1a1a', font: rt ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif' }); });
      this.text((cut.i + 1) + '/' + panels.length + '   ' + this.t('skip'), VW / 2, VH - 4, { size: 10, align: 'center', color: th.muted, weight: 600 });
    }
  });

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      playSince = g.time;
      if (!(d && d.resume) || !game) { newGame(); this.goto('cut', { idx: 0 }); }
    },
    press: function (a) {
      if (a === 'pause') { this.pause ? this.pause() : this.goto('pause'); return; }
      if (a === 'action' && inPlay()) game.press('jump');
    },
    update: function (dt) {
      if (!game) return;
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (q) { return q.t > 0; });
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      if (tip) { tip.a -= dt; if (tip.a <= 0) tip = null; }
      var dir = this.input.dir, live = inPlay();
      var jump = live && (this.input.pressed('action') || held.KeyZ || pad.jump);
      game.setInput(live ? dir.x : 0, live ? dir.y : 0, jump);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n && !pending; k++) game.update(STEP);
      var s = S();
      if (s.act === 1 && s.scene === 1 && s.LV.rings.length && Math.abs(s.LV.rings[0].x - s.hero.x) < 230) showTip('t_hook', 4.5);
      FX.step(dt);
      R.camera(cam, s, dt, cam.x == null);
      if (cam.shake > 0) cam.shake -= dt;
      sync();
      if (pending) { var p = pending; pending = null; if (p.cut != null) this.goto('cut', { idx: p.cut }); }
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var c2 = cam;
      if (cam.shake > 0) c2 = { x: cam.x + (Math.random() - 0.5) * 5, y: cam.y + (Math.random() - 0.5) * 5 };
      TEN.render(this, ctx, S(), { toasts: toasts, banner: banner, cam: c2, tip: tip });
    }
  });
  g.pause = g.pause || function () { this.goto('pause'); };

  // ---------- Доп. клавиши и тач-кнопки ----------
  var KEYS = { KeyZ: 'jump', KeyX: 'strike', KeyJ: 'strike', KeyC: 'hook', KeyK: 'hook', KeyV: 'special', ShiftLeft: 'special', ShiftRight: 'special' };
  addEventListener('keydown', function (e) {
    var a = KEYS[e.code]; if (!a) return;
    var ip = g._sceneName === 'play';
    if (ip) e.preventDefault();
    if (a === 'jump') held.KeyZ = true;
    if (ip && inPlay() && !e.repeat) game.press(a);
    if (!ip && g._sceneName === 'cut' && (a === 'jump' || a === 'strike') && !e.repeat) g.scenes.cut.press.call(g, 'action');
  });
  addEventListener('keyup', function (e) { if (e.code === 'KeyZ') held.KeyZ = false; });
  addEventListener('blur', function () { held = {}; pad = {}; });
  function bindBtn(id, act) {
    var b = document.getElementById(id); if (!b) return;
    var on = function (e) { e.preventDefault(); if (act === 'jump') pad.jump = true; if (inPlay()) game.press(act); else if (g._sceneName === 'cut') g.scenes.cut.press.call(g, 'action'); };
    var off = function (e) { e.preventDefault(); if (act === 'jump') pad.jump = false; };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
  }
  bindBtn('bAtk', 'strike'); bindBtn('bHook', 'hook'); bindBtn('bSp', 'special');
  (function () {
    var b = document.getElementById('bPause'); if (!b) return;
    var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.goto('pause'); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  })();

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, padEl = document.querySelector('.pad');
    var padFixed = padEl && getComputedStyle(padEl).position === 'fixed';
    var padH = padEl && !padFixed && getComputedStyle(padEl).display !== 'none' ? padEl.offsetHeight + 16 : 0;
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
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  TEN.app = { g: g, game: function () { return game; }, cam: function () { return cam; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
