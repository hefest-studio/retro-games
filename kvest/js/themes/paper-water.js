/* МАЯЧНИЦА · themes/paper-water.js — расширение темы «бумага» для подводных механик (water.js, глава 4+), подключается после
   paper.js и paper-helpers.js. Через paper._ext (тот же «станок» вырезок, кэш спрайтов и палитры) добавляет:
   — kind: divebell (колокол-водолаз — медный купол с иллюминаторами на тросе), seabell (колокол: цвет-полоса и точки ноты — тот же
     язык, что у колокольчиков главы 1), kelp (ламинария), airpocket (перевёрнутая лодка | родник пузырей | воздух под сводом),
     buoy (буёк с колокольчиком), arch (арка затонувшего квартала), crane (стрела причала с барабаном), ruin (затонувшие стены),
     whale (Туманный Кит: далёкая тень или близко — глаз, складки, плавник с железным крюком);
   — палитры: baypier (туманная бухта), seabed (прозрачная вода: свет сверху), murk (мутная вода), deep (глубина),
     foundry (сухой каменный интерьер под водой);
   — хук drawWater: свет сверху и взвесь, МУТЬ (бледное облако ила тушью, кроме круга вокруг героини), КОЛЬЦА ЗВОНА ТУШЬЮ от колоколов
     с карточкой-нотой (точки, как у колокольчиков) — визуальный дубль звука; столбики пузырей у воздушных карманов в мути;
     ШКАЛА ВОЗДУХА пузырьками (без цифр) в LAYOUT.air; шлем-пузырь героини; затемнение мягкого возврата. */
(function (global) {
  'use strict';
  var KV = global.KVEST = global.KVEST || {}, th = KV.themes && KV.themes.paper; if (!th || !th._ext || th._water) return; th._water = true;
  var X = th._ext, C = X.C, K = X.K, LIVE = X.LIVE, TAU = Math.PI * 2, NOTE = X.NOTE;
  var cut = X.cut, flat = X.flat, poly = X.poly, ell = X.ell, rectP = X.rectP, rrP = X.rrP, lump = X.lump, rotP = X.rotP, band = X.band;
  var sprite = X.sprite, blit = X.blit, addGlow = X.addGlow, strokeL = X.strokeL, brad = X.brad, drawIconRaw = X.drawIconRaw, dark = X.dark, light = X.light, rng = X.rng;
  var INK = '#2a2420', IVORY = '#f3ead6', VERM = '#c0442e';

  // ---------- палитры ----------
  var P = X.PALS;
  P.baypier = { bands: ['#93a4ad', '#a9b6ba', '#c0c9c8', '#d6dad2'], bandY: [0, 96, 176, 240], sun: null,
    hillFar: '#8f9c9c', hillNear: '#74857f', grass: '#6f8356', earth: '#a8926e', sand: '#cdbb92', cloud: '#eef0ec', cloudB: '#cfd6d6', water: '#5d8590',
    glow: '255,214,150', tint: 'rgba(60,80,100,0.07)', fog: 0.55, rock: '#8a8a82', rockL: '#a6a69c' };
  P.seabed = { bands: ['#62a9ab', '#4c9198', '#3c7a86', '#2f6474', '#285465'], bandY: [0, 70, 150, 240, 330], sun: null,
    hillFar: '#2e6470', hillNear: '#27525e', earth: '#a9a482', sand: '#b9b48e', cloud: '#9fd0cc', cloudB: '#7fb8b8', water: '#3c7a86',
    glow: '190,240,230', tint: 'rgba(20,90,110,0.10)', fog: 0, rock: '#5f7f7c', rockL: '#7f9c94', under: true };
  P.murk = { bands: ['#8f9a84', '#7d8a76', '#6c7968', '#5d6a5c', '#525e52'], bandY: [0, 80, 160, 250, 340], sun: null,
    hillFar: '#5c6a5c', hillNear: '#4e5b4f', earth: '#8f8c6c', sand: '#9a9774', cloud: '#b7bfa8', cloudB: '#9aa58e', water: '#6c7968',
    glow: '220,230,190', tint: 'rgba(90,96,60,0.12)', fog: 0, rock: '#66705f', rockL: '#828b76', under: true };
  P.deep = { bands: ['#2c5a70', '#234b62', '#1c3e54', '#163247', '#11283b'], bandY: [0, 70, 150, 240, 330], sun: null,
    hillFar: '#1d3d50', hillNear: '#173244', earth: '#5f7480', sand: '#6b808a', cloud: '#5f8fa0', cloudB: '#467488', water: '#1c3e54',
    glow: '170,220,240', tint: 'rgba(10,30,70,0.14)', fog: 0, rock: '#3f5a68', rockL: '#587482', under: true };
  P.foundry = { bands: ['#26343a'], wall: ['#6f8480', '#677c78', '#788d88', '#607470'], wallD: '#445652', floor: ['#5c6660', '#555f59', '#646e68'], floorD: '#3e4743',
    win: 'sea', glow: '255,214,150', tint: 'rgba(20,60,70,0.08)', vign: 'rgba(8,20,26,0.5)', stone: true };
  X.INDOOR.foundry = 1;

  // ---------- рамки спрайтов ----------
  X.BOX_EXT.push(function (it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {};
    switch (it.kind) {
      case 'divebell': var top = st.under ? -10 : Math.max(-10, y - (st.rope || 420)) - 10; return [x - 30, top, w + 60, y + h + 70 - top];
      case 'crane': return [x - 30, y - 40, w + 80, h + 70];
      case 'whale': return [x - 50, y - 50, w + 100, h * 1.35 + 100];
      case 'seabell': return [x - w * 0.6 - 30, y - 30, w * 2.2 + 60, h * 1.3 + 60];
      case 'arch': return [x - 30, y - h * 0.3 - 30, w + 60, h * 1.3 + 60];
      case 'kelp': return [x - 40, y - 30, w + 80, h + 50];
      case 'airpocket': return [x - 30, y - 40, w + 60, h + 70];
      case 'buoy': return [x - 30, y - 30, w + 60, h + 60];
    }
    return null;
  });

  // профиль колокола: узкая «голова» сверху, тело расширяется книзу, внизу — отогнутая губа (устье шириной w)
  var BELL = [[0, 0.5], [0.05, 0.47], [0.12, 0.41], [0.26, 0.37], [0.46, 0.34], [0.66, 0.31], [0.8, 0.27], [0.9, 0.2]];
  function bellPts(cx, y, w, h) {
    var p = [], i;
    for (i = 0; i < BELL.length; i++) p.push([cx - w * BELL[i][1], y + h * (1 - BELL[i][0])]);
    for (i = 1; i < 6; i++) { var a = Math.PI + i / 6 * Math.PI; p.push([cx + Math.cos(a) * w * 0.2, y + h * 0.1 + Math.sin(a) * h * 0.1]); }
    for (i = BELL.length - 1; i >= 0; i--) p.push([cx + w * BELL[i][1], y + h * (1 - BELL[i][0])]);
    return p;
  }
  // пузыри (живые): столбик вверх от (x, y), высота h
  function bubbles(ctx, x, y, h, t, n, seed) {
    n = n || 6; ctx.save();
    for (var i = 0; i < n; i++) {
      var f = ((t * (0.28 + (i % 3) * 0.05) + i / n + (seed || 0) * 0.37) % 1 + 1) % 1, bx = x + Math.sin(f * 7 + i * 2.3 + (seed || 0)) * (6 + f * 8), by = y - f * h, r = 2 + (i % 3) * 1.4 + f * 1.5, a = Math.min(1, (1 - f) * 2.2);
      ctx.globalAlpha = 0.75 * a; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fillStyle = 'rgba(232,244,242,0.55)'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.35, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    }
    ctx.restore();
  }

  // ================= kind =================
  // колокол-водолаз: медный купол, два иллюминатора, обод с заклёпками; трос уходит вверх; под водой внутри — свет и воздух
  K.divebell = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, top = st.under ? -10 : Math.max(-10, y - (st.rope || 420));
    cut(g, band([[cx, top], [cx, y + (st.down && !st.under ? h * 0.72 : 8)]], 4), '#d9c18e', { seed: 7000, lift: 1.5, raw: true });   // state.rope — длина троса над колоколом (до блока стрелы)
    if (st.knot) { cut(g, lump(cx + 3, y - 30, 10, 7001, 4, 0.35), '#d9c18e', { seed: 7002, lift: 2 }); cut(g, band([[cx - 8, y - 38], [cx + 12, y - 22], [cx - 6, y - 16]], 3.5), '#c9ae74', { seed: 7003, lift: 1, raw: true }); }
    if (st.down && !st.under) return;
    cut(g, ell(cx, y + 6, 9, 7, 14), C.iron, { seed: 7004, lift: 2 });
    var dome = ell(cx, y + h * 0.46, w * 0.5, h * 0.44, 22, Math.PI, TAU).concat([[x + w, y + h - 6], [x, y + h - 6]]);
    cut(g, dome, '#c08a4a', { seed: 7005, lift: 5, sh: 0.4 });
    cut(g, ell(cx - w * 0.16, y + h * 0.22, w * 0.2, h * 0.1, 14), light('#c08a4a', 0.3), { seed: 7006, lift: 0, raw: true });
    cut(g, rectP(x + 2, y + h * 0.62, w - 4, 5), dark('#c08a4a', 0.25), { seed: 7007, lift: 0.6, raw: true });
    [0.3, 0.7].forEach(function (f, i) {
      cut(g, ell(x + w * f, y + h * 0.42, w * 0.13, w * 0.13, 18), C.brass, { seed: 7010 + i, lift: 2 });
      cut(g, ell(x + w * f, y + h * 0.42, w * 0.09, w * 0.09, 16), st.under ? '#fbe6a6' : '#bfd9dc', { seed: 7012 + i, lift: 0, raw: true });
    });
    cut(g, rrP(x - 7, y + h - 10, w + 14, 12, 5), C.brass, { seed: 7015, lift: 3 });
    for (var k = 0; k < 6; k++) brad(g, x + 2 + k * (w - 4) / 5, y + h - 4, 1.8);
    if (st.ballast) { cut(g, band([[cx, y + h], [cx, y + h + 14]], 3), C.iron, { seed: 7016, lift: 1, raw: true }); drawIconRaw(g, 'weight', cx, y + h + 28, 26); }
  };
  LIVE.divebell = function (ctx, it, t) {
    var st = it.state || {}; if (!st.under) return; var cx = it.x + it.w / 2;
    addGlow(ctx, cx, it.y + it.h * 0.55, it.w * 1.1, '255,226,150', 0.22 + 0.04 * Math.sin(t * 2.1));
    bubbles(ctx, cx, it.y + it.h * 0.2, 150, t, 6, 1); bubbles(ctx, cx + it.w * 0.3, it.y + it.h, 60, t, 3, 2);
  };
  // колокол: бронза, полоса цвета ноты и точки ноты; sunk — лежит в иле; empty — пустой крюк с точками; great — большой, с венцом
  K.seabell = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, n = Math.max(0, Math.min(4, st.note == null ? 2 : st.note | 0)), col = NOTE[n], bz = st.great ? '#a8843c' : '#b98a3e', d;
    if (st.empty) {
      cut(g, band([[cx, y], [cx, y + 12]], 3.5), C.iron, { seed: 7100, lift: 1, raw: true });
      cut(g, band(ell(cx, y + 19, 6, 7, 10, -0.6, Math.PI * 1.05), 3.2), C.iron, { seed: 7101, lift: 1.5, raw: true });
      cut(g, rrP(cx - (n + 1) * 5.5 - 5, y + 32, (n + 1) * 11 + 10, 15, 7), IVORY, { seed: 7102, lift: 1.5 });
      for (d = 0; d <= n; d++) cut(g, ell(cx - n * 5.5 + d * 11, y + 39.5, 3, 3, 10), col, { seed: 7103 + d, lift: 0, raw: true });
      return;
    }
    function body(bx, by, bw, bh, rot) {
      var T = function (p) { return rot ? rotP(p, bx, by + bh, rot) : p; };
      cut(g, T(bellPts(bx, by, bw, bh)), bz, { seed: 7110 + n, lift: st.great ? 5 : 3.5, sh: 0.38 });
      cut(g, T(rectP(bx - bw * 0.335, by + bh * 0.42, bw * 0.67, bh * 0.13)), col, { seed: 7120 + n, lift: 0.8, raw: true });
      cut(g, T(rectP(bx - bw * 0.48, by + bh * 0.93, bw * 0.96, bh * 0.07)), dark(bz, 0.18), { seed: 7125, lift: 1, raw: true });
      cut(g, T(ell(bx - bw * 0.15, by + bh * 0.26, bw * 0.05, bh * 0.1, 10)), light(bz, 0.4), { seed: 7126, lift: 0, raw: true });
      for (var q = 0; q <= n; q++) cut(g, T(ell(bx - n * (bw * 0.065) + q * bw * 0.13, by + bh * 0.72, Math.max(2.2, bw * 0.042), Math.max(2.2, bw * 0.042), 10)), C.cream, { seed: 7130 + q, lift: 0.6, raw: true });
      if (st.great) cut(g, T(rectP(bx - bw * 0.2, by - 4, bw * 0.4, bh * 0.1)), C.iron, { seed: 7127, lift: 2, raw: true });
    }
    if (st.sunk) {   // лежит на боку, наполовину в иле
      body(cx, y - h * 0.1, w, h, 1.15);
      cut(g, lump(cx + w * 0.1, y + h * 1.02, w * 0.62, 7140, 5, 0.22).map(function (q) { return [q[0], y + h + (q[1] - y - h) * 0.42]; }), '#9a9774', { seed: 7141, lift: 2 });
      return;
    }
    cut(g, band([[cx, y - 2], [cx, y + h * 0.12]], 3.5), C.iron, { seed: 7142, lift: 1, raw: true });
    cut(g, ell(cx, y + h + 3, Math.max(3.5, w * 0.09), Math.max(3.5, w * 0.09), 12), C.iron, { seed: 7143, lift: 1.5 });
    body(cx, y, w, h, 0);
  };
  LIVE.seabell = function (ctx, it, t) {
    var st = it.state || {}; if (!(st.ring > 0.02)) return; var cx = it.x + it.w / 2;
    addGlow(ctx, cx, it.y + it.h * 0.55, it.w * 1.6, '255,236,180', 0.5 * st.ring);
    ctx.save(); ctx.strokeStyle = 'rgba(42,36,32,' + (0.7 * st.ring).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var k = -1; k <= 1; k += 2) { ctx.beginPath(); ctx.arc(cx + k * it.w * 0.5, it.y + it.h * 0.8, 10 + (1 - st.ring) * 16, k < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, k < 0 ? Math.PI * 1.25 : Math.PI * 0.25); ctx.stroke(); }
    ctx.restore();
  };
  // ламинария: длинные ленты; cut — срезана, остались пеньки
  function kelpRibbon(bx, by, hh, ph, amp) { var pts = []; for (var k = 0; k <= 10; k++) { var f = k / 10; pts.push([bx + Math.sin(f * 4.2 + ph) * amp * f, by - hh * f]); } return pts; }
  K.kelp = function (g, it) {
    var st = it.state || {}, n = Math.max(3, Math.round(it.w / 15)), R = rng(7200 + (it.seed || 0)), cols = ['#5e7d3a', '#4f6b2e', '#6f8f45', '#567a4c'];
    for (var i = 0; i < n; i++) {
      var bx = it.x + (i + 0.3 + R() * 0.4) * it.w / n, hh = it.h * (st.cut ? 0.14 + R() * 0.1 : 0.62 + R() * 0.38), col = cols[i % cols.length], rb = kelpRibbon(bx, it.y + it.h, hh, R() * 6, st.cut ? 2 : 13);
      var L = [], Rr = []; rb.forEach(function (q, k) { var wd = (st.cut ? 5 : 7.5) * (1 - k / 10 * 0.7); L.push([q[0] - wd, q[1]]); Rr.push([q[0] + wd, q[1]]); });
      cut(g, L.concat(Rr.reverse()), col, { seed: 7210 + i, lift: 2.5, sh: 0.3, amp: 0.5 });
      if (!st.cut) strokeL(g, rb, light(col, 0.3), 1.2);
    }
  };
  X.ANIM_BREAK.kelp = 1;
  LIVE.kelp = function (ctx, it, t) {   // пара живых лент поверх — течение
    var st = it.state || {}; if (st.cut || st.still) return; ctx.save(); ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) { var bx = it.x + (i + 0.5) * it.w / 3, pts = kelpRibbon(bx, it.y + it.h, it.h * (0.7 + i * 0.1), t * 0.9 + i * 2, 16);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.strokeStyle = i % 2 ? '#6f8f45' : '#5e7d3a'; ctx.lineWidth = 6 - i; ctx.stroke(); }
    ctx.restore();
  };
  // воздушный карман: перевёрнутая лодка | родник пузырей (плита сверху, пока закрыт) | воздух под сводом
  K.airpocket = function (g, it, sc, P0) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, v = st.variant || 'vent', stone = (P0 && P0.rock) || '#5f7f7c';
    if (v === 'boat') {
      cut(g, ell(cx, y + h, w * 0.5, h * 0.95, 22, Math.PI, TAU).concat([[x + w, y + h], [x, y + h]]), '#8a6448', { seed: 7300, lift: 4, sh: 0.38 });
      for (var b = 1; b < 4; b++) strokeL(g, ell(cx, y + h, w * 0.5 * (1 - b * 0.05), h * 0.95 * (1 - b * 0.24), 18, Math.PI, TAU), 'rgba(60,40,24,0.5)', 1.3);
      cut(g, rectP(cx - 2.5, y + h * 0.04, 5, h * 0.96), '#6b4630', { seed: 7301, lift: 1, raw: true });
      cut(g, rectP(x + w * 0.06, y + h - 30, 7, 30), '#6b4630', { seed: 7302, lift: 2 });   // подпёрта брусом — под ней можно стоять
    } else if (v === 'dome') {
      cut(g, band(ell(cx, y + h * 0.55, w * 0.5, h * 0.5, 16, Math.PI, TAU), 14), stone, { seed: 7310, lift: 4 });
      for (var k = 0; k < 5; k++) { var a = Math.PI + (k + 0.5) / 5 * Math.PI; strokeL(g, [[cx + Math.cos(a) * (w * 0.5 - 7), y + h * 0.55 + Math.sin(a) * (h * 0.5 - 7)], [cx + Math.cos(a) * (w * 0.5 + 7), y + h * 0.55 + Math.sin(a) * (h * 0.5 + 7)]], dark(stone, 0.3), 1.3); }
    } else {
      cut(g, ell(cx, y + h - 5, w * 0.5, 8, 18), dark(stone, 0.15), { seed: 7320, lift: 2 });
      cut(g, ell(cx, y + h - 6, w * 0.3, 4.5, 14), '#20363c', { seed: 7321, lift: 0, raw: true });
      if (!st.on) { cut(g, rotP(rrP(x + 2, y + h - 24, w - 4, 16, 4), cx, y + h - 16, -0.06), light(stone, 0.12), { seed: 7322, lift: 4, sh: 0.4 }); drawIconRaw(g, 'chain', cx, y + h - 28, 26); }
    }
    if (st.on && v !== 'vent') cut(g, ell(cx, y + h * 0.42, w * 0.34, Math.max(6, h * 0.12), 20), 'rgba(226,242,240,0.8)', { seed: 7330, lift: 0, raw: true, tex: false });
  };
  LIVE.airpocket = function (ctx, it, t) {
    var st = it.state || {}; if (!st.on) return; var cx = it.x + it.w / 2, v = st.variant || 'vent';
    if (v === 'vent') { bubbles(ctx, cx, it.y + it.h - 8, 230, t, 9, it.x); bubbles(ctx, cx + 8, it.y + it.h - 8, 150, t * 1.2, 5, it.x + 3); }
    else { bubbles(ctx, cx, it.y + it.h, it.h * 0.6, t, 4, it.x); addGlow(ctx, cx, it.y + it.h * 0.42, it.w * 0.4, '230,250,246', 0.12 + 0.04 * Math.sin(t * 2)); }
  };
  // буёк: красно-белый поплавок с мачтой; bell — колокольчик на мачте
  K.buoy = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, by = y + h;
    cut(g, band([[cx, by - h * 0.55], [cx, y + 2]], 4), C.iron, { seed: 7400, lift: 1.5, raw: true });
    cut(g, [[cx - w * 0.42, by - 4], [cx - w * 0.28, by - h * 0.58], [cx + w * 0.28, by - h * 0.58], [cx + w * 0.42, by - 4], [cx, by + 3]], '#d9583a', { seed: 7401, lift: 4, sh: 0.36 });
    cut(g, rectP(cx - w * 0.37, by - h * 0.34, w * 0.74, h * 0.13), '#f6efe0', { seed: 7402, lift: 0.6, raw: true });
    if (st.bell) { cut(g, bellPts(cx, y - 2, Math.min(24, w * 0.7), Math.min(22, h * 0.36)), '#e2b04a', { seed: 7403, lift: 2.5 }); cut(g, ell(cx, y + Math.min(22, h * 0.36) + 1, 2.4, 2.4, 8), C.iron, { seed: 7404, lift: 1, raw: true }); }
    if (st.set) { cut(g, band([[cx - w * 0.9, by], [cx - w * 0.3, by - 3], [cx + w * 0.3, by + 2], [cx + w * 0.9, by - 1]], 4), 'rgba(240,246,244,0.75)', { seed: 7405, lift: 0, raw: true, tex: false }); }
  };
  // арка-ворота затонувшего квартала: каменные устои, свод, балка-засов; chain — цепь; kelp — заросла
  K.arch = function (g, it, sc, P0) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, tw = Math.max(16, w * 0.17), stone = (P0 && P0.rock) || '#5f7f7c', sl = (P0 && P0.rockL) || light(stone, 0.2), cx = x + w / 2;
    cut(g, rectP(x, y + h * 0.2, tw, h * 0.8), stone, { seed: 7500, lift: 5, sh: 0.38 }); cut(g, rectP(x + w - tw, y + h * 0.2, tw, h * 0.8), stone, { seed: 7501, lift: 5, sh: 0.38 });
    for (var b = 1; b < 5; b++) { strokeL(g, [[x + 1, y + h * (0.2 + b * 0.16)], [x + tw - 1, y + h * (0.2 + b * 0.16)]], dark(stone, 0.3), 1.2); strokeL(g, [[x + w - tw + 1, y + h * (0.2 + b * 0.16) + 5], [x + w - 1, y + h * (0.2 + b * 0.16) + 5]], dark(stone, 0.3), 1.2); }
    var out = ell(cx, y + h * 0.26, w * 0.5, h * 0.36, 16, Math.PI, TAU), inn = ell(cx, y + h * 0.3, w * 0.5 - tw, h * 0.22, 14, Math.PI, TAU).reverse();
    cut(g, out.concat(inn), sl, { seed: 7502, lift: 4, sh: 0.34 });
    for (var k = 1; k < 7; k++) { var a = Math.PI + k / 7 * Math.PI; strokeL(g, [[cx + Math.cos(a) * (w * 0.5 - tw), y + h * 0.3 + Math.sin(a) * h * 0.22], [cx + Math.cos(a) * w * 0.5, y + h * 0.26 + Math.sin(a) * h * 0.36]], dark(stone, 0.3), 1.2); }
    if (!st.open) cut(g, rrP(x + tw - 6, y + h * 0.56, w - 2 * tw + 12, 15, 3), '#6b4e38', { seed: 7503, lift: 3 });
    if (st.chain) drawIconRaw(g, 'chain', cx, y + h * 0.42, 28);
    if (st.kelp) for (var q = 0; q < 4; q++) cut(g, band(kelpRibbon(x + tw * 0.5 + q * (w - tw) / 3, y + h * 0.08 + (q % 2) * 10, -h * 0.34, q * 2, 8), 5), q % 2 ? '#5e7d3a' : '#6f8f45', { seed: 7510 + q, lift: 1.5, raw: true });
  };
  // стрела причала с барабаном лебёдки
  K.crane = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, px = x + w * 0.12, tipX = x + w, tipY = y + 10;
    cut(g, rectP(px - 8, y + h * 0.08, 16, h * 0.92), '#6b4630', { seed: 7600, lift: 4 });
    cut(g, band([[px, y + h * 0.5], [x + w * 0.56, y + h * 0.2]], 8), '#8a6448', { seed: 7601, lift: 2.5 });
    cut(g, band([[px, y + h * 0.14], [tipX, tipY]], 12), '#a87e52', { seed: 7602, lift: 4, sh: 0.36 });
    cut(g, ell(tipX - 4, tipY + 6, 8, 8, 14), C.iron, { seed: 7603, lift: 2 }); brad(g, tipX - 4, tipY + 6, 2.4);
    cut(g, ell(px, y + h * 0.78, 24, 24, 22), '#94693f', { seed: 7604, lift: 3.5 });
    for (var k = 0; k < 4; k++) cut(g, band(ell(px, y + h * 0.78, 9 + k * 4, 9 + k * 4, 16, 0.3 * k, TAU * 0.92 + 0.3 * k), 2.4), '#d9c18e', { seed: 7605 + k, lift: 0.5, raw: true });
    var ha = st.held ? -0.9 : 0.35; cut(g, band([[px, y + h * 0.78], [px + Math.cos(ha) * 36, y + h * 0.78 + Math.sin(ha) * 36]], 5), C.iron, { seed: 7610, lift: 2, raw: true });
    cut(g, ell(px + Math.cos(ha) * 36, y + h * 0.78 + Math.sin(ha) * 36, 5, 5, 10), '#d9c18e', { seed: 7611, lift: 2 }); brad(g, px, y + h * 0.78, 3);
    cut(g, band([[px + 14, y + h * 0.64], [px + 6, y + h * 0.16], [tipX - 6, tipY - 4]], 2.6), '#d9c18e', { seed: 7612, lift: 0.6, raw: true });   // трос вдоль стрелы
    if (st.knot) { cut(g, lump(tipX - 2, tipY + 22, 12, 7613, 4, 0.4), '#d9c18e', { seed: 7614, lift: 2.5 }); cut(g, band([[tipX - 12, tipY + 14], [tipX + 10, tipY + 28], [tipX - 8, tipY + 34]], 3.4), '#c9ae74', { seed: 7615, lift: 1, raw: true }); }
  };
  // затонувшие стены: variant wall (кусок стены с окном) | house (фасад с щипцом и дверным проёмом) | column (обломок колонны)
  K.ruin = function (g, it, sc, P0) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, v = st.variant || 'wall', R = rng(7700 + (it.seed || 0)), far = !!st.far;
    var stone = far ? ((P0 && P0.hillNear) || '#27525e') : ((P0 && P0.rock) || '#5f7f7c'), sl = far ? light(stone, 0.08) : ((P0 && P0.rockL) || light(stone, 0.2)), hole = far ? dark(stone, 0.2) : dark(stone, 0.5), top = [], xx;
    if (v === 'column') {
      cut(g, rectP(x + w * 0.2, y + 8, w * 0.6, h - 8), sl, { seed: 7701 + (it.seed || 0), lift: far ? 2 : 4 }); cut(g, [[x, y + 10], [x + w * 0.3, y], [x + w * 0.74, y + 6], [x + w, y + 14], [x + w * 0.8, y + 18], [x + w * 0.2, y + 18]], stone, { seed: 7702, lift: 2 });
      cut(g, rectP(x + w * 0.08, y + h - 12, w * 0.84, 12), stone, { seed: 7703, lift: 2 });
      for (var f = 1; f < 4; f++) strokeL(g, [[x + w * (0.2 + f * 0.15), y + 20], [x + w * (0.2 + f * 0.15), y + h - 14]], dark(stone, 0.25), 1.1);
      return;
    }
    if (v === 'house') top = [[x, y + h * 0.3], [x + w * 0.5, y], [x + w * 0.72, y + h * 0.12], [x + w * 0.8, y + h * 0.26], [x + w, y + h * 0.3]];
    else for (xx = 0; xx <= 6; xx++) top.push([x + w * xx / 6, y + R() * h * 0.22 + (xx % 2 ? h * 0.06 : 0)]);
    cut(g, top.concat([[x + w, y + h], [x, y + h]]), stone, { seed: 7710 + (it.seed || 0), lift: far ? 2 : 5, sh: far ? 0.2 : 0.36 });
    if (!far) for (var r = 0; r < Math.floor(h / 26); r++) { var ry = y + h - 20 - r * 26, off = (r % 2) * 18; for (var bx = x + 6 + off; bx < x + w - 28; bx += 44 + R() * 10) if (R() > 0.45 && ry > y + h * 0.34) cut(g, rrP(bx, ry, 26 + R() * 10, 10, 2), sl, { seed: 7720 + r * 9 + Math.round(bx), lift: 0.6, raw: true }); }
    if (st.window !== false) { var wn = v === 'house' ? 2 : 1; for (var q = 0; q < wn; q++) { var wx = x + w * (v === 'house' ? 0.2 + q * 0.42 : 0.42), wy = y + h * (v === 'house' ? 0.42 : 0.36), ww = Math.min(34, w * 0.2), wh = Math.min(46, h * 0.24);
      cut(g, ell(wx + ww / 2, wy + ww / 2, ww / 2, ww / 2, 12, Math.PI, TAU).concat([[wx + ww, wy + wh], [wx, wy + wh]]), hole, { seed: 7740 + q, lift: 0, raw: true }); } }
    if (st.door) { var dw = Math.min(60, w * 0.3), dx = x + w * 0.5 - dw / 2, dh = Math.min(110, h * 0.5); cut(g, ell(dx + dw / 2, y + h - dh + dw / 2, dw / 2, dw / 2, 14, Math.PI, TAU).concat([[dx + dw, y + h], [dx, y + h]]), hole, { seed: 7745, lift: 0, raw: true }); }
    if (st.kelp && !far) for (var e = 0; e < 3; e++) cut(g, band(kelpRibbon(x + w * (0.15 + e * 0.34), y + (v === 'house' ? h * 0.3 : h * 0.14) + 4, -h * 0.22, e * 2.1, 7), 5), e % 2 ? '#5e7d3a' : '#6f8f45', { seed: 7750 + e, lift: 1.5, raw: true });
  };
  // Туманный Кит: далёкая тень в глубине или близко — глаз, складки на горле, плавник (в нём — железный крюк с обрывком цепи)
  function whalePts(x, y, w, h) {
    return [[x, y + h * 0.6], [x + w * 0.03, y + h * 0.36], [x + w * 0.12, y + h * 0.16], [x + w * 0.28, y + h * 0.06], [x + w * 0.5, y + h * 0.04], [x + w * 0.72, y + h * 0.12], [x + w * 0.88, y + h * 0.3],
      [x + w * 0.97, y + h * 0.2], [x + w * 1.04, y + h * 0.02], [x + w * 1.02, y + h * 0.36], [x + w * 1.06, y + h * 0.66], [x + w * 0.97, y + h * 0.52], [x + w * 0.86, y + h * 0.62],
      [x + w * 0.66, y + h * 0.86], [x + w * 0.42, y + h * 0.98], [x + w * 0.2, y + h], [x + w * 0.06, y + h * 0.86]];
  }
  K.whale = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, body = '#5d6e80', belly = '#aebcc2';
    if (!st.near) { cut(g, whalePts(x + w * 0.1, y + h * 0.08, w * 0.84, h * 0.8), 'rgba(20,40,58,0.55)', { seed: 7800, lift: 0, amp: 1.6, tex: false, edge: false }); return; }
    cut(g, whalePts(x, y, w, h), body, { seed: 7801, lift: 7, sh: 0.34, amp: 1.4, torn: true, rim: light(body, 0.35), tornAmp: 1.6 });
    cut(g, [[x + w * 0.02, y + h * 0.66], [x + w * 0.2, y + h * 0.74], [x + w * 0.46, y + h * 0.8], [x + w * 0.64, y + h * 0.82], [x + w * 0.42, y + h * 0.96], [x + w * 0.2, y + h * 0.98], [x + w * 0.07, y + h * 0.85]], belly, { seed: 7802, lift: 1, amp: 1 });
    for (var i = 0; i < 6; i++) strokeL(g, [[x + w * (0.07 + i * 0.012), y + h * (0.72 + i * 0.04)], [x + w * (0.3 - i * 0.012), y + h * (0.8 + i * 0.03)], [x + w * (0.5 - i * 0.03), y + h * (0.84 + i * 0.022)]], 'rgba(60,80,96,0.55)', 1.4);
    for (var b = 0; b < 9; b++) { var R = rng(7810 + b); cut(g, ell(x + w * (0.2 + R() * 0.5), y + h * (0.14 + R() * 0.3), 3 + R() * 5, 2 + R() * 3, 10), light(body, 0.16 + R() * 0.1), { seed: 7820 + b, lift: 0, raw: true }); }   // пятна-ракушки
    cut(g, [[x + w * 0.44, y + h * 0.8], [x + w * 0.47, y + h * 0.98], [x + w * 0.53, y + h * 1.15], [x + w * 0.6, y + h * 1.24], [x + w * 0.65, y + h * 1.2], [x + w * 0.66, y + h * 1.04], [x + w * 0.63, y + h * 0.9], [x + w * 0.58, y + h * 0.8]], dark(body, 0.14), { seed: 7803, lift: 5, sh: 0.36, amp: 0.8 });   // плавник
    var ex = x + w * 0.17, ey = y + h * 0.52;
    cut(g, ell(ex, ey, 17, 13, 18), dark(body, 0.2), { seed: 7804, lift: 0, raw: true });
    if (st.eye) { cut(g, ell(ex, ey, 12, 9.5, 16), '#efe7d2', { seed: 7805, lift: 0.6, raw: true }); cut(g, ell(ex + 1.5, ey + 0.5, 5.6, 6.2, 12), '#2a2420', { seed: 7806, lift: 0, raw: true }); cut(g, ell(ex - 0.8, ey - 2, 1.8, 1.8, 8), '#ffffff', { seed: 7807, lift: 0, raw: true }); }
    else strokeL(g, [[ex - 12, ey + 1], [ex, ey + 4], [ex + 12, ey + 1]], '#2a2420', 2.6);
    strokeL(g, [[x + w * 0.015, y + h * 0.63], [x + w * 0.1, y + h * 0.68], [x + w * 0.24, y + h * 0.66]], 'rgba(40,52,64,0.7)', 2);   // рот
    if (st.hook) { cut(g, ell(x + w * 0.565, y + h * 1.0, 15, 11, 14), 'rgba(192,68,46,0.55)', { seed: 7809, lift: 0, raw: true, tex: false });   // воспалённое место — «больно»
      drawIconRaw(g, 'hook', x + w * 0.57, y + h * 1.07, 40); cut(g, band([[x + w * 0.585, y + h * 1.16], [x + w * 0.61, y + h * 1.3], [x + w * 0.59, y + h * 1.4]], 5), C.ironL, { seed: 7808, lift: 1.5, raw: true }); }   // воспалённое место — «больно»
  };
  LIVE.whale = function (ctx, it, t) {
    var st = it.state || {}, x = it.x, y = it.y, w = it.w, h = it.h;
    if (st.near) addGlow(ctx, x + w * 0.2, y + h * 0.5, 90, '200,230,240', 0.1 + 0.04 * Math.sin(t * 1.3));
    if (st.sing) { bubbles(ctx, x + w * 0.3, y + h * 0.06, 200, t, 9, 5); bubbles(ctx, x + w * 0.34, y + h * 0.06, 140, t * 1.3, 6, 8); }
    else if (!st.near) bubbles(ctx, x + w * 0.36, y + h * 0.2, 90, t * 0.6, 3, 4);
  };

  // ================= хук drawWater =================
  function wob(seed, i) { var v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453; return v - Math.floor(v); }
  // кольцо тушью: неровный круг (нажим пера меняется), harsh — ломаное «колючее» кольцо (лязг железа)
  function inkRing(ctx, x, y, r, a, lw, seed, harsh) {
    if (r < 5 || a <= 0.01) return; var n = harsh ? 18 : 30, k, an, rr;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = harsh ? 'miter' : 'round';
    for (var pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      var a0 = wob(seed, 1) * TAU, gap = pass ? 0.9 : 0.35;   // кольцо не замкнуто — мазок кисти
      for (k = 0; k <= n; k++) { an = a0 + (TAU - gap) * k / n; rr = r + (harsh ? (k % 2 ? r * 0.16 + 5 : -r * 0.1 - 3) : (wob(seed + pass * 7, k) - 0.5) * Math.min(7, r * 0.09)) + pass * 2.5; if (k) ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.92); else ctx.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.92); }
      ctx.strokeStyle = harsh ? 'rgba(150,40,26,' + (a * (pass ? 0.4 : 0.95)).toFixed(3) + ')' : 'rgba(34,28,24,' + (a * (pass ? 0.35 : 0.92)).toFixed(3) + ')'; ctx.lineWidth = pass ? lw * 0.45 : lw; ctx.stroke();
    }
    ctx.restore();
  }
  function noteCard(ctx, x, y, n, a, big) {
    n = Math.max(0, Math.min(4, n | 0)); var w = (n + 1) * 11 + 12, hh = 18;
    ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.translate(x, y); ctx.rotate(-0.04);
    ctx.fillStyle = 'rgba(40,22,10,0.25)'; ctx.fillRect(-w / 2 + 1.5, -hh / 2 + 2, w, hh);
    ctx.fillStyle = IVORY; ctx.fillRect(-w / 2, -hh / 2, w, hh); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.strokeRect(-w / 2, -hh / 2, w, hh);
    for (var d = 0; d <= n; d++) { ctx.beginPath(); ctx.arc(-n * 5.5 + d * 11, 0, big ? 4 : 3.3, 0, TAU); ctx.fillStyle = NOTE[n]; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.restore();
  }
  var LAIR = { x: 399, y: 26, gap: 18, r: 7, n: 10 };
  function drawWater(ctx, wv, t) {
    if (!wv) return; var L = (KV.ThemeAPI && KV.ThemeAPI.LAYOUT && KV.ThemeAPI.LAYOUT.air) || LAIR, H0 = wv.hero || null, hx = H0 ? H0.x : 480, hy = H0 ? H0.y - 74 : 300, i, k;
    var boil = Math.floor((wv.time == null ? t : wv.time) * 2.5);   // «кипение» штриха 2,5 раза в секунду, как у эскизов тушью
    ctx.save();
    // свет сверху и взвесь (в прозрачной воде)
    if (!wv.murk && H0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < 4; i++) { var rx = 120 + i * 230 + Math.sin(t * 0.21 + i * 1.7) * 26, gr = ctx.createLinearGradient(rx, 0, rx + 90, 430); gr.addColorStop(0, 'rgba(200,245,235,0.11)'); gr.addColorStop(1, 'rgba(200,245,235,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(rx - 26, 0); ctx.lineTo(rx + 34, 0); ctx.lineTo(rx + 170, 440); ctx.lineTo(rx + 40, 440); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    for (i = 0; i < 16; i++) { var px = (wob(3, i) * 960 + t * (4 + wob(4, i) * 8)) % 960, py = (wob(5, i) * 470 - t * (3 + wob(6, i) * 5) + 4700) % 470; ctx.fillStyle = 'rgba(236,246,240,' + (0.14 + wob(7, i) * 0.2).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(px, py, 1 + wob(8, i) * 1.4, 0, TAU); ctx.fill(); }
    // шлем-пузырь героини: в нём запас воздуха
    if (H0 && !(wv.fade > 0.6)) { var hr = 24, hcy = H0.y - 108, low = wv.air && wv.air.low;
      ctx.beginPath(); ctx.arc(hx, hcy, hr, 0, TAU); ctx.fillStyle = low ? 'rgba(250,214,150,0.16)' : 'rgba(226,246,242,0.16)'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hcy, hr - 4, Math.PI * 1.08, Math.PI * 1.42); ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineCap = 'round'; ctx.stroke();
      if (wv.air && !wv.air.pocket) bubbles(ctx, hx + 14, hcy - hr, 46, t, 2, 9); }
    // муть: бледное облако ила тушью; вокруг героини — круг видимости
    if (wv.murk) {
      var r = wv.vis || 150, g = ctx.createRadialGradient(hx, hy, r * 0.5, hx, hy, r * 1.3);
      g.addColorStop(0, 'rgba(196,201,182,0)'); g.addColorStop(0.55, 'rgba(196,201,182,0.72)'); g.addColorStop(1, 'rgba(196,201,182,0.965)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 478);
      ctx.save(); ctx.lineCap = 'round';   // разводы туши по мути
      for (i = 0; i < 9; i++) { var wy = 40 + i * 48 + Math.sin(t * 0.3 + i) * 6, wx0 = (wob(11, i) * 500 + t * (6 + i)) % 1200 - 200; if (Math.abs(wy - hy) < r * 0.7 && wx0 < hx + r && wx0 + 260 > hx - r) continue;
        ctx.beginPath(); ctx.moveTo(wx0, wy); ctx.bezierCurveTo(wx0 + 70, wy - 12, wx0 + 150, wy + 12, wx0 + 260, wy - 2); ctx.strokeStyle = 'rgba(60,62,50,' + (0.1 + wob(12, i) * 0.1).toFixed(2) + ')'; ctx.lineWidth = 5 + wob(13, i) * 9; ctx.stroke(); }
      ctx.restore();
      (wv.pockets || []).forEach(function (p) {   // воздушный карман слышно и видно сквозь муть: столбик пузырей тушью
        if (Math.abs(p.x - hx) < r * 0.8) return;
        for (var b = 0; b < 5; b++) { var f = ((t * 0.32 + b / 5) % 1); ctx.beginPath(); ctx.arc(p.x + Math.sin(f * 8 + b) * 6, 448 - f * 120, 2.5 + (b % 3), 0, TAU); ctx.strokeStyle = 'rgba(34,28,24,' + (0.75 * (1 - f)).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.stroke(); }
      });
    }
    // кольца звона тушью + карточка ноты (визуальный дубль звука)
    (wv.sounds || []).forEach(function (q, si) {
      if (!q.active || q.age == null || q.age > 2.6) return;
      var a = Math.max(0, 1 - q.age / 2.6), near = q.near == null ? 0.5 : q.near, lw = 1.6 + 3.6 * near, sp = q.big ? 125 : 92;
      for (k = 0; k < 3; k++) inkRing(ctx, q.x, q.y, 14 + (q.age - k * 0.22) * sp, a * (1 - k * 0.26) * (0.55 + 0.45 * near), lw * (1 - k * 0.22), si * 13 + k * 5 + boil * 0.618 + (q.n || 0), q.harsh);
      if (!q.harsh) noteCard(ctx, q.x, Math.max(16, q.y - 40), q.note, a * 1.8, q.big);
    });
    // шкала воздуха: пузырьки (без цифр); мало воздуха — янтарные, пульсируют; в кармане — значок воздуха
    if (wv.air) {
      var A = wv.air, n = L.n || 10, full = Math.max(0, A.f) * n, pulse = A.low ? 0.6 + 0.4 * Math.sin(t * 9) : 1, w0 = (n - 1) * L.gap + 34;
      ctx.fillStyle = 'rgba(24,40,46,0.42)'; ctx.beginPath(); var bx0 = L.x - 17, by0 = L.y - 14, rr0 = 14; ctx.moveTo(bx0 + rr0, by0); ctx.arcTo(bx0 + w0, by0, bx0 + w0, by0 + 28, rr0); ctx.arcTo(bx0 + w0, by0 + 28, bx0, by0 + 28, rr0); ctx.arcTo(bx0, by0 + 28, bx0, by0, rr0); ctx.arcTo(bx0, by0, bx0 + w0, by0, rr0); ctx.closePath(); ctx.fill();
      for (i = 0; i < n; i++) {
        var kk = Math.max(0, Math.min(1, full - i)), bx = L.x + i * L.gap, by = L.y + (kk > 0.02 ? Math.sin(t * 2.2 + i * 0.9) * 1.2 : 0);
        ctx.beginPath(); ctx.arc(bx, L.y, L.r, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.1; ctx.stroke();
        if (kk > 0.02) { var br = L.r * (0.4 + 0.6 * kk) * (A.low ? 0.86 + 0.2 * pulse : 1); ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fillStyle = A.low ? '#f0b040' : 'rgba(232,246,243,0.95)'; ctx.fill(); ctx.strokeStyle = A.low ? '#fff0c4' : '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.beginPath(); ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill(); }
      }
      if (A.pocket) { for (k = 0; k < 3; k++) { var f2 = ((t * 0.9 + k / 3) % 1); ctx.beginPath(); ctx.arc(L.x + n * L.gap + 6 + k * 5, L.y + 8 - f2 * 16, 2.4, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,' + (1 - f2).toFixed(2) + ')'; ctx.lineWidth = 1.3; ctx.stroke(); } }
    }
    // мягкий возврат: лист темнеет тушью и светлеет у кармана
    if (wv.fade > 0) { ctx.fillStyle = 'rgba(30,28,30,' + Math.min(1, wv.fade).toFixed(3) + ')'; ctx.fillRect(0, 0, 960, 540); }
    ctx.restore();
  }
  th.drawWater = drawWater;
})(typeof window !== 'undefined' ? window : globalThis);
