/* ПОСОХ · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js, save.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован; в меню — «Новая игра» (с подтверждением),
   в паузе («привал») — «На карту маршрута» (участок заново, с подтверждением) и бонус за рекламу (+1 жизнь).
   Сцена play: режим 'map' (карта маршрута: участки по порядку, пройденные можно повторять за реперами, в конце — обсерватория)
   ↔ 'exp' (участок). Ввод: ←→/AD — бег; Пробел/Z/K — прыжок; X/J/Ctrl — бросить веху, с ↑/W — вверх под 45°;
   тач: виртуальный стик (js/stick.js) — бег, вверх — прицел; ● — прыжок, ⟋ — веха, II — привал.
   Геймпад — движком: A — прыжок (Space), B — веха (KeyX), X — тоже прыжок (KeyZ), стик/крестовина вверх — прицел.
   Прогресс — localStorage arcade.save.posokh (save.js), рекорд — arcade.best.posokh (движок), достижения — arcade.ach.posokh. */
(function (global) {
  'use strict';
  var PS = global.POSOKH, L = PS.logic, R = PS.R, FX = R.FX, VW = R.VW, VH = R.VH, T = L.T;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#14121c', panel: '#1f1b2a', ink: '#f4f0e8', muted: '#b4aa9c', accent: '#f07a24', good: '#8fd86a', bad: '#ff6b6b', warn: '#ffd34d', grid: '#2b2638' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'posokh', leaderboard: 'posokh', strings: PS.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  PS.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var ls = null; try { ls = global.localStorage; } catch (e) {}
  var store = PS.save.store(ls || { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} });
  var prog = store.load();

  var game = null, mode = 'map', playSince = 0, cam = 0;
  var ui = { toasts: [], banner: null, msg: null, runPh: 0, shake: 0, throwT: 0, throwUp: false, fx: FX, cam: 0, aimUp: false };
  var M = { sel: prog.at, note: '', noteA: 0, ach: store.ach() };
  var held = {}, extra = { jump: false }, result = null, tipStone = false, going = false;
  function S() { return game.state(); }
  function th() { return g.th(); }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  function sync() { if (mode === 'exp' && game) { var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); } else { g.state.score = prog.score; g.state.lives = prog.lives; } }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < ui.toasts.length; i++) if (Math.abs(ui.toasts[i].y - y) < 10 && Math.abs(ui.toasts[i].x - x) < 60) y -= 12;
    var life = big ? 1.7 : 1.0; ui.toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big }); if (ui.toasts.length > 14) ui.toasts.shift();
  }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.8 }; }
  function banner(title, sub, dur, lines, color) { ui.banner = { title: title, sub: sub, a: dur || 2.4, dur: dur || 2.4, lines: lines, color: color }; }
  var curTrack = null;
  function music(tr) { if (curTrack === tr) return; curTrack = tr; g.setMusic(tr); g.audio.music.step = 0; }
  var E = R.E;
  if (!prog.note) { M.note = g.t('updated'); M.noteA = 6; prog.note = 1; store.save(prog); }   // прежняя версия игры: плашка один раз

  function onEvent(type, d) {
    d = d || {};
    PS.sfx(g, type, d);
    var s = game ? S() : null, P = s && s.hero, t = th();
    switch (type) {
      case 'start': {
        ui.toasts = []; FX.clear(); ui.msg = null; music(PS.MUSIC.level);
        var LV = s.LV, lines = [];
        if (LV.id === 'mine' && !prog.cleared.mine) { lines.push(g.t('intro')); lines.push(g.t('intro2')); }
        banner(g.t('x_' + LV.id), g.t('xd_' + LV.id), lines.length ? 5 : 3, lines);
        break;
      }
      case 'throw': ui.throwT = 1; ui.throwUp = !!d.up; break;
      case 'peg': FX.add(d.x, d.y, { n: 6, sp: 60, life: 0.3, c: col(s.LV.id === 'ridge' ? '#ffffff' : '#c9a06a', E.y), r: 1.6, g: 200 }); break;
      case 'unpeg': FX.add(d.x, d.y, { n: 5, sp: 40, life: 0.35, c: col('#ffffff', E.w), r: 1.4, g: -40 }); break;
      case 'parry': FX.add(d.x, d.y, { n: 5, sp: 90, life: 0.25, c: col('#fff4c8', E.y), r: 1.4 }); break;
      case 'clink': FX.add(d.x, d.y, { n: 5, sp: 90, life: 0.25, c: col('#fff4c8', E.y), r: 1.4 }); if (!tipStone && !prog.cleared.mine) { tipStone = true; msg(g.t('stoneTip'), t.warn, 2.6); } break;   // подсказка про камень — пока не пройдены копи
      case 'gem': toast('+' + d.v, col(d.big ? '#e3b0ff' : '#ffe08a', d.big ? E.M : E.y), d.x, d.y - 8); FX.add(d.x, d.y, { n: d.big ? 10 : 5, sp: 70, life: 0.35, c: col('#ffffff', E.w), r: 1.6, g: 0 }); break;
      case 'pie': toast(g.t('pie'), col('#ffcf7a', E.y), d.x, d.y - 10, true); break;
      case 'life': toast(g.t('life'), col('#ffd56a', E.y), d.x != null ? d.x : (P ? P.x : 0), d.y != null ? d.y - 12 : 60, true); break;
      case 'mark': toast(g.t('mark') + ' +' + d.v, col('#ffd56a', E.y), d.x, d.y - 12, true); FX.add(d.x, d.y, { n: 22, sp: 130, c: col('#ffe6a0', E.y), r: 2 }); msg(g.t('marks') + ': ' + d.n + '/' + s.LV.marks.length, t.good, 2); break;
      case 'flag': toast(g.t('flag'), col('#ffb35c', E.y), d.x, d.y - 32); break;
      case 'kill': toast('+' + d.v, col('#ffe08a', E.y), d.x, d.y - 8); FX.add(d.x, d.y, { n: 12, sp: 110, c: col('#fff0d0', E.w), r: 2 }); break;
      case 'crack': FX.add(d.x, d.y, { n: 14, sp: 90, life: 0.6, c: col('#a89080', E.l), r: 2.2, g: 400 }); toast(g.t('crack'), col('#ffd56a', E.y), d.x, d.y - 10); break;
      case 'hurt': ui.shake = 0.25; FX.add(d.x, d.y - 12, { n: 10, sp: 110, c: col('#ff8a8a', E.R), r: 2 }); break;
      case 'die': ui.shake = 0.4; FX.add(d.x, d.y - 12, { n: 22, sp: 140, c: col('#f4f0e8', E.w), r: 2.4 }); msg(g.t('d_' + d.why, ''), t.bad, 1.6); break;
      case 'respawn': ui.toasts = []; if (curTrack === PS.MUSIC.boss) music(PS.MUSIC.level); break;
      case 'thud': ui.shake = Math.max(ui.shake, 0.15); break;
      case 'guardWake': banner(g.t('g_' + s.LV.guard), '', 1.8); break;
      case 'guardDown': ui.shake = 0.4; toast('+' + d.v, col('#ffe08a', E.y), d.x, d.y - 20, true); msg(g.t('gate'), t.good, 2); FX.add(d.x, d.y, { n: 30, sp: 160, c: col('#ffffff', E.w), r: 2.2 }); break;
      case 'bossWake': music(PS.MUSIC.boss); banner(g.t('b_' + d.k), g.t('bd_' + d.k), 3); break;
      case 'guardHit': case 'bossHit': FX.add(d.x, d.y, { n: 12, sp: 130, c: col('#ffe36a', E.y), r: 2 }); break;
      case 'bossDown': ui.shake = 0.6; music(PS.MUSIC.level); FX.add(d.x, d.y, { n: 40, sp: 200, c: col('#ffffff', E.w), r: 2.6, life: 0.9 }); toast('+' + R.num(d.v), col('#ffe08a', E.y), d.x, d.y - 30, true); break;
      case 'sign': FX.add(d.x, d.y, { n: 30, sp: 150, c: col('#ffe6a0', E.y), r: 2.4, life: 0.9 }); break;
      case 'clear': onClear(d); break;
      case 'gameover':
        sync();
        setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') { g.state.score = S().score; g.gameover(); } }, 1500);
        break;
    }
    sync();
  }
  function onClear(d) {
    var first = !prog.cleared[d.id];
    PS.save.apply(prog, d); store.save(prog);
    var lines = [g.t('total') + ': ' + R.num(prog.score) + '   (+' + R.num(d.gain) + ')', g.t('marks') + ': ' + PS.save.markCount(prog, d.id) + '/' + S().LV.marks.length];
    if (first && PS.save.allCleared(prog)) lines.push(g.t('obsOpen'));
    lines.push(g.t('tapMap'));
    banner(g.t('clear'), g.t('x_' + d.id), 99, lines, th().good);
    result = { t: 0, finale: first && PS.save.allCleared(prog) };
  }

  // ---------- карта маршрута / участок ----------
  function newRun() { prog = store.load(); M.sel = prog.at; M.ach = store.ach(); game = null; result = null; toMap(); }
  function toMap() {
    mode = 'map'; result = null; ui.banner = null; ui.msg = null; ui.toasts = []; FX.clear(); going = false;
    if (M.sel !== 'obs' && !PS.save.isOpen(prog, M.sel)) M.sel = PS.save.firstOpen(prog);
    music(PS.MUSIC.camp); sync();
  }
  function enterExp(id) {
    mode = 'exp'; prog.at = id; store.save(prog); tipStone = false;
    game = PS.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1) });
    game.start(id, { marks: prog.marks[id] || [], lives: prog.lives, score: prog.score });
    PS.current = game; cam = -1; playSince = g.time; ui.runPh = 0;
    sync();
  }
  function mapMove(a) {
    var path = PS.levels.ids.concat(['obs']), i = path.indexOf(M.sel);
    if (a === 'right' && i < path.length - 1) { M.sel = path[i + 1]; g.audio.beep(520, 0.03); }
    else if (a === 'left' && i > 0) { M.sel = path[i - 1]; g.audio.beep(520, 0.03); }
  }
  function mapGo() {
    if (M.sel === 'obs') { if (!PS.save.allCleared(prog)) { M.note = g.t('obsLocked'); M.noteA = 1.6; g.audio.beep(180, 0.06); return; } finale(); return; }
    if (!PS.save.isOpen(prog, M.sel)) { M.note = g.t('locked'); M.noteA = 1.6; g.audio.beep(180, 0.06); return; }
    enterExp(M.sel);
  }
  var ending = null;
  function finale() {
    var full = PS.save.fullMap(prog), a = store.ach();
    a.ends = (a.ends | 0) + 1; if (full) a.fullMap = 1; store.setAch(a); M.ach = a;
    ending = { full: full };
    g.state.score = prog.score; PS.save.burn(prog); prog.at = PS.levels.ids[0]; store.save(prog);
    g.win();
  }
  function leaveToMap() {
    if (!game || mode !== 'exp') return;
    M.sel = S().id; game = null; toMap();
  }

  // ---------- стандартные экраны и меню ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  var newArm = 0, titleNote = null, mapArm = 0;
  g.menu.addItem({ key: 'newgame', after: 'play', label: function () { return newArm > g.time ? g.t('newQ') : g.t('newGame'); },
    onSelect: function () { if (!store.has()) { this.state.score = 0; this.goto('play'); return; } if (newArm > g.time) { store.wipe(); prog = store.load(); newArm = 0; titleNote = { text: g.t('newDone'), a: 2 }; } else newArm = g.time + 3; } });
  var mapItem = { key: 'tomap', scene: 'pause', before: 'menu', label: function () { return mapArm > g.time ? g.t('toMapQ') : g.t('toMap'); },
    onSelect: function () {
      if (mode !== 'exp' || !game || S().phase !== 'play') { g.goto('play', { resume: true }); return; }
      if (mapArm > g.time) { mapArm = 0; leaveToMap(); g.goto('play', { resume: true }); } else mapArm = g.time + 3;
    } };
  g.scenes.pause.enter = function () { mapArm = 0; if (mode === 'exp' && game && S().phase === 'play') g.menu.addItem(mapItem); else g.menu.removeItem('tomap', 'pause'); };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // конец жизней (после «ещё одного шанса» или без него): очки маршрута сгорают, пройденное и реперы остаются
  var goEnter = g.scenes.gameover.enter;
  g.scenes.gameover.enter = function () {
    if (game && mode === 'exp') { var r = game.result(false); PS.save.apply(prog, { id: r.id, won: false, marks: r.marks }); PS.save.burn(prog); store.save(prog); game = null; mode = 'map'; }
    if (goEnter) goEnter.apply(this, arguments);
  };
  g.scenes.win.draw = function (ctx) {
    var rtr = retro(), t = this.time, Pc = th();
    R.background(ctx, 'tower', t * 10, rtr, t);
    ctx.fillStyle = rtr ? 'rgba(0,0,0,.6)' : 'rgba(10,8,20,.6)'; ctx.fillRect(0, 0, VW, VH);
    this.text(this.t('win'), VW / 2, 50, { size: 24, align: 'center', color: Pc.good, weight: 900, maxWidth: VW - 30 });
    this.text(this.t('ending'), VW / 2, 74, { size: 11, align: 'center', color: Pc.ink, weight: 700, maxWidth: VW - 30 });
    var full = ending && ending.full;
    this.text(full ? this.t('endingFull') : this.t('endingPart'), VW / 2, 92, { size: 11, align: 'center', color: full ? Pc.warn : Pc.muted, weight: 800, maxWidth: VW - 30 });
    if (full) this.text('★ ' + this.t('achFull'), VW / 2, 108, { size: 11, align: 'center', color: Pc.warn, weight: 800, maxWidth: VW - 30 });
    ctx.save(); ctx.translate(VW / 2, 206); ctx.scale(2.5, 2.5);
    R.hero(ctx, -10, 0, { face: 1 }, rtr, t); R.itemIcon(ctx, 14, -10, 'sign', rtr, 1);
    ctx.restore();
    this.text(this.t('score') + ': ' + R.num(this.state.score) + (this.state.best ? '   ' + this.t('best') + ': ' + R.num(this.state.best) : ''), VW / 2, 236, { size: 14, align: 'center', color: Pc.accent, weight: 800, maxWidth: VW - 30 });
    this.text(this.t('tapstart'), VW / 2, VH - 16, { size: 11, align: 'center', color: Pc.muted, weight: 700 });
  };
  var goDraw = g.scenes.gameover.draw;
  g.scenes.gameover.draw = function (ctx) {
    goDraw.call(this, ctx);
    ctx.save(); ctx.translate(VW / 2 - 6, VH / 2 + 74); ctx.scale(2, 2); R.hero(ctx, 0, 0, { face: 1, hold: false }, retro(), this.time); ctx.restore();
    this.text(this.t('burned'), VW / 2, VH / 2 + 28, { size: 11, align: 'center', color: th().muted, weight: 700, maxWidth: VW - 30 });
  };

  // ---------- Площадка (движок v2.8/2.9): таблица лидеров «posokh», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «posokh», GamePush — числовое поле игрока «posokh» + лидерборд; товар no_ads
  // (постоянный). Список — promo/posokh/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'posokh';
  g.persist('arcade.best.posokh', 'max'); g.persist(PS.save.KEY, 'last'); g.persist(PS.save.ACH, 'last');   // рекорд, маршрут и достижения — и в облако
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) { lbBest(); if (keys.indexOf(PS.save.KEY) >= 0 && g._sceneName !== 'play') prog = store.load(); } });
  // «Ещё один шанс» (раз за партию): после последней жизни — встать с 1 жизнью у привала; бонус в паузе — +1 жизнь
  g.useRewardedContinue({ revive: function () { if (game && mode === 'exp') { game.reviveAd(); playSince = g.time; sync(); } } });
  g.useRewardedBonus({ key: 'rwLife', scene: 'pause', label: function () { return g.t('rwLife'); },
    available: function () { return !!game && mode === 'exp' && game.canBoost(); }, grant: function () { if (game) { game.boost(); sync(); } } });
  // Меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 19)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(19, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  var playItem = menu.items[menu.indexOf('play')];
  playItem.label = function () { return store.has() ? g.t('cont') : g.t('play'); };
  title.draw = function (ctx) {
    var rtr = retro(), Wc = this.W, Hc = this.H, t = this.time, Pc = th();
    ctx.imageSmoothingEnabled = !rtr;
    R.background(ctx, 'ridge', t * 14, rtr, t);
    ctx.fillStyle = rtr ? 'rgba(0,0,0,.45)' : 'rgba(20,16,30,.45)'; ctx.fillRect(0, 0, Wc, Hc);
    ctx.fillStyle = rtr ? R.E.l : '#d8cdbd'; ctx.fillRect(0, Hc - 40, Wc, 40); ctx.fillStyle = rtr ? R.E.w : '#f0e8dc'; ctx.fillRect(0, Hc - 40, Wc, 4);
    // мягкая стена с лесенкой вех и героиня на верхней
    var P = R.EXPAL.mine;
    for (var r = 0; r < 9; r++) { ctx.fillStyle = rtr ? R.E.n : (r % 2 ? '#7a4e26' : '#8a5a2e'); ctx.fillRect(28, Hc - 40 - (r + 1) * 16, 32, 16); ctx.fillStyle = rtr ? R.E.k : 'rgba(0,0,0,.25)'; ctx.fillRect(28, Hc - 40 - (r + 1) * 16 + 15, 32, 1); }
    for (var k = 0; k < 3; k++) R.pole(ctx, 60, Hc - 40 - 32 - k * 32 + 1, 18, false, rtr, 1);
    R.hero(ctx, 72, Hc - 40 - 96, { face: 1 }, rtr, t);
    var tt = this.t('title');
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = rtr ? 'bold 48px "Courier New", monospace' : '900 54px Inter, system-ui, sans-serif';
    var fs = Math.min(1, (Wc - 60) / Math.max(1, ctx.measureText(tt).width));
    ctx.translate(Wc / 2, 61); ctx.scale(fs, fs);
    if (rtr) { ctx.fillStyle = R.E.r; ctx.fillText(tt, 3, 2); ctx.fillStyle = R.E.w; ctx.fillText(tt, 0, 0); }
    else {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(tt, 2, 3);
      var lg = ctx.createLinearGradient(0, -43, 0, 0); lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.5, '#f07a24'); lg.addColorStop(1, '#b8341c'); ctx.fillStyle = lg; ctx.fillText(tt, 0, 0);
    }
    ctx.restore();
    // полосатая черта под названием — веха
    R.pole(ctx, Wc / 2 - 90, 70, 180, false, rtr, 1);
    this.text(this.t('subtitle'), Wc / 2, 88, { size: rtr ? 10 : 12, align: 'center', color: Pc.ink, weight: 700, maxWidth: Wc - 40 });
    R.gem(ctx, 440, Hc - 52, true, 0, rtr, t); R.itemIcon(ctx, 470, Hc - 60, 'sign', rtr, 1.4);
    var mf = menuFit(menu, 118, 24, 100, Hc - 60);
    menu.draw(this, Wc / 2 + 30, mf[0], mf[1]);
    var line = [];
    if (this.state.best) line.push(this.t('best') + ': ' + R.num(this.state.best));
    if (M.ach && M.ach.fullMap) line.push('★ ' + this.t('achFull'));
    if (line.length) this.text(line.join('   '), Wc / 2 + 30, Hc - 48, { size: 11, align: 'center', color: rtr ? R.E.y : '#ffe08a', weight: 800, maxWidth: Wc - 140 });
    if (titleNote && titleNote.a > 0) { titleNote.a -= 1 / 60; this.text(titleNote.text, Wc / 2 + 30, Hc - 62, { size: 11, align: 'center', color: Pc.warn, weight: 800 }); }
    this.text(this.t('hint'), Wc / 2, Hc - 14, { size: rtr ? 9 : 10, align: 'center', color: rtr ? R.E.k : '#4a3f36', weight: 800, maxWidth: Wc - 20 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  function stickDir() { return { x: Math.abs(stick.x) > 0.3 ? Math.sign(stick.x) : 0, y: stick.y < -0.5 ? -1 : stick.y > 0.6 ? 1 : 0 }; }
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (!(d && d.resume) || (!game && mode !== 'map')) newRun();
      else if (mode === 'map') music(PS.MUSIC.camp);
      playSince = g.time;
    },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (mode === 'map') {
        if (a === 'left' || a === 'right') mapMove(a);
        else if ((a === 'action' || a === 'start') && g.time - playSince > 0.2) mapGo();
        return;
      }
      if (result && result.t > 0.8 && (a === 'action' || a === 'start')) finishResult();
    },
    update: function (dt) {
      var i;
      for (i = 0; i < ui.toasts.length; i++) ui.toasts[i].t -= dt;
      ui.toasts = ui.toasts.filter(function (q) { return q.t > 0; });
      if (ui.banner) { ui.banner.a -= dt; if (ui.banner.a <= 0) ui.banner = null; }
      if (ui.msg) { ui.msg.a -= dt; if (ui.msg.a <= 0) ui.msg = null; }
      if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt);
      if (ui.throwT > 0) ui.throwT = Math.max(0, ui.throwT - dt * 4);
      if (M.noteA > 0) { M.noteA -= dt; if (M.noteA <= 0) M.note = ''; }
      if (mode === 'map' || !game) return;
      var s = S(), dir = this.input.dir, live = g.time - playSince > 0.25 && s.phase === 'play';
      if (stick.active) dir = stickDir();
      var jump = live && (this.input.pressed('action') || extra.jump);
      ui.aimUp = dir.y < 0;
      game.setInput(live ? dir.x : 0, live && dir.y < 0, jump);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k2 = 0; k2 < n; k2++) game.update(STEP);
      s = S();
      var P = s.hero;
      ui.runPh += Math.abs(P.vx) * 0.12 * dt;
      var maxC = Math.max(0, s.LV.w * T - VW), tgt = Math.max(0, Math.min(maxC, P.x - VW / 2 + P.face * 40));
      if (cam < 0) cam = tgt; else cam += (tgt - cam) * Math.min(1, dt * 5);
      FX.step(dt);
      if (result) { result.t += dt; }
      sync();
    },
    draw: function (ctx) {
      if (mode === 'map' || !game) { PS.renderMap(g, ctx, M, prog); return; }
      ui.cam = cam + (ui.shake > 0 ? (Math.random() - 0.5) * 8 * ui.shake / 0.4 : 0);
      PS.renderLevel(g, ctx, S(), ui, prog);
    }
  });
  // участок снят: нажатие → межстраничная (если площадка готова её показать) → карта маршрута или финал
  function finishResult() {
    if (!result || going) return;
    var fin = result.finale; going = true;
    var next = function () { going = false; result = null; ui.banner = null; game = null; M.sel = fin ? 'obs' : PS.save.firstOpen(prog); toMap(); if (fin) finale(); };
    if (g.adReady()) g.adBreak().then(next); else next();
  }

  // ---------- тач-стик (площадки) ----------
  var stick = global.ArcadeStick.create(document.querySelector('.pad [data-stick]'), { onFlick: function (dx) { if (g._sceneName === 'play' && mode === 'map' && dx) mapMove(dx > 0 ? 'right' : 'left'); } });

  // ---------- доп. клавиши и тач ----------
  var JUMP = { KeyZ: 1, KeyK: 1 }, THROW = { KeyX: 1, KeyJ: 1, ControlLeft: 1, ControlRight: 1 };
  function inExp() { return g._sceneName === 'play' && game && mode === 'exp' && S().phase === 'play' && g.time - playSince > 0.25; }
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extra.jump = !!(held.KeyZ || held.KeyK); if (ip) e.preventDefault(); if (ip && mode === 'map' && !e.repeat) g.scenes.play.press.call(g, 'action'); return; }
    if (THROW[e.code]) { if (ip) e.preventDefault(); if (e.repeat) return; if (ip && mode === 'map') { g.scenes.play.press.call(g, 'action'); return; } if (ip && result) { g.scenes.play.press.call(g, 'action'); return; } if (inExp()) { syncUp(); game.throwStake(); } }
  });
  function syncUp() { var dir = stick.active ? stickDir() : g.input.dir; game.setInput(dir.x, dir.y < 0, !!extra.jump); }
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extra.jump = !!(held.KeyZ || held.KeyK); } });
  addEventListener('blur', function () { held = {}; extra.jump = false; });
  function tap(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { if (!Arcade.touchOk(e)) return; fn(); b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 120); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  tap('bThrow', function () { if (inExp()) { syncUp(); game.throwStake(); } else if (g._sceneName === 'play' && (mode === 'map' || result)) g.scenes.play.press.call(g, 'action'); });
  tap('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
  g.canvas.addEventListener('pointerdown', function (e) { if (g._sceneName === 'play' && result && result.t > 0.8) { e.preventDefault(); finishResult(); } });

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, pad = document.querySelector('.pad');
    var padFixed = pad && getComputedStyle(pad).position === 'fixed';
    var padH = pad && !padFixed && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth), vh = Math.min(innerHeight, (global.visualViewport && global.visualViewport.height) || innerHeight);
    var padOn = pad && getComputedStyle(pad).display !== 'none';
    var w = Math.min(1120, padFixed && padOn ? vw - 300 : ((wrap && wrap.clientWidth) || g.W), (vh - padH - (padH ? 64 : 40)) * g.W / g.H);   // «лёжа»: поля по бокам под стик и кнопки
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
    var se = document.scrollingElement || document.documentElement, over = se.scrollHeight - vh;   // страховка от прокрутки (площадки)
    if (over > 0 && w > 240) { w = Math.max(240, Math.floor(w - over * g.W / g.H) - 2); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px'; }
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      fit();
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  PS.app = { g: g, game: function () { return game; }, mode: function () { return mode; }, prog: function () { return prog; }, enterExp: enterExp, toMap: toMap, ui: ui, M: M, store: store, snapCam: function () { cam = -1; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
