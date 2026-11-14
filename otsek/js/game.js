/* ОТСЕК · логика (без DOM, детерминирована при заданном rng). OTSEK.Game(opts), OTSEK.logic
   Коридорный шутер с видом сверху на 1–2 игроков. Ремонтная бригада мастерской «Гефест» зачищает дрейфующую
   станцию-кузню «Наковальня-7» от ржавчины-роя — сети механических паразитов из окалины.
   Палуба — сетка отсеков (комнат), соединённых коридорами; часть проходов перекрыта гермодверями: каждая дверь
   тратит одну ключ-карту. Карты лежат на палубе и продаются на терминалах (за жетоны). В дальнем отсеке — пульт
   сброса реактора (или босс) — после него включается отсчёт самоуничтожения: бегом к шлюзу у входа.
   Координаты: x, y — центр объекта в пикселях палубы; клетка (тайл) — 24 px. */
(function (global) {
  'use strict';
  var G = global.OTSEK = global.OTSEK || {};

  // ---------- Константы ----------
  var T = 24, VIEW_W = 640, VIEW_H = 480, HUD = 32, SCREEN_H = HUD + VIEW_H;
  var CW = 14, CH = 11;                       // отсек-ячейка сетки палубы, в тайлах
  var FLOOR = 0, WALL = 1, PART = 2, DOOR = 3; // тайлы: пол, стена, перегородка (её режет плазменный резак), закрытая дверь
  var HIT_INV = 0.3, SPEED = 125, HERO_R = 8, HP = 100, LIVES = 3, RESPAWN_T = 1.6, INV_T = 2.2;
  var AMMO0 = 120, AMMO_MAX = 300, TOKENS0 = 100, USE_R = 34, PICK_R = 16;
  var DECKS = [
    { rx: 3, ry: 3, doors: 2, side: 1, loops: 0.25, mobs: 2, nests: 1, spikes: 1, carpets: 0, spare: 0.6 },
    { rx: 4, ry: 3, doors: 2, side: 2, loops: 0.25, mobs: 3, nests: 2, spikes: 2, carpets: 1, spare: 0.5 },
    { rx: 4, ry: 3, doors: 2, side: 1, loops: 0.2, mobs: 3, nests: 2, spikes: 2, carpets: 2, spare: 0.5, boss: 'matka' },
    { rx: 4, ry: 4, doors: 3, side: 2, loops: 0.2, mobs: 3, nests: 3, spikes: 3, carpets: 2, spare: 0.4 },
    { rx: 5, ry: 4, doors: 3, side: 3, loops: 0.2, mobs: 4, nests: 4, spikes: 4, carpets: 3, spare: 0.4 },
    { rx: 4, ry: 4, doors: 3, side: 2, loops: 0.2, mobs: 4, nests: 3, spikes: 3, carpets: 3, spare: 0.4, boss: 'heart' }
  ];
  var MAX_DECK = DECKS.length;
  // Оружие: ammo — расход патронов на выстрел; клепальный пистолет — с начала, остальное — на терминалах.
  var GUN = {
    rivet:  { cd: 0.2, speed: 520, dmg: 1, ammo: 1, r: 3, life: 0.9 },
    fan:    { cd: 0.42, speed: 470, dmg: 1, ammo: 3, r: 3, life: 0.36, n: 5, spread: 0.16 },
    cutter: { cd: 0.36, speed: 430, dmg: 3, ammo: 2, r: 5, life: 0.9, pierce: 3 },
    flame:  { cd: 0.05, speed: 300, dmg: 0.4, ammo: 1, every: 3, r: 7, life: 0.3, pierce: 9 },
    nail:   { cd: 0.075, speed: 640, dmg: 1, ammo: 1, r: 2, life: 0.7, jitter: 0.06 },
    wrench: { cd: 0.42, dmg: 1.5, reach: 26 }
  };
  var WEAPONS = ['rivet', 'fan', 'cutter', 'flame', 'nail'];
  var ENEMIES = {
    tick:   { r: 7, hp: 2, speed: 92, dmg: 8, bite: 0.55, tokens: 5, score: 50 },
    carpet: { r: 15, hp: 9, speed: 38, dmg: 5, bite: 0.32, tokens: 20, score: 200 },
    spike:  { r: 11, hp: 6, speed: 0, dmg: 10, bite: 0.6, tokens: 25, score: 250, cd: 2.4, warn: 0.55, range: 250, spark: 165 },
    nest:   { r: 16, hp: 14, speed: 0, dmg: 6, bite: 0.6, tokens: 60, score: 500, every: 5.2, max: 4, range: 330 },
    node:   { r: 11, hp: 12, speed: 0, dmg: 10, bite: 0.6, tokens: 40, score: 800 },
    vein:   { r: 10, hp: 12, speed: 0, dmg: 10, bite: 0.6, tokens: 40, score: 800 }
  };
  var SPARK_DMG = 9, SPARK_R = 4;
  // Склад терминала (цены в жетонах)
  var SHOP = [
    { id: 'ammo', price: 60 }, { id: 'med', price: 80 }, { id: 'card', price: 150 }, { id: 'map', price: 40 },
    { id: 'fan', price: 350 }, { id: 'cutter', price: 500 }, { id: 'flame', price: 650 }, { id: 'nail', price: 800 },
    { id: 'lamp', price: 300 }, { id: 'armor', price: 450 }, { id: 'life', price: 1000 }
  ];
  var SCORE = { deck: 2000, sec: 50, boss: 5000, card: 100, cache: 300 };
  var BOSSES = {
    matka: { r: 30, hp: 70, nodes: 4, nodeR: 52 },
    heart: { r: 28, hp: 80, nodes: 3, nodeR: 54 }
  };
  // Раскладка: И1 — стрелки + / (огонь), . (действие), , (смена оружия); И2 — WASD + F, E, Q.
  // Огонь держишь — направление фиксируется (стрейф). В одиночку обе раскладки ведут И1.
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      fire: ['Slash', 'Space', 'NumpadDivide'], use: ['Period', 'ShiftRight'], swap: ['Comma'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      fire: ['KeyF', 'ShiftLeft'], use: ['KeyE'], swap: ['KeyQ'] }
  };
  var OCT = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function shuffle(rng, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function oct(dx, dy) { var a = Math.atan2(dy, dx); return OCT[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }

  // ---------- Генератор палубы ----------
  // Сетка отсеков rx×ry, остовное дерево коридоров (+ немного петель внутри одной зоны), старт со шлюзом — у западного
  // борта, цель (пульт или босс) — в самом дальнем по дереву отсеке. На обязательном пути — `doors` гермодверей;
  // тупиковые отсеки-кладовые закрыты своими дверями. Карта для двери k лежит в зоне перед ней, в каждой зоне — терминал.
  function genDeck(n, seed) {
    var spec = DECKS[n - 1], rng = mulberry32((seed || 0) * 7919 + n * 104729 + 17);
    var RX = spec.rx, RY = spec.ry, W = RX * CW, H = RY * CH, NC = RX * RY;
    var tiles = new Uint8Array(W * H); tiles.fill(WALL);
    function cid(cx, cy) { return cx + cy * RX; }
    function cxy(c) { return [c % RX, Math.floor(c / RX)]; }
    function nbrs(c) { var p = cxy(c), o = []; if (p[0] > 0) o.push(c - 1); if (p[0] < RX - 1) o.push(c + 1); if (p[1] > 0) o.push(c - RX); if (p[1] < RY - 1) o.push(c + RX); return o; }
    function ek(a, b) { return a < b ? a + '_' + b : b + '_' + a; }
    var start = cid(0, ri(rng, 0, RY - 1));
    // остовное дерево — случайный обход в глубину
    var parent = new Array(NC).fill(-1), seen = new Array(NC).fill(false), stack = [start], edges = {}; seen[start] = true;
    while (stack.length) {
      var c = stack[stack.length - 1], fr = shuffle(rng, nbrs(c).filter(function (x) { return !seen[x]; }));
      if (!fr.length) { stack.pop(); continue; }
      var nx = fr[0]; seen[nx] = true; parent[nx] = c; edges[ek(c, nx)] = { a: c, b: nx, tree: true }; stack.push(nx);
    }
    var depth = new Array(NC).fill(0), order = [start], i, j;
    for (i = 0; i < order.length; i++) for (j = 0; j < NC; j++) if (parent[j] === order[i]) { depth[j] = depth[order[i]] + 1; order.push(j); }
    var goal = start; for (i = 0; i < NC; i++) if (depth[i] > depth[goal] || (depth[i] === depth[goal] && rng() < 0.3 && i !== start)) goal = i;
    var path = [goal]; while (path[0] !== start) path.unshift(parent[path[0]]);
    var onPath = {}; path.forEach(function (c) { onPath[c] = true; });
    // двери обязательного пути
    var m = path.length - 1, K = Math.min(spec.doors, m), doorIdx = [];
    for (var k = 1; k <= K; k++) { var ix = clamp(Math.floor(k * m / (K + 1)), 0, m - 1); while (doorIdx.indexOf(ix) >= 0 && ix < m - 1) ix++; if (doorIdx.indexOf(ix) < 0) doorIdx.push(ix); }
    doorIdx.sort(function (a, b) { return a - b; }); K = doorIdx.length;
    var locked = {}; doorIdx.forEach(function (ix, kk) { var e = edges[ek(path[ix], path[ix + 1])]; e.lock = 'path'; e.k = kk; e.from = path[ix]; e.to = path[ix + 1]; locked[ek(path[ix], path[ix + 1])] = e; });
    // кладовые: листья вне пути
    var leaves = []; for (i = 0; i < NC; i++) if (!onPath[i] && i !== start && !order.some(function (x) { return parent[x] === i; })) leaves.push(i);
    shuffle(rng, leaves);
    var vaults = leaves.slice(0, spec.side);
    vaults.forEach(function (v) { var e = edges[ek(v, parent[v])]; e.lock = 'side'; e.from = parent[v]; e.to = v; locked[ek(v, parent[v])] = e; });
    // зоны (компоненты без запертых рёбер)
    var zone = new Array(NC).fill(-1), zc = 0;
    for (i = 0; i < NC; i++) if (zone[i] < 0) {
      var q = [i]; zone[i] = zc;
      while (q.length) { var cc = q.pop(); nbrs(cc).forEach(function (o) { var e = edges[ek(cc, o)]; if (e && !e.lock && zone[o] < 0) { zone[o] = zc; q.push(o); } }); }
      zc++;
    }
    var pathZones = [zone[start]]; doorIdx.forEach(function (ix) { pathZones.push(zone[path[ix + 1]]); });
    // петли внутри зоны
    for (i = 0; i < NC; i++) nbrs(i).forEach(function (o) { if (o > i && !edges[ek(i, o)] && zone[i] === zone[o] && vaults.indexOf(i) < 0 && vaults.indexOf(o) < 0 && rng() < spec.loops) edges[ek(i, o)] = { a: i, b: o, tree: false }; });
    // комнаты (каждая содержит центральный «крест» 2×2, через который входят коридоры)
    var rooms = [];
    for (i = 0; i < NC; i++) {
      var p = cxy(i), X = p[0] * CW, Y = p[1] * CH, ccol = X + 7, crow = Y + 5, big = i === start || i === goal;
      var r = big ? { x0: X + 1, x1: X + CW - 2, y0: Y + 1, y1: Y + CH - 2 } :
        { x0: ri(rng, X + 1, ccol - 3), x1: ri(rng, ccol + 2, X + CW - 2), y0: ri(rng, Y + 1, crow - 3), y1: ri(rng, crow + 2, Y + CH - 2) };
      r.c = i; r.cx = p[0]; r.cy = p[1]; r.ccol = ccol; r.crow = crow; r.lit = !big && rng() < 0.3;
      rooms.push(r);
      for (var ty = r.y0; ty <= r.y1; ty++) for (var tx = r.x0; tx <= r.x1; tx++) tiles[tx + ty * W] = FLOOR;
    }
    var doors = [];
    Object.keys(edges).forEach(function (key) {
      var e = edges[key], a = Math.min(e.a, e.b), b = Math.max(e.a, e.b), ra = rooms[a], rb = rooms[b], tx, ty, dt = [];
      if (b === a + 1) { for (tx = ra.x1 + 1; tx < rb.x0; tx++) for (ty = ra.crow - 1; ty <= ra.crow; ty++) tiles[tx + ty * W] = FLOOR; dt = [[rb.cx * CW, ra.crow - 1], [rb.cx * CW, ra.crow]]; }
      else { for (ty = ra.y1 + 1; ty < rb.y0; ty++) for (tx = ra.ccol - 1; tx <= ra.ccol; tx++) tiles[tx + ty * W] = FLOOR; dt = [[ra.ccol - 1, rb.cy * CH], [ra.ccol, rb.cy * CH]]; }
      if (e.lock) {
        var d = { id: doors.length, tiles: dt, path: e.lock === 'path', k: e.lock === 'path' ? e.k : -1, from: e.from, to: e.to, open: false, horiz: b !== a + 1 };
        d.x = (dt[0][0] + dt[1][0] + 1) * T / 2; d.y = (dt[0][1] + dt[1][1] + 1) * T / 2;
        dt.forEach(function (q) { tiles[q[0] + q[1] * W] = DOOR; });
        doors.push(d);
      }
    });
    var reserved = {};
    function res(tx, ty) { reserved[tx + ',' + ty] = true; }
    // корридорные «кресты» и проёмы не занимаем предметами
    rooms.forEach(function (r) { res(r.ccol - 1, r.crow); res(r.ccol, r.crow); res(r.ccol - 1, r.crow - 1); res(r.ccol, r.crow - 1); });
    // шлюз — у западной стены стартового отсека
    var rs = rooms[start];
    var air = { tx0: rs.x0, tx1: rs.x0 + 2, ty0: rs.crow - 2, ty1: rs.crow + 1 };
    air.x0 = air.tx0 * T; air.x1 = (air.tx1 + 1) * T; air.y0 = air.ty0 * T; air.y1 = (air.ty1 + 1) * T;
    for (var ay = air.ty0; ay <= air.ty1; ay++) for (var ax = air.tx0; ax <= air.tx1; ax++) res(ax, ay);
    var spawn = { x: (rs.x0 + 5) * T + T / 2, y: rs.crow * T };
    // тайники за перегородками (только плазменный резак): угол комнаты 2×2
    var caches = [];
    rooms.forEach(function (r) {
      if (r.c === start || r.c === goal || vaults.indexOf(r.c) >= 0) return;
      if (r.y0 !== r.cy * CH + 1 || r.x0 > r.ccol - 4 || r.x1 - r.x0 < 7 || r.y1 - r.y0 < 6 || rng() > 0.45) return;
      var x0 = r.x0, y0 = r.y0;
      for (var yy = y0; yy <= y0 + 2; yy++) tiles[(x0 + 2) + yy * W] = PART;
      for (var xx = x0; xx <= x0 + 1; xx++) tiles[xx + (y0 + 2) * W] = PART;
      for (yy = y0; yy <= y0 + 2; yy++) for (xx = x0; xx <= x0 + 2; xx++) res(xx, yy);
      caches.push({ x: (x0 + 1) * T, y: (y0 + 1) * T, c: r.c });
    });
    function freeTile(r, avoid) {
      for (var tries = 0; tries < 200; tries++) {
        var tx = ri(rng, r.x0, r.x1), ty = ri(rng, r.y0, r.y1);
        if (tiles[tx + ty * W] !== FLOOR || reserved[tx + ',' + ty]) continue;
        if (avoid && Math.abs(tx * T + T / 2 - avoid.x) + Math.abs(ty * T + T / 2 - avoid.y) < 5 * T) continue;
        res(tx, ty); return { x: tx * T + T / 2, y: ty * T + T / 2, tx: tx, ty: ty };
      }
      return null;
    }
    function wallTile(r) {   // место у верхней стены комнаты (для терминала), не в проёме коридора
      var xs = []; for (var tx = r.x0; tx <= r.x1; tx++) if (Math.abs(tx - r.ccol + 0.5) > 1.6 && !reserved[tx + ',' + r.y0] && tiles[tx + r.y0 * W] === FLOOR) xs.push(tx);
      if (!xs.length) return freeTile(r);
      var tx2 = pick(rng, xs); res(tx2, r.y0); res(tx2, r.y0 + 1); return { x: tx2 * T + T / 2, y: r.y0 * T + T / 2 + 2, tx: tx2, ty: r.y0 };
    }
    var rg = rooms[goal], objective = { x: rg.ccol * T, y: rg.crow * T, kind: spec.boss ? 'boss' : 'console', cell: goal, boss: spec.boss || null };
    for (var oy = rg.crow - 3; oy <= rg.crow + 2; oy++) for (var ox = rg.ccol - 3; ox <= rg.ccol + 2; ox++) res(ox, oy);
    // терминалы: старт + по одному в каждой следующей зоне пути
    var terminals = [], cards = [], items = [], mobs = [];
    var st = wallTile(rs); terminals.push({ id: 0, x: st.x, y: st.y, zone: zone[start] });
    function cellsOf(z) { var o = []; for (var c2 = 0; c2 < NC; c2++) if (zone[c2] === z) o.push(c2); return o; }
    for (k = 1; k < pathZones.length; k++) {
      var zs = cellsOf(pathZones[k]), opts = zs.filter(function (c2) { return c2 !== goal; });
      var tc = pick(rng, opts.length ? opts : zs), tp = wallTile(rooms[tc]);
      terminals.push({ id: terminals.length, x: tp.x, y: tp.y, zone: pathZones[k] });
    }
    // ключ-карты: по одной на каждую дверь пути, в зоне перед ней (не в стартовом отсеке, если есть выбор)
    for (k = 0; k < K; k++) {
      var zc2 = cellsOf(pathZones[k]), far = zc2.filter(function (c2) { return c2 !== start; });
      var cc2 = pick(rng, far.length ? far : zc2), cp = freeTile(rooms[cc2], cc2 === start ? spawn : null) || freeTile(rooms[cc2]);
      cards.push({ x: cp.x, y: cp.y, zone: pathZones[k], spare: false });
    }
    if (rng() < spec.spare) {   // запасная карта где-нибудь на пути
      var zr = pick(rng, pathZones.slice(0, K + 1)), cs = cellsOf(zr).filter(function (c2) { return c2 !== start; });
      if (cs.length) { var sp = freeTile(rooms[pick(rng, cs)]); if (sp) cards.push({ x: sp.x, y: sp.y, zone: zr, spare: true }); }
    }
    // кладовые: жетоны, патроны, аптечка, иногда карта (тогда вскрытие «бесплатно»)
    vaults.forEach(function (v) {
      var r = rooms[v], a;
      for (var q2 = 0; q2 < 3; q2++) { a = freeTile(r); if (a) items.push({ kind: 'tok', x: a.x, y: a.y, v: 60 + 20 * n }); }
      a = freeTile(r); if (a) items.push({ kind: 'ammo', x: a.x, y: a.y, v: 50 });
      a = freeTile(r); if (a) items.push({ kind: 'med', x: a.x, y: a.y, v: 40 });
      if (rng() < 0.35) { a = freeTile(r); if (a) cards.push({ x: a.x, y: a.y, zone: zone[v], spare: true }); }
    });
    if (spec.boss) {   // склад у стен логова: патроны и аптечка (бой с боссом долгий)
      var rb = rooms[goal];
      [[rb.x0, rb.y0], [rb.x1, rb.y1], [rb.x1, rb.y0], [rb.x0, rb.y1]].forEach(function (q5, i5) { items.push({ kind: i5 === 3 ? 'med' : 'ammo', x: q5[0] * T + T / 2, y: q5[1] * T + T / 2, v: i5 === 3 ? 50 : 60 }); res(q5[0], q5[1]); });
    }
    caches.forEach(function (c3) { items.push({ kind: 'cache', x: c3.x, y: c3.y, v: 150 + 30 * n }); });
    // россыпь припасов и рой
    var mobCells = []; for (i = 0; i < NC; i++) if (i !== start) mobCells.push(i);
    mobCells.forEach(function (c4) {
      var r = rooms[c4], a, cnt = spec.mobs + (rng() < 0.5 ? 1 : 0) - (zone[c4] === zone[start] ? 1 : 0);
      if (c4 === goal && spec.boss) cnt = 0;
      for (var q3 = 0; q3 < cnt; q3++) { a = freeTile(r); if (a) mobs.push({ type: 'tick', x: a.x, y: a.y }); }
      if (rng() < 0.45) { a = freeTile(r); if (a) items.push({ kind: pick(rng, ['ammo', 'ammo', 'med', 'tok']), x: a.x, y: a.y, v: 0 }); }
    });
    function addKind(type, count, notGoal) {
      var pool = mobCells.filter(function (c5) { return !(notGoal && c5 === goal) && !(spec.boss && c5 === goal); });
      for (var q4 = 0; q4 < count; q4++) { var a = freeTile(rooms[pick(rng, pool)]); if (a) mobs.push({ type: type, x: a.x, y: a.y }); }
    }
    addKind('nest', spec.nests, true); addKind('spike', spec.spikes); addKind('carpet', spec.carpets);
    return {
      n: n, seed: seed || 0, w: W, h: H, pw: W * T, ph: H * T, tiles: tiles, rx: RX, ry: RY, rooms: rooms, start: start, goal: goal,
      path: path, zone: zone, pathZones: pathZones, vaults: vaults, doors: doors, cards: cards, terminals: terminals, items: items,
      mobs: mobs, caches: caches, airlock: air, spawn: spawn, objective: objective, pathDoors: K,
      edges: Object.keys(edges).map(function (k2) { return { a: edges[k2].a, b: edges[k2].b, lock: edges[k2].lock || null }; })
    };
  }

  // ---------- Проходимость палубы: поиск по состояниям «какие двери вскрыты» ----------
  // Регионы — компоненты проходимых тайлов (закрытые двери и перегородки — стены); каждая дверь соединяет два региона.
  // minCards — минимум карт до пульта (босса) и обратно к шлюзу без покупок; deadEnds — состояния без хода (все карты
  // потрачены не туда), в каждом из них должен быть доступен терминал (купить карту) — иначе софтлок.
  function regionsOf(D, tilesArr) {
    var tl = tilesArr || D.tiles, W = D.w, H = D.h, reg = new Int16Array(W * H).fill(-1), nr = 0;
    for (var i = 0; i < W * H; i++) if (tl[i] === FLOOR && reg[i] < 0) {
      var q = [i]; reg[i] = nr;
      while (q.length) { var c = q.pop(), x = c % W, y = (c - x) / W;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = x + d[0], ny = y + d[1]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return; var k = nx + ny * W; if (tl[k] === FLOOR && reg[k] < 0) { reg[k] = nr; q.push(k); } }); }
      nr++;
    }
    return { reg: reg, n: nr };
  }
  function solveDeck(D) {
    var R = regionsOf(D), W = D.w;
    function rAt(x, y) { return R.reg[Math.floor(x / T) + Math.floor(y / T) * W]; }
    var doorAdj = D.doors.map(function (d) {
      var s = {};
      d.tiles.forEach(function (q) { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var k = (q[0] + o[0]) + (q[1] + o[1]) * W; if (R.reg[k] >= 0) s[R.reg[k]] = true; }); });
      return Object.keys(s).map(Number);
    });
    var cardsIn = new Array(R.n).fill(0), term = new Array(R.n).fill(false);
    D.cards.forEach(function (c) { cardsIn[rAt(c.x, c.y)]++; });
    D.terminals.forEach(function (t) { term[rAt(t.x, t.y)] = true; });
    var r0 = rAt(D.spawn.x, D.spawn.y), rGoal = rAt(D.objective.x, D.objective.y), rAir = rAt((D.airlock.x0 + D.airlock.x1) / 2, (D.airlock.y0 + D.airlock.y1) / 2);
    function reach(mask) {
      var got = {}, q = [r0]; got[r0] = true;
      while (q.length) { var r = q.pop(); doorAdj.forEach(function (adj, di) { if (!(mask & (1 << di)) || adj.indexOf(r) < 0) return; adj.forEach(function (o) { if (!got[o]) { got[o] = true; q.push(o); } }); }); }
      return got;
    }
    function pc(m) { var c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
    var seen = {}, q = [0], minCards = -1, deadEnds = 0, softlocks = [], states = 0; seen[0] = true;
    while (q.length) {
      var mask = q.shift(), got = reach(mask), avail = 0, hasTerm = false; states++;
      Object.keys(got).forEach(function (r) { avail += cardsIn[r]; if (term[r]) hasTerm = true; });
      avail -= pc(mask);
      if (got[rGoal] && got[rAir]) { if (minCards < 0 || pc(mask) < minCards) minCards = pc(mask); continue; }
      var moves = 0;
      D.doors.forEach(function (d, di) {
        if (mask & (1 << di)) return; if (!doorAdj[di].some(function (r) { return got[r]; })) return;
        if (avail < 1) return; moves++; var nm = mask | (1 << di); if (!seen[nm]) { seen[nm] = true; q.push(nm); }
      });
      if (!moves) { deadEnds++; if (!hasTerm) softlocks.push(mask); }
    }
    return { ok: minCards >= 0 && softlocks.length === 0, minCards: minCards, cards: D.cards.length, pathDoors: D.pathDoors,
      states: states, deadEnds: deadEnds, softlocks: softlocks, regions: R.n, goalRegion: rGoal, airRegion: rAir, startRegion: r0 };
  }

  // Кратчайший путь по тайлам (BFS, 8 направлений без среза углов) — для таймера эвакуации, бота и тестов.
  function tilePath(D, tiles, sx, sy, gx, gy, passDoor) {
    var W = D.w, H = D.h, s = Math.floor(sx / T) + Math.floor(sy / T) * W, g = Math.floor(gx / T) + Math.floor(gy / T) * W;
    function ok(k) { var v = tiles[k]; return v === FLOOR || (passDoor != null && v === DOOR && passDoor(k)); }
    var prev = new Int32Array(W * H).fill(-2), q = [s], h = 0; prev[s] = -1;
    while (h < q.length) {
      var c = q[h++]; if (c === g) break;
      var x = c % W, y = (c - x) / W;
      for (var d = 0; d < 8; d++) {
        var ox = OCT[d][0], oy = OCT[d][1], nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var k = nx + ny * W; if (prev[k] !== -2 || !ok(k)) continue;
        if (ox && oy && (!ok(x + ox + y * W) || !ok(x + (y + oy) * W))) continue;
        prev[k] = c; q.push(k);
      }
    }
    if (prev[g] === -2) return null;
    var out = [], c2 = g; while (c2 !== -1) { out.push(c2); c2 = prev[c2]; } out.reverse();
    var len = 0; for (var i = 1; i < out.length; i++) { var a = out[i - 1], b = out[i]; len += (a % W !== b % W && Math.floor(a / W) !== Math.floor(b / W)) ? 1.414 : 1; }
    return { tiles: out, len: len * T };
  }
  // Время отсчёта: путь от цели до шлюза при текущих дверях × 2 + запас (рою и темноте — фора)
  function alarmTime(D, tiles, x, y, n) {
    var a = D.airlock, p = tilePath(D, tiles, x, y, (a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
    var len = p ? p.len : D.pw;
    return Math.ceil(len / SPEED * (2 - 0.03 * (n || 1)) + 12);
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(opts.seed || 1);
    var emit = opts.onEvent || function () {};
    var NP = opts.players === 2 ? 2 : 1;
    var S = {
      deck: opts.deck || 1, maxDeck: opts.maxDeck || MAX_DECK, players: NP, score: 0, tokens: opts.tokens != null ? opts.tokens : TOKENS0, cards: 0,
      phase: 'play', phaseT: 0, time: 0, banner: 0, D: null, tiles: null, doors: [], terminals: [], cardsOnFloor: [], items: [],
      heroes: [], enemies: [], bullets: [], sparks: [], booms: [], boss: null, alarm: null, airOpen: false, consoleOn: false,
      term: null, mapOwned: false, lamp: 0, seen: null, flow: null, flowT: 0, ventT: 8, kills: 0, cardsUsed: 0, cardsWasted: 0, bought: {},
      deckStats: []
    };
    var eid = 1;
    for (var i = 0; i < NP; i++) S.heroes.push({ id: i, x: 0, y: 0, hp: HP, lives: LIVES, alive: true, out: false, deadT: 0, inv: 0,
      face: [1, 0], mx: 0, my: 0, fire: false, cd: 0, weapon: 'rivet', guns: { rivet: true }, ammo: AMMO0, armor: false, flameN: 0,
      moving: false, inAir: false, swing: 0, hurtT: 0, kills: 0 });

    function solidT(tx, ty) { if (tx < 0 || ty < 0 || tx >= S.D.w || ty >= S.D.h) return true; return S.tiles[tx + ty * S.D.w] !== FLOOR; }
    function solidAt(x, y) { return solidT(Math.floor(x / T), Math.floor(y / T)); }
    function circleHits(x, y, r) {
      var tx0 = Math.floor((x - r) / T), tx1 = Math.floor((x + r) / T), ty0 = Math.floor((y - r) / T), ty1 = Math.floor((y + r) / T);
      for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
        if (!solidT(tx, ty)) continue;
        var nx = clamp(x, tx * T, tx * T + T), ny = clamp(y, ty * T, ty * T + T);
        if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r) return true;
      }
      return false;
    }
    // Движение круга по тайлам; упёрся в угол проёма прямым ходом — соскальзывает вдоль стены (до 10 px)
    function move(o, dx, dy, r) {
      var hit = false, k, s;
      if (dx) {
        if (!circleHits(o.x + dx, o.y, r)) o.x += dx;
        else { hit = true; if (!dy) for (k = 1; k <= 10; k++) { s = 0; if (!circleHits(o.x + dx, o.y + k, r)) s = 1; else if (!circleHits(o.x + dx, o.y - k, r)) s = -1; if (s) { var sy = s * Math.min(Math.abs(dx), k); if (!circleHits(o.x, o.y + sy, r)) o.y += sy; break; } } }
      }
      if (dy) {
        if (!circleHits(o.x, o.y + dy, r)) o.y += dy;
        else { hit = true; if (!dx) for (k = 1; k <= 10; k++) { s = 0; if (!circleHits(o.x + k, o.y + dy, r)) s = 1; else if (!circleHits(o.x - k, o.y + dy, r)) s = -1; if (s) { var sx = s * Math.min(Math.abs(dy), k); if (!circleHits(o.x + sx, o.y, r)) o.x += sx; break; } } }
      }
      return hit;
    }
    function los(x0, y0, x1, y1) {
      var d = dist(x0, y0, x1, y1), n = Math.ceil(d / 6);
      for (var k = 1; k < n; k++) if (solidAt(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)) return false;
      return true;
    }
    function inAirlock(h) { var a = S.D.airlock; return h.x > a.x0 && h.x < a.x1 && h.y > a.y0 && h.y < a.y1; }
    function roomOf(x, y) {
      var tx = Math.floor(x / T), ty = Math.floor(y / T);
      for (var k = 0; k < S.D.rooms.length; k++) { var r = S.D.rooms[k]; if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r; }
      return null;
    }
    function liveHeroes() { return S.heroes.filter(function (h) { return h.alive && !h.out; }); }

    // ---------- Палуба ----------
    function spawnEnemy(type, x, y, o) {
      var b = ENEMIES[type], dm = 1 + 0.07 * (S.deck - 1);
      var e = { id: eid++, type: type, x: x, y: y, r: b.r, hp: b.hp * (type === 'node' || type === 'vein' ? 1 : dm), max: 0, speed: b.speed * (1 + 0.04 * (S.deck - 1)),
        awake: false, flash: 0, t: rng() * 3, cd: b.cd ? b.cd * (0.5 + rng() * 0.6) : 0, warn: 0, bite: 0, spawnT: b.every ? b.every * rng() : 0, kids: 0, parent: 0, dead: false, vx: 0, vy: 0 };
      if (NP === 2 && !o) e.hp *= 1.5;   // вдвоём рой крепче
      e.max = e.hp; if (o) for (var k in o) e[k] = o[k];
      S.enemies.push(e); return e;
    }
    function loadDeck(n) {
      var D = (opts.decks && opts.decks[n - 1]) || genDeck(n, opts.seed || 0);
      S.D = D; S.deck = n; S.tiles = new Uint8Array(D.tiles); S.seen = new Uint8Array(D.w * D.h);
      S.doors = D.doors.map(function (d) { return { id: d.id, tiles: d.tiles, path: d.path, k: d.k, x: d.x, y: d.y, horiz: d.horiz, open: false, t: 0 }; });
      S.terminals = D.terminals.map(function (t) { return { id: t.id, x: t.x, y: t.y }; });
      S.cardsOnFloor = D.cards.map(function (c) { return { x: c.x, y: c.y, spare: c.spare, taken: false }; });
      S.items = D.items.map(function (it) { return { kind: it.kind, x: it.x, y: it.y, v: it.v, taken: false }; });
      S.enemies = []; S.bullets = []; S.sparks = []; S.booms = []; S.boss = null; S.alarm = null; S.airOpen = false; S.consoleOn = false;
      S.term = null; S.mapOwned = false; S.flow = null; S.flowT = 0; S.ventT = 10; S.phase = 'play'; S.phaseT = 0; S.banner = 2.4;
      D.mobs.forEach(function (m) { spawnEnemy(m.type, m.x, m.y); });
      if (D.objective.kind === 'boss') makeBoss(D.objective.boss, D.objective.x, D.objective.y);
      S.heroes.forEach(function (h, k) {
        h.x = D.spawn.x + (k ? 0 : 0); h.y = D.spawn.y + (k ? 26 : 0) - (NP === 2 ? 13 : 0);
        if (!h.out) { h.alive = true; h.hp = HP; h.inv = 1.5; h.deadT = 0; h.ammo = Math.max(h.ammo, 60); }
        h.face = [1, 0]; h.cd = 0; h.inAir = false;
      });
      S.deckStats.push({ deck: n, cards: 0, doors: 0, t: 0 });
      emit('deck', { n: n });
    }
    function makeBoss(key, x, y) {
      var B = BOSSES[key], room = roomOf(x, y);
      S.boss = { key: key, x: x, y: y, cx: x, cy: y, r: B.r, hp: B.hp, max: B.hp, active: false, intro: 0, dead: false, t: 0, room: room,
        spawnT: 3, ringT: 4, spiralT: 0, spiralA: 0, openT: 0, open: false, rot: 0, nodes: [] };
      for (var k = 0; k < B.nodes; k++) {
        var a = k / B.nodes * Math.PI * 2 + Math.PI / 4;
        var e = spawnEnemy(key === 'matka' ? 'node' : 'vein', x + Math.cos(a) * B.nodeR, y + Math.sin(a) * B.nodeR, { boss: true, slot: a, cd: 1 + k * 0.55 });
        S.boss.nodes.push(e);
      }
    }

    // ---------- Видимость/исследование ----------
    function markSeen() {
      var W = S.D.w;
      S.heroes.forEach(function (h) {
        if (!h.alive || h.out) return;
        var hx = Math.floor(h.x / T), hy = Math.floor(h.y / T), R = 6 + S.lamp * 2;
        for (var ty = hy - R; ty <= hy + R; ty++) for (var tx = hx - R; tx <= hx + R; tx++) {
          if (tx < 0 || ty < 0 || tx >= W || ty >= S.D.h) continue;
          if ((tx - hx) * (tx - hx) + (ty - hy) * (ty - hy) <= R * R) S.seen[tx + ty * W] = 1;
        }
      });
    }
    // Поле расстояний от героев (BFS по тайлам) — рой ползёт по нему вокруг стен
    function buildFlow() {
      var W = S.D.w, H = S.D.h, f = S.flow && S.flow.length === W * H ? S.flow : new Int16Array(W * H);
      f.fill(-1); var q = [], h0 = 0;
      liveHeroes().forEach(function (h) { var k = Math.floor(h.x / T) + Math.floor(h.y / T) * W; if (f[k] < 0) { f[k] = 0; q.push(k); } });
      while (h0 < q.length) {
        var c = q[h0++], x = c % W, y = (c - x) / W; if (f[c] >= 40) continue;
        for (var d = 0; d < 4; d++) { var nx = x + OCT[d * 2][0], ny = y + OCT[d * 2][1]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; var k = nx + ny * W; if (f[k] >= 0 || S.tiles[k] !== FLOOR) continue; f[k] = f[c] + 1; q.push(k); }
      }
      S.flow = f;
    }
    function flowAt(x, y) { var tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= S.D.w || ty >= S.D.h) return -1; return S.flow[tx + ty * S.D.w]; }

    // ---------- Действия героя ----------
    function nearDoor(h) {
      var best = null, bd = USE_R + 14;
      S.doors.forEach(function (d) { if (d.open) return; var dd = dist(h.x, h.y, d.x, d.y); if (dd < bd) { bd = dd; best = d; } });
      return best;
    }
    function nearTerm(h) { var best = null; S.terminals.forEach(function (t) { if (dist(h.x, h.y, t.x, t.y) < USE_R) best = t; }); return best; }
    function nearConsole(h) { var o = S.D.objective; return o.kind === 'console' && !S.consoleOn && dist(h.x, h.y, o.x, o.y) < USE_R + 6; }
    function openDoor(d, pi) {
      d.open = true; d.t = 0;
      d.tiles.forEach(function (q) { S.tiles[q[0] + q[1] * S.D.w] = FLOOR; });
      S.cards--; S.cardsUsed++; S.deckStats[S.deckStats.length - 1].doors++;
      if (!d.path) S.cardsWasted++;
      S.flowT = 0; emit('door', { id: d.id, path: d.path, pi: pi, x: d.x, y: d.y });
    }
    function startAlarm(x, y) {
      var t = alarmTime(S.D, S.tiles, x, y, S.deck);
      S.alarm = { t: t, max: t, last: Math.ceil(t) }; S.airOpen = true; S.ventT = 2;
      emit('alarm', { t: t });
    }
    // Ближайшее, с чем можно взаимодействовать: терминал, пульт или дверь (кто ближе — тот и срабатывает)
    function nearestAct(h) {
      var best = null, t = nearTerm(h), d = nearDoor(h), o = S.D.objective;
      if (t) best = { kind: 'term', obj: t, d: dist(h.x, h.y, t.x, t.y) };
      if (nearConsole(h)) { var dc = dist(h.x, h.y, o.x, o.y); if (!best || dc < best.d) best = { kind: 'console', obj: o, d: dc }; }
      if (d) { var dd = dist(h.x, h.y, d.x, d.y) - 10; if (!best || dd < best.d) best = { kind: 'door', obj: d, d: dd }; }
      return best;
    }
    function use(pi) {
      var h = S.heroes[pi]; if (!h || !h.alive || h.out || S.phase !== 'play') return null;
      var a = nearestAct(h); if (!a) return null;
      if (a.kind === 'term') { S.term = { pi: pi, id: a.obj.id, tab: 0, sel: 0 }; S.phase = 'term'; emit('term', { pi: pi }); return 'term'; }
      if (a.kind === 'console') { S.consoleOn = true; S.score += 1000; emit('console', { x: a.obj.x, y: a.obj.y }); startAlarm(a.obj.x, a.obj.y); return 'console'; }
      if (S.cards > 0) { openDoor(a.obj, pi); return 'door'; }
      emit('doorDenied', { x: a.obj.x, y: a.obj.y }); return 'denied';
    }
    function swap(pi) {
      var h = S.heroes[pi]; if (!h || h.out) return;
      var own = WEAPONS.filter(function (w) { return h.guns[w]; }); if (own.length < 2) return;
      h.weapon = own[(own.indexOf(h.weapon) + 1) % own.length]; emit('swap', { pi: pi, w: h.weapon });
    }
    // Терминал: вкладки 0 — склад, 1 — карта палубы, 2 — сводка
    function termMove(d) { if (!S.term) return; S.term.sel = (S.term.sel + d + SHOP.length) % SHOP.length; emit('termMove'); }
    function termTab(d) { if (!S.term) return; S.term.tab = (S.term.tab + d + 3) % 3; emit('termMove'); }
    function canBuy(pi, id) {
      var h = S.heroes[pi], it = SHOP.filter(function (s) { return s.id === id; })[0]; if (!it || !h) return 'none';
      if (GUN[id] && h.guns[id]) return 'owned';
      if (id === 'map' && S.mapOwned) return 'owned';
      if (id === 'lamp' && S.lamp >= 2) return 'owned';
      if (id === 'armor' && h.armor) return 'owned';
      if (id === 'ammo' && h.ammo >= AMMO_MAX) return 'full';
      if (id === 'med' && h.hp >= HP) return 'full';
      if (S.tokens < it.price) return 'money';
      return 'ok';
    }
    function buy(pi, id) {
      var h = S.heroes[pi], c = canBuy(pi, id); if (c !== 'ok') { emit('noBuy', { why: c }); return c; }
      var it = SHOP.filter(function (s) { return s.id === id; })[0]; S.tokens -= it.price; S.bought[id] = (S.bought[id] || 0) + 1;
      if (id === 'ammo') h.ammo = Math.min(AMMO_MAX, h.ammo + 60);
      else if (id === 'med') h.hp = Math.min(HP, h.hp + 50);
      else if (id === 'card') S.cards++;
      else if (id === 'map') S.mapOwned = true;
      else if (id === 'lamp') S.lamp++;
      else if (id === 'armor') h.armor = true;
      else if (id === 'life') h.lives++;
      else if (GUN[id]) { h.guns[id] = true; h.weapon = id; }
      emit('buy', { pi: pi, id: id }); return 'ok';
    }
    function termBuy() { if (!S.term) return null; if (S.term.tab !== 0) return null; return buy(S.term.pi, SHOP[S.term.sel].id); }
    function termClose() { if (!S.term) return; S.term = null; S.phase = 'play'; emit('termClose'); }

    // ---------- Стрельба ----------
    function aimAssist(h, ang, range) {
      var best = null, bd = 0.4;   // доводка: половина сектора между 8 направлениями — в любую цель можно попасть
      S.enemies.forEach(function (e) {
        if (e.dead) return; var d = dist(h.x, h.y, e.x, e.y); if (d > range || d < 4) return;
        var a = Math.abs(angDiff(Math.atan2(e.y - h.y, e.x - h.x), ang)); if (a < bd && los(h.x, h.y, e.x, e.y)) { bd = a; best = e; }
      });
      if (S.boss && !S.boss.dead && S.boss.active && bossVuln()) { var B = S.boss, d2 = dist(h.x, h.y, B.x, B.y), a2 = Math.abs(angDiff(Math.atan2(B.y - h.y, B.x - h.x), ang)); if (d2 < range && a2 < bd) best = B; }
      return best ? Math.atan2(best.y - h.y, best.x - h.x) : ang;
    }
    function shoot(h) {
      var w = h.weapon, gdef = GUN[w], ang = Math.atan2(h.face[1], h.face[0]);
      if (h.ammo < gdef.ammo || (w === 'flame' && h.ammo < 1)) {   // патроны кончились — разводной ключ
        if (h.ammo > 0 && w !== 'rivet') { h.weapon = 'rivet'; return; }
        var wr = GUN.wrench; h.cd = wr.cd; h.swing = 0.18;
        var hx = h.x + Math.cos(ang) * wr.reach, hy = h.y + Math.sin(ang) * wr.reach;
        S.enemies.forEach(function (e) { if (!e.dead && dist(hx, hy, e.x, e.y) < e.r + 14) hurt(e, wr.dmg, h.id); });
        if (S.boss && !S.boss.dead && dist(hx, hy, S.boss.x, S.boss.y) < S.boss.r + 14) hurtBoss(wr.dmg);
        emit('swing', { pi: h.id }); if (!h.emptyMsg) { h.emptyMsg = true; emit('empty', { pi: h.id, x: h.x, y: h.y }); }
        return;
      }
      h.emptyMsg = false; h.cd = gdef.cd;
      if (w === 'flame') { h.flameN = (h.flameN + 1) % gdef.every; if (!h.flameN) h.ammo--; }
      else h.ammo -= gdef.ammo;
      if (w === 'rivet' || w === 'cutter' || w === 'nail') ang = aimAssist(h, ang, 280);
      var mk = function (a, kind) {
        S.bullets.push({ k: kind, pi: h.id, x: h.x + Math.cos(a) * 3, y: h.y + Math.sin(a) * 3, vx: Math.cos(a) * gdef.speed, vy: Math.sin(a) * gdef.speed,
          dmg: gdef.dmg, r: gdef.r, life: gdef.life, pierce: gdef.pierce || 1, hitIds: {} });
      };
      if (w === 'fan') for (var k = 0; k < gdef.n; k++) mk(ang + (k - (gdef.n - 1) / 2) * gdef.spread, 'p');
      else if (w === 'flame') mk(ang + (rng() - 0.5) * 0.3, 'f');
      else if (w === 'nail') mk(ang + (rng() - 0.5) * gdef.jitter * 2, 'n');
      else mk(ang, w === 'cutter' ? 'c' : 'r');
      emit('shot', { pi: h.id, w: w });
    }
    function hurt(e, dmg, pi) {
      if (e.dead) return;
      if (e.boss && S.boss && S.boss.intro > 0) return;
      e.hp -= dmg; e.flash = 0.08; e.awake = true;
      emit('hit', { x: e.x, y: e.y });
      if (e.hp <= 0) kill(e, pi);
    }
    function kill(e, pi) {
      e.dead = true; var b = ENEMIES[e.type];
      S.score += b.score; S.tokens += b.tokens; S.kills++;
      if (pi != null && S.heroes[pi]) S.heroes[pi].kills++;
      if (e.type === 'carpet') for (var k = 0; k < 2; k++) spawnEnemy('tick', e.x + (k ? 8 : -8), e.y, { awake: true });
      if (e.parent) S.enemies.forEach(function (p) { if (p.id === e.parent) p.kids = Math.max(0, p.kids - 1); });
      if (!e.boss && rng() < 0.16) S.items.push({ kind: rng() < 0.55 ? 'ammo' : 'tok', x: e.x, y: e.y, v: 0, taken: false, drop: 12 });
      emit('kill', { type: e.type, x: e.x, y: e.y, pi: pi });
    }
    function bossVuln() {   // матка — только без катушек; сердце — когда раскрыто или без вен
      var B = S.boss; if (!B || B.dead) return false;
      var alive = B.nodes.filter(function (e) { return !e.dead; }).length;
      return B.key === 'matka' ? alive === 0 : (B.open || alive === 0);
    }
    function hurtBoss(dmg) {
      var B = S.boss; if (!B || B.dead || !B.active || B.intro > 0) return false;
      if (!bossVuln()) { emit('armor', { x: B.x, y: B.y }); return false; }
      B.hp -= dmg; B.flash = 0.08; emit('bossHit', { x: B.x, y: B.y });
      if (B.hp <= 0) {
        B.dead = true; S.score += SCORE.boss; S.tokens += 500;
        S.enemies.forEach(function (e) { if (!e.dead && (e.boss || e.parent === -1)) { e.dead = true; } });
        emit('bossDie', { x: B.x, y: B.y, key: B.key });
        startAlarm(B.x, B.y);
      }
      return true;
    }
    function damageHero(h, dmg, src) {
      if (!h.alive || h.out || h.inv > 0 || S.phase !== 'play') return;
      if (h.armor) dmg *= 0.7;
      h.hp -= dmg; h.hurtT = 0.25; h.inv = Math.max(h.inv, HIT_INV); emit('heroHurt', { pi: h.id, src: src });
      if (h.hp <= 0) killHero(h, src);
    }
    function killHero(h, src) {
      h.hp = 0; h.alive = false; h.lives--; h.deadT = RESPAWN_T;
      emit('heroDie', { pi: h.id, x: h.x, y: h.y, src: src });
      if (h.lives <= 0) { h.out = true; emit('out', { pi: h.id }); }
      if (S.heroes.every(function (q) { return q.out; })) { S.phase = 'over'; emit('gameover'); }
    }

    // ---------- Шаг ----------
    function step(dt) {
      if (S.phase === 'term' || S.phase === 'over' || S.phase === 'won') return;   // терминал — палуба стоит
      S.time += dt; S.phaseT += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.phase === 'clear') {
        if (S.phaseT > 3.2) {
          if (S.deck >= S.maxDeck) { S.phase = 'won'; emit('win'); }
          else loadDeck(S.deck + 1);
        }
        return;
      }
      if (S.phase !== 'play') return;
      S.deckStats[S.deckStats.length - 1].t += dt;
      // герои
      S.heroes.forEach(function (h) {
        if (h.out) return;
        if (!h.alive) {
          h.deadT -= dt;
          if (h.deadT <= 0) {
            h.alive = true; h.hp = HP; h.inv = INV_T; h.ammo = Math.max(h.ammo, 40); emit('respawn', { pi: h.id });
            S.enemies.forEach(function (e) { if (!e.dead && dist(e.x, e.y, h.x, h.y) < 60 && e.speed > 0) { var a = Math.atan2(e.y - h.y, e.x - h.x); move(e, Math.cos(a) * 30, Math.sin(a) * 30, e.r); } });
          }
          return;
        }
        if (h.inv > 0) h.inv -= dt; if (h.hurtT > 0) h.hurtT -= dt; if (h.swing > 0) h.swing -= dt;
        var mx = h.mx, my = h.my, l = Math.sqrt(mx * mx + my * my);
        h.moving = l > 0;
        if (l > 0) {
          if (!h.fire) h.face = [mx, my];
          var sp = SPEED * (h.fire ? 0.82 : 1) * dt / l, dx = mx * sp, dy = my * sp;
          if (NP === 2) {   // кооп: оба героя всегда в одном кадре
            var o = S.heroes[1 - h.id];
            if (o && !o.out && o.alive) {
              if (Math.abs(h.x + dx - o.x) > VIEW_W - 90 && Math.abs(h.x + dx - o.x) > Math.abs(h.x - o.x)) dx = 0;
              if (Math.abs(h.y + dy - o.y) > VIEW_H - 90 && Math.abs(h.y + dy - o.y) > Math.abs(h.y - o.y)) dy = 0;
            }
          }
          move(h, dx, dy, HERO_R);
        }
        if (h.cd > 0) h.cd -= dt;
        if (h.fire && h.cd <= 0) shoot(h);
        h.inAir = inAirlock(h);
        // предметы
        S.cardsOnFloor.forEach(function (c) { if (!c.taken && dist(h.x, h.y, c.x, c.y) < PICK_R + 4) { c.taken = true; S.cards++; S.score += SCORE.card; S.deckStats[S.deckStats.length - 1].cards++; emit('card', { x: c.x, y: c.y, pi: h.id }); } });
        S.items.forEach(function (it) {
          if (it.taken || dist(h.x, h.y, it.x, it.y) > PICK_R) return;
          if (it.kind === 'med' && h.hp >= HP) return;
          if (it.kind === 'ammo' && h.ammo >= AMMO_MAX) return;
          it.taken = true;
          if (it.kind === 'med') h.hp = Math.min(HP, h.hp + (it.v || 35));
          else if (it.kind === 'ammo') h.ammo = Math.min(AMMO_MAX, h.ammo + (it.v || (it.drop ? 15 : 30)));
          else if (it.kind === 'tok') S.tokens += it.v || (it.drop ? 12 : 40);
          else if (it.kind === 'cache') { S.tokens += it.v; h.ammo = Math.min(AMMO_MAX, h.ammo + 40); S.score += SCORE.cache; }
          emit('pickup', { kind: it.kind, x: it.x, y: it.y, pi: h.id });
        });
      });
      // пули
      S.bullets.forEach(function (b) {
        var sub = 3;
        for (var s2 = 0; s2 < sub && b.life > 0; s2++) {
          b.x += b.vx * dt / sub; b.y += b.vy * dt / sub;
          var tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
          if (solidT(tx, ty)) {
            var v = tx >= 0 && ty >= 0 && tx < S.D.w && ty < S.D.h ? S.tiles[tx + ty * S.D.w] : WALL;
            if (b.k === 'c' && v === PART) { S.tiles[tx + ty * S.D.w] = FLOOR; S.flowT = 0; emit('breach', { x: tx * T + T / 2, y: ty * T + T / 2 }); }
            b.life = 0; emit('wallHit', { x: b.x, y: b.y, k: b.k }); break;
          }
          for (var q = 0; q < S.enemies.length; q++) {
            var e = S.enemies[q]; if (e.dead || b.hitIds[e.id]) continue;
            if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) { b.hitIds[e.id] = 1; hurt(e, b.dmg, b.pi); if (--b.pierce <= 0) { b.life = 0; break; } }
          }
          var B = S.boss;
          if (b.life > 0 && B && !B.dead && B.active && !b.hitIds.boss && dist(b.x, b.y, B.x, B.y) < B.r + b.r) { b.hitIds.boss = 1; hurtBoss(b.dmg); if (--b.pierce <= 0) b.life = 0; }
        }
        b.life -= dt;
      });
      S.bullets = S.bullets.filter(function (b) { return b.life > 0; });
      // искры роя
      S.sparks.forEach(function (s) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        if (solidAt(s.x, s.y)) s.life = 0;
        S.heroes.forEach(function (h) { if (s.life > 0 && h.alive && !h.out && dist(s.x, s.y, h.x, h.y) < HERO_R + SPARK_R - 2) { s.life = 0; damageHero(h, SPARK_DMG, 'spark'); } });
      });
      S.sparks = S.sparks.filter(function (s) { return s.life > 0; });
      // рой
      S.flowT -= dt; if (S.flowT <= 0) { buildFlow(); S.flowT = 0.25; }
      var hs = liveHeroes();
      S.enemies.forEach(function (e) { if (!e.dead) enemyStep(e, dt, hs); });
      // раздвигаем рой
      var en = S.enemies;
      for (var a = 0; a < en.length; a++) for (var b2 = a + 1; b2 < en.length; b2++) {
        var A = en[a], Bq = en[b2]; if (A.dead || Bq.dead || (!A.speed && !Bq.speed)) continue;
        var dx2 = Bq.x - A.x, dy2 = Bq.y - A.y, rr = A.r + Bq.r - 2, d2 = dx2 * dx2 + dy2 * dy2;
        if (d2 < rr * rr && d2 > 0.01) { var dd = Math.sqrt(d2), push = (rr - dd) / 2, ux = dx2 / dd * push, uy = dy2 / dd * push;
          if (A.speed) move(A, -ux, -uy, A.r); if (Bq.speed) move(Bq, ux, uy, Bq.r); }
      }
      S.enemies = S.enemies.filter(function (e) { return !e.dead; });
      if (S.boss && !S.boss.dead) bossStep(S.boss, dt, hs);
      // вентиляция: окалинные клещи выползают в темноте (во время тревоги — чаще)
      S.ventT -= dt;
      if (S.ventT <= 0 && hs.length) {
        S.ventT = S.alarm ? Math.max(1.6, 3.4 - 0.2 * S.deck) : 13 - Math.min(5, S.deck);
        var near = S.enemies.filter(function (e) { return hs.some(function (h) { return dist(h.x, h.y, e.x, e.y) < 300; }); }).length;
        if (near < (S.alarm ? 7 : 3) + NP - 1) ventSpawn(pick(rng, hs), (S.alarm ? 1 + (rng() < 0.4 + 0.05 * S.deck ? 1 : 0) : 1) + (NP === 2 && rng() < 0.5 ? 1 : 0));
      }
      S.doors.forEach(function (d) { if (d.open) d.t += dt; });
      if (Math.floor(S.time * 5) !== Math.floor((S.time - dt) * 5)) markSeen();
      // эвакуация
      if (S.alarm) {
        S.alarm.t -= dt;
        var sec = Math.ceil(S.alarm.t); if (sec !== S.alarm.last) { S.alarm.last = sec; if (sec <= 10 && sec >= 0) emit('countdown', { s: sec }); }
        var need = S.heroes.filter(function (h) { return !h.out; });
        if (need.length && need.every(function (h) { return h.alive && inAirlock(h); })) {
          var left = Math.max(0, Math.ceil(S.alarm.t)), bonus = SCORE.deck * S.deck + left * SCORE.sec;
          S.score += bonus; S.tokens += 100 + left * 2;
          S.phase = 'clear'; S.phaseT = 0; S.lastBonus = bonus; S.lastLeft = left; S.alarm.done = true; emit('clear', { deck: S.deck, bonus: bonus, left: left });
        } else if (S.alarm.t <= 0) {
          // взрыв: кто не в шлюзе — теряет жизнь (бригада спасателей вытаскивает выживших)
          emit('blast', {});
          S.heroes.forEach(function (h) { if (!h.out && !(h.alive && inAirlock(h))) { h.lives--; if (h.lives <= 0) { h.out = true; h.alive = false; emit('out', { pi: h.id }); } } });
          if (S.heroes.every(function (h) { return h.out; })) { S.phase = 'over'; emit('gameover'); }
          else { S.phase = 'clear'; S.phaseT = 0; S.lastBonus = 0; S.lastLeft = 0; S.alarm.done = true; emit('clear', { deck: S.deck, bonus: 0, left: 0, blast: true }); }
        }
      }
    }
    function ventSpawn(h, n) {
      var W = S.D.w;
      for (var tries = 0; tries < 40 && n > 0; tries++) {
        var a = rng() * Math.PI * 2, d = 200 + rng() * 120, x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
        if (x < T || y < T || x > S.D.pw - T || y > S.D.ph - T) continue;
        var tx = Math.floor(x / T), ty = Math.floor(y / T), f = S.flow ? S.flow[tx + ty * W] : -1;
        if (S.tiles[tx + ty * W] !== FLOOR || f < 6 || f > 22) continue;
        if (inAirlock({ x: x, y: y })) continue;
        spawnEnemy('tick', tx * T + T / 2, ty * T + T / 2, { awake: true, vent: true }); n--; emit('vent', { x: x, y: y });
      }
    }
    function nearestHero(e, hs) { var best = null, bd = 1e9; hs.forEach(function (h) { var d = dist(h.x, h.y, e.x, e.y); if (d < bd) { bd = d; best = h; } }); return best ? { h: best, d: bd } : null; }
    function enemyStep(e, dt, hs) {
      var b = ENEMIES[e.type]; e.t += dt; if (e.flash > 0) e.flash -= dt; if (e.bite > 0) e.bite -= dt;
      var nh = nearestHero(e, hs); if (!nh) return;
      var h = nh.h, d = nh.d;
      if (!e.awake && d < 300 && (los(e.x, e.y, h.x, h.y) || d < 120)) { e.awake = true; emit('wake', { type: e.type }); }
      if (e.boss) {   // узлы босса держатся вокруг него
        var B = S.boss; if (!B) return;
        var aa = e.slot + B.rot, R = BOSSES[B.key].nodeR; e.x = B.x + Math.cos(aa) * R; e.y = B.y + Math.sin(aa) * R;
        if (!B.active || B.intro > 0) return;
        e.cd -= dt;
        if (e.warn > 0) { e.warn -= dt; if (e.warn <= 0) { fireSpark(e.x, e.y, Math.atan2(h.y - e.y, h.x - e.x), 175); e.cd = 2.2 + rng() * 0.6; } }
        else if (e.cd <= 0 && d < 340) { e.warn = 0.45; emit('sparkWarn', {}); }
      } else if (e.type === 'spike') {
        e.cd -= dt;
        if (e.warn > 0) { e.warn -= dt; if (e.warn <= 0) { fireSpark(e.x, e.y, Math.atan2(h.y - e.y, h.x - e.x), b.spark); e.cd = b.cd; } }
        else if (e.awake && e.cd <= 0 && d < b.range && los(e.x, e.y, h.x, h.y)) { e.warn = b.warn; emit('sparkWarn', {}); }
      } else if (e.type === 'nest') {
        if (e.awake && d < b.range) { e.spawnT -= dt; if (e.spawnT <= 0 && e.kids < b.max) { e.spawnT = b.every; var a = rng() * Math.PI * 2; var k = spawnEnemy('tick', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, { awake: true, parent: e.id }); if (circleHits(k.x, k.y, k.r)) { k.x = e.x; k.y = e.y; } e.kids++; emit('spawn', { type: 'tick' }); } }
      } else if (e.awake && e.speed > 0) {
        var gx, gy, f = flowAt(e.x, e.y);
        if (d < 40 || f <= 1 || (d < 140 && los(e.x, e.y, h.x, h.y))) { gx = h.x; gy = h.y; }
        else if (f > 0) {
          var tx = Math.floor(e.x / T), ty = Math.floor(e.y / T), bestF = f, bx = tx, by = ty;
          for (var q = 0; q < 8; q++) {
            var nx = tx + OCT[q][0], ny = ty + OCT[q][1]; if (solidT(nx, ny)) continue;
            if (OCT[q][0] && OCT[q][1] && (solidT(tx + OCT[q][0], ty) || solidT(tx, ty + OCT[q][1]))) continue;
            var fv = S.flow[nx + ny * S.D.w]; if (fv >= 0 && fv < bestF) { bestF = fv; bx = nx; by = ny; }
          }
          gx = bx * T + T / 2; gy = by * T + T / 2;
        } else { gx = e.x; gy = e.y; }
        var dx = gx - e.x, dy = gy - e.y, l = Math.sqrt(dx * dx + dy * dy);
        if (l > 0.5) {
          var wob = e.type === 'tick' ? Math.sin(e.t * 9 + e.id) * 0.35 : 0, ca = Math.cos(wob), sa = Math.sin(wob);
          var ux = dx / l, uy = dy / l, vx = ux * ca - uy * sa, vy = ux * sa + uy * ca, sp = e.speed * (S.alarm ? 1.12 : 1) * dt;
          move(e, vx * sp, vy * sp, e.r); e.vx = vx; e.vy = vy;
        }
      }
      // касание
      hs.forEach(function (hh) {
        if (e.bite <= 0 && dist(e.x, e.y, hh.x, hh.y) < e.r + HERO_R - 1) {
          damageHero(hh, b.dmg * (1 + 0.08 * (S.deck - 1)), e.type); e.bite = b.bite;
          if (e.speed > 0) { var ka = Math.atan2(e.y - hh.y, e.x - hh.x); move(e, Math.cos(ka) * 14, Math.sin(ka) * 14, e.r); }   // отскок после укуса
        }
      });
    }
    function fireSpark(x, y, a, sp) { S.sparks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2.4 }); emit('spark', {}); }
    function bossStep(B, dt, hs) {
      if (B.flash > 0) B.flash -= dt;
      var r = B.room;
      if (!B.active) {
        if (hs.some(function (h) { var tx = Math.floor(h.x / T), ty = Math.floor(h.y / T); return tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1; })) { B.active = true; B.intro = 1.6; emit('bossIntro', { key: B.key }); }
        return;
      }
      if (B.intro > 0) { B.intro -= dt; return; }
      B.t += dt;
      var nh = hs.length ? hs.reduce(function (a, h) { return dist(h.x, h.y, B.x, B.y) < dist(a.x, a.y, B.x, B.y) ? h : a; }) : null;
      var alive = B.nodes.filter(function (e) { return !e.dead; }).length, rage = alive === 0;
      if (B.key === 'matka') {
        B.rot += dt * (rage ? 0.9 : 0.4);
        B.spawnT -= dt;
        var mine = S.enemies.filter(function (e) { return e.parent === -1; }).length;
        if (B.spawnT <= 0) { B.spawnT = rage ? 3.4 : 4.6; if (mine < 6) { for (var k = 0; k < 2; k++) { var a = rng() * Math.PI * 2; spawnEnemy('tick', B.x + Math.cos(a) * 44, B.y + Math.sin(a) * 44, { awake: true, parent: -1 }); } emit('spawn', { type: 'tick' }); } }
        B.ringT -= dt;
        if (B.ringT <= 0) { B.ringT = rage ? 3.0 : 4.4; var n = rage ? 12 : 9, off = rng() * 6; for (k = 0; k < n; k++) fireSpark(B.x, B.y, off + k / n * Math.PI * 2, 130); emit('ring', {}); }
      } else {
        B.rot += dt * 0.8;
        var tt = B.t * 0.5; B.x = B.cx + Math.cos(tt) * 46; B.y = B.cy + Math.sin(tt * 1.3) * 26;
        B.openT += dt; var cyc = rage ? 3.2 : 4.2, was = B.open; B.open = (B.openT % cyc) > cyc - 2.2;
        if (B.open && !was) { var n2 = 10; for (var q = 0; q < n2; q++) fireSpark(B.x, B.y, q / n2 * Math.PI * 2 + B.t, 120); emit('ring', {}); emit('heartOpen', {}); }
        if (!B.open) { B.spiralT -= dt; if (B.spiralT <= 0) { B.spiralT = rage ? 0.16 : 0.24; B.spiralA += 0.55; fireSpark(B.x, B.y, B.spiralA, 125); if (rage) fireSpark(B.x, B.y, B.spiralA + Math.PI, 125); } }
        B.spawnT -= dt;
        var mine2 = S.enemies.filter(function (e) { return e.parent === -1; }).length;
        if (B.spawnT <= 0) { B.spawnT = rage ? 6 : 8; if (mine2 < 4) { spawnEnemy(rng() < 0.5 ? 'carpet' : 'tick', B.x, B.y + B.r + 18, { awake: true, parent: -1 }); emit('spawn', { type: 'carpet' }); } }
      }
      hs.forEach(function (h) { if (dist(h.x, h.y, B.x, B.y) < B.r + HERO_R) { damageHero(h, 18, 'boss'); var a = Math.atan2(h.y - B.y, h.x - B.x); move(h, Math.cos(a) * 18, Math.sin(a) * 18, HERO_R); } });
      void nh;
    }

    var api = {
      start: function () { loadDeck(S.deck); return api; },
      update: function (dt) { var n = Math.max(1, Math.ceil(dt / (1 / 60))), h = dt / n; for (var k = 0; k < n; k++) step(h); },
      setMove: function (pi, dx, dy) { var h = S.heroes[pi]; if (h) { h.mx = clamp(dx, -1, 1); h.my = clamp(dy, -1, 1); } },
      setFire: function (pi, on) { var h = S.heroes[pi]; if (h) h.fire = !!on; },
      use: use, swap: swap, termMove: termMove, termTab: termTab, termBuy: termBuy, termClose: termClose, buy: buy, canBuy: canBuy,
      hint: function (pi) {   // что сделает «действие» рядом с героем (для подсказки на экране и бота)
        var h = S.heroes[pi]; if (!h || !h.alive || h.out || S.phase !== 'play') return null;
        var a = nearestAct(h); if (!a) return null;
        return a.kind === 'door' ? (S.cards > 0 ? 'door' : 'locked') : a.kind;
      },
      state: function () { return S; },
      _S: S, _spawn: spawnEnemy, _loadDeck: loadDeck, _los: los, _solidAt: solidAt, _circleHits: circleHits, _kill: killHero,
      _hurtBoss: hurtBoss, _bossVuln: bossVuln, _startAlarm: startAlarm, _buildFlow: buildFlow, _openDoor: openDoor, _inAirlock: inAirlock, _roomOf: roomOf
    };
    return api;
  }

  G.Game = Game;
  G.logic = {
    T: T, VIEW_W: VIEW_W, VIEW_H: VIEW_H, HUD: HUD, SCREEN_H: SCREEN_H, CW: CW, CH: CH, FLOOR: FLOOR, WALL: WALL, PART: PART, DOOR: DOOR,
    SPEED: SPEED, HERO_R: HERO_R, HP: HP, LIVES: LIVES, AMMO0: AMMO0, AMMO_MAX: AMMO_MAX, TOKENS0: TOKENS0, USE_R: USE_R,
    DECKS: DECKS, MAX_DECK: MAX_DECK, GUN: GUN, WEAPONS: WEAPONS, ENEMIES: ENEMIES, SHOP: SHOP, SCORE: SCORE, BOSSES: BOSSES, BIND: BIND, OCT: OCT,
    mulberry32: mulberry32, genDeck: genDeck, solveDeck: solveDeck, regionsOf: regionsOf, tilePath: tilePath, alarmTime: alarmTime, oct: oct, dist: dist
  };
})(typeof window !== 'undefined' ? window : globalThis);
