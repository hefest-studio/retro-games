/* ОБВАЛ · «Крепильщик»: логика пазла без DOM (OBVAL.parse / resolve / Game / solve). Состояние — чистые данные, без случайности.
   Шахта — сетка. Порода (R) держится, пока у неё есть опора: снизу скала, крепь или устойчивая порода — ЛИБО она зажата справа и слева
   (свод: с обеих сторон скала, крепь или устойчивая порода). Нет опоры — падает на клетку вниз, а за ней рушится всё, что на ней держалось.
   Игрок не ходит: он касается клетки — ставит крепь на опору (запас ограничен) или выбивает стоящую. Каждое касание — один ход (на звёзды);
   после него порода обрушивается цепной реакцией, затем каждый шахтёр идёт вперёд до упора (стена, порода, крепь, обрыв — стоит, пока путь не откроется).
   Шахтёр падает вместе с опорой; с высоты 3 клеток и выше — гибнет, порода, упавшая на него, — тоже. Выход (E) — шахтёр, дошедший до него, спасён.
   Очаг (X) нужно засыпать: в конце хода в клетке лежит порода. Победа: все шахтёры спасены и все очаги засыпаны.
   Символы карты: # скала · . пусто · R порода · P крепь · > < шахтёр (смотрит вправо / влево) · E выход · X очаг. */
(function (global) {
  'use strict';
  var OB = global.OBVAL = global.OBVAL || {};
  var EMPTY = 0, ROCK = 1, PROP = 2;
  var FALL_DEATH = 3;

  function parse(def) {
    var rows = def.map, H = rows.length, W = rows[0].length, N = W * H;
    var L = { id: def.id, W: W, H: H, N: N, wall: new Uint8Array(N), exit: new Uint8Array(N), haz: new Uint8Array(N), hazList: [], exits: [],
      blk0: new Uint8Array(N), miners0: [], stock0: def.stock | 0, props0: 0 };
    for (var y = 0; y < H; y++) {
      if (rows[y].length !== W) throw new Error('уровень ' + def.id + ': строка ' + y + ' другой длины');
      for (var x = 0; x < W; x++) {
        var ch = rows[y][x], i = y * W + x;
        if (ch === '#') L.wall[i] = 1;
        else if (ch === 'R') L.blk0[i] = ROCK;
        else if (ch === 'P') { L.blk0[i] = PROP; L.props0++; }
        else if (ch === '>' || ch === '<') L.miners0.push({ p: i, d: ch === '>' ? 1 : -1 });
        else if (ch === 'E') { L.exit[i] = 1; L.exits.push(i); }
        else if (ch === 'X') { L.haz[i] = 1; L.hazList.push(i); }
        else if (ch !== '.') throw new Error('уровень ' + def.id + ': символ «' + ch + '»');
      }
    }
    if (L.miners0.length > 4) throw new Error('уровень ' + def.id + ': слишком много шахтёров');
    return L;
  }

  function initState(L) {
    var n = L.miners0.length, s = { blk: L.blk0.slice(), mp: [], md: [], ms: [], stock: L.stock0 };
    for (var k = 0; k < n; k++) { s.mp.push(L.miners0[k].p); s.md.push(L.miners0[k].d); s.ms.push(0); }
    return s;
  }
  function cloneState(s) { return { blk: s.blk.slice(), mp: s.mp.slice(), md: s.md.slice(), ms: s.ms.slice(), stock: s.stock }; }

  // ---------- опора ----------
  // флаги неустойчивой породы (1 — упадёт). Наибольшая неподвижная точка: сначала вся порода «держится», затем снимаем тех, у кого нет опоры.
  function unstable(L, blk) {
    var W = L.W, N = L.N, wall = L.wall, ok = new Uint8Array(N), i, changed = true, any = false;
    for (i = 0; i < N; i++) ok[i] = blk[i] === ROCK ? 1 : 0;
    function solid(j) { return wall[j] || blk[j] === PROP || ok[j]; }
    while (changed) {
      changed = false;
      for (i = N - 1; i >= 0; i--) {
        if (!ok[i]) continue;
        var x = i % W, held = i >= N - W || solid(i + W);
        if (!held) { held = (x === 0 || solid(i - 1)) && (x === W - 1 || solid(i + 1)); }
        if (!held) { ok[i] = 0; changed = true; any = true; }
      }
    }
    if (!any) return null;
    var u = new Uint8Array(N); for (i = 0; i < N; i++) if (blk[i] === ROCK && !ok[i]) u[i] = 1;
    return u;
  }

  function minerAt(s, j) { for (var k = 0; k < s.mp.length; k++) if (s.ms[k] === 0 && s.mp[k] === j) return k; return -1; }

  // ---------- обрушение ----------
  // Падение по шагам (каждый шаг — на одну клетку вниз, снизу вверх), пока что-то движется. tr — необяз. запись кадров: { frame(s), ev }
  function collapse(L, s, tr) {
    var W = L.W, H = L.H, N = L.N, blk = s.blk, rid = s.rid, fall = s.fall || (s.fall = s.mp.map(function () { return 0; })), x, y, k, steps = 0;
    for (var guard = 0; guard < 500; guard++) {
      var uns = unstable(L, blk), moved = false;
      for (y = H - 2; y >= 0; y--) for (x = 0; x < W; x++) {
        var i = y * W + x, j = i + W;
        if (blk[i] !== ROCK || !(uns && uns[i])) continue;
        if (L.wall[j] || blk[j]) continue;
        k = minerAt(s, j); if (k >= 0) { s.ms[k] = 2; if (tr) tr.ev.push({ t: 'crush', k: k, cell: j }); }
        blk[j] = ROCK; blk[i] = EMPTY; if (rid) { rid[j] = rid[i]; rid[i] = -1; } moved = true;
      }
      for (k = 0; k < s.mp.length; k++) {
        if (s.ms[k] !== 0) continue; var p = s.mp[k]; if (p >= N - W) continue; var q = p + W;
        if (!L.wall[q] && !blk[q] && minerAt(s, q) < 0) { s.mp[k] = q; fall[k]++; moved = true; }
      }
      if (!moved) break; steps++; if (tr) tr.frame(s);
    }
    for (k = 0; k < s.mp.length; k++) { if (s.ms[k] === 0 && fall[k] >= FALL_DEATH) { s.ms[k] = 2; if (tr) tr.ev.push({ t: 'fall', k: k, cell: s.mp[k] }); } fall[k] = 0; }
    return steps;
  }
  function checkExit(L, s, tr) {
    for (var k = 0; k < s.mp.length; k++) if (s.ms[k] === 0 && L.exit[s.mp[k]]) { s.ms[k] = 1; if (tr) tr.ev.push({ t: 'save', k: k, cell: s.mp[k] }); }
  }
  // шахтёр идёт вперёд до упора: до стены, породы, крепи, другого шахтёра или обрыва, и стоит там, пока путь не откроется. Выход — спасён.
  function walk(L, s, tr) {
    var W = L.W, N = L.N;
    for (var k = 0; k < s.mp.length; k++) {
      if (s.ms[k] !== 0) continue; var d = s.md[k], p = s.mp[k];
      for (var guard = 0; guard < 40; guard++) {
        var x = p % W + d; if (x < 0 || x >= W) break;
        var q = p + d;
        if (L.wall[q] || s.blk[q] || minerAt(s, q) >= 0) break;
        if (!(q >= N - W || L.wall[q + W] || s.blk[q + W])) break;
        p = q; s.mp[k] = p; if (tr) tr.frame(s);
        if (L.exit[p]) { s.ms[k] = 1; if (tr) tr.ev.push({ t: 'save', k: k, cell: p }); break; }
      }
    }
  }

  function won(L, s) {
    var k, i; if (!L.miners0.length && !L.hazList.length) return false;
    for (k = 0; k < s.ms.length; k++) if (s.ms[k] !== 1) return false;
    for (i = 0; i < L.hazList.length; i++) if (s.blk[L.hazList[i]] !== ROCK) return false;
    return true;
  }
  function lost(s) { for (var k = 0; k < s.ms.length; k++) if (s.ms[k] === 2) return true; return false; }

  // ---------- действия ----------
  function canPlace(L, s, i) {
    if (L.wall[i] || s.blk[i] || s.stock <= 0 || minerAt(s, i) >= 0) return false;
    return i >= L.N - L.W || !!L.wall[i + L.W] || !!s.blk[i + L.W];
  }
  function actions(L, s) {
    var out = [], i; for (i = 0; i < L.N; i++) { if (s.blk[i] === PROP) out.push(i); else if (canPlace(L, s, i)) out.push(i); }
    return out;
  }
  // применить касание клетки i к копии состояния: → { st, ev } или null. tr — запись кадров (для партии)
  function apply(L, st, i, tr) {
    var s = cloneState(st), kind;
    if (s.blk[i] === PROP) { s.blk[i] = EMPTY; s.stock++; kind = 'remove'; }
    else if (canPlace(L, s, i)) { s.blk[i] = PROP; s.stock--; kind = 'place'; }
    else return null;
    if (tr) { tr.ev.push({ t: kind, cell: i }); if (st.rid) s.rid = st.rid.slice(); tr.frame(s); }
    collapse(L, s, tr); checkExit(L, s, tr); if (!lost(s)) { walk(L, s, tr); }
    if (s.rid) delete s.fall;
    return { st: s, kind: kind };
  }
  function keyOf(s) {
    var k = String.fromCharCode.apply(null, s.blk), m = ''; for (var q = 0; q < s.mp.length; q++) m += String.fromCharCode(s.mp[q] + 1, s.md[q] + 2, s.ms[q] + 1);
    return k + '|' + m;
  }
  // нет ли в начальной раскладке хода «сам по себе»: порода держится, шахтёры не падают
  function isSettled(L, s) { var t = cloneState(s), n = collapse(L, t, null); return n === 0; }

  // решатель: поиск в ширину. → { solved, moves, path:[клетки], explored }; cap — предел состояний
  function solve(L, from, cap) {
    cap = cap || 120000; var st0 = from || initState(L);
    if (won(L, st0)) return { solved: true, moves: 0, path: [], explored: 1 };
    if (lost(st0)) return { solved: false, moves: -1, path: [], explored: 1 };
    var seen = {}, queue = [{ st: st0, prev: null, cell: -1 }], head = 0; seen[keyOf(st0)] = 1;
    while (head < queue.length && queue.length < cap) {
      var n = queue[head++], acts = actions(L, n.st);
      for (var a = 0; a < acts.length; a++) {
        var r = apply(L, n.st, acts[a]); if (!r) continue; var kk = keyOf(r.st); if (seen[kk]) continue; seen[kk] = 1;
        var nn = { st: r.st, prev: n, cell: acts[a] };
        if (won(L, r.st)) { var path = []; for (var q = nn; q.prev; q = q.prev) path.push(q.cell); path.reverse(); return { solved: true, moves: path.length, path: path, explored: queue.length }; }
        if (!lost(r.st)) queue.push(nn);
      }
    }
    return { solved: false, moves: -1, path: [], explored: queue.length, capped: queue.length >= cap };
  }
  // сколько различных кратчайших решений (по первым ходам) — для проверки «не слишком очевидно»; до limit
  function countFirst(L, par, cap) {
    var res = 0, st0 = initState(L), acts = actions(L, st0);
    for (var a = 0; a < acts.length; a++) { var r = apply(L, st0, acts[a]); if (!r || lost(r.st)) continue; if (par === 1 ? won(L, r.st) : solve(L, r.st, cap || 60000).moves === par - 1) res++; }
    return res;
  }

  function starsFor(moves, par) { return moves <= par ? 3 : moves <= par + Math.max(2, Math.ceil(par / 2)) ? 2 : 1; }

  // ---------- партия одного уровня ----------
  function Game(o) {
    o = o || {}; var L = o.L || parse(o.level), onEvent = o.onEvent || function () {}, par = o.par || 0;
    var st, rid, nextId, hist = [], moves = 0, cleared = false, stars = 0, anim = null, hintCache = null, dead = false, last = null;
    function emit(t, d) { try { onEvent(t, d || {}); } catch (e) { } }
    function freshIds() { rid = new Int16Array(L.N).fill(-1); nextId = 0; for (var i = 0; i < L.N; i++) if (st.blk[i] === ROCK) rid[i] = nextId++; }
    function reset() { st = initState(L); freshIds(); hist = []; moves = 0; cleared = false; stars = 0; anim = null; hintCache = null; dead = false; last = null; }
    reset();
    function snap(s) { return { blk: s.blk.slice(), mp: s.mp.slice(), md: s.md.slice(), ms: s.ms.slice(), stock: s.stock, dead: dead }; }
    function frameOf(s) { var r = [], m = [], i, k; for (i = 0; i < L.N; i++) if (s.rid && s.rid[i] >= 0) r.push(s.rid[i], i); for (k = 0; k < s.mp.length; k++) m.push(s.mp[k], s.ms[k], s.md[k]); return { r: r, m: m }; }
    var api = {
      L: L, par: par,
      state: function () { return { blk: st.blk, mp: st.mp, md: st.md, ms: st.ms, stock: st.stock, moves: moves, cleared: cleared, stars: stars, dead: dead, anim: anim, rid: rid, saved: st.ms.filter(function (v) { return v === 1; }).length, total: st.ms.length,
        filled: L.hazList.filter(function (i) { return st.blk[i] === ROCK; }).length, hazards: L.hazList.length }; },
      isProp: function (i) { return st.blk[i] === PROP; },
      canAct: function (i) { return !cleared && !dead && (st.blk[i] === PROP || canPlace(L, st, i)); },
      act: function (i) {
        if (cleared) return { ok: false, why: 'cleared' }; if (dead) return { ok: false, why: 'dead' };
        if (i < 0 || i >= L.N) return { ok: false, why: 'none' };
        var cur = st; cur.rid = rid; var frames = [], tr = { ev: [], frame: function (s) { frames.push(frameOf(s)); } };
        var before = snap(st), r = apply(L, cur, i, tr); delete cur.rid;
        if (!r) { return { ok: false, why: L.wall[i] ? 'wall' : st.blk[i] === ROCK ? 'rock' : minerAt(st, i) >= 0 ? 'miner' : st.stock <= 0 ? 'stock' : 'nofloor' }; }
        hist.push(before); moves++; hintCache = null; st = r.st; rid = r.st.rid || rid; delete st.rid; delete st.fall;
        frames.push(frameOf({ rid: rid, mp: st.mp, ms: st.ms, md: st.md }));
        anim = { t: 0, frames: frames, cell: i, ev: tr.ev };
        var falls = frames.length; emit(r.kind, { cell: i });
        tr.ev.forEach(function (e) { if (e.t !== 'place' && e.t !== 'remove') emit(e.t, e); });
        if (lost(st)) { dead = true; emit('dead', {}); }
        else if (won(L, st)) { cleared = true; stars = starsFor(moves, par || moves); emit('clear', { moves: moves, stars: stars }); }
        return { ok: true, type: r.kind, events: tr.ev, cleared: cleared, dead: dead, frames: falls };
      },
      undo: function () {
        if (!hist.length) return false;
        var h = hist.pop(); st = { blk: h.blk, mp: h.mp, md: h.md, ms: h.ms, stock: h.stock }; dead = false; moves--; cleared = false; stars = 0; hintCache = null; freshIds(); anim = null; emit('undo'); return true;
      },
      restart: function () { reset(); emit('restart'); },
      hint: function () { if (cleared || dead) return -1; if (!hintCache) hintCache = solve(L, st); return hintCache.solved && hintCache.path.length ? hintCache.path[0] : -1; },
      stuck: function () { if (cleared) return false; if (dead) return true; if (!hintCache) hintCache = solve(L, st); return !hintCache.solved && !hintCache.capped; },
      tick: function (dt) { if (anim) { anim.t += dt; if (anim.t > 8) anim = null; } },
      clone: function () { var c = Game({ L: L, par: par }); c._set(st, hist, moves); return c; },
      _set: function (s, h, m) { st = cloneState(s); hist = h.slice(); moves = m; cleared = won(L, st); dead = lost(st); hintCache = null; freshIds(); }
    };
    return api;
  }

  OB.parse = parse; OB.initState = initState; OB.cloneState = cloneState; OB.unstable = unstable; OB.collapse = collapse; OB.walk = walk; OB.apply = apply; OB.actions = actions;
  OB.canPlace = canPlace; OB.won = won; OB.lost = lost; OB.solve = solve; OB.countFirst = countFirst; OB.starsFor = starsFor; OB.Game = Game; OB.keyOf = keyOf; OB.isSettled = isSettled;
  OB.K = { EMPTY: EMPTY, ROCK: ROCK, PROP: PROP, FALL_DEATH: FALL_DEATH };
})(typeof window !== 'undefined' ? window : globalThis);
