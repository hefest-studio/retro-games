/* СБОРКА · карты Долины Заводов: 5 карт кампании + свободная схватка (по сиду).
   Генератор строит центрально-симметричную долину (честно для обеих сторон): камни, болота, скальные гряды,
   заводы парами, дороги от баз. Затем проверяет проходимость и, если нужно, прокладывает дороги.
   SBORKA.maps = { T, TS, FT, MAPS, skirmish(seed), genMap(spec), mulberry32 } */
(function (global) {
  'use strict';
  var SB = global.SBORKA = global.SBORKA || {};
  var TS = 16;
  var T = { GROUND: 0, ROCK: 1, SWAMP: 2, CLIFF: 3, ROAD: 4 };
  // Размеры заводов в клетках; base — генеральный завод-база (свой у каждой стороны)
  var FT = { base: { w: 3, h: 3 }, metal: { w: 2, h: 2 }, energy: { w: 2, h: 2 }, drive: { w: 2, h: 2 }, arms: { w: 2, h: 2 }, chips: { w: 2, h: 2 } };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Карты кампании: размер, сид, плотность рельефа, нейтральные заводы (парами — по половине на сторону), уровень ИИ
  var MAPS = [
    { id: 1, key: 'm1', w: 50, h: 34, seed: 1101, rock: 5, swamp: 2, cliff: 3, roads: 2, neutral: ['metal', 'energy', 'drive', 'arms'], lvl: 0, biome: 'meadow' },
    { id: 2, key: 'm2', w: 58, h: 38, seed: 2207, rock: 8, swamp: 3, cliff: 4, roads: 2, neutral: ['metal', 'energy', 'drive', 'arms', 'chips', 'metal'], lvl: 1, biome: 'meadow' },
    { id: 3, key: 'm3', w: 64, h: 42, seed: 3313, rock: 7, swamp: 9, cliff: 5, roads: 2, neutral: ['metal', 'energy', 'drive', 'arms', 'chips', 'energy'], lvl: 2, biome: 'marsh' },
    { id: 4, key: 'm4', w: 70, h: 46, seed: 4421, rock: 12, swamp: 5, cliff: 8, roads: 2, neutral: ['metal', 'energy', 'drive', 'arms', 'chips', 'arms', 'metal', 'drive'], lvl: 3, biome: 'rust' },
    { id: 5, key: 'm5', w: 78, h: 50, seed: 5531, rock: 13, swamp: 8, cliff: 9, roads: 3, neutral: ['metal', 'energy', 'drive', 'arms', 'chips', 'energy', 'arms', 'metal', 'chips', 'drive'], lvl: 4, biome: 'rust' }
  ];
  var KINDS = ['metal', 'energy', 'drive', 'arms', 'chips'];
  function skirmish(seed) {
    var r = mulberry32(seed * 31 + 7), n = 3 + Math.floor(r() * 3), nl = [];
    for (var i = 0; i < n; i++) nl.push(KINDS[i < 5 ? i : Math.floor(r() * 5)], KINDS[Math.floor(r() * 5)]);
    var biomes = ['meadow', 'marsh', 'rust'];
    return { id: 0, key: 'sk', w: 60 + Math.floor(r() * 3) * 4, h: 40 + Math.floor(r() * 3) * 2, seed: seed, rock: 6 + Math.floor(r() * 7), swamp: 2 + Math.floor(r() * 6),
      cliff: 3 + Math.floor(r() * 5), roads: 2, neutral: nl, lvl: 2, biome: biomes[Math.floor(r() * 3)] };
  }

  // Путь «прокладчика дорог»: A* по клеткам с ценой рельефа (скалы дороже), всё проходимо
  function carvePath(w, h, t, sx, sy, gx, gy) {
    var N = w * h, g = new Float64Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [];
    var cost = [1, 2.2, 2.6, 7, 0.6];
    function push(i, f) { heap.push([f, i]); var k = heap.length - 1; while (k > 0) { var p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; var q = heap[p]; heap[p] = heap[k]; heap[k] = q; k = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var k = 0; for (;;) { var l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; var q = heap[m]; heap[m] = heap[k]; heap[k] = q; k = m; } } return top; }
    var s = sy * w + sx, goal = gy * w + gx; g[s] = 0; push(s, 0);
    while (heap.length) {
      var c = pop()[1]; if (closed[c]) continue; closed[c] = 1; if (c === goal) break;
      var cx = c % w, cy = (c / w) | 0;
      for (var d = 0; d < 4; d++) {
        var nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
        var ni = ny * w + nx; if (closed[ni]) continue;
        var ng = g[c] + cost[t[ni]];
        if (ng < g[ni]) { g[ni] = ng; from[ni] = c; push(ni, ng + (Math.abs(nx - gx) + Math.abs(ny - gy)) * 0.6); }
      }
    }
    var out = [], k = goal; if (from[k] < 0 && k !== s) return out;
    while (k >= 0) { out.push(k); if (k === s) break; k = from[k]; }
    return out;
  }
  // Компоненты связности по проходимости pass[t] > 0 (4 стороны)
  function components(w, h, t, pass) {
    var lab = new Int32Array(w * h).fill(-1), id = 0, st = [];
    for (var i = 0; i < w * h; i++) {
      if (lab[i] >= 0 || !pass[t[i]]) continue;
      lab[i] = id; st.push(i);
      while (st.length) {
        var c = st.pop(), cx = c % w, cy = (c / w) | 0;
        for (var d = 0; d < 4; d++) {
          var nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var ni = ny * w + nx; if (lab[ni] < 0 && pass[t[ni]]) { lab[ni] = id; st.push(ni); }
        }
      }
      id++;
    }
    return lab;
  }
  function padTile(f) { var s = FT[f.type]; return { x: f.tx + (s.w >> 1), y: f.ty + (s.h >> 1) }; }

  function genMap(spec) {
    var rnd = mulberry32(spec.seed), w = spec.w, h = spec.h, t = new Array(w * h).fill(T.GROUND);
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < w && y < h) t[y * w + x] = v; }
    function patch(type, n, rmin, rmax) {
      for (var i = 0; i < n; i++) {
        var cx = 2 + Math.floor(rnd() * (w - 4)), cy = 2 + Math.floor(rnd() * (h - 4)), r = rmin + rnd() * (rmax - rmin);
        for (var dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (var dx = -Math.ceil(r); dx <= Math.ceil(r); dx++)
          if (dx * dx + dy * dy <= r * r * (0.55 + 0.6 * rnd())) set(cx + dx, cy + dy, type);
      }
    }
    patch(T.ROCK, spec.rock, 1.6, 4.2);
    patch(T.SWAMP, spec.swamp, 1.8, 4.5);
    for (var i = 0; i < spec.cliff; i++) {   // скальные гряды
      var x = 3 + Math.floor(rnd() * (w - 6)), y = 3 + Math.floor(rnd() * (h - 6)), len = 5 + Math.floor(rnd() * 9), dir = Math.floor(rnd() * 8);
      for (var k = 0; k < len; k++) {
        set(x, y, T.CLIFF); if (rnd() < 0.4) set(x + 1, y, T.CLIFF);
        x += [1, 1, 0, -1, -1, -1, 0, 1][dir]; y += [0, 1, 1, 1, 0, -1, -1, -1][dir];
        if (rnd() < 0.25) dir = (dir + (rnd() < 0.5 ? 1 : 7)) % 8;
      }
    }
    // центральная симметрия: нижняя половина — зеркало верхней
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      var a = yy * w + xx, b = (h - 1 - yy) * w + (w - 1 - xx);
      if (a > b) t[a] = t[b];
    }
    for (var bx = 0; bx < w; bx++) { set(bx, 0, T.CLIFF); set(bx, h - 1, T.CLIFF); }
    for (var by = 0; by < h; by++) { set(0, by, T.CLIFF); set(w - 1, by, T.CLIFF); }
    function mirrorF(f) { var s = FT[f.type]; return { type: f.type, tx: w - f.tx - s.w, ty: h - f.ty - s.h, owner: f.owner < 0 ? -1 : 1 - f.owner }; }
    var pb = { type: 'base', tx: 3, ty: h - 6, owner: 0 }, facs = [pb, mirrorF(pb)];
    function farEnough(f, minD) {
      var p = padTile(f), q = padTile(mirrorF(f));
      if (Math.hypot(p.x - q.x, p.y - q.y) < minD) return false;
      for (var j = 0; j < facs.length; j++) { var o = padTile(facs[j]); if (Math.hypot(p.x - o.x, p.y - o.y) < minD) return false; }
      return true;
    }
    var pairs = spec.neutral.length >> 1;
    for (var n = 0; n < pairs; n++) {
      var minD = Math.max(7, Math.min(w, h) * 0.24), placed = false;
      for (var tries = 0; tries < 400 && !placed; tries++) {
        if (tries && tries % 100 === 0) minD *= 0.85;
        // половина ближе к игроку (снизу-слева): x + y·(w/h) > ...
        var f = { type: spec.neutral[n * 2], tx: 3 + Math.floor(rnd() * (w - 8)), ty: 3 + Math.floor(rnd() * (h - 8)), owner: -1 };
        var c = padTile(f); if ((c.x / w) - (c.y / h) > -0.08) continue;   // на стороне игрока
        if (!farEnough(f, minD)) continue;
        facs.push(f); var m = mirrorF(f); m.type = spec.neutral[n * 2 + 1] || f.type; facs.push(m); placed = true;
      }
    }
    // дворы заводов — ровная земля с полем в клетку
    facs.forEach(function (f) { var s = FT[f.type]; for (var dy = -1; dy <= s.h; dy++) for (var dx = -1; dx <= s.w; dx++) { var X = f.tx + dx, Y = f.ty + dy; if (X > 0 && Y > 0 && X < w - 1 && Y < h - 1) t[Y * w + X] = T.GROUND; } });
    function road(a, b) {
      var p = carvePath(w, h, t, a.x, a.y, b.x, b.y);
      p.forEach(function (i) { var X = i % w, Y = (i / w) | 0; t[i] = T.ROAD; t[(h - 1 - Y) * w + (w - 1 - X)] = T.ROAD; });
    }
    var pp = padTile(facs[0]), ep = padTile(facs[1]);
    road(pp, ep);   // главная дорога между базами — колёса всегда доезжают до противника
    // дороги к ближайшим нейтральным заводам своей половины
    var mine = facs.filter(function (f, i) { return i >= 2 && i % 2 === 0; }).sort(function (a, b) { var A = padTile(a), B = padTile(b); return Math.hypot(A.x - pp.x, A.y - pp.y) - Math.hypot(B.x - pp.x, B.y - pp.y); });
    for (var r = 0; r < Math.min(spec.roads, mine.length); r++) road(pp, padTile(mine[r]));
    // проверка: каждый завод достижим гусеницами от обеих баз, иначе — дорога
    var tracksPass = [1, 1, 0, 0, 1];
    for (var pass = 0; pass < 3; pass++) {
      var lab = components(w, h, t, tracksPass), bl = lab[pp.y * w + pp.x], fixed = false;
      facs.forEach(function (f) { var q = padTile(f); if (lab[q.y * w + q.x] !== bl) { road(pp, q); fixed = true; } });
      if (!fixed) break;
    }
    return { w: w, h: h, t: t, factories: facs, seed: spec.seed, biome: spec.biome || 'meadow' };
  }

  SB.maps = { T: T, TS: TS, FT: FT, MAPS: MAPS, KINDS: KINDS, skirmish: skirmish, genMap: genMap, components: components, padTile: padTile, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
