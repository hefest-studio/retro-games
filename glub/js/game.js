/* ГЛУБЬ · логика игры (без DOM, детерминирована при заданном rng).
   Флип-скрин исследование: шахта Древнего Горна под мастерской «Гефест» — мир из 72 экранов (9×8).
   Водолаз-рудознатец в латунном скафандре ходит, прыгает, лазит по лестницам; механический крот «Бурик»
   прогрызает мягкую породу. 8 кристаллов-ключей открывают Печать — за ней Сердце Горна (победа).
   Мир фиксированный: макро-карта MAP (комнаты и связи) + детерминированная сборка экранов buildRoom().
   GLUB.Game(opts) → api; GLUB.logic — константы, мир, физика, граф проходимости (Nav) для тестов и бота. */
(function (global) {
  'use strict';
  var Gb = global.GLUB = global.GLUB || {};

  // ---------- Константы (единицы — клетки и секунды) ----------
  var COLS = 20, ROWS = 12, WX = 9, WY = 8, NK = COLS * ROWS;
  // клетки: пусто, скала, мягкая порода, лестница, шлак (жжёт), Печать (ворота), паровой клапан, балка (односторонняя)
  var E = 0, R = 1, SO = 2, LD = 3, SL = 4, GT = 5, VT = 6, PF = 7;
  var GRAV = 56, JUMP_V = 19.6, JUMP_CUT = 7, RUN = 5.4, CLIMB = 4.4, VMAX = 17, HW = 0.34, HH = 1.7, COYOTE = 0.08;
  var STUN_FALL = 6.5, STUN_T = 1.3, THUD_FALL = 4.2;            // падение ≥ 6.5 клетки — оглушение, не смерть
  var EMAX = 100, LIVES = 3, INV_T = 1.1, DEAD_T = 1.6, SPAWN_INV = 2.0, BEACON_CD = 10, TANK = 35;
  var MOLE_V = 9, MOLE_BACK = 12, MOLE_RANGE = 12, DIG_T = 0.45;
  var DMG = { moth: 10, crawler: 9, vent: 14, slag: 15 };
  var PTS = { crystal: 1000, nugget: 50, kill: 150, beacon: 200, heart: 5000 };
  var ZONES = ['adit', 'vein', 'grotto', 'forge', 'heart'];
  var CRYSTALS = 8;

  // ---------- Макро-карта мира ----------
  // Строки комнат (17 символов): комната на чётных позициях, связь вправо — на нечётных:
  //   '-' проход, '=' проход за мягкой породой (нужен крот), '&' Печать (открывается 8 кристаллами).
  // Строки связей вниз (9 символов, по столбцу): '|' лестница, ':' лестница под мягкой пробкой, 'v' провал (только вниз).
  // Комнаты: '.' обычная, 'S' старт (маяк), 'b' маяк, '1'..'8' кристалл, 'G' зал Печати, '+' преддверие, 'H' Сердце Горна.
  var MAP = [
    '.-.-1-.-S-.-.=.-.',
    '| v | | |',
    '.-.-.-b .-.-. .-2',
    ' | :|  v|',
    '.-.=.-. .-.-b-. .',
    '| | ||:||',
    '3-. .-.-.-. .-.-.',
    '|v |  |v|',
    '.-.-.=. b-.-.-4 .',
    '| |  :| |',
    '.-5 .-.-.-. .-.=6',
    ' |v |: ||',
    '7-.-.-b .-. .=.-.',
    '|  |v||  ',
    '.-.-. .=8-.-G&+-H'
  ];
  // Где лежит кристалл в своём экране: plat — на балке, high — на верхней балке, pocket — в нише за мягкой породой
  var CSPOT = { 1: 'plat', 2: 'high', 3: 'pocket', 4: 'high', 5: 'pocket', 6: 'plat', 7: 'pocket', 8: 'high' };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hsh(a, b, c) {
    var h = (Math.imul(a + 7, 374761393) ^ Math.imul(b + 13, 668265263) ^ Math.imul(c + 29, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function isSolid(k) { return k === R || k === SO || k === GT || k === SL || k === VT; }

  // ---------- Разбор карты ----------
  function parse() {
    var rooms = [], at = {};
    for (var y = 0; y < WY; y++) {
      var line = MAP[y * 2];
      if (line.length !== WX * 2 - 1) throw new Error('MAP: строка ' + y + ' — длина ' + line.length);
      for (var x = 0; x < WX; x++) {
        var ch = line.charAt(x * 2);
        if (ch === ' ' || ch === '#') continue;
        var rm = { i: rooms.length, x: x, y: y, kind: ch, c: { L: null, R: null, U: null, D: null } };
        rm.zone = ch === '+' || ch === 'H' ? 4 : y < 2 ? 0 : y < 4 ? 1 : y < 6 ? 2 : 3;
        rooms.push(rm); at[x + ',' + y] = rm;
      }
    }
    rooms.forEach(function (rm) {
      var hc = MAP[rm.y * 2].charAt(rm.x * 2 + 1), nb = at[(rm.x + 1) + ',' + rm.y];
      if (nb && hc && hc !== ' ') {
        var k = { '-': 'open', '=': 'soft', '&': 'gate' }[hc];
        if (!k) throw new Error('MAP: связь «' + hc + '»');
        var h = 8 + Math.floor(hsh(rm.x, rm.y, 1) * 3);
        rm.c.R = { k: k, to: nb.i, h: h }; nb.c.L = { k: k, to: rm.i, h: h };
      }
      var vl = MAP[rm.y * 2 + 1], vc = vl ? vl.charAt(rm.x) : ' ', dn = at[rm.x + ',' + (rm.y + 1)];
      if (dn && vc && vc !== ' ') {
        var kk = { '|': 'ladder', ':': 'softladder', 'v': 'drop' }[vc];
        if (!kk) throw new Error('MAP: связь вниз «' + vc + '»');
        rm.c.D = { k: kk, to: dn.i }; dn.c.U = { k: kk, to: rm.i };
      }
    });
    // столбцы вертикальных связей: 4..14, не ближе 4 клеток к связи сверху
    // в экране с нишей кристалла вертикальные связи держатся подальше от стены ниши
    function pocketBad(q, c) {
      if (!/[1-8]/.test(q.kind) || CSPOT[+q.kind] !== 'pocket') return false;
      if (!q.c.L) return c <= 7; if (!q.c.R) return c >= 11; return false;
    }
    rooms.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (rm) {
      if (!rm.c.D) return;
      var dn = rooms[rm.c.D.to], up = rm.c.U ? rm.c.U.col : null, c0 = Math.floor(hsh(rm.x, rm.y, 2) * 11), c = 4 + c0;
      for (var k = 0; k < 11; k++) {
        c = 4 + (c0 + k * 5) % 11;
        if ((up == null || Math.abs(c - up) >= 4) && !pocketBad(rm, c) && !pocketBad(dn, c)) break;
      }
      rm.c.D.col = c; dn.c.U.col = c;
    });
    return { rooms: rooms, at: at };
  }

  // ---------- Сборка экрана ----------
  // t — клетки, g — номер группы мягкой породы (общий для двух сторон двери), u — что под мягкой породой (пусто/лестница)
  function buildRoom(W, rm) {
    var rnd = mulberry32((rm.x * 131 + rm.y * 977 + 12345) | 0);
    var ri = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
    var t = new Uint8Array(NK).fill(R), g = new Int16Array(NK), u = new Uint8Array(NK);
    var I = function (x, y) { return y * COLS + x; };
    var set = function (x, y, k, gid, under) { var i = I(x, y); t[i] = k; g[i] = gid || 0; u[i] = under || 0; };
    var c = rm.c, hl = c.L ? c.L.h : null, hr = c.R ? c.R.h : null;
    var reserved = {}, res = function (x) { reserved[x] = 1; };
    var vcols = [];
    if (c.D) vcols.push({ col: c.D.col, k: c.D.k, dir: 'D' });
    if (c.U) vcols.push({ col: c.U.col, k: c.U.k, dir: 'U' });
    vcols.forEach(function (v) { for (var x = v.col - 1; x <= v.col + 2; x++) res(x); });

    // 1) профиль пола: ступени не выше 2 клеток, у дверей ровно
    var a = hl != null ? hl : (hr != null ? hr : ri(9, 10)), b = hr != null ? hr : (hl != null ? clamp(hl + ri(-1, 1), 8, 10) : ri(8, 10));
    var nbp = ri(1, 3), pts = [], lv = [a];
    for (var k = 0; k < nbp; k++) pts.push(ri(4, 15));
    pts.sort(function (p, q) { return p - q; });
    pts = pts.filter(function (p, i) { return i === 0 || p - pts[i - 1] >= 3; });
    for (k = 0; k < pts.length; k++) lv.push(clamp(lv[lv.length - 1] + ri(-2, 2), 7, 10));
    lv.push(b);
    for (var pass = 0; pass < 6; pass++) {
      for (k = lv.length - 2; k >= 1; k--) if (Math.abs(lv[k] - lv[k + 1]) > 2) lv[k] = lv[k + 1] + (lv[k] > lv[k + 1] ? 2 : -2);
      for (k = 1; k < lv.length - 1; k++) if (Math.abs(lv[k] - lv[k - 1]) > 2) lv[k] = lv[k - 1] + (lv[k] > lv[k - 1] ? 2 : -2);
    }
    var f = new Array(COLS), bounds = [0].concat(pts).concat([17]);
    for (var x = 0; x < COLS; x++) {
      var seg = 0; for (k = 0; k < bounds.length; k++) if (x >= bounds[k]) seg = k;
      f[x] = x <= 2 ? a : x >= 17 ? b : lv[Math.min(seg, lv.length - 1)];
    }
    // провалы и лестницы — на ровном полу (столбец−1 … столбец+2)
    vcols.forEach(function (v) { var h = f[v.col]; for (var x = v.col - 1; x <= v.col + 2; x++) f[x] = h; });
    // ниша кристалла
    var cid = /[1-8]/.test(rm.kind) ? +rm.kind : 0, spot = cid ? CSPOT[cid] : null, pocket = null;
    if (spot === 'pocket') {
      var side = !c.L ? 'L' : !c.R ? 'R' : null, near = false;
      vcols.forEach(function (v) { if (side === 'L' ? v.col <= 6 : v.col >= 12) near = true; });
      if (side && !near) pocket = side; else spot = 'high';
    }
    if (pocket === 'L') { for (x = 0; x <= 6; x++) f[x] = a; for (x = 0; x <= 4; x++) res(x); }
    if (pocket === 'R') { for (x = 13; x < COLS; x++) f[x] = b; for (x = 15; x < COLS; x++) res(x); }
    rm.f = f;

    // 2) вырезаем воздух
    for (x = 1; x < COLS - 1; x++) for (var y = 1; y < f[x]; y++) set(x, y, E);
    // 3) двери
    function door(x, h, kind, gid) {
      for (var y = h - 3; y < h; y++) {
        if (kind === 'soft') set(x, y, SO, gid, E);
        else if (kind === 'gate') set(x, y, GT);
        else set(x, y, E);
      }
    }
    if (c.L) door(0, hl, c.L.k, c.L.k === 'soft' ? W.gid('h', rm.x - 1, rm.y) : 0);
    if (c.R) door(COLS - 1, hr, c.R.k, c.R.k === 'soft' ? W.gid('h', rm.x, rm.y) : 0);
    // 4) вертикальные связи
    vcols.forEach(function (v) {
      var x = v.col, y;
      if (v.dir === 'D') {
        if (v.k === 'drop') { for (y = 1; y < ROWS; y++) { set(x, y, E); set(x + 1, y, E); } }
        else {
          for (y = f[x]; y < ROWS; y++) set(x, y, LD);
          if (v.k === 'softladder') { var gid = W.gid('v', rm.x, rm.y); set(x, f[x], SO, gid, LD); set(x, f[x] + 1, SO, gid, LD); }
        }
      } else {
        if (v.k === 'drop') { for (y = 0; y < f[x]; y++) { set(x, y, E); set(x + 1, y, E); } }
        else for (y = 0; y < f[x]; y++) set(x, y, LD);
      }
    });
    // 5) ниша: стенка из мягкой породы высотой 3, над нишей — скала
    var items = [];
    if (pocket) {
      var pg = W.gid('p', rm.x, rm.y), wx = pocket === 'L' ? 3 : COLS - 4, fx = f[wx];
      for (y = fx - 3; y < fx; y++) set(wx, y, SO, pg, E);
      for (x = pocket === 'L' ? 1 : COLS - 4; x <= (pocket === 'L' ? 3 : COLS - 2); x++) for (y = 1; y < fx - 3; y++) set(x, y, R);
      items.push({ k: 'crystal', cid: cid, c: pocket === 'L' ? 1 : COLS - 2, r: fx });
    }
    // 6) сталактиты (оставляют ≥ 5 клеток над полом)
    for (x = 2; x < COLS - 2; x++) {
      if (reserved[x] || rnd() > 0.35) continue;
      var kmax = Math.min(3, f[x] - 6); if (kmax < 1) continue;
      var kk = ri(1, kmax); for (y = 1; y <= kk; y++) set(x, y, R);
    }
    // 7) балки (односторонние платформы): ярус 1 — на 3 выше пола, ярус 2 — ещё на 3 выше
    var plats = [];
    function clearRow(x0, x1, y0, y1) { for (var xx = x0; xx <= x1; xx++) { if (reserved[xx]) return false; for (var yy = y0; yy <= y1; yy++) if (t[I(xx, yy)] !== E) return false; } return true; }
    function addPlat(x0, len, p) {
      if (x0 < 2 || x0 + len - 1 > COLS - 3 || p < 3) return null;
      if (!clearRow(x0 - 1, x0 + len, p - 2, p + 1)) return null;
      for (var xx = x0; xx < x0 + len; xx++) if (f[xx] - p < 3) return null;
      for (xx = x0; xx < x0 + len; xx++) set(xx, p, PF);
      var o = { x0: x0, x1: x0 + len - 1, p: p }; plats.push(o); return o;
    }
    var nPl = ri(1, 2) + (spot === 'plat' || spot === 'high' ? 1 : 0), tries = 0, maxTries = cid ? 150 : 30;
    while (plats.length < nPl && tries++ < maxTries) {
      var len = ri(3, 5), x0 = ri(3, COLS - 3 - len), fm = 99;
      for (x = x0; x < x0 + len; x++) fm = Math.min(fm, f[x]);
      addPlat(x0, len, fm - 3);
    }
    var tier2 = null;
    if (plats.length && (spot === 'high' || rnd() < 0.45)) {
      for (k = 0; k < plats.length && !tier2; k++) {
        var P0 = plats[k];
        for (var l2 = 4; l2 >= 3 && !tier2; l2--) for (var off = 1; off <= 2 && !tier2; off++)
          tier2 = addPlat(P0.x1 - off, l2, P0.p - 3) || addPlat(P0.x0 - l2 + 1 + off, l2, P0.p - 3);
        if (tier2) tier2.parent = P0;
      }
    }
    // кристаллу без балки — каменный уступ высотой 3 (запрыгнуть можно только с пола рядом)
    var ledge = null;
    if (cid && !pocket && !plats.length) {
      for (x = 16; x >= 2 && !ledge; x--) {
        var ok = true;
        for (var lx = x; lx <= x + 2; lx++) if (reserved[lx] || f[lx] !== f[x]) ok = false;
        var apr = [x - 1, x + 3].some(function (q) { return q >= 1 && q <= COLS - 2 && f[q] === f[x] && (t[I(q, f[q])] === R || t[I(q, f[q])] === LD); });
        if (!ok || !apr) continue;
        for (lx = x; lx <= x + 2; lx++) for (y = f[x] - 6; y < f[x]; y++) if (t[I(lx, y)] !== E) ok = false;
        if (!ok) continue;
        var fb = f[x];
        for (lx = x; lx <= x + 2; lx++) { for (y = fb - 3; y < fb; y++) set(lx, y, R); f[lx] = fb - 3; reserved[lx] = 1; }
        ledge = { c: x + 1, r: fb - 3 };
      }
    }
    // 8) опасности: шлак (на ровном полу), паровые клапаны
    var vents = [], occupied = {};
    function flat(x0, x1) { for (var xx = x0; xx <= x1; xx++) if (f[xx] !== f[x0] || reserved[xx]) return false; return true; }
    var calm = rm.kind === 'S' || rm.kind === '1' || rm.zone === 4 || rm.kind === 'G';
    if (!calm && rm.zone >= 1) {
      var nSl = rm.zone >= 2 ? ri(1, 2) : (rnd() < 0.5 ? 1 : 0);
      for (k = 0; k < nSl; k++) {
        var w = rm.zone >= 3 && rnd() < 0.5 ? 2 : 1, sx = ri(4, 15 - w);
        if (!flat(sx - 1, sx + w) || occupied[sx - 1] || occupied[sx + w]) continue;
        for (x = sx; x < sx + w; x++) { set(x, f[x], SL); occupied[x] = 1; }
      }
      if (rm.zone >= 2 && rnd() < 0.55) {
        var vx = ri(5, 14);
        if (flat(vx - 1, vx + 1) && !occupied[vx - 1] && !occupied[vx] && !occupied[vx + 1]) { set(vx, f[vx], VT); occupied[vx] = 1; vents.push({ x: vx, y: f[vx], ph: rnd() * 3.4 }); }
      }
    }
    // 9) предметы
    function floorSpot(pref) {
      for (var d = 0; d < COLS; d++) for (var s = -1; s <= 1; s += 2) {
        var xx = pref + d * s; if (xx < 2 || xx > COLS - 3 || reserved[xx] || occupied[xx]) continue;
        if (t[I(xx, f[xx])] === R && t[I(xx, f[xx] - 1)] === E && t[I(xx, f[xx] - 2)] === E) return xx;
      }
      return null;
    }
    function platSpot(P) { var xx = P.x0 + Math.floor((P.x1 - P.x0 + 1) / 2); return { c: xx, r: P.p }; }
    if (cid && !pocket) {
      var host = spot === 'high' && tier2 ? tier2 : plats.length ? plats[plats.length - 1] : null;
      if (host) { var sp = platSpot(host); host.used = 1; items.push({ k: 'crystal', cid: cid, c: sp.c, r: sp.r }); }
      else if (ledge) items.push({ k: 'crystal', cid: cid, c: ledge.c, r: ledge.r });
      else { var fx2 = floorSpot(15); items.push({ k: 'crystal', cid: cid, c: fx2, r: f[fx2] }); }
    }
    if (rm.kind === 'S' || rm.kind === 'b') { var bx = floorSpot(9); occupied[bx] = 1; items.push({ k: 'beacon', c: bx, r: f[bx] }); }
    if (rm.kind === 'H') { var hx = floorSpot(13); occupied[hx] = 1; items.push({ k: 'heart', c: hx, r: f[hx] }); }
    plats.forEach(function (P) { if (!P.used && rnd() < 0.7) { var s2 = platSpot(P); items.push({ k: 'nugget', c: s2.c, r: s2.r }); } });
    if (rnd() < 0.5) { var nx = floorSpot(ri(4, 15)); if (nx != null) { occupied[nx] = 1; items.push({ k: 'nugget', c: nx, r: f[nx] }); } }
    if (!calm && hsh(rm.x, rm.y, 5) < 0.24) { var tx = floorSpot(ri(5, 14)); if (tx != null) { occupied[tx] = 1; items.push({ k: 'tank', c: tx, r: f[tx] }); } }
    items.forEach(function (it, n) { it.id = rm.i + ':' + n; });
    // 10) обитатели шахты
    var en = [], ne = 0;
    if (rm.kind === 'S' || rm.kind === '1' || rm.zone === 4) ne = 0;
    else if (rm.zone === 0) ne = hsh(rm.x, rm.y, 6) < 0.5 ? 1 : 0;
    else if (rm.zone === 1) ne = 1 + (hsh(rm.x, rm.y, 6) < 0.4 ? 1 : 0);
    else if (rm.zone === 2) ne = 1 + (hsh(rm.x, rm.y, 6) < 0.6 ? 1 : 0);
    else ne = 2 + (hsh(rm.x, rm.y, 6) < 0.3 ? 1 : 0);
    var fmin = 99; for (x = 3; x < COLS - 3; x++) fmin = Math.min(fmin, f[x]);
    for (k = 0; k < ne; k++) {
      var crawl = rnd() < 0.45;
      if (crawl) {
        var cx = floorSpot(ri(6, 13));
        if (cx != null) { en.push({ type: 'crawler', x: cx + 0.5, y: f[cx], dir: rnd() < 0.5 ? -1 : 1 }); continue; }
      }
      var vert = vcols.length && rnd() < 0.3 && !(c.L && c.R);
      if (vert) {
        var vc0 = vcols[0].col, mx = vc0 > 9 ? vc0 - 3 : vc0 + 4;
        en.push({ type: 'moth', mode: 'v', x0: mx + 0.5, y0: 2.5, y1: f[mx] - 2, ph: rnd() * 6 });
      } else {
        var my = clamp(fmin - 3.6 - rnd() * 1.2, 2.2, 8), mx0 = ri(3, 7), mx1 = ri(12, 16);
        en.push({ type: 'moth', mode: 'h', x0: mx0 + 0.5, x1: mx1 + 0.5, y0: my, ph: rnd() * 6 });
      }
    }
    rm.t = t; rm.g = g; rm.u = u; rm.items = items; rm.spawns = en; rm.vents = vents; rm.plats = plats;
  }

  // ---------- Мир (кэш: строится один раз) ----------
  var WORLD = null;
  function buildWorld() {
    var P = parse(), groups = {}, nG = 0;
    var W = { rooms: P.rooms, at: P.at, groups: groups, nGroups: 0 };
    W.gid = function (kind, x, y) { var key = kind + x + ',' + y; if (!groups[key]) groups[key] = ++nG; W.nGroups = nG; return groups[key]; };
    W.rooms.forEach(function (rm) { buildRoom(W, rm); });
    W.crystals = []; W.start = null; W.heart = null; W.beacons = [];
    W.rooms.forEach(function (rm) {
      rm.items.forEach(function (it) {
        var node = rm.i * NK + it.r * COLS + it.c;
        if (it.k === 'crystal') W.crystals.push({ cid: it.cid, room: rm.i, c: it.c, r: it.r, node: node, id: it.id });
        if (it.k === 'heart') W.heart = { room: rm.i, c: it.c, r: it.r, node: node };
        if (it.k === 'beacon') { W.beacons.push({ room: rm.i, c: it.c, r: it.r, node: node }); if (rm.kind === 'S') W.start = { room: rm.i, c: it.c - 2, r: rm.f[it.c - 2], node: rm.i * NK + rm.f[it.c - 2] * COLS + it.c - 2 }; }
      });
    });
    W.crystals.sort(function (a, b) { return a.cid - b.cid; });
    // группы мягкой породы рядом с экраном (для кэша графа)
    W.rooms.forEach(function (rm) {
      var near = {}, gate = false;
      [rm].concat(['L', 'R', 'U', 'D'].map(function (d) { return rm.c[d] ? W.rooms[rm.c[d].to] : null; })).forEach(function (q) {
        if (!q) return; for (var i = 0; i < NK; i++) { if (q.t[i] === SO) near[q.g[i]] = 1; if (q.t[i] === GT) gate = true; }
      });
      rm.near = Object.keys(near).map(Number).sort(function (a, b) { return a - b; }); rm.nearGate = gate;
    });
    return W;
  }
  function world() { return WORLD || (WORLD = buildWorld()); }

  // ---------- Клетки с учётом состояния (выкопано / Печать открыта) ----------
  // За краем экрана повторяется крайняя клетка — так дверь/лестница/провал «продолжаются» в соседа.
  function tileAt(st, rm, cx, cy) {
    if (cx < 0) cx = 0; else if (cx >= COLS) cx = COLS - 1;
    if (cy < 0) cy = 0; else if (cy >= ROWS) cy = ROWS - 1;
    var i = cy * COLS + cx, k = rm.t[i];
    if (k === SO && st.dug[rm.g[i]]) return rm.u[i];
    if (k === GT && st.gate) return E;
    return k;
  }
  function isTop(st, rm, cx, cy) { return tileAt(st, rm, cx, cy) === LD && tileAt(st, rm, cx, cy - 1) !== LD; }
  function isStand(st, rm, c, r) {
    if (c < 0 || c >= COLS || r < 2 || r >= ROWS) return false;
    var k = tileAt(st, rm, c, r);
    var sup = (isSolid(k) && k !== SL) || k === PF || (k === LD && tileAt(st, rm, c, r - 1) !== LD);
    return sup && !isSolid(tileAt(st, rm, c, r - 1)) && !isSolid(tileAt(st, rm, c, r - 2));
  }
  function ladderAt(st, rm, H) { var col = Math.floor(H.x); return tileAt(st, rm, col, Math.floor(H.y - 0.3)) === LD && Math.abs(H.x - col - 0.5) < 0.42; }

  // ---------- Физика героя (общая для игры, графа и бота) ----------
  function newHero(W, room, x, y) {
    return { room: room, x: x, y: y, vx: 0, vy: 0, ground: true, climb: false, face: 1, stun: 0, coy: 0, kb: 0, kbx: 0, inv: 0,
      jumpHeld: false, apex: W.rooms[room].y * ROWS + y, walkT: 0 };
  }
  function heroStep(W, st, H, inp, dt) {
    var ev = { land: -1, slag: false, room: null, jump: false, climbTop: false };
    var rm = W.rooms[H.room], dx = inp.dx || 0, dy = inp.dy || 0;
    var jumpEdge = !!inp.jump && !H.jumpHeld; H.jumpHeld = !!inp.jump;
    if (H.stun > 0) { H.stun -= dt; dx = 0; dy = 0; jumpEdge = false; }
    if (dx) H.face = dx > 0 ? 1 : -1;
    var col = Math.floor(H.x), c, r;
    var sol = function (cx, cy) { return isSolid(tileAt(st, rm, cx, cy)); };
    if (!H.climb && H.kb <= 0) {
      if (dy < 0 && ladderAt(st, rm, H)) { H.climb = true; H.vy = 0; }
      else if (dy > 0 && H.ground && tileAt(st, rm, col, Math.floor(H.y + 0.01)) === LD && Math.abs(H.x - col - 0.5) < 0.42) { H.climb = true; H.vy = 0; }
    }
    var wasGround = H.ground;
    if (H.climb) {
      H.x += (col + 0.5 - H.x) * Math.min(1, dt * 18); H.vx = 0;
      if (jumpEdge) { H.climb = false; H.vy = -JUMP_V * 0.55; H.ground = false; ev.jump = true; }
      else if (dx && !dy) { H.climb = false; H.vy = 0; }
      else {
        H.vy = dy * CLIMB; var cy = H.y + H.vy * dt;
        if (dy < 0) {
          if (sol(col, Math.floor(cy - HH))) cy = Math.floor(cy - HH) + 1 + HH;
          H.y = cy;
          var fr = Math.floor(H.y - 0.001);
          if (tileAt(st, rm, col, fr) !== LD) {
            if (tileAt(st, rm, col, fr + 1) === LD) { H.y = fr + 1; H.ground = true; ev.climbTop = true; }
            H.climb = false; H.vy = 0;
          }
        } else if (dy > 0) {
          var rb = Math.floor(cy);
          if (sol(col, rb)) { cy = rb; H.climb = false; H.ground = true; H.vy = 0; }
          H.y = cy;
        } else H.vy = 0;
      }
      if (H.climb) H.ground = false;
    }
    if (!H.climb) {
      if (H.kb > 0) { H.kb -= dt; H.vx = H.kbx; } else H.vx = dx * RUN;
      if (H.ground) H.coy = COYOTE; else H.coy -= dt;
      if (jumpEdge && H.coy > 0) { H.vy = -JUMP_V; H.ground = false; H.coy = 0; ev.jump = true; }
      if (!inp.jump && H.vy < -JUMP_CUT && H.kb <= 0) H.vy = -JUMP_CUT;
      H.vy = Math.min(VMAX, H.vy + GRAV * dt);
      var nx = H.x + H.vx * dt, top = Math.floor(H.y - HH + 0.001), bot = Math.floor(H.y - 0.001), cc;
      if (H.vx > 0) { cc = Math.floor(nx + HW); for (r = top; r <= bot; r++) if (sol(cc, r)) { nx = cc - HW - 0.0001; break; } }
      else if (H.vx < 0) { cc = Math.floor(nx - HW); for (r = top; r <= bot; r++) if (sol(cc, r)) { nx = cc + 1 + HW + 0.0001; break; } }
      H.x = nx;
      var ny = H.y + H.vy * dt, c0 = Math.floor(H.x - HW), c1 = Math.floor(H.x + HW - 0.0001);
      H.ground = false;
      if (H.vy >= 0) {
        var rr = Math.floor(ny), landed = false, firm = false;
        for (c = c0; c <= c1; c++) {
          var tt = tileAt(st, rm, c, rr);
          if (isSolid(tt) || ((tt === PF || (tt === LD && tileAt(st, rm, c, rr - 1) !== LD)) && H.y <= rr + 0.0001)) { landed = true; if (tt !== SL) firm = true; }
        }
        if (landed) {
          ny = rr; H.vy = 0; H.ground = true;
          if (!firm || tileAt(st, rm, Math.floor(H.x), rr) === SL) { H.vy = -13; H.ground = false; ev.slag = true; }
        }
      } else {
        var rh = Math.floor(ny - HH);
        for (c = c0; c <= c1; c++) if (sol(c, rh)) { ny = rh + 1 + HH; H.vy = 0; break; }
      }
      H.y = ny;
      H.walkT = H.ground && H.vx ? H.walkT + dt : 0;
    }
    // высота падения → оглушение
    var absY = rm.y * ROWS + H.y;
    if (H.ground || H.climb) {
      if (H.ground && !wasGround && !ev.climbTop) { ev.land = absY - H.apex; if (ev.land >= STUN_FALL) H.stun = STUN_T; }
      H.apex = absY;
    } else if (absY < H.apex) H.apex = absY;
    // переход между экранами
    var C = rm.c;
    if (H.x < 0 && C.L) { H.room = C.L.to; H.x += COLS; ev.room = 'L'; }
    else if (H.x >= COLS && C.R) { H.room = C.R.to; H.x -= COLS; ev.room = 'R'; }
    else if (H.y - HH / 2 < 0 && C.U) { H.room = C.U.to; H.y += ROWS; ev.room = 'U'; }
    else if (H.y - HH / 2 > ROWS && C.D) { H.room = C.D.to; H.y -= ROWS; ev.room = 'D'; }
    else {
      if (!C.L && H.x < HW) H.x = HW;
      if (!C.R && H.x > COLS - HW) H.x = COLS - HW;
      if (H.y > ROWS + 1) H.y = ROWS + 1;
    }
    return ev;
  }

  // Куда докопает крот из положения стоя (c, r): dir −1/1 — вбок по полосе тела, 'D' — вниз, 'U' — вверх.
  function moleScan(st, rm, c, r, dir) {
    var k, gid = function (x, y) { var i = y * COLS + x; return rm.t[i] === SO && !st.dug[rm.g[i]] ? rm.g[i] : 0; };
    if (dir === 'D') return r < ROWS ? gid(c, r) : 0;
    if (dir === 'U') { for (k = r - 3; k >= Math.max(0, r - 4); k--) { if (gid(c, k)) return gid(c, k); if (isSolid(tileAt(st, rm, c, k))) return 0; } return 0; }
    for (k = 1; k <= MOLE_RANGE; k++) {
      var x = c + dir * k; if (x < 0 || x >= COLS) return 0;
      var a = gid(x, r - 1) || gid(x, r - 2); if (a) return a;
      if (isSolid(tileAt(st, rm, x, r - 1))) return 0;
    }
    return 0;
  }

  // ---------- Действия-«макросы» (граф проходимости и бот используют одни и те же) ----------
  var ACTS = [{ k: 'walk', d: -1 }, { k: 'walk', d: 1 }, { k: 'up' }, { k: 'down' }, { k: 'jump', d: 0, delay: 0, hold: 0 }];
  [-1, 1].forEach(function (d) {
    [0.1, 0.2, 0.3, 0.42, 0.56, 0.75].forEach(function (h) { ACTS.push({ k: 'jump', d: d, delay: 0, hold: h }); });
    [0.15, 0.3, 0.45].forEach(function (h) { ACTS.push({ k: 'jump', d: d, delay: 0.2, hold: h }); });
  });
  ACTS.forEach(function (a, i) { a.i = i; });
  function absX(W, H) { return W.rooms[H.room].x * COLS + H.x; }
  // ввод для действия a в момент t (X0 — абсолютный x старта); n — шум времени (бот)
  function drive(W, a, t, H, X0, n) {
    n = n || 0;
    var inp = { dx: 0, dy: 0, jump: false };
    if (a.k === 'walk') { var ax = absX(W, H); if (a.d > 0 ? ax < X0 + 1 : ax > X0 - 1) inp.dx = a.d; }
    else if (a.k === 'jump') { inp.jump = t < 0.5; if (t >= a.delay + n && t < a.delay + a.hold + n * 0.5) inp.dx = a.d; }
    else if (a.k === 'up') inp.dy = -1;
    else if (a.k === 'down') inp.dy = 1;
    return inp;
  }
  // m — память действия {left, climbed, X0}
  function finished(W, a, t, H, m) {
    if (!H.ground || H.climb) m.left = true;
    if (H.climb) m.climbed = true;
    if (a.k === 'walk') {
      var ax = absX(W, H), reached = a.d > 0 ? ax >= m.X0 + 1 - 0.001 : ax <= m.X0 - 1 + 0.001;
      if (reached && H.ground && H.stun <= 0) return 'ok';
      if (t > 0.6 && !reached && H.ground && !m.left) return 'fail';
      return t > 4 ? 'fail' : null;
    }
    if (a.k === 'jump') { if (m.left && H.ground && H.stun <= 0 && t >= a.delay + a.hold) return 'ok'; return t > 4 ? 'fail' : null; }
    if (a.k === 'up' || a.k === 'down') {
      if (t > 0.1 && !m.climbed) return 'fail';
      if (m.climbed && !H.climb && H.ground) return 'ok';
      if (m.climbed && !H.climb && !H.ground) return 'fail';
      return t > 9 ? 'fail' : null;
    }
    return 'fail';
  }

  // ---------- Граф проходимости: узлы — «стою в клетке», рёбра — симуляция действий ----------
  function Nav(W) {
    W = W || world();
    var cache = new Map();
    function rkey(st, ri) {
      var rm = W.rooms[ri], s = String(ri);
      for (var i = 0; i < rm.near.length; i++) s += st.dug[rm.near[i]] ? '1' : '0';
      if (rm.nearGate) s += st.gate ? 'G' : 'g';
      return s;
    }
    function sim(st, ri, c, r, a) {
      var H = newHero(W, ri, c + 0.5, r), m = { X0: W.rooms[ri].x * COLS + c + 0.5, left: false, climbed: false }, t = 0, dt = 1 / 60, touched = null, res = null;
      for (var n = 0; n < 600; n++) {
        var ev = heroStep(W, st, H, drive(W, a, t, H, m.X0), dt); t += dt;
        if (ev.slag) return null;
        // какие клетки мягкой породы/Печати тело проходит (в базовом мире они твёрдые)
        var rm = W.rooms[H.room], x0 = Math.floor(H.x - HW), x1 = Math.floor(H.x + HW - 0.0001), y0 = Math.floor(H.y - HH), y1 = Math.floor(H.y - 0.001);
        for (var yy = Math.max(0, y0); yy <= Math.min(ROWS - 1, y1); yy++) for (var xx = Math.max(0, x0); xx <= Math.min(COLS - 1, x1); xx++) {
          var q = rm.t[yy * COLS + xx];
          if (q === SO || q === GT) { touched = touched || []; var gq = q === GT ? -1 : rm.g[yy * COLS + xx]; if (touched.indexOf(gq) < 0) touched.push(gq); }
        }
        res = finished(W, a, t, H, m);
        if (res) break;
      }
      if (res !== 'ok') return null;
      var rm2 = W.rooms[H.room], row = Math.round(H.y), col = Math.floor(H.x);
      if (Math.abs(H.y - row) > 0.01) return null;
      if (!isStand(st, rm2, col, row)) {
        var alt = H.x - col < 0.5 ? col - 1 : col + 1;
        if (isStand(st, rm2, alt, row)) col = alt; else return null;
      }
      var to = H.room * NK + row * COLS + col;
      if (to === ri * NK + r * COLS + c) return null;
      return { a: a.i, to: to, t: t, g: touched };
    }
    function room(st, ri) {
      var k = rkey(st, ri), v = cache.get(k);
      if (v) return v;
      var rm = W.rooms[ri], nodes = [], out = {};
      for (var r = 2; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        if (!isStand(st, rm, c, r)) continue;
        var key = ri * NK + r * COLS + c, best = {};
        nodes.push(key);
        for (var ai = 0; ai < ACTS.length; ai++) {
          var e = sim(st, ri, c, r, ACTS[ai]);
          if (e && (!best[e.to] || best[e.to].t > e.t)) best[e.to] = e;
        }
        out[key] = Object.keys(best).map(function (q) { return best[q]; });
      }
      v = { nodes: nodes, out: out }; cache.set(k, v); return v;
    }
    function edges(st, node) { return room(st, Math.floor(node / NK)).out[node] || []; }
    function reach(st, from) {
      var seen = new Set([from]), q = [from];
      while (q.length) { var n = q.pop(), es = edges(st, n); for (var i = 0; i < es.length; i++) if (!seen.has(es[i].to)) { seen.add(es[i].to); q.push(es[i].to); } }
      return seen;
    }
    // Полный разбор: что достижимо с учётом крота (копает всё, до чего дотянется) и Печати (8 кристаллов)
    function solve() {
      var st = { dug: {}, gate: false }, R0 = null, digs = [];
      for (var it = 0; it < 80; it++) {
        R0 = reach(st, W.start.node);
        var added = false;
        R0.forEach(function (n) {
          var rm = W.rooms[Math.floor(n / NK)], rc = n % NK, r = Math.floor(rc / COLS), c = rc % COLS;
          [-1, 1, 'D'].forEach(function (d) { var gq = moleScan(st, rm, c, r, d); if (gq && !st.dug[gq]) { st.dug[gq] = true; digs.push(gq); added = true; } });
        });
        var allC = W.crystals.every(function (cr) { return R0.has(cr.node); });
        if (allC && !st.gate) { st.gate = true; added = true; }
        if (!added) break;
      }
      return { st: st, reach: R0, digs: digs, crystals: W.crystals.filter(function (cr) { return R0.has(cr.node); }).length, heart: R0.has(W.heart.node) };
    }
    return { room: room, edges: edges, reach: reach, solve: solve, sim: sim, W: W };
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var W = opts.world || world(), emit = opts.onEvent || function () {};
    var rng = opts.rng || Math.random, dmgMul = opts.dmgMul == null ? 1 : opts.dmgMul;   // dmgMul — только для тестов
    var S = {
      phase: 'play', phaseT: 0, time: 0, score: 0, lives: opts.lives || LIVES, energy: EMAX, over: false, won: false,
      room: W.start.room, hero: newHero(W, W.start.room, W.start.c + 0.5, W.start.r),
      mole: { state: 'home', x: 0, y: 0, dir: 1, dist: 0, t: 0, gid: 0, vert: 0 },
      dug: {}, gate: false, got: {}, crystals: [], visited: {}, enemies: [], cp: { room: W.start.room, x: W.start.c + 0.5, y: W.start.r, id: null },
      beaconT: {}, deaths: 0, stuns: 0, hurts: 0, kills: 0, inp: { dx: 0, dy: 0, jump: false }, upLock: false, finalBonus: 0
    };
    function enterRoom(ri) {
      S.room = ri; S.visited[ri] = true;
      var rm = W.rooms[ri];
      S.enemies = rm.spawns.map(function (s) {
        var e = Object.assign({ alive: true }, s);
        if (e.type === 'moth') { e.x = e.mode === 'v' ? e.x0 : e.x0 + (e.x1 - e.x0) * (0.3 + rng() * 0.4); e.y = e.y0; e.vx = (rng() < 0.5 ? -1 : 1) * (1.9 + rm.zone * 0.25); e.vy = 1.6 + rm.zone * 0.2; }
        else e.v = 1.4 + rm.zone * 0.2;
        return e;
      });
      if (S.mole.state !== 'home') S.mole.state = 'home';
      emit('room', { room: ri, zone: rm.zone });
    }
    function start() { enterRoom(S.room); S.beaconT['start'] = 0; return api; }
    function setInput(dx, dy, jump) { S.inp.dx = dx || 0; S.inp.dy = dy || 0; S.inp.jump = !!jump; }

    function hurt(dmg, srcX, why) {
      var H = S.hero;
      if (H.inv > 0 || S.phase !== 'play') return;
      S.energy -= dmg * dmgMul; S.hurts++; H.inv = INV_T;
      H.kb = 0.18; H.kbx = (H.x < srcX ? -1 : 1) * 6; H.vy = -8; H.ground = false; H.climb = false;
      emit('hurt', { why: why, energy: S.energy, x: H.x, y: H.y - 1 });
      if (S.energy <= 0) die(why);
    }
    function die(why) {
      S.energy = 0; S.phase = 'dead'; S.phaseT = DEAD_T; S.lives--; S.deaths++; S.mole.state = 'home';
      emit('die', { why: why, lives: S.lives, x: S.hero.x, y: S.hero.y - 1 });
    }
    function respawn() {
      if (S.lives <= 0) { S.over = true; S.phase = 'over'; emit('gameover', { score: S.score }); return; }
      S.hero = newHero(W, S.cp.room, S.cp.x, S.cp.y); S.hero.inv = SPAWN_INV;
      S.energy = EMAX; S.phase = 'play'; enterRoom(S.cp.room);
      emit('respawn', { room: S.cp.room });
    }
    function canClimbHere() { var H = S.hero; return H.climb || ladderAt(S, W.rooms[S.room], H); }

    // крот «Бурик»
    // force: −1/1 — вбок в эту сторону, 'D'/'U' — вниз/вверх; без него — по взгляду героя и зажатому ↑/↓
    function mole(force) {
      var H = S.hero, M = S.mole;
      if (M.state !== 'home' || S.phase !== 'play' || H.stun > 0) return false;
      var rm = W.rooms[S.room], col = Math.floor(H.x), dy = force === 'D' ? 1 : force === 'U' ? -1 : force ? 0 : S.inp.dy;
      if (typeof force === 'number') H.face = force;
      if (dy > 0 && H.ground) {
        var r = Math.round(H.y), gq = moleScan(S, rm, col, r, 'D');
        M.vert = 1; M.x = col + 0.5; M.y = H.y + 0.3;
        if (gq) { M.state = 'dig'; M.gid = gq; M.t = DIG_T; } else { M.state = 'back'; emit('clank', { x: M.x, y: M.y }); }
        emit('moleOut', { dir: 'D' }); return true;
      }
      if (dy < 0 && (H.climb || H.ground)) {
        var gu = moleScan(S, rm, col, Math.round(H.y), 'U');
        M.vert = -1; M.x = col + 0.5; M.y = H.y - HH - 0.3;
        if (gu) { M.state = 'dig'; M.gid = gu; M.t = DIG_T; } else { M.state = 'back'; emit('clank', { x: M.x, y: M.y }); }
        emit('moleOut', { dir: 'U' }); return true;
      }
      if (!H.ground) return false;
      M.vert = 0; M.dir = H.face; M.x = H.x + H.face * 0.4; M.y = H.y - 0.45; M.row = Math.round(H.y) - 1; M.dist = 0; M.state = 'out';
      emit('moleOut', { dir: H.face }); return true;
    }
    function updateMole(dt) {
      var M = S.mole, H = S.hero, rm = W.rooms[S.room];
      if (M.state === 'home') return;
      if (M.state === 'out') {
        var step = MOLE_V * dt; M.x += M.dir * step; M.dist += step;
        var cx = Math.floor(M.x + M.dir * 0.3), rf = M.row, i1 = rf * COLS + cx, i2 = (rf - 1) * COLS + cx;
        var soft = function (i) { return i >= 0 && rm.t[i] === SO && !S.dug[rm.g[i]] ? rm.g[i] : 0; };
        var gq = cx >= 0 && cx < COLS ? (soft(i1) || soft(i2)) : 0;
        S.enemies.forEach(function (e) {
          if (e.alive && e.type === 'crawler' && Math.abs(e.x - M.x) < 0.7 && Math.abs((e.y - 0.3) - M.y) < 0.8) {
            e.alive = false; S.kills++; S.score += PTS.kill; emit('kill', { x: e.x, y: e.y - 0.3, pts: PTS.kill });
          }
        });
        if (gq) { M.state = 'dig'; M.gid = gq; M.t = DIG_T; emit('digStart', { x: M.x, y: M.y }); }
        else if (cx < 0 || cx >= COLS || isSolid(tileAt(S, rm, cx, rf)) || M.dist > MOLE_RANGE) { M.state = 'back'; if (cx >= 0 && cx < COLS && M.dist <= MOLE_RANGE) emit('clank', { x: M.x, y: M.y }); }
      } else if (M.state === 'dig') {
        M.t -= dt;
        if (M.t <= 0) {
          S.dug[M.gid] = true; emit('dug', { gid: M.gid, x: M.x, y: M.y });
          M.state = M.vert ? 'back' : 'out';
        }
      } else if (M.state === 'back') {
        var tx = H.x, ty = H.y - 1.0, ddx = tx - M.x, ddy = ty - M.y, d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < 0.45) { M.state = 'home'; emit('moleHome', {}); }
        else { var s2 = Math.min(d, MOLE_BACK * dt); M.x += ddx / d * s2; M.y += ddy / d * s2; M.dir = ddx > 0 ? 1 : -1; }
      }
    }
    function updateEnemies(dt) {
      var rm = W.rooms[S.room], H = S.hero;
      S.enemies.forEach(function (e) {
        if (!e.alive) return;
        if (e.type === 'moth') {
          if (e.mode === 'v') { e.y += e.vy * dt; if (e.y < e.y0) { e.y = e.y0; e.vy = Math.abs(e.vy); } if (e.y > e.y1) { e.y = e.y1; e.vy = -Math.abs(e.vy); } e.x = e.x0 + Math.sin(S.time * 1.7 + e.ph) * 0.8; }
          else { e.x += e.vx * dt; if (e.x < e.x0) { e.x = e.x0; e.vx = Math.abs(e.vx); } if (e.x > e.x1) { e.x = e.x1; e.vx = -Math.abs(e.vx); } e.y = e.y0 + Math.sin(S.time * 2.2 + e.ph) * 0.7; }
        } else {
          var nx = e.x + e.dir * e.v * dt, ac = Math.floor(nx + e.dir * 0.45), row = e.y;
          var ahead = tileAt(S, rm, ac, row), wall = isSolid(tileAt(S, rm, ac, row - 1));
          var ok = (ahead === R || ahead === SO || ahead === PF) && !wall && ac >= 1 && ac <= COLS - 2;
          if (!ok) e.dir = -e.dir; else e.x = nx;
        }
        // касание героя
        var ex = e.x, ey = e.type === 'moth' ? e.y : e.y - 0.3, rx = e.type === 'moth' ? 0.42 : 0.45, ry = e.type === 'moth' ? 0.36 : 0.3;
        if (Math.abs(ex - H.x) < rx + HW && ey > H.y - HH - ry && ey < H.y + ry) hurt(DMG[e.type], ex, e.type);
      });
      rm.vents.forEach(function (v) {
        if (ventOn(v, S.time) && Math.abs(v.x + 0.5 - H.x) < 0.35 + HW && H.y > v.y - 3 && H.y - HH < v.y) hurt(DMG.vent, v.x + 0.5, 'vent');
      });
    }
    function items() {
      var rm = W.rooms[S.room], H = S.hero;
      rm.items.forEach(function (it) {
        var ix = it.c + 0.5, iy = it.r - 0.5;
        if (Math.abs(ix - H.x) > 0.75 || iy < H.y - HH - 0.4 || iy > H.y + 0.4) return;
        if (it.k === 'beacon') {
          var fresh = S.cp.id !== it.id, cd = S.beaconT[it.id];
          if (fresh || cd == null || S.time - cd > BEACON_CD) {
            if (fresh) { S.cp = { room: S.room, x: ix, y: it.r, id: it.id }; }
            var first = cd == null && rm.kind !== 'S';
            if (first) S.score += PTS.beacon;
            S.beaconT[it.id] = S.time; var gain = EMAX - S.energy; S.energy = EMAX;
            if (fresh || gain > 0) emit('beacon', { x: ix, y: iy, fresh: fresh, first: first });
          }
          return;
        }
        if (S.got[it.id]) return;
        if (it.k === 'heart') { if (!S.gate) return; winGame(); return; }
        S.got[it.id] = true;
        if (it.k === 'crystal') {
          S.crystals.push(it.cid); S.score += PTS.crystal; emit('crystal', { cid: it.cid, n: S.crystals.length, x: ix, y: iy });
          if (S.crystals.length >= CRYSTALS && !S.gate) { S.gate = true; emit('gateOpen', {}); }
        } else if (it.k === 'nugget') { S.score += PTS.nugget; emit('nugget', { x: ix, y: iy, pts: PTS.nugget }); }
        else if (it.k === 'tank') { S.energy = Math.min(EMAX, S.energy + TANK); emit('tank', { x: ix, y: iy }); }
      });
    }
    function winGame() {
      S.won = true; S.phase = 'won';
      var bonus = PTS.heart + S.lives * 1000 + Math.max(0, Math.round((900 - S.time) * 10));
      S.finalBonus = bonus; S.score += bonus;
      emit('win', { time: S.time, score: S.score, bonus: bonus });
    }
    function update(dt) {
      if (S.over || S.won) return;
      S.time += dt;
      if (S.phase === 'dead') { S.phaseT -= dt; if (S.phaseT <= 0) respawn(); return; }
      var H = S.hero, inp = S.inp;
      // «вверх» без лестницы рядом — прыжок (не повторяется, пока «вверх» зажат после подъёма)
      if (inp.dy >= 0) S.upLock = false;
      var climbable = canClimbHere();
      var jump = inp.jump || (inp.dy < 0 && !climbable && !S.upLock);
      if (H.inv > 0) H.inv -= dt;
      var prevRoom = H.room;
      var ev = heroStep(W, S, H, { dx: inp.dx, dy: inp.dy, jump: jump }, dt);
      if (ev.climbTop) S.upLock = true;
      if (ev.jump) emit('jump', {});
      if (ev.slag) { emit('slag', { x: H.x, y: H.y }); hurt(DMG.slag, H.x, 'slag'); }
      if (ev.land >= STUN_FALL) { S.stuns++; emit('stun', { fall: ev.land, x: H.x, y: H.y - HH }); }
      else if (ev.land >= THUD_FALL) emit('thud', { fall: ev.land });
      if (H.room !== prevRoom) enterRoom(H.room);
      if (S.phase !== 'play') return;
      updateMole(dt);
      updateEnemies(dt);
      if (S.phase !== 'play') return;
      items();
    }
    var api = {
      start: start, update: update, setInput: setInput, mole: mole, state: function () { return S; },
      canClimb: canClimbHere, world: W, _S: S,
      _hurt: hurt, _enter: enterRoom, _die: die,
      _place: function (ri, c, r) { S.hero = newHero(W, ri, c + 0.5, r); enterRoom(ri); },
      _giveCrystals: function (n) { for (var k = 0; k < n; k++) { var cr = W.crystals[k]; if (!S.got[cr.id]) { S.got[cr.id] = true; S.crystals.push(cr.cid); } } if (S.crystals.length >= CRYSTALS) S.gate = true; }
    };
    return api;
  }
  function ventOn(v, t) { return ((t + v.ph) % 3.4) < 1.1; }
  function ventWarn(v, t) { var p = (t + v.ph) % 3.4; return p > 2.8; }

  Gb.logic = {
    COLS: COLS, ROWS: ROWS, WX: WX, WY: WY, NK: NK, E: E, R: R, SO: SO, LD: LD, SL: SL, GT: GT, VT: VT, PF: PF,
    GRAV: GRAV, JUMP_V: JUMP_V, RUN: RUN, CLIMB: CLIMB, HW: HW, HH: HH, STUN_FALL: STUN_FALL, STUN_T: STUN_T, EMAX: EMAX, LIVES: LIVES,
    MOLE_RANGE: MOLE_RANGE, DIG_T: DIG_T, DMG: DMG, PTS: PTS, ZONES: ZONES, CRYSTALS: CRYSTALS, MAP: MAP, CSPOT: CSPOT, ACTS: ACTS, TANK: TANK,
    mulberry32: mulberry32, world: world, buildWorld: buildWorld, tileAt: tileAt, isSolid: isSolid, isTop: isTop, isStand: isStand,
    heroStep: heroStep, newHero: newHero, moleScan: moleScan, drive: drive, finished: finished, absX: absX, Nav: Nav, ventOn: ventOn, ventWarn: ventWarn
  };
  Gb.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
