/* СПУТНИК · логика без DOM (детерминирована при заданном rng). SPUTNIK.Game(opts), SPUTNIK.logic
   Горизонтальный космический скролл-шутер студии «Гефест»: малый кузнечный корабль «Спутник» — спутник орбитальной
   мастерской «Горн» — летит слева направо сквозь пояс Окалины.
   Переделка 2026-11 — главная механика «калильный жар»:
   - корабль накаляется, когда скользит вдоль раскалённой кромки породы и механизмов (чем ближе — тем быстрее),
     и чуть-чуть — от каждого сбитого врага; без кромки жар медленно остывает;
   - жар = огневая мощь: тлеет (одиночный), жар (двойной), белый жар (двойной калёный + искры веером);
   - кнопка «закалка» сбрасывает весь жар паровым кольцом: оно гасит вражеские пули, бьёт врагов и открытое слабое место босса;
     чем жарче корабль, тем шире кольцо — выбор «держать мощь или сбросить в защиту».
   Огонь автоматический. Рельеф (стены пещер, поршни, шестерни) убивает корабль — жар берут у самой кромки.
   6 уровней: волны врагов, полубосс посередине, в конце — крупный босс со слабым местом. 3 жизни,
   при гибели — возврат к контрольной точке, жар остывает. Все координаты — мировые (x растёт вправо), камера S.cx. */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK = global.SPUTNIK || {};

  // ---------- Поле и константы ----------
  var W = 640, H = 360, TOP = 26, MID = (TOP + H) / 2;       // TOP — низ полосы HUD
  var COL = 8;                                                // шаг колонок рельефа, px
  var SCROLL = 44;                                            // скорость камеры, px/с
  var SHIP_V = 160, SHIP_HW = 10, SHIP_HH = 4;                // хитбокс корабля (для пуль и врагов)
  var SHIP_TW = 12, SHIP_TH = 5;                              // хитбокс корабля для рельефа
  var SHOT_V = 560, FIRE_CD = 0.15, SHOTS_MAX = 40;           // автоматический огонь
  // жар
  var HEAT_MAX = 100, SKIM = 30, SKIM_RATE = 48, HEAT_DECAY = 5, HEAT_HOLD = 0.8;
  var TIER1 = 35, TIER2 = 70, KILL_HEAT = 3, INGOT_HEAT = 22, GUARD_HEAT = 35, SKIM_PTS = 30;
  // закалка
  var QUENCH_MIN = 25, QUENCH_CD = 0.8, RING_V = 560, RING_R0 = 60, RING_PER = 1.6, RING_GRACE = 0.45;
  var ARENA = W + 160;                                        // ширина арены босса за концом уровня
  var EXTRA_LIFE = [25000, 60000, 100000], LIFE_MAX = 5;
  var TAU = Math.PI * 2;

  // Враги: радиус, прочность, очки
  var EN = {
    moth: { r: 9, hp: 1, pts: 100 }, dart: { r: 8, hp: 1, pts: 120 }, turret: { r: 10, hp: 3, pts: 200 },
    walker: { r: 11, hp: 4, pts: 300 }, mine: { r: 10, hp: 2, pts: 150 }, stinger: { r: 8, hp: 1, pts: 150 },
    ingot: { r: 12, hp: 5, pts: 300 }, guard: { r: 24, hp: 20, pts: 2000 }
  };

  // 6 уровней. c/f — толщина потолка/пола: база, две синусоиды, выступы; gap — минимальный просвет.
  var LEVELS = [
    { name: 'orbit',  boss: 'crucible', len: 3000, c: [0, 0, 0, 0],    f: [30, 16, 10, 2], bumps: 5,  gap: 190, pistons: 0, gears: 0, pool: { moths: 5, darts: 2, turret: 2, mine: 1 }, space: [200, 270] },
    { name: 'slag',   boss: 'hammer',   len: 3400, c: [34, 20, 10, 3], f: [36, 20, 12, 3], bumps: 9,  gap: 150, pistons: 3, gears: 1, pool: { moths: 4, darts: 3, turret: 3, walker: 2, mine: 2 }, space: [175, 240] },
    { name: 'gears',  boss: 'worm',     len: 3600, c: [30, 14, 8, 2],  f: [30, 14, 8, 2],  bumps: 7,  gap: 145, pistons: 5, gears: 3, pool: { moths: 4, darts: 3, turret: 3, walker: 2, mine: 2, stinger: 2 }, space: [165, 230] },
    { name: 'channel', boss: 'hive',    len: 3800, c: [54, 24, 12, 3], f: [54, 24, 12, 3], bumps: 9,  gap: 128, pistons: 3, gears: 2, pool: { moths: 3, darts: 3, turret: 5, walker: 2, mine: 2, stinger: 3 }, space: [150, 220] },
    { name: 'hive',   boss: 'mirror',   len: 4000, c: [46, 30, 14, 4], f: [46, 30, 14, 4], bumps: 10, gap: 135, pistons: 2, gears: 3, pool: { moths: 4, darts: 3, turret: 3, walker: 2, mine: 3, stinger: 2 }, space: [155, 225] },
    { name: 'heart',  boss: 'heart',    len: 4200, c: [50, 30, 14, 4], f: [50, 30, 14, 4], bumps: 10, gap: 130, pistons: 4, gears: 3, pool: { moths: 4, darts: 3, turret: 3, walker: 2, mine: 3, stinger: 3 }, space: [150, 215] }
  ];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function tierOf(h) { return h >= TIER2 ? 2 : h >= TIER1 ? 1 : 0; }

  // ---------- Уровень: рельеф, механизмы, расписание врагов (детерминированно от номера) ----------
  function buildLevel(n) {
    var def = LEVELS[n - 1], lr = mulberry32(1000 + n * 77), R = function (a, b) { return a + (b - a) * lr(); };
    var total = def.len + ARENA, N = Math.ceil(total / COL) + 2;
    var ceil = new Array(N), floor = new Array(N), i, x;
    var p = [lr() * TAU, lr() * TAU, lr() * TAU, lr() * TAU];
    var bumps = [];
    for (i = 0; i < def.bumps; i++) bumps.push({ x: R(500, def.len - 300), w: R(50, 130), h: R(22, 46), side: lr() < (def.c[0] ? 0.5 : 0) ? 'c' : 'f' });
    function prof(a, x, ph1, ph2) { return a[0] + a[1] * Math.sin(x / 140 + ph1) + a[2] * Math.sin(x / 47 + ph2) + a[3] * Math.sin(x / 13 + ph1 * 3); }
    for (i = 0; i < N; i++) {
      x = i * COL;
      var c = def.c[0] ? prof(def.c, x, p[0], p[1]) : 0, f = prof(def.f, x, p[2], p[3]);
      for (var k = 0; k < bumps.length; k++) {
        var b = bumps[k], d = Math.abs(x - b.x);
        if (d < b.w / 2) { var e = d < b.w / 2 - 18 ? 1 : (b.w / 2 - d) / 18; if (b.side === 'c') c += b.h * e; else f += b.h * e; }
      }
      var ramp = Math.min(1, Math.max(0, (x - 120) / 360));            // мягкий старт
      c *= ramp; f = f * (0.4 + 0.6 * ramp);
      if (n === 1 && x > 160 && x < 900) f = Math.min(f, 22 + 6 * Math.sin(x / 90));   // 1-й уровень: ровная кромка — учебный участок
      var ar = Math.min(1, Math.max(0, (x - (def.len - 260)) / 200));   // выход на арену
      c = c * (1 - ar) + (def.c[0] ? 14 : 0) * ar; f = f * (1 - ar) + 14 * ar;
      c = Math.max(0, c); f = Math.max(4, f);
      var gap = (H - TOP) - c - f;
      if (gap < def.gap) { var cut = (def.gap - gap); var tot = c + f; c -= cut * c / tot; f -= cut * f / tot; }
      ceil[i] = c; floor[i] = f;
    }
    var midX = Math.round(def.len * 0.52);
    var cps = [0, midX - W - 160, def.len];
    // механизмы: поршни из потолка/пола, плавающие шестерни
    var mechs = [], busy = [[midX - W - 260, midX + 120], [0, 520], [def.len - 380, total]];
    function free(x0, pad) { for (var q = 0; q < busy.length; q++) if (x0 > busy[q][0] - pad && x0 < busy[q][1] + pad) return false; return true; }
    function place(cnt, make) {
      for (var j = 0, tries = 0; j < cnt && tries < 200; tries++) {
        var mx = Math.round(R(600, def.len - 420));
        if (!free(mx, 130)) continue;
        busy.push([mx - 60, mx + 60]); mechs.push(make(mx)); j++;
      }
    }
    place(def.pistons, function (mx) { return { kind: 'piston', x: mx, w: 24, side: lr() < 0.5 ? 'c' : 'f', w8: R(0.8, 1.15), ph: lr() * TAU }; });
    place(def.gears, function (mx) { return { kind: 'gear', x: mx, r: 20, w8: R(0.55, 0.85), ph: lr() * TAU }; });
    mechs.sort(function (a, b) { return a.x - b.x; });
    // расписание врагов; на 1-м уровне первые 900 px — без врагов (учебный участок у кромки)
    var spawns = [], pool = [], kk;
    for (kk in def.pool) for (var w = 0; w < def.pool[kk]; w++) pool.push(kk);
    var sx = n === 1 ? 900 : 680, nextIngot = n === 1 ? 1300 : 900;
    while (sx < def.len - 340) {
      if (Math.abs(sx - midX) < 330) { sx = midX + 340; continue; }
      if (sx >= nextIngot) { spawns.push({ x: sx, type: 'ingot', y: R(0.3, 0.7) }); nextIngot += R(780, 900); sx += R(def.space[0] * 0.7, def.space[1] * 0.7); continue; }
      var t = pool[Math.floor(lr() * pool.length)];
      spawns.push({ x: sx, type: t, y: lr(), side: lr() < 0.5 ? 'c' : 'f', n: t === 'moths' ? 5 : t === 'darts' ? 3 : t === 'mine' ? 2 : t === 'stinger' ? 2 : 1, amp: R(24, 48) });
      sx += R(def.space[0], def.space[1]);
    }
    spawns.push({ x: midX, type: 'guard' });
    spawns.sort(function (a, b) { return a.x - b.x; });
    return { n: n, def: def, ceil: ceil, floor: floor, N: N, len: def.len, total: total, midX: midX, cps: cps, mechs: mechs, spawns: spawns };
  }

  // Параметры сложности уровня — через хук difficulty(level, base, step, max) движка
  function params(lv, diff) {
    var d = diff || function (l, base, step, max) { var v = base + (l - 1) * step; return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max)); };
    return {
      bulletV: d(lv, 110, 15, 185), fireMul: d(lv, 1.2, -0.1, 0.65), aim: d(lv, 0.15, 0.08, 0.55),
      mothV: d(lv, 78, 6, 110), dartV: d(lv, 150, 12, 220), mineBurst: lv >= 3, guardHp: d(lv, 22, 5, 50),
      bossHp: d(lv, 1, 0.12, 1.6), bossRate: d(lv, 1, -0.06, 0.7)
    };
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {};
    var maxLevel = opts.maxLevel || LEVELS.length;
    var S = {
      level: opts.level || 1, maxLevel: maxLevel, lives: opts.lives == null ? 3 : opts.lives, score: 0,
      phase: 'intro', phaseT: 0, time: 0, over: false, won: false, name: '', lv: null, prm: null,
      cx: 0, hold: false, cp: 0, cpIdx: 0, spawnIdx: 0, extra: 0, clearBonus: 0, banner: 0,
      ship: { x: 80, y: MID, dead: false, grace: 0, vx: 0, vy: 0, tilt: 0 },
      heat: 0, tier: 0, skim: 0, skimSide: null, skimX: 0, skimY: 0, heatHold: 0, qcd: 0, ring: null, fireCd: 0, flash: 0,
      shots: [], bullets: [], enemies: [], boss: null, guard: null, guardDone: false, laser: null,
      kills: 0, deaths: 0, quenches: 0, doused: 0, skimT: 0, tutor: { quench: false, quenched: false }
    };
    var dir = { x: 0, y: 0 }, skimPts = 0, skimEv = 0;
    function emit(t, d) { onEvent(t, d || {}); }
    function rr(a, b) { return a + (b - a) * rng(); }
    function addScore(n) {
      S.score += n;
      while (S.extra < EXTRA_LIFE.length && S.score >= EXTRA_LIFE[S.extra]) { S.extra++; if (S.lives < LIFE_MAX) { S.lives++; emit('life', { lives: S.lives }); } }
    }
    function addHeat(v) {
      var was = S.tier; S.heat = Math.max(0, Math.min(HEAT_MAX, S.heat + v)); S.tier = tierOf(S.heat);
      if (S.tier !== was) emit('tier', { tier: S.tier, up: S.tier > was });
      if (S.level === 1 && !S.tutor.quench && S.heat >= QUENCH_MIN) { S.tutor.quench = true; emit('tutorQuench', {}); }
    }

    // ---------- Рельеф ----------
    function colAt(arr, x) {
      var L = S.lv, f = x / COL, i = Math.floor(f);
      if (i < 0) return arr[0]; if (i >= L.N - 1) return arr[L.N - 1];
      var t = f - i; return arr[i] * (1 - t) + arr[i + 1] * t;
    }
    function ceilY(x) { return TOP + colAt(S.lv.ceil, x); }
    function floorY(x) { return H - colAt(S.lv.floor, x); }
    function mechRects(m, ahead) {   // поршень → прямоугольник; шестерня → круг (ahead — взгляд вперёд на ahead с)
      var tt = S.time + (ahead || 0);
      if (m.kind === 'piston') {
        var gap = floorY(m.x) - ceilY(m.x), L = gap * 0.42 * (0.5 - 0.5 * Math.cos(tt * m.w8 + m.ph));
        if (!ahead) m.ext = L;
        if (m.side === 'c') return { x0: m.x - m.w / 2, x1: m.x + m.w / 2, y0: TOP - 4, y1: ceilY(m.x) + L };
        return { x0: m.x - m.w / 2, x1: m.x + m.w / 2, y0: floorY(m.x) - L, y1: H + 4 };
      }
      var cy = (ceilY(m.x) + floorY(m.x)) / 2, amp = Math.max(0, (floorY(m.x) - ceilY(m.x)) / 2 - m.r - 46);
      var gy = cy + amp * Math.sin(tt * m.w8 + m.ph);
      if (!ahead) { m.cy = gy; m.rot = tt * m.w8 * 2; }
      return { cx: m.x, cy: gy, r: m.r };
    }
    var nmKey = null, nm = [];
    function nearMechs() {   // механизмы в окрестности камеры (кэш по шагу 32 px)
      var key = S.level * 100000 + Math.floor(S.cx / 32);
      if (key !== nmKey) { nmKey = key; nm = S.lv.mechs.filter(function (m) { return m.x > S.cx - 120 && m.x < S.cx + W + 120; }); }
      return nm;
    }
    function mechHit(x, y, rx, ry) {   // пересечение прямоугольника (центр, полуразмеры) с механизмами
      var ms = (x > S.cx - 60 && x < S.cx + W + 60) ? nearMechs() : S.lv.mechs;
      if (!ms.length) return null;
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i]; if (Math.abs(m.x - x) > 60) continue;
        var g = mechRects(m);
        if (g.r) { var dx = Math.max(Math.abs(x - g.cx) - rx, 0), dy = Math.max(Math.abs(y - g.cy) - ry, 0); if (dx * dx + dy * dy < g.r * g.r) return m; }
        else if (x + rx > g.x0 && x - rx < g.x1 && y + ry > g.y0 && y - ry < g.y1) return m;
      }
      return null;
    }
    function solid(x, y) { return y < ceilY(x) || y > floorY(x) || !!mechHit(x, y, 0.5, 0.5); }
    function terrainHit(x, y, hw, hh) {
      for (var xx = x - hw; xx <= x + hw + 0.01; xx += hw) { if (y - hh < ceilY(xx) || y + hh > floorY(xx)) return true; }
      return !!mechHit(x, y, hw, hh);
    }
    // зазор от корпуса корабля до раскалённой кромки (порода и механизмы) → { d, side, x, y }
    function skimGap(x, y) {
      var best = { d: 1e9, side: null, x: x, y: y }, xx, v;
      for (xx = x - SHIP_TW; xx <= x + SHIP_TW + 0.01; xx += SHIP_TW) {
        var cy = ceilY(xx);
        if (cy > TOP + 1.5) { v = (y - SHIP_TH) - cy; if (v < best.d) best = { d: v, side: 'c', x: xx, y: cy }; }
        var fy = floorY(xx); v = fy - (y + SHIP_TH); if (v < best.d) best = { d: v, side: 'f', x: xx, y: fy };
      }
      var ms = nearMechs();
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i]; if (Math.abs(m.x - x) > 70) continue;
        var g = mechRects(m);
        if (g.r) { v = Math.hypot(Math.max(Math.abs(x - g.cx) - SHIP_TW, 0), Math.max(Math.abs(y - g.cy) - SHIP_TH, 0)) - g.r; if (v < best.d) best = { d: v, side: 'm', x: g.cx, y: g.cy + (y > g.cy ? g.r : -g.r) }; }
        else { var dx = Math.max(g.x0 - (x + SHIP_TW), (x - SHIP_TW) - g.x1, 0), dy = Math.max(g.y0 - (y + SHIP_TH), (y - SHIP_TH) - g.y1, 0); v = Math.hypot(dx, dy); if (v < best.d) best = { d: v, side: 'm', x: Math.max(g.x0, Math.min(g.x1, x)), y: y < g.y0 ? g.y0 : g.y1 }; }
      }
      best.d = Math.max(0, best.d); return best;
    }

    // ---------- Уровень ----------
    function setupLevel() {
      S.lv = buildLevel(S.level); S.name = S.lv.def.name; S.prm = params(S.level, opts.difficulty);
      S.cp = 0; S.cpIdx = 0; S.guardDone = false;
      resetToCheckpoint(true);
      S.phase = 'intro'; S.phaseT = 1.6; S.banner = 1.6;
      emit('level', { level: S.level, name: S.name });
    }
    function safeY(x) { return (ceilY(x) + floorY(x)) / 2; }
    function resetToCheckpoint(fresh) {
      var L = S.lv;
      S.cx = S.cp; S.hold = false;
      S.shots = []; S.bullets = []; S.enemies = []; S.laser = null; S.ring = null;
      S.boss = null; S.guard = null;
      S.spawnIdx = 0;
      while (S.spawnIdx < L.spawns.length && L.spawns[S.spawnIdx].x < S.cx + 120) S.spawnIdx++;
      if (S.guardDone) for (var i = S.spawnIdx; i < L.spawns.length; i++) if (L.spawns[i].type === 'guard') L.spawns[i].done = true;
      var sh = S.ship; sh.x = S.cx + 90; sh.y = safeY(sh.x); sh.dead = false; sh.grace = fresh ? 0 : 2.0; sh.vx = sh.vy = 0;
      S.fireCd = 0; S.qcd = 0; S.skim = 0; S.heatHold = 0;
      if (S.cx >= L.len) spawnBoss();
    }

    // ---------- Враги ----------
    function enemy(type, x, y, extra) {
      var e = { type: type, x: x, y: y, r: EN[type].r, hp: EN[type].hp, max: EN[type].hp, t: 0, fireT: rr(0.8, 1.8), flash: 0, alive: true, vx: 0, vy: 0 };
      for (var k in extra) e[k] = extra[k];
      S.enemies.push(e); return e;
    }
    function spawn(sp) {
      var X = S.cx + W + 24, gy0 = ceilY(X + 40), gy1 = floorY(X + 40), P = S.prm, i;
      var yIn = function (u, pad) { pad = pad || 30; return gy0 + pad + (gy1 - gy0 - 2 * pad) * u; };
      switch (sp.type) {
        case 'moths':
          var y0 = yIn(sp.y, 30 + sp.amp);
          for (i = 0; i < sp.n; i++) enemy('moth', X + i * 30, y0, { y0: y0, amp: sp.amp, ph: i * 0.55, vx: -P.mothV });
          break;
        case 'darts':
          for (i = 0; i < sp.n; i++) enemy('dart', X + i * 46, yIn((sp.y + i * 0.27) % 1), { vx: -P.dartV, wait: 0 });
          break;
        case 'turret': {
          var tx = X + 30, onC = sp.side === 'c' && S.lv.def.c[0] > 0;
          enemy('turret', tx, onC ? ceilY(tx) + 9 : floorY(tx) - 9, { side: onC ? 'c' : 'f', fireT: rr(1.0, 1.8) });
          break;
        }
        case 'walker': { var wx = X + 30; enemy('walker', wx, floorY(wx) - 12, { vx: -26, fireT: rr(1.2, 2.0) }); break; }
        case 'mine': for (i = 0; i < sp.n; i++) enemy('mine', X + i * 60, yIn(rr(0.15, 0.85)), { vx: -20 }); break;
        case 'stinger': {   // заходят с кормы
          for (i = 0; i < sp.n; i++) { var sy = yIn((sp.y + i * 0.33) % 1); enemy('stinger', S.cx - 30 - i * 70, sy, { vx: SCROLL + 150, warn: 1.2 + i * 0.4, y0: sy }); }
          emit('stingerWarn', { y: yIn(sp.y) });
          break;
        }
        case 'ingot': enemy('ingot', X, yIn(sp.y), { vx: -34, fireT: 99 }); break;
        case 'guard':
          if (sp.done) break;
          S.guard = enemy('guard', X + 30, MID, { hp: P.guardHp, max: P.guardHp, fireT: 1.6, ring: 0 });
          S.hold = true; emit('guard', { x: X });
          break;
      }
    }
    function eBullet(x, y, vx, vy, kind) { var b = { x: x, y: y, vx: vx, vy: vy, r: kind === 'big' ? 5 : 3, kind: kind || 'spark', t: 0 }; S.bullets.push(b); return b; }
    function aimAt(x, y, sp, spread) {
      var a = Math.atan2(S.ship.y - y, S.ship.x - x) + (spread || 0);
      return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp };
    }
    function enemyFire(e) {
      var P = S.prm, v;
      if (S.ship.dead || S.ship.grace > 0.6) return;
      var sx = e.x - S.cx; if (sx < 30 || sx > W - 10) return;
      switch (e.type) {
        case 'turret': v = aimAt(e.x, e.y, P.bulletV); eBullet(e.x, e.y, v.vx, v.vy); e.fireT = rr(1.6, 2.4) * P.fireMul; break;
        case 'walker': v = aimAt(e.x, e.y - 8, P.bulletV * 0.9); eBullet(e.x, e.y - 8, v.vx, v.vy); e.fireT = rr(2.0, 2.8) * P.fireMul; break;
        case 'ingot': e.fireT = 99; return;
        case 'guard': {
          var G = e; G.ring = (G.ring + 1) % 3;
          if (G.ring === 2 && S.level >= 2) { for (var k = 0; k < 8 + S.level; k++) { var a = k / (8 + S.level) * TAU + rr(0, 0.3); eBullet(G.x, G.y, Math.cos(a) * P.bulletV * 0.8, Math.sin(a) * P.bulletV * 0.8); } }
          else { [-0.2, 0, 0.2].forEach(function (o) { var w = aimAt(G.x, G.y, P.bulletV, o); eBullet(G.x - 20, G.y, w.vx, w.vy); }); }
          G.fireT = 1.35 * P.fireMul; break;
        }
        default:
          if (rng() < P.aim) { v = aimAt(e.x, e.y, P.bulletV); eBullet(e.x, e.y, v.vx, v.vy); }
          e.fireT = rr(2.5, 4.5) * P.fireMul;
      }
      emit('eshot', { type: e.type });
    }
    function killEnemy(e, by) {
      if (!e.alive) return;
      e.alive = false; S.kills++; addScore(EN[e.type].pts);
      var heat = e.type === 'ingot' ? INGOT_HEAT : e.type === 'guard' ? GUARD_HEAT : KILL_HEAT;
      emit('kill', { x: e.x, y: e.y, type: e.type, pts: EN[e.type].pts, by: by, heat: heat });
      addHeat(heat); S.heatHold = Math.max(S.heatHold, HEAT_HOLD);
      if (e.type === 'mine' && S.prm.mineBurst) for (var k = 0; k < 6; k++) { var a = k / 6 * TAU + 0.26; eBullet(e.x, e.y, Math.cos(a) * 90, Math.sin(a) * 90); }
      if (e.type === 'guard') {
        S.guard = null; S.hold = false; S.guardDone = true;
        S.bullets = [];
        emit('guardDie', { x: e.x, y: e.y });
      }
    }
    function damage(e, dmg, by) {
      if (!e.alive) return;
      e.hp -= dmg; e.flash = 0.12;
      if (e.hp <= 0) killEnemy(e, by); else emit('hit', { x: e.x, y: e.y, type: e.type });
    }
    function updateEnemies(dt) {
      var sh = S.ship;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive) continue;
        e.t += dt; if (e.flash > 0) e.flash -= dt;
        switch (e.type) {
          case 'moth': e.x += e.vx * dt; e.y = e.y0 + e.amp * Math.sin(e.t * 2.6 + e.ph); break;
          case 'dart':
            e.x += e.vx * dt;
            if (e.x - S.cx < W - 60) { var dy = sh.y - e.y; e.y += Math.max(-50, Math.min(50, dy * 1.2)) * dt; }
            break;
          case 'turret': e.aim = Math.atan2(sh.y - e.y, sh.x - e.x); break;
          case 'walker': e.x += e.vx * dt; e.y = floorY(e.x) - 12; e.step = e.t * 5; break;
          case 'mine': e.x += e.vx * dt; e.y += Math.sign(sh.y - e.y) * 14 * dt; e.rot = e.t * 1.5; break;
          case 'stinger':
            if (e.warn > 0) { e.warn -= dt; e.x = S.cx - 30; break; }
            e.x += e.vx * dt; e.y += Math.max(-30, Math.min(30, (e.y0 - e.y))) * dt; break;
          case 'ingot': e.x += e.vx * dt; e.y += Math.sin(e.t * 1.7) * 12 * dt; e.rot = e.t * 0.8; break;
          case 'guard': {
            var tx = S.cx + W - 110; e.x += Math.max(-90, Math.min(90, (tx - e.x) * 2)) * dt;
            e.y = MID + Math.sin(e.t * 0.8) * Math.max(0, (floorY(e.x) - ceilY(e.x)) / 2 - 50);
            break;
          }
        }
        // рельеф убивает летающих (кроме наземных и турелей)
        if ((e.type === 'moth' || e.type === 'dart' || e.type === 'stinger') && solid(e.x, e.y)) { e.alive = false; emit('crash', { x: e.x, y: e.y }); continue; }
        e.fireT -= dt; if (e.fireT <= 0 && S.phase === 'play') enemyFire(e);
        var sx = e.x - S.cx;
        if (sx < -60 || (sx > W + 260 && e.type !== 'stinger')) { e.alive = false; e.gone = true; continue; }
        // столкновение с кораблём
        if (!sh.dead && sh.grace <= 0 && Math.abs(e.x - sh.x) < e.r + SHIP_HW - 2 && Math.abs(e.y - sh.y) < e.r + SHIP_HH - 1) {
          if (e.type !== 'guard') damage(e, 99, 'ram'); shipHit('enemy'); return;
        }
      }
      S.enemies = S.enemies.filter(function (e) { return e.alive; });
    }

    // ---------- Корабль ----------
    function shipHit(why) {
      var sh = S.ship; if (sh.dead || S.over || S.phase !== 'play' || S.god) return;   // god — только для съёмки промо
      sh.dead = true; S.lives--; S.deaths++; S.phase = 'dead'; S.phaseT = 1.6;
      S.heat = 0; S.tier = 0; S.ring = null;   // гибель: жар остывает
      emit('playerHit', { x: sh.x, y: sh.y, lives: S.lives, why: why });
      if (S.lives <= 0) { S.over = true; S.phase = 'over'; emit('gameover', { score: S.score }); }
    }
    function moveShip(dt) {
      var sh = S.ship; if (sh.dead) return;
      var dx = dir.x, dy = dir.y, n = Math.hypot(dx, dy) || 1;
      sh.vx = dx / n * SHIP_V; sh.vy = dy / n * SHIP_V;
      sh.x += sh.vx * dt + (S.hold || S.cx >= S.lv.len ? 0 : SCROLL * dt);
      sh.y += sh.vy * dt;
      sh.x = Math.max(S.cx + 16, Math.min(S.cx + W - 24, sh.x));
      sh.y = Math.max(TOP + SHIP_TH, Math.min(H - SHIP_TH, sh.y));
      sh.tilt += ((dy || 0) - sh.tilt) * Math.min(1, dt * 10);
      if (sh.grace > 0) sh.grace -= dt;
      if (terrainHit(sh.x, sh.y, SHIP_TW, SHIP_TH)) shipHit('wall');
    }

    // ---------- Жар: скольжение вдоль кромки ----------
    function updateHeat(dt) {
      var sh = S.ship; if (sh.dead) { S.skim = 0; return; }
      var g = skimGap(sh.x, sh.y), k = g.d < SKIM ? 1 - g.d / SKIM : 0;
      S.skim = k; S.skimSide = k > 0 ? g.side : null; S.skimX = g.x; S.skimY = g.y;
      if (k > 0) {
        addHeat(SKIM_RATE * k * dt); S.heatHold = HEAT_HOLD; S.skimT += dt;
        skimPts += SKIM_PTS * k * dt; if (skimPts >= 10) { addScore(10); skimPts -= 10; }
        skimEv -= dt; if (skimEv <= 0) { skimEv = 0.09; emit('skim', { x: g.x, y: g.y, k: k, side: g.side }); }
      } else if (S.heatHold > 0) S.heatHold -= dt;
      else if (S.heat > 0) addHeat(-HEAT_DECAY * dt);
    }

    // ---------- Огонь (автоматический, мощность — от жара) ----------
    function shot(x, y, vx, vy, kind, dmg, extra) {
      var s = { x: x, y: y, vx: vx, vy: vy, kind: kind, dmg: dmg, t: 0, life: 2, r: 3 };
      for (var k in extra) s[k] = extra[k];
      S.shots.push(s); return s;
    }
    function volley() {
      var sh = S.ship; if (sh.dead || S.fireCd > 0 || S.shots.length > SHOTS_MAX) return false;
      S.fireCd = FIRE_CD; S.flash = 0.06;
      var x = sh.x + 14, y = sh.y, t = S.tier;
      if (t === 0) shot(x, y, SHOT_V, 0, 'shot', 1);
      else if (t === 1) { shot(x, y - 4, SHOT_V, 0, 'shot', 1); shot(x, y + 4, SHOT_V, 0, 'shot', 1); }
      else {
        shot(x, y - 4, SHOT_V, 0, 'hot', 1.5, { r: 4 }); shot(x, y + 4, SHOT_V, 0, 'hot', 1.5, { r: 4 });
        [-0.2, 0.2].forEach(function (a) { shot(x, y, Math.cos(a) * SHOT_V * 0.9, Math.sin(a) * SHOT_V * 0.9, 'spark', 1, { life: 0.55, r: 2 }); });
      }
      emit('shoot', { x: sh.x, y: sh.y, tier: t });
      return true;
    }
    function updateFire(dt) {
      if (S.fireCd > 0) S.fireCd -= dt; if (S.flash > 0) S.flash -= dt; if (S.qcd > 0) S.qcd -= dt;
      if (S.ship.dead || (S.phase !== 'play' && S.phase !== 'intro')) return;
      volley();
    }

    // ---------- Закалка: паровое кольцо ----------
    function quench() {
      var sh = S.ship;
      if (sh.dead || S.over || (S.phase !== 'play' && S.phase !== 'intro') || S.heat < QUENCH_MIN || S.qcd > 0) return false;
      var h = S.heat;
      S.ring = { x: sh.x, y: sh.y, r: 8, R: RING_R0 + RING_PER * h, dmg: 2 + h / 12, heat: h, hit: [], boss: false, parts: [], t: 0 };
      addHeat(-h); S.qcd = QUENCH_CD; S.quenches++; S.heatHold = 0;
      sh.grace = Math.max(sh.grace, RING_GRACE);
      if (S.level === 1) S.tutor.quenched = true;
      emit('quench', { x: sh.x, y: sh.y, heat: h, R: S.ring.R });
      return true;
    }
    function updateRing(dt) {
      var Rg = S.ring; if (!Rg) return;
      var sh = S.ship; Rg.x = sh.x; Rg.y = sh.y; Rg.t += dt;
      Rg.r = Math.min(Rg.R, Rg.r + RING_V * dt);
      var n = 0, i;
      for (i = S.bullets.length - 1; i >= 0; i--) { var b = S.bullets[i]; if (Math.hypot(b.x - Rg.x, b.y - Rg.y) < Rg.r + b.r) { S.bullets.splice(i, 1); n++; } }
      if (n) { S.doused += n; emit('douse', { n: n, x: Rg.x, y: Rg.y }); }
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive || e.warn > 0 || Rg.hit.indexOf(e) >= 0) continue;
        if (Math.hypot(e.x - Rg.x, e.y - Rg.y) < Rg.r + e.r) { Rg.hit.push(e); damage(e, Rg.dmg, 'ring'); }
      }
      var B = S.boss;
      if (B && B.alive && B.enter <= 0) {
        if (!Rg.boss && B.open && Math.hypot(B.weak.x - Rg.x, B.weak.y - Rg.y) < Rg.r + B.weak.r) { Rg.boss = true; bossDamage(Rg.dmg * 2, 'ring'); }
        B.parts.forEach(function (p) { if (p.alive && Rg.parts.indexOf(p) < 0 && Math.hypot(p.x - Rg.x, p.y - Rg.y) < Rg.r + 18) { Rg.parts.push(p); partDamage(p, Rg.dmg); } });
      }
      if (Rg.r >= Rg.R) S.ring = null;
    }

    // ---------- Снаряды игрока ----------
    function hitTest(s) {   // → true: снаряд поглощён
      var i, rad = s.r || 3;
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive || e.warn > 0) continue;
        if (Math.abs(e.x - s.x) < e.r + rad && Math.abs(e.y - s.y) < e.r + rad) { damage(e, s.dmg, s.kind); return true; }
      }
      var B = S.boss;
      if (B && B.alive) {
        if (B.open && Math.hypot(B.weak.x - s.x, B.weak.y - s.y) < B.weak.r + rad) { bossDamage(s.dmg, s.kind); return true; }
        for (i = 0; i < B.armor.length; i++) { var a = B.armor[i]; if (Math.hypot(a.x - s.x, a.y - s.y) < a.r + rad) { if (a.part) partDamage(a.part, s.dmg); else emit('clang', { x: s.x, y: s.y }); return true; } }
      }
      return false;
    }
    function updateShots(dt) {
      for (var i = S.shots.length - 1; i >= 0; i--) {
        var s = S.shots[i], dead = false;
        s.t += dt; if (s.t > s.life) { S.shots.splice(i, 1); continue; }
        var dist = Math.hypot(s.vx, s.vy) * dt, n = Math.max(1, Math.ceil(dist / 8));
        for (var k = 0; k < n && !dead; k++) {
          var h = dt / n, nx = s.x + s.vx * h, ny = s.y + s.vy * h;
          if (solid(nx, ny)) { dead = true; emit('wallHit', { x: nx, y: ny, kind: s.kind }); break; }
          s.x = nx; s.y = ny;
          var sx = s.x - S.cx;
          if (sx > W + 20 || sx < -20 || s.y < TOP - 10 || s.y > H + 10) { dead = true; break; }
          if (hitTest(s)) dead = true;
        }
        if (dead) S.shots.splice(i, 1);
      }
    }
    function updateBullets(dt) {
      var sh = S.ship;
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i]; b.t += dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        var sx = b.x - S.cx;
        if (sx < -20 || sx > W + 30 || b.y < TOP - 10 || b.y > H + 10 || b.t > 9) { S.bullets.splice(i, 1); continue; }
        if (solid(b.x, b.y)) { S.bullets.splice(i, 1); emit('bulletWall', { x: b.x, y: b.y }); continue; }
        if (!sh.dead && sh.grace <= 0 && Math.abs(b.x - sh.x) < SHIP_HW + b.r - 2 && Math.abs(b.y - sh.y) < SHIP_HH + b.r - 1) { S.bullets.splice(i, 1); shipHit('bullet'); return; }
      }
    }

    // ---------- Боссы ----------
    var BOSS_HP = { crucible: 30, hammer: 34, worm: 26, hive: 40, mirror: 42, heart: 52 };
    function spawnBoss() {
      var L = S.lv, type = L.def.boss, hp = Math.round(BOSS_HP[type] * S.prm.bossHp);
      var B = { type: type, x: L.len + W - 130, y: MID, bx: L.len + W - 130, hp: hp, max: hp, t: 0, fireT: 2.0, alive: true, open: false, flash: 0,
        weak: { x: 0, y: 0, r: 13 }, armor: [], parts: [], segs: [], hot: 9, phase2: false, enter: 1.6 };
      if (type === 'heart') B.parts = [{ dy: -96, hp: 12, max: 12, alive: true, fireT: 1.5 }, { dy: 96, hp: 12, max: 12, alive: true, fireT: 2.2 }];
      if (type === 'worm') for (var i = 0; i < 10; i++) B.segs.push({ x: B.x, y: B.y });
      S.boss = B; layoutBoss(B, 0);
      emit('boss', { type: type });
    }
    function layoutBoss(B, dt) {
      var t = B.t, cyc, X = B.bx + Math.max(0, B.enter) * 220, sp = 1 / S.prm.bossRate;
      B.armor = [];
      switch (B.type) {
        case 'crucible':   // Горнило: пасть открывается на вдохе
          B.x = X; B.y = MID + 46 * Math.sin(t * 0.5);
          cyc = (t * sp) % 4.2; B.open = cyc >= 2.0;
          B.armor.push({ x: B.x + 24, y: B.y, r: 52 }, { x: B.x + 12, y: B.y - 58, r: 22 }, { x: B.x + 12, y: B.y + 58, r: 22 });
          B.weak = { x: B.x - 34, y: B.y, r: 14 };
          if (!B.open) B.armor.push({ x: B.weak.x, y: B.weak.y, r: 15 });
          break;
        case 'hammer': {   // Молот: глаз прикрыт качающимся бойком; бросок вперёд
          var dash = (t * sp) % 6, push = dash > 4.6 ? Math.sin((dash - 4.6) / 1.4 * Math.PI) * 170 : 0;
          B.x = X - push; B.y = MID + 70 * Math.sin(t * 0.6); B.open = true; B.dash = push;
          B.weak = { x: B.x - 28, y: B.y - 12, r: 12 };
          B.armor.push({ x: B.x + 8, y: B.y + 6, r: 44 }, { x: B.x + 40, y: B.y - 38, r: 24 });
          B.head = { x: B.x - 70, y: B.y - 12 + 74 * Math.cos(t * 1.5), r: 24 };
          B.armor.push(B.head);
          break;
        }
        case 'worm': {   // Цепь: звенья петляют «восьмёркой»; раскалённое звено бежит от хвоста к голове — уязвимо только оно
          var cx = S.cx + W - 230, path = function (tt) { return { x: cx + 160 * Math.cos(tt * 0.7), y: MID + 105 * Math.sin(tt * 1.4) }; };
          if (B.enter > 0) cx += B.enter * 220;
          for (var i = 0; i < B.segs.length; i++) { var q = path(t - i * 0.2); B.segs[i].x = q.x; B.segs[i].y = q.y; }
          B.x = B.segs[0].x; B.y = B.segs[0].y; B.open = true;
          B.hot = 9 - Math.floor((t * sp) / 1.2) % 9;   // 9..1, по 1.2 с
          for (i = 0; i < B.segs.length; i++) if (i !== B.hot) B.armor.push({ x: B.segs[i].x, y: B.segs[i].y, r: i === 0 ? 18 : 15 });
          var hs = B.segs[B.hot]; B.weak = { x: hs.x, y: hs.y, r: 14 };
          break;
        }
        case 'hive':   // Улей: ядро открыто, пока выпускает рой
          B.x = X; B.y = MID + 30 * Math.sin(t * 0.4);
          cyc = (t * sp) % 5; B.open = cyc >= 3.0;
          B.armor.push({ x: B.x + 16, y: B.y, r: 58 }, { x: B.x - 20, y: B.y - 64, r: 20 }, { x: B.x - 20, y: B.y + 64, r: 20 });
          B.weak = { x: B.x - 46, y: B.y, r: 15 };
          if (!B.open) B.armor.push({ x: B.weak.x, y: B.weak.y, r: 16 });
          break;
        case 'mirror': {   // Зерцало: глаз открыт, пока копит луч; потом луч через весь экран
          cyc = (t * sp) % 5.2;
          if (cyc < 3.2) { B.y = MID + 96 * Math.sin(B.t2 = (B.t2 || 0) + (dt || 0) * 0.55); B.laserY = null; }
          B.x = X; B.open = cyc >= 3.2 && cyc < 4.5; B.mode = cyc < 3.2 ? 'move' : cyc < 4.5 ? 'charge' : 'laser';
          B.armor.push({ x: B.x + 10, y: B.y, r: 38 }, { x: B.x + 34, y: B.y - 46, r: 17 }, { x: B.x + 34, y: B.y + 46, r: 17 });
          B.weak = { x: B.x - 26, y: B.y, r: 13 };
          if (!B.open) B.armor.push({ x: B.weak.x, y: B.weak.y, r: 14 });
          S.laser = B.mode === 'laser' ? { y: B.y, x0: S.cx - 10, x1: B.x - 30, h: 7 } : B.mode === 'charge' ? { y: B.y, x0: S.cx - 10, x1: B.x - 30, h: 0, warn: (cyc - 3.2) / 1.3 } : null;
          break;
        }
        case 'heart': {   // Сердце Окалины: две пушки-руки и ядро со створками
          B.x = X; B.y = MID + 20 * Math.sin(t * 0.7);
          cyc = (t * sp * (B.phase2 ? 1.25 : 1)) % 3.6; B.open = cyc >= 2.0;
          B.armor.push({ x: B.x + 22, y: B.y, r: 62 });
          B.weak = { x: B.x - 50, y: B.y, r: 16 };
          if (!B.open) B.armor.push({ x: B.weak.x, y: B.weak.y, r: 17 });
          B.parts.forEach(function (p) { p.x = B.x - 30; p.y = B.y + p.dy; if (p.alive) B.armor.push({ x: p.x, y: p.y, r: 18, part: p }); else B.armor.push({ x: p.x + 14, y: p.y, r: 12 }); });
          break;
        }
      }
    }
    function bossDamage(dmg, by) {
      var B = S.boss; if (!B || !B.alive || B.enter > 0) return;
      B.hp -= dmg; B.flash = 0.1;
      addScore(20); emit('bossHit', { x: B.weak.x, y: B.weak.y, hp: B.hp, by: by });
      if (!B.phase2 && B.hp <= B.max / 2) { B.phase2 = true; emit('bossRage', {}); }
      if (B.hp <= 0) {
        B.alive = false; S.kills++; var pts = 5000 + 1000 * S.level; addScore(pts);
        S.bullets = []; S.laser = null; S.ring = null; S.enemies.forEach(function (e) { e.alive = false; }); S.enemies = [];
        emit('bossDie', { x: B.x, y: B.y, pts: pts, type: B.type });
        S.clearBonus = 1000 * S.level; addScore(S.clearBonus);
        S.phase = 'clear'; S.phaseT = 2.6;
        emit('clear', { level: S.level, bonus: S.clearBonus });
      }
    }
    function partDamage(p, dmg) {
      p.hp -= dmg; emit('partHit', { x: p.x, y: p.y });
      if (p.hp <= 0 && p.alive) { p.alive = false; addScore(800); emit('partDie', { x: p.x, y: p.y }); }
    }
    function bossFire(B) {
      var P = S.prm, v, k, a, rate = S.prm.bossRate * (B.phase2 ? 0.85 : 1) * 1.2;
      var bv = P.bulletV * 0.85;
      switch (B.type) {
        case 'crucible':
          if (B.open) { for (k = -2; k <= 2; k++) { v = aimAt(B.weak.x, B.weak.y, bv, k * 0.24); eBullet(B.weak.x - 6, B.weak.y, v.vx, v.vy); } B.fireT = 1.0 * rate; }
          else { var vy = (B.vent = !B.vent) ? -58 : 58; v = aimAt(B.x + 12, B.y + vy, bv * 1.05); eBullet(B.x + 12, B.y + vy, v.vx, v.vy, 'big'); B.fireT = 0.85 * rate; }
          break;
        case 'hammer':
          [-0.18, 0, 0.18].forEach(function (o) { var w = aimAt(B.x - 40, B.y + 6, bv, o); eBullet(B.x - 40, B.y + 6, w.vx, w.vy); });
          if (B.phase2) for (k = 0; k < 10; k++) { a = k / 10 * TAU; eBullet(B.x, B.y, Math.cos(a) * bv * 0.7, Math.sin(a) * bv * 0.7); }
          B.fireT = (B.phase2 ? 1.6 : 1.3) * rate; break;
        case 'worm': {
          var hd = B.segs[0]; v = aimAt(hd.x, hd.y, bv * 0.9); eBullet(hd.x, hd.y, v.vx, v.vy, 'big');
          B.fireT = (B.phase2 ? 2.0 : 2.6) * rate; break;
        }
        case 'hive':
          if (B.open) { enemy('moth', B.weak.x - 10, B.weak.y, { y0: B.weak.y + rr(-60, 60), amp: rr(20, 50), ph: rr(0, TAU), vx: -S.prm.mothV, hive: true }); B.fireT = 0.65 * rate; }
          else { [-0.12, 0.12].forEach(function (o) { var w = aimAt(B.x - 30, B.y, bv, o); eBullet(B.x - 30, B.y, w.vx, w.vy); }); B.fireT = 1.2 * rate; }
          break;
        case 'mirror':
          if (B.mode === 'move') { [-0.25, 0, 0.25].forEach(function (o) { var w = aimAt(B.x - 20, B.y, bv, o); eBullet(B.x - 20, B.y, w.vx, w.vy); }); }
          B.fireT = 1.5 * rate; break;
        case 'heart':
          if (B.open) { B.spin = (B.spin || 0) + 0.5; for (k = 0; k < 4; k++) { a = Math.PI + (k - 1.5) * 0.36 + Math.sin(B.spin) * 0.3; eBullet(B.weak.x, B.weak.y, Math.cos(a) * bv * 0.9, Math.sin(a) * bv * 0.9); } B.fireT = 0.85 * rate; }
          else { v = aimAt(B.weak.x, B.weak.y, bv * 1.1); eBullet(B.weak.x, B.weak.y, v.vx, v.vy, 'big'); B.fireT = 1.0 * rate; }
          break;
      }
      emit('bossFire', { type: B.type });
    }
    function updateBoss(dt) {
      var B = S.boss; if (!B || !B.alive) return;
      if (B.enter > 0) B.enter -= dt * 0.8;
      B.t += dt; if (B.flash > 0) B.flash -= dt;
      layoutBoss(B, dt);
      if (B.enter > 0) return;
      B.fireT -= dt; if (B.fireT <= 0 && S.phase === 'play' && !S.ship.dead) bossFire(B);
      if (B.type === 'heart') B.parts.forEach(function (p) {
        if (!p.alive) return; p.fireT -= dt;
        if (p.fireT <= 0) { var v = aimAt(p.x, p.y, S.prm.bulletV); eBullet(p.x - 14, p.y, v.vx, v.vy); p.fireT = (B.phase2 ? 1.5 : 1.9) * S.prm.bossRate; }
      });
      var sh = S.ship; if (sh.dead || sh.grace > 0) return;
      var all = B.armor.concat(B.open ? [B.weak] : []);
      for (var i = 0; i < all.length; i++) { var a = all[i]; if (Math.hypot(a.x - sh.x, a.y - sh.y) < a.r + SHIP_HH + 2) { shipHit('boss'); return; } }
      var Lz = S.laser; if (Lz && Lz.h > 0 && sh.x < Lz.x1 && Math.abs(sh.y - Lz.y) < Lz.h + SHIP_HH) shipHit('laser');
    }

    // ---------- Основной шаг ----------
    function update(dt) {
      if (S.over) return;
      S.time += dt;
      if (S.banner > 0) S.banner -= dt;
      var L = S.lv;
      if (S.phase === 'intro') {
        S.phaseT -= dt; moveShip(dt); updateHeat(dt); updateFire(dt); updateRing(dt); updateShots(dt);
        if (S.phaseT <= 0) S.phase = 'play';
        return;
      }
      if (S.phase === 'dead') {
        S.phaseT -= dt; updateShots(dt);
        if (S.phaseT <= 0) { resetToCheckpoint(false); S.phase = 'play'; emit('respawn', { cp: S.cp }); }
        return;
      }
      if (S.phase === 'clear') {
        S.phaseT -= dt; moveShip(dt); updateShots(dt); S.skim = 0;
        if (S.phaseT <= 0) {
          if (S.level >= S.maxLevel) { S.over = true; S.won = true; S.phase = 'over'; emit('win', { score: S.score }); }
          else { S.level++; setupLevel(); }
        }
        return;
      }
      // play
      if (!S.hold && S.cx < L.len) { S.cx = Math.min(L.len, S.cx + SCROLL * dt); if (S.cx >= L.len && !S.boss) spawnBoss(); }
      while (S.cpIdx + 1 < L.cps.length && S.cx >= L.cps[S.cpIdx + 1]) { S.cpIdx++; S.cp = L.cps[S.cpIdx]; emit('checkpoint', { idx: S.cpIdx, x: S.cp }); }
      while (S.spawnIdx < L.spawns.length && L.spawns[S.spawnIdx].x <= S.cx + W) spawn(L.spawns[S.spawnIdx++]);
      moveShip(dt); if (S.phase !== 'play') return;
      updateHeat(dt);
      updateFire(dt);
      updateRing(dt);
      updateShots(dt);
      if (S.phase !== 'play') return;
      updateEnemies(dt); if (S.phase !== 'play') return;
      updateBoss(dt); if (S.phase !== 'play') return;
      updateBullets(dt); if (S.phase !== 'play') return;
      L.mechs.forEach(function (m) { if (Math.abs(m.x - S.cx - W / 2) < W) mechRects(m); });
    }

    // ---------- Реклама за награду (площадки) ----------
    function reviveAd() {   // «ещё один шанс»: после последнего корабля — 1 корабль у контрольной точки
      if (!S.over || S.won) return false;
      S.over = false; S.lives = 1; resetToCheckpoint(false); S.ship.grace = 2.5; S.phase = 'play';
      emit('respawn', { cp: S.cp, ad: true });
      return true;
    }
    function canBoost() { return !S.over && S.lives < LIFE_MAX; }
    function boost() { if (!canBoost()) return false; S.lives++; addHeat(HEAT_MAX); emit('life', { lives: S.lives, ad: true }); return true; }

    var api = {
      start: function () { setupLevel(); return api; },
      update: update,
      setDir: function (x, y) { dir.x = x > 0 ? 1 : x < 0 ? -1 : 0; dir.y = y > 0 ? 1 : y < 0 ? -1 : 0; },
      quench: quench,
      canQuench: function () { return !S.ship.dead && S.heat >= QUENCH_MIN && S.qcd <= 0; },
      reviveAd: reviveAd, canBoost: canBoost, boost: boost,
      state: function () { return S; },
      _S: S,
      // для тестов и ботов
      _setupLevel: function (n) { S.level = n; setupLevel(); return S; },
      _ceilY: ceilY, _floorY: floorY, _solid: solid, _terrainHit: terrainHit, _mechRects: mechRects, _skimGap: skimGap,
      _spawn: spawn, _enemy: enemy, _bullet: eBullet, _heat: function (v) { addHeat(v - S.heat); }, _spawnBoss: spawnBoss, _layoutBoss: layoutBoss,
      _shipHit: shipHit, _volley: volley, _bossDamage: bossDamage
    };
    return api;
  }

  Sp.Game = Game;
  Sp.logic = {
    W: W, H: H, TOP: TOP, MID: MID, COL: COL, SCROLL: SCROLL, SHIP_V: SHIP_V, SHIP_HW: SHIP_HW, SHIP_HH: SHIP_HH, SHIP_TW: SHIP_TW, SHIP_TH: SHIP_TH,
    SHOT_V: SHOT_V, FIRE_CD: FIRE_CD, HEAT_MAX: HEAT_MAX, SKIM: SKIM, SKIM_RATE: SKIM_RATE, HEAT_DECAY: HEAT_DECAY, HEAT_HOLD: HEAT_HOLD,
    TIER1: TIER1, TIER2: TIER2, KILL_HEAT: KILL_HEAT, INGOT_HEAT: INGOT_HEAT, GUARD_HEAT: GUARD_HEAT,
    QUENCH_MIN: QUENCH_MIN, QUENCH_CD: QUENCH_CD, RING_V: RING_V, RING_R0: RING_R0, RING_PER: RING_PER, ARENA: ARENA, LIFE_MAX: LIFE_MAX,
    EXTRA_LIFE: EXTRA_LIFE, EN: EN, LEVELS: LEVELS, params: params, buildLevel: buildLevel, mulberry32: mulberry32, tierOf: tierOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
