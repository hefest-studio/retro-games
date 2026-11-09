/* TETRIS · рендер неон (modern). TT.modern.draw(ctx, st, G) */
(function (global) {
  'use strict';
  var TT = global.TT = global.TT || {};
  var PAL = ['', '#36d6ff', '#ffd23e', '#b36bff', '#39e68a', '#ff5c6c', '#4f7bff', '#ff9e3d'];

  function cell(ctx, x, y, s, id, glow) {
    var c = PAL[id] || '#aaa';
    var g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,.25)');
    ctx.save();
    if (glow) { ctx.shadowColor = c; ctx.shadowBlur = 12; }
    ctx.fillStyle = g; roundRect(ctx, x + 1, y + 1, s - 2, s - 2, 4); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; roundRect(ctx, x + 3, y + 3, s - 6, (s - 6) * .4, 3); ctx.fill();
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function text(ctx, s, x, y, col, size, align, glow) {
    ctx.save(); if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 8; }
    ctx.fillStyle = col; ctx.font = '800 ' + size + 'px "Inter",system-ui,sans-serif'; ctx.textAlign = align || 'left'; ctx.fillText(s, x, y); ctx.restore();
  }
  function miniPiece(ctx, type, bx, by, s) {
    var m = TT.consts.SHAPES[type], id = TT.consts.COLOR[type], n = m.length;
    var ox = bx + (4 - n) * s / 2, oy = by + (type === 'I' ? -s / 2 : 0);
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) cell(ctx, ox + x * s, oy + y * s, s, id, true);
  }

  TT.modern = { draw: function (ctx, st, G) {
    var cs = G.cell, ox = G.ox, oy = G.oy, cols = 10, rows = 20;
    var bg = ctx.createLinearGradient(0, 0, 0, G.H); bg.addColorStop(0, '#0f1226'); bg.addColorStop(1, '#070812');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, G.W, G.H);
    ctx.fillStyle = 'rgba(10,14,34,.7)'; roundRect(ctx, ox - 6, oy - 6, cols * cs + 12, rows * cs + 12, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(80,130,255,.35)'; ctx.lineWidth = 1.5; roundRect(ctx, ox - 6, oy - 6, cols * cs + 12, rows * cs + 12, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,120,220,.08)';
    for (var gy = 0; gy <= rows; gy++) { ctx.beginPath(); ctx.moveTo(ox, oy + gy * cs); ctx.lineTo(ox + cols * cs, oy + gy * cs); ctx.stroke(); }
    for (var gx = 0; gx <= cols; gx++) { ctx.beginPath(); ctx.moveTo(ox + gx * cs, oy); ctx.lineTo(ox + gx * cs, oy + rows * cs); ctx.stroke(); }
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) if (st.board[y][x]) cell(ctx, ox + x * cs, oy + y * cs, cs, st.board[y][x], false);
    if (st.cur) {
      var m = st.cur.m, n = m.length, id = TT.consts.COLOR[st.cur.type];
      for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) if (m[yy][xx]) { var gyp = st.ghostY + yy; if (gyp >= 0) { ctx.globalAlpha = .22; cell(ctx, ox + (st.cur.x + xx) * cs, oy + gyp * cs, cs, id, false); ctx.globalAlpha = 1; } }
      for (var y2 = 0; y2 < n; y2++) for (var x2 = 0; x2 < n; x2++) if (m[y2][x2]) { var py = st.cur.y + y2; if (py >= 0) cell(ctx, ox + (st.cur.x + x2) * cs, oy + py * cs, cs, id, true); }
    }
    var rx = ox + cols * cs + 30;
    text(ctx, TT.t('next'), rx, oy + 16, '#7fa0ff', 13, 'left', true);
    var ny = oy + 30; st.next.slice(0, 4).forEach(function (t) { miniPiece(ctx, t, rx, ny, cs * 0.7); ny += cs * 2.3; });
    var sx = ox - 30;
    text(ctx, TT.t('hold'), sx, oy + 16, '#7fa0ff', 13, 'right', true);
    if (st.hold) miniPiece(ctx, st.hold, sx - cs * 2.6, oy + 30, cs * 0.7);
    var panels = [[TT.t('score'), st.score], [TT.t('best'), st.hi], [TT.t('level'), st.level], [TT.t('lines'), st.lines]];
    var yy2 = oy + cs * 7.5;
    panels.forEach(function (p) { text(ctx, p[0], sx, yy2, '#7fa0ff', 12, 'right'); text(ctx, String(p[1]), sx, yy2 + 22, '#36d6ff', 22, 'right', true); yy2 += 56; });
  } };
})(typeof window !== 'undefined' ? window : globalThis);
