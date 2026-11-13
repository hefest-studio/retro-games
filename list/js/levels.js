/* ЛИСТ · уровни: 3 главы × 2 страницы книги-лубка. Страница — сетка панелей (кадров) с переходами
   «вперёд» (F — через боковую рамку), «вниз» (D — в дыру в полу) и развилками (FD). Панель строится из архетипа
   головоломки в «прямых» координатах (вход слева, выход справа) и при dir = −1 отражается.
   Всё — чистые данные без DOM: общие для игры, рендера и тестов. */
(function (global) {
  'use strict';
  var LIST = global.LIST = global.LIST || {};
  var H = 160, F = 144;                       // высота панели и верх пола (локальные единицы)
  var PAGE_W = 960, PAGE_H = 530;
  function rowY(r) { return 14 + r * 172; }

  // Шаблоны страниц. ex — выходы панели в «прямых» терминах: F — дальняя рамка, D — дыра у дальнего края, FD — развилка.
  var T1 = {
    start: 'a',
    p: { a: { r: 0, x: 14, w: 300, dir: 1, ex: 'F' }, b: { r: 0, x: 326, w: 290, dir: 1, ex: 'FD' }, c: { r: 0, x: 628, w: 318, dir: 1, ex: 'D' },
         f: { r: 1, x: 628, w: 318, dir: -1, ex: 'F' }, e: { r: 1, x: 326, w: 290, dir: -1, ex: 'F' }, d: { r: 1, x: 14, w: 300, dir: -1, ex: 'D' },
         g: { r: 2, x: 14, w: 460, dir: 1, ex: 'F' }, h: { r: 2, x: 486, w: 460, dir: 1, ex: 'F' } },
    to: { a: { F: 'b' }, b: { F: 'c', D: 'e' }, c: { D: 'f' }, f: { F: 'e' }, e: { F: 'd' }, d: { D: 'g' }, g: { F: 'h' }, h: { F: 'END' } }
  };
  var T2 = {
    start: 'a',
    p: { a: { r: 0, x: 14, w: 300, dir: 1, ex: 'FD' }, b: { r: 0, x: 326, w: 290, dir: 1, ex: 'F' }, c: { r: 0, x: 628, w: 318, dir: 1, ex: 'D' },
         d: { r: 1, x: 14, w: 300, dir: 1, ex: 'F' }, e: { r: 1, x: 326, w: 290, dir: 1, ex: 'FD' }, f: { r: 1, x: 628, w: 318, dir: 1, ex: 'D' },
         A: { r: 2, x: 14, w: 460, dir: 1, boss: 'A' }, B: { r: 2, x: 486, w: 460, dir: 1, boss: 'B' } },
    to: { a: { F: 'b', D: 'd' }, b: { F: 'c' }, c: { D: 'f' }, d: { F: 'e' }, e: { F: 'f', D: 'A' }, f: { D: 'B' } }
  };

  // Содержимое: k — архетип (brawl | lever | frame | sketch | steps | blank | wall), en — волны врагов,
  // it — предметы (ink — чернильница, letter — буквица, sheet — запасной лист, scis/flask/mark — в инвентарь), cap — подпись.
  var B = 'blot', G = 'guard', N = 'nib';
  var CHAPTERS = [
    { boss: 'queen', pages: [
      { a: { k: 'brawl', en: [[B, B]], it: ['letter'], cap: 'cap1a' },
        b: { k: 'lever', en: [[B, B]], it: ['ink'], cap: 'cap1b' },
        c: { k: 'frame', en: [[B, G]], it: ['scis'], cap: 'cap1c' },
        f: { k: 'brawl', pit: 1, en: [[G, B]], it: ['ink', 'letter'] },
        e: { k: 'sketch', en: [[B, B]], cap: 'cap1e' },
        d: { k: 'brawl', en: [[N, B]], it: ['letter'], cap: 'cap1d' },
        g: { k: 'wall', en: [[B, B]], it: ['ink'], cap: 'cap1g' },
        h: { k: 'brawl', pit: 1, en: [[B, B, B], [G]], it: ['flask', 'ink'] } },
      { a: { k: 'brawl', en: [[B, G]], it: ['letter'], cap: 'cap1fork' },
        b: { k: 'steps', en: [[B, N]], it: ['ink'], cap: 'cap1steps' },
        c: { k: 'brawl', en: [[G, B, B]], it: ['mark', 'ink'] },
        d: { k: 'frame', en: [[N, B]], it: ['ink'] },
        e: { k: 'lever', en: [[G, G]], it: ['letter'] },
        f: { k: 'blank', en: [[N]], it: ['ink'], cap: 'cap1blank' },
        A: { it: ['ink'] }, B: { it: ['ink', 'ink'] } }
    ] },
    { boss: 'binder', pages: [
      { a: { k: 'brawl', en: [[G, B, N]], it: ['ink'], cap: 'cap2a' },
        b: { k: 'frame', en: [[B, B, G]], it: ['letter'] },
        c: { k: 'lever', en: [[N, G]], it: ['ink', 'flask'] },
        f: { k: 'sketch', en: [[G, B]], it: ['letter'] },
        e: { k: 'wall', en: [[B, B, N]], it: ['ink'] },
        d: { k: 'brawl', pit: 1, en: [[B, B], [G, N]], it: ['sheet'] },
        g: { k: 'steps', en: [[G, N]], it: ['ink'] },
        h: { k: 'brawl', en: [[B, B, G], [G, N]], it: ['ink', 'scis'] } },
      { a: { k: 'lever', en: [[G, N]], it: ['ink'], cap: 'cap2fork' },
        b: { k: 'wall', en: [[B, G, B]], it: ['letter'] },
        c: { k: 'frame', en: [[G, N, B]], it: ['mark'] },
        d: { k: 'blank', en: [[N, N]], it: ['ink'] },
        e: { k: 'brawl', en: [[G, G, N]], it: ['ink', 'letter'] },
        f: { k: 'sketch', en: [[B, B, G]], it: ['ink'] },
        A: { it: ['ink', 'flask'] }, B: { it: ['ink', 'ink'] } }
    ] },
    { boss: 'corrector', pages: [
      { a: { k: 'brawl', en: [[G, G, B]], it: ['ink'], cap: 'cap3a' },
        b: { k: 'sketch', en: [[N, B, B]], it: ['letter'] },
        c: { k: 'lever', en: [[G, N, N]], it: ['ink'] },
        f: { k: 'frame', en: [[B, B, G]], it: ['flask'] },
        e: { k: 'blank', en: [[N, N]], it: ['ink'] },
        d: { k: 'brawl', pit: 1, en: [[G, B], [N, G]], it: ['sheet', 'ink'] },
        g: { k: 'wall', en: [[B, G, B]], it: ['letter'] },
        h: { k: 'steps', en: [[G, N, B]], it: ['ink', 'mark'] } },
      { a: { k: 'frame', en: [[G, N, B]], it: ['ink'], cap: 'cap3fork' },
        b: { k: 'blank', en: [[N, N]], it: ['ink'] },
        c: { k: 'brawl', en: [[G, G, B], [N, N]], it: ['ink', 'letter'] },
        d: { k: 'steps', en: [[G, B, N]], it: ['scis'] },
        e: { k: 'sketch', en: [[G, G, N]], it: ['ink'] },
        f: { k: 'lever', en: [[G, N, B]], it: ['ink', 'flask'] },
        A: { it: ['ink', 'mark'] }, B: { it: ['ink', 'ink'] } }
    ] }
  ];

  // ---------- геометрия архетипа (прямые координаты) ----------
  function R(x, y, w, h, k) { return { x: x, y: y, w: w, h: h, k: k || 'block' }; }
  function geometry(w, ex, k, opt) {
    var g = { pits: [], blocks: [], ledges: [], gate: null, lever: null, frame: null, sketch: null, stand: null, seal: false, blank: false };
    var hole = null;
    if (ex === 'D') hole = [w - 64, w - 28];
    if (ex === 'FD') hole = [w - 104, w - 68];
    if (hole) g.pits.push({ x0: hole[0], x1: hole[1], k: 'hole' });
    var farStart = hole ? hole[0] : w - 30;
    var r0 = 76, r1 = farStart - 22, mid = (r0 + r1) / 2;
    if (k === 'brawl' && opt.pit) g.pits.push({ x0: Math.round(mid - 17), x1: Math.round(mid + 17), k: 'pit' });
    if (k === 'lever') {
      g.gate = { x: farStart - 18, w: 8 };
      var bx = Math.round(r0 + (r1 - r0) * 0.3);
      g.blocks.push(R(bx, F - 26, 40, 26));
      g.lever = { x: bx + 20, y: F - 26 };
    }
    if (k === 'frame') {
      var p0 = Math.round(mid - 44); g.pits.push({ x0: p0, x1: p0 + 88, k: 'pit' });
      g.frame = { pin: { x: p0 - 12, y: F - 20 }, rect: R(p0, F, 88, 16, 'frame'), hangY: F - 104 };
    }
    if (k === 'sketch') {
      var s0 = Math.round(mid - 46); g.pits.push({ x0: s0, x1: s0 + 92, k: 'pit' });
      g.sketch = { kind: 'bridge', zone: [s0 - 36, s0 + 2], parts: [R(s0 - 2, F, 96, 16, 'sketch')] };
      g.stand = { x: 34 };
    }
    if (k === 'steps') {
      g.blocks.push(R(w - 70, F - 72, 70, 72));
      g.sketch = { kind: 'steps', zone: [w - 168, w - 124], parts: [R(w - 122, F - 24, 26, 24, 'sketch'), R(w - 96, F - 48, 26, 48, 'sketch')] };
      g.stand = { x: 34 };
    }
    if (k === 'blank') {
      var e1 = ex === 'F' ? w - 62 : hole[0] - 40;
      g.pits.push({ x0: 74, x1: e1, k: 'pit' });
      g.sketch = { kind: 'floor', zone: [34, 76], parts: [R(72, F, e1 - 72 + 2, 16, 'sketch')] };
      g.stand = { x: 26 }; g.blank = true;
    }
    if (k === 'wall') g.seal = true;
    g.farStart = farStart; g.r0 = r0; g.r1 = r1;
    return g;
  }
  // безопасные точки пола (не над ямой и не в блоке) — для предметов и появления врагов
  function freeX(g, w, x) {
    for (var i = 0; i < g.pits.length; i++) if (x > g.pits[i].x0 - 14 && x < g.pits[i].x1 + 14) return false;
    for (var j = 0; j < g.blocks.length; j++) { var b = g.blocks[j]; if (x > b.x - 10 && x < b.x + b.w + 10) return false; }
    if (g.gate && Math.abs(x - g.gate.x) < 16) return false;
    return x > 20 && x < w - 20;
  }
  function spread(g, w, n, a, b) {
    var out = [], tries;
    for (var i = 0; i < n; i++) {
      var x = Math.round(a + (b - a) * (n === 1 ? 0.5 : i / (n - 1)));
      tries = 0; var x0 = x;
      while ((!freeX(g, w, x) || out.some(function (o) { return Math.abs(o - x) < 16; })) && tries < 60) { tries++; x = x0 + (tries % 2 ? 1 : -1) * Math.ceil(tries / 2) * 8; }
      out.push(x);
    }
    return out;
  }
  // отражение по горизонтали (dir = −1)
  function mirror(g, w) {
    function rx(r) { r.x = w - r.x - r.w; }
    g.pits.forEach(function (p) { var a = w - p.x1, b = w - p.x0; p.x0 = a; p.x1 = b; });
    g.blocks.forEach(rx); g.ledges.forEach(rx);
    if (g.gate) g.gate.x = w - g.gate.x - g.gate.w;
    if (g.lever) g.lever.x = w - g.lever.x;
    if (g.frame) { g.frame.pin.x = w - g.frame.pin.x; rx(g.frame.rect); }
    if (g.sketch) { var z = g.sketch.zone; g.sketch.zone = [w - z[1], w - z[0]]; g.sketch.parts.forEach(rx); }
    if (g.stand) g.stand.x = w - g.stand.x;
    g.items.forEach(function (it) { it.x = w - it.x; });
    g.spawns = g.spawns.map(function (x) { return w - x; });
  }

  // ---------- сборка панели ----------
  function buildPanel(ch, pg, id) {
    var C = CHAPTERS[ch - 1], tpl = pg === 1 ? T1 : T2, t = tpl.p[id], c = C.pages[pg - 1][id] || {};
    var w = t.w, P = { ch: ch, pg: pg, id: id, x: t.x, y: rowY(t.r), w: w, h: H, F: F, dir: t.dir, row: t.r, cap: c.cap || null };
    var g;
    if (t.boss) {
      g = { pits: [], blocks: [], ledges: [], gate: null, lever: null, frame: null, sketch: null, stand: null, seal: false, blank: false, farStart: w, r0: 60, r1: w - 40 };
      P.boss = { type: C.boss, variant: t.boss };
      if (t.boss === 'A') g.ledges.push(R(92, F - 44, 72, 6, 'ledge'), R(w - 164, F - 44, 72, 6, 'ledge'));
      g.items = spread(g, w, (c.it || []).length, 120, w - 120).map(function (x, i) { return { k: c.it[i], x: x }; });
      g.spawns = []; P.kind = 'boss'; P.waves = [];
    } else {
      g = geometry(w, t.ex, c.k || 'brawl', c);
      P.kind = c.k || 'brawl';
      var its = c.it || [];
      var ia = g.r0 - 20, ib = (P.kind === 'steps' || P.kind === 'blank' || P.kind === 'sketch' || P.kind === 'frame') ? Math.min(g.r1, (g.pits.length ? g.pits[g.pits.length - 1].x0 : g.r1) - 10) : g.r1;
      if (P.kind === 'blank') { ia = 44; ib = 64; }
      if (P.kind === 'steps') ib = w - 176;
      g.items = spread(g, w, its.length, ia, Math.max(ia, ib)).map(function (x, i) { return { k: its[i], x: x }; });
      var nMax = 0; (c.en || []).forEach(function (wv) { nMax = Math.max(nMax, wv.length); });
      g.spawns = spread(g, w, nMax, 120, Math.max(130, g.farStart - 30));
      P.waves = c.en || [];
    }
    if (t.dir < 0) mirror(g, w);
    P.pits = g.pits; P.blocks = g.blocks; P.ledges = g.ledges; P.gate = g.gate; P.lever = g.lever; P.frame = g.frame;
    P.sketch = g.sketch; P.stand = g.stand; P.seal = g.seal; P.blank = g.blank; P.items = g.items; P.spawns = g.spawns;
    // выходы
    var to = tpl.to[id] || {}, ex = [];
    var farSide = t.dir > 0 ? 'R' : 'L';
    if (to.F) ex.push({ s: farSide, to: to.F, need: g.seal ? 'tear' : null });
    if (to.D) { var hp = P.pits.filter(function (p) { return p.k === 'hole'; })[0]; if (!hp) { hp = { x0: (w / 2) - 18, x1: w / 2 + 18, k: 'hole' }; P.pits.push(hp); } ex.push({ s: 'D', to: to.D, hole: hp }); }
    P.exits = ex;
    P.entry = { side: t.dir > 0 ? 'L' : 'R', x: t.dir > 0 ? 10 : w - 10, dropX: t.dir > 0 ? 26 : w - 26 };
    return P;
  }
  function pageIds(pg) { return Object.keys((pg === 1 ? T1 : T2).p); }
  function template(pg) { return pg === 1 ? T1 : T2; }

  LIST.levels = {
    H: H, F: F, PAGE_W: PAGE_W, PAGE_H: PAGE_H, CHAPTERS: CHAPTERS, T1: T1, T2: T2,
    rowY: rowY, buildPanel: buildPanel, pageIds: pageIds, template: template,
    COUNT: CHAPTERS.length, PAGES: 2
  };
})(typeof window !== 'undefined' ? window : globalThis);
