/* ПОСОХ · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js, save.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован; в меню — «Новая игра» (с подтверждением),
   в паузе («привал») — «Отступить в лагерь» (−50% мешка, с подтверждением).
   Сцена play: режим 'camp' (лагерь, глобус: выбор экспедиции в любом порядке, обсерватория на полюсе) ↔ 'exp' (экспедиция).
   Ввод: ←→/AD — бег; Пробел/Z/K/↑ — прыжок; в прыжке ↓/S — посох-пружина; X/J/Ctrl — удар посохом;
   тач: дпад, ● прыжок, ⚒ удар, II привал. Прогресс — localStorage arcade.save.posokh (save.js). */
(function (global) {
  'use strict';
  var PS = global.POSOKH, L = PS.logic, R = PS.R, FX = R.FX, VW = R.VW, VH = R.VH, T = L.T;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#14121c', panel: '#1f1b2a', ink: '#f4f0e8', muted: '#b4aa9c', accent: '#e9a23b', good: '#8fd86a', bad: '#ff6b6b', warn: '#ffd34d', grid: '#2b2638' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'posokh', strings: PS.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  PS.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var ls = null; try { ls = global.localStorage; } catch (e) {}
  var store = PS.save.store(ls || { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} });
  var prog = store.load();

  var game = null, mode = 'camp', playSince = 0, cam = 0;
  var ui = { toasts: [], banner: null, msg: null, runPh: 0, shake: 0, squash: 0, fx: FX, cam: 0 };
  var M = { sel: prog.at, rot: 0, note: '', noteA: 0, ach: store.ach() };
  var held = {}, extra = { jump: false }, result = null, doorMsgT = 0;
  function S() { return game.state(); }
  function th() { return g.th(); }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  function sync() { if (mode === 'exp' && game) { var s = S(); g.state.score = s.bank + s.bag; g.state.lives = Math.max(0, s.lives); } else { g.state.score = prog.bank; g.state.lives = prog.lives; } }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < ui.toasts.length; i++) if (Math.abs(ui.toasts[i].y - y) < 10 && Math.abs(ui.toasts[i].x - x) < 60) y -= 12;
    var life = big ? 1.7 : 1.0; ui.toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big }); if (ui.toasts.length > 14) ui.toasts.shift();
  }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.8 }; }
  function banner(title, sub, dur, lines, color) { ui.banner = { title: title, sub: sub, a: dur || 2.4, dur: dur || 2.4, lines: lines, color: color }; }
  var curTrack = null;
  function music(tr) { if (curTrack === tr) return; curTrack = tr; g.setMusic(tr); g.audio.music.step = 0; }
  var E = R.E;

  function onEvent(type, d) {
    d = d || {};
    PS.sfx(g, type, d);
    var s = game ? S() : null, P = s && s.hero, t = th();
    switch (type) {
      case 'start': {
        ui.toasts = []; FX.clear(); ui.msg = null; music(PS.MUSIC.level);
        var LV = s.LV, lines = [];
        if (!prog.cleared.mine && !PS.save.keyCount(prog) && LV.id === 'mine') lines.push(g.t('intro'));
        if (s.doorOpen) lines.push(g.t('doorOpen').replace('{it}', g.t('it_' + LV.door)));
        banner(g.t('x_' + LV.id), g.t('xd_' + LV.id), 3, lines);
        break;
      }
      case 'gem': toast('+' + d.v, col(d.big ? '#e3b0ff' : '#ffe08a', d.big ? E.M : E.y), d.x, d.y - 8); FX.add(d.x, d.y, { n: d.big ? 10 : 5, sp: 70, life: 0.35, c: col('#ffffff', E.w), r: 1.6, g: 0 }); break;
      case 'pie': toast(g.t(d.big ? 'bigpie' : 'pie'), col('#ffcf7a', E.y), d.x, d.y - 10, true); break;
      case 'life': toast(g.t('life'), col('#ffd56a', E.y), d.x, d.y - 12, true); break;
      case 'item': toast(g.t('it_' + d.what), col('#ffd56a', E.y), d.x, d.y - 14, true); msg(g.t('it_' + d.what) + ' — ' + g.t('itd_' + d.what), t.warn, 3.2); FX.add(d.x, d.y, { n: 18, sp: 120, c: col('#ffe6a0', E.y), r: 2 }); break;
      case 'relic': toast(g.t('rl_' + d.what) + ' +' + R.money(d.v), col('#9fe8ff', E.C), d.x, d.y - 14, true); msg(g.t('relic') + ': ' + g.t('rl_' + d.what), t.good, 3); FX.add(d.x, d.y, { n: 26, sp: 140, c: col('#bff4ff', E.C), r: 2 }); break;
      case 'flag': toast(g.t('flag'), col('#ffb35c', E.y), d.x, d.y - 32); break;
      case 'bounce': ui.squash = 1; if (P) FX.add(P.x, P.y, { n: d.on === '^' ? 6 : 4, sp: 60, life: 0.25, c: col(d.on === '^' ? '#ffffff' : '#d8d0c0', E.w), r: 1.6, a: -Math.PI / 2, spread: 2.2, g: 120 }); break;
      case 'kill': toast('+' + d.v, col('#ffe08a', E.y), d.x, d.y - 8); FX.add(d.x, d.y, { n: 12, sp: 110, c: col('#fff0d0', E.w), r: 2 }); break;
      case 'crack': FX.add(d.x, d.y, { n: 12, sp: 90, life: 0.6, c: col('#a89080', E.l), r: 2.2, g: 400 }); toast(g.t('crack'), col('#ffd56a', E.y), d.x, d.y - 10); break;
      case 'chest': FX.add(d.x, d.y, { n: 16, sp: 120, c: col('#ffd56a', E.y), r: 2 }); break;
      case 'whack': FX.add(d.x, d.y - 6, { n: 6, sp: 80, life: 0.3, c: col('#ffffff', E.w), r: 1.6 }); break;
      case 'hurt': ui.shake = 0.25; FX.add(d.x, d.y - 12, { n: 10, sp: 110, c: col('#ff8a8a', E.R), r: 2 }); break;
      case 'die': ui.shake = 0.4; FX.add(d.x, d.y - 12, { n: 22, sp: 140, c: col('#f4f0e8', E.w), r: 2.4 }); msg(g.t('d_' + d.why, ''), t.bad, 1.6); break;
      case 'respawn': ui.toasts = []; if (curTrack === PS.MUSIC.boss) music(PS.MUSIC.level); break;
      case 'thud': ui.shake = Math.max(ui.shake, 0.15); break;
      case 'guardWake': banner(g.t('g_' + s.LV.guard), '', 1.8); break;
      case 'guardDown': ui.shake = 0.4; toast('+' + d.v, col('#ffe08a', E.y), d.x, d.y - 20, true); msg(g.t('gate'), t.good, 2); FX.add(d.x, d.y, { n: 30, sp: 160, c: col('#ffffff', E.w), r: 2.2 }); break;
      case 'bossWake': music(PS.MUSIC.boss); banner(g.t('b_' + d.k), g.t('bd_' + d.k), 3); break;
      case 'guardHit': case 'bossHit': FX.add(d.x, d.y, { n: 12, sp: 130, c: col('#ffe36a', E.y), r: 2 }); break;
      case 'bossDown': ui.shake = 0.6; music(PS.MUSIC.level); FX.add(d.x, d.y, { n: 40, sp: 200, c: col('#ffffff', E.w), r: 2.6, life: 0.9 }); toast('+' + R.money(d.v), col('#ffe08a', E.y), d.x, d.y - 30, true); break;
      case 'key': FX.add(d.x, d.y, { n: 30, sp: 150, c: col('#ffe6a0', E.y), r: 2.4, life: 0.9 }); break;
      case 'clear': onClear(d); break;
      case 'gameover':
        sync(); store.wipe();
        setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') { var s2 = S(); g.state.score = s2.bank + s2.bag; prog = store.load(); g.gameover(); } }, 1500);
        break;
    }
    sync();
  }
  function onClear(d) {
    var had = PS.save.keyCount(prog);
    PS.save.apply(prog, d); store.save(prog);
    var lines = [g.t('bag') + ': +' + R.money(d.bag) + ' → ' + g.t('bank') + ' ' + R.money(prog.bank)];
    if (d.item) lines.push(g.t('it_' + d.item) + ' — ' + g.t('itd_' + d.item));
    if (d.relic) lines.push(g.t('relic') + ': ' + g.t('rl_' + d.relic));
    if (PS.save.allKeys(prog) && had < PS.levels.ids.length) lines.push(g.t('xd_obs') + ' → ↑ ' + g.t('x_obs'));
    lines.push(g.t('tapMap'));
    banner(g.t('clear'), g.t('x_' + d.id) + ' · ' + PS.save.keyCount(prog) + '/5', 99, lines, th().good);
    result = { t: 0 };
  }

  // ---------- лагерь / экспедиция ----------
  function newRun() {
    prog = store.load(); M.sel = prog.at; M.rot = targetRot(); M.ach = store.ach();
    game = null; result = null; toCamp();
  }
  function targetRot() { return M.sel === 'obs' ? M.rot : R.LON[M.sel]; }
  function toCamp() {
    mode = 'camp'; result = null; ui.banner = null; ui.msg = null; ui.toasts = []; FX.clear();
    if (M.sel !== 'obs' && PS.levels.ids.indexOf(M.sel) < 0) M.sel = 'mine';
    music(PS.MUSIC.camp); sync();
  }
  function enterExp(id) {
    mode = 'exp'; prog.at = id; store.save(prog);
    game = PS.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1) });
    game.start(id, { items: prog.items, taken: prog.taken[id] || [], lives: prog.lives, bank: prog.bank });
    PS.current = game; cam = -1; playSince = g.time; ui.runPh = 0;
    sync();
  }
  function campMove(a) {
    var ids = PS.levels.ids;
    if (a === 'up') { M.sel = 'obs'; g.audio.beep(660, 0.03); return; }
    if (M.sel === 'obs') { if (a === 'down' || a === 'left' || a === 'right') { M.sel = prog.at && ids.indexOf(prog.at) >= 0 ? prog.at : 'mine'; g.audio.beep(520, 0.03); } return; }
    if (a !== 'left' && a !== 'right') return;
    var i = ids.indexOf(M.sel), n = ids.length; M.sel = ids[(i + (a === 'right' ? 1 : n - 1)) % n]; g.audio.beep(520, 0.03);
  }
  function campGo() {
    if (M.sel === 'obs') {
      if (!PS.save.allKeys(prog)) { M.note = g.t('locked'); M.noteA = 1.6; g.audio.beep(180, 0.06); return; }
      finale(); return;
    }
    enterExp(M.sel);
  }
  var ending = null;
  function finale() {
    var tru = PS.save.trueEnd(prog), a = store.ach();
    a.ends = (a.ends | 0) + 1; if (tru) a.trueEnd = 1; store.setAch(a); M.ach = a;
    ending = { tru: tru, bank: prog.bank };
    g.state.score = prog.bank; store.wipe(); prog = store.load();
    g.win();
  }
  function retreat() {
    if (!game || mode !== 'exp') return;
    var r = game.retreat(); if (!r) return;
    PS.save.apply(prog, r); store.save(prog);
    toCamp(); M.sel = r.id;
    M.note = g.t('retreated') + ' · ' + g.t('lost') + ' ' + R.money(r.lost); M.noteA = 3;
  }

  // ---------- стандартные экраны и меню ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  var newArm = 0, titleNote = null, retreatArm = 0;
  g.menu.addItem({ key: 'newgame', after: 'play', label: function () { return newArm > g.time ? g.t('newQ') : g.t('newGame'); },
    onSelect: function () { if (!store.has()) { this.state.score = 0; this.goto('play'); return; } if (newArm > g.time) { store.wipe(); prog = store.load(); newArm = 0; titleNote = { text: g.t('newDone'), a: 2 }; } else newArm = g.time + 3; } });
  var retreatItem = { key: 'retreat', scene: 'pause', before: 'menu', label: function () { return retreatArm > g.time ? g.t('retreatQ') : g.t('retreat'); },
    onSelect: function () {
      if (mode !== 'exp' || !game || S().phase !== 'play') { g.goto('play', { resume: true }); return; }
      if (retreatArm > g.time) { retreatArm = 0; retreat(); g.goto('play', { resume: true }); } else retreatArm = g.time + 3;
    } };
  // «Отступить» есть в меню привала только в экспедиции
  g.scenes.pause.enter = function () { retreatArm = 0; if (mode === 'exp' && game && S().phase === 'play') g.menu.addItem(retreatItem); else g.menu.removeItem('retreat', 'pause'); };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // финалы: своя картинка поверх стандартной
  g.scenes.win.draw = function (ctx) {
    var rtr = retro(), t = this.time, Pc = th();
    R.background(ctx, 'tower', t * 10, rtr, t);
    ctx.fillStyle = rtr ? 'rgba(0,0,0,.6)' : 'rgba(10,8,20,.6)'; ctx.fillRect(0, 0, VW, VH);
    this.text(this.t('win'), VW / 2, 50, { size: 24, align: 'center', color: Pc.good, weight: 900 });
    this.text(this.t('ending'), VW / 2, 74, { size: 11, align: 'center', color: Pc.ink, weight: 700 });
    var tru = ending && ending.tru;
    this.text(tru ? this.t('endingTrue') : this.t('endingPart'), VW / 2, 92, { size: 11, align: 'center', color: tru ? Pc.warn : Pc.muted, weight: 800 });
    if (tru) this.text('★ ' + this.t('achTrue'), VW / 2, 108, { size: 11, align: 'center', color: Pc.warn, weight: 800 });
    ctx.save(); ctx.translate(VW / 2, 200); ctx.scale(2.5, 2.5);
    var b = Math.abs(Math.sin(t * 3)) * 12;
    R.hero(ctx, 0, -b, { face: 1, pogo: true, squash: b < 2 ? 1 : 0 }, rtr, t);
    ctx.restore();
    if (tru) { R.itemIcon(ctx, VW / 2 - 70, 170, 'lens', rtr, 2); R.itemIcon(ctx, VW / 2 + 70, 170, 'astro', rtr, 2); }
    this.text(this.t('score') + ': ' + R.money(this.state.score) + (this.state.best ? '   ' + this.t('best') + ': ' + R.money(this.state.best) : ''), VW / 2, 236, { size: 14, align: 'center', color: Pc.accent, weight: 800 });
    this.text(this.t('tapstart'), VW / 2, VH - 16, { size: 11, align: 'center', color: Pc.muted, weight: 700 });
  };
  var goDraw = g.scenes.gameover.draw;
  g.scenes.gameover.draw = function (ctx) {
    goDraw.call(this, ctx);
    ctx.save(); ctx.translate(VW / 2 - 6, VH / 2 + 74); ctx.scale(2, 2); R.hero(ctx, 0, 0, { face: 1 }, retro(), this.time); ctx.restore();
  };

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
    var tt = this.t('title');
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = rtr ? 'bold 48px "Courier New", monospace' : '900 54px Inter, system-ui, sans-serif';
    if (rtr) { ctx.fillStyle = R.E.n; ctx.fillText(tt, Wc / 2 + 3, 63); ctx.fillStyle = R.E.y; ctx.fillText(tt, Wc / 2, 60); }
    else {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(tt, Wc / 2 + 2, 64);
      var lg = ctx.createLinearGradient(0, 18, 0, 62); lg.addColorStop(0, '#fff2c8'); lg.addColorStop(0.5, '#e9a23b'); lg.addColorStop(1, '#9a5a22'); ctx.fillStyle = lg; ctx.fillText(tt, Wc / 2, 61);
    }
    ctx.restore();
    this.text(this.t('subtitle'), Wc / 2, 84, { size: rtr ? 10 : 12, align: 'center', color: Pc.ink, weight: 700 });
    // бабушка прыгает на посохе
    var ph = (t * 1.6) % 1, b = Math.sin(ph * Math.PI) * 42;
    ctx.save(); ctx.translate(92, Hc - 40 - b); ctx.scale(2.4, 2.4);
    R.hero(ctx, 0, 0, { face: 1, pogo: true, squash: ph < 0.08 || ph > 0.92 ? 1 : 0 }, rtr, t);
    ctx.restore();
    R.gem(ctx, 420, Hc - 70, true, 0, rtr, t); R.gem(ctx, 446, Hc - 58, false, 1, rtr, t); R.itemIcon(ctx, 432, Hc - 98, 'key', rtr, 1.6);
    menu.draw(this, Wc / 2 + 30, 116, 24);
    var line = [];
    if (this.state.best) line.push(this.t('best') + ': ' + R.money(this.state.best));
    if (M.ach && M.ach.trueEnd) line.push('★ ' + this.t('achTrue'));
    if (line.length) this.text(line.join('   '), Wc / 2 + 30, Hc - 52, { size: 11, align: 'center', color: rtr ? R.E.y : '#ffe08a', weight: 800 });
    if (titleNote && titleNote.a > 0) { titleNote.a -= 1 / 60; this.text(titleNote.text, Wc / 2 + 30, Hc - 66, { size: 11, align: 'center', color: Pc.warn, weight: 800 }); }
    this.text(this.t('hint'), Wc / 2, Hc - 14, { size: rtr ? 9 : 10, align: 'center', color: rtr ? R.E.k : '#4a3f36', weight: 800 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (!(d && d.resume) || (!game && mode !== 'camp')) newRun();
      else if (mode === 'camp') music(PS.MUSIC.camp);
      playSince = g.time;
    },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (mode === 'camp') {
        if (a === 'left' || a === 'right' || a === 'up' || a === 'down') campMove(a);
        else if ((a === 'action' || a === 'start') && g.time - playSince > 0.2) campGo();
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
      if (ui.squash > 0) ui.squash = Math.max(0, ui.squash - dt * 6);
      if (mode === 'camp') {
        var tr = targetRot(), dd = ((tr - M.rot + 540) % 360) - 180; M.rot += dd * Math.min(1, dt * 6);
        if (M.noteA > 0) { M.noteA -= dt; if (M.noteA <= 0) M.note = ''; }
        return;
      }
      if (!game) return;
      var s = S(), dir = this.input.dir, live = g.time - playSince > 0.25 && s.phase === 'play';
      var jump = live && (this.input.pressed('action') || this.input.pressed('up') || extra.jump);
      game.setInput(live ? dir.x : 0, live && dir.y > 0, jump);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k2 = 0; k2 < n; k2++) game.update(STEP);
      s = S();
      var P = s.hero;
      ui.runPh += Math.abs(P.vx) * 0.12 * dt;
      // дверь без предмета — подсказка
      if (doorMsgT > 0) doorMsgT -= dt;
      if (P.wall && doorMsgT <= 0 && s.LV.door) {
        var fx = Math.floor((P.x + P.wall * (L.K.HW + 2)) / T), ty = Math.floor((P.y - 4) / T);
        if (L.tileAt(s.W, fx, ty) === 'D') { doorMsgT = 2.5; msg(g.t('door').replace('{it}', g.t('it_' + s.LV.door)) + ' (' + g.t('x_' + PS.levels.LINKS.filter(function (l) { return l.item === s.LV.door; })[0].from) + ')', th().warn, 2.4); PS.sfx(g, 'door'); }
      }
      // камера
      var maxC = Math.max(0, s.LV.w * T - VW), tgt = Math.max(0, Math.min(maxC, P.x - VW / 2 + P.face * 40));
      if (cam < 0) cam = tgt; else cam += (tgt - cam) * Math.min(1, dt * 5);
      FX.step(dt);
      if (result) { result.t += dt; }
      sync();
    },
    draw: function (ctx) {
      if (mode === 'camp' || !game) { PS.renderCamp(g, ctx, M, prog); return; }
      ui.cam = cam + (ui.shake > 0 ? (Math.random() - 0.5) * 8 * ui.shake / 0.4 : 0);
      PS.renderLevel(g, ctx, S(), ui, prog);
    }
  });
  function finishResult() {
    if (!result) return;
    result = null; ui.banner = null;
    M.sel = PS.save.allKeys(prog) ? 'obs' : prog.at;
    toCamp();
  }

  // ---------- доп. клавиши и тач ----------
  var JUMP = { KeyZ: 1, KeyK: 1 }, SWING = { KeyX: 1, KeyJ: 1, ControlLeft: 1, ControlRight: 1 };
  function inExp() { return g._sceneName === 'play' && game && mode === 'exp' && S().phase === 'play' && g.time - playSince > 0.25; }
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extra.jump = !!(held.KeyZ || held.KeyK); if (ip) e.preventDefault(); if (ip && mode === 'camp' && !e.repeat) g.scenes.play.press.call(g, 'action'); return; }
    if (SWING[e.code]) { if (ip) e.preventDefault(); if (e.repeat || !inExp()) return; game.swing(); }
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extra.jump = !!(held.KeyZ || held.KeyK); } });
  addEventListener('blur', function () { held = {}; extra.jump = false; });
  function tap(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { e.preventDefault(); fn(); b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 120); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  tap('bSwing', function () { if (inExp()) game.swing(); });
  tap('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

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
  PS.app = { g: g, game: function () { return game; }, mode: function () { return mode; }, prog: function () { return prog; }, enterExp: enterExp, toCamp: toCamp, ui: ui, M: M, store: store, snapCam: function () { cam = -1; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
