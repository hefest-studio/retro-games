/* КЛАДКА · сборка: фреймворк Гефест Arcade (engine.js) + логика (game.js)
   + рендеры retro/modern + звук. Сцены title/pause/win/gameover — g.useStandardScreens,
   титул переопределён: живая демо-кладка на фоне + меню движка. Ввод: клавиши, мышь, палец. */
(function (global) {
  'use strict';
  var K = global.KLADKA, L = K.logic;
  // Палитры движка (меню, пауза, финалы) — в тон мастерской: тёплый тёмный фон, оранжевый акцент
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120e0d', panel: '#1a1412', ink: '#f4ece4', muted: '#a8968a', accent: '#ff8a3d', grid: '#2c211c' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#fc9838', muted: '#a49484' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: L.W, height: L.H, gameId: 'kladka', strings: K.STR, theme: 'modern', lives: 3, themes: themes, leaderboard: 'kladka' });
  K.g = g;   // языки RU/EN/TR/ES/PT — таблицы js/i18n.js (движок v2.8 берёт языки из ключей strings)

  // ---------- Мета-прогрессия: выбор открытого уровня и звёзды (js/meta.js), прогресс — и в облако площадки ----------
  var M = K.meta, prog = M.Progress({ get: function (k) { return Arcade.Store.get(k, null); }, set: function (k, v) { g.storeSet(k, v); } });
  for (var lv = 1; lv <= M.LEVELS; lv++) g.persist(M.key(lv), 'max');
  var START_KEY = 'arcade.kladka.start'; g.persist(START_KEY, 'last');
  function startLv() { var v = parseInt(Arcade.Store.get(START_KEY, '1'), 10) || 1; return prog.unlocked(v) ? v : prog.maxUnlocked(); }
  function setStart(v) { g.storeSet(START_KEY, v); }
  // ---------- Площадка (движок v2.8): таблица лидеров «общий счёт», «Без рекламы», свои игры, ярлык, оценка ----------
  // Таблица kladka — лучший счёт партии: новый рекорд уходит сам из g.saveBest (createGame({ leaderboard: 'kladka' })), рекорд из облака —
  // после слияния. В консоли площадки: Яндекс — лидерборд с техническим именем «kladka», GamePush — числовое поле игрока «kladka».
  var LB = 'kladka';
  function lbBest() { if (g.state.best > 0) g.leaderboard.submit(g.state.best, { board: LB }); }
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' }); g.useOwnGames(); g.useShortcut();
  g.useReview({ minSessions: 3, gap: 3, success: function (sc) { return sc === 'win' || this._newBest || (lastStars && lastStars.n === 3); } });   // победа, рекорд или уровень на 3 звезды
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд/звёзды с другого устройства — рекорд в таблицу
  var lastStars = null;   // { level, n, c, isNew, opened } — итог уровня для плашки на экране «кладка разобрана»
  function starStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function fmt(s, n) { return String(s).replace('{n}', n); }
  function fitK(s, maxW, size, weight, P) { var f = P.font || g.th().font; while (size > 8) { g.ctx.font = weight + ' ' + size + 'px ' + f; if (g.ctx.measureText(s).width <= maxW) break; size--; } return size; }   // длинные строки TR/ES/PT
  function onClearStars(d) {
    var r = M.stars(d), before = prog.maxUnlocked(), isNew = prog.record(d.level, r.n), after = prog.maxUnlocked();
    lastStars = { level: d.level, n: r.n, c: r.c, isNew: isNew, opened: after > before ? after : 0 };
    if (lastStars.opened) setStart(after);   // открыли новый уровень — следующая партия по умолчанию с него
  }
  // звезда-фигура (не символ шрифта: одинаково в обеих темах)
  function drawStar(ctx, x, y, r, on, P) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = on ? (P.pixel ? '#fcd838' : '#ffc94a') : (P.pixel ? '#3a3040' : 'rgba(255,255,255,.12)'); ctx.fill();
    if (!on) { ctx.strokeStyle = P.muted; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function drawLevelStars(ctx, P) {
    var x0 = L.W / 2, y = 500;
    for (var i = 0; i < 3; i++) drawStar(ctx, x0 + (i - 1) * 30, y, 11, lastStars.c[i], P);
    var lines = [g.t('st_clear'), g.t('st_safe'), fmt(g.t('st_fast'), M.PAR[lastStars.level - 1])];
    for (var j = 0; j < 3; j++) K.ui.txt(g, (lastStars.c[j] ? '✓ ' : '✗ ') + lines[j], x0, y + 30 + j * 16, { size: 12, align: 'center', color: lastStars.c[j] ? P.good : P.muted, weight: 700 }, P);
    if (lastStars.opened) K.ui.txt(g, fmt(g.t('opened'), lastStars.opened), x0, y + 84, { size: 13, align: 'center', color: P.accent, weight: 900 }, P);
  }
  g.input.bindDpad(document.querySelector('.pad'));
  K.ui.init(g);

  function rnd() { return g.themeName === 'retro' ? K.classic : K.modern; }
  var game = null, toasts = [], playSince = 0, wasDraft = false, adGate = 0;   // adGate: 1 — ждём уровень, 2 — ждём нажатия, 3 — идёт показ

  // Сложность уровня — через g.difficulty движка (база + шаг на уровень, с потолком)
  function diff(level, base, step, max) {
    var keep = g.state.level; g.state.level = level;
    var v = g.difficulty(base, step, max); g.state.level = keep; return v;
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = s.score; g.state.lives = s.lives; g.state.level = s.level; }
  function toast(text, color, x, y) {
    for (var i = 0; i < toasts.length; i++) if (toasts[i].t > 0.9 && Math.abs(toasts[i].y - y) < 16) y -= 18;   // не наслаивать
    toasts.push({ text: text, color: color, x: Math.max(70, Math.min(L.W - 70, x)), y: y, t: 1.4 }); }

  function fx(type, d) {
    var P = rnd().P, pix = P.pixel, sz = pix ? 4 : 3;
    if (type === 'break') {
      var col = d.max === 3 ? P.three : d.max === 2 ? P.two : d.gift ? '#f5e6c8' : P.tones[d.tone || 0];
      g.particles.spawn(d.x, d.y, { color: col, count: 9, speed: 90, life: 0.5, size: sz });
    } else if (type === 'hit') g.particles.spawn(d.x, d.y, { color: '#ffffff', count: 4, speed: 50, life: 0.25, size: 2 });
    else if (type === 'bossHit') g.particles.spawn(d.x, d.y, { color: '#ffb03a', count: 12, speed: 110, life: 0.5, size: sz });
    else if (type === 'bossDie') { g.particles.spawn(d.x, d.y, { color: '#ff6a2a', count: 40, speed: 200, life: 1.1, size: sz + 1 }); g.particles.spawn(d.x, d.y, { color: '#fff3c8', count: 20, speed: 120, life: 0.8, size: sz }); }
    else if (type === 'burn') g.particles.spawn(d.x, d.y, { color: '#9cc2ff', count: 10, speed: 80, life: 0.4, size: sz });
    else if (type === 'lose') g.particles.spawn(d.x, L.PADDLE_Y, { color: P.accent, count: 18, speed: 120, life: 0.7, size: sz });
  }

  function onEvent(type, d) {
    K.sfx(g, type, d); fx(type, d);
    if (type === 'power' && game) { var S = game.state(); toast(g.t('pw_' + d.kind), rnd().P.pw[d.kind], S.paddle.x, L.PADDLE_Y - 16); }
    if (type === 'revive') toast(g.t('revived'), rnd().P.accent, L.W / 2, 380);
    if (type === 'clear') onClearStars(d);
    if (type === 'clear' && g.adReady()) adGate = 1;   // межстраничная реклама между уровнями — только по нажатию игрока (Яндекс 4.4)
    sync();
    if (type === 'win') g.win();
    else if (type === 'gameover') g.gameover();
  }

  function newGame() {
    lastStars = null;
    game = K.Game({ lives: 3, level: startLv(), difficulty: diff, onEvent: onEvent });
    game.start(); K.current = game; toasts = []; wasDraft = false; adGate = 0; sync();
  }
  // Пауза между уровнями с рекламой: «КЛАДКА РАЗОБРАНА» доигрывает 2 с, затем ждёт нажатия игрока → полноэкранная реклама → уровень.
  function adGo() { if (adGate !== 2) return false; adGate = 3; g.adBreak().then(function () { adGate = 0; }); return true; }
  // Реклама за награду (только на площадках с рекламой): «ещё один шанс» (1 ядро) раз за партию; бонус в паузе — +1 ядро.
  g.useRewardedContinue({ revive: function () { if (game) game.revive(); } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { var S = game && game.state(); return !!S && !S.over && S.lives < L.MAX_LIVES; },
    grant: function () { if (game) game.addLife(); } });

  // ---------- Стандартные экраны + фон кладки на всех экранах ----------
  g.useStandardScreens({ lives: 3 });
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'level' });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };   // P / Esc на паузе — назад в игру
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); rnd().bg(this.ctx, this); };

  // ---------- Титул: демо-кладка «играет сама» ----------
  var demo = null, demoSeed = 11, demoLevels = [1, 2, 3, 5, 7, 8, 4];
  function makeDemo() {
    var s = demoSeed++, rng = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    demo = K.Game({ level: demoLevels[demoSeed % demoLevels.length], maxLevel: 99, lives: 99, rng: rng }).start();
  }
  makeDemo();
  function demoStep(dt) {
    var S = demo.state(), b = S.balls[0];
    if (b) demo.setTarget(b.x + Math.sin(S.time * 0.7) * S.paddle.w * 0.3);
    if (S.balls.some(function (x) { return x.stuck; }) && S.time % 1.2 < dt) demo.action();
    demo.update(dt);
    if (S.phase !== 'play' || S.time > 50) makeDemo();
  }

  var title = g.scenes.title, menu = title._menu;
  // пункт «Уровень N ★★☆»: выбор/тап — следующий открытый, ← → — по кругу
  g.menu.addItem({ key: 'level', scene: 'title', after: 'play', label: function () { var n = startLv(); return g.t('lvPick') + ' ' + n + '  ' + starStr(prog.get(n)); },
    onSelect: function () { setStart(prog.next(startLv(), 1)); } });
  title.press = function (a) { var it = menu.current(); if (it && it.key === 'level' && (a === 'left' || a === 'right')) { setStart(prog.next(startLv(), a === 'left' ? -1 : 1)); this.audio.beep(600, 0.03); } };
  title.update = function (dt) { demoStep(Math.min(dt, 0.05)); };
  title.draw = function (ctx) {
    var th = this.th(), r = rnd(), P = r.P, retro = P.pixel, W = this.W, H = this.H;
    r.draw(ctx, demo.state(), this, { bare: true });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.72)' : 'rgba(14,10,9,.72)'; ctx.fillRect(0, 0, W, H);
    var n = menu.items.length, lh = n > 5 ? 26 : 30, extra = Math.max(0, (n - 1) * lh - 120);   // много пунктов (площадка) — панель выше
    var pw = 380, ph = 370 + extra, px = (W - pw) / 2, py = Math.max(40, 130 - extra / 2);
    if (retro) {
      ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = P.hudLine; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = P.panel;
      K.ui.roundRect(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 1; K.ui.roundRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke();
    }
    K.ui.txt(this, this.t('title'), W / 2, py + 66, { size: fitK(this.t('title'), pw - 24, 50, 900, P), align: 'center', color: P.accent, weight: 900 }, P);
    // «кладка» под заголовком: ряд кирпичиков вперевязку
    for (var row = 0; row < 2; row++) for (var i = 0; i < 7 - row; i++) {
      var bx = W / 2 - 98 + row * 14 + i * 28, by = py + 80 + row * 10, col = P.tones[(i + row * 3) % 6];
      ctx.fillStyle = col;
      if (retro) ctx.fillRect(bx, by, 26, 8); else { K.ui.roundRect(ctx, bx, by, 26, 8, 2); ctx.fill(); }
    }
    K.ui.txt(this, this.t('subtitle'), W / 2, py + 126, { size: fitK(this.t('subtitle'), pw - 20, 13, 600, P), align: 'center', color: th.muted, weight: 600 }, P);
    menu.draw(this, W / 2, py + 162, lh);
    var sl = startLv();
    var info = this.t('lv_' + L.LEVELS[sl - 1].name) + ' · ★ ' + prog.total() + '/' + (M.LEVELS * 3) + ' · ' + this.t('unlockedLv') + ': ' + prog.maxUnlocked() + '/' + M.LEVELS;
    K.ui.txt(this, info, W / 2, py + ph - 36, { size: fitK(info, pw - 20, 12, 700, P), align: 'center', color: P.accent, weight: 700 }, P);
    if (this.state.best) K.ui.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 16, { size: 12, align: 'center', color: th.muted, weight: 600 }, P);
    K.ui.txt(this, this.t('hint'), W / 2, H - 22, { size: fitK(this.t('hint'), W - 24, 11, 600, P), align: 'center', color: th.muted, weight: 600 }, P);
  };

  // ---------- Игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) {
      if (!game) return;
      if (a === 'pause') { this.pause(); return; }
      if ((a === 'action' || a === 'start') && adGo()) return;
      if (a === 'action') game.action();
    },
    update: function (dt) {
      if (!game) return;
      game.setDir(this.input.dir.x);
      game.setFire(this.input.pressed('action'));
      var S = game.state();
      if (adGate === 1 && S.phase === 'clear' && S.phaseT <= dt * 1.5) adGate = 2;
      if (adGate >= 2) { if (S.phase !== 'clear') adGate = 0; else return; }   // ждём нажатия / идёт показ
      game.update(dt);
      if (S.draft && !wasDraft) toast(g.t('draft'), rnd().P.accent, L.W / 2, 380);
      wasDraft = S.draft;
      for (var i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (o) { return o.t > 0; });
      sync();
    },
    draw: function (ctx) { if (game) { rnd().draw(ctx, game.state(), this, { toasts: toasts }); if (lastStars && game.state().phase === 'clear' && lastStars.level === game.state().level) drawLevelStars(ctx, rnd().P); if (adGate === 2 && Math.floor(this.time * 2) % 2 === 0) K.ui.txt(this, this.t('nextLevel'), L.W / 2, 440, { size: 15, align: 'center', color: rnd().P.accent, weight: 800 }, rnd().P); } else this.clear(); }
  });

  // ---------- Мышь и палец ----------
  var cv = g.canvas;
  function canvasX(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) * (g.W / r.width); }
  function live() { return g._sceneName === 'play' && game && g.time - playSince > 0.25; }
  cv.addEventListener('mousemove', function (e) { if (live()) game.setTarget(canvasX(e)); });
  cv.addEventListener('mousedown', function (e) { if (live()) { if (adGo()) return; game.setTarget(canvasX(e)); game.action(); } });
  var touch = null;   // перетаскивание: мастерок едет на смещение пальца; короткий тап — пуск/резак
  cv.addEventListener('touchstart', function (e) {
    if (!live()) return; e.preventDefault(); if (adGo()) return;
    var t = e.changedTouches[0]; touch = { id: t.identifier, x0: canvasX(t), px: game.state().paddle.x, cx: t.clientX, cy: t.clientY, at: Date.now(), moved: false };
  }, { passive: false });
  cv.addEventListener('touchmove', function (e) {
    if (!touch || !live()) return; e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i]; if (t.identifier !== touch.id) continue;
      if (Math.abs(t.clientX - touch.cx) + Math.abs(t.clientY - touch.cy) > 8) touch.moved = true;
      game.setTarget(touch.px + (canvasX(t) - touch.x0) * 1.15);
    }
  }, { passive: false });
  cv.addEventListener('touchend', function (e) {
    if (!touch) return;
    if (live()) { e.preventDefault(); if (!touch.moved && Date.now() - touch.at < 300) game.action(); }
    touch = null;
  }, { passive: false });

  g.start('title');
  K.app = { g: g, game: function () { return game; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
