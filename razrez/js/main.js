/* РАЗРЕЗ · сборка игры на фреймворке Гефест Arcade v2: сцены, ввод, связь
   логики (game.js) с рендерерами (modern/classic), звуком и стандартными меню. */
(function (global) {
  'use strict';
  var R = global.RAZREZ;
  var W = 800, H = 560;
  // Раскладка: HUD сверху 44 px, поле 78×50 клеток по 10 px
  var L = { W: W, H: H, CELL: 10, OX: 10, OY: 50, COLS: R.logic.COLS, ROWS: R.logic.ROWS };

  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'razrez', strings: R.STR, theme: 'modern', lives: 3 });
  R.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  g.fit(820); addEventListener('resize', function () { g.fit(820); });

  function renderer() { return g.themeName === 'retro' ? R.classic : R.modern; }

  var game = null, lastAxis = 'x';

  // Сложность уровня — через g.difficulty движка (база + шаг на уровень, с потолком)
  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }

  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }

  function onEvent(type, d) {
    R.sfx(g, type, d);
    var P = renderer().P, C = L.CELL;
    if (type === 'death') g.particles.spawn(L.OX + (d.x + 0.5) * C, L.OY + (d.y + 0.5) * C, { color: P.bad, count: 22, speed: 120, life: 0.8, size: 4 });
    if (type === 'capture') { var p = game.state().player; g.particles.spawn(L.OX + (p.x + 0.5) * C, L.OY + (p.y + 0.5) * C, { color: P.edge, count: 10 + Math.min(20, d.count / 40 | 0), speed: 90, life: 0.6 }); }
    sync();
    if (type === 'win') g.win();
    if (type === 'gameover') g.gameover();
  }

  function newGame() {
    game = R.Game({ lives: 3, level: 1, difficulty: diff, onEvent: onEvent }).start();
    R.current = game; sync();
  }

  // ---------- Стандартные экраны движка + свой титул с живым фоном ----------
  g.useStandardScreens({ get subtitle() { return g.t('subtitle'); }, lives: 3 });

  var demo = null;
  function makeDemo() {
    var seed = 7, rng = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    demo = R.Game({ level: 3, rng: rng }).start();
    var S = demo.state(), cols = S.cols;
    // заранее «отрезанные» куски для декора
    var cut = function (x0, y0, x1, y1) { for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) S.grid[y * cols + x] = 1; };
    cut(2, 2, 22, 16); cut(22, 2, 34, 8); cut(56, 30, 76, 48); cut(64, 18, 76, 30);
    S.sea = S.sea.filter(function (b) { return S.grid[Math.floor(b.y) * cols + Math.floor(b.x)] === 0; });
    S.phase = 'play'; S.inv = 1e9; S.player.x = 22; S.player.y = 15; S.ver++;
  }
  makeDemo();

  var title = g.scenes.title, menu = title._menu;
  title.update = function (dt) { demo.update(dt); };
  title.draw = function (ctx) {
    var th = this.th(), rd = renderer(), retro = this.themeName === 'retro';
    rd.draw(ctx, demo.state(), g, L, true);
    ctx.fillStyle = retro ? 'rgba(0,0,0,.72)' : 'rgba(8,11,17,.7)'; ctx.fillRect(0, 0, W, H);
    var pw = 420, ph = 300, px = (W - pw) / 2, py = (H - ph) / 2 - 4;
    if (retro) {
      ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = rd.P.hudLine; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = rd.P.panel;
      R.ui.roundRect(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#243049'; ctx.lineWidth = 1; R.ui.roundRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke();
    }
    var tcol = retro ? rd.P.accent : '#ff8a3d';
    this.text(this.t('title'), W / 2, py + 72, { size: 52, align: 'center', color: tcol, weight: 900 });
    // «разрез» под заголовком — оранжевая линия с изломом
    ctx.strokeStyle = retro ? rd.P.trail : '#5eead4'; ctx.lineWidth = retro ? 4 : 3; ctx.beginPath();
    ctx.moveTo(px + 90, py + 90); ctx.lineTo(W / 2 - 10, py + 90); ctx.lineTo(W / 2 + 10, py + 98); ctx.lineTo(px + pw - 90, py + 98); ctx.stroke();
    this.text(this.t('subtitle'), W / 2, py + 126, { size: 14, align: 'center', color: th.muted, weight: 600 });
    menu.draw(this, W / 2, py + 170, 30);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 });
    this.text(this.t('hint'), W / 2, H - 14, { size: 12, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume)) newGame(); },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (a === 'left' || a === 'right') lastAxis = 'x';
      if (a === 'up' || a === 'down') lastAxis = 'y';
    },
    update: function (dt) {
      if (!game) return;
      var d = this.input.dir, dx = d.x, dy = d.y;
      if (dx && dy) { if (lastAxis === 'x') dy = 0; else dx = 0; }   // одна ось — последняя нажатая
      game.setDir(dx, dy);
      game.update(dt);
      sync();
    },
    draw: function (ctx) { if (game) renderer().draw(ctx, game.state(), g, L); else this.clear(); }
  });

  // ---------- DOM: язык ссылки «Каталог» и подписи под канвой ----------
  var lastLang = null;
  function syncDom() {
    if (lastLang === g.i18n.lang) return; lastLang = g.i18n.lang;
    document.documentElement.lang = lastLang;
    var b = document.getElementById('back'); if (b) b.textContent = '← ' + g.t('back');
    var f = document.getElementById('foot'); if (f) f.textContent = g.t('foot') + ' ' + g.t('hint') + '.';
  }
  syncDom(); setInterval(syncDom, 250);

  // тач-кнопка паузы (дпад движка знает только U/D/L/R/A)
  var bp = document.getElementById('bPause');
  if (bp) {
    var tp = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    bp.addEventListener('touchstart', tp, { passive: false }); bp.addEventListener('mousedown', tp);
  }

  g.start('title');
})(window);
