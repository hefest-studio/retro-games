/* ============================================================================
   ТАЙНИК · движок логики (без DOM, детерминированный при заданном rng)
   Жанр — «исследователь в лабиринте с верёвками». Заброшенная водонапорная
   башня старой мастерской «Гефест»: этажи-ячейки, соединённые люками
   с верёвками и проходами в стенах. Подмастерье-фонарщик Фитилёк лазит
   по верёвкам, прыгает между ними над лужами кислоты, стреляет из
   пневмопистолета и ищет люк наверх. 6 уровней, 3 жизни.
   Лабиринт генерируется (остовное дерево по ячейкам + петли), затем проверяется
   на достижимость выхода поиском по тем же правилам физики, что и в игре
   (макро-ходы: шаг, прыжок, хват, подъём/спуск, прыжок с верёвки).
   Интерфейс — CONTRACT.md.
   ========================================================================== */
(function (global) {
  'use strict';
  var K = global.TAYNIK = global.TAYNIK || {};

  // ---------- Геометрия и физика (px канвы 512×384; мир — тайлы 20 px) ----------
  var W = 512, H = 384, HUD = 32, VW = 512, VH = 352;
  var T = 20, CX = 12, CY = 8;                 // ячейка лабиринта — 12×8 тайлов (240×160 px)
  var HALF = 6, HH = 18, HANDS = 14;           // герой 12×18, руки — на 14 px выше ступней
  var DT = 1 / 60;
  var WALK = 80, GRAV = 900, MAXFALL = 420;
  var JUMP_VY = -290, JUMP_VX = 100;           // прыжок с пола: высота ≈ 44 px, длина ≈ 64 px
  var ROPE_VY = -160, ROPE_VX = 140;           // прыжок с верёвки
  var CLIMB = 70, GRAB_AIR = 8, GRAB_REACH = 16, ROPE_CD = 0.35;
  var FALL_SAFE = 100, FALL_BIG = 230;
  var ENERGY = 100, INV_T = 1.2, RESPAWN_INV = 2.0;
  var AMMO0 = 8, AMMO_LVL = 6, AMMO_MAX = 15, CRATE = 4;
  var BULLET_V = 380, BULLET_R = 260, FIRE_CD = 0.25;
  var MAX_LEVEL = 6, MAX_LIVES = 5, EXTRA_EVERY = 10000;
  var DEAD_T = 1.4, CLEAR_T = 2.4, BANNER_T = 2.2, HINT_T = 1.6;
  var DROP_GROW = 0.7, DROP_G = 600, DROP_SPLASH = 0.3;
  var PTS = { gem: 200, gear: 100, lamp: 50, spider: 100, spark: 150, ghost: 250, cham: 300, exit: 1000, energy: 5, ammo: 20 };
  var DMG = { spider: 20, spark: 15, drop: 15, ghost: 20, cham: 25 };
  var HP = { spider: 1, spark: 1, ghost: 2, cham: 2 };

  // Уровни: размер лабиринта (ячейки), кислотные ямы, обитатели, предметы
  var LEVELS = [
    { cols: 4, rows: 3, loops: 0, acid: 1, wide: 0, ledge: 0.3, spider: 2, spark: 1, drop: 0, ghost: 0, cham: 0, crates: 2, oil: 1, maps: 1, gems: 5, lamps: 1, speed: 1.0 },
    { cols: 5, rows: 4, loops: 1, acid: 2, wide: 0, ledge: 0.3, spider: 3, spark: 2, drop: 2, ghost: 0, cham: 0, crates: 2, oil: 2, maps: 2, gems: 7, lamps: 2, speed: 1.0 },
    { cols: 6, rows: 4, loops: 2, acid: 2, wide: 0.5, ledge: 0.35, spider: 3, spark: 2, drop: 3, ghost: 2, cham: 0, crates: 3, oil: 2, maps: 2, gems: 8, lamps: 2, speed: 1.05 },
    { cols: 6, rows: 5, loops: 2, acid: 3, wide: 0.5, ledge: 0.35, spider: 3, spark: 3, drop: 3, ghost: 2, cham: 2, crates: 3, oil: 3, maps: 3, gems: 9, lamps: 3, speed: 1.1 },
    { cols: 7, rows: 5, loops: 3, acid: 3, wide: 0.6, ledge: 0.4, spider: 4, spark: 3, drop: 4, ghost: 3, cham: 3, crates: 4, oil: 3, maps: 3, gems: 10, lamps: 3, speed: 1.15 },
    { cols: 8, rows: 6, loops: 4, acid: 4, wide: 0.7, ledge: 0.4, spider: 5, spark: 4, drop: 5, ghost: 3, cham: 4, crates: 4, oil: 4, maps: 4, gems: 12, lamps: 4, speed: 1.2 }
  ];

  function mod(a, n) { return ((a % n) + n) % n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- Тайлы: 0 — пусто, 1 — кладка, 2 — кислота (твёрдая, но смертельная) ----------
  function tileAt(lv, tx, ty) {
    if (tx < 0 || tx >= lv.tw || ty >= lv.th) return 1;
    if (ty < 0) return 0;                      // над люком выхода — открыто
    return lv.tiles[ty * lv.tw + tx];
  }
  function overlapSolid(lv, x, y) {
    var x0 = Math.floor((x - HALF) / T), x1 = Math.floor((x + HALF - 0.001) / T);
    var y0 = Math.floor((y - HH) / T), y1 = Math.floor((y - 0.001) / T);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (tileAt(lv, tx, ty)) return true;
    return false;
  }
  function supported(lv, x, y) {
    if (mod(y, T) > 0.001) return false;
    var ty = Math.round(y / T), x0 = Math.floor((x - HALF) / T), x1 = Math.floor((x + HALF - 0.001) / T);
    for (var tx = x0; tx <= x1; tx++) if (tileAt(lv, tx, ty)) return true;
    return false;
  }
  function acidUnder(lv, x, y) { return tileAt(lv, Math.floor(x / T), Math.round(y / T)) === 2; }

  // ---------- Герой ----------
  function newHero(x, y) {
    return { x: x, y: y, vx: 0, vy: 0, mode: 'ground', rope: -1, face: 1, fallY: y, ropeCd: 0, lastRope: -1,
      pu: false, pl: false, pr: false, pd: false, dmg: 0 };
  }
  function cloneHero(h) { var o = {}; for (var k in h) o[k] = h[k]; return o; }
  function ropeMinY(R) { return R.top + HANDS + 4; }
  function ropeMaxY(R) { return R.bot + HANDS; }
  function grab(h, i, R) {
    h.mode = 'rope'; h.rope = i; h.x = R.x; h.vx = 0; h.vy = 0;
    h.y = clamp(h.y, ropeMinY(R), ropeMaxY(R));
  }
  // Верёвка рядом с героем на полу: 'up' — уходит вверх и достаёт до рук; 'down' — уходит ниже ступней
  function ropeNear(lv, h, how) {
    for (var i = 0; i < lv.ropes.length; i++) {
      var R = lv.ropes[i];
      if (Math.abs(R.x - h.x) > GRAB_REACH) continue;
      if (how === 'up' && ropeMinY(R) <= h.y && h.y - HANDS <= R.bot) return i;
      if (how === 'down' && ropeMinY(R) <= h.y && ropeMaxY(R) > h.y + 2 && !tileAt(lv, Math.floor(R.x / T), Math.round(h.y / T))) return i;
    }
    return -1;
  }

  // Верёвки по столбцам тайлов (ускоряет хват в полёте; кэш на уровне)
  var NOROPES = [];
  function ropeBuckets(lv) {
    if (lv._rb && lv._rbr === lv.ropes && lv._rbn === lv.ropes.length) return lv._rb;
    var b = {};
    lv.ropes.forEach(function (R, i) { var c = Math.floor(R.x / T); (b[c] = b[c] || []).push(i); });
    lv._rb = b; lv._rbr = lv.ropes; lv._rbn = lv.ropes.length; return b;
  }
  // Один шаг физики героя. inp = {l,r,u,d} (зажатые). Возвращает событие:
  // null | 'jump' | 'grab' | 'land' | 'hurt' (h.dmg — урон от падения) | 'acid' | 'exit'.
  function stepHero(lv, h, inp, dt) {
    var ev = null;
    var uE = inp.u && !h.pu, lE = inp.l && !h.pl, rE = inp.r && !h.pr, dE = inp.d && !h.pd;
    h.pu = !!inp.u; h.pl = !!inp.l; h.pr = !!inp.r; h.pd = !!inp.d;
    if (h.ropeCd > 0) h.ropeCd -= dt;

    if (h.mode === 'rope') {
      var R = lv.ropes[h.rope];
      if (lE || rE) {                              // прыжок с верёвки — новым нажатием ←/→
        var s = lE ? -1 : 1;
        h.mode = 'air'; h.vx = s * ROPE_VX; h.vy = ROPE_VY; h.face = s;
        h.lastRope = h.rope; h.ropeCd = ROPE_CD; h.rope = -1; h.fallY = h.y; ev = 'jump';
      } else {
        var dy = (inp.d ? 1 : 0) - (inp.u ? 1 : 0), minY = ropeMinY(R), maxY = ropeMaxY(R);
        if (dy < 0) {
          h.y -= CLIMB * dt;
          if (R.exit && h.y <= minY + 2) { h.y = minY; return 'exit'; }
          if (h.y < minY) h.y = minY;
        } else if (dy > 0) {
          if (h.y >= maxY - 0.01) {
            if (dE) { h.mode = 'air'; h.vx = 0; h.vy = 0; h.lastRope = h.rope; h.ropeCd = ROPE_CD; h.rope = -1; h.fallY = h.y; }
          } else {
            h.y = Math.min(maxY, h.y + CLIMB * dt);
            if (overlapSolid(lv, h.x, h.y)) {
              h.y = Math.floor((h.y - 0.001) / T) * T; h.mode = 'ground'; h.rope = -1; h.fallY = h.y;
              return acidUnder(lv, h.x, h.y) ? 'acid' : 'land';
            }
          }
        }
        if (h.mode === 'rope') return null;
      }
    }

    if (h.mode === 'ground') {
      var dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      if (dir) h.face = dir;
      if (inp.u || inp.d) {
        var ri = ropeNear(lv, h, inp.u ? 'up' : 'down');
        if (ri >= 0) { grab(h, ri, lv.ropes[ri]); return 'grab'; }
      }
      if (uE) { h.mode = 'air'; h.vy = JUMP_VY; h.vx = dir * JUMP_VX; h.fallY = h.y; ev = 'jump'; }
      else h.vx = dir * WALK;
    }
    if (h.mode === 'air') h.vy = Math.min(MAXFALL, h.vy + GRAV * dt);

    // по горизонтали
    if (h.vx) {
      h.x += h.vx * dt;
      if (overlapSolid(lv, h.x, h.y)) {
        if (h.vx > 0) h.x = Math.floor((h.x + HALF - 0.001) / T) * T - HALF;
        else h.x = (Math.floor((h.x - HALF) / T) + 1) * T + HALF;
        if (h.mode === 'air') h.vx = 0;
      }
    }
    if (h.mode === 'ground') {
      if (!supported(lv, h.x, h.y)) { h.mode = 'air'; h.vy = 0; h.vx = 0; h.fallY = h.y; }
      else if (acidUnder(lv, h.x, h.y)) return 'acid';
      else return ev;
    }
    // по вертикали (полёт)
    h.y += h.vy * dt;
    if (overlapSolid(lv, h.x, h.y)) {
      if (h.vy > 0) {
        h.y = Math.floor((h.y - 0.001) / T) * T; h.mode = 'ground'; h.vy = 0; h.vx = 0;
        if (acidUnder(lv, h.x, h.y)) return 'acid';
        var fall = h.y - h.fallY;
        if (fall > FALL_SAFE) { h.dmg = fall > FALL_BIG ? 60 : 30; return 'hurt'; }
        return 'land';
      }
      h.y = (Math.floor((h.y - HH) / T) + 1) * T + HH; h.vy = 0;
    }
    // хват за верёвку в полёте (автоматически)
    var bk = ropeBuckets(lv), bc = Math.floor(h.x / T), cand = (bk[bc - 1] || NOROPES).concat(bk[bc] || NOROPES, bk[bc + 1] || NOROPES);
    for (var ci = 0; ci < cand.length; ci++) {
      var i = cand[ci];
      if (i === h.lastRope && h.ropeCd > 0) continue;
      var Q = lv.ropes[i];
      if (Math.abs(Q.x - h.x) <= GRAB_AIR && h.y - HANDS >= Q.top + 4 && h.y - HANDS <= Q.bot) { grab(h, i, Q); return 'grab'; }
    }
    return ev;
  }

  // ---------- Макро-ходы (для проверки достижимости и ботов) ----------
  // Из устойчивого состояния (стоит на полу / висит на верёвке) — действие и «успокоение» без ввода.
  var MAC_G = ['L', 'R', 'JU', 'JL', 'JR', 'D'], MAC_R = ['CU', 'CD', 'RL', 'RR', 'DROP'];
  var NONE = {};
  function runMacro(lv, h0, act) {
    var h = cloneHero(h0); h.pu = h.pl = h.pr = h.pd = false;
    var x0 = h.x, y0 = h.y, f = 0, dmg = 0, ev = null, inp, end = false;
    function st(i) { ev = stepHero(lv, h, i, DT); f++; if (ev === 'hurt') dmg += h.dmg; return ev === 'acid' || ev === 'exit'; }
    switch (act) {
      case 'L': case 'R':
        inp = act === 'L' ? { l: 1 } : { r: 1 };
        while (f < 24) { if ((end = st(inp))) break; if (h.mode !== 'ground' || Math.abs(h.x - x0) >= 10) break; }
        break;
      case 'JU': end = st({ u: 1 }); break;
      case 'JL': end = st({ l: 1, u: 1 }); break;
      case 'JR': end = st({ r: 1, u: 1 }); break;
      case 'D': end = st({ d: 1 }); break;
      case 'CU':
        while (f < 24) { var py = h.y; if ((end = st({ u: 1 }))) break; if (h.mode !== 'rope' || y0 - h.y >= 10 || h.y === py) break; }
        break;
      case 'CD':
        while (f < 24) { var qy = h.y; if ((end = st({ d: 1 }))) break; if (h.mode !== 'rope' || h.y - y0 >= 10 || h.y === qy) break; }
        break;
      case 'RL': end = st({ l: 1 }); break;
      case 'RR': end = st({ r: 1 }); break;
      case 'DROP': end = st({ d: 1 }); break;
    }
    if (end) return { h: h, res: ev, f: f, dmg: dmg };
    while (f < 400 && h.mode === 'air') { if (st(NONE)) return { h: h, res: ev, f: f, dmg: dmg }; }
    return { h: h, res: h.mode === 'air' ? 'stuck' : 'ok', f: f, dmg: dmg };
  }
  function heroKey(h) {
    return h.mode === 'rope' ? 'r' + h.rope + ',' + Math.round(h.y / 6) : 'g' + Math.round(h.x / 6) + ',' + Math.round(h.y);
  }
  function macrosFor(h) { return h.mode === 'rope' ? MAC_R : MAC_G; }

  // Граф достижимости из старта: узлы — устойчивые состояния, рёбра — макро-ходы.
  function analyze(lv, h0, maxNodes) {
    maxNodes = maxNodes || 40000;
    var nodes = new Map(), q = [], exitReachable = false, steps = 0;
    var root = cloneHero(h0 || newHero(lv.start.x, lv.start.y));
    nodes.set(heroKey(root), { key: heroKey(root), h: root, edges: [] }); q.push(heroKey(root));
    for (var qi = 0; qi < q.length && nodes.size < maxNodes; qi++) {
      var n = nodes.get(q[qi]), acts = macrosFor(n.h);
      for (var a = 0; a < acts.length; a++) {
        var r = runMacro(lv, n.h, acts[a]); steps += r.f;
        if (r.res === 'acid' || r.res === 'stuck') continue;
        var cost = r.f + 6 + r.dmg * 12;
        if (r.res === 'exit') { n.edges.push({ act: acts[a], to: 'exit', cost: cost }); exitReachable = true; continue; }
        var k = heroKey(r.h);
        if (k === n.key) continue;
        n.edges.push({ act: acts[a], to: k, cost: cost, dmg: r.dmg });
        if (!nodes.has(k)) { nodes.set(k, { key: k, h: r.h, edges: [] }); q.push(k); }
      }
    }
    return { nodes: nodes, exitReachable: exitReachable, count: nodes.size, steps: steps };
  }
  // Расстояние (в кадрах) до выхода от каждого узла графа: Дейкстра по обратным рёбрам
  function distToExit(plan) {
    var rev = new Map(), dist = new Map(), heap = [];
    plan.nodes.forEach(function (n) {
      n.edges.forEach(function (e) {
        if (e.to === 'exit') { push(n.key, e.cost); return; }
        if (!rev.has(e.to)) rev.set(e.to, []);
        rev.get(e.to).push({ from: n.key, cost: e.cost });
      });
    });
    function push(k, d) {
      if (dist.has(k) && dist.get(k) <= d) return;
      dist.set(k, d); heap.push([d, k]);
      var i = heap.length - 1;
      while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
    }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; var i = 0;
        for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; }
      }
      return top;
    }
    while (heap.length) {
      var it = pop(); if (dist.get(it[1]) < it[0]) continue;
      var rs = rev.get(it[1]); if (!rs) continue;
      for (var i = 0; i < rs.length; i++) push(rs[i].from, it[0] + rs[i].cost);
    }
    return dist;
  }

  // ---------- Генерация уровня ----------
  function cellOf(lv, x, y) { return { i: clamp(Math.floor(x / (CX * T)), 0, lv.cols - 1), j: clamp(Math.floor((y - 1) / (CY * T)), 0, lv.rows - 1) }; }
  function cellAt(lv, i, j) { return lv.cells[j * lv.cols + i]; }
  function neighbors(lv, c) {
    var out = [];
    if (c.e) out.push(cellAt(lv, c.i + 1, c.j));
    if (c.s) out.push(cellAt(lv, c.i, c.j + 1));
    if (c.i > 0 && cellAt(lv, c.i - 1, c.j).e) out.push(cellAt(lv, c.i - 1, c.j));
    if (c.j > 0 && cellAt(lv, c.i, c.j - 1).s) out.push(cellAt(lv, c.i, c.j - 1));
    return out;
  }
  // Путь по ячейкам (BFS по открытым проходам) — для карт-подсказок
  function cellPath(lv, from, to) {
    var prev = new Map(), q = [from], seen = new Set([from]);
    for (var k = 0; k < q.length; k++) {
      var c = q[k]; if (c === to) break;
      neighbors(lv, c).forEach(function (n) { if (!seen.has(n)) { seen.add(n); prev.set(n, c); q.push(n); } });
    }
    if (!seen.has(to)) return [];
    var path = [to]; while (path[0] !== from) path.unshift(prev.get(path[0]));
    return path;
  }
  function shuffle(a, rng) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function buildMaze(n, cfg, rng) {
    var cols = cfg.cols, rows = cfg.rows, tw = cols * CX + 1, th = rows * CY + 1;
    var lv = { n: n, cfg: cfg, cols: cols, rows: rows, tw: tw, th: th, pw: tw * T, ph: th * T,
      tiles: new Uint8Array(tw * th), ropes: [], cells: [] };
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++)
      lv.cells.push({ i: i, j: j, e: false, s: false, hx: -1, ux: -1, acid: null, ledge: null, deg: 0 });
    // остовное дерево (DFS) от стартовой ячейки внизу
    var start = cellAt(lv, Math.floor(rng() * cols), rows - 1), seen = new Set([start]), stack = [start];
    while (stack.length) {
      var c = stack[stack.length - 1], opts = [];
      if (c.i < cols - 1) opts.push(['e', cellAt(lv, c.i + 1, c.j)]);
      if (c.i > 0) opts.push(['w', cellAt(lv, c.i - 1, c.j)]);
      if (c.j < rows - 1) opts.push(['s', cellAt(lv, c.i, c.j + 1)]);
      if (c.j > 0) opts.push(['n', cellAt(lv, c.i, c.j - 1)]);
      opts = opts.filter(function (o) { return !seen.has(o[1]); });
      if (!opts.length) { stack.pop(); continue; }
      var o = opts[Math.floor(rng() * opts.length)], nb = o[1];
      if (o[0] === 'e') c.e = true; else if (o[0] === 'w') nb.e = true; else if (o[0] === 's') c.s = true; else nb.s = true;
      seen.add(nb); stack.push(nb);
    }
    // петли (с 2-го уровня): лишние проходы, чаще горизонтальные
    for (var l = 0, tries = 0; l < cfg.loops && tries < 200; tries++) {
      var cc = lv.cells[Math.floor(rng() * lv.cells.length)];
      if (rng() < 0.7) { if (cc.i < cols - 1 && !cc.e) { cc.e = true; l++; } }
      else if (cc.j < rows - 1 && !cc.s) { cc.s = true; l++; }
    }
    lv.cells.forEach(function (c) { c.deg = neighbors(lv, c).length; });
    // выход — ячейка верхнего ряда, дальняя от старта
    var dist = new Map([[start, 0]]), q = [start];
    for (var k = 0; k < q.length; k++) neighbors(lv, q[k]).forEach(function (nb2) { if (!dist.has(nb2)) { dist.set(nb2, dist.get(q[k]) + 1); q.push(nb2); } });
    var exitCell = null;
    for (var ei = 0; ei < cols; ei++) { var ec = cellAt(lv, ei, 0); if (!exitCell || dist.get(ec) > dist.get(exitCell)) exitCell = ec; }
    lv.startCell = start; lv.exitCell = exitCell; lv.cellDist = dist;
    exitCell.ux = 2 + Math.floor(rng() * 7);
    // люки между этажами: смещение люка в ячейке 2..8, не ближе 3 тайлов к люку над ней
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var cl = cellAt(lv, i, j);
      if (!cl.s) continue;
      var hx, guard = 0;
      do { hx = 2 + Math.floor(rng() * 7); } while (cl.ux >= 0 && Math.abs(hx - cl.ux) < 3 && ++guard < 50);
      cl.hx = hx; cellAt(lv, i, j + 1).ux = hx;
    }
    // кладка
    var tiles = lv.tiles;
    function set(tx, ty, v) { tiles[ty * tw + tx] = v; }
    tiles.fill(1);
    lv.cells.forEach(function (c) {
      var x0 = c.i * CX, y0 = c.j * CY;
      for (var y = y0 + 1; y < y0 + CY; y++) for (var x = x0 + 1; x < x0 + CX; x++) set(x, y, 0);
      if (c.e) for (var y2 = y0 + 3; y2 < y0 + CY; y2++) set(x0 + CX, y2, 0);
      if (c.s) { set(x0 + c.hx, y0 + CY, 0); set(x0 + c.hx + 1, y0 + CY, 0); }
    });
    set(exitCell.i * CX + exitCell.ux, 0, 0); set(exitCell.i * CX + exitCell.ux + 1, 0, 0);
    // верёвки: из люков вниз до пола нижнего этажа; верёвка выхода — из люка в потолке
    lv.cells.forEach(function (c) {
      if (!c.s) return;
      var x = (c.i * CX + c.hx + 1) * T;
      lv.ropes.push({ x: x, top: (c.j * CY + 1) * T, bot: (c.j + 2) * CY * T - 4, kind: 'link' });
    });
    lv.exitRope = { x: (exitCell.i * CX + exitCell.ux + 1) * T, top: 0, bot: CY * T - 4, kind: 'exit', exit: true };
    lv.ropes.push(lv.exitRope);
    // кислотные ямы — в «коридорных» ячейках (проход слева и справа, без люков)
    var cand = lv.cells.filter(function (c) {
      return c !== start && c !== exitCell && c.e && c.i > 0 && cellAt(lv, c.i - 1, c.j).e && !c.s && c.ux < 0;
    });
    shuffle(cand, rng).slice(0, cfg.acid).forEach(function (c) {
      var wide = rng() < cfg.wide, w = wide ? 7 : 5, a = wide ? 3 : 3 + Math.floor(rng() * 3);
      var fy = (c.j + 1) * CY, x0 = c.i * CX;
      for (var x = a; x < a + w; x++) set(x0 + x, fy, 2);
      c.acid = { a: a, w: w };
      var left = (x0 + a) * T, top = (c.j * CY + 1) * T, bot = fy * T - 40;
      if (wide) { lv.ropes.push({ x: left + Math.round(w * T / 3), top: top, bot: bot, kind: 'pit' }); lv.ropes.push({ x: left + Math.round(2 * w * T / 3), top: top, bot: bot, kind: 'pit' }); }
      else lv.ropes.push({ x: left + w * T / 2, top: top, bot: bot, kind: 'pit' });
    });
    // уступы-полки (3 тайла, верх на 40 px выше пола) — места для находок
    lv.cells.forEach(function (c) {
      if (c === start || c.acid || rng() >= cfg.ledge) return;
      var ropesX = lv.ropes.filter(function (R) {
        return Math.floor(R.x / (CX * T)) === c.i && R.top < (c.j + 1) * CY * T && R.bot > c.j * CY * T;
      }).map(function (R) { return R.x / T - c.i * CX; });
      for (var t = 0; t < 8; t++) {
        var a = 2 + Math.floor(rng() * 7);
        if (ropesX.some(function (rx) { return rx > a - 3 && rx < a + 6; })) continue;
        var ry = (c.j + 1) * CY - 2;
        for (var x = a; x < a + 3; x++) set(c.i * CX + x, ry, 1);
        c.ledge = { a: a, row: ry };
        break;
      }
    });
    // старт: на полу стартовой ячейки, подальше от верёвок
    var sx = 0, bestD = -1;
    for (var tx = 2; tx <= 10; tx++) {
      var px = (start.i * CX + tx) * T + T / 2, d = 1e9;
      lv.ropes.forEach(function (R) { if (Math.abs(R.bot - (start.j + 1) * CY * T) < 2 * CY * T) d = Math.min(d, Math.abs(R.x - px)); });
      if (d > bestD) { bestD = d; sx = px; }
    }
    lv.start = { x: sx, y: (start.j + 1) * CY * T };
    return lv;
  }

  function populate(lv, cfg, rng) {
    var groundNodes = [];
    lv.plan.nodes.forEach(function (n) { if (n.h.mode === 'ground') groundNodes.push(n.h); });
    var startC = lv.startCell, exitC = lv.exitCell;
    function cOf(x, y) { var p = cellOf(lv, x, y); return cellAt(lv, p.i, p.j); }
    var taken = [{ x: lv.start.x, y: lv.start.y }];
    function free(x, y, d) { return taken.every(function (p) { return Math.abs(p.x - x) > d || Math.abs(p.y - y) > 30; }); }
    function onFloor(h) { var c = cOf(h.x, h.y); return Math.abs(h.y - (c.j + 1) * CY * T) < 1; }
    function pickNode(filter, d) {
      for (var t = 0; t < 300; t++) {
        var h = groundNodes[Math.floor(rng() * groundNodes.length)];
        if (filter && !filter(h)) continue;
        if (!free(h.x, h.y, d || 40)) continue;
        taken.push({ x: h.x, y: h.y }); return h;
      }
      return null;
    }
    var items = lv.items = [];
    function addItem(type, h) { if (h) items.push({ type: type, x: h.x, y: h.y, taken: false, lit: false }); }
    // фонари-чекпойнты — по пути от старта к выходу
    var path = cellPath(lv, startC, exitC);
    for (var li = 1; li <= cfg.lamps; li++) {
      var pc = path[Math.max(1, Math.min(path.length - 2, Math.round(li * path.length / (cfg.lamps + 1))))];
      addItem('lamp', pickNode(function (h) { return cOf(h.x, h.y) === pc && onFloor(h); }, 30));
    }
    var notStart = function (h) { return cOf(h.x, h.y) !== startC; };
    for (var m = 0; m < cfg.maps; m++) addItem('map', pickNode(m === 0 ? function (h) { return lv.cellDist.get(cOf(h.x, h.y)) <= 2; } : notStart));
    for (var cr = 0; cr < cfg.crates; cr++) addItem('crate', pickNode(cr === 0 ? null : notStart));
    for (var o = 0; o < cfg.oil; o++) addItem('oil', pickNode(notStart));
    for (var g = 0; g < cfg.gems; g++) {
      // драгоценности — чаще в тупиках и на полках
      var dead = function (h) { var c = cOf(h.x, h.y); return c.deg <= 1 || !onFloor(h) || rng() < 0.35; };
      addItem(rng() < 0.45 ? 'gem' : 'gear', pickNode(dead, 36));
    }
    // обитатели
    var en = lv.enemies = [];
    var cells = lv.cells.filter(function (c) { return c !== startC && lv.cellDist.has(c); });
    var farCells = cells.filter(function (c) { return lv.cellDist.get(c) >= 2; });
    function rc(list) { return list[Math.floor(rng() * list.length)]; }
    function ropeClear(c, px, d) {
      return lv.ropes.every(function (R) { return Math.abs(R.x - px) > d || R.bot < c.j * CY * T || R.top > (c.j + 1) * CY * T; });
    }
    function ledgeClear(c, px) { return !c.ledge || px < (c.i * CX + c.ledge.a - 1) * T || px > (c.i * CX + c.ledge.a + 4) * T; }
    function cellX(c, d) {
      for (var t = 0; t < 30; t++) { var px = (c.i * CX + 2 + rng() * 9) * T; if (ropeClear(c, px, d) && ledgeClear(c, px)) return Math.round(px); }
      return -1;
    }
    var sp = cfg.speed;
    for (var s = 0; s < cfg.spider; s++) {
      var c1 = rc(cells), x1 = cellX(c1, 30); if (x1 < 0 || c1.acid) continue;
      var top = (c1.j * CY + 1) * T, floor = (c1.j + 1) * CY * T, per = (2.6 + rng() * 1.6) / sp;
      en.push({ type: 'spider', x: x1, y: top + 14, top: top, lo: top + 14, hi: floor - 22 - Math.round(rng() * 18), per: per, ph: rng() * per, hp: HP.spider, alive: true });
    }
    for (var k = 0; k < cfg.spark; k++) {
      var c2 = rc(farCells.length ? farCells : cells), ang = (0.35 + rng() * 0.8) + Math.floor(rng() * 4) * Math.PI / 2, v = (40 + 6 * lv.n) * sp;
      var rx0 = (c2.i * CX + 1) * T + 8, rx1 = (c2.i * CX + CX) * T - 8, ry0 = (c2.j * CY + 1) * T + 8, ry1 = (c2.j + 1) * CY * T - 8;
      en.push({ type: 'spark', x: rx0 + rng() * (rx1 - rx0), y: ry0 + rng() * (ry1 - ry0 - 20), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
        rx0: rx0, rx1: rx1, ry0: ry0, ry1: ry1, hp: HP.spark, alive: true });
    }
    for (var d = 0; d < cfg.drop; d++) {
      var c3 = rc(cells), x3 = cellX(c3, 24); if (x3 < 0) continue;
      var top3 = (c3.j * CY + 1) * T, fy = top3, tx3 = Math.floor(x3 / T);
      for (var ty = c3.j * CY + 1; ty < lv.th; ty++) if (tileAt(lv, tx3, ty)) { fy = ty * T; break; }
      var per3 = (1.9 + rng() * 0.9) / sp;
      en.push({ type: 'drop', x: x3, y: top3, top: top3, floorY: fy, per: per3, ph: rng() * per3, alive: true });
    }
    for (var gh = 0; gh < cfg.ghost; gh++) {
      var c4 = rc(farCells.length ? farCells : cells), hx4 = (c4.i * CX + CX / 2) * T, hy4 = (c4.j * CY + CY / 2) * T;
      en.push({ type: 'ghost', x: hx4, y: hy4, hx: hx4, hy: hy4, v: (30 + 3 * lv.n) * sp, cool: 0, hp: HP.ghost, alive: true });
    }
    for (var ch = 0; ch < cfg.cham; ch++) {
      var h5 = pickNode(function (h) { var c = cOf(h.x, h.y); return lv.cellDist.get(c) >= 2 && onFloor(h); }, 40);
      if (!h5) continue;
      var ty5 = Math.round(h5.y / T), tx5 = Math.floor(h5.x / T), a5 = tx5, b5 = tx5;
      var walk = function (tx) { return tileAt(lv, tx, ty5) === 1 && !tileAt(lv, tx, ty5 - 1); };
      while (walk(a5 - 1)) a5--;
      while (walk(b5 + 1)) b5++;
      en.push({ type: 'cham', x: h5.x, y: h5.y, minX: a5 * T + 11, maxX: (b5 + 1) * T - 11, v: 55 * sp, shown: false, cool: 0, face: 1, hp: HP.cham, alive: true });
    }
  }

  function makeLevel(n, rng) {
    var cfg = LEVELS[n - 1];
    for (var tries = 0; tries < 40; tries++) {
      var lv = buildMaze(n, cfg, rng);
      lv.plan = analyze(lv);
      if (!lv.plan.exitReachable) continue;
      if (lv.cells.filter(function (c) { return c.acid; }).length < Math.min(cfg.acid, 1 + Math.floor(cfg.acid / 2)) && tries < 30) continue;
      populate(lv, cfg, rng);
      lv.tries = tries + 1;
      return lv;
    }
    throw new Error('ТАЙНИК: не удалось построить проходимый уровень ' + n);
  }

  // Капля кислоты — чистая функция времени: {stage:'grow'|'fall'|'splash', y, k} | null
  function dropAt(e, t) {
    var c = mod(t + e.ph, e.per);
    if (c < DROP_GROW) return { stage: 'grow', y: e.top + 3, k: c / DROP_GROW };
    var tf = c - DROP_GROW, y = e.top + 4 + 0.5 * DROP_G * tf * tf;
    if (y < e.floorY - 4) return { stage: 'fall', y: y, k: 1 };
    var tl = Math.sqrt(2 * (e.floorY - 8 - e.top) / DROP_G);
    if (tf - tl < DROP_SPLASH) return { stage: 'splash', y: e.floorY, k: (tf - tl) / DROP_SPLASH };
    return null;
  }
  function spiderY(e, t) { return e.lo + (e.hi - e.lo) * (0.5 - 0.5 * Math.cos(2 * Math.PI * (t + e.ph) / e.per)); }
  // Хитбокс обитателя (центр, полуразмеры) или null (не опасен)
  function enemyBox(e, t) {
    if (!e.alive) return null;
    switch (e.type) {
      case 'spider': return { x: e.x, y: e.y, w: 8, h: 7 };
      case 'spark': return { x: e.x, y: e.y, w: 6, h: 6 };
      case 'ghost': return { x: e.x, y: e.y, w: 9, h: 10 };
      case 'cham': return e.shown ? { x: e.x, y: e.y - 7, w: 11, h: 7 } : null;
      case 'drop': var d = dropAt(e, t); return d && d.stage === 'fall' ? { x: e.x, y: d.y, w: 3, h: 5 } : null;
    }
    return null;
  }
  function heroBox(h) { return { x: h.x, y: h.y - 9, w: 5, h: 8 }; }
  function hit(a, b) { return a && b && Math.abs(a.x - b.x) < a.w + b.w && Math.abs(a.y - b.y) < a.h + b.h; }

  // ---------- Игра ----------
  K.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {};
    var S = {
      level: opts.level || 1, maxLevel: opts.maxLevel || MAX_LEVEL, lives: opts.lives == null ? 3 : opts.lives,
      score: 0, energy: ENERGY, ammo: AMMO0, phase: 'play', phaseT: 0, time: 0, over: false, won: false,
      lv: null, hero: null, enemies: [], items: [], bullets: [], fx: [], checkpoint: null, hint: null, banner: 0,
      cam: { x: 0, y: 0 }, inv: 0, fireCd: 0, death: null, nextExtra: EXTRA_EVERY, input: { l: false, r: false, u: false, d: false },
      wantFire: false, kills: 0, found: 0
    };
    var acc = 0;
    function emit(t, d) { onEvent(t, d || {}); }
    function camTarget() {
      var h = S.hero, lv = S.lv;
      return { x: clamp(h.x + h.face * 30 - VW / 2, 0, Math.max(0, lv.pw - VW)), y: clamp(h.y - 10 - VH / 2, 0, Math.max(0, lv.ph - VH)) };
    }
    function loadLevel(n) {
      S.level = n; S.lv = makeLevel(n, rng);
      S.items = S.lv.items.map(function (it) { return Object.assign({}, it); });
      S.enemies = S.lv.enemies.map(function (e) { return Object.assign({}, e); });
      S.hero = newHero(S.lv.start.x, S.lv.start.y);
      S.checkpoint = { x: S.lv.start.x, y: S.lv.start.y };
      S.bullets = []; S.hint = null; S.banner = BANNER_T; S.phase = 'play'; S.energy = ENERGY; S.inv = 0;
      S.ammo = Math.max(S.ammo, AMMO_LVL); S.death = null;
      var c = camTarget(); S.cam.x = c.x; S.cam.y = c.y;
      emit('level', { level: n });
    }
    function addScore(p) {
      S.score += p;
      while (S.score >= S.nextExtra) { S.nextExtra += EXTRA_EVERY; if (S.lives < MAX_LIVES) { S.lives++; emit('extra', { lives: S.lives }); } }
    }
    function damage(n, src) {
      if (S.phase !== 'play') return;
      if (src !== 'fall' && S.inv > 0) return;
      S.energy = Math.max(0, S.energy - n); S.inv = INV_T;
      emit('hurt', { n: n, src: src, x: S.hero.x, y: S.hero.y - 9, energy: S.energy });
      if (S.energy <= 0) die('energy');
    }
    function die(reason) {
      if (S.phase !== 'play') return;
      S.lives--; S.phase = 'dead'; S.phaseT = DEAD_T;
      S.death = { reason: reason, x: S.hero.x, y: S.hero.y };
      emit('die', { reason: reason, x: S.hero.x, y: S.hero.y - 9, lives: S.lives });
    }
    function respawn() {
      S.hero = newHero(S.checkpoint.x, S.checkpoint.y); S.energy = ENERGY; S.inv = RESPAWN_INV; S.phase = 'play'; S.death = null;
      S.bullets = [];
      S.enemies.forEach(function (e) { if (e.type === 'ghost') { e.x = e.hx; e.y = e.hy; e.cool = 0; } if (e.type === 'cham') { e.shown = false; e.cool = 0; } });
      emit('respawn', { x: S.hero.x, y: S.hero.y });
    }
    function clearLevel() {
      var bonus = PTS.exit + S.energy * PTS.energy + S.ammo * PTS.ammo;
      addScore(bonus); S.phase = 'clear'; S.phaseT = CLEAR_T;
      emit('clear', { level: S.level, bonus: bonus });
    }
    function fire() {
      var h = S.hero;
      if (S.fireCd > 0) return;
      S.fireCd = FIRE_CD;
      if (S.ammo <= 0) { emit('empty', {}); return; }
      S.ammo--;
      S.bullets.push({ x: h.x + h.face * 8, y: h.y - 11, vx: h.face * BULLET_V, dist: 0 });
      emit('shot', { x: h.x + h.face * 10, y: h.y - 11, face: h.face });
    }
    function kill(e) {
      e.alive = false; S.kills++; addScore(PTS[e.type] || 0);
      emit('kill', { type: e.type, x: e.x, y: e.type === 'cham' ? e.y - 7 : e.y, pts: PTS[e.type] || 0 });
    }

    function updateEnemies(dt) {
      var h = S.hero, hx = h.x, hy = h.y - 9, t = S.time, alive = S.phase === 'play';
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive) continue;
        if (e.type === 'spider') e.y = spiderY(e, t);
        else if (e.type === 'spark') {
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.x < e.rx0) { e.x = e.rx0; e.vx = Math.abs(e.vx); } else if (e.x > e.rx1) { e.x = e.rx1; e.vx = -Math.abs(e.vx); }
          if (e.y < e.ry0) { e.y = e.ry0; e.vy = Math.abs(e.vy); } else if (e.y > e.ry1) { e.y = e.ry1; e.vy = -Math.abs(e.vy); }
        } else if (e.type === 'ghost') {
          var dx = hx - e.x, dy = hy - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1, tx, ty, v = e.v;
          if (e.cool > 0) { e.cool -= dt; tx = -dx / d; ty = -dy / d; v *= 0.8; }
          else if (alive && d < 210) { tx = dx / d; ty = dy / d; }
          else { var hdx = e.hx - e.x, hdy = e.hy - e.y, hd = Math.sqrt(hdx * hdx + hdy * hdy); if (hd < 2) { tx = 0; ty = 0; } else { tx = hdx / hd; ty = hdy / hd; v *= 0.5; } }
          e.x += tx * v * dt; e.y += ty * v * dt;
        } else if (e.type === 'cham') {
          var cdx = hx - e.x, near = Math.abs(cdx) < 90 && Math.abs(h.y - e.y) < 30;
          if (!e.shown) { if (alive && near) { e.shown = true; emit('reveal', { x: e.x, y: e.y - 7 }); } }
          else {
            if (e.cool > 0) { e.cool -= dt; e.x -= e.face * e.v * 0.7 * dt; }
            else if (Math.abs(cdx) > 240 || !alive) e.shown = false;
            else if (Math.abs(cdx) > 2) { e.face = cdx > 0 ? 1 : -1; e.x += e.face * e.v * dt; }
            e.x = clamp(e.x, e.minX, e.maxX);
          }
        }
      }
    }
    function updateBullets(dt) {
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i], step = b.vx * dt, gone = false;
        b.x += step; b.dist += Math.abs(step);
        if (b.dist > BULLET_R || tileAt(S.lv, Math.floor(b.x / T), Math.floor(b.y / T))) { gone = true; emit('spark', { x: b.x, y: b.y }); }
        else {
          var bb = { x: b.x, y: b.y, w: 3, h: 2 };
          for (var k = 0; k < S.enemies.length; k++) {
            var e = S.enemies[k]; if (e.type === 'drop') continue;
            var eb = enemyBox(e, S.time); if (!hit(bb, eb)) continue;
            e.hp--; gone = true;
            if (e.hp <= 0) kill(e); else { emit('hit', { type: e.type, x: e.x, y: eb.y }); if (e.type === 'ghost') e.cool = 1.2; if (e.type === 'cham') e.cool = 0.6; }
            break;
          }
        }
        if (gone) S.bullets.splice(i, 1);
      }
    }
    function contacts() {
      var hb = heroBox(S.hero);
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i], eb = enemyBox(e, S.time);
        if (!hit(hb, eb)) continue;
        if (S.inv > 0) continue;
        damage(DMG[e.type], e.type);
        if (e.type === 'ghost') e.cool = 2.0;
        if (e.type === 'cham') { e.cool = 1.5; e.face = S.hero.x > e.x ? 1 : -1; }
        if (S.phase !== 'play') return;
      }
    }
    function pickups() {
      var h = S.hero;
      for (var i = 0; i < S.items.length; i++) {
        var it = S.items[i];
        if (it.type === 'lamp') {
          if (it.lit || Math.abs(h.x - it.x) > 14 || Math.abs(h.y - it.y) > 24) continue;
          it.lit = true; S.checkpoint = { x: it.x, y: it.y }; addScore(PTS.lamp); emit('lamp', { x: it.x, y: it.y - 30 }); continue;
        }
        if (it.taken || Math.abs(h.x - it.x) > 13 || Math.abs((h.y - 9) - (it.y - 9)) > 17) continue;
        it.taken = true; S.found++;
        if (it.type === 'gem' || it.type === 'gear') { addScore(PTS[it.type]); emit('treasure', { type: it.type, x: it.x, y: it.y - 10, pts: PTS[it.type] }); }
        else if (it.type === 'crate') { S.ammo = Math.min(AMMO_MAX, S.ammo + CRATE); emit('ammo', { x: it.x, y: it.y - 10, ammo: S.ammo }); }
        else if (it.type === 'oil') { S.energy = Math.min(ENERGY, S.energy + 35); emit('oil', { x: it.x, y: it.y - 10, energy: S.energy }); }
        else if (it.type === 'map') {
          var c = cellOf(S.lv, h.x, h.y);
          S.hint = { t: HINT_T, i: c.i, j: c.j, path: cellPath(S.lv, cellAt(S.lv, c.i, c.j), S.lv.exitCell).map(function (q) { return [q.i, q.j]; }) };
          emit('map', { x: it.x, y: it.y - 10 });
        }
      }
    }
    function updateCam(dt) {
      var c = camTarget(), k = Math.min(1, dt * 5);
      S.cam.x += (c.x - S.cam.x) * k; S.cam.y += (c.y - S.cam.y) * k;
    }

    function step() {
      var dt = DT;
      S.time += dt;
      if (S.banner > 0) S.banner -= dt;
      if (S.hint) { S.hint.t -= dt; if (S.hint.t <= 0) S.hint = null; }
      if (S.phase === 'over' || S.phase === 'won') return;
      if (S.phase === 'clear') {
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.level >= S.maxLevel) { S.phase = 'won'; S.won = true; emit('win', { score: S.score }); }
          else loadLevel(S.level + 1);
        }
        return;
      }
      if (S.phase === 'dead') {
        updateEnemies(dt); updateBullets(dt);
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.lives <= 0) { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); }
          else respawn();
        }
        return;
      }
      if (S.inv > 0) S.inv -= dt;
      if (S.fireCd > 0) S.fireCd -= dt;
      var ev = stepHero(S.lv, S.hero, S.input, dt);
      if (ev === 'acid') { die('acid'); return; }
      if (ev === 'exit') { clearLevel(); return; }
      if (ev === 'hurt') { emit('land', { x: S.hero.x, y: S.hero.y, hard: true }); damage(S.hero.dmg, 'fall'); if (S.phase !== 'play') return; }
      else if (ev === 'jump' || ev === 'grab' || ev === 'land') emit(ev, { x: S.hero.x, y: S.hero.y });
      if (S.wantFire) { S.wantFire = false; fire(); }
      updateEnemies(dt); updateBullets(dt); contacts();
      if (S.phase !== 'play') return;
      pickups(); updateCam(dt);
    }

    var api = {
      _S: S,
      start: function () { loadLevel(S.level); return api; },
      update: function (dt) { acc += Math.min(dt, 0.1); var n = 0; while (acc >= DT && n++ < 8) { acc -= DT; step(); } },
      step: step,
      setInput: function (i) { S.input.l = !!i.l; S.input.r = !!i.r; S.input.u = !!i.u; S.input.d = !!i.d; },
      fire: function () { S.wantFire = true; },
      state: function () { return S; },
      _loadLevel: loadLevel, _damage: damage, _die: die
    };
    return api;
  };

  K.logic = {
    W: W, H: H, HUD: HUD, VW: VW, VH: VH, T: T, CX: CX, CY: CY, HALF: HALF, HH: HH, HANDS: HANDS, DT: DT,
    WALK: WALK, GRAV: GRAV, JUMP_VY: JUMP_VY, JUMP_VX: JUMP_VX, ROPE_VY: ROPE_VY, ROPE_VX: ROPE_VX, CLIMB: CLIMB,
    GRAB_AIR: GRAB_AIR, GRAB_REACH: GRAB_REACH, ROPE_CD: ROPE_CD, FALL_SAFE: FALL_SAFE, FALL_BIG: FALL_BIG,
    ENERGY: ENERGY, INV_T: INV_T, AMMO0: AMMO0, AMMO_LVL: AMMO_LVL, AMMO_MAX: AMMO_MAX, CRATE: CRATE,
    BULLET_V: BULLET_V, BULLET_R: BULLET_R, FIRE_CD: FIRE_CD, MAX_LEVEL: MAX_LEVEL, MAX_LIVES: MAX_LIVES, EXTRA_EVERY: EXTRA_EVERY,
    DEAD_T: DEAD_T, CLEAR_T: CLEAR_T, BANNER_T: BANNER_T, HINT_T: HINT_T,
    LEVELS: LEVELS, PTS: PTS, DMG: DMG, HP: HP, MAC_G: MAC_G, MAC_R: MAC_R,
    tileAt: tileAt, overlapSolid: overlapSolid, supported: supported, acidUnder: acidUnder,
    newHero: newHero, cloneHero: cloneHero, stepHero: stepHero, ropeNear: ropeNear, ropeMinY: ropeMinY, ropeMaxY: ropeMaxY,
    runMacro: runMacro, heroKey: heroKey, macrosFor: macrosFor, analyze: analyze, distToExit: distToExit,
    buildMaze: buildMaze, makeLevel: makeLevel, cellOf: cellOf, cellAt: cellAt, cellPath: cellPath, neighbors: neighbors,
    dropAt: dropAt, spiderY: spiderY, enemyBox: enemyBox, heroBox: heroBox, hit: hit, mod: mod, clamp: clamp
  };
})(typeof window !== 'undefined' ? window : globalThis);
