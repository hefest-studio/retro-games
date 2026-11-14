/* СБОРКА · логика боя без DOM: конструктор роботов, экономика заводов, поиск пути по рельефу, приказы, бой,
   захват заводов, ИИ Ржавой Артели. Состояние S — простой объект (сериализуется в JSON для сохранения боя).
   SBORKA.Game(opts) · SBORKA.logic (константы, конструктор, A*). Сторона 0 — мастерская «Гефест», 1 — Ржавая Артель. */
(function (global) {
  'use strict';
  var SB = global.SBORKA = global.SBORKA || {};
  var MP = SB.maps, T = MP.T, TS = MP.TS, FT = MP.FT;

  // ---------- Конструктор ----------
  var RES = ['metal', 'energy', 'drive', 'arms', 'chips'];
  // pass[тип клетки] — множитель скорости (0 — не проехать): ЗЕМЛЯ, КАМНИ, БОЛОТО, СКАЛА, ДОРОГА
  var CHASSIS = {
    wheels: { cost: { metal: 2, drive: 1 }, hp: 8, speed: 74, pass: [1, 0, 0, 0, 1.3], r: 6 },
    tracks: { cost: { metal: 4, drive: 2 }, hp: 15, speed: 46, pass: [1, 0.75, 0, 0, 1.1], r: 7 },
    hover: { cost: { metal: 3, drive: 2, energy: 3 }, hp: 10, speed: 60, pass: [1, 0.9, 1, 0, 1.1], r: 6 }
  };
  var WEAPON = {
    hammer: { cost: { metal: 2, arms: 1 }, range: 96, dmg: 2, cd: 1.0, kind: 'shell', speed: 280, weight: 0.05 },
    rocket: { cost: { metal: 1, arms: 2, energy: 1 }, range: 150, dmg: 3, cd: 2.1, kind: 'rocket', speed: 190, splash: 18, weight: 0.07 },
    beam: { cost: { energy: 2, arms: 1 }, range: 62, dmg: 1, cd: 0.3, kind: 'beam', weight: 0.03 },
    core: { cost: { metal: 3, energy: 4, arms: 2, chips: 1 }, kind: 'core', weight: 0.08 }
  };
  var BRAIN = {
    none: { cost: {}, sight: 110, acc: 0.72 },
    basic: { cost: { chips: 1, energy: 1 }, sight: 150, acc: 0.86 },
    smart: { cost: { chips: 2, energy: 2 }, sight: 200, acc: 0.95 }
  };
  var CH_LIST = ['wheels', 'tracks', 'hover'], W_LIST = [null, 'hammer', 'rocket', 'beam', 'core'], BR_LIST = ['none', 'basic', 'smart'];
  var ORDERS = ['capture', 'robots', 'factories', 'guard', 'follow'];
  // Производство: секунд на 1 единицу ресурса. База даёт всё понемногу — дешёвый робот собирается всегда (нет тупика).
  var PROD = {
    base: { metal: 2.5, energy: 3, drive: 7, arms: 7, chips: 18 },
    metal: { metal: 2 }, energy: { energy: 2 }, drive: { drive: 3.5 }, arms: { arms: 3.5 }, chips: { chips: 5 }
  };
  var CAP_T = { base: 28, other: 7 }, CAP_R = { base: 30, other: 22 };
  var RES_MAX = 99, ROBOT_CAP = 24, RUIN_T = 45, DISABLE_T = 40, HOLD_ALL_T = 90;
  var START_RES = { metal: 20, energy: 12, drive: 6, arms: 6, chips: 3 };
  var TURRET = { range: 130, dmg: 3, cd: 1.0 };

  function add(a, b, k) { for (var r in b) a[r] = (a[r] || 0) + b[r] * (k == null ? 1 : k); return a; }
  function norm(d) { var w = (d.w || []).slice(0, 3); while (w.length < 3) w.push(null); return { chassis: d.chassis, w: w, brain: d.brain || 'none' }; }
  function costOf(d) {
    d = norm(d); var c = {}; RES.forEach(function (r) { c[r] = 0; });
    if (CHASSIS[d.chassis]) add(c, CHASSIS[d.chassis].cost);
    d.w.forEach(function (k) { if (k && WEAPON[k]) add(c, WEAPON[k].cost); });
    if (BRAIN[d.brain]) add(c, BRAIN[d.brain].cost);
    return c;
  }
  function validate(d) {
    if (!d || !CHASSIS[d.chassis]) return { ok: false, why: 'chassis' };
    if ((d.w || []).length > 3) return { ok: false, why: 'slots' };
    var n = 0, cores = 0;
    for (var i = 0; i < (d.w || []).length; i++) { var k = d.w[i]; if (k == null) continue; if (!WEAPON[k]) return { ok: false, why: 'module' }; n++; if (k === 'core') cores++; }
    if (!n) return { ok: false, why: 'empty' };
    if (cores > 1) return { ok: false, why: 'cores' };
    if (d.brain && !BRAIN[d.brain]) return { ok: false, why: 'brain' };
    return { ok: true };
  }
  function stats(d) {
    d = norm(d); var ch = CHASSIS[d.chassis], br = BRAIN[d.brain], wt = 0, range = 0, dps = 0, guns = [], core = false;
    d.w.forEach(function (k) { if (!k) return; var w = WEAPON[k]; wt += w.weight; if (k === 'core') { core = true; return; } guns.push(k); range = Math.max(range, w.range); dps += w.dmg / w.cd; });
    return { hp: ch.hp + guns.length + (core ? 1 : 0), speed: ch.speed * (1 - wt), pass: ch.pass, r: ch.r, range: range, dps: dps,
      sight: br.sight, acc: br.acc, guns: guns, core: core, chassis: d.chassis, brain: d.brain };
  }
  function canAfford(res, c) { for (var r in c) if ((res[r] || 0) < c[r]) return false; return true; }
  var TPL = {
    scout: { chassis: 'wheels', w: ['hammer'], brain: 'none' },
    tank: { chassis: 'tracks', w: ['hammer', 'hammer'], brain: 'basic' },
    raider: { chassis: 'hover', w: ['beam', 'beam'], brain: 'basic' },
    sapper: { chassis: 'tracks', w: ['core', 'hammer'], brain: 'basic' },
    artillery: { chassis: 'tracks', w: ['rocket', 'rocket', 'hammer'], brain: 'smart' },
    lancer: { chassis: 'hover', w: ['rocket', 'beam'], brain: 'smart' }
  };
  var TPL_ORDER = { scout: 'capture', tank: 'robots', raider: 'capture', sapper: 'factories', artillery: 'robots', lancer: 'robots' };
  // Уровни ИИ: интервал сборки (с), множитель дохода, роботов на старте, очередь сборки, охрана базы
  var AI_LVL = [
    { int: 9, inc: 0.75, start: 1, tpl: ['scout', 'scout', 'tank', 'scout', 'tank', 'tank'], guard: 1 },
    { int: 7, inc: 0.9, start: 1, tpl: ['scout', 'scout', 'tank', 'scout', 'sapper', 'tank', 'raider'], guard: 1 },
    { int: 6, inc: 1.0, start: 2, tpl: ['scout', 'scout', 'tank', 'raider', 'sapper', 'artillery', 'tank'], guard: 2 },
    { int: 5, inc: 1.12, start: 2, tpl: ['scout', 'scout', 'raider', 'tank', 'artillery', 'sapper', 'tank', 'lancer'], guard: 2 },
    { int: 4, inc: 1.25, start: 2, tpl: ['scout', 'scout', 'raider', 'tank', 'artillery', 'sapper', 'lancer', 'tank'], guard: 3 }
  ];

  // ---------- Карта и путь ----------
  function tget(M, tx, ty) { return tx < 0 || ty < 0 || tx >= M.w || ty >= M.h ? T.CLIFF : M.t[ty * M.w + tx]; }
  function tileAt(M, x, y) { return tget(M, Math.floor(x / TS), Math.floor(y / TS)); }
  function heapPush(H, f, i) { H.push([f, i]); var k = H.length - 1; while (k > 0) { var p = (k - 1) >> 1; if (H[p][0] <= H[k][0]) break; var q = H[p]; H[p] = H[k]; H[k] = q; k = p; } }
  function heapPop(H) { var top = H[0], last = H.pop(); if (H.length) { H[0] = last; var k = 0; for (;;) { var l = 2 * k + 1, r = l + 1, m = k; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === k) break; var q = H[m]; H[m] = H[k]; H[k] = q; k = m; } } return top; }
  var DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  // A* по клеткам, 8 сторон без срезания углов; цена клетки = 1 / pass. Старт может быть непроходимым (сдвинуло толчком).
  function astar(M, sx, sy, gx, gy, pass) {
    var w = M.w, h = M.h, N = w * h;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h || sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    if (!pass[M.t[gy * w + gx]]) return null;
    var g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), H = [];
    var pmax = Math.max.apply(null, pass), hk = 1 / pmax, s = sy * w + sx, goal = gy * w + gx;
    g[s] = 0; heapPush(H, 0, s);
    while (H.length) {
      var c = heapPop(H)[1]; if (closed[c]) continue; closed[c] = 1; if (c === goal) break;
      var cx = c % w, cy = (c / w) | 0;
      for (var d = 0; d < 8; d++) {
        var nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var ni = ny * w + nx; if (closed[ni]) continue;
        var pn = pass[M.t[ni]]; if (!pn) continue;
        if (d >= 4 && (!pass[M.t[cy * w + nx]] || !pass[M.t[ny * w + cx]])) continue;
        var ng = g[c] + (d >= 4 ? 1.4142 : 1) / pn;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = c; var ddx = Math.abs(nx - gx), ddy = Math.abs(ny - gy); heapPush(H, ng + (Math.max(ddx, ddy) + 0.4142 * Math.min(ddx, ddy)) * hk, ni); }
      }
    }
    if (!closed[goal]) return null;
    var out = [], k = goal; while (k >= 0) { out.push([k % w, (k / w) | 0]); if (k === s) break; k = from[k]; }
    return out.reverse();
  }
  // проходим ли отрезок (центр и два боковых смещения на rad), с шагом 4 px
  function walkable(M, x0, y0, x1, y1, pass, rad) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(L / 4)), nx = L ? -dy / L * (rad || 0) : 0, ny = L ? dx / L * (rad || 0) : 0;
    for (var i = 0; i <= n; i++) {
      var x = x0 + dx * i / n, y = y0 + dy * i / n;
      if (!pass[tileAt(M, x, y)] || !pass[tileAt(M, x + nx, y + ny)] || !pass[tileAt(M, x - nx, y - ny)]) return false;
    }
    return true;
  }
  function findPath(M, x0, y0, x1, y1, pass, rad) {
    var p = astar(M, Math.floor(x0 / TS), Math.floor(y0 / TS), Math.floor(x1 / TS), Math.floor(y1 / TS), pass);
    if (!p) return null;
    var pts = p.map(function (q) { return { x: q[0] * TS + TS / 2, y: q[1] * TS + TS / 2 }; });
    pts[pts.length - 1] = { x: x1, y: y1 };
    var out = [], ax = x0, ay = y0, i = 0;
    while (i < pts.length) {
      var j = pts.length - 1;
      while (j > i && !walkable(M, ax, ay, pts[j].x, pts[j].y, pass, rad || 4)) j--;
      out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; i = j + 1;
    }
    return out;
  }

  function mulberry32(a) { return MP.mulberry32(a); }
  function D(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var S, onEvent = opts.onEvent || function () {}, comp = {}, byId = {}, hash = {}, HC = 64;
    function emit(t, d) { try { onEvent(t, d || {}); } catch (e) { /* звук/эффекты не должны ронять логику */ } }
    function rnd() { S.rs = (S.rs + 0x6D2B79F5) | 0; var t = Math.imul(S.rs ^ S.rs >>> 15, 1 | S.rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

    function init() {
      var spec = opts.spec || MP.MAPS[0], map = opts.map || MP.genMap(spec), lvl = AI_LVL[Math.max(0, Math.min(4, spec.lvl | 0))];
      S = { v: 1, spec: spec, map: { w: map.w, h: map.h, t: Array.prototype.slice.call(map.t), biome: map.biome || spec.biome || 'meadow' },
        time: 0, phase: 'play', phaseT: 0, winner: -1, rs: (opts.seed != null ? opts.seed : spec.seed) | 0,
        res: [Object.assign({}, START_RES), Object.assign({}, START_RES)], inc: [opts.playerInc || 1, lvl.inc],
        factories: [], robots: [], shots: [], booms: [], nextId: 1, ship: { x: 0, y: 0 }, poss: null, drive: { x: 0, y: 0, fire: false },
        stats: { built: [0, 0], lost: [0, 0], caps: [0, 0], kills: [0, 0] }, allT: [0, 0], ai: {}, aiSides: opts.aiSides || [1], lvl: spec.lvl | 0,
        invuln: !!opts.invuln, mapVer: 1, result: null };
      map.factories.forEach(function (f, i) {
        var s = FT[f.type], pt = {};
        for (var r in PROD[f.type]) pt[r] = PROD[f.type][r] * (0.5 + 0.5 * ((i * 7 + r.length) % 5) / 5);
        S.factories.push({ id: i + 1, type: f.type, tx: f.tx, ty: f.ty, w: s.w, h: s.h, x: (f.tx + s.w / 2) * TS, y: (f.ty + s.h / 2) * TS,
          owner: f.owner, cap: { side: -1, prog: 0 }, pt: pt, ruinT: 0, disT: 0, tcd: 0 });
      });
      buildComp();
      var pb = baseOf(0); S.ship = { x: pb ? pb.x + 40 : 100, y: pb ? pb.y - 40 : 100 };
      // стартовые роботы: игроку — разведчик, Артели — по уровню
      if (opts.startRobots !== false) {
        spawn(0, TPL.scout, baseOf(0), 'capture'); spawn(0, TPL.tank, baseOf(0), 'guard');
        for (var k = 0; k < lvl.start; k++) spawn(1, k === 0 ? TPL.scout : TPL.tank, baseOf(1), k === 0 ? 'capture' : 'robots');
        S.stats.built = [0, 0];
      }
    }
    function baseOf(side) { for (var i = 0; i < S.factories.length; i++) { var f = S.factories[i]; if (f.type === 'base' && f.owner === side) return f; } return null; }
    function homeBase(side) { for (var i = 0; i < S.factories.length; i++) { var f = S.factories[i]; if (f.type === 'base' && f.id === side + 1) return f; } return null; }
    function buildComp() { comp = {}; CH_LIST.forEach(function (c) { comp[c] = MP.components(S.map.w, S.map.h, S.map.t, CHASSIS[c].pass); }); }
    function compAt(ch, x, y) { var tx = Math.floor(x / TS), ty = Math.floor(y / TS); if (tx < 0 || ty < 0 || tx >= S.map.w || ty >= S.map.h) return -1; return comp[ch][ty * S.map.w + tx]; }
    function reach(r, x, y) { var a = r.comp, b = compAt(r.st.chassis, x, y); return a >= 0 && a === b; }

    // ---------- Сборка ----------
    function freeSpot(st, f, k) {
      for (var i = 0; i < 40; i++) {
        var a = (k + i) * 2.39996, d = 6 + i * 2.2, x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d;
        if (st.pass[tileAt(S.map, x, y)]) return { x: x, y: y };
      }
      return { x: f.x, y: f.y };
    }
    function spawn(side, design, f, order) {
      var d = norm(design), st = stats(d), p = freeSpot(st, f, S.nextId);
      var r = { id: S.nextId++, side: side, d: d, st: st, x: p.x, y: p.y, hp: st.hp, max: st.hp, order: { kind: order || 'capture', x: p.x, y: p.y },
        path: null, pi: 0, pathT: -99, goal: null, tgt: null, cd: [0.3, 0.6, 0.9], core: st.core, ang: side ? Math.PI * 0.75 : -Math.PI * 0.25,
        moving: false, hold: false, thinkT: 0, stuckT: 0, stuckSum: 0, lx: p.x, ly: p.y, comp: -1, capF: null, flash: 0, dead: false, home: f.id };
      r.comp = compAt(st.chassis, r.x, r.y);
      S.robots.push(r); byId[r.id] = r; S.stats.built[side]++;
      return r;
    }
    function build(side, design, fid, order) {
      var v = validate(design); if (!v.ok) return { ok: false, why: v.why };
      var f = fid ? S.factories.filter(function (q) { return q.id === fid; })[0] : baseOf(side);
      if (!f || f.owner !== side || f.ruinT > 0) return { ok: false, why: 'factory' };
      if (S.robots.filter(function (q) { return q.side === side && !q.dead; }).length >= ROBOT_CAP) return { ok: false, why: 'cap' };
      var c = costOf(design); if (!canAfford(S.res[side], c)) return { ok: false, why: 'res' };
      add(S.res[side], c, -1);
      var r = spawn(side, design, f, order || TPL_ORDER[tplName(design)] || 'capture');
      emit('build', { side: side, id: r.id, x: r.x, y: r.y });
      return { ok: true, robot: r };
    }
    function tplName(d) { d = norm(d); for (var k in TPL) { var t = norm(TPL[k]); if (t.chassis === d.chassis && t.brain === d.brain && t.w.join() === d.w.join()) return k; } return null; }

    // ---------- Приказы ----------
    function order(ids, kind, x, y) {
      if (ORDERS.indexOf(kind) < 0) return 0; var n = 0;
      (Array.isArray(ids) ? ids : [ids]).forEach(function (id) {
        var r = byId[id]; if (!r || r.dead) return;
        r.order = { kind: kind, x: x != null ? x : r.x, y: y != null ? y : r.y }; r.path = null; r.goal = null; r.tgt = null; r.thinkT = 0; r.capF = null; n++;
      });
      if (n) emit('order', { kind: kind, n: n });
      return n;
    }

    // ---------- Пространственный хеш ----------
    function rehash() {
      hash = {}; byId = {};
      for (var i = 0; i < S.robots.length; i++) {
        var r = S.robots[i]; if (r.dead) continue; byId[r.id] = r;
        var k = ((r.x / HC) | 0) + ',' + ((r.y / HC) | 0); (hash[k] || (hash[k] = [])).push(r);
      }
    }
    function near(x, y, rad, fn) {
      var x0 = ((x - rad) / HC) | 0, x1 = ((x + rad) / HC) | 0, y0 = ((y - rad) / HC) | 0, y1 = ((y + rad) / HC) | 0;
      for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) { var a = hash[cx + ',' + cy]; if (a) for (var i = 0; i < a.length; i++) fn(a[i]); }
    }
    function nearestEnemy(r, rad, weakest) {
      var best = null, bd = 1e9;
      near(r.x, r.y, rad, function (q) {
        if (q.side === r.side || q.dead) return; var d = Math.hypot(q.x - r.x, q.y - r.y); if (d > rad) return;
        var w = weakest ? d * 0.5 + q.hp * 12 : d; if (w < bd) { bd = w; best = q; }
      });
      return best;
    }

    // ---------- Движение ----------
    function setGoal(r, x, y) {
      var gt = Math.floor(x / TS) + ',' + Math.floor(y / TS);
      if (r.goal === gt && r.path && S.time - r.pathT < 4) return true;
      if (r.goal === gt && !r.path && S.time - r.pathT < 2) return false;   // недостижимо — не долбить A*
      r.goal = gt; r.pathT = S.time;
      var p = findPath(S.map, r.x, r.y, x, y, r.st.pass, r.st.r - 2);
      r.path = p && p.length ? p : null; r.pi = 0;
      return !!r.path;
    }
    function stop(r) { r.path = null; r.goal = null; r.moving = false; }
    function moveStep(r, dt) {
      r.moving = false;
      if (S.poss === r.id) {
        var dv = S.drive, L = Math.hypot(dv.x, dv.y); if (!L) return;
        var sp = r.st.speed * (r.st.pass[tileAt(S.map, r.x, r.y)] || 0.5) * dt, nx = r.x + dv.x / L * sp, ny = r.y + dv.y / L * sp;
        r.ang = Math.atan2(dv.y, dv.x);
        if (okAt(r, nx, r.y)) r.x = nx; if (okAt(r, r.x, ny)) r.y = ny; r.moving = true; return;
      }
      if (!r.path || r.pi >= r.path.length) { r.path = null; return; }
      var p = r.path[r.pi], dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy);
      var spd = r.st.speed * Math.max(0.35, r.st.pass[tileAt(S.map, r.x, r.y)] || 0.5) * dt;
      if (d <= spd) { r.x = p.x; r.y = p.y; r.pi++; } else { r.x += dx / d * spd; r.y += dy / d * spd; }
      if (d > 0.01) { var ta = Math.atan2(dy, dx), da = Math.atan2(Math.sin(ta - r.ang), Math.cos(ta - r.ang)); r.ang += da * Math.min(1, dt * 10); }
      r.moving = true;
    }
    function okAt(r, x, y) { var rr = r.st.r - 2; return !!(r.st.pass[tileAt(S.map, x + rr, y)] && r.st.pass[tileAt(S.map, x - rr, y)] && r.st.pass[tileAt(S.map, x, y + rr)] && r.st.pass[tileAt(S.map, x, y - rr)]); }
    function separate() {
      for (var k in hash) {
        var a = hash[k];
        for (var i = 0; i < a.length; i++) {
          var r = a[i];
          near(r.x, r.y, 16, function (q) {
            if (q.id <= r.id) return; var dx = q.x - r.x, dy = q.y - r.y, d = Math.hypot(dx, dy), m = r.st.r + q.st.r - 1;
            if (d >= m) return; if (d < 0.01) { dx = ((r.id * 7) % 5) - 2 + 0.3; dy = ((q.id * 3) % 5) - 2 + 0.2; d = Math.hypot(dx, dy); }
            var push = (m - d) * 0.5, ux = dx / d * push, uy = dy / d * push;
            if (S.poss !== q.id && okAt(q, q.x + ux, q.y + uy)) { q.x += ux; q.y += uy; }
            if (S.poss !== r.id && okAt(r, r.x - ux, r.y - uy)) { r.x -= ux; r.y -= uy; }
          });
        }
      }
    }

    // ---------- Решения робота (раз в 0.3–0.5 с) ----------
    function enemySide(s) { return 1 - s; }
    // генеральный завод берётся, только пока его оборона выключена ядром (40 с)
    function capturable(f, side) {
      if (f.ruinT > 0 || f.owner === side) return false;
      if (f.type !== 'base' || f.owner < 0) return true;
      return f.disT > 0;
    }
    function pickFactory(r, pred) {
      var best = null, bd = 1e9;
      S.factories.forEach(function (f) {
        if (!pred(f) || !reach(r, f.x, f.y)) return;
        var crowd = 0; S.robots.forEach(function (q) { if (q !== r && !q.dead && q.side === r.side && q.capF === f.id) crowd++; });
        var d = D(r, f) + Math.max(0, crowd - 1) * 90 + (f.type === 'base' ? 150 : 0);
        if (d < bd) { bd = d; best = f; }
      });
      return best;
    }
    function goFactory(r, f) {
      r.capF = f.id;
      var a = r.id * 2.39996, rad = (f.type === 'base' ? 14 : 9) * ((r.id % 3) / 2);
      var gx = f.x + Math.cos(a) * rad, gy = f.y + Math.sin(a) * rad;
      if (!r.st.pass[tileAt(S.map, gx, gy)]) { gx = f.x; gy = f.y; }
      if (D(r, { x: gx, y: gy }) < 4) { stop(r); return; }
      setGoal(r, gx, gy);
    }
    function think(r) {
      var st = r.st, ord = r.order, kind = ord.kind, en = null;
      r.hold = false; r.capF = null;
      if (S.poss === r.id) { r.tgt = null; return; }
      if (st.brain === 'smart' && r.hp < r.max * 0.3) {   // умный мозг уводит подбитого на ремонт к базе
        var hb = baseOf(r.side); if (hb && D(r, hb) > 50 && reach(r, hb.x, hb.y)) { r.tgt = null; setGoal(r, hb.x, hb.y); return; }
      }
      if (st.range > 0) {
        var engR = (kind === 'robots' || kind === 'guard') ? st.sight : Math.min(st.sight, st.range + 24);
        en = nearestEnemy(r, engR, st.brain === 'smart');
        if (en && kind === 'guard' && D(en, ord) > 170) en = null;
      }
      r.tgt = en ? en.id : null;
      if (en) {
        var d = D(r, en);
        if (d <= st.range * 0.85) { r.hold = true; stop(r); return; }
        if (kind === 'robots' || kind === 'guard' || d <= st.range + 24) { if (setGoal(r, en.x, en.y)) return; }
      }
      var es = enemySide(r.side), f;
      if (kind === 'factories') {
        if (r.core) {
          f = pickFactory(r, function (q) { return q.owner === es && q.ruinT <= 0 && !(q.type === 'base' && q.disT > 0); });
          if (f) { if (D(r, f) < 20) detonate(r, f); else goFactory(r, f); return; }
        }
        f = pickFactory(r, function (q) { return q.owner === es && capturable(q, r.side); }) || pickFactory(r, function (q) { return capturable(q, r.side); });
        if (f) { goFactory(r, f); return; }
        stop(r); return;
      }
      if (kind === 'robots') {
        var tg = null;
        if (st.brain !== 'none') { var bd = 1e9; S.robots.forEach(function (q) { if (q.side === es && !q.dead && reach(r, q.x, q.y)) { var dd = D(r, q); if (dd < bd) { bd = dd; tg = q; } } }); }
        if (tg) { setGoal(r, tg.x, tg.y); return; }
        var eb = baseOf(es);
        if (st.brain === 'none' && eb && S.robots.some(function (q) { return q.side === es && !q.dead; }) && reach(r, eb.x, eb.y)) { if (D(r, eb) > 120) { setGoal(r, eb.x, eb.y); return; } }
        kind = 'capture';   // врагов нет — захватывать
      }
      if (kind === 'capture') {
        f = pickFactory(r, function (q) { return capturable(q, r.side); });
        if (f) { goFactory(r, f); return; }
        var eb2 = baseOf(es);   // брать нечего — осада базы противника (ждать, пока её оборону выключат)
        if (eb2 && reach(r, eb2.x, eb2.y) && D(r, eb2) > 150) { setGoal(r, eb2.x + (r.side ? 1 : -1) * 90, eb2.y + (r.side ? -1 : 1) * 60); return; }
        stop(r); return;
      }
      if (kind === 'guard') { if (D(r, ord) > 10) setGoal(r, ord.x, ord.y); else stop(r); return; }
      if (kind === 'follow') {
        var mates = S.robots.filter(function (q) { return !q.dead && q.side === r.side && q.order.kind === 'follow'; }), idx = mates.indexOf(r);
        var a = idx * 2.39996, rad = 18 + 7 * Math.sqrt(idx), gx = S.ship.x + Math.cos(a) * rad, gy = S.ship.y + Math.sin(a) * rad;
        if (D(r, { x: gx, y: gy }) > 14 && st.pass[tileAt(S.map, gx, gy)]) setGoal(r, gx, gy); else if (D(r, { x: gx, y: gy }) <= 14) stop(r);
      }
    }
    function detonate(r, f) {
      if (!r.core) return false;
      r.core = false;
      if (f.type === 'base') { f.disT = DISABLE_T; f.cap = { side: -1, prog: 0 }; }
      else { f.ruinT = RUIN_T; f.owner = -1; f.cap = { side: -1, prog: 0 }; }
      S.booms.push({ x: f.x, y: f.y, r: 34, t: 0.8, big: true });
      near(f.x, f.y, 34, function (q) { if (q.side !== r.side && D(q, f) < 34) hurt(q, 3, r.side); });
      emit('core', { x: f.x, y: f.y, base: f.type === 'base', side: r.side, fid: f.id });
      return true;
    }

    // ---------- Бой ----------
    function hurt(q, dmg, by) {
      if (q.dead) return;
      if (S.invuln && q.side === 0) return;
      q.hp -= dmg; q.flash = 0.15;
      if (q.hp <= 0) {
        q.dead = true; S.stats.lost[q.side]++; if (by >= 0) S.stats.kills[by]++;
        S.booms.push({ x: q.x, y: q.y, r: 16, t: 0.5 });
        if (S.poss === q.id) { S.poss = null; emit('possLost', {}); }
        emit('kill', { side: q.side, x: q.x, y: q.y, id: q.id });
      } else emit('hit', { side: q.side });
    }
    function fireWeapons(r, dt, tgt) {
      var st = r.st;
      for (var i = 0; i < st.guns.length; i++) {
        r.cd[i] -= dt; if (r.cd[i] > 0 || !tgt) continue;
        var w = WEAPON[st.guns[i]], d = D(r, tgt); if (d > w.range) continue;
        r.cd[i] = w.cd * (0.95 + rnd() * 0.1);
        r.ang = Math.atan2(tgt.y - r.y, tgt.x - r.x);
        if (w.kind === 'beam') { hurt(tgt, w.dmg, r.side); S.shots.push({ kind: 'beam', x: r.x, y: r.y, tx: tgt.x, ty: tgt.y, t: 0.12, side: r.side }); emit('beam', { side: r.side }); continue; }
        var miss = rnd() > st.acc, ox = miss ? (rnd() - 0.5) * 40 : 0, oy = miss ? (rnd() - 0.5) * 40 : 0;
        S.shots.push({ kind: w.kind, x: r.x, y: r.y, tid: miss ? 0 : tgt.id, tx: tgt.x + ox, ty: tgt.y + oy, dmg: w.dmg, spd: w.speed, splash: w.splash || 0, side: r.side, life: 2 });
        emit('shot', { kind: w.kind, side: r.side, x: r.x, y: r.y });
      }
    }
    function shotsStep(dt) {
      var out = [];
      for (var i = 0; i < S.shots.length; i++) {
        var s = S.shots[i];
        if (s.kind === 'beam') { s.t -= dt; if (s.t > 0) out.push(s); continue; }
        var tg = s.tid ? byId[s.tid] : null; if (tg && !tg.dead) { s.tx = tg.x; s.ty = tg.y; } else if (s.tid) s.tid = 0;
        var dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), m = s.spd * dt; s.life -= dt;
        if (d <= m + 3 || s.life <= 0) {
          if (tg && !tg.dead) hurt(tg, s.dmg, s.side);
          if (s.splash) near(s.tx, s.ty, s.splash, function (q) { if (q !== tg && q.side !== s.side && Math.hypot(q.x - s.tx, q.y - s.ty) < s.splash) hurt(q, 1, s.side); });
          S.booms.push({ x: s.tx, y: s.ty, r: s.splash ? 12 : 6, t: 0.3 });
          if (s.splash) emit('boom', { x: s.tx, y: s.ty });
          continue;
        }
        s.x += dx / d * m; s.y += dy / d * m; s.ang = Math.atan2(dy, dx); out.push(s);
      }
      S.shots = out;
    }

    // ---------- Заводы ----------
    function factoriesStep(dt) {
      for (var i = 0; i < S.factories.length; i++) {
        var f = S.factories[i];
        if (f.ruinT > 0) { f.ruinT -= dt; if (f.ruinT <= 0) { f.ruinT = 0; emit('rebuilt', { fid: f.id, x: f.x, y: f.y }); } continue; }
        if (f.disT > 0) f.disT = Math.max(0, f.disT - dt);
        if (f.owner >= 0 && f.disT <= 0) {
          var P = PROD[f.type], res = S.res[f.owner], k = S.inc[f.owner] || 1;
          for (var r in P) { f.pt[r] -= dt * k; if (f.pt[r] <= 0) { f.pt[r] += P[r]; if (res[r] < RES_MAX) res[r]++; } }
        }
        // захват: на площадке роботы только одной стороны
        var R = CAP_R[f.type === 'base' ? 'base' : 'other'], n = [0, 0];
        near(f.x, f.y, R, function (q) { if (!q.dead && Math.hypot(q.x - f.x, q.y - f.y) < R) n[q.side]++; });
        var c = f.cap;
        if ((n[0] > 0) !== (n[1] > 0)) {
          var s = n[0] > 0 ? 0 : 1, cnt = n[s];
          if (f.owner === s || !capturable(f, s)) { c.prog = Math.max(0, c.prog - dt * 2); }
          else if (c.side !== s && c.prog > 0) { c.prog = Math.max(0, c.prog - dt * 2); }
          else {
            c.side = s; c.prog += dt * (1 + 0.25 * Math.min(4, cnt - 1));
            if (c.prog >= CAP_T[f.type === 'base' ? 'base' : 'other']) {
              var old = f.owner; f.owner = s; c.prog = 0; c.side = -1; f.disT = 0; S.stats.caps[s]++;
              emit('capture', { fid: f.id, side: s, from: old, type: f.type, x: f.x, y: f.y });
            }
          }
        } else if (!n[0] && !n[1]) c.prog = Math.max(0, c.prog - dt * 0.5);
        // база: турель и ремонт своих
        if (f.type === 'base' && f.owner >= 0 && f.disT <= 0) {
          f.tcd -= dt;
          var own = f.owner, tg = null, bd = TURRET.range;
          near(f.x, f.y, TURRET.range, function (q) { if (q.dead) return; var d = Math.hypot(q.x - f.x, q.y - f.y); if (q.side !== own && d < bd) { bd = d; tg = q; } else if (q.side === own && d < 56 && q.hp < q.max) q.hp = Math.min(q.max, q.hp + 0.7 * dt); });
          if (tg && f.tcd <= 0) { f.tcd = TURRET.cd; S.shots.push({ kind: 'shell', x: f.x, y: f.y - 6, tid: tg.id, tx: tg.x, ty: tg.y, dmg: TURRET.dmg, spd: 300, splash: 0, side: own, life: 2, turret: true }); emit('shot', { kind: 'turret', side: own, x: f.x, y: f.y }); }
        }
      }
    }
    function checkEnd(dt) {
      if (S.phase !== 'play') { S.phaseT += dt; return; }
      var w = -1;
      for (var s = 0; s < 2; s++) {
        var hb = homeBase(1 - s); if (hb && hb.owner === s) w = s;
        var others = S.factories.filter(function (f) { return f.type !== 'base' && f.ruinT <= 0; });
        if (others.length && others.every(function (f) { return f.owner === s; })) S.allT[s] += dt; else S.allT[s] = 0;
        if (S.allT[s] >= HOLD_ALL_T) w = s;
      }
      if (w < 0) return;
      S.phase = w === 0 ? 'won' : 'lost'; S.winner = w; S.phaseT = 0; S.poss = null;
      S.result = { won: w === 0, time: S.time, built: S.stats.built.slice(), lost: S.stats.lost.slice(), caps: S.stats.caps.slice(), kills: S.stats.kills.slice(), how: homeBase(1 - w).owner === w ? 'base' : 'all' };
      emit(w === 0 ? 'won' : 'lost', S.result);
    }

    // ---------- ИИ Артели ----------
    function aiStep(side, dt) {
      var A = S.ai[side] || (S.ai[side] = { t: 0.5, next: 1, n: 0, wait: 0, threatT: 0 });
      var L = AI_LVL[Math.max(0, Math.min(4, S.lvl))];
      A.t -= dt; if (A.t > 0) return; A.t = 1.2 + rnd() * 0.6;
      var my = S.robots.filter(function (q) { return !q.dead && q.side === side; }), es = 1 - side, base = baseOf(side);
      if (!base) return;
      // сборка
      if (S.time >= A.next && my.length < ROBOT_CAP) {
        var name = L.tpl[A.n % L.tpl.length], res = S.res[side];
        if (!canAfford(res, costOf(TPL[name]))) { A.wait += 1.5; if (A.wait > 8) name = 'scout'; }
        if (canAfford(res, costOf(TPL[name]))) {
          var guards = my.filter(function (q) { return q.order.kind === 'guard'; }).length;
          var ord = TPL_ORDER[name]; if (guards < L.guard && name === 'tank') ord = 'guard';
          else if (ord === 'robots' && S.time < 150 && S.factories.some(function (f) { return f.owner < 0 && f.ruinT <= 0; })) ord = 'capture';
          var b = build(side, TPL[name], base.id, ord);
          if (b.ok) { if (ord === 'guard') { var ga = guards * 2.1; b.robot.order.x = base.x + Math.cos(ga) * 10; b.robot.order.y = base.y + Math.sin(ga) * 10; } A.n++; A.wait = 0; A.next = S.time + L.int * (0.85 + rnd() * 0.3); }
        }
      }
      // угроза базе — ближние на защиту
      var threat = S.robots.some(function (q) { return !q.dead && q.side === es && D(q, base) < 170; });
      if (threat) { my.forEach(function (q) { if (D(q, base) < 380 && q.order.kind !== 'robots' && q.order.kind !== 'factories') { q.order = { kind: 'robots', x: q.x, y: q.y, tmp: q.order }; q.thinkT = 0; } }); A.threatT = 8; }
      else if (A.threatT > 0) { A.threatT -= 1.5; if (A.threatT <= 0) my.forEach(function (q) { if (q.order.tmp) { q.order = q.order.tmp; q.thinkT = 0; } }); }
      // натиск: накопилось — половина «охотников» идёт захватывать (в т.ч. базу противника)
      var hunters = my.filter(function (q) { return q.order.kind === 'robots' && !q.order.tmp; });
      if (hunters.length >= 4 + (4 - S.lvl) && rnd() < 0.15) hunters.slice(0, hunters.length >> 1).forEach(function (q) { q.order = { kind: 'capture', x: q.x, y: q.y }; q.thinkT = 0; });
    }

    // ---------- Шаг ----------
    function step(dt) {
      S.time += dt;
      rehash();
      if (S.phase === 'play') for (var a = 0; a < S.aiSides.length; a++) aiStep(S.aiSides[a], dt);
      for (var i = 0; i < S.robots.length; i++) {
        var r = S.robots[i]; if (r.dead) continue;
        if (r.flash > 0) r.flash -= dt;
        if (S.phase === 'play') { r.thinkT -= dt; if (r.thinkT <= 0) { r.thinkT = 0.3 + rnd() * 0.2; think(r); } }
        var tg = r.tgt ? byId[r.tgt] : null; if (tg && tg.dead) { tg = null; r.tgt = null; }
        if (S.poss === r.id) { tg = S.drive.fire ? nearestEnemy(r, r.st.range || 1, false) : null; }
        if (r.hold && tg && D(r, tg) > r.st.range) { r.hold = false; r.thinkT = 0; }
        if (S.phase === 'play') fireWeapons(r, dt, tg);
        if (!r.hold && S.phase === 'play') moveStep(r, dt); else r.moving = false;
        // застревание: хочет ехать, но стоит — перепрокладка
        if (r.path && S.poss !== r.id) {
          var mv = Math.hypot(r.x - r.lx, r.y - r.ly);
          if (mv < r.st.speed * dt * 0.15) { r.stuckT += dt; r.stuckSum += dt; if (r.stuckT > 1.2) { r.stuckT = 0; r.goal = null; r.path = null; r.thinkT = 0; } } else r.stuckT = 0;
        } else r.stuckT = 0;
        r.lx = r.x; r.ly = r.y;
        var c = compAt(r.st.chassis, r.x, r.y); if (c >= 0) r.comp = c;
      }
      separate();
      shotsStep(dt);
      rehash();
      factoriesStep(dt);
      for (var b = S.booms.length - 1; b >= 0; b--) { S.booms[b].t -= dt; if (S.booms[b].t <= 0) S.booms.splice(b, 1); }
      if (S.robots.some(function (q) { return q.dead; })) S.robots = S.robots.filter(function (q) { return !q.dead; });
      checkEnd(dt);
    }

    if (opts.restore) { S = opts.restore; S.robots.forEach(function (r) { r.st = stats(r.d); }); } else init();
    buildComp(); rehash();
    S.robots.forEach(function (r) { r.comp = compAt(r.st.chassis, r.x, r.y); });

    var api = {
      state: function () { return S; },
      update: function (dt) { var n = Math.max(1, Math.ceil(dt / (1 / 30) - 1e-6)); for (var i = 0; i < n; i++) step(dt / n); },
      build: build, order: order,
      setShip: function (x, y) { S.ship.x = Math.max(0, Math.min(S.map.w * TS, x)); S.ship.y = Math.max(0, Math.min(S.map.h * TS, y)); },
      possess: function (id) { var r = byId[id]; if (!r || r.dead || r.side !== 0 || S.phase !== 'play') return false; S.poss = id; stop(r); r.hold = false; r.tgt = null; emit('possess', { id: id }); return true; },
      release: function () { if (S.poss == null) return false; var r = byId[S.poss]; S.poss = null; S.drive = { x: 0, y: 0, fire: false }; if (r) { r.order = { kind: 'guard', x: r.x, y: r.y }; r.thinkT = 0; } emit('release', {}); return true; },
      drive: function (x, y, fire) { S.drive.x = x; S.drive.y = y; S.drive.fire = !!fire; },
      detonate: function () {   // прямое управление: подорвать ядро у вражеского завода
        var r = S.poss != null ? byId[S.poss] : null; if (!r || !r.core) return false;
        var f = S.factories.filter(function (q) { return q.owner === 1 - r.side && q.ruinT <= 0 && D(q, r) < 30; })[0];
        if (!f) { emit('noTarget', {}); return false; }
        return detonate(r, f);
      },
      robot: function (id) { return byId[id] || null; },
      robotAt: function (x, y, side, rad) { var best = null, bd = rad || 14; S.robots.forEach(function (q) { if (q.dead || (side != null && q.side !== side)) return; var d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = q; } }); return best; },
      factoryAt: function (x, y) { return S.factories.filter(function (f) { return Math.abs(x - f.x) < f.w * TS / 2 + 4 && Math.abs(y - f.y) < f.h * TS / 2 + 4; })[0] || null; },
      baseOf: baseOf, reach: function (r, x, y) { return reach(r, x, y); }, compAt: compAt,
      snapshot: function () { var o = JSON.parse(JSON.stringify(S)); o.robots.forEach(function (r) { delete r.st; }); return o; },
      _spawn: function (side, design, x, y, ord) { var r = spawn(side, design, { x: x, y: y, id: 0 }, ord); r.x = x; r.y = y; r.comp = compAt(r.st.chassis, x, y); return r; },
      _hurt: hurt, _think: think, _detonate: detonate, _rehash: rehash
    };
    return api;
  }

  SB.Game = Game;
  SB.logic = { TS: TS, T: T, RES: RES, CHASSIS: CHASSIS, WEAPON: WEAPON, BRAIN: BRAIN, CH_LIST: CH_LIST, W_LIST: W_LIST, BR_LIST: BR_LIST, ORDERS: ORDERS,
    PROD: PROD, CAP_T: CAP_T, CAP_R: CAP_R, ROBOT_CAP: ROBOT_CAP, RES_MAX: RES_MAX, RUIN_T: RUIN_T, DISABLE_T: DISABLE_T, HOLD_ALL_T: HOLD_ALL_T, START_RES: START_RES,
    TURRET: TURRET, TPL: TPL, TPL_ORDER: TPL_ORDER, AI_LVL: AI_LVL,
    norm: norm, costOf: costOf, validate: validate, stats: stats, canAfford: canAfford, astar: astar, findPath: findPath, walkable: walkable, tileAt: tileAt, tget: tget, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
