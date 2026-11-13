/* ЛИВЕНЬ · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js, patterns.js, stages.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован (за панелью меню — живые узоры перезвонов),
   в меню — «Сложность: Лёгкий/Норма/Трудный» и «Форма: Веер/Клинок»; рекорд — свой на каждую сложность.
   Продолжения: после последней жизни — отсчёт 10 с, пробел/тап — продолжить (счёт обнуляется до последней цифры = число продолжений).
   Ввод: стрелки/WASD — полёт, Shift/Z — фокус, X/B/пробел — разряд, огонь автоматический; палец/мышь с зажатой кнопкой —
   относительное перемещение, второй палец — разряд; тач-кнопки ФОКУС / РАЗРЯД / II. */
(function (global) {
  'use strict';
  var LV = global.LIVEN, L = LV.logic, K = L.K, RN = LV.render, Store = Arcade.Store;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0b0d16', panel: '#121522', ink: '#f1eef8', muted: '#9aa0b8', accent: '#ff7a3d', grid: '#2a2f45' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var W = 640, H = 600;
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'liven', strings: LV.STR, theme: 'modern', lives: K.LIVES, themes: themes });
  LV.g = g;

  // ---------- настройки и рекорды по сложности ----------
  var DKEY = 'arcade.liven.diff', FKEY = 'arcade.liven.form';
  var diff = L.DIFFS.indexOf(Store.get(DKEY, 'easy')) >= 0 ? Store.get(DKEY, 'easy') : 'easy';
  var form = L.FORMS.indexOf(Store.get(FKEY, 'fan')) >= 0 ? Store.get(FKEY, 'fan') : 'fan';
  function bestKey(d) { return 'arcade.best.liven.' + (d || diff); }
  g.loadBest = function () { return Store.getNum(bestKey(), 0); };
  g.saveBest = function () {
    var b = this.loadBest(); if (this.state.score > b) Store.set(bestKey(), String(this.state.score));
    if (this.state.score > Store.getNum('arcade.best.liven', 0)) Store.set('arcade.best.liven', String(this.state.score)); // общий — для каталога
    this.state.best = Math.max(b, this.state.score);
  };
  g.state.best = g.loadBest();

  var game = null, banner = null, endT = 0, endTo = null, playSince = 0;
  var focusToggle = false, kFocus = false;
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.stage; }
  function showBanner(title, sub, dur, col, y) { banner = { title: title, sub: sub, a: dur || 2, col: col, y: y }; }
  function P() { return g.themeName === 'retro' ? RN.PR : RN.PM; }
  function cardName(ci) { var b = S().boss; return b.def ? b.def.cards[ci].n[g.i18n.lang] : ''; }

  function onEvent(type, a, b, c) {
    LV.sfx(g, type, a, b, c);
    var C = P(), s = game ? S() : null;
    switch (type) {
      case 'stage': RN.clearFx(); var st = LV.STAGES[a - 1]; showBanner(g.t('stage') + ' ' + a, st ? st.n[g.i18n.lang] : '', 2.6, C.accent); break;
      case 'kill': RN.spawn(a, b, 12, 1, 140, 0.45, 3); RN.spawn(a, b, 6, 0, 80, 0.35, 2); if (c >= 300) RN.pop(a, b - 8, '+' + c, 1); break;
      case 'graze': if (Math.random() < 0.5) RN.spawn(a, b, 2, 3, 90, 0.25, 2); break;
      case 'hit': RN.flash(0.1); break;
      case 'die': RN.spawn(a, b, 40, 1, 220, 0.9, 4); RN.spawn(a, b, 24, 2, 140, 0.7, 3); RN.wave(a, b, 140, 0.6, 4); RN.shake(0.5); break;
      case 'bomb': RN.wave(a, b, 520, 0.8, 3); RN.wave(a, b, 360, 0.6, 2); RN.flash(0.25); RN.shake(0.35); RN.pop(a, b - 24, g.t('bombName'), 5, true); break;
      case 'card': showBanner(cardName(a), (c ? g.t('midboss') : g.t('bossCome')) + ' · ' + (a + 1) + '/' + b, 1.6, C.accent, 300); break;
      case 'cardEnd':
        if (a > 0) showBanner(g.t('cardGet'), g.t('bonus') + ' +' + a, 1.8, C.good, 220);
        else showBanner(b ? g.t('cardTime') : g.t('cardFail'), '', 1.2, C.muted, 220);
        break;
      case 'midboss': case 'boss': showBanner(g.t('warning'), type === 'midboss' ? g.t('midboss') : g.t('bossCome'), 1.6, C.bad, 260); break;
      case 'midDown': case 'bossDown': RN.spawn(a, b, 60, 1, 260, 1.1, 4); RN.spawn(a, b, 40, 5, 200, 1.0, 3); RN.wave(a, b, 300, 0.9, 1); RN.shake(type === 'bossDown' ? 1.2 : 0.5); RN.flash(0.3); break;
      case 'clear': showBanner(g.t('clear'), g.t('clearSub') + ' +' + b, 3.6, C.good); break;
      case 'extend': RN.pop(a, b - 20, g.t('extend'), 2, true); break;
      case 'spark': if (c % 50 === 0 && s) RN.pop(s.P.x, s.P.y - 26, '×' + s.mult.toFixed(1), 4, true); break;
      case 'win': sync(); endT = 2.6; endTo = 'win'; break;
      case 'gameover': sync(); endT = 1.4; endTo = 'gameover'; break;
    }
    sync();
  }
  function newGame() {
    game = LV.Game({ diff: diff, form: form, onEvent: onEvent });
    banner = null; endT = 0; endTo = null; RN.clearFx(); focusToggle = false;
    game.start(); LV.current = game; sync();
  }

  // ---------- меню ----------
  g.useStandardScreens({ lives: K.LIVES });
  g.menu.addItem({ key: 'diff', after: 'play', label: function () { return g.t('diff') + ': ' + g.t('d_' + diff); }, onSelect: function () { diff = L.DIFFS[(L.DIFFS.indexOf(diff) + 1) % 3]; Store.set(DKEY, diff); g.state.best = g.loadBest(); } });
  g.menu.addItem({ key: 'form', after: 'diff', label: function () { return g.t('form') + ': ' + g.t('f_' + form) + ' (' + g.t('fdesc_' + form) + ')'; }, onSelect: function () { form = form === 'fan' ? 'blade' : 'fan'; Store.set(FKEY, form); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name];
    sc.draw = function (ctx) {
      var C = P();
      if (game) RN.draw(ctx, this, S(), { best: this.state.best, noHero: true, noPanel: false });
      else this.clear();
      ctx.fillStyle = 'rgba(4,4,10,.78)'; ctx.fillRect(0, 0, W, H);
      var title = this.t(name === 'win' ? 'win' : 'gameover');
      RN.txt(this, title, W / 2, H / 2 - 50, { size: C.retro ? 22 : 32, align: 'center', color: name === 'win' ? C.good : C.bad, weight: 900 }, C);
      RN.txt(this, this.t('score') + ': ' + this.state.score + '   ' + this.t('best') + ': ' + this.state.best, W / 2, H / 2 - 10, { size: C.retro ? 12 : 16, align: 'center', color: C.ink, weight: 800 }, C);
      if (game) {
        var s = S(), line = this.t('d_' + s.diff) + ' · ' + this.t('f_' + s.P.form) + ' · ' + this.t('stage') + ' ' + s.stage + '/' + LV.STAGES.length + (s.conts ? ' · ' + this.t('conts') + ' ' + s.conts : '');
        RN.txt(this, line, W / 2, H / 2 + 20, { size: C.retro ? 10 : 13, align: 'center', color: C.muted, weight: 700 }, C);
        RN.txt(this, this.t('endLine').replace('{g}', s.graze).replace('{c}', s.maxMult.toFixed(2)).replace('{k}', s.stats.captures + '/' + s.stats.cards), W / 2, H / 2 + 42, { size: C.retro ? 10 : 13, align: 'center', color: C.muted, weight: 700 }, C);
      }
      RN.txt(this, this.t('tapstart'), W / 2, H - 30, { size: 12, align: 'center', color: C.muted, weight: 600 }, C);
    };
  });

  // ---------- титул: за панелью — живые перезвоны боссов ----------
  var demo = null, demoT = 0, demoI = 0;
  var DEMO = [['b1', 2], ['b4', 1], ['b3', 2], ['b5', 1], ['b2', 2], ['b5', 4], ['b3', 0]];
  function newDemo() { var d = DEMO[demoI++ % DEMO.length]; demo = LV.Game({ diff: 'normal', rng: L.mulberry32(11 + demoI), noHit: true, frozen: true }); demo._card(d[0], d[1]); demo.state().P.y = K.FH + 40; demoT = 0; }
  newDemo();
  var title = g.scenes.title, menu = g.menu.get('title');
  title.update = function (dt) { demoT += dt; demo.update(dt); RN.update(dt); if (demoT > 9) newDemo(); };
  title.draw = function (ctx) {
    var C = P(), retro = C.retro, th = this.th();
    ctx.fillStyle = retro ? '#000000' : '#07080f'; ctx.fillRect(0, 0, W, H);
    RN.field(ctx, this, demo.state(), { noHero: true, ox: (W - K.FW) / 2 });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.7)' : 'rgba(8,8,16,.55)'; ctx.fillRect(0, 0, W, H);
    var pw = 470, ph = 400, x0 = (W - pw) / 2, y0 = 70;
    if (retro) { ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, pw, ph); ctx.fillStyle = '#5555ff'; ctx.fillRect(x0, y0, pw, 3); ctx.fillRect(x0, y0 + ph - 3, pw, 3); ctx.fillRect(x0, y0, 3, ph); ctx.fillRect(x0 + pw - 3, y0, 3, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(18,21,34,.94)'; ctx.fillRect(x0, y0, pw, ph); ctx.restore(); ctx.strokeStyle = '#3a3f5c'; ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1); }
    RN.txt(this, this.t('title'), W / 2, y0 + 62, { size: retro ? 44 : 56, align: 'center', color: C.accent, weight: 900 }, C);
    RN.shuttle(ctx, C, { x: W / 2 - (retro ? 150 : 168), y: y0 + 44, form: form, inv: 0 }, this.time);
    RN.ringer(ctx, C, 'brass', W / 2 + (retro ? 156 : 172), y0 + 46, 0.8, this.time, 0);
    RN.txt(this, this.t('subtitle'), W / 2, y0 + 92, { size: retro ? 10 : 12, align: 'center', color: th.ink, weight: 700 }, C);
    RN.txt(this, this.t('sub2'), W / 2, y0 + 112, { size: retro ? 9 : 11, align: 'center', color: th.muted, weight: 600 }, C);
    menu.draw(this, W / 2, y0 + 156, 30);
    var bl = L.DIFFS.map(function (d) { return g.t('d_' + d) + ' ' + Store.getNum(bestKey(d), 0); }).join(' · ');
    RN.txt(this, this.t('best') + ': ' + bl, W / 2, y0 + ph - 18, { size: 11, align: 'center', color: th.muted, weight: 700 }, C);
    RN.txt(this, (this.input.touchOnly ? this.t('hintTouch') : this.t('hintKeys')).split('\n').join(' · '), W / 2, H - 22, { size: retro ? 8 : 10, align: 'center', color: th.muted, weight: 600, upper: false }, C);
  };

  // ---------- ввод ----------
  var cv = g.canvas;
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }
  function scale() { var r = cv.getBoundingClientRect(); return W / (r.width || W); }
  function doBomb() { if (!inPlay()) return; var s = S(); if (s.phase === 'cont') { game.giveUp(); return; } game.bomb(); }
  function doCont() { if (!inPlay()) return; if (S().phase === 'cont') game.cont(); }
  var BOMBK = { KeyX: 1, KeyB: 1 }, FOCK = { ShiftLeft: 1, ShiftRight: 1, KeyZ: 1 };
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play') return;
    if (BOMBK[e.code]) { e.preventDefault(); if (!e.repeat) doBomb(); }
    if (FOCK[e.code]) { e.preventDefault(); kFocus = true; }
  });
  addEventListener('keyup', function (e) { if (FOCK[e.code]) kFocus = false; });
  addEventListener('blur', function () { kFocus = false; drag = null; });
  // палец / мышь: относительное перемещение
  var drag = null;
  cv.addEventListener('touchstart', function (e) {
    if (g._sceneName !== 'play' || !game) return; e.preventDefault();
    if (S().phase === 'cont') { doCont(); return; }
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (!drag) drag = { id: t.identifier, x: t.clientX, y: t.clientY };
      else doBomb(); // второй палец — разряд
    }
  }, { passive: false });
  cv.addEventListener('touchmove', function (e) {
    if (!drag || !game) return; e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i]; if (t.identifier !== drag.id) continue;
      var k = scale(); game.drag((t.clientX - drag.x) * k, (t.clientY - drag.y) * k); drag.x = t.clientX; drag.y = t.clientY;
    }
  }, { passive: false });
  function tEnd(e) { if (!drag) return; for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === drag.id) drag = null; }
  cv.addEventListener('touchend', tEnd, { passive: true }); cv.addEventListener('touchcancel', tEnd, { passive: true });
  cv.addEventListener('mousedown', function (e) { if (g._sceneName !== 'play' || !game) return; if (S().phase === 'cont') { doCont(); return; } drag = { id: 'm', x: e.clientX, y: e.clientY }; if (e.button === 2) doBomb(); });
  addEventListener('mousemove', function (e) { if (!drag || drag.id !== 'm' || !game) return; var k = scale(); game.drag((e.clientX - drag.x) * k, (e.clientY - drag.y) * k); drag.x = e.clientX; drag.y = e.clientY; });
  addEventListener('mouseup', function () { if (drag && drag.id === 'm') drag = null; });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // тач-кнопки
  function btn(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { e.preventDefault(); e.stopPropagation(); fn(b); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  btn('bFocus', function (b) { focusToggle = !focusToggle; b.classList.toggle('on', focusToggle); });
  btn('bBomb', function () { if (game && S().phase === 'cont') doCont(); else doBomb(); });
  btn('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  // ---------- игровая сцена ----------
  var fpsT = 0, fpsN = 0, fpsS = '';
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; drag = null; },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (!game) return;
      if (S().phase === 'cont') { if (a === 'action' || a === 'start') doCont(); return; }
      if (a === 'action') doBomb();
    },
    update: function (dt) {
      if (!game) return;
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      var d = this.input.dir;
      game.setInput(d.x, d.y, kFocus || focusToggle || !!(this.input.codes.ShiftLeft || this.input.codes.ShiftRight));
      game.update(dt);
      RN.update(dt);
      sync();
      fpsT += dt; fpsN++; if (fpsT >= 1) { fpsS = fpsN + ' fps · ' + S().B.n; fpsT = 0; fpsN = 0; }
      if (endT > 0) { endT -= dt; if (endT <= 0) { if (endTo === 'win') g.win(); else g.gameover(); } }
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      RN.draw(ctx, this, S(), { best: this.state.best, banner: banner, touch: this.input.touchOnly, fps: LV.showFps ? fpsS : '' });
    }
  });

  // ---------- DOM: подгонка канвы, подписи ----------
  function $(id) { return document.getElementById(id); }
  function fit() {
    var wrap = cv.parentElement, padH = (document.querySelector('.pad') && getComputedStyle(document.querySelector('.pad')).display !== 'none') ? 70 : 0;
    var availH = innerHeight - 70 - padH;
    var w = Math.min(960, (wrap && wrap.clientWidth) || W, availH * W / H);
    w = Math.max(280, Math.floor(w)); cv.style.width = w + 'px'; cv.style.height = Math.round(w * H / W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      var bf = $('bFocus'); if (bf) bf.textContent = lang === 'ru' ? 'ФОКУС' : 'FOCUS';
      var bb = $('bBomb'); if (bb) bb.textContent = lang === 'ru' ? 'РАЗРЯД' : 'DISCHARGE';
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }
  fit(); addEventListener('resize', fit); domSync(); setInterval(domSync, 250);

  g.start('title');
  LV.app = { g: g, game: function () { return game; }, setDiff: function (d) { diff = d; g.state.best = g.loadBest(); }, setForm: function (f) { form = f; }, newGame: newGame };   // для автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
