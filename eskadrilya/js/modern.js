/* ЭСКАДРИЛЬЯ · рендер MODERN (по умолчанию). ESKADRILYA.modern = { P, draw, lifeIcon, loopIcon, wingIcon, plane }
   Вид сверху: бирюзовое море с бликами, острова и берега с пляжем и рощами, облака на параллаксе.
   Свои — паролёты мастерской «Гефест» (биплан с медным котлом, оранжевые крылья), ведомые — бирюзовые.
   Флотилия Окалины — ржавые механические птицы, стальные стрижи, латаные дирижабли, зенитки, паровые катера,
   крейсер-кузня с горном посреди палубы. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA = global.ESKADRILYA || {};
  var L = E.logic, TAU = Math.PI * 2, W = L.W, H = L.H;

  var P = {
    pixel: false, font: null,
    hudBg: 'rgba(9,13,22,.97)', hudBg2: 'rgba(9,13,22,.62)', hudLine: '#24324a', ink: '#f2eee6', muted: '#9ba7b8', accent: '#ff8a3d',
    good: '#5fe0a0', warn: '#ffc04d', bad: '#ff5d6c', panel: '#121926', bar: '#283246', bossBar: '#ff6a2a'
  };
  var rr = function (ctx, x, y, w, h, r) { E.ui.roundRect(ctx, x, y, w, h, r); };
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function isleR(o, a) { return 1 + 0.12 * Math.sin(a * 3 + o.ph) + 0.06 * Math.sin(a * 5 - o.ph); }

  // ---------- Море и суша ----------
  function sea(ctx, S) {
    var gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0d4a66'); gr.addColorStop(1, '#0a3a55');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // блики-волны, привязанные к миру
    var step = 28, k0 = Math.floor(S.dist / step) - 1, k1 = Math.ceil((S.dist + H) / step) + 1;
    ctx.strokeStyle = 'rgba(160,225,240,.16)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (var k = k0; k <= k1; k++) {
      var y = H - (k * step - S.dist);
      for (var j = 0; j < 4; j++) {
        var x = hash(k * 7 + j * 131) * W, wl = 8 + hash(k * 13 + j) * 14, sh = Math.sin(S.time * 1.6 + k + j) * 3;
        ctx.moveTo(x + sh, y); ctx.quadraticCurveTo(x + wl / 2 + sh, y - 3, x + wl + sh, y);
      }
    }
    ctx.stroke();
  }
  function coastPath(ctx, S, side, inset) {
    var T = S.terrain, R = L.ROW, i0 = Math.max(0, Math.floor(S.dist / R) - 2), i1 = Math.min(T.Lw.length - 1, Math.ceil((S.dist + H) / R) + 2);
    var arr = side < 0 ? T.Lw : T.Rw, any = false;
    for (var i = i0; i <= i1; i++) if (arr[i] > inset + 1) { any = true; break; }
    if (!any) return false;
    ctx.beginPath();
    var edge = side < 0 ? -20 : W + 20;
    ctx.moveTo(edge, H - (i0 * R - S.dist));
    for (i = i0; i <= i1; i++) {
      var wv = Math.max(0, arr[i] - inset), y = H - (i * R - S.dist);
      ctx.lineTo(side < 0 ? (wv > 0 ? wv : -20) : (wv > 0 ? W - wv : W + 20), y);
    }
    ctx.lineTo(edge, H - (i1 * R - S.dist)); ctx.closePath();
    return true;
  }
  function islePath(ctx, S, o, inset) {
    var cy = H - (o.wy - S.dist);
    ctx.beginPath();
    for (var k = 0; k <= 36; k++) {
      var a = k / 36 * TAU, r = isleR(o, a), x = o.x + Math.cos(a) * Math.max(4, o.rx * r - inset), y = cy + Math.sin(a) * Math.max(4, o.ry * r - inset);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  function land(ctx, S) {
    var T = S.terrain, vis = T.isles.filter(function (o) { var cy = H - (o.wy - S.dist); return cy > -o.ry * 1.3 - 20 && cy < H + o.ry * 1.3 + 20; });
    var layers = [
      { inset: -7, fill: 'rgba(220,245,255,.22)' },   // прибой
      { inset: 0, fill: '#d8c48e' },                   // пляж
      { inset: 9, fill: '#5d8a45' },                   // трава
      { inset: 24, fill: '#4a7538' }                   // глубь суши
    ];
    layers.forEach(function (Ly) {
      ctx.fillStyle = Ly.fill;
      if (coastPath(ctx, S, -1, Ly.inset)) ctx.fill();
      if (coastPath(ctx, S, 1, Ly.inset)) ctx.fill();
      vis.forEach(function (o) { islePath(ctx, S, o, Ly.inset); ctx.fill(); });
    });
    // рощи и постройки (детерминированно по рядам мира)
    var R = L.ROW, i0 = Math.floor(S.dist / R) - 1, i1 = Math.ceil((S.dist + H) / R) + 1;
    for (var i = i0; i <= i1; i++) {
      var wy = i * R, y = H - (wy - S.dist);
      for (var j = 0; j < 3; j++) {
        var x = hash(i * 31 + j * 977) * W;
        if (!L.isLand(T, x, wy) || !L.isLand(T, x - 14, wy) || !L.isLand(T, x + 14, wy) || !L.isLand(T, x, wy + 14) || !L.isLand(T, x, wy - 14)) continue;
        var hv = hash(i * 17 + j);
        if (hv < 0.12) {   // домик мастерской с рыжей крышей
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 6, y - 3, 14, 10);
          ctx.fillStyle = '#c9b48f'; ctx.fillRect(x - 8, y - 6, 14, 10);
          ctx.fillStyle = '#b4532e'; ctx.fillRect(x - 9, y - 7, 16, 5);
        } else {
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(x + 3, y + 3, 7, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2f5a2a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.arc(x + 6, y + 3, 5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3f7434'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 4, 0, TAU); ctx.fill();
        }
      }
    }
  }
  function clouds(ctx, S) {
    var span = H + 260, off = S.dist * 1.6 + S.time * 6;
    for (var k = 0; k < 5; k++) {
      var y = ((k * 211 + off) % span) - 130, x = hash(k * 53 + Math.floor((k * 211 + off) / span) * 7) * (W + 80) - 40;
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.beginPath(); ctx.ellipse(x, y, 56, 22, 0, 0, TAU); ctx.ellipse(x + 34, y + 8, 40, 18, 0, 0, TAU); ctx.ellipse(x - 30, y + 10, 34, 15, 0, 0, TAU); ctx.fill();
    }
  }

  // ---------- Наземные и морские цели ----------
  function ground(ctx, S, t) {
    S.ground.forEach(function (g) {
      var x = g.x, y = H - (g.wy - S.dist), hit = g.flash > 0;
      if (!g.alive) {   // воронка/обломки
        ctx.fillStyle = 'rgba(30,20,18,.75)'; ctx.beginPath(); ctx.ellipse(x, y, g.type === 'boat' ? 20 : 13, g.type === 'boat' ? 8 : 11, 0, 0, TAU); ctx.fill();
        if (g.type === 'boat') { ctx.strokeStyle = 'rgba(220,245,255,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 24 + Math.sin(t * 3) * 2, 11, 0, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,140,60,' + (0.3 + 0.25 * Math.sin(t * 9 + x)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
        return;
      }
      if (g.type === 'flak') {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(x + 3, y + 4, 14, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a7d63'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();          // мешки с песком
        ctx.strokeStyle = '#6b604b'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, 11.5, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        var a = Math.atan2(S.player.y - y, S.player.x - x);
        ctx.fillStyle = hit ? '#fff' : '#4b4f57'; ctx.beginPath(); ctx.arc(x, y, 7.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = hit ? '#fff' : '#2c2f35'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a + 0.12) * 4, y + Math.sin(a + 0.12) * 4); ctx.lineTo(x + Math.cos(a + 0.12) * 14, y + Math.sin(a + 0.12) * 14);
        ctx.moveTo(x + Math.cos(a - 0.12) * 4, y + Math.sin(a - 0.12) * 4); ctx.lineTo(x + Math.cos(a - 0.12) * 14, y + Math.sin(a - 0.12) * 14); ctx.stroke();
        ctx.fillStyle = '#c4572e'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill();
      } else if (g.type === 'depot') {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 13, y - 7, 30, 18);
        [-7, 7].forEach(function (dx) {
          var gr = ctx.createRadialGradient(x + dx - 2, y - 2, 1, x + dx, y, 8);
          gr.addColorStop(0, hit ? '#fff' : '#9fd0c4'); gr.addColorStop(1, hit ? '#ddd' : '#3f7a6e');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x + dx, y, 7.5, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#2b5048'; ctx.lineWidth = 1; ctx.stroke();
        });
        ctx.fillStyle = '#ffd15e'; ctx.fillRect(x - 2, y - 1.5, 4, 3);
      } else {   // паровой катер (носом по курсу)
        var dir = g.vx >= 0 ? 1 : -1;
        ctx.strokeStyle = 'rgba(220,245,255,.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - dir * 20, y - 6); ctx.lineTo(x - dir * 40, y - 10 - Math.sin(t * 4) * 2); ctx.moveTo(x - dir * 20, y + 6); ctx.lineTo(x - dir * 40, y + 10 + Math.sin(t * 4) * 2); ctx.stroke();
        ctx.fillStyle = hit ? '#fff' : '#6b3e2a';
        ctx.beginPath(); ctx.moveTo(x + dir * 24, y); ctx.quadraticCurveTo(x + dir * 12, y - 10, x - dir * 18, y - 9); ctx.lineTo(x - dir * 20, y + 9); ctx.quadraticCurveTo(x + dir * 12, y + 10, x + dir * 24, y); ctx.fill();
        ctx.fillStyle = '#a77a52'; rr(ctx, x - 12, y - 5, 18, 10, 3); ctx.fill();
        ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.arc(x - dir * 2, y, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(200,200,205,.35)'; ctx.beginPath(); ctx.arc(x - dir * (8 + (t * 20 % 10)), y - 2, 4 + (t * 20 % 10) * 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d9d2c5'; ctx.beginPath(); ctx.arc(x + dir * 12, y, 3, 0, TAU); ctx.fill();
      }
    });
  }

  // ---------- Крейсер-кузня ----------
  function hullPath(ctx, x, y) {
    var hl = L.HULL_HL, hw = L.HULL_HW;
    ctx.beginPath();
    ctx.moveTo(x, y - hl);
    ctx.bezierCurveTo(x + hw * 0.7, y - hl + 40, x + hw, y - hl + 110, x + hw, y - 40);
    ctx.lineTo(x + hw, y + hl - 50);
    ctx.quadraticCurveTo(x + hw, y + hl, x, y + hl);
    ctx.quadraticCurveTo(x - hw, y + hl, x - hw, y + hl - 50);
    ctx.lineTo(x - hw, y - 40);
    ctx.bezierCurveTo(x - hw, y - hl + 110, x - hw * 0.7, y - hl + 40, x, y - hl);
    ctx.closePath();
  }
  function ship(ctx, B, S, t) {
    var x = B.x, y = B.y, i;
    ctx.save();
    if (B.sinking) { var k = B.sinkT / 2.6; ctx.globalAlpha = Math.max(0, k); ctx.translate(x, y); ctx.rotate((1 - k) * 0.12); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); ctx.translate(-x, -y); }
    // кильватер и тень
    ctx.fillStyle = 'rgba(220,245,255,.16)'; ctx.beginPath(); ctx.ellipse(x, y + 10, L.HULL_HW + 16, L.HULL_HL + 18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; hullPath(ctx, x + 8, y + 10); ctx.fill();
    // корпус
    var gr = ctx.createLinearGradient(x - L.HULL_HW, 0, x + L.HULL_HW, 0);
    gr.addColorStop(0, '#3f2a22'); gr.addColorStop(0.5, '#6e4634'); gr.addColorStop(1, '#3f2a22');
    ctx.fillStyle = gr; hullPath(ctx, x, y); ctx.fill();
    // палуба
    ctx.save(); ctx.translate(x, y); ctx.scale(0.82, 0.93); ctx.translate(-x, -y);
    ctx.fillStyle = '#8b7357'; hullPath(ctx, x, y); ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(60,40,28,.35)'; ctx.lineWidth = 1;
    for (var px = x - 60; px <= x + 60; px += 9) { ctx.beginPath(); ctx.moveTo(px, y - 200); ctx.lineTo(px, y + 200); ctx.stroke(); }
    ctx.fillStyle = 'rgba(150,70,40,.35)';   // ржавые пятна
    for (i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(x + (hash(i * 7 + 3) - 0.5) * 80, y + (hash(i * 11 + 5) - 0.5) * 320, 7 + hash(i) * 9, 4 + hash(i + 9) * 6, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    // горн посреди палубы
    var glow = 0.55 + 0.25 * Math.sin(t * 5);
    ctx.fillStyle = '#2a1d18'; rr(ctx, x - 16, y - 46, 32, 30, 6); ctx.fill();
    var fg = ctx.createRadialGradient(x, y - 31, 1, x, y - 31, 18); fg.addColorStop(0, 'rgba(255,230,140,' + glow + ')'); fg.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = fg; ctx.fillRect(x - 20, y - 50, 40, 38);
    ctx.fillStyle = 'rgba(255,140,50,' + glow + ')'; rr(ctx, x - 9, y - 36, 18, 10, 3); ctx.fill();
    // поручни
    ctx.strokeStyle = 'rgba(220,200,170,.35)'; ctx.lineWidth = 1.2; ctx.save(); ctx.translate(x, y); ctx.scale(0.9, 0.96); ctx.translate(-x, -y); hullPath(ctx, x, y); ctx.stroke(); ctx.restore();
    // трубы
    B.funnels.forEach(function (f, n) {
      var fx = x + f.dx, fy = y + f.dy;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(fx + 10, fy + 14, f.w / 2, f.h / 2 + 6, 0.3, 0, TAU); ctx.fill();
      // корпус трубы (цилиндр, видимый под углом) + рыжий пояс + чёрный зев
      var g2 = ctx.createLinearGradient(fx - f.w / 2, 0, fx + f.w / 2, 0); g2.addColorStop(0, '#2b2d33'); g2.addColorStop(0.45, '#6a6f7a'); g2.addColorStop(1, '#25272c');
      ctx.fillStyle = g2; rr(ctx, fx - f.w / 2, fy - 2, f.w, f.h / 2 + 12, f.w / 2); ctx.fill();
      ctx.fillStyle = '#b4532e'; ctx.fillRect(fx - f.w / 2, fy + 2, f.w, 4);
      ctx.fillStyle = '#7d828c'; ctx.beginPath(); ctx.ellipse(fx, fy - 2, f.w / 2, f.h / 2 - 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#121216'; ctx.beginPath(); ctx.ellipse(fx, fy - 2, f.w / 2 - 4, f.h / 2 - 6, 0, 0, TAU); ctx.fill();
      if (!B.sinking) for (var q = 0; q < 4; q++) {   // дым
        var ph = (t * 0.7 + q / 4 + n * 0.37) % 1;
        ctx.fillStyle = 'rgba(70,70,78,' + (0.5 * (1 - ph)).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(fx + ph * 30 + Math.sin(ph * 6 + q) * 4, fy + ph * 60, 7 + ph * 14, 0, TAU); ctx.fill();
      }
    });
    // турели
    B.turrets.forEach(function (tu) {
      var tx = x + tu.dx, ty = y + tu.dy, big = tu.kind === 'twin', r = big ? 13 : 11;
      if (!tu.alive) {
        ctx.fillStyle = '#1d1512'; ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,40,' + (0.35 + 0.25 * Math.sin(t * 10 + tx)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, TAU); ctx.fill();
        return;
      }
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(tx + 3, ty + 4, r + 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a3d45'; ctx.beginPath(); ctx.arc(tx, ty, r + 2, 0, TAU); ctx.fill();
      if (!B.anchored) {   // броне-колпак
        var cg = ctx.createRadialGradient(tx - 3, ty - 3, 1, tx, ty, r); cg.addColorStop(0, '#9aa1ad'); cg.addColorStop(1, '#4a4f59');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a2d33'; for (var b = 0; b < 4; b++) { ctx.beginPath(); ctx.arc(tx + Math.cos(b * TAU / 4 + 0.6) * (r - 3), ty + Math.sin(b * TAU / 4 + 0.6) * (r - 3), 1.4, 0, TAU); ctx.fill(); }
        return;
      }
      var hot = tu.flash > 0;
      ctx.strokeStyle = hot ? '#fff' : '#22242a'; ctx.lineWidth = big ? 3.6 : 4; ctx.lineCap = 'round';
      var a = tu.aim, offs = big ? [-0.2, 0, 0.2] : [0];
      ctx.beginPath();
      offs.forEach(function (o) { var nx = Math.cos(a + Math.PI / 2) * o * 22, ny = Math.sin(a + Math.PI / 2) * o * 22; ctx.moveTo(tx + nx, ty + ny); ctx.lineTo(tx + nx + Math.cos(a) * (r + 10), ty + ny + Math.sin(a) * (r + 10)); });
      ctx.stroke();
      var tg = ctx.createRadialGradient(tx - 3, ty - 3, 1, tx, ty, r);
      tg.addColorStop(0, hot ? '#ffffff' : '#d07a4a'); tg.addColorStop(1, hot ? '#ffd0a0' : '#7a3a22');
      ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(tx, ty, 2.5, 0, TAU); ctx.fill();
      var f = tu.hp / tu.max;   // мини-полоска прочности
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(tx - 12, ty + r + 4, 24, 3);
      ctx.fillStyle = f > 0.5 ? '#ffc04d' : '#ff5d6c'; ctx.fillRect(tx - 12, ty + r + 4, 24 * f, 3);
    });
    if (B.sinking) {
      ctx.fillStyle = 'rgba(220,245,255,.5)';
      for (i = 0; i < 14; i++) { var bp = (t * 1.3 + i / 14) % 1; ctx.beginPath(); ctx.arc(x + (hash(i * 5) - 0.5) * 110, y + (hash(i * 9) - 0.5) * 340 - bp * 10, 2 + bp * 4, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  // ---------- Воздух ----------
  function bird(ctx, e, t) {   // механическая птица: латунная тушка, крылья-шестерни, красный глаз; летит вниз
    var x = e.x, y = e.y, flap = Math.sin(t * 12 + e.x * 0.05), hit = e.flash > 0;
    var body = hit ? '#ffffff' : e.red ? '#d84a3a' : '#b0703c', wing = hit ? '#ffffff' : e.red ? '#ff7a5a' : '#c9925a', dark = e.red ? '#6a1c14' : '#5a3418';
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x + 12, y + 18, 13, 5, 0, 0, TAU); ctx.fill();
    var span = 12 + flap * 3;
    [-1, 1].forEach(function (s) {
      ctx.fillStyle = wing;
      ctx.beginPath(); ctx.moveTo(x + s * 3, y - 4); ctx.lineTo(x + s * (span + 3), y - 8 + flap * 2); ctx.lineTo(x + s * (span + 1), y - 2 + flap * 2); ctx.lineTo(x + s * 4, y + 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.beginPath();
      for (var k = 1; k < 3; k++) { ctx.moveTo(x + s * (3 + k * 4), y - 4 - k * 0.5 + flap * k * 0.6); ctx.lineTo(x + s * (3 + k * 4), y + 1); }
      ctx.stroke();
    });
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x, y, 5, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(x - 3, y - 8); ctx.lineTo(x, y - 14); ctx.lineTo(x + 3, y - 8); ctx.fill();   // хвост
    ctx.fillStyle = '#e8d6a8'; ctx.beginPath(); ctx.moveTo(x - 2, y + 7); ctx.lineTo(x, y + 13); ctx.lineTo(x + 2, y + 7); ctx.fill();   // клюв
    ctx.fillStyle = '#ff3d3d'; ctx.beginPath(); ctx.arc(x, y + 3, 1.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y - 2, 2.6, 0, TAU); ctx.stroke();
  }
  function swift(ctx, e, t) {   // стальной стриж-дротик, носом по курсу
    var a = Math.atan2(e.vy, e.vx), hit = e.flash > 0;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a - Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.moveTo(10, 14); ctx.lineTo(24, 8); ctx.lineTo(14, 26); ctx.fill();
    ctx.fillStyle = hit ? '#fff' : '#7f93a8';
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(13, -8); ctx.lineTo(4, -4); ctx.lineTo(0, -12); ctx.lineTo(-4, -4); ctx.lineTo(-13, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hit ? '#fff' : '#c7d3df'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(3, -4); ctx.lineTo(-3, -4); ctx.fill();
    ctx.fillStyle = '#ff6a3a'; ctx.beginPath(); ctx.arc(0, -10, 2.2 + Math.sin(t * 30) * 0.8, 0, TAU); ctx.fill();   // факел сопла
    ctx.restore();
  }
  function blimp(ctx, e, t) {   // латаный ржавый дирижабль, гондола и два винта
    var x = e.x, y = e.y, hit = e.flash > 0, rx = L.BLIMP.rx, ry = L.BLIMP.ry;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x + 22, y + 34, rx, ry, 0, 0, TAU); ctx.fill();
    var gr = ctx.createLinearGradient(0, y - ry, 0, y + ry);
    gr.addColorStop(0, hit ? '#fff' : '#d0875a'); gr.addColorStop(0.55, hit ? '#fff' : '#9a5534'); gr.addColorStop(1, hit ? '#ddd' : '#5c301e');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,28,16,.6)'; ctx.lineWidth = 1;
    for (var k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(x + k * 12, y, 3 + Math.abs(k) * 0.5, ry - 1, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120,140,90,.55)'; rr(ctx, x - 20, y - 9, 11, 7, 2); ctx.fill(); rr(ctx, x + 12, y + 1, 9, 6, 2); ctx.fill();   // заплаты
    ctx.fillStyle = '#5c301e'; [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(x - rx + 4, y + s * 4); ctx.lineTo(x - rx - 10, y + s * 13); ctx.lineTo(x - rx + 10, y + s * 6); ctx.fill(); });   // оперение
    ctx.fillStyle = '#3a2a24'; rr(ctx, x - 12, y + ry - 4, 24, 9, 3); ctx.fill();
    ctx.fillStyle = '#ffcf6a'; for (var w = 0; w < 4; w++) ctx.fillRect(x - 9 + w * 5.5, y + ry - 1, 3, 3);
    ctx.fillStyle = 'rgba(220,220,220,.4)'; [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.ellipse(x + s * 18, y + ry + 4, 6, 1.6 + Math.abs(Math.sin(t * 25)) * 1.2, 0, 0, TAU); ctx.fill(); });
    var f = e.hp / e.max; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 20, y - ry - 8, 40, 3); ctx.fillStyle = '#ffc04d'; ctx.fillRect(x - 20, y - ry - 8, 40 * f, 3);
  }

  // ---------- Самолёты ----------
  var OWN = { wing: '#ff8a3d', wing2: '#d96a22', stripe: '#fff1d6', body: '#c9a24a', body2: '#7a5a20' };
  var MATE = { wing: '#3fc1b0', wing2: '#2a8f84', stripe: '#e8fff9', body: '#a9b4be', body2: '#5a6570' };
  // Паролёт: биплан сверху, нос вверх. lift — подъём при петле, flip — cos фазы петли (−1 — вверх брюхом)
  function plane(ctx, x, y, s, C, bank, t, flip, shadow) {
    flip = flip == null ? 1 : flip;
    if (shadow) { ctx.fillStyle = 'rgba(0,0,0,' + (0.22 * shadow).toFixed(2) + ')'; ctx.save(); ctx.translate(x + 16 * s, y + 24 * s); ctx.scale(s * 0.9, s * Math.max(0.2, Math.abs(flip)) * 0.9); rr(ctx, -22, -5, 44, 9, 4); ctx.fill(); ctx.fillRect(-3, -16, 6, 32); rr(ctx, -9, 12, 18, 5, 2); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 - Math.abs(bank) * 0.12), s * flip);
    var under = flip < 0;
    // нижнее крыло
    ctx.fillStyle = under ? C.wing2 : C.wing2; rr(ctx, -17, 3, 34, 7, 3.5); ctx.fill();
    // фюзеляж-котёл
    var gr = ctx.createLinearGradient(-5, 0, 5, 0); gr.addColorStop(0, C.body2); gr.addColorStop(0.5, C.body); gr.addColorStop(1, C.body2);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 17, 0, 0, TAU); ctx.fill();
    // хвостовое оперение
    ctx.fillStyle = C.wing; rr(ctx, -9, 12, 18, 5, 2.5); ctx.fill();
    ctx.fillStyle = C.body2; ctx.fillRect(-1, 10, 2, 9);
    // верхнее крыло
    ctx.fillStyle = under ? C.wing2 : C.wing; rr(ctx, -23, -7, 46, 10, 5); ctx.fill();
    ctx.fillStyle = C.stripe; ctx.fillRect(-19, -3.2, 6, 2.4); ctx.fillRect(13, -3.2, 6, 2.4);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-23, 1, 46, 2);
    // стойки
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-14, 1, 2, 4); ctx.fillRect(12, 1, 2, 4);
    // труба котла и кабина
    if (!under) {
      ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.arc(0, -10, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#20303a'; ctx.beginPath(); ctx.ellipse(0, 6, 3, 4, 0, 0, TAU); ctx.fill();
    }
    // винт
    ctx.fillStyle = 'rgba(230,230,230,.5)'; ctx.beginPath(); ctx.ellipse(0, -18, 9, 1.8 + Math.abs(Math.sin(t * 40)) * 1.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(0, -17, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function steam(ctx, x, y, t) {   // пар из котла
    for (var q = 0; q < 3; q++) { var ph = (t * 2.2 + q / 3) % 1; ctx.fillStyle = 'rgba(240,240,245,' + (0.32 * (1 - ph)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x + Math.sin(ph * 5 + q) * 2, y + 8 + ph * 26, 2 + ph * 4, 0, TAU); ctx.fill(); }
  }
  function players(ctx, S, t) {
    var Pl = S.player;
    if (Pl.dead) return;
    var blink = Pl.grace > 0 && Pl.loopT <= 0 && Math.floor(t * 14) % 2;
    var lp = Pl.loopT > 0 ? 1 - Pl.loopT / L.LOOP_T : 0, flip = Math.cos(lp * TAU), lift = Math.sin(lp * Math.PI), sc = 1 + 0.28 * lift;
    for (var i = 0; i < 2; i++) if (Pl.wing[i]) {
      var wy = Pl.wy[i] - lift * 22;
      steam(ctx, Pl.wx[i], wy - 6, t + i);
      plane(ctx, Pl.wx[i], wy, 0.74 * sc, MATE, Pl.bank, t + i * 0.3, flip, 1 - lift * 0.6);
    }
    if (blink) return;
    var y = Pl.y - lift * 28;
    if (lp > 0) {   // след петли
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(Pl.x, Pl.y - 16, 10, 26, 0, -Math.PI / 2, -Math.PI / 2 + lp * TAU); ctx.stroke();
    }
    steam(ctx, Pl.x, y - 8, t);
    plane(ctx, Pl.x, y, sc, OWN, Pl.bank, t, flip, 1 - lift * 0.6);
  }

  // ---------- Пули, бонусы, эффекты ----------
  function shots(ctx, S) {
    ctx.save(); ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 6;
    S.shots.forEach(function (s) { ctx.fillStyle = s.wing ? '#bdfcf0' : '#fff2a8'; rr(ctx, s.x - 1.6, s.y - 6, 3.2, 12, 1.6); ctx.fill(); });
    ctx.restore();
  }
  function bullets(ctx, S, t) {
    S.bullets.forEach(function (b) {
      if (b.kind === 'flak') {
        ctx.fillStyle = 'rgba(255,230,150,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a4a10'; ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, TAU); ctx.fill();
      } else if (b.kind === 'shell') {
        ctx.fillStyle = 'rgba(255,60,60,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, 7.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(b.x, b.y, 4.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe0d0'; ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,120,60,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8a4a'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff1e0'; ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, TAU); ctx.fill();
      }
    });
  }
  var PK = { fuel: '#5fe0a0', wing: '#3fc1b0', loop: '#c08cff', power: '#ff8a3d' };
  function pkIcon(ctx, kind, x, y, s, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
    if (kind === 'fuel') { ctx.beginPath(); ctx.moveTo(x, y - 7 * s); ctx.quadraticCurveTo(x + 6 * s, y + 1 * s, x, y + 6 * s); ctx.quadraticCurveTo(x - 6 * s, y + 1 * s, x, y - 7 * s); ctx.fill(); }
    else if (kind === 'wing') { [-6, 0, 6].forEach(function (dx, i) { var yy = y + (i === 1 ? -3 : 3) * s; ctx.beginPath(); ctx.moveTo(x + dx * s - 3 * s, yy + 2 * s); ctx.lineTo(x + dx * s, yy - 2 * s); ctx.lineTo(x + dx * s + 3 * s, yy + 2 * s); ctx.stroke(); }); }
    else if (kind === 'loop') { ctx.beginPath(); ctx.arc(x, y, 5.5 * s, -Math.PI * 0.2, Math.PI * 1.45); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 5 * s, y - 6 * s); ctx.lineTo(x + 6 * s, y - 1 * s); ctx.lineTo(x + 1 * s, y - 2 * s); ctx.fill(); }
    else { ctx.fillRect(x - 5 * s, y - 6 * s, 3.5 * s, 12 * s); ctx.fillRect(x + 1.5 * s, y - 6 * s, 3.5 * s, 12 * s); }
  }
  function pickups(ctx, S, t) {
    S.pickups.forEach(function (q) {
      var pulse = 1 + 0.08 * Math.sin(t * 6 + q.x), col = PK[q.kind];
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(12,18,30,.85)'; ctx.beginPath(); ctx.arc(q.x, q.y, 13 * pulse, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 13 * pulse, 0, TAU); ctx.stroke();
      pkIcon(ctx, q.kind, q.x, q.y, 1, col);
    });
  }
  function fxDraw(ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var f = list[i], k = 1 - f.t / f.life;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.shadowColor = f.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(f.x, f.y, 4 + k * f.r, 0, TAU); ctx.stroke();
      if (k < 0.35) { ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(f.x, f.y, (0.35 - k) * f.r * 0.6, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }

  function draw(ctx, S, g, o) {
    o = o || {}; var t = S.time;
    sea(ctx, S); land(ctx, S);
    ground(ctx, S, t);
    if (S.boss && S.boss.alive) ship(ctx, S.boss, S, t);
    pickups(ctx, S, t);
    S.air.forEach(function (e) { if (e.alive && e.type === 'blimp') blimp(ctx, e, t); });
    clouds(ctx, S);
    S.air.forEach(function (e) { if (!e.alive) return; if (e.type === 'bird') bird(ctx, e, t); else if (e.type === 'swift') swift(ctx, e, t); });
    shots(ctx, S);
    players(ctx, S, t);
    bullets(ctx, S, t);
    if (o.fx) fxDraw(ctx, o.fx);
    if (o.bare) return;
    E.ui.hud(g, ctx, S, P, E.modern);
    E.ui.banner(g, ctx, S, P);
    if (o.toasts) E.ui.toasts(g, ctx, o.toasts, P);
  }

  function lifeIcon(ctx, x, y, on) {
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.28; plane(ctx, x, y, 0.42, OWN, 0, 0, 1, 0); ctx.restore();
  }
  function loopIcon(ctx, x, y, on) { ctx.save(); ctx.globalAlpha = on ? 1 : 0.25; pkIcon(ctx, 'loop', x, y, 0.85, PK.loop); ctx.restore(); }
  function wingIcon(ctx, x, y, on) { ctx.save(); ctx.globalAlpha = on ? 1 : 0.22; plane(ctx, x, y, 0.32, MATE, 0, 0, 1, 0); ctx.restore(); }

  E.modern = { P: P, draw: draw, lifeIcon: lifeIcon, loopIcon: loopIcon, wingIcon: wingIcon, plane: plane, OWN: OWN, MATE: MATE, PK: PK, pkIcon: pkIcon };
})(typeof window !== 'undefined' ? window : globalThis);
