/* ЛИВЕНЬ · 5 этапов: название, фон и сценарий волн. Часы этапа стоят, пока на поле мид-босс или босс.
   Событие волны: { t, type (mote|chime|bell|rotor|gong), path (fall|swoop|hover|side), x, n (сколько), gap (с между),
   dx (сдвиг x на каждого), pat (узор из LIVEN.PAT), vx, vy, ty, hold, amp, fq, dir, hpMul }; { t, boss:'m1', mid:true } — босс.
   LIVEN.expandScript(stage) раскладывает волны в отсортированный список появлений (вызывается при старте этапа). */
(function (global) {
  'use strict';
  var LV = global.LIVEN = global.LIVEN || {};
  function W(t, type, path, x, n, gap, pat, o) { var e = { t: t, type: type, path: path, x: x, n: n || 1, gap: gap || 0, pat: pat || null }; if (o) for (var k in o) e[k] = o[k]; return e; }
  function MID(t, id) { return { t: t, boss: id, mid: true }; }
  function BOSS(t, id) { return { t: t, boss: id }; }

  LV.STAGES = [
    { n: { ru: 'Ржавая звонница', en: 'Rusty Belfry' }, sky: 0, ev: [
      W(1.0, 'mote', 'fall', 90, 5, 0.35, 'aim1', { vy: 120, vx: 10 }),
      W(3.6, 'mote', 'fall', 310, 5, 0.35, 'aim1', { vy: 120, vx: -10 }),
      W(6.5, 'bell', 'hover', 120, 1, 0, 'ring', { ty: 140, hold: 3 }),
      W(6.5, 'bell', 'hover', 280, 1, 0, 'ring', { ty: 140, hold: 3 }),
      W(10, 'mote', 'swoop', 60, 6, 0.3, 'aim1', { vy: 150, ty: 220, dir: 1 }),
      W(13, 'mote', 'swoop', 340, 6, 0.3, 'aim1', { vy: 150, ty: 220, dir: -1 }),
      W(16, 'gong', 'hover', 200, 1, 0, 'spiral', { ty: 120, hold: 4, amp: 40 }),
      W(21, 'mote', 'fall', 60, 8, 0.25, null, { vy: 140, dx: 40 }),
      MID(23, 'm1'),
      W(24, 'bell', 'hover', 100, 3, 0.6, 'aim3', { ty: 150, hold: 3, dx: 100 }),
      W(28.5, 'mote', 'side', -20, 6, 0.3, 'aim1', { y: 90, vx: 130, vy: 25 }),
      W(30.5, 'mote', 'side', 420, 6, 0.3, 'aim1', { y: 150, vx: -130, vy: 25 }),
      W(33, 'rotor', 'hover', 110, 1, 0, 'flower', { ty: 130, hold: 4 }),
      W(33, 'rotor', 'hover', 290, 1, 0, 'flower', { ty: 130, hold: 4 }),
      W(39, 'mote', 'fall', 40, 10, 0.2, 'rain', { vy: 110, dx: 34 }),
      W(43, 'gong', 'hover', 200, 1, 0, 'ring', { ty: 110, hold: 4, amp: 60 }),
      BOSS(50, 'b1')
    ] },
    { n: { ru: 'Облачный жёлоб', en: 'Cloud Chute' }, sky: 1, ev: [
      W(1.0, 'mote', 'swoop', 70, 7, 0.28, 'aim3', { vy: 160, ty: 200, dir: 1 }),
      W(3.4, 'mote', 'swoop', 330, 7, 0.28, 'aim3', { vy: 160, ty: 200, dir: -1 }),
      W(6.5, 'chime', 'fall', 60, 6, 0.4, 'needle', { vy: 90, dx: 56 }),
      W(10, 'bell', 'hover', 80, 4, 0.5, 'ring', { ty: 130, hold: 3, dx: 80 }),
      W(15, 'rotor', 'hover', 200, 1, 0, 'flower', { ty: 140, hold: 5, amp: 50 }),
      W(16, 'mote', 'side', -20, 8, 0.25, 'aim1', { y: 220, vx: 140, vy: -10 }),
      W(21, 'mote', 'fall', 340, 8, 0.22, 'rain', { vy: 130, dx: -36 }),
      MID(23, 'm2'),
      W(24, 'chime', 'swoop', 60, 6, 0.35, 'aim3', { vy: 140, ty: 180, dir: 1 }),
      W(26, 'chime', 'swoop', 340, 6, 0.35, 'aim3', { vy: 140, ty: 180, dir: -1 }),
      W(30, 'gong', 'hover', 120, 1, 0, 'spiral', { ty: 120, hold: 4 }),
      W(30, 'gong', 'hover', 280, 1, 0, 'burst', { ty: 120, hold: 4 }),
      W(37, 'bell', 'hover', 60, 5, 0.4, 'aim5', { ty: 160, hold: 2.5, dx: 70 }),
      W(42, 'mote', 'fall', 30, 12, 0.18, 'aim1', { vy: 150, dx: 30 }),
      BOSS(48, 'b2')
    ] },
    { n: { ru: 'Молниевый пояс', en: 'Lightning Belt' }, sky: 2, ev: [
      W(1.0, 'chime', 'fall', 80, 4, 0.5, 'needle', { vy: 100, amp: 40, fq: 2 }),
      W(1.0, 'chime', 'fall', 320, 4, 0.5, 'needle', { vy: 100, amp: -40, fq: 2 }),
      W(5, 'bell', 'hover', 200, 1, 0, 'orbs', { ty: 120, hold: 3 }),
      W(6, 'mote', 'swoop', 50, 8, 0.25, 'aim1', { vy: 170, ty: 250, dir: 1 }),
      W(9, 'mote', 'swoop', 350, 8, 0.25, 'aim1', { vy: 170, ty: 250, dir: -1 }),
      W(12, 'rotor', 'hover', 100, 1, 0, 'spiral', { ty: 140, hold: 4 }),
      W(12, 'rotor', 'hover', 300, 1, 0, 'spiral', { ty: 140, hold: 4 }),
      W(18, 'chime', 'side', -20, 6, 0.4, 'aim3', { y: 100, vx: 110, vy: 30 }),
      MID(22, 'm3'),
      W(23, 'bell', 'hover', 70, 4, 0.5, 'burst', { ty: 140, hold: 3, dx: 87 }),
      W(29, 'mote', 'fall', 20, 14, 0.15, 'rain', { vy: 120, dx: 26 }),
      W(33, 'gong', 'hover', 200, 1, 0, 'flower', { ty: 120, hold: 5, amp: 70 }),
      W(40, 'chime', 'swoop', 60, 8, 0.3, 'needle', { vy: 150, ty: 200, dir: 1 }),
      BOSS(47, 'b3')
    ] },
    { n: { ru: 'Градовая галерея', en: 'Hail Gallery' }, sky: 3, ev: [
      W(1.0, 'mote', 'fall', 40, 10, 0.18, 'aim1', { vy: 160, dx: 32 }),
      W(4, 'bell', 'hover', 90, 3, 0.4, 'ring', { ty: 120, hold: 3, dx: 110 }),
      W(8, 'chime', 'swoop', 60, 8, 0.25, 'aim3', { vy: 170, ty: 210, dir: 1 }),
      W(10, 'chime', 'swoop', 340, 8, 0.25, 'aim3', { vy: 170, ty: 210, dir: -1 }),
      W(14, 'gong', 'hover', 200, 1, 0, 'burst', { ty: 120, hold: 5, amp: 80 }),
      W(15, 'mote', 'side', -20, 8, 0.25, 'rain', { y: 60, vx: 120, vy: 10 }),
      W(19, 'rotor', 'hover', 90, 2, 0.6, 'flower', { ty: 150, hold: 3, dx: 220 }),
      MID(23, 'm4'),
      W(24, 'mote', 'swoop', 50, 10, 0.2, 'aim1', { vy: 180, ty: 240, dir: 1 }),
      W(26, 'mote', 'swoop', 350, 10, 0.2, 'aim1', { vy: 180, ty: 240, dir: -1 }),
      W(30, 'bell', 'hover', 70, 4, 0.4, 'aim5', { ty: 130, hold: 3, dx: 87 }),
      W(35, 'gong', 'hover', 110, 1, 0, 'spiral', { ty: 110, hold: 4 }),
      W(35, 'gong', 'hover', 290, 1, 0, 'orbs', { ty: 110, hold: 4 }),
      W(42, 'chime', 'fall', 30, 10, 0.2, 'needle', { vy: 120, dx: 34 }),
      BOSS(48, 'b4')
    ] },
    { n: { ru: 'Колокольня над грозой', en: 'Belfry Above the Storm' }, sky: 4, ev: [
      W(1.0, 'bell', 'hover', 70, 4, 0.4, 'aim3', { ty: 120, hold: 2.5, dx: 87 }),
      W(5, 'mote', 'swoop', 50, 10, 0.2, 'aim1', { vy: 180, ty: 230, dir: 1 }),
      W(7, 'mote', 'swoop', 350, 10, 0.2, 'aim1', { vy: 180, ty: 230, dir: -1 }),
      W(10, 'rotor', 'hover', 200, 1, 0, 'flower', { ty: 130, hold: 4 }),
      W(11, 'chime', 'side', -20, 6, 0.35, 'needle', { y: 80, vx: 120, vy: 20 }),
      W(13, 'chime', 'side', 420, 6, 0.35, 'needle', { y: 110, vx: -120, vy: 20 }),
      W(17, 'gong', 'hover', 120, 1, 0, 'burst', { ty: 120, hold: 4 }),
      W(17, 'gong', 'hover', 280, 1, 0, 'ring', { ty: 120, hold: 4 }),
      MID(24, 'm5'),
      W(25, 'mote', 'fall', 20, 14, 0.14, 'aim1', { vy: 170, dx: 26 }),
      W(29, 'bell', 'hover', 60, 5, 0.35, 'orbs', { ty: 140, hold: 3, dx: 70 }),
      W(35, 'rotor', 'hover', 110, 1, 0, 'spiral', { ty: 130, hold: 4 }),
      W(35, 'rotor', 'hover', 290, 1, 0, 'spiral', { ty: 130, hold: 4 }),
      W(41, 'chime', 'swoop', 60, 8, 0.25, 'aim3', { vy: 170, ty: 200, dir: 1 }),
      W(42, 'chime', 'swoop', 340, 8, 0.25, 'aim3', { vy: 170, ty: 200, dir: -1 }),
      BOSS(49, 'b5')
    ] }
  ];

  LV.expandScript = function (stage) {
    var out = [];
    stage.ev.forEach(function (w) {
      if (w.boss) { out.push(w); return; }
      for (var i = 0; i < w.n; i++) {
        var e = {}; for (var k in w) e[k] = w[k];
        e.t = w.t + i * w.gap; e.x = w.x + (w.dx || 0) * i; e.n = 1;
        if (w.path === 'side') e.x = w.x; // по краю — все из одной точки
        out.push(e);
      }
    });
    out.sort(function (a, b) { return a.t - b.t || (a.boss ? 1 : 0) - (b.boss ? 1 : 0); });
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
