/* ЭСКАДРИЛЬЯ · логика без DOM (детерминирована при заданном rng). ESKADRILYA.Game(opts), ESKADRILYA.logic
   Переделка 2026-11 «Наводка и завеса»: паролёт мастерской «Гефест» (биплан с котлом) идёт над морем, островами и сушей
   против флотилии «Окалины». Главная механика:
   - любой враг стреляет только после НАВОДКИ: от него к самолёту тянется видимая линия (0,5–0,8 с), потом — выстрел;
   - котёл паролёта даёт ДЫМ (удержание кнопки, запас с подзарядкой): клубы вылетают вперёд по курсу, повисают
     перед носом и уплывают назад вместе с миром (завеса «перед собой»; вбок — шире);
     клуб дыма на линии наводки СРЫВАЕТ её (выстрела нет, стрелок «ослеплён»), враг внутри дыма «закопчён» —
     не целится, теряет ход, а сбитый закопчённым даёт очки ×2. Пули, уже выпущенные, дым не гасит — от них уворачиваешься;
   - огонь паролёта — автоматический; в конце перелёта — Летучая кузня (дирижабль-завод) с орудийными гондолами
     и горном; её боковые винты-тяги втягивают и съедают дым — завесу ставь в стороне от винтов. */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA = global.ESKADRILYA || {};

  // ---------- Поле и константы ----------
  var W = 480, H = 640, TOP = 44;
  var PX0 = 22, PX1 = 458, PY0 = 116, PY1 = 604;   // где может летать самолёт (центр)
  var SCROLL = 62, ROW = 16;
  var PLAYER_V = 225, SHOT_V = 680, FIRE_CD = 0.15;
  var PR = 9, HULL = 3, POWER_MAX = 3, MAX_LIVES = 5;
  var GRACE_HIT = 0.6, GRACE_SPAWN = 2.0;
  // дым
  var SMAX = 100, SM_USE = 45, SM_REGEN = 3.5, SM_DELAY = 0.6, PUFF_DT = 0.045, PUFF_R = 24, PUFF_GROW = 0.45, PUFF_LIFE = 2.4, PUFF_MAX = 140, PUFF_V = 250, PUFF_DRAG = 4.5;
  var BLIND_T = 0.8, SOOT_T = 2.4, BROKEN_PTS = 25, BROKEN_CAP = 120;
  // Летучая кузня (босс)
  var BOSS_Y = 150, HULL_RX = 132, HULL_RY = 52, FAN_R = 120, CORE_R = 18;
  var EXTRA_LIFE = [40000];
  var PTS = { bird: 100, swift: 150, blimp: 800, flak: 250, boat: 300, depot: 200, pod: 500 };
  var GHP = { flak: 4, boat: 3, depot: 2 };
  var RADIUS = { bird: 13, swift: 11, flak: 13, depot: 13, pod: 14 };
  var BLIMP = { rx: 36, ry: 16 }, BOAT = { rx: 22, ry: 10 };
  var TAU = Math.PI * 2;

  // 8 перелётов: рельеф (секции по 640 px), длина маршрута, число гондол Летучей кузни
  var LEVELS = [
    { name: 'bay',      len: 3300, terr: ['sea', 'coastR', 'isles', 'sea', 'coastL', 'isles'],     pods: 3 },
    { name: 'shore',    len: 3800, terr: ['coastL', 'coastR', 'isles', 'strait', 'isles', 'coastL'], pods: 3 },
    { name: 'ridge',    len: 4100, terr: ['strait', 'land', 'land', 'coastR', 'isles', 'strait'],   pods: 4 },
    { name: 'bridge',   len: 4400, terr: ['isles', 'strait', 'land', 'strait', 'coastL', 'isles'],  pods: 4 },
    { name: 'shoals',   len: 4600, terr: ['isles', 'isles', 'coastR', 'isles', 'sea', 'isles'],     pods: 5 },
    { name: 'archi',    len: 4800, terr: ['coastL', 'isles', 'strait', 'isles', 'coastR', 'isles'], pods: 5 },
    { name: 'waste',    len: 5000, terr: ['land', 'strait', 'isles', 'land', 'strait', 'coastL'],   pods: 6 },
    { name: 'flagship', len: 5200, terr: ['isles', 'strait', 'coastR', 'land', 'isles', 'sea'],     pods: 7 }
  ];
  // Гондолы на корпусе кузни (от центра). twin — веер из трёх снарядов.
  var SLOTS = [
    { dx: -62, dy: 30, kind: 'gun' }, { dx: 62, dy: 30, kind: 'gun' }, { dx: 0, dy: 42, kind: 'twin' },
    { dx: -104, dy: -4, kind: 'gun' }, { dx: 104, dy: -4, kind: 'gun' }, { dx: -40, dy: -32, kind: 'twin' }, { dx: 40, dy: -32, kind: 'twin' }
  ];
  var FANS = [{ dx: -158, dy: 6 }, { dx: 158, dy: 6 }];   // винты-тяги: втягивают дым
  var DEPOT_DROPS = ['smoke', 'patch'];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Параметры перелёта — через хук difficulty(level, base, step, max) движка
  function params(lv, diff) {
    var d = diff || function (l, base, step, max) { var v = base + (l - 1) * step; return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max)); };
    return {
      bulletV: d(lv, 190, 14, 290),
      aimT: d(lv, 0.72, -0.04, 0.45),        // длительность наводки, с
      fireK: d(lv, 0.9, -0.06, 0.5),        // множитель интервалов огня
      airGap: d(lv, 190, -10, 120),         // px прокрутки между налётами
      groundGap: d(lv, 150, -7, 100),
      birdV: d(lv, 105, 8, 165), swiftV: d(lv, 260, 14, 360),
      birdShoot: d(lv, 0.75, 0.05, 1),       // доля птиц, что целятся на подлёте
      blimpHp: 14 + lv * 3, podHp: 14 + lv * 3, coreHp: 22 + lv * 4,
      podFire: d(lv, 1.7, -0.09, 1.0), flakFire: d(lv, 1.6, -0.09, 0.95), boatFire: d(lv, 2.0, -0.12, 1.2),
      flakN: lv >= 6 ? 3 : lv >= 3 ? 2 : 1, birdN: lv >= 6 ? 3 : lv >= 3 ? 2 : 1, boatN: lv >= 4 ? 2 : 1, twinN: lv >= 5 ? 5 : 3,
      bossAir: lv >= 2 ? d(lv, 7, -0.5, 3.5) : 0
    };
  }

  // ---------- Рельеф перелёта: ширина берега слева/справа по рядам + острова ----------
  function makeTerrain(lv) {
    var Lv = LEVELS[(lv - 1) % LEVELS.length], rng = mulberry32(lv * 7919 + 13);
    var total = Lv.len + 1700, n = Math.ceil(total / ROW) + 2, Lw = [], Rw = [], isles = [];
    var tl = [], tr = [];
    function sect(wy) {
      var k = Math.floor((wy - H) / 640);
      if (wy < H || wy > Lv.len - 200) return 'sea';
      return Lv.terr[((k % Lv.terr.length) + Lv.terr.length) % Lv.terr.length];
    }
    var ph1 = rng() * TAU, ph2 = rng() * TAU;
    for (var i = 0; i < n; i++) {
      var wy = i * ROW, s = sect(wy), a = 0, b = 0;
      if (s === 'coastL') a = 150; else if (s === 'coastR') b = 150;
      else if (s === 'strait') { a = 112; b = 112; }
      else if (s === 'land') { if (Math.floor((wy - H) / 640) % 2) b = 250; else a = 250; }   // большая суша с одной стороны (без «реки-коридора» посередине)
      tl.push(a); tr.push(b);
    }
    for (i = 0; i < n; i++) {
      var sa = 0, sb = 0, c = 0;
      for (var j = i - 10; j <= i + 10; j++) { var q = clamp(j, 0, n - 1); sa += tl[q]; sb += tr[q]; c++; }
      sa /= c; sb /= c;
      var wig1 = Math.sin(i * 0.21 + ph1) * 14 + Math.sin(i * 0.53 + ph2) * 6, wig2 = Math.sin(i * 0.19 + ph2) * 14 + Math.sin(i * 0.47 + ph1) * 6;
      Lw.push(sa > 4 ? Math.max(0, sa + wig1 * Math.min(1, sa / 60)) : 0);
      Rw.push(sb > 4 ? Math.max(0, sb + wig2 * Math.min(1, sb / 60)) : 0);
    }
    for (var k = 0; k * 640 + H < Lv.len - 200; k++) {
      var y0 = H + k * 640;
      if (sect(y0 + 320) !== 'isles') continue;
      var cnt = 2 + (rng() < 0.4 ? 1 : 0);
      for (var m = 0; m < cnt; m++) {
        for (var tries = 0; tries < 12; tries++) {
          var is = { x: 80 + rng() * 320, wy: y0 + 90 + rng() * 460, rx: 42 + rng() * 34, ry: 58 + rng() * 50, ph: rng() * TAU };
          var okk = isles.every(function (o) { return Math.hypot((o.x - is.x) / (o.rx + is.rx + 30), (o.wy - is.wy) / (o.ry + is.ry + 30)) > 1; });
          if (okk) { isles.push(is); break; }
        }
      }
    }
    return { Lw: Lw, Rw: Rw, isles: isles, len: Lv.len };
  }
  function rowAt(T, wy) { return clamp(Math.round(wy / ROW), 0, T.Lw.length - 1); }
  function inIsle(o, x, wy) {
    var dx = (x - o.x) / o.rx, dy = (wy - o.wy) / o.ry, a = Math.atan2(dy, dx);
    var r = 1 + 0.12 * Math.sin(a * 3 + o.ph) + 0.06 * Math.sin(a * 5 - o.ph);
    return dx * dx + dy * dy < r * r;
  }
  function isLand(T, x, wy) {
    var i = rowAt(T, wy);
    if (x < T.Lw[i] || x > W - T.Rw[i]) return true;
    for (var k = 0; k < T.isles.length; k++) { var o = T.isles[k]; if (Math.abs(wy - o.wy) < o.ry * 1.25 && inIsle(o, x, wy)) return true; }
    return false;
  }
  function landAround(T, x, wy, r) { return isLand(T, x, wy) && isLand(T, x - r, wy) && isLand(T, x + r, wy) && isLand(T, x, wy - r) && isLand(T, x, wy + r); }
  function seaAround(T, x, wy, r) { for (var a = 0; a < 8; a++) if (isLand(T, x + Math.cos(a * TAU / 8) * r, wy + Math.sin(a * TAU / 8) * r)) return false; return !isLand(T, x, wy); }

  // ---------- Сценарий: налёты (по прокрутке) и наземные/морские цели ----------
  function makeScript(lv, T, prm) {
    var rng = mulberry32(lv * 104729 + 7), air = [], ground = [], Lv = LEVELS[(lv - 1) % LEVELS.length];
    var pool = ['sine', 'cross', 'u', 'sine'];
    if (lv >= 2) pool.push('swifts');
    if (lv >= 4) pool.push('swifts', 'u');
    var nextBlimp = lv === 1 ? 2100 : 1100;
    // 1-й перелёт — обучение: сначала птицы без огня (полёт и автоогонь), затем одиночные наводки
    var at0 = lv === 1 ? 420 : 260;
    for (var at = at0; at < Lv.len - 150; at += prm.airGap * (0.85 + rng() * 0.3)) {
      var pat;
      if (at >= nextBlimp) { pat = 'blimp'; nextBlimp += lv === 1 ? 99999 : 1500 - lv * 60; }
      else pat = pool[Math.floor(rng() * pool.length)];
      air.push({ at: at, pat: pat, x: 100 + rng() * 280, side: rng() < 0.5 ? -1 : 1, seed: Math.floor(rng() * 1e6), calm: lv === 1 && at < 900 });
    }
    var lastDepot = H;
    for (var wy = H + (lv === 1 ? 900 : 160); wy < Lv.len + H - 260; wy += prm.groundGap * (0.8 + rng() * 0.4)) {
      var placed = false;
      for (var tries = 0; tries < 8 && !placed; tries++) {
        var x = 40 + rng() * 400, y = wy + rng() * 90;
        if (landAround(T, x, y, 18)) {
          placed = true;
          if (rng() < 0.3) break;
          var depot = y - lastDepot > 1000 - lv * 40;
          if (depot) lastDepot = y;
          ground.push({ type: depot ? 'depot' : 'flak', x: x, wy: y });
        }
      }
      for (tries = 0; tries < 6 && !placed; tries++) {
        x = 40 + rng() * 400; y = wy + rng() * 90;
        if (seaAround(T, x, y, 36)) { placed = true; if (rng() < 0.6) ground.push({ type: 'boat', x: x, wy: y, dir: rng() < 0.5 ? -1 : 1 }); }
      }
    }
    ground.sort(function (a, b) { return a.wy - b.wy; });
    return { air: air, ground: ground };
  }

  // расстояние от точки до отрезка
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    var qx = ax + dx * t - px, qy = ay + dy * t - py; return Math.sqrt(qx * qx + qy * qy);
  }
  function puffR(p) {   // действующий радиус клуба: растёт, к концу жизни тает
    var g = Math.min(1, 0.35 + 0.65 * p.t / PUFF_GROW), f = p.life - p.t < 0.6 ? Math.max(0, (p.life - p.t) / 0.6) : 1;
    return PUFF_R * g * f * (p.k || 1);
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {};
    var maxLevel = opts.maxLevel || LEVELS.length;
    var S = {
      level: opts.level || 1, maxLevel: maxLevel, lives: opts.lives == null ? 3 : opts.lives, score: 0,
      phase: 'play', phaseT: 0, time: 0, over: false, won: false, banner: 0, extra: 0, clearBonus: 0,
      name: '', prm: null, terrain: null, script: null, ai: 0, gi: 0, dist: 0, scroll: SCROLL, stage: 'route',
      player: { x: W / 2, y: 540, hull: HULL, dead: false, grace: 0, cool: 0, power: 1, bank: 0,
        smoke: SMAX, smoking: false, smokeIdle: 0, puffT: 0 },
      shots: [], bullets: [], air: [], ground: [], pickups: [], pending: [], puffs: [], aims: [], boss: null,
      kills: 0, broken: 0, sooted: 0, depotI: 0, bossAirT: 0, lostHere: 0, brokenHere: 0,
      tip: null, tipT: 0, tut: 0, moved: 0, started: false
    };
    var dirX = 0, dirY = 0, fire = true, smokeOn = false;
    function emit(t, d) { onEvent(t, d || {}); }
    function rr(a, b) { return a + (b - a) * rng(); }
    function addScore(n) {
      S.score += n;
      while (S.extra < EXTRA_LIFE.length && S.score >= EXTRA_LIFE[S.extra]) { S.extra++; if (S.lives < MAX_LIVES) S.lives++; emit('life', { lives: S.lives }); }
    }
    function sy(wy) { return H - (wy - S.dist); }
    function wyOf(y) { return S.dist + H - y; }

    // ---------- Перелёт ----------
    function setupLevel() {
      var Lv = LEVELS[(S.level - 1) % LEVELS.length];
      S.name = Lv.name; S.prm = params(S.level, opts.difficulty);
      S.terrain = makeTerrain(S.level); S.script = makeScript(S.level, S.terrain, S.prm);
      S.ai = 0; S.gi = 0; S.dist = 0; S.scroll = SCROLL; S.stage = 'route';
      S.shots = []; S.bullets = []; S.air = []; S.ground = []; S.pickups = []; S.pending = []; S.puffs = []; S.aims = []; S.boss = null;
      S.phase = 'play'; S.phaseT = 0; S.banner = 2.2; S.bossAirT = 3; S.lostHere = 0; S.brokenHere = 0;
      var P = S.player;
      P.x = W / 2; P.y = 540; P.hull = HULL; P.dead = false; P.grace = 1.0; P.smoke = SMAX; P.smoking = false;
      if (S.level === 1 && !opts.noTut) { S.tut = 1; setTip('tut1', 99); } else { S.tut = 0; S.tip = null; }
      S.started = true;
      emit('level', { level: S.level, name: S.name });
    }
    function setTip(k, t) { S.tip = k; S.tipT = t; }
    function tutStep(ev) {   // обучение 1-го перелёта: подсказка держится, пока игрок не сделал шаг
      if (!S.tut) return;
      if (S.tut === 1 && ev === 'moved') { S.tut = 2; setTip(null, 0); }
      else if (S.tut === 2 && ev === 'aim') { S.tut = 3; setTip('tut2', 3.2); }
      else if (S.tut === 3 && S.tipT <= 0 && ev === 'tick') { S.tut = 4; setTip('tut3', 99); }
      else if (S.tut === 4 && (ev === 'aimBroken' || ev === 'sooted')) { S.tut = 5; setTip('tut4', 4.5); }
      else if (S.tut === 5 && S.tipT <= 0 && ev === 'tick') { S.tut = 6; setTip(null, 0); }
      else if (S.tut >= 2 && S.tut <= 6 && ev === 'boss') { S.tut = 7; setTip('tut5', 6); }
    }

    // ---------- Спавн ----------
    function shooter(o) { o.aimT = 0; o.aimMax = 0; o.blindT = 0; o.sootT = 0; o.wasIn = false; return o; }
    function spawnAir(type, x, y, o) {
      o = o || {};
      var e = shooter({ type: type, x: x, y: y, x0: x, y0: y, t: 0, hp: 1, max: 1, vx: o.vx || 0, vy: o.vy || 0, pat: o.pat || 'line',
        ph: o.ph || 0, amp: o.amp || 0, fired: false, fireY: o.fireY || rr(100, 240), fireX: o.fireX, fireT: o.fireT || 0, calm: !!o.calm,
        turnY: o.turnY || 0, turned: false, flash: 0, alive: true, mode: 'in', lockX: 0, lockY: 0,
        drop: o.drop || (type === 'blimp' ? (S.level % 2 ? 'power' : 'patch') : null) });
      if (type === 'blimp') { e.hp = e.max = S.prm.blimpHp; e.fireT = 1.6; }
      if (type === 'swift') { e.vy = 70; e.vx = 0; e.mode = 'in'; e.stopY = o.stopY || rr(80, 170); }
      S.air.push(e); return e;
    }
    function queue(dt, fn) { S.pending.push({ t: S.time + dt, fn: fn }); }
    function runEvent(ev) {
      var p = S.prm, r = mulberry32(ev.seed), i, calm = !!ev.calm;
      if (ev.pat === 'sine') {
        var amp = 40 + r() * 50, x0 = clamp(ev.x, 70 + amp, W - 70 - amp), ph = r() * TAU;
        for (i = 0; i < 5; i++) (function (k) { queue(k * 0.3, function () { spawnAir('bird', x0, -20, { pat: 'sine', vy: p.birdV, amp: amp, ph: ph, fireY: 90 + r() * 150, calm: calm }); }); })(i);
      } else if (ev.pat === 'cross') {
        var y0 = 130 + r() * 110, s = ev.side;
        for (i = 0; i < 4; i++) (function (k) { queue(k * 0.42, function () { spawnAir('bird', s < 0 ? -24 : W + 24, y0, { pat: 'cross', vx: -s * (p.birdV + 40), fireX: 90 + r() * 300, calm: calm }); }); })(i);
      } else if (ev.pat === 'u') {
        for (i = 0; i < 4; i++) (function (k) { var xx = clamp(ev.x + (k - 1.5) * 52, 40, W - 40); queue(k * 0.22, function () { spawnAir('bird', xx, -20, { pat: 'u', vy: p.birdV * 1.25, turnY: 210 + r() * 90, calm: calm }); }); })(i);
      } else if (ev.pat === 'swifts') {
        for (i = 0; i < 3; i++) (function (k) { var xx = clamp(ev.x + (k - 1) * 70, 40, W - 40); queue(k * 0.35, function () { spawnAir('swift', xx, -20); }); })(i);
      } else if (ev.pat === 'blimp') {
        spawnAir('blimp', clamp(ev.x, 90, W - 90), -30, { vy: 24 });
      }
      emit('raid', { pat: ev.pat });
    }
    function activateGround(o) {
      var e = shooter({ type: o.type, x: o.x, wy: o.wy, hp: GHP[o.type], max: GHP[o.type], fireT: rr(0.3, 1.0),
        vx: o.type === 'boat' ? (o.dir || 1) * 34 : 0, alive: true, flash: 0, t: 0 });
      S.ground.push(e); return e;
    }
    function spawnBoss() {
      var Lv = LEVELS[(S.level - 1) % LEVELS.length], ps = [];
      for (var i = 0; i < Lv.pods; i++) {
        var s = SLOTS[i];
        ps.push(shooter({ dx: s.dx, dy: s.dy, kind: s.kind, hp: S.prm.podHp + (s.kind === 'twin' ? 4 : 0), max: 0,
          fireT: 1.0 + i * 0.5 + rr(0, 0.8), alive: true, flash: 0, ang: Math.PI / 2 }));
      }
      ps.forEach(function (t) { t.max = t.hp; });
      S.boss = { x: W / 2, y: -HULL_RY - 70, anchored: false, t: 0, pods: ps, fans: FANS.map(function (f) { return { dx: f.dx, dy: f.dy, spin: 0 }; }),
        core: shooter({ hp: S.prm.coreHp, max: S.prm.coreHp, open: false, fireT: 2.0, flash: 0 }),
        falling: false, fallT: 0, alive: true, total: ps.length, fireK: Math.pow(ps.length / 3, 0.7) };
      S.stage = 'boss';
      emit('bossArrive', { level: S.level }); tutStep('boss');
    }
    function drop(kind, x, y) { S.pickups.push({ kind: kind, x: clamp(x, 30, W - 30), y: y, t: 0 }); emit('drop', { kind: kind, x: x, y: y }); }

    // ---------- Дым ----------
    function emitPuff(x, y, k, still) {
      if (S.puffs.length >= PUFF_MAX) S.puffs.shift();
      // котёл выбрасывает клуб вперёд по курсу: он тормозит о воздух, повисает перед носом и уплывает назад вместе с миром
      S.puffs.push({ x: x + rr(-3, 3), wy: wyOf(y + rr(-2, 2)), t: 0, life: PUFF_LIFE * rr(0.92, 1.08), k: k || 1, vx: rr(-6, 6) + dirX * 30, vw: still ? 0 : PUFF_V * rr(0.85, 1.1) });
      return S.puffs[S.puffs.length - 1];
    }
    function updatePuffs(dt) {
      var B = S.boss;
      for (var i = S.puffs.length - 1; i >= 0; i--) {
        var p = S.puffs[i]; p.t += dt; p.x += p.vx * dt; p.vx *= Math.exp(-3 * dt);
        if (p.vw) { p.wy += p.vw * dt; p.vw *= Math.exp(-PUFF_DRAG * dt); if (p.vw < 2) p.vw = 0; }
        if (B && B.alive && !B.falling && B.anchored) {   // винты кузни втягивают дым и «съедают» его
          var py = sy(p.wy);
          for (var f = 0; f < B.fans.length; f++) {
            var fx = B.x + B.fans[f].dx, fy = B.y + B.fans[f].dy, dx = fx - p.x, dy = fy - py, d = Math.hypot(dx, dy);
            if (d < FAN_R) {
              var pull = 150 * (1 - d / FAN_R) + 40;
              p.x += dx / (d || 1) * pull * dt; p.wy -= dy / (d || 1) * pull * dt;
              p.t += dt * 2.2 * (1 - d / FAN_R);
              if (d < 22) p.t = p.life;
            }
          }
        }
        if (p.t >= p.life || sy(p.wy) > H + 40) S.puffs.splice(i, 1);
      }
    }
    function inSmoke(x, y, pad) {
      for (var i = 0; i < S.puffs.length; i++) { var p = S.puffs[i], r = puffR(p); if (r < 8) continue; var dx = x - p.x, dy = y - sy(p.wy); if (dx * dx + dy * dy < (r * 0.8 + (pad || 0)) * (r * 0.8 + (pad || 0))) return true; }
      return false;
    }
    function lineBlocked(ax, ay, bx, by) {
      for (var i = 0; i < S.puffs.length; i++) {
        var p = S.puffs[i], r = puffR(p); if (r < 8) continue;
        var px = p.x, py = sy(p.wy);
        if (Math.abs(px - bx) < 1 && Math.abs(py - by) < 1) continue;
        if (segDist(px, py, ax, ay, bx, by) < r * 0.75) return true;
      }
      return false;
    }
    function updateSmoke(dt) {
      var P = S.player;
      P.smoking = smokeOn && !P.dead && P.smoke > 0 && S.phase === 'play';
      if (P.smoking) {
        P.smoke = Math.max(0, P.smoke - SM_USE * dt); P.smokeIdle = 0; P.puffT -= dt;
        while (P.puffT <= 0) { P.puffT += PUFF_DT; emitPuff(P.x, P.y - 16); }
        if (!S.smokedOnce) { S.smokedOnce = true; emit('smokeStart', {}); }
      } else {
        P.puffT = 0; P.smokeIdle += dt;
        if (P.smokeIdle > SM_DELAY) P.smoke = Math.min(SMAX, P.smoke + SM_REGEN * dt);
      }
    }

    // ---------- Наводка ----------
    function canFireAt(x, y) { var P = S.player; return !P.dead && S.phase === 'play' && y > TOP + 8 && y < H - 40 && Math.hypot(P.x - x, P.y - y) > 80; }
    function startAim(e, x, y) {
      if (e.blindT > 0 || e.sootT > 0 || e.aimT > 0 || !canFireAt(x, y)) return false;
      e.aimT = e.aimMax = S.prm.aimT * (e.slow || 1); emit('aim', { x: x, y: y }); tutStep('aim'); return true;
    }
    // каждый кадр для стрелка: копоть, срыв наводки дымом, выстрел по готовности (fn). → true, если выстрелил
    function stepAim(e, x, y, dt, fn) {
      if (e.blindT > 0) e.blindT -= dt;
      if (e.sootT > 0) e.sootT -= dt;
      var inside = inSmoke(x, y);
      if (inside && !e.wasIn) { e.sootT = SOOT_T; S.sooted++; emit('sooted', { x: x, y: y }); tutStep('sooted'); }
      e.wasIn = inside;
      if (e.aimT <= 0) return false;
      var P = S.player;
      if (!canFireAt(x, y) || e.sootT > 0) { e.aimT = 0; return false; }
      if (lineBlocked(x, y, P.x, P.y)) {
        e.aimT = 0; e.blindT = BLIND_T; if (e.fireT != null) e.fireT = Math.min(e.fireT, BLIND_T + 0.25); S.broken++; S.brokenHere++;
        var bp = S.brokenHere <= BROKEN_CAP ? BROKEN_PTS : 0; if (bp) addScore(bp);   // очки за срыв — до BROKEN_CAP за перелёт (без «фарма» у кузни)
        emit('aimBroken', { x: x, y: y, px: P.x, py: P.y, pts: bp }); tutStep('aimBroken'); return false;
      }
      S.aims.push({ x: x, y: y, k: 1 - e.aimT / e.aimMax });
      e.aimT -= dt;
      if (e.aimT <= 0) { e.aimT = 0; fn(); return true; }
      return false;
    }

    // ---------- Огонь противника ----------
    function aimShot(x, y, kind, spread, n, src) {
      var P = S.player; if (P.dead || S.bullets.length > 70) return;
      var a = Math.atan2(P.y - y, P.x - x), sp = S.prm.bulletV * (kind === 'shell' ? 0.85 : 1);
      n = n || 1;
      for (var i = 0; i < n; i++) {
        var o = n > 1 ? (i - (n - 1) / 2) * (spread || 0.25) : 0;
        S.bullets.push({ x: x, y: y, vx: Math.cos(a + o) * sp, vy: Math.sin(a + o) * sp, kind: kind || 'shot', src: src || '' });
      }
      emit('enemyShot', { x: x, y: y, kind: kind || 'shot', n: n });
    }

    // ---------- Игрок ----------
    function hurt(x, y, src) {
      var P = S.player;
      if (P.dead || P.grace > 0 || S.over || S.phase !== 'play') return false;
      P.hull--; P.grace = GRACE_HIT;
      emit('hurt', { x: x, y: y, hull: P.hull, src: src || '' });
      if (P.hull <= 0) lose();
      return true;
    }
    function lose() {
      var P = S.player;
      P.dead = true; S.lives--; S.lostHere++; P.smoking = false;
      S.phase = 'dead'; S.phaseT = 1.8; S.bullets = [];
      P.power = Math.max(1, P.power - 1);
      emit('playerLost', { x: P.x, y: P.y, lives: S.lives });
      if (S.lives <= 0) { S.over = true; S.phase = 'over'; emit('gameover', { score: S.score }); }
    }
    function respawn() {
      var P = S.player;
      P.dead = false; P.hull = HULL; P.x = W / 2; P.y = 560; P.grace = GRACE_SPAWN; P.smoke = SMAX;
      S.phase = 'play'; emit('respawn', {});
    }
    function playerFire() {
      var P = S.player;
      if (P.dead || P.cool > 0 || S.over || S.phase !== 'play' && S.phase !== 'clear') return false;
      P.cool = FIRE_CD;
      var v = -SHOT_V, y = P.y - 14;
      if (P.power === 1) S.shots.push({ x: P.x, y: y, vx: 0, vy: v });
      else S.shots.push({ x: P.x - 4, y: y, vx: 0, vy: v }, { x: P.x + 4, y: y, vx: 0, vy: v });
      if (P.power >= 3) S.shots.push({ x: P.x - 10, y: y + 4, vx: -150, vy: v * 0.97 }, { x: P.x + 10, y: y + 4, vx: 150, vy: v * 0.97 });
      emit('shoot', { x: P.x, power: P.power }); return true;
    }
    function pickup(kind) {
      var P = S.player;
      if (kind === 'smoke') P.smoke = SMAX;
      else if (kind === 'patch') { if (P.hull >= HULL) addScore(300); P.hull = Math.min(HULL, P.hull + 1); }
      else if (kind === 'power') { if (P.power >= POWER_MAX) addScore(500); P.power = Math.min(POWER_MAX, P.power + 1); }
      addScore(100);
      emit('pickup', { kind: kind, x: P.x, y: P.y });
    }

    // ---------- Попадания выстрелов игрока ----------
    function killAir(e) {
      e.alive = false; S.kills++;
      var soot = e.sootT > 0, pts = PTS[e.type] * (soot ? 2 : 1);
      addScore(pts);
      emit('kill', { x: e.x, y: e.y, type: e.type, pts: pts, soot: soot });
      if (e.drop) drop(e.drop, e.x, e.y);
    }
    function hitAir(e, dmg) { e.hp -= dmg; e.flash = 0.12; if (e.hp <= 0) killAir(e); else emit('hitAir', { x: e.x, y: e.y, type: e.type }); }
    function airHitTest(e, x, y, pad) {
      pad = pad || 0;
      if (e.type === 'blimp') { var dx = (x - e.x) / (BLIMP.rx + pad), dy = (y - e.y) / (BLIMP.ry + pad); return dx * dx + dy * dy < 1; }
      var r = RADIUS[e.type] + pad; return (x - e.x) * (x - e.x) + (y - e.y) * (y - e.y) < r * r;
    }
    function groundHitTest(e, x, y) {
      var gy = sy(e.wy);
      if (e.type === 'boat') { var dx = (x - e.x) / BOAT.rx, dy = (y - gy) / BOAT.ry; return dx * dx + dy * dy < 1; }
      var r = RADIUS[e.type]; return (x - e.x) * (x - e.x) + (y - gy) * (y - gy) < r * r;
    }
    function shotHits(sh) {
      var i, x = sh.x, y = sh.y;
      for (i = 0; i < S.air.length; i++) { var e = S.air[i]; if (e.alive && airHitTest(e, x, y)) { hitAir(e, 1); return true; } }
      var B = S.boss;
      if (B && B.alive && !B.falling) {
        for (i = 0; i < B.pods.length; i++) {
          var pd = B.pods[i]; if (!pd.alive) continue;
          var tx = B.x + pd.dx, ty = B.y + pd.dy;
          if ((x - tx) * (x - tx) + (y - ty) * (y - ty) < RADIUS.pod * RADIUS.pod) {
            if (!B.anchored) { emit('clang', { x: x, y: y }); return true; }
            podHit(pd, tx, ty); return true;
          }
        }
        var cx = B.x, cy = B.y - 4;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < CORE_R * CORE_R) {
          if (!B.core.open) { emit('clang', { x: x, y: y }); return true; }
          coreHit(); return true;
        }
      }
      for (i = 0; i < S.ground.length; i++) {
        var g = S.ground[i]; if (!g.alive) continue;
        if (groundHitTest(g, x, y)) {
          g.hp--; g.flash = 0.12;
          if (g.hp <= 0) {
            g.alive = false; S.kills++; g.aimT = 0;
            var pts = PTS[g.type] * (g.sootT > 0 ? 2 : 1); addScore(pts);
            emit('groundKill', { x: g.x, y: sy(g.wy), type: g.type, pts: pts, soot: g.sootT > 0 });
            if (g.type === 'depot') drop(DEPOT_DROPS[S.depotI++ % DEPOT_DROPS.length], g.x, sy(g.wy));
          } else emit('groundHit', { x: g.x, y: sy(g.wy), type: g.type });
          return true;
        }
      }
      return false;
    }
    function podHit(pd, x, y) {
      var B = S.boss;
      pd.hp--; pd.flash = 0.12;
      if (pd.hp > 0) { emit('podHit', { x: x, y: y, hp: pd.hp }); return; }
      pd.alive = false; pd.aimT = 0; S.kills++;
      var pts = PTS.pod * (pd.sootT > 0 ? 2 : 1); addScore(pts);
      var left = B.pods.filter(function (t) { return t.alive; }).length;
      emit('podKill', { x: x, y: y, left: left, pts: pts });
      if (left === Math.floor(B.total / 2) && S.player.hull < HULL) drop('patch', x, y);
      if (left === 0) { B.core.open = true; B.core.fireT = 1.6; emit('coreOpen', { x: B.x, y: B.y }); }
    }
    function coreHit() {
      var B = S.boss, c = B.core;
      c.hp--; c.flash = 0.12;
      if (c.hp > 0) { emit('coreHit', { x: B.x, y: B.y - 4, hp: c.hp }); return; }
      B.falling = true; B.fallT = 2.6; S.bullets = []; c.aimT = 0;
      var pts = 2000 + 500 * S.level; addScore(pts);
      emit('bossDown', { x: B.x, y: B.y, pts: pts });
    }

    // ---------- Обновления ----------
    function movePlayer(dt) {
      var P = S.player; if (P.dead) return;
      var len = Math.hypot(dirX, dirY) || 1, ox = P.x, oy = P.y;
      var k = Math.min(1, Math.hypot(dirX, dirY));
      P.x = clamp(P.x + dirX / len * PLAYER_V * k * dt, PX0, PX1);
      P.y = clamp(P.y + dirY / len * PLAYER_V * k * dt, PY0, PY1);
      S.moved += Math.abs(P.x - ox) + Math.abs(P.y - oy);
      if (S.tut === 1 && S.moved > 90) tutStep('moved');
      P.bank += (clamp(dirX, -1, 1) - P.bank) * Math.min(1, dt * 8);
      if (P.cool > 0) P.cool -= dt;
      if (P.grace > 0) P.grace -= dt;
      if (fire) playerFire();
    }
    function moveShots(dt) {
      for (var i = S.shots.length - 1; i >= 0; i--) {
        var sh = S.shots[i], gone = false;
        for (var k = 0; k < 2 && !gone; k++) {
          sh.x += sh.vx * dt / 2; sh.y += sh.vy * dt / 2;
          if (sh.y < TOP - 10 || sh.x < -10 || sh.x > W + 10) gone = true;
          else if (shotHits(sh)) gone = true;
        }
        if (gone) S.shots.splice(i, 1);
      }
    }
    function updateAir(dt) {
      var P = S.player, p = S.prm;
      for (var i = S.air.length - 1; i >= 0; i--) {
        var e = S.air[i];
        if (!e.alive) { S.air.splice(i, 1); continue; }
        e.t += dt; if (e.flash > 0) e.flash -= dt;
        var sl = e.sootT > 0 ? 0.55 : 1, py = e.y, px = e.x;   // закопчённый теряет ход
        if (e.type === 'bird') {
          if (e.pat === 'sine') { e.y += e.vy * sl * dt; e.x = e.x0 + Math.sin(e.t * 1.9 + e.ph) * e.amp; }
          else if (e.pat === 'cross') { e.x += e.vx * sl * dt; e.y = e.y0 + Math.sin(e.t * 3) * 16 + e.t * 16; }
          else if (e.pat === 'u') {
            if (!e.turned) { e.y += e.vy * sl * dt; if (e.y >= e.turnY) { e.turned = true; e.vx = (P.x > e.x ? 1 : -1) * 50; if (!e.calm && rng() < p.birdShoot + 0.15) startAim(e, e.x, e.y); } }
            else { e.vy -= 420 * dt; e.y += e.vy * dt; e.x += e.vx * dt; }
          }
          if (!e.fired && !e.calm && e.pat === 'sine' && py < e.fireY && e.y >= e.fireY) { e.fired = true; if (rng() < p.birdShoot) startAim(e, e.x, e.y); }
          if (!e.fired && !e.calm && e.pat === 'cross' && (px - e.fireX) * (e.x - e.fireX) <= 0) { e.fired = true; if (rng() < p.birdShoot) startAim(e, e.x, e.y); }
          (function (b) { stepAim(b, b.x, b.y, dt, function () { aimShot(b.x, b.y + 8, 'shot', 0.18, p.birdN, 'bird'); }); })(e);
        } else if (e.type === 'swift') {
          // стриж: зависает наверху и «берёт на прицел», потом пикирует в точку наводки; сорвали — уходит прямо вниз
          if (e.mode === 'in') {
            e.y += e.vy * dt; if (e.y >= e.stopY) { e.mode = 'lock'; e.vy = 18; if (!startAim(e, e.x, e.y)) { e.mode = 'dive'; e.vx = 0; e.vy = p.swiftV * 0.8; } }
          } else if (e.mode === 'lock') {
            e.y += e.vy * dt; e.x += Math.sin(e.t * 9) * 12 * dt;
            var sw = e;
            var fired = stepAim(e, e.x, e.y, dt, function () { var a = Math.atan2(P.y - sw.y, P.x - sw.x); sw.vx = Math.cos(a) * p.swiftV; sw.vy = Math.sin(a) * p.swiftV; sw.mode = 'dive'; emit('swiftDive', { x: sw.x, y: sw.y }); });
            if (!fired && e.aimT <= 0 && e.mode === 'lock') { e.mode = 'dive'; e.vx = rr(-30, 30); e.vy = p.swiftV * 0.75; }
          } else { e.x += e.vx * sl * dt; e.y += e.vy * sl * dt; stepAim(e, e.x, e.y, dt, function () {}); }
        } else if (e.type === 'blimp') {
          e.y += e.vy * dt; e.x += Math.sin(e.t * 0.5) * 14 * dt;
          e.fireT -= dt;
          if (e.fireT <= 0) { e.fireT = 2.2 * p.fireK * rr(0.85, 1.2); startAim(e, e.x, e.y + 16); }
          (function (b) { stepAim(b, b.x, b.y + 16, dt, function () { aimShot(b.x, b.y + 18, 'shell', 0.3, 3, 'blimp'); }); })(e);
        }
        // таран
        if (!P.dead && e.alive) {
          if (airHitTest(e, P.x, P.y, PR - 2)) {
            if (e.type === 'blimp') { if (hurt(P.x, P.y, 'ram')) hitAir(e, 4); }
            else if (hurt(P.x, P.y, 'ram')) killAir(e);
          }
        }
        var off = e.y > H + 40 || e.x < -70 || e.x > W + 70 || (e.y < -60 && e.t > 1);
        if (off || !e.alive) S.air.splice(i, 1);
      }
    }
    function updateGround(dt) {
      var p = S.prm, T = S.terrain, sc = S.script.ground;
      while (S.gi < sc.length && sy(sc[S.gi].wy) > -30) activateGround(sc[S.gi++]);
      for (var i = S.ground.length - 1; i >= 0; i--) {
        var g = S.ground[i], gy = sy(g.wy);
        g.t += dt; if (g.flash > 0) g.flash -= dt;
        if (gy > H + 40) { S.ground.splice(i, 1); continue; }
        if (!g.alive) continue;
        if (g.type === 'boat') {
          var nx = g.x + g.vx * dt;
          if (nx < 30 || nx > W - 30 || isLand(T, nx + Math.sign(g.vx) * 30, g.wy)) g.vx = -g.vx; else g.x = nx;
        }
        if (g.type === 'depot') continue;
        g.fireT -= dt;
        if (g.fireT <= 0 && g.aimT <= 0) { g.fireT = (g.type === 'flak' ? p.flakFire : p.boatFire) * rr(0.8, 1.25); startAim(g, g.x, gy); }
        (function (q, qy) { stepAim(q, q.x, qy, dt, function () { aimShot(q.x, qy - 6, q.type === 'flak' ? 'flak' : 'shot', 0.16, q.type === 'flak' ? p.flakN : p.boatN, q.type); }); })(g, gy);
      }
    }
    function updateBoss(dt) {
      var B = S.boss; if (!B) return;
      B.t += dt;
      B.fans.forEach(function (f) { f.spin += dt * (B.anchored && !B.falling ? 14 : 4); });
      if (!B.anchored) {
        B.y += 70 * dt;
        if (B.y >= BOSS_Y) { B.y = BOSS_Y; B.anchored = true; S.scroll = 0; emit('bossAnchor', {}); }
      } else if (!B.falling) B.x = W / 2 + Math.sin(B.t * 0.42) * 30;
      if (B.falling) {
        B.fallT -= dt; B.y += 40 * dt;
        if (B.fallT <= 0 && B.alive) { B.alive = false; finishLevel(); }
        return;
      }
      var P = S.player, p = S.prm, i;
      for (i = 0; i < B.pods.length; i++) {
        var pd = B.pods[i]; if (!pd.alive) continue;
        if (pd.flash > 0) pd.flash -= dt;
        var tx = B.x + pd.dx, ty = B.y + pd.dy;
        if (!P.dead) { var want = Math.atan2(P.y - ty, P.x - tx), da = ((want - pd.ang + Math.PI * 3) % TAU) - Math.PI; pd.ang += clamp(da, -3 * dt, 3 * dt); }
        if (!B.anchored) continue;
        pd.fireT -= dt;
        if (pd.fireT <= 0 && pd.aimT <= 0) { pd.fireT = p.podFire * B.fireK * (pd.kind === 'twin' ? 1.25 : 1) * rr(0.85, 1.3); startAim(pd, tx, ty); }
        (function (q, qx, qy) { stepAim(q, qx, qy, dt, function () { if (q.kind === 'twin') aimShot(qx, qy, 'shell', 0.22, p.twinN, 'pod'); else aimShot(qx, qy, 'shot', 0, 1, 'pod'); }); })(pd, tx, ty);
      }
      var c = B.core;
      if (c.flash > 0) c.flash -= dt;
      if (c.open && B.anchored) {
        c.fireT -= dt;
        if (c.fireT <= 0 && c.aimT <= 0) { c.fireT = 2.3 * p.fireK * rr(0.9, 1.2); startAim(c, B.x, B.y + 10); }
        stepAim(c, B.x, B.y + 10, dt, function () { aimShot(B.x, B.y + 14, 'shell', 0.22, 5, 'core'); });
      }
      if (p.bossAir && B.anchored) {
        S.bossAirT -= dt;
        if (S.bossAirT <= 0) { S.bossAirT = p.bossAir * rr(0.85, 1.2); var xx = rr(60, W - 60); spawnAir('swift', xx, -20, { stopY: 230 }); }
      }
    }
    function updateBullets(dt) {
      var P = S.player;
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y > H + 10 || b.y < TOP - 10 || b.x < -10 || b.x > W + 10) { S.bullets.splice(i, 1); continue; }
        if (P.dead) continue;
        if ((b.x - P.x) * (b.x - P.x) + (b.y - P.y) * (b.y - P.y) < (PR + 3) * (PR + 3) && P.grace <= 0) {
          S.bullets.splice(i, 1); hurt(b.x, b.y, b.src);
          if (S.over || P.dead) return;
        }
      }
    }
    function updatePickups(dt) {
      var P = S.player;
      for (var i = S.pickups.length - 1; i >= 0; i--) {
        var q = S.pickups[i];
        q.t += dt; q.y += 46 * dt; q.x += Math.sin(q.t * 2.4) * 22 * dt;
        if (!P.dead && Math.hypot(q.x - P.x, q.y - P.y) < 26) { S.pickups.splice(i, 1); pickup(q.kind); continue; }
        if (q.y > H + 20) { S.pickups.splice(i, 1); emit('pickupLost', { kind: q.kind }); }
      }
    }
    function finishLevel() {
      var P = S.player;
      S.clearBonus = P.hull * 500 + Math.min(S.brokenHere, BROKEN_CAP) * 30 + (S.lostHere === 0 ? 1000 : 0);
      addScore(S.clearBonus);
      S.phase = 'clear'; S.phaseT = 2.8; S.bullets = []; S.air = [];
      emit('clear', { level: S.level, bonus: S.clearBonus });
    }

    function update(dt) {
      if (S.over) return;
      S.time += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.tipT > 0 && S.tipT < 90) { S.tipT -= dt; if (S.tipT <= 0 && S.tut !== 1 && S.tut !== 4) S.tip = null; }
      tutStep('tick');
      S.aims = [];
      if (S.phase === 'clear') {
        movePlayer(dt); moveShots(dt); updatePickups(dt); updatePuffs(dt);
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.level >= S.maxLevel) { S.over = true; S.won = true; S.phase = 'over'; emit('win', { score: S.score }); }
          else { S.level++; setupLevel(); }
        }
        return;
      }
      S.dist += S.scroll * dt;
      if (S.phase === 'dead') { S.phaseT -= dt; if (S.phaseT <= 0) respawn(); }
      else movePlayer(dt);
      updateSmoke(dt);
      updatePuffs(dt);
      var sc = S.script.air;
      while (S.ai < sc.length && sc[S.ai].at <= S.dist) runEvent(sc[S.ai++]);
      for (var i = S.pending.length - 1; i >= 0; i--) if (S.pending[i].t <= S.time) { var f = S.pending[i].fn; S.pending.splice(i, 1); f(); }
      if (!S.boss && S.dist >= S.terrain.len) spawnBoss();
      moveShots(dt);
      updateAir(dt); if (S.over) return;
      updateGround(dt); if (S.over) return;
      updateBoss(dt); if (S.phase === 'clear') return;
      updateBullets(dt); if (S.over) return;
      updatePickups(dt);
    }

    // ---------- Площадка: «ещё один шанс» и бонус за рекламу ----------
    function reviveAd() {
      if (!S.over || S.won) return false;
      S.over = false; S.lives = 1; S.bullets = [];
      S.air.forEach(function (e) { e.aimT = 0; e.blindT = 2; });
      respawn(); S.player.grace = 2.6;
      return true;
    }
    function canBoost() { return S.started && !S.over && S.lives < MAX_LIVES; }
    function boost() { if (!canBoost()) return false; S.lives++; emit('life', { lives: S.lives }); return true; }

    var api = {
      start: function () { setupLevel(); return api; },
      update: update,
      setDir: function (dx, dy) { dirX = clamp(+dx || 0, -1, 1); dirY = clamp(+dy || 0, -1, 1); },
      setFire: function (v) { fire = !!v; },
      setSmoke: function (v) { smokeOn = !!v; },
      fire: function () { return playerFire(); },
      reviveAd: reviveAd, canBoost: canBoost, boost: boost,
      state: function () { return S; },
      _S: S,
      // для тестов, бота и промо-съёмки
      _setupLevel: function (n) { S.level = n; setupLevel(); return S; },
      _spawnAir: spawnAir, _spawnGround: function (type, x, wy, dir) { return activateGround({ type: type, x: x, wy: wy, dir: dir }); },
      _spawnBoss: spawnBoss, _hurt: hurt, _pickup: pickup, _drop: drop, _aimShot: aimShot, _puff: emitPuff, _startAim: startAim,
      _lineBlocked: lineBlocked, _inSmoke: inSmoke, _wy: wyOf,
      _isLand: function (x, wy) { return isLand(S.terrain, x, wy); }, _sy: sy, _runEvent: runEvent, _finish: finishLevel
    };
    return api;
  }

  // Переделка 2026-11: правила и счёт новые — прежний рекорд уходит в «прежний рекорд», рекорд начинается заново
  E.migrate = function (ls) {
    var old = 0;
    try {
      if (ls && ls.getItem('arcade.eskadrilya.v') !== '2') {
        old = +ls.getItem('arcade.best.eskadrilya') || 0;
        if (old) { ls.setItem('arcade.eskadrilya.oldBest', String(old)); ls.removeItem('arcade.best.eskadrilya'); }
        ls.setItem('arcade.eskadrilya.v', '2');
      }
    } catch (e) { old = 0; }
    return old;
  };

  E.Game = Game;
  E.logic = {
    W: W, H: H, TOP: TOP, PX0: PX0, PX1: PX1, PY0: PY0, PY1: PY1, SCROLL: SCROLL, ROW: ROW,
    PLAYER_V: PLAYER_V, SHOT_V: SHOT_V, FIRE_CD: FIRE_CD, PR: PR, HULL: HULL, POWER_MAX: POWER_MAX, MAX_LIVES: MAX_LIVES,
    SMAX: SMAX, SM_USE: SM_USE, SM_REGEN: SM_REGEN, SM_DELAY: SM_DELAY, PUFF_R: PUFF_R, PUFF_LIFE: PUFF_LIFE, BLIND_T: BLIND_T, SOOT_T: SOOT_T,
    BROKEN_PTS: BROKEN_PTS, BROKEN_CAP: BROKEN_CAP, BOSS_Y: BOSS_Y, HULL_RX: HULL_RX, HULL_RY: HULL_RY, FAN_R: FAN_R, CORE_R: CORE_R,
    EXTRA_LIFE: EXTRA_LIFE, PTS: PTS, RADIUS: RADIUS, BLIMP: BLIMP, BOAT: BOAT,
    LEVELS: LEVELS, SLOTS: SLOTS, FANS: FANS, puffR: puffR, segDist: segDist,
    params: params, makeTerrain: makeTerrain, makeScript: makeScript, isLand: isLand, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
