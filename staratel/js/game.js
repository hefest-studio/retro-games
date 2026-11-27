/* СТАРАТЕЛЬ · «Водосброс»: логика пазла без DOM (STARATEL.parse / flow / Game / solve). Состояние — чистые данные.
   Шахта — сетка клеток. Вода течёт по клеткам: падает вниз, на опоре растекается вбок, вверх не поднимается; родник льёт всегда.
   Игрок не ходит — он выбирает действие над клеткой: открыть/закрыть шлюз или пробить шурф в рыхлой породе (необратимо).
   Вагонетки плывут по течению; цель — довезти все вагонетки до подъёмника (клетки L). Каждое действие — один ход (на звёзды).
   Символы карты: # скала · : рыхлая порода (шурф) · . пусто · S родник · g шлюз закрыт · o шлюз открыт · c пусто+вагонетка · L подъёмник. */
(function (global) {
  'use strict';
  var SW = global.STARATEL = global.STARATEL || {};
  var K_EMPTY = 0, K_ROCK = 1, K_SOIL = 2, K_GATE = 3, K_SPRING = 4;
  var D_NONE = 0, D_DOWN = 1, D_LEFT = 2, D_RIGHT = 3;

  function parse(def) {
    var rows = def.map, H = rows.length, W = rows[0].length, N = W * H, L = { id: def.id, W: W, H: H, N: N, kind: new Uint8Array(N), lift: new Uint8Array(N),
      gates: [], soils: [], springs: [], carts: [], gateAt: new Int16Array(N).fill(-1), soilAt: new Int16Array(N).fill(-1), open0: 0, _memo: {} };
    for (var y = 0; y < H; y++) {
      if (rows[y].length !== W) throw new Error('уровень ' + def.id + ': строка ' + y + ' другой длины');
      for (var x = 0; x < W; x++) {
        var ch = rows[y][x], i = y * W + x;
        if (ch === '#') L.kind[i] = K_ROCK;
        else if (ch === ':') { L.kind[i] = K_SOIL; L.soilAt[i] = L.soils.length; L.soils.push(i); }
        else if (ch === 'S') { L.kind[i] = K_SPRING; L.springs.push(i); }
        else if (ch === 'g' || ch === 'o') { L.kind[i] = K_GATE; L.gateAt[i] = L.gates.length; if (ch === 'o') L.open0 |= 1 << L.gates.length; L.gates.push(i); }
        else if (ch === 'c') L.carts.push(i);
        else if (ch === 'L') L.lift[i] = 1;
        else if (ch !== '.') throw new Error('уровень ' + def.id + ': символ «' + ch + '»');
      }
    }
    if (L.gates.length > 10 || L.soils.length > 14) throw new Error('уровень ' + def.id + ': слишком много шлюзов/шурфов');
    return L;
  }

  // ---------- вода ----------
  // F = { wet, par, dir, depth } для набора (шлюзы, шурфы); par — клетка, из которой пришла вода (дерево течения), depth — расстояние от родника
  function flow(L, gates, dug) {
    var key = gates * 16384 + dug, m = L._memo[key]; if (m) return m;
    var W = L.W, H = L.H, N = L.N, solid = new Uint8Array(N), wet = new Uint8Array(N), par = new Int16Array(N).fill(-1), dir = new Uint8Array(N), depth = new Uint8Array(N), i, k;
    for (i = 0; i < N; i++) { k = L.kind[i]; solid[i] = k === K_ROCK ? 1 : k === K_SOIL ? ((dug >> L.soilAt[i]) & 1 ? 0 : 1) : k === K_GATE ? ((gates >> L.gateAt[i]) & 1 ? 0 : 1) : 0; }
    for (i = 0; i < L.springs.length; i++) wet[L.springs[i]] = 1;
    var changed = true, j;
    while (changed) {
      changed = false;
      for (i = 0; i < N; i++) {
        if (!wet[i]) continue;
        var x = i % W, y = (i - x) / W;
        if (y + 1 < H) { j = i + W; if (!solid[j] && !wet[j]) { wet[j] = 1; par[j] = i; dir[j] = D_DOWN; changed = true; } }
        if (y + 1 >= H || solid[i + W] || wet[i + W]) {
          if (x > 0) { j = i - 1; if (!solid[j] && !wet[j]) { wet[j] = 1; par[j] = i; dir[j] = D_LEFT; changed = true; } }
          if (x < W - 1) { j = i + 1; if (!solid[j] && !wet[j]) { wet[j] = 1; par[j] = i; dir[j] = D_RIGHT; changed = true; } }
        }
      }
    }
    for (i = 0; i < N; i++) if (wet[i]) { var d = 0, p = i; while (par[p] >= 0) { p = par[p]; d++; } depth[i] = Math.min(255, d); }
    m = { wet: wet, par: par, dir: dir, depth: depth, solid: solid }; L._memo[key] = m; return m;
  }

  // куда течение несёт вагонетку из клетки i (-1 — стоит). Только вперёд по дереву течения: цикла быть не может.
  function nextCell(L, F, i) {
    var W = L.W, H = L.H, x = i % W, y = (i - x) / W, j;
    if (y + 1 < H) { j = i + W; if (F.wet[j] && F.par[j] === i) return j; }
    var d = F.dir[i], lc = x > 0 && F.wet[i - 1] && F.par[i - 1] === i, rc = x < W - 1 && F.wet[i + 1] && F.par[i + 1] === i;
    if (d === D_LEFT) return lc ? i - 1 : -1;
    if (d === D_RIGHT) return rc ? i + 1 : -1;
    if (lc !== rc) return lc ? i - 1 : i + 1;   // струя упала в проход, открытый только в одну сторону — несёт туда
    return -1;
  }
  // вагонетки после того, как вода установилась: { pos: [..], paths: [[клетки пути], ..] }
  function settle(L, F, carts) {
    var pos = [], paths = [];
    for (var c = 0; c < carts.length; c++) {
      var p = carts[c], path = [p], guard = 0;
      while (F.wet[p] && guard++ < 200) { var n = nextCell(L, F, p); if (n < 0) break; p = n; path.push(p); }
      pos.push(p); paths.push(path);
    }
    return { pos: pos, paths: paths };
  }

  // ---------- состояние и действия ----------
  function initState(L) { return { gates: L.open0, dug: 0, carts: L.carts.slice() }; }
  function won(L, st) { for (var c = 0; c < st.carts.length; c++) if (!L.lift[st.carts[c]]) return false; return st.carts.length > 0; }
  // список действий: клетки, над которыми что-то можно сделать (шлюз — всегда, кроме закрытия под вагонеткой; шурф — пока не пробит)
  function actions(L, st) {
    var out = [], i, k;
    for (k = 0; k < L.gates.length; k++) { i = L.gates[k]; if ((st.gates >> k) & 1 && st.carts.indexOf(i) >= 0) continue; out.push(i); }
    for (k = 0; k < L.soils.length; k++) if (!((st.dug >> k) & 1)) out.push(L.soils[k]);
    return out;
  }
  // применить действие к клетке i → новое состояние (или null, если действие невозможно) + пути вагонеток
  function apply(L, st, i) {
    var g = st.gates, d = st.dug, k;
    if (L.kind[i] === K_GATE) { k = L.gateAt[i]; if ((g >> k) & 1 && st.carts.indexOf(i) >= 0) return null; g ^= 1 << k; }
    else if (L.kind[i] === K_SOIL) { k = L.soilAt[i]; if ((d >> k) & 1) return null; d |= 1 << k; }
    else return null;
    var F = flow(L, g, d), s = settle(L, F, st.carts);
    return { st: { gates: g, dug: d, carts: s.pos }, F: F, paths: s.paths };
  }
  function keyOf(st) { return st.gates + ',' + st.dug + ',' + st.carts.slice().sort(function (a, b) { return a - b; }).join('.'); }

  // решатель: поиск в ширину по состояниям. → { solved, moves, path:[клетки], explored } ; cap — предел состояний
  function solve(L, from, cap) {
    cap = cap || 400000; var st0 = from || initState(L);
    if (won(L, st0)) return { solved: true, moves: 0, path: [], explored: 1 };
    var seen = {}, queue = [{ st: st0, prev: null, cell: -1 }], head = 0; seen[keyOf(st0)] = 1;
    while (head < queue.length && queue.length < cap) {
      var n = queue[head++], acts = actions(L, n.st);
      for (var a = 0; a < acts.length; a++) {
        var r = apply(L, n.st, acts[a]); if (!r) continue; var kk = keyOf(r.st); if (seen[kk]) continue; seen[kk] = 1;
        var nn = { st: r.st, prev: n, cell: acts[a] };
        if (won(L, r.st)) { var path = []; for (var q = nn; q.prev; q = q.prev) path.push(q.cell); path.reverse(); return { solved: true, moves: path.length, path: path, explored: queue.length }; }
        queue.push(nn);
      }
    }
    return { solved: false, moves: -1, path: [], explored: queue.length, capped: queue.length >= cap };
  }

  function starsFor(moves, par) { return moves <= par ? 3 : moves <= par + Math.max(2, Math.ceil(par / 2)) ? 2 : 1; }

  // ---------- партия одного уровня ----------
  function Game(o) {
    o = o || {}; var L = o.L || parse(o.level), onEvent = o.onEvent || function () {}, par = o.par || 0;
    var st = initState(L), F = flow(L, st.gates, st.dug), hist = [], moves = 0, cleared = false, stars = 0, anim = null, hintCache = null;
    function emit(t, d) { try { onEvent(t, d || {}); } catch (e) { } }
    function settleNow() { var s = settle(L, F, st.carts); st.carts = s.pos; }
    settleNow();
    var api = {
      L: L, par: par,
      state: function () { return { gates: st.gates, dug: st.dug, carts: st.carts.slice(), moves: moves, cleared: cleared, stars: stars, F: F, anim: anim }; },
      isGateOpen: function (i) { return !!((st.gates >> L.gateAt[i]) & 1); },
      isDug: function (i) { return !!((st.dug >> L.soilAt[i]) & 1); },
      solid: function (i) { return !!F.solid[i]; },
      wet: function (i) { return !!F.wet[i]; },
      canAct: function (i) { return !cleared && actions(L, st).indexOf(i) >= 0; },
      act: function (i) {
        if (cleared) return { ok: false, why: 'cleared' };
        var kind = L.kind[i]; if (kind !== K_GATE && kind !== K_SOIL) return { ok: false, why: 'none' };
        var r = apply(L, st, i);
        if (!r) return { ok: false, why: kind === K_GATE ? 'cart' : 'dug' };
        hist.push({ gates: st.gates, dug: st.dug, carts: st.carts.slice(), cleared: cleared }); var prevF = F, prevCarts = st.carts.slice();
        st = r.st; F = r.F; moves++; hintCache = null;
        anim = { t: 0, prevF: prevF, prevCarts: prevCarts, paths: r.paths, cell: i };
        emit(kind === K_SOIL ? 'dig' : (this.isGateOpen(i) ? 'gateOpen' : 'gateShut'), { cell: i });
        var moved = r.paths.some(function (p) { return p.length > 1; }); if (moved) emit('cart', { paths: r.paths });
        if (won(L, st)) { cleared = true; stars = starsFor(moves, par || moves); emit('clear', { moves: moves, stars: stars }); }
        return { ok: true, type: kind === K_SOIL ? 'dig' : 'gate', moved: moved, cleared: cleared };
      },
      undo: function () {
        if (!hist.length) return false;
        var h = hist.pop(), prevF = F, prevCarts = st.carts.slice(); st = { gates: h.gates, dug: h.dug, carts: h.carts }; F = flow(L, st.gates, st.dug); moves--; cleared = false; stars = 0; hintCache = null;
        anim = { t: 0, prevF: prevF, prevCarts: prevCarts, paths: st.carts.map(function (c) { return [c]; }), cell: -1 }; emit('undo'); return true;
      },
      restart: function () { st = initState(L); F = flow(L, st.gates, st.dug); settleNow(); hist = []; moves = 0; cleared = false; stars = 0; anim = null; hintCache = null; emit('restart'); },
      // подсказка: клетка следующего действия по кратчайшему решению из текущего состояния (-1 — тупик или уже решено)
      hint: function () { if (cleared) return -1; if (!hintCache) hintCache = solve(L, st); return hintCache.solved && hintCache.path.length ? hintCache.path[0] : -1; },
      // тупик: из текущего состояния решения нет (исчерпывающий поиск)
      stuck: function () { if (cleared) return false; if (!hintCache) hintCache = solve(L, st); return !hintCache.solved && !hintCache.capped; },
      tick: function (dt) { if (anim) { anim.t += dt; if (anim.t > 4) anim = null; } },
      clone: function () { var c = Game({ L: L, par: par }); c._set(st, hist, moves); return c; },
      _set: function (s, h, m) { st = { gates: s.gates, dug: s.dug, carts: s.carts.slice() }; F = flow(L, st.gates, st.dug); hist = h.slice(); moves = m; cleared = won(L, st); hintCache = null; }
    };
    return api;
  }

  SW.parse = parse; SW.flow = flow; SW.nextCell = nextCell; SW.settle = settle; SW.initState = initState; SW.apply = apply; SW.actions = actions; SW.won = won;
  SW.solve = solve; SW.starsFor = starsFor; SW.Game = Game;
  SW.K = { EMPTY: K_EMPTY, ROCK: K_ROCK, SOIL: K_SOIL, GATE: K_GATE, SPRING: K_SPRING, NONE: D_NONE, DOWN: D_DOWN, LEFT: D_LEFT, RIGHT: D_RIGHT };
})(typeof window !== 'undefined' ? window : globalThis);
