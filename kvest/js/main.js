/* МАЯЧНИЦА · сборка: оболочка — фреймворк Гефест Arcade v2.2 (меню, пауза, язык, звук, музыка), игра — KVEST.createGame
   (game.js по данным scenes.js/puzzles.js/widgets.js), отрисовка — только через window.KvestTheme (контракт «КВЕСТ»).
   Сцены движка: title (+ «Продолжить» — сохранение), pause (+ «Прохождение-набросок», «Начать главу заново»), win; своя — play.
   Ввод: мышь/тач по канве (тап = клик, долгий тап / ПКМ = осмотр, перетаскивание предметов), H — подсказка, B — набросок,
   D — отладка макета, P/Esc — пауза (в мини-игре и наброске Esc закрывает их). */
(function (global) {
  'use strict';
  var K = global.KVEST, A = K.ThemeAPI, W = 960, H = 540;
  function T() { return global.KvestTheme; }
  var PAL = { bg: '#2b2a29', panel: '#3a3836', ink: '#f1ede6', muted: '#b9b3a9', accent: '#f0bf5a', good: '#b7d3a6', bad: '#d99a8c', warn: '#f0bf5a',
    grid: '#45423f', font: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', pixel: false, glow: false, radius: 10 };
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'kvest', strings: K.STR, theme: 'modern', themes: { modern: PAL, retro: PAL } });
  K.g = g;
  var Store = Arcade.Store, SAVE = 'arcade.save.kvest';
  var game = null, wantContinue = false, lastWin = null, saveDirty = false, saveT = 0, mouseSeen = false;

  function loadSave() { try { var s = Store.get(SAVE, null); if (!s) return null; var o = JSON.parse(s); return o && o.v === 1 && o.flags ? o : null; } catch (e) { return null; } }
  function writeSave() { if (game && !game.won()) Store.set(SAVE, game.serialize()); saveDirty = false; }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  function solvedIn(o) { return K.PUZZLES.puzzles.filter(function (p) { return o && o.flags && o.flags[p.id]; }).length; }

  function onEvent(type, d) {
    d = d || {};
    if (type === 'sfx') K.sfx(g, d.name, d);
    else if (type === 'puzzle') { K.sfx(g, 'puzzle'); g.state.score = d.solved; }
    else if (type === 'scene') g.state.level = 1;
    if (type === 'change' || type === 'save') saveDirty = true;
    if (type === 'win') {
      clearSave(); lastWin = { solved: game.solvedCount(), total: K.PUZZLES.puzzles.length }; g.state.score = lastWin.solved;
      setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 900);
    }
  }
  function newGame() {
    var sv = wantContinue ? loadSave() : null; wantContinue = false;
    if (!sv) clearSave();
    game = K.createGame({ onEvent: onEvent });
    if (!(sv && game.load(sv))) game.start();
    lastWin = null; g.state.score = game.solvedCount(); K.current = game;
  }

  // ---------- стандартные экраны движка ----------
  g.useStandardScreens({});
  g.menu.removeItem('theme');       // оформление игры — тема KvestTheme, не тема движка
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + solvedIn(sv) + ' / ' + K.PUZZLES.puzzles.length : g.t('cont') + ' —'; },
    onSelect: function () { if (!loadSave()) { g.audio.beep(200, 0.06); return; } wantContinue = true; g.goto('play'); } });
  g.menu.addItem({ key: 'walk', scene: 'pause', before: 'menu', label: function () { return g.t('walk'); },
    onSelect: function () { g.goto('play', { resume: true }); if (game) game.openWalk(); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { clearSave(); g.goto('play'); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // фон меню — сцена главы, нарисованная текущей темой
  var titleScene = (function () { var s = JSON.parse(JSON.stringify(K.SCENES.filter(function (x) { return x.id === 'tower'; })[0])); s.objects.forEach(function (o) { if (o.id === 'lighthouse') o.state.lit = true; }); return s; })();
  function panel(ctx, x, y, w, h) { ctx.save(); ctx.fillStyle = 'rgba(30,29,28,0.82)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 14); else ctx.rect(x, y, w, h); ctx.fill(); ctx.restore(); }
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var th = this.th(); T().drawScene(ctx, titleScene, this.time, {});
    T().drawHero(ctx, { x: 200, y: 452, dir: 1 }, 'idle', this.time);
    var pw = 420, ph = 300, x0 = (W - pw) / 2, y0 = 70; panel(ctx, x0, y0, pw, ph);
    this.text(this.t('title'), W / 2, y0 + 60, { size: 46, align: 'center', color: th.accent, weight: 900 });
    this.text(this.t('subtitle'), W / 2, y0 + 88, { size: 15, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), W / 2, y0 + 110, { size: 13, align: 'center', color: th.muted, weight: 600 });
    menu.draw(this, W / 2, y0 + 156, 32);
    this.text(this.t('hint'), W / 2, H - 14, { size: 12, align: 'center', color: '#efe9dd', weight: 600 });
  };
  g.scenes.win.draw = function (ctx) {
    var th = this.th();
    if (game) drawGame(ctx, true); else this.clear();
    panel(ctx, W / 2 - 280, 150, 560, 170);
    this.text(this.t('win'), W / 2, 210, { size: 42, align: 'center', color: th.accent, weight: 900 });
    this.text(this.t('winSub'), W / 2, 246, { size: 15, align: 'center', color: th.ink, weight: 700 });
    if (lastWin) this.text(this.t('solved') + ': ' + lastWin.solved + ' / ' + lastWin.total, W / 2, 276, { size: 13, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('tapstart'), W / 2, 304, { size: 12, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- игровая сцена ----------
  function drawGame(ctx, still) {
    var m = game.model(), th = T(), t = m.time;
    th.drawScene(ctx, m.scene, t, { debug: m.ui.debug, light: m.light });
    if (m.showHero) th.drawHero(ctx, m.hero, m.pose, t);
    m.thoughts.forEach(function (q) { th.drawThought(ctx, q.x, q.y, q.icons, t); });
    if (still) return;
    th.drawUI(ctx, m.ui, t);
    if (mouseSeen && m.cursor.kind && m.cursor.x >= 0) {
      th.drawCursor(ctx, m.cursor.kind, m.cursor.x, m.cursor.y);
      if (m.cursor.item && !m.ui.drag) th.drawIcon(ctx, m.cursor.item, m.cursor.x + 22, m.cursor.y + 22, 28);
    }
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); },
    press: function (a) {
      if (!game) return;
      var rt = game.runtime();
      if (a === 'pause') {
        if (rt.mode === 'mini') { game.closeMini(); return; }
        if (rt.mode === 'walk') { game.closeWalk(); return; }
        writeSave(); this.pause(); return;
      }
      if ((a === 'action' || a === 'start') && (rt.cut || rt.cutQ.length)) game.skipCut();
    },
    update: function (dt) {
      if (!game) return;
      game.update(dt); saveT += dt;
      if (saveDirty && saveT > 0.6) { saveT = 0; writeSave(); }
    },
    draw: function (ctx) { if (game) drawGame(ctx); else this.clear(); }
  });

  // ---------- клавиши игры ----------
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play' || !game) return;
    if (e.code === 'KeyH') { game.hint(); K.sfx(g, 'hint'); }
    else if (e.code === 'KeyB') { var rt = game.runtime(); if (rt.mode === 'walk') game.closeWalk(); else if (rt.mode === 'scene') game.openWalk(); }
    else if (e.code === 'KeyD') game.setDebug();
  });

  // ---------- мышь и тач по канве ----------
  var cv = g.canvas;
  function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
  function inPlay() { return g._sceneName === 'play' && game; }
  cv.addEventListener('mousedown', function (e) { if (!inPlay()) return; mouseSeen = true; if (e.button === 2) return; var p = pt(e); game.down(p.x, p.y); });
  cv.addEventListener('mousemove', function (e) { if (!inPlay()) return; mouseSeen = true; var p = pt(e); game.move(p.x, p.y); });
  addEventListener('mouseup', function (e) { if (!inPlay() || e.button === 2) return; var p = pt(e); game.up(p.x, p.y); });
  cv.addEventListener('mouseleave', function () { if (inPlay()) game.move(-100, -100); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); if (!inPlay()) return; var p = pt(e); game.look(p.x, p.y); });
  cv.addEventListener('touchstart', function (e) { if (!inPlay()) return; e.preventDefault(); mouseSeen = false; var p = pt(e.changedTouches[0]); game.down(p.x, p.y); }, { passive: false });
  cv.addEventListener('touchmove', function (e) { if (!inPlay()) return; e.preventDefault(); var p = pt(e.changedTouches[0]); game.move(p.x, p.y); }, { passive: false });
  cv.addEventListener('touchend', function (e) { if (!inPlay()) return; e.preventDefault(); var p = pt(e.changedTouches[0]); game.up(p.x, p.y); game.move(-100, -100); }, { passive: false });
  (function () {
    var b = document.getElementById('bPause'); if (!b) return;
    var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') { writeSave(); g.pause(); } else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  })();

  // ---------- DOM: подгонка канвы, подписи ----------
  function fit() {
    var wrap = cv.parentElement, w = Math.min(1200, (wrap && wrap.clientWidth) || W, (innerHeight - 70) * W / H);
    w = Math.max(240, Math.floor(w)); cv.style.width = w + 'px'; cv.style.height = Math.round(w * H / W) + 'px';
  }
  var lastLang = null, lastScene = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
    }
    var sn = g._sceneName === 'play' && mouseSeen ? 'play' : 'other';
    if (sn !== lastScene) { lastScene = sn; cv.style.cursor = sn === 'play' ? 'none' : 'pointer'; }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  // ?check — проверка темы по API (результат — в консоль)
  if (/[?&#]check\b/.test(location.search + location.hash)) { var r = A.validateTheme(T(), { ctx: g.ctx }); console.log('KvestTheme ' + T().id + ': ' + (r.ok ? 'OK' : 'ошибки: ' + r.errors.join('; '))); }

  g.start('title');
  K.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
