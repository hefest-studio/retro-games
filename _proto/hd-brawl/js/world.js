/* МЕДНАЯ СЛОБОДА · фон: три слоя параллакса, рисуются ПРЯМО пикселями палитры (fillRect по целым координатам,
   только цвета HB.sprites.PAL), один раз в закадровые холсты. Пар — живые частицы из видимых источников:
   трубы дальних заводов, печные трубы мастерских, клапаны на трубопроводе, решётки в мостовой. */
(function (global) {
  'use strict';
  var HB = global.HB, PAL = HB.sprites.PAL;
  var VW = 480, VH = 270, LEN = 1440;               // ширина улицы в мире
  var HORIZON = 168, FLOOR_TOP = 178, FLOOR_D = 84;   // тротуар/мостовая; ступни: y = FLOOR_TOP + z, z ∈ [0, FLOOR_D]
  var PAR = { far: 0.22, mid: 0.55 };

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function P(ctx) { return function (i, x, y, w, h) { ctx.fillStyle = PAL[i]; ctx.fillRect(x | 0, y | 0, (w || 1) | 0, (h || 1) | 0); }; }
  function checker(px, i, x, y, w, h, ph) { for (var yy = 0; yy < h; yy++) for (var xx = (yy + (ph || 0)) & 1; xx < w; xx += 2) px(i, x + xx, y + yy); }

  var sources = [];   // {layer, x, y, rate, size, t}

  // ---------- Дальний слой: ночное небо с заревом горнов и силуэты заводов ----------
  function buildFar() {
    var w = Math.ceil(VW + (LEN - VW) * PAR.far) + 2, h = HORIZON + 2, c = canvas(w, h), ctx = c.getContext('2d'), px = P(ctx), r = rng(11);
    px(11, 0, 0, w, h);
    for (var i = 0; i < 70; i++) px(r() < 0.7 ? 12 : 13, r() * w, r() * 90);           // звёзды
    // зарево у горизонта: полосы с тонкой шахматной кромкой (не градиент)
    checker(px, 2, 0, 96, w, 3); px(2, 0, 99, w, 18); checker(px, 3, 0, 117, w, 3, 1); px(3, 0, 120, w, h - 120);
    checker(px, 4, 0, 146, w, 2); px(4, 0, 148, w, h - 148);
    // силуэты: корпуса цехов, трубы (источники пара) и мостовой кран
    var x = 0;
    while (x < w) {
      var bw = 40 + (r() * 70 | 0), bh = 30 + (r() * 46 | 0), top = HORIZON - bh;
      px(2, x, top, bw, bh + 2);
      if (r() < 0.6) for (var k = 0; k < bw - 8; k += 9) px(2, x + 4 + k, top - 5, 6, 5);             // пилообразная крыша
      for (var wy = top + 8; wy < HORIZON - 6; wy += 9) for (var wx = x + 5; wx < x + bw - 5; wx += 7) if (r() < 0.35) px(r() < 0.5 ? 5 : 4, wx, wy, 3, 2); // огни окон
      if (r() < 0.75) {                                                                                   // труба
        var cx = x + 6 + (r() * (bw - 16) | 0), ch = 30 + (r() * 40 | 0);
        px(2, cx, top - ch, 6, ch); px(1, cx + 4, top - ch, 2, ch); px(3, cx - 1, top - ch, 8, 2);
        sources.push({ layer: 'far', x: cx + 3, y: top - ch - 1, rate: 0.05 + r() * 0.04, size: 3, t: 0 });
      }
      x += bw + (r() * 16 | 0);
    }
    return c;
  }

  // ---------- Средний слой: мастерские (кирпич, медные крыши с патиной, окна горнов, трубопровод) ----------
  function brick(px, x, y, w, h, r) {
    px(4, x, y, w, h);
    for (var yy = y + 3; yy < y + h; yy += 4) { px(3, x, yy, w, 1); var off = ((yy - y) / 4 | 0) & 1 ? 3 : 7; for (var xx = x + off; xx < x + w; xx += 8) px(3, xx, yy - 3, 1, 3); }
    px(3, x, y, 2, h); px(5, x + w - 2, y, 1, h);                         // торцы: тень слева под навесом, свет справа
    for (var i = 0; i < w * h / 90; i++) px(r() < 0.5 ? 5 : 3, x + r() * w, y + r() * h, 2, 1); // отдельные кирпичи светлее/темнее
  }
  function buildMid() {
    var w = Math.ceil(VW + (LEN - VW) * PAR.mid) + 2, h = HORIZON + 1, c = canvas(w, h), ctx = c.getContext('2d'), px = P(ctx), r = rng(5);
    var x = 6;
    while (x < w) {
      var bw = 92 + (r() * 60 | 0), bh = 64 + (r() * 30 | 0), top = HORIZON - bh;
      brick(px, x, top, bw, bh, r);
      // крыша: медь, кромка-свет, свес-тень, потёки патины
      var rh = 10, patina = r() < 0.55;
      for (var i = 0; i < rh; i++) px(i === 0 ? 6 : 5, x - 4 + i, top - rh + i, bw + 8 - i * 2, 1);
      px(4, x - 4, top, bw + 8, 2); px(2, x, top + 2, bw, 2);
      if (patina) for (var p = 0; p < bw; p += 5 + (r() * 6 | 0)) { var ph = 2 + (r() * 5 | 0); px(15, x + p, top - rh + 2 + (r() * 3 | 0), 1, ph); px(16, x + p, top - rh + 2, 1, 1); }
      // печная труба (источник пара)
      var cx = x + 12 + (r() * (bw - 30) | 0), ch = 22 + (r() * 14 | 0);
      px(12, cx, top - rh - ch, 8, ch + rh); px(13, cx + 1, top - rh - ch, 2, ch + rh); px(11, cx + 6, top - rh - ch, 2, ch + rh);
      px(13, cx - 2, top - rh - ch - 2, 12, 2); px(14, cx - 2, top - rh - ch - 2, 5, 1);
      sources.push({ layer: 'mid', x: cx + 4, y: top - rh - ch - 3, rate: 0.12 + r() * 0.05, size: 5, t: r() * 10 });
      // окна горнов / ворота кузни
      var gate = r() < 0.5, gx = x + 10 + (r() * (bw - 46) | 0);
      if (gate) {
        var gw = 30, gh = 34, gy = HORIZON - gh;
        px(1, gx - 2, gy - 3, gw + 4, gh + 3); px(5, gx, gy, gw, gh); px(6, gx + 3, gy + 6, gw - 6, gh - 6); px(7, gx + 8, gy + 14, gw - 16, gh - 14);
        px(1, gx + 9, HORIZON - 9, 12, 4); px(1, gx + 13, HORIZON - 5, 4, 5); px(1, gx + 6, HORIZON - 10, 4, 2); // наковальня силуэтом
        px(4, gx - 2, gy - 3, gw + 4, 1);
      }
      for (var wx = x + 8; wx < x + bw - 18; wx += 26) {
        if (gate && wx > gx - 20 && wx < gx + 32) continue;
        var wy = top + 12, lit = r() < 0.7;
        px(3, wx - 1, wy - 1, 16, 19); px(lit ? 6 : 11, wx, wy, 14, 17);
        if (lit) { px(7, wx + 2, wy + 2, 5, 6); px(7, wx + 8, wy + 2, 4, 3); }
        px(4, wx + 6, wy, 2, 17); px(4, wx, wy + 8, 14, 2); px(5, wx - 1, wy + 17, 16, 2);
      }
      // трубопровод вдоль стены, клапан с паром
      if (r() < 0.8) {
        var py = HORIZON - 44 + (r() * 10 | 0);
        px(12, x, py, bw, 5); px(13, x, py, bw, 2); px(14, x, py, bw, 1); px(11, x, py + 4, bw, 1);
        for (var j = x + 14; j < x + bw - 4; j += 30) { px(5, j, py - 1, 3, 7); px(7, j, py - 1, 1, 7); }
        var vx = x + 20 + (r() * (bw - 40) | 0);
        px(12, vx, py - 6, 4, 6); px(5, vx - 2, py - 8, 8, 2); px(7, vx - 2, py - 8, 3, 1);
        sources.push({ layer: 'mid', x: vx + 2, y: py - 9, rate: 0.07, size: 3, t: r() * 10, jet: true });
      }
      x += bw + 10 + (r() * 22 | 0);
    }
    return c;
  }

  // ---------- Ближний слой: тротуар, мостовая, решётки с паром ----------
  function buildFloor() {
    var h = VH - HORIZON, c = canvas(LEN, h), ctx = c.getContext('2d'), px = P(ctx), r = rng(3);
    px(12, 0, 0, LEN, 8); px(13, 0, 0, LEN, 1); for (var x = 0; x < LEN; x += 24) px(11, x, 1, 1, 7);   // плиты тротуара
    px(1, 0, 8, LEN, 2); px(13, 0, 10, LEN, 1);                                                          // бордюр
    px(1, 0, 11, LEN, h - 11);
    for (var y = 12, row = 0; y < h; y += 6, row++) {                                                    // брусчатка
      for (var x2 = (row & 1) * 5; x2 < LEN; x2 += 10) {
        var tone = r() < 0.1 ? 3 : 2;   // камень — слива, редкие — вино; верхняя грань светлее на ступень
        px(tone, x2 + 1, y, 8, 4); px(tone + 1, x2 + 2, y, 5, 1); if (r() < 0.25) px(tone + 1, x2 + 1, y + 1, 1, 2);
      }
    }
    for (var i = 0; i < 14; i++) {                                                                       // лужи с отблеском горнов
      var lx = r() * (LEN - 40) | 0, ly = 22 + (r() * (h - 34) | 0), lw = 14 + (r() * 22 | 0);
      px(11, lx, ly, lw, 3); px(11, lx + 3, ly - 1, lw - 6, 5); px(5, lx + 4, ly, lw / 3, 1); px(7, lx + 5, ly, 2, 1);
    }
    for (var g = 140; g < LEN; g += 260 + (r() * 120 | 0)) {                                             // решётки — источники пара
      var gy = 30 + (r() * 40 | 0);
      px(1, g, gy, 18, 7); for (var k = 1; k < 18; k += 3) px(12, g + k, gy + 1, 1, 5); px(13, g, gy, 18, 1);
      sources.push({ layer: 'floor', x: g + 9, y: HORIZON + gy, rate: 0.1, size: 4, t: r() * 10 });
    }
    return c;
  }

  // ---------- Пар: пиксельные клубы двумя тонами (свет сверху-слева), без сглаживания ----------
  var PUFF = [];
  function buildPuffs() {
    for (var rad = 1; rad <= 7; rad++) {
      var d = rad * 2 + 1, c = canvas(d, d), ctx = c.getContext('2d'), px = P(ctx);
      for (var y = -rad; y <= rad; y++) for (var x = -rad; x <= rad; x++) {
        if (x * x + y * y > rad * rad + rad * 0.6) continue;
        var lit = x + y < -rad * 0.4;
        px(rad <= 2 ? 14 : lit ? 8 : (x + y > rad * 0.5 ? 13 : 14), x + rad, y + rad);
      }
      PUFF.push(c);
      var cf = canvas(d, d), cx2 = cf.getContext('2d'); cx2.drawImage(c, 0, 0); cx2.globalCompositeOperation = 'source-atop'; cx2.fillStyle = PAL[12]; cx2.fillRect(0, 0, d, d);
      PUFF['far' + rad] = cf;  // дальний пар — тёмнее (сланец), чтобы не спорил с героями
    }
  }

  var layers = null, puffs = [];
  function build() {
    if (layers) return layers;
    sources.length = 0; buildPuffs();
    layers = { far: buildFar(), mid: buildMid(), floor: buildFloor() };
    for (var i = 0; i < 600; i++) update();   // пар уже стоит при первом кадре
    return layers;
  }
  var seq = rng(99);
  function update() {
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i]; s.t += s.rate;
      if (s.t >= 1) { s.t -= 1; puffs.push({ s: s, x: s.x + (seq() * 3 - 1 | 0), y: s.y, r: s.jet ? 1 : 1 + (seq() * 2 | 0), age: 0,
        life: (s.layer === 'far' ? 220 : s.jet ? 50 : 160) + seq() * 60, vx: s.jet ? 0.5 + seq() * 0.3 : 0.08 + seq() * 0.1, vy: s.jet ? -0.25 : -(0.22 + seq() * 0.12) }); }
    }
    for (var j = puffs.length - 1; j >= 0; j--) {
      var p = puffs[j]; p.age++; p.x += p.vx; p.y += p.vy; p.vy *= 0.997;
      var grow = Math.min(p.s.size + 2, 1 + p.age / (p.s.layer === 'far' ? 40 : 26)); p.r = Math.max(p.r, grow | 0);
      if (p.age > p.life) puffs.splice(j, 1);
    }
  }
  function drawPuffs(ctx, layer, ox, oy) {
    for (var i = 0; i < puffs.length; i++) {
      var p = puffs[i]; if (p.s.layer !== layer) continue;
      var rr = Math.min(7, Math.max(1, p.r - (p.age > p.life * 0.75 ? 1 : 0) - (p.age > p.life * 0.9 ? 1 : 0)));
      var img = layer === 'far' ? PUFF['far' + rr] : PUFF[rr - 1];
      var x = Math.round(p.x - ox) - rr, y = Math.round(p.y - oy) - rr;
      if (x < -16 || x > VW + 16) continue;
      ctx.drawImage(img, x, y);
    }
  }
  function draw(ctx, cam) {
    var L = build(), fx = Math.round(cam * PAR.far), mx = Math.round(cam * PAR.mid), c = Math.round(cam);
    ctx.drawImage(L.far, -fx, 0); drawPuffs(ctx, 'far', fx, 0);
    ctx.drawImage(L.mid, -mx, 0); drawPuffs(ctx, 'mid', mx, 0);
    ctx.drawImage(L.floor, -c, HORIZON);
  }
  function drawFront(ctx, cam) { drawPuffs(ctx, 'floor', Math.round(cam), 0); }

  HB.world = { VW: VW, VH: VH, LEN: LEN, HORIZON: HORIZON, FLOOR_TOP: FLOOR_TOP, FLOOR_D: FLOOR_D, build: build, update: update, draw: draw, drawFront: drawFront, sources: sources };
})(window);
