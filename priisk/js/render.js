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
      own: ['#e0a53a', '#9b7bd6', '#5fb8a6', '#c8573e'], ownDk: ['#7a5216', '#4b3577', '#24584f', '#62261a'], metal: '#3a3f47', metalHi: '#596170', tread: '#23262b',
      roof: '#5c4a3a', roofHi: '#77624f', wall: '#8c7c68', steam: 'rgba(235,240,245,', glow: '#ff9a3c',
      panel: '#14171d', line: '#2a2f39', ink: '#e9edf2', muted: '#8d96a5', good: '#5fcf80', bad: '#ff6b5e', warn: '#ffb020', sel: '#f2f5f8',
      font: 'Inter, system-ui, sans-serif', pixel: false
    },
    retro: {
      g1: '#2b2a12', g2: '#33311a', g3: '#2b2a12', rock: '#555555', rockHi: '#aaaaaa', rockLo: '#000000', water: '#0055aa', waterHi: '#55ffff',
      oreDirt: '#3a2408', ore: '#aa5500', oreHi: '#ffaa55', fog: '#000000', seen: 'rgba(0,0,0,0.55)',
      own: ['#ffff55', '#ff55ff', '#55ffff', '#ff5555'], ownDk: ['#aa5500', '#aa00aa', '#00aaaa', '#aa0000'], metal: '#555555', metalHi: '#aaaaaa', tread: '#000000',
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
  // Шахта (миссия 9, W.ground === 'mine'): тёмный каменный пол, порода вместо скал
  var MINE = { modern: { g1: '#4b453d', g2: '#48423a', g3: '#4f4940', rock: '#24211e', rockHi: '#37322c', rockLo: '#131110', mine: true },
    retro: { g1: '#2a1a08', g2: '#33200c', g3: '#2a1a08', rock: '#555555', rockHi: '#aaaaaa', rockLo: '#000000', mine: true } };
  function groundPal(W, th, pal) { var sn = SNOW[th] || SNOW.modern, ht = HEAT[th] || HEAT.modern; pal = Object.assign({}, pal, ht); if (W.ground === 'mine') pal = Object.assign(pal, MINE[th] || MINE.modern); return W.ground === 'snow' ? Object.assign({}, pal, { g1: sn.g1, g2: sn.g2, g3: sn.g3, snow: true }, { ice: sn.ice, iceHi: sn.iceHi, iceLo: sn.iceLo, open: sn.open, openHi: sn.openHi }) : Object.assign({}, pal, { ice: sn.ice, iceHi: sn.iceHi, iceLo: sn.iceLo, open: sn.open, openHi: sn.openHi }); }
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
      else if (pal.mine) { if (r > 0.8) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x + r * 14, y + (1 - r) * 60, 3, 2); } else if (r < 0.1) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x + 9, y + 13, 4, 2); } }
      else if (r > 0.82) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.beginPath(); c.arc(x + r * T, y + (1 - r) * T, 2, 0, 7); c.fill(); }
      else if (r < 0.12) { c.strokeStyle = 'rgba(40,50,35,0.22)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 8, y + 15); c.lineTo(x + 6, y + 9); c.moveTo(x + 10, y + 15); c.lineTo(x + 11, y + 8); c.moveTo(x + 12, y + 15); c.lineTo(x + 15, y + 10); c.stroke(); }
      if (W.high && W.high[k]) { // высота (кампания): светлее, с насечками склона — здесь ветряки ловят ветер
        c.fillStyle = pal.pixel ? '#aaaaaa' : 'rgba(236,240,250,0.22)'; c.fillRect(x, y, T, T);
        c.fillStyle = pal.pixel ? '#555555' : 'rgba(70,64,96,0.30)'; if ((i + j) % 2 === 0) { c.fillRect(x + 4, y + 6, 6, 2); c.fillRect(x + 12, y + 15, 6, 2); } else c.fillRect(x + 8, y + 10, 6, 2);
      }
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

  // ---------- Артель Сизого Перевала: свой облик (не перекраска Медного Ключа) ----------
  // Медный Ключ — латунь, железо, пар; Сизые — серое выветренное дерево, сланцевые кровли, канаты и парусина цвета сирени,
  // ветряки и опоры канатной дороги. Цвета дерева/сланца/парусины — свои для каждой темы.
  var SZ = { modern: { wood: '#7d8590', woodHi: '#a3aab3', woodLo: '#4c535c', slate: '#46505e', slateHi: '#5e6a7a', cloth: '#d9cdea', rope: '#2b2630', snow: '#e8eef3' },
    retro: { wood: '#aaaaaa', woodHi: '#ffffff', woodLo: '#555555', slate: '#0000aa', slateHi: '#5555ff', cloth: '#ffffff', rope: '#000000', snow: '#ffffff' } };
  var SZ_TYPES = { mill: 1, pylon: 1, hut: 1, station: 1, face: 1, sail: 1, ranger: 1, skiff: 1, harpoon: 1, korney: 1, agafya: 1, mityay: 1, folk: 1 };
  function szPal(pal) { return SZ[pal.pixel ? 'retro' : 'modern']; }
  function logs(c, x, y, w, h, z, n) { for (var k = 0; k < n; k++) { c.fillStyle = k % 2 ? z.wood : z.woodHi; c.fillRect(x, y + k * h / n, w, h / n - 1); c.fillStyle = z.woodLo; c.fillRect(x, y + (k + 1) * h / n - 1, w, 1); } }
  function shingles(c, x, y, w, h, z, own) { c.fillStyle = z.slate; c.fillRect(x, y, w, h); c.fillStyle = z.slateHi; for (var r = 0; r < h; r += 5) for (var q = (r / 5) % 2 * 4; q < w; q += 8) c.fillRect(x + q, y + r, 6, 2); c.fillStyle = own; c.fillRect(x, y + h / 2 - 1, w, 2); }
  function drawSzBld(c, b, pal, now, ghost, x, y, w, h, own, dk, box) {
    var z = szPal(pal), px = pal.pixel;
    if (b.type === 'hq') { // изба-контора: сруб, высокая шатровая кровля из сланца, флюгер и знамя-полотнище
      logs(c, x + 3, y + 4, w - 7, h - 8, z, 9);
      c.fillStyle = z.slate; c.beginPath(); c.moveTo(x + 6, y + 8); c.lineTo(x + w / 2, y + h * 0.18); c.lineTo(x + w - 7, y + 8); c.lineTo(x + w - 7, y + h - 18); c.lineTo(x + w / 2, y + h * 0.82 - 10); c.lineTo(x + 6, y + h - 18); c.closePath(); c.fill();
      c.strokeStyle = z.slateHi; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 6, y + 8); c.lineTo(x + w - 7, y + h - 18); c.moveTo(x + w - 7, y + 8); c.lineTo(x + 6, y + h - 18); c.stroke();
      box(x + w / 2 - 6, y + h - 16, 12, 12, z.woodLo, 1); c.fillStyle = own; c.fillRect(x + w / 2 - 1, y + h - 16, 2, 12);
      c.fillStyle = z.woodLo; c.fillRect(x + 6, y + 3, 2, 26); c.fillStyle = own; c.beginPath(); c.moveTo(x + 8, y + 4); c.lineTo(x + 24, y + 8); c.lineTo(x + 8, y + 13); c.closePath(); c.fill(); // знамя
      var va = ghost ? 0 : (P.S && P.S.W && P.S.W.wind ? P.S.W.wind.a : 0); c.save(); c.translate(x + w / 2, y + h * 0.4); c.rotate(va); c.strokeStyle = z.rope; c.lineWidth = 2; c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke(); c.fillStyle = own; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-3, -4); c.lineTo(-3, 4); c.closePath(); c.fill(); c.restore();
      c.strokeStyle = own; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, w - 7, h - 7);
    } else if (b.type === 'mill') { // ветряк: каменное основание, четыре крыла (два — под парусиной); крутится по силе ветра
      c.fillStyle = z.woodLo; c.beginPath(); for (var k = 0; k < 6; k++) { var a6 = k / 6 * Math.PI * 2; c.lineTo(x + w / 2 + Math.cos(a6) * 15, y + h / 2 + Math.sin(a6) * 15); } c.closePath(); c.fill();
      c.fillStyle = z.wood; c.beginPath(); c.arc(x + w / 2, y + h / 2, 10, 0, 7); c.fill();
      var rot = ghost ? 0.5 : now * (0.3 + (b.pw || 0) / 9) + b.id;
      c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot);
      for (var bl = 0; bl < 4; bl++) { c.rotate(Math.PI / 2); c.fillStyle = z.rope; c.fillRect(-1.2, 2, 2.4, 22); if (bl % 2 === 0) { c.fillStyle = z.cloth; c.fillRect(1.2, 8, 6, 15); c.fillStyle = own; c.fillRect(1.2, 8, 6, 2); } else { c.strokeStyle = z.woodHi; c.lineWidth = 1; c.strokeRect(1.5, 8.5, 5, 14); } }
      c.restore(); c.fillStyle = own; c.beginPath(); c.arc(x + w / 2, y + h / 2, 3.5, 0, 7); c.fill();
      if (!ghost && b.pw === 0) { c.fillStyle = pal.bad; c.font = '900 12px ' + pal.font; c.textAlign = 'center'; c.fillText('∅', x + w - 6, y + 12); c.textAlign = 'left'; }
    } else if (b.type === 'pylon') { // опора канатки: А-образная рама из бруса, сверху ролик
      c.strokeStyle = z.woodLo; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 3, y + h - 2); c.lineTo(x + w / 2, y + 4); c.lineTo(x + w - 3, y + h - 2); c.stroke();
      c.strokeStyle = z.wood; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 6, y + h - 8); c.lineTo(x + w - 6, y + h - 8); c.moveTo(x + 3, y + h - 2); c.lineTo(x + w / 2, y + 4); c.stroke();
      c.fillStyle = own; c.beginPath(); c.arc(x + w / 2, y + 5, 3.5, 0, 7); c.fill(); c.fillStyle = z.rope; c.fillRect(x + w / 2 - 1, y + 4, 2, 2);
      if (!ghost && (b.cut || b.cutAt > 0)) { // обрыв пролёта: обрывки каната свисают с ролика; трещит — мигает «!»
        if (b.cut) { c.strokeStyle = z.rope; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + w / 2, y + 5); c.quadraticCurveTo(x + w / 2 + 7, y + 12, x + w / 2 + 4 + Math.sin(now * 3 + b.id) * 2, y + h + 4); c.moveTo(x + w / 2, y + 5); c.quadraticCurveTo(x + w / 2 - 6, y + 13, x + w / 2 - 3 + Math.sin(now * 3.4 + b.id) * 2, y + h + 2); c.stroke();
          if (b.cutP > 0) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - 6, y - 8, w + 12, 5); c.fillStyle = pal.good; c.fillRect(x - 5, y - 7, (w + 10) * Math.min(1, b.cutP / ((P.S && P.S.W && P.S.W.ropeFix && P.S.W.ropeFix.time) || 8)), 3); } }
        c.globalAlpha = 0.55 + 0.45 * Math.sin(now * (b.cut ? 5 : 12)); c.fillStyle = b.cut ? pal.bad : pal.warn; c.font = '900 13px ' + pal.font; c.textAlign = 'center'; c.fillText(b.cut ? '✕' : '!', x + w - 2, y + 2); c.textAlign = 'left'; c.globalAlpha = 1;
      }
    } else if (b.type === 'hut') { // зимовьё: сруб под дерновой кровлей в снегу, труба с тонким дымом
      logs(c, x + 3, y + 6, w - 7, h - 10, z, 6);
      box(x + 5, y + 4, w - 11, h - 18, z.snow, 4); c.fillStyle = z.woodLo; c.fillRect(x + 5, y + 4 + (h - 18) / 2, w - 11, 2);
      box(x + w - 14, y + 6, 6, 6, z.slate, 1); box(x + 8, y + h - 11, 9, 7, z.woodLo, 1); c.fillStyle = own; c.fillRect(x + 20, y + h - 9, w - 28, 3);
      if (!ghost && hash(b.id, (now * 2) | 0) < 0.25) puff(b.tx + b.w - 0.45, b.ty + 0.25, 0.5);
    } else if (b.type === 'station') { // приёмная станция канатки: навес, большое колесо (вращается), лотки с медью
      box(x + 2, y + 3, w - 5, h - 7, z.woodLo, 3); shingles(c, x + 4, y + 5, w * 0.55, h - 12, z, own);
      var wx = x + w * 0.78, wy = y + h / 2 - 1; c.strokeStyle = z.rope; c.lineWidth = 3; c.beginPath(); c.arc(wx, wy, 13, 0, 7); c.stroke();
      c.save(); c.translate(wx, wy); c.rotate(ghost ? 0 : now * 1.2); c.strokeStyle = z.woodHi; c.lineWidth = 2; for (var sp = 0; sp < 6; sp++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(12, 0); c.stroke(); } c.restore();
      c.fillStyle = own; c.beginPath(); c.arc(wx, wy, 3, 0, 7); c.fill();
      c.fillStyle = pal.ore; c.fillRect(x + 8, y + h - 9, 10, 4); c.fillRect(x + 22, y + h - 9, 10, 4);
    } else if (b.type === 'face') { // забой: тёмный зев штольни в бревенчатой раме, вагонетка и куча руды (сколько накоплено)
      box(x + 2, y + 2, w - 5, h - 5, pal.rockLo, 4);
      c.fillStyle = '#0d0c0b'; c.beginPath(); c.moveTo(x + 10, y + h - 6); c.lineTo(x + 10, y + 16); c.quadraticCurveTo(x + w / 2, y + 4, x + w - 11, y + 16); c.lineTo(x + w - 11, y + h - 6); c.closePath(); c.fill();
      c.strokeStyle = z.wood; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 9, y + h - 5); c.lineTo(x + 9, y + 14); c.lineTo(x + w - 10, y + 14); c.lineTo(x + w - 10, y + h - 5); c.stroke();
      var st = ghost ? 0.6 : Math.min(1, (b.stock || 0) / L.FACE.stock); c.fillStyle = pal.ore; c.beginPath(); c.ellipse(x + w / 2, y + h - 8, 4 + 10 * st, 2 + 3 * st, 0, 0, 7); c.fill();
      c.fillStyle = own; c.fillRect(x + 4, y + 4, 6, 6);
      if (!ghost && b.link === false) { c.fillStyle = pal.warn; c.font = '900 14px ' + pal.font; c.textAlign = 'center'; c.fillText('!', x + w - 7, y + 14); c.textAlign = 'left'; }
    } else if (b.type === 'sail') { // верфь ветроходов: стапель, недостроенный корпус, мачта со свёрнутым парусом
      box(x + 2, y + 2, w - 5, h - 5, z.woodLo, 5);
      c.strokeStyle = z.wood; c.lineWidth = 2; for (var r2 = 0; r2 < 5; r2++) { c.beginPath(); c.moveTo(x + 8 + r2 * 13, y + 8); c.lineTo(x + 8 + r2 * 13, y + h - 8); c.stroke(); }
      c.fillStyle = z.wood; c.beginPath(); c.moveTo(x + 14, y + h / 2 - 7); c.lineTo(x + w - 12, y + h / 2); c.lineTo(x + 14, y + h / 2 + 7); c.closePath(); c.fill();
      c.fillStyle = z.cloth; c.fillRect(x + 22, y + h / 2 - 14, 20, 5); c.fillStyle = own; c.fillRect(x + 22, y + h / 2 - 14, 20, 2);
      shingles(c, x + 6, y + h - 16, w - 13, 10, z, own);
    }
  }
  // канатная дорога: пролёты между опорами/станциями/забоями (провисший канат) и люльки с медью
  function drawCables(c, W, pal, now) {
    var z = szPal(pal);
    [0, 1, 2].forEach(function (o) {
      if (L.facOf(W, o) !== 'sizye') return;
      L.cableLinks(W, o).forEach(function (pr) {
        if (!L.visibleTo0(W, pr[0]) && !L.visibleTo0(W, pr[1])) return;
        var a = L.center(pr[0]), b = L.center(pr[1]), ax = a.x * T, ay = a.y * T - (pr[0].type === 'pylon' ? 8 : 4), bx = b.x * T, by = b.y * T - (pr[1].type === 'pylon' ? 8 : 4), mx = (ax + bx) / 2, my = (ay + by) / 2 + Math.hypot(bx - ax, by - ay) * 0.08;
        c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax + 3, ay + 9); c.quadraticCurveTo(mx + 3, my + 12, bx + 3, by + 9); c.stroke(); // тень каната
        c.strokeStyle = z.rope; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by); c.stroke();
        c.strokeStyle = pal.own[W.paint && W.paint[o] != null ? W.paint[o] : o]; c.lineWidth = 0.8; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(ax, ay - 2); c.quadraticCurveTo(mx, my - 2, bx, by - 2); c.stroke(); c.globalAlpha = 1;
      });
    });
    W.cars.forEach(function (car) {
      var k = Math.floor(car.y) * W.w + Math.floor(car.x); if (car.owner !== 0 && W.vis[k] !== 2) return;
      var x = car.x * T, y = car.y * T - 6 + Math.sin(now * 5 + car.id) * 0.8;
      c.strokeStyle = z.rope; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x, y); c.stroke();
      c.fillStyle = z.woodLo; c.fillRect(x - 5, y, 10, 6); c.fillStyle = pal.ore; c.fillRect(x - 4, y - 1, 8, 2); c.fillStyle = pal.oreHi; c.fillRect(x - 2, y - 2, 3, 1);
    });
  }
  function drawSzUnit(c, u, pal, now, own, dk) {
    var z = szPal(pal), t = u.type;
    if (u.riding) { var sa = u.sway > 0 ? Math.sin(now * 2.4 + u.id * 1.7) * 0.22 * u.sway : 0; c.rotate(sa); c.strokeStyle = z.rope; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -14); c.lineTo(0, -6); c.stroke(); c.fillStyle = z.woodLo; c.fillRect(-7, -1, 14, 7); if (u.fare) { c.fillStyle = z.wood; c.fillRect(-7, -1, 14, 2); c.fillStyle = own; c.fillRect(-7, 5, 14, 1.5); } c.rotate(-sa); } // люлька (пассажирская — с бортом)
    if (t === 'skiff') { // ветроход: узкий корпус на трёх колёсах, мачта и треугольный парус сирени
      c.rotate(u.heading);
      c.fillStyle = pal.tread; c.fillRect(-9, -7, 5, 3); c.fillRect(-9, 4, 5, 3); c.fillRect(7, -1.5, 4, 3);
      c.fillStyle = z.woodLo; c.strokeStyle = z.rope; c.lineWidth = 1.2; c.beginPath(); c.moveTo(12, 0); c.lineTo(4, -5); c.lineTo(-10, -4); c.lineTo(-10, 4); c.lineTo(4, 5); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = z.wood; c.fillRect(-7, -2.5, 12, 5);
      c.fillStyle = z.cloth; c.beginPath(); c.moveTo(1, 0); c.lineTo(-8, -10 - Math.sin(now * 3 + u.id) * 0.6); c.lineTo(-8, 0); c.closePath(); c.fill();
      c.fillStyle = own; c.beginPath(); c.moveTo(1, 0); c.lineTo(-8, -10); c.lineTo(-6, -5); c.closePath(); c.fill();
      c.fillStyle = z.rope; c.fillRect(0, -1, 2, 2); c.save(); c.rotate((u.aim || u.heading) - u.heading); c.fillStyle = pal.metal; c.fillRect(4, -1, 9, 2); c.restore();
      if (now - u.fireT < 0.1) { c.fillStyle = pal.glow; c.fillRect(13, -2, 4, 4); }
      return;
    }
    if (t === 'harpoon') { // самострел: телега с огромным луком и лебёдкой
      c.rotate(u.heading);
      c.fillStyle = pal.tread; c.fillRect(-10, -9, 7, 3); c.fillRect(-10, 6, 7, 3); c.fillRect(3, -9, 7, 3); c.fillRect(3, 6, 7, 3);
      c.fillStyle = z.rope; c.fillRect(-12, -7, 24, 14); c.fillStyle = z.woodLo; c.fillRect(-11, -6, 22, 12); c.fillStyle = z.wood; c.fillRect(-9, -4, 18, 8);
      c.save(); c.rotate((u.aim || u.heading) - u.heading);
      c.strokeStyle = z.woodHi; c.lineWidth = 2.5; c.beginPath(); c.moveTo(6, -10); c.quadraticCurveTo(12, 0, 6, 10); c.stroke();
      c.strokeStyle = z.rope; c.lineWidth = 1; c.beginPath(); c.moveTo(6, -10); c.lineTo(now - u.fireT < 0.2 ? 6 : 0, 0); c.lineTo(6, 10); c.stroke();
      c.fillStyle = pal.metalHi; c.fillRect(-2, -1, 16, 2); c.restore();
      c.fillStyle = own; c.fillRect(-9, -2, 4, 4);
      return;
    }
    if (t === 'folk') { // горняк посёлка (С6): без ружья, в серой робе, шахтёрская лампа; ждёт люльку — лампа мигает
      c.rotate(u.heading);
      c.fillStyle = z.rope; c.beginPath(); c.arc(0, 0, 5.4, 0, 7); c.fill();
      c.fillStyle = pal.metal; c.beginPath(); c.arc(0, 0, 4.4, 0, 7); c.fill();
      c.fillStyle = z.snow; c.beginPath(); c.arc(-0.5, 0, 2.3, 0, 7); c.fill();
      c.fillStyle = z.woodHi; c.fillRect(-1, -6, 2, 3);                                     // кирка за спиной
      var lit = !u.fare || Math.sin(now * 6 + u.id) > -0.3; c.fillStyle = lit ? pal.glow : z.woodLo; c.fillRect(3, 2, 3, 3); // лампа
      if (u.burnT && now - u.burnT < 0.4) { c.strokeStyle = pal.bad || '#c33'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 7, 0, 7); c.stroke(); }
      return;
    }
    // пехота и герои Сизых: башлык/капюшон, полушубок, кушак сирени
    var hero = t !== 'ranger', R0 = hero ? 6.8 : 5.6;
    if (t === 'korney' && u.abOn > 0) { c.strokeStyle = own; c.globalAlpha = 0.35 + 0.25 * Math.sin(now * 8); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, L.HEROES.korney.aura * 1.6 * T, 0, 7); c.stroke(); c.globalAlpha = 1; }
    if (t === 'mityay' && u.talking) { c.strokeStyle = pal.good; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, u.talking.t / u.talking.need)); c.stroke(); }
    c.rotate(u.aim != null ? u.aim : u.heading);
    c.fillStyle = pal.metal; c.fillRect(2, -1, t === 'ranger' ? 11 : t === 'mityay' ? 6 : 9, 2); // ружьё (у Митяя — обрез)
    if (now - u.fireT < 0.08) { c.fillStyle = pal.glow; c.fillRect(12, -2, 4, 4); }
    c.fillStyle = z.rope; c.beginPath(); c.arc(0, 0, R0 + 1, 0, 7); c.fill();          // тёмный контур — видно и на снегу
    c.fillStyle = z.woodLo; c.beginPath(); c.arc(0, 0, R0, 0, 7); c.fill();           // полушубок
    c.fillStyle = z.wood; c.beginPath(); c.arc(0, 0, R0 - 1.6, 0, 7); c.fill();
    c.fillStyle = own; c.fillRect(-R0 + 1, -1, R0 * 2 - 2, 2.2);                        // кушак
    c.fillStyle = z.snow; c.beginPath(); c.arc(-1, 0, hero ? 3.2 : 2.6, 0, 7); c.fill(); // башлык
    if (t === 'korney') { c.fillStyle = dk; c.beginPath(); c.arc(-2, 0, R0 + 1, Math.PI * 0.55, Math.PI * 1.45); c.fill(); }     // плащ
    if (t === 'agafya') { c.strokeStyle = z.rope; c.lineWidth = 1.6; c.beginPath(); c.arc(-3, 4, 3, 0, 7); c.stroke(); c.fillStyle = pal.metalHi; c.fillRect(-7, -6, 3, 3); } // бухта каната, крюк
    if (t === 'mityay') { c.fillStyle = pal.roofHi; c.fillRect(-6, 3, 4, 4); }                 // сумка посыльного
    if (hero) { c.strokeStyle = own; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, R0 + 2, 0, 7); c.stroke(); }
  }
  function drawBld(c, b, pal, now, ghost) {
    var pi = b.pi != null ? b.pi : b.owner, x = b.tx * T, y = b.ty * T, w = b.w * T, h = b.h * T, own = pal.own[pi], dk = pal.ownDk[pi], px = pal.pixel;
    function box(xx, yy, ww, hh, col, rad) { c.fillStyle = col; if (px || !rad) c.fillRect(xx, yy, ww, hh); else { roundRect(c, xx, yy, ww, hh, rad); c.fill(); } }
    box(x + 2, y + 3, w - 3, h - 3, 'rgba(0,0,0,0.28)', 4); // тень
    if (SZ_TYPES[b.type] || (b.type === 'hq' && b.look === 'sizye')) drawSzBld(c, b, pal, now, ghost, x, y, w, h, own, dk, box);
    else if (b.type === 'hq') {
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
    } else if (b.type === 'pump') { // насос: паровой цилиндр, коромысло, труба к воде, бак
      box(x + 2, y + 2, w - 5, h - 5, pal.metal, 4);
      box(x + 5, y + 8, 14, 26, pal.metalHi, 3); c.fillStyle = pal.glow; c.fillRect(x + 9, y + 28, 6, 3);
      var pk = ghost || b.setup > 0 ? 0 : Math.sin(now * 3 + b.id) * 0.3;
      c.save(); c.translate(x + 24, y + 12); c.rotate(pk); c.fillStyle = own; c.fillRect(-14, -2, 28, 4); c.restore();
      c.fillStyle = pal.water; c.beginPath(); c.arc(x + w - 14, y + h - 15, 9, 0, 7); c.fill(); c.fillStyle = pal.waterHi; c.fillRect(x + w - 18, y + h - 19, 4, 3);
      c.fillStyle = pal.tread; c.fillRect(x + w - 6, y + h - 17, 5, 4);
      c.fillStyle = own; c.fillRect(x + 4, y + h - 8, w - 9, 3);
    } else if (b.type === 'shaft') { // копёр: сруб надшахтного здания, решётчатая вышка с колесом, устье с отвалом
      box(x + 3, y + h - 34, w - 7, 30, pal.wall, 3); box(x + 3, y + h - 38, w - 7, 9, pal.roof, 2); c.fillStyle = pal.roofHi; c.fillRect(x + 3, y + h - 33, w - 7, 2);
      c.strokeStyle = pal.metal; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 14, y + h - 36); c.lineTo(x + 26, y + 8); c.lineTo(x + 38, y + h - 36); c.moveTo(x + 18, y + 26); c.lineTo(x + 34, y + 26); c.moveTo(x + 26, y + 8); c.lineTo(x + w - 10, y + h - 30); c.stroke();
      var wa = ghost ? 0 : now * 1.6; c.strokeStyle = pal.metalHi; c.lineWidth = 2; c.beginPath(); c.arc(x + 26, y + 11, 7, 0, 7); c.stroke();
      for (var ws = 0; ws < 3; ws++) { c.beginPath(); c.moveTo(x + 26 + Math.cos(wa + ws * 2.09) * 7, y + 11 + Math.sin(wa + ws * 2.09) * 7); c.lineTo(x + 26 - Math.cos(wa + ws * 2.09) * 7, y + 11 - Math.sin(wa + ws * 2.09) * 7); c.stroke(); }
      box(x + w / 2 - 9, y + h - 20, 18, 16, pal.tread, 2); c.fillStyle = pal.glow; c.globalAlpha = 0.5; c.fillRect(x + w / 2 - 5, y + h - 12, 10, 8); c.globalAlpha = 1;
      c.fillStyle = pal.ore; c.fillRect(x + w - 20, y + h - 12, 10, 7); c.fillStyle = own; c.fillRect(x + 3, y + h - 38, w - 7, 2);
    } else if (b.type === 'store') { // склад: длинный сруб с воротами, ящики с медью у стены
      box(x + 2, y + 5, w - 5, h - 9, pal.wall, 3);
      box(x + 3, y + 3, w - 7, 14, pal.roof, 2); c.fillStyle = pal.roofHi; c.fillRect(x + 3, y + 9, w - 7, 2);
      box(x + w / 2 - 8, y + h - 18, 16, 13, dk, 1); c.fillStyle = pal.tread; c.fillRect(x + w / 2 - 1, y + h - 18, 2, 13);
      if (b.stock) { c.fillStyle = pal.ore; c.fillRect(x + 5, y + h - 13, 7, 7); c.fillRect(x + w - 13, y + h - 13, 7, 7); c.fillStyle = pal.oreHi; c.fillRect(x + 6, y + h - 12, 3, 2); }
      c.fillStyle = own; c.fillRect(x + 3, y + 3, w - 7, 2);
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
    if (!ghost && now - (b.burnT || -9) < 0.3 && hash(b.id, (now * 6) | 0) < 0.35) puff(b.tx + b.w * (0.2 + 0.6 * hash(b.id, (now * 2) | 0)), b.ty + 0.3, 1.1); // горит — дым
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
    var pi = u.pi != null ? u.pi : u.owner, x = u.x * T, y = u.y * T, own = pal.own[pi], dk = pal.ownDk[pi], px = pal.pixel;
    if (u.riding && u.sway > 0) { x += Math.sin(now * 2.4 + u.id * 1.7) * 5 * u.sway; y += Math.abs(Math.cos(now * 2.4 + u.id * 1.7)) * 1.5 * u.sway; } // ветер раскачивает люльку
    if (u.type === 'colossus') { drawColossus(c, u, pal, now, own, dk); return; }
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(1.5, 2.5, L.UNITS[u.type].r * T, L.UNITS[u.type].r * T * 0.7, 0, 0, 7); c.fill();
    if (SZ_TYPES[u.type]) { drawSzUnit(c, u, pal, now, own, dk); c.restore(); return; }
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
    } else if (u.type === 'bowser') { // водовоз: бочка на колёсах, будка, брандспойт
      c.rotate(u.heading);
      c.fillStyle = pal.tread; c.fillRect(-9, -9, 6, 3); c.fillRect(4, -9, 6, 3); c.fillRect(-9, 6, 6, 3); c.fillRect(4, 6, 6, 3);
      c.fillStyle = dk; if (px) c.fillRect(-11, -7, 22, 14); else { roundRect(c, -11, -7, 22, 14, 3); c.fill(); }
      c.fillStyle = pal.water; if (px) c.fillRect(-9, -5.5, 13, 11); else { roundRect(c, -9, -5.5, 13, 11, 5); c.fill(); }   // бочка
      var wf = Math.max(0, Math.min(1, (u.water || 0) / L.UNITS.bowser.water)); c.fillStyle = pal.waterHi; c.fillRect(-8, 4 - 8 * wf, 2, 8 * wf);
      c.fillStyle = own; c.fillRect(5, -6, 5, 12);                                                     // будка
      c.rotate((u.aim == null ? u.heading : u.aim) - u.heading); c.fillStyle = pal.metalHi; c.fillRect(0, -1, 12, 2); // брандспойт
    } else if (u.type === 'engineer') { // инженер: ящик с инструментом, каска с фонарём
      c.rotate(u.heading);
      c.fillStyle = dk; c.beginPath(); c.arc(0, 0, 5.6, 0, 7); c.fill();
      c.fillStyle = own; c.beginPath(); c.arc(0, 0, 4.2, 0, 7); c.fill();
      c.fillStyle = pal.metalHi; c.fillRect(-8, -3.5, 4.5, 7); c.fillStyle = pal.metal; c.fillRect(-7.5, -1, 3.5, 2);    // ящик
      c.fillStyle = pal.wall; c.beginPath(); c.arc(1, 0, 2.6, 0, 7); c.fill(); c.fillStyle = pal.warn; c.fillRect(3, -1, 2, 2); // каска с фонарём
      if (u.order && u.order.t === 'capture' && u.order.p > 0) { c.fillStyle = pal.good; c.fillRect(6, -1.5 + Math.sin(now * 18) * 1.5, 3, 3); }
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
  // ---------- громада: корпус + узлы (гусеницы, бур, кабина, котёл); узел, по которому попали, вспыхивает; сбитый — обломки ----------
  function drawColossus(c, u, pal, now, own, dk) {
    var x = u.x * T, y = u.y * T, B = u.bs || { st: 'walk', cfg: L.BOSS }, px = pal.pixel, wt = u.wt == null ? now : u.wt;
    var alive = function (k) { return L.partAlive(u, k); }, hot = function (k) { var p = L.partOf(u, k); return !!p && p.hp > 0 && wt - p.hitT < 0.14; };
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(3, 5, 42, 30, 0, 0, 7); c.fill();
    if (B.st === 'warn' || B.st === 'vent') { c.strokeStyle = pal.steam + (B.st === 'vent' ? '0.65)' : '0.4)'); c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.arc(0, 0, B.cfg.ventR * T, 0, 7); c.stroke(); c.setLineDash([]); }
    c.rotate(u.heading);
    // гусеницы (борта)
    var tk = ((now * (u.moveT != null && wt - u.moveT < 0.2 ? 6 : 0)) | 0) % 2;
    [-25, 17].forEach(function (ty) {
      c.fillStyle = alive('tracks') ? pal.tread : pal.rockLo; c.fillRect(-38, ty, 74, 8); if (hot('tracks')) { c.strokeStyle = pal.warn; c.lineWidth = 1.5; c.strokeRect(-38.5, ty - 0.5, 75, 9); }
      if (alive('tracks')) { c.fillStyle = pal.metal; for (var s = -37 + tk * 3; s < 35; s += 6) c.fillRect(s, ty + 1, 2, 6); }
      else { c.fillStyle = pal.glow; c.fillRect(-10, ty + 2, 5, 3); c.fillStyle = pal.metal; c.fillRect(10, ty - 2, 6, 3); c.fillRect(-27, ty + 6, 7, 3); }
    });
    // корпус
    c.fillStyle = dk; if (px) c.fillRect(-32, -18, 58, 36); else { roundRect(c, -32, -18, 58, 36, 5); c.fill(); }
    c.fillStyle = own; c.fillRect(-29, -15, 52, 4); c.fillRect(-29, 11, 52, 4);
    c.fillStyle = pal.metal; c.fillRect(-26, -10, 46, 20);
    for (var rv = -24; rv < 20; rv += 8) { c.fillStyle = pal.metalHi; c.fillRect(rv, -10, 2, 2); c.fillRect(rv, 8, 2, 2); }
    // бур спереди
    if (alive('drill')) {
      c.save(); c.translate(26, 0); var spin = now * (B.st === 'bore' ? 14 : 2.5);
      c.fillStyle = pal.metalHi; c.beginPath(); c.moveTo(0, -12); c.lineTo(22, 0); c.lineTo(0, 12); c.closePath(); c.fill(); if (hot('drill')) { c.strokeStyle = pal.warn; c.lineWidth = 1.5; c.stroke(); }
      c.strokeStyle = pal.tread; c.lineWidth = 2; for (var sp = 0; sp < 4; sp++) { var o2 = ((spin * 3 + sp * 5.5) % 22); c.beginPath(); c.moveTo(o2, -12 + o2 * 0.55); c.lineTo(o2 + 3, 12 - (o2 + 3) * 0.55); c.stroke(); }
      if (B.st === 'bore') for (var db = 0; db < 4; db++) { c.fillStyle = db % 2 ? pal.oreHi : pal.rockHi; c.fillRect(22 + Math.sin(now * 23 + db) * 6, Math.cos(now * 19 + db * 2) * 9, 3, 3); }
      c.restore();
    } else { c.fillStyle = pal.rockLo; c.fillRect(26, -7, 8, 14); c.fillStyle = pal.glow; c.fillRect(28, -2, 3, 4); }
    // котёл в середине: топка светится, труба дымит; сбит — тёмный, без дыма
    if (alive('boiler')) {
      c.fillStyle = pal.metalHi; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill(); if (hot('boiler')) { c.strokeStyle = pal.warn; c.lineWidth = 1.5; c.stroke(); }
      c.fillStyle = pal.metal; c.beginPath(); c.arc(0, 0, 8.5, 0, 7); c.fill();
      c.fillStyle = pal.glow; c.globalAlpha = 0.6 + 0.3 * Math.sin(now * 5); c.fillRect(-5, -3, 10, 6); c.globalAlpha = 1;
      c.fillStyle = pal.tread; c.beginPath(); c.arc(8, -9, 3.5, 0, 7); c.fill();
      if (B.st === 'vent' || (B.st === 'warn' && Math.sin(now * 20) > 0)) for (var vq = 0; vq < 2; vq++) puff(u.x + (Math.random() - 0.5) * 2.4, u.y + (Math.random() - 0.5) * 2.4, 1.6);
      else if (hash(u.id, (now * 4) | 0) < 0.5) puff(u.x, u.y - 0.3, 1.2);
    } else { c.fillStyle = pal.rockLo; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill(); c.fillStyle = pal.tread; c.beginPath(); c.arc(1, 1, 7, 0, 7); c.fill(); }
    // кабина на корме: будка машиниста с окнами и пушкой на крыше (поворачивается отдельно)
    if (alive('cabin')) {
      c.fillStyle = dk; c.fillRect(-31, -11, 15, 22); if (hot('cabin')) { c.strokeStyle = pal.warn; c.lineWidth = 1.5; c.strokeRect(-31.5, -11.5, 16, 23); } c.fillStyle = own; c.fillRect(-30, -10, 13, 3);
      c.fillStyle = pal.waterHi; c.fillRect(-19, -6, 2, 4); c.fillRect(-19, 2, 2, 4);
      c.save(); c.translate(-23, 0); c.rotate((u.aim == null ? u.heading : u.aim) - u.heading);
      c.fillStyle = pal.tread; c.fillRect(0, -2, 17, 4); if (wt - (u.fireT == null ? -9 : u.fireT) < 0.08) { c.fillStyle = pal.glow; c.beginPath(); c.arc(19, 0, 4, 0, 7); c.fill(); }
      c.fillStyle = pal.metalHi; c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.fill(); c.restore();
    } else { c.fillStyle = pal.rockLo; c.fillRect(-31, -11, 15, 22); c.fillStyle = pal.tread; c.fillRect(-28, -6, 8, 5); c.fillStyle = pal.glow; c.fillRect(-25, 3, 3, 3); }
    c.restore();
    if (u.bs && u.bs.stun > 0) for (var sq = 0; sq < 2; sq++) puff(u.x + (Math.random() - 0.5) * 3, u.y + (Math.random() - 0.5) * 3, 1.8); // обварена гейзером — стоит в пару
  }
  // полоски узлов над громадой: гусеницы, бур, кабина, котёл (сбитый — пустая)
  function drawParts(c, u, pal) {
    if (!u.parts) return; var x0 = u.x * T - 46, y0 = u.y * T - 52, w = 21;
    u.parts.forEach(function (p, n) {
      var bx = x0 + n * (w + 3), f = p.hp / p.maxHp;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(bx - 1, y0 - 1, w + 2, 7);
      c.fillStyle = f > 0.5 ? pal.good : f > 0.2 ? pal.warn : pal.bad; c.fillRect(bx, y0, w * f, 5);
      c.fillStyle = f > 0 ? pal.ink : pal.muted; var ix = bx + w / 2, iy = y0 - 6; // значок узла
      if (p.k === 'tracks') { c.fillRect(ix - 7, iy - 2, 14, 2); c.fillRect(ix - 7, iy + 2, 14, 2); }
      else if (p.k === 'drill') { c.beginPath(); c.moveTo(ix - 5, iy - 3); c.lineTo(ix + 6, iy); c.lineTo(ix - 5, iy + 3); c.closePath(); c.fill(); }
      else if (p.k === 'cabin') { c.fillRect(ix - 4, iy - 3, 8, 6); c.fillRect(ix + 4, iy - 1, 4, 2); }
      else { c.beginPath(); c.arc(ix, iy, 3.5, 0, 7); c.fill(); }
    });
  }
  // ---------- огонь и бочки с водой ----------
  function drawFires(c, W, pal, now) {
    W.fires.forEach(function (f) {
      var k = Math.floor(f.y) * W.w + Math.floor(f.x); if (!W.vis[k]) return;
      var fx = f.x * T, fy = f.y * T, s = f.hp / f.max, R = f.r * T;
      c.fillStyle = pal.pixel ? 'rgba(170,0,0,0.35)' : 'rgba(255,110,40,' + (0.12 + 0.18 * s).toFixed(3) + ')'; c.beginPath(); c.arc(fx, fy, R, 0, 7); c.fill();
      for (var q = 0; q < 6; q++) {
        var a = q * 1.05 + f.id, ox = Math.cos(a) * R * 0.5, oy = Math.sin(a) * R * 0.35, fl = (6 + 7 * s) * (0.75 + 0.25 * Math.sin(now * 11 + q * 1.7 + f.id));
        c.fillStyle = q % 2 ? pal.bad : pal.glow; c.beginPath(); c.moveTo(fx + ox - fl * 0.45, fy + oy); c.quadraticCurveTo(fx + ox, fy + oy - fl * 2.1, fx + ox + fl * 0.45, fy + oy); c.fill();
        c.fillStyle = pal.warn; c.fillRect(fx + ox - 1.5, fy + oy - fl * 0.7, 3, 3);
      }
      if (hash(f.id, (now * 5) | 0) < 0.5 * s + 0.1) puff(f.x + (Math.random() - 0.5) * f.r, f.y - 0.3, 1 + s);
      if (s < 0.999) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(fx - 13, fy + R + 2, 26, 4); c.fillStyle = pal.warn; c.fillRect(fx - 12, fy + R + 3, 24 * s, 2); }
    });
    W.depots.forEach(function (dp) {
      var k = Math.floor(dp.y) * W.w + Math.floor(dp.x); if (!W.vis[k]) return;
      var n = Math.ceil(Math.min(8, dp.w / 50)), bx = dp.x * T, by = dp.y * T;
      if (dp.kind === 'sand') { // куча песка с лопатой
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(bx + 1, by + 7, 24, 8, 0, 0, 7); c.fill();
        c.fillStyle = pal.pixel ? '#aa5500' : '#b89a5e'; c.beginPath(); c.moveTo(bx - 22, by + 8); c.quadraticCurveTo(bx - 6, by - 20, bx + 4, by - 8); c.quadraticCurveTo(bx + 14, by - 14, bx + 22, by + 8); c.closePath(); c.fill();
        c.fillStyle = pal.pixel ? '#ffff55' : '#d9c084'; c.beginPath(); c.moveTo(bx - 12, by + 2); c.quadraticCurveTo(bx - 5, by - 13, bx + 2, by - 4); c.closePath(); c.fill();
        c.fillStyle = pal.tread; c.fillRect(bx + 12, by - 16, 2, 16); c.fillStyle = pal.metalHi; c.fillRect(bx + 10, by - 2, 6, 6);
        return;
      }
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(bx + 1, by + 6, 20, 8, 0, 0, 7); c.fill();
      for (var b = 0; b < Math.max(n, 1); b++) {
        var ix = bx - 15 + (b % 4) * 10, iy = by - 2 - Math.floor(b / 4) * 9; c.fillStyle = b < n ? pal.roof : pal.rockLo; c.fillRect(ix, iy, 9, 10);
        c.fillStyle = b < n ? pal.water : pal.rockLo; c.fillRect(ix + 1, iy + 1, 7, 2); c.fillStyle = pal.tread; c.fillRect(ix, iy + 4, 9, 1.5);
      }
    });
  }
  // клети шахты: площадка с рамой копра; клеть на месте — ящик с решёткой, иначе — пустой ствол с канатом; отсчёт посадки и пути
  function drawLifts(c, W, pal, now) {
    W.lifts.forEach(function (lf) {
      ['a', 'b'].forEach(function (end) {
        var p = lf[end], k = Math.floor(p.y) * W.w + Math.floor(p.x); if (!W.vis[k]) return;
        var x = p.x * T, y = p.y * T, here = lf.at === end && lf.st !== 'move', s = 15;
        c.fillStyle = pal.pixel ? '#000000' : 'rgba(8,6,5,0.85)'; c.fillRect(x - s, y - s, s * 2, s * 2);
        c.strokeStyle = lf.on ? pal.metalHi : pal.rockLo; c.lineWidth = 3; c.strokeRect(x - s + 1.5, y - s + 1.5, s * 2 - 3, s * 2 - 3);
        c.strokeStyle = pal.tread; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - s - 8); c.lineTo(x, y - (here ? 9 : -s + 4)); c.stroke(); // канат
        c.fillStyle = pal.metal; c.fillRect(x - s - 2, y - s - 10, s * 2 + 4, 4); c.fillStyle = pal.metalHi; c.beginPath(); c.arc(x, y - s - 8, 4, 0, 7); c.fill(); // шкив
        if (here) {
          c.fillStyle = lf.on ? pal.roof : pal.rockLo; c.fillRect(x - 10, y - 9, 20, 19); c.fillStyle = lf.on ? pal.roofHi : pal.rock; c.fillRect(x - 10, y - 9, 20, 3);
          c.strokeStyle = pal.tread; c.lineWidth = 1.5; c.beginPath(); for (var q = -6; q <= 6; q += 4) { c.moveTo(x + q, y - 6); c.lineTo(x + q, y + 10); } c.stroke();
          if (lf.on && lf.st === 'idle') { c.fillStyle = pal.good; c.fillRect(x + s - 6, y - s + 3, 3, 3); }
        }
        var lab = null, col = pal.warn;
        if (!lf.on) { lab = '×'; col = pal.muted; }
        else if (lf.st === 'load' && here) lab = String(Math.ceil(lf.t));
        else if (lf.st === 'move') { lab = (lf.to === end ? '▼ ' : '▲ ') + Math.ceil(lf.t); if (lf.riders.length) lab += ' · ' + lf.riders.length + '/' + lf.cap; }
        if (lab) { c.font = '900 13px ' + pal.font; var lw = c.measureText(lab).width + 10; c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(x - lw / 2, y + s + 3, lw, 17); txt(c, lab, x, y + s + 16, { color: col, font: pal.font, size: 13, weight: 900, align: 'center' }); }
      });
    });
  }
  // струя водовоза: капли от брандспойта к огню
  function drawSpray(c, W, pal, now) {
    W.units.forEach(function (u) {
      if (!u.sprayT || W.time - u.sprayT > 0.12 || !L.visibleTo0(W, u)) return;
      var a = u.aim == null ? u.heading : u.aim, L2 = (L.H2O.hose + 1.3) * T;
      for (var q = 0; q < 9; q++) { var t = ((now * 3 + q / 9) % 1), d = 12 + t * L2; c.fillStyle = q % 2 ? pal.waterHi : pal.water; c.fillRect(u.x * T + Math.cos(a) * d - 1.5 + Math.sin(q * 7) * 2, u.y * T + Math.sin(a) * d - 1.5 + Math.cos(q * 5) * 2, 3, 3); }
    });
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
    if (W.lifts && W.lifts.length) drawLifts(c, W, pal, now);
    // точки сбора выбранного здания
    S.sel.forEach(function (id) { var b = W.byId[id]; if (b && b.kind === 'bld' && b.rally && b.owner === 0) { var cx = (b.tx + b.w / 2) * T, cy = (b.ty + b.h) * T; c.strokeStyle = pal.own[0]; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(b.rally.x * T, b.rally.y * T); c.stroke(); c.setLineDash([]); c.fillStyle = pal.own[0]; c.fillRect(b.rally.x * T - 1, b.rally.y * T - 12, 2, 12); c.fillRect(b.rally.x * T, b.rally.y * T - 12, 7, 5); } });
    W.blds.forEach(function (b) { if (b.tx + b.w < i0 || b.tx > i1 + 1 || b.ty + b.h < j0 || b.ty > j1 + 1) return; if (L.visibleTo0(W, b)) drawBld(c, b, pal, now); });
    if (W.fac) drawCables(c, W, pal, now); // канатная дорога Сизых
    // приказы: метки клика
    S.marks.forEach(function (m) { var k = m.life / 0.6, col = m.kind === 'attack' ? pal.bad : m.kind === 'harvest' || m.kind === 'return' ? pal.oreHi : pal.good; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(m.x * T, m.y * T, 4 + (1 - k) * 10, 0, 7); c.globalAlpha = k; c.stroke(); c.globalAlpha = 1; });
    W.units.forEach(function (u) { if (u.x < i0 - 2 || u.x > i1 + 3 || u.y < j0 - 2 || u.y > j1 + 3) return; if (L.visibleTo0(W, u)) { drawUnit(c, u, pal, now);
      if (u.owner !== 0 && L.friendTo0(W, u.owner) && u.id) { c.fillStyle = pal.good; c.strokeStyle = '#000'; c.lineWidth = 1; var ar = L.UNITS[u.type].r * T; c.beginPath(); c.arc(u.x * T + ar * 0.8, u.y * T - ar * 0.8, 2.6, 0, 7); c.fill(); c.stroke(); } } }); // зелёная точка — союзник
    if (W.fires.length || W.depots.length) drawFires(c, W, pal, now);
    drawSpray(c, W, pal, now);
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
      if (f.t === 'ping') { c.fillStyle = pal.sel; c.globalAlpha = k; for (var pq = 0; pq < 3; pq++) c.fillRect(f.x * T + Math.cos(pq * 2.1 + k * 4) * 6 * (1.2 - k), f.y * T + Math.sin(pq * 2.1 + k * 4) * 6 * (1.2 - k), 2, 2); c.globalAlpha = 1; }
      else if (f.t === 'tracer') { c.strokeStyle = pal.oreHi; c.lineWidth = 1; c.globalAlpha = k; c.beginPath(); c.moveTo(f.x0 * T, f.y0 * T); c.lineTo(f.x * T, f.y * T); c.stroke(); c.globalAlpha = 1; }
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
    S.sel.forEach(function (id) { var e = W.byId[id]; mark(e, e && e.owner === 0 ? pal.sel : e && L.friendTo0(W, e.owner) ? pal.good : pal.bad); });
    if (S.hover && !S.sel.has(S.hover.id)) mark(S.hover, S.hover.owner === 0 ? 'rgba(255,255,255,0.45)' : L.friendTo0(W, S.hover.owner) ? pal.good : pal.bad);
    W.units.forEach(function (u) { if (u.parts && L.visibleTo0(W, u)) drawParts(c, u, pal); });
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
    // сообщения: по центру; если строка налезла бы на блок целей миссии (S.objBox — слева вверху) — сдвигаем вправо от него,
    // а не помещается — опускаем под блок
    var y = S.msgY || 44, ob = S.objBox; S.msgs.forEach(function (m) {
      var a = Math.min(1, m.life); c.globalAlpha = a; c.font = '700 14px ' + f; var w = c.measureText(m.text).width + 20, cx = LAYOUT.W / 2;
      if (ob && y - 16 < ob.b && cx - w / 2 < ob.r + 6) { if (w <= LAYOUT.W - 8 - (ob.r + 6)) cx = ob.r + 6 + w / 2; else y = ob.b + 22; }
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(cx - w / 2, y - 16, w, 22);
      txt(c, m.text, cx, y, { color: m.col ? pal[m.col] : pal.ink, font: f, size: 14, align: 'center' }); c.globalAlpha = 1; y += 26;
    });
    var tip = S.placing ? t('tipPlace') : S.panelHover ? t('tipPanel') : (S.sel.size ? (W.lifts && W.lifts.length ? t('liftTip') : t('tipCmd')) : '');
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
      var gp = groundPal(W, S.th, pal), cg = col(gp.g1), cr = col(gp.rock || pal.rock), cw = col(pal.water), co = col(pal.ore), ci = col(gp.ice), cop = col(gp.open), cbr = col(pal.roofHi), cpit = col(gp.pitHi), csh = col(gp.shaky);
      for (var k = 0; k < W.w * W.h; k++) {
        var tk = W.t[k], v = W.vis[k], cc = tk === L.ROCK ? cr : tk === L.WATER ? cw : tk === L.ICE ? ci : tk === L.OPEN ? cop : tk === L.BRIDGE ? cbr : tk === L.PIT ? cpit : W.ore[k] ? co : tk === L.SHAKY ? csh : cg, m = v === 0 ? 0 : v === 1 ? 0.55 : 1;
        if (v === 0) { d[k * 4] = 26; d[k * 4 + 1] = 29; d[k * 4 + 2] = 34; } else { d[k * 4] = cc[0] * m; d[k * 4 + 1] = cc[1] * m; d[k * 4 + 2] = cc[2] * m; } d[k * 4 + 3] = 255;
      }
      mc.putImageData(img, 0, 0);
    }
    c.fillStyle = '#000'; c.fillRect(M.x - 1, M.y - 1, M.w + 2, M.h + 2);
    c.imageSmoothingEnabled = false; c.drawImage(mm.cv, M.x, M.y, W.w * M.s, W.h * M.s); c.imageSmoothingEnabled = !pal.pixel;
    W.blds.forEach(function (b) { if (!L.visibleTo0(W, b)) return; c.fillStyle = pal.own[b.pi != null ? b.pi : b.owner]; c.fillRect(M.x + b.tx * M.s, M.y + b.ty * M.s, b.w * M.s, b.h * M.s); });
    W.units.forEach(function (u) { if (!L.visibleTo0(W, u)) return; c.fillStyle = S.sel.has(u.id) ? pal.sel : pal.own[u.pi != null ? u.pi : u.owner]; var us2 = u.parts ? 5 : 2.5; c.fillRect(M.x + u.x * M.s - us2 / 2, M.y + u.y * M.s - us2 / 2, us2, us2); });
    (W.lifts || []).forEach(function (lf) { ['a', 'b'].forEach(function (e) { var q = lf[e]; if (!W.vis[Math.floor(q.y) * W.w + Math.floor(q.x)]) return; c.fillStyle = '#000'; c.fillRect(M.x + q.x * M.s - 3, M.y + q.y * M.s - 3, 6, 6); c.fillStyle = lf.on ? pal.warn : pal.muted; c.fillRect(M.x + q.x * M.s - 2, M.y + q.y * M.s - 2, 4, 4); }); });
    if (W.fires.length) { c.fillStyle = pal.glow; W.fires.forEach(function (f) { if (W.vis[Math.floor(f.y) * W.w + Math.floor(f.x)]) c.fillRect(M.x + f.x * M.s - 1.5, M.y + f.y * M.s - 1.5, 3, 3); }); }
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
  // Сторона Сизых (W.fac[0] === 'sizye', мир — P.S.W): свои кнопки (ветряк, опора, зимовьё…); в миссии — только открытые ею и укрепления
  function setButtons(bl, ul) {
    var W = P.S && P.S.W;
    if (W && L.facOf(W, 0) === 'sizye') {
      var sl = L.sideLists('sizye'), al = W.mission && W.mission.allow, has = al && Object.keys(al).length;
      bl = sl.b.concat(L.FORT_LIST).filter(function (k) { return has ? al[k] : sl.b.indexOf(k) >= 0; });
      ul = sl.u.filter(function (k) { return has ? al[k] : true; });
    }
    var nb = buttons(bl || L.BUILD_LIST, ul || L.UNIT_LIST); BTNS.length = 0; nb.forEach(function (b) { BTNS.push(b); }); return BTNS;
  }
  // ветер Сизых: стрелка «куда дует» и сила
  function windGauge(c, W, x, y, pal) {
    var w = W.wind, a = w.a + Math.PI; c.save(); c.translate(x, y); c.strokeStyle = pal.line; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.stroke();
    c.rotate(a); c.strokeStyle = pal.own[1]; c.lineWidth = 2; c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.lineTo(3, -3); c.moveTo(7, 0); c.lineTo(3, 3); c.stroke(); c.restore();
    txt(c, Math.round(w.s * 100) + '%', x + 13, y + 5, { color: w.s < 0.55 ? pal.warn : pal.ink, font: pal.font, size: 11, weight: 700 });
  }
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
      drawBld(c, { tx: 0, ty: 0, w: d.w, h: d.h, type: type, owner: 0, id: 0, pi: SZ_TYPES[type] ? 1 : 0 }, pal, 0, true);
    } else {
      c.scale(1.25, 1.25); drawUnit(c, { x: 12 / T, y: 12 / T, heading: -Math.PI / 4, aim: -Math.PI / 4, type: type, owner: 0, pi: SZ_TYPES[type] ? 1 : 0, fireT: -9, path: [], order: {}, carry: 120, id: 0 }, pal, 0);
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
    var szw = L.facOf(W, 0) === 'sizye'; txt(c, t(szw ? 'steamS' : 'steam'), ix + 140, VH + 20, { color: pal.muted, font: f, size: 12, weight: 600 });
    if (szw && W.wind) windGauge(c, W, ix + 262, VH + 15, pal);
    txt(c, pl.pUse + ' / ' + pl.pOut, ix + (szw ? 186 : 175), VH + 21, { color: low ? pal.bad : pal.good, font: f, size: 14, weight: 800 });
    c.fillStyle = pal.line; c.fillRect(ix, VH + 28, 288, 5);
    c.fillStyle = low ? pal.bad : pal.good; c.fillRect(ix, VH + 28, 288 * Math.min(1, pl.pUse / Math.max(1, pl.pOut)), 5);
    }
    // выделение
    var sel = []; S.sel.forEach(function (id) { if (W.byId[id]) sel.push(W.byId[id]); });
    var y0 = VH + 50;
    if (sel.length === 1) {
      var e = sel[0], fr = L.friendTo0(W, e.owner), nm = t(e.type === 'hq' && e.look === 'sizye' ? 'hqS' : e.type) + (e.owner !== 0 ? ' · ' + t(fr ? 'ally' : 'foe') : '');
      txt(c, nm, ix, y0, { color: e.owner === 0 ? pal.ink : pal.own[e.pi != null ? e.pi : e.owner], font: f, size: 14, weight: 800 });
      hpBar(c, ix, y0 + 8, 200, e.hp / e.maxHp, pal);
      txt(c, Math.ceil(e.hp) + ' / ' + e.maxHp, ix + 208, y0 + 13, { color: pal.muted, font: f, size: 11, weight: 600 });
      var extra = '';
      if (e.packed) extra = t('packedOf') + ': ' + t(e.packed.type);
      else if (e.type === 'drill') extra = t('drillTip');
      else if (e.type === 'sapper') extra = t('sapperTip');
      else if (e.kind === 'unit' && L.waterCap(W, e) > 0 && (e.type === 'bowser' || e.order.t === 'douse' || e.water > 0)) extra = t(e.type === 'bowser' ? 'water' : 'sand') + ': ' + Math.round(e.water || 0) + ' / ' + L.waterCap(W, e) + ' · ' + t('bowserTip');
      else if (e.type === 'hauler') extra = t('load') + ': ' + e.carry + ' / ' + (W.haulCap || L.UNITS.hauler.cap);
      else if (e.type === 'engineer') extra = t('engineerTip');
      else if (e.type === 'colossus') extra = e.parts.map(function (cp) { return t('part_' + cp.k) + ' ' + (cp.hp > 0 ? Math.ceil(cp.hp / cp.maxHp * 100) + '%' : '✕'); }).join(' · ');
      else if (e.type === 'store') extra = e.stock ? t('storeTip') + ' · ' + e.stock : t('storeEmpty');
      else if (e.type === 'pump') extra = t('pumpTip');
      else if (e.type === 'mill') extra = e.pw > 0 ? t('steamS') + ' +' + e.pw + (L.sheltered(W, e) ? ' · ' + t('millShade') : '') : t(L.onHigh(W, e.tx, e.ty, e.w, e.h) ? 'millDead' : 'millLow');
      else if (e.type === 'face') extra = e.dry ? t('rigDry') : t('stock') + ' ' + Math.floor(e.stock || 0) + ' / ' + L.FACE.stock + (e.link === false ? ' · ' + t('noLink') : '');
      else if (e.type === 'pylon') extra = e.cut ? t('cutTip') + (e.cutP > 0 ? ' · ' + Math.round(e.cutP / ((W.ropeFix && W.ropeFix.time) || 8) * 100) + '%' : '') : t('pylonTip');
      else if (e.type === 'rig') extra = e.dry ? t('rigDry') : '+' + (W.rigRate || L.BLDS.rig.rate) + ' ' + t('perSec') + ' · ' + t('rigLeft') + ' ' + L.rigOre(W, e);
      else if (e.kind === 'unit') { var ud = L.UNITS[e.type]; extra = e.locked ? t('scripted') : '⚔ ' + ud.dmg + '  ⌖ ' + ud.range + '  ⇢ ' + ud.speed; }
      else { var bd = L.BLDS[e.type]; extra = bd.weapon ? '⚔ ' + bd.dmg + '  ⌖ ' + bd.range : bd.power ? t(L.facOf(W, 0) === 'sizye' ? 'steamS' : 'steam') + ' ' + (bd.power > 0 ? '+' : '') + bd.power : ''; }
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
      var szi = L.facOf(W, 0) === 'sizye';
      txt(c, S.idleTitle || t(szi ? 'sideSizye' : 'me'), ix, y0, { color: pal.own[szi ? 1 : 0], font: f, size: 14, weight: 800 });
      txt(c, S.idleSub != null ? S.idleSub : t(szi ? 'hint1S' : 'hint1').split('.')[0], ix, y0 + 22, { color: pal.muted, font: f, size: 11, weight: 600 });
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
      if (b.kind === 'unit') { var inf = !!L.INF_FAC[d.from], q = inf ? pl.inf : pl.veh; qn = q.filter(function (x) { return x === b.type; }).length; if (q[0] === b.type) prog = inf ? pl.infP : pl.vehP; }
      if (prog > 0) { c.fillStyle = 'rgba(95,207,128,0.22)'; c.fillRect(b.x + 1, b.y + 1, (b.w - 2) * prog, b.h - 2); }
      c.globalAlpha = can ? 1 : 0.35;
      var lb = t(b.type), ls = 12; c.font = '700 12px ' + f;
      if (c.measureText(lb).width > b.w - 44) { // узкая кнопка (5–6 в ряду): название — строкой сверху на всю ширину, значок ниже
        while (ls > 8 && c.measureText(lb).width > b.w - 8) { ls--; c.font = '700 ' + ls + 'px ' + f; }
        txt(c, lb, b.x + 5, b.y + 13, { color: pal.ink, font: f, size: ls, weight: 700 });
        c.save(); c.translate(b.x + 5, b.y + 18); c.scale(0.9, 0.9); drawIcon(c, b.kind, b.type, 0, 0, pal); c.restore();
        txt(c, String(d.cost), b.x + 38, b.y + 40, { color: pl.copper >= d.cost ? pal.oreHi : pal.bad, font: f, size: 12, weight: 700 });
      } else {
        drawIcon(c, b.kind, b.type, b.x + 4, b.y + 9, pal);
        txt(c, lb, b.x + 40, b.y + 20, { color: pal.ink, font: f, size: ls, weight: 700 });
        txt(c, String(d.cost), b.x + 40, b.y + 38, { color: pl.copper >= d.cost ? pal.oreHi : pal.bad, font: f, size: 12, weight: 700 });
      }
      c.globalAlpha = 1;
      if (locked) { c.fillStyle = pal.muted; c.globalAlpha = 0.7; c.fillRect(b.x + b.w - 15, b.y + 9, 9, 7); c.strokeStyle = pal.muted; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x + b.w - 10.5, b.y + 9, 3, Math.PI, 0); c.stroke(); c.globalAlpha = 1; } // замок
      if (ready) { c.globalAlpha = 0.6 + 0.4 * Math.sin(W.time * 6); txt(c, t('ready'), b.x + b.w - 6, b.y + 38, { color: pal.good, font: f, size: 11, weight: 800, align: 'right' }); c.globalAlpha = 1; }
      if (qn > 1) txt(c, '×' + qn, b.x + b.w - 6, b.y + 38, { color: pal.warn, font: f, size: 12, weight: 800, align: 'right' });
    });
  }
  function buttonAt(x, y, S) { for (var n = 0; n < BTNS.length; n++) { var b = BTNS[n]; if (S && S.btnHidden && S.btnHidden(b)) continue; if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b; } return null; }

  P.render = { MINE: MINE, drawLifts: drawLifts, drawColossus: drawColossus, drawParts: drawParts, frame: frame, packBtn: packBtn, HEAT: HEAT, LAYOUT: LAYOUT, PAL: PAL, SNOW: SNOW, TILE: T, buttonAt: buttonAt, BTNS: BTNS, setButtons: setButtons, groupAt: groupAt, groupRect: groupRect, repairBtn: repairBtn, fitMinimap: fitMinimap, drawIcon: drawIcon, drawBld: drawBld, drawUnit: drawUnit, drawCables: drawCables, SZ: SZ, SZ_TYPES: SZ_TYPES, windGauge: windGauge, txt: txt, roundRect: roundRect, groundPal: groundPal,
    resetCache: function () { cache.key = ''; mm.t = -1; puffs.length = 0; } };
})(window);
