/* PAC-MAN · рендер неон (modern). PM.modern.draw(ctx, st, G) */
(function (global) {
  'use strict';
  var PM = global.PM = global.PM || {};
  var DIRA = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };

  function geom(G) {
    var cell = Math.floor(Math.min((G.W - 200) / 28, (G.H - 24) / 31));
    var mw = cell * 28, mh = cell * 31;
    return { cell: cell, ox: 24, oy: Math.floor((G.H - mh) / 2), mw: mw, mh: mh, hudX: 24 + mw + 28 };
  }
  function cx(g, x) { return g.ox + (x + 0.5) * g.cell; }
  function cy(g, y) { return g.oy + (y + 0.5) * g.cell; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function text(ctx, s, x, y, col, size, align, glow) {
    ctx.save(); if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 10; }
    ctx.fillStyle = col; ctx.font = '800 ' + size + 'px "Inter",system-ui,sans-serif'; ctx.textAlign = align || 'left'; ctx.fillText(s, x, y); ctx.restore();
  }

  function wallConnLeft(st, x, y) { return x > 0 && st.maze[y][x - 1] === '#'; }
  function wallConnUp(st, x, y) { return y > 0 && st.maze[y - 1][x] === '#'; }

  PM.modern = {
    draw: function (ctx, st, G) {
      var g = geom(G), cell = g.cell;
      var bg = ctx.createLinearGradient(0, 0, 0, G.H); bg.addColorStop(0, '#0b0f24'); bg.addColorStop(1, '#05070f');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, G.W, G.H);

      // стены как неоновые линии-перемычки
      ctx.save(); ctx.strokeStyle = '#3ea0ff'; ctx.shadowColor = '#3ea0ff'; ctx.shadowBlur = 8; ctx.lineWidth = Math.max(2, cell * 0.16); ctx.lineCap = 'round';
      for (var y = 0; y < st.ROWS; y++) for (var x = 0; x < st.COLS; x++) {
        if (st.maze[y][x] !== '#') continue;
        var X = cx(g, x), Y = cy(g, y);
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y); ctx.stroke(); // точка-узел
        if (wallConnLeft(st, x, y)) { ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - cell, Y); ctx.stroke(); }
        if (wallConnUp(st, x, y)) { ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - cell); ctx.stroke(); }
      }
      ctx.restore();
      // ворота
      for (var yy = 0; yy < st.ROWS; yy++) for (var xx = 0; xx < st.COLS; xx++) if (st.maze[yy][xx] === '=') { ctx.strokeStyle = '#ff9ed6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(g.ox + xx * cell, cy(g, yy)); ctx.lineTo(g.ox + (xx + 1) * cell, cy(g, yy)); ctx.stroke(); }

      // точки и энергетики
      for (var y2 = 0; y2 < st.ROWS; y2++) for (var x2 = 0; x2 < st.COLS; x2++) {
        var ch = st.maze[y2][x2];
        if (ch === '.') { ctx.fillStyle = '#ffe9c2'; ctx.beginPath(); ctx.arc(cx(g, x2), cy(g, y2), Math.max(1.5, cell * 0.1), 0, 7); ctx.fill(); }
        else if (ch === 'o') { ctx.save(); ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 12; ctx.fillStyle = '#ffd34d'; var pr = cell * (0.3 + 0.06 * Math.sin(st.time * 6)); ctx.beginPath(); ctx.arc(cx(g, x2), cy(g, y2), pr, 0, 7); ctx.fill(); ctx.restore(); }
      }

      // призраки
      for (var i = 0; i < st.ghosts.length; i++) {
        var gh = st.ghosts[i], px = cx(g, gh.x), py = cy(g, gh.y), r = cell * 0.46, col;
        if (gh.mode === 'eyes') col = null;
        else if (gh.mode === 'fright') col = (st.frightT < 2 && Math.floor(st.time * 6) % 2) ? '#eaf0ff' : '#2a4bff';
        else col = PM.consts.COLORS[gh.name];
        if (col) {
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(px, py - r * 0.1, r, Math.PI, 0); ctx.lineTo(px + r, py + r * 0.7);
          for (var f = 0; f < 4; f++) { var x0 = px + r - f * (2 * r / 4); ctx.lineTo(x0 - r / 4, py + r * 0.4); ctx.lineTo(x0 - 2 * r / 4, py + r * 0.7); }
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
        var look = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[gh.dir] || [0, 0];
        [[-r * 0.38, -r * 0.12], [r * 0.38, -r * 0.12]].forEach(function (e) {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + e[0], py + e[1], r * 0.34, 0, 7); ctx.fill();
          ctx.fillStyle = (gh.mode === 'fright') ? '#2a4bff' : '#12204a';
          ctx.beginPath(); ctx.arc(px + e[0] + look[0] * r * 0.16, py + e[1] + look[1] * r * 0.16, r * 0.16, 0, 7); ctx.fill();
        });
      }

      // Пакман
      if (st.pac.alive || st.mode === 'dying') {
        var p = st.pac, a = Math.abs(Math.sin(p.mouth)) * 0.33 * Math.PI, base = DIRA[p.dir] || 0;
        ctx.save(); ctx.shadowColor = '#ffe300'; ctx.shadowBlur = 16;
        var grd = ctx.createRadialGradient(cx(g, p.x), cy(g, p.y), 2, cx(g, p.x), cy(g, p.y), cell * 0.5);
        grd.addColorStop(0, '#fff2a0'); grd.addColorStop(1, '#ffcf1a'); ctx.fillStyle = grd;
        ctx.beginPath(); ctx.moveTo(cx(g, p.x), cy(g, p.y)); ctx.arc(cx(g, p.x), cy(g, p.y), cell * 0.46, base + a, base + 2 * Math.PI - a); ctx.closePath(); ctx.fill(); ctx.restore();
      }

      // HUD
      var hx = g.hudX;
      text(ctx, PM.t('score'), hx, 70, '#8fb6ff', 13); text(ctx, String(st.score), hx, 98, '#fff', 28, 'left', true);
      text(ctx, PM.t('best'), hx, 142, '#8fb6ff', 13); text(ctx, String(Math.max(st.hi, st.score)), hx, 166, '#eaf0ff', 20);
      text(ctx, PM.t('level'), hx, 208, '#8fb6ff', 13); text(ctx, String(st.level), hx, 232, '#eaf0ff', 20);
      text(ctx, PM.t('lives'), hx, 274, '#8fb6ff', 13);
      for (var l = 0; l < st.lives; l++) { ctx.save(); ctx.shadowColor = '#ffe300'; ctx.shadowBlur = 8; ctx.fillStyle = '#ffe300'; ctx.beginPath(); ctx.arc(hx + 10 + l * 26, 296, 9, 0.28 * Math.PI, 1.72 * Math.PI); ctx.lineTo(hx + 10 + l * 26, 296); ctx.fill(); ctx.restore(); }
      if (st.mode === 'ready') text(ctx, PM.t('ready'), g.ox + g.mw / 2, g.oy + g.mh * 0.6, '#ffd34d', 22, 'center', true);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
