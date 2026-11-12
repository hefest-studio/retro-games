/* РАЗРЕЗ · рендер RETRO (8-бит). RAZREZ.classic.draw(ctx, st, g, L)
   Ограниченная 16-цветная палитра, кирпичная суша, пиксельные спрайты 5×5
   (пиксель = 2 px), моноширинный шрифт и лёгкие «сканлайны». Логика та же. */
(function (global) {
  'use strict';
  var R = global.RAZREZ = global.RAZREZ || {};

  var P = {
    bg: '#000000', sea: '#000000', seaDot: '#1c1c6c', land: '#3a28a0', landHi: '#7563f2', mortar: '#160c44', edge: '#ffff55',
    trail: '#ff55ff', trail2: '#aa00aa',
    hudBg: '#000000', hudLine: '#5555ff', panel: '#000000', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55',
    good: '#55ff55', bad: '#ff5555', bar: '#1c1c3c', barFill: '#55ffff', target: '#ff55ff',
    heart: '#ff5555', heartOff: '#333344', font: '"Courier New", ui-monospace, monospace', pixel: true
  };

  // Спрайты 5×5: символ → цвет
  var SPR = {
    player: ['#####', '#ooo#', '#oxo#', '#ooo#', '#####'],
    ball: ['.rrr.', 'ryrrr', 'rrrrr', 'rrrrr', '.rrr.'],
    miteA: ['g.g.g', '.ggg.', 'gkgkg', '.ggg.', 'g.g.g'],
    miteB: ['.g.g.', 'ggggg', '.kgk.', 'ggggg', '.g.g.']
  };
  var COL = { '#': '#ffffff', o: '#ea6a12', x: '#000000', r: '#ff5555', y: '#ffff55', g: '#55ff55', k: '#000000' };

  function sprite(ctx, rows, cx, cy) {
    var x0 = Math.round((cx - 5) / 2) * 2, y0 = Math.round((cy - 5) / 2) * 2;
    for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) {
      var ch = rows[r][c]; if (ch === '.') continue;
      ctx.fillStyle = COL[ch]; ctx.fillRect(x0 + c * 2, y0 + r * 2, 2, 2);
    }
  }

  var cache = null, cctx = null, cver = -1, cstate = null;

  function buildLayer(st, L) {
    var C = L.CELL, cols = st.cols, rows = st.rows, G = st.grid, FW = cols * C, FH = rows * C;
    if (!cache) { cache = document.createElement('canvas'); cctx = cache.getContext('2d'); }
    if (cache.width !== FW || cache.height !== FH) { cache.width = FW; cache.height = FH; }
    var c = cctx, x, y;
    c.fillStyle = P.sea; c.fillRect(0, 0, FW, FH);
    c.fillStyle = P.seaDot;
    for (y = 1; y < rows; y += 4) for (x = (y % 8 === 1 ? 1 : 3); x < cols; x += 4) c.fillRect(x * C + 4, y * C + 4, 2, 2);
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      if (G[y * cols + x] !== 1) continue;
      var X = x * C, Y = y * C;
      c.fillStyle = P.land; c.fillRect(X, Y, C, C);
      c.fillStyle = P.landHi; c.fillRect(X, Y, C, 2);
      c.fillStyle = P.mortar; c.fillRect(X, Y + C - 2, C, 2);
      if ((x + y) % 2 === 0) c.fillRect(X, Y, 2, C - 2);   // кирпич 2×1 клетки, со сдвигом по рядам
    }
    c.fillStyle = P.edge;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      if (G[y * cols + x] !== 1) continue;
      var X2 = x * C, Y2 = y * C;
      if (y > 0 && G[(y - 1) * cols + x] !== 1) c.fillRect(X2, Y2, C, 2);
      if (y < rows - 1 && G[(y + 1) * cols + x] !== 1) c.fillRect(X2, Y2 + C - 2, C, 2);
      if (x > 0 && G[y * cols + x - 1] !== 1) c.fillRect(X2, Y2, 2, C);
      if (x < cols - 1 && G[y * cols + x + 1] !== 1) c.fillRect(X2 + C - 2, Y2, 2, C);
    }
    cver = st.ver; cstate = st;
  }

  function scanlines(ctx, L) {
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (var y = 0; y < L.H; y += 3) ctx.fillRect(0, y, L.W, 1);
  }

  R.classic = {
    P: P,
    layer: function (st, L) { if (cver !== st.ver || cstate !== st || !cache) buildLayer(st, L); return cache; },
    scanlines: scanlines,
    draw: function (ctx, st, g, L, bare) {
      var C = L.CELL, cols = st.cols, t = st.time, i;
      ctx.fillStyle = P.bg; ctx.fillRect(0, 0, L.W, L.H);
      ctx.drawImage(R.classic.layer(st, L), L.OX, L.OY);
      // вспышка захвата — мигание клеток
      if (st.flash && st.flashT > 0 && ((st.flashT * 16) | 0) % 2 === 0) {
        ctx.fillStyle = P.edge; var m = st.flash;
        for (i = 0; i < m.length; i++) if (m[i]) ctx.fillRect(L.OX + (i % cols) * C + 4, L.OY + ((i / cols) | 0) * C + 4, 2, 2);
      }
      // след — клетки с «бегущей» шашечкой
      var ph = (t * 10) | 0;
      for (i = 0; i < st.trail.length; i++) {
        var k = st.trail[i], tx = L.OX + (k % cols) * C, ty = L.OY + ((k / cols) | 0) * C;
        ctx.fillStyle = (i + ph) % 2 ? P.trail : P.trail2; ctx.fillRect(tx + 2, ty + 2, C - 4, C - 4);
      }
      for (i = 0; i < st.land.length; i++) { var mt = st.land[i]; sprite(ctx, ((t * 8) | 0) % 2 ? SPR.miteA : SPR.miteB, L.OX + mt.x * C, L.OY + mt.y * C); }
      for (i = 0; i < st.sea.length; i++) { var b = st.sea[i]; sprite(ctx, SPR.ball, L.OX + b.x * C, L.OY + b.y * C); }
      var p = st.player;
      if (st.phase !== 'dead' && !(st.inv > 0 && ((t * 10) | 0) % 2)) sprite(ctx, SPR.player, L.OX + (p.x + 0.5) * C, L.OY + (p.y + 0.5) * C);
      if (!bare) { R.ui.hud(g, ctx, st, P, L); R.ui.banner(g, ctx, st, P, L); }
      scanlines(ctx, L);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
