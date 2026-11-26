/* ДРУЖИНА · тема HD v2 — фоны этапов: спокойный параллакс прямо пикселями палитры (матрицы индексов → холсты, один раз на этап).
   Слои: небо (неподвижно, полосы со «ступенькой»-шахматкой вместо градиента), дальний (×0.15), средний (×0.5), земля (×1);
   слои — бесшовные плитки (земля — 512 px, швы кладки и решётки — с разбросом шага, чтобы повтор не бросался в глаза; волна 48). Пар — живые частицы из видимых источников: трубы кузниц и литейни, горячие ключи в лесу,
   туман над рекой, решётки в полу; клубы — пиксельные круги двумя тонами. Фон меню — те же слои на 2 ступени темнее (без полупрозрачности).
   Поле 480×270 (×2 к холсту игры 960×540); линия ног z=0 — y=161. DRUZHINA.hdWorld */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  var S = D.hdSprites, PAL = S.PAL, K = S.KEY, SH = S.SHADE;
  var VW = 480, VH = 270, HZ = 148, PAR = { far: 0.15, mid: 0.5 }, TW = { far: 512, mid: 640, floor: 512 };

  function grid(w, h) { return { w: w, h: h, a: new Uint8Array(w * h) }; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function PX(m) { return function (c, x, y, w, h) { c = typeof c === 'string' ? K[c] : c; x = x | 0; y = y | 0; w = (w || 1) | 0; h = (h || 1) | 0;
    for (var yy = Math.max(0, y); yy < Math.min(m.h, y + h); yy++) for (var xx = x; xx < x + w; xx++) { var X = ((xx % m.w) + m.w) % m.w; m.a[yy * m.w + X] = c; } }; }   // по X — с заворотом (плитка)
  function checker(px, c, x, y, w, h, ph) { for (var yy = 0; yy < h; yy++) for (var xx = (yy + (ph || 0)) & 1; xx < w; xx += 2) px(c, x + xx, y + yy); }
  function bands(px, w, list) {   // [[y, цвет], …] — полосы неба со ступенькой-шахматкой на стыке
    for (var i = 0; i < list.length; i++) { var y0 = list[i][0], y1 = i + 1 < list.length ? list[i + 1][0] : HZ + 2; px(list[i][1], 0, y0, w, y1 - y0); if (i) checker(px, list[i - 1][1], 0, y0, w, 2); }
  }
  function toCanvas(m, dark) {
    var c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
    var x = c.getContext('2d'), im = x.createImageData(m.w, m.h), d = im.data;
    for (var i = 0; i < m.a.length; i++) { var v = m.a[i]; if (!v) continue; for (var k = 0; k < (dark || 0); k++) v = SH[v] || v; var h = PAL[v]; d[i * 4] = parseInt(h.slice(1, 3), 16); d[i * 4 + 1] = parseInt(h.slice(3, 5), 16); d[i * 4 + 2] = parseInt(h.slice(5, 7), 16); d[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); return c;
  }

  // ---------- Детали ----------
  function chimney(px, src, layer, x, top, h, col, steam) {
    px(col[0], x, top, 6, h); px(col[1], x + 1, top, 1, h); px(col[2], x + 5, top, 1, h); px(col[1], x - 1, top - 2, 8, 2);
    if (steam !== false) src.push({ layer: layer, x: x + 3, y: top - 3, rate: 0.07 + (x % 7) * 0.006, size: layer === 'far' ? 3 : 4, t: (x % 13) / 13 });
  }
  function logWall(px, x, y, w, h, a, b) { for (var yy = y; yy < y + h; yy++) px((yy - y) % 4 === 3 ? b : a, x, yy, w, 1); for (var yy2 = y + 1; yy2 < y + h; yy2 += 4) { px('o', x, yy2, 1, 1); px('o', x + w - 1, yy2, 1, 1); } }
  function roof(px, x, top, w, h, a, edge) { for (var i = 0; i < h; i++) px(i === 0 ? edge : a, x - 4 + i, top + i - h, w + 8 - i * 2, 1); }
  function gable(px, x, base, w, h, a, edge) { var cx = x + w / 2; for (var i = 0; i < h; i++) { var half = Math.round((w / 2 + 4) * (i + 1) / h); px(i === h - 1 ? edge : a, cx - half, base - h + i, half * 2, 1); } for (var j = 0; j < h; j++) { var hf = Math.round((w / 2 + 4) * (j + 1) / h); px(edge, cx - hf, base - h + j, 1, 1); px('k', cx + hf - 1, base - h + j, 1, 1); } }
  function window_(px, x, y, lit) { px('k', x - 1, y - 1, 10, 10); px(lit ? 'o' : 'n', x, y, 8, 8); if (lit) { px('g', x + 1, y + 1, 3, 3); checker(px, 'c', x, y + 5, 8, 3); } px('w', x + 3, y, 2, 8); px('w', x, y + 3, 8, 2); }
  function forgeDoor(px, x, base, w, h) { px('k', x - 2, base - h - 2, w + 4, h + 2); px('r', x, base - h, w, h); px('c', x + 2, base - h + 4, w - 4, h - 4); checker(px, 'o', x + 4, base - h + 9, w - 8, h - 9); px('g', x + w / 2 - 2, base - 7, 4, 3); px('k', x + w / 2 - 6, base - 6, 12, 3); px('k', x + w / 2 - 2, base - 3, 4, 3); }
  function pine(px, x, base, h, a, b) { for (var i = 0; i < h; i++) { var half = Math.round((i / h) * h * 0.32) + (i % 5 === 4 ? -1 : 0); px(i % 6 < 2 && b ? b : a, x - half, base - h + i, half * 2 + 1, 1); } px(a, x, base - 2, 1, 2); }
  function grass(px, r, w, y0, h, base, tuft) { px(base, 0, y0, w, h); for (var i = 0; i < w / 3; i++) { var x = r() * w, y = y0 + r() * (h - 2); px(tuft, x, y, 1, 2); if (r() < 0.4) px(tuft, x + 1, y + 1, 1, 1); } }

  // ---------- Этапы: [небо, дальний, средний, земля] ----------
  var BUILD = {
    trakt: function (L, r) {
      bands(L.skyP, VW, [[0, 'n'], [62, 'p'], [96, 'w'], [124, 'r']]);
      for (var i = 0; i < 40; i++) L.skyP(r() < 0.7 ? 'l' : 'm', r() * VW, r() * 56);
      for (var x = 0; x < TW.far; x += 2) { var hh = 14 + Math.round(8 * Math.sin(x / 60) + 5 * Math.sin(x / 23)); L.farP('p', x, HZ - hh, 2, hh + 4); }
      for (var c = 30; c < TW.far; c += 120) { L.farP('k', c, HZ - 30, 18, 22); L.farP('c', c + 4, HZ - 22, 3, 2); L.farP('c', c + 10, HZ - 22, 3, 2); chimney(L.farP, L.src, 'far', c + 12, HZ - 44, 16, ['k', 'p', 'k']); }
      var x2 = 10;
      while (x2 < TW.mid - 100) {
        var w = 84 + Math.round(r() * 30), h = 46 + Math.round(r() * 10), base = HZ + 2;
        logWall(L.midP, x2, base - h, w, h, 'w', 'p'); gable(L.midP, x2, base - h, w, 18, 'p', 'r');
        forgeDoor(L.midP, x2 + 10, base, 28, 30); window_(L.midP, x2 + w - 22, base - h + 12, r() < 0.7);
        chimney(L.midP, L.src, 'mid', x2 + w - 18, base - h - 30, 26, ['l', 'b', 'n']);
        L.midP('k', x2 + w + 6, base - 10, 14, 4); L.midP('l', x2 + w + 8, base - 6, 3, 6); L.midP('l', x2 + w + 15, base - 6, 3, 6);   // наковальня у двери
        x2 += w + 40 + Math.round(r() * 20);
        for (var f = x2 - 30; f < x2 - 6; f += 6) { L.midP('w', f, base - 14, 2, 14); } L.midP('r', x2 - 32, base - 11, 28, 2);
      }
      grass(L.floorP, r, TW.floor, 0, 13, 't', 'v');
      L.floorP('w', 0, 13, TW.floor, 122);
      for (var y = 16, row = 0; y < 122; row++) { var rh = 6 + Math.min(6, row); L.floorP('p', 0, y + rh - 1, TW.floor, 1); for (var s = 0; s < TW.floor / 20; s++) if (r() < 0.5) L.floorP(r() < 0.3 ? 'r' : 'p', r() * TW.floor, y + 1 + r() * (rh - 3), 3 + r() * 4, 1); y += rh; }
      for (var v = 60; v < TW.floor; v += 96 + (r() * 90 | 0)) { L.floorP('k', v, 6, 16, 6); for (var k = 1; k < 16; k += 3) L.floorP('l', v + k, 7, 1, 4); L.src.push({ layer: 'floor', x: v + 8, y: HZ + 6, rate: 0.04, size: 3, t: 0.3 }); }
    },
    village: function (L, r) {
      bands(L.skyP, VW, [[0, 'l'], [50, 'b'], [100, 'm'], [132, 'W']]);
      for (var x = 0; x < TW.far; x += 2) { var hh = 40 + Math.round(22 * Math.abs(Math.sin(x / 90)) + 6 * Math.sin(x / 17)); L.farP('l', x, HZ - hh, 2, hh + 2); if (hh > 54) L.farP('m', x, HZ - hh, 2, Math.min(6, hh - 54)); else L.farP('b', x, HZ - hh, 2, 1); }
      var x2 = 16;
      while (x2 < TW.mid - 90) {
        var w = 70 + Math.round(r() * 24), h = 40 + Math.round(r() * 8), base = HZ + 2;
        logWall(L.midP, x2, base - h, w, h, 'r', 'w'); gable(L.midP, x2, base - h, w, 22, 'p', 'w');
        window_(L.midP, x2 + 12, base - h + 14, r() < 0.8); window_(L.midP, x2 + w - 22, base - h + 14, r() < 0.5);
        L.midP('W', x2 + w / 2 - 3, base - h - 12, 6, 2);   // резной конёк
        chimney(L.midP, L.src, 'mid', x2 + w - 20, base - h - 26, 14, ['r', 'c', 'w']);
        x2 += w + 50 + Math.round(r() * 30);
        for (var f = x2 - 40; f < x2 - 8; f += 5) L.midP('w', f, base - 12, 2, 12);
      }
      grass(L.floorP, r, TW.floor, 0, 13, 'v', 't');
      L.floorP('w', 0, 13, TW.floor, 122); checker(L.floorP, 'v', 0, 13, TW.floor, 2);
      for (var i = 0; i < 90; i++) L.floorP(r() < 0.6 ? 'p' : 'r', r() * TW.floor, 15 + r() * 105, 2 + r() * 5, 1);
      for (var j = 0; j < 14; j++) { var gx = r() * TW.floor, gy = 30 + r() * 80; L.floorP('t', gx, gy, 8, 3); L.floorP('v', gx + 2, gy, 3, 1); }
    },
    forest: function (L, r) {
      bands(L.skyP, VW, [[0, 'n'], [70, 't'], [120, 'v']]);
      for (var x = 6; x < TW.far; x += 14 + Math.round(r() * 10)) pine(L.farP, x, HZ + 2, 40 + Math.round(r() * 40), 'n', null);
      for (var x2 = 20; x2 < TW.mid; x2 += 90 + Math.round(r() * 40)) {
        L.midP('p', x2, 0, 16, HZ + 2); L.midP('w', x2 + 2, 0, 3, HZ + 2); L.midP('k', x2 + 13, 0, 3, HZ + 2);
        for (var y = 10; y < HZ; y += 7) L.midP('r', x2 + 3, y, 1, 3);
        for (var b = 0; b < 4; b++) { var by = 4 + b * 20; for (var q = 0; q < 16; q++) { var hw = 6 + q * 1.6; L.midP(q < 2 ? 'v' : q > 12 ? 'n' : 't', x2 + 8 - hw, by + q, hw * 2, 1); if (q > 2 && q < 12 && q % 4 === 1) L.midP('v', x2 + 8 - hw, by + q, Math.round(hw * 0.7), 1); } }
        L.midP('v', x2 - 2, HZ - 4, 20, 6); L.midP('t', x2 - 4, HZ - 1, 24, 3);
        // горячий ключ у корней: пар
        var sx = x2 + 40; L.midP('l', sx, HZ - 2, 22, 4); L.midP('b', sx + 2, HZ - 2, 18, 2); L.midP('m', sx + 5, HZ - 2, 6, 1);
        L.src.push({ layer: 'mid', x: sx + 11, y: HZ - 3, rate: 0.16, size: 6, t: r() });
      }
      grass(L.floorP, r, TW.floor, 0, 13, 't', 'v');
      L.floorP('t', 0, 13, TW.floor, 122); checker(L.floorP, 'n', 0, 13, TW.floor, 2);
      for (var i = 0; i < 70; i++) L.floorP(r() < 0.6 ? 'n' : 'v', r() * TW.floor, 18 + r() * 100, 2 + r() * 4, 1);
      for (var j = 0; j < 4; j++) { var rx = r() * TW.floor, ry = 30 + r() * 70; L.floorP('w', rx, ry, 18, 2); L.floorP('r', rx + 2, ry, 10, 1); }
    },
    crossing: function (L, r) {
      bands(L.skyP, VW, [[0, 'n'], [60, 'l'], [110, 'b']]);
      L.farP('n', 0, HZ - 34, TW.far, 8); for (var x = 0; x < TW.far; x += 9) pine(L.farP, x, HZ - 30, 14 + Math.round(r() * 12), 'n', null);
      L.farP('l', 0, HZ - 26, TW.far, 30); for (var g = 0; g < 60; g++) L.farP(r() < 0.5 ? 'b' : 'm', r() * TW.far, HZ - 24 + r() * 26, 3 + r() * 6, 1);
      for (var s = 40; s < TW.far; s += 110) L.src.push({ layer: 'far', x: s, y: HZ - 6, rate: 0.06, size: 4, t: r() });
      for (var x2 = 20; x2 < TW.mid; x2 += 80) {
        L.midP('w', x2, HZ - 50, 6, 54); L.midP('r', x2 + 1, HZ - 50, 1, 54); L.midP('k', x2 + 5, HZ - 50, 1, 54); L.midP('r', x2 - 1, HZ - 52, 8, 2);
        for (var q = 0; q < 74; q++) L.midP('o', x2 + 6 + q, HZ - 44 + Math.round(6 * Math.sin(q / 74 * Math.PI)), 1, 1);
        if ((x2 / 80) % 2 === 0) { L.midP('k', x2 - 2, HZ - 44, 10, 9); L.midP('g', x2, HZ - 42, 6, 5); L.midP('o', x2 + 1, HZ - 40, 4, 2); }
      }
      L.floorP('l', 0, 0, TW.floor, 13); for (var m2 = 0; m2 < 20; m2++) L.floorP('b', r() * TW.floor, r() * 12, 6, 1);
      L.floorP('w', 0, 13, TW.floor, 122);
      for (var y = 13, row = 0; y < 135; row++) { var rh = 7 + Math.min(5, row); L.floorP('p', 0, y + rh - 1, TW.floor, 1); L.floorP('r', 0, y, TW.floor, 1); for (var n = (row % 2) * 30; n < TW.floor; n += 54 + (r() * 22 | 0)) { L.floorP('p', n, y, 1, rh); L.floorP('k', n + 2, y + 2, 1, 1); } y += rh; }
      for (var v = 30; v < TW.floor; v += 96 + (r() * 90 | 0)) L.src.push({ layer: 'floor', x: v, y: HZ + 4, rate: 0.05, size: 4, t: r() });
    },
    walls: function (L, r) {
      bands(L.skyP, VW, [[0, 'n'], [80, 'p'], [124, 'w']]);
      for (var i = 0; i < 50; i++) L.skyP(r() < 0.7 ? 'l' : 'm', r() * VW, r() * 76);
      L.skyP('m', 380, 22, 12, 12); L.skyP('W', 382, 22, 8, 10); L.skyP('m', 380, 22, 2, 2);
      for (var x = 20; x < TW.far; x += 130) { L.farP('n', x, HZ - 70, 26, 72); for (var c = 0; c < 26; c += 6) L.farP('n', x + c, HZ - 76, 4, 6); L.farP('o', x + 11, HZ - 50, 3, 5); }
      L.midP('l', 0, HZ - 70, TW.mid, 72);
      for (var y = HZ - 70, row = 0; y < HZ + 2; y += 8, row++) { L.midP('n', 0, y + 7, TW.mid, 1); for (var bx = (row % 2) * 10; bx < TW.mid; bx += 20) { L.midP('n', bx, y, 1, 8); L.midP('b', bx + 1, y, 18, 1); } }
      for (var cr = 0; cr < TW.mid; cr += 24) { L.midP('l', cr, HZ - 80, 14, 10); L.midP('b', cr, HZ - 80, 14, 1); L.midP('n', cr + 13, HZ - 80, 1, 10); }
      for (var t = 60; t < TW.mid; t += 160) {
        L.midP('k', t, HZ - 46, 4, 14); L.midP('r', t - 2, HZ - 50, 8, 4); L.midP('c', t - 1, HZ - 55, 6, 5); L.midP('o', t, HZ - 58, 4, 4); L.midP('g', t + 1, HZ - 60, 2, 3);
        L.src.push({ layer: 'mid', x: t + 2, y: HZ - 62, rate: 0.08, size: 3, t: r() });
        L.midP('w', t + 50, HZ - 66, 22, 40); L.midP('r', t + 50, HZ - 66, 22, 2); checker(L.midP, 'p', t + 50, HZ - 30, 22, 4); L.midP('c', t + 58, HZ - 54, 6, 6); L.midP('o', t + 60, HZ - 52, 2, 2);
      }
      L.floorP('n', 0, 0, TW.floor, 135); L.floorP('l', 0, 0, TW.floor, 3);
      for (var y2 = 4, rw = 0; y2 < 135; rw++) { var rh = 10 + Math.min(8, rw); L.floorP('k', 0, y2 + rh - 1, TW.floor, 1); L.floorP('l', 0, y2, TW.floor, 1); for (var n = (rw % 2) * 16; n < TW.floor; n += 24 + (r() * 16 | 0)) L.floorP('n', n, y2, 1, rh); y2 += rh; }
      for (var k = 0; k < 30; k++) L.floorP('l', r() * TW.floor, 10 + r() * 110, 3, 1);
    },
    foundry: function (L, r) {
      bands(L.skyP, VW, [[0, 'p'], [56, 'w'], [96, 'r'], [130, 'c']]);
      for (var x = 0; x < TW.far; x += 64) { var h = 40 + Math.round(r() * 30); L.farP('k', x, HZ - h, 50, h + 2); for (var wy = HZ - h + 8; wy < HZ - 6; wy += 9) for (var wx = x + 5; wx < x + 45; wx += 8) if (r() < 0.4) L.farP(r() < 0.5 ? 'o' : 'c', wx, wy, 3, 3); chimney(L.farP, L.src, 'far', x + 30, HZ - h - 26, 26, ['k', 'p', 'k']); }
      for (var x2 = 30; x2 < TW.mid; x2 += 150) {
        // плавильная печь: каменный горн, устье с металлом
        L.midP('l', x2, HZ - 64, 70, 66); L.midP('b', x2, HZ - 64, 70, 2); L.midP('n', x2 + 66, HZ - 64, 4, 66);
        for (var yy = HZ - 60; yy < HZ; yy += 8) L.midP('n', x2, yy, 66, 1);
        L.midP('k', x2 + 18, HZ - 36, 34, 30); L.midP('r', x2 + 20, HZ - 34, 30, 28); L.midP('c', x2 + 23, HZ - 30, 24, 24); checker(L.midP, 'o', x2 + 25, HZ - 24, 20, 18); L.midP('g', x2 + 30, HZ - 12, 10, 6);
        chimney(L.midP, L.src, 'mid', x2 + 50, HZ - 100, 36, ['l', 'b', 'n']);
        L.midP('b', x2 + 76, HZ - 90, 4, 92); L.midP('m', x2 + 76, HZ - 90, 1, 92); L.midP('b', x2 + 76, HZ - 90, 50, 4); L.midP('m', x2 + 76, HZ - 90, 50, 1);   // труба
        for (var ch = 0; ch < 40; ch += 3) L.midP(ch % 6 ? 'l' : 'b', x2 + 110, HZ - 86 + ch, 2, 2);   // цепь
        L.src.push({ layer: 'mid', x: x2 + 100, y: HZ - 90, rate: 0.07, size: 3, t: r(), jet: true });
      }
      L.floorP('n', 0, 0, TW.floor, 135);
      for (var y = 0, row = 0; y < 135; row++) { var rh = 10 + Math.min(6, row); L.floorP('k', 0, y + rh - 1, TW.floor, 1); L.floorP('l', 0, y, TW.floor, 1); for (var n = (row % 2) * 24; n < TW.floor; n += 38 + (r() * 22 | 0)) { L.floorP('k', n, y, 1, rh); L.floorP('l', n + 3, y + 3, 1, 1); } y += rh; }
      for (var g = 50; g < TW.floor; g += 100 + (r() * 80 | 0)) { L.floorP('k', g, 20, 22, 8); for (var q = 2; q < 22; q += 4) L.floorP('c', g + q, 21, 2, 6); L.floorP('o', g + 8, 23, 6, 2); L.src.push({ layer: 'floor', x: g + 11, y: HZ + 20, rate: 0.06, size: 4, t: r() }); }
    },
    camp: function (L, r) {
      bands(L.skyP, VW, [[0, 'n'], [90, 'p'], [130, 'w']]);
      for (var i = 0; i < 60; i++) L.skyP(r() < 0.6 ? 'l' : r() < 0.8 ? 'm' : 'W', r() * VW, r() * 86);
      L.skyP('m', 90, 26, 10, 10); L.skyP('W', 92, 26, 7, 9);
      for (var x = 0; x < TW.far; x += 10 + Math.round(r() * 8)) pine(L.farP, x, HZ + 2, 30 + Math.round(r() * 30), 'k', null);
      for (var x2 = 30; x2 < TW.mid; x2 += 160) {
        var base = HZ + 2; for (var t = 0; t < 30; t++) { var hw = Math.round(t * 0.9); L.midP(t < 2 ? 'r' : 'w', x2 + 30 - hw, base - 30 + t, hw * 2, 1); L.midP('p', x2 + 30 + hw - 2, base - 30 + t, 2, 1); }
        L.midP('k', x2 + 26, base - 14, 8, 14); L.midP('r', x2 + 29, base - 38, 2, 10);
        L.midP('r', x2 + 80, base - 10, 34, 6); L.midP('w', x2 + 80, base - 4, 34, 2); L.midP('p', x2 + 84, base - 6, 8, 8); L.midP('p', x2 + 104, base - 6, 8, 8);   // телега
      }
      grass(L.floorP, r, TW.floor, 0, 135, 't', 'v'); checker(L.floorP, 'n', 0, 0, TW.floor, 2);
      L.floorP('k', 120, 50, 24, 4); L.floorP('r', 122, 46, 20, 4); L.floorP('c', 126, 40, 12, 6); L.floorP('o', 128, 36, 8, 6); L.floorP('g', 131, 33, 3, 5);   // костёр
      L.src.push({ layer: 'floor', x: 132, y: HZ + 30, rate: 0.1, size: 4, t: 0.5 });
    }
  };

  // ---------- Пар ----------
  var PUFF = [], PUFFD = [];
  function puffs() {
    if (PUFF.length) return;
    for (var rad = 1; rad <= 7; rad++) {
      var d = rad * 2 + 1, m = grid(d, d), md = grid(d, d);
      for (var y = -rad; y <= rad; y++) for (var x = -rad; x <= rad; x++) {
        if (x * x + y * y > rad * rad + rad * 0.6) continue;
        var lit = x + y < -rad * 0.4, i = (y + rad) * d + x + rad;
        m.a[i] = rad <= 2 ? K.m : lit ? K.W : (x + y > rad * 0.5 ? K.b : K.m); md.a[i] = lit ? K.b : K.l;
      }
      PUFF.push(toCanvas(m)); PUFFD.push(toCanvas(md));
    }
  }
  var STAGES = {}, seq = rng(99);
  function build(key) {
    if (STAGES[key]) return STAGES[key];
    var r = rng(key.length * 977 + key.charCodeAt(0)), sky = grid(VW, HZ + 2), far = grid(TW.far, HZ + 2), mid = grid(TW.mid, HZ + 2), floor = grid(TW.floor, VH - HZ);
    var L = { skyP: PX(sky), farP: PX(far), midP: PX(mid), floorP: PX(floor), src: [] };
    (BUILD[key] || BUILD.trakt)(L, r);
    var st = { m: { sky: sky, far: far, mid: mid, floor: floor }, c: {}, src: L.src, puffs: [] };
    ['sky', 'far', 'mid', 'floor'].forEach(function (k) { st.c[k] = toCanvas(st.m[k]); });
    for (var i = 0; i < 400; i++) step(st);
    return (STAGES[key] = st);
  }
  function dark(st) { if (!st.d) { st.d = {}; ['sky', 'far', 'mid', 'floor'].forEach(function (k) { st.d[k] = toCanvas(st.m[k], 2); }); } return st.d; }
  function step(st) {
    for (var i = 0; i < st.src.length; i++) {
      var s = st.src[i]; s.t += s.rate;
      if (s.t >= 1) { s.t -= 1; st.puffs.push({ s: s, x: s.x + (seq() * 3 - 1 | 0), y: s.y, r: 1, age: 0, life: (s.layer === 'far' ? 200 : s.jet ? 50 : 150) + seq() * 60,
        vx: s.jet ? 0.5 + seq() * 0.3 : 0.06 + seq() * 0.1, vy: s.jet ? -0.25 : -(0.2 + seq() * 0.12) }); }
    }
    for (var j = st.puffs.length - 1; j >= 0; j--) {
      var p = st.puffs[j]; p.age++; p.x += p.vx; p.y += p.vy; p.vy *= 0.997;
      p.r = Math.max(p.r, Math.min(p.s.size + 2, 1 + p.age / (p.s.layer === 'far' ? 40 : 26)) | 0);
      if (p.age > p.life) st.puffs.splice(j, 1);
    }
  }
  function drawPuffs(ctx, st, layer, off, tw, dk) {
    for (var i = 0; i < st.puffs.length; i++) {
      var p = st.puffs[i]; if (p.s.layer !== layer) continue;
      var rr = Math.min(7, Math.max(1, p.r - (p.age > p.life * 0.75 ? 1 : 0) - (p.age > p.life * 0.9 ? 1 : 0)));
      var img = layer === 'far' || dk ? PUFFD[rr - 1] : PUFF[rr - 1], y = Math.round(p.y) - rr;
      var x0 = Math.round(p.x - off) - rr, xx = ((x0 % tw) + tw) % tw - tw;
      for (var k = xx; k < VW + 16; k += tw) if (k > -16) ctx.drawImage(img, k, y);
    }
  }
  function tile(ctx, img, off, y) { var w = img.width, x = -(((Math.round(off) % w) + w) % w); for (; x < VW; x += w) ctx.drawImage(img, x, y); }
  var acc = 0, lastT = null;
  // cam — камера в пикселях поля (×0.5 от мира), t — время, dk — фон меню (темнее)
  function draw(ctx, key, cam, t, dk) {
    puffs(); var st = build(key), C = dk ? dark(st) : st.c;
    if (lastT == null || t < lastT || t - lastT > 1) lastT = t;
    acc += (t - lastT) * 60; lastT = t; var n = 0; while (acc >= 1 && n < 4) { step(st); acc -= 1; n++; } if (acc > 4) acc = 0;
    ctx.drawImage(C.sky, 0, 0);
    var fo = cam * PAR.far, mo = cam * PAR.mid;
    tile(ctx, C.far, fo, 0); drawPuffs(ctx, st, 'far', fo, TW.far, dk);
    tile(ctx, C.mid, mo, 0); drawPuffs(ctx, st, 'mid', mo, TW.mid, dk);
    tile(ctx, C.floor, cam, HZ); drawPuffs(ctx, st, 'floor', cam, TW.floor, dk);
  }
  D.hdWorld = { VW: VW, VH: VH, HZ: HZ, draw: draw, build: build, keys: Object.keys(BUILD) };
})(typeof window !== 'undefined' ? window : globalThis);
