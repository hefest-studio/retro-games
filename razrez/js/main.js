/* РАЗРЕЗ · сборка игры на фреймворке Гефест Arcade v2: сцены, ввод, связь
   логики (game.js) с рендерерами (modern/classic), звуком и стандартными меню. */
(function (global) {
  'use strict';
  var R = global.RAZREZ;
  var W = 800, H = 560;
  // Раскладка: HUD сверху 44 px, поле 78×50 клеток по 10 px
  var L = { W: W, H: H, CELL: 10, OX: 10, OY: 50, COLS: R.logic.COLS, ROWS: R.logic.ROWS };

  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'razrez', leaderboard: 'razrez', strings: R.STR, theme: 'modern', lives: 3 });
  R.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  // Подгонка канвы по ширине И высоте окна (площадки: телефон портрет/ландшафт, планшет, десктоп — без прокрутки страницы)
  function fit() {
    var c = g.canvas, wrap = c.parentElement, pad = document.querySelector('.pad'), cs = pad && getComputedStyle(pad);
    var padH = cs && cs.display !== 'none' && cs.position !== 'fixed' ? pad.offsetHeight + 20 : 0;
    var foot = document.getElementById('foot'), footH = foot && getComputedStyle(foot).display !== 'none' ? foot.offsetHeight + 22 : 0;
    var availH = innerHeight - padH - Math.max(padH ? 44 : 40, 40 + footH);
    var w = Math.max(260, Math.floor(Math.min(820, (wrap && wrap.clientWidth) || W, availH * W / H)));
    c.style.width = w + 'px'; c.style.height = Math.round(w * H / W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - innerHeight;   // страховка: подпись выросла — ужать
    if (over > 0 && w > 260) { w = Math.max(260, Math.floor(w - over * W / H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * H / W) + 'px'; }
  }
  fit(); addEventListener('resize', fit);

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
    if (type === 'level' && g.adReady()) { cardLv = d.level - 1; g.goto('card'); }   // межстраничная — по нажатию на карточке уровня (Яндекс 4.4)
    if (type === 'win') g.win();
    if (type === 'gameover') g.gameover();
  }

  function newGame() {
    g.resetRun();
    game = R.Game({ lives: 3, level: 1, difficulty: diff, onEvent: onEvent }).start();
    R.current = game; sync();
  }

  // ---------- Стандартные экраны движка + свой титул с живым фоном ----------
  g.useStandardScreens({ get subtitle() { return g.t('subtitle'); }, lives: 3 });

  // ---------- Площадка (движок v2.8/2.9): таблица лидеров «razrez», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «razrez», GamePush — числовое поле игрока «razrez» + лидерборд; товар no_ads
  // (постоянный). Список — promo/razrez/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'razrez';
  g.persist('arcade.best.razrez', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  // «Ещё один шанс» (раз за партию): 1 жизнь на том же уровне, отрезанное поле сохраняется; бонус в паузе — +1 жизнь
  g.useRewardedContinue({ revive: function () { if (game) game.reviveAd(); } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- Карточка «уровень пройден» (только когда площадка готова показать межстраничную): нажатие → реклама → дальше ----------
  var cardLv = 0, cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var th = this.th(), rd = renderer();
      if (game) rd.draw(ctx, game.state(), g, L, true); else this.clear();
      ctx.fillStyle = 'rgba(6,8,14,.72)'; ctx.fillRect(0, 0, W, H);
      this.text(this.t('clear') + ' · ' + cardLv + '/' + R.logic.MAX_LEVEL, W / 2, H / 2 - 20, { size: 34, align: 'center', color: th.accent, weight: 900, maxWidth: W - 80 });
      if (game) this.text(this.t('score') + ': ' + game.state().score, W / 2, H / 2 + 20, { size: 20, align: 'center', color: th.ink, weight: 700, maxWidth: W - 80 });
      this.text(this.t('cardNext'), W / 2, H / 2 + 62, { size: 15, align: 'center', color: th.muted, weight: 600, maxWidth: W - 80 });
    }
  });
  g.canvas.addEventListener('mousedown', function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'card') cardGo(); });
  g.canvas.addEventListener('touchstart', function (e) { if (g._sceneName === 'card') { Arcade.touchOk(e); cardGo(); } }, { passive: false });

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
    this.text(this.t('title'), W / 2, py + 72, { size: 52, align: 'center', color: tcol, weight: 900, maxWidth: pw - 40 });
    // «разрез» под заголовком — оранжевая линия с изломом
    ctx.strokeStyle = retro ? rd.P.trail : '#5eead4'; ctx.lineWidth = retro ? 4 : 3; ctx.beginPath();
    ctx.moveTo(px + 90, py + 90); ctx.lineTo(W / 2 - 10, py + 90); ctx.lineTo(W / 2 + 10, py + 98); ctx.lineTo(px + pw - 90, py + 98); ctx.stroke();
    this.text(this.t('subtitle'), W / 2, py + 126, { size: 14, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 30 });
    var mf = menuFit(menu, py + 170, 30, py + 150, py + ph - 32); menu.draw(this, W / 2, mf[0], mf[1]);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 });
    this.text(this.t(this.input.touchOnly ? 'hintTouch' : 'hint'), W / 2, H - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: W - 20 });
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
    fit();
  }
  syncDom(); setInterval(syncDom, 250);

  // тач-кнопка паузы (дпад движка знает только U/D/L/R/A)
  var bp = document.getElementById('bPause');
  if (bp) {
    var tp = function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    bp.addEventListener('touchstart', tp, { passive: false }); bp.addEventListener('mousedown', tp);
  }

  g.start('title');
})(window);
