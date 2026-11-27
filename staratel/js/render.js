/* СТАРАТЕЛЬ · рендер обеих тем (modern — мягкие формы и свет, retro — плоские «восьмибитные» блоки). Только читает состояние игры.
   Портрет 450×660: шапка, поле, подсказка; альбом 800×450: поле слева, панель справа. STARATEL.render */
(function (global) {
  'use strict';
  var SW = global.STARATEL = global.STARATEL || {}, K = SW.K;
  var PAL = {
    modern: { pixel: false, cave: '#141a23', cave2: '#18202b', rock: '#4a5565', rockHi: '#69768a', rockLo: '#323b48', soil: '#8c5a34', soilHi: '#b37a49', soilLo: '#5f3a20',
      water: '63,167,255', waterHi: '#bfe6ff', waterLo: '#2b7fd1', wood: '#c88c46', woodDk: '#7a4f22', metal: '#8e9aab', gold: '#f2b632', goldDk: '#a9741a', cart: '#9aa7b6', cartDk: '#5b6879',
      lift: '#f2b632', ink: '#eef3f8', muted: '#93a4b8', accent: '#f0b429', good: '#4fd68a', bad: '#ff6b6b', line: '#34455a', panel: '#1b2430', star: '#f2b632', starOff: '#3a4658' },
    retro: { pixel: true, cave: '#000000', cave2: '#000022', rock: '#555555', rockHi: '#aaaaaa', rockLo: '#222222', soil: '#aa5500', soilHi: '#ff9933', soilLo: '#552200', water: '85,85,255', waterHi: '#aaaaff', waterLo: '#0000aa',
      wood: '#ffaa00', woodDk: '#aa5500', metal: '#aaaaaa', gold: '#ffff55', goldDk: '#aa8800', cart: '#aaaaaa', cartDk: '#555555', lift: '#ffff55', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffcc33',
      good: '#55ff55', bad: '#ff5555', line: '#5555aa', panel: '#000000', star: '#ffff55', starOff: '#444444' }
  };
  function pal(g) { return PAL[g.themeName === 'retro' ? 'retro' : 'modern']; }
  function land(g) { return g.W > g.H; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // геометрия поля: размер клетки, смещение, панель (в альбоме)
  function geo(g, L) {
    var W = g.W, H = g.H, cs, ox, oy, panel = null, rx, rw, ry, rh;
    if (W > H) { rx = 10; rw = W - 250; ry = 38; rh = H - 48; panel = { x: W - 232, y: 38, w: 222, h: H - 48 }; }
    else { rx = 8; rw = W - 16; ry = 92; rh = H - 92 - 44; }
    cs = Math.floor(Math.min(rw / L.W, rh / L.H)); ox = rx + Math.floor((rw - cs * L.W) / 2); oy = ry + Math.floor((rh - cs * L.H) / 2);
    return { cs: cs, ox: ox, oy: oy, W: L.W, H: L.H, panel: panel, land: W > H, bx: ox, by: oy, bw: cs * L.W, bh: cs * L.H };
  }
  function cellAt(G, px, py) { var x = Math.floor((px - G.ox) / G.cs), y = Math.floor((py - G.oy) / G.cs); return x < 0 || y < 0 || x >= G.W || y >= G.H ? -1 : y * G.W + x; }

  function waterAlpha(S, i) {
    var F = S.F, A = S.anim; if (!A) return F.wet[i] ? 1 : 0;
    var pw = A.prevF.wet[i];
    if (F.wet[i]) return pw ? 1 : clamp((A.t * 16 - F.depth[i] + 1) / 1.2, 0, 1);
    return pw ? Math.max(0, 1 - A.t * 3) : 0;
  }
  function cellCenter(G, i) { return { x: G.ox + (i % G.W + 0.5) * G.cs, y: G.oy + (Math.floor(i / G.W) + 0.5) * G.cs }; }
  function cartPos(G, S, idx) {
    var A = S.anim, cell = S.carts[idx], path = A && A.paths[idx];
    if (!path || path.length < 2) return cellCenter(G, cell);
    var f = (A.t - 0.12) * 7; if (f <= 0) return cellCenter(G, path[0]); if (f >= path.length - 1) return cellCenter(G, path[path.length - 1]);
    var a = cellCenter(G, path[Math.floor(f)]), b = cellCenter(G, path[Math.floor(f) + 1]), u = f - Math.floor(f); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  }

  // ---------- клетки ----------
  function drawRock(c, P, x, y, s, i, L) {
    if (P.pixel) { c.fillStyle = P.rock; c.fillRect(x, y, s, s); c.fillStyle = P.rockHi; c.fillRect(x, y, s, 3); c.fillRect(x, y, 3, s); c.fillStyle = P.rockLo; c.fillRect(x, y + s - 3, s, 3); c.fillRect(x + s - 3, y, 3, s);
      c.fillStyle = P.rockLo; c.fillRect(x + (i * 7) % (s - 8) + 3, y + (i * 11) % (s - 8) + 3, 4, 4); return; }
    var gr = c.createLinearGradient(x, y, x, y + s); gr.addColorStop(0, P.rockHi); gr.addColorStop(0.25, P.rock); gr.addColorStop(1, P.rockLo);
    c.fillStyle = gr; rr(c, x + 0.5, y + 0.5, s - 1, s - 1, s * 0.16); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.moveTo(x + s * 0.2, y + s * (0.35 + (i % 3) * 0.12)); c.lineTo(x + s * 0.55, y + s * 0.5); c.lineTo(x + s * 0.8, y + s * 0.42); c.stroke();
  }
  function drawSoil(c, P, x, y, s, i, t, pulse) {
    if (P.pixel) { c.fillStyle = P.soil; c.fillRect(x, y, s, s); c.fillStyle = P.soilHi; for (var k = 0; k < 5; k++) c.fillRect(x + ((i * 13 + k * 17) % (s - 6)) + 2, y + ((i * 7 + k * 23) % (s - 6)) + 2, 4, 3);
      c.fillStyle = P.soilLo; c.fillRect(x, y + s - 3, s, 3); c.fillRect(x + s - 3, y, 3, s); c.fillStyle = '#000'; c.fillRect(x + s * 0.3, y + s * 0.3, 3, s * 0.4); c.fillRect(x + s * 0.3, y + s * 0.5, s * 0.35, 3); }
    else { var gr = c.createLinearGradient(x, y, x, y + s); gr.addColorStop(0, P.soilHi); gr.addColorStop(1, P.soilLo); c.fillStyle = gr; rr(c, x + 0.5, y + 0.5, s - 1, s - 1, s * 0.12); c.fill();
      c.fillStyle = 'rgba(0,0,0,.22)'; for (var j = 0; j < 6; j++) { c.beginPath(); c.arc(x + ((i * 13 + j * 19) % 100) / 100 * s * 0.8 + s * 0.1, y + ((i * 29 + j * 31) % 100) / 100 * s * 0.8 + s * 0.1, s * 0.04 + (j % 3) * s * 0.012, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(40,20,8,.7)'; c.lineWidth = Math.max(1.5, s * 0.04); c.beginPath(); c.moveTo(x + s * 0.3, y + s * 0.2); c.lineTo(x + s * 0.45, y + s * 0.45); c.lineTo(x + s * 0.35, y + s * 0.6); c.lineTo(x + s * 0.55, y + s * 0.82); c.stroke(); }
    if (pulse) { c.strokeStyle = P.accent; c.globalAlpha = 0.35 + 0.35 * Math.sin(t * 5); c.lineWidth = 2; c.strokeRect(x + 2, y + 2, s - 4, s - 4); c.globalAlpha = 1; }
  }
  function drawGate(c, P, x, y, s, open, t, pulse) {
    var w = s * 0.74, px = x + (s - w) / 2;
    if (open) {   // доски подняты наверх, виден проём
      c.fillStyle = P.woodDk; c.fillRect(x + 1, y, s * 0.12, s); c.fillRect(x + s - 1 - s * 0.12, y, s * 0.12, s);
      c.fillStyle = P.wood; if (P.pixel) c.fillRect(px, y, w, s * 0.2); else { rr(c, px, y + 1, w, s * 0.2, 3); c.fill(); }
      c.strokeStyle = P.metal; c.lineWidth = 2; c.beginPath(); c.moveTo(x + s / 2, y + s * 0.2); c.lineTo(x + s / 2, y + s * 0.42); c.stroke();
      c.fillStyle = P.metal; c.fillRect(x + s / 2 - 3, y + s * 0.4, 6, 4);
    } else {
      c.fillStyle = P.woodDk; c.fillRect(x + 1, y, s * 0.12, s); c.fillRect(x + s - 1 - s * 0.12, y, s * 0.12, s);
      for (var k = 0; k < 4; k++) { c.fillStyle = k % 2 ? P.wood : '#d89d58'; if (P.pixel) c.fillStyle = k % 2 ? '#ffaa00' : '#ff9900'; c.fillRect(px + k * w / 4 + 0.5, y + 1, w / 4 - 1, s - 2); }
      c.fillStyle = P.metal; c.fillRect(px, y + s * 0.22, w, 3); c.fillRect(px, y + s * 0.7, w, 3);
    }
    if (pulse) { c.strokeStyle = P.accent; c.globalAlpha = 0.35 + 0.35 * Math.sin(t * 5); c.lineWidth = 2; c.strokeRect(x + 2, y + 2, s - 4, s - 4); c.globalAlpha = 1; }
  }
  function drawSpring(c, P, x, y, s, t) {
    c.fillStyle = P.metal; if (P.pixel) { c.fillRect(x + s * 0.2, y, s * 0.6, s * 0.28); c.fillStyle = P.rockLo; c.fillRect(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.08); }
    else { rr(c, x + s * 0.18, y + 1, s * 0.64, s * 0.3, 4); c.fill(); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + s * 0.22, y + s * 0.24, s * 0.56, s * 0.05); }
    c.fillStyle = P.waterHi; for (var k = 0; k < 3; k++) { var u = ((t * 1.6 + k / 3) % 1); c.fillRect(x + s * 0.5 - 1.5, y + s * 0.3 + u * s * 0.6, 3, 4); }
  }
  function drawLift(c, P, x, y, s, t, loaded) {
    var bw = s * 0.12; c.fillStyle = P.rockLo; c.fillRect(x + 1, y, bw, s); c.fillRect(x + s - 1 - bw, y, bw, s);
    c.strokeStyle = P.lift; c.lineWidth = Math.max(2, s * 0.05); c.strokeRect(x + s * 0.18, y + s * 0.12, s * 0.64, s * 0.8);
    c.fillStyle = P.lift; for (var k = 0; k < 4; k++) { c.globalAlpha = 0.9; if (k % 2 === 0) c.fillRect(x + s * 0.18 + k * s * 0.16, y + s * 0.84, s * 0.16, s * 0.08); }
    c.globalAlpha = 1; var by = ((t * 0.9) % 1);
    c.fillStyle = loaded ? P.good : P.lift; c.globalAlpha = 0.9 - by * 0.6; var ay = y + s * 0.5 - by * s * 0.22; c.beginPath(); c.moveTo(x + s / 2, ay - s * 0.14); c.lineTo(x + s / 2 + s * 0.14, ay + s * 0.04); c.lineTo(x + s / 2 - s * 0.14, ay + s * 0.04); c.closePath(); c.fill(); c.globalAlpha = 1;
  }
  function drawCart(c, P, cx, cy, s, bob, onLift) {
    var u = s, y0 = cy + bob; c.save();
    if (P.pixel) { c.fillStyle = P.cartDk; c.fillRect(cx - u * 0.34, y0 - u * 0.1, u * 0.68, u * 0.3); c.fillStyle = P.cart; c.fillRect(cx - u * 0.3, y0 - u * 0.06, u * 0.6, u * 0.2);
      c.fillStyle = P.gold; c.fillRect(cx - u * 0.22, y0 - u * 0.2, u * 0.12, u * 0.12); c.fillRect(cx - u * 0.04, y0 - u * 0.26, u * 0.14, u * 0.16); c.fillRect(cx + u * 0.12, y0 - u * 0.18, u * 0.12, u * 0.1);
      c.fillStyle = '#000'; c.fillRect(cx - u * 0.26, y0 + u * 0.2, u * 0.14, u * 0.12); c.fillRect(cx + u * 0.12, y0 + u * 0.2, u * 0.14, u * 0.12); }
    else {
      c.fillStyle = P.gold; [[-0.2, -0.14, 0.13], [0, -0.2, 0.16], [0.2, -0.13, 0.12], [-0.08, -0.1, 0.12]].forEach(function (o) { c.beginPath(); c.arc(cx + o[0] * u, y0 + o[1] * u, o[2] * u, 0, 7); c.fill(); });
      c.fillStyle = P.goldDk; c.beginPath(); c.arc(cx + 0.02 * u, y0 - 0.13 * u, 0.05 * u, 0, 7); c.fill();
      var gr = c.createLinearGradient(cx, y0 - u * 0.1, cx, y0 + u * 0.22); gr.addColorStop(0, '#c4cedb'); gr.addColorStop(1, P.cartDk); c.fillStyle = gr;
      c.beginPath(); c.moveTo(cx - u * 0.36, y0 - u * 0.08); c.lineTo(cx + u * 0.36, y0 - u * 0.08); c.lineTo(cx + u * 0.28, y0 + u * 0.22); c.lineTo(cx - u * 0.28, y0 + u * 0.22); c.closePath(); c.fill();
      c.strokeStyle = '#2b3442'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#e1e8f1'; c.fillRect(cx - u * 0.38, y0 - u * 0.1, u * 0.76, u * 0.05);
      c.fillStyle = '#1d232d'; c.beginPath(); c.arc(cx - u * 0.17, y0 + u * 0.26, u * 0.09, 0, 7); c.arc(cx + u * 0.17, y0 + u * 0.26, u * 0.09, 0, 7); c.fill(); }
    if (onLift) { c.strokeStyle = P.good; c.lineWidth = 2; c.globalAlpha = 0.8; c.strokeRect(cx - u * 0.42, y0 - u * 0.32, u * 0.84, u * 0.72); c.globalAlpha = 1; }
    c.restore();
  }
  function drawWater(c, P, S, L, G, x, y, i, a, t) {
    var s = G.cs, F = S.F; if (a <= 0) return;
    var cx = i % G.W, cy = Math.floor(i / G.W), above = cy > 0 ? waterAlpha(S, i - G.W) : 0, d = F.dir[i], col = P.water;
    c.save(); c.globalAlpha = (P.pixel ? 0.92 : 0.74) * a; c.fillStyle = P.pixel ? P.waterLo : 'rgb(' + col + ')'; c.fillRect(x, y, s, s); c.globalAlpha = a;
    if (above < 0.5 && !(L.kind[i - G.W] === K.SPRING)) {   // поверхность
      c.fillStyle = P.waterHi; if (P.pixel) c.fillRect(x, y, s, 3); else { c.beginPath(); c.moveTo(x, y + 3); for (var k = 0; k <= 8; k++) c.lineTo(x + k * s / 8, y + 3 + Math.sin(t * 3 + (cx + k / 8) * 2.4) * 2); c.lineTo(x + s, y); c.lineTo(x, y); c.closePath(); c.globalAlpha = 0.9 * a; c.fill(); }
    }
    c.globalAlpha = 0.5 * a; c.strokeStyle = P.waterHi; c.fillStyle = P.waterHi; c.lineWidth = 2;
    var ph = (t * 0.9 + cx * 0.17) % 1;   // стрелки течения
    if (F.par[i] >= 0) {
      var mx = x + s / 2, my = y + s / 2, q = (ph - 0.5) * s * 0.5;
      if (d === K.DOWN) { c.beginPath(); c.moveTo(mx - s * 0.12, my + q - s * 0.06); c.lineTo(mx, my + q + s * 0.06); c.lineTo(mx + s * 0.12, my + q - s * 0.06); c.stroke(); }
      else { var sg = d === K.RIGHT ? 1 : -1; c.beginPath(); c.moveTo(mx + sg * q - sg * s * 0.06, my - s * 0.12); c.lineTo(mx + sg * q + sg * s * 0.06, my); c.lineTo(mx + sg * q - sg * s * 0.06, my + s * 0.12); c.stroke(); }
    }
    c.restore();
  }

  // ---------- поле ----------
  function drawBoard(c, g, G0, S, o) {
    var P = pal(g), L = G0.L, G = G0.geo, s = G.cs, t = g.time || 0, i, x, y, tut = o && o.pulseTut;
    c.fillStyle = P.cave; c.fillRect(G.ox - 3, G.oy - 3, G.bw + 6, G.bh + 6);
    for (i = 0; i < L.N; i++) {
      x = G.ox + (i % G.W) * s; y = G.oy + Math.floor(i / G.W) * s;
      if (!P.pixel && ((i % G.W) + Math.floor(i / G.W)) % 2) { c.fillStyle = P.cave2; c.fillRect(x, y, s, s); }
      var k = L.kind[i];
      if (k === K.ROCK) drawRock(c, P, x, y, s, i, L);
      else if (k === K.SOIL && !((S.dug >> L.soilAt[i]) & 1)) drawSoil(c, P, x, y, s, i, t, tut);
    }
    for (i = 0; i < L.N; i++) { x = G.ox + (i % G.W) * s; y = G.oy + Math.floor(i / G.W) * s; if (L.lift[i]) drawLift(c, P, x, y, s, t, S.carts.some(function (cc) { return cc === i; })); }
    for (i = 0; i < L.N; i++) { var a = waterAlpha(S, i); if (a > 0 && L.kind[i] !== K.ROCK) drawWater(c, P, S, L, G, G.ox + (i % G.W) * s, G.oy + Math.floor(i / G.W) * s, i, a, t); }
    for (i = 0; i < L.N; i++) {
      x = G.ox + (i % G.W) * s; y = G.oy + Math.floor(i / G.W) * s;
      if (L.kind[i] === K.SPRING) drawSpring(c, P, x, y, s, t);
      else if (L.kind[i] === K.GATE) drawGate(c, P, x, y, s, !!((S.gates >> L.gateAt[i]) & 1), t, tut);
    }
    for (var n = 0; n < S.carts.length; n++) {
      var p = cartPos(G, S, n), cell = S.carts[n], wet = S.F.wet[cell] || (S.anim && S.anim.prevF.wet[cell]);
      drawCart(c, P, p.x, p.y, s, wet ? Math.sin(t * 3.2 + n * 2) * s * 0.025 : 0, !!L.lift[cell]);
    }
    if (o && o.hint >= 0) { var hc = cellCenter(G, o.hint); c.strokeStyle = P.good; c.lineWidth = 3; c.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6); if (P.pixel) c.strokeRect(hc.x - s / 2 + 1, hc.y - s / 2 + 1, s - 2, s - 2); else { rr(c, hc.x - s / 2 + 1, hc.y - s / 2 + 1, s - 2, s - 2, 6); c.stroke(); } c.globalAlpha = 1; }
    if (o && o.cursor >= 0) { var cc = cellCenter(G, o.cursor); c.strokeStyle = P.accent; c.lineWidth = 3; if (P.pixel) c.strokeRect(cc.x - s / 2 + 2, cc.y - s / 2 + 2, s - 4, s - 4); else { rr(c, cc.x - s / 2 + 2, cc.y - s / 2 + 2, s - 4, s - 4, 6); c.stroke(); } }
    c.strokeStyle = P.line; c.lineWidth = 2; c.strokeRect(G.ox - 3, G.oy - 3, G.bw + 6, G.bh + 6);
  }
  function starsStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function drawStars(c, P, cx, cy, size, n, gap) {
    for (var k = 0; k < 3; k++) { var x = cx + (k - 1) * (gap || size * 1.2); c.fillStyle = k < n ? P.star : P.starOff; c.beginPath();
      for (var j = 0; j < 10; j++) { var r = j % 2 ? size * 0.22 : size * 0.5, an = -Math.PI / 2 + j * Math.PI / 5; c.lineTo(x + Math.cos(an) * r, cy + Math.sin(an) * r); } c.closePath(); c.fill(); }
  }

  function wrapText(g, text, cx, y, maxW, size, lh, color, maxLines) {
    var c = g.ctx, th = g.th(), words = String(text).split(' '), line = '', lines = [];
    c.font = '700 ' + size + 'px ' + th.font;
    words.forEach(function (w) { var tt = line ? line + ' ' + w : w; if (c.measureText(tt).width > maxW && line) { lines.push(line); line = w; } else line = tt; }); if (line) lines.push(line);
    lines.slice(0, maxLines).forEach(function (ln, k) { g.text(ln, cx, y + k * lh, { size: size, color: color, weight: 700, align: 'center', maxWidth: maxW, minSize: 8 }); });
  }
  // ---------- кадр партии ----------
  // G0 = { L, geo }, S = game.state(); o = { level, count, par, tut, hint, cursor, stuck, toasts, pulseTut }
  function draw(c, g, S, G0, o) {
    var P = pal(g), th = g.th(), W = g.W, H = g.H, G = G0.geo, moves = S.moves, par = o.par, potential = S.cleared ? S.stars : SW.starsFor(Math.max(moves, 1), par);
    c.fillStyle = th.bg; c.fillRect(0, 0, W, H);
    var gr = c.createLinearGradient(0, 0, 0, H); if (!P.pixel) { gr.addColorStop(0, '#16202c'); gr.addColorStop(1, '#0d1118'); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
    drawBoard(c, g, G0, S, o);
    // шапка/панель
    if (!G.land) {
      g.text(g.t('level') + ' ' + o.level + '/' + o.count, 14, 40, { size: 22, color: P.accent, weight: 900, maxWidth: 200 });
      g.text(g.t('moves') + ' ' + moves + ' / ' + g.t('norm') + ' ' + par, W - 14, 38, { size: 17, color: P.ink, weight: 800, align: 'right', maxWidth: 230 });
      drawStars(c, P, W - 54, 58, 16, potential, 19);
      if (o.tut) g.text(o.tut, W / 2, 80, { size: 14, color: P.ink, weight: 700, align: 'center', maxWidth: W - 20, minSize: 9 });
    } else {
      var pn = G.panel; c.fillStyle = P.pixel ? '#000' : 'rgba(27,36,48,.8)'; if (P.pixel) { c.fillRect(pn.x, pn.y, pn.w, pn.h); c.strokeStyle = P.line; c.lineWidth = 3; c.strokeRect(pn.x, pn.y, pn.w, pn.h); } else { rr(c, pn.x, pn.y, pn.w, pn.h, 14); c.fill(); c.strokeStyle = P.line; c.lineWidth = 1; c.stroke(); }
      g.text(g.t('level') + ' ' + o.level + '/' + o.count, pn.x + pn.w / 2, pn.y + 34, { size: 24, color: P.accent, weight: 900, align: 'center', maxWidth: pn.w - 20 });
      g.text(g.t('moves') + ': ' + moves, pn.x + pn.w / 2, pn.y + 70, { size: 20, color: P.ink, weight: 800, align: 'center', maxWidth: pn.w - 20 });
      g.text(g.t('norm') + ': ' + par, pn.x + pn.w / 2, pn.y + 96, { size: 15, color: P.muted, weight: 700, align: 'center', maxWidth: pn.w - 20 });
      drawStars(c, P, pn.x + pn.w / 2, pn.y + 128, 26, potential, 32);
      wrapText(g, o.tut, pn.x + pn.w / 2, pn.y + 176, pn.w - 24, 13, 18, P.ink, 6);
      if (!o.stuck && o.footer) wrapText(g, o.footer, pn.x + pn.w / 2, pn.y + pn.h - 62, pn.w - 20, 11, 15, P.muted, 4);
    }
    if (o.stuck) { if (G.land) wrapText(g, g.t('stuck'), G.panel.x + G.panel.w / 2, G.panel.y + G.panel.h - 56, G.panel.w - 20, 14, 18, P.bad, 3); else g.text(g.t('stuck'), W / 2, H - 18, { size: 14, color: P.bad, weight: 800, align: 'center', maxWidth: W - 20, minSize: 9 }); }
    else if (o.footer && !G.land) g.text(o.footer, W / 2, H - 18, { size: 11, color: P.muted, weight: 600, align: 'center', maxWidth: W - 20, minSize: 8 });
    (o.toasts || []).forEach(function (tt) { c.globalAlpha = Math.min(1, tt.t * 1.5); g.text(tt.text, tt.x, tt.y - (1.2 - tt.t) * 24, { size: tt.size || 16, color: tt.color, weight: 900, align: 'center', maxWidth: W - 20 }); c.globalAlpha = 1; });
  }
  global.STARATEL.render = { pal: pal, land: land, geo: geo, cellAt: cellAt, draw: draw, drawBoard: drawBoard, drawStars: drawStars, starsStr: starsStr, rr: rr, cellCenter: cellCenter, waterAlpha: waterAlpha };
})(typeof window !== 'undefined' ? window : globalThis);
