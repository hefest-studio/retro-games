/* ФИТИЛЬ · рендер RETRO (8-бит). FITIL.classic = { P, bg, draw, glyph, face }
   Пиксельные спрайты 10×10 (пиксель = 4 px), палитра в духе ранних 8-битных машин:
   чёрный пол в синей сетке, синие кирпичные колонны, рыжие ящики в штриховку, сканлайны. */
(function (global) {
  'use strict';
  var F = global.FITIL = global.FITIL || {};
  var L = F.logic, T = 40, OY = 48, PX = 4;

  var P = {
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    hudBg: '#000000', hudLine: '#5555ff', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffaa00', good: '#55ff55', bad: '#ff5555',
    panel: '#000000', line: '#5555ff', bar: '#333333', bossBar: '#ff5555',
    pl: ['#ffaa00', '#55ffff'], plDark: ['#aa5500', '#00aaaa'],
    en: { wander: '#ff55ff', chaser: '#ff5555', ghost: '#aaaaaa', fast: '#ffff55' },
    pw: { bomb: '#aaaaff', flame: '#ff5555', speed: '#55ff55', kick: '#ffff55', relay: '#55ffff' }
  };

  // Спрайты: '.' — прозрачно, a — основной цвет, b — тёмный, w — белый, k — чёрный, y — искра
  var SPR = {
    sapper: ['...bbbb...', '..baaaab..', '.baaaaaab.', '.bwkwwkwb.', '..wwwwww..', '.aaaaaaaa.', 'a.aaaaaa.a', '..aaaaaa..', '..bb..bb..', '.kk....kk.'],
    sapper2: ['...bbbb...', '..baaaab..', '.baaaaaab.', '.bwkwwkwb.', '..wwwwww..', '.aaaaaaaa.', 'a.aaaaaa.a', '..aaaaaa..', '...bbbb...', '...k..k...'],
    sapperUp: ['...bbbb...', '..baaaab..', '.baaaaaab.', '.bbbbbbbb.', '..bbbbbb..', '.aaaaaaaa.', 'a.aaaaaa.a', '..aaaaaa..', '..bb..bb..', '.kk....kk.'],
    wander: ['..aaaaaa..', '.aaaaaaaa.', 'aaawwwwaaa', 'aawwkkwwaa', 'aawwkkwwaa', 'aaawwwwaaa', 'aaaaaaaaaa', '.aaaaaaaa.', '.bb....bb.', 'bbb....bbb'],
    chaser: ['a........a', 'aa......aa', '.aaaaaaaa.', 'aawwaawwaa', 'aakwaakwaa', 'aaaaaaaaaa', '.awawawaw.', '.aaaaaaaa.', '..aa..aa..', '.aa....aa.'],
    ghost: ['..aa..aa..', '.aaaaaaaa.', 'aaaaaaaaaa', 'aakkaakkaa', '.aaaaaaaa.', 'aaaaaaaaaa', '.aa.aa.aa.', '..........', '...a..a...', '....a.....'],
    fast: ['....kk....', '...aaaa...', '.aaaaaaaa.', 'abbaabbaab', 'aaaaaaaaaa', '.awkaawka.', '..aaaaaa..', '...aaaa...', '....aa....', '....kk....'],
    fast2: ['....kk....', '...aaaa...', '.aaaaaaaa.', 'baabbaabba', 'aaaaaaaaaa', '.awkaawka.', '..aaaaaa..', '...aaaa...', '....aa....', '....kk....'],
    bomb: ['......w.y.', '.....b.y..', '....b.....', '..aaaa....', '.aaaaaaa..', 'aawaaaaaa.', 'awaaaaaaa.', 'aaaaaaaaa.', '.aaaaaaa..', '..aaaaa...']
  };
  function spr(ctx, name, x, y, col, dark, s) {
    var rows = SPR[name], ps = PX * (s || 1);
    var pal = { a: col, b: dark || '#555555', w: '#ffffff', k: '#000000', y: '#ffff55' };
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < rows[r].length; c++) {
      var ch = rows[r][c]; if (ch === '.') continue;
      ctx.fillStyle = pal[ch]; ctx.fillRect(Math.round(x + c * ps), Math.round(y + r * ps), ps, ps);
    }
  }
  function px(c) { return c * T; }
  function py(r) { return OY + r * T; }

  function bg(ctx, g) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H); }

  var cache = null, cacheKey = '';
  function staticLayer(S) {
    var key = '';
    for (var i = 0; i < S.grid.length; i++) key += S.grid[i] === L.WALL ? '1' : '0';
    if (cache && key === cacheKey) return cache;
    var c = document.createElement('canvas'); c.width = L.COLS * T; c.height = L.ROWS * T;
    var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    for (var r = 0; r < L.ROWS; r++) for (var q = 0; q < L.COLS; q++) {
      var X = q * T, Y = r * T;
      if (S.grid[r * L.COLS + q] === L.WALL) {
        x.fillStyle = '#0000aa'; x.fillRect(X, Y, T, T);
        x.fillStyle = '#5555ff';
        for (var row = 0; row < 4; row++) for (var col = 0; col < 3; col++) {
          var off = row % 2 ? 6 : 0; x.fillRect(X + off + col * 14, Y + row * 10, 12, 8);
        }
        x.fillStyle = '#aaaaff'; x.fillRect(X, Y, T, 4); x.fillRect(X, Y, 4, T);
      } else {
        x.fillStyle = '#000022'; x.fillRect(X, Y, T, T);
        x.fillStyle = '#111155'; x.fillRect(X, Y, T, 4); x.fillRect(X, Y, 4, T);
      }
    }
    cache = c; cacheKey = key; return c;
  }
  function crate(ctx, q, r) {
    var X = px(q), Y = py(r);
    ctx.fillStyle = '#aa5500'; ctx.fillRect(X + 4, Y + 4, T - 8, T - 8);
    ctx.fillStyle = '#ffaa55';
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) if ((i + j) % 2 === 0) ctx.fillRect(X + 8 + i * 7, Y + 8 + j * 7, 4, 4);
    ctx.fillStyle = '#552200'; ctx.fillRect(X + 4, Y + T - 8, T - 8, 4); ctx.fillRect(X + T - 8, Y + 4, 4, T - 8);
  }

  // Значки бонусов — пиксельные
  var GLY = {
    bomb: ['....k', '..aa.', '.aaaa', '.aaaa', '..aa.'],
    flame: ['..a..', '.aa..', '.aaa.', 'aawaa', '.aaa.'],
    speed: ['a.a..', '.a.a.', '..a.a', '.a.a.', 'a.a..'],
    kick: ['a..aa', 'a.aaa', 'a.aaa', 'a..aa', '.....'],
    relay: ['...a.', '..a..', '.aaa.', '..a..', '.a...']
  };
  function glyph(ctx, kind, x, y, s, col) {
    var rows = GLY[kind], ps = Math.max(2, Math.round(4 * (s || 1))), c = col || P.pw[kind];
    var x0 = Math.round(x - ps * 2.5), y0 = Math.round(y - ps * 2.5);
    for (var r = 0; r < 5; r++) for (var k = 0; k < 5; k++) {
      var ch = rows[r][k]; if (ch === '.') continue;
      ctx.fillStyle = ch === 'w' ? '#ffffff' : ch === 'k' ? '#ffff55' : c; ctx.fillRect(x0 + k * ps, y0 + r * ps, ps, ps);
    }
  }
  function face(ctx, x, y, i, s) { spr(ctx, 'sapper', x - 20 * s, y - 18 * s, P.pl[i], P.plDark[i], s); }

  function draw(ctx, S, g, o) {
    o = o || {}; var t = S.time;
    bg(ctx, g);
    ctx.drawImage(staticLayer(S), 0, OY);
    var H = S.hatch;
    if (H) {
      var X = px(H.x), Y = py(H.y);
      if (H.open) {
        ctx.fillStyle = Math.floor(t * 6) % 2 ? '#55ff55' : '#00aa00'; ctx.fillRect(X + 4, Y + 4, T - 8, T - 8);
        ctx.fillStyle = '#000'; ctx.fillRect(X + 10, Y + 10, T - 20, T - 20);
      } else {
        ctx.fillStyle = '#555555'; ctx.fillRect(X + 4, Y + 4, T - 8, T - 8);
        ctx.fillStyle = '#aaaaaa'; for (var i2 = 0; i2 < 4; i2++) ctx.fillRect(X + 8, Y + 8 + i2 * 7, T - 16, 3);
      }
    }
    for (var k in S.items) {
      var q = k % L.COLS, r = (k / L.COLS) | 0, kind = S.items[k], ix = px(q), iy = py(r);
      ctx.fillStyle = Math.floor(t * 4) % 2 ? P.pw[kind] : '#555555';
      ctx.fillRect(ix + 4, iy + 4, T - 8, 4); ctx.fillRect(ix + 4, iy + T - 8, T - 8, 4); ctx.fillRect(ix + 4, iy + 4, 4, T - 8); ctx.fillRect(ix + T - 8, iy + 4, 4, T - 8);
      glyph(ctx, kind, ix + T / 2, iy + T / 2, 1);
    }
    for (var i = 0; i < S.grid.length; i++) if (S.grid[i] === L.CRATE) crate(ctx, i % L.COLS, (i / L.COLS) | 0);
    S.debris.forEach(function (d) {
      ctx.fillStyle = Math.floor(d.t * 20) % 2 ? '#ffaa55' : '#aa5500';
      var s = Math.round((0.5 - d.t) * 40 / 4) * 4;
      ctx.fillRect(px(d.x) + 8 - s, py(d.y) + 8 - s, 8, 8); ctx.fillRect(px(d.x) + 24 + s, py(d.y) + 8 - s, 8, 8);
      ctx.fillRect(px(d.x) + 8 - s, py(d.y) + 24 + s, 8, 8); ctx.fillRect(px(d.x) + 24 + s, py(d.y) + 24 + s, 8, 8);
    });
    S.bombs.forEach(function (b) {
      var blink = b.relay ? Math.floor(t * 3) % 2 : Math.floor(b.t * (3 + (L.FUSE - b.fuse) * 4)) % 2;
      spr(ctx, 'bomb', px(b.x), py(b.y) + 2, blink ? '#555555' : '#aaaaaa', '#aa5500');
      if (b.relay) { ctx.fillStyle = '#55ffff'; ctx.fillRect(px(b.x) + 34, py(b.y) + 2, 4, 4); }
    });
    // пламя — ступенчатые полосы
    for (var fk in S.flames) {
      var f = S.flames[fk], fq = fk % L.COLS, fr = (fk / L.COLS) | 0, fx = px(fq), fy = py(fr);
      var layers = [['#ff5555', 4], ['#ffff55', 12], ['#ffffff', 16]];
      if (f.t < L.FLAME_T * 0.35) layers = [['#aa0000', 8], ['#ff5555', 14]];
      for (var li = 0; li < layers.length; li++) {
        var pd = layers[li][1]; ctx.fillStyle = layers[li][0];
        if (f.h || f.c) ctx.fillRect(fx, fy + pd, T, T - pd * 2);
        if (f.v || f.c) ctx.fillRect(fx + pd, fy, T - pd * 2, T);
      }
    }
    S.enemies.forEach(function (e) {
      var name = e.type === 'fast' ? (Math.floor(t * 10) % 2 ? 'fast' : 'fast2') : e.type;
      if (e.type === 'ghost' && Math.floor(t * 8) % 3 === 0) return;   // мерцает
      spr(ctx, name, px(e.x), py(e.y) + (Math.floor(t * 4 + e.t) % 2) * 2 - 2, P.en[e.type], '#555555');
    });
    var B = S.boss;
    if (B && B.alive) {
      var bx = px(B.x) + T / 2, by = py(B.y) + T / 2, R = 30, hit = B.flash > 0 && Math.floor(t * 20) % 2 === 0;
      for (var yy = -R; yy < R; yy += PX) for (var xx = -R; xx < R; xx += PX) {
        var d2 = (xx + 2) * (xx + 2) + (yy + 2) * (yy + 2);
        if (d2 > R * R) continue;
        var ring = d2 > (R - 6) * (R - 6), notch = ring && (Math.floor((Math.atan2(yy, xx) + t * 2) / 0.6) % 2 === 0);
        ctx.fillStyle = hit ? '#ffffff' : notch ? '#555555' : d2 < 64 ? '#000000' : '#aaaaaa';
        ctx.fillRect(bx + xx, by + yy, PX, PX);
      }
      ctx.fillStyle = '#ff5555'; ctx.fillRect(bx - 16, by - 12, 10, 6); ctx.fillRect(bx + 6, by - 12, 10, 6);
      var cr = B.max - B.hp; ctx.fillStyle = '#000';
      for (var c2 = 0; c2 < cr; c2++) ctx.fillRect(bx - 24 + (c2 * 13) % 44, by + 8 + (c2 * 7) % 14, 8, 4);
    }
    S.players.forEach(function (p) {
      if (!p.alive || (p.inv > 0 && Math.floor(t * 12) % 2 === 0)) return;
      var name = p.face === 'up' ? 'sapperUp' : (p.moving && Math.floor(p.walk * 8) % 2 ? 'sapper2' : 'sapper');
      spr(ctx, name, px(p.x), py(p.y) - 2, P.pl[p.i], P.plDark[p.i]);
    });
    // сканлайны
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var sy = OY; sy < g.H; sy += 4) ctx.fillRect(0, sy, g.W, 1);
    if (o.bare) return;
    F.ui.hud(g, ctx, S, F.classic);
    F.ui.banner(g, ctx, S, F.classic);
    if (o.toasts) F.ui.toasts(g, ctx, o.toasts, P);
  }

  F.classic = { P: P, bg: bg, draw: draw, glyph: glyph, face: face };
})(typeof window !== 'undefined' ? window : globalThis);
