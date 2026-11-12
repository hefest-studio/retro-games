/* РАЗРЕЗ · рендер MODERN (по умолчанию). RAZREZ.modern.draw(ctx, st, g, L)
   Чистый современный вид: глубокое поле, сланцевая суша с бирюзовой кромкой,
   светящийся оранжевый след. Слой суши кэшируется и перерисовывается по st.ver. */
(function (global) {
  'use strict';
  var R = global.RAZREZ = global.RAZREZ || {};

  var P = {
    bg: '#0b0e14', sea: '#090d16', seaDot: '#1a2335', land: '#22354f', stripe: '#2b4262', edge: '#5eead4',
    trail: '#ff8a3d', player: '#ffffff', ring: '#EA6A12', ball: '#ff4d8d', ballHi: '#ffe0ea',
    mite: '#ffd166', miteD: '#8a5a12', flash: '94,234,212',
    hudBg: '#121826', hudLine: '#1f2a3d', panel: '#141b29', ink: '#eef2f8', muted: '#8b97ab', accent: '#ff8a3d',
    good: '#37d67a', bad: '#ff5d6c', bar: '#1f2a3d', barFill: '#5eead4', target: '#ffffff',
    heart: '#ff5d6c', heartOff: '#2a3346', font: null, pixel: false
  };

  var cache = null, cctx = null, cver = -1, cstate = null, pattern = null;

  function buildLayer(st, L) {
    var FW = st.cols * L.CELL, FH = st.rows * L.CELL, C = L.CELL, G = st.grid, cols = st.cols, rows = st.rows;
    if (!cache) { cache = document.createElement('canvas'); cctx = cache.getContext('2d'); }
    if (cache.width !== FW || cache.height !== FH) { cache.width = FW; cache.height = FH; }
    var c = cctx;
    if (!pattern) {
      var pc = document.createElement('canvas'); pc.width = 8; pc.height = 8; var px = pc.getContext('2d');
      px.fillStyle = P.land; px.fillRect(0, 0, 8, 8); px.strokeStyle = P.stripe; px.lineWidth = 2;
      px.beginPath(); px.moveTo(-2, 10); px.lineTo(10, -2); px.moveTo(-2, 2); px.lineTo(2, -2); px.moveTo(6, 10); px.lineTo(10, 6); px.stroke();
      pattern = c.createPattern(pc, 'repeat');
    }
    // море
    c.fillStyle = P.sea; c.fillRect(0, 0, FW, FH);
    c.fillStyle = P.seaDot;
    for (var y = 0; y < rows; y += 2) for (var x = 0; x < cols; x += 2) c.fillRect(x * C + C - 1, y * C + C - 1, 2, 2);
    // суша — полосами по строкам
    c.fillStyle = pattern;
    for (y = 0; y < rows; y++) {
      var run = -1;
      for (x = 0; x <= cols; x++) {
        var land = x < cols && G[y * cols + x] === 1;
        if (land && run < 0) run = x;
        if (!land && run >= 0) { c.fillRect(run * C, y * C, (x - run) * C, C); run = -1; }
      }
    }
    // кромка суши у моря (след считается морем — он рисуется поверх вживую)
    c.fillStyle = P.edge;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      if (G[y * cols + x] !== 1) continue;
      var X = x * C, Y = y * C;
      if (y > 0 && G[(y - 1) * cols + x] !== 1) c.fillRect(X, Y, C, 2);
      if (y < rows - 1 && G[(y + 1) * cols + x] !== 1) c.fillRect(X, Y + C - 2, C, 2);
      if (x > 0 && G[y * cols + x - 1] !== 1) c.fillRect(X, Y, 2, C);
      if (x < cols - 1 && G[y * cols + x + 1] !== 1) c.fillRect(X + C - 2, Y, 2, C);
    }
    cver = st.ver; cstate = st;
  }

  function drawTrail(ctx, st, L) {
    var P0 = st.player; if (!P0.trailing || !st.trail.length) return;
    var C = L.CELL, cols = st.cols;
    ctx.save(); ctx.translate(L.OX, L.OY); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo((P0.sx + 0.5) * C, (P0.sy + 0.5) * C);
    for (var i = 0; i < st.trail.length; i++) { var t = st.trail[i]; ctx.lineTo((t % cols + 0.5) * C, (((t / cols) | 0) + 0.5) * C); }
    ctx.strokeStyle = 'rgba(255,138,61,.25)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.shadowColor = P.trail; ctx.shadowBlur = 10; ctx.strokeStyle = P.trail; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.restore();
  }

  function drawFlash(ctx, st, L) {
    if (!st.flash || st.flashT <= 0) return;
    var a = 0.45 * Math.max(0, st.flashT / 0.6), C = L.CELL, cols = st.cols, m = st.flash;
    ctx.fillStyle = 'rgba(' + P.flash + ',' + a.toFixed(3) + ')';
    for (var i = 0; i < m.length; i++) if (m[i]) ctx.fillRect(L.OX + (i % cols) * C, L.OY + ((i / cols) | 0) * C, C, C);
  }

  function drawBall(ctx, b, L, t) {
    var x = L.OX + b.x * L.CELL, y = L.OY + b.y * L.CELL, r = 6;
    ctx.save(); ctx.shadowColor = P.ball; ctx.shadowBlur = 14;
    var gr = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, r);
    gr.addColorStop(0, P.ballHi); gr.addColorStop(0.45, P.ball); gr.addColorStop(1, '#b3165a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    void t;
  }

  function drawMite(ctx, m, L, t) {
    var x = L.OX + m.x * L.CELL, y = L.OY + m.y * L.CELL, a = Math.atan2(m.vy, m.vx), w = Math.sin(t * 22) * 1.6;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = P.miteD; ctx.lineWidth = 1.5; ctx.beginPath();
    for (var k = -1; k <= 1; k++) { var o = (k === 0 ? -w : w); ctx.moveTo(k * 3, 0); ctx.lineTo(k * 3 + o, -7); ctx.moveTo(k * 3, 0); ctx.lineTo(k * 3 - o, 7); }
    ctx.stroke();
    ctx.fillStyle = P.mite; ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 4.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1206'; ctx.beginPath(); ctx.arc(3.5, -2, 1.3, 0, 7); ctx.arc(3.5, 2, 1.3, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawPlayer(ctx, st, L, t) {
    var p = st.player; if (st.phase === 'dead') return;
    if (st.inv > 0 && ((t * 12) | 0) % 2) return;
    var x = L.OX + (p.x + 0.5) * L.CELL, y = L.OY + (p.y + 0.5) * L.CELL;
    ctx.save(); ctx.shadowColor = P.ring; ctx.shadowBlur = 12;
    ctx.fillStyle = P.ring; ctx.beginPath(); ctx.arc(x, y, 7.5, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = P.player; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = P.ring; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
  }

  R.modern = {
    P: P,
    // Слой поля (для титульного экрана — фон-декор)
    layer: function (st, L) { if (cver !== st.ver || cstate !== st || !cache) buildLayer(st, L); return cache; },
    draw: function (ctx, st, g, L, bare) {
      ctx.fillStyle = P.bg; ctx.fillRect(0, 0, L.W, L.H);
      ctx.drawImage(R.modern.layer(st, L), L.OX, L.OY);
      drawFlash(ctx, st, L);
      drawTrail(ctx, st, L);
      var t = st.time, i;
      for (i = 0; i < st.land.length; i++) drawMite(ctx, st.land[i], L, t);
      for (i = 0; i < st.sea.length; i++) drawBall(ctx, st.sea[i], L, t);
      drawPlayer(ctx, st, L, t);
      if (!bare) { R.ui.hud(g, ctx, st, P, L); R.ui.banner(g, ctx, st, P, L); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
