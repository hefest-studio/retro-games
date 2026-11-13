/* ЛЕДНИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js, save.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован; в меню — «Сбросить карту»; в паузе — «На карту».
   Сцена play: режим 'map' (карта мира: узлы-уровни, развилки, тайные тропы) ↔ режим 'level' (уровень).
   Ввод: ←→/AD — бег; Пробел/Z/K — прыжок; X/J/Ctrl — бумеранг; C/F — песец Бураш; ↓/S — подкат/пригнуться; ↑/W — сосулька;
   тач: дпад, ● прыжок, ⟲ бумеранг, 🦊-кнопка Бураш, II пауза. Прогресс карты — localStorage arcade.save.lednik (save.js). */
(function (global) {
  'use strict';
  var LD = global.LEDNIK, L = LD.logic, R = LD.R, FX = R.FX, VW = R.VW, VH = R.VH, T = L.T, MAP = LD.MAP;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0d1a2e', panel: '#16253d', ink: '#f2f7ff', muted: '#a9bbd3', accent: '#7fd6ff', good: '#7be08f', bad: '#ff6b6b', warn: '#ffd34d', grid: '#24395a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#55ffff', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'lednik', strings: LD.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  LD.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var ls = null; try { ls = global.localStorage; } catch (e) {}
  var store = LD.save.store(ls || { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} });
  var prog = store.load();

  var game = null, mode = 'map', playSince = 0, cam = 0, camPrev = 0;
  var ui = { toasts: [], banner: null, msg: null, runPh: 0, throwT: 0, shake: 0 };
  var M = { prog: prog, sel: prog.at, pos: { x: 0, y: 0 }, moving: null, fresh: {}, note: '', noteA: 0, face: 1, lives: 3, score: 0 };
  var held = {}, extra = { jump: false }, pad = { jump: false }, result = null;
  function S() { return game.state(); }
  function th() { return g.th(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); M.lives = s.lives; M.score = s.score; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < ui.toasts.length; i++) if (Math.abs(ui.toasts[i].y - y) < 10 && Math.abs(ui.toasts[i].x - x) < 60) y -= 12;
    var life = big ? 1.7 : 1.0; ui.toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big }); if (ui.toasts.length > 14) ui.toasts.shift();
  }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.8 }; }
  function banner(title, sub, dur, lines, color) { ui.banner = { title: title, sub: sub, a: dur || 2.4, dur: dur || 2.4, lines: lines, color: color, hiLast: true }; }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  var curTrack = null;
  function music(tr) { if (curTrack === tr) return; curTrack = tr; g.setMusic(tr); g.audio.music.step = 0; }

  function onEvent(type, d) {
    d = d || {};
    LD.sfx(g, type, d);
    var s = game ? S() : null, P = s && s.hero, E = R.E, t = th();
    switch (type) {
      case 'level': {
        ui.toasts = []; FX.clear(); ui.msg = null;
        var LV = s.LV;
        music(LV.boss ? LD.MUSIC.boss : LD.MUSIC.level);
        if (LV.boss) banner(g.t('b_' + LV.boss), g.t('bd_' + LV.boss), 3.2);
        else banner(g.t('n_' + LV.id), g.t('r' + LV.r) + ' · ' + g.t('sup') + ': ' + g.t('need') + ' ' + LV.need + ' / ' + LV.total, 2.6, LV.id === '1-1' ? [g.t('intro')] : null);
        break;
      }
      case 'sup': toast('+' + L.PTS.sup, col('#ffe08a', E.y), d.x, d.y - 8); FX.add(d.x, d.y, { n: 6, sp: 70, life: 0.35, c: col('#ffffff', E.w), r: 1.6, g: 0 }); if (d.fox) msg(g.t('foxGot'), t.good, 1.2); break;
      case 'enough': msg(g.t('enough'), t.good, 2.4); break;
      case 'key': toast(g.t('key'), col('#ffe6a0', E.y), d.x, d.y - 14, true); msg(g.t('keyHint'), t.warn, 2.6); FX.add(d.x, d.y, { n: 18, sp: 120, c: col('#ffe6a0', E.y), r: 2 }); break;
      case 'heart': toast(g.t('heart'), col('#ff8aa0', E.R), d.x, d.y - 10, true); break;
      case 'reveal': toast('!', col('#ffffff', E.w), d.x, d.y - 12); FX.add(d.x, d.y, { n: 8, sp: 60, life: 0.4, c: col('#dff6ff', E.C), r: 1.5, g: -20 }); break;
      case 'camp': toast(g.t('camp'), col('#ffb35c', E.y), d.x, d.y - 30); FX.add(d.x, d.y - 8, { n: 10, sp: 60, a: -Math.PI / 2, spread: 1.2, c: col('#ffb35c', E.y), r: 1.6, g: -60 }); break;
      case 'fox': break;
      case 'foxNo': msg(g.t('foxNo'), t.muted, 1.4); break;
      case 'need': msg(g.t('needMore').replace('{n}', d.left), t.warn, 1.8); break;
      case 'stun': FX.add(d.x, d.y, { n: 6, sp: 80, life: 0.3, c: col('#ffe36a', E.y), r: 1.6 }); break;
      case 'stomp': case 'boing': FX.add(d.x, d.y, { n: 8, sp: 90, life: 0.3, c: col('#ffffff', E.w), r: 2, a: -Math.PI / 2, spread: 2.4 }); break;
      case 'flee': toast('+' + d.pts, col('#ffe08a', E.y), d.x, d.y - 8); FX.add(d.x, d.y, { n: 10, sp: 100, c: col('#f4f8ff', E.w), r: 2.2, g: 100 }); break;
      case 'crack': FX.add(d.x, d.y + 2, { n: 10, sp: 70, life: 0.6, c: col('#bfeaff', E.C), r: 1.8, g: 400 }); break;
      case 'shatter': FX.add(d.x, d.y, { n: 6, sp: 70, life: 0.35, c: col('#dff6ff', E.C), r: 1.5 }); break;
      case 'land': if (d.v > 380 && P) FX.add(P.x, P.y, { n: 5, sp: 40, life: 0.3, c: col('#ffffff', E.w), r: 1.6, a: -Math.PI / 2, spread: 2.6, g: 120 }); break;
      case 'slide': if (P) FX.add(P.x, P.y, { n: 6, sp: 60, life: 0.35, c: col('#ffffff', E.w), r: 1.8, a: Math.PI + (P.face > 0 ? 0 : Math.PI), spread: 0.8, g: 80 }); break;
      case 'throw': ui.throwT = 0.18; break;
      case 'hurt': ui.shake = 0.25; FX.add(d.x, d.y - 10, { n: 10, sp: 110, c: col('#ff8a8a', E.R), r: 2 }); break;
      case 'die': ui.shake = 0.4; FX.add(d.x, d.y - 10, { n: 22, sp: 140, c: col('#f4f8ff', E.w), r: 2.4 }); msg(g.t('d_' + d.why, ''), t.bad, 1.6); break;
      case 'respawn': ui.toasts = []; break;
      case 'thud': ui.shake = Math.max(ui.shake, 0.18); break;
      case 'bossHit': FX.add(d.x, d.y, { n: 12, sp: 130, c: col('#ffe36a', E.y), r: 2 }); break;
      case 'bossDown': ui.shake = 0.6; FX.add(d.x, d.y, { n: 40, sp: 200, c: col('#ffffff', E.w), r: 2.6, life: 0.9 }); toast('+' + L.PTS.boss, col('#ffe08a', E.y), d.x, d.y - 30, true); break;
      case 'clear': onClear(d); break;
      case 'gameover': sync(); setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') g.gameover(); }, 1500); break;
    }
    sync();
  }
  function onClear(d) {
    var before = {}; MAP.NODES.forEach(function (n) { before[n.id] = MAP.isOpen(prog, n.id); });
    LD.save.apply(prog, d.id, d); prog.at = d.id; store.save(prog);
    M.fresh = {}; MAP.NODES.forEach(function (n) { if (!before[n.id] && MAP.isOpen(prog, n.id)) M.fresh[n.id] = 1; });
    var s = S(), lines;
    if (s.LV.boss) lines = [g.t('bonus') + ' +' + d.bonus, g.t('tapMap')];
    else lines = [g.t('sup') + ': ' + d.sup + ' / ' + d.total + (d.full ? '  ★' : ''), g.t('bonus') + ' +' + d.bonus + (d.full ? '  · ' + g.t('full') : ''), d.key ? g.t('keyHint') : g.t('tapMap')];
    banner(s.LV.boss ? g.t('clearBoss') : g.t('clear'), g.t('n_' + d.id), 99, lines, th().good);
    result = { id: d.id, t: 0 };
  }

  // ---------- новый забег / уровень / карта ----------
  function newRun() {
    game = LD.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1) });
    LD.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear(); result = null;
    toMap(prog.at);
    sync();
  }
  function toMap(at) {
    mode = 'map'; result = null; ui.banner = null; ui.msg = null;
    if (!MAP.isOpen(prog, at)) at = MAP.FIRST;
    M.sel = at; var n = MAP.node(at); M.pos = { x: n.x, y: n.y }; M.moving = null; M.note = '';
    music(LD.MUSIC.map);
  }
  function enterLevel(id) {
    mode = 'level'; prog.at = id; store.save(prog);
    game.startLevel(id); cam = -1; playSince = g.time; ui.runPh = 0;
    sync();
  }
  function mapMove(a) {
    if (M.moving) return;
    var dv = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[a]; if (!dv) return;
    var cur = MAP.node(M.sel), best = null, bs = 0.35;
    MAP.neighbors(prog, M.sel).forEach(function (id) {
      var n = MAP.node(id), dx = n.x - cur.x, dy = n.y - cur.y, l = Math.sqrt(dx * dx + dy * dy) || 1, sc = (dx * dv[0] + dy * dv[1]) / l;
      if (sc > bs) { bs = sc; best = id; }
    });
    if (best) { var to = MAP.node(best); M.moving = { from: { x: cur.x, y: cur.y }, to: to, t: 0, d: Math.hypot(to.x - cur.x, to.y - cur.y) }; M.face = to.x >= cur.x ? 1 : -1; M.sel = best; M.note = ''; g.audio.beep(520, 0.03); }
    else { M.note = g.t('locked'); M.noteA = 1.2; g.audio.beep(180, 0.05); }
  }

  // ---------- стандартные экраны и меню ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  var resetArm = 0, titleNote = null;
  g.menu.addItem({ key: 'reset', after: 'play', label: function () { return resetArm > g.time ? g.t('resetQ') : g.t('reset'); },
    onSelect: function () { if (resetArm > g.time) { prog = store.reset(); M.prog = prog; M.fresh = {}; resetArm = 0; titleNote = { text: g.t('resetDone'), a: 2 }; } else resetArm = g.time + 3; } });
  g.menu.addItem({ key: 'tomap', scene: 'pause', before: 'menu', label: function () { return g.t('toMap'); },
    onSelect: function () { if (game && mode === 'level') { S().phase = 'idle'; toMap(prog.at); } g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      var rtr = retro();
      ctx.save(); ctx.translate(this.W / 2 - 14, this.H / 2 - 52); ctx.scale(2, 2);
      R.hero(ctx, 0, 0, { face: 1, run: name === 'win' ? this.time * 8 : 0, hasBoom: true }, rtr, this.time);
      R.fox(ctx, 26, 0, -1, name === 'win' ? this.time : 0, rtr, null);
      ctx.restore();
      var st = LD.save.stats(prog);
      this.text('✓ ' + st.cleared + '/18 · ★ ' + st.full + ' · ' + st.keys + '/3', this.W / 2, this.H / 2 + 44, { size: 12, align: 'center', color: th().muted, weight: 700 });
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var rtr = retro(), Wc = this.W, Hc = this.H, t = this.time, Pc = th();
    ctx.imageSmoothingEnabled = !rtr;
    R.background(ctx, { r: 1 }, t * 20, rtr, t);
    if (rtr) { R.E && (ctx.fillStyle = R.E.w); ctx.fillRect(0, Hc - 50, Wc, 50); ctx.fillStyle = R.E.l; ctx.fillRect(0, Hc - 50, Wc, 2); }
    else { ctx.fillStyle = '#f4f8ff'; ctx.beginPath(); ctx.moveTo(0, Hc - 46); ctx.quadraticCurveTo(Wc * 0.3, Hc - 62, Wc * 0.6, Hc - 48); ctx.quadraticCurveTo(Wc * 0.85, Hc - 38, Wc, Hc - 52); ctx.lineTo(Wc, Hc); ctx.lineTo(0, Hc); ctx.fill();
      ctx.fillStyle = 'rgba(8,16,30,.35)'; ctx.fillRect(0, 0, Wc, Hc - 60); }
    R.snow(ctx, t, 1 / 60, 0, rtr, 0);
    // логотип
    var tt = this.t('title');
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = rtr ? 'bold 46px "Courier New", monospace' : '900 52px Inter, system-ui, sans-serif';
    if (rtr) { ctx.fillStyle = R.E.b; ctx.fillText(tt, Wc / 2 + 3, 63); ctx.fillStyle = R.E.C; ctx.fillText(tt, Wc / 2, 60); ctx.fillStyle = R.E.w; ctx.fillRect(Wc / 2 - 110, 66, 220, 2); }
    else {
      ctx.fillStyle = 'rgba(0,20,50,.5)'; ctx.fillText(tt, Wc / 2 + 2, 64);
      var lg = ctx.createLinearGradient(0, 22, 0, 62); lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.55, '#a8e6ff'); lg.addColorStop(1, '#4fa9dc'); ctx.fillStyle = lg; ctx.fillText(tt, Wc / 2, 61);
      ctx.fillStyle = '#e8f8ff'; for (var i = 0; i < 9; i++) { var ix = Wc / 2 - 120 + i * 30; ctx.beginPath(); ctx.moveTo(ix, 64); ctx.lineTo(ix + 4, 64); ctx.lineTo(ix + 2, 70 + (i % 3) * 3); ctx.fill(); }
    }
    ctx.restore();
    this.text(this.t('subtitle'), Wc / 2, 86, { size: rtr ? 10 : 11, align: 'center', color: Pc.ink, weight: 700 });
    // герои
    ctx.save(); ctx.translate(86, Hc - 50); ctx.scale(2.6, 2.6);
    R.hero(ctx, 0, 0, { face: 1, run: 0, hasBoom: Math.floor(t / 2) % 2 === 0, throwT: Math.floor(t / 2) % 2 }, rtr, t);
    R.fox(ctx, 24, 0, 1, Math.sin(t) > 0 ? t : 0, rtr, null);
    ctx.restore();
    if (Math.floor(t / 2) % 2) { var bx = 130 + ((t % 2) < 1 ? (t % 1) * 260 : (1 - (t % 1)) * 260); var B = { x: bx, y: Hc - 92, spin: t * 20 }; ctx.save(); if (rtr) { ctx.fillStyle = R.E.y; ctx.fillRect(Math.round(bx) - 4, Hc - 93, 8, 2); } else { ctx.translate(B.x, B.y); ctx.rotate(B.spin); R.boomShape(ctx, 0, 0, '#efe3c8', 2); } ctx.restore(); }
    menu.draw(this, Wc / 2 + 40, 120, 24);
    var line = [], st = LD.save.stats(prog);
    if (this.state.best) line.push(this.t('best') + ': ' + this.state.best);
    if (st.cleared) line.push('✓ ' + st.cleared + '/18  ★ ' + st.full);
    if (line.length) this.text(line.join('   '), Wc / 2 + 40, Hc - 30, { size: 11, align: 'center', color: rtr ? R.E.d : '#3a4a66', weight: 800 });
    if (titleNote && titleNote.a > 0) { titleNote.a -= 1 / 60; this.text(titleNote.text, Wc / 2 + 40, Hc - 62, { size: 11, align: 'center', color: Pc.warn, weight: 800 }); }
    this.text(this.t('hint'), Wc / 2, Hc - 10, { size: rtr ? 9 : 10, align: 'center', color: rtr ? R.E.k : '#4b5b78', weight: 700 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (!(d && d.resume) || !game) newRun();
      else if (mode === 'map') music(LD.MUSIC.map);
      playSince = g.time;
    },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (!game) return;
      if (mode === 'map') {
        if (a === 'left' || a === 'right' || a === 'up' || a === 'down') mapMove(a);
        else if ((a === 'action' || a === 'start') && !M.moving && g.time - playSince > 0.2) enterLevel(M.sel);
        return;
      }
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
      if (ui.throwT > 0) ui.throwT -= dt;
      if (mode === 'map') {
        if (M.moving) { var mv = M.moving; mv.t += dt * 140 / Math.max(20, mv.d); var k = Math.min(1, mv.t); M.pos.x = mv.from.x + (mv.to.x - mv.from.x) * k; M.pos.y = mv.from.y + (mv.to.y - mv.from.y) * k; if (k >= 1) M.moving = null; }
        if (M.noteA > 0) { M.noteA -= dt; if (M.noteA <= 0) M.note = ''; }
        return;
      }
      var s = S(), dir = this.input.dir, live = g.time - playSince > 0.25 && s.phase === 'play';
      var jump = live && (this.input.pressed('action') || extra.jump || pad.jump);
      game.setInput(live ? dir.x : 0, live ? dir.y : 0, jump);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k2 = 0; k2 < n; k2++) game.update(STEP);
      s = S();
      var P = s.hero;
      ui.runPh += (P.climb ? Math.abs(P.vy) * 0.1 : Math.abs(P.vx) * 0.11) * dt;
      // камера
      var maxC = Math.max(0, s.LV.w * T - VW), tgt = Math.max(0, Math.min(maxC, P.x - VW / 2 + P.face * 36));
      camPrev = cam;
      if (cam < 0) cam = tgt; else cam += (tgt - cam) * Math.min(1, dt * 5);
      ui.dt = dt; ui.camDx = cam - camPrev;
      FX.step(dt);
      if (result) { result.t += dt; if (result.t > 6) finishResult(); }
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      if (mode === 'map') { LD.renderMap(g, ctx, M); return; }
      ui.cam = cam + (ui.shake > 0 ? (Math.random() - 0.5) * 8 * ui.shake / 0.4 : 0);
      LD.renderLevel(g, ctx, S(), ui);
    }
  });
  function finishResult() {
    if (!result) return;
    var id = result.id; result = null; ui.banner = null;
    if (id === MAP.FINAL) { sync(); g.win(); return; }
    toMap(id);
  }

  // ---------- доп. клавиши и тач ----------
  var JUMP = { KeyZ: 1, KeyK: 1 }, BOOM = { KeyX: 1, KeyJ: 1, ControlLeft: 1, ControlRight: 1 }, FOX = { KeyC: 1, KeyF: 1 };
  function inLevel() { return g._sceneName === 'play' && game && mode === 'level' && S().phase === 'play' && g.time - playSince > 0.25; }
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extra.jump = !!(held.KeyZ || held.KeyK); if (ip) e.preventDefault(); if (ip && mode === 'map' && !e.repeat) g.scenes.play.press.call(g, 'action'); return; }
    if (BOOM[e.code] || FOX[e.code]) { if (ip) e.preventDefault(); if (e.repeat || !inLevel()) return; if (BOOM[e.code]) game.throwBoom(); else game.callFox(); }
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extra.jump = !!(held.KeyZ || held.KeyK); } });
  addEventListener('blur', function () { held = {}; extra.jump = false; pad.jump = false; });
  function tap(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { e.preventDefault(); fn(); b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 120); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  tap('bBoom', function () { if (inLevel()) game.throwBoom(); });
  tap('bFox', function () { if (inLevel()) game.callFox(); });
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
  LD.app = { g: g, game: function () { return game; }, mode: function () { return mode; }, prog: function () { return prog; }, enterLevel: enterLevel, toMap: toMap, ui: ui, M: M };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
