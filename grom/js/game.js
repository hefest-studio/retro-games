/* ГРОМ · логика игры (без DOM, детерминирована при заданном rng).
   Run-and-gun с исследованием больших уровней-лабиринтов: штурмовик мастерской «Гефест» в громовой броне.
   Мир — сетка тайлов (клетка = 1 единица, y вниз). Уровень — решётка комнат 32×20 клеток: остовное дерево
   (длинные коридоры) + петли (несколько путей к выходу) + тайники за трещинами, люками и тоннелями «колеса».
   В дальней комнате — арена с боссом; после победы открывается портал-выход. Тело: x — центр, y — низ (ступни).
   GROM.Game(opts) → api; GROM.logic — константы, генератор уровней, физика, граф проходимости (Nav) для тестов и бота. */
(function (global) {
  'use strict';
  var GR = global.GROM = global.GROM || {};

  // ---------- Константы ----------
  var T = 16, HUD = 32, VIEW_W = 40, VIEW_H = 22;            // экран 640×384: HUD 32 px + окно 40×22 клеток
  var RW = 32, RH = 20;                                      // комната: 31×19 клеток внутри + стена/пол
  var E = 0, R = 1, P = 2, K = 3, B = 4, G = 5;              // пусто, скала, платформа, трещина, бонус-блок, ворота арены
  var GRAV = 60, JUMP_V = 24.5, JUMP_CUT = 9, RUN = 7, VMAX = 22, HW = 0.38, HH = 1.8, WH = 0.85, WHEEL_V = 9, COYOTE = 0.08, JBUF = 0.12;
  var HPMAX = 8, LIVES = 3, CONTS = 1, INV_T = 1.0, SPAWN_INV = 2.2, DEAD_T = 1.4, CONT_T = 9;
  var CHARGE = 5, CH_REGEN = 0.5, CH_MIN = 0.6, MINE_COST = 0.6, MINE_R = 2.3, MINE_DMG = 9, MINE_T = 3, MINES_MAX = 3;
  var THUNDER0 = 2, THUNDER_MAX = 5, THUNDER_DMG = 20, THUNDER_BOSS = 12;
  var BEAM_LEN = 7, BEAM_DPS = 9, BEAM_ROT = 7;
  var EXTRA_LIFE = 25000, TIME_RESET = 120, ACTIVE_X = 24, ACTIVE_Y = 14;
  var KHP = {}; KHP[K] = 4; KHP[B] = 3;
  var PTS = { gem: 100, block: 50, beacon: 200, secret: 1000, crawler: 100, hopper: 150, flyer: 150, turret: 250, boss: 5000, timeBonus: 10 };
  var WEAP = {   // основное оружие: веер / лазер / отскок, ступени 1–3
    S: { cd: 0.16, n: [3, 5, 5], spread: [0.17, 0.15, 0.2], dmg: [1, 1, 1.3], v: 22, life: 0.65 },
    L: { cd: 0.2, n: [1, 1, 1], spread: [0, 0, 0], dmg: [2, 3, 4], v: 32, len: [1.6, 2.4, 3.2], life: 0.55, pierce: true },
    B: { cd: 0.18, n: [1, 2, 3], spread: [0, 0.1, 0.12], dmg: [1.4, 1.6, 1.9], v: 18, life: 1.2, bounces: [2, 3, 4] }
  };
  var FOES = {
    crawler: { hw: 0.5, hh: 0.8, hp: 2, dmg: 2, v: 2.2 },
    hopper: { hw: 0.45, hh: 1.0, hp: 3, dmg: 2 },
    flyer: { hw: 0.42, hh: 0.8, hp: 2, dmg: 2, v: 3.0 },
    turret: { hw: 0.5, hh: 0.8, hp: 5, dmg: 2 }
  };
  var BOSSES = {
    anvil: { hp: 70, hw: 1.6, hh: 1.3, dmg: 3 },       // hw/hh — полуразмеры; x,y босса — центр
    millstone: { hp: 85, hw: 1.6, hh: 1.6, dmg: 3 },
    kite: { hp: 115, hw: 1.5, hh: 0.9, dmg: 2 },
    horn: { hp: 175, hw: 2.0, hh: 1.6, dmg: 3 }
  };
  var PHASES = 3, BOSS_HEAL = 0.2;   // гибель героя в бою — босс чинится на 20%
  var LEVELS = [
    { rx: 5, ry: 4, seed: 11, zone: 'foundry', boss: 'anvil', time: 300, dens: 1.8, loops: 0.25, foes: { crawler: 4, flyer: 2, turret: 2, hopper: 0 } },
    { rx: 6, ry: 4, seed: 23, zone: 'steam', boss: 'millstone', time: 360, dens: 2.4, loops: 0.25, foes: { crawler: 3, flyer: 2, turret: 2, hopper: 2 } },
    { rx: 6, ry: 5, seed: 37, zone: 'copper', boss: 'kite', time: 420, dens: 2.8, loops: 0.22, foes: { crawler: 2, flyer: 3, turret: 3, hopper: 2 } },
    { rx: 7, ry: 5, seed: 53, zone: 'storm', boss: 'horn', time: 480, dens: 2.9, loops: 0.2, foes: { crawler: 2, flyer: 3, turret: 3, hopper: 3 } }
  ];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }

  // ---------- Генератор уровня (детерминирован по сиду уровня) ----------
  function buildLevel(n) {
    var C = LEVELS[n - 1], rng = mulberry32(C.seed), RX = C.rx, RY = C.ry, NR = RX * RY;
    var W = RX * RW + 1, H = RY * RH + 1, t = new Uint8Array(W * H), hp = new Float32Array(W * H);
    t.fill(R);
    function set(c, r, v) { if (c > 0 && c < W - 1 && r > 0 && r < H - 1) { t[r * W + c] = v; hp[r * W + c] = KHP[v] || 0; } }
    function get(c, r) { return c < 0 || r < 0 || c >= W || r >= H ? R : t[r * W + c]; }
    var rooms = [];
    for (var y = 0; y < RY; y++) for (var x = 0; x < RX; x++) rooms.push({ i: y * RX + x, rx: x, ry: y, x0: x * RW, y0: y * RH, kind: 'n', nb: {}, depth: -1, up: null, down: null, tunL: false, tunR: false });
    var conns = {};
    function key(a, b) { return a < b ? a + ',' + b : b + ',' + a; }
    function link(a, b, k, tree) {
      var o = { a: Math.min(a, b), b: Math.max(a, b), k: k, tree: !!tree, dir: rooms[a].ry === rooms[b].ry ? 'h' : 'v' };
      conns[key(a, b)] = o; rooms[a].nb[b] = o; rooms[b].nb[a] = o; return o;
    }
    function neigh(i) { var r = rooms[i], o = []; if (r.rx > 0) o.push(i - 1); if (r.rx < RX - 1) o.push(i + 1); if (r.ry > 0) o.push(i - RX); if (r.ry < RY - 1) o.push(i + RX); return o; }
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), q = a[i]; a[i] = a[j]; a[j] = q; } return a; }
    // 1. остовное дерево — DFS с возвратом (длинные извилистые коридоры)
    var seen = new Uint8Array(NR), st = [0]; seen[0] = 1;
    while (st.length) {
      var cur = st[st.length - 1], opts = neigh(cur).filter(function (q) { return !seen[q]; });
      if (!opts.length) { st.pop(); continue; }
      var nx = opts[Math.floor(rng() * opts.length)]; seen[nx] = 1;
      link(cur, nx, rooms[cur].ry === rooms[nx].ry ? 'door' : 'shaft', true); st.push(nx);
    }
    // 2. глубина по дереву, арена босса — самый дальний лист
    var dq = [0]; rooms[0].depth = 0;
    while (dq.length) { var c0 = dq.shift(); for (var k0 in rooms[c0].nb) { var m0 = +k0; if (rooms[m0].depth < 0) { rooms[m0].depth = rooms[c0].depth + 1; dq.push(m0); } } }
    var deg = function (i) { return Object.keys(rooms[i].nb).length; };
    var leaves = rooms.filter(function (r) { return r.i !== 0 && deg(r.i) === 1; });
    // 3–4. арена, тайники и петли. Перебираем кандидатов в арену (от самых дальних листьев), пока к предбаннику
    // не ведут ≥ 2 рёберно-независимых пути (несколько путей к выходу)
    var tree = Object.keys(conns).map(function (k) { return conns[k]; });
    function paths(s, tg) {
      if (s === tg) return 2;
      var used = {}, cnt = 0;
      for (var it = 0; it < 2; it++) {
        var prev = {}, q = [s]; prev[s] = -1;
        while (q.length && prev[tg] === undefined) {
          var c = q.shift();
          for (var k in rooms[c].nb) {
            var m = +k; if (prev[m] !== undefined || rooms[m].kind === 'X' || rooms[m].kind === 's') continue;
            if ((used[c + '>' + m] || 0) - (used[m + '>' + c] || 0) >= 1) continue;
            prev[m] = c; q.push(m);
          }
        }
        if (prev[tg] === undefined) break;
        cnt++;
        for (var v = tg; v !== s; v = prev[v]) { var u = prev[v]; if (used[v + '>' + u]) used[v + '>' + u]--; else used[u + '>' + v] = (used[u + '>' + v] || 0) + 1; }
      }
      return cnt;
    }
    function addLoop(p) { var h = rooms[p[0]].ry === rooms[p[1]].ry; link(p[0], p[1], h ? (rng() < 0.35 ? 'tunnel' : 'door') : 'shaft', false); }
    var byDepth = leaves.slice().sort(function (a, b) { return b.depth - a.depth || a.i - b.i; }), boss, ante;
    for (var bi = 0; bi < byDepth.length; bi++) {
      conns = {}; rooms.forEach(function (r) { r.nb = {}; r.kind = 'n'; });
      tree.forEach(function (c) { link(c.a, c.b, c.dir === 'h' ? 'door' : 'shaft', true); });
      boss = byDepth[bi]; boss.kind = 'X'; rooms[0].kind = 'S';
      ante = rooms[+Object.keys(boss.nb)[0]];
      // тайники — листья за трещиной, люком или тоннелем «колеса» (соседи старта — не тайники)
      var cand = shuffle(leaves.filter(function (r) { return r !== boss && neigh(0).indexOf(r.i) < 0; }));
      var nsec = Math.max(1, Math.min(3, Math.round(cand.length * 0.5))), alt = 0;
      cand.slice(0, nsec).forEach(function (r) {
        r.kind = 's'; var c = r.nb[Object.keys(r.nb)[0]];
        c.k = c.dir === 'v' ? 'hatch' : (alt++ % 2 ? 'crack' : 'tunnel');
      });
      // петли
      var free = [];
      rooms.forEach(function (r) { neigh(r.i).forEach(function (m) { if (m > r.i && !conns[key(r.i, m)]) free.push([r.i, m]); }); });
      free = shuffle(free).filter(function (p) { var a = rooms[p[0]].kind, b = rooms[p[1]].kind; return a !== 'X' && b !== 'X' && a !== 's' && b !== 's'; });
      var rest = [];
      free.forEach(function (p) { if (rng() < C.loops) addLoop(p); else rest.push(p); });
      while (paths(0, ante.i) < 2 && rest.length) addLoop(rest.shift());
      if (paths(0, ante.i) >= 2) break;
    }
    // 5. вырезаем комнаты и проходы
    rooms.forEach(function (r) { for (var yy = r.y0 + 1; yy < r.y0 + RH; yy++) for (var xx = r.x0 + 1; xx < r.x0 + RW; xx++) set(xx, yy, E); });
    var list = Object.keys(conns).map(function (k) { return conns[k]; }).sort(function (a, b) { return a.a - b.a || a.b - b.b; });
    list.forEach(function (c) {
      if (c.dir !== 'h') return;
      var L0 = rooms[c.a], wall = L0.x0 + RW, F = L0.y0 + RH;
      c.wall = wall; c.F = F;
      if (c.k === 'tunnel') {
        for (var xx = wall - 5; xx <= wall + 5; xx++) { set(xx, F - 3, R); set(xx, F - 2, R); set(xx, F - 1, E); }
        L0.tunR = true; rooms[c.b].tunL = true;
      } else for (var yy = F - 3; yy < F; yy++) set(wall, yy, c.k === 'crack' ? K : E);
    });
    list.forEach(function (c) {
      if (c.dir !== 'v') return;
      var U = rooms[c.a], D = rooms[c.b], lo = U.x0 + 5, hi = U.x0 + 25;
      if (U.tunL || D.tunL) lo = U.x0 + 11;
      if (U.tunR || D.tunR) hi = U.x0 + 20;
      var h = lo + Math.floor(rng() * (hi - lo + 1)), F = U.y0 + RH;
      c.h = h; c.F = F; U.down = c; D.up = c;
      for (var q = h; q < h + 3; q++) set(q, F, c.k === 'hatch' ? K : E);
      // лестница уступов в нижней комнате: подъём по 4 клетки, последний уступ — прямо под краем люка
      [[F + 4, h + 2, h + 5], [F + 8, h - 3, h], [F + 12, h + 2, h + 5], [F + 16, h - 3, h]].forEach(function (l) { for (var q2 = l[1]; q2 <= l[2]; q2++) set(q2, l[0], P); });
    });
    // громоотводы (контрольные точки) — на пути к арене через каждые 3 комнаты и в предбаннике
    var path = [], pv = ante;
    while (pv && pv.i !== 0) { path.unshift(pv); var nxt = null; for (var kq0 in pv.nb) if (pv.nb[kq0].tree && rooms[+kq0].depth === pv.depth - 1) nxt = rooms[+kq0]; pv = nxt; }
    path.forEach(function (r, i) { if ((i + 1) % 3 === 0 || r === ante) r.cp = true; });
    // 6. наполнение комнат
    var items = [], spawns = [], iid = 0;
    function item(k, x, y, ex) { var o = { id: iid++, k: k, x: x, y: y }; if (ex) for (var q in ex) o[q] = ex[q]; items.push(o); return o; }
    function wpick(wts) { var s = 0, k; for (k in wts) s += wts[k]; var v = rng() * s; for (k in wts) { v -= wts[k]; if (v < 0) return k; } return k; }
    function capsule() { return 'SLB'[Math.floor(rng() * 3)]; }
    var beacons = [];
    rooms.forEach(function (r) {
      var x0 = r.x0, y0 = r.y0, F = y0 + RH, busy = {}, hb = {};
      function mark(o, a, b) { for (var q = a; q <= b; q++) o[q] = 1; }
      function isFree(o, a, b) { for (var q = a; q <= b; q++) if (o[q]) return false; return true; }
      mark(busy, x0, x0 + 3); mark(busy, x0 + RW - 3, x0 + RW); mark(hb, x0, x0 + 3); mark(hb, x0 + RW - 3, x0 + RW);
      if (r.tunL) { mark(busy, x0, x0 + 7); mark(hb, x0, x0 + 8); }
      if (r.tunR) { mark(busy, x0 + RW - 7, x0 + RW); mark(hb, x0 + RW - 8, x0 + RW); }
      if (r.up) { mark(busy, r.up.h - 5, r.up.h + 7); mark(hb, r.up.h - 5, r.up.h + 7); }
      if (r.down) mark(busy, r.down.h - 2, r.down.h + 4);
      function floorCol(margin) { for (var tr = 0; tr < 40; tr++) { var c = x0 + 4 + Math.floor(rng() * (RW - 8)); if (isFree(busy, c - (margin || 0), c + (margin || 0))) return c; } return -1; }
      var plats = [];
      if (r.kind === 'X') {
        r.arena = true;
        if (!r.up) { for (var q = 0; q < 5; q++) { set(x0 + 5 + q, y0 + 15, P); set(x0 + 23 + q, y0 + 15, P); } }
        return;
      }
      // платформы (нижняя — на 4 клетки над полом, верхняя ступень — ещё на 4 выше)
      var np = 1 + (rng() < 0.6 ? 1 : 0);
      for (var kp = 0; kp < np; kp++) {
        for (var tr = 0; tr < 20; tr++) {
          var len = 4 + Math.floor(rng() * 3), a = x0 + 4 + Math.floor(rng() * (RW - 8 - len));
          if (!isFree(hb, a - 2, a + len + 1)) continue;
          for (var q3 = a; q3 < a + len; q3++) set(q3, y0 + 16, P);
          mark(hb, a - 2, a + len + 1); mark(busy, a - 2, a + len + 1); plats.push({ a: a, b: a + len - 1, y: y0 + 16 });
          if (rng() < 0.6) {
            var l2 = 3 + Math.floor(rng() * 3), side = rng() < 0.5 ? 1 : -1, a2 = side > 0 ? a + len + 1 : a - l2 - 1;
            if (a2 >= x0 + 4 && a2 + l2 <= x0 + RW - 4 && isFree(hb, a2 - 1, a2 + l2)) {
              for (var q4 = a2; q4 < a2 + l2; q4++) set(q4, y0 + 12, P);
              mark(hb, a2 - 1, a2 + l2); plats.push({ a: a2, b: a2 + l2 - 1, y: y0 + 12 });
            }
          }
          break;
        }
      }
      if (r.kind === 'S') {
        var sb = item('beacon', x0 + 4.5, F - 0.9, { start: true }); beacons.push(sb);
        item('gem', x0 + 9.5, F - 0.6); item('gem', x0 + 11.5, F - 0.6);
        return;
      }
      // бонус-блок: на конце платформы (бить снизу/лучом) или на полу (бить в упор)
      if (plats.length && rng() < 0.5) { var pl = plats[0], bc = rng() < 0.5 ? pl.a : pl.b; set(bc, pl.y, B); pl.bonus = bc; }
      else { var fc = floorCol(2); if (fc > 0) { set(fc, F - 1, B); mark(busy, fc - 2, fc + 2); } }
      // ящики-препятствия (1–2 клетки)
      var ncr = r.kind === 's' ? 0 : Math.floor(rng() * 3);
      for (var kc = 0; kc < ncr; kc++) { var cc = floorCol(2); if (cc < 0) break; set(cc, F - 1, P); if (rng() < 0.4) set(cc, F - 2, P); mark(busy, cc - 2, cc + 2); }
      // самоцветы
      plats.forEach(function (p) { for (var q5 = p.a; q5 <= p.b; q5 += 2) if (q5 !== p.bonus && rng() < 0.55) item('gem', q5 + 0.5, p.y - 0.6); });
      var ng = 1 + Math.floor(rng() * 3);
      for (var kg = 0; kg < ng; kg++) { var gc = floorCol(0); if (gc > 0) { item('gem', gc + 0.5, F - 0.6); busy[gc] = 1; } }
      if (r.kind === 's') {   // тайник: сокровища, без врагов
        var tc = floorCol(1); if (tc > 0) { item(rng() < 0.5 ? 'life' : 'thunder', tc + 0.5, F - 0.7); busy[tc] = 1; }
        var cc2 = floorCol(1); if (cc2 > 0) { item('cap', cc2 + 0.5, F - 0.7, { w: capsule() }); busy[cc2] = 1; }
        for (var kq = 0; kq < 4; kq++) { var gq = floorCol(0); if (gq > 0) { item('gem', gq + 0.5, F - 0.6); busy[gq] = 1; } }
        return;
      }
      function anyFloor() { for (var tr2 = 0; tr2 < 60; tr2++) { var c = x0 + 5 + Math.floor(rng() * (RW - 10)); if (get(c, F) !== E && get(c, F - 1) === E && get(c, F - 2) === E && get(c, F - 3) === E && !items.some(function (it) { return Math.abs(it.x - c - 0.5) < 1.5 && it.y > F - 2; }) && !(r.down && c >= r.down.h - 2 && c <= r.down.h + 4)) return c; } return -1; }
      if (r.cp) { var bcn = floorCol(1); if (bcn < 0) bcn = anyFloor(); if (bcn > 0) { beacons.push(item('beacon', bcn + 0.5, F - 0.9)); busy[bcn] = 1; } }
      if (rng() < 0.3) { var hc = floorCol(0); if (hc > 0) { item(rng() < 0.6 ? 'hp' : 'charge', hc + 0.5, F - 0.7); busy[hc] = 1; } }
      // враги
      var base = C.dens + (r.depth > 2 ? 0.6 : -0.6), cnt = Math.max(0, Math.round(base + rng() * 1.2 - 0.6));
      if (r.depth <= 1) cnt = Math.min(cnt, 1);
      for (var ke = 0; ke < cnt; ke++) {
        var ty = wpick(C.foes);
        if (ty === 'crawler' || ty === 'hopper') { var ec = floorCol(1); if (ec < 0) ec = anyFloor(); if (ec < 0) continue; spawns.push({ type: ty, x: ec + 0.5, y: F, room: r.i }); }
        else if (ty === 'flyer') { var fx = x0 + 6 + Math.floor(rng() * 20), fy = y0 + 6 + Math.floor(rng() * 4); if (get(fx, fy) !== E) continue; spawns.push({ type: ty, x: fx + 0.5, y: fy + 0.5, room: r.i }); }
        else {
          if (plats.length && rng() < 0.3) { var pp = plats[Math.floor(rng() * plats.length)], pc = pp.a + Math.floor((pp.b - pp.a) / 2); if (pc !== pp.bonus && !pp.tur) pp.tur = spawns.push({ type: ty, x: pc + 0.5, y: pp.y, room: r.i, mount: 'floor' }); }
          else {
            for (var tt = 0; tt < 20; tt++) {
              var tcx = x0 + 5 + Math.floor(rng() * 22);
              if (get(tcx, y0) === E || get(tcx, y0 + 1) !== E || get(tcx, y0 + 2) !== E || (r.up && tcx >= r.up.h - 4 && tcx <= r.up.h + 6)) continue;
              spawns.push({ type: ty, x: tcx + 0.5, y: y0 + 1 + FOES.turret.hh, room: r.i, mount: 'ceil' }); break;
            }
          }
        }
      }
    });
    // 7. арена: ворота, точка появления босса, портал
    var gates = [];
    for (var kb in boss.nb) {
      var cb = boss.nb[kb];
      if (cb.dir === 'h') for (var gy = cb.F - 3; gy < cb.F; gy++) gates.push(gy * W + cb.wall);
      else for (var gx = cb.h; gx < cb.h + 3; gx++) gates.push(cb.F * W + gx);
    }
    var BF = boss.y0 + RH, bk = C.boss, bp;
    if (bk === 'anvil') bp = { x: boss.x0 + 24, y: BF - BOSSES.anvil.hh };
    else if (bk === 'millstone') bp = { x: boss.x0 + 24, y: BF - BOSSES.millstone.hh };
    else if (bk === 'kite') bp = { x: boss.x0 + 16, y: boss.y0 + 6 };
    else bp = { x: boss.x0 + 16.5, y: boss.y0 + 4.2 };
    var pcx = boss.x0 + 16;
    if (boss.down && Math.abs(boss.down.h + 1.5 - pcx) < 5) pcx = boss.down.h + 1.5 > boss.x0 + 16 ? boss.x0 + 8 : boss.x0 + 24;
    var entry = conns[key(boss.i, ante.i)], spawnX = boss.x0 + 4.5;
    if (entry.dir === 'h' && ante.rx > boss.rx) spawnX = boss.x0 + RW - 4.5;
    var start = { x: rooms[0].x0 + 4.5, y: rooms[0].y0 + RH };
    if (beacons.length) beacons[0].x = start.x;
    return {
      n: n, cfg: C, zone: C.zone, bossKey: bk, W: W, H: H, t: t, hp: hp, RX: RX, RY: RY, rooms: rooms, conns: list,
      items: items, spawns: spawns, start: start, bossRoom: boss.i, ante: ante.i, bossPos: bp, gates: gates,
      portal: { x: pcx + 0.5, y: BF }, arenaSpawn: { x: spawnX, y: BF }, time: C.time
    };
  }
  var LV = {};
  function level(n) { return LV[n] || (LV[n] = buildLevel(n)); }

  // ---------- Физика (общая для игры, графа проходимости и бота) ----------
  function solid(w, c, r) { if (c < 0 || r < 0 || c >= w.W || r >= w.H) return true; return w.t[r * w.W + c] !== E; }
  function boxFree(w, x, y, hw, hh) {
    var c0 = Math.floor(x - hw + 1e-6), c1 = Math.floor(x + hw - 1e-6), r0 = Math.floor(y - hh + 1e-6), r1 = Math.floor(y - 1e-6);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solid(w, c, r)) return false;
    return true;
  }
  // перемещение тела (x — центр, y — низ); бит 1 — упёрся вправо/влево, 4 — приземлился, 8 — ударился головой
  function move(w, b, hw, hh, dx, dy) {
    var hit = 0, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.4)), sx = dx / n, sy = dy / n;
    for (var i = 0; i < n; i++) {
      if (sx) {
        var nx = b.x + sx;
        if (boxFree(w, nx, b.y, hw, hh)) b.x = nx;
        else {
          var ox = b.x; b.x = sx > 0 ? Math.floor(nx + hw - 1e-6) - hw - 1e-4 : Math.floor(nx - hw + 1e-6) + 1 + hw + 1e-4;
          if ((sx > 0 && b.x > nx) || (sx < 0 && b.x < nx) || !boxFree(w, b.x, b.y, hw, hh)) b.x = ox;
          hit |= 1; sx = 0;
        }
      }
      if (sy) {
        var ny = b.y + sy;
        if (boxFree(w, b.x, ny, hw, hh)) b.y = ny;
        else {
          var oy = b.y; b.y = sy > 0 ? Math.floor(ny - 1e-6) : Math.floor(ny - hh + 1e-6) + 1 + hh;
          if (!boxFree(w, b.x, b.y, hw, hh)) b.y = oy;
          hit |= sy > 0 ? 4 : 8; sy = 0;
        }
      }
    }
    return hit;
  }
  function newHero(x, y) {
    return { x: x, y: y, vx: 0, vy: 0, face: 1, ground: true, coy: 0, jbuf: 0, jprev: false, form: 'man', hp: HPMAX, inv: 0, charge: CHARGE,
      fireCd: 0, mineCd: 0, beam: { on: false, ang: 0, len: 0, ex: x, ey: y }, aim: { x: 1, y: 0 }, runT: 0, shotT: 0 };
  }
  function bodyH(h) { return h.form === 'wheel' ? WH : HH; }
  // шаг героя: inp {dx, dy, jump(удержание)}; возвращает биты событий: 1 — прыжок, 2 — приземление
  function heroPhys(w, h, inp, dt) {
    var ev = 0, wheel = h.form === 'wheel', hh = wheel ? WH : HH, rooted = h.beam.on && !wheel;
    var vx = rooted ? 0 : inp.dx * (wheel ? WHEEL_V : RUN);
    if (inp.dx && !rooted) h.face = inp.dx > 0 ? 1 : -1;
    if (inp.jump && !h.jprev) h.jbuf = JBUF;
    h.jprev = !!inp.jump;
    if (h.ground) h.coy = COYOTE; else h.coy -= dt;
    if (!wheel && !rooted && h.jbuf > 0 && h.coy > 0) { h.vy = -JUMP_V; h.coy = 0; h.jbuf = 0; h.ground = false; ev |= 1; }
    h.jbuf -= dt;
    if (!inp.jump && h.vy < -JUMP_CUT) h.vy = -JUMP_CUT;
    h.vy = Math.min(VMAX, h.vy + GRAV * dt);
    h.vx = vx;
    var was = h.ground, hit = move(w, h, HW, hh, vx * dt, h.vy * dt);
    if (hit & 12) h.vy = 0;
    h.ground = h.vy >= 0 && !boxFree(w, h.x, h.y + 0.03, HW, hh);
    if (h.ground) { h.vy = 0; if (!was) ev |= 2; }
    if (h.ground && vx) h.runT += dt;
    return ev;
  }
  function setForm(w, h, form) {
    if (form === h.form) return true;
    if (form === 'wheel') { if (h.charge < CH_MIN && h.charge < CHARGE) return false; h.form = 'wheel'; h.beam.on = false; return true; }
    if (!boxFree(w, h.x, h.y, HW, HH)) return false;
    h.form = 'man'; return true;
  }
  function los(w, x0, y0, x1, y1) {
    var d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.3);
    for (var i = 1; i < n; i++) { var x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (solid(w, Math.floor(x), Math.floor(y))) return false; }
    return true;
  }

  // ---------- Макросы движения (граф проходимости и бот используют одни и те же) ----------
  // walk d — шаг на соседнюю клетку (или сход с края); jump dc — прыжок с полным удержанием и ходом к столбцу c+dc;
  // jumpD dc — прыжок, ход начинается через 8 кадров; roll d,n — свернуться в колесо, прокатиться на n клеток, развернуться.
  var ACTS = [];
  ACTS.push({ k: 'walk', d: -1 }, { k: 'walk', d: 1 });
  for (var dc = -7; dc <= 7; dc++) if (dc) ACTS.push({ k: 'jump', dc: dc });
  for (var dd = 1; dd <= 5; dd++) { ACTS.push({ k: 'jumpD', dc: dd }); ACTS.push({ k: 'jumpD', dc: -dd }); }
  var ROLL0 = ACTS.length;
  for (var rn = 3; rn <= 18; rn++) { ACTS.push({ k: 'roll', d: 1, n: rn }); ACTS.push({ k: 'roll', d: -1, n: rn }); }
  function Macro(ai, c) { this.ai = ai; this.a = ACTS[ai]; this.c = c; this.f = 0; this.air = false; this.done = false; this.fail = false; }
  Macro.prototype.input = function (h) {
    var a = this.a, o = { dx: 0, dy: 0, jump: false, form: null };
    if (a.k === 'walk') { var tx = this.c + a.d + 0.5; if (!this.air && Math.abs(h.x - tx) > 0.1) o.dx = h.x < tx ? 1 : -1; }
    else if (a.k === 'jump' || a.k === 'jumpD') {
      o.jump = true; var tj = this.c + a.dc + 0.5;
      if ((a.k === 'jump' || this.f >= 8) && Math.abs(h.x - tj) > 0.1) o.dx = h.x < tj ? 1 : -1;
    } else if (a.k === 'roll') {
      var tr = this.c + a.d * a.n + 0.5;
      if (Math.abs(h.x - tr) > 0.12) { o.dx = h.x < tr ? 1 : -1; o.form = 'wheel'; } else o.form = 'man';
    }
    return o;
  };
  // вызывается после шага физики
  Macro.prototype.after = function (h) {
    this.f++;
    if (!h.ground) this.air = true;
    var a = this.a;
    if (a.k === 'walk') { if (h.ground && (this.air || Math.abs(h.x - (this.c + a.d + 0.5)) <= 0.1)) this.done = true; }
    else if (a.k === 'jump' || a.k === 'jumpD') { if (this.air && h.ground) this.done = true; }
    else if (a.k === 'roll') { if (h.form === 'man' && h.ground && this.f > 2) this.done = true; }
    if (this.f > 200) this.fail = true;
  };
  function nodeOf(w, h) {
    if (!h.ground || h.form !== 'man') return -1;
    var r = Math.round(h.y); if (Math.abs(h.y - r) > 0.01) return -1;
    var c = Math.floor(h.x);
    return isNode(w, c, r) ? r * w.W + c : -1;
  }
  function isNode(w, c, r) { return solid(w, c, r) && !solid(w, c, r - 1) && !solid(w, c, r - 2) && boxFree(w, c + 0.5, r, HW, HH); }
  // смоделировать макрос из клетки (c, r) со смещением x; → { to, t } или null
  function simulate(w, c, r, ai, xoff) {
    var h = newHero(c + xoff, r), m = new Macro(ai, c), dt = 1 / 60;
    if (!boxFree(w, h.x, h.y, HW, HH)) return null;
    while (!m.done && !m.fail) {
      var o = m.input(h);
      if (o.form) { if (!setForm(w, h, o.form) && o.form === 'man') { /* нет места развернуться — катимся дальше */ } }
      heroPhys(w, h, o, dt); m.after(h);
      if (h.y > w.H + 2) { m.fail = true; }
    }
    if (m.fail) return null;
    var to = nodeOf(w, h);
    return to < 0 ? null : { to: to, t: m.f / 60 };
  }
  // Граф проходимости: узлы — клетки, на которых можно стоять; рёбра — макросы, проверенные физикой (2 смещения старта)
  function Nav(lv, o) {
    o = o || {};
    var w = { t: new Uint8Array(lv.t), W: lv.W, H: lv.H };
    if (o.broken) for (var i = 0; i < w.t.length; i++) if (w.t[i] === K) w.t[i] = E;
    if (o.gates) lv.gates.forEach(function (q) { w.t[q] = G; });
    var out = new Map();
    function edges(id) {
      if (out.has(id)) return out.get(id);
      var c = id % w.W, r = Math.floor(id / w.W), best = {}, list = [];
      var mouth = { '1': !solid(w, c + 1, r - 1) && solid(w, c + 1, r - 2), '-1': !solid(w, c - 1, r - 1) && solid(w, c - 1, r - 2) };
      for (var ai = 0; ai < ACTS.length; ai++) {
        var a = ACTS[ai];
        if (a.k === 'roll' && !mouth[a.d]) continue;
        var s1 = simulate(w, c, r, ai, 0.44); if (!s1 || s1.to === id) continue;
        var s2 = simulate(w, c, r, ai, 0.56); if (!s2 || s2.to !== s1.to) continue;
        var tm = Math.max(s1.t, s2.t) + (a.k === 'roll' ? 0.8 : 0);
        if (!best[s1.to] || best[s1.to].t > tm) best[s1.to] = { to: s1.to, a: ai, t: tm };
      }
      for (var k in best) list.push(best[k]);
      out.set(id, list); return list;
    }
    function reach(from) {
      var seen = new Set([from]), q = [from];
      while (q.length) { var n = q.pop(), es = edges(n); for (var j = 0; j < es.length; j++) if (!seen.has(es[j].to)) { seen.add(es[j].to); q.push(es[j].to); } }
      return seen;
    }
    // поле расстояний (время) до множества целей — Дейкстра по обратным рёбрам внутри достижимого из from
    function field(from, targets) {
      var all = reach(from), rev = new Map();
      all.forEach(function (n) { edges(n).forEach(function (e) { if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push({ from: n, t: e.t }); }); });
      var dist = new Map(), heap = [];
      function push(n, d) { heap.push([d, n]); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var x = heap[p]; heap[p] = heap[i]; heap[i] = x; i = p; } }
      function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, rr = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === i) break; var x = heap[m]; heap[m] = heap[i]; heap[i] = x; i = m; } } return top; }
      targets.forEach(function (n) { if (all.has(n)) { dist.set(n, 0); push(n, 0); } });
      while (heap.length) {
        var top = pop(), d = top[0], n = top[1]; if (d > dist.get(n)) continue;
        (rev.get(n) || []).forEach(function (e) { var nd = d + e.t + 0.15; if (!dist.has(e.from) || nd < dist.get(e.from)) { dist.set(e.from, nd); push(e.from, nd); } });
      }
      return dist;
    }
    return { w: w, edges: edges, reach: reach, field: field, nodeAt: function (x, y) { return Math.round(y) * w.W + Math.floor(x); }, isNode: function (id) { return isNode(w, id % w.W, Math.floor(id / w.W)); } };
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(1), emit = opts.onEvent || function () {}, dmgMul = opts.dmgMul == null ? 1 : opts.dmgMul;
    var S = { score: 0, lives: LIVES, conts: CONTS, time: 0, phase: 'play', phaseT: 0, nextLife: EXTRA_LIFE, kills: 0, level: 0,
      maxLevel: opts.maxLevel || LEVELS.length, weapon: { k: 'S', lv: 1 }, thunder: THUNDER0, flash: 0, banner: 0, cam: { x: 0, y: 0 }, won: false, over: false, secrets: 0, gems: 0 };
    var inp = { dx: 0, dy: 0, jump: false, fire: false, beam: false };
    var api = {};

    function room(x, y) { var lv = S.lv, rx = clamp(Math.floor(x / RW), 0, lv.RX - 1), ry = clamp(Math.floor(y / RH), 0, lv.RY - 1); return lv.rooms[ry * lv.RX + rx]; }
    function loadLevel(n) {
      var lv = level(n);
      S.level = n; S.lv = lv; S.W = lv.W; S.H = lv.H; S.zone = lv.zone;
      S.t = new Uint8Array(lv.t); S.thp = new Float32Array(lv.hp);
      S.items = lv.items.map(function (o) { var c = {}; for (var k in o) c[k] = o[k]; c.got = false; c.on = !!o.start; return c; });
      S.enemies = lv.spawns.map(function (s) { var f = FOES[s.type]; return { type: s.type, x: s.x, y: s.type === 'flyer' ? s.y + f.hh / 2 : s.y, hw: f.hw, hh: f.hh, hp: f.hp, max: f.hp, dir: rng() < 0.5 ? -1 : 1, vx: 0, vy: 0, cd: 1 + rng() * 1.5, warn: false, flash: 0, dead: false, mount: s.mount || null, ph: rng() * 6, room: s.room, ground: false }; });
      S.bullets = []; S.eb = []; S.mines = []; S.waves = []; S.marks = []; S.booms = [];
      S.boss = null; S.bossActive = false; S.bossDone = false; S.portal = null;
      S.ltime = lv.time; S.visited = {}; S.cp = { x: lv.start.x, y: lv.start.y };
      S.hero = newHero(lv.start.x, lv.start.y); S.inp = inp;
      S.banner = 2.6; S.phase = 'play'; S.phaseT = 0; S.flash = 0;
      S.cam.x = clamp(S.hero.x - VIEW_W / 2, 0, S.W - VIEW_W); S.cam.y = clamp(S.hero.y - VIEW_H * 0.6, 0, S.H - VIEW_H);
      S.visited[room(S.hero.x, S.hero.y - 1).i] = 1;
      emit('level', { n: n, zone: lv.zone });
    }
    function addScore(p) {
      S.score += p;
      while (S.score >= S.nextLife) { S.nextLife += EXTRA_LIFE; S.lives++; emit('extraLife', {}); }
    }
    function tileHit(c, r, dmg) {
      var i = r * S.W + c, v = S.t[i];
      if (v !== K && v !== B) return false;
      S.thp[i] -= dmg;
      if (S.thp[i] <= 0) {
        S.t[i] = E; addScore(PTS.block); emit('break', { x: c + 0.5, y: r + 0.5, k: v === B ? 'bonus' : 'crack' });
        if (v === B) {
          var roll = rng(), it;
          if (roll < 0.42) it = { k: 'cap', w: 'SLB'[Math.floor(rng() * 3)] };
          else if (roll < 0.62) it = { k: 'hp' }; else if (roll < 0.76) it = { k: 'thunder' }; else if (roll < 0.88) it = { k: 'charge' }; else it = { k: 'gem' };
          it.x = c + 0.5; it.y = r + 0.5; it.got = false; it.id = 'd' + S.time.toFixed(3) + c; it.drop = true; it.vy = -6; S.items.push(it);
        }
      }
      return true;
    }
    function hurt(d, why) {
      var h = S.hero;
      if (S.phase !== 'play' || h.inv > 0 || h.form === 'wheel' || d <= 0) return false;
      d *= dmgMul * (1 + 0.2 * (S.level - 1)); if (d <= 0) return false;
      h.hp -= d; h.inv = INV_T; emit('hurt', { x: h.x, y: h.y - 1, why: why, hp: h.hp });
      if (h.hp <= 0) die(why);
      return true;
    }
    function die(why) {
      var h = S.hero; h.hp = 0; h.beam.on = false;
      S.phase = 'dead'; S.phaseT = DEAD_T; S.lives--;
      S.weapon.lv = Math.max(1, S.weapon.lv - 1);
      if (S.boss && S.bossActive && !S.boss.dead) { var b = S.boss; b.hp = Math.min(b.max, b.hp + b.max * BOSS_HEAL); b.phase = Math.min(PHASES - 1, Math.floor((1 - b.hp / b.max) * PHASES)); }
      emit('die', { x: h.x, y: h.y - 1, why: why });
    }
    function respawn() {
      var p = S.bossActive || S.bossDone ? S.lv.arenaSpawn : S.cp, h = newHero(p.x, p.y);
      h.inv = SPAWN_INV; h.face = S.hero.face; S.hero = h; S.phase = 'play';
      if (S.ltime <= 0) S.ltime = TIME_RESET;
      S.thunder = Math.max(S.thunder, THUNDER0);
      S.eb = []; emit('respawn', {});
    }
    function hitEnemy(e, d, how) {
      if (e.dead) return;
      e.hp -= d; e.flash = 0.1;
      if (e.hp <= 0) {
        e.dead = true; S.kills++; var p = PTS[e.type] || 100; addScore(p);
        emit('kill', { type: e.type, x: e.x, y: e.y - e.hh / 2, pts: p, how: how });
        var q = rng();
        if (q < 0.1) S.items.push({ k: 'hp', x: e.x, y: e.y - e.hh / 2, got: false, id: 'e' + S.kills, drop: true, vy: -4 });
        else if (q < 0.25) S.items.push({ k: 'gem', x: e.x, y: e.y - e.hh / 2, got: false, id: 'e' + S.kills, drop: true, vy: -4 });
      } else emit('hit', { x: e.x, y: e.y - e.hh / 2 });
    }
    function hitBoss(d, how) {
      var b = S.boss; if (!b || b.dead || b.intro > 0 || b.shift > 0) return false;
      b.hp -= d; b.flash = 0.08;
      if (b.hp <= 0) { b.hp = 0; b.dead = true; b.deadT = 2; S.eb = []; S.waves = []; S.marks = []; addScore(PTS.boss * S.level); emit('bossDie', { x: b.x, y: b.y, key: b.key }); return true; }
      var ph = Math.min(PHASES - 1, Math.floor((1 - b.hp / b.max) * PHASES));
      if (ph > b.phase) { b.phase = ph; b.shift = 1; emit('phase', { phase: ph, x: b.x, y: b.y }); }
      emit('bossHit', { x: b.x, y: b.y }); return true;
    }
    function bossBox(b, x, y, pad) { return Math.abs(x - b.x) < b.hw + (pad || 0) && Math.abs(y - b.y) < b.hh + (pad || 0); }
    function eBox(e, x, y, pad) { return Math.abs(x - e.x) < e.hw + (pad || 0) && y > e.y - e.hh - (pad || 0) && y < e.y + (pad || 0); }
    function heroOverlap(x, y, rx, ry) { var h = S.hero, hh = bodyH(h); return Math.abs(x - h.x) < HW + rx && y > h.y - hh - ry && y < h.y + ry; }
    function onScreen(x, y, m) { m = m || 0; return x > S.cam.x - m && x < S.cam.x + VIEW_W + m && y > S.cam.y - m && y < S.cam.y + VIEW_H + m; }
    function aimDir(h) {
      var dx = inp.dx, dy = inp.dy;
      if (dy < 0 && !dx) return { x: 0, y: -1 };
      if (dy < 0) return { x: dx * 0.7071, y: -0.7071 };
      if (dy > 0 && !h.ground) return dx ? { x: dx * 0.7071, y: 0.7071 } : { x: 0, y: 1 };
      return { x: h.face, y: 0 };
    }
    function shoot(h) {
      var wk = S.weapon.k, lv = S.weapon.lv - 1, Wp = WEAP[wk], a = aimDir(h); h.aim = a;
      var mx = h.x + a.x * 0.6, my = h.y - 0.8 + (a.y < 0 ? -0.75 : a.y > 0 ? 0.3 : 0) + a.y * 0.3, base = Math.atan2(a.y, a.x), n = Wp.n[lv];
      for (var i = 0; i < n; i++) {
        var ang = base + (n > 1 ? (i - (n - 1) / 2) * Wp.spread[lv] / Math.max(1, (n - 1) / 2) : 0);
        S.bullets.push({ x: mx, y: my, vx: Math.cos(ang) * Wp.v, vy: Math.sin(ang) * Wp.v, dmg: Wp.dmg[lv], k: wk, life: Wp.life, bounces: Wp.bounces ? Wp.bounces[lv] : 0, len: Wp.len ? Wp.len[lv] : 0, hit: wk === 'L' ? [] : null });
      }
      h.fireCd = Wp.cd; h.shotT = 0.08; emit('shot', { k: wk, lv: lv + 1 });
    }
    function thunder() {
      if (S.phase !== 'play' || S.thunder <= 0) return false;
      S.thunder--; S.flash = 0.6;
      S.enemies.forEach(function (e) { if (!e.dead && onScreen(e.x, e.y, 1)) hitEnemy(e, THUNDER_DMG, 'thunder'); });
      if (S.boss && S.bossActive && !S.boss.dead) { var keep = S.boss.shift; S.boss.shift = 0; hitBoss(THUNDER_BOSS, 'thunder'); if (!S.boss.dead && S.boss.shift === 0) S.boss.shift = keep; }
      S.eb = []; S.marks = [];
      emit('thunder', { n: S.thunder }); return true;
    }
    function boom(x, y, r, dmg, src) {
      S.booms.push({ x: x, y: y, r: r, t: 0.35 });
      S.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - x, e.y - e.hh / 2 - y) < r + e.hw) hitEnemy(e, dmg, src); });
      if (S.boss && S.bossActive && !S.boss.dead && Math.hypot(S.boss.x - x, S.boss.y - y) < r + Math.max(S.boss.hw, S.boss.hh)) hitBoss(dmg * 0.8, src);
      for (var r2 = Math.floor(y - r); r2 <= Math.floor(y + r); r2++) for (var c = Math.floor(x - r); c <= Math.floor(x + r); c++) {
        if (c < 0 || r2 < 0 || c >= S.W || r2 >= S.H) continue;
        if (Math.hypot(c + 0.5 - x, r2 + 0.5 - y) <= r) tileHit(c, r2, dmg);
      }
      emit('boom', { x: x, y: y, r: r, src: src });
    }
    function giveItem(it) {
      var h = S.hero;
      if (it.k === 'beacon') { if (!it.on) { S.items.forEach(function (o) { if (o.k === 'beacon') o.cur = false; }); it.on = true; addScore(PTS.beacon); emit('beacon', { x: it.x, y: it.y }); } if (!it.cur) { S.items.forEach(function (o) { if (o.k === 'beacon') o.cur = false; }); it.cur = true; } S.cp = { x: it.x, y: Math.round(it.y + 0.9) }; return; }
      it.got = true;
      if (it.k === 'gem') { addScore(PTS.gem); S.gems++; }
      else if (it.k === 'hp') h.hp = Math.min(HPMAX, h.hp + 4);
      else if (it.k === 'thunder') S.thunder = Math.min(THUNDER_MAX, S.thunder + 1);
      else if (it.k === 'life') S.lives++;
      else if (it.k === 'charge') h.charge = CHARGE;
      else if (it.k === 'cap') {
        if (S.weapon.k === it.w) S.weapon.lv = Math.min(3, S.weapon.lv + 1); else S.weapon.k = it.w;
        emit('weapon', { k: S.weapon.k, lv: S.weapon.lv });
      }
      emit('pickup', { k: it.k, w: it.w, x: it.x, y: it.y });
    }
    function closeGates(on) { S.lv.gates.forEach(function (q) { S.t[q] = on ? G : E; }); }
    function startBoss() {
      var lv = S.lv, bk = lv.bossKey, D = BOSSES[bk];
      S.bossActive = true; closeGates(true);
      S.boss = { key: bk, x: lv.bossPos.x, y: lv.bossPos.y, hw: D.hw, hh: D.hh, hp: D.hp, max: D.hp, dmg: D.dmg, phase: 0, shift: 0, intro: 1.6, t: 0,
        cd: 1.2, cd2: 3, cd3: 2, vx: 0, vy: 0, dir: -1, ground: true, dead: false, deadT: 0, flash: 0, mode: 'roll', spin: 0, warn: 0 };
      S.boss.x0 = lv.rooms[lv.bossRoom].x0; S.boss.y0 = lv.rooms[lv.bossRoom].y0;
      S.eb = []; emit('bossIntro', { key: bk });
    }
    function ebullet(x, y, ang, v, o) { var b = { x: x, y: y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: 0.28, dmg: 2, g: 0, life: 6 }; if (o) for (var k in o) b[k] = o[k]; S.eb.push(b); return b; }
    function aimAt(x, y) { var h = S.hero; return Math.atan2(h.y - 1 - y, h.x - x); }

    // ---------- Боссы ----------
    function updBoss(dt) {
      var b = S.boss, h = S.hero, ax0 = b.x0 + 1, ax1 = b.x0 + RW, floor = b.y0 + RH, sp = 1 + 0.25 * b.phase;
      b.t += dt; if (b.flash > 0) b.flash -= dt;
      if (b.dead) { b.deadT -= dt; if (b.deadT <= 0 && !S.portal) { S.portal = { x: S.lv.portal.x, y: S.lv.portal.y }; S.bossActive = false; S.bossDone = true; emit('portal', S.portal); } return; }
      if (b.intro > 0) { b.intro -= dt; return; }
      if (b.shift > 0) { b.shift -= dt; return; }
      b.cd -= dt; b.cd2 -= dt; b.cd3 -= dt;
      if (b.key === 'anvil') {
        // «Наковальня»: шагает к герою, веер болтов; с 2-й фазы — прыжок-удар с волнами по полу
        if (b.ground) {
          b.vx = sgn(h.x - b.x) * (1.6 + 0.9 * b.phase);
          if (Math.abs(h.x - b.x) < 1) b.vx = 0;
          if (b.phase >= 1 && b.cd2 <= 0) { b.vy = -17; b.ground = false; b.cd2 = 4.2 - 0.8 * b.phase; b.warn = 0; }
        } else b.vy += GRAV * 0.8 * dt;
        b.x = clamp(b.x + b.vx * dt, ax0 + b.hw, ax1 - b.hw);
        if (!b.ground) { b.y += b.vy * dt; if (b.y >= floor - b.hh) { b.y = floor - b.hh; b.ground = true; b.vy = 0; S.waves.push({ x: b.x - b.hw, dir: -1, y: floor, v: 9, t: 2.5 }, { x: b.x + b.hw, dir: 1, y: floor, v: 9, t: 2.5 }); emit('stomp', { x: b.x, y: floor }); } }
        if (b.cd <= 0) { var n = b.phase >= 2 ? 5 : 3, a0 = aimAt(b.x, b.y - b.hh); for (var i = 0; i < n; i++) ebullet(b.x, b.y - b.hh, a0 + (i - (n - 1) / 2) * 0.2, 8 * sp); b.cd = 1.9 - 0.35 * b.phase; emit('eshot', { boss: true }); }
      } else if (b.key === 'millstone') {
        // «Жернов»: катится от стены к стене, перелетает дугой и сыплет искры; на приземлении — кольцо болтов
        if (b.mode === 'roll') {
          b.vx = b.dir * (5 + 1.5 * b.phase); b.x += b.vx * dt; b.spin += b.vx * dt / b.hw;
          if ((b.dir < 0 && b.x <= ax0 + b.hw) || (b.dir > 0 && b.x >= ax1 - b.hw)) { b.x = clamp(b.x, ax0 + b.hw, ax1 - b.hw); b.mode = 'wait'; b.cd2 = 0.6; }
        } else if (b.mode === 'wait') { if (b.cd2 <= 0) { b.mode = 'air'; b.vy = -22; b.dir = -b.dir; b.vx = b.dir * ((ax1 - ax0 - 2 * b.hw) / (2 * 22 / (GRAV * 0.8))); b.cd3 = 0.25; } }
        else if (b.mode === 'air') {
          b.vy += GRAV * 0.8 * dt; b.x = clamp(b.x + b.vx * dt, ax0 + b.hw, ax1 - b.hw); b.y += b.vy * dt; b.spin += b.vx * dt / b.hw;
          if (b.cd3 <= 0) { ebullet(b.x, b.y + b.hh, Math.PI / 2, 4, { g: 20 }); b.cd3 = 0.4 - 0.06 * b.phase; }
          if (b.y >= floor - b.hh && b.vy > 0) {
            b.y = floor - b.hh; b.vy = 0; b.mode = 'pause'; b.cd2 = 0.9 - 0.2 * b.phase; emit('stomp', { x: b.x, y: floor });
            if (b.phase >= 1) { var nr = b.phase >= 2 ? 9 : 6; for (var j = 0; j < nr; j++) ebullet(b.x, b.y, Math.PI + j * Math.PI / (nr - 1), 6); }
          }
        }
        if (b.mode === 'pause' && b.cd2 <= 0) { b.mode = 'roll'; b.dir = b.x < (ax0 + ax1) / 2 ? 1 : -1; }
        if (b.cd <= 0 && b.mode === 'roll') { ebullet(b.x, b.y - b.hh, aimAt(b.x, b.y - b.hh), 7.5 * sp); b.cd = 2.2 - 0.4 * b.phase; emit('eshot', { boss: true }); }
      } else if (b.key === 'kite') {
        // «Флюгер»: летает восьмёркой, очереди по три; с 2-й фазы — бомбы, с 3-й — зовёт летунов
        var cx = b.x0 + 16.5, tt = b.t * (0.55 + 0.1 * b.phase);
        b.x = cx + 11 * Math.sin(tt); b.y = b.y0 + 6 + 2.5 * Math.sin(tt * 2);
        if (b.cd <= 0) { var a1 = aimAt(b.x, b.y); for (var q = 0; q < 3; q++) ebullet(b.x, b.y + 0.5, a1 + (q - 1) * 0.12, 8.5 * sp); b.cd = 2 - 0.4 * b.phase; emit('eshot', { boss: true }); }
        if (b.phase >= 1 && b.cd2 <= 0) { ebullet(b.x, b.y + b.hh, Math.PI / 2, 2, { g: 18, r: 0.4, bomb: true }); b.cd2 = 1.3 - 0.2 * b.phase; }
        if (b.phase >= 2 && b.cd3 <= 0) {
          var alive = S.enemies.filter(function (e) { return !e.dead && e.type === 'flyer' && e.boss; }).length;
          if (alive < 3) { var f = FOES.flyer; S.enemies.push({ type: 'flyer', x: b.x, y: b.y + 1, hw: f.hw, hh: f.hh, hp: f.hp, max: f.hp, dir: 1, vx: 0, vy: 0, cd: 0, warn: false, flash: 0, dead: false, mount: null, ph: rng() * 6, room: S.lv.bossRoom, boss: true }); emit('summon', {}); }
          b.cd3 = 4;
        }
      } else {
        // «Грозовой горн»: неподвижное ядро, спирали разрядов; с 2-й фазы — прицельные залпы, с 3-й — удары молний по меткам
        b.spin += dt * (2.2 + 0.4 * b.phase);
        if (b.cd3 <= 0) { var arms = 2 + b.phase; for (var k = 0; k < arms; k++) ebullet(b.x, b.y, b.spin + k * Math.PI * 2 / arms, 4.6 + 0.4 * b.phase, { r: 0.24, dmg: 1 }); b.cd3 = 0.28 - 0.04 * b.phase; }
        if (b.phase >= 1 && b.cd <= 0) { var a2 = aimAt(b.x, b.y); for (var q2 = 0; q2 < 3; q2++) ebullet(b.x, b.y, a2 + (q2 - 1) * 0.15, 7.5); b.cd = 2.6 - 0.4 * b.phase; emit('eshot', { boss: true }); }
        if (b.phase >= 2 && b.cd2 <= 0) { S.marks.push({ x: h.x, t: 0, warn: 1.1, strike: 0.25, y0: b.y0 + 1, y1: floor }); b.cd2 = 2.6; emit('markWarn', {}); }
      }
      // касание
      if (heroOverlap(b.x, b.y + b.hh, b.hw - 0.1, 0) && h.y > b.y - b.hh) hurt(b.dmg, 'boss');
    }

    // ---------- Враги ----------
    function updEnemies(dt) {
      var h = S.hero, w = S, hc = h.y - bodyH(h) / 2;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.dead) continue;
        if (Math.abs(e.x - h.x) > ACTIVE_X || Math.abs(e.y - h.y) > ACTIVE_Y) continue;
        if (e.flash > 0) e.flash -= dt;
        e.ph += dt;
        if (e.type === 'crawler') {
          e.vy = Math.min(VMAX, e.vy + GRAV * dt);
          var ox = e.x, hit = move(w, e, e.hw, e.hh, e.dir * FOES.crawler.v * dt, e.vy * dt);
          if (hit & 12) e.vy = 0;
          var gr = !boxFree(w, e.x, e.y + 0.03, e.hw, e.hh);
          if ((hit & 1) || (gr && !solid(w, Math.floor(e.x + e.dir * (e.hw + 0.05)), Math.floor(e.y + 0.5)))) { e.dir = -e.dir; if (!(hit & 1)) e.x = ox; }
        } else if (e.type === 'hopper') {
          e.vy = Math.min(VMAX, e.vy + GRAV * dt);
          var hh2 = move(w, e, e.hw, e.hh, e.vx * dt, e.vy * dt);
          if (hh2 & 12) e.vy = 0;
          if (hh2 & 1) e.vx = -e.vx * 0.5;
          e.ground = e.vy >= 0 && !boxFree(w, e.x, e.y + 0.03, e.hw, e.hh);
          if (e.ground) { e.vx = 0; e.cd -= dt; if (e.cd <= 0 && Math.abs(h.x - e.x) < 11 && Math.abs(h.y - e.y) < 8) { e.vy = -15; e.vx = sgn(h.x - e.x) * 4.5; e.ground = false; e.cd = 1.3 + rng() * 0.6; emit('hop', {}); } }
        } else if (e.type === 'flyer') {
          var tx = h.x - e.x, ty = hc - (e.y - e.hh / 2), d = Math.hypot(tx, ty) || 1, v = FOES.flyer.v + 0.25 * (S.level - 1);
          if (d < 16) move(w, e, e.hw, e.hh, (tx / d * v) * dt, (ty / d * v + Math.sin(e.ph * 3) * 2.2) * dt);
          else move(w, e, e.hw, e.hh, 0, Math.sin(e.ph * 2) * dt);
          e.dir = tx > 0 ? 1 : -1;
        } else if (e.type === 'turret') {
          var ex = e.x, ey = e.mount === 'ceil' ? e.y - 0.2 : e.y - e.hh + 0.1, dist = Math.hypot(h.x - ex, hc - ey);
          if (dist < 13 && los(w, ex, ey + (e.mount === 'ceil' ? 0.3 : -0.3), h.x, hc)) {
            e.cd -= dt; e.warn = e.cd < 0.45;
            if (e.cd <= 0) { ebullet(ex, ey, Math.atan2(hc - ey, h.x - ex), 7 + S.level, { dmg: 2 }); e.cd = 2.4 - 0.2 * S.level; e.warn = false; emit('eshot', { x: ex, y: ey }); }
          } else { e.warn = false; e.cd = Math.max(e.cd, 0.8); }
          e.dir = h.x > e.x ? 1 : -1;
        }
        // касание
        if (S.phase === 'play' && Math.abs(e.x - h.x) < e.hw + HW - 0.1 && e.y - e.hh < h.y - 0.1 && e.y > h.y - bodyH(h) + 0.1) {
          if (h.form === 'wheel') hitEnemy(e, 4 * dt, 'wheel');
          else hurt(FOES[e.type].dmg, e.type);
        }
      }
    }

    // ---------- Основной шаг ----------
    api.update = function (dt) {
      S.time += dt;
      if (S.flash > 0) S.flash -= dt;
      if (S.banner > 0) S.banner -= dt;
      for (var bi = 0; bi < S.booms.length; bi++) S.booms[bi].t -= dt;
      S.booms = S.booms.filter(function (o) { return o.t > 0; });
      if (S.phase === 'over' || S.phase === 'won') return;
      if (S.phase === 'clear') {
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.level >= S.maxLevel) { S.phase = 'won'; S.won = true; emit('win', { score: S.score }); }
          else { var keep = { hp: S.hero.hp, charge: S.hero.charge }; loadLevel(S.level + 1); S.hero.hp = Math.max(keep.hp, HPMAX * 0.6); }
        }
        return;
      }
      if (S.phase === 'cont') { S.phaseT -= dt; if (S.phaseT <= 0) { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); } return; }
      var h = S.hero;
      if (S.phase === 'dead') {
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.lives > 0) respawn();
          else if (S.conts > 0) { S.phase = 'cont'; S.phaseT = CONT_T; emit('cont', { conts: S.conts }); }
          else { S.phase = 'over'; S.over = true; emit('gameover', { score: S.score }); }
        }
      } else {
        // таймер уровня
        if (!S.bossDone) {
          var lt = S.ltime; S.ltime -= dt;
          if (lt > 30 && S.ltime <= 30) emit('timeLow', {});
          if (S.ltime <= 0) { S.ltime = 0; die('time'); }
        }
      }
      if (S.phase === 'play') {
        if (h.inv > 0) h.inv -= dt;
        if (h.shotT > 0) h.shotT -= dt;
        // форма-колесо: заряд
        if (h.form === 'wheel') { h.charge = Math.max(0, h.charge - dt); if (h.charge <= 0 && setForm(S, h, 'man')) emit('wheel', { on: false }); }
        else h.charge = Math.min(CHARGE, h.charge + CH_REGEN * dt);
        // луч-кнут: удержание, герой стоит, луч поворачивается к выбранному из 8 направлений
        var wantBeam = inp.beam && h.form === 'man';
        if (wantBeam && !h.beam.on) { h.beam.on = true; h.beam.ang = h.face > 0 ? 0 : Math.PI; emit('beam', { on: true }); }
        if (!wantBeam && h.beam.on) { h.beam.on = false; emit('beam', { on: false }); }
        var ev = heroPhys(S, h, inp, dt);
        if (ev & 1) emit('jump', {});
        if (ev & 2) emit('land', {});
        if (h.y > S.H + 1) die('fall');
        if (h.beam.on) updBeam(h, dt);
        // огонь: основное оружие / мины в форме колеса
        h.fireCd -= dt; h.mineCd -= dt;
        if (inp.fire) {
          if (h.form === 'wheel') {
            if (h.mineCd <= 0 && h.charge >= MINE_COST && S.mines.length < MINES_MAX) { h.charge -= MINE_COST; h.mineCd = 0.35; S.mines.push({ x: h.x, y: h.y - 0.3, vy: 0, t: 0 }); emit('mine', {}); }
          } else if (!h.beam.on && h.fireCd <= 0) shoot(h);
        } else if (!h.beam.on) h.aim = aimDir(h);
      }
      updBullets(dt); updMines(dt); updEnemies(dt); updEB(dt);
      if (S.boss) updBoss(dt);
      updWaves(dt);
      if (S.phase === 'play') updItems(dt);
      if (S.phase === 'play') triggers();
      updCam(dt);
      S.enemies = S.enemies.filter(function (e) { return !e.dead || false; });
    };
    function updBeam(h, dt) {
      var bm = h.beam, dx = inp.dx, dy = inp.dy;
      if (dx || dy) {
        var tgt = Math.atan2(dy, dx), d = tgt - bm.ang;
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        var st = BEAM_ROT * dt; bm.ang += Math.abs(d) <= st ? d : sgn(d) * st;
        if (dx) h.face = dx > 0 ? 1 : -1;
      }
      var ox = h.x + Math.cos(bm.ang) * 0.3, oy = h.y - 1.05, cx = Math.cos(bm.ang), cy = Math.sin(bm.ang), len = 0;
      while (len < BEAM_LEN) {
        var nx = ox + cx * (len + 0.2), ny = oy + cy * (len + 0.2), c = Math.floor(nx), r = Math.floor(ny);
        if (solid(S, c, r)) { if (S.phase === 'play') tileHit(c, r, BEAM_DPS * dt); break; }
        len += 0.2;
      }
      bm.len = len; bm.ox = ox; bm.oy = oy; bm.ex = ox + cx * len; bm.ey = oy + cy * len;
      function segD(px, py) { var t = clamp(((px - ox) * cx + (py - oy) * cy), 0, len); return Math.hypot(ox + cx * t - px, oy + cy * t - py); }
      S.enemies.forEach(function (e) { if (!e.dead && segD(e.x, e.y - e.hh / 2) < Math.max(e.hw, e.hh / 2) + 0.35) hitEnemy(e, BEAM_DPS * dt, 'beam'); });
      if (S.boss && S.bossActive && !S.boss.dead && segD(S.boss.x, S.boss.y) < Math.min(S.boss.hw, S.boss.hh) + 0.5) hitBoss(BEAM_DPS * dt, 'beam');
      S.eb = S.eb.filter(function (b) { if (segD(b.x, b.y) < b.r + 0.3) { b.dead = true; return false; } return true; });
      S.items.forEach(function (it) { if (!it.got && it.k !== 'beacon' && segD(it.x, it.y) < 0.8) it.pull = true; });
    }
    function updBullets(dt) {
      var out = [];
      for (var i = 0; i < S.bullets.length; i++) {
        var b = S.bullets[i], dead = false; b.life -= dt;
        var px = b.x, py = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
        var c = Math.floor(b.x), r = Math.floor(b.y);
        if (solid(S, c, r)) {
          tileHit(c, r, b.dmg);
          if (b.k === 'B' && b.bounces > 0) {
            b.bounces--;
            if (solid(S, Math.floor(px), r)) b.vy = -b.vy; else if (solid(S, c, Math.floor(py))) b.vx = -b.vx; else { b.vx = -b.vx; b.vy = -b.vy; }
            b.x = px; b.y = py; emit('bounce', {});
          } else { dead = true; emit('wall', { x: px, y: py }); }
        }
        if (!dead) {
          for (var j = 0; j < S.enemies.length && !dead; j++) {
            var e = S.enemies[j]; if (e.dead || !eBox(e, b.x, b.y, 0.15)) continue;
            if (b.hit) { if (b.hit.indexOf(e) >= 0) continue; b.hit.push(e); hitEnemy(e, b.dmg, 'shot'); }
            else { hitEnemy(e, b.dmg, 'shot'); dead = true; }
          }
          if (!dead && S.boss && S.bossActive && !S.boss.dead && bossBox(S.boss, b.x, b.y, 0.1)) {
            if (b.hit) { if (b.hit.indexOf(S.boss) < 0) { b.hit.push(S.boss); hitBoss(b.dmg, 'shot'); } }
            else { hitBoss(b.dmg, 'shot'); dead = true; }
          }
        }
        if (b.life <= 0) dead = true;
        if (!dead) out.push(b);
      }
      S.bullets = out;
    }
    function updMines(dt) {
      var out = [];
      for (var i = 0; i < S.mines.length; i++) {
        var m = S.mines[i]; m.t += dt; m.vy = Math.min(VMAX, m.vy + GRAV * dt);
        var hit = move(S, m, 0.25, 0.4, 0, m.vy * dt); if (hit & 12) m.vy = 0;
        var trig = m.t > MINE_T;
        if (!trig && m.t > 0.25) {
          for (var j = 0; j < S.enemies.length; j++) { var e = S.enemies[j]; if (!e.dead && Math.hypot(e.x - m.x, e.y - e.hh / 2 - m.y) < 1.1 + e.hw) { trig = true; break; } }
          if (S.boss && S.bossActive && !S.boss.dead && bossBox(S.boss, m.x, m.y - 0.2, 0.8)) trig = true;
        }
        if (trig) boom(m.x, m.y - 0.2, MINE_R, MINE_DMG, 'mine'); else out.push(m);
      }
      S.mines = out;
    }
    function updEB(dt) {
      var h = S.hero, out = [];
      for (var i = 0; i < S.eb.length; i++) {
        var b = S.eb[i]; b.life -= dt; b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.life <= 0 || solid(S, Math.floor(b.x), Math.floor(b.y))) { if (b.bomb) S.booms.push({ x: b.x, y: b.y, r: 1, t: 0.25 }); continue; }
        if (S.phase === 'play' && heroOverlap(b.x, b.y, b.r - 0.05, b.r - 0.05)) {
          if (h.form === 'wheel') { emit('deflect', { x: b.x, y: b.y }); continue; }
          if (h.inv <= 0) { hurt(b.dmg, 'bolt'); continue; }
        }
        out.push(b);
      }
      S.eb = out;
    }
    function updWaves(dt) {
      var h = S.hero;
      S.waves = S.waves.filter(function (wv) {
        wv.t -= dt; wv.x += wv.dir * wv.v * dt;
        if (S.phase === 'play' && Math.abs(wv.x - h.x) < 0.5 + HW && h.y > wv.y - 0.9) hurt(3, 'wave');
        return wv.t > 0 && !solid(S, Math.floor(wv.x), Math.floor(wv.y - 0.5));
      });
      S.marks = S.marks.filter(function (mk) {
        mk.t += dt;
        if (mk.t > mk.warn && mk.t < mk.warn + mk.strike && S.phase === 'play' && Math.abs(h.x - mk.x) < 0.8) hurt(3, 'strike');
        if (!mk.hit && mk.t > mk.warn) { mk.hit = true; emit('strike', { x: mk.x }); }
        return mk.t < mk.warn + mk.strike;
      });
    }
    function updItems(dt) {
      var h = S.hero, hh = bodyH(h);
      for (var i = 0; i < S.items.length; i++) {
        var it = S.items[i]; if (it.got) continue;
        if (it.drop && it.vy != null) { it.vy = Math.min(10, it.vy + 30 * dt); var ny = it.y + it.vy * dt; if (!solid(S, Math.floor(it.x), Math.floor(ny + 0.35))) it.y = ny; else { it.vy = 0; it.y = Math.floor(ny + 0.35) - 0.36; } }
        if (it.pull) { var dx = h.x - it.x, dy = h.y - 1 - it.y, d = Math.hypot(dx, dy) || 1; it.x += dx / d * Math.min(d, 12 * dt); it.y += dy / d * Math.min(d, 12 * dt); it.vy = null; }
        var rr = it.k === 'beacon' ? 0.6 : 0.45;
        if (Math.abs(it.x - h.x) < HW + rr && it.y > h.y - hh - rr && it.y < h.y + rr) giveItem(it);
      }
      S.items = S.items.filter(function (it) { return !it.got; });
    }
    function triggers() {
      var h = S.hero, rm = room(h.x, h.y - 0.5);
      if (!S.visited[rm.i]) { S.visited[rm.i] = 1; if (rm.kind === 's') { S.secrets++; addScore(PTS.secret); emit('secret', { x: h.x, y: h.y }); } }
      if (rm.i === S.lv.bossRoom && !S.bossActive && !S.bossDone && h.x > rm.x0 + 1.6 && h.x < rm.x0 + RW - 0.6 && h.y > rm.y0 + 3) startBoss();
      if (S.portal && Math.abs(h.x - S.portal.x) < 1 && h.y > S.portal.y - 2.4 && h.y <= S.portal.y + 0.1) {
        var bonus = Math.round(S.ltime) * PTS.timeBonus + 1000 * S.level;
        addScore(bonus); S.phase = 'clear'; S.phaseT = 3; S.portal = null; S.lastBonus = bonus;
        emit('clear', { level: S.level, bonus: bonus });
      }
    }
    function updCam(dt) {
      var h = S.hero, tx, ty;
      if (S.bossActive || (S.boss && !S.bossDone)) { var r = S.lv.rooms[S.lv.bossRoom]; tx = r.x0 + RW / 2 + 0.5 - VIEW_W / 2; ty = r.y0 + RH / 2 + 0.5 - VIEW_H / 2; }
      else { tx = h.x - VIEW_W / 2 + h.face * 3; ty = h.y - VIEW_H * 0.58; }
      tx = clamp(tx, 0, S.W - VIEW_W); ty = clamp(ty, 0, S.H - VIEW_H);
      var k = Math.min(1, dt * 6);
      S.cam.x += (tx - S.cam.x) * k; S.cam.y += (ty - S.cam.y) * k;
    }

    // ---------- API ----------
    api.start = function () { loadLevel(opts.level || 1); if (opts.level > 1) S.weapon.lv = 2; return api; };
    api.setInput = function (o) { inp.dx = o.dx | 0; inp.dy = o.dy | 0; inp.jump = !!o.jump; inp.fire = !!o.fire; inp.beam = !!o.beam; };
    api.wheel = function () {
      var h = S.hero; if (S.phase !== 'play') return false;
      var ok = setForm(S, h, h.form === 'wheel' ? 'man' : 'wheel');
      emit(ok ? 'wheel' : 'noWheel', { on: h.form === 'wheel' }); return ok;
    };
    api.setForm = function (f) { var h = S.hero; if (S.phase !== 'play' || h.form === f) return h.form === f; var ok = setForm(S, h, f); if (ok) emit('wheel', { on: h.form === 'wheel' }); return ok; };
    api.thunder = thunder;
    // продолжение: уровень заново с начала (босс — с полным здоровьем), счёт делится пополам
    api.cont = function () { if (S.phase !== 'cont') return false; S.conts--; S.lives = LIVES; S.score = Math.floor(S.score / 2); S.nextLife = (Math.floor(S.score / EXTRA_LIFE) + 1) * EXTRA_LIFE; loadLevel(S.level); S.hero.inv = SPAWN_INV; S.thunder = Math.max(S.thunder, THUNDER0); emit('continue', {}); return true; };
    api.state = function () { return S; };
    // для тестов
    api._place = function (x, y) { S.hero.x = x; S.hero.y = y; S.hero.vy = 0; S.hero.ground = true; };
    api._hurt = hurt; api._boom = boom; api._startBoss = startBoss; api._hitBoss = hitBoss; api._load = loadLevel; api._tileHit = tileHit;
    api._spawn = function (type, x, y, o) { var f = FOES[type], e = { type: type, x: x, y: y, hw: f.hw, hh: f.hh, hp: f.hp, max: f.hp, dir: -1, vx: 0, vy: 0, cd: 1, warn: false, flash: 0, dead: false, mount: null, ph: 0, room: 0 }; if (o) for (var k in o) e[k] = o[k]; S.enemies.push(e); return e; };
    return api;
  }

  GR.Game = Game;
  GR.logic = {
    T: T, HUD: HUD, VIEW_W: VIEW_W, VIEW_H: VIEW_H, RW: RW, RH: RH, E: E, R: R, P: P, K: K, B: B, G: G,
    GRAV: GRAV, JUMP_V: JUMP_V, RUN: RUN, HW: HW, HH: HH, WH: WH, WHEEL_V: WHEEL_V, HPMAX: HPMAX, LIVES: LIVES, CONTS: CONTS,
    CHARGE: CHARGE, CH_MIN: CH_MIN, MINE_COST: MINE_COST, THUNDER0: THUNDER0, THUNDER_MAX: THUNDER_MAX, BEAM_LEN: BEAM_LEN, BEAM_DPS: BEAM_DPS,
    PTS: PTS, WEAP: WEAP, FOES: FOES, BOSSES: BOSSES, LEVELS: LEVELS, PHASES: PHASES, BOSS_HEAL: BOSS_HEAL, EXTRA_LIFE: EXTRA_LIFE,
    mulberry32: mulberry32, buildLevel: buildLevel, level: level, solid: solid, boxFree: boxFree, move: move, heroPhys: heroPhys,
    newHero: newHero, setForm: setForm, los: los, ACTS: ACTS, ROLL0: ROLL0, Macro: Macro, simulate: simulate, nodeOf: nodeOf, isNode: isNode, Nav: Nav
  };
})(typeof window !== 'undefined' ? window : globalThis);
