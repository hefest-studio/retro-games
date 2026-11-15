/* ЛЕНТОВОД · js/main.js — склейка: движок Гефест Arcade (меню/пауза/темы/язык/звук/рекорд) + логика (sim.js)
   + рендер (render.js) + мышь/тач (pointer.js). Инструменты, призрак, протяжка линией, снос, камера и зум, звук. */
(function (root) {
  'use strict';
  var LV = root.LENTOVOD, SIM = LV.sim, R = LV.render, LY = R.LAYOUT, BLD = SIM.BLD;
  var TH = Arcade.themes || {};
  var g = Arcade.createGame({ canvas: '#c', width: LY.W, height: LY.H, gameId: 'lentovod', strings: LV.STR, theme: 'modern', lives: 1,
    themes: { modern: Object.assign({}, TH.modern, { bg: '#1d2216', accent: '#e7b44c', panel: '#2a2219', muted: '#b9ab8c', ink: '#f4ead2' }),
      retro: Object.assign({}, TH.retro, { bg: '#000000', accent: '#ffb030' }) } });
  LV.g = g;
  g.useStandardScreens({ title: 'ЛЕНТОВОД', subtitle: 'Паровая мастерская на рудном поле · прототип', lives: 1 });
  g.menu.setHint(function () { return [g.t('hint1'), { text: g.t('hint2'), dim: true }]; }, 'title');
  g.menu.addItem({ scene: 'pause', key: 'restart', after: 'resume', label: function () { return g.t('restart'); }, onSelect: function () { S.W = null; g.goto('play'); } });

  var Q = new URLSearchParams(location.search);
  var S = { W: null, cam: { x: 0, y: 0, z: 1 }, tool: null, dir: 0, filter: 'cu', ghost: null, del: null, msgs: [], th: 'modern', hoverBtn: null, hoverCell: null, inspect: null, dragStart: null };
  LV.S = S;
  var acc = 0, endT = 0, worldN = 0, sndT = {}, hallHp = 0;
  function beep(f, d, type, v) { g.audio.beep(f, d, type, v); }
  function beepT(key, gap, f, d, type, v) { var now = S.W ? S.W.time : 0; if (now - (sndT[key] || -9) < gap) return; sndT[key] = now; beep(f, d, type, v); }
  function msg(text, col) { var M = S.msgs; if (M.length && M[M.length - 1].text === text) { M[M.length - 1].life = 3; return; } M.push({ text: text, life: 3, col: col }); if (M.length > 3) M.shift(); }

  function newGame() {
    var seed = parseInt(Q.get('seed'), 10) || 7;
    S.W = SIM.newWorld({ seed: seed, firstWave: Q.get('demo') ? 400 : 180 }); S.W.seedKey = ++worldN + ':' + seed;
    if (Q.get('demo')) SIM.demoLayout(S.W);
    S.tool = null; S.ghost = null; S.del = null; S.msgs = []; S.inspect = null; acc = 0; endT = 0; hallHp = S.W.hall.hp;
    S.cam.z = 1; centerOn(S.W.hall.x + 9, S.W.hall.y + 1.5);
    R.resetCache(); msg(g.t('msgStart'));
  }
  // ---------- камера ----------
  function ts() { return 24 * S.cam.z; }
  function clampCam() { var s = ts(), W = S.W, mw = W.w * s, mh = W.h * s; S.cam.x = mw <= LY.W ? (mw - LY.W) / 2 : Math.max(0, Math.min(mw - LY.W, S.cam.x)); S.cam.y = mh <= LY.VIEW_H ? (mh - LY.VIEW_H) / 2 : Math.max(0, Math.min(mh - LY.VIEW_H, S.cam.y)); }
  function centerOn(x, y) { var s = ts(); S.cam.x = x * s - LY.W / 2; S.cam.y = y * s - LY.VIEW_H / 2; clampCam(); }
  function zoomAt(k, p) {
    var z0 = S.cam.z, z1 = Math.max(0.5, Math.min(2.2, z0 * k)); if (z1 === z0) return;
    var wx = (p.x + S.cam.x) / (24 * z0), wy = (p.y - LY.TOP + S.cam.y) / (24 * z0);
    S.cam.z = z1; S.cam.x = wx * 24 * z1 - p.x; S.cam.y = wy * 24 * z1 - (p.y - LY.TOP); clampCam();
  }
  function toWorld(p) { var s = ts(); return { x: (p.x + S.cam.x) / s, y: (p.y - LY.TOP + S.cam.y) / s }; }
  function cellAt(p) { var w = toWorld(p); return { x: Math.floor(w.x), y: Math.floor(w.y) }; }
  function anchor(type, p) { var d = BLD[type], w = toWorld(p); return { x: Math.floor(w.x - d.w / 2 + 0.5), y: Math.floor(w.y - d.h / 2 + 0.5) }; }
  function inView(p) { return p.y >= LY.TOP && p.y < LY.H - LY.BOT; }
  function inMM(p) { var r = R.mmRect(); return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h; }
  function playing() { return g._sceneName === 'play' && S.W && S.W.winner < 0; }

  // ---------- инструменты ----------
  function setTool(id) {
    if (id === 'rotate') { rotate(1); return; }
    if (id === 'charge') { charge(); return; }
    S.tool = S.tool === id ? null : id; S.ghost = null; S.del = null; S.inspect = null; beep(S.tool ? 760 : 420, 0.03, 'triangle');
    if (S.tool && BLD[S.tool] && !SIM.afford(S.W, S.tool)) msg(g.t('msgCost'), 'bad');
  }
  function rotate(k) { S.dir = (S.dir + k + 4) % 4; if (S.ghost && !S.ghost.line) S.ghost.cells[0].dir = S.dir; refreshGhost(); beep(600, 0.02); }
  function charge() { if (!S.W.units.length) { msg(g.t('msgNoUnits'), 'bad'); beep(160, 0.08, 'square'); return; } SIM.orderAttack(S.W); msg(g.t('msgCharge'), 'good'); beep(520, 0.08, 'sawtooth'); beep(780, 0.12, 'sawtooth'); }
  var REASON = { busy: 'msgBusy', terrain: 'msgTerrain', ore: 'msgOre', enemy: 'msgEnemy', bounds: 'msgBounds', cost: 'msgCost' };
  function ghostAt(p) {
    if (!S.tool || !BLD[S.tool]) { S.ghost = null; return; }
    var a = anchor(S.tool, p); S.ghost = { type: S.tool, cells: [{ x: a.x, y: a.y, dir: S.dir }] }; refreshGhost();
  }
  function ghostLine(p0, p) {
    var a = cellAt(p0), b = cellAt(p); S.ghost = { type: S.tool, cells: SIM.lineCells(a.x, a.y, b.x, b.y, S.dir), line: true }; refreshGhost();
  }
  function refreshGhost() {
    var G = S.ghost; if (!G) return; var W = S.W, spend = 0, cost = (BLD[G.type].cost || {}).ingot || 0;
    G.cells.forEach(function (c) {
      var ex = SIM.bAt(W, c.x, c.y), r = ex && ex.type === G.type && BLD[G.type].rot ? '' : SIM.canPlace(W, G.type, c.x, c.y, { free: true });
      if (!r && !(ex && ex.type === G.type)) { spend += cost; if (spend > W.stock.ingot || !SIM.afford(W, G.type)) r = 'cost'; }
      c.ok = !r; c.why = r;
    });
  }
  function commitGhost() {
    var G = S.ghost; if (!G) return; var W = S.W, n = 0, bad = null;
    if (G.line) { G.cells.forEach(function (c) { if (!c.ok && !bad) bad = c.why; }); n = SIM.placeLine(W, G.type, G.cells); }
    else { var c = G.cells[0], why = SIM.canPlace(W, G.type, c.x, c.y); if (why) bad = why; else { var b = SIM.place(W, G.type, c.x, c.y, c.dir); if (b) { n = 1; if (b.type === 'sorter') b.filter = S.filter; } } }
    if (n) { beep(440, 0.05, 'triangle'); beep(660, 0.05, 'triangle'); } else if (bad && !G.line) { msg(g.t(REASON[bad] || 'msgBusy'), 'bad'); beep(150, 0.08, 'square'); }
    else if (G.line && !n && bad) { msg(g.t(REASON[bad] || 'msgBusy'), 'bad'); beep(150, 0.08, 'square'); }
    if (!SIM.afford(W, G.type) && n) msg(g.t('msgCost'), 'warn');
  }
  function delRect(p0, p) { var a = cellAt(p0), b = cellAt(p); return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }; }
  function demolishRect(r) {
    var n = 0, seen = {};
    for (var y = r.y0; y <= r.y1; y++) for (var x = r.x0; x <= r.x1; x++) { var b = SIM.bAt(S.W, x, y); if (b && !seen[b.id]) { seen[b.id] = 1; if (SIM.remove(S.W, x, y)) n++; } }
    if (n) beep(300, 0.06, 'square'); return n;
  }
  function clickNoTool(p) {
    var c = cellAt(p), b = SIM.bAt(S.W, c.x, c.y); S.inspect = b;
    if (b && b.type === 'sorter') { var I = SIM.ITEMS; b.filter = I[(I.indexOf(b.filter) + 1) % I.length]; S.filter = b.filter; msg(g.t('msgFilter') + ': ' + g.t(b.filter)); beep(880, 0.03, 'triangle'); }
  }

  // ---------- мышь / тач ----------
  var ptr = FabPointer.attach(g.canvas, {
    enabled: playing,
    onDown: function (p) {
      if (p.y >= LY.H - LY.BOT) { var b = R.buttonAt(p.x, p.y); if (b) setTool(b.id); return 'capture'; }
      if (inMM(p)) { var r = R.mmRect(); centerOn((p.x - r.x) / r.w * S.W.w, (p.y - r.y) / r.h * S.W.h); return 'capture'; }
      if (!inView(p)) return 'capture';
      S.dragStart = p;
      if (S.tool && BLD[S.tool]) ghostAt(p);
    },
    onDrag: function (p0, p, info) {
      var t = S.tool, d = t && BLD[t];
      if (d && d.line) ghostLine(p0, p);
      else if (d) ghostAt(p);
      else if (t === 'demolish') S.del = delRect(p0, p);
      else if (!t) { var pv = info.prev || p0; S.cam.x -= p.x - pv.x; S.cam.y -= p.y - pv.y; clampCam(); }
    },
    onUp: function (p0, p, moved, info) {
      if (!inView(p0)) return;
      var t = S.tool;
      if (t && BLD[t]) { if (!S.ghost || !moved && !S.ghost.line) ghostAt(p); commitGhost(); if (info.touch) S.ghost = null; else ghostAt(p); }
      else if (t === 'demolish') { demolishRect(S.del || delRect(p, p)); S.del = null; }
      else if (t === 'rally') { var w = toWorld(p); SIM.setRally(S.W, w.x, w.y); msg(g.t('msgRally')); beep(660, 0.04, 'triangle'); }
      else if (!moved) clickNoTool(p);
    },
    onRight: function (p0, p, phase) {
      if (!inView(p0)) { if (phase === 'up' && S.tool) setTool(S.tool); return; }
      if (phase === 'drag' && Math.hypot(p.x - p0.x, p.y - p0.y) > 6) S.del = delRect(p0, p);
      if (phase !== 'up') return;
      if (S.del) { demolishRect(S.del); S.del = null; return; }
      var c = cellAt(p), b = SIM.bAt(S.W, c.x, c.y);
      if (b && !BLD[b.type].fixed) { SIM.remove(S.W, c.x, c.y); beep(300, 0.06, 'square'); S.inspect = null; refreshGhost(); }
      else if (S.tool) { S.tool = null; S.ghost = null; beep(380, 0.03); }
    },
    onPan: function (dx, dy) { S.cam.x += dx; S.cam.y += dy; clampCam(); },
    onZoom: function (k, p) { zoomAt(k, p); },
    onHover: function (p) {
      var b = p.y >= LY.H - LY.BOT ? R.buttonAt(p.x, p.y) : null; S.hoverBtn = b ? b.id : null;
      if (!inView(p) || inMM(p)) { S.hoverCell = null; if (!b) S.ghost = S.ghost && S.ghost.line ? S.ghost : null; return; }
      S.hoverCell = cellAt(p);
      if (S.tool && BLD[S.tool]) ghostAt(p);
      else if (!S.tool) { var c = S.hoverCell; S.inspect = SIM.bAt(S.W, c.x, c.y); }
    },
    onCancel: function () { S.ghost = null; S.del = null; }
  });
  LV.ptr = ptr;

  // ---------- клавиатура (capture — раньше движка: Esc с инструментом = отмена, а не пауза) ----------
  var KEYS = { Digit1: 'drill', Digit2: 'belt', Digit3: 'splitter', Digit4: 'sorter', Digit5: 'bridge', Digit6: 'smelter', Digit7: 'glassworks', Digit8: 'gearmill', Digit9: 'assembly', KeyQ: 'turret', KeyE: 'wall', KeyX: 'demolish', KeyF: 'rally', KeyG: 'charge',
    Numpad1: 'drill', Numpad2: 'belt', Numpad3: 'splitter', Numpad4: 'sorter', Numpad5: 'bridge', Numpad6: 'smelter', Numpad7: 'glassworks', Numpad8: 'gearmill', Numpad9: 'assembly' };
  addEventListener('keydown', function (e) {
    if (!playing() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape' && (S.tool || S.ghost)) { S.tool = null; S.ghost = null; S.del = null; e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.code === 'KeyR') { rotate(e.shiftKey ? -1 : 1); e.preventDefault(); return; }
    var t = KEYS[e.code]; if (t) { setTool(t); if (S.tool && BLD[S.tool] && ptr.inside) ghostAt(ptr.pos); e.preventDefault(); }
  }, true);

  // ---------- события мира → звук и сообщения ----------
  function drain() {
    var W = S.W;
    W.events.forEach(function (ev) {
      if (ev.t === 'wave') { msg(g.t('waveNow').replace('{n}', ev.n), 'bad'); beep(220, 0.25, 'square'); beep(180, 0.3, 'square'); }
      else if (ev.t === 'mech') { msg(g.t('msgMech'), 'good'); beep(990, 0.05, 'triangle'); beep(1320, 0.07, 'triangle'); }
      else if (ev.t === 'lost' && !ev.owner) { msg(g.t('msgLost'), 'bad'); beepT('lost', 0.3, 90, 0.25, 'sawtooth', 0.08); }
      else if (ev.t === 'shot') { if (ev.k === 'turret' || ev.k === 'hall') beepT('t', 0.09, 1300, 0.02, 'square', 0.025); else if (ev.k === 'mech') beepT('m', 0.12, 700, 0.02, 'triangle', 0.025); else if (ev.k === 'mound') beepT('o', 0.2, 140, 0.06, 'sawtooth', 0.04); }
      else if (ev.t === 'die' && ev.k === 'foe') beepT('d', 0.08, 110, 0.08, 'sawtooth', 0.05);
      else if (ev.t === 'craft') beepT('c', 0.6, 1760, 0.015, 'sine', 0.015);
    });
    W.events.length = 0;
    if (W.hall && W.hall.hp < hallHp - 0.5) { if (W.time - (sndT.hall || -99) > 6) { sndT.hall = W.time; msg(g.t('msgHall'), 'bad'); } }
    hallHp = W.hall ? W.hall.hp : 0;
  }

  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !S.W) newGame(); },
    update: function (dt) {
      var W = S.W; if (!W) return;
      var dir = g.input.dir; S.cam.x += dir.x * 560 * dt; S.cam.y += dir.y * 560 * dt; clampCam();
      if (W.winner < 0) { acc += dt; var n = 0; while (acc >= SIM.TICK && n++ < 8) { acc -= SIM.TICK; SIM.step(W, SIM.TICK); } if (n >= 8) acc = 0; }
      if (S.ghost && !S.ghost.line) refreshGhost();
      if (S.inspect && !W.byId[S.inspect.id]) S.inspect = null;
      drain();
      for (var i = S.msgs.length - 1; i >= 0; i--) { S.msgs[i].life -= dt; if (S.msgs[i].life <= 0) S.msgs.splice(i, 1); }
      g.canvas.style.cursor = S.tool === 'demolish' ? 'not-allowed' : S.tool ? 'crosshair' : 'default';
      g.state.score = W.score;
      if (W.winner >= 0) { endT += dt; if (endT > 2.2) { ptr.cancel(); g.canvas.style.cursor = 'default'; var won = W.winner === 0; S.W = null; if (won) g.win(); else g.gameover(); } }
    },
    draw: function (ctx) {
      if (!S.W) { g.clear(); return; }
      S.th = g.themeName === 'retro' ? 'retro' : 'modern';
      R.frame(ctx, S, g);
      if (S.W.winner >= 0) g.overlay(S.W.winner === 0 ? g.t('win') : g.t('gameover'), S.W.winner === 0 ? g.t('winSub') : g.t('loseSub'), S.W.winner === 0 ? g.th().good : g.th().bad);
    },
    press: function (a) {
      if (a === 'pause') { ptr.cancel(); S.ghost = null; S.del = null; this.pause(); }
      if (a === 'action' && S.W && S.W.hall) centerOn(S.W.hall.x + 1.5, S.W.hall.y + 1.5);
    }
  });
  var bp = document.getElementById('bPause');
  if (bp) bp.addEventListener('click', function () { if (g._sceneName === 'play') { ptr.cancel(); g.pause(); } else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  function fit() {
    var foot = document.getElementById('foot'), fh = foot && getComputedStyle(foot).display !== 'none' ? foot.offsetHeight + 4 : 4;
    var w = Math.min(innerWidth, (innerHeight - fh) * LY.W / LY.H); g.canvas.style.width = Math.floor(w) + 'px'; g.canvas.style.height = Math.floor(w * LY.H / LY.W) + 'px';
  }
  addEventListener('resize', fit); fit();
  setInterval(function () { if (document.body.dataset.theme !== g.themeName) document.body.dataset.theme = g.themeName; }, 250);

  // отладка/тесты: клетка → координаты в окне
  LV.debug = {
    tileToClient: function (tx, ty) { var r = g.canvas.getBoundingClientRect(), s = ts(); return { x: r.left + (tx * s - S.cam.x) * r.width / LY.W, y: r.top + (LY.TOP + ty * s - S.cam.y) * r.height / LY.H }; },
    buttonToClient: function (id) { var r = g.canvas.getBoundingClientRect(), b = R.buttons.filter(function (q) { return q.id === id; })[0]; return { x: r.left + (b.x + b.w / 2) * r.width / LY.W, y: r.top + (b.y + b.h / 2) * r.height / LY.H }; },
    centerOn: centerOn, setZoom: function (z) { S.cam.z = z; clampCam(); }
  };
  g.start('title');
})(window);
