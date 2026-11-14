/* ОПЕРАЦИЯ · рендер: поле (клетки, туман, предметы, бойцы, лучи, взрывы), HUD, боковая панель и панель действий.
   modern — рисуется сразу в канву (клетка 32 px); retro — в буфер половинного размера (клетка 16 px) и ×2 без сглаживания.
   Тексты — только через g.t(). OPERATSIYA.render, OPERATSIYA.layout */
(function (global) {
  'use strict';
  var O = global.OPERATSIYA = global.OPERATSIYA || {};
  var LG = O.logic, T = LG.T, MW = LG.MW, MH = LG.MH;
  var LY = { W: 960, H: 600, HUD: 36, TS: 32, MAPW: MW * 32, MAPH: MH * 32, PX: MW * 32, PW: 960 - MW * 32, BY: 36 + MH * 32, BH: 600 - 36 - MH * 32,
    rowY: 218, rowH: 25 };
  LY.BTNS = ['aimed', 'snap', 'burst', 'gear', 'crouch', 'reload', 'act', 'turn', 'kit', 'end'];
  LY.btn = function (i) { var w = LY.W / LY.BTNS.length; return { x: Math.round(i * w) + 3, y: LY.BY + 5, w: Math.round(w) - 6, h: LY.BH - 10 }; };
  O.layout = LY;

  function fmt(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); }
  function txt(g, s, x, y, o, P) {
    o = o || {}; o.font = P.font;
    if (P.pixel) s = String(s).toUpperCase();
    if (o.shadow !== false && !P.pixel) { var c = o.color; o.color = 'rgba(0,0,0,.55)'; g.text(s, x + 1, y + 1, o); o.color = c; }
    g.text(s, x, y, o);
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function box(c, x, y, w, h, P, fill, edge, r) {
    if (P.pixel) { c.fillStyle = fill; c.fillRect(x, y, w, h); if (edge) { c.fillStyle = edge; c.fillRect(x, y, w, 2); c.fillRect(x, y + h - 2, w, 2); c.fillRect(x, y, 2, h); c.fillRect(x + w - 2, y, 2, h); } return; }
    rr(c, x, y, w, h, r == null ? 8 : r); c.fillStyle = fill; c.fill(); if (edge) { c.strokeStyle = edge; c.lineWidth = 1; c.stroke(); }
  }
  function bar(c, x, y, w, h, v, max, col, P, mark) {
    c.fillStyle = P.pixel ? '#202020' : 'rgba(255,255,255,.08)'; c.fillRect(x, y, w, h);
    c.fillStyle = col; c.fillRect(x, y, Math.max(0, Math.round(w * Math.min(1, v / Math.max(1, max)))), h);
    if (mark != null) { c.fillStyle = P.ink; c.fillRect(x + Math.round(w * mark) - 1, y - 1, 2, h + 2); }
  }
  function nameOf(g, u) {
    if (!u) return '';
    if (u.kind === 'mech') return u.ni >= 0 ? g.t('n_' + u.ni) : g.t('k_mech');
    return g.t('k_' + u.kind);
  }

  // ---------- Клетки ----------
  function edgeBalc(S, x, y) { var o = []; [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d, i) { var nx = x + d[0], ny = y + d[1]; var t = nx < 0 || ny < 0 || nx >= MW || ny >= MH ? T.WALL : S.t[ny * MW + nx]; if (t !== T.BALC && t !== T.WALL) o.push(i); }); return o; }
  function drawTile(c, S, P, x, y, ts, time) {
    var k = y * MW + x, t = S.t[k], px = x * ts, py = y * ts, q = ts / 16;
    var fl = (x + y) % 2 ? P.floor : P.floor2;
    function floor() { c.fillStyle = fl; c.fillRect(px, py, ts, ts); c.fillStyle = P.floorDot; c.fillRect(px + 2 * q, py + 2 * q, q, q); c.fillRect(px + ts - 3 * q, py + ts - 3 * q, q, q); }
    if (t === T.FLOOR) floor();
    else if (t === T.WALL) {
      c.fillStyle = P.wallEdge; c.fillRect(px, py, ts, ts);
      c.fillStyle = P.wall; c.fillRect(px, py, ts, ts - 3 * q);
      c.fillStyle = P.wallTop; c.fillRect(px + q, py + q, ts - 2 * q, ts - 6 * q);
    } else if (t === T.BRICK) {
      c.fillStyle = P.brickLine; c.fillRect(px, py, ts, ts);
      c.fillStyle = P.brick;
      for (var r = 0; r < 4; r++) for (var b = -1; b < 2; b++) { var bx = px + b * 8 * q + (r % 2 ? 4 * q : 0) + q, by = py + r * 4 * q + q; c.fillRect(Math.max(px, bx), by, Math.min(px + ts, bx + 7 * q) - Math.max(px, bx), 3 * q); }
      var dmg = (LG.TILE_HP[T.BRICK] - S.thp[k]); c.fillStyle = P.void;
      if (dmg >= 1) c.fillRect(px + 6 * q, py + 5 * q, 2 * q, 5 * q);
      if (dmg >= 2) c.fillRect(px + 9 * q, py + 8 * q, 4 * q, 2 * q);
      if (dmg >= 3) c.fillRect(px + 3 * q, py + 11 * q, 3 * q, 2 * q);
    } else if (t === T.CRATE) {
      floor();
      c.fillStyle = P.crateDark; c.fillRect(px + 2 * q, py + 2 * q, 12 * q, 12 * q);
      c.fillStyle = P.crate; c.fillRect(px + 3 * q, py + 3 * q, 10 * q, 10 * q);
      c.fillStyle = P.crateDark; c.fillRect(px + 3 * q, py + 7 * q, 10 * q, 2 * q); c.fillRect(px + 7 * q, py + 3 * q, 2 * q, 10 * q);
      if (S.thp[k] < LG.TILE_HP[T.CRATE]) { c.fillStyle = P.void; c.fillRect(px + 10 * q, py + 4 * q, 2 * q, 2 * q); }
    } else if (t === T.DOOR) {
      c.fillStyle = P.doorDark; c.fillRect(px, py, ts, ts);
      c.fillStyle = P.door; c.fillRect(px + q, py + q, ts - 2 * q, ts - 2 * q);
      c.fillStyle = P.doorDark; c.fillRect(px + 7 * q, py + q, 2 * q, ts - 2 * q);
      c.fillStyle = P.warn; c.fillRect(px + 5 * q, py + 7 * q, q, 2 * q); c.fillRect(px + 10 * q, py + 7 * q, q, 2 * q);
    } else if (t === T.OPEN) {
      floor(); c.fillStyle = P.doorOpen;
      var vert = S.t[k - 1] === T.WALL || S.t[k + 1] === T.WALL || S.t[k - 1] === T.BRICK || S.t[k + 1] === T.BRICK;
      if (vert) { c.fillRect(px, py, 3 * q, ts); c.fillRect(px + ts - 3 * q, py, 3 * q, ts); } else { c.fillRect(px, py, ts, 3 * q); c.fillRect(px, py + ts - 3 * q, ts, 3 * q); }
    } else if (t === T.RUBBLE) {
      floor(); c.fillStyle = P.rubble;
      c.fillRect(px + 2 * q, py + 9 * q, 4 * q, 3 * q); c.fillRect(px + 8 * q, py + 3 * q, 5 * q, 3 * q); c.fillRect(px + 10 * q, py + 11 * q, 3 * q, 2 * q);
      c.fillStyle = P.rubble2; c.fillRect(px + 5 * q, py + 6 * q, 3 * q, 2 * q); c.fillRect(px + 3 * q, py + 3 * q, 2 * q, 2 * q);
    } else if (t === T.PIT) { c.fillStyle = P.pit; c.fillRect(px, py, ts, ts); }
    else if (t === T.BALC || t === T.LADDER) {
      if (t === T.BALC) {
        c.fillStyle = (x + y) % 2 ? P.balc : P.balc2; c.fillRect(px, py, ts, ts);
        c.fillStyle = P.floorDot; for (var i = 1; i < 4; i++) c.fillRect(px, py + i * 4 * q, ts, q * 0.5 > 0.5 ? q * 0.5 : 1);
        c.fillStyle = P.balcEdge; edgeBalc(S, x, y).forEach(function (e) {
          if (e === 0) c.fillRect(px, py, ts, q * 1.5); if (e === 2) c.fillRect(px, py + ts - q * 1.5, ts, q * 1.5);
          if (e === 1) c.fillRect(px + ts - q * 1.5, py, q * 1.5, ts); if (e === 3) c.fillRect(px, py, q * 1.5, ts);
        });
      } else {
        floor(); c.fillStyle = P.ladder;
        c.fillRect(px + 3 * q, py, 2 * q, ts); c.fillRect(px + 11 * q, py, 2 * q, ts);
        for (var j = 0; j < 4; j++) c.fillRect(px + 3 * q, py + (j * 4 + 1) * q, 10 * q, q * 1.5);
      }
    } else if (t === T.EXIT) {
      floor(); c.fillStyle = P.exit; c.globalAlpha = 0.25; c.fillRect(px, py, ts, ts); c.globalAlpha = 1;
      var ph = Math.floor(time * 3) % 2;
      c.fillRect(px + 4 * q, py + (5 + ph) * q, 8 * q, 2 * q); c.fillRect(px + 6 * q, py + (3 + ph) * q, 4 * q, 2 * q); c.fillRect(px + 4 * q, py + (10 + ph) * q, 8 * q, 2 * q);
    } else if (t === T.ZONE) {
      floor(); c.fillStyle = P.zone; c.globalAlpha = 0.18; c.fillRect(px, py, ts, ts); c.globalAlpha = 1;
      c.fillRect(px, py, ts, q); c.fillRect(px, py + ts - q, ts, q); c.fillRect(px, py, q, ts); c.fillRect(px + ts - q, py, q, ts);
    } else if (t === T.CORE) {
      floor();
      var pulse = 0.5 + 0.5 * Math.sin(time * 4);
      if (!P.pixel) { c.fillStyle = P.coreGlow; c.beginPath(); c.arc(px + ts / 2, py + ts / 2, ts * (0.5 + 0.12 * pulse), 0, 7); c.fill(); }
      c.fillStyle = P.wallEdge; c.fillRect(px + 2 * q, py + 2 * q, 12 * q, 12 * q);
      c.fillStyle = P.core; c.fillRect(px + 4 * q, py + 4 * q, 8 * q, 8 * q);
      c.fillStyle = P.ink; c.fillRect(px + 7 * q, py + 5 * q, 2 * q, (2 + Math.round(pulse * 4)) * q);
    }
  }
  function drawItem(c, it, P, ts, time) {
    var px = it.x * ts, py = it.y * ts, q = ts / 16, bob = P.pixel ? 0 : Math.sin(time * 3 + it.x) * q * 0.6;
    if (it.kind === 'clip') { c.fillStyle = P.warn; c.fillRect(px + 5 * q, py + 6 * q + bob, 6 * q, 5 * q); c.fillStyle = P.t0Dark; c.fillRect(px + 6 * q, py + 7 * q + bob, q, 3 * q); c.fillRect(px + 9 * q, py + 7 * q + bob, q, 3 * q); }
    else if (it.kind === 'kit') { c.fillStyle = P.ink; c.fillRect(px + 4 * q, py + 6 * q + bob, 8 * q, 6 * q); c.fillStyle = P.good; c.fillRect(px + 7 * q, py + 7 * q + bob, 2 * q, 4 * q); c.fillRect(px + 5 * q, py + 8 * q + bob, 6 * q, 2 * q); }
    else { gearShape(c, px + ts / 2, py + ts / 2 + bob, 4 * q, P.warn, P.t0Dark, P.pixel); }
  }
  function gearShape(c, cx, cy, r, col, hole, pix) {
    c.fillStyle = col;
    if (pix) { c.fillRect(cx - r, cy - r * 0.5, r * 2, r); c.fillRect(cx - r * 0.5, cy - r, r, r * 2); c.fillRect(cx - r * 0.75, cy - r * 0.75, r * 1.5, r * 1.5); c.fillStyle = hole; c.fillRect(cx - r * 0.25, cy - r * 0.25, r * 0.5, r * 0.5); return; }
    c.beginPath(); for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2, rr2 = i % 2 ? r : r * 0.72; c.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } c.closePath(); c.fill();
    c.fillStyle = hole; c.beginPath(); c.arc(cx, cy, r * 0.3, 0, 7); c.fill();
  }

  // ---------- Бойцы ----------
  function drawUnit(c, u, P, cx, cy, ts, time, o) {
    o = o || {}; var q = ts / 16, a = u.face * Math.PI / 4, fx = Math.cos(a), fy = Math.sin(a), pix = P.pixel;
    var sc = u.crouch ? 0.84 : 1;
    function circ(x, y, r, col) { c.fillStyle = col; if (pix) { var R = Math.max(1, Math.round(r)); c.fillRect(Math.round(x - R), Math.round(y - R * 0.7), 2 * R, Math.round(1.4 * R)); c.fillRect(Math.round(x - R * 0.7), Math.round(y - R), Math.round(1.4 * R), 2 * R); } else { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } }
    function sq(x, y, r, col) { c.fillStyle = col; if (pix) c.fillRect(Math.round(x - r), Math.round(y - r), Math.round(2 * r), Math.round(2 * r)); else { rr(c, x - r, y - r, 2 * r, 2 * r, r * 0.35); c.fill(); } }
    if (o.dim) c.globalAlpha = 0.45;
    if (!pix) { c.fillStyle = P.shadow; c.beginPath(); c.ellipse(cx + q, cy + 2 * q, 6 * q * sc, 4.5 * q * sc, 0, 0, 7); c.fill(); }
    if (u.heat >= 50 && u.alive) { var hp2 = 0.5 + 0.5 * Math.sin(time * 8); c.globalAlpha = (o.dim ? 0.3 : 1) * (0.35 + 0.4 * hp2); circ(cx, cy, 7.5 * q, P.heatC); c.globalAlpha = o.dim ? 0.45 : 1; }
    if (u.kind === 'mech' || u.kind === 'master') {
      var body = u.kind === 'master' ? P.masterC : P.t0, dark = u.kind === 'master' ? P.muted : P.t0Dark;
      sq(cx - fx * 3.5 * q, cy - fy * 3.5 * q, 2.6 * q * sc, dark);                       // ранец с инструментом
      circ(cx, cy, 5.4 * q * sc, dark); circ(cx, cy, 4.6 * q * sc, body);
      if (u.kind === 'mech') {
        c.strokeStyle = P.tool; c.lineWidth = Math.max(1, 1.6 * q); c.beginPath(); c.moveTo(cx + fx * 2 * q, cy + fy * 2 * q); c.lineTo(cx + fx * 7.5 * q, cy + fy * 7.5 * q); c.stroke();
        circ(cx + fx * 7.5 * q, cy + fy * 7.5 * q, 1.1 * q, P.beam0);
        circ(cx, cy, 3.1 * q * sc, P.helmetDark); circ(cx, cy, 2.5 * q * sc, P.helmet);
        circ(cx + fx * 2.2 * q, cy + fy * 2.2 * q, 1.1 * q, P.visor);
      } else { c.fillStyle = P.masterBand; c.fillRect(cx - 4 * q, cy - 0.8 * q, 8 * q, 1.6 * q); circ(cx, cy, 2.4 * q, P.ink); if (u.captive) { c.strokeStyle = P.bad; c.lineWidth = Math.max(1, q); c.strokeRect(cx - 6 * q, cy - 6 * q, 12 * q, 12 * q); } }
    } else {
      var big = u.kind === 'heavy' ? 1.2 : u.boss ? 1.4 : u.kind === 'scout' ? 0.8 : 1, R = 4.8 * q * big * sc;
      var col = u.boss ? P.bossC : P.t1, dk = u.boss ? P.bossDark : P.t1Dark;
      if (u.kind === 'heavy' || u.boss) circ(cx - fx * R * 0.9, cy - fy * R * 0.9, R * 0.45, dk);        // котёл / дымоход
      if (u.kind === 'grenadier') gearShape(c, cx - fx * R * 0.85, cy - fy * R * 0.85, R * 0.55, P.warn, dk, pix);
      sq(cx, cy, R + q * 0.8, dk); sq(cx, cy, R, col);
      c.fillStyle = P.t1Light; c.fillRect(Math.round(cx - R + q), Math.round(cy - R + q), Math.max(1, Math.round(q)), Math.max(1, Math.round(q))); c.fillRect(Math.round(cx + R - 2 * q), Math.round(cy + R - 2 * q), Math.max(1, Math.round(q)), Math.max(1, Math.round(q)));
      if (u.kind === 'scout') { c.strokeStyle = dk; c.lineWidth = Math.max(1, q); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - fy * 6 * q, cy + fx * 6 * q); c.stroke(); circ(cx - fy * 6 * q, cy + fx * 6 * q, q, P.eye); }
      if (u.boss) { for (var e = -1; e <= 1; e += 2) circ(cx + fx * R * 0.55 - fy * e * R * 0.35, cy + fy * R * 0.55 + fx * e * R * 0.35, R * 0.22, P.eye); }
      else { if (!pix) { c.fillStyle = 'rgba(255,176,58,.35)'; c.beginPath(); c.arc(cx + fx * R * 0.55, cy + fy * R * 0.55, R * 0.5, 0, 7); c.fill(); } circ(cx + fx * R * 0.55, cy + fy * R * 0.55, R * 0.28, P.eye); }
    }
    // прочность
    if (u.alive && !o.noBar) {
      var w = 12 * q, y0 = cy + 6.6 * q;
      c.fillStyle = P.void; c.fillRect(Math.round(cx - w / 2 - 1), Math.round(y0 - 1), Math.round(w + 2), Math.max(2, Math.round(2 * q)) + 2);
      c.fillStyle = u.team === 0 ? P.good : P.bad; c.fillRect(Math.round(cx - w / 2), Math.round(y0), Math.round(w * u.hp / u.hpMax), Math.max(2, Math.round(2 * q)));
    }
    c.globalAlpha = 1;
  }
  function drawWreck(c, u, P, cx, cy, ts) {
    var q = ts / 16; c.fillStyle = u.team === 0 ? P.t0Dark : P.t1Dark;
    c.fillRect(cx - 5 * q, cy - 2 * q, 4 * q, 3 * q); c.fillRect(cx + q, cy - 4 * q, 3 * q, 3 * q); c.fillRect(cx - q, cy + 2 * q, 5 * q, 2 * q);
    c.fillStyle = P.rubble2; c.fillRect(cx - 2 * q, cy - q, 2 * q, 2 * q);
  }

  // ---------- Мир ----------
  function viewSees(S, V, u) {
    if (u.team === V.viewTeam || (u.team === 0 && !S.hotseat)) return true;
    return !!S.vis[V.viewTeam][u.y * MW + u.x];
  }
  function drawWorld(c, S, P, V, ts) {
    var vt = V.viewTeam, seen = S.seen[vt], vis = S.vis[vt], time = V.time;
    for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
      var k = y * MW + x;
      if (!seen[k]) { c.fillStyle = P.void; c.fillRect(x * ts, y * ts, ts, ts); continue; }
      drawTile(c, S, P, x, y, ts, time);
    }
    S.items.forEach(function (it) { if (seen[it.y * MW + it.x]) drawItem(c, it, P, ts, time); });
    // обломки разобранных
    S.units.forEach(function (u) { if (!u.alive && seen[u.y * MW + u.x]) drawWreck(c, u, P, u.x * ts + ts / 2, u.y * ts + ts / 2, ts); });
    // туман
    c.fillStyle = P.fog;
    for (var y2 = 0; y2 < MH; y2++) for (var x2 = 0; x2 < MW; x2++) { var k2 = y2 * MW + x2; if (seen[k2] && !vis[k2]) c.fillRect(x2 * ts, y2 * ts, ts, ts); }
    // зона хода выбранного
    if (V.reach) {
      var R = V.reach;
      for (var i = 0; i < R.cost.length; i++) if (isFinite(R.cost[i]) && R.cost[i] > 0 && seen[i]) { c.fillStyle = R.cost[i] <= V.reachSafe ? P.reach : P.reach2; c.fillRect((i % MW) * ts, ((i / MW) | 0) * ts, ts, ts); }
    }
    // последние известные позиции врагов
    var kn = S.known[vt];
    Object.keys(kn).forEach(function (id) { var e = kn[id], u = null; S.units.forEach(function (v) { if (v.id === +id) u = v; }); if (!u || vis[e.y * MW + e.x] || viewSees(S, V, u)) return;
      c.globalAlpha = 0.35; drawUnit(c, { kind: u.kind, boss: u.boss, team: u.team, face: u.face, crouch: false, heat: 0, alive: true, hp: 1, hpMax: 1 }, P, e.x * ts + ts / 2, e.y * ts + ts / 2, ts, time, { noBar: true }); c.globalAlpha = 1;
      c.fillStyle = P.warn; c.font = 'bold ' + Math.round(ts * 0.45) + 'px ' + P.font; c.textAlign = 'center'; c.fillText('?', e.x * ts + ts / 2, e.y * ts + ts * 0.42); });
    // бойцы
    var sel = V.sel;
    S.units.forEach(function (u) {
      if (!u.alive || u.evac || !viewSees(S, V, u)) return;
      var p = V.pos && V.pos[u.id] || u, cx = p.x * ts + ts / 2, cy = p.y * ts + ts / 2;
      if (u.id === sel) {
        c.strokeStyle = P.sel; c.lineWidth = Math.max(1, ts / 16 * 1.5);
        if (P.pixel) c.strokeRect(Math.round(p.x * ts) + 1, Math.round(p.y * ts) + 1, ts - 2, ts - 2);
        else { c.beginPath(); c.arc(cx, cy, ts * 0.47, 0, 7); c.stroke(); }
      }
      if (V.target && V.target.id === u.id) { c.strokeStyle = P.bad; c.lineWidth = Math.max(1, ts / 16 * 1.5); c.strokeRect(Math.round(p.x * ts) + 1, Math.round(p.y * ts) + 1, ts - 2, ts - 2); }
      var dim = S.hotseat ? (u.team !== S.side) && false : false;
      drawUnit(c, u, P, cx, cy, ts, time, { dim: dim || (u.team === V.viewTeam && u.ap <= 0 && S.side === V.viewTeam && u.id !== sel && !u.captive && u.kind === 'mech' && !V.noDim) });
    });
    // лучи и взрывы
    var A = V.anims;
    if (A) {
      A.beams.forEach(function (b) {
        var al = Math.min(1, b.t / 0.12); c.globalAlpha = al;
        var x0 = b.x * ts + ts / 2, y0 = b.y * ts + ts / 2, x1 = b.tx * ts + ts / 2 + (b.hit ? 0 : b.ox * ts), y1 = b.ty * ts + ts / 2 + (b.hit ? 0 : b.oy * ts);
        c.strokeStyle = b.team === 0 ? P.beam0 : P.beam1; c.lineWidth = Math.max(1, ts / 16 * (b.mode === 'aimed' ? 2 : 1.4));
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        if (!P.pixel) { c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, ts / 32); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
        c.fillStyle = b.hit ? P.spark : P.muted; c.fillRect(x1 - ts / 10, y1 - ts / 10, ts / 5, ts / 5);
        c.globalAlpha = 1;
      });
      A.lobs.forEach(function (b) {
        var k3 = 1 - b.t / b.T, x = (b.x + (b.tx - b.x) * k3) * ts + ts / 2, y = (b.y + (b.ty - b.y) * k3) * ts + ts / 2 - Math.sin(k3 * Math.PI) * ts * 1.2;
        gearShape(c, x, y, ts * 0.18, P.warn, P.t0Dark, P.pixel);
      });
      A.booms.forEach(function (b) {
        var k4 = 1 - b.t / b.T, r = ts * (0.4 + 1.2 * k4);
        c.globalAlpha = Math.max(0, 1 - k4);
        for (var i2 = 0; i2 < 3; i2++) { c.fillStyle = P.boom[i2]; var rr3 = r * (1 - i2 * 0.28); if (P.pixel) c.fillRect(b.x * ts + ts / 2 - rr3, b.y * ts + ts / 2 - rr3, rr3 * 2, rr3 * 2); else { c.beginPath(); c.arc(b.x * ts + ts / 2, b.y * ts + ts / 2, rr3, 0, 7); c.fill(); } }
        c.globalAlpha = 1;
      });
    }
  }

  // ---------- Кадр боя ----------
  var buf = null, bctx = null;
  function frame(g, ctx, S, P, V) {
    var th = g.th();
    ctx.fillStyle = P.hud; ctx.fillRect(0, 0, LY.W, LY.H);
    if (V.hide) { ctx.fillStyle = P.void; ctx.fillRect(0, LY.HUD, LY.MAPW, LY.MAPH); }
    else if (P.pixel) {
      if (!buf) { buf = document.createElement('canvas'); buf.width = MW * 16; buf.height = MH * 16; bctx = buf.getContext('2d'); }
      bctx.imageSmoothingEnabled = false; drawWorld(bctx, S, P, V, 16);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, LY.HUD, LY.MAPW, LY.MAPH);
    } else { ctx.save(); ctx.translate(0, LY.HUD); drawWorld(ctx, S, P, V, LY.TS); ctx.restore(); }
    if (!V.hide) overlays(g, ctx, S, P, V);
    hud(g, ctx, S, P, V);
    panel(g, ctx, S, P, V);
    buttons(g, ctx, S, P, V);
    // всплывающие надписи
    (V.anims ? V.anims.floats : []).forEach(function (f) {
      var al = Math.min(1, f.t / 0.4), y = LY.HUD + f.y * LY.TS + LY.TS / 2 - (1.4 - f.t) * 26;
      ctx.globalAlpha = al; txt(g, f.text, f.x * LY.TS + LY.TS / 2, y, { size: f.big ? 17 : 13, align: 'center', color: f.color, weight: 900 }, P); ctx.globalAlpha = 1;
    });
    if (V.banner && V.banner.t > 0) {
      var a = Math.min(1, V.banner.t / 0.3); ctx.globalAlpha = a;
      box(ctx, LY.MAPW / 2 - 230, LY.HUD + LY.MAPH / 2 - 44, 460, 76, P, P.panel, V.banner.color || P.accent, 12);
      txt(g, V.banner.text, LY.MAPW / 2, LY.HUD + LY.MAPH / 2 - 10, { size: 24, align: 'center', color: V.banner.color || P.accent, weight: 900 }, P);
      if (V.banner.sub) txt(g, V.banner.sub, LY.MAPW / 2, LY.HUD + LY.MAPH / 2 + 16, { size: 13, align: 'center', color: P.muted, weight: 700, shadow: false }, P);
      ctx.globalAlpha = 1;
    }
    void th;
  }
  function overlays(g, ctx, S, P, V) {
    var ts = LY.TS, oy = LY.HUD;
    // путь
    if (V.preview && V.preview.path) {
      var u = V.selU, pts = [[u.x, u.y]].concat(V.preview.path);
      ctx.strokeStyle = V.preview.ok ? P.path : P.pathBad; ctx.lineWidth = P.pixel ? 4 : 3; ctx.setLineDash(P.pixel ? [] : [6, 5]);
      ctx.beginPath(); pts.forEach(function (p, i) { var x = p[0] * ts + ts / 2, y = oy + p[1] * ts + ts / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
      var e = pts[pts.length - 1];
      box(ctx, e[0] * ts + ts / 2 - 22, oy + e[1] * ts - 20, 44, 18, P, P.panel, V.preview.ok ? P.path : P.pathBad, 5);
      txt(g, V.preview.cost + ' ' + g.t('ap'), e[0] * ts + ts / 2, oy + e[1] * ts - 6, { size: 11, align: 'center', color: P.ink, weight: 800, shadow: false }, P);
    }
    // зона взрыва шестерни
    if (V.blast) {
      ctx.fillStyle = P.blast; ctx.fillRect((V.blast.x - 1) * ts, oy + (V.blast.y - 1) * ts, 3 * ts, 3 * ts);
      ctx.strokeStyle = V.blast.ok ? P.warn : P.bad; ctx.lineWidth = 2; ctx.strokeRect((V.blast.x - 1) * ts + 1, oy + (V.blast.y - 1) * ts + 1, 3 * ts - 2, 3 * ts - 2);
      if (V.blast.text) { box(ctx, V.blast.x * ts + ts / 2 - 40, oy + (V.blast.y - 1) * ts - 22, 80, 18, P, P.panel, V.blast.ok ? P.warn : P.bad, 5); txt(g, V.blast.text, V.blast.x * ts + ts / 2, oy + (V.blast.y - 1) * ts - 9, { size: 11, align: 'center', color: P.ink, weight: 800, shadow: false }, P); }
    }
    // линия прицела и шанс
    if (V.aim) {
      var a = V.aim, x0 = a.x0 * ts + ts / 2, y0 = oy + a.y0 * ts + ts / 2, x1 = a.x1 * ts + ts / 2, y1 = oy + a.y1 * ts + ts / 2;
      ctx.strokeStyle = a.ok ? P.bad : P.muted; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
      box(ctx, x1 - 30, y1 - ts / 2 - 24, 60, 20, P, P.panel, a.ok ? P.bad : P.muted, 5);
      txt(g, a.text, x1, y1 - ts / 2 - 9, { size: 13, align: 'center', color: a.ok ? P.ink : P.muted, weight: 900, shadow: false }, P);
    }
    // курсор
    if (V.hover) { ctx.strokeStyle = P.cursor; ctx.globalAlpha = 0.7; ctx.lineWidth = P.pixel ? 2 : 1.5; ctx.strokeRect(V.hover.x * ts + 1.5, oy + V.hover.y * ts + 1.5, ts - 3, ts - 3); ctx.globalAlpha = 1; }
  }
  function hud(g, ctx, S, P, V) {
    ctx.fillStyle = P.hud; ctx.fillRect(0, 0, LY.W, LY.HUD);
    ctx.fillStyle = P.line; ctx.fillRect(0, LY.HUD - 1, LY.W, 1);
    var sp = S.spec, title = (S.hotseat ? '' : (g.t('mShort') + sp.id + ' · ')) + g.t('m_' + sp.id);
    txt(g, title, 12, 24, { size: P.pixel ? 13 : 15, color: P.accent, weight: 900 }, P);
    txt(g, V.objText || '', LY.MAPW / 2 + 70, 24, { size: 13, align: 'center', color: P.ink, weight: 700 }, P);
    var side = S.hotseat ? g.t('sideH' + S.side) : (V.aiThinking ? g.t('ai') : g.t('side' + S.side));
    txt(g, g.t('turn') + ' ' + S.turn + (S.hotseat ? '' : '/' + sp.turns) + ' · ' + side, LY.W - 12, 24, { size: 13, align: 'right', color: S.side === 0 ? P.good : P.bad, weight: 800 }, P);
  }
  function panel(g, ctx, S, P, V) {
    var x = LY.PX, y = LY.HUD, w = LY.PW, h = LY.MAPH;
    ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h); ctx.fillStyle = P.line; ctx.fillRect(x, y, 1, h);
    var u = V.selU, px = x + 12, L = LG;
    if (u && !V.hide) {
      txt(g, (u.kind === 'mech' ? g.t('f_' + u.ni) : nameOf(g, u)), px, y + 22, { size: 14, color: P.ink, weight: 900 }, P);
      txt(g, (u.kind === 'mech' ? g.t('lvl') + ' ' + (u.lvl + 1) : ''), x + w - 12, y + 22, { size: 12, align: 'right', color: P.warn, weight: 800 }, P);
      var W = L.WEAPONS[u.weapon];
      txt(g, W ? g.t('w_' + u.weapon) + ' · ' + u.clip + '/' + W.clip + (u.inf ? '' : '  +' + u.clips) : '—', px, y + 42, { size: 12, color: P.muted, weight: 700, shadow: false }, P);
      var bw = w - 24 - 86, rows = [[g.t('hp'), u.hp, u.hpMax, P.good], [g.t('ap'), u.ap, u.apMax, P.accent], [g.t('heat'), u.heat, 100, P.heatC]];
      rows.forEach(function (r, i) {
        var yy = y + 56 + i * 20;
        txt(g, r[0], px, yy + 9, { size: 11, color: P.muted, weight: 700, shadow: false }, P);
        bar(ctx, px + 70, yy, bw - 34, 10, r[1], r[2], r[3], P, i === 2 ? 0.5 : null);
        if (i === 1 && V.costPreview) { var cw = Math.round((bw - 34) * Math.min(r[1], V.costPreview) / Math.max(1, r[2])); var x0 = px + 70 + Math.round((bw - 34) * r[1] / Math.max(1, r[2])) - cw; ctx.fillStyle = V.costOk ? P.warn : P.bad; ctx.fillRect(x0, yy, Math.max(2, cw), 10); }
        txt(g, i === 2 ? Math.round(r[1]) : r[1] + '/' + r[2], x + w - 12, yy + 9, { size: 11, align: 'right', color: P.ink, weight: 800, shadow: false }, P);
      });
      var line2 = g.t('acc') + ' ' + u.acc + ' · ' + g.t('stam') + ' ' + u.stam + (u.kind === 'mech' ? ' · ' + g.t('weight') + ' ' + L.weightOf(u) + '/' + L.limitOf(u) : '');
      txt(g, line2, px, y + 128, { size: 11, color: P.muted, weight: 700, shadow: false }, P);
      if (u.kind === 'mech') txt(g, g.t('it_gear') + ' ' + u.gear + ' · ' + g.t('it_kit') + ' ' + u.kit, px, y + 146, { size: 11, color: P.muted, weight: 700, shadow: false }, P);
      var st = [];
      if (u.crouch) st.push(g.t('crouched'));
      if (u.heat >= 50) st.push(g.t('heat') + '!');
      if (V.actLabel) st.push('F: ' + V.actLabel);
      txt(g, st.join(' · '), px, y + 162, { size: 11, color: u.heat >= 50 ? P.heatC : P.warn, weight: 800, shadow: false }, P);
    }
    // список бойцов
    var list = V.roster || [];
    ctx.fillStyle = P.line; ctx.fillRect(x + 8, LY.rowY - 12, w - 16, 1);
    list.forEach(function (q, i) {
      var yy = LY.rowY + i * LY.rowH, on = u && q.id === u.id, gone = !q.alive || q.evac;
      if (on) box(ctx, x + 6, yy - 2, w - 12, LY.rowH - 2, P, P.btnOn, P.sel, 6);
      txt(g, nameOf(g, q) + (q.evac ? ' ⇪' : ''), px, yy + 14, { size: 12, color: gone ? P.muted : P.ink, weight: on ? 900 : 700, shadow: false }, P);
      if (!gone) { bar(ctx, x + 112, yy + 5, 60, 6, q.hp, q.hpMax, P.good, P); bar(ctx, x + 112, yy + 14, 60, 5, q.ap, q.apMax, P.accent, P); if (q.heat >= 50) { ctx.fillStyle = P.heatC; ctx.fillRect(x + 178, yy + 5, 6, 14); } }
      txt(g, gone ? '—' : q.ap + ' ' + g.t('ap'), x + w - 12, yy + 14, { size: 11, align: 'right', color: gone ? P.muted : (q.ap > 0 ? P.accent : P.muted), weight: 800, shadow: false }, P);
    });
    // инфо / журнал
    var iy = LY.HUD + LY.MAPH - 112;
    ctx.fillStyle = P.line; ctx.fillRect(x + 8, iy - 8, w - 16, 1);
    (V.info || []).slice(0, 6).forEach(function (ln, i) {
      txt(g, ln.text, px, iy + 8 + i * 17, { size: 11, color: ln.color || P.muted, weight: ln.bold ? 900 : 700, shadow: false }, P);
    });
  }
  function buttons(g, ctx, S, P, V) {
    ctx.fillStyle = P.hud; ctx.fillRect(0, LY.BY, LY.W, LY.BH); ctx.fillStyle = P.line; ctx.fillRect(0, LY.BY, LY.W, 1);
    var B = V.btns || {};
    LY.BTNS.forEach(function (k, i) {
      var r = LY.btn(i), b = B[k] || {}, on = b.on, en = b.en !== false, hov = V.hoverBtn === k;
      box(ctx, r.x, r.y, r.w, r.h, P, on ? P.btnOn : P.btn, on ? P.accent : hov && en ? P.muted : P.line, 9);
      ctx.globalAlpha = en ? 1 : 0.38;
      icon(ctx, k, r.x + r.w / 2, r.y + 22, P, b);
      txt(g, b.label || g.t('b_' + k), r.x + r.w / 2, r.y + 48, { size: P.pixel ? 10 : 11, align: 'center', color: on ? P.accent : P.ink, weight: 800, shadow: false }, P);
      txt(g, (b.key || '') + (b.cost != null ? ' · ' + b.cost : ''), r.x + r.w / 2, r.y + 63, { size: 10, align: 'center', color: P.muted, weight: 700, shadow: false }, P);
      ctx.globalAlpha = 1;
    });
  }
  function icon(c, k, x, y, P, b) {
    c.fillStyle = P.ink; c.strokeStyle = P.ink; c.lineWidth = 2;
    function ln(a, b2, cc, d) { c.beginPath(); c.moveTo(x + a, y + b2); c.lineTo(x + cc, y + d); c.stroke(); }
    if (k === 'aimed') { c.beginPath(); c.arc(x, y, 8, 0, 7); c.stroke(); ln(-12, 0, -4, 0); ln(4, 0, 12, 0); ln(0, -12, 0, -4); ln(0, 4, 0, 12); }
    else if (k === 'snap') { ln(-10, 6, 10, -6); c.fillRect(x + 8, y - 8, 4, 4); }
    else if (k === 'burst') { for (var i = -1; i <= 1; i++) ln(-10, i * 6, 8, i * 6); }
    else if (k === 'gear') gearShape(c, x, y, 9, P.warn, P.btn, P.pixel);
    else if (k === 'crouch') { c.fillRect(x - 8, y + 2, 16, 6); c.beginPath(); c.arc(x, y - 4, 5, 0, 7); c.fill(); }
    else if (k === 'reload') { c.beginPath(); c.arc(x, y, 8, 0.4, 5.6); c.stroke(); c.fillRect(x + 5, y - 9, 5, 5); }
    else if (k === 'act') { c.fillRect(x - 8, y - 2, 12, 4); c.fillRect(x + 2, y - 7, 4, 14); c.beginPath(); c.arc(x - 7, y, 4, 0, 7); c.stroke(); }
    else if (k === 'turn') { c.beginPath(); c.arc(x, y, 8, -2.6, 1.6); c.stroke(); c.fillRect(x - 10, y - 9, 5, 5); }
    else if (k === 'kit') { c.fillStyle = P.good; c.fillRect(x - 3, y - 9, 6, 18); c.fillRect(x - 9, y - 3, 18, 6); }
    else if (k === 'end') { c.beginPath(); c.moveTo(x - 6, y - 9); c.lineTo(x + 7, y); c.lineTo(x - 6, y + 9); c.closePath(); c.fill(); c.fillRect(x + 8, y - 9, 3, 18); }
    void b;
  }

  O.render = { frame: frame, drawWorld: drawWorld, drawUnit: drawUnit, gearShape: gearShape, txt: txt, box: box, bar: bar, fmt: fmt, nameOf: nameOf };
})(typeof window !== 'undefined' ? window : globalThis);
