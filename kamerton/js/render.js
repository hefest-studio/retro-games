/* КАМЕРТОН · render.js — отрисовка «кадра кино»: сумерки города часовщиков, тёплая сепия меди и бархата
   и холодный свет фонарей-смотрителей (лучи считаются по той же геометрии, что и в логике: тени от тверди,
   ящиков, носильщика и тяжеловеса). Кашетирование кадра (широкий экран), виньетка, зерно плёнки.
   Темы: modern — мягкие градиенты, свечение, зерно; retro — тот же кадр в половинном разрешении плоскими
   цветами 16-цветной палитры с крупным пикселем и строками развёртки. */
(function (global) {
  'use strict';
  var K = global.KAMER = global.KAMER || {};
  var W = 960, H = 540, BAR = 34;
  var PAL = {
    modern: { sky0: '#171a2e', sky1: '#3d3048', sky2: '#b67a52', far: '#30283c', farWin: '#e9a95a', mid: '#221a24', midWin: '#f2c070', fog: 'rgba(214,160,110,0.10)',
      ground: '#24191a', groundTop: '#6d4a2f', wall: '#3a2a26', wallLine: '#55392c', brass: '#c99a52', brassD: '#8a6232', copper: '#b0683c', velvet: '#7a2443', velvetD: '#4c1529',
      wood: '#4f3423', woodL: '#6e4a30', iron: '#5c5862', ironD: '#3a3740', porcelain: '#efe4d2', blush: '#d99a8a', ink: '#120c0c',
      light: '#d3ecff', lightA: 0.36, core: '#8fdcff', coat: '#2b5a61', coatD: '#1d3f45', hood: '#d9a23c', hoodD: '#a8761f', skin: '#f0d6b4', warm: '#ffc66e', bar: '#050404' },
    retro: { sky0: '#000044', sky1: '#442266', sky2: '#aa5522', far: '#331144', farWin: '#ffaa22', mid: '#110011', midWin: '#ffcc44', fog: 'rgba(0,0,0,0)',
      ground: '#221100', groundTop: '#884411', wall: '#442211', wallLine: '#663311', brass: '#ddaa44', brassD: '#886622', copper: '#bb6633', velvet: '#991144', velvetD: '#550022',
      wood: '#553311', woodL: '#775522', iron: '#666677', ironD: '#333344', porcelain: '#ffeedd', blush: '#ee9988', ink: '#000000',
      light: '#aaeeff', lightA: 0.30, core: '#55ffff', coat: '#226666', coatD: '#114444', hood: '#ffaa22', hoodD: '#aa6600', skin: '#ffcc99', warm: '#ffcc44', bar: '#000000' }
  };
  var RD = K.render = { PAL: PAL, cam: { x: 0, z: -1 }, W: W, H: H, BAR: BAR };
  var LOOKS = [ // особые черты зон фона
    { towers: 3, bunting: false, bells: false, gears: true },
    { towers: 5, bunting: false, bells: false, gears: false, wires: true },
    { towers: 2, bunting: true, bells: false, wheel: true },
    { towers: 2, bunting: false, bells: true },
    { towers: 3, bunting: false, bells: false, gears: true, chimneys: true },
    { towers: 1, big: true, bells: true }
  ];
  function rng(seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mkCanvas(w, h) { if (typeof document === 'undefined') return null; var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ---------- фон: дальний город с башнями-часами и ближний ряд домов (кэш на зону и тему) ----------
  var bgCache = {};
  function background(z, L, theme) {
    var key = z + ':' + theme; if (bgCache[key]) return bgCache[key];
    var p = PAL[theme], lk = LOOKS[L.look] || LOOKS[0], R = rng(z * 977 + 31);
    var fw = Math.ceil(L.w * 0.25 + W + 40), far = mkCanvas(fw, H), mw = Math.ceil(L.w * 0.55 + W + 40), mid = mkCanvas(mw, H);
    if (!far) return null;
    var c = far.getContext('2d'), x, i;
    // дальний ряд: крыши, башни с циферблатами
    c.fillStyle = p.far;
    for (x = 0; x < fw;) { var bw = 40 + R() * 70, bh = 120 + R() * 110; c.fillRect(x, 380 - bh, bw, bh + 160); if (R() < 0.5) { c.beginPath(); c.moveTo(x - 4, 380 - bh); c.lineTo(x + bw / 2, 380 - bh - 30 - R() * 30); c.lineTo(x + bw + 4, 380 - bh); c.fill(); }
      c.fillStyle = p.farWin; for (i = 0; i < 4; i++) if (R() < 0.35) c.fillRect(x + 6 + R() * (bw - 14), 380 - bh + 20 + R() * (bh - 30), 3, 5); c.fillStyle = p.far; x += bw + R() * 8; }
    var nt = lk.towers + (lk.big ? 0 : 1);
    for (i = 0; i < nt; i++) {
      var tx = (i + 0.5) / nt * fw + (R() - 0.5) * 120, tw = lk.big ? 120 : 46 + R() * 20, th = lk.big ? 330 : 220 + R() * 70;
      c.fillStyle = p.far; c.fillRect(tx - tw / 2, 380 - th, tw, th + 160);
      c.beginPath(); c.moveTo(tx - tw / 2 - 6, 380 - th); c.lineTo(tx, 380 - th - (lk.big ? 90 : 50)); c.lineTo(tx + tw / 2 + 6, 380 - th); c.fill();
      var cr = tw * 0.36, cy = 380 - th + cr + 14;
      c.fillStyle = p.farWin; c.globalAlpha = 0.75; c.beginPath(); c.arc(tx, cy, cr, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = p.far; c.lineWidth = Math.max(2, cr * 0.12); c.beginPath(); c.moveTo(tx, cy); c.lineTo(tx + Math.sin(R() * 6) * cr * 0.8, cy - Math.cos(R() * 6) * cr * 0.8); c.moveTo(tx, cy); c.lineTo(tx + cr * 0.5 * Math.sin(R() * 6), cy + cr * 0.5 * Math.cos(R() * 6)); c.stroke();
    }
    if (lk.wheel) { var wx = fw * 0.45, wy = 220, wr = 110; c.strokeStyle = p.far; c.lineWidth = 6; c.beginPath(); c.arc(wx, wy, wr, 0, Math.PI * 2); c.stroke(); for (i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); c.lineWidth = 2; c.stroke(); c.fillStyle = p.farWin; c.fillRect(wx + Math.cos(a) * wr - 4, wy + Math.sin(a) * wr, 8, 6); } c.lineWidth = 8; c.beginPath(); c.moveTo(wx - 60, 400); c.lineTo(wx, wy); c.lineTo(wx + 60, 400); c.stroke(); }
    // ближний ряд: дома с тёплыми окнами, вывески-шестерни, гирлянды
    var m = mid.getContext('2d');
    for (x = -20; x < mw;) {
      var hw = 90 + R() * 120, hh = 150 + R() * 120, top = 440 - hh;
      m.fillStyle = p.mid; m.fillRect(x, top, hw, hh + 100);
      m.beginPath(); m.moveTo(x - 8, top); m.lineTo(x + hw * (0.3 + R() * 0.4), top - 26 - R() * 40); m.lineTo(x + hw + 8, top); m.fill();
      if (R() < 0.5) m.fillRect(x + hw * 0.7, top - 50, 10, 40);   // труба
      for (var wy2 = top + 24; wy2 < 400; wy2 += 38) for (var wx2 = x + 14; wx2 < x + hw - 20; wx2 += 30) if (R() < 0.3) {
        m.fillStyle = p.midWin; m.globalAlpha = 0.25 + R() * 0.55; m.fillRect(wx2, wy2, 12, 18); m.globalAlpha = 1; m.fillStyle = p.mid; m.fillRect(wx2 + 5, wy2, 2, 18); m.fillRect(wx2, wy2 + 8, 12, 2);
      }
      if (lk.gears && R() < 0.4) { var gx = x + hw / 2, gy = top + 30; m.fillStyle = p.mid; gear(m, gx, gy - 46, 16, 8, p.mid); }
      x += hw + R() * 30;
    }
    if (lk.bunting || lk.wires) for (x = 0; x < mw; x += 260 + R() * 120) {
      m.strokeStyle = p.mid; m.lineWidth = 2; m.beginPath(); m.moveTo(x, 250); m.quadraticCurveTo(x + 130, 300, x + 260, 250); m.stroke();
      if (lk.bunting) for (i = 1; i < 10; i++) { var bx = x + i * 26, by = 250 + Math.sin(i / 10 * Math.PI) * 25; m.fillStyle = i % 2 ? p.velvetD : p.brassD; m.beginPath(); m.moveTo(bx - 7, by); m.lineTo(bx + 7, by); m.lineTo(bx, by + 14); m.fill(); }
    }
    if (lk.bells) for (x = 140; x < mw; x += 520) { m.fillStyle = p.mid; m.fillRect(x - 40, 120, 80, 330); m.fillStyle = p.brassD; m.globalAlpha = 0.5; m.beginPath(); m.moveTo(x - 22, 200); m.quadraticCurveTo(x - 20, 160, x, 158); m.quadraticCurveTo(x + 20, 160, x + 22, 200); m.closePath(); m.fill(); m.globalAlpha = 1; }
    if (lk.chimneys) for (x = 80; x < mw; x += 340) { m.fillStyle = p.mid; m.fillRect(x, 120, 26, 330); }
    bgCache[key] = { far: far, mid: mid };
    return bgCache[key];
  }
  function gear(c, x, y, r, n, col) { c.fillStyle = col; c.beginPath(); for (var i = 0; i < n * 2; i++) { var a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? r : r * 1.25; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }

  // ---------- примитивы ----------
  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

  function drawSolid(c, s, p, flat) {
    var x = s[0], y = s[1], w = s[2], h = s[3];
    if (y >= 438 && h > 60) {   // мостовая
      rect(c, x, y, w, h, p.ground); rect(c, x, y, w, 4, p.groundTop); rect(c, x, y + 4, w, 2, p.wallLine);
      c.fillStyle = p.wallLine; for (var bx = Math.ceil(x / 26) * 26; bx < x + w; bx += 26) { c.fillRect(bx, y + 8, 2, 10); c.fillRect(bx + 13, y + 22, 2, 10); }
      c.fillRect(x, y + 20, w, 1); c.fillRect(x, y + 34, w, 1); return;
    }
    if (h <= 16) {   // доски-настил на кронштейнах
      rect(c, x, y, w, h, p.wood); rect(c, x, y, w, 3, p.woodL); c.fillStyle = p.ink; for (var k = x + 18; k < x + w - 4; k += 36) c.fillRect(k, y + 3, 1, h - 3);
      c.fillStyle = p.brassD; c.fillRect(x + 4, y + h, 3, 8); c.fillRect(x + w - 7, y + h, 3, 8); return;
    }
    if (y < 0 || x < -20 && w <= 40) { rect(c, x, y, w, h, p.wall); return; }
    rect(c, x, y, w, h, p.wall);
    c.fillStyle = p.wallLine;
    for (var ry = y + 14; ry < y + h; ry += 14) { c.fillRect(x, ry, w, 1); for (var rx = x + ((ry / 14) % 2 ? 0 : 12); rx < x + w; rx += 24) c.fillRect(rx, ry, 1, 14); }
    rect(c, x - 2, y, w + 4, 4, p.brassD); rect(c, x - 2, y, w + 4, 1.5, p.brass);
  }

  // ---------- куклы и подмастерье ----------
  function drawBody(c, b, p, t, ctl, dead) {
    var x = b.x, y = b.y, w = b.w, h = b.h, cx = x + w / 2, f = b.face || 1, moving = Math.abs(b.vx) > 8 && b.gr, ph = moving ? Math.sin(t * (b.kind === 'giant' ? 6 : 14) + x * 0.05) : 0;
    var on = b.att, dim = on ? 1 : 0.62;
    c.save();
    if (!on) c.globalAlpha = 0.92;
    switch (b.kind) {
      case 'hero': {
        // ноги
        c.fillStyle = p.ink; c.fillRect(cx - 5 + ph * 3, y + h - 9, 4, 9); c.fillRect(cx + 1 - ph * 3, y + h - 9, 4, 9);
        // пальто
        c.fillStyle = p.coat; c.beginPath(); c.moveTo(cx - 7, y + 14); c.lineTo(cx + 7, y + 14); c.lineTo(cx + 9, y + h - 8); c.lineTo(cx - 9, y + h - 8); c.closePath(); c.fill();
        c.fillStyle = p.coatD; c.fillRect(cx - 1, y + 15, 2, h - 24); c.fillStyle = p.brass; c.fillRect(cx + 2, y + 19, 2, 2); c.fillRect(cx + 2, y + 25, 2, 2);
        // капюшон-шарф горчичный
        c.fillStyle = p.hood; c.beginPath(); c.arc(cx, y + 9, 8.5, Math.PI, 0); c.lineTo(cx + 8.5, y + 15); c.lineTo(cx - 8.5, y + 15); c.fill();
        c.fillStyle = p.hoodD; c.fillRect(cx - 8, y + 13, 16, 3); c.fillRect(cx - f * 9, y + 14, 3, 9);
        c.fillStyle = p.skin; c.beginPath(); c.arc(cx + f * 2, y + 9, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = p.ink; c.fillRect(cx + f * 4, y + 8, 1.6, 1.6);
        // камертон в руке: поднят и светится, когда звучит
        var up = ctl !== 'hero', hx = cx + f * 8, hy = up ? y + 6 : y + 22;
        c.strokeStyle = up ? p.core : p.brass; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx, hy + 8); c.lineTo(hx, hy + 3); c.moveTo(hx - 2.5, hy - 5); c.lineTo(hx - 2.5, hy + 3); c.lineTo(hx + 2.5, hy + 3); c.lineTo(hx + 2.5, hy - 5); c.stroke();
        if (up) { c.globalAlpha = 0.35 + 0.2 * Math.sin(t * 9); circ(c, hx, hy - 2, 7, p.core); c.globalAlpha = 1; }
        break;
      }
      case 'porter': {
        c.fillStyle = p.ironD; c.fillRect(cx - 8 + ph * 2, y + h - 10, 6, 10); c.fillRect(cx + 2 - ph * 2, y + h - 10, 6, 10);
        c.fillStyle = on ? p.brass : p.brassD; c.beginPath(); c.ellipse(cx, y + 26, 14, 14, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = p.brassD; c.fillRect(cx - 14, y + 20, 28, 2); c.fillRect(cx - 14, y + 31, 28, 2);
        c.fillStyle = p.porcelain; c.globalAlpha *= dim + 0.2; c.beginPath(); c.arc(cx + f * 1, y + 8, 7, 0, Math.PI * 2); c.fill(); c.globalAlpha = on ? 1 : 0.92;
        c.fillStyle = p.velvetD; c.fillRect(cx - 7, y, 14, 4); c.fillStyle = p.ink; c.fillRect(cx + f * 3, y + 7, 2, 1.5);
        key(c, cx - f * 15, y + 24, f, t, on, p); core(c, cx + f * 4, y + 26, on, t, p);
        break;
      }
      case 'dancer': {
        c.strokeStyle = p.porcelain; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx - 1, y + 14); c.lineTo(cx - 2 + ph * 2, y + h); c.moveTo(cx + 1, y + 14); c.lineTo(cx + 2 - ph * 2, y + h); c.stroke();
        c.fillStyle = on ? p.velvet : p.velvetD; c.beginPath(); c.moveTo(cx - 8, y + 15); c.lineTo(cx + 8, y + 15); c.lineTo(cx + 3, y + 9); c.lineTo(cx - 3, y + 9); c.fill();
        c.fillStyle = p.porcelain; c.fillRect(cx - 2, y + 5, 4, 5); c.beginPath(); c.arc(cx, y + 4, 3.4, 0, Math.PI * 2); c.fill();
        c.strokeStyle = p.porcelain; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx, y + 7); c.lineTo(cx - 5, y + 1 + (on ? Math.sin(t * 4) : 3)); c.moveTo(cx, y + 7); c.lineTo(cx + 5, y + 1 - (on ? Math.sin(t * 4) : -3)); c.stroke();
        c.fillStyle = p.brassD; c.fillRect(cx - 1, y - 1, 2, 2);
        key(c, cx - f * 6, y + 11, f, t, on, p, 0.6); core(c, cx, y + 11, on, t, p, 0.7);
        break;
      }
      case 'giant': {
        c.fillStyle = p.ironD; c.fillRect(cx - 14 + ph * 3, y + h - 18, 11, 18); c.fillRect(cx + 3 - ph * 3, y + h - 18, 11, 18);
        c.fillStyle = on ? p.iron : p.ironD; c.fillRect(cx - 18, y + 22, 36, 32); c.fillStyle = p.copper; c.fillRect(cx - 18, y + 22, 36, 3); c.fillRect(cx - 18, y + 51, 36, 3);
        c.fillStyle = p.ironD; c.fillRect(cx - 24, y + 24, 6, 26); c.fillRect(cx + 18, y + 24, 6, 26);
        // голова-колокол
        c.fillStyle = on ? p.brass : p.brassD; c.beginPath(); c.moveTo(cx - 13, y + 22); c.quadraticCurveTo(cx - 12, y + 2, cx, y); c.quadraticCurveTo(cx + 12, y + 2, cx + 13, y + 22); c.closePath(); c.fill();
        c.fillStyle = on ? p.core : p.ink; c.fillRect(cx + f * 2 - 6, y + 12, 4, 2); c.fillRect(cx + f * 2 + 2, y + 12, 4, 2);
        key(c, cx - f * 20, y + 36, f, t, on, p, 1.4); core(c, cx, y + 38, on, t, p, 1.3);
        break;
      }
      case 'soldier': {
        c.fillStyle = p.ink; c.fillRect(cx - 4, y + h - 10, 3, 10 - ph * 2); c.fillRect(cx + 1, y + h - 10, 3, 10 + ph * 2 - 2);
        c.fillStyle = on ? p.coat : p.coatD; c.fillRect(cx - 5, y + 11, 10, 13); c.fillStyle = p.porcelain; c.beginPath(); c.moveTo(cx - 5, y + 11); c.lineTo(cx + 5, y + 23); c.lineTo(cx + 5, y + 21); c.lineTo(cx - 3, y + 11); c.fill();
        c.fillStyle = p.brass; c.fillRect(cx - 1, y + 14, 2, 2); c.fillRect(cx - 1, y + 19, 2, 2);
        c.fillStyle = p.porcelain; c.beginPath(); c.arc(cx, y + 8, 3.8, 0, Math.PI * 2); c.fill();
        c.fillStyle = p.ironD; c.fillRect(cx - 4, y - 3, 8, 8); c.fillStyle = p.brass; c.fillRect(cx - 4, y + 3, 8, 1.5); c.fillRect(cx - 1, y - 2, 2, 2);
        c.strokeStyle = p.brassD; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx + f * 6, y + 26); c.lineTo(cx + f * 6, y + 4); c.stroke();
        key(c, cx - f * 7, y + 17, f, t, on, p, 0.6); core(c, cx - f * 1, y + 17, on, t, p, 0.6);
        break;
      }
    }
    c.restore();
  }
  function key(c, x, y, f, t, on, p, s) {   // заводной ключ в спине: крутится, пока кукла настроена
    s = s || 1; var a = on ? t * 4 : 0.6; c.save(); c.translate(x, y); c.strokeStyle = p.brass; c.lineWidth = 1.4 * s;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-f * 4 * s, 0); c.stroke();
    c.translate(-f * 5 * s, 0); c.scale(Math.cos(a), 1); c.beginPath(); c.ellipse(0, -3 * s, 2.6 * s, 2.6 * s, 0, 0, Math.PI * 2); c.ellipse(0, 3 * s, 2.6 * s, 2.6 * s, 0, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  function core(c, x, y, on, t, p, s) {   // сердечник куклы
    s = s || 1; if (!on) { circ(c, x, y, 2.2 * s, p.ironD); return; }
    c.save(); c.globalAlpha = 0.45 + 0.25 * Math.sin(t * 6); circ(c, x, y, 6 * s, p.core); c.globalAlpha = 1; circ(c, x, y, 2.4 * s, '#ffffff'); c.restore();
  }

  // ---------- свет фонарей: лучи по геометрии логики ----------
  function lightPoly(game, ls, occ) {
    var pts = [[ls.x, ls.y]], n = 40, near = occ.filter(function (r) { return r.x < ls.x + ls.range && r.x + r.w > ls.x - ls.range && r.y < ls.y + ls.range && r.y + r.h > ls.y - ls.range; });
    for (var i = 0; i <= n; i++) {
      var a = ls.a - ls.half + (2 * ls.half) * i / n, ex = ls.x + Math.sin(a) * ls.range, ey = ls.y + Math.cos(a) * ls.range, tm = 1;
      for (var k = 0; k < near.length; k++) { var tt = game.segT(ls.x, ls.y, ex, ey, near[k]); if (tt < tm) tm = tt; }
      pts.push([ls.x + (ex - ls.x) * tm, ls.y + (ey - ls.y) * tm]);
    }
    return pts;
  }
  function drawLamps(c, S, game, p, flat, t) {
    var L = S.L, occ = game.occluders();
    for (var i = 0; i < (L.lamps || []).length; i++) {
      var ls = game.lampState(i), l = L.lamps[i];
      // корпус: фонарь смотрителя (у патрульного — сам смотритель)
      if (l.patrol) drawWatchman(c, ls, p, t, S.d.lampT[i]);
      else { c.fillStyle = p.ironD; c.fillRect(ls.x - 5, ls.y - 9, 10, 12); c.fillStyle = p.brassD; c.fillRect(ls.x - 6, ls.y - 11, 12, 3); }
      if (ls.off) { circ(c, ls.x, ls.y, 3, p.ironD); continue; }
      var pts = lightPoly(game, ls, occ);
      c.save(); c.globalCompositeOperation = flat ? 'source-over' : 'screen';
      c.beginPath(); pts.forEach(function (q, k) { if (k) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath();
      if (flat) { c.globalAlpha = p.lightA; c.fillStyle = p.light; }
      else { var gr = c.createRadialGradient(ls.x, ls.y, 4, ls.x, ls.y, ls.range); gr.addColorStop(0, 'rgba(211,236,255,0.55)'); gr.addColorStop(0.6, 'rgba(160,205,255,0.22)'); gr.addColorStop(1, 'rgba(140,190,255,0)'); c.fillStyle = gr; }
      c.fill(); c.restore();
      c.save(); c.globalAlpha = 0.9; circ(c, ls.x, ls.y, 3.5, '#ffffff'); if (!flat) { c.globalAlpha = 0.3; circ(c, ls.x, ls.y, 12, p.light); } c.restore();
    }
  }
  function drawWatchman(c, ls, p, t, lt) {   // смотритель — высокая заводная фигура в плаще с фонарём на шесте
    var x = ls.x - ls.face * 10, y = 440, step = ls.off ? 0 : Math.sin(lt * 5);
    c.fillStyle = p.ironD; c.fillRect(x - 6 + step * 3, y - 16, 5, 16); c.fillRect(x + 1 - step * 3, y - 16, 5, 16);
    c.fillStyle = '#2a2430'; c.beginPath(); c.moveTo(x - 12, y - 14); c.lineTo(x + 12, y - 14); c.lineTo(x + 7, y - 66); c.lineTo(x - 7, y - 66); c.fill();
    c.fillStyle = p.ironD; c.beginPath(); c.arc(x, y - 72, 8, 0, Math.PI * 2); c.fill(); c.fillRect(x - 13, y - 78, 26, 3);
    c.fillStyle = ls.off ? p.ironD : p.light; c.fillRect(x + ls.face * 2, y - 74, 4, 2);
    c.strokeStyle = p.brassD; c.lineWidth = 2; c.beginPath(); c.moveTo(x + ls.face * 6, y - 50); c.lineTo(ls.x, ls.y - 8); c.stroke();
    c.fillStyle = p.ironD; c.fillRect(ls.x - 5, ls.y - 9, 10, 12);
  }

  // ---------- механизмы ----------
  function drawMech(c, S, game, p, t) {
    var L = S.L, d = S.d, i;
    (L.ladders || []).forEach(function (l) { c.fillStyle = p.woodL; c.fillRect(l.x + 2, l.y, 3, l.h); c.fillRect(l.x + l.w - 5, l.y, 3, l.h); for (var y = l.y + 8; y < l.y + l.h; y += 12) c.fillRect(l.x + 2, y, l.w - 4, 2.5); });
    (L.plates || []).forEach(function (pl, k) { var on = d.plates[k].on, y = (pl.y || 440); c.fillStyle = p.brassD; c.fillRect(pl.x, y - (on ? 1 : 4), pl.w, on ? 2 : 5); c.fillStyle = on ? p.warm : p.brass; c.fillRect(pl.x + 3, y - (on ? 2 : 5), pl.w - 6, 2); if (pl.min >= 3) { c.fillStyle = p.ink; c.fillRect(pl.x + pl.w / 2 - 6, y - 4, 12, 1.5); } });
    (L.levers || []).forEach(function (lv, k) {
      var y = lv.y || 440, held = false; d.bodies.forEach(function (b) { if (b.hold === k) held = true; });
      c.fillStyle = p.ironD; c.fillRect(lv.x - 8, y - 10, 16, 10);
      if (lv.mode === 'hold') {   // ворот: колесо с ручкой, вращается, пока держат
        var a = held ? t * 5 : 0; c.strokeStyle = held ? p.warm : p.brass; c.lineWidth = 2; c.beginPath(); c.arc(lv.x, y - 22, 11, 0, Math.PI * 2); c.stroke();
        for (var s = 0; s < 4; s++) { c.beginPath(); c.moveTo(lv.x, y - 22); c.lineTo(lv.x + Math.cos(a + s * 1.57) * 11, y - 22 + Math.sin(a + s * 1.57) * 11); c.stroke(); }
        c.fillStyle = p.ironD; c.fillRect(lv.x - 2, y - 22, 4, 12);
      } else {
        var on2 = d.levers[k].on, ang = on2 ? 0.7 : -0.7; c.strokeStyle = p.brass; c.lineWidth = 3; c.beginPath(); c.moveTo(lv.x, y - 8); c.lineTo(lv.x + Math.sin(ang) * 22, y - 8 - Math.cos(ang) * 22); c.stroke();
        circ(c, lv.x + Math.sin(ang) * 22, y - 8 - Math.cos(ang) * 22, 3.5, on2 ? p.warm : p.velvet);
      }
    });
    for (i = 0; i < (L.doors || []).length; i++) { var r = game.doorRect(i); c.fillStyle = p.wood; c.fillRect(r.x, r.y, r.w, r.h); c.fillStyle = p.ink; for (var yy = r.y + 6; yy < r.y + r.h; yy += 9) c.fillRect(r.x + 2, yy, r.w - 4, 1.5); c.fillStyle = p.brassD; c.fillRect(r.x, r.y + r.h - 4, r.w, 4); }
    (L.bridges || []).forEach(function (b) { var on = game.sig(b.link); c.save(); c.globalAlpha = on ? 1 : 0.18; c.fillStyle = p.woodL; c.fillRect(b.x, b.y, b.w, 6); c.fillStyle = p.wood; for (var x = b.x; x < b.x + b.w; x += 20) c.fillRect(x + 1, b.y + 6, 18, b.h - 6); c.restore(); if (!on) { c.strokeStyle = p.brassD; c.lineWidth = 1; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + 30, b.y - 120); c.moveTo(b.x + b.w, b.y); c.lineTo(b.x + b.w - 30, b.y - 120); c.stroke(); } });
    for (i = 0; i < (L.lifts || []).length; i++) { var lr = game.liftRect(i); c.strokeStyle = p.ironD; c.lineWidth = 2; c.beginPath(); c.moveTo(lr.x + 8, lr.y); c.lineTo(lr.x + 8, 36); c.moveTo(lr.x + lr.w - 8, lr.y); c.lineTo(lr.x + lr.w - 8, 36); c.stroke(); c.fillStyle = p.iron; c.fillRect(lr.x, lr.y, lr.w, lr.h); c.fillStyle = p.brass; c.fillRect(lr.x, lr.y, lr.w, 2); gearAt(c, lr.x + lr.w / 2, 46, 10, t * (game.sig(L.lifts[i].link) ? 2 : 0), p); }
    for (i = 0; i < (L.movers || []).length; i++) { var mr = game.moverRect(i), mx = mr.x + mr.w / 2; c.strokeStyle = p.brassD; c.lineWidth = 2; c.beginPath(); c.moveTo(mr.x + 6, mr.y); c.lineTo(mx, 120); c.lineTo(mr.x + mr.w - 6, mr.y); c.stroke();
      c.fillStyle = p.velvet; c.beginPath(); c.moveTo(mr.x, mr.y); c.lineTo(mr.x + mr.w, mr.y); c.lineTo(mr.x + mr.w - 10, mr.y + mr.h + 10); c.lineTo(mr.x + 10, mr.y + mr.h + 10); c.fill(); c.fillStyle = p.brass; c.fillRect(mr.x, mr.y, mr.w, 3); }
    if ((L.movers || []).length) { c.fillStyle = p.ironD; c.fillRect(1240, 110, 420, 8); circ(c, 1410, 114, 6, p.brass); }
    for (i = 0; i < (L.crushers || []).length; i++) { var cr = game.crushRect(i), cl = L.crushers[i]; c.fillStyle = p.ironD; c.fillRect(cr.x + cr.w / 2 - 5, 36, 10, cr.y - 36); c.fillStyle = p.iron; c.fillRect(cr.x, cr.y, cr.w, cr.h); c.fillStyle = p.copper; c.fillRect(cr.x, cr.y + cr.h - 6, cr.w, 6); c.fillStyle = p.ironD; for (var hx = cr.x + 6; hx < cr.x + cr.w - 4; hx += 12) c.fillRect(hx, cr.y + 6, 4, cr.h - 16);
      if (cl.stop && game.sig(cl.stop)) { c.fillStyle = p.warm; c.fillRect(cr.x + cr.w / 2 - 3, cr.y - 8, 6, 6); } }
    for (i = 0; i < (L.drums || []).length; i++) { var ds = d.drums[i], dr = L.drums[i]; if (ds.st === 0 || ds.st === 3) { if (ds.st === 0) drumAt(c, ds.x, ds.y, dr.r, 0, p, 0.9); continue; } drumAt(c, ds.x, ds.y, dr.r, ds.rot, p, 1); }
    d.crates.forEach(function (cb) { if (cb.gone) return; var hv = cb.kind === 'heavy'; c.fillStyle = hv ? p.ironD : p.wood; c.fillRect(cb.x, cb.y, cb.w, cb.h); c.strokeStyle = hv ? p.iron : p.woodL; c.lineWidth = 3; c.strokeRect(cb.x + 2, cb.y + 2, cb.w - 4, cb.h - 4); c.beginPath(); c.moveTo(cb.x + 4, cb.y + 4); c.lineTo(cb.x + cb.w - 4, cb.y + cb.h - 4); c.stroke(); if (hv) { c.fillStyle = p.copper; c.fillRect(cb.x + 6, cb.y + 6, 6, 6); c.fillRect(cb.x + cb.w - 12, cb.y + 6, 6, 6); } });
  }
  function gearAt(c, x, y, r, a, p) { c.save(); c.translate(x, y); c.rotate(a); gear(c, 0, 0, r, 8, p.brassD); circ(c, 0, 0, r * 0.35, p.ironD); c.restore(); }
  function drumAt(c, x, y, r, rot, p, a) {   // барабан шкатулки со штифтами
    c.save(); c.globalAlpha = a; c.translate(x, y); circ(c, 0, 0, r, p.brassD); circ(c, 0, 0, r - 5, p.brass); c.rotate(rot);
    c.fillStyle = p.ink; for (var i = 0; i < 14; i++) { var an = i / 14 * Math.PI * 2; c.fillRect(Math.cos(an) * (r - 10) - 1.5, Math.sin(an) * (r - 10) - 1.5, 3, 3); }
    c.strokeStyle = p.brassD; c.lineWidth = 3; c.beginPath(); c.moveTo(-r + 6, 0); c.lineTo(r - 6, 0); c.moveTo(0, -r + 6); c.lineTo(0, r - 6); c.stroke(); circ(c, 0, 0, 6, p.ironD); c.restore();
  }
  function drawCps(c, S, p, t) {   // фонарики-отметки: зажжены те, до которых дошёл
    S.L.cps.forEach(function (cp, k) { if (k === 0) return; var x = cp.x - 30, y = cp.y || 440, lit = k <= S.cp;
      c.fillStyle = p.ironD; c.fillRect(x - 1.5, y - 46, 3, 46); c.fillRect(x - 6, y - 50, 12, 3);
      c.fillStyle = lit ? p.warm : p.ironD; c.fillRect(x - 4, y - 47 + 3, 8, 9);
      if (lit) { c.save(); c.globalAlpha = 0.25 + 0.05 * Math.sin(t * 3 + k); circ(c, x, y - 40, 22, p.warm); c.restore(); } });
  }
  function drawThread(c, S, game, p, t) {   // звук камертона: волнистая нить от подмастерья к управляемым куклам
    var d = S.d; if (d.ctl === 'hero') { d.bodies.forEach(function (b) { if (b.att && b.kind !== 'hero' && !b.lost) { var h = game.hero(), dx = Math.abs(b.x - h.x); if (dx < K.C.LINK_R) { c.save(); c.globalAlpha = 0.12; c.strokeStyle = p.core; c.lineWidth = 1; c.setLineDash([3, 6]); c.beginPath(); c.moveTo(h.x + 9 + h.face * 8, h.y + 18); c.lineTo(b.x + b.w / 2, b.y + b.h * 0.45); c.stroke(); c.restore(); } } }); return; }
    var h = game.hero(), hx = h.x + 9 + h.face * 8, hy = h.y + 4;
    game.ctlBodies().forEach(function (b) {
      var bx = b.x + b.w / 2, by = b.y + b.h * 0.45, len = Math.hypot(bx - hx, by - hy), n = Math.max(6, (len / 14) | 0);
      c.save(); c.strokeStyle = p.core; c.globalAlpha = 0.55; c.lineWidth = 1.3; c.beginPath();
      for (var i = 0; i <= n; i++) { var u = i / n, x = hx + (bx - hx) * u, y = hy + (by - hy) * u - Math.sin(u * Math.PI) * 26 + Math.sin(u * 18 - t * 10) * 3 * Math.sin(u * Math.PI); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke(); c.restore();
    });
  }

  // ---------- кадр ----------
  var off = null, offC = null, grain = null;
  function grainTex() { if (grain) return grain; grain = mkCanvas(128, 128); if (!grain) return null; var c = grain.getContext('2d'), im = c.createImageData(128, 128), R = rng(7); for (var i = 0; i < im.data.length; i += 4) { var v = (R() * 255) | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 18; } c.putImageData(im, 0, 0); return grain; }
  RD.updateCam = function (S, game, dt, snap) {
    var cam = RD.cam, L = S.L, list = game.ctlBodies(), tx = 0;
    if (!list.length) list = [game.hero()];
    list.forEach(function (b) { tx += b.x + b.w / 2; }); tx /= list.length;
    var f = list[0].face || 1; tx += f * 70 - W / 2;
    tx = Math.max(0, Math.min(L.w - W, tx));
    if (snap || cam.z !== S.z) { cam.x = tx; cam.z = S.z; } else cam.x += (tx - cam.x) * (1 - Math.exp(-dt * 3.2));
  };
  RD.draw = function (ctx, S, g, o) {
    o = o || {};
    var theme = g.themeName === 'retro' ? 'retro' : 'modern', flat = theme === 'retro', p = PAL[theme], game = o.game, t = (S.d && S.d.time) || 0, L = S.L;
    var c = ctx;
    if (flat) { if (!off) { off = mkCanvas(W / 2, H / 2); offC = off && off.getContext('2d'); } if (offC) { c = offC; c.setTransform(0.5, 0, 0, 0.5, 0, 0); c.imageSmoothingEnabled = false; } }
    var cam = RD.cam;
    // небо
    if (flat) { rect(c, 0, 0, W, 180, p.sky0); rect(c, 0, 180, W, 120, p.sky1); rect(c, 0, 300, W, 240, p.sky2); }
    else { var sg = c.createLinearGradient(0, 0, 0, 440); sg.addColorStop(0, p.sky0); sg.addColorStop(0.55, p.sky1); sg.addColorStop(1, p.sky2); c.fillStyle = sg; c.fillRect(0, 0, W, H); }
    // луна-циферблат
    c.save(); c.globalAlpha = flat ? 1 : 0.85; circ(c, 760 - cam.x * 0.05, 120, 30, flat ? '#ffeecc' : '#f3e6c8'); c.globalAlpha = 1; c.strokeStyle = flat ? '#aa8844' : 'rgba(120,90,60,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(760 - cam.x * 0.05, 120); c.lineTo(760 - cam.x * 0.05, 100); c.moveTo(760 - cam.x * 0.05, 120); c.lineTo(774 - cam.x * 0.05, 126); c.stroke(); c.restore();
    var bg = background(S.z, L, theme);
    if (bg) { c.drawImage(bg.far, -cam.x * 0.25, 0); if (!flat) { c.fillStyle = p.fog; c.fillRect(0, 300, W, 140); } c.drawImage(bg.mid, -cam.x * 0.55, 0); }
    // мир
    c.save(); c.translate(-Math.round(cam.x), 0);
    var x0 = cam.x - 60, x1 = cam.x + W + 60;
    L.solids.forEach(function (s) { if (s[0] < x1 && s[0] + s[2] > x0) drawSolid(c, s, p, flat); });
    drawCps(c, S, p, t);
    drawMech(c, S, game, p, t);
    drawThread(c, S, game, p, t);
    S.d.bodies.forEach(function (b) { if (b.kind !== 'hero' && !b.lost) drawBody(c, b, p, t, S.d.ctl); });
    var h = S.d.bodies[0]; if (!(S.dead && S.dead.who === 'hero' && S.dead.t < 0.2)) drawBody(c, h, p, t, S.d.ctl, !!S.dead);
    drawLamps(c, S, game, p, flat, t);
    // пылинки в холодном свете
    if (!flat) { c.save(); c.fillStyle = 'rgba(255,230,200,0.35)'; for (var k = 0; k < 26; k++) { var px = ((k * 137.5 + t * (6 + k % 5)) % (W + 40)) + cam.x - 20, py = 80 + ((k * 89 + Math.sin(t * 0.5 + k) * 20) % 340); c.fillRect(px, py, 1.5, 1.5); } c.restore(); }
    // смерть: «завод остановился» — круги тиканья
    if (S.dead) { var dd = 1 - S.dead.t / K.C.DEAD_T; c.save(); c.strokeStyle = p.porcelain; c.globalAlpha = Math.max(0, 0.7 - dd * 0.7); c.lineWidth = 1.5; for (var q = 0; q < 3; q++) { c.beginPath(); c.arc(S.dead.x, S.dead.y, 8 + (dd * 60 + q * 14) % 60, 0, Math.PI * 2); c.stroke(); } c.restore(); }
    c.restore();
    if (S.dead && !flat) { var dk = Math.min(1, (1 - S.dead.t / K.C.DEAD_T) * 1.6); c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,' + dk + ')'; c.fillRect(0, 0, W, H); c.restore(); }
    // виньетка, зерно
    if (!flat) { var vg = c.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 620); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,6,0.6)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
      var gt = grainTex(); if (gt) { c.save(); c.globalAlpha = 0.5; var gx = (t * 997) % 128, gy = (t * 613) % 128; for (var ix = -128; ix < W; ix += 128) for (var iy = -128; iy < H; iy += 128) c.drawImage(gt, ix + gx, iy + gy); c.restore(); } }
    if (S.dead && flat) { c.save(); c.globalAlpha = 0.45; c.fillStyle = '#555555'; c.fillRect(0, 0, W, H); c.restore(); }
    // переход между зонами и вход: затемнение с пиктограммой зоны
    var fade = 0; if (S.phase === 'turn') fade = 1 - S.turnT / K.C.TURN_T; if (S._enterT > 0) fade = Math.max(fade, S._enterT);
    if (fade > 0) { c.save(); c.globalAlpha = Math.min(1, fade); rect(c, 0, 0, W, H, '#000000'); c.globalAlpha = Math.min(1, fade) * 0.9; zoneIcon(c, W / 2, H / 2 - 10, S.phase === 'turn' ? S.z + 1 : S.z, p, t); c.restore(); }
    // кашетирование
    rect(c, 0, 0, W, BAR, p.bar); rect(c, 0, H - BAR, W, BAR, p.bar);
    if (o.hud !== false && game) hud(c, S, game, p);
    if (flat && offC) {
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (var sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 2); ctx.restore();
    }
    if (o.overlay) o.overlay(ctx, p, flat);   // меню и надписи — поверх, в полном разрешении
  };
  RD.ctx2 = function (ctx, g) { return g.themeName === 'retro' && offC ? offC : ctx; };
  // пиктограммы зон (без слов): шестерня, фонарь, карусель, колокол, молот, башня, рассвет
  function zoneIcon(c, x, y, z, p, t) {
    c.save(); c.translate(x, y); c.strokeStyle = p.brass; c.fillStyle = p.brass; c.lineWidth = 3;
    if (z === 0) { c.rotate(t * 0.5); gear(c, 0, 0, 26, 10, p.brass); circ(c, 0, 0, 9, '#000'); }
    else if (z === 1) { c.fillRect(-2, -10, 4, 50); c.fillRect(-12, -30, 24, 22); c.fillStyle = p.light; c.fillRect(-7, -26, 14, 14); }
    else if (z === 2) { c.beginPath(); c.moveTo(-34, -6); c.lineTo(0, -34); c.lineTo(34, -6); c.closePath(); c.fill(); c.fillRect(-2, -6, 4, 40); for (var i = -1; i <= 1; i++) { c.fillStyle = p.velvet; c.fillRect(i * 22 - 6, 8 + Math.sin(t * 2 + i) * 4, 12, 16); } }
    else if (z === 3) { c.beginPath(); c.moveTo(-26, 22); c.quadraticCurveTo(-24, -26, 0, -28); c.quadraticCurveTo(24, -26, 26, 22); c.closePath(); c.fill(); circ(c, 0, 28, 6, p.brass); }
    else if (z === 4) { c.fillRect(-4, -36, 8, 40); c.fillRect(-26, 4, 52, 22); c.fillStyle = p.copper; c.fillRect(-26, 20, 52, 6); }
    else if (z === 5) { c.fillRect(-16, -20, 32, 56); c.beginPath(); c.moveTo(-22, -20); c.lineTo(0, -46); c.lineTo(22, -20); c.fill(); circ(c, 0, 0, 10, '#000'); }
    else { circ(c, 0, 10, 30, p.warm); c.fillStyle = '#000'; c.fillRect(-40, 10, 80, 40); }
    c.restore();
    c.save(); for (var k = 0; k < 6; k++) circ(c, x - 50 + k * 20, y + 70, 4, k <= z ? p.warm : '#333'); c.restore();
  }
  // HUD в верхней кашете: кем можно управлять (пиктограммы), активный — подсвечен
  var ICON = { hero: 'hero', porter: 'porter', dancer: 'dancer', giant: 'giant', soldier: 'soldier' };
  function hud(c, S, game, p) {
    var opts = game.options(), x = W - 24;
    for (var i = opts.length - 1; i >= 0; i--) {
      var id = opts[i], kind = id === 'hero' ? 'hero' : id === 'squad' ? 'soldier' : game.body(id).kind, cur = S.d.ctl === id;
      c.save(); c.globalAlpha = cur ? 1 : 0.45; if (cur) { c.strokeStyle = p.core; c.lineWidth = 1.5; c.strokeRect(x - 13, 4, 26, 26); }
      miniIcon(c, x, 17, ICON[kind], p); c.restore(); x -= 32;
    }
    if (S.L) { for (var k = 0; k < S.L.cps.length; k++) circ(c, 20 + k * 12, BAR / 2, 3, k <= S.cp ? p.warm : '#3a3030'); }
  }
  function miniIcon(c, x, y, kind, p) {
    if (kind === 'hero') { circ(c, x, y - 4, 5, p.hood); c.fillStyle = p.coat; c.fillRect(x - 5, y, 10, 9); }
    else if (kind === 'porter') { circ(c, x, y + 2, 7, p.brass); circ(c, x, y - 7, 3.5, p.porcelain); }
    else if (kind === 'dancer') { c.fillStyle = p.velvet; c.beginPath(); c.moveTo(x - 7, y + 3); c.lineTo(x + 7, y + 3); c.lineTo(x, y - 3); c.fill(); circ(c, x, y - 7, 3, p.porcelain); }
    else if (kind === 'giant') { c.fillStyle = p.brass; c.beginPath(); c.moveTo(x - 7, y); c.quadraticCurveTo(x, y - 14, x + 7, y); c.fill(); c.fillStyle = p.iron; c.fillRect(x - 8, y, 16, 10); }
    else { c.fillStyle = p.coat; c.fillRect(x - 4, y - 1, 8, 9); c.fillStyle = p.ironD; c.fillRect(x - 3, y - 11, 6, 7); circ(c, x + 9, y + 2, 1.5, p.core); circ(c, x - 9, y + 2, 1.5, p.core); }
  }
  RD.miniIcon = miniIcon; RD.zoneIcon = zoneIcon; RD.drawBody = drawBody; RD.gear = gear;
})(typeof window !== 'undefined' ? window : globalThis);
