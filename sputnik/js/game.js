/* СПУТНИК · логика без DOM (детерминирована при заданном rng). SPUTNIK.Game(opts), SPUTNIK.logic
   Горизонтальный космический скролл-шутер студии «Гефест»: корабль «Горн» летит слева направо сквозь
   пояс Окалины. Рядом — неуязвимый дрон-спутник «Наковальня» (раскалённый кованый шар):
   - крепится к носу или к корме — с той стороны, откуда подлетел;
   - глотает вражеские пули и жжёт врагов касанием;
   - отстёгивается кнопкой и улетает вперёд (с кормы — назад), повторное нажатие — возврат;
   - капсулы меняют его луч: «рикошет» (отражается от стен), «змейка» (ползёт по рельефу), «веер».
   Корабль: обычный выстрел по нажатию, удержание огня копит заряд, отпускание — пробивной луч.
   До двух малых спутников-«оптик» сверху и снизу. Рельеф (стены пещер, поршни, шестерни) убивает корабль.
   6 уровней: волны врагов, полубосс посередине, в конце — крупный босс со слабым местом. 3 жизни,
   при гибели — возврат к контрольной точке. Все координаты — мировые (x растёт вправо), камера S.cx. */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK = global.SPUTNIK || {};

  // ---------- Поле и константы ----------
  var W = 640, H = 360, TOP = 26, MID = (TOP + H) / 2;       // TOP — низ полосы HUD
  var COL = 8;                                                // шаг колонок рельефа, px
  var SCROLL = 44;                                            // скорость камеры, px/с
  var SHIP_V = 160, SHIP_HW = 11, SHIP_HH = 5;                // хитбокс корабля (для пуль и врагов)
  var SHIP_TW = 13, SHIP_TH = 6;                              // хитбокс корабля для рельефа
  var SHOT_V = 560, SHOT_MAX = 6, VOLLEY_CD = 0.09;
  var CHARGE_DELAY = 0.14, CHARGE_TIME = 1.0, CHARGE_MIN = 0.3, BEAM_V = 660;
  var DRONE_R = 11, DRONE_OFF = 20, DRONE_LAUNCH_V = 340, DRONE_RETURN_V = 280, DRONE_FOLLOW_V = 80, DRONE_DPS = 7;
  var OPTIC_R = 6, OPTIC_DY = 24;
  var ARENA = W + 160;                                        // ширина арены босса за концом уровня
  var EXTRA_LIFE = [50000];
  var TAU = Math.PI * 2;

  // Враги: радиус, прочность, очки
  var EN = {
    moth: { r: 9, hp: 1, pts: 100 }, dart: { r: 8, hp: 1, pts: 120 }, turret: { r: 10, hp: 3, pts: 200 },
    walker: { r: 11, hp: 4, pts: 300 }, mine: { r: 10, hp: 2, pts: 150 }, stinger: { r: 8, hp: 1, pts: 150 },
    pod: { r: 12, hp: 3, pts: 300 }, guard: { r: 24, hp: 20, pts: 2000 }
  };
  var CAPS = ['R', 'S', 'V', 'O'];   // R — рикошет, S — змейка, V — веер, O — оптика

  // 6 уровней. c/f — толщина потолка/пола: база, две синусоиды, выступы; gap — минимальный просвет.
  var LEVELS = [
    { name: 'orbit',  boss: 'crucible', len: 3000, c: [0, 0, 0, 0],    f: [30, 16, 10, 2], bumps: 5,  gap: 190, pistons: 0, gears: 0, pool: { moths: 5, darts: 2, turret: 2, mine: 1 }, space: [200, 270], caps: ['R', 'O', 'V', 'S'] },
    { name: 'slag',   boss: 'hammer',   len: 3400, c: [34, 20, 10, 3], f: [36, 20, 12, 3], bumps: 9,  gap: 150, pistons: 3, gears: 1, pool: { moths: 4, darts: 3, turret: 3, walker: 2, mine: 2 }, space: [175, 240], caps: ['O', 'S', 'R', 'V'] },
    { name: 'gears',  boss: 'worm',     len: 3600, c: [30, 14, 8, 2],  f: [30, 14, 8, 2],  bumps: 7,  gap: 145, pistons: 5, gears: 3, pool: { moths: 4, darts: 3, turret: 3, walker: 2, mine: 2, stinger: 2 }, space: [165, 230], caps: ['V', 'O', 'S', 'R'] },
    { name: 'channel', boss: 'hive',    len: 3800, c: [54, 24, 12, 3], f: [54, 24, 12, 3], bumps: 9,  gap: 128, pistons: 3, gears: 2, pool: { moths: 3, darts: 3, turret: 5, walker: 2, mine: 2, stinger: 3 }, space: [150, 220], caps: ['S', 'R', 'O', 'V'] },
    { name: 'hive',   boss: 'mirror',   len: 4000, c: [46, 30, 14, 4], f: [46, 30, 14, 4], bumps: 10, gap: 135, pistons: 2, gears: 3, pool: { moths: 4, darts: 3, turret: 3, walker: 2, mine: 3, stinger: 2 }, space: [155, 225], caps: ['R', 'V', 'O', 'S'] },
    { name: 'heart',  boss: 'heart',    len: 4200, c: [50, 30, 14, 4], f: [50, 30, 14, 4], bumps: 10, gap: 130, pistons: 4, gears: 3, pool: { moths: 4, darts: 3, turret: 3, walker: 2, mine: 3, stinger: 3 }, space: [150, 215], caps: ['O', 'R', 'S', 'V'] }
  ];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

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
    place(def.gears, function (mx) { return { kind: 'gear', x: mx, r: 20, w8: R(0.7, 1.05), ph: lr() * TAU }; });
    mechs.sort(function (a, b) { return a.x - b.x; });
    // расписание врагов
    var spawns = [], pool = [], kk;
    for (kk in def.pool) for (var w = 0; w < def.pool[kk]; w++) pool.push(kk);
    var sx = 680, ci = 0, nextPod = 900;
    while (sx < def.len - 340) {
      if (Math.abs(sx - midX) < 330) { sx = midX + 340; continue; }
      if (sx >= nextPod) { spawns.push({ x: sx, type: 'pod', cap: def.caps[ci++ % def.caps.length], y: R(0.3, 0.7) }); nextPod += R(780, 900); sx += R(def.space[0] * 0.7, def.space[1] * 0.7); continue; }
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
      bulletV: d(lv, 120, 20, 225), fireMul: d(lv, 0.95, -0.12, 0.38), aim: d(lv, 0.2, 0.1, 0.7),
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
      fire: { held: false, heldT: 0, charge: 0, cd: 0, flash: 0 },
      drone: { state: 'front', x: 0, y: 0, vx: 0, kind: null, lvl: 0, glow: 0, spin: 0, homeSX: 0 },
      optics: [], shots: [], bullets: [], enemies: [], caps: [], boss: null, guard: null, guardDone: false, laser: null,
      kills: 0, deaths: 0, absorbed: 0
    };
    var dir = { x: 0, y: 0 }, fireHeld = false;
    function emit(t, d) { onEvent(t, d || {}); }
    function rr(a, b) { return a + (b - a) * rng(); }
    function addScore(n) {
      S.score += n;
      while (S.extra < EXTRA_LIFE.length && S.score >= EXTRA_LIFE[S.extra]) { S.extra++; S.lives++; emit('life', { lives: S.lives }); }
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
      S.shots = []; S.bullets = []; S.enemies = []; S.caps = []; S.laser = null;
      S.boss = null; S.guard = null;
      S.spawnIdx = 0;
      while (S.spawnIdx < L.spawns.length && L.spawns[S.spawnIdx].x < S.cx + 120) S.spawnIdx++;
      if (S.guardDone) for (var i = S.spawnIdx; i < L.spawns.length; i++) if (L.spawns[i].type === 'guard') L.spawns[i].done = true;
      var sh = S.ship; sh.x = S.cx + 90; sh.y = safeY(sh.x); sh.dead = false; sh.grace = fresh ? 0 : 2.0; sh.vx = sh.vy = 0;
      var D = S.drone; D.state = 'front'; D.x = sh.x + DRONE_OFF; D.y = sh.y;
      S.fire.held = false; S.fire.heldT = 0; S.fire.charge = 0; S.fire.cd = 0;
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
        case 'pod': enemy('pod', X, yIn(sp.y), { vx: -34, cap: sp.cap }); break;
        case 'guard':
          if (sp.done) break;
          S.guard = enemy('guard', X + 30, MID, { hp: P.guardHp, max: P.guardHp, fireT: 1.6, ring: 0 });
          S.hold = true; emit('guard', { x: X });
          break;
      }
    }
    function eBullet(x, y, vx, vy, kind) { S.bullets.push({ x: x, y: y, vx: vx, vy: vy, r: kind === 'big' ? 5 : 3, kind: kind || 'spark', t: 0 }); }
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
        case 'pod': e.fireT = 99; return;
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
      emit('kill', { x: e.x, y: e.y, type: e.type, pts: EN[e.type].pts, by: by });
      if (e.type === 'pod') { S.caps.push({ x: e.x, y: e.y, type: e.cap, t: 0 }); emit('capDrop', { x: e.x, y: e.y, type: e.cap }); }
      if (e.type === 'mine' && S.prm.mineBurst) for (var k = 0; k < 6; k++) { var a = k / 6 * TAU + 0.26; eBullet(e.x, e.y, Math.cos(a) * 90, Math.sin(a) * 90); }
      if (e.type === 'guard') {
        S.guard = null; S.hold = false; S.guardDone = true;
        S.caps.push({ x: e.x, y: e.y, type: CAPS[(S.level + 2) % 4], t: 0 });
        S.bullets = [];
        emit('guardDie', { x: e.x, y: e.y });
      }
    }
    function damage(e, dmg, by) {
      if (!e.alive) return;
      e.hp -= dmg; e.flash = 0.12;
      if (e.hp <= 0) killEnemy(e, by); else if (by !== 'drone') emit('hit', { x: e.x, y: e.y, type: e.type });
    }
    function updateEnemies(dt) {
      var P = S.prm, sh = S.ship;
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
          case 'pod': e.x += e.vx * dt; e.y += Math.sin(e.t * 1.7) * 12 * dt; break;
          case 'guard': {
            var tx = S.cx + W - 110; e.x += Math.max(-90, Math.min(90, (tx - e.x) * 2)) * dt + SCROLL * 0 * dt;
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
      var sh = S.ship; if (sh.dead || S.over || S.phase !== 'play') return;
      sh.dead = true; S.lives--; S.deaths++; S.phase = 'dead'; S.phaseT = 1.6;
      S.optics = []; var D = S.drone; if (D.lvl > 0 && --D.lvl === 0) D.kind = null;   // гибель: оптики теряются, луч дрона слабеет
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

    // ---------- Огонь: залп по нажатию, заряд удержанием, луч по отпусканию ----------
    function shot(x, y, vx, vy, kind, dmg, extra) {
      var s = { x: x, y: y, vx: vx, vy: vy, kind: kind, dmg: dmg, t: 0, life: 2, r: 3 };
      for (var k in extra) s[k] = extra[k];
      S.shots.push(s); return s;
    }
    function volley() {
      var sh = S.ship, F = S.fire; if (sh.dead || F.cd > 0) return false;
      var mine = 0; for (var i = 0; i < S.shots.length; i++) if (S.shots[i].kind === 'shot') mine++;
      if (mine >= SHOT_MAX) return false;
      F.cd = VOLLEY_CD; F.flash = 0.06;
      shot(sh.x + 14, sh.y, SHOT_V, 0, 'shot', 1);
      S.optics.forEach(function (o) { shot(o.x + 6, o.y, SHOT_V, 0, 'opt', 1, { r: 2 }); });
      droneFire();
      emit('shoot', { x: sh.x, y: sh.y });
      return true;
    }
    function droneFire() {
      var D = S.drone, x = D.x, y = D.y, k = D.kind, L = D.lvl, dmg = L >= 2 ? 2 : 1, i;
      var cap = 0; for (i = 0; i < S.shots.length; i++) if (S.shots[i].from === 'drone') cap++;
      if (cap > 30) return;
      if (D.state !== 'front' && D.state !== 'back') { shot(x + 12, y, SHOT_V * 0.9, 0, 'dshot', 1, { from: 'drone' }); return; }
      if (!k) return;
      var sd = D.state === 'front' ? 1 : -1;
      if (k === 'R') {
        var angs = L >= 2 ? [0, -0.42, 0.42, -0.2, 0.2] : [0, -0.45, 0.45];
        angs.forEach(function (a) { shot(x + sd * 10, y, Math.cos(a) * 480 * sd, Math.sin(a) * 480, 'ric', dmg, { from: 'drone', bounces: 2, life: 1.2, dir: sd }); });
      } else if (k === 'S') {
        [-1, 1].forEach(function (v) { shot(x, y + v * 6, 110 * sd, v * 330, 'crawl', dmg, { from: 'drone', mode: 'seek', vside: v, life: 1.5, dir: sd }); });
        if (L >= 2) shot(x + sd * 10, y, 520 * sd, 0, 'dshot', 1, { from: 'drone' });
      } else if (k === 'V') {
        var n = L >= 2 ? 7 : 5, spread = L >= 2 ? 0.6 : 0.44;
        for (i = 0; i < n; i++) { var a2 = -spread + 2 * spread * i / (n - 1); shot(x + sd * 10, y, Math.cos(a2) * 470 * sd, Math.sin(a2) * 470, 'fan', dmg, { from: 'drone', life: L >= 2 ? 0.55 : 0.45 }); }
      }
    }
    function chargeBeam(c) {
      var sh = S.ship, dmg = Math.round(3 + 9 * c), h = 6 + 18 * c;
      shot(sh.x + 16, sh.y, BEAM_V, 0, 'beam', dmg, { h: h, r: h / 2, pierce: dmg, hitIds: [], c: c });
      emit('beam', { x: sh.x, y: sh.y, c: c, dmg: dmg });
    }
    function updateFire(dt) {
      var F = S.fire;
      if (F.cd > 0) F.cd -= dt; if (F.flash > 0) F.flash -= dt;
      if (S.ship.dead || (S.phase !== 'play' && S.phase !== 'intro')) { F.held = false; F.charge = 0; F.heldT = 0; return; }
      if (fireHeld && !F.held) { F.held = true; F.heldT = 0; F.charge = 0; volley(); }
      else if (fireHeld && F.held) {
        F.heldT += dt;
        if (F.heldT > CHARGE_DELAY) { var was = F.charge; F.charge = Math.min(1, (F.heldT - CHARGE_DELAY) / CHARGE_TIME); if (was < 1 && F.charge >= 1) emit('chargeFull', {}); }
      } else if (!fireHeld && F.held) {
        F.held = false;
        if (F.charge >= CHARGE_MIN) chargeBeam(F.charge);
        F.charge = 0; F.heldT = 0;
      }
    }

    // ---------- Дрон «Наковальня» ----------
    function droneToggle() {
      var D = S.drone, sh = S.ship; if (sh.dead || S.over) return false;
      if (D.state === 'front' || D.state === 'back') {
        D.vx = (D.state === 'front' ? 1 : -1) * DRONE_LAUNCH_V; D.state = 'launch'; emit('droneLaunch', { dir: Math.sign(D.vx) });
      } else if (D.state === 'free' || D.state === 'launch') { D.state = 'return'; emit('droneRecall', {}); }
      return true;
    }
    function attach(side) { var D = S.drone; D.state = side; D.vx = 0; emit('droneAttach', { side: side }); }
    function updateDrone(dt) {
      var D = S.drone, sh = S.ship, scroll = S.hold || S.cx >= S.lv.len ? 0 : SCROLL;
      D.spin += dt * 3; if (D.glow > 0) D.glow -= dt;
      if (D.state === 'front' || D.state === 'back') { D.x = sh.x + (D.state === 'front' ? DRONE_OFF : -DRONE_OFF); D.y = sh.y; }
      else if (D.state === 'launch') {
        D.x += (D.vx + scroll) * dt; D.y += Math.max(-DRONE_FOLLOW_V, Math.min(DRONE_FOLLOW_V, (sh.y - D.y) * 2)) * dt * 0.5;
        var sx = D.x - S.cx;
        if ((D.vx > 0 && sx >= W - 70) || (D.vx < 0 && sx <= 40)) { D.state = 'free'; D.homeSX = Math.max(40, Math.min(W - 70, sx)); D.vx = 0; }
      } else if (D.state === 'free') {
        D.x += scroll * dt; D.x = S.cx + D.homeSX;
        D.y += Math.max(-DRONE_FOLLOW_V, Math.min(DRONE_FOLLOW_V, (sh.y - D.y) * 3)) * dt;
      } else if (D.state === 'return') {
        var dx = sh.x - D.x, dy = sh.y - D.y, d = Math.hypot(dx, dy) || 1;
        D.x += dx / d * DRONE_RETURN_V * dt + scroll * dt; D.y += dy / d * DRONE_RETURN_V * dt;
      }
      // стыковка: подлетел к кораблю — к носу или к корме, смотря откуда
      if (!sh.dead && (D.state === 'free' || D.state === 'return') && Math.hypot(D.x - sh.x, D.y - sh.y) < DRONE_OFF + 6) attach(D.x >= sh.x ? 'front' : 'back');
      // глотает вражеские пули
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i];
        if (Math.hypot(b.x - D.x, b.y - D.y) < DRONE_R + b.r) { S.bullets.splice(i, 1); S.absorbed++; D.glow = 0.15; emit('absorb', { x: b.x, y: b.y, by: 'drone' }); }
      }
      // жжёт касанием (на вылете — вдвое сильнее)
      var dps = DRONE_DPS * (D.state === 'launch' || D.state === 'return' ? 2 : 1);
      for (var j = 0; j < S.enemies.length; j++) {
        var e = S.enemies[j]; if (!e.alive) continue;
        if (Math.hypot(e.x - D.x, e.y - D.y) < DRONE_R + e.r) { damage(e, dps * dt, 'drone'); if (!e.burnT || e.burnT <= 0) { e.burnT = 0.25; emit('burn', { x: e.x, y: e.y }); } }
        if (e.burnT > 0) e.burnT -= dt;
      }
      var B = S.boss;
      if (B && B.alive && B.open && Math.hypot(B.weak.x - D.x, B.weak.y - D.y) < DRONE_R + B.weak.r) bossDamage(dps * dt, 'drone');
    }
    function updateOptics(dt) {
      var sh = S.ship;
      for (var i = 0; i < S.optics.length; i++) {
        var o = S.optics[i], ty = sh.y + (i === 0 ? -OPTIC_DY : OPTIC_DY), tx = sh.x - 4;
        o.x += (tx - o.x) * Math.min(1, dt * 12); o.y += (ty - o.y) * Math.min(1, dt * 12); o.t += dt;
        for (var j = S.bullets.length - 1; j >= 0; j--) {
          var b = S.bullets[j];
          if (Math.hypot(b.x - o.x, b.y - o.y) < OPTIC_R + b.r) { S.bullets.splice(j, 1); S.absorbed++; emit('absorb', { x: b.x, y: b.y, by: 'optic' }); }
        }
      }
    }

    // ---------- Снаряды игрока ----------
    function hitTest(s) {   // → true: снаряд поглощён
      var i, rad = s.r || 3;
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive) continue;
        if (Math.abs(e.x - s.x) < e.r + (s.kind === 'beam' ? 8 : rad) && Math.abs(e.y - s.y) < e.r + rad) {
          if (s.kind === 'beam') {
            if (s.hitIds.indexOf(e) >= 0) continue;
            s.hitIds.push(e); var hp = e.hp; damage(e, s.pierce, 'beam'); s.pierce -= Math.max(1, Math.ceil(hp));
            if (s.pierce <= 0) return true; continue;
          }
          damage(e, s.dmg, s.kind); return true;
        }
      }
      var B = S.boss;
      if (B && B.alive) {
        if (B.open && Math.hypot(B.weak.x - s.x, B.weak.y - s.y) < B.weak.r + rad) { bossDamage(s.kind === 'beam' ? s.pierce : s.dmg, s.kind); return true; }
        for (i = 0; i < B.armor.length; i++) { var a = B.armor[i]; if (Math.hypot(a.x - s.x, a.y - s.y) < a.r + rad) { if (a.part) partDamage(a.part, s.kind === 'beam' ? s.pierce : s.dmg); else emit('clang', { x: s.x, y: s.y }); return true; } }
      }
      return false;
    }
    function updateShots(dt) {
      for (var i = S.shots.length - 1; i >= 0; i--) {
        var s = S.shots[i], dead = false;
        s.t += dt; if (s.t > s.life) { S.shots.splice(i, 1); continue; }
        var dist = Math.hypot(s.vx, s.vy) * dt, n = Math.max(1, Math.ceil(dist / 8));
        for (var k = 0; k < n && !dead; k++) {
          var h = dt / n;
          if (s.kind === 'crawl' && s.mode === 'crawl') {
            s.x += s.dir * 330 * h;
            var ny = s.vside < 0 ? ceilY(s.x) + 5 : floorY(s.x) - 5;
            if (Math.abs(ny - s.y) > 14 || mechHit(s.x, ny, 1, 1)) { dead = true; break; }
            s.y = ny;
          } else {
            var nx = s.x + s.vx * h, ny2 = s.y + s.vy * h;
            if (solid(nx, ny2)) {
              if (s.kind === 'ric' && s.bounces > 0 && !mechHit(nx, ny2, 0.5, 0.5)) {
                s.bounces--; s.vy = -s.vy; ny2 = s.y; if (solid(nx, ny2)) nx = s.x;   // крутой склон — отскок на месте
                if (solid(nx, ny2)) { dead = true; break; }
                emit('ricochet', { x: nx, y: s.y });
              } else if (s.kind === 'crawl' && s.mode === 'seek' && !mechHit(nx, ny2, 0.5, 0.5)) {
                s.mode = 'crawl'; s.y = s.vside < 0 ? ceilY(s.x) + 5 : floorY(s.x) - 5; continue;
              } else { dead = true; emit('wallHit', { x: nx, y: ny2, kind: s.kind }); break; }
            }
            s.x = nx; s.y = ny2;
          }
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
    function updateCaps(dt) {
      var sh = S.ship, D = S.drone;
      for (var i = S.caps.length - 1; i >= 0; i--) {
        var c = S.caps[i]; c.t += dt; c.x += (S.hold || S.cx >= S.lv.len ? -20 : SCROLL - 24) * dt; c.y += Math.sin(c.t * 3) * 10 * dt;
        if (c.x - S.cx < -20) { S.caps.splice(i, 1); continue; }
        var byShip = !sh.dead && Math.hypot(c.x - sh.x, c.y - sh.y) < 18, byDrone = (D.state === 'front' || D.state === 'back') && Math.hypot(c.x - D.x, c.y - D.y) < 18;
        if (byShip || byDrone) { S.caps.splice(i, 1); pickup(c.type); }
      }
    }
    function pickup(type) {
      var D = S.drone;
      if (type === 'O') {
        if (S.optics.length < 2) S.optics.push({ x: S.ship.x, y: S.ship.y, t: 0 }); else addScore(500);
      } else if (D.kind === type) D.lvl = Math.min(2, D.lvl + 1);
      else { D.kind = type; D.lvl = Math.max(1, D.lvl); }
      addScore(100); D.glow = 0.5;
      emit('pickup', { type: type, lvl: D.lvl, optics: S.optics.length });
    }

    // ---------- Боссы ----------
    var BOSS_HP = { crucible: 36, hammer: 42, worm: 30, hive: 48, mirror: 50, heart: 72 };
    function spawnBoss() {
      var L = S.lv, type = L.def.boss, hp = Math.round(BOSS_HP[type] * S.prm.bossHp);
      var B = { type: type, x: L.len + W - 130, y: MID, bx: L.len + W - 130, hp: hp, max: hp, t: 0, fireT: 2.0, alive: true, open: false, flash: 0,
        weak: { x: 0, y: 0, r: 13 }, armor: [], parts: [], segs: [], phase2: false, enter: 1.6 };
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
        case 'worm': {   // Многоножка: петля «восьмёркой», уязвим только хвост
          var cx = S.cx + W - 230, path = function (tt) { return { x: cx + 160 * Math.cos(tt * 0.7), y: MID + 105 * Math.sin(tt * 1.4) }; };
          if (B.enter > 0) cx += B.enter * 220;
          for (var i = 0; i < B.segs.length; i++) { var q = path(t - i * 0.2); B.segs[i].x = q.x; B.segs[i].y = q.y; }
          B.x = B.segs[0].x; B.y = B.segs[0].y; B.open = true;
          for (i = 0; i < B.segs.length - 1; i++) B.armor.push({ x: B.segs[i].x, y: B.segs[i].y, r: i === 0 ? 18 : 15 });
          var tl = B.segs[B.segs.length - 1]; B.weak = { x: tl.x, y: tl.y, r: 13 };
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
      if (by !== 'drone') { addScore(20); emit('bossHit', { x: B.weak.x, y: B.weak.y, hp: B.hp }); }
      if (!B.phase2 && B.hp <= B.max / 2) { B.phase2 = true; emit('bossRage', {}); }
      if (B.hp <= 0) {
        B.alive = false; S.kills++; var pts = 5000 + 1000 * S.level; addScore(pts);
        S.bullets = []; S.laser = null; S.enemies.forEach(function (e) { e.alive = false; }); S.enemies = [];
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
      var P = S.prm, v, k, a, rate = S.prm.bossRate * (B.phase2 ? 0.8 : 1);
      var bv = P.bulletV;
      switch (B.type) {
        case 'crucible':
          if (B.open) { for (k = -2; k <= 2; k++) { a = Math.PI + k * 0.24 + Math.atan2(S.ship.y - B.weak.y, -(S.ship.x - B.weak.x)) * -0.0; v = aimAt(B.weak.x, B.weak.y, bv, k * 0.24); eBullet(B.weak.x - 6, B.weak.y, v.vx, v.vy); } B.fireT = 1.0 * rate; }
          else { var vy = (B.vent = !B.vent) ? -58 : 58; v = aimAt(B.x + 12, B.y + vy, bv * 1.05); eBullet(B.x + 12, B.y + vy, v.vx, v.vy, 'big'); B.fireT = 0.85 * rate; }
          break;
        case 'hammer':
          [-0.18, 0, 0.18].forEach(function (o) { var w = aimAt(B.x - 40, B.y + 6, bv, o); eBullet(B.x - 40, B.y + 6, w.vx, w.vy); });
          if (B.phase2) for (k = 0; k < 10; k++) { a = k / 10 * TAU; eBullet(B.x, B.y, Math.cos(a) * bv * 0.7, Math.sin(a) * bv * 0.7); }
          B.fireT = (B.phase2 ? 1.6 : 1.3) * rate; break;
        case 'worm': {
          var hd = B.segs[0]; v = aimAt(hd.x, hd.y, bv * 0.9); eBullet(hd.x, hd.y, v.vx, v.vy, 'big');
          B.fireT = (B.phase2 ? 1.25 : 1.5) * rate; break;
        }
        case 'hive':
          if (B.open) { enemy('moth', B.weak.x - 10, B.weak.y, { y0: B.weak.y + rr(-60, 60), amp: rr(20, 50), ph: rr(0, TAU), vx: -S.prm.mothV - SCROLL * 0, hive: true }); B.fireT = 0.65 * rate; }
          else { [-0.12, 0.12].forEach(function (o) { var w = aimAt(B.x - 30, B.y, bv, o); eBullet(B.x - 30, B.y, w.vx, w.vy); }); B.fireT = 1.2 * rate; }
          break;
        case 'mirror':
          if (B.mode === 'move') { [-0.25, 0, 0.25].forEach(function (o) { var w = aimAt(B.x - 20, B.y, bv, o); eBullet(B.x - 20, B.y, w.vx, w.vy); }); }
          B.fireT = 1.1 * rate; break;
        case 'heart':
          if (B.open) { B.spin = (B.spin || 0) + 0.5; for (k = 0; k < 5; k++) { a = Math.PI + (k - 2) * 0.32 + Math.sin(B.spin) * 0.3; eBullet(B.weak.x, B.weak.y, Math.cos(a) * bv * 0.9, Math.sin(a) * bv * 0.9); } B.fireT = 0.55 * rate; }
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
        if (p.fireT <= 0) { var v = aimAt(p.x, p.y, S.prm.bulletV); eBullet(p.x - 14, p.y, v.vx, v.vy); p.fireT = (B.phase2 ? 1.2 : 1.6) * S.prm.bossRate; }
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
        S.phaseT -= dt; moveShip(dt); updateFire(dt); updateDrone(dt); updateOptics(dt); updateShots(dt);
        if (S.phaseT <= 0) S.phase = 'play';
        return;
      }
      if (S.phase === 'dead') {
        S.phaseT -= dt; updateShots(dt);
        if (S.phaseT <= 0) { resetToCheckpoint(false); S.phase = 'play'; emit('respawn', { cp: S.cp }); }
        return;
      }
      if (S.phase === 'clear') {
        S.phaseT -= dt; moveShip(dt); updateDrone(dt); updateOptics(dt); updateShots(dt);
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
      updateFire(dt);
      updateDrone(dt);
      updateOptics(dt);
      updateShots(dt);
      if (S.phase !== 'play') return;
      updateEnemies(dt); if (S.phase !== 'play') return;
      updateBoss(dt); if (S.phase !== 'play') return;
      updateBullets(dt); if (S.phase !== 'play') return;
      updateCaps(dt);
      L.mechs.forEach(function (m) { if (Math.abs(m.x - S.cx - W / 2) < W) mechRects(m); });
    }

    var api = {
      start: function () { setupLevel(); return api; },
      update: update,
      setDir: function (x, y) { dir.x = x > 0 ? 1 : x < 0 ? -1 : 0; dir.y = y > 0 ? 1 : y < 0 ? -1 : 0; },
      setFire: function (v) { fireHeld = !!v; },
      tap: function () { fireHeld = true; updateFire(0); fireHeld = false; updateFire(0); },
      drone: droneToggle,
      state: function () { return S; },
      _S: S,
      // для тестов и ботов
      _setupLevel: function (n) { S.level = n; setupLevel(); return S; },
      _ceilY: ceilY, _floorY: floorY, _solid: solid, _terrainHit: terrainHit, _mechRects: mechRects,
      _spawn: spawn, _enemy: enemy, _bullet: eBullet, _pickup: pickup, _spawnBoss: spawnBoss, _layoutBoss: layoutBoss,
      _shipHit: shipHit, _volley: volley, _beam: chargeBeam, _bossDamage: bossDamage
    };
    return api;
  }

  Sp.Game = Game;
  Sp.logic = {
    W: W, H: H, TOP: TOP, MID: MID, COL: COL, SCROLL: SCROLL, SHIP_V: SHIP_V, SHIP_HW: SHIP_HW, SHIP_HH: SHIP_HH, SHIP_TW: SHIP_TW, SHIP_TH: SHIP_TH,
    SHOT_V: SHOT_V, SHOT_MAX: SHOT_MAX, CHARGE_DELAY: CHARGE_DELAY, CHARGE_TIME: CHARGE_TIME, CHARGE_MIN: CHARGE_MIN, BEAM_V: BEAM_V,
    DRONE_R: DRONE_R, DRONE_OFF: DRONE_OFF, DRONE_DPS: DRONE_DPS, OPTIC_R: OPTIC_R, OPTIC_DY: OPTIC_DY, ARENA: ARENA,
    EXTRA_LIFE: EXTRA_LIFE, EN: EN, CAPS: CAPS, LEVELS: LEVELS, params: params, buildLevel: buildLevel, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
