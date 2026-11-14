/* ОПЕРАЦИЯ · логика боя (без DOM, детерминирована по seed). OPERATSIYA.Game(opts), OPERATSIYA.logic.
   Пошаговая тактика на сетке 22×15: очки действия (ОД), обзор 160° и туман, укрытия, разрушаемые стены/ящики/двери,
   балконы (высота), выстрелы с шансом (прицельный / навскидку / очередь), реакционный огонь, гранаты-шестерни,
   «перегрев» (попадания копят жар → боец теряет часть ОД), ИИ Ржавого Совета, 7 целей миссий, «горячий стул».
   Все действия — мгновенные функции; перемещение и ход ИИ идут микрошагами через tick() (интерфейс анимирует). */
(function (global) {
  'use strict';
  var O = global.OPERATSIYA = global.OPERATSIYA || {};
  var MW = 22, MH = 15, VIS = 11, FOV_HALF = 80 * Math.PI / 180 + 1e-6;
  var T = { FLOOR: 0, WALL: 1, BRICK: 2, CRATE: 3, DOOR: 4, OPEN: 5, RUBBLE: 6, PIT: 7, BALC: 8, LADDER: 9, EXIT: 10, ZONE: 11, CORE: 12 };
  var CH = { '#': T.WALL, 'w': T.BRICK, 'c': T.CRATE, 'D': T.DOOR, '~': T.PIT, 'B': T.BALC, 'H': T.LADDER, 'E': T.EXIT, 'Z': T.ZONE, 'K': T.CORE };
  var PASS = [1, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0];
  var OPAQUE = [0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  var COVER = [0, 2, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 1];
  var TILE_HP = { 2: 4, 3: 3, 4: 3, 5: 3 };
  function elevOf(t) { return t === T.BALC ? 1 : 0; }

  // Инструменты-излучатели мастерской. w — вес, opt — дальность без штрафа, fall — штраф меткости за клетку сверх opt.
  var WEAPONS = {
    pistol: { id: 'pistol', dmg: 3, clip: 8, w: 2, acc: 0, opt: 5, fall: 2, burst: false, wall: 1 },
    rivet: { id: 'rivet', dmg: 4, clip: 12, w: 5, acc: 5, opt: 7, fall: 2, burst: true, wall: 1 },
    cutter: { id: 'cutter', dmg: 6, clip: 6, w: 8, acc: -6, opt: 5, fall: 3, burst: true, wall: 3 },
    spark: { id: 'spark', dmg: 5, clip: 6, w: 4, acc: 10, opt: 3, fall: 6, burst: false, wall: 2 }
  };
  var WEAPON_LIST = ['rivet', 'pistol', 'spark', 'cutter'];
  var COST = { ortho: 2, diag: 3, crouchMove: 1, ladder: 2, turn: 1, aimed: 12, snap: 7, burst: 10, crouch: 2, reload: 6, pickup: 3, door: 3, gear: 8, kit: 4, hack: 8, free: 3, evac: 2 };
  var MODE_ACC = { aimed: 10, snap: -10, burst: -18 };
  var KIND = {
    scout: { hp: 7, acc: 50, ap: 24, stam: 40, weapon: 'pistol', gear: 0, score: 100 },
    trooper: { hp: 10, acc: 56, ap: 24, stam: 50, weapon: 'rivet', gear: 0, score: 120 },
    heavy: { hp: 16, acc: 52, ap: 20, stam: 80, weapon: 'cutter', gear: 0, score: 180 },
    grenadier: { hp: 8, acc: 48, ap: 24, stam: 45, weapon: 'pistol', gear: 3, score: 150 },
    boss: { hp: 30, acc: 62, ap: 26, stam: 90, weapon: 'cutter', gear: 2, score: 600 },
    master: { hp: 12, acc: 30, ap: 22, stam: 30, weapon: null, gear: 0, score: 0 }
  };
  var MARK = { r: 'scout', k: 'trooper', h: 'heavy', g: 'grenadier', P: 'boss', q: 'trooper', j: 'grenadier' };
  var DIFF = { easy: { acc: -8, hp: -1, heat: 0.8, ap: -2 }, normal: { acc: 0, hp: 0, heat: 1, ap: 0 }, hard: { acc: 6, hp: 1, heat: 1.15, ap: 2 } };
  var ITEM_OF = { '1': 'clip', '2': 'kit', '3': 'gear' };

  function Rng(s) { this.s = s >>> 0; }
  Rng.prototype.f = function () { var a = this.s = (this.s + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function mulberry32(a) { var r = new Rng(a); return function () { return r.f(); }; }

  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function inside(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH; }
  function dirTo(ax, ay, bx, by) { return ((Math.round(Math.atan2(by - ay, bx - ax) / (Math.PI / 4)) % 8) + 8) % 8; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- Линия видимости (симметричная) ----------
  // Точки линии центр→центр берутся в точной рациональной арифметике: k-я точка A→B совпадает с (n−k)-й B→A,
  // поэтому набор клеток одинаков в обе стороны. Концы не проверяются; диагональный «зазор» между двумя
  // непрозрачными клетками закрыт.
  function losT(t, x0, y0, x1, y1) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    if (n <= 2) return !(x0 !== x1 && y0 !== y1 && OPAQUE[t[y0 * MW + x1]] && OPAQUE[t[y1 * MW + x0]]);
    var px = x0, py = y0;
    for (var k = 1; k < n; k++) {
      var cx = Math.floor((2 * (x0 * (n - k) + x1 * k) + n) / (2 * n)), cy = Math.floor((2 * (y0 * (n - k) + y1 * k) + n) / (2 * n));
      if (cx === px && cy === py) continue;
      if (cx !== px && cy !== py && OPAQUE[t[py * MW + cx]] && OPAQUE[t[cy * MW + px]]) return false;
      if (!(cx === x1 && cy === y1) && !(cx === x0 && cy === y0) && OPAQUE[t[cy * MW + cx]]) return false;
      px = cx; py = cy;
    }
    return true;
  }
  function inFov(u, tx, ty) {
    if (tx === u.x && ty === u.y) return true;
    var a = Math.atan2(ty - u.y, tx - u.x) - u.face * Math.PI / 4;
    while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    return Math.abs(a) <= FOV_HALF;
  }
  function onBoard(u) { return u.alive && !u.evac; }
  function seesTile(S, u, tx, ty) {
    var d = dist(u.x, u.y, tx, ty); if (d > VIS) return false;
    if (d > 1.5 && !inFov(u, tx, ty)) return false;
    return losT(S.t, u.x, u.y, tx, ty);
  }
  function unitSees(S, u, v) { return onBoard(u) && !u.captive && onBoard(v) && seesTile(S, u, v.x, v.y); }

  // ---------- Укрытие и шанс попадания ----------
  // Укрытие цели (tx,ty) от стрелка (sx,sy): 0 нет, 1 половинное (ящик), 2 полное (стена у угла).
  function coverOf(S, tx, ty, sx, sy) {
    if (cheb(tx, ty, sx, sy) <= 1) return 0;   // в упор укрытие не спасает
    var dx = Math.sign(sx - tx), dy = Math.sign(sy - ty), adx = Math.abs(sx - tx), ady = Math.abs(sy - ty), c = 0;
    if (dx && adx * 2 >= ady && inside(tx + dx, ty)) c = Math.max(c, COVER[S.t[ty * MW + tx + dx]]);
    if (dy && ady * 2 >= adx && inside(tx, ty + dy)) c = Math.max(c, COVER[S.t[(ty + dy) * MW + tx]]);
    if (dx && dy && inside(tx + dx, ty + dy)) c = Math.max(c, Math.min(1, COVER[S.t[(ty + dy) * MW + tx + dx]]));
    var es = elevOf(S.t[sy * MW + sx]), et = elevOf(S.t[ty * MW + tx]);
    if (es > et) c = Math.max(0, c - 1);          // сверху укрытие хуже
    else if (et > es) c = Math.max(c, 1);         // на балконе — перила
    return c;
  }
  // from — гипотетическая позиция стрелка {x,y} (для ИИ и подсказок); tg — юнит или клетка {x,y}.
  function hitChance(S, sh, tg, mode, from) {
    var W = WEAPONS[sh.weapon]; if (!W) return 0;
    var sx = from ? from.x : sh.x, sy = from ? from.y : sh.y, d = dist(sx, sy, tg.x, tg.y);
    var c = sh.acc + W.acc + (MODE_ACC[mode] || 0);
    if (sh.team === 1 && !S.hotseat) c += DIFF[S.diff].acc;
    c -= Math.max(0, d - W.opt) * W.fall;
    if (d <= 1.5) c += 10;
    var cov = coverOf(S, tg.x, tg.y, sx, sy);
    c -= cov === 2 ? 40 : cov === 1 ? 22 : 0;
    if (tg.crouch) c -= 8;
    if (sh.crouch && !from) c += 6;
    if (elevOf(S.t[sy * MW + sx]) > elevOf(S.t[tg.y * MW + tg.x])) c += 12;
    if (sh.heat >= 50) c -= 12;
    return Math.round(clamp(c, 5, 95));
  }

  // ---------- Снаряжение ----------
  function weightOf(u) { var W = WEAPONS[u.weapon]; return (W ? W.w : 0) + (u.gear | 0) + (u.kit | 0) + (u.clips | 0); }
  function limitOf(u) { return 6 + Math.floor((u.stam | 0) / 10); }
  function apFor(u) { return Math.max(10, (u.apBase | 0) - 2 * Math.max(0, weightOf(u) - limitOf(u))); }

  // ---------- Поиск пути (Дейкстра по ОД) ----------
  function stepCost(S, u, ax, ay, bx, by) {
    if (!inside(bx, by)) return Infinity;
    var ta = S.t[ay * MW + ax], tb = S.t[by * MW + bx], door = tb === T.DOOR;
    if (!PASS[tb] && !door) return Infinity;
    if (ta !== T.LADDER && tb !== T.LADDER && elevOf(ta) !== elevOf(tb)) return Infinity;
    var diag = ax !== bx && ay !== by;
    if (diag) {
      if (door || ta === T.LADDER || tb === T.LADDER) return Infinity;
      var t1 = S.t[ay * MW + bx], t2 = S.t[by * MW + ax];
      if (!PASS[t1] || !PASS[t2] || t1 === T.LADDER || t2 === T.LADDER || elevOf(t1) !== elevOf(ta) || elevOf(t2) !== elevOf(ta)) return Infinity;
    }
    var c = diag ? COST.diag : COST.ortho;
    if (u.crouch) c += COST.crouchMove;
    if (tb === T.LADDER) c += COST.ladder;
    if (door) c += COST.door;
    return c;
  }
  function unitAt(S, x, y) { for (var i = 0; i < S.units.length; i++) { var v = S.units[i]; if (onBoard(v) && v.x === x && v.y === y) return v; } return null; }
  function blocks(S, u, v) { return v !== u && onBoard(v) && (v.team === u.team || v.captive || S.spot[u.team].indexOf(v.id) >= 0); }
  function reach(S, u, budget) {
    var N = MW * MH, cost = new Array(N), prev = new Array(N), done = new Array(N), occ = new Array(N);
    for (var i = 0; i < N; i++) { cost[i] = Infinity; prev[i] = -1; done[i] = false; occ[i] = false; }
    S.units.forEach(function (v) { if (blocks(S, u, v)) occ[v.y * MW + v.x] = true; });
    var s = u.y * MW + u.x; cost[s] = 0;
    for (;;) {
      var bi = -1, bc = Infinity;
      for (var j = 0; j < N; j++) if (!done[j] && cost[j] < bc) { bc = cost[j]; bi = j; }
      if (bi < 0) break; done[bi] = true;
      var ax = bi % MW, ay = (bi / MW) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; var bx = ax + dx, by = ay + dy; if (!inside(bx, by)) continue;
        var k = by * MW + bx; if (done[k] || occ[k]) continue;
        var c = stepCost(S, u, ax, ay, bx, by); if (!isFinite(c)) continue;
        var nc = bc + c; if (nc > budget) continue;
        if (nc < cost[k]) { cost[k] = nc; prev[k] = bi; }
      }
    }
    return { cost: cost, prev: prev };
  }
  function pathFrom(R, x, y) {
    var k = y * MW + x; if (!isFinite(R.cost[k])) return null;
    var p = []; while (R.prev[k] >= 0) { p.unshift([k % MW, (k / MW) | 0]); k = R.prev[k]; }
    return p;
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var S, emitFn = opts.onEvent || function () {};
    function emit(type, d) { try { emitFn(type, d || {}); } catch (e) { if (global.console) console.error(e); } }
    function rnd() { var r = new Rng(S.rs); var v = r.f(); S.rs = r.s; return v; }
    function byId(id) { for (var i = 0; i < S.units.length; i++) if (S.units[i].id === id) return S.units[i]; return null; }
    function tile(x, y) { return inside(x, y) ? S.t[y * MW + x] : T.WALL; }

    function mkUnit(team, kind, def, x, y) {
      var K = KIND[kind] || {}, D = DIFF[S.diff] || DIFF.normal, enemy = team === 1 && !S.hotseat;
      var u = { id: S.nextId++, team: team, kind: kind, rkey: def.id || null, ni: def.ni != null ? def.ni : -1, lvl: def.lvl | 0,
        x: x, y: y, face: team === 0 ? 0 : 4,
        hpMax: def.hp || K.hp, acc: def.acc || K.acc, apBase: def.ap || K.ap, stam: def.stam || K.stam,
        weapon: def.weapon !== undefined ? def.weapon : K.weapon, gear: def.gear != null ? def.gear : (K.gear | 0), kit: def.kit | 0, clips: def.clips | 0,
        heat: 0, crouch: false, alive: true, evac: false, captive: false, alert: false, reinf: false, boss: kind === 'boss',
        hits: 0, kills: 0, ap: 0, apMax: 0, path: null, moved: false, hacked: false };
      if (enemy) { u.hpMax = Math.max(3, u.hpMax + D.hp); u.apBase += D.ap; }
      if (team === 1) { u.inf = true; u.clips = 0; }   // у автоматонов запас зарядов бесконечен (и ничего не весит)
      u.hp = u.hpMax; var W = WEAPONS[u.weapon]; u.clip = W ? W.clip : 0; u.apMax = apFor(u); u.ap = u.apMax;
      S.units.push(u); return u;
    }

    function build() {
      var spec = opts.spec; if (!spec) throw new Error('OPERATSIYA.Game: нужен spec миссии');
      S = { v: 1, specId: spec.id, spec: spec, hotseat: !!(opts.hotseat || spec.hotseat), diff: DIFF[opts.diff] ? opts.diff : 'normal',
        rs: (opts.seed >>> 0) || 1, t: [], thp: [], units: [], items: [], starts: [], rpts: [], turn: 1, side: 0, phase: 'play', reason: null, winner: -1,
        obj: { kind: spec.obj, prog: 0, need: spec.need || 0 }, evac: 0, reinf: 0, nextId: 1, vis: [[], []], seen: [[], []], spot: [[], []], known: [{}, {}],
        score: 0, kills: 0, ai: null, mover: null, result: null, core: null, exits: [], zone: [] };
      var marks = [], rows = spec.map;
      for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
        var ch = rows[y][x], t = CH[ch];
        if (t == null) t = (ch === 'q' || ch === 'j') ? T.BALC : T.FLOOR;
        S.t.push(t); S.thp.push(TILE_HP[t] || 0);
        if (t === T.EXIT) S.exits.push([x, y]); if (t === T.ZONE) S.zone.push([x, y]); if (t === T.CORE) S.core = [x, y];
        if (ch === 'S') S.starts.push([x, y]); else if (ch === 'R') S.rpts.push([x, y]);
        else if (MARK[ch] || ch === 'M') marks.push([ch, x, y]);
        else if (ITEM_OF[ch]) S.items.push({ kind: ITEM_OF[ch], x: x, y: y });
      }
      for (var i = 0; i < 2 * MW * MH; i++) { S.vis[i < MW * MH ? 0 : 1].push(0); S.seen[i < MW * MH ? 0 : 1].push(0); }
      var squad = opts.squad || [];
      squad.forEach(function (def, i) { var p = freeNear(S.starts[i] || S.starts[0] || [1, 1]); mkUnit(0, 'mech', def, p[0], p[1]); });
      marks.forEach(function (m) {
        if (m[0] === 'M') { var mu = mkUnit(0, 'master', { id: 'master' }, m[1], m[2]); mu.captive = true; mu.face = 4; return; }
        var kind = MARK[m[0]];
        if (S.hotseat) { var def = (opts.team1 && opts.team1.shift && opts.team1.shift()) || {}; mkUnit(1, kind, def, m[1], m[2]); }
        else mkUnit(1, kind, {}, m[1], m[2]);
      });
      S.units.forEach(function (u) { if (u.team === 1 && !S.hotseat && hasCoverHere(u)) u.crouch = true; });   // часовые Совета ждут в укрытии
      startTurn(0, true);
    }
    function freeNear(p) {
      var q = [p], seen = {}; seen[p[0] + ',' + p[1]] = 1;
      while (q.length) {
        var c = q.shift(); if (PASS[tile(c[0], c[1])] && !unitAt(S, c[0], c[1])) return c;
        for (var d = 0; d < 4; d++) { var nx = c[0] + [1, -1, 0, 0][d], ny = c[1] + [0, 0, 1, -1][d], k = nx + ',' + ny; if (inside(nx, ny) && !seen[k]) { seen[k] = 1; q.push([nx, ny]); } }
      }
      return p;
    }

    // ---------- Видимость ----------
    function updateVis() {
      for (var tm = 0; tm < 2; tm++) {
        var vis = S.vis[tm], seen = S.seen[tm]; for (var i = 0; i < vis.length; i++) vis[i] = 0;
        S.units.forEach(function (u) {
          if (u.team !== tm || !onBoard(u) || u.captive) return;
          for (var y = Math.max(0, u.y - VIS); y <= Math.min(MH - 1, u.y + VIS); y++)
            for (var x = Math.max(0, u.x - VIS); x <= Math.min(MW - 1, u.x + VIS); x++) {
              var k = y * MW + x; if (vis[k]) continue;
              if (seesTile(S, u, x, y)) { vis[k] = 1; seen[k] = 1; }
            }
        });
        var spot = [];
        S.units.forEach(function (v) { if (v.team !== tm && onBoard(v) && vis[v.y * MW + v.x]) spot.push(v.id); });
        S.spot[tm] = spot;
        var kn = S.known[tm];
        spot.forEach(function (id) { var v = byId(id); kn[id] = { x: v.x, y: v.y, turn: S.turn }; });
        Object.keys(kn).forEach(function (id) { var v = byId(+id), e = kn[id]; if (!v || !onBoard(v)) { delete kn[id]; return; } if (spot.indexOf(+id) < 0 && vis[e.y * MW + e.x]) delete kn[id]; });
      }
      // тревога у Совета: кто увидел бригаду — поднимает соседей
      if (!S.hotseat && S.spot[1].length) S.units.forEach(function (u) {
        if (u.team !== 1 || !onBoard(u) || u.alert) return;
        if (S.spot[1].some(function (id) { var v = byId(id); return unitSees(S, u, v); })) alertAround(u.x, u.y, 8);
      });
    }
    function alertAround(x, y, r) { S.units.forEach(function (u) { if (u.team === 1 && onBoard(u) && dist(u.x, u.y, x, y) <= r) u.alert = true; }); }
    function noise(src, r) {
      if (S.hotseat) return;
      if (src.team === 0) { alertAround(src.x, src.y, r); if (S.units.some(function (u) { return u.team === 1 && onBoard(u) && u.alert && dist(u.x, u.y, src.x, src.y) <= r; })) S.known[1][src.id] = { x: src.x, y: src.y, turn: S.turn }; }
    }

    // ---------- Ход стороны ----------
    function isAI(team) { return team === 1 && !S.hotseat; }
    function startTurn(team, first) {
      S.side = team;
      if (team === 0 && !first) S.turn++;
      var D = DIFF[S.diff] || DIFF.normal;
      S.units.forEach(function (u) {
        if (u.team !== team || !onBoard(u)) return;
        u.apMax = apFor(u); var pen = 0;
        if (u.heat >= 100) { pen = u.apMax; u.heat = 55; emit('boil', { id: u.id, x: u.x, y: u.y }); }
        else if (u.heat >= 50) { pen = Math.round(u.apMax * (u.heat - 30) / 140); emit('overheat', { id: u.id, lost: pen, x: u.x, y: u.y }); }
        if (!first) u.heat = Math.max(0, u.heat - Math.round(12 + u.stam / 5));
        u.ap = u.captive ? 0 : Math.max(0, u.apMax - pen); u.moved = false; u.hacked = false; u.path = null;
      });
      if (!first && team === 0 && S.obj.kind === 'hold') {
        var mine = S.zone.some(function (z) { var v = unitAt(S, z[0], z[1]); return v && v.team === 0 && v.kind === 'mech'; });
        var theirs = S.zone.some(function (z) { var v = unitAt(S, z[0], z[1]); return v && v.team === 1; });
        if (mine && !theirs) { S.obj.prog++; emit('holdTick', { prog: S.obj.prog, need: S.obj.need }); }
      }
      if (isAI(team) && S.spec.reinf && S.turn % S.spec.reinf.every === 0) spawnReinf();
      updateVis();
      emit('turn', { side: team, turn: S.turn });
      checkEnd();
      if (S.phase === 'play' && !S.hotseat && team === 0 && S.turn > S.spec.turns) finish(false, 'time');
      if (S.phase === 'play' && isAI(team)) {
        var q = S.units.filter(function (u) { return u.team === 1 && onBoard(u); });
        q.sort(function (a, b) { return (b.alert ? 1 : 0) - (a.alert ? 1 : 0) || a.id - b.id; });
        S.ai = { queue: q.map(function (u) { return u.id; }), i: 0, acts: 0 };
      }
    }
    function spawnReinf() {
      var R = S.spec.reinf;
      for (var n = 0; n < R.n && S.reinf < R.max; n++) {
        var pts = S.rpts.filter(function (p) { return !unitAt(S, p[0], p[1]); }); if (!pts.length) return;
        var p = pts[Math.floor(rnd() * pts.length)], kind = R.kinds[Math.floor(rnd() * R.kinds.length)];
        var u = mkUnit(1, kind, {}, p[0], p[1]); u.alert = true; u.reinf = true; u.face = dirTo(p[0], p[1], MW / 2, MH / 2); S.reinf++;
        emit('reinf', { id: u.id, x: p[0], y: p[1] });
      }
    }
    function endTurn() {
      if (S.phase !== 'play' || busy() || isAI(S.side)) return false;
      emit('endTurn', { side: S.side });
      startTurn(1 - S.side);
      return true;
    }
    function busy() { return S.mover != null || !!S.ai; }
    function canAct(u) { return S.phase === 'play' && u && onBoard(u) && !u.captive && u.team === S.side && S.mover == null; }

    // ---------- Конец миссии ----------
    function checkEnd() {
      if (S.phase !== 'play') return;
      var t0 = S.units.filter(function (u) { return u.team === 0 && onBoard(u) && u.kind === 'mech'; });
      var t1 = S.units.filter(function (u) { return u.team === 1 && onBoard(u); });
      if (S.hotseat) {
        var a0 = S.units.filter(function (u) { return u.team === 0 && onBoard(u); }).length;
        if (!a0 || !t1.length) { S.winner = a0 ? 0 : 1; finish(true, 'duel'); }
        return;
      }
      var k = S.obj.kind, master = S.units.filter(function (u) { return u.kind === 'master'; })[0];
      if (k === 'evac') {
        if (S.evac >= S.obj.need) return finish(true, 'evac');
        if (t0.length + S.evac < S.obj.need) return finish(false, t0.length ? 'evacFail' : 'squad');
        return;
      }
      if (!t0.length) return finish(false, 'squad');
      if (master && !master.alive) return finish(false, 'master');
      if (k === 'clear' && !t1.length) return finish(true, 'clear');
      if (k === 'boss' && !S.units.some(function (u) { return u.boss && u.alive; })) return finish(true, 'boss');
      if (k === 'rescue' && master && master.alive && !master.captive && (tile(master.x, master.y) === T.EXIT || !t1.length)) return finish(true, 'rescue');
      if ((k === 'hack' || k === 'hold') && S.obj.prog >= S.obj.need) return finish(true, k);
    }
    function finish(won, reason) {
      if (S.phase !== 'play') return;
      S.phase = won ? 'won' : 'lost'; S.reason = reason; S.ai = null; S.mover = null;
      if (won && !S.hotseat) S.score += 300 + 100 * (S.spec.id | 0) + 15 * Math.max(0, S.spec.turns - S.turn);
      S.result = { won: won, reason: reason, turn: S.turn, kills: S.kills, score: S.score, winner: S.winner,
        units: S.units.filter(function (u) { return u.team === 0 && u.kind === 'mech'; }).map(function (u) { return { rkey: u.rkey, alive: u.alive, evac: u.evac, hits: u.hits, kills: u.kills }; }) };
      emit(won ? 'won' : 'lost', { reason: reason, winner: S.winner });
    }

    // ---------- Урон, взрывы, разрушения ----------
    function damage(v, dmg, src) {
      if (!onBoard(v)) return;
      v.hp -= dmg; v.alert = true;
      var heatMul = v.team === 0 && !S.hotseat ? (DIFF[S.diff] || DIFF.normal).heat : 1;
      v.heat = Math.min(140, v.heat + Math.round(32 * (1 - v.stam / 200) * heatMul));
      if (src) src.hits++;
      emit('hit', { id: v.id, dmg: dmg, x: v.x, y: v.y, team: v.team });
      if (v.team === 1 && !S.hotseat && src) S.known[1][src.id] = { x: src.x, y: src.y, turn: S.turn };
      if (v.hp <= 0) {
        v.hp = 0; v.alive = false; v.crouch = false; v.path = null;
        if (src) src.kills++;
        if (v.team === 1 && !S.hotseat) { S.kills++; S.score += (KIND[v.kind] || {}).score || 100; }
        S.units.forEach(function (w) { if (w.team === v.team && onBoard(w) && cheb(w.x, w.y, v.x, v.y) <= 2) w.heat = Math.min(140, w.heat + 12); });
        emit('down', { id: v.id, team: v.team, kind: v.kind, x: v.x, y: v.y });
        updateVis(); checkEnd();
      }
    }
    function tileDamage(x, y, n) {
      var k = y * MW + x, t = S.t[k]; if (!TILE_HP[t]) return false;
      S.thp[k] -= n;
      if (S.thp[k] <= 0) { S.t[k] = T.RUBBLE; S.thp[k] = 0; emit('break', { x: x, y: y, was: t }); updateVis(); return true; }
      emit('chip', { x: x, y: y }); return false;
    }
    function explode(cx, cy, src) {
      emit('boom', { x: cx, y: cy });
      for (var y = cy - 1; y <= cy + 1; y++) for (var x = cx - 1; x <= cx + 1; x++) if (inside(x, y)) tileDamage(x, y, 3);
      S.units.slice().forEach(function (v) {
        if (!onBoard(v)) return; var d = cheb(v.x, v.y, cx, cy);
        if (d === 0) damage(v, 6, src); else if (d === 1) damage(v, 4, src);
        else if (d === 2) v.heat = Math.min(140, v.heat + 15);
      });
      noise(src, 10); updateVis(); checkEnd();
    }

    // ---------- Действия ----------
    function face(u, x, y) { if (x !== u.x || y !== u.y) u.face = dirTo(u.x, u.y, x, y); }
    function withReaction(u, fn) {
      var opp = S.units.filter(function (r) { return r.team !== u.team && onBoard(r) && !r.captive; });
      var before = opp.filter(function (r) { return unitSees(S, r, u); }).map(function (r) { return r.id; });
      var spotBefore = S.spot[u.team].slice();
      fn(); updateVis();
      opp.forEach(function (r) {
        if (!onBoard(u) || S.phase !== 'play' || before.indexOf(r.id) >= 0 || !onBoard(r)) return;
        var W = WEAPONS[r.weapon]; if (!W || r.clip <= 0 || r.ap < COST.snap) return;
        if (!unitSees(S, r, u) || u.captive) return;
        emit('react', { id: r.id, tid: u.id, x: r.x, y: r.y });
        r.alert = true; doShoot(r, u, 'snap', true);
      });
      return S.spot[u.team].some(function (id) { return spotBefore.indexOf(id) < 0; });
    }
    function cost(mode, u, tx, ty) { return COST[mode] + (inFov(u, tx, ty) ? 0 : COST.turn); }
    // Проверка выстрела без исполнения → { ok, why, cost, chance, rounds }
    function shotInfo(u, tg, mode) {
      var W = WEAPONS[u.weapon]; if (!W) return { ok: false, why: 'noweapon' };
      if (mode === 'burst' && !W.burst) return { ok: false, why: 'noburst' };
      var isTile = !tg.team && tg.team !== 0 && tg.id == null;
      if (isTile) { if (!TILE_HP[tile(tg.x, tg.y)]) return { ok: false, why: 'target' }; }
      else { if (!onBoard(tg) || tg.team === u.team || S.spot[u.team].indexOf(tg.id) < 0) return { ok: false, why: 'target' }; }
      if (tg.x === u.x && tg.y === u.y) return { ok: false, why: 'target' };
      var d = dist(u.x, u.y, tg.x, tg.y);
      if (d > VIS + 3 || !losT(S.t, u.x, u.y, tg.x, tg.y)) return { ok: false, why: 'los' };
      var c = cost(mode, u, tg.x, tg.y), rounds = mode === 'burst' ? Math.min(3, u.clip) : 1;
      var ch = isTile ? Math.round(clamp(92 - d * 2, 40, 92)) : hitChance(S, u, tg, mode);
      if (u.clip <= 0) return { ok: false, why: 'ammo', cost: c, chance: ch, rounds: 0 };
      if (u.ap < c) return { ok: false, why: 'ap', cost: c, chance: ch, rounds: rounds };
      return { ok: true, cost: c, chance: ch, rounds: rounds, tile: isTile };
    }
    function doShoot(u, tg, mode, reaction) {
      var I = shotInfo(u, tg, mode); if (!I.ok) return I;
      var W = WEAPONS[u.weapon]; u.ap -= I.cost; face(u, tg.x, tg.y);
      var hits = 0;
      for (var r = 0; r < I.rounds; r++) {
        if (I.tile ? !TILE_HP[tile(tg.x, tg.y)] : !onBoard(tg)) break;
        u.clip--;
        var ch = I.tile ? I.chance : hitChance(S, u, tg, mode), hit = rnd() * 100 < ch;
        emit('shot', { id: u.id, team: u.team, x: u.x, y: u.y, tx: tg.x, ty: tg.y, hit: hit, mode: mode, reaction: !!reaction, chance: ch, weapon: u.weapon });
        if (hit) {
          hits++;
          if (I.tile) tileDamage(tg.x, tg.y, W.wall);
          else damage(tg, W.dmg + (rnd() < 0.5 ? 0 : (rnd() < 0.5 ? -1 : 1)), u);
        } else if (!I.tile) {
          // промах может попасть в укрытие цели
          var dx = Math.sign(u.x - tg.x), dy = Math.sign(u.y - tg.y), cx = tg.x + dx, cy = tg.y + dy;
          var cands = [[tg.x + dx, tg.y], [tg.x, tg.y + dy], [cx, cy]].filter(function (p) { return inside(p[0], p[1]) && (p[0] !== tg.x || p[1] !== tg.y) && TILE_HP[tile(p[0], p[1])]; });
          if (cands.length && rnd() < 0.5) tileDamage(cands[0][0], cands[0][1], W.wall);
        }
      }
      noise(u, 9); updateVis(); checkEnd();
      return { ok: true, hits: hits, rounds: I.rounds };
    }
    function shoot(u, tg, mode) { if (!canAct(u)) return { ok: false, why: 'turn' }; return doShoot(u, tg, mode || 'snap', false); }

    function gearRange(u) { return 4 + Math.floor(u.stam / 12); }
    function gearInfo(u, x, y) {
      if (!(u.gear > 0)) return { ok: false, why: 'nogear' };
      if (!inside(x, y) || tile(x, y) === T.WALL) return { ok: false, why: 'target' };
      var d = dist(u.x, u.y, x, y); if (d > gearRange(u) || d < 1) return { ok: false, why: 'range' };
      if (!losT(S.t, u.x, u.y, x, y) || OPAQUE[tile(x, y)] && !TILE_HP[tile(x, y)]) return { ok: false, why: 'los' };
      var c = cost('gear', u, x, y); if (u.ap < c) return { ok: false, why: 'ap', cost: c };
      return { ok: true, cost: c, chance: Math.round(clamp(u.acc + 20 - d * 3, 25, 95)) };
    }
    function throwGear(u, x, y) {
      if (!canAct(u) && !(S.ai && u.team === S.side)) return { ok: false, why: 'turn' };
      var I = gearInfo(u, x, y); if (!I.ok) return I;
      u.ap -= I.cost; u.gear--; face(u, x, y);
      var cx = x, cy = y;
      if (rnd() * 100 >= I.chance) {
        var opts2 = [];
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if ((dx || dy) && inside(x + dx, y + dy) && tile(x + dx, y + dy) !== T.WALL) opts2.push([x + dx, y + dy]);
        if (opts2.length) { var p = opts2[Math.floor(rnd() * opts2.length)]; cx = p[0]; cy = p[1]; }
      }
      emit('throw', { id: u.id, x: u.x, y: u.y, tx: cx, ty: cy, aim: [x, y] });
      explode(cx, cy, u);
      return { ok: true, x: cx, y: cy };
    }
    function crouch(u) {
      if (!canAct(u) && !(S.ai && u.team === S.side)) return false;
      if (u.ap < COST.crouch) return false;
      u.ap -= COST.crouch; u.crouch = !u.crouch; emit('crouch', { id: u.id, on: u.crouch }); return true;
    }
    function reload(u) {
      var W = WEAPONS[u.weapon]; if (!W || u.clip >= W.clip || (u.clips <= 0 && !u.inf) || u.ap < COST.reload) return false;
      if (!canAct(u) && !(S.ai && u.team === S.side)) return false;
      u.ap -= COST.reload; u.clip = W.clip; if (!u.inf) u.clips--; emit('reload', { id: u.id }); return true;
    }
    function turnTo(u, x, y) {
      if (!canAct(u) || u.ap < COST.turn || (x === u.x && y === u.y)) return false;
      var f = dirTo(u.x, u.y, x, y); if (f === u.face) return false;
      u.ap -= COST.turn; u.face = f; var spotted = withReaction(u, function () {}); emit('turnTo', { id: u.id, face: f, spotted: spotted }); return true;
    }
    function useKit(u, v) {
      v = v || u;
      if (!canAct(u) || !(u.kit > 0) || u.ap < COST.kit || !onBoard(v) || v.team !== u.team || cheb(u.x, u.y, v.x, v.y) > 1) return false;
      if (v.hp >= v.hpMax && v.heat < 20) return false;
      u.ap -= COST.kit; u.kit--; v.hp = Math.min(v.hpMax, v.hp + 4); v.heat = Math.max(0, v.heat - 30);
      emit('kit', { id: u.id, tid: v.id, x: v.x, y: v.y }); return true;
    }
    function interactOptions(u) {
      var out = [];
      if (!onBoard(u) || u.captive) return out;
      S.units.forEach(function (m) { if (m.captive && m.alive && u.team === 0 && cheb(m.x, m.y, u.x, u.y) <= 1) out.push({ kind: 'free', cost: COST.free, x: m.x, y: m.y, id: m.id }); });
      if (S.obj.kind === 'hack' && S.core && u.kind === 'mech' && cheb(S.core[0], S.core[1], u.x, u.y) <= 1) out.push({ kind: 'hack', cost: COST.hack, x: S.core[0], y: S.core[1], used: u.hacked });
      if (S.obj.kind === 'evac' && u.kind === 'mech' && tile(u.x, u.y) === T.EXIT) out.push({ kind: 'evac', cost: COST.evac, x: u.x, y: u.y });
      S.items.forEach(function (it) { if (it.x === u.x && it.y === u.y && u.kind === 'mech') out.push({ kind: 'pickup', cost: COST.pickup, x: it.x, y: it.y, item: it.kind }); });
      for (var d = 0; d < 4; d++) { var nx = u.x + [1, -1, 0, 0][d], ny = u.y + [0, 0, 1, -1][d]; if (tile(nx, ny) === T.DOOR) out.push({ kind: 'door', cost: COST.door, x: nx, y: ny }); }
      return out;
    }
    function interact(u, kind) {
      if (!canAct(u)) return false;
      var opts2 = interactOptions(u).filter(function (o) { return (!kind || o.kind === kind) && !o.used; }), o = opts2[0];
      if (!o || u.ap < o.cost) return false;
      u.ap -= o.cost;
      if (o.kind === 'free') { var m = byId(o.id); m.captive = false; m.ap = 0; m.face = u.face; emit('freed', { id: m.id, x: m.x, y: m.y }); updateVis(); }
      else if (o.kind === 'hack') { u.hacked = true; S.obj.prog++; face(u, o.x, o.y); emit('hack', { id: u.id, prog: S.obj.prog, need: S.obj.need, x: o.x, y: o.y }); noise(u, 12); }
      else if (o.kind === 'evac') { u.evac = true; u.crouch = false; S.evac++; emit('evac', { id: u.id, n: S.evac, need: S.obj.need, x: u.x, y: u.y }); updateVis(); }
      else if (o.kind === 'pickup') {
        var i = S.items.findIndex(function (it) { return it.x === u.x && it.y === u.y; }), it = S.items.splice(i, 1)[0];
        u[it.kind === 'clip' ? 'clips' : it.kind]++; emit('pickup', { id: u.id, item: it.kind, x: u.x, y: u.y });
      }
      else if (o.kind === 'door') { u.ap += o.cost; openDoor(u, o.x, o.y); }
      checkEnd();
      return o.kind;
    }
    function openDoor(u, x, y) {
      if (u.ap < COST.door || tile(x, y) !== T.DOOR) return false;
      u.ap -= COST.door; face(u, x, y);
      var spotted = withReaction(u, function () { S.t[y * MW + x] = T.OPEN; });
      emit('door', { id: u.id, x: x, y: y, spotted: spotted }); return true;
    }

    // ---------- Перемещение ----------
    function planPath(u, x, y) {
      var R = reach(S, u, u.ap); var p = pathFrom(R, x, y);
      return p && p.length ? { path: p, cost: R.cost[y * MW + x] } : null;
    }
    function moveTo(u, x, y) {
      if (!canAct(u) || !inside(x, y)) return false;
      var P = planPath(u, x, y); if (!P) return false;
      u.path = P.path; S.mover = u.id; emit('order', { id: u.id, x: x, y: y, cost: P.cost }); return true;
    }
    // автоматон, дойдя до места, разворачивается к ближайшему известному противнику (бесплатно)
    function faceKnown(u) {
      var kn = S.known[u.team], best = null, bd = 1e9;
      Object.keys(kn).forEach(function (id) { var e = kn[id], d = dist(e.x, e.y, u.x, u.y); if (d < bd) { bd = d; best = e; } });
      if (best && !inFov(u, best.x, best.y)) { withReaction(u, function () { u.face = dirTo(u.x, u.y, best.x, best.y); }); }
    }
    function doStep(u) {
      if (!u.path || !u.path.length || !onBoard(u)) { if (u) u.path = null; S.mover = null; return { kind: 'stop' }; }
      var nx = u.path[0][0], ny = u.path[0][1];
      if (tile(nx, ny) === T.DOOR) {
        if (openDoor(u, nx, ny)) { if (!onBoard(u)) { S.mover = null; u.path = null; } return { kind: 'door', id: u.id }; }
        u.path = null; S.mover = null; return { kind: 'stop' };
      }
      var c = stepCost(S, u, u.x, u.y, nx, ny);
      if (!isFinite(c) || c > u.ap || unitAt(S, nx, ny)) { u.path = null; S.mover = null; emit('blocked', { id: u.id }); return { kind: 'stop' }; }
      var spotted = withReaction(u, function () { u.face = dirTo(u.x, u.y, nx, ny); u.x = nx; u.y = ny; u.ap -= c; u.path.shift(); });
      emit('step', { id: u.id, x: u.x, y: u.y, team: u.team });
      noise(u, u.crouch ? 2 : 4);
      if (spotted && u.path && u.path.length) { u.path = null; emit('spotted', { id: u.id, team: u.team }); }
      checkEnd();
      if (!onBoard(u) || !u.path || !u.path.length || S.phase !== 'play') {
        if (onBoard(u) && isAI(u.team) && S.phase === 'play') faceKnown(u);
        u.path = null; S.mover = null;
      }
      return { kind: 'step', id: u.id };
    }

    // ---------- ИИ Ржавого Совета ----------
    function targetsOf(u) { return S.units.filter(function (v) { return v.team !== u.team && onBoard(v) && !v.captive && S.spot[u.team].indexOf(v.id) >= 0; }); }
    function bestShot(u, targets) {
      var best = null;
      targets.forEach(function (tg) {
        ['aimed', 'burst', 'snap'].forEach(function (mode) {
          var I = shotInfo(u, tg, mode); if (!I.ok) return;
          var W = WEAPONS[u.weapon], ev = I.rounds * I.chance * W.dmg / 100;
          if (tg.hp <= W.dmg) ev *= 1.4;
          if (tg.kind === 'master') ev *= 0.5;   // Совет сперва бьёт вооружённых
          var sc = ev / Math.sqrt(I.cost);
          if (!best || sc > best.sc) best = { tg: tg, mode: mode, ch: I.chance, sc: sc };
        });
      });
      return best;
    }
    function bestGrenade(u, targets) {
      if (!(u.gear > 0) || u.ap < COST.gear) return null;
      var best = null, seen = {};
      targets.forEach(function (t) {
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var x = t.x + dx, y = t.y + dy, k = x + ',' + y; if (seen[k]) continue; seen[k] = 1;
          var I = gearInfo(u, x, y); if (!I.ok || dist(u.x, u.y, x, y) < 2.5) continue;
          var val = 0;
          S.units.forEach(function (v) {
            if (!onBoard(v) || v.captive) return; var d = cheb(v.x, v.y, x, y); if (d > 1) return;
            val += (v.team === u.team ? -2 : 1) * (d === 0 ? 1 : 0.7);
          });
          val *= I.chance / 100;
          if (!best || val > best.val) best = { x: x, y: y, val: val };
        }
      });
      return best;
    }
    function bestTile(u, targets, budget) {
      var R = reach(S, u, budget), W = WEAPONS[u.weapon], best = null;
      var allies = S.units.filter(function (v) { return v.team === u.team && v !== u && onBoard(v); });
      for (var k = 0; k < MW * MH; k++) {
        if (!isFinite(R.cost[k])) continue;
        var x = k % MW, y = (k / MW) | 0; if (unitAt(S, x, y) && !(x === u.x && y === u.y)) continue;
        if (S.t[k] === T.DOOR) continue;
        var left = u.ap - R.cost[k], mode = left >= COST.aimed + 1 ? 'aimed' : 'snap', bestCh = 0, cs = 0, exp = 0, nearD = 99;
        var P = { x: x, y: y };
        for (var i = 0; i < targets.length; i++) {
          var tg = targets[i], d = dist(x, y, tg.x, tg.y); nearD = Math.min(nearD, d);
          if (d <= VIS && losT(S.t, x, y, tg.x, tg.y)) {
            bestCh = Math.max(bestCh, hitChance(S, u, tg, mode, P));
            var cov = coverOf(S, x, y, tg.x, tg.y); cs += cov === 2 ? 14 : cov === 1 ? 9 : 0; if (!cov) exp++;
          } else cs += 5;
        }
        var s = bestCh * 0.9 + cs - exp * 8 - Math.abs(nearD - (W ? W.opt : 5)) * 1.3 - R.cost[k] * 0.15 + rnd() * 2;
        if (u.kind === 'heavy' || u.boss) s += -nearD * 0.6;
        allies.forEach(function (a) { if (cheb(a.x, a.y, x, y) <= 1) s -= 4; });
        if (!best || s > best.s) best = { x: x, y: y, s: s };
      }
      if (!best || (best.x === u.x && best.y === u.y)) return null;
      return { x: best.x, y: best.y, path: pathFrom(R, best.x, best.y) };
    }
    function goalOf(u) {
      var kn = S.known[u.team], ids = Object.keys(kn), g = null, bd = 1e9;
      ids.forEach(function (id) { var e = kn[id], d = dist(e.x, e.y, u.x, u.y); if (d < bd) { bd = d; g = { x: e.x, y: e.y, id: +id }; } });
      if (g) return g;
      if (u.reinf || (u.alert && (S.obj.kind === 'hold' || S.obj.kind === 'evac'))) {
        var pts = S.obj.kind === 'hold' ? S.zone : S.obj.kind === 'evac' ? S.exits : null;
        if (pts && pts.length) { var p = pts[Math.floor(pts.length / 2)]; return { x: p[0], y: p[1] }; }
      }
      return null;
    }
    function approach(u, g, budget) {
      var R = reach(S, u, 1e9), best = null, bd = 1e9;
      for (var k = 0; k < MW * MH; k++) {
        if (!isFinite(R.cost[k])) continue; var x = k % MW, y = (k / MW) | 0;
        var d = dist(x, y, g.x, g.y); if (d < bd || (d === bd && R.cost[k] < best.c)) { bd = d; best = { x: x, y: y, c: R.cost[k] }; }
      }
      if (!best) return null;
      var p = pathFrom(R, best.x, best.y); if (!p || !p.length) return null;
      var out = [], c = 0, px = u.x, py = u.y;
      for (var i = 0; i < p.length; i++) { var sc = stepCost(S, u, px, py, p[i][0], p[i][1]); if (c + sc > budget) break; c += sc; out.push(p[i]); px = p[i][0]; py = p[i][1]; }
      return out.length ? out : null;
    }
    function hasCoverHere(u) {
      for (var d = 0; d < 8; d++) { var dx = [1, 1, 0, -1, -1, -1, 0, 1][d], dy = [0, 1, 1, 1, 0, -1, -1, -1][d]; if (COVER[tile(u.x + dx, u.y + dy)]) return true; }
      return false;
    }
    function aiPlan(u) {
      if (u.ap < 2) return null;
      var W = WEAPONS[u.weapon];
      if (W && u.clip <= 0) return u.ap >= COST.reload ? { kind: 'reload' } : null;
      var targets = targetsOf(u);
      if (targets.length) {
        u.alert = true;
        var gt = bestGrenade(u, targets);
        if (gt && (gt.val >= 1.2 || (gt.val >= 0.6 && u.kind === 'grenadier'))) return { kind: 'gear', x: gt.x, y: gt.y };
        var shot = bestShot(u, targets), budget = u.ap - COST.snap;
        if (shot && (shot.ch >= 45 || u.moved || (shot.ch >= 25 && budget < 8))) return { kind: 'shoot', tg: shot.tg, mode: shot.mode };
        if (!u.moved && budget >= COST.ortho) { var dest = bestTile(u, targets, budget); if (dest && dest.path && dest.path.length) return { kind: 'move', path: dest.path }; }
        if (shot && shot.ch >= 12) return { kind: 'shoot', tg: shot.tg, mode: shot.mode };
        if (!u.crouch && u.ap >= COST.crouch && hasCoverHere(u)) return { kind: 'crouch' };
        return null;
      }
      var g = (u.alert || u.reinf) ? goalOf(u) : null;
      if (g && !u.moved) {
        if (dist(g.x, g.y, u.x, u.y) <= 1.5 && g.id != null) { delete S.known[u.team][g.id]; return null; }
        var p = approach(u, g, Math.max(COST.ortho, u.ap - COST.snap));
        if (p) return { kind: 'move', path: p };
        if (g.id != null) delete S.known[u.team][g.id];
      }
      if (W && u.clip < W.clip / 2 && u.ap >= COST.reload) return { kind: 'reload' };
      if (!u.crouch && u.alert && u.ap >= COST.crouch && hasCoverHere(u)) return { kind: 'crouch' };
      return null;
    }
    function aiTick() {
      var A = S.ai;
      while (A && A.i < A.queue.length) {
        var u = byId(A.queue[A.i]);
        if (!u || !onBoard(u) || A.acts >= 12 || S.phase !== 'play') { A.i++; A.acts = 0; continue; }
        var act = aiPlan(u); A.acts++;
        if (!act) { A.i++; A.acts = 0; continue; }
        if (act.kind === 'move') { u.moved = true; u.path = act.path; S.mover = u.id; return { kind: 'aimove', id: u.id }; }
        if (act.kind === 'shoot') { var r = doShoot(u, act.tg, act.mode, false); if (!r.ok) { A.i++; A.acts = 0; continue; } return { kind: 'shot', id: u.id }; }
        if (act.kind === 'gear') { var g = throwGear(u, act.x, act.y); if (!g.ok) { A.i++; A.acts = 0; continue; } return { kind: 'throw', id: u.id }; }
        if (act.kind === 'reload') { if (!reload(u)) { A.i++; A.acts = 0; continue; } return { kind: 'reload', id: u.id }; }
        if (act.kind === 'crouch') { crouch(u); A.i++; A.acts = 0; return { kind: 'crouch', id: u.id }; }
      }
      if (S.phase !== 'play') { S.ai = null; return { kind: 'end' }; }
      S.ai = null; emit('endTurn', { side: 1 }); startTurn(0); return { kind: 'aiend' };
    }

    function tick() {
      if (S.phase !== 'play') { S.ai = null; S.mover = null; return null; }
      if (S.mover != null) { var u = byId(S.mover); if (!u) { S.mover = null; return { kind: 'stop' }; } return doStep(u); }
      if (S.ai) return aiTick();
      return null;
    }
    function serialize() { var o = Object.assign({}, S); o.spec = null; return JSON.stringify(o); }

    if (opts.restore) {
      S = typeof opts.restore === 'string' ? JSON.parse(opts.restore) : opts.restore;
      S.spec = opts.spec || (S.specId ? O.MISSIONS.filter(function (m) { return m.id === S.specId; })[0] : O.ARENA);
    } else build();

    return {
      state: function () { return S; }, tick: tick, busy: busy, endTurn: endTurn, serialize: serialize,
      moveTo: moveTo, planPath: planPath, shoot: shoot, shotInfo: shotInfo, throwGear: throwGear, gearInfo: gearInfo, gearRange: gearRange,
      crouch: crouch, reload: reload, turnTo: turnTo, useKit: useKit, interact: interact, interactOptions: interactOptions,
      reach: function (u, b) { return reach(S, u, b == null ? u.ap : b); }, byId: byId, unitAt: function (x, y) { return unitAt(S, x, y); },
      hitChance: function (u, tg, mode, from) { return hitChance(S, u, tg, mode, from); }, coverOf: function (tx, ty, sx, sy) { return coverOf(S, tx, ty, sx, sy); },
      sees: function (u, v) { return unitSees(S, u, v); }, tile: tile, isAI: isAI, canAct: canAct,
      _damage: damage, _explode: explode, _updateVis: updateVis, _startTurn: startTurn, _finish: finish, _mk: mkUnit, _aiPlan: aiPlan
    };
  }

  O.Game = Game;
  O.logic = { MW: MW, MH: MH, VIS: VIS, T: T, PASS: PASS, OPAQUE: OPAQUE, COVER: COVER, TILE_HP: TILE_HP, WEAPONS: WEAPONS, WEAPON_LIST: WEAPON_LIST,
    COST: COST, KIND: KIND, DIFF: DIFF, MODE_ACC: MODE_ACC, los: losT, inFov: inFov, dirTo: dirTo, dist: dist, cheb: cheb, elevOf: elevOf,
    weightOf: weightOf, limitOf: limitOf, apFor: apFor, pathFrom: pathFrom, mulberry32: mulberry32, Rng: Rng };
})(typeof window !== 'undefined' ? window : globalThis);
