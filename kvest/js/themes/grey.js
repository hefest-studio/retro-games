/* МАЯЧНИЦА · themes/grey.js — временное «серое» оформление (greybox) по API темы контракта «КВЕСТ».
   Цель — чтобы головоломки читались без финального арта: плоские фигуры по kind, читаемые силуэты, одна тёплая
   краска — только для огня и света (сюжет о свете). Отладка (клавиша D): подписи объектов и рамки зон.
   Тема ничего не меняет в состоянии игры; анимация — только от t и seed. */
(function (global) {
  'use strict';
  var API = (global.KVEST && global.KVEST.ThemeAPI) || null;
  var TAU = Math.PI * 2;
  var PAL = {
    dawn:   { sky0: '#d9d3cd', sky1: '#bfb8b2', far: '#a7a19c', mid: '#8b8682', near: '#706b68', ground: '#86807b', obj: '#d0cbc5', objD: '#5a5551', ink: '#2b2928', water: '#9aa0a3' },
    day:    { sky0: '#dfe2e4', sky1: '#c6cacd', far: '#aeb2b4', mid: '#929698', near: '#76797b', ground: '#8d8f8e', obj: '#d6d8d8', objD: '#56595b', ink: '#262829', water: '#a2a8ac' },
    dusk:   { sky0: '#a9a5ae', sky1: '#8d8992', far: '#7b7780', mid: '#66626b', near: '#524f56', ground: '#5f5b60', obj: '#bdb9bf', objD: '#3f3c42', ink: '#1f1d21', water: '#6f7279' },
    night:  { sky0: '#4b4e58', sky1: '#3a3c45', far: '#33353d', mid: '#2b2d34', near: '#25262c', ground: '#34353a', obj: '#8e9098', objD: '#1c1d22', ink: '#121317', water: '#3c4048' },
    cave:   { sky0: '#4a4744', sky1: '#3b3836', far: '#45423f', mid: '#55514d', near: '#3a3734', ground: '#4d4945', obj: '#9b958e', objD: '#2a2725', ink: '#171514', water: '#4f5558' },
    indoor: { sky0: '#cfc9c1', sky1: '#b8b1a8', far: '#a59e95', mid: '#8f887f', near: '#77716a', ground: '#8a8178', obj: '#e0dbd4', objD: '#57514b', ink: '#2a2623', water: '#9aa0a3' }
  };
  var GLOW = '#f0bf5a', GLOW2 = 'rgba(240,191,90,', OIL = '#4d4234';
  function pal(m) { return PAL[m] || PAL.day; }
  function rnd(seed, i) { var x = Math.sin((seed || 1) * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x); }
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fillRR(c, x, y, w, h, r, f, s, lw) { rr(c, x, y, w, h, r); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 2; c.stroke(); } }
  function circ(c, x, y, r, f, s, lw) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 2; c.stroke(); } }
  function line(c, pts, s, lw) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = s; c.lineWidth = lw || 2; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
  function poly(c, pts, f, s, lw) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 2; c.stroke(); } }
  function glow(c, x, y, r, a) { var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, GLOW2 + (a == null ? 0.55 : a) + ')'); g.addColorStop(1, GLOW2 + '0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function flame(c, x, y, s, t) { var k = 1 + Math.sin(t * 13) * 0.08; poly(c, [x - 7 * s, y, x, y - 20 * s * k, x + 7 * s, y], GLOW); poly(c, [x - 3 * s, y, x, y - 10 * s * k, x + 3 * s, y], '#fff3c8'); }
  var ICON_INK = '#2e2c2b', ICON_FILL = '#dcd8d2', ICON_DIM = '#8d8984';

  // ---------- пиктограммы (40×40 вокруг центра) ----------
  var IC = {
    key: function (c) { circ(c, -9, 0, 7, null, ICON_INK, 3.5); line(c, [-2, 0, 15, 0, 15, 6, 10, 0, 10, 5], ICON_INK, 3.5); },
    gear: function (c) { for (var i = 0; i < 8; i++) { var a = i * TAU / 8; line(c, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * 15, Math.sin(a) * 15], ICON_INK, 5); } circ(c, 0, 0, 10, ICON_FILL, ICON_INK, 3); circ(c, 0, 0, 3.5, ICON_INK); },
    cup: function (c) { fillRR(c, -10, -8, 18, 20, 3, ICON_FILL, ICON_INK, 3); c.beginPath(); c.arc(9, 2, 5, -1.3, 1.3); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); },
    star: function (c) { var p = []; for (var i = 0; i < 10; i++) { var r = i % 2 ? 7 : 16, a = -Math.PI / 2 + i * Math.PI / 5; p.push(Math.cos(a) * r, Math.sin(a) * r); } poly(c, p, ICON_FILL, ICON_INK, 2.5); },
    bird: function (c) { c.beginPath(); c.ellipse(0, 3, 12, 8, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 9, -5, 6, ICON_FILL, ICON_INK, 2.5); poly(c, [14, -6, 20, -4, 14, -2], ICON_INK); line(c, [-12, 2, -18, -3], ICON_INK, 3); line(c, [-4, 0, 4, 4], ICON_INK, 2); },
    note: function (c) { circ(c, -6, 10, 6, ICON_INK); line(c, [0, 10, 0, -14, 12, -10], ICON_INK, 3.5); },
    door: function (c) { fillRR(c, -10, -16, 20, 32, 2, ICON_FILL, ICON_INK, 3); circ(c, 5, 2, 2, ICON_INK); poly(c, [12, -2, 18, 4, 12, 10], ICON_INK); },
    lamp: function (c) { glow(c, 0, -2, 20, 0.6); fillRR(c, -8, -12, 16, 20, 3, '#fff1c4', ICON_INK, 3); line(c, [-10, -12, 10, -12], ICON_INK, 3); line(c, [-6, 12, 6, 12], ICON_INK, 3); line(c, [0, -18, 0, -12], ICON_INK, 3); flame(c, 0, 6, 0.5, 0); },
    lamp_off: function (c) { fillRR(c, -8, -12, 16, 20, 3, ICON_DIM, ICON_INK, 3); line(c, [-10, -12, 10, -12], ICON_INK, 3); line(c, [-6, 12, 6, 12], ICON_INK, 3); line(c, [0, -18, 0, -12], ICON_INK, 3); line(c, [-14, -16, 14, 16], ICON_INK, 2.5); },
    fish: function (c) { c.beginPath(); c.ellipse(-2, 0, 12, 7, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); poly(c, [9, 0, 17, -7, 17, 7], ICON_FILL, ICON_INK, 2.5); circ(c, -8, -2, 1.8, ICON_INK); },
    flower: function (c) { for (var i = 0; i < 5; i++) { var a = i * TAU / 5; circ(c, Math.cos(a) * 7, -6 + Math.sin(a) * 7, 5, ICON_FILL, ICON_INK, 2); } circ(c, 0, -6, 3.5, ICON_INK); line(c, [0, 2, 0, 16], ICON_INK, 3); },
    oilcan: function (c) { poly(c, [-12, 14, 8, 14, 8, -2, -12, -2], ICON_FILL, ICON_INK, 3); poly(c, [-8, -2, 4, -2, -2, -10], ICON_FILL, ICON_INK, 3); line(c, [8, 2, 18, -10], ICON_INK, 3); },
    oilcan_full: function (c) { poly(c, [-12, 14, 8, 14, 8, -2, -12, -2], OIL, ICON_INK, 3); poly(c, [-8, -2, 4, -2, -2, -10], OIL, ICON_INK, 3); line(c, [8, 2, 18, -10], ICON_INK, 3); circ(c, 18, -6, 2.5, OIL); },
    wick: function (c) { circ(c, 0, 2, 11, ICON_FILL, ICON_INK, 3); circ(c, 0, 2, 4, null, ICON_INK, 2); line(c, [10, -4, 16, -14], ICON_INK, 2.5); },
    flint: function (c) { poly(c, [-14, 6, -6, -8, 6, -6, 10, 8], ICON_DIM, ICON_INK, 2.5); fillRR(c, 2, -14, 14, 7, 2, ICON_FILL, ICON_INK, 2.5); circ(c, 14, 10, 2, GLOW); circ(c, 18, 4, 1.5, GLOW); },
    logs: function (c) { circ(c, -8, 6, 7, ICON_FILL, ICON_INK, 2.5); circ(c, 7, 6, 7, ICON_FILL, ICON_INK, 2.5); circ(c, 0, -6, 7, ICON_FILL, ICON_INK, 2.5); circ(c, -8, 6, 2, ICON_INK); circ(c, 7, 6, 2, ICON_INK); circ(c, 0, -6, 2, ICON_INK); },
    lantern: function (c) { fillRR(c, -9, -10, 18, 22, 3, ICON_DIM, ICON_INK, 3); c.beginPath(); c.arc(0, -12, 7, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); line(c, [-9, 2, 9, 2], ICON_INK, 2); },
    lantern_lit: function (c) { glow(c, 0, 2, 22, 0.7); fillRR(c, -9, -10, 18, 22, 3, '#fff1c4', ICON_INK, 3); c.beginPath(); c.arc(0, -12, 7, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); flame(c, 0, 8, 0.55, 0); },
    bucket: function (c) { poly(c, [-12, -8, 12, -8, 8, 14, -8, 14], ICON_FILL, ICON_INK, 3); c.beginPath(); c.arc(0, -8, 12, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 2; c.stroke(); },
    bucket_water: function (c) { poly(c, [-12, -8, 12, -8, 8, 14, -8, 14], ICON_FILL, ICON_INK, 3); poly(c, [-11, -4, 11, -4, 9, 4, -9, 4], '#8fa3b0'); c.beginPath(); c.arc(0, -8, 12, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 2; c.stroke(); circ(c, 14, 8, 2.5, '#8fa3b0'); },
    bread: function (c) { c.beginPath(); c.ellipse(0, 2, 16, 10, 0, 0, TAU); c.fillStyle = '#cbb79a'; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); line(c, [-8, -4, -4, 4], ICON_INK, 2); line(c, [0, -6, 4, 2], ICON_INK, 2); line(c, [8, -4, 11, 3], ICON_INK, 2); },
    rope: function (c) { c.beginPath(); c.ellipse(0, 0, 14, 9, 0, 0, TAU); c.strokeStyle = ICON_INK; c.lineWidth = 4; c.stroke(); c.beginPath(); c.ellipse(0, 0, 8, 5, 0, 0, TAU); c.lineWidth = 3; c.stroke(); line(c, [12, 4, 18, 14], ICON_INK, 3); },
    hook: function (c) { line(c, [0, -16, 0, 4], ICON_INK, 4); c.beginPath(); c.arc(-6, 4, 6, 0, Math.PI); c.strokeStyle = ICON_INK; c.lineWidth = 4; c.stroke(); line(c, [-12, 4, -12, 0], ICON_INK, 4); circ(c, 0, -16, 3, null, ICON_INK, 2); },
    grapple: function (c) { c.beginPath(); c.ellipse(-6, -4, 9, 6, 0, 0, TAU); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); line(c, [2, -2, 10, 6], ICON_INK, 3); c.beginPath(); c.arc(8, 10, 5, 0, Math.PI); c.lineWidth = 3.5; c.stroke(); },
    shell: function (c) { poly(c, [0, 12, -15, -4, -6, -12, 6, -12, 15, -4], '#e8e2f0', ICON_INK, 2.5); for (var i = -2; i <= 2; i++) line(c, [0, 12, i * 5, -11], ICON_INK, 1.5); },
    lens: function (c) { circ(c, 0, 0, 14, '#eef3f6', ICON_INK, 3); c.beginPath(); c.arc(0, 0, 9, 3.6, 4.6); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke(); poly(c, [12, -14, 14, -10, 18, -12], GLOW); },
    lens_dirty: function (c) { circ(c, 0, 0, 14, '#9d9a92', ICON_INK, 3); circ(c, -4, -3, 3, '#7b776f'); circ(c, 5, 4, 4, '#7b776f'); circ(c, 4, -6, 2, '#7b776f'); },
    cloth: function (c) { poly(c, [-14, -8, 12, -12, 16, 8, -10, 12], ICON_FILL, ICON_INK, 2.5); line(c, [-8, -2, 8, -5], ICON_DIM, 2); line(c, [-6, 4, 10, 2], ICON_DIM, 2); },
    crank: function (c) { line(c, [-12, 10, -12, -6, 10, -6, 10, -14], ICON_INK, 4.5); circ(c, -12, 12, 4, ICON_FILL, ICON_INK, 2.5); fillRR(c, 6, -18, 8, 8, 2, ICON_FILL, ICON_INK, 2); },
    moon: function (c) { circ(c, 0, 0, 14, '#ecead8', ICON_INK, 2.5); circ(c, 7, -4, 11, ICON_DIM); },
    bell: function (c) { poly(c, [-12, 10, -8, -8, 0, -14, 8, -8, 12, 10], ICON_FILL, ICON_INK, 2.5); line(c, [-14, 10, 14, 10], ICON_INK, 3); circ(c, 0, 14, 3, ICON_INK); },
    goat: function (c) { c.beginPath(); c.ellipse(-2, 4, 12, 8, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 12, -4, 5, ICON_FILL, ICON_INK, 2.5); line(c, [11, -9, 6, -16], ICON_INK, 2.5); line(c, [14, -9, 13, -17], ICON_INK, 2.5); line(c, [-10, 10, -10, 17], ICON_INK, 2.5); line(c, [6, 10, 6, 17], ICON_INK, 2.5); },
    cat: function (c) { c.beginPath(); c.ellipse(0, 6, 10, 9, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 0, -8, 7, ICON_FILL, ICON_INK, 2.5); poly(c, [-6, -12, -6, -19, -1, -14], ICON_INK); poly(c, [6, -12, 6, -19, 1, -14], ICON_INK); line(c, [9, 10, 17, 2], ICON_INK, 3); },
    gull: function (c) { c.beginPath(); c.ellipse(0, 4, 13, 7, 0, 0, TAU); c.fillStyle = '#f0efec'; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 11, -4, 5, '#f0efec', ICON_INK, 2.5); poly(c, [15, -4, 22, -2, 15, 0], GLOW); line(c, [-6, 0, -16, -10], ICON_INK, 3); },
    stool: function (c) { fillRR(c, -14, -8, 28, 6, 2, ICON_FILL, ICON_INK, 2.5); line(c, [-10, -2, -12, 14], ICON_INK, 3); line(c, [10, -2, 12, 14], ICON_INK, 3); line(c, [-11, 7, 11, 7], ICON_INK, 2); },
    up: function (c) { poly(c, [0, -16, 12, -2, 5, -2, 5, 14, -5, 14, -5, -2, -12, -2], ICON_FILL, ICON_INK, 2.5); },
    cross: function (c) { line(c, [-11, -11, 11, 11], '#6a3b35', 5); line(c, [11, -11, -11, 11], '#6a3b35', 5); },
    check: function (c) { line(c, [-12, 0, -3, 10, 13, -10], '#3f5f3d', 5); },
    question: function (c) { c.beginPath(); c.arc(0, -6, 8, Math.PI * 1.1, Math.PI * 2.4); c.strokeStyle = ICON_INK; c.lineWidth = 4; c.stroke(); line(c, [2, 2, 0, 6], ICON_INK, 4); circ(c, 0, 13, 2.5, ICON_INK); },
    eye: function (c) { c.beginPath(); c.moveTo(-16, 0); c.quadraticCurveTo(0, -14, 16, 0); c.quadraticCurveTo(0, 14, -16, 0); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); circ(c, 0, 0, 5, ICON_INK); },
    fire: function (c) { glow(c, 0, 0, 20, 0.5); flame(c, 0, 14, 1.4, 0); },
    cold: function (c) { for (var i = 0; i < 3; i++) { var a = i * Math.PI / 3; line(c, [Math.cos(a) * 15, Math.sin(a) * 15, -Math.cos(a) * 15, -Math.sin(a) * 15], '#6c7d8a', 3); } circ(c, 0, 0, 3, '#6c7d8a'); },
    heart: function (c) { c.beginPath(); c.moveTo(0, 14); c.bezierCurveTo(-20, 0, -12, -16, 0, -6); c.bezierCurveTo(12, -16, 20, 0, 0, 14); c.fillStyle = '#b77b70'; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2; c.stroke(); },
    boat: function (c) { poly(c, [-18, 2, 18, 2, 12, 12, -12, 12], ICON_FILL, ICON_INK, 2.5); line(c, [0, 2, 0, -16], ICON_INK, 2.5); poly(c, [1, -15, 12, -2, 1, -2], ICON_FILL, ICON_INK, 2); },
    fog: function (c) { line(c, [-16, -6, 16, -6], ICON_DIM, 4); line(c, [-12, 2, 18, 2], ICON_DIM, 4); line(c, [-18, 10, 10, 10], ICON_DIM, 4); },
    tower: function (c) { poly(c, [-8, 16, 8, 16, 5, -8, -5, -8], ICON_FILL, ICON_INK, 2.5); fillRR(c, -7, -16, 14, 8, 2, '#fff1c4', ICON_INK, 2); line(c, [-6, 2, 6, 2], ICON_INK, 2); },
    hammer: function (c) { line(c, [-10, 14, 6, -2], ICON_INK, 4); fillRR(c, -2, -16, 20, 9, 2, ICON_FILL, ICON_INK, 2.5); },
    well: function (c) { fillRR(c, -12, 0, 24, 14, 3, ICON_FILL, ICON_INK, 2.5); line(c, [-10, 0, -10, -12, 10, -12, 10, 0], ICON_INK, 2.5); poly(c, [-14, -12, 0, -20, 14, -12], ICON_INK); line(c, [0, -12, 0, -2], ICON_INK, 1.5); },
    barrel: function (c) { c.beginPath(); c.ellipse(0, 0, 11, 15, 0, 0, TAU); c.fillStyle = ICON_FILL; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); line(c, [-11, -6, 11, -6], ICON_INK, 2); line(c, [-11, 6, 11, 6], ICON_INK, 2); },
    cave: function (c) { c.beginPath(); c.moveTo(-18, 14); c.quadraticCurveTo(-16, -16, 0, -16); c.quadraticCurveTo(16, -16, 18, 14); c.closePath(); c.fillStyle = ICON_DIM; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); c.beginPath(); c.moveTo(-8, 14); c.quadraticCurveTo(0, -6, 8, 14); c.fillStyle = ICON_INK; c.fill(); },
    bridge: function (c) { line(c, [-18, 8, 18, 8], ICON_INK, 4); c.beginPath(); c.moveTo(-18, 8); c.quadraticCurveTo(0, -14, 18, 8); c.strokeStyle = ICON_INK; c.lineWidth = 2.5; c.stroke(); for (var i = -2; i <= 2; i++) line(c, [i * 6, 8, i * 6, -2 + Math.abs(i) * 3], ICON_INK, 1.5); },
    stairs: function (c) { line(c, [-16, 14, -16, 6, -6, 6, -6, -2, 4, -2, 4, -10, 14, -10, 14, -16], ICON_INK, 3.5); },
    gauge: function (c) { circ(c, 0, 2, 14, ICON_FILL, ICON_INK, 2.5); line(c, [0, 2, 8, -6], ICON_INK, 3); c.beginPath(); c.arc(0, 2, 10, -0.9, -0.3); c.strokeStyle = '#3f5f3d'; c.lineWidth = 4; c.stroke(); },
    pipe: function (c) { line(c, [-16, -6, 4, -6, 4, 14], ICON_INK, 9); line(c, [-16, -6, 4, -6, 4, 14], ICON_FILL, 4); },
    lock: function (c) { fillRR(c, -11, -2, 22, 16, 3, ICON_FILL, ICON_INK, 2.5); c.beginPath(); c.arc(0, -2, 7, Math.PI, 0); c.strokeStyle = ICON_INK; c.lineWidth = 3; c.stroke(); circ(c, 0, 6, 2.5, ICON_INK); },
    lever: function (c) { fillRR(c, -12, 8, 24, 8, 2, ICON_FILL, ICON_INK, 2.5); line(c, [0, 8, 8, -12], ICON_INK, 3.5); circ(c, 8, -12, 4, ICON_INK); poly(c, [-14, -16, -6, -16, -10, -8], ICON_INK); },
    lever_on: function (c) { fillRR(c, -12, 8, 24, 8, 2, ICON_FILL, ICON_INK, 2.5); line(c, [0, 8, 0, -14], ICON_INK, 3.5); circ(c, 0, -14, 4, ICON_INK); },
    lever_off: function (c) { fillRR(c, -12, -16, 24, 8, 2, ICON_FILL, ICON_INK, 2.5); line(c, [0, -8, 0, 14], ICON_INK, 3.5); circ(c, 0, 14, 4, ICON_INK); },
    dot1: function (c) { circ(c, 0, 0, 5, ICON_INK); },
    dot2: function (c) { circ(c, -7, 0, 5, ICON_INK); circ(c, 7, 0, 5, ICON_INK); },
    dot3: function (c) { circ(c, -11, 0, 4.5, ICON_INK); circ(c, 0, 0, 4.5, ICON_INK); circ(c, 11, 0, 4.5, ICON_INK); },
    firefly: function (c, t) { glow(c, 0, 0, 22, 0.8); circ(c, 0, 0, 5, '#fff3c8'); c.globalAlpha = 0.6; circ(c, -5, -6, 5, ICON_FILL); circ(c, 5, -6, 5, ICON_FILL); c.globalAlpha = 1; },
    water: function (c) { c.beginPath(); c.moveTo(0, -15); c.quadraticCurveTo(13, 4, 0, 14); c.quadraticCurveTo(-13, 4, 0, -15); c.fillStyle = '#8fa3b0'; c.fill(); c.strokeStyle = ICON_INK; c.lineWidth = 2; c.stroke(); },
    book: function (c) { poly(c, [-16, -12, 0, -8, 16, -12, 16, 12, 0, 16, -16, 12], ICON_FILL, ICON_INK, 2.5); line(c, [0, -8, 0, 16], ICON_INK, 2); line(c, [-11, -3, -4, -1], ICON_DIM, 2); line(c, [4, -1, 11, -3], ICON_DIM, 2); },
    hint: function (c) { circ(c, 0, -4, 11, '#fff1c4', ICON_INK, 2.5); fillRR(c, -5, 7, 10, 7, 2, ICON_DIM, ICON_INK, 2); },
    close: function (c) { line(c, [-9, -9, 9, 9], ICON_INK, 4); line(c, [9, -9, -9, 9], ICON_INK, 4); },
    prev: function (c) { poly(c, [8, -12, -8, 0, 8, 12], ICON_INK); },
    next: function (c) { poly(c, [-8, -12, 8, 0, -8, 12], ICON_INK); },
    timer: function (c) { circ(c, 0, 2, 13, ICON_FILL, ICON_INK, 2.5); line(c, [0, 2, 0, -6], ICON_INK, 2.5); line(c, [0, 2, 6, 5], ICON_INK, 2.5); line(c, [-4, -14, 4, -14], ICON_INK, 3); }
  };
  for (var nn = 0; nn < 5; nn++) (function (n) { IC['n' + n] = function (c) { line(c, [-16, 12, 16, 12], ICON_DIM, 1.5); line(c, [-16, -16, 16, -16], ICON_DIM, 1.5); var y = 8 - n * 6; circ(c, -2, y, 5, ICON_INK); line(c, [3, y, 3, y - 14], ICON_INK, 2.5); }; })(nn);

  function drawIcon(c, id, x, y, size) {
    var f = IC[id], s = (size || 40) / 40;
    c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = c.globalAlpha == null ? 1 : c.globalAlpha;
    if (f) f(c, 0); else { fillRR(c, -14, -14, 28, 28, 5, ICON_FILL, ICON_INK, 2); IC.question(c); }
    c.restore();
  }

  // ---------- kind ----------
  var KD = {};
  KD.sky = function (c, o, P) { var g = c.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, P.sky0); g.addColorStop(1, P.sky1); c.fillStyle = g; c.fillRect(o.x || 0, o.y || 0, o.w || 960, o.h || 540); };
  KD.cloud = function (c, o, P, t) { var dx = Math.sin(t * 0.05 + (o.seed || 0)) * 14, x = o.x + dx, y = o.y, w = o.w || 120, h = o.h || 40; c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(x + w * 0.5, y + h * 0.6, w * 0.5, h * 0.4, 0, 0, TAU); c.ellipse(x + w * 0.35, y + h * 0.4, w * 0.25, h * 0.35, 0, 0, TAU); c.ellipse(x + w * 0.65, y + h * 0.35, w * 0.22, h * 0.32, 0, 0, TAU); c.fill(); };
  KD.moon = function (c, o) { glow(c, o.x + o.w / 2, o.y + o.h / 2, o.w * 1.4, 0.18); circ(c, o.x + o.w / 2, o.y + o.h / 2, o.w / 2, '#e6e3d4'); };
  KD.hill = function (c, o, P) { var n = 7, p = [o.x, o.y + o.h]; for (var i = 0; i <= n; i++) p.push(o.x + o.w * i / n, o.y + o.h * (0.15 + 0.35 * rnd(o.seed, i))); p.push(o.x + o.w, o.y + o.h); poly(c, p, P.far); };
  KD.ground = function (c, o, P) { c.fillStyle = P.ground; c.fillRect(o.x, o.y, o.w, o.h); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(o.x, o.y, o.w, 3); };
  KD.house = function (c, o, P) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, rh = h * 0.28;
    c.fillStyle = P.mid; c.fillRect(x, y + rh, w, h - rh); poly(c, [x - 12, y + rh, x + w / 2, y, x + w + 12, y + rh], P.near);
    var wx = x + w * 0.3, wy = y + rh + 30; if (s.windowLit) glow(c, wx + 30, wy + 25, 70, 0.4);
    fillRR(c, wx, wy, 60, 50, 3, s.windowLit ? '#f6dc9e' : P.near, P.objD, 3); line(c, [wx + 30, wy, wx + 30, wy + 50], P.objD, 2);
    if (s.door !== false) fillRR(c, x + w * 0.7, y + h - 90, 44, 90, 3, P.near, P.objD, 2);
  };
  KD.tower = function (c, o, P, t) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, top = h * 0.18, cx = x + w / 2;
    if (s.lit) {
      var a = Math.sin(t * 0.9) * 0.9, len = 1200; c.save(); c.globalAlpha = 0.22;
      poly(c, [cx, y + top * 0.6, cx + Math.cos(a) * len, y + top * 0.6 + Math.sin(a) * len * 0.25 - 60, cx + Math.cos(a) * len, y + top * 0.6 + Math.sin(a) * len * 0.25 + 60], GLOW);
      poly(c, [cx, y + top * 0.6, cx - Math.cos(a) * len, y + top * 0.6 - Math.sin(a) * len * 0.25 - 60, cx - Math.cos(a) * len, y + top * 0.6 - Math.sin(a) * len * 0.25 + 60], GLOW);
      c.restore(); glow(c, cx, y + top * 0.6, w * 1.4, 0.6);
    }
    poly(c, [x + w * 0.12, y + h, x + w * 0.88, y + h, x + w * 0.72, y + top, x + w * 0.28, y + top], P.obj, P.objD, 3);
    for (var i = 1; i < 4; i++) { var yy = y + top + (h - top) * i / 4, k = (yy - y - top) / (h - top), lx = x + w * (0.28 - 0.16 * k), rx = x + w * (0.72 + 0.16 * k); c.fillStyle = P.mid; c.fillRect(lx, yy - 10, rx - lx, 20); }
    fillRR(c, x + w * 0.26, y + top * 0.25, w * 0.48, top * 0.8, 4, s.lit ? '#fff1c4' : P.near, P.objD, 3);
    poly(c, [x + w * 0.22, y + top * 0.25, cx, y, x + w * 0.78, y + top * 0.25], P.objD);
    line(c, [x + w * 0.2, y + top * 1.05, x + w * 0.8, y + top * 1.05], P.objD, 4);
  };
  KD.tree = function (c, o, P) { c.fillStyle = P.near; c.fillRect(o.x + o.w * 0.42, o.y + o.h * 0.5, o.w * 0.16, o.h * 0.5); for (var i = 0; i < 4; i++) circ(c, o.x + o.w * (0.3 + 0.4 * rnd(o.seed, i)), o.y + o.h * (0.15 + 0.3 * rnd(o.seed, i + 9)), o.w * 0.3, P.far); };
  KD.plant = function (c, o, P) { for (var i = 0; i < 6; i++) { var bx = o.x + o.w * (0.2 + 0.6 * rnd(o.seed, i)); line(c, [bx, o.y + o.h, bx + (rnd(o.seed, i + 3) - 0.5) * o.w, o.y + o.h * 0.15 * rnd(o.seed, i + 5)], P.near, 5); } };
  KD.rock = function (c, o, P, t) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h;
    if (s.plate) { var dy = s.down ? 5 : 0; fillRR(c, x, y + dy, w, h, 4, s.down ? P.objD : P.obj, P.ink, 2); if (s.icon) { c.save(); c.globalAlpha = 0.85; drawIcon(c, s.icon, x + w / 2, y + dy - 18, 30); c.restore(); } return; }
    if (s.variant === 'steps') { var n = 3, up = s.up; for (var i = 0; i < n; i++) { var sh = up ? (h / n) * (i + 1) : 10, sx = x + i * (w / n); fillRR(c, sx, y + h - sh, w / n - 3, sh, 3, P.obj, P.ink, 2); } return; }
    var pts = [], n2 = 9; for (var k = 0; k < n2; k++) { var a = Math.PI + k * Math.PI / (n2 - 1), r = 0.85 + 0.15 * rnd(o.seed, k); pts.push(x + w / 2 + Math.cos(a) * w / 2 * r, y + h + Math.sin(a) * h * r); }
    poly(c, pts, s.variant === 'pillar' ? P.mid : P.near, P.ink, 2);
    if (s.icon) drawIcon(c, s.icon, x + w / 2, y + h * 0.6, Math.min(w, h) * 0.5);
  };
  KD.water = function (c, o, P, t) {
    var s = o.state || {}; c.fillStyle = P.water; c.fillRect(o.x, o.y, o.w, o.h);
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 2;
    for (var j = 0; j < Math.max(1, o.h / 26); j++) { c.beginPath(); for (var i = 0; i <= o.w; i += 24) { var yy = o.y + 10 + j * 26 + Math.sin(t * 1.2 + i * 0.05 + j + (o.seed || 0)) * 3; if (i === 0) c.moveTo(o.x + i, yy); else c.lineTo(o.x + i, yy); } c.stroke(); }
    if (s.shell) { drawIcon(c, 'shell', o.x + o.w * 0.6, o.y + o.h * 0.55, 26); circ(c, o.x + o.w * 0.6 + 10, o.y + o.h * 0.4, 2 + Math.abs(Math.sin(t * 3)) * 2, '#ffffff'); }
  };
  KD.bridge = function (c, o, P, t) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h || 20;
    if (s.pier) { c.fillStyle = P.near; c.fillRect(x, y, w, h); for (var i = 0; i < w; i += 40) { line(c, [x + i, y, x + i, y + h], P.ink, 1); } for (var j = 20; j < w; j += 120) { c.fillStyle = P.objD; c.fillRect(x + j, y + h, 12, 70); } return; }
    var lift = s.lift != null ? s.lift : (s.down ? 0 : 1); if (s.down) lift = 0;
    var ang = -lift * 1.25;
    c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = P.obj; c.fillRect(0, 0, w, h); c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(0, 0, w, h);
    for (var k = 30; k < w; k += 30) line(c, [k, 0, k, h], P.objD, 1.5); c.restore();
    var ex = x + Math.cos(ang) * w, ey = y + Math.sin(ang) * w; line(c, [x - 20, y - 150, ex, ey], P.ink, 2);
    c.fillStyle = P.objD; c.fillRect(x - 26, y - 160, 12, 160);
  };
  KD.fence = function (c, o, P) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h;
    if (s.ladder) { line(c, [x + 6, y, x + 6, y + h], P.objD, 4); line(c, [x + w - 6, y, x + w - 6, y + h], P.objD, 4); for (var i = 10; i < h; i += 22) line(c, [x + 6, y + i, x + w - 6, y + i], P.objD, 3); return; }
    if (s.stairs) { var n = 8; for (var k = 0; k < n; k++) { var sw = w / n, sx = x + k * sw, sh = h * (k + 1) / n; fillRR(c, sx, y + h - sh, sw + 1, sh, 1, P.mid, P.objD, 1.5); } return; }
    for (var p = 0; p <= w; p += 40) { c.fillStyle = P.near; c.fillRect(x + p - 4, y, 8, h); }
    c.fillStyle = P.near; c.fillRect(x, y + h * 0.3, w, 6); c.fillRect(x, y + h * 0.7, w, 6);
  };
  var PDIR = [[0, -1], [1, 0], [0, 1], [-1, 0]], POPEN = { I: [0, 2], L: [0, 1], T: [0, 1, 2], X: [0, 1, 2, 3], cap: [1], sink: [3] };
  KD.pipe = function (c, o, P, t) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h;
    if (!s.shape) { fillRR(c, x, y, w, h, h / 2, P.mid, P.objD, 2); return; }
    var cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2, open = POPEN[s.shape];
    if (s.shape !== 'cap' && s.shape !== 'sink') fillRR(c, x, y, w, h, 8, s.fixed ? P.mid : P.obj, P.objD, 2);
    if (!open) { IC.question(c); return; }
    var rot = s.shape === 'cap' || s.shape === 'sink' ? 0 : (s.rot || 0);
    open.forEach(function (d0) { var d = PDIR[(d0 + rot) % 4]; line(c, [cx, cy, cx + d[0] * r, cy + d[1] * r], P.ink, 26); });
    open.forEach(function (d0) { var d = PDIR[(d0 + rot) % 4]; line(c, [cx, cy, cx + d[0] * r, cy + d[1] * r], s.wet ? OIL : P.sky1, 14); });
    circ(c, cx, cy, 13, P.ink); circ(c, cx, cy, 7, s.wet ? OIL : P.sky1);
    if (s.shape === 'sink') { poly(c, [cx - 30, cy - 34, cx + 30, cy - 34, cx + 8, cy + 6, cx - 8, cy + 6], P.obj, P.ink, 3); if (s.wet) circ(c, cx, cy + 22 + (t * 40 % 20), 4, OIL); }
    if (s.fixed) { circ(c, x + 10, y + 10, 4, P.ink); circ(c, x + w - 10, y + 10, 4, P.ink); circ(c, x + 10, y + h - 10, 4, P.ink); circ(c, x + w - 10, y + h - 10, 4, P.ink); }
  };
  KD.lamp = function (c, o, P, t) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2;
    if (s.big) {
      if (s.lit) glow(c, cx, y + h * 0.42, 340, 0.55);
      fillRR(c, x + w * 0.1, y + h * 0.82, w * 0.8, h * 0.18, 6, P.obj, P.ink, 3);
      fillRR(c, x, y + h * 0.12, w, h * 0.7, 18, s.lit ? 'rgba(255,241,196,0.9)' : 'rgba(120,124,132,0.45)', P.ink, 4);
      poly(c, [x - 8, y + h * 0.12, cx, y - 10, x + w + 8, y + h * 0.12], P.objD, P.ink, 3);
      // гнёзда деталей: линза (круг), фитиль (стержень), масло (резервуар)
      circ(c, cx, y + h * 0.4, w * 0.3, s.lens ? 'rgba(238,243,246,0.9)' : null, s.lens ? P.ink : 'rgba(0,0,0,0.45)', s.lens ? 4 : 3);
      if (!s.lens) { c.setLineDash && c.setLineDash([8, 8]); circ(c, cx, y + h * 0.4, w * 0.3, null, P.ink, 2); c.setLineDash && c.setLineDash([]); }
      line(c, [cx, y + h * 0.55, cx, y + h * 0.66], s.wick ? P.ink : 'rgba(0,0,0,0.35)', s.wick ? 6 : 2);
      fillRR(c, cx - 28, y + h * 0.66, 56, 22, 5, s.oil ? OIL : 'rgba(0,0,0,0.12)', P.ink, 2);
      if (s.lit) flame(c, cx, y + h * 0.56, 1.4, t);
      return;
    }
    if (s.small) { if (s.lit) glow(c, cx, y + h / 2, 30, 0.7); circ(c, cx, y + h / 2, w / 2, s.lit ? '#fff1c4' : P.near, P.ink, 2); return; }
    if (s.hang) { line(c, [cx, 0, cx, y + h - 24], P.ink, 2); if (s.lit) glow(c, cx, y + h - 12, 90, 0.35); fillRR(c, cx - 12, y + h - 24, 24, 24, 4, s.lit ? '#fff1c4' : P.near, P.ink, 2); return; }
    c.fillStyle = P.objD; c.fillRect(cx - 3, y + 20, 6, h - 20); if (s.lit) glow(c, cx, y + 10, 60, 0.45); fillRR(c, cx - 10, y, 20, 22, 3, s.lit ? '#fff1c4' : P.near, P.ink, 2);
  };
  KD.wall = function (c, o, P) {
    var s = o.state || {};
    if (s.cave) { c.fillStyle = P.far; c.fillRect(o.x, o.y, o.w, o.h); for (var i = 0; i < 26; i++) circ(c, o.x + o.w * rnd(o.seed, i), o.y + o.h * rnd(o.seed, i + 40), 20 + 50 * rnd(o.seed, i + 80), 'rgba(0,0,0,0.08)'); for (var k = 0; k < 9; k++) { var sx = o.x + o.w * rnd(o.seed, k + 7); poly(c, [sx - 10, 0, sx + 10, 0, sx, 30 + 50 * rnd(o.seed, k + 3)], P.near); } return; }
    c.fillStyle = P.sky1; c.fillRect(o.x, o.y, o.w, o.h);
    c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 2;
    for (var y = o.y + 40; y < o.y + o.h; y += 40) { c.beginPath(); c.moveTo(o.x, y); c.lineTo(o.x + o.w, y); c.stroke(); }
  };
  KD.floor = function (c, o, P) { c.fillStyle = P.ground; c.fillRect(o.x, o.y, o.w, o.h); c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2; for (var x = o.x; x < o.x + o.w; x += 64) { c.beginPath(); c.moveTo(x, o.y); c.lineTo(x - 30, o.y + o.h); c.stroke(); } c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(o.x, o.y, o.w, 3); };
  KD.window = function (c, o, P) {
    var s = o.state || {};
    if (!s.frameOnly) { c.fillStyle = s.lit ? '#f6dc9e' : P.sky0; c.fillRect(o.x, o.y, o.w, o.h); }
    c.strokeStyle = P.objD; c.lineWidth = s.frameOnly ? 10 : 6; c.strokeRect(o.x, o.y, o.w, o.h);
    line(c, [o.x + o.w / 2, o.y, o.x + o.w / 2, o.y + o.h], P.objD, s.frameOnly ? 6 : 4); line(c, [o.x, o.y + o.h / 2, o.x + o.w, o.y + o.h / 2], P.objD, s.frameOnly ? 6 : 4);
  };
  KD.door = function (c, o, P) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h;
    if (s.hatch) { fillRR(c, x, y + h - 16, w, 16, 3, s.open ? P.ink : P.obj, P.objD, 2); line(c, [x + 10, y + h - 16, x + w - 10, y + h - 40], P.objD, 4); return; }
    fillRR(c, x - 6, y - 6, w + 12, h + 6, 4, P.objD);
    if (s.open) { c.fillStyle = P.ink; c.fillRect(x, y, w, h); poly(c, [x, y, x + w * 0.25, y + 8, x + w * 0.25, y + h, x, y + h], P.obj, P.objD, 2); }
    else { fillRR(c, x, y, w, h, 3, P.obj, P.objD, 2); line(c, [x + w / 2, y + 6, x + w / 2, y + h - 6], P.objD, 1.5); circ(c, x + w * 0.8, y + h * 0.55, 4, P.ink); }
    if (s.lock) drawIcon(c, 'lock', x + w * 0.8, y + h * 0.55 + 18, 28);
  };
  KD.gate = function (c, o, P) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, oy = s.open ? -h * 0.82 : 0;
    c.fillStyle = P.ink; c.fillRect(x, y, w, h);
    c.save(); c.beginPath(); c.rect(x - 4, y - 4, w + 8, h + 8); c.clip();
    for (var i = 10; i < w; i += 22) line(c, [x + i, y + oy, x + i, y + h + oy], P.obj, 5);
    line(c, [x, y + h * 0.5 + oy, x + w, y + h * 0.5 + oy], P.obj, 5); line(c, [x, y + h - 6 + oy, x + w, y + h - 6 + oy], P.obj, 5);
    c.restore(); fillRR(c, x - 8, y - 12, w + 16, 12, 2, P.objD);
  };
  KD.lever = function (c, o, P) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, bx = x + w / 2, by = y + h - 8, a = s.on ? -0.55 : 0.55, L = h * 0.85;
    fillRR(c, x - 6, by - 2, w + 12, 12, 3, P.objD);
    line(c, [bx, by, bx + Math.sin(a) * L, by - Math.cos(a) * L], P.ink, 5); circ(c, bx + Math.sin(a) * L, by - Math.cos(a) * L, 7, s.on ? P.obj : P.mid, P.ink, 2.5);
  };
  KD.box = function (c, o, P, t) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h;
    if (s.pic) { return drawPicTile(c, o, P); }
    if (s.icon && !s.variant) { fillRR(c, x, y, w, h, w / 2, P.obj, P.ink, 3); drawIcon(c, s.icon, x + w / 2, y + h / 2, Math.min(w, h) * 0.75); return; }
    switch (s.variant) {
      case 'stool': fillRR(c, x, y, w, 10, 3, P.obj, P.ink, 2); line(c, [x + 8, y + 10, x + 4, y + h], P.ink, 5); line(c, [x + w - 8, y + 10, x + w - 4, y + h], P.ink, 5); line(c, [x + 6, y + h * 0.6, x + w - 6, y + h * 0.6], P.ink, 3); return;
      case 'bench':
        fillRR(c, x - 8, y, w + 16, 14, 3, P.obj, P.ink, 2); c.fillStyle = P.mid; c.fillRect(x, y + 14, w, h - 14);
        if (s.open) { fillRR(c, x + 10, y + 50, w - 20, 40, 3, P.ink, P.ink, 2); fillRR(c, x + 4, y + 60, w - 8, 36, 3, P.obj, P.ink, 2); if (!s.empty) { drawIcon(c, 'wick', x + w * 0.35, y + 74, 30); drawIcon(c, 'flint', x + w * 0.65, y + 74, 30); } }
        else { fillRR(c, x + 10, y + 50, w - 20, 40, 3, P.obj, P.ink, 2); fillRR(c, x + w / 2 - 14, y + 66, 28, 8, 3, P.ink); }
        return;
      case 'logs': var n = s.empty ? 2 : 9; for (var i = 0; i < n; i++) { var col = i % 4, rowi = (i / 4) | 0; circ(c, x + 16 + col * 26 + rowi * 12, y + h - 14 - rowi * 22, 12, P.obj, P.ink, 2); circ(c, x + 16 + col * 26 + rowi * 12, y + h - 14 - rowi * 22, 3, P.objD); } return;
      case 'net':
        c.strokeStyle = P.ink; c.lineWidth = 1.5; for (var k = 0; k <= 6; k++) { c.beginPath(); c.moveTo(x + k * w / 6, y); c.lineTo(x + w / 2 + (k - 3) * w / 10, y + h); c.stroke(); }
        for (var j = 1; j < 5; j++) { c.beginPath(); c.moveTo(x + j * 5, y + j * h / 5); c.lineTo(x + w - j * 5, y + j * h / 5); c.stroke(); }
        line(c, [x + 4, y, x + w - 4, y], P.objD, 5); if (!s.empty) drawIcon(c, 'fish', x + w / 2, y + h * 0.62, 34); return;
      case 'panel':
        fillRR(c, x, y, w, h, 6, P.obj, P.ink, 3);
        if (s.ok) { line(c, [x + 10, y + h * 0.5, x + w - 10, y + h * 0.5], OIL, 12); }
        else { line(c, [x + 14, y + 30, x + 60, y + 30, x + 60, y + 90], P.objD, 10); line(c, [x + 90, y + 40, x + 90, y + 110, x + w - 20, y + 110], P.objD, 10); line(c, [x + 120, y + 30, x + w - 14, y + 70], P.objD, 10); drawIcon(c, 'question', x + w - 30, y + 30, 28); }
        return;
    }
    fillRR(c, x, y, w, h, 3, P.obj, P.ink, 2); line(c, [x, y, x + w, y + h], P.objD, 1.5); line(c, [x + w, y, x, y + h], P.objD, 1.5);
    if (s.icon) { fillRR(c, x + w * 0.15, y + h * 0.15, w * 0.7, h * 0.7, 4, P.obj); drawIcon(c, s.icon, x + w / 2, y + h / 2, Math.min(w, h) * 0.7); }
  };
  // фрагмент «оправы линзы» для сдвижной головоломки: кольца + спицы, разрезанные сеткой n×n
  function drawPicTile(c, o, P) {
    var s = o.state, n = s.n || 3, part = s.part, x = o.x, y = o.y, w = o.w, h = o.h;
    c.save();
    fillRR(c, x, y, w, h, 6, P.obj, P.ink, 2); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip();
    var full = part < 0, S = full ? w : w * n, ox = full ? x : x - (part % n) * w, oy = full ? y : y - ((part / n) | 0) * h, cx = ox + S / 2, cy = oy + S / 2;
    circ(c, cx, cy, S * 0.44, null, P.ink, S * 0.045); circ(c, cx, cy, S * 0.3, null, P.objD, S * 0.03); circ(c, cx, cy, S * 0.12, '#eef3f6', P.ink, S * 0.02);
    for (var i = 0; i < 8; i++) { var a = i * TAU / 8 + 0.2; line(c, [cx + Math.cos(a) * S * 0.12, cy + Math.sin(a) * S * 0.12, cx + Math.cos(a) * S * 0.44, cy + Math.sin(a) * S * 0.44], P.ink, S * 0.02); }
    for (var k = 0; k < 4; k++) { var b = k * TAU / 4 + TAU / 8; circ(c, cx + Math.cos(b) * S * 0.44, cy + Math.sin(b) * S * 0.44, S * 0.04, GLOW, P.ink, 2); }
    c.restore();
  }
  KD.machine = function (c, o, P, t) {
    var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2;
    switch (s.variant) {
      case 'stove':
        c.fillStyle = P.objD; c.fillRect(cx - 16, 0, 32, y + 20); fillRR(c, x, y + 20, w, h - 20, 8, P.mid, P.ink, 3);
        fillRR(c, x + 20, y + h * 0.45, w - 40, h * 0.32, 6, s.fire ? '#3a2a1a' : P.ink, P.ink, 2);
        if (s.wood) { circ(c, cx - 14, y + h * 0.7, 9, P.obj, P.ink, 2); circ(c, cx + 12, y + h * 0.7, 9, P.obj, P.ink, 2); }
        if (s.fire) { glow(c, cx, y + h * 0.62, 150, 0.5); flame(c, cx - 12, y + h * 0.72, 1.3, t); flame(c, cx + 10, y + h * 0.72, 1.1, t + 1); }
        return;
      case 'well':
        line(c, [x + 10, y + h * 0.45, x + 10, y, x + w - 10, y, x + w - 10, y + h * 0.45], P.ink, 6); poly(c, [x - 6, y + 4, cx, y - 26, x + w + 6, y + 4], P.objD);
        line(c, [cx, y, cx, y + h * 0.5], P.ink, 2); fillRR(c, x, y + h * 0.45, w, h * 0.55, 10, P.obj, P.ink, 3); line(c, [x, y + h * 0.65, x + w, y + h * 0.65], P.objD, 2); return;
      case 'crane': {
        var prog = s.prog || 0, swung = prog >= 2, low = prog >= 3, pin = prog >= 1;
        c.fillStyle = P.objD; c.fillRect(x + 20, y + 30, 22, h - 30); fillRR(c, x, y + h - 22, 70, 22, 3, P.mid, P.ink, 2);
        var ang = swung ? 0 : -0.75, ax = x + 31, ay = y + 40, len = w - 20, ex = ax + Math.cos(ang) * len, ey = ay + Math.sin(ang) * len;
        line(c, [ax, ay, ex, ey], P.ink, 9); line(c, [ax, ay, ex, ey], P.obj, 4);
        fillRR(c, ax - 18, ay - 28, 18, 18, 3, pin ? P.obj : '#6a3b35', P.ink, 2); if (!pin) line(c, [ax - 9, ay - 10, ax + 10, ay + 2], '#6a3b35', 5);
        var hy = ey + (low ? 160 : 40); line(c, [ex, ey, ex, hy], P.ink, 2); drawIcon(c, 'hook', ex, hy + 6, 22);
        if (s.load) drawIcon(c, 'bucket', ex, hy + 26, 34);
        return; }
      case 'tank': fillRR(c, x, y + 20, w, h - 20, 26, P.obj, P.ink, 3); c.fillStyle = OIL; rr(c, x + 8, y + h * 0.45, w - 16, h * 0.5, 18); c.fill(); line(c, [x, y + h * 0.3, x + w, y + h * 0.3], P.objD, 2); drawIcon(c, 'oilcan_full', cx, y + h * 0.3 - 20, 30); return;
      case 'gauge': {
        fillRR(c, x, y, w, h, 10, P.obj, P.ink, 3); var gx = cx, gy = y + h * 0.7, r = Math.min(w, h) * 0.55;
        c.beginPath(); c.arc(gx, gy, r, Math.PI, 0); c.strokeStyle = P.objD; c.lineWidth = 3; c.stroke();
        var ma = Math.PI + (s.mark || 0) * Math.PI; c.beginPath(); c.arc(gx, gy, r - 6, ma - 0.12, ma + 0.12); c.strokeStyle = '#3f5f3d'; c.lineWidth = 9; c.stroke();
        var na = Math.PI + (s.gauge || 0) * Math.PI; line(c, [gx, gy, gx + Math.cos(na) * (r - 4), gy + Math.sin(na) * (r - 4)], s.ok ? '#3f5f3d' : P.ink, 4); circ(c, gx, gy, 5, P.ink);
        return; }
      case 'spout': line(c, [x, y, cx, y, cx, y + h * 0.6], P.ink, 16); line(c, [x, y, cx, y, cx, y + h * 0.6], P.mid, 8); if (s.drip) { var dy = (t * 60) % 40; circ(c, cx, y + h * 0.6 + dy, 4, OIL); } return;
      case 'winch': {
        var p2 = s.prog || 0, rot = Math.max(0, p2 - 1) * 1.6;
        fillRR(c, x, y + h - 26, w, 26, 3, P.mid, P.ink, 2); line(c, [x + 10, y + h - 26, x + 10, y + 20], P.ink, 6); line(c, [x + w - 10, y + h - 26, x + w - 10, y + 20], P.ink, 6);
        circ(c, cx, y + 44, 26, P.obj, P.ink, 3); for (var i = 0; i < 6; i++) { var a = rot + i * TAU / 6; line(c, [cx, y + 44, cx + Math.cos(a) * 24, y + 44 + Math.sin(a) * 24], P.objD, 2); }
        if (s.crank) { var ca = rot; line(c, [cx, y + 44, cx + Math.cos(ca) * 40, y + 44 + Math.sin(ca) * 40], P.ink, 6); circ(c, cx + Math.cos(ca) * 40, y + 44 + Math.sin(ca) * 40, 6, P.obj, P.ink, 2); }
        else { c.setLineDash && c.setLineDash([5, 5]); circ(c, cx, y + 44, 40, null, 'rgba(0,0,0,0.4)', 2); c.setLineDash && c.setLineDash([]); }
        return; }
      case 'carriage': {
        fillRR(c, x, y + 20, w, h - 20, 10, P.mid, P.ink, 3);
        for (var g = 0; g < 5; g++) { var gx2 = x + 30 + g * (w - 60) / 4; circ(c, gx2, y + 22, 14, P.obj, P.ink, 2); if (!s.ok && g % 2) line(c, [gx2 - 10, y + 10, gx2 + 10, y + 34], '#6a3b35', 3); }
        if (!s.ok) drawIcon(c, 'gear', x + w - 26, y - 14, 30);
        return; }
    }
    fillRR(c, x, y, w, h, 8, P.mid, P.ink, 3); drawIcon(c, 'gear', cx, y + h / 2, Math.min(w, h) * 0.6);
  };
  KD.item = function (c, o, P, t) {
    var cx = o.x + o.w / 2, cy = o.y + o.h / 2, s = Math.min(o.w, o.h) * 1.15;
    if (o.item !== 'boat' && o.item !== 'firefly') { c.save(); c.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3 + (o.x || 0)); circ(c, cx, cy, s * 0.62, '#ffffff'); c.restore(); }
    drawIcon(c, o.item, cx, cy + (o.item === 'boat' ? Math.sin(t * 1.4 + o.x) * 2 : 0), o.item === 'boat' ? Math.max(o.w, o.h) * 1.1 : s);
  };
  KD.npc = function (c, o, P, t) { drawNpc(c, o, (o.state && o.state.pose) || 'idle', t, P); };
  KD.sign = function (c, o, P) {
    var s = o.state || {}, icons = s.icons || [], x = o.x, y = o.y, w = o.w, h = o.h;
    fillRR(c, x, y, w, h, 4, '#e9e3d6', P.ink, 3); circ(c, x + w / 2, y - 4, 4, P.ink);
    var n = Math.max(1, icons.length), step = (w - 16) / n;
    icons.forEach(function (ic, i) { drawIcon(c, ic, x + 8 + step * (i + 0.5), y + h / 2, Math.min(step, h) * 0.75); if (i < n - 1) line(c, [x + 8 + step * (i + 1) - 3, y + h / 2, x + 8 + step * (i + 1) + 3, y + h / 2], P.objD, 2); });
  };
  KD.shelf = function (c, o, P) { fillRR(c, o.x, o.y, o.w, o.h || 12, 2, P.obj, P.ink, 2); line(c, [o.x + 14, o.y + (o.h || 12), o.x + 14, o.y + 40, o.x + 40, o.y + (o.h || 12)], P.objD, 3); line(c, [o.x + o.w - 14, o.y + (o.h || 12), o.x + o.w - 14, o.y + 40, o.x + o.w - 40, o.y + (o.h || 12)], P.objD, 3); };
  KD.chime = function (c, o, P, t) {
    var s = o.state || {}, n = s.n || 5, k = s.note || 0, ring = s.ring || 0, sw = Math.sin(t * 18) * ring * 0.08;
    var len = o.h * (0.55 + 0.45 * (1 - k / Math.max(1, n - 1))), cx = o.x + o.w / 2;
    c.save(); c.translate(cx, o.y); c.rotate(sw);
    line(c, [0, 0, 0, 16], P.ink, 2); if (ring > 0.05) glow(c, 0, 16 + len / 2, o.w * 2, 0.35 * ring);
    fillRR(c, -o.w / 2, 16, o.w, len, o.w / 2, ring > 0.05 ? '#f3ead2' : P.obj, P.ink, 3); line(c, [-o.w / 2 + 6, 26, -o.w / 2 + 6, 10 + len], 'rgba(255,255,255,0.6)', 3);
    c.restore();
  };
  function unknown(c, o, P) { var x = o.x || 0, y = o.y || 0, w = o.w || 30, h = o.h || 30; fillRR(c, x, y, w, h, 3, 'rgba(128,128,128,0.5)', P.ink, 2); line(c, [x, y, x + w, y + h], P.ink, 1); line(c, [x + w, y, x, y + h], P.ink, 1); }

  // ---------- персонажи ----------
  function drawNpc(c, o, pose, t, P) {
    P = P || PAL.day; var s = o.state || {}, x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, by = y + h, bob = pose === 'happy' ? -Math.abs(Math.sin(t * 7)) * 4 : 0;
    switch (s.type) {
      case 'master': {
        var warm = s.warm, sh = warm ? 0 : Math.sin(t * 22) * 1.5;
        fillRR(c, x + 4, by - 60, w - 8, 60, 6, P.objD); // стул
        c.save(); c.translate(sh, bob);
        fillRR(c, x + 10, by - 100, w - 20, 70, 14, warm ? '#9c958c' : '#7d8288', P.ink, 2.5);  // плед
        circ(c, cx, by - 112, 18, '#cfc6bb', P.ink, 2.5); c.fillStyle = '#ebe7e1'; c.beginPath(); c.ellipse(cx, by - 96, 12, 10, 0, 0, Math.PI); c.fill(); // борода
        line(c, [cx - 10, by - 118, cx - 3, by - 117], P.ink, 2); line(c, [cx + 3, by - 117, cx + 10, by - 118], P.ink, 2);
        if (pose === 'happy') { line(c, [x + 12, by - 80, x - 4, by - 118], P.ink, 5); line(c, [x + w - 12, by - 80, x + w + 4, by - 118], P.ink, 5); }
        if (!warm) drawIcon(c, 'cold', x + w + 4, by - 136, 18);
        c.restore(); return; }
      case 'baker':
        fillRR(c, x + 6, y + h * 0.45, w - 12, h * 0.55, 10, '#efece6', P.ink, 2.5); circ(c, cx, y + h * 0.32, h * 0.22, '#d6cdc1', P.ink, 2.5);
        fillRR(c, cx - h * 0.2, y, h * 0.4, h * 0.14, 6, '#ffffff', P.ink, 2); if (pose === 'happy') line(c, [x + 8, y + h * 0.6, x - 6, y + h * 0.3], P.ink, 5); return;
      case 'goat': {
        var chew = Math.sin(t * 6) * 2; c.save(); c.translate(0, bob);
        c.beginPath(); c.ellipse(cx - 4, by - h * 0.45, w * 0.36, h * 0.22, 0, 0, TAU); c.fillStyle = '#e6e2dc'; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2.5; c.stroke();
        [-0.25, -0.1, 0.12, 0.25].forEach(function (k) { line(c, [cx + k * w, by - h * 0.3, cx + k * w, by], P.ink, 4); });
        var hx = pose === 'happy' ? cx - w * 0.42 : cx + w * 0.36; circ(c, hx, by - h * 0.62 + chew, h * 0.14, '#e6e2dc', P.ink, 2.5);
        line(c, [hx - 4, by - h * 0.74, hx - 10, by - h * 0.92], P.ink, 3); line(c, [hx + 4, by - h * 0.74, hx + 8, by - h * 0.94], P.ink, 3);
        c.restore(); return; }
      case 'cat': {
        var tail = Math.sin(t * 2.2) * 8, fed = s.fed;
        c.beginPath(); c.ellipse(cx, by - h * 0.32, w * 0.32, h * 0.3, 0, 0, TAU); c.fillStyle = '#6f6a66'; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke();
        circ(c, cx, by - h * 0.72, h * 0.2, '#6f6a66', P.ink, 2); poly(c, [cx - 10, by - h * 0.82, cx - 9, by - h * 1.02, cx - 2, by - h * 0.88], P.ink); poly(c, [cx + 10, by - h * 0.82, cx + 9, by - h * 1.02, cx + 2, by - h * 0.88], P.ink);
        c.beginPath(); c.moveTo(cx + w * 0.28, by - 6); c.quadraticCurveTo(cx + w * 0.6, by - 10 + tail, cx + w * 0.5, by - h * 0.6 + tail); c.strokeStyle = P.ink; c.lineWidth = 4; c.stroke();
        if (fed) { line(c, [cx - 7, by - h * 0.74, cx - 2, by - h * 0.71], '#ffffff', 2); line(c, [cx + 2, by - h * 0.71, cx + 7, by - h * 0.74], '#ffffff', 2); }
        else { circ(c, cx - 5, by - h * 0.73, 2.5, '#f2e7b0'); circ(c, cx + 5, by - h * 0.73, 2.5, '#f2e7b0'); }
        return; }
      case 'gull': {
        var flap = Math.sin(t * (pose === 'happy' ? 12 : 2)) * 0.3;
        fillRR(c, x, by - 14, w, 14, 6, '#8a7c66', P.ink, 2); // гнездо
        c.beginPath(); c.ellipse(cx, by - h * 0.42, w * 0.32, h * 0.2, 0, 0, TAU); c.fillStyle = '#f2f1ee'; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2.5; c.stroke();
        circ(c, cx + w * 0.24, by - h * 0.7, h * 0.12, '#f2f1ee', P.ink, 2.5); poly(c, [cx + w * 0.32, by - h * 0.72, cx + w * 0.48, by - h * 0.68, cx + w * 0.32, by - h * 0.64], GLOW, P.ink, 1.5);
        c.save(); c.translate(cx - 4, by - h * 0.45); c.rotate(-0.4 + flap); poly(c, [0, 0, -w * 0.45, -h * 0.3, -w * 0.15, 4], '#c9c8c4', P.ink, 2); c.restore();
        return; }
      case 'bird': {
        var sing = s.sing || 0, bx = cx, bY = y + 12 - sing * 6;
        if (s.post) { c.fillStyle = P.near; c.fillRect(cx - 4, y + 22, 8, h - 22); }
        c.beginPath(); c.ellipse(bx, bY, 11, 8, 0, 0, TAU); c.fillStyle = sing > 0.1 ? '#f3ead2' : '#e2ded8'; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke();
        circ(c, bx + 8, bY - 6, 5, '#e2ded8', P.ink, 2); poly(c, [bx + 12, bY - 7, bx + 18, bY - 5, bx + 12, bY - 3], P.ink); line(c, [bx - 10, bY, bx - 17, bY - 5], P.ink, 3);
        if (sing > 0.1) drawIcon(c, 'note', bx + 4, bY - 26, 22);
        return; }
    }
    fillRR(c, x, y + h * 0.3, w, h * 0.7, 8, P.mid, P.ink, 2); circ(c, cx, y + h * 0.2, Math.min(w, h) * 0.18, P.obj, P.ink, 2);
  }

  // ---------- героиня: девочка-подмастерье (коса, длинное пальто, сумка через плечо, шарф) ----------
  function drawHero(c, hero, pose, t) {
    var x = hero.x, y = hero.y, dir = hero.dir < 0 ? -1 : 1, walk = pose === 'walk', ph = t * 9;
    var bob = walk ? Math.abs(Math.sin(ph)) * 3 : (pose === 'happy' ? Math.abs(Math.sin(t * 8)) * 7 : Math.sin(t * 2) * 1);
    c.save(); c.translate(x, y - bob); c.scale(dir, 1);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(0, bob, 26, 6, 0, 0, TAU); c.fill();
    var INK = '#232120', COAT = '#5d6066', SKIN = '#d9cdbf', HAIR = '#3b3532', SCARF = '#c98e4e';
    var l1 = walk ? Math.sin(ph) * 10 : 0;
    line(c, [-6, -36, -6 + l1, 0], INK, 7); line(c, [6, -36, 6 - l1, 0], INK, 7);
    poly(c, [-17, -38, 17, -38, 12, -84, -12, -84], COAT, INK, 2.5);
    fillRR(c, 8, -64, 16, 20, 4, '#8a7d6a', INK, 2); line(c, [-10, -84, 16, -62], INK, 2);  // сумка
    var arm = pose === 'reach' ? [4, -80, 26, -118] : pose === 'think' ? [6, -80, 6, -96] : pose === 'happy' ? [6, -80, 22, -112] : [8, -80, 14 + (walk ? -l1 * 0.6 : 0), -50];
    line(c, arm, COAT, 7); circ(c, arm[2], arm[3], 4, SKIN);
    if (pose === 'happy') { line(c, [-6, -80, -22, -112], COAT, 7); circ(c, -22, -112, 4, SKIN); }
    fillRR(c, -13, -90, 26, 8, 4, SCARF, INK, 1.5); line(c, [-8, -86, -16, -66], SCARF, 5);
    circ(c, 0, -104, 15, SKIN, INK, 2.5);
    c.beginPath(); c.arc(0, -107, 15.5, Math.PI * 1.05, Math.PI * 1.95); c.fillStyle = HAIR; c.fill();
    line(c, [-12, -102, -18, -80], HAIR, 5); circ(c, -18, -78, 3, SCARF);   // коса с лентой
    circ(c, 6, -104, 1.8, INK); if (pose === 'happy') { c.beginPath(); c.arc(4, -98, 4, 0.2, Math.PI - 0.2); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); }
    c.restore();
  }

  // ---------- мысль-пузырь: «облако» из кругов, без текста ----------
  function drawThought(c, x, y, icons, t) {
    icons = icons || []; var n = Math.max(1, icons.length), w = 30 + n * 50, h = 66;
    var bx = Math.max(10, Math.min(950 - w, x - w / 2)), by = Math.max(8, y - h - 30), pop = Math.min(1, 0.9 + 0.1 * Math.sin(t * 3));
    c.save(); c.fillStyle = 'rgba(250,248,244,0.96)'; c.strokeStyle = '#2b2928'; c.lineWidth = 2.5;
    c.beginPath(); var k = Math.max(3, n * 2 + 1);
    for (var i = 0; i < k; i++) { var px = bx + 14 + (w - 28) * i / (k - 1); c.moveTo(px + 18, by + 10); c.arc(px, by + 10, 18, 0, TAU); c.moveTo(px + 18, by + h - 10); c.arc(px, by + h - 10, 18, 0, TAU); }
    c.moveTo(bx + 24, by + h / 2); c.arc(bx + 6, by + h / 2, 18, 0, TAU); c.moveTo(bx + w + 12, by + h / 2); c.arc(bx + w - 6, by + h / 2, 18, 0, TAU);
    c.fill(); c.stroke(); c.fillRect(bx + 6, by + 6, w - 12, h - 12);
    circ(c, x - 4, by + h + 14, 7, 'rgba(250,248,244,0.96)', '#2b2928', 2); circ(c, x - 10, by + h + 28, 4, 'rgba(250,248,244,0.96)', '#2b2928', 2);
    for (var j = 0; j < icons.length; j++) drawIcon(c, icons[j], bx + 15 + 25 + j * 50, by + h / 2, 42 * pop);
    c.restore();
  }

  function drawCursor(c, kind, x, y) {
    c.save(); c.translate(x, y);
    switch (kind) {
      case 'use': circ(c, 0, 0, 14, 'rgba(255,255,255,0.75)', '#2b2928', 2); IC.gear(c); break;
      case 'take': circ(c, 0, 0, 14, 'rgba(255,255,255,0.75)', '#2b2928', 2); c.scale(0.7, 0.7); poly(c, [-10, 12, -12, -4, -8, -6, -6, 2, -6, -14, -2, -14, -1, 0, 1, -16, 5, -16, 5, 0, 8, -12, 12, -12, 11, 4, 8, 12], '#dcd8d2', '#2b2928', 2); break;
      case 'go': circ(c, 0, 0, 14, 'rgba(255,255,255,0.75)', '#2b2928', 2); c.scale(0.7, 0.7); poly(c, [-12, -5, 2, -5, 2, -13, 15, 0, 2, 13, 2, 5, -12, 5], '#dcd8d2', '#2b2928', 2); break;
      case 'look': circ(c, 0, 0, 14, 'rgba(255,255,255,0.75)', '#2b2928', 2); c.scale(0.75, 0.75); IC.eye(c); break;
      case 'walk': circ(c, 0, 0, 6, null, 'rgba(30,30,30,0.7)', 2); circ(c, 0, 0, 1.5, 'rgba(30,30,30,0.7)'); break;
      default: line(c, [-8, 0, 8, 0], '#2b2928', 2); line(c, [0, -8, 0, 8], '#2b2928', 2);
    }
    c.restore();
  }

  function button(c, b, icon, on, ring) {
    circ(c, b.x, b.y, b.r, on ? '#efe9dd' : '#9a958e', '#2b2928', 2.5);
    if (on && icon === 'hint') glow(c, b.x, b.y, b.r * 1.8, 0.35);
    drawIcon(c, icon, b.x, b.y, b.r * 1.5);
    if (ring) { c.beginPath(); c.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - ring)); c.strokeStyle = '#f0bf5a'; c.lineWidth = 4; c.stroke(); }
  }
  function drawUI(c, ui, t) {
    ui = ui || {}; var L = ui.layout || (API && API.LAYOUT); if (!L) return;
    if (ui.mode === 'walk' && ui.walk) { drawWalk(c, ui, L, t); return; }
    if (ui.mode !== 'mini') {
      var I = L.inv; c.fillStyle = 'rgba(38,36,34,0.86)'; c.fillRect(I.x, I.y, I.w, I.h); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(I.x, I.y, I.w, 2);
      for (var i = 0; i < I.slots; i++) {
        var x = I.slot0 + i * (I.slotW + I.gap), item = (ui.inv || [])[i], sel = item && ui.sel === item, hov = ui.hover === i && item;
        fillRR(c, x, I.slotY, I.slotW, I.slotH, 8, sel ? '#efe9dd' : (hov ? '#8a857e' : '#5b5752'), sel ? GLOW : '#2b2928', sel ? 4 : 2);
        if (item && !(ui.drag && ui.drag.item === item)) drawIcon(c, item, x + I.slotW / 2, I.slotY + I.slotH / 2, 40);
      }
      button(c, L.hint, 'hint', ui.hint && ui.hint.ready, ui.hint && !ui.hint.ready ? ui.hint.cd : 0);
      if (ui.hint && !ui.hint.ready) drawIcon(c, 'firefly', L.hint.x + 18, L.hint.y - 18, 18);
      button(c, L.book, 'book', true);
      if (ui.progress) { var pw = 110, px = I.w - pw - 16, py = I.y + I.h / 2 - 4, f = ui.progress.solved / Math.max(1, ui.progress.total); fillRR(c, px, py, pw, 8, 4, '#5b5752'); fillRR(c, px, py, Math.max(8, pw * f), 8, 4, GLOW); drawIcon(c, 'lamp', px - 14, py + 4, 20); }
    }
    if (ui.close) { button(c, L.close, 'close', true); if (ui.solvedMini) { glow(c, 480, 270, 260, 0.35); drawIcon(c, 'check', 480, 270, 120); } }
    if (ui.drag) { c.save(); c.globalAlpha = 0.9; drawIcon(c, ui.drag.item, ui.drag.x, ui.drag.y, 46); c.restore(); }
    if (ui.mode === 'cut') { c.fillStyle = 'rgba(0,0,0,0.85)'; c.fillRect(0, 0, 960, 22); c.fillStyle = 'rgba(20,19,18,0.55)'; c.fillRect(L.inv.x, L.inv.y, L.inv.w, L.inv.h); }
    if (ui.debug) { c.save(); c.font = '700 11px monospace'; c.fillStyle = '#b00'; c.fillText('DEBUG (D)', 8, 16); c.restore(); }
  }
  function drawWalk(c, ui, L, t) {
    var W = L.walk, wk = ui.walk, per = W.cols * W.rows;
    c.fillStyle = 'rgba(232,227,216,0.97)'; c.fillRect(0, 0, 960, 540);
    c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 1; for (var y = 20; y < 540; y += 22) { c.beginPath(); c.moveTo(0, y); c.lineTo(960, y); c.stroke(); }
    drawIcon(c, 'book', 480, 48, 44);
    var steps = wk.steps.slice(wk.page * per, wk.page * per + per);
    steps.forEach(function (s, i) {
      var col = i % W.cols, row = (i / W.cols) | 0, x = W.x0 + col * (W.cw + W.gap), yy = W.y0 + row * (W.ch + W.gap);
      fillRR(c, x, yy, W.cw, W.ch, 10, s.done ? '#f6f1e6' : '#ffffff', '#2b2928', 2);
      var ic = s.icons, head = ic[0];
      drawIcon(c, head, x + 30, yy + 30, 34); line(c, [x + 54, yy + 30, x + W.cw - 16, yy + 30], 'rgba(0,0,0,0.25)', 2);
      var rest = ic.slice(1), n = rest.length, cols = Math.min(n, 4), sz = n > 4 ? 34 : 44;
      rest.forEach(function (id, j) { var cx = x + 20 + (W.cw - 40) * ((j % cols) + 0.5) / cols, cy = yy + (n > 4 ? 82 + ((j / cols) | 0) * 46 : 100); drawIcon(c, id, cx, cy, sz); if (j < n - 1 && (j % cols) < cols - 1) poly(c, [cx + sz * 0.55, cy - 4, cx + sz * 0.7, cy, cx + sz * 0.55, cy + 4], '#8d8984'); });
      if (s.done) drawIcon(c, 'check', x + W.cw - 22, yy + W.ch - 22, 26);
    });
    if (wk.page > 0) button(c, W.prev, 'prev', true);
    if (wk.page < wk.pages - 1) button(c, W.next, 'next', true);
    button(c, W.close, 'close', true);
    for (var p = 0; p < wk.pages; p++) circ(c, 480 - (wk.pages - 1) * 10 + p * 20, 520, 5, p === wk.page ? '#2b2928' : '#b4afa6');
  }

  function drawItem(c, o, P, t) { var f = KD[o.kind]; try { if (f) f(c, o, P, t); else unknown(c, o, P); } catch (e) { unknown(c, o, P); } }
  function drawScene(c, scene, t, opts) {
    opts = opts || {}; var P = pal(scene && scene.mood); t = t || 0;
    c.save(); c.fillStyle = P.sky1; c.fillRect(0, 0, (scene && scene.w) || 960, (scene && scene.h) || 540);
    var layers = ((scene && scene.layers) || []).slice().sort(function (a, b) { return (a.depth || 0) - (b.depth || 0); });
    layers.forEach(function (L) { if ((L.depth || 0) < 3) (L.items || []).forEach(function (it) { drawItem(c, it, P, t); }); });
    ((scene && scene.objects) || []).forEach(function (o) { drawItem(c, o, P, t); });
    layers.forEach(function (L) { if ((L.depth || 0) >= 3) (L.items || []).forEach(function (it) { drawItem(c, it, P, t); }); });
    if (scene && scene.dark) {
      var lt = opts.light;
      if (lt) { var g = c.createRadialGradient(lt.x, lt.y, lt.r * 0.25, lt.x, lt.y, lt.r); g.addColorStop(0, 'rgba(8,8,10,0)'); g.addColorStop(1, 'rgba(8,8,10,0.96)'); c.fillStyle = g; c.fillRect(0, 0, 960, 540); }
      else { c.fillStyle = 'rgba(8,8,10,0.96)'; c.fillRect(0, 0, 960, 540); }
    }
    if (opts.debug && scene) {
      c.font = '700 10px monospace'; c.textBaseline = 'top';
      (scene.objects || []).forEach(function (o) { c.fillStyle = 'rgba(0,0,0,0.6)'; var s = o.id + ':' + o.kind; c.fillRect(o.x, o.y - 12, s.length * 6.2 + 4, 12); c.fillStyle = '#fff'; c.fillText(s, o.x + 2, o.y - 11); });
      (scene.hotspots || []).forEach(function (h) { c.strokeStyle = h.to ? '#2a6' : '#c33'; c.lineWidth = 1.5; c.setLineDash && c.setLineDash([4, 3]); c.strokeRect(h.rect[0], h.rect[1], h.rect[2], h.rect[3]); c.setLineDash && c.setLineDash([]); c.fillStyle = '#c33'; c.fillText(h.id + (h.to ? '→' + h.to : ''), h.rect[0] + 2, h.rect[1] + h.rect[3] - 12); });
      if (scene.walk) { c.strokeStyle = '#36c'; c.lineWidth = 2; c.beginPath(); scene.walk.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); }
    }
    c.restore();
  }

  global.KvestTheme = {
    id: 'grey', name: { ru: 'Серый макет', en: 'Greybox' },
    drawScene: drawScene,
    drawHero: drawHero,
    drawNpc: function (c, npc, pose, t) { drawNpc(c, npc, pose, t, PAL.day); },
    drawThought: drawThought,
    drawIcon: drawIcon,
    drawCursor: drawCursor,
    drawUI: drawUI
  };
})(typeof window !== 'undefined' ? window : globalThis);
