/* ШПУЛЬКА · рендер обеих тем. Мир — портретный 450×600. Холст портретный 450×660 или альбомный 800×450: в альбоме мир поворачивается
   на 90° по часовой (низ → лево), спрайты остаются «стоймя». Подписи и HUD — в экранных координатах. SPOOL.render */
(function (global) {
  'use strict';
  var SP = global.SPOOL = global.SPOOL || {}, C = SP.consts, WW = C.W, WH = C.H;
  var trail = [], lastLv = -1;
  function pal(g) {
    if (g.themeName === 'retro') return { pixel: true, bg: '#000000', mat: '#00122b', grid: '#06306b', edge: '#5555aa', stitch: '#ffff55', box: '#aa5500', boxHi: '#ffaa00', boxDk: '#552a00',
      pin: ['#ff5555', '#ffff55', '#55ffff', '#ff55ff'], pinRust: '#aa5500', steel: '#aaaaaa', btn: ['#ffffff', '#55ffff', '#ffff55', '#ff55ff'], hole: '#000000', thread: '#ff5555', wood: '#ffaa00', woodDk: '#aa5500',
      scis: '#aaaaaa', scisH: '#ff5555', moth: '#aa55ff', iron: '#ffffff', ironDk: '#555555', warn: '#ff5555', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffaa00', good: '#55ff55', bad: '#ff5555', panel: '#000000', line: '#5555aa', eye: '#ffffff', warnT: '#ffff55' };
    return { pixel: false, bg: '#12100e', mat: '#1d4a43', grid: '#24574f', edge: '#0d2a26', stitch: '#e9d8a6', box: '#a86f3a', boxHi: '#c98e52', boxDk: '#6b4322',
      pin: ['#e4574a', '#f0c24c', '#6fb7e8', '#c785e0'], pinRust: '#9a5a2a', steel: '#cfd6dc', btn: ['#f4efe1', '#8fd3c8', '#f0c24c', '#e89bb0'], hole: '#33403d', thread: '#e4343a', wood: '#d9a560', woodDk: '#8a5a2a',
      scis: '#cfd6dc', scisH: '#e4574a', moth: '#b9a98f', iron: '#b7bcc4', ironDk: '#59606b', warn: '#ee5a4a', ink: '#f6efe2', muted: '#a79b88', accent: '#ee8a3a', good: '#7ad18a', bad: '#ee5a4a', panel: '#241d16', line: '#4a3b2a', eye: '#ffffff', warnT: '#f0c24c' };
  }
  function land(g) { return g.W > g.H; }
  function geo(g) {
    var L = land(g), s, ox, oy;
    if (L) { s = Math.min((g.W - 230) / WH, (g.H - 20) / WW); ox = 12; oy = (g.H - s * WW) / 2; }
    else { s = Math.min(g.W / WW, (g.H - 70) / WH); ox = (g.W - s * WW) / 2; oy = 66; }
    return { L: L, s: s, ox: ox, oy: oy, gw: (L ? WH : WW) * s, gh: (L ? WW : WH) * s };
  }
  function pt(G, x, y) { return G.L ? { x: G.ox + (WH - y) * G.s, y: G.oy + x * G.s } : { x: G.ox + x * G.s, y: G.oy + y * G.s }; }
  function vec(G, hx, hy) { return G.L ? { x: -hy, y: hx } : { x: hx, y: hy }; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function disc(c, x, y, r, col, px) {
    c.fillStyle = col;
    if (px) { x = Math.round(x / 2) * 2; y = Math.round(y / 2) * 2; var s = Math.max(2, Math.round(r / 2) * 2); c.fillRect(x - s, y - s + 2, s * 2, s * 2 - 4); c.fillRect(x - s + 2, y - s, s * 2 - 4, s * 2); }
    else { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  }
  function line(c, a, b, col, w, dash) { c.strokeStyle = col; c.lineWidth = w; if (dash) c.setLineDash(dash); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); if (dash) c.setLineDash([]); }

  function board(c, S, P, G, time) {
    var s = G.s, px = P.pixel, a = pt(G, 0, 0), b = pt(G, WW, WH), x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), i, p, q;
    c.fillStyle = P.bg; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.fillStyle = P.edge; c.fillRect(x0 - 4, y0 - 4, G.gw + 8, G.gh + 8);
    c.fillStyle = P.mat; c.fillRect(x0, y0, G.gw, G.gh);
    c.strokeStyle = P.grid; c.lineWidth = 1; c.beginPath();
    for (i = 1; i < 9; i++) { p = pt(G, i * 50, 0); q = pt(G, i * 50, WH); c.moveTo(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5); c.lineTo(Math.round(q.x) + 0.5, Math.round(q.y) + 0.5); }
    for (i = 1; i < 12; i++) { p = pt(G, 0, i * 50); q = pt(G, WW, i * 50); c.moveTo(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5); c.lineTo(Math.round(q.x) + 0.5, Math.round(q.y) + 0.5); }
    c.stroke();
    c.strokeStyle = P.stitch; c.lineWidth = px ? 2 : 1.5; c.setLineDash(px ? [6, 6] : [7, 5]); c.globalAlpha = 0.55; c.strokeRect(x0 + 5, y0 + 5, G.gw - 10, G.gh - 10); c.setLineDash([]); c.globalAlpha = 1;
    // коробки
    S.walls.forEach(function (w) {
      var A = pt(G, w.x, w.y), B = pt(G, w.x + w.w, w.y + w.h), X = Math.min(A.x, B.x), Y = Math.min(A.y, B.y), Wd = Math.abs(B.x - A.x), Ht = Math.abs(B.y - A.y);
      if (px) { c.fillStyle = P.boxDk; c.fillRect(X, Y, Wd, Ht); c.fillStyle = P.box; c.fillRect(X + 2, Y + 2, Wd - 4, Ht - 4); c.fillStyle = P.boxHi; c.fillRect(X + 2, Y + 2, Wd - 4, 3); }
      else { c.fillStyle = 'rgba(0,0,0,.3)'; rr(c, X + 2, Y + 3, Wd, Ht, 5); c.fill(); c.fillStyle = P.box; rr(c, X, Y, Wd, Ht, 5); c.fill(); c.fillStyle = P.boxHi; rr(c, X + 2, Y + 2, Wd - 4, 5, 3); c.fill(); c.strokeStyle = P.boxDk; c.lineWidth = 1.5; rr(c, X + 0.5, Y + 0.5, Wd - 1, Ht - 1, 5); c.stroke(); }
    });
    // рельсы подвижных булавок
    S.pins.forEach(function (pn) { if (pn.k === 'm') { var l = pt(G, pn.bx - pn.amp, pn.y), r = pt(G, pn.bx + pn.amp, pn.y); line(c, l, r, P.stitch, 1.5, [3, 4]); } });
    // полоса-предупреждение утюга
    S.foes.forEach(function (f) { if (f.t === 'i' && (f.st === 'warn' || f.st === 'dash')) { var A = f.hz ? pt(G, 0, f.lane) : pt(G, f.lane, 0), B = f.hz ? pt(G, WW, f.lane) : pt(G, f.lane, WH); c.globalAlpha = f.st === 'warn' ? ((Math.floor(time * 12) % 2) ? 0.5 : 0.22) : 0.25; line(c, A, B, P.warn, 26 * s); c.globalAlpha = 1; } });
  }
  function pin(c, S, k, i, P, G, time) {
    var p = pt(G, S.pins[i].x, S.pins[i].y), s = G.s, px = P.pixel, rust = k.k === 'r', col = rust ? P.pinRust : P.pin[(i * 7 + 1) % 4], r = 7.5 * s + 1.8;
    if (k.dead > 0) { c.globalAlpha = 0.3; }
    if (!px) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x + 1.5, p.y + 2.5, r, r * 0.8, 0, 0, 7); c.fill(); }
    if (!px) { c.strokeStyle = P.steel; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + r * 1.3, p.y + r * 1.5); c.stroke(); }
    if (px) { c.fillStyle = P.steel; c.fillRect(p.x + 2, p.y + 2, r, 3); c.fillStyle = col; c.fillRect(p.x - r, p.y - r, r * 2, r * 2); c.fillStyle = '#fff'; c.fillRect(p.x - r + 2, p.y - r + 2, 4, 4); if (k.k === 'm') { c.fillStyle = '#000'; c.fillRect(p.x - 2, p.y - 2, 4, 4); } }
    else { c.fillStyle = col; c.beginPath(); if (k.k === 'm') { rr(c, p.x - r, p.y - r, r * 2, r * 2, 3); } else c.arc(p.x, p.y, r, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(p.x - r * 0.35, p.y - r * 0.35, r * 0.28, 0, 7); c.fill();
      if (rust) { c.strokeStyle = '#3d1f0c'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(p.x - r * 0.6, p.y + r * 0.1); c.lineTo(p.x, p.y - r * 0.15); c.lineTo(p.x + r * 0.2, p.y + r * 0.6); c.stroke(); } }
    if (rust && k.hang > 0) { c.strokeStyle = P.bad; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, r + 4, -1.57, -1.57 + 6.28 * Math.min(1, k.hang / C.RUST_T)); c.stroke(); }
    c.globalAlpha = 1;
  }
  function button(c, b, i, P, G, time) {
    var p = pt(G, b.x, b.y), r = 9 * G.s + 1.5, px = P.pixel, col = P.btn[i % 4], bob = px ? 0 : Math.sin(time * 4 + i) * 1;
    if (px) { c.fillStyle = col; c.fillRect(p.x - r, p.y - r, r * 2, r * 2); c.fillStyle = P.hole; c.fillRect(p.x - 4, p.y - 4, 2, 2); c.fillRect(p.x + 2, p.y - 4, 2, 2); c.fillRect(p.x - 4, p.y + 2, 2, 2); c.fillRect(p.x + 2, p.y + 2, 2, 2); return; }
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(p.x + 1, p.y + 3, r, r * 0.8, 0, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y + bob, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y + bob, r * 0.72, 0, 7); c.stroke();
    c.fillStyle = P.hole; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) { c.beginPath(); c.arc(p.x + d[0] * r * 0.27, p.y + bob + d[1] * r * 0.27, r * 0.13, 0, 7); c.fill(); });
  }
  function exit(c, S, P, G, time) {
    var p = pt(G, S.exit.x, S.exit.y), s = G.s, px = P.pixel, open = S.exitOpen, r = 15 * s + 2;
    if (open && !px) { var g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * 2.2); g.addColorStop(0, 'rgba(255,240,170,.6)'); g.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 2.2, 0, 7); c.fill(); }
    c.globalAlpha = open ? 1 : 0.4; c.fillStyle = P.steel;
    if (px) { c.fillRect(p.x - 4, p.y - r, 8, r * 2); c.fillStyle = '#000'; c.fillRect(p.x - 2, p.y - r + 4, 4, 12); }
    else { rr(c, p.x - 5, p.y - r, 10, r * 2, 5); c.fill(); c.fillStyle = P.mat; rr(c, p.x - 2, p.y - r + 3, 4, 13, 2); c.fill(); }
    if (open) { c.strokeStyle = P.stitch; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 3 + Math.sin(time * 5) * 2, 0, 7); c.stroke(); }
    c.globalAlpha = 1;
  }
  function foe(c, f, P, G, time) {
    if (f.x < -50 || f.y < -50) return; var p = pt(G, f.x, f.y), s = G.s, px = P.pixel, r = f.r * s;
    if (f.t === 's') {
      var dx = f.bx - f.ax, dy = f.by - f.ay, v = vec(G, dx * f.dir, dy * f.dir), an = Math.atan2(v.y, v.x), open = 0.25 + Math.abs(Math.sin(time * 6)) * 0.45;
      c.save(); c.translate(p.x, p.y); c.rotate(an);
      if (!px) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1, 4, r * 1.1, r * 0.5, 0, 0, 7); c.fill(); }
      [-1, 1].forEach(function (sg) { c.save(); c.rotate(sg * open); c.fillStyle = P.scis; if (px) c.fillRect(-r * 0.2, -2, r * 1.5, 4); else { c.beginPath(); c.moveTo(-r * 0.3, -2); c.lineTo(r * 1.4, 0); c.lineTo(-r * 0.3, 2.5); c.closePath(); c.fill(); } c.restore(); });
      c.fillStyle = P.scisH; [-1, 1].forEach(function (sg) { c.beginPath(); c.arc(-r * 0.75, sg * r * 0.45, r * 0.38, 0, 7); c.fill(); });
      c.restore();
    } else if (f.t === 'm') {
      var fl = Math.sin(time * 22) * 0.55 + 0.7;
      c.fillStyle = P.moth; if (px) { c.fillRect(p.x - r * 1.4, p.y - r * 0.6, r * 2.8, r * 1.2); c.fillStyle = '#000'; c.fillRect(p.x - 2, p.y - r, 4, r * 2); }
      else { c.beginPath(); c.ellipse(p.x - r * 0.9, p.y, r * 0.9, r * fl, -0.3, 0, 7); c.ellipse(p.x + r * 0.9, p.y, r * 0.9, r * fl, 0.3, 0, 7); c.fill(); c.fillStyle = '#5a4a38'; c.beginPath(); c.ellipse(p.x, p.y, r * 0.3, r * 0.75, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(p.x - 2.5, p.y - r * 0.5, 2, 2); c.fillRect(p.x + 0.5, p.y - r * 0.5, 2, 2); }
    } else {
      c.save(); c.translate(p.x, p.y); var an2 = (f.hz === G.L) ? 1.5708 : 0; c.rotate(an2);
      var L = r * 1.3;
      if (px) { c.fillStyle = P.iron; c.fillRect(-L, -r, L * 2, r * 2); c.fillStyle = P.ironDk; c.fillRect(-L, r - 4, L * 2, 4); c.fillStyle = P.warn; c.fillRect(-2, -r + 3, 4, 4); }
      else { c.fillStyle = P.ironDk; c.beginPath(); c.moveTo(-L, r); c.lineTo(L, r); c.lineTo(L * 0.8, -r * 0.2); c.lineTo(-L * 0.6, -r); c.lineTo(-L, -r * 0.6); c.closePath(); c.fill(); c.fillStyle = P.iron; c.beginPath(); c.moveTo(-L * 0.9, r * 0.8); c.lineTo(L * 0.9, r * 0.8); c.lineTo(L * 0.7, -r * 0.1); c.lineTo(-L * 0.5, -r * 0.8); c.lineTo(-L * 0.9, -r * 0.5); c.closePath(); c.fill();
        c.strokeStyle = P.ironDk; c.lineWidth = 3; c.beginPath(); c.arc(-r * 0.05, -r * 0.2, r * 0.4, 3.4, 6); c.stroke(); }
      c.restore();
    }
  }
  function hero(c, S, P, G, time) {
    var h = S.hero, s = G.s, p = pt(G, h.x, h.y), x = p.x, y = p.y, px = P.pixel, R = 9 * s + 2.5, v = vec(G, h.hx, h.hy), an = Math.atan2(v.y, v.x);
    if (S.mode === 'dying') { var q = Math.max(0, Math.min(1, S.dieT / 1.1)); c.globalAlpha = q; R *= 0.6 + 0.4 * q; }
    else if (S.inv > 0 && Math.floor(time * 14) % 2) c.globalAlpha = 0.45;
    // нитка: к булавке и шлейф
    if (h.hook) { var pn = S.pins[h.hook.pin], pp = pt(G, pn.x, pn.y); line(c, pp, p, P.thread, px ? 2 : 2.2); }
    if (trail.length > 2) { c.strokeStyle = P.thread; c.lineWidth = px ? 2 : 1.8; c.globalAlpha *= 0.55; c.beginPath(); c.moveTo(trail[0].x, trail[0].y); for (var i = 1; i < trail.length; i++) c.lineTo(trail[i].x, trail[i].y); c.stroke(); c.globalAlpha = S.mode === 'dying' ? c.globalAlpha : 1; }
    if (!h.hook && S.hold === false && S.mode === 'play') {   // подсказка: ближайшая булавка в радиусе зацепа
      var bi = -1, bd = C.HOOK_R; S.pins.forEach(function (pn, i) { if (pn.dead > 0 || pn.cool > 0) return; var d = Math.hypot(pn.x - h.x, pn.y - h.y); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) { var tp = pt(G, S.pins[bi].x, S.pins[bi].y); c.globalAlpha = 0.35; line(c, p, tp, P.stitch, 1.5, [3, 5]); c.globalAlpha = 1; }
    }
    if (!px) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + 1.5, y + R * 0.8, R, R * 0.5, 0, 0, 7); c.fill(); }
    disc(c, x, y, R, P.woodDk, px); disc(c, x, y, R - 1.6, P.wood, px);
    if (px) { c.fillStyle = P.thread; c.fillRect(x - R * 0.55, y - R * 0.55, R * 1.1, R * 1.1); }
    else { c.fillStyle = P.thread; c.beginPath(); c.arc(x, y, R * 0.66, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, R * 0.5, 0, 7); c.stroke(); }
    var ex = Math.cos(an), ey = Math.sin(an), nx = -ey, ny = ex;   // глаза смотрят по курсу
    [-1, 1].forEach(function (sg) { var qx = x + ex * R * 0.12 + nx * sg * R * 0.28, qy = y + ey * R * 0.12 + ny * sg * R * 0.28; c.fillStyle = P.eye; c.beginPath(); c.arc(qx, qy, R * 0.22, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(qx + ex * R * 0.08, qy + ey * R * 0.08, R * 0.1, 0, 7); c.fill(); });
    if (S.shield > 0) { c.strokeStyle = P.warnT; c.lineWidth = 2.5; c.setLineDash([5, 4]); c.beginPath(); c.arc(x, y, R + 5, time * 3, time * 3 + 7); c.stroke(); c.setLineDash([]); }
    c.globalAlpha = 1;
  }
  function lifeIcon(c, x, y, r, P) { disc(c, x, y, r, P.woodDk, P.pixel); disc(c, x, y, r - 2, P.wood, P.pixel); disc(c, x, y, r * 0.5, P.thread, P.pixel); }
  function wrap(s, n) { var w = s.split(' '), out = [], cur = ''; w.forEach(function (x) { if (cur && (cur + ' ' + x).length > n) { out.push(cur); cur = x; } else cur = cur ? cur + ' ' + x : x; }); if (cur) out.push(cur); return out; }

  function hud(c, S, P, G, sc, o) {
    var W = sc.W, H = sc.H;
    if (!G.L) {
      sc.text(String(o.score), 14, 20, { size: 22, weight: 900, color: P.ink, maxWidth: 150 });
      sc.text(sc.t('level') + ' ' + (S.level + 1) + '/' + C.MAX_LEVEL, W / 2, 20, { size: 16, align: 'center', weight: 800, color: P.accent, maxWidth: 160 });
      for (var i = 0; i < S.lives; i++) lifeIcon(c, W - 22 - i * 24, 20, 9, P);
      sc.text(sc.t('buttons') + ': ' + S.left + '/' + S.total, 14, 44, { size: 12, weight: 700, color: P.muted, maxWidth: 170 });
      if (S.combo > 1) sc.text(sc.t('combo') + ' ×' + S.combo, W - 14, 44, { size: 13, align: 'right', weight: 900, color: P.warnT, maxWidth: 140 });
    } else {
      var x0 = G.ox + G.gw + 18, wd = W - x0 - 12, y = 24;
      sc.text(sc.t('title'), x0 + wd / 2, y, { size: 22, align: 'center', weight: 900, color: P.accent, maxWidth: wd });
      sc.text(sc.t('score'), x0, y + 34, { size: 11, color: P.muted, weight: 700 });
      sc.text(String(o.score), x0, y + 60, { size: 28, weight: 900, color: P.ink, maxWidth: wd });
      sc.text(sc.t('level') + ' ' + (S.level + 1) + '/' + C.MAX_LEVEL, x0, y + 108, { size: 16, weight: 800, color: P.ink, maxWidth: wd });
      sc.text(sc.t('buttons') + ': ' + S.left + '/' + S.total, x0, y + 134, { size: 14, weight: 700, color: P.muted, maxWidth: wd });
      for (var j = 0; j < S.lives; j++) lifeIcon(c, x0 + 10 + j * 24, y + 172, 9, P);
      if (S.combo > 1) sc.text(sc.t('combo') + ' ×' + S.combo, x0, y + 204, { size: 14, weight: 900, color: P.warnT, maxWidth: wd });
    }
    if (o.tutText) {
      if (!G.L) sc.text(o.tutText, W / 2, 62, { size: 12, align: 'center', weight: 700, color: P.warnT, maxWidth: W - 20, minSize: 9 });
      else { var px0 = G.ox + G.gw + 18, pw = W - px0 - 12, ln = wrap(o.tutText, 24); ln.forEach(function (t, i) { sc.text(t, px0 + pw / 2, H - 30 - (ln.length - 1 - i) * 16, { size: 12, align: 'center', weight: 700, color: P.warnT, maxWidth: pw, minSize: 9 }); }); }
    }
  }

  function frame(c, S, sc, o) {
    o = o || {}; var P = pal(sc), G = geo(sc), time = sc.time;
    if (S.level !== lastLv) { lastLv = S.level; trail = []; }
    board(c, S, P, G, time);
    S.pins.forEach(function (k, i) { pin(c, S, k, i, P, G, time); });
    S.buttons.forEach(function (b, i) { if (b.on) button(c, b, i, P, G, time); });
    exit(c, S, P, G, time); S.foes.forEach(function (f) { foe(c, f, P, G, time); });
    if (S.mode === 'play') { var hp = pt(G, S.hero.x, S.hero.y); trail.push(hp); if (trail.length > 26) trail.shift(); } else if (S.mode !== 'dying') trail = [];
    hero(c, S, P, G, time);
    (o.toasts || []).forEach(function (t) { var p = pt(G, t.x, t.y); c.globalAlpha = Math.min(1, t.t * 2.2); sc.text(t.text, p.x, p.y - (1.2 - t.t) * 26, { size: t.size || 16, align: 'center', weight: 900, color: t.color, maxWidth: 200 }); c.globalAlpha = 1; });
    return { P: P, G: G };
  }
  SP.render = {
    pal: pal, geo: geo, pt: pt, land: land, rr: rr, disc: disc, resetTrail: function () { trail = []; },
    bare: function (c, S, sc) { frame(c, S, sc); },
    draw: function (c, S, sc, o) {
      var r = frame(c, S, sc, o); hud(c, S, r.P, r.G, sc, o); var P = r.P, W = sc.W, H = sc.H;
      if (S.mode === 'clear') { c.fillStyle = 'rgba(10,8,5,.6)'; c.fillRect(0, H / 2 - 44, W, 88); sc.text(sc.t('clear'), W / 2, H / 2 - 30, { size: 30, align: 'center', weight: 900, color: P.good, maxWidth: W - 30 }); sc.text(sc.t('bonus') + ' +' + S.bonus, W / 2, H / 2 + 10, { size: 18, align: 'center', weight: 800, color: P.ink }); }
      else if (S.mode === 'dying') sc.text(sc.t('caught'), W / 2, H / 2 - 12, { size: 30, align: 'center', weight: 900, color: P.bad, maxWidth: W - 30 });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
