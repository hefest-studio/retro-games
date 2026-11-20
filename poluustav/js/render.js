/* ПОЛУУСТАВ · render.js — вся страница рисуется «тушью»: перо с дрожанием штриха, штриховка вместо заливки,
   бумага с волокнами, две краски-акцента (киноварь и охра), «кипение» линий 4 раза в секунду (2 варианта).
   Темы — два варианта туши:
     modern — сепия по тёплой бумаге, акварельная подмывка (вода, лампада, киноварь), фон-иллюстрация размыт;
     retro  — строгая гравюра 1-бит: кадр сводится к двум цветам (тушь/бумага) упорядоченным растром 4×4 в половинном разрешении.
   Статика страницы (твердь) кэшируется кусками по 1024 px; фон-иллюстрация — один холст на страницу (параллакс 0.35).
   Без DOM (Node) модуль только объявляется — тесты рисование не вызывают. */
(function (global) {
  'use strict';
  var P = global.POLU = global.POLU || {};
  var W = 960, H = 540, TAU = Math.PI * 2, PAR = 0.35, CH = 1024, Z = 1.2, VW = W / Z, VH = H / Z;   // мир показан крупнее: окно 800×450
  var HAS_DOM = typeof document !== 'undefined' && !!document.createElement;
  var PAL = P.PAL = {
    modern: { paper: '#efe3c6', paper2: '#e5d4ae', ink: '#3b2817', soft: 'rgba(59,40,23,0.5)', faint: 'rgba(59,40,23,0.22)', verm: '#b4442b', ochre: '#c49536', water: 'rgba(66,92,110,0.42)', waterL: 'rgba(66,92,110,0.75)', inkPool: '#1d140c', pencil: 'rgba(80,72,64,0.55)', night: 'rgba(28,18,10,' },
    retro: { paper: '#f4efe1', paper2: '#d8d0bc', ink: '#120e0a', soft: 'rgba(18,14,10,0.6)', faint: 'rgba(18,14,10,0.3)', verm: '#4a4038', ochre: '#8a8170', water: 'rgba(18,14,10,0.28)', waterL: 'rgba(18,14,10,0.8)', inkPool: '#000000', pencil: 'rgba(18,14,10,0.42)', night: 'rgba(0,0,0,' }
  };
  function rng(seed) { var a = ((seed || 1) * 2654435761) >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  var BV = 0, LWM = 1;                       // вариант «кипения» кадра; множитель толщины штриха (retro — толще: кадр сжимается вдвое)

  // ---------- перо ----------
  function pen(g, pts, w, seed, col, closed) {
    var Rn = rng((seed | 0) * 31 + BV * 977 + 7), n = pts.length; if (n < 2) return;
    var p = [], m = closed ? n : n - 1;
    for (var i = 0; i < m; i++) {
      var a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 8));
      for (var j = 0; j < k; j++) { var f = j / k; p.push([a[0] + (b[0] - a[0]) * f + (Rn() - 0.5) * 1.1, a[1] + (b[1] - a[1]) * f + (Rn() - 0.5) * 1.1]); }
    }
    if (closed) p.push(p[0]); else p.push([pts[n - 1][0], pts[n - 1][1]]);
    g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    var ph = Rn() * 6;
    for (var s = 0; s < p.length - 1; s += 2) {
      g.beginPath(); g.moveTo(p[s][0], p[s][1]); g.lineTo(p[s + 1][0], p[s + 1][1]); if (p[s + 2]) g.lineTo(p[s + 2][0], p[s + 2][1]);
      g.lineWidth = LWM * w * (0.6 + 0.7 * (0.5 + 0.5 * Math.sin(s * 0.31 + ph))); g.stroke();
    }
  }
  function rectPts(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function poly(g, p) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  function ell(cx, cy, rx, ry, n) { var p = []; n = n || 18; for (var i = 0; i < n; i++) { var a = i / n * TAU; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
  // штриховка внутри прямоугольника/многоугольника: ang — наклон, sp — шаг, dens(x,y) 0..1
  function hatch(g, clipPts, bx, by, bw, bh, ang, sp, col, lw, seed, dens) {
    var Rn = rng((seed | 0) + BV * 131), ca = Math.cos(ang), sa = Math.sin(ang), cx = bx + bw / 2, cy = by + bh / 2, Rr = Math.hypot(bw, bh) / 2 + 4;
    g.save(); poly(g, clipPts); g.clip(); g.beginPath();
    for (var c = -Rr, i = 0; c <= Rr; c += sp, i++) {
      var ox = cx - sa * c, oy = cy + ca * c, th = (i * 0.618 + (seed | 0) * 0.37) % 1;
      if (!dens) { g.moveTo(ox - ca * Rr + (Rn() - 0.5), oy - sa * Rr + (Rn() - 0.5)); g.lineTo(ox + ca * Rr + (Rn() - 0.5), oy + sa * Rr + (Rn() - 0.5)); continue; }
      var on = false;
      for (var s = -Rr; s <= Rr; s += 6) {
        var x = ox + ca * s, y = oy + sa * s, vis = dens(x, y) > th;
        if (vis && !on) { g.moveTo(x, y); on = true; } else if (vis) g.lineTo(x + (Rn() - 0.5) * 0.7, y + (Rn() - 0.5) * 0.7); else on = false;
      }
    }
    g.lineWidth = (lw || 0.8) * LWM; g.strokeStyle = col; g.stroke(); g.restore();
  }
  function splat(cx, cy, r, seed, lobes, amp) { var Rn = rng(seed), p = [], ph = Rn() * TAU, n = 30; for (var i = 0; i < n; i++) { var a = i / n * TAU, k = 1 + amp * Math.sin(lobes * a + ph) + amp * 0.5 * Math.sin((lobes + 3) * a + ph * 2); p.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]); } return p; }

  // ---------- бумага (экранная, на тему) ----------
  var PAPER = {};
  function paperTex(th) {
    if (PAPER[th]) return PAPER[th];
    var c = mk(W, H), g = c.getContext('2d'), Rn = rng(17), pal = PAL[th];
    g.fillStyle = pal.paper; g.fillRect(0, 0, W, H);
    var id = g.getImageData(0, 0, W, H), d = id.data;
    for (var i = 0; i < d.length; i += 4) { var v = (Rn() - 0.5) * (th === 'retro' ? 3 : 14); d[i] += v; d[i + 1] += v * 0.95; d[i + 2] += v * 0.8; }
    g.putImageData(id, 0, 0);
    g.lineCap = 'round';
    for (var f = 0; f < (th === 'retro' ? 0 : 700); f++) { var x = Rn() * W, y = Rn() * H, l = 5 + Rn() * 16, a = Rn() * TAU; g.strokeStyle = f % 4 ? 'rgba(255,252,240,0.35)' : 'rgba(120,95,60,0.13)'; g.lineWidth = 0.5 + Rn() * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    if (th === 'modern') {
      for (var s = 0; s < 18; s++) { var sx = Rn() * W, sy = Rn() * H, sr = 6 + Rn() * 22, gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr); gr.addColorStop(0, 'rgba(160,110,50,0.12)'); gr.addColorStop(1, 'rgba(160,110,50,0)'); g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2); }
      var vg = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.66); vg.addColorStop(0, 'rgba(140,95,45,0)'); vg.addColorStop(1, 'rgba(120,80,35,0.3)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    // линовка переписчика: бледные строки и красная черта поля
    if (th === 'modern') { // линовка переписчика: еле видные строки и красная черта поля
      g.strokeStyle = 'rgba(120,90,60,0.055)'; g.lineWidth = 1;
      for (var ly = 46; ly < H - 20; ly += 22) { g.beginPath(); g.moveTo(24, ly); g.lineTo(W - 24, ly); g.stroke(); }
      g.strokeStyle = 'rgba(180,68,43,0.18)'; g.beginPath(); g.moveTo(58, 18); g.lineTo(58, H - 18); g.stroke();
    }
    PAPER[th] = c; return c;
  }

  // ---------- фон-иллюстрация страницы (параллакс) ----------
  var BG = {};
  function bgCanvas(L, th) {
    var key = L.id + '|' + th; if (BG[key]) return BG[key];
    var bw = Math.ceil((L.w - W) * PAR + W + 40), c = mk(bw, H), g = c.getContext('2d'), pal = PAL[th], Rn = rng(L.w + L.id.length * 97);
    var old = BV, oldL = LWM; BV = 0; LWM = th === 'retro' ? 1.9 : 1;
    var col = th === 'retro' ? 'rgba(18,14,10,0.7)' : 'rgba(59,40,23,0.55)', col2 = th === 'retro' ? 'rgba(18,14,10,0.42)' : 'rgba(59,40,23,0.3)';
    var mot = MOTIF[L.motif] || MOTIF.headpiece; mot(g, bw, Rn, col, col2, pal, th);
    BV = old; LWM = oldL;
    if (th === 'modern' && 'filter' in g) { var c2 = mk(bw, H), g2 = c2.getContext('2d'); g2.filter = 'blur(1.3px)'; g2.drawImage(c, 0, 0); c = c2; }
    BG[key] = c; return c;
  }
  function hills(g, bw, Rn, y0, amp, col, col2, seed) {
    var pts = [[0, H]], ph = Rn() * 6;
    for (var x = 0; x <= bw; x += 16) pts.push([x, y0 - amp * (0.5 + 0.5 * Math.sin(x * 0.004 + ph)) - amp * 0.3 * Math.sin(x * 0.013 + ph * 2)]);
    pts.push([bw, H]);
    pen(g, pts.slice(1, -1), 1.4, seed, col);
    hatch(g, pts, 0, y0 - amp * 1.4, bw, H - y0 + amp * 1.4, -0.7, 6, col2, 0.7, seed + 3, function (x, y) { return 0.15 + (y - y0) / 140; });
  }
  function tree(g, x, y, s, Rn, col, col2, seed) { // лубочное дерево: «кудрявая» крона, ствол
    pen(g, [[x, y], [x - 2, y - 40 * s], [x + 1, y - 70 * s]], 2 * s, seed, col);
    var cr = splat(x, y - 88 * s, 34 * s, seed, 7, 0.12);
    pen(g, cr, 1.3, seed + 1, col, true);
    hatch(g, cr, x - 40 * s, y - 130 * s, 80 * s, 84 * s, 0.9, 5, col2, 0.7, seed + 2, function (px, py) { return (py - (y - 120 * s)) / (70 * s); });
    for (var k = 0; k < 6; k++) { var a = Rn() * TAU, r = Rn() * 22 * s; pen(g, [[x + Math.cos(a) * r - 4, y - 88 * s + Math.sin(a) * r], [x + Math.cos(a) * r + 4, y - 90 * s + Math.sin(a) * r]], 1, seed + 9 + k, col); }
  }
  function birds(g, bw, Rn, col) { for (var i = 0; i < 9; i++) { var x = Rn() * bw, y = 50 + Rn() * 120, s = 4 + Rn() * 4; pen(g, [[x - s, y - s * 0.4], [x, y], [x + s, y - s * 0.5]], 1, 900 + i, col); } }
  var MOTIF = {
    headpiece: function (g, bw, Rn, col, col2, pal) {
      hills(g, bw, Rn, 380, 60, col2, col2, 11); hills(g, bw, Rn, 430, 40, col, col2, 12);
      for (var x = 80; x < bw; x += 240 + Rn() * 160) tree(g, x, 420 + Rn() * 20, 0.8 + Rn() * 0.4, Rn, col, col2, (x | 0));
      birds(g, bw, Rn, col);
    },
    mill: function (g, bw, Rn, col, col2) {
      hills(g, bw, Rn, 400, 50, col2, col2, 21);
      for (var x = 200; x < bw; x += 520) { // ветряная мельница: сруб, крылья
        var y = 400; pen(g, [[x - 26, y], [x - 18, y - 110], [x + 18, y - 110], [x + 26, y]], 1.6, x, col, true);
        hatch(g, [[x - 26, y], [x - 18, y - 110], [x + 18, y - 110], [x + 26, y]], x - 30, y - 120, 60, 120, 0.4, 5, col2, 0.7, x + 1);
        for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2 + 0.4, ex = x + Math.cos(a) * 80, ey = y - 120 + Math.sin(a) * 80; pen(g, [[x, y - 120], [ex, ey]], 1.6, x + k, col); var nx = -Math.sin(a) * 12, ny = Math.cos(a) * 12; pen(g, [[x + Math.cos(a) * 20, y - 120 + Math.sin(a) * 20], [ex, ey], [ex + nx, ey + ny], [x + Math.cos(a) * 20 + nx, y - 120 + Math.sin(a) * 20 + ny]], 0.9, x + k + 9, col, true); }
      }
      for (var t = 60; t < bw; t += 300 + Rn() * 200) tree(g, t, 430, 0.7, Rn, col, col2, t | 0);
      birds(g, bw, Rn, col);
    },
    river: function (g, bw, Rn, col, col2) {
      hills(g, bw, Rn, 360, 40, col2, col2, 31);
      for (var x = 0; x < bw; x += 14 + Rn() * 20) { var h = 20 + Rn() * 40; pen(g, [[x, 440], [x + 3, 440 - h]], 0.9, x | 0, col2); if (Rn() < 0.3) pen(g, pts4(x + 3, 440 - h), 1.4, (x | 0) + 1, col); }
      for (var w = 0; w < 12; w++) { var wx = Rn() * bw, wy = 380 + Rn() * 40; pen(g, [[wx, wy], [wx + 20, wy - 2], [wx + 40, wy]], 0.8, 300 + w, col2); }
      birds(g, bw, Rn, col);
      function pts4(px, py) { return [[px - 1, py], [px - 2, py - 8], [px + 1, py - 9], [px + 2, py]]; }
    },
    belfry: function (g, bw, Rn, col, col2) {
      for (var x = 120; x < bw; x += 460) { // звонница: шатёр, ярусы, колокол
        var y = 470, tw = 80;
        var body = [[x - tw / 2, y], [x - tw / 2, y - 260], [x + tw / 2, y - 260], [x + tw / 2, y]];
        pen(g, body, 1.6, x, col, true); hatch(g, body, x - 50, y - 270, 100, 280, 0.25, 6, col2, 0.7, x + 2);
        var roof = [[x - tw / 2 - 10, y - 260], [x, y - 360], [x + tw / 2 + 10, y - 260]]; pen(g, roof, 1.6, x + 3, col, true); hatch(g, roof, x - 60, y - 360, 120, 100, -0.6, 4, col, 0.8, x + 4);
        var bell = [[x - 16, y - 170], [x - 12, y - 205], [x, y - 214], [x + 12, y - 205], [x + 16, y - 170]]; pen(g, bell, 1.4, x + 5, col, true);
        pen(g, [[x - 30, y - 220], [x + 30, y - 220]], 1.2, x + 6, col);
      }
      for (var b = 0; b < bw; b += 70) pen(g, [[b, 120 + Math.sin(b) * 6], [b + 50, 118 + Math.cos(b) * 6]], 0.8, b, col2);
    },
    spill: function (g, bw, Rn, col, col2) {
      for (var x = 90; x < bw; x += 330 + Rn() * 120) { // стол переписчика: стопки книг, чернильницы, перья
        var y = 450, n = 2 + (Rn() * 3 | 0);
        for (var k = 0; k < n; k++) { var bwid = 90 + Rn() * 40, bh = 18 + Rn() * 8, by = y - (k + 1) * 24; var bk = rectPts(x - bwid / 2 + Rn() * 10, by, bwid, bh); pen(g, bk, 1.2, x + k, col, true); hatch(g, bk, x - 80, by, 160, bh, 0, 3, col2, 0.6, x + k * 3); }
        var ix = x + 90, iw = [[ix - 22, y], [ix - 26, y - 40], [ix - 12, y - 54], [ix + 12, y - 54], [ix + 26, y - 40], [ix + 22, y]];
        pen(g, iw, 1.4, x + 7, col, true); hatch(g, iw, ix - 30, y - 56, 60, 58, 0.8, 3, col, 0.8, x + 8);
        pen(g, [[ix + 4, y - 54], [ix + 30, y - 150], [ix + 46, y - 170]], 1.2, x + 9, col);
      }
    },
    quill: function (g, bw, Rn, col, col2) {
      for (var x = 140; x < bw; x += 380) { // огромные перья и росчерки-завитки (не буквы)
        var pts = [], k; for (k = 0; k <= 20; k++) { var f = k / 20; pts.push([x + Math.sin(f * 3) * 60, 460 - f * 330]); }
        pen(g, pts, 1.6, x, col);
        for (k = 1; k < 18; k++) { var f2 = k / 20, px = x + Math.sin(f2 * 3) * 60, py = 460 - f2 * 330, l = 40 * Math.sin(f2 * Math.PI); pen(g, [[px, py], [px - l, py + 18]], 0.7, x + k, col2); pen(g, [[px, py], [px + l * 0.8, py + 14]], 0.7, x + k + 40, col2); }
        var sw = []; for (k = 0; k < 40; k++) { var a = k / 40 * TAU * 1.6; sw.push([x + 170 + Math.cos(a) * (60 - k), 220 + Math.sin(a) * (40 - k * 0.6)]); }
        pen(g, sw, 1.3, x + 77, col2);
      }
    },
    lamp: function (g, bw, Rn, col, col2) {
      hatch(g, rectPts(0, 0, bw, H), 0, 0, bw, H, 0.8, 5, col2, 0.7, 41, function (x, y) { return 0.55 - y / 1400; });
      hatch(g, rectPts(0, 0, bw, H), 0, 0, bw, H, -0.8, 7, col2, 0.6, 42, function (x, y) { return 0.4 - y / 1400; });
      for (var x = 100; x < bw; x += 280 + Rn() * 100) { // колонны и арки скриптория
        pen(g, [[x, 470], [x, 170]], 1.6, x, col); pen(g, [[x + 22, 470], [x + 22, 170]], 1.2, x + 1, col);
        var arc = []; for (var k = 0; k <= 12; k++) { var a = Math.PI + k / 12 * Math.PI; arc.push([x + 120 + Math.cos(a) * 110, 170 + Math.sin(a) * 70]); } pen(g, arc, 1.3, x + 2, col);
      }
      for (var s = 0; s < 40; s++) { var sx = Rn() * bw, sy = 20 + Rn() * 140; pen(g, [[sx, sy], [sx + 1.5, sy + 1.5]], 1.2, 600 + s, col); }
    }
  };

  // ---------- твердь страницы (кэш кусками) ----------
  var CHUNKS = new Map();
  function chunk(L, th, idx, v) {
    var key = L.id + '|' + th + '|' + idx + '|' + v, c = CHUNKS.get(key); if (c) return c;
    c = mk(CH, H); var g = c.getContext('2d'), x0 = idx * CH, pal = PAL[th], old = BV, oldL = LWM; BV = v; LWM = th === 'retro' ? 1.5 : 1;
    g.translate(-x0, 0);
    decor(g, L, x0, pal, th);
    L.solids.forEach(function (s, i) {
      var x = s[0], y = s[1], w = s[2], h = s[3]; if (x + w < x0 - 10 || x > x0 + CH + 10 || h >= 800) return;   // боковые стенки мира не рисуем
      drawSolid(g, x, y, w, Math.min(h, H - y + 20), pal, i * 13 + 5, th, h > 60);
    });
    BV = old; LWM = oldL; CHUNKS.set(key, c);
    if (CHUNKS.size > 30) CHUNKS.delete(CHUNKS.keys().next().value);
    return c;
  }
  // декор средней полосы: «оживающие иллюстрации» на земле (за твердью, без столкновений), по мотиву страницы
  function decor(g, L, x0, pal, th) {
    var col = pal.soft, col2 = pal.faint;
    L.solids.forEach(function (s, i) {
      var x = s[0], y = s[1], w = s[2], h = s[3]; if (h < 60 || h >= 800 || w < 120) return;
      var Rn = rng(i * 7 + L.w), px = x + 40 + Rn() * 80;
      while (px < x + w - 40) {
        if (px > x0 - 260 && px < x0 + CH + 260) {
          var k = Rn(), seed = (px | 0) + i;
          if (L.motif === 'river') reeds(g, px, y, Rn, pal);
          else if (L.motif === 'spill' || L.motif === 'quill') { if (k < 0.5) quillStand(g, px, y, pal, seed); else bookPile(g, px, y, pal, seed, Rn); }
          else if (L.motif === 'lamp') candle(g, px, y, pal, seed);
          else if (L.motif === 'belfry') { if (k < 0.5) post(g, px, y, pal, seed, 150); else bush(g, px, y, pal, seed); }
          else { if (k < 0.45) tree(g, px, y, 0.9 + Rn() * 0.5, Rn, pal.ink, col2, seed); else if (k < 0.75) bush(g, px, y, pal, seed); else post(g, px, y, pal, seed, 60); }
        } else { Rn(); Rn(); Rn(); }
        px += 170 + Rn() * 220;
      }
    });
  }
  function bush(g, x, y, pal, seed) { var b = splat(x, y - 16, 22, seed, 5, 0.18).filter(function (q) { return q[1] <= y; }); b.push([x + 22, y], [x - 22, y]); pen(g, b, 1.3, seed, pal.ink, true); hatch(g, b, x - 26, y - 40, 52, 40, 0.9, 4, pal.soft, 0.7, seed + 1, function (px, py) { return (py - (y - 36)) / 36; }); }
  function post(g, x, y, pal, seed, h) { var p = rectPts(x - 4, y - h, 8, h); pen(g, p, 1.4, seed, pal.ink, true); hatch(g, p, x - 4, y - h, 8, h, 0.6, 3, pal.soft, 0.6, seed + 1); pen(g, [[x - 40, y - h * 0.7], [x + 40, y - h * 0.72]], 1, seed + 2, pal.soft); }
  function reeds(g, x, y, Rn, pal) { for (var k = 0; k < 7; k++) { var rx = x + k * 7 + Rn() * 4, rh = 30 + Rn() * 50, lean = (Rn() - 0.5) * 12; pen(g, [[rx, y], [rx + lean * 0.5, y - rh * 0.6], [rx + lean, y - rh]], 1, (rx | 0), pal.ink); if (Rn() < 0.4) { var e = ell(rx + lean, y - rh - 6, 2.5, 7, 10); poly(g, e); g.fillStyle = pal.ink; g.fill(); } } }
  function quillStand(g, x, y, pal, seed) { var iw = [[x - 12, y], [x - 14, y - 20], [x - 6, y - 28], [x + 6, y - 28], [x + 14, y - 20], [x + 12, y]]; poly(g, iw); g.fillStyle = pal.paper; g.fill(); hatch(g, iw, x - 15, y - 30, 30, 30, 0.8, 2.6, pal.ink, 0.7, seed); pen(g, iw, 1.3, seed + 1, pal.ink, true); pen(g, [[x + 2, y - 28], [x + 22, y - 110], [x + 34, y - 132]], 1.3, seed + 2, pal.ink); for (var i = 1; i < 9; i++) { var f = i / 9; pen(g, [[x + 2 + 20 * f + 4, y - 28 - 82 * f], [x + 16 + 20 * f, y - 22 - 82 * f]], 0.7, seed + 3 + i, pal.soft); } }
  function bookPile(g, x, y, pal, seed, Rn) { var by = y; for (var k = 0; k < 2 + (Rn() * 3 | 0); k++) { var bw = 60 + Rn() * 30, bh = 12 + Rn() * 6; by -= bh; var bk = rectPts(x - bw / 2 + (Rn() - 0.5) * 10, by, bw, bh); poly(g, bk); g.fillStyle = pal.paper2; g.fill(); hatch(g, bk, x - 50, by, 100, bh, 0, 2.8, pal.soft, 0.6, seed + k); pen(g, bk, 1.2, seed + 10 + k, pal.ink, true); } }
  function candle(g, x, y, pal, seed) { var p = rectPts(x - 5, y - 46, 10, 46); poly(g, p); g.fillStyle = pal.paper; g.fill(); pen(g, p, 1.2, seed, pal.ink, true); pen(g, [[x - 5, y - 44], [x - 3, y - 36], [x - 5, y - 30]], 1, seed + 1, pal.ink); pen(g, [[x, y - 46], [x, y - 52]], 1, seed + 2, pal.ink); var fl = [[x, y - 64], [x + 3.5, y - 54], [x, y - 51], [x - 3.5, y - 54]]; poly(g, fl); g.fillStyle = pal.ochre; g.fill(); pen(g, fl, 0.8, seed + 3, pal.ink, true); }

  function drawSolid(g, x, y, w, h, pal, seed, th, ground) {
    var pts = rectPts(x, y, w, h), Rn = rng(seed);
    poly(g, pts); g.fillStyle = pal.paper2; g.fill();
    if (th === 'modern') { g.save(); poly(g, pts); g.clip(); var gr = g.createLinearGradient(0, y, 0, y + 120); gr.addColorStop(0, 'rgba(120,80,40,0.18)'); gr.addColorStop(1, 'rgba(120,80,40,0.02)'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore(); }
    hatch(g, pts, x, y, w, h, 0.75, 3.6, pal.ink, 0.8, seed, function (px, py) { return 1.05 - (py - y) / 190; });
    hatch(g, pts, x, y, w, h, -0.75, 4.2, pal.soft, 0.75, seed + 1, function (px, py) { return 0.95 - (py - y) / 70; });
    hatch(g, pts, x, y, w, Math.min(h, 14), 0, 2.4, pal.ink, 0.9, seed + 6, function (px, py) { return 1 - (py - y) / 14; });
    pen(g, [[x, y], [x + w, y]], 3, seed + 2, pal.ink);
    pen(g, [[x, y], [x, y + h]], 1.6, seed + 3, pal.ink); pen(g, [[x + w, y], [x + w, y + h]], 1.6, seed + 4, pal.ink);
    if (h < 60) pen(g, [[x, y + h], [x + w, y + h]], 1.4, seed + 5, pal.ink);
    if (ground) { // травинки и камешки по верхнему краю
      g.strokeStyle = pal.ink; g.lineWidth = 0.9; g.beginPath();
      for (var gx = x + 3; gx < x + w - 3; gx += 5 + Rn() * 7) { var gh = 2 + Rn() * 7, lean = (Rn() - 0.5) * 4; g.moveTo(gx, y); g.lineTo(gx + lean, y - gh); }
      g.stroke();
      for (var k = 0; k < w / 70; k++) { var sx = x + 10 + Rn() * (w - 20), sy = y + 10 + Rn() * 40; pen(g, ell(sx, sy, 4 + Rn() * 5, 2.5 + Rn() * 2, 10), 0.9, seed + 20 + k, pal.ink, true); }
    }
  }

  // ---------- объекты ----------
  function crate(g, b, pal, t, seed) {
    var p = rectPts(b.x, b.y, b.w, b.h);
    poly(g, p); g.fillStyle = pal.paper; g.fill();
    if (b.kind === 'sand') {
      hatch(g, p, b.x, b.y, b.w, b.h, 0.0, 6, pal.faint, 0.6, seed);
      g.fillStyle = pal.ochre; for (var i = 0; i < 26; i++) { var Rn = rng(seed + i); g.fillRect(b.x + 4 + Rn() * (b.w - 8), b.y + 8 + Rn() * (b.h - 12), 1.6, 1.6); }
      pen(g, [[b.x + 3, b.y + 7], [b.x + b.w - 3, b.y + 7]], 1.4, seed + 3, pal.ink);
      g.fillStyle = pal.ink; for (var j = 0; j < 14; j++) { var R2 = rng(seed + 50 + j); g.fillRect(b.x + 4 + R2() * (b.w - 8), b.y + 10 + R2() * (b.h - 14), 1.2, 1.2); }
    } else {
      hatch(g, p, b.x, b.y, b.w, b.h, 0.6, 4.5, pal.soft, 0.7, seed, function (x, y) { return 0.35 + (x - b.x) / b.w * 0.5; });
      pen(g, [[b.x + 3, b.y + 3], [b.x + b.w - 3, b.y + b.h - 3]], 1.5, seed + 4, pal.ink);
      pen(g, [[b.x + 3, b.y + b.h / 2], [b.x + b.w - 3, b.y + b.h / 2]], 1, seed + 5, pal.ink);
    }
    pen(g, p, 1.9, seed + 1, pal.ink, true);
  }
  function lampObj(g, x, y, pal, t, th, lit) { // x,y — центр лампадки
    var body = [[x - 7, y + 9], [x - 5, y - 1], [x + 5, y - 1], [x + 7, y + 9]];
    poly(g, body); g.fillStyle = pal.paper; g.fill(); hatch(g, body, x - 8, y - 2, 16, 12, 0.7, 2.5, pal.ink, 0.6, 77);
    pen(g, body, 1.3, 71, pal.ink, true); pen(g, [[x - 4, y - 1], [x - 4, y - 7], [x + 4, y - 7], [x + 4, y - 1]], 1, 72, pal.ink);
    var fl = 1 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.1;
    var flame = [[x, y - 9 - 9 * fl], [x + 3.5, y - 10], [x, y - 7], [x - 3.5, y - 10]];
    poly(g, flame); g.fillStyle = th === 'retro' ? '#ffffff' : pal.ochre; g.fill(); pen(g, flame, 1, 73, th === 'retro' ? pal.ink : pal.verm, true);
  }
  function hero(g, h, pal, t, st, th) {
    var cx = h.x + 9, top = h.y, f = h.face || 1, run = Math.abs(h.vx) > 20 && h.gr, ph = (st.walk || 0);
    var sw = run ? Math.sin(ph) : 0, air = !h.gr && h.st === 'run', rope = h.st === 'rope', mant = h.st === 'mantle';
    g.save();
    // ноги
    var hipY = top + 28, legA = air ? 0.5 : sw * 0.55, legB = air ? -0.2 : -sw * 0.55;
    [legA, legB].forEach(function (a, i) {
      var kx = cx + Math.sin(a) * 7 * f, ky = hipY + 6, fx = cx + Math.sin(a * 1.3) * 10 * f, fy = top + 40 - (air && i === 0 ? 4 : 0);
      if (rope) { fx = cx + (i ? -3 : 3); fy = top + 40; kx = cx + (i ? -2 : 2); }
      pen(g, [[cx + (i ? -2 : 2), hipY], [kx, ky], [fx, fy]], 2.2, 300 + i, pal.ink);
      pen(g, [[fx, fy], [fx + 4 * f, fy]], 2.4, 310 + i, pal.ink);
    });
    // подризник (длинная рубаха): бумага + штриховка спины
    var lean = run ? 1.5 * f : 0, sh = [[cx - 6 + lean, top + 13], [cx + 6 + lean, top + 13], [cx + 9, top + 32], [cx - 9, top + 32]];
    poly(g, sh); g.fillStyle = pal.paper; g.fill();
    hatch(g, sh, cx - 10, top + 12, 20, 22, 0.9 * f, 2.6, pal.soft, 0.6, 320, function (x) { return (cx - x) * f > -1 ? 0.9 : 0.0; });
    pen(g, sh, 1.6, 321, pal.ink, true);
    // пояс-киноварь и развевающийся конец
    var flut = Math.sin(t * 9) * 2 + (run ? 3 : 0);
    g.fillStyle = pal.verm; g.fillRect(cx - 8, top + 22, 16, 3);
    pen(g, [[cx - 6 * f, top + 23], [cx - 12 * f, top + 25 + flut * 0.3], [cx - 17 * f, top + 23 + flut]], 2.2, 322, pal.verm);
    // руки
    var ax = cx + lean, ay = top + 15;
    if (rope) { pen(g, [[ax - 2, ay], [cx - 1, top - 2]], 1.8, 330, pal.ink); pen(g, [[ax + 2, ay], [cx + 1, top - 4]], 1.8, 331, pal.ink); }
    else if (st.push || st.pull) { pen(g, [[ax, ay], [ax + 8 * f, ay + 4], [ax + 12 * f, ay + 6]], 1.8, 332, pal.ink); pen(g, [[ax, ay + 2], [ax + 7 * f, ay + 8], [ax + 12 * f, ay + 9]], 1.8, 333, pal.ink); }
    else if (st.carry) { pen(g, [[ax, ay], [ax + 7 * f, ay + 4], [ax + 10 * f, ay + 2]], 1.8, 334, pal.ink); pen(g, [[ax, ay], [ax - 4 * f, ay + 10]], 1.8, 335, pal.ink); }
    else if (mant || air) { pen(g, [[ax, ay], [ax + 6 * f, ay - 8], [ax + 8 * f, ay - 14]], 1.8, 336, pal.ink); pen(g, [[ax, ay], [ax - 7 * f, ay - 4]], 1.8, 337, pal.ink); }
    else { pen(g, [[ax, ay], [ax + sw * 6 * f, ay + 10]], 1.8, 338, pal.ink); pen(g, [[ax, ay], [ax - sw * 6 * f, ay + 10]], 1.8, 339, pal.ink); }
    // голова, шапочка-скуфейка с кисточкой, перо за ухом
    var hx = cx + lean * 0.8, hy = top + 7;
    var head = ell(hx, hy, 5.5, 6, 14); poly(g, head); g.fillStyle = pal.paper; g.fill(); pen(g, head, 1.4, 340, pal.ink, true);
    var cap = [[hx - 6, hy - 2], [hx - 4, hy - 7], [hx + 4, hy - 7], [hx + 6, hy - 2]]; poly(g, cap); g.fillStyle = pal.ink; g.fill();
    pen(g, [[hx + 3 * -f, hy - 7], [hx - 6 * f, hy - 10]], 1.2, 341, pal.ink);
    g.fillStyle = pal.ink; g.beginPath(); g.arc(hx + 2.5 * f, hy + 0.5, 1.1, 0, TAU); g.fill();
    pen(g, [[hx + 5 * f, hy + 1], [hx + 6.5 * f, hy + 3]], 1, 342, pal.ink);
    pen(g, [[hx - 2 * f, hy - 1], [hx - 9 * f, hy - 13], [hx - 11 * f, hy - 16]], 1.1, 343, pal.ink);
    pen(g, [[hx - 6 * f, hy - 7], [hx - 10 * f, hy - 9]], 0.7, 344, pal.ink);
    g.restore();
  }
  function rect(g, r, pal, seed, fill) { var p = rectPts(r.x, r.y, r.w, r.h); if (fill) { poly(g, p); g.fillStyle = fill; g.fill(); } pen(g, p, 1.6, seed, pal.ink, true); return p; }

  // ---------- камера ----------
  var cam = { x: 0, y: 0, z: -1 };
  P.resetCam = function () { cam.z = -1; };
  function updCam(S, dt) {
    var L = S.L, h = S.hero, tx = h.x + 9 - VW * 0.42 + (h.face || 1) * 50, ty = h.y + 20 - VH * 0.6;
    tx = Math.max(0, Math.min(L.w - VW, tx)); ty = Math.max(0, Math.min(H - VH, ty));
    if (cam.z !== S.z || Math.abs(tx - cam.x) > 700) { cam.x = tx; cam.y = ty; cam.z = S.z; }
    else { cam.x += (tx - cam.x) * Math.min(1, dt * 4); cam.y += (ty - cam.y) * Math.min(1, dt * 2.5); }
  }

  // ---------- кадр ----------
  var FULL = null, SMALL = null, BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  P.draw = function (ctx, S, g, opt) {
    opt = opt || {};
    var th = g.themeName === 'retro' ? 'retro' : 'modern', pal = PAL[th], t = g.time, dt = opt.dt || 1 / 60, game = opt.game;
    BV = Math.floor(t * 4) % 2;
    var out = ctx;
    if (th === 'retro') { if (!FULL) FULL = mk(W, H); ctx = FULL.getContext('2d'); }
    updCam(S, dt);
    var L = S.L, cx = Math.round(cam.x);
    ctx.save();
    ctx.drawImage(paperTex(th), 0, 0);
    // фон
    var bg = bgCanvas(L, th); ctx.drawImage(bg, -Math.round(cam.x * PAR), -Math.round(cam.y * 0.4));
    ctx.scale(Z, Z); ctx.translate(-cx, -Math.round(cam.y * 10) / 10);
    drawWorld(ctx, S, game, pal, t, th, cx, opt);
    ctx.restore();
    if (L.motif === 'lamp') darkness(ctx, S, game, pal, th, cx);
    frame(ctx, S, pal, th, t);
    // ретро: всё рисуется в FULL и потом дизерится в холст — надписи меню/паузы (g.text пишет прямо в холст) иначе затираются;
    // поэтому в ретро текст оверлея копится и выводится поверх уже после дизеринга (волна 3: меню и пауза в ретро были пустыми)
    var texts = null;
    if (opt.overlay) { if (th === 'retro') { texts = []; var gt = g.text; g.text = function () { texts.push(arguments); }; try { opt.overlay(ctx, pal, th); } finally { g.text = gt; } } else opt.overlay(ctx, pal, th); }
    turnFx(ctx, S, pal, th);
    if (th === 'retro') dither(out);
    if (texts) for (var ti = 0; ti < texts.length; ti++) g.text.apply(g, texts[ti]);
  };
  function dither(out) {
    if (!SMALL) SMALL = mk(W / 2, H / 2);
    var sg = SMALL.getContext('2d'); sg.imageSmoothingEnabled = true; sg.drawImage(FULL, 0, 0, W / 2, H / 2);
    var id = sg.getImageData(0, 0, W / 2, H / 2), d = id.data, w = W / 2;
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      var x = p % w, y = (p / w) | 0, l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255, thr = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      if (l > 0.3 + thr * 0.52) { d[i] = 236; d[i + 1] = 229; d[i + 2] = 210; } else { d[i] = 20; d[i + 1] = 16; d[i + 2] = 12; }
    }
    sg.putImageData(id, 0, 0);
    out.save(); out.imageSmoothingEnabled = false; out.drawImage(SMALL, 0, 0, W, H); out.restore();
  }

  function drawWorld(g, S, game, pal, t, th, cx, opt) {
    var L = S.L, d = S.d, i, x0 = cx - 40, x1 = cx + VW + 40;
    // вода (подложка), тушь
    (L.water || []).forEach(function (w, k) { var lv = d.water[k].y; if (lv >= w.y + w.h) return; var r = { x: w.x, y: lv, w: w.w, h: w.y + w.h - lv + 60 }; g.fillStyle = pal.water; g.fillRect(r.x, r.y, r.w, Math.min(r.h, 560 - r.y)); });
    // твердь
    var c0 = Math.max(0, Math.floor(x0 / CH)), c1 = Math.floor(x1 / CH);
    for (var c = c0; c <= c1; c++) g.drawImage(chunk(L, th, c, BV), c * CH, 0);
    // пила-жернов: ось и рама
    (L.saws || []).forEach(function (s, k) { var p = game.sawPos(k); if (p.x < x0 - 60 || p.x > x1 + 60) return; saw(g, p, pal, t, k, s, d.saws[k]); });
    // бревно
    (L.logs || []).forEach(function (lg, k) { var r = game.logRect(k); if (d.logs[k].st === 0 || d.logs[k].st === 1) { pen(g, [[lg.x + 30, 0], [lg.x + 30, r.y + 4]], 1, 500, pal.ink); pen(g, [[lg.x + lg.w - 30, 0], [lg.x + lg.w - 30, r.y + 4]], 1, 501, pal.ink); } logDraw(g, r, pal, k, d.logs[k].st === 1 ? Math.sin(t * 40) * 1.5 : 0); });
    // двери-затворы
    (L.doors || []).forEach(function (D, k) { var r = game.doorRect(k); if (r.x > x1 || r.x + r.w < x0) return; var p = rect(g, r, pal, 600 + k, pal.paper2); hatch(g, p, r.x, r.y, r.w, r.h, D.dir === 'left' ? 1.57 : 0.0, 5, pal.soft, 0.8, 610 + k); pen(g, [[r.x + r.w / 2, r.y - 300], [r.x + r.w / 2, r.y]], 1, 620 + k, pal.faint); });
    // противовес: цепи к блоку
    (L.scales || []).forEach(function (sc, k) {
      var rs = game.scaleRects(k), py = 60, ax = rs[0].x + rs[0].w / 2, bx = rs[1].x + rs[1].w / 2;
      pen(g, [[ax, py], [ax, rs[0].y]], 1.2, 700, pal.ink); pen(g, [[bx, py], [bx, rs[1].y]], 1.2, 701, pal.ink);
      pen(g, [[bx, py], [(ax + bx) / 2, py - 18], [ax, py]], 1.4, 702, pal.ink);
      var wh = ell((ax + bx) / 2, py - 18, 12, 12, 16); poly(g, wh); g.fillStyle = pal.paper; g.fill(); pen(g, wh, 1.5, 703, pal.ink, true);
      rs.forEach(function (r, j) { var p = rect(g, r, pal, 710 + j, pal.paper2); hatch(g, p, r.x, r.y, r.w, r.h, 1.0, 4, pal.soft, 0.8, 712 + j); pen(g, [[r.x, r.y + 3], [r.x + r.w, r.y + 3]], 1, 714 + j, pal.ink); });
    });
    // плиты
    (L.plates || []).forEach(function (pl, k) { var on = d.plates[k].on, y = pl.y - (on ? 2 : 6); var p = rect(g, { x: pl.x, y: y, w: pl.w, h: on ? 2 : 6 }, pal, 720 + k, on ? pal.ink : pal.paper); if (!on) hatch(g, p, pl.x, y, pl.w, 6, 0.5, 3, pal.ink, 0.6, 721 + k); });
    // мосты пера
    (L.bridges || []).forEach(function (b, k) { bridge(g, b, d.bridges[k].age, pal, t, k, game.bridgeOn(k)); });
    // наброски
    (L.sketches || []).forEach(function (k, j) { if (k.x > x1 || k.x + k.w < x0) return; sketch(g, k, game.sketchLit(j), pal, t, j); });
    // лужи туши
    (L.ink || []).forEach(function (k, j) { var r = game.inkRect(j); if (r.w <= 0) return; inkPool(g, r, d.ink[j].dried, pal, t, j, th); });
    // капли
    (L.drips || []).forEach(function (k, j) { var p = game.dripPos(j); inkwell(g, k.x, k.y0, pal, j); var r = p.falling ? 4 : 1.5 + p.grow * 2.5; var dp = [[p.x, p.y - r * 2.2], [p.x + r, p.y], [p.x, p.y + r], [p.x - r, p.y]]; poly(g, dp); g.fillStyle = pal.inkPool; g.fill(); });
    // капканы
    (L.traps || []).forEach(function (tr, k) { trap(g, tr, d.traps[k].armed, pal, k); });
    // рычаги
    (L.levers || []).forEach(function (lv, k) { lever(g, lv, d.levers[k], pal, t, k); });
    // верёвки
    (L.ropes || []).forEach(function (r, k) {
      var h = S.hero, rd = d.ropes[k], th2 = rd.th, len = h.st === 'rope' && h.rope === k ? r.len : r.len;
      var ex = r.ax + Math.sin(th2) * len, ey = r.ay + Math.cos(th2) * len, pts = [];
      for (var q = 0; q <= 10; q++) { var f = q / 10; pts.push([r.ax + (ex - r.ax) * f + Math.sin(f * Math.PI) * rd.om * -4, r.ay + (ey - r.ay) * f]); }
      pen(g, pts, 1.8, 800 + k, pal.ink); pen(g, [[ex - 2, ey], [ex, ey + 6], [ex + 2, ey]], 1.2, 802, pal.ink);
      pen(g, [[r.ax - 30, r.ay], [r.ax + 30, r.ay]], 3, 803, pal.ink); var kn = ell(r.ax, r.ay, 3, 3, 8); poly(g, kn); g.fillStyle = pal.ink; g.fill();
    });
    // ящики и лампада
    d.boxes.forEach(function (b, k) { if (b.gone || d.carry === b.id) return; if (b.x > x1 || b.x + b.w < x0) return; if (b.kind === 'lamp') lampObj(g, b.x + b.w / 2, b.y + 8, pal, t, th); else crate(g, b, pal, t, 900 + k * 17); });
    // вода: поверхность поверх ящиков (полупогружение)
    (L.water || []).forEach(function (w, k) { var lv = d.water[k].y; if (lv >= w.y + w.h || w.x > x1 || w.x + w.w < x0) return; waterTop(g, w, lv, pal, t, k, th, game.flowOf(k)); });
    // отметки (чекпоинты): перо в чернильнице на полях — горит, если пройдена
    L.cps.forEach(function (c, k) { if (k === 0) return; mark(g, c.x, c.y + 40, k <= S.cp, pal, k); });
    // выход: край страницы
    exitMark(g, L, pal, t);
    // герой
    var h = S.hero;
    if (h.st !== 'dead') {
      opt.hs = opt.hs || {}; var hs = { walk: (opt.walk || 0), push: h.push > 0, pull: h.pull, carry: !!d.carry };
      hero(g, h, pal, t, hs, th);
      if (d.carry) lampObj(g, h.x + 9 + h.face * 12, h.y + 16, pal, t, th);
    }
    // клякса смерти
    if (opt.blot) blotFx(g, opt.blot, pal, t);
  }
  function saw(g, p, pal, t, k, s, sd) {
    var ang = s.link && sd.ret > 0 ? 0 : sd.t * 9, n = 12, pts = [];
    for (var i = 0; i < n * 2; i++) { var a = ang + i / (n * 2) * TAU, r = i % 2 ? p.r * 0.78 : p.r; pts.push([p.x + Math.cos(a) * r, p.y + Math.sin(a) * r]); }
    if (s.axis === 'y') pen(g, [[p.x, p.y - p.r - 120], [p.x, p.y]], 1.4, 400 + k, pal.ink);
    else pen(g, [[s.x - s.amp - 30, p.y], [s.x + s.amp + 30, p.y]], 0.8, 401 + k, pal.faint);
    poly(g, pts); g.fillStyle = pal.paper; g.fill(); hatch(g, pts, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, ang, 3.2, pal.soft, 0.7, 402 + k);
    pen(g, pts, 1.6, 403 + k, pal.ink, true); var hub = ell(p.x, p.y, 4, 4, 8); poly(g, hub); g.fillStyle = pal.ink; g.fill();
  }
  function logDraw(g, r, pal, k, shake) {
    var p = rectPts(r.x + shake, r.y, r.w, r.h); poly(g, p); g.fillStyle = pal.paper2; g.fill();
    hatch(g, p, r.x, r.y, r.w, r.h, 0.05, 3.5, pal.soft, 0.7, 450 + k, function (x, y) { return (y - r.y) / r.h; });
    pen(g, p, 1.7, 451 + k, pal.ink, true);
    var e = ell(r.x + r.w + shake, r.y + r.h / 2, 5, r.h / 2, 12); poly(g, e); g.fillStyle = pal.paper; g.fill(); pen(g, e, 1.3, 452, pal.ink, true); pen(g, ell(r.x + r.w + shake, r.y + r.h / 2, 2, r.h / 4, 8), 0.8, 453, pal.ink, true);
  }
  function bridge(g, b, age, pal, t, k, on) {
    if (!on) { pen(g, [[b.x, b.y + 2], [b.x + b.w, b.y + 2]], 0.6, 1000 + k, pal.faint); return; }
    var f = Math.min(1, age / 0.35), w = b.w * f, p = rectPts(b.x, b.y, w, b.h);
    poly(g, p); g.fillStyle = pal.paper; g.fill(); hatch(g, p, b.x, b.y, w, b.h, 0.9, 3, pal.ink, 0.8, 1001 + k);
    pen(g, p, 1.6, 1002 + k, pal.ink, true);
    if (f < 1) quillNib(g, b.x + w, b.y - 2, pal); else if (age < 0.6) quillNib(g, b.x + b.w + 4, b.y - 6 - (age - 0.35) * 40, pal);
  }
  function quillNib(g, x, y, pal) { pen(g, [[x, y], [x + 18, y - 34], [x + 26, y - 52]], 1.6, 1010, pal.ink); for (var i = 1; i < 6; i++) pen(g, [[x + 18 * i / 6 + 4, y - 34 * i / 6], [x + 18 * i / 6 + 14, y - 34 * i / 6 + 4]], 0.7, 1011 + i, pal.ink); }
  function sketch(g, k, lit, pal, t, j) {
    var p = rectPts(k.x, k.y, k.w, k.h);
    if (!lit) { g.save(); g.setLineDash([4, 5]); g.strokeStyle = pal.pencil; g.lineWidth = 1; poly(g, p); g.stroke(); g.restore(); hatch(g, p, k.x, k.y, k.w, k.h, 1.1, 7, pal.pencil, 0.5, 1100 + j); return; }
    poly(g, p); g.fillStyle = pal.paper2; g.fill(); hatch(g, p, k.x, k.y, k.w, k.h, 0.8, 3.2, pal.ink, 0.8, 1101 + j); pen(g, p, 1.7, 1102 + j, pal.ink, true);
  }
  function inkPool(g, r, dried, pal, t, j, th) {
    var top = [], k; for (k = 0; k <= 16; k++) top.push([r.x + r.w * k / 16, r.y + (dried ? 0 : Math.sin(t * 2 + k * 0.9 + j) * 1.3)]);
    var p = top.concat([[r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]);
    poly(g, p); g.fillStyle = dried ? pal.ink : pal.inkPool; g.fill();
    if (dried) { // трещины засохшей туши и песок
      g.strokeStyle = pal.paper; g.lineWidth = 0.8; var Rn = rng(1200 + j); g.beginPath(); for (k = 0; k < r.w / 14; k++) { var cx = r.x + Rn() * r.w, cy = r.y + 2 + Rn() * 10; g.moveTo(cx, cy); g.lineTo(cx + 5, cy + 4); g.lineTo(cx + 9, cy + 2); } g.stroke();
      g.fillStyle = pal.ochre; for (k = 0; k < r.w / 3; k++) g.fillRect(r.x + Rn() * r.w, r.y + Rn() * 4, 1.5, 1.5);
    } else { pen(g, top, 1.2, 1201 + j, pal.ink); g.strokeStyle = th === 'retro' ? 'rgba(255,255,255,0.5)' : 'rgba(255,240,210,0.35)'; g.lineWidth = 1; g.beginPath(); for (k = 0; k < r.w / 30; k++) { var hx = r.x + 8 + k * 30 + Math.sin(t + k) * 4; g.moveTo(hx, r.y + 3); g.lineTo(hx + 10, r.y + 3); } g.stroke(); }
  }
  function inkwell(g, x, y, pal, j) { var p = [[x - 18, y - 8], [x - 20, y - 34], [x - 8, y - 44], [x + 8, y - 44], [x + 20, y - 34], [x + 18, y - 8], [x + 4, y - 2], [x - 4, y - 2]]; poly(g, p); g.fillStyle = pal.paper; g.fill(); hatch(g, p, x - 22, y - 46, 44, 46, 0.8, 2.6, pal.ink, 0.7, 1300 + j); pen(g, p, 1.6, 1301 + j, pal.ink, true); pen(g, [[x - 40, y - 60], [x + 40, y - 60]], 2, 1302, pal.ink); pen(g, [[x - 18, y - 60], [x - 12, y - 44]], 1, 1303, pal.ink); pen(g, [[x + 18, y - 60], [x + 12, y - 44]], 1, 1304, pal.ink); }
  function trap(g, tr, armed, pal, k) {
    var x = tr.x, y = tr.y, w = tr.w, pts = [];
    pen(g, [[x - 2, y - 1], [x + w + 2, y - 1]], 2.2, 1400 + k, pal.ink);
    if (armed) { for (var i = 0; i <= 6; i++) pts.push([x + w * i / 6, y - (i % 2 ? 10 : 2)]); pen(g, pts, 1.4, 1401 + k, pal.ink); pen(g, ell(x + w / 2, y - 3, 4, 2, 8), 1, 1402, pal.ink, true); }
    else { for (var j = 0; j <= 6; j++) pts.push([x + 6 + (w - 12) * j / 6, y - 12 - (j % 2 ? 6 : 0)]); pen(g, pts, 1.4, 1403 + k, pal.ink); pen(g, [[x + 6, y - 1], [x + 6, y - 14]], 1.6, 1404, pal.ink); pen(g, [[x + w - 6, y - 1], [x + w - 6, y - 14]], 1.6, 1405, pal.ink); }
  }
  function lever(g, lv, ld, pal, t, k) {
    var on = lv.pulse ? (ld.p >= 0 && ld.p < lv.pulse) : ld.on, a = on ? 0.6 : -0.6, x = lv.x, y = lv.y;
    var base = [[x - 9, y], [x - 6, y - 10], [x + 6, y - 10], [x + 9, y]]; poly(g, base); g.fillStyle = pal.paper2; g.fill(); pen(g, base, 1.5, 1500 + k, pal.ink, true);
    var ex = x + Math.sin(a) * 30, ey = y - 10 - Math.cos(a) * 30; pen(g, [[x, y - 8], [ex, ey]], 2.4, 1501 + k, pal.ink);
    var kn = ell(ex, ey, 4, 4, 10); poly(g, kn); g.fillStyle = on ? pal.verm : pal.paper; g.fill(); pen(g, kn, 1.2, 1502, pal.ink, true);
    if (lv.pulse && on) { var f = 1 - ld.p / lv.pulse, arc = []; for (var i = 0; i <= 16 * f; i++) { var aa = -Math.PI / 2 + i / 16 * TAU; arc.push([x + Math.cos(aa) * 14, y - 46 + Math.sin(aa) * 14]); } if (arc.length > 1) pen(g, arc, 1.6, 1503, pal.verm); }
  }
  function waterTop(g, w, lv, pal, t, k, th, flow) {
    var pts = []; for (var x = w.x; x <= w.x + w.w; x += 10) pts.push([x, lv + Math.sin(x * 0.05 + t * 2.2 + k) * 1.6]);
    pen(g, pts, 1.3, 1600 + k, pal.waterL);
    g.strokeStyle = pal.waterL; g.lineWidth = 0.8; g.beginPath();
    for (var row = 1; row < 7; row++) { var yy = lv + row * 11; if (yy > 560) break; for (var x2 = w.x + (row * 23 % 30); x2 < w.x + w.w - 14; x2 += 34) { var off = ((t * flow * 0.6 + row * 7) % 34 + 34) % 34; var xa = x2 + off; if (xa > w.x + w.w - 14) continue; g.moveTo(xa, yy); g.quadraticCurveTo(xa + 7, yy - 2, xa + 14, yy); } }
    g.stroke();
  }
  function mark(g, x, y, done, pal, k) { var px = x + 4, py = y; pen(g, [[px, py], [px + 6, py - 26], [px + 12, py - 36]], 1.1, 1700 + k, done ? pal.ink : pal.faint); if (done) { var e = ell(px, py - 2, 5, 3, 10); poly(g, e); g.fillStyle = pal.verm; g.fill(); } }
  function exitMark(g, L, pal, t) { var x = L.exit + 40; for (var i = 0; i < 3; i++) pen(g, [[x + i * 6, 40], [x + i * 6 + 3, 500]], 0.9, 1800 + i, pal.faint); }
  function blotFx(g, b, pal, t) {
    var a = Math.min(1, b.t / 0.25), r = 6 + 22 * a, p = splat(b.x, b.y, r, b.seed, 6, 0.18 + 0.1 * a);
    g.save(); g.globalAlpha = b.t > 0.8 ? Math.max(0, 1 - (b.t - 0.8) / 0.3) : 1;
    poly(g, p); g.fillStyle = pal.inkPool; g.fill();
    var Rn = rng(b.seed); for (var i = 0; i < 9; i++) { var an = Rn() * TAU, dd = r * (1.1 + Rn() * 0.9) * a, rr = 1.5 + Rn() * 3; g.beginPath(); g.arc(b.x + Math.cos(an) * dd, b.y + Math.sin(an) * dd, rr, 0, TAU); g.fill(); }
    g.restore();
  }
  // ночь на странице «Лампада»: тьма-штриховка с окном света вокруг лампады
  function darkness(g, S, game, pal, th, cx) {
    var lp = game && game.lampPos(), R = P.C.LAMP_R;
    var x = lp ? (lp.x - cx) * Z : -999, y = lp ? (lp.y - cam.y) * Z : -999; R *= Z;
    g.save();
    if (th === 'modern') {
      var gr = g.createRadialGradient(x, y, R * 0.55, x, y, R * 2.1); gr.addColorStop(0, pal.night + '0)'); gr.addColorStop(1, pal.night + '0.62)');
      g.fillStyle = lp ? gr : pal.night + '0.62)'; g.fillRect(0, 0, W, H);
      if (lp) { var gl = g.createRadialGradient(x, y, 0, x, y, R); gl.addColorStop(0, 'rgba(230,170,70,0.22)'); gl.addColorStop(1, 'rgba(230,170,70,0)'); g.fillStyle = gl; g.fillRect(x - R, y - R, R * 2, R * 2); }
    } else {
      var gr2 = g.createRadialGradient(x, y, R * 0.6, x, y, R * 1.9); gr2.addColorStop(0, 'rgba(0,0,0,0)'); gr2.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = lp ? gr2 : 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, H);
    }
    g.restore();
  }
  // рамка листа: двойная черта, уголки-завитки, номер страницы точками-киноварью
  function frame(g, S, pal, th, t) {
    var old = BV; BV = 0;
    g.save();
    pen(g, rectPts(12, 12, W - 24, H - 24), 1.6, 2000, pal.ink, true);
    pen(g, rectPts(18, 18, W - 36, H - 36), 0.8, 2001, pal.soft, true);
    [[18, 18, 1, 1], [W - 18, 18, -1, 1], [18, H - 18, 1, -1], [W - 18, H - 18, -1, -1]].forEach(function (c, i) {
      var pts = []; for (var k = 0; k <= 14; k++) { var a = k / 14 * Math.PI * 1.5; pts.push([c[0] + c[2] * (8 + Math.cos(a) * (10 - k * 0.5)), c[1] + c[3] * (8 + Math.sin(a) * (10 - k * 0.5))]); }
      pen(g, pts, 1.1, 2002 + i, pal.ink);
    });
    for (var i = 0; i <= S.z; i++) { g.fillStyle = pal.verm; g.beginPath(); g.arc(W / 2 - S.z * 7 + i * 14, H - 15, 3, 0, TAU); g.fill(); }
    g.restore(); BV = old;
  }
  // перелистывание: лист заходит справа налево, тень по сгибу
  function turnFx(g, S, pal, th) {
    var f = 0;
    if (S.phase === 'turn') f = 1 - S.turnT / P.C.TURN_T;
    if (S._enterT > 0) f = 1 + (1 - S._enterT);
    if (f <= 0) return;
    var x = f <= 1 ? W * (1 - f) : -W * (f - 1) * 1.1;
    g.save(); g.drawImage(paperTex(th), 0, 0, W, H, x, 0, W, H);
    var gr = g.createLinearGradient(x - 40, 0, x, 0); gr.addColorStop(0, 'rgba(40,25,10,0)'); gr.addColorStop(1, 'rgba(40,25,10,0.35)'); g.fillStyle = gr; g.fillRect(x - 40, 0, 40, H);
    pen(g, [[x, 0], [x + 6, H / 2], [x, H]], 1.4, 2100, pal.ink); g.restore();
  }

  P.render = { draw: P.draw, PAL: PAL, pen: pen, hatch: hatch, rectPts: rectPts, poly: poly, ell: ell, lamp: lampObj, hero: hero, paperTex: paperTex, splat: splat, cam: cam,
    clearCache: function () { CHUNKS.clear(); BG = {}; } };
  if (!HAS_DOM) P.render.headless = true;
})(typeof window !== 'undefined' ? window : globalThis);
