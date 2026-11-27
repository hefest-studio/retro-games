/* МУРАВЕЙНИК · рендер обеих тем. Мир — портретный 11×13 клеток (верхний ряд — камера колонии, ниже земля). Холст портретный 450×660
   или альбомный 800×450: в альбоме поле стоит по центру, HUD — по бокам. Муравьи рисуются вдоль хода колонны, груз — на спинке.
   MURAV.render */
(function (global) {
  'use strict';
  var MU = global.MURAV = global.MURAV || {}, C = MU.consts, COLS = C.COLS, ROWS = C.ROWS;
  function pal(g) {
    if (g.themeName === 'retro') return { pixel: true, bg: '#000000', soil: '#0000aa', soil2: '#0000cc', speck: '#5555ff', tun: '#000000', tunEdge: '#00007a', rock: '#aaaaaa', rockHi: '#ffffff', rockDk: '#555555',
      ant: '#55ffff', antDk: '#00aaaa', crumb: '#ffffff', crumbDk: '#aaaaaa', beetle: { W: '#ff55ff', H: '#ff5555', G: '#55ff55' }, hall: '#aa5500', hallHi: '#ffaa00', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55',
      good: '#55ff55', bad: '#ff5555', warn: '#ffff55', panel: '#000000', line: '#5555ff' };
    return { pixel: false, bg: '#15110d', soil: '#c9913f', soil2: '#bf8736', speck: '#e3b867', tun: '#1d1830', tunEdge: '#0f0b1c', rock: '#66748c', rockHi: '#8d9bb2', rockDk: '#3a4458',
      ant: '#ffb23e', antDk: '#a85d12', crumb: '#fff4d6', crumbDk: '#8a6a2a', beetle: { W: '#a974e0', H: '#ee4f86', G: '#46d3b2' }, hall: '#3a2a10', hallHi: '#f2c14e', ink: '#f7efe0', muted: '#a99c86', accent: '#ffb23e',
      good: '#7ad18a', bad: '#ee5a4a', warn: '#f2c14e', panel: '#221a12', line: '#4a3b2a' };
  }
  function land(g) { return g.W > g.H; }
  function geo(g) {
    var L = land(g), cs, ox, oy;
    if (L) { cs = Math.floor(Math.min((g.H - 16) / ROWS, (g.W - 420) / COLS)); ox = Math.round((g.W - cs * COLS) / 2); oy = Math.round((g.H - cs * ROWS) / 2); }
    else { cs = Math.floor(Math.min(g.W / COLS, (g.H - 130) / ROWS)); ox = Math.round((g.W - cs * COLS) / 2); oy = 78; }
    return { L: L, cs: cs, ox: ox, oy: oy, gw: COLS * cs, gh: ROWS * cs };
  }
  function pt(G, x, y) { return { x: G.ox + (x + 0.5) * G.cs, y: G.oy + (y + 0.5) * G.cs }; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function hash(x, y, k) { var h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function isOpen(S, x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && S.map[y][x] !== '1' && S.map[y][x] !== '#'; }

  function board(c, S, P, G, time) {
    var cs = G.cs, x, y, px = P.pixel, m = S.mv, k;
    c.fillStyle = P.bg; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      var X = G.ox + x * cs, Y = G.oy + y * cs, ch = S.map[y][x];
      if (ch === 'c') {
        c.fillStyle = P.hall; c.fillRect(X, Y, cs, cs); c.fillStyle = P.hallHi;
        if (px) { c.fillRect(X, Y + cs - 4, cs, 4); if ((x + 1) % 3 === 0) c.fillRect(X + cs / 2 - 2, Y + 6, 4, 4); }
        else { c.globalAlpha = 0.5; c.fillRect(X, Y + cs - 3, cs, 3); c.globalAlpha = 0.22; c.beginPath(); c.arc(X + cs / 2, Y + cs, cs * 0.42, Math.PI, 0); c.fill(); c.globalAlpha = 1; }
      } else if (ch === '#') {
        c.fillStyle = P.soil; c.fillRect(X, Y, cs, cs);
        if (px) { c.fillStyle = P.rockDk; c.fillRect(X + 2, Y + 2, cs - 4, cs - 4); c.fillStyle = P.rock; c.fillRect(X + 4, Y + 4, cs - 10, cs - 10); c.fillStyle = P.rockHi; c.fillRect(X + 6, Y + 6, cs - 20 > 4 ? cs - 20 : 4, 4); }
        else { c.fillStyle = P.rockDk; rr(c, X + 2, Y + 3, cs - 4, cs - 5, cs * 0.3); c.fill(); c.fillStyle = P.rock; rr(c, X + 3, Y + 3, cs - 7, cs - 9, cs * 0.28); c.fill(); c.fillStyle = P.rockHi; rr(c, X + cs * 0.2, Y + cs * 0.16, cs * 0.34, cs * 0.14, 3); c.fill(); }
      } else if (ch === '1') {
        c.fillStyle = (x + y) % 2 ? P.soil : P.soil2; c.fillRect(X, Y, cs, cs); c.fillStyle = P.speck;
        for (k = 0; k < 3; k++) { var sx = X + hash(x, y, k) * (cs - 6) + 2, sy = Y + hash(x, y, k + 9) * (cs - 6) + 2; if (px) c.fillRect(Math.round(sx / 2) * 2, Math.round(sy / 2) * 2, 2, 2); else { c.globalAlpha = 0.6; c.fillRect(sx, sy, 3, 2); c.globalAlpha = 1; } }
      } else {
        c.fillStyle = P.tun; c.fillRect(X, Y, cs, cs); c.fillStyle = P.tunEdge;
        if (!isOpen(S, x, y - 1)) c.fillRect(X, Y, cs, px ? 3 : 4); if (!isOpen(S, x - 1, y)) c.fillRect(X, Y, px ? 3 : 4, cs);
        if (!isOpen(S, x + 1, y)) c.fillRect(X + cs - (px ? 3 : 4), Y, px ? 3 : 4, cs);
      }
    }
    if (m && m.dig) { var q = Math.min(1, m.t * 1.6); c.fillStyle = P.tun; var w = cs * q; c.fillRect(G.ox + m.tx * cs + (cs - w) / 2, G.oy + m.ty * cs + (cs - w) / 2, w, w); }
    S.crumbs.forEach(function (cr) {
      if (!cr.on) return; var p = pt(G, cr.x, cr.y), bob = px ? 0 : Math.sin(time * 3 + cr.x * 2 + cr.y) * 1;
      if (px) { c.fillStyle = P.crumbDk; c.fillRect(p.x - 6, p.y - 6, 12, 12); c.fillStyle = P.crumb; c.fillRect(p.x - 4, p.y - 4, 8, 8); }
      else { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(p.x + 1, p.y + cs * 0.2, cs * 0.2, cs * 0.09, 0, 0, 7); c.fill(); c.fillStyle = P.crumbDk; c.beginPath(); c.arc(p.x, p.y + bob, cs * 0.22, 0, 7); c.fill();
        c.fillStyle = P.crumb; c.beginPath(); c.arc(p.x, p.y + bob - 1, cs * 0.18, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(p.x - cs * 0.06, p.y + bob - cs * 0.07, cs * 0.05, 0, 7); c.fill(); }
    });
  }

  function antAt(c, P, G, x, y, ang, head, cargo, time, k) {
    var cs = G.cs, s = cs * (head ? 0.5 : 0.44), px = P.pixel, ca = Math.cos(ang), sa = Math.sin(ang);
    c.save(); c.translate(x, y); c.rotate(ang);
    if (px) {
      var u = Math.max(3, Math.round(cs / 8)); c.fillStyle = P.ant;
      c.fillRect(-u * 3, -u, u * 2, u * 2); c.fillRect(-u, -u * 0.5, u, u); c.fillRect(u * 0.5, -u, u * 1.5, u * 2);        // брюшко, грудь, голова
      c.fillStyle = P.antDk; c.fillRect(-u * 2, -u * 2, 2, u * 4); c.fillRect(0, -u * 2, 2, u * 4);                          // лапки
      if (head) { c.fillStyle = P.ink; c.fillRect(u * 1.5, -u * 0.6, 2, 2); c.fillStyle = P.ant; c.fillRect(u * 2, -u * 1.5, u, 2); c.fillRect(u * 2, u * 1.1, u, 2); }
    } else {
      c.strokeStyle = P.antDk; c.lineWidth = 1.6; c.lineCap = 'round'; var wig = Math.sin(time * 18 + k) * 0.18;
      for (var j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(j * s * 0.3, 0); c.lineTo(j * s * 0.3 + wig * s, -s * 0.78); c.moveTo(j * s * 0.3, 0); c.lineTo(j * s * 0.3 - wig * s, s * 0.78); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(-s * 0.75 + 1, 2, s * 0.5, s * 0.36, 0, 0, 7); c.fill();
      c.fillStyle = P.antDk; c.beginPath(); c.ellipse(-s * 0.78, 0, s * 0.52, s * 0.38, 0, 0, 7); c.fill(); c.fillStyle = P.ant; c.beginPath(); c.ellipse(-s * 0.8, -1, s * 0.46, s * 0.3, 0, 0, 7); c.fill();
      c.fillStyle = P.antDk; c.beginPath(); c.ellipse(-s * 0.1, 0, s * 0.3, s * 0.24, 0, 0, 7); c.fill(); c.fillStyle = P.ant; c.beginPath(); c.arc(s * 0.5, 0, s * 0.3, 0, 7); c.fill();
      if (head) { c.strokeStyle = P.ant; c.lineWidth = 1.4; c.beginPath(); c.moveTo(s * 0.7, -s * 0.1); c.quadraticCurveTo(s * 1.1, -s * 0.45, s * 1.3, -s * 0.2); c.moveTo(s * 0.7, s * 0.1); c.quadraticCurveTo(s * 1.1, s * 0.45, s * 1.3, s * 0.2); c.stroke();
        c.fillStyle = '#111'; c.beginPath(); c.arc(s * 0.6, -s * 0.12, 1.6, 0, 7); c.arc(s * 0.6, s * 0.12, 1.6, 0, 7); c.fill(); }
    }
    c.restore();
    if (cargo) { var bx = x - ca * s * 0.4 - sa * 0, by = y - sa * s * 0.4; if (px) { c.fillStyle = P.crumb; c.fillRect(bx - 4, by - 4, 8, 8); } else { c.fillStyle = P.crumbDk; c.beginPath(); c.arc(bx, by - 2, cs * 0.17, 0, 7); c.fill(); c.fillStyle = P.crumb; c.beginPath(); c.arc(bx, by - 3, cs * 0.14, 0, 7); c.fill(); } }
  }
  function colony(c, S, P, G, time) {
    var n = S.ants.length, i, pts = [], blink = S.inv > 0 && S.mode === 'play' && Math.floor(time * 14) % 2;
    if (S.mode === 'dying') { var q = Math.max(0, Math.min(1, S.dieT / 1.2)); c.globalAlpha = q; }
    else if (blink) c.globalAlpha = 0.5;
    for (i = 0; i < n; i++) { var a = S.ants[i], to = i === 0 ? (S.mv ? { x: S.mv.tx, y: S.mv.ty } : null) : S.ants[i - 1], t = S.mv ? S.mv.t : 0, fx = a.x, fy = a.y;
      if (to) { fx = a.x + (to.x - a.x) * t; fy = a.y + (to.y - a.y) * t; } pts.push([fx, fy, to]); }
    for (i = n - 1; i >= 0; i--) {
      var p = pt(G, pts[i][0], pts[i][1]), ang, to2 = pts[i][2], a2 = S.ants[i], h = G.cs * 0;
      if (i === 0) ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][S.face];
      else { var dx = S.ants[i - 1].x - S.ants[i].x, dy = S.ants[i - 1].y - S.ants[i].y; ang = (dx || dy) ? Math.atan2(dy, dx) : [-Math.PI / 2, 0, Math.PI / 2, Math.PI][S.face]; if (to2 && !S.mv) ang = Math.atan2(dy, dx); }
      antAt(c, P, G, p.x, p.y, ang, i === 0, a2.c, time, i);
    }
    c.globalAlpha = 1;
  }
  function beetle(c, b, P, G, time) {
    var cs = G.cs, px = P.pixel, p = pt(G, b.x, b.y), col = P.beetle[b.t], r = cs * 0.4, ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][b.d], buried = b.st === 'buried', alert = b.chase && b.tm > 0 && b.st === 'walk';
    if (buried) { c.fillStyle = P.soil; c.globalAlpha = 0.82; c.fillRect(G.ox + b.cx * cs, G.oy + b.cy * cs, cs, cs); c.globalAlpha = 1; c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, cs * 0.34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, b.tm / C.BURY)); c.stroke(); c.globalAlpha = 0.55; }
    var sh = b.st === 'stun' && Math.floor(time * 16) % 2 ? 1.5 : 0;
    c.save(); c.translate(p.x + sh, p.y); c.rotate(ang);
    if (px) { c.fillStyle = col; c.fillRect(-r, -r * 0.7, r * 1.6, r * 1.4); c.fillRect(r * 0.5, -r * 0.4, r * 0.5, r * 0.8); c.fillStyle = P.ink; c.fillRect(r * 0.2, -r * 0.5, 2, 2); c.fillRect(r * 0.2, r * 0.3, 2, 2); c.fillStyle = col; c.fillRect(r * 0.9, -r * 0.8, 3, 6); c.fillRect(r * 0.9, r * 0.4, 3, 6); }
    else {
      c.strokeStyle = '#120d1c'; c.lineWidth = 1.8; c.lineCap = 'round'; var wig = Math.sin(time * 14 + b.id) * 0.2;
      for (var j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(j * r * 0.45, 0); c.lineTo(j * r * 0.45 + wig * r, -r * 1.05); c.moveTo(j * r * 0.45, 0); c.lineTo(j * r * 0.45 - wig * r, r * 1.05); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(1, 3, r * 1.0, r * 0.7, 0, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.ellipse(-r * 0.1, 0, r * 0.95, r * 0.72, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r * 0.9, 0); c.lineTo(r * 0.5, 0); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-r * 0.3, -r * 0.28, r * 0.5, r * 0.18, 0, 0, 7); c.fill();
      c.fillStyle = '#120d1c'; c.beginPath(); c.arc(r * 0.85, 0, r * 0.36, 0, 7); c.fill();
      c.strokeStyle = '#120d1c'; c.lineWidth = 2.2; var hl = b.t === 'H' ? 0.7 : b.t === 'G' ? 0.5 : 0.45;
      c.beginPath(); c.moveTo(r * 1.0, -r * 0.2); c.quadraticCurveTo(r * 1.5, -r * 0.7, r * (1.0 + hl), -r * 0.35); c.moveTo(r * 1.0, r * 0.2); c.quadraticCurveTo(r * 1.5, r * 0.7, r * (1.0 + hl), r * 0.35); c.stroke();
      c.fillStyle = alert ? '#fff' : '#ffeaa0'; c.fillRect(r * 0.8, -r * 0.2, 2, 2); c.fillRect(r * 0.8, r * 0.1, 2, 2);
    }
    c.restore(); c.globalAlpha = 1;
    if (alert) { c.fillStyle = P.bad; c.fillRect(p.x - 2, p.y - cs * 0.95, 4, cs * 0.35); c.fillRect(p.x - 2, p.y - cs * 0.5, 4, 4); }
  }
  function frame(c, S, sc, o) {
    o = o || {}; var P = pal(sc), G = geo(sc), time = sc.time;
    board(c, S, P, G, time);
    S.beetles.forEach(function (b) { beetle(c, b, P, G, time); }); colony(c, S, P, G, time);
    (o.toasts || []).forEach(function (t) { var p = pt(G, t.x, t.y); c.globalAlpha = Math.min(1, t.t * 2.2); sc.text(t.text, p.x, p.y - (1.2 - t.t) * 26, { size: t.size || 16, align: 'center', weight: 900, color: t.color, maxWidth: 200 }); c.globalAlpha = 1; });
    return { P: P, G: G };
  }
  function antIcon(c, x, y, r, P) { c.fillStyle = P.ant; if (P.pixel) { c.fillRect(x - r, y - 2, r * 0.7, 4); c.fillRect(x - r * 0.2, y - 3, r * 0.5, 6); c.fillRect(x + r * 0.5, y - 2, r * 0.6, 4); } else { c.beginPath(); c.ellipse(x - r * 0.6, y, r * 0.5, r * 0.36, 0, 0, 7); c.fill(); c.beginPath(); c.arc(x + r * 0.05, y, r * 0.28, 0, 7); c.fill(); c.beginPath(); c.arc(x + r * 0.6, y, r * 0.3, 0, 7); c.fill(); } }
  function gauge(c, S, P, x, y, w) {
    var q = 1 - S.cd / C.CD; c.fillStyle = P.panel; c.fillRect(x, y, w, 10); c.fillStyle = S.cd <= 0 ? P.good : P.muted; c.fillRect(x + 1, y + 1, (w - 2) * q, 8);
    c.strokeStyle = P.line; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, 9);
  }
  function wrap(s, n) { var w = s.split(' '), out = [], cur = ''; w.forEach(function (x) { if (cur && (cur + ' ' + x).length > n) { out.push(cur); cur = x; } else cur = cur ? cur + ' ' + x : x; }); if (cur) out.push(cur); return out; }
  function hud(c, S, P, G, sc, o) {
    var W = sc.W, H = sc.H, load = S.ants.filter(function (a) { return a.c; }).length, cd = S.cd <= 0;
    if (!G.L) {
      sc.text(String(o.score), 14, 20, { size: 22, weight: 900, color: P.ink, maxWidth: 150 });
      sc.text(sc.t('level') + ' ' + (S.level + 1) + '/' + C.MAX_LEVEL, W / 2, 20, { size: 16, align: 'center', weight: 800, color: P.accent, maxWidth: 160 });
      for (var i = 0; i < S.lives; i++) antIcon(c, W - 24 - i * 28, 20, 9, P);
      sc.text(sc.t('crumbs') + ': ' + S.got + '/' + S.quota, 14, 46, { size: 13, weight: 800, color: P.warn, maxWidth: 150 });
      sc.text(sc.t('ants') + ' ' + S.ants.length + ' · ' + sc.t('load') + ' ' + load, W / 2 + 10, 46, { size: 12, weight: 700, color: P.muted, maxWidth: 170, align: 'center' });
      gauge(c, S, P, W - 94, 41, 80, sc); sc.text('▼', W - 106, 46, { size: 13, align: 'center', color: cd ? P.good : P.muted });
      if (o.tutText) wrap(o.tutText, 52).slice(0, 2).forEach(function (t, i) { sc.text(t, W / 2, G.oy + G.gh + 16 + i * 16, { size: 13, align: 'center', weight: 700, color: P.warn, maxWidth: W - 16, minSize: 9 }); });
    } else {
      var lx = 12, lw = G.ox - 24, rx = G.ox + G.gw + 14, rw = W - rx - 12, y = 26;
      sc.text(sc.t('title'), lx + lw / 2, y, { size: 20, align: 'center', weight: 900, color: P.accent, maxWidth: lw });
      sc.text(sc.t('score'), lx, y + 38, { size: 11, color: P.muted, weight: 700 }); sc.text(String(o.score), lx, y + 64, { size: 28, weight: 900, color: P.ink, maxWidth: lw });
      sc.text(sc.t('level') + ' ' + (S.level + 1) + '/' + C.MAX_LEVEL, lx, y + 108, { size: 16, weight: 800, color: P.ink, maxWidth: lw });
      for (var j = 0; j < S.lives; j++) antIcon(c, lx + 12 + j * 28, y + 142, 9, P);
      sc.text(sc.t('crumbs') + ': ' + S.got + '/' + S.quota, rx, y + 10, { size: 16, weight: 800, color: P.warn, maxWidth: rw });
      sc.text(sc.t('ants') + ': ' + S.ants.length, rx, y + 40, { size: 13, weight: 700, color: P.muted, maxWidth: rw });
      sc.text(sc.t('load') + ': ' + load, rx, y + 62, { size: 13, weight: 700, color: P.muted, maxWidth: rw });
      sc.text('▼ ' + sc.t('collapse'), rx, y + 96, { size: 13, weight: 700, color: cd ? P.good : P.muted, maxWidth: rw }); gauge(c, S, P, rx, y + 108, Math.min(rw, 130), sc);
      if (o.tutText) { var ln = wrap(o.tutText, 22); ln.forEach(function (t, i) { sc.text(t, rx + rw / 2, H - 14 - (ln.length - 1 - i) * 15, { size: 12, align: 'center', weight: 700, color: P.warn, maxWidth: rw, minSize: 9 }); }); }
    }
  }
  KT_EXPORT();
  function KT_EXPORT() {
    MU.render = {
      pal: pal, geo: geo, pt: pt, land: land, rr: rr, antIcon: antIcon,
      bare: function (c, S, sc) { frame(c, S, sc); },
      draw: function (c, S, sc, o) {
        var r = frame(c, S, sc, o); hud(c, S, r.P, r.G, sc, o); var P = r.P, W = sc.W, H = sc.H, cy = r.G.oy + r.G.gh / 2;
        if (S.mode === 'clear') { c.fillStyle = 'rgba(10,8,5,.6)'; c.fillRect(r.G.ox, cy - 46, r.G.gw, 92); sc.text(sc.t('clear'), W / 2, cy - 30, { size: 28, align: 'center', weight: 900, color: P.good, maxWidth: r.G.gw - 20 }); sc.text(sc.t('bonus') + ' +' + (S.bonus || 0), W / 2, cy + 8, { size: 18, align: 'center', weight: 800, color: P.ink, maxWidth: r.G.gw - 20 }); }
        else if (S.mode === 'dying') sc.text(sc.t('bite'), W / 2, cy - 12, { size: 30, align: 'center', weight: 900, color: P.bad, maxWidth: r.G.gw - 20 });
      }
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
