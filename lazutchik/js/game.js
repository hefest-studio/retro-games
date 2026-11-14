/* ЛАЗУТЧИК · game.js — логика без DOM, детерминирована (rng снаружи). LZ.logic — физика героя и правила зрения/тени,
   LZ.Game(opts) — партия. Координаты в px: x — центр героя, y — подошвы. Шаг 1/60 с.
   Герой не прыгает: ходьба (тихо), бег (шумно, тратит энергию), присед (крадётся; в тени укрытий — невидим),
   лестницы, площадки лифта, люки (присесть на люке — открыть и спрыгнуть), дрезина, рычаг решётки.
   Бой: рука, нога, подсечка (↓+нога), бросок (↑+рука), метательные предметы (одно в руке). */
(function (global) {
  'use strict';
  var LZ = global.LZ = global.LZ || {};
  var M = LZ.MAP, T = M.T, SW = M.SW, SH = M.SH, C = M.C;
  var K = {
    HW: 8, HH: 56, HC: 34, WALK: 86, RUN: 170, SNEAK: 46, CLIMB: 100, G: 1500, VMAX: 760, LIFT: 180, CART: 440,
    HP: 10, EN: 100, EN_RUN: 13, EN_REG: 11, EN_REG_C: 24, HATCH: 0.45, PLANT: 1.2, SIGHT: 230,
    N_RUN: 150, N_LAND: 210, N_HATCH: 240, N_HIT: 160, N_ITEM: 230, STEP_RUN: 0.3, ALARM: 16, DEAD: 1.6, INV: 0.7
  };
  var ATK = { // время замаха, удара, отката; дальность; урон; энергия
    punch: { wind: 0.08, act: 0.08, rec: 0.14, reach: 34, dmg: 1, en: 5 },
    kick: { wind: 0.15, act: 0.1, rec: 0.22, reach: 44, dmg: 2, en: 9 },
    sweep: { wind: 0.12, act: 0.1, rec: 0.3, reach: 42, dmg: 1, en: 12 },
    grab: { wind: 0.22, act: 0.08, rec: 0.3, reach: 30, dmg: 3, en: 15 },
    toss: { wind: 0.1, act: 0.02, rec: 0.18, reach: 0, dmg: 0, en: 5 }
  };
  var KINDS = {
    boxer: { hp: 5, spd: 44, chase: 96, reach: 36, wind: 0.28, rec: 0.42, cd: 0.95, dmg: 1, high: true, pts: 150 },
    heavy: { hp: 8, spd: 34, chase: 72, reach: 46, wind: 0.55, rec: 0.6, cd: 1.35, dmg: 2, pts: 250 },
    thrower: { hp: 3, spd: 46, chase: 82, reach: 32, wind: 0.32, rec: 0.4, cd: 1.6, dmg: 1, high: true, pts: 200, range: 190 },
    dog: { hp: 3, spd: 74, chase: 150, reach: 32, wind: 0.2, rec: 0.38, cd: 0.75, dmg: 1, low: true, pts: 200, sight: 0.55, ear: 1.5 }
  };
  var ITEMS = { wrench: { dmg: 2, vx: 420, vy: -150, g: 720, melee: 1 }, brick: { dmg: 3, vx: 340, vy: -180, g: 820 }, crowbar: { dmg: 3, vx: 360, vy: -130, g: 760, melee: 1 }, washer: { dmg: 2, vx: 580, vy: 0, g: 0 } };
  // сложности: время будильника, попытки, урон по герою, дальность взгляда, скорость подозрения, скорость стражи, здоровье стражи, блок, перезарядка
  var DIFF = [
    { key: 'd1', timer: 200, lives: 5, dmg: 0.55, see: 0.85, susp: 0.7, spd: 0.9, hp: 0.7, block: 0.15, cd: 1.5, wind: 1.25, stun: 0.26, alarm: 12 },
    { key: 'd2', timer: 160, lives: 4, dmg: 0.9, see: 0.95, susp: 0.9, spd: 1, hp: 0.9, block: 0.3, cd: 1.2, wind: 1.1, stun: 0.24, alarm: 15 },
    { key: 'd3', timer: 125, lives: 3, dmg: 1.25, see: 1, susp: 1.1, spd: 1.05, hp: 1.1, block: 0.45, cd: 1, wind: 0.95, stun: 0.22, alarm: 18 },
    { key: 'd4', timer: 100, lives: 3, dmg: 1.25, see: 1.1, susp: 1.35, spd: 1.12, hp: 1.3, block: 0.55, cd: 0.85, wind: 0.85, stun: 0.19, alarm: 21 },
    { key: 'd5', timer: 80, lives: 3, dmg: 1.4, see: 1.2, susp: 1.6, spd: 1.2, hp: 1.3, block: 0.55, cd: 0.8, wind: 0.8, stun: 0.16, alarm: 25 }
  ];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function noop() {}
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- мир: клетки + состояние дверей/люков/створок, лифты, дрезина ----------
  function World(map) {
    var Wd = { map: map, W: map.W, H: map.H, t: map.t, open: new Uint8Array(map.W * map.H), shut: false, keys: {}, cart: { x: map.cart.b, to: null }, lifts: map.lifts.map(function (l) { return { y: l.stops[0] * T }; }), hatchT: {} };
    Wd.tile = function (x, y) { return (x < 0 || y < 0 || x >= Wd.W || y >= Wd.H) ? C.S : Wd.t[y * Wd.W + x]; };
    Wd.solid = function (x, y) {
      var v = Wd.tile(x, y);
      if (v === C.S || v === C.V) return true;
      if (v === C.D || v === C.O || v === C.H) return !Wd.open[y * Wd.W + x];
      if (v === C.G) return Wd.shut;
      return false;
    };
    Wd.support = function (x, y) {
      if (Wd.solid(x, y)) return true;
      if (Wd.tile(x, y) === C.L) return Wd.tile(x, y - 1) !== C.L || Wd.landing(x, y);
      return false;
    };
    Wd.landing = function (x, y) { // площадка на лестнице: рядом пол, над ним свободно
      if (Wd.tile(x, y) !== C.L) return false;
      return (Wd.solid(x - 1, y) && !Wd.solid(x - 1, y - 1)) || (Wd.solid(x + 1, y) && !Wd.solid(x + 1, y - 1));
    };
    Wd.openCol = function (x, code) { for (var y = 0; y < Wd.H; y++) if (Wd.tile(x, y) === code) Wd.open[y * Wd.W + x] = 1; };
    Wd.doorAt = function (x) { for (var i = 0; i < map.doors.length; i++) if (map.doors[i].tx === x) return map.doors[i]; return null; };
    return Wd;
  }
  function worldStep(Wd, dt) {
    var c = Wd.cart;
    if (c.to != null && !c.carry) { var d = c.to - c.x, s = K.CART * dt; if (Math.abs(d) <= s) { c.x = c.to; c.to = null; } else c.x += Math.sign(d) * s; }
    for (var k in Wd.hatchT) { Wd.hatchT[k] -= dt; if (Wd.hatchT[k] <= 0) { Wd.open[+k] = 0; delete Wd.hatchT[k]; } }
  }

  // ---------- герой ----------
  function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, face: 1, ground: true, crouch: false, climb: false, ride: null, atk: null, hurtT: 0, inv: 0, kb: 0, hp: K.HP, en: K.EN, held: null, running: false, fallFrom: y, hatchT: 0, t: 0, dead: false, stepAcc: 0, flash: false }; }
  function hh(P) { return P.crouch ? K.HC : K.HH; }
  function bodySolid(Wd, x, P) { var tx = Math.floor(x / T), r0 = Math.floor((P.y - hh(P) + 1) / T), r1 = Math.floor((P.y - 1) / T); for (var r = r0; r <= r1; r++) if (Wd.solid(tx, r)) return { tx: tx, ty: r }; return null; }
  function moveX(Wd, P, dx, cb) {
    if (!dx) return false;
    var nx = P.x + dx, edge = dx > 0 ? nx + K.HW : nx - K.HW, hit = bodySolid(Wd, edge, P);
    if (hit) {
      var v = Wd.tile(hit.tx, hit.ty);
      if (v === C.D) {
        var d = Wd.doorAt(hit.tx);
        if (d && Wd.keys[d.color]) { Wd.openCol(hit.tx, C.D); cb('door', { color: d.color, x: hit.tx * T + 16, y: P.y }); P.x = nx; return false; }
        if (d) cb('locked', { color: d.color });
      } else if (v === C.O) cb('grateLocked', {});
      P.x = dx > 0 ? hit.tx * T - K.HW - 0.01 : (hit.tx + 1) * T + K.HW + 0.01;
      return true;
    }
    P.x = nx; return false;
  }
  function supported(Wd, P) {
    var r = Math.round(P.y / T); if (Math.abs(P.y - r * T) > 0.5) return false;
    var a = Math.floor((P.x - K.HW) / T), b = Math.floor((P.x + K.HW - 0.01) / T);
    for (var x = a; x <= b; x++) if (Wd.support(x, r)) return true;
    return false;
  }
  function padUnder(Wd, P) {
    var r = Math.round(P.y / T), tx = Math.floor(P.x / T);
    if (Wd.tile(tx, r) !== C.V) return null;
    var L = Wd.map.lifts;
    for (var i = 0; i < L.length; i++) if (tx === L[i].tx || tx === L[i].tx + 1) { var si = L[i].stops.indexOf(r); if (si >= 0) return { lift: L[i], si: si }; }
    return null;
  }
  function hatchUnder(Wd, P) { var r = Math.round(P.y / T), tx = Math.floor(P.x / T); return Wd.tile(tx, r) === C.H && !Wd.open[r * Wd.W + tx] && Math.abs(P.x - (tx * T + 16)) < 12 ? r * Wd.W + tx : -1; }
  function station(Wd, P) {
    var c = Wd.map.cart; if (Math.abs(P.y - c.y) > 2) return null;
    if (Math.abs(P.x - c.a) < 30) return 'a'; if (Math.abs(P.x - c.b) < 30) return 'b'; return null;
  }
  function grateEast(Wd, P) {
    var G = Wd.map.grates; for (var i = 0; i < G.length; i++) { var g = G[i]; if (Wd.open[g.r0 * Wd.W + g.tx]) continue; if (Math.abs(P.y - (g.r1 + 1) * T) < 2 && P.x > (g.tx + 1) * T && P.x < (g.tx + 1) * T + 44) return g; }
    return null;
  }
  // I: { dx, dy, run, upP, downP }
  function heroStep(Wd, P, I, dt, cb) {
    cb = cb || noop; P.t += dt;
    if (P.dead) return;
    if (P.inv > 0) P.inv -= dt;
    if (P.ride) { rideStep(Wd, P, dt, cb); return; }
    if (P.atk) { P.atk.t += dt; if (P.atk.t >= P.atk.dur) P.atk = null; }
    if (P.hurtT > 0) P.hurtT -= dt;
    var dx = I.dx | 0, dy = I.dy | 0, busy = !!P.atk || P.hurtT > 0;
    var tx = Math.floor(P.x / T);
    if (P.climb) { climbStep(Wd, P, dx, dy, dt, cb); P.en = Math.min(K.EN, P.en + K.EN_REG * 0.5 * dt); return; }
    if (P.ground) {
      var r = Math.round(P.y / T), pad = padUnder(Wd, P);
      if (!busy && dy < 0 && Wd.tile(tx, Math.floor((P.y - 6) / T)) === C.L && Math.abs(P.x - (tx * T + 16)) < 14) { P.climb = true; P.crouch = false; P.x = tx * T + 16; P.vx = 0; cb('climb', {}); return; }
      if (!busy && dy > 0 && !pad && Wd.tile(tx, r) === C.L && Math.abs(P.x - (tx * T + 16)) < 14) { P.climb = true; P.crouch = false; P.x = tx * T + 16; P.y += 2; cb('climb', {}); return; }
      if (!busy && pad && (I.upP || I.downP)) {
        var ns = pad.si + (I.upP ? -1 : 1);
        if (ns >= 0 && ns < pad.lift.stops.length) { P.ride = { k: 'lift', lift: pad.lift, y1: pad.lift.stops[ns] * T }; P.x = pad.lift.x; P.crouch = false; cb('lift', {}); return; }
        cb('liftEnd', {});
      }
      if (!busy && I.upP) {
        var st = station(Wd, P);
        if (st) {
          var c = Wd.cart, here = Wd.map.cart[st], there = Wd.map.cart[st === 'a' ? 'b' : 'a'];
          if (Math.abs(c.x - here) < 2 && c.to == null) { P.ride = { k: 'cart', x1: there }; P.x = here; P.crouch = false; c.carry = true; cb('cart', {}); return; }
          if (c.to == null) { c.to = here; cb('cartCall', {}); }
        }
        var gr = grateEast(Wd, P);
        if (gr) { Wd.openCol(gr.tx, C.O); cb('grate', { x: gr.tx * T + 16, y: P.y }); }
      }
      var wantC = (dy > 0 || (P.atk && P.atk.k === 'sweep')) && !pad && !(P.atk && P.atk.k === 'grab');
      if (wantC !== P.crouch) { if (wantC || !bodySolid(Wd, P.x, { y: P.y, crouch: false })) P.crouch = wantC; }
      var hi = P.crouch ? hatchUnder(Wd, P) : -1;
      if (hi >= 0 && !busy) { P.hatchT += dt; if (P.hatchT >= K.HATCH) { Wd.open[hi] = 1; Wd.hatchT[hi] = 1.4; P.hatchT = 0; P.hatchFall = true; cb('hatch', { x: P.x, y: P.y }); } }
      else P.hatchT = 0;
      var sp = 0; P.running = false;
      if (!busy && dx) { P.face = dx; if (P.crouch) sp = K.SNEAK; else if (I.run && P.en > 3) { sp = K.RUN; P.running = true; } else sp = K.WALK; }
      var vx = P.hurtT > 0 ? P.kb : dx * sp;
      if (P.atk) vx = 0;
      moveX(Wd, P, vx * dt, cb); P.vx = vx;
      if (P.running) { P.en = Math.max(0, P.en - K.EN_RUN * dt); P.stepAcc += dt; if (P.stepAcc >= K.STEP_RUN) { P.stepAcc = 0; cb('step', { x: P.x, y: P.y }); } }
      else { P.stepAcc = K.STEP_RUN * 0.6; P.en = Math.min(K.EN, P.en + (P.crouch ? K.EN_REG_C : K.EN_REG) * dt); }
      if (!supported(Wd, P)) { P.ground = false; P.vy = 0; P.fallFrom = P.y; P.crouch = false; P.atk = null; if (!P.hatchFall) P.vx = P.vx || P.face * 40; else P.vx = 0; }
    } else {
      P.vy = Math.min(P.vy + K.G * dt, K.VMAX);
      moveX(Wd, P, P.vx * dt, cb);
      var y0 = P.y, y1 = P.y + P.vy * dt, landed = false;
      for (var rr = Math.ceil(y0 / T - 1e-6); rr * T <= y1; rr++) {
        if (rr * T < y0 - 1e-6) continue;
        var a = Math.floor((P.x - K.HW) / T), b = Math.floor((P.x + K.HW - 0.01) / T), ok = false;
        for (var xx = a; xx <= b; xx++) if (Wd.support(xx, rr) && !(Wd.tile(xx, rr) === C.L && Wd.tile(xx, rr - 1) === C.L && !Wd.landing(xx, rr))) ok = true;
        if (ok) { P.y = rr * T; landed = true; break; }
      }
      if (!landed) P.y = y1;
      else {
        var h = P.y - P.fallFrom; P.ground = true; P.vy = 0; P.vx = 0;
        cb('land', { h: h, hatch: !!P.hatchFall, x: P.x, y: P.y }); P.hatchFall = false;
      }
    }
  }
  function climbStep(Wd, P, dx, dy, dt, cb) {
    var tx = Math.floor(P.x / T);
    if (dx && !dy) {
      var r = Math.round(P.y / T);
      if (Math.abs(P.y - r * T) < 6 && Wd.support(tx + dx, r) && !Wd.solid(tx + dx, r - 1) && !Wd.solid(tx + dx, r - 2)) { P.y = r * T; P.climb = false; P.ground = true; P.face = dx; return; }
      if (Math.abs(P.y - r * T) < 6 && Wd.support(tx, r) && Wd.tile(tx, r) !== C.L) { P.y = r * T; P.climb = false; P.ground = true; P.face = dx; return; }
    }
    if (!dy) return;
    P.y += dy * K.CLIMB * dt;
    if (dy < 0) {
      var rf = Math.floor((P.y - 0.01) / T);
      if (Wd.tile(tx, rf) !== C.L) { P.y = (rf + 1) * T; P.climb = false; P.ground = true; }
    } else {
      var rb = Math.floor(P.y / T);
      if (Wd.tile(tx, rb) !== C.L) {
        if (Wd.support(tx, rb)) { P.y = rb * T; P.climb = false; P.ground = true; }
        else { P.climb = false; P.ground = false; P.vy = 0; P.vx = 0; P.fallFrom = P.y; }
      }
    }
  }
  function rideStep(Wd, P, dt, cb) {
    var R = P.ride;
    if (R.k === 'lift') {
      var d = R.y1 - P.y, s = K.LIFT * dt;
      if (Math.abs(d) <= s) { P.y = R.y1; P.ride = null; P.ground = true; cb('liftStop', {}); } else P.y += Math.sign(d) * s;
      Wd.lifts[R.lift.id].y = P.y;
    } else {
      var d2 = R.x1 - P.x, s2 = K.CART * dt;
      if (Math.abs(d2) <= s2) { P.x = R.x1; P.ride = null; Wd.cart.carry = false; cb('cartStop', {}); } else P.x += Math.sign(d2) * s2;
      Wd.cart.x = P.x;
    }
  }

  // ---------- зрение, свет, тень ----------
  function scrOf(x, y) { return { X: Math.floor(x / (SW * T)), Y: Math.floor((y - 20) / (SH * T)) }; }
  function sameScr(a, b) { var A = scrOf(a.x, a.y), B = scrOf(b.x, b.y); return A.X === B.X && A.Y === B.Y; }
  function screenAt(map, x, y) { var s = scrOf(x, y); return map.screens[s.Y * M.CX + s.X] || null; }
  function isLit(map, P) {
    var s = screenAt(map, P.x, P.y); if (!s) return false;
    if (!s.dark) return true;
    if (P.flash) return true;
    for (var i = 0; i < map.pools.length; i++) { var p = map.pools[i]; if (P.x >= p.x0 && P.x <= p.x1 && Math.abs(P.y - p.y) < 4) return true; }
    return false;
  }
  function inShadow(map, P) { for (var i = 0; i < map.shadows.length; i++) { var s = map.shadows[i]; if (P.x >= s.x0 && P.x <= s.x1 && Math.abs(P.y - s.y) < 4) return true; } return false; }
  function hidden(map, P) { return P.crouch && P.ground && inShadow(map, P); }
  function los(Wd, x0, y0, x1, y1) { var n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8); for (var i = 1; i < n; i++) { var x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (Wd.solid(Math.floor(x / T), Math.floor(y / T))) return false; } return true; }
  function sightRange(S, e, P) {
    var r = K.SIGHT * S.D.see * (KINDS[e.k].sight || 1);
    if (!isLit(S.map, P)) r *= 0.42;
    if (P.crouch) r *= 0.8;
    if (S.alarmT > 0 || S.phase === 'out') r *= 1.2;
    return r;
  }
  function eyeY(e) { return e.y - (e.k === 'dog' ? 20 : 46); }
  function canSee(S, e, P) {
    if (e.out || e.sleep || e.down > 0 || P.dead) return false;
    if (!sameScr(e, P)) return false;
    var dxs = (P.x - e.x) * e.face, dy = P.y - e.y, range = sightRange(S, e, P);
    if (dxs < -4 || dxs > range) return false;
    if (Math.abs(dy) > 20 + Math.max(0, dxs) * 0.32) return false;
    if (hidden(S.map, P) && !(e.st === 'chase' && S.time - e.seenT < 0.5)) return false;
    return los(S.wd, e.x, eyeY(e), P.x, P.y - (P.crouch ? 20 : 38));
  }

  // ---------- партия ----------
  function Game(opts) {
    opts = opts || {};
    var diff = clamp(opts.diff | 0 || 1, 1, 5), D = DIFF[diff - 1], rng = opts.rng || mulberry32(7), onEvent = opts.onEvent || noop;
    var S = null, inp = { dx: 0, dy: 0, run: false }, prevDy = 0, queued = [];
    function ev(t, d) { onEvent(t, d || {}); }
    function mkEnemy(g) {
      var kd = KINDS[g.k], hp = Math.max(1, Math.round(kd.hp * D.hp));
      return { k: g.k, x: g.x, y: g.y, sx: g.x, face: g.face, hp: hp, max: hp, st: g.sleep ? 'sleep' : 'patrol', sleep: g.sleep, p0: g.p0, p1: g.p1, b0: g.b0, b1: g.b1,
        wait: 0, susp: 0, seenT: -9, lx: g.x, lookT: 0, atk: null, cd: 0.6, stun: 0, down: 0, out: false, id: g.id, X: g.X, Y: g.Y, t: rng() * 3 };
    }
    function start() {
      var map = M.build(diff), wd = World(map);
      S = { diff: diff, D: D, map: map, wd: wd, hero: newHero(map.start.x, map.start.y), enemies: map.guards.map(mkEnemy),
        items: map.items.map(function (it) { return Object.assign({}, it); }), proj: [], phase: 'in', time: 0, bombT: 0, alarmT: 0,
        cards: wd.keys, matrix: false, planted: false, lives: D.lives, score: 0, kos: 0, takedowns: 0, alarms: 0, deaths: 0,
        seen: new Uint8Array(M.CX * M.CY), over: false, won: false, cp: { x: map.start.x, y: map.start.y }, scr: '', plantT: 0, msgT: {}, lose: null };
      S.hero.face = 1; enterScreen(); return api;
    }
    function heroScr() { var s = scrOf(S.hero.x, S.hero.y); return s.X + ',' + s.Y; }
    function enterScreen() { S.scr = heroScr(); S.cpPending = true; var sc = scrOf(S.hero.x, S.hero.y); if (sc.X >= 0 && sc.Y >= 0 && sc.X < M.CX && sc.Y < M.CY) S.seen[sc.Y * M.CX + sc.X] = 1; }
    function msg(k, d, gap) { if ((S.msgT[k] || -9) > S.time - (gap || 1.5)) return; S.msgT[k] = S.time; ev(k, d); }
    function noise(x, y, r, src) {
      ev('noise', { x: x, y: y, r: r, src: src });
      var hs = scrOf(x, y);
      S.enemies.forEach(function (e) {
        if (e.out) return;
        var es = scrOf(e.x, e.y); if (es.Y !== hs.Y || Math.abs(es.X - hs.X) > 1) return;
        var rr = r * (KINDS[e.k].ear || 1); if (Math.hypot(e.x - x, (e.y - y) * 1.6) > rr) return;
        if (e.st === 'chase') return;
        if (e.sleep) { e.sleep = false; ev('wake', { x: e.x, y: e.y }); }
        e.st = 'look'; e.lx = clamp(x, e.b0, e.b1); e.lookT = 3.2; e.wait = 0; e.face = x > e.x ? 1 : -1;
        ev('hear', { x: e.x, y: e.y });
      });
    }
    function raiseAlarm(src) {
      if (S.alarmT <= 0) { S.alarms++; ev('alarm', { x: src ? src.x : S.hero.x, y: src ? src.y : S.hero.y }); }
      S.alarmT = D.alarm;
      S.enemies.forEach(function (e) { if (!e.out && sameScr(e, S.hero) && e.st !== 'chase') { e.sleep = false; e.st = 'chase'; e.seenT = S.time; e.lx = S.hero.x; } });
    }
    function hurtHero(dmg, from) {
      var P = S.hero; if (P.inv > 0 || P.dead || opts.god) return;
      P.hp -= dmg * D.dmg; P.inv = K.INV; P.hurtT = 0.22; P.kb = (P.x >= from.x ? 1 : -1) * 120; P.atk = null;
      ev('hurt', { x: P.x, y: P.y });
      if (P.hp <= 0) { P.hp = 0; P.dead = true; P.deadT = 0; P.ride = null; S.deaths++; ev('die', { x: P.x, y: P.y }); }
    }
    function ko(e, how) {
      e.out = true; e.atk = null; e.st = 'out'; S.kos++; if (how === 'takedown') S.takedowns++;
      var pts = KINDS[e.k].pts * (how === 'takedown' ? 2 : 1); S.score += pts;
      ev('ko', { x: e.x, y: e.y, k: e.k, how: how, pts: pts });
    }
    function aware(e) { return e.st === 'chase' || e.susp > 0.6; }
    function hitEnemy(e, kind, dmg, dir) {
      var P = S.hero, behind = (P.x - e.x) * e.face < 0 || kind === 'proj' && dir * e.face > 0;
      if (!aware(e) && (behind || e.sleep || e.down > 0) && kind !== 'proj') { ko(e, 'takedown'); return; }
      if (e.k === 'dog' && kind === 'punch' && !P.crouch) { ev('whiff', { x: e.x, y: e.y }); return; }
      if (e.k === 'heavy' && kind === 'grab') { ev('tooHeavy', { x: e.x, y: e.y }); return; }
      if (e.k === 'boxer' && (kind === 'punch' || kind === 'kick') && !behind && !e.atk && e.down <= 0 && e.stun <= 0 && rng() < D.block * (kind === 'kick' ? 0.5 : 1)) { ev('block', { x: e.x, y: e.y }); e.st = 'chase'; e.seenT = S.time; raiseAlarm(e); return; }
      if (kind === 'proj' && !aware(e)) dmg *= 2;
      if (e.k === 'heavy' && kind === 'punch') dmg *= 0.5;
      e.hp -= dmg; e.sleep = false; if (kind !== 'punch' || e.k !== 'heavy') e.atk = null;
      if (kind === 'sweep' || kind === 'grab') { e.down = kind === 'grab' ? 1.5 : 1.25; if (kind === 'grab') { var nx = P.x - P.face * 34; e.x = clamp(nx, e.b0, e.b1); e.face = -e.face; } }
      else if (!(e.k === 'heavy' && kind === 'punch')) { e.stun = D.stun; e.atk = null; e.x = clamp(e.x + (e.x >= P.x ? 1 : -1) * 10, e.b0, e.b1); }
      e.cd = Math.min(e.cd, 0.12 + 0.3 * D.cd * rng());   // контратака
      ev('hit', { x: e.x, y: e.y - 30, kind: kind });
      noise(e.x, e.y, K.N_HIT, 'fight');
      if (e.hp <= 0) { ko(e, 'beat'); return; }
      e.st = 'chase'; e.seenT = S.time; e.lx = P.x; raiseAlarm(e);
    }
    function resolveAttack() {
      var P = S.hero, A = P.atk, def = ATK[A.k];
      if (A.k === 'toss') { throwItem(); return; }
      var best = null, bd = 1e9;
      S.enemies.forEach(function (e) {
        if (e.out) return;
        var dxs = (e.x - P.x) * P.face; if (dxs < -6 || dxs > def.reach + (e.k === 'heavy' ? 6 : 0)) return;
        if (Math.abs(e.y - P.y) > 24) return;
        if (dxs < bd) { bd = dxs; best = e; }
      });
      if (!best) { ev('swing', { k: A.k }); return; }
      var dmg = def.dmg + (A.k === 'punch' && P.held && ITEMS[P.held].melee ? 1 : 0);
      hitEnemy(best, A.k, dmg, P.face);
    }
    function throwItem() {
      var P = S.hero, it = ITEMS[P.held]; if (!it) return;
      S.proj.push({ k: P.held, x: P.x + P.face * 12, y: P.y - (P.crouch ? 22 : 38), vx: P.face * it.vx, vy: it.vy, g: it.g, dmg: it.dmg, from: 'hero', life: 3 });
      ev('toss', { k: P.held }); P.held = null;
    }
    function press(a) {
      if (!S || S.over) return;
      var P = S.hero;
      if (a === 'flash') { P.flash = !P.flash; ev('flash', { on: P.flash }); return; }
      if (P.dead || P.ride || P.climb || !P.ground || P.atk || P.hurtT > 0) return;
      if (a === 'item') {
        if (P.held) { startAtk('toss'); return; }
        var best = null, bd = 26;
        S.items.forEach(function (it) { if (!ITEMS[it.k] || it.taken) return; var d = Math.abs(it.x - P.x); if (d < bd && Math.abs(it.y - P.y) < 6) { bd = d; best = it; } });
        if (best) { best.taken = true; P.held = best.k; ev('pick', { k: best.k, x: best.x, y: best.y }); } else msg('noItem', {}, 1);
        return;
      }
      if (a === 'punch') { startAtk(inp.dy < 0 ? 'grab' : 'punch'); return; }
      if (a === 'kick') { startAtk(P.crouch || inp.dy > 0 ? 'sweep' : 'kick'); return; }
    }
    function startAtk(k) {
      var P = S.hero, def = ATK[k];
      if (k === 'grab') { // бросок — только вплотную; иначе обычный удар
        var near = S.enemies.some(function (e) { return !e.out && Math.abs(e.y - P.y) < 20 && (e.x - P.x) * P.face > -6 && (e.x - P.x) * P.face < def.reach; });
        if (!near) { k = 'punch'; def = ATK.punch; }
      }
      if (P.en < def.en) { msg('tired', { x: P.x, y: P.y }, 1); return; }
      P.en -= def.en; P.atk = { k: k, t: 0, dur: def.wind + def.act + def.rec, done: false };
      if (k === 'sweep') P.crouch = true;
      ev('atk', { k: k });
    }
    function setInput(dx, dy, run) {
      if (typeof dx === 'object') { inp = { dx: dx.dx | 0, dy: dx.dy | 0, run: !!dx.run }; return; }
      inp = { dx: dx | 0, dy: dy | 0, run: !!run };
    }
    function heroEvent(t, d) {
      var P = S.hero;
      if (t === 'step') noise(d.x, d.y, K.N_RUN, 'step');
      else if (t === 'land') {
        if (d.hatch) noise(d.x, d.y, K.N_HATCH, 'land');
        else if (d.h > 2.6 * T) { noise(d.x, d.y, K.N_LAND, 'land'); if (d.h > 5.5 * T) hurtHero(1 / D.dmg, { x: P.x - P.face }); }
      }
      ev(t, d);
    }
    function enemyStep(e, dt) {
      var kd = KINDS[e.k], P = S.hero, onScr = sameScr(e, P), mul = D.spd * (S.alarmT > 0 || S.phase === 'out' ? 1.3 : 1);
      e.t += dt;
      if (e.cd > 0) e.cd -= dt;
      if (e.stun > 0) { e.stun -= dt; return; }
      if (e.down > 0) { e.down -= dt; return; }
      if (!onScr) { // вне экрана героя — только обход
        if (e.st !== 'sleep') { e.st = e.sleep ? 'sleep' : 'patrol'; e.susp = 0; e.atk = null; patrol(e, kd, dt, mul); }
        return;
      }
      // восприятие
      var see = canSee(S, e, P);
      if (see) {
        var dxs = Math.abs(P.x - e.x), fill = (0.35 + 1.1 * dxs / sightRange(S, e, P)) / D.susp;
        if (e.st === 'chase') e.susp = 1; else e.susp = Math.min(1, e.susp + dt / fill);
        e.seenT = S.time; e.lx = P.x;
        if (e.susp >= 1 && e.st !== 'chase') { e.st = 'chase'; ev('spot', { x: e.x, y: e.y }); raiseAlarm(e); }
        if (e.st === 'chase') S.alarmT = Math.max(S.alarmT, D.alarm);
      } else if (e.st !== 'chase') e.susp = Math.max(0, e.susp - dt * 0.35);
      if (e.st === 'sleep') return;
      // атака в процессе
      if (e.atk) {
        e.atk.t += dt;
        if (!e.atk.done && e.atk.t >= kd.wind * D.wind) {
          e.atk.done = true;
          if (e.atk.k === 'nut') { S.proj.push({ k: 'nut', x: e.x + e.face * 10, y: e.y - 44, vx: e.face * 300, vy: -60, g: 260, dmg: 1, from: 'enemy', life: 2 }); ev('nutThrow', { x: e.x, y: e.y }); }
          else {
            var dxs2 = (P.x - e.x) * e.face;
            if (!P.dead && !P.ride && P.ground && dxs2 > -8 && dxs2 < kd.reach + 8 && Math.abs(P.y - e.y) < 26) {
              if (kd.high && P.crouch) ev('duck', { x: P.x, y: P.y }); else hurtHero(kd.dmg, e);
            } else ev('eswing', { k: e.k });
          }
        }
        if (e.atk.t >= kd.wind * D.wind + 0.1 + kd.rec) { e.atk = null; e.cd = kd.cd * D.cd * (0.85 + rng() * 0.3); }
        return;
      }
      if (e.st === 'chase') {
        var dx = P.x - e.x, sameLv = Math.abs(P.y - e.y) < 26 && P.ground && !P.climb, adx = Math.abs(dx);
        if (S.time - e.seenT > 4 && !see) { e.st = 'look'; e.lookT = 2.5; e.susp = 0.5; return; }
        if (sameLv) e.face = dx > 0 ? 1 : -1;
        var tx = sameLv ? P.x : e.lx;
        if (e.k === 'thrower' && sameLv && adx > 70) {
          if (e.cd <= 0 && see) { e.atk = { k: 'nut', t: 0 }; return; }
          if (adx < 130) tx = e.x - Math.sign(dx) * 40; else if (adx < kd.range) tx = e.x;
        }
        if (sameLv && adx <= kd.reach && e.cd <= 0 && !P.dead) { e.atk = { k: 'hit', t: 0 }; return; }
        var want = tx - e.x, sp = kd.chase * mul * dt;
        if (sameLv && adx < kd.reach * 0.7) want = 0;
        if (Math.abs(want) > 2) { e.x = clamp(e.x + Math.sign(want) * Math.min(sp, Math.abs(want)), e.b0, e.b1); if (!sameLv) e.face = want > 0 ? 1 : -1; }
        return;
      }
      if (e.st === 'look') {
        var w = e.lx - e.x;
        if (Math.abs(w) > 4) { e.face = w > 0 ? 1 : -1; e.x = clamp(e.x + e.face * kd.spd * 1.4 * mul * dt, e.b0, e.b1); if (e.x === e.b0 || e.x === e.b1) e.lx = e.x; }
        else { e.lookT -= dt; if (Math.floor(e.lookT / 0.9) !== Math.floor((e.lookT + dt) / 0.9)) e.face = -e.face; if (e.lookT <= 0) { e.st = 'patrol'; e.susp = 0; } }
        if (e.susp > 0.3) { e.face = P.x > e.x ? 1 : -1; }
        return;
      }
      // обход; при подозрении — замереть и смотреть
      if (e.susp > 0.25 && see) { e.face = P.x > e.x ? 1 : -1; return; }
      if (e.susp > 0.25 && !see) { e.st = 'look'; e.lookT = 2.4; return; }
      patrol(e, kd, dt, mul);
    }
    function patrol(e, kd, dt, mul) {
      if (e.st === 'sleep') return;
      if (e.wait > 0) { e.wait -= dt; if (e.wait <= 0) e.face = -e.face; return; }
      e.x += e.face * kd.spd * mul * dt;
      if (e.x <= e.p0 && e.face < 0) { e.x = e.p0; e.wait = (1 + rng() * 0.8) / (diff >= 5 ? 1.5 : 1); }
      else if (e.x >= e.p1 && e.face > 0) { e.x = e.p1; e.wait = (1 + rng() * 0.8) / (diff >= 5 ? 1.5 : 1); }
      if (e.x < e.p0 - 1 || e.x > e.p1 + 1) e.face = e.x < e.p0 ? 1 : -1;
    }
    function dropItemAt(k, x, y) {
      var Wd = S.wd, tx = Math.floor(x / T), r = Math.max(0, Math.floor(y / T));
      while (r < Wd.H && !Wd.support(tx, r)) r++;
      if (Wd.solid(tx, r - 1)) { x -= Math.sign(x - tx * T - 16 || 1) * 20; tx = Math.floor(x / T); }
      S.items.push({ k: k, x: x, y: r * T });
    }
    function projStep(p, dt) {
      var Wd = S.wd, P = S.hero;
      p.life -= dt; p.vy += p.g * dt;
      var nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (p.from === 'hero') {
        for (var i = 0; i < S.enemies.length; i++) {
          var e = S.enemies[i]; if (e.out) continue;
          var top = e.y - (e.k === 'dog' ? 30 : e.k === 'heavy' ? 66 : 60);
          if (Math.abs(nx - e.x) < 14 && ny > top && ny < e.y && e.down <= 0) { hitEnemy(e, 'proj', p.dmg, Math.sign(p.vx)); dropItemAt(p.k, e.x, ny); p.dead = true; return; }
        }
      } else if (!P.dead && !P.ride) {
        var htop = P.y - (P.crouch ? K.HC : K.HH);
        if (Math.abs(nx - P.x) < 10 && ny > htop && ny < P.y) { hurtHero(p.dmg, { x: p.x - p.vx }); p.dead = true; ev('nutHit', { x: nx, y: ny }); return; }
      }
      if (Wd.solid(Math.floor(nx / T), Math.floor(ny / T)) || p.life <= 0 || !sameScr({ x: nx, y: ny + 20 }, { x: p.x, y: p.y + 20 })) {
        p.dead = true;
        if (p.from === 'hero') { noise(p.x, p.y, K.N_ITEM, 'item'); ev('clang', { x: p.x, y: p.y, k: p.k }); dropItemAt(p.k, p.x - Math.sign(p.vx) * 6, p.y); }
        return;
      }
      p.x = nx; p.y = ny;
    }
    function respawn() {
      var P = S.hero, cp = S.cp;
      var nh = newHero(cp.x, cp.y); nh.face = P.face; nh.held = P.held; nh.flash = P.flash; S.hero = nh;
      S.proj = [];
      if (S.phase === 'in') S.alarmT = 0;
      S.enemies.forEach(function (e) { if (!e.out && sameScr(e, nh)) { e.st = e.sleep ? 'sleep' : 'patrol'; e.susp = 0; e.atk = null; e.x = clamp(e.sx, e.b0, e.b1); e.stun = e.down = 0; } });
      enterScreen(); S.cpPending = false;
      ev('respawn', {});
    }
    function update(dt) {
      if (!S || S.over) return;
      var P = S.hero, Wd = S.wd;
      S.time += dt;
      worldStep(Wd, dt);
      // ввод героя
      var dy = inp.dy, I = { dx: inp.dx, dy: dy, run: inp.run, upP: dy < 0 && prevDy >= 0, downP: dy > 0 && prevDy <= 0 };
      prevDy = dy;
      if (P.dead) {
        P.deadT += dt;
        if (P.deadT >= K.DEAD) {
          S.lives--;
          if (S.lives <= 0) { S.over = true; S.phase = 'lost'; S.lose = 'caught'; ev('gameover', { why: 'caught' }); return; }
          respawn(); P = S.hero;
        }
      } else {
        heroStep(Wd, P, I, dt, heroEvent);
        if (P.atk && !P.atk.done && P.atk.t >= ATK[P.atk.k].wind) { P.atk.done = true; resolveAttack(); }
      }
      // смена экрана, контрольная точка
      if (heroScr() !== S.scr) { enterScreen(); ev('screen', { scr: S.scr }); }
      if (S.cpPending && P.ground && !P.dead && !P.ride) { S.cp = { x: P.x, y: P.y }; S.cpPending = false; }
      // подбор
      if (!P.dead) S.items.forEach(function (it) {
        if (it.taken || Math.abs(it.x - P.x) > 18 || Math.abs(it.y - P.y) > 8) return;
        if (it.k === 'thermos') { if (P.hp < K.HP) { it.taken = true; P.hp = Math.min(K.HP, P.hp + 4); P.en = Math.min(K.EN, P.en + 30); ev('thermos', { x: it.x, y: it.y }); } }
        else if (it.k === 'card') { it.taken = true; S.cards[it.color] = true; S.score += 100; ev('card', { color: it.color, x: it.x, y: it.y }); }
        else if (it.k === 'matrix') { it.taken = true; S.matrix = true; S.score += 1000; ev('matrix', { x: it.x, y: it.y }); }
      });
      // закладка будильника
      var pl = S.map.plant;
      if (!P.dead && P.ground && Math.abs(P.x - pl.x) < 30 && Math.abs(P.y - pl.y) < 4 && !S.planted) {
        if (inp.dy < 0) {
          if (!S.matrix) msg('needMatrix', {}, 2.5);
          else { S.plantT += dt; if (S.plantT >= K.PLANT) { S.planted = true; S.phase = 'out'; S.bombT = D.timer; S.score += 1000; S.alarmT = 0; Wd.shut = false; ev('planted', { x: pl.x, y: pl.y, timer: D.timer }); } }
        } else S.plantT = 0;
      } else S.plantT = 0;
      // выход
      if (S.planted && !P.dead && Math.floor(P.y / (SH * T) - 0.01) === S.map.exit.Y && P.x < S.map.exit.x1 && P.ground) {
        S.over = true; S.won = true; S.phase = 'won';
        var bonus = Math.round(S.bombT) * 25 + diff * 1500 + (S.alarms === 0 ? 3000 : 0) + S.takedowns * 50;
        S.score += bonus; ev('win', { time: S.time, bonus: bonus }); return;
      }
      // стража и снаряды
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.out) enemyStep(e, dt); }
      for (i = 0; i < S.proj.length; i++) projStep(S.proj[i], dt);
      S.proj = S.proj.filter(function (p) { return !p.dead; });
      // тревога, створки
      if (S.alarmT > 0) {
        var anySee = S.enemies.some(function (e) { return e.st === 'chase' && S.time - e.seenT < 0.1; });
        if (!anySee) { S.alarmT -= dt; if (S.alarmT <= 0) { S.alarmT = 0; ev('calm', {}); S.enemies.forEach(function (e) { if (e.st === 'chase') { e.st = 'look'; e.lookT = 2; e.susp = 0.3; } }); } }
      }
      var wantShut = S.alarmT > 0 && S.phase === 'in';
      if (wantShut !== Wd.shut) {
        if (!wantShut) { Wd.shut = false; ev('shutter', { open: true }); }
        else { var block = S.map.shutters.some(function (s) { return Math.abs(P.x - (s.tx * T + 16)) < 16 + K.HW && P.y > s.r0 * T && P.y <= (s.r1 + 1) * T + 1; }); if (!block) { Wd.shut = true; ev('shutter', { open: false }); } }
      }
      // будильник
      if (S.planted) {
        var b0 = S.bombT; S.bombT -= dt;
        if (Math.floor(b0) !== Math.floor(S.bombT) && S.bombT < 15) ev('tick', { t: S.bombT });
        if (S.bombT <= 0) { S.bombT = 0; S.over = true; S.phase = 'lost'; S.lose = 'ring'; ev('gameover', { why: 'ring' }); }
      }
    }
    var api = {
      start: start, update: update, setInput: setInput, press: press,
      state: function () { return S; },
      // тестовые хуки
      _place: function (x, y, face) { var P = S.hero; P.x = x; P.y = y; P.ground = true; P.climb = false; P.vy = 0; if (face) P.face = face; enterScreen(); S.cpPending = true; },
      _give: function (what) { if (what === 'matrix') S.matrix = true; else S.cards[what] = true; },
      _plant: function () { S.planted = true; S.phase = 'out'; S.bombT = D.timer; },
      _heroEvent: heroEvent
    };
    return api;
  }

  LZ.logic = { K: K, ATK: ATK, KINDS: KINDS, ITEMS: ITEMS, DIFF: DIFF, T: T, C: C, World: World, worldStep: worldStep, newHero: newHero, heroStep: heroStep, supported: supported,
    canSee: canSee, isLit: isLit, inShadow: inShadow, hidden: hidden, sightRange: sightRange, scrOf: scrOf, screenAt: screenAt, eyeY: eyeY, mulberry32: mulberry32 };
  LZ.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
