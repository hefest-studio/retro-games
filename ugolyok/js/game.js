/* УГОЛЁК · логика игры (без DOM, детерминирована: все ловушки и обитатели — чистые функции времени).
   Платформер-лабиринт по экранам (флип-скрин): робот-кочегар Уголёк из мастерской «Гефест» собирает уголь
   по всей шахте, чтобы раздуть остывающий Горн. Мир — 48 экранов (8×6), фиксированная макро-карта MAP +
   детерминированная сборка экранов buildRoom(). Ловушки: прессы по такту, капли с потолка, конвейеры,
   вагонетки на рельсах, обрывы с шипами; обитатели — летучие сажники и ползучие окалыши.
   UGOLYOK.Game(opts) → api; UGOLYOK.logic — константы, мир, физика, опасности, граф проходимости (Nav). */
(function (global) {
  'use strict';
  var U = global.UGOLYOK = global.UGOLYOK || {};

  // ---------- Константы (единицы — клетки и секунды) ----------
  var COLS = 20, ROWS = 12, WX = 8, WY = 6, NK = COLS * ROWS;
  // клетки: пусто, скала, лестница/верёвка, балка (односторонняя), дверь (ключ), заслонка Горна, шипы, конвейер ←, конвейер →
  var E = 0, R = 1, LD = 2, PF = 3, DR = 4, GT = 5, SP = 6, CL = 7, CR = 8;
  var GRAV = 56, JUMP_V = 19.6, JUMP_CUT = 7, RUN = 5.4, CLIMB = 4.4, VMAX = 17, HW = 0.32, HH = 1.4, COYOTE = 0.08;
  var FALL_DIE = 7.5, THUD_FALL = 4.2, BELT = 2.4;          // падение ≥ 7,5 клетки (от высшей точки) — гибель
  var LIVES = 3, DEAD_T = 1.5, SPAWN_INV = 2.0, HELMET_T = 10, LIFE_EVERY = 5000;
  var PTS = { coal: 100, gear: 250, key: 500, helmet: 300, beacon: 200, room: 500, forge: 5000 };
  var ZONES = ['shop', 'drift', 'belts', 'rails', 'press', 'bottom'];
  var KEYS = 3;

  // ---------- Макро-карта мира ----------
  // Строки экранов (15 символов): экран на чётных позициях, связь вправо — на нечётных:
  //   '-' проход, 'A' / 'B' / 'C' — дверь (нужен ключ 1 / 2 / 3).
  // Строки связей вниз (8 символов, по столбцу): '|' лестница, '!' верёвка.
  // Экраны: '.' обычный, 'S' старт и Горн (с маяком), 'b' маяк, '1'..'3' ключ, 'h' каска.
  var MAP = [
    'S-.-.-1-.-b-.-.',
    ' | !    ',
    '.-.-b-. .-.-.-.',
    '|  | ! |',
    'h-.-.-.A.-b-2-.',
    ' |  | ! ',
    '.-.-b-. .-.-.-b',
    '| !     ',
    '.-b-.-.B.-h-.-3',
    '     | !',
    '.-b-.-.Cb-.-h-.'
  ];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hsh(a, b, c) {
    var h = (Math.imul(a + 7, 374761393) ^ Math.imul(b + 13, 668265263) ^ Math.imul(c + 29, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function isSolid(k) { return k === R || k === DR || k === GT || k === SP || k === CL || k === CR; }
  function isBelt(k) { return k === CL ? -1 : k === CR ? 1 : 0; }

  // ---------- Разбор карты ----------
  function parse() {
    var rooms = [], at = {};
    if (MAP.length !== WY * 2 - 1) throw new Error('MAP: строк ' + MAP.length);
    for (var y = 0; y < WY; y++) {
      var line = MAP[y * 2];
      if (line.length !== WX * 2 - 1) throw new Error('MAP: строка ' + y + ' — длина ' + line.length);
      for (var x = 0; x < WX; x++) {
        var ch = line.charAt(x * 2);
        if (ch === ' ') continue;
        var rm = { i: rooms.length, x: x, y: y, kind: ch, zone: y, c: { L: null, R: null, U: null, D: null } };
        rooms.push(rm); at[x + ',' + y] = rm;
      }
    }
    rooms.forEach(function (rm) {
      var hc = MAP[rm.y * 2].charAt(rm.x * 2 + 1), nb = at[(rm.x + 1) + ',' + rm.y];
      if (nb && hc && hc !== ' ') {
        var key = { '-': 0, 'A': 1, 'B': 2, 'C': 3 }[hc];
        if (key == null) throw new Error('MAP: связь «' + hc + '»');
        var h = 8 + Math.floor(hsh(rm.x, rm.y, 1) * 3);
        rm.c.R = { k: key ? 'door' : 'open', key: key, to: nb.i, h: h }; nb.c.L = { k: rm.c.R.k, key: key, to: rm.i, h: h };
      }
      var vl = MAP[rm.y * 2 + 1], vc = vl ? vl.charAt(rm.x) : ' ', dn = at[rm.x + ',' + (rm.y + 1)];
      if (dn && vc && vc !== ' ') {
        if (vc !== '|' && vc !== '!') throw new Error('MAP: связь вниз «' + vc + '»');
        rm.c.D = { k: 'ladder', rope: vc === '!', to: dn.i }; dn.c.U = { k: 'ladder', rope: vc === '!', to: rm.i };
      }
    });
    // столбцы вертикальных связей: 4..14, не ближе 4 клеток к связи сверху; в экране с Горном — правее ниши
    function bad(q, c) { return q.kind === 'S' && c <= 8; }
    rooms.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (rm) {
      if (!rm.c.D) return;
      var dn = rooms[rm.c.D.to], up = rm.c.U ? rm.c.U.col : null, c0 = Math.floor(hsh(rm.x, rm.y, 2) * 11), c = 4 + c0;
      for (var k = 0; k < 11; k++) {
        c = 4 + (c0 + k * 5) % 11;
        if ((up == null || Math.abs(c - up) >= 4) && !bad(rm, c) && !bad(dn, c)) break;
      }
      rm.c.D.col = c; dn.c.U.col = c;
    });
    return { rooms: rooms, at: at };
  }

  // ---------- Сборка экрана ----------
  // t — клетки, g — номер ключа у двери; hz — ловушки и обитатели; items — уголь, ключи, каски, шестерни, маяки, Горн
  function buildRoom(W, rm) {
    var rnd = mulberry32((rm.x * 197 + rm.y * 1031 + 4242) | 0);
    var ri = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
    var t = new Uint8Array(NK).fill(R), g = new Uint8Array(NK);
    var I = function (x, y) { return y * COLS + x; };
    var set = function (x, y, k, gid) { var i = I(x, y); t[i] = k; g[i] = gid || 0; };
    var c = rm.c, hl = c.L ? c.L.h : null, hr = c.R ? c.R.h : null;
    var reserved = {}, res = function (x) { reserved[x] = 1; }, occupied = {}, lane = {};
    var vcols = [];
    if (c.D) vcols.push({ col: c.D.col, rope: c.D.rope, dir: 'D' });
    if (c.U) vcols.push({ col: c.U.col, rope: c.U.rope, dir: 'U' });
    vcols.forEach(function (v) { for (var x = v.col - 1; x <= v.col + 2; x++) res(x); });
    var calm = rm.kind === 'S' || (rm.x === 1 && rm.y === 0);
    var z = rm.zone;

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
    vcols.forEach(function (v) { var h = f[v.col]; for (var x = v.col - 1; x <= v.col + 2; x++) f[x] = h; });
    var pocket = rm.kind === 'S';
    if (pocket) { for (x = 0; x <= 7; x++) f[x] = a; for (x = 0; x <= 4; x++) res(x); }
    rm.f = f;

    // 2) воздух, двери, вертикальные связи
    for (x = 1; x < COLS - 1; x++) for (var y = 1; y < f[x]; y++) set(x, y, E);
    function door(xx, h, cn) { for (var yy = h - 3; yy < h; yy++) { if (cn.k === 'door') set(xx, yy, DR, cn.key); else set(xx, yy, E); } }
    if (c.L) door(0, hl, c.L);
    if (c.R) door(COLS - 1, hr, c.R);
    var rope = {};
    vcols.forEach(function (v) {
      var xx = v.col, yy;
      if (v.rope) rope[xx] = 1;
      if (v.dir === 'D') for (yy = f[xx]; yy < ROWS; yy++) set(xx, yy, LD);
      else for (yy = 0; yy < f[xx]; yy++) set(xx, yy, LD);
    });
    var items = [];
    // 3) ниша Горна (только в стартовом экране): заслонка высотой 3, над нишей — скала
    if (pocket) {
      var fx = f[3];
      for (y = fx - 3; y < fx; y++) set(3, y, GT);
      for (x = 1; x <= 3; x++) for (y = 1; y < fx - 3; y++) set(x, y, R);
      items.push({ k: 'forge', c: 1, r: fx });
    }
    function flat(x0, x1) { if (x0 < 1 || x1 > COLS - 2) return false; for (var xx = x0; xx <= x1; xx++) if (f[xx] !== f[x0] || reserved[xx] || occupied[xx] || t[I(xx, f[xx])] !== R) return false; return true; }
    var presses = [], drips = [], carts = [], belts = [], pits = [];

    // 4) прессы (прессовый цех и дно): ходят по такту от потолка до пола
    var nPr = calm ? 0 : z === 4 ? 1 + (rnd() < 0.5 ? 1 : 0) : z === 5 ? (rnd() < 0.55 ? 1 : 0) : 0;
    for (k = 0, tries = 0; k < nPr && tries < 40; tries++) {
      var px = ri(4, 14);
      if (!flat(px - 1, px + 2)) continue;
      presses.push({ x: px, top: 1, bot: f[px], per: 3.0 + rnd() * 0.6, ph: rnd() * 3 });
      for (x = px - 1; x <= px + 2; x++) res(x);
      occupied[px] = occupied[px + 1] = 1; k++;
    }
    // 5) обрывы: провал в 2 клетки до шипов на дне
    var pitP = calm ? 0 : z === 0 ? 0 : z <= 3 ? 0.4 : 0.3;
    var tries;
    if (rnd() < pitP) {
      for (tries = 0; tries < 30; tries++) {
        var qx = ri(5, 13);
        if (!flat(qx - 2, qx + 3)) continue;
        for (x = qx; x <= qx + 1; x++) { for (y = f[x]; y < ROWS - 1; y++) set(x, y, E); set(x, ROWS - 1, SP); }
        pits.push({ x: qx, y: f[qx] });
        for (x = qx - 1; x <= qx + 2; x++) res(x);
        for (x = qx - 2; x <= qx + 3; x++) occupied[x] = 1;
        break;
      }
    }
    // 6) вагонетки на рельсах (рельсовые галереи и ниже)
    var nCart = calm ? 0 : z === 3 ? 1 : z === 4 ? (rnd() < 0.3 ? 1 : 0) : z === 5 ? (rnd() < 0.45 ? 1 : 0) : 0;
    if (nCart) {
      var bestS = null;
      for (x = 3; x < COLS - 3; x++) {
        var e2 = x; while (e2 + 1 < COLS - 3 && flat(x, e2 + 1)) e2++;
        if (flat(x, e2) && (!bestS || e2 - x > bestS.e - bestS.s)) bestS = { s: x, e: e2 };
      }
      if (bestS && bestS.e - bestS.s + 1 >= 6) {
        var ln = Math.min(9, bestS.e - bestS.s + 1), s0 = bestS.s + ri(0, bestS.e - bestS.s + 1 - ln);
        carts.push({ s: s0, e: s0 + ln - 1, y: f[s0], x0: s0 + 0.7, x1: s0 + ln - 0.7, v: 3.0 + rnd() * 0.6, stop: 0.9, ph: rnd() * 6 });
        for (x = s0; x < s0 + ln; x++) lane[x] = 1;
      }
    }
    // 7) конвейеры
    var nBelt = calm ? 0 : z === 2 ? 1 + (rnd() < 0.5 ? 1 : 0) : z === 0 ? (rnd() < 0.35 ? 1 : 0) : z === 3 ? (rnd() < 0.3 ? 1 : 0) : z === 5 ? (rnd() < 0.5 ? 1 : 0) : 0;
    for (k = 0, tries = 0; k < nBelt && tries < 40; tries++) {
      var bl = ri(3, 5), bx = ri(3, 16 - bl + 1), ok = flat(bx, bx + bl - 1);
      for (x = bx; x < bx + bl && ok; x++) if (lane[x]) ok = false;
      if (!ok) continue;
      var dir = rnd() < 0.5 ? -1 : 1;
      for (x = bx; x < bx + bl; x++) { set(x, f[x], dir < 0 ? CL : CR); occupied[x] = 1; }
      belts.push({ s: bx, e: bx + bl - 1, y: f[bx], dir: dir }); k++;
    }
    // 8) сталактиты (оставляют ≥ 6 клеток над полом)
    for (x = 2; x < COLS - 2; x++) {
      if (reserved[x] || rnd() > 0.3) continue;
      var kmax = Math.min(2, f[x] - 7); if (kmax < 1) continue;
      var kk = ri(1, kmax); for (y = 1; y <= kk; y++) set(x, y, R);
    }
    // 9) балки (односторонние платформы): ярус 1 — на 3 выше пола, ярус 2 — ещё на 3 выше
    var plats = [];
    function clearRow(x0, x1, y0, y1) { for (var xx = x0; xx <= x1; xx++) { if (reserved[xx]) return false; for (var yy = y0; yy <= y1; yy++) if (t[I(xx, yy)] !== E) return false; } return true; }
    function addPlat(x0, len, p) {
      if (x0 < 2 || x0 + len - 1 > COLS - 3 || p < 3) return null;
      if (!clearRow(x0 - 1, x0 + len, p - 2, p + 1)) return null;
      for (var xx = x0; xx < x0 + len; xx++) if (f[xx] - p < 3 || t[I(xx, f[xx])] === E) return null;
      for (xx = x0; xx < x0 + len; xx++) set(xx, p, PF);
      var o = { x0: x0, x1: x0 + len - 1, p: p, used: {} }; plats.push(o); return o;
    }
    var nPl = ri(1, 3);
    for (tries = 0; plats.length < nPl && tries < 40; tries++) {
      var len = ri(3, 5), x0 = ri(3, COLS - 3 - len), fm = 99;
      for (x = x0; x < x0 + len; x++) fm = Math.min(fm, f[x]);
      addPlat(x0, len, fm - 3);
    }
    var tier2 = null;
    if (plats.length && rnd() < 0.45) {
      for (k = 0; k < plats.length && !tier2; k++) {
        var P0 = plats[k];
        for (var l2 = 4; l2 >= 3 && !tier2; l2--) for (var off = 1; off <= 2 && !tier2; off++)
          tier2 = addPlat(P0.x1 - off, l2, P0.p - 3) || addPlat(P0.x0 - l2 + 1 + off, l2, P0.p - 3);
      }
    }
    // 10) капли с потолка (штрек, конвейерный ярус, прессовый цех, дно)
    var nDrip = calm ? 0 : z === 1 ? 1 + (rnd() < 0.6 ? 1 : 0) : z === 2 || z === 4 ? (rnd() < 0.45 ? 1 : 0) : z === 5 ? 1 : 0;
    var dripCol = {};
    for (k = 0, tries = 0; k < nDrip && tries < 40; tries++) {
      var dx = ri(3, 16);
      if (reserved[dx] || dripCol[dx] || dripCol[dx - 1] || dripCol[dx + 1]) continue;
      var y0 = 1; while (y0 < ROWS && t[I(dx, y0)] !== E) y0++;
      var y1 = y0; while (y1 < ROWS && t[I(dx, y1)] === E) y1++;
      if (y1 - y0 < 3 || y1 >= ROWS) continue;
      drips.push({ x: dx, y0: y0, y1: y1, per: 2.3 + rnd() * 0.9, ph: rnd() * 3 }); dripCol[dx] = 1; k++;
    }

    // 11) предметы
    var taken = {};
    function standAt(xx, yy) { return xx >= 1 && xx <= COLS - 2 && yy >= 3 && (t[I(xx, yy)] === R || t[I(xx, yy)] === PF || isBelt(t[I(xx, yy)])) && t[I(xx, yy - 1)] === E && t[I(xx, yy - 2)] === E; }
    function floorSpot(pref, strict) {
      for (var d = 0; d < COLS; d++) for (var s = -1; s <= 1; s += 2) {
        var xx = pref + d * s; if (xx < 2 || xx > COLS - 3 || reserved[xx] || occupied[xx] || taken[xx + ',' + f[xx]]) continue;
        if (strict && (lane[xx] || dripCol[xx])) continue;
        if (t[I(xx, f[xx])] === R && standAt(xx, f[xx])) return xx;
      }
      return null;
    }
    function put(it) { taken[it.c + ',' + it.r] = 1; items.push(it); return it; }
    function platCell(P, mid) {
      var cs = []; for (var xx = P.x0; xx <= P.x1; xx++) if (!taken[xx + ',' + P.p] && !dripCol[xx]) cs.push(xx);
      if (!cs.length) return null;
      return mid ? cs[Math.floor(cs.length / 2)] : cs[ri(0, cs.length - 1)];
    }
    if (rm.kind === 'S' || rm.kind === 'b') { var bc = floorSpot(rm.kind === 'S' ? 11 : 9, true); occupied[bc] = 1; put({ k: 'beacon', c: bc, r: f[bc] }); }
    if (/[123]/.test(rm.kind)) {
      var host = tier2 || (plats.length ? plats[plats.length - 1] : null), kc = host ? platCell(host, true) : null;
      if (kc != null) put({ k: 'key', key: +rm.kind, c: kc, r: host.p });
      else { var kx = floorSpot(14, true); put({ k: 'key', key: +rm.kind, c: kx, r: f[kx] }); }
    }
    if (rm.kind === 'h') { var hx = floorSpot(ri(5, 14), true); put({ k: 'helmet', c: hx, r: f[hx] }); }
    var nC = rm.kind === 'S' ? 1 : 2 + (rnd() < 0.55 ? 1 : 0) + (z >= 3 && rnd() < 0.4 ? 1 : 0);
    var allPl = plats.slice();
    for (k = 0; k < nC; k++) {
      var placed = false;
      if (allPl.length && rnd() < 0.6) {
        var P1 = allPl[ri(0, allPl.length - 1)], cc = platCell(P1, false);
        if (cc != null) { put({ k: 'coal', c: cc, r: P1.p }); placed = true; }
      }
      if (!placed) { var cx2 = floorSpot(ri(3, 16), false); if (cx2 != null) put({ k: 'coal', c: cx2, r: f[cx2] }); }
    }
    plats.forEach(function (P) { if (rnd() < 0.3) { var gc = platCell(P, false); if (gc != null) put({ k: 'gear', c: gc, r: P.p }); } });
    items.forEach(function (it, n) { it.id = rm.i + ':' + n; });

    // 12) обитатели: сажники (летают) и окалыши (ползают по полу)
    var en = [], ne = 0, hv = hsh(rm.x, rm.y, 6);
    if (calm) ne = 0;
    else if (z === 0) ne = hv < 0.45 ? 1 : 0;
    else if (z === 5) ne = 1 + (hv < 0.5 ? 1 : 0);
    else ne = 1 + (hv < 0.25 ? 1 : 0);
    var segs = [];
    for (x = 3; x < COLS - 3; x++) {
      var okc = function (xx) { var q = t[I(xx, f[x])]; return f[xx] === f[x] && (q === R || isBelt(q)) && !lane[xx] && standAt(xx, f[x]); };
      if (!okc(x)) continue;
      var e3 = x; while (e3 + 1 < COLS - 3 && okc(e3 + 1)) e3++;
      if (e3 - x + 1 >= 4) segs.push({ s: x, e: e3, y: f[x] });
      x = e3;
    }
    var fmin = 99; for (x = 3; x < COLS - 3; x++) fmin = Math.min(fmin, f[x]);
    // полоса полёта не задевает того, кто просто стоит (на полу, балке, верху лестницы) — опасна прыжкам и лазанию
    function laneOK(xa, xb, ya, yb) {
      for (var xx = Math.max(0, Math.floor(xa - 0.75)); xx <= Math.min(COLS - 1, Math.floor(xb + 0.75)); xx++)
        for (var r = 3; r < ROWS; r++) {
          var q = t[I(xx, r)], sup = q === R || q === PF || isBelt(q) || (q === LD && t[I(xx, r - 1)] !== LD);
          if (sup && t[I(xx, r - 1)] !== R && r - HH - 0.05 < yb + 0.42 && ya - 0.42 < r) return false;
        }
      return true;
    }
    for (k = 0; k < ne; k++) {
      if (segs.length && rnd() < 0.45) {
        var sg = segs.splice(ri(0, segs.length - 1), 1)[0];
        en.push({ type: 'crawler', x0: sg.s + 0.5, x1: sg.e + 0.5, y: sg.y, v: 1.3 + z * 0.15, ph: rnd() * 10 });
        continue;
      }
      var vert = vcols.length && rnd() < 0.3 && !(c.L && c.R), placedF = false;
      if (vert) {
        var vc0 = vcols[0].col, mx = clamp(vc0 > 9 ? vc0 - 3 : vc0 + 4, 3, 15), vy1 = f[mx] - 2.2;
        while (vy1 > 3.5 && !laneOK(mx - 0.2, mx + 1.2, 2.5, vy1)) vy1 -= 0.25;
        if (vy1 > 3.5) { en.push({ type: 'flyer', mode: 'v', x0: mx + 0.5, y0: 2.5, y1: vy1, v: 1.6 + z * 0.15, ph: rnd() * 6 }); placedF = true; }
      }
      if (!placedF) {
        var want = clamp(fmin - 3.7 - rnd() * 1.1, 2.4, 8), mx0 = ri(3, 7), mx1 = ri(12, 16);
        for (var shrink = 0; shrink <= 4 && !placedF && mx1 - mx0 - 2 * shrink >= 3; shrink += 2) {
          for (var d2 = 0; d2 <= 40 && !placedF; d2++) {
            var my = want + (d2 % 2 ? 1 : -1) * Math.ceil(d2 / 2) * 0.1;
            if (my < 2.3 || my > ROWS - 2) continue;
            if (laneOK(mx0 + shrink, mx1 - shrink, my - 0.6, my + 0.6)) {
              en.push({ type: 'flyer', mode: 'h', x0: mx0 + shrink + 0.5, x1: mx1 - shrink + 0.5, y0: my, v: 1.9 + z * 0.2, ph: rnd() * 6 }); placedF = true;
            }
          }
        }
      }
    }
    rm.t = t; rm.g = g; rm.items = items; rm.plats = plats; rm.rope = rope;
    rm.hz = { presses: presses, drips: drips, carts: carts, belts: belts, pits: pits, enemies: en };
    rm.coal = items.filter(function (it) { return it.k === 'coal'; }).length;
  }

  // ---------- Мир (кэш: строится один раз) ----------
  var WORLD = null;
  function buildWorld() {
    var P = parse();
    var W = { rooms: P.rooms, at: P.at };
    W.rooms.forEach(function (rm) { buildRoom(W, rm); });
    W.coal = []; W.keys = []; W.start = null; W.forge = null; W.beacons = []; W.helmets = [];
    W.rooms.forEach(function (rm) {
      rm.items.forEach(function (it) {
        var node = rm.i * NK + it.r * COLS + it.c;
        if (it.k === 'coal') W.coal.push({ room: rm.i, c: it.c, r: it.r, node: node, id: it.id });
        if (it.k === 'key') W.keys.push({ key: it.key, room: rm.i, c: it.c, r: it.r, node: node, id: it.id });
        if (it.k === 'helmet') W.helmets.push({ room: rm.i, node: node, id: it.id });
        if (it.k === 'forge') W.forge = { room: rm.i, c: it.c, r: it.r, node: node };
        if (it.k === 'beacon') {
          W.beacons.push({ room: rm.i, c: it.c, r: it.r, node: node });
          if (rm.kind === 'S') { var sc = it.c - 2; W.start = { room: rm.i, c: sc, r: rm.f[sc], node: rm.i * NK + rm.f[sc] * COLS + sc }; }
        }
      });
    });
    W.keys.sort(function (a, b) { return a.key - b.key; });
    W.totalCoal = W.coal.length;
    // двери/заслонка рядом с экраном (для кэша графа)
    W.rooms.forEach(function (rm) {
      var near = {}, gate = false;
      [rm].concat(['L', 'R', 'U', 'D'].map(function (d) { return rm.c[d] ? W.rooms[rm.c[d].to] : null; })).forEach(function (q) {
        if (!q) return; for (var i = 0; i < NK; i++) { if (q.t[i] === DR) near[q.g[i]] = 1; if (q.t[i] === GT) gate = true; }
      });
      rm.near = Object.keys(near).map(Number).sort(); rm.nearGate = gate;
    });
    return W;
  }
  function world() { return WORLD || (WORLD = buildWorld()); }

  // ---------- Клетки с учётом состояния (ключи / заслонка) ----------
  // За краем экрана повторяется крайняя клетка — так дверь и лестница «продолжаются» в соседа.
  function tileAt(st, rm, cx, cy) {
    if (cx < 0) cx = 0; else if (cx >= COLS) cx = COLS - 1;
    if (cy < 0) cy = 0; else if (cy >= ROWS) cy = ROWS - 1;
    var i = cy * COLS + cx, k = rm.t[i];
    if (k === DR && st.keys[rm.g[i]]) return E;
    if (k === GT && st.gate) return E;
    return k;
  }
  function isStand(st, rm, c, r) {
    if (c < 0 || c >= COLS || r < 2 || r >= ROWS) return false;
    var k = tileAt(st, rm, c, r);
    var sup = (isSolid(k) && k !== SP) || k === PF || (k === LD && tileAt(st, rm, c, r - 1) !== LD);
    return sup && !isSolid(tileAt(st, rm, c, r - 1)) && !isSolid(tileAt(st, rm, c, r - 2));
  }
  function ladderAt(st, rm, H) { var col = Math.floor(H.x); return tileAt(st, rm, col, Math.floor(H.y - 0.3)) === LD && Math.abs(H.x - col - 0.5) < 0.42; }

  // ---------- Физика героя (общая для игры, графа и бота) ----------
  function newHero(W, room, x, y) {
    return { room: room, x: x, y: y, vx: 0, vy: 0, ground: true, climb: false, face: 1, coy: 0, inv: 0, belt: 0,
      jumpHeld: false, apex: W.rooms[room].y * ROWS + y, walkT: 0 };
  }
  function heroStep(W, st, H, inp, dt) {
    var ev = { land: -1, fatal: null, room: null, jump: false, climbTop: false };
    var rm = W.rooms[H.room], dx = inp.dx || 0, dy = inp.dy || 0;
    var jumpEdge = !!inp.jump && !H.jumpHeld; H.jumpHeld = !!inp.jump;
    if (dx) H.face = dx > 0 ? 1 : -1;
    var col = Math.floor(H.x), c, r;
    var sol = function (cx, cy) { return isSolid(tileAt(st, rm, cx, cy)); };
    if (!H.climb) {
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
      H.vx = dx * RUN + (H.ground ? H.belt * BELT : 0);
      if (H.ground) H.coy = COYOTE; else H.coy -= dt;
      if (jumpEdge && H.coy > 0) { H.vy = -JUMP_V; H.ground = false; H.coy = 0; ev.jump = true; }
      if (!inp.jump && H.vy < -JUMP_CUT) H.vy = -JUMP_CUT;
      H.vy = Math.min(VMAX, H.vy + GRAV * dt);
      var nx = H.x + H.vx * dt, top = Math.floor(H.y - HH + 0.001), bot = Math.floor(H.y - 0.001), cc;
      if (H.vx > 0) { cc = Math.floor(nx + HW); for (r = top; r <= bot; r++) if (sol(cc, r)) { nx = cc - HW - 0.0001; break; } }
      else if (H.vx < 0) { cc = Math.floor(nx - HW); for (r = top; r <= bot; r++) if (sol(cc, r)) { nx = cc + 1 + HW + 0.0001; break; } }
      H.x = nx;
      var ny = H.y + H.vy * dt, c0 = Math.floor(H.x - HW), c1 = Math.floor(H.x + HW - 0.0001);
      H.ground = false;
      if (H.vy >= 0) {
        var rr = Math.floor(ny), landed = false, spikes = true;
        for (c = c0; c <= c1; c++) {
          var tt = tileAt(st, rm, c, rr);
          if (isSolid(tt) || ((tt === PF || (tt === LD && tileAt(st, rm, c, rr - 1) !== LD)) && H.y <= rr + 0.0001)) { landed = true; if (tt !== SP) spikes = false; }
        }
        if (landed) { ny = rr; H.vy = 0; H.ground = true; if (spikes || tileAt(st, rm, Math.floor(H.x), rr) === SP) ev.fatal = 'spikes'; }
      } else {
        var rh = Math.floor(ny - HH);
        for (c = c0; c <= c1; c++) if (sol(c, rh)) { ny = rh + 1 + HH; H.vy = 0; break; }
      }
      H.y = ny;
      H.walkT = H.ground && dx ? H.walkT + dt : 0;
    }
    // конвейер под ногами (действует со следующего шага)
    H.belt = H.ground ? isBelt(tileAt(st, rm, Math.floor(H.x), Math.round(H.y))) : 0;
    // высота падения → гибель
    var absY = rm.y * ROWS + H.y;
    if (H.ground || H.climb) {
      if (H.ground && !wasGround && !ev.climbTop) { ev.land = absY - H.apex; if (ev.land >= FALL_DIE && !ev.fatal) ev.fatal = 'fall'; }
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

  // ---------- Ловушки и обитатели: чистые функции времени ----------
  // «маятник» между a и b со скоростью v и стоянками stop на концах
  function swing(t, a, b, v, stop, ph) {
    var Ln = Math.max(0.001, b - a), tr = Ln / v, per = 2 * (tr + stop), u = ((t + ph) % per + per) % per;
    if (u < stop) return { x: a, dir: 1, moving: false };
    u -= stop; if (u < tr) return { x: a + v * u, dir: 1, moving: true };
    u -= tr; if (u < stop) return { x: b, dir: -1, moving: false };
    u -= stop; return { x: b - v * u, dir: -1, moving: true };
  }
  function enemyAt(e, t) {
    if (e.type === 'crawler') { var p = swing(t, e.x0, e.x1, e.v, 0.35, e.ph); return { x: p.x, y: e.y, dir: p.dir }; }
    if (e.mode === 'v') { var q = swing(t, e.y0, e.y1, e.v, 0.2, e.ph); return { x: e.x0 + Math.sin(t * 1.7 + e.ph) * 0.7, y: q.x, dir: Math.cos(t * 1.7 + e.ph) > 0 ? 1 : -1 }; }
    var h = swing(t, e.x0, e.x1, e.v, 0.1, e.ph);
    return { x: h.x, y: e.y0 + Math.sin(t * 2.2 + e.ph) * 0.6, dir: h.dir };
  }
  function cartAt(cr, t) { return swing(t, cr.x0, cr.x1, cr.v, cr.stop, cr.ph); }
  // пресс: ожидание наверху → дрожь-предупреждение → удар → стоит внизу → подъём. bottom — нижняя кромка (в клетках)
  var PR_WARN = 0.5, PR_SLAM = 0.12, PR_HOLD = 0.45, PR_RISE = 0.55;
  function pressAt(p, t) {
    var u = ((t + p.ph) % p.per + p.per) % p.per, wait = p.per - PR_WARN - PR_SLAM - PR_HOLD - PR_RISE, up = p.top + 1.15, dn = p.bot;
    if (u < wait) return { bottom: up, st: 'up', k: u / wait };
    u -= wait; if (u < PR_WARN) return { bottom: up + 0.12, st: 'warn', k: u / PR_WARN };
    u -= PR_WARN; if (u < PR_SLAM) return { bottom: up + (dn - up) * (u / PR_SLAM), st: 'slam', k: u / PR_SLAM };
    u -= PR_SLAM; if (u < PR_HOLD) return { bottom: dn, st: 'down', k: u / PR_HOLD };
    u -= PR_HOLD; return { bottom: dn - (dn - up) * (u / PR_RISE), st: 'rise', k: u / PR_RISE };
  }
  // капля: набухает у потолка → падает с ускорением → брызги на полу
  var DR_FORM = 0.7, DR_G = 30;
  function dripAt(d, t) {
    var u = ((t + d.ph) % d.per + d.per) % d.per;
    if (u < DR_FORM) return { y: d.y0 + 0.15 + u / DR_FORM * 0.2, st: 'form', k: u / DR_FORM };
    u -= DR_FORM; var y = d.y0 + 0.35 + 0.5 * DR_G * u * u;
    if (y < d.y1) return { y: y, st: 'fall', k: 0 };
    var tf = Math.sqrt(2 * (d.y1 - d.y0 - 0.35) / DR_G);
    return { y: d.y1, st: 'splash', k: Math.min(1, (u - tf) / 0.3) };
  }
  // опасные области экрана в момент t: [{x0,x1,y0,y1,why,src}]
  function hazards(rm, t) {
    var out = [], hz = rm.hz;
    hz.presses.forEach(function (p) { var s = pressAt(p, t); out.push({ x0: p.x + 0.05, x1: p.x + 1.95, y0: p.top, y1: s.bottom, why: 'press', src: p }); });
    hz.drips.forEach(function (d) { var s = dripAt(d, t); if (s.st === 'fall') out.push({ x0: d.x + 0.33, x1: d.x + 0.67, y0: s.y - 0.4, y1: s.y, why: 'drip', src: d }); });
    hz.carts.forEach(function (cr) { var s = cartAt(cr, t); out.push({ x0: s.x - 0.66, x1: s.x + 0.66, y0: cr.y - 1.0, y1: cr.y, why: 'cart', src: cr }); });
    hz.enemies.forEach(function (e) {
      var p = enemyAt(e, t);
      if (e.type === 'crawler') out.push({ x0: p.x - 0.42, x1: p.x + 0.42, y0: p.y - 0.55, y1: p.y, why: 'crawler', src: e });
      else out.push({ x0: p.x - 0.38, x1: p.x + 0.38, y0: p.y - 0.32, y1: p.y + 0.32, why: 'flyer', src: e });
    });
    return out;
  }
  function heroBox(H) { return { x0: H.x - HW + 0.06, x1: H.x + HW - 0.06, y0: H.y - HH + 0.1, y1: H.y - 0.04 }; }
  function overlap(a, b) { return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1; }

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
      if (reached && H.ground) return 'ok';
      if (t > 0.6 && !reached && H.ground && !m.left) return 'fail';
      return t > 4 ? 'fail' : null;
    }
    if (a.k === 'jump') { if (m.left && H.ground && t >= a.delay + a.hold) return 'ok'; return t > 4 ? 'fail' : null; }
    if (a.k === 'up' || a.k === 'down') {
      if (t > 0.1 && !m.climbed) return 'fail';
      if (m.climbed && !H.climb && H.ground) return 'ok';
      if (m.climbed && !H.climb && !H.ground) return 'fail';
      return t > 9 ? 'fail' : null;
    }
    return 'fail';
  }

  // ---------- Граф проходимости: узлы — «стою в клетке», рёбра — симуляция действий ----------
  // Ловушки по такту и обитатели в графе не учитываются (их обходят временем), обрывы и смертельные падения — учитываются.
  function Nav(W) {
    W = W || world();
    var cache = new Map();
    function rkey(st, ri) {
      var rm = W.rooms[ri], s = String(ri);
      for (var i = 0; i < rm.near.length; i++) s += st.keys[rm.near[i]] ? '1' : '0';
      if (rm.nearGate) s += st.gate ? 'G' : 'g';
      return s;
    }
    function sim(st, ri, c, r, a) {
      var H = newHero(W, ri, c + 0.5, r), m = { X0: W.rooms[ri].x * COLS + c + 0.5, left: false, climbed: false }, t = 0, dt = 1 / 60, touched = null, res = null;
      for (var n = 0; n < 600; n++) {
        var ev = heroStep(W, st, H, drive(W, a, t, H, m.X0), dt); t += dt;
        if (ev.fatal) return null;
        // через какие двери (ключ) и заслонку (−1) проходит тело (в базовом мире они твёрдые)
        var rm = W.rooms[H.room], x0 = Math.floor(H.x - HW), x1 = Math.floor(H.x + HW - 0.0001), y0 = Math.floor(H.y - HH), y1 = Math.floor(H.y - 0.001);
        for (var yy = Math.max(0, y0); yy <= Math.min(ROWS - 1, y1); yy++) for (var xx = Math.max(0, x0); xx <= Math.min(COLS - 1, x1); xx++) {
          var q = rm.t[yy * COLS + xx];
          if (q === DR || q === GT) { touched = touched || []; var gq = q === GT ? -1 : rm.g[yy * COLS + xx]; if (touched.indexOf(gq) < 0) touched.push(gq); }
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
    // Полный разбор: ключи открывают двери, весь уголь — заслонку Горна
    function solve() {
      var st = { keys: {}, gate: false }, R0 = null, order = [];
      for (var it = 0; it < 20; it++) {
        R0 = reach(st, W.start.node);
        var added = false;
        W.keys.forEach(function (kq) { if (!st.keys[kq.key] && R0.has(kq.node)) { st.keys[kq.key] = true; order.push(kq.key); added = true; } });
        var allC = W.coal.every(function (cq) { return R0.has(cq.node); });
        if (allC && !st.gate) { st.gate = true; added = true; }
        if (!added) break;
      }
      return { st: st, reach: R0, keyOrder: order, coal: W.coal.filter(function (cq) { return R0.has(cq.node); }).length, forge: R0.has(W.forge.node) };
    }
    return { room: room, edges: edges, reach: reach, solve: solve, sim: sim, W: W };
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var W = opts.world || world(), emit = opts.onEvent || function () {};
    var safe = !!opts.safe;   // safe — только для тестов: ловушки и обитатели не убивают
    var S = {
      phase: 'play', phaseT: 0, time: 0, score: 0, lives: opts.lives || LIVES, over: false, won: false,
      room: W.start.room, hero: newHero(W, W.start.room, W.start.c + 0.5, W.start.r),
      keys: {}, gate: false, got: {}, coal: 0, total: W.totalCoal, visited: {}, helmet: 0,
      cp: { room: W.start.room, x: W.start.c + 0.5, y: W.start.r, id: null }, beaconSeen: {},
      deaths: 0, why: {}, nextLife: LIFE_EVERY, inp: { dx: 0, dy: 0, jump: false }, upLock: false, finalBonus: 0, roomsClear: 0
    };
    function addScore(p) {
      S.score += p;
      while (S.score >= S.nextLife) { S.nextLife += LIFE_EVERY; S.lives++; emit('life', { lives: S.lives }); }
    }
    function enterRoom(ri) {
      S.room = ri; S.visited[ri] = true;
      emit('room', { room: ri, zone: W.rooms[ri].zone });
    }
    function start() { enterRoom(S.room); return api; }
    function setInput(dx, dy, jump) { S.inp.dx = dx || 0; S.inp.dy = dy || 0; S.inp.jump = !!jump; }
    function die(why) {
      if (S.phase !== 'play') return;
      S.phase = 'dead'; S.phaseT = DEAD_T; S.lives--; S.deaths++; S.why[why] = (S.why[why] || 0) + 1; S.helmet = 0;
      emit('die', { why: why, lives: S.lives, x: S.hero.x, y: S.hero.y - 0.7 });
    }
    function respawn() {
      if (S.lives <= 0) { S.over = true; S.phase = 'over'; emit('gameover', { score: S.score }); return; }
      S.hero = newHero(W, S.cp.room, S.cp.x, S.cp.y); S.hero.inv = SPAWN_INV;
      S.phase = 'play'; enterRoom(S.cp.room);
      emit('respawn', { room: S.cp.room });
    }
    function canClimbHere() { var H = S.hero; return H.climb || ladderAt(S, W.rooms[S.room], H); }
    function roomLeft(rm) { var n = 0; rm.items.forEach(function (it) { if (it.k === 'coal' && !S.got[it.id]) n++; }); return n; }
    function items() {
      var rm = W.rooms[S.room], H = S.hero;
      rm.items.forEach(function (it) {
        var ix = it.c + 0.5, iy = it.r - 0.5;
        if (Math.abs(ix - H.x) > 0.75 || iy < H.y - HH - 0.4 || iy > H.y + 0.4) return;
        if (it.k === 'beacon') {
          if (S.cp.id !== it.id) {
            S.cp = { room: S.room, x: ix, y: it.r, id: it.id };
            var first = !S.beaconSeen[it.id] && rm.kind !== 'S'; S.beaconSeen[it.id] = true;
            if (first) addScore(PTS.beacon);
            emit('beacon', { x: ix, y: iy, first: first });
          }
          return;
        }
        if (S.got[it.id]) return;
        if (it.k === 'forge') { if (S.gate) winGame(); return; }
        S.got[it.id] = true;
        if (it.k === 'coal') {
          S.coal++; addScore(PTS.coal);
          var left = roomLeft(rm);
          emit('coal', { n: S.coal, total: S.total, x: ix, y: iy, left: left });
          if (!left) { S.roomsClear++; addScore(PTS.room); emit('roomClear', { x: ix, y: iy, pts: PTS.room }); }
          if (S.coal >= S.total && !S.gate) { S.gate = true; emit('gateOpen', {}); }
        } else if (it.k === 'key') { S.keys[it.key] = true; addScore(PTS.key); emit('key', { key: it.key, x: ix, y: iy }); }
        else if (it.k === 'helmet') { S.helmet = HELMET_T; addScore(PTS.helmet); emit('helmet', { x: ix, y: iy }); }
        else if (it.k === 'gear') { addScore(PTS.gear); emit('gear', { x: ix, y: iy, pts: PTS.gear }); }
      });
    }
    function winGame() {
      S.won = true; S.phase = 'won';
      var bonus = PTS.forge + S.lives * 1000 + Math.max(0, Math.round((1500 - S.time) * 5));
      S.finalBonus = bonus; S.score += bonus;
      emit('win', { time: S.time, score: S.score, bonus: bonus });
    }
    function update(dt) {
      if (S.over || S.won) return;
      var t0 = S.time;
      S.time += dt;
      if (S.phase === 'dead') { S.phaseT -= dt; if (S.phaseT <= 0) respawn(); return; }
      var H = S.hero, inp = S.inp;
      // «вверх» без лестницы рядом — прыжок (не повторяется, пока «вверх» зажат после подъёма)
      if (inp.dy >= 0) S.upLock = false;
      var jump = inp.jump || (inp.dy < 0 && !canClimbHere() && !S.upLock);
      if (H.inv > 0) H.inv -= dt;
      if (S.helmet > 0) { S.helmet -= dt; if (S.helmet <= 0) { S.helmet = 0; emit('helmetEnd', {}); } }
      var prevRoom = H.room;
      var ev = heroStep(W, S, H, { dx: inp.dx, dy: inp.dy, jump: jump }, dt);
      if (ev.climbTop) S.upLock = true;
      if (ev.jump) emit('jump', {});
      if (H.room !== prevRoom) enterRoom(H.room);
      if (ev.fatal) { die(ev.fatal); return; }
      if (ev.land >= THUD_FALL) emit('thud', { fall: ev.land });
      var rm = W.rooms[S.room];
      // удары прессов (звук) — переход в фазу удара
      rm.hz.presses.forEach(function (p) { if (pressAt(p, S.time).st === 'down' && pressAt(p, t0).st !== 'down') emit('slam', { x: p.x + 1, y: p.bot }); });
      rm.hz.drips.forEach(function (d) { if (dripAt(d, S.time).st === 'splash' && dripAt(d, t0).st !== 'splash') emit('splash', { x: d.x + 0.5, y: d.y1, near: Math.abs(d.x + 0.5 - H.x) < 6 }); });
      if (!safe && H.inv <= 0 && S.helmet <= 0) {
        var hb = heroBox(H), hz = hazards(rm, S.time);
        for (var i = 0; i < hz.length; i++) if (overlap(hb, hz[i])) { die(hz[i].why); return; }
      }
      items();
    }
    var api = {
      start: start, update: update, setInput: setInput, state: function () { return S; },
      canClimb: canClimbHere, world: W, roomLeft: roomLeft, _S: S,
      _die: die, _enter: enterRoom,
      _place: function (ri, c, r) { S.hero = newHero(W, ri, c + 0.5, r); enterRoom(ri); },
      _giveKey: function (k) { S.keys[k] = true; },
      _giveCoal: function (n) { for (var k = 0; k < W.coal.length && n > 0; k++) { var cq = W.coal[k]; if (!S.got[cq.id]) { S.got[cq.id] = true; S.coal++; n--; } } if (S.coal >= S.total) S.gate = true; }
    };
    return api;
  }

  U.logic = {
    COLS: COLS, ROWS: ROWS, WX: WX, WY: WY, NK: NK, E: E, R: R, LD: LD, PF: PF, DR: DR, GT: GT, SP: SP, CL: CL, CR: CR,
    GRAV: GRAV, JUMP_V: JUMP_V, RUN: RUN, CLIMB: CLIMB, HW: HW, HH: HH, FALL_DIE: FALL_DIE, BELT: BELT, LIVES: LIVES, HELMET_T: HELMET_T,
    LIFE_EVERY: LIFE_EVERY, PTS: PTS, ZONES: ZONES, KEYS: KEYS, MAP: MAP, ACTS: ACTS, SPAWN_INV: SPAWN_INV,
    mulberry32: mulberry32, world: world, buildWorld: buildWorld, tileAt: tileAt, isSolid: isSolid, isBelt: isBelt, isStand: isStand,
    heroStep: heroStep, newHero: newHero, drive: drive, finished: finished, absX: absX, Nav: Nav,
    swing: swing, enemyAt: enemyAt, cartAt: cartAt, pressAt: pressAt, dripAt: dripAt, hazards: hazards, heroBox: heroBox, overlap: overlap
  };
  U.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
