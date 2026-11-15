/* ГАТЬ · отрисовка мира. modern — гладкие формы, тени, свечение фонарей; retro — кадр рисуется в буфер 1/3
   разрешения квадратиками своей 14-цветной палитры и растягивается без сглаживания. Логику не трогает. */
(function (root) {
  'use strict';
  var GAT = root.GAT = root.GAT || {};
  var PAL = {
    modern: { water: '#13292b', water2: '#18332f', shallow: '#2c5249', land: '#4a5a2c', land2: '#55673a', reeds: '#6d7a3a', thicket: '#21351c', thicket2: '#2d4724',
      gat: '#8b6a43', gat2: '#5f4529', pool: '#140f1f', pool2: '#4a2c5e', me: '#36b3a8', me2: '#1d6d66', amber: '#f2b347', linen: '#e6dcc0',
      foe: '#a2507a', foe2: '#5a2846', eye: '#c8f05a', neutral: '#b9ab84', shadow: 'rgba(0,0,0,.28)', hp: '#58d68d', hpBad: '#e8604c', sel: '#9ff3e6' },
    retro: { water: '#173c4a', water2: '#123341', shallow: '#2c6e6a', land: '#5a6b2a', land2: '#6e8030', reeds: '#9aa04a', thicket: '#22381c', thicket2: '#22381c',
      gat: '#b07a3a', gat2: '#6a4220', pool: '#1a0f24', pool2: '#6a3a8a', me: '#4fd6c0', me2: '#1f7a6e', amber: '#ffc040', linen: '#f0e6c8',
      foe: '#d0508a', foe2: '#6a2044', eye: '#e8ff60', neutral: '#c8b890', shadow: null, hp: '#60e070', hpBad: '#ff5040', sel: '#f0e6c8' },
  };
  var cache = { key: '', cv: null };

  function terrain(S, theme) {
    var key = S.mi + ':' + theme + ':' + S.m.seed;
    if (cache.key === key) return cache.cv;
    var L = GAT.logic, T = L.T, TL = L.TILE, M = S.map, P = PAL[theme], retro = theme === 'retro';
    var cv = document.createElement('canvas'); cv.width = M.w * TL; cv.height = M.h * TL;
    var c = cv.getContext('2d'), r = L.rng(S.m.seed + 5), x, y;
    function at(xx, yy) { if (xx < 0 || yy < 0 || xx >= M.w || yy >= M.h) return T.WATER; return M.g[yy * M.w + xx]; }
    c.fillStyle = P.water; c.fillRect(0, 0, cv.width, cv.height);
    if (!retro) { // modern: основа — 1 пиксель на клетку, растянутая со сглаживанием (мягкие берега), детали сверху
      var sm = document.createElement('canvas'); sm.width = M.w; sm.height = M.h; var sc = sm.getContext('2d');
      var COL = {}; COL[T.WATER] = P.water; COL[T.GAT] = P.water2; COL[T.SHALLOW] = P.shallow; COL[T.LAND] = P.land; COL[T.REEDS] = P.reeds; COL[T.THICKET] = P.thicket; COL[T.POOL] = P.pool;
      for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) { sc.fillStyle = COL[at(x, y)]; sc.fillRect(x, y, 1, 1); }
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(sm, -TL / 2, -TL / 2, cv.width + TL, cv.height + TL);
    }
    for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) {
      var t = at(x, y), px = x * TL, py = y * TL, n = r();
      if (t === T.WATER) {
        if (retro) { if ((x + y) % 2 === 0) { c.fillStyle = P.water2; c.fillRect(px, py, TL, TL); } if (n < 0.12) { c.fillStyle = P.shallow; c.fillRect(px + 9, py + 15, 12, 3); } }
        else { if (n < 0.1) { c.strokeStyle = 'rgba(160,210,200,.10)'; c.lineWidth = 1.5; c.beginPath(); c.arc(px + 16, py + 20, 7, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } }
        continue;
      }
      var base = t === T.SHALLOW ? P.shallow : (t === T.POOL ? P.pool : (t === T.THICKET ? P.thicket : (t === T.REEDS ? P.reeds : P.land)));
      if (t === T.GAT) base = P.water;
      if (retro || t === T.GAT) { c.fillStyle = retro ? base : 'rgba(0,0,0,0)'; c.fillRect(px, py, TL, TL); }
      if (t === T.LAND || t === T.REEDS) {
        if (retro) { if ((x * 7 + y * 3) % 5 === 0) { c.fillStyle = P.land2; c.fillRect(px + 6, py + 6, 6, 6); c.fillRect(px + 20, py + 18, 6, 6); } }
        else { c.fillStyle = P.land2; for (var k = 0; k < 3; k++) { c.globalAlpha = 0.35 + r() * 0.3; c.beginPath(); c.arc(px + r() * TL, py + r() * TL, 2 + r() * 5, 0, 7); c.fill(); } c.globalAlpha = 1; }
      }
      if (t === T.REEDS) { c.strokeStyle = retro ? P.land2 : '#8f9a4c'; c.fillStyle = c.strokeStyle; for (var q = 0; q < 4; q++) { var rx = px + 4 + q * 7, ry = py + 26; if (retro) c.fillRect(rx, ry - 14, 3, 14); else { c.lineWidth = 1.6; c.beginPath(); c.moveTo(rx, ry); c.quadraticCurveTo(rx + 2, ry - 10, rx + 4 + r() * 3, ry - 18); c.stroke(); } } }
      if (t === T.THICKET) {
        if (retro) { c.fillStyle = P.land2; c.fillRect(px + 4, py + 4, 10, 10); c.fillRect(px + 16, py + 14, 12, 12); c.fillStyle = P.gat2; c.fillRect(px + 14, py + 24, 4, 8); }
        else { for (var b = 0; b < 3; b++) { c.fillStyle = b === 2 ? '#3d5a2c' : P.thicket2; c.beginPath(); c.arc(px + 8 + r() * 16, py + 8 + r() * 16, 9 + r() * 5, 0, 7); c.fill(); } }
      }
      if (t === T.POOL) { c.fillStyle = P.pool2; if (retro) c.fillRect(px + 8, py + 8, 16, 16); else { c.globalAlpha = 0.5; c.beginPath(); c.arc(px + 16, py + 16, 11, 0, 7); c.fill(); c.globalAlpha = 1; } }
      if (t === T.GAT && retro) {
        var horiz = (at(x - 1, y) === T.GAT || at(x + 1, y) === T.GAT) ? 1 : 0, vert = (at(x, y - 1) === T.GAT || at(x, y + 1) === T.GAT) ? 1 : 0;
        c.fillStyle = P.gat;
        if (retro) { c.fillRect(px, py + 2, TL, TL - 4); c.fillStyle = P.gat2; for (var pl = 0; pl < 4; pl++) if (horiz >= vert) c.fillRect(px + pl * 8, py + 2, 2, TL - 4); else c.fillRect(px, py + 2 + pl * 8, TL, 2); }
        else {
          c.fillRect(px - 1, py - 1, TL + 2, TL + 2); c.strokeStyle = P.gat2; c.lineWidth = 1.5;
          for (var pk = 0; pk < 5; pk++) { c.beginPath(); if (horiz >= vert) { c.moveTo(px + pk * 6.5 + 2, py); c.lineTo(px + pk * 6.5 + 2 + (r() - 0.5) * 2, py + TL); } else { c.moveTo(px, py + pk * 6.5 + 2); c.lineTo(px + TL, py + pk * 6.5 + 2 + (r() - 0.5) * 2); } c.stroke(); }
        }
      }
    }
    if (!retro) (S.m.gat || []).forEach(function (pr) { // мостки — полосой из досок по линии между островами
      var A = S.m.isles[pr[0]], B = S.m.isles[pr[1]], ax = A.x * TL, ay = A.y * TL, bx = B.x * TL, by = B.y * TL, len = Math.hypot(bx - ax, by - ay), s0 = -1, s1 = -1;
      for (var d = 0; d <= len; d += 4) if (L.tileAt(M, ax + (bx - ax) * d / len, ay + (by - ay) * d / len) === T.GAT) { if (s0 < 0) s0 = d; s1 = d; }
      if (s0 < 0) return;
      s0 = Math.max(0, s0 - 14); s1 = Math.min(len, s1 + 14);
      c.save(); c.translate(ax, ay); c.rotate(Math.atan2(by - ay, bx - ax));
      c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(s0 + 3, -19, s1 - s0, 42);
      c.fillStyle = P.gat2; c.fillRect(s0, -21, s1 - s0, 42);
      for (var q = s0 + 2; q < s1 - 2; q += 9) { c.fillStyle = r() < 0.5 ? P.gat : '#7d5f3b'; var jag = (r() - 0.5) * 4; c.fillRect(q, -19 + jag, 7, 38 - jag); }
      c.fillStyle = '#4a3420'; c.fillRect(s0, -22, s1 - s0, 3); c.fillRect(s0, 19, s1 - s0, 3);
      c.restore();
    });
    // тень берега: тёмная полоска под сушей
    if (false) {
      c.fillStyle = 'rgba(0,0,0,.22)';
      for (y = 0; y < M.h - 1; y++) for (x = 0; x < M.w; x++) { var a = at(x, y), b2 = at(x, y + 1); if ((a === T.LAND || a === T.REEDS || a === T.THICKET) && (b2 === T.SHALLOW || b2 === T.WATER)) c.fillRect(x * TL, (y + 1) * TL, TL, 5); }
    }
    cache.key = key; cache.cv = cv; return cv;
  }

  // --- примитивы (retro — квадратиками) ---
  function blob(c, R, x, y, r, col) { c.fillStyle = col; if (R) { r = Math.max(2, Math.round(r)); c.fillRect(Math.round(x - r), Math.round(y - r * 0.7), r * 2, Math.round(r * 1.4)); c.fillRect(Math.round(x - r * 0.7), Math.round(y - r), Math.round(r * 1.4), r * 2); } else { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } }
  function ring(c, R, x, y, r, col, w, dash) {
    c.strokeStyle = col; c.lineWidth = w || 2;
    if (R) { c.setLineDash([6, 6]); c.strokeRect(Math.round(x - r), Math.round(y - r * 0.8), Math.round(r * 2), Math.round(r * 1.6)); c.setLineDash([]); return; }
    if (dash) c.setLineDash(dash); c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, 7); c.stroke(); c.setLineDash([]);
  }
  function shadow(c, R, P, x, y, r) { if (R) return; c.fillStyle = P.shadow; c.beginPath(); c.ellipse(x + 2, y + r * 0.7, r * 1.05, r * 0.45, 0, 0, 7); c.fill(); }

  function drawPoint(c, R, P, p, S, t) {
    var col = p.owner === 1 ? P.me : (p.owner === -1 ? P.foe : P.neutral);
    if (!R) { c.fillStyle = p.owner === 1 ? 'rgba(54,179,168,.10)' : (p.owner === -1 ? 'rgba(162,80,122,.10)' : 'rgba(185,171,132,.08)'); c.beginPath(); c.ellipse(p.x, p.y, p.r, p.r * 0.8, 0, 0, 7); c.fill(); }
    ring(c, R, p.x, p.y, p.r, col, R ? 3 : 2, [10, 8]);
    // прогресс захвата
    if (p.prog > -1 && p.prog < 1 && !(p.nest && !p.nest.dead)) {
      var v = (p.prog + 1) / 2; c.strokeStyle = P.me; c.lineWidth = R ? 6 : 5;
      if (R) { c.fillStyle = P.me2; c.fillRect(p.x - 40, p.y + p.r * 0.8 + 6, 80, 8); c.fillStyle = P.me; c.fillRect(p.x - 40, p.y + p.r * 0.8 + 6, 80 * v, 8); }
      else { c.beginPath(); c.ellipse(p.x, p.y, p.r + 6, p.r * 0.8 + 5, 0, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2); c.stroke(); }
    }
    if (p.nest && !p.nest.dead) return;
    // веха: столб с фонарём / флажком
    var x = p.x, y = p.y;
    shadow(c, R, P, x, y + 4, 8);
    c.fillStyle = P.gat2; c.fillRect(x - 2, y - 40, 4, 42);
    if (p.owner === 1) {
      if (!R) { var g = c.createRadialGradient(x, y - 40, 2, x, y - 40, 34); g.addColorStop(0, 'rgba(242,179,71,.55)'); g.addColorStop(1, 'rgba(242,179,71,0)'); c.fillStyle = g; c.fillRect(x - 36, y - 76, 72, 72); }
      c.fillStyle = P.amber; c.fillRect(x - 5, y - 46, 10, 10); c.fillStyle = P.me; c.fillRect(x + 2, y - 38, 16, 9);
    } else { c.fillStyle = P.neutral; c.fillRect(x + 2, y - 38, 14, 8); }
    if (p.home) { c.fillStyle = P.gat; c.fillRect(x - 34, y - 22, 22, 18); c.fillStyle = P.gat2; c.beginPath(); c.moveTo(x - 37, y - 22); c.lineTo(x - 23, y - 33); c.lineTo(x - 9, y - 22); c.fill(); }
    if (p.building) drawBuilding(c, R, P, p, t);
  }
  function drawBuilding(c, R, P, p, t) {
    var x = p.x + 30, y = p.y - 4;
    shadow(c, R, P, x, y + 4, 12);
    if (p.building === 'tower') { c.fillStyle = P.gat2; c.fillRect(x - 8, y - 44, 4, 46); c.fillRect(x + 4, y - 44, 4, 46); c.fillStyle = P.gat; c.fillRect(x - 12, y - 52, 24, 12); c.fillStyle = P.me; c.fillRect(x - 12, y - 56, 24, 4); }
    else if (p.building === 'fire') {
      c.fillStyle = P.gat2; c.fillRect(x - 10, y - 2, 20, 5);
      var f = Math.sin(t * 9) * 2;
      if (!R) { var g = c.createRadialGradient(x, y - 8, 2, x, y - 8, 40); g.addColorStop(0, 'rgba(255,170,60,.45)'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.fillRect(x - 40, y - 48, 80, 80); }
      c.fillStyle = '#e8743a'; c.fillRect(x - 6, y - 14 - f, 12, 13 + f); c.fillStyle = P.amber; c.fillRect(x - 3, y - 10 - f, 6, 9 + f);
    } else { c.fillStyle = P.gat; c.fillRect(x - 13, y - 20, 26, 20); c.fillStyle = P.gat2; c.beginPath(); c.moveTo(x - 16, y - 20); c.lineTo(x, y - 32); c.lineTo(x + 16, y - 20); c.fill(); c.fillStyle = P.amber; c.fillRect(x - 4, y - 12, 8, 12); }
  }
  function drawUnit(c, R, P, u, t) {
    var x = u.x, y = u.y, f = u.face, cs = Math.cos(f), sn = Math.sin(f), K = u.kind;
    if (u.side === 0) {
      var body = u.hitT > 0 ? '#ffffff' : P.me;
      if (K === 'cart') {
        shadow(c, R, P, x, y, 12);
        c.save(); c.translate(x, y); if (!R) c.rotate(f);
        c.fillStyle = '#2a2219'; c.fillRect(-10, -10, 6, 4); c.fillRect(4, -10, 6, 4); c.fillRect(-10, 6, 6, 4); c.fillRect(4, 6, 6, 4);
        c.fillStyle = P.gat; c.fillRect(-11, -7, 22, 14); c.fillStyle = body; c.fillRect(-11, -7, 6, 14);
        c.fillStyle = P.amber; c.fillRect(0, -2, 14, 4); c.fillRect(2, -8, 3, 16);
        c.restore(); return;
      }
      var hr = K.indexOf('hero') === 0;
      shadow(c, R, P, x, y, u.r);
      if (hr && !R) { var g = c.createRadialGradient(x + cs * 10, y + sn * 10 - 4, 1, x + cs * 10, y + sn * 10 - 4, 46); g.addColorStop(0, 'rgba(242,179,71,.35)'); g.addColorStop(1, 'rgba(242,179,71,0)'); c.fillStyle = g; c.fillRect(x - 50, y - 54, 100, 100); }
      blob(c, R, x, y - 2, u.r, hr ? P.me2 : body);
      blob(c, R, x, y - u.r * 0.6 - 2, u.r * 0.55, P.linen); // голова-капюшон
      if (hr) { c.fillStyle = body; c.fillRect(x - u.r, y + 1, u.r * 2, 3); }
      if (K === 'bow') { c.fillStyle = P.amber; c.fillRect(x + cs * 7 - 1, y + sn * 7 - 3, 3, 3); c.strokeStyle = P.gat; c.lineWidth = 2; c.beginPath(); c.moveTo(x + cs * 4 - sn * 6, y + sn * 4 + cs * 6); c.lineTo(x + cs * 4 + sn * 6, y + sn * 4 - cs * 6); c.stroke(); }
      else if (K === 'shield') { c.fillStyle = P.linen; c.save(); c.translate(x + cs * 8, y + sn * 8 - 2); if (!R) c.rotate(f); c.fillRect(-3, -8, 6, 16); c.fillStyle = P.me2; c.fillRect(-1, -6, 2, 12); c.restore(); }
      else if (K === 'hero_v') { c.fillStyle = P.amber; c.fillRect(x + cs * 12 - 4, y + sn * 12 - 8, 8, 9); c.fillStyle = P.gat2; c.fillRect(x + cs * 12 - 1, y + sn * 12 - 13, 2, 5); }
      else if (K === 'hero_z') { c.strokeStyle = P.gat; c.lineWidth = 3; c.beginPath(); c.moveTo(x - cs * 8, y - sn * 8); c.lineTo(x + cs * 24, y + sn * 24 - 4); c.stroke(); c.strokeStyle = '#b8bcbf'; c.beginPath(); c.moveTo(x + cs * 24, y + sn * 24 - 4); c.lineTo(x + cs * 24 - sn * 6, y + sn * 24 + cs * 6 - 4); c.stroke(); }
      if (u.buff > 0) ring(c, R, x, y, u.r + 5, P.amber, 1.5);
      return;
    }
    var hit = u.hitT > 0, b = hit ? '#ffffff' : P.foe, d = hit ? '#ffffff' : P.foe2;
    if (K === 'nest') {
      shadow(c, R, P, x, y, 24);
      blob(c, R, x, y, 22, P.pool); blob(c, R, x, y, 14, P.pool2);
      c.fillStyle = P.gat2; for (var s = 0; s < 8; s++) { var a = s / 8 * Math.PI * 2; c.fillRect(x + Math.cos(a) * 26 - 2, y + Math.sin(a) * 21 - 12, 4, 14); }
      for (var e = 0; e < 3; e++) blob(c, R, x - 8 + e * 8, y - 2 + (e % 2) * 4, 4, hit ? '#fff' : P.eye);
      return;
    }
    if (K === 'koryazhnik' || K === 'kamyshnitsa' || K === 'omutnik') {
      shadow(c, R, P, x, y, u.r);
      if (K === 'omutnik' && !R) { c.strokeStyle = 'rgba(106,58,138,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, u.r + 10 + Math.sin(t * 3) * 3, t * 2, t * 2 + 4); c.stroke(); }
      blob(c, R, x, y - 6, u.r, d); blob(c, R, x - u.r * 0.3, y - u.r * 0.5, u.r * 0.6, b);
      c.strokeStyle = K === 'kamyshnitsa' ? P.reeds || '#9aa04a' : P.gat2; c.fillStyle = c.strokeStyle; c.lineWidth = 4;
      for (var br = 0; br < 5; br++) { var bx = x - u.r + br * u.r / 2, h = K === 'kamyshnitsa' ? 30 : 18; if (R) c.fillRect(bx, y - u.r - h, 4, h); else { c.beginPath(); c.moveTo(bx, y - u.r * 0.6); c.lineTo(bx + (br - 2) * 5, y - u.r - h); c.stroke(); } }
      blob(c, R, x - 7, y - u.r * 0.6, 4, P.eye); blob(c, R, x + 7, y - u.r * 0.6, 4, P.eye);
      return;
    }
    shadow(c, R, P, x, y, u.r);
    if (K === 'kochkar') { blob(c, R, x - 3, y, u.r * 0.8, d); blob(c, R, x + 3, y - 2, u.r * 0.85, b); c.fillStyle = '#7a8a3a'; c.fillRect(x - 4, y - u.r - 4, 2, 6); c.fillRect(x + 2, y - u.r - 5, 2, 7); }
    else if (K === 'plevun') { blob(c, R, x, y - 1, u.r, b); c.fillStyle = d; c.fillRect(x + cs * 4 - 3, y + sn * 4, 6, 3); }
    else { blob(c, R, x, y - 3, u.r, d); blob(c, R, x + 3, y - 6, u.r * 0.6, b); c.fillStyle = P.shallow; c.fillRect(x - u.r + 2, y + 2, 3, 6); c.fillRect(x + u.r - 5, y + 1, 3, 8); }
    blob(c, R, x - 3, y - u.r * 0.4, 2, P.eye); blob(c, R, x + 3, y - u.r * 0.4, 2, P.eye);
  }
  function hpBar(c, P, u) {
    if (u.hp >= u.maxHp || u.dead) return;
    var w = Math.max(16, u.r * 2.2), v = Math.max(0, u.hp / u.maxHp), y = u.y - u.r * 1.6 - 8;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(u.x - w / 2 - 1, y - 1, w + 2, 5);
    c.fillStyle = v > 0.4 ? P.hp : P.hpBad; c.fillRect(u.x - w / 2, y, w * v, 3);
  }
  function drawFx(c, R, P, f) {
    var k = f.t / f.d;
    if (f.k === 'shot') { var x = f.x0 + (f.x - f.x0) * k, y = f.y0 + (f.y - f.y0) * k - Math.sin(k * Math.PI) * 10; c.fillStyle = f.side === 0 ? (f.heavy ? P.amber : P.linen) : P.eye; c.fillRect(x - (f.heavy ? 3 : 2), y - 2, f.heavy ? 6 : 4, f.heavy ? 5 : 3); return; }
    if (f.k === 'volley') { var vx = f.x0 + (f.x - f.x0) * k, vy = f.y0 + (f.y - f.y0) * k - Math.sin(k * Math.PI) * 60; blob(c, R, vx, vy, 6, f.side === 1 ? P.eye : P.amber); ring(c, R, f.x, f.y, f.r, f.side === 1 ? P.eye : P.amber, 1.5, [4, 4]); return; }
    if (f.k === 'boom' || f.k === 'quake') { c.globalAlpha = 1 - k; ring(c, R, f.x, f.y, f.r * (0.4 + k * 0.6), f.k === 'boom' ? '#ff9a3a' : (f.side === 0 ? P.me : '#c09060'), R ? 4 : 5); if (f.k === 'boom') blob(c, R, f.x, f.y, f.r * 0.5 * (1 - k), P.amber); c.globalAlpha = 1; return; }
    if (f.k === 'heal' || f.k === 'rally') { c.globalAlpha = 1 - k; ring(c, R, f.x, f.y, f.r * k, f.k === 'heal' ? '#9be37a' : P.amber, 4); c.globalAlpha = 1; return; }
    if (f.k === 'pull') { c.globalAlpha = 1 - k; ring(c, R, f.x, f.y, f.r * (1 - k), P.pool2, 5); c.globalAlpha = 1; return; }
    if (f.k === 'summon') { c.globalAlpha = 1 - k; ring(c, R, f.x, f.y, 30 + 30 * k, P.eye, 3); c.globalAlpha = 1; return; }
    if (f.k === 'slash') { c.globalAlpha = 1 - k; c.fillStyle = f.side === 0 ? P.linen : P.eye; c.fillRect(f.x - 5, f.y - 5 - k * 4, 10, 2); c.globalAlpha = 1; return; }
    if (f.k === 'pop') { c.globalAlpha = 1 - k; var n = f.big ? 10 : 5; for (var i = 0; i < n; i++) { var a = i / n * 6.28; c.fillStyle = f.side === 1 ? P.foe : P.me; c.fillRect(f.x + Math.cos(a) * k * (f.big ? 40 : 16) - 2, f.y + Math.sin(a) * k * (f.big ? 32 : 13) - 2, 4, 4); } c.globalAlpha = 1; }
  }

  // мир: cam {x,y,z} — левый верхний угол в мире и масштаб; view {w,h}; ui {sel:Set, marks:[]}
  function world(c, S, theme, cam, view, ui, t) {
    var P = PAL[theme] || PAL.modern, R = theme === 'retro';
    var tc = terrain(S, theme);
    c.save();
    c.fillStyle = P.water; c.fillRect(0, 0, view.w, view.h);
    c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
    c.drawImage(tc, 0, 0);
    S.points.forEach(function (p) { drawPoint(c, R, P, p, S, t); });
    // выделение
    S.squads.forEach(function (sq) {
      if (!ui.sel.has(sq.id) || !GAT.logic.alive(sq)) return;
      var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      sq.members.forEach(function (u) { if (u.dead) return; minx = Math.min(minx, u.x); maxx = Math.max(maxx, u.x); miny = Math.min(miny, u.y); maxy = Math.max(maxy, u.y); });
      var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2 + 4, rr = Math.max(18, (maxx - minx) / 2 + 14, (maxy - miny) / 2 + 14);
      ring(c, R, cx, cy, rr, P.sel, R ? 3 : 2.5);
      if (sq.order.k === 'move' && sq.path) { c.strokeStyle = 'rgba(159,243,230,.35)'; c.lineWidth = 2; c.setLineDash([5, 7]); c.beginPath(); c.moveTo(sq.ax, sq.ay); for (var i = sq.pi || 0; i < sq.path.length; i++) c.lineTo(sq.path[i].x, sq.path[i].y); c.stroke(); c.setLineDash([]); }
    });
    var list = S.units.slice().sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (u) { if (!u.dead) drawUnit(c, R, P, u, t); });
    list.forEach(function (u) { if (!u.dead) hpBar(c, P, u); });
    S.fx.forEach(function (f) { drawFx(c, R, P, f); });
    (ui.marks || []).forEach(function (m) { var k = m.t / 0.6; c.globalAlpha = 1 - k; ring(c, R, m.x, m.y, 8 + 14 * k, m.atk ? P.hpBad : P.sel, 3); c.globalAlpha = 1; });
    if (ui.aim) { ring(c, R, ui.aim.x, ui.aim.y, ui.aim.r, P.amber, 2, [6, 6]); if (!S.hero.dead) ring(c, R, S.hero.x, S.hero.y, ui.aim.range, 'rgba(242,179,71,.35)', 1.5, [3, 9]); }
    c.restore();
  }
  function minimap(c, S, theme, x, y, w, h, cam, view) {
    var P = PAL[theme] || PAL.modern, M = S.map, TL = GAT.logic.TILE, sx = w / (M.w * TL), sy = h / (M.h * TL);
    c.save(); c.globalAlpha = 0.92; c.drawImage(terrain(S, theme), x, y, w, h); c.globalAlpha = 1;
    S.points.forEach(function (p) { c.fillStyle = p.owner === 1 ? P.me : (p.owner === -1 ? P.foe : P.neutral); c.fillRect(x + p.x * sx - 4, y + p.y * sy - 4, 8, 8); });
    S.units.forEach(function (u) { if (u.dead) return; c.fillStyle = u.side === 0 ? (u.kind.indexOf('hero') === 0 ? P.amber : P.linen) : P.eye; var s = GAT.logic.KINDS[u.kind].boss ? 6 : 3; c.fillRect(x + u.x * sx - s / 2, y + u.y * sy - s / 2, s, s); });
    c.strokeStyle = P.linen; c.lineWidth = 1.5; c.strokeRect(x + cam.x * sx, y + cam.y * sy, view.w / cam.z * sx, view.h / cam.z * sy);
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeRect(x, y, w, h);
    c.restore();
  }
  GAT.render = { PAL: PAL, world: world, minimap: minimap, terrain: terrain };
})(typeof window !== 'undefined' ? window : globalThis);
