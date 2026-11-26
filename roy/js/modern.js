/* РОЙ · рендер MODERN (по умолчанию). ROY.modern = { P, bg, draw, icon }
   Вектор: градиенты, мягкое свечение, параллакс-звёзды и туманность. Рой — светящиеся семена-мошки,
   Матка — соты-улей, корабль «Огниво» — гранёная капсула с кремнёвым ядром. Логику не трогает. */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};
  var TAU = 6.283;

  var P = {
    pixel: false, ink: '#eef2f8', muted: '#97a0b8', accent: '#ffb02e', good: '#7dffb0', bad: '#ff5d6a',
    panel: 'rgba(14,16,34,.86)', line: 'rgba(255,176,46,.45)', hudBg: 'rgba(10,14,28,.6)', bar: 'rgba(255,255,255,.14)',
    queenBar: '#c58cff', tipEdge: 'rgba(125,255,176,.55)',
    gnat: '#b8f070', gnatD: '#3f7a1c', shell: '#8fb4dc', shellD: '#2c4a72', powder: '#ff6a3c', powderD: '#8a1c0c',
    hive: '#c58cff', hiveD: '#4a2a8a', honey: '#ffd36a', ship: '#e8f6ff', shipD: '#4fa8d8', core: '#ff8a2a',
    lure: '#ff6ad5', spore: '#c58cff', spark: '#fff3b0', fire: '#ffb02e'
  };

  // ---------- Фон ----------
  var layers = null, lastT = 0, grad = null, neb = null;
  function bg(ctx, g) {
    var W = g.W, H = g.H;
    if (!layers) {
      layers = [[], [], []];
      for (var l = 0; l < 3; l++) for (var i = 0; i < 24 + l * 8; i++) layers[l].push({ x: Math.random() * W, y: Math.random() * H, r: 0.5 + l * 0.45 + Math.random() * 0.4, ph: Math.random() * 6 });
    }
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#0a0818'); grad.addColorStop(0.55, '#140c2a'); grad.addColorStop(1, '#22101c');
      neb = ctx.createRadialGradient(W * 0.3, H * 0.25, 10, W * 0.3, H * 0.25, W * 0.75);
      neb.addColorStop(0, 'rgba(255,150,60,.10)'); neb.addColorStop(1, 'rgba(255,150,60,0)');
    }
    var dt = Math.min(0.1, Math.max(0, g.time - lastT)); lastT = g.time;
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H); ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    var sp = [10, 22, 46];
    for (var k = 0; k < 3; k++) {
      var L = layers[k];
      for (var j = 0; j < L.length; j++) {
        var s = L[j]; s.y += sp[k] * dt; if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
        ctx.globalAlpha = 0.3 + 0.22 * k + 0.18 * Math.sin(g.time * 2 + s.ph);
        ctx.fillStyle = '#f4e8ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Фигуры ----------
  function hexPath(ctx, x, y, r) { ctx.beginPath(); for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
  function orb(ctx, x, y, r, c, d) {
    var gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, c); gr.addColorStop(1, d);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function drone(ctx, d, t) {
    var x = d.x, y = d.y, r = d.r;
    if (d.state === 'burn') {
      var k = d.burnT / R.consts.BURN, rad = (d.kind === 'powder' ? R.consts.IGN * 1.9 : R.consts.IGN) * (0.6 + k * 0.4);
      ctx.save(); ctx.globalAlpha = 0.22 * (1 - k); ctx.fillStyle = P.fire; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.shadowColor = P.fire; ctx.shadowBlur = 16;
      orb(ctx, x, y, r * (1.1 - k * 0.5), '#ffd36a', '#ff5a1a'); ctx.restore();
      ctx.fillStyle = 'rgba(255,240,200,' + (0.9 - k * 0.6) + ')';
      for (var f = 0; f < 3; f++) { var a = t * 9 + f * 2.1 + d.id; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.6, y - r * 0.4 - (t * 30 + f * 5) % 10, 2, 0, TAU); ctx.fill(); }
      return;
    }
    var fl = Math.sin(t * 18 + d.id) * 0.5 + 0.5;
    ctx.strokeStyle = 'rgba(230,255,200,.55)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x - r * 1.5, y - r * (0.6 + fl * 0.6)); ctx.moveTo(x + r * 0.6, y - r * 0.2); ctx.lineTo(x + r * 1.5, y - r * (0.6 + fl * 0.6)); ctx.stroke();
    if (d.kind === 'gnat') { orb(ctx, x, y, r, P.gnat, P.gnatD); }
    else if (d.kind === 'powder') {
      orb(ctx, x, y, r, P.powder, P.powderD);
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + 3, y - r - 5); ctx.stroke();
      ctx.fillStyle = fl > 0.5 ? '#ffffff' : '#ffd36a'; ctx.beginPath(); ctx.arc(x + 3, y - r - 6, 2, 0, TAU); ctx.fill();
    } else {
      orb(ctx, x, y, r * 0.75, P.gnat, P.gnatD);
      if (d.shell) { ctx.strokeStyle = P.shell; ctx.lineWidth = 3; hexPath(ctx, x, y, r + 1); ctx.stroke(); ctx.fillStyle = 'rgba(143,180,220,.25)'; ctx.fill(); }
      else if (d.crackT > 0) { ctx.strokeStyle = 'rgba(143,180,220,' + d.crackT * 2 + ')'; ctx.lineWidth = 2; hexPath(ctx, x, y, r + 6 - d.crackT * 10); ctx.stroke(); }
    }
    ctx.fillStyle = '#10140a'; ctx.beginPath(); ctx.arc(x - 2.4, y + 0.5, 1.4, 0, TAU); ctx.arc(x + 2.4, y + 0.5, 1.4, 0, TAU); ctx.fill();
  }
  function queen(ctx, q, t, scale) {
    var s = scale || 1, x = q.x, y = q.y, hurt = q.hurtT > 0;
    if (q.warn > 0) { ctx.save(); ctx.strokeStyle = 'rgba(255,93,106,' + (0.5 + 0.5 * Math.sin(t * 30)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 40 * s + (1 - q.warn) * 20, 0, TAU); ctx.stroke(); ctx.restore(); }
    var cells = [[0, 0]]; for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; cells.push([Math.cos(a) * 15.6, Math.sin(a) * 15.6]); }
    ctx.save(); ctx.shadowColor = hurt ? '#ffffff' : P.hive; ctx.shadowBlur = 14;
    for (var c = 0; c < cells.length; c++) {
      var cx = x + cells[c][0] * s, cy = y + cells[c][1] * s, pulse = 0.5 + 0.5 * Math.sin(t * 3 + c);
      var gr = ctx.createLinearGradient(cx, cy - 9 * s, cx, cy + 9 * s);
      gr.addColorStop(0, hurt ? '#ffffff' : P.hive); gr.addColorStop(1, P.hiveD);
      ctx.fillStyle = gr; hexPath(ctx, cx, cy, 8.6 * s); ctx.fill();
      ctx.fillStyle = c === 0 ? P.honey : 'rgba(255,211,106,' + (0.25 + pulse * 0.4) + ')'; hexPath(ctx, cx, cy, (c === 0 ? 5 : 3.4) * s); ctx.fill();
    }
    ctx.restore();
  }
  function ship(ctx, x, y, t, scale) {
    var s = scale || 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var fl = 5 + Math.sin(t * 40) * 2;
    ctx.fillStyle = 'rgba(255,150,60,.85)'; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(0, 9 + fl); ctx.lineTo(4, 9); ctx.fill();
    ctx.fillStyle = P.shipD; ctx.beginPath(); ctx.moveTo(-15, 4); ctx.lineTo(-10, -4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(15, 4); ctx.lineTo(10, -4); ctx.lineTo(7, 8); ctx.closePath(); ctx.fill();
    var gr = ctx.createLinearGradient(-10, 0, 10, 0); gr.addColorStop(0, P.shipD); gr.addColorStop(0.5, P.ship); gr.addColorStop(1, P.shipD);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, -5); ctx.lineTo(10, 6); ctx.lineTo(0, 10); ctx.lineTo(-10, 6); ctx.lineTo(-10, -5); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor = P.core; ctx.shadowBlur = 10; ctx.fillStyle = P.core; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4.5, -1); ctx.lineTo(0, 5); ctx.lineTo(-4.5, -1); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
  }
  function lureShape(ctx, x, y, t, k) {
    ctx.save(); ctx.shadowColor = P.lure; ctx.shadowBlur = 14; ctx.fillStyle = P.lure;
    var r = 8 + Math.sin(t * 10) * 1.2;
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.75, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.75, y); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (k != null) { ctx.strokeStyle = 'rgba(255,106,213,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); }
  }

  // ---------- Кадр ----------
  function draw(ctx, S, g, o) {
    o = o || {}; var i, t = g.time, C = R.consts;
    bg(ctx, g);
    // зона корабля — едва заметная граница
    ctx.fillStyle = 'rgba(255,176,46,.05)'; ctx.fillRect(0, C.PY0 - 16, S.W, 1);
    // манок: кольца притяжения
    var L = S.lure;
    if (L) {
      for (i = 0; i < 3; i++) { var u = (t * 0.8 + i / 3) % 1; ctx.strokeStyle = 'rgba(255,106,213,' + (0.35 * (1 - u)) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(L.x, L.y, 14 + u * 90, 0, TAU); ctx.stroke(); }
    }
    if (S.queen && S.queen.alive) queen(ctx, S.queen, t);
    for (i = 0; i < S.drones.length; i++) { var d = S.drones[i]; if (d.state !== 'dead') drone(ctx, d, t); }
    if (L) lureShape(ctx, L.x, L.y, t, L.state === 'hover' ? 1 - L.t / C.LURE_HOVER : null);
    // искры
    ctx.save(); ctx.shadowColor = P.fire; ctx.shadowBlur = 12;
    for (i = 0; i < S.sparks.length; i++) { var s = S.sparks[i]; var gr = ctx.createLinearGradient(0, s.y - 4, 0, s.y + 16); gr.addColorStop(0, P.spark); gr.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = gr; ctx.fillRect(s.x - 2.5, s.y - 4, 5, 20); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TAU); ctx.fill(); }
    ctx.restore();
    // плевки
    ctx.save(); ctx.shadowColor = P.spore; ctx.shadowBlur = 10;
    for (i = 0; i < S.spores.length; i++) { var b = S.spores[i]; ctx.fillStyle = P.spore; ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 1.6, 0, TAU); ctx.fill(); }
    ctx.restore();
    var p = S.player;
    if (p.alive) { ctx.globalAlpha = p.inv > 0 ? 0.45 + 0.4 * Math.sin(t * 25) : 1; ship(ctx, p.x, p.y, t); ctx.globalAlpha = 1; }
    if (o.bare) return;
    R.ui.hud(g, ctx, S, P, DRAW);
    R.ui.chainPop(g, ctx, S, P);
    R.ui.tip(g, ctx, S, P, DRAW);
    R.ui.banner(g, ctx, S, P);
  }

  var DRAW = {
    lifeIcon: function (ctx, x, y) { ship(ctx, x, y, 0, 0.6); },
    chargeIcon: function (ctx, x, y, on) { ctx.fillStyle = on ? P.spark : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill(); },
    lureIcon: function (ctx, x, y, k) { ctx.globalAlpha = k >= 1 ? 1 : 0.35; lureShape(ctx, x, y, 0, null); ctx.globalAlpha = 1; if (k < 1) { ctx.strokeStyle = P.lure; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); } },
    btnIcon: function (ctx, x, y, key, t) {
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
      if (key === 'lure') lureShape(ctx, x, y, t, null); else { ctx.fillStyle = P.spark; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); }
    },
    queenIcon: function (ctx, x, y) { queen(ctx, { x: x, y: y, hurtT: 0, warn: 0 }, 0, 0.45); }
  };

  function icon(ctx, kind, x, y, g) {
    var t = g.time;
    if (kind === 'ship') ship(ctx, x, y, t);
    else if (kind === 'queen') queen(ctx, { x: x, y: y, hurtT: 0, warn: 0 }, t, 0.55);
    else if (kind === 'lure') lureShape(ctx, x, y, t, null);
    else drone(ctx, { kind: kind, x: x, y: y, r: R.consts.KINDS[kind].r, state: 'live', shell: kind === 'shell', id: 1, crackT: 0 }, t);
  }

  R.modern = { P: P, bg: bg, draw: draw, icon: icon };
})(typeof window !== 'undefined' ? window : globalThis);
