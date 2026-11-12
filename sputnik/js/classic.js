/* СПУТНИК · рендер RETRO (8-бит). SPUTNIK.classic = { P, bg, draw, lifeIcon }
   Чёрный космос в пиксельных звёздах, 16-цветная палитра, свой пиксель-арт 2×: корабль «Горн»,
   дрон «Наковальня» (раскалённый шар с ободом), моль, дротик, пушка, шагоход, мина, жало, носитель.
   Рельеф — ступенчатые колонки 8 px с узором-дизерингом и яркой кромкой. Логику не трогает. */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK = global.SPUTNIK || {};
  var L = Sp.logic, TAU = Math.PI * 2;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#ff5555', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55',
    good: '#55ff55', bad: '#ff5555', panel: '#000000', panelA: '#000000', bar: '#555555', bossBar: '#ff5555', charge: '#55ffff'
  };
  var ROCK = {   // [порода, узор, кромка]
    orbit: ['#555555', '#000000', '#aaaaaa'], slag: ['#aa5500', '#550000', '#ff5555'], gears: ['#0000aa', '#000055', '#5555ff'],
    channel: ['#555555', '#aa0000', '#ff5555'], hive: ['#aa00aa', '#550055', '#ff55ff'], heart: ['#aa0000', '#550000', '#ffff55']
  };
  var CAP = { R: '#55ffff', S: '#55ff55', V: '#ffff55', O: '#ffffff' };

  // пиксель-арт: 1 символ = 2×2 px; '.' — прозрачно
  var SPR = {
    ship: [
      '..##..............',
      '..#####...........',
      '..#bbbbbbbbbb.....',
      '.f#bbbwwwbbbbbo...',
      'ff#bbbbbbbbbbbooo.',
      '.f#bbbbbbbbbbo....',
      '..#dddddddddd.....',
      '..#####...........',
      '..##..............'
    ],
    moth: [[
      '..m......',
      '.mm......',
      'mmmmmmmm.',
      'gmmmmmmmm',
      'mmmmmmmm.',
      '.mm......',
      '..m......'
    ], [
      '.........',
      '...m.....',
      'mmmmmmmm.',
      'gmmmmmmmm',
      'mmmmmmmm.',
      '...m.....',
      '.........'
    ]],
    dart: [
      '...........',
      'r....wwww..',
      'rrwwwwwwwww',
      'r....wwww..',
      '...........'
    ],
    walker: [[
      '..cc.......',
      '...cc......',
      '.bbbbbbbbb.',
      '.byybbbbbb.',
      '.bbbbbbbbb.',
      '..d.....d..',
      '.d.......d.'
    ], [
      '..cc.......',
      '...cc......',
      '.bbbbbbbbb.',
      '.byybbbbbb.',
      '.bbbbbbbbb.',
      '...d...d...',
      '...d...d...'
    ]],
    stinger: [
      '..cc.....',
      '.cccc....',
      'yykyykyyw',
      'yykyykyyww',
      '.kyykyy..'
    ]
  };
  var SCOL = { '#': '#aaaaaa', b: '#aa5500', w: '#55ffff', o: '#ffff55', f: '#ff5555', d: '#555555', m: '#aa00aa', g: '#55ff55', r: '#ff5555', c: '#aaaaaa', y: '#ffff55', k: '#000000' };
  function spr(ctx, rows, x, y, map, flip) {
    var h = rows.length, w = rows[0].length, x0 = Math.round(x / 2) * 2 - w, y0 = Math.round(y / 2) * 2 - h;
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) {
      var ch = rows[r].charAt(flip ? w - 1 - c : c); if (ch === '.' || !ch) continue;
      ctx.fillStyle = (map && map[ch]) || SCOL[ch] || '#ffffff'; ctx.fillRect(x0 + c * 2, y0 + r * 2, 2, 2);
    }
  }
  function pc(ctx, x, y, r, col, s) {   // круг из «пикселей» s×s
    s = s || 2; ctx.fillStyle = col;
    for (var yy = -r; yy <= r; yy += s) { var w = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy)) / s) * s; ctx.fillRect(Math.round((x - w) / s) * s, Math.round((y + yy) / s) * s, 2 * w + s, s); }
  }
  function q(v) { return Math.round(v / 2) * 2; }

  // ---------- Фон ----------
  var stars = null, pats = {};
  function bg(ctx, g, S) {
    var cx = S ? S.cx : g.time * 40;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H);
    if (!stars) { stars = []; for (var i = 0; i < 90; i++) { var h1 = Math.sin(i * 91.7) * 1e4, h2 = Math.sin(i * 47.3) * 1e4; stars.push({ x: (h1 - Math.floor(h1)) * 1280, y: L.TOP + (h2 - Math.floor(h2)) * (L.H - L.TOP), z: i % 3 ? 0.15 : 0.45 }); } }
    for (var k = 0; k < stars.length; k++) { var s = stars[k], x = ((s.x - cx * s.z) % 1280 + 1280) % 1280; if (x > g.W) continue; ctx.fillStyle = s.z > 0.3 ? '#ffffff' : '#555555'; ctx.fillRect(q(x), q(s.y), 2, 2); }
  }
  function pattern(ctx, name) {
    if (pats[name]) return pats[name];
    var c = document.createElement('canvas'); c.width = c.height = 8; var x = c.getContext('2d'), R = ROCK[name];
    x.fillStyle = R[0]; x.fillRect(0, 0, 8, 8); x.fillStyle = R[1]; x.fillRect(0, 0, 2, 2); x.fillRect(4, 4, 2, 2); x.fillRect(6, 0, 2, 2);
    pats[name] = ctx.createPattern(c, 'repeat'); return pats[name];
  }
  function terrain(ctx, S, game) {
    var R = ROCK[S.name], cx = S.cx, x0 = Math.floor(cx / 8) * 8, pat = pattern(ctx, S.name);
    ctx.save(); ctx.translate(-(cx % 8 === 0 ? 0 : 0), 0);
    for (var x = x0; x < cx + L.W + 8; x += 8) {
      var sx = Math.round(x - cx), cy = q(game._ceilY(x + 4)), fy = q(game._floorY(x + 4));
      ctx.fillStyle = pat;
      if (cy > L.TOP) ctx.fillRect(sx, L.TOP, 8, cy - L.TOP);
      ctx.fillRect(sx, fy, 8, L.H - fy);
      ctx.fillStyle = R[2];
      if (cy > L.TOP) ctx.fillRect(sx, cy - 2, 8, 2);
      ctx.fillRect(sx, fy, 8, 2);
    }
    ctx.restore();
    S.lv.mechs.forEach(function (m) {
      var sx = m.x - S.cx; if (sx < -60 || sx > L.W + 60) return;
      var gm = game._mechRects(m);
      if (m.kind === 'piston') {
        var x = q(gm.x0 - S.cx), w = q(gm.x1 - gm.x0), y0 = q(Math.max(L.TOP, gm.y0)), y1 = q(Math.min(L.H, gm.y1));
        ctx.fillStyle = '#aaaaaa'; ctx.fillRect(x + 4, y0, w - 8, y1 - y0); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 8, y0, 2, y1 - y0);
        var ty = m.side === 'c' ? y1 - 8 : y0;
        for (var k = 0; k < w; k += 4) { ctx.fillStyle = (k / 4) % 2 ? '#ffff55' : '#000000'; ctx.fillRect(x + k, ty, 4, 8); }
      } else {
        var gx = gm.cx - S.cx, gy = gm.cy;
        pc(ctx, gx, gy, gm.r + 3, '#555555', 4);
        pc(ctx, gx, gy, gm.r - 3, '#aaaaaa', 2);
        var a = m.rot || 0; ctx.fillStyle = '#555555';
        for (var t2 = 0; t2 < 4; t2++) { var aa = a + t2 * Math.PI / 2; ctx.fillRect(q(gx + Math.cos(aa) * (gm.r + 4)) - 3, q(gy + Math.sin(aa) * (gm.r + 4)) - 3, 6, 6); }
        pc(ctx, gx, gy, 4, '#000000', 2);
      }
    });
  }

  // ---------- Сущности ----------
  function drone(ctx, x, y, t, o) {
    o = o || {}; var r = L.DRONE_R, hot = Math.floor(t * 8) % 2;
    pc(ctx, x, y, r + 1, '#aa0000', 2);
    pc(ctx, x, y, r - 1, '#ff5555', 2);
    pc(ctx, x - 2, y - 3, 5, hot ? '#ffff55' : '#ffffff', 2);
    ctx.fillStyle = '#555555'; ctx.fillRect(q(x - r - 1), q(y - 1), 2 * r + 4, 2);
    ctx.fillStyle = '#ffffff'; var sp = o.spin || t * 3;
    for (var k = 0; k < 3; k++) ctx.fillRect(q(x - r + ((k * 8 + sp * 6) % (2 * r))), q(y - 1), 2, 2);
    if (o.glow > 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(q(x - r - 4), q(y), 2, 2); ctx.fillRect(q(x + r + 2), q(y), 2, 2); ctx.fillRect(q(x), q(y - r - 4), 2, 2); ctx.fillRect(q(x), q(y + r + 2), 2, 2); }
    if (o.kind) { ctx.fillStyle = CAP[o.kind]; ctx.fillRect(q(x) - 2, q(y - r - 6), 4, o.lvl >= 2 ? 4 : 2); }
  }
  function ship(ctx, x, y, t, o) {
    o = o || {};
    spr(ctx, SPR.ship, x + 2, y, { f: Math.floor(t * 20) % 2 ? '#ff5555' : '#ffff55' });
    if (o.charge > 0) { var r = 2 + Math.round(o.charge * 6); pc(ctx, x + 22, y, r, o.charge >= 1 && Math.floor(t * 12) % 2 ? '#ffff55' : '#55ffff', 2); }
  }
  function optic(ctx, x, y) { ctx.fillStyle = '#55ffff'; ctx.fillRect(q(x) - 2, q(y) - 6, 4, 12); ctx.fillRect(q(x) - 6, q(y) - 2, 12, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(q(x) - 2, q(y) - 2, 4, 4); }
  function capsule(ctx, x, y, type, t) {
    var c = CAP[type] || '#fff';
    ctx.fillStyle = Math.floor(t * 6) % 2 ? c : '#ffffff'; ctx.fillRect(q(x) - 10, q(y) - 6, 20, 12);
    ctx.fillStyle = '#000'; ctx.fillRect(q(x) - 8, q(y) - 4, 16, 8);
    ctx.fillStyle = c; ctx.font = '900 10px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText(type, q(x), q(y) + 4);
  }
  var EN = {
    moth: function (ctx, e, x, y, t) { spr(ctx, SPR.moth[Math.floor(e.t * 8) % 2], x + 1, y); },
    dart: function (ctx, e, x, y) { spr(ctx, SPR.dart, x + 2, y); },
    turret: function (ctx, e, x, y) {
      var up = e.side === 'c' ? -1 : 1, a = e.aim || Math.PI;
      pc(ctx, x, y + 3 * up, 9, '#aa5500', 2);
      ctx.fillStyle = '#000'; ctx.fillRect(q(x - 10), q(y + (up > 0 ? 6 : -10)), 20, 6);
      ctx.fillStyle = '#aaaaaa'; for (var k = 4; k <= 14; k += 2) ctx.fillRect(q(x + Math.cos(a) * k), q(y + Math.sin(a) * k), 2, 2);
      ctx.fillStyle = '#ff5555'; ctx.fillRect(q(x) - 2, q(y) - 2, 4, 4);
    },
    walker: function (ctx, e, x, y) { spr(ctx, SPR.walker[Math.floor((e.step || 0) / 2) % 2], x + 1, y + 2); },
    mine: function (ctx, e, x, y, t) {
      pc(ctx, x, y, 9, '#555555', 2); pc(ctx, x, y, 6, '#aaaaaa', 2);
      ctx.fillStyle = '#aaaaaa'; var a = e.rot || 0; for (var k = 0; k < 4; k++) { var aa = a + k * Math.PI / 2; ctx.fillRect(q(x + Math.cos(aa) * 12) - 2, q(y + Math.sin(aa) * 12) - 2, 4, 4); }
      if (Math.floor(t * 4) % 2) { ctx.fillStyle = '#ff5555'; ctx.fillRect(q(x) - 2, q(y) - 2, 4, 4); }
    },
    stinger: function (ctx, e, x, y, t) {
      if (e.warn > 0) { if (Math.floor(t * 8) % 2) { ctx.fillStyle = '#ffff55'; ctx.fillRect(2, q(e.y0) - 6, 4, 12); ctx.fillRect(6, q(e.y0) - 4, 4, 8); ctx.fillRect(10, q(e.y0) - 2, 4, 4); } return; }
      spr(ctx, SPR.stinger, x + 1, y);
    },
    pod: function (ctx, e, x, y, t) { ctx.fillStyle = '#aaaaaa'; ctx.fillRect(q(x) - 14, q(y) - 10, 28, 2); ctx.fillRect(q(x) - 14, q(y) + 8, 28, 2); ctx.fillRect(q(x) - 14, q(y) - 10, 2, 20); ctx.fillRect(q(x) + 12, q(y) - 10, 2, 20); capsule(ctx, x, y, e.cap, t); },
    guard: function (ctx, e, x, y, t) {
      var a = t * 0.6; ctx.fillStyle = '#555555';
      for (var k = 0; k < 6; k++) { var aa = a + k * TAU / 6; ctx.fillRect(q(x + Math.cos(aa) * 26) - 5, q(y + Math.sin(aa) * 26) - 5, 10, 10); }
      pc(ctx, x, y, 23, '#aa5500', 2); pc(ctx, x - 6, y, 9, '#000000', 2);
      ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ff5555' : '#ffff55'; ctx.fillRect(q(x - 9), q(y) - 3, 6, 6);
    }
  };
  var BC = { crucible: ['#aa5500', '#555555'], hammer: ['#aaaaaa', '#555555'], worm: ['#aa5500', '#ffff55'], hive: ['#aa00aa', '#550055'], mirror: ['#55ffff', '#5555ff'], heart: ['#aa0000', '#ff5555'] };
  function boss(ctx, B, sx, t) {
    var c = BC[B.type];
    if (B.type === 'worm') {
      for (var i = B.segs.length - 2; i >= 0; i--) { var s = B.segs[i]; pc(ctx, s.x - sx, s.y, i === 0 ? 18 : 15, i % 2 ? c[0] : '#aa0000', 2); pc(ctx, s.x - sx, s.y, 6, '#000', 2); }
      ctx.fillStyle = '#ff5555'; ctx.fillRect(q(B.segs[0].x - sx) - 3, q(B.segs[0].y) - 3, 6, 6);
    } else if (B.type === 'mirror') {
      var x = B.x - sx, y = B.y;
      [-46, 46].forEach(function (dy) { pc(ctx, x + 34, y + dy, 17, c[1], 2); });
      for (var r = -44; r <= 44; r += 4) { var w = 46 - Math.abs(r); ctx.fillStyle = r < 0 ? c[0] : '#aaaaaa'; ctx.fillRect(q(x + 10 - w), q(y + r), 2 * w + 4, 4); }
    } else {
      for (var k = B.armor.length - 1; k >= 0; k--) {
        var a = B.armor[k]; if (a === B.head) continue;
        pc(ctx, a.x - sx, a.y, a.r, a.part ? '#aaaaaa' : (k ? c[1] : c[0]), a.r > 30 ? 4 : 2);
        if (a.r > 30) { pc(ctx, a.x - sx + 4, a.y, a.r * 0.68, c[1], 4); pc(ctx, a.x - sx + 6, a.y, a.r * 0.42, c[0], 4); }
        if (a.part) { ctx.fillStyle = '#555555'; ctx.fillRect(q(a.x - sx) - 30, q(a.y) - 4, 16, 8); }
      }
      if (B.type === 'hammer') { var H = B.head, hx = q(H.x - sx), hy = q(H.y); ctx.fillStyle = '#aa5500'; for (var u = 0; u < 10; u++) ctx.fillRect(q(B.x - sx - 10 + (hx - (B.x - sx - 10)) * u / 10), q(B.y - 12 + (hy - B.y + 12) * u / 10), 4, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - 22, hy - 20, 44, 40); ctx.fillStyle = '#555555'; ctx.fillRect(hx - 18, hy - 16, 36, 32); }
      if (B.type === 'heart') B.parts.forEach(function (p) { if (p.alive) { ctx.fillStyle = '#ffff55'; ctx.fillRect(q(p.x - sx) - 2, q(p.y) - 2, 4, 4); } });
    }
    var wx = B.weak.x - sx, wy = B.weak.y;
    if (B.open) { pc(ctx, wx, wy, B.weak.r, Math.floor(t * 10) % 2 ? '#ffff55' : '#ffffff', 2); pc(ctx, wx, wy, 4, '#ff5555', 2); }
    else if (B.type !== 'worm') { pc(ctx, wx, wy, B.weak.r + 1, '#aaaaaa', 2); ctx.fillStyle = '#000'; ctx.fillRect(q(wx - B.weak.r), q(wy) - 1, 2 * B.weak.r + 2, 2); }
    if (B.flash > 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(q(wx) - 4, q(wy) - 4, 8, 8); }
  }
  function laser(ctx, S) {
    var Lz = S.laser; if (!Lz) return;
    var x0 = Math.max(0, q(Lz.x0 - S.cx)), x1 = q(Lz.x1 - S.cx);
    if (Lz.h > 0) { ctx.fillStyle = '#55ffff'; ctx.fillRect(x0, q(Lz.y - Lz.h), x1 - x0, q(Lz.h * 2)); ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, q(Lz.y) - 2, x1 - x0, 4); }
    else if (Math.floor(S.time * 10) % 2) { ctx.fillStyle = '#ff5555'; for (var x = x0; x < x1; x += 12) ctx.fillRect(x, q(Lz.y), 6, 2); }
  }
  function shotDraw(ctx, s, x, t) {
    var y = q(s.y); x = q(x);
    switch (s.kind) {
      case 'shot': ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 6, y - 1, 10, 2); break;
      case 'opt': ctx.fillStyle = '#55ffff'; ctx.fillRect(x - 4, y, 8, 2); break;
      case 'dshot': ctx.fillStyle = '#ffff55'; ctx.fillRect(x - 2, y - 2, 4, 4); break;
      case 'ric': ctx.fillStyle = '#55ffff'; ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillRect(q(x - s.vx * 0.012) - 2, q(s.y - s.vy * 0.012) - 1, 4, 2); break;
      case 'crawl': ctx.fillStyle = Math.floor(t * 20) % 2 ? '#55ff55' : '#ffffff'; ctx.fillRect(x - 4, y - 2, 4, 4); ctx.fillStyle = '#55ff55'; ctx.fillRect(x - 8 * (s.dir || 1), y - 1, 2, 2); break;
      case 'fan': ctx.fillStyle = '#ffff55'; ctx.fillRect(x - 2, y - 2, 4, 4); break;
      case 'beam': { var h = q(s.h); ctx.fillStyle = '#55ffff'; ctx.fillRect(x - 30, y - h / 2, 40, h); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 26, y - Math.max(2, h / 4), 36, Math.max(4, h / 2)); break; }
    }
  }
  function bullet(ctx, b, x) {
    var big = b.kind === 'big', s = big ? 8 : 6;
    ctx.fillStyle = big ? '#ff5555' : '#ff55ff'; ctx.fillRect(q(x) - s / 2, q(b.y) - s / 2, s, s);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(q(x) - 1, q(b.y) - 1, 2, 2);
  }
  function scan(ctx, W, H) { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var y = 1; y < H; y += 3) ctx.fillRect(0, y, W, 1); }
  function fxDraw(ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var f = list[i], k = f.t / f.life, r = f.r * (1.2 - k); ctx.fillStyle = f.color;
      for (var a = 0; a < 8; a++) { var aa = a / 8 * TAU; ctx.fillRect(q(f.x + Math.cos(aa) * r) - 1, q(f.y + Math.sin(aa) * r) - 1, 2, 2); }
    }
  }

  function draw(ctx, S, g, o) {
    o = o || {}; var t = S.time, sx = S.cx, game = o.game;
    bg(ctx, g, S);
    if (game) terrain(ctx, S, game);
    if (S.boss && S.boss.alive) { laser(ctx, S); boss(ctx, S.boss, sx, t); }
    S.caps.forEach(function (c) { capsule(ctx, c.x - sx, c.y, c.type, t); });
    S.enemies.forEach(function (e) {
      if (!e.alive) return; var x = e.x - sx;
      if (e.flash > 0 && e.type !== 'stinger' && Math.floor(t * 30) % 2) { pc(ctx, x, e.y, e.r, '#ffffff', 2); return; }
      EN[e.type](ctx, e, x, e.y, t);
    });
    S.shots.forEach(function (s) { shotDraw(ctx, s, s.x - sx, t); });
    var sh = S.ship, D = S.drone;
    S.optics.forEach(function (op) { optic(ctx, op.x - sx, op.y); });
    if (!sh.dead && !(sh.grace > 0 && Math.floor(t * 12) % 2)) ship(ctx, sh.x - sx, sh.y, t, { charge: S.fire.charge });
    if (!sh.dead || S.phase !== 'dead') drone(ctx, D.x - sx, D.y, t, { spin: D.spin, glow: D.glow, kind: D.kind, lvl: D.lvl });
    S.bullets.forEach(function (b) { bullet(ctx, b, b.x - sx); });
    if (o.fx) fxDraw(ctx, o.fx);
    scan(ctx, g.W, g.H);
    if (o.bare) return;
    Sp.ui.hud(g, ctx, S, P, lifeIcon);
    Sp.ui.bossBar(g, ctx, S, P);
    Sp.ui.banner(g, ctx, S, P);
    if (o.toasts) Sp.ui.toasts(g, ctx, o.toasts, P);
  }
  function lifeIcon(ctx, x, y, on) {
    ctx.fillStyle = on ? '#ffff55' : '#555555';
    ctx.fillRect(x - 7, y - 3, 10, 6); ctx.fillRect(x + 3, y - 1, 4, 2); ctx.fillRect(x - 7, y - 5, 2, 10);
  }

  Sp.classic = { P: P, bg: bg, draw: draw, lifeIcon: lifeIcon, ship: ship, drone: drone, SPR: SPR, EN: EN };
})(typeof window !== 'undefined' ? window : globalThis);
