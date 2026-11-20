/* ПОРУБЕЖЬЕ · js/game.js — логика RTS без DOM (запускается и в браузере, и в Node для тестов).
   Карта-сетка, A*, юниты/здания двух асимметричных рас, экономика (янтарь + смола, провизия),
   грибница Чащи, туман войны, простой ИИ волнами. Всё, что видит игрок, — через game.cmd(p, …). */
(function (global) {
  'use strict';
  var P = global.PORUB = global.PORUB || {};

  var T = 32, MW = 64, MH = 48;            // тайл (px мира), размер карты в тайлах
  // SNOW — снег (проходим, медленнее, строить можно), ICE — лёд (проходим, строить нельзя), BRIDGE — настил моста (из пролётов 'span')
  var TERR = { GRASS: 0, WOOD: 1, WATER: 2, ROCK: 3, HEATH: 4, SNOW: 5, ICE: 6, BRIDGE: 7 };
  var PASS = [true, false, false, false, true, true, true, true];
  var BUILD = [true, false, false, false, true, true, false, false];
  var TSPD = [1, 1, 1, 1, 1, 0.78, 1, 1];   // множитель скорости по земле (снег — вязнут)

  // ---------- Расы ----------
  // ед.: hp, spd (тайл/с), sight/range (тайлы), dmg, cd (с), cost {a: янтарь, r: смола}, sup (провизия), time (с), r (радиус px)
  var RACES = {
    wright: { // Мастеровые: строят рабочими, здания и шагоход чинятся, раны не заживают
      main: 'hall', worker: 'worker', supply: 'house', grow: false,
      units: {
        worker:  { hp: 40, spd: 2.6, sight: 6, range: 0.4, dmg: 4, cd: 1.2, cost: { a: 50, r: 0 }, sup: 1, time: 12, r: 9, worker: true, from: 'hall' },
        shooter: { hp: 50, spd: 2.4, sight: 8, range: 5, dmg: 8, cd: 1.2, cost: { a: 50, r: 15 }, sup: 1, time: 15, r: 9, from: 'gunhouse', ranged: true },
        walker:  { hp: 220, armor: 2, spd: 1.6, sight: 9, range: 6, dmg: 20, splash: 1.0, cd: 2.4, cost: { a: 125, r: 75 }, sup: 3, time: 28, r: 15, mech: true, from: 'boiler', ranged: true },
        // герои кампании (не обучаются): воевода Ярина — знамя ускоряет стройку рядом; изобретатель Тихон — строит и чинит вдвое быстрее
        yarina:  { hp: 200, armor: 1, spd: 2.6, sight: 9, range: 4.5, dmg: 11, cd: 1.0, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 10, hero: true, ranged: true, ability: 'banner' },
        tikhon:  { hp: 130, spd: 2.5, sight: 7, range: 0.4, dmg: 5, cd: 1.2, cost: { a: 0, r: 0 }, sup: 0, time: 1, r: 10, hero: true, worker: true, craft: 2 }
      },
      buildings: {
        hall:     { s: 4, hp: 1500, cost: { a: 400, r: 0 }, time: 70, sup: 10, sight: 9, trains: ['worker'], drop: true },
        house:    { s: 2, hp: 400, cost: { a: 100, r: 0 }, time: 22, sup: 8, sight: 5 },
        gunhouse: { s: 3, hp: 800, cost: { a: 150, r: 0 }, time: 35, sight: 6, trains: ['shooter'] },
        boiler:   { s: 3, hp: 900, cost: { a: 150, r: 100 }, time: 45, sight: 6, trains: ['walker'], req: 'gunhouse' },
        // пролёт моста (кампания): ставится на воду у берега/готового пролёта; достроен — клетки становятся настилом, снесён — снова вода
        span:     { s: 2, hp: 600, cost: { a: 100, r: 0 }, time: 40, sight: 4, deck: true, extra: true }
      },
      order: ['house', 'gunhouse', 'boiler', 'hall']
    },
    thicket: { // Живая чаща: здания растут из ростка на грибнице, юниты — из личинок Пня-матери, раны заживают
      main: 'stump', worker: 'beetle', supply: 'hollow', grow: true,
      units: {
        beetle:  { hp: 40, spd: 2.7, sight: 6, range: 0.4, dmg: 4, cd: 1.2, cost: { a: 50, r: 0 }, sup: 1, time: 11, r: 9, worker: true, regen: 0.4 },
        stinger: { hp: 60, spd: 3.3, sight: 7, range: 0.45, dmg: 6, cd: 0.75, cost: { a: 50, r: 10 }, sup: 1, time: 14, r: 10, regen: 0.8, req: 'den' },
        shell:   { hp: 300, armor: 3, spd: 1.4, sight: 8, range: 3.5, dmg: 14, splash: 0.8, cd: 1.8, cost: { a: 100, r: 100 }, sup: 3, time: 26, r: 15, regen: 1.5, req: 'barrow', ranged: true }
      },
      buildings: {
        stump:  { s: 4, hp: 1400, cost: { a: 350, r: 0 }, time: 60, sup: 10, sight: 9, larva: true, drop: true, myc: 7, regen: 3, anywhere: true },
        hollow: { s: 2, hp: 350, cost: { a: 100, r: 0 }, time: 22, sup: 8, sight: 5, myc: 4, regen: 1 },
        den:    { s: 3, hp: 700, cost: { a: 150, r: 0 }, time: 32, sight: 6, myc: 3, regen: 1.5 },
        barrow: { s: 3, hp: 850, cost: { a: 150, r: 100 }, time: 42, sight: 6, myc: 3, regen: 1.5, req: 'den' }
      },
      order: ['hollow', 'den', 'barrow', 'stump']
    }
  };
  var LARVA_MAX = 3, LARVA_EVERY = 8, SUP_MAX = 60, QUEUE_MAX = 5;
  // timber — сухостой (дрова, ресурс кампании): rk — ключ ресурса в res[p]
  var GATHER = { amber: { amt: 5, t: 1.6 }, resin: { amt: 4, t: 2.2 }, timber: { amt: 4, t: 3.0 } };
  var NODE_AMT = { amber: 1200, resin: 3000, timber: 300 };
  var RKEY = { amber: 'a', resin: 'r', timber: 'w' };
  var REPAIR_HPS = 14;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Двоичная куча для A* ----------
  function Heap() { this.a = []; this.p = []; }
  Heap.prototype.push = function (v, pr) {
    var a = this.a, p = this.p, i = a.length; a.push(v); p.push(pr);
    while (i > 0) { var j = (i - 1) >> 1; if (p[j] <= pr) break; a[i] = a[j]; p[i] = p[j]; i = j; }
    a[i] = v; p[i] = pr;
  };
  Heap.prototype.pop = function () {
    var a = this.a, p = this.p, top = a[0], lv = a.pop(), lp = p.pop(), n = a.length;
    if (n) {
      var i = 0;
      for (;;) { var l = 2 * i + 1, r = l + 1, m = i, mp = lp;
        if (l < n && p[l] < mp) { m = l; mp = p[l]; } if (r < n && p[r] < mp) { m = r; mp = p[r]; }
        if (m === i) break; a[i] = a[m]; p[i] = p[m]; i = m; }
      a[i] = lv; p[i] = lp;
    }
    return top;
  };
  Object.defineProperty(Heap.prototype, 'size', { get: function () { return this.a.length; } });

  // ---------- Карта (центрально-симметричная: обе стороны в равных условиях) ----------
  var BASES = [{ tx: 6, ty: 6 }, { tx: MW - 10, ty: MH - 10 }]; // левый верхний угол главного здания 4×4
  var AMBER0 = [[14, 5], [15, 7], [15, 9], [14, 11], [12, 12], [10, 13]];
  var RESIN0 = [4, 14];                                          // 2×2
  var EXP0 = { amber: [[9, 33], [10, 35], [12, 36], [14, 36]], resin: [6, 36] };
  function mir(x, y, s) { s = s || 1; return [MW - x - s, MH - y - s]; }

  function genMap(seed) {
    for (var attempt = 0; attempt < 40; attempt++) {
      var rng = mulberry32((seed || 1) * 7919 + attempt * 101), terr = new Uint8Array(MW * MH);
      var set = function (x, y, v) { if (x >= 0 && y >= 0 && x < MW && y < MH) { terr[y * MW + x] = v; var m = mir(x, y); terr[m[1] * MW + m[0]] = v; } };
      var clear = [];  // зоны, где не растёт лес
      clear.push([BASES[0].tx + 2, BASES[0].ty + 2, 11], [11, 35, 6], [MW / 2, MH / 2, 5]);
      var inClear = function (x, y) { for (var i = 0; i < clear.length; i++) { var c = clear[i]; for (var k = 0; k < 2; k++) { var cx = k ? MW - c[0] : c[0], cy = k ? MH - c[1] : c[1]; if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < c[2] * c[2]) return true; } } return false; };
      // кромка леса по краю
      for (var x = 0; x < MW; x++) for (var y = 0; y < MH; y++) if (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) terr[y * MW + x] = TERR.WOOD;
      // боры (сгустки леса)
      for (var b = 0; b < 26; b++) {
        var cx = 2 + Math.floor(rng() * (MW - 4)), cy = 2 + Math.floor(rng() * (MH / 2 + 4)), rr = 1.2 + rng() * 2.6;
        for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) {
          var px = cx + dx, py = cy + dy; if (px < 1 || py < 1 || px > MW - 2 || py > MH - 2) continue;
          if (dx * dx + dy * dy <= rr * rr * (0.7 + rng() * 0.5) && !inClear(px, py)) set(px, py, TERR.WOOD);
        }
      }
      // озёра (по озеру на сторону) и валуны
      var lakes = [[22, 14, 2.6], [36, 9, 1.8]];
      lakes.forEach(function (L) { for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) if (dx * dx + dy * dy <= L[2] * L[2]) set(L[0] + dx, L[1] + dy, TERR.WATER); });
      for (var k = 0; k < 10; k++) { var rx = 3 + Math.floor(rng() * (MW - 6)), ry = 3 + Math.floor(rng() * (MH / 2)); if (!inClear(rx, ry)) set(rx, ry, TERR.ROCK); }
      // вереск/мох — проходимое украшение
      for (var h = 0; h < 130; h++) { var hx = 1 + Math.floor(rng() * (MW - 2)), hy = 1 + Math.floor(rng() * (MH - 2)); if (terr[hy * MW + hx] === TERR.GRASS) set(hx, hy, TERR.HEATH); }
      // проверка связности: от базы 0 до базы 1 и до каждого месторождения
      if (connected(terr)) return terr;
    }
    throw new Error('map: нет связной карты');
  }
  function connected(terr) {
    var seen = new Uint8Array(MW * MH), q = [], s = (BASES[0].ty + 5) * MW + BASES[0].tx + 5;
    if (!PASS[terr[s]]) return false; seen[s] = 1; q.push(s);
    while (q.length) { var c = q.pop(), x = c % MW, y = (c / MW) | 0;
      for (var d = 0; d < 4; d++) { var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d]; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; var n = ny * MW + nx; if (!seen[n] && PASS[terr[n]]) { seen[n] = 1; q.push(n); } } }
    var t = (BASES[1].ty - 1) * MW + BASES[1].tx - 1;
    if (!seen[t]) return false;
    var pts = [[EXP0.resin[0] + 2, EXP0.resin[1]], [EXP0.amber[0][0] + 1, EXP0.amber[0][1]]];
    for (var i = 0; i < pts.length; i++) { if (!seen[pts[i][1] * MW + pts[i][0]]) return false; var m = mir(pts[i][0], pts[i][1]); if (!seen[m[1] * MW + m[0]]) return false; }
    return true;
  }

  // ---------- Игра ----------
  // opts.map — карта миссии (кампания): { w, h, terr: Uint8Array, nodes: [{ type, tx, ty, amt }] } — без случайной карты,
  // стартовых баз и ИИ скирмиша (их ставит js/campaign.js). opts.endRule: 'blds' (по умолчанию: нет зданий — поражение) | 'none'.
  function Game(opts) {
    opts = opts || {};
    var self = this, M = opts.map || null;
    this.T = T; this.MW = M ? M.w : MW; this.MH = M ? M.h : MH;
    this.rng = opts.rng || mulberry32(opts.seed || 1);
    this.onEvent = opts.onEvent || function () {};
    this.races = [opts.playerRace || 'wright', opts.aiRace || (opts.playerRace === 'thicket' ? 'wright' : 'thicket')];
    this.terr = M ? M.terr : genMap(opts.seed || 1); this.seedKey = M ? (opts.key || 'map') : (opts.seed || 1); this.terrRev = 0;
    var N = this.MW * this.MH;
    this.occ = new Int32Array(N);          // id+1 здания/месторождения на тайле
    this.myc = [new Uint8Array(N), new Uint8Array(N)]; // грибница по сторонам
    this.vis = [new Uint8Array(N), new Uint8Array(N)]; // 0 — не разведано, 1 — разведано, 2 — видно
    this.ents = []; this.byId = new Map(); this.nextId = 1; this.t = 0;
    this.res = [{ a: 150, r: 0, w: 0 }, { a: 150, r: 0, w: 0 }];
    this.stats = [{ kills: 0, lost: 0, lostB: 0, built: 0, trained: 0, gathered: 0, wood: 0 }, { kills: 0, lost: 0, lostB: 0, built: 0, trained: 0, gathered: 0, wood: 0 }];
    this.shots = []; this.winner = -1; this._visT = 0; this._mycDirty = true;
    this.fogOff = !!opts.fogOff; this.endRule = opts.endRule || 'blds';
    this.cold = 0;                 // мороз 0…1 (погода «Зимнего вала»): медленнее ходят вдали от тепла, медленнее добыча и стройка
    this.banners = [];             // знамёна Ярины: { x, y, r, until, owner }
    this.allowB = null;            // кампания: какие здания можно ставить (null — все из R.order)
    this.allowU = null;            // кампания: каких юнитов можно обучать (null — всех)
    this.flares = [];              // кампания: временный обзор игрока { x, y, r (клетки), until }
    var addNode = function (type, tx, ty, amt) { var s = type === 'resin' ? 2 : 1; return self._addEnt({ kind: 'n', type: type, owner: -1, tx: tx, ty: ty, s: s, amt: amt || NODE_AMT[type], amt0: amt || NODE_AMT[type], hp: 1, maxhp: 1 }); };
    this.addNode = addNode;
    if (M) { (M.nodes || []).forEach(function (n) { addNode(n.type, n.tx, n.ty, n.amt); }); }
    else {
      // месторождения
      [AMBER0, EXP0.amber].forEach(function (list) { list.forEach(function (a) { addNode('amber', a[0], a[1]); var m = mir(a[0], a[1]); addNode('amber', m[0], m[1]); }); });
      [RESIN0, EXP0.resin].forEach(function (r) { addNode('resin', r[0], r[1]); var m = mir(r[0], r[1], 2); addNode('resin', m[0], m[1]); });
      // стартовые базы
      for (var p = 0; p < 2; p++) {
        var R = RACES[this.races[p]], B = BASES[p];
        var main = this._addBuilding(p, R.main, B.tx, B.ty, true);
        for (var i = 0; i < 5; i++) { var sp = this._spawnPoint(main, i); this._addUnit(p, R.worker, sp.x, sp.y); }
        if (R.grow) main.larva = LARVA_MAX;
      }
    }
    this._recalcMyc();
    this.ai = opts.noAI || M ? null : new AI(this, 1);
    if (opts.aiBoth) this.ai0 = new AI(this, 0);
    this._updateVis();
  }
  P.Game = Game;
  P.create = function (o) { return new Game(o); };
  P.RACES = RACES; P.T = T; P.MW = MW; P.MH = MH; P.TERR = TERR; P.PASS = PASS; P.BUILD = BUILD; P.TSPD = TSPD; P.RKEY = RKEY; P.mulberry32 = mulberry32; P.Heap = Heap;
  P.consts = { LARVA_MAX: LARVA_MAX, LARVA_EVERY: LARVA_EVERY, SUP_MAX: SUP_MAX, QUEUE_MAX: QUEUE_MAX, GATHER: GATHER, NODE_AMT: NODE_AMT };

  var G = Game.prototype;
  G.def = function (e) { var R = RACES[this.races[e.owner]]; return e.kind === 'u' ? R.units[e.type] : R.buildings[e.type]; };
  G.race = function (p) { return RACES[this.races[p]]; };
  G.get = function (id) { return this.byId.get(id) || null; };
  // события: main.js (onEvent) + миссия кампании (mission.event), если она подключена
  G.emit = function (t, d) { this.onEvent(t, d); if (this.mission && this.mission.event) this.mission.event(t, d); };
  G._addEnt = function (e) {
    e.id = this.nextId++; if (e.kind !== 'u') { e.x = (e.tx + e.s / 2) * T; e.y = (e.ty + e.s / 2) * T; this._occupy(e, e.id + 1); }
    this.ents.push(e); this.byId.set(e.id, e); return e;
  };
  G._occupy = function (e, v) { for (var y = e.ty; y < e.ty + e.s; y++) for (var x = e.tx; x < e.tx + e.s; x++) this.occ[y * this.MW + x] = v; };
  G._addBuilding = function (p, type, tx, ty, done) {
    var D = this.race(p).buildings[type];
    var b = this._addEnt({ kind: 'b', type: type, owner: p, tx: tx, ty: ty, s: D.s, maxhp: D.hp, hp: done ? D.hp : Math.max(1, D.hp * 0.1),
      done: !!done, prog: done ? 1 : 0, planted: !!done, queue: [], cocoons: [], larva: 0, larvaT: 0, rally: null, seen: [p === 0, p === 1] });
    this._mycDirty = true; this._pushOut(b);
    return b;
  };
  G._addUnit = function (p, type, x, y) {
    var D = this.race(p).units[type];
    var u = this._addEnt({ kind: 'u', type: type, owner: p, x: x, y: y, r: D.r, hp: D.hp, maxhp: D.hp, ord: { t: 'idle' }, path: null, cd: 0, tgt: 0,
      carry: null, scanT: this.rng() * 0.3, stuckT: 0, lastD: 1e9, repaths: 0, fx: 0, fy: 1, hitT: -9, anim: this.rng() * 10 });
    return u;
  };

  // ---------- Проходимость и A* ----------
  G.inMap = function (tx, ty) { return tx >= 0 && ty >= 0 && tx < this.MW && ty < this.MH; };
  G.passable = function (tx, ty) { return this.inMap(tx, ty) && PASS[this.terr[ty * this.MW + tx]] && this.occ[ty * this.MW + tx] === 0; };
  G.terrAt = function (tx, ty) { return this.inMap(tx, ty) ? this.terr[ty * this.MW + tx] : TERR.WOOD; };
  // смена клеток карты (кампания: разлив, лёд, мост): перерисовать землю, вытолкнуть юнитов с непроходимого, перестроить пути
  G.setTiles = function (cells, to) {
    var self = this, n = 0;
    cells.forEach(function (c) { var k = c[1] * self.MW + c[0]; if (self.inMap(c[0], c[1]) && self.terr[k] !== to) { self.terr[k] = to; n++; } });
    if (!n) return 0;
    this.terrRev++; this._mycDirty = true;
    this.ents.forEach(function (e) {
      if (e.dead) return;
      if (e.kind === 'u') { if (!self.walkPx(e.x, e.y)) { var fc = self._freeAround(Math.floor(e.x / T), Math.floor(e.y / T), 1)[0]; if (fc) { e.x = (fc[0] + 0.5) * T; e.y = (fc[1] + 0.5) * T; } } e.path = null; }
      else if (e.kind === 'b' && !self.def(e).deck) { for (var y = e.ty; y < e.ty + e.s; y++) for (var x = e.tx; x < e.tx + e.s; x++) if (!PASS[self.terr[y * self.MW + x]]) { self._kill(e, null); return; } }
    });
    return n;
  };
  G.walkPx = function (x, y) { return this.passable(Math.floor(x / T), Math.floor(y / T)); };
  // A* по 8 направлениям без срезания углов. goal(x,y) → bool; h(x,y) → оценка (тайлы).
  // Если цель недостижима — путь к самой близкой к ней достигнутой клетке (best по h). → массив [x,y] тайлов или null
  G.findPath = function (sx, sy, goal, h, limit) {
    if (!this.inMap(sx, sy)) return null;
    if (goal(sx, sy)) return [[sx, sy]];
    limit = limit || 6000;
    var N = this.MW * this.MH, gs = this._gs || (this._gs = new Float32Array(N)), from = this._from || (this._from = new Int32Array(N)), stamp = this._stamp || (this._stamp = new Int32Array(N)), closed = this._closed || (this._closed = new Int32Array(N));
    var run = this._run = (this._run || 0) + 1;
    var open = new Heap(), s = sy * this.MW + sx; stamp[s] = run; gs[s] = 0; from[s] = -1; open.push(s, h(sx, sy));
    var best = s, bestH = h(sx, sy), found = -1, iter = 0;
    var DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
    while (open.size && iter++ < limit) {
      var c = open.pop(); if (closed[c] === run) continue; closed[c] = run;
      var cx = c % this.MW, cy = (c / this.MW) | 0;
      if (goal(cx, cy)) { found = c; break; }
      var hc = h(cx, cy); if (hc < bestH) { bestH = hc; best = c; }
      for (var d = 0; d < 8; d++) {
        var nx = cx + DX[d], ny = cy + DY[d];
        if (!this.passable(nx, ny)) continue;
        if (d >= 4 && (!this.passable(cx + DX[d], cy) || !this.passable(cx, cy + DY[d]))) continue;
        var n = ny * this.MW + nx; if (closed[n] === run) continue;
        var ng = gs[c] + (d < 4 ? 1 : 1.4142);
        if (stamp[n] !== run || ng < gs[n]) { stamp[n] = run; gs[n] = ng; from[n] = c; open.push(n, ng + h(nx, ny) * 1.001); }
      }
    }
    var end = found >= 0 ? found : best, out = [];
    while (end >= 0) { out.push([end % this.MW, (end / this.MW) | 0]); end = from[end]; if (out.length > N) break; }
    out.reverse(); out.found = found >= 0;
    return out;
  };
  // Путь к точке (тайл) / к прямоугольнику (подойти вплотную к зданию/месторождению)
  G.pathToTile = function (sx, sy, gx, gy) {
    return this.findPath(sx, sy, function (x, y) { return x === gx && y === gy; }, function (x, y) { var dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); });
  };
  G.pathToRect = function (sx, sy, e, pad) {
    pad = pad || 1; var x0 = e.tx - pad, y0 = e.ty - pad, x1 = e.tx + e.s - 1 + pad, y1 = e.ty + e.s - 1 + pad;
    var dist = function (x, y) { var dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1); return Math.max(dx, dy); };
    return this.findPath(sx, sy, function (x, y) { return dist(x, y) === 0; }, dist);
  };
  // Прямая видимость для сглаживания пути (с учётом радиуса юнита)
  G.lineFree = function (x0, y0, x1, y1, r) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy), n = Math.ceil(L / 6) + 1, q = Math.min(r || 6, 10);
    for (var i = 0; i <= n; i++) { var x = x0 + dx * i / n, y = y0 + dy * i / n;
      if (!this.walkPx(x - q, y - q) || !this.walkPx(x + q, y - q) || !this.walkPx(x - q, y + q) || !this.walkPx(x + q, y + q)) return false; }
    return true;
  };
  G._smooth = function (u, tiles, endX, endY) {
    var pts = tiles.slice(1).map(function (t) { return [(t[0] + 0.5) * T, (t[1] + 0.5) * T]; }); // первая клетка — где стоим
    if (endX != null) { if (pts.length) pts[pts.length - 1] = [endX, endY]; else pts.push([endX, endY]); }
    var out = [], cx = u.x, cy = u.y, i = 0;
    while (i < pts.length) { var j = pts.length - 1; while (j > i && !this.lineFree(cx, cy, pts[j][0], pts[j][1], u.r)) j--; out.push(pts[j]); cx = pts[j][0]; cy = pts[j][1]; i = j + 1; }
    return out;
  };

  // ---------- Выбор (рамка/клик) ----------
  G.visibleTo = function (e, p) {
    if (e.owner === p || this.fogOff) return true;
    if (e.kind === 'u') { var tx = Math.floor(e.x / T), ty = Math.floor(e.y / T); return this.inMap(tx, ty) && this.vis[p][ty * this.MW + tx] === 2; }
    if (e.kind === 'n') return this.vis[p][e.ty * this.MW + e.tx] > 0;
    return !!e.seen[p];
  };
  // Сущность под точкой мира (юниты важнее зданий)
  G.entAt = function (x, y, p) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || !this.visibleTo(e, p)) continue;
      if (e.kind === 'u') { var d = Math.hypot(e.x - x, e.y - y); if (d <= e.r + 4 && d < bd) { bd = d; best = e; } } }
    if (best) return best;
    var tx = Math.floor(x / T), ty = Math.floor(y / T); if (!this.inMap(tx, ty)) return null;
    var id = this.occ[ty * this.MW + tx] - 1; var b = id > 0 ? this.get(id) : null;
    if (!b) for (var j = 0; j < this.ents.length; j++) { var d = this.ents[j]; if (!d.dead && d.kind === 'b' && d.done && d.type === 'span' && tx >= d.tx && ty >= d.ty && tx < d.tx + d.s && ty < d.ty + d.s) { b = d; break; } } // готовый настил моста
    return b && this.visibleTo(b, p) ? b : null;
  };
  // Рамка: свои юниты, чей круг задевает рамку; если юнитов нет — одно своё здание в рамке.
  G.selectRect = function (p, x0, y0, x1, y1) {
    var ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1), units = [], blds = [];
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.owner !== p) continue;
      if (e.kind === 'u') { var cx = Math.max(ax, Math.min(e.x, bx)), cy = Math.max(ay, Math.min(e.y, by)); if (Math.hypot(e.x - cx, e.y - cy) <= e.r * 0.7) units.push(e.id); }
      else if (e.kind === 'b') { if (e.x >= ax && e.x <= bx && e.y >= ay && e.y <= by) blds.push(e.id); } }
    return units.length ? units : blds.slice(0, 1);
  };
  G.sameTypeIn = function (p, type, x0, y0, x1, y1) {
    var out = []; for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i];
      if (!e.dead && e.owner === p && e.kind === 'u' && e.type === type && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e.id); }
    return out;
  };

  // ---------- Экономика: провизия, стоимость ----------
  G.supply = function (p) {
    var used = 0, cap = 0, R = this.race(p);
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.owner !== p) continue;
      if (e.kind === 'u') used += R.units[e.type].sup;
      else if (e.kind === 'b') { if (e.done) cap += R.buildings[e.type].sup || 0;
        for (var q = 0; q < e.queue.length; q++) used += R.units[e.queue[q].type].sup;
        for (var c = 0; c < e.cocoons.length; c++) used += R.units[e.cocoons[c].type].sup; } }
    return { used: used, cap: Math.min(SUP_MAX, cap) };
  };
  G.afford = function (p, cost) { var r = this.res[p]; return r.a >= cost.a && r.r >= (cost.r || 0); };
  G.pay = function (p, cost, k) { k = k == null ? 1 : k; this.res[p].a -= cost.a * k; this.res[p].r -= (cost.r || 0) * k; };
  G.hasDone = function (p, type) { for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (!e.dead && e.owner === p && e.kind === 'b' && e.type === type && e.done) return true; } return false; };
  G.count = function (p, kind, type, pred) { var n = 0; for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (!e.dead && e.owner === p && e.kind === kind && (!type || e.type === type) && (!pred || pred(e))) n++; } return n; };
  // Почему нельзя обучить юнита (null — можно)
  G.trainBlock = function (p, b, type) {
    var R = this.race(p), D = R.units[type]; if (!D || D.hero || !b || b.dead || b.owner !== p || !b.done) return 'nobuild';
    if (p === 0 && this.allowU && !this.allowU[type]) return 'nobuild';
    var BD = R.buildings[b.type];
    if (R.grow) { if (!BD.larva) return 'nobuild'; if (D.req && !this.hasDone(p, D.req)) return 'req'; if (b.larva < 1) return 'larva'; }
    else { if ((BD.trains || []).indexOf(type) < 0) return 'nobuild'; if (b.queue.length >= QUEUE_MAX) return 'queue'; }
    if (this.res[p].a < D.cost.a) return 'amber'; if (this.res[p].r < D.cost.r) return 'resin';
    var s = this.supply(p); if (s.used + D.sup > s.cap) return 'supply';
    return null;
  };
  // Можно ли поставить здание: тайлы свободны и проходимы; для Чащи — целиком на своей грибнице (кроме Пня-матери)
  G.canPlace = function (p, type, tx, ty) {
    var R = this.race(p), D = R.buildings[type]; if (!D) return { ok: false, why: 'type' };
    if (D.req && !this.hasDone(p, D.req)) return { ok: false, why: 'req' };
    if (this.allowB && !this.allowB[type]) return { ok: false, why: 'nobuild' };
    if (D.deck) { // пролёт моста: вся площадь — вода, рядом — берег или готовый настил (чтобы подойти строителям)
      var shore = false;
      for (var dy0 = 0; dy0 < D.s; dy0++) for (var dx0 = 0; dx0 < D.s; dx0++) { var kx = tx + dx0, ky = ty + dy0;
        if (!this.inMap(kx, ky) || this.terr[ky * this.MW + kx] !== TERR.WATER || this.occ[ky * this.MW + kx]) return { ok: false, why: 'blocked' };
        if (p === 0 && !this.fogOff && this.vis[0][ky * this.MW + kx] === 0) return { ok: false, why: 'fog' }; }
      for (var e2 = -1; e2 <= D.s; e2++) [[tx + e2, ty - 1], [tx + e2, ty + D.s], [tx - 1, ty + e2], [tx + D.s, ty + e2]].forEach(function (q) { if (e2 >= 0 && e2 < D.s && this.passable(q[0], q[1])) shore = true; }, this);
      if (!shore) return { ok: false, why: 'shore' };
      if (!this.afford(p, D.cost)) return { ok: false, why: this.res[p].a < D.cost.a ? 'amber' : 'resin' };
      return { ok: true };
    }
    for (var y = ty; y < ty + D.s; y++) for (var x = tx; x < tx + D.s; x++) {
      if (!this.passable(x, y) || !BUILD[this.terr[y * this.MW + x]] || x < 1 || y < 1 || x > this.MW - 2 || y > this.MH - 2) return { ok: false, why: this.terr[y * this.MW + x] === TERR.ICE ? 'ice' : 'blocked' };
      if (R.grow && !D.anywhere && !this.myc[p][y * this.MW + x]) return { ok: false, why: 'myc' };
      if (p === 0 && !this.fogOff && this.vis[0][y * this.MW + x] === 0) return { ok: false, why: 'fog' };
    }
    // чужие юниты на месте стройки мешают
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.kind !== 'u' || e.owner === p) continue;
      if (e.x > tx * T - 4 && e.x < (tx + D.s) * T + 4 && e.y > ty * T - 4 && e.y < (ty + D.s) * T + 4) return { ok: false, why: 'units' }; }
    if (!this.afford(p, D.cost)) return { ok: false, why: this.res[p].a < D.cost.a ? 'amber' : 'resin' };
    return { ok: true };
  };
  G._recalcMyc = function () {
    for (var p = 0; p < 2; p++) {
      var M = this.myc[p]; M.fill(0); if (!this.race(p).grow) continue;
      for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.kind !== 'b' || e.owner !== p) continue;
        var D = this.def(e); if (!D.myc || !e.planted) continue;
        var rad = D.myc * (e.done ? 1 : 0.35 + 0.65 * e.prog), cx = e.tx + e.s / 2, cy = e.ty + e.s / 2;
        for (var y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) for (var x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
          if (!this.inMap(x, y)) continue; var dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= rad * rad && PASS[this.terr[y * this.MW + x]]) M[y * this.MW + x] = 1; } }
    }
    this._mycDirty = false;
  };

  // ---------- Приказы ----------
  // c: {t:'move'|'amove'|'attack'|'gather'|'build'|'repair'|'stop'|'train'|'rally'|'smart'|'cancel', ids, x, y, target, type, tx, ty}
  G.cmd = function (p, c) {
    var self = this, units = (c.ids || []).map(function (id) { return self.get(id); }).filter(function (e) { return e && !e.dead && e.owner === p && e.kind === 'u'; });
    switch (c.t) {
      case 'smart': return this._smart(p, units, c);
      case 'move': case 'amove': return this._groupMove(units, c.x, c.y, c.t);
      case 'attack': { var tg = this.get(c.target); if (!tg || tg.dead) return false; units.forEach(function (u) { self._order(u, { t: 'attack', id: tg.id }); }); return true; }
      case 'gather': { var n = this.get(c.target); if (!n || n.kind !== 'n') return false; units.forEach(function (u) { if (self.def(u).worker) self._order(u, { t: 'gather', id: n.id }); }); return true; }
      case 'repair': { var rb = this.get(c.target); if (!rb || rb.dead) return false; units.forEach(function (u) { if (self.def(u).worker && !self.race(p).grow) self._order(u, { t: 'repair', id: rb.id }); }); return true; }
      case 'stop': units.forEach(function (u) { self._order(u, { t: 'idle' }); }); return true;
      case 'build': return this._build(p, units, c.type, c.tx, c.ty);
      case 'train': return this._train(p, this.get(c.id), c.type);
      case 'cancel': return this._cancel(p, this.get(c.id));
      case 'banner': return this._banner(p, this.get(c.id));
      case 'rally': { var b = this.get(c.id); if (!b || b.owner !== p || b.kind !== 'b') return false; var tgt = c.target ? this.get(c.target) : null; b.rally = { x: c.x, y: c.y, node: tgt && tgt.kind === 'n' ? tgt.id : 0 }; return true; }
    }
    return false;
  };
  // ПКМ: враг → атака, месторождение (рабочим) → добыча, своя недостройка → достроить, своё повреждённое механическое → ремонт, земля → идти
  G._smart = function (p, units, c) {
    var self = this, tg = c.target ? this.get(c.target) : null, R = this.race(p), res = { kind: 'move' };
    if (tg && !tg.dead) {
      if (tg.owner >= 0 && tg.owner !== p) { units.forEach(function (u) { self._order(u, { t: 'attack', id: tg.id }); }); return { kind: 'attack' }; }
      if (tg.kind === 'n') {
        var any = false; units.forEach(function (u) { if (self.def(u).worker) { self._order(u, { t: 'gather', id: tg.id }); any = true; } });
        var rest = units.filter(function (u) { return !self.def(u).worker; }); if (rest.length) this._groupMove(rest, c.x, c.y, 'move');
        return { kind: any ? 'gather' : 'move' };
      }
      if (tg.owner === p) {
        var D = this.def(tg), workers = units.filter(function (u) { return self.def(u).worker; }), rest2 = units.filter(function (u) { return !self.def(u).worker; });
        if (workers.length && tg.kind === 'b' && !tg.done && !R.grow) { workers.forEach(function (u) { self._order(u, { t: 'build', id: tg.id }); }); res.kind = 'build'; }
        else if (workers.length && !R.grow && tg.hp < tg.maxhp && (tg.kind === 'b' || D.mech)) { workers.forEach(function (u) { self._order(u, { t: 'repair', id: tg.id }); }); res.kind = 'repair'; }
        else if (workers.length && tg.kind === 'b' && D.drop) { workers.forEach(function (u) { if (u.carry) self._order(u, { t: 'gather', id: u.lastNode || 0, ret: true }); else self._groupMove([u], c.x, c.y, 'move'); }); res.kind = 'move'; }
        else rest2 = units;
        if (rest2.length) this._groupMove(rest2, c.x, c.y, 'move');
        return res;
      }
    }
    this._groupMove(units, c.x, c.y, 'move'); return res;
  };
  G._order = function (u, o) { if (u.ord.t === 'build' && o.t !== 'build') u.prevGather = 0; u.ord = o; u.path = null; u.tgt = 0; u.repaths = 0; u.stuckT = 0; u.lastD = 1e9; };
  // Групповое перемещение: каждому юниту — своя свободная клетка по спирали вокруг цели (не толкаются за одну точку)
  G._groupMove = function (units, x, y, kind) {
    if (!units.length) return false;
    var gx = Math.floor(x / T), gy = Math.floor(y / T), slots = this._freeAround(gx, gy, units.length), self = this;
    var sorted = units.slice().sort(function (a, b) { return Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y); });
    sorted.forEach(function (u, i) {
      var s = slots[i] || slots[slots.length - 1] || [gx, gy], px = units.length === 1 ? x : (s[0] + 0.5) * T, py = units.length === 1 ? y : (s[1] + 0.5) * T;
      if (units.length === 1 && !self.walkPx(px, py)) { px = (s[0] + 0.5) * T; py = (s[1] + 0.5) * T; }
      self._order(u, { t: kind, x: px, y: py, tx: s[0], ty: s[1] });
    });
    return { kind: kind };
  };
  G._freeAround = function (gx, gy, n) {
    var out = [], seen = {}, q = [[gx, gy]], self = this;
    if (!this.passable(gx, gy)) { // цель в препятствии — ищем ближайшую проходимую
      var best = null, bd = 1e9; for (var r = 1; r < 12 && !best; r++) for (var dx = -r; dx <= r; dx++) for (var dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (this.passable(gx + dx, gy + dy)) { var d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [gx + dx, gy + dy]; } } }
      if (best) q = [best]; else return [[gx, gy]];
    }
    seen[q[0][0] + ',' + q[0][1]] = 1;
    while (q.length && out.length < n) { var c = q.shift(); out.push(c);
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(function (d) { var k = (c[0] + d[0]) + ',' + (c[1] + d[1]); if (!seen[k] && self.passable(c[0] + d[0], c[1] + d[1])) { seen[k] = 1; q.push([c[0] + d[0], c[1] + d[1]]); } }); }
    return out;
  };
  // Знамя Ярины: на 30 с у места, где она стоит, — стройка в 1,75 раза быстрее, рядом тепло (мороз не мешает); перезарядка 60 с
  var BANNER = { r: 4.5, life: 30, cd: 60, mul: 1.75 };
  P.BANNER = BANNER;
  G._banner = function (p, u) {
    if (!u || u.dead || u.owner !== p || this.def(u).ability !== 'banner') return false;
    if ((u.abT || 0) > this.t) { this.emit('deny', { p: p, why: 'cooldown' }); return false; }
    u.abT = this.t + BANNER.cd; this.banners.push({ x: u.x, y: u.y, r: BANNER.r * T, until: this.t + BANNER.life, owner: p, t0: this.t });
    this.emit('banner', { p: p, id: u.id, x: u.x, y: u.y }); return true;
  };
  G.bannerAt = function (p, x, y) { for (var i = 0; i < this.banners.length; i++) { var b = this.banners[i]; if (b.owner === p && b.until > this.t && Math.hypot(b.x - x, b.y - y) <= b.r) return true; } return false; };
  // Тепло: Мастеровым — у своих готовых острога/избы/котельни (5 клеток) и у знамени; Чаще — на своей грибнице
  G.warm = function (u) {
    if (!this.cold) return true;
    if ((u.warmT || 0) > this.t) return u.isWarm; u.warmT = this.t + 0.5;
    var p = u.owner, tx = Math.floor(u.x / T), ty = Math.floor(u.y / T), w = false;
    if (this.race(p).grow) w = this.inMap(tx, ty) && !!this.myc[p][ty * this.MW + tx];
    else { if (this.bannerAt(p, u.x, u.y)) w = true;
      for (var i = 0; i < this.ents.length && !w; i++) { var e = this.ents[i]; if (e.dead || e.kind !== 'b' || e.owner !== p || !e.done || !(e.type === 'hall' || e.type === 'house' || e.type === 'boiler')) continue; if (this.distTo(u, e) <= 5 * T) w = true; } }
    u.isWarm = w; return w;
  };
  // множители мороза: ход (вдали от тепла), работа (добыча), рост/стройка/обучение — у рас по-разному
  G.coldMove = function (u) { return this.cold && !this.warm(u) ? 1 - 0.3 * this.cold : 1; };
  G.coldWork = function (u) { return this.cold ? 1 - 0.4 * this.cold * (this.warm(u) ? 0.4 : 1) : 1; };
  G.coldGrow = function (p) { return this.cold ? 1 - (this.race(p).grow ? 0.5 : 0.3) * this.cold : 1; };
  G.buildList = function (p) { var R = this.race(p), al = this.allowB; if (!al) return R.order.slice(0, 4); return R.order.concat(Object.keys(R.buildings).filter(function (k) { return R.buildings[k].extra && R.order.indexOf(k) < 0; })).filter(function (k) { return al[k]; }).slice(0, 4); };
  G._build = function (p, units, type, tx, ty) {
    var self0 = this, R = this.race(p), workers = units.filter(function (u) { return self0.def(u).worker; });
    if (!workers.length) return false;
    var chk = this.canPlace(p, type, tx, ty); if (!chk.ok) { this.emit('deny', { p: p, why: chk.why }); return false; }
    this.pay(p, R.buildings[type].cost);
    var b = this._addBuilding(p, type, tx, ty, false);
    var self = this;
    if (R.grow) this._order(workers[0], { t: 'plant', id: b.id });  // жук сажает росток и свободен
    else workers.forEach(function (u) { var g = u.ord.t === 'gather' ? u.ord.id : (u.ord.t === 'build' ? u.prevGather : 0); self._order(u, { t: 'build', id: b.id }); u.prevGather = g; });
    this.emit('place', { p: p, id: b.id, type: type });
    return b;
  };
  G._train = function (p, b, type) {
    var why = this.trainBlock(p, b, type); if (why) { this.emit('deny', { p: p, why: why }); return false; }
    var R = this.race(p), D = R.units[type]; this.pay(p, D.cost);
    if (R.grow) { b.larva--; b.cocoons.push({ type: type, t: 0 }); } else b.queue.push({ type: type, t: 0 });
    this.emit('queue', { p: p, id: b.id, type: type });
    return true;
  };
  G._cancel = function (p, b) {
    if (!b || b.owner !== p || b.kind !== 'b') return false;
    if (!b.done) { this.pay(p, this.def(b).cost, -0.75); this._kill(b, null, true); return true; } // отмена стройки — возврат 75%
    var R = this.race(p), q = R.grow ? b.cocoons : b.queue; if (!q.length) return false;
    var it = q.pop(); this.pay(p, R.units[it.type].cost, -1); if (R.grow) b.larva = Math.min(LARVA_MAX, b.larva + 1); return true;
  };

  // ---------- Шаг симуляции ----------
  G.update = function (dt) {
    if (this.winner >= 0) return;
    while (dt > 1e-6) { var h = Math.min(dt, 0.05); this._step(h); dt -= h; }
  };
  G._step = function (dt) {
    this.t += dt;
    var ents = this.ents, i;
    for (i = 0; i < ents.length; i++) { var e = ents[i]; if (e.dead) continue; if (e.kind === 'u') this._unit(e, dt); else if (e.kind === 'b') this._bld(e, dt); }
    this._separate(dt);
    if (this.ents.some(function (e) { return e.dead; })) this.ents = this.ents.filter(function (e) { return !e.dead; });
    for (i = this.shots.length - 1; i >= 0; i--) { this.shots[i].t += dt; if (this.shots[i].t >= this.shots[i].dur) this.shots.splice(i, 1); }
    if (this._mycDirty || ((this.t * 2) | 0) !== (((this.t - dt) * 2) | 0)) this._recalcMyc();
    this._visT -= dt; if (this._visT <= 0) { this._visT = 0.2; this._updateVis(); }
    if (this.ai) this.ai.update(dt); if (this.ai0) this.ai0.update(dt);
    if (this.banners.length) { var tnow = this.t; this.banners = this.banners.filter(function (b) { return b.until > tnow; }); }
    if (this.mission && this.mission.step) this.mission.step(dt);   // кампания: триггеры, цели, сценарный ИИ (js/campaign.js)
    // победа: у стороны не осталось зданий (в кампании endRule 'none' — исход решает миссия: G.end)
    if (this.endRule !== 'none' && this.winner < 0) for (var p = 0; p < 2; p++) if (this.count(p, 'b') === 0) { this.end(1 - p); break; }
  };
  G.end = function (winner) { if (this.winner >= 0) return; this.winner = winner; this.emit('end', { winner: winner }); };
  G._bld = function (b, dt) {
    var D = this.def(b), R = this.race(b.owner);
    if (!b.done) {
      if (R.grow && b.planted) { this._progress(b, dt / D.time * this.coldGrow(b.owner)); }
      return; // люди: прогресс двигают рабочие (_unit build)
    }
    if (D.regen && b.hp < b.maxhp) b.hp = Math.min(b.maxhp, b.hp + D.regen * dt);
    if (R.grow && D.larva) {
      var gk = this.coldGrow(b.owner);
      if (b.larva < LARVA_MAX) { b.larvaT += dt * gk; if (b.larvaT >= LARVA_EVERY) { b.larvaT = 0; b.larva++; } } else b.larvaT = 0;
      for (var c = b.cocoons.length - 1; c >= 0; c--) { var co = b.cocoons[c]; co.t += dt * gk; if (co.t >= R.units[co.type].time) { b.cocoons.splice(c, 1); this._emerge(b, co.type); } }
    } else if (b.queue.length) {
      var q = b.queue[0]; q.t += dt * this.coldGrow(b.owner); if (q.t >= R.units[q.type].time) { b.queue.shift(); this._emerge(b, q.type); }
    }
  };
  G._progress = function (b, k) {
    var D = this.def(b), before = b.prog; b.prog = Math.min(1, b.prog + k);
    b.hp = Math.min(b.maxhp, b.hp + b.maxhp * 0.9 * (b.prog - before));
    if (b.prog >= 1 && !b.done) { b.done = true; b.hp = Math.max(b.hp, Math.round(b.hp)); this._mycDirty = true; if (D.larva) b.larva = 1;
      if (D.deck) this._deck(b, true); this.stats[b.owner].built++; this.emit('built', { p: b.owner, id: b.id, type: b.type }); }
  };
  // настил пролёта: готов — клетки BRIDGE и проходимы (сам пролёт остаётся сущностью: его можно бить и чинить); снесён — снова вода
  G._deck = function (b, on) {
    var cells = []; for (var y = b.ty; y < b.ty + b.s; y++) for (var x = b.tx; x < b.tx + b.s; x++) cells.push([x, y]);
    if (on) { this._occupy(b, 0); this.setTiles(cells, TERR.BRIDGE); }
    else { this.setTiles(cells, TERR.WATER); }
  };
  G.decks = function (p) { return this.ents.filter(function (e) { return !e.dead && e.kind === 'b' && (p == null || e.owner === p) && e.type === 'span'; }); };
  G._spawnPoint = function (b, i) {
    var tiles = [], self = this;
    for (var x = b.tx - 1; x <= b.tx + b.s; x++) for (var y = b.ty - 1; y <= b.ty + b.s; y++) { if (x >= b.tx && x < b.tx + b.s && y >= b.ty && y < b.ty + b.s) continue; if (self.passable(x, y)) tiles.push([x, y]); }
    if (!tiles.length) return { x: b.x, y: (b.ty + b.s + 0.5) * T };
    // ближе к точке сбора (или к низу-право)
    var rx = b.rally ? b.rally.x : b.x + 200, ry = b.rally ? b.rally.y : b.y + 200;
    tiles.sort(function (a, c) { return Math.hypot((a[0] + .5) * T - rx, (a[1] + .5) * T - ry) - Math.hypot((c[0] + .5) * T - rx, (c[1] + .5) * T - ry); });
    var t = tiles[(i || 0) % tiles.length]; return { x: (t[0] + 0.5) * T, y: (t[1] + 0.5) * T };
  };
  G._emerge = function (b, type) {
    var sp = this._spawnPoint(b, this.count(b.owner, 'u') % 3), u = this._addUnit(b.owner, type, sp.x, sp.y);
    this.stats[b.owner].trained++;
    if (b.rally) { var n = b.rally.node ? this.get(b.rally.node) : null;
      if (n && !n.dead && this.def(u).worker) this._order(u, { t: 'gather', id: n.id }); else this._order(u, { t: this.def(u).worker ? 'move' : 'amove', x: b.rally.x, y: b.rally.y }); }
    this.emit('trained', { p: b.owner, id: u.id, type: type });
    return u;
  };
  // Расстояние от юнита до края сущности (px)
  G.distTo = function (u, e) {
    if (e.kind === 'u') return Math.hypot(u.x - e.x, u.y - e.y) - e.r;
    var x0 = e.tx * T, y0 = e.ty * T, x1 = x0 + e.s * T, y1 = y0 + e.s * T;
    var dx = Math.max(x0 - u.x, 0, u.x - x1), dy = Math.max(y0 - u.y, 0, u.y - y1); return Math.hypot(dx, dy);
  };
  G._unit = function (u, dt) {
    var D = this.def(u), o = u.ord;
    u.cd = Math.max(0, u.cd - dt); u.anim += dt;
    if (D.regen && u.hp < u.maxhp) u.hp = Math.min(u.maxhp, u.hp + D.regen * dt);
    var reach = u.r + 10;
    switch (o.t) {
      case 'idle':
        if (!D.worker || u.tgt) { this._autoEngage(u, D, dt, true); }
        break;
      case 'move':
        if (this._follow(u, D, dt, o.x, o.y, o.tx, o.ty)) this._order(u, { t: 'idle' });
        break;
      case 'amove':
        if (this._autoEngage(u, D, dt, false)) break;
        if (this._follow(u, D, dt, o.x, o.y, o.tx, o.ty)) this._order(u, { t: 'idle' });
        break;
      case 'attack': {
        var tg = this.get(o.id); if (!tg || tg.dead || !this._canSee(u.owner, tg)) { this._order(u, { t: 'idle' }); break; }
        this._engage(u, D, dt, tg); break; }
      case 'gather': this._gather(u, D, dt, reach); break;
      case 'build': {
        var b = this.get(o.id); if (!b || b.dead) { this._afterBuild(u); break; }
        if (b.done) { this._afterBuild(u); break; }
        if (this.distTo(u, b) > reach) { this._approachRect(u, D, dt, b); break; }
        u.path = null; u.work = true;
        var builders = 0, crafts = 0; for (var i = 0; i < this.ents.length; i++) { var w = this.ents[i]; if (w.kind === 'u' && !w.dead && w.ord.t === 'build' && w.ord.id === b.id && w.work) { builders++; crafts += this.def(w).craft || 1; } }
        var mine = D.craft || 1, share = builders > 3 ? 3 * mine / crafts : mine; // троим быстрее; больше — не быстрее (Тихон — за двоих)
        this._progress(b, dt / this.def(b).time * share * this.coldGrow(b.owner) * (this.bannerAt(b.owner, b.x, b.y) ? BANNER.mul : 1));
        if (b.done) this._afterBuild(u);
        break; }
      case 'plant': {
        var s = this.get(o.id); if (!s || s.dead || s.planted) { this._order(u, { t: 'idle' }); break; }
        if (this.distTo(u, s) > reach) { this._approachRect(u, D, dt, s); break; }
        s.planted = true; this._mycDirty = true; this.emit('planted', { p: u.owner, id: s.id });
        var pg = u.prevGather; this._order(u, pg ? { t: 'gather', id: pg } : { t: 'idle' }); break; }
      case 'repair': {
        var rb = this.get(o.id); if (!rb || rb.dead || rb.hp >= rb.maxhp) { this._order(u, { t: 'idle' }); break; }
        if (this.distTo(u, rb) > reach + (rb.kind === 'u' ? 4 : 0)) { if (rb.kind === 'b') this._approachRect(u, D, dt, rb); else this._follow(u, D, dt, rb.x, rb.y, null, null, rb.r + u.r + 6); break; }
        u.path = null; u.work = true; rb.hp = Math.min(rb.maxhp, rb.hp + REPAIR_HPS * (D.craft || 1) * dt); break; }
    }
    if (o.t !== 'build' && o.t !== 'repair') u.work = false;
  };
  G._afterBuild = function (u) { var pg = u.prevGather; this._order(u, pg && this.get(pg) ? { t: 'gather', id: pg } : { t: 'idle' }); };
  G._canSee = function (p, e) { return p === 1 || this.visibleTo(e, p) || (e.kind === 'b' && e.seen[p]); };
  // Подойти к прямоугольнику здания/месторождения
  G._approachRect = function (u, D, dt, e) {
    if (!u.path || u.pathFor !== e.id) {
      var tiles = this.pathToRect(Math.floor(u.x / T), Math.floor(u.y / T), e, 1); u.path = tiles ? this._smooth(u, tiles) : []; u.pathFor = e.id; u.stuckT = 0; u.lastD = 1e9;
      if (!u.path.length) { // уже рядом, но вне досягаемости — шаг к центру
        var a = Math.atan2(e.y - u.y, e.x - u.x); this._stepTo(u, D, dt, u.x + Math.cos(a) * 20, u.y + Math.sin(a) * 20); return; }
    }
    if (this._walkPath(u, D, dt)) { u.path = null; var a2 = Math.atan2(e.y - u.y, e.x - u.x); this._stepTo(u, D, dt, u.x + Math.cos(a2) * 20, u.y + Math.sin(a2) * 20); }
  };
  // Идти к точке; true — пришли
  G._follow = function (u, D, dt, x, y, tx, ty, arrive) {
    arrive = arrive || 6;
    if (Math.hypot(u.x - x, u.y - y) <= arrive) return true;
    if (!u.path || u.pathFor !== 'p' + x + ',' + y) {
      var gx = tx != null ? tx : Math.floor(x / T), gy = ty != null ? ty : Math.floor(y / T);
      var tiles = this.pathToTile(Math.floor(u.x / T), Math.floor(u.y / T), gx, gy);
      if (!tiles) return true;
      var exact = tiles.found && this.walkPx(x, y);
      u.path = this._smooth(u, tiles, exact ? x : null, exact ? y : null); u.pathFor = 'p' + x + ',' + y; u.stuckT = 0; u.lastD = 1e9;
      if (!tiles.found && tiles.length <= 1) return true;
    }
    if (this._walkPath(u, D, dt)) { u.repaths++; if (u.repaths > 2 || Math.hypot(u.x - x, u.y - y) < T * 1.2) return true; u.path = null; }
    return false;
  };
  // Движение по пути; true — путь кончился. Залип (не приближаемся 1 с) — перестроить путь.
  G._walkPath = function (u, D, dt) {
    if (!u.path || !u.path.length) return true;
    var wp = u.path[0], d = Math.hypot(wp[0] - u.x, wp[1] - u.y);
    if (d < 5) { u.path.shift(); u.lastD = 1e9; return !u.path.length; }
    if (d < u.lastD - 2) { u.lastD = d; u.stuckT = 0; } else { u.stuckT += dt; if (u.stuckT > 1) { u.stuckT = 0; u.lastD = 1e9; u.repaths++; u.path = null; return u.repaths > 4; } }
    this._stepTo(u, D, dt, wp[0], wp[1]);
    return false;
  };
  G._stepTo = function (u, D, dt, x, y) {
    var dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy); if (d < 0.01) return;
    var tt = this.terr[Math.floor(u.y / T) * this.MW + Math.floor(u.x / T)];
    var v = D.spd * T * dt * (TSPD[tt] || 1) * this.coldMove(u) * (u.sm || 1), k = Math.min(1, v / d), nx = u.x + dx * k, ny = u.y + dy * k;
    u.fx = dx / d; u.fy = dy / d; u.moving = true;
    this._place(u, nx, ny);
  };
  G._place = function (u, nx, ny) {
    if (this.walkPx(nx, ny)) { u.x = nx; u.y = ny; }
    else if (this.walkPx(nx, u.y)) u.x = nx;
    else if (this.walkPx(u.x, ny)) u.y = ny;
  };
  // Юнит в здании (поставили поверх) — вытолкнуть на ближайшую свободную клетку
  G._pushOut = function (b) {
    for (var i = 0; i < this.ents.length; i++) { var u = this.ents[i]; if (u.kind !== 'u' || u.dead) continue;
      if (!this.walkPx(u.x, u.y)) { var c = this._freeAround(Math.floor(u.x / T), Math.floor(u.y / T), 1)[0]; u.x = (c[0] + 0.5) * T; u.y = (c[1] + 0.5) * T; u.path = null; } }
  };
  // Расталкивание юнитов (стоящие уступают идущим)
  G._separate = function (dt) {
    var us = this.ents.filter(function (e) { return e.kind === 'u' && !e.dead; }), n = us.length;
    for (var i = 0; i < n; i++) { var a = us[i];
      for (var j = i + 1; j < n; j++) { var b = us[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r - 2;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        var d2 = dx * dx + dy * dy; if (d2 >= rr * rr) continue;
        var d = Math.sqrt(d2) || 0.01; if (d2 < 0.0001) { dx = Math.cos(a.id) ; dy = Math.sin(a.id); d = 1; }
        var ov = (rr - d) * 0.5, ux = dx / d, uy = dy / d;
        var am = a.moving ? 0.35 : 1, bm = b.moving ? 0.35 : 1, wa = a.work ? 0.1 : 1, wb = b.work ? 0.1 : 1, s = am * wa + bm * wb || 1;
        var ka = ov * 2 * (am * wa) / s, kb = ov * 2 * (bm * wb) / s;
        this._place(a, a.x - ux * ka * 0.5, a.y - uy * ka * 0.5); this._place(b, b.x + ux * kb * 0.5, b.y + uy * kb * 0.5);
      } }
    for (var k = 0; k < n; k++) us[k].moving = false;
  };
  // Боевые: найти цель в радиусе обзора и сражаться. idle=true — не уходить далеко от поста.
  G._autoEngage = function (u, D, dt, idle) {
    if (D.worker && !u.tgt) return false;
    var tg = u.tgt ? this.get(u.tgt) : null;
    if (tg && (tg.dead || this.distTo(u, tg) > (D.sight + 2) * T)) { tg = null; u.tgt = 0; }
    u.scanT -= dt;
    if (u.scanT <= 0) { u.scanT = 0.3; var nt = this._scan(u, D); if (nt && (!tg || (tg.kind === 'b' && nt.kind === 'u'))) { tg = nt; u.tgt = nt.id; } }
    if (idle && tg && u.post && Math.hypot(u.x - u.post.x, u.y - u.post.y) > (D.sight + 3) * T) tg = null; // поводок: далеко от поста не гонимся
    if (!tg) {
      u.tgt = 0;
      if (idle && u.post) { var po = u.post; u.post = null; if (Math.hypot(u.x - po.x, u.y - po.y) > T * 1.5) this._order(u, { t: 'move', x: po.x, y: po.y }); }
      else if (idle && u.path) u.path = null;
      return false;
    }
    if (idle && !u.post) u.post = { x: u.x, y: u.y };
    this._engage(u, D, dt, tg);
    return true;
  };
  G._scan = function (u, D) {
    var best = null, bs = 1e9, sight = D.sight * T;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.owner < 0 || e.owner === u.owner) continue;
      if (Math.abs(e.x - u.x) > sight + 80 || Math.abs(e.y - u.y) > sight + 80) continue;
      var d = this.distTo(u, e); if (d > sight) continue;
      if (u.owner === 0 && !this.visibleTo(e, 0)) continue;
      var ed = this.def(e), sc = d + (e.kind === 'b' ? 4 * T : 0) + (e.kind === 'u' && ed.worker ? T : 0);
      if (sc < bs) { bs = sc; best = e; } }
    return best;
  };
  G._engage = function (u, D, dt, tg) {
    var range = Math.max(D.range * T, 4) + 2, d = this.distTo(u, tg) - u.r;
    if (d <= range) {
      u.path = null; u.fx = (tg.x - u.x) / (Math.hypot(tg.x - u.x, tg.y - u.y) || 1); u.fy = (tg.y - u.y) / (Math.hypot(tg.x - u.x, tg.y - u.y) || 1);
      if (u.cd <= 0) { u.cd = D.cd; this._hit(u, D, tg); }
      return;
    }
    // догоняем: путь перестраиваем раз в 0.6 с
    u.chaseT = (u.chaseT || 0) - dt;
    if (!u.path || u.chaseT <= 0) {
      u.chaseT = 0.6;
      var tiles = tg.kind === 'u' ? this.pathToTile(Math.floor(u.x / T), Math.floor(u.y / T), Math.floor(tg.x / T), Math.floor(tg.y / T)) : this.pathToRect(Math.floor(u.x / T), Math.floor(u.y / T), tg, 1);
      u.path = tiles ? this._smooth(u, tiles, tg.kind === 'u' ? tg.x : null, tg.kind === 'u' ? tg.y : null) : null; u.pathFor = 'chase'; u.lastD = 1e9;
    }
    if (!u.path || !u.path.length || this._walkPath(u, D, dt)) { this._stepTo(u, D, dt, tg.x, tg.y); }
  };
  G._hit = function (u, D, tg) {
    var dmg = function (e) { var ed = e.kind === 'u' ? this.def(e) : null; return Math.max(1, D.dmg - (ed && ed.armor || 0)); }.bind(this);
    this.shots.push({ x0: u.x, y0: u.y, x1: tg.x, y1: tg.y, t: 0, dur: D.ranged ? 0.18 : 0.12, kind: u.type, owner: u.owner });
    this._damage(tg, dmg(tg), u);
    if (D.splash) { var R = D.splash * T;
      for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e === tg || e.dead || e.kind !== 'u' || e.owner === u.owner || e.owner < 0) continue;
        if (Math.hypot(e.x - tg.x, e.y - tg.y) <= R + e.r) this._damage(e, dmg(e) * 0.5, u); } }
    this.emit('shot', { p: u.owner, type: u.type, x: u.x, y: u.y, tx: tg.x, ty: tg.y });
  };
  G._damage = function (e, n, by) {
    if (e.dead) return; e.hp -= n; e.hitT = this.t;
    this.emit('hurt', { p: e.owner, id: e.id, x: e.x, y: e.y, kind: e.kind });
    // ответный огонь: стоящий боец переключается на обидчика
    if (e.kind === 'u' && by && !by.dead && e.ord.t === 'idle' && !e.tgt && !this.def(e).worker) e.tgt = by.id;
    if (e.hp <= 0) this._kill(e, by);
  };
  G._kill = function (e, by, silent) {
    e.dead = true; e.hp = 0; this.byId.delete(e.id);
    if (e.kind !== 'u') { this._occupy(e, 0); this._mycDirty = true; if (e.kind === 'b' && e.done && this.def(e).deck) this._deck(e, false); }
    if (!silent && e.owner >= 0) { this.stats[e.owner].lost++; if (e.kind === 'b') this.stats[e.owner].lostB++; if (by) this.stats[by.owner].kills++; }
    this.emit('death', { p: e.owner, id: e.id, kind: e.kind, type: e.type, x: e.x, y: e.y, s: e.s, silent: !!silent, tag: e.tag || null, hero: e.kind === 'u' && e.owner >= 0 && !!this.def(e).hero });
  };
  // Добыча: к месторождению → копать → к ближайшему складу (главное здание) → сдать → снова
  G._gather = function (u, D, dt, reach) {
    var o = u.ord, n = this.get(o.id);
    if (u.carry && (o.ret || !n || n.dead || u.carry.amt > 0 && o.phase !== 'mine')) {
      var drop = this._nearestDrop(u); if (!drop) { this._order(u, { t: 'idle' }); return; }
      if (this.distTo(u, drop) > reach) { this._approachRect(u, D, dt, drop); return; }
      this.res[u.owner][RKEY[u.carry.type]] += u.carry.amt; this.stats[u.owner].gathered += u.carry.amt; if (u.carry.type === 'timber') this.stats[u.owner].wood += u.carry.amt;
      this.emit('deposit', { p: u.owner, type: u.carry.type, amt: u.carry.amt, x: u.x, y: u.y });
      var lastType = u.carry.type; u.carry = null; o.ret = false; u.path = null;
      if (!n || n.dead) { var nn = this._nearestNode(u, lastType, null, u.lastNX); if (nn) { o.id = nn.id; n = nn; } else { this._order(u, { t: 'idle' }); return; } }
    }
    if (!n || n.dead) { var alt = this._nearestNode(u, u.lastType || 'amber', null, u.lastNX); if (alt) { o.id = alt.id; u.path = null; } else this._order(u, { t: 'idle' }); return; }
    u.lastNode = n.id; u.lastType = n.type; u.lastNX = { x: n.x, y: n.y };
    if (this.distTo(u, n) > reach) { o.phase = 'go'; this._approachRect(u, D, dt, n); return; }
    o.phase = 'mine'; u.path = null; u.work = true; u.mineT = (u.mineT || 0) + dt * this.coldWork(u); u.fx = (n.x - u.x) / (Math.hypot(n.x - u.x, n.y - u.y) || 1); u.fy = (n.y - u.y) / (Math.hypot(n.x - u.x, n.y - u.y) || 1);
    var gk = GATHER[n.type];
    if (u.mineT >= gk.t) {
      u.mineT = 0; var amt = Math.min(gk.amt, n.amt); n.amt -= amt; u.carry = { type: n.type, amt: amt }; o.phase = 'back'; u.work = false;
      if (n.amt <= 0) this._kill(n, null, true);
    }
  };
  G._nearestDrop = function (u) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.owner !== u.owner || e.kind !== 'b' || !e.done || !this.def(e).drop) continue;
      var d = this.distTo(u, e); if (d < bd) { bd = d; best = e; } }
    return best;
  };
  // ближайшее месторождение типа type; from — откуда искать (иссякшая жила: искать рядом с ней, а не у склада)
  G._nearestNode = function (u, type, maxD, from) {
    var best = null, bd = maxD || 14 * T, ox = from ? from.x : u.x, oy = from ? from.y : u.y;
    for (var i = 0; i < this.ents.length; i++) { var e = this.ents[i]; if (e.dead || e.kind !== 'n' || e.type !== type) continue; var d = Math.hypot(e.x - ox, e.y - oy); if (d < bd) { bd = d; best = e; } }
    return best;
  };

  // ---------- Туман войны ----------
  G._updateVis = function () {
    for (var p = 0; p < 2; p++) {
      var V = this.vis[p];
      for (var i = 0; i < V.length; i++) if (V[i] === 2) V[i] = 1;
      for (var k = 0; k < this.ents.length; k++) { var e = this.ents[k]; if (e.dead || e.owner !== p) continue;
        var D = this.def(e), sr = D.sight * (e.kind === 'b' && !e.done ? 0.6 : 1), cx = e.x / T, cy = e.y / T;
        for (var y = Math.floor(cy - sr); y <= Math.ceil(cy + sr); y++) for (var x = Math.floor(cx - sr); x <= Math.ceil(cx + sr); x++) {
          if (!this.inMap(x, y)) continue; var dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= sr * sr) V[y * this.MW + x] = 2; } }
      if (p === 0 && this.flares.length) { var tn = this.t; this.flares = this.flares.filter(function (f) { return f.until > tn; });
        for (var fi = 0; fi < this.flares.length; fi++) { var fl = this.flares[fi], fx = fl.x / T, fy = fl.y / T;
          for (var y2 = Math.floor(fy - fl.r); y2 <= Math.ceil(fy + fl.r); y2++) for (var x2 = Math.floor(fx - fl.r); x2 <= Math.ceil(fx + fl.r); x2++) if (this.inMap(x2, y2) && Math.hypot(x2 + 0.5 - fx, y2 + 0.5 - fy) <= fl.r) V[y2 * this.MW + x2] = 2; } }
      // здания противника, попавшие в обзор, запоминаются
      for (var j = 0; j < this.ents.length; j++) { var b = this.ents[j]; if (b.kind !== 'b' || b.owner === p || b.seen[p]) continue;
        for (var yy = b.ty; yy < b.ty + b.s && !b.seen[p]; yy++) for (var xx = b.tx; xx < b.tx + b.s; xx++) if (V[yy * this.MW + xx] === 2) { b.seen[p] = true; break; } }
    }
  };
  G.tileVis = function (p, tx, ty) { return this.fogOff ? 2 : this.vis[p][ty * this.MW + tx]; };

  // ---------- ИИ: развивается по плану и нападает волнами ----------
  function AI(game, p) {
    this.g = game; this.p = p; this.t = 0; this.think = 0.5; this.wave = 0; this.nextWave = 300; this.waveSize = 5; this.lastWaveT = -1e9;
    var R = game.race(p);
    this.plan = R.grow
      ? [{ at: 30, type: 'hollow' }, { at: 55, type: 'den' }, { at: 150, type: 'hollow' }, { at: 190, type: 'barrow' }, { at: 300, type: 'hollow' }, { at: 420, type: 'hollow' }]
      : [{ at: 30, type: 'house' }, { at: 60, type: 'gunhouse' }, { at: 150, type: 'house' }, { at: 200, type: 'boiler' }, { at: 280, type: 'gunhouse' }, { at: 330, type: 'house' }, { at: 450, type: 'house' }];
    this.done = 0; this.log = [];
  }
  P.AI = AI;
  AI.prototype.update = function (dt) { this.t += dt; this.think -= dt; if (this.think > 0) return; this.think = 1; this._think(); };
  AI.prototype._mine = function () { var p = this.p; return this.g.ents.filter(function (e) { return !e.dead && e.owner === p; }); };
  AI.prototype._think = function () {
    var g = this.g, p = this.p, R = g.race(p), me = this._mine(), self = this;
    var units = me.filter(function (e) { return e.kind === 'u'; }), blds = me.filter(function (e) { return e.kind === 'b'; });
    var main = blds.filter(function (b) { return b.type === R.main && b.done; })[0];
    var workers = units.filter(function (u) { return R.units[u.type].worker; }), army = units.filter(function (u) { return !R.units[u.type].worker; });
    var sup = g.supply(p);
    // 1) рабочие: простаивающих — на добычу (смола — 3 рабочих, когда нужна)
    var wantResin = g.hasDone(p, R.order[1]) || this.t > 120 ? (R.grow ? 3 : 4) : 0;
    var onResin = workers.filter(function (u) { var n = u.ord.t === 'gather' && g.get(u.ord.id); return n && n.type === 'resin'; }).length;
    workers.forEach(function (u) {
      if (u.ord.t !== 'idle') return;
      var type = onResin < wantResin ? 'resin' : 'amber', n = g._nearestNode(u, type, 30 * T) || g._nearestNode(u, 'amber', 40 * T);
      if (n) { g.cmd(p, { t: 'gather', ids: [u.id], target: n.id }); if (n.type === 'resin') onResin++; }
    });
    if (onResin < wantResin) { var mover = workers.filter(function (u) { var n = u.ord.t === 'gather' && g.get(u.ord.id); return n && n.type === 'amber' && !u.carry; })[0];
      var rn = mover && g._nearestNode(mover, 'resin', 40 * T); if (rn) g.cmd(p, { t: 'gather', ids: [mover.id], target: rn.id }); }
    // 2) рабочие до 14
    if (main) {
      var queued = R.grow ? main.cocoons.filter(function (c) { return c.type === R.worker; }).length : main.queue.length;
      if (workers.length + queued < 14 && (R.grow ? main.larva > (army.length < 2 && this.t > 200 ? 1 : 0) : main.queue.length < 2)) g.cmd(p, { t: 'train', id: main.id, type: R.worker });
    }
    // 3) провизия
    var pendingSup = blds.filter(function (b) { return !b.done && R.buildings[b.type].sup; }).length;
    if (sup.cap < SUP_MAX && sup.used + 4 >= sup.cap && !pendingSup && g.afford(p, R.buildings[R.supply].cost)) this._place(R.supply, workers, main);
    // 4) план стройки
    var step = this.plan[this.done];
    if (step && this.t >= step.at) {
      if (step.type === R.supply && pendingSup) this.done++;
      else if (g.afford(p, R.buildings[step.type].cost) && (!R.buildings[step.type].req || g.hasDone(p, R.buildings[step.type].req))) { if (this._place(step.type, workers, main)) this.done++; }
    }
    // лишний янтарь — ещё одно здание бойцов (до 3)
    var prodType = R.order[1], prodN = blds.filter(function (b) { return b.type === prodType; }).length;
    if (!R.grow && this.done >= 4 && g.res[p].a > 450 && prodN < 3) this._place(prodType, workers, main);
    if (R.grow && this.done >= 4 && g.res[p].a > 550 && blds.filter(function (b) { return b.type === R.main; }).length < 2) this._place(R.main, workers, main); // второй Пень — больше личинок
    // 5) армия
    blds.forEach(function (b) {
      if (!b.done) return; var BD = R.buildings[b.type];
      if (R.grow && BD.larva) {
        if (b.larva < 1 || workers.length < 8) return;
        var t = g.hasDone(p, 'barrow') && army.filter(function (u) { return u.type === 'shell'; }).length * 3 < army.length ? 'shell' : 'stinger';
        if (!g.trainBlock(p, b, t)) g.cmd(p, { t: 'train', id: b.id, type: t });
      } else if (BD.trains && b.type !== R.main && b.queue.length < 2) {
        var ut = BD.trains[0]; if (!g.trainBlock(p, b, ut)) g.cmd(p, { t: 'train', id: b.id, type: ut });
      }
    });
    // 6) оборона: враг у наших зданий — все бойцы туда
    var threat = null;
    for (var i = 0; i < g.ents.length && !threat; i++) { var e = g.ents[i]; if (e.dead || e.kind !== 'u' || e.owner === p || e.owner < 0) continue;
      for (var j = 0; j < blds.length; j++) if (Math.hypot(e.x - blds[j].x, e.y - blds[j].y) < 9 * T) { threat = e; break; } }
    if (threat) { var idle = army.filter(function (u) { return u.ord.t !== 'amove' || !u.wave; }); if (idle.length) g.cmd(p, { t: 'amove', ids: idle.map(function (u) { return u.id; }), x: threat.x, y: threat.y }); return; }
    // 7) волна
    if (this.t >= this.nextWave && army.length >= this.waveSize) {
      var target = this._target(); if (target) {
        var ids = army.map(function (u) { u.wave = true; return u.id; });
        g.cmd(p, { t: 'amove', ids: ids, x: target.x, y: target.y });
        this.wave++; this.lastWaveT = this.t; this.nextWave = this.t + 100; this.waveSize = Math.min(24, this.waveSize + 3);
        g.emit('wave', { p: p, n: this.wave, size: ids.length });
      }
    } else if (this.wave > 0) {
      // волна дошла и стоит без дела — добить ближайшее здание
      var tgt2 = this._target(); army.forEach(function (u) { if (u.wave && u.ord.t === 'idle' && !u.tgt && tgt2) g.cmd(p, { t: 'amove', ids: [u.id], x: tgt2.x, y: tgt2.y }); });
    }
    // сбор у базы для невоюющих
    if (main) army.forEach(function (u) { if (!u.wave && u.ord.t === 'idle' && Math.hypot(u.x - main.x, u.y - main.y) > 12 * T) g.cmd(p, { t: 'move', ids: [u.id], x: main.x + (p ? -4 : 4) * T, y: main.y + (p ? -4 : 4) * T }); });
  };
  AI.prototype._target = function () {
    var g = this.g, p = this.p, enemy = 1 - p, best = null, bd = 1e9, home = this._mine().filter(function (e) { return e.kind === 'b'; })[0], ox = home ? home.x : g.MW * T / 2, oy = home ? home.y : g.MH * T / 2;
    g.ents.forEach(function (e) { if (e.dead || e.owner !== enemy || e.kind !== 'b') return; var d = Math.hypot(e.x - ox, e.y - oy); if (d < bd) { bd = d; best = e; } });
    return best;
  };
  // Поиск места: спираль вокруг главного здания, с зазором в 1 клетку, чтобы не замуровать базу
  AI.prototype._place = function (type, workers, main) {
    var g = this.g, p = this.p, R = g.race(p), D = R.buildings[type];
    var c = main || this._mine().filter(function (e) { return e.kind === 'b'; })[0]; if (!c) return false;
    var cx = Math.floor(c.x / T), cy = Math.floor(c.y / T), dirX = p ? -1 : 1, dirY = p ? -1 : 1;
    for (var r = 3; r < 14; r++) {
      var cand = [];
      for (var dx = -r; dx <= r; dx++) for (var dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; cand.push([cx + dx, cy + dy, -(dx * dirX + dy * dirY) * 0.2 + Math.abs(dx - dy) * 0.1]); }
      cand.sort(function (a, b) { return a[2] - b[2]; });
      for (var i = 0; i < cand.length; i++) {
        var tx = cand[i][0] - (D.s >> 1), ty = cand[i][1] - (D.s >> 1);
        if (!g.canPlace(p, type, tx, ty).ok || !this._margin(tx, ty, D.s)) continue;
        var free = workers.filter(function (u) { return !u.carry && u.ord.t !== 'build' && u.ord.t !== 'plant'; });
        var pool = free.length ? free : workers.filter(function (u) { return u.ord.t !== 'build' && u.ord.t !== 'plant'; }); if (!pool.length) return false;
        pool.sort(function (a, b) { return Math.hypot(a.x - (tx + 1) * T, a.y - (ty + 1) * T) - Math.hypot(b.x - (tx + 1) * T, b.y - (ty + 1) * T); });
        var ok = g.cmd(p, { t: 'build', ids: [pool[0].id], type: type, tx: tx, ty: ty });
        if (ok) { this.log.push([Math.round(this.t), type]); return true; }
      }
    }
    return false;
  };
  AI.prototype._margin = function (tx, ty, s) {
    var g = this.g;
    for (var x = tx - 1; x <= tx + s; x++) for (var y = ty - 1; y <= ty + s; y++) { if (x >= tx && x < tx + s && y >= ty && y < ty + s) continue; if (!g.inMap(x, y) || g.occ[y * g.MW + x]) return false; }
    // не загораживать месторождения
    for (var i = 0; i < g.ents.length; i++) { var n = g.ents[i]; if (n.kind === 'n' && n.tx >= tx - 2 && n.tx <= tx + s + 1 && n.ty >= ty - 2 && n.ty <= ty + s + 1) return false; }
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
