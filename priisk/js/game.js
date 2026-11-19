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
    van:       { hp: 520, speed: 1.35, range: 0,  dmg: 0,  cd: 0,   weapon: null,    cost: 0,   time: 0,  sight: 4,   r: 0.5,  cls: 'veh' },
    // кампания (миссии 7–8; в скирмише не открыты): водовоз — бочка на колёсах, тушит пожары (наливается у насоса или у бочек);
    // инженер — входит во вражеское здание, и оно становится нашим (захват); громада — многочастная буровая махина-босс.
    // Если миссия открыла W.sand, рудовозы тоже тушат: возят песок (тот же приказ, что у водовоза, груз меньше)
    bowser:    { hp: 300, speed: 1.9, range: 0,   dmg: 0,  cd: 0,   weapon: null,    cost: 300, time: 8,  sight: 5,   r: 0.44, cls: 'veh', from: 'works', water: 100 },
    engineer:  { hp: 70,  speed: 1.9, range: 0,   dmg: 0,  cd: 0,   weapon: null,    cost: 250, time: 7,  sight: 5,   r: 0.3,  cls: 'inf', from: 'bunk', engineer: true },
    colossus:  { hp: 15000, speed: 0.42, range: 5.8, dmg: 42, cd: 1.7, weapon: 'shell', cost: 0,  time: 0,  sight: 7.5, r: 1.45, cls: 'veh', boss: true }
  };
  // Способности героев: cry — «Клич» (аура ×2 на время), flare — «Метка» (открыть туман в точке на время).
  var HEROES = {
    varvara: { ability: 'cry', cd: 30, dur: 8, aura: 4.5, dmg: 1.25, spd: 1.15, cryDmg: 1.5, crySpd: 1.3 },
    lunya:   { ability: 'flare', cd: 25, dur: 12, r: 6, reach: 18 },
    sava:    { ability: 'fix', cd: 35, dur: 6, r: 4.5, rate: 45, field: 2.6, fieldRate: 5, douse: 10, douseFast: 45 }
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
    rig:     { w: 2, h: 2, hp: 900,  cost: 0,   time: 0,  power: 0,   req: [],          sight: 3, rate: 4, loud: true, noPanel: true },
    // насос (кампания): ставится у воды (рядом хоть одна клетка воды/полыньи) где угодно на карте, водовозы наливаются у него без счёта
    pump:    { w: 2, h: 2, hp: 500,  cost: 250, time: 8,  power: -5,  req: ['boiler'],  sight: 4, pump: true, gap: 999 },
    // склад (кампания, сценарный): запас меди stock — достаётся тому, кто захватит склад инженером
    store:   { w: 2, h: 2, hp: 800,  cost: 0,   time: 0,  power: 0,   req: [],          sight: 3, stock: 600, noPanel: true },
    // копёр рудника (кампания, сценарный): надшахтная вышка с колесом — сердце чужого рудника
    shaft:   { w: 3, h: 3, hp: 2000, cost: 0,   time: 0,  power: 0,   req: [],          sight: 5, noPanel: true }
  };
  var FORT_LIST = ['palisade', 'tower'];
  // Здания и юниты кампании, которых нет в скирмише (кнопки — только если миссия их открыла)
  var CAMP_BLDS = ['pump'];
  var CAMP_UNITS = ['sapper', 'drill', 'bowser', 'engineer'];
  // Пожар и вода: водовоз набирает воду (FILL в секунду), льёт SPRAY в секунду с расстояния HOSE от края огня; литр воды гасит
  // DOUSE единиц силы огня. Огонь сам разгорается (grow), жжёт юнитов (dps; технике ×0.5) и здания (bdps) в радиусе r.
  var H2O = { fill: 50, spray: 25, douse: 1.6, hose: 1.7, auto: 7 };
  // Захват: инженер у самого здания CAPTURE секунд «входит» (если рядом нет вооружённой охраны) — здание переходит к нему.
  var CAPTURE = { t: 1.2, guard: 2.5 };
  // Громада: узлы — у каждого своя прочность, место на корпусе (at: вдоль хода / поперёк, в клетках) и эффект при разрушении.
  // Попадание приходится в ближайший к стрелку целый узел: с борта — гусеницы, спереди — бур, с кормы — кабина; котёл в середине
  // открывается, когда сбиты узлы, что ближе к стрелку (с борта — сразу за гусеницами). Без гусениц стоит; без бура не бурит (здания давит корпусом, медленно — crush); без
  // кабины молчит пушка; без котла нет выбросов пара и ход тише (cold). Разбиты все узлы — громада уничтожена. Идёт по маршруту
  // u.bs.route, сворачивает к чужим зданиям не дальше lure клеток (на шум буровой вышки — с lureLoud: приманка), выброс гейзера обваривает все узлы (steam) и
  // останавливает её на stun секунд (не чаще раза в scaldCd секунд); заряд подрывника бьёт ближайший к подрывнику узел (charge).
  var BOSS = { parts: [{ k: 'tracks', hp: 5000, at: [[0.5, -1.2], [0.5, 1.2], [-0.6, -1.2], [-0.6, 1.2]] }, { k: 'drill', hp: 3200, at: [[1.6, 0]] }, { k: 'cabin', hp: 2400, at: [[-1.4, 0]] }, { k: 'boiler', hp: 4400, at: [[0, 0]] }],
    charge: 900, bore: 5, boreDps: 60, boreR: 2.4, crush: 45, ventEvery: 20, ventWarn: 3, vent: 4.5, ventR: 3.4, ventDps: 20, squash: 40, lure: 5, lureLoud: 11, steam: 600, stun: 5, scaldCd: 40, cold: 0.55 };
  // Заряд подрывника: таймер, урон цели, обезвреживание (свои юниты цели рядом с зарядом столько секунд)
  var CHARGE = { plant: 1.5, timer: 10, dmg: 1000, splash: 1.4, splashDmg: 60, defuse: 2.5, defR: 1.4 };
  var PLANTABLE = { rig: 1, drill: 1, hauler: 1, van: 1, colossus: 1 };
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
      players: [newPlayer(0), newPlayer(1), newPlayer(2)], ai: null, oreMax: 0, hadHq: [false, false], charges: [], hits: Object.create(null),
      fires: [], depots: [], team: null, paint: null, lifts: [], lights: [], los: false
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
  var passableCell = passable;
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
  // big — путь для громады: по рельефу с запасом 3×3 клетки, здания не мешают (она их бурит и давит)
  function passBig(W, i, j) { for (var b = j - 1; b <= j + 1; b++) for (var a = i - 1; a <= i + 1; a++) if (!inb(W, a, b) || !walkable(W.t[b * W.w + a])) return false; return true; }
  function nearestBig(W, i, j, maxR) { if (passBig(W, i, j)) return { i: i, j: j }; for (var r = 1; r <= maxR; r++) for (var b = j - r; b <= j + r; b++) for (var a = i - r; a <= i + r; a++) if (Math.max(Math.abs(a - i), Math.abs(b - j)) === r && passBig(W, a, b)) return { i: a, j: b }; return null; }
  function findPath(W, sx, sy, gx, gy, maxNodes, big) {
    var w = W.w, h = W.h, si = Math.floor(sx), sj = Math.floor(sy), gi = Math.floor(gx), gj = Math.floor(gy);
    if (!inb(W, gi, gj)) { gi = Math.max(0, Math.min(w - 1, gi)); gj = Math.max(0, Math.min(h - 1, gj)); }
    var passable = big ? passBig : passableCell;
    if (big) { var nb = nearestBig(W, gi, gj, 8); if (!nb) return []; gi = nb.i; gj = nb.j; }
    else if (!passable(W, gi, gj)) { var np = nearestPassable(W, gi, gj, 12); if (!np) return []; gi = np.i; gj = np.j; }
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
    return big ? out : smooth(W, { x: sx, y: sy }, out);
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
    var d = BLDS[type], b = { id: W.nextId++, kind: 'bld', type: type, owner: owner, pi: paintOf(W, owner), tx: tx, ty: ty, w: d.w, h: d.h, hp: d.hp, maxHp: d.hp, rally: null, hitT: -99, hitBy: 0 };
    if (d.stock) b.stock = d.stock;
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
    var d = UNITS[type], u = { id: W.nextId++, kind: 'unit', type: type, owner: owner, pi: paintOf(W, owner), x: x, y: y, hp: d.hp, maxHp: d.hp, path: [], order: { t: 'idle' },
      cd: 0, heading: owner === 0 ? -Math.PI / 4 : Math.PI * 3 / 4, aim: null, carry: 0, scanT: W.rng() * 0.5, chk: { x: x, y: y, t: 0 }, stuck: 0, hitT: -99, hitBy: 0, fireT: -9 };
    u.aim = u.heading; if (HEROES[type]) { u.abT = 0; u.abOn = 0; }
    if (d.water) u.water = 0;
    if (d.boss) initBoss(u);
    W.units.push(u); W.byId[u.id] = u; return u;
  }
  function calcPower(W) {
    for (var o = 0; o < W.players.length; o++) { W.players[o].pOut = 0; W.players[o].pUse = 0; }
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
  // Стороны: W.team[владелец] — команда (кампания: союзник — владелец 2 в команде игрока); без W.team команда = владелец.
  // hostile — стреляют ли друг в друга; friendTo0 — свой или союзник игрока (общий обзор, не цель).
  function teamOf(W, o) { return W.team && W.team[o] != null ? W.team[o] : o; }
  function hostile(W, a, b) { return teamOf(W, a) !== teamOf(W, b); }
  function friendTo0(W, o) { return o === 0 || teamOf(W, o) === teamOf(W, 0); }
  // цвет на экране: W.paint[владелец] — индекс палитры (например, наёмники — свой цвет, Сизые-союзники — сирень)
  function paintOf(W, o) { return W.paint && W.paint[o] != null ? W.paint[o] : o; }
  // сменить владельца юнита/здания (союз, захват): приказы сброшены, цвет — по новому владельцу
  function setOwner(W, e, o) {
    if (!e || e.owner === o) return e;
    e.owner = o; e.pi = paintOf(W, o);
    if (e.kind === 'unit') { e.path = []; e.order = { t: 'idle' }; e.post = { x: e.x, y: e.y }; } else { e.repair = false; e.rally = null; if (e.type === 'hq') W.hadHq[o] = true; }
    calcPower(W); return e;
  }

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
    if (d.pump && !nearWater(W, tx, ty, d.w, d.h)) return false; // насос — только у воды
    for (var n = 0; n < W.units.length; n++) { var u = W.units[n], r = UNITS[u.type].r; if (u.x + r > tx && u.x - r < tx + d.w && u.y + r > ty && u.y - r < ty + d.h) return false; }
    var near = false;
    for (n = 0; n < W.blds.length; n++) { var b = W.blds[n]; if (b.owner !== o) continue;
      var gx = Math.max(b.tx - (tx + d.w), tx - (b.tx + b.w), 0), gy = Math.max(b.ty - (ty + d.h), ty - (b.ty + b.h), 0);
      if (Math.max(gx, gy) <= (d.gap || BUILD_GAP)) { near = true; break; } }
    return near;
  }
  function nearWater(W, tx, ty, w, h) { for (var j = ty - 1; j <= ty + h; j++) for (var i = tx - 1; i <= tx + w; i++) if (inb(W, i, j) && (W.t[j * W.w + i] === WATER || W.t[j * W.w + i] === OPEN)) return true; return false; }
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
    if (target && target.owner !== o && !hostile(W, target.owner, o)) target = null; // союзник — как пустое место: идти туда
    if (target && us.some(function (u) { return UNITS[u.type].sapper; }) && canPlantOn(W, target)) return 'plant';
    if (target && us.some(function (u) { return UNITS[u.type].engineer; }) && canCapture(W, o, target)) return 'capture';
    if (us.some(function (u) { return waterCap(W, u) > 0; })) { // водовоз (и рудовоз с песком): ПКМ по огню — тушить, по насосу/бочкам — налить
      if (fireAt(W, x, y)) return 'douse';
      if ((target && target.owner === o && BLDS[target.type].pump) || (!target && depotAt(W, x, y))) return 'fill';
    }
    if (target && target.owner !== o && armed) return 'attack';
    if (!target && W.lifts.length && liftAt(W, x, y)) return 'lift'; // клеть шахты: ПКМ по площадке — ехать
    if (target && target.owner === o && target.type === 'smelter' && haul) return 'return';
    if (!target && W.ore[j * W.w + i] > 0 && haul) return 'harvest';
    if (target && target.kind === 'bld') return 'deny';
    if (!walkable(W.t[j * W.w + i])) return 'deny';
    return 'move';
  }
  function commandSmart(W, o, ids, x, y, target) {
    var k = smartKind(W, o, ids, x, y, target);
    if (k === 'plant') commandPlant(W, ids, target.id);
    else if (k === 'capture') commandCapture(W, ids, target.id);
    else if (k === 'douse') commandDouse(W, ids, fireAt(W, x, y).id);
    else if (k === 'fill') commandFill(W, ids, target && target.owner === o ? target : depotAt(W, x, y));
    else if (k === 'attack') commandAttack(W, ids, target.id);
    else if (k === 'lift') { var la = liftAt(W, x, y); commandLift(W, ids, la.lift, la.end); }
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
    if (W.fires.length) fireStep(W, dt);
    if (W.lifts.length) liftStep(W, dt);
    // смерти
    var dead = false;
    W.units = W.units.filter(function (u) { if (u.hp > 0) return true; if (u.gone) { delete W.byId[u.id]; return false; } kill(W, u); dead = true; return false; }); // gone — инженер вошёл в здание
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
    var ku = e.hitBy && W.byId[e.hitBy], killer = e.hitBy && (ku ? (ku.owner !== e.owner ? W.players[ku.owner] : null) : W.players[1 - e.owner]);
    if (killer) { killer.kills++; killer.score += Math.round(val / (e.kind === 'bld' ? 4 : 10)); } // ветеранство: 3 победы — звание (+20% урона, подлечился)
    if (ku && ku.kind === 'unit' && ku.owner !== e.owner) { ku.kills = (ku.kills || 0) + 1; if (ku.kills >= 3 && !ku.vet) { ku.vet = 1; ku.hp = Math.min(ku.maxHp, ku.hp + ku.maxHp * 0.2); W.events.push({ t: 'vet', owner: ku.owner, id: ku.id }); } }
    W.fx.push({ t: 'boom', x: c.x, y: c.y, life: 0.7, max: 0.7, big: e.kind === 'bld' || UNITS[e.type].cls === 'veh' });
    W.events.push({ t: 'die', owner: e.owner, kind: e.kind, type: e.type, x: c.x, y: c.y, tag: e.tag || null, id: e.id, packed: e.packed ? e.packed.type : null });
  }
  function damage(W, attacker, tg) {
    var d = UNITS[attacker.type] || BLDS[attacker.type], cls = tg.kind === 'bld' ? 'bld' : UNITS[tg.type].cls;
    if (tg.tag) { var hk = attacker.owner + ':' + tg.tag; W.hits[hk] = (W.hits[hk] || 0) + 1; } // кто по кому стрелял (условие hit кампании)
    if (tg.calm && attacker.owner !== tg.owner) tg.calm = false; // по мирному выстрелили — он больше не мирный
    // договор (W.treaty): здания пулей и снарядом не берутся (только заряд подрывника), но выстрел засчитывается в hits
    var amt = d.dmg * MULT[d.weapon][cls] * (0.9 + W.rng() * 0.2) * (attacker.bD || 1) * (attacker.vet ? 1.2 : 1);
    if (tg.parts) { var ap = center(attacker); hitPart(W, tg, amt, d.weapon, ap.x, ap.y); } // громада: урон — ближайшему к стрелку целому узлу
    else if (!(W.treaty && tg.kind === 'bld')) tg.hp -= amt;
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
  // Прямая видимость (W.los — шахта, кампания): сквозь породу не видно и не стреляют. Клетка-цель сама не в счёт (стену видно).
  function sees(W, x0, y0, x1, y1) {
    if (!W.los) return true;
    var dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) * 3), ti = Math.floor(x1), tj = Math.floor(y1);
    for (var s = 1; s < n; s++) { var i = Math.floor(x0 + dx * s / n), j = Math.floor(y0 + dy * s / n); if ((i !== ti || j !== tj) && W.t[j * W.w + i] === ROCK) return false; }
    return true;
  }
  function scan(W, u, radius) {
    var best = null, bd = 1e9;
    if (u.calm) return null; // мирные (сценарные) сами не стреляют, и по ним не стреляют без приказа
    for (var n = 0; n < W.units.length; n++) { var e = W.units[n]; if (!hostile(W, e.owner, u.owner) || e.hp <= 0 || e.calm) continue; var d = e.parts ? distTo(u, e) : Math.hypot(e.x - u.x, e.y - u.y); if (d <= radius && d < bd && sees(W, u.x, u.y, e.x, e.y)) { bd = d; best = e; } }
    if (best || W.treaty) return best; // по договору здания сами не обстреливают
    for (n = 0; n < W.blds.length; n++) { var b = W.blds[n]; if (!hostile(W, b.owner, u.owner)) continue; var db = distTo(u, b); if (db <= radius && db < bd) { bd = db; best = b; } }
    return best;
  }
  function unitStep(W, u, dt) {
    var d = UNITS[u.type], o = u.order;
    u.cd -= dt;
    if (u.trail) trailStep(u);
    if (u.tow) { towStep(W, u, dt); return; }
    if (o.t === 'lift') { liftWalk(W, u, dt); return; }
    if (o.t === 'plant') { plantStep(W, u, dt); return; }
    if (o.t === 'deploy') { deployStep(W, u, dt); return; }
    if (d.boss) { bossStep(W, u, dt); return; }
    if (o.t === 'capture') { captureStep(W, u, dt); return; }
    if (d.water || o.t === 'douse') { douseStep(W, u, dt); return; }
    if (!d.weapon && u.type !== 'hauler') { if ((o.t === 'move' || o.t === 'amove') && !follow(W, u, dt)) u.order = { t: 'idle' }; return; }
    if (u.type === 'hauler') { haulStep(W, u, dt); return; }
    if (o.t === 'attack') {
      var tg = W.byId[o.target];
      if (!alive(tg)) { u.path = []; u.order = o.then || { t: 'idle' }; if (u.order.t === 'amove') u.path = findPath(W, u.x, u.y, u.order.x, u.order.y); return; }
      if (o.leash && Math.hypot(u.x - o.leash.x, u.y - o.leash.y) > 8) { u.order = { t: 'move', x: o.leash.x, y: o.leash.y }; u.path = findPath(W, u.x, u.y, o.leash.x, o.leash.y); return; }
      var dist = distTo(u, tg), c = center(tg);
      if (dist <= d.range && sees(W, u.x, u.y, c.x, c.y)) {
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
        for (var n = 0; n < W.units.length; n++) { var e = W.units[n]; if (!hostile(W, e.owner, b.owner) || e.hp <= 0 || e.calm) continue; var dd = Math.hypot(e.x - c.x, e.y - c.y) - b.w / 2 - (e.parts ? UNITS[e.type].r : 0); if (dd <= d.range && dd < bd && sees(W, c.x, c.y, e.x, e.y)) { bd = dd; best = e; } }
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
          var push = Math.min(need - dl, 1.5 * dt + (need - dl) * 0.3), am = a.parts ? 0 : a.path.length ? 0.3 : 0.7, bm = b.parts ? 0 : b.path.length ? 0.3 : 0.7, s = am + bm;
          if (s <= 0) continue;
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
    function mark(x, y, r, through) { // through — сквозь породу (метка Луни)
      var r2 = r * r, los = W.los && !through;
      for (var j = Math.floor(y - r); j <= Math.ceil(y + r); j++) for (var i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
        if (!inb(W, i, j)) continue; var dx = i + 0.5 - x, dy = j + 0.5 - y; if (dx * dx + dy * dy <= r2 && (!los || sees(W, x, y, i + 0.5, j + 0.5))) v[j * W.w + i] = 2;
      }
    }
    var sm = W.sightMul == null ? 1 : W.sightMul; // погода/ночь кампании урезают обзор
    W.units.forEach(function (u) { if (friendTo0(W, u.owner)) mark(u.x, u.y, Math.max(1.5, UNITS[u.type].sight * sm)); }); // союзник делит обзор
    W.blds.forEach(function (b) { if (friendTo0(W, b.owner)) mark(b.tx + b.w / 2, b.ty + b.h / 2, Math.max(2, BLDS[b.type].sight * sm) + Math.max(b.w, b.h) / 2); });
    (W.flares || []).forEach(function (f) { mark(f.x, f.y, f.r, true); });
    (W.lights || []).forEach(function (f) { mark(f.x, f.y, f.r); }); // зажжённые фонари шахты светят всегда (темнота их не глушит)
    // шумные здания соперника (буровые вышки) слышно сквозь туман — видна сама вышка
    W.blds.forEach(function (b) { if (b.owner !== 0 && BLDS[b.type].loud) for (var j = 0; j < b.h; j++) for (var i = 0; i < b.w; i++) v[(b.ty + j) * W.w + b.tx + i] = 2; });
  }
  function visibleTo0(W, e) {
    if (e.owner === 0 || friendTo0(W, e.owner)) return true;
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
      if (hd.ability === 'fix') { if (W.fires.length) sandStep(W, h, hd, dt); fixStep(W, h, hd, dt); }
    }
    var fl = W.flares; if (fl) for (n = fl.length - 1; n >= 0; n--) { fl[n].t -= dt; if (fl[n].t <= 0) fl.splice(n, 1); }
  }
  // Сава: на месте (без пути) чинит самую побитую свою технику/здание в радиусе field; «Аврал» — всё вокруг быстро.
  function fixable(W, h, e, r) { if (e.owner !== h.owner || e.hp <= 0 || e.hp >= e.maxHp) return false; if (e.kind === 'unit' && UNITS[e.type].cls !== 'veh') return false; var c = center(e), dd = e.kind === 'bld' ? distTo(h, e) : Math.hypot(c.x - h.x, c.y - h.y); return dd <= r; }
  // Сава у огня: стоя на месте, засыпает песком очаги рядом (douse в секунду), в «Аврал» — все вокруг и быстро
  function sandStep(W, h, hd, dt) {
    var on = h.abOn > 0; if (!on && (h.path.length || h.order.t === 'attack')) return;
    var R = on ? hd.r : hd.field, rate = on ? hd.douseFast : hd.douse;
    W.fires.forEach(function (f) { if (f.hp > 0 && Math.hypot(f.x - h.x, f.y - h.y) - f.r <= R) { f.hp -= rate * dt; h.sandT = W.time; if (f.hp <= 0) { f.hp = 0; f.by = h.owner; } } });
  }
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
        var c = center(tg); W.charges.push({ id: W.nextId++, by: u.id, owner: u.owner, target: tg.id, fx: u.x, fy: u.y, x: c.x, y: c.y, t: CHARGE.timer, max: CHARGE.timer, def: 0 });
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
        var by = W.byId[ch.by]; if (tg.parts) hitPart(W, tg, (tg.bs && tg.bs.cfg.charge) || BOSS.charge, 'charge', ch.fx, ch.fy); else tg.hp -= CHARGE.dmg; if (by) tg.hitBy = by.id; tg.hitT = W.time;
        W.units.forEach(function (e) { if (e !== tg && !e.parts && Math.hypot(e.x - ch.x, e.y - ch.y) <= CHARGE.splash + (tg.parts ? UNITS[tg.type].r : 0)) { e.hp -= CHARGE.splashDmg; e.hitT = W.time; } });
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

  // ---------- Пожар и вода (кампания, миссия 7): огонь, водовозы, насосы, бочки ----------
  // Огонь f = { x, y, r, hp (сила), max, grow, dps, bdps, spread, area, cap }: разгорается сам, жжёт всё в радиусе (громаду — нет);
  // spread — раз в столько секунд при силе ≥ 85% даёт новый очаг рядом (в пределах area, не больше cap очагов там).
  function addFire(W, x, y, o) {
    o = o || {}; var max = o.max || 160;
    var f = { id: W.nextId++, x: x, y: y, r: o.r || 1.4, hp: o.hp == null ? max : Math.min(max, o.hp), max: max, grow: o.grow == null ? 1.5 : o.grow, dps: o.dps == null ? 14 : o.dps,
      bdps: o.bdps == null ? 6 : o.bdps, tag: o.tag || null, spread: o.spread || 0, st: o.spread || 0, area: o.area || null, cap: o.cap || 3 };
    W.fires.push(f); W.events.push({ t: 'fire', id: f.id, x: x, y: y, tag: f.tag }); return f;
  }
  function waterCap(W, u) { var d = UNITS[u.type]; return d.water || (u.type === 'hauler' && W.sand ? W.sand : 0); }
  function fireAt(W, x, y) { var best = null, bd = 1e9; W.fires.forEach(function (f) { var d = Math.hypot(f.x - x, f.y - y); if (f.hp > 0 && d <= f.r + 0.6 && d < bd) { bd = d; best = f; } }); return best; }
  function nearestFire(W, x, y, r) { var best = null, bd = r == null ? 1e9 : r; W.fires.forEach(function (f) { var d = Math.hypot(f.x - x, f.y - y) - f.r; if (f.hp > 0 && d < bd) { bd = d; best = f; } }); return best; }
  function depotAt(W, x, y) { for (var n = 0; n < W.depots.length; n++) { var dp = W.depots[n]; if (Math.hypot(dp.x - x, dp.y - y) <= 1.3) return dp; } return null; }
  function fireStep(W, dt) {
    for (var n = W.fires.length - 1; n >= 0; n--) {
      var f = W.fires[n];
      if (f.hp <= 0) { W.fires.splice(n, 1); W.events.push({ t: 'doused', id: f.id, x: f.x, y: f.y, tag: f.tag, by: f.by == null ? -1 : f.by }); continue; }
      f.hp = Math.min(f.max, f.hp + f.grow * dt); var k = f.hp / f.max;
      for (var m = 0; m < W.units.length; m++) { var u = W.units[m]; if (u.parts || u.hp <= 0) continue; if (Math.hypot(u.x - f.x, u.y - f.y) <= f.r) { u.hp -= f.dps * k * dt * (UNITS[u.type].cls === 'veh' ? 0.5 : 1); u.burnT = W.time; } }
      for (m = 0; m < W.blds.length; m++) { var b = W.blds[m], cx = Math.max(b.tx, Math.min(b.tx + b.w, f.x)), cy = Math.max(b.ty, Math.min(b.ty + b.h, f.y)); if (Math.hypot(cx - f.x, cy - f.y) <= f.r) { b.hp -= f.bdps * k * dt; b.burnT = W.time; } }
      if (f.spread && k >= 0.85) {
        f.st -= dt;
        if (f.st <= 0) {
          f.st = f.spread; var A = f.area || { x: f.x, y: f.y, r: 3 };
          var here = W.fires.filter(function (q) { return Math.hypot(q.x - A.x, q.y - A.y) <= A.r; }).length;
          if (here < f.cap) for (var tr = 0; tr < 6; tr++) {
            var ang = W.rng() * Math.PI * 2, dd = 1.7 + W.rng() * 1.2, nx = f.x + Math.cos(ang) * dd, ny = f.y + Math.sin(ang) * dd, ci = Math.floor(nx), cj = Math.floor(ny);
            if (!inb(W, ci, cj) || !walkable(W.t[cj * W.w + ci]) || Math.hypot(nx - A.x, ny - A.y) > A.r) continue;
            if (W.fires.some(function (q) { return Math.hypot(q.x - nx, q.y - ny) < 1.6; })) continue;
            addFire(W, ci + 0.5, cj + 0.5, { r: f.r, max: f.max, hp: f.max * 0.35, grow: f.grow, dps: f.dps, bdps: f.bdps, tag: f.tag, spread: f.spread, area: A, cap: f.cap }); break;
          }
        }
      }
    }
  }
  // откуда водовозу налиться: свой/союзный работающий насос или бочки с водой — ближайшее
  function waterSource(W, u) {
    var best = null, bd = 1e9;
    W.blds.forEach(function (b) { if (BLDS[b.type].pump && !hostile(W, b.owner, u.owner) && !(b.setup > 0)) { var d = distTo(u, b); if (d < bd) { bd = d; best = b; } } });
    W.depots.forEach(function (dp) { if (dp.w > 0 && !(dp.team != null && dp.team !== teamOf(W, u.owner))) { var d = Math.hypot(dp.x - u.x, dp.y - u.y); if (d < bd) { bd = d; best = dp; } } });
    return best;
  }
  function commandDouse(W, ids, fireId) {
    var f = W.fires.filter(function (q) { return q.id === fireId; })[0]; if (!f) return;
    var rest = [];
    liveUnits(W, ids).forEach(function (u) { if (waterCap(W, u)) { u.order = { t: 'douse', fire: f.id, fx: f.x, fy: f.y, s: 'go' }; u.path = []; u.repath = 0; } else rest.push(u.id); });
    if (rest.length) commandMove(W, rest, f.x, f.y + f.r + 1.5);
  }
  function commandFill(W, ids, src) {
    if (!src) return; var rest = [];
    liveUnits(W, ids).forEach(function (u) { if (waterCap(W, u)) { u.order = { t: 'douse', s: 'fill', src: src.kind === 'bld' ? src.id : null, dep: src.kind === 'bld' ? null : src }; u.path = []; u.repath = 0; } else rest.push(u.id); });
    if (rest.length) { var c = src.kind === 'bld' ? center(src) : src; commandMove(W, rest, c.x, c.y + 1.5); }
  }
  function goTo(W, u, x, y, dt) { u.repath = (u.repath || 0) - dt; if (!u.path.length || u.repath <= 0) { u.repath = 1; u.path = findPath(W, u.x, u.y, x, y); } follow(W, u, dt); }
  function douseStep(W, u, dt) {
    var o = u.order, cap = waterCap(W, u); if (u.water == null) u.water = 0;
    if (o.t === 'move' || o.t === 'amove') { if (!follow(W, u, dt)) u.order = { t: 'idle' }; return; }
    if (o.t === 'idle') { // сам: есть вода и огонь рядом — тушить
      u.scanT -= dt; if (u.scanT > 0) return; u.scanT = 0.6;
      var nf = u.water > 0 && nearestFire(W, u.x, u.y, H2O.auto); if (nf) u.order = { t: 'douse', fire: nf.id, fx: nf.x, fy: nf.y, s: 'go', auto: true };
      return;
    }
    if (o.t !== 'douse') return;
    if (o.s !== 'fill' && u.water <= 0) { o.s = 'fill'; o.src = null; o.dep = null; u.path = []; }
    if (o.s === 'fill') {
      var src = o.src ? W.byId[o.src] : o.dep;
      if (src && (src.kind === 'bld' ? !alive(src) : src.w <= 0)) src = null;
      if (!src) { src = waterSource(W, u); if (!src) { u.order = { t: 'idle' }; u.path = []; return; } if (src.kind === 'bld') { o.src = src.id; o.dep = null; } else { o.dep = src; o.src = null; } }
      var near = src.kind === 'bld' ? distTo(u, src) <= 1.3 : Math.hypot(src.x - u.x, src.y - u.y) <= 1.5;
      if (!near) { var sc = src.kind === 'bld' ? center(src) : src; goTo(W, u, sc.x, sc.y, dt); return; }
      u.path = []; var take = Math.min(H2O.fill * dt, cap - u.water); if (src.kind !== 'bld') { take = Math.min(take, src.w); src.w -= take; }
      u.water += take; u.fillT = W.time;
      if (u.water >= cap - 0.01 || (src.kind !== 'bld' && src.w <= 0 && u.water > 0)) {
        u.water = Math.min(cap, u.water); o.src = null; o.dep = null;
        var back = o.fire != null && W.fires.some(function (q) { return q.id === o.fire; }) || (o.fx != null && nearestFire(W, o.fx, o.fy, 8));
        if (back) { o.s = 'go'; u.path = []; } else u.order = { t: 'idle' };
      }
      return;
    }
    // go / spray: огонь по id, иначе ближайший к прежнему месту, иначе — рядом с водовозом
    var f = W.fires.filter(function (q) { return q.id === o.fire && q.hp > 0; })[0];
    if (!f) { f = (o.fx != null && nearestFire(W, o.fx, o.fy, 8)) || nearestFire(W, u.x, u.y, H2O.auto); if (!f) { u.order = { t: 'idle' }; u.path = []; return; } o.fire = f.id; o.fx = f.x; o.fy = f.y; }
    var dist = Math.hypot(f.x - u.x, f.y - u.y) - f.r;
    if (dist > H2O.hose) { goTo(W, u, f.x, f.y, dt); if (dist < H2O.hose + 0.4 && !u.path.length) u.path = []; return; }
    u.path = []; var want = Math.atan2(f.y - u.y, f.x - u.x); u.aim = turn(u.aim, want, dt * 6);
    var pour = Math.min(H2O.spray * dt, u.water); u.water -= pour; f.hp -= pour * H2O.douse; u.sprayT = W.time;
    if (f.hp <= 0) { f.hp = 0; f.by = u.owner; }
  }

  // ---------- Захват зданий инженером (кампания, миссия 7) ----------
  function canCapture(W, o, b) { return !!b && b.kind === 'bld' && alive(b) && b.owner !== o && hostile(W, o, b.owner) && b.type !== 'hq' && !BLDS[b.type].minor && !(b.setup > 0); }
  function commandCapture(W, ids, bid) {
    var b = W.byId[bid]; if (!alive(b)) return; var rest = [];
    liveUnits(W, ids).forEach(function (u) { if (UNITS[u.type].engineer) { u.order = { t: 'capture', target: bid, p: 0 }; u.path = []; u.repath = 0; } else rest.push(u.id); });
    if (rest.length) { var c = center(b); commandMove(W, rest, c.x, c.y + b.h / 2 + 1, true); }
  }
  // охрана здания: вооружённый немирный юнит хозяина рядом — войти нельзя
  function guarded(W, b) { return W.units.some(function (e) { return e.hp > 0 && !hostile(W, e.owner, b.owner) && !!UNITS[e.type].weapon && !e.calm && distTo(e, b) <= CAPTURE.guard; }); }
  function captureStep(W, u, dt) {
    var o = u.order, b = W.byId[o.target];
    if (!canCapture(W, u.owner, b)) { u.path = []; u.order = { t: 'idle' }; return; }
    if (distTo(u, b) <= 0.75) {
      u.path = [];
      if (guarded(W, b)) { o.p = 0; if (!o.warned) { o.warned = true; W.events.push({ t: 'guarded', owner: u.owner, id: b.id, type: b.type }); } return; }
      o.p += dt; if (o.p >= CAPTURE.t) captureNow(W, u, b);
      return;
    }
    var c = center(b); goTo(W, u, c.x, c.y, dt);
  }
  function captureNow(W, u, b) {
    var from = b.owner, gain = 0, c = center(b); u.gone = true; u.hp = 0;
    setOwner(W, b, u.owner); if (b.tag && !b.tag0) b.tag0 = b.tag;
    if (b.stock) { gain = b.stock; W.players[u.owner].copper += gain; b.stock = 0; }
    W.charges = W.charges.filter(function (ch) { return ch.target !== b.id || ch.owner !== u.owner; });
    W.events.push({ t: 'captured', owner: u.owner, from: from, id: b.id, type: b.type, gain: gain, x: c.x, y: c.y, tag: b.tag || null });
    return b;
  }

  // ---------- Клети шахты (кампания, миссия 9; в скирмише нет): переход между ярусами ----------
  // Ярусы шахты — отдельные области одной карты, пешком между ними не пройти. Клеть lf = { id, a, b (площадки {x,y}), cap (мест),
  // ride (секунд в пути), wait (секунд посадки), at ('a' | 'b' — где стоит клеть), st: 'idle' | 'load' | 'move', riders }.
  // Приказ «ехать» (ПКМ по площадке): юниты идут на площадку и ждут. Клеть на месте — посадка wait секунд, уезжают до cap ближайших
  // к площадке (отряд едет частями: остальные ждут следующего рейса); клеть на другом ярусе — её вызывают: она идёт пустая ride
  // секунд. В пути ездоков нет на карте (W.units / W.byId) — их не видно и по ним не стреляют; на той стороне они выходят вокруг
  // площадки. Ждущие на площадке стрелки отстреливаются, не сходя с места.
  var LIFT = { pad: 1.7, cool: 1.2 };
  function addLift(W, o) {
    var lf = { id: o.id || 'lift' + (W.lifts.length + 1), a: { x: o.a.x, y: o.a.y }, b: { x: o.b.x, y: o.b.y }, cap: o.cap || 4, ride: o.ride || 6, wait: o.wait == null ? 3 : o.wait,
      at: o.at === 'b' ? 'b' : 'a', st: 'idle', t: 0, to: null, riders: [], on: o.on !== false, trips: 0, cool: 0, label: o.label || null };
    W.lifts.push(lf); return lf;
  }
  function liftById(W, id) { for (var n = 0; n < W.lifts.length; n++) if (W.lifts[n].id === id) return W.lifts[n]; return null; }
  // площадка клети под точкой (x,y): { lift, end } или null (выключенные клети не в счёт)
  function liftAt(W, x, y) {
    for (var n = 0; n < W.lifts.length; n++) { var lf = W.lifts[n]; if (!lf.on) continue;
      if (Math.hypot(lf.a.x - x, lf.a.y - y) <= 1.15) return { lift: lf, end: 'a' }; if (Math.hypot(lf.b.x - x, lf.b.y - y) <= 1.15) return { lift: lf, end: 'b' }; }
    return null;
  }
  function commandLift(W, ids, lf, end) {
    if (!lf || !lf.on) return false; var pad = lf[end], us = liveUnits(W, ids).filter(function (u) { return !UNITS[u.type].boss && !u.tow && !u.locked; }); if (!us.length) return false;
    var tiles = spreadTiles(W, pad.x, pad.y, us.length).filter(function (t) { return Math.hypot(t.i + 0.5 - pad.x, t.j + 0.5 - pad.y) <= LIFT.pad - 0.2; });
    us.sort(function (a, b) { return Math.hypot(a.x - pad.x, a.y - pad.y) - Math.hypot(b.x - pad.x, b.y - pad.y); });
    us.forEach(function (u, n) { var t = tiles[n % Math.max(1, tiles.length)] || { i: Math.floor(pad.x), j: Math.floor(pad.y) };
      u.order = { t: 'lift', lift: lf.id, end: end, x: t.i + 0.5, y: t.j + 0.5, fails: 0 }; u.path = findPath(W, u.x, u.y, t.i + 0.5, t.j + 0.5); u.stuck = 0; u.chk = { x: u.x, y: u.y, t: 0 }; });
    return true;
  }
  function liftWalk(W, u, dt) {
    var o = u.order, lf = liftById(W, o.lift), d = UNITS[u.type];
    if (!lf || !lf.on) { u.order = { t: 'idle' }; u.path = []; return; }
    var pad = lf[o.end], dist = Math.hypot(pad.x - u.x, pad.y - u.y);
    if (u.path.length && follow(W, u, dt)) return;
    if (dist > LIFT.pad) { if (++o.fails > 6) { u.order = { t: 'idle' }; u.path = []; } else u.path = findPath(W, u.x, u.y, o.x, o.y); return; }
    o.fails = 0; // ждём клеть: отстреливаемся с места
    if (d.weapon && u.cd <= 0) { var e = scan(W, u, d.range); if (e && e.kind === 'unit') { var c = center(e); u.aim = Math.atan2(c.y - u.y, c.x - u.x); if (d.cls === 'inf') u.heading = u.aim; u.cd = d.cd; u.fireT = W.time; damage(W, u, e); } else u.cd = 0.3; }
  }
  // кто ждёт клеть на площадке end (с приказом «ехать» именно сюда)
  function liftWaiting(W, lf, end) { var pad = lf[end]; return W.units.filter(function (u) { return u.hp > 0 && u.order.t === 'lift' && u.order.lift === lf.id && u.order.end === end && Math.hypot(u.x - pad.x, u.y - pad.y) <= LIFT.pad; }); }
  function liftStep(W, dt) {
    W.lifts.forEach(function (lf) {
      if (lf.cool > 0) lf.cool -= dt;
      if (lf.st === 'move') {
        lf.t -= dt; if (lf.t > 0) return;
        lf.at = lf.to; lf.to = null; lf.st = 'idle'; lf.cool = LIFT.cool; var pad = lf[lf.at], rs = lf.riders; lf.riders = [];
        var tiles = spreadTiles(W, pad.x, pad.y, rs.length + 4).filter(function (t) { return !unitOn(W, t.i, t.j); });
        rs.forEach(function (u, n) { var t = tiles[n] || tiles[tiles.length - 1] || { i: Math.floor(pad.x), j: Math.floor(pad.y) }; u.x = t.i + 0.5; u.y = t.j + 0.5; u.path = []; u.order = { t: 'idle' }; u.post = { x: u.x, y: u.y }; u.chk = { x: u.x, y: u.y, t: 0 }; u.rode = lf.id; W.units.push(u); W.byId[u.id] = u; });
        if (rs.length) { lf.trips++; W.visT = 0; }
        W.events.push({ t: 'liftArrive', id: lf.id, end: lf.at, ids: rs.map(function (u) { return u.id; }), owner: rs.length ? rs[0].owner : -1, x: pad.x, y: pad.y });
        return;
      }
      if (!lf.on) { lf.st = 'idle'; return; }
      var other = lf.at === 'a' ? 'b' : 'a', here = liftWaiting(W, lf, lf.at);
      if (lf.st === 'idle') {
        if (lf.cool > 0) return;
        if (here.length) { lf.st = 'load'; lf.t = lf.wait; W.events.push({ t: 'liftLoad', id: lf.id, end: lf.at, owner: here[0].owner }); }
        else { var far = liftWaiting(W, lf, other); if (far.length) { lf.st = 'move'; lf.to = other; lf.t = lf.ride; lf.riders = []; W.events.push({ t: 'liftCall', id: lf.id, end: other, owner: far[0].owner }); } }
        return;
      }
      if (lf.st === 'load') {
        if (!here.length) { lf.st = 'idle'; return; }
        lf.t -= dt; if (lf.t > 0) return;
        var pad2 = lf[lf.at]; here.sort(function (a, b) { return Math.hypot(a.x - pad2.x, a.y - pad2.y) - Math.hypot(b.x - pad2.x, b.y - pad2.y); });
        var go = here.slice(0, lf.cap); go.forEach(function (u) { u.path = []; u.order = { t: 'idle' }; delete W.byId[u.id]; });
        W.units = W.units.filter(function (u) { return go.indexOf(u) < 0; });
        lf.riders = go; lf.st = 'move'; lf.to = other; lf.t = lf.ride;
        W.events.push({ t: 'liftDepart', id: lf.id, end: lf.at, ids: go.map(function (u) { return u.id; }), owner: go[0].owner, left: here.length - go.length, x: pad2.x, y: pad2.y });
      }
    });
  }
  // все, кто сейчас едет в клетях (их нет в W.units)
  function riders(W) { var out = []; W.lifts.forEach(function (lf) { lf.riders.forEach(function (u) { out.push(u); }); }); return out; }
  // Области карты (ярусы): номер связной области проходимых клеток под точкой (0 — непроходимо). Кэш до смены карты/зданий.
  function regions(W) {
    var key = W.mapRev + ':' + W.blds.length + ':' + W.nextId; if (W._reg && W._regKey === key) return W._reg;
    var reg = new Int16Array(W.w * W.h), n = 0;
    for (var s = 0; s < reg.length; s++) {
      if (reg[s] || !walkable(W.t[s]) || W.occ[s]) continue; n++; var q = [s]; reg[s] = n;
      for (var h = 0; h < q.length; h++) { var k = q[h], i = k % W.w, j = (k / W.w) | 0; for (var d = 0; d < 4; d++) { var a = i + DX[d], b = j + DY[d]; if (!inb(W, a, b)) continue; var m = b * W.w + a; if (!reg[m] && walkable(W.t[m]) && !W.occ[m]) { reg[m] = n; q.push(m); } } }
    }
    W._reg = reg; W._regKey = key; return reg;
  }
  function regionOf(W, x, y) { var i = Math.floor(x), j = Math.floor(y); if (!inb(W, i, j)) return 0; var r = regions(W)[j * W.w + i]; if (r) return r; var np = nearestPassable(W, i, j, 3); return np ? regions(W)[np.j * W.w + np.i] : 0; }
  // Какой клетью ехать из (x0,y0), чтобы попасть в область точки (x1,y1): { lift, end } — первая пересадка (поиск в ширину по
  // включённым клетям); null — та же область или пути нет. reach — есть ли путь вообще (пешком и клетями).
  function liftRoute(W, x0, y0, x1, y1) {
    var from = regionOf(W, x0, y0), to = regionOf(W, x1, y1); if (!from || !to || from === to) return null;
    var seen = {}, q = [{ r: from, first: null }]; seen[from] = 1;
    for (var h = 0; h < q.length; h++) {
      var cur = q[h]; if (cur.r === to) return cur.first;
      for (var n = 0; n < W.lifts.length; n++) { var lf = W.lifts[n]; if (!lf.on) continue; var ra = regionOf(W, lf.a.x, lf.a.y), rb = regionOf(W, lf.b.x, lf.b.y);
        if (ra === cur.r && !seen[rb]) { seen[rb] = 1; q.push({ r: rb, first: cur.first || { lift: lf, end: 'a' } }); }
        if (rb === cur.r && !seen[ra]) { seen[ra] = 1; q.push({ r: ra, first: cur.first || { lift: lf, end: 'b' } }); } }
    }
    return null;
  }
  function liftReach(W, x0, y0, x1, y1) { var a = regionOf(W, x0, y0), b = regionOf(W, x1, y1); return !!a && !!b && (a === b || !!liftRoute(W, x0, y0, x1, y1)); }

  // ---------- Громада (кампания, миссия 8): многочастный юнит-босс ----------
  // u.parts — узлы [{ k, hp, maxHp, at }]; u.hp — сумма узлов. Состояние u.bs: st 'walk' | 'bore' | 'warn' | 'vent', маршрут route
  // (точки), stun — оглушена паром гейзера. Узел выбирает стрелок своим местом: попадание приходится в ближайший целый узел.
  function initBoss(u, cfg) {
    cfg = Object.assign({}, BOSS, cfg || {}); var tot = 0;
    u.parts = cfg.parts.map(function (p) { tot += p.hp; return { k: p.k, hp: p.hp, maxHp: p.hp, at: p.at, hitT: -9 }; }); u.hp = u.maxHp = tot;
    u.bs = { cfg: cfg, st: 'walk', t: 0, vent: cfg.ventEvery, route: [], ri: 0, done: false, stun: 0, lureT: 0, lure: 0 };
    return u;
  }
  // настроить громаду миссии: свои прочности узлов и параметры (cfg.parts — { tracks: 4000, … } или массив, как в BOSS)
  function setBoss(u, cfg) {
    cfg = Object.assign({}, cfg || {});
    if (cfg.parts && !Array.isArray(cfg.parts)) { var hp = cfg.parts; cfg.parts = BOSS.parts.map(function (p) { return { k: p.k, hp: hp[p.k] == null ? p.hp : hp[p.k], at: p.at }; }); }
    var keep = u.bs ? { route: u.bs.route, ri: u.bs.ri } : null; initBoss(u, cfg); if (keep) { u.bs.route = keep.route; u.bs.ri = keep.ri; } return u;
  }
  function partAlive(u, k) { return !!u.parts && u.parts.some(function (p) { return p.k === k && p.hp > 0; }); }
  function partOf(u, k) { for (var n = 0; n < (u.parts || []).length; n++) if (u.parts[n].k === k) return u.parts[n]; return null; }
  // места узла на карте (у гусениц — два борта)
  function partPts(u, p) { var c = Math.cos(u.heading), s = Math.sin(u.heading); return p.at.map(function (a) { return { x: u.x + a[0] * c - a[1] * s, y: u.y + a[0] * s + a[1] * c }; }); }
  // целый узел, ближайший к точке (x,y) — в него придётся попадание оттуда; без точки — первый целый
  function partToward(u, x, y) {
    var best = null, bd = 1e9;
    (u.parts || []).forEach(function (p) { if (p.hp <= 0) return; if (x == null) { if (!best) best = p; return; } partPts(u, p).forEach(function (q) { var d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = p; } }); });
    return best;
  }
  function partDmg(W, u, p, amt) {
    if (!p || p.hp <= 0) return; p.hp -= amt; p.hitT = W.time;
    if (p.hp <= 0) {
      p.hp = 0;
      if (p.k === 'tracks') u.path = [];
      if (p.k === 'drill' && u.bs.st === 'bore') u.bs.st = 'walk';
      if (p.k === 'boiler' && (u.bs.st === 'vent' || u.bs.st === 'warn')) u.bs.st = 'walk';
      var left = u.parts.filter(function (q) { return q.hp > 0; }).length;
      W.fx.push({ t: 'boom', x: u.x, y: u.y, life: 0.9, max: 0.9, big: true });
      W.events.push({ t: 'part', k: p.k, owner: u.owner, id: u.id, tag: u.tag || null, x: u.x, y: u.y, left: left });
    }
    var s = 0; u.parts.forEach(function (q) { s += q.hp; }); u.hp = s > 0 ? Math.max(1, s) : 0;
  }
  // попадание по громаде из точки (ax, ay): урон — ближайшему оттуда целому узлу
  function hitPart(W, u, amt, weapon, ax, ay) { var p = partToward(u, ax, ay); if (p) partDmg(W, u, p, amt); return p; }
  // выброс пара гейзера под громадой: обварены все целые узлы, сама она встаёт (stun секунд)
  function bossSteam(W, u, dmg, stun) {
    if (!u.parts || u.hp <= 0) return false; var C = u.bs.cfg;
    if (W.time - (u.bs.scaldT == null ? -1e9 : u.bs.scaldT) < C.scaldCd) return false; u.bs.scaldT = W.time; // мокрый корпус: следующий выброс скоро не возьмёт
    u.parts.slice().forEach(function (p) { partDmg(W, u, p, dmg == null ? C.steam : dmg); });
    u.bs.stun = Math.max(u.bs.stun, stun == null ? C.stun : stun); u.steamT = W.time; u.hitT = W.time;
    W.events.push({ t: 'bossScald', id: u.id, tag: u.tag || null, x: u.x, y: u.y }); return true;
  }
  // здание на пути: впереди по ходу (или уже под корпусом) — чужое (не своей стороны)
  function bossBlock(W, u) {
    var r = UNITS[u.type].r, ax = u.x + Math.cos(u.heading) * (r + 0.35), ay = u.y + Math.sin(u.heading) * (r + 0.35), best = null;
    W.blds.forEach(function (b) { if (best || !hostile(W, b.owner, u.owner)) return;
      var cx = Math.max(b.tx, Math.min(b.tx + b.w, ax)), cy = Math.max(b.ty, Math.min(b.ty + b.h, ay)); if (Math.hypot(cx - ax, cy - ay) < 0.55 || distTo(u, b) < r - 0.2) best = b; });
    return best;
  }
  function bossAoe(W, u, x, y, r, dmg, bmul) {
    W.units.forEach(function (e) { if (e === u || e.hp <= 0 || !hostile(W, e.owner, u.owner) || e.parts) return; if (Math.hypot(e.x - x, e.y - y) <= r + UNITS[e.type].r) { e.hp -= dmg * (UNITS[e.type].cls === 'veh' ? 0.7 : 1); e.hitT = W.time; e.hitBy = u.id; } });
    if (bmul) W.blds.forEach(function (b) { if (!hostile(W, b.owner, u.owner)) return; var cx = Math.max(b.tx, Math.min(b.tx + b.w, x)), cy = Math.max(b.ty, Math.min(b.ty + b.h, y)); if (Math.hypot(cx - x, cy - y) <= r) { b.hp -= dmg * bmul; b.hitT = W.time; b.hitBy = u.id; } });
  }
  // куда ползёт: приманка (чужое здание не дальше cfg.lure клеток, шумная буровая вышка — cfg.lureLoud; частокол не в счёт) → точка маршрута → после маршрута — ближайшее чужое здание
  function bossGoal(W, u) {
    var B = u.bs, C = B.cfg, best = null, bd = 1e9;
    W.blds.forEach(function (b) { if (!hostile(W, b.owner, u.owner) || BLDS[b.type].minor) return; var d = distTo(u, b); if (d <= (BLDS[b.type].loud && !(b.setup > 0) ? C.lureLoud : C.lure) && d < bd) { bd = d; best = b; } });
    if (best) { B.lure = best.id; return center(best); }
    B.lure = 0;
    while (B.ri < B.route.length && Math.hypot(B.route[B.ri].x - u.x, B.route[B.ri].y - u.y) < 1.6) { B.ri++; if (B.ri >= B.route.length && !B.done) { B.done = true; W.events.push({ t: 'bossArrived', id: u.id, tag: u.tag || null }); } }
    if (B.ri < B.route.length) return B.route[B.ri];
    bd = 1e9; W.blds.forEach(function (b) { if (!hostile(W, b.owner, u.owner)) return; var d = distTo(u, b) - (b.type === 'hq' ? 6 : 0); if (d < bd) { bd = d; best = b; } });
    return best ? center(best) : null;
  }
  function bossStep(W, u, dt) {
    var B = u.bs, C = B.cfg, d = UNITS[u.type], r = d.r; if (u.hp <= 0) return;
    var tracks = partAlive(u, 'tracks'), drill = partAlive(u, 'drill'), cabin = partAlive(u, 'cabin'), boiler = partAlive(u, 'boiler');
    if (B.stun > 0) B.stun -= dt;
    else if (B.st === 'walk') {
      if (boiler) B.vent -= dt;
      var ob = bossBlock(W, u);
      if (boiler && B.vent <= 0) { B.st = 'warn'; B.t = C.ventWarn; W.events.push({ t: 'bossVentWarn', id: u.id, x: u.x, y: u.y }); }
      else if (ob && drill) { B.st = 'bore'; B.t = C.bore; W.events.push({ t: 'bossBore', id: u.id, x: u.x, y: u.y, on: ob.type }); }
      else if (ob) { ob.hp -= C.crush * dt; ob.hitT = W.time; ob.hitBy = u.id; } // бура нет — давит корпусом, стоя
      else if (tracks) {
        B.lureT -= dt; if (B.lureT <= 0 || !B.goal) { B.lureT = 1; var g = bossGoal(W, u); if (!g || !B.goal || Math.hypot(g.x - B.goal.x, g.y - B.goal.y) > 0.5) u.path = []; B.goal = g; }
        if (B.goal) {
          if (!u.path.length) { u.path = findPath(W, u.x, u.y, B.goal.x, B.goal.y, null, true); if (!u.path.length) u.path = [{ x: B.goal.x, y: B.goal.y }]; }
          var q = u.path[0], dx = q.x - u.x, dy = q.y - u.y, dl = Math.hypot(dx, dy), sp = d.speed * (u.sm || 1) * (boiler ? 1 : C.cold) * dt;
          if (dl <= sp) { u.x = q.x; u.y = q.y; u.path.shift(); if (!u.path.length) B.lureT = 0; } else { u.x += dx / dl * sp; u.y += dy / dl * sp; }
          var la = u.path[Math.min(u.path.length - 1, 5)] || q, lx = la.x - u.x, ly = la.y - u.y; // корпус смотрит вдаль по пути, а не на ближнюю клетку — не рыскает
          if (Math.hypot(lx, ly) > 0.3) u.heading = turn(u.heading, Math.atan2(ly, lx), dt * 1.2); else if (dl > 0.01) u.heading = turn(u.heading, Math.atan2(dy, dx), dt * 1.2);
          u.moveT = W.time;
        }
      }
    } else if (B.st === 'bore') {
      B.t -= dt; var fx = u.x + Math.cos(u.heading) * (r + 0.7), fy = u.y + Math.sin(u.heading) * (r + 0.7);
      bossAoe(W, u, fx, fy, C.boreR, C.boreDps * dt, 3);
      if (B.t <= 0 || (B.t < C.bore - 1 && !bossBlock(W, u))) { B.st = 'walk'; B.lureT = 0; }
    } else if (B.st === 'warn') { B.t -= dt; if (B.t <= 0) { B.st = 'vent'; B.t = C.vent; W.events.push({ t: 'bossVent', id: u.id, x: u.x, y: u.y }); } }
    else if (B.st === 'vent') { B.t -= dt; bossAoe(W, u, u.x, u.y, C.ventR, C.ventDps * dt, 0); if (B.t <= 0) { B.st = 'walk'; B.vent = C.ventEvery; } }
    // пушка в кабине: ближайшая цель в радиусе (юнит, иначе здание); кабина разбита или громада оглушена — молчит
    if (u.cd <= 0 && cabin && !(B.stun > 0)) {
      var tg = null, bd = d.range;
      W.units.forEach(function (e) { if (e.hp <= 0 || !hostile(W, e.owner, u.owner) || e.calm) return; var dd = distTo(u, e) - r; if (dd <= bd) { bd = dd; tg = e; } });
      if (!tg) W.blds.forEach(function (b) { if (!hostile(W, b.owner, u.owner)) return; var dd = distTo(u, b) - r; if (dd <= bd) { bd = dd; tg = b; } });
      if (tg) { var tc = center(tg); u.aim = Math.atan2(tc.y - u.y, tc.x - u.x); u.cd = d.cd; u.fireT = W.time; damage(W, u, tg); } else u.cd = 0.3;
    }
    // под корпусом — не стоять: отжимает в сторону, чужих давит (на ходу)
    W.units.forEach(function (e) {
      if (e === u || e.hp <= 0) return; var dx = e.x - u.x, dy = e.y - u.y, dl = Math.hypot(dx, dy), need = r + UNITS[e.type].r * 0.6; if (dl >= need) return;
      if (dl < 1e-3) { dx = 1; dy = 0; dl = 1; }
      var nx = u.x + dx / dl * need, ny = u.y + dy / dl * need; if (passable(W, Math.floor(nx), Math.floor(ny))) { e.x = nx; e.y = ny; }
      if (hostile(W, e.owner, u.owner) && tracks && W.time - (u.moveT || -9) < 0.2) { e.hp -= C.squash * dt; e.hitT = W.time; e.hitBy = u.id; }
    });
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
    commandDeploy: commandDeploy, deployNow: deployNow, rigOre: rigOre, newRaceAI: newRaceAI, raceStep: raceStep, raidTarget: raidTarget,
    CAMP_BLDS: CAMP_BLDS, H2O: H2O, CAPTURE: CAPTURE, BOSS: BOSS, teamOf: teamOf, hostile: hostile, friendTo0: friendTo0, paintOf: paintOf, setOwner: setOwner,
    addFire: addFire, fireAt: fireAt, nearestFire: nearestFire, depotAt: depotAt, waterSource: waterSource, commandDouse: commandDouse, commandFill: commandFill, nearWater: nearWater,
    canCapture: canCapture, commandCapture: commandCapture, captureNow: captureNow, guarded: guarded,
    sees: sees, addLift: addLift, liftById: liftById, liftAt: liftAt, commandLift: commandLift, liftStep: liftStep, liftWaiting: liftWaiting, riders: riders, regionOf: regionOf, liftRoute: liftRoute, liftReach: liftReach, LIFT: LIFT,
    initBoss: initBoss, setBoss: setBoss, partAlive: partAlive, partOf: partOf, partPts: partPts, partToward: partToward, hitPart: hitPart, bossSteam: bossSteam, passBig: passBig, distTo: distTo, waterCap: waterCap
  };
})(typeof window !== 'undefined' ? window : globalThis);
