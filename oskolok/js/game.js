/* ОСКОЛОК · логика (без DOM, детерминирована): физика Веры, резонатор (импульс / стеклянный щит / пробой),
   дрон-светляк, Стеклодувы-стражи и их осколки, Тени-ловцы (бродячие и погоня), кристаллы, зеркала и лучи,
   рычаги/кнопки/двери, осыпающиеся плиты, экраны-эпизоды с контрольной точкой, главы и кат-сцены, финал с выбором.
   Координаты — в клетках: x — центр Веры, y — подошвы; пол клетки ряда r — на высоте y = r. */
(function (global) {
  'use strict';
  var O = global.OSKOLOK = global.OSKOLOK || {};
  var COLS = 32, ROWS = 18;
  var K = {
    RUN: 6.5, ACC: 70, FRIC: 90, AIRACC: 45, AIRFRIC: 10, G: 42, JUMP: 14.5, VMAX: 24, FALL_DIE: 22,
    HW: 0.32, HH: 1.7, COYOTE: 0.08, JBUF: 0.1,
    PULSE_R: 3.5, PULSE_CD: 0.45, SHIELD_T: 0.15, EN_MAX: 2.4, EN_DRAIN: 0.8, EN_REG: 0.6, CHARGE_T: 0.9, BREACH_R: 5,
    DRONE_V: 11, DRONE_RET: 9, DRONE_HOVER: 5, LIGHT_V: 2.4, LIGHT_D: 4.6, DRONE_HIT: 0.95,
    G_SPEED: 1.0, G_VIEW: 10, G_WIND: 0.65, G_COOL: 1.1, G_STUN: 3.5, G_RANGE: 4, SHARD_V: 9, DISTRACT: 7,
    S_SPEED: 1.6, S_HUNT: 3.0, S_STUN: 2, S_SEE: 6,
    CH_V: 6.2, CH_ACC: 10, CH_DELAY: 0.4, CH_GAP: [2.5, 7],
    CRUMBLE: 0.45, DEAD_T: 1.3
  };
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // твёрдость: 1 — всегда, 2 — дверь (твёрда, пока группа закрыта)
  var SOLID = { '#': 1, G: 1, C: 1, K: 1, '}': 1, '{': 1, R: 1, r: 1, D: 2, d: 2 };
  var OBJ = { B: 1, b: 1, '/': 1, Z: 1, V: 1, Q: 1 };   // то, с чем взаимодействует дрон
  function grp(ch) { return ch === 'D' || ch === 'L' || ch === 'B' || ch === 'R' ? 1 : 2; }

  function parse(def) {
    var t = [], start = null, guards = [], lurkers = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var ch = (def.map[r] || '')[c] || '#';
      if (ch === '.') ch = ' ';
      if (ch === 'P') { start = { x: c + 0.5, y: r + 1 }; ch = ' '; }
      else if (ch === 'g' || ch === 'h') { guards.push({ x: c + 0.5, y: r + 1, face: ch === 'g' ? -1 : 1 }); ch = ' '; }
      else if (ch === 's') { lurkers.push({ x: c + 0.5, y: r + 1 }); ch = ' '; }
      t.push(ch);
    }
    return { t: t, start: start || { x: 1.5, y: 16 }, guards: guards, lurkers: lurkers };
  }
  function cellSolid(M, c, r) {
    if (c < 0 || c >= COLS) return true;
    if (r < 0 || r >= ROWS) return false;
    var ch = M.t[r * COLS + c], s = SOLID[ch];
    if (!s) return false;
    if (s === 2) return !M.open[grp(ch)];
    return true;
  }
  function tile(M, c, r) { return c < 0 || c >= COLS || r < 0 || r >= ROWS ? '#' : M.t[r * COLS + c]; }
  function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }

  // шаг физики Веры (общий для игры, графа проходимости и бота). inp: { x:-1|0|1, jump: нажат в этот кадр, lock }
  function stepHero(h, inp, M, dt, ev) {
    var lock = !!inp.lock, tx = lock ? 0 : inp.x * K.RUN;
    var a = h.ground ? (inp.x && !lock ? K.ACC : K.FRIC) : (inp.x && !lock ? K.AIRACC : K.AIRFRIC);
    h.vx = approach(h.vx, tx, a * dt);
    if (inp.x) h.face = inp.x > 0 ? 1 : -1;
    if (inp.jump) h.jbuf = K.JBUF;
    if (h.jbuf > 0 && (h.ground || h.coyote > 0) && !lock) { h.vy = -K.JUMP; h.ground = false; h.coyote = 0; h.jbuf = 0; if (ev) ev('jump', { x: h.x, y: h.y }); }
    h.jbuf = Math.max(0, h.jbuf - dt);
    h.vy = Math.min(K.VMAX, h.vy + K.G * dt);
    var r0, r1, c0, c1, c, r;
    // по X
    h.x += h.vx * dt;
    r0 = Math.floor(h.y - K.HH + 1e-6); r1 = Math.floor(h.y - 1e-6);
    if (h.vx > 0) { c = Math.floor(h.x + K.HW - 1e-9); for (r = r0; r <= r1; r++) if (cellSolid(M, c, r)) { h.x = c - K.HW - 1e-6; h.vx = 0; break; } }
    else if (h.vx < 0) { c = Math.floor(h.x - K.HW + 1e-9); for (r = r0; r <= r1; r++) if (cellSolid(M, c, r)) { h.x = c + 1 + K.HW + 1e-6; h.vx = 0; break; } }
    // по Y
    var vyB = h.vy, landed = false;
    h.y += h.vy * dt;
    c0 = Math.floor(h.x - K.HW + 1e-6); c1 = Math.floor(h.x + K.HW - 1e-6);
    if (h.vy > 0) { r = Math.floor(h.y - 1e-7); for (c = c0; c <= c1; c++) if (cellSolid(M, c, r)) { h.y = r; h.vy = 0; landed = true; break; } }
    else if (h.vy < 0) { r = Math.floor(h.y - K.HH); for (c = c0; c <= c1; c++) if (cellSolid(M, c, r)) { h.y = r + 1 + K.HH; h.vy = 0; break; } }
    var was = h.ground; h.ground = landed;
    if (h.ground) h.coyote = K.COYOTE; else h.coyote = Math.max(0, h.coyote - dt);
    if (landed && !was) { h.landV = vyB; if (ev) ev('land', { v: vyB, x: h.x, y: h.y }); }
    else h.landV = 0;
    return h;
  }
  // что угрожает Вере в её клетках: 'spike' | 'fall' | 'abyss' | null
  function hazard(h, M) {
    if (h.y > ROWS + 1.5) return 'abyss';
    if (h.landV > K.FALL_DIE) return 'fall';
    var r0 = Math.floor(h.y - K.HH + 1e-6), r1 = Math.floor(h.y - 1e-6), c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      if (tile(M, c, r) === '^' && h.y > r + 0.45 && h.x + K.HW > c + 0.12 && h.x - K.HW < c + 0.88) return 'spike';
    }
    return null;
  }
  function overlapsTile(h, M, set) {   // первая клетка из set, которой касается тело Веры → индекс или -1
    var r0 = Math.floor(h.y - K.HH + 1e-6), r1 = Math.floor(h.y - 1e-6), c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
    for (var r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) for (var c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) if (set[M.t[r * COLS + c]]) return r * COLS + c;
    return -1;
  }
  function newHero(x, y, face) { return { x: x, y: y, vx: 0, vy: 0, face: face || 1, ground: true, coyote: K.COYOTE, jbuf: 0, landV: 0, energy: K.EN_MAX, regen: 0, shield: false, resT: 0, chargeT: 0, pulseCd: 0, pulseT: 0, breachT: 0, run: 0, dead: false }; }
  function floorBounds(M, x, y, lim) {   // отрезок пола под существом (без провалов, стен и игл), не дальше lim клеток
    var c0 = Math.floor(x), r = Math.round(y), L = c0, R = c0;
    var okc = function (c) { return c >= 0 && c < COLS && cellSolid(M, c, r) && !cellSolid(M, c, r - 1) && !cellSolid(M, c, r - 2) && tile(M, c, r - 1) !== '^'; };
    while (L - 1 >= c0 - lim && okc(L - 1)) L--;
    while (R + 1 <= c0 + lim && okc(R + 1)) R++;
    return { min: L + 0.5, max: R + 0.5 };
  }

  O.Game = function (opts) {
    opts = opts || {};
    var sim = !!opts.sim, god = !!opts.god, emitF = opts.onEvent;
    var S = { phase: 'idle', phaseT: 0, idx: 0, ch: 1, ep: 1, def: null, M: null, hero: null, guards: [], lurkers: [], shards: [], chase: null,
      drone: { have: false, st: 'off', x: 0, y: 0, tx: 0, ty: 0, t: 0 }, entryHave: false, cut: null, time: 0, screenT: 0, deaths: 0, ending: null,
      exited: null, inp: { x: 0, jump: false, down: false, res: false, charge: false }, prev: {}, clock: 0, enterT: 0 };
    function emit(t, d) { if (emitF) emitF(t, d || {}); }
    function M() { return S.M; }

    // ---------- экраны, главы, кат-сцены ----------
    function startCut(id, then) {
      if (sim || opts.noCut) { then(); return; }
      S.phase = 'cut'; S.cut = { id: id, t: 0, dur: O.CUTS[id] || 4, then: then }; emit('cut', { id: id });
    }
    function enterScreen(i, o) {
      o = o || {};
      var def = opts.def && i === 0 ? opts.def : O.SCREENS[i];
      var P = parse(def), prevH = S.hero, prevChase = S.chase;
      S.idx = i; S.def = def; S.ch = def.ch || 1; S.ep = def.ep || 1;
      S.M = { t: P.t.slice(), open: { 1: false, 2: false }, tog: { 1: false, 2: false }, lit: { 1: false, 2: false }, crum: {}, fall: [], beams: [], dirty: true };
      S.start = P.start;
      if (!o.restart) S.entryHave = S.drone.have;
      S.drone.have = S.entryHave;
      S.hero = newHero(P.start.x, P.start.y, 1);
      if (o.carry && prevH) { S.hero.vx = prevH.vx; S.hero.face = prevH.face; }
      var d = S.drone; d.st = d.have ? 'follow' : 'off'; var fp = followPos(); d.x = fp.x; d.y = fp.y;
      S.guards = sim ? [] : P.guards.map(function (g, k) { var b = floorBounds(S.M, g.x, g.y, K.G_RANGE); return { id: k, x: g.x, y: g.y, face: g.face, st: 'patrol', t: 0, pause: 0, minX: b.min, maxX: b.max, alive: true }; });
      S.lurkers = sim ? [] : P.lurkers.map(function (l, k) { var b = floorBounds(S.M, l.x, l.y, 8); return { id: k, x: l.x, y: l.y, face: -1, st: 'patrol', t: 0, minX: b.min, maxX: b.max, alive: true }; });
      S.shards = [];
      S.chase = null;
      if (def.chase && !sim) {
        if (o.carry && prevChase && prevH) {
          var gap = Math.max(K.CH_GAP[0], Math.min(K.CH_GAP[1], prevH.x - prevChase.x));
          S.chase = { x: P.start.x - gap, y: P.start.y, v: prevChase.v, t: 0, delay: 0 };
        } else S.chase = { x: -1.0, y: P.start.y, v: 0, t: 0, delay: K.CH_DELAY };
      }
      S.phase = 'play'; S.phaseT = 0; S.screenT = 0; S.exited = null; S.enterT = 0; S.prev = { res: S.inp.res, charge: S.inp.charge, jump: S.inp.jump, down: S.inp.down };
      updateWorld();
      emit('screen', { idx: i, ch: S.ch, ep: S.ep, restart: !!o.restart, chase: !!S.chase });
    }
    function nextScreen() {
      var i = S.idx + 1, nd = O.SCREENS[i];
      if (!nd) return;
      if (nd.ch !== S.ch) { emit('chapter', { ch: nd.ch }); startCut('c' + nd.ch, function () { enterScreen(i); }); }
      else enterScreen(i, { carry: !!(S.def.chase && nd.chase) });
    }
    function finish(e) {
      if (sim) { S.exited = e; return; }
      S.ending = e; emit('ending', { ending: e });
      startCut(e === 'B' ? 'endB' : 'endA', function () { S.phase = 'won'; emit('win', { time: S.time, ending: e, deaths: S.deaths }); });
    }
    function die(why) {
      if (S.phase !== 'play') return;
      if (god && why !== 'abyss' && why !== 'fall' && why !== 'spike') return;
      S.phase = 'dead'; S.phaseT = 0; S.deaths++; S.hero.dead = true; S.dieWhy = why;
      emit('die', { why: why, x: S.hero.x, y: S.hero.y });
    }

    // ---------- мир: двери, лучи, кристаллы, плиты ----------
    function traceBeams() {
      var m = M(), out = [], lit = { 1: false, 2: false };
      for (var k = 0; k < m.t.length; k++) {
        var ch = m.t[k]; if (ch !== '}' && ch !== '{') continue;
        var c = k % COLS, r = (k / COLS) | 0, dx = ch === '}' ? 1 : -1, dy = 0, pts = [[c + 0.5 + dx * 0.5, r + 0.5]];
        for (var n = 0; n < 240; n++) {
          c += dx; r += dy;
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { pts.push([Math.max(0, Math.min(COLS, c + 0.5 - dx * 0.5)), Math.max(0, Math.min(ROWS, r + 0.5 - dy * 0.5))]); break; }
          var t = m.t[r * COLS + c];
          if (t === '/') { pts.push([c + 0.5, r + 0.5]); var q = dx; dx = -dy; dy = -q; continue; }
          if (t === 'Z') { pts.push([c + 0.5, r + 0.5]); var q2 = dx; dx = dy; dy = q2; continue; }
          if (t === 'R' || t === 'r') { lit[grp(t)] = true; pts.push([c + 0.5 - dx * 0.5, r + 0.5 - dy * 0.5]); break; }
          if (SOLID[t] && t !== 'G' && t !== 'D' && t !== 'd') { pts.push([c + 0.5 - dx * 0.5, r + 0.5 - dy * 0.5]); break; }
        }
        out.push(pts);
      }
      m.beams = out; m.lit = lit; m.dirty = false;
    }
    function heroOverDoor(g) {
      var h = S.hero, m = M(), r0 = Math.floor(h.y - K.HH + 1e-6), r1 = Math.floor(h.y - 1e-6), c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var t = tile(m, c, r); if ((t === 'D' || t === 'd') && grp(t) === g) return true; }
      return false;
    }
    function updateWorld() {
      var m = M();
      if (m.dirty) traceBeams();
      for (var g = 1; g <= 2; g++) {
        var want = !!(m.tog[g] || m.lit[g]);
        if (!want && m.open[g] && heroOverDoor(g)) want = true;
        if (want !== m.open[g]) { m.open[g] = want; emit('door', { g: g, open: want }); }
      }
    }
    function setTile(k, ch) { M().t[k] = ch; M().dirty = true; }
    function drop(k) {
      var c = k % COLS, r = (k / COLS) | 0; setTile(k, ' ');
      M().fall.push({ c: c, y: r, vy: 0 }); emit('crystal', { x: c + 0.5, y: r + 0.5 });
    }
    function rotate(k) { var t = M().t[k]; setTile(k, t === '/' ? 'Z' : '/'); emit('mirror', { x: k % COLS + 0.5, y: ((k / COLS) | 0) + 0.5 }); }
    function toggle(g, kind, k) { var m = M(); m.tog[g] = !m.tog[g]; emit(kind, { g: g, on: m.tog[g], x: k % COLS + 0.5, y: ((k / COLS) | 0) + 0.5 }); }
    function heroBoxHit(x0, y0, x1, y1) { var h = S.hero; return h.x + K.HW > x0 && h.x - K.HW < x1 && h.y > y0 && h.y - K.HH < y1; }
    function stepFalling(dt) {
      var m = M();
      for (var i = m.fall.length - 1; i >= 0; i--) {
        var f = m.fall[i]; f.vy = Math.min(K.VMAX, f.vy + K.G * dt); f.y += f.vy * dt;
        var below = Math.floor(f.y + 1);
        if (below >= ROWS + 2) { m.fall.splice(i, 1); continue; }
        if (heroBoxHit(f.c + 0.1, f.y, f.c + 0.9, f.y + 1)) die('crystal');
        S.guards.forEach(function (g) { if (g.alive && Math.abs(g.x - (f.c + 0.5)) < 0.75 && f.y + 1 > g.y - 1.9 && f.y < g.y) shatter(g, 'crystal'); });
        S.lurkers.forEach(function (l) { if (l.alive && Math.abs(l.x - (f.c + 0.5)) < 0.75 && f.y + 1 > l.y - 1.8 && f.y < l.y) { l.alive = false; l.t = 0; emit('fade', { x: l.x, y: l.y }); } });
        if (cellSolid(m, f.c, below) && f.y + 1 >= below) {
          var row = below - 1; if (row >= 0) setTile(row * COLS + f.c, 'K');
          m.fall.splice(i, 1); emit('crash', { x: f.c + 0.5, y: below });
        }
      }
    }
    function stepCrumble(dt) {
      var m = M(), h = S.hero;
      if (h.ground && !sim) {
        var r = Math.round(h.y), c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
        for (var c = c0; c <= c1; c++) { var k = r * COLS + c; if (m.t[k] === 'C' && m.crum[k] == null) { m.crum[k] = 0; emit('shake', { x: c + 0.5, y: r + 0.5 }); } }
      }
      for (var key in m.crum) {
        if (m.crum[key] < 0) continue;
        m.crum[key] += dt;
        if (m.crum[key] >= K.CRUMBLE) { m.crum[key] = -1; setTile(+key, ' '); emit('crumble', { x: key % COLS + 0.5, y: ((key / COLS) | 0) + 0.5 }); }
      }
    }
    function los(x0, y0, x1, y1, skipK, glassOk) {
      var d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 0.2)), m = M();
      for (var i = 1; i < n; i++) {
        var x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n, c = Math.floor(x), r = Math.floor(y), k = r * COLS + c;
        if (k === skipK) continue;
        if (cellSolid(m, c, r) && !(glassOk && tile(m, c, r) === 'G')) return false;
      }
      return true;
    }
    function clearRow(xa, xb, r) {
      var m = M(), a = Math.floor(Math.min(xa, xb)), b = Math.floor(Math.max(xa, xb));
      for (var c = a + 1; c < b; c++) if (cellSolid(m, c, r) && tile(m, c, r) !== 'G') return false;
      return true;
    }

    // ---------- резонатор ----------
    function pulse() {
      var h = S.hero, m = M(), ox = h.x + h.face * 0.25, oy = h.y - 1.0, R = K.PULSE_R;
      h.pulseCd = K.PULSE_CD; h.pulseT = 0.35; emit('pulse', { x: ox, y: oy, face: h.face });
      var front = function (cx) { return (cx - h.x) * h.face >= -0.3; };
      for (var r = Math.max(0, Math.floor(oy - R)); r <= Math.min(ROWS - 1, Math.floor(oy + R)); r++)
        for (var c = Math.max(0, Math.floor(ox - R)); c <= Math.min(COLS - 1, Math.floor(ox + R)); c++) {
          var k = r * COLS + c, t = m.t[k];
          if (t !== '/' && t !== 'Z' && t !== 'V') continue;
          var cx = c + 0.5, cy = r + 0.5;
          if (Math.hypot(cx - ox, cy - oy) > R || !front(cx) || !los(ox, oy, cx, cy, k, true)) continue;
          if (t === 'V') drop(k); else rotate(k);
        }
      S.guards.forEach(function (g) {
        if (!g.alive || g.st === 'stun') return;
        if (Math.hypot(g.x - ox, g.y - 0.95 - oy) <= R && front(g.x) && los(ox, oy, g.x, g.y - 0.95, -1, true)) { g.st = 'stun'; g.t = K.G_STUN; emit('stun', { x: g.x, y: g.y }); }
      });
      S.lurkers.forEach(function (l) {
        if (!l.alive) return;
        if (Math.hypot(l.x - ox, l.y - 0.9 - oy) <= R && front(l.x) && los(ox, oy, l.x, l.y - 0.9, -1, true)) { l.st = 'stun'; l.t = K.S_STUN; emit('stun', { x: l.x, y: l.y, shadow: true }); }
      });
    }
    function breach() {
      var h = S.hero, m = M(), face = h.face, rows = [Math.floor(h.y - 0.5), Math.floor(h.y - 1.5)], broke = 0;
      h.breachT = 0.5; emit('breach', { x: h.x, y: h.y - 1, face: face });
      rows.forEach(function (r) {
        for (var c = Math.floor(h.x) + face; Math.abs(c + 0.5 - h.x) <= K.BREACH_R + 0.01; c += face) {
          if (c < 0 || c >= COLS) break;
          var k = r * COLS + c;
          if (m.t[k] === 'G') { setTile(k, ' '); broke++; emit('glass', { x: c + 0.5, y: r + 0.5 }); }
          else if (cellSolid(m, c, r)) break;
        }
      });
      var hit = function (e) { return e.alive && (e.x - h.x) * face > 0 && Math.abs(e.x - h.x) <= K.BREACH_R + 0.4 && Math.abs(e.y - h.y) < 1.2 && clearRow(h.x, e.x, Math.floor(h.y - 1)); };
      S.guards.forEach(function (g) { if (hit(g)) shatter(g, 'breach'); });
      S.lurkers.forEach(function (l) { if (hit(l)) { l.alive = false; l.t = 0; emit('fade', { x: l.x, y: l.y }); } });
      return broke;
    }

    // ---------- дрон-светляк ----------
    function followPos() {
      var h = S.hero, d = S.drone;
      if (S.def && S.def.dark && S.def.chase) return { x: h.x + 1.9, y: h.y - 1.7 + Math.sin(S.clock * 3) * 0.1 };
      return { x: h.x - h.face * 0.75, y: h.y - 2.15 + Math.sin(S.clock * 3) * 0.12 };
    }
    function droneArrive() {
      var d = S.drone, m = M(), best = -1, bd = K.DRONE_HIT;
      d.st = 'hover'; d.t = K.DRONE_HOVER;
      for (var r = Math.max(0, Math.floor(d.y - 1)); r <= Math.min(ROWS - 1, Math.floor(d.y + 1)); r++)
        for (var c = Math.max(0, Math.floor(d.x - 1)); c <= Math.min(COLS - 1, Math.floor(d.x + 1)); c++) {
          var k = r * COLS + c; if (!OBJ[m.t[k]]) continue;
          var dd = Math.hypot(c + 0.5 - d.x, r + 0.5 - d.y); if (dd < bd) { bd = dd; best = k; }
        }
      emit('droneAt', { x: d.x, y: d.y, hit: best >= 0 });
      if (best < 0) return;
      var t = m.t[best];
      if (t === 'B' || t === 'b') toggle(grp(t), 'button', best);
      else if (t === '/' || t === 'Z') rotate(best);
      else if (t === 'V') drop(best);
      else if (t === 'Q') finish('B');
    }
    function stepDrone(dt) {
      var d = S.drone; if (!d.have) return;
      var fp = followPos(), m = M();
      if (d.st === 'follow') { var k = Math.min(1, dt * 6); d.x += (fp.x - d.x) * k; d.y += (fp.y - d.y) * k; }
      else if (d.st === 'fly') {
        var dx = d.tx - d.x, dy = d.ty - d.y, L = Math.hypot(dx, dy), s = K.DRONE_V * dt;
        if (L <= s) { if (!cellSolid(m, Math.floor(d.tx), Math.floor(d.ty))) { d.x = d.tx; d.y = d.ty; } droneArrive(); }
        else {
          var nx = d.x + dx / L * s, ny = d.y + dy / L * s;
          if (cellSolid(m, Math.floor(nx), Math.floor(ny))) droneArrive(); else { d.x = nx; d.y = ny; }
        }
      } else if (d.st === 'hover') { d.t -= dt; if (d.t <= 0) d.st = 'ret'; }
      else if (d.st === 'ret') {
        var ex = fp.x - d.x, ey = fp.y - d.y, LL = Math.hypot(ex, ey), ss = K.DRONE_RET * dt;
        if (LL <= Math.max(ss, 0.3)) d.st = 'follow'; else { d.x += ex / LL * ss; d.y += ey / LL * ss; }
      }
    }
    function droneLight(x, y) { var d = S.drone; return d.have && Math.hypot(d.x - x, d.y - y) < K.LIGHT_D * 0.85; }

    // ---------- Стеклодувы, осколки, Тени ----------
    function shatter(g, why) { if (!g.alive) return; g.alive = false; g.t = 0; emit('shatter', { x: g.x, y: g.y, why: why }); }
    function canSee(g) {
      var h = S.hero; if (h.dead) return false;
      var dx = h.x - g.x;
      if (dx * g.face <= 0 || Math.abs(dx) > K.G_VIEW || Math.abs(h.y - g.y) > 1.0) return false;
      return clearRow(g.x, h.x, Math.floor(g.y - 1.2));
    }
    function distracted(g) {
      var d = S.drone;
      if (!d.have || (d.st !== 'hover' && d.st !== 'fly')) return false;
      return Math.abs(d.x - g.x) < K.DISTRACT && Math.abs(d.y - (g.y - 1.2)) < 4 && los(g.x, g.y - 1.4, d.x, d.y, -1, true);
    }
    function stepGuards(dt) {
      var h = S.hero;
      S.guards.forEach(function (g) {
        if (!g.alive) { g.t += dt; return; }
        var dr = distracted(g);
        switch (g.st) {
          case 'stun': g.t -= dt; if (g.t <= 0) { g.st = 'patrol'; g.t = 0; } break;
          case 'look':
            if (dr) { g.face = S.drone.x > g.x ? 1 : -1; g.t = 0.8; } else { g.t -= dt; if (g.t <= 0) g.st = 'patrol'; }
            break;
          case 'patrol':
            if (dr) { g.st = 'look'; g.t = 0.8; emit('distract', { x: g.x, y: g.y }); break; }
            if (canSee(g)) { g.st = 'wind'; g.t = 0; emit('alert', { x: g.x, y: g.y }); break; }
            if (g.pause > 0) g.pause -= dt;
            else {
              g.x += g.face * K.G_SPEED * dt;
              if (g.x > g.maxX) { g.x = g.maxX; g.face = -1; g.pause = 0.9; } else if (g.x < g.minX) { g.x = g.minX; g.face = 1; g.pause = 0.9; }
            }
            break;
          case 'wind':
            g.t += dt;
            if (g.t >= K.G_WIND) { S.shards.push({ x: g.x + g.face * 0.6, y: g.y - 1.15, vx: g.face * K.SHARD_V, fr: false }); emit('shard', { x: g.x, y: g.y }); g.st = 'cool'; g.t = 0; }
            break;
          case 'cool':
            g.t += dt;
            if (dr) { g.st = 'look'; g.t = 0.8; break; }
            if (g.t >= K.G_COOL) { g.st = canSee(g) ? 'wind' : 'patrol'; g.t = 0; }
            break;
        }
        if (g.st !== 'stun' && heroBoxHit(g.x - 0.36, g.y - 1.9, g.x + 0.36, g.y)) die('guard');
      });
      for (var i = S.shards.length - 1; i >= 0; i--) {
        var s = S.shards[i]; s.x += s.vx * dt;
        var c = Math.floor(s.x), r = Math.floor(s.y);
        if (c < 0 || c >= COLS || cellSolid(M(), c, r)) { S.shards.splice(i, 1); emit('shardBreak', { x: s.x, y: s.y }); continue; }
        if (!s.fr) {
          if (Math.abs(s.x - h.x) < K.HW + 0.12 && s.y > h.y - K.HH && s.y < h.y) {
            if (h.shield && h.face === -Math.sign(s.vx)) { s.vx = -s.vx * 1.15; s.fr = true; s.x = h.x + h.face * (K.HW + 0.2); emit('reflect', { x: s.x, y: s.y }); }
            else { die('shard'); S.shards.splice(i, 1); }
          }
        } else {
          for (var j = 0; j < S.guards.length; j++) { var g = S.guards[j]; if (g.alive && Math.abs(s.x - g.x) < 0.42 && s.y > g.y - 1.9 && s.y < g.y) { shatter(g, 'reflect'); S.shards.splice(i, 1); break; } }
        }
      }
    }
    function stepLurkers(dt) {
      var h = S.hero;
      S.lurkers.forEach(function (l) {
        if (!l.alive) { l.t += dt; return; }
        var lit = droneLight(l.x, l.y - 0.9);
        if (l.st === 'stun') { l.t -= dt; if (l.t <= 0) l.st = 'patrol'; }
        else if (lit) { if (l.st !== 'burn') emit('burn', { x: l.x, y: l.y }); l.st = 'burn'; l.t = 1.2; var aw = l.x >= S.drone.x ? 1 : -1; l.face = aw; l.x = Math.max(l.minX, Math.min(l.maxX, l.x + aw * 2.2 * dt)); }
        else if (l.st === 'burn') { l.t -= dt; if (l.t <= 0) l.st = 'patrol'; }
        else {
          var dx = h.x - l.x, see = !h.dead && Math.abs(h.y - l.y) < 1.2 && Math.abs(dx) < K.S_SEE && clearRow(l.x, h.x, Math.floor(l.y - 1));
          if (see) { if (l.st !== 'hunt') emit('hunt', { x: l.x, y: l.y }); l.st = 'hunt'; l.face = dx > 0 ? 1 : -1; l.x += l.face * K.S_HUNT * dt; }
          else { l.st = 'patrol'; l.x += l.face * K.S_SPEED * dt; }
          if (l.x > l.maxX) { l.x = l.maxX; l.face = -1; } else if (l.x < l.minX) { l.x = l.minX; l.face = 1; }
          if (heroBoxHit(l.x - 0.4, l.y - 1.8, l.x + 0.4, l.y)) die('shadow');
        }
      });
    }
    function stepChase(dt) {
      var c = S.chase, h = S.hero; if (!c) return;
      c.t += dt; if (c.t < c.delay) return;
      if (c.t - dt < c.delay) emit('chaseStart', {});
      c.v = Math.min(K.CH_V, c.v + K.CH_ACC * dt); c.x += c.v * dt; c.y += (h.y - c.y) * Math.min(1, dt * 5);
      if (Math.abs(h.x - c.x) < 0.85) die('chaser');
    }

    // ---------- главный шаг ----------
    var EXIT = { X: 1 }, PORTAL = { O: 1 }, PICK = { '*': 1 }, LEVER = { L: 1, l: 1 };
    function playStep(dt) {
      var h = S.hero, inp = S.inp, pv = S.prev;
      var jumpP = inp.jump && !pv.jump, resP = inp.res && !pv.res, downP = inp.down && !pv.down;
      S.prev = { jump: inp.jump, res: inp.res, charge: inp.charge, down: inp.down };
      h.pulseCd = Math.max(0, h.pulseCd - dt); h.pulseT = Math.max(0, h.pulseT - dt); h.breachT = Math.max(0, h.breachT - dt);
      if (resP && h.pulseCd <= 0 && !h.chargeT) pulse();
      h.resT = inp.res ? h.resT + dt : 0;
      var sh = inp.res && h.resT >= K.SHIELD_T && h.energy > 0 && !h.chargeT;
      if (sh && !h.shield) emit('shield', {});
      h.shield = sh;
      if (h.shield) { h.energy = Math.max(0, h.energy - K.EN_DRAIN * dt); h.regen = 0.5; }
      else { h.regen -= dt; if (h.regen <= 0) h.energy = Math.min(K.EN_MAX, h.energy + K.EN_REG * dt); }
      if (inp.charge && h.ground && !h.shield) { if (!h.chargeT) emit('charge', {}); var was = h.chargeT; h.chargeT += dt; if (was < K.CHARGE_T && h.chargeT >= K.CHARGE_T) emit('charged', {}); }
      else if (h.chargeT) { if (h.chargeT >= K.CHARGE_T) breach(); h.chargeT = 0; }
      stepHero(h, { x: inp.x, jump: jumpP, lock: h.shield || h.chargeT > 0 }, M(), dt, emit);
      h.run += Math.abs(h.vx) * dt;
      if (downP) { var lk = overlapsTile(h, M(), LEVER); if (lk >= 0) toggle(grp(M().t[lk]), 'lever', lk); }
      stepCrumble(dt);
      stepFalling(dt);
      updateWorld();
      stepDrone(dt);
      if (S.phase !== 'play') return;
      if (!sim) { stepGuards(dt); stepLurkers(dt); stepChase(dt); }
      var hz = hazard(h, M()); if (hz) die(hz);
      if (S.phase !== 'play') return;
      var pk = overlapsTile(h, M(), PICK);
      if (pk >= 0) {
        setTile(pk, ' '); S.drone.have = true; S.drone.st = 'follow'; S.drone.x = pk % COLS + 0.5; S.drone.y = ((pk / COLS) | 0) + 0.5;
        emit('dronePick', { x: S.drone.x, y: S.drone.y });
        startCut('drone', function () { S.phase = 'play'; });
        return;
      }
      if (overlapsTile(h, M(), PORTAL) >= 0) { finish('A'); return; }
      if (overlapsTile(h, M(), EXIT) >= 0) { if (sim) S.exited = 'X'; else { emit('exit', { idx: S.idx }); nextScreen(); } }
    }

    var api = {
      start: function () {
        var i = opts.idx != null ? opts.idx : 0;
        if (opts.chapter > 1) { i = O.SCREENS.findIndex(function (s) { return s.ch === opts.chapter; }); if (i < 0) i = 0; }
        S.drone.have = opts.have != null ? !!opts.have : i > 1;
        S.time = opts.elapsed || 0;
        var first = !opts.def && (i === 0 || O.SCREENS[i - 1].ch !== O.SCREENS[i].ch);
        if (first) { var ch = O.SCREENS[i].ch; emit('chapter', { ch: ch }); S.idx = i; S.ch = ch; startCut('c' + ch, function () { enterScreen(i); }); }
        else enterScreen(i);
        return api;
      },
      update: function (dt) {
        S.clock += dt;
        if (S.phase === 'cut') { S.time += dt; S.cut.t += dt; if (S.cut.t >= S.cut.dur) { var f = S.cut.then; S.cut = null; f(); } return; }
        if (S.phase === 'dead') { S.time += dt; S.phaseT += dt; if (S.phaseT >= K.DEAD_T) { emit('restart', {}); enterScreen(S.idx, { restart: true }); } return; }
        if (S.phase !== 'play' || S.exited) return;
        S.time += dt; S.screenT += dt; S.enterT += dt;
        playStep(dt);
      },
      setInput: function (i) { i = i || {}; S.inp = { x: i.x > 0 ? 1 : i.x < 0 ? -1 : 0, jump: !!i.jump, down: !!i.down, res: !!i.res, charge: !!i.charge }; },
      sendDrone: function (x, y) {
        var d = S.drone; if (!d.have || S.phase !== 'play') return false;
        d.tx = Math.max(0.3, Math.min(COLS - 0.3, x)); d.ty = Math.max(0.3, Math.min(ROWS - 0.3, y)); d.st = 'fly'; emit('droneGo', { x: d.tx, y: d.ty }); return true;
      },
      recallDrone: function () { var d = S.drone; if (d.have && (d.st === 'fly' || d.st === 'hover')) { d.st = 'ret'; return true; } return false; },
      skip: function () { if (S.phase === 'cut' && S.cut && S.cut.t > 0.3) { S.cut.t = S.cut.dur; return true; } return false; },
      restartScreen: function () { if (S.phase === 'play' || S.phase === 'dead') enterScreen(S.idx, { restart: true }); },
      state: function () { return S; },
      key: function () { var m = S.M; return m.t.join('') + '|' + (m.tog[1] ? 1 : 0) + (m.tog[2] ? 1 : 0) + (S.drone.have ? 1 : 0); },
      // тестовые хуки
      _load: function (key) {
        var m = S.M, n = COLS * ROWS; m.t = key.slice(0, n).split(''); var f = key.slice(n + 1);
        m.tog = { 1: f[0] === '1', 2: f[1] === '1' }; m.open = { 1: false, 2: false }; m.fall = []; m.crum = {}; m.dirty = true;
        S.drone.have = f[2] === '1'; S.exited = null; S.phase = 'play'; S.hero.dead = false; S.shards = [];
        updateWorld(); var gs = m.tog; m.open = { 1: !!(gs[1] || m.lit[1]), 2: !!(gs[2] || m.lit[2]) };
      },
      _place: function (x, y, face) {
        S.hero = newHero(x, y, face || 1); var d = S.drone; d.st = d.have ? 'follow' : 'off'; var fp = followPos(); d.x = fp.x; d.y = fp.y;
        S.prev = { jump: S.inp.jump, res: S.inp.res, charge: S.inp.charge, down: S.inp.down }; S.exited = null; if (S.phase === 'dead') S.phase = 'play';
      },
      _go: function (i, o) { enterScreen(i, o); },
      _die: die
    };
    return api;
  };
  O.logic = { K: K, COLS: COLS, ROWS: ROWS, SOLID: SOLID, OBJ: OBJ, mulberry32: mulberry32, parse: parse, cellSolid: cellSolid, tile: tile, stepHero: stepHero, hazard: hazard, newHero: newHero, grp: grp, floorBounds: floorBounds };
})(typeof window !== 'undefined' ? window : globalThis);
