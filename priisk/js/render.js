/* ПРИИСК · js/render.js — рисование: местность (кэш), медь, здания, юниты, эффекты, туман, мини-карта, нижняя панель.
   Две темы: modern (плоская тундра, латунь против сирени) и retro (CGA-дух: жёлтый против пурпурного, дизеринг).
   Только читает мир (PRIISK.logic) и состояние интерфейса из main.js. */
(function (global) {
  'use strict';
  var P = global.PRIISK = global.PRIISK || {};
  var L = P.logic, T = 24;
  var LAYOUT = { W: 960, H: 540, VIEW_H: 428, MM: { x: 8, y: 431, w: 141, h: 106, s: 2.2 }, BTN: { x: 462, y: 432, w: 120, h: 50, gap: 3 } };

  var PAL = {
    modern: {
      g1: '#7a826c', g2: '#777f69', g3: '#7e8670', rock: '#4b4f57', rockHi: '#5f646d', rockLo: '#383b41', water: '#a9c8d8', waterHi: '#d3e6ef',
      oreDirt: '#6e5c45', ore: '#c8763a', oreHi: '#eca664', fog: '#0b0d10', seen: 'rgba(11,13,16,0.52)',
      own: ['#e0a53a', '#9b7bd6'], ownDk: ['#7a5216', '#4b3577'], metal: '#3a3f47', metalHi: '#596170', tread: '#23262b',
      roof: '#5c4a3a', roofHi: '#77624f', wall: '#8c7c68', steam: 'rgba(235,240,245,', glow: '#ff9a3c',
      panel: '#14171d', line: '#2a2f39', ink: '#e9edf2', muted: '#8d96a5', good: '#5fcf80', bad: '#ff6b5e', warn: '#ffb020', sel: '#f2f5f8',
      font: 'Inter, system-ui, sans-serif', pixel: false
    },
    retro: {
      g1: '#2b2a12', g2: '#33311a', g3: '#2b2a12', rock: '#555555', rockHi: '#aaaaaa', rockLo: '#000000', water: '#0055aa', waterHi: '#55ffff',
      oreDirt: '#3a2408', ore: '#aa5500', oreHi: '#ffaa55', fog: '#000000', seen: 'rgba(0,0,0,0.55)',
      own: ['#ffff55', '#ff55ff'], ownDk: ['#aa5500', '#aa00aa'], metal: '#555555', metalHi: '#aaaaaa', tread: '#000000',
      roof: '#aa5500', roofHi: '#ffaa55', wall: '#aaaaaa', steam: 'rgba(255,255,255,', glow: '#ff5555',
      panel: '#000000', line: '#555555', ink: '#ffffff', muted: '#aaaaaa', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', sel: '#ffffff',
      font: '"Courier New", ui-monospace, monospace', pixel: true
    }
  };
  // Снежная земля для миссий в метель (W.ground === 'snow'), лёд и полынья кампании.
  var SNOW = {
    modern: { g1: '#cbd3d9', g2: '#c4cdd4', g3: '#d3dadf', ice: '#dcebf3', iceHi: '#f6fbfe', iceLo: '#a9c3d2', open: '#2c5b76', openHi: '#cfe3ee' },
    retro: { g1: '#aaaaaa', g2: '#9a9a9a', g3: '#aaaaaa', ice: '#55ffff', iceHi: '#ffffff', iceLo: '#0055aa', open: '#0000aa', openHi: '#55ffff' }
  };
  // Подземный жар (миссии 5–6): провал — тёмная яма с отсветом, зыбкий грунт — земля в трещинах
  var HEAT = { modern: { pit: '#1c1512', pitHi: '#ff7a2e', pitLo: '#3a2a22', shaky: '#6f6a5c', crack: '#3b332b' },
    retro: { pit: '#000000', pitHi: '#ff5555', pitLo: '#aa0000', shaky: '#55552a', crack: '#000000' } };
  function groundPal(W, th, pal) { var sn = SNOW[th] || SNOW.modern, ht = HEAT[th] || HEAT.modern; pal = Object.assign({}, pal, ht); return W.ground === 'snow' ? Object.assign({}, pal, { g1: sn.g1, g2: sn.g2, g3: sn.g3, snow: true }, { ice: sn.ice, iceHi: sn.iceHi, iceLo: sn.iceLo, open: sn.open, openHi: sn.openHi }) : Object.assign({}, pal, { ice: sn.ice, iceHi: sn.iceHi, iceLo: sn.iceLo, open: sn.open, openHi: sn.openHi }); }
  function hash(i, j) { var h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }

  var cache = { key: '', cv: null }, mm = { cv: null, t: -1 }, puffs = [];

  function terrainCache(W, th, pal) {
    var key = th + ':' + W.seedKey + ':' + (W.mapRev || 0) + ':' + (W.ground || '');
    pal = groundPal(W, th, pal);
    if (cache.key === key && cache.cv) return cache.cv;
    var cv = document.createElement('canvas'); cv.width = W.w * T; cv.height = W.h * T;
    var c = cv.getContext('2d');
    for (var j = 0; j < W.h; j++) for (var i = 0; i < W.w; i++) {
      var k = j * W.w + i, x = i * T, y = j * T, r = hash(i, j);
      c.fillStyle = r < 0.33 ? pal.g1 : r < 0.66 ? pal.g2 : pal.g3; c.fillRect(x, y, T, T);
      if (pal.pixel) { c.fillStyle = pal.snow ? '#ffffff' : pal.g2; for (var d = 0; d < 6; d++) c.fillRect(x + ((hash(i + d, j) * 6) | 0) * 4, y + ((hash(i, j + d) * 6) | 0) * 4, 2, 2); }
      else if (pal.snow) { if (r > 0.7) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(x + r * T, y + (1 - r) * T * 0.8 + 4, 7, 2.5, -0.3, 0, 7); c.fill(); } else if (r < 0.1) { c.fillStyle = 'rgba(90,100,110,0.18)'; c.fillRect(x + 6, y + 12, 9, 2); } }
      else if (r > 0.82) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.beginPath(); c.arc(x + r * T, y + (1 - r) * T, 2, 0, 7); c.fill(); }
      else if (r < 0.12) { c.strokeStyle = 'rgba(40,50,35,0.22)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 8, y + 15); c.lineTo(x + 6, y + 9); c.moveTo(x + 10, y + 15); c.lineTo(x + 11, y + 8); c.moveTo(x + 12, y + 15); c.lineTo(x + 15, y + 10); c.stroke(); }
    }
    for (j = 0; j < W.h; j++) for (i = 0; i < W.w; i++) {
      k = j * W.w + i; x = i * T; y = j * T; r = hash(i + 7, j + 3);
      if (W.t[k] === L.ROCK) {
        if (pal.pixel) { c.fillStyle = pal.rockLo; c.fillRect(x, y, T, T); c.fillStyle = pal.rock; c.fillRect(x + 2, y + 2, T - 4, T - 4); c.fillStyle = pal.rockHi; c.fillRect(x + 4, y + 4, 8, 4); c.fillRect(x + 4, y + 4, 4, 8); }
        else {
          c.fillStyle = pal.rockLo; roundRect(c, x - 1, y + 1, T + 2, T, 5); c.fill();
          c.fillStyle = pal.rock; roundRect(c, x, y - 1, T, T - 2, 5); c.fill();
          c.fillStyle = pal.rockHi; c.beginPath(); c.moveTo(x + 4, y + 4 + r * 4); c.lineTo(x + 12 + r * 6, y + 3); c.lineTo(x + 17, y + 9); c.lineTo(x + 8, y + 12); c.fill();
        }
      } else if (W.t[k] === L.ICE) {
        c.fillStyle = pal.ice; c.fillRect(x, y, T, T);
        c.fillStyle = pal.iceHi; c.fillRect(x + 3 + r * 6, y + 4, 8, 2); c.fillRect(x + 10, y + 14 + r * 4, 9, 2);
        c.strokeStyle = pal.iceLo; c.lineWidth = 1; c.beginPath(); c.moveTo(x + r * T, y + T); c.lineTo(x + T * 0.45, y + T * 0.5); c.lineTo(x + T * 0.7, y); c.stroke();
      } else if (W.t[k] === L.OPEN) {
        c.fillStyle = pal.open; c.fillRect(x, y, T, T);
        c.fillStyle = pal.openHi; if (r > 0.45) { if (pal.pixel) c.fillRect(x + 6, y + 8, 8, 4); else { c.beginPath(); c.moveTo(x + 5, y + 9); c.lineTo(x + 14, y + 6); c.lineTo(x + 17, y + 12); c.lineTo(x + 8, y + 14); c.fill(); } }
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 2, y + 19); c.lineTo(x + 10, y + 18); c.stroke();
      } else if (W.t[k] === L.BRIDGE) { // мост: настил из досок над тёмной водой, перила по краям
        c.fillStyle = pal.open; c.fillRect(x, y, T, T);
        var vert = j > 0 && j < W.h - 1 && W.t[k - W.w] !== L.WATER && W.t[k + W.w] !== L.WATER && (W.t[k - 1] === L.WATER || W.t[k + 1] === L.WATER || W.t[k - 1] === L.OPEN || W.t[k + 1] === L.OPEN);
        for (var pk = 0; pk < 4; pk++) { c.fillStyle = pk % 2 ? pal.roof : pal.roofHi; if (vert) c.fillRect(x + 2, y + pk * 6, T - 4, 5); else c.fillRect(x + pk * 6, y + 2, 5, T - 4); }
        c.fillStyle = pal.rockLo; if (vert) { c.fillRect(x, y, 2, T); c.fillRect(x + T - 2, y, 2, T); } else { c.fillRect(x, y, T, 2); c.fillRect(x, y + T - 2, T, 2); }
      } else if (W.t[k] === L.PIT) { // провал: яма, раскалённые края
        c.fillStyle = pal.pitLo; c.fillRect(x, y, T, T); c.fillStyle = pal.pit; if (pal.pixel) c.fillRect(x + 2, y + 2, T - 4, T - 4); else { roundRect(c, x + 2, y + 2, T - 4, T - 4, 6); c.fill(); }
        c.fillStyle = pal.pitHi; c.globalAlpha = 0.55; c.fillRect(x + 5 + r * 8, y + 9 + r * 5, 4, 2); c.fillRect(x + 12, y + 15 - r * 6, 3, 2); c.globalAlpha = 1;
      } else if (W.t[k] === L.SHAKY) { // зыбкий грунт: темнее, с трещинами
        c.fillStyle = pal.shaky; c.globalAlpha = 0.55; c.fillRect(x, y, T, T); c.globalAlpha = 1;
        c.strokeStyle = pal.crack; c.lineWidth = pal.pixel ? 2 : 1.3; c.beginPath(); c.moveTo(x + r * 10, y + 2); c.lineTo(x + 9 + r * 4, y + 11); c.lineTo(x + 6, y + 21); c.moveTo(x + 9 + r * 4, y + 11); c.lineTo(x + 20, y + 14 + r * 5); c.stroke();
      } else if (W.t[k] === L.WATER) {
        c.fillStyle = pal.water; c.fillRect(x, y, T, T);
        c.strokeStyle = pal.waterHi; c.lineWidth = pal.pixel ? 2 : 1; c.beginPath(); c.moveTo(x + r * T, y); c.lineTo(x + T * 0.5, y + T * 0.6); c.lineTo(x + T, y + r * T); c.stroke();
      }
    }
    cache.key = key; cache.cv = cv; return cv;
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function drawOre(c, W, pal, i0, j0, i1, j1) {
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var k = j * W.w + i, a = W.ore[k]; if (!a) continue;
      var x = i * T, y = j * T, n = a > 360 ? 4 : a > 200 ? 3 : a > 80 ? 2 : 1;
      c.fillStyle = pal.oreDirt; if (pal.pixel) c.fillRect(x + 1, y + 1, T - 2, T - 2); else { roundRect(c, x + 1, y + 1, T - 2, T - 2, 6); c.fill(); }
      for (var m = 0; m < n; m++) {
        var hx = x + 4 + hash(i * 3 + m, j) * 13, hy = y + 4 + hash(i, j * 3 + m) * 13, s = 3 + hash(i + m, j + m) * 2.5;
        if (pal.pixel) { c.fillStyle = pal.ore; c.fillRect(hx | 0, hy | 0, 5, 4); c.fillStyle = pal.oreHi; c.fillRect(hx | 0, hy | 0, 2, 2); }
        else { c.fillStyle = pal.ore; c.beginPath(); c.moveTo(hx - s, hy); c.lineTo(hx - s * 0.3, hy - s); c.lineTo(hx + s, hy - s * 0.4); c.lineTo(hx + s * 0.6, hy + s * 0.8); c.lineTo(hx - s * 0.5, hy + s * 0.7); c.fill(); c.fillStyle = pal.oreHi; c.fillRect(hx - 1, hy - s * 0.6, 2, 2); }
      }
    }
  }

  // ---------- здания ----------
  function drawBld(c, b, pal, now, ghost) {
    var x = b.tx * T, y = b.ty * T, w = b.w * T, h = b.h * T, own = pal.own[b.owner], dk = pal.ownDk[b.owner], px = pal.pixel;
    function box(xx, yy, ww, hh, col, rad) { c.fillStyle = col; if (px || !rad) c.fillRect(xx, yy, ww, hh); else { roundRect(c, xx, yy, ww, hh, rad); c.fill(); } }
    box(x + 2, y + 3, w - 3, h - 3, 'rgba(0,0,0,0.28)', 4); // тень
    if (b.type === 'hq') {
      box(x + 2, y + 2, w - 5, h - 5, pal.wall, 4);
      box(x + 5, y + 5, w - 11, h - 22, pal.roof, 3);                      // двускатная крыша сверху
      c.fillStyle = pal.roofHi; c.fillRect(x + 5, y + 5 + (h - 22) / 2 - 1, w - 11, 3);
      for (var l = 0; l < 4; l++) { c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x + 8 + l * 15, y + 6, 2, h - 24); }
      box(x + w / 2 - 7, y + h - 18, 14, 13, dk, 2);                        // крыльцо
      c.fillStyle = own; c.fillRect(x + w - 15, y + 4, 3, 22); c.fillRect(x + w - 12, y + 4, 9, 7); // флажок артели
      c.strokeStyle = own; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, w - 7, h - 7);
    } else if (b.type === 'boiler') {
      box(x + 2, y + 2, w - 5, h - 5, pal.metal, 4);
      c.fillStyle = pal.metalHi; c.beginPath(); c.arc(x + w * 0.42, y + h * 0.55, 13, 0, 7); c.fill();       // котёл
      c.fillStyle = pal.metal; c.beginPath(); c.arc(x + w * 0.42, y + h * 0.55, 8, 0, 7); c.fill();
      c.fillStyle = pal.glow; c.fillRect(x + w * 0.42 - 3, y + h * 0.55 - 2, 6, 4);
      box(x + w - 15, y + 5, 9, 9, pal.rockLo, 2);                                                            // труба
      c.fillStyle = own; c.fillRect(x + 4, y + h - 9, w - 9, 4);
      if (!ghost && hash(b.id, (now * 3) | 0) < 0.5) puff(b.tx + b.w - 0.45, b.ty + 0.4, 0.9);
    } else if (b.type === 'bunk') {
      box(x + 2, y + 4, w - 5, h - 9, pal.wall, 3);
      box(x + 4, y + 6, w - 9, h - 15, pal.roof, 2);
      for (var s = 0; s < 4; s++) { c.fillStyle = pal.roofHi; c.fillRect(x + 6 + s * 10, y + 7, 3, h - 17); }
      box(x + w / 2 - 6, y + h - 10, 12, 6, dk, 1);
      c.fillStyle = own; c.fillRect(x + 4, y + 4, w - 9, 3);
    } else if (b.type === 'smelter') {
      box(x + 2, y + 2, w - 5, h - 6, pal.metal, 4);
      box(x + 8, y + 7, 22, 22, pal.rockLo, 3);                                                                // горн
      c.fillStyle = pal.glow; c.globalAlpha = 0.6 + 0.4 * Math.sin(now * 5 + b.id); c.fillRect(x + 13, y + 12, 12, 12); c.globalAlpha = 1;
      box(x + 36, y + 6, 30, 10, pal.metalHi, 2); box(x + 36, y + 20, 30, 10, pal.metalHi, 2);                 // слитки
      c.fillStyle = pal.ore; c.fillRect(x + 40, y + 9, 22, 4); c.fillRect(x + 40, y + 23, 22, 4);
      c.fillStyle = own; c.fillRect(x + 4, y + h - 8, w - 9, 3);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + T + 2, y + h - 2, T - 4, T - 6);                          // площадка разгрузки
      c.strokeStyle = own; c.lineWidth = 1; c.setLineDash([3, 3]); c.strokeRect(x + T + 2.5, y + h - 1.5, T - 5, T - 7); c.setLineDash([]);
    } else if (b.type === 'palisade') { // частокол: заострённые брёвна
      for (var pz = 0; pz < 4; pz++) { var lx = x + 2 + pz * 5; c.fillStyle = pz % 2 ? pal.roof : pal.roofHi; c.fillRect(lx, y + 6, 5, h - 8); c.beginPath(); c.moveTo(lx, y + 6); c.lineTo(lx + 2.5, y + 1); c.lineTo(lx + 5, y + 6); c.fill(); }
      c.fillStyle = dk; c.fillRect(x + 1, y + h - 9, w - 2, 3); c.fillStyle = own; c.fillRect(x + 1, y + h - 4, w - 2, 2);
    } else if (b.type === 'tower') { // вышка: четыре опоры, площадка, стрелок под навесом
      c.strokeStyle = pal.roofHi; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 6, y + h - 3); c.lineTo(x + 14, y + 14); c.moveTo(x + w - 6, y + h - 3); c.lineTo(x + w - 14, y + 14); c.moveTo(x + 6, y + 6); c.lineTo(x + w - 6, y + h - 6); c.moveTo(x + w - 6, y + 6); c.lineTo(x + 6, y + h - 6); c.stroke();
      box(x + 9, y + 9, w - 18, h - 18, pal.roof, 3); box(x + 12, y + 12, w - 24, h - 24, pal.wall, 2);
      var ta = b.aim == null ? -Math.PI / 2 : b.aim, tcx = x + w / 2, tcy = y + h / 2;
      c.strokeStyle = pal.tread; c.lineWidth = 2; c.beginPath(); c.moveTo(tcx, tcy); c.lineTo(tcx + Math.cos(ta) * 13, tcy + Math.sin(ta) * 13); c.stroke();
      if (!ghost && now - (b.fireT || -9) < 0.08) { c.fillStyle = pal.glow; c.fillRect(tcx + Math.cos(ta) * 14 - 2, tcy + Math.sin(ta) * 14 - 2, 4, 4); }
      c.fillStyle = own; c.beginPath(); c.arc(tcx, tcy, 4, 0, 7); c.fill();
      c.fillStyle = own; c.fillRect(x + 3, y + 3, 4, 4); c.fillRect(x + w - 7, y + 3, 4, 4);
    } else if (b.type === 'rig') { // буровая вышка: решётчатая мачта, качалка, бочки с медью
      box(x + 3, y + h - 12, w - 6, 9, pal.metal, 2);
      c.strokeStyle = pal.metalHi; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 8, y + h - 10); c.lineTo(x + w / 2, y + 3); c.lineTo(x + w - 8, y + h - 10);
      c.moveTo(x + 12, y + h - 20); c.lineTo(x + w - 12, y + h - 20); c.moveTo(x + 16, y + 16); c.lineTo(x + w - 16, y + 16); c.stroke();
      var pa = ghost || b.dry || b.setup > 0 ? 0 : Math.sin(now * 4 + b.id) * 0.35;                         // качалка
      c.save(); c.translate(x + w / 2, y + 12); c.rotate(pa); c.fillStyle = own; c.fillRect(-15, -2, 30, 4); c.fillStyle = dk; c.fillRect(-17, -4, 5, 8); c.restore();
      c.fillStyle = pal.ore; c.fillRect(x + 5, y + h - 9, 6, 5); c.fillRect(x + w - 11, y + h - 9, 6, 5);
      c.fillStyle = own; c.fillRect(x + w / 2 - 2, y + 1, 4, 4);
      if (!ghost && !b.dry && !(b.setup > 0) && hash(b.id, (now * 4) | 0) < 0.45) puff(b.tx + b.w / 2 + 0.3, b.ty + 0.3, 0.8);
    } else if (b.type === 'works') {
      box(x + 2, y + 2, w - 5, h - 5, pal.metal, 5);
      box(x + 6, y + 6, w - 13, h - 26, pal.metalHi, 3);
      gear(c, x + w / 2, y + h / 2 - 8, 11, own, pal.metal, now * 0.6);
      box(x + w / 2 - 14, y + h - 20, 28, 15, pal.tread, 2);                                                   // ворота
      for (var z = 0; z < 4; z++) { c.fillStyle = dk; c.fillRect(x + w / 2 - 12 + z * 7, y + h - 18, 4, 11); }
      box(x + 6, y + 6, 8, 8, pal.rockLo, 2);
      if (!ghost && hash(b.id, (now * 2.5) | 0) < 0.4) puff(b.tx + 0.42, b.ty + 0.4, 0.7);
    }
    if (!ghost && (b.repair || now - (b.fixT || -9) < 0.3)) sparks(c, x + w / 2, y + h / 2, now, pal); // идёт ремонт
    if (!ghost && b.setup > 0) { // сборка после переноса: здание не работает — полоска и пунктир
      c.strokeStyle = pal.warn; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.lineDashOffset = -now * 12; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); c.setLineDash([]); c.lineDashOffset = 0;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x + 4, y + h / 2 - 3, w - 8, 6); c.fillStyle = pal.warn; c.fillRect(x + 5, y + h / 2 - 2, (w - 10) * (1 - b.setup / L.SETUP), 4);
    }
    if (!ghost && b.shaky) { var sh = Math.sin(now * 23 + b.id) > 0.6 ? 1 : 0; c.strokeStyle = pal.bad; c.globalAlpha = 0.5 + 0.3 * sh; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 4, y + h - 4); c.lineTo(x + w * 0.35, y + h * 0.55); c.lineTo(x + w * 0.5, y + h - 6); c.lineTo(x + w * 0.7, y + h * 0.5); c.stroke(); c.globalAlpha = 1; }
  }
  // искры ремонта (гаечный ключ мигает над целью)
  function sparks(c, x, y, now, pal) {
    c.save(); c.translate(x, y - 6); c.rotate(Math.sin(now * 9) * 0.5);
    c.strokeStyle = '#000'; c.lineWidth = 4; c.beginPath(); c.moveTo(-5, 5); c.lineTo(4, -4); c.stroke();
    c.strokeStyle = pal.good; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, 5); c.lineTo(4, -4); c.stroke(); c.beginPath(); c.arc(5, -5, 3, 0.6, 5.6); c.stroke();
    c.restore();
    for (var q = 0; q < 3; q++) { var a = now * 11 + q * 2.1; c.fillStyle = q % 2 ? pal.warn : pal.oreHi; c.fillRect(x + Math.cos(a) * 9 - 1, y + Math.sin(a) * 6 - 1, 2, 2); }
  }
  function gear(c, x, y, r, col, hole, rot) {
    c.fillStyle = col; c.beginPath();
    for (var k = 0; k < 16; k++) { var a = rot + k / 16 * Math.PI * 2, rr = k % 2 ? r : r * 0.72; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.fill(); c.fillStyle = hole; c.beginPath(); c.arc(x, y, r * 0.32, 0, 7); c.fill();
  }

  // ---------- юниты ----------
  function drawUnit(c, u, pal, now) {
    var x = u.x * T, y = u.y * T, own = pal.own[u.owner], dk = pal.ownDk[u.owner], px = pal.pixel;
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(1.5, 2.5, L.UNITS[u.type].r * T, L.UNITS[u.type].r * T * 0.7, 0, 0, 7); c.fill();
    if (u.type === 'sava') { // механик: ящик с инструментом за спиной, ключ в руке
      var sd = L.HEROES.sava;
      if (u.abOn > 0 && u.id) { c.strokeStyle = pal.good; c.globalAlpha = 0.3 + 0.25 * Math.sin(now * 8); c.lineWidth = 2; c.setLineDash([3, 4]); c.beginPath(); c.arc(0, 0, sd.r * T, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
      c.rotate(u.heading);
      c.fillStyle = pal.metalHi; c.fillRect(2, -1.2, 9, 2.4); c.fillStyle = pal.metal; c.fillRect(9, -3, 4, 6);  // ключ
      if (now - u.fireT < 0.08) { c.fillStyle = pal.glow; c.fillRect(12, -2, 4, 4); }
      c.fillStyle = dk; c.beginPath(); c.arc(0, 0, 6.6, 0, 7); c.fill();
      c.fillStyle = own; c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fill();
      c.fillStyle = pal.metal; c.fillRect(-7, -4.5, 4.5, 9);                                          // ящик с инструментом
      c.fillStyle = pal.tread; c.beginPath(); c.arc(1, 0, 2.6, 0, 7); c.fill();                        // кожаный шлем
      c.fillStyle = pal.waterHi; c.fillRect(2.4, -2, 1.6, 1.6); c.fillRect(2.4, 0.6, 1.6, 1.6);       // очки
      c.rotate(-u.heading);
      c.fillStyle = own; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -18); c.lineTo(4, -14); c.lineTo(0, -10); c.lineTo(-4, -14); c.closePath(); c.fill(); c.stroke();
    } else if (u.type === 'tractor' || u.type === 'wagon') {
      var tr = u.type === 'tractor', TL = tr ? 12 : 10, TW = tr ? 8 : 7.5;
      c.rotate(u.heading);
      c.fillStyle = pal.tread; c.fillRect(-TL + 2, -TW - 1.5, 6, 3); c.fillRect(TL - 8, -TW - 1.5, 6, 3); c.fillRect(-TL + 2, TW - 1.5, 6, 3); c.fillRect(TL - 8, TW - 1.5, 6, 3); // колёса
      c.fillStyle = dk; if (px) c.fillRect(-TL, -TW, TL * 2, TW * 2); else { roundRect(c, -TL, -TW, TL * 2, TW * 2, 3); c.fill(); }
      if (tr) {
        c.fillStyle = pal.metal; c.fillRect(-TL + 2, -TW + 2, TL * 2 - 9, TW * 2 - 4);                 // котёл
        c.fillStyle = own; c.fillRect(TL - 7, -TW + 2, 5, TW * 2 - 4);                                   // будка
        c.fillStyle = pal.rockLo; c.beginPath(); c.arc(-1, 0, 3, 0, 7); c.fill();                          // труба
        c.fillStyle = pal.glow; c.fillRect(-TL + 3, -1.5, 2, 3);
        if (u.path && u.path.length && hash(u.id, (now * 5) | 0) < 0.5) puff(u.x - Math.cos(u.heading) * 0.05, u.y - Math.sin(u.heading) * 0.05, 0.8);
      } else {
        c.fillStyle = own; c.fillRect(-TL + 1.5, -TW + 1.5, TL * 2 - 3, 2); c.fillRect(-TL + 1.5, TW - 3.5, TL * 2 - 3, 2);
        c.fillStyle = pal.wall; c.fillRect(-TL + 2, -TW + 3.5, TL * 2 - 4, TW * 2 - 7);                // брезент
        c.fillStyle = 'rgba(0,0,0,0.18)'; for (var rb = -TL + 5; rb < TL - 2; rb += 5) c.fillRect(rb, -TW + 3.5, 1.5, TW * 2 - 7);
        c.fillStyle = pal.tread; c.fillRect(TL, -1, 3, 2);                                               // сцепка
      }
    } else if (u.type === 'varvara' || u.type === 'lunya') {
      var hv = u.type === 'varvara', hd = L.HEROES[u.type];
      if (hv && u.abOn > 0 && u.id) { c.strokeStyle = own; c.globalAlpha = 0.35 + 0.25 * Math.sin(now * 8); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, hd.aura * 1.6 * T, 0, 7); c.stroke(); c.globalAlpha = 1; }
      else if (hv && u.owner === 0 && u.id) { c.strokeStyle = own; c.globalAlpha = 0.16; c.lineWidth = 1; c.setLineDash([4, 6]); c.beginPath(); c.arc(0, 0, hd.aura * T, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
      c.rotate(u.heading);
      if (hv) { c.fillStyle = pal.tread; c.fillRect(2, -1.5, 10, 3); }                       // короткий карабин
      else { c.fillStyle = pal.metalHi; c.fillRect(2, -1, 13, 2); c.fillStyle = pal.tread; c.fillRect(12, -1.5, 3, 3); } // подзорная труба
      if (now - u.fireT < 0.08) { c.fillStyle = pal.glow; c.fillRect(12, -2, 4, 4); }
      c.fillStyle = dk; c.beginPath(); c.arc(0, 0, hv ? 7.5 : 6, 0, 7); c.fill();
      c.fillStyle = own; c.beginPath(); c.arc(0, 0, hv ? 6 : 4.6, 0, 7); c.fill();
      if (hv) { c.fillStyle = pal.roof; c.fillRect(-6, -6.5, 3.5, 13); }                  // бригадирский тулуп
      else { c.fillStyle = pal.sel; c.beginPath(); c.arc(-1.5, 0, 3.2, 0, 7); c.fill(); c.fillStyle = dk; c.fillRect(-6, -1, 3, 2); } // светлый капюшон
      c.fillStyle = hv ? pal.oreHi : pal.waterHi; c.beginPath(); c.arc(1.2, 0, 2.2, 0, 7); c.fill();
      c.rotate(-u.heading);
      // ромб героя над головой (не вращается)
      c.fillStyle = own; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -18); c.lineTo(4, -14); c.lineTo(0, -10); c.lineTo(-4, -14); c.closePath(); c.fill(); c.stroke();
    } else if (u.type === 'sapper') { // подрывник: сумка с зарядом за спиной
      c.rotate(u.heading);
      c.fillStyle = dk; c.beginPath(); c.arc(0, 0, 5.6, 0, 7); c.fill();
      c.fillStyle = own; c.beginPath(); c.arc(0, 0, 4.2, 0, 7); c.fill();
      c.fillStyle = pal.roof; c.fillRect(-7.5, -3.5, 4.5, 7); c.fillStyle = pal.bad; c.fillRect(-7, -1, 3, 2);         // сумка с зарядом
      c.fillStyle = pal.tread; c.beginPath(); c.arc(1, 0, 2.4, 0, 7); c.fill();                                         // каска
      if (u.order && u.order.t === 'plant' && u.order.p > 0) { c.fillStyle = pal.warn; c.fillRect(5, -1.5 + Math.sin(now * 20) * 1.5, 3, 3); }
    } else if (u.type === 'drill' || u.type === 'van') {
      var dr = u.type === 'drill', DL = 11, DW = 8;
      c.rotate(u.heading);
      c.fillStyle = pal.tread; c.fillRect(-DL, -DW - 2, DL * 2, 4); c.fillRect(-DL, DW - 2, DL * 2, 4);
      c.fillStyle = dk; if (px) c.fillRect(-DL + 1, -DW + 1, DL * 2 - 2, DW * 2 - 2); else { roundRect(c, -DL + 1, -DW + 1, DL * 2 - 2, DW * 2 - 2, 3); c.fill(); }
      if (dr) { // бур: сложенная мачта вдоль корпуса и коронка спереди
        c.fillStyle = own; c.fillRect(-DL + 3, -DW + 3, DL * 2 - 8, DW * 2 - 6);
        c.strokeStyle = pal.metalHi; c.lineWidth = 2; c.beginPath(); c.moveTo(-DL + 2, -3); c.lineTo(DL - 2, -3); c.moveTo(-DL + 2, 3); c.lineTo(DL - 2, 3); c.stroke();
        c.save(); c.translate(DL + 2, 0); c.rotate(now * (u.path && u.path.length ? 9 : 2)); c.fillStyle = pal.metalHi; c.beginPath(); for (var dk2 = 0; dk2 < 6; dk2++) { var aa = dk2 / 6 * Math.PI * 2; c.lineTo(Math.cos(aa) * (dk2 % 2 ? 2 : 4), Math.sin(aa) * (dk2 % 2 ? 2 : 4)); } c.fill(); c.restore();
      } else { // фургон: брезент и знак свёрнутого здания
        c.fillStyle = pal.wall; c.fillRect(-DL + 2.5, -DW + 2.5, DL * 2 - 5, DW * 2 - 5);
        c.fillStyle = own; c.fillRect(-DL + 2.5, -DW + 2.5, DL * 2 - 5, 2); c.fillRect(-DL + 2.5, DW - 4.5, DL * 2 - 5, 2);
        c.fillStyle = pal.roof; c.beginPath(); c.moveTo(-5, 3); c.lineTo(0, -3.5); c.lineTo(5, 3); c.closePath(); c.fill();
      }
      if (u.path && u.path.length && hash(u.id, (now * 4) | 0) < 0.3) puff(u.x - Math.cos(u.heading) * 0.4, u.y - Math.sin(u.heading) * 0.4, 0.5);
    } else if (u.type === 'rifleman') {
      c.rotate(u.heading);
      c.fillStyle = pal.tread; c.fillRect(2, -1, 9, 2);                         // винтовка
      if (now - u.fireT < 0.08) { c.fillStyle = pal.glow; c.fillRect(11, -2, 4, 4); }
      c.fillStyle = dk; c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill();           // плечи
      c.fillStyle = own; c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.fill();
      c.fillStyle = dk; c.fillRect(-4, -5.5, 3, 11);                            // скатка за спиной
      c.fillStyle = pal.wall; c.beginPath(); c.arc(1, 0, 2.6, 0, 7); c.fill();   // шапка-ушанка сверху
    } else {
      var big = u.type === 'ironwagon', hl = u.type === 'hauler', L2 = big ? 12 : hl ? 12 : 10, W2 = big ? 9 : hl ? 8.5 : 7;
      c.rotate(u.heading);
      c.fillStyle = pal.tread; c.fillRect(-L2, -W2 - 2, L2 * 2, 4); c.fillRect(-L2, W2 - 2, L2 * 2, 4);  // гусеницы
      var tk = ((now * 8 + u.id) | 0) % 2; c.fillStyle = pal.metal; for (var s = -L2 + tk * 3; s < L2; s += 6) { c.fillRect(s, -W2 - 2, 2, 4); c.fillRect(s, W2 - 2, 2, 4); }
      c.fillStyle = dk; if (px) c.fillRect(-L2 + 1, -W2 + 1, L2 * 2 - 2, W2 * 2 - 2); else { roundRect(c, -L2 + 1, -W2 + 1, L2 * 2 - 2, W2 * 2 - 2, 3); c.fill(); }
      c.fillStyle = own; c.fillRect(-L2 + 3, -W2 + 3, L2 * 2 - 6, W2 * 2 - 6);
      if (hl) {
        c.fillStyle = pal.metal; c.fillRect(-L2 + 3, -W2 + 3, 10, W2 * 2 - 6);                           // кузов
        c.fillStyle = pal.ore; var f = Math.min(1, u.carry / (P.S && P.S.W && P.S.W.haulCap || L.UNITS.hauler.cap)); if (f > 0) c.fillRect(-L2 + 4, -W2 + 4, 8, (W2 * 2 - 8) * f);
        c.fillStyle = pal.metalHi; c.fillRect(L2 - 3, -W2 + 1, 5, W2 * 2 - 2);                         // ковш
        if (u.order.s === 'dig') { c.fillStyle = pal.oreHi; c.fillRect(L2 + 1, -3 + Math.sin(now * 12) * 3, 3, 3); }
        c.fillStyle = pal.rockLo; c.beginPath(); c.arc(2, -W2 + 5, 2.5, 0, 7); c.fill();               // труба
      } else {
        c.fillStyle = pal.rockLo; c.beginPath(); c.arc(-L2 + 5, W2 - 5, 2.2, 0, 7); c.fill();         // труба котла
        c.rotate(u.aim - u.heading);
        var recoil = now - u.fireT < 0.12 ? -2 : 0;
        c.fillStyle = pal.metal;
        if (big) { c.fillRect(2 + recoil, -3.5, 15, 2.5); c.fillRect(2 + recoil, 1, 15, 2.5); } else c.fillRect(2 + recoil, -1.5, 13, 3);
        if (now - u.fireT < 0.07) { c.fillStyle = pal.glow; c.beginPath(); c.arc(big ? 18 : 16, 0, 3.5, 0, 7); c.fill(); }
        c.fillStyle = dk; c.beginPath(); c.arc(0, 0, big ? 6.5 : 5, 0, 7); c.fill();
        c.fillStyle = pal.metalHi; c.beginPath(); c.arc(-1, -1, big ? 3 : 2.2, 0, 7); c.fill();
      }
      if (u.path.length && hash(u.id, (now * 4) | 0) < 0.35) puff(u.x - Math.cos(u.heading) * 0.35, u.y - Math.sin(u.heading) * 0.35, 0.5);
    }
    c.restore();
    if (u.id && now - (u.fixT || -9) < 0.3) sparks(c, x, y, now, pal);
    if (u.vet && !L.HEROES[u.type]) { c.strokeStyle = pal.oreHi; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 3.5, y - 10); c.lineTo(x, y - 13); c.lineTo(x + 3.5, y - 10); c.stroke(); } // звание ветерана
  }
  function puff(x, y, s) { if (puffs.length < 160) puffs.push({ x: x, y: y, s: s, life: 1.4, vx: (Math.random() - 0.5) * 0.3, vy: -0.35 - Math.random() * 0.2 }); }
  function drawPuffs(c, pal, dt) {
    for (var n = puffs.length - 1; n >= 0; n--) {
      var p = puffs[n]; p.life -= dt; if (p.life <= 0) { puffs.splice(n, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; var r = (1.6 - p.life) * 6 * p.s + 2;
      c.fillStyle = pal.steam + (0.4 * p.life / 1.4).toFixed(3) + ')';
      if (pal.pixel) c.fillRect((p.x * T - r / 2) | 0, (p.y * T - r / 2) | 0, r | 0, r | 0); else { c.beginPath(); c.arc(p.x * T, p.y * T, r, 0, 7); c.fill(); }
    }
  }
  function hpBar(c, x, y, w, f, pal) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - 1, y - 1, w + 2, 5);
    c.fillStyle = f > 0.6 ? pal.good : f > 0.3 ? pal.warn : pal.bad; c.fillRect(x, y, Math.max(1, w * f), 3);
  }
  function brackets(c, x, y, w, h, col) {
    var k = Math.min(7, w / 3); c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath();
    c.moveTo(x, y + k); c.lineTo(x, y); c.lineTo(x + k, y); c.moveTo(x + w - k, y); c.lineTo(x + w, y); c.lineTo(x + w, y + k);
    c.moveTo(x + w, y + h - k); c.lineTo(x + w, y + h); c.lineTo(x + w - k, y + h); c.moveTo(x + k, y + h); c.lineTo(x, y + h); c.lineTo(x, y + h - k); c.stroke();
  }

  // ---------- кадр ----------
  // S — состояние интерфейса из main.js: { W, cam, sel:Set, hover, placing:{type,tx,ty,ok}, box, marks, msgs, th, t(), mouse }
  function frame(c, S, dt) {
    var W = S.W, pal = PAL[S.th] || PAL.modern, cam = S.cam, VH = LAYOUT.VIEW_H, now = W.time;
    c.save(); c.beginPath(); c.rect(0, 0, LAYOUT.W, VH); c.clip();
    c.fillStyle = pal.fog; c.fillRect(0, 0, LAYOUT.W, VH);
    c.translate(-Math.round(cam.x), -Math.round(cam.y));
    var i0 = Math.max(0, Math.floor(cam.x / T)), j0 = Math.max(0, Math.floor(cam.y / T)), i1 = Math.min(W.w - 1, Math.floor((cam.x + LAYOUT.W) / T)), j1 = Math.min(W.h - 1, Math.floor((cam.y + VH) / T));
    c.drawImage(terrainCache(W, S.th, pal), i0 * T, j0 * T, (i1 - i0 + 1) * T, (j1 - j0 + 1) * T, i0 * T, j0 * T, (i1 - i0 + 1) * T, (j1 - j0 + 1) * T);
    drawOre(c, W, pal, i0, j0, i1, j1);
    // точки сбора выбранного здания
    S.sel.forEach(function (id) { var b = W.byId[id]; if (b && b.kind === 'bld' && b.rally && b.owner === 0) { var cx = (b.tx + b.w / 2) * T, cy = (b.ty + b.h) * T; c.strokeStyle = pal.own[0]; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(b.rally.x * T, b.rally.y * T); c.stroke(); c.setLineDash([]); c.fillStyle = pal.own[0]; c.fillRect(b.rally.x * T - 1, b.rally.y * T - 12, 2, 12); c.fillRect(b.rally.x * T, b.rally.y * T - 12, 7, 5); } });
    W.blds.forEach(function (b) { if (b.tx + b.w < i0 || b.tx > i1 + 1 || b.ty + b.h < j0 || b.ty > j1 + 1) return; if (L.visibleTo0(W, b)) drawBld(c, b, pal, now); });
    // приказы: метки клика
    S.marks.forEach(function (m) { var k = m.life / 0.6, col = m.kind === 'attack' ? pal.bad : m.kind === 'harvest' || m.kind === 'return' ? pal.oreHi : pal.good; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(m.x * T, m.y * T, 4 + (1 - k) * 10, 0, 7); c.globalAlpha = k; c.stroke(); c.globalAlpha = 1; });
    W.units.forEach(function (u) { if (u.x < i0 - 1 || u.x > i1 + 2 || u.y < j0 - 1 || u.y > j1 + 2) return; if (L.visibleTo0(W, u)) drawUnit(c, u, pal, now); });
    // заряды подрывников: мигающий ящик, таймер, полоса обезвреживания
    (W.charges || []).forEach(function (ch) {
      var vis = W.vis[Math.floor(ch.y) * W.w + Math.floor(ch.x)] === 2 || ch.owner === 0; if (!vis) return;
      var blink = Math.sin(now * (ch.t < 3 ? 22 : 9)) > 0;
      c.fillStyle = '#000'; c.fillRect(ch.x * T - 6, ch.y * T - 5, 12, 10); c.fillStyle = blink ? pal.bad : pal.roof; c.fillRect(ch.x * T - 5, ch.y * T - 4, 10, 8);
      txt(c, String(Math.ceil(ch.t)), ch.x * T, ch.y * T - 9, { color: pal.warn, font: pal.font, size: 12, weight: 900, align: 'center' });
      if (ch.def > 0) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(ch.x * T - 12, ch.y * T + 7, 24, 4); c.fillStyle = pal.good; c.fillRect(ch.x * T - 11, ch.y * T + 8, 22 * Math.min(1, ch.def / L.CHARGE.defuse), 2); }
    });
    // эффекты выстрелов и взрывов
    W.fx.forEach(function (f) {
      var k = f.life / f.max;
      if (f.t === 'tracer') { c.strokeStyle = pal.oreHi; c.lineWidth = 1; c.globalAlpha = k; c.beginPath(); c.moveTo(f.x0 * T, f.y0 * T); c.lineTo(f.x * T, f.y * T); c.stroke(); c.globalAlpha = 1; }
      else if (f.t === 'shell') { var tt = 1 - k, sx = f.x0 + (f.x - f.x0) * tt, sy = f.y0 + (f.y - f.y0) * tt; c.fillStyle = pal.glow; c.fillRect(sx * T - 2, sy * T - 2, 4, 4); if (k < 0.25) { c.fillStyle = pal.steam + '0.6)'; c.beginPath(); c.arc(f.x * T, f.y * T, 7, 0, 7); c.fill(); } }
      else if (f.t === 'boom') { var r = (f.big ? 26 : 12) * (1.2 - k); c.fillStyle = pal.glow; c.globalAlpha = k; c.beginPath(); c.arc(f.x * T, f.y * T, r, 0, 7); c.fill(); c.fillStyle = pal.steam + '0.7)'; c.beginPath(); c.arc(f.x * T + 3, f.y * T - 4, r * 0.7, 0, 7); c.fill(); c.globalAlpha = 1; if (k > 0.9) for (var q = 0; q < (f.big ? 4 : 1); q++) puff(f.x + (Math.random() - 0.5), f.y + (Math.random() - 0.5), 1.2); }
    });
    drawPuffs(c, pal, dt);
    // выделение и полоски
    function mark(e, col) {
      if (!e || !L.visibleTo0(W, e)) return;
      if (e.kind === 'unit') { var r = L.UNITS[e.type].r * T + 3; brackets(c, e.x * T - r, e.y * T - r, r * 2, r * 2, col); hpBar(c, e.x * T - r, e.y * T - r - 6, r * 2, e.hp / e.maxHp, pal); }
      else { brackets(c, e.tx * T - 1, e.ty * T - 1, e.w * T + 2, e.h * T + 2, col); hpBar(c, e.tx * T + 4, e.ty * T - 7, e.w * T - 8, e.hp / e.maxHp, pal); }
    }
    S.sel.forEach(function (id) { var e = W.byId[id]; mark(e, e && e.owner === 0 ? pal.sel : pal.bad); });
    if (S.hover && !S.sel.has(S.hover.id)) mark(S.hover, S.hover.owner === 0 ? 'rgba(255,255,255,0.45)' : pal.bad);
    W.units.forEach(function (u) { if (u.owner === 0 && u.hp < u.maxHp && !S.sel.has(u.id) && W.time - u.hitT < 3) { var r = L.UNITS[u.type].r * T + 3; hpBar(c, u.x * T - r, u.y * T - r - 6, r * 2, u.hp / u.maxHp, pal); } });
    // туман
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var v = W.vis[j * W.w + i];
      if (v === 0) { c.fillStyle = pal.fog; c.fillRect(i * T, j * T, T, T); }
      else if (v === 1) {
        if (pal.pixel) { c.fillStyle = '#000'; for (var dy = 0; dy < T; dy += 4) for (var dx = (dy / 4) % 2 * 2; dx < T; dx += 4) c.fillRect(i * T + dx, j * T + dy, 2, 2); }
        else { c.fillStyle = pal.seen; c.fillRect(i * T, j * T, T, T); }
      }
    }
    if (S.worldOverlay) S.worldOverlay(c, pal, now);
    // призрак здания
    if (S.placing) {
      var pb = { tx: S.placing.tx, ty: S.placing.ty, w: L.BLDS[S.placing.type].w, h: L.BLDS[S.placing.type].h, type: S.placing.type, owner: 0, id: 0 };
      c.globalAlpha = 0.55; drawBld(c, pb, pal, now, true); c.globalAlpha = 1;
      for (var gj = 0; gj < pb.h; gj++) for (var gi = 0; gi < pb.w; gi++) {
        var ok = S.placing.cells ? S.placing.cells[gj * pb.w + gi] : S.placing.ok;
        c.fillStyle = ok ? 'rgba(95,207,128,0.35)' : 'rgba(255,90,80,0.45)'; c.fillRect((pb.tx + gi) * T + 1, (pb.ty + gj) * T + 1, T - 2, T - 2);
      }
      c.strokeStyle = S.placing.ok ? pal.good : pal.bad; c.lineWidth = 2; c.strokeRect(pb.tx * T, pb.ty * T, pb.w * T, pb.h * T);
    }
    c.restore();
    if (S.viewOverlay) { c.save(); c.beginPath(); c.rect(0, 0, LAYOUT.W, VH); c.clip(); S.viewOverlay(c, pal, now); c.restore(); }
    // рамка выделения
    if (S.box) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(S.box.x0, S.box.y0, S.box.x1 - S.box.x0, S.box.y1 - S.box.y0); c.strokeStyle = pal.sel; c.lineWidth = 1; c.strokeRect(S.box.x0 + 0.5, S.box.y0 + 0.5, S.box.x1 - S.box.x0, S.box.y1 - S.box.y0); }
    drawTopHud(c, S, pal);
    drawGroups(c, S, pal);
    drawPanel(c, S, pal);
    if (S.hudOverlay) S.hudOverlay(c, pal, now);
  }

  function txt(c, s, x, y, o) { o = o || {}; c.fillStyle = o.color; c.font = (o.weight || 700) + ' ' + (o.size || 13) + 'px ' + o.font; c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'alphabetic'; c.fillText(s, x, y); }
  function drawTopHud(c, S, pal) {
    var W = S.W, t = S.t, f = pal.font;
    var mins = Math.floor(W.time / 60), secs = Math.floor(W.time % 60);
    txt(c, (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs, LAYOUT.W - 58, 20, { color: pal.ink, font: f, size: 14, align: 'right' });
    // сообщения
    var y = S.msgY || 44; S.msgs.forEach(function (m) {
      var a = Math.min(1, m.life); c.globalAlpha = a; c.font = '700 14px ' + f; var w = c.measureText(m.text).width + 20;
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(LAYOUT.W / 2 - w / 2, y - 16, w, 22);
      txt(c, m.text, LAYOUT.W / 2, y, { color: m.col ? pal[m.col] : pal.ink, font: f, size: 14, align: 'center' }); c.globalAlpha = 1; y += 26;
    });
    var tip = S.placing ? t('tipPlace') : S.panelHover ? t('tipPanel') : (S.sel.size ? t('tipCmd') : '');
    if (tip) { c.font = '600 12px ' + f; var tw = c.measureText(tip).width + 16; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(8, LAYOUT.VIEW_H - 24, tw, 18); txt(c, tip, 16, LAYOUT.VIEW_H - 11, { color: pal.muted, font: f, size: 12, weight: 600 }); }
  }

  // ---------- мини-карта ----------
  // масштаб мини-карты под размер карты (скирмиш 64×48 — 2.2 px на клетку; карты миссий могут быть другими)
  function fitMinimap(W) { var M = LAYOUT.MM; M.s = Math.min(2.2, M.w / W.w, M.h / W.h); return M; }
  function drawMinimap(c, S, pal) {
    var W = S.W, M = fitMinimap(W);
    if (!mm.cv) { mm.cv = document.createElement('canvas'); mm.cv.width = W.w; mm.cv.height = W.h; }
    if (mm.cv.width !== W.w || mm.cv.height !== W.h) { mm.cv.width = W.w; mm.cv.height = W.h; mm.t = -1; }
    if (W.time - mm.t > 0.4 || W.time < mm.t || mm.th !== S.th || mm.rev !== W.seedKey + W.mapRev) {
      mm.rev = W.seedKey + W.mapRev;
      mm.t = W.time; mm.th = S.th; var mc = mm.cv.getContext('2d'), img = mc.createImageData(W.w, W.h), d = img.data;
      var col = function (h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; };
      var gp = groundPal(W, S.th, pal), cg = col(gp.g1), cr = col(pal.rock), cw = col(pal.water), co = col(pal.ore), ci = col(gp.ice), cop = col(gp.open), cbr = col(pal.roofHi), cpit = col(gp.pitHi), csh = col(gp.shaky);
      for (var k = 0; k < W.w * W.h; k++) {
        var tk = W.t[k], v = W.vis[k], cc = tk === L.ROCK ? cr : tk === L.WATER ? cw : tk === L.ICE ? ci : tk === L.OPEN ? cop : tk === L.BRIDGE ? cbr : tk === L.PIT ? cpit : W.ore[k] ? co : tk === L.SHAKY ? csh : cg, m = v === 0 ? 0 : v === 1 ? 0.55 : 1;
        if (v === 0) { d[k * 4] = 26; d[k * 4 + 1] = 29; d[k * 4 + 2] = 34; } else { d[k * 4] = cc[0] * m; d[k * 4 + 1] = cc[1] * m; d[k * 4 + 2] = cc[2] * m; } d[k * 4 + 3] = 255;
      }
      mc.putImageData(img, 0, 0);
    }
    c.fillStyle = '#000'; c.fillRect(M.x - 1, M.y - 1, M.w + 2, M.h + 2);
    c.imageSmoothingEnabled = false; c.drawImage(mm.cv, M.x, M.y, W.w * M.s, W.h * M.s); c.imageSmoothingEnabled = !pal.pixel;
    W.blds.forEach(function (b) { if (!L.visibleTo0(W, b)) return; c.fillStyle = pal.own[b.owner]; c.fillRect(M.x + b.tx * M.s, M.y + b.ty * M.s, b.w * M.s, b.h * M.s); });
    W.units.forEach(function (u) { if (!L.visibleTo0(W, u)) return; c.fillStyle = S.sel.has(u.id) ? pal.sel : pal.own[u.owner]; c.fillRect(M.x + u.x * M.s - 1, M.y + u.y * M.s - 1, 2.5, 2.5); });
    c.strokeStyle = pal.sel; c.lineWidth = 1;
    c.strokeRect(M.x + S.cam.x / T * M.s + 0.5, M.y + S.cam.y / T * M.s + 0.5, LAYOUT.W / T * M.s, LAYOUT.VIEW_H / T * M.s);
  }

  // ---------- нижняя панель ----------
  // Кнопки панели: ряд зданий и ряд юнитов. По умолчанию — скирмиш (4 + 4); миссия может задать свой набор (setButtons),
  // например без Плавильни, но с укреплениями. Ширина кнопок подстраивается под число колонок (до 6).
  function buttons(bl, ul) {
    var B = LAYOUT.BTN, out = [], cols = Math.max(4, bl.length, ul.length), span = LAYOUT.W - 6 - B.x, w = Math.floor((span - (cols - 1) * B.gap) / cols);
    bl.forEach(function (k, n) { out.push({ kind: 'bld', type: k, x: B.x + n * (w + B.gap), y: B.y, w: w, h: B.h }); });
    ul.forEach(function (k, n) { out.push({ kind: 'unit', type: k, x: B.x + n * (w + B.gap), y: B.y + B.h + B.gap, w: w, h: B.h }); });
    return out;
  }
  var BTNS = buttons(L.BUILD_LIST, L.UNIT_LIST);
  function setButtons(bl, ul) { var nb = buttons(bl || L.BUILD_LIST, ul || L.UNIT_LIST); BTNS.length = 0; nb.forEach(function (b) { BTNS.push(b); }); return BTNS; }
  // Кнопки групп 1…9 — полоска сверху справа, левее часов (слева вверху — ссылка «← Каталог»):
  // клик — выбрать, Ctrl+клик / ПКМ / долгий тап — назначить
  var GRP = { x: 548, y: 4, w: 30, h: 20, gap: 3 };
  function groupRect(n) { return { x: GRP.x + (n - 1) * (GRP.w + GRP.gap), y: GRP.y, w: GRP.w, h: GRP.h, n: n }; }
  function groupAt(x, y) { for (var n = 1; n <= 9; n++) { var r = groupRect(n); if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return n; } return 0; }
  function drawGroups(c, S, pal) {
    var W = S.W, gr = S.groups || {}, f = pal.font;
    for (var n = 1; n <= 9; n++) {
      var r = groupRect(n), ids = (gr[n] || []).filter(function (id) { return W.byId[id]; }), on = ids.length > 0, act = on && ids.every(function (id) { return S.sel.has(id); });
      c.fillStyle = act ? pal.ownDk[0] : on ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.32)'; c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = act ? pal.own[0] : on ? pal.line : 'rgba(255,255,255,0.08)'; c.lineWidth = 1; c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      txt(c, String(n), r.x + (on ? 4 : r.w / 2), r.y + 14, { color: on ? pal.warn : pal.muted, font: f, size: 11, weight: 800, align: on ? 'left' : 'center' });
      if (on) txt(c, String(ids.length), r.x + r.w - 4, r.y + 14, { color: pal.ink, font: f, size: 11, weight: 700, align: 'right' });
    }
  }
  // Кнопка «Ремонт» у выбранного своего здания (если ремонт открыт миссией)
  function repairBtn(S) {
    var W = S.W; if (!W || !W.repairOn || S.sel.size !== 1) return null;
    var e = W.byId[S.sel.values().next().value]; if (!e || e.kind !== 'bld' || e.owner !== 0) return null;
    return { x: 374, y: LAYOUT.VIEW_H + 66, w: 76, h: 18, b: e };
  }
  // Кнопка «Свернуть» (своё здание, если миссия открыла перенос; у вышки — всегда) / «Развернуть» (фургон или бур)
  function packBtn(S) {
    var W = S.W; if (!W || S.sel.size !== 1) return null;
    var e = W.byId[S.sel.values().next().value]; if (!e || e.owner !== 0) return null;
    if (e.kind === 'bld') return (W.packOn || e.type === 'rig') && e.type !== 'palisade' ? { x: 374, y: LAYOUT.VIEW_H + 35, w: 76, h: 18, b: e, kind: 'pack' } : null;
    if (L.packedType(e) && !e.locked) return { x: 374, y: LAYOUT.VIEW_H + 35, w: 76, h: 18, b: e, kind: 'deploy' };
    return null;
  }
  function drawIcon(c, kind, type, x, y, pal) {
    c.save(); c.translate(x, y);
    if (kind === 'bld') {
      var d = L.BLDS[type], s = 30 / (Math.max(d.w, d.h) * T); c.scale(s, s);
      drawBld(c, { tx: 0, ty: 0, w: d.w, h: d.h, type: type, owner: 0, id: 0 }, pal, 0, true);
    } else {
      c.scale(1.25, 1.25); drawUnit(c, { x: 12 / T, y: 12 / T, heading: -Math.PI / 4, aim: -Math.PI / 4, type: type, owner: 0, fireT: -9, path: [], order: {}, carry: 120, id: 0 }, pal, 0);
    }
    c.restore();
  }
  function drawPanel(c, S, pal) {
    var W = S.W, t = S.t, f = pal.font, pl = W.players[0], VH = LAYOUT.VIEW_H;
    c.fillStyle = pal.panel; c.fillRect(0, VH, LAYOUT.W, LAYOUT.H - VH);
    c.fillStyle = pal.line; c.fillRect(0, VH, LAYOUT.W, 2);
    drawMinimap(c, S, pal);
    // ресурсы
    var ix = 160;
    if (!S.noEco) {
    txt(c, t('copper'), ix, VH + 20, { color: pal.muted, font: f, size: 12, weight: 600 });
    txt(c, String(Math.floor(pl.copper)), ix + 58, VH + 21, { color: pal.oreHi, font: f, size: 17, weight: 800 });
    var low = pl.pOut < pl.pUse;
    txt(c, t('steam'), ix + 140, VH + 20, { color: pal.muted, font: f, size: 12, weight: 600 });
    txt(c, pl.pUse + ' / ' + pl.pOut, ix + 175, VH + 21, { color: low ? pal.bad : pal.good, font: f, size: 14, weight: 800 });
    c.fillStyle = pal.line; c.fillRect(ix, VH + 28, 288, 5);
    c.fillStyle = low ? pal.bad : pal.good; c.fillRect(ix, VH + 28, 288 * Math.min(1, pl.pUse / Math.max(1, pl.pOut)), 5);
    }
    // выделение
    var sel = []; S.sel.forEach(function (id) { if (W.byId[id]) sel.push(W.byId[id]); });
    var y0 = VH + 50;
    if (sel.length === 1) {
      var e = sel[0], nm = t(e.type) + (e.owner === 1 ? ' · ' + t('foe') : '');
      txt(c, nm, ix, y0, { color: e.owner === 0 ? pal.ink : pal.own[1], font: f, size: 14, weight: 800 });
      hpBar(c, ix, y0 + 8, 200, e.hp / e.maxHp, pal);
      txt(c, Math.ceil(e.hp) + ' / ' + e.maxHp, ix + 208, y0 + 13, { color: pal.muted, font: f, size: 11, weight: 600 });
      var extra = '';
      if (e.type === 'hauler') extra = t('load') + ': ' + e.carry + ' / ' + (W.haulCap || L.UNITS.hauler.cap);
      else if (e.packed) extra = t('packedOf') + ': ' + t(e.packed.type);
      else if (e.type === 'drill') extra = t('drillTip');
      else if (e.type === 'sapper') extra = t('sapperTip');
      else if (e.type === 'rig') extra = e.dry ? t('rigDry') : '+' + (W.rigRate || L.BLDS.rig.rate) + ' ' + t('perSec') + ' · ' + t('rigLeft') + ' ' + L.rigOre(W, e);
      else if (e.kind === 'unit') { var ud = L.UNITS[e.type]; extra = e.locked ? t('scripted') : '⚔ ' + ud.dmg + '  ⌖ ' + ud.range + '  ⇢ ' + ud.speed; }
      else { var bd = L.BLDS[e.type]; extra = bd.weapon ? '⚔ ' + bd.dmg + '  ⌖ ' + bd.range : bd.power ? t('steam') + ' ' + (bd.power > 0 ? '+' : '') + bd.power : ''; }
      if (e.repair) extra = t('repairing') + ' · ' + extra;
      if (e.setup > 0) extra = t('setup') + ' · ' + Math.ceil(e.setup) + ' ' + t('sec');
      txt(c, extra, ix, y0 + 32, { color: e.repair ? pal.good : pal.muted, font: f, size: 12, weight: 600 });
      var pk = packBtn(S);
      if (pk) { var pon = pk.kind === 'deploy' || L.canPack(W, pk.b), hv3 = S.panelHover === pk.b, arm = S.placing && S.placing.van === pk.b.id; c.globalAlpha = pon ? 1 : 0.4; c.fillStyle = arm ? pal.ownDk[0] : hv3 ? pal.line : 'rgba(255,255,255,0.05)'; c.fillRect(pk.x, pk.y, pk.w, pk.h); c.strokeStyle = arm ? pal.own[0] : pal.line; c.strokeRect(pk.x + 0.5, pk.y + 0.5, pk.w - 1, pk.h - 1);
        txt(c, (pk.kind === 'pack' ? '⇣ ' + t('pack') : '⇡ ' + t('deploy')) + ' · F', pk.x + pk.w / 2, pk.y + 13, { color: pal.ink, font: f, size: 10, weight: 700, align: 'center' }); c.globalAlpha = 1; }
      var rb = repairBtn(S);
      if (rb) { var dmg = e.hp < e.maxHp, hv2 = S.panelHover === rb.b; c.globalAlpha = dmg || e.repair ? 1 : 0.4; c.fillStyle = e.repair ? pal.ownDk[0] : hv2 ? pal.line : 'rgba(255,255,255,0.05)'; c.fillRect(rb.x, rb.y, rb.w, rb.h); c.strokeStyle = e.repair ? pal.good : pal.line; c.strokeRect(rb.x + 0.5, rb.y + 0.5, rb.w - 1, rb.h - 1);
        txt(c, (e.repair ? '■ ' : '⚒ ') + t('repair'), rb.x + rb.w / 2, rb.y + 13, { color: e.repair ? pal.good : pal.ink, font: f, size: 11, weight: 700, align: 'center' }); c.globalAlpha = 1; }
    } else if (sel.length > 1) {
      txt(c, t('selected') + ': ' + sel.length, ix, y0, { color: pal.ink, font: f, size: 14, weight: 800 });
      var counts = {}; sel.forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
      var xx = ix; Object.keys(counts).forEach(function (k) { drawIcon(c, 'unit', k, xx, y0 + 8, pal); txt(c, '×' + counts[k], xx + 32, y0 + 30, { color: pal.ink, font: f, size: 13 }); xx += 70; });
    } else {
      txt(c, S.idleTitle || t('me'), ix, y0, { color: pal.own[0], font: f, size: 14, weight: 800 });
      txt(c, S.idleSub != null ? S.idleSub : t('hint1').split('.')[0], ix, y0 + 22, { color: pal.muted, font: f, size: 11, weight: 600 });
    }
    // кнопки
    BTNS.forEach(function (b) {
      if (S.btnHidden && S.btnHidden(b)) return;
      var locked = S.btnAllowed && !S.btnAllowed(b);
      var can = L.reqMet(W, 0, b.type) && !locked, hov = S.panelHover === b, d = b.kind === 'bld' ? L.BLDS[b.type] : L.UNITS[b.type];
      c.fillStyle = hov && can ? pal.line : 'rgba(255,255,255,0.03)'; c.fillRect(b.x, b.y, b.w, b.h);
      c.strokeStyle = pal.line; c.lineWidth = 1; c.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      var prog = 0, ready = false, qn = 0;
      if (b.kind === 'bld' && pl.build && pl.build.type === b.type) { prog = pl.build.p; ready = pl.build.ready; }
      if (b.kind === 'unit') { var q = d.from === 'bunk' ? pl.inf : pl.veh; qn = q.filter(function (x) { return x === b.type; }).length; if (q[0] === b.type) prog = d.from === 'bunk' ? pl.infP : pl.vehP; }
      if (prog > 0) { c.fillStyle = 'rgba(95,207,128,0.22)'; c.fillRect(b.x + 1, b.y + 1, (b.w - 2) * prog, b.h - 2); }
      c.globalAlpha = can ? 1 : 0.35;
      drawIcon(c, b.kind, b.type, b.x + 4, b.y + 9, pal);
      var lb = t(b.type), ls = 12; c.font = '700 12px ' + f; while (ls > 9 && c.measureText(lb).width > b.w - 44) { ls--; c.font = '700 ' + ls + 'px ' + f; }
      txt(c, lb, b.x + 40, b.y + 20, { color: pal.ink, font: f, size: ls, weight: 700 });
      txt(c, String(d.cost), b.x + 40, b.y + 38, { color: pl.copper >= d.cost ? pal.oreHi : pal.bad, font: f, size: 12, weight: 700 });
      c.globalAlpha = 1;
      if (locked) { c.fillStyle = pal.muted; c.globalAlpha = 0.7; c.fillRect(b.x + b.w - 15, b.y + 9, 9, 7); c.strokeStyle = pal.muted; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x + b.w - 10.5, b.y + 9, 3, Math.PI, 0); c.stroke(); c.globalAlpha = 1; } // замок
      if (ready) { c.globalAlpha = 0.6 + 0.4 * Math.sin(W.time * 6); txt(c, t('ready'), b.x + b.w - 6, b.y + 38, { color: pal.good, font: f, size: 11, weight: 800, align: 'right' }); c.globalAlpha = 1; }
      if (qn > 1) txt(c, '×' + qn, b.x + b.w - 6, b.y + 38, { color: pal.warn, font: f, size: 12, weight: 800, align: 'right' });
    });
  }
  function buttonAt(x, y, S) { for (var n = 0; n < BTNS.length; n++) { var b = BTNS[n]; if (S && S.btnHidden && S.btnHidden(b)) continue; if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b; } return null; }

  P.render = { frame: frame, packBtn: packBtn, HEAT: HEAT, LAYOUT: LAYOUT, PAL: PAL, SNOW: SNOW, TILE: T, buttonAt: buttonAt, BTNS: BTNS, setButtons: setButtons, groupAt: groupAt, groupRect: groupRect, repairBtn: repairBtn, fitMinimap: fitMinimap, drawIcon: drawIcon, drawBld: drawBld, drawUnit: drawUnit, txt: txt, roundRect: roundRect, groundPal: groundPal,
    resetCache: function () { cache.key = ''; mm.t = -1; puffs.length = 0; } };
})(window);
