/* ДЕСАНТ · общий рендер мира, HUD и баннеров для обеих тем. DESANT.render(ctx, S, P, o).
   Палитры — DESANT.palettes.modern / .retro (свои у каждой зоны). modern — сглаженные фигуры, мягкие тени и блики;
   retro — тот же мир в буфере 240×320 ×2 без сглаживания и ограниченная 16-цветная палитра.
   Облик: десантники в маскхалатах-штормовках с капюшоном и шевроном мастерской (И1 «Ольха» — пепельный халат и
   оранжевый шеврон, И2 «Пихта» — мшистый халат и бирюзовый шеврон); сажевики — тёмно-сливовые шинели, респираторы
   с ядовито-зелёными окулярами; танкетка «Сверчок» — охристая. */
(function (global) {
  'use strict';
  var DS = global.DESANT = global.DESANT || {};
  var L = DS.logic, T = L.T, W = L.W, VH = L.VIEW_H, HUD = L.HUD, COLS = L.COLS;

  var modern = {
    name: 'modern', pixel: false,
    zones: {
      taiga: { ground: '#dfe7ea', ground2: '#cfdade', rubble: '#b7c3c8', solid: '#2b5446', solidTop: '#3e735e', cap: '#f4f8f9', water: '#2e4d63', water2: '#45708c', edge: '#b9d3de', bridge: '#7a5a3c', plank: '#9c7650', cover: '#8a6a4a', coverTop: '#a8875f', mud: '#8a8070', wall: '#7c8a90', wallTop: '#9aa8ae', body: '#aeb9be', bodyTop: '#c4ced2', decor: '#b6c5cb' },
      marsh: { ground: '#7c7a4e', ground2: '#6f6e45', rubble: '#5f5c3c', solid: '#cfc8b8', solidTop: '#e8e2d4', cap: '#3b3a2a', water: '#2f3f33', water2: '#46594a', edge: '#8a9566', bridge: '#8a6a3e', plank: '#a9875a', cover: '#56632f', coverTop: '#6f7f3e', mud: '#5a4a32', wall: '#6d6b55', wallTop: '#86846c', body: '#3b4a3c', bodyTop: '#4d5f4d', decor: '#97945e' },
      quarry: { ground: '#a8a49a', ground2: '#9b978d', rubble: '#8b877d', solid: '#6f6d68', solidTop: '#8e8b84', cap: '#b7b3aa', water: '#2a2826', water2: '#3a3733', edge: '#57534c', bridge: '#7a6040', plank: '#9a7c52', cover: '#86827a', coverTop: '#a19d94', mud: '#7d7568', wall: '#6a675f', wallTop: '#85827a', body: '#7e7a72', bodyTop: '#948f86', decor: '#bdb9ae' },
      rapids: { ground: '#8fa38a', ground2: '#839880', rubble: '#76887a', solid: '#2f4f3e', solidTop: '#456e57', cap: '#5c8a6c', water: '#3f7f9a', water2: '#5f9fb8', edge: '#d8eef2', bridge: '#8a6a46', plank: '#a8865e', cover: '#9a7348', coverTop: '#b58c5c', mud: '#6f6650', wall: '#6f7a72', wallTop: '#8a958c', body: '#6f7f84', bodyTop: '#8b9ca1', decor: '#a2b59a' },
      fort: { ground: '#b5a58c', ground2: '#a8987f', rubble: '#968670', solid: '#7c7068', solidTop: '#958980', cap: '#a89c92', water: '#3a5560', water2: '#507480', edge: '#8fa6ac', bridge: '#7a5a3c', plank: '#9c7650', cover: '#9c8a70', coverTop: '#b5a284', mud: '#8a7a62', wall: '#8a5444', wallTop: '#a86a54', body: '#6a5a50', bodyTop: '#806e62', decor: '#c4b59c' }
    },
    crate: '#b08a4e', crateDark: '#7a5c30', bunker: '#6c7068', bunkerTop: '#8a8e86', slit: '#1a1a1e',
    hero: [{ smock: '#e8e4d8', blot: '#a3aaa0', hood: '#d4cebe', chev: '#ea6a12', dark: '#3a3a36' }, { smock: '#7f8f74', blot: '#56644f', hood: '#a6b298', chev: '#2fb7c4', dark: '#262e24' }],
    gun: '#26282c', foe: { coat: '#3a2f45', coat2: '#4d3f5c', head: '#2a2530', eye: '#9cff57', mask: '#5e5468' },
    car: '#4a3d55', carTop: '#5f4f6d', tracks: '#2a2430', lamp: '#9cff57', boat: '#3d3448', boatTop: '#55486a',
    tank: '#d9a441', tankTop: '#efc066', tankDark: '#6b4f1e', chev: '#ea6a12',
    pbullet: '#ffd27a', ebullet: '#c6ff4a', eglow: 'rgba(198,255,74,.35)', shell: '#ffb14a', nade: '#4a5a3a',
    boom: ['#fff3c0', '#ffb04a', '#e0502a', 'rgba(60,50,40,.55)'], mark: 'rgba(198,255,74,.55)',
    boss: '#3a3240', bossTop: '#524660', bossDark: '#231e28', bossGlow: '#9cff57', bossCore: '#ff8a3a', boulder: '#7a756c', boulderTop: '#9a958b',
    item: { nade: '#4a5a3a', med: '#f2f2ee', spread: '#ea6a12', rapid: '#2fb7c4', fuel: '#d9a441' },
    ink: '#f2f4f2', muted: '#a9b2b4', accent: '#ea6a12', good: '#6fd38a', bad: '#ff6a5a', warn: '#ffd166', hudBg: 'rgba(14,18,20,.88)', panel: 'rgba(16,20,22,.92)', line: '#3a464a',
    shadow: 'rgba(10,20,30,.22)', font: 'Inter, system-ui, sans-serif'
  };
  // retro: ограниченная палитра (16 цветов)
  var C = { k: '#000000', n: '#1b2a49', s: '#5b6e85', l: '#c8d4dc', w: '#f4f4f4', gd: '#1f5c3a', g: '#4a9a52', o: '#8a8a3a', b: '#6b4422', t: '#c49a5a', or: '#ea6a12', r: '#b83a2a', tl: '#2fb7c4', v: '#5a3a7a', lm: '#a6f040', y: '#f0d040' };
  var retro = {
    name: 'retro', pixel: true,
    zones: {
      taiga: { ground: C.l, ground2: C.w, rubble: C.s, solid: C.gd, solidTop: C.g, cap: C.w, water: C.n, water2: C.s, edge: C.w, bridge: C.b, plank: C.t, cover: C.b, coverTop: C.t, mud: C.s, wall: C.s, wallTop: C.l, body: C.s, bodyTop: C.l, decor: C.s },
      marsh: { ground: C.o, ground2: C.o, rubble: C.b, solid: C.l, solidTop: C.w, cap: C.k, water: C.gd, water2: C.g, edge: C.o, bridge: C.b, plank: C.t, cover: C.gd, coverTop: C.g, mud: C.b, wall: C.s, wallTop: C.l, body: C.gd, bodyTop: C.g, decor: C.g },
      quarry: { ground: C.s, ground2: C.l, rubble: C.n, solid: C.n, solidTop: C.s, cap: C.l, water: C.k, water2: C.n, edge: C.n, bridge: C.b, plank: C.t, cover: C.n, coverTop: C.l, mud: C.b, wall: C.n, wallTop: C.s, body: C.n, bodyTop: C.s, decor: C.l },
      rapids: { ground: C.g, ground2: C.o, rubble: C.gd, solid: C.gd, solidTop: C.g, cap: C.o, water: C.n, water2: C.tl, edge: C.w, bridge: C.b, plank: C.t, cover: C.b, coverTop: C.t, mud: C.b, wall: C.s, wallTop: C.l, body: C.s, bodyTop: C.l, decor: C.o },
      fort: { ground: C.t, ground2: C.t, rubble: C.b, solid: C.s, solidTop: C.l, cap: C.l, water: C.n, water2: C.s, edge: C.l, bridge: C.b, plank: C.t, cover: C.b, coverTop: C.t, mud: C.b, wall: C.r, wallTop: C.or, body: C.b, bodyTop: C.t, decor: C.y }
    },
    crate: C.t, crateDark: C.b, bunker: C.s, bunkerTop: C.l, slit: C.k,
    hero: [{ smock: C.w, blot: C.s, hood: C.l, chev: C.or, dark: C.k }, { smock: C.o, blot: C.gd, hood: C.g, chev: C.tl, dark: C.k }],
    gun: C.k, foe: { coat: C.v, coat2: C.v, head: C.k, eye: C.lm, mask: C.s },
    car: C.v, carTop: C.s, tracks: C.k, lamp: C.lm, boat: C.v, boatTop: C.s,
    tank: C.y, tankTop: C.y, tankDark: C.b, chev: C.or,
    pbullet: C.y, ebullet: C.lm, eglow: null, shell: C.or, nade: C.gd,
    boom: [C.w, C.y, C.or, C.b], mark: C.lm,
    boss: C.v, bossTop: C.s, bossDark: C.k, bossGlow: C.lm, bossCore: C.or, boulder: C.s, boulderTop: C.l,
    item: { nade: C.gd, med: C.w, spread: C.or, rapid: C.tl, fuel: C.y },
    ink: C.w, muted: C.l, accent: C.or, good: C.lm, bad: C.r, warn: C.y, hudBg: C.k, panel: C.k, line: C.s,
    shadow: null, font: '"Courier New", ui-monospace, monospace'
  };
  DS.palettes = { modern: modern, retro: retro };

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function rr(c, x, y, w, h, r, col) { c.fillStyle = col; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); }
  function shadow(c, P, x, y, rx, ry) { if (!P.shadow) return; c.fillStyle = P.shadow; c.beginPath(); c.ellipse(x + 3, y + 4, rx, ry, 0, 0, Math.PI * 2); c.fill(); }

  // ---------- Тайлы ----------
  function tiles(c, S, P, Z, cam) {
    var r0 = Math.max(0, Math.floor(cam / T)), r1 = Math.min(S.D.h - 1, Math.floor((cam + VH) / T) + 1), key = S.D.key, t = S.time;
    for (var ty = r0; ty <= r1; ty++) for (var tx = 0; tx < COLS; tx++) {
      var v = S.tiles[tx + ty * COLS], x = tx * T, y = ty * T - cam, h = hash(tx, ty);
      // подложка
      c.fillStyle = v === L.RUBBLE ? Z.rubble : v === L.MUD ? Z.mud : Z.ground; c.fillRect(x, y, T, T);
      if (v === L.G && h < 0.22) { c.fillStyle = Z.ground2; var h2 = hash(ty, tx); c.fillRect(x + (h2 * 10 | 0), y + (h * 40 | 0) % 16, 10 + (h2 * 8 | 0), 5); }
      if (v === L.G && h > 0.86) { c.fillStyle = Z.decor; if (key === 'taiga') { c.fillRect(x + 6, y + 10, 8, 2); c.fillRect(x + 13, y + 15, 5, 2); } else if (key === 'fort') { c.fillRect(x, y + 11, T, 1); c.fillRect(x + 11, y, 1, 11); } else { c.fillRect(x + 7, y + 8, 2, 5); c.fillRect(x + 12, y + 12, 2, 4); c.fillRect(x + 16, y + 7, 2, 5); } }
      if (v === L.MUD) { c.fillStyle = Z.ground2; if (h > 0.5) c.fillRect(x + 5, y + 7, 6, 3); else c.fillRect(x + 12, y + 14, 7, 3); }
      if (v === L.RUBBLE) { c.fillStyle = Z.solid; c.fillRect(x + 4, y + 6, 4, 3); c.fillRect(x + 14, y + 13, 5, 3); c.fillRect(x + 9, y + 17, 3, 2); }
      if (v === L.WATER) {
        var deep = key === 'quarry';
        c.fillStyle = Z.water; c.fillRect(x, y, T, T);
        var above = ty > 0 ? S.tiles[tx + (ty - 1) * COLS] : 1, below = ty < S.D.h - 1 ? S.tiles[tx + (ty + 1) * COLS] : 1;
        if (!deep) { c.fillStyle = Z.water2; var ph = ((t * 22 + tx * 7 + ty * 13) % T); c.fillRect(x + (ph | 0) % 20, y + 6 + (h * 10 | 0), 6, 2); }
        else { c.fillStyle = Z.water2; c.fillRect(x, y + T - 6, T, 6); }
        c.fillStyle = Z.edge;
        if (above !== L.WATER && above !== L.BRIDGE) c.fillRect(x, y, T, deep ? 4 : 3);
        if (below !== L.WATER && below !== L.BRIDGE) c.fillRect(x, y + T - 2, T, 2);
      } else if (v === L.BRIDGE) {
        c.fillStyle = Z.water; c.fillRect(x, y, T, T);
        c.fillStyle = Z.bridge; c.fillRect(x, y, T, T);
        c.fillStyle = Z.plank; for (var k = 0; k < 4; k++) c.fillRect(x + 1, y + k * 6 + 1, T - 2, 4);
        var l = S.tiles[tx - 1 + ty * COLS], rgt = S.tiles[tx + 1 + ty * COLS];
        c.fillStyle = Z.cap; if (l !== L.BRIDGE) c.fillRect(x, y, 2, T); if (rgt !== L.BRIDGE) c.fillRect(x + T - 2, y, 2, T);
      } else if (v === L.SOLID) {
        if (tx === 0 || tx === COLS - 1) { c.fillStyle = Z.solid; c.fillRect(x, y, T, T); c.fillStyle = Z.solidTop; c.fillRect(x + (tx ? 0 : 6), y + (h * 8 | 0), 18, 10); continue; }
        if (key === 'taiga' || key === 'rapids') {      // ель: ярусы
          shadow(c, P, x + 12, y + 18, 10, 5);
          c.fillStyle = Z.solid; c.beginPath(); c.moveTo(x + 12, y - 4); c.lineTo(x + 23, y + 20); c.lineTo(x + 1, y + 20); c.fill();
          c.fillStyle = Z.solidTop; c.beginPath(); c.moveTo(x + 12, y - 2); c.lineTo(x + 19, y + 12); c.lineTo(x + 5, y + 12); c.fill();
          if (key === 'taiga') { c.fillStyle = Z.cap; c.fillRect(x + 9, y + 1, 6, 3); c.fillRect(x + 4, y + 17, 6, 2); c.fillRect(x + 15, y + 11, 5, 2); }
        } else if (key === 'marsh') {                   // сухая берёза / пень
          shadow(c, P, x + 12, y + 15, 10, 6);
          circ(c, x + 12, y + 12, 10, Z.cap); circ(c, x + 12, y + 12, 8, Z.solid); circ(c, x + 12, y + 12, 5, Z.solidTop);
          c.strokeStyle = Z.cap; c.lineWidth = 1; c.beginPath(); c.arc(x + 12, y + 12, 3, 0, Math.PI * 2); c.stroke();
          c.fillStyle = Z.cap; c.fillRect(x + 20, y + 14, 4, 2);
        } else if (key === 'quarry') {                  // валун
          shadow(c, P, x + 12, y + 14, 12, 7);
          rr(c, x + 1, y + 2, 22, 20, P.pixel ? 2 : 8, Z.solid); rr(c, x + 4, y + 3, 14, 9, P.pixel ? 1 : 5, Z.solidTop);
        } else {                                        // руины: камни
          rr(c, x + 1, y + 1, 22, 22, 3, Z.solid); c.fillStyle = Z.solidTop; c.fillRect(x + 3, y + 3, 9, 7); c.fillRect(x + 13, y + 12, 8, 8);
        }
      } else if (v === L.WALL) {
        c.fillStyle = Z.wall; c.fillRect(x, y, T, T); c.fillStyle = Z.wallTop;
        for (var b = 0; b < 3; b++) c.fillRect(x + ((b % 2) ? 0 : 6), y + b * 8 + 1, 11, 6), c.fillRect(x + ((b % 2) ? 12 : 18), y + b * 8 + 1, 11, 6);
      } else if (v === L.COVER) {
        shadow(c, P, x + 12, y + 14, 12, 6);
        if (key === 'marsh') { circ(c, x + 7, y + 13, 8, Z.cover); circ(c, x + 17, y + 12, 8, Z.cover); circ(c, x + 7, y + 10, 5, Z.coverTop); circ(c, x + 17, y + 9, 5, Z.coverTop); }
        else if (key === 'taiga' || key === 'rapids') { for (var g2 = 0; g2 < 3; g2++) { rr(c, x, y + 4 + g2 * 6, T, 6, 3, Z.cover); c.fillStyle = Z.coverTop; c.fillRect(x + 1, y + 5 + g2 * 6, T - 2, 2); circ(c, x + 3, y + 7 + g2 * 6, 2.5, Z.coverTop); } }
        else { rr(c, x + 1, y + 4, 22, 16, 3, Z.cover); c.fillStyle = Z.coverTop; c.fillRect(x + 2, y + 5, 9, 6); c.fillRect(x + 13, y + 5, 9, 6); }
      } else if (v === L.CRATE) {
        shadow(c, P, x + 12, y + 14, 11, 6);
        rr(c, x + 2, y + 2, 20, 20, 2, P.crate); c.fillStyle = P.crateDark; c.fillRect(x + 2, y + 11, 20, 2); c.fillRect(x + 11, y + 2, 2, 20);
        c.strokeStyle = P.crateDark; c.lineWidth = 1; c.strokeRect(x + 2.5, y + 2.5, 19, 19);
      } else if (v === L.BUNKER) {
        c.fillStyle = P.bunker; c.fillRect(x, y, T, T); c.fillStyle = P.bunkerTop; c.fillRect(x + 2, y + 2, T - 4, 6);
      } else if (v === L.BODY) {
        c.fillStyle = Z.body; c.fillRect(x, y, T, T); c.fillStyle = Z.bodyTop; if (h > 0.6) c.fillRect(x + 4, y + 8, 10, 4);
      }
    }
  }

  // ---------- Фигуры ----------
  function hero(c, P, h, t) {
    if (!h.alive || h.out || h.tank) return;
    var blink = h.inv > 0 && Math.floor(t * 12) % 2;   // мигание неуязвимости
    if (blink) c.globalAlpha = 0.45;
    var C2 = P.hero[h.id], f = h.face, a = Math.atan2(f[1], f[0]), x = h.x, y = h.yS;
    var bob = h.moving ? Math.sin(t * 16 + h.id) * 1.2 : 0;
    shadow(c, P, x, y + 2, 10, 6);
    c.strokeStyle = C2.chev; c.lineWidth = 2; c.globalAlpha *= 0.8; c.beginPath(); c.ellipse(x, y + 3, 13, 9, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = blink ? 0.45 : 1;
    c.save(); c.translate(x, y + bob * 0.3); c.scale(1.3, 1.3); c.rotate(a + Math.PI / 2);
    circ(c, 0, 0, 9, C2.dark);
    // ноги
    var st = h.moving ? Math.sin(t * 16 + h.id * 2) * 3 : 0;
    c.fillStyle = C2.dark; c.fillRect(-5, 2 + st, 3, 6); c.fillRect(2, 2 - st, 3, 6);
    // халат-штормовка (пятнистый)
    rr(c, -7, -6, 14, 13, P.pixel ? 1 : 5, C2.smock);
    c.fillStyle = C2.blot; c.fillRect(-5, -3, 3, 3); c.fillRect(2, 1, 4, 3); c.fillRect(-2, 3, 2, 2);
    // рюкзак
    rr(c, -5, 3, 10, 5, 2, C2.blot);
    // ствол
    c.fillStyle = P.gun; c.fillRect(3, -15, 3, 12);
    // руки
    c.fillStyle = C2.hood; c.fillRect(2, -6, 4, 3); c.fillRect(-6, -5, 3, 3);
    // капюшон
    circ(c, 0, -2, 5, C2.hood); c.fillStyle = C2.dark; c.fillRect(-2, -6, 4, 2);
    // шеврон мастерской на плече
    c.fillStyle = C2.chev; c.beginPath(); c.moveTo(-7, -2); c.lineTo(-4, -5); c.lineTo(-1, -2); c.lineTo(-2, -1); c.lineTo(-4, -3); c.lineTo(-6, -1); c.fill();
    c.restore();
    if (h.hurtT > 0) circ(c, x, y, 10, 'rgba(255,90,70,.35)');
    c.globalAlpha = 1;
  }
  function foe(c, P, e, t) {
    var y = e.yS, x = e.x, F = P.foe, h = e.dir || [0, 1], a = Math.atan2(h[1], h[0]);
    shadow(c, P, x, y + 2, 8, 5);
    c.save(); c.translate(x, y); c.scale(1.25, 1.25); c.rotate(a - Math.PI / 2);
    var st = Math.sin(t * 12 + e.id) * 2.5;
    c.fillStyle = F.head; c.fillRect(-5, -8 + st, 3, 6); c.fillRect(2, -8 - st, 3, 6);
    rr(c, -7, -6, 14, 12, P.pixel ? 1 : 4, e.flash > 0 && e.state === 'aim' && Math.floor(t * 20) % 2 ? F.coat2 : F.coat);
    c.fillStyle = F.coat2; c.fillRect(-7, -1, 14, 2);
    c.fillStyle = P.gun; c.fillRect(-1, 4, 3, 10);
    if (e.type === 'grenadier') { c.fillStyle = P.nade; c.fillRect(-6, -5, 3, 3); c.fillRect(3, -5, 3, 3); }
    circ(c, 0, 1, 5, F.head); c.fillStyle = F.mask; c.fillRect(-2, 4, 4, 3);
    c.fillStyle = F.eye; c.fillRect(-4, 2, 3, 2); c.fillRect(1, 2, 3, 2);
    c.restore();
    if (e.state === 'aim') { c.fillStyle = P.ebullet; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 30); c.fillRect(x - 1, y - 16, 2, 5); c.globalAlpha = 1; }
  }
  function nest(c, P, e, t) {
    var x = e.x, y = e.yS, a = e.dir ? Math.atan2(e.dir[1], e.dir[0]) : Math.PI / 2;
    shadow(c, P, x, y + 2, 13, 7);
    circ(c, x, y, 12, P.foe.coat); circ(c, x, y, 8, P.foe.coat2);
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = P.gun; c.fillRect(4, -2, 16, 4); c.fillStyle = P.foe.mask; c.fillRect(2, -4, 6, 8); c.restore();
    circ(c, x, y, 4, P.foe.head); c.fillStyle = P.foe.eye; c.fillRect(x - 3, y - 1, 2, 2); c.fillRect(x + 1, y - 1, 2, 2);
    if (e.warn > 0) { c.strokeStyle = P.ebullet; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 15 + Math.sin(t * 30) * 2, 0, Math.PI * 2); c.stroke(); }
    if (e.flash > 0 && e.burst > 0) circ(c, x + Math.cos(a) * 20, y + Math.sin(a) * 20, 4, P.ebullet);
  }
  function bunker(c, P, e, t) {
    var x = e.x, y = e.yS;
    c.fillStyle = P.slit; c.fillRect(x - 14, y + 6, 28, 5);
    c.fillStyle = P.lamp; c.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4 + e.id); c.fillRect(x - 10, y + 7, 4, 3); c.fillRect(x + 6, y + 7, 4, 3); c.globalAlpha = 1;
    c.fillStyle = P.foe.coat; c.fillRect(x - 6, y - 4, 12, 6);
    for (var i = 0; i < e.hp; i++) { c.fillStyle = P.bad; c.fillRect(x - 10 + i * 8, y - 16, 6, 3); }
  }
  function car(c, P, e, t) {
    var x = e.x, y = e.yS, h = null;
    shadow(c, P, x, y + 3, 20, 10);
    c.fillStyle = P.tracks; c.fillRect(x - 20, y - 13, 40, 6); c.fillRect(x - 20, y + 7, 40, 6);
    rr(c, x - 18, y - 10, 36, 20, P.pixel ? 2 : 6, e.flash > 0 && e.hp < e.max && Math.floor(t * 30) % 2 ? P.carTop : P.car);
    rr(c, x - 14, y - 7, 18, 14, 3, P.carTop);
    var a = e._tgt ? Math.atan2(e._tgt.y - e.y, e._tgt.x - e.x) : Math.PI / 2;
    c.save(); c.translate(x + 4, y); c.rotate(a); c.fillStyle = P.gun; c.fillRect(0, -2, 18, 4); c.restore();
    circ(c, x + 4, y, 6, P.boat); c.fillStyle = P.lamp; c.fillRect(x + (e.vx > 0 ? 15 : -18), y - 5, 3, 10);
    if (e.warn > 0) { c.strokeStyle = P.ebullet; c.lineWidth = 2; c.strokeRect(x - 21, y - 15, 42, 30); }
    hpBar(c, P, x, y - 20, e.hp / e.max, 30);
  }
  function boat(c, P, e, t, Z) {
    var x = e.x, y = e.yS;
    c.fillStyle = Z.edge; c.globalAlpha = 0.6; c.fillRect(x - (e.vx > 0 ? 26 : -18), y - 3, 8, 6); c.globalAlpha = 1;
    c.fillStyle = P.boat; c.beginPath(); c.moveTo(x + (e.vx > 0 ? 20 : -20), y); c.lineTo(x + (e.vx > 0 ? 8 : -8), y - 10); c.lineTo(x - (e.vx > 0 ? 16 : -16), y - 9); c.lineTo(x - (e.vx > 0 ? 16 : -16), y + 9); c.lineTo(x + (e.vx > 0 ? 8 : -8), y + 10); c.fill();
    rr(c, x - 8, y - 6, 12, 12, 3, P.boatTop); circ(c, x - 2, y, 4, P.foe.head); c.fillStyle = P.lamp; c.fillRect(x - 4, y - 1, 4, 2);
    if (e.warn > 0) { c.strokeStyle = P.ebullet; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 20, 0, Math.PI * 2); c.stroke(); }
    hpBar(c, P, x, y - 18, e.hp / e.max, 24);
  }
  function hpBar(c, P, x, y, f, w) { if (f >= 1) return; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x - w / 2, y, w, 3); c.fillStyle = P.bad; c.fillRect(x - w / 2, y, w * Math.max(0, f), 3); }
  function tank(c, P, tk, t, S) {
    var x = tk.x, y = tk.yS, a = Math.atan2(tk.face[1], tk.face[0]);
    if (tk.dead) {
      c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); rr(c, -13, -14, 26, 28, 4, P.tankDark); c.restore();
      if (tk.wreckT > 0) for (var i = 0; i < 3; i++) circ(c, x + Math.sin(t * 2 + i) * 6, y - 8 - ((t * 20 + i * 9) % 26), 4 + i, 'rgba(60,60,60,' + (0.4 - i * 0.1) + ')');
      return;
    }
    shadow(c, P, x, y + 3, 15, 12);
    c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
    var tr = tk.moving ? (t * 30) % 6 : 0;
    c.fillStyle = P.tankDark; c.fillRect(-14, -14, 7, 28); c.fillRect(7, -14, 7, 28);
    c.fillStyle = P.gun; for (var k = 0; k < 5; k++) { c.fillRect(-14, -13 + k * 6 + tr % 6 - 1, 7, 1); c.fillRect(7, -13 + k * 6 + tr % 6 - 1, 7, 1); }
    rr(c, -9, -12, 18, 24, P.pixel ? 1 : 4, tk.hurtT > 0 ? P.ink : P.tank);
    rr(c, -6, -6, 12, 12, 3, P.tankTop);
    c.fillStyle = P.gun; c.fillRect(-2, -22, 4, 16);
    c.fillStyle = P.chev; c.beginPath(); c.moveTo(-6, 8); c.lineTo(0, 3); c.lineTo(6, 8); c.lineTo(6, 10); c.lineTo(0, 6); c.lineTo(-6, 10); c.fill();
    c.restore();
    if (tk.pilot == null) {   // метка «можно сесть»
      var bobY = Math.sin(t * 4) * 2;
      c.fillStyle = tk.fuel > 0 ? P.accent : P.bad; c.beginPath(); c.moveTo(x - 5, y - 26 + bobY); c.lineTo(x + 5, y - 26 + bobY); c.lineTo(x, y - 20 + bobY); c.fill();
    } else { hpBar(c, P, x, y - 22, tk.armor / tk.max, 28); }
  }
  function item(c, P, it, t) {
    var x = it.x, y = it.yS + Math.sin(t * 4 + x) * 1.5, col = P.item[it.kind];
    shadow(c, P, x, y + 4, 7, 3);
    rr(c, x - 8, y - 8, 16, 16, P.pixel ? 1 : 4, P.pixel ? C.k : 'rgba(20,24,26,.85)');
    c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(x - 7, y - 7, 14, 14);
    if (it.kind === 'nade') { circ(c, x, y + 1, 4, col); c.fillStyle = P.ink; c.fillRect(x - 1, y - 5, 2, 3); }
    else if (it.kind === 'med') { c.fillStyle = P.bad; c.fillRect(x - 1.5, y - 5, 3, 10); c.fillRect(x - 5, y - 1.5, 10, 3); }
    else if (it.kind === 'fuel') { c.fillStyle = col; c.fillRect(x - 4, y - 4, 8, 9); c.fillRect(x - 1, y - 6, 3, 2); }
    else { c.fillStyle = col; c.font = '800 10px ' + P.font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.kind === 'spread' ? 'W' : 'R', x, y + 1); }
  }

  // ---------- Босс ----------
  function boss(c, P, b, t, cam, Z) {
    var y = b.y - cam, x = b.x, key = b.key;
    if (b.dead && b.deadT <= 0) return;
    var shake = b.dead ? (Math.random() - 0.5) * 6 : 0; x += shake;
    if (key === 'icebreaker') {
      shadow(c, P, x, y + 6, 120, 40);
      c.fillStyle = P.tracks; c.fillRect(x - 118, y - 30, 22, 68); c.fillRect(x + 96, y - 30, 22, 68);
      rr(c, x - 100, y - 40, 200, 78, P.pixel ? 2 : 12, P.boss); rr(c, x - 86, y - 34, 172, 26, 6, P.bossTop);
      c.fillStyle = P.bossDark; c.beginPath(); c.moveTo(x - 100, y + 38); c.lineTo(x, y + 58); c.lineTo(x + 100, y + 38); c.fill();   // таран-ледорез
      c.fillStyle = Z.cap; c.fillRect(x - 60, y + 42, 30, 3); c.fillRect(x + 20, y + 44, 26, 3);
    } else if (key === 'dredger') {
      shadow(c, P, x, y + 8, 110, 36);
      rr(c, x - 104, y - 34, 208, 76, P.pixel ? 2 : 14, P.boss); rr(c, x - 90, y - 26, 180, 18, 5, P.bossTop);
      c.strokeStyle = P.bossDark; c.lineWidth = 5; c.beginPath(); c.moveTo(x, y + 30); c.lineTo(x, y + 52); c.stroke();
      for (var k = 0; k < 5; k++) rr(c, x - 6, y + 38 + ((t * 30 + k * 10) % 30) - 15, 12, 7, 2, P.bossDark);
      c.fillStyle = Z.edge; c.globalAlpha = 0.5; c.fillRect(x - 112, y + 38, 30, 3); c.fillRect(x + 84, y + 40, 30, 3); c.globalAlpha = 1;
    } else if (key === 'crusher') {
      shadow(c, P, x, y + 6, 140, 40);
      rr(c, x - 136, y - 50, 272, 96, P.pixel ? 2 : 10, P.boss); rr(c, x - 120, y - 44, 240, 22, 5, P.bossTop);
      c.save(); c.translate(x, y + 24); c.rotate(t * (guardedLocal(b) ? 1 : 2.5)); c.fillStyle = P.bossDark; for (var s = 0; s < 6; s++) { c.rotate(Math.PI / 3); c.fillRect(-4, 14, 8, 14); } c.restore();
      c.fillStyle = P.bossDark; c.fillRect(x - 136, y + 40, 272, 6);
    } else if (key === 'dam') {
      c.fillStyle = P.boss; c.fillRect(0, y - 84, W, 120 - 4); c.fillStyle = P.bossTop;
      for (var bx = 0; bx < W; bx += 40) c.fillRect(bx + 2, y - 80, 36, 10);
      c.fillStyle = P.bossDark; c.fillRect(0, y + 30, W, 6);
      b.parts.forEach(function (p) { c.fillStyle = P.bossDark; c.fillRect(p.x - 24, p.y - 26, 48, 54); });
      c.fillStyle = Z.edge; for (var fx = 0; fx < W; fx += 16) c.fillRect(fx + ((t * 40) % 16), y + 38, 6, 2);
    } else if (key === 'engine') {
      shadow(c, P, x, y + 10, 130, 70);
      rr(c, x - 110, y - 70, 220, 150, P.pixel ? 2 : 18, P.boss); rr(c, x - 96, y - 62, 192, 30, 8, P.bossTop);
      c.fillStyle = P.bossDark; c.fillRect(x - 6, y - 96, 12, 30); c.fillRect(x - 40, y - 90, 10, 24); c.fillRect(x + 30, y - 90, 10, 24);
      for (var sm = 0; sm < 4; sm++) circ(c, x + Math.sin(t + sm) * 8, y - 100 - ((t * 24 + sm * 12) % 46), 6 + sm * 2, 'rgba(40,36,44,' + (0.5 - sm * 0.1) + ')');
    }
    b.parts.forEach(function (p) {
      if (p.dead) { circ(c, p.x + shake, p.y - cam, p.r * 0.8, P.bossDark); return; }
      var px = p.x + shake, py = p.y - cam, v = DS.current && DS.current._vuln ? DS.current._vuln(p) : true, fl = p.flash > 0;
      if (p.kind === 'gun' || p.kind === 'mortar') {
        circ(c, px, py, p.r + 3, P.bossDark); circ(c, px, py, p.r, fl ? P.ink : P.bossTop);
        var a = p.aim != null ? p.aim : Math.PI / 2; c.save(); c.translate(px, py); c.rotate(p.kind === 'mortar' ? -Math.PI / 2 : a); c.fillStyle = P.gun; c.fillRect(0, -3, p.r + 10, 6); c.restore();
        circ(c, px, py, 4, P.bossGlow);
      } else if (p.kind === 'boiler') {
        rr(c, px - p.r, py - p.r - 4, p.r * 2, p.r * 2 + 8, 5, fl ? P.ink : P.bossTop); c.fillStyle = P.bossCore; c.fillRect(px - 5, py - 2, 10, 6);
      } else if (p.kind === 'port') {
        rr(c, px - 18, py - 18, 36, 36, 4, p.open ? P.bossCore : P.bossTop);
        if (!p.open) { c.fillStyle = P.bossDark; for (var g = 0; g < 4; g++) c.fillRect(px - 16, py - 14 + g * 8, 32, 3); }
        else circ(c, px, py, 9, fl ? P.ink : P.bossGlow);
      } else {
        circ(c, px, py, p.r + 4, P.bossDark); circ(c, px, py, p.r, v ? (fl ? P.ink : P.bossCore) : P.bossTop);
        if (!v) { c.strokeStyle = P.bossDark; c.lineWidth = 3; c.beginPath(); c.moveTo(px - p.r, py); c.lineTo(px + p.r, py); c.moveTo(px, py - p.r); c.lineTo(px, py + p.r); c.stroke(); }
        else circ(c, px, py, p.r * 0.45, P.warn);
      }
      if (p.warn > 0) { c.strokeStyle = P.ebullet; c.lineWidth = 2; c.beginPath(); c.arc(px, py, p.r + 7 + Math.sin(t * 30) * 2, 0, Math.PI * 2); c.stroke(); }
    });
  }
  function guardedLocal(b) { return b.parts.some(function (p) { return !p.dead && p.kind !== 'core' && p.kind !== 'port'; }); }

  // ---------- Мир ----------
  function world(c, S, P, t) {
    var cam = S.camY, Z = P.zones[S.D.key];
    tiles(c, S, P, Z, cam);
    // чекпоинты: вешки-флажки мастерской
    S.D.cps.forEach(function (cp, i) {
      var y = cp.y - cam; if (y < -30 || y > VH + 30) return;
      var got = i <= S.cp;
      [T * 1.5, W - T * 1.5].forEach(function (x) { c.fillStyle = P.gun; c.fillRect(x - 1, y - 22, 2, 24); c.fillStyle = got ? P.accent : P.muted; c.beginPath(); c.moveTo(x + 1, y - 22); c.lineTo(x + 14, y - 17); c.lineTo(x + 1, y - 12); c.fill(); });
      if (!got) { c.fillStyle = P.muted; c.globalAlpha = 0.5; for (var dx = T * 2; dx < W - T * 2; dx += 12) c.fillRect(dx, y, 6, 2); c.globalAlpha = 1; }
    });
    S.marks.forEach(function (m) { var y = m.y - cam; c.strokeStyle = P.mark; c.lineWidth = 2; c.beginPath(); c.arc(m.x, y, m.r * (0.5 + 0.5 * (1 - Math.min(1, m.t))), 0, Math.PI * 2); c.stroke(); if (m.lane) { c.globalAlpha = 0.25; c.fillStyle = P.mark; c.fillRect(m.x - 14, y, 28, VH); c.globalAlpha = 1; } });
    S.items.forEach(function (it) { if (it.taken) return; it.yS = it.y - cam; item(c, P, it, t); });
    S.tanks.forEach(function (tk) { tk.yS = tk.y - cam; if (tk.yS > -40 && tk.yS < VH + 40) tank(c, P, tk, t, S); });
    S.enemies.forEach(function (e) {
      if (e.dead) return; e.yS = e.y - cam; if (e.yS < -40 || e.yS > VH + 40) return;
      var h = nearest(S, e); e._tgt = h;
      if (e.type === 'nest') nest(c, P, e, t); else if (e.type === 'bunker') bunker(c, P, e, t); else if (e.type === 'car') car(c, P, e, t); else if (e.type === 'boat') boat(c, P, e, t, Z); else foe(c, P, e, t);
    });
    if (S.boss) boss(c, P, S.boss, t, cam, Z);
    S.boulders.forEach(function (bo) { var y = bo.y - cam; shadow(c, P, bo.x, y + 4, bo.r, bo.r * 0.6); circ(c, bo.x, y, bo.r, P.boulder); c.save(); c.translate(bo.x, y); c.rotate(bo.rot || 0); c.fillStyle = P.boulderTop; c.fillRect(-bo.r * 0.6, -bo.r * 0.6, bo.r * 0.7, bo.r * 0.5); c.fillRect(2, 2, bo.r * 0.5, bo.r * 0.4); c.restore(); });
    S.heroes.forEach(function (h) { h.yS = h.y - cam; hero(c, P, h, t); });
    // гранаты (дуга — по «высоте»)
    S.nades.forEach(function (n) {
      var k = n.t / n.dur, x = n.x0 + (n.x1 - n.x0) * k, y = n.y0 + (n.y1 - n.y0) * k - cam, z = Math.sin(k * Math.PI) * 34;
      shadow(c, P, x, y + 2, 4, 2); circ(c, x, y - z, n.enemy ? 5 : 4, n.enemy ? P.foe.coat2 : P.nade);
      if (!P.pixel) circ(c, x - 1, y - z - 1, 1.5, 'rgba(255,255,255,.6)');
    });
    S.bullets.forEach(function (b) {
      var y = b.y - cam;
      if (b.k === 'e') { if (P.eglow) circ(c, b.x, y, 6, P.eglow); circ(c, b.x, y, 3.2, P.ebullet); }
      else if (b.k === 's') { circ(c, b.x, y, 5, P.shell); circ(c, b.x, y, 2.5, P.ink); }
      else { c.strokeStyle = P.pbullet; c.lineWidth = 3; c.beginPath(); c.moveTo(b.x, y); c.lineTo(b.x - b.vx * 0.018, y - b.vy * 0.018); c.stroke(); }
    });
    S.booms.forEach(function (b) {
      var k = 1 - b.t / b.max, y = b.y - cam;
      circ(c, b.x, y, b.r * (0.4 + 0.7 * k), P.boom[3]); circ(c, b.x, y, b.r * (0.3 + 0.6 * k) * (1 - k * 0.5), P.boom[2]);
      circ(c, b.x, y, b.r * 0.5 * (1 - k), P.boom[1]); circ(c, b.x, y, b.r * 0.25 * (1 - k), P.boom[0]);
    });
  }
  function nearest(S, e) { var best = null, bd = 1e9; S.heroes.forEach(function (h) { if (!h.alive || h.out) return; var d = Math.hypot(h.x - e.x, h.y - e.y); if (d < bd) { bd = d; best = h; } }); return best; }

  // ---------- HUD и баннеры ----------
  function txt(c, P, s, x, y, o) {
    o = o || {}; c.font = (o.weight || 800) + ' ' + (o.size || 13) + 'px ' + P.font; c.textAlign = o.align || 'left'; c.textBaseline = 'alphabetic';
    if (o.shadow !== false) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(s, x + 1, y + 1); }
    c.fillStyle = o.color || P.ink; c.fillText(s, x, y);
  }
  function panel(c, P, x, y, w, h, border) {
    if (P.pixel) { c.fillStyle = P.panel; c.fillRect(x, y, w, h); c.strokeStyle = border || P.line; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2); return; }
    rr(c, x, y, w, h, 12, P.panel); c.strokeStyle = border || P.line; c.lineWidth = 1.5; c.beginPath(); if (c.roundRect) c.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12); else c.rect(x, y, w, h); c.stroke();
  }
  function hud(c, g, S, P) {
    c.fillStyle = P.hudBg; c.fillRect(0, 0, W, HUD);
    S.heroes.forEach(function (h, i) {
      var right = i === 1, x0 = right ? W - 8 : 8, al = right ? 'right' : 'left', H2 = P.hero[i];
      var name = g.t(i ? 'p2' : 'p1');
      txt(c, P, name, x0, 13, { size: 10, align: al, color: H2.chev });
      if (h.out) { txt(c, P, g.t('out'), x0, 26, { size: 11, align: al, color: P.muted }); return; }
      var dirS = right ? -1 : 1, x = x0;
      for (var k = 0; k < L.HP; k++) { c.fillStyle = k < h.hp && h.alive ? P.bad : 'rgba(120,120,120,.5)'; c.fillRect(x + dirS * k * 10 - (right ? 8 : 0), 18, 8, 8); }
      x += dirS * 34;
      txt(c, P, '×' + h.lives, x, 26, { size: 11, align: al, color: P.ink });
      x += dirS * 26;
      circ(c, x + (right ? -4 : 4), 22, 4, P.item.nade); txt(c, P, String(h.nades), x + dirS * 11, 26, { size: 11, align: al, color: P.ink });
      x += dirS * 28;
      if (h.tank) {
        var tk = h.tank, bw = 44, bx = right ? x - bw : x;
        c.fillStyle = 'rgba(120,120,120,.4)'; c.fillRect(bx, 16, bw, 4); c.fillRect(bx, 23, bw, 4);
        c.fillStyle = P.good; c.fillRect(bx, 16, bw * tk.armor / tk.max, 4); c.fillStyle = P.warn; c.fillRect(bx, 23, bw * tk.fuel, 4);
        txt(c, P, g.t('tank'), right ? bx - 4 : bx + bw + 4, 26, { size: 9, align: al, color: P.tank });
      } else txt(c, P, g.t('w_' + h.weapon), x, 26, { size: 10, align: al, color: h.weapon === 'rifle' ? P.muted : P.item[h.weapon] });
    });
    var mid = W / 2;
    txt(c, P, String(S.score), mid, 14, { size: 13, align: 'center', color: P.ink });
    txt(c, P, g.t('zone') + ' ' + S.zone + '/' + S.maxZone, mid, 26, { size: 9, align: 'center', color: P.muted, weight: 700 });
    // полоска босса
    var b = S.boss;
    if (b && b.active && !b.dead) {
      var hp = b.parts.reduce(function (a, p) { return a + Math.max(0, p.hp); }, 0), bw2 = W - 80;
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(40, HUD + 4, bw2, 6); c.fillStyle = P.bossCore; c.fillRect(40, HUD + 4, bw2 * hp / b.max, 6);
    }
  }
  function banners(c, g, S, P, t) {
    var Z = S.D.key, n = S.zone;
    if (S.banner > 0 && S.phase === 'play') {
      var a = Math.min(1, S.banner * 2); c.globalAlpha = a;
      panel(c, P, 50, 230, W - 100, 104, P.accent);
      txt(c, P, g.t('zone') + ' ' + n, W / 2, 262, { size: 14, align: 'center', color: P.accent });
      txt(c, P, g.t('z_' + n), W / 2, 292, { size: 22, align: 'center' });
      txt(c, P, g.t('zs_' + n), W / 2, 316, { size: 11, align: 'center', color: P.muted, weight: 600 });
      c.globalAlpha = 1;
    }
    var b = S.boss;
    if (b && b.active && b.intro > 0) {
      c.globalAlpha = Math.min(1, b.intro * 2);
      panel(c, P, 40, 300, W - 80, 76, P.bad);
      txt(c, P, g.t('b_' + b.key), W / 2, 332, { size: 22, align: 'center', color: P.bad });
      txt(c, P, g.t('bs_' + b.key), W / 2, 356, { size: 11, align: 'center', color: P.muted, weight: 600 });
      c.globalAlpha = 1;
    }
    if (S.phase === 'clear') {
      panel(c, P, 60, 250, W - 120, 80, P.good);
      txt(c, P, g.t('clear'), W / 2, 284, { size: 24, align: 'center', color: P.good });
      txt(c, P, g.t('score') + ': ' + S.score, W / 2, 310, { size: 12, align: 'center', color: P.muted });
    }
    if (S.phase === 'cont') {
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, W, VH);
      panel(c, P, 60, 240, W - 120, 120, P.warn);
      txt(c, P, g.t('cont'), W / 2, 276, { size: 26, align: 'center', color: P.warn });
      txt(c, P, String(Math.max(0, Math.ceil(S.contT - 0.01))), W / 2, 318, { size: 30, align: 'center' });
      txt(c, P, g.t('contHint') + S.continues, W / 2, 344, { size: 11, align: 'center', color: P.muted, weight: 600 });
    }
  }

  var buf = null;
  DS.render = function (ctx, g, S, P, o) {
    o = o || {};
    var t = S.time, c = ctx;
    if (P.pixel && typeof document !== 'undefined') {
      if (!buf) { buf = document.createElement('canvas'); buf.width = W / 2; buf.height = VH / 2; }
      c = buf.getContext('2d'); c.setTransform(0.5, 0, 0, 0.5, 0, 0); c.imageSmoothingEnabled = false;
    }
    c.save();
    if (o.shake) c.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);
    world(c, S, P, t);
    c.restore();
    if (c !== ctx) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, W, VH); ctx.restore(); }
    if (o.bare) return;
    // всплывающие подписи
    (o.toasts || []).forEach(function (q) { var y = q.screen ? q.y : q.y - S.camY; c = ctx; ctx.globalAlpha = Math.min(1, q.t * 2); txt(ctx, P, q.text, q.x, y - (1.4 - q.t) * 16, { size: q.big ? 14 : 11, align: 'center', color: q.color }); ctx.globalAlpha = 1; });
    hud(ctx, g, S, P);
    banners(ctx, g, S, P, t);
  };
  DS.ui = { txt: txt, panel: panel };
})(typeof window !== 'undefined' ? window : globalThis);
