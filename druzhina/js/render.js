/* ДРУЖИНА · общий рендер мира (фоны этапов, фигуры героев/врагов/боссов, звери, бесы, предметы, эффекты).
   Один рендер на обе темы: палитра P = DRUZHINA.modern | DRUZHINA.classic. В retro все цвета приводятся
   к 20-цветной палитре (P.pal), без градиентов и мягких теней; крупный пиксель даёт буфер в ui.js.
   Фигуры — «шарнирные»: конечности по углам (0 — вниз, +π/2 — вперёд), позы по состоянию и фазе удара.
   DRUZHINA.render = { world(ctx, S, P, o), figure, mount, imp, item, hero portrait … } */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  var PI = Math.PI, sin = Math.sin, cos = Math.cos;

  // ---------- Цвета ----------
  function hex2(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function toHex(r, g, b) { return '#' + [r, g, b].map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function shade(c, f) { if (!c || c[0] !== '#') return c; var a = hex2(c); return f < 1 ? toHex(a[0] * f, a[1] * f, a[2] * f) : toHex(a[0] + (255 - a[0]) * (f - 1), a[1] + (255 - a[1]) * (f - 1), a[2] + (255 - a[2]) * (f - 1)); }
  function mix(a, b, t) { var x = hex2(a), y = hex2(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  var qcache = {};
  function C(P, c) {
    if (!P.pixel || !c || c[0] !== '#') return c;
    var k = c; if (qcache[k]) return qcache[k];
    var a = hex2(c), best = c, bd = 1e9;
    P.pal.forEach(function (p) { var b = hex2(p), d = (a[0] - b[0]) * (a[0] - b[0]) * 0.3 + (a[1] - b[1]) * (a[1] - b[1]) * 0.59 + (a[2] - b[2]) * (a[2] - b[2]) * 0.11; if (d < bd) { bd = d; best = p; } });
    return (qcache[k] = best);
  }
  function hash(n) { n = (n << 13) ^ n; return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff; }

  // ---------- Примитивы ----------
  function fill(ctx, P, c) { ctx.fillStyle = C(P, c); }
  function rect(ctx, P, x, y, w, h, c) { ctx.fillStyle = C(P, c); ctx.fillRect(x, y, w, h); }
  function ell(ctx, P, x, y, rx, ry, c) { ctx.fillStyle = C(P, c); ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, PI * 2); ctx.fill(); }
  function poly(ctx, P, pts, c) { ctx.fillStyle = C(P, c); ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
  function line(ctx, P, x1, y1, x2, y2, w, c, cap) { ctx.strokeStyle = C(P, c); ctx.lineWidth = w; ctx.lineCap = cap || 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function grad(ctx, P, y0, y1, stops) {
    if (P.pixel) return C(P, stops[0][1]);
    var g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g;
  }
  function pt(x, y, a, l) { return [x + sin(a) * l, y + cos(a) * l]; }

  // ---------- Облик ----------
  var LOOK = {
    zhdan: { skin: '#e2a47a', hair: '#7a3a1c', beard: '#8a4420', tunic: '#8c2f22', trim: '#e0a84a', legs: '#4a3426', boots: '#2a1c14', apron: '#6e4a2a', weapon: 'hammer', s: 1.1, bulk: 1.3 },
    secha: { skin: '#f0c29a', hair: '#f0cf62', braid: 1, tunic: '#5f8494', mail: 1, trim: '#d6dee4', legs: '#33404c', boots: '#2a2a33', weapon: 'blades', s: 1.0, bulk: 1.0, cape: '#2a6a7c' },
    olha: { skin: '#eab48c', hair: '#b0582e', hood: '#3f6e34', tunic: '#5a7e3c', trim: '#d6c070', legs: '#3c4a2c', boots: '#3a2a1c', weapon: 'bow', s: 0.98, bulk: 0.95, cape: '#2f532a' },
    shield: { skin: '#a89080', helm: 'visor', metal: '#6a707c', tunic: '#3c3f48', trim: '#ff7a2a', legs: '#2a2c33', boots: '#1c1d22', weapon: 'sword', shield: '#5e6470', s: 1.0, bulk: 1.1 },
    spear: { skin: '#b09080', helm: 'spike', metal: '#727884', tunic: '#4c3a30', trim: '#ff8a3a', legs: '#2e2a28', boots: '#1c1a18', weapon: 'spear', s: 1.03, bulk: 1.0 },
    raider: { skin: '#e3a07a', hair: '#c8402a', mask: 1, tunic: '#6e2a3c', trim: '#ffb050', legs: '#3a2228', boots: '#24161a', weapon: 'scimitar', s: 0.95, bulk: 0.9, ponytail: 1 },
    brute: { skin: '#8d939c', bald: 1, tunic: '#2a2c33', bare: 1, trim: '#ff6a2a', legs: '#33302c', boots: '#1c1a18', weapon: 'mace', s: 1.22, bulk: 1.5 },
    voevoda: { skin: '#b89a88', helm: 'plume', metal: '#8a8f9c', tunic: '#5a1e1e', trim: '#f0c050', legs: '#2c2a30', boots: '#1a1a1e', weapon: 'axe', s: 1.3, bulk: 1.35, cape: '#7a1a1a' },
    twins0: { skin: '#9a8d84', bald: 1, bare: 1, tunic: '#2a2c33', trim: '#e04a3a', legs: '#3a2a26', boots: '#1c1a18', weapon: 'hammer', s: 1.28, bulk: 1.5, band: '#e04a3a' },
    twins1: { skin: '#8a8f98', bald: 1, bare: 1, tunic: '#2a2c33', trim: '#3a8ae0', legs: '#262a3a', boots: '#1c1a18', weapon: 'hammer', s: 1.28, bulk: 1.5, band: '#3a8ae0' },
    lovchiy: { skin: '#d8a07a', helm: 'fur', metal: '#6a5040', tunic: '#5a4026', trim: '#ffb050', legs: '#3a2a1c', boots: '#24180e', weapon: 'spear', s: 1.15, bulk: 1.1, cape: '#6a4a2a' },
    cepnik: { skin: '#a08a7c', helm: 'visor', metal: '#5a6070', tunic: '#3a3a2a', trim: '#c8b040', legs: '#2a2a22', boots: '#1a1a14', weapon: 'flail', s: 1.32, bulk: 1.4 },
    stenoboy: { skin: '#7a7f88', helm: 'horns', metal: '#4e535e', tunic: '#30333c', trim: '#ff7a2a', legs: '#282a30', boots: '#141418', weapon: 'ram', s: 1.48, bulk: 1.7 },
    liteyshchik: { skin: '#3a3036', helm: 'crown', metal: '#26232a', tunic: '#1c1a1e', trim: '#ff6a1a', legs: '#18161a', boots: '#0e0d10', weapon: 'bighammer', s: 1.42, bulk: 1.5, cape: '#2a0e0e', glow: '#ff6a1a' }
  };

  // ---------- Позы ----------
  // bl/fl — ноги [угол бедра, сгиб колена], ba/fa — руки [плечо, локоть], lean — наклон, dy — присед
  function pose(o) {
    var t = o.t || 0, ph = o.ph || 0, m = o.mp || 'w';
    var p = { bl: [-0.12, 0.05], fl: [0.16, 0.05], ba: [0.15, 0.6], fa: [0.35, 0.9], lean: 0, dy: 0, wa: 0, two: false };
    var idleB = sin(t * 3) * 0.04;
    p.ba[0] += idleB; p.fa[0] -= idleB;
    function swing(back, fwd, fwdBend) {
      if (m === 'w') { p.fa = [back, 0.5]; p.lean = -0.08; p.wa = -0.4; }
      else if (m === 'a') { p.fa = [fwd, fwdBend == null ? 0.05 : fwdBend]; p.lean = 0.16; p.fl = [0.5, 0.2]; p.bl = [-0.35, 0.1]; }
      else { var k = 1 - ph; p.fa = [fwd * k + 0.35 * (1 - k), 0.4]; p.lean = 0.1 * k; p.fl = [0.4 * k + 0.16, 0.1]; }
    }
    switch (o.pose) {
      case 'walk': case 'run': {
        var sp = o.pose === 'run' ? 17 : 10, w = sin(t * sp), a = o.pose === 'run' ? 0.75 : 0.5;
        p.fl = [w * a, Math.max(0, -w) * 0.9 + 0.05]; p.bl = [-w * a, Math.max(0, w) * 0.9 + 0.05];
        p.ba = [-w * 0.5 + 0.1, 0.6]; p.fa = [w * 0.5 + 0.3, 0.9]; p.dy = Math.abs(cos(t * sp)) * -2;
        if (o.pose === 'run') { p.lean = 0.22; }
        break;
      }
      case 'swing': swing(-1.6, 1.55); break;
      case 'swing2': swing(-1.2, 1.7, -0.3); p.ba = m === 'a' ? [1.2, 0.3] : [0.2, 0.6]; break;
      case 'over': swing(-2.9, 1.0, 0.35); if (m === 'a') p.wa = 0.5; break;
      case 'thrust':
        p.two = true;
        if (m === 'w') { p.fa = [0.9, 0.9]; p.ba = [0.6, 1.0]; p.lean = -0.12; p.shift = -10; }
        else if (m === 'a') { p.fa = [1.5, 0.05]; p.ba = [1.3, 0.5]; p.lean = 0.2; p.fl = [0.55, 0.15]; p.shift = 14; }
        else { p.fa = [1.2, 0.4]; p.ba = [0.9, 0.8]; }
        break;
      case 'shoot': p.fa = [1.57, 0]; p.ba = [1.3, m === 'w' ? 1.9 : 1.1]; p.lean = -0.04; break;
      case 'back': { var spin = m === 'a' ? 1 : 0.4; p.fa = [1.57 * spin + 0.3 * (1 - spin), 0]; p.ba = [-1.57 * spin, 0]; p.dy = 3; p.fl = [0.4, 0.3]; p.bl = [-0.4, 0.3]; p.both = true; break; }
      case 'cast': p.fa = [2.7, -0.3]; p.ba = [-2.6, 0.3]; p.lean = -0.06; p.dy = -2; break;
      case 'hurt': p.lean = -0.32; p.fa = [-0.5, 0.6]; p.ba = [-0.9, 0.5]; p.fl = [0.3, 0.2]; break;
      case 'jump': p.fl = [0.9, 1.6]; p.bl = [0.1, 1.4]; p.fa = [1.0, 0.6]; p.ba = [-0.6, 0.6]; break;
      case 'air': p.fl = [1.2, 0.2]; p.bl = [0.2, 1.5]; p.fa = [1.1, -0.2]; p.ba = [-0.9, 0.3]; p.lean = 0.2; p.wa = 0.4; break;
      case 'grab': p.fa = [1.45, 0.2]; p.ba = [1.25, 0.35]; p.lean = 0.08; p.fl = [0.35, 0.1]; if (o.knee) { p.fl = [1.4, 1.6]; p.lean = 0.15; } break;
      case 'toss': p.fa = [2.6, 0.2]; p.ba = [2.4, 0.4]; p.lean = -0.25; break;
      case 'grabbed': p.lean = -0.25; p.fa = [-0.3, 0.4]; p.ba = [-0.6, 0.3]; p.fl = [0.2, 0.3]; p.dy = 2; break;
      case 'guard': p.ba = [1.3, 0.4]; p.fa = [0.6, 1.2]; p.lean = -0.05; p.dy = 2; break;
      case 'crouch': p.fl = [0.7, 1.3]; p.bl = [-0.2, 1.3]; p.dy = 12; p.lean = 0.3; p.fa = [0.8, 0.8]; break;
      case 'rise': p.fl = [0.9, 1.6]; p.bl = [0.1, 1.5]; p.dy = 14; p.lean = 0.35; p.fa = [0.6, 0.5]; break;
      case 'dash': p.lean = 0.42; p.fa = [1.4, 0.2]; p.ba = [-0.9, 0.5]; p.fl = [0.7, 0.4]; p.bl = [-0.7, 0.6]; break;
      case 'ride': p.fl = [1.35, 1.5]; p.bl = [1.15, 1.4]; p.dy = 0; p.fa = [0.9, 0.7]; p.ba = [0.7, 0.9];
        if (o.mp && o.mp !== 'r') { p.fa = [o.mp === 'w' ? -1.9 : 1.5, 0.2]; }
        break;
      case 'slam': if (m === 'w') { p.fa = [-2.9, 0.2]; p.ba = [-2.7, 0.3]; p.lean = -0.15; p.wa = -0.3; } else { p.fa = [0.7, 0.4]; p.ba = [0.6, 0.5]; p.lean = 0.35; p.dy = 6; p.wa = 0.7; } p.two = true; break;
    }
    return p;
  }

  // ---------- Оружие ----------
  function weapon(ctx, P, kind, x, y, a, o, back) {
    var ol = P.outline, metal = o.glow ? '#3a3236' : '#c8ccd4', wood = '#7a5232';
    var e = function (l) { return pt(x, y, a, l); };
    function stick(l, w, c) { var q = e(l); line(ctx, P, x, y, q[0], q[1], w + 2.5, ol); line(ctx, P, x, y, q[0], q[1], w, c); return q; }
    ctx.save();
    switch (kind) {
      case 'hammer': case 'bighammer': {
        var big = kind === 'bighammer', L = big ? 46 : 34, q = stick(L, big ? 5 : 4, wood);
        ctx.translate(q[0], q[1]); ctx.rotate(-a);
        var hw = big ? 30 : 22, hh = big ? 18 : 14;
        rect(ctx, P, -hw / 2 - 1.5, -hh / 2 - 1.5, hw + 3, hh + 3, ol); rect(ctx, P, -hw / 2, -hh / 2, hw, hh, big ? '#2c282e' : '#8a8f9a');
        rect(ctx, P, -hw / 2, -hh / 2, hw, 3, big ? '#ff6a1a' : '#d8dde4');
        if (big) { rect(ctx, P, -hw / 2 + 4, -1, hw - 8, 3, '#ff9a3a'); }
        break;
      }
      case 'blades': case 'scimitar': case 'sword': {
        var len = kind === 'sword' ? 26 : 30; var q2 = e(len);
        line(ctx, P, x, y, q2[0], q2[1], 5, ol); line(ctx, P, x, y, q2[0], q2[1], 3, kind === 'scimitar' ? '#e0c8a0' : '#dfe6ee');
        var g1 = pt(x, y, a + PI / 2, 5), g2 = pt(x, y, a - PI / 2, 5); line(ctx, P, g1[0], g1[1], g2[0], g2[1], 3, kind === 'blades' ? '#d6b050' : '#6a5a40');
        break;
      }
      case 'bow': {
        var q3 = e(22), q4 = pt(x, y, a + PI, 22);
        ctx.strokeStyle = C(P, ol); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(q4[0], q4[1]); ctx.quadraticCurveTo(x + sin(a + PI / 2) * 12, y + cos(a + PI / 2) * 12, q3[0], q3[1]); ctx.stroke();
        ctx.strokeStyle = C(P, '#8a5a2a'); ctx.lineWidth = 3; ctx.stroke();
        line(ctx, P, q4[0], q4[1], q3[0], q3[1], 1.2, '#e8e0c8');
        break;
      }
      case 'spear': {
        var b0 = pt(x, y, a + PI, 30), tip = e(52);
        line(ctx, P, b0[0], b0[1], tip[0], tip[1], 5.5, ol); line(ctx, P, b0[0], b0[1], tip[0], tip[1], 3, wood);
        var t2 = e(64), s1 = pt(tip[0], tip[1], a + PI / 2, 4), s2 = pt(tip[0], tip[1], a - PI / 2, 4);
        poly(ctx, P, [s1[0], s1[1], t2[0], t2[1], s2[0], s2[1]], metal);
        break;
      }
      case 'mace': {
        var q5 = stick(30, 5, '#4a3a2a'); ell(ctx, P, q5[0], q5[1], 9, 9, ol); ell(ctx, P, q5[0], q5[1], 7.5, 7.5, '#6a6f7a');
        for (var i = 0; i < 4; i++) { var sp = pt(q5[0], q5[1], a + i * PI / 2 + PI / 4, 11); ell(ctx, P, sp[0], sp[1], 2.2, 2.2, '#9aa0aa'); }
        break;
      }
      case 'axe': {
        var q6 = stick(44, 4.5, wood); ctx.translate(q6[0], q6[1]); ctx.rotate(-a);
        poly(ctx, P, [-2, -4, 18, -14, 22, 0, 18, 14, -2, 4], ol); poly(ctx, P, [0, -3, 16, -11, 19, 0, 16, 11, 0, 3], '#b8bec8');
        break;
      }
      case 'flail': {
        var q7 = stick(18, 4.5, wood), sw = (o.t || 0) * 9, cl = 34 + (o.reach || 0);
        var bx = q7[0] + sin(a + sin(sw) * 0.5) * cl, by = q7[1] + cos(a + sin(sw) * 0.5) * cl;
        ctx.setLineDash && ctx.setLineDash([3, 3]); line(ctx, P, q7[0], q7[1], bx, by, 2.5, '#9aa0aa'); ctx.setLineDash && ctx.setLineDash([]);
        ell(ctx, P, bx, by, 9, 9, ol); ell(ctx, P, bx, by, 7.5, 7.5, '#5a606a');
        break;
      }
      case 'ram': {
        ctx.translate(x, y); ctx.rotate(-a + PI / 2);
        rect(ctx, P, -40, -9, 92, 18, ol); rect(ctx, P, -38, -7, 88, 14, '#6a4a2a'); rect(ctx, P, 44, -9, 10, 18, '#4e535e'); rect(ctx, P, -10, -8, 4, 16, '#3a3a3a'); rect(ctx, P, 20, -8, 4, 16, '#3a3a3a');
        break;
      }
    }
    ctx.restore();
  }

  // ---------- Фигура ----------
  function figure(ctx, P, o) {
    var k = o.look, s = (o.s || 1) * (k.s || 1), p = pose(o), bulk = k.bulk || 1;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.face * s, s);
    if (o.lying) { ctx.translate(0, -8); ctx.rotate(-PI / 2 * o.lying); }
    if (o.spin) { ctx.translate(0, -45); ctx.rotate(o.spin); ctx.translate(0, 45); }
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    var ol = P.outline, hipY = -36 + p.dy, shX = sin(p.lean) * 26, shY = hipY - 27 * cos(p.lean);
    var legW = 7.5 * Math.sqrt(bulk), armW = 6.5 * Math.sqrt(bulk), bw = 19 * bulk;
    var fl = o.flash > 0 ? '#ffffff' : null;
    function col(c, dark) { return fl || (dark ? shade(c, 0.72) : c); }
    function leg(a, dark) {
      var k1 = pt(0, hipY, a[0], 18), f = pt(k1[0], k1[1], a[0] - a[1], 18);
      line(ctx, P, 0, hipY, k1[0], k1[1], legW + 3, ol); line(ctx, P, k1[0], k1[1], f[0], f[1], legW + 3, ol);
      line(ctx, P, 0, hipY, k1[0], k1[1], legW, col(k.legs, dark)); line(ctx, P, k1[0], k1[1], f[0], f[1], legW - 0.5, col(k.legs, dark));
      rect(ctx, P, f[0] - 4, f[1] - 4, 11, 6, col(k.boots, dark));
    }
    function arm(a, dark, wkind, wfront) {
      var e1 = pt(shX, shY + 3, a[0], 15), h = pt(e1[0], e1[1], a[0] + a[1], 14);
      if (!wfront && wkind) weapon(ctx, P, wkind, h[0], h[1], a[0] + a[1] + p.wa, o, true);
      line(ctx, P, shX, shY + 3, e1[0], e1[1], armW + 3, ol); line(ctx, P, e1[0], e1[1], h[0], h[1], armW + 3, ol);
      var sleeve = k.bare ? k.skin : k.tunic;
      line(ctx, P, shX, shY + 3, e1[0], e1[1], armW, col(sleeve, dark)); line(ctx, P, e1[0], e1[1], h[0], h[1], armW - 0.5, col(k.skin, dark));
      if (k.band) line(ctx, P, e1[0] * 0.6 + shX * 0.4, (e1[1]) * 0.6 + (shY + 3) * 0.4, e1[0], e1[1], armW + 0.5, col(k.band, dark));
      ell(ctx, P, h[0], h[1], armW * 0.55, armW * 0.55, col(k.skin, dark));
      if (wfront && wkind) weapon(ctx, P, wkind, h[0], h[1], a[0] + a[1] + p.wa, o, false);
      return h;
    }
    // плащ
    if (k.cape) {
      var sw = sin((o.t || 0) * 4) * 3 + (o.pose === 'walk' || o.pose === 'run' ? -6 : 0);
      poly(ctx, P, [shX - 6, shY, shX + 4, shY, -12 + sw, hipY + 22, -24 + sw, hipY + 18], col(k.cape, true));
    }
    // хвост волос (сзади)
    if (k.ponytail || k.braid) { var hx = shX - 6, hy = shY - 14; line(ctx, P, hx, hy, hx - 9, hy + (k.braid ? 24 : 14), k.braid ? 5 : 6, col(k.hair, true)); }
    var wk = k.weapon, backW = wk === 'blades' ? 'blades' : null;
    leg(p.bl, true);
    if (wk === 'spear' && p.two) { /* копьё держат две руки — рисуется с передней */ }
    arm(p.ba, true, backW, false);
    // щит на дальней руке
    // туловище
    ctx.save(); ctx.translate(0, hipY); ctx.rotate(-p.lean);
    var th = 28;
    rect(ctx, P, -bw / 2 - 1.5, -th - 1.5, bw + 3, th + 6, ol);
    rect(ctx, P, -bw / 2, -th, bw, th + 3, col(k.bare ? k.skin : k.tunic));
    if (k.bare) { rect(ctx, P, -bw / 2, -th + 10, bw, 3, col(shade(k.skin, 0.8))); rect(ctx, P, -bw / 2, -6, bw, 9, col(k.tunic)); }
    if (k.mail && !P.pixel) { ctx.globalAlpha *= 0.35; for (var my = -th + 3; my < 0; my += 4) for (var mx = -bw / 2 + 2; mx < bw / 2 - 1; mx += 4) rect(ctx, P, mx, my, 2, 2, '#e6eef4'); ctx.globalAlpha = o.alpha != null ? o.alpha : 1; }
    if (k.mail && P.pixel) rect(ctx, P, -bw / 2, -th + 6, bw, 3, '#94b0c2');
    if (k.apron) rect(ctx, P, -bw / 2 + 3, -th + 8, bw - 2, th + 2, col(k.apron));
    if (k.helm && k.metal && !k.bare) { rect(ctx, P, -bw / 2, -th, bw, 8, col(k.metal)); }
    if (k.glow) { rect(ctx, P, -2, -th + 4, 3, th - 6, k.glow); rect(ctx, P, -bw / 2 + 3, -th + 12, bw - 6, 2, k.glow); }
    rect(ctx, P, -bw / 2, -5, bw, 4, col(k.trim));
    ctx.restore();
    // голова
    var hx0 = shX + 1, hy0 = shY - 11;
    ell(ctx, P, hx0, hy0, 11, 11.5, ol);
    ell(ctx, P, hx0, hy0, 9.5, 10, col(k.skin));
    if (k.hair && !k.helm) {
      if (k.hood) { poly(ctx, P, [hx0 - 11, hy0 + 4, hx0 - 10, hy0 - 8, hx0 + 2, hy0 - 13, hx0 + 10, hy0 - 6, hx0 + 4, hy0 - 6, hx0 - 2, hy0 + 2], col(k.hood)); rect(ctx, P, hx0 - 11, hy0 + 2, 6, 12, col(k.hood)); }
      else { poly(ctx, P, [hx0 - 10, hy0 + 3, hx0 - 9, hy0 - 7, hx0 + 1, hy0 - 12, hx0 + 10, hy0 - 6, hx0 + 9, hy0 - 3, hx0 - 2, hy0 - 5, hx0 - 4, hy0 + 4], col(k.hair)); }
    }
    if (k.beard) poly(ctx, P, [hx0 - 2, hy0 + 2, hx0 + 10, hy0 + 1, hx0 + 8, hy0 + 13, hx0 + 1, hy0 + 15, hx0 - 4, hy0 + 8], col(k.beard));
    if (k.mask) rect(ctx, P, hx0 - 2, hy0 + 1, 12, 5, col('#2a1a20'));
    if (k.helm) {
      var mc = col(k.metal);
      poly(ctx, P, [hx0 - 11, hy0 + 2, hx0 - 10, hy0 - 8, hx0, hy0 - 13, hx0 + 10, hy0 - 8, hx0 + 11, hy0 + 1], mc);
      if (k.helm === 'visor') { rect(ctx, P, hx0 + 1, hy0 - 3, 10, 9, mc); rect(ctx, P, hx0 + 3, hy0 - 1, 8, 2, '#111'); }
      if (k.helm === 'spike') { poly(ctx, P, [hx0 - 3, hy0 - 12, hx0 + 1, hy0 - 26, hx0 + 4, hy0 - 12], mc); rect(ctx, P, hx0 + 3, hy0 - 2, 8, 2, '#111'); }
      if (k.helm === 'plume') { poly(ctx, P, [hx0 - 2, hy0 - 12, hx0 - 18, hy0 - 22, hx0 - 22, hy0 - 6, hx0 - 8, hy0 - 8], col('#d8322a')); rect(ctx, P, hx0 + 2, hy0 - 2, 9, 2, '#111'); }
      if (k.helm === 'horns') { poly(ctx, P, [hx0 - 8, hy0 - 8, hx0 - 18, hy0 - 22, hx0 - 4, hy0 - 12], col('#e8dcc0')); poly(ctx, P, [hx0 + 6, hy0 - 9, hx0 + 16, hy0 - 24, hx0 + 9, hy0 - 6], col('#e8dcc0')); rect(ctx, P, hx0 + 2, hy0 - 2, 9, 3, '#ff7a2a'); }
      if (k.helm === 'fur') { ell(ctx, P, hx0, hy0 - 8, 12, 7, col('#8a6a4a')); rect(ctx, P, hx0 + 3, hy0 - 1, 6, 2, '#111'); }
      if (k.helm === 'crown') { poly(ctx, P, [hx0 - 10, hy0 - 6, hx0 - 8, hy0 - 18, hx0 - 3, hy0 - 10, hx0 + 1, hy0 - 20, hx0 + 5, hy0 - 10, hx0 + 10, hy0 - 17, hx0 + 10, hy0 - 6], col('#2a262c'));
        rect(ctx, P, hx0 + 2, hy0 - 2, 9, 3, k.glow); }
    } else if (!k.mask) { rect(ctx, P, hx0 + 4, hy0 - 2, 2.5, 3, '#1a1414'); }
    if (k.bald) { rect(ctx, P, hx0 + 3, hy0 - 2, 7, 2, k.trim); }
    leg(p.fl, false);
    // щит — перед телом
    if (k.shield) {
      var sx = shX + (o.pose === 'guard' ? 14 : 6), sy = shY + 18;
      ell(ctx, P, sx, sy, 14, 16, ol); ell(ctx, P, sx, sy, 12.5, 14.5, col(k.shield)); ell(ctx, P, sx, sy, 4, 4, col(k.trim));
    }
    arm(p.fa, false, wk === 'blades' ? 'blades' : wk, true);
    if (p.both && wk) { /* «спина»: оружие веером в обе стороны */ }
    ctx.restore();
  }

  // ---------- Звери (ящеры) ----------
  function beast(ctx, P, m, sx, sy, t, opts) {
    opts = opts || {};
    var fire = m.type === 'fire', s = opts.s || 1, ol = P.outline;
    var body = fire ? '#b8402a' : '#5f8a3a', belly = fire ? '#f0a050' : '#c8d070', spine = fire ? '#ffcf5a' : '#3a5a24';
    if (opts.flash) body = belly = '#ffffff';
    ctx.save(); ctx.translate(sx, sy); ctx.scale((m.face || 1) * s, s);
    var walk = opts.moving ? sin(t * 12) : 0, att = opts.att || '', tw = att === 'a' && !fire ? sin(t * 30) * 0.9 : sin(t * 3) * 0.2;
    // хвост
    ctx.save(); ctx.translate(-30, -32); ctx.rotate(-0.3 + tw * 0.6 + (att === 'w' && !fire ? -0.6 : 0));
    poly(ctx, P, [0, -10, -48, -2, -62, 4, -48, 6, 0, 12], ol); poly(ctx, P, [0, -8, -46, 0, -58, 4, -46, 4, 0, 10], body);
    if (!fire) { ell(ctx, P, -60, 4, 8, 7, ol); ell(ctx, P, -60, 4, 6.5, 5.5, '#c8b070'); poly(ctx, P, [-64, -2, -70, -8, -60, -2], '#e8e0c8'); poly(ctx, P, [-64, 9, -70, 15, -60, 9], '#e8e0c8'); }
    ctx.restore();
    // ноги
    [[-20, 1], [16, -1], [-8, -1], [26, 1]].forEach(function (q, i) {
      var a = walk * 0.5 * q[1], x0 = q[0], y0 = -26, x1 = x0 + sin(a) * 18, y1 = y0 + cos(a) * 20;
      line(ctx, P, x0, y0, x1, y1, 9, ol); line(ctx, P, x0, y0, x1, y1, 6.5, i > 1 ? shade(body, 0.7) : body);
    });
    // тело
    ell(ctx, P, -4, -36, 36, 16, ol); ell(ctx, P, -4, -36, 34, 14.5, body); ell(ctx, P, -2, -29, 28, 7, belly);
    for (var i = 0; i < 6; i++) poly(ctx, P, [-30 + i * 10, -48, -25 + i * 10, -57 + (i % 2) * 3, -21 + i * 10, -48], spine);
    // седло
    if (opts.saddle !== false) { rect(ctx, P, -16, -54, 22, 8, '#5a3420'); rect(ctx, P, -16, -54, 22, 2, '#d8a24a'); }
    // шея и голова
    var hb = att === 'w' ? -6 : att === 'a' ? 4 : 0;
    poly(ctx, P, [18, -46, 34, -60 + hb, 44, -52 + hb, 28, -30], ol); poly(ctx, P, [20, -45, 34, -58 + hb, 42, -52 + hb, 28, -32], body);
    ell(ctx, P, 46, -56 + hb, 16, 9, ol); ell(ctx, P, 46, -56 + hb, 14.5, 7.5, body);
    var jaw = att === 'a' ? 6 : 0;
    poly(ctx, P, [36, -52 + hb, 62, -50 + hb + jaw, 58, -46 + hb + jaw, 36, -48 + hb], shade(body, 0.8));
    ell(ctx, P, 48, -60 + hb, 3, 3, '#ffe060'); rect(ctx, P, 48, -61 + hb, 1.5, 2, '#111');
    if (fire) { poly(ctx, P, [40, -63 + hb, 34, -74 + hb, 44, -64 + hb], spine); poly(ctx, P, [34, -61 + hb, 26, -70 + hb, 37, -60 + hb], spine); }
    else { poly(ctx, P, [38, -62 + hb, 30, -66 + hb, 40, -60 + hb], '#e8e0c8'); }
    // пламя
    if (fire && att === 'a') {
      var L = (m.def ? m.def.reach : 170) * (opts.reachK || 1) / s;
      for (var j = 0; j < 7; j++) {
        var f = (j + (t * 8) % 1) / 7, fx = 60 + f * L, fr = 6 + f * 22;
        ell(ctx, P, fx, -48 + hb + sin(t * 20 + j) * 4 + f * 12, fr, fr * 0.7, j % 2 ? '#ffb030' : '#ff6020');
      }
      ell(ctx, P, 66, -48 + hb, 8, 6, '#fff0a0');
    } else if (fire && att === 'w') ell(ctx, P, 62, -50 + hb, 4 + sin(t * 30) * 2, 3, '#ffb030');
    ctx.restore();
  }

  // ---------- Бес-кладовик ----------
  function imp(ctx, P, f, sx, sy, t, gs) {
    var ol = P.outline, run = sin(t * 18), body = f.flash > 0 || f.state === 'hurt' ? '#ffffff' : '#4a3a8a';
    ctx.save(); ctx.translate(sx, sy); ctx.scale((f.face || 1) * (gs || 1), gs || 1);
    // мешок
    ell(ctx, P, -12, -30, 15, 15, ol); ell(ctx, P, -12, -30, 13.5, 13.5, '#a07a48'); rect(ctx, P, -14, -45, 6, 5, '#6a4a2a');
    if (f.bags > 1) ell(ctx, P, -12, -30, 5, 5, '#5a8ad8');
    line(ctx, P, -4, -16, -4 + run * 6, -2, 6, ol); line(ctx, P, 6, -16, 6 - run * 6, -2, 6, ol);
    line(ctx, P, -4, -16, -4 + run * 6, -2, 4, '#2a2050'); line(ctx, P, 6, -16, 6 - run * 6, -2, 4, '#2a2050');
    ell(ctx, P, 2, -24, 11, 11, ol); ell(ctx, P, 2, -24, 9.5, 9.5, body);
    poly(ctx, P, [-4, -32, -8, -42, 0, -33], '#e8dcc0'); poly(ctx, P, [6, -33, 10, -43, 9, -31], '#e8dcc0');
    ell(ctx, P, 6, -26, 3, 3, '#ffe060'); rect(ctx, P, 7, -27, 1.5, 2, '#111');
    line(ctx, P, -6, -18, -18, -10 + run * 3, 2, '#2a2050');
    ctx.restore();
  }

  // ---------- Предметы ----------
  function item(ctx, P, it, sx, sy, t, gs) {
    var ol = P.outline, bob = it.h > 0 ? 0 : sin(t * 4 + it.x) * 1.5;
    ctx.save(); ctx.translate(sx, sy - bob); if (gs) ctx.scale(gs, gs);
    if (it.kind === 'jug') {
      ell(ctx, P, 0, -10, 9, 10, ol); ell(ctx, P, 0, -10, 7.5, 8.5, '#3a6ad0'); rect(ctx, P, -3.5, -24, 7, 7, '#3a6ad0'); rect(ctx, P, -4.5, -25, 9, 3, '#d8b860');
      line(ctx, P, 5, -20, 9, -12, 2, '#2a4a9a'); rect(ctx, P, -4, -13, 3, 4, '#9ad0ff');
    } else if (it.kind === 'bread') {
      ell(ctx, P, 0, -7, 14, 8, ol); ell(ctx, P, 0, -7, 12.5, 6.5, '#c8823a'); line(ctx, P, -6, -9, -2, -5, 2, '#f0c070'); line(ctx, P, 2, -9, 6, -5, 2, '#f0c070');
    } else {
      ell(ctx, P, 0, -6, 15, 7, ol); ell(ctx, P, 0, -7, 13.5, 6, '#b8702a'); ell(ctx, P, 0, -9, 10, 3.5, '#e0a050'); line(ctx, P, -5, -9, 5, -9, 1.5, '#8a4a1a');
    }
    ctx.restore();
  }

  // ---------- Фоны этапов ----------
  var FT; // FLOOR_TOP
  var GS = 1.3;   // общий масштаб фигур на поле
  function layer(ctx, cam, par, step, fn) {
    var off = cam * par, i0 = Math.floor(off / step) - 1, i1 = Math.ceil((off + 960) / step) + 1;
    for (var i = i0; i <= i1; i++) fn(i * step - off, i);
  }
  function hills(ctx, P, cam, par, base, amp, c, seed) {
    ctx.fillStyle = C(P, c); ctx.beginPath(); ctx.moveTo(0, base + 200);
    for (var x = 0; x <= 960; x += 24) { var wx = (x + cam * par) / 160; ctx.lineTo(x, base - amp * (0.55 + 0.45 * sin(wx + seed) * cos(wx * 0.43 + seed * 2))); }
    ctx.lineTo(960, base + 200); ctx.closePath(); ctx.fill();
  }
  function tree(ctx, P, x, y, h, c, trunk) { rect(ctx, P, x - 3, y - h * 0.35, 6, h * 0.35, trunk); poly(ctx, P, [x - h * 0.28, y - h * 0.3, x, y - h, x + h * 0.28, y - h * 0.3], c); poly(ctx, P, [x - h * 0.22, y - h * 0.55, x, y - h * 1.1, x + h * 0.22, y - h * 0.55], shade(c, 1.1)); }
  function izba(ctx, P, x, y, w, h, wall, roof, lit) {
    rect(ctx, P, x, y - h, w, h, wall);
    for (var i = 0; i < h; i += 7) rect(ctx, P, x, y - h + i, w, 2, shade(wall, 0.75));
    poly(ctx, P, [x - 8, y - h, x + w / 2, y - h - w * 0.45, x + w + 8, y - h], roof);
    poly(ctx, P, [x + w / 2 - 5, y - h - 10, x + w / 2, y - h - w * 0.45 - 8, x + w / 2 + 5, y - h - 10], shade(roof, 1.25));
    rect(ctx, P, x + w * 0.35, y - h * 0.65, w * 0.3, h * 0.3, lit ? '#ffcf6a' : '#2a1a10'); rect(ctx, P, x + w * 0.35 - 3, y - h * 0.65 - 3, w * 0.3 + 6, 3, '#e8d8b0');
  }
  function floorBand(ctx, P, cam, top, c1, c2, seam, step, par) {
    rect(ctx, P, 0, top, 960, 540 - top, c1);
    if (!P.pixel) { ctx.fillStyle = grad(ctx, P, top, 540, [[0, 'rgba(0,0,0,.25)'], [0.25, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.18)']]); ctx.fillRect(0, top, 960, 540 - top); }
    for (var r = 0; r < 6; r++) { var y = top + 12 + r * r * 5.6 + r * 12; rect(ctx, P, 0, y, 960, 2, c2); }
    if (seam) layer(ctx, cam, par || 1, step || 120, function (x, i) { rect(ctx, P, x, top, 2, 540 - top, seam); });
  }
  var BG = {
    trakt: function (ctx, P, cam, t) {
      ctx.fillStyle = grad(ctx, P, 0, FT, [[0, '#6aa4dc'], [1, '#f2dcae']]); ctx.fillRect(0, 0, 960, FT);
      ell(ctx, P, 760 - cam * 0.02, 90, 34, 34, '#fff1c0');
      hills(ctx, P, cam, 0.08, FT - 120, 90, '#8a9ab8', 1);
      hills(ctx, P, cam, 0.2, FT - 60, 60, '#6f9a58', 3);
      layer(ctx, cam, 0.45, 300, function (x, i) {
        var y = FT - 14; if (hash(i) < 0.55) {
          rect(ctx, P, x + 40, y - 60, 90, 60, '#7a5a3a'); poly(ctx, P, [x + 30, y - 60, x + 85, y - 96, x + 140, y - 60], '#5a3a2a');
          rect(ctx, P, x + 110, y - 104, 12, 36, '#5a4a40'); rect(ctx, P, x + 70, y - 34, 20, 34, '#2a1a10');
          rect(ctx, P, x + 98, y - 40, 18, 14, (Math.floor(t * 3 + i) % 2) ? '#ffb040' : '#ff8a20');
          for (var s = 0; s < 3; s++) { var sy = y - 110 - ((t * 20 + s * 25) % 75); ell(ctx, P, x + 116 + sin(t + s) * 6, sy, 8 + s * 3, 6 + s * 2, P.pixel ? '#94b0c2' : 'rgba(220,220,230,.45)'); }
        } else tree(ctx, P, x + 120, y, 110, '#3f7a3a', '#5a3a24');
      });
      layer(ctx, cam, 0.85, 90, function (x) { rect(ctx, P, x, FT - 34, 6, 28, '#6a4a2a'); rect(ctx, P, x, FT - 28, 90, 4, '#7a5a34'); rect(ctx, P, x, FT - 16, 90, 4, '#7a5a34'); });
      floorBand(ctx, P, cam, FT - 8, '#a2794c', '#8c6640', '#94704a', 140);
      layer(ctx, cam, 1, 70, function (x, i) { if (hash(i * 3) < 0.5) ell(ctx, P, x + 20, FT + 40 + hash(i * 7) * 150, 6, 3, '#7a5a3a'); });
    },
    village: function (ctx, P, cam, t) {
      ctx.fillStyle = grad(ctx, P, 0, FT, [[0, '#d8683a'], [0.6, '#f2a85a'], [1, '#ffd890']]); ctx.fillRect(0, 0, 960, FT);
      ell(ctx, P, 300 - cam * 0.02, FT - 70, 50, 50, '#ffe0a0');
      hills(ctx, P, cam, 0.1, FT - 70, 50, '#5a3a4a', 2);
      layer(ctx, cam, 0.2, 60, function (x, i) { tree(ctx, P, x, FT - 40, 70 + hash(i) * 40, '#3a3448', '#2a2430'); });
      layer(ctx, cam, 0.5, 260, function (x, i) { izba(ctx, P, x + 30 + hash(i) * 40, FT - 12, 120, 70, '#8a5a34', '#5a2e22', hash(i * 5) < 0.6); if (hash(i * 9) < 0.4) { rect(ctx, P, x + 200, FT - 50, 30, 36, '#6a4a2a'); rect(ctx, P, x + 196, FT - 70, 38, 6, '#4a2e1e'); } });
      layer(ctx, cam, 0.85, 40, function (x) { rect(ctx, P, x, FT - 30, 8, 24, '#6a4630'); poly(ctx, P, [x, FT - 30, x + 4, FT - 36, x + 8, FT - 30], '#6a4630'); });
      floorBand(ctx, P, cam, FT - 8, '#8c6a42', '#7a5a38', null);
      layer(ctx, cam, 1, 60, function (x, i) { if (hash(i * 11) < 0.4) { line(ctx, P, x, FT + 2, x + 3, FT - 8, 2, '#6a8a3a'); line(ctx, P, x + 6, FT + 2, x + 5, FT - 10, 2, '#6a8a3a'); } });
    },
    forest: function (ctx, P, cam, t) {
      ctx.fillStyle = grad(ctx, P, 0, FT, [[0, '#1c3a2c'], [1, '#4a7244']]); ctx.fillRect(0, 0, 960, FT);
      layer(ctx, cam, 0.15, 70, function (x, i) { rect(ctx, P, x, 0, 18 + hash(i) * 10, FT, '#24402e'); });
      layer(ctx, cam, 0.4, 120, function (x, i) { var w = 26 + hash(i) * 16; rect(ctx, P, x, 0, w, FT, '#2e2418'); rect(ctx, P, x + w * 0.2, 0, 4, FT, '#3c3020'); ell(ctx, P, x + w / 2, 40, 90, 50, '#2c5a30'); });
      if (!P.pixel) { ctx.fillStyle = 'rgba(255,240,170,.07)'; for (var k = 0; k < 4; k++) { var bx = ((k * 300 - cam * 0.3) % 1200 + 1200) % 1200 - 120; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 60, 0); ctx.lineTo(bx + 200, FT); ctx.lineTo(bx + 100, FT); ctx.fill(); } }
      layer(ctx, cam, 0.8, 180, function (x, i) { ell(ctx, P, x + 60, FT - 16, 60, 26, '#2a5228'); ell(ctx, P, x + 110, FT - 20, 40, 22, '#356a30'); });
      floorBand(ctx, P, cam, FT - 8, '#4c5c2e', '#3e4c26', null);
      layer(ctx, cam, 1, 110, function (x, i) { if (hash(i * 13) < 0.5) ell(ctx, P, x, FT + 30 + hash(i) * 160, 14, 5, '#5a6c34'); });
      for (var f = 0; f < 10; f++) { var fx = (hash(f) * 960 + sin(t * 0.7 + f) * 30), fy = 60 + hash(f * 3) * (FT - 80) + cos(t + f) * 12; if (Math.floor(t * 2 + f) % 3) ell(ctx, P, fx, fy, 2, 2, '#e8ff8a'); }
    },
    crossing: function (ctx, P, cam, t) {
      ctx.fillStyle = grad(ctx, P, 0, FT, [[0, '#7c98b0'], [1, '#d8e2e4']]); ctx.fillRect(0, 0, 960, FT);
      hills(ctx, P, cam, 0.1, FT - 110, 50, '#6a7f8c', 4);
      layer(ctx, cam, 0.2, 80, function (x, i) { tree(ctx, P, x, FT - 100, 50 + hash(i) * 30, '#4c6a54', '#3a3a30'); });
      rect(ctx, P, 0, FT - 100, 960, 90, '#3a6a8a');
      layer(ctx, cam, 0.5, 46, function (x, i) { rect(ctx, P, x + ((t * 20) % 46), FT - 90 + (i % 4) * 20, 24, 2, '#7ab0d0'); });
      layer(ctx, cam, 0.9, 180, function (x) { rect(ctx, P, x, FT - 46, 8, 40, '#5a3e26'); });
      rect(ctx, P, 0, FT - 34, 960, 5, '#6a4a2c'); rect(ctx, P, 0, FT - 20, 960, 4, '#6a4a2c');
      floorBand(ctx, P, cam, FT - 8, '#8c6a46', '#6e5236', '#6e5236', 34);
      rect(ctx, P, 0, 524, 960, 16, '#2e5a7a');
      layer(ctx, cam, 1, 60, function (x) { rect(ctx, P, x + ((t * 30) % 60), 530, 20, 2, '#7ab0d0'); });
    },
    walls: function (ctx, P, cam, t) {
      ctx.fillStyle = grad(ctx, P, 0, FT, [[0, '#121834'], [1, '#3e4270']]); ctx.fillRect(0, 0, 960, FT);
      for (var i = 0; i < 40; i++) { var sx = (hash(i) * 2000 - cam * 0.02) % 960; if (sx < 0) sx += 960; rect(ctx, P, sx, hash(i * 7) * (FT - 140), 2, 2, (i + Math.floor(t * 2)) % 7 ? '#e8e8ff' : '#8888aa'); }
      ell(ctx, P, 160 - cam * 0.01, 70, 26, 26, '#f0ecd0'); ell(ctx, P, 170 - cam * 0.01, 64, 22, 22, '#121834');
      hills(ctx, P, cam, 0.08, FT - 120, 40, '#1e2244', 5);
      layer(ctx, cam, 0.35, 340, function (x, i) { rect(ctx, P, x + 40, FT - 200, 70, 190, '#3a3a48'); for (var c = 0; c < 4; c++) rect(ctx, P, x + 40 + c * 20, FT - 214, 12, 14, '#3a3a48'); rect(ctx, P, x + 66, FT - 160, 16, 26, '#ffcf6a'); });
      rect(ctx, P, 0, FT - 120, 960, 112, '#585866');
      layer(ctx, cam, 0.8, 48, function (x, i) { rect(ctx, P, x, FT - 136, 30, 18, '#585866'); for (var r = 0; r < 4; r++) rect(ctx, P, x + (r % 2) * 24, FT - 116 + r * 26, 48, 2, '#46465a'); });
      layer(ctx, cam, 0.8, 240, function (x) { rect(ctx, P, x + 20, FT - 80, 6, 26, '#4a3a2a'); ell(ctx, P, x + 23, FT - 86 + sin(t * 10) * 1.5, 7, 10, '#ffb040'); ell(ctx, P, x + 23, FT - 84, 4, 6, '#fff0a0'); });
      floorBand(ctx, P, cam, FT - 8, '#6e6e7a', '#5a5a66', '#5a5a66', 64);
    },
    foundry: function (ctx, P, cam, t) {
      ctx.fillStyle = grad(ctx, P, 0, FT, [[0, '#140c0c'], [1, '#4a1e14']]); ctx.fillRect(0, 0, 960, FT);
      layer(ctx, cam, 0.2, 140, function (x, i) { line(ctx, P, x + 30, 0, x + 30, 60 + hash(i) * 80, 3, '#3a2a26'); ell(ctx, P, x + 30, 66 + hash(i) * 80, 6, 4, '#3a2a26'); });
      layer(ctx, cam, 0.5, 320, function (x, i) {
        rect(ctx, P, x + 30, FT - 210, 140, 200, '#2c1c1a'); poly(ctx, P, [x + 20, FT - 210, x + 100, FT - 250, x + 180, FT - 210], '#24181a');
        var gl = 0.7 + 0.3 * sin(t * 4 + i); ell(ctx, P, x + 100, FT - 70, 40, 34, P.pixel ? '#ef7d2a' : 'rgba(255,' + Math.round(120 + 60 * gl) + ',40,1)'); ell(ctx, P, x + 100, FT - 64, 24, 20, '#ffe08a');
        rect(ctx, P, x + 60, FT - 110, 80, 6, '#4a2a22');
      });
      rect(ctx, P, 0, FT - 34, 960, 18, '#ff6a1a'); layer(ctx, cam, 0.9, 50, function (x) { ell(ctx, P, x + ((t * 15) % 50), FT - 25, 8, 3, '#ffd060'); });
      rect(ctx, P, 0, FT - 16, 960, 8, '#2a1a18');
      floorBand(ctx, P, cam, FT - 8, '#3c3436', '#2c2628', '#2c2628', 80);
      layer(ctx, cam, 1, 80, function (x) { ell(ctx, P, x + 6, FT + 4, 2, 2, '#6a5a5a'); ell(ctx, P, x + 6, 510, 2, 2, '#6a5a5a'); });
      if (!P.pixel) { ctx.fillStyle = 'rgba(255,90,20,.06)'; ctx.fillRect(0, 0, 960, 540); }
    },
    camp: function (ctx, P, cam, t) {
      ctx.fillStyle = grad(ctx, P, 0, FT, [[0, '#0e1228'], [1, '#2a2a4a']]); ctx.fillRect(0, 0, 960, FT);
      for (var i = 0; i < 50; i++) rect(ctx, P, hash(i) * 960, hash(i * 5) * (FT - 100), 2, 2, (i + Math.floor(t * 3)) % 9 ? '#d8d8f0' : '#666688');
      hills(ctx, P, 0, 0, FT - 50, 50, '#1a1e34', 6);
      layer(ctx, 0, 0, 120, function (x, i) { tree(ctx, P, x + 40, FT - 20, 90 + hash(i) * 40, '#1e3424', '#1a1410'); });
      [[160, '#7a4a2a'], [740, '#5a5a3a']].forEach(function (q) { poly(ctx, P, [q[0] - 70, FT - 6, q[0], FT - 96, q[0] + 70, FT - 6], q[1]); poly(ctx, P, [q[0] - 12, FT - 6, q[0], FT - 40, q[0] + 12, FT - 6], '#1a1010'); });
      floorBand(ctx, P, 0, FT - 8, '#34442a', '#2a3822', null);
      var fx = 480, fy = FT + 110;
      if (!P.pixel) { var g = ctx.createRadialGradient(fx, fy, 10, fx, fy, 260); g.addColorStop(0, 'rgba(255,170,60,.35)'); g.addColorStop(1, 'rgba(255,170,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540); }
      line(ctx, P, fx - 22, fy, fx + 22, fy - 6, 6, '#5a3a20'); line(ctx, P, fx - 20, fy - 6, fx + 22, fy, 6, '#4a2e18');
      for (var k = 0; k < 5; k++) { var h = 22 + sin(t * 9 + k * 2) * 8; ell(ctx, P, fx - 12 + k * 6, fy - 10 - h / 2, 6, h / 2, k % 2 ? '#ff8a20' : '#ffc040'); }
    }
  };

  // ---------- Эффекты ----------
  function spellFx(ctx, P, sp, S, L) {
    var k = Math.min(1, sp.t / 0.7), out = sp.t > 1.0 ? 1 - (sp.t - 1.0) / 0.4 : 1, lv = sp.level, t = S.time;
    ctx.save(); ctx.globalAlpha = Math.max(0, out);
    var targets = S.foes.filter(function (f) { return f.alive && f.kind !== 'imp' && f.x > S.cam - 20 && f.x < S.cam + 980; });
    if (sp.kind === 'forge') {
      if (!P.pixel) { ctx.fillStyle = 'rgba(255,110,20,' + (0.18 + 0.05 * lv) * k + ')'; ctx.fillRect(0, L.HUD, 960, 540); }
      var n = 3 + lv * 2;
      for (var i = 0; i < n; i++) {
        var x = 40 + (i + 0.5) * (880 / n), h = (60 + lv * 45) * k * (0.8 + 0.2 * sin(t * 20 + i));
        for (var j = 0; j < 4; j++) ell(ctx, P, x + sin(t * 15 + j + i) * 6, FT + 90 - j * h / 4 - h / 8, 18 - j * 3, h / 6, j % 2 ? '#ffd050' : '#ff5a1a');
      }
      targets.forEach(function (f) { var sx = f.x - S.cam, sy = FT + f.z; for (var j = 0; j < 3; j++) ell(ctx, P, sx + (j - 1) * 10, sy - 20 - j * 12 * k, 10, 18 * k, j % 2 ? '#ffe070' : '#ff7020'); });
    } else if (sp.kind === 'whirl') {
      if (!P.pixel) { ctx.fillStyle = 'rgba(160,220,255,' + (0.12 + 0.04 * lv) * k + ')'; ctx.fillRect(0, L.HUD, 960, 540); }
      ctx.lineCap = 'round';
      for (var a = 0; a < 6 + lv * 3; a++) {
        var cx = ((a * 157 + t * 900) % 1100) - 70, cy = FT + 20 + (a * 53) % 160;
        ctx.strokeStyle = C(P, a % 2 ? '#e8f6ff' : '#9ad8ff'); ctx.lineWidth = 3 + lv;
        ctx.beginPath(); ctx.arc(cx, cy - 30, 30 + lv * 6, t * 12 + a, t * 12 + a + 2.2); ctx.stroke();
      }
      targets.forEach(function (f) { var sx = f.x - S.cam, sy = FT + f.z; ctx.strokeStyle = C(P, '#ffffff'); ctx.lineWidth = 3; for (var r = 0; r < 3; r++) { ctx.beginPath(); ctx.ellipse(sx, sy - 20 - r * 22, 26 - r * 4, 8, 0, t * 20 + r, t * 20 + r + 4); ctx.stroke(); } });
    } else {
      if (!P.pixel) { ctx.fillStyle = 'rgba(90,200,80,' + (0.12 + 0.04 * lv) * k + ')'; ctx.fillRect(0, L.HUD, 960, 540); }
      for (var q = 0; q < 10 + lv * 4; q++) { var rx = (q * 97) % 960, ry = FT + 10 + (q * 41) % 170, rh = (20 + lv * 10) * k; line(ctx, P, rx, ry, rx + sin(q) * 10, ry - rh, 4, '#3a7a2a'); ell(ctx, P, rx + sin(q) * 10, ry - rh, 4, 3, '#7ad04a'); }
      targets.forEach(function (f) {
        var sx = f.x - S.cam, sy = FT + f.z;
        for (var r = -2; r <= 2; r++) { var hh = (40 + lv * 12) * k * (1 - Math.abs(r) * 0.18); line(ctx, P, sx + r * 9, sy, sx + r * 12 + sin(t * 8 + r) * 4, sy - hh, 5, r % 2 ? '#2e6a24' : '#4a8a2e'); poly(ctx, P, [sx + r * 12 - 3, sy - hh * 0.6, sx + r * 12 + 6, sy - hh * 0.7, sx + r * 12, sy - hh * 0.5], '#9ae05a'); }
      });
    }
    ctx.restore();
  }

  // ---------- Мир ----------
  function heroPose(h) {
    var mv = h.move, st = h.state;
    if (h.mount) return { pose: 'ride', mp: st === 'mountAtk' ? h.phase : null };
    if (st === 'atk' && mv) {
      var ph = h.phase === 'w' ? h.pt / Math.max(0.01, mv.w) : h.phase === 'a' ? h.pt / Math.max(0.01, mv.a) : h.pt / Math.max(0.01, mv.r);
      var nm = mv.name, ps = 'swing';
      if (nm === 'dash') ps = 'dash'; else if (nm === 'back') ps = 'back'; else if (nm === 'shot') ps = 'shoot';
      else if (h.hero === 'zhdan') ps = mv.step === 2 ? 'over' : 'swing';
      else if (h.hero === 'secha') ps = mv.step === 3 ? 'over' : mv.step === 1 ? 'swing2' : 'swing';
      else ps = mv.step === 2 ? 'over' : 'swing';
      return { pose: ps, mp: h.phase, ph: ph };
    }
    if (st === 'jump') return { pose: h.airAtk > 0 ? 'air' : 'jump' };
    if (st === 'walk') return { pose: h.running ? 'run' : 'walk' };
    if (st === 'grab') return { pose: 'grab', knee: h.kneeT > 0 };
    if (st === 'toss') return { pose: 'toss' };
    if (st === 'hurt') return { pose: 'hurt' };
    if (st === 'cast') return { pose: 'cast' };
    if (st === 'rise') return { pose: 'rise' };
    if (st === 'down' || st === 'dead') return { pose: 'idle', lying: 1 };
    return { pose: 'idle' };
  }
  function foePose(f) {
    var st = f.state;
    if (f.mount) return { pose: 'ride', mp: st === 'mountAtk' ? f.phase : null };
    if (st === 'atk') {
      var E = f.def, ph = f.phase === 'w' ? f.pt / E.windup : f.phase === 'a' ? f.pt / E.act : f.pt / E.rec;
      return { pose: f.type === 'spear' ? 'thrust' : f.type === 'brute' ? 'over' : 'swing', mp: f.phase, ph: ph };
    }
    if (st === 'walk') return { pose: f.moving === false ? 'idle' : 'walk' };
    if (st === 'leapWind') return { pose: 'crouch' };
    if (st === 'leap') return { pose: 'air' };
    if (st === 'guard') return { pose: 'guard' };
    if (st === 'hurt') return { pose: 'hurt' };
    if (st === 'grabbed') return { pose: 'grabbed' };
    if (st === 'thrown') return { pose: 'hurt', spin: f.st * 12 };
    if (st === 'rise') return { pose: 'rise' };
    if (st === 'down') return { pose: 'idle', lying: 1 };
    return { pose: 'idle' };
  }
  function bossPose(b) {
    var st = b.state;
    if (st === 'atk') {
      var mv = b.move, mp = b.phase;
      var map = { combo: b.type === 'voevoda' || b.type === 'cepnik' ? 'swing' : 'over', charge: mp === 'w' ? 'crouch' : 'dash', slam: 'slam', sweep: 'back', breath: 'ride', pour: 'cast', summon: 'cast' };
      if (b.type === 'stenoboy' && mv === 'combo') map.combo = 'thrust';
      return { pose: map[mv] || 'swing', mp: mp, ph: 0.5 };
    }
    if (st === 'walk') return { pose: b.moving === false ? 'idle' : 'walk' };
    if (st === 'hurt') return { pose: 'hurt' };
    if (st === 'rise') return { pose: 'rise' };
    if (st === 'down') return { pose: 'idle', lying: 1 };
    return { pose: 'idle' };
  }

  function world(ctx, S, P, o) {
    o = o || {};
    var L = D.logic; FT = L.FLOOR_TOP;
    var cam = Math.round(S.cam), t = S.time, shake = o.shake || 0;
    ctx.save();
    if (shake) ctx.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake));
    (BG[S.key] || BG.trakt)(ctx, P, cam, t);
    // пол: лужи, волны
    S.puddles.forEach(function (p) {
      var sx = p.x - cam, sy = FT + p.z;
      if (p.warn > 0) { if (Math.floor(t * 10) % 2) { ctx.strokeStyle = C(P, '#ffb040'); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(sx, sy, p.r, p.r * 0.38, 0, 0, PI * 2); ctx.stroke(); } }
      else { ell(ctx, P, sx, sy, p.r, p.r * 0.4, '#c8401a'); ell(ctx, P, sx, sy - 1, p.r * 0.75, p.r * 0.28, '#ff8a2a'); ell(ctx, P, sx + sin(t * 6) * p.r * 0.3, sy - 2, 5, 3, '#ffe080'); }
    });
    S.waves.forEach(function (w) {
      var sx = w.x - cam, sy = FT + w.z;
      for (var i = 0; i < 4; i++) poly(ctx, P, [sx - 12 + i * 2 * -w.dir, sy, sx - w.dir * i * 7, sy - 26 + i * 5, sx + 12, sy], i % 2 ? '#ffcf6a' : '#c8823a');
    });
    // тени
    var bodies = [];
    S.heroes.forEach(function (h) { if (h.out || h.state === 'dead') return; bodies.push({ z: h.z, e: h, k: 'hero' }); });
    S.foes.forEach(function (f) { bodies.push({ z: f.z + (f.state === 'grabbed' ? 0.5 : 0), e: f, k: f.kind }); });
    S.mounts.forEach(function (m) { if (!m.rider) bodies.push({ z: m.z, e: m, k: 'mount' }); });
    S.items.forEach(function (it) { bodies.push({ z: it.z - 2, e: it, k: 'item' }); });
    bodies.forEach(function (b) {
      var e = b.e, sx = e.x - cam, sy = FT + e.z, big = e.mount || b.k === 'mount' ? 2 : (e.def && e.def.big) || (e.look && e.look.s) || 1;
      if (b.k === 'item') big = 0.6; if (b.k === 'imp') big = 0.7;
      if (b.k === 'boss' && e.def.rider) big = 2.4;
      if (sx < -120 || sx > 1080) return;
      ell(ctx, P, sx, sy, 22 * big * GS, 6 * Math.min(1.6, big) * GS, P.shadow);
    });
    bodies.sort(function (a, b) { return a.z - b.z; });
    bodies.forEach(function (b) {
      var e = b.e, sx = e.x - cam, sy = FT + e.z - e.h;
      if (sx < -150 || sx > 1110) return;
      if (b.k === 'item') { item(ctx, P, e, sx, sy, t, GS); return; }
      if (b.k === 'mount') { beast(ctx, P, e, sx, sy, t, { s: GS, moving: e.state === 'spook' || e.st % 1.5 < 0.7, saddle: true }); return; }
      if (b.k === 'imp') { if (e.inv > 0 && Math.floor(t * 20) % 2) return; imp(ctx, P, e, sx, sy, t, GS); return; }
      var blink = (b.k === 'hero' && e.inv > 0 && e.state !== 'cast' && e.state !== 'down' && e.state !== 'rise' && Math.floor(t * 16) % 2) ||
        (e.dying && e.landed && e.st > 0.4 && Math.floor(t * 14) % 2);
      if (blink) return;
      var look, ps, s = GS;
      if (b.k === 'hero') { look = LOOK[e.hero]; ps = heroPose(e); }
      else if (b.k === 'foe') { look = LOOK[e.type]; ps = foePose(e); }
      else { look = LOOK[e.type === 'twins' ? 'twins' + (e.twin || 0) : e.type]; ps = bossPose(e); }
      var mt = e.mount || (b.k === 'boss' && e.def.rider ? { type: 'fire', face: e.face, def: { reach: 200 } } : null);
      if (mt) {
        var bs = (b.k === 'boss' ? 1.3 : 1) * GS, att = e.state === 'mountAtk' ? e.phase : (b.k === 'boss' && e.move === 'breath' ? e.phase : '');
        beast(ctx, P, { type: mt.type, face: e.face, def: mt.def }, sx, sy, t, { s: bs, moving: e.state === 'walk', att: att, flash: e.flash > 0 });
        var rs = (b.k === 'boss' ? 0.9 : 1) * GS;
        figure(ctx, P, { x: sx - 4 * e.face * bs, y: sy - 50 * bs + 30 * rs * (look.s || 1), face: e.face, look: look, pose: 'ride', mp: ps.mp, t: t, flash: e.flash, s: rs });
      } else {
        figure(ctx, P, { x: sx, y: sy, face: e.face, look: look, pose: ps.pose, mp: ps.mp, ph: ps.ph, t: t + e.id, lying: ps.lying, spin: ps.spin, knee: ps.knee, flash: e.flash, s: s });
      }
      // «спина» — дуги в обе стороны
      if (b.k === 'hero' && e.state === 'atk' && e.move && e.move.name === 'back' && e.phase === 'a') {
        ctx.strokeStyle = C(P, P.hero[e.hero]); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(sx, sy - 56, 84, 20, 0, 0, PI * 2); ctx.stroke();
      }
      // замах врага/босса — вспышка-предупреждение
      if ((b.k === 'foe' || b.k === 'boss') && ((e.state === 'atk' || e.state === 'mountAtk') && e.phase === 'w' || e.state === 'leapWind') && Math.floor(t * 12) % 2) {
        var hy = sy - (b.k === 'boss' ? 150 : 110) * (look && look.s || 1) * GS;
        poly(ctx, P, [sx - 6, hy - 14, sx + 6, hy - 14, sx + 3, hy, sx - 3, hy], '#ff4030'); rect(ctx, P, sx - 3, hy + 3, 6, 5, '#ff4030');
      }
      // слэш героя — след удара
      if (b.k === 'hero' && e.state === 'atk' && e.phase === 'a' && e.move && e.move.name !== 'shot' && e.move.name !== 'back' && !P.pixel) {
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath();
        var r = (e.move.reach || 50) * 0.9; ctx.arc(sx + e.face * 12, sy - 64, r * GS, e.face > 0 ? -1.2 : PI - 0.6, e.face > 0 ? 0.6 : PI + 1.2); ctx.stroke();
      }
    });
    // стрелы
    S.projs.forEach(function (p) {
      var sx = p.x - cam, sy = FT + p.z - p.h, d = p.vx > 0 ? 1 : -1;
      line(ctx, P, sx - d * 26, sy, sx, sy, 2.5, '#e8d8a0'); poly(ctx, P, [sx, sy - 3, sx + d * 7, sy, sx, sy + 3], '#c8ccd4'); line(ctx, P, sx - d * 26, sy, sx - d * 20, sy - 4, 2, '#d04a3a'); line(ctx, P, sx - d * 26, sy, sx - d * 20, sy + 4, 2, '#d04a3a');
    });
    S.spells.forEach(function (sp) { spellFx(ctx, P, sp, S, L); });
    ctx.restore();
  }

  // Портрет героя (меню выбора, HUD)
  function portrait(ctx, P, key, x, y, s, t, ps) {
    figure(ctx, P, { x: x, y: y, face: 1, look: LOOK[key], pose: ps || 'idle', t: t || 0, s: s || 1, mp: 'a' });
  }

  D.render = { world: world, figure: figure, beast: beast, imp: imp, item: item, portrait: portrait, LOOK: LOOK, C: C, shade: shade, mix: mix, BG: BG };
})(typeof window !== 'undefined' ? window : globalThis);
