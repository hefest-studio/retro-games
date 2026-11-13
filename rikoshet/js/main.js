/* РИКОШЕТ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js, levels.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован (демо-партия за панелью меню),
   в меню — «Режим: Кампания/Бесконечный» и «Начать со стены» (открытые стены кампании), рекорд — отдельный на режим.
   Ввод: мышь / палец (ракетка за указателем), ← → / A D; Пробел / клик / тап — запуск, отпуск с липкой, лазер (удержание — очередь);
   II — пауза (тач). */
(function (global) {
  'use strict';
  var R = global.RIK, L = R.logic, K = L.K, RN = R.render;
  var TH = Arcade.themes || {}, Store = Arcade.Store;
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120e0c', panel: '#1c1512', ink: '#f6efe6', muted: '#a3978c', accent: '#ff5e1a', grid: '#2c2420' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: K.W, height: K.H, gameId: 'rikoshet', strings: R.STR, theme: 'modern', lives: K.LIVES, themes: themes });
  R.g = g;

  // ---------- режим, прогресс, рекорды по режимам ----------
  var MKEY = 'arcade.rikoshet.mode', UKEY = 'arcade.rikoshet.unlocked';
  var mode = Store.get(MKEY, 'campaign') === 'endless' ? 'endless' : 'campaign';
  var startLv = 1;
  function unlocked() { return Math.max(1, Math.min(30, parseInt(Store.get(UKEY, '1'), 10) || 1)); }
  function bestKey(m) { return 'arcade.best.rikoshet' + ((m || mode) === 'endless' ? '.endless' : ''); }
  g.loadBest = function () { return Store.getNum(bestKey(), 0); };
  g.saveBest = function () { var b = this.loadBest(); if (this.state.score > b) Store.set(bestKey(), String(this.state.score)); this.state.best = Math.max(b, this.state.score); };
  g.state.best = g.loadBest();
  function setMode(m) { mode = m; Store.set(MKEY, m); g.state.best = g.loadBest(); startLv = 1; refreshMenu(); }

  var P = function () { return g.themeName === 'retro' ? RN.PR : RN.PM; };
  var game = null, toasts = [], banner = null, playSince = 0, shake = 0, lastLevel = 1, endT = 0;
  var ptrDown = false, kbFire = false;
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.level; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (Math.abs(toasts[i].y - y) < 14 && toasts[i].t > toasts[i].life - 0.5) y -= 16;
    var life = big ? 1.8 : 1.1; toasts.push({ text: text, color: color, x: Math.max(70, Math.min(K.W - 70, x)), y: y, t: life, life: life, big: !!big });
  }
  function showBanner(title, sub, dur, col) { banner = { title: title, sub: sub, a: dur || 2, col: col }; }
  var ORE = { a: '#e0563a', b: '#e08a48', c: '#f2c64a', d: '#9cecf6', e: '#4fd093', f: '#b98af0' };
  function brickColor(d) {
    var retro = g.themeName === 'retro';
    if (d.type === 'n') return retro ? RN.PR.ore[d.color][0] : ORE[d.color];
    return { s: retro ? '#aaaaaa' : '#b8c0ca', x: retro ? '#ff5555' : '#ff6a3a', m: retro ? '#ffaa55' : '#d9a25a', r: retro ? '#55ff55' : '#5fe07c', k: retro ? '#ffff55' : '#ffe27a' }[d.type] || '#ffffff';
  }

  function onEvent(type, d) {
    d = d || {};
    R.sfx(g, type, d);
    var C = P(), retro = C.retro, sz = retro ? 4 : 3;
    switch (type) {
      case 'level':
        lastLevel = d.level; toasts = [];
        if (mode === 'campaign' && d.level > unlocked()) Store.set(UKEY, String(Math.min(30, d.level)));
        showBanner(mode === 'endless' ? g.t('endless') + ' · ' + g.t('wall') + ' ' + d.level : g.t('level') + ' ' + d.level + ' · ' + g.t('lv' + d.level),
          d.boss ? g.t('boss') + ' · ' + g.t('launch') : g.t('launch'), 2.4, d.boss ? C.bad : C.accent);
        break;
      case 'break': g.particles.spawn(d.x, d.y, { color: brickColor(d), count: retro ? 6 : 9, speed: 90, life: 0.45, size: sz }); break;
      case 'boom': shake = Math.max(shake, 0.18); g.particles.spawn(d.x, d.y, { color: retro ? '#ffff55' : '#ffb347', count: 18, speed: 170, life: 0.5, size: sz }); g.particles.spawn(d.x, d.y, { color: retro ? '#ff5555' : '#ff4a1a', count: 10, speed: 110, life: 0.6, size: sz + 1 }); break;
      case 'catch': { var s = S(); toast(d.k === '+' ? g.t('life') : g.t('p_' + d.k), d.bad ? C.bad : (retro ? RN.PRIZE_RCOL[d.k] : RN.PRIZE_COL[d.k]), s.paddle.x, K.PY - 18, true); break; }
      case 'gates': showBanner(g.t('gates'), '', 1.4, C.good); break;
      case 'zap': shake = Math.max(shake, 0.25); toast(g.t('zap'), C.bad, d.x, K.PY - 20); g.particles.spawn(d.x, K.PY, { color: retro ? '#ff5555' : '#ff6a4a', count: 14, speed: 130, life: 0.5, size: sz }); break;
      case 'bossHit': g.particles.spawn(d.x, d.y, { color: retro ? '#ffffff' : '#ffd38a', count: 6, speed: 90, life: 0.3, size: sz }); break;
      case 'bossDie': shake = 0.6; for (var k = 0; k < 4; k++) g.particles.spawn(d.x + (k - 1.5) * 40, d.y, { color: k % 2 ? (retro ? '#ffff55' : '#ffd04a') : (retro ? '#ff5555' : '#ff5e1a'), count: 22, speed: 200, life: 0.9, size: sz + 1 }); showBanner(g.t('bossDown'), '+' + L.PTS.boss, 1.6, C.good); break;
      case 'lose': showBanner(g.t('lost'), g.t('lives') + ': ' + d.lives, 1.1, C.bad); break;
      case 'clear': if (!S().boss) showBanner(g.t('clear'), g.t('bonus') + ' +' + d.bonus, 1.7, C.good); break;
      case 'win': sync(); endT = 2.2; break;
      case 'gameover': sync(); g.state.lives = 0; endT = 1.2; break;
    }
    sync();
  }
  function newGame() {
    game = R.Game({ mode: mode, level: mode === 'campaign' ? startLv : 1, onEvent: onEvent });
    toasts = []; banner = null; endT = 0; shake = 0; game.start(); R.current = game; sync();
  }

  // ---------- меню ----------
  g.useStandardScreens({ lives: K.LIVES });
  g.menu.addItem({ key: 'mode', after: 'play', label: function () { return g.t('mode') + ': ' + g.t(mode === 'endless' ? 'm_endless' : 'm_campaign'); }, onSelect: function () { setMode(mode === 'endless' ? 'campaign' : 'endless'); } });
  function refreshMenu() {
    if (mode === 'campaign') g.menu.addItem({ key: 'start', after: 'mode', label: function () { return g.t('startAt') + ': ' + startLv + '/' + unlocked(); }, onSelect: function () { startLv = startLv >= unlocked() ? 1 : startLv + 1; } });
    else g.menu.removeItem('start');
  }
  refreshMenu();
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var C = P(), line = g.t(mode === 'endless' ? 'm_endless' : 'm_campaign') + ' · ' + g.t('level') + ' ' + (game ? S().level : 1) + (mode === 'campaign' ? '/30' : '');
      this.text(line, this.W / 2, this.H / 2 + 48, { size: 13, align: 'center', color: C.muted, weight: 700 });
    };
  });

  // ---------- титул: демо-партия за панелью ----------
  var demo = null, demoT = 0;
  function newDemo() { demo = R.Game({ rng: L.mulberry32(7 + Math.floor(Math.random() * 99)), level: 1 + Math.floor(Math.random() * 8), lives: 99 }); demo.start(); demoT = 0; }
  newDemo();
  var title = g.scenes.title, menu = g.menu.get('title');
  title.update = function (dt) {
    var DS = demo.state(); demoT += dt;
    var tg = DS.balls.filter(function (b) { return b.vy > 0; }).sort(function (a, b) { return b.y - a.y; })[0] || DS.balls[0];
    if (tg) demo.setPointer(tg.x + Math.sin(demoT * 0.7) * DS.paddle.w * 0.3);
    if (DS.balls.some(function (b) { return b.stuck != null; })) demo.action();
    demo.update(dt);
    if (DS.phase === 'clear' || demoT > 90) newDemo();
  };
  title.draw = function (ctx) {
    var C = P(), retro = C.retro, Wc = this.W, Hc = this.H, th = this.th();
    RN.draw(ctx, this, demo.state(), {});
    ctx.fillStyle = retro ? 'rgba(0,0,0,.72)' : 'rgba(12,8,6,.62)'; ctx.fillRect(0, 0, Wc, Hc);
    var pw = 440, ph = 344, x0 = (Wc - pw) / 2, y0 = 54;
    panel(ctx, x0, y0, pw, ph, C);
    this.text(this.t('title'), Wc / 2, y0 + 60, { size: retro ? 46 : 52, align: 'center', color: C.accent, weight: 900 });
    // заклёпка и наковальня-эмблема
    var bx = Wc / 2 + (retro ? 140 : 156), by = y0 + 40 + Math.abs(Math.sin(this.time * 3)) * -10;
    RN.ball(ctx, C, K, { x: bx, y: by, trail: [] }, { fx: {} }, this.time);
    ctx.save(); ctx.translate(0, y0 + 44 - K.PY); RN.paddle(ctx, C, K, { paddle: { x: Wc / 2 - (retro ? 172 : 184), w: 44, stun: 0 }, fx: {} }, this.time); ctx.restore();
    this.text(this.t('subtitle'), Wc / 2, y0 + 88, { size: retro ? 11 : 13, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2, y0 + 107, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 });
    menu.draw(this, Wc / 2, y0 + 148, 29);
    var bc = Store.getNum(bestKey('campaign'), 0), be = Store.getNum(bestKey('endless'), 0);
    this.text(this.t('best') + ': ' + this.t('m_campaign') + ' ' + bc + ' · ' + this.t('m_endless') + ' ' + be, Wc / 2, y0 + ph - 16, { size: 11, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), Wc / 2, Hc - 12, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 });
  };
  // окошко панели (под нужную тему)
  function panel(ctx, x, y, w, h, C) {
    if (C.retro) { ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#5555ff'; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h); return; }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(28,21,18,.95)'; RN.rr(ctx, x, y, w, h, 16); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#4e3b30'; ctx.lineWidth = 1.5; RN.rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 16); ctx.stroke();
  }

  // ---------- ввод указателем ----------
  var cv = g.canvas;
  function lx(clientX) { var r = cv.getBoundingClientRect(); return (clientX - r.left) * K.W / r.width; }
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.2; }
  addEventListener('mousemove', function (e) { if (g._sceneName === 'play' && game) game.setPointer(lx(e.clientX)); });
  cv.addEventListener('mousedown', function (e) { if (!inPlay()) return; ptrDown = true; game.setPointer(lx(e.clientX)); game.action(); });
  addEventListener('mouseup', function () { ptrDown = false; });
  cv.addEventListener('touchstart', function (e) { if (g._sceneName !== 'play' || !game) return; e.preventDefault(); ptrDown = true; game.setPointer(lx(e.changedTouches[0].clientX)); if (inPlay()) game.action(); }, { passive: false });
  cv.addEventListener('touchmove', function (e) { if (g._sceneName !== 'play' || !game) return; e.preventDefault(); game.setPointer(lx(e.changedTouches[0].clientX)); }, { passive: false });
  cv.addEventListener('touchend', function (e) { if (e.touches.length === 0) ptrDown = false; }, { passive: true });
  var FIRE = { KeyZ: 1, KeyX: 1, KeyJ: 1, ArrowUp: 1, KeyW: 1 };
  addEventListener('keydown', function (e) { if (FIRE[e.code] && g._sceneName === 'play') { e.preventDefault(); kbFire = true; if (!e.repeat && inPlay()) game.action(); } });
  addEventListener('keyup', function (e) { if (FIRE[e.code]) kbFire = false; });
  addEventListener('blur', function () { ptrDown = false; kbFire = false; });

  // ---------- игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); else if (a === 'action' && inPlay()) game.action(); },
    update: function (dt) {
      if (!game) return;
      var s = S(), i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (q) { return q.t > 0; });
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      if (shake > 0) shake = Math.max(0, shake - dt);
      var dir = this.input.dir.x;
      if (dir) game.setDir(dir); else game.setDir(0);
      game.setFire(ptrDown || kbFire || this.input.pressed('action'));
      game.update(Math.min(dt, 0.05));
      for (i = 0; i < s.balls.length; i++) { var b = s.balls[i]; b.trail.push([b.x, b.y]); if (b.trail.length > 7) b.trail.shift(); }
      sync();
      if (endT > 0) { endT -= dt; if (endT <= 0) { if (s.won) g.win(); else if (s.over) g.gameover(); } }
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var s = S(), C = P();
      ctx.save();
      if (shake > 0 && !C.retro) ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);
      RN.draw(ctx, this, s, { best: this.state.best });
      ctx.restore();
      for (var i = 0; i < toasts.length; i++) {
        var o = toasts[i]; ctx.globalAlpha = Math.min(1, o.t / 0.35);
        this.text(C.retro ? String(o.text).toUpperCase() : o.text, o.x, o.y - (o.life - o.t) * 22, { size: o.big ? (C.retro ? 12 : 15) : (C.retro ? 10 : 12), align: 'center', color: o.color, weight: 900 });
      }
      ctx.globalAlpha = 1;
      if (banner) {
        var a = Math.min(1, banner.a / 0.3), w = 440, h = banner.sub ? 62 : 44, x = (K.W - w) / 2, y = 250;
        ctx.globalAlpha = a; panel(ctx, x, y, w, h, C);
        this.text(C.retro ? banner.title.toUpperCase() : banner.title, K.W / 2, y + 28, { size: C.retro ? 15 : 19, align: 'center', color: banner.col || C.accent, weight: 900 });
        if (banner.sub) this.text(banner.sub, K.W / 2, y + 49, { size: C.retro ? 9 : 11, align: 'center', color: C.muted, weight: 700 });
        ctx.globalAlpha = 1;
      }
    }
  });

  // ---------- DOM: подгонка канвы, подписи, кнопка паузы ----------
  function $(id) { return document.getElementById(id); }
  function fit() {
    var wrap = cv.parentElement, availH = innerHeight - 96;
    var w = Math.min(1000, (wrap && wrap.clientWidth) || K.W, availH * K.W / K.H);
    w = Math.max(280, Math.floor(w)); cv.style.width = w + 'px'; cv.style.height = Math.round(w * K.H / K.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      var pb = $('bPause'); if (pb) pb.title = g.t('pause');
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }
  fit(); addEventListener('resize', fit); domSync(); setInterval(domSync, 250);
  var pbtn = $('bPause');
  if (pbtn) { var hp = function (e) { e.preventDefault(); e.stopPropagation(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; pbtn.addEventListener('touchstart', hp, { passive: false }); pbtn.addEventListener('mousedown', hp); }

  g.start('title');
  R.app = { g: g, game: function () { return game; }, mode: function () { return mode; }, setMode: setMode, setStart: function (n) { startLv = n; } };   // для автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
