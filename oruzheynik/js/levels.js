/* ОРУЖЕЙНИК · уровни. Этапы собираются детерминированно из «рецептов» — строк токенов (см. CONTRACT.md):
   каждый токен — участок карты (ровный пол, ступень, пропасть, шипы, тоннель для подката, мигающие блоки,
   платформа над пропастью, комната мини-босса, арена босса). Высота карты — 14 клеток, ширина — по рецепту.
   Сборщик гарантирует размеры прыжков под физику героя (≤ 3 клеток пропасти, ступени ≤ 2), а тест
   tests/engine.test.mjs проверяет проходимость графом по настоящей физике. */
(function (global) {
  'use strict';
  var OZ = global.ORUZH = global.ORUZH || {};
  var R = 14, E = 0, SOL = 1, SPK = 2, BLK = 3, GATE = 5;

  // 8 этапов-мастерских (порядок = порядок боссов и их оружия) + 3 этапа крепости Чёрная Домна (на третьем — повторные бои с восемью Мастерами и Шагающая Домна с Сердцем).
  var STAGES = [
    { key: 'hammer', boss: 'hammer', mini: 'golem', theme: 0, bpm: 138,
      r: 'S f2 e:crawler:-1 f2 p2 f4 e:crawler:-2 u1 f4 s2 f3 e:hopper:-1 f2 d1 f3 p3 f4 e:flyer:-2:-3 w2 f3 o7 i:hp8:-5:-3 f4 e:crawler:-2 c f2 M:golem f3 u1 f3 s3 f3 e:hopper:-2 f2 q7 f3 e:turret:-1 d1 f3 p2 f2 u1 f3 e:flyer:-1:-3 f3 d1 f2 X' },
    { key: 'gear', boss: 'gear', mini: 'valve', theme: 1, bpm: 132,
      r: 'S f4 e:crawler:-1 f2 t4 f4 e:turret:-1 f2 p2 f3 u1 f3 e:hopper:-1 f2 t6 f3 s2 f4 e:flyer:-2:-3 d1 f4 o7 f3 c f2 M:valve f3 e:crawler:-1 f2 t5 f3 p3 f3 u2 f3 e:turret:-1 f2 s3 f3 d2 f2 e:hopper:-1 f1 t4 f4 i:tank:-2 f2 X' },
    { key: 'magnet', boss: 'magnet', mini: 'drone', theme: 2, bpm: 144,
      r: 'S f4 e:flyer:-1:-3 f2 p2 f4 e:crawler:-4 b3 f9 e:turret:-1 f3 s2 f4 u1 f3 e:hopper:-2 f2 b4 f3 c f2 M:drone f3 e:flyer:-1:-3 f3 p3 f3 q7 f3 e:crawler:-3 f2 b3 f4 d1 f3 e:turret:-1 f2 X' },
    { key: 'fan', boss: 'fan', mini: 'golem', theme: 3, bpm: 126,
      r: 'S f3 e:flyer:-1:-3 f2 p3 f3 u1 f3 p2 f3 e:hopper:-2 d1 f4 e:flyer:-2:-2 o7 f3 o7 f3 e:crawler:-2 c f2 M:golem f3 e:flyer:-1:-3 f2 p3 f3 s2 f3 u2 f3 e:turret:-1 f2 p2 f3 d2 f3 e:flyer:-2:-3 q7 f3 i:tank:-2 f2 X' },
    { key: 'frost', boss: 'frost', mini: 'valve', theme: 4, bpm: 120,
      r: 'S f6 p2 f3 e:crawler:-2 f2 e:hopper:-1 f4 b3 f8 e:crawler:-5 u1 f3 p3 f3 d1 f3 e:turret:-1 f2 c f2 M:valve f3 b4 f5 e:crawler:-1 o7 f3 e:hopper:-1 f2 s2 f4 b3 f3 X' },
    { key: 'spring', boss: 'spring', mini: 'golem', theme: 5, bpm: 140,
      r: 'S f4 e:hopper:-1 f2 s2 f4 e:crawler:-2 w2 f3 s3 f3 u1 f3 e:hopper:-1 f2 q7 f3 d1 f3 e:turret:-1 f2 c f2 M:golem f3 e:hopper:-1 f2 s3 f3 w2 f2 e:crawler:-1 t4 f3 s2 f3 u1 f3 e:hopper:-1 f2 q7 f3 d1 f2 i:tank:-1 f2 X' },
    { key: 'volt', boss: 'volt', mini: 'drone', theme: 6, bpm: 150,
      r: 'S f4 e:crawler:-1 f2 t5 f3 s2 f4 e:flyer:-2:-3 u1 f3 t4 f3 e:turret:-1 f2 d1 f3 p3 f3 c f2 M:drone f3 e:hopper:-1 f2 s3 f3 t6 f3 e:crawler:-2 o7 f3 e:flyer:-1:-3 f3 X' },
    { key: 'bell', boss: 'bell', mini: 'valve', theme: 7, bpm: 116,
      r: 'S f4 e:flyer:-1:-3 f2 o7 f3 e:hopper:-1 f4 b3 f3 u1 f3 f4 e:turret:-1 f2 p3 f3 c f2 M:valve f3 e:flyer:-1:-3 f6 b4 f3 d1 f3 q7 f3 e:crawler:-2 o7 f3 i:tank:-2 f2 X' },
    // Чёрная Домна — крепость взбунтовавшегося Сердца Домны
    { key: 'f1', boss: 'ladle', mini: 'golem', theme: 8, bpm: 148, fort: 1,
      r: 'S f4 e:crawler:-1 f2 s2 f3 e:turret:-1 f2 b3 f3 t4 f3 e:hopper:-1 f2 p3 f3 c f2 M:golem f3 q7 f3 e:flyer:-1:-3 f2 b4 f3 e:turret:-1 f2 t5 f3 X' },
    { key: 'f2', boss: 'crane', mini: 'drone', theme: 8, bpm: 148, fort: 2,
      r: 'S f4 e:hopper:-1 f2 o7 f3 e:flyer:-1:-3 f2 s3 f3 u1 f3 b3 f3 d1 f3 e:turret:-1 c f2 M:drone f3 t5 f3 e:crawler:-1 f2 q7 f3 p3 f3 e:hopper:-1 f2 b4 f3 X' },
    { key: 'f3', boss: 'rematch', theme: 9, bpm: 152, fort: 3,
      r: 'S f4 e:turret:-1 f2 s3 f3 b3 f6 t5 f3 e:flyer:-1:-3 f3 e:hopper:-1 f2 o7 f3 i:hp8:-2 f2 X' }
  ];

  function build(idx) {
    var def = STAGES[idx], cols = [], grpCols = [], g = 12;
    var spawns = [], items = [], cps = [], blinks = [], start = null, mini = null, arena = null;
    function col(gr, ceil) {
      var a = new Uint8Array(R), q = new Int8Array(R).fill(-1), r;
      if (gr != null) for (r = gr; r < R; r++) a[r] = SOL;
      if (ceil != null) for (r = 0; r <= ceil; r++) a[r] = SOL;
      cols.push(a); grpCols.push(q); return a;
    }
    function groundOf(c) { var a = cols[c]; if (!a) return g; for (var r = 0; r < R; r++) if (a[r] === SOL || a[r] === BLK) return r; return g; }
    function flat(n) { for (var i = 0; i < n; i++) col(g); }
    var toks = def.r.trim().split(/\s+/);
    toks.forEach(function (tk) {
      var m, n, i, k;
      if (tk === 'S') { flat(5); start = { x: 2.5, y: g }; cps.push({ x: 2.5, y: g }); return; }
      if ((m = /^f(\d+)$/.exec(tk))) { flat(+m[1]); return; }
      if ((m = /^u(\d)$/.exec(tk))) { g = Math.max(7, g - (+m[1])); return; }
      if ((m = /^d(\d)$/.exec(tk))) { g = Math.min(12, g + (+m[1])); return; }
      if ((m = /^p(\d+)$/.exec(tk))) { for (i = 0; i < +m[1]; i++) col(null); return; }
      if ((m = /^s(\d+)$/.exec(tk))) { for (i = 0; i < +m[1]; i++) { var a = col(g + 1); a[g] = SPK; } return; }
      if ((m = /^t(\d+)$/.exec(tk))) { for (i = 0; i < +m[1]; i++) col(g, g - 2); return; }
      if ((m = /^w(\d+)$/.exec(tk))) { for (i = 0; i < +m[1]; i++) col(g - 2); return; }
      if ((m = /^([oq])(\d+)$/.exec(tk))) {
        n = +m[2]; var side = (n - 3) >> 1;
        for (i = 0; i < n; i++) {
          var c2 = m[1] === 'o' ? col(null) : col(g + 1);
          if (m[1] === 'q') c2[g] = SPK;
          if (i >= side && i < side + 3) c2[g - 2] = SOL;
        }
        return;
      }
      if ((m = /^b(\d+)$/.exec(tk))) {
        n = +m[1]; var c0 = cols.length, chain = { c0: c0, g: g, stones: [] };
        col(null); col(null);
        for (k = 0; k < n; k++) {
          var sc = cols.length;
          for (i = 0; i < 2; i++) { var a2 = col(null); a2[g] = BLK; grpCols[grpCols.length - 1][g] = k % 3; }
          chain.stones.push({ c0: sc, c1: sc + 2, r: g, grp: k % 3 });
          col(null); col(null);
        }
        chain.cEnd = cols.length; blinks.push(chain); return;
      }
      if ((m = /^e:(\w+)(?::(-?\d+))?(?::(-?\d+))?$/.exec(tk))) {
        var cc = cols.length + (m[2] != null ? +m[2] : -2), dy = m[3] != null ? +m[3] : 0;
        spawns.push({ type: m[1], x: cc + 0.5, y: groundOf(cc) + dy }); return;
      }
      if ((m = /^i:(\w+)(?::(-?\d+))?(?::(-?\d+))?$/.exec(tk))) {
        var ci = cols.length + (m[2] != null ? +m[2] : -2), dyi = m[3] != null ? +m[3] : 0;
        items.push({ k: m[1], x: ci + 0.5, y: groundOf(ci) + dyi }); return;
      }
      if (tk === 'c') { cps.push({ x: cols.length - 1.5, y: g }); return; }
      if ((m = /^M:(\w+)$/.exec(tk))) {
        var x0 = cols.length; cps.push({ x: x0 - 1.5, y: g });
        col(g, g - 4); flat(16); var ce = col(g, g - 4); for (i = g - 3; i < g; i++) ce[i] = GATE;
        mini = { type: m[1], x0: x0, x1: x0 + 17, g: g }; return;
      }
      if (tk === 'X') {
        while (g < 12) { g++; flat(2); }
        flat(3); cps.push({ x: cols.length - 2.5, y: 12 });
        var ax = cols.length; col(12, 8);
        for (i = 0; i < 24; i++) col(12, 0);
        col(0);
        arena = { x0: ax, x1: ax + 25 }; return;
      }
      throw new Error('levels: неизвестный токен «' + tk + '» в этапе ' + def.key);
    });
    var W = cols.length, t = new Uint8Array(W * R), grp = new Int8Array(W * R).fill(-1);
    for (var c = 0; c < W; c++) for (var r = 0; r < R; r++) { t[r * W + c] = cols[c][r]; grp[r * W + c] = grpCols[c][r]; }
    return { idx: idx, key: def.key, boss: def.boss, theme: def.theme, bpm: def.bpm, fort: def.fort || 0, W: W, R: R, t: t, grp: grp,
      spawns: spawns, items: items, cps: cps, start: start, mini: mini, arena: arena, blinks: blinks };
  }
  var cache = {};
  OZ.STAGES = STAGES;
  OZ.levelTiles = { E: E, SOL: SOL, SPK: SPK, BLK: BLK, GATE: GATE, R: R };
  OZ.buildLevel = build;
  OZ.level = function (i) { return cache[i] || (cache[i] = build(i)); };
})(typeof window !== 'undefined' ? window : globalThis);
