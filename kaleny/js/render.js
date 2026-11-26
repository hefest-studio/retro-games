/* КАЛЁНЫЙ ДВОР · рендер обеих тем. Мир — портретный 450×800 (игрок снизу). Если холст альбомный (g.W > g.H, 800×450), мир поворачивается
   матрицей: низ → лево, враг справа; подписи и HUD рисуются уже в экранных координатах. KALENY.render */
(function (global) {
  'use strict';
  var KL = global.KALENY = global.KALENY || {}, G = KL.logic.GEO, LG = KL.logic;
  var ENEMY_M = ['#43b9b1', '#a98be8', '#86c95a', '#5b8cff', '#e86f9d', '#e5c14b', '#e8e2d6'];
  var ENEMY_R = ['#55ffff', '#ff55ff', '#55ff55', '#5555ff', '#ffff55', '#ff5555', '#ffffff'];
  function pal(g, level) {
    var r = g.themeName === 'retro';
    if (r) return { pixel: true, bg: '#000000', floor: '#000000', floor2: '#0a0a2a', line: '#aaaaaa', strip: '#1a1a1a', plate: '#aaaaaa', plateDk: '#555555', steam: '#ffffff', skin: '#ffaa00', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffaa00', good: '#55ff55', bad: '#ff5555', warn: '#ffff55',
      team: ['#ffaa00', ENEMY_R[level % 7]], dark: ['#aa5500', '#555555'], heat: ['#555555', '#aa0000', '#ff5555', '#ffff55', '#ffffff'], hum: ['#ffffff', '#55ffff'] };
    return { pixel: false, bg: '#14161c', floor: '#2a2926', floor2: '#322f2b', line: '#d6c7a4', strip: '#1d1f25', plate: '#8b95a3', plateDk: '#4b5460', steam: '#e9f1f7', skin: '#f1c9a0', ink: '#f1ece2', muted: '#98a0ac', accent: '#ee8a3a', good: '#7ad18a', bad: '#ee5a4a', warn: '#f0c24c',
      team: ['#ee8a3a', ENEMY_M[level % 7]], dark: ['#7a3d12', '#1e4b47'], heat: ['#4a4a52', '#b53a1c', '#ff8c1a', '#fff2b8'], hum: ['#ffffff', '#7ad1ff'] };
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')'; }
  function heatColor(P, h) {
    h = Math.max(0, Math.min(1, h));
    if (P.pixel) return P.heat[h < 0.2 ? 0 : h < 0.45 ? 1 : h < 0.7 ? 2 : h < 0.9 ? 3 : 4];
    var st = P.heat, n = st.length - 1, p = h * n, i = Math.min(n - 1, Math.floor(p)); return mix(st[i], st[i + 1], p - i);
  }
  function land(g) { return g.W > g.H; }
  function toScreen(g, x, y) { return land(g) ? { x: g.W - y, y: x } : { x: x, y: y }; }
  function disc(c, x, y, r, col, px) {
    c.fillStyle = col;
    if (px) { x = Math.round(x / 2) * 2; y = Math.round(y / 2) * 2; var s = Math.max(2, Math.round(r / 2) * 2); c.fillRect(x - s, y - s + 2, s * 2, s * 2 - 4); c.fillRect(x - s + 2, y - s, s * 2 - 4, s * 2); }
    else { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function court(c, S, P, g, time) {
    var px = P.pixel, x, y;
    c.fillStyle = P.bg; c.fillRect(0, 0, G.W, G.H);
    // зона выбывших
    c.fillStyle = P.strip; c.fillRect(G.CX - 8, G.STT - 4, G.CR - G.CX + 16, G.TOP - G.STT + 4); c.fillRect(G.CX - 8, G.BOT, G.CR - G.CX + 16, G.STB - G.BOT + 4);
    // пол: доски
    for (y = G.TOP; y < G.BOT; y += 30) { c.fillStyle = ((y - G.TOP) / 30) % 2 ? P.floor : P.floor2; c.fillRect(G.CX, y, G.CR - G.CX, Math.min(30, G.BOT - y)); }
    if (!px) { c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; for (y = G.TOP; y < G.BOT; y += 30) { c.beginPath(); c.moveTo(G.CX, y + .5); c.lineTo(G.CR, y + .5); c.stroke(); } }
    // разметка
    c.fillStyle = P.line; var lw = px ? 4 : 3;
    c.fillRect(G.CX - 2, G.TOP - 1, G.CR - G.CX + 4, lw); c.fillRect(G.CX - 2, G.BOT - 2, G.CR - G.CX + 4, lw);
    c.fillRect(G.CX - 2, G.TOP - 1, lw, G.BOT - G.TOP + 2); c.fillRect(G.CR - 1, G.TOP - 1, lw, G.BOT - G.TOP + 2);
    c.fillRect(G.CX - 2, G.MID - 1, G.CR - G.CX + 4, lw);
    if (!px) { c.strokeStyle = P.line; c.lineWidth = 2; c.globalAlpha = .5; c.beginPath(); c.arc(225, G.MID, 46, 0, 7); c.stroke(); c.globalAlpha = 1; }
    // канат у зон выбывших
    c.fillStyle = P.line; for (x = G.CX; x < G.CR; x += 16) { c.fillRect(x, G.TOP - 6, 8, 3); c.fillRect(x, G.BOT + 3, 8, 3); }
    // стены
    c.fillStyle = P.plateDk; c.fillRect(G.CX - 8, G.STT - 4, 6, G.STB - G.STT + 8); c.fillRect(G.CR + 2, G.STT - 4, 6, G.STB - G.STT + 8); c.fillRect(G.CX - 8, G.STT - 6, G.CR - G.CX + 16, 4); c.fillRect(G.CX - 8, G.STB + 2, G.CR - G.CX + 16, 4);
    // щиты
    S.shields.forEach(function (sh) {
      if (sh.k === 'plate') {
        c.fillStyle = P.plateDk; c.fillRect(sh.x, sh.y + 3, sh.w, sh.h); c.fillStyle = P.plate; if (px) c.fillRect(sh.x, sh.y, sh.w, sh.h); else { rr(c, sh.x, sh.y, sh.w, sh.h, 4); c.fill(); }
        c.fillStyle = P.plateDk; for (var rx = sh.x + 8; rx < sh.x + sh.w - 4; rx += 14) { c.fillRect(rx, sh.y + 5, 4, 4); c.fillRect(rx, sh.y + sh.h - 9, 4, 4); }
      } else {
        var on = LG.steamOn(sh, S.time), warn = !on && LG.steamOn(sh, S.time + 0.6);
        c.fillStyle = P.plateDk; c.fillRect(sh.x, sh.y + sh.h / 2 - 2, sh.w, 4);
        for (var k = 0; k < sh.w; k += 22) { c.fillStyle = P.plate; c.fillRect(sh.x + k + 4, sh.y + sh.h / 2 - 5, 10, 10); }
        if (on || warn) {
          c.globalAlpha = on ? 0.55 : (Math.floor(time * 14) % 2 ? 0.25 : 0.05);
          for (var q = 0; q < sh.w; q += px ? 12 : 9) { var oy = Math.sin(time * 3 + q) * 6; disc(c, sh.x + q + 6, sh.y + sh.h / 2 + oy, sh.h * (0.55 + 0.2 * Math.sin(time * 5 + q * 0.7)), P.steam, px); }
          c.globalAlpha = 1;
        }
      }
    });
  }

  function unit(c, u, S, P, g, time, o) {
    var px = P.pixel, tc = P.team[u.team], dk = P.dark[u.team], out = u.state === 'out', a = Math.atan2(u.fy || (u.team === 0 ? -1 : 1), u.fx || 0);
    c.save(); c.translate(u.x, u.y);
    if (out) c.globalAlpha = 0.8;
    if (u.inv > 0 && Math.floor(time * 16) % 2) c.globalAlpha = 0.4;
    if (!px) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(1, 4, 16, 12, 0, 0, 7); c.fill(); }
    if (u.dashT > 0 && !px) { c.globalAlpha *= 0.35; c.fillStyle = tc; c.beginPath(); c.arc(-u.dx * 22, -u.dy * 22, 13, 0, 7); c.fill(); c.globalAlpha = out ? 0.8 : 1; }
    // плечи (поперёк взгляда) и фартук
    if (px) { disc(c, 0, 0, 14, dk, true); disc(c, 0, 0, 10, tc, true); }
    else { c.rotate(a + Math.PI / 2); c.fillStyle = dk; c.beginPath(); c.ellipse(0, 0, 16, 11, 0, 0, 7); c.fill(); c.fillStyle = tc; c.beginPath(); c.ellipse(0, -1, 14, 9, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)'; rr(c, -5, -11, 10, 12, 3); c.fill(); c.rotate(-(a + Math.PI / 2)); }
    // голова: лицо, кепка на затылке (полукруг), очки-гогглы по лбу
    var hx = Math.cos(a) * 3, hy = Math.sin(a) * 3;
    disc(c, hx, hy, 8, P.skin, px);
    if (!px) { c.fillStyle = dk; c.beginPath(); c.arc(hx, hy, 8.4, a + Math.PI / 2, a + Math.PI * 1.5); c.closePath(); c.fill();
      c.strokeStyle = '#bfe3ff'; c.lineWidth = 3; c.beginPath(); c.arc(hx, hy, 6.6, a - 0.8, a + 0.8); c.stroke(); c.strokeStyle = '#27323f'; c.lineWidth = 1; c.beginPath(); c.arc(hx, hy, 8.2, a - 0.9, a + 0.9); c.stroke(); }
    else { c.fillStyle = dk; c.fillRect(Math.round(hx - Math.cos(a) * 4) - 4, Math.round(hy - Math.sin(a) * 4) - 4, 8, 8); c.fillStyle = '#55ffff'; c.fillRect(Math.round(hx + Math.cos(a) * 5) - 3, Math.round(hy + Math.sin(a) * 5) - 3, 6, 6); }
    c.restore();
    c.globalAlpha = 1;
    // метка героя
    if (u.human >= 0 && !out || (u.human >= 0 && out)) {
      var hc = P.hum[u.human] || '#fff', bob = Math.sin(time * 6) * 2;
      c.fillStyle = hc; c.beginPath(); c.moveTo(u.x, u.y - 26 + bob); c.lineTo(u.x - 6, u.y - 35 + bob); c.lineTo(u.x + 6, u.y - 35 + bob); c.closePath(); c.fill();
      c.fillStyle = P.bg; c.font = '800 9px sans-serif'; c.textAlign = 'center'; c.fillText(u.human + 1, u.x, u.y - 28.5 + bob);
    }
    // накал в руках: кольцо
    if (u.charge >= 0 && u.hold >= 0) {
      var f = Math.min(1, u.charge / 1.1), danger = u.charge > 1.3;
      c.strokeStyle = danger && Math.floor(time * 14) % 2 ? P.bad : heatColor(P, 0.25 + f * 0.7); c.lineWidth = px ? 4 : 4; c.beginPath(); c.arc(u.x, u.y, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); c.stroke();
    }
    // окно ловли
    if (u.stance > 0) {
      var sf = u.stance / (u.stanceMax || 0.3); c.strokeStyle = P.good; c.lineWidth = px ? 4 : 3; c.beginPath(); c.arc(u.x, u.y, 27, 0, Math.PI * 2 * sf); c.stroke();
      c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.arc(u.x, u.y, 31, a - 0.8, a + 0.8); c.stroke();
    }
    if (u.stun > 0) { c.fillStyle = P.warn; for (var i = 0; i < 3; i++) { var aa = time * 8 + i * 2.1; c.fillRect(u.x + Math.cos(aa) * 16 - 2, u.y - 20 + Math.sin(aa) * 4 - 2, 4, 4); } }
  }

  function ball(c, b, P, time) {
    var px = P.pixel, col = heatColor(P, b.heat), r = 9 + (b.state === 'held' ? 0 : 0);
    if (b.state === 'fly' && !b.pass) {
      var sp = Math.hypot(b.vx, b.vy) || 1; c.strokeStyle = col; c.globalAlpha = 0.45; c.lineWidth = px ? 8 : 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx / sp * (10 + b.heat * 26), b.y - b.vy / sp * (10 + b.heat * 26)); c.stroke(); c.globalAlpha = 1; c.lineCap = 'butt';
    }
    if (!px) {
      if (b.heat > 0.3) { var gr = c.createRadialGradient(b.x, b.y, 2, b.x, b.y, 12 + b.heat * 20); gr.addColorStop(0, 'rgba(255,170,60,' + (0.25 + b.heat * 0.5) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)'); c.fillStyle = gr; c.beginPath(); c.arc(b.x, b.y, 12 + b.heat * 20, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(b.x + 1, b.y + 4, 9, 6, 0, 0, 7); c.fill();
      disc(c, b.x, b.y, r, col, false); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, r, 0, 7); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(b.x - 3, b.y - 3, 3, 0, 7); c.fill();
      if (b.heat > 0.85 && b.state === 'fly' && Math.floor(time * 20) % 2) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, r + 3, 0, 7); c.stroke(); }
    } else { disc(c, b.x, b.y, 10, '#000000', true); disc(c, b.x, b.y, 8, col, true); disc(c, b.x - 2, b.y - 2, 2, '#ffffff', true); }
  }

  // кольцо-подсказка ловли у героя: сжимается к метке; нажимай, когда кольцо касается пунктира (метка ближе, когда шар жарче)
  function catchRing(c, u, S, P, th) {
    var K = 150, R0 = 28, mark = R0 + LG.stanceLen(th.ball.heat) / 2 * K, ring = R0 + th.eta * K, col = heatColor(P, th.ball.heat);
    c.save(); c.lineWidth = P.pixel ? 4 : 2; c.setLineDash(P.pixel ? [] : [4, 4]); c.strokeStyle = P.ink; c.globalAlpha = 0.8; c.beginPath(); c.arc(u.x, u.y, mark, 0, 7); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = P.pixel ? 4 : 4; c.beginPath(); c.arc(u.x, u.y, Math.min(ring, 90), 0, 7); c.stroke();
    if (ring - mark < 5 && ring >= mark - 4) { c.strokeStyle = P.good; c.lineWidth = 3; c.beginPath(); c.arc(u.x, u.y, mark + 6, 0, 7); c.stroke(); }
    c.restore();
  }

  function drawWorld(ctx, S, g, o) {
    var P = pal(g, S.level), time = g.time || 0, i;
    court(ctx, S, P, g, time);
    S.units.forEach(function (u) { if (u.state === 'out') unit(ctx, u, S, P, g, time, o); });
    S.balls.forEach(function (b) { if (b.state === 'loose') ball(ctx, b, P, time); });
    S.units.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (u) { if (u.state === 'in') unit(ctx, u, S, P, g, time, o); });
    S.balls.forEach(function (b) { if (b.state !== 'loose') ball(ctx, b, P, time); });
    // прицел героя с шаром
    S.units.forEach(function (u) {
      if (u.human < 0 || u.hold < 0) return; var tg = KL.aimOf && KL.aimOf(u); if (!tg) return;
      ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(tg.x, tg.y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.strokeStyle = tg.team === u.team ? P.good : P.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tg.x, tg.y, 22, 0, 7); ctx.stroke();
    });
    S.units.forEach(function (u) { if (u.human >= 0 && u.state === 'in' && o.api) { var th = o.api.threatOf(u); if (th) catchRing(ctx, u, S, P, th); } });
    (o.fx || []).forEach(function (f) {
      var k = Math.max(0, f.t / f.life); ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.lineWidth = P.pixel ? 4 : 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.9 - k), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    });
  }

  function pips(ctx, S, P, team, x, y, dx, dy, sz) {
    for (var i = 0; i < 3; i++) { var u = S.units[team * 3 + i], px = x + dx * i, py = y + dy * i; if (u.state === 'in') { disc(ctx, px, py, sz, P.team[team], P.pixel); if (u.hp > 1) { ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, sz + 3, 0, 7); ctx.stroke(); } } else { ctx.strokeStyle = P.team[team]; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.strokeRect(px - sz + 2, py - sz + 2, sz * 2 - 4, sz * 2 - 4); ctx.globalAlpha = 1; } }
  }
  function bars(g, ctx, S, P, hu, x, y, w, vertical) {
    if (!hu) return; var lock = hu.lock > 0 ? 1 - hu.lock / (hu.stanceMax + 0.45 || 1) : 1, dash = 1 - hu.dashCd / 1.0;
    var items = [[g.t('lock'), Math.max(0, Math.min(1, lock)), P.good], [g.t('dash'), Math.max(0, Math.min(1, dash)), P.accent]];
    items.forEach(function (it, i) {
      var yy = y + i * 30; g.text(it[0], x, yy, { size: 11, align: 'left', color: P.muted, weight: 700, maxWidth: w });
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, yy + 5, w, 7); ctx.fillStyle = it[1] >= 1 ? it[2] : P.muted; ctx.fillRect(x, yy + 5, w * it[1], 7);
    });
  }
  function fmt(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }

  function hud(ctx, S, g, o) {
    var P = pal(g, S.level), W = g.W, H = g.H, L = land(g), hu = S.units.filter(function (u) { return u.human === 0; })[0];
    var tn = g.t('team0'), en = g.t('rival' + (S.level % 7)), timer = S.left > 0 ? fmt(S.left) : (S.sudden >= 0 && S.left <= 0 ? '∞' : '');
    var sub = g.t('match') + ' ' + ((o.matchNo || S.level + 1)) + ' · ' + g.t('arena_' + S.arena);
    if (L) {
      g.text(tn, 42, 26, { size: 13, align: 'center', color: P.team[0], weight: 800, maxWidth: 78 }); pips(ctx, S, P, 0, 42, 52, 0, 22, 8);
      g.text(en, W - 42, 26, { size: 13, align: 'center', color: P.team[1], weight: 800, maxWidth: 78 }); pips(ctx, S, P, 1, W - 42, 52, 0, 22, 8);
      bars(g, ctx, S, P, hu, 8, 140, 66, true);
      g.text(timer, W / 2, 16, { size: 20, align: 'center', color: S.left < 10 && S.left > 0 ? P.bad : P.ink, weight: 900, maxWidth: 120 });
      g.text(sub, W / 2, H - 6, { size: 11, align: 'center', color: P.muted, weight: 700, maxWidth: W - 200 });
      g.text(g.t('score') + ': ' + (o.score || 0), W - 8, H - 22, { size: 11, align: 'right', color: P.muted, weight: 700, maxWidth: 80 });
    } else {
      g.text(tn, 14, 22, { size: 14, align: 'left', color: P.team[0], weight: 800, maxWidth: 150 }); pips(ctx, S, P, 0, 24, 44, 22, 0, 8);
      g.text(en, W - 14, 22, { size: 14, align: 'right', color: P.team[1], weight: 800, maxWidth: 150 }); pips(ctx, S, P, 1, W - 68, 44, 22, 0, 8);
      g.text(timer, W / 2, 34, { size: 30, align: 'center', color: S.left < 10 && S.left > 0 ? P.bad : P.ink, weight: 900, maxWidth: 110 });
      g.text(sub, W / 2, 62, { size: 11, align: 'center', color: P.muted, weight: 700, maxWidth: W - 20 });
      g.text(g.t('score') + ': ' + (o.score || 0), W - 14, 70, { size: 11, align: 'right', color: P.muted, weight: 700, maxWidth: 140 });
      var bx = 14; if (hu) { var lock = hu.lock > 0 ? 1 - hu.lock / (hu.stanceMax + 0.45 || 1) : 1, dash = 1 - hu.dashCd / 1.0;
        [[g.t('lock'), lock, P.good], [g.t('dash'), dash, P.accent]].forEach(function (it, i) { var xx = bx + i * 120; g.text(it[0], xx, 744, { size: 11, align: 'left', color: P.muted, weight: 700, maxWidth: 100 }); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(xx, 750, 100, 7); ctx.fillStyle = it[1] >= 1 ? it[2] : P.muted; ctx.fillRect(xx, 750, 100 * Math.max(0, Math.min(1, it[1])), 7); }); }
    }
    if (o.tutText) g.text(o.tutText, W / 2, L ? H - 30 : 784, { size: 12, align: 'center', color: P.warn, weight: 800, maxWidth: W - (L ? 200 : 20), minSize: 8 });
    if (S.left <= 0 && S.phase === 'play') g.text(g.t('sudden'), W / 2, L ? 42 : 88, { size: 14, align: 'center', color: P.bad, weight: 900, maxWidth: W - 200 });
    (o.toasts || []).forEach(function (t) { var p = toScreen(g, t.x, t.y - (1.4 - t.t) * 22), a = Math.min(1, t.t * 2.5); ctx.globalAlpha = a; g.text(t.text, p.x, p.y, { size: t.size || 18, align: 'center', color: t.color, weight: 900, maxWidth: 200 }); ctx.globalAlpha = 1; });
  }

  KL.render = {
    pal: pal, toScreen: toScreen, land: land, heatColor: heatColor, rr: rr, disc: disc,
    draw: function (ctx, S, g, o) {
      o = o || {}; ctx.save();
      if (land(g)) ctx.setTransform(0, 1, -1, 0, g.W, 0);
      drawWorld(ctx, S, g, o);
      ctx.restore(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); hud(ctx, S, g, o); ctx.restore();
    },
    bare: function (ctx, S, g) { var P = pal(g, S.level); ctx.save(); if (land(g)) ctx.setTransform(0, 1, -1, 0, g.W, 0); drawWorld(ctx, S, g, {}); ctx.restore(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
