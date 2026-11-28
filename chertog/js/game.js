/* ЧЕРТОГ · логика «Театра теней» (без DOM, детерминирована, чистая: step(state, act) -> новое состояние).
   Поле 16×8 клеток. Свет: лампы стоят в одной из своих точек; луч от лампы до клетки, перекрытый кладкой (#) или бумажной
   декорацией (o), даёт тень. Плита (=) твёрдая ТОЛЬКО в тени; на свету она — призрак. Страж на свету слепнет и безвреден.
   Рычаг (1/2/3) переставляет лампу с тем же номером в следующую точку по кругу.
   Ходы: L/R — шаг (на ступень в 1 клетку поднимается сам), UL/UR/U — прыжок через клетку (через яму, через ступень), A — рычаг/ждать. */
(function (global) {
  'use strict';
  var C = global.CHERTOG = global.CHERTOG || {};
  var W = 16, H = 8, L = {};
  L.W = W; L.H = H;
  L.mulberry32 = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  // ---------- разбор уровня ----------
  L.parse = function (def) {
    if (def._p) return def._p;
    var P = { def: def, W: W, H: H, t: [], lev: {}, exit: null, start: null, guards: [], lamps: def.lamps.map(function (l) { return l.map(function (p) { return [p[0], p[1]]; }); }), litMemo: {} };
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var ch = def.rows[y].charAt(x) || '.', i = y * W + x, v = 0;
      if (ch === '#') v = 1; else if (ch === '=') v = 2; else if (ch === 'o') v = 3;
      else if (ch === 'S') P.start = [x, y]; else if (ch === 'E') P.exit = [x, y];
      else if (ch >= '1' && ch <= '3') P.lev[i] = +ch - 1;
      else if (ch === 'g') P.guards.push([x, y, 1]); else if (ch === 'G') P.guards.push([x, y, -1]);
      P.t[i] = v;
    }
    def._p = P; return P;
  };
  // тени: lit[i] = 1, если хоть одна лампа видит центр клетки; кладка и декорации загораживают
  function los(P, ax, ay, bx, by) {
    var x0 = ax + 0.5, y0 = ay + 0.5, dx = bx - ax, dy = by - ay, d = Math.sqrt(dx * dx + dy * dy), n = Math.max(1, Math.ceil(d * 24));
    for (var k = 1; k < n; k++) {
      var cx = Math.floor(x0 + dx * k / n), cy = Math.floor(y0 + dy * k / n);
      if ((cx === ax && cy === ay) || (cx === bx && cy === by)) continue;
      var v = P.t[cy * W + cx];
      if (v === 1 || v === 3) return false;
    }
    return true;
  }
  L.lit = function (P, li) {
    var key = li.join(','), m = P.litMemo[key];
    if (m) return m;
    m = new Uint8Array(W * H);
    for (var k = 0; k < li.length; k++) { var lp = P.lamps[k][li[k]];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (!m[y * W + x] && los(P, lp[0], lp[1], x, y)) m[y * W + x] = 1; }
    P.litMemo[key] = m; return m;
  };

  // ---------- состояние ----------
  L.init = function (def) {
    var P = L.parse(def);
    return { hx: P.start[0], hy: P.start[1], hf: 1, lamps: P.lamps.map(function () { return 0; }), guards: P.guards.map(function (g) { return [g[0], g[1], g[2], 1]; }), moves: 0, dead: null, won: false, ev: [] };
  };
  L.clone = function (s) { return { hx: s.hx, hy: s.hy, hf: s.hf, lamps: s.lamps.slice(), guards: s.guards.map(function (g) { return g.slice(); }), moves: s.moves, dead: s.dead, won: s.won, ev: [] }; };
  L.key = function (s) { var k = s.hx + ',' + s.hy + ',' + s.hf + '|' + s.lamps.join(',') + '|'; for (var i = 0; i < s.guards.length; i++) { var g = s.guards[i]; k += g[3] ? g[0] + ':' + g[1] + ':' + g[2] + ';' : 'x;'; } return k; };
  L.solid = function (P, lit, x, y) { if (x < 0 || x >= W) return true; if (y < 0) return false; if (y >= H) return false; var v = P.t[y * W + x]; return v === 1 || (v === 2 && !lit[y * W + x]); };
  L.dazzled = function (P, lit, g) { return !!lit[g[1] * W + g[0]]; };
  function fall(P, lit, x, y) { while (y < H && !L.solid(P, lit, x, y + 1)) { y++; if (y >= H) return H; } return y; }
  function guardAt(s, lit, P, x, y) { for (var i = 0; i < s.guards.length; i++) { var g = s.guards[i]; if (g[3] && g[0] === x && g[1] === y && !L.dazzled(P, lit, g)) return true; } return false; }

  // ход: act ∈ L R UL UR U A. Возвращает новое состояние; s.ev — события для звука/анимации. Неосуществимый ход — тот же объект (ничего не меняется).
  L.step = function (P, s0, act) {
    if (s0.dead || s0.won) return s0;
    var s = L.clone(s0), lit = L.lit(P, s.lamps), x = s.hx, y = s.hy, d, nx, ny, ok = false, lever = -1;
    if (!L.solid(P, lit, x, y + 1)) { return s0; }
    if (act === 'L' || act === 'R') {
      d = act === 'L' ? -1 : 1; s.hf = d; nx = x + d;
      if (nx < 0 || nx >= W) return s0;
      if (!L.solid(P, lit, nx, y)) { x = nx; ok = true; s.ev.push({ t: 'walk', fx: s.hx, fy: s.hy }); }
      else if (!L.solid(P, lit, nx, y - 1) && !L.solid(P, lit, x, y - 1) && y > 0) { x = nx; y--; ok = true; s.ev.push({ t: 'step', fx: s.hx, fy: s.hy }); }
      else { s.moves = s0.moves; return s0.hf === d ? s0 : (s.ev.push({ t: 'turn' }), s); }
    } else if (act === 'U' || act === 'UL' || act === 'UR') {
      d = act === 'UL' ? -1 : act === 'UR' ? 1 : s.hf; s.hf = d; nx = x + 2 * d;
      if (nx < 0 || nx >= W || y < 1) return s0;
      if (L.solid(P, lit, x, y - 1) || L.solid(P, lit, x + d, y - 1) || L.solid(P, lit, nx, y - 1) || L.solid(P, lit, nx, y)) return s0;
      if (L.solid(P, lit, x + d, y + 1) && !L.solid(P, lit, x + d, y)) return s0; // прыжок только через яму или ступень
      if (guardAt(s, lit, P, x + d, y) || guardAt(s, lit, P, x + d, y - 1)) return s0;
      x = nx; ok = true; s.ev.push({ t: 'jump', fx: s.hx, fy: s.hy });
    } else if (act === 'A') {
      ok = true; lever = P.lev[y * W + x];
      if (lever !== undefined && lever >= 0 && lever < s.lamps.length) { s.lamps[lever] = (s.lamps[lever] + 1) % P.lamps[lever].length; s.ev.push({ t: 'lever', k: lever }); }
      else s.ev.push({ t: 'wait' });
    }
    if (!ok) return s0;
    s.moves++;
    var lit2 = L.lit(P, s.lamps), py = y;
    s.hx = x; s.hy = y;
    // падение (после перестановки света плиты могли исчезнуть)
    if (L.solid(P, lit2, x, y)) { s.dead = 'crush'; s.ev.push({ t: 'die', why: 'crush' }); return s; }
    y = fall(P, lit2, x, y); s.hy = y;
    if (y >= H) { s.dead = 'fall'; s.hy = H; s.ev.push({ t: 'die', why: 'fall' }); return s; }
    if (y > py + 0 && y !== s0.hy) s.ev.push({ t: 'land', from: py, to: y });
    // стражи
    for (var i = 0; i < s.guards.length; i++) {
      var g = s.guards[i]; if (!g[3]) continue;
      var gy = fall(P, lit2, g[0], g[1]); if (gy >= H) { g[3] = 0; continue; } g[1] = gy;
      if (L.dazzled(P, lit2, g)) continue;
      var gx = g[0], gd = g[2], tx = gx + gd;
      var can = tx >= 0 && tx < W && !L.solid(P, lit2, tx, g[1]) && !L.solid(P, lit2, tx, g[1] - 1) && L.solid(P, lit2, tx, g[1] + 1);
      var px = g[0];
      if (can) g[0] = tx; else g[2] = -gd;
      // кровь: тот же клетка, или перекрёстный обмен
      if (g[0] === s.hx && (g[1] === s.hy || g[1] - 1 === s.hy)) { s.dead = 'caught'; s.ev.push({ t: 'die', why: 'caught' }); }
      else if (g[0] === s0.hx && px === s.hx && g[1] === s.hy) { s.dead = 'caught'; s.ev.push({ t: 'die', why: 'caught' }); }
    }
    if (!s.dead) for (i = 0; i < s.guards.length; i++) { var q = s.guards[i]; if (q[3] && q[0] === s.hx && (q[1] === s.hy || q[1] - 1 === s.hy) && !L.dazzled(P, lit2, q)) { s.dead = 'caught'; s.ev.push({ t: 'die', why: 'caught' }); } }
    if (!s.dead && P.exit && s.hx === P.exit[0] && s.hy === P.exit[1]) { s.won = true; s.ev.push({ t: 'win' }); }
    return s;
  };
  L.ACTS = ['L', 'R', 'UL', 'UR', 'A'];
  // решатель: поиск в ширину; возвращает кратчайший список ходов или null
  L.solve = function (def, opts) {
    opts = opts || {}; var P = L.parse(def), s = opts.from ? L.clone(opts.from) : L.init(def), seen = {}, q = [[s, null, null]], head = 0, lim = opts.limit || 400000;
    seen[L.key(s)] = 1;
    while (head < q.length && head < lim) {
      var it = q[head++], cur = it[0];
      for (var i = 0; i < L.ACTS.length; i++) {
        var n = L.step(P, cur, L.ACTS[i]); if (n === cur) continue;
        if (n.dead) continue;
        if (n.won) { var path = [L.ACTS[i]], p = it; while (p && p[2]) { path.push(p[2]); p = p[1]; } return path.reverse(); }
        var k = L.key(n); if (seen[k]) continue; seen[k] = 1; q.push([n, it, L.ACTS[i]]);
      }
    }
    return null;
  };
  C.logic = L;
})(typeof window !== 'undefined' ? window : globalThis);
