/* РОЙ · рендер MODERN (по умолчанию). ROY.modern = { bg, draw, icon }
   Тот же мир, что и 8-бит, но векторная графика: градиенты, мягкое свечение,
   параллакс-звёзды и туманность. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};

  var C = {
    ship: '#eef2f8', shipD: '#8a9bbd', accent: '#ff7a1a', cockpit: '#4fd2ff',
    spore: '#45e08a', sporeD: '#0f7a45', sporeS: '#c8ff6a',
    wedge: '#ff4f86', wedgeD: '#a01848', wedgeCore: '#ffd36a',
    medusa: '#9d7dff', medusaD: '#4a2fc0', medusaH: '#ff8ad8', medusaHD: '#b02a8a', tent: '#5fd0ff',
    pb: '#bff4ff', eb: '#ff5d8a', beam: '95,208,255'
  };

  // ---------- Фон: градиент, туманность, 3 слоя звёзд ----------
  var layers = null, lastT = 0, grad = null, neb = null;
  function bg(ctx, g) {
    var W = g.W, H = g.H;
    if (!layers) {
      layers = [[], [], []];
      for (var l = 0; l < 3; l++) for (var i = 0; i < 26 + l * 8; i++) layers[l].push({ x: Math.random() * W, y: Math.random() * H, r: 0.5 + l * 0.45 + Math.random() * 0.4, ph: Math.random() * 6 });
    }
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#070a18'); grad.addColorStop(0.55, '#0c1230'); grad.addColorStop(1, '#1a1038');
      neb = ctx.createRadialGradient(W * 0.72, H * 0.3, 10, W * 0.72, H * 0.3, W * 0.7);
      neb.addColorStop(0, 'rgba(120,80,255,.16)'); neb.addColorStop(1, 'rgba(120,80,255,0)');
    }
    var dt = Math.min(0.1, Math.max(0, g.time - lastT)); lastT = g.time;
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    var sp = [14, 32, 70];
    for (var k = 0; k < 3; k++) {
      var L = layers[k];
      for (var j = 0; j < L.length; j++) {
        var s = L[j]; s.y += sp[k] * dt; if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
        ctx.globalAlpha = 0.35 + 0.25 * k + 0.2 * Math.sin(g.time * 2 + s.ph);
        ctx.fillStyle = '#dfe8ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Фигуры (центр в 0,0; «нос» врагов смотрит вниз) ----------
  function ship(ctx, x, y, t, tint) {
    ctx.save(); ctx.translate(x, y);
    // пламя
    var fl = 6 + Math.sin(t * 40) * 2;
    ctx.fillStyle = tint ? 'rgba(255,90,140,.7)' : 'rgba(255,150,60,.85)';
    ctx.beginPath(); ctx.moveTo(-7, 10); ctx.lineTo(-4.5, 10 + fl); ctx.lineTo(-2, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 10); ctx.lineTo(4.5, 10 + fl); ctx.lineTo(7, 10); ctx.fill();
    // крылья
    ctx.fillStyle = tint ? '#b0204a' : C.accent;
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-16, 8); ctx.lineTo(-16, 12); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(16, 8); ctx.lineTo(16, 12); ctx.lineTo(5, 8); ctx.closePath(); ctx.fill();
    // корпус
    var gr = ctx.createLinearGradient(-8, 0, 8, 0);
    gr.addColorStop(0, tint ? '#c0507a' : C.shipD); gr.addColorStop(0.5, tint ? '#ffb0c8' : C.ship); gr.addColorStop(1, tint ? '#c0507a' : C.shipD);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.quadraticCurveTo(7, -6, 8, 10); ctx.lineTo(-8, 10); ctx.quadraticCurveTo(-7, -6, 0, -17); ctx.fill();
    ctx.fillStyle = tint ? '#fff' : C.cockpit;
    ctx.beginPath(); ctx.ellipse(0, -5, 2.6, 5.5, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  function spore(ctx, t, ph) {
    var pulse = 1 + 0.12 * Math.sin(t * 6 + ph);
    ctx.strokeStyle = C.sporeS; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 + t * 0.6;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 14 * pulse, Math.sin(a) * 14 * pulse); ctx.stroke();
    }
    var gr = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11);
    gr.addColorStop(0, '#b6ffd0'); gr.addColorStop(0.5, C.spore); gr.addColorStop(1, C.sporeD);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#082414'; ctx.beginPath(); ctx.ellipse(0, 2, 5, 2.2, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#eaffef'; ctx.beginPath(); ctx.arc(1.8, 1.4, 1.1, 0, 6.283); ctx.fill();
  }
  function wedge(ctx, t, ph) {
    var flap = 0.75 + 0.25 * Math.sin(t * 10 + ph);
    var gr = ctx.createLinearGradient(0, -12, 0, 14);
    gr.addColorStop(0, '#ff9ab8'); gr.addColorStop(1, C.wedgeD);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(-16 * flap, -10); ctx.lineTo(-6, -4); ctx.lineTo(0, -12); ctx.lineTo(6, -4); ctx.lineTo(16 * flap, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.wedge;
    ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(-6, -4); ctx.lineTo(0, -12); ctx.lineTo(6, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.wedgeCore; ctx.beginPath(); ctx.arc(0, -1, 3.2, 0, 6.283); ctx.fill();
  }
  function medusa(ctx, t, ph, hurt) {
    var a = hurt ? C.medusaH : C.medusa, d = hurt ? C.medusaHD : C.medusaD;
    // щупальца
    ctx.strokeStyle = hurt ? '#ffc070' : C.tent; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (var i = -2; i <= 2; i++) {
      var bx = i * 5.5;
      ctx.beginPath(); ctx.moveTo(bx, 2);
      for (var k = 1; k <= 4; k++) ctx.lineTo(bx + Math.sin(t * 7 + ph + k + i) * 2.6, 2 + k * 4);
      ctx.stroke();
    }
    var gr = ctx.createRadialGradient(0, -10, 2, 0, -4, 18);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, a); gr.addColorStop(1, d);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(-17, 3); ctx.quadraticCurveTo(-17, -16, 0, -16); ctx.quadraticCurveTo(17, -16, 17, 3);
    for (var j = 0; j < 6; j++) ctx.quadraticCurveTo(17 - j * 5.66 - 2.8, 7, 17 - (j + 1) * 5.66, 3);
    ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-6, -5, 3.4, 3, 0, 0, 6.283); ctx.ellipse(6, -5, 3.4, 3, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#140a30'; ctx.beginPath(); ctx.arc(-6, -4, 1.6, 0, 6.283); ctx.arc(6, -4, 1.6, 0, 6.283); ctx.fill();
  }
  function enemy(ctx, e, t) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang || 0);
    if (e.kind === 'spore') spore(ctx, t, e.id); else if (e.kind === 'wedge') wedge(ctx, t, e.id); else medusa(ctx, t, e.id, e.hurt);
    ctx.restore();
  }

  function beam(ctx, e, st, g) {
    var top = e.y + 10, bottom = st.PLAYER_Y + 18;
    var k = e.sub === 'hold' ? 1 : Math.min(1, e.beamT / 0.8);
    var fade = e.sub === 'beam' && e.beamT > 2.7 ? Math.max(0, (3.2 - e.beamT) / 0.5) : 1;
    var len = (bottom - top) * k, wB = 6 + (st.BEAM_HALF - 6) * k;
    ctx.save(); ctx.globalAlpha = fade;
    var gr = ctx.createLinearGradient(0, top, 0, top + len);
    gr.addColorStop(0, 'rgba(' + C.beam + ',.55)'); gr.addColorStop(1, 'rgba(' + C.beam + ',.12)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(e.x - 6, top); ctx.lineTo(e.x + 6, top); ctx.lineTo(e.x + wB, top + len); ctx.lineTo(e.x - wB, top + len); ctx.closePath(); ctx.fill();
    // бегущие кольца
    ctx.strokeStyle = 'rgba(' + C.beam + ',.8)'; ctx.lineWidth = 1.5;
    for (var i = 0; i < 6; i++) {
      var u = ((g.time * 0.9 + i / 6) % 1), y = top + u * len, w = 6 + (wB - 6) * u;
      ctx.globalAlpha = fade * (1 - u) * 0.9;
      ctx.beginPath(); ctx.ellipse(e.x, y, w, 3, 0, 0, 6.283); ctx.stroke();
    }
    ctx.restore();
  }

  function pill(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw(ctx, st, g) {
    var i, e, t = g.time;
    bg(ctx, g);
    for (i = 0; i < st.enemies.length; i++) { e = st.enemies[i]; if (e.state === 'dive' && (e.sub === 'beam' || e.sub === 'hold')) beam(ctx, e, st, g); }
    for (i = 0; i < st.enemies.length; i++) {
      e = st.enemies[i]; if (e.state === 'dead' || e.state === 'wait') continue;
      enemy(ctx, e, t);
      if (e.carry) { var ox = 28 * Math.sin(e.ang), oy = -28 * Math.cos(e.ang); ctx.save(); ctx.translate(e.x + ox, e.y + oy); ctx.rotate(e.ang + Math.PI); ship(ctx, 0, 0, t, true); ctx.restore(); }
    }
    if (st.captive) { ctx.save(); ctx.translate(st.captive.x, st.captive.y); ctx.rotate(st.captive.t * 9); ship(ctx, 0, 0, t, true); ctx.restore(); }
    if (st.rescue) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 20); ship(ctx, st.rescue.x, st.rescue.y, t, false); ctx.globalAlpha = 1; }

    // пули (со свечением)
    ctx.save(); ctx.shadowColor = C.pb; ctx.shadowBlur = 10; ctx.fillStyle = C.pb;
    for (i = 0; i < st.pb.length; i++) { pill(ctx, st.pb[i].x - 1.8, st.pb[i].y - 8, 3.6, 13, 1.8); ctx.fill(); }
    ctx.shadowColor = C.eb; ctx.fillStyle = C.eb;
    for (i = 0; i < st.eb.length; i++) { ctx.beginPath(); ctx.arc(st.eb[i].x, st.eb[i].y, 3.6, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
    for (i = 0; i < st.eb.length; i++) { ctx.beginPath(); ctx.arc(st.eb[i].x, st.eb[i].y, 1.5, 0, 6.283); ctx.fill(); }
    ctx.restore();

    var p = st.player;
    if (p.alive) {
      ctx.globalAlpha = p.inv > 0 ? 0.45 + 0.4 * Math.sin(t * 25) : 1;
      ship(ctx, p.x, st.PLAYER_Y, t, false);
      if (p.dual) ship(ctx, p.x + st.HULL_GAP, st.PLAYER_Y, t, false);
      ctx.globalAlpha = 1;
    }
    hud(ctx, st, g);
    banner(ctx, st, g);
  }

  function hud(ctx, st, g) {
    var W = st.W, th = g.th(), best = Math.max(g.state.best || 0, st.score);
    ctx.fillStyle = 'rgba(10,14,28,.55)'; pill(ctx, 8, 8, W - 16, 38, 10); ctx.fill();
    g.text(g.t('score'), 20, 23, { size: 10, color: th.muted, weight: 700 });
    g.text(String(st.score), 20, 40, { size: 17, color: th.ink, weight: 800 });
    g.text(g.t('best'), W - 20, 23, { size: 10, color: th.muted, weight: 700, align: 'right' });
    g.text(String(best), W - 20, 40, { size: 17, color: C.accent, weight: 800, align: 'right' });
    g.text(g.t('level'), W / 2, 23, { size: 10, color: th.muted, weight: 700, align: 'center' });
    // точки волн
    for (var w = 1; w <= st.waves; w++) {
      ctx.fillStyle = w < st.wave || (w === st.wave && st.phase === 'clear') ? C.accent : w === st.wave ? '#4fd2ff' : 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(W / 2 - (st.waves - 1) * 7 + (w - 1) * 14, 35, 4, 0, 6.283); ctx.fill();
    }
    // запасные корабли
    var res = Math.max(0, st.lives - (st.player.alive ? 1 : 0));
    for (var i = 0; i < Math.min(res, 6); i++) { ctx.save(); ctx.translate(22 + i * 26, st.H - 18); ctx.scale(0.62, 0.62); ship(ctx, 0, 0, 0, false); ctx.restore(); }
  }

  function banner(ctx, st, g) {
    if (!st.banner) return;
    var s = st.banner === 'wave' ? g.t('wave') + ' ' + st.wave + ' / ' + st.waves : g.t(st.banner);
    var col = st.banner === 'captured' ? '#ff5d8a' : st.banner === 'twin' ? '#45e08a' : st.banner === 'wave' ? '#ffffff' : C.accent;
    var y = st.H * 0.56, a = Math.min(1, st.bannerT * 3);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = '800 22px ' + g.th().font; var w = Math.max(220, ctx.measureText(s).width + 56);
    ctx.fillStyle = 'rgba(12,16,34,.78)'; pill(ctx, st.W / 2 - w / 2, y - 32, w, 48, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,122,26,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    g.text(s, st.W / 2, y, { size: 22, color: col, align: 'center', weight: 800 });
    if (st.banner === 'wave' && st.wave === 1) g.text(g.t('controls'), st.W / 2, y + 40, { size: 12, color: g.th().muted, align: 'center', weight: 600 });
    ctx.restore();
  }

  function icon(ctx, kind, x, y, g) {
    if (kind === 'ship') { ship(ctx, x, y, g.time, false); return; }
    enemy(ctx, { kind: kind, x: x, y: y, ang: 0, id: 1, hurt: false }, g.time);
  }

  R.modern = { bg: bg, draw: draw, icon: icon };
})(typeof window !== 'undefined' ? window : globalThis);
