/* КАТЫШ · рендер обеих тем. Мир — портретный 13×17 клеток. Холст портретный 450×640 или альбомный 800×450: в альбоме мир
   поворачивается на 90° по часовой (низ → лево), спрайты остаются «стоймя». Подписи и HUD — в экранных координатах. KATYSH.render */
(function (global) {
  'use strict';
  var KT = global.KATYSH = global.KATYSH || {}, C = KT.consts, COLS = C.COLS, ROWS = C.ROWS;
  var CAT_M = { P: '#a7b0bb', L: '#ee8a3a', H: '#3b3446' }, CAT_R = { P: '#aaaaaa', L: '#ffaa00', H: '#aa55ff' };
  function pal(g) {
    if (g.themeName === 'retro') return { pixel: true, bg: '#000000', floor: '#001a33', floor2: '#00264d', gloss: '#0a4a7a', wall: '#aa5500', wallHi: '#ffaa00', wallDk: '#552a00', hay: '#ffff55', hayDk: '#aa8800',
      seed: '#ffffff', seedDk: '#555555', ball: '#55ffff', ballDk: '#00aaaa', ham: '#ffaa00', hamDk: '#aa5500', belly: '#ffffff', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffaa00', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', panel: '#000000', line: '#5555aa', cat: CAT_R, eye: '#ffff55' };
    return { pixel: false, bg: '#17130f', floor: '#d3b27a', floor2: '#c9a76d', gloss: 'rgba(255,255,255,.22)', wall: '#6b4f33', wallHi: '#8f6e47', wallDk: '#3d2c1b', hay: '#efc84e', hayDk: '#b98a22',
      seed: '#f4efe1', seedDk: '#26211c', ball: '#9fe3dc', ballDk: '#3aa39b', ham: '#e8a85a', hamDk: '#a96a2c', belly: '#fff3dc', ink: '#f6efe2', muted: '#a79b88', accent: '#ee8a3a', good: '#7ad18a', bad: '#ee5a4a', warn: '#f0c24c', panel: '#241d16', line: '#4a3b2a', cat: CAT_M, eye: '#f0d24a' };
  }
  function land(g) { return g.W > g.H; }
  function geo(g) {
    var L = land(g), cs, ox, oy;
    if (L) { cs = Math.floor(Math.min((g.W - 230) / ROWS, (g.H - 20) / COLS)); ox = 12; oy = Math.round((g.H - cs * COLS) / 2); }
    else { cs = Math.floor(Math.min(g.W / COLS, (g.H - 76) / ROWS)); ox = Math.round((g.W - cs * COLS) / 2); oy = 72; }
    return { L: L, cs: cs, ox: ox, oy: oy, gw: (L ? ROWS : COLS) * cs, gh: (L ? COLS : ROWS) * cs };
  }
  function pt(G, x, y) { return G.L ? { x: G.ox + (ROWS - 1 - y + 0.5) * G.cs, y: G.oy + (x + 0.5) * G.cs } : { x: G.ox + (x + 0.5) * G.cs, y: G.oy + (y + 0.5) * G.cs }; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function disc(c, x, y, r, col, px) {
    c.fillStyle = col;
    if (px) { x = Math.round(x / 2) * 2; y = Math.round(y / 2) * 2; var s = Math.max(2, Math.round(r / 2) * 2); c.fillRect(x - s, y - s + 2, s * 2, s * 2 - 4); c.fillRect(x - s + 2, y - s, s * 2 - 4, s * 2); }
    else { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  }

  function board(c, S, P, G, time) {
    var cs = G.cs, x, y, p, px = P.pixel;
    c.fillStyle = P.bg; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      p = pt(G, x, y); var X = p.x - cs / 2, Y = p.y - cs / 2, ch = S.map[y][x];
      if (ch === '#') {
        c.fillStyle = P.wallDk; c.fillRect(X, Y, cs, cs);
        if (px) { c.fillStyle = P.wall; c.fillRect(X + 2, Y + 2, cs - 4, cs - 4); c.fillStyle = P.wallHi; c.fillRect(X + 2, Y + 2, cs - 4, 4); c.fillRect(X + 2, Y + cs / 2, cs - 4, 2); }
        else { c.fillStyle = P.wall; rr(c, X + 1, Y + 1, cs - 2, cs - 2, 5); c.fill(); c.fillStyle = P.wallHi; rr(c, X + 3, Y + 3, cs - 6, 6, 3); c.fill();
          c.strokeStyle = P.wallDk; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X + 5, Y + cs / 2 + 2); c.lineTo(X + cs - 5, Y + cs / 2 + 2); c.moveTo(X + cs / 2, Y + cs / 2 + 2); c.lineTo(X + cs / 2, Y + cs - 5); c.stroke(); }
      } else {
        c.fillStyle = (x + y) % 2 ? P.floor : P.floor2; c.fillRect(X, Y, cs, cs);
        if (!px) { c.fillStyle = P.gloss; c.fillRect(X, Y, cs, 2); c.fillRect(X, Y, 2, cs); }
      }
    }
    // стога
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (S.map[y][x] === 'h') {
      p = pt(G, x, y);
      if (px) { c.fillStyle = P.hayDk; c.fillRect(p.x - cs * 0.4, p.y - cs * 0.2, cs * 0.8, cs * 0.6); c.fillStyle = P.hay; c.fillRect(p.x - cs * 0.34, p.y - cs * 0.34, cs * 0.68, cs * 0.5); c.fillStyle = P.hayDk; c.fillRect(p.x - 4, p.y - 8, 2, 12); c.fillRect(p.x + 4, p.y - 6, 2, 10); }
      else { c.fillStyle = P.hayDk; c.beginPath(); c.ellipse(p.x, p.y + cs * 0.12, cs * 0.44, cs * 0.34, 0, 0, 7); c.fill(); c.fillStyle = P.hay; c.beginPath(); c.ellipse(p.x, p.y, cs * 0.4, cs * 0.3, 0, 0, 7); c.fill();
        c.strokeStyle = P.hayDk; c.lineWidth = 1.5; for (var k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(p.x + k * 5, p.y - cs * 0.22); c.lineTo(p.x + k * 6, p.y + cs * 0.2); c.stroke(); } }
    }
    // семечки
    S.seeds.forEach(function (s) {
      if (!s.on) return; p = pt(G, s.x, s.y); var bob = px ? 0 : Math.sin(time * 4 + s.x + s.y) * 1.5;
      if (px) { c.fillStyle = P.seed; c.fillRect(p.x - 4, p.y - 6, 8, 12); c.fillStyle = P.seedDk; c.fillRect(p.x - 1, p.y - 6, 2, 12); }
      else { c.save(); c.translate(p.x, p.y + bob); c.rotate(0.5); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(1, 4, cs * 0.17, cs * 0.28, 0, 0, 7); c.fill();
        c.fillStyle = P.seedDk; c.beginPath(); c.ellipse(0, 0, cs * 0.17, cs * 0.28, 0, 0, 7); c.fill(); c.fillStyle = P.seed; c.beginPath(); c.ellipse(0, 0, cs * 0.06, cs * 0.24, 0, 0, 7); c.fill(); c.restore(); }
    });
  }

  function lane(c, S, k, P, G, time) {      // полоса прыжка ловчего кота — видна в момент «заметил»
    if (k.t !== 'H' || k.st !== 'alert') return;
    var d = k.hd, x = k.cx, y = k.cy, cs = G.cs; c.fillStyle = P.bad; c.globalAlpha = (Math.floor(time * 14) % 2) ? 0.42 : 0.22;
    while (!(x + C.DX[d] < 0 || y + C.DY[d] < 0 || x + C.DX[d] >= COLS || y + C.DY[d] >= ROWS || S.map[y + C.DY[d]][x + C.DX[d]] === '#')) { x += C.DX[d]; y += C.DY[d]; var p = pt(G, x, y); c.fillRect(p.x - cs / 2, p.y - cs / 2, cs, cs); }
    c.globalAlpha = 1;
  }
  function cat(c, k, P, G, time) {
    var cs = G.cs, p = pt(G, k.x, k.y), px = P.pixel, col = P.cat[k.t], r = cs * 0.38, x = p.x, y = p.y, alert = k.t === 'H' && k.st === 'alert', sleep = k.t === 'H' && k.st === 'rest';
    if (alert) { x += Math.sin(time * 60) * 1.5; col = P.bad; }
    if (!px) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + 1, y + r * 0.9, r, r * 0.45, 0, 0, 7); c.fill(); }
    c.fillStyle = col;
    if (px) { c.fillRect(x - r, y - r * 0.5, r * 2, r * 1.5); c.fillRect(x - r, y - r, 4, r * 0.6); c.fillRect(x + r - 4, y - r, 4, r * 0.6); }
    else { c.beginPath(); c.moveTo(x - r, y - r * 0.2); c.lineTo(x - r * 0.9, y - r * 1.15); c.lineTo(x - r * 0.25, y - r * 0.6); c.lineTo(x + r * 0.25, y - r * 0.6); c.lineTo(x + r * 0.9, y - r * 1.15); c.lineTo(x + r, y - r * 0.2); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(x, y + r * 0.1, r, r * 0.82, 0, 0, 7); c.fill(); }
    // полосы тигра у сторожа, пятно у обходчика
    if (!px && k.t === 'P') { c.strokeStyle = 'rgba(40,46,56,.55)'; c.lineWidth = 2; for (var i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * 5, y - r * 0.55); c.lineTo(x + i * 5, y - r * 0.15); c.stroke(); } }
    if (!px && k.t === 'L') { c.fillStyle = '#fff1d6'; c.beginPath(); c.ellipse(x, y + r * 0.45, r * 0.5, r * 0.32, 0, 0, 7); c.fill(); }
    var ec = alert ? '#fff' : P.eye;
    if (sleep) { c.fillStyle = P.ink; c.fillRect(x - r * 0.55, y - 1, r * 0.4, 2); c.fillRect(x + r * 0.15, y - 1, r * 0.4, 2); }
    else { c.fillStyle = ec; c.fillRect(x - r * 0.55, y - r * 0.28, r * 0.38, r * 0.34); c.fillRect(x + r * 0.17, y - r * 0.28, r * 0.38, r * 0.34); c.fillStyle = '#111'; c.fillRect(x - r * 0.42, y - r * 0.28, 2, r * 0.34); c.fillRect(x + r * 0.3, y - r * 0.28, 2, r * 0.34); }
    c.fillStyle = '#ff9fb0'; c.fillRect(x - 1.5, y + r * 0.12, 3, 3);
    if (!px) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - r * 0.6, y + r * 0.3); c.lineTo(x - r * 1.25, y + r * 0.2); c.moveTo(x - r * 0.6, y + r * 0.45); c.lineTo(x - r * 1.25, y + r * 0.55); c.moveTo(x + r * 0.6, y + r * 0.3); c.lineTo(x + r * 1.25, y + r * 0.2); c.moveTo(x + r * 0.6, y + r * 0.45); c.lineTo(x + r * 1.25, y + r * 0.55); c.stroke(); }
    if (alert) { c.fillStyle = '#fff'; c.fillRect(x - 2, y - r * 2, 4, r * 0.8); c.fillRect(x - 2, y - r * 1.05, 4, 4); }
  }
  function hero(c, S, P, G, time) {
    var h = S.hero, cs = G.cs, p = pt(G, h.x, h.y), x = p.x, y = p.y, px = P.pixel, R = cs * 0.46;
    if (S.mode === 'dying') { var q = Math.max(0, Math.min(1, S.dieT / 1.1)); c.globalAlpha = q; R *= 0.6 + 0.4 * q; y -= (1 - q) * 14; }
    else if (S.inv > 0 && Math.floor(time * 14) % 2) c.globalAlpha = 0.45;
    if (!px) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + 1, y + R * 0.85, R * 0.95, R * 0.42, 0, 0, 7); c.fill(); }
    var roll = (h.x * 1.2 + h.y * 1.2) * 2.2 * (G.L ? 1 : 1);
    // хомяк внутри (смещён по ходу катания)
    var lx = (G.L ? -C.DY[h.face] : C.DX[h.face]) * R * 0.12, ly = (G.L ? C.DX[h.face] : C.DY[h.face]) * R * 0.12;
    if (px) { disc(c, x, y, R, P.ballDk, true); disc(c, x, y, R - 3, P.ball, true); disc(c, x + lx, y + ly + 2, R * 0.55, P.ham, true); c.fillStyle = '#000'; c.fillRect(x + lx - 5, y + ly, 2, 3); c.fillRect(x + lx + 3, y + ly, 2, 3); }
    else {
      c.fillStyle = 'rgba(159,227,220,.35)'; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
      var hx = x + lx, hy = y + ly + 1;
      c.fillStyle = P.hamDk; c.beginPath(); c.arc(hx - R * 0.38, hy - R * 0.5, R * 0.2, 0, 7); c.arc(hx + R * 0.38, hy - R * 0.5, R * 0.2, 0, 7); c.fill();
      c.fillStyle = P.ham; c.beginPath(); c.arc(hx, hy, R * 0.6, 0, 7); c.fill(); c.fillStyle = P.belly; c.beginPath(); c.ellipse(hx, hy + R * 0.22, R * 0.38, R * 0.3, 0, 0, 7); c.fill();
      c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(hx - R * 0.22, hy - R * 0.08, R * 0.08, 0, 7); c.arc(hx + R * 0.22, hy - R * 0.08, R * 0.08, 0, 7); c.fill();
      c.fillStyle = '#e8838f'; c.beginPath(); c.arc(hx, hy + R * 0.06, R * 0.07, 0, 7); c.fill();
      c.strokeStyle = P.ballDk; c.lineWidth = 2; c.beginPath(); c.arc(x, y, R - 1, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, R * 0.78, roll + 3.6, roll + 4.5); c.stroke();
      c.beginPath(); c.arc(x, y, R * 0.78, roll + 0.5, roll + 0.8); c.stroke();
    }
    if (S.shield > 0) { c.strokeStyle = P.warn; c.lineWidth = 2.5; c.setLineDash([5, 4]); c.beginPath(); c.arc(x, y, R + 4, time * 3, time * 3 + 7); c.stroke(); c.setLineDash([]); }
    c.globalAlpha = 1;
  }
  function lifeIcon(c, x, y, r, P) { disc(c, x, y, r, P.ballDk, P.pixel); disc(c, x, y, r - 2, P.ball, P.pixel); disc(c, x, y + 1, r * 0.5, P.ham, P.pixel); }
  function brakeGauge(c, S, P, x, y, w, sc) {
    c.fillStyle = P.panel; c.fillRect(x, y, w, 10); c.fillStyle = S.brakeC >= 1 ? P.good : P.muted; c.fillRect(x + 1, y + 1, (w - 2) * S.brakeC, 8);
    c.strokeStyle = P.line; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, 9);
  }

  function hud(c, S, P, G, sc, o) {
    var W = sc.W, H = sc.H, th = sc.th();
    if (!G.L) {
      sc.text(String(o.score), 14, 20, { size: 22, weight: 900, color: P.ink, maxWidth: 150 });
      sc.text(sc.t('level') + ' ' + (S.level + 1) + '/' + C.MAX_LEVEL, W / 2, 20, { size: 16, align: 'center', weight: 800, color: P.accent, maxWidth: 160 });
      for (var i = 0; i < S.lives; i++) lifeIcon(c, W - 22 - i * 24, 20, 9, P);
      sc.text(sc.t('seeds') + ': ' + S.left, 14, 42, { size: 12, weight: 700, color: P.muted, maxWidth: 140 });
      brakeGauge(c, S, P, W - 100, 37, 86, sc);
      sc.text('◆', W - 112, 42, { size: 13, align: 'center', color: S.brakeC >= 1 ? P.good : P.muted });
    } else {
      var x0 = G.ox + G.gw + 18, wd = W - x0 - 12, y = 24;
      sc.text(sc.t('title'), x0 + wd / 2, y, { size: 22, align: 'center', weight: 900, color: P.accent, maxWidth: wd });
      sc.text(sc.t('score'), x0, y + 34, { size: 11, color: P.muted, weight: 700 });
      sc.text(String(o.score), x0, y + 60, { size: 28, weight: 900, color: P.ink, maxWidth: wd });
      sc.text(sc.t('level') + ' ' + (S.level + 1) + '/' + C.MAX_LEVEL, x0, y + 108, { size: 16, weight: 800, color: P.ink, maxWidth: wd });
      sc.text(sc.t('seeds') + ': ' + S.left, x0, y + 134, { size: 14, weight: 700, color: P.muted, maxWidth: wd });
      for (var j = 0; j < S.lives; j++) lifeIcon(c, x0 + 10 + j * 24, y + 172, 9, P);
      sc.text('◆ ' + sc.t('brake'), x0, y + 202, { size: 12, color: S.brakeC >= 1 ? P.good : P.muted, weight: 700, maxWidth: wd });
      brakeGauge(c, S, P, x0, y + 216, Math.min(wd, 150), sc);
    }
    if (o.tutText) {
      if (!G.L) sc.text(o.tutText, W / 2, 61, { size: 12, align: 'center', weight: 700, color: P.warn, maxWidth: W - 20, minSize: 9 });
      else { var px0 = G.ox + G.gw + 18, pw = W - px0 - 12, ln = wrap(o.tutText, 24); ln.forEach(function (t, i) { sc.text(t, px0 + pw / 2, H - 30 - (ln.length - 1 - i) * 16, { size: 12, align: 'center', weight: 700, color: P.warn, maxWidth: pw, minSize: 9 }); }); }
    }
  }
  function wrap(s, n) { var w = s.split(' '), out = [], cur = ''; w.forEach(function (x) { if (cur && (cur + ' ' + x).length > n) { out.push(cur); cur = x; } else cur = cur ? cur + ' ' + x : x; }); if (cur) out.push(cur); return out; }

  function frame(c, S, sc, o) {
    o = o || {}; var P = pal(sc), G = geo(sc), time = sc.time;
    board(c, S, P, G, time); S.cats.forEach(function (k) { lane(c, S, k, P, G, time); });
    S.cats.forEach(function (k) { cat(c, k, P, G, time); }); hero(c, S, P, G, time);
    (o.toasts || []).forEach(function (t) { var p = pt(G, t.x, t.y); c.globalAlpha = Math.min(1, t.t * 2.2); sc.text(t.text, p.x, p.y - (1.2 - t.t) * 26, { size: t.size || 16, align: 'center', weight: 900, color: t.color, maxWidth: 200 }); c.globalAlpha = 1; });
    return { P: P, G: G };
  }
  KT.render = {
    pal: pal, geo: geo, pt: pt, land: land, rr: rr, disc: disc,
    bare: function (c, S, sc) { frame(c, S, sc); },
    draw: function (c, S, sc, o) {
      var r = frame(c, S, sc, o); hud(c, S, r.P, r.G, sc, o);
      if (S.mode === 'clear') { var P = r.P, W = sc.W, H = sc.H; c.fillStyle = 'rgba(10,8,5,.55)'; c.fillRect(0, H / 2 - 44, W, 88); sc.text(sc.t('clear'), W / 2, H / 2 - 30, { size: 30, align: 'center', weight: 900, color: P.good, maxWidth: W - 30 }); sc.text(sc.t('bonus') + ' +' + S.bonus, W / 2, H / 2 + 10, { size: 18, align: 'center', weight: 800, color: P.ink }); }
      else if (S.mode === 'dying') { var k = r.P; sc.text(sc.t('caught'), sc.W / 2, sc.H / 2 - 12, { size: 30, align: 'center', weight: 900, color: k.bad, maxWidth: sc.W - 30 }); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
