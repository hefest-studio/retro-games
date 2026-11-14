/* ПОДГОРЬЕ · world.js — мир: зоны, области, раскладка комнат и их клетки (детерминированно, без DOM).
   Карта мира — сетка «экранов» 34×19, экран = 40×22 клетки. Комната занимает 1×1, 2×1, 1×2 или 2×2 экрана.
   Области (area) — части зон с гарантированным набором способностей; между областями — «ворота» с преградой,
   которую снимает нужная способность. Внутри областей комнаты соединены остовным деревом + петлями.
   PODGORYE.buildWorld() → { rooms[], areas[], zones[], items[], GW, GH, grid, start, ... } (кэшируется в PODGORYE.WORLD()). */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};
  var T = P.T, CW = 40, CH = 22, GW = 34, GH = 19;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- зоны ----------
  var ZONES = [
    { id: 'gates', music: 'gates' }, { id: 'flood', music: 'flood' }, { id: 'ice', music: 'ice' }, { id: 'hot', music: 'hot' },
    { id: 'gardens', music: 'gardens' }, { id: 'halls', music: 'halls' }, { id: 'core', music: 'core' }
  ];
  // способности (кроме искры — она с собой с начала)
  var ABIL = ['boots', 'dash', 'gloves', 'hook', 'hammer', 'bell', 'cloak', 'light'];
  // ---------- области ----------
  // gate: { from (родитель), type, p (клетка родителя), c (клетка этой области) }; feat — внутренние преграды из гарантированных способностей
  var AREAS = [
    { id: 'gates', zone: 0, rects: [[13, 0, 8, 5]], fill: 0.4, start: [16, 0], guar: [],
      boss: { id: 'gatekeeper', reward: 'boots', forge: false }, lifts: 1, saves: 2, feat: [],
      treasures: [{ item: 'vessel', bar: 'hook' }, { item: 'tank', bar: 'false' }, { item: 'up:spread', bar: 'none' }, { item: 'vessel', bar: 'light' }] },
    { id: 'flood_up', zone: 1, rects: [[3, 2, 10, 3], [1, 5, 11, 2]], fill: 0.4, guar: ['boots'],
      gates: [{ from: 'gates', type: 'boots', p: [13, 3], c: [12, 3] }], shrine: 'dash', lifts: 1, saves: 2, feat: ['boots'],
      treasures: [{ item: 'vessel', bar: 'dash' }, { item: 'tank', bar: 'gloves' }, { item: 'up:rapid', bar: 'false' }] },
    { id: 'ice_up', zone: 2, rects: [[21, 2, 8, 3], [21, 5, 8, 3]], fill: 0.4, guar: ['boots'],
      gates: [{ from: 'gates', type: 'boots', p: [20, 3], c: [21, 3] }], shrine: 'gloves', lifts: 1, saves: 2, feat: ['boots'],
      treasures: [{ item: 'vessel', bar: 'hammer' }, { item: 'up:pierce', bar: 'none' }] },
    { id: 'gardens', zone: 4, rects: [[12, 5, 9, 5]], fill: 0.4, guar: ['boots'],
      gates: [{ from: 'flood_up', type: 'dash', p: [11, 6], c: [12, 6] }, { from: 'ice_up', type: 'gloves', p: [21, 6], c: [20, 6] }],
      shrine: 'hook', lifts: 1, saves: 2, feat: ['boots'],
      treasures: [{ item: 'vessel', bar: 'false' }, { item: 'tank', bar: 'cloak' }] },
    { id: 'gardens_deep', zone: 4, rects: [[12, 10, 8, 3]], fill: 0.37, guar: ['boots', 'hook'],
      gates: [{ from: 'gardens', type: 'hook', p: [15, 9], c: [15, 10] }], boss: { id: 'pendulum', forge: 0 }, saves: 1, feat: ['boots', 'hook'] },
    { id: 'flood_mid', zone: 1, rects: [[0, 7, 8, 3]], fill: 0.37, guar: ['boots', 'hook'],
      gates: [{ from: 'flood_up', type: 'hook', p: [4, 6], c: [4, 7] }], shrine: 'bell', saves: 1, feat: ['boots', 'hook'],
      treasures: [{ item: 'vessel', bar: 'bell' }] },
    { id: 'flood_deep', zone: 1, rects: [[0, 10, 11, 3]], fill: 0.4, guar: ['boots', 'hook', 'bell'], water: true,
      gates: [{ from: 'flood_mid', type: 'bell', p: [3, 9], c: [3, 10] }], shrine: 'cloak', boss: { id: 'pump', forge: 1 }, lifts: 1, saves: 2, feat: [] },
    { id: 'ice_mid', zone: 2, rects: [[29, 2, 5, 8]], fill: 0.4, guar: ['boots', 'dash'],
      gates: [{ from: 'ice_up', type: 'dash', p: [28, 4], c: [29, 4] }], shrine: 'hammer', saves: 1, feat: ['boots', 'dash'] },
    { id: 'ice_deep', zone: 2, rects: [[24, 10, 10, 3]], fill: 0.4, guar: ['boots', 'dash', 'hammer'],
      gates: [{ from: 'ice_mid', type: 'hammer', p: [31, 9], c: [31, 10] }], saves: 1, feat: ['boots', 'dash', 'hammer'],
      treasures: [{ item: 'up:charge', bar: 'none' }] },
    { id: 'ice_forge', zone: 2, rects: [[20, 10, 4, 3]], fill: 0.7, guar: ['boots', 'dash', 'hammer', 'gloves'],
      gates: [{ from: 'ice_deep', type: 'gloves', p: [24, 11], c: [23, 11] }], boss: { id: 'drill', forge: 2 }, saves: 1, feat: ['gloves'] },
    { id: 'hot', zone: 3, rects: [[0, 13, 12, 3]], fill: 0.4, guar: ['boots', 'hook', 'bell', 'cloak'],
      gates: [{ from: 'flood_deep', type: 'cloak', p: [6, 12], c: [6, 13] }], shrine: 'light', lifts: 1, saves: 2, feat: ['boots', 'hook', 'cloak'],
      treasures: [{ item: 'tank', bar: 'light' }] },
    { id: 'hot_deep', zone: 3, rects: [[0, 16, 12, 3]], fill: 0.37, guar: ['boots', 'hook', 'bell', 'cloak', 'light', 'dash'],
      gates: [{ from: 'hot', type: 'dash', p: [5, 15], c: [5, 16] }], boss: { id: 'smelter', forge: 3 }, saves: 1, feat: ['boots', 'dash', 'cloak'] },
    { id: 'halls', zone: 5, rects: [[20, 13, 14, 3]], fill: 0.37, guar: ['boots', 'dash', 'hammer', 'light'], dark: true,
      gates: [{ from: 'ice_deep', type: 'light', p: [27, 12], c: [27, 13] }], lifts: 1, saves: 2, feat: ['boots', 'dash', 'light'],
      treasures: [{ item: 'vessel', bar: 'hook' }] },
    { id: 'halls_deep', zone: 5, rects: [[20, 16, 14, 3]], fill: 0.33, guar: ['boots', 'dash', 'hammer', 'light'], dark: true,
      gates: [{ from: 'halls', type: 'hammer', p: [25, 15], c: [25, 16] }], boss: { id: 'smith', forge: 4 }, saves: 1, feat: ['boots', 'dash', 'hammer', 'light'] },
    { id: 'core', zone: 6, rects: [[14, 13, 5, 6]], fill: 0.4, guar: ['boots', 'hook', 'light'], dark: true,
      gates: [{ from: 'gardens_deep', type: 'seal', p: [16, 12], c: [16, 13] }], boss: { id: 'scale', heart: true }, saves: 1, feat: ['boots', 'hook', 'light'] }
  ];
  var BOSSES = ['gatekeeper', 'pump', 'drill', 'pendulum', 'smelter', 'smith', 'scale'];
  var ENEMY_POOL = {
    gates: ['crawler', 'crawler', 'flyer', 'turret'], flood: ['crawler', 'hopper', 'flyer', 'fish'], ice: ['crawler', 'icicle', 'sentry', 'flyer'],
    hot: ['slag', 'turret', 'sentry', 'slag'], gardens: ['vine', 'flyer', 'hopper', 'vine'], halls: ['wisp', 'sentry', 'turret', 'hopper'], core: ['wisp', 'sentry', 'slag', 'flyer']
  };

  // ---------- раскладка ----------
  function key(x, y) { return y * GW + x; }
  var DIRS = [[1, 0, 'R', 'L'], [-1, 0, 'L', 'R'], [0, 1, 'D', 'U'], [0, -1, 'U', 'D']];

  function buildWorld() {
    var areaOf = new Int8Array(GW * GH).fill(-1), grid = new Int16Array(GW * GH).fill(-1);
    var rooms = [], items = [], anvils = [], lifts = [], forges = [], bossRooms = {}, edges = [];
    var areaIdx = {}; AREAS.forEach(function (A, i) { areaIdx[A.id] = i; });
    AREAS.forEach(function (A, ai) { A.rects.forEach(function (r) { for (var y = r[1]; y < r[1] + r[3]; y++) for (var x = r[0]; x < r[0] + r[2]; x++) { if (areaOf[key(x, y)] >= 0) throw new Error('пересечение областей ' + A.id); areaOf[key(x, y)] = ai; } }); });
    function newRoom(ai, x, y, w, h, kind) {
      var rm = { i: rooms.length, area: ai, zone: AREAS[ai].zone, gx: x, gy: y, w: w, h: h, W: w * CW, H: h * CH, kind: kind || 'normal', doors: [], items: [], objs: [], rings: [], ens: [] };
      for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) { if (grid[key(xx, yy)] >= 0) throw new Error('клетка занята'); grid[key(xx, yy)] = rm.i; }
      rooms.push(rm); return rm;
    }

    AREAS.forEach(function (A, ai) {
      var rng = mulberry32(hashStr('podgorye:' + A.id));
      var all = []; for (var k = 0; k < GW * GH; k++) if (areaOf[k] === ai) all.push(k);
      var inArea = function (x, y) { return x >= 0 && y >= 0 && x < GW && y < GH && areaOf[key(x, y)] === ai; };
      var mask = {}, req = [], fixed = {};      // fixed: клетка → роль
      (A.gates || []).forEach(function (gt) { req.push(key(gt.c[0], gt.c[1])); fixed[key(gt.c[0], gt.c[1])] = 'child'; });
      AREAS.forEach(function (B) { (B.gates || []).forEach(function (gt) { if (gt.from === A.id) { req.push(key(gt.p[0], gt.p[1])); fixed[key(gt.p[0], gt.p[1])] = 'gate'; if (gt.type === 'bell') { req.push(key(gt.p[0], gt.p[1] - 1)); fixed[key(gt.p[0], gt.p[1] - 1)] = 'gate2'; } } }); });
      if (A.start) { req.unshift(key(A.start[0], A.start[1])); fixed[key(A.start[0], A.start[1])] = 'start'; }
      // какие стороны можно соединять у клеток ворот (остальное занято преградой)
      var rule = {};
      AREAS.forEach(function (B) { (B.gates || []).forEach(function (gt) {
        if (gt.from !== A.id) return;
        var dx = gt.c[0] - gt.p[0], dy = gt.c[1] - gt.p[1], gs = dx > 0 ? 'R' : dx < 0 ? 'L' : dy > 0 ? 'D' : 'U', pk = key(gt.p[0], gt.p[1]);
        if (gt.type === 'bell') { rule[pk] = 'U'; rule[key(gt.p[0], gt.p[1] - 1)] = 'LRUD'; }
        else if (gs === 'D') rule[pk] = 'LR';
        else rule[pk] = ({ L: 'R', R: 'L' }[gs]) + (gt.type === 'hook' ? 'U' : (gt.type === 'boots' || gt.type === 'gloves') ? 'D' : 'UD');
      }); });
      var OPP = { L: 'R', R: 'L', U: 'D', D: 'U' };
      function step(a, b, s) { if (rule[a] != null && rule[a].indexOf(s) < 0) return false; if (rule[b] != null && rule[b].indexOf(OPP[s]) < 0) return false; return true; }
      req.forEach(function (k) { if (areaOf[k] !== ai) throw new Error('клетка ворот вне области ' + A.id); });
      // маска: соединяем обязательные клетки путями, затем растим
      mask[req[0]] = 1;
      for (var q = 1; q < req.length; q++) if (!mask[req[q]]) pathTo(req[q]);
      function pathTo(tk) {
        var prev = {}, st = [tk], seen = {}; seen[tk] = 1; var found = -1;
        while (st.length) {
          var cur = st.shift(); if (mask[cur]) { found = cur; break; }
          var cx = cur % GW, cy = (cur / GW) | 0, ds = DIRS.slice(); for (var si = 3; si > 0; si--) { var sj = Math.floor(rng() * (si + 1)), st0 = ds[si]; ds[si] = ds[sj]; ds[sj] = st0; }   // перемешивание без sort (одинаково во всех движках)
          for (var d = 0; d < 4; d++) { var nx = cx + ds[d][0], ny = cy + ds[d][1]; if (!inArea(nx, ny)) continue; var nk = key(nx, ny); if (seen[nk]) continue; if (fixed[nk] && fixed[nk] !== 'gate2' && !mask[nk] && nk !== tk) continue; if (!step(cur, nk, ds[d][2])) continue; seen[nk] = 1; prev[nk] = cur; st.push(nk); }
        }
        if (found < 0) throw new Error('нет пути в области ' + A.id);
        for (var c = found; c !== undefined; c = prev[c]) mask[c] = 1;
      }
      var target = Math.round(A.fill * all.length);
      var guard = 0;
      while (Object.keys(mask).length < target && guard++ < 5000) {
        var front = [];
        Object.keys(mask).forEach(function (s) { s = +s; var x = s % GW, y = (s / GW) | 0; DIRS.forEach(function (d) { var nx = x + d[0], ny = y + d[1]; if (inArea(nx, ny) && !mask[key(nx, ny)]) front.push(key(nx, ny)); }); });
        if (!front.length) break;
        front.sort(function (a, b) { return a - b; });
        mask[front[Math.floor(rng() * front.length)]] = 1;
      }
      // расстояния от входа
      var entry = A.start ? key(A.start[0], A.start[1]) : key(A.gates[0].c[0], A.gates[0].c[1]);
      var dist = bfs(entry, function (k) { return mask[k]; });
      function bfs(s, ok) { var d = {}; d[s] = 0; var st = [s]; while (st.length) { var c = st.shift(), x = c % GW, y = (c / GW) | 0; DIRS.forEach(function (dd) { var nx = x + dd[0], ny = y + dd[1]; if (!inArea(nx, ny)) return; var nk = key(nx, ny); if (d[nk] == null && ok(nk) && step(c, nk, dd[2])) { d[nk] = d[c] + 1; st.push(nk); } }); } return d; }
      var role = {};   // клетка → роль спецкомнаты
      Object.keys(fixed).forEach(function (k) { role[k] = fixed[k]; });
      var maxD = 0; Object.keys(dist).forEach(function (k) { maxD = Math.max(maxD, dist[k]); });
      function free(k) { return mask[k] && !role[k]; }
      function connectedWithout(ex) { var ks = Object.keys(mask).filter(function (k) { return !ex[k]; }); if (!ks.length) return true; var d = bfs(+ks[0], function (k) { return mask[k] && !ex[k]; }); return ks.every(function (k) { return d[k] != null; }); }
      // босс: тройка по горизонтали «сохранение — арена — горн/сердце»
      if (A.boss) {
        var best = null;
        Object.keys(mask).forEach(function (s) {
          s = +s; var x = s % GW, y = (s / GW) | 0;
          [1, -1].forEach(function (dx) {
            var a = key(x + dx, y), f = key(x + 2 * dx, y), needF = A.boss.forge !== false;
            if (!inArea(x + dx, y) || !free(s) || role[a] || (mask[a] && !free(a))) return;
            if (needF && (!inArea(x + 2 * dx, y) || role[f] || (mask[f] && !free(f)))) return;
            var ex = {}; ex[a] = 1; if (needF) ex[f] = 1;
            if (!connectedWithout(ex)) return;
            var sc = (dist[s] || 0) * 10 + rng();
            if (!best || sc > best.sc) best = { s: s, a: a, f: needF ? f : -1, sc: sc };
          });
        });
        if (!best) throw new Error('нет места для арены в ' + A.id);
        mask[best.a] = 1; role[best.a] = 'arena'; role[best.s] = 'save';
        if (best.f >= 0) { mask[best.f] = 1; role[best.f] = A.boss.heart ? 'heart' : 'forge'; }
      }
      var cand = Object.keys(mask).map(Number).filter(free).sort(function (a, b) { return (dist[a] || 0) - (dist[b] || 0) || a - b; });
      if (A.lifts) { var lk = cand.filter(function (k) { return dist[k] >= 1 && dist[k] <= 3; })[0]; if (lk == null) lk = cand[1]; role[lk] = 'lift'; }
      if (A.shrine) { var sh = cand.filter(free); var sk = sh[Math.min(sh.length - 1, Math.floor(sh.length * 0.7))]; role[sk] = 'shrine'; }
      var nsave = (A.saves || 0) - (A.boss ? 1 : 0) - (A.start ? 1 : 0);
      for (var sv = 0; sv < nsave; sv++) { var fs = cand.filter(free); if (!fs.length) break; role[fs[Math.floor(fs.length * (sv + 1) / (nsave + 1.4))]] = 'save'; }
      if (A.start) role[entry] = 'start';
      // тайники: клетка вне маски рядом с обычной клеткой маски
      var treasureAt = [];
      (A.treasures || []).forEach(function (tr) {
        var opts = [];
        all.forEach(function (k) {
          if (mask[k] || role[k]) return; var x = k % GW, y = (k / GW) | 0;
          DIRS.forEach(function (d) {
            var nk = key(x + d[0], y + d[1]); if (!inArea(x + d[0], y + d[1]) || !mask[nk] || role[nk]) return;
            if (tr.bar === 'false' && d[1] !== 0) return;          // тайный ход — только сбоку
            if (tr.bar === 'bell' && d[1] !== 0) return;
            if ((tr.bar === 'hook' || tr.bar === 'hammer') && d[1] !== 0) return;
            opts.push({ k: k, n: nk, side: d[2] });                 // side — сторона двери тайника
          });
        });
        if (!opts.length) throw new Error('нет места для тайника в ' + A.id);
        opts.sort(function (a, b) { return a.k - b.k || a.n - b.n; });
        var o = opts[Math.floor(rng() * opts.length)];
        mask[o.k] = 1; role[o.k] = 'treasure'; treasureAt.push({ k: o.k, n: o.n, side: o.side, tr: tr });
      });
      // колокол-тайник — комната 1×2: ищем вторую клетку снизу
      // упаковка остальных клеток в комнаты
      var placed = {};
      Object.keys(role).forEach(function (k) {
        k = +k; if (placed[k] || !mask[k]) return; var r = role[k], x = k % GW, y = (k / GW) | 0;
        if (r === 'gate2') return;
        if (r === 'gate') {
          var big = role[key(x, y - 1)] === 'gate2';
          var rm = newRoom(ai, x, big ? y - 1 : y, 1, big ? 2 : 1, 'gate'); placed[k] = 1; if (big) placed[key(x, y - 1)] = 1; return;
        }
        if (r === 'treasure') {
          var tA = treasureAt.filter(function (t) { return t.k === k; })[0];
          if (tA.tr.bar === 'bell' && inArea(x, y + 1) && !mask[key(x, y + 1)] && !role[key(x, y + 1)] && tA.side !== 'D') {
            mask[key(x, y + 1)] = 1; placed[key(x, y + 1)] = 1; var rb = newRoom(ai, x, y, 1, 2, 'treasure'); rb.tr = tA; placed[k] = 1; return;
          }
          var rt = newRoom(ai, x, y, 1, 1, 'treasure'); rt.tr = tA; placed[k] = 1; return;
        }
        newRoom(ai, x, y, 1, 1, r === 'child' ? 'normal' : r); placed[k] = 1;
      });
      var rest = Object.keys(mask).map(Number).filter(function (k) { return !placed[k]; });
      rest.sort(function (a, b) { return a - b; });
      for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), tt = rest[i]; rest[i] = rest[j]; rest[j] = tt; }
      rest.forEach(function (k) {
        if (placed[k]) return; var x = k % GW, y = (k / GW) | 0;
        var sizes = [[2, 2, 2], [2, 1, 4], [1, 2, 3], [1, 1, 4]], pick = [];
        sizes.forEach(function (s) { for (var n = 0; n < s[2]; n++) pick.push(s); });
        for (var a2 = pick.length - 1; a2 > 0; a2--) { var b2 = Math.floor(rng() * (a2 + 1)), t2 = pick[a2]; pick[a2] = pick[b2]; pick[b2] = t2; }
        for (var p = 0; p < pick.length; p++) {
          var w = pick[p][0], h = pick[p][1], ok = true;
          for (var yy = y; yy < y + h && ok; yy++) for (var xx = x; xx < x + w && ok; xx++) { var kk = key(xx, yy); if (!inArea(xx, yy) || !mask[kk] || placed[kk] || role[kk]) ok = false; }
          if (!ok) continue;
          newRoom(ai, x, y, w, h, 'normal');
          for (yy = y; yy < y + h; yy++) for (xx = x; xx < x + w; xx++) placed[key(xx, yy)] = 1;
          break;
        }
      });
    });

    // ---------- связи ----------
    function roomAt(x, y) { return x < 0 || y < 0 || x >= GW || y >= GH ? null : (grid[key(x, y)] >= 0 ? rooms[grid[key(x, y)]] : null); }
    function sideOk(rm, side, other, gate) {
      var k = rm.kind;
      if (k === 'arena' || k === 'forge' || k === 'heart') return side === 'L' || side === 'R';
      if (rm.gateSide) { if (side === rm.gateSide) return !!gate; return (rm.allowSides || '').indexOf(side) >= 0; }
      return true;
    }
    function addDoor(A, B, side, k, kb, gate) {
      var opp = { L: 'R', R: 'L', U: 'D', D: 'U' }[side];
      var da = { side: side, k: k, to: B.i, gate: gate || null, own: true }, db = { side: opp, k: kb, to: A.i, gate: gate || null, own: false };
      A.doors.push(da); B.doors.push(db); edges.push({ a: A.i, b: B.i, side: side, gate: gate || null });
      return da;
    }
    // все сегменты общей границы A→B
    function segs(A, B) {
      var out = [];
      for (var y = A.gy; y < A.gy + A.h; y++) {
        if (roomAt(A.gx + A.w, y) === B) out.push({ side: 'R', k: y - A.gy, kb: y - B.gy });
        if (roomAt(A.gx - 1, y) === B) out.push({ side: 'L', k: y - A.gy, kb: y - B.gy });
      }
      for (var x = A.gx; x < A.gx + A.w; x++) {
        if (roomAt(x, A.gy + A.h) === B) out.push({ side: 'D', k: x - A.gx, kb: x - B.gx });
        if (roomAt(x, A.gy - 1) === B) out.push({ side: 'U', k: x - A.gx, kb: x - B.gx });
      }
      return out;
    }
    // межобластные ворота
    AREAS.forEach(function (A) {
      (A.gates || []).forEach(function (gt) {
        var par = roomAt(gt.p[0], gt.p[1]), ch = roomAt(gt.c[0], gt.c[1]);
        var s = segs(par, ch);
        if (gt.type === 'bell') s = s.filter(function (o) { return o.side === 'D'; });
        if (!s.length) throw new Error('ворота ' + A.id + ' — нет общей границы');
        var o = s[0];
        par.gateSide = o.side; par.gateType = gt.type;
        par.allowSides = o.side === 'D' ? (par.h === 2 ? 'LRU' : 'LR') : (gt.type === 'hook' ? ({ L: 'R', R: 'L' }[o.side] + 'U') : (gt.type === 'boots' || gt.type === 'gloves') ? ({ L: 'R', R: 'L' }[o.side] + 'D') : ({ L: 'R', R: 'L' }[o.side] + 'UD'));
        addDoor(par, ch, o.side, o.k, o.kb, gt.type);
      });
    });
    // спецкомнаты: арена/горн/сердце/тайник — заданные связи
    rooms.forEach(function (rm) {
      if (rm.kind === 'arena') {
        [-1, 1].forEach(function (dx) {
          var nb = roomAt(rm.gx + dx, rm.gy); if (!nb || nb.area !== rm.area) return;
          if (nb.kind === 'save' || nb.kind === 'forge' || nb.kind === 'heart') addDoor(rm, nb, dx > 0 ? 'R' : 'L', 0, nb.gy === rm.gy ? 0 : rm.gy - nb.gy, null);
        });
      }
      if (rm.kind === 'treasure') {
        var t = rm.tr, nb2 = rooms[grid[t.n]], s2 = segs(rm, nb2).filter(function (o) { return o.side === t.side || true; });
        var tx = t.k % GW, ty = (t.k / GW) | 0, nx = t.n % GW, ny = (t.n / GW) | 0;
        var want = nx > tx ? 'R' : nx < tx ? 'L' : ny > ty ? 'D' : 'U';
        var o2 = s2.filter(function (o) { return o.side === want && (want === 'L' || want === 'R' ? o.k === ty - rm.gy : o.k === tx - rm.gx); })[0] || s2[0];
        if (!sideOkForTreasure(nb2, { L: 'R', R: 'L', U: 'D', D: 'U' }[o2.side])) {
          throw new Error('тайник ' + rm.i + ': сосед не принимает дверь');
        }
        rm.tSide = o2.side;
        addDoor(rm, nb2, o2.side, o2.k, o2.kb, t.tr.bar === 'false' ? 'secret' : null);
      }
    });
    function sideOkForTreasure(nb, side) { return sideOk(nb, side, null, false); }
    // остовное дерево внутри областей
    var uf = rooms.map(function (r, i) { return i; });
    function find(a) { while (uf[a] !== a) { uf[a] = uf[uf[a]]; a = uf[a]; } return a; }
    function unite(a, b) { uf[find(a)] = find(b); }
    edges.forEach(function (e) { if (rooms[e.a].area === rooms[e.b].area) unite(e.a, e.b); });
    var cands = [], seenPair = {};
    rooms.forEach(function (A) {
      if (A.kind === 'forge' || A.kind === 'heart' || A.kind === 'treasure' || A.kind === 'arena') return;
      for (var y = A.gy - 1; y <= A.gy + A.h; y++) for (var x = A.gx - 1; x <= A.gx + A.w; x++) {
        var B = roomAt(x, y); if (!B || B === A || B.area !== A.area) continue;
        if (B.kind === 'forge' || B.kind === 'heart' || B.kind === 'treasure' || B.kind === 'arena') continue;
        var pk = Math.min(A.i, B.i) + ':' + Math.max(A.i, B.i); if (seenPair[pk]) continue; seenPair[pk] = 1;
        var ss = segs(A, B).filter(function (o) { return sideOk(A, o.side, B, false) && sideOk(B, { L: 'R', R: 'L', U: 'D', D: 'U' }[o.side], A, false); });
        if (ss.length) cands.push({ A: A, B: B, ss: ss });
      }
    });
    var erng = mulberry32(777);
    cands.forEach(function (c) { c.w = erng() + (c.ss.some(function (o) { return o.side === 'L' || o.side === 'R'; }) ? 0 : 0.35); });
    cands.sort(function (a, b) { return a.w - b.w; });
    var extra = [];
    cands.forEach(function (c) {
      if (find(c.A.i) !== find(c.B.i)) { unite(c.A.i, c.B.i); var o = pickSeg(c.ss); addDoor(c.A, c.B, o.side, o.k, o.kb, null); }
      else extra.push(c);
    });
    function pickSeg(ss) { var lr = ss.filter(function (o) { return o.side === 'L' || o.side === 'R'; }); var pool = lr.length ? lr : ss; return pool[Math.floor(erng() * pool.length)]; }
    extra.forEach(function (c) { if (erng() < 0.22) { var o = pickSeg(c.ss); addDoor(c.A, c.B, o.side, o.k, o.kb, null); } });
    // проверка связности областей
    AREAS.forEach(function (A, ai) {
      var rs = rooms.filter(function (r) { return r.area === ai; }), root = find(rs[0].i);
      if (global.DEBUGW) rs.forEach(function (r) { console.log(A.id, r.i, r.kind, r.gx, r.gy, r.w + 'x' + r.h, 'root', find(r.i), r.doors.map(function (d) { return d.side + d.to; }).join(' ')); });
      rs.forEach(function (r) { if (find(r.i) !== root) throw new Error('область ' + A.id + ' несвязна: комната ' + r.i + ' ' + r.kind + ' ' + r.gx + ',' + r.gy + ' ' + r.w + 'x' + r.h + ' gate=' + r.gateSide + ' doors=' + r.doors.map(function (d) { return d.side; }).join('')); });
    });
    // внутренние преграды из гарантированных способностей
    var frng = mulberry32(4242);
    rooms.forEach(function (rm) {
      var A = AREAS[rm.area]; if (!A.feat || !A.feat.length || rm.kind !== 'normal' || rm.w !== 1 || rm.h !== 1 || rm.gateSide) return;
      if (frng() > 0.42) return;
      var ds = rm.doors.filter(function (d) { return !d.gate && rooms[d.to].area === rm.area && rooms[d.to].kind !== 'treasure'; });
      if (!ds.length) return;
      var d = ds[Math.floor(frng() * ds.length)];
      var type = A.feat[Math.floor(frng() * A.feat.length)];
      var sides = rm.doors.map(function (x) { return x.side; });
      if (d.side === 'U') return;
      if (type === 'hammer' && d.side !== 'D') return;
      if (d.side === 'D') { if (sides.indexOf('U') >= 0) return; if (type === 'boots' || type === 'gloves') { /* стенки вокруг люка */ } }
      else if (type === 'hook' && sides.indexOf('D') >= 0) return;
      else if ((type === 'boots' || type === 'gloves') && sides.indexOf('U') >= 0) return;
      if (type === 'cloak' && d.side !== 'D') { /* тоннель жара */ }
      if (sides.filter(function (s) { return s === d.side; }).length > 1) return;
      rm.gateSide = d.side; rm.gateType = type; rm.internal = true;
      d.gate = type; var back = rooms[d.to].doors.filter(function (x) { return x.to === rm.i && x.side === { L: 'R', R: 'L', U: 'D', D: 'U' }[d.side]; })[0]; if (back) back.gate = type;
      d.own = true; if (back) back.own = false;
    });

    // ---------- клетки комнат ----------
    rooms.forEach(function (rm) { buildRoom(rm); P.phys.roomFlags(rm); });

    // ---------- предметы и объекты: сквозные id ----------
    var anvilN = 0, liftN = 0;
    rooms.forEach(function (rm) {
      rm.items.forEach(function (it) { it.id = items.length; it.room = rm.i; items.push(it); });
      rm.objs.forEach(function (o) {
        if (o.type === 'anvil') { o.id = anvilN++; anvils.push({ room: rm.i, x: o.x, y: o.y, id: o.id }); }
        if (o.type === 'lift') { o.id = liftN++; lifts.push({ room: rm.i, x: o.x, y: o.y, id: o.id, zone: rm.zone }); }
        if (o.type === 'forge') forges[o.fid] = { room: rm.i, x: o.x, y: o.y, id: o.fid };
        if (o.type === 'boss') bossRooms[o.boss] = rm.i;
      });
    });
    // группы открываемых клеток (ломкие полы, чугун, световые двери, ложные стены, печать) — id для сохранений
    var groups = [], OPENABLE = {}; [T.CRACK, T.IRON, T.LIGHT, T.FALSE, T.SEAL].forEach(function (k) { OPENABLE[k] = 1; });
    rooms.forEach(function (rm) {
      rm.gAt = new Int16Array(rm.W * rm.H).fill(-1); rm.groups = [];
      for (var r = 0; r < rm.H; r++) for (var c = 0; c < rm.W; c++) {
        var k = rm.t[r * rm.W + c]; if (!OPENABLE[k] || rm.gAt[r * rm.W + c] >= 0) continue;
        var cells = P.phys.group(rm, c, r), id = groups.length;
        cells.forEach(function (p) { rm.gAt[p[1] * rm.W + p[0]] = id; });
        groups.push({ id: id, room: rm.i, kind: k, cells: cells }); rm.groups.push(id);
      }
    });
    var startRoom = rooms.filter(function (r) { return r.kind === 'start'; })[0];
    var W = {
      rooms: rooms, areas: AREAS, zones: ZONES, items: items, groups: groups, anvils: anvils, lifts: lifts, forges: forges, bossRooms: bossRooms,
      GW: GW, GH: GH, CW: CW, CH: CH, grid: grid, abil: ABIL, bosses: BOSSES,
      start: { room: startRoom.i, x: startRoom.objs.filter(function (o) { return o.type === 'anvil'; })[0].x, y: startRoom.H - 3, anvil: startRoom.objs.filter(function (o) { return o.type === 'anvil'; })[0].id },
      roomAt: roomAt
    };
    return W;
  }

  // ---------- построение клеток комнаты ----------
  function buildRoom(rm) {
    var W = rm.W, H = rm.H, G = H - 3, t = new Uint8Array(W * H), prot = new Uint8Array(W * H);
    var A = AREAS[rm.area], zone = ZONES[rm.zone].id;
    var rng = mulberry32(hashStr('room:' + rm.gx + ',' + rm.gy + ':' + A.id));
    rm.t = t; rm.dark = !!A.dark;
    t.fill(T.ROCK);
    function set(c, r, k) { if (c >= 0 && c < W && r >= 0 && r < H) t[r * W + c] = k; }
    function get(c, r) { return c >= 0 && c < W && r >= 0 && r < H ? t[r * W + c] : T.ROCK; }
    function fill(c0, r0, c1, r1, k) { for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) set(c, r, k); }
    function protect(c0, r0, c1, r1) { for (var r = Math.max(0, r0); r <= Math.min(H - 1, r1); r++) for (var c = Math.max(0, c0); c <= Math.min(W - 1, c1); c++) prot[r * W + c] = 1; }
    function isProt(c0, r0, c1, r1) { for (var r = Math.max(0, r0); r <= Math.min(H - 1, r1); r++) for (var c = Math.max(0, c0); c <= Math.min(W - 1, c1); c++) if (prot[r * W + c]) return true; return false; }
    fill(1, 1, W - 2, G - 1, T.AIR);
    var mir = function (c) { return c; };
    // башня мостков от строки top вниз до пола (шаг 3)
    function tower(c0, c1, top) {
      var r = top, sh = 0;
      while (G - r > 3) { r += 3; sh = sh ? 0 : 1; var a = c0 + (sh ? 1 : 0) - (sh ? 0 : 0), b = c1 + (sh ? 1 : 0); fill(a, r, b, r, T.ONE); }
      protect(c0 - 2, top - 3, c1 + 3, G);
    }
    var hasGroundDoorL = false, hasGroundDoorR = false;
    rm.doors.forEach(function (d) {
      if (d.side === 'L' || d.side === 'R') {
        var col = d.side === 'L' ? 0 : W - 1, base = d.k * CH;
        fill(col, base + 16, col, base + 18, T.AIR);
        if (d.k < rm.h - 1) {
          var a = d.side === 'L' ? 1 : W - 7, b = d.side === 'L' ? 6 : W - 2;
          fill(a, base + 19, b, base + 20, T.ROCK);
          var ta = d.side === 'L' ? 7 : W - 11, tb = ta + 3;
          fill(ta, base + 19, tb, base + 19, T.ONE);
          tower(ta, tb, base + 19);
          protect(a - 1, base + 12, b + 1, base + 20);
        } else { if (d.side === 'L') hasGroundDoorL = true; else hasGroundDoorR = true; protect(d.side === 'L' ? 0 : W - 7, G - 6, d.side === 'L' ? 6 : W - 1, G); }
      } else if (d.side === 'U') {
        var x0 = d.k * CW;
        fill(x0 + 18, 0, x0 + 21, 0, T.AIR);
        fill(x0 + 16, 2, x0 + 23, 2, T.ONE);
        tower(x0 + 17, x0 + 21, 2);
        protect(x0 + 14, 0, x0 + 25, 4);
      } else {
        var x1 = d.k * CW;
        fill(x1 + 18, G, x1 + 21, H - 2, T.AIR); fill(x1 + 18, H - 1, x1 + 21, H - 1, T.ONE);
        protect(x1 + 14, G - 5, x1 + 25, H - 1);
      }
    });
    rm.groundDoors = { L: hasGroundDoorL, R: hasGroundDoorR };

    // --- преграды ворот/тайников ---
    function barrierLR(type, side, target) {
      var M = side === 'R' ? function (c) { return c; } : function (c) { return W - 1 - c; };
      var F = function (a, r0, b, r1, k) { var x0 = Math.min(M(a), M(b)), x1 = Math.max(M(a), M(b)); fill(x0, r0, x1, r1, k); };
      var PR = function (a, r0, b, r1) { var x0 = Math.min(M(a), M(b)), x1 = Math.max(M(a), M(b)); protect(x0, r0, x1, r1); };
      var item = { x: M(36) + 0.5, y: 19 };
      PR(24, 1, 39, 21);
      switch (type) {
        case 'boots': F(31, 14, 32, 18, T.ROCK); break;
        case 'gloves': F(31, 6, 32, 18, T.ROCK); break;
        case 'dash': F(31, 1, 31, 18, T.STEAM); break;
        case 'light': F(33, 1, 34, 18, T.LIGHT); break;
        case 'false': F(33, 1, 34, 18, T.FALSE); break;
        case 'cloak': F(24, 1, 38, 15, T.ROCK); F(24, 16, 38, 18, T.HEAT); item.x = M(37) + 0.5; break;
        case 'hook':
          F(10, 19, 31, 20, T.AIR); F(10, 20, 31, 20, T.SPIKE); PR(8, 1, 39, 21);
          [14, 20, 26].forEach(function (c) { rm.rings.push({ x: M(c) + 0.5, y: 11.5 }); });
          break;
        case 'hammer':
          F(26, 16, 38, 21, T.ROCK); F(28, 18, 36, 19, T.AIR); F(30, 16, 33, 17, T.CRACK); item.x = M(32) + 0.5; item.y = 20; break;
        case 'none': break;
      }
      return item;
    }
    function barrierD(type) {
      protect(4, 1, 35, 21);
      switch (type) {
        case 'boots': fill(14, 14, 15, 18, T.ROCK); fill(24, 14, 25, 18, T.ROCK); break;
        case 'gloves': fill(14, 6, 15, 18, T.ROCK); fill(24, 6, 25, 18, T.ROCK); break;
        case 'dash': fill(15, 1, 15, 18, T.STEAM); fill(24, 1, 24, 18, T.STEAM); break;
        case 'hook':
          fill(4, 19, 15, 20, T.AIR); fill(4, 20, 15, 20, T.SPIKE); fill(24, 19, 35, 20, T.AIR); fill(24, 20, 35, 20, T.SPIKE);
          [7, 13, 26, 32].forEach(function (c) { rm.rings.push({ x: c + 0.5, y: 11.5 }); });
          break;
        case 'cloak': {
          var wet = !!A.water, hk = wet ? T.HOTW : T.HEAT;
          fill(15, 14, 15, 18, T.ROCK); fill(24, 14, 24, 18, T.ROCK); fill(16, 10, 23, 18, hk); fill(18, 19, 21, 20, hk);
          break;
        }
        case 'light': fill(18, 19, 21, 20, T.LIGHT); break;
        case 'hammer': fill(18, 19, 21, 20, T.CRACK); break;
        case 'seal': fill(18, 19, 21, 20, T.SEAL); break;
      }
    }
    if (rm.gateSide && rm.kind === 'gate' && rm.gateType === 'bell') {
      // зал-колодец 1×2: нижний экран затоплен, люк на дне
      fill(1, 26, W - 2, G - 1, T.WATER); fill(18, G, 21, H - 1, T.WATER);
      protect(1, 20, W - 2, H - 1);
      fill(12, 24, 16, 24, T.ONE); fill(23, 24, 27, 24, T.ONE); fill(7, 22, 10, 22, T.ONE); fill(W - 11, 22, W - 8, 22, T.ONE);
    } else if (rm.gateSide) {
      if (rm.gateSide === 'D') barrierD(rm.gateType); else barrierLR(rm.gateType, rm.gateSide, 'door');
    }
    if (rm.kind === 'treasure') {
      var tr = rm.tr.tr, it;
      if (rm.h === 2) {   // затопленный колодец с сосудом на дне
        fill(1, 26, W - 2, G - 1, T.WATER); protect(1, 20, W - 2, H - 1);
        fill(12, 24, 16, 24, T.ONE); fill(23, 24, 27, 24, T.ONE); fill(7, 22, 10, 22, T.ONE); fill(W - 11, 22, W - 8, 22, T.ONE);
        it = { x: 20, y: G };
      } else {
        var ps = rm.tSide === 'R' ? 'L' : 'R';
        it = barrierLR(tr.bar === 'false' ? 'false' : tr.bar, ps, 'item');
        if (tr.bar === 'false') fill(ps === 'R' ? 33 : 5, 1, ps === 'R' ? 34 : 6, 18, T.AIR);   // в тайнике стенка не нужна — дверь ложная у соседа
      }
      rm.items.push({ type: tr.item, x: it.x, y: it.y, bar: tr.bar });
    }
    // тайные двери: ложная стена в проёме у соседа тайника
    rm.doors.forEach(function (d) {
      if (d.gate !== 'secret' || d.own) return;
      var base = d.k * CH;
      if (d.side === 'L') fill(0, base + 16, 0, base + 18, T.FALSE);
      else if (d.side === 'R') fill(W - 1, base + 16, W - 1, base + 18, T.FALSE);
    });

    // --- спецкомнаты ---
    var cx = Math.floor(W / 2);
    if (rm.w === 1 && rm.doors.some(function (d) { return d.side === 'U' || d.side === 'D'; })) cx = 11;
    if (rm.kind === 'save' || rm.kind === 'start') { rm.objs.push({ type: 'anvil', x: cx + 0.5 - (rm.kind === 'start' ? 6 : 0), y: G }); protect(cx - 8, G - 5, cx + 4, G); }
    if (rm.kind === 'lift') { rm.objs.push({ type: 'lift', x: cx + 0.5, y: G }); protect(cx - 4, G - 6, cx + 4, G); }
    if (rm.kind === 'shrine') { fill(cx - 3, G - 1, cx + 2, G - 1, T.ROCK); rm.items.push({ type: 'ab:' + A.shrine, x: cx + 0.5 - 0.5, y: G - 1 }); protect(cx - 6, G - 7, cx + 6, G); }
    if (rm.kind === 'forge') { rm.objs.push({ type: 'forge', x: cx, y: G, fid: A.boss.forge }); protect(cx - 6, G - 7, cx + 6, G); }
    if (rm.kind === 'heart') { rm.objs.push({ type: 'heart', x: cx, y: G }); protect(1, 1, W - 2, G); }
    if (rm.kind === 'arena') {
      rm.objs.push({ type: 'boss', boss: A.boss.id, x: cx, y: G });
      fill(5, 16, 10, 16, T.ONE); fill(W - 11, 16, W - 6, 16, T.ONE); fill(cx - 3, 12, cx + 2, 12, T.ONE);
      protect(1, 1, W - 2, G);
      if (A.boss.reward) rm.items.push({ type: 'ab:' + A.boss.reward, x: cx, y: G, boss: A.boss.id });
      else if (!A.boss.heart) rm.items.push({ type: 'vessel', x: cx, y: G, boss: A.boss.id });
    }
    if (A.water && rm.kind !== 'arena' && rm.kind !== 'forge') {
      for (var i = 0; i < t.length; i++) if (t[i] === T.AIR) t[i] = T.WATER; else if (t[i] === T.HEAT) t[i] = T.HOTW;
      rm.wet = true;
    }

    // --- рельеф пола (нижний ряд экранов) ---
    var special = rm.kind !== 'normal' && rm.kind !== 'gate';
    if (!special && !(rm.gateSide && rm.gateType === 'bell')) {
      var c = 7;
      while (c < W - 8) {
        var wdt = 2 + Math.floor(rng() * 6);
        if (isProt(c - 1, G - 4, c + wdt + 1, G)) { c += 2; continue; }
        var roll = rng(), wet = !!A.water;
        if (wet) { c += wdt + 3; continue; }
        if (roll < 0.34) { var hgt = 1 + Math.floor(rng() * 3), ww2 = wdt + Math.floor(rng() * 4); if (isProt(c - 1, G - 5, c + ww2 + 1, G)) { c += 2; continue; } fill(c, G - hgt, c + ww2 - 1, G - 1, T.ROCK); if (hgt === 3) fill(c - 1, G - 1, c - 1, G - 1, T.ROCK); protect(c - 1, G - hgt - 4, c + ww2, G); wdt = ww2; }
        else if (roll < 0.5) { var pw = Math.min(3, wdt); fill(c, G, c + pw - 1, G, T.SPIKE); protect(c - 2, G - 6, c + pw + 1, G); wdt = pw; }
        else if (roll < 0.65 && (zone === 'flood' || zone === 'gardens')) { var ww = Math.max(4, wdt); fill(c, G, c + ww - 1, G + 1, T.WATER); protect(c - 1, G - 4, c + ww, G + 1); wdt = ww; }
        else if (roll < 0.75 && zone === 'ice') { fill(c, G, c + wdt + 2, G, T.ICE); wdt += 2; }
        else if (roll < 0.8 && zone === 'hot') { fill(c, G - 4, c + 1, G - 1, T.HEAT); protect(c - 1, G - 5, c + 2, G); }
        c += wdt + 3 + Math.floor(rng() * 4);
      }
      // своды: каменные наплывы с потолка (только верхний экран, высоко над полом)
      for (var cc = 2; cc < W - 3; ) {
        var cw = 3 + Math.floor(rng() * 6), cd = 1 + Math.floor(rng() * 4);
        if (rng() < 0.55 && !isProt(cc - 1, 0, cc + cw, cd + 3) && cd + 9 < G) { fill(cc, 1, cc + cw - 1, cd, T.ROCK); if (cd > 1 && cw > 3) fill(cc + 1, cd + 1, cc + cw - 2, cd + 1, T.ROCK); protect(cc - 1, 0, cc + cw, cd + 4); }
        cc += cw + 1 + Math.floor(rng() * 5);
      }
      // выступы стен (опора для отскоков и ниши)
      ['L', 'R'].forEach(function (sd) {
        for (var rr2 = 3; rr2 < H - 6; ) {
          var bh = 3 + Math.floor(rng() * 6), bw = 1 + Math.floor(rng() * 3);
          var c0 = sd === 'L' ? 1 : W - 1 - bw, c1 = sd === 'L' ? bw : W - 2;
          if (rng() < 0.5 && !isProt(c0 - 1, rr2 - 2, c1 + 3, rr2 + bh + 2) && rr2 + bh < G - 3) { fill(c0, rr2, c1, rr2 + bh - 1, T.ROCK); protect(c0 - 1, rr2 - 3, c1 + 3, rr2 + bh + 2); }
          rr2 += bh + 2 + Math.floor(rng() * 4);
        }
      });
      // полки в высоких залах: каменный ярус от стены на стыке экранов (край — мостки)
      for (var lv = 1; lv < rm.h; lv++) {
        var ry = lv * CH - 1, sdl = rng() < 0.5 ? 'L' : 'R', sl = 8 + Math.floor(rng() * 8);
        var s0 = sdl === 'L' ? 1 : W - 1 - sl, s1 = sdl === 'L' ? sl : W - 2;
        if (!isProt(s0, ry - 4, s1, ry + 4)) { fill(s0, ry, s1, ry + 1, T.ROCK); var e0 = sdl === 'L' ? s1 + 1 : s0 - 4; fill(e0, ry, e0 + 3, ry, T.ONE); protect(s0 - 1, ry - 4, s1 + 1, ry + 4); }
      }
      // острова и мостки в воздухе
      var tries = Math.floor(W * H / 110);
      for (var n = 0; n < tries; n++) {
        var iw = 3 + Math.floor(rng() * 6), ix = 3 + Math.floor(rng() * (W - iw - 6)), iy = 4 + Math.floor(rng() * (G - 11));
        var solidIsl = rng() < 0.5 && !A.water;
        if (isProt(ix - 3, iy - 4, ix + iw + 2, iy + 5)) continue;
        if (iy > G - 7) continue;
        fill(ix, iy, ix + iw - 1, iy + (solidIsl ? 1 : 0), solidIsl ? T.ROCK : T.ONE);
        protect(ix - 2, iy - 3, ix + iw + 1, iy + 3);
      }
      // ледяные мостки и жар — по зонам
    }
    if (zone === 'ice' && !special) for (var j = 0; j < t.length; j++) if (t[j] === T.ROCK && j >= W && t[j - W] === T.AIR && rng() < 0.08) t[j] = T.ICE;

    // --- враги ---
    if (!special && rm.kind !== 'gate') {
      var pool = ENEMY_POOL[zone], nE = Math.min(6, Math.round(rm.w * rm.h * (1.2 + rng() * 1.6)));
      for (var e = 0; e < nE; e++) {
        var type = pool[Math.floor(rng() * pool.length)];
        if (type === 'fish' && !A.water) type = 'flyer';
        if (A.water && type !== 'fish' && rng() < 0.7) type = 'fish';
        var ex = 8 + Math.floor(rng() * (W - 16)), ey;
        if (type === 'flyer' || type === 'wisp' || type === 'fish') { ey = 4 + Math.floor(rng() * (G - 8)); if (get(ex, ey) !== T.AIR && get(ex, ey) !== T.WATER) continue; }
        else if (type === 'icicle') { ey = -1; for (var r2 = 1; r2 < G - 6; r2++) if (get(ex, r2) !== T.ROCK && get(ex, r2 - 1) === T.ROCK && get(ex, r2) === T.AIR) { ey = r2; break; } if (ey < 0) continue; }
        else { ey = -1; for (var r3 = G; r3 > 3; r3--) { var k3 = get(ex, r3); if ((k3 === T.ROCK || k3 === T.ICE) && get(ex, r3 - 1) === T.AIR && get(ex, r3 - 2) === T.AIR && get(ex - 1, r3) !== T.AIR && get(ex + 1, r3) !== T.AIR) { ey = r3; break; } } if (ey < 0) continue; }
        if (Math.abs(ex - 2) < 9 && rm.groundDoors.L || Math.abs(ex - W + 2) < 9 && rm.groundDoors.R) continue;
        rm.ens.push({ type: type, x: ex + 0.5, y: ey });
      }
    }
  }

  // переход между комнатами: центр героини вышел за край → соседняя комната по мировой сетке
  function cross(W, ri, h) {
    var rm = W.rooms[ri], cy = h.y - P.K.HH / 2;
    if (h.x >= 0 && h.x < rm.W && cy >= 0 && cy < rm.H) return ri;
    var wx = rm.gx * CW + h.x, wy = rm.gy * CH + cy, nr = W.roomAt(Math.floor(wx / CW), Math.floor(wy / CH));
    if (!nr || nr === rm) return ri;
    h.x = wx - nr.gx * CW; h.y = wy - nr.gy * CH + P.K.HH / 2; h.hook = null;
    return nr.i;
  }
  var cache = null;
  P.cross = cross;
  P.CW = CW; P.CH = CH; P.GW = GW; P.GH = GH; P.AREAS = AREAS; P.ZONES = ZONES; P.ABIL = ABIL; P.BOSSES = BOSSES;
  P.buildWorld = buildWorld; P.mulberry32 = mulberry32; P.hashStr = hashStr;
  P.WORLD = function () { return cache || (cache = buildWorld()); };
})(typeof window !== 'undefined' ? window : globalThis);
