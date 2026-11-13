/* ПОДРЯД · рендер обеих тем на canvas 640×640: поле 440×640 слева, панель подрядчика справа (казна, броня, щит, снаряжение).
   modern — вид сверху на море облаков, по которому плывут парящие острова с цехами артели; мягкие тени, свечение выстрелов.
   retro — поле рисуется в 220×320 и растягивается без сглаживания (крупный пиксель), 16-цветная палитра, плоские заливки.
   Ангар — свой экран на всю канву (список снаряжения слева, крыло с модулями и описание справа).
   PODRYAD.render = { draw, hangar, debrief, hero, update, spawn, pop, shake, flash, clearFx, PM, PR }. */
(function (global) {
  'use strict';
  var P = global.PODRYAD = global.PODRYAD || {};
  var D = P.DATA, K = P.logic.K, FW = K.FW, FH = K.FH, W = 640, H = 640, PX = 440, TAU = Math.PI * 2;

  // палитры: общие + по секторам (море облаков, острова)
  var PM = { retro: false, bg: '#10161c', panel: '#141b22', line: '#2b3a44', ink: '#eef3ee', muted: '#93a3a6', accent: '#4caf8e', gold: '#f2c14e', good: '#7be0a0', bad: '#ff6a55', warn: '#ffc34d', shield: '#6fd8ff', armor: '#ff9a4a',
    wing: '#efe6cf', wingD: '#b9ad92', stripe: '#3fb59a', cockpit: '#ff9a3c', prop: 'rgba(230,236,240,.35)',
    rust: '#b5653a', rustD: '#6b3520', rustL: '#e09a63', lamp: '#ffd447', eye: '#ff4b3a', steel: '#9aa6b0', steelD: '#55606a',
    eb: '#ff8a3a', ebCore: '#fff3d6', shots: ['#fff2a8', '#bff6ff', '#ffb35a', '#d7b8ff', '#ffffff', '#ffe0a0'],
    sec: [
      { sea: '#1d4752', sea2: '#16363f', cloud: 'rgba(120,190,196,.22)', cloud2: 'rgba(200,236,232,.14)', rock: '#6e4a30', rockD: '#3e2a1c', top: '#6fa058', top2: '#87b866', rim: '#c07a40' },
      { sea: '#26324a', sea2: '#1b2438', cloud: 'rgba(150,165,205,.22)', cloud2: 'rgba(215,222,245,.13)', rock: '#5f626e', rockD: '#33353f', top: '#7f948c', top2: '#97ab9f', rim: '#a9b3bf' },
      { sea: '#3a2026', sea2: '#2a161b', cloud: 'rgba(200,120,100,.2)', cloud2: 'rgba(255,200,170,.12)', rock: '#5a3828', rockD: '#321e15', top: '#9c5a30', top2: '#b8703c', rim: '#e09050' }
    ] };
  var PR = { retro: true, bg: '#000000', panel: '#000000', line: '#5555ff', ink: '#ffffff', muted: '#aaaaaa', accent: '#55ffff', gold: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', shield: '#55ffff', armor: '#ffaa55',
    wing: '#ffffff', wingD: '#aaaaaa', stripe: '#00aaaa', cockpit: '#ff5555', prop: '#aaaaaa',
    rust: '#aa5500', rustD: '#aa0000', rustL: '#ffaa55', lamp: '#ffff55', eye: '#ff5555', steel: '#aaaaaa', steelD: '#555555',
    eb: '#ffff55', ebCore: '#ffffff', shots: ['#ffff55', '#55ffff', '#ffaa55', '#ff55ff', '#ffffff', '#ffffff'],
    sec: [
      { sea: '#0000aa', sea2: '#0000aa', cloud: '#5555ff', cloud2: '#5555ff', rock: '#aa5500', rockD: '#000000', top: '#00aa00', top2: '#55ff55', rim: '#aa5500' },
      { sea: '#000000', sea2: '#000000', cloud: '#555555', cloud2: '#555555', rock: '#555555', rockD: '#000000', top: '#00aaaa', top2: '#aaaaaa', rim: '#aaaaaa' },
      { sea: '#aa0000', sea2: '#aa0000', cloud: '#000000', cloud2: '#000000', rock: '#aa5500', rockD: '#000000', top: '#aa5500', top2: '#ffaa55', rim: '#ffaa55' }
    ] };

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.fill(); }
  function poly(ctx, pts, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
  function money(n) { n = Math.round(n); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return (n < 0 ? '−' : '') + '◈' + s; }
  P.money = money;
  function txt(g, s, x, y, o, C) {
    var c = g.ctx; c.fillStyle = o.color || C.ink;
    c.font = (o.weight || 800) + ' ' + (C.retro ? Math.max(8, Math.round((o.size || 14) * 0.85)) : (o.size || 14)) + 'px ' + (C.retro ? '"Courier New", ui-monospace, monospace' : 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
    c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'alphabetic';
    c.fillText(o.upper && C.retro ? String(s).toUpperCase() : s, x, y);
  }
  function bar(ctx, x, y, w, h, f, col, C) {
    ctx.fillStyle = C.retro ? '#555555' : 'rgba(255,255,255,.08)'; if (C.retro) ctx.fillRect(x, y, w, h); else { rr(ctx, x, y, w, h, h / 2); ctx.fill(); }
    var fw = Math.max(0, Math.min(1, f)) * w; if (fw <= 0) return;
    ctx.fillStyle = col; if (C.retro) ctx.fillRect(x, y, fw, h); else { rr(ctx, x, y, fw, h, h / 2); ctx.fill(); }
  }

  // ---------- эффекты ----------
  var FX = { parts: [], pops: [], waves: [], shake: 0, flash: 0 };
  function clearFx() { FX.parts.length = 0; FX.pops.length = 0; FX.waves.length = 0; FX.shake = 0; FX.flash = 0; }
  // kind: 0 огонь, 1 искры, 2 дым, 3 щит, 4 обломки
  function spawn(x, y, n, kind, spd, life, size) {
    for (var i = 0; i < n && FX.parts.length < 700; i++) {
      var a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.7);
      FX.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 2 ? 20 : 0), t: 0, life: life * (0.6 + Math.random() * 0.6), k: kind, s: size * (0.6 + Math.random() * 0.8) });
    }
  }
  function pop(x, y, s, col, big) { if (FX.pops.length < 40) FX.pops.push({ x: x, y: y, s: s, col: col, t: 0, big: !!big }); }
  function wave(x, y, r, life, col) { FX.waves.push({ x: x, y: y, r: r, t: 0, life: life, col: col }); }
  function update(dt) {
    var i, p;
    for (i = FX.parts.length - 1; i >= 0; i--) { p = FX.parts[i]; p.t += dt; if (p.t >= p.life) { FX.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt + (p.k === 2 ? 0 : 20 * dt); p.vx *= 1 - 2 * dt; p.vy *= 1 - 2 * dt; }
    for (i = FX.pops.length - 1; i >= 0; i--) { p = FX.pops[i]; p.t += dt; p.y -= 30 * dt; if (p.t > 1) FX.pops.splice(i, 1); }
    for (i = FX.waves.length - 1; i >= 0; i--) { p = FX.waves[i]; p.t += dt; if (p.t > p.life) FX.waves.splice(i, 1); }
    FX.shake = Math.max(0, FX.shake - dt); FX.flash = Math.max(0, FX.flash - dt);
  }

  // ---------- море облаков и острова ----------
  function sea(ctx, C, S, time) {
    var Z = C.sec[S.si] || C.sec[0];
    if (C.retro) { ctx.fillStyle = Z.sea; ctx.fillRect(0, 0, FW, FH); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, FH); gr.addColorStop(0, Z.sea2); gr.addColorStop(1, Z.sea); ctx.fillStyle = gr; ctx.fillRect(0, 0, FW, FH); }
    // два слоя облаков с параллаксом (медленнее островов)
    for (var layer = 0; layer < 2; layer++) {
      var sp = layer ? 0.55 : 0.3, off = S.d * sp, step = layer ? 150 : 110, col = layer ? Z.cloud2 : Z.cloud;
      var i0 = Math.floor(off / step) - 1;
      for (var i = i0; i < i0 + Math.ceil(FH / step) + 3; i++) {
        var y = FH - (i * step - off) - 40, hx = hash(i * 7 + layer * 1000 + S.si * 31);
        for (var k = 0; k < 3; k++) {
          var cx = ((hx * 997 + k * 0.37) % 1) * (FW + 120) - 60, cr = 26 + hash(i * 13 + k + layer * 77) * (layer ? 46 : 30);
          if (C.retro) {
            ctx.fillStyle = col;
            for (var dy = -cr * 0.5; dy < cr * 0.5; dy += 6) { var ww = Math.sqrt(Math.max(0, cr * cr * 0.25 - dy * dy)) * 2.4; ctx.fillRect((cx - ww / 2) | 0, (y + dy + k * 20) | 0, ww | 0, 4); }
          } else {
            ctx.fillStyle = col; ctx.beginPath();
            ctx.ellipse(cx, y + k * 20, cr * 1.6, cr * 0.7, 0, 0, TAU); ctx.ellipse(cx + cr * 0.9, y + k * 20 - cr * 0.25, cr, cr * 0.55, 0, 0, TAU); ctx.fill();
          }
        }
      }
    }
  }
  function islePath(ctx, is, dx, dy, sc) {
    var n = 14, cx = is.x + is.w / 2 + dx, cy = is.y + is.h / 2 + dy;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU, j = 0.82 + hash(is.s + i * 31) * 0.3;
      var x = cx + Math.cos(a) * is.w / 2 * j * sc, y = cy + Math.sin(a) * is.h / 2 * j * sc;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  function isles(ctx, C, S) {
    var Z = C.sec[S.si] || C.sec[0];
    S.isles.forEach(function (is) {
      if (C.retro) {
        ctx.fillStyle = Z.rockD; islePath(ctx, is, 0, 14, 0.94); ctx.fill();
        ctx.fillStyle = Z.rock; islePath(ctx, is, 0, 6, 1); ctx.fill();
        ctx.fillStyle = Z.top; islePath(ctx, is, 0, 0, 0.92); ctx.fill();
        return;
      }
      ctx.fillStyle = 'rgba(0,0,0,.22)'; islePath(ctx, is, 18, 34, 0.95); ctx.fill();     // тень на облаках
      ctx.fillStyle = Z.rockD; islePath(ctx, is, 0, 16, 0.9); ctx.fill();                // каменное «днище»
      ctx.fillStyle = Z.rock; islePath(ctx, is, 0, 7, 1); ctx.fill();
      var gr = ctx.createLinearGradient(0, is.y, 0, is.y + is.h); gr.addColorStop(0, Z.top2); gr.addColorStop(1, Z.top);
      ctx.fillStyle = gr; islePath(ctx, is, 0, 0, 0.93); ctx.fill();
      ctx.strokeStyle = Z.rim; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; islePath(ctx, is, 0, 0, 0.93); ctx.stroke(); ctx.globalAlpha = 1;
      // россыпь камней
      for (var i = 0; i < 4; i++) { var h1 = hash(is.s + i * 5 + 1); circ(ctx, is.x + 14 + h1 * (is.w - 28), is.y + 12 + hash(is.s + i * 9) * (is.h - 30), 2 + h1 * 2.5, Z.rim); }
    });
  }
  function groundObj(ctx, C, gd, P0, time) {
    var x = gd.x, y = gd.y, dead = gd.hp <= 0;
    if (dead) {
      circ(ctx, x, y, gd.r * 0.85, C.retro ? '#555555' : 'rgba(58,40,30,.8)');
      circ(ctx, x + 1, y + 1, gd.r * 0.5, C.retro ? '#000000' : 'rgba(28,20,16,.85)');
      for (var q = 0; q < 5; q++) { var qa = q * 1.3 + gd.id, qr = gd.r * (0.6 + 0.3 * hash(gd.id * 7 + q)); ctx.fillStyle = C.retro ? '#aa5500' : '#7a5a44'; ctx.fillRect(x + Math.cos(qa) * qr - 2, y + Math.sin(qa) * qr - 2, 4, 3); }
      if (((time * 8 + gd.id) | 0) % 3) circ(ctx, x + Math.sin(time * 9 + gd.id) * 3, y - 2, C.retro ? 3 : 2.5, C.retro ? '#ffff55' : '#ff9a3a');
      return;
    }
    switch (gd.kind) {
      case 'depot':
        ctx.fillStyle = C.retro ? '#aa5500' : '#8a6a48'; ctx.fillRect(x - 15, y - 12, 30, 24);
        ctx.fillStyle = C.retro ? '#ffaa55' : '#b48c5e'; ctx.fillRect(x - 15, y - 12, 30, 7);
        ctx.fillStyle = C.retro ? '#000000' : '#4a3626'; ctx.fillRect(x - 5, y + 2, 10, 10);
        if (!C.retro) { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; for (var i = -12; i < 15; i += 6) { ctx.beginPath(); ctx.moveTo(x + i, y - 5); ctx.lineTo(x + i, y + 12); ctx.stroke(); } }
        break;
      case 'factory':
        ctx.fillStyle = C.retro ? '#aa0000' : '#a0503a'; ctx.fillRect(x - 22, y - 14, 44, 30);
        ctx.fillStyle = C.retro ? '#ff5555' : '#c06a4a'; for (var k = 0; k < 3; k++) poly(ctx, [x - 22 + k * 15, y - 14, x - 7 + k * 15, y - 14, x - 7 + k * 15, y - 22], C.retro ? '#ff5555' : '#c06a4a');
        circ(ctx, x + 14, y + 6, 6, C.retro ? '#555555' : '#5a4038'); circ(ctx, x + 14, y + 6, 3, '#1a1210');
        if (!C.retro) { var sm = (time * 0.7 + gd.id * 0.13) % 1; ctx.globalAlpha = 0.35 * (1 - sm); circ(ctx, x + 14 + sm * 10, y + 6 - sm * 26, 5 + sm * 8, '#cfc6bd'); ctx.globalAlpha = 1; }
        ctx.fillStyle = C.retro ? '#ffff55' : '#ffcf6a'; ctx.fillRect(x - 16, y - 2, 5, 5); ctx.fillRect(x - 6, y - 2, 5, 5);
        break;
      case 'flak': {
        circ(ctx, x, y, 11, C.retro ? '#555555' : '#5d5550'); circ(ctx, x, y, 7, C.retro ? '#aaaaaa' : '#8a8078');
        var a = Math.atan2(P0.y - y, P0.x - x); ctx.strokeStyle = C.retro ? '#ffffff' : '#2e2a28'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15); ctx.stroke();
        circ(ctx, x, y, 3, C.eye);
        break;
      }
      case 'tank':
        circ(ctx, x, y, 15, C.retro ? '#aaaaaa' : '#8b98a0'); circ(ctx, x, y, 11, C.retro ? '#555555' : '#a7b3ba');
        ctx.strokeStyle = C.retro ? '#000000' : 'rgba(40,50,56,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
        break;
    }
    if (gd.hp < gd.max && !C.retro) bar(ctx, x - 14, y + gd.r + 3, 28, 3, gd.hp / gd.max, C.armor, C);
  }

  // ---------- крыло пилота ----------
  function hero(ctx, C, x, y, o, time) {
    o = o || {}; var bank = o.bank || 0, sc = o.scale || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc * (1 - Math.abs(bank) * 0.22), sc);
    if (!C.retro && !o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(10, 26, 24, 8, 0, 0, TAU); ctx.fill(); }
    // винт-толкач позади
    if (C.retro) { ctx.fillStyle = C.prop; ctx.fillRect(-7, 9, 14, 2); }
    else { ctx.fillStyle = C.prop; ctx.beginPath(); ctx.ellipse(0, 11, 9, 3.2, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; var pa = time * 40; ctx.beginPath(); ctx.moveTo(-Math.cos(pa) * 9, 11); ctx.lineTo(Math.cos(pa) * 9, 11); ctx.stroke(); }
    // летающее крыло
    poly(ctx, [0, -17, 9, -4, 28, 6, 27, 10, 9, 7, 0, 10, -9, 7, -27, 10, -28, 6, -9, -4], C.wing);
    poly(ctx, [0, 10, 9, 7, 27, 10, 28, 6, 22, 7, 8, 4, 0, 6, -8, 4, -22, 7, -28, 6, -27, 10, -9, 7], C.wingD);
    // полоса мастерской по передней кромке
    ctx.strokeStyle = C.stripe; ctx.lineWidth = C.retro ? 2 : 2.5; ctx.beginPath(); ctx.moveTo(-26, 6); ctx.lineTo(-9, -3); ctx.lineTo(0, -15); ctx.lineTo(9, -3); ctx.lineTo(26, 6); ctx.stroke();
    // фонарь кабины
    ctx.fillStyle = C.cockpit; ctx.beginPath(); ctx.ellipse(0, -4, 4, 6.5, 0, 0, TAU); ctx.fill();
    if (!C.retro) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-1.3, -6.5, 1.3, 2.4, 0, 0, TAU); ctx.fill(); }
    // модули в гнёздах
    (o.mods || []).forEach(function (m, i) {
      if (!m) return; var mx = i ? 24 : -24, my = 3;
      if (m === 'turret') { circ(ctx, mx, my, 5, C.steel); ctx.fillStyle = C.steelD; ctx.fillRect(mx - 1.5, my - 11, 3, 9); }
      else if (m === 'homer') { ctx.fillStyle = C.steelD; ctx.fillRect(mx - 4, my - 6, 8, 12); circ(ctx, mx - 2, my - 7, 2, C.eye); circ(ctx, mx + 2, my - 7, 2, C.eye); }
      else if (m === 'scythe') { circ(ctx, mx, my, 5, C.retro ? '#ff55ff' : '#b98cff'); circ(ctx, mx, my, 2.2, '#ffffff'); }
    });
    ctx.restore();
  }
  function scytheBeam(ctx, C, x, y, t) {
    var a = -Math.PI / 2 + Math.sin(t * 9) * 1.0, len = 74;
    ctx.save();
    if (!C.retro) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#b98cff'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, len, -Math.PI / 2 - 1.0, -Math.PI / 2 + 1.0); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = C.retro ? '#ff55ff' : '#e6d4ff'; ctx.lineWidth = C.retro ? 3 : 3; ctx.lineCap = 'round';
    if (!C.retro) { ctx.shadowColor = '#b98cff'; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    ctx.restore();
  }

  // ---------- машины Ржавой артели ----------
  function rivets(ctx, C, pts) { if (C.retro) return; ctx.fillStyle = C.rustD; for (var i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.arc(pts[i], pts[i + 1], 1.3, 0, TAU); ctx.fill(); } }
  function air(ctx, C, e, time) {
    var x = e.x, y = e.y, fl = e.fl > 0;
    ctx.save(); ctx.translate(x, y);
    switch (e.kind) {
      case 'gnat': {
        circ(ctx, 0, 0, 9, fl ? '#ffffff' : C.rust); circ(ctx, 0, 0, 5.5, C.rustL); circ(ctx, 0, 1, 2.6, C.eye);
        ctx.strokeStyle = C.retro ? '#aaaaaa' : 'rgba(210,215,220,.75)'; ctx.lineWidth = 2; var a = time * 30 + e.id;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.lineTo(-Math.cos(a) * 14, -Math.sin(a) * 14); ctx.stroke();
        break;
      }
      case 'kite': {
        ctx.strokeStyle = C.retro ? '#ffaa55' : 'rgba(230,150,90,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -12);
        for (var k = 1; k <= 4; k++) ctx.lineTo(Math.sin(time * 6 + k + e.id) * 4, -12 - k * 6); ctx.stroke();
        poly(ctx, [0, 15, 13, 0, 0, -12, -13, 0], fl ? '#ffffff' : C.rust);
        poly(ctx, [0, 15, 13, 0, 0, 2, -13, 0], C.rustD);
        ctx.strokeStyle = C.rustL; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(0, -12); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke();
        circ(ctx, 0, 4, 2.5, C.lamp);
        break;
      }
      case 'hook': {
        ctx.strokeStyle = fl ? '#ffffff' : C.steel; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(-5, 6, 7, Math.PI * 0.1, Math.PI * 1.0); ctx.stroke();
        ctx.beginPath(); ctx.arc(5, 6, 7, 0, Math.PI * 0.9); ctx.stroke();
        circ(ctx, 0, -2, 8, fl ? '#ffffff' : C.rust); circ(ctx, 0, -2, 3, C.eye);
        break;
      }
      case 'barrel': {
        ctx.strokeStyle = C.retro ? '#aaaaaa' : 'rgba(210,215,220,.7)'; ctx.lineWidth = 2; var b = time * 26 + e.id;
        [-20, 20].forEach(function (dx) { ctx.beginPath(); ctx.moveTo(dx + Math.cos(b) * 9, Math.sin(b) * 3); ctx.lineTo(dx - Math.cos(b) * 9, -Math.sin(b) * 3); ctx.stroke(); });
        ctx.fillStyle = fl ? '#ffffff' : C.rust; if (C.retro) ctx.fillRect(-17, -11, 34, 22); else { rr(ctx, -17, -11, 34, 22, 9); ctx.fill(); }
        ctx.fillStyle = C.rustD; ctx.fillRect(-10, -11, 4, 22); ctx.fillRect(6, -11, 4, 22);
        rivets(ctx, C, [-13, -6, -13, 6, 13, -6, 13, 6]);
        circ(ctx, 0, 7, 3, C.lamp);
        break;
      }
      case 'tug': {
        ctx.fillStyle = fl ? '#ffffff' : C.rustD; if (C.retro) ctx.fillRect(-22, -17, 44, 34); else { rr(ctx, -22, -17, 44, 34, 6); ctx.fill(); }
        ctx.fillStyle = C.rust; ctx.fillRect(-18, -13, 36, 22);
        ctx.fillStyle = C.rustL; ctx.fillRect(-18, -13, 36, 5);
        rivets(ctx, C, [-15, 0, -5, 0, 5, 0, 15, 0, -15, 6, 15, 6]);
        circ(ctx, -10, 12, 3, C.lamp); circ(ctx, 10, 12, 3, C.lamp);
        ctx.strokeStyle = C.retro ? '#aaaaaa' : 'rgba(210,215,220,.7)'; ctx.lineWidth = 2.5; var c2 = time * 22 + e.id;
        [[-20, -16], [20, -16]].forEach(function (p) { ctx.beginPath(); ctx.moveTo(p[0] + Math.cos(c2) * 12, p[1] + Math.sin(c2) * 12); ctx.lineTo(p[0] - Math.cos(c2) * 12, p[1] - Math.sin(c2) * 12); ctx.stroke(); });
        break;
      }
    }
    ctx.restore();
    if (e.hp < e.max && e.max > 10 && !C.retro) bar(ctx, x - 14, y - e.r - 8, 28, 3, e.hp / e.max, C.bad, C);
  }
  function boss(ctx, C, b, time) {
    var x = b.x, y = b.y, fl = b.fl > 0, body = fl ? '#ffffff' : C.rust;
    ctx.save(); ctx.translate(x, y);
    switch (b.id) {
      case 'zep':
        poly(ctx, [-50, -8, -62, -22, -56, 0, -62, 22, -50, 8], C.rustD); poly(ctx, [50, -8, 62, -22, 56, 0, 62, 22, 50, 8], C.rustD);
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 54, 26, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = C.rustD; ctx.lineWidth = 2; for (var i = -36; i <= 36; i += 18) { ctx.beginPath(); ctx.moveTo(i, -24 + Math.abs(i) * 0.12); ctx.lineTo(i, 24 - Math.abs(i) * 0.12); ctx.stroke(); }
        ctx.fillStyle = C.steelD; ctx.fillRect(-18, 18, 36, 12); circ(ctx, -34, 10, 4, C.lamp); circ(ctx, 34, 10, 4, C.lamp); circ(ctx, 0, 24, 4, C.eye);
        break;
      case 'crane': {
        ctx.fillStyle = C.rustD; ctx.fillRect(-44, -30, 88, 56);
        ctx.fillStyle = C.retro ? '#ffff55' : '#c8902e'; ctx.fillRect(-40, -26, 80, 44);
        ctx.fillStyle = C.retro ? '#000000' : '#2a2018'; for (var s = -36; s < 40; s += 12) ctx.fillRect(s, -26, 6, 6);
        var sw = Math.sin(time * 1.4) * 0.5; ctx.save(); ctx.rotate(sw);
        ctx.fillStyle = C.retro ? '#ffaa55' : '#d9a040'; ctx.fillRect(-6, 10, 12, 56); ctx.strokeStyle = C.steel; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 66); ctx.lineTo(0, 78); ctx.stroke();
        ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 84, 7, 0, Math.PI * 1.1); ctx.stroke(); ctx.restore();
        circ(ctx, -22, 0, 6, C.eye); circ(ctx, 22, 0, 6, C.eye); if (fl) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-44, -30, 88, 56); }
        break;
      }
      case 'lock': {
        ctx.fillStyle = C.steelD; ctx.fillRect(-70, -32, 140, 64);
        ctx.fillStyle = C.retro ? '#aaaaaa' : '#7d8794'; ctx.fillRect(-66, -28, 132, 50);
        var pz = Math.abs(Math.sin(time * 2.2)) * 16;
        ctx.fillStyle = body; ctx.fillRect(-58, 18 + pz, 26, 22); ctx.fillRect(32, 18 + (16 - pz), 26, 22);
        ctx.fillStyle = C.steel; ctx.fillRect(-49, 0, 8, 18 + pz); ctx.fillRect(41, 0, 8, 34 - pz);
        circ(ctx, 0, 0, 16, C.rustD); circ(ctx, 0, 0, 10, C.retro ? '#ffaa55' : '#ff8a3a'); circ(ctx, 0, 0, 4, '#fff1c0');
        if (!C.retro) rivets(ctx, C, [-60, -22, -40, -22, 40, -22, 60, -22, -60, 16, 60, 16]);
        break;
      }
      case 'elder': {
        var tr = time * 0.8; ctx.save(); ctx.rotate(tr); ctx.fillStyle = C.rustD;
        for (var t2 = 0; t2 < 16; t2++) { ctx.save(); ctx.rotate(t2 / 16 * TAU); ctx.fillRect(-7, -72, 14, 16); ctx.restore(); }
        ctx.restore();
        circ(ctx, 0, 0, 60, C.rustD); circ(ctx, 0, 0, 54, body); circ(ctx, 0, 0, 34, C.rustL);
        ctx.save(); ctx.rotate(-tr * 1.6); ctx.strokeStyle = C.rustD; ctx.lineWidth = 4; for (var sp = 0; sp < 6; sp++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sp / 6 * TAU) * 32, Math.sin(sp / 6 * TAU) * 32); ctx.stroke(); } ctx.restore();
        circ(ctx, 0, 0, 12, C.eye); circ(ctx, 0, 0, 5, '#ffe9b0');
        break;
      }
    }
    ctx.restore();
  }

  // ---------- выстрелы, заклёпки, контейнеры ----------
  function shots(ctx, C, S) {
    S.shots.forEach(function (s) {
      var col = C.shots[s.k] || '#fff';
      if (s.k === 2) { if (!C.retro) { ctx.globalAlpha = 0.35; circ(ctx, s.x, s.y, 9, '#ff8a2a'); ctx.globalAlpha = 1; } circ(ctx, s.x, s.y, 4.5, col); return; }
      if (s.k === 3) { ctx.strokeStyle = col; ctx.lineWidth = C.retro ? 3 : 2.5; ctx.beginPath(); ctx.moveTo(s.x, s.y); for (var j = 1; j <= 4; j++) ctx.lineTo(s.x + ((j % 2) ? 3 : -3), s.y + j * 6); ctx.stroke(); return; }
      if (s.k === 5) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2); ctx.fillStyle = C.steel; ctx.fillRect(-2, -6, 4, 11); circ(ctx, 0, -6, 2, C.eye); if (!C.retro) { ctx.globalAlpha = 0.5; circ(ctx, 0, 9, 3, '#ffd28a'); ctx.globalAlpha = 1; } ctx.restore(); return; }
      if (s.k === 4) { circ(ctx, s.x, s.y, 2.2, col); return; }
      var a = Math.atan2(s.vy, s.vx);
      ctx.strokeStyle = col; ctx.lineWidth = C.retro ? 3 : 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - Math.cos(a) * 10, s.y - Math.sin(a) * 10); ctx.stroke();
    });
  }
  function enemyBullets(ctx, C, S) {
    var eb = S.eb;
    if (!C.retro) { ctx.fillStyle = 'rgba(255,120,40,.28)'; ctx.beginPath(); for (var i = 0; i < eb.length; i++) { ctx.moveTo(eb[i].x + eb[i].r + 3, eb[i].y); ctx.arc(eb[i].x, eb[i].y, eb[i].r + 3, 0, TAU); } ctx.fill(); }
    ctx.fillStyle = C.eb; ctx.beginPath(); for (i = 0; i < eb.length; i++) { ctx.moveTo(eb[i].x + eb[i].r, eb[i].y); ctx.arc(eb[i].x, eb[i].y, eb[i].r, 0, TAU); } ctx.fill();
    ctx.fillStyle = C.ebCore; ctx.beginPath(); for (i = 0; i < eb.length; i++) { ctx.moveTo(eb[i].x + 1.8, eb[i].y); ctx.arc(eb[i].x, eb[i].y, 1.8, 0, TAU); } ctx.fill();
  }
  function items(ctx, C, S, time) {
    S.items.forEach(function (it) {
      var bob = Math.sin(time * 5 + it.x) * 1.5;
      if (it.k === 'coin') { poly(ctx, [it.x, it.y - 8 + bob, it.x + 7, it.y - 4 + bob, it.x + 7, it.y + 4 + bob, it.x, it.y + 8 + bob, it.x - 7, it.y + 4 + bob, it.x - 7, it.y - 4 + bob], C.gold); circ(ctx, it.x, it.y + bob, 2.5, C.retro ? '#aa5500' : '#a8741a'); }
      else if (it.k === 'armor') { ctx.fillStyle = C.good; ctx.fillRect(it.x - 7, it.y - 7 + bob, 14, 14); ctx.fillStyle = '#103020'; ctx.fillRect(it.x - 1.5, it.y - 5 + bob, 3, 10); ctx.fillRect(it.x - 5, it.y - 1.5 + bob, 10, 3); }
      else { circ(ctx, it.x, it.y + bob, 7, C.bad); circ(ctx, it.x, it.y + bob, 3, '#fff'); }
    });
  }
  function fxDraw(ctx, C) {
    FX.waves.forEach(function (w) { var k = w.t / w.life; ctx.strokeStyle = w.col || '#ffd28a'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w.x, w.y, w.r * k, 0, TAU); ctx.stroke(); });
    ctx.globalAlpha = 1;
    var cols = C.retro ? ['#ffff55', '#ffffff', '#aaaaaa', '#55ffff', '#aa5500'] : ['#ffb347', '#fff1c0', '#8f8a86', '#9fe8ff', '#7a5236'];
    FX.parts.forEach(function (p) { var k = 1 - p.t / p.life; ctx.globalAlpha = p.k === 2 ? k * 0.5 : k; ctx.fillStyle = p.k === 0 && k < 0.5 ? (C.retro ? '#ff5555' : '#ff6a2a') : cols[p.k]; var s = p.s * (p.k === 2 ? 2 - k : 1); if (C.retro) ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); else { ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, TAU); ctx.fill(); } });
    ctx.globalAlpha = 1;
  }

  // ---------- поле целиком (в координатах поля 440×640) ----------
  function field(ctx, C, S, o, time) {
    sea(ctx, C, S, time);
    isles(ctx, C, S);
    S.G.forEach(function (gd) { if (gd.y > -30 && gd.y < FH + 30) groundObj(ctx, C, gd, S.P, time); });
    items(ctx, C, S, time);
    S.E.forEach(function (e) { if (e.on && e.t >= 0) air(ctx, C, e, time); });
    if (S.boss) boss(ctx, C, S.boss, time);
    shots(ctx, C, S);
    var p = S.P;
    if (S.phase !== 'dead' && S.phase !== 'fail' && !o.noHero) {
      for (var sl = 0; sl < 2; sl++) if (p.mods[sl] === 'scythe') scytheBeam(ctx, C, p.x + (sl ? 24 : -24), p.y + 2, p.scy + sl * 0.5);
      hero(ctx, C, p.x, p.y, { bank: p.bank, mods: p.mods }, time);
      if (p.shield > 0.5) {
        var f = p.shield / p.scap;
        ctx.strokeStyle = C.shield; ctx.globalAlpha = (C.retro ? 0.9 : 0.25 + 0.4 * f) * (p.hitT > 0 ? 1 : 0.8); ctx.lineWidth = C.retro ? 2 : 1.5 + f * 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y - 2, 31, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (p.hitT > 0 && p.shield < 1) { ctx.globalAlpha = p.hitT * 2; circ(ctx, p.x, p.y, 18, C.bad); ctx.globalAlpha = 1; }
    }
    enemyBullets(ctx, C, S);
    fxDraw(ctx, C);
    if (S.flash > 0 || FX.flash > 0) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = Math.min(0.6, Math.max(S.flash, FX.flash)); ctx.fillRect(0, 0, FW, FH); ctx.globalAlpha = 1; }
    // полоса здоровья босса
    if (S.boss && S.boss.y > -60) {
      var b = S.boss; ctx.fillStyle = C.retro ? '#000000' : 'rgba(10,12,16,.6)'; ctx.fillRect(40, 10, FW - 80, 12);
      bar(ctx, 44, 13, FW - 88, 6, b.hp / b.max, b.mid ? C.warn : C.bad, C);
    }
  }

  // офскрин для retro (поле в половинном разрешении → крупный пиксель)
  var off = null, offCtx = null;
  function retroField(ctx, C, S, o, time) {
    if (!off) { off = document.createElement('canvas'); off.width = FW / 2; off.height = FH / 2; offCtx = off.getContext('2d'); }
    offCtx.setTransform(0.5, 0, 0, 0.5, 0, 0); offCtx.imageSmoothingEnabled = false;
    field(offCtx, C, S, o, time);
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, FW, FH); ctx.restore();
  }

  // ---------- панель подрядчика (справа) ----------
  function panel(g, S, C, o) {
    var ctx = g.ctx, x = PX + 16, y = 30, wpx = W - PX - 32, p = S.P, T = function (k) { return g.t(k); };
    ctx.fillStyle = C.panel; ctx.fillRect(PX, 0, W - PX, H);
    ctx.fillStyle = C.line; ctx.fillRect(PX, 0, C.retro ? 3 : 1, H);
    txt(g, T('title'), x, y, { size: 20, weight: 900, color: C.accent }, C);
    y += 22; txt(g, T('sector') + ' ' + (S.si + 1) + ' · ' + T('mission').toLowerCase() + ' ' + (S.mj + 1), x, y, { size: 11, color: C.muted, weight: 700 }, C);
    y += 16; txt(g, T('mn' + S.h), x, y, { size: 13, weight: 800 }, C);
    // прогресс пути
    y += 14; var prog = Math.min(1, S.t / D.MISSION_T); bar(ctx, x, y, wpx, 6, prog, C.accent, C);
    var mk = S.mission.midT / D.MISSION_T; ctx.fillStyle = C.warn; ctx.fillRect(x + wpx * mk - 1, y - 2, 3, 10);
    if (S.mission.bossT) { ctx.fillStyle = C.bad; ctx.fillRect(x + wpx - 3, y - 3, 4, 12); }
    // казна
    y += 34; txt(g, T('funds'), x, y, { size: 11, color: C.muted, weight: 700 }, C);
    y += 22; txt(g, money(o.funds), x, y, { size: 22, weight: 900, color: C.gold }, C);
    y += 18; txt(g, '+' + money(S.money) + ' · ' + T('mission').toLowerCase(), x, y, { size: 11, color: C.good, weight: 700 }, C);
    // броня и щит
    y += 26; txt(g, T('armor'), x, y, { size: 11, color: C.muted, weight: 700 }, C); txt(g, String(Math.ceil(p.armor)), x + wpx, y, { size: 11, align: 'right', weight: 800 }, C);
    y += 6; bar(ctx, x, y, wpx, 9, p.armor / D.ARMOR_MAX, p.armor < 30 ? C.bad : C.armor, C);
    y += 26; txt(g, T('shield'), x, y, { size: 11, color: C.muted, weight: 700 }, C); txt(g, Math.floor(p.shield) + '/' + p.scap, x + wpx, y, { size: 11, align: 'right', weight: 800 }, C);
    y += 6; bar(ctx, x, y, wpx, 9, p.shield / p.scap, C.shield, C);
    // орудие
    y += 30; txt(g, T('gun'), x, y, { size: 11, color: C.muted, weight: 700 }, C);
    y += 18; txt(g, T('g_' + p.gun), x, y, { size: 14, weight: 800 }, C);
    var lv = p.guns[p.gun] || 1; for (var i = 0; i < 5; i++) { ctx.fillStyle = i < lv ? C.accent : (C.retro ? '#555555' : 'rgba(255,255,255,.12)'); ctx.fillRect(x + wpx - 60 + i * 12, y - 9, 9, 9); }
    var own = D.GUN_IDS.filter(function (k) { return p.guns[k]; });
    if (own.length > 1) { y += 15; txt(g, 'Q → ' + T('g_' + own[(own.indexOf(p.gun) + 1) % own.length]), x, y, { size: 10, color: C.muted, weight: 600 }, C); }
    // модули
    y += 24; txt(g, T('mods'), x, y, { size: 11, color: C.muted, weight: 700 }, C);
    y += 17; txt(g, T('left') + ': ' + (p.mods[0] ? T('m_' + p.mods[0]) : T('none')), x, y, { size: 12, weight: 700 }, C);
    y += 16; txt(g, T('right') + ': ' + (p.mods[1] ? T('m_' + p.mods[1]) : T('none')), x, y, { size: 12, weight: 700 }, C);
    // особые
    y += 26; txt(g, T('megaS') + ' (X)', x, y, { size: 11, color: C.muted, weight: 700 }, C);
    y += 8; for (i = 0; i < D.SPECIAL.mega.max; i++) circ(ctx, x + 7 + i * 18, y + 7, 6, i < p.mega ? C.bad : (C.retro ? '#555555' : 'rgba(255,255,255,.12)'));
    y += 32; txt(g, T('cellsS') + ' (C)', x, y, { size: 11, color: C.muted, weight: 700 }, C);
    y += 8; for (i = 0; i < D.SPECIAL.cell.max; i++) { ctx.fillStyle = i < p.cells ? C.shield : (C.retro ? '#555555' : 'rgba(255,255,255,.12)'); ctx.fillRect(x + i * 18, y + 1, 12, 12); }
    // подсказка
    var hint = (o.touch ? T('hintTouch') : T('hintKeys')).split(' · ');
    var hy = H - 14 - (hint.length - 1) * 13;
    hint.forEach(function (s, k) { txt(g, s, x, hy + k * 13, { size: 9, color: C.muted, weight: 600 }, C); });
  }

  function banner(g, C, b) {
    if (!b) return; var a = Math.min(1, b.a * 2), ctx = g.ctx;
    ctx.globalAlpha = a;
    ctx.fillStyle = C.retro ? '#000000' : 'rgba(8,12,16,.72)'; ctx.fillRect(0, (b.y || 250) - 42, FW, 66);
    txt(g, b.title, FW / 2, (b.y || 250) - 8, { size: C.retro ? 22 : 26, align: 'center', weight: 900, color: b.col || C.accent }, C);
    if (b.sub) txt(g, b.sub, FW / 2, (b.y || 250) + 14, { size: 12, align: 'center', weight: 700, color: C.ink }, C);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, g, S, o) {
    var C = g.themeName === 'retro' ? PR : PM, time = g.time;
    ctx.save();
    if (FX.shake > 0) ctx.translate((Math.random() - 0.5) * FX.shake * 14, (Math.random() - 0.5) * FX.shake * 14);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FW, FH); ctx.clip();
    if (C.retro) retroField(ctx, C, S, o, time); else field(ctx, C, S, o, time);
    // всплывающие суммы — поверх, чётким шрифтом
    FX.pops.forEach(function (p) { ctx.globalAlpha = 1 - p.t; txt(g, p.s, p.x, p.y, { size: p.big ? 14 : 11, align: 'center', weight: 900, color: p.col || C.gold }, C); });
    ctx.globalAlpha = 1;
    banner(g, C, o.banner);
    ctx.restore();
    ctx.restore();
    panel(g, S, C, o);
  }

  // ---------- ангар ----------
  // view: { camp, sel, rows:[{id,kind,key}], msg, touch } → прямоугольники кнопок для кликов (RN.hits)
  var hits = [];
  function hangar(ctx, g, v) {
    var C = g.themeName === 'retro' ? PR : PM, T = function (k) { return g.t(k); }, c = v.camp, E = P.Eco, time = g.time;
    hits = [];
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (!C.retro) {   // фон: балки ангара
      ctx.fillStyle = 'rgba(255,255,255,.025)'; for (var bx = -40; bx < W; bx += 80) poly(ctx, [bx, 0, bx + 40, 0, bx + 120, H, bx + 80, H], 'rgba(255,255,255,.025)');
    }
    var si = Math.floor(c.mi / 3), mj = c.mi % 3;
    txt(g, T('hangar'), 20, 34, { size: 22, weight: 900, color: C.accent }, C);
    txt(g, T('sector') + ' ' + (si + 1) + ' «' + T('s' + si) + '» · ' + T('mission').toLowerCase() + ' ' + (mj + 1) + ': ' + T('mn' + c.mi), 20, 54, { size: 12, color: C.muted, weight: 700 }, C);
    txt(g, money(c.money), W - 20, 38, { size: 24, weight: 900, color: C.gold, align: 'right' }, C);
    txt(g, T('funds'), W - 20, 54, { size: 11, color: C.muted, weight: 700, align: 'right' }, C);
    // список
    var x0 = 16, y0 = 72, rw = 390, rh = 37;
    v.rows.forEach(function (r, i) {
      var y = y0 + i * rh, sel = i === v.sel;
      if (sel) { ctx.fillStyle = C.retro ? '#0000aa' : 'rgba(76,175,142,.16)'; if (C.retro) ctx.fillRect(x0, y, rw, rh - 4); else { rr(ctx, x0, y, rw, rh - 4, 8); ctx.fill(); ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; rr(ctx, x0 + 0.5, y + 0.5, rw - 1, rh - 5, 8); ctx.stroke(); } }
      else if (!C.retro) { ctx.fillStyle = 'rgba(255,255,255,.03)'; rr(ctx, x0, y, rw, rh - 4, 8); ctx.fill(); }
      hits.push({ x: x0, y: y, w: rw - 92, h: rh - 4, row: i, act: 'sel' });
      var ty = y + 21;
      if (r.kind === 'go') {
        txt(g, T('launch'), x0 + rw / 2, ty, { size: 16, weight: 900, align: 'center', color: sel ? C.accent : C.ink }, C);
        hits.push({ x: x0, y: y, w: rw, h: rh - 4, row: i, act: 'go' }); return;
      }
      var name = T(r.id.replace(':', '_')), st = '', col = C.ink;
      if (r.kind === 'gun') { var lv = c.guns[r.key] || 0; if (lv) { for (var k = 0; k < 5; k++) { ctx.fillStyle = k < lv ? C.accent : (C.retro ? '#555555' : 'rgba(255,255,255,.12)'); ctx.fillRect(x0 + 160 + k * 10, y + 11, 7, 10); } if (c.gun === r.key) st = '● ' + T('inHand'); } }
      else if (r.kind === 'mod') { var sl = []; if (c.mods[0] === r.key) sl.push(T('slotL')); if (c.mods[1] === r.key) sl.push(T('slotR')); st = sl.join(' + '); }
      else if (r.kind === 'mega') st = c.mega + '/' + D.SPECIAL.mega.max;
      else if (r.kind === 'cell') st = c.cells + '/' + D.SPECIAL.cell.max;
      else if (r.kind === 'gen') { st = T('lvl') + ' ' + c.gen + '/3'; }
      else if (r.kind === 'repair') { st = Math.round(c.armor) + '/100'; col = c.armor < 60 ? C.bad : C.ink; }
      txt(g, name, x0 + 12, ty, { size: 14, weight: 800 }, C);
      if (st) txt(g, st, r.kind === 'gun' ? x0 + 214 : x0 + 160, ty, { size: 11, weight: 700, color: r.kind === 'repair' ? col : C.muted }, C);
      // кнопки [−] [+]
      var bp = E.price(c, r.id), bs = E.sellPrice(c, r.id), can = E.canBuy(c, r.id);
      var bxp = x0 + rw - 44, bxm = x0 + rw - 88;
      function btn(xb, label, on, act, sub) {
        ctx.fillStyle = on ? (act === 'buy' ? (C.retro ? '#00aa00' : 'rgba(123,224,160,.18)') : (C.retro ? '#aa0000' : 'rgba(255,106,85,.16)')) : (C.retro ? '#000000' : 'rgba(255,255,255,.04)');
        if (C.retro) ctx.fillRect(xb, y + 3, 40, rh - 10); else { rr(ctx, xb, y + 3, 40, rh - 10, 6); ctx.fill(); }
        txt(g, label, xb + 20, y + 15, { size: 12, weight: 900, align: 'center', color: on ? C.ink : C.muted }, C);
        txt(g, sub, xb + 20, y + 28, { size: 9, weight: 700, align: 'center', color: on ? (act === 'buy' ? C.gold : C.good) : C.muted }, C);
        hits.push({ x: xb, y: y, w: 40, h: rh - 4, row: i, act: act });
      }
      btn(bxm, '−', bs != null, 'sell', bs != null ? '+' + bs : '');
      btn(bxp, '+', can, 'buy', bp != null ? String(bp) : (r.kind === 'mod' ? T('noSlot') : r.kind === 'repair' ? T('full') : T('max')));
    });
    // правая колонка: крыло и описание
    var rx = 424, rw2 = W - rx - 16, ry = 72;
    ctx.fillStyle = C.retro ? '#000000' : 'rgba(255,255,255,.035)'; if (C.retro) { ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rw2, 200); } else { rr(ctx, rx, ry, rw2, 200, 12); ctx.fill(); }
    if (C.retro) { ctx.save(); ctx.imageSmoothingEnabled = false; }
    hero(ctx, C, rx + rw2 / 2, ry + 96, { scale: 2.8, mods: c.mods, bank: Math.sin(time * 0.8) * 0.15, noShadow: true }, time);
    var gl = D.GUN_IDS.filter(function (k) { return c.guns[k]; }).map(function (k) { return T('g_' + k) + ' ' + c.guns[k] + (k === c.gun ? ' ●' : ''); }).join(' · ');
    txt(g, gl, rx + rw2 / 2, ry + 186, { size: 10, weight: 700, align: 'center', color: C.muted }, C);
    if (C.retro) ctx.restore();
    // характеристики
    var y = ry + 226;
    txt(g, T('armor') + ' ' + Math.round(c.armor) + '/100', rx, y, { size: 12, weight: 800, color: C.armor }, C); bar(ctx, rx + 110, y - 9, rw2 - 110, 8, c.armor / 100, C.armor, C);
    y += 20; txt(g, T('shield') + ' ' + D.shieldCap(c.gen), rx, y, { size: 12, weight: 800, color: C.shield }, C); bar(ctx, rx + 110, y - 9, rw2 - 110, 8, D.shieldCap(c.gen) / D.shieldCap(3), C.shield, C);
    // описание выбранного
    var r = v.rows[v.sel], desc = T('d_' + r.id.replace(':', '_'));
    y += 30; txt(g, r.kind === 'go' ? T('launch') : T(r.id.replace(':', '_')), rx, y, { size: 15, weight: 900, color: C.accent }, C);
    y += 6; y = wrap(g, desc, rx, y + 14, rw2, 15, { size: 11, weight: 600, color: C.ink }, C);
    // что потеряется при гибели
    var lastH = c.hist[c.hist.length - 1];
    var lostS = lastH ? T('loseNext').replace('{x}', itemName(g, lastH, c)) : T('loseNone');
    y += 12; y = wrap(g, lostS, rx, y, rw2, 14, { size: 11, weight: 700, color: lastH ? C.warn : C.muted }, C);
    var need = D.NEED[c.mi] || 0;
    y += 6; wrap(g, T('need').replace('{n}', String(need)), rx, y, rw2, 14, { size: 10, weight: 600, color: C.muted }, C);
    // сообщение и подсказка
    if (v.msg && v.msg.t > 0) { ctx.globalAlpha = Math.min(1, v.msg.t * 2); txt(g, v.msg.s, x0 + rw / 2, H - 36, { size: 13, weight: 800, align: 'center', color: v.msg.col || C.warn }, C); ctx.globalAlpha = 1; }
    txt(g, v.touch ? T('hintHangarT') : T('hintHangar'), W / 2, H - 12, { size: 10, weight: 600, align: 'center', color: C.muted }, C);
    return hits;
  }
  function itemName(g, h, c) {
    var r = P.Eco.row(h.id); if (!r) return '';
    var n = g.t(h.id.replace(':', '_'));
    if (r.kind === 'gun') { var lv = c.guns[r.key] || 1; return lv > 1 ? n + ' ' + g.t('lvl') + ' ' + lv : n; }
    if (r.kind === 'mod') return n + ' (' + g.t(h.slot ? 'slotR' : 'slotL') + ')';
    if (r.kind === 'gen') return n + ' ' + g.t('lvl') + ' ' + c.gen;
    return n;
  }
  function wrap(g, s, x, y, w, lh, o, C) {
    var ctx = g.ctx, words = String(s).split(' '), line = '';
    ctx.font = (o.weight || 600) + ' ' + (C.retro ? Math.max(8, Math.round(o.size * 0.85)) : o.size) + 'px ' + (C.retro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif');
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width > w && line) { txt(g, line, x, y, o, C); y += lh; line = words[i]; } else line = t;
    }
    if (line) { txt(g, line, x, y, o, C); y += lh; }
    return y;
  }

  // перенос строк с выравниванием по центру (x — центр)
  function wrapC(g, s, x, y, w, lh, o, C) {
    var ctx = g.ctx, words = String(s).split(' '), line = '', oc = Object.assign({ align: 'center' }, o);
    ctx.font = (o.weight || 600) + ' ' + (C.retro ? Math.max(8, Math.round(o.size * 0.85)) : o.size) + 'px ' + (C.retro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif');
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width > w && line) { txt(g, line, x, y, oc, C); y += lh; line = words[i]; } else line = t;
    }
    if (line) { txt(g, line, x, y, oc, C); y += lh; }
    return y;
  }
  P.render = { wrapC: wrapC, draw: draw, hangar: hangar, hero: hero, update: update, spawn: spawn, pop: pop, wave: wave, clearFx: clearFx, txt: txt, wrap: wrap, bar: bar, itemName: itemName,
    shake: function (v) { FX.shake = Math.max(FX.shake, v); }, flash: function (v) { FX.flash = Math.max(FX.flash, v); }, PM: PM, PR: PR, W: W, H: H, PX: PX, field: field };
})(typeof window !== 'undefined' ? window : globalThis);
