/* СОСЕДИ · уровни: детерминированный генератор карт (без DOM).
   20 уровней = 5 районов × 4 (4-й в районе — босс) + 5 бонус-уровней «Карусельная поляна» (по золотому билету).
   Карта 48×32 клетки по 16 px. Клетки: G трава/пол, W стена/забор, H кусты/прилавки/ящики (не пройти, вода не летит),
   P пруд/лужа (не пройти, выстрелы летят), D запертая дверь (ключ), C трещина (фейерверк ломает → тайная комната),
   F пол в доме, O открытая дверь, R дорога/дорожка. Каждый уровень проверяется на связность при сборке,
   а тесты ещё раз проходят A* с ключами и дверями до каждого соседа и выхода. */
(function (global) {
  'use strict';
  var SO = global.SOSEDI = global.SOSEDI || {};
  var T = { G: 0, W: 1, H: 2, P: 3, D: 4, C: 5, F: 6, O: 7, R: 8 };
  var MW = 48, MH = 32, TS = 16, COUNT = 20;
  var WALK = [1, 0, 0, 0, 0, 0, 1, 1, 1];          // по коду клетки: можно ли пройти
  var STYLES = ['yard', 'street', 'market', 'fair', 'cellar'];
  var BOSSES = ['bear', 'stilts', 'organ', 'strong', 'puppeteer'];
  var NTYPES = ['granny', 'postman', 'twins', 'fisher', 'teacher', 'fireman', 'baker', 'gardener'];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }

  function Map0() { var t = new Uint8Array(MW * MH); for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) t[y * MW + x] = (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) ? T.W : T.G; return t; }
  function inb(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH; }
  // BFS по проходимым клеткам; through — дополнительно проходимые коды (двери, трещины)
  function bfs(t, sx, sy, through) {
    var d = new Int16Array(MW * MH).fill(-1), q = [sy * MW + sx]; d[q[0]] = 0;
    for (var h = 0; h < q.length; h++) {
      var k = q[h], x = k % MW, y = (k / MW) | 0;
      for (var i = 0; i < 4; i++) {
        var nx = x + [1, -1, 0, 0][i], ny = y + [0, 0, 1, -1][i]; if (!inb(nx, ny)) continue;
        var nk = ny * MW + nx, c = t[nk]; if (d[nk] >= 0) continue;
        if (WALK[c] || (through && through.indexOf(c) >= 0)) { d[nk] = d[k] + 1; q.push(nk); }
      }
    }
    return d;
  }
  function openCount(t) { var n = 0; for (var i = 0; i < t.length; i++) if (WALK[t[i]] || t[i] === T.D || t[i] === T.C) n++; return n; }
  function connected(t, s) { var d = bfs(t, s.x, s.y, [T.D, T.C]), n = 0; for (var i = 0; i < d.length; i++) if (d[i] >= 0) n++; return n === openCount(t); }

  function overlaps(rs, x, y, w, h, m) { for (var i = 0; i < rs.length; i++) { var r = rs[i]; if (x - m < r.x + r.w && x + w + m > r.x && y - m < r.y + r.h && y + h + m > r.y) return true; } return false; }

  // дом/шатёр/кладовка: стены по контуру, пол внутри, дверь на стороне к центру карты
  function house(t, r, b, locked, cx, cy) {
    for (var y = b.y; y < b.y + b.h; y++) for (var x = b.x; x < b.x + b.w; x++) t[y * MW + x] = (x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1) ? T.W : T.F;
    var mx = b.x + b.w / 2, my = b.y + b.h / 2, dx = cx - mx, dy = cy - my, d;
    if (Math.abs(dx) * (MH / MW) > Math.abs(dy)) d = { x: dx > 0 ? b.x + b.w - 1 : b.x, y: b.y + ri(r, 2, b.h - 3) };
    else d = { x: b.x + ri(r, 2, b.w - 3), y: dy > 0 ? b.y + b.h - 1 : b.y };
    t[d.y * MW + d.x] = locked ? T.D : T.O;
    b.door = d; b.locked = locked; return b;
  }

  function build(n) {
    n = Math.max(1, Math.min(COUNT, n | 0));
    var r = mulberry32(n * 7919 + 13), d = Math.ceil(n / 4), i = (n - 1) % 4 + 1, style = STYLES[d - 1], boss = i === 4;
    var t = Map0(), rects = [], start = { x: 24, y: 16 };
    var L = { n: n, d: d, i: i, kind: boss ? 'boss' : 'normal', style: style, w: MW, h: MH, t: t, start: start, houses: [], doors: [], keys: [],
      neighbors: [], spawners: [], pickups: [], toys: [], secret: null, boss: boss ? BOSSES[d - 1] : null, exit: null };
    rects.push({ x: start.x - 4, y: start.y - 3, w: 9, h: 7 });          // пятачок старта
    // дорога (улица) / дорожки (двор) — проходимые, только для вида
    if (style === 'street') for (var x = 1; x < MW - 1; x++) { t[15 * MW + x] = T.R; t[16 * MW + x] = T.R; t[17 * MW + x] = T.R; }
    if (style === 'yard' || style === 'fair') { for (var y = 1; y < MH - 1; y++) t[y * MW + 24] = T.R; for (x = 1; x < MW - 1; x++) t[16 * MW + x] = T.R; }
    if (style === 'street') rects.push({ x: 1, y: 15, w: MW - 2, h: 3 });
    // дома
    var nh = boss ? 2 : ({ yard: 4, street: 5, market: 3, fair: 4, cellar: 6 })[style] + (i >= 3 ? 1 : 0), locked = boss ? 0 : Math.min(nh - 1, 1 + ((n + 1) >> 2));
    for (var tries = 0; tries < 400 && L.houses.length < nh; tries++) {
      var w = style === 'cellar' ? ri(r, 6, 8) : ri(r, 7, 10), h = style === 'cellar' ? ri(r, 5, 7) : ri(r, 6, 7);
      var bx = ri(r, 2, MW - w - 2), by = ri(r, 2, MH - h - 2);
      if (overlaps(rects, bx, by, w, h, 2)) continue;
      var b = house(t, r, { x: bx, y: by, w: w, h: h }, L.houses.length < locked, start.x, start.y);
      rects.push(b); L.houses.push(b); if (b.locked) L.doors.push({ x: b.door.x, y: b.door.y });
    }
    // тайная комната с трещиной (фейерверк): каждый 2-й обычный уровень, с 2-го
    if (!boss && n % 2 === 0) {
      for (tries = 0; tries < 300; tries++) {
        bx = ri(r, 2, MW - 7); by = ri(r, 2, MH - 7);
        if (overlaps(rects, bx, by, 5, 5, 2)) continue;
        for (y = by; y < by + 5; y++) for (x = bx; x < bx + 5; x++) t[y * MW + x] = (x === bx || y === by || x === bx + 4 || y === by + 4) ? T.W : T.F;
        var cr = (by + 2 > start.y) ? { x: bx + 2, y: by } : { x: bx + 2, y: by + 4 };
        t[cr.y * MW + cr.x] = T.C;
        L.secret = { x: bx, y: by, crack: cr, in: { x: bx + 2, y: by + 2 } };
        rects.push({ x: bx, y: by, w: 5, h: 5 }); break;
      }
    }
    // препятствия по стилю (проверка связности после каждого)
    var nob = boss ? 6 : ({ yard: 26, street: 22, market: 16, fair: 22, cellar: 30 })[style];
    if (style === 'market' && !boss) {           // ряды прилавков
      for (var row = 4; row < MH - 3; row += 5) for (x = 3; x < MW - 4; x += ri(r, 9, 12)) {
        var len = ri(r, 4, 7), ok = true, saved = [];
        for (var k = 0; k < len; k++) { var c = row * MW + x + k; if (x + k >= MW - 2 || t[c] !== T.G || overlaps(rects, x + k, row, 1, 1, 1)) { ok = false; break; } }
        if (!ok) continue;
        for (k = 0; k < len; k++) { saved.push(t[row * MW + x + k]); t[row * MW + x + k] = T.H; }
        if (!connected(t, start)) for (k = 0; k < len; k++) t[row * MW + x + k] = saved[k];
      }
    }
    for (var o = 0; o < nob; o++) {
      var kind = r(), cells = [], ox = ri(r, 2, MW - 4), oy = ri(r, 2, MH - 4);
      var pond = style === 'cellar' ? kind < 0.25 : style === 'fair' ? kind < 0.3 : kind < 0.18;
      if (pond) { var pw = ri(r, 2, 4), ph = ri(r, 2, 3); for (y = 0; y < ph; y++) for (x = 0; x < pw; x++) cells.push([ox + x, oy + y, T.P]); }
      else if (kind < 0.6) { var vert = r() < 0.5, ln = ri(r, 2, 5); for (k = 0; k < ln; k++) cells.push([ox + (vert ? 0 : k), oy + (vert ? k : 0), style === 'cellar' && kind < 0.4 ? T.W : T.H]); }
      else { cells.push([ox, oy, T.H]); if (r() < 0.5) cells.push([ox + 1, oy, T.H]); }
      ok = true;
      for (k = 0; k < cells.length; k++) { var q = cells[k]; if (!inb(q[0], q[1]) || q[0] < 1 || q[1] < 1 || q[0] >= MW - 1 || q[1] >= MH - 1 || t[q[1] * MW + q[0]] !== T.G && t[q[1] * MW + q[0]] !== T.R || overlaps(rects, q[0], q[1], 1, 1, 1)) { ok = false; break; } }
      if (!ok) continue;
      saved = cells.map(function (q) { return t[q[1] * MW + q[0]]; });
      cells.forEach(function (q) { t[q[1] * MW + q[0]] = q[2]; });
      if (!connected(t, start)) cells.forEach(function (q, j) { t[q[1] * MW + q[0]] = saved[j]; });
    }
    // клетки: снаружи (без дверей), в домах, расстояния от старта
    var dOut = bfs(t, start.x, start.y, null), dAll = bfs(t, start.x, start.y, [T.D, T.C]);
    function inHouse(x, y) { for (var j = 0; j < L.houses.length; j++) { var b = L.houses[j]; if (x > b.x && y > b.y && x < b.x + b.w - 1 && y < b.y + b.h - 1) return b; } return null; }
    function inSecret(x, y) { var s = L.secret; return s && x > s.x && y > s.y && x < s.x + 4 && y < s.y + 4; }
    function free(x, y) { return WALK[t[y * MW + x]] && t[y * MW + x] !== T.O; }
    var outCells = [], used = [];
    for (y = 1; y < MH - 1; y++) for (x = 1; x < MW - 1; x++) if (dOut[y * MW + x] >= 0 && free(x, y) && !inHouse(x, y)) outCells.push({ x: x, y: y, d: dOut[y * MW + x] });
    function far(x, y, m) { for (var j = 0; j < used.length; j++) if (Math.abs(used[j].x - x) + Math.abs(used[j].y - y) < m) return false; return true; }
    function pick(list, minD, sep, pred) {
      for (var a = 0; a < 200; a++) { var c = list[Math.floor(r() * list.length)]; if (c && c.d >= minD && far(c.x, c.y, sep) && (!pred || pred(c))) { used.push(c); return c; } }
      for (a = 0; a < list.length; a++) { c = list[a]; if (c.d >= minD && far(c.x, c.y, 2)) { used.push(c); return c; } }
      return list[0];
    }
    // выход — самая дальняя клетка снаружи
    var ex = outCells.reduce(function (a, c) { return c.d > a.d ? c : a; }, outCells[0]); L.exit = { x: ex.x, y: ex.y }; used.push(ex);
    used.push({ x: start.x, y: start.y });
    // соседи: по одному в доме (сначала), остальные снаружи; число слотов растёт с уровнем
    var slots = boss ? 4 : Math.min(10, 6 + ((n - 1) >> 2));
    var order = L.houses.slice();
    order.forEach(function (b) {
      if (L.neighbors.length >= slots - 2) return;
      var cx = b.x + 1 + ri(r, 1, b.w - 4), cy = b.y + 1 + ri(r, 1, b.h - 4);
      if (!free(cx, cy)) { cx = b.x + 2; cy = b.y + 2; }
      used.push({ x: cx, y: cy }); L.neighbors.push({ x: cx, y: cy, inside: true, locked: b.locked });
    });
    while (L.neighbors.length < slots) { var c2 = pick(outCells, 6, 6); L.neighbors.push({ x: c2.x, y: c2.y, inside: false, locked: false }); }
    // перемешать порядок так, чтобы при малом запасе соседей были и в домах, и снаружи
    for (k = L.neighbors.length - 1; k > 0; k--) { var j2 = Math.floor(r() * (k + 1)), tmp = L.neighbors[k]; L.neighbors[k] = L.neighbors[j2]; L.neighbors[j2] = tmp; }
    L.neighbors.forEach(function (nb, j) { nb.type = NTYPES[(j + n) % NTYPES.length]; });
    // рыболов — к пруду, если есть
    var fish = null, best = 1e9;
    L.neighbors.forEach(function (nb) { for (var yy = nb.y - 2; yy <= nb.y + 2; yy++) for (var xx = nb.x - 2; xx <= nb.x + 2; xx++) if (inb(xx, yy) && t[yy * MW + xx] === T.P) { var dd = Math.abs(xx - nb.x) + Math.abs(yy - nb.y); if (dd < best) { best = dd; fish = nb; } } });
    if (fish) { var other = L.neighbors.filter(function (nb) { return nb.type === 'fisher'; })[0]; if (other && other !== fish) { other.type = fish.type; } fish.type = 'fisher'; }
    if (L.secret) L.neighbors.push({ x: L.secret.in.x, y: L.secret.in.y, inside: true, locked: false, secret: true, bonus: true, type: 'twins' });
    // ключи (по одному на запертую дверь) — снаружи
    L.doors.forEach(function () { var c3 = pick(outCells, 5, 5); L.keys.push({ x: c3.x, y: c3.y }); });
    // балаганные сундуки (рождают игрушки) — подальше от старта
    var nsp = boss ? 0 : Math.min(5, 2 + Math.floor(n / 5));
    for (k = 0; k < nsp; k++) { c2 = pick(outCells, 14, 9); L.spawners.push({ x: c2.x, y: c2.y }); }
    // стартовые игрушки
    var mix = MIXES[d - 1], nt = boss ? 2 : 2 + Math.floor(n / 3);
    for (k = 0; k < nt; k++) { c2 = pick(outCells, 12, 3); L.toys.push({ x: c2.x, y: c2.y, type: mixPick(mix, r()) }); }
    // подарки на земле: запасы оружия, предметы
    var ammo = ['paint', 'bubble', 'pie', 'fire', 'paint', 'bubble'];
    var na = boss ? 4 : 3 + (n % 2);
    for (k = 0; k < na; k++) { c2 = pick(outCells, 3, 4); L.pickups.push({ x: c2.x, y: c2.y, kind: ammo[(k + n) % ammo.length] }); }
    if (L.secret) { c2 = pick(outCells, 2, 3, function (c) { return c.d < 14; }); L.pickups.push({ x: c2.x, y: c2.y, kind: 'fire' }); L.pickups.push({ x: L.secret.in.x + 1, y: L.secret.in.y, kind: 'ticket' }); }
    c2 = pick(outCells, 6, 4); L.pickups.push({ x: c2.x, y: c2.y, kind: 'soda' });
    if (n % 3 === 0) { c2 = pick(outCells, 6, 4); L.pickups.push({ x: c2.x, y: c2.y, kind: 'shoes' }); }
    if (n % 3 === 2) { c2 = pick(outCells, 6, 4); L.pickups.push({ x: c2.x, y: c2.y, kind: 'umbrella' }); }
    if (n % 4 === 3 || boss) { c2 = pick(outCells, 8, 4); L.pickups.push({ x: c2.x, y: c2.y, kind: 'bag' }); }
    L.dAll = dAll;
    return L;
  }

  // бонус-уровень: открытая поляна, таймер, лишние соседи (каждый спасённый — +1 в запас)
  function buildBonus(d) {
    var r = mulberry32(d * 104729 + 3), t = Map0(), start = { x: 24, y: 16 };
    var L = { n: 0, d: d, i: 0, kind: 'bonus', style: STYLES[d - 1], w: MW, h: MH, t: t, start: start, houses: [], doors: [], keys: [], neighbors: [], spawners: [], pickups: [], toys: [], secret: null, boss: null, exit: null };
    for (var x = 1; x < MW - 1; x++) t[16 * MW + x] = T.R;
    for (var y = 1; y < MH - 1; y++) t[y * MW + 24] = T.R;
    for (var o = 0; o < 14; o++) { var ox = ri(r, 3, MW - 5), oy = ri(r, 3, MH - 5); if (Math.abs(ox - start.x) < 5 && Math.abs(oy - start.y) < 4) continue; if (t[oy * MW + ox] !== T.G) continue; t[oy * MW + ox] = T.H; if (!connected(t, start)) t[oy * MW + ox] = T.G; }
    var used = [{ x: start.x, y: start.y }];
    for (var k = 0; k < 8; k++) {
      for (var a = 0; a < 300; a++) {
        x = ri(r, 3, MW - 4); y = ri(r, 3, MH - 4);
        if (t[y * MW + x] !== T.G && t[y * MW + x] !== T.R) continue;
        if (used.some(function (u) { return Math.abs(u.x - x) + Math.abs(u.y - y) < 8; })) continue;
        used.push({ x: x, y: y }); L.neighbors.push({ x: x, y: y, inside: false, locked: false, bonus: true, type: NTYPES[(k + d) % NTYPES.length] }); break;
      }
    }
    var corners = [[3, 3], [MW - 4, 3], [3, MH - 4], [MW - 4, MH - 4]];
    corners.forEach(function (c) { L.toys.push({ x: c[0], y: c[1], type: 'goose' }); });
    L.dAll = bfs(t, start.x, start.y, [T.D, T.C]);
    return L;
  }

  // состав «Заводного Цирка» по районам: [тип, вес]
  var MIXES = [
    [['clown', 55], ['goose', 45]],
    [['clown', 40], ['goose', 30], ['mouse', 30]],
    [['clown', 35], ['goose', 20], ['mouse', 20], ['bear', 25]],
    [['clown', 30], ['goose', 15], ['mouse', 15], ['bear', 20], ['top', 20]],
    [['clown', 25], ['goose', 10], ['mouse', 15], ['bear', 15], ['top', 15], ['puppet', 20]]
  ];
  function mixPick(mix, u) { var s = 0, tot = 0; mix.forEach(function (m) { tot += m[1]; }); u *= tot; for (var i = 0; i < mix.length; i++) { s += mix[i][1]; if (u < s) return mix[i][0]; } return mix[0][0]; }

  SO.levels = { T: T, MW: MW, MH: MH, TS: TS, COUNT: COUNT, WALK: WALK, STYLES: STYLES, BOSSES: BOSSES, NTYPES: NTYPES, MIXES: MIXES,
    build: build, buildBonus: buildBonus, bfs: bfs, connected: connected, mixPick: mixPick, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
