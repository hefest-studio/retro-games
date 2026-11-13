/* ТЕНЬ · game.js — логика без DOM (детерминирована при заданном rng).
   TEN.logic — физика героя heroStep (её же использует граф проходимости в тестах), TEN.Game(opts) — партия.
   Ввод: setInput(dx, dy, jumpHeld) + press('jump'|'strike'|'hook'|'special'); ↑ + удар = приём. */
(function (global) {
  'use strict';
  var TEN = global.TEN = global.TEN || {};
  var LV_ = TEN.levels, T = LV_.T, C = LV_.C;

  var K = {
    G: 1600, JV: 470, JCUT: 210, RUN: 150, ACC_G: 1500, ACC_A: 820, FRIC: 1700, MAXF: 640,
    WJX: 230, WJY: 470, WLOCK: 0.13, CLING_SLIDE: 150, DETACH: 0.16,
    SLIDE_V: 290, SLIDE_T: 0.34, CRAWL: 70, HW: 6, HH: 24, HC: 12, COY: 0.08, JBUF: 0.12,
    HOOK_R: 132, ROPE_MIN: 36, ROPE_MAX: 150, SWING_A: 560, REEL: 90, FLING: 170, SWING_MAX: 560, HAND: 20,
    MANTLE: 44, MANTLE_T: 0.16,
    HP: 8, LIVES: 3, CHARGE0: 10, CHARGE_MAX: 99, INV: 1.1,
    ATK_T: 0.2, ATK_HIT: 0.12, ATK_CD: 0.24, ATK_R: 34,
    ALARM_T: 5, RESPAWN_CD: 6
  };
  var SPECIAL = { star: { cost: 3 }, smoke: { cost: 10 }, whirl: { cost: 8 }, fire: { cost: 10 } };
  var EN = {
    walker: { hp: 1, pts: 100, sp: 50, w: 8, h: 22, respawn: true },
    jumper: { hp: 1, pts: 150, sp: 120, w: 8, h: 18, respawn: true },
    shooter: { hp: 2, pts: 200, sp: 0, w: 8, h: 24, respawn: true },
    drone: { hp: 1, pts: 150, sp: 95, w: 9, h: 10, respawn: true, fly: true },
    guard: { hp: 3, pts: 300, sp: 32, w: 9, h: 30, respawn: false }
  };
  var BOSS = {
    foreman: { hp: 10, w: 20, h: 44, dmg: 1 }, boiler: { hp: 14, w: 22, h: 40 }, crane: { hp: 14, w: 14, h: 26 },
    harpoon: { hp: 16, w: 30, h: 24 }, pendulum: { hp: 16, w: 16, h: 40 }, chancellor: { hp: 24, w: 20, h: 50 }
  };

  // ---------- тайлы ----------
  function tile(LV, c, r) { if (c < 0 || c >= LV.w) return C.S; if (r < 0 || r >= LV.h) return C.E; return LV.t[r * LV.w + c]; }
  function solid(LV, c, r) { return tile(LV, c, r) === C.S; }
  function solidAt(LV, x, y) { return solid(LV, Math.floor(x / T), Math.floor(y / T)); }
  function boxHits(LV, x0, y0, x1, y1) {
    var c0 = Math.floor(x0 / T), c1 = Math.floor((x1 - 0.001) / T), r0 = Math.floor(y0 / T), r1 = Math.floor((y1 - 0.001) / T);
    for (var c = c0; c <= c1; c++) for (var r = r0; r <= r1; r++) if (solid(LV, c, r)) return true;
    return false;
  }
  function boxHazard(LV, x0, y0, x1, y1) {
    var c0 = Math.floor(x0 / T), c1 = Math.floor((x1 - 0.001) / T), r0 = Math.floor(y0 / T), r1 = Math.floor((y1 - 0.001) / T);
    for (var c = c0; c <= c1; c++) for (var r = r0; r <= r1; r++) if (tile(LV, c, r) === C.X) return true;
    return false;
  }
  // одностор. мосток под подошвами в диапазоне (y0, y1]
  function oneWayBetween(LV, x0, x1, y0, y1) {
    var c0 = Math.floor(x0 / T), c1 = Math.floor((x1 - 0.001) / T);
    var r0 = Math.floor(y0 / T), r1 = Math.floor(y1 / T);
    for (var r = r0; r <= r1; r++) { var top = r * T; if (top < y0 - 0.001 || top > y1) continue;
      for (var c = c0; c <= c1; c++) if (tile(LV, c, r) === C.P) return top; }
    return null;
  }
  function floorY(LV, x, y0, y1) { // поверхность (твердь/мосток) под точкой x в [y0, y1]
    var c = Math.floor(x / T);
    for (var r = Math.max(0, Math.floor(y0 / T)); r * T <= y1 && r < LV.h; r++) {
      var v = tile(LV, c, r), top = r * T;
      if (top < y0) continue;
      if ((v === C.S && !solid(LV, c, r - 1)) || (v === C.P)) return top;
    }
    return null;
  }

  function newHero(x, y) {
    return { x: x, y: y, vx: 0, vy: 0, face: 1, ground: true, cling: 0, crouch: false, slideT: 0, hook: null, mantle: null,
      lockT: 0, coyote: 0, jbuf: 0, detachT: 0, clingBan: 0, banSide: 0, dropT: 0, runT: 0, t: 0, wj: false, hazard: false, fell: false };
  }
  function heroH(P) { return P.crouch || P.slideT > 0 ? K.HC : K.HH; }

  function moveX(LV, P, dx) {
    if (!dx) return 0;
    var h = heroH(P), n = Math.ceil(Math.abs(dx) / 4), s = dx / n;
    for (var i = 0; i < n; i++) {
      var nx = P.x + s;
      if (boxHits(LV, nx - K.HW, P.y - h, nx + K.HW, P.y)) {
        if (s > 0) P.x = Math.floor((nx + K.HW - 0.001) / T) * T - K.HW; else P.x = (Math.floor((nx - K.HW) / T) + 1) * T + K.HW;
        return s > 0 ? 1 : -1;
      }
      P.x = nx;
    }
    return 0;
  }
  function moveY(LV, P, dy, ev) {
    if (!dy) return 0;
    var h = heroH(P), n = Math.ceil(Math.abs(dy) / 4), s = dy / n;
    for (var i = 0; i < n; i++) {
      var ny = P.y + s;
      if (s > 0) {
        if (boxHits(LV, P.x - K.HW, ny - h, P.x + K.HW, ny)) { P.y = Math.floor((ny - 0.001) / T) * T; return 1; }
        if (P.dropT <= 0) { var top = oneWayBetween(LV, P.x - K.HW, P.x + K.HW, P.y, ny); if (top != null && top >= P.y - 0.001) { P.y = top; return 1; } }
      } else if (boxHits(LV, P.x - K.HW, ny - h, P.x + K.HW, ny)) { P.y = (Math.floor((ny - h) / T) + 1) * T + h; return -1; }
      P.y = ny;
    }
    return 0;
  }
  function onFloor(LV, P) {
    if (boxHits(LV, P.x - K.HW, P.y, P.x + K.HW, P.y + 1)) return true;
    if (P.dropT > 0) return false;
    var c0 = Math.floor((P.x - K.HW) / T), c1 = Math.floor((P.x + K.HW - 0.001) / T), r = Math.floor((P.y + 0.5) / T);
    if (Math.abs(r * T - P.y) > 0.5) return false;
    for (var c = c0; c <= c1; c++) if (tile(LV, c, r) === C.P) return true;
    return false;
  }
  function roomToStand(LV, P) { return !boxHits(LV, P.x - K.HW, P.y - K.HH, P.x + K.HW, P.y - K.HC); }
  function wallAt(LV, P, side) { // стена сбоку на высоте корпуса (обе точки)
    var x = P.x + side * (K.HW + 1);
    return solidAt(LV, x, P.y - 6) && solidAt(LV, x, P.y - K.HH + 4);
  }
  function mantleSpot(LV, P) { // верх стены, на который можно подтянуться
    var side = P.cling, x = P.x + side * (K.HW + 1), c = Math.floor(x / T), r = Math.floor((P.y - K.HH + 4) / T);
    while (r > 0 && solid(LV, c, r - 1)) r--;
    var top = r * T;
    if (top < P.y - K.MANTLE) return null;
    var nx = side > 0 ? c * T + K.HW + 1 : (c + 1) * T - K.HW - 1;
    if (boxHits(LV, nx - K.HW, top - K.HH, nx + K.HW, top)) return null;
    return { x: nx, y: top };
  }
  function findRing(LV, P) {
    var hx = P.x, hy = P.y - K.HAND, best = null, bd = K.HOOK_R;
    for (var i = 0; i < LV.rings.length; i++) {
      var r = LV.rings[i], dx = r.x - hx, dy = r.y - hy, d = Math.sqrt(dx * dx + dy * dy);
      if (dy < -8 && d < bd) { bd = d; best = r; }
    }
    return best;
  }

  // inp: { dx, dy, jump (держит), jumpP (нажал), hookP }
  function heroStep(LV, P, inp, dt, ev) {
    ev = ev || function () {};
    P.t += dt;
    if (inp.jumpP) P.jbuf = K.JBUF;
    P.jbuf = Math.max(0, P.jbuf - dt); P.lockT = Math.max(0, P.lockT - dt); P.coyote = Math.max(0, P.coyote - dt);
    P.clingBan = Math.max(0, P.clingBan - dt); P.dropT = Math.max(0, P.dropT - dt);
    var dx = inp.dx || 0, dy = inp.dy || 0;

    if (P.mantle) {
      var M = P.mantle; M.t += dt; var k = Math.min(1, M.t / K.MANTLE_T);
      P.x = M.x0 + (M.x - M.x0) * k; P.y = M.y0 + (M.y - M.y0) * k;
      if (k >= 1) { P.mantle = null; P.ground = true; P.vx = 0; P.vy = 0; P.cling = 0; ev('mantle'); }
      return;
    }
    // ---- крюк-трос ----
    if (inp.hookP) {
      if (P.hook) { P.hook = null; ev('unhook'); }
      else {
        var ring = findRing(LV, P);
        if (ring) {
          var hd = Math.hypot(ring.x - P.x, ring.y - (P.y - K.HAND));
          P.hook = { x: ring.x, y: ring.y, L: Math.max(K.ROPE_MIN, Math.min(K.ROPE_MAX, hd)), id: ring.id };
          P.cling = 0; P.crouch = false; P.slideT = 0;
          if (P.ground) { P.vy = -260; P.ground = false; }
          ev('hook', { x: ring.x, y: ring.y });
        } else ev('hookMiss');
      }
    }
    if (P.hook) {
      var R = P.hook;
      if (P.jbuf > 0) {
        P.hook = null; P.jbuf = 0; P.vy = Math.min(P.vy - K.FLING, -K.FLING * 0.6); P.vx *= 1.12; P.lockT = 0.08; P.wj = true;
        if (P.vx) P.face = P.vx > 0 ? 1 : -1;
        ev('fling');
      } else {
        var hy = P.y - K.HAND;
        if (hy > R.y) P.vx += dx * K.SWING_A * dt;
        P.vy += K.G * dt;
        if (dy < 0) R.L = Math.max(K.ROPE_MIN, R.L - K.REEL * dt); else if (dy > 0) R.L = Math.min(K.ROPE_MAX, R.L + K.REEL * dt);
        var sp = Math.hypot(P.vx, P.vy); if (sp > K.SWING_MAX) { P.vx *= K.SWING_MAX / sp; P.vy *= K.SWING_MAX / sp; }
        if (moveX(LV, P, P.vx * dt)) P.vx = 0;
        var my = moveY(LV, P, P.vy * dt, ev);
        if (my) { P.vy = 0; if (my > 0) { P.hook = null; P.ground = true; ev('land', { v: 0 }); } }
        if (P.hook) {
          var ex = P.x - R.x, ey = (P.y - K.HAND) - R.y, d = Math.hypot(ex, ey);
          if (d > R.L) {
            var nx = ex / d, ny = ey / d;
            moveX(LV, P, R.x + nx * R.L - P.x); moveY(LV, P, R.y + ny * R.L + K.HAND - P.y, ev);
            var vr = P.vx * nx + P.vy * ny; if (vr > 0) { P.vx -= vr * nx; P.vy -= vr * ny; }
          }
          if (dx) P.face = dx > 0 ? 1 : -1;
          P.runT += dt * 6;
        }
        if (P.y > LV.h * T + 40) P.fell = true;
        return;
      }
    }

    // ---- цепляние за стену ----
    if (P.cling) {
      var side = P.cling;
      P.vx = 0; P.face = -side;
      if (P.jbuf > 0) {
        P.jbuf = 0; P.cling = 0; P.vx = -side * K.WJX; P.vy = -K.WJY; P.lockT = K.WLOCK; P.clingBan = 0.1; P.banSide = side; P.wj = true;
        ev('walljump');
      } else if (dy < 0 || (dx === side && P.detachT <= 0)) {
        var ms = mantleSpot(LV, P);
        if (ms) { P.mantle = { x0: P.x, y0: P.y, x: ms.x, y: ms.y, t: 0 }; P.cling = 0; ev('pull'); return; }
        P.vy = 0;
      } else P.vy = dy > 0 ? K.CLING_SLIDE : 0;
      if (P.cling && dx === -side) { P.detachT += dt; if (P.detachT > K.DETACH) { P.cling = 0; P.clingBan = 0.25; P.banSide = side; P.vx = -side * 60; } }
      else P.detachT = 0;
      if (P.cling) {
        if (P.vy) { var mm = moveY(LV, P, P.vy * dt, ev); if (mm > 0) { P.cling = 0; P.ground = true; P.vy = 0; } }
        if (P.cling && !wallAt(LV, P, side)) { P.cling = 0; }
        if (P.cling) { if (boxHazard(LV, P.x - K.HW, P.y - K.HH, P.x + K.HW, P.y)) P.hazard = true; return; }
      }
    }

    // ---- присед, подкат ----
    if (P.ground && dy > 0 && P.slideT <= 0 && !P.crouch && Math.abs(P.vx) > 100 && !inp.jumpP) {
      P.slideT = K.SLIDE_T; P.crouch = true; P.vx = (P.vx > 0 ? 1 : -1) * K.SLIDE_V; P.face = P.vx > 0 ? 1 : -1; ev('slide');
    } else if (P.ground && dy > 0) P.crouch = true;
    if (P.slideT > 0) { P.slideT -= dt; if (P.slideT <= 0) P.slideT = 0; }
    if (P.crouch && P.slideT <= 0 && !(dy > 0 && P.ground) && roomToStand(LV, P)) P.crouch = false;
    if (!P.ground && P.crouch && roomToStand(LV, P)) P.crouch = false;

    // ---- горизонталь ----
    if (P.slideT > 0) { P.vx -= Math.sign(P.vx) * 300 * dt; }
    else if (P.lockT > 0 && !P.ground) { /* после прыжка от стены — без руления */ }
    else {
      var target = dx * (P.crouch ? K.CRAWL : K.RUN), acc = P.ground ? (dx ? K.ACC_G : K.FRIC) : K.ACC_A;
      if (P.vx < target) P.vx = Math.min(target, P.vx + acc * dt); else if (P.vx > target) P.vx = Math.max(target, P.vx - acc * dt);
      if (dx) P.face = dx > 0 ? 1 : -1;
    }
    // ---- прыжок ----
    if (P.jbuf > 0 && (P.ground || P.coyote > 0)) {
      if (dy > 0 && P.ground && oneWayUnder(LV, P)) { P.dropT = 0.22; P.ground = false; P.jbuf = 0; P.crouch = false; ev('drop'); }
      else if (!P.crouch || roomToStand(LV, P)) {
        P.vy = -K.JV; P.ground = false; P.coyote = 0; P.jbuf = 0; P.crouch = false; P.slideT = 0; P.wj = false; ev('jump');
      }
    }
    if (!inp.jump && P.vy < -K.JCUT && !P.ground && !P.wj) P.vy = -K.JCUT;
    // ---- гравитация, движение ----
    if (!P.ground) P.vy = Math.min(K.MAXF, P.vy + K.G * dt);
    var wasGround = P.ground, vyIn = P.vy;
    var hx = moveX(LV, P, P.vx * dt);
    if (hx) P.vx = 0;
    var hy2 = moveY(LV, P, P.vy * dt, ev);
    if (hy2 > 0) { if (!wasGround) ev('land', { v: vyIn }); P.ground = true; P.vy = 0; P.wj = false; }
    else if (hy2 < 0) { P.vy = 0; ev('bonk'); }
    if (P.ground && hy2 <= 0) {
      if (!onFloor(LV, P)) { P.ground = false; if (P.vy >= 0) P.coyote = K.COY; }
    }
    if (P.ground) P.runT += Math.abs(P.vx) * dt / 9;
    // ---- автоцепляние ----
    if (!P.ground && !P.crouch) {
      var s = hx || (dx && wallAt(LV, P, dx) ? dx : 0) || (P.vx && wallAt(LV, P, P.vx > 0 ? 1 : -1) ? (P.vx > 0 ? 1 : -1) : 0);
      if (s && wallAt(LV, P, s) && !(P.clingBan > 0 && P.banSide === s)) {
        P.cling = s; P.vx = 0; P.vy = 0; P.face = -s; P.lockT = 0; P.detachT = 0; P.wj = false; ev('cling', { side: s });
      }
    }
    if (boxHazard(LV, P.x - K.HW, P.y - heroH(P), P.x + K.HW, P.y)) P.hazard = true;
    if (P.y > LV.h * T + 40) P.fell = true;
  }
  function oneWayUnder(LV, P) {
    var c0 = Math.floor((P.x - K.HW) / T), c1 = Math.floor((P.x + K.HW - 0.001) / T), r = Math.round(P.y / T);
    for (var c = c0; c <= c1; c++) { if (tile(LV, c, r) === C.S) return false; }
    for (c = c0; c <= c1; c++) if (tile(LV, c, r) === C.P) return true;
    return false;
  }
  function stateOf(P) {
    if (P.mantle) return 'pull';
    if (P.hook) return 'swing';
    if (P.cling) return 'cling';
    if (P.slideT > 0) return 'slide';
    if (P.crouch) return 'crouch';
    if (!P.ground) return 'air';
    return Math.abs(P.vx) > 20 ? 'run' : 'idle';
  }

  function cloneLV(L) {
    return { act: L.act, scene: L.scene, w: L.w, h: L.h, t: L.t, rings: L.rings, deco: L.deco, lights: L.lights, counts: L.counts,
      enemies: L.enemies.map(function (e) { return Object.assign({}, e); }), lamps: L.lamps.map(function (l) { return Object.assign({}, l); }),
      start: L.start, exit: L.exit, time: L.time, arena: L.arena };
  }
  var lvCache = {};
  function getLV(a, s) { var k = a + ':' + s; return lvCache[k] || (lvCache[k] = LV_.build(a, s)); }

  // ================= ПАРТИЯ =================
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var S = null, inp = { dx: 0, dy: 0, jump: false }, queue = {};
    function ev(type, d) { emit(type, d || {}); }

    function initRun() {
      S = { act: opts.act || 1, scene: opts.scene || 1, phase: 'play', phaseT: 0, score: 0, lives: opts.lives || K.LIVES, hp: K.HP,
        charge: K.CHARGE0, special: 'star', LV: null, hero: null, enemies: [], shots: [], eshots: [], fires: [], pickups: [], lamps: [],
        boss: null, time: 0, alarm: 0, alarmN: 0, inv: 0, atkT: 0, atkCd: 0, atkHit: {}, whirl: 0, smoke: 0, t: 0,
        kills: 0, deaths: 0, why: {}, continues: 0, lifeAt: 20000, cleared: [], won: false, over: false, cut: 0, extraDrones: 0 };
    }
    function loadScene() {
      var L = cloneLV(getLV(S.act, S.scene));
      S.LV = L; S.hero = newHero(L.start.x, L.start.y); S.time = L.time; S.phase = 'play'; S.phaseT = 0;
      S.shots = []; S.eshots = []; S.fires = []; S.pickups = []; S.alarm = 0; S.alarmN = 0; S.inv = 0; S.atkT = 0; S.atkCd = 0;
      S.whirl = 0; S.smoke = 0; S.extraDrones = 0; S.hp = K.HP; S.sceneT = 0;
      S.enemies = L.enemies.map(function (e) { return spawnEnemy(e); });
      S.lamps = L.lamps; S.boss = null;
      if (L.arena) S.boss = makeBoss(L.arena);
      ev('scene', { act: S.act, scene: S.scene });
    }
    function spawnEnemy(e) {
      var D = EN[e.k];
      return { id: e.id, k: e.k, sx: e.x, sy: e.y, x: e.x, y: e.y, x0: e.x0, x1: e.x1, vx: 0, vy: 0, hp: D.hp, face: -1, t: rng() * 2, cd: 1 + rng(),
        dead: false, deadAt: -99, inv: 0, ground: !D.fly, state: 'idle', beam: 0, seen: 0 };
    }
    function makeBoss(A) {
      var D = BOSS[A.boss];
      return { k: A.boss, x: A.x1 - 70, y: A.floor, vx: 0, vy: 0, hp: D.hp, max: D.hp, w: D.w, h: D.h, face: -1, state: 'intro', t: 1.2, inv: 0, cd: 2,
        ground: true, phase2: false, claw: 0, clawY: 0, swing: 0, beam: Math.PI, dead: false };
    }

    // ---------- урон герою ----------
    function hurt(n, fromX, why) {
      if (S.inv > 0 || S.phase !== 'play' || opts.god) return;
      S.hp -= n; S.inv = K.INV; var P = S.hero;
      P.hook = null; P.cling = 0; P.mantle = null; P.slideT = 0;
      var dir = P.x < fromX ? -1 : 1; P.vx = dir * 130; P.vy = -250; P.ground = false; P.lockT = 0.2;
      ev('hurt', { hp: S.hp, x: P.x, y: P.y, why: why });
      if (S.hp <= 0) die(why || 'hp');
    }
    function die(why) {
      if (S.phase !== 'play') return;
      if (opts.god && why !== 'time' && why !== 'pit') return;
      S.phase = 'dead'; S.phaseT = 1.5; S.deaths++; S.why[why] = (S.why[why] || 0) + 1;
      var P = S.hero; P.hook = null; P.cling = 0;
      ev('die', { why: why, x: P.x, y: P.y });
    }
    function addScore(n) {
      var before = S.score; S.score += n;
      if (S.score >= S.lifeAt) { S.lifeAt += 20000; if (S.lives < 9) { S.lives++; ev('life'); } }
      return before;
    }
    function alarm(x, y) {
      if (S.smoke > 0) return;
      if (S.alarm <= 0) {
        ev('alarm', { x: x, y: y }); S.alarmN++;
        if (S.extraDrones < 2 && !S.LV.arena) {   // подкрепление: дрон с края экрана
          S.extraDrones++; var P = S.hero, side = rng() < 0.5 ? -1 : 1;
          var e = spawnEnemy({ id: 'x' + S.alarmN, k: 'drone', x: P.x + side * 330, y: P.y - 120, x0: P.x - 300, x1: P.x + 300 });
          e.extra = true; S.enemies.push(e);
        }
      }
      S.alarm = K.ALARM_T;
    }

    // ---------- атаки героя ----------
    function strikeBox() {
      var P = S.hero, f = P.face, y0 = P.y - (P.crouch ? 14 : 28), y1 = P.y - 2;
      return { x0: f > 0 ? P.x : P.x - K.ATK_R, x1: f > 0 ? P.x + K.ATK_R : P.x, y0: y0, y1: y1 };
    }
    function doStrike() {
      var P = S.hero;
      if (S.atkCd > 0 || P.mantle) return;
      if (P.cling) P.face = -P.cling;
      S.atkT = K.ATK_T; S.atkCd = K.ATK_CD; S.atkHit = {}; ev('strike', { x: P.x, y: P.y, face: P.face });
    }
    function doSpecial() {
      var P = S.hero, k = S.special, D = SPECIAL[k];
      if (P.mantle) return;
      if (S.charge < D.cost) { ev('noCharge'); return; }
      if (k === 'star') {
        if (S.shots.length >= 4) return;
        S.charge -= D.cost; if (P.cling) P.face = -P.cling;
        S.shots.push({ x: P.x + P.face * 8, y: P.y - (P.crouch ? 8 : 15), vx: P.face * 420, t: 0.9, rot: 0 });
      } else if (k === 'smoke') { if (S.smoke > 0) return; S.charge -= D.cost; S.smoke = 3; S.alarm = 0; }
      else if (k === 'whirl') { if (S.whirl > 0) return; S.charge -= D.cost; S.whirl = 1; S.whirlHit = {}; }
      else if (k === 'fire') {
        if (S.fires.length) return; S.charge -= D.cost;
        S.fires.push({ x0: P.x, y: P.y, dir: P.face, len: 0, t: 0.8, hit: {} });
      }
      ev('special', { k: k, x: P.x, y: P.y, face: P.face });
    }
    function overlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
    function ebox(e) { var D = EN[e.k]; return { x0: e.x - D.w, x1: e.x + D.w, y0: e.y - D.h, y1: e.y }; }
    function hbox() { var P = S.hero, h = heroH(P); return { x0: P.x - K.HW + 1, x1: P.x + K.HW - 1, y0: P.y - h + 2, y1: P.y }; }
    function bbox(B) {
      if (B.k === 'crane') return { x0: B.x - B.w, x1: B.x + B.w, y0: B.clawY - B.h, y1: B.clawY };
      if (B.k === 'harpoon') return { x0: B.x - B.w, x1: B.x + B.w, y0: B.y - B.h, y1: B.y };
      return { x0: B.x - B.w, x1: B.x + B.w, y0: B.y - B.h, y1: B.y };
    }
    function hitEnemy(e, dmg, how) {
      if (e.dead || e.inv > 0) return false;
      e.hp -= dmg; e.inv = 0.18;
      if (e.hp <= 0) {
        e.dead = true; e.deadAt = S.t; S.kills++;
        var pts = EN[e.k].pts * (S.alarm > 0 ? 2 : 1); addScore(pts);
        ev('kill', { k: e.k, x: e.x, y: e.y - EN[e.k].h / 2, pts: pts, how: how });
        if (rng() < 0.22) S.pickups.push({ x: e.x, y: e.y - 10, vy: -160, item: rng() < 0.7 ? 'c5' : 'hp', t: 7 });
      } else { e.vx = (e.x < S.hero.x ? -1 : 1) * 60; ev('enemyHit', { x: e.x, y: e.y - 12 }); }
      return true;
    }
    function hitBoss(dmg, how) {
      var B = S.boss; if (!B || B.dead || B.inv > 0 || B.state === 'intro') return false;
      B.hp -= dmg; B.inv = 0.3; ev('bossHit', { x: B.x, y: B.y - B.h / 2, hp: B.hp });
      if (!B.phase2 && B.hp <= B.max / 2) { B.phase2 = true; ev('bossRage'); }
      if (B.hp <= 0) {
        B.dead = true; B.state = 'down'; B.t = 2.4; S.eshots = []; addScore(5000 + Math.max(0, Math.round(S.time)) * 20);
        ev('bossDown', { x: B.x, y: B.y - B.h / 2 });
      }
      return true;
    }
    function hitLamp(l) { if (l.broken) return; l.broken = true; S.pickups.push({ x: l.x, y: l.y, vy: -120, item: l.item, t: 8 }); ev('lamp', { x: l.x, y: l.y }); }
    function collect(p) {
      var it = p.item;
      if (it === 'c5' || it === 'c10') { S.charge = Math.min(K.CHARGE_MAX, S.charge + (it === 'c5' ? 5 : 10)); }
      else if (it === 'hp') S.hp = Math.min(K.HP, S.hp + 3);
      else if (it === 'pts') addScore(500);
      else if (it === 'life') { if (S.lives < 9) S.lives++; }
      else if (it.indexOf('sp:') === 0) S.special = it.slice(3);
      addScore(it === 'pts' ? 0 : 50);
      ev('pickup', { item: it, x: p.x, y: p.y });
    }

    // ---------- конус прожектора ----------
    function inCone(ox, oy, ang, len, half) {
      var P = S.hero, px = P.x - ox, py = P.y - 12 - oy, d = Math.hypot(px, py);
      if (d > len || d < 4) return false;
      var a = Math.atan2(py, px), da = Math.atan2(Math.sin(a - ang), Math.cos(a - ang));
      if (Math.abs(da) > half) return false;
      for (var k = 1; k < 6; k++) if (solidAt(S.LV, ox + px * k / 6, oy + py * k / 6)) return false;
      return true;
    }

    // ---------- враги ----------
    function walkOK(e, nx) { // не сходить с опоры и не лезть в стену
      var L = S.LV, D = EN[e.k], ahead = nx + Math.sign(nx - e.x) * D.w;
      if (solidAt(L, ahead, e.y - 6)) return false;
      return solidAt(L, ahead, e.y + 2) || tile(L, Math.floor(ahead / T), Math.floor((e.y + 2) / T)) === C.P;
    }
    function updEnemy(e, dt) {
      var P = S.hero, D = EN[e.k], L = S.LV, fast = S.alarm > 0 ? 1.35 : 1, hid = S.smoke > 0;
      e.t += dt; e.inv = Math.max(0, e.inv - dt);
      var dxh = P.x - e.x, dyh = P.y - e.y, near = Math.abs(dxh) < 330 && Math.abs(dyh) < 200;
      if (e.k === 'walker') {
        var sp = D.sp * fast * (e.face || -1); if (!walkOK(e, e.x + sp * dt) || e.x + sp * dt < e.x0 || e.x + sp * dt > e.x1) { e.face = -(e.face || -1); sp = -sp; }
        if (walkOK(e, e.x + sp * dt)) e.x += sp * dt;
      } else if (e.k === 'jumper') {
        if (e.ground) {
          e.cd -= dt * fast;
          if (e.cd <= 0 && near && !hid) { e.face = dxh > 0 ? 1 : -1; e.vx = e.face * D.sp * fast; e.vy = -360; e.ground = false; e.cd = 1.1 + rng() * 0.6; ev('hop', { x: e.x, y: e.y }); }
        } else {
          e.vy += K.G * 0.9 * dt;
          var nx = e.x + e.vx * dt; if (solidAt(L, nx + Math.sign(e.vx) * D.w, e.y - 8) || nx < e.x0 - 40 || nx > e.x1 + 40) e.vx = -e.vx * 0.3; else e.x = nx;
          var ny = e.y + e.vy * dt, fy = e.vy > 0 ? floorY(L, e.x, e.y - 1, ny + 1) : null;
          if (fy != null) { e.y = fy; e.vy = 0; e.ground = true; e.vx = 0; } else e.y = ny;
          if (e.y > L.h * T + 60) { e.dead = true; e.deadAt = S.t; }
        }
      } else if (e.k === 'shooter') {
        e.face = dxh > 0 ? 1 : -1; e.cd -= dt * fast * (S.alarm > 0 ? 1.2 : 1);
        if (e.cd <= 0) {
          if (near && Math.abs(dxh) < 300 && Math.abs(dyh) < 70 && !hid) { S.eshots.push({ k: 'bolt', x: e.x + e.face * 10, y: e.y - 17, vx: e.face * 190, vy: 0, t: 2.2, r: 3 }); ev('eshoot', { x: e.x, y: e.y }); }
          e.cd = 2.1 + rng() * 0.5;
        }
      } else if (e.k === 'drone') {
        if (near && !hid) {
          var tx = P.x, ty = P.y - 22, ang = Math.atan2(ty - e.y, tx - e.x);
          e.vx += (Math.cos(ang) * D.sp * fast - e.vx) * Math.min(1, dt * 1.6);
          e.vy += (Math.sin(ang) * D.sp * fast * 0.8 - e.vy) * Math.min(1, dt * 1.6);
        } else { e.vx *= 0.96; e.vy += ((e.sy + Math.sin(e.t * 2) * 10) - e.y) * dt * 2 - e.vy * dt; }
        e.x += e.vx * dt; e.y += e.vy * dt + Math.sin(e.t * 5) * 0.3;
        e.face = e.vx > 0 ? 1 : -1;
      } else if (e.k === 'guard') {
        var gs = D.sp * fast * (e.face || 1);
        if (e.state === 'swing') { e.cd -= dt; if (e.cd <= 0) e.state = 'idle'; }
        else {
          if (!walkOK(e, e.x + gs * dt) || e.x + gs * dt < e.x0 || e.x + gs * dt > e.x1) e.face = -(e.face || 1);
          else e.x += gs * dt;
          if (Math.abs(dxh) < 30 && Math.abs(dyh) < 30 && !hid) { e.state = 'swing'; e.cd = 0.5; e.face = dxh > 0 ? 1 : -1; ev('baton', { x: e.x, y: e.y }); }
        }
        e.beam = (e.face > 0 ? 0 : Math.PI) + (e.face > 0 ? 0.32 : -0.32) + Math.sin(e.t * 1.3) * 0.22;
        if (!hid && inCone(e.x, e.y - 28, e.beam, 150, 0.3)) alarm(e.x, e.y);
        if (e.state === 'swing' && e.cd < 0.3 && e.cd > 0.15 && Math.abs(dxh) < 34 && Math.abs(dyh) < 34) hurt(1, e.x, 'enemy');
      }
      // касание
      if (!e.dead && !hid && overlap(ebox(e), hbox())) hurt(e.k === 'guard' ? 2 : 1, e.x, 'enemy');
      // далеко улетевший дрон-подкрепление — убрать
      if (e.extra && Math.abs(e.x - P.x) > 700) { e.dead = true; e.gone = true; }
    }
    function respawnCheck(e) {
      if (!e.dead || e.gone || e.extra || !EN[e.k].respawn) return;
      var P = S.hero;
      if (S.t - e.deadAt < K.RESPAWN_CD) return;
      if (Math.abs(e.sx - P.x) < 380) return;   // точка появления должна быть за экраном
      var ne = spawnEnemy({ id: e.id, k: e.k, x: e.sx, y: e.sy, x0: e.x0, x1: e.x1 });
      ne.respawned = true; Object.assign(e, ne); ev('respawnEnemy', { id: e.id });
    }

    // ---------- боссы ----------
    function bossUpdate(dt) {
      var B = S.boss, P = S.hero, A = S.LV.arena; if (!B) return;
      B.inv = Math.max(0, B.inv - dt); B.t -= dt; B.cd -= dt;
      var rage = B.phase2 ? 1.3 : 1, dx = P.x - B.x;
      if (B.state === 'intro') { if (B.t <= 0) { B.state = 'move'; B.t = 1.5; ev('boss', { k: B.k }); } return; }
      if (B.state === 'down') { if (B.t <= 0 && S.phase === 'play') { S.phase = 'clear'; S.phaseT = 2.2; S.lastClear = { bonus: 0, boss: true }; ev('clear', { act: S.act, scene: 4, bonus: 0, boss: true }); } return; }
      var clampX = function () { B.x = Math.max(A.x0 + B.w, Math.min(A.x1 - B.w, B.x)); };
      var gravity = function () {
        if (B.ground) return; B.vy += K.G * dt; B.y += B.vy * dt;
        if (B.y >= A.floor) { B.y = A.floor; B.vy = 0; B.ground = true; B.landed = true; }
      };
      B.landed = false;
      if (B.k === 'foreman') {        // Бригадир Клёпа: шаг к героине → замах → таран до стены → оглушён
        if (B.state === 'move') { B.face = dx > 0 ? 1 : -1; B.x += B.face * 55 * rage * dt; if (B.t <= 0) { B.state = 'wind'; B.t = 0.55; ev('bossWind'); } if (B.ground && P.y < B.y - 60 && Math.abs(dx) < 90 && B.cd <= 0) { B.vy = -520; B.ground = false; B.cd = 2.5; } }
        else if (B.state === 'wind') { if (B.t <= 0) { B.state = 'charge'; ev('bossCharge'); } }
        else if (B.state === 'charge') { B.x += B.face * 300 * rage * dt; if (B.x <= A.x0 + B.w + 1 || B.x >= A.x1 - B.w - 1) { B.state = 'stun'; B.t = 0.9; ev('bossBump'); } }
        else if (B.state === 'stun') { if (B.t <= 0) { B.state = 'move'; B.t = 1.2 + rng(); } }
        gravity(); clampX();
      } else if (B.k === 'boiler') {  // Котёл-Молот: прыжки к героине, ударная волна по полу при приземлении
        if (B.state === 'move') { if (B.t <= 0) { B.face = dx > 0 ? 1 : -1; B.vx = Math.max(-260, Math.min(260, dx * 1.1)); B.vy = -560; B.ground = false; B.state = 'jump'; ev('bossLeap'); } }
        else if (B.state === 'jump') {
          B.x += B.vx * dt; gravity();
          if (B.landed) { B.state = 'move'; B.t = 1.1 / rage; ev('bossBump');
            [-1, 1].forEach(function (d) { S.eshots.push({ k: 'wave', x: B.x + d * B.w, y: A.floor - 1, vx: d * 210 * rage, vy: 0, t: 2.5, r: 7 }); }); }
        }
        clampX();
      } else if (B.k === 'crane') {   // Кран-Хват: ездит под потолком, роняет клешню; клешня внизу — уязвима
        B.y = 4 * T + 6;
        if (B.state === 'move') { B.clawY = B.y + 30; B.face = dx > 0 ? 1 : -1; B.x += Math.max(-150, Math.min(150, dx * 2)) * rage * dt; if (B.t <= 0 && Math.abs(dx) < 30) { B.state = 'drop'; ev('bossWind'); } else if (B.t < -1.5) { B.state = 'drop'; } }
        else if (B.state === 'drop') { B.clawY += 520 * dt; if (B.clawY >= A.floor) { B.clawY = A.floor; B.state = 'down'; B.state = 'grip'; B.t = 1.1; ev('bossBump');
          if (B.phase2) [-1, 1].forEach(function (d) { S.eshots.push({ k: 'gear', x: B.x, y: A.floor - 10, vx: d * 140, vy: -300, t: 3, r: 6, bounce: 3 }); }); } }
        else if (B.state === 'grip') { if (B.t <= 0) B.state = 'lift'; }
        else if (B.state === 'lift') { B.clawY -= 260 * dt; if (B.clawY <= B.y + 30) { B.state = 'move'; B.t = 1.3 / rage; } }
        clampX();
      } else if (B.k === 'harpoon') { // Гарпунёр: гондола дирижабля, гарпуны в героиню; периодически проходит низко
        var cyc = (S.sceneT * 0.25) % 1, low = cyc > 0.62 && cyc < 0.92;
        var ty = low ? A.floor - 56 : 9 * T, tx = (A.x0 + A.x1) / 2 + Math.sin(S.sceneT * 0.6) * 200;
        B.x += (tx - B.x) * Math.min(1, dt * 1.2); B.y += (ty - B.y) * Math.min(1, dt * 2); B.face = dx > 0 ? 1 : -1;
        if (B.cd <= 0 && !low) { var a = Math.atan2(P.y - 14 - B.y, P.x - B.x); S.eshots.push({ k: 'harpoon', x: B.x, y: B.y, vx: Math.cos(a) * 250 * rage, vy: Math.sin(a) * 250 * rage, t: 2.5, r: 4, ang: a }); B.cd = 1.7 / rage; ev('eshoot', { x: B.x, y: B.y }); }
        if (B.phase2 && B.cd > 1.0 && B.cd < 1.0 + dt && Math.abs(dx) < 40) S.eshots.push({ k: 'bomb', x: B.x, y: B.y + 6, vx: 0, vy: 40, t: 3, r: 6, grav: true });
      } else if (B.k === 'pendulum') { // Часовщик: ходит и бросает прыгающие шестерни; над ареной качается маятник-лезвие
        B.swing += dt; B.face = dx > 0 ? 1 : -1;
        if (B.state === 'move') { B.x += B.face * 40 * rage * dt; if (B.cd <= 0) { S.eshots.push({ k: 'gear', x: B.x, y: B.y - 30, vx: B.face * (120 + rng() * 60), vy: -320, t: 4, r: 6, bounce: 4 }); B.cd = 1.9 / rage; ev('eshoot', { x: B.x, y: B.y }); } }
        clampX();
        var pa = Math.sin(B.swing * 2.6) * 1.05, px = (A.x0 + A.x1) / 2 + Math.sin(pa) * 170, py = 4 * T + Math.cos(pa) * 170;
        B.blade = { x: px, y: py };
        if (Math.hypot(P.x - px, P.y - 12 - py) < 20) hurt(2, px, 'boss');
      } else if (B.k === 'chancellor') { // Канцлер Ржавь: веер болтов, глаз-прожектор, в ярости — прыжки и дроны
        B.beam = (dx > 0 ? 0 : Math.PI) + Math.sin(S.sceneT * 1.4) * 0.5 + (dx > 0 ? 0.25 : -0.25);
        if (B.state === 'move') {
          B.face = dx > 0 ? 1 : -1; B.x += B.face * 45 * rage * dt;
          var lit = S.smoke <= 0 && inCone(B.x, B.y - 44, B.beam, 260, 0.28);
          if (lit) S.alarm = 1;
          if (B.cd <= 0) {
            for (var k = -1; k <= 1; k++) { var aa = Math.atan2(P.y - 14 - (B.y - 40), P.x - B.x) + k * 0.22; S.eshots.push({ k: 'bolt', x: B.x, y: B.y - 40, vx: Math.cos(aa) * 210, vy: Math.sin(aa) * 210, t: 2.5, r: 3 }); }
            B.cd = (lit ? 1.0 : 2.0) / rage; ev('eshoot', { x: B.x, y: B.y });
          }
          if (B.phase2 && B.ground && B.t <= 0) { B.vy = -600; B.vx = dx * 0.9; B.ground = false; B.state = 'jump'; B.t = 3; ev('bossLeap');
            if (S.enemies.filter(function (e) { return !e.dead; }).length < 2) { var e2 = spawnEnemy({ id: 'bd' + S.t, k: 'drone', x: B.x, y: B.y - 120, x0: A.x0, x1: A.x1 }); e2.extra = true; S.enemies.push(e2); } }
        } else if (B.state === 'jump') { B.x += B.vx * dt; gravity(); if (B.landed) { B.state = 'move'; ev('bossBump'); } }
        if (!B.ground && B.state !== 'jump') gravity();
        clampX();
      }
      // касание
      if (!B.dead && S.smoke <= 0 && overlap(bbox(B), hbox())) hurt(BOSS[B.k].dmg || 2, B.x, 'boss');
      if (B.k === 'crane' && !B.dead && overlap({ x0: B.x - 22, x1: B.x + 22, y0: B.y - 10, y1: B.y + 14 }, hbox())) hurt(1, B.x, 'boss');
    }

    // ---------- шаг партии ----------
    function update(dt) {
      if (!S) return;
      S.t += dt;
      var P = S.hero;
      if (S.phase === 'dead') {
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          S.lives--;
          if (S.lives <= 0) { S.phase = 'over'; S.over = true; ev('gameover', { score: S.score }); }
          else { loadScene(); ev('respawn'); }
        }
        return;
      }
      if (S.phase === 'clear') {
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.scene < 4) { S.scene++; loadScene(); }
          else if (S.act < LV_.ACTS) { S.phase = 'cut'; S.cut = S.act; ev('cut', { after: S.act }); if (opts.autoCut) nextAct(); }
          else { S.phase = 'won'; S.won = true; ev('win', { score: S.score }); }
        }
        return;
      }
      if (S.phase !== 'play') return;
      S.sceneT += dt;
      S.time -= dt; if (S.time <= 0) { S.time = 0; die('time'); return; }
      S.inv = Math.max(0, S.inv - dt); S.atkCd = Math.max(0, S.atkCd - dt); S.alarm = Math.max(0, S.alarm - dt);
      S.smoke = Math.max(0, S.smoke - dt);
      var q = queue; queue = {};
      if (q.strike) { if (inp.dy < 0 && !P.cling) doSpecial(); else doStrike(); }
      if (q.special) doSpecial();
      heroStep(S.LV, P, { dx: inp.dx, dy: inp.dy, jump: inp.jump, jumpP: !!q.jump, hookP: !!q.hook }, dt, ev);
      if (P.fell) { die('pit'); return; }
      if (P.hazard) { P.hazard = false; if (S.inv <= 0) { hurt(2, P.x + P.face * 10, 'spikes'); P.vy = -330; } }
      // удар серпом
      if (S.atkT > 0) {
        S.atkT -= dt;
        if (S.atkT > K.ATK_T - K.ATK_HIT) {
          var sb = strikeBox();
          S.enemies.forEach(function (e) { if (!e.dead && !S.atkHit[e.id] && overlap(sb, ebox(e))) { S.atkHit[e.id] = 1; hitEnemy(e, 1, 'sickle'); } });
          S.lamps.forEach(function (l) { if (!l.broken && overlap(sb, { x0: l.x - 7, x1: l.x + 7, y0: l.y - 9, y1: l.y + 9 })) hitLamp(l); });
          S.eshots = S.eshots.filter(function (b) { var cut = (b.k === 'bolt' || b.k === 'harpoon' || b.k === 'gear') && overlap(sb, { x0: b.x - b.r, x1: b.x + b.r, y0: b.y - b.r, y1: b.y + b.r }); if (cut) { addScore(20); ev('parry', { x: b.x, y: b.y }); } return !cut; });
          if (S.boss && !S.atkHit.boss && overlap(sb, bbox(S.boss))) { S.atkHit.boss = 1; hitBoss(1, 'sickle'); }
        }
      }
      // вихрь
      if (S.whirl > 0) {
        S.whirl -= dt; var wb = { x0: P.x - 34, x1: P.x + 34, y0: P.y - 46, y1: P.y + 22 };
        if (P.vy > 60 && !P.ground && !P.hook) P.vy = 60;
        S.enemies.forEach(function (e) { if (!e.dead && overlap(wb, ebox(e)) && !(S.whirlHit[e.id] > S.t)) { S.whirlHit[e.id] = S.t + 0.3; hitEnemy(e, 2, 'whirl'); } });
        S.lamps.forEach(function (l) { if (!l.broken && overlap(wb, { x0: l.x - 7, x1: l.x + 7, y0: l.y - 9, y1: l.y + 9 })) hitLamp(l); });
        if (S.boss && overlap(wb, bbox(S.boss)) && !(S.whirlHit.boss > S.t)) { S.whirlHit.boss = S.t + 0.35; hitBoss(2, 'whirl'); }
        S.eshots = S.eshots.filter(function (b) { return !(b.k !== 'wave' && Math.hypot(b.x - P.x, b.y - P.y + 12) < 36); });
      }
      // звёзды-шестерёнки
      S.shots = S.shots.filter(function (s) {
        s.t -= dt; s.x += s.vx * dt; s.rot += dt * 20;
        if (s.t <= 0 || solidAt(S.LV, s.x, s.y)) return false;
        var sb2 = { x0: s.x - 5, x1: s.x + 5, y0: s.y - 5, y1: s.y + 5 };
        for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && overlap(sb2, ebox(e))) { hitEnemy(e, 1, 'star'); return false; } }
        for (i = 0; i < S.lamps.length; i++) { var l = S.lamps[i]; if (!l.broken && overlap(sb2, { x0: l.x - 7, x1: l.x + 7, y0: l.y - 9, y1: l.y + 9 })) { hitLamp(l); return false; } }
        if (S.boss && !S.boss.dead && overlap(sb2, bbox(S.boss))) { hitBoss(1, 'star'); return false; }
        return true;
      });
      // огненная полоса
      S.fires = S.fires.filter(function (f) {
        f.t -= dt; f.len = Math.min(170, f.len + 600 * dt);
        var fb = { x0: f.dir > 0 ? f.x0 : f.x0 - f.len, x1: f.dir > 0 ? f.x0 + f.len : f.x0, y0: f.y - 30, y1: f.y + 4 };
        S.enemies.forEach(function (e) { if (!e.dead && overlap(fb, ebox(e)) && !(f.hit[e.id] > S.t)) { f.hit[e.id] = S.t + 0.3; hitEnemy(e, 2, 'fire'); } });
        S.lamps.forEach(function (l) { if (!l.broken && overlap(fb, { x0: l.x - 7, x1: l.x + 7, y0: l.y - 9, y1: l.y + 9 })) hitLamp(l); });
        if (S.boss && overlap(fb, bbox(S.boss)) && !(f.hit.boss > S.t)) { f.hit.boss = S.t + 0.35; hitBoss(2, 'fire'); }
        return f.t > 0;
      });
      // враги
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead) updEnemy(e, dt); else respawnCheck(e); }
      S.enemies = S.enemies.filter(function (e) { return !(e.dead && e.extra); });
      // прожекторы-вышки
      if (S.smoke <= 0) S.LV.lights.forEach(function (l) { var a = l.base + Math.sin(S.t * l.sp + l.ph) * l.amp; if (inCone(l.x, l.y, a, l.len, 0.2)) alarm(l.x, l.y); });
      // снаряды врагов
      var hb = hbox();
      S.eshots = S.eshots.filter(function (b) {
        b.t -= dt; if (b.grav || b.bounce != null) b.vy += K.G * 0.6 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.bounce != null && b.vy > 0 && solidAt(S.LV, b.x, b.y + b.r)) { if (b.bounce-- <= 0) return false; b.y = Math.floor((b.y + b.r) / T) * T - b.r; b.vy = -Math.abs(b.vy) * 0.75; }
        if (b.k === 'wave') { if (solidAt(S.LV, b.x + Math.sign(b.vx) * 6, b.y - 4)) return false; }
        else if (b.bounce == null && solidAt(S.LV, b.x, b.y)) { if (b.k === 'bomb') { ev('boom', { x: b.x, y: b.y }); if (Math.hypot(P.x - b.x, P.y - 12 - b.y) < 34) hurt(2, b.x, 'shot'); } return false; }
        var r = b.k === 'wave' ? { x0: b.x - 6, x1: b.x + 6, y0: b.y - 14, y1: b.y } : { x0: b.x - b.r, x1: b.x + b.r, y0: b.y - b.r, y1: b.y + b.r };
        if (S.smoke <= 0 && overlap(r, hb)) { hurt(b.k === 'bomb' || b.k === 'wave' ? 2 : 1, b.x, 'shot'); return b.k === 'wave'; }
        return b.t > 0;
      });
      // фонари и подборы
      S.pickups = S.pickups.filter(function (p) {
        p.t -= dt; p.vy = Math.min(300, p.vy + 900 * dt);
        var ny = p.y + p.vy * dt, fy = p.vy > 0 ? floorY(S.LV, p.x, p.y - 1, ny + 1) : null;
        if (fy != null) { p.y = fy - 1; p.vy = 0; } else p.y = ny;
        if (overlap({ x0: p.x - 7, x1: p.x + 7, y0: p.y - 10, y1: p.y }, { x0: P.x - 9, x1: P.x + 9, y0: P.y - 26, y1: P.y + 2 })) { collect(p); return false; }
        return p.t > 0 && p.y < S.LV.h * T + 40;
      });
      if (S.boss) bossUpdate(dt);
      // выход
      var X = S.LV.exit;
      if (X && P.x >= X.x - 6 && Math.abs(P.y - X.y) < 48) {
        var bonus = Math.ceil(S.time) * 10; addScore(bonus);
        S.phase = 'clear'; S.phaseT = 2.2; S.lastClear = { bonus: bonus, time: S.LV.time - S.time };
        S.cleared.push(S.act + '-' + S.scene);
        ev('clear', { act: S.act, scene: S.scene, bonus: bonus, time: S.LV.time - S.time });
      }
    }
    function nextAct() { if (S.phase !== 'cut') return; S.act++; S.scene = 1; loadScene(); }

    var api = {
      start: function () { initRun(); loadScene(); ev('start'); return api; },
      update: update,
      setInput: function (dx, dy, jump) { inp.dx = dx > 0.3 ? 1 : dx < -0.3 ? -1 : 0; inp.dy = dy > 0.3 ? 1 : dy < -0.3 ? -1 : 0; inp.jump = !!jump; },
      press: function (name) { queue[name] = true; },
      state: function () { return S; },
      nextAct: nextAct,
      restartScene: function () { if (S.phase === 'over' || S.phase === 'won') return; S.lives--; S.deaths++; if (S.lives <= 0) { S.phase = 'over'; S.over = true; ev('gameover', { score: S.score }); } else loadScene(); },
      continueGame: function () { if (!S.over) return; S.over = false; S.lives = K.LIVES; S.score = 0; S.lifeAt = 20000; S.continues++; S.charge = Math.max(S.charge, K.CHARGE0); loadScene(); ev('continue'); },
      // тестовые хуки
      _go: function (a, s) { S.act = a; S.scene = s; loadScene(); },
      _place: function (x, y) { S.hero = newHero(x, y); },
      _die: die, _hurt: hurt, _alarm: alarm,
      _hitBoss: function (n) { return hitBoss(n || 1, 'test'); }
    };
    return api;
  }

  TEN.logic = { K: K, T: T, C: C, EN: EN, BOSS: BOSS, SPECIAL: SPECIAL, tile: tile, solid: solid, solidAt: solidAt, boxHits: boxHits, boxHazard: boxHazard,
    floorY: floorY, newHero: newHero, heroH: heroH, heroStep: heroStep, stateOf: stateOf, findRing: findRing, mantleSpot: mantleSpot, wallAt: wallAt,
    getLV: getLV, onFloor: onFloor };
  TEN.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
