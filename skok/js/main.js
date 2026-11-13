/* СКОК · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js, save.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован; в меню — «Сбросить карту»; в паузе — «На карту».
   Сцена play: режимы 'map' (карта Заплатных земель) ↔ 'level' (уровень) ↔ 'shop' (лавка-лотерея) ↔ 'lever' (угадай рычаг).
   Ввод: ←→/AD — бег; Пробел/Z/K — прыжок; X/J — огненные заклёпки; ↓/S — подкат на склоне / удар панцирем; ↑/W — тайная дверь;
   тач: дпад, ● прыжок, ✦ заклёпки, II пауза. Прогресс — localStorage arcade.save.skok (save.js). */
(function (global) {
  'use strict';
  var SK = global.SKOK, L = SK.logic, R = SK.R, FX = R.FX, VW = R.VW, VH = R.VH, T = L.T, MAP = SK.MAP;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#1c1210', panel: '#2a1c18', ink: '#fff4e6', muted: '#c9b49c', accent: '#ff9a4a', good: '#8fe08a', bad: '#ff6b5b', warn: '#ffd34d', grid: '#3a2a22' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'skok', strings: SK.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  SK.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var ls = null; try { ls = global.localStorage; } catch (e) {}
  var store = SK.save.store(ls || { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} });
  var prog = store.load();
  var rng = L.mulberry32((Date.now() & 0xffff) + 7);

  var game = null, mode = 'map', playSince = 0, cam = 0, G = null, pendingAmbush = null;
  var ui = { toasts: [], banner: null, msg: null, runPh: 0, shake: 0 };
  var M = { prog: prog, sel: prog.at, pos: { x: 0, y: 0 }, moving: null, fresh: {}, note: '', noteA: 0, face: 1, lives: prog.lives, nuts: prog.nuts, suit: prog.suit, region: 1 };
  var held = {}, extra = { jump: false }, result = null;
  function S() { return game.state(); }
  function th() { return g.th(); }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  function carry() { return { lives: prog.lives, nuts: prog.nuts, score: prog.score, suit: prog.suit, suitHp: prog.suitHp }; }
  function syncMap() { M.lives = prog.lives; M.nuts = prog.nuts; M.suit = prog.suit; g.state.score = prog.score; g.state.lives = prog.lives; }
  function syncLevel() { if (!game || mode !== 'level') return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < ui.toasts.length; i++) if (Math.abs(ui.toasts[i].y - y) < 10 && Math.abs(ui.toasts[i].x - x) < 50) y -= 12;
    var life = big ? 1.6 : 0.9; ui.toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big }); if (ui.toasts.length > 14) ui.toasts.shift();
  }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.8 }; }
  function banner(title, sub, dur, lines, color) { ui.banner = { title: title, sub: sub, a: dur || 2.4, lines: lines, color: color, hiLast: true }; }
  var curTrack = null;
  function music(tr) { if (curTrack === tr) return; curTrack = tr; g.setMusic(tr); g.audio.music.step = 0; }

  // ---------- события логики ----------
  function onEvent(type, d) {
    d = d || {};
    SK.sfx(g, type, d);
    var s = game ? S() : null, P = s && s.hero, E = R.E, t = th();
    switch (type) {
      case 'level': {
        ui.toasts = []; FX.clear(); ui.msg = null;
        var LV = s.LV;
        music(LV.fort ? SK.MUSIC.fort : SK.MUSIC.level);
        if (d.respawn) break;
        if (LV.ambush) banner(g.t('n_' + LV.id), g.t('wanderMeet'), 2.4, null, t.warn);
        else if (LV.fort) banner(g.t('n_' + LV.id), g.t('b_' + LV.boss) + ' · ' + g.t('bd'), 3);
        else banner(g.t('n_' + LV.id), g.t('r' + LV.r) + ' · ' + LV.r + '-' + LV.n, 2.4, LV.id === '1-1' ? [g.t('intro')] : null);
        break;
      }
      case 'nut': FX.add(d.x, d.y, { n: 5, sp: 60, life: 0.3, c: col('#e8ecf2', E.w), r: 1.5, g: 0 }); break;
      case 'crate': if (d.k === 'nut') { toast('+1', col('#e8ecf2', E.w), d.x, d.y - 6); FX.add(d.x, d.y - 4, { n: 6, sp: 70, life: 0.35, c: col('#d7b27a', E.y), r: 1.6, a: -Math.PI / 2, spread: 1.6 }); } else FX.add(d.x, d.y - 4, { n: 12, sp: 90, life: 0.5, c: col('#ffd27a', E.y), r: 2, a: -Math.PI / 2, spread: 2 }); break;
      case 'suit': toast(g.t('s_' + d.suit), col('#ffd27a', E.y), d.x, d.y - 16, true); msg(g.t('sd_' + d.suit), t.accent, 3); FX.add(d.x, d.y - 8, { n: 18, sp: 110, c: col('#ffd27a', E.y), r: 2 }); break;
      case 'unsuit': msg(g.t('lost'), t.bad, 1.4); break;
      case 'life': toast(g.t('life'), col('#ff8a9a', E.R), d.x, d.y - 12, true); break;
      case 'key': toast(g.t('key'), col('#ffe08a', E.y), d.x, d.y - 12, true); msg(g.t('keyHint'), t.warn, 3); break;
      case 'door': FX.add(d.x, d.y - 16, { n: 24, sp: 120, c: col('#7fe0d0', E.C), r: 2.2 }); break;
      case 'camp': toast(g.t('camp'), col('#ffd27a', E.y), d.x, d.y - 32); break;
      case 'kill': toast('+' + d.pts, col('#fff4e6', E.w), d.x, d.y - 8); if (d.how !== 'stomp') FX.add(d.x, d.y, { n: 10, sp: 100, c: col('#ffb35c', E.y), r: 2 }); break;
      case 'stomp': FX.add(d.x, d.y, { n: 8, sp: 90, life: 0.3, c: col('#ffffff', E.w), r: 2, a: -Math.PI / 2, spread: 2.4 }); break;
      case 'break': FX.add(d.x, d.y, { n: 10, sp: 110, life: 0.6, c: col('#d7b27a', E.y), r: 2, g: 500 }); break;
      case 'quake': ui.shake = 0.3; FX.add(d.x, d.y, { n: 14, sp: 120, life: 0.4, c: col('#c9cdd4', E.l), r: 2, a: -Math.PI / 2, spread: 3 }); break;
      case 'slide': if (P) FX.add(P.x, P.y, { n: 6, sp: 60, life: 0.35, c: col('#ffffff', E.w), r: 1.8, a: Math.PI / 2, spread: 2, g: 60 }); break;
      case 'land': if (d.v > 380 && P) FX.add(P.x, P.y, { n: 4, sp: 40, life: 0.3, c: col('#e8d7c0', E.l), r: 1.5, a: -Math.PI / 2, spread: 2.6, g: 120 }); break;
      case 'fizz': FX.add(d.x, d.y, { n: 5, sp: 50, life: 0.3, c: col('#ffb35c', E.y), r: 1.5 }); break;
      case 'hurt': ui.shake = 0.25; FX.add(d.x, d.y - 10, { n: 10, sp: 110, c: col('#ff8a8a', E.R), r: 2 }); break;
      case 'die':
        ui.shake = 0.4; msg(g.t('d_' + d.why, ''), t.bad, 1.6);
        prog.lives = Math.max(0, s.lives); prog.nuts = s.nuts; prog.suit = null; prog.suitHp = 1; prog.score = s.score; if (prog.lives > 0) store.save(prog);
        break;
      case 'thud': if (d.big) ui.shake = Math.max(ui.shake, 0.25); break;
      case 'bossIntro': banner(g.t('b_' + d.k), g.t('bd'), 2.2, null, t.bad); break;
      case 'bossHit': FX.add(d.x, d.y, { n: 12, sp: 130, c: col('#ffe36a', E.y), r: 2 }); ui.shake = 0.2; break;
      case 'bossDown': ui.shake = 0.6; FX.add(d.x, d.y, { n: 40, sp: 200, c: col('#ffd27a', E.y), r: 2.6, life: 0.9 }); toast('+' + L.PTS.boss, col('#ffe08a', E.y), d.x, d.y - 30, true); break;
      case 'bell': toast('+' + d.pts, col('#ffe08a', E.y), d.x + 12, d.y - 10, true); if (d.hit) FX.add(d.x, d.y, { n: 16 + d.tier * 4, sp: 120, c: col('#ffd27a', E.y), r: 2 }); break;
      case 'clear': onClear(d); break;
      case 'gameover':
        prog.lives = SK.save.LIVES; prog.nuts = 0; prog.suit = null; prog.suitHp = 1; prog.score = 0; store.save(prog);
        g.state.score = d.score;
        setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') { g.state.score = d.score; g.gameover(); } }, 1500);
        break;
    }
    syncLevel();
  }
  function onClear(d) {
    var s = S(), LV = s.LV, c = game.carry();
    var before = {}; MAP.NODES.forEach(function (n) { before[n.id] = MAP.isOpen(prog, n.id); });
    SK.save.apply(prog, d.id, d);
    prog.lives = c.lives; prog.nuts = c.nuts; prog.suit = c.suit; prog.suitHp = c.suitHp; prog.score = c.score;
    if (!LV.ambush) prog.at = d.id;
    M.fresh = {}; MAP.NODES.forEach(function (n) { if (!before[n.id] && MAP.isOpen(prog, n.id)) M.fresh[n.id] = 1; });
    // бродяга края делает шаг
    if (!LV.ambush) { var wr = L.wanderStep(MAP, prog, LV.r, rng, prog.at); if (wr === 'meet') pendingAmbush = LV.r; }
    store.save(prog); g.state.score = prog.score; g.saveBest();
    var lines, title;
    if (LV.ambush) { title = g.t('clearAmb'); lines = ['+' + L.PTS.ambush + ' · +15 ' + g.t('nuts'), g.t('tapMap')]; }
    else if (LV.fort) { title = g.t('clearBoss'); lines = [g.t('part') + ' ' + LV.r + '/4 · +' + L.PTS.boss, g.t('tapMap')]; }
    else if (d.secret) { title = g.t('door'); lines = [g.t('doorHint'), g.t('tapMap')]; }
    else { title = g.t('clear'); lines = [g.t('bell') + ' +' + d.pts + (d.tier >= 5 ? ' · ' + g.t('bellTop') : ''), g.t('tapMap')]; }
    banner(title, g.t('n_' + d.id), 99, lines, th().good);
    result = { id: d.id, t: 0, final: d.id === MAP.FINAL };
  }

  // ---------- забег / карта / уровень ----------
  function newRun() {
    if (prog.lives <= 0) prog.lives = SK.save.LIVES;
    game = SK.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1) });
    SK.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear(); result = null; pendingAmbush = null;
    toMap(prog.at);
  }
  function toMap(at) {
    mode = 'map'; result = null; ui.banner = null; ui.msg = null; G = null;
    if (!MAP.isOpen(prog, at)) at = MAP.FIRST;
    M.sel = at; var n = MAP.node(at); M.pos = { x: n.x, y: n.y }; M.region = n.r; M.moving = null; M.note = '';
    syncMap(); music(SK.MUSIC.map);
    if (pendingAmbush) { var r = pendingAmbush; pendingAmbush = null; M.note = g.t('wanderMeet'); M.noteA = 1.4; setTimeout(function () { if (mode === 'map' && g._sceneName === 'play') enterLevel(r + '-A'); }, 900); }
  }
  function enterLevel(id) {
    mode = 'level'; G = null;
    if (!/-A$/.test(id)) { prog.at = id; store.save(prog); }
    game.startLevel(id, carry()); cam = -1; playSince = g.time; ui.runPh = 0;
    syncLevel();
  }
  function enterNode(id) {
    var n = MAP.node(id);
    if (n.kind === 'level' || n.kind === 'fort') { enterLevel(id); return; }
    prog.at = id; store.save(prog);
    if (prog.played[id]) { M.note = g.t(n.kind === 'shop' ? 'shopDone' : 'leverDone'); M.noteA = 1.6; SK.sfx(g, 'map', { ok: false }); return; }
    mode = n.kind; playSince = g.time; music(SK.MUSIC.game);
    if (n.kind === 'shop') G = { id: id, boxes: SK.mini.shop(rng), sel: 1, opened: null, msg: '', t: 0, suit: prog.suit };
    else { G = SK.mini.lever(rng); G.id = id; G.sel = 0; G.msg = ''; G.t = 0; G.openT = 0; }
  }
  function wanderAt(id) { var n = MAP.node(id), w = prog.wand[n.r]; return w && !w.dead && w.at === id && MAP.isOpen(prog, id); }
  function mapMove(a) {
    if (M.moving) return;
    var dv = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[a]; if (!dv) return;
    var cur = MAP.node(M.sel), best = null, bs = 0.3;
    MAP.neighbors(prog, M.sel).forEach(function (id) {
      var n = MAP.node(id), dx = n.gx - cur.gx, dy = n.y - cur.y, l = Math.sqrt(dx * dx + dy * dy) || 1, sc = (dx * dv[0] + dy * dv[1]) / l;
      if (sc > bs) { bs = sc; best = id; }
    });
    if (best) {
      var to = MAP.node(best), from = { x: cur.x, y: cur.y };
      if (to.r !== cur.r) { from = { x: to.r > cur.r ? -20 : VW + 20, y: to.y }; M.region = to.r; }
      M.moving = { from: from, to: to, t: 0, d: Math.hypot(to.x - from.x, to.y - from.y) }; M.face = to.x >= from.x ? 1 : -1; M.sel = best; M.note = '';
      SK.sfx(g, 'map', { ok: true });
    } else { M.note = g.t('locked'); M.noteA = 1.2; SK.sfx(g, 'map', { ok: false }); }
  }
  function arrive() {
    prog.at = M.sel; store.save(prog);
    if (wanderAt(M.sel)) { var r = MAP.node(M.sel).r; M.note = g.t('wanderMeet'); M.noteA = 1.4; setTimeout(function () { if (mode === 'map' && g._sceneName === 'play' && M.sel === prog.at) enterLevel(r + '-A'); }, 700); }
  }

  // ---------- мини-игры ----------
  function miniPress(a) {
    if (!G || g.time - playSince < 0.25) return;
    var t = th();
    if (mode === 'shop') {
      if (G.opened != null) { if (G.t > 0.6 && (a === 'action' || a === 'start')) toMap(G.id); return; }
      if (a === 'left') { G.sel = (G.sel + 2) % 3; SK.sfx(g, 'pick'); }
      else if (a === 'right') { G.sel = (G.sel + 1) % 3; SK.sfx(g, 'pick'); }
      else if (a === 'action' || a === 'start') {
        G.opened = G.sel; G.t = 0; var pr = G.boxes[G.sel], c = carry();
        SK.mini.apply(c, pr); prog.lives = c.lives; prog.nuts = c.nuts; prog.suit = c.suit; prog.suitHp = c.suitHp; prog.played[G.id] = 1; store.save(prog); syncMap(); G.suit = prog.suit;
        G.msg = g.t('got') + ': ' + (pr.k === 'suit' ? g.t('s_' + pr.suit) : g.t('prize_' + pr.k)) + ' · ' + g.t('anyKey');
        SK.sfx(g, 'win'); setTimeout(function () { if (G && mode === 'shop') G.reveal = true; }, 600);
      }
      return;
    }
    if (mode === 'lever') {
      if (G.done) { if (G.t > 0.6 && (a === 'action' || a === 'start')) toMap(G.id); return; }
      if (a === 'left') { G.sel = (G.sel + G.n - 1) % G.n; SK.sfx(g, 'pick'); }
      else if (a === 'right') { G.sel = (G.sel + 1) % G.n; SK.sfx(g, 'pick'); }
      else if (a === 'action' || a === 'start') {
        var r = SK.mini.pull(G, G.sel); if (!r) return;
        SK.sfx(g, 'lever');
        if (r === 'win') { var c2 = carry(); SK.mini.apply(c2, { k: 'life' }); SK.mini.apply(c2, { k: 'nuts', n: 20 }); prog.lives = c2.lives; prog.nuts = c2.nuts; G.msg = g.t('leverWin'); setTimeout(function () { SK.sfx(g, 'win'); }, 150); }
        else if (r === 'miss') G.msg = g.t('leverMiss');
        else { G.msg = g.t('leverLose'); setTimeout(function () { SK.sfx(g, 'lose'); }, 150); }
        if (r !== 'miss') { G.done = true; G.t = 0; prog.played[G.id] = 1; G.msg += ' · ' + g.t('leverDone'); M.fresh = {}; MAP.NODES.forEach(function (n) { if (n.id === n.r + '-F' && MAP.isOpen(prog, n.id) && !prog.cleared[n.id]) M.fresh[n.id] = 1; }); }
        store.save(prog); syncMap();
      }
    }
  }

  // ---------- стандартные экраны и меню ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  var resetArm = 0, titleNote = null;
  g.menu.addItem({ key: 'reset', after: 'play', label: function () { return resetArm > g.time ? g.t('resetQ') : g.t('reset'); },
    onSelect: function () { if (resetArm > g.time) { prog = store.reset(); M.prog = prog; M.fresh = {}; resetArm = 0; game = null; titleNote = { text: g.t('resetDone'), a: 2 }; } else resetArm = g.time + 3; } });
  g.menu.addItem({ key: 'tomap', scene: 'pause', before: 'menu', label: function () { return g.t('toMap'); },
    onSelect: function () { if (game && mode !== 'map') { if (mode === 'level') { var s = S(); if (s.phase === 'play') { prog.lives = s.lives; prog.nuts = s.nuts; prog.score = s.score; } s.phase = 'idle'; } toMap(prog.at); } g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      ctx.save(); ctx.translate(this.W / 2, this.H / 2 - 50); ctx.scale(2, 2);
      R.hero(ctx, 0, 0, { face: 1, run: name === 'win' ? this.time * 8 : 0, air: name === 'win' && Math.sin(this.time * 4) > 0.5 }, retro(), this.time);
      ctx.restore();
      var st = SK.save.stats(prog);
      this.text('✓ ' + st.cleared + '/' + st.total + ' · ' + g.t('parts') + ' ' + ['1-F', '2-F', '3-F', '4-F'].filter(function (id) { return prog.cleared[id]; }).length + '/4', this.W / 2, this.H / 2 + 44, { size: 12, align: 'center', color: th().muted, weight: 700 });
    };
  });
  g.scenes.win.enter = (function (base) { return function () { if (base) base.call(this); }; })(g.scenes.win.enter);

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var rtr = retro(), Wc = this.W, Hc = this.H, t = this.time, Pc = th();
    ctx.imageSmoothingEnabled = !rtr;
    R.background(ctx, 1, t * 18, rtr, t);
    var P = R.REG[1][rtr ? 'r' : 'm'];
    for (var i = 0; i < 17; i++) { var X = i * 32; ctx.fillStyle = P.g[i % 4]; ctx.fillRect(X, Hc - 44, 32, 44); ctx.fillStyle = P.top; ctx.fillRect(X, Hc - 44, 32, 5); }
    if (!rtr) { ctx.fillStyle = 'rgba(20,10,8,.35)'; ctx.fillRect(0, 0, Wc, Hc - 44); }
    // логотип: буквы на шестерне
    var tt = this.t('title');
    R.cog(ctx, Wc / 2, 46, 34, 12, rtr ? R.E.n : 'rgba(255,190,110,.22)', t * 0.4, rtr ? 0 : 16);
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = rtr ? 'bold 46px "Courier New", monospace' : '900 54px Inter, system-ui, sans-serif';
    if (rtr) { ctx.fillStyle = R.E.r; ctx.fillText(tt, Wc / 2 + 3, 65); ctx.fillStyle = R.E.y; ctx.fillText(tt, Wc / 2, 62); }
    else { ctx.fillStyle = 'rgba(40,10,0,.55)'; ctx.fillText(tt, Wc / 2 + 2, 66); var lg = ctx.createLinearGradient(0, 22, 0, 64); lg.addColorStop(0, '#fff4e0'); lg.addColorStop(0.5, '#ffb066'); lg.addColorStop(1, '#d9662a'); ctx.fillStyle = lg; ctx.fillText(tt, Wc / 2, 63); }
    ctx.restore();
    this.text(this.t('subtitle'), Wc / 2, 88, { size: rtr ? 10 : 11, align: 'center', color: Pc.ink, weight: 700 });
    // Скок прыгает по ящикам
    var ph = (t * 1.3) % 2, jy = ph < 1 ? -Math.sin(ph * Math.PI) * 30 : 0;
    R.crateTile(ctx, 64, Hc - 92, 'B', rtr);
    ctx.save(); ctx.translate(86, Hc - 44 + jy); ctx.scale(2.4, 2.4);
    R.hero(ctx, 0, 0, { face: 1, run: ph >= 1 ? t * 10 : 0, air: ph < 1, suit: ['apron', 'wings', 'armor', 'boots'][Math.floor(t / 4) % 4] }, rtr, t);
    ctx.restore();
    R.enemy(ctx, { k: 'g', x: 420 + Math.sin(t) * 20, y: Hc - 44, dir: Math.cos(t) > 0 ? 1 : -1, alive: true, h: 12, hw: 6 }, t, rtr);
    menu.draw(this, Wc / 2 + 30, 120, 24);
    var line = [], st = SK.save.stats(prog);
    if (this.state.best) line.push(this.t('best') + ': ' + this.state.best);
    if (st.cleared) line.push('✓ ' + st.cleared + '/' + st.total);
    if (line.length) this.text(line.join('   '), Wc / 2 + 30, Hc - 52, { size: 11, align: 'center', color: Pc.muted, weight: 800 });
    if (titleNote && titleNote.a > 0) { titleNote.a -= 1 / 60; this.text(titleNote.text, Wc / 2 + 30, Hc - 66, { size: 11, align: 'center', color: Pc.warn, weight: 800 }); }
    this.text(this.t('hint'), Wc / 2, Hc - 12, { size: rtr ? 9 : 10, align: 'center', color: rtr ? R.E.w : '#fff4e6', weight: 700 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (!(d && d.resume) || !game) newRun();
      else if (mode === 'map') music(SK.MUSIC.map);
      playSince = g.time;
    },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (!game) return;
      if (mode === 'map') {
        if (a === 'left' || a === 'right' || a === 'up' || a === 'down') mapMove(a);
        else if ((a === 'action' || a === 'start') && !M.moving && g.time - playSince > 0.2) enterNode(M.sel);
        return;
      }
      if (mode === 'shop' || mode === 'lever') { miniPress(a); return; }
      if (result && result.t > 0.8 && (a === 'action' || a === 'start')) finishResult();
    },
    update: function (dt) {
      if (!game) return;
      var i;
      for (i = 0; i < ui.toasts.length; i++) ui.toasts[i].t -= dt;
      ui.toasts = ui.toasts.filter(function (q) { return q.t > 0; });
      if (ui.banner) { ui.banner.a -= dt; if (ui.banner.a <= 0) ui.banner = null; }
      if (ui.msg) { ui.msg.a -= dt; if (ui.msg.a <= 0) ui.msg = null; }
      if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt);
      if (mode === 'map') {
        if (M.moving) { var mv = M.moving; mv.t += dt * 150 / Math.max(20, mv.d); var k = Math.min(1, mv.t); M.pos.x = mv.from.x + (mv.to.x - mv.from.x) * k; M.pos.y = mv.from.y + (mv.to.y - mv.from.y) * k; if (k >= 1) { M.moving = null; arrive(); } }
        if (M.noteA > 0) { M.noteA -= dt; if (M.noteA <= 0) M.note = ''; }
        return;
      }
      if (mode === 'shop' || mode === 'lever') { G.t += dt; if (G.win) G.openT = (G.openT || 0) + dt; return; }
      var s = S(), dir = this.input.dir, live = g.time - playSince > 0.25 && s.phase === 'play';
      var jump = live && (this.input.pressed('action') || extra.jump);
      game.setInput(live ? dir.x : 0, live ? dir.y : 0, jump);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k2 = 0; k2 < n; k2++) game.update(STEP);
      s = S();
      var P = s.hero;
      ui.runPh += Math.abs(P.vx) * 0.12 * dt;
      var maxC = Math.max(0, s.LV.w * T - VW), tgt = Math.max(0, Math.min(maxC, P.x - VW / 2 + P.face * 40));
      if (s.LV.fort && s.boss && s.boss.st !== 'sleep' && s.boss.alive) tgt = Math.max(tgt, s.LV.arenaX);
      if (cam < 0) cam = tgt; else cam += (tgt - cam) * Math.min(1, dt * 5);
      FX.step(dt);
      if (result) { result.t += dt; if (result.t > 7) finishResult(); }
      syncLevel();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      if (mode === 'map') { SK.renderMap(g, ctx, M); return; }
      if (mode === 'shop') { SK.renderShop(g, ctx, G); return; }
      if (mode === 'lever') { SK.renderLever(g, ctx, G); return; }
      ui.cam = cam + (ui.shake > 0 ? (Math.random() - 0.5) * 8 * ui.shake / 0.4 : 0);
      SK.renderLevel(g, ctx, S(), ui);
    }
  });
  function finishResult() {
    if (!result) return;
    var r = result; result = null; ui.banner = null;
    if (r.final) { g.state.score = prog.score; g.win(); return; }
    toMap(prog.at);
  }

  // ---------- доп. клавиши и тач ----------
  var JUMP = { KeyZ: 1, KeyK: 1 }, FIRE = { KeyX: 1, KeyJ: 1 };
  function inLevel() { return g._sceneName === 'play' && game && mode === 'level' && S().phase === 'play' && g.time - playSince > 0.25; }
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extra.jump = !!(held.KeyZ || held.KeyK); if (ip) e.preventDefault(); if (ip && mode !== 'level' && !e.repeat) g.scenes.play.press.call(g, 'action'); return; }
    if (FIRE[e.code]) { if (ip) e.preventDefault(); if (!e.repeat && inLevel()) game.fire(); }
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extra.jump = !!(held.KeyZ || held.KeyK); } });
  addEventListener('blur', function () { held = {}; extra.jump = false; });
  function tap(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { e.preventDefault(); fn(); b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 120); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  tap('bFire', function () { if (inLevel()) game.fire(); });
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
  SK.app = { g: g, game: function () { return game; }, mode: function () { return mode; }, prog: function () { return prog; }, enterLevel: enterLevel, enterNode: enterNode, toMap: toMap, ui: ui, M: M, G: function () { return G; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
