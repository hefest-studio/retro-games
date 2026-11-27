/* ОБВАЛ · рендер обеих тем (modern — тёплые объёмные блоки и свет, retro — плоские «восьмибитные» цвета). Только читает состояние игры.
   Портрет 450×660: шапка, поле, подсказка; альбом 800×450: поле слева, панель справа. OBVAL.render
   Образы: скала (тёмный базальт), порода (светлый угловатый блок), крепь (брус с плитами), шахтёр-спасатель (бирюзовый комбинезон, белая каска),
   выход (лестница вверх), очаг (штриховка, пульсирует; засыпан — зелёная отметка). */
(function (global) {
  'use strict';
  var OB = global.OBVAL = global.OBVAL || {}, K = OB.K;
  var PAL = {
    modern: { pixel: false, cave: '#1a1411', cave2: '#1e1814', wall: '#3d3b49', wallHi: '#5d5a6e', wallLo: '#26242f', rock: '#b89868', rockHi: '#dcc08f', rockLo: '#7a6240',
      wood: '#cf934e', woodHi: '#e8b676', woodDk: '#7a4a20', metal: '#9aa3b0', metalDk: '#5a626e', suit: '#25bfae', suitDk: '#12786f', hat: '#f4f1ea', hatStripe: '#e5484d', vest: '#ffc53d',
      exit: '#5fd68a', exitDk: '#2e8a53', haz: '#ff5a3c', hazDk: '#7a1d10', ink: '#f6efe8', muted: '#a89a8c', accent: '#ff8a3d', good: '#5fd68a', bad: '#ff6b5c', line: '#4d3b2e',
      panel: '#241c17', star: '#ffc53d', starOff: '#4a3d33' },
    retro: { pixel: true, cave: '#000000', cave2: '#000000', wall: '#555555', wallHi: '#aaaaaa', wallLo: '#222222', rock: '#aa5500', rockHi: '#ffaa55', rockLo: '#552200',
      wood: '#ffaa00', woodHi: '#ffff55', woodDk: '#aa5500', metal: '#aaaaaa', metalDk: '#555555', suit: '#55ffff', suitDk: '#00aaaa', hat: '#ffffff', hatStripe: '#ff5555', vest: '#ffff55',
      exit: '#55ff55', exitDk: '#00aa00', haz: '#ff5555', hazDk: '#aa0000', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffaa00', good: '#55ff55', bad: '#ff5555', line: '#5555aa',
      panel: '#000000', star: '#ffff55', starOff: '#444444' }
  };
  function pal(g) { return PAL[g.themeName === 'retro' ? 'retro' : 'modern']; }
  function land(g) { return g.W > g.H; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var FD = 0.11;   // секунд на кадр обрушения

  function geo(g, L) {
    var W = g.W, H = g.H, cs, ox, oy, panel = null, rx, rw, ry, rh;
    if (W > H) { rx = 10; rw = W - 250; ry = 38; rh = H - 48; panel = { x: W - 232, y: 38, w: 222, h: H - 48 }; }
    else { rx = 8; rw = W - 16; ry = 104; rh = H - 104 - 40; }
    cs = Math.floor(Math.min(rw / L.W, rh / L.H)); ox = rx + Math.floor((rw - cs * L.W) / 2); oy = ry + Math.floor((rh - cs * L.H) / 2);
    return { cs: cs, ox: ox, oy: oy, W: L.W, H: L.H, panel: panel, land: W > H, bx: ox, by: oy, bw: cs * L.W, bh: cs * L.H };
  }
  function cellAt(G, px, py) { var x = Math.floor((px - G.ox) / G.cs), y = Math.floor((py - G.oy) / G.cs); return x < 0 || y < 0 || x >= G.W || y >= G.H ? -1 : y * G.W + x; }
  function cellCenter(G, i) { return { x: G.ox + (i % G.W + 0.5) * G.cs, y: G.oy + (Math.floor(i / G.W) + 0.5) * G.cs }; }
  function cellXY(G, i) { return { x: G.ox + (i % G.W) * G.cs, y: G.oy + Math.floor(i / G.W) * G.cs }; }

  // ---------- клетки ----------
  function drawWall(c, P, x, y, s, i, L) {
    var W = L.W, up = i >= W && L.wall[i - W], dn = i < L.N - W && L.wall[i + W], lf = i % W > 0 && L.wall[i - 1], rt = i % W < W - 1 && L.wall[i + 1];
    if (P.pixel) { c.fillStyle = P.wall; c.fillRect(x, y, s, s); c.fillStyle = P.wallHi; if (!up) c.fillRect(x, y, s, 3); if (!lf) c.fillRect(x, y, 3, s); c.fillStyle = P.wallLo; if (!dn) c.fillRect(x, y + s - 3, s, 3); if (!rt) c.fillRect(x + s - 3, y, 3, s);
      c.fillStyle = P.wallLo; c.fillRect(x + (i * 7) % (s - 8) + 3, y + (i * 11) % (s - 8) + 3, 3, 3); return; }
    var gr = c.createLinearGradient(x, y, x, y + s); gr.addColorStop(0, P.wall); gr.addColorStop(1, P.wallLo); c.fillStyle = gr; c.fillRect(x, y, s + 0.5, s + 0.5);
    c.fillStyle = P.wallHi; if (!up) c.fillRect(x, y, s, 2); c.fillStyle = 'rgba(255,255,255,.07)'; if (!lf) c.fillRect(x, y, 2, s);
    c.fillStyle = 'rgba(0,0,0,.28)'; if (!dn) c.fillRect(x, y + s - 3, s, 3); if (!rt) c.fillRect(x + s - 2, y, 2, s);
    c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.arc(x + ((i * 37) % 60) / 60 * s * 0.7 + s * 0.15, y + ((i * 53) % 60) / 60 * s * 0.7 + s * 0.15, s * 0.07, 0, 7); c.fill();
  }
  function drawRock(c, P, x, y, s, i, glow) {
    var m = s * 0.06, a = x + m, b = y + m, w = s - 2 * m, h = s - 2 * m;
    if (P.pixel) { c.fillStyle = P.rock; c.fillRect(a, b, w, h); c.fillStyle = P.rockHi; c.fillRect(a, b, w, 3); c.fillRect(a, b, 3, h); c.fillStyle = P.rockLo; c.fillRect(a, b + h - 3, w, 3); c.fillRect(a + w - 3, b, 3, h);
      c.fillStyle = '#000'; c.fillRect(a + w * 0.3, b + h * 0.3, 3, h * 0.4); c.fillRect(a + w * 0.3, b + h * 0.5, w * 0.3, 3); return; }
    var k = s * 0.2, gr = c.createLinearGradient(a, b, a, b + h); gr.addColorStop(0, P.rockHi); gr.addColorStop(0.3, P.rock); gr.addColorStop(1, P.rockLo);
    c.fillStyle = gr; c.beginPath(); c.moveTo(a + k, b); c.lineTo(a + w - k * 0.6, b); c.lineTo(a + w, b + k * 0.9); c.lineTo(a + w, b + h - k); c.lineTo(a + w - k, b + h); c.lineTo(a + k * 0.7, b + h); c.lineTo(a, b + h - k * 0.8); c.lineTo(a, b + k); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,18,6,.55)'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(40,24,8,.55)'; c.lineWidth = Math.max(1.2, s * 0.035); c.beginPath(); c.moveTo(a + w * 0.28, b + h * 0.18); c.lineTo(a + w * 0.44, b + h * 0.42); c.lineTo(a + w * 0.34, b + h * 0.6); c.lineTo(a + w * 0.52, b + h * 0.86); c.stroke();
    c.beginPath(); c.moveTo(a + w * 0.44, b + h * 0.42); c.lineTo(a + w * 0.72, b + h * 0.5); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(a + k, b + 2); c.lineTo(a + w * 0.55, b + 2); c.lineTo(a + w * 0.4, b + h * 0.2); c.lineTo(a + k * 0.7, b + h * 0.22); c.closePath(); c.fill();
  }
  function drawProp(c, P, x, y, s, hot) {
    var w = s * 0.46, px = x + (s - w) / 2, cap = s * 0.14;
    if (P.pixel) { c.fillStyle = P.woodDk; c.fillRect(px, y, w, s); c.fillStyle = P.wood; c.fillRect(px + 3, y + cap, w - 6, s - 2 * cap); c.fillStyle = P.woodHi; c.fillRect(px + 3, y + cap, 3, s - 2 * cap);
      c.fillStyle = P.metal; c.fillRect(x + s * 0.12, y, s * 0.76, cap); c.fillRect(x + s * 0.12, y + s - cap, s * 0.76, cap); }
    else { var gr = c.createLinearGradient(px, 0, px + w, 0); gr.addColorStop(0, P.woodHi); gr.addColorStop(0.35, P.wood); gr.addColorStop(1, P.woodDk);
      c.fillStyle = gr; rr(c, px, y + cap * 0.5, w, s - cap, s * 0.05); c.fill(); c.strokeStyle = 'rgba(40,20,6,.55)'; c.lineWidth = 1; c.stroke();
      c.strokeStyle = 'rgba(60,30,8,.4)'; c.beginPath(); c.moveTo(px + w * 0.5, y + s * 0.2); c.lineTo(px + w * 0.5, y + s * 0.5); c.moveTo(px + w * 0.3, y + s * 0.6); c.lineTo(px + w * 0.3, y + s * 0.8); c.stroke();
      var mg = c.createLinearGradient(0, y, 0, y + cap); mg.addColorStop(0, '#c9d1dc'); mg.addColorStop(1, P.metalDk); c.fillStyle = mg;
      rr(c, x + s * 0.12, y + 1, s * 0.76, cap, 3); c.fill(); rr(c, x + s * 0.12, y + s - cap - 1, s * 0.76, cap, 3); c.fill(); }
    if (hot) { c.strokeStyle = P.accent; c.globalAlpha = 0.35 + 0.35 * Math.sin(hot * 5); c.lineWidth = 2; c.strokeRect(x + 2, y + 2, s - 4, s - 4); c.globalAlpha = 1; }
  }
  function drawExit(c, P, x, y, s, t, got) {
    var bw = s * 0.12; c.fillStyle = P.exitDk; c.fillRect(x + s * 0.2, y + s * 0.06, bw, s * 0.9); c.fillRect(x + s * 0.8 - bw, y + s * 0.06, bw, s * 0.9);
    c.fillStyle = P.exit; for (var k = 0; k < 4; k++) c.fillRect(x + s * 0.2, y + s * (0.18 + k * 0.2), s * 0.6, Math.max(2, s * 0.06));
    var u = (t * 0.9) % 1, ay = y + s * 0.5 - u * s * 0.18; c.fillStyle = got ? P.ink : P.good; c.globalAlpha = 0.9 - u * 0.6; c.beginPath(); c.moveTo(x + s / 2, ay - s * 0.16); c.lineTo(x + s / 2 + s * 0.16, ay + s * 0.04); c.lineTo(x + s / 2 - s * 0.16, ay + s * 0.04); c.closePath(); c.fill(); c.globalAlpha = 1;
  }
  function drawHaz(c, P, x, y, s, t, filled) {
    var p = 0.5 + 0.5 * Math.sin(t * 4);
    c.save(); c.beginPath(); c.rect(x + 2, y + 2, s - 4, s - 4); c.clip();
    c.fillStyle = P.hazDk; c.fillRect(x, y, s, s); c.strokeStyle = P.haz; c.lineWidth = Math.max(3, s * 0.1); c.globalAlpha = filled ? 0.35 : 0.7 + 0.3 * p;
    for (var k = -2; k < 6; k++) { c.beginPath(); c.moveTo(x + k * s * 0.35, y + s); c.lineTo(x + k * s * 0.35 + s, y); c.stroke(); } c.restore(); c.globalAlpha = 1;
    c.strokeStyle = filled ? P.good : P.haz; c.lineWidth = 2; c.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
  }
  // шахтёр: cx, cy — центр клетки; d — взгляд (±1); st — 0 жив / 1 спасён / 2 погиб; bob — покачивание
  function drawMiner(c, P, cx, cy, s, d, st, bob, t) {
    var u = s, y0 = cy + u * 0.06 + bob; c.save();
    if (st === 2) { c.globalAlpha = 0.9; y0 = cy + u * 0.2; }
    if (P.pixel) {
      c.fillStyle = P.suitDk; c.fillRect(cx - u * 0.26, y0 - u * 0.12, u * 0.52, u * 0.5); c.fillStyle = P.suit; c.fillRect(cx - u * 0.22, y0 - u * 0.12, u * 0.44, u * 0.42);
      c.fillStyle = P.vest; c.fillRect(cx - u * 0.22, y0 + u * 0.06, u * 0.44, u * 0.08);
      c.fillStyle = P.hat; c.fillRect(cx - u * 0.26, y0 - u * 0.36, u * 0.52, u * 0.24); c.fillStyle = P.hatStripe; c.fillRect(cx - u * 0.26, y0 - u * 0.26, u * 0.52, u * 0.06);
      c.fillStyle = '#000'; c.fillRect(cx + d * u * 0.1 - 2, y0 - u * 0.1, 4, 4);
    } else {
      var gr = c.createLinearGradient(cx - u * 0.24, 0, cx + u * 0.24, 0); gr.addColorStop(0, P.suit); gr.addColorStop(1, P.suitDk); c.fillStyle = gr;
      rr(c, cx - u * 0.25, y0 - u * 0.12, u * 0.5, u * 0.5, u * 0.14); c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = P.vest; c.fillRect(cx - u * 0.25, y0 + u * 0.08, u * 0.5, u * 0.07); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(cx - u * 0.25, y0 + u * 0.115, u * 0.5, u * 0.012);
      c.fillStyle = '#1d2b30'; rr(c, cx - u * 0.2, y0 + u * 0.34, u * 0.15, u * 0.1, 3); c.fill(); rr(c, cx + u * 0.05, y0 + u * 0.34, u * 0.15, u * 0.1, 3); c.fill();
      c.fillStyle = '#ffdcb8'; c.beginPath(); c.arc(cx, y0 - u * 0.06, u * 0.17, 0, 7); c.fill();
      c.fillStyle = P.hat; c.beginPath(); c.arc(cx, y0 - u * 0.1, u * 0.22, Math.PI, 0); c.closePath(); c.fill(); c.fillRect(cx - u * 0.27, y0 - u * 0.12, u * 0.54, u * 0.05);
      c.fillStyle = P.hatStripe; c.fillRect(cx - u * 0.05, y0 - u * 0.31, u * 0.1, u * 0.2);
      c.fillStyle = '#1d1a18'; if (st === 2) { c.font = '700 ' + Math.round(u * 0.2) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('✕', cx, y0 - u * 0.0); } else { c.beginPath(); c.arc(cx + d * u * 0.08, y0 - u * 0.05, u * 0.028, 0, 7); c.arc(cx + d * u * 0.015, y0 - u * 0.05, u * 0.028, 0, 7); c.fill(); }
    }
    if (st === 0) { c.fillStyle = P.accent; var ax = cx + d * u * 0.4, ay = y0 + u * 0.1; c.beginPath(); c.moveTo(ax + d * u * 0.1, ay); c.lineTo(ax - d * u * 0.02, ay - u * 0.1); c.lineTo(ax - d * u * 0.02, ay + u * 0.1); c.closePath(); c.fill(); }
    c.restore();
  }

  // ---------- положение движущихся предметов ----------
  // кадры: { r: [id, cell, ...], m: [cell, state, dir, ...] }. Для анимации берём кадр f и интерполируем к f+1.
  function animInfo(S) {
    var A = S.anim; if (!A) return null; var n = A.frames.length, f = A.t / FD; if (f >= n - 1) return null;
    var i0 = Math.max(0, Math.floor(f)), i1 = Math.min(n - 1, i0 + 1); return { a: A.frames[i0], b: A.frames[i1], u: f - i0 };
  }
  function lerpPos(G, c0, c1, u) { var p = cellCenter(G, c0), q = cellCenter(G, c1); return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u }; }

  // ---------- поле ----------
  function drawBoard(c, g, G0, S, o) {
    var P = pal(g), L = G0.L, G = G0.geo, s = G.cs, t = g.time || 0, i, x, y, tut = o && o.pulseTut, an = animInfo(S);
    c.fillStyle = P.cave; c.fillRect(G.ox - 3, G.oy - 3, G.bw + 6, G.bh + 6);
    for (i = 0; i < L.N; i++) {
      x = G.ox + (i % G.W) * s; y = G.oy + Math.floor(i / G.W) * s;
      if (!P.pixel && ((i % G.W) + Math.floor(i / G.W)) % 2) { c.fillStyle = P.cave2; c.fillRect(x, y, s, s); }
      if (L.wall[i]) drawWall(c, P, x, y, s, i, L);
    }
    for (i = 0; i < L.N; i++) {
      x = G.ox + (i % G.W) * s; y = G.oy + Math.floor(i / G.W) * s;
      if (L.exit[i]) drawExit(c, P, x, y, s, t, false);
      else if (L.haz[i]) drawHaz(c, P, x, y, s, t, S.blk[i] === K.ROCK && !an);
    }
    // метки «сюда можно поставить крепь»
    if (o && o.marks && S.stock > 0 && !S.cleared && !S.dead) {
      for (i = 0; i < L.N; i++) if (o.marks[i]) { var q = cellCenter(G, i); c.fillStyle = P.accent; c.globalAlpha = 0.28 + 0.1 * Math.sin(t * 3 + i); c.beginPath(); if (P.pixel) c.fillRect(q.x - 2, q.y - 2, 4, 4); else c.arc(q.x, q.y, Math.max(2, s * 0.06), 0, 7); c.fill(); c.globalAlpha = 1; }
    }
    for (i = 0; i < L.N; i++) if (S.blk[i] === K.PROP) { x = G.ox + (i % G.W) * s; y = G.oy + Math.floor(i / G.W) * s; drawProp(c, P, x, y, s, tut && o.tutCell === i ? t : 0); }
    // порода
    if (an) { var pa = {}, k; for (k = 0; k < an.a.r.length; k += 2) pa[an.a.r[k]] = an.a.r[k + 1];
      for (k = 0; k < an.b.r.length; k += 2) { var id = an.b.r[k], c1 = an.b.r[k + 1], c0 = pa[id] != null ? pa[id] : c1, p = lerpPos(G, c0, c1, an.u); drawRock(c, P, p.x - s / 2, p.y - s / 2, s, id); } }
    else for (i = 0; i < L.N; i++) if (S.blk[i] === K.ROCK) { x = G.ox + (i % G.W) * s; y = G.oy + Math.floor(i / G.W) * s; drawRock(c, P, x, y, s, i); }
    for (i = 0; i < L.N; i++) if (L.haz[i] && S.blk[i] === K.ROCK && !an) { var hc = cellCenter(G, i); c.fillStyle = P.good; c.beginPath(); if (P.pixel) c.fillRect(hc.x + s * 0.18, hc.y - s * 0.4, 6, 6); else c.arc(hc.x + s * 0.28, hc.y - s * 0.28, s * 0.09, 0, 7); c.fill(); }
    // шахтёры
    for (var m = 0; m < S.mp.length; m++) {
      var st = S.ms[m], pos, d = S.md[m], bob = Math.sin(t * 3 + m * 2) * s * 0.012;
      if (an) { var ma = an.a.m, mb = an.b.m, sa = mb[m * 3 + 1]; if (sa === 1 && ma[m * 3 + 1] === 1) continue; pos = lerpPos(G, ma[m * 3], mb[m * 3], an.u); st = an.u > 0.5 ? mb[m * 3 + 1] : ma[m * 3 + 1]; if (st === 1) { c.globalAlpha = 0.6; } bob = 0; }
      else { if (st === 1) continue; pos = cellCenter(G, S.mp[m]); }
      drawMiner(c, P, pos.x, pos.y, s, d, st, bob, t); c.globalAlpha = 1;
    }
    if (o && o.hint >= 0) { var hh = cellCenter(G, o.hint); c.strokeStyle = P.good; c.lineWidth = 3; c.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6); if (P.pixel) c.strokeRect(hh.x - s / 2 + 1, hh.y - s / 2 + 1, s - 2, s - 2); else { rr(c, hh.x - s / 2 + 1, hh.y - s / 2 + 1, s - 2, s - 2, 6); c.stroke(); } c.globalAlpha = 1; }
    if (o && o.cursor >= 0) { var cc = cellCenter(G, o.cursor); c.strokeStyle = P.accent; c.lineWidth = 3; if (P.pixel) c.strokeRect(cc.x - s / 2 + 2, cc.y - s / 2 + 2, s - 4, s - 4); else { rr(c, cc.x - s / 2 + 2, cc.y - s / 2 + 2, s - 4, s - 4, 6); c.stroke(); } }
    c.strokeStyle = P.line; c.lineWidth = 2; c.strokeRect(G.ox - 3, G.oy - 3, G.bw + 6, G.bh + 6);
  }
  function drawStars(c, P, cx, cy, size, n, gap) {
    for (var k = 0; k < 3; k++) { var x = cx + (k - 1) * (gap || size * 1.2); c.fillStyle = k < n ? P.star : P.starOff; c.beginPath();
      for (var j = 0; j < 10; j++) { var r = j % 2 ? size * 0.22 : size * 0.5, an = -Math.PI / 2 + j * Math.PI / 5; c.lineTo(x + Math.cos(an) * r, cy + Math.sin(an) * r); } c.closePath(); c.fill(); }
  }
  function drawPropIcon(c, P, x, y, s, on) { c.globalAlpha = on ? 1 : 0.25; drawProp(c, P, x, y, s, 0); c.globalAlpha = 1; }

  function wrapText(g, text, cx, y, maxW, size, lh, color, maxLines) {
    var c = g.ctx, th = g.th(), words = String(text).split(' '), line = '', lines = [];
    c.font = '700 ' + size + 'px ' + th.font;
    words.forEach(function (w) { var tt = line ? line + ' ' + w : w; if (c.measureText(tt).width > maxW && line) { lines.push(line); line = w; } else line = tt; }); if (line) lines.push(line);
    lines.slice(0, maxLines).forEach(function (ln, k) { g.text(ln, cx, y + k * lh, { size: size, color: color, weight: 700, align: 'center', maxWidth: maxW, minSize: 8 }); });
  }
  function goalText(g, S) {
    var parts = []; if (S.total) parts.push(g.t('saved') + ' ' + S.saved + '/' + S.total); if (S.hazards) parts.push(g.t('hazards') + ' ' + S.filled + '/' + S.hazards); return parts.join(' · ');
  }
  // ---------- кадр партии ----------
  // G0 = { L, geo }, S = game.state(); o = { level, count, par, tut, hint, cursor, stuck, toasts, pulseTut, marks, tutCell, footer, total }
  function draw(c, g, S, G0, o) {
    var P = pal(g), th = g.th(), W = g.W, H = g.H, G = G0.geo, moves = S.moves, par = o.par, potential = S.cleared ? S.stars : OB.starsFor(Math.max(moves, 1), par), stockTotal = o.stockTotal;
    c.fillStyle = th.bg; c.fillRect(0, 0, W, H);
    if (!P.pixel) { var gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#221a15'); gr.addColorStop(1, '#0f0b09'); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
    drawBoard(c, g, G0, S, o);
    var ps = G.land ? 24 : 22, k, bad = S.dead || o.stuck;
    if (!G.land) {
      g.text(g.t('level') + ' ' + o.level + '/' + o.count, 14, 40, { size: 22, color: P.accent, weight: 900, maxWidth: 200 });
      g.text(g.t('moves') + ' ' + moves + ' / ' + g.t('norm') + ' ' + par, W - 14, 38, { size: 17, color: P.ink, weight: 800, align: 'right', maxWidth: 230 });
      drawStars(c, P, W - 54, 58, 16, potential, 19);
      g.text(goalText(g, S), 14, 66, { size: 14, color: P.muted, weight: 700, maxWidth: W * 0.6 });
      if (stockTotal > 0) { g.text(g.t('props') + ':', 14, 88, { size: 12, color: P.muted, weight: 700 }); for (k = 0; k < stockTotal; k++) drawPropIcon(c, P, 70 + k * (ps * 0.8), 74, ps, k < S.stock); }
      if (o.tut) g.text(o.tut, W / 2 + 40, 90, { size: 12, color: P.ink, weight: 700, align: 'center', maxWidth: W - 190, minSize: 8 });
    } else {
      var pn = G.panel; c.fillStyle = P.pixel ? '#000' : 'rgba(36,28,23,.85)'; if (P.pixel) { c.fillRect(pn.x, pn.y, pn.w, pn.h); c.strokeStyle = P.line; c.lineWidth = 3; c.strokeRect(pn.x, pn.y, pn.w, pn.h); } else { rr(c, pn.x, pn.y, pn.w, pn.h, 14); c.fill(); c.strokeStyle = P.line; c.lineWidth = 1; c.stroke(); }
      g.text(g.t('level') + ' ' + o.level + '/' + o.count, pn.x + pn.w / 2, pn.y + 32, { size: 24, color: P.accent, weight: 900, align: 'center', maxWidth: pn.w - 20 });
      g.text(g.t('moves') + ': ' + moves + ' · ' + g.t('norm') + ': ' + par, pn.x + pn.w / 2, pn.y + 62, { size: 16, color: P.ink, weight: 800, align: 'center', maxWidth: pn.w - 20 });
      drawStars(c, P, pn.x + pn.w / 2, pn.y + 90, 24, potential, 30);
      g.text(goalText(g, S), pn.x + pn.w / 2, pn.y + 122, { size: 14, color: P.muted, weight: 700, align: 'center', maxWidth: pn.w - 20 });
      if (stockTotal > 0) { g.text(g.t('props') + ':', pn.x + 14, pn.y + 156, { size: 12, color: P.muted, weight: 700 }); for (k = 0; k < stockTotal; k++) drawPropIcon(c, P, pn.x + 70 + k * 22, pn.y + 140, 26, k < S.stock); }
      wrapText(g, o.tut, pn.x + pn.w / 2, pn.y + 188, pn.w - 24, 13, 18, P.ink, 6);
      if (!bad && o.footer) wrapText(g, o.footer, pn.x + pn.w / 2, pn.y + pn.h - 62, pn.w - 20, 11, 15, P.muted, 4);
    }
    if (bad) { var msg = S.dead ? g.t('dead') : g.t('stuck'); if (G.land) wrapText(g, msg, G.panel.x + G.panel.w / 2, G.panel.y + G.panel.h - 56, G.panel.w - 20, 14, 18, P.bad, 3); else g.text(msg, W / 2, H - 14, { size: 14, color: P.bad, weight: 800, align: 'center', maxWidth: W - 20, minSize: 9 }); }
    else if (o.footer && !G.land) g.text(o.footer, W / 2, H - 14, { size: 11, color: P.muted, weight: 600, align: 'center', maxWidth: W - 20, minSize: 8 });
    (o.toasts || []).forEach(function (tt) { c.globalAlpha = Math.min(1, tt.t * 1.5); g.text(tt.text, tt.x, tt.y - (1.2 - tt.t) * 24, { size: tt.size || 16, color: tt.color, weight: 900, align: 'center', maxWidth: W - 20 }); c.globalAlpha = 1; });
  }
  global.OBVAL.render = { pal: pal, land: land, geo: geo, cellAt: cellAt, draw: draw, drawBoard: drawBoard, drawStars: drawStars, rr: rr, cellCenter: cellCenter, FD: FD };
})(typeof window !== 'undefined' ? window : globalThis);
