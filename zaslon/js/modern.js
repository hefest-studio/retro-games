/* ЗАСЛОН · рендер MODERN (по умолчанию). ZASLON.modern = { P, bg, draw, icon, ship, shopIcon, life }
   Векторная графика: градиенты, свечение, параллакс в 4 слоя (звёзды ×3 + фермы станции по краям),
   кольца взрывов. Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var Z = global.ZASLON = global.ZASLON || {};

  var P = {
    pixel: false, font: null,
    ink: '#eef2f8', muted: '#8d9ab3', dim: '#5d6880', accent: '#ff7a1a', good: '#37d67a', bad: '#ff4d6a', warn: '#ffb020',
    cyan: '#38d9ff', scrap: '#ffd36a', off: 'rgba(140,160,200,.22)', line: '#22304a', selBg: '#2a1a10',
    en: { mite: '#45e08a', dart: '#ff4f86', weaver: '#a58bff', hulk: '#9fb0c8', carrier: '#ffd23a' },
    wpn: { spark: '#ffb43a', ray: '#5fe3ff', shot: '#ff6a4a' }
  };
  var SECT = [['#060a1c', '#0d1838', '#16224a'], ['#0c0718', '#1d1036', '#2e1446'], ['#03111a', '#07283a', '#0b3a48'],
              ['#120806', '#2a120c', '#3e1c10'], ['#0e0612', '#260a22', '#3d0c26']];

  function rr(ctx, x, y, w, h, r) { Z.ui.roundRect(ctx, x, y, w, h, r); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ---------- Фон: градиент сектора, туманность, 3 слоя звёзд, фермы по краям ----------
  var gradCache = {};
  function bg(ctx, g, scroll, sector) {
    var W = g.W, H = g.H, sc = SECT[((sector || 1) - 1) % 5], key = sc[0];
    if (!gradCache[key]) {
      var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sc[0]); gr.addColorStop(0.6, sc[1]); gr.addColorStop(1, sc[2]);
      gradCache[key] = gr;
    }
    ctx.fillStyle = gradCache[key]; ctx.fillRect(0, 0, W, H);
    // туманность медленно плывёт
    var ny = ((scroll * 0.08) % (H * 2)) - H * 0.5;
    var nb = ctx.createRadialGradient(W * 0.7, ny, 10, W * 0.7, ny, W * 0.8);
    nb.addColorStop(0, 'rgba(120,90,255,.13)'); nb.addColorStop(1, 'rgba(120,90,255,0)');
    ctx.fillStyle = nb; ctx.fillRect(0, 0, W, H);
    // звёзды: позиции из хеша, сдвиг по scroll (параллакс)
    var sp = [0.15, 0.4, 0.9], cnt = [40, 28, 16];
    for (var l = 0; l < 3; l++) {
      ctx.fillStyle = l === 2 ? '#ffffff' : l === 1 ? '#c8d6ff' : '#7f8fb8';
      for (var i = 0; i < cnt[l]; i++) {
        var x = hash(i + l * 100) * W, y = (hash(i * 3 + l * 77) * H + scroll * sp[l]) % H;
        var r = 0.6 + l * 0.5;
        if (l === 2) { ctx.globalAlpha = 0.5; ctx.fillRect(x - 0.5, y - 4, 1, 8); ctx.globalAlpha = 1; }
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
    // фермы станции по краям (ближний слой)
    var seg = 120, off = (scroll * 1.2) % seg;
    for (var side = 0; side < 2; side++) {
      for (var k = -1; k < H / seg + 1; k++) {
        var yy = k * seg + off, idx = Math.floor((scroll * 1.2) / seg) - k, w = 14 + hash(idx + side * 50) * 26;
        var x0 = side ? W - w : 0;
        ctx.fillStyle = 'rgba(30,42,70,.85)'; ctx.fillRect(x0, yy, w, seg - 6);
        ctx.fillStyle = 'rgba(70,95,140,.5)'; ctx.fillRect(side ? x0 : x0 + w - 2, yy, 2, seg - 6);
        ctx.strokeStyle = 'rgba(70,95,140,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + w, yy + seg - 6); ctx.moveTo(x0 + w, yy); ctx.lineTo(x0, yy + seg - 6); ctx.stroke();
        if (hash(idx * 7 + side) > 0.5) { ctx.fillStyle = (Math.floor(g.time * 2 + idx) % 2) ? '#ff7a1a' : '#5a2a10'; ctx.fillRect(side ? x0 + 4 : x0 + w - 7, yy + 10, 3, 3); }
      }
    }
  }

  // ---------- Корабль ----------
  function ship(ctx, x, y, g, o) {
    o = o || {};
    var t = g.time;
    if (o.modules) for (var m = 0; m < o.modules; m++) module(ctx, x + (m === 0 ? -Z.consts.MOD_DX : Z.consts.MOD_DX), y + 6, t);
    // пламя
    var fl = 10 + Math.sin(t * 40) * 3;
    var fg = ctx.createLinearGradient(0, y + 10, 0, y + 12 + fl);
    fg.addColorStop(0, 'rgba(255,200,90,.95)'); fg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(x - 5, y + 10); ctx.lineTo(x + 5, y + 10); ctx.lineTo(x, y + 14 + fl); ctx.closePath(); ctx.fill();
    // корпус
    var hg = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
    hg.addColorStop(0, '#8a9bbd'); hg.addColorStop(0.5, '#f4f7fc'); hg.addColorStop(1, '#8a9bbd');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(x, y - 18); ctx.lineTo(x + 5, y - 6); ctx.lineTo(x + 16, y + 6); ctx.lineTo(x + 16, y + 11); ctx.lineTo(x + 5, y + 8);
    ctx.lineTo(x + 4, y + 12); ctx.lineTo(x - 4, y + 12); ctx.lineTo(x - 5, y + 8); ctx.lineTo(x - 16, y + 11); ctx.lineTo(x - 16, y + 6); ctx.lineTo(x - 5, y - 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff7a1a'; ctx.fillRect(x - 16, y + 6, 3, 5); ctx.fillRect(x + 13, y + 6, 3, 5);
    ctx.fillStyle = '#38d9ff'; ctx.beginPath(); ctx.ellipse(x, y - 4, 2.6, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (o.shield) {
      var a = typeof o.shield === 'number' ? o.shield : 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(56,217,255,' + (0.18 + 0.1 * a + 0.08 * Math.sin(t * 6)) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 1, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(56,217,255,' + (0.04 + 0.03 * a) + ')'; ctx.fill();
      ctx.restore();
    }
  }
  function module(ctx, x, y, t) {
    ctx.fillStyle = '#5a6a8a'; rr(ctx, x - 5, y - 8, 10, 16, 4); ctx.fill();
    ctx.fillStyle = '#dfe8f5'; rr(ctx, x - 3, y - 11, 6, 8, 3); ctx.fill();
    ctx.fillStyle = (Math.floor(t * 6) % 2) ? '#38d9ff' : '#1a8fb0'; ctx.fillRect(x - 1.5, y + 2, 3, 3);
  }
  function life(ctx, x, y) {
    ctx.fillStyle = '#eef2f8';
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y + 5); ctx.lineTo(x, y + 2); ctx.lineTo(x - 7, y + 5); ctx.closePath(); ctx.fill();
  }

  // ---------- Враги ----------
  function enemy(ctx, e, t) {
    var x = e.x, y = e.y, c = P.en[e.kind], hurt = e.hurtT > 0, i;
    ctx.save();
    if (e.kind === 'mite') {
      ctx.strokeStyle = '#0f7a45'; ctx.lineWidth = 2;
      for (i = 0; i < 3; i++) {
        var lg = Math.sin(t * 12 + i) * 2;
        ctx.beginPath(); ctx.moveTo(x - 6, y - 4 + i * 4); ctx.lineTo(x - 13, y - 6 + i * 5 + lg); ctx.moveTo(x + 6, y - 4 + i * 4); ctx.lineTo(x + 13, y - 6 + i * 5 - lg); ctx.stroke();
      }
      var mg = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10); mg.addColorStop(0, '#c8ff9a'); mg.addColorStop(1, c);
      ctx.fillStyle = hurt ? '#fff' : mg; ctx.beginPath(); ctx.ellipse(x, y, 8, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3355'; ctx.beginPath(); ctx.arc(x, y + 4, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'dart') {
      var ang = e.lock ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : 0;
      ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = hurt ? '#fff' : c;
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(12, -8); ctx.lineTo(4, -4); ctx.lineTo(0, -10); ctx.lineTo(-4, -4); ctx.lineTo(-12, -8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(0, 2, 2.5, 0, Math.PI * 2); ctx.fill();
      if (e.lock) { ctx.fillStyle = 'rgba(255,79,134,.35)'; ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(4, -8); ctx.lineTo(0, -22); ctx.closePath(); ctx.fill(); }
    } else if (e.kind === 'weaver') {
      ctx.translate(x, y);
      ctx.strokeStyle = 'rgba(165,139,255,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 17, 6, t * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = hurt ? '#fff' : c;
      ctx.beginPath(); for (i = 0; i < 6; i++) { var a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1a60'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8ad8'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'hulk') {
      ctx.translate(x, y);
      var hg = ctx.createLinearGradient(-18, 0, 18, 0); hg.addColorStop(0, '#4a5670'); hg.addColorStop(0.5, '#a9b8d0'); hg.addColorStop(1, '#4a5670');
      ctx.fillStyle = hurt ? '#fff' : hg;
      ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(18, -14); ctx.lineTo(13, 14); ctx.lineTo(6, 19); ctx.lineTo(-6, 19); ctx.lineTo(-13, 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a3346'; ctx.fillRect(-12, -6, 24, 4); ctx.fillRect(-12, 2, 24, 4);
      var gl = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.fillStyle = 'rgba(255,122,26,' + (0.5 + gl * 0.5) + ')'; ctx.fillRect(-4, 12, 8, 4);
      // полоска прочности
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-16, -22, 32, 3);
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(-16, -22, 32 * Math.max(0, e.hp / e.max), 3);
    } else if (e.kind === 'carrier') {
      ctx.translate(x, y);
      ctx.fillStyle = hurt ? '#fff' : '#8a6a1a'; rr(ctx, -15, -11, 30, 22, 9); ctx.fill();
      ctx.fillStyle = hurt ? '#fff' : c; rr(ctx, -12, -9, 24, 18, 7); ctx.fill();
      var cg = 0.6 + 0.4 * Math.sin(t * 8);
      ctx.fillStyle = 'rgba(255,255,255,' + cg + ')'; rr(ctx, -6, -5, 12, 10, 4); ctx.fill();
      ctx.fillStyle = '#5a3a0a'; ctx.fillRect(-15, -2, 4, 4); ctx.fillRect(11, -2, 4, 4);
    }
    ctx.restore();
  }
  function icon(ctx, kind, x, y, g) { enemy(ctx, { kind: kind, x: x, y: y, hurtT: 0, hp: 1, max: 1, lock: false, vx: 0, vy: 1 }, g.time); }

  // ---------- Боссы ----------
  function boss(ctx, B, t) {
    var x = B.x, y = B.y, hurt = false, i;   // босс под постоянным огнём — не «белеет», вспышка ниже
    ctx.save(); ctx.translate(x, y);
    if (B.kind === 'millstone') {
      ctx.rotate(B.spin);
      ctx.fillStyle = hurt ? '#fff' : '#56627a';
      ctx.beginPath(); for (i = 0; i < 16; i++) { var a = i * Math.PI / 8, r = i % 2 ? 40 : 48; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.75); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a97b0'; ctx.beginPath(); ctx.ellipse(0, 0, 32, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(-B.spin);
      var cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 16); cg.addColorStop(0, '#fff3c8'); cg.addColorStop(0.5, '#ff7a1a'); cg.addColorStop(1, '#7a2a08');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    } else if (B.kind === 'pincer') {
      var op = Math.sin(t * 3) * 0.25;
      for (var s = -1; s <= 1; s += 2) {
        ctx.save(); ctx.translate(s * 40, 4); ctx.rotate(s * op);
        ctx.fillStyle = hurt ? '#fff' : '#c04a2a';
        ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(8, -12); ctx.lineTo(10, 18); ctx.lineTo(s * 3, 28); ctx.lineTo(-10, 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb08a'; ctx.fillRect(-3, 14, 6, 8);
        ctx.restore();
      }
      var bg2 = ctx.createLinearGradient(0, -26, 0, 22); bg2.addColorStop(0, '#ff7a5a'); bg2.addColorStop(1, '#7a1e10');
      ctx.fillStyle = hurt ? '#fff' : bg2; rr(ctx, -30, -24, 60, 44, 16); ctx.fill();
      ctx.fillStyle = '#1a0806'; ctx.fillRect(-16, -6, 32, 8);
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(-14 + ((t * 30) % 24), -4, 6, 4);
    } else if (B.kind === 'hive') {
      var cells = [[0, 0], [-20, -12], [20, -12], [-20, 12], [20, 12], [0, -24], [0, 24], [-40, 0], [40, 0]];
      for (i = 0; i < cells.length; i++) {
        var c = cells[i], pul = 0.5 + 0.5 * Math.sin(t * 4 + i);
        ctx.fillStyle = hurt ? '#fff' : i === 0 ? '#ffb020' : '#b06a10';
        ctx.beginPath(); for (var k = 0; k < 6; k++) { var a2 = k * Math.PI / 3; ctx.lineTo(c[0] + Math.cos(a2) * 12, c[1] + Math.sin(a2) * 12); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,140,' + (0.3 + pul * 0.5) + ')'; ctx.beginPath(); ctx.arc(c[0], c[1], 4, 0, Math.PI * 2); ctx.fill();
      }
    } else if (B.kind === 'pendulum') {
      ctx.strokeStyle = '#6a7898'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-(x - 240) * 0.4, -y - 10); ctx.stroke();
      var pg = ctx.createRadialGradient(-8, -8, 4, 0, 0, 34); pg.addColorStop(0, '#d0dcf0'); pg.addColorStop(1, '#3a4660');
      ctx.fillStyle = hurt ? '#fff' : pg; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10141e'; ctx.beginPath(); ctx.ellipse(0, 4, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
      var eg = B.beam ? '#ff3355' : '#38d9ff';
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(0, 4, 6, 0, Math.PI * 2); ctx.fill();
    } else if (B.kind === 'forge') {
      var ph = B.phaseN || 1, glow = ph === 1 ? '#ff9a3a' : ph === 2 ? '#ff5a2a' : '#ff2a5a';
      ctx.fillStyle = hurt ? '#fff' : '#3a2a26'; rr(ctx, -56, -36, 112, 72, 14); ctx.fill();
      ctx.fillStyle = '#5e4640'; rr(ctx, -48, -30, 96, 18, 6); ctx.fill();
      var fg = ctx.createRadialGradient(0, 10, 4, 0, 10, 34); fg.addColorStop(0, '#fff3c8'); fg.addColorStop(0.4, glow); fg.addColorStop(1, 'rgba(60,10,0,1)');
      ctx.fillStyle = fg; rr(ctx, -34, -8, 68, 36, 10); ctx.fill();
      ctx.fillStyle = '#2a1a16'; for (i = -3; i <= 3; i++) ctx.fillRect(i * 9 - 2, -8, 4, 36);
      ctx.fillStyle = glow; ctx.fillRect(-60, -6, 8, 14); ctx.fillRect(52, -6, 8, 14);
    }
    if (B.hurtT > 0) {   // мягкая вспышка попадания
      ctx.globalCompositeOperation = 'lighter';
      var hg2 = ctx.createRadialGradient(0, 0, 4, 0, 0, B.w); hg2.addColorStop(0, 'rgba(255,240,200,.28)'); hg2.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = hg2; ctx.beginPath(); ctx.arc(0, 0, B.w, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function beam(ctx, Bm, H, t) {
    if (!Bm) return;
    ctx.save();
    if (Bm.t < Bm.warn) {
      ctx.strokeStyle = 'rgba(255,60,90,' + (0.35 + 0.35 * Math.sin(t * 30)) + ')'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(Bm.x - 14, 0); ctx.lineTo(Bm.x - 14, H); ctx.moveTo(Bm.x + 14, 0); ctx.lineTo(Bm.x + 14, H); ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      var w = 30 + Math.sin(t * 50) * 3, gr = ctx.createLinearGradient(Bm.x - w / 2, 0, Bm.x + w / 2, 0);
      gr.addColorStop(0, 'rgba(255,40,80,0)'); gr.addColorStop(0.3, 'rgba(255,40,80,.8)'); gr.addColorStop(0.5, 'rgba(255,240,250,1)'); gr.addColorStop(0.7, 'rgba(255,40,80,.8)'); gr.addColorStop(1, 'rgba(255,40,80,0)');
      ctx.fillStyle = gr; ctx.fillRect(Bm.x - w / 2, 0, w, H);
    }
    ctx.restore();
  }

  function wpnGlyph(ctx, type, x, y, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    if (type === 'spark') { ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x - 6, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y - 7); ctx.moveTo(x, y + 6); ctx.lineTo(x + 6, y - 6); ctx.stroke(); }
    else if (type === 'ray') { ctx.fillRect(x - 2, y - 7, 4, 14); ctx.globalAlpha = 0.4; ctx.fillRect(x - 4, y - 7, 8, 14); }
    else { for (var i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 1.05) * 5, y + Math.sin(i * 1.05) * 5, 1.6, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }

  // ---------- Кадр ----------
  function draw(ctx, S, g) {
    var W = g.W, H = g.H, t = g.time, i, p = S.player;
    bg(ctx, g, S.scroll, S.sector);
    // заслон у нижнего края
    var bf = S.base / 100;
    if (S.baseHitT > 0) { ctx.fillStyle = 'rgba(255,60,90,' + S.baseHitT * 0.5 + ')'; ctx.fillRect(0, H - 40, W, 40); }
    Z.ui.barrier(ctx, 0, Z.consts.BREACH_Y, W, bf, t, P);
    // металлолом
    for (i = 0; i < S.scraps.length; i++) {
      var sc = S.scraps[i];
      ctx.save(); ctx.translate(sc.x, sc.y); ctx.rotate(t * 3 + i);
      ctx.fillStyle = '#c9a54a'; ctx.fillRect(-4, -4, 8, 8); ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }
    // капсулы
    for (i = 0; i < S.caps.length; i++) {
      var c = S.caps[i], col = P.wpn[c.ty];
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(10,14,26,.9)'; rr(ctx, c.x - 13, c.y - 11, 26, 22, 9); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; rr(ctx, c.x - 13, c.y - 11, 26, 22, 9); ctx.stroke();
      ctx.restore();
      wpnGlyph(ctx, c.ty, c.x, c.y, col);
    }
    // враги
    for (i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead) enemy(ctx, S.enemies[i], t);
    if (S.boss) { beam(ctx, S.boss.beam, H, t); boss(ctx, S.boss, t); }
    // луч игрока
    if (p.ray) {
      var R = p.ray, wf = R.w * (0.85 + 0.15 * Math.sin(t * 60));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var rg = ctx.createLinearGradient(R.x - wf, 0, R.x + wf, 0);
      rg.addColorStop(0, 'rgba(56,217,255,0)'); rg.addColorStop(0.35, 'rgba(56,217,255,.7)'); rg.addColorStop(0.5, 'rgba(230,252,255,1)'); rg.addColorStop(0.65, 'rgba(56,217,255,.7)'); rg.addColorStop(1, 'rgba(56,217,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(R.x - wf, R.y1, wf * 2, R.y0 - R.y1);
      if (R.y1 > 0) { ctx.fillStyle = 'rgba(180,240,255,.6)'; ctx.beginPath(); ctx.arc(R.x, R.y1, wf * 0.9 + Math.sin(t * 40) * 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    // пули игрока
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < S.pb.length; i++) {
      var b = S.pb[i];
      if (b.k === 'shot') { ctx.fillStyle = '#ff8a5a'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
      else if (b.k === 'mod') { ctx.fillStyle = '#7fe8ff'; ctx.fillRect(b.x - 1, b.y - 6, 2, 10); }
      else { ctx.strokeStyle = '#ffc45a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014); ctx.stroke(); }
    }
    ctx.restore();
    // корабль
    if (p.alive && !(p.inv > 0 && Math.floor(t * 14) % 2 && S.phase !== 'shop')) ship(ctx, p.x, p.y, g, { modules: p.modules, shield: p.shield > 0 ? p.shield / p.shMax : 0 });
    // вражеские пули
    for (i = 0; i < S.eb.length; i++) {
      var q = S.eb[i];
      ctx.fillStyle = 'rgba(255,77,106,.35)'; ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff4d6a'; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // взрывы
    for (i = 0; i < S.booms.length; i++) {
      var o = S.booms[i], k = o.t / o.life, r = o.r * (0.3 + k);
      ctx.save(); ctx.globalAlpha = 1 - k;
      ctx.fillStyle = o.base ? 'rgba(56,217,255,.35)' : 'rgba(255,150,60,.35)'; ctx.beginPath(); ctx.arc(o.x, o.y, r * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = o.base ? '#38d9ff' : '#ffd36a'; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (S.flash > 0) { ctx.fillStyle = 'rgba(200,245,255,' + Math.min(0.7, S.flash) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function shopIcon(ctx, key, x, y, g, S) {
    var p = S.player;
    if (key === 'weapon') wpnGlyph(ctx, p.weapon, x, y - 4, P.wpn[p.weapon]);
    else if (key === 'module') module(ctx, x, y - 2, g.time);
    else if (key === 'shield') { ctx.strokeStyle = P.cyan; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 4, 9, 0, Math.PI * 2); ctx.stroke(); }
    else if (key === 'bomb') { ctx.fillStyle = P.cyan; ctx.beginPath(); for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8, r = i % 2 ? 4 : 10; ctx.lineTo(x + Math.cos(a) * r, y - 4 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
    else if (key === 'repair') { ctx.fillStyle = P.cyan; ctx.fillRect(x - 10, y - 2, 20, 3); ctx.fillStyle = P.good; ctx.fillRect(x - 2, y - 12, 4, 10); ctx.fillRect(x - 6, y - 9, 12, 4); }
    else if (key === 'life') life(ctx, x, y - 4);
    else if (key === 'next') { ctx.fillStyle = P.good; ctx.beginPath(); ctx.moveTo(x - 7, y - 12); ctx.lineTo(x + 8, y - 4); ctx.lineTo(x - 7, y + 4); ctx.closePath(); ctx.fill(); }
  }

  Z.modern = { P: P, bg: bg, draw: draw, icon: icon, ship: ship, shopIcon: shopIcon, life: life };
})(typeof window !== 'undefined' ? window : globalThis);
