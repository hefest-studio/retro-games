/* ГАТЬ · логика без DOM (детерминированная, фикс-шаг). GAT.logic.
   Карта — сетка клеток TILE px: вода (непроходимо), суша, мель (медленно), гать (мостки, быстро), чаща (непроходимо),
   камыш (медленно), омут (точка появления нечисти). Отряд (squad) — группа бойцов, управляется как единица:
   у отряда «якорь» идёт по пути A*, бойцы держат места в строю относительно якоря и направления движения.
   Герой — тоже «отряд» из одного бойца (единые приказы/выбор). Вехи (points) — аванпосты: захват, доход,
   найм/улучшение отрядов, одна постройка. Нечисть: стража гнёзд, волны из омутов, мини-босс. */
(function (root) {
  'use strict';
  var GAT = root.GAT = root.GAT || {};
  var TILE = 32;
  var WATER = 0, LAND = 1, SHALLOW = 2, GATT = 3, THICKET = 4, REEDS = 5, POOL = 6;
  var COST = [Infinity, 1, 1.7, 0.85, Infinity, 1.3, 1.2];
  var SPEED = [0, 1, 0.62, 1.2, 0, 0.8, 0.8];

  // ---------- типы ----------
  var SQUADS = {
    bow: { n: 4, cost: 80, unit: 'bow' },
    shield: { n: 5, cost: 90, unit: 'shield' },
    cart: { n: 3, cost: 130, unit: 'cart' },
  };
  var KINDS = {
    bow: { hp: 44, dmg: 5, range: 150, rate: 1.2, speed: 46, r: 8 },
    shield: { hp: 85, dmg: 5, range: 24, rate: 1.1, speed: 44, r: 9, armor: 0.35 },
    cart: { hp: 100, dmg: 11, range: 185, rate: 2.2, speed: 54, r: 11, splash: 34, armor: 0.15 },
    hero_v: { hp: 240, dmg: 10, range: 160, rate: 0.9, speed: 58, r: 11 },
    hero_z: { hp: 360, dmg: 16, range: 30, rate: 0.9, speed: 58, r: 12, armor: 0.2 },
    kochkar: { hp: 60, dmg: 6, range: 22, rate: 1.0, speed: 40, r: 9, xp: 10, bounty: 3 },
    plevun: { hp: 40, dmg: 5, range: 130, rate: 1.3, speed: 38, r: 8, xp: 12, bounty: 3 },
    tinnik: { hp: 200, dmg: 13, range: 28, rate: 1.4, speed: 30, r: 13, armor: 0.25, xp: 25, bounty: 6 },
    nest: { hp: 1100, dmg: 0, range: 0, rate: 1, speed: 0, r: 22, armor: 0.3, xp: 40, bounty: 40, still: true },
    koryazhnik: { hp: 5200, dmg: 24, range: 42, rate: 2.2, speed: 26, r: 26, splash: 70, armor: 0.25, xp: 200, bounty: 0, boss: true },
    kamyshnitsa: { hp: 5600, dmg: 16, range: 170, rate: 1.4, speed: 28, r: 22, splash: 40, armor: 0.15, xp: 200, bounty: 0, boss: true },
    omutnik: { hp: 7200, dmg: 30, range: 46, rate: 2.4, speed: 24, r: 28, splash: 70, armor: 0.3, xp: 200, bounty: 0, boss: true },
  };
  var BUILD = { tower: 60, fire: 50, barn: 60 };
  var HEROES = [
    { id: 'v', kind: 'hero_v', q: { cd: 10, range: 300, r: 75, dmg: 55, up: 15 }, e: { cd: 15, r: 170, heal: 45, up: 10 } },
    { id: 'z', kind: 'hero_z', q: { cd: 8, range: 260, r: 60, dmg: 45, up: 12 }, e: { cd: 18, r: 190, dur: 6, heal: 50 } },
  ];
  var XP_LVL = [0, 50, 130, 250, 420];
  var MAX_SQUADS = 4, POINT_R = 96, CAPTURE_T = 5, LOSE_T = 10;

  // ---------- утилиты ----------
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function d2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function dist(a, b) { return Math.sqrt(d2(a.x, a.y, b.x, b.y)); }

  // ---------- карта ----------
  function genMap(m) {
    var W = m.w, H = m.h, r = rng(m.seed), g = new Uint8Array(W * H), x, y, i;
    m.isles.forEach(function (is) {
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var dx = (x + 0.5 - is.x) / is.rx, dy = (y + 0.5 - is.y) / is.ry;
        if (dx * dx + dy * dy < 1 + (r() - 0.5) * 0.4) g[y * W + x] = LAND;
      }
    });
    var rim = [];
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g[y * W + x] === WATER) {
      var near = false;
      for (var oy = -1; oy <= 1 && !near; oy++) for (var ox = -1; ox <= 1; ox++) { var xx = x + ox, yy = y + oy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && g[yy * W + xx] === LAND) { near = true; break; } }
      if (near && r() < 0.85) rim.push(y * W + x);
    }
    rim.forEach(function (k) { g[k] = SHALLOW; });
    function line(a, b, t) {
      var A = m.isles[a], B = m.isles[b], len = Math.hypot(B.x - A.x, B.y - A.y), nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
      for (var s = 0; s <= len; s += 0.25) {
        var cx = A.x + (B.x - A.x) * s / len, cy = A.y + (B.y - A.y) * s / len;
        for (var o = -0.45; o <= 0.46; o += 0.9) {
          var tx = Math.floor(cx + nx * o), ty = Math.floor(cy + ny * o);
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
          var k = ty * W + tx; if (g[k] === WATER || (t === GATT && g[k] === SHALLOW)) g[k] = t;
        }
      }
    }
    (m.gat || []).forEach(function (p) { line(p[0], p[1], GATT); });
    (m.ford || []).forEach(function (p) { line(p[0], p[1], SHALLOW); });
    // камыш у мелей
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      i = y * W + x;
      if (g[i] === LAND && (g[i - 1] === SHALLOW || g[i + 1] === SHALLOW || g[i - W] === SHALLOW || g[i + W] === SHALLOW) && r() < 0.28) g[i] = REEDS;
    }
    // чаща — купы на островах, не ближе 3.5 клетки к центру
    m.isles.forEach(function (is) {
      for (var n = 0; n < (is.trees || 0); n++) {
        var a = r() * Math.PI * 2, rr = 0.55 + r() * 0.3, cx = Math.floor(is.x + Math.cos(a) * is.rx * rr), cy = Math.floor(is.y + Math.sin(a) * is.ry * rr);
        if (Math.hypot(cx - is.x, cy - is.y) < 3.5) continue;
        for (var k = 0; k < 3; k++) { var tx = cx + (k === 1 ? 1 : 0), ty = cy + (k === 2 ? 1 : 0); if (g[ty * W + tx] === LAND || g[ty * W + tx] === REEDS) g[ty * W + tx] = THICKET; }
      }
      // центр вехи/омута — чистая суша 5×5
      for (var yy = -2; yy <= 2; yy++) for (var xx = -2; xx <= 2; xx++) {
        var tx2 = Math.floor(is.x) + xx, ty2 = Math.floor(is.y) + yy; if (tx2 >= 0 && ty2 >= 0 && tx2 < W && ty2 < H) g[ty2 * W + tx2] = LAND;
      }
      if (is.spawn) for (var py = 0; py < 2; py++) for (var px = 0; px < 2; px++) g[(Math.floor(is.y) + py) * W + Math.floor(is.x) + px - 1] = POOL;
    });
    return { w: W, h: H, g: g };
  }
  function tileAt(map, wx, wy) { var x = Math.floor(wx / TILE), y = Math.floor(wy / TILE); if (x < 0 || y < 0 || x >= map.w || y >= map.h) return WATER; return map.g[y * map.w + x]; }
  function passable(map, wx, wy) { return COST[tileAt(map, wx, wy)] < Infinity; }
  function lineClear(map, ax, ay, bx, by) {
    var L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / 12));
    for (var i = 1; i <= n; i++) if (!passable(map, ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  }
  function nearestPassable(map, wx, wy) {
    if (passable(map, wx, wy)) return { x: wx, y: wy };
    var tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    for (var rr = 1; rr < 12; rr++) {
      var best = null, bd = Infinity;
      for (var y = ty - rr; y <= ty + rr; y++) for (var x = tx - rr; x <= tx + rr; x++) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h || COST[map.g[y * map.w + x]] === Infinity) continue;
        var cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE, dd = d2(cx, cy, wx, wy); if (dd < bd) { bd = dd; best = { x: cx, y: cy }; }
      }
      if (best) return best;
    }
    return { x: wx, y: wy };
  }

  // ---------- A* (8 направлений, без срезания углов, стоимость клеток, сглаживание по прямой видимости) ----------
  function astar(map, sx, sy, gx, gy) {
    var W = map.w, H = map.h, g = map.g;
    var s = nearestPassable(map, sx, sy), e = nearestPassable(map, gx, gy);
    var st = Math.floor(s.y / TILE) * W + Math.floor(s.x / TILE), gt = Math.floor(e.y / TILE) * W + Math.floor(e.x / TILE);
    if (st === gt) return [{ x: e.x, y: e.y }];
    var N = W * H, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    var heap = [], hf = [];
    function push(i, f) { heap.push(i); hf.push(f); var k = heap.length - 1; while (k > 0) { var p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; var t = heap[p]; heap[p] = heap[k]; heap[k] = t; t = hf[p]; hf[p] = hf[k]; hf[k] = t; k = p; } }
    function pop() { var top = heap[0], lh = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lh; hf[0] = lf; var k = 0, n = heap.length; for (;;) { var a = 2 * k + 1, b = a + 1, m = k; if (a < n && hf[a] < hf[m]) m = a; if (b < n && hf[b] < hf[m]) m = b; if (m === k) break; var t = heap[m]; heap[m] = heap[k]; heap[k] = t; t = hf[m]; hf[m] = hf[k]; hf[k] = t; k = m; } } return top; }
    var gxT = gt % W, gyT = (gt / W) | 0;
    function h(i) { var dx = Math.abs(i % W - gxT), dy = Math.abs(((i / W) | 0) - gyT); return 0.85 * (dx + dy + (1.4142 - 2) * Math.min(dx, dy)); }
    gs[st] = 0; push(st, h(st));
    var found = false, best = st, bestH = h(st);
    while (heap.length) {
      var c = pop(); if (closed[c]) continue; closed[c] = 1;
      if (c === gt) { found = true; break; }
      var hc = h(c); if (hc < bestH) { bestH = hc; best = c; }
      var cx = c % W, cy = (c / W) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var ni = ny * W + nx, cost = COST[g[ni]]; if (cost === Infinity || closed[ni]) continue;
        if (dx && dy && (COST[g[cy * W + nx]] === Infinity || COST[g[ny * W + cx]] === Infinity)) continue; // без срезания углов
        var ng = gs[c] + cost * (dx && dy ? 1.4142 : 1);
        if (ng < gs[ni]) { gs[ni] = ng; from[ni] = c; push(ni, ng + h(ni)); }
      }
    }
    var end = found ? gt : best, cells = [];
    for (var k = end; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    var pts = cells.map(function (k) { return { x: (k % W + 0.5) * TILE, y: (((k / W) | 0) + 0.5) * TILE }; });
    if (found) pts[pts.length - 1] = { x: e.x, y: e.y };
    // сглаживание: выкидываем промежуточные точки при прямой видимости и одинаковой «быстроте» участка
    // сглаживание: срезаем, если по прямой проходимо и не дороже пути A* (не срезать мостки по мели)
    var cg = cells.map(function (k) { return gs[k]; });
    var out = [], cur = { x: s.x, y: s.y }, curG = 0, i = 0;
    while (i < pts.length) {
      var j = pts.length - 1;
      while (j > i && !(lineClear(map, cur.x, cur.y, pts[j].x, pts[j].y) && segCost(map, cur, pts[j]) <= (cg[j] - curG) * 1.04 + 0.3)) j--;
      out.push(pts[j]); cur = pts[j]; curG = cg[j]; i = j + 1;
    }
    out.partial = !found;
    return out;
  }
  function segCost(map, a, b) { // стоимость прямого участка в «клетках»
    var L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / 8)), c = 0;
    for (var i = 1; i <= n; i++) c += COST[tileAt(map, a.x + (b.x - a.x) * (i - 0.5) / n, a.y + (b.y - a.y) * (i - 0.5) / n)];
    return c * L / n / TILE;
  }

  // ---------- состояние ----------
  function create(mi, heroIdx, seed) {
    var m = GAT.missions[mi], map = genMap(m);
    var S = { mi: mi, m: m, map: map, t: 0, supply: m.start, units: [], squads: [], points: [], fx: [], events: [], nextId: 1,
      rng: rng(seed || 7), waveK: 0, nextWave: m.waves.first, boss: null, bossSpawned: false, result: null,
      stats: { kills: 0, lost: 0, heroDeaths: 0, captured: 0, built: 0, hired: 0 }, spawns: [], bossAt: null, heroIdx: heroIdx || 0 };
    m.isles.forEach(function (is, k) {
      var cx = (Math.floor(is.x) + 0.5) * TILE, cy = (Math.floor(is.y) + 0.5) * TILE;
      if (is.pt) {
        var p = { id: 'p' + k, isle: k, x: cx, y: cy, r: POINT_R, owner: is.pt === 'home' ? 1 : (is.pt === 'nest' ? -1 : 0), prog: is.pt === 'home' ? 1 : (is.pt === 'nest' ? -1 : 0),
          home: is.pt === 'home', nest: null, building: null, bcd: 0 };
        S.points.push(p);
        if (is.pt === 'nest') {
          p.nest = mkUnit(S, 1, 'nest', cx, cy); p.nest.point = p.id; p.nest.spawnT = 6;
          for (var gk in m.guards) for (var n = 0; n < m.guards[gk]; n++) guard(S, p, gk);
        }
      }
      if (is.spawn) { var sp = { x: cx - TILE * 1.6, y: cy + TILE * 0.5 }; S.spawns.push(sp); if (is.boss) S.bossAt = sp; }
    });
    S.points.forEach(function (p, i) { p.label = String.fromCharCode(65 + i); });
    var home = S.points.filter(function (p) { return p.home; })[0];
    S.home = home;
    var H = HEROES[S.heroIdx];
    var hero = mkUnit(S, 0, H.kind, home.x + 20, home.y);
    hero.hero = H; hero.lvl = 1; hero.xp = 0; hero.cdQ = 0; hero.cdE = 0; hero.respawn = 0;
    S.hero = hero;
    var hs = { id: 'hero', type: 'hero', level: 1, members: [hero], order: { k: 'idle', x: hero.x, y: hero.y }, ax: hero.x, ay: hero.y, face: 0, path: null, regen: 0 };
    hero.squad = hs; S.squads.push(hs);
    m.squads.forEach(function (t, i) { spawnSquad(S, t, home.x - 30 + i * 46, home.y + 46); });
    return S;
  }
  function mkUnit(S, side, kind, x, y) {
    var d = KINDS[kind];
    var u = { id: S.nextId++, side: side, kind: kind, x: x, y: y, hp: d.hp, maxHp: d.hp, dmg: d.dmg, range: d.range, rate: d.rate, cd: S.rng() * 0.5,
      speed: d.speed, r: d.r, armor: d.armor || 0, splash: d.splash || 0, dead: false, face: 0, hitT: 0, buff: 0, squad: null, tgt: null, path: null, rp: 0 };
    S.units.push(u); return u;
  }
  function guard(S, p, kind) {
    var a = S.rng() * Math.PI * 2, rr = 30 + S.rng() * 40;
    var pos = nearestPassable(S.map, p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
    var u = mkUnit(S, 1, kind, pos.x, pos.y); u.post = { x: pos.x, y: pos.y }; u.nestOf = p.id; return u;
  }
  function spawnSquad(S, type, x, y, level) {
    var T = SQUADS[type], sq = { id: 's' + S.nextId++, type: type, level: 1, members: [], order: { k: 'idle', x: x, y: y }, ax: x, ay: y, face: 0, path: null, regen: 0 };
    for (var i = 0; i < T.n; i++) { var u = mkUnit(S, 0, T.unit, x + (i % 3 - 1) * 18, y + Math.floor(i / 3) * 18); u.squad = sq; sq.members.push(u); }
    S.squads.push(sq);
    for (var l = 1; l < (level || 1); l++) levelUp(sq);
    return sq;
  }
  function levelUp(sq) { sq.level++; sq.members.forEach(function (u) { u.maxHp = Math.round(u.maxHp * 1.25); u.dmg = u.dmg * 1.2; u.hp = u.maxHp; }); }

  // ---------- приказы (API для ввода и бота) ----------
  function byId(S, id) { for (var i = 0; i < S.units.length; i++) if (S.units[i].id === id) return S.units[i]; return null; }
  function squadById(S, id) { for (var i = 0; i < S.squads.length; i++) if (S.squads[i].id === id) return S.squads[i]; return null; }
  function order(S, ids, o) { // o: {k:'move', x,y, force} | {k:'attack', tid}
    var list = ids.map(function (id) { return squadById(S, id); }).filter(function (s) { return s && alive(s); });
    var n = list.length;
    list.forEach(function (sq, i) {
      if (o.k === 'attack') { sq.order = { k: 'attack', tid: o.tid }; sq.path = null; sq.rp = 0; return; }
      // несколько отрядов — раскладываем точки назначения веером, чтобы не толкались
      var ox = 0, oy = 0; if (n > 1) { var a = (i / n) * Math.PI * 2; ox = Math.cos(a) * 40; oy = Math.sin(a) * 34; }
      var dst = nearestPassable(S.map, o.x + ox, o.y + oy);
      sq.order = { k: 'move', x: dst.x, y: dst.y, force: !!o.force }; sq.path = astar(S.map, sq.ax, sq.ay, dst.x, dst.y); sq.pi = 0;
    });
    if (list.length) S.events.push({ e: 'order', k: o.k });
    return list.length;
  }
  function alive(sq) { for (var i = 0; i < sq.members.length; i++) if (!sq.members[i].dead) return true; return false; }
  function pointById(S, id) { for (var i = 0; i < S.points.length; i++) if (S.points[i].id === id) return S.points[i]; return null; }
  function armyCount(S) { return S.squads.filter(function (s) { return s.type !== 'hero'; }).length; }
  function hire(S, pid, type) {
    var p = pointById(S, pid), T = SQUADS[type];
    if (!p || p.owner !== 1 || !T || S.m.allow.indexOf(type) < 0) return { ok: false, why: 'nopoint' };
    if (armyCount(S) >= MAX_SQUADS) return { ok: false, why: 'max' };
    if (S.supply < T.cost) return { ok: false, why: 'supply' };
    S.supply -= T.cost; var sq = spawnSquad(S, type, p.x, p.y + 30); S.stats.hired++;
    S.events.push({ e: 'hire', type: type }); return { ok: true, squad: sq };
  }
  function upCost(sq) { return 60 * sq.level; }
  function squadsAt(S, p) { return S.squads.filter(function (s) { return s.type !== 'hero' && alive(s) && d2(s.ax, s.ay, p.x, p.y) < (p.r + 40) * (p.r + 40); }); }
  function upgrade(S, pid, sid) {
    var p = pointById(S, pid), sq = squadById(S, sid);
    if (!p || p.owner !== 1 || !sq || sq.type === 'hero') return { ok: false, why: 'nopoint' };
    if (squadsAt(S, p).indexOf(sq) < 0) return { ok: false, why: 'far' };
    if (sq.level >= 3) return { ok: false, why: 'maxlvl' };
    var c = upCost(sq); if (S.supply < c) return { ok: false, why: 'supply' };
    S.supply -= c; levelUp(sq); refill(S, sq, true); S.events.push({ e: 'upgrade', lvl: sq.level }); return { ok: true };
  }
  function build(S, pid, kind) {
    var p = pointById(S, pid); if (!p || p.owner !== 1 || !BUILD[kind]) return { ok: false, why: 'nopoint' };
    if (p.building) return { ok: false, why: 'built' };
    if (S.supply < BUILD[kind]) return { ok: false, why: 'supply' };
    S.supply -= BUILD[kind]; p.building = kind; S.stats.built++; S.events.push({ e: 'build', kind: kind }); return { ok: true };
  }
  function refill(S, sq, all) {
    var T = SQUADS[sq.type], live = sq.members.filter(function (u) { return !u.dead; });
    if (!live.length) return false;
    var need = T.n - live.length, added = 0;
    sq.members = live;
    while (need-- > 0) {
      var src = live[0], u = mkUnit(S, 0, T.unit, src.x + (S.rng() - 0.5) * 16, src.y + (S.rng() - 0.5) * 16);
      u.maxHp = src.maxHp; u.dmg = src.dmg; u.hp = u.maxHp; u.squad = sq; sq.members.push(u); added++;
      if (!all) break;
    }
    return added > 0;
  }
  // способности героя. q: цель (x,y) — залп / рывок; e: без цели — лечение / клич
  function ability(S, which, x, y) {
    var h = S.hero, H = h.hero; if (h.dead) return false;
    var cdm = 1 - 0.05 * (h.lvl - 1);
    if (which === 'q') {
      if (h.cdQ > 0) return false;
      var Q = H.q, dx = x - h.x, dy = y - h.y, L = Math.hypot(dx, dy) || 1;
      if (L > Q.range) { x = h.x + dx / L * Q.range; y = h.y + dy / L * Q.range; }
      h.cdQ = Q.cd * cdm; var dmg = Q.dmg + Q.up * (h.lvl - 1);
      if (H.id === 'v') { S.fx.push({ k: 'volley', x0: h.x, y0: h.y, x: x, y: y, t: 0, d: 0.4, r: Q.r }); h.pending = { t: 0.4, x: x, y: y, r: Q.r, dmg: dmg }; }
      else { // рывок по прямой до первой непроходимой клетки
        var n = Math.ceil(Math.hypot(x - h.x, y - h.y) / 8), lx = h.x, ly = h.y;
        for (var i = 1; i <= n; i++) { var px = h.x + (x - h.x) * i / n, py = h.y + (y - h.y) * i / n; if (!passable(S.map, px, py)) break; lx = px; ly = py; }
        h.dash = { t: 0, d: 0.25, x0: h.x, y0: h.y, x: lx, y: ly, r: Q.r, dmg: dmg };
      }
      S.events.push({ e: 'ability', k: 'q' }); return true;
    }
    if (which === 'e') {
      if (h.cdE > 0) return false;
      var E = H.e; h.cdE = E.cd * cdm;
      S.units.forEach(function (u) {
        if (u.side !== 0 || u.dead || d2(u.x, u.y, h.x, h.y) > E.r * E.r) return;
        if (H.id === 'v') u.hp = Math.min(u.maxHp, u.hp + E.heal + E.up * (h.lvl - 1));
        else u.buff = E.dur;
      });
      if (H.id === 'z') h.hp = Math.min(h.maxHp, h.hp + E.heal);
      S.fx.push({ k: H.id === 'v' ? 'heal' : 'rally', x: h.x, y: h.y, r: E.r, t: 0, d: 0.7 });
      S.events.push({ e: 'ability', k: 'e' }); return true;
    }
    return false;
  }

  // ---------- бой ----------
  function damage(S, src, tgt, amount) {
    if (tgt.dead) return;
    var a = amount * (1 - (tgt.armor || 0)); tgt.hp -= a; tgt.hitT = 0.15;
    if (tgt.hp <= 0) kill(S, tgt, src);
  }
  function kill(S, u, src) {
    u.dead = true; u.hp = 0;
    if (u.side === 1) {
      var d = KINDS[u.kind]; S.stats.kills++; S.supply += d.bounty || 0; giveXp(S, d.xp || 0);
      S.fx.push({ k: 'pop', x: u.x, y: u.y, t: 0, d: 0.5, side: 1, big: !!d.boss || u.kind === 'nest' });
      if (u.kind === 'nest') { S.events.push({ e: 'nest' }); }
      if (d.boss) { S.events.push({ e: 'bossdown' }); S.result = 'win'; }
    } else {
      S.stats.lost++; S.fx.push({ k: 'pop', x: u.x, y: u.y, t: 0, d: 0.5, side: 0 });
      if (u === S.hero) { u.respawn = 10; S.stats.heroDeaths++; S.events.push({ e: 'herodown' }); }
    }
  }
  function giveXp(S, n) {
    var h = S.hero; if (h.lvl >= XP_LVL.length) return;
    h.xp += n;
    while (h.lvl < XP_LVL.length && h.xp >= XP_LVL[h.lvl]) {
      h.lvl++; h.maxHp = Math.round(h.maxHp * 1.12); h.dmg *= 1.1; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.3);
      S.events.push({ e: 'lvl', lvl: h.lvl });
    }
  }
  function attack(S, u, t, dt) {
    u.face = Math.atan2(t.y - u.y, t.x - u.x);
    if (u.cd > 0) return;
    var rate = u.rate * (u.buff > 0 ? 0.7 : 1), dmg = u.dmg * (u.buff > 0 ? 1.4 : 1);
    u.cd = rate;
    var ranged = u.range > 60;
    if (ranged) S.fx.push({ k: 'shot', x0: u.x, y0: u.y, x: t.x, y: t.y, t: 0, d: 0.18, side: u.side, heavy: !!u.splash });
    else S.fx.push({ k: 'slash', x: t.x, y: t.y, t: 0, d: 0.15, side: u.side });
    damage(S, u, t, dmg);
    if (u.splash) S.units.forEach(function (o) { if (o !== t && !o.dead && o.side !== u.side && d2(o.x, o.y, t.x, t.y) < u.splash * u.splash) damage(S, u, o, dmg * 0.6); });
    S.events.push({ e: 'shot', side: u.side, ranged: ranged, heavy: !!u.splash });
  }
  function nearestFoe(S, side, x, y, R, pred) {
    var best = null, bd = R * R;
    for (var i = 0; i < S.units.length; i++) {
      var o = S.units[i]; if (o.dead || o.side === side || (pred && !pred(o))) continue;
      var dd = d2(o.x, o.y, x, y) - o.r * o.r; if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }
  function moveUnit(S, u, tx, ty, spd, dt) {
    var dx = tx - u.x, dy = ty - u.y, L = Math.hypot(dx, dy); if (L < 0.5) return true;
    var st = Math.min(L, spd * SPEED[tileAt(S.map, u.x, u.y)] * dt) || Math.min(L, spd * 0.5 * dt);
    var nx = u.x + dx / L * st, ny = u.y + dy / L * st;
    if (passable(S.map, nx, ny)) { u.x = nx; u.y = ny; }
    else if (passable(S.map, nx, u.y)) u.x = nx;
    else if (passable(S.map, u.x, ny)) u.y = ny;
    u.face = Math.atan2(dy, dx);
    return L <= st + 0.5;
  }
  // следовать пути (u — юнит или якорь {x,y}); возвращает true по прибытии
  function follow(S, o, path, spd, dt) {
    if (!path || !path.length) return true;
    o.pi = o.pi || 0;
    var w = path[o.pi]; if (!w) return true;
    if (moveUnit(S, o, w.x, w.y, spd, dt)) { o.pi++; if (o.pi >= path.length) return true; }
    return false;
  }

  // ---------- отряды игрока ----------
  function slot(sq, i, n) {
    var perRow = sq.type === 'hero' ? 1 : 3, row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow), col = i % perRow - (inRow - 1) / 2;
    var sp = sq.type === 'cart' ? 28 : 21, fx = Math.cos(sq.face), fy = Math.sin(sq.face);
    return { x: sq.ax - fx * row * sp - fy * col * sp, y: sq.ay - fy * row * sp + fx * col * sp };
  }
  function squadSpeed(sq) { var s = Infinity; sq.members.forEach(function (u) { if (!u.dead) s = Math.min(s, u.speed); }); return s === Infinity ? 60 : s; }
  function maxRange(sq) { var r = 0; sq.members.forEach(function (u) { if (!u.dead) r = Math.max(r, u.range); }); return r; }
  function updateSquad(S, sq, dt) {
    var live = sq.members.filter(function (u) { return !u.dead; });
    if (sq.type === 'hero' && S.hero.dead) return;
    if (!live.length) { sq.gone = true; return; }
    if (sq.type !== 'hero') sq.members = live;
    var anchor = { x: sq.ax, y: sq.ay, pi: sq.pi }, spd = squadSpeed(sq), o = sq.order, foe = null;
    if (sq.type === 'hero' && S.hero.dash) return; // во время рывка — рывок ведёт
    if (o.k === 'attack') { foe = byId(S, o.tid); if (!foe || foe.dead) { sq.order = o = { k: 'idle', x: sq.ax, y: sq.ay }; foe = null; } }
    var aggro = Math.max(maxRange(sq), 40) + 70;
    if (!foe && !(o.k === 'move' && o.force)) {
      foe = nearestFoe(S, 0, sq.ax, sq.ay, aggro);
      if (foe && o.k === 'idle' && d2(foe.x, foe.y, o.x, o.y) > 320 * 320) foe = null; // поводок от места стоянки
    }
    sq.engaged = !!foe;
    if (foe) {
      var need = Math.max(20, maxRange(sq) * 0.8) + foe.r, dd = Math.sqrt(d2(sq.ax, sq.ay, foe.x, foe.y));
      if (dd > need) {
        sq.rp -= dt;
        if (lineClear(S.map, sq.ax, sq.ay, foe.x, foe.y)) { moveUnit(S, anchor, foe.x, foe.y, spd, dt); sq.chase = null; }
        else { if (!sq.chase || sq.rp <= 0) { sq.chase = astar(S.map, sq.ax, sq.ay, foe.x, foe.y); anchor.pi = 0; sq.cpi = 0; sq.rp = 1; } anchor.pi = sq.cpi || 0; follow(S, anchor, sq.chase, spd, dt); sq.cpi = anchor.pi; }
        sq.face = Math.atan2(foe.y - sq.ay, foe.x - sq.ax);
      }
    } else if (o.k === 'move') {
      anchor.pi = sq.pi;
      if (!sq.path) { sq.path = astar(S.map, sq.ax, sq.ay, o.x, o.y); anchor.pi = 0; }
      var w = sq.path[anchor.pi]; if (w) sq.face = Math.atan2(w.y - sq.ay, w.x - sq.ax);
      if (follow(S, anchor, sq.path, spd, dt)) { sq.order = { k: 'idle', x: anchor.x, y: anchor.y }; sq.path = null; }
      sq.pi = anchor.pi;
    } else if (o.k === 'idle') {
      if (d2(sq.ax, sq.ay, o.x, o.y) > 36 * 36) { // вернуться на место после стычки
        if (!sq.path) { sq.path = astar(S.map, sq.ax, sq.ay, o.x, o.y); sq.pi = 0; }
        anchor.pi = sq.pi; if (follow(S, anchor, sq.path, spd, dt)) sq.path = null; sq.pi = anchor.pi;
      } else sq.path = null;
    }
    sq.ax = anchor.x; sq.ay = anchor.y;
    // бойцы: стреляют по цели в радиусе, иначе держат место в строю
    var n = sq.members.length;
    sq.members.forEach(function (u, i) {
      var t = null;
      if (foe && (dist(u, foe) <= u.range + foe.r + 90)) t = foe;
      var near = nearestFoe(S, 0, u.x, u.y, u.range + 6);
      if (near && (!t || dist(u, t) > u.range + t.r)) t = near;
      if (t && dist(u, t) <= u.range + t.r) { attack(S, u, t, dt); return; }
      if (t && sq.engaged) { var k = u.range * 0.9 + t.r, L = dist(u, t); moveUnit(S, u, t.x - (t.x - u.x) / L * k, t.y - (t.y - u.y) / L * k, u.speed, dt); return; }
      var sl = slot(sq, i, n);
      if (!passable(S.map, sl.x, sl.y) || !lineClear(S.map, sq.ax, sq.ay, sl.x, sl.y)) sl = { x: sq.ax, y: sq.ay };
      var far = d2(u.x, u.y, sl.x, sl.y);
      if (far > 900 * 900 / 4 || (far > 120 * 120 && !lineClear(S.map, u.x, u.y, sl.x, sl.y))) { // отстал за водой — к якорю путём
        if (!u.path || u.rp <= 0) { u.path = astar(S.map, u.x, u.y, sq.ax, sq.ay); u.pi = 0; u.rp = 1.5; }
        u.rp -= dt; follow(S, u, u.path, u.speed * 1.3, dt);
      } else { u.path = null; moveUnit(S, u, sl.x, sl.y, u.speed * (far > 400 ? 1.35 : 1), dt); }
    });
  }

  // ---------- нечисть ----------
  function goalFor(S, from) {
    var best = null, bd = Infinity;
    S.points.forEach(function (p) { if (p.owner === 1) { var dd = d2(p.x, p.y, from.x, from.y); if (dd < bd) { bd = dd; best = p; } } });
    return best || S.home;
  }
  function updateEnemy(S, u, dt) {
    var d = KINDS[u.kind];
    if (d.still) { // гнездо: подращивает стражу
      u.spawnT -= dt; var p = pointById(S, u.point);
      if (u.spawnT <= 0) {
        u.spawnT = 10;
        var cnt = S.units.filter(function (o) { return !o.dead && o.nestOf === p.id; }).length;
        if (cnt < S.m.nestCap) guard(S, p, S.rng() < 0.65 ? 'kochkar' : 'plevun');
      }
      return;
    }
    if (d.boss) bossTick(S, u, dt);
    var aggro = d.boss ? 220 : (u.post ? 170 : 160), t = nearestFoe(S, 1, u.x, u.y, aggro);
    if (t && u.post && d2(t.x, t.y, u.post.x, u.post.y) > 280 * 280) t = null;
    if (t) {
      if (dist(u, t) <= u.range + t.r) { attack(S, u, t, dt); return; }
      if (lineClear(S.map, u.x, u.y, t.x, t.y)) { moveUnit(S, u, t.x, t.y, u.speed, dt); u.path = null; }
      else { u.rp -= dt; if (!u.path || u.rp <= 0) { u.path = astar(S.map, u.x, u.y, t.x, t.y); u.pi = 0; u.rp = 1.2; } follow(S, u, u.path, u.speed, dt); }
      return;
    }
    if (u.post) { if (d2(u.x, u.y, u.post.x, u.post.y) > 20 * 20) { if (!u.path || u.rp <= 0) { u.path = astar(S.map, u.x, u.y, u.post.x, u.post.y); u.pi = 0; u.rp = 3; } u.rp -= dt; if (follow(S, u, u.path, u.speed, dt)) u.path = null; } return; }
    // волна: к ближайшей вехе игрока
    var g = u.goal; if (!g || g.owner !== 1) { g = u.goal = goalFor(S, u); u.path = null; }
    var r = g.r * 0.5;
    if (d2(u.x, u.y, g.x, g.y) > r * r) {
      if (!u.path) { u.path = astar(S.map, u.x, u.y, g.x + (S.rng() - 0.5) * 60, g.y + (S.rng() - 0.5) * 60); u.pi = 0; }
      if (follow(S, u, u.path, u.speed, dt)) u.path = null;
    }
  }
  function bossTick(S, u, dt) {
    u.ab = (u.ab == null ? 8 : u.ab) - dt; u.sum = (u.sum == null ? 10 : u.sum) - dt;
    if (u.sum <= 0) {
      u.sum = u.kind === 'omutnik' ? 24 : (u.kind === 'kamyshnitsa' ? 20 : 16);
      var kind = u.kind === 'omutnik' ? 'tinnik' : (u.kind === 'kamyshnitsa' ? 'plevun' : 'kochkar');
      for (var i = 0; i < (kind === 'tinnik' ? 1 : 2); i++) { var p = nearestPassable(S.map, u.x + (S.rng() - 0.5) * 70, u.y + (S.rng() - 0.5) * 70); var m = mkUnit(S, 1, kind, p.x, p.y); m.goal = u.goal; }
      S.fx.push({ k: 'summon', x: u.x, y: u.y, t: 0, d: 0.6 });
    }
    if (u.ab <= 0) {
      if (u.kind === 'kamyshnitsa') { // град плевков по трём бойцам рядом
        u.ab = 11; var near = S.units.filter(function (o) { return !o.dead && o.side === 0 && d2(o.x, o.y, u.x, u.y) < 260 * 260; }).slice(0, 3);
        near.forEach(function (o) { S.fx.push({ k: 'volley', x0: u.x, y0: u.y, x: o.x, y: o.y, t: 0, d: 0.5, r: 40, side: 1 }); S.units.forEach(function (q) { if (!q.dead && q.side === 0 && d2(q.x, q.y, o.x, o.y) < 40 * 40) damage(S, u, q, 22); }); });
      } else if (u.kind === 'omutnik') { // затягивание
        u.ab = 14; S.units.forEach(function (q) { if (q.dead || q.side !== 0) return; var dd = Math.sqrt(d2(q.x, q.y, u.x, u.y)); if (dd < 220 && dd > 1) { var k = Math.min(60, dd - 40) / dd; var nx = q.x + (u.x - q.x) * k, ny = q.y + (u.y - q.y) * k; if (passable(S.map, nx, ny)) { q.x = nx; q.y = ny; } damage(S, u, q, 15); } });
        S.fx.push({ k: 'pull', x: u.x, y: u.y, r: 220, t: 0, d: 0.7 });
      } else { u.ab = 9; S.units.forEach(function (q) { if (!q.dead && q.side === 0 && d2(q.x, q.y, u.x, u.y) < 110 * 110) damage(S, u, q, 20); }); S.fx.push({ k: 'quake', x: u.x, y: u.y, r: 110, t: 0, d: 0.6 }); }
    }
  }
  function spawnWave(S) {
    var k = S.waveK++, W = S.m.waves, sp = S.spawns[k % S.spawns.length], goal = goalFor(S, sp);
    var list = [];
    ['kochkar', 'plevun', 'tinnik'].forEach(function (kind) { var c = W[kind], n = Math.floor(c[0] + c[1] * k); for (var i = 0; i < n; i++) list.push(kind); });
    list.forEach(function (kind) { var p = nearestPassable(S.map, sp.x + (S.rng() - 0.5) * 60, sp.y + (S.rng() - 0.5) * 60); var u = mkUnit(S, 1, kind, p.x, p.y); u.goal = goal; });
    S.events.push({ e: 'wave', n: list.length, k: k + 1 });
  }
  function spawnBoss(S) {
    var B = S.m.boss, at = S.bossAt || S.spawns[0];
    var u = mkUnit(S, 1, B.kind, at.x, at.y); u.goal = S.home; S.boss = u; S.bossSpawned = true;
    S.events.push({ e: 'boss', kind: B.kind });
  }

  // ---------- вехи ----------
  function updatePoints(S, dt) {
    var inc = 0;
    S.points.forEach(function (p) {
      var mine = 0, foes = 0, R = p.r * p.r;
      S.units.forEach(function (u) { if (u.dead || KINDS[u.kind].still) return; if (d2(u.x, u.y, p.x, p.y) < R) { if (u.side === 0) mine++; else foes++; } });
      p.contest = mine > 0 && foes > 0; p.mine = mine; p.foes = foes;
      var nestAlive = p.nest && !p.nest.dead;
      if (!nestAlive && mine > 0 && foes === 0 && p.prog < 1) {
        p.prog = Math.min(1, p.prog + dt / CAPTURE_T * (1 + Math.min(mine, 8) * 0.06));
        if (p.prog > 0 && p.owner === -1) p.owner = 0;
        if (p.prog >= 1 && p.owner !== 1) { p.owner = 1; S.stats.captured++; S.supply += 30; S.events.push({ e: 'capture', id: p.id }); }
      } else if (foes > 0 && mine === 0 && p.prog > -1) {
        var was = p.owner; p.prog = Math.max(-1, p.prog - dt / LOSE_T);
        if (p.prog <= 0 && was === 1) { p.owner = 0; p.building = null; S.events.push({ e: 'lost', id: p.id }); if (p.home) { S.result = 'lose'; } }
        if (p.prog <= -1) p.owner = -1;
      }
      if (p.owner === 1) {
        inc += p.building === 'barn' ? 0.75 : 0.4;
        if (p.building === 'tower') { p.bcd -= dt; if (p.bcd <= 0) { var t = nearestFoe(S, 0, p.x, p.y - 20, 200); if (t) { p.bcd = 0.9; S.fx.push({ k: 'shot', x0: p.x, y0: p.y - 34, x: t.x, y: t.y, t: 0, d: 0.18, side: 0 }); damage(S, null, t, 12); S.events.push({ e: 'shot', side: 0, ranged: true }); } } }
        var heal = p.building === 'fire' ? 9 : 3;
        S.units.forEach(function (u) { if (!u.dead && u.side === 0 && d2(u.x, u.y, p.x, p.y) < R && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + heal * dt); });
        S.squads.forEach(function (sq) {
          if (sq.type === 'hero' || sq.gone || d2(sq.ax, sq.ay, p.x, p.y) > R || sq.engaged) return;
          sq.regen += dt; if (sq.regen >= (p.building === 'fire' ? 3.5 : 7)) { sq.regen = 0; if (refill(S, sq, false)) S.events.push({ e: 'refill' }); }
        });
      }
    });
    S.supply += inc * dt; S.income = inc;
  }

  // ---------- шаг ----------
  function step(S, dt) {
    if (S.result) return;
    S.t += dt;
    var h = S.hero;
    if (h.dead) {
      h.respawn -= dt;
      if (h.respawn <= 0) {
        var at = S.points.filter(function (p) { return p.owner === 1; }).sort(function (a, b) { return (b.home ? 1 : 0) - (a.home ? 1 : 0); })[0] || S.home;
        h.dead = false; h.hp = h.maxHp; h.x = at.x + 24; h.y = at.y; h.dash = null; h.pending = null; S.units.push(h);
        var hs = h.squad; hs.ax = h.x; hs.ay = h.y; hs.order = { k: 'idle', x: h.x, y: h.y }; hs.path = null;
        S.events.push({ e: 'heroup' });
      }
    }
    if (h.cdQ > 0) h.cdQ = Math.max(0, h.cdQ - dt);
    if (h.cdE > 0) h.cdE = Math.max(0, h.cdE - dt);
    if (!h.dead && h.pending) { h.pending.t -= dt; if (h.pending.t <= 0) { var P = h.pending; h.pending = null; S.fx.push({ k: 'boom', x: P.x, y: P.y, r: P.r, t: 0, d: 0.45 }); S.units.forEach(function (u) { if (!u.dead && u.side === 1 && d2(u.x, u.y, P.x, P.y) < (P.r + u.r) * (P.r + u.r)) damage(S, h, u, P.dmg); }); S.events.push({ e: 'boom' }); } }
    if (!h.dead && h.dash) {
      var D = h.dash; D.t += dt; var k = Math.min(1, D.t / D.d);
      h.x = D.x0 + (D.x - D.x0) * k; h.y = D.y0 + (D.y - D.y0) * k;
      if (k >= 1) {
        h.dash = null; var hs2 = h.squad; hs2.ax = h.x; hs2.ay = h.y; hs2.order = { k: 'idle', x: h.x, y: h.y }; hs2.path = null;
        S.fx.push({ k: 'quake', x: h.x, y: h.y, r: D.r, t: 0, d: 0.4, side: 0 });
        S.units.forEach(function (u) {
          if (u.dead || u.side !== 1 || d2(u.x, u.y, h.x, h.y) > (D.r + u.r) * (D.r + u.r)) return;
          damage(S, h, u, D.dmg);
          if (!KINDS[u.kind].still && !KINDS[u.kind].boss) { var L = Math.max(1, dist(u, h)), nx = u.x + (u.x - h.x) / L * 30, ny = u.y + (u.y - h.y) / L * 30; if (passable(S.map, nx, ny)) { u.x = nx; u.y = ny; } }
        });
        S.events.push({ e: 'boom' });
      }
    }
    S.units.forEach(function (u) { if (u.cd > 0) u.cd -= dt; if (u.buff > 0) u.buff -= dt; if (u.hitT > 0) u.hitT -= dt; });
    S.squads.forEach(function (sq) { updateSquad(S, sq, dt); });
    S.squads = S.squads.filter(function (sq) { return !sq.gone; });
    for (var i = 0; i < S.units.length; i++) { var u = S.units[i]; if (!u.dead && u.side === 1) updateEnemy(S, u, dt); }
    separate(S);
    updatePoints(S, dt);
    // волны и босс
    if (S.t >= S.nextWave) { spawnWave(S); S.nextWave += S.m.waves.every * (S.bossSpawned ? 1.5 : 1); }
    var nestsLeft = S.points.filter(function (p) { return p.nest && !p.nest.dead; }).length;
    if (!S.bossSpawned && ((nestsLeft === 0 && S.t >= S.m.boss.min) || S.t >= S.m.boss.time)) spawnBoss(S);
    S.units = S.units.filter(function (u) { return !u.dead; });
    S.fx.forEach(function (f) { f.t += dt; }); S.fx = S.fx.filter(function (f) { return f.t < f.d; });
    if (S.fx.length > 300) S.fx.splice(0, S.fx.length - 300);
    if (S.result === 'win') S.events.push({ e: 'win' }); else if (S.result === 'lose') S.events.push({ e: 'lose' });
  }
  function separate(S) { // расталкивание (своя сторона) — простая пара за парой
    var U = S.units, n = U.length;
    for (var i = 0; i < n; i++) {
      var a = U[i]; if (a.dead || KINDS[a.kind].still) continue;
      for (var j = i + 1; j < n; j++) {
        var b = U[j]; if (b.dead || KINDS[b.kind].still) continue;
        var R = a.r + b.r - 2, dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
        if (dd >= R * R || dd < 0.01) continue;
        var L = Math.sqrt(dd), push = (R - L) * 0.25, ux = dx / L * push, uy = dy / L * push;
        var wa = KINDS[a.kind].boss ? 0.1 : 1, wb = KINDS[b.kind].boss ? 0.1 : 1;
        if (passable(S.map, a.x - ux * wa, a.y - uy * wa)) { a.x -= ux * wa; a.y -= uy * wa; }
        if (passable(S.map, b.x + ux * wb, b.y + uy * wb)) { b.x += ux * wb; b.y += uy * wb; }
      }
    }
  }
  function objective(S) {
    var nests = S.points.filter(function (p) { return p.nest; }), left = nests.filter(function (p) { return !p.nest.dead; }).length;
    var mine = S.points.filter(function (p) { return p.owner === 1; }).length;
    return { mine: mine, total: S.points.length, nests: nests.length, nestsLeft: left, boss: S.bossSpawned, bossHp: S.boss ? S.boss.hp / S.boss.maxHp : 1, bossIn: Math.max(0, (left === 0 ? S.m.boss.min : S.m.boss.time) - S.t) };
  }
  function stars(S) { var s = S.result === 'win' ? 1 : 0; if (s && S.stats.heroDeaths === 0) s++; if (s && S.t <= 600) s++; return s; }

  GAT.logic = { TILE: TILE, T: { WATER: WATER, LAND: LAND, SHALLOW: SHALLOW, GAT: GATT, THICKET: THICKET, REEDS: REEDS, POOL: POOL },
    SQUADS: SQUADS, KINDS: KINDS, BUILD: BUILD, HEROES: HEROES, XP_LVL: XP_LVL, MAX_SQUADS: MAX_SQUADS,
    rng: rng, genMap: genMap, astar: astar, passable: passable, tileAt: tileAt, lineClear: lineClear, nearestPassable: nearestPassable,
    create: create, step: step, order: order, hire: hire, upgrade: upgrade, build: build, ability: ability, upCost: upCost,
    squadsAt: squadsAt, squadById: squadById, pointById: pointById, byId: byId, armyCount: armyCount, slot: slot, objective: objective, stars: stars,
    spawnWave: spawnWave, spawnBoss: spawnBoss, alive: alive };
})(typeof window !== 'undefined' ? window : globalThis);
