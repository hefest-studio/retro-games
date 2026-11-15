/* ЛЕНТОВОД · js/render.js — рисование (темы modern / retro): поле (кэш в offscreen-canvas), постройки, предметы на лентах,
   Ржавь и клёпаные, трассеры, призрак стройки, HUD, панель построек, мини-карта, подсказки. Логику не меняет. */
(function (root) {
  'use strict';
  var LV = root.LENTOVOD = root.LENTOVOD || {}, SIM = LV.sim, DX = SIM.DX, DY = SIM.DY;
  var LY = { W: 960, H: 540, TOP: 30, BOT: 66, MM: { w: 144, h: 88 } };
  LY.VIEW_H = LY.H - LY.TOP - LY.BOT;
  // Палитры: вересковое оливковое поле, орех лент, медь/латунь станков, белый пар; Ржавь — ржаво-бурая.
  var PAL = {
    modern: {
      bg: '#1d2216', g1: '#55613a', g2: '#5d6a40', g3: '#4c5734', rock: '#776d60', rockHi: '#91877a', rockLo: '#5a5248',
      tree: '#2f4d27', treeHi: '#41693a', trunk: '#5b3b22', cu: '#cf7a3e', cuHi: '#e9a66e', coal: '#2a2829', coalHi: '#4b4748', sand: '#dcc58c', sandHi: '#efe0b4',
      ingot: '#f0a35a', glass: '#a6e0d6', gear: '#cdb46a', belt: '#3b2617', beltRail: '#7b5533', beltMark: '#c99a45',
      wood: '#87603b', woodDk: '#5a3d24', woodHi: '#a57a4e', copper: '#c2703f', copperHi: '#e19a63', brass: '#d8ac4a', brassDk: '#9c7a2e',
      steam: 'rgba(245,242,232,', rust: '#9a4a2b', rustDk: '#61301f', rustHi: '#c06a3d', eye: '#ffcf5a', mech: '#d8ac4a', mechDk: '#8f6f2b', visor: '#a6e0d6',
      ok: 'rgba(120,220,140,', bad: 'rgba(255,90,80,', ink: '#f4ead2', mut: '#b9ab8c', panel: 'rgba(26,22,16,.92)', panelLine: '#5c4a33', accent: '#e7b44c', hp: '#7ed36f', hpBad: '#e8604c',
      font: 'Inter, system-ui, sans-serif', pixel: false, base: 24
    },
    retro: {
      bg: '#000000', g1: '#2e4a10', g2: '#3a5a14', g3: '#24400c', rock: '#7a7a7a', rockHi: '#aaaaaa', rockLo: '#4a4a4a',
      tree: '#0a6a2a', treeHi: '#30a040', trunk: '#6a3a10', cu: '#e06c10', cuHi: '#ffa040', coal: '#202020', coalHi: '#5a5a5a', sand: '#f0d070', sandHi: '#fff0b0',
      ingot: '#ffb030', glass: '#60f0f0', gear: '#f0f060', belt: '#402010', beltRail: '#a05a20', beltMark: '#f0c040',
      wood: '#a05a20', woodDk: '#602a08', woodHi: '#d08030', copper: '#e06c10', copperHi: '#ffa040', brass: '#f0c040', brassDk: '#a07010',
      steam: 'rgba(255,255,255,', rust: '#c03a10', rustDk: '#701808', rustHi: '#ff6a30', eye: '#ffff40', mech: '#f0c040', mechDk: '#a07010', visor: '#60f0f0',
      ok: 'rgba(80,255,80,', bad: 'rgba(255,60,60,', ink: '#fff0d0', mut: '#c0a070', panel: 'rgba(0,0,0,.92)', panelLine: '#a05a20', accent: '#ffb030', hp: '#50ff50', hpBad: '#ff4040',
      font: '"Courier New", ui-monospace, monospace', pixel: true, base: 8
    }
  };
  var ITEM_COL = { cu: 'cu', coal: 'coalHi', sand: 'sand', ingot: 'ingot', glass: 'glass', gear: 'gear' };
  var cache = { key: '', cv: null };
  function resetCache() { cache.key = ''; }

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y) { var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash(xi, yi), b2 = hash(xi + 1, yi), c2 = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b2 - a) * fx + (c2 - a) * fy + (a - b2 - c2 + d) * fx * fy; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, k) { var A = hex(a), B = hex(b); k = Math.max(0, Math.min(1, k)); return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * k); }).join(',') + ')'; }
  // ---------- поле в offscreen-canvas (перерисовка при смене темы/мира) ----------
  function ground(W, th) {
    var P = PAL[th], key = th + ':' + W.w + 'x' + W.h + ':' + (W.seedKey || '');
    if (cache.key === key && cache.cv) return cache.cv;
    var b = P.base, cv = cache.cv || (typeof document !== 'undefined' ? document.createElement('canvas') : null); if (!cv) return null;
    cv.width = W.w * b; cv.height = W.h * b; var c = cv.getContext('2d'), x, y, i;
    for (y = 0; y < W.h; y++) for (x = 0; x < W.w; x++) {
      var r = hash(x, y), n = 0.7 * vnoise(x / 6, y / 6) + 0.3 * vnoise(x / 2.5 + 40, y / 2.5);
      if (th === 'modern') { c.fillStyle = mix(P.g3, P.g2, n * 0.9 + r * 0.1); c.fillRect(x * b, y * b, b, b);
        if (r > 0.6) { var h1 = hash(x * 5 + 3, y * 7 + 1), h2 = hash(x * 11 + 9, y * 3 + 5); c.fillStyle = n > 0.5 ? 'rgba(220,230,150,.12)' : 'rgba(20,30,10,.14)'; c.fillRect(x * b + 2 + h1 * (b - 6), y * b + 2 + h2 * (b - 8), 2, 5); c.fillRect(x * b + 2 + h2 * (b - 6), y * b + 2 + h1 * (b - 8), 2, 4); }
        if (r < 0.06) { c.fillStyle = 'rgba(240,220,140,.35)'; c.fillRect(x * b + 8, y * b + 9, 3, 3); } }
      else { var v = n + (r - 0.5) * 0.12; c.fillStyle = v > 0.56 ? P.g2 : v > 0.4 ? P.g1 : P.g3; c.fillRect(x * b, y * b, b, b);
        if (v > 0.5 && v < 0.6 || v > 0.36 && v < 0.44) { c.fillStyle = v > 0.48 ? P.g1 : P.g3; for (var dy = 0; dy < b; dy += 2) for (var dx = (dy / 2) & 1; dx < b; dx += 2) c.fillRect(x * b + dx, y * b + dy, 1, 1); } }
    }
    for (y = 0; y < W.h; y++) for (x = 0; x < W.w; x++) {
      i = y * W.w + x; var t = W.t[i], o = W.ore[i], X = x * b, Y = y * b; r = hash(x + 91, y + 17);
      if (o) {
        var oc = o === 1 ? [P.cu, P.cuHi] : o === 2 ? [P.coal, P.coalHi] : [P.sand, P.sandHi];
        if (th === 'retro') { c.fillStyle = oc[0]; c.fillRect(X + 1, Y + 1, 3, 3); c.fillRect(X + 4, Y + 4, 3, 3); c.fillStyle = oc[1]; c.fillRect(X + 1, Y + 1, 1, 1); c.fillRect(X + 5, Y + 4, 1, 1); }
        else {
          for (var k = 0; k < 4; k++) { var px = X + 4 + hash(x * 3 + k, y) * (b - 10), py = Y + 4 + hash(x, y * 3 + k) * (b - 10), rr = 2.2 + hash(k, x + y) * 2.6;
            c.fillStyle = oc[0]; c.beginPath(); c.arc(px, py, rr, 0, 7); c.fill(); c.fillStyle = oc[1]; c.beginPath(); c.arc(px - rr * 0.35, py - rr * 0.35, rr * 0.4, 0, 7); c.fill(); }
        }
      } else if (t === SIM.ROCK) {
        if (th === 'retro') { c.fillStyle = P.rockLo; c.fillRect(X, Y, b, b); c.fillStyle = P.rock; c.fillRect(X + 1, Y, b - 2, b - 2); c.fillStyle = P.rockHi; c.fillRect(X + 1, Y, 3, 2); }
        else { c.fillStyle = P.rockLo; c.fillRect(X, Y, b, b); c.fillStyle = P.rock; c.beginPath(); c.moveTo(X + 1, Y + b - 3); c.lineTo(X + 4 + r * 4, Y + 2); c.lineTo(X + b - 3, Y + 4 + r * 3); c.lineTo(X + b - 1, Y + b - 2); c.closePath(); c.fill(); c.fillStyle = P.rockHi; c.fillRect(X + 6 + r * 4, Y + 5, 5, 2); }
      } else if (t === SIM.TREE) {
        if (th === 'retro') { c.fillStyle = P.trunk; c.fillRect(X + 3, Y + 5, 2, 3); c.fillStyle = P.tree; c.fillRect(X + 1, Y + 1, 6, 5); c.fillStyle = P.treeHi; c.fillRect(X + 2, Y + 1, 2, 2); }
        else { c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(X + b / 2 + 2, Y + b - 4, 8, 3, 0, 0, 7); c.fill(); c.fillStyle = P.trunk; c.fillRect(X + b / 2 - 1.5, Y + b / 2, 3, b / 2 - 3);
          c.fillStyle = P.tree; c.beginPath(); c.arc(X + b / 2, Y + b / 2 - 1, 8 + r * 2, 0, 7); c.fill(); c.fillStyle = P.treeHi; c.beginPath(); c.arc(X + b / 2 - 3, Y + b / 2 - 4, 3.5, 0, 7); c.fill(); }
      }
    }
    cache.cv = cv; cache.key = key; return cv;
  }

  // ---------- примитивы ----------
  function rr(c, x, y, w, h, r, P) { if (P.pixel || !c.roundRect) { c.fillRect(x, y, w, h); return; } c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
  function itemShape(c, it, x, y, s, P) {
    c.fillStyle = P[ITEM_COL[it]] || '#fff';
    if (P.pixel) { var q = Math.max(2, Math.round(s * 0.36)); c.fillRect(Math.round(x - q / 2), Math.round(y - q / 2), q, q); return; }
    var r = s * 0.17;
    if (it === 'ingot') { c.beginPath(); c.moveTo(x - r * 1.3, y + r * 0.7); c.lineTo(x - r * 0.8, y - r * 0.7); c.lineTo(x + r * 0.8, y - r * 0.7); c.lineTo(x + r * 1.3, y + r * 0.7); c.closePath(); c.fill(); }
    else if (it === 'glass') { c.beginPath(); c.moveTo(x, y - r * 1.2); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.2); c.lineTo(x - r, y); c.closePath(); c.fill(); }
    else if (it === 'gear') { c.beginPath(); for (var k = 0; k < 12; k++) { var a = k * Math.PI / 6, rad = k & 1 ? r : r * 1.35; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(x, y, r * 0.4, 0, 7); c.fill(); }
    else { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, 7); c.fill(); }
  }
  function arrow(c, cx, cy, d, s, col) {
    c.save(); c.translate(cx, cy); c.rotate(d * Math.PI / 2); c.fillStyle = col; c.beginPath(); c.moveTo(s * 0.32, 0); c.lineTo(s * 0.08, -s * 0.18); c.lineTo(s * 0.08, s * 0.18); c.closePath(); c.fill(); c.restore();
  }
  function steam(c, x, y, s, t, seed, P) {
    for (var k = 0; k < 3; k++) { var ph = (t * 0.7 + k / 3 + seed) % 1; c.fillStyle = P.steam + (0.55 * (1 - ph)).toFixed(2) + ')';
      var r = s * (0.08 + ph * 0.16); if (P.pixel) c.fillRect(Math.round(x - r + ph * s * 0.2), Math.round(y - ph * s * 0.9 - r), Math.ceil(r * 2), Math.ceil(r * 2)); else { c.beginPath(); c.arc(x + ph * s * 0.2, y - ph * s * 0.9, r, 0, 7); c.fill(); } }
  }
  function hpBar(c, x, y, w, f, P) { if (f >= 0.999) return; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x, y, w, 4); c.fillStyle = f > 0.4 ? P.hp : P.hpBad; c.fillRect(x, y, Math.max(1, w * f), 4); }

  // ---------- постройки (c уже в пикселях экрана; x,y — левый верх, s — размер клетки) ----------
  function drawBelt(c, W, b, x, y, s, P, t) {
    var fed = W ? sideFed(W, b) : -1;
    c.save(); c.translate(x + s / 2, y + s / 2); c.rotate(b.dir * Math.PI / 2);
    c.fillStyle = P.belt; c.fillRect(-s / 2, -s * 0.36, s, s * 0.72);
    if (fed >= 0) { var rel = (fed - b.dir + 4) % 4; c.fillRect(-s * 0.36, rel === 1 ? 0 : -s / 2, s * 0.72, s / 2); }
    c.fillStyle = P.beltRail; c.fillRect(-s / 2, -s * 0.4, s, s * 0.08); c.fillRect(-s / 2, s * 0.32, s, s * 0.08);
    c.fillStyle = P.beltMark; var off = ((t * SIM.BELT_V) % 1) * s / 2;
    for (var k = -1; k < 2; k++) { var mx = -s / 2 + off + k * s / 2; if (mx < -s / 2 || mx > s / 2 - s * 0.1) continue; c.fillRect(mx, -s * 0.22, s * 0.07, s * 0.44); }
    c.restore();
  }
  function sideFed(W, b) { // единственный вход сбоку без входа сзади → рисуем поворот
    var back = SIM.bAt(W, b.x - DX[b.dir], b.y - DY[b.dir]);
    if (back && feeds(back, b)) return -1;
    for (var k = 1; k < 4; k += 2) { var d = (b.dir + k) % 4, o = SIM.bAt(W, b.x + DX[d], b.y + DY[d]); if (o && feeds(o, b)) return d; }
    return -1;
  }
  function feeds(o, b) { return (o.type === 'belt' || o.type === 'drill') && o.x + DX[o.dir] === b.x && o.y + DY[o.dir] === b.y; }
  function drawItems(c, b, x, y, s, P) {
    var a = b.items; for (var i = 0; i < a.length; i++) { var p = Math.min(1, a[i].p) - 0.5; itemShape(c, a[i].t, x + s / 2 + DX[b.dir] * p * s, y + s / 2 + DY[b.dir] * p * s, s, P); }
  }
  function frame(c, x, y, w, h, P) { c.fillStyle = P.woodDk; rr(c, x, y, w, h, 3, P); c.fillStyle = P.wood; rr(c, x + 2, y + 2, w - 4, h - 4, 2, P); }
  function drawBld(c, W, b, x, y, s, P, t) {
    var w = b.w * s, h = b.h * s, cx = x + w / 2, cy = y + h / 2, run = b.run;
    switch (b.type) {
      case 'belt': drawBelt(c, W, b, x, y, s, P, t); return;
      case 'drill':
        frame(c, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, P);
        c.save(); c.translate(cx, cy); c.rotate(P.pixel ? 0 : t * 4 + b.x); c.fillStyle = P.copper;
        for (var k = 0; k < 3; k++) { c.rotate(Math.PI * 2 / 3); c.fillRect(-s * 0.06, 0, s * 0.12, s * 0.3); }
        c.fillStyle = P.brass; c.fillRect(-s * 0.11, -s * 0.11, s * 0.22, s * 0.22); c.restore();
        arrow(c, cx + DX[b.dir] * s * 0.22, cy + DY[b.dir] * s * 0.22, b.dir, s, P.beltMark); return;
      case 'splitter': case 'sorter':
        drawBelt(c, null, { dir: b.dir }, x, y, s, P, t);
        c.fillStyle = P.brassDk; rr(c, x + s * 0.16, y + s * 0.16, s * 0.68, s * 0.68, 3, P); c.fillStyle = P.brass; rr(c, x + s * 0.22, y + s * 0.22, s * 0.56, s * 0.56, 2, P);
        if (b.type === 'splitter') { arrow(c, cx, cy, b.dir, s * 0.9, P.woodDk); arrow(c, cx, cy, (b.dir + 1) % 4, s * 0.7, P.woodDk); arrow(c, cx, cy, (b.dir + 3) % 4, s * 0.7, P.woodDk); }
        else { arrow(c, cx, cy, b.dir, s * 0.95, P.woodDk); itemShape(c, b.filter, cx - DX[b.dir] * s * 0.12, cy - DY[b.dir] * s * 0.12, s * 0.9, P); }
        if (b.buf) itemShape(c, b.buf, cx + DX[b.dir] * s * 0.36, cy + DY[b.dir] * s * 0.36, s * 0.8, P);
        return;
      case 'bridge':
        c.save(); c.translate(cx, cy); c.rotate(b.dir * Math.PI / 2);
        c.fillStyle = P.woodDk; c.fillRect(-s * 0.42, -s * 0.36, s * 0.84, s * 0.72); c.fillStyle = P.woodHi;
        for (k = 0; k < 4; k++) c.fillRect(-s * 0.38 + k * s * 0.2, -s * 0.32, s * 0.14, s * 0.64);
        c.fillStyle = P.brass; c.fillRect(-s * 0.42, -s * 0.4, s * 0.84, s * 0.08); c.fillRect(-s * 0.42, s * 0.32, s * 0.84, s * 0.08); c.restore();
        arrow(c, cx, cy, b.dir, s, P.beltMark);
        if (b.q && b.q.length) itemShape(c, b.q[0].t, cx, cy, s * 0.8, P);
        return;
      case 'turret':
        c.fillStyle = P.woodDk; rr(c, x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, 4, P);
        c.fillStyle = P.copper; if (P.pixel) c.fillRect(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6); else { c.beginPath(); c.arc(cx, cy, s * 0.32, 0, 7); c.fill(); }
        c.save(); c.translate(cx, cy); c.rotate(b.ang || -Math.PI / 2); c.fillStyle = P.brass; c.fillRect(0, -s * 0.08, s * 0.5, s * 0.16); c.fillStyle = P.brassDk; c.fillRect(s * 0.4, -s * 0.11, s * 0.1, s * 0.22); c.restore();
        var pips = Math.min(5, Math.ceil(b.shots / 6)); c.fillStyle = P.ingot; for (k = 0; k < pips; k++) c.fillRect(x + s * 0.12 + k * s * 0.15, y + s * 0.84, s * 0.11, s * 0.1);
        if (!b.shots) { c.fillStyle = P.bad + '0.9)'; c.fillRect(x + s * 0.12, y + s * 0.84, s * 0.76, s * 0.08); }
        break;
      case 'wall':
        c.fillStyle = P.woodDk; c.fillRect(x + s * 0.04, y + s * 0.5, s * 0.92, s * 0.14);
        for (k = 0; k < 3; k++) { var sx = x + s * 0.1 + k * s * 0.28; c.fillStyle = P.wood; c.fillRect(sx, y + s * 0.18, s * 0.22, s * 0.74); c.fillStyle = P.woodHi;
          c.beginPath(); c.moveTo(sx, y + s * 0.18); c.lineTo(sx + s * 0.11, y + s * 0.04); c.lineTo(sx + s * 0.22, y + s * 0.18); c.fill(); }
        break;
      case 'hall':
        frame(c, x + s * 0.1, y + s * 0.3, w - s * 0.2, h - s * 0.4, P);
        c.fillStyle = P.copper; c.beginPath(); c.moveTo(x + s * 0.02, y + s * 0.4); c.lineTo(cx, y - s * 0.15); c.lineTo(x + w - s * 0.02, y + s * 0.4); c.closePath(); c.fill();
        c.fillStyle = P.copperHi; c.fillRect(x + s * 0.5, y + s * 0.3, w - s, s * 0.08);
        gearIcon(c, cx, cy + s * 0.25, s * 0.55, P.brass, P.woodDk, P);
        c.fillStyle = P.woodDk; c.fillRect(x + w - s * 0.75, y - s * 0.1, s * 0.3, s * 0.5); steam(c, x + w - s * 0.6, y - s * 0.15, s * 1.4, t, 0.3, P);
        hpBar(c, x, y - s * 0.4, w, b.hp / b.maxhp, P); return;
      case 'mound':
        c.fillStyle = P.rustDk; c.beginPath(); c.moveTo(x - s * 0.1, y + h); c.lineTo(x + s * 0.4, y + s * 0.6); c.lineTo(x + s * 0.9, y + s * 0.2); c.lineTo(cx, y - s * 0.3); c.lineTo(x + w - s * 0.8, y + s * 0.3); c.lineTo(x + w + s * 0.1, y + h); c.closePath(); c.fill();
        c.fillStyle = P.rust; for (k = 0; k < 6; k++) { var px = x + s * 0.3 + hash(k, 3) * (w - s * 0.6), py = y + s * 0.6 + hash(3, k) * (h - s * 1.0); c.fillRect(px, py, s * 0.4, s * 0.22); }
        c.fillStyle = P.rustHi; c.fillRect(cx - s * 0.5, cy, s, s * 0.14);
        var gl = 0.5 + 0.5 * Math.sin(t * 3); c.fillStyle = P.eye; c.globalAlpha = 0.5 + gl * 0.5; c.fillRect(cx - s * 0.25, cy - s * 0.35, s * 0.18, s * 0.18); c.fillRect(cx + s * 0.07, cy - s * 0.35, s * 0.18, s * 0.18); c.globalAlpha = 1;
        hpBar(c, x, y - s * 0.5, w, b.hp / b.maxhp, P); return;
      default: // станки 2×2
        frame(c, x + s * 0.06, y + s * 0.12, w - s * 0.12, h - s * 0.18, P);
        var roof = b.type === 'smelter' ? P.copper : b.type === 'glassworks' ? '#5f8c86' : b.type === 'gearmill' ? P.brassDk : P.copperHi;
        if (P.pixel && b.type === 'glassworks') roof = '#20a0a0';
        c.fillStyle = roof; rr(c, x + s * 0.2, y + s * 0.22, w - s * 0.4, s * 0.5, 3, P);
        var out = SIM.BLD[b.type].recipe.out;
        if (out === 'mech') mechShape(c, cx, cy + s * 0.25, s * 0.9, P, 0); else itemShape(c, out, cx, cy + s * 0.3, s * 2.2, P);
        c.fillStyle = P.woodDk; c.fillRect(x + w - s * 0.55, y - s * 0.12, s * 0.26, s * 0.42);
        if (run) steam(c, x + w - s * 0.42, y - s * 0.16, s * 1.2, t, b.x * 0.13, P);
        if (run) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x + s * 0.2, y + h - s * 0.26, w - s * 0.4, s * 0.1); c.fillStyle = P.accent; c.fillRect(x + s * 0.2, y + h - s * 0.26, (w - s * 0.4) * Math.min(1, b.prog / SIM.BLD[b.type].recipe.time), s * 0.1); }
        if (b.outb) itemShape(c, out === 'mech' ? 'gear' : out, x + s * 0.3, y + h - s * 0.4, s * 0.8, P);
    }
    hpBar(c, x, y - 5, w, b.hp / b.maxhp, P);
  }
  function gearIcon(c, x, y, r, col, hole, P) {
    c.fillStyle = col;
    if (P.pixel) { c.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4); c.fillRect(x - r, y - r * 0.25, r * 2, r * 0.5); c.fillRect(x - r * 0.25, y - r, r * 0.5, r * 2); }
    else { c.beginPath(); for (var k = 0; k < 16; k++) { var a = k * Math.PI / 8, rad = k & 1 ? r * 0.75 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fill(); }
    c.fillStyle = hole; c.fillRect(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.5);
  }
  function mechShape(c, x, y, s, P, a) {
    c.fillStyle = P.mechDk; c.fillRect(x - s * 0.26, y + s * 0.12, s * 0.16, s * 0.18); c.fillRect(x + s * 0.1, y + s * 0.12, s * 0.16, s * 0.18);
    c.fillStyle = P.mech; if (P.pixel) c.fillRect(x - s * 0.28, y - s * 0.28, s * 0.56, s * 0.46); else { c.beginPath(); c.arc(x, y - s * 0.04, s * 0.28, 0, 7); c.fill(); }
    c.fillStyle = P.visor; c.fillRect(x - s * 0.16 + Math.cos(a) * s * 0.05, y - s * 0.16, s * 0.32, s * 0.1);
    c.fillStyle = P.mechDk; c.fillRect(x - s * 0.2, y + s * 0.04, s * 0.06, s * 0.06); c.fillRect(x + s * 0.14, y + s * 0.04, s * 0.06, s * 0.06);
  }
  function foeShape(c, e, x, y, s, P, t) {
    var big = e.kind === 'brute', r = s * (big ? 0.42 : 0.26), wob = Math.sin(t * 12 + x) * s * 0.04;
    c.fillStyle = P.rustDk; for (var k = -1; k <= 1; k++) { c.fillRect(x - r - s * 0.08, y + k * r * 0.6 + wob, s * 0.1, s * 0.06); c.fillRect(x + r - s * 0.02, y + k * r * 0.6 - wob, s * 0.1, s * 0.06); }
    c.fillStyle = P.rust; if (P.pixel) c.fillRect(x - r, y - r, r * 2, r * 2); else { c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, 7); c.fill(); }
    c.fillStyle = P.rustHi; c.fillRect(x - r * 0.6, y - r * 0.5, r * 1.2, r * 0.25); if (big) c.fillRect(x - r * 0.6, y + r * 0.1, r * 1.2, r * 0.22);
    c.fillStyle = P.eye; c.fillRect(x - r * 0.45, y - r * 0.15, r * 0.25, r * 0.25); c.fillRect(x + r * 0.2, y - r * 0.15, r * 0.25, r * 0.25);
    hpBar(c, x - s * 0.4, y - r - 6, s * 0.8, e.hp / e.maxhp, P);
  }
  // Значок постройки для панели (без мира)
  function icon(c, type, x, y, s, P, t) {
    var d = SIM.BLD[type], k = Math.min(1, 1.6 / Math.max(d.w, d.h)), ss = s * k * (d.w > 1 ? 0.62 : 1);
    var fake = { type: type, x: 0, y: 0, w: d.w, h: d.h, dir: 0, hp: 1, maxhp: 1, shots: 12, filter: 'cu', items: [], q: [], ang: -0.6, run: false, prog: 0, outb: 0 };
    drawBld(c, null, fake, x - d.w * ss / 2, y - d.h * ss / 2, ss, P, t || 0);
  }

  // ---------- кадр ----------
  function frameDraw(c, S, g) {
    var W = S.W, th = S.th, P = PAL[th], s = 24 * S.cam.z, t = W.time, x, y, i;
    c.fillStyle = P.bg; c.fillRect(0, 0, LY.W, LY.H);
    c.save(); c.beginPath(); c.rect(0, LY.TOP, LY.W, LY.VIEW_H); c.clip();
    var ox = -S.cam.x, oy = LY.TOP - S.cam.y;
    var gc = ground(W, th); if (gc) { c.imageSmoothingEnabled = !P.pixel; c.drawImage(gc, ox, oy, W.w * s, W.h * s); }
    var x0 = Math.max(0, Math.floor(S.cam.x / s) - 3), y0 = Math.max(0, Math.floor(S.cam.y / s) - 3), x1 = Math.min(W.w, Math.ceil((S.cam.x + LY.W) / s) + 1), y1 = Math.min(W.h, Math.ceil((S.cam.y + LY.VIEW_H) / s) + 1);
    var vis = function (b) { return b.x + b.w >= x0 && b.y + b.h >= y0 && b.x <= x1 && b.y <= y1; };
    // мосты: пунктир к паре
    var B = W.blds;
    for (i = 0; i < B.length; i++) { var b = B[i]; if (!vis(b)) continue; if (b.type === 'belt') drawBelt(c, W, b, ox + b.x * s, oy + b.y * s, s, P, t); }
    for (i = 0; i < B.length; i++) { b = B[i]; if (b.type === 'belt' && vis(b)) drawItems(c, b, ox + b.x * s, oy + b.y * s, s, P); }
    for (i = 0; i < B.length; i++) {
      b = B[i]; if (b.type === 'belt' || !vis(b)) continue;
      if (b.type !== 'wall') { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(ox + b.x * s + s * 0.14, oy + b.y * s + s * 0.18, b.w * s - s * 0.1, b.h * s - s * 0.1); }
      if (b.type === 'turret') { var f = lastShot(W, b); if (f) b.ang = f; }
      drawBld(c, W, b, ox + b.x * s, oy + b.y * s, s, P, t);
      if (b.type === 'bridge') { var pr = SIM.partner(W, b); if (pr) { c.strokeStyle = P.beltMark; c.setLineDash([3, 4]); c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); c.moveTo(ox + (b.x + 0.5) * s, oy + (b.y + 0.5) * s); c.lineTo(ox + (pr.x + 0.5) * s, oy + (pr.y + 0.5) * s); c.stroke(); c.setLineDash([]); } }
    }
    // точка сбора
    if (W.rally) { var rx = ox + W.rally.x * s, ry = oy + W.rally.y * s; c.fillStyle = P.woodDk; c.fillRect(rx - 1, ry - s * 0.8, 2, s * 0.8); c.fillStyle = P.brass; c.fillRect(rx + 1, ry - s * 0.8, s * 0.45, s * 0.28); }
    // существа
    for (i = 0; i < W.units.length; i++) { var u = W.units[i]; mechShape(c, ox + u.x * s, oy + u.y * s, s * 0.9, P, t * 3 + i); hpBar(c, ox + u.x * s - s * 0.35, oy + u.y * s - s * 0.45, s * 0.7, u.hp / u.maxhp, P); }
    for (i = 0; i < W.enemies.length; i++) { var e = W.enemies[i]; foeShape(c, e, ox + e.x * s, oy + e.y * s, s, P, t); }
    // трассеры
    c.lineWidth = Math.max(1, s * 0.08);
    for (i = 0; i < W.fx.length; i++) { var q = W.fx[i]; if (q.k === 'bite') continue; c.strokeStyle = q.k === 'turret' ? P.steam + '0.95)' : q.k === 'mound' ? P.rustHi : P.brass; c.beginPath(); c.moveTo(ox + q.x1 * s, oy + q.y1 * s); c.lineTo(ox + q.x2 * s, oy + q.y2 * s); c.stroke(); }
    // призрак и снос
    if (S.ghost) {
      var G = S.ghost, d = SIM.BLD[G.type];
      c.globalAlpha = 0.6;
      G.cells.forEach(function (gcell) { drawBld(c, W, { type: G.type, x: gcell.x, y: gcell.y, w: d.w, h: d.h, dir: gcell.dir, hp: 1, maxhp: 1, items: [], q: [], shots: 1, filter: S.filter || 'cu', run: false, prog: 0, outb: 0 }, ox + gcell.x * s, oy + gcell.y * s, s, P, t); });
      c.globalAlpha = 1;
      G.cells.forEach(function (gcell) { c.fillStyle = (gcell.ok ? P.ok : P.bad) + '0.28)'; c.fillRect(ox + gcell.x * s, oy + gcell.y * s, d.w * s, d.h * s); c.strokeStyle = (gcell.ok ? P.ok : P.bad) + '0.9)'; c.lineWidth = 1; c.strokeRect(ox + gcell.x * s + 0.5, oy + gcell.y * s + 0.5, d.w * s - 1, d.h * s - 1); });
      if (G.type === 'turret' && G.cells.length === 1) { c.strokeStyle = P.steam + '0.35)'; c.beginPath(); c.arc(ox + (G.cells[0].x + 0.5) * s, oy + (G.cells[0].y + 0.5) * s, d.range * s, 0, 7); c.stroke(); }
    }
    if (S.del) { var r = S.del; c.fillStyle = P.bad + '0.22)'; c.fillRect(ox + r.x0 * s, oy + r.y0 * s, (r.x1 - r.x0 + 1) * s, (r.y1 - r.y0 + 1) * s); c.strokeStyle = P.bad + '0.9)'; c.strokeRect(ox + r.x0 * s + 0.5, oy + r.y0 * s + 0.5, (r.x1 - r.x0 + 1) * s - 1, (r.y1 - r.y0 + 1) * s - 1); }
    if (S.hoverCell && !S.ghost && !S.del) { c.strokeStyle = P.steam + '0.5)'; c.lineWidth = 1; c.strokeRect(ox + S.hoverCell.x * s + 0.5, oy + S.hoverCell.y * s + 0.5, s - 1, s - 1); }
    c.restore();
    hud(c, S, g, P); toolbar(c, S, g, P); minimap(c, S, P); info(c, S, g, P);
  }
  function lastShot(W, b) { for (var i = W.fx.length - 1; i >= 0; i--) { var f = W.fx[i]; if (f.k === 'turret' && Math.abs(f.x1 - b.x - 0.5) < 0.01 && Math.abs(f.y1 - b.y - 0.5) < 0.01) return Math.atan2(f.y2 - f.y1, f.x2 - f.x1); } return null; }

  function txt(c, s, x, y, o, P) { o = o || {}; c.fillStyle = o.color || P.ink; c.font = (o.weight || 700) + ' ' + (o.size || 13) + 'px ' + P.font; c.textAlign = o.align || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y); }
  function fmtT(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  function hud(c, S, g, P) {
    var W = S.W; c.fillStyle = P.panel; c.fillRect(0, 0, LY.W, LY.TOP); c.fillStyle = P.panelLine; c.fillRect(0, LY.TOP - 1, LY.W, 1);
    var x = 92, k = ['ingot', 'glass', 'gear', 'cu', 'coal', 'sand'];
    for (var i = 0; i < k.length; i++) { itemShape(c, k[i], x, 15, i < 3 ? 34 : 26, P); txt(c, String(W.stock[k[i]] | 0), x + 10, 15, { size: i < 3 ? 14 : 12, color: i < 3 ? P.ink : P.mut }, P); x += i < 3 ? 62 : 50; }
    var lbl = g.t('waveIn').replace('{n}', W.wave + 1) + ' ' + fmtT(W.nextWave - W.time);
    txt(c, lbl, 644, 15, { align: 'right', size: 13, color: W.nextWave - W.time < 15 ? P.hpBad : P.accent }, P);
    txt(c, g.t('time') + ' ' + fmtT(W.time), 656, 15, { align: 'left', size: 12, color: P.mut }, P);
    var hall = W.hall, f = hall ? hall.hp / hall.maxhp : 0;
    txt(c, g.t('hall'), 746, 15, { size: 11, color: P.mut }, P);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(826, 10, 40, 10); c.fillStyle = f > 0.4 ? P.hp : P.hpBad; c.fillRect(826, 10, 40 * f, 10);
    mechShape(c, 884, 15, 20, P, 0); txt(c, String(W.units.length), 895, 15, { size: 13 }, P);
    // сообщения
    for (i = 0; i < S.msgs.length; i++) { var m = S.msgs[i]; c.globalAlpha = Math.min(1, m.life); txt(c, m.text, LY.W / 2, LY.TOP + 16 + i * 20, { align: 'center', size: 14, color: m.col === 'bad' ? P.hpBad : m.col === 'good' ? P.hp : P.ink }, P); c.globalAlpha = 1; }
  }
  // кнопки панели
  var TOOLS = SIM.ORDER.concat(['demolish', 'rally', 'charge', 'rotate']);
  var HOT = { drill: '1', belt: '2', splitter: '3', sorter: '4', bridge: '5', smelter: '6', glassworks: '7', gearmill: '8', assembly: '9', turret: 'Q', wall: 'E', demolish: 'X', rally: 'F', charge: 'G', rotate: 'R' };
  function buttons() { var n = TOOLS.length, bw = LY.W / n, out = []; for (var i = 0; i < n; i++) out.push({ id: TOOLS[i], x: i * bw, y: LY.H - LY.BOT, w: bw, h: LY.BOT }); return out; }
  var BTN = buttons();
  function buttonAt(x, y) { if (y < LY.H - LY.BOT) return null; for (var i = 0; i < BTN.length; i++) { var b = BTN[i]; if (x >= b.x && x < b.x + b.w) return b; } return null; }
  function toolbar(c, S, g, P) {
    var y0 = LY.H - LY.BOT; c.fillStyle = P.panel; c.fillRect(0, y0, LY.W, LY.BOT); c.fillStyle = P.panelLine; c.fillRect(0, y0, LY.W, 1);
    for (var i = 0; i < BTN.length; i++) {
      var b = BTN[i], on = S.tool === b.id, hov = S.hoverBtn === b.id, d = SIM.BLD[b.id], can = !d || SIM.afford(S.W, b.id);
      if (on || hov) { c.fillStyle = on ? 'rgba(231,180,76,.25)' : 'rgba(255,255,255,.06)'; c.fillRect(b.x + 2, y0 + 3, b.w - 4, b.h - 6); }
      if (on) { c.fillStyle = P.accent; c.fillRect(b.x + 2, y0 + 3, b.w - 4, 2); }
      c.globalAlpha = can ? 1 : 0.4;
      if (d) icon(c, b.id, b.x + b.w / 2, y0 + 27, 26, P, 0);
      else if (b.id === 'demolish') { c.strokeStyle = P.hpBad; c.lineWidth = 4; c.beginPath(); c.moveTo(b.x + b.w / 2 - 9, y0 + 18); c.lineTo(b.x + b.w / 2 + 9, y0 + 36); c.moveTo(b.x + b.w / 2 + 9, y0 + 18); c.lineTo(b.x + b.w / 2 - 9, y0 + 36); c.stroke(); }
      else if (b.id === 'rally') { c.fillStyle = P.woodHi; c.fillRect(b.x + b.w / 2 - 6, y0 + 14, 3, 26); c.fillStyle = P.brass; c.fillRect(b.x + b.w / 2 - 3, y0 + 14, 14, 9); }
      else if (b.id === 'charge') { mechShape(c, b.x + b.w / 2 - 6, y0 + 28, 24, P, 0); arrow(c, b.x + b.w / 2 + 10, y0 + 27, 0, 30, P.hpBad); }
      else if (b.id === 'rotate') { c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.arc(b.x + b.w / 2, y0 + 27, 9, -2.6, 2.0); c.stroke(); arrow(c, b.x + b.w / 2 - 4, y0 + 36, 2, 22, P.ink); arrow(c, b.x + b.w / 2, y0 + 27, S.dir, 26, P.accent); }
      c.globalAlpha = 1;
      txt(c, HOT[b.id], b.x + 6, y0 + 11, { size: 10, color: P.mut }, P);
      var cost = d && d.cost ? Object.keys(d.cost).map(function (k) { return d.cost[k]; }).join('+') : '';
      if (cost) txt(c, cost, b.x + b.w / 2, y0 + 55, { size: 11, align: 'center', color: can ? P.ink : P.hpBad }, P);
      else txt(c, g.t(b.id), b.x + b.w / 2, y0 + 55, { size: 10, align: 'center', color: P.mut }, P);
    }
    // подсказка над панелью
    var id = S.hoverBtn || S.tool;
    if (id) {
      var dd = SIM.BLD[id], line = g.t(id) + ' — ' + g.t('d_' + id);
      if (dd && dd.cost) line += ' · ' + Object.keys(dd.cost).map(function (k) { return dd.cost[k] + ' ' + g.t(k); }).join(', ');
      c.font = '700 12px ' + P.font; var w = c.measureText(line).width + 20;
      c.fillStyle = P.panel; c.fillRect(LY.W / 2 - w / 2, y0 - 26, w, 22); txt(c, line, LY.W / 2, y0 - 15, { size: 12, align: 'center' }, P);
    }
  }
  function mmRect() { return { x: LY.W - LY.MM.w - 8, y: LY.TOP + 8, w: LY.MM.w, h: LY.MM.h }; }
  function minimap(c, S, P) {
    var W = S.W, R = mmRect(), sx = R.w / W.w, sy = R.h / W.h;
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
    var gc = ground(W, S.th); if (gc) { c.imageSmoothingEnabled = true; c.drawImage(gc, R.x, R.y, R.w, R.h); }
    for (var i = 0; i < W.blds.length; i++) { var b = W.blds[i]; c.fillStyle = b.owner ? P.rustHi : b.type === 'belt' ? P.beltMark : b.type === 'hall' ? P.accent : P.copperHi; c.fillRect(R.x + b.x * sx, R.y + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy)); }
    c.fillStyle = P.hpBad; W.enemies.forEach(function (e) { c.fillRect(R.x + e.x * sx - 1, R.y + e.y * sy - 1, 2, 2); });
    c.fillStyle = P.visor; W.units.forEach(function (u) { c.fillRect(R.x + u.x * sx - 1, R.y + u.y * sy - 1, 2, 2); });
    var s = 24 * S.cam.z; c.strokeStyle = P.ink; c.lineWidth = 1; c.strokeRect(R.x + S.cam.x / s * sx, R.y + S.cam.y / s * sy, LY.W / s * sx, LY.VIEW_H / s * sy);
  }
  function info(c, S, g, P) {
    var b = S.inspect; if (!b || !S.W.byId[b.id]) return;
    var L = [g.t(b.type) + '  ' + g.t('hp').toLowerCase() + ' ' + Math.ceil(b.hp) + '/' + b.maxhp], r = SIM.BLD[b.type].recipe;
    if (r) { L.push(g.t('inputs') + ': ' + Object.keys(r.in).map(function (k) { return g.t(k) + ' ' + (b.inb[k] || 0) + '/' + r.in[k]; }).join(', ')); L.push(g.t('outputs') + ': ' + g.t(r.out) + (b.outb ? ' ×' + b.outb : '')); }
    if (b.type === 'turret') L.push(b.shots + ' ' + g.t('shots'));
    if (b.type === 'sorter') L.push(g.t('msgFilter') + ': ' + g.t(b.filter));
    if (b.type === 'bridge') L.push(SIM.partner(S.W, b) ? g.t('partner') : g.t('noPartner'));
    if (b.type === 'belt') L.push(b.items.length ? b.items.map(function (o) { return g.t(o.t); }).join(', ') : g.t('empty'));
    var R = mmRect(), y = R.y + R.h + 10, w = 260;
    c.fillStyle = P.panel; c.fillRect(LY.W - w - 8, y, w, 10 + L.length * 18); c.fillStyle = P.panelLine; c.fillRect(LY.W - w - 8, y, w, 1);
    L.forEach(function (s, i) { txt(c, s, LY.W - w + 2, y + 14 + i * 18, { size: 12, color: i ? P.mut : P.ink }, P); });
  }

  LV.render = { LAYOUT: LY, PAL: PAL, frame: frameDraw, buttonAt: buttonAt, buttons: BTN, TOOLS: TOOLS, HOT: HOT, mmRect: mmRect, resetCache: resetCache, icon: icon };
})(typeof window !== 'undefined' ? window : globalThis);
