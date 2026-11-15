/* ПРИИСК · js/main.js — сборка: движок Гефест Arcade (меню/пауза/темы/язык/звук/рекорд) + логика (game.js)
   + рендер (render.js) + мышь/тач (mouse.js). Камера, выделение, приказы, группы Ctrl+1…9, курсоры, звук. */
(function (global) {
  'use strict';
  var P = global.PRIISK, L = P.logic, R = P.render, LY = R.LAYOUT, T = R.TILE, CMP = P.campaign;
  var TH = Arcade.themes || {};
  var g = Arcade.createGame({ canvas: '#c', width: LY.W, height: LY.H, gameId: 'priisk', strings: P.STR, theme: 'modern', lives: 1,
    themes: { modern: Object.assign({}, TH.modern, { bg: '#101318', accent: '#e0a53a' }), retro: Object.assign({}, TH.retro, { bg: '#000000', accent: '#ffff55' }) } });
  P.g = g;
  g.useStandardScreens({ title: 'ПРИИСК', subtitle: 'Две артели · одно медное плато', lives: 1 });
  g.menu.setHint(function () { return [g.t('hint1'), { text: g.t('hint2'), dim: true }]; }, 'title');
  g.menu.addItem({ scene: 'pause', key: 'restart', after: 'resume', label: function () { return g.t('restart'); }, onSelect: function () { if (S.mission) startMission(S.mission); else g.goto('play'); } });

  var S = { W: null, cam: { x: 0, y: 0 }, sel: new Set(), hover: null, placing: null, box: null, marks: [], msgs: [], th: 'modern', t: function (k) { return g.t(k); }, panelHover: null };
  var groups = {}, lastGroup = { n: 0, t: 0 }, acc = 0, endT = 0, lowWas = false, shotT = 0, worldN = 0, mmDrag = false;
  P.S = S; P.groups = groups;
  var STEP = 1 / 60;

  // ---------- кампания: старт миссии ----------
  function resetUi() { S.sel = new Set(); S.placing = null; S.marks = []; S.msgs = []; endT = 0; acc = 0; for (var k in groups) delete groups[k]; }
  function startMission(id) {
    var def = CMP.byId(id); if (!def) return;
    S.mission = id; S.W = CMP.build(def, { save: CU.data, seed: (Date.now() % 9973) + 1 }); resetUi();
    CU.attach(S);
    var hq = L.has(S.W, 0, 'hq'), hero = S.W.units.find(function (u) { return u.owner === 0; });
    if (hq) centerOn(hq.tx + 3, hq.ty + 1); else if (hero) centerOn(hero.x + 8, hero.y - 4);
    R.resetCache(); g.state.score = 0; g.state.lives = 1;
    g.goto('play', { resume: true });
  }
  P.startMission = startMission;
  function newGame() {
    S.mission = null; CU.detach(S);
    var seed = (Date.now() % 100000) + 1, q = new URLSearchParams(location.search);
    if (q.get('seed')) seed = parseInt(q.get('seed'), 10) || 1;
    S.W = L.newWorld({ seed: seed }); S.W.seedKey = ++worldN + ':' + seed;
    S.sel = new Set(); S.placing = null; S.marks = []; S.msgs = []; endT = 0; acc = 0;
    for (var k in groups) delete groups[k];
    var hq = L.has(S.W, 0, 'hq'); centerOn(hq.tx + 1.5, hq.ty + 1.5);
    R.resetCache(); msg(g.t('msgStart'));
  }
  P.msg = msg;
  function msg(text, col) { if (S.msgs.length && S.msgs[S.msgs.length - 1].text === text) { S.msgs[S.msgs.length - 1].life = 3; return; } S.msgs.push({ text: text, life: 3, col: col }); if (S.msgs.length > 3) S.msgs.shift(); }
  function clampCam() { S.cam.x = Math.max(0, Math.min(S.W.w * T - LY.W, S.cam.x)); S.cam.y = Math.max(0, Math.min(S.W.h * T - LY.VIEW_H, S.cam.y)); }
  function centerOn(x, y) { S.cam.x = x * T - LY.W / 2; S.cam.y = y * T - LY.VIEW_H / 2; clampCam(); }
  function toWorld(p) { return { x: (p.x + S.cam.x) / T, y: (p.y + S.cam.y) / T }; }
  function inView(p) { return p.y < LY.VIEW_H; }
  function inMinimap(p) { var M = LY.MM; return p.x >= M.x && p.x < M.x + S.W.w * M.s && p.y >= M.y && p.y < M.y + S.W.h * M.s; }
  function mmWorld(p) { var M = LY.MM; return { x: (p.x - M.x) / M.s, y: (p.y - M.y) / M.s }; }
  function ownSel() { var out = []; S.sel.forEach(function (id) { var e = S.W.byId[id]; if (e && e.owner === 0 && e.kind === 'unit') out.push(id); }); return out; }
  function visiblePick(w) { return L.pickAt(S.W, w.x, w.y, function (e) { return L.visibleTo0(S.W, e); }); }
  function viewRect() { return { x0: S.cam.x / T, y0: S.cam.y / T, x1: (S.cam.x + LY.W) / T, y1: (S.cam.y + LY.VIEW_H) / T }; }
  function playing() { return g._sceneName === 'play' && S.W && S.W.winner < 0; }
  function beep(f, d, type, v) { g.audio.beep(f, d, type, v); }

  // ---------- стройка/заказ из панели ----------
  function panelOrder(b) {
    var W = S.W, pl = W.players[0];
    if (!CMP.allowed(W, b.type)) { msg(g.t('msgLocked'), 'warn'); beep(180, 0.08, 'square'); return; }
    if (!L.reqMet(W, 0, b.type)) { msg(g.t('msgNeed') + ': ' + needName(b), 'warn'); beep(180, 0.08, 'square'); return; }
    if (b.kind === 'bld') {
      if (pl.build) { if (pl.build.ready && pl.build.type === b.type) { startPlacing(); return; } msg(g.t('msgBusy'), 'warn'); beep(180, 0.06); return; }
      if (!L.startBuild(W, 0, b.type)) { msg(g.t('msgNoCopper'), 'bad'); beep(160, 0.1, 'square'); return; }
    } else if (!L.queueUnit(W, 0, b.type)) { msg(g.t('msgNoCopper'), 'bad'); beep(160, 0.1, 'square'); return; }
    beep(660, 0.04);
  }
  function needName(b) { var req = b.kind === 'bld' ? L.BLDS[b.type].req : [L.UNITS[b.type].from]; var miss = req.filter(function (r) { return !L.has(S.W, 0, r); }); if (!L.has(S.W, 0, 'hq')) miss.unshift('hq'); return miss.map(function (r) { return g.t(r); }).join(', '); }
  function panelCancel(b) {
    var W = S.W, pl = W.players[0];
    if (b.kind === 'bld') { if (pl.build && pl.build.type === b.type) { L.cancelBuild(W, 0); S.placing = null; beep(300, 0.05); } }
    else if (L.dequeueUnit(W, 0, b.type)) beep(300, 0.05);
  }
  function startPlacing() { var pl = S.W.players[0]; if (pl.build && pl.build.ready) { S.placing = { type: pl.build.type, tx: 0, ty: 0, ok: false }; updatePlacing(mouse.pos); } }
  function updatePlacing(p) {
    if (!S.placing) return; var w = toWorld(p), d = L.BLDS[S.placing.type];
    S.placing.tx = Math.round(w.x - d.w / 2); S.placing.ty = Math.round(w.y - d.h / 2);
    S.placing.ok = L.canPlace(S.W, 0, S.placing.type, S.placing.tx, S.placing.ty);
    var cells = [];
    for (var j = 0; j < d.h; j++) for (var i = 0; i < d.w; i++) { var a = S.placing.tx + i, b = S.placing.ty + j, k = b * S.W.w + a; cells.push(a > 0 && b > 0 && a < S.W.w - 1 && b < S.W.h - 1 && S.W.t[k] === L.GROUND && !S.W.occ[k] && !S.W.ore[k] && S.W.vis[k] > 0); }
    S.placing.cells = cells;
  }

  // ---------- мышь / тач ----------
  var C = function (body, hx, hy, fb) { return ArcadeMouse.svgCursor(body, hx, hy, fb); };
  var mouse = ArcadeMouse.attach(g.canvas, {
    enabled: playing,
    cursors: {
      select: C("<path d='M4 3 L4 25 L10 19 L14 28 L18 26 L14 17 L22 17 Z' fill='white' stroke='black' stroke-width='1.6'/>", 4, 3, 'pointer'),
      move: C("<g fill='none' stroke='black' stroke-width='5'><path d='M16 6 L16 26 M6 16 L26 16'/></g><g fill='none' stroke='%2366e08a' stroke-width='2.6'><path d='M16 6 L16 26 M6 16 L26 16'/></g><circle cx='16' cy='16' r='3' fill='%2366e08a' stroke='black'/>".replace(/%23/g, '#'), 16, 16, 'crosshair'),
      attack: C("<circle cx='16' cy='16' r='10' fill='none' stroke='black' stroke-width='5'/><circle cx='16' cy='16' r='10' fill='none' stroke='#ff5a4e' stroke-width='2.5'/><path d='M16 2 L16 10 M16 22 L16 30 M2 16 L10 16 M22 16 L30 16' stroke='#ff5a4e' stroke-width='2.5'/>", 16, 16, 'crosshair'),
      flare: C("<circle cx='16' cy='16' r='11' fill='none' stroke='black' stroke-width='5' stroke-dasharray='5 3'/><circle cx='16' cy='16' r='11' fill='none' stroke='#ffb020' stroke-width='2.5' stroke-dasharray='5 3'/><circle cx='16' cy='16' r='4' fill='#ffe08a' stroke='black'/>", 16, 16, 'crosshair'),
      harvest: C("<path d='M6 26 L20 12' stroke='black' stroke-width='6'/><path d='M6 26 L20 12' stroke='#c8a070' stroke-width='3'/><path d='M10 6 Q22 4 28 16 Q20 10 12 10 Z' fill='#eca664' stroke='black' stroke-width='1.5'/>", 18, 10, 'cell'),
      deny: 'not-allowed', place: 'crosshair', pan: 'grabbing', panel: 'pointer', normal: 'default'
    },
    onDown: function (p, info) {
      if (inView(p)) return;
      if (inMinimap(p)) { if (S.targeting) { CU.placeFlare(S, mmWorld(p)); return 'capture'; } mmDrag = true; var w = mmWorld(p); centerOn(w.x, w.y); return 'capture'; }
      var ab = CU.panelAt(S, p); if (ab) { CU.useAbility(S, ab.ab.hero); return 'capture'; }
      var b = R.buttonAt(p.x, p.y, S); if (b) panelOrder(b);
      return 'capture';
    },
    onDrag: function (p) { if (mmDrag) { var M = LY.MM, w = mmWorld({ x: Math.max(M.x, Math.min(M.x + S.W.w * M.s - 1, p.x)), y: Math.max(M.y, Math.min(M.y + S.W.h * M.s - 1, p.y)) }); centerOn(w.x, w.y); } },
    onUp: function () { mmDrag = false; },
    onClick: function (p, info) {
      if (!inView(p)) return;
      if (info.touch && S.placing) updatePlacing(p);
      if (S.placing) { tryPlace(); return; }
      if (S.targeting) { CU.placeFlare(S, toWorld(p)); return; }
      var w = toWorld(p), e = visiblePick(w);
      if (e && e.owner === 0 && e.kind === 'unit' && info.dbl) { // двойной клик — все такие же на экране
        var ids = L.sameTypeIn(S.W, 0, e.type, viewRect()); if (!info.shift) S.sel = new Set(); ids.forEach(function (id) { S.sel.add(id); }); ack(); return;
      }
      if (info.shift && e && e.owner === 0 && e.kind === 'unit') { if (S.sel.has(e.id)) S.sel.delete(e.id); else { onlyUnits(); S.sel.add(e.id); } ack(); return; }
      if (e) { S.sel = new Set([e.id]); if (e.owner === 0) ack(); return; }
      if (!info.shift) S.sel = new Set();
    },
    onBoxing: function (r) { S.box = r ? clipBox(r) : null; },
    onBox: function (r) {
      S.box = null; r = clipBox(r);
      var a = toWorld({ x: r.x0, y: r.y0 }), b = toWorld({ x: r.x1, y: r.y1 });
      var ids = L.boxSelect(S.W, 0, { x0: a.x, y0: a.y, x1: b.x, y1: b.y });
      var mods = arguments[1] || {};
      if (mods.shift) { onlyUnits(); ids.forEach(function (id) { S.sel.add(id); }); } else S.sel = new Set(ids);
      if (ids.length) ack();
    },
    onCommand: function (p, info) {
      if (S.placing) { S.placing = null; beep(300, 0.04); return; }
      if (S.targeting) { S.targeting = null; beep(300, 0.04); return; }
      if (!inView(p)) {
        if (inMinimap(p)) { var mw = mmWorld(p), us = ownSel(); if (us.length) { L.commandMove(S.W, us, mw.x, mw.y); beep(520, 0.03); } return; }
        var b = R.buttonAt(p.x, p.y, S); if (b) panelCancel(b); return;
      }
      var w = toWorld(p), units = ownSel();
      if (!units.length) { // выбрано своё здание — точка сбора
        var sb = singleOwnBld(); if (sb && (sb.type === 'bunk' || sb.type === 'works')) { sb.rally = { x: w.x, y: w.y }; S.marks.push({ x: w.x, y: w.y, kind: 'move', life: 0.6 }); msg(g.t('msgRally')); }
        return;
      }
      var tg = visiblePick(w); if (tg && tg.owner === 0 && tg.kind === 'unit') tg = null;
      var k = L.commandSmart(S.W, 0, units, w.x, w.y, tg);
      if (k === 'deny') { beep(150, 0.06, 'square'); return; }
      var c = tg ? L.center(tg) : w; S.marks.push({ x: c.x, y: c.y, kind: k, life: 0.6 });
      beep(k === 'attack' ? 300 : 520, 0.035, k === 'attack' ? 'sawtooth' : 'triangle');
    },
    onPan: function (dx, dy) { S.cam.x += dx; S.cam.y += dy; clampCam(); },
    onWheel: function (dx, dy) { S.cam.x += dx * 0.8; S.cam.y += dy * 0.8; clampCam(); },
    onHover: function (p) { if (S.placing) updatePlacing(p); }
  });
  P.mouse = mouse;
  function clipBox(r) { return { x0: Math.max(0, r.x0), y0: Math.max(0, Math.min(LY.VIEW_H - 1, r.y0)), x1: Math.min(LY.W, r.x1), y1: Math.min(LY.VIEW_H - 1, r.y1) }; }
  function onlyUnits() { S.sel.forEach(function (id) { var e = S.W.byId[id]; if (!e || e.kind !== 'unit' || e.owner !== 0) S.sel.delete(id); }); }
  function singleOwnBld() { if (S.sel.size !== 1) return null; var e = S.W.byId[S.sel.values().next().value]; return e && e.kind === 'bld' && e.owner === 0 ? e : null; }
  function ack() { beep(880, 0.025, 'triangle'); }
  function tryPlace() {
    var b = L.placeBuild(S.W, 0, S.placing.tx, S.placing.ty);
    if (b) { S.placing = null; beep(440, 0.08, 'triangle'); beep(660, 0.08, 'triangle'); msg(g.t('msgPlaced') + ': ' + g.t(b.type), 'good'); }
    else { msg(g.t('msgCantPlace'), 'bad'); beep(150, 0.08, 'square'); }
  }
  function updateCursor() {
    var p = mouse.pos; S.hover = null; S.panelHover = null;
    if (!playing() || !mouse.inside) return;
    if (!inView(p)) { var b = R.buttonAt(p.x, p.y, S) || CU.panelAt(S, p); S.panelHover = b && b.type ? b : null; mouse.setCursor(S.targeting && inMinimap(p) ? 'flare' : b || inMinimap(p) ? 'panel' : 'normal'); return; }
    if (S.placing) { mouse.setCursor('place'); return; }
    if (S.targeting) { mouse.setCursor('flare'); return; }
    var w = toWorld(p), e = visiblePick(w), us = ownSel(); S.hover = e;
    if (!us.length) { mouse.setCursor(e ? 'select' : 'normal'); return; }
    if (e && e.owner === 0 && e.kind === 'unit') { mouse.setCursor('select'); return; }
    var k = L.smartKind(S.W, 0, us, w.x, w.y, e);
    if (e && e.owner === 0 && e.kind === 'bld' && k === 'deny') { mouse.setCursor('select'); return; }
    mouse.setCursor(k === 'attack' ? 'attack' : k === 'harvest' || k === 'return' ? 'harvest' : k === 'deny' ? 'deny' : 'move');
  }

  // ---------- клавиатура: группы Ctrl+1…9 (и Alt+1…9 — Ctrl+цифра в части браузеров переключает вкладки), H — к конторе, X — стоп ----------
  addEventListener('keydown', function (e) {
    if (!playing()) return;
    if (e.code === 'Escape' && S.placing) { S.placing = null; e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.code === 'Escape' && S.targeting) { S.targeting = null; e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (S.mission && (e.code === 'KeyQ' || e.code === 'KeyE')) { CU.useAbility(S, e.code === 'KeyQ' ? 'varvara' : 'lunya'); e.preventDefault(); return; }
    var m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) {
      var n = +m[2]; e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) { var ids = ownSel(); if (ids.length) { groups[n] = ids.slice(); msg(g.t('msgGroup') + ' ' + n + ': ' + ids.length); beep(740, 0.04); } return; }
      var gr = (groups[n] || []).filter(function (id) { return S.W.byId[id]; }); groups[n] = gr; if (!gr.length) return;
      if (e.shiftKey) gr.forEach(function (id) { S.sel.add(id); }); else S.sel = new Set(gr);
      var now = performance.now();
      if (lastGroup.n === n && now - lastGroup.t < 400) { var u = S.W.byId[gr[0]]; centerOn(u.x, u.y); }
      lastGroup = { n: n, t: now }; ack(); return;
    }
    if (e.code === 'KeyH') { var hq = L.has(S.W, 0, 'hq'); if (hq) centerOn(hq.tx + 1.5, hq.ty + 1.5); }
    if (e.code === 'KeyX') { L.stopUnits(S.W, ownSel()); }
  }, true);

  // ---------- события мира → звук и сообщения ----------
  function drainEvents() {
    var W = S.W, r = viewRect();
    function seen(x, y) { return x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1 && W.vis[Math.floor(y) * W.w + Math.floor(x)] === 2; }
    W.events.forEach(function (ev) {
      if (ev.t === 'ready' && ev.owner === 0) { msg(g.t('msgReady'), 'good'); beep(990, 0.06, 'triangle'); beep(1320, 0.08, 'triangle'); startPlacing(); }
      else if (ev.t === 'unit' && ev.owner === 0) { var u = W.byId[ev.id]; if (u) msg(g.t(u.type) + ': ' + g.t('msgUnit')); beep(700, 0.04, 'triangle'); }
      else if (ev.t === 'die' && seen(ev.x, ev.y)) { beep(ev.kind === 'bld' ? 70 : 110, ev.kind === 'bld' ? 0.4 : 0.15, 'sawtooth', 0.09); if (ev.owner === 0 && ev.kind === 'bld') msg(g.t('msgLost'), 'bad'); }
      else if (ev.t === 'die' && ev.owner === 0 && ev.kind === 'bld') msg(g.t('msgLost'), 'bad');
      else if (ev.t === 'shot' && seen(ev.x, ev.y) && W.time - shotT > 0.07) { shotT = W.time; beep(ev.weapon === 'gun' ? 1400 : 180, ev.weapon === 'gun' ? 0.015 : 0.06, ev.weapon === 'gun' ? 'square' : 'sawtooth', 0.025); }
      else if (ev.t === 'wave' && ev.owner === 1) { msg(g.t('msgWave'), 'bad'); beep(220, 0.2, 'square'); }
    });
    if (W.mission) CU.drain(S);
    W.events.length = 0;
    var low = W.players[0].pOut < W.players[0].pUse; if (low && !lowWas && W.blds.some(function (b) { return b.owner === 0; })) msg(g.t('msgLowPower'), 'warn'); lowWas = low;
  }

  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !S.W) newGame(); },
    update: function (dt) {
      var W = S.W;
      // камера: стрелки/WASD и край экрана
      var dir = g.input.dir, ed = mouse.edgeDir(), sp = 620 * dt;
      S.cam.x += (dir.x + ed.x) * sp; S.cam.y += (dir.y + ed.y) * sp; clampCam();
      if (W.winner < 0) { acc += dt; var n = 0; while (acc >= STEP && n++ < 6) { acc -= STEP; if (W.mission) CMP.tick(W, STEP); else L.step(W, STEP); } if (n >= 6) acc = 0; }
      if (W.mission) CU.update(S);
      S.sel.forEach(function (id) { if (!W.byId[id]) S.sel.delete(id); });
      if (S.placing && !(W.players[0].build && W.players[0].build.ready)) S.placing = null;
      if (S.placing) updatePlacing(mouse.pos);
      drainEvents();
      for (var i = S.marks.length - 1; i >= 0; i--) { S.marks[i].life -= dt; if (S.marks[i].life <= 0) S.marks.splice(i, 1); }
      for (i = S.msgs.length - 1; i >= 0; i--) { S.msgs[i].life -= dt; if (S.msgs[i].life <= 0) S.msgs.splice(i, 1); }
      updateCursor();
      g.state.score = W.players[0].score;
      if (W.winner >= 0) { endT += dt; if (endT > 2.2) { mouse.cancel(); mouse.setCursor('normal'); if (W.mission) { CU.finish(W); S.W = null; return; } if (W.winner === 0) g.win(); else g.gameover(); S.W = null; } }
    },
    draw: function (ctx) {
      if (!S.W) { g.clear(); return; }
      S.th = g.themeName === 'retro' ? 'retro' : 'modern';
      R.frame(ctx, S, 1 / 60);
      if (S.W.winner >= 0) { var MS = S.W.mission; if (MS) g.overlay(S.W.winner === 0 ? g.t('resWin') : g.t('resLose'), S.W.winner === 0 ? '' : MS.reason === 'hq' || !MS.reason ? g.t('reasonHq') : CMP.txt(MS.reason, g.i18n.lang), S.W.winner === 0 ? g.th().good : g.th().bad);
        else g.overlay(S.W.winner === 0 ? g.t('win') : g.t('gameover'), S.W.winner === 0 ? g.t('winSub') : g.t('loseSub'), S.W.winner === 0 ? g.th().good : g.th().bad); }
    },
    press: function (a) {
      if (a === 'pause') { mouse.cancel(); S.box = null; mouse.setCursor('normal'); this.pause(); }
      if (a === 'action') { var us = ownSel(); if (us.length) { var u = S.W.byId[us[0]]; centerOn(u.x, u.y); } }
    }
  });
  var bp = document.getElementById('bPause');
  if (bp) bp.addEventListener('click', function () { if (g._sceneName === 'play') { mouse.cancel(); g.pause(); } else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
  // курсор вне игры — обычный
  var CU = P.campUI.install(g, { S: S, msg: msg, beep: beep, centerOn: centerOn, startMission: startMission, mouse: mouse });
  var origGoto = g.goto; g.goto = function (name, d) { if (name !== 'play') { mouse.cancel(); S.box = null; mouse.setCursor('normal'); } return origGoto.call(this, name, d); };

  function fit() {
    var foot = document.getElementById('foot'), fh = foot && getComputedStyle(foot).display !== 'none' ? foot.offsetHeight + 4 : 4;
    var w = Math.min(innerWidth, (innerHeight - fh) * LY.W / LY.H); g.canvas.style.width = Math.floor(w) + 'px'; g.canvas.style.height = Math.floor(w * LY.H / LY.W) + 'px';
  }
  addEventListener('resize', fit); fit();
  setInterval(function () { if (document.body.dataset.theme !== g.themeName) document.body.dataset.theme = g.themeName; }, 250);
  g.start('title');
  // ?mission=m1|m2 — сразу брифинг миссии (для плейтеста; прогресс не трогается)
  var qm = new URLSearchParams(location.search).get('mission'); if (qm && CMP.byId(qm)) CU.openBrief(qm);
})(window);
