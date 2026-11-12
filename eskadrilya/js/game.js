/* ЭСКАДРИЛЬЯ · логика без DOM (детерминирована при заданном rng). ESKADRILYA.Game(opts), ESKADRILYA.logic
   Вертикальный скролл-шутер: летучий отряд мастерской «Гефест» (паролёты-бипланы) идёт над морем,
   островами и сушей против флотилии «Окалины» — ржавые дирижабли, механические птицы и стрижи,
   зенитки на берегу, паровые катера и в конце каждого перелёта — крейсер-кузня.
   Особенности:
   - энергия (котёл) вместо жизней внутри уровня: попадания снимают энергию, бонусы её доливают;
     энергия на нуле — самолёт потерян (всего 3);
   - «петля» — короткая неуязвимая петля-уклонение, ограниченное число за уровень;
   - звено — подбор даёт 2 ведомых рядом, каждый гибнет от первого попадания;
   - крейсер-кузня: стреляешь по турелям, пролетая над палубой; трубы глушат выстрелы снизу,
     поэтому носовую турель достать можно только из-за труб. */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA = global.ESKADRILYA || {};

  // ---------- Поле и константы ----------
  var W = 480, H = 640, TOP = 44;
  var PX0 = 22, PX1 = 458, PY0 = 116, PY1 = 604;   // где может летать самолёт (центр)
  var SCROLL = 62, ROW = 16;                         // скорость прокрутки, шаг карты рельефа
  var PLAYER_V = 225, LOOP_V = 0.6, SHOT_V = 680, FIRE_CD = 0.15;
  var PR = 9, WR = 7, WING_DX = 32, WING_DY = 14;    // радиусы попадания, место ведомых
  var EMAX = 100, LOOPS = 3, LOOP_T = 1.1, LOOP_MAX = 5, POWER_MAX = 3;
  var DMG = { shot: 20, shell: 26, flak: 22, ram: 30, ramBig: 40 };
  var FUEL_ADD = 40, GRACE_HIT = 0.5, GRACE_SPAWN = 2.0;
  var BOSS_Y = 300, HULL_HL = 190, HULL_HW = 54;
  var EXTRA_LIFE = [40000];
  var PTS = { bird: 100, red: 150, swift: 150, blimp: 800, flak: 250, boat: 300, depot: 200, turret: 500 };
  var GHP = { flak: 4, boat: 3, depot: 2 };   // прочность наземных/морских целей
  var RADIUS = { bird: 13, swift: 11, flak: 13, depot: 13, turret: 14 };
  var BLIMP = { rx: 36, ry: 16 }, BOAT = { rx: 22, ry: 10 };
  var TAU = Math.PI * 2;

  // 8 перелётов: рельеф (секции по 640 px), длина маршрута, имя корабля-босса и число турелей
  var LEVELS = [
    { name: 'bay',      len: 3500, terr: ['sea', 'coastR', 'isles', 'sea', 'coastL', 'isles'],     turrets: 3 },
    { name: 'shore',    len: 3800, terr: ['coastL', 'coastR', 'isles', 'strait', 'isles', 'coastL'], turrets: 3 },
    { name: 'ridge',    len: 4100, terr: ['strait', 'land', 'land', 'coastR', 'isles', 'strait'],   turrets: 4 },
    { name: 'bridge',   len: 4400, terr: ['isles', 'strait', 'land', 'strait', 'coastL', 'isles'],  turrets: 4 },
    { name: 'shoals',   len: 4600, terr: ['isles', 'isles', 'coastR', 'isles', 'sea', 'isles'],     turrets: 5 },
    { name: 'archi',    len: 4800, terr: ['coastL', 'isles', 'strait', 'isles', 'coastR', 'isles'], turrets: 5 },
    { name: 'waste',    len: 5000, terr: ['land', 'strait', 'isles', 'land', 'strait', 'coastL'],   turrets: 6 },
    { name: 'flagship', len: 5200, terr: ['isles', 'strait', 'coastR', 'land', 'isles', 'sea'],     turrets: 7 }
  ];
  // Слоты турелей на палубе (от центра корабля; нос — вверху). bow стоит за трубами.
  var SLOTS = [
    { dx: 0, dy: -150, kind: 'twin' }, { dx: -30, dy: -18, kind: 'gun' }, { dx: 30, dy: -18, kind: 'gun' },
    { dx: 0, dy: 150, kind: 'gun' }, { dx: -30, dy: 84, kind: 'gun' }, { dx: 30, dy: 84, kind: 'gun' },
    { dx: -30, dy: -108, kind: 'twin' }
  ];
  var FUNNELS = [{ dx: 0, dy: -78, w: 32, h: 30 }, { dx: 0, dy: 30, w: 28, h: 26 }];
  var DROPS = ['power', 'fuel', 'wing', 'loop'];   // по кругу из «красных» стай

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Параметры уровня — через хук difficulty(level, base, step, max) движка
  function params(lv, diff) {
    var d = diff || function (l, base, step, max) { var v = base + (l - 1) * step; return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max)); };
    return {
      bulletV: d(lv, 165, 10, 235),
      fireK: d(lv, 1, -0.05, 0.65),        // множитель интервалов огня
      airGap: d(lv, 205, -8, 145),          // px прокрутки между налётами
      groundGap: d(lv, 165, -6, 120),
      birdV: d(lv, 110, 8, 170), swiftV: d(lv, 235, 12, 330),
      birdShoot: d(lv, 0.45, 0.05, 0.8),    // доля птиц, что стреляют на подлёте
      blimpHp: 14 + lv * 3, turretHp: 16 + lv * 3,
      turretFire: d(lv, 2.2, -0.03, 2.0), flakFire: d(lv, 2.1, -0.06, 1.7), boatFire: d(lv, 2.7, -0.15, 1.6),
      burst: lv >= 7 ? 2 : 1, flakN: lv >= 5 ? 2 : 1, birdN: lv >= 6 ? 2 : 1,
      dmgK: d(lv, 1, 0.051, 1.4),             // множитель урона по энергии
      bossAir: lv >= 3 ? d(lv, 8, -0.5, 4.5) : 0   // стрижи во время боя с кораблём, с
    };
  }

  // ---------- Рельеф уровня: ширина берега слева/справа по рядам + острова ----------
  function makeTerrain(lv) {
    var Lv = LEVELS[(lv - 1) % LEVELS.length], rng = mulberry32(lv * 7919 + 13);
    var total = Lv.len + 1700, n = Math.ceil(total / ROW) + 2, Lw = [], Rw = [], isles = [];
    var tl = [], tr = [];
    function sect(wy) {
      var k = Math.floor((wy - H) / 640);
      if (wy < H || wy > Lv.len - 200) return 'sea';            // старт и подход к кораблю — открытое море
      return Lv.terr[((k % Lv.terr.length) + Lv.terr.length) % Lv.terr.length];
    }
    var ph1 = rng() * TAU, ph2 = rng() * TAU;
    for (var i = 0; i < n; i++) {
      var wy = i * ROW, s = sect(wy), a = 0, b = 0;
      if (s === 'coastL') a = 150; else if (s === 'coastR') b = 150;
      else if (s === 'strait') { a = 112; b = 112; } else if (s === 'land') { a = 178; b = 178; }
      tl.push(a); tr.push(b);
    }
    for (i = 0; i < n; i++) {   // сглаживание переходов + «изрезанность» берега
      var sa = 0, sb = 0, c = 0;
      for (var j = i - 10; j <= i + 10; j++) { var q = clamp(j, 0, n - 1); sa += tl[q]; sb += tr[q]; c++; }
      sa /= c; sb /= c;
      var wig1 = Math.sin(i * 0.21 + ph1) * 14 + Math.sin(i * 0.53 + ph2) * 6, wig2 = Math.sin(i * 0.19 + ph2) * 14 + Math.sin(i * 0.47 + ph1) * 6;
      Lw.push(sa > 4 ? Math.max(0, sa + wig1 * Math.min(1, sa / 60)) : 0);
      Rw.push(sb > 4 ? Math.max(0, sb + wig2 * Math.min(1, sb / 60)) : 0);
    }
    // острова в секциях isles
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
  function rowAt(T, wy) { var i = clamp(Math.round(wy / ROW), 0, T.Lw.length - 1); return i; }
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

  // ---------- Сценарий уровня: налёты (по прокрутке) и наземные/морские цели ----------
  function makeScript(lv, T, prm) {
    var rng = mulberry32(lv * 104729 + 7), air = [], ground = [], Lv = LEVELS[(lv - 1) % LEVELS.length];
    var pool = ['sine', 'cross', 'u', 'sine'];
    if (lv >= 2) pool.push('swifts');
    if (lv >= 4) pool.push('swifts', 'u');
    var k = 0, nextBlimp = lv === 1 ? 1700 : 1100;
    for (var at = 260; at < Lv.len - 150; at += prm.airGap * (0.85 + rng() * 0.3)) {
      var pat;
      if (at >= nextBlimp) { pat = 'blimp'; nextBlimp += lv === 1 ? 99999 : 1500 - lv * 60; }
      else if (k % 4 === 3) pat = 'red';
      else pat = pool[Math.floor(rng() * pool.length)];
      air.push({ at: at, pat: pat, x: 100 + rng() * 280, side: rng() < 0.5 ? -1 : 1, seed: Math.floor(rng() * 1e6) });
      k++;
    }
    var lastDepot = H;
    for (var wy = H + 160; wy < Lv.len + H - 260; wy += prm.groundGap * (0.8 + rng() * 0.4)) {
      var placed = false;
      for (var tries = 0; tries < 8 && !placed; tries++) {     // сначала ищем сушу (зенитки, склады)
        var x = 40 + rng() * 400, y = wy + rng() * 90;
        if (landAround(T, x, y, 18)) {
          placed = true;
          if (rng() < 0.3) break;                                  // на суше — не в каждом окне по зенитке
          var depot = y - lastDepot > 1000 - lv * 40;
          if (depot) lastDepot = y;
          ground.push({ type: depot ? 'depot' : 'flak', x: x, wy: y });
        }
      }
      for (tries = 0; tries < 6 && !placed; tries++) {         // иначе — катер на воде
        x = 40 + rng() * 400; y = wy + rng() * 90;
        if (seaAround(T, x, y, 36)) { placed = true; if (rng() < 0.6) ground.push({ type: 'boat', x: x, wy: y, dir: rng() < 0.5 ? -1 : 1 }); }
      }
    }
    ground.sort(function (a, b) { return a.wy - b.wy; });
    return { air: air, ground: ground };
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {};
    var maxLevel = opts.maxLevel || LEVELS.length;
    var S = {
      level: opts.level || 1, maxLevel: maxLevel, lives: opts.lives == null ? 3 : opts.lives, score: 0,
      phase: 'play', phaseT: 0, time: 0, over: false, won: false, banner: 0, extra: 0, clearBonus: 0,
      name: '', prm: null, terrain: null, script: null, ai: 0, gi: 0, dist: 0, scroll: SCROLL, stage: 'route',
      player: { x: W / 2, y: 540, energy: EMAX, dead: false, grace: 0, loopT: 0, loops: LOOPS, cool: 0, power: 1,
        wing: [false, false], wx: [W / 2 - WING_DX, W / 2 + WING_DX], wy: [554, 554], bank: 0, low: false },
      shots: [], bullets: [], air: [], ground: [], pickups: [], pending: [], boss: null,
      kills: 0, dropI: 0, redGroups: {}, bossAirT: 0, lostHere: 0
    };
    var dirX = 0, dirY = 0, fire = false;
    function emit(t, d) { onEvent(t, d || {}); }
    function rr(a, b) { return a + (b - a) * rng(); }
    function addScore(n) {
      S.score += n;
      while (S.extra < EXTRA_LIFE.length && S.score >= EXTRA_LIFE[S.extra]) { S.extra++; S.lives++; emit('life', { lives: S.lives }); }
    }
    function sy(wy) { return H - (wy - S.dist); }   // мировая координата → экран

    // ---------- Уровень ----------
    function setupLevel() {
      var Lv = LEVELS[(S.level - 1) % LEVELS.length];
      S.name = Lv.name; S.prm = params(S.level, opts.difficulty);
      S.terrain = makeTerrain(S.level); S.script = makeScript(S.level, S.terrain, S.prm);
      S.ai = 0; S.gi = 0; S.dist = 0; S.scroll = SCROLL; S.stage = 'route';
      S.shots = []; S.bullets = []; S.air = []; S.ground = []; S.pickups = []; S.pending = []; S.boss = null; S.redGroups = {};
      S.phase = 'play'; S.phaseT = 0; S.banner = 2.2; S.bossAirT = 3; S.lostHere = 0;
      var P = S.player;
      P.x = W / 2; P.y = 540; P.energy = EMAX; P.loops = LOOPS; P.loopT = 0; P.dead = false; P.grace = 1.0; P.low = false;
      for (var i = 0; i < 2; i++) { P.wx[i] = P.x + (i ? WING_DX : -WING_DX); P.wy[i] = P.y + WING_DY; }
      emit('level', { level: S.level, name: S.name });
    }

    // ---------- Спавн ----------
    function spawnAir(type, x, y, o) {
      o = o || {};
      var e = { type: type, x: x, y: y, x0: x, y0: y, t: 0, hp: 1, max: 1, vx: o.vx || 0, vy: o.vy || 0, pat: o.pat || 'line',
        ph: o.ph || 0, amp: o.amp || 0, fired: false, fireY: o.fireY || rr(100, 240), fireX: o.fireX, fireT: o.fireT || 0,
        red: o.red || 0, turnY: o.turnY || 0, turned: false, flash: 0, alive: true, drop: o.drop || (type === 'blimp' ? (S.level % 2 ? 'wing' : 'power') : null) };
      if (type === 'blimp') { e.hp = e.max = S.prm.blimpHp; e.fireT = 1.6; }
      if (type === 'swift') { var a = Math.atan2(S.player.y - y, S.player.x - x), sp = S.prm.swiftV; e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp; }
      S.air.push(e); return e;
    }
    function queue(dt, fn) { S.pending.push({ t: S.time + dt, fn: fn }); }
    function runEvent(ev) {
      var p = S.prm, r = mulberry32(ev.seed), i;
      if (ev.pat === 'sine' || ev.pat === 'red') {
        var red = 0;
        if (ev.pat === 'red') { red = ++S.dropI; S.redGroups[red] = { left: 5, failed: false, drop: DROPS[(red - 1) % DROPS.length] }; }
        var amp = 40 + r() * 50, x0 = clamp(ev.x, 70 + amp, W - 70 - amp), ph = r() * TAU;
        for (i = 0; i < 5; i++) (function (k) { queue(k * 0.3, function () { spawnAir('bird', x0, -20, { pat: 'sine', vy: p.birdV, amp: amp, ph: ph, red: red, fireY: 90 + r() * 150 }); }); })(i);
      } else if (ev.pat === 'cross') {
        var y0 = 130 + r() * 110, s = ev.side;
        for (i = 0; i < 4; i++) (function (k) { queue(k * 0.42, function () { spawnAir('bird', s < 0 ? -24 : W + 24, y0, { pat: 'cross', vx: -s * (p.birdV + 40), fireX: 90 + r() * 300 }); }); })(i);
      } else if (ev.pat === 'u') {
        for (i = 0; i < 4; i++) (function (k) { var xx = clamp(ev.x + (k - 1.5) * 52, 40, W - 40); queue(k * 0.22, function () { spawnAir('bird', xx, -20, { pat: 'u', vy: p.birdV * 1.25, turnY: 210 + r() * 90 }); }); })(i);
      } else if (ev.pat === 'swifts') {
        for (i = 0; i < 3; i++) (function (k) { var xx = clamp(ev.x + (k - 1) * 70, 40, W - 40); queue(k * 0.35, function () { spawnAir('swift', xx, -20); }); })(i);
      } else if (ev.pat === 'blimp') {
        spawnAir('blimp', clamp(ev.x, 90, W - 90), -30, { vy: 24 });   // сбитый дирижабль роняет звено (нечётные) или стволы
      }
      emit('raid', { pat: ev.pat });
    }
    function activateGround(o) {
      var e = { type: o.type, x: o.x, wy: o.wy, hp: GHP[o.type], max: GHP[o.type], fireT: rr(0.15, 0.8),
        vx: o.type === 'boat' ? (o.dir || 1) * 34 : 0, alive: true, flash: 0, t: 0 };
      e.max = e.hp; S.ground.push(e); return e;
    }
    function spawnBoss() {
      var Lv = LEVELS[(S.level - 1) % LEVELS.length], ts = [];
      for (var i = 0; i < Lv.turrets; i++) {
        var s = SLOTS[i];
        ts.push({ dx: s.dx, dy: s.dy, kind: s.kind, hp: S.prm.turretHp + (s.kind === 'twin' ? 4 : 0), max: 0,
          fireT: 1.2 + i * 0.45 + rr(0, 0.8), alive: true, flash: 0, aim: Math.PI / 2 });
      }
      ts.forEach(function (t) { t.max = t.hp; });
      S.boss = { x: W / 2, wy: S.dist + H + HULL_HL + 30, y: -HULL_HL - 30, anchored: false, t: 0, turrets: ts,
        funnels: FUNNELS.map(function (f) { return { dx: f.dx, dy: f.dy, w: f.w, h: f.h }; }), sinking: false, sinkT: 0, alive: true, total: ts.length,
        fireK: Math.pow(ts.length / 3, 0.75) };   // больше турелей — каждая стреляет реже: общий огонь растёт плавно
      S.stage = 'boss'; S.scroll = SCROLL * 1.8;   // крейсер подходит быстрее прокрутки маршрута
      emit('bossArrive', { level: S.level });
    }
    function drop(kind, x, y) { S.pickups.push({ kind: kind, x: clamp(x, 30, W - 30), y: y, t: 0 }); emit('drop', { kind: kind, x: x, y: y }); }

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
    function canFireAt(x, y) { var P = S.player; return !P.dead && y > TOP + 8 && y < H - 150 && Math.hypot(P.x - x, P.y - y) > 90; }

    // ---------- Игрок ----------
    function hurt(dmg, x, y, src) {
      var P = S.player;
      if (P.dead || P.loopT > 0 || P.grace > 0 || S.over || S.phase === 'clear') return false;
      dmg = Math.round(dmg * (S.prm.dmgK || 1)); P.energy = Math.max(0, P.energy - dmg); P.grace = GRACE_HIT;
      emit('hurt', { x: x, y: y, energy: P.energy, dmg: dmg, src: src || '' });
      if (P.energy <= 30 && !P.low) { P.low = true; emit('lowEnergy', { energy: P.energy }); }
      if (P.energy <= 0) lose();
      return true;
    }
    function lose() {
      var P = S.player;
      P.dead = true; S.lives--; S.lostHere++; P.loopT = 0;
      S.phase = 'dead'; S.phaseT = 1.8; S.bullets = [];
      P.wing = [false, false]; P.power = Math.max(1, P.power - 1);
      emit('playerLost', { x: P.x, y: P.y, lives: S.lives });
      if (S.lives <= 0) { S.over = true; S.phase = 'over'; emit('gameover', { score: S.score }); }
    }
    function respawn() {
      var P = S.player;
      P.dead = false; P.energy = EMAX; P.low = false; P.x = W / 2; P.y = 560; P.grace = GRACE_SPAWN;
      if (P.loops < 1) P.loops = 1;
      S.phase = 'play'; emit('respawn', {});
    }
    function doLoop() {
      var P = S.player;
      if (P.dead || P.loopT > 0 || P.loops <= 0 || S.over || S.phase !== 'play') return false;
      P.loops--; P.loopT = LOOP_T; emit('loop', { loops: P.loops, x: P.x, y: P.y }); return true;
    }
    function wingLost(i, x, y) { var P = S.player; if (!P.wing[i]) return; P.wing[i] = false; emit('wingLost', { x: x, y: y, i: i }); }
    function playerFire() {
      var P = S.player;
      if (P.dead || P.loopT > 0 || P.cool > 0 || S.over || S.phase === 'clear') return false;
      P.cool = FIRE_CD;
      var v = -SHOT_V, y = P.y - 14;
      P.volley = (P.volley || 0) + 1;
      if (P.power === 1) S.shots.push({ x: P.x, y: y, vx: 0, vy: v });
      else S.shots.push({ x: P.x - 4, y: y, vx: 0, vy: v }, { x: P.x + 4, y: y, vx: 0, vy: v });
      if (P.power >= 3) S.shots.push({ x: P.x - 10, y: y + 4, vx: -150, vy: v * 0.97 }, { x: P.x + 10, y: y + 4, vx: 150, vy: v * 0.97 });
      if (P.volley % 2) for (var i = 0; i < 2; i++) if (P.wing[i]) S.shots.push({ x: P.wx[i], y: P.wy[i] - 10, vx: 0, vy: v, wing: true });
      emit('shoot', { x: P.x, power: P.power }); return true;
    }
    function pickup(kind) {
      var P = S.player;
      if (kind === 'fuel') { P.energy = Math.min(EMAX, P.energy + FUEL_ADD); if (P.energy > 30) P.low = false; }
      else if (kind === 'wing') {
        if (P.wing[0] && P.wing[1]) addScore(500);
        for (var i = 0; i < 2; i++) if (!P.wing[i]) { P.wing[i] = true; P.wx[i] = P.x + (i ? 60 : -60); P.wy[i] = P.y + 40; }
      } else if (kind === 'loop') P.loops = Math.min(LOOP_MAX, P.loops + 1);
      else if (kind === 'power') { if (P.power >= POWER_MAX) addScore(500); P.power = Math.min(POWER_MAX, P.power + 1); }
      addScore(100);
      emit('pickup', { kind: kind, x: P.x, y: P.y });
    }

    // ---------- Попадания выстрелов игрока ----------
    function killAir(e, by) {
      e.alive = false; S.kills++;
      var pts = e.type === 'bird' ? (e.red ? PTS.red : PTS.bird) : PTS[e.type];
      addScore(pts);
      emit('kill', { x: e.x, y: e.y, type: e.type, pts: pts, red: !!e.red });
      if (e.red && S.redGroups[e.red]) { var G = S.redGroups[e.red]; G.left--; if (G.left === 0 && !G.failed) { drop(G.drop, e.x, e.y); addScore(500); } }
      if (e.drop) drop(e.drop, e.x, e.y);
    }
    function hitAir(e, dmg) {
      e.hp -= dmg; e.flash = 0.12;
      if (e.hp <= 0) killAir(e); else emit('hitAir', { x: e.x, y: e.y, type: e.type });
    }
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
      if (B && B.alive && !B.sinking) {
        for (i = 0; i < B.funnels.length; i++) {
          var f = B.funnels[i], fx = B.x + f.dx, fy = B.y + f.dy;
          if (Math.abs(x - fx) < f.w / 2 && Math.abs(y - fy) < f.h / 2) { emit('clang', { x: x, y: y }); return true; }
        }
        for (i = 0; i < B.turrets.length; i++) {
          var tu = B.turrets[i]; if (!tu.alive) continue;
          var tx = B.x + tu.dx, ty = B.y + tu.dy;
          if ((x - tx) * (x - tx) + (y - ty) * (y - ty) < RADIUS.turret * RADIUS.turret) {
            if (!B.anchored) { emit('clang', { x: x, y: y }); return true; }   // на подходе турели под броне-колпаками
            turretHit(tu, i, tx, ty); return true;
          }
        }
      }
      for (i = 0; i < S.ground.length; i++) {
        var g = S.ground[i]; if (!g.alive) continue;
        if (groundHitTest(g, x, y)) {
          g.hp--; g.flash = 0.12;
          if (g.hp <= 0) {
            g.alive = false; S.kills++; addScore(PTS[g.type]);
            emit('groundKill', { x: g.x, y: sy(g.wy), type: g.type, pts: PTS[g.type] });
            if (g.type === 'depot') drop('fuel', g.x, sy(g.wy));
          } else emit('groundHit', { x: g.x, y: sy(g.wy), type: g.type });
          return true;
        }
      }
      return false;
    }
    function turretHit(tu, i, x, y) {
      var B = S.boss;
      tu.hp--; tu.flash = 0.12;
      if (tu.hp > 0) { emit('turretHit', { x: x, y: y, hp: tu.hp }); return; }
      tu.alive = false; S.kills++; addScore(PTS.turret);
      var left = B.turrets.filter(function (t) { return t.alive; }).length;
      emit('turretKill', { x: x, y: y, left: left, pts: PTS.turret });
      if (left === Math.floor(B.total / 2) && S.player.energy < 70) drop('fuel', x, y);
      if (left === 0) {
        B.sinking = true; B.sinkT = 2.6; S.bullets = [];
        var pts = 2000 + 500 * S.level; addScore(pts);
        emit('bossSink', { x: B.x, y: B.y, pts: pts });
      }
    }

    // ---------- Обновления ----------
    function movePlayer(dt) {
      var P = S.player; if (P.dead) return;
      var k = P.loopT > 0 ? LOOP_V : 1, len = Math.hypot(dirX, dirY) || 1;
      P.x = clamp(P.x + dirX / len * PLAYER_V * k * dt, PX0, PX1);
      P.y = clamp(P.y + dirY / len * PLAYER_V * k * dt, PY0, PY1);
      P.bank += (dirX - P.bank) * Math.min(1, dt * 8);
      if (P.cool > 0) P.cool -= dt;
      if (P.grace > 0) P.grace -= dt;
      if (P.loopT > 0) { P.loopT -= dt; if (P.loopT <= 0) { P.loopT = 0; emit('loopEnd', {}); } }
      for (var i = 0; i < 2; i++) {
        var tx = P.x + (i ? WING_DX : -WING_DX), ty = P.y + WING_DY, f = Math.min(1, dt * 9);
        P.wx[i] += (tx - P.wx[i]) * f; P.wy[i] += (ty - P.wy[i]) * f;
      }
      if (fire) playerFire();
    }
    function moveShots(dt) {
      for (var i = S.shots.length - 1; i >= 0; i--) {
        var sh = S.shots[i], n = 2, gone = false;
        for (var k = 0; k < n && !gone; k++) {
          sh.x += sh.vx * dt / n; sh.y += sh.vy * dt / n;
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
        var py = e.y, px = e.x;
        if (e.type === 'bird') {
          if (e.pat === 'sine') { e.y += e.vy * dt; e.x = e.x0 + Math.sin(e.t * 1.9 + e.ph) * e.amp; }
          else if (e.pat === 'cross') { e.x += e.vx * dt; e.y = e.y0 + Math.sin(e.t * 3) * 16 + e.t * 16; }
          else if (e.pat === 'u') {
            if (!e.turned) { e.y += e.vy * dt; if (e.y >= e.turnY) { e.turned = true; e.vx = (P.x > e.x ? 1 : -1) * 50; if (rng() < p.birdShoot + 0.15 && canFireAt(e.x, e.y)) aimShot(e.x, e.y + 8, 'shot', 0, 1, 'bird'); } }
            else { e.vy -= 420 * dt; e.y += e.vy * dt; e.x += e.vx * dt; }
          }
          if (!e.fired && e.pat === 'sine' && py < e.fireY && e.y >= e.fireY) { e.fired = true; if (rng() < p.birdShoot && canFireAt(e.x, e.y)) aimShot(e.x, e.y + 8, 'shot', 0.18, p.birdN, 'bird'); }
          if (!e.fired && e.pat === 'cross' && (px - e.fireX) * (e.x - e.fireX) <= 0) { e.fired = true; if (rng() < p.birdShoot && canFireAt(e.x, e.y)) aimShot(e.x, e.y + 8, 'shot', 0.18, p.birdN, 'bird'); }
        } else if (e.type === 'swift') { e.x += e.vx * dt; e.y += e.vy * dt; }
        else if (e.type === 'blimp') {
          e.y += e.vy * dt; e.x += Math.sin(e.t * 0.5) * 14 * dt;
          e.fireT -= dt;
          if (e.fireT <= 0) { e.fireT = 2.0 * p.fireK * rr(0.85, 1.2); if (canFireAt(e.x, e.y + 16)) aimShot(e.x, e.y + 18, 'shell', 0.3, 3, 'blimp'); }
        }
        // таран
        if (!P.dead && P.loopT <= 0) {
          if (airHitTest(e, P.x, P.y, PR - 2)) {
            if (e.type === 'blimp') { hitAir(e, 4); hurt(DMG.ramBig, P.x, P.y, 'ram'); }
            else { killAir(e); hurt(DMG.ram, P.x, P.y, 'ram'); }
          }
          for (var w = 0; w < 2 && e.alive; w++) if (P.wing[w] && airHitTest(e, P.wx[w], P.wy[w], WR - 2)) { wingLost(w, P.wx[w], P.wy[w]); hitAir(e, 3); }
        }
        var off = e.y > H + 40 || e.x < -70 || e.x > W + 70 || (e.y < -60 && e.t > 1);
        if (off || !e.alive) {
          if (off && e.alive && e.red && S.redGroups[e.red]) S.redGroups[e.red].failed = true;
          S.air.splice(i, 1);
        }
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
        if (g.fireT <= 0) {
          g.fireT = (g.type === 'flak' ? p.flakFire : p.boatFire) * rr(0.8, 1.25);
          if (canFireAt(g.x, gy)) aimShot(g.x, gy - 6, g.type === 'flak' ? 'flak' : 'shot', 0.16, g.type === 'flak' ? p.flakN : 1, g.type);
        }
      }
    }
    function updateBoss(dt) {
      var B = S.boss; if (!B) return;
      B.t += dt;
      if (!B.anchored) {
        B.y = sy(B.wy);
        if (B.y >= BOSS_Y) { B.y = BOSS_Y; B.anchored = true; S.scroll = 0; emit('bossAnchor', {}); }
      } else if (!B.sinking) B.x = W / 2 + Math.sin(B.t * 0.42) * 38;
      if (B.sinking) {
        B.sinkT -= dt;
        if (B.sinkT <= 0 && B.alive) { B.alive = false; finishLevel(); }
        return;
      }
      var P = S.player, p = S.prm;
      for (var i = 0; i < B.turrets.length; i++) {
        var tu = B.turrets[i]; if (!tu.alive) continue;
        if (tu.flash > 0) tu.flash -= dt;
        var tx = B.x + tu.dx, ty = B.y + tu.dy;
        if (!P.dead) { var want = Math.atan2(P.y - ty, P.x - tx), da = ((want - tu.aim + Math.PI * 3) % TAU) - Math.PI; tu.aim += clamp(da, -3 * dt, 3 * dt); }
        if (ty < TOP + 10 || !B.anchored) continue;
        tu.fireT -= dt;
        if (tu.fireT <= 0) {
          tu.fireT = p.turretFire * B.fireK * (tu.kind === 'twin' ? 1.3 : 1) * rr(0.85, 1.3);
          if (!P.dead && Math.hypot(P.x - tx, P.y - ty) > 40) {
            if (tu.kind === 'twin') aimShot(tx, ty, 'shell', 0.28, 3, 'turret');
            else { aimShot(tx, ty, 'shot', 0, 1, 'turret'); if (p.burst > 1) queue(0.16, (function (t2) { return function () { if (t2.alive && S.boss && !S.boss.sinking) aimShot(S.boss.x + t2.dx, S.boss.y + t2.dy, 'shot', 0, 1, 'turret'); }; })(tu)); }
          }
        }
      }
      if (p.bossAir && B.anchored) {
        S.bossAirT -= dt;
        if (S.bossAirT <= 0) { S.bossAirT = p.bossAir * rr(0.85, 1.2); var xx = rr(60, W - 60); spawnAir('swift', xx, -20); queue(0.3, function () { spawnAir('swift', clamp(xx + 60, 40, W - 40), -20); }); }
      }
    }
    function updateBullets(dt) {
      var P = S.player;
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y > H + 10 || b.y < TOP - 10 || b.x < -10 || b.x > W + 10) { S.bullets.splice(i, 1); continue; }
        if (P.dead || P.loopT > 0) continue;
        var hit = false;
        if ((b.x - P.x) * (b.x - P.x) + (b.y - P.y) * (b.y - P.y) < (PR + 3) * (PR + 3)) {
          if (P.grace <= 0) { hit = true; hurt(DMG[b.kind] || DMG.shot, b.x, b.y, b.src); }
        } else for (var w = 0; w < 2; w++) {
          if (P.wing[w] && (b.x - P.wx[w]) * (b.x - P.wx[w]) + (b.y - P.wy[w]) * (b.y - P.wy[w]) < (WR + 3) * (WR + 3)) { hit = true; wingLost(w, b.x, b.y); break; }
        }
        if (hit) S.bullets.splice(i, 1);
        if (S.over || P.dead) return;
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
      S.clearBonus = Math.round(P.energy) * 10 + P.loops * 300 + (S.lostHere === 0 ? 1000 : 0);
      addScore(S.clearBonus);
      S.phase = 'clear'; S.phaseT = 2.8; S.bullets = []; S.air = [];
      emit('clear', { level: S.level, bonus: S.clearBonus });
    }

    function update(dt) {
      if (S.over) return;
      S.time += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.phase === 'clear') {
        movePlayer(dt); moveShots(dt); updatePickups(dt);
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
      // сценарий
      var sc = S.script.air;
      while (S.ai < sc.length && sc[S.ai].at <= S.dist) runEvent(sc[S.ai++]);
      for (var i = S.pending.length - 1; i >= 0; i--) if (S.pending[i].t <= S.time) { var f = S.pending[i].fn; S.pending.splice(i, 1); f(); }
      if (!S.boss && S.dist >= S.terrain.len) spawnBoss();
      moveShots(dt);
      updateAir(dt); if (S.over) return;
      updateGround(dt);
      updateBoss(dt); if (S.phase === 'clear') return;
      updateBullets(dt); if (S.over) return;
      updatePickups(dt);
    }

    var api = {
      start: function () { setupLevel(); return api; },
      update: update,
      setDir: function (dx, dy) { dirX = dx > 0 ? 1 : dx < 0 ? -1 : 0; dirY = dy > 0 ? 1 : dy < 0 ? -1 : 0; },
      setFire: function (v) { fire = !!v; },
      fire: function () { return playerFire(); },
      loop: function () { return doLoop(); },
      state: function () { return S; },
      _S: S,
      // для тестов и бота
      _setupLevel: function (n) { S.level = n; setupLevel(); return S; },
      _spawnAir: spawnAir, _spawnGround: function (type, x, wy, dir) { return activateGround({ type: type, x: x, wy: wy, dir: dir }); },
      _spawnBoss: spawnBoss, _hurt: hurt, _pickup: pickup, _drop: drop, _aimShot: aimShot,
      _isLand: function (x, wy) { return isLand(S.terrain, x, wy); }, _sy: sy, _runEvent: runEvent, _finish: finishLevel
    };
    return api;
  }

  E.Game = Game;
  E.logic = {
    W: W, H: H, TOP: TOP, PX0: PX0, PX1: PX1, PY0: PY0, PY1: PY1, SCROLL: SCROLL, ROW: ROW,
    PLAYER_V: PLAYER_V, SHOT_V: SHOT_V, FIRE_CD: FIRE_CD, PR: PR, WR: WR, WING_DX: WING_DX, WING_DY: WING_DY,
    EMAX: EMAX, LOOPS: LOOPS, LOOP_T: LOOP_T, LOOP_MAX: LOOP_MAX, POWER_MAX: POWER_MAX, DMG: DMG, FUEL_ADD: FUEL_ADD,
    BOSS_Y: BOSS_Y, HULL_HL: HULL_HL, HULL_HW: HULL_HW, EXTRA_LIFE: EXTRA_LIFE, PTS: PTS, RADIUS: RADIUS, BLIMP: BLIMP, BOAT: BOAT,
    LEVELS: LEVELS, SLOTS: SLOTS, FUNNELS: FUNNELS, DROPS: DROPS,
    params: params, makeTerrain: makeTerrain, makeScript: makeScript, isLand: isLand, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
