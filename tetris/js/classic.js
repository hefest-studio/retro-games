/* TETRIS · рендер 8-бит (classic). TT.classic.draw(ctx, st, G) */
(function (global) {
  'use strict';
  var TT = global.TT = global.TT || {};
  var PAL = ['', '#49c7f5', '#f5d949', '#c06bf0', '#4ad06a', '#e8503a', '#3a6de8', '#f09a3a'];

  function cell(ctx, x, y, s, id) {
    var c = PAL[id] || '#888';
    ctx.fillStyle = c; ctx.fillRect(x, y, s, s);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, s, 3); ctx.fillRect(x, y, 3, s);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y + s - 3, s, 3); ctx.fillRect(x + s - 3, y, 3, s);
  }
  function text(ctx, s, x, y, col, size, align) {
    ctx.fillStyle = col; ctx.font = '700 ' + size + 'px "DejaVu Sans Mono",monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }
  function miniPiece(ctx, type, bx, by, s) {
    var m = TT.consts.SHAPES[type], id = TT.consts.COLOR[type], n = m.length;
    var ox = bx + (4 - n) * s / 2, oy = by + (type === 'I' ? -s / 2 : 0);
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) cell(ctx, ox + x * s, oy + y * s, s - 1, id);
  }

  TT.classic = { draw: function (ctx, st, G) {
    var cs = G.cell, ox = G.ox, oy = G.oy, cols = 10, rows = 20;
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, G.W, G.H);
    // колодец
    ctx.fillStyle = '#05070f'; ctx.fillRect(ox - 4, oy - 4, cols * cs + 8, rows * cs + 8);
    ctx.strokeStyle = '#2a3250'; ctx.lineWidth = 2; ctx.strokeRect(ox - 4, oy - 4, cols * cs + 8, rows * cs + 8);
    // сетка
    ctx.strokeStyle = 'rgba(80,100,160,.12)';
    for (var gx = 0; gx <= cols; gx++) { ctx.beginPath(); ctx.moveTo(ox + gx * cs, oy); ctx.lineTo(ox + gx * cs, oy + rows * cs); ctx.stroke(); }
    for (var gy = 0; gy <= rows; gy++) { ctx.beginPath(); ctx.moveTo(ox, oy + gy * cs); ctx.lineTo(ox + cols * cs, oy + gy * cs); ctx.stroke(); }
    // зафиксированные
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) if (st.board[y][x]) cell(ctx, ox + x * cs, oy + y * cs, cs - 1, st.board[y][x]);
    // призрак + текущая
    if (st.cur) {
      var m = st.cur.m, n = m.length, id = TT.consts.COLOR[st.cur.type];
      for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) if (m[yy][xx]) {
        var gyp = st.ghostY + yy; if (gyp >= 0) { ctx.strokeStyle = PAL[id]; ctx.globalAlpha = .35; ctx.lineWidth = 2; ctx.strokeRect(ox + (st.cur.x + xx) * cs + 1, oy + gyp * cs + 1, cs - 3, cs - 3); ctx.globalAlpha = 1; }
      }
      for (var y2 = 0; y2 < n; y2++) for (var x2 = 0; x2 < n; x2++) if (m[y2][x2]) { var py = st.cur.y + y2; if (py >= 0) cell(ctx, ox + (st.cur.x + x2) * cs, oy + py * cs, cs - 1, id); }
    }
    // панели
    var rx = ox + cols * cs + 28;
    text(ctx, TT.t('next'), rx, oy + 16, '#8fa0c8', 13);
    var ny = oy + 28; st.next.slice(0, 4).forEach(function (t) { miniPiece(ctx, t, rx, ny, cs * 0.7); ny += cs * 2.3; });
    var sx = G.ox - 28;
    text(ctx, TT.t('hold'), sx, oy + 16, '#8fa0c8', 13, 'right');
    if (st.hold) miniPiece(ctx, st.hold, sx - cs * 2.6, oy + 28, cs * 0.7);
    var panels = [[TT.t('score'), st.score], [TT.t('best'), st.hi], [TT.t('level'), st.level], [TT.t('lines'), st.lines]];
    var yy2 = oy + cs * 7.5;
    panels.forEach(function (p) { text(ctx, p[0], sx, yy2, '#8fa0c8', 12, 'right'); text(ctx, String(p[1]), sx, yy2 + 20, '#f5d949', 20, 'right'); yy2 += 52; });
  } };
})(typeof window !== 'undefined' ? window : globalThis);
