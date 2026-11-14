/* МАЯЧНИЦА · widgets.js — механизмы в сцене и мини-игры крупным планом (чистая логика, без DOM).
   Тип механизма: { init(def) → local, act(def, L, i) → {ok?, fail?}, solved(def, L), view(def, L, t) → {objId: state},
   moves(def, L) → [i…] (для поиска решения в тестах/боте), key(L) — ключ состояния }.
   Мини-игры ещё дают scene(def, L, t, rt) — сцену крупного плана из kind контракта (рисует тема), и hit(def, L, x, y, t) → i | -1. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];          // N E S W
  var OPEN = { I: [0, 2], L: [0, 1], T: [0, 1, 2], X: [0, 1, 2, 3] };
  function bg(mood, extra) {
    var items = mood === 'night'
      ? [{ kind: 'sky' }, { kind: 'moon', x: 820, y: 40, w: 40, h: 40 }, { kind: 'cloud', x: 80, y: 60, w: 140, h: 40, seed: 3 }]
      : [{ kind: 'wall', x: 0, y: 0, w: 960, h: 540, seed: 21 }];
    return [{ depth: 0, items: items.concat(extra || []) }];
  }
  function closeup(def, objs, extra) {
    return { id: 'mini_' + def.id, w: 960, h: 540, mood: def.mood || 'indoor', layers: bg(def.mood, extra), objects: objs, hotspots: [], walk: [[0, 540], [960, 540]], hero: { x: -100, y: 540 } };
  }
  function eq(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  var T = {};

  // Взаимозависимые переключатели: тумблер i переключает лампы masks[i]; цель — goal.
  T.toggles = {
    init: function (d) { return { s: d.start.slice(), p: d.start.map(function () { return 0; }) }; },
    act: function (d, L, i) { d.masks[i].forEach(function (j) { L.s[j] ^= 1; }); L.p[i] ^= 1; return { ok: true }; },
    solved: function (d, L) { return eq(L.s, d.goal); },
    view: function (d, L) { var v = {}; d.objs.forEach(function (id, i) { v[id] = { on: !!L.p[i] }; }); (d.lamps || []).forEach(function (id, j) { v[id] = { lit: !!L.s[j] }; }); return v; },
    moves: function (d) { return d.masks.map(function (m, i) { return i; }); },
    key: function (L) { return L.s.join(''); }
  };
  // Вентили и манометр: давление = сумма весов открытых; цель — target (отметка на шкале).
  T.gauge = {
    init: function (d) { return { s: d.start.slice() }; },
    act: function (d, L, i) { L.s[i] ^= 1; return { ok: true }; },
    value: function (d, L) { var v = 0; L.s.forEach(function (b, i) { if (b) v += d.weights[i]; }); return v; },
    solved: function (d, L) { return T.gauge.value(d, L) === d.target; },
    view: function (d, L) {
      var v = {}, max = d.weights.reduce(function (a, b) { return a + b; }, 0), val = T.gauge.value(d, L);
      d.objs.forEach(function (id, i) { v[id] = { on: !!L.s[i] }; });
      v[d.gauge] = { gauge: val / max, mark: d.target / max, ok: val === d.target }; return v;
    },
    moves: function (d) { return d.weights.map(function (w, i) { return i; }); },
    key: function (L) { return L.s.join(''); }
  };
  // Последовательность: нажимать по порядку order; ошибка — сброс (если нажатое совпадает с первым шагом — с него).
  T.sequence = {
    init: function () { return { k: 0 }; },
    act: function (d, L, i) {
      if (d.order[L.k] === i) { L.k++; return { ok: true }; }
      L.k = d.order[0] === i ? 1 : 0; return { fail: true };
    },
    solved: function (d, L) { return L.k >= d.order.length; },
    view: function (d, L) {
      var v = {}, done = d.order.slice(0, L.k);
      d.objs.forEach(function (id, i) { if (id) v[id] = d.press ? { down: done.indexOf(i) >= 0 } : { on: done.indexOf(i) >= 0 }; });
      if (d.machine) v[d.machine] = { prog: L.k, of: d.order.length };
      if (d.lift) v[d.lift] = { lift: 1 - Math.max(0, L.k - 1) / (d.order.length - 1) };
      return v;
    },
    moves: function (d) { return d.hs.map(function (h, i) { return i; }); },
    key: function (L) { return String(L.k); }
  };
  // Кодовые диски: клик — следующий знак; цель — target.
  T.dials = {
    init: function (d) { return { s: d.start.slice() }; },
    act: function (d, L, i) { L.s[i] = (L.s[i] + 1) % d.values.length; return { ok: true }; },
    solved: function (d, L) { return eq(L.s, d.target); },
    view: function (d, L) { var v = {}; d.objs.forEach(function (id, i) { v[id] = { icon: d.values[L.s[i]] }; }); return v; },
    moves: function (d) { return d.hs.map(function (h, i) { return i; }); },
    key: function (L) { return L.s.join(','); }
  };

  // ---------- мини-игра: трубы (поворот плиток, масло от бака к носику) ----------
  var PC = 100, PY0 = 110;
  function pipeOrigin(d) { return { x0: (960 - d.cols * PC) / 2, y0: PY0 }; }
  function opens(s, r) { return (OPEN[s] || []).map(function (o) { return (o + r) % 4; }); }
  function flood(d, rot) {
    var wet = {}, q = [], src = d.src.r * d.cols + d.src.c;
    if (opens(d.grid[src].s, rot[src]).indexOf(3) < 0) return { wet: wet, done: false };
    wet[src] = 1; q.push(src);
    while (q.length) {
      var i = q.shift(), c = i % d.cols, r = (i / d.cols) | 0, os = opens(d.grid[i].s, rot[i]);
      for (var k = 0; k < os.length; k++) {
        var dd = DIRS[os[k]], nc = c + dd[0], nr = r + dd[1];
        if (nc < 0 || nr < 0 || nc >= d.cols || nr >= d.rows) continue;
        var j = nr * d.cols + nc; if (wet[j]) continue;
        if (opens(d.grid[j].s, rot[j]).indexOf((os[k] + 2) % 4) >= 0) { wet[j] = 1; q.push(j); }
      }
    }
    var dst = d.dst.r * d.cols + d.dst.c;
    return { wet: wet, done: !!wet[dst] && opens(d.grid[dst].s, rot[dst]).indexOf(1) >= 0 };
  }
  T.pipes = {
    init: function (d) { return { r: d.grid.map(function (g) { return g.r || 0; }) }; },
    act: function (d, L, i) { if (d.grid[i].f) return { fail: true }; L.r[i] = (L.r[i] + 1) % 4; return { ok: true }; },
    solved: function (d, L) { return flood(d, L.r).done; },
    flood: flood,
    hit: function (d, L, x, y) {
      var o = pipeOrigin(d), c = Math.floor((x - o.x0) / PC), r = Math.floor((y - o.y0) / PC);
      if (c < 0 || r < 0 || c >= d.cols || r >= d.rows) return -1; return r * d.cols + c;
    },
    center: function (d, i) { var o = pipeOrigin(d); return { x: o.x0 + (i % d.cols) * PC + PC / 2, y: o.y0 + ((i / d.cols) | 0) * PC + PC / 2 }; },
    scene: function (d, L) {
      var o = pipeOrigin(d), f = flood(d, L.r), objs = [];
      d.grid.forEach(function (g, i) {
        objs.push({ id: 'cell' + i, kind: 'pipe', x: o.x0 + (i % d.cols) * PC + 3, y: o.y0 + ((i / d.cols) | 0) * PC + 3, w: PC - 6, h: PC - 6,
          state: { shape: g.s, rot: L.r[i], wet: !!f.wet[i], fixed: !!g.f } });
      });
      objs.push({ id: 'src', kind: 'pipe', x: o.x0 - PC + 3, y: o.y0 + d.src.r * PC + 3, w: PC - 6, h: PC - 6, state: { shape: 'cap', rot: 1, wet: true } });
      objs.push({ id: 'dst', kind: 'pipe', x: o.x0 + d.cols * PC + 3, y: o.y0 + d.dst.r * PC + 3, w: PC - 6, h: PC - 6, state: { shape: 'sink', rot: 3, wet: f.done } });
      objs.push({ id: 'tankMini', kind: 'machine', x: o.x0 - PC - 10, y: o.y0 + d.src.r * PC - 150, w: PC, h: 140, state: { variant: 'tank' } });
      objs.push({ id: 'canMini', kind: 'item', item: f.done ? 'oilcan_full' : 'oilcan', x: o.x0 + d.cols * PC + 20, y: o.y0 + d.dst.r * PC + PC + 10, w: 60, h: 60 });
      return closeup(d, objs);
    },
    moves: function (d) { return d.grid.map(function (g, i) { return i; }).filter(function (i) { return !d.grid[i].f; }); },
    key: function (L) { return L.r.join(''); },
    // Поиск решения: путь от источника к носику, повороты только вдоль пути (поиск в глубину).
    solve: function (d, L) {
      var best = null, n = d.cols * d.rows, rot = L.r.slice(), used = {};
      function dfs(i, inDir) {
        if (best) return;
        var c = i % d.cols, r = (i / d.cols) | 0, g = d.grid[i];
        var cand = g.f ? [rot[i]] : [0, 1, 2, 3];
        for (var a = 0; a < cand.length && !best; a++) {
          var os = opens(g.s, cand[a]); if (os.indexOf(inDir) < 0) continue;
          var keep = rot[i]; rot[i] = cand[a]; used[i] = 1;
          if (i === d.dst.r * d.cols + d.dst.c && os.indexOf(1) >= 0 && flood(d, rot).done) { best = rot.slice(); }
          for (var k = 0; k < os.length && !best; k++) {
            if (os[k] === inDir) continue;
            var dd = DIRS[os[k]], nc = c + dd[0], nr = r + dd[1];
            if (nc < 0 || nr < 0 || nc >= d.cols || nr >= d.rows) continue;
            var j = nr * d.cols + nc; if (used[j]) continue;
            dfs(j, (os[k] + 2) % 4);
          }
          if (!best) { rot[i] = keep; used[i] = 0; }
        }
      }
      dfs(d.src.r * d.cols + d.src.c, 3);
      if (!best) return null;
      var clicks = [];
      for (var i = 0; i < n; i++) { var k = (best[i] - L.r[i] + 4) % 4; for (var q = 0; q < k; q++) clicks.push(i); }
      return clicks;
    }
  };

  // ---------- мини-игра: сдвижная оправа линзы 3×3 (собрать кольцо-оправу) ----------
  var SC_ = 120;
  function sliderOrigin(d) { return { x0: 480 - d.n * SC_ / 2, y0: 270 - d.n * SC_ / 2 + 10 }; }
  function sliderStart(d) {
    var n = d.n, b = [], i; for (i = 0; i < n * n; i++) b.push(i);
    var blank = n * n - 1, rnd = rng(d.seed || 1), prev = -1;
    for (var m = 0; m < (d.moves || 40); m++) {
      var bc = blank % n, br = (blank / n) | 0, nb = [];
      DIRS.forEach(function (dd) { var c = bc + dd[0], r = br + dd[1]; if (c >= 0 && r >= 0 && c < n && r < n) nb.push(r * n + c); });
      nb = nb.filter(function (x) { return x !== prev; });
      var j = nb[Math.floor(rnd() * nb.length)]; b[blank] = b[j]; b[j] = n * n - 1; prev = blank; blank = j;
    }
    return b;
  }
  T.slider = {
    init: function (d) { return { b: sliderStart(d) }; },
    act: function (d, L, i) {
      var n = d.n, blank = L.b.indexOf(n * n - 1), dc = Math.abs(blank % n - i % n), dr = Math.abs(((blank / n) | 0) - ((i / n) | 0));
      if (dc + dr !== 1) return { fail: true };
      L.b[blank] = L.b[i]; L.b[i] = n * n - 1; return { ok: true };
    },
    solved: function (d, L) { for (var i = 0; i < L.b.length; i++) if (L.b[i] !== i) return false; return true; },
    hit: function (d, L, x, y) {
      var o = sliderOrigin(d), c = Math.floor((x - o.x0) / SC_), r = Math.floor((y - o.y0) / SC_);
      if (c < 0 || r < 0 || c >= d.n || r >= d.n) return -1; return r * d.n + c;
    },
    center: function (d, i) { var o = sliderOrigin(d); return { x: o.x0 + (i % d.n) * SC_ + SC_ / 2, y: o.y0 + ((i / d.n) | 0) * SC_ + SC_ / 2 }; },
    scene: function (d, L) {
      var o = sliderOrigin(d), n = d.n, objs = [];
      L.b.forEach(function (p, i) {
        if (p === n * n - 1) return;
        objs.push({ id: 'tile' + p, kind: 'box', x: o.x0 + (i % n) * SC_ + 3, y: o.y0 + ((i / n) | 0) * SC_ + 3, w: SC_ - 6, h: SC_ - 6, state: { pic: 'frame', part: p, n: n } });
      });
      objs.push({ id: 'sample', kind: 'box', x: 760, y: 60, w: 150, h: 150, state: { pic: 'frame', part: -1, n: n } });
      return closeup(d, objs, [{ kind: 'wall', x: o.x0 - 14, y: o.y0 - 14, w: n * SC_ + 28, h: n * SC_ + 28, seed: 5 }]);
    },
    moves: function (d) { var a = []; for (var i = 0; i < d.n * d.n; i++) a.push(i); return a; },
    key: function (L) { return L.b.join(','); },
    neighbours: function (d, L) {   // клетки рядом с пустой — только они двигаются
      var n = d.n, blank = L.b.indexOf(n * n - 1), bc = blank % n, br = (blank / n) | 0, out = [];
      DIRS.forEach(function (dd) { var c = bc + dd[0], r = br + dd[1]; if (c >= 0 && r >= 0 && c < n && r < n) out.push(r * n + c); });
      return out;
    }
  };

  // ---------- мини-игра: колокольчики (мелодия из пяти нот, подсказка — птицы на площади) ----------
  function chimeRect(i) { return { x: 250 + i * 104, y: 70, w: 64, h: 190 + i * 26 }; }
  T.melody = {
    init: function () { return { k: 0 }; },
    act: function (d, L, i) {
      if (d.target[L.k] === i) { L.k++; return { ok: true, note: i }; }
      L.k = d.target[0] === i ? 1 : 0; return { fail: true, note: i };
    },
    solved: function (d, L) { return L.k >= d.target.length; },
    hit: function (d, L, x, y) { for (var i = 0; i < d.n; i++) { var r = chimeRect(i); if (x >= r.x - 14 && x <= r.x + r.w + 14 && y >= r.y && y <= r.y + r.h + 30) return i; } return -1; },
    center: function (d, i) { var r = chimeRect(i); return { x: r.x + r.w / 2, y: r.y + r.h - 30 }; },
    scene: function (d, L, t, rt) {
      var objs = [];
      for (var i = 0; i < d.n; i++) {
        var r = chimeRect(i), ring = rt && rt.ring && rt.ring['c' + i] != null ? Math.max(0, 1 - (t - rt.ring['c' + i]) / 1.2) : 0;
        objs.push({ id: 'chime' + i, kind: 'chime', x: r.x, y: r.y, w: r.w, h: r.h, state: { note: i, n: d.n, ring: ring } });
      }
      for (var j = 0; j < d.target.length; j++) objs.push({ id: 'led' + j, kind: 'lamp', x: 380 + j * 44, y: 470, w: 24, h: 30, state: { small: true, lit: j < L.k } });
      return closeup(d, objs, [{ kind: 'shelf', x: 220, y: 56, w: 540, h: 14 }]);
    },
    moves: function (d) { var a = []; for (var i = 0; i < d.n; i++) a.push(i); return a; },
    key: function (L) { return String(L.k); },
    solve: function (d) { return d.target.slice(); }
  };

  // ---------- мини-игра подсказки: поймать светлячков (координаты — от времени) ----------
  function flyPos(k, t) { return { x: 480 + 330 * Math.sin(t * 0.55 * (1 + k * 0.23) + k * 2.1), y: 250 + 150 * Math.sin(t * 0.8 * (1 + k * 0.17) + k * 1.3) }; }
  T.catch = {
    init: function (d) { var g = []; for (var i = 0; i < (d.count || 3); i++) g.push(0); return { got: g }; },
    act: function (d, L, i) { if (L.got[i]) return { fail: true }; L.got[i] = 1; return { ok: true }; },
    solved: function (d, L) { return L.got.every(function (x) { return x; }); },
    pos: flyPos,
    hit: function (d, L, x, y, t) { for (var i = 0; i < L.got.length; i++) { if (L.got[i]) continue; var p = flyPos(i, t); if (Math.abs(p.x - x) < 44 && Math.abs(p.y - y) < 44) return i; } return -1; },
    scene: function (d, L, t) {
      var objs = [];
      L.got.forEach(function (g, i) { if (g) return; var p = flyPos(i, t); objs.push({ id: 'fly' + i, kind: 'item', item: 'firefly', x: p.x - 22, y: p.y - 22, w: 44, h: 44 }); });
      L.got.forEach(function (g, i) { objs.push({ id: 'jar' + i, kind: 'lamp', x: 420 + i * 44, y: 470, w: 24, h: 30, state: { small: true, lit: !!g } }); });
      return closeup(d, objs, [{ kind: 'hill', x: 0, y: 380, w: 960, h: 160, seed: 6 }, { kind: 'plant', x: 60, y: 400, w: 70, h: 90, seed: 2 }]);
    },
    moves: function (d, L) { return L.got.map(function (g, i) { return i; }); },
    key: function (L) { return L.got.join(''); }
  };

  K.Widgets = { types: T, flood: flood, opens: opens, sliderStart: sliderStart, flyPos: flyPos, rng: rng };
})(typeof window !== 'undefined' ? window : globalThis);
