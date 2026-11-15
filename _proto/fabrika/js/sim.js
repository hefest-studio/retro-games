/* ЛЕНТОВОД · js/sim.js — логика без DOM: карта-сетка, постройки, ленты, станки, оборона, армия, волны, A*.
   Фиксированный тик TICK (1/20 с). Всё состояние — в объекте мира W; рендер и ввод его только читают
   (кроме команд place/remove/order). Подключается в браузере и в node:vm (тесты). → window.LENTOVOD.sim */
(function (root) {
  'use strict';
  var LV = root.LENTOVOD = root.LENTOVOD || {};
  var TICK = 1 / 20;
  var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];          // 0 → восток, 1 → юг, 2 → запад, 3 → север
  var GROUND = 0, ROCK = 1, TREE = 2;
  var ORE = [null, 'cu', 'coal', 'sand'];               // код жилы → предмет
  var ITEMS = ['cu', 'coal', 'sand', 'ingot', 'glass', 'gear'];
  var BELT_CAP = 3, BELT_SP = 0.34, BELT_V = 2.0;       // предметов на клетку, мин. зазор, скорость (клеток/с)

  // Постройки. cost — из запаса Мастерской; recipe — станок; line — можно тянуть линией.
  var BLD = {
    drill:      { w: 1, h: 1, cost: { ingot: 4 }, hp: 60, rot: true, period: 1.2 },
    belt:       { w: 1, h: 1, cost: { ingot: 1 }, hp: 30, rot: true, line: true },
    splitter:   { w: 1, h: 1, cost: { ingot: 2 }, hp: 40, rot: true },
    sorter:     { w: 1, h: 1, cost: { ingot: 3 }, hp: 40, rot: true },
    bridge:     { w: 1, h: 1, cost: { ingot: 3 }, hp: 40, rot: true, reach: 5, delay: 0.5 },
    smelter:    { w: 2, h: 2, cost: { ingot: 10 }, hp: 150, recipe: { in: { cu: 1, coal: 1 }, out: 'ingot', time: 2 } },
    glassworks: { w: 2, h: 2, cost: { ingot: 12 }, hp: 150, recipe: { in: { sand: 2, coal: 1 }, out: 'glass', time: 2.5 } },
    gearmill:   { w: 2, h: 2, cost: { ingot: 12 }, hp: 150, recipe: { in: { ingot: 2 }, out: 'gear', time: 2 } },
    assembly:   { w: 2, h: 2, cost: { ingot: 20, glass: 4 }, hp: 200, recipe: { in: { ingot: 3, gear: 2, glass: 1 }, out: 'mech', time: 6 } },
    turret:     { w: 1, h: 1, cost: { ingot: 8 }, hp: 140, range: 5.5, dmg: 12, cd: 0.5, shotsPer: 3, maxShots: 30 },
    wall:       { w: 1, h: 1, cost: { ingot: 2 }, hp: 240, line: true },
    hall:       { w: 3, h: 3, hp: 1500, fixed: true, range: 4.5, dmg: 6, cd: 1 }, // Мастерская (склад + слабая своя пушка; падение — поражение)
    mound:      { w: 3, h: 3, hp: 3200, fixed: true, owner: 1, range: 6.5, dmg: 14, cd: 0.7 } // Ржавый курган (цель)
  };
  var ORDER = ['drill', 'belt', 'splitter', 'sorter', 'bridge', 'smelter', 'glassworks', 'gearmill', 'assembly', 'turret', 'wall'];
  var FOES = {
    crawler: { hp: 40, spd: 1.5, dmg: 6, hit: 1.0, score: 10 },
    brute:   { hp: 170, spd: 0.8, dmg: 26, hit: 1.2, score: 30 }
  };
  var MECH = { hp: 120, spd: 1.7, dmg: 11, cd: 0.8, range: 3.4 };

  function rng(seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- мир ----------
  function newWorld(o) {
    o = o || {};
    var w = o.w || 72, h = o.h || 44;
    var W = {
      w: w, h: h, t: new Uint8Array(w * h), ore: new Uint8Array(w * h), occ: new Int32Array(w * h),
      blds: [], byId: Object.create(null), nextId: 1, bver: 1, tick: 0, time: 0,
      stock: { cu: 0, coal: 0, sand: 0, ingot: o.ingot == null ? 70 : o.ingot, glass: 0, gear: 0 },
      made: { cu: 0, coal: 0, sand: 0, ingot: 0, glass: 0, gear: 0, mech: 0 }, got: {},
      enemies: [], units: [], fx: [], events: [], spawnQ: [], spawnT: 0,
      wave: 0, nextWave: o.firstWave == null ? 180 : o.firstWave, waveGap: 80, waves: o.waves !== false,
      rally: null, winner: -1, kills: 0, score: 0, hall: null, mound: null, guardT: 0,
      pathBudget: 0, pathCalls: 0, rnd: rng(o.seed || 7)
    };
    if (!o.empty) genMap(W, o.seed || 7);
    return W;
  }
  function idx(W, x, y) { return y * W.w + x; }
  function inb(W, x, y) { return x >= 0 && y >= 0 && x < W.w && y < W.h; }
  function bAt(W, x, y) { if (!inb(W, x, y)) return null; var id = W.occ[y * W.w + x]; return id ? W.byId[id] : null; }

  function genMap(W, seed) {
    var R = rng(seed * 7919 + 13), w = W.w, h = W.h, x, y, i, k;
    var HX = 6, HY = 19, MX = w - 9, MY = 19;
    var patches = [
      { t: 1, x: 13.5, y: 12.5, r: 2.8 }, { t: 2, x: 13.5, y: 28.5, r: 2.8 }, { t: 3, x: 20, y: 24, r: 2.3 },
      { t: 1, x: 33, y: 7, r: 3 }, { t: 2, x: 35, y: 37, r: 3 }, { t: 3, x: 44, y: 21, r: 2.6 }, { t: 1, x: 50, y: 33, r: 2.5 }, { t: 2, x: 27, y: 18, r: 2 }
    ];
    var clear = function (x, y) {
      if (Math.hypot(x - (HX + 1.5), y - (HY + 1.5)) < 11) return true;
      if (Math.hypot(x - (MX + 1.5), y - (MY + 1.5)) < 7) return true;
      if (x >= 9 && x <= 24 && y >= 9 && y <= 32) return true;
      for (var p = 0; p < patches.length; p++) if (Math.hypot(x + 0.5 - patches[p].x, y + 0.5 - patches[p].y) < patches[p].r + 1.2) return true;
      return false;
    };
    // скальные гряды в середине поля (проходы между ними — естественные коридоры)
    for (k = 0; k < 16; k++) {
      var cx = 26 + R() * 30, cy = 2 + R() * (h - 4), r = 1.2 + R() * 2.2;
      for (y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (x = Math.floor(cx - r - 2); x <= cx + r + 2; x++)
        if (inb(W, x, y) && Math.hypot((x + 0.5 - cx) * 0.7, y + 0.5 - cy) < r + R() * 0.4 && !clear(x, y)) W.t[idx(W, x, y)] = ROCK;
    }
    // рощи (дерево — непроходимо для стройки, ходоки продираются медленно)
    for (k = 0; k < 40; k++) {
      cx = R() * w; cy = R() * h; r = 0.8 + R() * 1.8;
      for (y = Math.floor(cy - r); y <= cy + r; y++) for (x = Math.floor(cx - r); x <= cx + r; x++)
        if (inb(W, x, y) && W.t[idx(W, x, y)] === GROUND && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r && R() < 0.75 && !clear(x, y)) W.t[idx(W, x, y)] = TREE;
    }
    for (k = 0; k < patches.length; k++) {
      var P = patches[k];
      for (y = Math.floor(P.y - P.r - 1); y <= P.y + P.r + 1; y++) for (x = Math.floor(P.x - P.r - 1); x <= P.x + P.r + 1; x++) {
        if (!inb(W, x, y)) continue; i = idx(W, x, y);
        if (Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y) < P.r + (R() - 0.5) * 0.6) { W.ore[i] = P.t; W.t[i] = GROUND; }
      }
    }
    placeFixed(W, 'hall', HX, HY); placeFixed(W, 'mound', MX, MY);
    W.rally = { x: 11.5, y: 25.5 };
  }

  // ---------- постройки ----------
  function placeFixed(W, type, x, y) {
    var b = makeBld(W, type, x, y, 0); if (type === 'hall') W.hall = b; if (type === 'mound') W.mound = b; return b;
  }
  function makeBld(W, type, x, y, dir) {
    var d = BLD[type], b = { id: W.nextId++, type: type, x: x, y: y, w: d.w, h: d.h, dir: dir || 0, hp: d.hp, maxhp: d.hp, owner: d.owner || 0 };
    if (type === 'belt') b.items = [];
    else if (type === 'drill') { b.tm = 0; b.out = null; }
    else if (type === 'splitter' || type === 'sorter') { b.buf = null; b.rr = 0; if (type === 'sorter') b.filter = 'cu'; }
    else if (type === 'bridge') { b.q = []; b.out = []; b.pv = -1; b.pr = null; }
    else if (type === 'turret') { b.shots = 0; b.cd = 0; }
    else if (type === 'mound' || type === 'hall') { b.cd = 0; }
    if (d.recipe) { b.inb = {}; b.outb = 0; b.run = false; b.prog = 0; b.po = 0; }
    if (d.recipe || type === 'hall') b.per = perimeter(b);
    for (var j = 0; j < b.h; j++) for (var i = 0; i < b.w; i++) W.occ[idx(W, x + i, y + j)] = b.id;
    W.blds.push(b); W.byId[b.id] = b; W.bver++;
    return b;
  }
  // клетки вокруг постройки: {x,y} — сосед, {sx,sy} — своя крайняя клетка, d — направление наружу
  function perimeter(b) {
    var out = [], i;
    for (i = 0; i < b.w; i++) { out.push({ x: b.x + i, y: b.y - 1, sx: b.x + i, sy: b.y, d: 3 }); out.push({ x: b.x + i, y: b.y + b.h, sx: b.x + i, sy: b.y + b.h - 1, d: 1 }); }
    for (i = 0; i < b.h; i++) { out.push({ x: b.x - 1, y: b.y + i, sx: b.x, sy: b.y + i, d: 2 }); out.push({ x: b.x + b.w, y: b.y + i, sx: b.x + b.w - 1, sy: b.y + i, d: 0 }); }
    return out;
  }
  function afford(W, type) { var c = BLD[type].cost || {}; for (var k in c) if ((W.stock[k] || 0) < c[k]) return false; return true; }
  // '' — можно; иначе причина: bounds | busy | terrain | ore | enemy | cost
  function canPlace(W, type, x, y, o) {
    var d = BLD[type]; if (!d || d.fixed) return 'bounds';
    for (var j = 0; j < d.h; j++) for (var i = 0; i < d.w; i++) {
      var a = x + i, c = y + j; if (!inb(W, a, c)) return 'bounds';
      var k = idx(W, a, c); if (W.occ[k]) return 'busy'; if (W.t[k] !== GROUND) return 'terrain';
      if (type === 'drill' && !W.ore[k]) return 'ore';
    }
    if (W.mound && Math.hypot(x + d.w / 2 - (W.mound.x + 1.5), y + d.h / 2 - (W.mound.y + 1.5)) < 9) return 'enemy';
    if (!(o && o.free) && !afford(W, type)) return 'cost';
    return '';
  }
  function place(W, type, x, y, dir, o) {
    if (canPlace(W, type, x, y, o)) return null;
    if (!(o && o.free)) { var c = BLD[type].cost || {}; for (var k in c) W.stock[k] -= c[k]; }
    var b = makeBld(W, type, x, y, dir); W.events.push({ t: 'place', type: type, x: x, y: y }); return b;
  }
  function destroy(W, b, refund) {
    if (!W.byId[b.id]) return;
    for (var j = 0; j < b.h; j++) for (var i = 0; i < b.w; i++) W.occ[idx(W, b.x + i, b.y + j)] = 0;
    delete W.byId[b.id]; var k = W.blds.indexOf(b); if (k >= 0) W.blds.splice(k, 1); W.bver++;
    if (refund) { var c = BLD[b.type].cost || {}; for (var s in c) W.stock[s] += c[s]; }
    W.events.push({ t: refund ? 'remove' : 'lost', type: b.type, x: b.x + b.w / 2, y: b.y + b.h / 2, owner: b.owner });
    if (b === W.hall) { W.hall = null; if (W.winner < 0) W.winner = 1; }
    if (b === W.mound) { W.mound = null; if (W.winner < 0) { W.winner = 0; W.score += 1000 + Math.max(0, Math.round(1500 - W.time)); } }
  }
  function remove(W, x, y) { var b = bAt(W, x, y); if (!b || BLD[b.type].fixed) return false; destroy(W, b, true); return true; }
  function hurt(W, b, dmg) { b.hp -= dmg; if (b.hp <= 0) destroy(W, b, false); }

  // Клетки линии: сначала вдоль большей оси, потом вдоль меньшей. dir каждой клетки — куда идёт линия дальше.
  function lineCells(x0, y0, x1, y1, dir0) {
    var out = [], x = x0, y = y0, hx = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
    var sx = x1 > x0 ? 0 : 2, sy = y1 > y0 ? 1 : 3, last = dir0 || 0;
    var steps = [];
    if (hx) { for (var i = 0; i < Math.abs(x1 - x0); i++) steps.push(sx); for (i = 0; i < Math.abs(y1 - y0); i++) steps.push(sy); }
    else { for (i = 0; i < Math.abs(y1 - y0); i++) steps.push(sy); for (i = 0; i < Math.abs(x1 - x0); i++) steps.push(sx); }
    if (!steps.length) return [{ x: x0, y: y0, dir: last }];
    for (i = 0; i < steps.length; i++) { out.push({ x: x, y: y, dir: steps[i] }); x += DX[steps[i]]; y += DY[steps[i]]; last = steps[i]; }
    out.push({ x: x, y: y, dir: last });
    return out;
  }
  // Поставить линию: на своих лентах того же типа меняется только направление (бесплатно). → число новых построек
  function placeLine(W, type, cells, o) {
    var n = 0;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], ex = bAt(W, c.x, c.y);
      if (ex && ex.type === type && BLD[type].rot) { if (ex.dir !== c.dir) { ex.dir = c.dir; W.bver++; } continue; }
      if (place(W, type, c.x, c.y, c.dir, o)) n++;
    }
    return n;
  }

  // ---------- передача предметов ----------
  function offer(W, sx, sy, d, it) { var tx = sx + DX[d], ty = sy + DY[d], b = bAt(W, tx, ty); return b ? accept(W, b, it, sx, sy) : false; }
  function accept(W, b, it, sx, sy) {
    var n, d = BLD[b.type];
    switch (b.type) {
      case 'belt':
        if (b.x + DX[b.dir] === sx && b.y + DY[b.dir] === sy) return false; // лента не берёт со своего выхода
        n = b.items.length; if (n >= BELT_CAP || (n && b.items[n - 1].p < BELT_SP)) return false;
        b.items.push({ t: it, p: 0, m: W.tick }); return true;
      case 'splitter': case 'sorter':
        if (b.x - DX[b.dir] !== sx || b.y - DY[b.dir] !== sy || b.buf) return false; // вход — только сзади
        b.buf = it; b.bm = W.tick; return true;
      case 'bridge':
        if (!partner(W, b) || (b.x + DX[b.dir] === sx && b.y + DY[b.dir] === sy) || b.q.length >= 4) return false;
        b.q.push({ t: it, d: d.delay }); return true;
      case 'turret':
        if (it !== 'ingot' || b.shots > d.maxShots - d.shotsPer) return false; b.shots += d.shotsPer; return true;
      case 'hall':
        W.stock[it] = (W.stock[it] || 0) + 1; W.got[it] = (W.got[it] || 0) + 1; return true;
      default:
        var r = d.recipe; if (!r || !r.in[it] || (b.inb[it] || 0) >= r.in[it] * 3) return false;
        b.inb[it] = (b.inb[it] || 0) + 1; return true;
    }
  }
  // Пара моста: первая постройка-мост того же направления впереди (2…reach клеток)
  function partner(W, b) {
    if (b.pv === W.bver) return b.pr;
    b.pv = W.bver; b.pr = null;
    for (var k = 2; k <= BLD.bridge.reach; k++) { var o = bAt(W, b.x + DX[b.dir] * k, b.y + DY[b.dir] * k); if (o && o.type === 'bridge') { if (o.dir === b.dir) b.pr = o; break; } }
    return b.pr;
  }

  function stepBelt(W, b, dt) {
    var a = b.items, v = BELT_V * dt;
    for (var i = 0; i < a.length; i++) {
      var o = a[i]; if (o.m === W.tick) continue;
      var lim = i === 0 ? 1 : a[i - 1].p - BELT_SP, np = o.p + v;
      o.p = np > lim ? Math.max(o.p, lim) : np;
    }
    if (a.length && a[0].p >= 1 && a[0].m !== W.tick && offer(W, b.x, b.y, b.dir, a[0].t)) a.shift();
  }
  function stepMachine(W, b, dt) {
    var r = BLD[b.type].recipe, k;
    if (!b.run && b.outb < 3) {
      var okk = true; for (k in r.in) if ((b.inb[k] || 0) < r.in[k]) { okk = false; break; }
      if (okk) { for (k in r.in) b.inb[k] -= r.in[k]; b.run = true; b.prog = 0; }
    }
    if (b.run) {
      b.prog += dt;
      if (b.prog >= r.time) {
        if (r.out === 'mech') { if (spawnMech(W, b)) b.run = false; else b.prog = r.time; }
        else { b.outb++; b.run = false; W.made[r.out]++; W.events.push({ t: 'craft', type: b.type, x: b.x + 1, y: b.y + 1 }); }
      }
    }
    if (b.outb > 0) pushOut(W, b, r.out);
  }
  function pushOut(W, b, it) {
    var P = b.per, n = P.length;
    for (var k = 0; k < n; k++) {
      var c = P[(b.po + k) % n], tb = bAt(W, c.x, c.y);
      if (!tb || tb === b || tb.type === 'drill' || tb.type === 'wall' || tb.owner) continue;
      if (accept(W, tb, it, c.sx, c.sy)) { b.outb--; b.po = (b.po + k + 1) % n; return true; }
    }
    return false;
  }
  function stepSplit(W, b) {
    if (!b.buf || b.bm === W.tick) return;
    var outs = b.type === 'sorter' ? (b.buf === b.filter ? [b.dir] : [(b.dir + 3) % 4, (b.dir + 1) % 4]) : [b.dir, (b.dir + 3) % 4, (b.dir + 1) % 4];
    for (var k = 0; k < outs.length; k++) {
      var j = (b.rr + k) % outs.length;
      if (offer(W, b.x, b.y, outs[j], b.buf)) { b.buf = null; b.rr = (j + 1) % outs.length; return; }
    }
  }
  function stepBridge(W, b, dt) {
    var pr = partner(W, b);
    for (var i = 0; i < b.q.length; i++) b.q[i].d -= dt;
    if (b.q.length && b.q[0].d <= 0 && pr && W.byId[pr.id] && pr.out.length < 3) pr.out.push(b.q.shift().t);
    if (b.out.length && offer(W, b.x, b.y, b.dir, b.out[0])) b.out.shift();
  }

  // ---------- бой ----------
  function nearest(list, x, y, r) { var best = null, bd = r * r; for (var i = 0; i < list.length; i++) { var e = list[i]; if (e.hp <= 0) continue; var d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y); if (d <= bd) { bd = d; best = e; } } return best; }
  function shotFx(W, x1, y1, x2, y2, k) { W.fx.push({ x1: x1, y1: y1, x2: x2, y2: y2, k: k, life: 0.14 }); W.events.push({ t: 'shot', k: k, x: x1, y: y1 }); }
  function stepTurret(W, b, dt) {
    var d = BLD.turret; b.cd -= dt;
    if (b.cd > 0 || b.shots <= 0) return;
    var e = nearest(W.enemies, b.x + 0.5, b.y + 0.5, d.range); if (!e) return;
    e.hp -= d.dmg; b.shots--; b.cd = d.cd; shotFx(W, b.x + 0.5, b.y + 0.5, e.x, e.y, 'turret');
  }
  function stepHall(W, b, dt) { // своя пушка Мастерской — без боеприпаса, но слабая: последний рубеж, не замена пушкам
    var d = BLD.hall; b.cd -= dt; if (b.cd > 0) return;
    var e = nearest(W.enemies, b.x + 1.5, b.y + 1.5, d.range); if (!e) return;
    e.hp -= d.dmg; b.cd = d.cd; shotFx(W, b.x + 1.5, b.y + 0.5, e.x, e.y, 'hall');
  }
  function rectDist(x, y, b) { var dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h)); return Math.hypot(dx, dy); }
  function stepMound(W, b, dt) {
    var d = BLD.mound, cx = b.x + 1.5, cy = b.y + 1.5; b.cd -= dt;
    if (b.cd <= 0) {
      var u = nearest(W.units, cx, cy, d.range);
      if (u) { u.hp -= d.dmg; b.cd = d.cd; shotFx(W, cx, cy, u.x, u.y, 'mound'); }
    }
    W.guardT -= dt;
    if (W.guardT <= 0 && nearest(W.units, cx, cy, 12)) { W.guardT = 22; for (var i = 0; i < 3; i++) W.spawnQ.push('crawler'); }
  }
  function spawnFoe(W, kind) {
    var m = W.mound; if (!m) return null;
    var P = perimeter(m).filter(function (c) { return inb(W, c.x, c.y) && W.t[idx(W, c.x, c.y)] !== ROCK && !W.occ[idx(W, c.x, c.y)] && c.d !== 0; });
    if (!P.length) return null;
    var c = P[Math.floor(W.rnd() * P.length)], f = FOES[kind];
    var e = { kind: kind, x: c.x + 0.5, y: c.y + 0.5, hp: f.hp, maxhp: f.hp, cd: 0, path: null, pi: 0, pv: -1 };
    W.enemies.push(e); return e;
  }
  function stepFoe(W, e, dt) {
    var f = FOES[e.kind]; e.cd -= dt;
    var u = nearest(W.units, e.x, e.y, 0.95);
    if (u) { if (e.cd <= 0) { u.hp -= f.dmg; e.cd = f.hit; shotFx(W, e.x, e.y, u.x, u.y, 'bite'); } return; }
    if (!W.hall) return;
    if ((!e.path || e.pv !== W.bver) && W.pathBudget > 0) {
      W.pathBudget--; e.path = findPath(W, Math.floor(e.x), Math.floor(e.y), W.hall, 'foe'); e.pi = 0; e.pv = W.bver;
    }
    if (!e.path) return;
    var c = e.path[e.pi];
    if (!c) { if (e.cd <= 0) { hurt(W, W.hall, f.dmg); e.cd = f.hit; } return; }
    var b = bAt(W, c.x, c.y);
    if (b && b.owner === 0) { if (e.cd <= 0) { hurt(W, b, f.dmg); e.cd = f.hit; shotFx(W, e.x, e.y, c.x + 0.5, c.y + 0.5, 'bite'); } return; }
    moveTo(e, c.x + 0.5, c.y + 0.5, f.spd * (W.t[idx(W, c.x, c.y)] === TREE ? 0.5 : 1) * dt, function () { e.pi++; });
  }
  function moveTo(o, tx, ty, s, arrived) {
    var dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
    if (d <= s) { o.x = tx; o.y = ty; arrived(); } else { o.x += dx / d * s; o.y += dy / d * s; }
  }
  function spawnMech(W, b) {
    if (W.units.length >= 40) return false;
    for (var k = 0; k < b.per.length; k++) {
      var c = b.per[k]; if (!inb(W, c.x, c.y)) continue;
      var i = idx(W, c.x, c.y), o = W.occ[i] && W.byId[W.occ[i]];
      if (W.t[i] === ROCK || (o && o.type !== 'belt' && o.type !== 'bridge')) continue;
      W.units.push({ x: c.x + 0.5, y: c.y + 0.5, hp: MECH.hp, maxhp: MECH.hp, cd: 0, mode: 'rally', path: null, pi: 0, pv: -1, gk: '' });
      W.made.mech++; W.events.push({ t: 'mech', x: c.x, y: c.y }); return true;
    }
    return false;
  }
  function stepMech(W, u, dt) {
    u.cd -= dt;
    var e = nearest(W.enemies, u.x, u.y, MECH.range);
    if (e) { if (u.cd <= 0) { e.hp -= MECH.dmg; u.cd = MECH.cd; shotFx(W, u.x, u.y, e.x, e.y, 'mech'); } return; }
    var m = W.mound;
    if (u.mode === 'attack' && m && rectDist(u.x, u.y, m) <= MECH.range - 0.6) { if (u.cd <= 0) { hurt(W, m, MECH.dmg); u.cd = MECH.cd; shotFx(W, u.x, u.y, m.x + 1.5, m.y + 1.5, 'mech'); } return; }
    var goal = u.mode === 'attack' && m ? m : W.rally ? { x: Math.floor(W.rally.x), y: Math.floor(W.rally.y), w: 1, h: 1 } : null;
    if (!goal) return;
    var gk = goal.x + ',' + goal.y + ',' + u.mode;
    if ((!u.path || u.pv !== W.bver || u.gk !== gk) && W.pathBudget > 0) {
      W.pathBudget--; u.path = findPath(W, Math.floor(u.x), Math.floor(u.y), goal, 'mech'); u.pi = 0; u.pv = W.bver; u.gk = gk;
    }
    if (!u.path) return;
    var c = u.path[u.pi]; if (!c) return;
    if (u.mode === 'attack' && m && c.x >= m.x && c.y >= m.y && c.x < m.x + 3 && c.y < m.y + 3) return;
    moveTo(u, c.x + 0.5, c.y + 0.5, MECH.spd * dt, function () { u.pi++; });
  }
  function separate(W) {
    var U = W.units;
    for (var i = 0; i < U.length; i++) for (var j = i + 1; j < U.length; j++) {
      var a = U[i], b = U[j], dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy;
      if (d < 0.36 && d > 1e-6) { d = Math.sqrt(d); var p = (0.6 - d) * 0.25 / d; tryShift(W, a, -dx * p, -dy * p); tryShift(W, b, dx * p, dy * p); }
      else if (d <= 1e-6) tryShift(W, b, 0.05, 0.03);
    }
  }
  function tryShift(W, u, dx, dy) { var nx = u.x + dx, ny = u.y + dy; if (cellCost(W, Math.floor(nx), Math.floor(ny), 'mech') > 0) { u.x = nx; u.y = ny; } }
  function orderAttack(W) { var n = 0; W.units.forEach(function (u) { if (u.mode !== 'attack') { u.mode = 'attack'; u.path = null; n++; } }); W.events.push({ t: 'charge', n: n }); return n; }
  function setRally(W, x, y) { W.rally = { x: x, y: y }; W.units.forEach(function (u) { u.mode = 'rally'; u.path = null; }); }

  // ---------- A* (4 соседа, манхэттен до прямоугольника цели) ----------
  // cellCost: 0 — непроходимо. Ржавь идёт сквозь постройки игрока (и грызёт их), механизмы — только по лентам/мостам.
  function cellCost(W, x, y, who) {
    if (!inb(W, x, y)) return 0; var i = y * W.w + x, t = W.t[i]; if (t === ROCK) return 0;
    var id = W.occ[i];
    if (id) {
      var b = W.byId[id]; if (b.owner === 1) return 1;
      if (who === 'foe') return b.type === 'belt' ? 4 : b.type === 'wall' ? 16 : 9;
      return b.type === 'belt' || b.type === 'bridge' ? 1 : 0;
    }
    return t === TREE ? 3 : 1;
  }
  var heap = { i: new Int32Array(1 << 14), f: new Float64Array(1 << 14), n: 0 };
  function hpush(i, f) {
    if (heap.n >= heap.i.length) { var ni = new Int32Array(heap.i.length * 2), nf = new Float64Array(heap.i.length * 2); ni.set(heap.i); nf.set(heap.f); heap.i = ni; heap.f = nf; }
    var k = heap.n++; while (k > 0) { var p = (k - 1) >> 1; if (heap.f[p] <= f) break; heap.i[k] = heap.i[p]; heap.f[k] = heap.f[p]; k = p; } heap.i[k] = i; heap.f[k] = f;
  }
  function hpop() {
    var top = heap.i[0], li = heap.i[--heap.n], lf = heap.f[heap.n], k = 0;
    while (true) { var c = 2 * k + 1; if (c >= heap.n) break; if (c + 1 < heap.n && heap.f[c + 1] < heap.f[c]) c++; if (heap.f[c] >= lf) break; heap.i[k] = heap.i[c]; heap.f[k] = heap.f[c]; k = c; }
    heap.i[k] = li; heap.f[k] = lf; return top;
  }
  function findPath(W, sx, sy, g, who) {
    W.pathCalls++;
    var w = W.w, N = w * W.h;
    if (!W._g || W._g.length !== N) { W._g = new Float64Array(N); W._from = new Int32Array(N); W._st = new Uint32Array(N); W._cl = new Uint32Array(N); W._stamp = 0; }
    var G = W._g, F = W._from, ST = W._st, CL = W._cl, s = ++W._stamp;
    var inG = function (x, y) { return x >= g.x && y >= g.y && x < g.x + g.w && y < g.y + g.h; };
    var hh = function (x, y) { return Math.max(g.x - x, 0, x - (g.x + g.w - 1)) + Math.max(g.y - y, 0, y - (g.y + g.h - 1)); };
    if (inG(sx, sy)) return [];
    if (!inb(W, sx, sy)) return null;
    heap.n = 0; var si = sy * w + sx; G[si] = 0; F[si] = -1; ST[si] = s; hpush(si, hh(sx, sy));
    var found = -1, exp = 0;
    while (heap.n) {
      var ci = hpop(); if (CL[ci] === s) continue; CL[ci] = s;
      var cx = ci % w, cy = (ci - cx) / w;
      if (inG(cx, cy)) { found = ci; break; }
      if (++exp > 6000) break;
      for (var d = 0; d < 4; d++) {
        var nx = cx + DX[d], ny = cy + DY[d], c = cellCost(W, nx, ny, who); if (!c) continue;
        var ni = ny * w + nx, ng = G[ci] + c;
        if (ST[ni] !== s || ng < G[ni]) { ST[ni] = s; G[ni] = ng; F[ni] = ci; hpush(ni, ng + hh(nx, ny)); }
      }
    }
    if (found < 0) return null;
    var path = [];
    for (var p = found; p !== si; p = F[p]) path.push({ x: p % w, y: Math.floor(p / w) });
    return path.reverse();
  }

  // ---------- волны ----------
  function waveSize(n) { return { crawler: 3 + 2 * n, brute: Math.floor(n / 2) }; }
  function stepWaves(W, dt) {
    if (W.waves && W.mound && W.time >= W.nextWave) {
      W.wave++; var s = waveSize(W.wave), i;
      for (i = 0; i < s.crawler; i++) W.spawnQ.push('crawler');
      for (i = 0; i < s.brute; i++) W.spawnQ.push('brute');
      W.nextWave += Math.max(55, W.waveGap - W.wave * 2);
      W.events.push({ t: 'wave', n: W.wave });
    }
    W.spawnT -= dt;
    if (W.spawnQ.length && W.spawnT <= 0) { spawnFoe(W, W.spawnQ.shift()); W.spawnT = 0.45; }
  }

  // ---------- шаг мира ----------
  function step(W, dt) {
    dt = dt || TICK;
    if (W.winner >= 0) return;
    W.tick++; W.time += dt; W.pathBudget = 8;
    var B = W.blds.slice(), i, b;
    for (i = 0; i < B.length; i++) {
      b = B[i]; if (!W.byId[b.id]) continue;
      switch (b.type) {
        case 'belt': stepBelt(W, b, dt); break;
        case 'drill':
          if (!b.out) { b.tm += dt; if (b.tm >= BLD.drill.period) { b.tm -= BLD.drill.period; b.out = ORE[W.ore[idx(W, b.x, b.y)]]; W.made[b.out]++; } }
          if (b.out && offer(W, b.x, b.y, b.dir, b.out)) b.out = null; break;
        case 'splitter': case 'sorter': stepSplit(W, b); break;
        case 'bridge': stepBridge(W, b, dt); break;
        case 'turret': stepTurret(W, b, dt); break;
        case 'mound': stepMound(W, b, dt); break;
        case 'hall': stepHall(W, b, dt); break;
        default: if (BLD[b.type].recipe) stepMachine(W, b, dt);
      }
    }
    stepWaves(W, dt);
    for (i = 0; i < W.enemies.length; i++) if (W.enemies[i].hp > 0) stepFoe(W, W.enemies[i], dt);
    for (i = 0; i < W.units.length; i++) if (W.units[i].hp > 0) stepMech(W, W.units[i], dt);
    if (W.units.length > 1) separate(W);
    for (i = W.enemies.length - 1; i >= 0; i--) { var e = W.enemies[i]; if (e.hp <= 0) { W.enemies.splice(i, 1); W.kills++; W.score += FOES[e.kind].score; W.events.push({ t: 'die', k: 'foe', x: e.x, y: e.y }); } }
    for (i = W.units.length - 1; i >= 0; i--) { var u = W.units[i]; if (u.hp <= 0) { W.units.splice(i, 1); W.events.push({ t: 'die', k: 'mech', x: u.x, y: u.y }); } }
    for (i = W.fx.length - 1; i >= 0; i--) { W.fx[i].life -= dt; if (W.fx[i].life <= 0) W.fx.splice(i, 1); }
  }

  // ---------- учёт предметов (для тестов и подсказок) ----------
  function itemsInTransit(W) {
    var n = 0;
    W.blds.forEach(function (b) {
      if (b.items) n += b.items.length;
      if (b.out && typeof b.out === 'string') n++;
      if (b.buf) n++;
      if (b.q) n += b.q.length + b.out.length;
    });
    return n;
  }

  // Готовая демо-мастерская у старта (скриншоты, производительность, «?demo=1»): медь+уголь → плавильня → Мастерская,
  // песок+уголь → стекольня, слитки → шестерни, сборочный цех, пушки с подачей слитков через сортировщик.
  function demoLayout(W) {
    var F = { free: true }, i;
    for (i = 12; i <= 15; i++) place(W, 'drill', i, 12, 1, F);
    placeLine(W, 'belt', lineCells(15, 13, 13, 13), F); placeLine(W, 'belt', lineCells(12, 13, 12, 19), F);
    for (i = 13; i <= 15; i++) place(W, 'drill', i, 29, 3, F);
    placeLine(W, 'belt', lineCells(12, 28, 12, 28, 0), F); placeLine(W, 'belt', lineCells(15, 28, 14, 28), F); placeLine(W, 'belt', lineCells(13, 28, 13, 22), F);
    place(W, 'smelter', 12, 20, 0, F);
    placeLine(W, 'belt', lineCells(11, 20, 9, 20), F);
    place(W, 'turret', 11, 17, 0, F); place(W, 'turret', 16, 22, 0, F); place(W, 'turret', 22, 15, 0, F);
    place(W, 'glassworks', 20, 21, 0, F); place(W, 'drill', 20, 23, 3, F); place(W, 'drill', 21, 23, 3, F);
    place(W, 'gearmill', 16, 16, 0, F); place(W, 'assembly', 16, 26, 0, F);
    for (i = 0; i < 5; i++) place(W, 'wall', 24, 17 + i, 0, F);
    W.blds.forEach(function (b) { if (b.type === 'turret') b.shots = 20; });
  }

  LV.sim = {
    TICK: TICK, DX: DX, DY: DY, GROUND: GROUND, ROCK: ROCK, TREE: TREE, ORE: ORE, ITEMS: ITEMS, BLD: BLD, ORDER: ORDER, FOES: FOES, MECH: MECH,
    BELT_CAP: BELT_CAP, BELT_SP: BELT_SP, BELT_V: BELT_V,
    newWorld: newWorld, genMap: genMap, placeFixed: placeFixed, canPlace: canPlace, place: place, remove: remove, destroy: destroy, hurt: hurt,
    afford: afford, lineCells: lineCells, placeLine: placeLine, bAt: bAt, offer: offer, accept: accept, partner: partner,
    findPath: findPath, cellCost: cellCost, spawnFoe: spawnFoe, spawnMech: spawnMech, orderAttack: orderAttack, setRally: setRally,
    waveSize: waveSize, step: step, itemsInTransit: itemsInTransit, demoLayout: demoLayout, rng: rng
  };
})(typeof window !== 'undefined' ? window : globalThis);
