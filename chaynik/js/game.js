/* ЧАЙНИК · game.js — логика игры без DOM (детерминирована при заданном seed; состояние — чистый JSON).
   CHAYNIK.Game(opts) → { start, update(dt), setInput(i), state(), snapshot(), restore(s), ...тест-хуки }.
   Режимы уровней: plat (1, 3), race (2), puzzle (4), fly (5), boss (6). Общие системы: пар (струя из носика,
   перегрев), кипяток (мощный выстрел по заряду), ручка-хват (крюки, раскачка), жизни, продолжения, счёт.
   CHAYNIK.puzzle — чистые правила головоломки (для игры, поиска решения в тестах и подсказок). */
(function (global) {
  'use strict';
  var CH = global.CHAYNIK = global.CHAYNIK || {};
  var LVL = CH.levels, T = LVL.T, C = LVL.C;

  var K = {
    G: 1500, RUN: 170, ACC: 1300, AIRACC: 900, FRIC: 1600, JUMP: 520, JCUT: 240, COY: 0.08, BUF: 0.12, MAXF: 640,
    HW: 10, HH: 24,
    // вода (уровень 3)
    WG: 520, WMAXF: 120, WRUN: 120, WJUMP: 300, STROKE: 90, STROKE_CD: 0.6, WARM_DRAIN: 1 / 40, WARM_FIRE: 0.08, BUBBLE_WARM: 0.6,
    // пар и перегрев
    HEAT_UP: 0.42, HEAT_COOL: 0.32, HEAT_OVERCOOL: 0.45, HEAT_RESUME: 0.25, TAP_COOL: 1.8, COOL_DELAY: 0.25,
    PUFF_GAP: 0.05, PUFF_V: 380, PUFF_LIFE: 0.24, PUFF_DMG: 0.35, HOVER: 1750,
    // кипяток
    CHARGE_UP: 0.07, CHARGE_BOSS: 0.16, LEAF: 0.34, BOIL_V: 430, BOIL_LIFE: 0.7, BOIL_DMG: 5, BOIL_HEAT: 0.35,
    // ручка-хват
    GRAB_R: 48, LMIN: 30, LMAX: 76, PUMP: 7, SWING_DAMP: 0.4, RELEASE_UP: 230,
    // прочее
    // гонка
    R_SLOPE: 900, R_LEAN: 60, R_BRAKE: 320, R_BOOST: 300, R_DRAG: 0.0008, R_MAX: 500,
    HP: 3, INV: 1.3, LIVES: 3, CONT: 2, EXTRA: 25000, MAG_R: 120, MAG_PULL: 3200
  };
  var EN = {
    beetle: { w: 22, h: 12, hp: 2, pts: 100 }, pea: { w: 14, h: 14, hp: 1, pts: 150 }, fly: { w: 16, h: 12, hp: 1, pts: 120 },
    toaster: { w: 28, h: 22, hp: 4, pts: 300 }, leaffish: { w: 20, h: 10, hp: 1, pts: 120 }, pip: { w: 12, h: 14, hp: 1, pts: 120 },
    // полёт
    ffly: { w: 20, h: 16, hp: 0.7, pts: 100 }, moth: { w: 24, h: 18, hp: 2, pts: 150 }, pop: { w: 18, h: 18, hp: 2, pts: 200 },
    flake: { w: 12, h: 12, hp: 1, pts: 50 }, bee: { w: 24, h: 20, hp: 2, pts: 250 }
  };
  var BOSS = { sugar: { hp: 4, w: 46, h: 40 }, teapot: { hp: 5, w: 58, h: 52 }, creamer: { hp: 4, w: 38, h: 44 } };
  var PAR = { 1: 150, 2: 40, 3: 120, 4: 90, 5: 100, 6: 150 };

  function rnd(S) { var a = S.rs = (S.rs + 0x6D2B79F5) | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ov(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }

  // ---------- клетки ----------
  function tile(LV, c, r) { if (c < 0 || c >= LV.w) return C.S; if (r < 0 || r >= LV.h) return C.E; return LV.t[r * LV.w + c]; }
  function isSolid(v) { return v === C.S || v === C.W || v === C.X; }
  function solidAt(LV, x, y) { return isSolid(tile(LV, Math.floor(x / T), Math.floor(y / T))); }
  function burnerOn(LV, c, r, t) {
    for (var i = 0; i < LV.cycle.length; i++) { var q = LV.cycle[i]; if (r === q.r && c >= q.c0 && c <= q.c1) return ((t + q.ph) % q.per) < q.on; }
    return true;
  }

  // ---------- головоломка (чистые правила) ----------
  var PZ = (function () {
    var D = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
    function parse(P) {
      var m = P.map, h = m.length, w = m[0].length, st = { x: 0, y: 0, f: 'R', carry: false, sx: 0, sy: 0, crumbs: [], cups: [], clock: true, t: 0, heat: 0 };
      var walls = [], burners = [], taps = [], goal = null, clock = null;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var ch = m[y][x];
        if (ch === '#') walls.push(y * w + x);
        else if (ch === 'P') { st.x = x; st.y = y; }
        else if (ch === 'S') { st.sx = x; st.sy = y; }
        else if (ch === ',') st.crumbs.push(y * w + x);
        else if (ch === 'o') st.cups.push(y * w + x);
        else if (ch === 'B') burners.push(y * w + x);
        else if (ch === 'W') taps.push(y * w + x);
        else if (ch === 'G') goal = y * w + x;
        else if (ch === 'Z') clock = y * w + x;
      }
      return { w: w, h: h, walls: walls, burners: burners, taps: taps, goal: goal, clockAt: clock, limit: P.limit, per: P.burnPer, on: P.burnOn, init: st };
    }
    function clone(s) { return { x: s.x, y: s.y, f: s.f, carry: s.carry, sx: s.sx, sy: s.sy, crumbs: s.crumbs.slice(), cups: s.cups.slice(), clock: s.clock, t: s.t, heat: s.heat }; }
    function burnOn(B, t) { return (t % B.per) < B.on; }
    // act: 'U','D','L','R' — шаг; 'pU'… — пар в сторону. → { s, moved, fail: null|'crunch'|'melt'|'puff'|'alarm', done, ev:[] }
    function step(B, s0, act) {
      var s = clone(s0), ev = [], puff = act.length === 2, d = puff ? act[1] : act, v = D[d], i, fail = null, done = false, moved = false;
      s.f = d;
      var W = B.w, idx = function (x, y) { return y * W + x; };
      var wall = function (k) { return B.walls.indexOf(k) >= 0; };
      if (puff) {
        if (s.heat >= 3) return { s: s, moved: false, fail: null, done: false, ev: ['hot'] };
        s.heat++; s.t++; moved = true; ev.push('puff');
        if (s.carry) fail = 'puff';
        else for (i = 1; i <= 3; i++) {
          var px = s.x + v[0] * i, py = s.y + v[1] * i, k = idx(px, py);
          if (wall(k) || s.cups.indexOf(k) >= 0 || (!s.carry && px === s.sx && py === s.sy)) break;
          var ci = s.crumbs.indexOf(k); if (ci >= 0) { s.crumbs.splice(ci, 1); ev.push('blow:' + k); break; }
        }
      } else {
        var nx = s.x + v[0], ny = s.y + v[1], nk = idx(nx, ny);
        if (wall(nk)) return { s: s, moved: false, fail: null, done: false, ev: ['bump'] };
        var cup = s.cups.indexOf(nk);
        if (cup >= 0) {
          var bx = nx + v[0], by = ny + v[1], bk = idx(bx, by);
          if (wall(bk) || s.cups.indexOf(bk) >= 0 || (!s.carry && bx === s.sx && by === s.sy) || bk === B.goal || bk === B.clockAt || B.taps.indexOf(bk) >= 0) return { s: s, moved: false, fail: null, done: false, ev: ['bump'] };
          s.cups[cup] = bk; ev.push('push');
          var cc = s.crumbs.indexOf(bk); if (cc >= 0) { s.crumbs.splice(cc, 1); ev.push('squash'); }
        }
        s.x = nx; s.y = ny; s.t++; moved = true; ev.push('step');
        if (!s.carry && nx === s.sx && ny === s.sy) { s.carry = true; ev.push('pick'); }
        if (s.carry && s.crumbs.indexOf(nk) >= 0) fail = 'crunch';
        if (s.carry && !fail && B.burners.indexOf(nk) >= 0 && burnOn(B, s.t)) fail = 'melt';
        if (B.taps.indexOf(nk) >= 0 && s.heat) { s.heat = 0; ev.push('cool'); }
        if (nk === B.clockAt && s.clock) { s.clock = false; ev.push('clockOff'); }
        if (nk === B.goal && s.carry && !fail) done = true;
      }
      if (!fail && !done && s.clock && s.t >= B.limit) fail = 'alarm';
      return { s: s, moved: moved, fail: fail, done: done, ev: ev };
    }
    function key(B, s) { return s.x + ',' + s.y + ',' + (s.carry ? 1 : 0) + ',' + s.crumbs.join('.') + ',' + s.cups.slice().sort().join('.') + ',' + (s.clock ? 'c' + s.t : 'o' + (s.t % B.per)) + ',' + s.heat; }
    // поиск решения в ширину → массив действий или null
    function solve(B, s0, maxStates, acts) {
      var start = s0 || B.init, seen = new Set([key(B, start)]);
      acts = acts || ['U', 'D', 'L', 'R', 'pU', 'pD', 'pL', 'pR'];
      var nodes = [{ s: start, p: -1, a: null }], head = 0;
      maxStates = maxStates || 3e6;
      while (head < nodes.length && nodes.length < maxStates) {
        var n = nodes[head], ni = head++;
        for (var i = 0; i < acts.length; i++) {
          var r = step(B, n.s, acts[i]); if (!r.moved || r.fail) continue;
          if (r.done) { var path = [acts[i]], j = ni; while (j > 0) { path.unshift(nodes[j].a); j = nodes[j].p; } return path; }
          var k = key(B, r.s); if (seen.has(k)) continue; seen.add(k);
          nodes.push({ s: r.s, p: ni, a: acts[i] });
        }
      }
      return null;
    }
    return { parse: parse, step: step, solve: solve, key: key, burnOn: burnOn, D: D };
  })();
  CH.puzzle = PZ;
  var PB = PZ.parse(LVL.PUZZLE);

  // ---------- гонка: высота трассы ----------
  var TRACK = LVL.raceTrack();
  function trackY(x) { var i = x / TRACK.step, i0 = Math.max(0, Math.floor(i)), f = i - i0; var a = TRACK.ys[Math.min(i0, TRACK.ys.length - 1)], b = TRACK.ys[Math.min(i0 + 1, TRACK.ys.length - 1)]; return a + (b - a) * f; }
  function holeAt(x) { for (var i = 0; i < TRACK.obs.length; i++) { var o = TRACK.obs[i]; if (o.k === 'hole' && x > o.x && x < o.x + o.w) return o; } return null; }
  function rivalSpeed(x) { var v = TRACK.rival.v, s = v[0][1]; for (var i = 0; i < v.length; i++) if (x >= v[i][0]) s = v[i][1]; return s; }

  CH.Game = function (opts) {
    opts = opts || {};
    var onEvent = opts.onEvent || function () {}, quiet = 0, S = null, LV = null;
    function emit(t, d) { if (!quiet) onEvent(t, d || {}); }

    function newState() {
      return {
        level: 1, score: 0, lives: opts.lives || K.LIVES, cont: opts.continues == null ? K.CONT : opts.continues, nextLife: K.EXTRA,
        phase: 'play', phaseT: 0, t: 0, lvT: 0, rs: (opts.seed || 1) >>> 0, god: !!opts.god,
        heat: 0, over: false, coolT: 0, charge: 0, warm: 1, deaths: 0, lvDeaths: 0, deathKind: null,
        inp: { x: 0, y: 0, jump: false, fire: false, boil: false }, prev: { jump: false, fire: false, boil: false, x: 0, y: 0 },
        hero: null, enemies: [], puffs: [], eshots: [], drops: [], got: {}, magOff: {}, cp: null, idleT: 0, idleStage: 0,
        race: null, pz: null, fly: null, boss: null, won: false, overGame: false, banner: null, lastClear: null
      };
    }
    function newHero(x, y) { return { x: x, y: y, vx: 0, vy: 0, ground: false, face: 1, coy: 0, jbuf: 0, jhold: false, hp: K.HP, inv: 0, hook: null, hookCd: 0, aim: 'f', firing: false, puffT: 0, stroke: 0, water: false, anim: 0, land: 0, swingT: 0, carry: false }; }

    function addScore(n) {
      S.score += n;
      while (S.score >= S.nextLife) { S.nextLife += K.EXTRA; S.lives++; emit('life'); }
    }

    // ---------- загрузка уровня ----------
    function loadLevel(n) {
      S.level = n; S.lvT = 0; S.lvDeaths = 0; S.phase = 'play'; S.phaseT = 0; S.puffs = []; S.eshots = []; S.drops = []; S.enemies = [];
      S.got = {}; S.magOff = {}; S.heat = 0; S.over = false; S.warm = 1; S.idleT = 0; S.idleStage = 0;
      S.race = S.pz = S.fly = S.boss = null; S.cp = null;
      var kind = LVL.KINDS[n]; S.kind = kind;
      LV = LVL.build(n);
      if (kind === 'plat' || kind === 'boss') {
        S.hero = newHero(LV.start.x, LV.start.y);
        S.enemies = LV.enemies.map(function (e) { return spawnEnemy(e); });
        S.cp = { x: LV.start.x, y: LV.start.y, id: null };
        if (kind === 'boss') initBoss();
      } else if (kind === 'race') initRace();
      else if (kind === 'puzzle') initPuzzle();
      else if (kind === 'fly') initFly(0);
      emit('level', { n: n, kind: kind });
    }
    function spawnEnemy(e) {
      var d = EN[e.k], o = { id: e.id, k: e.k, x: e.x, y: e.y, vx: 0, vy: 0, hp: d.hp, dir: -1, t: 0, cd: 1 + (e.x % 7) * 0.2, x0: e.x0 == null ? e.x - 80 : e.x0, x1: e.x1 == null ? e.x + 80 : e.x1, y0: e.y, dead: false, flash: 0, ground: true };
      if (e.k === 'fly' || e.k === 'pip' || e.k === 'leaffish') o.ground = false;
      return o;
    }

    // ---------- общий пар / перегрев / заряд ----------
    function heatTick(dt, firing, coolMul, buildMul) {
      if (firing) { S.heat += K.HEAT_UP * (buildMul || 1) * dt; S.coolT = K.COOL_DELAY; if (S.heat >= 1) { S.heat = 1; S.over = true; emit('overheat'); } }
      else {
        if (S.coolT > 0) S.coolT -= dt;
        else S.heat = Math.max(0, S.heat - (S.over ? K.HEAT_OVERCOOL : K.HEAT_COOL) * (coolMul || 1) * dt);
        if (coolMul > 1.5) S.heat = Math.max(0, S.heat - K.TAP_COOL * dt);
        if (S.over && S.heat <= K.HEAT_RESUME) { S.over = false; emit('cooled'); }
      }
      if (!firing) S.charge = Math.min(1, S.charge + (S.kind === 'boss' ? K.CHARGE_BOSS : K.CHARGE_UP) * dt);
    }
    function canFire() { return !S.over; }
    function wantBoil() { return S.inp.boil && !S.prev.boil; }
    function useBoil() {
      if (S.charge < 1) { emit('noCharge'); return false; }
      S.charge = 0; S.heat = Math.min(1, S.heat + K.BOIL_HEAT); if (S.heat >= 1) { S.over = true; emit('overheat'); }
      return true;
    }

    // ---------- платформер: физика героя ----------
    function inWater(h) { return !!(LV.water && h.y - K.HH / 2 > LV.surface); }
    function hurtHero(n, fromX) {
      var h = S.hero; if (S.god || h.inv > 0 || S.phase !== 'play') return;
      h.hp -= n; h.inv = K.INV; h.hook = null;
      h.vx = (h.x < fromX ? -1 : 1) * 160; h.vy = -260; h.ground = false;
      emit('hurt', { hp: h.hp, x: h.x, y: h.y });
      if (h.hp <= 0) die('crack');
    }
    function die(kind) {
      if (S.phase !== 'play') return;
      if (S.god && kind !== 'fall') { return; }
      S.phase = 'dead'; S.phaseT = 0; S.deathKind = kind; S.deaths++; S.lvDeaths++;
      var h = S.hero; if (h) { h.hook = null; h.vx = 0; h.vy = kind === 'fall' ? 0 : -120; }
      emit('die', { kind: kind, x: h ? h.x : 0, y: h ? h.y : 0 });
    }
    function godFall() {   // в режиме god (тесты) падение возвращает на чекпойнт без потери жизни
      var h = S.hero; h.x = S.cp.x; h.y = S.cp.y; h.vx = h.vy = 0; h.hook = null;
    }

    function moveHero(h, dt) {
      var water = inWater(h);
      // X
      h.x += h.vx * dt;
      var top = h.y - K.HH + 1, bot = h.y - 1, r0 = Math.floor(top / T), r1 = Math.floor(bot / T);
      if (h.vx > 0) { var cR = Math.floor((h.x + K.HW) / T); for (var r = r0; r <= r1; r++) if (isSolid(tile(LV, cR, r))) { h.x = cR * T - K.HW - 0.01; h.vx = 0; break; } }
      else if (h.vx < 0) { var cL = Math.floor((h.x - K.HW) / T); for (var r2 = r0; r2 <= r1; r2++) if (isSolid(tile(LV, cL, r2))) { h.x = (cL + 1) * T + K.HW + 0.01; h.vx = 0; break; } }
      // Y
      var py = h.y; h.y += h.vy * dt; h.ground = false;
      var c0 = Math.floor((h.x - K.HW + 1) / T), c1 = Math.floor((h.x + K.HW - 1) / T), c;
      if (h.vy >= 0) {
        var rf = Math.floor(h.y / T);
        for (c = c0; c <= c1; c++) {
          var v = tile(LV, c, rf);
          if (isSolid(v) || (v === C.P && py <= rf * T + 0.5 && !(S.inp.y > 0 && S.inp.jump))) { h.y = rf * T; h.vy = 0; h.ground = true; if (v === C.X) touchForks(h, c); break; }
        }
      } else {
        var rh = Math.floor((h.y - K.HH) / T);
        for (c = c0; c <= c1; c++) if (isSolid(tile(LV, c, rh))) { h.y = (rh + 1) * T + K.HH; h.vy = 0; break; }
      }
      return water;
    }
    // конфорка: ожог (−1) и подброс вверх; последний ожог — «выкипел»
    function burn(h, c) {
      if (h.inv > 0 || S.god) { if (h.vy > -300) { h.vy = -560; h.ground = false; } return; }
      if (h.hp <= 1) { h.hp = 0; die('boil'); return; }
      hurtHero(1, h.x - h.face); h.vy = -600; h.vx = h.face * 120; h.ground = false; emit('scald', { x: h.x, y: h.y });
    }
    function touchForks(h, c) { if (h.inv <= 0 && !S.god) { hurtHero(1, c * T + 8); if (S.phase === 'play') { h.vy = -420; h.ground = false; } } }

    function platHero(dt) {
      var h = S.hero, I = S.inp, water = inWater(h), wasGround = h.ground;
      var jumpEdge = I.jump && !S.prev.jump;
      var anyInput = I.x || I.y || I.jump || I.fire || I.boil;
      h.anim += dt; if (h.inv > 0) h.inv -= dt; if (h.hookCd > 0) h.hookCd -= dt; if (h.stroke > 0) h.stroke -= dt;
      h.water = water;
      // прицел
      h.aim = I.y < 0 ? 'u' : (I.y > 0 && !h.ground ? 'd' : 'f');
      if (I.x) h.face = I.x > 0 ? 1 : -1;

      if (h.hook) { swing(h, dt, jumpEdge); }
      else {
        var run = water ? K.WRUN : K.RUN, g = water ? K.WG : K.G, maxf = water ? K.WMAXF : K.MAXF;
        var acc = h.ground ? K.ACC : K.AIRACC;
        if (I.x) {
          if (Math.abs(h.vx) <= run || Math.sign(h.vx) !== I.x) h.vx = clamp(h.vx + I.x * acc * dt, -run, run);
          else h.vx -= Math.sign(h.vx) * 300 * dt;   // разлёт после раскачки — гаснет плавно
        } else if (h.ground) { var f = K.FRIC * dt; h.vx = Math.abs(h.vx) <= f ? 0 : h.vx - Math.sign(h.vx) * f; }
        else h.vx -= Math.sign(h.vx) * Math.min(Math.abs(h.vx), 120 * dt);
        // прыжок: койот + буфер
        if (h.ground) h.coy = K.COY; else h.coy -= dt;
        if (jumpEdge) h.jbuf = K.BUF; else h.jbuf -= dt;
        if (h.jbuf > 0 && h.coy > 0 && !(I.y > 0 && onShelf(h))) {
          h.vy = -(water ? K.WJUMP : K.JUMP); h.ground = false; h.coy = 0; h.jbuf = 0; h.jhold = true; emit('jump', { water: water });
        } else if (water && jumpEdge && !h.ground && h.stroke <= 0) {
          h.vy = Math.min(h.vy, -K.STROKE); h.stroke = K.STROKE_CD; S.warm -= 0.03; emit('stroke');
        }
        if (h.jhold && !I.jump && h.vy < -K.JCUT && !water) h.vy = -K.JCUT;
        if (h.vy >= 0) h.jhold = false;
        h.vy = Math.min(maxf, h.vy + g * dt);
        // хват за крюк: в воздухе рядом с крюком — ↑ или прыжок
        if (!h.ground && h.hookCd <= 0 && (I.y < 0 || jumpEdge)) tryGrab(h);
        if (!h.hook) {
          // паровой «тормоз»: струя вниз в воздухе
          if (h.firing && h.aim === 'd' && !h.ground) h.vy = Math.max(-90, h.vy - K.HOVER * dt * (water ? 0.4 : 1));
          moveHero(h, dt);
          if (h.ground && !wasGround) { emit('land', { v: 0 }); h.land = 0.15; }
        }
      }
      if (h.land > 0) h.land -= dt;
      // бездействие → сценки
      if (!anyInput && h.ground && !h.hook && !h.firing) h.idle = (h.idle || 0) + dt; else h.idle = 0;
      var st = h.idle < 5 ? 0 : h.idle < 9 ? 1 : h.idle < 13 ? 2 : 3;
      if (st !== S.idleStage) { S.idleStage = st; if (st) emit('idle', { stage: st }); }
    }
    function onShelf(h) { var r = Math.floor(h.y / T); return h.ground && tile(LV, Math.floor(h.x / T), r) === C.P; }
    function hand(h) { return { x: h.x + h.face * 4, y: h.y - K.HH - 4 }; }
    function tryGrab(h) {
      var p = hand(h), best = null, bd = K.GRAB_R;
      for (var i = 0; i < LV.hooks.length; i++) { var k = LV.hooks[i], d = Math.hypot(k.x - p.x, k.y - p.y); if (d < bd) { bd = d; best = k; } }
      if (!best) return false;
      var dx = p.x - best.x, dy = Math.max(8, p.y - best.y), L = clamp(Math.hypot(dx, dy), K.LMIN, K.LMAX), th = Math.atan2(dx, dy);
      var w = (h.vx * Math.cos(th) - h.vy * Math.sin(th)) / L;
      h.hook = { id: best.id, ax: best.x, ay: best.y, L: L, th: th, w: clamp(w, -6, 6) };
      h.vx = h.vy = 0; h.jhold = false; h.swingT = 0;
      emit('grab', { x: best.x, y: best.y });
      return true;
    }
    function swing(h, dt, jumpEdge) {
      var k = h.hook, I = S.inp, water = inWater(h), g = water ? K.WG : K.G;
      h.swingT += dt;
      var a = -(g / k.L) * Math.sin(k.th) + I.x * K.PUMP * Math.cos(k.th);
      k.w += a * dt; k.w *= (1 - K.SWING_DAMP * dt * (water ? 3 : 1)); k.th += k.w * dt;
      if (k.th > 1.45) { k.th = 1.45; k.w = Math.min(0, k.w); } if (k.th < -1.45) { k.th = -1.45; k.w = Math.max(0, k.w); }
      if (I.y < 0) k.L = Math.max(K.LMIN, k.L - 60 * dt); else if (I.y > 0) k.L = Math.min(K.LMAX, k.L + 60 * dt);
      var nx = k.ax + Math.sin(k.th) * k.L - h.face * 4, ny = k.ay + Math.cos(k.th) * k.L + K.HH + 4;
      // не входим в стены
      if (solidAt(LV, nx + K.HW, ny - 6) || solidAt(LV, nx - K.HW, ny - 6) || solidAt(LV, nx, ny)) { k.w = -k.w * 0.4; }
      else { h.x = nx; h.y = ny; }
      if (I.x) h.face = I.x > 0 ? 1 : -1;
      if (jumpEdge || (I.y > 0 && h.swingT > 0.25)) {
        var vx = Math.cos(k.th) * k.w * k.L, vy = -Math.sin(k.th) * k.w * k.L;
        h.vx = clamp(vx, -420, 420); h.vy = jumpEdge ? Math.min(vy, 0) - K.RELEASE_UP : vy;
        h.hook = null; h.hookCd = 0.3; h.jhold = false; emit('release', { v: Math.hypot(vx, vy) });
      }
    }

    // ---------- платформер: пар ----------
    function spout(h) {
      if (h.aim === 'u') return { x: h.x + h.face * 6, y: h.y - K.HH - 4, dx: 0, dy: -1 };
      if (h.aim === 'd') return { x: h.x + h.face * 4, y: h.y, dx: 0, dy: 1 };
      return { x: h.x + h.face * 15, y: h.y - 15, dx: h.face, dy: 0 };
    }
    function platSteam(dt) {
      var h = S.hero, I = S.inp, water = h.water;
      h.firing = !!(I.fire && canFire() && S.phase === 'play');
      var tapCool = 1;
      for (var i = 0; i < LV.taps.length; i++) { var tp = LV.taps[i]; if (Math.abs(h.x - tp.x) < 18 && h.y > tp.y && h.y - K.HH < tp.y + tp.len) { tapCool = 2; if (!S.inTap) emit('tap'); break; } }
      S.inTap = tapCool > 1;
      heatTick(dt, h.firing, water ? 1.5 * tapCool : tapCool, water ? 2 : 1);
      if (water) S.warm -= (h.firing ? K.WARM_FIRE : 0) * dt;
      if (h.firing) {
        h.puffT -= dt;
        while (h.puffT <= 0) {
          h.puffT += K.PUFF_GAP;
          var sp = spout(h), v = water ? 250 : K.PUFF_V, life = water ? 0.15 : K.PUFF_LIFE, j = (rnd(S) - 0.5) * 0.25;
          S.puffs.push({ x: sp.x, y: sp.y, vx: (sp.dx - sp.dy * j) * v + (sp.dx ? 0 : h.vx * 0.3), vy: (sp.dy + sp.dx * j) * v, t: 0, life: life, boil: false, r: 5 });
        }
        if (rnd(S) < dt * 8) emit('steam');
      } else h.puffT = 0;
      if (wantBoil() && S.phase === 'play' && useBoil()) {
        var b = spout(h);
        S.puffs.push({ x: b.x, y: b.y, vx: b.dx * K.BOIL_V, vy: b.dy * K.BOIL_V, t: 0, life: K.BOIL_LIFE * (water ? 0.6 : 1), boil: true, r: 12, hit: {} });
        emit('boil', { x: b.x, y: b.y });
      }
    }
    function updPuffs(dt) {
      for (var i = S.puffs.length - 1; i >= 0; i--) {
        var p = S.puffs[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.boil) p.r += 22 * dt;
        var gone = p.t > p.life;
        if (!gone && S.kind !== 'fly' && solidAt(LV, p.x, p.y)) { gone = true; emit('puffWall', { x: p.x, y: p.y, boil: p.boil }); }
        if (!gone) gone = puffHits(p);
        if (gone) S.puffs.splice(i, 1);
      }
    }
    function puffHits(p) {
      var i, e;
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i]; if (e.dead || e.t < 0) continue; var d = EN[e.k], top = S.kind === 'fly' ? e.y - d.h / 2 : e.y - d.h;
        if (!ov(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, e.x - d.w / 2, top, d.w, d.h)) continue;
        if (p.boil) { if (p.hit[e.id]) continue; p.hit[e.id] = 1; dmgEnemy(e, K.BOIL_DMG, true); }
        else { dmgEnemy(e, K.PUFF_DMG, false); return true; }
      }
      if (p.boil && S.kind !== 'fly') for (i = 0; i < LV.magnets.length; i++) { var m = LV.magnets[i]; if (!S.magOff[m.id] && Math.hypot(m.x - p.x, m.y - p.y) < 26) { S.magOff[m.id] = 1; addScore(400); emit('demag', { x: m.x, y: m.y }); } }
      if (S.boss) return bossPuff(p);
      if (S.fly && S.fly.boss && !S.fly.boss.dead) return swatterPuff(p);
      return false;
    }
    function dmgEnemy(e, n, boil) {
      e.hp -= n; e.flash = 0.12;
      if (e.hp <= 0) {
        e.dead = true; var pts = EN[e.k].pts; addScore(pts); emit('kill', { k: e.k, x: e.x, y: e.y - EN[e.k].h / 2, pts: pts, boil: boil });
        if (e.k === 'pop') for (var q = 0; q < 3; q++) S.enemies.push({ id: e.id + 'f' + q, k: 'flake', x: e.x, y: e.y, vx: 40, vy: -170 + q * 170, hp: 1, t: 0, dead: false, flash: 0, cd: 9 });
      } else emit('enemyHit', { x: e.x, y: e.y });
    }

    // ---------- платформер: враги ----------
    function floorAt(x, y) { return isSolid(tile(LV, Math.floor(x / T), Math.floor(y / T))) || tile(LV, Math.floor(x / T), Math.floor(y / T)) === C.P; }
    function updEnemies(dt) {
      var h = S.hero;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead) continue; var d = EN[e.k]; e.t += dt; if (e.flash > 0) e.flash -= dt;
        var dx = h.x - e.x, near = Math.abs(dx) < 340 && Math.abs(h.y - e.y) < 220;
        if (e.k === 'beetle') {
          var nx = e.x + e.dir * 38 * dt, ahead = nx + e.dir * (d.w / 2 + 1);
          if (solidAt(LV, ahead, e.y - 4) || !floorAt(ahead, e.y + 2) || tile(LV, Math.floor(ahead / T), Math.floor(e.y / T)) === C.X) e.dir = -e.dir; else e.x = nx;
        } else if (e.k === 'pea') {
          e.vy += K.G * dt; e.y += e.vy * dt; e.x += e.vx * dt;
          if (solidAt(LV, e.x + Math.sign(e.vx) * 8, e.y - 6)) e.vx = 0;
          if (e.vy > 0 && floorAt(e.x, e.y)) { e.y = Math.floor(e.y / T) * T; e.vy = 0; e.vx = 0; e.ground = true; }
          e.cd -= dt;
          if (e.ground && e.cd <= 0 && near && Math.abs(dx) < 180) { e.vy = -330; e.vx = Math.sign(dx) * 90; e.ground = false; e.cd = 1.3; emit('hop'); }
          if (e.y > LV.h * T + 50) e.dead = true;
        } else if (e.k === 'fly') {
          if (e.ax == null) { e.ax = e.x; e.ay = e.y; }
          if (near && Math.abs(dx) < 170) { e.ax += Math.sign(dx) * 34 * dt; e.ay += Math.sign(h.y - 30 - e.ay) * 20 * dt; }
          e.x = e.ax + Math.sin(e.t * 1.3) * 34; e.y = e.ay + Math.sin(e.t * 3.1) * 12;
        } else if (e.k === 'toaster') {
          e.cd -= dt;
          if (e.cd <= 0 && near && Math.abs(dx) < 300) { e.cd = 2.4; S.eshots.push({ k: 'toast', x: e.x, y: e.y - 22, vx: clamp(dx / 1.1, -260, 260), vy: -420, g: 900, t: 0, r: 7 }); emit('toast', { x: e.x, y: e.y }); }
        } else if (e.k === 'leaffish') {
          e.x += e.dir * 50 * dt; if (e.x < e.x0 || e.x > e.x1) { e.dir = -e.dir; e.x = clamp(e.x, e.x0, e.x1); }
          e.y = e.y0 + Math.sin(e.t * 2) * 10;
        } else if (e.k === 'pip') {
          e.y = e.y0 - (Math.sin(e.t * 0.9) * 0.5 + 0.5) * 70;
        }
        if (S.phase === 'play' && h && !h.dead && ov(h.x - K.HW + 2, h.y - K.HH + 2, K.HW * 2 - 4, K.HH - 4, e.x - d.w / 2, e.y - d.h, d.w, d.h)) hurtHero(1, e.x);
      }
    }
    function updEshots(dt) {
      var h = S.hero;
      for (var i = S.eshots.length - 1; i >= 0; i--) {
        var s = S.eshots[i]; s.t += dt; s.vy += (s.g || 0) * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        var gone = s.t > (s.life || 4);
        if (!gone && s.k !== 'milk' && s.k !== 'ring' && S.kind !== 'fly' && solidAt(LV, s.x, s.y)) { gone = true; emit('splat', { x: s.x, y: s.y, k: s.k }); }
        if (!gone && (s.k === 'milk' || s.k === 'ring') && (s.x < LV.arena.x0 || s.x > LV.arena.x1)) gone = true;
        if (!gone && S.phase === 'play' && h) {
          var hit = (s.k === 'milk' || s.k === 'ring') ? ov(h.x - K.HW, h.y - K.HH, K.HW * 2, K.HH, s.x - 10, s.y - (s.k === 'milk' ? 12 : 16), 20, s.k === 'milk' ? 12 : 16)
            : Math.hypot(h.x - s.x, h.y - K.HH / 2 - s.y) < s.r + 10;
          if (hit) { hurtHero(1, s.x); if (s.k !== 'milk' && s.k !== 'ring') gone = true; }
        }
        if (gone) S.eshots.splice(i, 1);
      }
    }

    // ---------- платформер: окружение ----------
    function platWorld(dt) {
      var h = S.hero, i;
      // магниты
      for (i = 0; i < LV.magnets.length; i++) {
        var m = LV.magnets[i]; if (S.magOff[m.id]) continue;
        var mx = m.x - h.x, my = m.y - (h.y - K.HH / 2), d = Math.hypot(mx, my);
        if (d < 20) { h.x = m.x; h.y = m.y + K.HH / 2 + 4; die('magnet'); return; }
        if (d < K.MAG_R && !h.hook) { var a = K.MAG_PULL * (1 - d / K.MAG_R); h.vx += mx / d * a * dt; h.vy += my / d * a * dt * (h.ground ? 0 : 1); }
      }
      // пузыри (уровень 3)
      var inB = false;
      for (i = 0; i < LV.bubbles.length; i++) { var b = LV.bubbles[i]; if (h.x > b.x0 && h.x < b.x1 && h.y > b.y0 && h.y - K.HH < b.y1) { inB = true; if (!h.hook) { h.vy = Math.max(-175, h.vy - 1500 * dt); h.ground = false; } S.warm = Math.min(1, S.warm + K.BUBBLE_WARM * dt); } }
      if (inB && !S.inBubble) emit('bubble'); S.inBubble = inB;
      if (LV.water && inWater(h)) { S.warm -= K.WARM_DRAIN * dt; if (S.warm <= 0) { S.warm = 0; die('cold'); return; } }
      // конфорки
      var c0 = Math.floor((h.x - K.HW + 2) / T), c1 = Math.floor((h.x + K.HW - 2) / T), r0 = Math.floor((h.y - K.HH + 2) / T), r1 = Math.floor((h.y - 1) / T);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (tile(LV, c, r) === C.F && burnerOn(LV, c, r, S.t)) { burn(h, c); return; }
      // предметы
      for (i = 0; i < LV.items.length; i++) { var it = LV.items[i]; if (S.got[it.id]) continue; if (Math.abs(it.x - h.x) < 14 && Math.abs(it.y - (h.y - 12)) < 20) pick(it.k, it.x, it.y, it.id); }
      for (i = S.drops.length - 1; i >= 0; i--) {
        var dr = S.drops[i]; dr.vy += 900 * dt; dr.y += dr.vy * dt; dr.x += dr.vx * dt; dr.vx *= (1 - 2 * dt);
        if (floorAt(dr.x, dr.y + 6)) { dr.y = Math.floor((dr.y + 6) / T) * T - 6; dr.vy = 0; }
        if (Math.abs(dr.x - h.x) < 16 && Math.abs(dr.y - (h.y - 12)) < 22) { pick(dr.k, dr.x, dr.y, null); S.drops.splice(i, 1); }
      }
      // чекпойнты
      for (i = 0; i < LV.cps.length; i++) {
        var cp = LV.cps[i]; if (S.cp.id === cp.id || S.got[cp.id]) continue;
        if (LV.water ? (Math.abs(cp.x - h.x) < 40 && Math.abs(cp.y - h.y) < 40) : (h.x > cp.x - 12 && Math.abs(cp.y - h.y) < 120 && cp.x > S.cp.x)) { S.got[cp.id] = 1; S.cp = { x: cp.x, y: cp.y, id: cp.id }; emit('cp', { x: cp.x, y: cp.y }); }
      }
      // цель
      if (LV.goal && Math.abs(LV.goal.x - h.x) < 22 && Math.abs(LV.goal.y - h.y) < 30) clearLevel();
      // падение
      if (h.y > LV.h * T + 40) { if (S.god) godFall(); else die('fall'); }
    }
    function pick(k, x, y, id) {
      if (id) S.got[id] = 1;
      if (k === 'sugar') { addScore(50); emit('sugar', { x: x, y: y }); }
      else if (k === 'leaf') { addScore(20); S.charge = Math.min(1, S.charge + K.LEAF); emit('leaf', { x: x, y: y, full: S.charge >= 1 }); }
      else if (k === 'heart') { var h = S.hero || {}; if (S.fly) h = S.fly; if (h.hp < K.HP) h.hp++; else addScore(500); emit('heart', { x: x, y: y }); }
      else if (k === 'lid') { emit('lid', { x: x, y: y }); clearLevel(); }
    }

    // ---------- уровень 6: Сервиз ----------
    function initBoss() {
      var A = LV.arena;
      S.boss = { cx: A.x1 - 220, dir: -1, sp: 55, parts: ['sugar', 'teapot', 'creamer'].map(function (k, i) { return { k: k, off: (i - 1) * 86, x: 0, y: A.floor, cracks: 0, temp: 0, inv: 0, cd: 2 + i * 1.1, dead: false, vy: 0, air: false, hopCd: 2 }; }),
        stage: 1, lid: null, intro: 1.6, done: false };
      placeTrain();
    }
    function partAlive(k) { var p = S.boss.parts.filter(function (q) { return q.k === k; })[0]; return p && !p.dead; }
    function placeTrain() {
      var B = S.boss; B.parts.forEach(function (p) { if (B.stage === 1) { p.x = B.cx + p.off; p.y = LV.arena.floor; } });
    }
    function shielded(p) { return p.k === 'teapot' && (partAlive('sugar') || partAlive('creamer')); }
    function bossPuff(p) {
      var B = S.boss;
      for (var i = 0; i < B.parts.length; i++) {
        var q = B.parts[i], d = BOSS[q.k]; if (q.dead) continue;
        if (!ov(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, q.x - d.w / 2, q.y - d.h, d.w, d.h)) continue;
        if (p.boil) {
          if (p.hit[q.k]) continue; p.hit[q.k] = 1;
          if (shielded(q)) { emit('shield', { x: q.x, y: q.y - d.h / 2 }); continue; }   // кипяток проходит сквозь заслон дальше
          if (q.inv > 0) return true;
          var n = q.temp >= 0.5 ? 2 : 1; q.cracks += n; q.temp = 0; q.inv = 0.6; addScore(300 * n);
          emit('crack', { k: q.k, x: q.x, y: q.y - d.h / 2, n: n });
          if (q.cracks >= d.hp) shatter(q);
          return true;
        }
        if (!shielded(q)) { q.temp = Math.min(1, q.temp + 0.15); addScore(5); }
        emit('ting', { x: p.x, y: p.y });
        return true;
      }
      return false;
    }
    function shatter(q) {
      q.dead = true; addScore(3000); emit('shatter', { k: q.k, x: q.x, y: q.y - BOSS[q.k].h / 2 });
      for (var i = 0; i < 2; i++) S.drops.push({ k: 'leaf', x: q.x + (i ? 12 : -12), y: q.y - 30, vx: (i ? 80 : -80), vy: -300 });
      var B = S.boss;
      if (q.k !== 'teapot' && !partAlive('sugar') && !partAlive('creamer')) { B.stage = 2; emit('stage2'); var tp = B.parts[1]; tp.hopCd = 1.2; }
      if (q.k === 'teapot') { B.done = true; B.lid = { x: q.x, y: q.y - 60, vy: -380, vx: 0 }; emit('lidOut', { x: q.x, y: q.y }); }
    }
    function updBoss(dt) {
      var B = S.boss, h = S.hero, A = LV.arena, i;
      if (B.intro > 0) { B.intro -= dt; return; }
      if (B.lid) {
        var L = B.lid; L.vy += 900 * dt; L.y += L.vy * dt; if (L.y > A.floor - 8) { L.y = A.floor - 8; L.vy = 0; }
        if (Math.abs(L.x - h.x) < 22 && Math.abs(L.y - (h.y - 12)) < 26) { B.lid = null; pick('lid', L.x, L.y, null); }
        return;
      }
      var alive = B.parts.filter(function (p) { return !p.dead; }).length;
      if (B.stage === 1) {
        B.sp = 55 + (3 - alive) * 30;
        B.cx += B.dir * B.sp * dt;
        var lo = A.x0 + 120, hi = A.x1 - 120;
        if (B.cx < lo) { B.cx = lo; B.dir = 1; } if (B.cx > hi) { B.cx = hi; B.dir = -1; }
        placeTrain();
      }
      for (i = 0; i < B.parts.length; i++) {
        var p = B.parts[i], d = BOSS[p.k]; if (p.dead) continue;
        if (p.inv > 0) p.inv -= dt; p.temp = Math.max(0, p.temp - 0.15 * dt);
        p.cd -= dt;
        var dx = h.x - p.x;
        if (p.k === 'sugar' && p.cd <= 0) {
          p.cd = 3.2; for (var j = -1; j <= 1; j++) S.eshots.push({ k: 'cube', x: p.x, y: p.y - d.h - 4, vx: clamp(dx / 1.1, -280, 280) + j * 70, vy: -470, g: 900, t: 0, r: 6 });
          emit('lob', { x: p.x, y: p.y });
        } else if (p.k === 'creamer' && p.cd <= 0) {
          p.cd = 3.8; S.eshots.push({ k: 'milk', x: p.x + Math.sign(dx) * 20, y: A.floor, vx: Math.sign(dx) * 210, vy: 0, g: 0, t: 0, r: 8, life: 6 });
          emit('squirt', { x: p.x, y: p.y });
        } else if (p.k === 'teapot') {
          if (B.stage === 1 && p.cd <= 0) {
            p.cd = 4.6; for (var q = 0; q < 4; q++) S.eshots.push({ k: 'drop', x: p.x + 20, y: p.y - d.h, vx: (rnd(S) - 0.5) * 260 + dx * 0.25, vy: -560 - rnd(S) * 120, g: 900, t: 0, r: 5 });
            emit('spit', { x: p.x, y: p.y });
          } else if (B.stage === 2) {
            p.hopCd -= dt;
            if (p.air) {
              p.vy += 1300 * dt; p.y += p.vy * dt; p.x = clamp(p.x + p.vx * dt, A.x0 + 40, A.x1 - 40);
              if (p.y >= A.floor) { p.y = A.floor; p.air = false; p.vy = 0; S.eshots.push({ k: 'ring', x: p.x - 30, y: A.floor, vx: -230, vy: 0, g: 0, t: 0, r: 8, life: 4 }, { k: 'ring', x: p.x + 30, y: A.floor, vx: 230, vy: 0, g: 0, t: 0, r: 8, life: 4 }); emit('slam', { x: p.x, y: p.y }); }
            } else if (p.hopCd <= 0) { p.air = true; p.vy = -560; p.vx = clamp(dx * 0.9, -200, 200); p.hopCd = 1.9; emit('hopBoss'); }
            if (p.cd <= 0) { p.cd = 3; for (var q2 = 0; q2 < 3; q2++) S.eshots.push({ k: 'drop', x: p.x, y: p.y - d.h, vx: (q2 - 1) * 120, vy: -500, g: 900, t: 0, r: 5 }); emit('spit', { x: p.x, y: p.y }); }
          }
        }
        if (S.phase === 'play' && ov(h.x - K.HW + 3, h.y - K.HH + 3, K.HW * 2 - 6, K.HH - 6, p.x - d.w / 2 + 4, p.y - d.h + 4, d.w - 8, d.h - 4)) hurtHero(1, p.x);
      }
      // фарфоровая цепочка между соседними живыми частями — бьёт искрой
      if (B.stage === 1 && S.phase === 'play') {
        var al = B.parts.filter(function (p) { return !p.dead; });
        for (i = 0; i + 1 < al.length; i++) {
          var a = al[i], b = al[i + 1], cy = A.floor - 26;
          if (h.x > a.x + 10 && h.x < b.x - 10 && h.y > cy - 3 && h.y - K.HH < cy + 3) hurtHero(1, (a.x + b.x) / 2);
        }
      }
    }

    // ---------- уровень 2: гонка ----------
    function initRace() {
      S.race = { x: 120, y: trackY(120), v: 0, vy: 0, air: false, crash: 0, fall: 0, count: 2.4, rx: 90, rv: 0, rtrip: 0, rtrips: {}, done: false, time: 0, hp: K.HP, inv: 0, got: {}, jhold: false, boostOn: false, ang: 0 };
    }
    function updRace(dt) {
      var R = S.race, I = S.inp, jumpEdge = I.jump && !S.prev.jump;
      if (R.count > 0) { var c0 = Math.ceil(R.count); R.count -= dt; if (Math.ceil(R.count) !== c0) emit('count', { n: Math.max(0, Math.ceil(R.count)) }); heatTick(dt, false, 1, 1); return; }
      R.time += dt; if (R.inv > 0) R.inv -= dt;
      // соперник
      if (R.rtrip > 0) R.rtrip -= dt;
      else {
        R.rv += (rivalSpeed(R.rx) - R.rv) * Math.min(1, dt * 1.5); R.rx += R.rv * dt;
        TRACK.rival.trips.forEach(function (tr, i) { if (!R.rtrips[i] && R.rx > tr[0]) { R.rtrips[i] = 1; R.rtrip = tr[1]; R.rv = 60; emit('rivalTrip'); } });
      }
      var boost = !!(I.fire && canFire()), tapCool = 1;
      for (var i = 0; i < TRACK.obs.length; i++) { var o = TRACK.obs[i]; if (o.k === 'tap' && R.x > o.x && R.x < o.x + o.w) tapCool = 2; }
      if (tapCool > 1 && !S.inTap) emit('tap'); S.inTap = tapCool > 1;
      heatTick(dt, boost, tapCool, 1.3);
      R.boostOn = boost;
      if (boost && rnd(S) < dt * 10) emit('steam');
      if (R.fall > 0) { R.fall -= dt; R.vy += K.G * dt; R.y += R.vy * dt; if (R.fall <= 0) { R.x = Math.max(120, R.x - 260); R.y = trackY(R.x); R.v = 60; R.vy = 0; R.air = false; R.inv = 1; emit('respawnRace'); } return; }
      if (R.crash > 0) { R.crash -= dt; R.v = Math.max(0, R.v - 400 * dt); }
      var gy = trackY(R.x), slope = (trackY(R.x + 6) - trackY(R.x - 6)) / 12, ang = Math.atan(slope);
      R.ang += (ang - R.ang) * Math.min(1, dt * 10);
      if (!R.air) {
        var a = K.R_SLOPE * Math.sin(ang) - K.R_DRAG * R.v * R.v - 12;
        if (R.crash <= 0) { if (I.x > 0) a += K.R_LEAN; if (I.x < 0) a -= K.R_BRAKE; if (boost) a += K.R_BOOST; }
        var jam = false;
        for (var k = 0; k < TRACK.obs.length; k++) { var ob = TRACK.obs[k]; if (ob.k === 'jam' && R.x > ob.x && R.x < ob.x + ob.w) { jam = true; break; } }
        if (jam) { a -= 1.1 * R.v; if (!S.inJam) emit('jam'); }
        S.inJam = jam;
        R.v = clamp(R.v + a * dt, jam && I.x > 0 ? 50 : 0, K.R_MAX);
        R.y = gy;
        if (jumpEdge && R.crash <= 0) { R.air = true; R.vy = -430 + Math.min(0, slope) * R.v * 0.3; R.jhold = true; emit('jump'); }
        if (holeAt(R.x) && !R.air) { R.fall = 0.8; R.vy = 0; S.lvDeaths += 0; emit('holeFall'); return; }
      } else {
        if (R.jhold && !I.jump && R.vy < -200) R.vy = -200; if (R.vy >= 0) R.jhold = false;
        R.vy += K.G * dt; R.y += R.vy * dt;
        if (boost) R.v = Math.min(K.R_MAX, R.v + 150 * dt);
        if (R.y >= gy && !holeAt(R.x)) { R.y = gy; R.air = false; R.vy = 0; emit('land'); }
        if (holeAt(R.x) && R.y > gy + 30) { R.fall = 0.8; emit('holeFall'); return; }
      }
      R.x += R.v * dt;
      // препятствия и бонусы
      for (var j = 0; j < TRACK.obs.length; j++) {
        var q = TRACK.obs[j]; if (R.got[q.id]) continue;
        var hit = R.x + 14 > q.x && R.x - 14 < q.x + q.w, feet = R.y, gy2 = trackY(q.x);
        if (!hit) continue;
        if (q.k === 'crumb' && feet > gy2 - 10) { R.got[q.id] = 1; R.v *= 0.55; emit('bumpCrumb', { x: q.x }); }
        else if (q.k === 'shaker' && feet > gy2 - 34) { R.got[q.id] = 1; R.crash = 0.9; R.v = 40; emit('crash', { x: q.x }); }
        else if (q.k === 'spoon' && !R.air) { R.got[q.id] = 1; R.air = true; R.vy = -560; emit('spoon', { x: q.x }); }
        else if ((q.k === 'sugar' || q.k === 'leaf') && Math.abs(feet - 14 - (gy2 - q.h)) < 26) { R.got[q.id] = 1; pick(q.k, q.x, gy2 - q.h, null); }
      }
      // кипяток сносит солонку впереди
      if (wantBoil() && useBoil()) {
        emit('boil', { x: R.x + 20, y: R.y - 20 });
        for (var m = 0; m < TRACK.obs.length; m++) { var sh = TRACK.obs[m]; if (!R.got[sh.id] && (sh.k === 'shaker' || sh.k === 'crumb') && sh.x > R.x && sh.x < R.x + 260) { R.got[sh.id] = 1; addScore(200); emit('blast', { x: sh.x, y: trackY(sh.x) - 16 }); } }
      }
      if (R.x >= TRACK.len && !R.done) {
        R.done = true;
        if (R.rx < TRACK.len) { addScore(Math.round((TRACK.len - R.rx) * 2)); clearLevel(); }
        else { lostRace(); }
      } else if (R.rx >= TRACK.len && !R.done) { R.done = true; lostRace(); }
    }
    function lostRace() { S.phase = 'dead'; S.phaseT = 0; S.deathKind = 'race'; S.deaths++; S.lvDeaths++; emit('die', { kind: 'race' }); }

    // ---------- уровень 4: головоломка ----------
    function initPuzzle() { S.pz = { s: PZ.parse(LVL.PUZZLE).init, anim: 0, from: null, rep: 0, fail: null, done: false, moves: 0, lastAct: null, msg: null }; S.pz.s = JSON.parse(JSON.stringify(S.pz.s)); }
    function pzAct(act) {
      var P = S.pz, r = PZ.step(PB, P.s, act);
      if (!r.moved) { P.s = r.s; if (r.ev[0] === 'hot') emit('pzHot'); else emit('pzBump'); return; }
      P.from = { x: P.s.x, y: P.s.y }; P.anim = 0.12; P.s = r.s; P.moves++; P.lastAct = act;
      r.ev.forEach(function (e) { emit('pz_' + e.split(':')[0], { k: e.split(':')[1] }); });
      if (r.fail) { P.fail = r.fail; S.phase = 'dead'; S.phaseT = 0; S.deathKind = 'woke_' + r.fail; S.deaths++; S.lvDeaths++; emit('die', { kind: 'woke', why: r.fail }); }
      else if (r.done) { P.done = true; addScore(Math.max(0, (60 - P.moves)) * 40); clearLevel(); }
    }
    function updPuzzle(dt) {
      var P = S.pz, I = S.inp;
      if (P.anim > 0) { P.anim -= dt; return; }
      var d = I.x < 0 ? 'L' : I.x > 0 ? 'R' : I.y < 0 ? 'U' : I.y > 0 ? 'D' : null;
      var fresh = (I.x !== S.prev.x || I.y !== S.prev.y);
      if (d) { P.rep -= dt; if (fresh || P.rep <= 0) { P.rep = fresh ? 0.22 : 0.12; pzAct(d); } } else P.rep = 0;
      if (I.fire && !S.prev.fire) pzAct('p' + P.s.f);
    }

    // ---------- уровень 5: полёт на шаре из чайного пакетика ----------
    var FW = 640, FH = 360;
    function initFly(fromT) {
      S.fly = { x: 120, y: 170, vx: 0, vy: 0, t: fromT, wi: 0, hp: K.HP, inv: 1, puffT: 0, firing: false, clouds: [], boss: null, done: false, scroll: fromT * 70 };
      var F = LVL.FLY; while (S.fly.wi < F.waves.length && F.waves[S.fly.wi].t < fromT) S.fly.wi++;
      S.enemies = []; S.eshots = []; S.puffs = []; S.drops = [];
    }
    function flySpawn(w) {
      var F = S.fly, n = w.n || 1;
      if (w.k === 'cloud') { F.clouds.push({ x: FW + 80, y: w.y * FH, r: 60 }); return; }
      if (w.k === 'leaf' || w.k === 'heart') { S.drops.push({ k: w.k, x: FW + 20, y: 30 + w.y * (FH - 60), vx: -70, vy: 0, fly: true }); return; }
      var k = w.k === 'fly' ? 'ffly' : w.k;
      for (var i = 0; i < n; i++) S.enemies.push({ id: 'w' + F.wi + '_' + i, k: k, x: FW + 30, y: 30 + w.y * (FH - 60), y0: 30 + w.y * (FH - 60), vx: 0, vy: 0, hp: EN[k].hp, t: -i * (w.gap || 0), dead: false, flash: 0, cd: 1.2 + i * 0.3, mode: 0 });
    }
    function updFly(dt) {
      var F = S.fly, I = S.inp, Fd = LVL.FLY, i;
      F.t += dt; F.scroll += 70 * dt; if (F.inv > 0) F.inv -= dt;
      while (F.wi < Fd.waves.length && Fd.waves[F.wi].t <= F.t) { flySpawn(Fd.waves[F.wi]); F.wi++; }
      if (!F.boss && F.t >= Fd.len) { F.boss = { x: 420, y: -120, hp: 26, st: 'enter', t: 0, col: 300, slams: 0, dead: false, flash: 0 }; emit('swatter'); }
      // движение
      F.vx += ((I.x * 190) - F.vx) * Math.min(1, dt * 8); F.vy += ((I.y * 170) - F.vy) * Math.min(1, dt * 8);
      F.x = clamp(F.x + F.vx * dt, 30, FW - 160); F.y = clamp(F.y + F.vy * dt, 48, FH - 30);
      // облака холода
      var cool = 1;
      for (i = F.clouds.length - 1; i >= 0; i--) { var cl = F.clouds[i]; cl.x -= 90 * dt; if (Math.hypot(cl.x - F.x, cl.y - F.y) < cl.r) cool = 2; if (cl.x < -100) F.clouds.splice(i, 1); }
      if (cool > 1 && !S.inTap) emit('tap'); S.inTap = cool > 1;
      F.firing = !!(I.fire && canFire());
      heatTick(dt, F.firing, cool, 0.85);
      if (F.firing) {
        F.puffT -= dt;
        while (F.puffT <= 0) { F.puffT += 0.07; S.puffs.push({ x: F.x + 18, y: F.y + 6, vx: 520, vy: (rnd(S) - 0.5) * 70, t: 0, life: 0.42, boil: false, r: 9 }); }
        if (rnd(S) < dt * 8) emit('steam');
      } else F.puffT = 0;
      if (wantBoil() && useBoil()) { S.puffs.push({ x: F.x + 20, y: F.y + 4, vx: 520, vy: 0, t: 0, life: 1.1, boil: true, r: 16, hit: {} }); emit('boil', { x: F.x, y: F.y }); }
      updPuffs(dt);
      // враги
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead) continue; e.t += dt; if (e.flash > 0) e.flash -= dt; if (e.t < 0) continue; var d = EN[e.k];
        if (e.k === 'ffly') { e.x -= 130 * dt; e.y = e.y0 + Math.sin(e.t * 2.4) * 16; }
        else if (e.k === 'moth') {
          if (e.mode === 0) { e.x -= 110 * dt; if (e.x < FW - 120 - (e.id.length % 3) * 40) { e.mode = 1; var a = Math.atan2(F.y - e.y, F.x - e.x); e.vx = Math.cos(a) * 185; e.vy = Math.sin(a) * 185; emit('dive'); } }
          else { e.x += e.vx * dt; e.y += e.vy * dt; }
        } else if (e.k === 'pop') { e.x -= 75 * dt; e.y = e.y0 + Math.sin(e.t * 1.5) * 16; }
        else if (e.k === 'flake') { e.x += (e.vx - 60) * dt; e.y += e.vy * dt; }
        else if (e.k === 'bee') {
          if (e.x > FW - 110) e.x -= 120 * dt; e.y += (F.y - e.y) * Math.min(1, dt * 0.5);
          e.cd -= dt; if (e.cd <= 0 && e.t < 9) { e.cd = 2; var aa = Math.atan2(F.y - e.y, F.x - e.x); S.eshots.push({ k: 'sting', x: e.x - 12, y: e.y, vx: Math.cos(aa) * 190, vy: Math.sin(aa) * 190, g: 0, t: 0, r: 4, life: 4 }); emit('sting'); }
          if (e.t > 9) e.x -= 200 * dt;
        }
        if (e.x < -60 || e.y < -80 || e.y > FH + 80) e.dead = true;
        if (!e.dead && !(e.k === 'flake' && e.t < 0.35) && ov(F.x - 12, F.y - 30, 24, 46, e.x - d.w / 2 + 2, e.y - d.h / 2 + 2, d.w - 4, d.h - 4)) { flyHurt(e.x); if (e.k !== 'bee') { e.dead = true; } }
      }
      S.enemies = S.enemies.filter(function (e) { return !e.dead; });
      for (i = S.eshots.length - 1; i >= 0; i--) {
        var s = S.eshots[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += (s.g || 0) * dt;
        if (s.t > (s.life || 4) || s.x < -20 || s.x > FW + 20 || s.y > FH + 20) { S.eshots.splice(i, 1); continue; }
        if (Math.abs(s.x - F.x) < 14 + s.r && Math.abs(s.y - F.y + 8) < 26 + s.r) { flyHurt(s.x); S.eshots.splice(i, 1); }
      }
      for (i = S.drops.length - 1; i >= 0; i--) { var dr = S.drops[i]; dr.x += dr.vx * dt; if (dr.x < -20) { S.drops.splice(i, 1); continue; } if (Math.abs(dr.x - F.x) < 22 && Math.abs(dr.y - F.y) < 30) { pick(dr.k, dr.x, dr.y, null); S.drops.splice(i, 1); } }
      if (F.boss) updSwatter(dt);
      if (S.phase === 'play' && !F.boss && F.t > Fd.cp && !S.flyCp) { S.flyCp = true; emit('cp', { x: F.x, y: F.y }); }
    }
    function flyHurt(x) {
      var F = S.fly; if (S.god || F.inv > 0 || S.phase !== 'play') return;
      F.hp--; F.inv = 1.4; emit('hurt', { hp: F.hp, x: F.x, y: F.y });
      if (F.hp <= 0) { S.phase = 'dead'; S.phaseT = 0; S.deathKind = 'pop'; S.deaths++; S.lvDeaths++; emit('die', { kind: 'pop', x: F.x, y: F.y }); }
    }
    function updSwatter(dt) {
      var F = S.fly, B = F.boss; if (B.dead) return; B.t += dt; if (B.flash > 0) B.flash -= dt;
      if (B.st === 'enter') { B.y += (40 - B.y) * Math.min(1, dt * 3); if (B.t > 1.2) { B.st = 'aim'; B.t = 0; } }
      else if (B.st === 'aim') { B.col += (F.x + 20 - B.col) * Math.min(1, dt * 1.8); B.x = B.col; B.y = 40; if (B.t > 1.3) { B.st = 'slam'; B.t = 0; emit('swatAim'); } }
      else if (B.st === 'slam') { B.y = 40 + Math.min(1, B.t / 0.18) * (FH - 70); if (B.t > 0.18 && B.t - dt <= 0.18) { emit('swat'); if (Math.abs(F.x - B.x) < 30 && F.y > 40) flyHurt(B.x); } if (B.t > 1.3) { B.st = 'up'; B.t = 0; } }
      else if (B.st === 'up') { B.y += (40 - B.y) * Math.min(1, dt * 4); if (B.t > 0.6) { B.st = 'aim'; B.t = 0; B.slams++; } }
    }
    function swatterPuff(p) {
      var B = S.fly.boss, top = B.st === 'slam' ? 40 : B.y - 60;
      if (!(Math.abs(p.x - B.x) < 30 + p.r && p.y > top - 10 && p.y < B.y + 50)) return false;
      if (p.boil) { if (p.hit.sw) return false; p.hit.sw = 1; B.hp -= 8; } else B.hp -= (B.st === 'slam' ? 1 : 0.5);
      B.flash = 0.1; emit('swatHit', { x: p.x, y: p.y });
      if (B.hp <= 0) { B.dead = true; addScore(5000); emit('swatDown', { x: B.x, y: B.y }); S.fly.done = true; clearLevel(); }
      return true;
    }

    // ---------- переходы ----------
    function clearLevel() {
      if (S.phase !== 'play') return;
      var par = PAR[S.level] || 120, tb = Math.max(0, Math.round((par - S.lvT) * 20)), nb = S.lvDeaths ? 0 : 2000;
      addScore(tb + nb + 1000);
      S.phase = 'clear'; S.phaseT = 0; S.lastClear = { level: S.level, time: S.lvT, tb: tb, nb: nb };
      emit('clear', S.lastClear);
    }
    function respawn() {
      var n = S.level;
      S.phase = 'play'; S.phaseT = 0; S.heat = 0; S.over = false; S.puffs = []; S.eshots = []; S.idleT = 0; S.warm = 1;
      if (S.kind === 'plat' || S.kind === 'boss') {
        var h = newHero(S.cp.x, S.cp.y); h.inv = 1.5; S.hero = h;
        if (S.kind === 'boss') { var B = S.boss; if (B.stage === 1) { B.cx = LV.arena.x1 - 220; B.dir = -1; placeTrain(); } else { B.parts[1].x = LV.arena.x1 - 120; B.parts[1].y = LV.arena.floor; B.parts[1].air = false; } }
      } else if (S.kind === 'race') initRace();
      else if (S.kind === 'puzzle') initPuzzle();
      else if (S.kind === 'fly') initFly(S.flyCp ? LVL.FLY.cp : 0);
      emit('respawn', { level: n });
    }

    function update(dt) {
      if (!S) return;
      S.t += dt; S.phaseT += dt;
      if (S.phase === 'play') {
        S.lvT += dt;
        if (S.kind === 'plat' || S.kind === 'boss') {
          platHero(dt);
          if (S.phase === 'play') platSteam(dt);
          updPuffs(dt);
          updEnemies(dt);
          if (S.boss) updBoss(dt);
          updEshots(dt);
          if (S.phase === 'play') platWorld(dt);
        } else if (S.kind === 'race') updRace(dt);
        else if (S.kind === 'puzzle') updPuzzle(dt);
        else if (S.kind === 'fly') updFly(dt);
      } else if (S.phase === 'dead') {
        var h = S.hero;
        if (h && (S.kind === 'plat' || S.kind === 'boss') && S.deathKind !== 'magnet') { h.vy += 900 * dt; if (S.deathKind === 'fall') h.y += h.vy * dt; }
        if (S.phaseT >= 1.8) {
          S.lives--;
          if (S.lives <= 0) { S.phase = 'over'; S.phaseT = 0; S.overGame = true; emit('gameover', { score: S.score, cont: S.cont }); }
          else respawn();
        }
        updPuffs(dt);
      } else if (S.phase === 'clear') {
        if (S.phaseT >= 3.2) {
          if (S.level >= LVL.COUNT) { S.phase = 'won'; S.won = true; emit('win', { score: S.score }); }
          else loadLevel(S.level + 1);
        }
      }
      S.prev.jump = S.inp.jump; S.prev.fire = S.inp.fire; S.prev.boil = S.inp.boil; S.prev.x = S.inp.x; S.prev.y = S.inp.y;
    }

    var api = {
      start: function () { S = newState(); loadLevel(opts.level || 1); return api; },
      update: update,
      setInput: function (i) { S.inp.x = i.x || 0; S.inp.y = i.y || 0; S.inp.jump = !!i.jump; S.inp.fire = !!i.fire; S.inp.boil = !!i.boil; },
      state: function () { return S; },
      level: function () { return LV; },
      // продолжение после «конец игры»: тот же уровень, 3 жизни, счёт с нуля
      continueGame: function () { if (!S || S.phase !== 'over' || S.cont <= 0) return false; S.cont--; S.lives = K.LIVES; S.score = 0; S.nextLife = K.EXTRA; S.overGame = false; loadLevel(S.level); emit('continue', { left: S.cont }); return true; },
      restartLevel: function () { if (!S) return; S.lives--; if (S.lives <= 0) { S.phase = 'over'; S.overGame = true; emit('gameover', { score: S.score, cont: S.cont }); return; } loadLevel(S.level); },
      puzzleReset: function () { if (S && S.kind === 'puzzle' && S.phase === 'play') { initPuzzle(); emit('pzReset'); } },
      snapshot: function () { return JSON.stringify(S); },
      restore: function (s) { S = JSON.parse(s); LV = LVL.build(S.level); },
      mute: function (on) { quiet += on ? 1 : -1; },
      // тест-хуки
      _goLevel: function (n) { loadLevel(n); },
      _place: function (x, y) { var h = S.hero; h.x = x; h.y = y; h.vx = h.vy = 0; h.hook = null; },
      _die: function (k) { die(k); }, _hurt: hurtHero, _pz: pzAct, _clear: clearLevel, _charge: function (v) { S.charge = v; }
    };
    return api;
  };
  CH.logic = { K: K, EN: EN, BOSS: BOSS, PAR: PAR, tile: tile, isSolid: isSolid, solidAt: solidAt, burnerOn: burnerOn, trackY: trackY, holeAt: holeAt, TRACK: TRACK, PB: PB, rivalSpeed: rivalSpeed };
})(typeof window !== 'undefined' ? window : globalThis);
