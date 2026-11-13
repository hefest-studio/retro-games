/* ПАРОВИКИ · логика игры (чистый JS, без DOM — тестируется в Node). PAROVIKI.logic + PAROVIKI.Game(opts).
   Два вольных паровика-подрядчика мастерской «Гефест» гасят взбесившуюся Паровую Машину Губернии.
   Уровень — лабиринт с видом сверху: открой все узлы-вентили → откроется шлюз-выход. Ключи открывают
   двери, рычаги — заслонки, трещины в стенах прячут тайники. 4 мира × 4 уровня + механизм-босс мира.
   Второго героя ведёт ИИ-напарник (если игрок один) или второй человек. Между уровнями — лавка. */
(function (global) {
  'use strict';
  var PV = global.PAROVIKI = global.PAROVIKI || {};

  // ---------- Константы ----------
  var T = 32, W = 640, VH = 480, HUD = 32, SCREEN_H = VH + HUD;
  var WORLDS = 4, LEVELS = 5;                 // уровень 5 мира — арена механизма-босса
  var TILE = { FLOOR: 0, WALL: 1, CRACK: 2, DOOR: 3, BAR: 4, PIT: 5, CRATE: 6, NEST: 7 };
  var WALK_SOLID = [false, true, true, true, true, true, true, true];
  var SHOT_SOLID = [false, true, true, true, true, false, true, true];
  var MAX_EN = 90;   // предел живых чудищ на уровне (литейки ждут)
  var HERO_R = 11, VALVE_T = 0.6, START_LIVES = 3, CONTINUES = 2, CONT_T = 10;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // ---------- Герои: стволы, спецприёмы, деревья лавки ----------
  var HEROES = [
    { key: 'klepa', hp: 100, spd: 128, gun: 'rivet', spec: 'heal', tree: ['speed', 'life'] },
    { key: 'gudok', hp: 125, spd: 106, gun: 'steam', spec: 'bomb', tree: ['armor', 'life'] },
    { key: 'shest', hp: 105, spd: 118, gun: 'saw', spec: 'shield', tree: ['magnet', 'speed'] },
    { key: 'fonar', hp: 90, spd: 124, gun: 'bolt', spec: 'chart', tree: ['regen', 'life'] }
  ];
  // Ступени ствола (1..4). n — пуль, sp — веер (рад), par — параллельный разнос (px), v — скорость, rate — выстр./с,
  // range — дальность, splash — радиус разрыва, bounce — рикошетов, pierce — сквозь скольких.
  var GUNS = {
    rivet: [{ n: 1, v: 430, dmg: 1, rate: 6.5, range: 340 }, { n: 2, par: 9, v: 440, dmg: 1, rate: 6.5, range: 350 },
            { n: 3, sp: 0.16, v: 450, dmg: 1.1, rate: 6.8, range: 360 }, { n: 5, sp: 0.12, v: 460, dmg: 1.15, rate: 7.4, range: 370 }],
    steam: [{ n: 1, v: 300, dmg: 2.3, rate: 3, range: 270, r: 6 }, { n: 1, v: 310, dmg: 2.4, rate: 3.2, range: 280, r: 7, splash: 30 },
            { n: 1, v: 320, dmg: 2.8, rate: 3.4, range: 290, r: 8, splash: 40 }, { n: 2, sp: 0.2, v: 330, dmg: 2.9, rate: 3.5, range: 300, r: 8, splash: 44 }],
    saw:   [{ n: 1, v: 350, dmg: 1.6, rate: 3.6, range: 520, bounce: 1, pierce: 2, r: 6 }, { n: 1, v: 360, dmg: 1.7, rate: 3.8, range: 560, bounce: 2, pierce: 2, r: 6 },
            { n: 2, sp: 0.26, v: 370, dmg: 1.8, rate: 3.8, range: 580, bounce: 2, pierce: 3, r: 6 }, { n: 3, sp: 0.22, v: 380, dmg: 1.9, rate: 4, range: 620, bounce: 3, pierce: 3, r: 7 }],
    bolt:  [{ n: 1, v: 620, dmg: 1.3, rate: 4.2, range: 430, pierce: 2 }, { n: 1, v: 640, dmg: 1.5, rate: 4.4, range: 450, pierce: 3 },
            { n: 1, v: 660, dmg: 1.7, rate: 4.8, range: 470, pierce: 4 }, { n: 2, par: 8, v: 680, dmg: 1.8, rate: 5, range: 490, pierce: 5 }]
  };
  // Лавка: цены по уровням (null — предел). У каждого героя дерево: ствол, котёл (+здоровье), латка (лечение),
  // заряд спецприёма и две ветки мастерства (у каждого своя пара).
  var SHOP = {
    gun: [300, 700, 1300], hp: [250, 500, 800], heal: 40, spec: 150, SPEC_MAX: 3,
    speed: [200, 400, 700], armor: [250, 500, 850], magnet: [150, 300, 500], regen: [250, 500, 850], life: [600, 1200]
  };
  var SHOP_ITEMS = function (hid) { return ['gun', 'hp', 'heal', 'spec', HEROES[hid].tree[0], HEROES[hid].tree[1], 'ready']; };

  // ---------- Враги ----------
  var EN = {
    tin:     { r: 11, hp: 4, spd: 82, dmg: 14, pts: 50, coin: 0.35 },
    bug:     { r: 8, hp: 2, spd: 135, dmg: 9, pts: 30, coin: 0.15 },
    whistle: { r: 12, hp: 5, spd: 55, dmg: 12, pts: 80, coin: 0.5 },
    heavy:   { r: 15, hp: 14, spd: 55, dmg: 24, pts: 150, coin: 0.9 },
    nest:    { r: 15, hp: 18, spd: 0, dmg: 0, pts: 300, coin: 1 }
  };
  var WORLD_MIX = [null, ['tin', 'tin', 'bug', 'bug'], ['tin', 'bug', 'whistle', 'tin'], ['tin', 'bug', 'whistle', 'heavy'], ['tin', 'whistle', 'heavy', 'bug', 'heavy']];
  var BOSSES = [null, { key: 'drill', hp: 280, r: 34 }, { key: 'crane', hp: 360, r: 38 }, { key: 'pendulum', hp: 420, r: 34 }, { key: 'machine', hp: 600, r: 54 }];
  var SCORE = { valve: 250, level: 1000, boss: 5000, crate: 10 };

  // ---------- Раскладки (И1 — стрелки, И2 — WASD; в одиночке обе ведут И1) ----------
  var BIND = {
    p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], fire: ['Slash', 'Period', 'Space'], spec: ['Comma', 'ShiftRight'] },
    p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], fire: ['KeyF', 'ShiftLeft'], spec: ['KeyG', 'KeyQ'] }
  };

  // ======================================================================
  // Генератор уровней-лабиринтов
  // Ячейка лабиринта — 3×3 клетки пола + стена толщиной 1; проходы между ячейками — 3 клетки в ширину.
  // ======================================================================
  function cellCenter(cx, cy) { return { tx: cx * 4 + 2, ty: cy * 4 + 2 }; }
  function linkTiles(a, b) { // клетки прохода между соседними ячейками
    var out = [];
    if (a.cy === b.cy) { var x = Math.max(a.cx, b.cx) * 4; for (var i = 1; i <= 3; i++) out.push([x, a.cy * 4 + i]); }
    else { var y = Math.max(a.cy, b.cy) * 4; for (var j = 1; j <= 3; j++) out.push([a.cx * 4 + j, y]); }
    return out;
  }
  function levelDims(world, lvl) { return { CW: 7 + (lvl > 2 ? 1 : 0) + (world > 2 ? 1 : 0), CH: 5 + (lvl > 3 ? 1 : 0) + (world > 1 ? 1 : 0) }; }
  function valveCount(world, lvl) { return Math.min(6, 2 + world + (lvl >= 3 ? 1 : 0)); }

  function genLevel(world, lvl, seed) {
    if (lvl >= LEVELS) return genBoss(world);
    for (var att = 0; att < 40; att++) {
      var m = tryGen(world, lvl, ((seed | 0) * 7919 + world * 1009 + lvl * 131 + att * 31337) >>> 0);
      if (m && solveLevel(m).ok) return m;
    }
    throw new Error('genLevel: не удалось построить уровень ' + world + '-' + lvl);
  }

  function tryGen(world, lvl, s) {
    var rng = mulberry32(s), d = levelDims(world, lvl), CW = d.CW, CH = d.CH, TW = CW * 4 + 1, TH = CH * 4 + 1;
    var tiles = new Uint8Array(TW * TH).fill(TILE.WALL);
    function set(x, y, v) { tiles[y * TW + x] = v; }
    var cells = [], ci = function (cx, cy) { return cy * CW + cx; };
    for (var cy = 0; cy < CH; cy++) for (var cx = 0; cx < CW; cx++) {
      cells.push({ cx: cx, cy: cy, n: [] });
      for (var a = 1; a <= 3; a++) for (var b = 1; b <= 3; b++) set(cx * 4 + a, cy * 4 + b, TILE.FLOOR);
    }
    var links = [];          // открытые проходы {a,b}
    function link(i, j) { cells[i].n.push(j); cells[j].n.push(i); links.push({ a: i, b: j }); linkTiles(cells[i], cells[j]).forEach(function (p) { set(p[0], p[1], TILE.FLOOR); }); }
    function nb(i) { var c = cells[i], o = []; if (c.cx > 0) o.push(i - 1); if (c.cx < CW - 1) o.push(i + 1); if (c.cy > 0) o.push(i - CW); if (c.cy < CH - 1) o.push(i + CW); return o; }
    // старт — нижний ряд, у края
    var start = ci(rng() < 0.5 ? 0 : CW - 1, CH - 1);
    var seen = new Uint8Array(cells.length), stack = [start]; seen[start] = 1;
    while (stack.length) {
      var cur = stack[stack.length - 1], opts = nb(cur).filter(function (k) { return !seen[k]; });
      if (!opts.length) { stack.pop(); continue; }
      var nx = opts[Math.floor(rng() * opts.length)]; seen[nx] = 1; link(cur, nx); stack.push(nx);
    }
    // петли: часть стен между ячейками убираем (лабиринт не только из тупиков)
    for (var i = 0; i < cells.length; i++) nb(i).forEach(function (j) { if (j > i && cells[i].n.indexOf(j) < 0 && rng() < 0.16) link(i, j); });
    // залы: столб между 4 связанными ячейками убираем
    for (cy = 0; cy < CH - 1; cy++) for (cx = 0; cx < CW - 1; cx++) {
      var c0 = ci(cx, cy), c1 = c0 + 1, c2 = c0 + CW, c3 = c2 + 1;
      if (cells[c0].n.indexOf(c1) >= 0 && cells[c0].n.indexOf(c2) >= 0 && cells[c1].n.indexOf(c3) >= 0 && cells[c2].n.indexOf(c3) >= 0 && rng() < 0.75) set(cx * 4 + 4, cy * 4 + 4, TILE.FLOOR);
    }
    function bfsCells(from, blocked) {
      var dd = new Int16Array(cells.length).fill(-1), q = [from]; dd[from] = 0;
      while (q.length) { var k = q.shift(); cells[k].n.forEach(function (j) { if (dd[j] < 0 && !(blocked && blocked(k, j))) { dd[j] = dd[k] + 1; q.push(j); } }); }
      return dd;
    }
    var dist0 = bfsCells(start), exit = 0;
    for (i = 0; i < cells.length; i++) if (dist0[i] > dist0[exit]) exit = i;
    var used = {}; used[start] = 'start'; used[exit] = 'exit';
    // тайники: тупиковая ячейка за треснувшей стеной (её проход — трещина, сама ячейка — с сундуком)
    var secrets = [], deadEnds = [];
    for (i = 0; i < cells.length; i++) if (cells[i].n.length === 1 && !used[i] && dist0[i] > 2) deadEnds.push(i);
    var nSecret = Math.min(deadEnds.length, 1 + (lvl % 2));
    for (var k = 0; k < nSecret; k++) {
      var di = deadEnds.splice(Math.floor(rng() * deadEnds.length), 1)[0], other = cells[di].n[0];
      var lt = linkTiles(cells[di], cells[other]);
      lt.forEach(function (p, ix) { set(p[0], p[1], ix === 1 ? TILE.CRACK : TILE.WALL); });
      // проход становится закрытым: убираем связь из графа
      cells[di].n = []; cells[other].n = cells[other].n.filter(function (z) { return z !== di; });
      links = links.filter(function (L2) { return !((L2.a === di && L2.b === other) || (L2.a === other && L2.b === di)); });
      used[di] = 'secret'; secrets.push(di);
    }
    // мосты графа ячеек → кандидаты для дверей/заслонок
    function farSide(a, b) { var dd = bfsCells(start, function (x, y) { return (x === a && y === b) || (x === b && y === a); }); var side = []; for (var z = 0; z < cells.length; z++) if (dd[z] < 0 && used[z] !== 'secret') side.push(z); return side; }
    var bridges = [];
    links.forEach(function (L2) {
      var side = farSide(L2.a, L2.b); if (side.length < 2 || side.length > cells.length * 0.6) return;
      var near = dist0[L2.a] < dist0[L2.b] ? L2.a : L2.b, far = near === L2.a ? L2.b : L2.a;
      if (near === start) return;
      bridges.push({ near: near, far: far, side: side });
    });
    for (i = bridges.length - 1; i > 0; i--) { var r = Math.floor(rng() * (i + 1)), tmp = bridges[i]; bridges[i] = bridges[r]; bridges[r] = tmp; }
    var nDoor = (world + lvl >= 3 ? 1 : 0) + (lvl >= 3 ? 1 : 0), nBar = lvl >= 2 ? 1 : 0;
    var groups = [], gid = 0, taken = {};
    function pickBridge() {
      for (var q = 0; q < bridges.length; q++) {
        var B = bridges[q]; if (taken[B.near + ':' + B.far]) continue;
        // мосты не вкладываются друг в друга по одной стороне (проще и честнее)
        if (groups.some(function (G2) { return G2.side.indexOf(B.near) >= 0 || B.side.indexOf(G2.near) >= 0; })) continue;
        taken[B.near + ':' + B.far] = 1; return B;
      }
      return null;
    }
    for (k = 0; k < nDoor + nBar; k++) {
      var B = pickBridge(); if (!B) break;
      var kind = k < nDoor ? 'door' : 'bar';
      var gtiles = linkTiles(cells[B.near], cells[B.far]);
      gtiles.forEach(function (p) { set(p[0], p[1], kind === 'door' ? TILE.DOOR : TILE.BAR); });
      groups.push({ id: gid++, kind: kind, tiles: gtiles, near: B.near, far: B.far, side: B.side, open: false });
    }
    var blockedAll = function (x, y) { return groups.some(function (G2) { return (G2.near === x && G2.far === y) || (G2.near === y && G2.far === x); }); };
    var startReach = bfsCells(start, blockedAll);
    var objs = [];
    function free(pred) { var o = []; for (var z = 0; z < cells.length; z++) if (!used[z] && pred(z)) o.push(z); return o; }
    function place(kind, cellIdx, extra) { used[cellIdx] = kind; var c = cellCenter(cells[cellIdx].cx, cells[cellIdx].cy); var o = Object.assign({ kind: kind, x: c.tx * T + T / 2, y: c.ty * T + T / 2, cell: cellIdx }, extra || {}); objs.push(o); return o; }
    function pickFrom(list) { return list.length ? list.splice(Math.floor(rng() * list.length), 1)[0] : -1; }
    // ключи — все в стартовой зоне (без единой двери/заслонки): любой порядок открывания честен
    var nKeys = groups.filter(function (G2) { return G2.kind === 'door'; }).length;
    for (k = 0; k < nKeys; k++) { var kc = pickFrom(free(function (z) { return startReach[z] > 0; })); if (kc < 0) return null; place('key', kc); }
    // рычаги — достижимы с открытыми дверями (ключи есть всегда), но при закрытых заслонках
    groups.forEach(function (G2) {
      if (G2.kind !== 'bar') return;
      var reach = bfsCells(start, function (x, y) { return groups.some(function (G3) { return G3.kind === 'bar' && ((G3.near === x && G3.far === y) || (G3.near === y && G3.far === x)); }); });
      var lc = pickFrom(free(function (z) { return reach[z] > 1; })); if (lc < 0) lc = pickFrom(free(function (z) { return reach[z] > 0; }));
      if (lc < 0) return; place('lever', lc, { group: G2.id, on: false });
    });
    // узлы-вентили: дальние друг от друга ячейки; по одному — за каждой дверью/заслонкой (если есть место)
    var nV = valveCount(world, lvl), vcells = [];
    groups.forEach(function (G2) { if (vcells.length >= nV) return; var c = pickFrom(free(function (z) { return G2.side.indexOf(z) >= 0 && vcells.indexOf(z) < 0; })); if (c >= 0) { vcells.push(c); used[c] = 'valve'; } });
    while (vcells.length < nV) {
      var cand = free(function (z) { return dist0[z] >= 2; }); if (!cand.length) cand = free(function () { return true; }); if (!cand.length) return null;
      var best = -1, bestD = -1;
      cand.forEach(function (z) {
        var md = 99; vcells.forEach(function (v) { md = Math.min(md, Math.abs(cells[v].cx - cells[z].cx) + Math.abs(cells[v].cy - cells[z].cy)); });
        md = Math.min(md, Math.abs(cells[start].cx - cells[z].cx) + Math.abs(cells[start].cy - cells[z].cy) + 1);
        var sc = md + rng() * 1.5; if (sc > bestD) { bestD = sc; best = z; }
      });
      vcells.push(best); used[best] = 'valve';
    }
    vcells.forEach(function (z) { used[z] = 0; delete used[z]; place('valve', z, { on: false, prog: 0 }); });
    // тайники: сундук + еда
    secrets.forEach(function (z) { var c = cellCenter(cells[z].cx, cells[z].cy); objs.push({ kind: 'chest', x: c.tx * T + T / 2, y: c.ty * T + T / 2, v: 100 + 40 * world, cell: z }); objs.push({ kind: 'food', x: c.tx * T + T / 2 + 28, y: c.ty * T + T / 2, cell: z }); });
    var ex = cellCenter(cells[exit].cx, cells[exit].cy), st = cellCenter(cells[start].cx, cells[start].cy);
    // гнёзда-литейки (клетка-угол ячейки), враги, монеты, еда, ящики и провалы
    var nests = [], spawns = [], mix = WORLD_MIX[world];
    var nNest = Math.min(6, 1 + world + Math.floor(lvl / 2));
    var nestCells = free(function () { return true; }).concat(Object.keys(used).map(Number).filter(function (z) { return used[z] === 'valve' || used[z] === 'key' || used[z] === 'lever'; })).filter(function (z) { return dist0[z] >= 3 && used[z] !== 'secret'; });
    var CORN = [[1, 1], [3, 1], [1, 3], [3, 3]];
    for (k = 0; k < nNest && nestCells.length; k++) {
      var nc = pickFrom(nestCells), cn = CORN[Math.floor(rng() * 4)], tx = cells[nc].cx * 4 + cn[0], ty = cells[nc].cy * 4 + cn[1];
      set(tx, ty, TILE.NEST); nests.push({ tx: tx, ty: ty, cell: nc });
    }
    for (i = 0; i < cells.length; i++) {
      if (i === start || used[i] === 'secret') continue;
      var c = cells[i];
      // ящики/провалы в свободных углах (проходы по центру ячейки не перекрываются)
      CORN.forEach(function (cn2) { var tx2 = c.cx * 4 + cn2[0], ty2 = c.cy * 4 + cn2[1]; if (tiles[ty2 * TW + tx2] === TILE.FLOOR && rng() < 0.16) set(tx2, ty2, rng() < 0.55 ? TILE.CRATE : TILE.PIT); });
      if (dist0[i] >= 2 && rng() < 0.55) { var ne = 1 + (rng() < 0.35 + lvl * 0.06 ? 1 : 0) + (rng() < 0.15 * world ? 1 : 0); for (var e = 0; e < ne; e++) spawns.push({ type: mix[Math.floor(rng() * mix.length)], x: (c.cx * 4 + 1.5 + rng() * 2) * T, y: (c.cy * 4 + 1.5 + rng() * 2) * T }); }
      if (rng() < 0.5) { var nCoin = 1 + Math.floor(rng() * 3), EDGE = [[2, 1], [1, 2], [3, 2], [2, 3]]; for (var q = 0; q < nCoin; q++) { var ed = EDGE[(q + Math.floor(rng() * 4)) % 4]; objs.push({ kind: 'coin', v: 10 + 5 * (world - 1), x: (c.cx * 4 + ed[0]) * T + T / 2 + (rng() - 0.5) * 10, y: (c.cy * 4 + ed[1]) * T + T / 2 + (rng() - 0.5) * 10 }); } }
    }
    var foodCells = free(function (z) { return dist0[z] >= 2; }); for (k = 0; k < 2 + (lvl > 2 ? 1 : 0) && foodCells.length; k++) { var fc = pickFrom(foodCells), cc = cellCenter(cells[fc].cx, cells[fc].cy); objs.push({ kind: 'food', x: cc.tx * T + T / 2, y: cc.ty * T + T / 2 }); used[fc] = 'food'; }
    if (rng() < 0.6) { var sc2 = free(function (z) { return dist0[z] >= 3; }); if (sc2.length) { var z2 = pickFrom(sc2), c3 = cellCenter(cells[z2].cx, cells[z2].cy); objs.push({ kind: 'charge', x: c3.tx * T + T / 2, y: c3.ty * T + T / 2 }); } }
    // клетки ячеек выхода и старта — без ящиков/провалов
    [start, exit].forEach(function (z) { var c4 = cells[z]; for (var a2 = 1; a2 <= 3; a2++) for (var b2 = 1; b2 <= 3; b2++) { var t2 = tiles[(c4.cy * 4 + b2) * TW + c4.cx * 4 + a2]; if (t2 === TILE.CRATE || t2 === TILE.PIT || t2 === TILE.NEST) set(c4.cx * 4 + a2, c4.cy * 4 + b2, TILE.FLOOR); } });
    nests = nests.filter(function (n2) { return tiles[n2.ty * TW + n2.tx] === TILE.NEST; });
    return {
      world: world, lvl: lvl, TW: TW, TH: TH, CW: CW, CH: CH, tiles: tiles, groups: groups.map(function (G2) { return { id: G2.id, kind: G2.kind, tiles: G2.tiles, open: false }; }),
      objs: objs, nests: nests, spawns: spawns,
      start: { x: st.tx * T + T / 2, y: st.ty * T + T / 2 }, exit: { x: ex.tx * T + T / 2, y: ex.ty * T + T / 2 }, boss: null
    };
  }

  // Арена механизма-босса: открытый зал с колоннами, вентили сбрасывают давление брони механизма
  function genBoss(world) {
    var TW = 21, TH = 17, tiles = new Uint8Array(TW * TH).fill(TILE.FLOOR);
    for (var x = 0; x < TW; x++) { tiles[x] = TILE.WALL; tiles[(TH - 1) * TW + x] = TILE.WALL; }
    for (var y = 0; y < TH; y++) { tiles[y * TW] = TILE.WALL; tiles[y * TW + TW - 1] = TILE.WALL; }
    [[4, 6], [16, 6], [4, 11], [16, 11]].forEach(function (p) { tiles[p[1] * TW + p[0]] = TILE.WALL; });
    if (world >= 2) [[8, 9], [12, 9]].forEach(function (p) { tiles[p[1] * TW + p[0]] = TILE.CRATE; });
    var nv = [0, 2, 2, 3, 4][world], vp = [[2, 2], [18, 2], [2, 14], [18, 14]], objs = [];
    if (nv === 3) vp = [[2, 2], [18, 2], [10, 14]];
    for (var i = 0; i < nv; i++) objs.push({ kind: 'valve', x: vp[i][0] * T + T / 2, y: vp[i][1] * T + T / 2, on: false, prog: 0 });
    objs.push({ kind: 'food', x: 3 * T + T / 2, y: 9 * T + T / 2 }); objs.push({ kind: 'food', x: 17 * T + T / 2, y: 9 * T + T / 2 });
    return { world: world, lvl: LEVELS, TW: TW, TH: TH, CW: 0, CH: 0, tiles: tiles, groups: [], objs: objs, nests: [], spawns: [],
      start: { x: 10 * T + T / 2, y: 14 * T + T / 2 }, exit: { x: 10 * T + T / 2, y: 8 * T + T / 2 }, boss: { key: BOSSES[world].key, x: 10 * T + T / 2, y: 4 * T } };
  }

  // ---------- Проверка проходимости: симуляция «ключи → двери, рычаги → заслонки» ----------
  function passableFn(m, openSet, forShots) {
    return function (x, y) {
      if (x < 0 || y < 0 || x >= m.TW || y >= m.TH) return false;
      var t = m.tiles[y * m.TW + x];
      if (t === TILE.DOOR || t === TILE.BAR) return !!openSet[x + ',' + y];
      return !(forShots ? SHOT_SOLID : WALK_SOLID)[t];
    };
  }
  function bfsTiles(m, sx, sy, pass) {
    var d = new Int32Array(m.TW * m.TH).fill(-1), q = [sy * m.TW + sx], h = 0; d[q[0]] = 0;
    while (h < q.length) {
      var k = q[h++], x = k % m.TW, y = (k - x) / m.TW;
      for (var i = 0; i < 4; i++) {
        var nx = x + (i === 0 ? 1 : i === 1 ? -1 : 0), ny = y + (i === 2 ? 1 : i === 3 ? -1 : 0);
        if (!pass(nx, ny)) continue; var nk = ny * m.TW + nx; if (d[nk] >= 0) continue; d[nk] = d[k] + 1; q.push(nk);
      }
    }
    return d;
  }
  function tileOf(p) { return { x: Math.floor(p.x / T), y: Math.floor(p.y / T) }; }
  function solveLevel(m) {
    var open = {}, keys = 0, took = {}, pulled = {}, opened = 0, s = tileOf(m.start), steps = 0, reach;
    var ofGroup = function (G2) { G2.tiles.forEach(function (p) { open[p[0] + ',' + p[1]] = 1; }); };
    var at = function (o) { var t = tileOf(o); return reach[t.y * m.TW + t.x] >= 0; };
    // строгая проверка: все ключи достижимы при закрытых дверях и заслонках
    reach = bfsTiles(m, s.x, s.y, passableFn(m, {}));
    var keysFree = m.objs.filter(function (o) { return o.kind === 'key'; }).every(at);
    for (;;) {
      if (++steps > 50) break;
      reach = bfsTiles(m, s.x, s.y, passableFn(m, open));
      var changed = false;
      m.objs.forEach(function (o, i) {
        if (!at(o)) return;
        if (o.kind === 'key' && !took[i]) { took[i] = 1; keys++; changed = true; }
        if (o.kind === 'lever' && !pulled[i]) { pulled[i] = 1; m.groups.forEach(function (G2) { if (G2.id === o.group) { ofGroup(G2); G2._o = 1; } }); changed = true; }
      });
      if (!changed && keys > 0) {
        var door = m.groups.filter(function (G2) { return G2.kind === 'door' && !G2._o; }).find(function (G2) {
          return G2.tiles.some(function (p) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (dd) { var nx = p[0] + dd[0], ny = p[1] + dd[1]; return nx >= 0 && ny >= 0 && nx < m.TW && ny < m.TH && reach[ny * m.TW + nx] >= 0; }); });
        });
        if (door) { ofGroup(door); door._o = 1; keys--; opened++; changed = true; }
      }
      if (!changed) break;
    }
    m.groups.forEach(function (G2) { delete G2._o; });
    var valves = m.objs.filter(function (o) { return o.kind === 'valve'; });
    var vOk = valves.every(at), eOk = at(m.exit);
    return { ok: vOk && eOk && keysFree, valves: valves.length, valvesOk: vOk, exitOk: eOk, keysFree: keysFree, doorsOpened: opened, open: open };
  }
  // A* по клеткам (4-связность) — для тестов достижимости
  function astar(m, from, to, open) {
    var pass = passableFn(m, open || {}), a = tileOf(from), b = tileOf(to), N = m.TW * m.TH;
    var g = new Float64Array(N).fill(Infinity), closed = new Uint8Array(N), heap = [], s0 = a.y * m.TW + a.x, goal = b.y * m.TW + b.x;
    var hfn = function (k) { var x = k % m.TW, y = (k - x) / m.TW; return Math.abs(x - b.x) + Math.abs(y - b.y); };
    g[s0] = 0; heap.push([hfn(s0), s0]);
    while (heap.length) {
      var bi = 0; for (var i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
      var k = heap.splice(bi, 1)[0][1]; if (closed[k]) continue; closed[k] = 1;
      if (k === goal) return g[k];
      var x = k % m.TW, y = (k - x) / m.TW;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = x + d[0], ny = y + d[1]; if (!(pass(nx, ny) || (nx === b.x && ny === b.y))) return;
        var nk = ny * m.TW + nx; if (g[k] + 1 < g[nk]) { g[nk] = g[k] + 1; heap.push([g[nk] + hfn(nk), nk]); }
      });
    }
    return -1;
  }

  // ---------- Пароль (10 знаков, без похожих букв/цифр, с контрольной суммой) ----------
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function encodePass(p) {
    var bits = [];
    function put(v, n) { for (var i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); }
    put(p.world - 1, 2); put(p.lvl - 1, 3); put(p.players - 1, 1);
    for (var h = 0; h < 2; h++) { var t = p.team[h]; put(t.hid, 2); put(t.gun - 1, 2); put(t.hpL, 2); put(t.mA, 2); put(t.mB, 2); put(t.spec, 2); put(Math.min(63, Math.floor(t.money / 50)), 6); }
    var sum = 0; for (var i = 0; i < bits.length; i++) sum = (sum * 3 + bits[i] * (i + 7)) % 251;
    put(sum, 8);
    while (bits.length % 5) bits.push(0);
    var out = '', mask = 0x1B;
    for (i = 0; i < bits.length; i += 5) { var v = 0; for (var j = 0; j < 5; j++) v = v * 2 + bits[i + j]; v ^= mask; mask = (mask * 7 + 3) & 31; out += ALPHA[v]; }
    return out;
  }
  function decodePass(str) {
    str = String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'Q').replace(/1/g, 'L').replace(/O/g, 'Q').replace(/I/g, 'L');
    if (str.length !== 10) return null;
    var bits = [], mask = 0x1B;
    for (var i = 0; i < str.length; i++) { var v = ALPHA.indexOf(str[i]); if (v < 0) return null; v ^= mask; mask = (mask * 7 + 3) & 31; for (var j = 4; j >= 0; j--) bits.push((v >> j) & 1); }
    var pos = 0; function get(n) { var v = 0; for (var k = 0; k < n; k++) v = v * 2 + bits[pos++]; return v; }
    var p = { world: get(2) + 1, lvl: get(3) + 1, players: get(1) + 1, team: [] };
    for (var h = 0; h < 2; h++) p.team.push({ hid: get(2), gun: get(2) + 1, hpL: get(2), mA: get(2), mB: get(2), spec: get(2), money: get(6) * 50 });
    var body = pos, sum = 0; for (i = 0; i < body; i++) sum = (sum * 3 + bits[i] * (i + 7)) % 251;
    if (get(8) !== sum) return null;
    if (p.lvl > LEVELS || p.team[0].hid === p.team[1].hid || p.team.some(function (t) { return t.hpL > 3 || t.mA > 3 || t.mB > 3 || t.spec > SHOP.SPEC_MAX; })) return null;
    p.team.forEach(function (t) { var tr = HEROES[t.hid].tree; if (tr[0] === 'life' && t.mA > 2) t.mA = 2; if (tr[1] === 'life' && t.mB > 2) t.mB = 2; });
    return p;
  }

  // ======================================================================
  // Игра
  // ======================================================================
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(opts.seed || 1), onEvent = opts.onEvent || function () {};
    var S = {
      phase: 'idle', world: 1, lvl: 1, players: opts.players === 2 ? 2 : 1, score: 0, continues: CONTINUES, contT: 0,
      team: [], heroes: [], enemies: [], shots: [], eshots: [], fx: [], bombs: [], map: null, objs: [], boss: null, keys: 0,
      cam: { x: 0, y: 0 }, t: 0, levelT: 0, banner: 0, clearT: 0, chartT: 0, seen: null, field: null, fieldT: 0,
      shop: [{ sel: 0, ready: false }, { sel: 0, ready: false }], seed: opts.seed || 1, aiOn: opts.players !== 2 && opts.ai !== false
    };
    var heroIds = opts.heroes || [0, 1];
    function emit(t, d) { onEvent(t, d || {}); }
    function newTeam(hid) { return { hid: hid, gun: 1, hpL: 0, mA: 0, mB: 0, spec: 1, money: 0, lives: START_LIVES, hp: null }; }
    S.team = [newTeam(heroIds[0]), newTeam(heroIds[1] != null && heroIds[1] !== heroIds[0] ? heroIds[1] : (heroIds[0] + 1) % 4)];
    if (opts.save) loadProgress(opts.save);

    function lvlOf(t, key) { var tr = HEROES[t.hid].tree; return tr[0] === key ? t.mA : tr[1] === key ? t.mB : 0; }
    function maxHp(t) { return HEROES[t.hid].hp + 25 * t.hpL; }
    // ИИ-напарник, отстав больше чем на 3 клетки, догоняет «полным паром» (×1.3)
    function heroSpeed(h) { return HEROES[h.t.hid].spd * (1 + 0.08 * lvlOf(h.t, 'speed')) * (h.ai && h.aiS && h.aiS.catchup ? 1.3 : 1); }

    // ---------- Карта ----------
    function tileAt(x, y) { var m = S.map; if (x < 0 || y < 0 || x >= m.TW || y >= m.TH) return TILE.WALL; return m.tiles[y * m.TW + x]; }
    function walkSolid(tx, ty) { return WALK_SOLID[tileAt(tx, ty)]; }
    function shotSolid(tx, ty) { return SHOT_SOLID[tileAt(tx, ty)]; }
    function hitsWall(x, y, r, fn) {
      fn = fn || walkSolid;
      var x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
        if (!fn(tx, ty)) continue;
        var cx = clamp(x, tx * T, tx * T + T), cy = clamp(y, ty * T, ty * T + T);
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return { tx: tx, ty: ty };
      }
      return null;
    }
    function moveBody(o, dx, dy, r) {
      var moved = false;
      if (dx) {
        if (!hitsWall(o.x + dx, o.y, r)) { o.x += dx; moved = true; }
        else { // скольжение у угла: подтолкнуть к центру прохода
          for (var s = 1; s <= 8; s++) { var ok = false; [s, -s].forEach(function (sy) { if (!ok && !hitsWall(o.x + dx, o.y + sy, r) && !hitsWall(o.x, o.y + sy, r)) { o.y += Math.sign(sy) * Math.min(Math.abs(dx), 1.5); ok = true; } }); if (ok) { moved = true; break; } }
        }
      }
      if (dy) {
        if (!hitsWall(o.x, o.y + dy, r)) { o.y += dy; moved = true; }
        else {
          for (var s2 = 1; s2 <= 8; s2++) { var ok2 = false; [s2, -s2].forEach(function (sx) { if (!ok2 && !hitsWall(o.x + sx, o.y + dy, r) && !hitsWall(o.x + sx, o.y, r)) { o.x += Math.sign(sx) * Math.min(Math.abs(dy), 1.5); ok2 = true; } }); if (ok2) { moved = true; break; } }
        }
      }
      return moved;
    }
    function los(a, b) {
      var d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 10);
      for (var i = 1; i < n; i++) { var x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n; if (shotSolid(Math.floor(x / T), Math.floor(y / T))) return false; }
      return true;
    }
    function openSet() { var o = {}; S.map.groups.forEach(function (G2) { if (G2.open) G2.tiles.forEach(function (p) { o[p[0] + ',' + p[1]] = 1; }); }); return o; }
    function walkPass() { var m = S.map; return function (x, y) { return x >= 0 && y >= 0 && x < m.TW && y < m.TH && !WALK_SOLID[m.tiles[y * m.TW + x]]; }; }
    function bfsFrom(points, maxD) { // поле расстояний (8-связн. без срезания углов) от точек
      var m = S.map, N = m.TW * m.TH, d = new Int16Array(N).fill(-1), q = [], h = 0, pass = walkPass();
      points.forEach(function (p) { var t = tileOf(p); if (t.x >= 0 && t.y >= 0 && t.x < m.TW && t.y < m.TH) { var k = t.y * m.TW + t.x; if (d[k] < 0) { d[k] = 0; q.push(k); } } });
      while (h < q.length) {
        var k = q[h++], x = k % m.TW, y = (k - x) / m.TW; if (maxD && d[k] >= maxD) continue;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; var nx = x + dx, ny = y + dy; if (!pass(nx, ny)) continue;
          if (dx && dy && (!pass(x + dx, y) || !pass(x, y + dy))) continue;
          var nk = ny * m.TW + nx; if (d[nk] >= 0) continue; d[nk] = d[k] + 1; q.push(nk);
        }
      }
      return d;
    }
    function fieldAt(f, x, y) { var m = S.map, tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= m.TW || ty >= m.TH) return -1; return f[ty * m.TW + tx]; }
    function downhill(f, o) { // центр соседней клетки ближе по полю
      var m = S.map, t = tileOf(o), best = null, bd = fieldAt(f, o.x, o.y), pass = walkPass();
      if (bd < 0) return null;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; var nx = t.x + dx, ny = t.y + dy; if (!pass(nx, ny)) continue;
        if (dx && dy && (!pass(t.x + dx, t.y) || !pass(t.x, t.y + dy))) continue;
        var v = f[ny * m.TW + nx]; if (v >= 0 && v < bd) { bd = v; best = { x: nx * T + T / 2, y: ny * T + T / 2 }; }
      }
      return best;
    }

    // ---------- Загрузка уровня ----------
    function loadLevel(world, lvl) {
      S.world = world; S.lvl = lvl;
      var m = genLevel(world, lvl, S.seed + world * 100 + lvl);
      S.map = m; S.objs = m.objs.map(function (o) { return Object.assign({}, o); });
      S.enemies = []; S.shots = []; S.eshots = []; S.fx = []; S.bombs = []; S.keys = 0; S.levelT = 0; S.chartT = 0; S.banner = 2.2;
      S.exitOpen = false; S.boss = null; S.fieldT = 0; S.field = null; S.aiField = null;
      S.seen = new Uint8Array(m.TW * m.TH);
      var two = S.players === 2, hpMul = (1 + 0.4 * (world - 1)) * (two ? 1.25 : 1);
      S.hpMul = hpMul;
      m.nests.forEach(function (n) { addEnemy('nest', n.tx * T + T / 2, n.ty * T + T / 2, { tx: n.tx, ty: n.ty }); });
      m.spawns.forEach(function (s) { if (!hitsWall(s.x, s.y, 12)) addEnemy(s.type, s.x, s.y); });
      if (m.boss) {
        var B = BOSSES[world];
        S.boss = { key: B.key, x: m.boss.x, y: m.boss.y, r: B.r, max: B.hp * (two ? 1.5 : 1.15), hp: 0, t: 0, a: 0, mode: 'idle', modeT: 1.5, vx: 0, vy: 0, intro: 2.2, flash: 0, armor: S.objs.filter(function (o) { return o.kind === 'valve'; }).length, dead: false, x0: m.boss.x };
        S.boss.hp = S.boss.max; S.boss.armorMax = S.boss.armor;
      }
      // герои у старта
      S.heroes = [0, 1].map(function (i) {
        var t = S.team[i], h = { id: i, t: t, x: m.start.x + (i ? 22 : -22), y: m.start.y, r: HERO_R, face: [0, -1], mx: 0, my: 0, fire: false, cd: 0, specCd: 0,
          alive: true, out: false, down: false, downT: 0, inv: 1.5, respawnT: 0, hitT: 0, shieldT: 0, ai: i === 1 && S.aiOn, moving: false, walk: 0 };
        h.maxHp = maxHp(t); h.hp = t.hp != null ? Math.min(h.maxHp, Math.max(t.hp, h.maxHp * 0.5)) : h.maxHp;
        if (!h.ai && t.lives <= 0) { h.out = true; h.alive = false; }
        if (h.ai) { h.aiS = { t: 0, goal: null, goalT: 0, bestF: 999, stuckT: 0, offT: 0, aimT: 0, target: null, specT: 4, warpCd: 0 }; }
        if (hitsWall(h.x, h.y, h.r)) h.x = m.start.x;
        return h;
      });
      if (S.heroes.every(function (h) { return !h.alive && !h.ai; })) S.heroes.forEach(function (h) { if (!h.ai) { h.t.lives = 1; h.out = false; h.alive = true; } });
      centerCam(true);
      S.phase = 'play';
      emit('level', { world: world, lvl: lvl, boss: !!m.boss });
    }
    function addEnemy(type, x, y, extra) {
      var D = EN[type], hp = D.hp * S.hpMul;
      var e = Object.assign({ id: (S._eid = (S._eid || 0) + 1), type: type, x: x, y: y, r: D.r, hp: hp, max: hp, spd: D.spd * (1 + 0.04 * (S.world - 1)), cd: 0.5 + rng(), stun: 0, flash: 0, ang: rng() * 6.28, hitCd: 0, spawnCd: 1 + rng() * 2, kids: 0, tele: 0, walk: rng() * 6 }, extra || {});
      S.enemies.push(e); return e;
    }

    // ---------- Камера ----------
    function humans() { return S.heroes.filter(function (h) { return !h.ai && h.alive; }); }
    function centerCam(snap) {
      var hs = humans(); if (!hs.length) hs = S.heroes.filter(function (h) { return h.alive; }); if (!hs.length) return;
      var x = 0, y = 0; hs.forEach(function (h) { x += h.x; y += h.y; }); x /= hs.length; y /= hs.length;
      var m = S.map, tx = clamp(x - W / 2, 0, Math.max(0, m.TW * T - W)), ty = clamp(y - VH / 2, 0, Math.max(0, m.TH * T - VH));
      if (m.TW * T < W) tx = (m.TW * T - W) / 2; if (m.TH * T < VH) ty = (m.TH * T - VH) / 2;
      if (snap) { S.cam.x = tx; S.cam.y = ty; } else { S.cam.x += (tx - S.cam.x) * 0.15; S.cam.y += (ty - S.cam.y) * 0.15; }
    }
    function onScreen(o, pad) { pad = pad || 0; return o.x > S.cam.x - pad && o.x < S.cam.x + W + pad && o.y > S.cam.y - pad && o.y < S.cam.y + VH + pad; }

    // ---------- Стрельба ----------
    function fireGun(h) {
      var Gs = GUNS[HEROES[h.t.hid].gun][h.t.gun - 1], a0 = Math.atan2(h.face[1], h.face[0]);
      if (h.aimA != null) a0 = h.aimA;
      for (var i = 0; i < Gs.n; i++) {
        var off = Gs.n > 1 ? i - (Gs.n - 1) / 2 : 0, a = a0 + (Gs.sp || 0) * off, px = Gs.par ? -Math.sin(a0) * Gs.par * off : 0, py = Gs.par ? Math.cos(a0) * Gs.par * off : 0;
        S.shots.push({ x: h.x + Math.cos(a0) * 12 + px, y: h.y + Math.sin(a0) * 12 + py, vx: Math.cos(a) * Gs.v, vy: Math.sin(a) * Gs.v, dmg: Gs.dmg, life: Gs.range / Gs.v, r: Gs.r || 4,
          pierce: Gs.pierce || 1, bounce: Gs.bounce || 0, splash: Gs.splash || 0, pi: h.id, gun: HEROES[h.t.hid].gun, hit: [] });
      }
      h.cd = 1 / Gs.rate;
      emit('shot', { pi: h.id, gun: HEROES[h.t.hid].gun });
    }
    function damageEnemy(e, dmg, src) {
      if (e.dead) return;
      e.hp -= dmg; e.flash = 0.08;
      if (e.hp <= 0) killEnemy(e, src);
      else emit('hit', { x: e.x, y: e.y });
    }
    function killEnemy(e, src) {
      e.dead = true; var D = EN[e.type];
      S.score += D.pts;
      if (e.type === 'nest') { var m = S.map; m.tiles[e.ty * m.TW + e.tx] = TILE.FLOOR; }
      if (rng() < D.coin) S.objs.push({ kind: 'coin', v: (e.type === 'nest' ? 40 : e.type === 'heavy' ? 25 : 10) + 5 * (S.world - 1), x: e.x, y: e.y, drop: true });
      if (e.type === 'nest' && rng() < 0.35) S.objs.push({ kind: 'food', x: e.x + 14, y: e.y });
      emit('kill', { type: e.type, x: e.x, y: e.y, pi: src });
    }
    function splash(x, y, r, dmg, src) {
      S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) damageEnemy(e, dmg * 0.6, src); });
      if (S.boss && !S.boss.dead && Math.hypot(S.boss.x - x, S.boss.y - y) < r + S.boss.r) hurtBoss(dmg * 0.5);
      S.fx.push({ kind: 'boom', x: x, y: y, r: r, t: 0.3 });
      emit('boom', { x: x, y: y, r: r });
    }
    function breakTile(tx, ty) {
      var m = S.map, t = m.tiles[ty * m.TW + tx];
      if (t === TILE.CRACK) { m.tiles[ty * m.TW + tx] = TILE.FLOOR; S.score += 100; emit('secret', { x: tx * T + T / 2, y: ty * T + T / 2 }); return true; }
      if (t === TILE.CRATE) { m.tiles[ty * m.TW + tx] = TILE.FLOOR; S.score += SCORE.crate; if (rng() < 0.45) S.objs.push({ kind: 'coin', v: 10 + 5 * (S.world - 1), x: tx * T + T / 2, y: ty * T + T / 2, drop: true }); emit('crate', { x: tx * T + T / 2, y: ty * T + T / 2 }); return true; }
      return false;
    }
    var tileHp = {};
    function updateShots(dt) {
      S.shots = S.shots.filter(function (s) {
        s.life -= dt; if (s.life <= 0) { if (s.splash) splash(s.x, s.y, s.splash, s.dmg, s.pi); return false; }
        var steps = Math.ceil(Math.hypot(s.vx, s.vy) * dt / 8);
        if (!s.age) { s.age = 1; steps++; }   // первый шаг — проверка точки вылета (чудище вплотную)
        for (var k = 0; k < steps; k++) {
          var fr = s.age === 1 && k === 0 ? 0 : 1; if (k === 1) s.age = 2;
          var nx = s.x + s.vx * dt / steps * fr, ny = s.y + s.vy * dt / steps * fr, tx = Math.floor(nx / T), ty = Math.floor(ny / T);
          if (shotSolid(tx, ty)) {
            var t = tileAt(tx, ty);
            if (t === TILE.CRACK || t === TILE.CRATE) { var key = tx + ',' + ty; tileHp[key] = (tileHp[key] || (t === TILE.CRACK ? 5 : 3)) - s.dmg; if (tileHp[key] <= 0) { delete tileHp[key]; breakTile(tx, ty); } else emit('chip', { x: nx, y: ny }); }
            if (s.splash) { splash(s.x, s.y, s.splash, s.dmg, s.pi); return false; }
            if (s.bounce > 0) {
              s.bounce--; var bx = shotSolid(Math.floor(nx / T), Math.floor(s.y / T)), by = shotSolid(Math.floor(s.x / T), Math.floor(ny / T));
              if (bx || !by) s.vx = -s.vx; if (by || !bx) s.vy = -s.vy; s.hit = []; emit('bounce', {}); continue;
            }
            return false;
          }
          s.x = nx; s.y = ny;
          for (var i = 0; i < S.enemies.length; i++) {
            var e = S.enemies[i]; if (e.dead || s.hit.indexOf(e.id) >= 0) continue;
            if ((e.x - s.x) * (e.x - s.x) + (e.y - s.y) * (e.y - s.y) < (e.r + s.r) * (e.r + s.r)) {
              s.hit.push(e.id); damageEnemy(e, s.dmg, s.pi);
              if (s.splash) { splash(s.x, s.y, s.splash, s.dmg, s.pi); return false; }
              if (--s.pierce <= 0) return false;
            }
          }
          var B = S.boss;
          if (B && !B.dead && B.intro <= 0 && Math.hypot(B.x - s.x, B.y - s.y) < B.r + s.r) { hurtBoss(s.dmg); if (s.splash) splash(s.x, s.y, s.splash, s.dmg, s.pi); return false; }
        }
        return true;
      });
      S.eshots = S.eshots.filter(function (s) {
        s.life -= dt; if (s.life <= 0) return false;
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (shotSolid(Math.floor(s.x / T), Math.floor(s.y / T))) return false;
        for (var i = 0; i < S.heroes.length; i++) {
          var h = S.heroes[i]; if (!h.alive || h.down) continue;
          if (Math.hypot(h.x - s.x, h.y - s.y) < h.r + s.r) { if (h.shieldT > 0) { emit('block', {}); return false; } hurtHero(h, s.dmg, 'shot'); return false; }
        }
        return true;
      });
    }

    // ---------- Урон героям ----------
    function hurtHero(h, dmg, src) {
      if (!h.alive || h.down || h.inv > 0 || h.shieldT > 0) return;
      dmg *= 1 - 0.12 * lvlOf(h.t, 'armor');
      h.hp -= dmg; h.hitT = 0.2; h.inv = 0.45;
      emit('hurt', { pi: h.id, x: h.x, y: h.y });
      if (h.hp <= 0) heroDie(h, src);
    }
    function heroDie(h, src) {
      h.hp = 0; emit('heroDie', { pi: h.id, x: h.x, y: h.y, src: src, ai: h.ai });
      if (h.ai) { h.down = true; h.downT = 12; return; }
      h.t.lives--; h.alive = false;
      if (h.t.lives > 0) h.respawnT = 1.4; else { h.out = true; emit('out', { pi: h.id }); }
      if (humans().length === 0 && S.heroes.every(function (x) { return x.ai || x.out; })) { S.phase = 'cont'; S.contT = CONT_T; emit('contAsk', {}); }
    }
    function respawn(h) {
      var mate = S.heroes[1 - h.id];
      h.alive = true; h.hp = h.maxHp; h.inv = 2.5; h.down = false;
      if (mate && mate.alive && !mate.down && !mate.ai) { h.x = mate.x; h.y = mate.y; }
      emit('respawn', { pi: h.id, x: h.x, y: h.y });
    }

    // ---------- Подбор ----------
    function pickups(h) {
      var mag = 16 + 40 * lvlOf(h.t, 'magnet');
      S.objs.forEach(function (o) {
        if (o.gone) return;
        var d = Math.hypot(o.x - h.x, o.y - h.y);
        if (o.kind === 'coin' && mag > 16 && d < mag + 40 && d > 4) { o.x += (h.x - o.x) * 0.12; o.y += (h.y - o.y) * 0.12; }
        if (d > h.r + 12) return;
        if (o.kind === 'coin' || o.kind === 'chest') { o.gone = true; gainMoney(o.v); S.score += o.v; emit(o.kind === 'chest' ? 'chest' : 'coin', { x: o.x, y: o.y, v: o.v, pi: h.id }); }
        else if (o.kind === 'food') { if (h.hp >= h.maxHp - 0.5) return; o.gone = true; h.hp = Math.min(h.maxHp, h.hp + 35); S.score += 20; emit('food', { x: o.x, y: o.y, pi: h.id }); }
        else if (o.kind === 'key') { o.gone = true; S.keys++; S.score += 50; emit('key', { x: o.x, y: o.y, pi: h.id }); }
        else if (o.kind === 'charge') { if (h.t.spec >= SHOP.SPEC_MAX) return; o.gone = true; h.t.spec++; emit('charge', { x: o.x, y: o.y, pi: h.id }); }
        else if (o.kind === 'lever' && !o.on) { o.on = true; S.map.groups.forEach(function (G2) { if (G2.id === o.group) openGroup(G2); }); emit('lever', { x: o.x, y: o.y }); }
      });
    }
    // деньги — поровну на двоих (нечётную монету получает тот, у кого меньше)
    function gainMoney(v) {
      var a = S.team[0], b = S.team[1], half = Math.floor(v / 2), rest = v - half * 2;
      a.money += half; b.money += half; if (rest) { if (a.money <= b.money) a.money += rest; else b.money += rest; }
    }
    function openGroup(G2) { G2.open = true; var m = S.map; G2.tiles.forEach(function (p) { m.tiles[p[1] * m.TW + p[0]] = TILE.FLOOR; }); S.fieldT = 0; emit('open', { kind: G2.kind, x: G2.tiles[1][0] * T + T / 2, y: G2.tiles[1][1] * T + T / 2 }); }
    function tryDoors(h) {
      if (S.keys <= 0) return;
      var m = S.map;
      m.groups.forEach(function (G2) {
        if (G2.open || G2.kind !== 'door' || S.keys <= 0) return;
        var near = G2.tiles.some(function (p) { var cx = p[0] * T + T / 2, cy = p[1] * T + T / 2; return Math.abs(h.x - cx) < T / 2 + h.r + 4 && Math.abs(h.y - cy) < T / 2 + h.r + 4; });
        if (near) { S.keys--; openGroup(G2); }
      });
    }
    function valves(h, dt) {
      S.objs.forEach(function (o) {
        if (o.kind !== 'valve' || o.on) return;
        if (Math.hypot(o.x - h.x, o.y - h.y) < 22) {
          o.prog += dt / VALVE_T; o.turning = 0.1;
          if (o.prog >= 1) {
            o.on = true; o.prog = 1; S.score += SCORE.valve; emit('valve', { x: o.x, y: o.y, left: valvesLeft() });
            if (S.boss && !S.boss.dead) { S.boss.armor = valvesLeft(); hurtBoss(S.boss.max * 0.08, true); emit('armorDown', { x: S.boss.x, y: S.boss.y, left: S.boss.armor }); }
            else if (valvesLeft() === 0 && !S.exitOpen) { S.exitOpen = true; emit('exitOpen', { x: S.map.exit.x, y: S.map.exit.y }); }
            else ambush(o);
          }
        }
      });
    }
    function valvesLeft() { return S.objs.filter(function (o) { return o.kind === 'valve' && !o.on; }).length; }
    function ambush(o) { // открытый вентиль будит пару чудищ неподалёку
      var mix = WORLD_MIX[S.world], n = 1 + (S.world > 2 ? 1 : 0);
      for (var i = 0; i < n; i++) {
        for (var tr = 0; tr < 10; tr++) {
          var a = rng() * 6.28, d = 150 + rng() * 80, x = o.x + Math.cos(a) * d, y = o.y + Math.sin(a) * d;
          if (!hitsWall(x, y, 13) && S.heroes.every(function (h) { return Math.hypot(h.x - x, h.y - y) > 120; })) { addEnemy(mix[Math.floor(rng() * mix.length)], x, y).spawnFx = 0.4; break; }
        }
      }
    }

    // ---------- Спецприёмы ----------
    function special(pi) {
      var h = S.heroes[pi]; if (!h || !h.alive || h.down || S.phase !== 'play' || h.t.spec <= 0 || h.specCd > 0) return false;
      var kind = HEROES[h.t.hid].spec;
      if (kind === 'heal') S.heroes.forEach(function (x) { if (x.down) { x.down = false; x.hp = x.maxHp * 0.6; x.inv = 1.5; emit('revive', { pi: x.id, x: x.x, y: x.y }); } else if (x.alive) x.hp = Math.min(x.maxHp, x.hp + x.maxHp * 0.5); });
      else if (kind === 'bomb') { S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - h.x, e.y - h.y) < 300) damageEnemy(e, e.type === 'nest' ? 6 : 9, pi); }); S.eshots = []; if (S.boss && !S.boss.dead && Math.hypot(S.boss.x - h.x, S.boss.y - h.y) < 340) hurtBoss(14); S.fx.push({ kind: 'blast', x: h.x, y: h.y, r: 300, t: 0.5 }); }
      else if (kind === 'shield') S.heroes.forEach(function (x) { if (x.alive) x.shieldT = 5; });
      else if (kind === 'chart') { S.chartT = 12; S.seen.fill(1); S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - h.x, e.y - h.y) < 280) e.stun = 2.5; }); }
      h.t.spec--; h.specCd = 1;
      emit('special', { pi: pi, kind: kind, x: h.x, y: h.y });
      return true;
    }

    // ---------- Враги ----------
    function nearestHero(e) {
      var best = null, bd = 1e9;
      S.heroes.forEach(function (h) { if (!h.alive || h.down) return; var d = Math.hypot(h.x - e.x, h.y - e.y); if (d < bd) { bd = d; best = h; } });
      return best ? { h: best, d: bd } : null;
    }
    function updateEnemies(dt) {
      var two = S.players === 2;
      S.enemies.forEach(function (e) {
        if (e.dead) return;
        if (e.flash > 0) e.flash -= dt; if (e.hitCd > 0) e.hitCd -= dt; if (e.spawnFx > 0) e.spawnFx -= dt;
        var nh = nearestHero(e); if (!nh) return;
        if (nh.d > 15 * T) return;     // спит вдали
        if (e.stun > 0) { e.stun -= dt; return; }
        if (e.type === 'nest') {
          e.spawnCd -= dt;
          var alive = S.enemies.filter(function (k) { return k.parent === e.id && !k.dead; }).length;
          if (e.spawnCd <= 0 && nh.d < 10 * T && alive < (two ? 6 : 5) && S.enemies.length < MAX_EN) {
            e.spawnCd = (3 - 0.25 * S.world) * (two ? 0.8 : 1) + rng();
            var mix = WORLD_MIX[S.world], type = mix[Math.floor(rng() * mix.length)]; if (type === 'heavy' && rng() < 0.5) type = 'tin';
            for (var tr = 0; tr < 8; tr++) { var a = rng() * 6.28, x = e.x + Math.cos(a) * 30, y = e.y + Math.sin(a) * 30; if (!hitsWall(x, y, EN[type].r)) { var k2 = addEnemy(type, x, y, { parent: e.id }); k2.spawnFx = 0.35; emit('spawn', { x: x, y: y }); break; } }
          }
          return;
        }
        var h = nh.h, dx = h.x - e.x, dy = h.y - e.y, d = nh.d || 1, vx = 0, vy = 0;
        e.ang = Math.atan2(dy, dx);
        e.seeT = (e.seeT || 0) - dt; if (e.seeT <= 0) { e.seeT = 0.15 + rng() * 0.1; e.see = d < 8 * T && los(e, h); }
        var see = e.see;
        if (e.type === 'whistle') {
          e.cd -= dt;
          if (e.tele > 0) { e.tele -= dt; if (e.tele <= 0) { var sp = 200 + 15 * S.world, n = S.world >= 3 ? 3 : 1; for (var i = 0; i < n; i++) { var aa = e.ang + (i - (n - 1) / 2) * 0.22; S.eshots.push({ x: e.x, y: e.y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, r: 5, dmg: EN.whistle.dmg, life: 2.6 }); } emit('eshot', { x: e.x, y: e.y }); } }
          else if (see && e.cd <= 0 && d < 300) { e.tele = 0.55; e.cd = 1.9 - 0.15 * S.world + rng() * 0.6; }
          if (see && d < 140) { vx = -dx / d; vy = -dy / d; } else if (!see || d > 230) { var w = downhill(S.field, e); if (w) { vx = w.x - e.x; vy = w.y - e.y; var l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l; } }
        } else {
          if (see && d < 2.2 * T) { vx = dx / d; vy = dy / d; }
          else { var w2 = downhill(S.field, e); if (w2) { vx = w2.x - e.x; vy = w2.y - e.y; var l2 = Math.hypot(vx, vy) || 1; vx /= l2; vy /= l2; } else if (see) { vx = dx / d; vy = dy / d; } }
          if (e.type === 'bug') { e.walk += dt * 9; vx += Math.cos(e.walk) * 0.35 * -vy; vy += Math.cos(e.walk) * 0.35 * vx; }
        }
        // раздвигаемся с соседями
        for (var j = 0; j < S.enemies.length; j++) {
          var o = S.enemies[j]; if (o === e || o.dead || o.type === 'nest') continue;
          var ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), mn = e.r + o.r;
          if (od < mn && od > 0.01) { vx += ox / od * (mn - od) / mn * 1.2; vy += oy / od * (mn - od) / mn * 1.2; }
        }
        if (vx || vy) { var l3 = Math.hypot(vx, vy); if (l3 > 1) { vx /= l3; vy /= l3; } moveBody(e, vx * e.spd * dt, vy * e.spd * dt, e.r); e.walk += dt * 6; }
        // касание (чудище не залезает «внутрь» героя — его выталкивает)
        S.heroes.forEach(function (hh) {
          if (!hh.alive || hh.down) return;
          var qx = e.x - hh.x, qy = e.y - hh.y, qd = Math.hypot(qx, qy), mn = hh.r + e.r - 2;
          if (qd < mn) { if (qd < 0.01) { qx = 1; qy = 0; qd = 1; } moveBody(e, qx / qd * (mn - qd), qy / qd * (mn - qd), e.r); }
          if (Math.hypot(hh.x - e.x, hh.y - e.y) < hh.r + e.r && e.hitCd <= 0) {
            e.hitCd = 0.8;
            if (hh.shieldT > 0) { e.stun = 0.6; emit('block', {}); return; }
            hurtHero(hh, EN[e.type].dmg, e.type);
            var pd = Math.hypot(hh.x - e.x, hh.y - e.y) || 1; moveBody(hh, (hh.x - e.x) / pd * 8, (hh.y - e.y) / pd * 8, hh.r);
          }
        });
      });
      S.enemies = S.enemies.filter(function (e) { return !e.dead; });
    }

    // ---------- Механизм-босс ----------
    function hurtBoss(dmg, raw) {
      var B = S.boss; if (!B || B.dead) return;
      if (!raw && B.armor > 0) dmg *= 0.25;
      B.hp -= dmg; B.flash = 0.06; emit('bossHit', {});
      if (B.hp <= 0) {
        B.dead = true; B.hp = 0; S.score += SCORE.boss * S.world; S.exitOpen = true;
        S.eshots = []; S.enemies.forEach(function (e) { if (!e.dead) killEnemy(e, -1); });
        for (var i = 0; i < 6; i++) S.objs.push({ kind: 'coin', v: 30 + 10 * S.world, x: B.x + Math.cos(i) * 40, y: B.y + Math.sin(i) * 40, drop: true });
        emit('bossDie', { x: B.x, y: B.y }); emit('exitOpen', { x: S.map.exit.x, y: S.map.exit.y });
      }
    }
    function ring(B, n, sp, off) { for (var i = 0; i < n; i++) { var a = off + i * Math.PI * 2 / n; S.eshots.push({ x: B.x + Math.cos(a) * B.r * 0.8, y: B.y + Math.sin(a) * B.r * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: 12, life: 4 }); } emit('eshot', { x: B.x, y: B.y }); }
    function aimed(B, h, n, spread, sp) { var a0 = Math.atan2(h.y - B.y, h.x - B.x); for (var i = 0; i < n; i++) { var a = a0 + (i - (n - 1) / 2) * spread; S.eshots.push({ x: B.x, y: B.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: 12, life: 4 }); } emit('eshot', { x: B.x, y: B.y }); }
    function updateBoss(dt) {
      var B = S.boss; if (!B || B.dead) return;
      if (B.flash > 0) B.flash -= dt;
      if (B.intro > 0) { B.intro -= dt; return; }
      B.t += dt; B.modeT -= dt;
      var nh = nearestHero(B); if (!nh) return; var h = nh.h, two = S.players === 2, rage = B.hp < B.max * 0.5 ? 1.3 : 1;
      if (B.key === 'drill') {
        if (B.mode === 'charge') { if (!moveBody(B, B.vx * dt, B.vy * dt, B.r) || B.modeT <= 0) { B.mode = 'idle'; B.modeT = 2.6 / rage; emit('thud', { x: B.x, y: B.y }); ring(B, 10, 150, rng()); } }
        else if (B.mode === 'tele') { if (B.modeT <= 0) { B.mode = 'charge'; B.modeT = 1; var a = Math.atan2(h.y - B.y, h.x - B.x); B.vx = Math.cos(a) * 270; B.vy = Math.sin(a) * 270; emit('charge', {}); } }
        else { var dd = nh.d || 1; moveBody(B, (h.x - B.x) / dd * 40 * dt, (h.y - B.y) / dd * 40 * dt, B.r); B.a += dt; if (B.a > 2.4 / rage) { B.a = 0; ring(B, 8, 140, B.t); } if (B.modeT <= 0) { B.mode = 'tele'; B.modeT = 0.8; B.ang = Math.atan2(h.y - B.y, h.x - B.x); emit('windup', {}); } }
        B.ang = B.mode === 'idle' ? Math.atan2(h.y - B.y, h.x - B.x) : B.ang;
      } else if (B.key === 'crane') {
        moveBody(B, clamp(h.x - B.x, -1, 1) * 50 * dt, 0, B.r);
        if (B.mode === 'spin') { B.a += dt; if (B.a > 0.13) { B.a = 0; B.ang = (B.ang || 0) + 0.38; ring(B, two ? 3 : 2, 135, B.ang); } if (B.modeT <= 0) { B.mode = 'idle'; B.modeT = 2.2 / rage; } }
        else { B.a += dt; if (B.a > 1.6 / rage) { B.a = 0; aimed(B, h, 3, 0.2, 190); } if (B.modeT <= 0) { B.mode = 'spin'; B.modeT = 2.4; B.a = 0; if (S.enemies.length < 6) { addEnemy('bug', B.x - 60, B.y + 40).spawnFx = 0.4; addEnemy('bug', B.x + 60, B.y + 40).spawnFx = 0.4; } } }
      } else if (B.key === 'pendulum') {
        B.x = B.x0 + Math.sin(B.t * 0.7) * 7 * T; B.y = 4 * T + Math.abs(Math.cos(B.t * 0.7)) * 1.2 * T;
        B.a += dt; if (B.a > 2.1 / rage) { B.a = 0; S.bombs.push({ x: B.x, y: B.y + 30, t: 1.4, r: 56 }); emit('drop', {}); }
        B.modeT -= 0; if (B.modeT <= 0) { B.modeT = 2.4 / rage; aimed(B, h, 5, 0.18, 170); }
      } else if (B.key === 'machine') {
        B.a += dt;
        if (B.mode === 'spiral') { if (B.a > 0.1) { B.a = 0; B.ang = (B.ang || 0) + 0.27; ring(B, 2, 130, B.ang); ring(B, 2, 130, -B.ang); } if (B.modeT <= 0) { B.mode = 'idle'; B.modeT = 2.5 / rage; } }
        else { if (B.a > 1.3 / rage) { B.a = 0; aimed(B, h, 4, 0.14, 200); } if (B.modeT <= 0) { B.mode = 'spiral'; B.modeT = 2.6; if (S.enemies.length < 7) { addEnemy('tin', 3 * T, 4 * T).spawnFx = 0.4; addEnemy('tin', 17 * T, 4 * T).spawnFx = 0.4; } } }
      }
      // касание механизма
      S.heroes.forEach(function (hh) { if (hh.alive && !hh.down && Math.hypot(hh.x - B.x, hh.y - B.y) < hh.r + B.r) { if (hh.shieldT <= 0) hurtHero(hh, 25, 'boss'); var pd = Math.hypot(hh.x - B.x, hh.y - B.y) || 1; moveBody(hh, (hh.x - B.x) / pd * 14, (hh.y - B.y) / pd * 14, hh.r); } });
    }
    function updateBombs(dt) {
      S.bombs = S.bombs.filter(function (b) {
        b.t -= dt; if (b.t > 0) return true;
        S.fx.push({ kind: 'boom', x: b.x, y: b.y, r: b.r, t: 0.35 }); emit('boom', { x: b.x, y: b.y, r: b.r });
        S.heroes.forEach(function (h) { if (h.alive && Math.hypot(h.x - b.x, h.y - b.y) < b.r + h.r) hurtHero(h, 22, 'weight'); });
        return false;
      });
    }

    // ======================================================================
    // ИИ-напарник: следует за игроком, стреляет, держит дистанцию, делит находки, не застревает
    // ======================================================================
    function leader() { return S.heroes[0]; }
    function aiUpdate(h, dt) {
      var A = h.aiS, P = leader();
      A.t -= dt; A.goalT -= dt; A.aimT -= dt; A.specT -= dt; A.warpCd -= dt;
      if (!P.alive) { h.mx = h.my = 0; h.fire = false; return; }
      var f = S.field1 || S.field, fd = f ? fieldAt(f, h.x, h.y) : -1;
      A.catchup = fd > 3;
      if (A.goal && fd > 5) { A.goal = null; A.goalT = 0.8; }   // игрок ушёл — бросить находку и догонять
      // --- не застревает: телепорт к игроку при отставании ---
      if (fd < 0 || fd > 13) A.stuckT += dt * 3;
      else if (fd > 4) { if (fd < A.bestF) { A.bestF = fd; A.stuckT = 0; } else A.stuckT += dt; }
      else { A.bestF = fd; A.stuckT = 0; }
      if (!onScreen(h, -8)) A.offT += dt; else A.offT = 0;
      if ((A.stuckT > 2.5 || A.offT > 2.2) && A.warpCd <= 0) { warpToLeader(h); return; }
      // --- цель и огонь ---
      if (A.aimT <= 0) {
        A.aimT = 0.2; A.target = null; var bd = 290;
        S.enemies.forEach(function (e) { if (e.dead) return; var d = Math.hypot(e.x - h.x, e.y - h.y); if (d < bd && onScreen(e, 10) && los(h, e)) { bd = d; A.target = e; } });
        if (S.boss && !S.boss.dead && S.boss.intro <= 0) { var db = Math.hypot(S.boss.x - h.x, S.boss.y - h.y); if (db < 360 && (!A.target || db < bd + 60) && los(h, S.boss)) A.target = S.boss; }
      }
      var tg = A.target && !A.target.dead ? A.target : null;
      if (tg) {
        var Gs = GUNS[HEROES[h.t.hid].gun][h.t.gun - 1], dd = Math.hypot(tg.x - h.x, tg.y - h.y), lead = dd / Gs.v;
        var tvx = tg.vx || 0, tvy = tg.vy || 0;
        h.aimA = Math.atan2(tg.y + tvy * lead - h.y, tg.x + tvx * lead - h.x); h.fire = true;
        h.face = [Math.cos(h.aimA), Math.sin(h.aimA)];
      } else { h.fire = false; h.aimA = null; }
      // --- спецприём ---
      if (A.specT <= 0 && h.t.spec > 0) {
        var near = S.enemies.filter(function (e) { return !e.dead && e.type !== 'nest' && Math.hypot(e.x - h.x, e.y - h.y) < 200; }).length;
        var kind = HEROES[h.t.hid].spec, use = false;
        if (kind === 'heal') use = P.hp < P.maxHp * 0.35 || h.hp < h.maxHp * 0.3;
        else if (kind === 'bomb') use = near >= 5 || (S.boss && !S.boss.dead && near >= 2 && h.hp < h.maxHp * 0.5);
        else if (kind === 'shield') use = (P.hp < P.maxHp * 0.4 || h.hp < h.maxHp * 0.4) && near >= 2;
        else if (kind === 'chart') use = S.levelT > 25 && S.chartT <= 0 && valvesLeft() > 0 && !S.boss;
        if (use) { special(h.id); A.specT = 8; } else A.specT = 0.5;
      }
      // --- цель-находка (деньги/еда/вентиль), если вокруг тихо ---
      var danger = S.enemies.some(function (e) { return !e.dead && e.type !== 'nest' && Math.hypot(e.x - h.x, e.y - h.y) < 150; });
      if (A.goalT <= 0) {
        A.goalT = 0.5; A.goal = null;
        if (!danger && fd <= 3) {
          var gf = bfsFrom([h], 9), best = null, bdist = 99;
          S.objs.forEach(function (o) {
            if (o.gone) return;
            var want = o.kind === 'coin' || o.kind === 'chest' || o.kind === 'key' || (o.kind === 'charge' && h.t.spec < SHOP.SPEC_MAX) ||
              (o.kind === 'food' && h.hp < h.maxHp * 0.7 && h.hp / h.maxHp < P.hp / P.maxHp) || (o.kind === 'valve' && !o.on);
            if (!want) return;
            var dA = fieldAt(gf, o.x, o.y), dP = f ? fieldAt(f, o.x, o.y) : -1;
            if (dA < 0 || dP < 0 || dP > (o.kind === 'valve' ? 6 : 4) || dA > 6) return;
            var sc = dA - (o.kind === 'valve' ? 2 : 0);
            if (sc < bdist) { bdist = sc; best = o; }
          });
          if (best) { A.goal = best; A.goalF = bfsFrom([best], 12); }
        }
      }
      if (A.goal && (A.goal.gone || (A.goal.kind === 'valve' && A.goal.on))) A.goal = null;
      // --- выбор шага: 8 сторон + стоять, оценка ---
      var spd = heroSpeed(h), look = 0.25, wp = null, followW = 0;
      if (A.goal) { wp = downhill(A.goalF, h) || A.goal; followW = 3; }
      else if (fd > 2) { wp = downhill(f, h); followW = Math.min(6, fd - 1.5) * 2; }
      var bestS = -1e9, bx = 0, by = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = h.x + ux * spd * look, ny = h.y + uy * spd * look;
        if ((dx || dy) && hitsWall(nx, ny, h.r - 1)) { nx = h.x + ux * spd * look * 0.4; ny = h.y + uy * spd * look * 0.4; if (hitsWall(nx, ny, h.r - 1)) continue; }
        var s = 0;
        if (wp && (dx || dy)) { var wx = wp.x - h.x, wy = wp.y - h.y, wl = Math.hypot(wx, wy) || 1; s += (ux * wx + uy * wy) / wl * followW * 10; }
        var pd = Math.hypot(nx - P.x, ny - P.y); if (pd < 30) s -= (30 - pd) * 1.5;
        if (!A.goal && fd <= 2 && pd > 110) s -= (pd - 110) * 0.3;
        S.enemies.forEach(function (e) { if (e.dead) return; var keep = e.type === 'heavy' ? 95 : e.type === 'nest' ? 40 : 75, ed = Math.hypot(nx - e.x, ny - e.y); if (ed < keep) s -= (keep - ed) * (e.type === 'nest' ? 0.4 : 1.4); });
        if (S.boss && !S.boss.dead) { var bdd = Math.hypot(nx - S.boss.x, ny - S.boss.y); if (bdd < S.boss.r + 90) s -= (S.boss.r + 90 - bdd) * 1.6; }
        S.eshots.forEach(function (b) { for (var k = 1; k <= 2; k++) { var t = 0.15 * k, bxx = b.x + b.vx * t, byy = b.y + b.vy * t, px = h.x + ux * spd * t, py = h.y + uy * spd * t; if (Math.hypot(bxx - px, byy - py) < h.r + b.r + 6) s -= 60; } });
        S.bombs.forEach(function (b) { if (Math.hypot(nx - b.x, ny - b.y) < b.r + h.r + 6) s -= 80; });
        if (!dx && !dy) s += 2;
        if (s > bestS) { bestS = s; bx = ux; by = uy; }
      }
      h.mx = bx; h.my = by;
    }
    function warpToLeader(h) {
      var P = leader(), A = h.aiS, d = bfsFrom([P], 3), m = S.map, best = null, bs = -1e9;
      for (var ty = 0; ty < m.TH; ty++) for (var tx = 0; tx < m.TW; tx++) {
        var v = d[ty * m.TW + tx]; if (v < 1 || v > 3) continue;
        var x = tx * T + T / 2, y = ty * T + T / 2; if (hitsWall(x, y, h.r)) continue;
        var s = -Math.abs(v - 1.5) * 3 - (x - P.x) * P.face[0] * 0.05 - (y - P.y) * P.face[1] * 0.05;
        S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - x, e.y - y) < 70) s -= 20; });
        if (s > bs) { bs = s; best = { x: x, y: y }; }
      }
      if (!best) best = { x: P.x, y: P.y };
      var from = { x: h.x, y: h.y };
      h.x = best.x; h.y = best.y; h.inv = Math.max(h.inv, 0.8); A.stuckT = 0; A.offT = 0; A.bestF = 999; A.warpCd = 1.5; A.goal = null;
      S.warps = (S.warps || 0) + 1;
      emit('warp', { pi: h.id, x: h.x, y: h.y, fx: from.x, fy: from.y });
    }

    // ---------- Герои ----------
    function updateHero(h, dt) {
      if (h.inv > 0) h.inv -= dt; if (h.hitT > 0) h.hitT -= dt; if (h.shieldT > 0) h.shieldT -= dt; if (h.specCd > 0) h.specCd -= dt; if (h.cd > 0) h.cd -= dt;
      if (!h.alive) { if (!h.out && h.respawnT > 0) { h.respawnT -= dt; if (h.respawnT <= 0) respawn(h); } return; }
      if (h.down) {
        h.downT -= dt;
        if (h.downT <= 0) { h.down = false; h.hp = h.maxHp * 0.5; h.inv = 2; warpToLeader(h); emit('revive', { pi: h.id, x: h.x, y: h.y }); }
        return;
      }
      if (h.ai) aiUpdate(h, dt);
      var mx = h.mx, my = h.my, l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
      h.moving = l > 0.1;
      if (h.moving && !h.ai && !h.fire) h.face = [Math.sign(mx) * (Math.abs(mx) > 0.3 ? 1 : 0), Math.sign(my) * (Math.abs(my) > 0.3 ? 1 : 0)];
      if (h.moving && h.ai && !h.fire) { h.face = [mx, my]; }
      if (h.moving) {
        var sp = heroSpeed(h) * dt, ox = mx * sp, oy = my * sp;
        // «поводок» вдвоём: не разойтись дальше экрана
        if (S.players === 2) { var o = S.heroes[1 - h.id]; if (o.alive) { if (Math.abs(h.x + ox - o.x) > W - 70 && Math.abs(h.x + ox - o.x) > Math.abs(h.x - o.x)) ox = 0; if (Math.abs(h.y + oy - o.y) > VH - 70 && Math.abs(h.y + oy - o.y) > Math.abs(h.y - o.y)) oy = 0; } }
        moveBody(h, ox, oy, h.r); h.walk += dt * 10;
      }
      var rg = lvlOf(h.t, 'regen'); if (rg && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + 0.8 * rg * dt);
      if (h.fire && h.cd <= 0) fireGun(h);
      pickups(h); tryDoors(h); valves(h, dt);
      if (S.exitOpen && Math.hypot(S.map.exit.x - h.x, S.map.exit.y - h.y) < 24 && !h.ai) levelDone();
    }

    function updateSeen() {
      var m = S.map;
      S.heroes.forEach(function (h) {
        if (!h.alive) return; var t = tileOf(h);
        for (var y = t.y - 6; y <= t.y + 6; y++) for (var x = t.x - 8; x <= t.x + 8; x++) if (x >= 0 && y >= 0 && x < m.TW && y < m.TH) S.seen[y * m.TW + x] = 1;
      });
    }

    function levelDone() {
      if (S.phase !== 'play') return;
      S.phase = 'clear'; S.clearT = 2.2;
      var bonus = SCORE.level * S.world; S.score += bonus;
      emit('levelDone', { world: S.world, lvl: S.lvl, bonus: bonus, boss: !!S.boss });
    }
    function afterClear() {
      S.heroes.forEach(function (h) { h.t.hp = h.alive || h.down ? Math.max(h.hp, 1) : null; });
      if (S.world === WORLDS && S.lvl === LEVELS) { S.phase = 'won'; emit('win', { score: S.score }); return; }
      openShop();
    }
    function nextLevelOf() { return S.lvl < LEVELS ? { world: S.world, lvl: S.lvl + 1 } : { world: S.world + 1, lvl: 1 }; }

    // ---------- Лавка ----------
    function price(pi, item) {
      var t = S.team[pi];
      if (item === 'gun') return t.gun >= 4 ? null : SHOP.gun[t.gun - 1];
      if (item === 'hp') return t.hpL >= 3 ? null : SHOP.hp[t.hpL];
      if (item === 'heal') { var hcur = t.hp != null ? t.hp : maxHp(t); return hcur >= maxHp(t) - 0.5 ? null : SHOP.heal; }
      if (item === 'spec') return t.spec >= SHOP.SPEC_MAX ? null : SHOP.spec;
      var tr = HEROES[t.hid].tree, idx = tr.indexOf(item); if (idx < 0) return null;
      var lv = idx === 0 ? t.mA : t.mB, tab = SHOP[item];
      return lv >= tab.length ? null : tab[lv];
    }
    function buy(pi, item) {
      var t = S.team[pi], p = price(pi, item);
      if (p == null || t.money < p) return false;
      t.money -= p;
      if (item === 'gun') t.gun++;
      else if (item === 'hp') { t.hpL++; if (t.hp != null) t.hp += 25; }
      else if (item === 'heal') t.hp = maxHp(t);
      else if (item === 'spec') t.spec++;
      else { var tr = HEROES[t.hid].tree; if (tr[0] === item) t.mA++; else t.mB++; if (item === 'life') t.lives++; }
      emit('buy', { pi: pi, item: item, price: p });
      return true;
    }
    function aiShop(pi) { // ИИ-напарник покупает сам: ствол → котёл → заряд → мастерство → латка
      var order = ['heal', 'gun', 'hp', 'spec', HEROES[S.team[pi].hid].tree[0], HEROES[S.team[pi].hid].tree[1]], bought = [];
      var t = S.team[pi];
      if (t.hp != null && t.hp < maxHp(t) * 0.7 && buy(pi, 'heal')) bought.push('heal');
      for (var guard = 0; guard < 12; guard++) {
        var any = false;
        for (var i = 1; i < order.length; i++) { if (order[i] === 'spec' && t.spec >= 2) continue; if (buy(pi, order[i])) { bought.push(order[i]); any = true; break; } }
        if (!any) break;
      }
      return bought;
    }
    function openShop() {
      S.phase = 'shop'; S.shop = [{ sel: 0, ready: false, bought: [] }, { sel: 0, ready: false, bought: [] }];
      S.heroes.forEach(function (h) { if (h.out) { /* выбывший возвращается к следующему уровню с одной жизнью */ h.t.lives = Math.max(h.t.lives, 1); } });
      if (S.aiOn) { S.shop[1].bought = aiShop(1); S.shop[1].ready = true; }
      emit('shop', { next: nextLevelOf() });
    }
    function shopReady(pi) {
      if (S.phase !== 'shop') return;
      S.shop[pi].ready = true;
      if ((S.players === 1 || S.shop[0].ready && S.shop[1].ready)) { var n = nextLevelOf(); loadLevel(n.world, n.lvl); }
    }

    // ---------- Сохранение ----------
    function progress() {
      var n = S.phase === 'shop' ? nextLevelOf() : { world: S.world, lvl: S.lvl };
      return { v: 1, world: n.world, lvl: n.lvl, players: S.players, score: S.score, continues: S.continues, seed: S.seed,
        team: S.team.map(function (t) { return { hid: t.hid, gun: t.gun, hpL: t.hpL, mA: t.mA, mB: t.mB, spec: t.spec, money: t.money, lives: t.lives, hp: t.hp }; }) };
    }
    function loadProgress(p) {
      if (!p || !p.team || p.team.length !== 2) return;
      S.world = clamp(p.world | 0, 1, WORLDS); S.lvl = clamp(p.lvl | 0, 1, LEVELS);
      if (p.score != null) S.score = p.score | 0; if (p.continues != null) S.continues = p.continues | 0; if (p.seed != null) S.seed = p.seed | 0;
      S.team = p.team.map(function (t) {
        var n = newTeam(clamp(t.hid | 0, 0, 3)); n.gun = clamp(t.gun | 0, 1, 4); n.hpL = clamp(t.hpL | 0, 0, 3); n.mA = clamp(t.mA | 0, 0, 3); n.mB = clamp(t.mB | 0, 0, 3);
        n.spec = clamp(t.spec | 0, 0, SHOP.SPEC_MAX); n.money = Math.max(0, t.money | 0); n.lives = t.lives != null ? clamp(t.lives | 0, 1, 9) : START_LIVES + (HEROES[n.hid].tree[0] === 'life' ? n.mA : 0) + (HEROES[n.hid].tree[1] === 'life' ? n.mB : 0);
        n.hp = t.hp != null ? +t.hp : null; return n;
      });
      S.loaded = { world: S.world, lvl: S.lvl };
    }

    // ---------- Главный шаг ----------
    function update(dt) {
      S.t += dt;
      if (S.phase === 'cont') { S.contT -= dt; if (S.contT <= 0) { S.phase = 'over'; emit('gameover', { score: S.score }); } return; }
      if (S.phase === 'clear') { S.clearT -= dt; S.heroes.forEach(function (h) { h.mx = h.my = 0; }); if (S.clearT <= 0) afterClear(); return; }
      if (S.phase !== 'play') return;
      S.levelT += dt; if (S.banner > 0) S.banner -= dt; if (S.chartT > 0) S.chartT -= dt;
      S.fieldT -= dt;
      if (S.fieldT <= 0 || !S.field) {
        S.fieldT = 0.25;
        var tg = S.heroes.filter(function (h) { return h.alive && !h.down; });
        S.field = bfsFrom(tg.length ? tg : [S.heroes[0]], 0);
        S.field1 = S.aiOn ? bfsFrom([leader()], 0) : null;
      }
      S.heroes.forEach(function (h) { updateHero(h, dt); });
      if (S.phase !== 'play') return;
      updateEnemies(dt); updateBoss(dt); updateBombs(dt); updateShots(dt);
      S.fx = S.fx.filter(function (f) { f.t -= dt; return f.t > 0; });
      S.objs = S.objs.filter(function (o) { return !o.gone; });
      S.objs.forEach(function (o) { if (o.turning > 0) o.turning -= dt; else if (o.kind === 'valve' && !o.on && o.prog > 0) o.prog = Math.max(0, o.prog - dt * 0.5); });
      updateSeen(); centerCam(false);
    }

    var api = {
      start: function () { var w = S.loaded ? S.loaded.world : 1, l = S.loaded ? S.loaded.lvl : 1; if (opts.world) { w = opts.world; l = opts.lvl || 1; } loadLevel(w, l); return api; },
      update: update,
      setMove: function (pi, dx, dy) { var h = S.heroes[pi]; if (h && !h.ai) { h.mx = dx; h.my = dy; } },
      setFire: function (pi, on) { var h = S.heroes[pi]; if (h && !h.ai) h.fire = !!on; },
      special: special,
      cont: function () { if (S.phase !== 'cont' || S.continues <= 0) return false; S.continues--; S.phase = 'play'; S.heroes.forEach(function (h) { if (!h.ai) { h.t.lives = START_LIVES; h.out = false; respawn(h); } }); emit('continue', {}); return true; },
      state: function () { return S; },
      price: price, buy: buy, shopItems: function (pi) { return SHOP_ITEMS(S.team[pi].hid); }, shopReady: shopReady, aiShop: aiShop,
      progress: progress, password: function () { var p = progress(); return encodePass(p); },
      maxHp: maxHp, valvesLeft: valvesLeft, nextLevel: nextLevelOf,
      _S: S, _loadLevel: loadLevel, _addEnemy: addEnemy, _hitsWall: hitsWall, _bfsFrom: bfsFrom, _fieldAt: fieldAt, _los: los, _warp: warpToLeader, _hurtHero: hurtHero, _levelDone: levelDone, _openShop: openShop, _downhill: downhill
    };
    return api;
  }

  PV.logic = {
    T: T, W: W, VH: VH, HUD: HUD, SCREEN_H: SCREEN_H, WORLDS: WORLDS, LEVELS: LEVELS, TILE: TILE, WALK_SOLID: WALK_SOLID, SHOT_SOLID: SHOT_SOLID,
    HERO_R: HERO_R, VALVE_T: VALVE_T, START_LIVES: START_LIVES, CONTINUES: CONTINUES, CONT_T: CONT_T,
    HEROES: HEROES, GUNS: GUNS, SHOP: SHOP, SHOP_ITEMS: SHOP_ITEMS, EN: EN, WORLD_MIX: WORLD_MIX, BOSSES: BOSSES, SCORE: SCORE, BIND: BIND,
    mulberry32: mulberry32, genLevel: genLevel, solveLevel: solveLevel, astar: astar, bfsTiles: bfsTiles, passableFn: passableFn, tileOf: tileOf,
    valveCount: valveCount, levelDims: levelDims, encodePass: encodePass, decodePass: decodePass, ALPHA: ALPHA
  };
  PV.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
