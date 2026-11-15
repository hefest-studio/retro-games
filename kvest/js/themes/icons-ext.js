/* МАЯЧНИЦА · themes/icons-ext.js — пиктограммы движка глав (карта, прилив/отлив, побережье), общие для тем grey и paper.
   Геометрия в той же сетке 40×40 вокруг центра и тем же набором примитивов, что у тем (circ, line, poly, fillRR, glow, flame):
   тема передаёт свои примитивы и цвета, получает функции и вливает их в свой словарь пиктограмм. Подключается до тем. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var TAU = Math.PI * 2;
  // H = { circ, line, poly, fillRR, glow, flame, ink(), fill(), dim() }; COL — «бумажный» цвет пиктограммы (для paper)
  K.IconsExt = function (H) {
    var circ = H.circ, line = H.line, poly = H.poly, fillRR = H.fillRR, glow = H.glow, flame = H.flame;
    function I() { return H.ink(); } function F() { return H.fill(); } function D() { return H.dim(); }
    function wave(c, y, col, lw) { c.beginPath(); c.moveTo(-17, y); for (var x = -17; x <= 17; x += 2) c.lineTo(x, y + Math.sin(x * 0.45) * 3); c.strokeStyle = col; c.lineWidth = lw || 3; c.lineCap = 'round'; c.stroke(); }
    return {
      map: function (c) { poly(c, [-17, -12, -6, -15, 6, -11, 17, -14, 17, 13, 6, 16, -6, 12, -17, 15], F(), I(), 2.5); line(c, [-6, -15, -6, 12], D(), 1.5); line(c, [6, -11, 6, 16], D(), 1.5); line(c, [-12, 6, -4, -2, 4, 4, 12, -6], '#b3533a', 2.5); circ(c, 12, -6, 2.5, '#b3533a'); },
      tide: function (c) { wave(c, -6, I(), 3); wave(c, 2, '#5f8a8c', 3); wave(c, 10, '#5f8a8c', 2.5); },
      low: function (c) { wave(c, 8, '#5f8a8c', 3); line(c, [-17, 14, 17, 14], D(), 2); poly(c, [0, 4, -7, -4, -2, -4, -2, -15, 2, -15, 2, -4, 7, -4], F(), I(), 2); },
      high: function (c) { wave(c, -8, '#5f8a8c', 3); line(c, [-17, 14, 17, 14], D(), 2); poly(c, [0, -2, -7, 6, -2, 6, -2, 14, 2, 14, 2, 6, 7, 6], F(), I(), 2); },
      seaweed: function (c) { [-8, 0, 8].forEach(function (x, i) { c.beginPath(); c.moveTo(x, 16); c.quadraticCurveTo(x - 9, 2, x + 2, -6 - i * 2); c.quadraticCurveTo(x + 9, -12, x - 1, -16); c.strokeStyle = '#4f6b3a'; c.lineWidth = 5; c.lineCap = 'round'; c.stroke(); c.strokeStyle = I(); c.lineWidth = 1.2; c.stroke(); }); circ(c, 13, 10, 2, '#7fb0c4'); circ(c, -14, 4, 1.6, '#7fb0c4'); },
      seaweed_dry: function (c) { line(c, [-14, -12, 14, -12], I(), 2.5); [-9, -2, 5, 12].forEach(function (x, i) { c.beginPath(); c.moveTo(x, -12); c.quadraticCurveTo(x + (i % 2 ? 5 : -5), 2, x, 15); c.strokeStyle = '#9a8a4a'; c.lineWidth = 4.5; c.lineCap = 'round'; c.stroke(); }); },
      tin: function (c) { fillRR(c, -10, -12, 20, 26, 3, '#b9b6ae', I(), 2.5); line(c, [-10, -6, 10, -6], I(), 1.5); line(c, [-10, 8, 10, 8], I(), 1.5); c.beginPath(); c.ellipse(0, -12, 10, 3, 0, 0, TAU); c.fillStyle = '#d8d5cc'; c.fill(); c.strokeStyle = I(); c.lineWidth = 1.5; c.stroke(); },
      scoop: function (c) { line(c, [4, 2, 17, -13], I(), 4); poly(c, [-16, -2, 6, -2, 4, 10, -14, 10], F(), I(), 2.5); },
      embers: function (c) { glow(c, -4, 2, 20, 0.6); line(c, [4, 2, 17, -13], I(), 4); poly(c, [-16, -2, 6, -2, 4, 10, -14, 10], F(), I(), 2.5); circ(c, -10, -3, 3.5, '#e0602e'); circ(c, -4, -4, 4, '#f2a33a'); circ(c, 2, -3, 3, '#e0602e'); flame(c, -4, -5, 0.45, 0); },
      driftwood: function (c) { poly(c, [-17, 4, -12, -4, 10, -8, 17, -4, 15, 4, -8, 8], '#b9a27e', I(), 2.5); line(c, [-8, 0, 8, -3], D(), 1.5); line(c, [10, -8, 14, -15], I(), 2.5); circ(c, -11, 1, 2, D()); },
      peat: function (c) { fillRR(c, -16, 0, 14, 12, 2, '#6a4a33', I(), 2); fillRR(c, 2, 0, 14, 12, 2, '#6a4a33', I(), 2); fillRR(c, -7, -12, 14, 12, 2, '#7c5a40', I(), 2); },
      salt: function (c) { poly(c, [-14, 14, 14, 14, 9, 0, 4, -4, 0, -12, -4, -4, -9, 0], '#f6f4ee', I(), 2.5); poly(c, [0, -12, 3, -6, -3, -6], '#ffffff'); circ(c, -6, 6, 1.5, D()); circ(c, 5, 8, 1.5, D()); circ(c, 1, 2, 1.2, D()); },
      mitten: function (c) { poly(c, [-10, 14, -12, -4, -8, -14, 4, -14, 8, -4, 14, -6, 14, 2, 8, 6, 8, 14], '#d97a63', I(), 2.5); line(c, [-11, 9, 8, 9], '#f2e5c7', 3); line(c, [-11, 3, 7, 3], '#f2e5c7', 1.5); },
      scrub: function (c) { poly(c, [-10, 14, -12, -4, -8, -14, 4, -14, 8, -4, 14, -6, 14, 2, 8, 6, 8, 14], '#d97a63', I(), 2.5); circ(c, -4, -4, 3, '#ffffff', I(), 1); circ(c, 3, 0, 2.5, '#ffffff', I(), 1); circ(c, -2, 5, 2, '#ffffff', I(), 1); circ(c, 13, -12, 2, '#ffffff'); },
      weight: function (c) { c.beginPath(); c.arc(0, -11, 4, 0, TAU); c.strokeStyle = I(); c.lineWidth = 2.5; c.stroke(); poly(c, [-8, -6, 8, -6, 13, 14, -13, 14], '#c9a24a', I(), 2.5); line(c, [-9, 4, 9, 4], '#8e6e2a', 2); },
      crab: function (c) { c.beginPath(); c.ellipse(0, 4, 12, 8, 0, 0, TAU); c.fillStyle = '#c0442e'; c.fill(); c.strokeStyle = I(); c.lineWidth = 2.5; c.stroke(); [-1, 1].forEach(function (d) { line(c, [d * 10, 0, d * 15, -8], I(), 2.5); circ(c, d * 15, -11, 4, '#c0442e', I(), 2); line(c, [d * 9, 9, d * 16, 14], I(), 2); line(c, [d * 6, 11, d * 10, 17], I(), 2); }); circ(c, -4, -4, 1.8, I()); circ(c, 4, -4, 1.8, I()); },
      dog: function (c) { c.beginPath(); c.ellipse(-3, 5, 13, 8, 0, 0, TAU); c.fillStyle = '#e9e2d2'; c.fill(); c.strokeStyle = I(); c.lineWidth = 2.5; c.stroke(); circ(c, 11, -5, 7, '#e9e2d2', I(), 2.5); poly(c, [7, -10, 4, 0, 9, -3], '#6b5444'); circ(c, 17, -4, 2, I()); circ(c, 12, -7, 1.5, I()); line(c, [-14, 2, -19, -6], I(), 3); line(c, [-10, 12, -10, 17], I(), 2.5); line(c, [4, 12, 4, 17], I(), 2.5); },
      sun: function (c) { glow(c, 0, 4, 22, 0.55); line(c, [-17, 10, 17, 10], D(), 2); c.beginPath(); c.arc(0, 10, 10, Math.PI, 0); c.fillStyle = '#f2b84e'; c.fill(); c.strokeStyle = I(); c.lineWidth = 2.5; c.stroke(); for (var i = 0; i < 5; i++) { var a = Math.PI + (i + 0.5) * Math.PI / 5; line(c, [Math.cos(a) * 13, 10 + Math.sin(a) * 13, Math.cos(a) * 18, 10 + Math.sin(a) * 18], I(), 2.5); } },
      hut: function (c) { poly(c, [-15, -2, 0, -15, 15, -2], '#8e3c2b', I(), 2.5); fillRR(c, -12, -2, 24, 17, 1, F(), I(), 2.5); fillRR(c, -4, 4, 8, 11, 1, D(), I(), 1.5); line(c, [8, -8, 8, -16], I(), 3); },
      saltpan: function (c) { fillRR(c, -17, 2, 34, 12, 2, '#8fa3b0', I(), 2.5); poly(c, [-8, 2, -5, -4, -2, 2], '#f6f4ee', I(), 1.5); poly(c, [2, 2, 6, -6, 10, 2], '#f6f4ee', I(), 1.5); line(c, [12, -4, 12, -16], I(), 3); fillRR(c, 9, -16, 6, 4, 1, '#9a7046'); },
      stones: function (c) { wave(c, 6, '#5f8a8c', 2.5); c.beginPath(); c.ellipse(-11, 2, 6, 4, 0, 0, TAU); c.fillStyle = D(); c.fill(); c.strokeStyle = I(); c.lineWidth = 2; c.stroke(); c.beginPath(); c.ellipse(1, 0, 6, 4, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.ellipse(12, -2, 5, 3.5, 0, 0, TAU); c.fill(); c.stroke(); },
      rocktower: function (c) { poly(c, [-16, 16, -10, 2, -4, 6, 4, -2, 12, 4, 16, 16], D(), I(), 2.5); poly(c, [-4, 2, 4, 2, 3, -10, -3, -10], F(), I(), 2); fillRR(c, -4, -16, 8, 6, 1, '#fff1c4', I(), 1.5); },
      net: function (c) { poly(c, [-15, -12, 15, -12, 11, 14, -11, 14], null, I(), 2.5); for (var i = -1; i <= 1; i++) { line(c, [i * 8, -12, i * 6, 14], I(), 1.2); line(c, [-14, i * 8 + 1, 14, i * 8 + 1], I(), 1.2); } circ(c, -15, -12, 3, '#c0442e'); circ(c, 15, -12, 3, '#dca543'); },
      mirror: function (c) { circ(c, 0, -2, 13, '#e6ecef', I(), 3); c.beginPath(); c.arc(0, -2, 8, 3.6, 4.6); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke(); line(c, [-8, 14, 0, 9, 8, 14], I(), 3); },
      gearwheel: function (c) { for (var i = 0; i < 10; i++) { var a = i * TAU / 10; line(c, [Math.cos(a) * 10, Math.sin(a) * 10, Math.cos(a) * 16, Math.sin(a) * 16], I(), 4); } circ(c, 0, 0, 11, F(), I(), 2.5); line(c, [0, 0, 0, -9], '#c0442e', 3); poly(c, [-4, -20, 4, -20, 0, -15], '#c0442e'); }
    };
  };
  // «бумажные» цвета новых пиктограмм (тема paper красит ими подложку)
  K.IconsExtCol = { map: '#efe2c4', tide: '#cfe0df', low: '#cfe0df', high: '#cfe0df', seaweed: '#cfe0c0', seaweed_dry: '#e2d6a6', tin: '#d8d5cc', scoop: '#c8c2b6',
    embers: '#c8c2b6', driftwood: '#e4d4b6', peat: '#b49a7a', salt: '#e8eef2', mitten: '#f2d6c6', scrub: '#f2d6c6', weight: '#efe0b0', crab: '#f2c8b8', dog: '#f6f0e2',
    sun: '#f8e7a8', hut: '#e9dcc0', saltpan: '#dfe8ea', stones: '#d8d2c4', rocktower: '#d8d2c4', net: '#efe2c4', mirror: '#e2f1f4', gearwheel: '#e9dcc0' };
})(typeof window !== 'undefined' ? window : globalThis);
