/* ЛИСТ · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens (титул перерисован). Камера — плавный переход между панелями.
   Ввод: ←→/AD — ход; ↑/W/Z/K — прыжок; X/J/Пробел — удар; ↓/S — блок; C/H — захват/бросок; E/V — предмет;
   Q — следующая ячейка, 1/2/3 — выбор; тач: дпад (▲ прыжок, ▼ блок), ● удар, ✊ захват, ★ предмет, ⇄ ячейка, II пауза.
   Рекорд — arcade.best.list (движок). Музыка — Arcade.tracks.list / 'list:2' / 'list:3' / 'list:boss' (js/music.js). */
(function (global) {
  'use strict';
  var LI = global.LIST, LG = LI.logic, R = LI.R, FX = R.FX, VW = R.VW, VH = R.VH, LV = LI.levels;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#2b2420', panel: '#3a302a', ink: '#f6ecd6', muted: '#c9b99a', accent: '#d0402c', grid: '#4a3f34', good: '#7bd389', bad: '#ff6b5a', warn: '#ffd23a', font: 'Georgia, "Times New Roman", serif' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ff5555', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'list', strings: LI.STR, theme: 'modern', lives: LG.K.LIVES, themes: themes });
  LI.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  var game = null, banner = null, cam = { x: 0, y: 0 }, playSince = 0, pad = { grab: false, use: false, slot: false }, shake = 0, lastSel = 0;
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.ch; }
  function retro() { return g.themeName === 'retro'; }
  function ono(kind) { var L = LI.ONO[g.i18n.lang] || LI.ONO.ru, a = L[kind] || L.hit; return a[Math.floor(Math.random() * a.length)]; }
  function showBanner(title, sub, dur, lines) { banner = { title: title, sub: sub, a: dur || 2.4, dur: dur || 2.4, lines: lines }; }
  function msg(s) { if (game) S().msg = { s: s, t: 1.6 }; }
  function track(kind) { var t = Arcade.tracks || {}; if (kind === 'boss') return t['list:boss'] || t.list; var ch = S().ch; return (ch > 1 && t['list:' + ch]) || t.list; }
  function inkC(m, r) { return retro() ? r : m; }

  function onEvent(type, d) {
    d = d || {};
    LI.sfx(g, type, d);
    var E = R.E, s = game ? S() : null;
    switch (type) {
      case 'page':
        FX.clear(); g.setMusic(track()); cam.snap = true;
        showBanner(g.t('ch') + ' ' + d.ch + ' · ' + g.t('ch' + d.ch), d.pg === 1 ? g.t('chSub' + d.ch) : g.t('pg') + ' ' + d.pg, 2.6); break;
      case 'panel': FX.clear(); break;
      case 'hit': FX.add(d.x, d.y, { n: d.big ? 10 : 6, sp: 90, c: inkC('#1d1915', E.k), r: 1.6, life: 0.35 }); if (d.big || Math.random() < 0.55) FX.word(d.x, d.y - 12, ono(d.big ? 'big' : 'hit'), { big: d.big }); if (d.boss || d.big) shake = Math.max(shake, 0.12); break;
      case 'whiff': if (Math.random() < 0.5) FX.word(d.x, d.y - 6, ono('whiff'), { col: inkC('#f4f0e6', E.w) }); break;
      case 'wall': FX.word(d.x, d.y - 6, ono('wall'), { col: inkC('#e8d8b8', E.l) }); FX.add(d.x, d.y, { n: 4, sp: 50, c: inkC('#8a7a64', E.d), r: 1.2, life: 0.3 }); break;
      case 'eblock': case 'blocked': FX.word(d.x, d.y - 8, ono('block'), { col: inkC('#cfe6ff', E.C) }); break;
      case 'kill': FX.add(d.x, d.y, { n: 18, sp: 120, c: inkC('#1d1915', E.k), r: 2.2, life: 0.6 }); FX.word(d.x, d.y - 14, ono('kill'), {}); break;
      case 'tear': FX.word(d.x + (d.side === 'L' ? 18 : -18), d.y - 6, ono('tear'), { big: true }); FX.add(d.x, d.y, { n: 16, sp: 120, c: inkC('#f4ecd8', E.w), r: 2.5, life: 0.7, sq: true }); shake = 0.25; if (d.opened) msg('→'); break;
      case 'bonk': FX.word(d.x, d.y - 8, ono('bonk'), {}); break;
      case 'bonkWall': FX.word(d.x, d.y - 8, ono('bonk'), { big: true }); shake = 0.3; break;
      case 'boom': FX.word(d.x, d.y - 10, ono('boom'), { big: true }); FX.add(d.x, d.y, { n: 26, sp: 160, c: inkC('#2b3a8a', E.b), r: 2.6, life: 0.7 }); shake = 0.3; break;
      case 'draw': FX.word(d.x + 20, d.y - 30, ono('draw'), { col: inkC('#dce8ff', E.C), life: 0.9 }); break;
      case 'drawn': FX.add(d.x + 20, S().hero.y - 4, { n: 10, sp: 60, c: inkC('#5f86c0', E.B), r: 1.4 }); break;
      case 'lever': FX.word(d.x, d.y - 14, ono('lever'), {}); break;
      case 'frameDown': FX.word(d.x, d.y - 20, ono('frame'), { big: true }); FX.add(d.x, d.y, { n: 16, sp: 120, c: inkC('#b07a3a', E.n), r: 2, life: 0.5 }); shake = 0.25; break;
      case 'slam': FX.word(d.x, d.y - 30, ono('slam'), { big: true }); FX.add(d.x, d.y, { n: 20, sp: 160, a: -Math.PI / 2, spread: 2.6, c: inkC('#22142e', E.m), r: 2.4 }); shake = 0.35; break;
      case 'erase': FX.word(d.x, d.y - 14, ono('erase'), { col: inkC('#ffffff', E.w) }); break;
      case 'hurt': FX.add(d.x, d.y, { n: 10, sp: 100, c: inkC('#2b3a8a', E.B), r: 2, life: 0.5 }); shake = Math.max(shake, 0.18); break;
      case 'heal': FX.add(d.x, d.y, { n: 10, sp: 60, c: inkC('#3b5bd6', E.B), r: 1.6, g: -60 }); msg(g.t('heal') + ' +' + d.n); break;
      case 'letter': FX.add(d.x, d.y, { n: 10, sp: 70, c: inkC('#d0281c', E.r), r: 1.5 }); msg('+' + (d.pts || LG.K.PTS.letter)); break;
      case 'sheet': msg(g.t('sheet')); break;
      case 'pick': msg(g.t('it_' + d.k) + (d.swap ? ' · ' + g.t('full') : '')); break;
      case 'noSketch': msg(g.t('noSketch')); break;
      case 'empty': msg(g.t('empty')); break;
      case 'useMark': msg(g.t('shield')); break;
      case 'clear': msg(g.t('clear')); break;
      case 'clean': break;
      case 'die': shake = 0.4; showBanner(g.t('d_' + (d.why || 'hurt')) || g.t('d_hurt'), (s.lives - 1) > 0 ? g.t('lifeLeft').replace('{n}', s.lives - 1) : g.t('noLives'), 1.6); break;
      case 'respawn': cam.snap = true; break;
      case 'turn': showBanner(g.t('pageTurn'), '', 1.2); break;
      case 'bossIn': g.setMusic(track('boss')); g.audio.music.play(true); showBanner(g.t('b_' + d.type), g.t('ch') + ' ' + s.ch, 1.8); break;
      case 'bossDown': FX.add(d.x, d.y - 20, { n: 40, sp: 200, c: inkC('#1d1915', E.k), r: 3, life: 1.2 }); FX.word(d.x, d.y - 40, ono('big'), { big: true, life: 1.2 }); shake = 0.5; break;
      case 'ending': showBanner(g.t('end' + d.v), g.t('ch') + ' ' + d.ch + ' · ' + g.t('ch' + d.ch), 4.2, R.wrap(g.ctx, g.t('end' + d.ch + d.v), 420, 11)); break;
      case 'chapter': g.setMusic(track()); break;
      case 'gameover': sync(); g.state.lives = 0; break;
      case 'win': sync(); break;
    }
    sync();
  }

  function newGame() { game = LI.Game({ seed: (Date.now() & 0xffff) + 1, onEvent: onEvent }); FX.clear(); banner = null; game.start(); LI.current = game; sync(); cam.snap = true; }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: LG.K.LIVES });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (game) game.restartPanel(); g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      R.setRetro(retro());
      var h = { x: this.W / 2, y: this.H / 2 - 40, face: 1, ground: true, vx: 0, walkT: 0, inv: 0, shield: 0, hurt: 0, atk: 0, jk: 0, drawT: 0 };
      ctx.save(); ctx.translate(this.W / 2, this.H / 2 - 40); ctx.scale(2.2, 2.2); ctx.translate(-this.W / 2, -(this.H / 2 - 40));
      R.hero(ctx, h, this.time, { pose: name === 'win' ? 'atk2' : 'hurt', still: true }); ctx.restore();
      if (game) this.text(this.t('level') + ': ' + S().ch + '/3' + (S().endings.length ? '   ' + S().endings.join(' ') : ''), this.W / 2, this.H / 2 + 50, { size: 13, align: 'center', color: this.th().muted, weight: 700 });
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  var titleS = null;
  title.draw = function (ctx) {
    var rt = retro(), t = this.time, th = this.th(); R.setRetro(rt);
    var E = R.E;
    ctx.fillStyle = rt ? '#000' : '#2b2420'; ctx.fillRect(0, 0, VW, VH);
    // разворот книги
    var px = 40, py = 20, pw = VW - 80, ph = VH - 40;
    ctx.fillStyle = rt ? E.l : '#efe4c8'; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = rt ? E.d : 'rgba(0,0,0,.15)'; ctx.fillRect(VW / 2 - 2, py, 4, ph);
    ctx.strokeStyle = rt ? E.k : '#1d1915'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
    // левая страница — панели-заставки с героем и кляксами
    var p1 = { x: 56, y: 36, w: 250, h: 130 };
    ctx.fillStyle = rt ? E.n : '#ecd29a'; ctx.fillRect(p1.x, p1.y, p1.w, p1.h);
    ctx.fillStyle = rt ? E.k : '#8a5a2e'; ctx.fillRect(p1.x, p1.y + p1.h - 22, p1.w, 22);
    ctx.save(); ctx.beginPath(); ctx.rect(p1.x, p1.y, p1.w, p1.h); ctx.clip();
    if (!titleS) titleS = { h: { x: 0, y: 0, face: 1, ground: true, vx: 0, walkT: 0, inv: 0, shield: 0, hurt: 0, atk: 0.1, combo: 0, jk: 0, drawT: 0 } };
    var cyc = Math.floor(t * 1.5) % 3; titleS.h.combo = cyc;
    ctx.save(); ctx.translate(p1.x + 90, p1.y + p1.h - 22); ctx.scale(2.4, 2.4); titleS.h.x = 0; titleS.h.y = 0; R.hero(ctx, titleS.h, t, { pose: 'atk' + cyc, still: true }); ctx.restore();
    ctx.save(); ctx.translate(p1.x + 170, p1.y + p1.h - 22); ctx.scale(2.4, 2.4); R.enemy(ctx, { type: 'blot', x: 0, y: 0, face: -1, state: 'idle', hurt: cyc === 2 ? 0.1 : 0, wind: 0, id: 3, w: 14, h: 12 }, t, -10); ctx.restore();
    ctx.restore();
    ctx.strokeStyle = rt ? E.k : '#1d1915'; ctx.lineWidth = 2.5; ctx.strokeRect(p1.x, p1.y, p1.w, p1.h);
    // ономатопея
    var words = (LI.ONO[g.i18n.lang] || LI.ONO.ru).hit; drawWord(ctx, p1.x + 150, p1.y + 42, words[Math.floor(t * 1.5) % words.length], rt);
    var p2 = { x: 56, y: 178, w: 120, h: 120 }, p3 = { x: 186, y: 178, w: 120, h: 120 };
    [p2, p3].forEach(function (p, i) {
      ctx.fillStyle = rt ? (i ? E.m : E.c) : (i ? '#f2d6cf' : '#c9dccb'); ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = rt ? E.k : (i ? '#8e3b30' : '#3f6b52'); ctx.fillRect(p.x, p.y + p.h - 18, p.w, 18);
      ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h - 18); ctx.scale(1.9, 1.9);
      if (i === 0) R.enemy(ctx, { type: 'guard', x: 0, y: 0, face: 1, state: 'idle', hurt: 0, stun: 0, wind: Math.sin(t * 2) > 0 ? 0.3 : 0, atkT: 0, id: 1 }, t, 10);
      else R.enemy(ctx, { type: 'nib', x: 0, y: -14 + Math.sin(t * 3) * 3, face: -1, state: 'idle', hurt: 0, wind: 0, atkT: 0, id: 2 }, t, -10);
      ctx.restore();
      ctx.strokeStyle = rt ? E.k : '#1d1915'; ctx.lineWidth = 2.5; ctx.strokeRect(p.x, p.y, p.w, p.h);
    });
    // правая страница — заглавие и меню
    var cx = VW * 0.73, tt = this.t('title');
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = rt ? 'bold 50px "Courier New", monospace' : '900 58px Georgia, "Times New Roman", serif';
    ctx.fillStyle = rt ? E.k : 'rgba(29,25,21,.25)'; ctx.fillText(tt, cx + 3, 84);
    ctx.fillStyle = rt ? E.r : '#c0392b'; ctx.fillText(tt, cx, 81);
    ctx.strokeStyle = rt ? E.k : '#1d1915'; ctx.lineWidth = 1.5; ctx.strokeText(tt, cx, 81);
    ctx.restore();
    var sub = R.wrap(ctx, this.t('subtitle'), 250, 11);
    sub.forEach(function (l, i) { g.text(l, cx, 102 + i * 13, { size: 11, align: 'center', color: rt ? E.k : '#3a2a1a', weight: 700 }); });
    menu.draw(this, cx, 150, 26);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, cx, VH - 66, { size: 12, align: 'center', color: rt ? E.d : '#6a5a4a', weight: 700 });
    R.wrap(ctx, this.t('sub2'), 240, 10).forEach(function (l, i) { g.text(l, cx, VH - 48 + i * 12, { size: 10, align: 'center', color: rt ? E.d : '#6a5a4a', weight: 600 }); });
    this.text(this.t('hint'), VW / 2, VH - 6, { size: rt ? 9 : 10, align: 'center', color: rt ? E.w : '#f6ecd6', weight: 600 });
  };
  function drawWord(ctx, x, y, s, rt) {
    var E = R.E; ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12);
    ctx.beginPath(); var n = 12; for (var i = 0; i < n * 2; i++) { var rr = i % 2 ? 18 : 28, a = i / (n * 2) * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr * 1.6, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = rt ? E.y : '#ffd23a'; ctx.fill(); ctx.strokeStyle = rt ? E.k : '#1d1915'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = rt ? 'bold 18px "Courier New", monospace' : '900 20px Georgia, serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeText(s, 0, 7); ctx.fillStyle = rt ? E.r : '#d0281c'; ctx.fillText(s, 0, 7); ctx.restore();
  }
  // меню на светлой странице — тёмный текст
  var mDraw = menu.draw;
  menu.draw = function (eng, x, y, gap) {
    var th = eng.th(), save = { ink: th.ink, muted: th.muted };
    if (eng._sceneName === 'title') { th.ink = retro() ? '#000000' : '#1d1915'; th.muted = retro() ? '#555555' : '#6a5a4a'; }
    mDraw.call(this, eng, x, y, gap); th.ink = save.ink; th.muted = save.muted;
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60, VWU = VW / R.Z, VHU = VH / R.Z;
  function camTarget() {
    var s = S(), sp = game.spec(), h = s.hero, cx, cy;
    cy = sp.y + sp.h / 2 + 6;
    if (sp.w <= VWU - 30) cx = sp.x + sp.w / 2;
    else cx = Math.max(sp.x + VWU / 2 - 24, Math.min(sp.x + sp.w - VWU / 2 + 24, sp.x + h.x));
    return { x: cx, y: cy };
  }
  function updCam(dt) {
    var tg = camTarget(), k = S().phase === 'trans' ? 7 : 5;
    if (cam.snap) { cam.x = tg.x; cam.y = tg.y; cam.snap = false; return; }
    cam.x += (tg.x - cam.x) * Math.min(1, dt * k); cam.y += (tg.y - cam.y) * Math.min(1, dt * k);
  }
  function drawPlay(ctx) {
    var c2 = cam; if (shake > 0) c2 = { x: cam.x + (Math.random() - 0.5) * 5, y: cam.y + (Math.random() - 0.5) * 5 };
    R.draw(g, ctx, S(), game, { cam: c2, banner: banner });
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); else g.setMusic(track(S().boss ? 'boss' : null)); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      if (shake > 0) shake -= dt;
      var s = S(); if (s.msg) s.msg.t -= dt;
      var dir = this.input.dir, live = g.time - playSince > 0.15, cd = this.input.codes;
      var sel = cd.Digit1 ? 1 : cd.Digit2 ? 2 : cd.Digit3 ? 3 : 0;
      game.setInput({
        x: dir.x,
        jump: live && (dir.y < 0 || !!cd.KeyZ || !!cd.KeyK),
        atk: live && (this.input.pressed('action') || !!cd.KeyX || !!cd.KeyJ),
        block: live && dir.y > 0,
        grab: live && (!!cd.KeyC || !!cd.KeyH || pad.grab),
        use: live && (!!cd.KeyE || !!cd.KeyV || pad.use),
        slot: live && (!!cd.KeyQ || pad.slot), sel: sel
      });
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      FX.step(dt);
      updCam(dt); sync();
      s = S();
      if (s.phase === 'over' && s.phaseT > 0.2) { g.gameover(); return; }
      if (s.phase === 'won' && s.phaseT > 0.4) { g.win(); return; }
    },
    draw: function (ctx) { if (!game) { this.clear(); return; } drawPlay(ctx); }
  });

  // ---------- клавиши и тач-кнопки ----------
  addEventListener('keydown', function (e) {
    if (g._sceneName === 'play' && { KeyZ: 1, KeyX: 1, KeyJ: 1, KeyK: 1, KeyC: 1, KeyH: 1, KeyE: 1, KeyV: 1, KeyQ: 1, Digit1: 1, Digit2: 1, Digit3: 1 }[e.code]) e.preventDefault();
  });
  addEventListener('blur', function () { pad.grab = pad.use = pad.slot = false; });
  function holdBtn(id, key) {
    var b = document.getElementById(id); if (!b) return;
    var on = function (e) { e.preventDefault(); pad[key] = true; }, off = function (e) { e.preventDefault(); pad[key] = false; };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
  }
  holdBtn('bGrab', 'grab'); holdBtn('bUse', 'use'); holdBtn('bSlot', 'slot');
  (function () {
    var bp = document.getElementById('bPause');
    if (bp) { var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; bp.addEventListener('touchstart', h, { passive: false }); bp.addEventListener('mousedown', h); }
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
  LI.app = { g: g, game: function () { return game; }, cam: function () { return cam; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
