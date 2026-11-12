/* ЗАСЛОН · рендер 8-БИТ (retro). ZASLON.classic = { P, bg, draw, icon, ship, shopIcon, life }
   Свой пиксель-арт: мелкие спрайты — массивы строк (символ = цвет палитры), пререндер ×3;
   боссы и фон — блоками по сетке 4 px. Ограниченная палитра, без сглаживания. */
(function (global) {
  'use strict';
  var Z = global.ZASLON = global.ZASLON || {};
  var PX = 3, GRID = 4;

  var P = {
    pixel: true, font: null,
    ink: '#fcfcfc', muted: '#a49484', dim: '#6c6c6c', accent: '#fc9838', good: '#58d854', bad: '#f83800', warn: '#fce0a8',
    cyan: '#3cbcfc', scrap: '#fcd800', off: '#3c3c3c', line: '#fc9838', selBg: '#401800',
    en: { mite: '#58d854', dart: '#f878f8', weaver: '#9878f8', hulk: '#bcbcbc', carrier: '#fcd800' },
    wpn: { spark: '#fcd800', ray: '#3cbcfc', shot: '#f85838' }
  };
  var COL = {
    w: '#fcfcfc', s: '#bcbcbc', d: '#6c6c6c', k: '#383838', c: '#3cbcfc', o: '#fc9838', f: '#fcd800', r: '#f83800',
    g: '#58d854', G: '#007800', l: '#b8f8b8', m: '#f878f8', M: '#a8005c', y: '#fcd800', p: '#9878f8', P: '#3c1ca8', q: '#f8b8f8',
    b: '#ac7c00', B: '#503000', e: '#f83800'
  };

  var SPR = {
    ship: [[
      '.....w.....',
      '....wcw....',
      '....wcw....',
      '...swwws...',
      '..swwwwws..',
      'o.swwwwws.o',
      'osswwdwwsso',
      'owwwwdwwwwo',
      'ows.swdws.so'.slice(0, 11),
      '....fof....',
      '.....f.....'
    ], [
      '.....w.....',
      '....wcw....',
      '....wcw....',
      '...swwws...',
      '..swwwwws..',
      'o.swwwwws.o',
      'osswwdwwsso',
      'owwwwdwwwwo',
      'ows.swdws.s',
      '....ofo....',
      '....f.f....'
    ]],
    module: [[
      '..w..',
      '.sws.',
      '.ddd.',
      'dsssd',
      'dsssd',
      '.dcd.',
      '..o..'
    ]],
    mite: [[
      'G..ggg..G',
      '.Gggggg G'.replace(' ', '.').slice(0, 9),
      '..glggg..',
      'Gglllggg.',
      '.ggggggg.',
      'Ggggegggg'.slice(0, 9),
      '..ggggg..',
      '.G.ggg.G.',
      'G.......G'
    ], [
      '...ggg...',
      'GGggggg..',
      '..glggg.G',
      '.glllgggG',
      'Gggggggg.',
      '.gggegggG',
      'G.ggggg..',
      '..Gggg.G.',
      '..G...G..'
    ]],
    dart: [[
      'm.........m',
      'mm.......mm',
      '.mmm...mmm.',
      '..mmmmmmm..',
      '...mMyMm...',
      '....mmm....',
      '....mMm....',
      '.....m.....',
      '.....m.....'
    ]],
    weaver: [[
      '....ppp....',
      '..ppppppp..',
      '.ppPPPPPpp.',
      'qppPqqqPppq',
      '.ppPPPPPpp.',
      '..ppppppp..',
      '....ppp....'
    ], [
      '....ppp....',
      '..ppppppp..',
      'qppPPPPPppq',
      '.ppPqqqPpp.',
      'qppPPPPPppq',
      '..ppppppp..',
      '....ppp....'
    ]],
    hulk: [[
      'ssssssssssss',
      'swwwwwwwwwws',
      'sdddddddddds',
      'ssssssssssss',
      'sdddddddddds',
      'ssssssssssss',
      '.ssssssssss.',
      '..ssddddss..',
      '...sooooss..',
      '....soos....'
    ]],
    carrier: [[
      '..BBBBBB..',
      '.Byyyyyyb.',
      'Byywwwwyyb',
      'Byywffwyyb',
      'Byywwwwyyb',
      '.Byyyyyyb.',
      '..BBBBBB..'
    ]]
  };
  // выравнивание строк (защита от опечаток в длине)
  Object.keys(SPR).forEach(function (k) {
    SPR[k].forEach(function (fr) { var w = 0; fr.forEach(function (r) { w = Math.max(w, r.length); }); for (var i = 0; i < fr.length; i++) while (fr[i].length < w) fr[i] += '.'; });
  });

  var cache = {};
  function sprite(name, frame, white) {
    var key = name + frame + (white ? 'w' : '');
    if (cache[key]) return cache[key];
    var fr = SPR[name][frame % SPR[name].length], h = fr.length, w = fr[0].length;
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas'); cv.width = w * PX; cv.height = h * PX;
    var c = cv.getContext('2d');
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = fr[y][x]; if (ch === '.' || ch === ' ') continue;
      c.fillStyle = white ? '#fcfcfc' : (COL[ch] || '#ff00ff'); c.fillRect(x * PX, y * PX, PX, PX);
    }
    cache[key] = cv; return cv;
  }
  function put(ctx, name, frame, x, y, white) {
    var s = sprite(name, frame, white); if (!s) return;
    ctx.drawImage(s, Math.round((x - s.width / 2) / PX) * PX, Math.round((y - s.height / 2) / PX) * PX);
  }
  function blk(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x / GRID) * GRID, Math.round(y / GRID) * GRID, Math.max(GRID, Math.round(w / GRID) * GRID), Math.max(GRID, Math.round(h / GRID) * GRID));
  }
  function disc(ctx, cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (var y = -ry; y <= ry; y += GRID) for (var x = -rx; x <= rx; x += GRID) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) ctx.fillRect(Math.round((cx + x) / GRID) * GRID, Math.round((cy + y) / GRID) * GRID, GRID, GRID);
    }
  }
  function ringPx(ctx, cx, cy, r, n, col, sz) {
    ctx.fillStyle = col; sz = sz || GRID;
    for (var i = 0; i < n; i++) { var a = i * Math.PI * 2 / n; ctx.fillRect(Math.round((cx + Math.cos(a) * r) / 2) * 2 - sz / 2, Math.round((cy + Math.sin(a) * r) / 2) * 2 - sz / 2, sz, sz); }
  }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ---------- Фон: чёрный космос, 2 слоя звёзд, блочные фермы по краям ----------
  var SECT = ['#000068', '#300068', '#003c3c', '#600000', '#600034'];
  function bg(ctx, g, scroll, sector) {
    var W = g.W, H = g.H, i, l;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    var sp = [0.25, 0.8], cols = ['#545454', '#fcfcfc'];
    for (l = 0; l < 2; l++) {
      ctx.fillStyle = cols[l];
      for (i = 0; i < (l ? 22 : 40); i++) {
        var x = Math.floor(hash(i + l * 90) * W / 3) * 3, y = Math.floor(((hash(i * 5 + l * 31) * H + scroll * sp[l]) % H) / 3) * 3;
        ctx.fillRect(x, y, l ? 3 : 2, l ? 3 : 2);
      }
    }
    var seg = 96, off = Math.floor(((scroll * 1.2) % seg) / GRID) * GRID, sc = SECT[((sector || 1) - 1) % 5];
    for (var side = 0; side < 2; side++) {
      for (var k = -1; k < H / seg + 1; k++) {
        var yy = k * seg + off, idx = Math.floor((scroll * 1.2) / seg) - k, w = (3 + Math.floor(hash(idx + side * 50) * 6)) * GRID;
        var x0 = side ? W - w : 0;
        ctx.fillStyle = sc; ctx.fillRect(x0, yy, w, seg - GRID);
        ctx.fillStyle = '#000'; for (var j = GRID * 2; j < seg - GRID * 2; j += GRID * 3) ctx.fillRect(side ? x0 + GRID : x0 + w - GRID * 2, yy + j, GRID, GRID);
        ctx.fillStyle = '#545454'; ctx.fillRect(side ? x0 : x0 + w - GRID, yy, GRID, seg - GRID);
      }
    }
  }

  function ship(ctx, x, y, g, o) {
    o = o || {};
    var f = Math.floor(g.time * 12) % 2;
    if (o.modules) for (var m = 0; m < o.modules; m++) put(ctx, 'module', 0, x + (m === 0 ? -Z.consts.MOD_DX : Z.consts.MOD_DX), y + 6);
    put(ctx, 'ship', f, x, y);
    if (o.shield) { if (Math.floor(g.time * 8) % 3) ringPx(ctx, x, y - 1, 24, 14, '#3cbcfc', 3); }
  }
  function life(ctx, x, y) { ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x - 1, y - 6, 3, 3); ctx.fillRect(x - 4, y - 3, 9, 3); ctx.fillRect(x - 7, y, 15, 3); ctx.fillStyle = '#fc9838'; ctx.fillRect(x - 1, y + 3, 3, 3); }

  function enemy(ctx, e, t) {
    var white = e.hurtT > 0, f = Math.floor(t * 6 + e.x) % 2;
    put(ctx, e.kind, e.kind === 'mite' || e.kind === 'weaver' ? f : 0, e.x, e.y, white);
    if (e.kind === 'hulk' && e.max > 1) { blk(ctx, e.x - 16, e.y - 26, 32, 4, '#3c3c3c'); if (e.hp > 0) blk(ctx, e.x - 16, e.y - 26, 32 * e.hp / e.max, 4, '#fc9838'); }
  }
  function icon(ctx, kind, x, y) { put(ctx, kind, 0, x, y); }

  function boss(ctx, B, t) {
    var x = B.x, y = B.y, W1 = null, i;   // без «белой» заливки: босс под огнём постоянно
    if (B.kind === 'millstone') {
      for (i = 0; i < 8; i++) { var a = B.spin + i * Math.PI / 4; blk(ctx, x + Math.cos(a) * 42 - 6, y + Math.sin(a) * 30 - 6, 12, 12, W1 || '#6c6c6c'); }
      disc(ctx, x, y, 38, 28, W1 || '#bcbcbc'); disc(ctx, x, y, 28, 20, W1 || '#6c6c6c');
      disc(ctx, x, y, 14, 12, Math.floor(t * 8) % 2 ? '#fc9838' : '#fcd800');
    } else if (B.kind === 'pincer') {
      var op = Math.round(Math.sin(t * 3) * 2) * GRID;
      for (var s = -1; s <= 1; s += 2) {
        blk(ctx, x + s * 40 - 8, y - 12, 16, 28, W1 || '#a80000');
        blk(ctx, x + s * 40 - 8 + s * op, y + 16, 8, 12, W1 || '#f83800'); blk(ctx, x + s * 40 + s * op, y + 16, 8, 8, W1 || '#fc9838');
      }
      blk(ctx, x - 30, y - 24, 60, 44, W1 || '#f83800'); blk(ctx, x - 24, y - 20, 48, 8, '#fc9838');
      blk(ctx, x - 16, y - 4, 32, 8, '#000'); blk(ctx, x - 14 + (Math.floor(t * 6) % 6) * 4, y - 4, 8, 8, '#fcd800');
    } else if (B.kind === 'hive') {
      var cells = [[0, 0], [-20, -12], [20, -12], [-20, 12], [20, 12], [0, -24], [0, 24], [-40, 0], [40, 0]];
      for (i = 0; i < cells.length; i++) {
        disc(ctx, x + cells[i][0], y + cells[i][1], 12, 12, W1 || (i === 0 ? '#fcd800' : '#ac7c00'));
        if ((Math.floor(t * 4) + i) % 3 === 0) blk(ctx, x + cells[i][0] - 4, y + cells[i][1] - 4, 8, 8, '#fce0a8');
      }
    } else if (B.kind === 'pendulum') {
      var px = W1 ? x : x, top = 0, dx = -(x - 240) * 0.4;
      for (var yy = top; yy < y - 30; yy += GRID * 2) blk(ctx, px + dx * (1 - (yy - top) / (y - 30 - top)) - 2, yy, 4, 4, '#6c6c6c');
      disc(ctx, x, y, 32, 32, W1 || '#bcbcbc'); disc(ctx, x, y + 4, 16, 10, '#000');
      disc(ctx, x, y + 4, 6, 6, B.beam ? '#f83800' : '#3cbcfc');
    } else if (B.kind === 'forge') {
      var ph = B.phaseN || 1, glow = ph === 1 ? '#fc9838' : ph === 2 ? '#f83800' : '#f878f8';
      blk(ctx, x - 56, y - 36, 112, 72, W1 || '#503000'); blk(ctx, x - 48, y - 30, 96, 16, '#6c6c6c');
      blk(ctx, x - 32, y - 8, 64, 36, Math.floor(t * 10) % 2 ? glow : '#fcd800');
      for (i = -3; i <= 3; i++) blk(ctx, x + i * 9 - 2, y - 8, 4, 36, '#000');
      blk(ctx, x - 60, y - 4, 8, 12, glow); blk(ctx, x + 52, y - 4, 8, 12, glow);
    }
  }
  function beam(ctx, Bm, H, t) {
    if (!Bm) return;
    if (Bm.t < Bm.warn) {
      if (Math.floor(t * 12) % 2) for (var y = 0; y < H; y += 16) { blk(ctx, Bm.x - 16, y, 4, 8, '#f83800'); blk(ctx, Bm.x + 12, y, 4, 8, '#f83800'); }
    } else {
      blk(ctx, Bm.x - 16, 0, 32, H, '#f83800'); blk(ctx, Bm.x - 8, 0, 16, H, Math.floor(t * 20) % 2 ? '#fcfcfc' : '#fce0a8');
    }
  }
  function wpnGlyph(ctx, type, x, y, col) {
    ctx.fillStyle = col;
    if (type === 'spark') { ctx.fillRect(x - 1, y - 6, 3, 12); ctx.fillRect(x - 7, y - 6, 3, 3); ctx.fillRect(x - 5, y - 3, 3, 3); ctx.fillRect(x + 5, y - 6, 3, 3); ctx.fillRect(x + 3, y - 3, 3, 3); }
    else if (type === 'ray') { ctx.fillRect(x - 3, y - 7, 6, 14); }
    else { ctx.fillRect(x - 6, y - 6, 3, 3); ctx.fillRect(x + 3, y - 6, 3, 3); ctx.fillRect(x - 1, y - 2, 3, 3); ctx.fillRect(x - 6, y + 3, 3, 3); ctx.fillRect(x + 3, y + 3, 3, 3); }
  }

  function draw(ctx, S, g) {
    var W = g.W, H = g.H, t = g.time, i, p = S.player;
    bg(ctx, g, S.scroll, S.sector);
    if (S.baseHitT > 0 && Math.floor(t * 20) % 2) { ctx.fillStyle = '#a80000'; ctx.fillRect(0, H - 16, W, 16); }
    Z.ui.barrier(ctx, 0, Z.consts.BREACH_Y, W, S.base / 100, t, P);
    for (i = 0; i < S.scraps.length; i++) { var sc = S.scraps[i], ff = Math.floor(t * 8 + i) % 2; ctx.fillStyle = ff ? '#fcd800' : '#ac7c00'; ctx.fillRect(Math.round(sc.x) - 3, Math.round(sc.y) - 3, 6, 6); ctx.fillStyle = '#fcfcfc'; if (ff) ctx.fillRect(Math.round(sc.x) - 1, Math.round(sc.y) - 1, 2, 2); }
    for (i = 0; i < S.caps.length; i++) {
      var c = S.caps[i], col = P.wpn[c.ty];
      blk(ctx, c.x - 12, c.y - 12, 24, 24, Math.floor(t * 6) % 2 ? col : '#fcfcfc'); blk(ctx, c.x - 8, c.y - 8, 16, 16, '#000');
      wpnGlyph(ctx, c.ty, Math.round(c.x), Math.round(c.y), col);
    }
    for (i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead) enemy(ctx, S.enemies[i], t);
    if (S.boss) { beam(ctx, S.boss.beam, H, t); boss(ctx, S.boss, t); }
    if (p.ray) {
      var R = p.ray, w = Math.round(R.w / 2) * 2, stripe = Math.floor(t * 30) % 2;
      for (var yy = Math.max(0, Math.floor(R.y1 / 6) * 6); yy < R.y0; yy += 6) {
        ctx.fillStyle = ((yy / 6) % 2) ^ stripe ? '#3cbcfc' : '#fcfcfc'; ctx.fillRect(Math.round(R.x - w / 2), yy, w, 6);
      }
      if (R.y1 > 0) ringPx(ctx, R.x, R.y1, w / 2 + 6, 8, '#fcfcfc', 3);
    }
    for (i = 0; i < S.pb.length; i++) {
      var b = S.pb[i], bx = Math.round(b.x), by = Math.round(b.y);
      if (b.k === 'shot') { ctx.fillStyle = '#f85838'; ctx.fillRect(bx - 2, by - 2, 4, 4); }
      else if (b.k === 'mod') { ctx.fillStyle = '#3cbcfc'; ctx.fillRect(bx - 1, by - 5, 3, 9); }
      else { ctx.fillStyle = '#fcd800'; ctx.fillRect(bx - 1, by - 5, 3, 9); ctx.fillStyle = '#fcfcfc'; ctx.fillRect(bx - 1, by - 5, 3, 3); }
    }
    if (p.alive && !(p.inv > 0 && Math.floor(t * 14) % 2 && S.phase !== 'shop')) ship(ctx, p.x, p.y, g, { modules: p.modules, shield: p.shield > 0 });
    for (i = 0; i < S.eb.length; i++) {
      var q = S.eb[i], qx = Math.round(q.x), qy = Math.round(q.y);
      ctx.fillStyle = Math.floor(t * 16) % 2 ? '#f83800' : '#fc9838'; ctx.fillRect(qx - 4, qy - 4, 8, 8);
      ctx.fillStyle = '#fcfcfc'; ctx.fillRect(qx - 1, qy - 1, 3, 3);
    }
    for (i = 0; i < S.booms.length; i++) {
      var o = S.booms[i], k = o.t / o.life, r = o.r * (0.3 + k);
      ringPx(ctx, o.x, o.y, r, 12, o.base ? '#3cbcfc' : (k < 0.5 ? '#fcd800' : '#f83800'), k < 0.5 ? 6 : 4);
      if (k < 0.3) disc(ctx, o.x, o.y, r * 0.5, r * 0.5, '#fcfcfc');
    }
    if (S.flash > 0 && Math.floor(t * 20) % 2) { ctx.fillStyle = 'rgba(252,252,252,.6)'; ctx.fillRect(0, 0, W, H); }
  }

  function shopIcon(ctx, key, x, y, g, S) {
    var p = S.player;
    if (key === 'weapon') wpnGlyph(ctx, p.weapon, x, y - 4, P.wpn[p.weapon]);
    else if (key === 'module') put(ctx, 'module', 0, x, y - 4);
    else if (key === 'shield') ringPx(ctx, x, y - 4, 9, 10, P.cyan, 3);
    else if (key === 'bomb') { ctx.fillStyle = P.cyan; ctx.fillRect(x - 2, y - 13, 4, 18); ctx.fillRect(x - 9, y - 6, 18, 4); ctx.fillRect(x - 6, y - 10, 4, 4); ctx.fillRect(x + 2, y - 10, 4, 4); ctx.fillRect(x - 6, y - 2, 4, 4); ctx.fillRect(x + 2, y - 2, 4, 4); }
    else if (key === 'repair') { ctx.fillStyle = P.cyan; ctx.fillRect(x - 10, y, 20, 4); ctx.fillStyle = P.good; ctx.fillRect(x - 2, y - 12, 4, 10); ctx.fillRect(x - 6, y - 9, 12, 4); }
    else if (key === 'life') life(ctx, x, y - 3);
    else if (key === 'next') { ctx.fillStyle = P.good; for (var i = 0; i < 4; i++) ctx.fillRect(x - 7 + i * 4, y - 12 + i * 2, 4, 16 - i * 4); }
  }

  Z.classic = { P: P, bg: bg, draw: draw, icon: icon, ship: ship, shopIcon: shopIcon, life: life };
})(typeof window !== 'undefined' ? window : globalThis);
