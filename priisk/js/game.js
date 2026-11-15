/* ПРИИСК · js/game.js — чистая логика RTS (без DOM): карта, A*, юниты, здания, экономика, туман, ИИ.
   Мир: две артели старателей на северном плато. Медь (самородки в отвалах) → рудовоз → плавильня → медь на счёте.
   Пар (котельные) питает стройку: при нехватке пара производство идёт медленнее.
   Координаты — в клетках (дробные), центр клетки (i,j) = (i+0.5, j+0.5). Владелец 0 — игрок, 1 — ИИ.
   Экспорт: window.PRIISK.logic. Детерминизм: всё случайное — из W.rng (mulberry32 от seed). */
(function (root) {
  'use strict';
  var P = root.PRIISK = root.PRIISK || {};

  // Клетки: земля, скала, вода (замёрзшее озеро — непроходимо), лёд (проходим, может треснуть), полынья (открытая вода),
  // мост (проходим, может быть взорван — кампания), провал (яма подземного жара — непроходима), зыбкий грунт (проходим,
  // но строить нельзя, а стоящие на нём здания трещат — кампания).
  var GROUND = 0, ROCK = 1, WATER = 2, ICE = 3, OPEN = 4, BRIDGE = 5, PIT = 6, SHAKY = 7;
  function walkable(t) { return t === GROUND || t === ICE || t === BRIDGE || t === SHAKY; }
  var UNITS = {
    rifleman:  { hp: 60,  speed: 1.7, range: 3.6, dmg: 9,  cd: 0.8, weapon: 'gun',   cost: 100, time: 5,  sight: 5,   r: 0.3,  cls: 'inf', from: 'bunk' },
    crawler:   { hp: 240, speed: 2.7, range: 4.6, dmg: 24, cd: 1.1, weapon: 'shell', cost: 400, time: 9,  sight: 6,   r: 0.42, cls: 'veh', from: 'works' },
    ironwagon: { hp: 560, speed: 1.6, range: 5.2, dmg: 54, cd: 1.9, weapon: 'shell', cost: 800, time: 15, sight: 6.5, r: 0.5,  cls: 'veh', from: 'works' },
    hauler:    { hp: 480, speed: 1.9, range: 0,   dmg: 0,  cd: 0,   weapon: null,    cost: 700, time: 12, sight: 4,   r: 0.5,  cls: 'veh', from: 'works', cap: 200 },
    // герои кампании (не строятся): Варвара Клин — аура боевого духа, Луня — дальний взгляд и метка
    varvara:   { hp: 260, speed: 1.8, range: 3.8, dmg: 12, cd: 0.8, weapon: 'gun',   cost: 0,   time: 0,  sight: 6,   r: 0.34, cls: 'inf', hero: true },
    lunya:     { hp: 150, speed: 2.0, range: 4.2, dmg: 8,  cd: 0.9, weapon: 'gun',   cost: 0,   time: 0,  sight: 9,   r: 0.3,  cls: 'inf', hero: true },
    // Сава Шестерня — механик: чинит технику и здания рядом (на месте), «Аврал» — быстрый ремонт всего вокруг
    sava:      { hp: 210, speed: 1.8, range: 3.4, dmg: 7,  cd: 0.9, weapon: 'gun',   cost: 0,   time: 0,  sight: 5.5, r: 0.32, cls: 'inf', hero: true },
    // сценарная техника кампании (не строится): паровой тягач и прицепные вагоны (u.tow — за кем едет вагон)
    tractor:   { hp: 900, speed: 1.1, range: 0,   dmg: 0,  cd: 0,   weapon: null,    cost: 0,   time: 0,  sight: 5,   r: 0.5,  cls: 'veh' },
    wagon:     { hp: 420, speed: 1.6, range: 0,   dmg: 0,  cd: 0,   weapon: null,    cost: 0,   time: 0,  sight: 3,   r: 0.45, cls: 'veh' },
    // кампания (в скирмише не открыты): подрывник — закладывает заряд с таймером под вышку/рудовоз соперника (без оружия);
    // бур — самоходная буровая: на богатой жиле разворачивается в буровую вышку (packs: 'rig'); фургон — свёрнутое здание в пути
    sapper:    { hp: 55,  speed: 2.0, range: 0,   dmg: 0,  cd: 0,   weapon: null,    cost: 150, time: 6,  sight: 5,   r: 0.3,  cls: 'inf', from: 'bunk', sapper: true },
    drill:     { hp: 320, speed: 1.5, range: 0,   dmg: 0,  cd: 0,   weapon: null,    cost: 600, time: 12, sight: 4,   r: 0.46, cls: 'veh', from: 'works', packs: 'rig' },
    van:       { hp: 520, speed: 1.35, range: 0,  dmg: 0,  cd: 0,   weapon: null,    cost: 0,   time: 0,  sight: 4,   r: 0.5,  cls: 'veh' }
  };
  // Способности героев: cry — «Клич» (аура ×2 на время), flare — «Метка» (открыть туман в точке на время).
  var HEROES = {
    varvara: { ability: 'cry', cd: 30, dur: 8, aura: 4.5, dmg: 1.25, spd: 1.15, cryDmg: 1.5, crySpd: 1.3 },
    lunya:   { ability: 'flare', cd: 25, dur: 12, r: 6, reach: 18 },
    sava:    { ability: 'fix', cd: 35, dur: 6, r: 4.5, rate: 45, field: 2.6, fieldRate: 5 }
  };
  var BLDS = {
    hq:      { w: 3, h: 3, hp: 1600, cost: 0,   time: 0,  power: 10,  req: [],          sight: 7 },
    boiler:  { w: 2, h: 2, hp: 500,  cost: 300, time: 10, power: 20,  req: [],          sight: 4 },
    bunk:    { w: 2, h: 2, hp: 600,  cost: 300, time: 12, power: -5,  req: ['boiler'],  sight: 4 },
    smelter: { w: 3, h: 2, hp: 900,  cost: 600, time: 18, power: -10, req: ['boiler'],  sight: 4 },
    works:   { w: 3, h: 3, hp: 1000, cost: 800, time: 20, power: -15, req: ['smelter'], sight: 4 },
    // укрепления (кампания; в скирмише не открыты): частокол — дешёвая стенка 1×1, вышка — стрелковая точка 2×2.
    // fort — укрепление; gap — на сколько клеток от своих зданий можно ставить; minor — потеря не считается потерей здания
    palisade: { w: 1, h: 1, hp: 380, cost: 60, time: 2.5, power: 0, req: [], sight: 2, fort: true, gap: 7, minor: true },
    tower:   { w: 2, h: 2, hp: 650,  cost: 260, time: 9,  power: 0,   req: ['bunk'],    sight: 7, fort: true, gap: 7, weapon: 'gun', range: 5.6, dmg: 11, cd: 0.75 },
    // буровая вышка (кампания): не строится из панели — её разворачивает бур на богатой жиле; качает медь сама (rate в секунду
    // из клеток под собой и вокруг, без рудовоза), но шумит (loud): сопернику её видно сквозь туман
    rig:     { w: 2, h: 2, hp: 900,  cost: 0,   time: 0,  power: 0,   req: [],          sight: 3, rate: 4, loud: true, noPanel: true }
  };
  var FORT_LIST = ['palisade', 'tower'];
  // Юниты кампании, которых нет в скирмише (кнопки — только если миссия их открыла)
  var CAMP_UNITS = ['sapper', 'drill'];
  // Заряд подрывника: таймер, урон цели, обезвреживание (свои юниты цели рядом с зарядом столько секунд)
  var CHARGE = { plant: 1.5, timer: 10, dmg: 1000, splash: 1.4, splashDmg: 60, defuse: 2.5, defR: 1.4 };
  var PLANTABLE = { rig: 1, drill: 1, hauler: 1, van: 1 };
  // Перенос зданий: «свернуть» в фургон и «развернуть» на новом месте; после разворота здание setup секунд не работает
  var SETUP = 5, NO_PACK = { palisade: 1 };
  // Ремонт зданий: REPAIR — доля прочности в секунду; цена — медь за единицу прочности (от стоимости здания)
  var REPAIR = 0.03;
  function repairPrice(type) { var d = BLDS[type]; return Math.max(0.15, d.cost / d.hp * 0.5); }
  var BUILD_LIST = ['boiler', 'bunk', 'smelter', 'works'];
  var UNIT_LIST = ['rifleman', 'crawler', 'ironwagon', 'hauler'];
  var MULT = { gun: { inf: 1, veh: 0.3, bld: 0.4 }, shell: { inf: 0.5, veh: 1, bld: 0.9 } };
  var LOW_POWER = 0.4, BUILD_GAP = 4, SQ2 = Math.SQRT2;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Мир ----------
  function emptyWorld(w, h, seed) {
    var W = {
      w: w, h: h, t: new Uint8Array(w * h), ore: new Uint16Array(w * h), occ: new Int32Array(w * h),
      vis: new Uint8Array(w * h), units: [], blds: [], byId: Object.create(null), nextId: 1, time: 0,
      rng: mulberry32(seed || 1), fx: [], events: [], winner: -1, visT: 0, sightMul: 1, flares: [], mapRev: 0,
      players: [newPlayer(0), newPlayer(1)], ai: null, oreMax: 0, hadHq: [false, false], charges: [], hits: Object.create(null)
    };
    return W;
  }
  function newPlayer(id) { return { id: id, copper: 0, pOut: 0, pUse: 0, build: null, inf: [], infP: 0, veh: [], vehP: 0, score: 0, mined: 0, kills: 0, lost: 0, lostB: 0, trained: {} }; }

  // Тестовая/своя карта из строк: '#' скала, '~' вода, 'o' медь (300), '.' земля.
  function worldFromMap(rows, opt) {
    opt = opt || {};
    var W = emptyWorld(rows[0].length, rows.length, opt.seed || 1);
    for (var j = 0; j < W.h; j++) for (var i = 0; i < W.w; i++) {
      var c = rows[j][i], k = j * W.w + i;
      if (c === '#') W.t[k] = ROCK; else if (c === '~') W.t[k] = WATER; else if (c === 'o') W.ore[k] = 300;
    }
    W.oreMax = 500;
    return W;
  }

  // Плато 64×48: скальные гряды с проходами, замёрзшее озеро в центре, отвалы меди у баз и у озера.
  var MAP_W = 64, MAP_H = 48;
  var START = [{ hq: { x: 5, y: 37 } }, { hq: { x: 56, y: 7 } }];
  function newWorld(opt) {
    opt = opt || {};
    var seed = opt.seed || 1, W;
    for (var attempt = 0; attempt < 40; attempt++) {
      W = emptyWorld(MAP_W, MAP_H, seed + attempt * 7919);
      genTerrain(W);
      if (connected(W)) break;
    }
    W.oreMax = 520;
    var startCopper = opt.copper != null ? opt.copper : 2500;
    for (var o = 0; o < 2; o++) {
      var hq = START[o].hq; addBuilding(W, o, 'hq', hq.x, hq.y);
      W.players[o].copper = startCopper;
      var ex = o === 0 ? hq.x + 4 : hq.x - 2, ey = o === 0 ? hq.y - 2 : hq.y + 4;
      addUnit(W, o, 'crawler', ex + 0.5, ey + 0.5);
      for (var r = 0; r < 3; r++) addUnit(W, o, 'rifleman', ex + 1.5 + (r % 2), ey + 1.5 + (r >> 1));
    }
    if (opt.ai !== false) W.ai = newAI(W, 1);
    updateVis(W);
    return W;
  }
  function patch(W, cx, cy, rad, fn) {
    for (var j = Math.floor(cy - rad - 1); j <= cy + rad + 1; j++) for (var i = Math.floor(cx - rad - 1); i <= cx + rad + 1; i++) {
      if (i < 1 || j < 1 || i >= W.w - 1 || j >= W.h - 1) continue;
      var d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy) + (W.rng() - 0.5) * 1.2;
      if (d <= rad) fn(j * W.w + i, d);
    }
  }
  function nearBase(i, j, pad) {
    for (var o = 0; o < 2; o++) { var h = START[o].hq; if (Math.abs(i - h.x - 1) <= pad && Math.abs(j - h.y - 1) <= pad) return true; }
    return false;
  }
  function genTerrain(W) {
    var w = W.w, h = W.h, R = W.rng, i, j, k;
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) if (i === 0 || j === 0 || i === w - 1 || j === h - 1) W.t[j * w + i] = ROCK;
    // замёрзшее озеро
    patch(W, 32 + (R() - 0.5) * 4, 24 + (R() - 0.5) * 3, 3.6, function (k) { W.t[k] = WATER; });
    // гряды: отрезки скал с разрывами
    for (var n = 0; n < 9; n++) {
      var x = 8 + R() * 48, y = 6 + R() * 36, ang = R() * Math.PI, len = 5 + R() * 9;
      for (var s = 0; s < len; s++) {
        var px = x + Math.cos(ang) * s, py = y + Math.sin(ang) * s;
        if (R() < 0.12) continue; // разрыв-проход
        var ii = Math.floor(px), jj = Math.floor(py);
        for (var dj = 0; dj < 2; dj++) for (var di = 0; di < 2; di++) {
          var a = ii + di, b = jj + dj; if (a < 1 || b < 1 || a >= w - 1 || b >= h - 1 || nearBase(a, b, 7)) continue;
          if (W.t[b * w + a] === GROUND) W.t[b * w + a] = ROCK;
        }
      }
    }
    // валуны
    for (n = 0; n < 26; n++) { i = 2 + Math.floor(R() * (w - 4)); j = 2 + Math.floor(R() * (h - 4)); if (!nearBase(i, j, 6)) W.t[j * w + i] = ROCK; }
    // отвалы меди: у каждой базы, два у озера, один богатый в «ничьей» зоне
    var fields = [[14, 40, 3.2], [49, 8, 3.2], [24, 29, 2.8], [40, 19, 2.8], [10, 12, 3], [54, 36, 3]];
    fields.forEach(function (f) {
      patch(W, f[0], f[1], f[2], function (k, d) { if (W.t[k] === GROUND) W.ore[k] = Math.round(220 + (1 - d / f[2]) * 300); });
      // проход к полю — чистим центр
      var c = Math.floor(f[1]) * w + Math.floor(f[0]); if (W.t[c] !== GROUND) W.t[c] = GROUND;
    });
    for (k = 0; k < w * h; k++) if (W.t[k] !== GROUND) W.ore[k] = 0;
  }
  function connected(W) {
    var a = START[0].hq, b = START[1].hq, seen = bfsReach(W, a.x + 1, a.y + 3);
    if (!seen[(b.y + 3) * W.w + b.x + 1]) return false;
    var oreTiles = 0, reach = 0;
    for (var k = 0; k < W.w * W.h; k++) if (W.ore[k]) { oreTiles++; if (seen[k] || nbSeen(W, seen, k)) reach++; }
    return reach >= oreTiles * 0.9 && oreTiles > 40;
  }
  function nbSeen(W, seen, k) { var i = k % W.w, j = (k / W.w) | 0; for (var d = 0; d < 8; d++) { var a = i + DX[d], b = j + DY[d]; if (a >= 0 && b >= 0 && a < W.w && b < W.h && seen[b * W.w + a]) return true; } return false; }
  function bfsReach(W, si, sj) {
    var seen = new Uint8Array(W.w * W.h), q = [sj * W.w + si]; seen[q[0]] = 1;
    for (var h = 0; h < q.length; h++) {
      var k = q[h], i = k % W.w, j = (k / W.w) | 0;
      for (var d = 0; d < 4; d++) { var a = i + DX[d], b = j + DY[d]; if (a < 0 || b < 0 || a >= W.w || b >= W.h) continue; var n = b * W.w + a; if (!seen[n] && W.t[n] === GROUND) { seen[n] = 1; q.push(n); } }
    }
    return seen;
  }

  // ---------- Сетка ----------
  var DX = [1, 0, -1, 0, 1, -1, -1, 1], DY = [0, 1, 0, -1, 1, 1, -1, -1];
  function inb(W, i, j) { return i >= 0 && j >= 0 && i < W.w && j < W.h; }
  function passable(W, i, j) { if (!inb(W, i, j)) return false; var k = j * W.w + i; return walkable(W.t[k]) && W.occ[k] === 0; }
  function nearestPassable(W, i, j, maxR, avoidUnits) {
    if (passable(W, i, j) && !(avoidUnits && unitOn(W, i, j))) return { i: i, j: j };
    for (var r = 1; r <= (maxR || 10); r++) {
      var best = null, bd = 1e9;
      for (var b = j - r; b <= j + r; b++) for (var a = i - r; a <= i + r; a++) {
        if (Math.max(Math.abs(a - i), Math.abs(b - j)) !== r || !passable(W, a, b) || (avoidUnits && unitOn(W, a, b))) continue;
        var d = Math.hypot(a - i, b - j); if (d < bd) { bd = d; best = { i: a, j: b }; }
      }
      if (best) return best;
    }
    return null;
  }
  function unitOn(W, i, j) { for (var n = 0; n < W.units.length; n++) { var u = W.units[n]; if (Math.floor(u.x) === i && Math.floor(u.y) === j) return true; } return false; }

  // A*: 8 направлений, без срезания углов у препятствий, октильная эвристика. Возвращает [{x,y}] (центры клеток)
  // без стартовой клетки. Если цель непроходима — идём к ближайшей проходимой; если недостижима — к ближайшей достижимой точке.
  function findPath(W, sx, sy, gx, gy, maxNodes) {
    var w = W.w, h = W.h, si = Math.floor(sx), sj = Math.floor(sy), gi = Math.floor(gx), gj = Math.floor(gy);
    if (!inb(W, gi, gj)) { gi = Math.max(0, Math.min(w - 1, gi)); gj = Math.max(0, Math.min(h - 1, gj)); }
    if (!passable(W, gi, gj)) { var np = nearestPassable(W, gi, gj, 12); if (!np) return []; gi = np.i; gj = np.j; }
    if (si === gi && sj === gj) return [{ x: gi + 0.5, y: gj + 0.5 }];
    var N = w * h, G = new Float32Array(N), came = new Int32Array(N), state = new Uint8Array(N);
    G.fill(Infinity); came.fill(-1);
    var heap = [], hf = [];
    function push(k, f) { heap.push(k); hf.push(f); var c = heap.length - 1; while (c > 0) { var p = (c - 1) >> 1; if (hf[p] <= hf[c]) break; swap(p, c); c = p; } }
    function swap(a, b) { var t = heap[a]; heap[a] = heap[b]; heap[b] = t; t = hf[a]; hf[a] = hf[b]; hf[b] = t; }
    function pop() { var top = heap[0], lk = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lk; hf[0] = lf; var c = 0; for (;;) { var l = c * 2 + 1, r = l + 1, m = c; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === c) break; swap(m, c); c = m; } } return top; }
    function hh(i, j) { var dx = Math.abs(i - gi), dy = Math.abs(j - gj); return (dx + dy) + (SQ2 - 2) * Math.min(dx, dy); }
    var s = sj * w + si, goal = gj * w + gi; G[s] = 0; push(s, hh(si, sj));
    var best = s, bestH = hh(si, sj), exp = 0, lim = maxNodes || N;
    while (heap.length) {
      var k = pop(); if (state[k] === 2) continue; state[k] = 2;
      if (k === goal) { best = k; break; }
      var i = k % w, j = (k / w) | 0, hk = hh(i, j);
      if (hk < bestH) { bestH = hk; best = k; }
      if (++exp > lim) break;
      for (var d = 0; d < 8; d++) {
        var a = i + DX[d], b = j + DY[d]; if (!passable(W, a, b)) continue;
        if (d >= 4 && (!passable(W, i + DX[d], j) || !passable(W, i, j + DY[d]))) continue; // не срезаем угол
        var n = b * w + a; if (state[n] === 2) continue;
        var ng = G[k] + (d >= 4 ? SQ2 : 1);
        if (ng < G[n]) { G[n] = ng; came[n] = k; push(n, ng + hh(a, b)); }
      }
    }
    var out = [], c = best;
    while (c !== s && c !== -1) { out.push({ x: (c % w) + 0.5, y: ((c / w) | 0) + 0.5 }); c = came[c]; }
    out.reverse();
    return smooth(W, { x: sx, y: sy }, out);
  }
  // Сглаживание: выкидываем промежуточные точки, если отрезок проходит по свободным клеткам (с запасом на радиус).
  function smooth(W, from, pts) {
    if (pts.length < 3) return pts;
    var out = [], cur = from, i = 0;
    while (i < pts.length) {
      var far = i;
      for (var k = Math.min(pts.length - 1, i + 8); k > i; k--) if (clearLine(W, cur, pts[k])) { far = k; break; }
      out.push(pts[far]); cur = pts[far]; i = far + 1;
    }
    return out;
  }
  function clearLine(W, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), n = Math.ceil(L * 4);
    for (var s = 0; s <= n; s++) {
      var x = a.x + dx * s / n, y = a.y + dy * s / n;
      for (var o = 0; o < 4; o++) { var ox = x + (o & 1 ? 0.32 : -0.32), oy = y + (o & 2 ? 0.32 : -0.32); if (!passable(W, Math.floor(ox), Math.floor(oy))) return false; }
    }
    return true;
  }

  // ---------- Сущности ----------
  function addBuilding(W, owner, type, tx, ty, noFree) {
    var d = BLDS[type], b = { id: W.nextId++, kind: 'bld', type: type, owner: owner, tx: tx, ty: ty, w: d.w, h: d.h, hp: d.hp, maxHp: d.hp, rally: null, hitT: -99, hitBy: 0 };
    for (var j = 0; j < d.h; j++) for (var i = 0; i < d.w; i++) W.occ[(ty + j) * W.w + tx + i] = b.id;
    W.blds.push(b); W.byId[b.id] = b; calcPower(W);
    if (type === 'hq') W.hadHq[owner] = true;
    if (type === 'smelter' && !noFree) { // плавильня приходит со своим рудовозом
      var dock = dockOf(W, b), sp = nearestPassable(W, dock.i, dock.j + 1, 6, true) || dock;
      var u = addUnit(W, owner, 'hauler', sp.i + 0.5, sp.j + 0.5); u.order = { t: 'harvest', s: 'seek' };
    }
    return b;
  }
  function addUnit(W, owner, type, x, y) {
    var d = UNITS[type], u = { id: W.nextId++, kind: 'unit', type: type, owner: owner, x: x, y: y, hp: d.hp, maxHp: d.hp, path: [], order: { t: 'idle' },
      cd: 0, heading: owner === 0 ? -Math.PI / 4 : Math.PI * 3 / 4, aim: null, carry: 0, scanT: W.rng() * 0.5, chk: { x: x, y: y, t: 0 }, stuck: 0, hitT: -99, hitBy: 0, fireT: -9 };
    u.aim = u.heading; if (HEROES[type]) { u.abT = 0; u.abOn = 0; }
    W.units.push(u); W.byId[u.id] = u; return u;
  }
  function calcPower(W) {
    for (var o = 0; o < 2; o++) { W.players[o].pOut = 0; W.players[o].pUse = 0; }
    W.blds.forEach(function (b) { if (b.setup > 0) return; var p = BLDS[b.type].power, pl = W.players[b.owner]; if (p > 0) pl.pOut += p; else pl.pUse -= p; });
  }
  function powerFactor(W, o) { var p = W.players[o]; return p.pOut >= p.pUse ? 1 : LOW_POWER; }
  function has(W, o, type) { for (var n = 0; n < W.blds.length; n++) if (W.blds[n].owner === o && W.blds[n].type === type) return W.blds[n]; return null; }
  // здание, которое сейчас работает (не в сборке после переноса)
  function working(W, o, type) { for (var n = 0; n < W.blds.length; n++) { var b = W.blds[n]; if (b.owner === o && b.type === type && !(b.setup > 0)) return b; } return null; }
  // Контора жива: стоит или едет свёрнутой в фургоне
  function hqAlive(W, o) { if (has(W, o, 'hq')) return true; for (var n = 0; n < W.units.length; n++) { var u = W.units[n]; if (u.owner === o && u.packed && u.packed.type === 'hq' && u.hp > 0) return true; } return false; }
  function count(W, o, type) { var c = 0; W.blds.forEach(function (b) { if (b.owner === o && b.type === type) c++; }); W.units.forEach(function (u) { if (u.owner === o && u.type === type) c++; }); return c; }
  function reqMet(W, o, type) {
    if (!has(W, o, 'hq') && BLDS[type]) return false;
    var req = BLDS[type] ? BLDS[type].req : [UNITS[type].from];
    for (var n = 0; n < req.length; n++) if (!has(W, o, req[n])) return false;
    return true;
  }
  function dockOf(W, b) { var i = b.tx + Math.floor(b.w / 2), j = b.ty + b.h; return passable(W, i, j) ? { i: i, j: j } : (nearestPassable(W, i, j, 5) || { i: i, j: j }); }
  function center(e) { return e.kind === 'bld' ? { x: e.tx + e.w / 2, y: e.ty + e.h / 2 } : { x: e.x, y: e.y }; }
  function distTo(u, e) { // от юнита до края цели
    if (e.kind === 'unit') return Math.max(0, Math.hypot(e.x - u.x, e.y - u.y) - UNITS[e.type].r);
    var cx = Math.max(e.tx, Math.min(e.tx + e.w, u.x)), cy = Math.max(e.ty, Math.min(e.ty + e.h, u.y));
    return Math.hypot(cx - u.x, cy - u.y);
  }
  function alive(e) { return e && e.hp > 0; }

  // ---------- Стройка и производство ----------
  function startBuild(W, o, type) {
    var p = W.players[o], d = BLDS[type];
    if (!d || p.build || !reqMet(W, o, type) || p.copper < d.cost) return false;
    p.copper -= d.cost; p.build = { type: type, p: 0, ready: false }; return true;
  }
  function cancelBuild(W, o) { var p = W.players[o]; if (!p.build) return false; p.copper += BLDS[p.build.type].cost; p.build = null; return true; }
  function queueUnit(W, o, type) {
    var p = W.players[o], d = UNITS[type], q = d.from === 'bunk' ? p.inf : p.veh;
    if (!reqMet(W, o, type) || p.copper < d.cost || q.length >= 6) return false;
    p.copper -= d.cost; q.push(type); return true;
  }
  function dequeueUnit(W, o, type) {
    var p = W.players[o], d = UNITS[type], q = d.from === 'bunk' ? p.inf : p.veh, k = q.lastIndexOf(type);
    if (k < 0) return false; q.splice(k, 1); if (k === 0) { if (d.from === 'bunk') p.infP = 0; else p.vehP = 0; }
    p.copper += d.cost; return true;
  }
  function canPlace(W, o, type, tx, ty) {
    var d = BLDS[type]; if (!d) return false;
    if (tx < 1 || ty < 1 || tx + d.w > W.w - 1 || ty + d.h > W.h - 1) return false;
    for (var j = 0; j < d.h; j++) for (var i = 0; i < d.w; i++) { var k = (ty + j) * W.w + tx + i; if (W.t[k] !== GROUND || W.occ[k] || W.ore[k]) return false; }
    for (var n = 0; n < W.units.length; n++) { var u = W.units[n], r = UNITS[u.type].r; if (u.x + r > tx && u.x - r < tx + d.w && u.y + r > ty && u.y - r < ty + d.h) return false; }
    var near = false;
    for (n = 0; n < W.blds.length; n++) { var b = W.blds[n]; if (b.owner !== o) continue;
      var gx = Math.max(b.tx - (tx + d.w), tx - (b.tx + b.w), 0), gy = Math.max(b.ty - (ty + d.h), ty - (b.ty + b.h), 0);
      if (Math.max(gx, gy) <= (d.gap || BUILD_GAP)) { near = true; break; } }
    return near;
  }
  function placeBuild(W, o, tx, ty) {
    var p = W.players[o]; if (!p.build || !p.build.ready || !canPlace(W, o, p.build.type, tx, ty)) return null;
    var b = addBuilding(W, o, p.build.type, tx, ty); p.build = null; W.events.push({ t: 'placed', owner: o, id: b.id }); return b;
  }
  function production(W, o, dt) {
    var p = W.players[o], pf = powerFactor(W, o);
    if (p.build && !p.build.ready) { p.build.p += dt / BLDS[p.build.type].time * pf; if (p.build.p >= 1) { p.build.p = 1; p.build.ready = true; W.events.push({ t: 'ready', owner: o }); } }
    [['inf', 'infP', 'bunk'], ['veh', 'vehP', 'works']].forEach(function (q) {
      var list = p[q[0]]; if (!list.length) return;
      var fac = working(W, o, q[2]); if (!fac) return;
      p[q[1]] += dt / UNITS[list[0]].time * pf;
      if (p[q[1]] >= 1) { p[q[1]] = 0; spawnFrom(W, fac, list.shift()); }
    });
  }
  function spawnFrom(W, b, type) {
    var ex = b.tx + Math.floor(b.w / 2), ey = b.ty + b.h, sp = nearestPassable(W, ex, ey, 8, true) || nearestPassable(W, ex, ey, 8);
    if (!sp) return null;
    var u = addUnit(W, b.owner, type, sp.i + 0.5, sp.j + 0.5); u.heading = u.aim = Math.PI / 2;
    var tr = W.players[b.owner].trained; tr[type] = (tr[type] || 0) + 1;
    if (type === 'hauler') u.order = { t: 'harvest', s: 'seek' };
    else if (b.rally) commandMove(W, [u.id], b.rally.x, b.rally.y);
    W.events.push({ t: 'unit', owner: b.owner, id: u.id });
    return u;
  }

  // ---------- Приказы ----------
  function spreadTiles(W, x, y, n) { // BFS от ближайшей проходимой клетки цели: n разных клеток рядом, чтобы отряд не «слипался» в одну
    var st = nearestPassable(W, Math.floor(x), Math.floor(y), 12); if (!st) return [];
    var out = [], seen = Object.create(null), q = [st]; seen[st.j * W.w + st.i] = 1;
    for (var h = 0; h < q.length && out.length < n; h++) {
      var c = q[h]; out.push(c);
      for (var d = 0; d < 8; d++) { var a = c.i + DX[d], b = c.j + DY[d], k = b * W.w + a; if (!seen[k] && passable(W, a, b)) { seen[k] = 1; q.push({ i: a, j: b }); } }
    }
    return out;
  }
  function liveUnits(W, ids) { return ids.map(function (id) { return W.byId[id]; }).filter(function (u) { return alive(u) && u.kind === 'unit'; }); }
  function commandMove(W, ids, x, y, amove) {
    var us = liveUnits(W, ids); if (!us.length) return;
    var tiles = spreadTiles(W, x, y, us.length);
    // ближайшие к цели юниты получают ближайшие клетки (порядок BFS)
    us.sort(function (a, b) { return Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y); });
    us.forEach(function (u, n) {
      var t = tiles[n] || tiles[tiles.length - 1] || { i: Math.floor(x), j: Math.floor(y) };
      u.order = amove ? { t: 'amove', x: t.i + 0.5, y: t.j + 0.5 } : { t: 'move', x: t.i + 0.5, y: t.j + 0.5 };
      u.path = findPath(W, u.x, u.y, t.i + 0.5, t.j + 0.5); u.stuck = 0; u.chk = { x: u.x, y: u.y, t: 0 };
    });
  }
  function commandAttack(W, ids, targetId) {
    var tg = W.byId[targetId]; if (!alive(tg)) return;
    var rest = [];
    liveUnits(W, ids).forEach(function (u) {
      if (!UNITS[u.type].weapon) { rest.push(u.id); return; }
      u.order = { t: 'attack', target: targetId }; u.path = []; u.repath = 0;
    });
    if (rest.length) { var c = center(tg); commandMove(W, rest, c.x, c.y); }
  }
  function commandHarvest(W, ids, i, j) {
    var rest = [];
    liveUnits(W, ids).forEach(function (u) { if (u.type === 'hauler') { u.order = { t: 'harvest', s: 'seek', px: i, py: j }; u.path = []; } else rest.push(u.id); });
    if (rest.length) commandMove(W, rest, i + 0.5, j + 0.5);
  }
  function commandReturn(W, ids, smelterId) {
    var rest = [];
    liveUnits(W, ids).forEach(function (u) { if (u.type === 'hauler') { u.order = { t: 'harvest', s: 'return', prefer: smelterId, px: u.order.px, py: u.order.py }; u.path = []; } else rest.push(u.id); });
    if (rest.length) { var b = W.byId[smelterId]; commandMove(W, rest, b.tx + b.w / 2, b.ty + b.h + 1); }
  }
  // Что сделает ПКМ в точке (x,y) для выделения ids игрока o: 'attack' | 'harvest' | 'return' | 'move' | 'deny' (для курсора и приказа).
  function smartKind(W, o, ids, x, y, target) {
    var us = liveUnits(W, ids).filter(function (u) { return u.owner === o; }); if (!us.length) return null;
    var i = Math.floor(x), j = Math.floor(y); if (!inb(W, i, j)) return 'deny';
    var armed = us.some(function (u) { return !!UNITS[u.type].weapon; }), haul = us.some(function (u) { return u.type === 'hauler'; });
    if (target && target.owner !== o && us.some(function (u) { return UNITS[u.type].sapper; }) && canPlantOn(W, target)) return 'plant';
    if (target && target.owner !== o && armed) return 'attack';
    if (target && target.owner === o && target.type === 'smelter' && haul) return 'return';
    if (!target && W.ore[j * W.w + i] > 0 && haul) return 'harvest';
    if (target && target.kind === 'bld') return 'deny';
    if (!walkable(W.t[j * W.w + i])) return 'deny';
    return 'move';
  }
  function commandSmart(W, o, ids, x, y, target) {
    var k = smartKind(W, o, ids, x, y, target);
    if (k === 'plant') commandPlant(W, ids, target.id);
    else if (k === 'attack') commandAttack(W, ids, target.id);
    else if (k === 'return') commandReturn(W, ids, target.id);
    else if (k === 'harvest') commandHarvest(W, ids, Math.floor(x), Math.floor(y));
    else if (k === 'move') commandMove(W, ids, x, y);
    return k;
  }
  // Подрывники — закладывать заряд под цель; остальные выбранные (охрана) идут с ними в атаку-движение
  function canPlantOn(W, e) { var pl = W.plantable || PLANTABLE; return !!e && alive(e) && !!pl[e.type] && !W.charges.some(function (c) { return c.target === e.id; }); }
  function commandPlant(W, ids, targetId) {
    var tg = W.byId[targetId]; if (!alive(tg)) return;
    var rest = [], c = center(tg);
    liveUnits(W, ids).forEach(function (u) { if (UNITS[u.type].sapper) { u.order = { t: 'plant', target: targetId, p: 0 }; u.path = []; u.repath = 0; } else rest.push(u.id); });
    if (rest.length) commandMove(W, rest, c.x, c.y, true);
  }
  function stopUnits(W, ids) { liveUnits(W, ids).forEach(function (u) { u.path = []; u.order = { t: 'idle' }; }); }

  // ---------- Выбор (для мыши) ----------
  function pickAt(W, x, y, pred) {
    var best = null, bd = 1e9;
    W.units.forEach(function (u) { if (pred && !pred(u)) return; var d = Math.hypot(u.x - x, u.y - y); if (d < UNITS[u.type].r + 0.2 && d < bd) { bd = d; best = u; } });
    if (best) return best;
    for (var n = W.blds.length - 1; n >= 0; n--) { var b = W.blds[n]; if (pred && !pred(b)) continue; if (x >= b.tx && x < b.tx + b.w && y >= b.ty && y < b.ty + b.h) return b; }
    return null;
  }
  // Рамка: все свои юниты, центр которых внутри прямоугольника (клетки). Если в рамке есть боевые — рудовозы не берём
  // (привычное поведение: рамкой по базе выделяется армия, а не комбайны).
  function boxSelect(W, o, r) {
    var x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1), y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1);
    var got = W.units.filter(function (u) { return u.owner === o && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1; });
    if (got.some(function (u) { return u.type !== 'hauler'; })) got = got.filter(function (u) { return u.type !== 'hauler'; });
    return got.map(function (u) { return u.id; });
  }
  function sameTypeIn(W, o, type, r) {
    return W.units.filter(function (u) { return u.owner === o && u.type === type && u.x >= r.x0 && u.x <= r.x1 && u.y >= r.y0 && u.y <= r.y1; }).map(function (u) { return u.id; });
  }

  // ---------- Шаг мира ----------
  function step(W, dt) {
    if (W.winner >= 0) return;
    W.time += dt;
    production(W, 0, dt); production(W, 1, dt);
    if (W.ai) { if (W.ai.race) raceStep(W, dt); else aiStep(W, dt); }
    heroStep(W, dt);
    for (var n = 0; n < W.units.length; n++) unitStep(W, W.units[n], dt);
    for (n = 0; n < W.blds.length; n++) bldStep(W, W.blds[n], dt);
    separate(W, dt);
    if (W.charges.length) chargeStep(W, dt);
    // смерти
    var dead = false;
    W.units = W.units.filter(function (u) { if (u.hp > 0) return true; kill(W, u); dead = true; return false; });
    W.blds = W.blds.filter(function (b) { if (b.hp > 0) return true; kill(W, b); dead = true; return false; });
    if (dead) calcPower(W);
    for (n = W.fx.length - 1; n >= 0; n--) { W.fx[n].life -= dt; if (W.fx[n].life <= 0) W.fx.splice(n, 1); }
    W.visT -= dt; if (W.visT <= 0) { W.visT = 0.2; updateVis(W); }
    if (W.hadHq[1] && !hqAlive(W, 1)) W.winner = 0; else if (W.hadHq[0] && !hqAlive(W, 0)) W.winner = 1;
    if (W.winner === 0) W.players[0].score += 1000 + Math.max(0, Math.round(1500 - W.time));
  }
  function kill(W, e) {
    delete W.byId[e.id];
    if (e.kind === 'bld') for (var j = 0; j < e.h; j++) for (var i = 0; i < e.w; i++) { var k = (e.ty + j) * W.w + e.tx + i; if (W.occ[k] === e.id) W.occ[k] = 0; }
    var c = center(e), val = e.kind === 'bld' ? Math.max(200, BLDS[e.type].cost) : UNITS[e.type].cost;
    if (!(e.kind === 'bld' && BLDS[e.type].minor)) { W.players[e.owner].lost++; if (e.kind === 'bld' || e.packed) W.players[e.owner].lostB++; } // фургон со свёрнутым зданием — потеря здания
    var killer = e.hitBy && W.players[1 - e.owner]; if (killer) { killer.kills++; killer.score += Math.round(val / (e.kind === 'bld' ? 4 : 10)); }
    var ku = e.hitBy && W.byId[e.hitBy]; // ветеранство: 3 победы — звание (+20% урона, подлечился)
    if (ku && ku.kind === 'unit' && ku.owner !== e.owner) { ku.kills = (ku.kills || 0) + 1; if (ku.kills >= 3 && !ku.vet) { ku.vet = 1; ku.hp = Math.min(ku.maxHp, ku.hp + ku.maxHp * 0.2); W.events.push({ t: 'vet', owner: ku.owner, id: ku.id }); } }
    W.fx.push({ t: 'boom', x: c.x, y: c.y, life: 0.7, max: 0.7, big: e.kind === 'bld' || UNITS[e.type].cls === 'veh' });
    W.events.push({ t: 'die', owner: e.owner, kind: e.kind, type: e.type, x: c.x, y: c.y, tag: e.tag || null, id: e.id, packed: e.packed ? e.packed.type : null });
  }
  function damage(W, attacker, tg) {
    var d = UNITS[attacker.type] || BLDS[attacker.type], cls = tg.kind === 'bld' ? 'bld' : UNITS[tg.type].cls;
    if (tg.tag) { var hk = attacker.owner + ':' + tg.tag; W.hits[hk] = (W.hits[hk] || 0) + 1; } // кто по кому стрелял (условие hit кампании)
    if (tg.calm && attacker.owner !== tg.owner) tg.calm = false; // по мирному выстрелили — он больше не мирный
    // договор (W.treaty): здания пулей и снарядом не берутся (только заряд подрывника), но выстрел засчитывается в hits
    if (!(W.treaty && tg.kind === 'bld')) tg.hp -= d.dmg * MULT[d.weapon][cls] * (0.9 + W.rng() * 0.2) * (attacker.bD || 1) * (attacker.vet ? 1.2 : 1);
    tg.hitT = W.time; tg.hitBy = attacker.id;
    var c = center(tg), ox = tg.kind === 'bld' ? (W.rng() - 0.5) * tg.w * 0.6 : 0, oy = tg.kind === 'bld' ? (W.rng() - 0.5) * tg.h * 0.6 : 0;
    var ac = center(attacker);
    W.fx.push({ t: d.weapon === 'gun' ? 'tracer' : 'shell', x0: ac.x, y0: ac.y, x: c.x + ox, y: c.y + oy, life: d.weapon === 'gun' ? 0.09 : 0.22, max: d.weapon === 'gun' ? 0.09 : 0.22 });
    W.events.push({ t: 'shot', owner: attacker.owner, weapon: d.weapon, x: ac.x, y: ac.y });
  }
  function turn(a, b, max) { var d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-max, Math.min(max, d)); }
  function follow(W, u, dt) {
    if (!u.path.length) return false;
    var wp = u.path[0], dx = wp.x - u.x, dy = wp.y - u.y, dl = Math.hypot(dx, dy), sp = UNITS[u.type].speed * (u.bS || 1) * (u.sm || 1) * dt;
    var last = u.path.length === 1;
    if (dl <= sp || (last && dl < 0.12)) { u.x = wp.x; u.y = wp.y; u.path.shift(); }
    else { u.x += dx / dl * sp; u.y += dy / dl * sp; }
    if (dl > 0.01) { u.heading = turn(u.heading, Math.atan2(dy, dx), dt * 7); if (UNITS[u.type].cls === 'inf' || u.type === 'hauler') u.aim = u.heading; }
    // застревание: за 1 с почти не сдвинулись — перестроить путь; рядом с целью — считать, что пришли
    u.chk.t += dt;
    if (u.chk.t >= 1) {
      var moved = Math.hypot(u.x - u.chk.x, u.y - u.chk.y); u.chk = { x: u.x, y: u.y, t: 0 };
      if (moved < 0.25 && u.path.length) {
        var end = u.path[u.path.length - 1];
        if (Math.hypot(end.x - u.x, end.y - u.y) < 1.6 || ++u.stuck > 4) { u.path = []; u.stuck = 0; return false; }
        u.path = findPath(W, u.x, u.y, end.x, end.y);
      }
    }
    return true;
  }
  function scan(W, u, radius) {
    var best = null, bd = 1e9;
    if (u.calm) return null; // мирные (сценарные) сами не стреляют, и по ним не стреляют без приказа
    for (var n = 0; n < W.units.length; n++) { var e = W.units[n]; if (e.owner === u.owner || e.hp <= 0 || e.calm) continue; var d = Math.hypot(e.x - u.x, e.y - u.y); if (d <= radius && d < bd) { bd = d; best = e; } }
    if (best || W.treaty) return best; // по договору здания сами не обстреливают
    for (n = 0; n < W.blds.length; n++) { var b = W.blds[n]; if (b.owner === u.owner) continue; var db = distTo(u, b); if (db <= radius && db < bd) { bd = db; best = b; } }
    return best;
  }
  function unitStep(W, u, dt) {
    var d = UNITS[u.type], o = u.order;
    u.cd -= dt;
    if (u.trail) trailStep(u);
    if (u.tow) { towStep(W, u, dt); return; }
    if (o.t === 'plant') { plantStep(W, u, dt); return; }
    if (o.t === 'deploy') { deployStep(W, u, dt); return; }
    if (!d.weapon && u.type !== 'hauler') { if ((o.t === 'move' || o.t === 'amove') && !follow(W, u, dt)) u.order = { t: 'idle' }; return; }
    if (u.type === 'hauler') { haulStep(W, u, dt); return; }
    if (o.t === 'attack') {
      var tg = W.byId[o.target];
      if (!alive(tg)) { u.path = []; u.order = o.then || { t: 'idle' }; if (u.order.t === 'amove') u.path = findPath(W, u.x, u.y, u.order.x, u.order.y); return; }
      if (o.leash && Math.hypot(u.x - o.leash.x, u.y - o.leash.y) > 8) { u.order = { t: 'move', x: o.leash.x, y: o.leash.y }; u.path = findPath(W, u.x, u.y, o.leash.x, o.leash.y); return; }
      var dist = distTo(u, tg), c = center(tg);
      if (dist <= d.range) {
        u.path = [];
        var want = Math.atan2(c.y - u.y, c.x - u.x); u.aim = turn(u.aim, want, dt * (d.cls === 'inf' ? 12 : 4));
        if (d.cls === 'inf') u.heading = u.aim;
        if (u.cd <= 0 && Math.abs(Math.atan2(Math.sin(want - u.aim), Math.cos(want - u.aim))) < 0.25) { u.cd = d.cd; u.fireT = W.time; damage(W, u, tg); }
      } else {
        u.repath = (u.repath || 0) - dt;
        if (!u.path.length || u.repath <= 0) { u.repath = 1; u.path = findPath(W, u.x, u.y, c.x, c.y, Math.max(2500, W.w * W.h)); }
        follow(W, u, dt); u.aim = turn(u.aim, u.heading, dt * 4);
      }
      return;
    }
    if (o.t === 'amove' || o.t === 'idle') {
      u.scanT -= dt;
      if (u.scanT <= 0) {
        u.scanT = 0.5;
        var e = scan(W, u, o.t === 'amove' ? d.sight : Math.max(d.range + 1, d.sight - 0.5));
        if (e) { u.order = { t: 'attack', target: e.id, then: o.t === 'amove' ? o : null, leash: o.t === 'idle' ? { x: u.x, y: u.y } : null }; u.path = []; u.repath = 0; return; }
      }
    }
    if (o.t === 'move' || o.t === 'amove') {
      if (!follow(W, u, dt)) { if (o.t === 'amove' && Math.hypot(o.x - u.x, o.y - u.y) > 2) u.path = findPath(W, u.x, u.y, o.x, o.y); else u.order = { t: 'idle' }; }
      if (d.cls !== 'inf') u.aim = turn(u.aim, u.heading, dt * 4);
    }
  }
  // ---------- Здания в бою: вышки стреляют, ремонт за медь ----------
  function bldStep(W, b, dt) {
    var d = BLDS[b.type];
    if (b.setup > 0) { b.setup -= dt; if (b.setup <= 0) { b.setup = 0; calcPower(W); W.events.push({ t: 'setupDone', owner: b.owner, id: b.id }); } return; }
    if (d.rate) rigStep(W, b, d, dt);
    if (d.weapon) {
      b.cd = (b.cd || 0) - dt;
      if (b.cd <= 0) {
        var c = center(b), best = null, bd = 1e9;
        for (var n = 0; n < W.units.length; n++) { var e = W.units[n]; if (e.owner === b.owner || e.hp <= 0) continue; var dd = Math.hypot(e.x - c.x, e.y - c.y) - b.w / 2; if (dd <= d.range && dd < bd) { bd = dd; best = e; } }
        if (best) { b.cd = d.cd; b.fireT = W.time; b.aim = Math.atan2(best.y - c.y, best.x - c.x); damage(W, b, best); } else b.cd = 0.25;
      }
    }
    if (b.repair) {
      var pl = W.players[b.owner], heal = b.maxHp * REPAIR * dt, price = heal * repairPrice(b.type);
      if (b.hp >= b.maxHp) { b.repair = false; W.events.push({ t: 'repaired', owner: b.owner, id: b.id }); }
      else if (pl.copper < price) { b.repair = false; W.events.push({ t: 'repairStop', owner: b.owner, id: b.id }); }
      else { pl.copper -= price; b.hp = Math.min(b.maxHp, b.hp + heal); }
    }
  }
  // Ремонт здания: on — включить/выключить; false, если нельзя (чужое, целое, нет меди)
  function setRepair(W, b, on) {
    if (!b || b.kind !== 'bld' || !alive(b)) return false;
    if (!on) { b.repair = false; return true; }
    if (b.hp >= b.maxHp || W.players[b.owner].copper < 1) return false;
    b.repair = true; return true;
  }
  // ---------- Сцепка: тягач оставляет след, вагоны едут по нему (на месте, где уже прошёл тягач — значит, проходимо) ----------
  var TOW_GAP = 1.15;
  function trailStep(u) { var t = u.trail, last = t[0]; if (!last || Math.hypot(u.x - last.x, u.y - last.y) >= 0.2) { t.unshift({ x: u.x, y: u.y }); if (t.length > 80) t.length = 80; } }
  function trailPoint(lead, dist) {
    var t = lead.trail || [], px = lead.x, py = lead.y, left = dist;
    for (var n = 0; n < t.length; n++) { var s = Math.hypot(t[n].x - px, t[n].y - py); if (s >= left) { var k = left / s; return { x: px + (t[n].x - px) * k, y: py + (t[n].y - py) * k }; } left -= s; px = t[n].x; py = t[n].y; }
    return null;
  }
  function towStep(W, u, dt) {
    var lead = W.byId[u.tow]; u.path = [];
    if (!alive(lead)) { u.tow = 0; u.order = { t: 'idle' }; return; }
    var head = lead; while (head.tow && W.byId[head.tow]) head = W.byId[head.tow]; // тягач — голова поезда
    var k = 1, x = lead; while (x !== head) { k++; x = W.byId[x.tow]; }
    var tp = trailPoint(head, k * TOW_GAP); if (!tp) return;
    var dx = tp.x - u.x, dy = tp.y - u.y, dl = Math.hypot(dx, dy); if (dl < 0.02) return;
    var sp = Math.min(dl, UNITS[u.type].speed * (u.sm || 1) * dt * (dl > 0.6 ? 1.5 : 1));
    u.x += dx / dl * sp; u.y += dy / dl * sp; u.heading = u.aim = turn(u.heading, Math.atan2(dy, dx), dt * 8);
  }
  // Путь стал непроходим (изменилась карта) — перестроить до той же конечной точки. Возвращает число перестроенных.
  function repathBlocked(W) {
    var n = 0;
    W.units.forEach(function (u) {
      if (!u.path || !u.path.length) return;
      var prev = { x: u.x, y: u.y }, bad = false;
      for (var k = 0; k < u.path.length && !bad; k++) { var q = u.path[k], L2 = Math.hypot(q.x - prev.x, q.y - prev.y), m = Math.ceil(L2 * 3); for (var s = 0; s <= m; s++) { var x = prev.x + (q.x - prev.x) * s / Math.max(1, m), y = prev.y + (q.y - prev.y) * s / Math.max(1, m); if (!walkable(W.t[Math.floor(y) * W.w + Math.floor(x)])) { bad = true; break; } } prev = q; }
      if (bad) { var end = u.path[u.path.length - 1]; u.path = findPath(W, u.x, u.y, end.x, end.y); u.repath = 1; n++; }
    });
    return n;
  }
  function oreAt(W, i, j) { return inb(W, i, j) ? W.ore[j * W.w + i] : 0; }
  function reserved(W, u, i, j) { for (var n = 0; n < W.units.length; n++) { var h = W.units[n]; if (h !== u && h.type === 'hauler' && h.order.t === 'harvest' && (h.order.s === 'go' || h.order.s === 'dig') && h.order.tx === i && h.order.ty === j) return true; } return false; }
  function findOre(W, u, px, py) {
    var best = null, bd = 1e9, i, j;
    if (px != null) { // сначала — поле, указанное игроком
      for (j = py - 5; j <= py + 5; j++) for (i = px - 5; i <= px + 5; i++) {
        if (oreAt(W, i, j) <= 0 || reserved(W, u, i, j)) continue;
        var d = Math.hypot(i - px, j - py) + Math.hypot(i + 0.5 - u.x, j + 0.5 - u.y) * 0.15; if (d < bd) { bd = d; best = { i: i, j: j }; }
      }
      if (best) return best;
    }
    // иначе — BFS от рудовоза: ближайший достижимый свободный самородок
    var si = Math.floor(u.x), sj = Math.floor(u.y), seen = new Uint8Array(W.w * W.h), q = [sj * W.w + si], fallback = null; seen[q[0]] = 1;
    for (var h = 0; h < q.length && h < 3500; h++) {
      var k = q[h]; i = k % W.w; j = (k / W.w) | 0;
      if (W.ore[k] > 0) { if (!reserved(W, u, i, j)) return { i: i, j: j }; if (!fallback) fallback = { i: i, j: j }; }
      for (var dd = 0; dd < 8; dd++) { var a = i + DX[dd], b = j + DY[dd], n = b * W.w + a; if (inb(W, a, b) && !seen[n] && passable(W, a, b)) { seen[n] = 1; q.push(n); } }
    }
    return fallback;
  }
  function nearestBld(W, o, type, x, y, prefer) {
    if (prefer && alive(W.byId[prefer])) return W.byId[prefer];
    var best = null, bd = 1e9; W.blds.forEach(function (b) { if (b.owner === o && b.type === type) { var d = Math.hypot(b.tx + b.w / 2 - x, b.ty + b.h / 2 - y); if (d < bd) { bd = d; best = b; } } });
    return best;
  }
  function haulStep(W, u, dt) {
    var o = u.order, cap = W.haulCap || UNITS.hauler.cap; // W.haulCap — груз рудовоза в миссии (гонка: меньше за ходку)
    if (o.t === 'move') { if (!follow(W, u, dt)) u.order = { t: 'idle' }; return; }
    if (o.t !== 'harvest') return;
    if (o.s === 'seek') {
      if (u.carry >= cap) { o.s = 'return'; return; }
      var t = findOre(W, u, o.px, o.py);
      if (!t) { if (u.carry > 0) o.s = 'return'; else u.order = { t: 'idle' }; return; }
      o.tx = t.i; o.ty = t.j; o.s = 'go'; u.path = findPath(W, u.x, u.y, t.i + 0.5, t.j + 0.5); o.fails = 0; return;
    }
    if (o.s === 'go') {
      if (oreAt(W, o.tx, o.ty) <= 0) { o.s = 'seek'; return; }
      if (!follow(W, u, dt)) {
        if (Math.hypot(o.tx + 0.5 - u.x, o.ty + 0.5 - u.y) < 0.75) { o.s = 'dig'; o.dt = 0; }
        else if (++o.fails > 3) { o.px = null; o.s = 'seek'; } else u.path = findPath(W, u.x, u.y, o.tx + 0.5, o.ty + 0.5);
      }
      return;
    }
    if (o.s === 'dig') {
      o.dt += dt; u.aim += dt * 3;
      if (o.dt >= 0.4) {
        o.dt = 0; var k = o.ty * W.w + o.tx, take = Math.min(20, W.ore[k], cap - u.carry);
        W.ore[k] -= take; u.carry += take; o.px = o.tx; o.py = o.ty;
        if (u.carry >= cap) o.s = 'return'; else if (W.ore[k] <= 0) o.s = 'seek';
      }
      return;
    }
    if (o.s === 'return') {
      var s = nearestBld(W, u.owner, 'smelter', u.x, u.y, o.prefer);
      if (!s) { u.order = { t: 'idle' }; return; }
      var dk = dockOf(W, s); o.sid = s.id; o.dk = dk; o.s = 'toDock'; o.fails = 0; u.path = findPath(W, u.x, u.y, dk.i + 0.5, dk.j + 0.5); return;
    }
    if (o.s === 'toDock') {
      if (!alive(W.byId[o.sid])) { o.prefer = null; o.s = 'return'; return; }
      if (!follow(W, u, dt)) {
        if (Math.hypot(o.dk.i + 0.5 - u.x, o.dk.j + 0.5 - u.y) < 1.1) { o.s = 'unload'; o.dt = 0; }
        else if (++o.fails > 4) { o.s = 'unload'; o.dt = 0; } else u.path = findPath(W, u.x, u.y, o.dk.i + 0.5, o.dk.j + 0.5);
      }
      return;
    }
    if (o.s === 'unload') {
      o.dt += dt;
      if (o.dt >= 1.2) {
        var pl = W.players[u.owner]; pl.copper += u.carry; pl.mined += u.carry;
        if (u.carry) W.events.push({ t: 'copper', owner: u.owner, n: u.carry, x: u.x, y: u.y });
        u.carry = 0; o.s = 'seek'; o.prefer = null;
      }
    }
  }
  // Расталкивание: пары ближе суммы радиусов разводим (стоящий уступает идущему), но не в скалу/здание.
  function separate(W, dt) {
    var cell = Object.create(null), us = W.units;
    for (var n = 0; n < us.length; n++) { var u = us[n], key = (Math.floor(u.x) >> 1) + ',' + (Math.floor(u.y) >> 1); (cell[key] || (cell[key] = [])).push(u); }
    for (n = 0; n < us.length; n++) {
      var a = us[n], cx = Math.floor(a.x) >> 1, cy = Math.floor(a.y) >> 1;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var list = cell[(cx + ox) + ',' + (cy + oy)]; if (!list) continue;
        for (var m = 0; m < list.length; m++) {
          var b = list[m]; if (b.id <= a.id) continue;
          var dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy), need = (UNITS[a.type].r + UNITS[b.type].r) * 0.85;
          if (dl >= need) continue;
          if (dl < 1e-4) { dx = Math.cos(a.id); dy = Math.sin(a.id); dl = 1; }
          var push = Math.min(need - dl, 1.5 * dt + (need - dl) * 0.3), am = a.path.length ? 0.3 : 0.7, bm = b.path.length ? 0.3 : 0.7, s = am + bm;
          shove(W, a, -dx / dl * push * am / s, -dy / dl * push * am / s);
          shove(W, b, dx / dl * push * bm / s, dy / dl * push * bm / s);
        }
      }
    }
  }
  function shove(W, u, dx, dy) {
    if (passable(W, Math.floor(u.x + dx), Math.floor(u.y))) u.x += dx;
    if (passable(W, Math.floor(u.x), Math.floor(u.y + dy))) u.y += dy;
  }

  // ---------- Туман войны (для игрока 0): 0 — не открыто, 1 — видели, 2 — видно сейчас ----------
  function updateVis(W) {
    var v = W.vis, n;
    for (n = 0; n < v.length; n++) if (v[n] === 2) v[n] = 1;
    function mark(x, y, r) {
      var r2 = r * r;
      for (var j = Math.floor(y - r); j <= Math.ceil(y + r); j++) for (var i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
        if (!inb(W, i, j)) continue; var dx = i + 0.5 - x, dy = j + 0.5 - y; if (dx * dx + dy * dy <= r2) v[j * W.w + i] = 2;
      }
    }
    var sm = W.sightMul == null ? 1 : W.sightMul; // погода/ночь кампании урезают обзор
    W.units.forEach(function (u) { if (u.owner === 0) mark(u.x, u.y, Math.max(1.5, UNITS[u.type].sight * sm)); });
    W.blds.forEach(function (b) { if (b.owner === 0) mark(b.tx + b.w / 2, b.ty + b.h / 2, Math.max(2, BLDS[b.type].sight * sm) + Math.max(b.w, b.h) / 2); });
    (W.flares || []).forEach(function (f) { mark(f.x, f.y, f.r); });
    // шумные здания соперника (буровые вышки) слышно сквозь туман — видна сама вышка
    W.blds.forEach(function (b) { if (b.owner !== 0 && BLDS[b.type].loud) for (var j = 0; j < b.h; j++) for (var i = 0; i < b.w; i++) v[(b.ty + j) * W.w + b.tx + i] = 2; });
  }
  function visibleTo0(W, e) {
    if (e.owner === 0) return true;
    if (e.kind === 'unit') { var i = Math.floor(e.x), j = Math.floor(e.y); return inb(W, i, j) && W.vis[j * W.w + i] === 2; }
    for (var j2 = 0; j2 < e.h; j2++) for (var i2 = 0; i2 < e.w; i2++) if (W.vis[(e.ty + j2) * W.w + e.tx + i2]) return true;
    return false;
  }

  // ---------- Герои: ауры, способности, метки ----------
  // u.bD / u.bS — множители урона и скорости на этот шаг (аура Варвары); u.abT — перезарядка, u.abOn — способность действует.
  function heroStep(W, dt) {
    var us = W.units, n, m;
    for (n = 0; n < us.length; n++) { us[n].bD = 1; us[n].bS = 1; }
    for (n = 0; n < us.length; n++) {
      var h = us[n], hd = HEROES[h.type]; if (!hd || h.hp <= 0) continue;
      if (h.abT > 0) h.abT = Math.max(0, h.abT - dt);
      if (h.abOn > 0) h.abOn = Math.max(0, h.abOn - dt);
      if (hd.aura) {
        var on = h.abOn > 0, R = hd.aura * (on ? 1.6 : 1), bd = on ? hd.cryDmg : hd.dmg, bs = on ? hd.crySpd : hd.spd;
        for (m = 0; m < us.length; m++) { var a = us[m]; if (a.owner !== h.owner || a === h || UNITS[a.type].cls !== 'inf' && !on) continue;
          if (Math.hypot(a.x - h.x, a.y - h.y) <= R) { a.bD = Math.max(a.bD, bd); a.bS = Math.max(a.bS, bs); } }
        if (on) { h.bD = Math.max(h.bD, hd.dmg); }
      }
      if (hd.ability === 'fix') fixStep(W, h, hd, dt);
    }
    var fl = W.flares; if (fl) for (n = fl.length - 1; n >= 0; n--) { fl[n].t -= dt; if (fl[n].t <= 0) fl.splice(n, 1); }
  }
  // Сава: на месте (без пути) чинит самую побитую свою технику/здание в радиусе field; «Аврал» — всё вокруг быстро.
  function fixable(W, h, e, r) { if (e.owner !== h.owner || e.hp <= 0 || e.hp >= e.maxHp) return false; if (e.kind === 'unit' && UNITS[e.type].cls !== 'veh') return false; var c = center(e), dd = e.kind === 'bld' ? distTo(h, e) : Math.hypot(c.x - h.x, c.y - h.y); return dd <= r; }
  function fixStep(W, h, hd, dt) {
    var list = W.units.concat(W.blds), n;
    if (h.abOn > 0) { for (n = 0; n < list.length; n++) if (fixable(W, h, list[n], hd.r)) { list[n].hp = Math.min(list[n].maxHp, list[n].hp + hd.rate * dt); list[n].fixT = W.time; } return; }
    if (h.path.length || h.order.t === 'attack') return;
    var best = null, bf = 2;
    for (n = 0; n < list.length; n++) { var e = list[n]; if (!fixable(W, h, e, hd.field)) continue; var f = e.hp / e.maxHp; if (f < bf) { bf = f; best = e; } }
    if (best) { best.hp = Math.min(best.maxHp, best.hp + hd.fieldRate * dt); best.fixT = W.time; h.fixing = best.id; } else h.fixing = 0;
  }
  // Активная способность героя: 'ok' | 'cd' (перезарядка) | 'far' (метка слишком далеко) | null (не герой/мёртв).
  function ability(W, u, x, y) {
    var hd = u && HEROES[u.type]; if (!hd || !alive(u)) return null;
    if (u.abT > 0) return 'cd';
    if (hd.ability === 'fix') { u.abOn = hd.dur; u.abT = hd.cd; W.events.push({ t: 'ability', owner: u.owner, id: u.id, kind: 'fix', x: u.x, y: u.y }); return 'ok'; }
    if (hd.ability === 'cry') { u.abOn = hd.dur; u.abT = hd.cd; W.events.push({ t: 'ability', owner: u.owner, id: u.id, kind: 'cry', x: u.x, y: u.y }); return 'ok'; }
    if (hd.ability === 'flare') {
      if (x == null || Math.hypot(x - u.x, y - u.y) > hd.reach) return 'far';
      W.flares.push({ x: x, y: y, r: hd.r, t: hd.dur, max: hd.dur, owner: u.owner }); u.abT = hd.cd; W.visT = 0;
      W.events.push({ t: 'ability', owner: u.owner, id: u.id, kind: 'flare', x: x, y: y }); return 'ok';
    }
    return null;
  }

  // ---------- Буровая вышка: качает медь из жилы под собой и вокруг (без рудовоза) ----------
  function rigCells(W, b) { var out = []; for (var j = b.ty - 1; j <= b.ty + b.h; j++) for (var i = b.tx - 1; i <= b.tx + b.w; i++) if (inb(W, i, j)) out.push(j * W.w + i); return out; }
  function rigOre(W, b) { var s = 0; rigCells(W, b).forEach(function (k) { s += W.ore[k]; }); return s; }
  function rigStep(W, b, d, dt) {
    b.pumpT = (b.pumpT || 0) + dt; if (b.pumpT < 1) return; b.pumpT -= 1;
    var need = W.rigRate || d.rate, got = 0, cells = rigCells(W, b).filter(function (k) { return W.ore[k] > 0; }).sort(function (a, c) { return W.ore[c] - W.ore[a]; });
    for (var n = 0; n < cells.length && got < need; n++) { var take = Math.min(need - got, W.ore[cells[n]]); W.ore[cells[n]] -= take; got += take; }
    if (got > 0) { var pl = W.players[b.owner]; pl.copper += got; pl.mined += got; b.dry = false; b.pumped = (b.pumped || 0) + got; }
    else if (!b.dry) { b.dry = true; W.events.push({ t: 'dry', owner: b.owner, id: b.id }); }
  }

  // ---------- Заряды подрывников ----------
  // Подрывник подходит к цели вплотную, CHARGE.plant секунд закладывает заряд; заряд тикает CHARGE.timer секунд и бьёт цель
  // (CHARGE.dmg) и всё рядом. Свои юниты цели, простоявшие у заряда CHARGE.defuse секунд, его обезвреживают.
  function plantStep(W, u, dt) {
    var o = u.order, tg = W.byId[o.target];
    if (!alive(tg) || !canPlantOn(W, tg)) { u.path = []; u.order = { t: 'idle' }; return; }
    var dist = distTo(u, tg);
    if (dist <= 0.9) {
      u.path = []; o.p += dt; u.aim = u.heading = turn(u.heading, Math.atan2(center(tg).y - u.y, center(tg).x - u.x), dt * 8);
      if (o.p >= CHARGE.plant) {
        var c = center(tg); W.charges.push({ id: W.nextId++, by: u.id, owner: u.owner, target: tg.id, x: c.x, y: c.y, t: CHARGE.timer, max: CHARGE.timer, def: 0 });
        W.events.push({ t: 'planted', owner: u.owner, victim: tg.owner, type: tg.type, x: c.x, y: c.y }); u.order = { t: 'idle' };
      }
      return;
    }
    o.p = 0; u.repath = (u.repath || 0) - dt;
    if (!u.path.length || u.repath <= 0) { var cc = center(tg); u.repath = 1; u.path = findPath(W, u.x, u.y, cc.x, cc.y, Math.max(2500, W.w * W.h)); }
    follow(W, u, dt);
  }
  function chargeStep(W, dt) {
    for (var n = W.charges.length - 1; n >= 0; n--) {
      var ch = W.charges[n], tg = W.byId[ch.target];
      if (!alive(tg)) { W.charges.splice(n, 1); continue; }
      var c = center(tg); ch.x = c.x; ch.y = c.y;
      var near = W.units.some(function (e) { return e.owner === tg.owner && e.hp > 0 && e !== tg && !UNITS[e.type].sapper && Math.hypot(e.x - ch.x, e.y - ch.y) <= CHARGE.defR + (tg.kind === 'bld' ? tg.w / 2 : 0); });
      if (near) { ch.def += dt; if (ch.def >= CHARGE.defuse) { W.charges.splice(n, 1); W.events.push({ t: 'defused', owner: tg.owner, x: ch.x, y: ch.y, type: tg.type }); continue; } }
      else ch.def = Math.max(0, ch.def - dt * 0.5);
      ch.t -= dt;
      if (ch.t <= 0) {
        W.charges.splice(n, 1);
        var by = W.byId[ch.by]; tg.hp -= CHARGE.dmg; if (by) tg.hitBy = by.id; tg.hitT = W.time;
        W.units.forEach(function (e) { if (e !== tg && Math.hypot(e.x - ch.x, e.y - ch.y) <= CHARGE.splash) { e.hp -= CHARGE.splashDmg; e.hitT = W.time; } });
        W.fx.push({ t: 'boom', x: ch.x, y: ch.y, life: 0.9, max: 0.9, big: true });
        W.events.push({ t: 'blast', owner: ch.owner, victim: tg.owner, type: tg.type, x: ch.x, y: ch.y, kill: tg.hp <= 0 });
      }
    }
  }

  // ---------- Перенос зданий: свернуть в фургон → перевезти → развернуть ----------
  // Свёрнутое здание — юнит 'van' (бур — для буровой вышки) с u.packed = { type, frac }: здание не работает (нет пара,
  // производства, добычи), фургон можно подорвать или разбить — это потеря здания. Развернуть можно на свободной твёрдой земле
  // (не зыбкой) в любом месте — правило «4 клетки от базы» не действует; вышке нужна богатая жила.
  function canPack(W, b) { return !!b && b.kind === 'bld' && alive(b) && !NO_PACK[b.type] && (b.type === 'rig' || !!W.packOn) && !(b.setup > 0); }
  function pack(W, b) {
    if (!canPack(W, b)) return null;
    var c = center(b), frac = b.hp / b.maxHp;
    for (var j = 0; j < b.h; j++) for (var i = 0; i < b.w; i++) { var k = (b.ty + j) * W.w + b.tx + i; if (W.occ[k] === b.id) W.occ[k] = 0; }
    W.blds = W.blds.filter(function (x) { return x !== b; }); delete W.byId[b.id]; calcPower(W);
    W.charges = W.charges.filter(function (ch) { return ch.target !== b.id; });
    var sp = nearestPassable(W, Math.floor(c.x), Math.floor(c.y), 6) || { i: Math.floor(c.x), j: Math.floor(c.y) };
    var u = addUnit(W, b.owner, b.type === 'rig' ? 'drill' : 'van', sp.i + 0.5, sp.j + 0.5);
    u.hp = Math.max(1, Math.round(u.maxHp * Math.max(0.25, frac))); u.packed = { type: b.type, frac: frac, hp0: u.hp }; if (b.tag) u.tag = b.tag;
    if (b.rally) u.packed.rally = b.rally;
    W.events.push({ t: 'packed', owner: b.owner, id: u.id, type: b.type });
    return u;
  }
  function packedType(u) { return u && u.kind === 'unit' ? (u.packed ? u.packed.type : UNITS[u.type].packs || null) : null; }
  // можно ли развернуть здание type с левым верхним углом (tx,ty): клетки — твёрдая земля, свободно; вышке — нужна жила
  function canDeploy(W, o, type, tx, ty) {
    var d = BLDS[type]; if (!d) return false;
    if (tx < 1 || ty < 1 || tx + d.w > W.w - 1 || ty + d.h > W.h - 1) return false;
    var oreIn = 0;
    for (var j = 0; j < d.h; j++) for (var i = 0; i < d.w; i++) { var k = (ty + j) * W.w + tx + i; if (W.t[k] !== GROUND || W.occ[k]) return false; if (W.ore[k]) { if (!d.rate) return false; oreIn++; } }
    if (d.rate) { if (!oreIn) return false; var s = 0; for (j = ty - 1; j <= ty + d.h; j++) for (i = tx - 1; i <= tx + d.w; i++) if (inb(W, i, j)) s += W.ore[j * W.w + i]; if (s < RICH) return false; }
    return true;
  }
  var RICH = 900; // богатая жила: столько меди под вышкой и вокруг
  function commandDeploy(W, id, tx, ty) {
    var u = W.byId[id], type = packedType(u); if (!alive(u) || !type) return false;
    var d = BLDS[type]; u.order = { t: 'deploy', tx: tx, ty: ty, type: type, fails: 0 }; u.path = findPath(W, u.x, u.y, tx + d.w / 2, ty + d.h / 2); u.stuck = 0; u.chk = { x: u.x, y: u.y, t: 0 };
    return true;
  }
  function deployStep(W, u, dt) {
    var o = u.order, d = BLDS[o.type], cx = o.tx + d.w / 2, cy = o.ty + d.h / 2, dist = Math.hypot(cx - u.x, cy - u.y);
    if (dist > 0.9 && follow(W, u, dt)) return;
    if (dist > Math.max(d.w, d.h) * 0.75 + 0.6) { if (++o.fails > 3) { u.order = { t: 'idle' }; W.events.push({ t: 'deployFail', owner: u.owner, id: u.id }); } else u.path = findPath(W, u.x, u.y, cx, cy); return; }
    deployNow(W, u, o.tx, o.ty);
  }
  function deployNow(W, u, tx, ty) {
    var type = packedType(u); if (!type || !canDeploy(W, u.owner, type, tx, ty)) { u.order = { t: 'idle' }; u.path = []; W.events.push({ t: 'deployFail', owner: u.owner, id: u.id }); return null; }
    W.units = W.units.filter(function (x) { return x !== u; }); delete W.byId[u.id];
    var b = addBuilding(W, u.owner, type, tx, ty, true), frac = u.packed ? u.packed.frac : 1, hp0 = u.packed ? u.packed.hp0 : u.maxHp;
    b.hp = Math.max(1, Math.round(b.maxHp * frac * Math.min(1, u.hp / hp0))); // побитый в пути фургон — побитое здание
    if (u.tag) b.tag = u.tag; if (u.packed && u.packed.rally) b.rally = u.packed.rally;
    b.setup = SETUP; calcPower(W);
    // кто стоял на месте разворота — выходит на ближайшую свободную клетку
    W.units.forEach(function (e) { if (e.x > tx && e.x < tx + b.w && e.y > ty && e.y < ty + b.h) { var np = nearestPassable(W, Math.floor(e.x), Math.floor(e.y), 6); if (np) { e.x = np.i + 0.5; e.y = np.j + 0.5; e.path = []; } } });
    W.events.push({ t: 'deployed', owner: b.owner, id: b.id, type: type });
    return b;
  }

  // ---------- ИИ гонки за жилой (кампания): добыча и диверсии вместо штурма ----------
  // Держит рудовозы, ставит буры на богатые жилы (spots), охраняет вышки (стрелки рядом, обезвреживают заряды),
  // каждые every секунд шлёт подрывников с охраной под вышку или рудовоз соперника. Контору соперника не трогает (договор).
  function newRaceAI(W, o, opt) {
    opt = opt || {};
    return { race: true, o: o, t: 0, think: opt.think || 1, spots: (opt.spots || []).slice(), haulers: opt.haulers == null ? 2 : opt.haulers, rigs: opt.rigs == null ? 2 : opt.rigs,
      sappers: opt.sappers == null ? 2 : opt.sappers, escort: opt.escort == null ? 2 : opt.escort, guards: opt.guards == null ? 3 : opt.guards,
      nextRaid: opt.first == null ? 150 : opt.first, every: opt.every || 110, raids: 0, reserve: opt.reserve || 0 };
  }
  function raceStep(W, dt) {
    var A = W.ai, o = A.o, p = W.players[o], foe = 1 - o;
    A.t -= dt; if (A.t > 0) return; A.t = A.think;
    var hq = has(W, o, 'hq'); if (!hq) return;
    var mine = W.units.filter(function (u) { return u.owner === o; }), hc = center(hq);
    var cnt = function (t) { return mine.filter(function (u) { return u.type === t; }).length + p.inf.concat(p.veh).filter(function (x) { return x === t; }).length; };
    var rigs = W.blds.filter(function (b) { return b.owner === o && b.type === 'rig'; });
    // 1) экономика: рудовозы, буры (пока есть свободная жила)
    if (working(W, o, 'works') && has(W, o, 'smelter') && cnt('hauler') < A.haulers && p.copper >= UNITS.hauler.cost) queueUnit(W, o, 'hauler');
    var free = A.spots.filter(function (s) { return !spotTaken(W, s); });
    if (working(W, o, 'works') && rigs.length + cnt('drill') < A.rigs && free.length && p.copper >= UNITS.drill.cost) queueUnit(W, o, 'drill');
    mine.forEach(function (u) {
      if (u.type !== 'drill' || u.order.t !== 'idle') return;
      var best = null, bd = 1e9; free.forEach(function (s) { var dd = Math.hypot(s.x - u.x, s.y - u.y); if (dd < bd && !mine.some(function (m) { return m !== u && m.order.t === 'deploy' && Math.hypot(m.order.tx - s.x, m.order.ty - s.y) < 4; })) { bd = dd; best = s; } });
      var at = best && deploySpot(W, o, 'rig', best.x, best.y); if (at) commandDeploy(W, u.id, at.i, at.j);
    });
    rigs.forEach(function (b) { if (b.dry && A.spots.some(function (s) { return !spotTaken(W, s); })) pack(W, b); }); // жила выработана — переезд
    // 2) люди: подрывники и стрелки (охрана вышек + сопровождение)
    if (working(W, o, 'bunk') && p.inf.length < 1) {
      if (cnt('sapper') < A.sappers && p.copper >= UNITS.sapper.cost + A.reserve) queueUnit(W, o, 'sapper');
      else if (cnt('rifleman') < A.guards + A.escort && p.copper >= UNITS.rifleman.cost + A.reserve) queueUnit(W, o, 'rifleman');
    }
    var armed = mine.filter(function (u) { return !!UNITS[u.type].weapon && !u.locked; });
    // 3) заряды под нашими — ближайших свободных бойцов туда (обезвредить)
    W.charges.forEach(function (ch) {
      var tg = W.byId[ch.target]; if (!tg || tg.owner !== o) return;
      var near = armed.filter(function (u) { return !u.raid && !(u.order.t === 'move' && Math.hypot(u.order.x - ch.x, u.order.y - ch.y) < 1.6); }).sort(function (a, b) { return Math.hypot(a.x - ch.x, a.y - ch.y) - Math.hypot(b.x - ch.x, b.y - ch.y); }).slice(0, 2);
      var help = armed.filter(function (u) { return Math.hypot(u.x - ch.x, u.y - ch.y) < 1.4 || (u.order.t === 'move' && Math.hypot(u.order.x - ch.x, u.order.y - ch.y) < 1.6); }).length;
      if (help < 2 && near.length) commandMove(W, near.slice(0, 2 - help).map(function (u) { return u.id; }), ch.x, ch.y);
    });
    // 4) набег: подрывники + сопровождение под вышку (её слышно) или рудовоз соперника
    if (W.time >= A.nextRaid) {
      var saps = mine.filter(function (u) { return u.type === 'sapper' && !u.raid && u.order.t === 'idle'; });
      var tgt = raidTarget(W, o, hc);
      if (saps.length >= Math.min(A.sappers, 2) && tgt) {
        saps.forEach(function (u) { u.raid = true; }); commandPlant(W, saps.map(function (u) { return u.id; }), tgt.id);
        var esc = armed.filter(function (u) { return !u.raid && u.order.t !== 'attack'; }).slice(0, A.escort); esc.forEach(function (u) { u.raid = true; });
        var tc = center(tgt); if (esc.length) commandMove(W, esc.map(function (u) { return u.id; }), tc.x, tc.y, true);
        A.raids++; A.nextRaid = W.time + A.every; W.events.push({ t: 'raid', owner: o, n: saps.length + esc.length, x: tc.x, y: tc.y });
      } else A.nextRaid = W.time + 8;
    }
    // 5) вернувшиеся из набега — домой; охрана — у своих вышек (или у Конторы)
    mine.forEach(function (u) {
      if (u.order.t !== 'idle' || u.type === 'hauler' || u.type === 'drill' || u.locked) return;
      if (u.raid) { if (Math.hypot(u.x - hc.x, u.y - hc.y) < 6) u.raid = false; else { commandMove(W, [u.id], hc.x + 2, hc.y + 3, !!UNITS[u.type].weapon); } return; }
      if (!UNITS[u.type].weapon) return;
      var post = rigs.length ? center(rigs[u.id % rigs.length]) : hc;
      if (Math.hypot(u.x - post.x, u.y - post.y) > 3.5) commandMove(W, [u.id], post.x + ((u.id % 3) - 1) * 1.5, post.y + 2, true);
    });
  }
  function spotTaken(W, s) { return W.blds.some(function (b) { return b.type === 'rig' && Math.hypot(b.tx + 1 - s.x, b.ty + 1 - s.y) < 3.5; }) || !deploySpot(W, 0, 'rig', s.x, s.y); }
  // ближайшее к (x,y) место, где можно развернуть здание (левый верхний угол)
  function deploySpot(W, o, type, x, y, r) {
    var d = BLDS[type], cx = Math.round(x - d.w / 2), cy = Math.round(y - d.h / 2);
    for (var rr = 0; rr <= (r || 3); rr++) for (var j = cy - rr; j <= cy + rr; j++) for (var i = cx - rr; i <= cx + rr; i++) {
      if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== rr) continue;
      if (canDeploy(W, o, type, i, j)) return { i: i, j: j };
    }
    return null;
  }
  function raidTarget(W, o, from) {
    var best = null, bd = 1e9;
    W.blds.forEach(function (b) { if (b.owner !== o && b.type === 'rig' && canPlantOn(W, b)) { var c = center(b), d = Math.hypot(c.x - from.x, c.y - from.y); if (d < bd) { bd = d; best = b; } } });
    if (best) return best;
    W.units.forEach(function (u) { if (u.owner !== o && (u.type === 'hauler' || u.type === 'drill' || u.type === 'van') && canPlantOn(W, u)) { var d = Math.hypot(u.x - from.x, u.y - from.y); if (d < bd) { bd = d; best = u; } } });
    return best;
  }

  // ---------- ИИ соседней артели ----------
  function newAI(W, o) {
    return { o: o, t: 0, order: ['boiler', 'bunk', 'smelter', 'boiler', 'works', 'boiler', 'bunk', 'boiler'], idx: 0,
      nextWave: 270, waveSize: 4, waves: 0, flip: 0, lastDef: -99 };
  }
  function aiStep(W, dt, AI) {
    var A = AI || W.ai, o = A.o, p = W.players[o];
    A.t -= dt; if (A.t > 0) return; A.t = 1;
    var hq = has(W, o, 'hq'); if (!hq) return;
    // стройка: по списку, потом котельные при нехватке пара
    if (!p.build) {
      var want = A.idx < A.order.length ? A.order[A.idx] : (p.pUse + 10 > p.pOut ? 'boiler' : null);
      if (want && reqMet(W, o, want) && p.copper >= BLDS[want].cost + (A.idx > 2 ? 150 : 0) && startBuild(W, o, want)) { if (A.idx < A.order.length) A.idx++; }
    } else if (p.build.ready) {
      var spot = aiSpot(W, o, p.build.type, hq);
      if (spot) placeBuild(W, o, spot.i, spot.j); else cancelBuild(W, o);
    }
    // рудовозы: держим два
    var haulers = W.units.filter(function (u) { return u.owner === o && u.type === 'hauler'; }).length;
    var smelter = has(W, o, 'smelter'), works = has(W, o, 'works');
    if (smelter && works && haulers + p.veh.filter(function (t) { return t === 'hauler'; }).length < 2) queueUnit(W, o, 'hauler');
    // армия (оставляем запас меди на стройку)
    var reserve = A.idx < A.order.length ? BLDS[A.order[A.idx]].cost : 0;
    var armyN = W.units.filter(function (u) { return u.owner === o && u.type !== 'hauler' && !u.wave; }).length, cap = A.waveSize + 4;
    var rifles = W.units.filter(function (u) { return u.owner === o && u.type === 'rifleman' && !u.wave; }).length;
    if (has(W, o, 'bunk') && p.inf.length < 1 && armyN < cap && (!works || rifles < 4) && p.copper >= 100 + reserve) queueUnit(W, o, 'rifleman');
    if (works && p.veh.length < 2 && armyN < cap) { var vt = (A.flip++ % 3 === 2) ? 'ironwagon' : 'crawler'; if (p.copper >= UNITS[vt].cost + reserve) queueUnit(W, o, vt); }
    var army = W.units.filter(function (u) { return u.owner === o && u.type !== 'hauler'; });
    // оборона: кого-то бьют у базы — все свободные туда
    var hit = null; W.blds.concat(W.units).forEach(function (e) { if (e.owner === o && W.time - e.hitT < 2 && alive(W.byId[e.hitBy])) hit = W.byId[e.hitBy]; });
    if (hit && Math.hypot(center(hit).x - hq.tx, center(hit).y - hq.ty) < 18) {
      var free = army.filter(function (u) { return u.order.t !== 'attack' && !u.wave; }).map(function (u) { return u.id; });
      if (free.length) commandAttack(W, free, hit.id);
    }
    // волны атаки
    var idle = army.filter(function (u) { return !u.wave && u.order.t !== 'attack'; });
    if (W.time >= A.nextWave && idle.length >= A.waveSize) {
      var tgt = has(W, 1 - o, 'hq') || W.blds.filter(function (b) { return b.owner !== o; })[0];
      if (tgt) { idle.forEach(function (u) { u.wave = true; }); commandMove(W, idle.map(function (u) { return u.id; }), tgt.tx + 1, tgt.ty + 1, true); }
      A.waves++; A.nextWave = W.time + 150; A.waveSize = Math.min(14, A.waveSize + 2);
      W.events.push({ t: 'wave', owner: o, n: idle.length });
    }
    // ушедшие в волну, оставшиеся без дела, — добивают ближайшее
    army.forEach(function (u) { if (u.wave && u.order.t === 'idle') { var tg = has(W, 1 - o, 'hq'); if (tg) commandMove(W, [u.id], tg.tx + 1, tg.ty + 1, true); } });
  }
  function aiSpot(W, o, type, hq) {
    var d = BLDS[type], cx = hq.tx + 1, cy = hq.ty + 1;
    for (var r = 3; r < 14; r++) for (var a = 0; a < 24; a++) {
      var ang = a / 24 * Math.PI * 2 + r, i = Math.round(cx + Math.cos(ang) * r - d.w / 2), j = Math.round(cy + Math.sin(ang) * r - d.h / 2);
      if (!canPlace(W, o, type, i, j)) continue;
      // не замуровываемся: вокруг нового здания кольцо свободной земли
      var ok = true;
      for (var y = j - 1; y <= j + d.h && ok; y++) for (var x = i - 1; x <= i + d.w; x++) { if (!inb(W, x, y)) { ok = false; break; } if (W.occ[y * W.w + x]) { ok = false; break; } }
      if (ok) return { i: i, j: j };
    }
    return null;
  }

  P.logic = {
    UNITS: UNITS, BLDS: BLDS, HEROES: HEROES, BUILD_LIST: BUILD_LIST, FORT_LIST: FORT_LIST, REPAIR: REPAIR, repairPrice: repairPrice, setRepair: setRepair, repathBlocked: repathBlocked, trailPoint: trailPoint, UNIT_LIST: UNIT_LIST, GROUND: GROUND, ROCK: ROCK, WATER: WATER, ICE: ICE, OPEN: OPEN, BRIDGE: BRIDGE, MAP_W: MAP_W, MAP_H: MAP_H,
    walkable: walkable, ability: ability, aiSpot: aiSpot, alive: alive, inb: inb,
    mulberry32: mulberry32, newWorld: newWorld, worldFromMap: worldFromMap, emptyWorld: emptyWorld,
    passable: passable, findPath: findPath, nearestPassable: nearestPassable,
    addBuilding: addBuilding, addUnit: addUnit, calcPower: calcPower, powerFactor: powerFactor, has: has, count: count, reqMet: reqMet, dockOf: dockOf, center: center,
    startBuild: startBuild, cancelBuild: cancelBuild, queueUnit: queueUnit, dequeueUnit: dequeueUnit, canPlace: canPlace, placeBuild: placeBuild,
    commandMove: commandMove, commandAttack: commandAttack, commandHarvest: commandHarvest, commandReturn: commandReturn, commandSmart: commandSmart, smartKind: smartKind, stopUnits: stopUnits,
    pickAt: pickAt, boxSelect: boxSelect, sameTypeIn: sameTypeIn, step: step, updateVis: updateVis, visibleTo0: visibleTo0, newAI: newAI, aiStep: aiStep,
    PIT: PIT, SHAKY: SHAKY, CAMP_UNITS: CAMP_UNITS, CHARGE: CHARGE, SETUP: SETUP, RICH: RICH, working: working, hqAlive: hqAlive,
    canPlantOn: canPlantOn, commandPlant: commandPlant, canPack: canPack, pack: pack, packedType: packedType, canDeploy: canDeploy, deploySpot: deploySpot,
    commandDeploy: commandDeploy, deployNow: deployNow, rigOre: rigOre, newRaceAI: newRaceAI, raceStep: raceStep, raidTarget: raidTarget
  };
})(typeof window !== 'undefined' ? window : globalThis);
