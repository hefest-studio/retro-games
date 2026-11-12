/* ЖЕОДА · тема modern (по умолчанию): тёмные жеоды, мягкие градиенты, светящиеся кристаллы,
   свет фонаря на каске. ZHEODA.modern — набор функций рисования для общего рендера ui.drawWorld. */
(function (global) {
  'use strict';
  var Z = global.ZHEODA = global.ZHEODA || {};
  var T = 32;
  var P = {
    pixel: false, font: null,
    bg: '#0d0b16', bg2: '#16122a', ink: '#f1ecff', muted: '#a59cc0', accent: '#ffb347', good: '#5be38d', bad: '#ff5d6c',
    panel: '#17132a', line: '#3a3156', hudBg: '#100d1d', hudLine: '#2b2442', bar: '#2b2442', bossBar: '#c77dff',
    rock: '#3a3150', rockHi: '#5d4f7c', rockLo: '#221c33', rockDot: '#4a3f66',
    crystal: '#c77dff', crystal2: '#7ae7ff', gem: '#ff5fa2', heart: '#ff5d6c', crate: '#c98a3a', dyn: '#e2463d',
    keys: { R: '#ff5d5d', B: '#5aa8ff', Y: '#ffd34d' }, acid: '#6dff8a', orb: '#7ae7ff', lamp: '#ffe9a6',
    en: { c: '#9b62d9', f: '#7ae7ff', j: '#7a6a58', s: '#57a37a' }
  };
  function rr(ctx, x, y, w, h, r) { Z.ui.roundRect(ctx, x, y, w, h, r); }
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function solidAt(S, cx, cy) { if (cx < 0 || cy < 0 || cx >= S.cols || cy >= S.rows) return true; var c = S.grid[cy * S.cols + cx]; return c === '#' || c === '%' || c === '+'; }
  function glow(ctx, x, y, r, col, a) {
    var gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a == null ? 0.5 : a; ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }

  // ---------- Фон ----------
  function bg(ctx, g, S, cam) {
    var W = g.W, H = g.H, OY = Z.ui.OY;
    var gr = ctx.createLinearGradient(0, OY, 0, H); gr.addColorStop(0, '#130f24'); gr.addColorStop(1, '#0a0812');
    ctx.fillStyle = gr; ctx.fillRect(0, OY, W, H - OY);
    var ox = cam ? cam.x * 0.25 : 0, oy = cam ? cam.y * 0.2 : 0, t = S ? S.time : 0;
    // дальние своды и сталактиты
    ctx.fillStyle = '#1b1631';
    for (var i = -1; i < 9; i++) {
      var bx = ((i * 97 - ox) % 873 + 873) % 873 - 100, h = 30 + (i * 37 % 50);
      ctx.beginPath(); ctx.moveTo(bx, OY); ctx.lineTo(bx + 40, OY + h - oy * 0.2); ctx.lineTo(bx + 80, OY); ctx.fill();
    }
    ctx.fillStyle = '#18132c';
    for (i = -1; i < 8; i++) {
      var sx = ((i * 131 + 40 - ox * 1.2) % 917 + 917) % 917 - 120, sh = 40 + (i * 53 % 60);
      ctx.beginPath(); ctx.moveTo(sx, H); ctx.lineTo(sx + 55, H - sh); ctx.lineTo(sx + 110, H); ctx.fill();
    }
    // далёкие искры-кристаллы
    for (i = 0; i < 26; i++) {
      var px = ((i * 211 - ox * 0.6) % W + W) % W, py = OY + ((i * 97 - oy * 0.6) % (H - OY) + (H - OY)) % (H - OY);
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.3 + i); ctx.fillStyle = i % 3 ? '#9a7ad6' : '#5fd0e6';
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Клетки ----------
  function rock(ctx, x, y, S, cx, cy, crack) {
    ctx.fillStyle = P.rock; ctx.fillRect(x, y, T, T);
    var up = !solidAt(S, cx, cy - 1), dn = !solidAt(S, cx, cy + 1), lf = !solidAt(S, cx - 1, cy), rt = !solidAt(S, cx + 1, cy);
    var h = hash(cx, cy);
    ctx.fillStyle = P.rockDot;
    ctx.fillRect(x + 4 + h * 18, y + 6 + (h * 7 % 1) * 14, 5, 3); ctx.fillRect(x + 18 - h * 10, y + 20, 4, 3);
    if (up) { ctx.fillStyle = P.rockHi; ctx.fillRect(x, y, T, 4); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, y + 4, T, 3); }
    if (dn) { ctx.fillStyle = P.rockLo; ctx.fillRect(x, y + T - 5, T, 5); }
    if (lf) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x, y, 3, T); }
    if (rt) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + T - 3, y, 3, T); }
    // изредка — вкрапление кристалла на открытой грани
    if (up && h > 0.82) { ctx.fillStyle = h > 0.91 ? P.crystal2 : P.crystal; ctx.beginPath(); ctx.moveTo(x + 10, y + 4); ctx.lineTo(x + 13, y - 4); ctx.lineTo(x + 16, y + 4); ctx.fill(); }
    if (crack) {
      ctx.strokeStyle = '#120d1f'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 13, y + 12); ctx.lineTo(x + 9, y + 19); ctx.lineTo(x + 17, y + 29);
      ctx.moveTo(x + 13, y + 12); ctx.lineTo(x + 25, y + 9); ctx.moveTo(x + 9, y + 19); ctx.lineTo(x + 24, y + 23); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,170,90,.35)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  function fakeOpen(S, cx, cy) {
    var k = cy * S.cols + cx;
    for (var i = 0; i < S.secrets.length; i++) if (S.secrets[i].found && S.secrets[i].cells.indexOf(k) >= 0) return true;
    return false;
  }
  function tile(ctx, ch, x, y, S, cx, cy) {
    var t = S.time;
    switch (ch) {
      case '#': rock(ctx, x, y, S, cx, cy, false); break;
      case '%': rock(ctx, x, y, S, cx, cy, true); break;
      case '+':
        if (fakeOpen(S, cx, cy)) { ctx.globalAlpha = 0.25; rock(ctx, x, y, S, cx, cy, false); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,211,77,.5)'; ctx.setLineDash([3, 3]); ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3); ctx.setLineDash([]); }
        else { rock(ctx, x, y, S, cx, cy, false); ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(x + 2, y + 2, T - 4, T - 4); }
        break;
      case '-':
        ctx.fillStyle = '#7d6a8e'; rr(ctx, x, y, T, 9, 3); ctx.fill();
        ctx.fillStyle = '#a593b8'; ctx.fillRect(x + 2, y + 1, T - 4, 2);
        ctx.fillStyle = '#4b3f5c'; ctx.fillRect(x + 6, y + 9, 3, 4); ctx.fillRect(x + T - 9, y + 9, 3, 4);
        break;
      case '|':
        if (!S.chan) {
          ctx.fillStyle = 'rgba(122,231,255,.08)'; ctx.fillRect(x, y, T, T);
          for (var i = 0; i < 4; i++) { ctx.fillStyle = '#8f9bb0'; ctx.fillRect(x + 3 + i * 8, y, 4, T); ctx.fillStyle = '#c9d2e0'; ctx.fillRect(x + 3 + i * 8, y, 1, T); }
          ctx.fillStyle = '#5c6678'; ctx.fillRect(x, y + 4, T, 3); ctx.fillRect(x, y + T - 7, T, 3);
        } else { ctx.strokeStyle = 'rgba(143,155,176,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 0.5, T - 3, T - 1); }
        break;
      case ':':
        if (S.chan) {
          ctx.fillStyle = 'rgba(89,224,255,.18)'; ctx.fillRect(x, y, T, T);
          ctx.fillStyle = '#59e0ff'; ctx.fillRect(x, y, T, 3); ctx.fillRect(x, y + T - 3, T, 3);
          ctx.fillStyle = 'rgba(89,224,255,' + (0.35 + 0.15 * Math.sin(t * 6 + cx)) + ')'; ctx.fillRect(x + 3, y + 6, T - 6, T - 12);
        } else { ctx.strokeStyle = 'rgba(89,224,255,.28)'; ctx.setLineDash([4, 4]); ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3); ctx.setLineDash([]); }
        break;
      case 'R': case 'B': case 'Y':
        var col = P.keys[ch];
        ctx.fillStyle = '#231c33'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = col; rr(ctx, x + 3, y + 1, T - 6, T - 2, 4); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 7, y + 4, 3, T - 8); ctx.fillRect(x + T - 10, y + 4, 3, T - 8);
        ctx.fillStyle = '#1a1426'; ctx.beginPath(); ctx.arc(x + T / 2, y + 13, 4, 0, 7); ctx.fill(); ctx.fillRect(x + T / 2 - 2, y + 14, 4, 8);
        break;
      case '^':
        var down = solidAt(S, cx, cy - 1) && !solidAt(S, cx, cy + 1);
        ctx.fillStyle = '#d6cfe6';
        for (var k = 0; k < 3; k++) {
          var bx = x + 3 + k * 9;
          ctx.beginPath();
          if (down) { ctx.moveTo(bx, y); ctx.lineTo(bx + 4.5, y + 16); ctx.lineTo(bx + 9, y); }
          else { ctx.moveTo(bx, y + T); ctx.lineTo(bx + 4.5, y + T - 16); ctx.lineTo(bx + 9, y + T); }
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(199,125,255,.45)';
        for (k = 0; k < 3; k++) { var bx2 = x + 3 + k * 9; ctx.fillRect(bx2 + 4, down ? y + 2 : y + T - 12, 1, 9); }
        break;
      case '~':
        var surf = !(cy > 0 && S.grid[(cy - 1) * S.cols + cx] === '~');
        ctx.fillStyle = 'rgba(70,200,100,.55)'; ctx.fillRect(x, y + (surf ? 8 : 0), T, T - (surf ? 8 : 0));
        if (surf) {
          ctx.fillStyle = P.acid;
          for (var w = 0; w < 4; w++) ctx.fillRect(x + w * 8, y + 8 + Math.sin(t * 4 + cx + w) * 2, 8, 3);
          var bb = (t * 0.8 + hash(cx, cy)) % 1; ctx.globalAlpha = 1 - bb; ctx.beginPath(); ctx.arc(x + 8 + hash(cy, cx) * 16, y + 28 - bb * 18, 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        }
        break;
    }
  }

  // ---------- Объекты ----------
  function crystalShape(ctx, x, y, s, c1, c2) {
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.moveTo(x, y - 11 * s); ctx.lineTo(x + 6 * s, y - 2 * s); ctx.lineTo(x + 3 * s, y + 9 * s); ctx.lineTo(x - 3 * s, y + 9 * s); ctx.lineTo(x - 6 * s, y - 2 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x, y - 11 * s); ctx.lineTo(x + 6 * s, y - 2 * s); ctx.lineTo(x, y + 1 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 2 * s, y - 4 * s, 2 * s, 5 * s);
  }
  function item(ctx, k, x, y, t, it, sc) {
    sc = sc || 1; var bob = it ? Math.sin(t * 3 + x * 0.05) * 2 : 0; y += bob;
    switch (k) {
      case '*': if (it) glow(ctx, x, y, 22, 'rgba(199,125,255,.8)', 0.45); crystalShape(ctx, x, y, sc, P.crystal, P.crystal2); break;
      case '$': if (it) glow(ctx, x, y, 20, 'rgba(255,95,162,.8)', 0.45); ctx.fillStyle = P.gem; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y - 2); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y - 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffd1e6'; ctx.fillRect(x - 3, y - 4, 3, 3); break;
      case 'h': ctx.fillStyle = '#f4f0ff'; rr(ctx, x - 10, y - 8, 20, 16, 4); ctx.fill(); ctx.fillStyle = P.heart; ctx.fillRect(x - 2, y - 5, 4, 10); ctx.fillRect(x - 5, y - 2, 10, 4); break;
      case 'a': ctx.fillStyle = P.crate; rr(ctx, x - 11, y - 8, 22, 17, 3); ctx.fill(); ctx.fillStyle = '#7a4f1f'; ctx.fillRect(x - 11, y - 1, 22, 2); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(x + 1, y - 6); ctx.lineTo(x - 4, y + 1); ctx.lineTo(x, y + 1); ctx.lineTo(x - 2, y + 7); ctx.lineTo(x + 5, y - 1); ctx.lineTo(x + 1, y - 1); ctx.closePath(); ctx.fill(); break;
      case 'd': ctx.fillStyle = P.dyn; for (var i = 0; i < 3; i++) { rr(ctx, x - 9 + i * 6, y - 6, 5, 15, 2); ctx.fill(); } ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 9, y - 1, 17, 3); ctx.strokeStyle = '#d8c9a8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 1, y - 6); ctx.quadraticCurveTo(x + 2, y - 13, x + 7, y - 11); ctx.stroke(); break;
      case 'r': case 'b': case 'y':
        var col = P.keys[k.toUpperCase()]; if (it) glow(ctx, x, y, 18, col, 0.35);
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x - 5, y, 5, 0, 7); ctx.stroke();
        ctx.fillStyle = col; ctx.fillRect(x, y - 1.5, 11, 3); ctx.fillRect(x + 6, y, 3, 5); ctx.fillRect(x + 10, y, 2, 4); break;
    }
  }
  function exit(ctx, x, y, open, t) {
    var cx = x + T / 2, top = y - T + 4;
    ctx.fillStyle = '#1b1530'; rr(ctx, x + 2, top, T - 4, T * 2 - 4, 12); ctx.fill();
    ctx.strokeStyle = open ? P.accent : '#4a3f66'; ctx.lineWidth = 3; rr(ctx, x + 2, top, T - 4, T * 2 - 4, 12); ctx.stroke();
    if (open) {
      glow(ctx, cx, y + 6, 40, 'rgba(255,179,71,.9)', 0.5 + 0.2 * Math.sin(t * 4));
      var gr = ctx.createLinearGradient(0, top, 0, y + T); gr.addColorStop(0, 'rgba(255,233,166,.9)'); gr.addColorStop(1, 'rgba(255,140,60,.5)');
      ctx.fillStyle = gr; rr(ctx, x + 6, top + 4, T - 12, T * 2 - 12, 9); ctx.fill();
    } else {
      ctx.fillStyle = '#4a3f66'; ctx.fillRect(x + 8, top + 18, T - 16, 3); ctx.fillRect(x + 8, top + 30, T - 16, 3); ctx.fillRect(x + 8, top + 42, T - 16, 3);
      ctx.fillStyle = P.crystal; ctx.beginPath(); ctx.arc(cx, top + 9, 3, 0, 7); ctx.fill();
    }
  }
  function lever(ctx, x, y, on, t) {
    ctx.fillStyle = '#5c6678'; rr(ctx, x + 8, y + T - 8, 16, 8, 3); ctx.fill();
    ctx.save(); ctx.translate(x + T / 2, y + T - 6); ctx.rotate(on ? 0.6 : -0.6);
    ctx.fillStyle = '#c9d2e0'; ctx.fillRect(-2, -20, 4, 20);
    ctx.fillStyle = on ? P.good : P.bad; ctx.beginPath(); ctx.arc(0, -21, 5, 0, 7); ctx.fill();
    ctx.restore();
  }
  function orb(ctx, x, y, gs, t) {
    glow(ctx, x, y, 30, 'rgba(122,231,255,.9)', 0.45 + 0.15 * Math.sin(t * 3));
    ctx.strokeStyle = 'rgba(122,231,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(122,231,255,.25)'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8fbff'; var d = gs > 0 ? 1 : -1, a = Math.sin(t * 4) * 2;
    ctx.beginPath(); ctx.moveTo(x - 5, y + d * (-2 + a)); ctx.lineTo(x, y + d * (-8 + a)); ctx.lineTo(x + 5, y + d * (-2 + a)); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 5, y + d * (2 - a)); ctx.lineTo(x, y + d * (8 - a)); ctx.lineTo(x + 5, y + d * (2 - a)); ctx.fill();
  }
  function lift(ctx, x, y, w, t, L) {
    // направляющие шахты
    ctx.fillStyle = 'rgba(184,162,122,.18)'; var top = Math.min(L.yT, L.yB) * T, bot = Math.max(L.yT, L.yB) * T;
    ctx.fillRect(x + 2, top - T, 2, bot - top + T); ctx.fillRect(x + w - 4, top - T, 2, bot - top + T);
    ctx.fillStyle = '#b8a27a'; rr(ctx, x, y, w, 11, 3); ctx.fill();
    ctx.fillStyle = '#e2cfa3'; ctx.fillRect(x + 3, y + 1, w - 6, 2);
    ctx.fillStyle = '#6d5a3a'; ctx.fillRect(x + 6, y + 6, w - 12, 2);
    ctx.fillStyle = L.wait > 0 ? P.good : P.accent; ctx.fillRect(x + w / 2 - 3, y + 3, 6, 3);
  }
  function stal(ctx, x, y, state, t) {
    var sh = state === 'shake' ? Math.sin(t * 60) * 1.5 : 0;
    ctx.fillStyle = '#8b7aa8'; ctx.beginPath(); ctx.moveTo(x + sh - 2, y); ctx.lineTo(x + sh + 8, y + 20); ctx.lineTo(x + sh + 18, y); ctx.fill();
    ctx.fillStyle = '#c9b8e6'; ctx.beginPath(); ctx.moveTo(x + sh + 3, y); ctx.lineTo(x + sh + 8, y + 15); ctx.lineTo(x + sh + 8, y); ctx.fill();
  }
  function dynaLit(ctx, x, y, fuse, t) {
    item(ctx, 'd', x, y, t, null);
    if (Math.floor(t * (fuse < 0.7 ? 16 : 8)) % 2 === 0) { glow(ctx, x + 7, y - 11, 12, 'rgba(255,220,120,1)', 0.9); ctx.fillStyle = '#fff3c8'; ctx.fillRect(x + 6, y - 12, 3, 3); }
  }
  // ---------- Обитатели ----------
  function enemy(ctx, e, x, y, gs, t) {
    var w = e.w * T, h = e.h * T, cx = x + w / 2, flip = (e.type === 'c' || e.type === 'j') && gs < 0;
    ctx.save(); ctx.translate(cx, y + h / 2); if (flip) ctx.scale(1, -1); if ((e.face || -1) < 0) ctx.scale(-1, 1);
    if (e.flash > 0) ctx.globalAlpha = 0.6;
    var col = P.en[e.type];
    if (e.type === 'c') {   // хрупень: панцирь с кристаллами
      var st = Math.sin(t * 14) * 2;
      ctx.strokeStyle = '#2a1d3a'; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = -1; i <= 1; i++) { ctx.moveTo(i * 7, 4); ctx.lineTo(i * 7 + (i ? st : -st), 10); } ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 1, 13, 8, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-13, 0, 26, 5);
      ctx.fillStyle = '#d7b4ff'; ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-3, -13); ctx.lineTo(0, -5); ctx.moveTo(2, -6); ctx.lineTo(5, -12); ctx.lineTo(8, -4); ctx.fill();
      ctx.fillStyle = '#ffe36b'; ctx.fillRect(9, -1, 3, 3);
    } else if (e.type === 'f') {   // светляк: мотылёк со светящимися крыльями
      glow(ctx, 0, 0, 22, 'rgba(122,231,255,.9)', 0.4);
      var fl = Math.abs(Math.sin(t * 18));
      ctx.fillStyle = 'rgba(122,231,255,.55)';
      ctx.beginPath(); ctx.ellipse(-4, -3, 8, 4 + fl * 5, -0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4, -3, 8, 4 + fl * 5, 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.ellipse(0, 1, 4, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1426'; ctx.fillRect(1, -1, 2, 2);
    } else if (e.type === 'j') {   // скакун: каменный шар с кристальной спиной
      var sq = e.ground ? 1 + Math.sin(t * 6) * 0.06 : 0.9;
      ctx.scale(1 / sq, sq);
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 3, 13, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a4c3e'; ctx.fillRect(-10, 9, 6, 4); ctx.fillRect(4, 9, 6, 4);
      ctx.fillStyle = P.crystal2; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-4, -14); ctx.lineTo(0, -5); ctx.lineTo(3, -12); ctx.lineTo(7, -4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(5, 0, 5, 5); ctx.fillStyle = '#1a1426'; ctx.fillRect(7, 1, 3, 3);
    } else if (e.type === 's') {   // плевун: каменный бутон с пастью
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-12, 13); ctx.quadraticCurveTo(-14, -10, 0, -13); ctx.quadraticCurveTo(14, -10, 12, 13); ctx.fill();
      ctx.fillStyle = '#2f5a43'; ctx.fillRect(-12, 9, 24, 4);
      var mo = 2 + Math.max(0, Math.sin(t * 5)) * 3;
      ctx.fillStyle = '#122016'; ctx.beginPath(); ctx.ellipse(8, -1, 4, mo, 0, 0, 7); ctx.fill();
      glow(ctx, 8, -1, 8, 'rgba(109,255,138,.9)', 0.5);
      ctx.fillStyle = '#ffe36b'; ctx.fillRect(-2, -7, 3, 3);
    }
    ctx.restore();
  }
  function boss(ctx, B, x, y, gs, t) {
    var w = B.w * T, h = B.h * T, cx = x + w / 2;
    ctx.save(); ctx.translate(cx, y + h / 2); if (gs < 0) ctx.scale(1, -1); if ((B.face || -1) < 0) ctx.scale(-1, 1);
    var step = B.ground && !(B.stun > 0) ? Math.sin(t * 6) * 3 : 0;
    // ноги
    ctx.fillStyle = '#2c2440'; rr(ctx, -26, 18 + step, 16, 14, 4); ctx.fill(); rr(ctx, 10, 18 - step, 16, 14, 4); ctx.fill();
    // корпус
    var gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, '#5d4f7c'); gr.addColorStop(1, '#2c2440');
    ctx.fillStyle = B.flash > 0 ? '#ffffff' : gr; rr(ctx, -w / 2 + 4, -h / 2 + 6, w - 8, h - 14, 16); ctx.fill();
    // руки
    ctx.fillStyle = '#4a3f66'; rr(ctx, -w / 2 - 6, -6 - step, 14, 26, 6); ctx.fill(); rr(ctx, w / 2 - 8, -6 + step, 14, 26, 6); ctx.fill();
    // кристаллы на плечах
    ctx.fillStyle = P.crystal;
    ctx.beginPath(); ctx.moveTo(-26, -h / 2 + 10); ctx.lineTo(-20, -h / 2 - 14); ctx.lineTo(-12, -h / 2 + 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -h / 2 + 8); ctx.lineTo(-1, -h / 2 - 20); ctx.lineTo(6, -h / 2 + 8); ctx.fill();
    ctx.fillStyle = P.crystal2; ctx.beginPath(); ctx.moveTo(10, -h / 2 + 8); ctx.lineTo(18, -h / 2 - 10); ctx.lineTo(24, -h / 2 + 10); ctx.fill();
    // ядро
    var hot = B.fireT < 0.6 && !(B.stun > 0), cc = hot ? '#ffffff' : B.hp / B.max < 0.5 ? '#ff6a8a' : '#c77dff';
    glow(ctx, 6, 2, hot ? 34 : 22, hot ? 'rgba(255,255,255,1)' : 'rgba(199,125,255,1)', hot ? 0.8 : 0.55);
    ctx.fillStyle = cc; ctx.beginPath(); ctx.moveTo(6, -9); ctx.lineTo(14, 2); ctx.lineTo(6, 13); ctx.lineTo(-2, 2); ctx.closePath(); ctx.fill();
    // глаза
    ctx.fillStyle = B.stun > 0 ? '#8a8aa0' : '#ffe36b'; ctx.fillRect(12, -16, 7, 4); ctx.fillRect(-2, -16, 7, 4);
    ctx.restore();
    if (B.stun > 0) for (var i = 0; i < 3; i++) { var a = t * 4 + i * 2.1; ctx.fillStyle = '#ffe36b'; ctx.fillRect(cx + Math.cos(a) * 22 - 2, (gs > 0 ? y - 8 : y + h + 8) + Math.sin(a) * 5 - 2, 4, 4); }
  }

  // ---------- Героиня ----------
  // Друза: каска с фонарём, рабочая куртка мастерской, коса, заводной бластер. Опорная точка — середина ног.
  function hero(ctx, x, y, p, t, S) {
    var w = p.w * T, h = p.h * T, run = p.ground && Math.abs(p.vx) > 0.1, air = !p.ground;
    var sw = run ? Math.sin(t * 16) : 0;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); if (p.gs < 0) ctx.scale(1, -1); if (p.face < 0) ctx.scale(-1, 1);
    var fy = h / 2;   // ноги
    // коса
    ctx.fillStyle = '#a6462a'; rr(ctx, -11, -fy + 13 + Math.abs(sw) * 1, 5, 15, 2.5); ctx.fill();
    // ноги
    ctx.fillStyle = '#26324a';
    ctx.save(); ctx.translate(-3, fy - 15); ctx.rotate(air ? -0.35 : sw * 0.5); ctx.fillRect(-3, 0, 6, 12); ctx.fillStyle = '#4a2f22'; ctx.fillRect(-3, 10, 8, 5); ctx.restore();
    ctx.fillStyle = '#26324a';
    ctx.save(); ctx.translate(3, fy - 15); ctx.rotate(air ? 0.4 : -sw * 0.5); ctx.fillRect(-3, 0, 6, 12); ctx.fillStyle = '#4a2f22'; ctx.fillRect(-3, 10, 8, 5); ctx.restore();
    // куртка
    ctx.fillStyle = '#2bb3a3'; rr(ctx, -9, -fy + 18, 18, 16, 4); ctx.fill();
    ctx.fillStyle = '#ff8a2a'; ctx.fillRect(-9, -fy + 27, 18, 3);
    ctx.fillStyle = '#1f7f74'; ctx.fillRect(-9, -fy + 18, 4, 16);
    // голова
    ctx.fillStyle = '#f1c7a0'; rr(ctx, -6, -fy + 8, 13, 11, 4); ctx.fill();
    ctx.fillStyle = '#1a1426'; ctx.fillRect(3, -fy + 12, 2, 3);
    // каска с фонарём
    ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.ellipse(0, -fy + 9, 9, 7, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-10, -fy + 8, 21, 3);
    ctx.fillStyle = '#ffd34d'; rr(ctx, 5, -fy + 3, 5, 5, 2); ctx.fill();
    glow(ctx, 9, -fy + 5, 14, 'rgba(255,233,166,1)', 0.7);
    // рука с бластером
    ctx.fillStyle = '#1f7f74'; ctx.fillRect(1, -fy + 21, 9, 5);
    ctx.fillStyle = '#d9a441'; rr(ctx, 7, -fy + 19, 12, 6, 2); ctx.fill();
    ctx.fillStyle = '#8a5a1c'; ctx.fillRect(9, -fy + 25, 3, 4);
    ctx.strokeStyle = '#ffe9a6'; ctx.lineWidth = 1; ctx.beginPath(); for (var i = 0; i < 3; i++) { ctx.moveTo(8 + i * 3, -fy + 19); ctx.lineTo(9.5 + i * 3, -fy + 25); } ctx.stroke();
    ctx.restore();
  }
  function heroDown(ctx, x, y, p, pt) {
    var w = p.w * T, h = p.h * T;
    ctx.save(); ctx.translate(x + w / 2, y + h - 4); ctx.rotate(Math.min(1.5, pt * 4) * (p.face || 1)); ctx.globalAlpha = Math.max(0, 1 - pt / 1.8);
    ctx.fillStyle = '#2bb3a3'; rr(ctx, -9, -26, 18, 16, 4); ctx.fill(); ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.ellipse(0, -30, 9, 7, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
  }
  // ---------- Снаряды и эффекты ----------
  function shot(ctx, x, y, vx, t) { glow(ctx, x, y, 12, 'rgba(255,211,77,1)', 0.8); ctx.fillStyle = '#fff3c8'; rr(ctx, x - 7, y - 2, 14, 4, 2); ctx.fill(); }
  function pebble(ctx, x, y, t) { glow(ctx, x, y, 9, 'rgba(109,255,138,1)', 0.6); ctx.fillStyle = '#9dffb0'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  function shard(ctx, x, y, vx, vy, t) {
    var a = Math.atan2(vy, vx); ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    glow(ctx, 0, 0, 10, 'rgba(199,125,255,1)', 0.6);
    ctx.fillStyle = '#e2c4ff'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -4); ctx.lineTo(-3, 0); ctx.lineTo(-5, 4); ctx.fill(); ctx.restore();
  }
  function wave(ctx, x, y, gs, t) {
    var d = gs > 0 ? -1 : 1;
    ctx.fillStyle = 'rgba(199,125,255,.75)';
    for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 12 + i * 6, y); ctx.lineTo(x - 9 + i * 6, y + d * (12 + (i % 2) * 8)); ctx.lineTo(x - 6 + i * 6, y); ctx.fill(); }
  }
  function blast(ctx, x, y, life) {
    var k = 1 - life / 0.5;
    glow(ctx, x, y, 30 + k * 50, 'rgba(255,170,80,1)', 0.9 * (1 - k));
    ctx.strokeStyle = 'rgba(255,233,166,' + (1 - k) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 10 + k * 46, 0, 7); ctx.stroke();
  }
  // Свет фонаря: мягкая темнота по краям, светлое пятно вокруг Друзы
  function light(ctx, g, S, px, py) {
    var r0 = 70, r1 = 430;
    var gr = ctx.createRadialGradient(px, py, r0, px, py, r1);
    gr.addColorStop(0, 'rgba(8,6,16,0)'); gr.addColorStop(1, 'rgba(8,6,16,.62)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, g.W, g.H);
  }

  // ---------- Значки HUD ----------
  function icon(ctx, name, x, y) {
    switch (name) {
      case 'ammo': ctx.fillStyle = '#d9a441'; rr(ctx, x - 7, y - 4, 13, 8, 2); ctx.fill(); ctx.fillStyle = '#ffe9a6'; ctx.fillRect(x + 4, y - 2, 4, 4); break;
      case 'dyn': ctx.fillStyle = P.dyn; rr(ctx, x - 5, y - 7, 4, 13, 2); ctx.fill(); rr(ctx, x, y - 7, 4, 13, 2); ctx.fill(); ctx.fillStyle = '#ffd34d'; ctx.fillRect(x + 3, y - 10, 2, 3); break;
      case 'keyR': case 'keyB': case 'keyY': var c = P.keys[name[3]]; ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x - 3, y, 4, 0, 7); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(x + 1, y - 1, 7, 2.5); ctx.fillRect(x + 5, y, 2, 4); break;
      case 'keyOff': ctx.strokeStyle = '#3a3156'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x - 3, y, 4, 0, 7); ctx.stroke(); ctx.fillStyle = '#3a3156'; ctx.fillRect(x + 1, y - 1, 7, 2); break;
      case 'hp': case 'hpOff': ctx.fillStyle = name === 'hp' ? P.heart : '#3a3156'; ctx.beginPath(); ctx.arc(x - 3, y - 2, 4, 0, 7); ctx.arc(x + 3, y - 2, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x + 7, y); ctx.fill(); break;
      case 'life': case 'lifeOff': ctx.fillStyle = name === 'life' ? '#ff8a2a' : '#3a3156'; ctx.beginPath(); ctx.ellipse(x, y + 1, 8, 6, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 9, y, 18, 3); if (name === 'life') { ctx.fillStyle = '#ffd34d'; ctx.fillRect(x + 2, y - 5, 4, 3); } break;
    }
  }
  // ---------- Хаб ----------
  function hubBg(ctx, g, t) {
    var W = g.W, H = g.H, gr = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
    gr.addColorStop(0, '#1d1736'); gr.addColorStop(1, '#09070f'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // разрез жеоды: кольцо кристаллов по краю
    for (var i = 0; i < 60; i++) {
      var a = i / 60 * Math.PI * 2, rx = W / 2 + Math.cos(a) * (W / 2 - 14), ry = H / 2 + Math.sin(a) * (H / 2 - 12), s = 0.6 + (i * 7 % 5) / 8;
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t + i);
      crystalShape(ctx, 0, 0, s, i % 3 ? P.crystal : P.crystal2, 'rgba(255,255,255,.25)'); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function hubPath(ctx, a, b, open, t) {
    ctx.strokeStyle = open ? 'rgba(255,179,71,.6)' : 'rgba(90,80,120,.45)'; ctx.lineWidth = 3; ctx.setLineDash(open ? [] : [5, 6]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
  }
  function hubNode(ctx, n, num, st, sel, t) {
    var r = n.boss ? 20 : 15;
    if (sel) glow(ctx, n.x, n.y, 40, 'rgba(255,179,71,1)', 0.45 + 0.2 * Math.sin(t * 5));
    ctx.fillStyle = st === 'done' ? '#2b5a44' : st === 'open' ? '#3a2a14' : '#1d1830';
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = st === 'done' ? P.good : st === 'open' ? P.accent : '#3a3156'; ctx.lineWidth = sel ? 3 : 2; ctx.stroke();
    if (n.boss) { crystalShape(ctx, n.x, n.y + 1, 1, st === 'locked' ? '#4a3f66' : '#ff6a8a', st === 'locked' ? '#3a3156' : '#ffd1e6'); return; }
    ctx.fillStyle = st === 'locked' ? '#5a5078' : P.ink; ctx.font = '800 13px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(st === 'done' ? '✓' : String(num), n.x, n.y + 1); ctx.textBaseline = 'alphabetic';
  }

  Z.modern = { P: P, bg: bg, tile: tile, item: item, exit: exit, lever: lever, orb: orb, lift: lift, stal: stal, dynaLit: dynaLit,
    enemy: enemy, boss: boss, hero: hero, heroDown: heroDown, shot: shot, pebble: pebble, shard: shard, wave: wave, blast: blast,
    light: light, icon: icon, hubBg: hubBg, hubPath: hubPath, hubNode: hubNode, crystalShape: crystalShape };
})(typeof window !== 'undefined' ? window : globalThis);
