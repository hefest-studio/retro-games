/* PAC-MAN · рендер 8-бит (classic). PM.classic.draw(ctx, st, G) */
(function (global) {
  'use strict';
  var PM = global.PM = global.PM || {};
  var DIRA = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };

  function geom(G) {
    var cell = Math.floor(Math.min((G.W - 200) / 28, (G.H - 24) / 31));
    var mw = cell * 28, mh = cell * 31;
    var ox = 24, oy = Math.floor((G.H - mh) / 2);
    return { cell: cell, ox: ox, oy: oy, mw: mw, mh: mh, hudX: ox + mw + 28 };
  }
  function cx(g, x) { return g.ox + (x + 0.5) * g.cell; }
  function cy(g, y) { return g.oy + (y + 0.5) * g.cell; }
  function text(ctx, s, x, y, col, size, align) {
    ctx.fillStyle = col; ctx.font = '700 ' + size + 'px "DejaVu Sans Mono",monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }

  function drawPac(ctx, g, p, r) {
    var a = Math.abs(Math.sin(p.mouth)) * 0.33 * Math.PI, base = DIRA[p.dir] || 0;
    ctx.fillStyle = '#ffe300';
    ctx.beginPath(); ctx.moveTo(cx(g, p.x), cy(g, p.y));
    ctx.arc(cx(g, p.x), cy(g, p.y), r, base + a, base + 2 * Math.PI - a); ctx.closePath(); ctx.fill();
  }
  function drawGhost(ctx, g, gh, r, st) {
    var px = cx(g, gh.x), py = cy(g, gh.y), col;
    if (gh.mode === 'eyes') col = null;
    else if (gh.mode === 'fright') col = (st.frightT < 2 && Math.floor(st.time * 6) % 2) ? '#ffffff' : '#2a4bff';
    else col = PM.consts.COLORS[gh.name];
    if (col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py - r * 0.1, r, Math.PI, 0); // купол
      ctx.lineTo(px + r, py + r * 0.7);
      var feet = 4, fw = (2 * r) / feet;
      for (var i = 0; i < feet; i++) { var x0 = px + r - i * fw; ctx.lineTo(x0 - fw / 2, py + r * 0.4); ctx.lineTo(x0 - fw, py + r * 0.7); }
      ctx.closePath(); ctx.fill();
    }
    // глаза (и у призрака, и в режиме «глаза»)
    var look = PM.consts && { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[gh.dir] || [0, 0];
    var ex = r * 0.38, ey = -r * 0.12, er = r * 0.34, pr = r * 0.16;
    [[-ex, ey], [ex, ey]].forEach(function (e) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + e[0], py + e[1], er, 0, 7); ctx.fill();
      ctx.fillStyle = (gh.mode === 'fright') ? '#2a4bff' : '#0a1030';
      ctx.beginPath(); ctx.arc(px + e[0] + look[0] * pr, py + e[1] + look[1] * pr, pr, 0, 7); ctx.fill();
    });
  }

  PM.classic = {
    draw: function (ctx, st, G) {
      var g = geom(G), cell = g.cell;
      ctx.fillStyle = '#060a16'; ctx.fillRect(0, 0, G.W, G.H);
      // стены + точки
      for (var y = 0; y < st.ROWS; y++) for (var x = 0; x < st.COLS; x++) {
        var ch = st.maze[y][x], X = g.ox + x * cell, Y = g.oy + y * cell;
        if (ch === '#') {
          ctx.fillStyle = '#1b2ea8'; ctx.fillRect(X + 1, Y + 1, cell - 2, cell - 2);
          ctx.fillStyle = '#2f49d6'; ctx.fillRect(X + 3, Y + 3, cell - 6, cell - 6);
        } else if (ch === '=') { ctx.fillStyle = '#f5a0c8'; ctx.fillRect(X + 1, Y + cell / 2 - 2, cell - 2, 4); }
        else if (ch === '.') { ctx.fillStyle = '#ffd9a0'; var s = Math.max(2, cell * 0.16); ctx.fillRect(X + cell / 2 - s / 2, Y + cell / 2 - s / 2, s, s); }
        else if (ch === 'o') { if (Math.floor(st.time * 5) % 2) { ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(X + cell / 2, Y + cell / 2, cell * 0.36, 0, 7); ctx.fill(); } }
      }
      // призраки
      for (var i = 0; i < st.ghosts.length; i++) drawGhost(ctx, g, st.ghosts[i], cell * 0.46, st);
      // Пакман
      if (st.pac.alive || st.mode === 'dying') drawPac(ctx, g, st.pac, cell * 0.46);

      // HUD
      var hx = g.hudX;
      text(ctx, PM.t('score'), hx, 70, '#ffd34d', 13); text(ctx, String(st.score), hx, 96, '#fff', 26);
      text(ctx, PM.t('best'), hx, 140, '#ffd34d', 13); text(ctx, String(Math.max(st.hi, st.score)), hx, 164, '#fff', 20);
      text(ctx, PM.t('level'), hx, 206, '#ffd34d', 13); text(ctx, String(st.level), hx, 230, '#fff', 20);
      text(ctx, PM.t('lives'), hx, 272, '#ffd34d', 13);
      for (var l = 0; l < st.lives; l++) { ctx.fillStyle = '#ffe300'; ctx.beginPath(); ctx.arc(hx + 10 + l * 26, 294, 9, 0.28 * Math.PI, 1.72 * Math.PI); ctx.lineTo(hx + 10 + l * 26, 294); ctx.fill(); }

      // оверлеи состояния на поле
      if (st.mode === 'ready') { text(ctx, PM.t('ready'), g.ox + g.mw / 2, g.oy + g.mh * 0.6, '#ffd34d', 22, 'center'); }
      if (st.fright && st.frightT > 0) { ctx.fillStyle = '#9fb0ff'; ctx.font = '700 11px "DejaVu Sans Mono",monospace'; ctx.textAlign = 'left'; ctx.fillText('ИСПУГ ' + st.frightT.toFixed(1), hx, 340); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
