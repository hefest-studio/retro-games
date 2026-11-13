/* ДОСПЕХ · уровни: рецепты Окалинных пустошей и сборка карты из рецепта.
   Карта — сетка 16 рядов (ряд 0 — верх), ширина по рецепту. Клетки: E 0 пусто, SOL 1 твердь, ONE 2 мостки (только сверху),
   LAD 3 лестница (верхняя клетка лестницы держит сверху). Пропасти без дна; в «жидких» уровнях на дне — ржа/расплав.
   Токены рецепта (каждый пристраивает участок справа; gy — ряд поверхности земли, 6..13):
     S — старт (6 клеток) · fN — ровно N · uN/dN — ступень вверх (N ≤ 2)/вниз на N и 2 клетки ровно · pN — пропасть N (≤ 3)
     tH — кованая тумба высотой H (1..2), ширина 2 · o:H:N — мостки на высоте H над землёй длиной N (под ними ровно)
     LH — утёс вверх на H с лестницей · mN — пропасть N (≥ 7) с ходящим плотом (зазор 1 у каждого берега)
     vH — шахта-подъёмник вверх на H (3 клетки) · c — середина уровня (отметка) · k[:что] — сундук (arm, gold, spear, axe, torch, blades, shield, trap)
     e:тип[:dx[:dy]] — засада (vent, brute, kite) · B:босс — арена 26 клеток со стеной справа. */
(function (global) {
  'use strict';
  var D = global.DOSPEH = global.DOSPEH || {};
  var R = 16, E = 0, SOL = 1, ONE = 2, LAD = 3;

  // theme — палитра (render.js), liquid — что на дне пропастей, rise — интервал появления окалышей (с), boss — страж в конце
  D.LEVELS = [
    { key: 'wastes', liquid: null, rise: 3.0, boss: 'golem', bhp: 14,
      r: 'S f6 k:arm f5 t1 f5 e:vent:2 f7 p2 f6 u1 f4 o:2:5 f3 k:axe f4 d1 f4 e:kite:3 f3 t2 f5 p2 f5 e:kite:4 f8 L3 f5 c f8 d3 f6 k:gold f6 p3 f5 e:brute:4 f8 u2 f6 e:kite:3 f5 p2 f4 e:vent:4 f2 t1 f5 e:brute:3 f7 d2 f8 B:golem' },
    { key: 'river', liquid: 'rust', rise: 3.6, boss: 'crab', bhp: 14,
      r: 'S f5 k:arm f5 p2 f4 e:vent:2 f5 m8 f5 t1 f4 p3 f5 e:kite:4 f6 u1 f4 k:blades f5 m9 f6 c f7 p2 f3 p2 f5 e:brute:4 f6 d1 f4 k:gold f4 m8 f5 e:kite:2 f6 p3 f4 u2 f5 e:vent:3 f6 p2 f7 B:crab' },
    { key: 'hills', liquid: null, rise: 3.8, boss: 'serpent', bhp: 10,
      r: 'S f5 k:arm f6 L3 f4 e:kite:3 f6 d2 f4 p2 f5 v4 f5 k:torch f5 e:brute:4 f6 d3 f6 c f7 e:brute:4 f6 L3 f5 o:2:6 f2 k:gold f4 p3 f4 e:kite:2 f6 d2 f5 v4 f6 e:kite:3 f6 d3 f8 B:serpent' },
    { key: 'cave', liquid: 'lava', rise: 3.6, boss: 'golem', bhp: 14,
      r: 'S f5 k:arm f5 t2 f5 p3 f5 e:brute:3 f5 v4 f5 e:brute:3 f6 d2 f4 p2 f4 k:shield f5 m8 f6 c f8 e:kite:3 f6 t1 f4 p3 f5 L3 f5 k:gold f5 e:vent:3 f6 d3 f5 m9 f5 e:brute:4 f7 B:golem' },
    { key: 'bridge', liquid: null, rise: 3.8, boss: 'crab', bhp: 18,
      r: 'S f5 k:arm f4 p3 f3 p2 f4 e:kite:3 f5 m8 f4 p3 f4 e:kite:2 f5 t1 f4 k:axe f5 p3 f3 c f7 e:brute:4 f5 m9 f4 p2 f3 p3 f4 e:kite:3 f5 k:gold f5 p2 f4 e:kite:2 f6 m8 f5 e:vent:3 f7 B:crab' },
    { key: 'tower', liquid: null, rise: 3.6, boss: 'serpent', bhp: 14,
      r: 'S f5 k:arm f5 L3 f4 e:vent:3 f5 v4 f4 e:kite:2 f6 d3 f4 k:blades f5 p3 f4 e:brute:3 f6 c f7 L3 f5 e:kite:3 f6 d4 f4 L3 f5 o:2:6 f3 k:gold f5 d2 f4 v3 f5 e:vent:3 f6 p3 f5 e:kite:2 f6 d3 f8 B:serpent' },
    { key: 'forge', liquid: 'lava', rise: 3.0, boss: 'koshey', bhp: 30, final: true,
      r: 'S f6 k:arm f5 p2 f5 e:kite:3 f6 t2 f5 c f6 k:gold f6 e:vent:3 f6 p3 f6 B:koshey' }
  ];
  D.TILES = { E: E, SOL: SOL, ONE: ONE, LAD: LAD, R: R };

  function build(i) {
    var def = D.LEVELS[i];
    if (!def) throw new Error('нет уровня ' + i);
    var cols = [], gy = 13, x = 0;
    var plats = [], spawns = [], chests = [], cps = [], start = null, arena = null, pits = [];
    function col(h, fill) { var c = new Uint8Array(R); if (h != null) for (var r = h; r < R; r++) c[r] = SOL; if (fill) fill(c); cols.push(c); x++; return c; }
    function flat(n) { for (var k = 0; k < n; k++) col(gy); }
    function pit(n, quiet) { for (var k = 0; k < n; k++) { if (!quiet) pits.push(x); col(null); } }
    var toks = def.r.trim().split(/\s+/);
    toks.forEach(function (tk) {
      var m;
      if (tk === 'S') { start = { x: x + 3.5, y: gy }; flat(6); }
      else if ((m = /^f(\d+)$/.exec(tk))) flat(+m[1]);
      else if ((m = /^u(\d)$/.exec(tk))) { if (+m[1] > 2) throw new Error(def.key + ': ступень выше 2'); gy -= +m[1]; flat(2); }
      else if ((m = /^d(\d)$/.exec(tk))) { gy += +m[1]; if (gy > 13) throw new Error(def.key + ': земля ниже 13'); flat(2); }
      else if ((m = /^p(\d)$/.exec(tk))) { if (+m[1] > 3) throw new Error(def.key + ': пропасть шире 3'); pit(+m[1]); }
      else if ((m = /^t(\d)$/.exec(tk))) { var h = +m[1]; for (var k = 0; k < 2; k++) col(gy - h); }
      else if ((m = /^o:(\d):(\d+)$/.exec(tk))) { var oh = +m[1], on = +m[2]; for (var q = 0; q < on; q++) col(gy, function (c) { c[gy - oh] = ONE; }); }
      else if ((m = /^L(\d)$/.exec(tk))) {
        var lh = +m[1]; col(gy, function (c) { for (var r = gy - lh; r < gy; r++) c[r] = LAD; });
        gy -= lh; flat(2);
      }
      else if ((m = /^m(\d+)$/.exec(tk))) {
        var mn = +m[1]; if (mn < 7) throw new Error(def.key + ': плот над пропастью короче 7');
        plats.push({ kind: 'h', x0: x + 1, x1: x + mn - 4, y0: gy, y1: gy, w: 3, sp: 2.2, dwell: 1.7 });
        pit(mn, true);
      }
      else if ((m = /^v(\d)$/.exec(tk))) {
        var vh = +m[1]; plats.push({ kind: 'v', x0: x, x1: x, y0: gy, y1: gy - vh, w: 3, sp: 1.8, dwell: 1.1 });
        pit(3, true); gy -= vh; flat(2);
      }
      else if (tk === 'c') cps.push({ x: x + 0.5, y: gy });
      else if ((m = /^k(?::(\w+))?$/.exec(tk))) chests.push({ x: x + 0.5, y: gy, c: m[1] || 'arm' });
      else if ((m = /^e:(\w+)(?::(-?\d+))?(?::(-?\d+))?$/.exec(tk))) spawns.push({ type: m[1], x: x + (+m[2] || 0) + 0.5, y: gy - (+m[3] || 0) });
      else if ((m = /^B:(\w+)$/.exec(tk))) {
        flat(2); arena = { x0: x, x1: x + 25, y: gy, boss: m[1] }; flat(25);
        col(0);   // стена
      }
      else throw new Error(def.key + ': неизвестный токен ' + tk);
      if (gy < 5 || gy > 13) throw new Error(def.key + ': высота земли вне 5..13 у ' + tk);
    });
    if (!start || !arena) throw new Error(def.key + ': нет старта или арены');
    var W = cols.length, t = new Uint8Array(W * R);
    for (var c = 0; c < W; c++) for (var r = 0; r < R; r++) t[r * W + c] = cols[c][r];
    return { idx: i, key: def.key, def: def, W: W, R: R, t: t, plats: plats, spawns: spawns, chests: chests, cps: cps, start: start, arena: arena,
      pits: pits, liquid: def.liquid, rise: def.rise, final: !!def.final };
  }
  D.build = build;
})(typeof window !== 'undefined' ? window : globalThis);
