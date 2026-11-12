/* СПУТНИК · рендер MODERN (по умолчанию). SPUTNIK.modern = { P, bg, draw, lifeIcon, ship, drone }
   Глубокий космос с двумя слоями звёзд и тёплой туманностью; рельеф — тёмная порода с раскалённой
   кромкой (свой оттенок у каждого уровня). Корабль «Горн» — бронзовый клин с калёным резцом на носу;
   дрон «Наковальня» — раскалённый кованый шар с клёпаным ободом; оптики — стеклянные ромбы.
   Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK = global.SPUTNIK || {};
  var L = Sp.logic, TAU = Math.PI * 2;

  var P = {
    pixel: false, font: null,
    hudBg: 'rgba(8,9,18,.9)', hudLine: '#2a2640', ink: '#f1ece6', muted: '#a49cae', accent: '#ff8a3d',
    good: '#5fe0a0', bad: '#ff5d6c', panel: '#15131f', panelA: 'rgba(21,19,31,.94)', bar: '#2c2638', bossBar: '#ff5a3a', charge: '#7fd4ff'
  };
  // Рельеф уровней: [верх породы, низ породы, кромка, прожилки]
  var ROCK = {
    orbit: ['#3c4152', '#1c1f2c', '#ffb46a', '#555c72'], slag: ['#41291f', '#1a0f0b', '#ff7a2a', '#6a3a26'],
    gears: ['#323946', '#141922', '#ffd060', '#4b5566'], channel: ['#2e2c31', '#111013', '#ff5a1f', '#4a3c36'],
    hive: ['#3c2438', '#190d18', '#ec6aa2', '#5a3452'], heart: ['#43161b', '#190608', '#ff4040', '#6a2228']
  };
  var CAPCOL = Sp.ui.CAPCOL;

  // ---------- Фон ----------
  var stars = null, neb = {};
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function buildStars() {
    stars = [];
    for (var i = 0; i < 140; i++) stars.push({ x: hash(i) * 1280, y: L.TOP + hash(i + 500) * (L.H - L.TOP), z: hash(i + 900) < 0.7 ? 0.15 : 0.4, a: 0.25 + hash(i + 77) * 0.6, r: hash(i + 33) < 0.1 ? 1.5 : 0.9 });
  }
  function nebula(name, W, H) {
    if (neb[name]) return neb[name];
    var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
    var gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#05060f'); gr.addColorStop(0.6, '#0b0b1c'); gr.addColorStop(1, '#140c18');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    var tint = ROCK[name][2];
    [[0.25, 0.35, 0.55], [0.75, 0.6, 0.45]].forEach(function (n, i) {
      var rg = x.createRadialGradient(W * n[0], H * n[1], 10, W * n[0], H * n[1], W * n[2]);
      rg.addColorStop(0, hexA(i ? '#6a5cff' : tint, 0.13)); rg.addColorStop(1, hexA(tint, 0));
      x.fillStyle = rg; x.fillRect(0, 0, W, H);
    });
    neb[name] = c; return c;
  }
  function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function bg(ctx, g, S) {
    var name = S && S.name ? S.name : 'orbit', cx = S ? S.cx : g.time * 40;
    ctx.drawImage(nebula(name, g.W, g.H), 0, 0);
    if (!stars) buildStars();
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], x = ((s.x - cx * s.z) % 1280 + 1280) % 1280; if (x > g.W) continue;
      ctx.fillStyle = 'rgba(225,230,255,' + s.a + ')'; ctx.fillRect(x, s.y, s.r * (s.z > 0.3 ? 2.2 : 1), s.r);
    }
  }

  // ---------- Рельеф и механизмы ----------
  function terrain(ctx, S, game) {
    var R = ROCK[S.name], cx = S.cx, x0 = Math.floor((cx - 16) / 8) * 8, x1 = cx + L.W + 16, x;
    var C = function (xx) { return game ? game._ceilY(xx) : L.TOP; }, F = function (xx) { return game ? game._floorY(xx) : L.H; };
    // потолок
    var gc = ctx.createLinearGradient(0, L.TOP, 0, L.TOP + 120); gc.addColorStop(0, R[1]); gc.addColorStop(1, R[0]);
    var gf = ctx.createLinearGradient(0, L.H - 120, 0, L.H); gf.addColorStop(0, R[0]); gf.addColorStop(1, R[1]);
    ctx.beginPath(); ctx.moveTo(x0 - cx, L.TOP - 2);
    for (x = x0; x <= x1; x += 8) ctx.lineTo(x - cx, C(x));
    ctx.lineTo(x1 - cx, L.TOP - 2); ctx.closePath(); ctx.fillStyle = gc; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x0 - cx, L.H + 2);
    for (x = x0; x <= x1; x += 8) ctx.lineTo(x - cx, F(x));
    ctx.lineTo(x1 - cx, L.H + 2); ctx.closePath(); ctx.fillStyle = gf; ctx.fill();
    // прожилки и вкрапления
    ctx.fillStyle = R[3];
    for (x = x0; x <= x1; x += 8) {
      var i = x / 8, h = hash(i), cy = C(x), fy = F(x);
      if (h < 0.22 && cy - L.TOP > 14) ctx.fillRect(x - cx, cy - 6 - h * 30, 3, 2);
      if (h > 0.78 && L.H - fy > 14) ctx.fillRect(x - cx, fy + 6 + (1 - h) * 30, 3, 2);
    }
    // раскалённая кромка
    ctx.save(); ctx.shadowColor = R[2]; ctx.shadowBlur = 8; ctx.strokeStyle = R[2]; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.9;
    ctx.beginPath(); var on = false;
    for (x = x0; x <= x1; x += 8) { var y = C(x); if (y > L.TOP + 1) { if (!on) { ctx.moveTo(x - cx, y); on = true; } else ctx.lineTo(x - cx, y); } else on = false; }
    ctx.stroke();
    ctx.beginPath();
    for (x = x0; x <= x1; x += 8) { if (x === x0) ctx.moveTo(x - cx, F(x)); else ctx.lineTo(x - cx, F(x)); }
    ctx.stroke(); ctx.restore();
  }
  function mechs(ctx, S, game) {
    var R = ROCK[S.name];
    S.lv.mechs.forEach(function (m) {
      var sx = m.x - S.cx; if (sx < -60 || sx > L.W + 60) return;
      var gm = game._mechRects(m);
      if (m.kind === 'piston') {
        var x = gm.x0 - S.cx, w = gm.x1 - gm.x0, y0 = Math.max(L.TOP, gm.y0), y1 = Math.min(L.H, gm.y1);
        var gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#4b525e'); gr.addColorStop(0.45, '#aab3c0'); gr.addColorStop(1, '#3a3f49');
        ctx.fillStyle = gr; ctx.fillRect(x + 4, y0, w - 8, y1 - y0);
        // торец-боёк с полосами опасности
        var ty = m.side === 'c' ? y1 - 10 : y0;
        ctx.fillStyle = '#2a2d33'; ctx.fillRect(x, ty, w, 10);
        ctx.save(); ctx.beginPath(); ctx.rect(x, ty, w, 10); ctx.clip(); ctx.fillStyle = R[2];
        for (var k = -10; k < w + 10; k += 8) { ctx.beginPath(); ctx.moveTo(x + k, ty + 10); ctx.lineTo(x + k + 4, ty + 10); ctx.lineTo(x + k + 10, ty); ctx.lineTo(x + k + 6, ty); ctx.fill(); }
        ctx.restore();
      } else {
        var gx = gm.cx - S.cx, gy = gm.cy, r = gm.r, rot = m.rot || 0;
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(rot);
        ctx.fillStyle = '#5a616d'; ctx.beginPath();
        for (var t = 0; t < 10; t++) { var a = t / 10 * TAU; ctx.lineTo(Math.cos(a - 0.12) * (r + 5), Math.sin(a - 0.12) * (r + 5)); ctx.lineTo(Math.cos(a + 0.12) * (r + 5), Math.sin(a + 0.12) * (r + 5)); ctx.lineTo(Math.cos(a + 0.3) * r, Math.sin(a + 0.3) * r); }
        ctx.closePath(); ctx.fill();
        var rg = ctx.createRadialGradient(-4, -4, 2, 0, 0, r); rg.addColorStop(0, '#c4ccd8'); rg.addColorStop(1, '#4a505b');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#23262c'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#23262c'; ctx.lineWidth = 2; for (var s2 = 0; s2 < 3; s2++) { var a2 = s2 / 3 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a2) * 7, Math.sin(a2) * 7); ctx.lineTo(Math.cos(a2) * (r - 5), Math.sin(a2) * (r - 5)); ctx.stroke(); }
        ctx.restore();
      }
    });
  }

  // ---------- Корабль «Горн» ----------
  function ship(ctx, x, y, t, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.rotate((o.tilt || 0) * 0.12);
    // пламя двигателей
    var fl = 8 + Math.sin(t * 40) * 2 + (o.thrust || 0) * 4;
    var fg = ctx.createLinearGradient(-16 - fl, 0, -12, 0); fg.addColorStop(0, 'rgba(255,90,30,0)'); fg.addColorStop(0.6, 'rgba(255,170,60,.85)'); fg.addColorStop(1, '#fff6d0');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-12, -5); ctx.lineTo(-14 - fl, -3.5); ctx.lineTo(-12, -2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(-14 - fl, 3.5); ctx.lineTo(-12, 5); ctx.fill();
    // корпус: плоская спина, скошенное брюхо, резец на носу
    var hg = ctx.createLinearGradient(0, -8, 0, 8); hg.addColorStop(0, '#c08a5a'); hg.addColorStop(0.45, '#7a5236'); hg.addColorStop(1, '#3a2618');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(-13, -7); ctx.lineTo(8, -7); ctx.lineTo(17, -2); ctx.lineTo(17, 1); ctx.lineTo(6, 7); ctx.lineTo(-13, 7); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill();
    // кормовые кили
    ctx.fillStyle = '#5a3a26'; ctx.beginPath(); ctx.moveTo(-13, -7); ctx.lineTo(-8, -11); ctx.lineTo(-3, -7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, 7); ctx.lineTo(-8, 11); ctx.lineTo(-3, 7); ctx.fill();
    // калёный резец
    ctx.save(); ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 8; ctx.fillStyle = '#ffb05a';
    ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(19, -1); ctx.lineTo(19, 0.5); ctx.lineTo(10, -1.5); ctx.fill(); ctx.restore();
    // смотровая щель и заклёпки
    ctx.fillStyle = '#ffd27a'; ctx.fillRect(-2, -4.5, 8, 2);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-8, 1, 13, 1.5);
    ctx.fillStyle = '#e8c49a'; [-9, -4, 1].forEach(function (rx) { ctx.fillRect(rx, -6, 1.5, 1.5); });
    ctx.restore();
    if (o.charge > 0) {   // заряд копится у носа
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * o.charge;
      var cr = 3 + o.charge * 7 + Math.sin(t * 30) * 1.2, cg = ctx.createRadialGradient(x + 22, y, 0, x + 22, y, cr * 1.8);
      cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.4, o.charge >= 1 ? '#ffd27a' : '#9fe6ff'); cg.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x + 22, y, cr * 1.8, 0, TAU); ctx.fill(); ctx.restore();
    }
  }

  // ---------- Дрон «Наковальня»: раскалённый кованый шар с клёпаным ободом ----------
  function drone(ctx, x, y, t, o) {
    o = o || {}; var r = L.DRONE_R, spin = o.spin || t * 3;
    ctx.save();
    var halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4 + (o.glow > 0 ? 6 : 0));
    halo.addColorStop(0, 'rgba(255,140,50,.45)'); halo.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 2.6 + 6, 0, TAU); ctx.fill();
    var body = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, r);
    body.addColorStop(0, '#fff6d6'); body.addColorStop(0.35, '#ffc65a'); body.addColorStop(0.75, '#ff6a1f'); body.addColorStop(1, '#a3220c');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    // следы молота — тёмные вмятины, поворачиваются с шаром
    ctx.fillStyle = 'rgba(120,20,0,.45)';
    for (var i = 0; i < 4; i++) { var a = spin + i * 1.7, d = r * 0.55; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 - 2, 2.6, 1.6, a, 0, TAU); ctx.fill(); }
    // экваториальный обод с заклёпками
    ctx.fillStyle = '#3a2a24'; ctx.fillRect(x - r - 1, y - 2, 2 * r + 2, 4);
    ctx.fillStyle = '#d8a070';
    for (var k = 0; k < 5; k++) { var px = x - r + ((k * 5 + spin * 4) % (2 * r)); ctx.fillRect(px, y - 1, 1.6, 1.6); }
    if (o.glow > 0) { ctx.globalAlpha = Math.min(1, o.glow * 4); ctx.strokeStyle = '#fff3c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.stroke(); }
    ctx.restore();
    if (o.kind) {   // метка луча — маленькая искра своего цвета
      ctx.fillStyle = CAPCOL[o.kind]; ctx.beginPath(); ctx.arc(x, y - r - 4, 2 + (o.lvl >= 2 ? 1 : 0), 0, TAU); ctx.fill();
    }
  }
  function optic(ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 3) * 0.2);
    var g = ctx.createLinearGradient(-6, -6, 6, 6); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9fe6ff'); g.addColorStop(1, '#3a7ab8');
    ctx.shadowColor = '#9fe6ff'; ctx.shadowBlur = 8; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(-2, -3, 2, 2);
    ctx.restore();
  }

  // ---------- Враги ----------
  function eyeDot(ctx, x, y, r, col) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
  var EN = {
    moth: function (ctx, e, x, y, t) {
      var f = Math.abs(Math.sin(e.t * 12 + (e.ph || 0)));
      ctx.fillStyle = '#7a4a8a';
      ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + 6, y - 4 - 7 * f); ctx.lineTo(x + 9, y - 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + 6, y + 4 + 7 * f); ctx.lineTo(x + 9, y + 2); ctx.fill();
      var g = ctx.createLinearGradient(x - 9, 0, x + 6, 0); g.addColorStop(0, '#c88ad8'); g.addColorStop(1, '#5a2e6a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 9, 4, 0, 0, TAU); ctx.fill();
      eyeDot(ctx, x - 5, y, 1.8, '#b6ff5a');
    },
    dart: function (ctx, e, x, y) {
      var g = ctx.createLinearGradient(0, y - 4, 0, y + 4); g.addColorStop(0, '#dfe5ee'); g.addColorStop(1, '#58606c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 6, y - 5); ctx.lineTo(x + 10, y); ctx.lineTo(x + 6, y + 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x - 5, y - 2); ctx.lineTo(x - 5, y + 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,60,.8)'; ctx.fillRect(x + 10, y - 1, 4 + Math.random() * 3, 2);
    },
    turret: function (ctx, e, x, y) {
      var up = e.side === 'c' ? -1 : 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(e.aim || Math.PI);
      ctx.fillStyle = '#2c2f36'; ctx.fillRect(0, -2.5, 15, 5); ctx.fillStyle = '#ff8a3d'; ctx.fillRect(13, -2.5, 2, 5);
      ctx.restore();
      var g = ctx.createRadialGradient(x - 3, y - 3 * up, 1, x, y, 11); g.addColorStop(0, '#b9a3a0'); g.addColorStop(1, '#4a3634');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + 4 * up, 10, up > 0 ? Math.PI : 0, up > 0 ? TAU : Math.PI); ctx.fill();
      ctx.fillStyle = '#2c2125'; ctx.fillRect(x - 12, y + (up > 0 ? 4 : -7), 24, 3);
      eyeDot(ctx, x, y + 1 * up, 2.2, '#ff4a4a');
    },
    walker: function (ctx, e, x, y) {
      var s = Math.sin(e.step || 0) * 4;
      ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x - 7 + s, y + 12); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 7 - s, y + 12); ctx.stroke();
      var g = ctx.createLinearGradient(0, y - 10, 0, y + 6); g.addColorStop(0, '#c9a77a'); g.addColorStop(1, '#5a4430');
      ctx.fillStyle = g; Sp.ui.roundRect(ctx, x - 11, y - 9, 22, 14, 4); ctx.fill();
      ctx.fillStyle = '#2c2f36'; ctx.save(); ctx.translate(x - 2, y - 9); ctx.rotate(-2.4); ctx.fillRect(0, -2, 12, 4); ctx.restore();
      eyeDot(ctx, x - 6, y - 3, 2, '#ffd23a');
    },
    mine: function (ctx, e, x, y, t) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(e.rot || 0);
      ctx.fillStyle = '#6a6f78';
      for (var i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(0, -13); ctx.lineTo(2, -8); ctx.fill(); }
      var g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9); g.addColorStop(0, '#b4bac4'); g.addColorStop(1, '#3a3e46');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.restore();
      if (Math.floor(t * 4 + e.x) % 2) eyeDot(ctx, x, y, 2.4, '#ff3b3b');
    },
    stinger: function (ctx, e, x, y, t) {
      if (e.warn > 0) {   // предупреждение у левого края
        if (Math.floor(t * 8) % 2) { ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(4, e.y0); ctx.lineTo(14, e.y0 - 7); ctx.lineTo(14, e.y0 + 7); ctx.fill(); }
        return;
      }
      ctx.fillStyle = '#d6a32a'; ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a2215'; ctx.fillRect(x - 4, y - 5, 2, 10); ctx.fillRect(x + 1, y - 5, 2, 10);
      ctx.fillStyle = '#e9edf2'; ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 16, y - 1.5); ctx.lineTo(x + 16, y + 1.5); ctx.fill();
      ctx.fillStyle = 'rgba(200,230,255,.5)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 7, 5, 2.5, -0.3, 0, TAU); ctx.fill();
    },
    pod: function (ctx, e, x, y, t) {
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 13, 10, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
      capsule(ctx, x, y, e.cap, t, 0.75);
      ctx.fillStyle = '#5a5f69'; ctx.beginPath(); ctx.moveTo(x + 12, y - 4); ctx.lineTo(x + 18, y); ctx.lineTo(x + 12, y + 4); ctx.fill();
    },
    guard: function (ctx, e, x, y, t) {
      ctx.save(); ctx.translate(x, y);
      ctx.rotate(t * 0.6);
      ctx.fillStyle = '#4a4f5a';
      for (var i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillRect(18, -6, 12, 12); }
      ctx.restore();
      var g = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, 24); g.addColorStop(0, '#d4c2b0'); g.addColorStop(0.6, '#7a5a48'); g.addColorStop(1, '#2e1f1a');
      ctx.fillStyle = g; ctx.beginPath();
      for (var k = 0; k < 8; k++) { var a = k / 8 * TAU + Math.PI / 8; ctx.lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1a1214'; ctx.beginPath(); ctx.arc(x - 6, y, 9, 0, TAU); ctx.fill();
      eyeDot(ctx, x - 8 + Math.sin(t * 2) * 2, y, 4, '#ff4a4a');
    }
  };
  function capsule(ctx, x, y, type, t, sc) {
    sc = sc || 1; var c = CAPCOL[type] || '#fff', w = 18 * sc, h = 11 * sc;
    ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 6 + 3 * Math.sin(t * 6);
    var g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, c); g.addColorStop(1, hexA(c, 0.7));
    ctx.fillStyle = g; Sp.ui.roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#14121c'; ctx.font = '900 ' + Math.round(9 * sc) + 'px Inter,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(type, x, y + 0.5); ctx.textBaseline = 'alphabetic';
  }

  // ---------- Боссы ----------
  function metal(ctx, x, y, r, c0, c1) { var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function weakGlow(ctx, B, sx, t) {
    var w = B.weak, x = w.x - sx;
    if (B.open) {
      ctx.save(); ctx.shadowColor = '#ffdf6a'; ctx.shadowBlur = 16;
      var g = ctx.createRadialGradient(x, w.y, 1, x, w.y, w.r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#ffe07a'); g.addColorStop(1, '#ff6a1f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, w.y, w.r * (0.9 + 0.1 * Math.sin(t * 10)), 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  function lids(ctx, x, y, r, open, col) {   // створки: сходятся, когда закрыто
    var gap = open ? r * 0.9 : 0;
    ctx.fillStyle = col;
    ctx.fillRect(x - r - 2, y - r - 2 - gap, 2 * r + 4, r + 2); ctx.fillRect(x - r - 2, y + gap, 2 * r + 4, r + 2);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - r - 2, y - 1 - gap, 2 * r + 4, 1); ctx.fillRect(x - r - 2, y + gap, 2 * r + 4, 1);
  }
  var BOSS = {
    crucible: function (ctx, B, sx, t) {
      var x = B.x - sx, y = B.y;
      metal(ctx, x + 12, y - 58, 22, '#8a7464', '#2c201a'); metal(ctx, x + 12, y + 58, 22, '#8a7464', '#2c201a');
      ctx.fillStyle = '#ff7a2a'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8); ctx.fillRect(x + 4, y - 66, 16, 4); ctx.fillRect(x + 4, y + 62, 16, 4); ctx.globalAlpha = 1;
      metal(ctx, x + 24, y, 52, '#9a8070', '#24170f');
      ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x + 24, y, 44, 2.2, 4.1); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a100c'; ctx.beginPath(); ctx.arc(x - 34, y, 17, 0, TAU); ctx.fill();
      weakGlow(ctx, B, sx, t);
      lids(ctx, x - 34, y, 15, B.open, '#5a463a');
    },
    hammer: function (ctx, B, sx, t) {
      var x = B.x - sx, y = B.y, H = B.head;
      metal(ctx, x + 40, y - 38, 24, '#8d96a4', '#262a31');
      metal(ctx, x + 8, y + 6, 44, '#a3acb8', '#23272e');
      ctx.fillStyle = '#1a1c20'; ctx.beginPath(); ctx.arc(B.weak.x - sx, B.weak.y, 14, 0, TAU); ctx.fill();
      weakGlow(ctx, B, sx, t);
      ctx.strokeStyle = '#5a4434'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x - 10, y - 12); ctx.lineTo(H.x - sx, H.y); ctx.stroke();
      var hx = H.x - sx, hy = H.y;
      var g = ctx.createLinearGradient(hx - 24, 0, hx + 24, 0); g.addColorStop(0, '#d8dee8'); g.addColorStop(0.5, '#7a828f'); g.addColorStop(1, '#3a3f48');
      ctx.fillStyle = g; Sp.ui.roundRect(ctx, hx - 22, hy - 20, 44, 40, 6); ctx.fill();
      ctx.fillStyle = '#ff8a3d'; ctx.fillRect(hx - 22, hy - 3, 6, 6);
      if (B.dash > 10) { ctx.fillStyle = 'rgba(255,138,61,.25)'; ctx.fillRect(x + 50, y - 30, B.dash * 0.4, 60); }
    },
    worm: function (ctx, B, sx, t) {
      for (var i = B.segs.length - 1; i >= 0; i--) {
        var s = B.segs[i], x = s.x - sx, r = i === 0 ? 18 : i === B.segs.length - 1 ? 13 : 15;
        if (i === B.segs.length - 1) { ctx.fillStyle = '#3a2a24'; ctx.beginPath(); ctx.arc(x, s.y, 15, 0, TAU); ctx.fill(); weakGlow(ctx, B, sx, t); continue; }
        metal(ctx, x, s.y, r, i === 0 ? '#c88a5a' : '#a0785a', '#2a1810');
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, s.y, r * 0.6, 0, TAU); ctx.stroke();
        if (i > 0) { ctx.fillStyle = '#3a2a24'; ctx.fillRect(x - 2, s.y + r - 2, 4, 6); ctx.fillRect(x - 2, s.y - r - 4, 4, 6); }
      }
      var h = B.segs[0], hx = h.x - sx, ang = Math.atan2(B.segs[0].y - B.segs[1].y, B.segs[0].x - B.segs[1].x);
      ctx.save(); ctx.translate(hx, h.y); ctx.rotate(ang);
      var m = 0.3 + 0.2 * Math.sin(t * 8); ctx.strokeStyle = '#e8d2b0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(14, -6); ctx.quadraticCurveTo(26, -6 - 8 * m, 24, 2); ctx.moveTo(14, 6); ctx.quadraticCurveTo(26, 6 + 8 * m, 24, -2); ctx.stroke();
      ctx.restore(); eyeDot(ctx, hx, h.y, 4, '#ff4a4a');
    },
    hive: function (ctx, B, sx, t) {
      var x = B.x - sx, y = B.y;
      metal(ctx, x - 20, y - 64, 20, '#a07a6a', '#2a1a14'); metal(ctx, x - 20, y + 64, 20, '#a07a6a', '#2a1a14');
      var g = ctx.createRadialGradient(x, y - 20, 6, x + 16, y, 60); g.addColorStop(0, '#c08a7a'); g.addColorStop(1, '#2a1418');
      ctx.fillStyle = g; ctx.beginPath(); for (var k = 0; k < 6; k++) { var a = k / 6 * TAU; ctx.lineTo(x + 16 + Math.cos(a) * 60, y + Math.sin(a) * 60); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) { var hx = x + 4 + c * 16 + (r % 2) * 8, hy = y - 22 + r * 20; ctx.beginPath(); for (var q = 0; q < 6; q++) { var a2 = q / 6 * TAU; ctx.lineTo(hx + Math.cos(a2) * 8, hy + Math.sin(a2) * 8); } ctx.closePath(); ctx.stroke(); }
      ctx.fillStyle = '#1a0e10'; ctx.beginPath(); ctx.arc(x - 46, y, 18, 0, TAU); ctx.fill();
      weakGlow(ctx, B, sx, t); lids(ctx, x - 46, y, 16, B.open, '#6a3a3a');
    },
    mirror: function (ctx, B, sx, t) {
      var x = B.x - sx, y = B.y;
      [-46, 46].forEach(function (dy) { metal(ctx, x + 34, y + dy, 17, '#e0e8f4', '#384252'); });
      var g = ctx.createLinearGradient(x - 40, y - 40, x + 50, y + 40); g.addColorStop(0, '#f4f8ff'); g.addColorStop(0.45, '#8aa0bc'); g.addColorStop(0.55, '#d8e4f4'); g.addColorStop(1, '#2a3446');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 40, y); ctx.lineTo(x + 10, y - 44); ctx.lineTo(x + 52, y); ctx.lineTo(x + 10, y + 44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#141a24'; ctx.beginPath(); ctx.arc(x - 26, y, 14, 0, TAU); ctx.fill();
      weakGlow(ctx, B, sx, t); lids(ctx, x - 26, y, 13, B.open, '#7a8ca4');
    },
    heart: function (ctx, B, sx, t) {
      var x = B.x - sx, y = B.y;
      ctx.strokeStyle = '#4a1a1e'; ctx.lineWidth = 8;
      B.parts.forEach(function (p) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 10, p.y, p.x - sx + 6, p.y); ctx.stroke(); });
      var beat = 1 + 0.04 * Math.sin(t * (B.phase2 ? 9 : 6));
      var g = ctx.createRadialGradient(x, y - 10, 8, x + 22, y, 62 * beat); g.addColorStop(0, '#d85a5a'); g.addColorStop(0.6, '#6a1a20'); g.addColorStop(1, '#240608');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 22, y, 62 * beat, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,90,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 22, y, 48, 1.9, 4.4); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 22, y, 34, 2.1, 4.2); ctx.stroke();
      B.parts.forEach(function (p) {
        var px = p.x - sx;
        if (p.alive) {
          var bg2 = ctx.createLinearGradient(0, p.y - 4, 0, p.y + 4); bg2.addColorStop(0, '#d8dee8'); bg2.addColorStop(1, '#4a505b');
          ctx.fillStyle = bg2; ctx.fillRect(px - 30, p.y - 4, 18, 8); ctx.fillStyle = '#ff8a3d'; ctx.fillRect(px - 32, p.y - 4, 3, 8);
          metal(ctx, px, p.y, 18, '#e0b49a', '#4a1e1a');
          ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, p.y, 12, 0, TAU); ctx.stroke();
          eyeDot(ctx, px - 4, p.y, 4, '#ffd23a');
        }
        else { metal(ctx, px + 14, p.y, 12, '#5a4a48', '#1a1010'); }
      });
      ctx.fillStyle = '#1a0608'; ctx.beginPath(); ctx.arc(x - 50, y, 19, 0, TAU); ctx.fill();
      weakGlow(ctx, B, sx, t); lids(ctx, x - 50, y, 17, B.open, '#7a2a2e');
    }
  };
  function laser(ctx, S) {
    var Lz = S.laser; if (!Lz) return;
    var x0 = Math.max(0, Lz.x0 - S.cx), x1 = Lz.x1 - S.cx;
    if (Lz.h > 0) {
      ctx.save(); ctx.shadowColor = '#bfe4ff'; ctx.shadowBlur = 18;
      var g = ctx.createLinearGradient(0, Lz.y - Lz.h, 0, Lz.y + Lz.h); g.addColorStop(0, 'rgba(120,190,255,.2)'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, 'rgba(120,190,255,.2)');
      ctx.fillStyle = g; ctx.fillRect(x0, Lz.y - Lz.h, x1 - x0, Lz.h * 2); ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255,90,90,' + (0.3 + 0.5 * Lz.warn) + ')'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(x0, Lz.y); ctx.lineTo(x1, Lz.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ---------- Снаряды ----------
  var SHOT = {
    shot: function (ctx, s, x) { ctx.fillStyle = '#fff3c8'; ctx.fillRect(x - 6, s.y - 1, 10, 2); ctx.fillStyle = '#ffb05a'; ctx.fillRect(x - 9, s.y - 1, 3, 2); },
    opt: function (ctx, s, x) { ctx.fillStyle = '#bfefff'; ctx.fillRect(x - 5, s.y - 0.75, 8, 1.5); },
    dshot: function (ctx, s, x) { ctx.fillStyle = '#ffb05a'; ctx.beginPath(); ctx.arc(x, s.y, 2.5, 0, TAU); ctx.fill(); },
    ric: function (ctx, s, x) { var a = Math.atan2(s.vy, s.vx); ctx.save(); ctx.translate(x, s.y); ctx.rotate(a); ctx.shadowColor = '#5ad8ff'; ctx.shadowBlur = 6; ctx.fillStyle = '#c8f2ff'; ctx.fillRect(-9, -1.2, 14, 2.4); ctx.restore(); },
    crawl: function (ctx, s, x, t) { ctx.save(); ctx.shadowColor = '#7be37b'; ctx.shadowBlur = 6; ctx.fillStyle = '#c8ffb0'; for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x - k * 5 * (s.dir || 1), s.y + Math.sin(t * 30 + k) * 1.5, 2.6 - k * 0.6, 0, TAU); ctx.fill(); } ctx.restore(); },
    fan: function (ctx, s, x) { var a = Math.atan2(s.vy, s.vx); ctx.save(); ctx.translate(x, s.y); ctx.rotate(a); ctx.fillStyle = '#ffcf7a'; ctx.fillRect(-5, -1.5, 8, 3); ctx.restore(); },
    beam: function (ctx, s, x, t) {
      var h = s.h; ctx.save(); ctx.shadowColor = '#9fe6ff'; ctx.shadowBlur = 14;
      var g = ctx.createLinearGradient(0, s.y - h / 2, 0, s.y + h / 2); g.addColorStop(0, 'rgba(120,200,255,.3)'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, 'rgba(120,200,255,.3)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x - 14, s.y, 26 + h, h / 2, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  };
  function bullet(ctx, b, x, t) {
    var big = b.kind === 'big', r = b.r + (big ? 0.5 : 0);
    ctx.save(); ctx.shadowColor = big ? '#ff6a2a' : '#ff5a8a'; ctx.shadowBlur = 6;
    ctx.fillStyle = big ? '#ff8a3d' : '#ff6a9a'; ctx.beginPath(); ctx.arc(x, b.y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff0f4'; ctx.beginPath(); ctx.arc(x, b.y, r * 0.45, 0, TAU); ctx.fill(); ctx.restore();
  }
  function fxDraw(ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var f = list[i], k = f.t / f.life;
      ctx.strokeStyle = f.color; ctx.globalAlpha = k * 0.8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.2 - k), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, S, g, o) {
    o = o || {}; var t = S.time, sx = S.cx, game = o.game;
    bg(ctx, g, S);
    if (game) { terrain(ctx, S, game); mechs(ctx, S, game); }
    var B = S.boss;
    if (B && B.alive) { laser(ctx, S); BOSS[B.type](ctx, B, sx, t); if (B.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(B.weak.x - sx, B.weak.y, B.weak.r + 4, 0, TAU); ctx.fill(); } }
    S.caps.forEach(function (c) { capsule(ctx, c.x - sx, c.y, c.type, t); });
    S.enemies.forEach(function (e) {
      if (!e.alive) return; var x = e.x - sx;
      EN[e.type](ctx, e, x, e.y, t);
      if (e.flash > 0 && e.type !== 'stinger') { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(x, e.y, e.r, 0, TAU); ctx.fill(); }
    });
    S.shots.forEach(function (s) { SHOT[s.kind](ctx, s, s.x - sx, t); });
    var sh = S.ship, D = S.drone;
    S.optics.forEach(function (op) { optic(ctx, op.x - sx, op.y, t + op.t); });
    if (!sh.dead) {
      if (!(sh.grace > 0 && Math.floor(t * 12) % 2)) ship(ctx, sh.x - sx, sh.y, t, { tilt: sh.tilt, charge: S.fire.charge, thrust: sh.vx > 0 ? 1 : 0 });
    }
    if (!sh.dead || S.phase !== 'dead') drone(ctx, D.x - sx, D.y, t, { spin: D.spin, glow: D.glow, kind: D.kind, lvl: D.lvl });
    S.bullets.forEach(function (b) { bullet(ctx, b, b.x - sx, t); });
    if (o.fx) fxDraw(ctx, o.fx);
    if (o.bare) return;
    Sp.ui.hud(g, ctx, S, P, lifeIcon);
    Sp.ui.bossBar(g, ctx, S, P);
    Sp.ui.banner(g, ctx, S, P);
    if (o.toasts) Sp.ui.toasts(g, ctx, o.toasts, P);
  }
  function lifeIcon(ctx, x, y, on) {
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.22; ctx.translate(x, y); ctx.scale(0.55, 0.55); ship(ctx, 0, 0, 0, {}); ctx.restore();
  }

  Sp.modern = { P: P, bg: bg, draw: draw, lifeIcon: lifeIcon, ship: ship, drone: drone, optic: optic, capsule: capsule, EN: EN, BOSS: BOSS };
})(typeof window !== 'undefined' ? window : globalThis);
