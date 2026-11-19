/* ОТГОН · рендер. Вид сверху-сбоку: коридор пути между скальной стеной (сверху) и кромкой (снизу — стена или обрыв),
   камера едет по X. modern — мягкие тона, тени, свет фонаря в сумерках; retro — та же сцена в половинном разрешении
   плоскими цветами с развёрткой. Слов нет: над существами — пиктограммы (испуг, отбился, упрямится, голод, усталость).
   OTGON.render = { draw(ctx, S, g, opt), resetCam(), toWorld(S, px, py), creature(...), mark(...), PAL } */
(function (global) {
  'use strict';
  var O = global.OTGON = global.OTGON || {}, Lg = O.logic, W = 960, H = 540;

  var PAL = {
    modern: {
      sky: ['#bcd3e2', '#e9e2d2'], peak: '#9db4c6', peak2: '#b9cbd8', rockTop: '#55525f', rockFace: '#7d7887', rockLine: '#a39eab', snowCap: '#f2f5f8',
      rim: '#4a4753', rimL: '#8a8593', abyss: '#93b3c9', abyss2: '#c8d9e4', mist: 'rgba(240,246,250,.55)', chasm: '#2d2b38', chasm2: '#454255',
      water: '#3f8fb6', waterL: '#7cc0d8', ford: '#8fcbdc', stone: '#b9b3a6', stoneD: '#8a8478',
      grass: '#4f9a4a', grassL: '#74b85c', blade: '#2f7a3a',
      wool: '#f4ecdb', woolS: '#d2c6ae', leg: '#3b3442', face: '#4b4354', curl: '#2e8f8a', bell: '#d8893a',
      coat: '#2c7c8e', coatD: '#1f5b6a', hat: '#e5c56c', hatD: '#b9963f', skin: '#e9c7a2', staff: '#6d4a2b', lamp: '#ffb347',
      bird: '#2b2a33', birdL: '#e8e2d2', fire: '#ffb347', fire2: '#ff7a2f', log: '#6d4a2b', tent: '#b9a27c', tentD: '#8a744f',
      hud: 'rgba(24,26,32,.72)', hudL: '#f1ead9', hudM: '#9aa0a8', ok: '#7ccf6a', warn: '#f0b04b', bad: '#e8604a', accent: '#f0a04b', shadow: 'rgba(20,20,30,.22)',
      marks: ['#d94f3d', '#2f7fd0', '#e0a520', '#3aa35a', '#8b55c9', '#e2622e', '#1f9aa0', '#c9478f', '#5560c8', '#7a8a1f']
    },
    retro: {
      sky: ['#5cb8f8', '#a8e0f8'], peak: '#3878c8', peak2: '#6898d8', rockTop: '#383058', rockFace: '#6858a0', rockLine: '#a898d8', snowCap: '#f8f8f8',
      rim: '#282040', rimL: '#8878c0', abyss: '#58a8e8', abyss2: '#a8d8f8', mist: '#f8f8f8', chasm: '#181028', chasm2: '#382868',
      water: '#2060d8', waterL: '#58b0f8', ford: '#88d8f8', stone: '#b8b8b8', stoneD: '#787878',
      grass: '#18a028', grassL: '#58d838', blade: '#087018',
      wool: '#f8f0d8', woolS: '#c8b888', leg: '#281830', face: '#483058', curl: '#00b8a8', bell: '#f89020',
      coat: '#0090b0', coatD: '#005878', hat: '#f8d048', hatD: '#b88810', skin: '#f8c898', staff: '#885020', lamp: '#f8b030',
      bird: '#181018', birdL: '#f8f0d8', fire: '#f8c030', fire2: '#f85818', log: '#885020', tent: '#c8a868', tentD: '#886830',
      hud: '#181028', hudL: '#f8f0d8', hudM: '#8888a8', ok: '#58d838', warn: '#f8c030', bad: '#f85838', accent: '#f8a030', shadow: 'rgba(0,0,0,.3)',
      marks: ['#f83828', '#2878f8', '#f8b800', '#18b848', '#a848f8', '#f86810', '#00a8b8', '#f848a8', '#5058f8', '#889800']
    }
  };
  // земля по участкам: [основа, пятна, деталь, цветы/акцент, вязкая зона]
  var GROUND = {
    modern: { meadow: ['#86b46c', '#79a861', '#5d8f4c', '#f3e7a6', '#6b8f63'], rock: ['#aaa08b', '#9d937e', '#7f7766', '#c9c0ab', '#8f8a80'],
      valley: ['#74a67c', '#689a70', '#4f8459', '#d9e6f0', '#5b8474'], snow: ['#e7eef3', '#d8e3ec', '#b4c6d6', '#ffffff', '#cbd9e6'],
      ridge: ['#8f929b', '#83868f', '#676a74', '#b9bcc6', '#757985'], summer: ['#90c466', '#83b85a', '#62994a', '#ffe27a', '#72a35c'] },
    retro: { meadow: ['#58b848', '#48a838', '#287828', '#f8f078', '#388858'], rock: ['#b8a878', '#a89868', '#786848', '#d8c898', '#887868'],
      valley: ['#48a868', '#389858', '#187838', '#c8e8f8', '#287868'], snow: ['#e8f0f8', '#c8d8f0', '#98b0d8', '#f8f8f8', '#b0c8e8'],
      ridge: ['#8888a0', '#787890', '#505068', '#b8b8d0', '#686880'], summer: ['#68d040', '#58c030', '#289028', '#f8e040', '#48a048'] }
  };

  var cam = { x: 0, init: false }, off = null, offCtx = null;
  function hsh(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, 6.2832); c.fill(); }
  function line(c, x0, y0, x1, y1) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ---------- Метки-пиктограммы ----------
  function mark(c, m, x, y, r, col) {
    c.save(); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = Math.max(1.4, r * 0.34); c.lineCap = 'round'; c.lineJoin = 'round';
    switch (Lg.MARKS[m]) {
      case 'dot': ell(c, x, y, r * 0.8, r * 0.8); break;
      case 'ring': c.beginPath(); c.arc(x, y, r * 0.75, 0, 6.2832); c.stroke(); break;
      case 'tri': c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath(); c.fill(); break;
      case 'square': c.fillRect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); break;
      case 'diamond': c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); break;
      case 'cross': line(c, x - r * 0.8, y - r * 0.8, x + r * 0.8, y + r * 0.8); line(c, x + r * 0.8, y - r * 0.8, x - r * 0.8, y + r * 0.8); break;
      case 'bar': line(c, x - r, y - r * 0.45, x + r, y - r * 0.45); line(c, x - r, y + r * 0.45, x + r, y + r * 0.45); break;
      case 'moon': c.beginPath(); c.arc(x, y, r * 0.9, 0.9, 5.4); c.arc(x + r * 0.45, y, r * 0.62, 5.0, 1.3, true); c.closePath(); c.fill(); break;
      case 'star': c.beginPath(); for (var i = 0; i < 8; i++) { var a = i * 0.7854 - 1.5708, q = i % 2 ? r * 0.4 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fill(); break;
      default: c.beginPath(); c.moveTo(x - r, y + r * 0.3); c.lineTo(x - r * 0.4, y - r * 0.5); c.lineTo(x + r * 0.2, y + r * 0.4); c.lineTo(x + r, y - r * 0.4); c.stroke();
    }
    c.restore();
  }

  // ---------- Ветроног: шерстяной шар на ходульных ногах, с завитком-вихром и меткой на боку ----------
  function creature(c, cr, x, y, P, t, o) {
    o = o || {};
    var s = (cr.temper === 'lead' ? 1.14 : 0.94 + (cr.id % 4) * 0.04) * (o.scale || 1.22), d = cr.face || 1;
    var sp = Math.sqrt((cr.vx || 0) * (cr.vx || 0) + (cr.vy || 0) * (cr.vy || 0)), moving = sp > 8 && !o.sleep;
    var legL = o.sleep ? 0 : 19 * s, by = y - legL - 8 * s, bob = moving ? Math.sin(cr.ph * 2) * 0.8 : 0;
    if (o.ghost) c.globalAlpha = 0.28;
    c.fillStyle = P.shadow; ell(c, x, y + 1, 12 * s, 3.6 * s);
    if (!o.sleep) {
      c.strokeStyle = P.leg; c.lineWidth = 1.8 * s; c.lineCap = 'round';
      var lx = [-7, -3, 3, 7];
      for (var i = 0; i < 4; i++) { var sw = moving ? Math.sin(cr.ph + (i % 2 ? 3.14 : 0) + (i > 1 ? 0.8 : 0)) * 3.2 * s : 0, k = moving ? Math.max(0, Math.cos(cr.ph + (i % 2 ? 3.14 : 0) + (i > 1 ? 0.8 : 0))) * 2 * s : 0; line(c, x + lx[i] * s * d, by + 4 * s, x + lx[i] * s * d + sw, y - k); }
    }
    by += bob;
    // тело
    c.fillStyle = P.woolS; ell(c, x, by + 1.5 * s, 11.5 * s, 8.5 * s);
    c.fillStyle = P.wool; ell(c, x, by - 0.5 * s, 11.5 * s, 7.6 * s);
    for (var j = 0; j < 5; j++) ell(c, x + (-8 + j * 4) * s, by - 6 * s + Math.abs(j - 2) * 1.3 * s, 3.3 * s, 2.8 * s);
    // голова (при пастьбе и питье опущена)
    var low = (cr.graze || cr.drink) && !o.sleep ? 9 * s + Math.sin(t * 5 + cr.id) * 1.2 : o.sleep ? 5 * s : 0;
    var hx = x + d * 12.5 * s, hy = by - 2 * s + low;
    c.fillStyle = P.face; ell(c, hx, hy, 4.6 * s, 4 * s); ell(c, hx - d * 2.5 * s, hy + 3.5 * s, 1.7 * s, 3.4 * s);
    if (!o.sleep) { c.fillStyle = P.wool; c.fillRect(hx + d * 1.2 * s - 0.8, hy - 1.6 * s, 1.7, 1.7); }
    if (cr.temper === 'lead') { c.fillStyle = P.bell; ell(c, hx - d * 3 * s, hy + 6.5 * s, 2 * s, 2 * s); }
    // завиток-вихор
    c.strokeStyle = P.curl; c.lineWidth = 2 * s; c.lineCap = 'round';
    var qx = x - d * 3 * s, qy = by - 10.5 * s, wv = Math.sin(t * 3 + cr.id * 1.7) * 0.25;
    c.beginPath(); c.moveTo(qx, qy + 3 * s); c.quadraticCurveTo(qx - d * 1.5 * s, qy - 3 * s, qx + d * 2.5 * s, qy - 3.2 * s + wv);
    c.arc(qx + d * 2.5 * s, qy - 0.8 * s + wv, 2.4 * s, -1.5708, d > 0 ? 2.2 : 0.94, d < 0); c.stroke();
    // метка
    mark(c, cr.mark, x - d * 1.5 * s, by + 0.5 * s, 4.2 * s, P.marks[cr.mark % P.marks.length]);
    c.globalAlpha = 1;
  }

  // ---------- Подпасок: соломенная шляпа, стёганая куртка, посох с фонарём ----------
  function hero(c, h, x, y, P, t, retro) {
    c.save(); c.translate(x, y); c.scale(1.22, 1.22); x = 0; y = 0;
    var d = h.fx >= 0 ? 1 : -1, ph = t * (h.run ? 15 : 9), sw = h.moving ? Math.sin(ph) * 3.5 : 0;
    c.fillStyle = P.shadow; ell(c, x, y + 1, 9, 3.2);
    c.strokeStyle = P.coatD; c.lineWidth = 3; c.lineCap = 'round';
    line(c, x - 2.5, y - 10, x - 2.5 + sw, y); line(c, x + 2.5, y - 10, x + 2.5 - sw, y);
    c.fillStyle = P.coat; c.beginPath(); c.moveTo(x - 6.5, y - 9); c.lineTo(x + 6.5, y - 9); c.lineTo(x + 5, y - 23); c.lineTo(x - 5, y - 23); c.closePath(); c.fill();
    c.fillStyle = P.coatD; c.fillRect(x - 6, y - 13, 12, 2);
    c.fillStyle = P.skin; ell(c, x + d * 0.8, y - 27, 4.2, 4.2);
    c.fillStyle = P.hatD; ell(c, x, y - 29.5, 9.5, 3);
    c.fillStyle = P.hat; ell(c, x, y - 30.5, 9.5, 2.6); ell(c, x, y - 33, 4.6, 3.2);
    // посох: в руке, при взмахе — вперёд по направлению
    var k = h.sAnim > 0 ? h.sAnim / 0.4 : 0, sx = x + d * 8 + h.fx * 14 * k, sy = y - 16 + h.fy * 10 * k, tx = sx + d * 2 + h.fx * 12 * k, ty = sy - 24 + 10 * k + h.fy * 8 * k;
    c.strokeStyle = P.staff; c.lineWidth = 2.4; line(c, x + d * 8, y, tx, ty);
    c.beginPath(); c.arc(tx + d * 3, ty, 3, 3.14, d > 0 ? 6.9 : 5.6, d < 0); c.stroke();
    c.fillStyle = P.lamp; c.fillRect(tx + d * 4.5 - 2, ty + 3, 4, 5);
    if (h.wAnim > 0) { c.strokeStyle = P.hudL; c.lineWidth = 1.6; for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(x + d * 6, y - 27, 6 + i * 4 + (0.6 - h.wAnim) * 14, d > 0 ? -0.6 : 2.54, d > 0 ? 0.6 : 3.74); c.stroke(); } }
    c.restore();
  }

  // пиктограмма-пузырёк над существом
  function bubble(c, kind, x, y, P, t) {
    var by = y - 6 + Math.sin(t * 4 + x * 0.1) * 1.2;
    c.fillStyle = kind === 'fear' ? P.bad : P.hudL; rr(c, x - 7, by - 14, 14, 13, 4); c.fill();
    c.beginPath(); c.moveTo(x - 3, by - 2); c.lineTo(x + 3, by - 2); c.lineTo(x, by + 2); c.closePath(); c.fill();
    c.strokeStyle = '#2a2a33'; c.fillStyle = '#2a2a33'; c.lineWidth = 1.7; c.lineCap = 'round';
    if (kind === 'fear') { c.strokeStyle = '#fff'; c.fillStyle = '#fff'; line(c, x, by - 11.5, x, by - 6.5); ell(c, x, by - 3.6, 1, 1); }
    else if (kind === 'stray') { c.beginPath(); c.arc(x, by - 9.5, 2.4, 3.4, 7.6); c.lineTo(x, by - 5.6); c.stroke(); ell(c, x, by - 3.4, 0.9, 0.9); }
    else if (kind === 'balk') { line(c, x - 3, by - 10.5, x + 3, by - 4.5); line(c, x + 3, by - 10.5, x - 3, by - 4.5); }
    else if (kind === 'food') { c.strokeStyle = P.blade; line(c, x - 3, by - 4, x - 4, by - 10); line(c, x, by - 4, x, by - 11.5); line(c, x + 3, by - 4, x + 4, by - 10); }
    else if (kind === 'pep') { c.fillStyle = P.water; c.beginPath(); c.moveTo(x, by - 12); c.quadraticCurveTo(x + 5, by - 5, x, by - 3.6); c.quadraticCurveTo(x - 5, by - 5, x, by - 12); c.fill(); }
  }

  // ---------- Сцена мира ----------
  function scene(c, S, P, G, retro, t, opt) {
    var l = Lg.LEGS[S.lv], cx = cam.x, step = retro ? 12 : 6, x, sx, i;
    var xa = Math.floor(cx / step) * step - step, xb = cx + W + step;
    // небо и дальние горы над стеной
    if (retro) { c.fillStyle = P.sky[0]; c.fillRect(0, 0, W, 40); c.fillStyle = P.sky[1]; c.fillRect(0, 40, W, 60); }
    else { var gr = c.createLinearGradient(0, 0, 0, 110); gr.addColorStop(0, P.sky[0]); gr.addColorStop(1, P.sky[1]); c.fillStyle = gr; c.fillRect(0, 0, W, 110); }
    for (var ly = 0; ly < 2; ly++) {
      c.fillStyle = ly ? P.peak : P.peak2; c.beginPath(); c.moveTo(0, 110);
      for (x = 0; x <= W; x += 24) { var wx = x + cx * (ly ? 0.22 : 0.1); c.lineTo(x, (ly ? 62 : 44) + Math.sin(wx / 97 + ly * 2) * 14 + Math.sin(wx / 41 + S.lv) * 9 + Math.abs(Math.sin(wx / 173 + S.lv * 1.7)) * -22); }
      c.lineTo(W, 110); c.closePath(); c.fill();
    }
    // земля
    c.fillStyle = G[0]; c.fillRect(0, 70, W, H - 70);
    var cell = 46, gx0 = Math.floor(cx / cell) - 1, gx1 = Math.floor((cx + W) / cell) + 1, gxi, gyi, hv;
    for (gxi = gx0; gxi <= gx1; gxi++) for (gyi = 2; gyi < 12; gyi++) {
      hv = hsh(gxi * 7.31 + gyi * 13.7 + S.lv * 101.3); if (hv > 0.62) continue;
      var px = gxi * cell + hsh(gxi + gyi * 3.1) * cell - cx, py = gyi * cell + hsh(gxi * 2.3 + gyi) * cell;
      if (hv < 0.2) { c.fillStyle = G[1]; ell(c, px, py, 26 + hv * 60, 8 + hv * 20); }
      else if (hv < 0.46) {
        if (l.ground === 'rock' || l.ground === 'ridge') { c.fillStyle = G[2]; ell(c, px, py, 5 + hv * 6, 3 + hv * 3); c.fillStyle = G[3]; ell(c, px - 1, py - 1.5, 3 + hv * 3, 1.6); }
        else if (l.ground === 'snow') { c.strokeStyle = G[2]; c.lineWidth = 1.5; c.beginPath(); c.arc(px, py + 8, 14, 3.6, 5.8); c.stroke(); }
        else { c.strokeStyle = G[2]; c.lineWidth = 1.6; c.lineCap = 'round'; line(c, px - 3, py, px - 5, py - 6); line(c, px, py, px, py - 8); line(c, px + 3, py, px + 5, py - 6); }
      } else if (hv < 0.56) { c.fillStyle = l.ground === 'snow' ? G[2] : P.stoneD; ell(c, px, py, 6, 3.6); c.fillStyle = l.ground === 'snow' ? G[3] : P.stone; ell(c, px - 1, py - 1.4, 4.4, 2.2); }
      else if (l.ground !== 'snow' && l.ground !== 'rock') { c.fillStyle = hv < 0.59 ? G[3] : '#fff'; ell(c, px, py, 1.8, 1.8); ell(c, px + 7, py + 4, 1.5, 1.5); ell(c, px - 5, py + 6, 1.5, 1.5); }
    }
    // вязкая нижняя ветка развилки
    var I = l.isl;
    if (I && I.x1 > cx - 40 && I.x0 < cx + W + 40) {
      c.fillStyle = G[4];
      for (x = Math.max(xa, I.x0); x < Math.min(xb, I.x1); x += step) { var a0 = Lg.islAt(l, x + step / 2); if (a0 && a0.b - a0.t > 30) c.fillRect(x - cx, a0.b, step + 1, Lg.botY(l, x) - a0.b); }
      c.strokeStyle = l.ground === 'snow' ? G[3] : G[2]; c.lineWidth = 1.6;
      for (i = Math.floor(Math.max(cx, I.x0) / 34); i * 34 < Math.min(cx + W, I.x1); i++) for (var q = 0; q < 4; q++) {
        var zx = i * 34 + hsh(i * 3.3 + q) * 30, zy = I.yb + 22 + q * 40 + hsh(i + q * 7.7) * 26, za = Lg.islAt(l, zx); if (!za || za.b - za.t < 30 || zy < za.b + 8 || zy > Lg.botY(l, zx) - 6) continue;
        if (l.ground === 'snow') { c.beginPath(); c.arc(zx - cx, zy + 6, 12, 3.5, 5.9); c.stroke(); } else { line(c, zx - cx, zy, zx - cx - 2, zy - 9); line(c, zx - cx + 4, zy, zx - cx + 5, zy - 11); }
      }
    }
    // трава и вода
    l.grass.forEach(function (g, gi) {
      if (g[0] + g[2] < cx - 10 || g[0] - g[2] > cx + W + 10) return;
      c.fillStyle = P.grass; ell(c, g[0] - cx, g[1], g[2], g[2] * 0.86); c.fillStyle = P.grassL; ell(c, g[0] - cx - g[2] * 0.12, g[1] - g[2] * 0.1, g[2] * 0.72, g[2] * 0.58);
      c.strokeStyle = P.blade; c.lineWidth = 1.7; c.lineCap = 'round';
      for (var b = 0; b < g[2] * 0.5; b++) { var ba = hsh(gi * 31 + b * 1.7) * 6.28, br = Math.sqrt(hsh(gi * 17 + b * 2.9)) * g[2] * 0.82, bx = g[0] - cx + Math.cos(ba) * br, bY = g[1] + Math.sin(ba) * br * 0.86, w = Math.sin(t * 1.6 + b) * 1.4; line(c, bx, bY, bx + w, bY - 7); }
    });
    l.water.forEach(function (w) {
      if (w[0] + w[2] < cx - 10 || w[0] - w[2] > cx + W + 10) return;
      c.fillStyle = P.stoneD; ell(c, w[0] - cx, w[1] + 2, w[2] + 5, w[2] * 0.74 + 4); c.fillStyle = P.water; ell(c, w[0] - cx, w[1], w[2], w[2] * 0.72);
      c.strokeStyle = P.waterL; c.lineWidth = 1.6; c.beginPath(); c.ellipse(w[0] - cx, w[1], w[2] * (0.4 + 0.2 * Math.sin(t * 1.3)), w[2] * 0.3, 0, 0, 6.28); c.stroke();
    });
    // реки и броды
    l.rivers.forEach(function (r, ri) {
      if (r.x + r.w < cx - 10 || r.x > cx + W + 10) return;
      c.fillStyle = P.water; c.fillRect(r.x - cx, 70, r.w, H - 70);
      c.fillStyle = P.ford; c.fillRect(r.x - cx, r.f0, r.w, r.f1 - r.f0);
      c.strokeStyle = P.waterL; c.lineWidth = 2; c.lineCap = 'round';
      for (var k = 0; k < 26; k++) { var fx = r.x + hsh(k * 3.7 + ri) * r.w, fy = 80 + ((hsh(k * 9.1 + ri) * 460 + t * (l.rain ? 70 : 48)) % 460); if (fy > r.f0 - 6 && fy < r.f1) continue; line(c, fx - cx, fy, fx - cx + 2, fy + 14); }
      for (k = 0; k < 14; k++) { var sx2 = r.x + 8 + hsh(k * 5.3 + ri * 2) * (r.w - 16), sy2 = r.f0 + 8 + hsh(k * 2.1 + ri) * (r.f1 - r.f0 - 16); c.fillStyle = P.stoneD; ell(c, sx2 - cx, sy2 + 1, 7, 3.6); c.fillStyle = P.stone; ell(c, sx2 - cx, sy2, 6, 2.8); }
      c.strokeStyle = P.stoneD; c.lineWidth = 3; line(c, r.x - cx, 70, r.x - cx, H); line(c, r.x + r.w - cx, 70, r.x + r.w - cx, H);
    });
    // провал развилки
    if (I && I.x1 > cx - 40 && I.x0 < cx + W + 40) {
      for (x = Math.max(xa, I.x0); x < Math.min(xb, I.x1); x += step) {
        var a = Lg.islAt(l, x + step / 2); if (!a || a.b - a.t < 2) continue; sx = x - cx;
        c.fillStyle = P.chasm2; c.fillRect(sx, a.t, step + 1, a.b - a.t); c.fillStyle = P.chasm; c.fillRect(sx, a.t + Math.min(16, (a.b - a.t) * 0.3), step + 1, (a.b - a.t) - Math.min(16, (a.b - a.t) * 0.3));
        c.fillStyle = P.rimL; c.fillRect(sx, a.t - 2, step + 1, 3);
      }
      for (i = Math.floor(Math.max(cx - 30, I.x0) / 26); i * 26 < Math.min(cx + W + 30, I.x1); i++) { var bx2 = i * 26 + 8, ab = Lg.islAt(l, bx2); if (!ab || ab.b - ab.t < 6) continue; c.fillStyle = P.rim; ell(c, bx2 - cx, ab.b + 1, 13 + hsh(i) * 5, 7); c.fillStyle = P.rimL; ell(c, bx2 - cx - 2, ab.b - 2, 8, 3); }
      if (!retro) { c.fillStyle = P.mist; for (i = 0; i < 6; i++) { var mx = I.x0 + 150 + i * (I.x1 - I.x0 - 300) / 5 + Math.sin(t * 0.3 + i) * 30; ell(c, mx - cx, (I.yt + I.yb) / 2 + 14 + Math.sin(i * 2.2) * 20, 70, 13); } }
    }
    // туры-чекпоинты
    l.cps.forEach(function (cpx, ci) {
      if (cpx < cx - 30 || cpx > cx + W + 30) return; var cy = Lg.topY(l, cpx) + 26, lit = ci < S.cpIdx;
      c.fillStyle = P.shadow; ell(c, cpx - cx, cy + 2, 12, 4);
      c.fillStyle = P.stoneD; ell(c, cpx - cx, cy - 3, 10, 5); c.fillStyle = P.stone; ell(c, cpx - cx, cy - 10, 7.5, 4.4); c.fillStyle = P.stoneD; ell(c, cpx - cx, cy - 16, 5, 3.4); c.fillStyle = P.stone; ell(c, cpx - cx, cy - 21, 3, 2.4);
      if (lit) { c.fillStyle = P.lamp; ell(c, cpx - cx, cy - 26, 2.6, 3.4); }
    });
    // верхняя стена: скальная масса и лицевая грань
    for (x = xa; x < xb; x += step) {
      var ty = Lg.topY(l, x + step / 2); sx = x - cx;
      var sil = 74 + Math.sin(x / 83) * 9 + Math.sin(x / 31 + 2) * 5 + Math.sin(x / 13 + 1) * 2.5;
      c.fillStyle = P.rockTop; c.fillRect(sx, sil, step + 1, ty - 34 - sil);
      c.fillStyle = P.snowCap; c.fillRect(sx, sil, step + 1, l.ground === 'snow' ? 16 : 6 + Math.sin(x / 57 + 3) * 3);
      c.fillStyle = P.rockFace; c.fillRect(sx, ty - 34, step + 1, 34);
      c.fillStyle = P.rockLine; c.fillRect(sx, ty - 34, step + 1, 2.5);
      if (hsh(Math.floor(x / step) * 1.37) < 0.18) { c.fillStyle = P.rockTop; c.fillRect(sx + 1, ty - 28 + hsh(x) * 8, 2, 18); }
      c.fillStyle = P.rim; c.fillRect(sx, ty - 2, step + 1, 3);
    }
    // сущности по глубине
    var ents = [];
    S.herd.forEach(function (cr) { if (cr.st === 'ok' && cr.x > cx - 40 && cr.x < cx + W + 40) ents.push({ y: cr.y, cr: cr }); });
    ents.push({ y: S.hero.y, hero: true });
    var camp = l.camp; if (camp[0] > cx - 120 && camp[0] < cx + W + 120) ents.push({ y: camp[1], camp: true });
    ents.sort(function (p, q) { return p.y - q.y; });
    // круг свиста и стрелки посоха — на земле, под сущностями
    var h = S.hero;
    if (h.wAnim > 0) { var wr = (S.lastWhistleR || 320) * (1 - h.wAnim / 0.6); c.strokeStyle = P.hudL; c.globalAlpha = Math.min(1, h.wAnim * 2.2); c.lineWidth = 2.5; c.beginPath(); c.ellipse(h.x - cx, h.y, wr, wr * 0.86, 0, 0, 6.28); c.stroke(); c.globalAlpha = 1; }
    if (h.sAnim > 0) { c.strokeStyle = P.accent; c.lineWidth = 3.5; c.lineCap = 'round'; c.globalAlpha = Math.min(1, h.sAnim * 3); for (i = 1; i <= 3; i++) { var ax = h.x - cx + h.fx * (22 + i * 16 + (0.4 - h.sAnim) * 50), ay = h.y - 8 + h.fy * (22 + i * 16 + (0.4 - h.sAnim) * 50); line(c, ax - h.fx * 7 - h.fy * 7, ay - h.fy * 7 + h.fx * 7, ax, ay); line(c, ax - h.fx * 7 + h.fy * 7, ay - h.fy * 7 - h.fx * 7, ax, ay); } c.globalAlpha = 1; }
    // метки молний
    S.strikes.forEach(function (s) { var k = 1 - s.t / 1.7; c.strokeStyle = P.warn; c.lineWidth = 2; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 22); c.beginPath(); c.ellipse(s.x - cx, s.y, 150 * (1 - k * 0.7), 128 * (1 - k * 0.7), 0, 0, 6.28); c.stroke(); c.beginPath(); c.ellipse(s.x - cx, s.y, 16, 12, 0, 0, 6.28); c.stroke(); c.globalAlpha = 1; });
    // тень птицы и кольцо над жертвой
    var b = S.bird;
    if (b) { c.fillStyle = P.shadow; ell(c, b.x - cx, b.y + (b.ph === 'dive' ? 20 : 70), 18, 6); if (b.ph !== 'away') { var tg = null; S.herd.forEach(function (cr) { if (cr.id === b.id && cr.st === 'ok') tg = cr; }); if (tg) { c.strokeStyle = b.ph === 'dive' ? P.bad : P.warn; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.ellipse(tg.x - cx, tg.y - 2, 24, 12, 0, 0, 6.28); c.stroke(); c.setLineDash([]); } } }
    ents.forEach(function (e) {
      if (e.hero) hero(c, h, h.x - cx, h.y, P, t, retro);
      else if (e.camp) campfire(c, camp[0] - cx, camp[1], P, t, retro, l.last, S);
      else {
        var cr = e.cr, r = Lg.riverAt(l, cr.x), wade = r ? 5 : 0;
        creature(c, cr, cr.x - cx, cr.y + wade, P, t);
        if (r) { c.fillStyle = cr.y >= r.f0 && cr.y <= r.f1 ? P.ford : P.water; c.fillRect(cr.x - cx - 13, cr.y - 3, 26, 9); c.strokeStyle = P.waterL; c.lineWidth = 1.5; c.beginPath(); c.ellipse(cr.x - cx, cr.y - 3, 12, 3, 0, 0, 6.28); c.stroke(); }
        var kind = cr.bolt > 0 || cr.fear > 0.5 ? 'fear' : cr.stray ? 'stray' : cr.balk > 0 ? 'balk' : cr.food < 0.25 && !cr.graze ? 'food' : cr.pep < 0.25 && !cr.drink ? 'pep' : null;
        if (kind) bubble(c, kind, cr.x - cx, cr.y - 54, P, t);
      }
    });
    // нижняя кромка: стена (валуны переднего плана) или обрыв (туман долины)
    for (x = xa; x < xb; x += step) {
      var byy = Lg.botY(l, x + step / 2); sx = x - cx;
      if (Lg.dropAt(l, x + step / 2)) { c.fillStyle = P.rimL; c.fillRect(sx, byy, step + 1, 3); c.fillStyle = P.rim; c.fillRect(sx, byy + 3, step + 1, 15); c.fillStyle = P.abyss; c.fillRect(sx, byy + 18, step + 1, H - byy - 18); c.fillStyle = P.abyss2; c.fillRect(sx, byy + 70 + Math.sin(x / 70) * 12, step + 1, H); }
      else { c.fillStyle = P.rimL; c.fillRect(sx, byy, step + 1, 3); c.fillStyle = P.rim; c.fillRect(sx, byy + 3, step + 1, H - byy); }
    }
    for (i = Math.floor(cx / 44) - 1; i * 44 < cx + W + 44; i++) {
      var ox = i * 44 + hsh(i * 1.9) * 30, oy = Lg.botY(l, ox);
      if (Lg.dropAt(l, ox)) { if (!retro || i % 2) { c.fillStyle = P.mist; ell(c, ox - cx + Math.sin(t * 0.25 + i) * 18, oy + 60 + hsh(i) * 90, 46 + hsh(i * 3) * 30, 9); } }
      else { c.fillStyle = P.rockFace; ell(c, ox - cx, oy + 16 + hsh(i) * 14, 20 + hsh(i * 2.2) * 12, 9); c.fillStyle = P.rockLine; ell(c, ox - cx - 4, oy + 12 + hsh(i) * 14, 10, 3); }
    }
    // птица
    if (b) {
      var fl = Math.sin(t * (b.ph === 'dive' ? 22 : 9)) * (b.ph === 'dive' ? 3 : 9), bx3 = b.x - cx, by3 = b.y - (b.ph === 'dive' ? 6 : 30);
      c.fillStyle = P.bird; c.beginPath(); c.moveTo(bx3, by3 + 5); c.lineTo(bx3 - 26, by3 - 6 - fl); c.lineTo(bx3 - 12, by3 + 2); c.lineTo(bx3, by3 - 4); c.lineTo(bx3 + 12, by3 + 2); c.lineTo(bx3 + 26, by3 - 6 - fl); c.closePath(); c.fill();
      ell(c, bx3, by3 + 2, 5, 8); c.fillStyle = P.birdL; ell(c, bx3, by3 - 5, 3.2, 3.2); c.fillStyle = P.accent; c.fillRect(bx3 - 1, by3 - 3, 2, 3);
    }
    // погода
    var hx = h.x, blz = Lg.zoneK(l.bliz, hx), stm = Lg.zoneK(l.storm, hx);
    if (stm > 0) { c.fillStyle = retro ? 'rgba(16,8,48,' + 0.3 * stm + ')' : 'rgba(30,30,55,' + 0.34 * stm + ')'; c.fillRect(0, 0, W, H); }
    if (l.rain || stm > 0) {
      c.strokeStyle = retro ? P.waterL : 'rgba(210,228,240,.5)'; c.lineWidth = 1.4; var nr = retro ? 50 : 110;
      for (i = 0; i < nr * (l.rain ? 1 : stm); i++) { var rx = (hsh(i * 1.3) * W + t * -140 - cx * 0.6) % W, ry = (hsh(i * 7.7) * H + t * 620) % H; if (rx < 0) rx += W; line(c, rx, ry, rx - 4, ry + 13); }
    }
    if (blz > 0) {
      if (retro) { c.fillStyle = 'rgba(248,248,248,' + 0.22 * blz + ')'; c.fillRect(0, 0, W, H); }
      else { var fg = c.createRadialGradient(h.x - cx, h.y - 10, 60, h.x - cx, h.y - 10, 430); fg.addColorStop(0, 'rgba(240,246,250,' + 0.08 * blz + ')'); fg.addColorStop(1, 'rgba(240,246,250,' + 0.86 * blz + ')'); c.fillStyle = fg; c.fillRect(0, 0, W, H); }
      c.fillStyle = '#fff';
      for (i = 0; i < (retro ? 70 : 170) * blz; i++) { var qx = (hsh(i * 2.1) * W - t * (240 + hsh(i) * 160) - cx) % W, qy = (hsh(i * 5.3) * H + t * (70 + hsh(i * 3) * 60)) % H; if (qx < 0) qx += W; c.fillRect(qx, qy, retro ? 3 : 2 + hsh(i) * 2, retro ? 3 : 1.6); }
    }
    // время суток: рассвет — тёплый, сумерки — лиловый; фонарь посоха светит
    var tod = opt.night ? 0.9 : Lg.todAt(l, hx), tint = null;
    if (tod < 0.12) tint = 'rgba(255,170,130,' + (0.2 * (1 - tod / 0.12)).toFixed(3) + ')';
    else if (tod > 0.42) { var dk = Math.min(1, (tod - 0.42) / 0.26); tint = 'rgba(' + Math.round(255 - 175 * dk) + ',' + Math.round(150 - 90 * dk) + ',' + Math.round(110 + 20 * dk) + ',' + (0.1 + 0.3 * dk).toFixed(3) + ')'; }
    if (tint) {
      c.fillStyle = tint; c.fillRect(0, 0, W, H);
      if (!retro && tod > 0.5) { c.save(); c.globalCompositeOperation = 'lighter'; var lg = c.createRadialGradient(h.x - cx, h.y - 24, 4, h.x - cx, h.y - 24, 150); lg.addColorStop(0, 'rgba(255,190,110,' + (0.4 * Math.min(1, (tod - 0.5) / 0.15)).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,190,110,0)'); c.fillStyle = lg; c.fillRect(h.x - cx - 160, h.y - 180, 320, 320); c.restore(); }
    }
    // вспышка и молния
    if (S.flash > 0) {
      c.fillStyle = 'rgba(255,255,255,' + (S.flash * 0.9).toFixed(3) + ')'; c.fillRect(0, 0, W, H);
      if (S.lastStrike && S.flash > 0.2) { var ls = S.lastStrike; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(ls.x - cx + 40, 0); for (i = 1; i <= 6; i++) c.lineTo(ls.x - cx + (6 - i) * 7 * (i % 2 ? 1 : -0.6), ls.y * i / 6); c.stroke(); }
    }
  }

  // костёр с навесом; на последнем участке — летнее пастбище: изгородь и навес-сенник
  function campfire(c, x, y, P, t, retro, last, S) {
    c.fillStyle = P.shadow; ell(c, x - 64, y + 2, 34, 7);
    c.fillStyle = P.tentD; c.beginPath(); c.moveTo(x - 96, y); c.lineTo(x - 64, y - 46); c.lineTo(x - 30, y); c.closePath(); c.fill();
    c.fillStyle = P.tent; c.beginPath(); c.moveTo(x - 96, y); c.lineTo(x - 64, y - 46); c.lineTo(x - 56, y); c.closePath(); c.fill();
    c.strokeStyle = P.log; c.lineWidth = 2.5; line(c, x - 64, y - 52, x - 64, y - 40);
    if (last) { c.strokeStyle = P.log; c.lineWidth = 3; for (var i = 0; i < 9; i++) { var fx = x + 70 + i * 22; line(c, fx, y - 150 + i * 2, fx, y - 132 + i * 2); line(c, fx, y + 150 - i * 2, fx, y + 132 - i * 2); if (i < 8) { line(c, fx, y - 144 + i * 2, fx + 22, y - 142 + i * 2); line(c, fx, y + 140 - i * 2, fx + 22, y + 138 - i * 2); } } }
    c.fillStyle = P.stoneD; for (var k = 0; k < 7; k++) ell(c, x + Math.cos(k * 0.9) * 13, y + Math.sin(k * 0.9) * 6, 4, 2.6);
    c.strokeStyle = P.log; c.lineWidth = 4; c.lineCap = 'round'; line(c, x - 9, y + 1, x + 9, y - 3); line(c, x - 9, y - 3, x + 9, y + 1);
    var f = Math.sin(t * 11) * 2 + Math.sin(t * 17) * 1.5;
    if (!retro) { c.save(); c.globalCompositeOperation = 'lighter'; var g = c.createRadialGradient(x, y - 8, 2, x, y - 8, 70); g.addColorStop(0, 'rgba(255,170,80,.4)'); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(x - 70, y - 78, 140, 140); c.restore(); }
    c.fillStyle = P.fire2; c.beginPath(); c.moveTo(x - 8, y - 2); c.quadraticCurveTo(x - 9, y - 16, x + f * 0.6, y - 28 - f); c.quadraticCurveTo(x + 9, y - 14, x + 8, y - 2); c.closePath(); c.fill();
    c.fillStyle = P.fire; c.beginPath(); c.moveTo(x - 4.5, y - 2); c.quadraticCurveTo(x - 5, y - 10, x - f * 0.4, y - 17 - f * 0.5); c.quadraticCurveTo(x + 5, y - 9, x + 4.5, y - 2); c.closePath(); c.fill();
    // сколько существ рядом с костром — кружки над огнём
    if (S && S.phase === 'play') {
      var n = 0, near = S.campNear || 0; S.herd.forEach(function (cr) { if (cr.st === 'ok') n++; });
      var hd = Math.hypot(S.hero.x - (x + cam.x), S.hero.y - y);
      if (hd < 330 && n) { for (var q = 0; q < n; q++) { c.fillStyle = q < near ? P.ok : P.hudM; ell(c, x - (n - 1) * 4 + q * 8, y - 62, 2.8, 2.8); } }
    }
  }

  // ---------- HUD (без слов) ----------
  function hud(c, S, P, retro, t) {
    var l = Lg.LEGS[S.lv], i, list = S.herd, h = S.hero;
    c.fillStyle = P.hud; if (retro) c.fillRect(8, 8, 944, 34); else { rr(c, 8, 8, 944, 34, 10); c.fill(); }
    // стадо: метки (ушедшие — пустые, отбившиеся — мигают)
    var gone = {}; S.gone.forEach(function (g) { gone[g.id] = g; });
    for (i = 0; i < S.total; i++) {
      var cr = null; list.forEach(function (q) { if (q.id === i) cr = q; });
      var x = 26 + i * 22, mk = cr ? cr.mark : (gone[i] && gone[i].mark != null ? gone[i].mark : i);
      if (!cr || cr.st !== 'ok') { c.globalAlpha = 0.28; mark(c, mk, x, 25, 6, P.hudM); c.globalAlpha = 1; }
      else { if (cr.stray || cr.bolt > 0) c.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * 6)); mark(c, mk, x, 25, 6.5, P.marks[mk % P.marks.length]); c.globalAlpha = 1; }
    }
    // сытость и бодрость стада (средние; засечка — самый слабый)
    var al = list.filter(function (q) { return q.st === 'ok'; }), n = al.length || 1, f = 0, p = 0, fm = 1, pm = 1;
    al.forEach(function (q) { f += q.food; p += q.pep; fm = Math.min(fm, q.food); pm = Math.min(pm, q.pep); }); f /= n; p /= n;
    function bar(x, v, vm, col, icon) {
      if (icon === 'food') { c.strokeStyle = P.grassL; c.lineWidth = 2; c.lineCap = 'round'; line(c, x - 4, 31, x - 6, 21); line(c, x, 31, x, 18); line(c, x + 4, 31, x + 6, 21); }
      else { c.fillStyle = P.waterL; c.beginPath(); c.moveTo(x, 17); c.quadraticCurveTo(x + 8, 28, x, 32); c.quadraticCurveTo(x - 8, 28, x, 17); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + 12, 20, 90, 10);
      c.fillStyle = v < 0.25 ? P.bad : v < 0.5 ? P.warn : col; c.fillRect(x + 12, 20, 90 * Math.max(0, Math.min(1, v)), 10);
      c.fillStyle = P.hudL; c.fillRect(x + 12 + 90 * Math.max(0, Math.min(1, vm)) - 1, 18, 2, 14);
    }
    bar(262, f, fm, P.ok, 'food'); bar(392, p, pm, P.waterL, 'pep');
    // путь: участки и положение на текущем
    var px = 520, pw = 300; c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(px, 24, pw, 3);
    var seg = pw / Lg.LEGS.length;
    for (i = 0; i <= Lg.LEGS.length; i++) { c.fillStyle = i <= S.lv ? P.accent : P.hudM; if (i < Lg.LEGS.length) { c.beginPath(); c.moveTo(px + i * seg, 30); c.lineTo(px + i * seg + 3.5, 22); c.lineTo(px + i * seg + 7, 30); c.fill(); } else { c.fillStyle = P.ok; ell(c, px + pw, 25, 5, 5); } }
    c.fillStyle = P.accent; c.fillRect(px, 24, (S.lv + h.x / l.len) * seg, 3);
    c.fillStyle = P.hudL; ell(c, px + (S.lv + h.x / l.len) * seg, 25.5, 4, 4);
    // свист и посох: готовность
    function btn(x, ready, kind) {
      c.globalAlpha = ready ? 1 : 0.35; c.strokeStyle = P.hudL; c.fillStyle = P.hudL; c.lineWidth = 2; c.lineCap = 'round';
      if (kind === 'w') { ell(c, x - 5, 25, 3, 3); for (var k = 0; k < 3; k++) { c.beginPath(); c.arc(x - 5, 25, 6 + k * 3.5, -0.7, 0.7); c.stroke(); } }
      else { line(c, x - 6, 33, x + 4, 17); c.beginPath(); c.arc(x + 7, 17, 3, 3.14, 6.9); c.stroke(); }
      c.globalAlpha = 1;
    }
    btn(858, h.wT <= 0, 'w'); btn(900, h.sT <= 0, 's');
    if (h.run) { c.fillStyle = P.accent; c.beginPath(); c.moveTo(924, 19); c.lineTo(933, 25); c.lineTo(924, 31); c.closePath(); c.fill(); c.beginPath(); c.moveTo(932, 19); c.lineTo(941, 25); c.lineTo(932, 31); c.closePath(); c.fill(); }
    // стрелки к тем, кто за краем экрана или отбился
    al.forEach(function (q) {
      var sx = q.x - cam.x; if (sx > 14 && sx < W - 14 && !q.stray) return;
      if (sx > 30 && sx < W - 30) return;
      var ex = sx < W / 2 ? 22 : W - 22, ey = Math.max(70, Math.min(H - 30, q.y - 20)), d = sx < W / 2 ? -1 : 1;
      c.fillStyle = P.hud; ell(c, ex, ey, 14, 14); mark(c, q.mark, ex, ey, 6, P.marks[q.mark % P.marks.length]);
      c.fillStyle = q.stray ? P.warn : P.hudL; c.beginPath(); c.moveTo(ex + d * 20, ey); c.lineTo(ex + d * 13, ey - 6); c.lineTo(ex + d * 13, ey + 6); c.closePath(); c.fill();
    });
  }

  var RD = O.render = {
    PAL: PAL, GROUND: GROUND, mark: mark, creature: creature, hero: hero, campfire: campfire,
    resetCam: function () { cam.init = false; },
    camX: function () { return cam.x; },
    toWorld: function (S, px, py) { return { x: px + cam.x, y: py }; },
    draw: function (ctx, S, g, opt) {
      opt = opt || {};
      var retro = g.themeName === 'retro', P = PAL[retro ? 'retro' : 'modern'], l = Lg.LEGS[S.lv], G = GROUND[retro ? 'retro' : 'modern'][l.ground], t = S.t;
      // камера: между подпаском и стадом, с запасом вперёд
      var cen = S.cen && S.cen.n ? S.cen : S.hero, fx = S.hero.x * 0.6 + Math.max(S.hero.x - 260, Math.min(S.hero.x + 260, cen.x)) * 0.4;
      var tx = Math.max(0, Math.min(l.len - W, fx - W * 0.44));
      if (!cam.init) { cam.x = tx; cam.init = true; } else cam.x += (tx - cam.x) * Math.min(1, (opt.dt || 1 / 60) * 3);
      if (retro) {
        if (!off) { off = document.createElement('canvas'); off.width = W / 2; off.height = H / 2; offCtx = off.getContext('2d'); }
        offCtx.setTransform(0.5, 0, 0, 0.5, 0, 0); scene(offCtx, S, P, G, true, t, opt);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,.13)'; for (var y = 0; y < H; y += 4) ctx.fillRect(0, y + 2, W, 2);
      } else { ctx.imageSmoothingEnabled = true; scene(ctx, S, P, G, false, t, opt); }
      if (!opt.title) hud(ctx, S, P, retro, t);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
