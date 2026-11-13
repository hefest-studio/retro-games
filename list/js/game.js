/* ЛИСТ · логика (без DOM, детерминирована при seed). Литер — печатник-гравёр мастерской «Гефест» — затянут
   в недопечатанную книгу-лубок и пробивается сквозь панели страниц: комбо, блок, захват и бросок в рамку панели
   (рвёт бумагу), удар в прыжке, инвентарь из 3 ячеек, здоровье = чернила (промахи и удары по стенам их тратят).
   API: LIST.Game(opts) → { start, update(dt), setInput(inp), state(), panel(), … }. Шаг — 1/60 с. */
(function (global) {
  'use strict';
  var LIST = global.LIST = global.LIST || {};
  var LV = LIST.levels;

  var K = {
    G: 1300, JUMPV: 400, RUN: 100, FALLMAX: 520, COYOTE: 0.08,
    HW: 12, HH: 26,                       // габарит героя
    INK: 100, LIVES: 2,                   // чернила; жизнь + один «запасной лист»
    COST_AIR: 1, COST_WALL: 2, COST_SCIS: 3, PIT_DMG: 12,
    REACH: [22, 22, 27], DMG: [1, 1, 2], ATK_T: [0.2, 0.2, 0.3], COMBO_WIN: 0.32,
    JK_T: 0.34, JK_DMG: 2, THROWV: 300, HOLD_T: 2.2,
    HEAL_POT: 30, HEAL_DROP: 10, SHIELD_T: 6, SKETCH_T: 0.6,
    E: {                                 // враги: hp, урон, ширина, высота, очки
      blot: { hp: 3, dmg: 8, w: 14, h: 12, pts: 100 },
      guard: { hp: 6, dmg: 12, w: 14, h: 30, pts: 200 },
      nib: { hp: 2, dmg: 10, w: 12, h: 14, pts: 150 }
    },
    BOSS: {
      queen: { hp: 24, w: 40, h: 34 },
      binder: { hp: 28, w: 30, h: 38 },
      corrector: { hp: 32, w: 24, h: 40 }
    },
    PTS: { letter: 250, sheet: 500, clear: 100, clean: 200, tear: 150, boss: 5000, endA: 1500, endB: 1000, hit: 10 }
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function ov(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }

  // ---------- рантайм панели ----------
  function makeRuntime(spec) {
    var P = {
      spec: spec, id: spec.id, w: spec.w, h: spec.h, F: spec.F, dir: spec.dir,
      gateOpen: !spec.gate, leverOn: false, frame: spec.frame ? 'hang' : null, frameT: 0, frameY: spec.frame ? spec.frame.hangY : 0,
      drawn: false, drawT: 0, cleared: false, clearT: 0, sealOpen: false, wave: 0, waveT: 0.5, reseedT: 0,
      tears: [], erased: {}, eraseWarn: {}, dmgTaken: 0, sol: []
    };
    if (spec.kind === 'boss') { P.chunks = 6; }
    return P;
  }
  function rebuildSolids(P) {
    var s = P.spec, F = s.F, out = [], i;
    // пол: всё, кроме ям; у босса пол разбит на куски (Корректор их стирает)
    var cuts = s.pits.map(function (p) { return [p.x0, p.x1, p]; }).sort(function (a, b) { return a[0] - b[0]; });
    var x = 0;
    for (i = 0; i < cuts.length; i++) { if (cuts[i][0] > x) out.push({ x: x, y: F, w: cuts[i][0] - x, h: s.h - F, k: 'floor' }); x = Math.max(x, cuts[i][1]); }
    if (x < s.w) out.push({ x: x, y: F, w: s.w - x, h: s.h - F, k: 'floor' });
    if (P.chunks) {
      var cw = s.w / P.chunks; out = [];
      for (i = 0; i < P.chunks; i++) if (!P.erased[i]) out.push({ x: i * cw, y: F, w: cw, h: s.h - F, k: 'floor', chunk: i });
    }
    // крышки дыр-выходов, пока панель не зачищена
    s.pits.forEach(function (p) { if (p.k === 'hole' && !P.cleared) out.push({ x: p.x0, y: F, w: p.x1 - p.x0, h: 6, k: 'cover' }); });
    s.blocks.forEach(function (b) { out.push(b); });
    s.ledges.forEach(function (b) { out.push({ x: b.x, y: b.y, w: b.w, h: b.h, k: 'ledge', oneway: true }); });
    if (s.gate && !P.gateOpen) out.push({ x: s.gate.x, y: 0, w: s.gate.w, h: F, k: 'gate' });
    if (s.frame && P.frame === 'down') out.push(s.frame.rect);
    if (s.sketch && P.drawn) s.sketch.parts.forEach(function (p) { out.push(p); });
    P.sol = out;
  }
  function exitOpen(P, side) {
    if (!P.cleared) return false;
    var ex = P.spec.exits;
    for (var i = 0; i < ex.length; i++) if (ex[i].s === side) return ex[i].need === 'tear' ? P.sealOpen : true;
    return false;
  }

  // движение прямоугольника (x — центр, y — подошвы) с коллизиями; walls — стены рамки
  function moveBox(P, e, dt, walls) {
    var hw = e.w / 2, sol = P.sol, i, s, r = { wl: false, wr: false, land: false, head: false };
    var nx = e.x + e.vx * dt;
    for (i = 0; i < sol.length; i++) {
      s = sol[i]; if (s.oneway) continue;
      if (e.y - e.h < s.y + s.h && e.y > s.y + 0.01) {
        if (e.vx > 0 && e.x + hw <= s.x + 0.01 && nx + hw > s.x) { nx = s.x - hw; r.wr = true; r.wsol = s; }
        else if (e.vx < 0 && e.x - hw >= s.x + s.w - 0.01 && nx - hw < s.x + s.w) { nx = s.x + s.w + hw; r.wl = true; r.wsol = s; }
      }
    }
    if (walls) {
      if (walls.L && nx - hw < 0) { nx = hw; r.wl = true; r.frameL = true; }
      if (walls.R && nx + hw > P.w) { nx = P.w - hw; r.wr = true; r.frameR = true; }
    }
    e.x = nx;
    var ny = e.y + e.vy * dt, ground = false;
    for (i = 0; i < sol.length; i++) {
      s = sol[i];
      if (e.x - hw < s.x + s.w && e.x + hw > s.x) {
        if (e.vy >= 0 && e.y <= s.y + 0.01 && ny >= s.y) { ny = s.y; ground = true; r.land = true; }
        else if (!s.oneway && e.vy < 0 && e.y - e.h >= s.y + s.h - 0.01 && ny - e.h < s.y + s.h) { ny = s.y + s.h + e.h; e.vy = 0; r.head = true; }
      }
    }
    if (ground && e.vy > 0) e.vy = 0;
    e.y = ny; e.ground = ground;
    return r;
  }
  function floorAt(P, x, y, hw) { // есть ли опора под точкой (y — подошвы)
    hw = hw || 1;
    for (var i = 0; i < P.sol.length; i++) { var s = P.sol[i]; if (x + hw > s.x && x - hw < s.x + s.w && Math.abs(y - s.y) < 2) return true; }
    return false;
  }
  function surfaceBelow(P, x, y) { // ближайшая опора под точкой
    var best = null;
    for (var i = 0; i < P.sol.length; i++) { var s = P.sol[i]; if (x >= s.x && x <= s.x + s.w && s.y >= y - 0.5 && (best == null || s.y < best)) best = s.y; }
    return best;
  }

  function Game(opts) {
    opts = opts || {};
    var rng = mulberry32((opts.seed || 1) >>> 0);
    var emit = opts.onEvent || function () {};
    var S, P, spec, inp = { x: 0, jump: false, atk: false, block: false, grab: false, use: false, slot: false, sel: 0 }, prev = {};
    var uid = 1;

    function newHero() {
      return { x: 0, y: 0, w: K.HW, h: K.HH, vx: 0, vy: 0, ground: false, face: 1, hp: K.INK, coyote: 0,
        atk: 0, atkLen: 0, combo: 0, comboWin: 0, atkHit: false, queued: false, jk: 0, jkUsed: false, jkHits: {}, jkAny: false,
        block: false, hurt: 0, inv: 0, hold: null, holdT: 0, throwT: 0, useT: 0, shield: 0, drawT: 0, walkT: 0 };
    }
    function init() {
      S = { ch: opts.ch || 1, pg: opts.pg || 1, pid: null, prevPid: null, phase: 'play', phaseT: 0, t: 0, score: 0, lives: opts.lives || K.LIVES,
        hero: newHero(), inv: [null, null, null], sel: 0, en: [], proj: [], items: [], boss: null,
        visited: {}, route: [], ending: null, endings: [], deaths: 0, kills: 0, tears: 0, lastDmg: null, msg: null };
      if (opts.inv) S.inv = opts.inv.slice(0, 3).concat([null, null, null]).slice(0, 3);
    }

    // ---------- панели ----------
    function enterPanel(pid, from) {
      S.prevPid = S.pid; S.pid = pid;
      spec = LV.buildPanel(S.ch, S.pg, pid);
      P = makeRuntime(spec); rebuildSolids(P);
      S.en = []; S.proj = []; S.boss = null;
      S.items = spec.items.map(function (it) { return { id: uid++, k: it.k, x: it.x, y: spec.F, cd: 0 }; });
      if (spec.stand) S.stand = { x: spec.stand.x }; else S.stand = null;
      var h = S.hero; h.vx = 0; h.vy = 0; h.hold = null; h.atk = 0; h.jk = 0; h.block = false; h.hurt = 0; h.drawT = 0;
      placeAtEntry(from);
      S.visited[S.pg + ':' + pid] = true; S.route.push(pid);
      P.waveT = 0.7;
      if (spec.kind === 'boss') P.bossT = 1.0;
      emit('panel', { id: pid, kind: spec.kind, from: from });
    }
    function placeAtEntry(from) {
      var h = S.hero, e = spec.entry;
      if (from === 'D') { h.x = e.dropX; h.y = 4 + h.h; h.vy = 60; }
      else { h.x = e.x; h.y = spec.F; }
      if (spec.kind === 'boss') { h.x = 40; h.y = 4 + h.h; }
      h.face = spec.dir; h.ground = false;
    }
    function respawnPanel() {
      var pid = S.pid; S.route.pop();
      var from = S._enterFrom; S.hero.hp = K.INK; S.hero.inv = 1.2; S.hero.shield = 0;
      enterPanel(pid, from); S.prevPid = null;
    }
    function startPage() {
      var tpl = LV.template(S.pg); S.route = []; S._enterFrom = 'F';
      enterPanel(tpl.start, 'F'); S.prevPid = null;
      emit('page', { ch: S.ch, pg: S.pg });
    }
    function goExit(ex) {
      if (ex.to === 'END') { S.phase = 'turn'; S.phaseT = 0; emit('turn', { ch: S.ch, pg: S.pg }); return; }
      if (P.dmgTaken === 0 && spec.kind !== 'boss') { S.score += K.PTS.clean; emit('clean', {}); }
      S._enterFrom = ex.s === 'D' ? 'D' : 'F';
      enterPanel(ex.to, S._enterFrom);
      S.phase = 'trans'; S.phaseT = 0;
    }

    // ---------- урон и чернила ----------
    function spend(n, why, x, y) {
      var h = S.hero; if (opts.god) return;
      h.hp -= n; emit('ink', { n: n, why: why, x: x == null ? h.x : x, y: y == null ? h.y - 14 : y });
      if (h.hp <= 0) die(why);
    }
    function hurtHero(dmg, src, kind) {
      var h = S.hero; if (S.phase !== 'play') return false;
      if (h.inv > 0) return false;
      if (h.shield > 0) { emit('shieldHit', { x: h.x, y: h.y - 14 }); h.inv = 0.4; return false; }
      var sx = src ? src.x : h.x;
      if (h.block && sgn(sx - h.x) === h.face && kind !== 'unblockable') {
        emit('blocked', { x: h.x + h.face * 8, y: h.y - 16 });
        h.vx = -h.face * 40; h.inv = 0.15; return 'blocked';
      }
      if (h.hold) releaseHold();
      h.inv = 0.8; h.hurt = 0.28; h.vx = sgn(h.x - sx || -h.face) * 120; h.vy = -120; h.ground = false; h.atk = 0; h.jk = 0;
      dmg = Math.round(dmg * (1 + 0.2 * (S.ch - 1)));
      P.dmgTaken += dmg; S.lastDmg = kind || (src && src.type) || 'hit';
      emit('hurt', { dmg: dmg, x: h.x, y: h.y - 14, kind: S.lastDmg });
      spend(dmg, 'hurt');
      return true;
    }
    function die(why) {
      if (S.phase !== 'play') return;
      S.phase = 'dead'; S.phaseT = 0; S.deaths++; S.hero.hp = 0;
      emit('die', { why: why, x: S.hero.x, y: S.hero.y });
    }

    // ---------- враги ----------
    function spawnEnemy(type, x, drip) {
      var d = K.E[type], e = { id: uid++, type: type, x: x, y: type === 'nib' ? spec.F - 60 : spec.F, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp, face: -spec.dir,
        state: drip ? 'spawn' : 'idle', st: 0, dripY: 0, hurt: 0, stun: 0, cd: 0.8 + rng() * 0.8, wind: 0, atkT: 0, didHit: false, hop: 0.4 + rng() * 0.5,
        ground: false, side: rng() < 0.5 ? -1 : 1, held: false, thrown: false, tHits: {}, stuck: 0, dive: null, blocks: 0 };
      if (type === 'nib') { e.fy = spec.F - 58 - rng() * 14; e.y = e.fy; }
      S.en.push(e); emit('drip', { x: x, type: type });
      return e;
    }
    function alive(e) { return e.state !== 'dead'; }
    function agg() { return 1 - 0.12 * (S.ch - 1); }
    function liveCount() { var n = 0; S.en.forEach(function (e) { if (alive(e)) n++; }); return n; }
    function tokens() { var n = 0; S.en.forEach(function (e) { if (alive(e) && (e.wind > 0 || e.atkT > 0)) n++; }); return n; }
    function killEnemy(e, how) {
      if (e.state === 'dead') return;
      if (S.hero.hold === e) S.hero.hold = null;
      e.state = 'dead'; e.st = 0; e.vx = 0; S.kills++;
      var pts = K.E[e.type].pts; S.score += pts;
      emit('kill', { type: e.type, x: e.x, y: e.y - e.h / 2, pts: pts, how: how || 'hit' });
      if (rng() < 0.22 && how !== 'pit') S.items.push({ id: uid++, k: 'drop', x: clamp(e.x, 14, spec.w - 14), y: surfaceBelow(P, e.x, Math.min(e.y, spec.F)) || spec.F, cd: 0 });
    }
    function hitEnemy(e, dmg, kbx, src) {
      if (e.state === 'spawn' || e.state === 'dead') return false;
      var h = S.hero;
      if (e.type === 'guard' && src === 'melee' && e.hurt <= 0 && e.stun <= 0 && e.wind <= 0 && e.atkT <= 0 && sgn(h.x - e.x) === e.face && h.combo < 2 && rng() < 0.35) {
        emit('eblock', { x: e.x + e.face * 8, y: e.y - 18 }); e.blocks++; return 'blocked';
      }
      e.hp -= dmg; e.hurt = 0.28; e.wind = 0; e.atkT = 0;
      if (e.type === 'nib' && e.state !== 'stuck') { e.vy = -60; }
      e.vx = kbx;
      if (Math.abs(kbx) > 120) e.stun = 0.6;
      S.score += K.PTS.hit;
      emit('hit', { x: e.x, y: e.y - e.h * 0.6, dmg: dmg, big: dmg >= 2, src: src });
      if (e.hp <= 0) killEnemy(e, src);
      return true;
    }
    function grabbable(e) {
      if (!alive(e) || e.state === 'spawn' || e.thrown || e.held) return false;
      if (e.type === 'blot') return e.ground;
      if (e.type === 'guard') return e.hurt > 0 || e.stun > 0;
      if (e.type === 'nib') return e.state === 'stuck';
      return false;
    }
    function releaseHold() { var e = S.hero.hold; if (!e) return; e.held = false; e.state = 'idle'; e.hurt = 0.3; e.y = spec.F; S.hero.hold = null; }

    function updEnemy(e, dt) {
      var h = S.hero, F = spec.F;
      if (e.state === 'dead') { e.st += dt; return; }
      if (e.state === 'spawn') {
        e.st += dt; e.dripY = Math.min(1, e.st / 0.5);
        if (e.st > 0.85) { e.state = 'idle'; emit('formed', { x: e.x, y: e.y }); }
        return;
      }
      if (e.held) { e.x = h.x + h.face * 12; e.y = h.y - 6; e.vx = 0; e.vy = 0; return; }
      e.hurt = Math.max(0, e.hurt - dt); e.stun = Math.max(0, e.stun - dt); e.cd -= dt;
      var dx = h.x - e.x, dy = (h.y - h.h / 2) - (e.y - e.h / 2), adx = Math.abs(dx);
      if (e.thrown) {
        e.vy = Math.min(K.FALLMAX, e.vy + K.G * 0.55 * dt);
        var r = moveBox(P, e, dt, { L: true, R: true });
        S.en.forEach(function (o) {
          if (o !== e && alive(o) && o.state !== 'spawn' && !o.held && !e.tHits[o.id] && ov(e.x - e.w / 2, e.y - e.h, e.w, e.h, o.x - o.w / 2, o.y - o.h, o.w, o.h)) {
            e.tHits[o.id] = 1; hitEnemy(o, 3, sgn(e.vx) * 140, 'throw'); emit('bonk', { x: o.x, y: o.y - 10 });
          }
        });
        if (S.boss && !e.tHits.boss && S.boss.state !== 'enter' && ov(e.x - e.w / 2, e.y - e.h, e.w, e.h, S.boss.x - S.boss.w / 2, S.boss.y - S.boss.h, S.boss.w, S.boss.h)) {
          e.tHits.boss = 1; bossHit(3, 'throw', sgn(e.vx)); e.vx = -e.vx * 0.3;
        }
        if (r.frameL || r.frameR) { tear(r.frameL ? 'L' : 'R', e.y - e.h / 2, e); e.thrown = false; e.vx = r.frameL ? 60 : -60; e.vy = -80; e.hurt = 0.5; if (alive(e)) hitEnemy(e, 5, 0, 'tear'); return; }
        if (r.wl || r.wr) { e.thrown = false; e.vx = 0; if (alive(e)) hitEnemy(e, 3, 0, 'wall'); emit('bonk', { x: e.x, y: e.y - 8 }); return; }
        if (r.land) { e.thrown = false; e.vx = 0; e.stun = 0.7; if (alive(e)) hitEnemy(e, 2, 0, 'land'); return; }
        if (e.y > spec.h + 40) killEnemy(e, 'pit');
        return;
      }
      var walls = { L: true, R: true };
      if (e.type === 'nib' && e.state !== 'stuck') {
        // полёт: кружит над героем, пикирует
        if (e.hurt > 0) { e.y += e.vy * dt; e.vy *= 0.9; return; }
        if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) { var tx = h.x - e.x, ty = (h.y - 10) - e.y, L = Math.hypot(tx, ty) || 1; e.dive = { vx: tx / L * 250, vy: ty / L * 250 }; e.atkT = 1.2; e.didHit = false; emit('dive', { x: e.x, y: e.y }); } return; }
        if (e.atkT > 0) {
          e.atkT -= dt; e.x += e.dive.vx * dt; e.y += e.dive.vy * dt; e.face = sgn(e.dive.vx) || e.face;
          if (!e.didHit && ov(e.x - 6, e.y - 10, 12, 12, h.x - h.w / 2, h.y - h.h, h.w, h.h)) {
            e.didHit = true; e.atkT = 0; e.cd = 2 + rng();
            if (hurtHero(K.E.nib.dmg, e) === 'blocked') { // отбитое перо втыкается в пол
              var fb = surfaceBelow(P, e.x - h.face * 10, h.y - 2); e.x = clamp(e.x - h.face * 10, 6, spec.w - 6);
              if (fb != null) { e.y = fb; e.state = 'stuck'; e.stuck = 1.5; e.ground = true; emit('stuck', { x: e.x, y: e.y }); }
            }
          }
          var fl = surfaceBelow(P, e.x, e.y - 2);
          if (e.atkT > 0 && fl != null && e.y >= fl) { e.y = fl; e.state = 'stuck'; e.stuck = 1.0; e.atkT = 0; e.ground = true; emit('stuck', { x: e.x, y: e.y }); }
          if (e.y > F + 6 || e.x < 4 || e.x > spec.w - 4) { e.atkT = 0; e.cd = 1.6; }
          e.x = clamp(e.x, 6, spec.w - 6);
          return;
        }
        var gx = clamp(h.x + e.side * 46, 16, spec.w - 16), gy = e.fy + Math.sin(S.t * 2 + e.id) * 6;
        e.x += clamp(gx - e.x, -70 * dt, 70 * dt); e.y += clamp(gy - e.y, -60 * dt, 60 * dt); e.face = sgn(dx) || e.face;
        if (e.cd <= 0 && adx < 90 && tokens() < 2) { e.wind = 0.45; emit('windup', { x: e.x, y: e.y, type: 'nib' }); }
        if (e.cd <= 0 && rng() < 0.01) e.side = -e.side;
        return;
      }
      if (e.type === 'nib' && e.state === 'stuck') {
        e.stuck -= dt; if (e.stuck <= 0 && e.hurt <= 0) { e.state = 'idle'; e.ground = false; e.cd = 1.8 + rng(); e.vy = -40; }
        return;
      }
      // наземные: blot, guard
      e.vy = Math.min(K.FALLMAX, e.vy + K.G * dt);
      if (e.hurt > 0 || e.stun > 0) { if (e.ground) e.vx *= 0.82; moveBox(P, e, dt, walls); if (e.y > spec.h + 40) killEnemy(e, 'pit'); return; }
      if (e.atkT <= 0 && e.wind <= 0) e.face = sgn(dx) || e.face;
      var ahead = function (d) { return floorAt(P, e.x + e.face * d, e.y, 2); };
      if (e.type === 'blot') {
        if (e.wind > 0) { e.wind -= dt; e.vx = 0; if (e.wind <= 0) { e.vx = e.face * 150; e.vy = -150; e.ground = false; e.atkT = 0.32; e.didHit = false; emit('lunge', { x: e.x, y: e.y }); } }
        else if (e.atkT > 0) {
          e.atkT -= dt;
          if (!e.didHit && ov(e.x - e.w / 2 - 3, e.y - e.h - 2, e.w + 6, e.h + 4, h.x - h.w / 2, h.y - h.h, h.w, h.h)) { e.didHit = true; hurtHero(K.E.blot.dmg, e); }
          if (e.atkT <= 0) { e.cd = (1.0 + rng() * 0.6) * agg(); }
        } else if (adx < 26 && Math.abs(dy) < 22 && e.cd <= 0 && e.ground && tokens() < 2) { e.wind = 0.42; e.vx = 0; emit('windup', { x: e.x, y: e.y, type: 'blot' }); }
        else if (e.ground) {
          e.hop -= dt; e.vx *= 0.8;
          if (e.hop <= 0 && adx > 20) { if (ahead(14) && ahead(30)) { e.vx = e.face * 62; e.vy = -170; e.ground = false; emit('hop', {}); } e.hop = 0.55 + rng() * 0.45; }
        }
      } else { // guard
        if (e.wind > 0) { e.wind -= dt; e.vx = 0; if (e.wind <= 0) { e.atkT = 0.14; e.didHit = false; emit('swing', { x: e.x, y: e.y }); } }
        else if (e.atkT > 0) {
          e.atkT -= dt;
          if (!e.didHit) { var x0 = e.face > 0 ? e.x : e.x - 36; if (ov(x0, e.y - 28, 36, 26, h.x - h.w / 2, h.y - h.h, h.w, h.h)) { e.didHit = true; hurtHero(K.E.guard.dmg, e); } }
          if (e.atkT <= 0) e.cd = (1.3 + rng() * 0.6) * agg();
        } else if (adx < 32 && Math.abs(dy) < 24 && e.cd <= 0 && tokens() < 2) { e.wind = 0.5; e.vx = 0; emit('windup', { x: e.x, y: e.y, type: 'guard' }); }
        else if (adx > 26) { e.vx = ahead(10) ? e.face * 40 : 0; }
        else e.vx = 0;
      }
      moveBox(P, e, dt, walls);
      if (e.y > spec.h + 40) killEnemy(e, 'pit');
    }

    // ---------- босс ----------
    function spawnBoss() {
      var b = K.BOSS[spec.boss.type];
      S.boss = { type: spec.boss.type, x: spec.w - 90, y: spec.F, w: b.w, h: b.h, hp: b.hp, max: b.hp, vx: 0, vy: 0, face: -1, state: 'enter', t: 0, cd: 0, act: 0,
        contact: 0, ground: true, hurt: 0, spawnT: 5, warn: [], hover: 0 };
      if (S.boss.type === 'corrector') S.boss.y = spec.F - 70;
      emit('bossIn', { type: S.boss.type });
    }
    function bossVulnerable(src, sideFrom) {
      var B = S.boss; if (!B || B.state === 'enter' || B.state === 'down') return false;
      if (B.type === 'binder' && B.state !== 'stun' && (src === 'melee' || src === 'scis') && sideFrom === B.face) return false;
      return true;
    }
    function bossHit(dmg, src, dirx) {
      var B = S.boss, h = S.hero; if (!B) return false;
      var sideFrom = sgn((src === 'melee' ? h.x : B.x - (dirx || 0)) - B.x) || -B.face;
      if (!bossVulnerable(src, sideFrom)) { emit('eblock', { x: B.x + B.face * 14, y: B.y - B.h * 0.6, boss: 1 }); return 'blocked'; }
      B.hp -= dmg; B.hurt = 0.18; S.score += K.PTS.hit;
      emit('hit', { x: B.x, y: B.y - B.h * 0.6, dmg: dmg, big: true, boss: 1, src: src });
      if (B.hp <= 0) {
        B.hp = 0; B.state = 'down'; B.t = 0; S.score += K.PTS.boss;
        S.en.forEach(function (e) { if (alive(e)) killEnemy(e, 'boss'); });
        P.erased = {}; P.eraseWarn = {}; rebuildSolids(P);
        emit('bossDown', { type: B.type, x: B.x, y: B.y });
      }
      return true;
    }
    function updBoss(dt) {
      var B = S.boss, h = S.hero, F = spec.F; if (!B) return;
      B.t += dt; B.hurt = Math.max(0, B.hurt - dt); B.contact = Math.max(0, B.contact - dt);
      if (B.state === 'enter') { if (B.t > 1.3) { B.state = 'walk'; B.t = 0; } return; }
      if (B.state === 'down') { if (B.t > 1.6 && S.phase === 'play') { S.phase = 'ending'; S.phaseT = 0; S.ending = spec.boss.variant; S.endings.push(S.ch + spec.boss.variant); S.score += spec.boss.variant === 'A' ? K.PTS.endA : K.PTS.endB; emit('ending', { ch: S.ch, v: spec.boss.variant }); } return; }
      var dx = h.x - B.x, adx = Math.abs(dx), half = B.hp <= B.max / 2;
      // касание
      if (B.contact <= 0 && B.state !== 'stun' && ov(B.x - B.w / 2, B.y - B.h, B.w, B.h, h.x - h.w / 2, h.y - h.h, h.w, h.h)) { if (hurtHero(8, B, 'boss')) B.contact = 1; }
      if (B.type === 'queen') {
        B.spawnT -= dt;
        if (B.spawnT <= 0) { B.spawnT = half ? 6 : 8; if (liveCount() < 2) { spawnEnemy('blot', clamp(B.x - B.face * 30, 30, spec.w - 30), true); emit('spit', { x: B.x, y: B.y - 20 }); } }
        if (B.state === 'walk') {
          B.face = sgn(dx) || B.face; B.vx = B.face * (half ? 52 : 36);
          if (B.t > (half ? 1.6 : 2.3)) { B.state = 'wind'; B.t = 0; B.vx = 0; emit('windup', { x: B.x, y: B.y, type: 'queen' }); }
        } else if (B.state === 'wind') { B.vx = 0; if (B.t > 0.55) { B.state = 'leap'; B.t = 0; B.vx = clamp((h.x - B.x) / 0.62, -220, 220); B.vy = -400; B.ground = false; emit('leap', {}); } }
        else if (B.state === 'leap') { if (B.ground && B.t > 0.1) { B.state = 'recover'; B.t = 0; B.vx = 0; emit('slam', { x: B.x, y: F }); if (h.ground && Math.abs(h.x - B.x) < 84) hurtHero(12, B, 'unblockable'); } }
        else if (B.state === 'recover') { B.vx = 0; if (B.t > 0.8) { B.state = 'walk'; B.t = 0; } }
        B.vy = Math.min(K.FALLMAX, B.vy + K.G * dt); moveBox(P, B, dt, { L: true, R: true });
      } else if (B.type === 'binder') {
        if (B.state === 'walk') {
          B.face = sgn(dx) || B.face; var want = adx > 96 ? 1 : adx < 70 ? -1 : 0; B.vx = B.face * want * 46;
          B.cd -= dt;
          if (B.t > (half ? 1.3 : 1.8)) { B.t = 0; if (rng() < 0.62) { B.state = 'wind'; B.vx = 0; emit('windup', { x: B.x, y: B.y, type: 'binder' }); } else { B.state = 'toss'; B.vx = 0; } }
        } else if (B.state === 'wind') { B.vx = 0; if (B.t > 0.6) { B.state = 'charge'; B.t = 0; B.vx = B.face * (half ? 260 : 225); emit('charge', {}); } }
        else if (B.state === 'charge') {
          if (ov(B.x - B.w / 2, B.y - B.h, B.w, B.h, h.x - h.w / 2, h.y - h.h, h.w, h.h) && h.inv <= 0) { if (hurtHero(16, B, 'boss')) { B.state = 'recover'; B.t = 0; B.vx = 0; } }
        } else if (B.state === 'toss') {
          if (B.t > 0.35 && !B.tossed) { B.tossed = true; for (var k = 0; k < (half ? 2 : 1); k++) S.proj.push({ id: uid++, k: 'staple', x: B.x + B.face * 14, y: B.y - 24 + k * 14, vx: B.face * 190, vy: 0, t: 0, own: 'boss' }); emit('toss', {}); }
          if (B.t > 0.7) { B.state = 'walk'; B.t = 0; B.tossed = false; }
        } else if (B.state === 'stun') { B.vx = 0; if (B.t > 1.9) { B.state = 'walk'; B.t = 0; } }
        else if (B.state === 'recover') { B.vx = 0; if (B.t > 0.6) { B.state = 'walk'; B.t = 0; } }
        B.vy = Math.min(K.FALLMAX, B.vy + K.G * dt);
        var r = moveBox(P, B, dt, { L: true, R: true });
        if (B.state === 'charge' && (r.wl || r.wr)) { B.state = 'stun'; B.t = 0; B.vx = 0; emit('bonkWall', { x: B.x + B.face * 14, y: B.y - 20 }); }
      } else { // corrector
        var cw = spec.w / P.chunks;
        Object.keys(P.eraseWarn).forEach(function (i) { P.eraseWarn[i] -= dt; if (P.eraseWarn[i] <= 0) { delete P.eraseWarn[i]; P.erased[i] = 3.6; rebuildSolids(P); emit('erase', { x: (+i + 0.5) * cw, y: F }); } });
        Object.keys(P.erased).forEach(function (i) { P.erased[i] -= dt; if (P.erased[i] <= 0) { delete P.erased[i]; rebuildSolids(P); emit('restore', { x: (+i + 0.5) * cw }); } });
        var floatY = F - 70 + Math.sin(S.t * 2.2) * 4;
        if (B.state === 'walk') { // парит
          B.face = sgn(dx) || B.face;
          var gx = clamp(h.x + (B.x < h.x ? -70 : 70), 40, spec.w - 40);
          B.x += clamp(gx - B.x, -60 * dt, 60 * dt); B.y += clamp(floatY - B.y, -80 * dt, 80 * dt);
          if (B.t > (half ? 1.8 : 2.4)) {
            B.t = 0; B.act++;
            if (B.act % 3 === 0) { B.state = 'descend'; emit('descend', {}); }
            else if (B.act % 3 === 1) {
              var hc = clamp(Math.floor(h.x / cw), 0, P.chunks - 1), list = [hc];
              if (half) list.push(clamp(hc + (h.x > B.x ? 1 : -1) * (hc === 0 ? -1 : 1), 0, P.chunks - 1));
              if (half && list[1] === hc) list[1] = hc === 0 ? 1 : hc - 1;
              list.forEach(function (i) { if (!P.erased[i] && P.eraseWarn[i] == null) P.eraseWarn[i] = 1.0; });
              B.state = 'cast'; emit('windup', { x: B.x, y: B.y, type: 'corrector' });
            } else { B.state = 'toss'; }
          }
        } else if (B.state === 'cast') { if (B.t > 0.7) { B.state = 'walk'; B.t = 0; } }
        else if (B.state === 'toss') {
          if (B.t > 0.3 && !B.tossed) { B.tossed = true; for (var q = 0; q < (half ? 3 : 2); q++) S.proj.push({ id: uid++, k: 'putty', x: B.x, y: B.y - 20, vx: clamp((h.x - B.x) / 0.9, -200, 200) + (q - 0.5) * 40, vy: -170 - q * 30, t: 0, own: 'boss' }); emit('toss', {}); }
          if (B.t > 0.8) { B.state = 'walk'; B.t = 0; B.tossed = false; }
        } else if (B.state === 'descend') {
          B.y += 120 * dt; var ci = clamp(Math.floor(B.x / cw), 0, P.chunks - 1);
          if (P.erased[ci] || P.eraseWarn[ci] != null) { B.state = 'ascend'; B.t = 0; }
          else if (B.y >= F) { B.y = F; B.state = 'ground'; B.t = 0; if (liveCount() < 2) spawnEnemy('blot', clamp(B.x + (rng() < 0.5 ? -40 : 40), 30, spec.w - 30), true); emit('land', { x: B.x, y: F }); }
        } else if (B.state === 'ground') { if (B.t > 2.4) { B.state = 'ascend'; B.t = 0; } }
        else if (B.state === 'ascend') { B.y -= 110 * dt; if (B.y <= floatY) { B.state = 'walk'; B.t = 0; } }
      }
      B.x = clamp(B.x, B.w / 2, spec.w - B.w / 2);
    }

    // ---------- рвём бумагу ----------
    function tear(side, y, e) {
      P.tears.push({ side: side, y: clamp(y, 20, spec.F - 10), t: S.t });
      S.score += K.PTS.tear; S.tears++;
      var opened = false;
      if (spec.seal) { var fs = spec.dir > 0 ? 'R' : 'L'; if (side === fs && !P.sealOpen) { P.sealOpen = true; opened = true; } }
      emit('tear', { side: side, x: side === 'L' ? 0 : spec.w, y: y, opened: opened });
    }

    // ---------- атаки героя ----------
    function atkBox() {
      var h = S.hero, rch = K.REACH[h.combo];
      return { x: h.face > 0 ? h.x + 2 : h.x - 2 - rch, y: h.y - 24, w: rch, h: 18 };
    }
    function hitLevers(bx, by, bw, bh) {
      var any = false;
      if (spec.lever && !P.leverOn && ov(bx, by, bw, bh, spec.lever.x - 5, spec.lever.y - 20, 10, 20)) { P.leverOn = true; P.gateOpen = true; rebuildSolids(P); emit('lever', { x: spec.lever.x, y: spec.lever.y - 14 }); any = true; }
      if (spec.frame && P.frame === 'hang' && ov(bx, by, bw, bh, spec.frame.pin.x - 6, spec.frame.pin.y - 6, 12, 12)) { P.frame = 'fall'; P.frameT = 0; emit('pin', { x: spec.frame.pin.x, y: spec.frame.pin.y }); any = true; }
      return any;
    }
    function resolveMelee() {
      var h = S.hero, b = atkBox(), any = false, dmg = K.DMG[h.combo], kb = h.combo === 2 ? 170 : 70;
      S.en.forEach(function (e) {
        if (!alive(e) || e.held || e.state === 'spawn') return;
        if (ov(b.x, b.y, b.w, b.h, e.x - e.w / 2, e.y - e.h, e.w, e.h)) { any = true; hitEnemy(e, dmg, h.face * kb, 'melee'); }
      });
      var B = S.boss;
      if (B && B.state !== 'enter' && B.state !== 'down' && ov(b.x, b.y, b.w, b.h, B.x - B.w / 2, B.y - B.h, B.w, B.h)) { any = true; bossHit(dmg, 'melee'); }
      if (hitLevers(b.x, b.y, b.w, b.h)) any = true;
      if (any) return;
      // по стене / рамке / блоку — дороже
      var wall = (h.face > 0 && b.x + b.w >= spec.w - 1 && !exitOpen(P, 'R')) || (h.face < 0 && b.x <= 1 && !exitOpen(P, 'L'));
      if (!wall) for (var i = 0; i < P.sol.length; i++) { var s = P.sol[i]; if (!s.oneway && s.k !== 'floor' && s.k !== 'cover' && ov(b.x, b.y, b.w, b.h, s.x, s.y, s.w, s.h)) { wall = true; break; } }
      if (wall) { emit('wall', { x: h.x + h.face * 16, y: h.y - 16 }); spend(K.COST_WALL, 'wall'); }
      else { emit('whiff', { x: h.x + h.face * 18, y: h.y - 16 }); spend(K.COST_AIR, 'air'); }
    }
    function startAtk() {
      var h = S.hero;
      h.combo = h.comboWin > 0 ? (h.combo + 1) % 3 : 0;
      h.atk = h.atkLen = K.ATK_T[h.combo]; h.atkHit = false; h.comboWin = 0; h.queued = false;
      emit('swingHero', { combo: h.combo });
    }
    function throwHeld() {
      var h = S.hero, e = h.hold; if (!e) return;
      h.hold = null; e.held = false; e.thrown = true; e.state = 'idle'; e.tHits = {};
      e.x = h.x + h.face * 12; e.y = h.y - 4; e.vx = h.face * K.THROWV; e.vy = -120; e.ground = false;
      h.throwT = 0.22; emit('throw', { x: e.x, y: e.y });
    }
    function tryGrab() {
      var h = S.hero; if (h.hold) { throwHeld(); return; }
      if (!h.ground || h.atk > 0) return;
      var best = null, bd = 1e9;
      S.en.forEach(function (e) {
        if (!grabbable(e)) return;
        var d = (e.x - h.x) * h.face;
        if (d > -4 && d < 24 && Math.abs((e.y - e.h / 2) - (h.y - h.h / 2)) < 16 && d < bd) { bd = d; best = e; }
      });
      if (!best) { emit('grabMiss', {}); return; }
      h.hold = best; h.holdT = K.HOLD_T; best.held = true; best.wind = 0; best.atkT = 0; best.state = 'held';
      emit('grab', { x: best.x, y: best.y });
    }

    // ---------- инвентарь ----------
    function give(k) {
      for (var i = 0; i < 3; i++) if (!S.inv[i]) { S.inv[i] = k; return null; }
      var old = S.inv[S.sel]; S.inv[S.sel] = k; return old; // полна — меняем на выбранный
    }
    function hasItem(k) { return S.inv.indexOf(k) >= 0; }
    function useItem() {
      var h = S.hero, k = S.inv[S.sel];
      if (!k) { emit('empty', {}); return; }
      if (k === 'scis') {
        if (S.proj.some(function (p) { return p.k === 'scis'; })) return;
        S.proj.push({ id: uid++, k: 'scis', x: h.x + h.face * 8, y: h.y - 16, vx: h.face * 260, vy: 0, t: 0, back: false, hits: {}, own: 'hero' });
        spend(K.COST_SCIS, 'scis'); h.useT = 0.18; emit('useScis', {}); return;
      }
      if (k === 'flask') { S.inv[S.sel] = null; S.proj.push({ id: uid++, k: 'flask', x: h.x + h.face * 8, y: h.y - 20, vx: h.face * 150, vy: -160, t: 0, own: 'hero' }); h.useT = 0.2; emit('useFlask', {}); return; }
      if (k === 'mark') { S.inv[S.sel] = null; h.shield = K.SHIELD_T; emit('useMark', { x: h.x, y: h.y }); return; }
      if (k === 'pencil') {
        var sk = spec.sketch;
        if (sk && !P.drawn && h.ground && h.x >= sk.zone[0] && h.x <= sk.zone[1]) { S.inv[S.sel] = null; h.drawT = K.SKETCH_T; P.drawT = 0.001; emit('draw', { x: h.x, y: h.y }); }
        else emit('noSketch', { x: h.x, y: h.y - 30 });
      }
    }
    function explode(x, y) {
      emit('boom', { x: x, y: y });
      S.en.forEach(function (e) { if (alive(e) && e.state !== 'spawn' && Math.hypot(e.x - x, e.y - e.h / 2 - y) < 50) hitEnemy(e, 5, sgn(e.x - x) * 160, 'boom'); });
      var B = S.boss; if (B && Math.hypot(B.x - x, B.y - B.h / 2 - y) < 56) bossHit(5, 'boom', sgn(B.x - x));
      hitLevers(x - 30, y - 30, 60, 60);
    }
    function updProj(dt) {
      var h = S.hero;
      for (var i = S.proj.length - 1; i >= 0; i--) {
        var p = S.proj[i], kill = false; p.t += dt;
        if (p.k === 'scis') {
          if (!p.back && p.t > 0.42) { p.back = true; p.hits = {}; }
          if (p.back) { var tx = h.x - p.x, ty = (h.y - 16) - p.y, L = Math.hypot(tx, ty) || 1; p.vx = tx / L * 290; p.vy = ty / L * 290; if (L < 12 || p.t > 2.5) kill = true; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          S.en.forEach(function (e) { if (alive(e) && !e.held && e.state !== 'spawn' && !p.hits[e.id] && ov(p.x - 6, p.y - 6, 12, 12, e.x - e.w / 2, e.y - e.h, e.w, e.h)) { p.hits[e.id] = 1; hitEnemy(e, 2, sgn(p.vx) * 60, 'scis'); } });
          var B = S.boss; if (B && !p.hits.boss && B.state !== 'enter' && B.state !== 'down' && ov(p.x - 6, p.y - 6, 12, 12, B.x - B.w / 2, B.y - B.h, B.w, B.h)) { p.hits.boss = 1; bossHit(2, 'scis', sgn(p.vx)); }
          hitLevers(p.x - 6, p.y - 6, 12, 12);
          if (!p.back && (p.x < 4 || p.x > spec.w - 4)) { p.back = true; p.hits = {}; }
        } else if (p.k === 'flask') {
          p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          var hitE = S.en.some(function (e) { return alive(e) && e.state !== 'spawn' && !e.held && ov(p.x - 4, p.y - 4, 8, 8, e.x - e.w / 2, e.y - e.h, e.w, e.h); });
          var Bs = S.boss, hitB = Bs && Bs.state !== 'down' && ov(p.x - 4, p.y - 4, 8, 8, Bs.x - Bs.w / 2, Bs.y - Bs.h, Bs.w, Bs.h);
          var sol = P.sol.some(function (s) { return !s.oneway && p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h + 2; });
          if (hitE || hitB || sol || p.x < 2 || p.x > spec.w - 2 || p.y > spec.h) { explode(p.x, Math.min(p.y, spec.F - 4)); kill = true; }
        } else if (p.k === 'staple') {
          p.x += p.vx * dt;
          if (ov(p.x - 5, p.y - 2, 10, 4, h.x - h.w / 2, h.y - h.h, h.w, h.h)) { hurtHero(6, { x: p.x - p.vx }, 'staple'); kill = true; }
          if (p.x < 0 || p.x > spec.w) kill = true;
        } else if (p.k === 'putty') {
          p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (ov(p.x - 5, p.y - 5, 10, 10, h.x - h.w / 2, h.y - h.h, h.w, h.h)) { hurtHero(7, { x: p.x - p.vx * 0.1 }, 'putty'); kill = true; }
          if (p.y >= spec.F || p.x < 0 || p.x > spec.w) { kill = true; emit('splat', { x: p.x, y: Math.min(p.y, spec.F) }); }
        }
        if (kill) S.proj.splice(i, 1);
      }
    }

    // ---------- герой ----------
    function edge(k) { return !!inp[k] && !prev[k]; }
    function updHero(dt) {
      var h = S.hero;
      h.inv = Math.max(0, h.inv - dt); h.hurt = Math.max(0, h.hurt - dt); h.comboWin = Math.max(0, h.comboWin - dt);
      h.throwT = Math.max(0, h.throwT - dt); h.useT = Math.max(0, h.useT - dt); h.shield = Math.max(0, h.shield - dt);
      if (inp.sel >= 1 && inp.sel <= 3) S.sel = inp.sel - 1;
      if (edge('slot')) { S.sel = (S.sel + 1) % 3; emit('slot', { sel: S.sel }); }
      // рисование карандашом — герой занят
      if (h.drawT > 0) {
        h.drawT -= dt; h.vx = 0; P.drawT = 1 - h.drawT / K.SKETCH_T;
        if (h.drawT <= 0) { P.drawn = true; P.drawT = 1; rebuildSolids(P); emit('drawn', { x: h.x }); }
        h.vy = Math.min(K.FALLMAX, h.vy + K.G * dt); moveBox(P, h, dt, { L: true, R: true }); return;
      }
      if (h.hold) { h.holdT -= dt; if (h.holdT <= 0 || !alive(h.hold)) { emit('escape', {}); releaseHold(); h.hurt = 0.15; } }
      var busy = h.hurt > 0;
      if (!busy && h.atk <= 0 && inp.x) h.face = inp.x > 0 ? 1 : -1;
      h.block = !busy && inp.block && h.ground && h.atk <= 0 && !h.hold;
      if (!busy) {
        if (edge('grab')) tryGrab();
        if (edge('use') && !h.hold) useItem();
        if (edge('atk')) {
          if (h.hold) throwHeld();
          else if (!h.ground) { if (!h.jkUsed && h.jk <= 0) { h.jk = K.JK_T; h.jkUsed = true; h.jkHits = {}; h.jkAny = false; emit('jkick', {}); } }
          else if (!h.block) { if (h.atk > 0) h.queued = true; else startAtk(); }
        }
      }
      // атака на земле
      if (h.atk > 0) {
        h.atk -= dt;
        if (!h.atkHit && h.atkLen - h.atk >= 0.07) { h.atkHit = true; resolveMelee(); if (S.phase !== 'play') return; }
        if (h.atk <= 0) { h.atk = 0; h.comboWin = K.COMBO_WIN; if (h.queued) startAtk(); }
      }
      // удар в прыжке
      if (h.jk > 0) {
        h.jk -= dt;
        var bx = h.face > 0 ? h.x + 2 : h.x - 26, by = h.y - 22;
        S.en.forEach(function (e) { if (alive(e) && !e.held && e.state !== 'spawn' && !h.jkHits[e.id] && ov(bx, by, 24, 32, e.x - e.w / 2, e.y - e.h, e.w, e.h)) { h.jkHits[e.id] = 1; h.jkAny = true; hitEnemy(e, K.JK_DMG, h.face * 150, 'jk'); } });
        var B = S.boss; if (B && !h.jkHits.boss && B.state !== 'enter' && B.state !== 'down' && ov(bx, by, 24, 32, B.x - B.w / 2, B.y - B.h, B.w, B.h)) { h.jkHits.boss = 1; h.jkAny = true; bossHit(K.JK_DMG, 'jk'); }
        if (hitLevers(bx, by, 24, 32)) h.jkAny = true;
        if (h.jk <= 0 || h.ground) { if (!h.jkAny) { emit('whiff', { x: h.x + h.face * 18, y: h.y - 12 }); spend(K.COST_AIR, 'air'); } h.jk = 0; }
      }
      // движение
      if (busy) { if (h.ground) h.vx *= 0.85; }
      else if (h.block || (h.atk > 0 && h.ground) || h.throwT > 0) h.vx = 0;
      else h.vx = (inp.x || 0) * K.RUN * (h.hold ? 0.6 : 1);
      if (h.ground) { h.coyote = K.COYOTE; h.jkUsed = false; } else h.coyote -= dt;
      if (!busy && edge('jump') && h.coyote > 0 && !h.block && !h.hold && h.atk <= 0) { h.vy = -K.JUMPV; h.ground = false; h.coyote = 0; emit('jump', {}); }
      h.vy = Math.min(K.FALLMAX, h.vy + K.G * dt);
      var wasGround = h.ground;
      var walls = { L: !exitOpen(P, 'L'), R: !exitOpen(P, 'R') };
      moveBox(P, h, dt, walls);
      if (h.ground && !wasGround) emit('land', { x: h.x, y: h.y });
      if (h.ground && Math.abs(h.vx) > 1) h.walkT += dt;
      // выходы
      if (h.x - h.w / 2 > spec.w - 2 && exitOpen(P, 'R')) { goExitSide('R'); return; }
      if (h.x + h.w / 2 < 2 && exitOpen(P, 'L')) { goExitSide('L'); return; }
      if (h.y > spec.h + 6) {
        var ex = spec.exits.filter(function (e) { return e.s === 'D' && P.cleared && h.x > e.hole.x0 - 4 && h.x < e.hole.x1 + 4; })[0];
        if (ex) { goExit(ex); return; }
        if (h.y > spec.h + 30) dropBetween();
      }
    }
    function goExitSide(side) { var ex = spec.exits.filter(function (e) { return e.s === side; })[0]; if (ex) goExit(ex); }
    function dropBetween() {
      var h = S.hero; emit('fall', { x: h.x });
      if (h.hold) releaseHold();
      P.dmgTaken += K.PIT_DMG;
      if (spec.kind === 'boss') { // на безопасный кусок пола
        var cw = spec.w / (P.chunks || 1), best = 0, bd = 1e9;
        for (var i = 0; i < (P.chunks || 1); i++) if (!P.erased[i] && P.eraseWarn[i] == null) { var d = Math.abs((i + 0.5) * cw - h.x); if (d < bd) { bd = d; best = i; } }
        h.x = (best + 0.5) * cw; h.y = 4 + h.h;
      } else { h.x = spec.entry.x; h.y = spec.F; }
      h.vx = 0; h.vy = 0; h.inv = 1;
      if (!opts.god) { h.hp -= K.PIT_DMG; emit('ink', { n: K.PIT_DMG, why: 'pit', x: h.x, y: h.y - 14 }); if (h.hp <= 0) die('pit'); }
    }

    // ---------- предметы ----------
    function updItems(dt) {
      var h = S.hero;
      for (var i = S.items.length - 1; i >= 0; i--) {
        var it = S.items[i]; it.cd = Math.max(0, it.cd - dt);
        if (it.cd > 0 || Math.abs(it.x - h.x) > 12 || Math.abs(it.y - h.y) > 22) continue;
        var k = it.k;
        if (k === 'ink' || k === 'drop') { if (h.hp >= K.INK) continue; h.hp = Math.min(K.INK, h.hp + (k === 'ink' ? K.HEAL_POT : K.HEAL_DROP)); S.items.splice(i, 1); emit('heal', { x: it.x, y: it.y - 10, n: k === 'ink' ? K.HEAL_POT : K.HEAL_DROP }); continue; }
        if (k === 'letter') { S.score += K.PTS.letter; S.items.splice(i, 1); emit('letter', { x: it.x, y: it.y - 10 }); continue; }
        if (k === 'sheet') { if (S.lives < K.LIVES) { S.lives++; emit('sheet', { x: it.x, y: it.y - 10 }); } else { S.score += K.PTS.sheet; emit('letter', { x: it.x, y: it.y - 10, pts: K.PTS.sheet }); } S.items.splice(i, 1); continue; }
        var old = give(k); S.items.splice(i, 1); emit('pick', { k: k, x: it.x, y: it.y - 10, swap: old });
        if (old) S.items.push({ id: uid++, k: old, x: h.x, y: h.y, cd: 1.2 });
      }
      // подставка с карандашами: даёт карандаш, если его нет
      if (S.stand && !P.drawn && !hasItem('pencil') && Math.abs(S.stand.x - h.x) < 14 && h.y > spec.F - 4) {
        var o2 = give('pencil'); emit('pick', { k: 'pencil', x: S.stand.x, y: spec.F - 20, swap: o2 });
        if (o2) S.items.push({ id: uid++, k: o2, x: h.x, y: h.y, cd: 1.2 });
      }
    }

    // ---------- панель: волны, зачистка, механизмы ----------
    function updPanel(dt) {
      var F = spec.F;
      if (P.frame === 'fall') {
        P.frameT += dt; P.frameY = spec.frame.hangY + (F - spec.frame.hangY) * Math.min(1, (P.frameT / 0.42) * (P.frameT / 0.42));
        if (P.frameT >= 0.42) {
          P.frame = 'down'; P.frameY = F; rebuildSolids(P); emit('frameDown', { x: spec.frame.rect.x + 44, y: F });
          var r = spec.frame.rect; S.en.forEach(function (e) { if (alive(e) && e.x > r.x - 4 && e.x < r.x + r.w + 4 && e.y > F - 40) hitEnemy(e, 6, 0, 'frame'); });
        }
      }
      if (spec.kind === 'boss') {
        if (!S.boss) { P.bossT -= dt; if (P.bossT <= 0) spawnBoss(); }
        return;
      }
      if (!P.cleared) {
        if (liveCount() === 0) {
          if (P.wave < spec.waves.length) {
            P.waveT -= dt;
            if (P.waveT <= 0) { var wv = spec.waves[P.wave++]; wv.forEach(function (t, i) { spawnEnemy(t, spec.spawns[i % spec.spawns.length] + (i >= spec.spawns.length ? 10 : 0), true); }); P.waveT = 0.9; }
          } else { P.cleared = true; rebuildSolids(P); S.score += K.PTS.clear; emit('clear', { id: spec.id }); }
        }
      } else if (spec.seal && !P.sealOpen) {
        // запечатанная рамка: пока не порвана — из-за кадра вытекает новая клякса
        if (liveCount() === 0) { P.reseedT += dt; if (P.reseedT > 1.4) { P.reseedT = 0; spawnEnemy('blot', spec.spawns[spec.dir > 0 ? spec.spawns.length - 1 : 0], true); } }
      }
    }

    function update(dt) { if (!S) return; step(dt); prev = Object.assign({}, inp); }
    function step(dt) {
      S.t += dt; S.phaseT += dt;
      if (S.phase === 'trans') { if (S.phaseT >= 0.55) { S.phase = 'play'; S.phaseT = 0; } return; }
      if (S.phase === 'turn') {
        if (S.phaseT >= 1.3) {
          S.phase = 'play'; S.phaseT = 0;
          if (S.pg < LV.PAGES) S.pg++; else { S.pg = 1; S.ch++; }
          startPage();
        }
        return;
      }
      if (S.phase === 'ending') {
        if (S.phaseT >= 4.2) {
          if (S.ch >= LV.COUNT) { S.phase = 'won'; S.phaseT = 0; emit('win', {}); }
          else { S.ch++; S.pg = 1; S.phase = 'play'; S.phaseT = 0; S.ending = null; emit('chapter', { ch: S.ch }); startPage(); }
        }
        return;
      }
      if (S.phase === 'dead') {
        if (S.phaseT >= 1.6) {
          S.lives--;
          if (S.lives <= 0) { S.lives = 0; S.phase = 'over'; S.phaseT = 0; emit('gameover', {}); }
          else { S.phase = 'play'; S.phaseT = 0; respawnPanel(); emit('respawn', {}); }
        }
        return;
      }
      if (S.phase !== 'play') return;
      updHero(dt);
      if (S.phase !== 'play') return;
      for (var i = 0; i < S.en.length; i++) updEnemy(S.en[i], dt);
      S.en = S.en.filter(function (e) { return !(e.state === 'dead' && e.st > 0.6); });
      updBoss(dt); updProj(dt); updItems(dt); updPanel(dt);
    }
    function setInput(o) {
      inp = { x: o.x || 0, jump: !!o.jump, atk: !!o.atk, block: !!o.block, grab: !!o.grab, use: !!o.use, slot: !!o.slot, sel: o.sel || 0 };
    }
    function start() {
      init();
      S._enterFrom = 'F';
      startPage();
      if (opts.pid) { S.route = []; enterPanel(opts.pid, opts.from || 'F'); S._enterFrom = opts.from || 'F'; S.prevPid = null; }
      return api;
    }
    var api = {
      start: start, update: update, setInput: setInput,
      state: function () { return S; }, panel: function () { return P; }, spec: function () { return spec; },
      exitOpen: function (side) { return exitOpen(P, side); },
      restartPanel: function () { if (S.phase === 'play') { S.hero.hp = 0; die('hurt'); } },
      // тест-хуки
      _spawn: function (t, x, drip) { return spawnEnemy(t, x, !!drip); },
      _clearEnemies: function () { S.en = []; P.wave = spec.waves.length; },
      _hurt: function (n, src) { return hurtHero(n, src || { x: S.hero.x + S.hero.face * 10 }); },
      _goto: function (ch, pg, pid, from) { S.ch = ch; S.pg = pg; S.route = []; enterPanel(pid, from || 'F'); S._enterFrom = from || 'F'; S.phase = 'play'; S.phaseT = 0; S.prevPid = null; },
      _place: function (x, y) { var h = S.hero; h.x = x; h.y = y == null ? spec.F : y; h.vx = 0; h.vy = 0; h.ground = true; },
      _give: function (k) { return give(k); },
      _solids: function () { rebuildSolids(P); return P.sol; },
      _boss: function () { spawnBoss(); return S.boss; },
      K: K
    };
    return api;
  }

  LIST.logic = { K: K, Game: Game, mulberry32: mulberry32, moveBox: moveBox, makeRuntime: makeRuntime, rebuildSolids: rebuildSolids };
  LIST.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
