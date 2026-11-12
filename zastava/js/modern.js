/* ЗАСТАВА · рендер MODERN (по умолчанию). ZASTAVA.modern = { P, bg, draw, lifeIcon }
   Ночь над заставой мастерской: небо с дымкой, силуэты цехов и труб, каменный вал.
   Противники — ржавые механизмы-паразиты (гайка-клещ, шестерня, сверло) с кислотно-зелёными «глазами»,
   коршуны из пластин со щитом-крыльями, матка с конвейерным поясом и горном-ядром.
   Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var Z = global.ZASTAVA = global.ZASTAVA || {};
  var L = Z.logic, TAU = Math.PI * 2;

  var P = {
    pixel: false, font: null,
    hudBg: 'rgba(10,11,20,.92)', hudLine: '#2a2438', ink: '#f1ece6', muted: '#a49cae', accent: '#ff8a3d',
    good: '#5fe0a0', bad: '#ff5d6c', panel: '#17141f', bar: '#2c2638', bossBar: '#ff6a2a',
    eye: '#c4ff5a', eyeGlow: 'rgba(196,255,90,.55)',
    tick: ['#7a3416', '#b85a2a', '#e08a4c'], gear: ['#7a5a17', '#c99432', '#f2c96a'], drill: ['#1f5a55', '#3f9a8c', '#86d8c6'],
    steel: ['#3b4049', '#7a828d', '#c3cad3'], shield: '#62b8ff'
  };
  var rr = function (ctx, x, y, w, h, r) { Z.ui.roundRect(ctx, x, y, w, h, r); };

  // ---------- Фон (кэш) ----------
  var cache = null;
  function buildBg(W, H) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#080a16'); gr.addColorStop(0.55, '#121027'); gr.addColorStop(0.86, '#2a1a2c'); gr.addColorStop(1, '#3a2024');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // звёзды (детерминированно)
    var s = 7; function rnd() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }
    for (var i = 0; i < 90; i++) {
      var sx = rnd() * W, sy = 50 + rnd() * 430, a = 0.15 + rnd() * 0.5, r = rnd() < 0.12 ? 1.4 : 0.8;
      x.fillStyle = 'rgba(220,225,255,' + a.toFixed(2) + ')'; x.beginPath(); x.arc(sx, sy, r, 0, TAU); x.fill();
    }
    // ржавая дымка у горизонта
    var hz = x.createRadialGradient(W / 2, H - 40, 20, W / 2, H - 40, W * 0.8);
    hz.addColorStop(0, 'rgba(255,120,50,.20)'); hz.addColorStop(1, 'rgba(255,120,50,0)');
    x.fillStyle = hz; x.fillRect(0, 0, W, H);
    // силуэт мастерской: цеха, трубы, кран
    x.fillStyle = '#16111f';
    var base = L.GROUND_Y;
    var blocks = [[0, 40, 18], [36, 70, 30], [100, 40, 20], [138, 60, 34], [196, 88, 24], [282, 54, 38], [334, 64, 22], [396, 84, 30]];
    blocks.forEach(function (b) { x.fillRect(b[0], base - b[2], b[1], b[2]); });
    [[60, 14, 52], [150, 10, 62], [300, 12, 66], [430, 12, 54]].forEach(function (t) { x.fillRect(t[0], base - t[2], t[1], t[2]); x.fillRect(t[0] - 2, base - t[2], t[1] + 4, 5); });
    x.fillRect(216, base - 64, 4, 40); x.fillRect(216, base - 64, 62, 3); x.fillRect(274, base - 64, 2, 16);   // кран
    // окна с тёплым светом
    s = 21;
    blocks.forEach(function (b) {
      for (var wy = base - b[2] + 8; wy < base - 8; wy += 11) for (var wx = b[0] + 6; wx < b[0] + b[1] - 6; wx += 12)
        if (rnd() < 0.3) { x.fillStyle = rnd() < 0.7 ? 'rgba(255,170,80,.35)' : 'rgba(255,220,150,.5)'; x.fillRect(wx, wy, 4, 4); }
    });
    // вал заставы
    var gv = x.createLinearGradient(0, base, 0, H); gv.addColorStop(0, '#4a3a34'); gv.addColorStop(1, '#231a19');
    x.fillStyle = gv; x.fillRect(0, base, W, H - base);
    x.fillStyle = '#ff8a3d'; x.globalAlpha = 0.85; x.fillRect(0, base, W, 2); x.globalAlpha = 1;
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1;
    for (var yy = base + 8, row = 0; yy < H; yy += 8, row++) {
      x.beginPath(); x.moveTo(0, yy + 0.5); x.lineTo(W, yy + 0.5); x.stroke();
      for (var xx = (row % 2) * 14; xx < W; xx += 28) { x.beginPath(); x.moveTo(xx + 0.5, yy - 8); x.lineTo(xx + 0.5, yy); x.stroke(); }
    }
    return c;
  }
  function bg(ctx, g) { if (!cache) cache = buildBg(g.W, g.H); ctx.drawImage(cache, 0, 0); }

  function grad(ctx, y0, y1, c) { var gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c[2]); gr.addColorStop(0.5, c[1]); gr.addColorStop(1, c[0]); return gr; }
  function eye(ctx, x, y, r, t) {
    ctx.save(); ctx.shadowColor = P.eyeGlow; ctx.shadowBlur = 8;
    ctx.fillStyle = P.eye; ctx.beginPath(); ctx.arc(x, y, r * (0.9 + 0.1 * Math.sin(t * 6)), 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#1b2a0a'; ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, TAU); ctx.fill();
  }

  // ---------- Паразиты строя (26×18) ----------
  function tick(ctx, x, y, f, t) {   // гайка-клещ: шестигранная гайка на ножках-поршнях
    ctx.strokeStyle = P.tick[0]; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    var sp = f ? 3 : 0;
    [-1, 1].forEach(function (s) {
      ctx.moveTo(x + s * 6, y + 3); ctx.lineTo(x + s * (10 + sp), y + 9);
      ctx.moveTo(x + s * 3, y + 5); ctx.lineTo(x + s * (5 - sp * 0.5), y + 9);
    });
    ctx.stroke();
    ctx.fillStyle = grad(ctx, y - 8, y + 6, P.tick);
    ctx.beginPath();
    for (var i = 0; i < 6; i++) { var a = i * TAU / 6; ctx.lineTo(x + Math.cos(a) * 11, y - 1 + Math.sin(a) * 7.5); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,180,.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#2a120a'; ctx.beginPath(); ctx.arc(x, y - 1, 4.4, 0, TAU); ctx.fill();
    eye(ctx, x, y - 1, 2.8, t);
  }
  function gear(ctx, x, y, f, t) {   // шестерня с клешнями
    var rot = f * Math.PI / 8;
    ctx.strokeStyle = P.gear[0]; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 2); ctx.quadraticCurveTo(x - 15, y + 2, x - 12, y + (f ? 8 : 5));
    ctx.moveTo(x + 8, y + 2); ctx.quadraticCurveTo(x + 15, y + 2, x + 12, y + (f ? 8 : 5));
    ctx.stroke();
    ctx.fillStyle = grad(ctx, y - 9, y + 9, P.gear);
    ctx.beginPath();
    for (var i = 0; i < 16; i++) { var a = rot + i * TAU / 16, r = i % 2 ? 6.6 : 9; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2a0c'; ctx.beginPath(); ctx.arc(x, y, 4.6, 0, TAU); ctx.fill();
    eye(ctx, x, y, 3, t);
  }
  function drill(ctx, x, y, f, t) {   // сверло: винт сверху, конус острием вниз
    var bw = f ? 11 : 6;
    ctx.fillStyle = P.steel[1]; ctx.fillRect(x - 1, y - 9, 2, 4);
    ctx.fillStyle = P.steel[2]; rr(ctx, x - bw, y - 10, bw * 2, 2.4, 1.2); ctx.fill();
    ctx.fillStyle = grad(ctx, y - 6, y + 9, P.drill);
    ctx.beginPath(); ctx.moveTo(x - 11, y - 5); ctx.lineTo(x + 11, y - 5); ctx.lineTo(x + 2, y + 9); ctx.lineTo(x - 2, y + 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(10,40,36,.75)'; ctx.lineWidth = 1.4;
    for (var k = 0; k < 3; k++) {
      var yy = y - 2 + k * 4 + (f ? 2 : 0), hw = 9 - (yy - y + 5) * 0.62;
      if (hw < 1) continue;
      ctx.beginPath(); ctx.moveTo(x - hw, yy - 1.5); ctx.lineTo(x + hw, yy + 1.5); ctx.stroke();
    }
    eye(ctx, x - 5, y - 3, 2.1, t); eye(ctx, x + 5, y - 3, 2.1, t + 1);
  }
  var ALIEN = { tick: tick, gear: gear, drill: drill };

  // ---------- Зонд (над строем) ----------
  function probe(ctx, p, t) {
    var x = p.x, y = p.y, bl = Math.abs(Math.sin(t * 22)) * 16 + 3;
    ctx.fillStyle = P.steel[2]; rr(ctx, x - bl, y - 12, bl * 2, 2.4, 1.2); ctx.fill();
    ctx.fillStyle = P.steel[1]; ctx.fillRect(x - 1, y - 11, 2, 4);
    ctx.fillStyle = grad(ctx, y - 8, y + 8, ['#4a1d14', '#8f3a22', '#cf6a3a']);
    ctx.beginPath(); ctx.ellipse(x, y, 21, 7.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(140,220,255,.65)'; ctx.beginPath(); ctx.ellipse(x, y - 5, 7, 4, 0, Math.PI, 0); ctx.fill();
    for (var i = -2; i <= 2; i++) {
      var on = (Math.floor(t * 8) + i + 5) % 3 === 0;
      ctx.fillStyle = on ? '#ffe36a' : '#5a2a14'; ctx.beginPath(); ctx.arc(x + i * 7, y + 1, 1.8, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#2a120a'; ctx.beginPath(); ctx.moveTo(x - 8, y + 6); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x + 3, y + 10); ctx.lineTo(x - 3, y + 10); ctx.fill();
  }

  // ---------- Коршун (40×26) ----------
  function bird(ctx, b, t) {
    var hit = b.flash > 0, dive = b.state === 'dive', x = 0, y = 0;
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1.2, 1.2);
    if (b.shield && !dive) {
      // крылья сомкнуты под корпусом: щит из пластин
      ctx.fillStyle = grad(ctx, y - 12, y + 6, P.steel); ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.lineTo(x + 6, y - 4); ctx.lineTo(x - 6, y - 4); ctx.fill();
      eye(ctx, x, y - 8, 2.2, t);
      // крылья сомкнуты в щит-«каплю» острием вниз
      [-1, 1].forEach(function (k) { ctx.fillStyle = '#7a3a1e'; ctx.beginPath(); ctx.moveTo(x + k * 6, y - 6); ctx.lineTo(x + k * 17, y - 9); ctx.lineTo(x + k * 15, y - 2); ctx.fill(); });
      var sh = ctx.createLinearGradient(0, y - 6, 0, y + 16);
      sh.addColorStop(0, hit ? '#ffffff' : '#a8dcff'); sh.addColorStop(1, hit ? '#cfe8ff' : '#2b5f9e');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(x - 14, y - 5); ctx.lineTo(x + 14, y - 5); ctx.quadraticCurveTo(x + 14, y + 8, x, y + 17); ctx.quadraticCurveTo(x - 14, y + 8, x - 14, y - 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20,40,80,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 15); ctx.moveTo(x - 12, y + 1); ctx.lineTo(x + 12, y + 1); ctx.moveTo(x - 9, y + 8); ctx.lineTo(x + 9, y + 8); ctx.stroke();
      ctx.shadowColor = P.shield; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(160,215,255,.9)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x - 14, y - 5); ctx.lineTo(x + 14, y - 5); ctx.quadraticCurveTo(x + 14, y + 8, x, y + 17); ctx.quadraticCurveTo(x - 14, y + 8, x - 14, y - 5); ctx.stroke();
      ctx.restore(); return;
    }
    var flap = Math.sin(t * (dive ? 16 : 7) + b.ph) * (dive ? 4 : 7);
    var wingC = hit ? ['#ffffff', '#ffffff', '#ffffff'] : ['#5b2a18', '#a8582e', '#e2a06a'];
    [-1, 1].forEach(function (s) {
      ctx.fillStyle = grad(ctx, y - 14, y + 6, wingC);
      ctx.beginPath();
      ctx.moveTo(x + s * 4, y - 4);
      ctx.lineTo(x + s * 13, y - 9 - flap);
      ctx.lineTo(x + s * 21, y - 6 - flap * 1.4);
      ctx.lineTo(x + s * 18, y - 1 - flap);
      ctx.lineTo(x + s * 14, y + 1 - flap * 0.6);
      ctx.lineTo(x + s * 10, y + 0 - flap * 0.3);
      ctx.lineTo(x + s * 4, y + 3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,14,6,.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + s * 13, y - 8 - flap); ctx.lineTo(x + s * 12, y + 0 - flap * 0.4); ctx.moveTo(x + s * 17, y - 6 - flap * 1.2); ctx.lineTo(x + s * 16, y - flap * 0.8); ctx.stroke();
    });
    // корпус-ромб, клюв вниз
    ctx.fillStyle = hit ? '#ffffff' : grad(ctx, y - 13, y + 13, P.steel);
    ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.lineTo(x + 6, y - 2); ctx.lineTo(x + 2, y + 12); ctx.lineTo(x - 2, y + 12); ctx.lineTo(x - 6, y - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb03a'; ctx.beginPath(); ctx.moveTo(x - 2, y + 9); ctx.lineTo(x + 2, y + 9); ctx.lineTo(x, y + 14); ctx.fill();
    if (b.hp < b.max) { ctx.strokeStyle = '#1a0d08'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 3, y - 6); ctx.lineTo(x + 1, y - 1); ctx.lineTo(x - 1, y + 4); ctx.stroke(); }
    eye(ctx, x, y - 5, 2.4, t);
    if (dive) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(x, y - 14, 4 + Math.sin(t * 30) * 1.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---------- Матка ----------
  function boss(ctx, B, t) {
    var x = B.x, y = B.y, R = B.rings[B.rings.length - 1].r2;
    // гондолы и корпус-купол
    ctx.fillStyle = grad(ctx, y - 11, y + 11, ['#2a1a16', '#5e3424', '#9a5a38']);
    rr(ctx, x - 104, y - 9, 208, 18, 9); ctx.fill();
    [-1, 1].forEach(function (s) {
      ctx.fillStyle = grad(ctx, y - 13, y + 13, P.steel); ctx.beginPath(); ctx.arc(x + s * 94, y, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff6a2a'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5 + s); ctx.beginPath(); ctx.arc(x + s * 94, y + 4, 3.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    });
    var dome = ctx.createLinearGradient(0, y - R - 28, 0, y - R + 8);
    dome.addColorStop(0, '#b06a3e'); dome.addColorStop(0.5, '#6e3a24'); dome.addColorStop(1, '#2e1812');
    ctx.fillStyle = dome; ctx.beginPath(); ctx.moveTo(x - 104, y - R + 6); ctx.quadraticCurveTo(x - 96, y - R - 28, x, y - R - 28); ctx.quadraticCurveTo(x + 96, y - R - 28, x + 104, y - R + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (var r = -3; r <= 3; r++) { ctx.beginPath(); ctx.arc(x + r * 26, y - R - 4 - (3 - Math.abs(r)) * 4, 2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = P.eye; ctx.globalAlpha = 0.7;
    for (var k = -2; k <= 2; k++) { ctx.fillRect(x + k * 18 - 4, y - R - 14 + Math.abs(k) * 2, 8, 2); }
    ctx.globalAlpha = 1;
    // пояса: пластины-звенья конвейера
    B.rings.forEach(function (g, gi) {
      var da = TAU / g.n;
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, g.r1, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, g.r2, 0, TAU); ctx.stroke();
      for (var j = 0; j < g.n; j++) {
        var hp = g.hp[j]; if (hp <= 0) continue;
        var a0 = g.rot + j * da + 0.04, a1 = g.rot + (j + 1) * da - 0.04;
        var c = hp >= g.max ? (gi === 0 && B.rings.length > 1 ? ['#24443f', '#4f8a7c', '#9fd8c4'] : P.steel) : ['#4a1c0e', '#9a4422', '#d47a44'];
        var gr = ctx.createRadialGradient(x, y, g.r1, x, y, g.r2); gr.addColorStop(0, c[0]); gr.addColorStop(0.5, c[2]); gr.addColorStop(1, c[1]);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, g.r2, a0, a1); ctx.arc(x, y, g.r1, a1, a0, true); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.45)'; var am = (a0 + a1) / 2, rm = (g.r1 + g.r2) / 2;
        ctx.beginPath(); ctx.arc(x + Math.cos(am) * rm, y + Math.sin(am) * rm, 1.4, 0, TAU); ctx.fill();
      }
    });
    // горн-ядро
    var pulse = 0.85 + 0.15 * Math.sin(t * 6), hot = B.flash > 0;
    ctx.save(); ctx.shadowColor = '#ff6a2a'; ctx.shadowBlur = 22 * pulse;
    var cg = ctx.createRadialGradient(x, y, 2, x, y, B.rc);
    cg.addColorStop(0, hot ? '#ffffff' : '#fff2b0'); cg.addColorStop(0.45, hot ? '#ffe0c0' : '#ffb03a'); cg.addColorStop(1, '#c2361a');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, B.rc * pulse, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(60,10,4,.85)'; ctx.beginPath(); ctx.ellipse(x, y, 3 + (1 - B.hp / B.max) * 5, 8, 0, 0, TAU); ctx.fill();
  }

  // ---------- Укрытия-наковальни ----------
  var ROWC = [];
  (function () { for (var r = 0; r < L.BK_R; r++) { var k = r / (L.BK_R - 1); ROWC.push('rgb(' + Math.round(176 - 82 * k) + ',' + Math.round(170 - 84 * k) + ',' + Math.round(178 - 78 * k) + ')'); } })();
  function bunkers(ctx, S) {
    var s = L.BK_S;
    S.bunkers.forEach(function (b) {
      for (var r = 0; r < L.BK_R; r++) {
        ctx.fillStyle = ROWC[r];
        for (var c = 0; c < L.BK_C; c++) if (b.cells[r * L.BK_C + c]) ctx.fillRect(b.x + c * s, b.y + r * s, s, s);
      }
      // отблеск горна на «наличи»
      ctx.fillStyle = 'rgba(255,150,80,.35)';
      for (var c2 = 0; c2 < L.BK_C; c2++) for (var r2 = 0; r2 < 3; r2++) if (b.cells[r2 * L.BK_C + c2]) { ctx.fillRect(b.x + c2 * s, b.y + r2 * s, s, 1); break; }
    });
  }

  // ---------- Лафет ----------
  function cannon(ctx, x, y, recoil, glow, scale) {
    ctx.save(); ctx.translate(x, y); if (scale) ctx.scale(scale, scale);
    if (!scale) { var ug = ctx.createRadialGradient(0, 4, 2, 0, 4, 30); ug.addColorStop(0, 'rgba(255,138,61,.32)'); ug.addColorStop(1, 'rgba(255,138,61,0)'); ctx.fillStyle = ug; ctx.fillRect(-32, -26, 64, 44); }
    ctx.fillStyle = '#23252c'; rr(ctx, -17, 2, 34, 8, 4); ctx.fill();
    ctx.fillStyle = '#5a606b'; for (var i = -12; i <= 12; i += 6) { ctx.beginPath(); ctx.arc(i, 6, 2.2, 0, TAU); ctx.fill(); }
    var bd = ctx.createLinearGradient(0, -6, 0, 3); bd.addColorStop(0, '#eef1f5'); bd.addColorStop(1, '#7d8490');
    ctx.fillStyle = bd; ctx.beginPath(); ctx.moveTo(-15, 3); ctx.lineTo(-11, -4); ctx.lineTo(11, -4); ctx.lineTo(15, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a3d'; ctx.fillRect(-11, -1, 22, 2);
    // башня-наковальня и ствол
    ctx.fillStyle = '#b4bbc5'; ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(-7, -9); ctx.lineTo(9, -9); ctx.lineTo(7, -4); ctx.closePath(); ctx.fill();
    var by = -17 + (recoil > 0 ? 3 : 0);
    ctx.fillStyle = '#d8dde4'; ctx.fillRect(-2.5, by, 5, -by - 8);
    ctx.fillStyle = '#3a3e46'; ctx.fillRect(-3.5, by, 7, 2.5);
    if (glow) { ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffd08a'; ctx.fillRect(-1.5, by - 1, 3, 2); }
    ctx.restore();
  }
  function lifeIcon(ctx, x, y, on) {
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.25; cannon(ctx, x, y, 0, false, 0.62); ctx.restore();
  }

  // ---------- Снаряды ----------
  function bullet(ctx, b, t) {
    var x = b.x, y = b.y;
    if (b.kind === 'spark') {
      ctx.save(); ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 6; ctx.strokeStyle = '#ffb45a'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      var w = Math.floor(t * 20 + x) % 2 ? 2.5 : -2.5;
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + w, y - 2); ctx.lineTo(x - w, y + 2); ctx.lineTo(x, y + 6); ctx.stroke(); ctx.restore();
    } else if (b.kind === 'drill') {
      ctx.save(); ctx.shadowColor = P.eyeGlow; ctx.shadowBlur = 6;
      ctx.fillStyle = '#86d8c6'; ctx.beginPath(); ctx.moveTo(x - 3, y - 7); ctx.lineTo(x + 3, y - 7); ctx.lineTo(x, y + 8); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#1f5a55'; ctx.lineWidth = 1; var o = (t * 40) % 4;
      for (var k = -6 + o; k < 4; k += 4) { ctx.beginPath(); ctx.moveTo(x - 2.5, y + k); ctx.lineTo(x + 2.5, y + k + 2); ctx.stroke(); }
    } else if (b.kind === 'bomb') {
      ctx.fillStyle = '#2b2730'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8b8496'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = Math.floor(t * 10) % 2 ? '#ff5d3a' : '#ffd15e'; ctx.beginPath(); ctx.arc(x, y - 5, 1.6, 0, TAU); ctx.fill();
    } else {
      ctx.save(); ctx.shadowColor = '#ff3d6a'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe0e8'; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.fill(); ctx.restore();
    }
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
    bg(ctx, g);
    // строй
    if (S.fleet) {
      var F = S.fleet;
      for (var i = 0; i < F.aliens.length; i++) {
        var a = F.aliens[i]; if (!a.alive) continue;
        var x = F.x + a.c * L.CW + L.CW / 2, y = F.y + a.r * L.CH + L.CH / 2;
        ALIEN[a.type](ctx, x, y, F.frame, t + a.c * 0.3);
      }
    }
    if (S.probe) probe(ctx, S.probe, t);
    if (S.boss && S.boss.alive) boss(ctx, S.boss, t);
    S.birds.forEach(function (b) { if (b.alive && b.state === 'form') bird(ctx, b, t); });
    bunkers(ctx, S);
    S.birds.forEach(function (b) { if (b.alive && b.state === 'dive') bird(ctx, b, t); });
    // выстрел лафета
    if (S.shot) {
      ctx.save(); ctx.shadowColor = '#ffd08a'; ctx.shadowBlur = 8; ctx.fillStyle = '#fff4d6'; rr(ctx, S.shot.x - 1.5, S.shot.y - 6, 3, 12, 1.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,138,61,.35)'; ctx.fillRect(S.shot.x - 1, S.shot.y + 6, 2, 10); ctx.restore();
    }
    S.bullets.forEach(function (b) { bullet(ctx, b, t); });
    // лафет
    var Pl = S.player;
    if (!Pl.dead) { if (!(Pl.grace > 0 && Math.floor(t * 12) % 2)) cannon(ctx, Pl.x, L.PLAYER_Y, Pl.recoil, !S.shot); }
    else if (S.phase === 'dead') {
      ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = '#2a2a30';
      for (var k = 0; k < 6; k++) { var a2 = k * 1.1 + t; ctx.fillRect(Pl.x + Math.cos(a2) * 10 - 3, L.PLAYER_Y + 4 - Math.abs(Math.sin(a2)) * 6, 6, 3); }
      ctx.fillStyle = 'rgba(255,120,50,' + (0.4 + 0.3 * Math.sin(t * 20)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(Pl.x, L.PLAYER_Y + 2, 7, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (o.fx) fxDraw(ctx, o.fx);
    if (o.bare) return;
    Z.ui.hud(g, ctx, S, P, lifeIcon);
    Z.ui.banner(g, ctx, S, P);
    if (o.toasts) Z.ui.toasts(g, ctx, o.toasts, P);
  }

  Z.modern = { P: P, bg: bg, draw: draw, lifeIcon: lifeIcon, alien: ALIEN, bird: bird, cannon: cannon };
})(typeof window !== 'undefined' ? window : globalThis);
