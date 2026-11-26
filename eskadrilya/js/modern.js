/* ЭСКАДРИЛЬЯ · рендер MODERN (по умолчанию). ESKADRILYA.modern = { P, draw, lifeIcon, hullIcon, plane, pkIcon, puffs }
   Вид сверху: бирюзовое море с бликами, острова и берега с пляжем и рощами, облака на параллаксе.
   Свой — паролёт мастерской «Гефест» (биплан с медным котлом, оранжевые крылья), дымовая завеса — светлые клубы,
   наводка — красная пунктирная линия к самолёту с перекрестьем. Флотилия Окалины — ржавые механические птицы, стальные
   стрижи, латаные дирижабли, зенитки, паровые катера, Летучая кузня (клёпаный дирижабль-завод с гондолами, горном
   и винтами-тягами на выносах). Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var E = global.ESKADRILYA = global.ESKADRILYA || {};
  var L = E.logic, TAU = Math.PI * 2, W = L.W, H = L.H;

  var P = {
    pixel: false, font: null,
    hudBg: 'rgba(9,13,22,.97)', hudBg2: 'rgba(9,13,22,.62)', hudLine: '#24324a', ink: '#f2eee6', muted: '#9ba7b8', accent: '#ff8a3d',
    good: '#5fe0a0', warn: '#ffc04d', bad: '#ff5d6c', panel: '#121926', bar: '#283246', bossBar: '#ff6a2a', smokeBar: '#c8d2e0'
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

  // ---------- Летучая кузня (босс): клёпаный дирижабль-завод, гондолы, горн, винты-тяги на выносах ----------
  function hullPath(ctx, x, y, k) {
    var rx = L.HULL_RX * k, ry = L.HULL_RY * k;
    ctx.beginPath(); ctx.moveTo(x - rx, y);
    ctx.bezierCurveTo(x - rx, y - ry * 1.05, x - rx * 0.35, y - ry, x, y - ry);
    ctx.bezierCurveTo(x + rx * 0.35, y - ry, x + rx, y - ry * 1.05, x + rx, y);
    ctx.bezierCurveTo(x + rx, y + ry * 1.05, x + rx * 0.35, y + ry, x, y + ry);
    ctx.bezierCurveTo(x - rx * 0.35, y + ry, x - rx, y + ry * 1.05, x - rx, y); ctx.closePath();
  }
  function forge(ctx, B, S, t) {
    var x = B.x, y = B.y, i;
    ctx.save();
    if (B.falling) { var k = B.fallT / 2.6; ctx.globalAlpha = Math.max(0, k); ctx.translate(x, y); ctx.rotate((1 - k) * 0.2); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); ctx.translate(-x, -y); }
    // тень на воде
    ctx.fillStyle = 'rgba(0,0,0,.22)'; hullPath(ctx, x + 26, y + 70, 0.95); ctx.fill();
    // выносы и винты-тяги
    B.fans.forEach(function (f) {
      var fx = x + f.dx, fy = y + f.dy;
      ctx.strokeStyle = '#3b3e46'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x + Math.sign(f.dx) * 100, y + 4); ctx.lineTo(fx, fy); ctx.stroke();
      if (B.anchored && !B.falling) {   // вихрь — куда втягивает дым
        ctx.strokeStyle = 'rgba(200,220,235,.16)'; ctx.lineWidth = 2;
        for (var q = 0; q < 3; q++) { var ph = (t * 1.4 + q / 3) % 1, r = L.FAN_R * (1 - ph); ctx.beginPath(); ctx.arc(fx, fy, r, f.spin * 0.2 + q, f.spin * 0.2 + q + 2.2); ctx.stroke(); }
      }
      ctx.fillStyle = '#2a2c32'; ctx.beginPath(); ctx.arc(fx, fy, 24, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a7d63'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx, fy, 24, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(190,200,210,.55)';
      for (var b = 0; b < 4; b++) { var a = f.spin + b * TAU / 4; ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * 11, fy + Math.sin(a) * 11, 11, 4, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#c4572e'; ctx.beginPath(); ctx.arc(fx, fy, 4, 0, TAU); ctx.fill();
    });
    // корпус
    var gr = ctx.createLinearGradient(0, y - L.HULL_RY, 0, y + L.HULL_RY);
    gr.addColorStop(0, '#6f7480'); gr.addColorStop(0.45, '#4a4e58'); gr.addColorStop(1, '#2c2e35');
    ctx.fillStyle = gr; hullPath(ctx, x, y, 1); ctx.fill();
    ctx.save(); hullPath(ctx, x, y, 1); ctx.clip();
    ctx.strokeStyle = 'rgba(20,20,24,.5)'; ctx.lineWidth = 1;
    for (var px = x - 130; px <= x + 130; px += 22) { ctx.beginPath(); ctx.moveTo(px, y - 60); ctx.lineTo(px, y + 60); ctx.stroke(); }
    ctx.fillStyle = '#b4703c'; ctx.fillRect(x - 140, y - 6, 280, 5); ctx.fillRect(x - 140, y + 22, 280, 3);   // медные пояса
    ctx.fillStyle = 'rgba(210,200,180,.5)'; for (i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(x - 125 + i * 10, y - 4, 1.2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(150,70,40,.3)'; for (i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(x + (hash(i * 7 + 3) - 0.5) * 220, y + (hash(i * 11 + 5) - 0.5) * 70, 9 + hash(i) * 9, 4 + hash(i + 9) * 4, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(230,220,200,.3)'; ctx.lineWidth = 1.5; hullPath(ctx, x, y, 1); ctx.stroke();
    // горн посередине: закрыт заслонками, пока живы гондолы
    var c = B.core, cy = y - 4, glow = 0.55 + 0.25 * Math.sin(t * 6);
    ctx.fillStyle = '#1d1716'; ctx.beginPath(); ctx.arc(x, cy, L.CORE_R + 5, 0, TAU); ctx.fill();
    if (c.open) {
      var fg = ctx.createRadialGradient(x, cy, 2, x, cy, L.CORE_R + 10);
      fg.addColorStop(0, c.flash > 0 ? '#ffffff' : 'rgba(255,240,170,' + glow + ')'); fg.addColorStop(0.6, 'rgba(255,120,40,.9)'); fg.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, cy, L.CORE_R + 10, 0, TAU); ctx.fill();
      var f2 = c.hp / c.max; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 20, cy + L.CORE_R + 8, 40, 3); ctx.fillStyle = '#ffc04d'; ctx.fillRect(x - 20, cy + L.CORE_R + 8, 40 * f2, 3);
    } else {
      ctx.fillStyle = '#5d6068'; for (var s2 = 0; s2 < 4; s2++) { ctx.beginPath(); ctx.moveTo(x, cy); ctx.arc(x, cy, L.CORE_R, s2 * TAU / 4 + 0.08, (s2 + 1) * TAU / 4 - 0.08); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,120,40,' + (glow * 0.6).toFixed(2) + ')'; ctx.fillRect(x - 1.5, cy - L.CORE_R, 3, L.CORE_R * 2); ctx.fillRect(x - L.CORE_R, cy - 1.5, L.CORE_R * 2, 3);
    }
    // гондолы
    B.pods.forEach(function (pd) {
      var tx = x + pd.dx, ty = y + pd.dy, big = pd.kind === 'twin', r = big ? 13 : 11;
      if (!pd.alive) {
        ctx.fillStyle = '#1d1512'; ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,40,' + (0.35 + 0.25 * Math.sin(t * 10 + tx)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, TAU); ctx.fill();
        return;
      }
      ctx.fillStyle = '#26282e'; ctx.beginPath(); ctx.arc(tx, ty, r + 3, 0, TAU); ctx.fill();
      if (!B.anchored) { ctx.fillStyle = '#7d828c'; ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a4f59'; ctx.fillRect(tx - r, ty - 1.5, r * 2, 3); return; }
      var hot = pd.flash > 0;
      ctx.strokeStyle = hot ? '#fff' : '#1a1b20'; ctx.lineWidth = big ? 3.4 : 4; ctx.lineCap = 'round';
      var a = pd.ang, offs = big ? [-0.2, 0, 0.2] : [0];
      ctx.beginPath();
      offs.forEach(function (o) { var nx = Math.cos(a + Math.PI / 2) * o * 22, ny = Math.sin(a + Math.PI / 2) * o * 22; ctx.moveTo(tx + nx, ty + ny); ctx.lineTo(tx + nx + Math.cos(a) * (r + 9), ty + ny + Math.sin(a) * (r + 9)); });
      ctx.stroke();
      var tg = ctx.createRadialGradient(tx - 3, ty - 3, 1, tx, ty, r);
      tg.addColorStop(0, hot ? '#ffffff' : '#d07a4a'); tg.addColorStop(1, hot ? '#ffd0a0' : '#7a3a22');
      ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.fill();
      ctx.fillStyle = pd.sootT > 0 ? '#555' : '#ffcf6a'; ctx.beginPath(); ctx.arc(tx, ty, 2.5, 0, TAU); ctx.fill();
      var f = pd.hp / pd.max;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(tx - 12, ty + r + 4, 24, 3);
      ctx.fillStyle = f > 0.5 ? '#ffc04d' : '#ff5d6c'; ctx.fillRect(tx - 12, ty + r + 4, 24 * f, 3);
    });
    ctx.restore();
  }

  // ---------- Дым, наводка, копоть ----------
  function puffs(ctx, S) {
    for (var i = 0; i < S.puffs.length; i++) {
      var p = S.puffs[i], r = L.puffR(p), y = H - (p.wy - S.dist); if (r < 2) continue;
      var a = Math.min(0.62, 0.2 + r / L.PUFF_R * 0.45);
      var g2 = ctx.createRadialGradient(p.x - r * 0.3, y - r * 0.3, 1, p.x, y, r * 1.15);
      g2.addColorStop(0, 'rgba(236,238,242,' + a.toFixed(2) + ')'); g2.addColorStop(0.7, 'rgba(190,196,206,' + (a * 0.75).toFixed(2) + ')'); g2.addColorStop(1, 'rgba(160,168,180,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(p.x, y, r * 1.15, 0, TAU); ctx.fill();
    }
  }
  function aims(ctx, S, t) {
    var Pl = S.player; if (Pl.dead || !S.aims.length) return;
    ctx.save(); ctx.lineCap = 'round';
    S.aims.forEach(function (a) {
      var k = a.k, blink = k > 0.7 && Math.floor(t * 18) % 2;
      ctx.strokeStyle = 'rgba(255,70,70,' + (0.35 + 0.55 * k).toFixed(2) + ')'; ctx.lineWidth = 1.2 + k * 1.8;
      ctx.setLineDash([7, 5]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(Pl.x, Pl.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = blink ? '#ffffff' : '#ff5050'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(a.x, a.y, 9 + (1 - k) * 6, 0, TAU); ctx.stroke();
    });
    // перекрестье на самолёте
    var mk = Math.max.apply(null, S.aims.map(function (a) { return a.k; })), rr2 = 22 - mk * 8;
    ctx.strokeStyle = 'rgba(255,80,80,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Pl.x, Pl.y, rr2, 0, TAU);
    for (var q = 0; q < 4; q++) { var an = q * Math.PI / 2; ctx.moveTo(Pl.x + Math.cos(an) * (rr2 - 5), Pl.y + Math.sin(an) * (rr2 - 5)); ctx.lineTo(Pl.x + Math.cos(an) * (rr2 + 5), Pl.y + Math.sin(an) * (rr2 + 5)); }
    ctx.stroke(); ctx.restore();
  }
  function soot(ctx, x, y, t, r) {   // закопчённый: тёмные клубки и вопрос над целью
    ctx.fillStyle = 'rgba(40,40,46,.55)';
    for (var q = 0; q < 3; q++) { var a = t * 3 + q * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.4, r * 0.45, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#e8e8ee'; ctx.font = '900 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', x, y - r - 4);
  }

  // ---------- Воздух ----------
  function bird(ctx, e, t) {   // механическая птица: латунная тушка, крылья-шестерни, красный глаз; летит вниз
    var x = e.x, y = e.y, flap = Math.sin(t * 12 + e.x * 0.05), hit = e.flash > 0;
    var body = hit ? '#ffffff' : '#b0703c', wing = hit ? '#ffffff' : '#c9925a', dark = '#5a3418';
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
  // Паролёт: биплан сверху, нос вверх. flip — масштаб по вертикали (1 — обычный вид), shadow — сила тени
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
    if (Pl.grace > 0 && Math.floor(t * 14) % 2) return;
    steam(ctx, Pl.x, Pl.y - 8, t);
    plane(ctx, Pl.x, Pl.y, 1, OWN, Pl.bank, t, 1, 1);
    if (Pl.smoking) {   // котёл дымит: пыхтит труба
      var ph = (t * 6) % 1; ctx.fillStyle = 'rgba(235,238,244,' + (0.7 - ph * 0.4).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(Pl.x, Pl.y - 22 - ph * 10, 5 + ph * 5, 0, TAU); ctx.fill();
    }
  }

  // ---------- Пули, бонусы, эффекты ----------
  function shots(ctx, S) {
    ctx.save(); ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 6;
    S.shots.forEach(function (s) { ctx.fillStyle = '#fff2a8'; rr(ctx, s.x - 1.6, s.y - 6, 3.2, 12, 1.6); ctx.fill(); });
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
  var PK = { smoke: '#d8dee8', patch: '#5fe0a0', power: '#ff8a3d' };
  function pkIcon(ctx, kind, x, y, s, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
    if (kind === 'smoke') { ctx.beginPath(); ctx.arc(x - 4 * s, y + 1 * s, 4 * s, 0, TAU); ctx.arc(x + 1 * s, y - 2 * s, 5 * s, 0, TAU); ctx.arc(x + 5 * s, y + 2 * s, 3.5 * s, 0, TAU); ctx.fill(); }
    else if (kind === 'patch') { ctx.fillRect(x - 6 * s, y - 2 * s, 12 * s, 4 * s); ctx.fillRect(x - 2 * s, y - 6 * s, 4 * s, 12 * s); }
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
    S.ground.forEach(function (gq) { if (gq.alive && gq.sootT > 0) soot(ctx, gq.x, H - (gq.wy - S.dist), t, 14); });
    pickups(ctx, S, t);
    S.air.forEach(function (e) { if (e.alive && e.type === 'blimp') blimp(ctx, e, t); });
    clouds(ctx, S);
    if (S.boss && S.boss.alive) forge(ctx, S.boss, S, t);
    S.air.forEach(function (e) { if (!e.alive) return; if (e.type === 'bird') bird(ctx, e, t); else if (e.type === 'swift') swift(ctx, e, t); });
    S.air.forEach(function (e) { if (e.alive && e.sootT > 0) soot(ctx, e.x, e.y, t, e.type === 'blimp' ? 26 : 12); });
    if (S.boss && S.boss.alive && !S.boss.falling) S.boss.pods.forEach(function (pd) { if (pd.alive && pd.sootT > 0) soot(ctx, S.boss.x + pd.dx, S.boss.y + pd.dy, t, 12); });
    shots(ctx, S);
    puffs(ctx, S);
    players(ctx, S, t);   // паролёт — поверх своего дыма (иначе свой же клуб, уплывая назад, прячет самолёт)
    aims(ctx, S, t);
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
  function hullIcon(ctx, x, y, on) {   // клёпаная заплата
    ctx.fillStyle = on ? '#c9a24a' : 'rgba(120,130,150,.35)'; rr(ctx, x - 6, y - 6, 12, 12, 3); ctx.fill();
    if (on) { ctx.fillStyle = '#7a5a20'; [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(function (q) { ctx.fillRect(x + q[0] - 1, y + q[1] - 1, 2, 2); }); }
  }

  E.modern = { P: P, draw: draw, lifeIcon: lifeIcon, hullIcon: hullIcon, plane: plane, OWN: OWN, PK: PK, pkIcon: pkIcon, puffs: puffs };
})(typeof window !== 'undefined' ? window : globalThis);
