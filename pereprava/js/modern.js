/* ПЕРЕПРАВА · рендер MODERN (по умолчанию). PEREPRAVA.modern = { P, bg, draw, lifeIcon }
   Заводской двор «Гефеста» сверху: склад с пятью ячейками, канал с брёвнами, плотами,
   ныряющими поплавками и сомом, бетонная насыпь, проезд с транспортом, пол мастерской.
   Герой — механический жук-курьер Шуруп (латунный корпус, шляпка шурупа на спине).
   Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var K = global.PEREPRAVA = global.PEREPRAVA || {};
  var L = K.logic, TAU = Math.PI * 2;
  var W = L.W, CW = L.CW, RH = L.RH;

  var P = {
    pixel: false, font: null,
    hudBg: '#0f1318', hudLine: '#232b35', ink: '#eef2f8', muted: '#8d98a8', accent: '#ff8a3d',
    good: '#4fd88a', bad: '#ff5d6c', warn: '#ffc341', panel: '#141a21', bar: '#232b35',
    life: '#e2ad4a', lifeOff: '#2d3540'
  };
  var CAR = {
    cart: ['#f2a03d', '#9a5a17'], lift: ['#f6c945', '#7a6417'], moto: ['#ff5d6c', '#8a2430'],
    roller: ['#58b58c', '#25543f'], truck: ['#5b8fd8', '#26406a']
  };
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, p = Math.abs(f);
    return 'rgb(' + Math.round((t - r) * p + r) + ',' + Math.round((t - g) * p + g) + ',' + Math.round((t - b) * p + b) + ')';
  }
  var rr = function (ctx, x, y, w, h, r) { K.ui.roundRect(ctx, x, y, w, h, r); };
  function ry(r) { return L.rowY(r); }

  // ---------- Статичный фон (кэш) ----------
  var cache = null;
  function buildBg() {
    var c = document.createElement('canvas'); c.width = W; c.height = L.H;
    var x = c.getContext('2d');
    x.fillStyle = '#0f1318'; x.fillRect(0, 0, W, L.H);
    // склад (ряд 0): стена из панелей
    var y0 = ry(0), gr = x.createLinearGradient(0, y0, 0, y0 + RH);
    gr.addColorStop(0, '#39424e'); gr.addColorStop(1, '#262d36');
    x.fillStyle = gr; x.fillRect(0, y0, W, RH);
    x.fillStyle = 'rgba(255,255,255,.05)';
    for (var px = 0; px < W; px += 24) x.fillRect(px, y0, 1, RH);
    x.fillStyle = '#ff8a3d'; x.fillRect(0, y0 + RH - 4, W, 2);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, y0 + RH - 2, W, 2);
    L.BAY_COLS.forEach(function (col) {
      var cx = L.colX(col);
      x.fillStyle = '#0d1116'; rr(x, cx - 19, y0 + 4, 38, RH - 6, 5); x.fill();
      x.strokeStyle = '#5b6573'; x.lineWidth = 2; rr(x, cx - 19, y0 + 4, 38, RH - 6, 5); x.stroke();
      x.fillStyle = 'rgba(255,138,61,.10)'; x.fillRect(cx - 16, y0 + RH - 12, 32, 6);
      x.fillStyle = '#4a5462'; x.fillRect(cx - 16, y0 + 15, 32, 2);   // полка
    });
    // канал (ряды 1–5)
    var wy = ry(L.RIVER0), wh = RH * (L.RIVER1 - L.RIVER0 + 1);
    var wg = x.createLinearGradient(0, wy, 0, wy + wh);
    wg.addColorStop(0, '#0d3d57'); wg.addColorStop(0.5, '#0f4a63'); wg.addColorStop(1, '#0c3a52');
    x.fillStyle = wg; x.fillRect(0, wy, W, wh);
    for (var r = L.RIVER0 + 1; r <= L.RIVER1; r++) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, ry(r), W, 1); }
    // насыпь (ряд 6)
    var my = ry(L.MEDIAN), mg = x.createLinearGradient(0, my, 0, my + RH);
    mg.addColorStop(0, '#5a5f66'); mg.addColorStop(1, '#43474d');
    x.fillStyle = mg; x.fillRect(0, my, W, RH);
    for (var sx = 0; sx < W; sx += 48) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(sx, my, 1, RH); }
    x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, my, W, 2);
    hazard(x, my + RH - 5, 5);
    // проезд (ряды 7–11)
    var dy = ry(L.ROAD0), dh = RH * (L.ROAD1 - L.ROAD0 + 1);
    x.fillStyle = '#23272d'; x.fillRect(0, dy, W, dh);
    x.fillStyle = 'rgba(255,255,255,.025)';
    for (var i = 0; i < 260; i++) { var nx = (i * 73) % W, ny = dy + (i * 131) % dh; x.fillRect(nx, ny, 2, 2); }
    for (r = L.ROAD0 + 1; r <= L.ROAD1; r++) {
      x.fillStyle = 'rgba(240,240,220,.32)';
      for (var lx = 6; lx < W; lx += 40) x.fillRect(lx, ry(r) - 1, 22, 2);
    }
    // пол мастерской (ряд 12)
    var fy = ry(L.START), fg = x.createLinearGradient(0, fy, 0, fy + RH);
    fg.addColorStop(0, '#3a3430'); fg.addColorStop(1, '#2a2522');
    x.fillStyle = fg; x.fillRect(0, fy, W, RH);
    hazard(x, fy, 5);
    x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 1;
    for (sx = 0; sx < W; sx += 16) { x.beginPath(); x.moveTo(sx + 0.5, fy + 8); x.lineTo(sx + 0.5, fy + RH); x.stroke(); }
    return c;
  }
  function hazard(x, y, h) {
    x.save(); x.beginPath(); x.rect(0, y, W, h); x.clip();
    x.fillStyle = '#2a2a2a'; x.fillRect(0, y, W, h); x.fillStyle = '#e8b830';
    for (var i = -h; i < W; i += 14) { x.beginPath(); x.moveTo(i, y + h); x.lineTo(i + h, y); x.lineTo(i + h + 7, y); x.lineTo(i + 7, y + h); x.fill(); }
    x.restore();
  }
  function bg(ctx, g) { if (!cache) cache = buildBg(); ctx.drawImage(cache, 0, 0); }

  // ---------- Вода: бегущие блики по течению ----------
  function water(ctx, S) {
    var t = S.time;
    for (var r = L.RIVER0; r <= L.RIVER1; r++) {
      var lane = S.cfg.lanes[r], y = ry(r);
      ctx.fillStyle = 'rgba(160,220,255,.10)';
      for (var i = 0; i < 9; i++) {
        var ph = (i * 97 + r * 41) % 120, len = 14 + (i * 7) % 18;
        var xx = L.mod(i * 61 + r * 23 + lane.v * 0.55 * t, W + 60) - 30;
        ctx.fillRect(xx, y + 8 + (ph % 24), len, 1.5);
      }
    }
  }

  // ---------- Склад ----------
  function gear(ctx, x, y, r, teeth, rot, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath();
    for (var i = 0; i < teeth * 2; i++) { var a = i * Math.PI / teeth, rad = i % 2 ? r * 0.72 : r; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function bays(ctx, S) {
    var y = ry(0) + RH / 2 + 2, t = S.time;
    S.bays.forEach(function (b) {
      if (b.filled) {
        ctx.fillStyle = '#8a6136'; rr(ctx, b.x - 13, y - 8, 26, 18, 3); ctx.fill();
        ctx.strokeStyle = '#5a3d1f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(b.x - 13, y + 1); ctx.lineTo(b.x + 13, y + 1); ctx.stroke();
        gear(ctx, b.x, y - 8, 7, 7, 0, '#ffb35c');
        hero(ctx, b.x + 12, y + 4, 'down', 0, 0.5, false, t);
        if (b.mate) washer(ctx, b.x - 12, y + 4, 0.75, t, 1);
      } else if (b.prize > 0) {
        ctx.save(); ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 14;
        gear(ctx, b.x, y, 10, 8, t * 2, b.prize < 1.5 && (t * 8 | 0) % 2 ? '#a07a2a' : '#ffd36b'); ctx.restore();
      } else if (b.warn > 0) {
        if ((t * 10 | 0) % 2) { ctx.strokeStyle = '#ff5d6c'; ctx.lineWidth = 2; rr(ctx, b.x - 17, ry(0) + 6, 34, RH - 10, 4); ctx.stroke(); }
      } else if (b.trap > 0) {
        ctx.fillStyle = '#3a1418'; rr(ctx, b.x - 16, y - 12, 32, 24, 4); ctx.fill();
        var open = 0.5 + 0.5 * Math.sin(t * 9);
        ctx.fillStyle = '#c7cdd6';
        for (var i = 0; i < 5; i++) {
          var tx = b.x - 14 + i * 7;
          ctx.beginPath(); ctx.moveTo(tx, y - 10); ctx.lineTo(tx + 3.5, y - 3 - open * 4); ctx.lineTo(tx + 7, y - 10); ctx.fill();
          ctx.beginPath(); ctx.moveTo(tx, y + 10); ctx.lineTo(tx + 3.5, y + 3 + open * 4); ctx.lineTo(tx + 7, y + 10); ctx.fill();
        }
        ctx.fillStyle = '#ff5d6c'; ctx.beginPath(); ctx.arc(b.x, y, 2.5, 0, TAU); ctx.fill();
      }
    });
  }

  // ---------- Плавсредства ----------
  function floatObj(ctx, S, lane, o, x) {
    var y = ry(lane.row), cy = y + RH / 2, len = o.len, dir = lane.v > 0 ? 1 : -1;
    if (o.type === 'log') {
      var lg = ctx.createLinearGradient(0, cy - 13, 0, cy + 13);
      lg.addColorStop(0, '#a77a4c'); lg.addColorStop(0.45, '#8a5f36'); lg.addColorStop(1, '#5b3d22');
      ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(ctx, x + 2, cy - 10, len - 2, 26, 12); ctx.fill();
      ctx.fillStyle = lg; rr(ctx, x + 1, cy - 13, len - 2, 26, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(60,35,15,.55)'; ctx.lineWidth = 1;
      for (var i = 14; i < len - 14; i += 19) { ctx.beginPath(); ctx.moveTo(x + i, cy - 8 + (i % 3)); ctx.lineTo(x + i + 11, cy - 8 + (i % 3)); ctx.moveTo(x + i + 5, cy + 5); ctx.lineTo(x + i + 15, cy + 5); ctx.stroke(); }
      ctx.fillStyle = '#c99a63'; ctx.beginPath(); ctx.ellipse(x + len - 7, cy, 5, 12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a5f36'; ctx.beginPath(); ctx.ellipse(x + len - 7, cy, 2.5, 7, 0, 0, TAU); ctx.stroke();
    } else if (o.type === 'raft') {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 3, cy - 11, len - 4, 26);
      for (var p = 0; p < len - 4; p += 8) {
        ctx.fillStyle = (p / 8) % 2 ? '#b98c55' : '#c99c62'; rr(ctx, x + 2 + p, cy - 14, 7, 28, 2); ctx.fill();
      }
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x + 2, cy - 8, len - 4, 2); ctx.fillRect(x + 2, cy + 6, len - 4, 2);
    } else if (o.type === 'dive') {
      var d = L.diveDepth(S.cfg, o, S.time);
      for (var c = 0; c < len / CW; c++) {
        var bx = x + c * CW + CW / 2;
        if (d >= 1) { ring(ctx, bx, cy, 10, 0.35); continue; }
        var s = 1 - d * 0.55;
        ctx.globalAlpha = 1 - d * 0.6;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(bx + 1, cy + 2, 12 * s, 0, TAU); ctx.fill();
        var bg2 = ctx.createRadialGradient(bx - 4, cy - 4, 2, bx, cy, 12 * s);
        bg2.addColorStop(0, '#ffd2a6'); bg2.addColorStop(1, '#e8662e');
        ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(bx, cy, 12 * s, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(bx - 12 * s, cy - 2.5 * s, 24 * s, 5 * s);
        ctx.globalAlpha = 1;
        if (d > 0) ring(ctx, bx, cy, 13, 0.5);
      }
    } else if (o.type === 'fish') {
      // сом: спина — опора, голова (передняя клетка) — пасть
      ctx.save(); ctx.translate(x + len / 2, cy); ctx.scale(dir, 1);
      var hl = len / 2, wag = Math.sin(S.time * 6 + o.ph) * 3;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(2, 3, hl - 4, 12, 0, 0, TAU); ctx.fill();
      var fg = ctx.createLinearGradient(0, -13, 0, 13); fg.addColorStop(0, '#7a6f62'); fg.addColorStop(1, '#3b342c');
      ctx.fillStyle = fg; ctx.beginPath();
      ctx.moveTo(-hl, wag); ctx.lineTo(-hl + 10, -10); ctx.quadraticCurveTo(0, -15, hl - 8, -11);
      ctx.quadraticCurveTo(hl + 2, 0, hl - 8, 11); ctx.quadraticCurveTo(0, 15, -hl + 10, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-hl + 14, -6, hl, 2);
      var mo = 0.5 + 0.5 * Math.sin(S.time * 7 + o.ph);
      ctx.fillStyle = '#d24456'; ctx.beginPath(); ctx.moveTo(hl - 2, 0); ctx.lineTo(hl - 12, -3 - mo * 4); ctx.lineTo(hl - 12, 3 + mo * 4); ctx.fill();
      ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(hl - 13, -7, 2.4, 0, TAU); ctx.arc(hl - 13, 7, 2.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e8dcc8'; ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(hl - 6, -5); ctx.quadraticCurveTo(hl + 4, -12, hl + 8, -8); ctx.moveTo(hl - 6, 5); ctx.quadraticCurveTo(hl + 4, 12, hl + 8, 8); ctx.stroke();
      ctx.restore();
    }
  }
  function ring(ctx, x, y, r, a) { ctx.strokeStyle = 'rgba(190,235,255,' + a + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU); ctx.stroke(); }

  // ---------- Транспорт ----------
  function vehicle(ctx, lane, o, x) {
    var cy = ry(lane.row) + RH / 2, len = o.len, dir = lane.v > 0 ? 1 : -1, c = CAR[o.type];
    ctx.save(); ctx.translate(x + len / 2, cy); ctx.scale(dir, 1);
    var hl = len / 2 - 2;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, -hl + 2, -11, hl * 2, 26, 6); ctx.fill();
    ctx.fillStyle = '#15181c';   // колёса
    var wy = o.type === 'moto' ? 0 : 12;
    if (o.type !== 'moto') { ctx.fillRect(-hl + 3, -wy - 2, 7, 4); ctx.fillRect(hl - 10, -wy - 2, 7, 4); ctx.fillRect(-hl + 3, wy - 2, 7, 4); ctx.fillRect(hl - 10, wy - 2, 7, 4); }
    var bg2 = ctx.createLinearGradient(0, -12, 0, 12); bg2.addColorStop(0, shade(c[0], 0.15)); bg2.addColorStop(1, shade(c[0], -0.25));
    if (o.type === 'truck') {
      ctx.fillStyle = '#c9ced6'; rr(ctx, -hl, -12, hl * 2 - 22, 24, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.12)'; for (var i = -hl + 8; i < hl - 24; i += 10) ctx.fillRect(i, -12, 1, 24);
      ctx.fillStyle = '#ff8a3d'; ctx.fillRect(-hl + 4, -2, hl * 2 - 32, 4);
      ctx.fillStyle = bg2; rr(ctx, hl - 20, -11, 20, 22, 5); ctx.fill();
      ctx.fillStyle = '#bfe6ff'; rr(ctx, hl - 7, -8, 4, 16, 2); ctx.fill();
    } else if (o.type === 'roller') {
      ctx.fillStyle = bg2; rr(ctx, -hl, -11, hl * 2 - 16, 22, 5); ctx.fill();
      ctx.fillStyle = '#9aa3ad'; rr(ctx, hl - 14, -13, 14, 26, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.2)'; for (var k = -10; k < 13; k += 5) ctx.fillRect(hl - 14, k, 14, 1.5);
      ctx.fillStyle = '#20262c'; rr(ctx, -hl + 8, -7, 16, 14, 3); ctx.fill();
    } else if (o.type === 'moto') {
      ctx.fillStyle = '#15181c'; ctx.fillRect(-hl + 2, -2, 6, 4); ctx.fillRect(hl - 8, -2, 6, 4);
      ctx.fillStyle = bg2; rr(ctx, -hl + 4, -6, hl * 2 - 8, 12, 5); ctx.fill();
      ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(-1, 0, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#20262c'; ctx.fillRect(hl - 8, -7, 2, 14);
    } else if (o.type === 'lift') {
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(hl - 2, -8, 9, 3); ctx.fillRect(hl - 2, 5, 9, 3);
      ctx.fillStyle = bg2; rr(ctx, -hl, -11, hl * 2, 22, 4); ctx.fill();
      ctx.fillStyle = '#20262c'; rr(ctx, -hl + 4, -6, 12, 12, 2); ctx.fill();
      ctx.fillStyle = '#2b2f35'; ctx.fillRect(hl - 5, -11, 3, 22);
    } else {   // cart — ручная тележка с ящиком
      ctx.fillStyle = bg2; rr(ctx, -hl, -10, hl * 2, 20, 3); ctx.fill();
      ctx.strokeStyle = shade(c[0], -0.45); ctx.lineWidth = 1.2; ctx.strokeRect(-hl + 4, -6, hl * 2 - 8, 12);
      ctx.fillStyle = '#20262c'; ctx.fillRect(-hl - 3, -8, 3, 16);
    }
    // фары по ходу
    ctx.fillStyle = 'rgba(255,240,180,.95)';
    if (o.type !== 'moto') { ctx.fillRect(hl - 1, -9, 2, 4); ctx.fillRect(hl - 1, 5, 2, 4); } else ctx.fillRect(hl - 2, -1.5, 3, 3);
    ctx.restore();
  }

  // ---------- Персонажи ----------
  var FACE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  // Шуруп: латунный жук, шляпка шурупа на спине, глаза-лампы
  function hero(ctx, x, y, face, k, sc, carry, t, dead) {
    var s = (sc || 1) * (1 + Math.sin(Math.PI * (k || 0)) * 0.28);
    ctx.save(); ctx.translate(x, y);
    if (!dead) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(1, 3 + (k ? 5 * Math.sin(Math.PI * k) : 0), 11 * (sc || 1), 9 * (sc || 1), 0, 0, TAU); ctx.fill(); }
    ctx.rotate(FACE[face] || 0); ctx.scale(s, s);
    var leg = k ? Math.sin(k * Math.PI * 2) * 3 : Math.sin(t * 3) * 0.6;
    ctx.strokeStyle = dead ? '#555' : '#3b2c14'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    for (var i = -1; i <= 1; i++) {
      var ly = i * 5, sw = (i % 2 ? leg : -leg);
      ctx.moveTo(-7, ly); ctx.lineTo(-13, ly + sw - 2); ctx.moveTo(7, ly); ctx.lineTo(13, ly - sw - 2);
    }
    ctx.stroke();
    var bgr = ctx.createRadialGradient(-3, -2, 2, 0, 2, 12);
    bgr.addColorStop(0, dead ? '#9a9a9a' : '#ffe08a'); bgr.addColorStop(1, dead ? '#4a4a4a' : '#b07a24');
    ctx.fillStyle = bgr; ctx.beginPath(); ctx.ellipse(0, 2, 9, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dead ? '#3a3a3a' : '#6b4a1c'; ctx.beginPath(); ctx.ellipse(0, -9, 6, 4.5, 0, 0, TAU); ctx.fill();
    // шляпка шурупа (крестовой шлиц)
    ctx.fillStyle = dead ? '#777' : '#d8dde4'; ctx.beginPath(); ctx.arc(0, 3, 4.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a5260'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2.6, 3); ctx.lineTo(2.6, 3); ctx.moveTo(0, 0.4); ctx.lineTo(0, 5.6); ctx.stroke();
    if (!dead) {
      ctx.fillStyle = '#6ff0ff'; ctx.beginPath(); ctx.arc(-2.6, -10.5, 1.6, 0, TAU); ctx.arc(2.6, -10.5, 1.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3b2c14'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -13); ctx.lineTo(-5, -17); ctx.moveTo(2, -13); ctx.lineTo(5, -17); ctx.stroke();
      ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(-5, -17, 1.3, 0, TAU); ctx.arc(5, -17, 1.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (carry) { var bk = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[face] || [0, 1]; washer(ctx, x + bk[0] * 13 * (sc || 1), y + bk[1] * 13 * (sc || 1), 0.62, t, 1); }
  }
  // Шайба: напарник-жучок в виде стальной шайбы
  function washer(ctx, x, y, sc, t, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    var lg = Math.sin(t * 10) * 2;
    ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (var i = -1; i <= 1; i += 2) { ctx.moveTo(-8, i * 4); ctx.lineTo(-12, i * 4 + lg * i); ctx.moveTo(8, i * 4); ctx.lineTo(12, i * 4 - lg * i); }
    ctx.stroke();
    var g2 = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10); g2.addColorStop(0, '#f4f7fb'); g2.addColorStop(1, '#8c97a6');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.arc(0, 0, 3.5, 0, TAU, true); ctx.fill('evenodd');
    ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.arc((dir || 1) * 6, -5, 1.8, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // Паук насыпи: тёмный механический паук с красным глазом
  function spider(ctx, x, y, t, dir) {
    ctx.save(); ctx.translate(x, y);
    var w = Math.sin(t * 14) * 2.5;
    ctx.strokeStyle = '#1a1d22'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var a = -0.9 + i * 0.6, sw = (i % 2 ? w : -w);
      ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9 - 5); ctx.lineTo(Math.cos(a) * 15 + sw, Math.sin(a) * 15 + 4);
      ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(a) * 9, Math.sin(a) * 9 - 5); ctx.lineTo(-Math.cos(a) * 15 - sw, Math.sin(a) * 15 + 4);
    }
    ctx.stroke();
    ctx.fillStyle = '#2d3138'; ctx.beginPath(); ctx.ellipse(0, 2, 8, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#41464f'; ctx.beginPath(); ctx.arc(dir * 6, -2, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff3b4e'; ctx.beginPath(); ctx.arc(dir * 8, -3, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- Кадр ----------
  function draw(ctx, S, g, o) {
    o = o || {};
    bg(ctx, g);
    var t = S.time, cfg = S.cfg;
    water(ctx, S);
    bays(ctx, S);
    for (var r = 1; r < L.ROWS - 1; r++) {
      var lane = cfg.lanes[r]; if (!lane) continue;
      for (var i = 0; i < lane.objs.length; i++) {
        var ob = lane.objs[i], ox = L.objX(lane, ob, t);
        if (ox > W || ox + ob.len < 0) continue;
        if (lane.kind === 'river') floatObj(ctx, S, lane, ob, ox); else vehicle(ctx, lane, ob, ox);
      }
    }
    if (S.mate) { var mx = L.objX(cfg.lanes[S.mate.row], cfg.lanes[S.mate.row].objs[S.mate.idx], t) + S.mate.off; washer(ctx, mx, ry(S.mate.row) + RH / 2, 0.9, t, S.mate.dir); }
    cfg.spiders.forEach(function (sp) { spider(ctx, L.spiderX(sp, t), ry(L.MEDIAN) + RH / 2, t, L.spiderDir(sp, t)); });
    if (!o.bare) {
      if (S.phase === 'dead' && S.death) deathFx(ctx, S);
      else if (S.phase === 'play' && S.hero) {
        var q = L.heroPos(S.hero);
        var hy = ry(0) + q.y * RH + RH / 2, halo = ctx.createRadialGradient(q.x, hy, 2, q.x, hy, 22);
        halo.addColorStop(0, 'rgba(255,170,80,.35)'); halo.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(q.x, hy, 22, 0, TAU); ctx.fill();
        hero(ctx, q.x, hy, S.hero.face, q.k, 1.18, S.carry, t);
      }
      K.ui.hud(g, ctx, S, P, lifeIcon);
      K.ui.footer(g, ctx, S, P);
      K.ui.toasts(g, ctx, o.toasts || [], P);
      K.ui.banner(g, ctx, S, P);
    }
  }
  function deathFx(ctx, S) {
    var d = S.death, k = 1 - S.phaseT / L.DEAD_T, x = d.x, y = ry(d.row) + RH / 2;
    if (d.reason === 'water' || d.reason === 'edge' || d.reason === 'fish') {
      for (var i = 0; i < 3; i++) { var rk = k * 1.6 - i * 0.25; if (rk > 0 && rk < 1) ring(ctx, x, y, 6 + rk * 22, 0.8 * (1 - rk)); }
      if (k < 0.35) { ctx.globalAlpha = 1 - k / 0.35; hero(ctx, x, y, 'up', 0, 1 - k, false, S.time, true); ctx.globalAlpha = 1; }
    } else {
      hero(ctx, x, y, 'up', 0, 1, false, S.time, true);
      ctx.strokeStyle = 'rgba(255,200,90,' + Math.max(0, 1 - k * 1.5) + ')'; ctx.lineWidth = 2; ctx.beginPath();
      for (var j = 0; j < 8; j++) { var a = j * TAU / 8, r0 = 10 + k * 10, r1 = r0 + 8; ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
      ctx.stroke();
    }
  }
  function lifeIcon(ctx, x, y, on) {
    if (on) hero(ctx, x, y, 'up', 0, 0.62, false, 0);
    else { ctx.fillStyle = P.lifeOff; ctx.beginPath(); ctx.ellipse(x, y + 1, 6, 7, 0, 0, TAU); ctx.fill(); }
  }

  K.modern = { P: P, bg: bg, draw: draw, lifeIcon: lifeIcon, hero: hero, washer: washer, gear: gear };
})(typeof window !== 'undefined' ? window : globalThis);
