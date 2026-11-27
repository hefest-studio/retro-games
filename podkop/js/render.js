/* ПОДКОП · рендер обеих тем. Поле 22×18 клеток, показываются только строки уровня (S.top…): выше — сплошная скала. Холст портретный 450×580 или
   альбомный 800×450 (в альбоме HUD по бокам). Герой — барсук-землекоп с мешком, враги — краб-ходок и скорпион-охотник. PODKOP.render */
(function (global) {
  'use strict';
  var PK = global.PODKOP = global.PODKOP || {}, C = PK.consts, COLS = C.COLS, ROWS = C.ROWS;
  function pal(g) {
    if (g.themeName === 'retro') return { pixel: true, bg: '#000000', rock: '#0000aa', rockHi: '#5555ff', rockLo: '#000055', sand: '#ffff55', sand2: '#aa5500', sandHi: '#ffffff', spike: '#ff5555', spout: '#ff55ff',
      door: '#55ffff', doorIn: '#000000', hero: '#ffffff', heroDk: '#555555', walker: '#55ff55', fast: '#ffff55', chaser: '#ff55ff', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', panel: '#000000', line: '#5555ff' };
    return { pixel: false, bg: '#10131f', bg2: '#1c2347', rock: '#3d4768', rockHi: '#5b6891', rockLo: '#272f4a', sand: '#e9c46a', sand2: '#d9b052', sandHi: '#fff0b8', spike: '#ef4b5a', spout: '#ff8a3d',
      door: '#5ee7ff', doorIn: '#0a2a3a', hero: '#2c2e38', heroDk: '#17181f', walker: '#4cc38a', fast: '#ff9a3c', chaser: '#b36cff', ink: '#eef1fb', muted: '#8f98b8', accent: '#ffc857', good: '#6fe0a0', bad: '#ff6670', warn: '#ffc857', panel: '#181c30', line: '#37406a' };
  }
  function land(g) { return g.W > g.H; }
  function geo(g, S) {
    var L = land(g), rows = ROWS - ((S && S.top) || 0), cs, ox, oy;
    if (L) { cs = Math.floor(Math.min((g.H - 20) / rows, (g.W - 250) / COLS)); ox = Math.round((g.W - cs * COLS) / 2); oy = Math.round((g.H - cs * rows) / 2); }
    else { cs = Math.floor(Math.min(g.W / COLS, (g.H - 170) / rows)); ox = Math.round((g.W - cs * COLS) / 2); oy = 62; }
    return { L: L, cs: cs, ox: ox, oy: oy, gw: COLS * cs, gh: rows * cs, top: (S && S.top) || 0 };
  }
  function pt(G, x, y) { return { x: G.ox + (x + 0.5) * G.cs, y: G.oy + (y - G.top + 0.5) * G.cs }; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function hash(x, y, k) { var h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function at(S, x, y) { return x < 0 || x >= COLS ? C.WALL : y < 0 ? C.WALL : y >= ROWS ? C.AIR : S.g[y * COLS + x]; }

  function cellDraw(c, S, P, G, x, y, v, time) {
    var cs = G.cs, X = G.ox + x * cs, Y = G.oy + (y - G.top) * cs, px = P.pixel, up = at(S, x, y - 1), k;
    if (v === C.WALL) {
      c.fillStyle = P.rock; c.fillRect(X, Y, cs, cs);
      if (px) { c.fillStyle = P.rockLo; c.fillRect(X, Y + cs - 3, cs, 3); c.fillRect(X + cs - 3, Y, 3, cs); if (up !== C.WALL) { c.fillStyle = P.rockHi; c.fillRect(X, Y, cs, 3); } if ((x + y) % 2 === 0) { c.fillStyle = P.rockHi; c.fillRect(X + 6, Y + 8, 4, 2); } }
      else { c.fillStyle = P.rockLo; c.fillRect(X, Y + cs * 0.72, cs, cs * 0.28); if (up !== C.WALL) { c.fillStyle = P.rockHi; c.fillRect(X, Y, cs, Math.max(2, cs * 0.14)); } c.globalAlpha = 0.25; c.fillStyle = P.rockHi; c.fillRect(X + hash(x, y, 1) * cs * 0.6, Y + cs * 0.3 + hash(x, y, 2) * cs * 0.2, cs * 0.25, 2); c.globalAlpha = 1; }
    } else if (v === C.SAND) {
      var sh = hash(x, y, 3), fall = S.fl[y * COLS + x];
      c.fillStyle = px ? P.sand : (sh < 0.5 ? P.sand : P.sand2); c.fillRect(X, Y, cs, cs);
      if (px) { if (up === C.AIR) { c.fillStyle = P.sandHi; c.fillRect(X, Y, cs, 2); } c.fillStyle = P.sand2; for (k = 0; k < 2; k++) c.fillRect(X + Math.floor(hash(x, y, k + 5) * (cs - 4) / 2) * 2, Y + Math.floor(hash(x, y, k + 8) * (cs - 4) / 2) * 2, 2, 2); }
      else { if (up === C.AIR) { c.fillStyle = P.sandHi; c.globalAlpha = 0.7; c.fillRect(X, Y, cs, Math.max(2, cs * 0.12)); c.globalAlpha = 1; } c.fillStyle = 'rgba(120,70,10,.28)'; for (k = 0; k < 3; k++) c.fillRect(X + hash(x, y, k + 5) * (cs - 3), Y + hash(x, y, k + 8) * (cs - 3), 2, 2); if (fall) { c.fillStyle = 'rgba(255,248,210,.3)'; c.fillRect(X, Y, cs, cs); } }
    } else if (v === C.SPIKE) {
      c.fillStyle = P.rockLo; c.fillRect(X, Y + cs * 0.62, cs, cs * 0.38); c.fillStyle = P.spike;
      for (k = 0; k < 2; k++) { c.beginPath(); c.moveTo(X + cs * k * 0.5, Y + cs * 0.65); c.lineTo(X + cs * (k * 0.5 + 0.25), Y + cs * 0.12); c.lineTo(X + cs * (k * 0.5 + 0.5), Y + cs * 0.65); c.closePath(); c.fill(); }
    } else if (v === C.SPOUT) {
      c.fillStyle = P.rock; c.fillRect(X, Y, cs, cs); c.fillStyle = P.spout; c.fillRect(X + cs * 0.2, Y + cs * 0.15, cs * 0.6, cs * 0.55); c.fillStyle = P.bg; c.fillRect(X + cs * 0.36, Y + cs * 0.7, cs * 0.28, cs * 0.3);
      c.fillStyle = P.sand; c.fillRect(X + cs * 0.42, Y + cs * 0.78 + (px ? 0 : Math.sin(time * 8) * 1.5), cs * 0.16, cs * 0.2);
    }
  }
  function exitDraw(c, P, G, ex, time, open) {
    var p = pt(G, ex.x, ex.y), cs = G.cs, w = cs * 0.74, h = cs * 0.96, X = p.x - w / 2, Y = p.y + cs * 0.5 - h;
    if (!P.pixel) { var g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, cs * 1.6); g.addColorStop(0, 'rgba(94,231,255,.35)'); g.addColorStop(1, 'rgba(94,231,255,0)'); c.fillStyle = g; c.fillRect(p.x - cs * 2, p.y - cs * 2, cs * 4, cs * 4); }
    c.fillStyle = P.door; if (P.pixel) c.fillRect(X, Y, w, h); else { rr(c, X, Y, w, h, w / 2); c.fill(); }
    c.fillStyle = P.doorIn; if (P.pixel) c.fillRect(X + 4, Y + 4, w - 8, h - 4); else { rr(c, X + cs * 0.1, Y + cs * 0.1, w - cs * 0.2, h - cs * 0.1, w / 2 - 2); c.fill(); }
    c.fillStyle = P.door; c.globalAlpha = P.pixel ? 1 : 0.5 + 0.3 * Math.sin(time * 4); c.fillRect(p.x - 1, Y + h * 0.35, 2, h * 0.5); c.globalAlpha = 1;
  }
  function heroDraw(c, P, G, S, time) {
    var h = S.hero, p = pt(G, h.x, h.y), cs = G.cs, f = h.f, k = cs / 20, dead = S.mode === 'dying', px = P.pixel;
    c.save(); c.translate(p.x, p.y + cs * 0.06); c.scale(f, 1);
    if (dead) { c.globalAlpha = 0.5 + 0.5 * Math.sin(time * 30); }
    var walk = (Math.floor(time * 10) % 2) * (S.input && S.input.dx ? 1 : 0);
    // мешок с песком на спине
    c.fillStyle = P.heroDk; if (px) c.fillRect(-9 * k, -4 * k, 6 * k, 8 * k); else { rr(c, -10 * k, -5 * k, 7 * k, 9 * k, 3 * k); c.fill(); }
    if (h.bag > 0) { c.fillStyle = P.sand; var bs = Math.min(1, h.bag / C.CAP); if (px) c.fillRect(-8 * k, 2 * k - bs * 6 * k, 4 * k, bs * 6 * k + 2 * k); else { c.beginPath(); c.arc(-6.5 * k, -1 * k, (2 + bs * 3) * k, 0, 7); c.fill(); } }
    // тело
    c.fillStyle = P.hero; if (px) c.fillRect(-5 * k, -3 * k, 11 * k, 11 * k); else { rr(c, -6 * k, -4 * k, 12 * k, 12 * k, 5 * k); c.fill(); }
    c.fillStyle = P.heroDk; c.fillRect(-4 * k, 7 * k + walk * k, 3 * k, 3 * k); c.fillRect(2 * k, 7 * k - walk * k, 3 * k, 3 * k);
    // голова с полосой
    c.fillStyle = P.hero; if (px) c.fillRect(0, -9 * k, 10 * k, 9 * k); else { rr(c, -1 * k, -10 * k, 11 * k, 10 * k, 4 * k); c.fill(); }
    c.fillStyle = px ? '#ffffff' : '#f4efe6'; c.fillRect(2 * k, -9 * k, 3 * k, 8 * k); c.fillRect(7 * k, -9 * k, 2 * k, 3 * k);
    c.fillStyle = px ? '#ff5555' : '#e46a5a'; c.fillRect(9 * k, -5 * k, 2 * k, 2 * k);
    c.fillStyle = px ? '#000' : '#10131f'; c.fillRect(6 * k, -6 * k, 2 * k, 2 * k);
    // лопатка перед героем
    c.fillStyle = px ? '#aaaaaa' : '#9aa3b8'; c.fillRect(4 * k, 2 * k, 8 * k, 2 * k); c.fillStyle = px ? '#aa5500' : '#b97a3a'; c.fillRect(10 * k, 0, 3 * k, 6 * k);
    c.restore();
  }
  function enemyDraw(c, P, G, e, time) {
    var p = pt(G, e.x, e.y), cs = G.cs, k = cs / 20, px = P.pixel, col = e.t === 'w' ? (e.fast ? P.fast : P.walker) : P.chaser, leg = Math.floor(time * 8 + e.x) % 2;
    c.save(); c.translate(p.x, p.y + cs * 0.1); c.scale(e.d || 1, 1);
    c.fillStyle = col;
    if (e.t === 'w') {   // краб-ходок: панцирь, клешни, глаза
      if (px) c.fillRect(-7 * k, -3 * k, 14 * k, 9 * k); else { c.beginPath(); c.ellipse(0, 1 * k, 8 * k, 6 * k, 0, 0, 7); c.fill(); }
      c.fillRect(6 * k, -6 * k, 4 * k, 4 * k); c.fillRect(-10 * k, -6 * k, 4 * k, 4 * k);
      c.fillStyle = P.bg; c.fillRect(2 * k, -3 * k, 2 * k, 2 * k); c.fillRect(-4 * k, -3 * k, 2 * k, 2 * k);
      c.fillStyle = col; for (var i = 0; i < 3; i++) c.fillRect((-6 + i * 5) * k, (6 + (i + leg) % 2) * k, 2 * k, 3 * k);
    } else {   // скорпион-охотник: тело, хвост с жалом, клешни
      if (px) c.fillRect(-6 * k, 0, 12 * k, 7 * k); else { rr(c, -7 * k, -1 * k, 14 * k, 8 * k, 3 * k); c.fill(); }
      c.fillRect(-9 * k, -7 * k, 3 * k, 8 * k); c.fillRect(-9 * k, -9 * k, 7 * k, 3 * k); c.fillStyle = px ? '#ffffff' : '#ffe27a'; c.fillRect(-4 * k, -10 * k, 2 * k, 3 * k);
      c.fillStyle = col; c.fillRect(6 * k, 1 * k, 5 * k, 2 * k); c.fillRect(9 * k, -1 * k, 3 * k, 5 * k);
      c.fillStyle = px ? '#000' : '#10131f'; c.fillRect(3 * k, 2 * k, 2 * k, 2 * k);
      c.fillStyle = col; for (var j = 0; j < 3; j++) c.fillRect((-4 + j * 4) * k, (7 + (j + leg) % 2) * k, 2 * k, 3 * k);
    }
    c.restore();
  }

  function frame(c, S, sc, o) {
    var P = pal(sc), G = geo(sc, S), time = sc.time, W = sc.W, H = sc.H, x, y;
    if (P.pixel) { c.fillStyle = P.bg; c.fillRect(0, 0, W, H); }
    else { var bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, P.bg2); bg.addColorStop(1, P.bg); c.fillStyle = bg; c.fillRect(0, 0, W, H); }
    c.fillStyle = P.pixel ? '#000000' : '#0b0d17'; c.fillRect(G.ox, G.oy, G.gw, G.gh);
    for (y = S.top; y < ROWS; y++) for (x = 0; x < COLS; x++) { var v = S.g[y * COLS + x]; if (v) cellDraw(c, S, P, G, x, y, v, time); }
    if (S.exit) exitDraw(c, P, G, S.exit, time, true);
    S.enemies.forEach(function (e) { if (e.alive) enemyDraw(c, P, G, e, time); });
    if (S.mode !== 'gameover') heroDraw(c, P, G, S, time);
    return { P: P, G: G };
  }

  function grains(c, P, x, y, n, cap, size) {
    for (var i = 0; i < cap; i++) { c.fillStyle = i < n ? P.sand : (P.pixel ? '#222222' : 'rgba(255,255,255,.1)'); if (P.pixel) c.fillRect(x + i * (size + 2), y, size, size); else { c.beginPath(); c.arc(x + i * (size + 3) + size / 2, y + size / 2, size / 2, 0, 7); c.fill(); } }
  }
  function hud(c, S, P, G, sc, o) {
    var W = sc.W, L = G.L, th = sc.th(), name = PK.LEVELS[S.level].name[sc.i18n.lang === 'ru' ? 'ru' : 'en'];
    var lv = sc.t('level') + ' ' + (S.level + 1) + '/' + C.MAX_LEVEL, hearts = ''; for (var i = 0; i < Math.max(0, S.lives); i++) hearts += '♥';
    if (L) {
      var lx = 14, rx = W - 14;
      sc.text(sc.t('score'), lx, 28, { size: 11, color: P.muted, weight: 700 }); sc.text(String(S.score | 0), lx, 52, { size: 24, weight: 900, color: P.accent });
      sc.text(lv, lx, 88, { size: 14, weight: 800, maxWidth: G.ox - 24 }); sc.text(name, lx, 108, { size: 13, color: P.muted, weight: 600, maxWidth: G.ox - 24, minSize: 9 });
      sc.text(hearts, rx, 40, { size: 20, align: 'right', color: P.bad }); sc.text(sc.t('best') + ' ' + Math.max(sc.state.best | 0, S.score | 0), rx, 64, { size: 12, align: 'right', color: P.muted, weight: 600 });
      sc.text(sc.t('sand'), rx, 112, { size: 11, align: 'right', color: P.muted, weight: 700 }); sc.text(S.hero.bag + '/' + C.CAP, rx, 134, { size: 20, align: 'right', weight: 900, color: P.sand });
      grains(c, P, rx - 6 * 15 + 4, 148, S.hero.bag > 6 ? 6 : S.hero.bag, 6, 10); grains(c, P, rx - 6 * 15 + 4, 164, Math.max(0, S.hero.bag - 6), 6, 10);
    } else {
      sc.text(String(S.score | 0), 14, 30, { size: 22, weight: 900, color: P.accent }); sc.text(lv, W / 2, 24, { size: 14, align: 'center', weight: 800 }); sc.text(name, W / 2, 44, { size: 12, align: 'center', color: P.muted, weight: 600, maxWidth: W - 190, minSize: 9 });
      sc.text(hearts, W - 14, 30, { size: 18, align: 'right', color: P.bad });
      var by = G.oy + G.gh + 14; sc.text(sc.t('sand'), 14, by + 11, { size: 11, color: P.muted, weight: 700 }); grains(c, P, 70, by, S.hero.bag, C.CAP, 12);
      sc.text(String(S.hero.bag), W - 14, by + 12, { size: 16, align: 'right', weight: 900, color: P.sand });
    }
    var tt = o && o.tutText;
    if (tt) { var H = sc.H, below = L && G.oy + G.gh + 30 <= H, ty = L ? (below ? G.oy + G.gh + 20 : G.oy + G.gh - 6) : G.oy + G.gh + 56, w = L ? W - 60 : W - 28;
      c.fillStyle = P.pixel ? '#000000' : 'rgba(10,12,24,.82)'; c.fillRect(W / 2 - w / 2, ty - 18, w, L ? 24 : 44);
      var lines = [tt];
      if (!L && tt.length > 34) { var mid = tt.length >> 1, a = tt.lastIndexOf(' ', mid), b = tt.indexOf(' ', mid); var k = (a < 0 || (b >= 0 && b - mid < mid - a)) ? b : a; if (k > 0) lines = [tt.slice(0, k), tt.slice(k + 1)]; }
      lines.forEach(function (ln, i) { sc.text(ln, W / 2, ty + (L ? 0 : lines.length > 1 ? -2 + i * 16 : 6), { size: lines.length > 1 ? 12 : 13, align: 'center', color: P.warn, weight: 700, maxWidth: w - 16, minSize: 8 }); }); }
  }

  PK.render = {
    pal: pal, geo: geo, pt: pt, land: land, rr: rr,
    bare: function (c, S, sc) { frame(c, S, sc); },
    draw: function (c, S, sc, o) {
      var r = frame(c, S, sc, o); hud(c, S, r.P, r.G, sc, o); var P = r.P, G = r.G;
      (o && o.toasts || []).forEach(function (t) { var p = pt(G, t.x, t.y - (1.2 - t.t) * 1.5); c.globalAlpha = Math.min(1, t.t * 2); sc.text(t.text, p.x, p.y, { size: t.size || 14, align: 'center', color: t.color || P.warn, weight: 900 }); c.globalAlpha = 1; });
      if (S.mode === 'clear' && S.bonus) {
        c.fillStyle = P.pixel ? 'rgba(0,0,0,.85)' : 'rgba(8,10,20,.78)'; c.fillRect(0, G.oy + G.gh / 2 - 56, sc.W, 112);
        sc.text(sc.t('clear'), sc.W / 2, G.oy + G.gh / 2 - 18, { size: 28, align: 'center', color: P.good, weight: 900 });
        sc.text(sc.t('bonus') + ' +' + S.bonus.total + '  (' + S.bonus.time + ' ' + sc.t('btime') + ' · ' + S.bonus.sand + ' ' + sc.t('bsand') + ')', sc.W / 2, G.oy + G.gh / 2 + 16, { size: 13, align: 'center', color: P.ink, weight: 700, maxWidth: sc.W - 24, minSize: 9 });
        sc.text(sc.t('nextUp'), sc.W / 2, G.oy + G.gh / 2 + 40, { size: 12, align: 'center', color: P.muted, weight: 600 });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
