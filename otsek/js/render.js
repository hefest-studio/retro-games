/* ОТСЕК · общий рендер мира для тем retro и modern (палитры — js/classic.js и js/modern.js).
   Палуба (тайлы 24 px) рисуется со сдвигом камеры, поверх — слой темноты: из него «вырезаются» конусы фонарей
   героев (лучи останавливаются о стены — настоящие тени), аварийные лампы отсеков, огоньки терминалов и пульта.
   Паразиты ржавчины-роя тлеют угольками даже в темноте. OTSEK.render */
(function (global) {
  'use strict';
  var G = global.OTSEK = global.OTSEK || {};

  function rrect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function circ(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------- Видимость: луч до первой стены ----------
  function ray(S, x, y, a, range) {
    var L = G.logic, T = L.T, W = S.D.w, H = S.D.h, c = Math.cos(a), s = Math.sin(a), d = 0, stepL = 5;
    while (d < range) {
      d += stepL; var px = x + c * d, py = y + s * d, tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H || S.tiles[tx + ty * W] !== 0) { d += 7; break; }
    }
    d = Math.min(d, range);
    return [x + c * d, y + s * d];
  }
  function lightPoly(S, x, y, a0, a1, range, n) {
    var pts = [], full = a1 - a0 >= Math.PI * 2 - 0.01;
    if (!full) pts.push([x, y]);
    for (var i = 0; i <= n; i++) pts.push(ray(S, x, y, a0 + (a1 - a0) * i / n, range));
    return pts;
  }
  function lights(S, P, time) {
    var L = G.logic, out = [], lampR = 255 + S.lamp * 45, half = 0.6 + S.lamp * 0.1;
    S.heroes.forEach(function (h) {
      if (h.out || !h.alive) return;
      var a = Math.atan2(h.face[1], h.face[0]), fl = 1 - (h.hurtT > 0 ? 0.25 : 0);
      out.push({ x: h.x, y: h.y, r: lampR, poly: lightPoly(S, h.x, h.y, a - half, a + half, lampR, 44), k: fl, cone: true });
      out.push({ x: h.x, y: h.y, r: 62, poly: lightPoly(S, h.x, h.y, 0, Math.PI * 2, 62, 20), k: 0.85 });
    });
    S.D.rooms.forEach(function (r) {
      if (!r.lit && !(S.alarm && r.c === S.D.start)) return;
      var x = r.ccol * L.T, y = r.crow * L.T, fk = 0.55 + 0.25 * Math.sin(time * 7 + r.c * 3) * (hash(r.c, Math.floor(time * 3)) > 0.8 ? 1 : 0.2);
      out.push({ x: x, y: y, r: 130, poly: lightPoly(S, x, y, 0, Math.PI * 2, 130, 28), k: fk, tint: S.alarm ? P.alarm : P.lamp });
    });
    S.terminals.forEach(function (t) { out.push({ x: t.x, y: t.y + 6, r: 44, k: 0.75, simple: true }); });
    var o = S.D.objective;
    if (o.kind === 'console' && !S.consoleOn) out.push({ x: o.x, y: o.y, r: 70, k: 0.6 + 0.2 * Math.sin(time * 4), simple: true });
    if (S.boss && !S.boss.dead && S.boss.active) out.push({ x: S.boss.x, y: S.boss.y, r: 120, k: 0.7, simple: true });
    if (S.airOpen) { var A = S.D.airlock; out.push({ x: (A.x0 + A.x1) / 2, y: (A.y0 + A.y1) / 2, r: 90, k: 0.9, simple: true }); }
    S.bullets.forEach(function (b) { if (b.k === 'f' || b.k === 'c') out.push({ x: b.x, y: b.y, r: b.k === 'f' ? 34 : 26, k: 0.6, simple: true }); });
    S.cardsOnFloor.forEach(function (c) { if (!c.taken) out.push({ x: c.x, y: c.y, r: 22, k: 0.5 + 0.2 * Math.sin(time * 5), simple: true }); });
    return out;
  }

  // ---------- Палуба ----------
  function tilesLayer(ctx, S, P, cam, vw, vh, time) {
    var L = G.logic, T = L.T, W = S.D.w, tl = S.tiles;
    var tx0 = Math.max(0, Math.floor(cam.x / T) - 1), ty0 = Math.max(0, Math.floor(cam.y / T) - 1);
    var tx1 = Math.min(W - 1, Math.floor((cam.x + vw) / T) + 1), ty1 = Math.min(S.D.h - 1, Math.floor((cam.y + vh) / T) + 1);
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
      var v = tl[tx + ty * W], x = tx * T, y = ty * T, hsh = hash(tx, ty);
      if (v === 0 || v === 3) {
        ctx.fillStyle = (tx + ty) % 2 ? P.floor : P.floor2; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = P.seam; ctx.fillRect(x, y, T, 1); ctx.fillRect(x, y, 1, T);
        if (hsh < 0.08) { ctx.fillStyle = P.rust; ctx.fillRect(x + 4 + hsh * 60, y + 6, 6, 4); ctx.fillRect(x + 6 + hsh * 60, y + 9, 3, 3); }
        else if (hsh > 0.93) { ctx.fillStyle = P.grate; for (var g2 = 0; g2 < 4; g2++) ctx.fillRect(x + 5, y + 5 + g2 * 4, 14, 2); }
        else if (!P.pixel && hsh > 0.86) { ctx.fillStyle = P.rivet; ctx.fillRect(x + 3, y + 3, 2, 2); ctx.fillRect(x + T - 5, y + T - 5, 2, 2); }
      } else if (v === 1) {
        var below = ty + 1 < S.D.h && tl[tx + (ty + 1) * W] !== 1;
        ctx.fillStyle = P.wall; ctx.fillRect(x, y, T, T);
        if (below) { ctx.fillStyle = P.wallFace; ctx.fillRect(x, y + T - 8, T, 8); ctx.fillStyle = P.wallEdge; ctx.fillRect(x, y + T - 8, T, 2); if (hsh < 0.25) { ctx.fillStyle = P.pipe; ctx.fillRect(x, y + T - 5, T, 2); } }
        else if (hsh < 0.12) { ctx.fillStyle = P.wallTop; ctx.fillRect(x + 6, y + 6, 12, 12); ctx.fillStyle = P.wall; ctx.fillRect(x + 8, y + 8, 8, 8); }
      } else if (v === 2) {   // перегородка: ржавая решётка с заклёпками — её прорежет плазменный резак
        ctx.fillStyle = P.floor; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = P.part; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = P.partDark; for (var k = 0; k < 3; k++) ctx.fillRect(x + 4, y + 5 + k * 6, T - 8, 2);
        ctx.fillStyle = P.partEdge; ctx.fillRect(x + 2, y + 2, T - 4, 2); ctx.fillRect(x + 3, y + 3, 2, 2); ctx.fillRect(x + T - 5, y + 3, 2, 2);
      }
    }
  }
  function doors(ctx, S, P, time) {
    var T = G.logic.T;
    S.doors.forEach(function (d) {
      var t0 = d.tiles[0], t1 = d.tiles[1], x = Math.min(t0[0], t1[0]) * T, y = Math.min(t0[1], t1[1]) * T;
      var w = d.horiz ? 2 * T : T, h = d.horiz ? T : 2 * T, open = d.open ? Math.min(1, d.t * 3) : 0;
      ctx.fillStyle = P.doorFrame;
      if (d.horiz) { ctx.fillRect(x - 3, y + 6, 3, T - 12); ctx.fillRect(x + w, y + 6, 3, T - 12); }
      else { ctx.fillRect(x + 6, y - 3, T - 12, 3); ctx.fillRect(x + 6, y + h, T - 12, 3); }
      if (open >= 1) return;
      var col = d.path ? P.doorPath : P.doorSide;
      // две створки разъезжаются
      var k = 1 - open;
      if (d.horiz) {
        var sw = w / 2 * k; ctx.fillStyle = P.door; ctx.fillRect(x, y + 4, sw, T - 8); ctx.fillRect(x + w - sw, y + 4, sw, T - 8);
        ctx.fillStyle = col; for (var i = 0; i < 4; i++) { ctx.fillRect(x + i * 12 + 2, y + 8, 6, 3); ctx.fillRect(x + i * 12 + 2, y + T - 11, 6, 3); }
      } else {
        var sh = h / 2 * k; ctx.fillStyle = P.door; ctx.fillRect(x + 4, y, T - 8, sh); ctx.fillRect(x + 4, y + h - sh, T - 8, sh);
        ctx.fillStyle = col; for (var j = 0; j < 4; j++) { ctx.fillRect(x + 8, y + j * 12 + 2, 3, 6); ctx.fillRect(x + T - 11, y + j * 12 + 2, 3, 6); }
      }
      if (!d.open) {   // считыватель карты
        var blink = Math.sin(time * 4 + d.id) > 0;
        ctx.fillStyle = P.doorDark; ctx.fillRect(d.x - 6, d.y - 6, 12, 12);
        ctx.fillStyle = S.cards > 0 ? (blink ? P.good : P.goodDim) : (blink ? P.bad : P.badDim); ctx.fillRect(d.x - 3, d.y - 3, 6, 6);
        if (!d.path) { ctx.fillStyle = P.doorSide; ctx.fillRect(d.x - 2, d.y - 12, 4, 3); }
      }
    });
  }
  function props(ctx, S, P, time) {
    var L = G.logic, T = L.T, A = S.D.airlock;
    // шлюз: штриховка, огни
    ctx.fillStyle = P.airFloor; ctx.fillRect(A.x0, A.y0, A.x1 - A.x0, A.y1 - A.y0);
    ctx.save(); ctx.beginPath(); ctx.rect(A.x0, A.y0, A.x1 - A.x0, A.y1 - A.y0); ctx.clip();
    ctx.fillStyle = S.airOpen ? P.airStripeOn : P.airStripe;
    for (var i = -6; i < 10; i++) { ctx.beginPath(); ctx.moveTo(A.x0 + i * 16, A.y1); ctx.lineTo(A.x0 + i * 16 + 8, A.y1); ctx.lineTo(A.x0 + i * 16 + 8 + (A.y1 - A.y0), A.y0); ctx.lineTo(A.x0 + i * 16 + (A.y1 - A.y0), A.y0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = P.airFrame; ctx.fillRect(A.x0, A.y0, A.x1 - A.x0, 3); ctx.fillRect(A.x0, A.y1 - 3, A.x1 - A.x0, 3); ctx.fillRect(A.x1 - 3, A.y0, 3, A.y1 - A.y0);
    var on = S.airOpen && Math.sin(time * 8) > 0;
    [A.y0 + 10, A.y1 - 10].forEach(function (yy) { circ(ctx, A.x1 - 8, yy, 3, S.airOpen ? (on ? P.good : P.goodDim) : P.badDim); });
    // терминалы
    S.terminals.forEach(function (t) {
      ctx.fillStyle = P.termBody; ctx.fillRect(t.x - 10, t.y - 12, 20, 16);
      ctx.fillStyle = P.termScreen; ctx.fillRect(t.x - 7, t.y - 9, 14, 8);
      ctx.fillStyle = P.termText; var ph = Math.floor(time * 3 + t.id) % 3; ctx.fillRect(t.x - 5, t.y - 7, 4 + ph * 2, 1); ctx.fillRect(t.x - 5, t.y - 4, 8 - ph, 1);
      ctx.fillStyle = P.termBase; ctx.fillRect(t.x - 8, t.y + 4, 16, 4);
    });
    // пульт сброса реактора
    var o = S.D.objective;
    if (o.kind === 'console') {
      ctx.fillStyle = P.consoleBody; ctx.fillRect(o.x - 18, o.y - 14, 36, 28);
      ctx.fillStyle = P.consoleEdge; ctx.fillRect(o.x - 18, o.y - 14, 36, 3);
      var pul = S.consoleOn ? P.good : (Math.sin(time * 5) > 0 ? P.consoleLamp : P.consoleLampDim);
      circ(ctx, o.x, o.y + 2, 7, pul); ctx.fillStyle = P.consoleEdge; ctx.fillRect(o.x - 14, o.y + 8, 6, 3); ctx.fillRect(o.x + 8, o.y + 8, 6, 3);
    }
    // ключ-карты и припасы
    S.cardsOnFloor.forEach(function (c) {
      if (c.taken) return; var bob = Math.sin(time * 4 + c.x) * 2;
      ctx.fillStyle = P.card; ctx.fillRect(c.x - 7, c.y - 5 + bob, 14, 10); ctx.fillStyle = P.cardStripe; ctx.fillRect(c.x - 7, c.y - 2 + bob, 14, 3);
      ctx.fillStyle = P.cardChip; ctx.fillRect(c.x - 5, c.y + 2 + bob, 4, 2);
    });
    S.items.forEach(function (it) {
      if (it.taken) return; var x = it.x, y = it.y;
      if (it.kind === 'ammo') { ctx.fillStyle = P.ammoBox; ctx.fillRect(x - 6, y - 5, 12, 10); ctx.fillStyle = P.ammoTip; ctx.fillRect(x - 4, y - 3, 2, 6); ctx.fillRect(x - 1, y - 3, 2, 6); ctx.fillRect(x + 2, y - 3, 2, 6); }
      else if (it.kind === 'med') { ctx.fillStyle = P.medBox; ctx.fillRect(x - 7, y - 6, 14, 12); ctx.fillStyle = P.medCross; ctx.fillRect(x - 1.5, y - 4, 3, 8); ctx.fillRect(x - 4, y - 1.5, 8, 3); }
      else if (it.kind === 'tok') { circ(ctx, x, y, 5, P.token); ctx.fillStyle = P.tokenDark; ctx.fillRect(x - 1, y - 3, 2, 6); }
      else if (it.kind === 'cache') { ctx.fillStyle = P.cache; ctx.fillRect(x - 9, y - 7, 18, 14); ctx.fillStyle = P.cacheBand; ctx.fillRect(x - 9, y - 1, 18, 3); ctx.fillRect(x - 1, y - 7, 3, 14); }
    });
  }
  function enemies(ctx, S, P, time) {
    S.enemies.forEach(function (e) {
      var x = e.x, y = e.y, fl = e.flash > 0;
      if (e.type === 'tick') {
        var a = Math.atan2(e.vy || 0.01, e.vx || 1), leg = Math.sin(time * 22 + e.id) * 3;
        ctx.strokeStyle = fl ? '#fff' : P.tickLeg; ctx.lineWidth = P.pixel ? 2 : 1.4; ctx.beginPath();
        for (var k = -1; k <= 1; k++) { var px = -Math.sin(a), py = Math.cos(a), bx = x + Math.cos(a) * k * 3, by = y + Math.sin(a) * k * 3, w = (k === 0 ? leg : -leg);
          ctx.moveTo(bx, by); ctx.lineTo(bx + px * 8 + Math.cos(a) * w, by + py * 8 + Math.sin(a) * w); ctx.moveTo(bx, by); ctx.lineTo(bx - px * 8 - Math.cos(a) * w, by - py * 8 - Math.sin(a) * w); }
        ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = fl ? '#fff' : P.tick; ctx.fillRect(-6, -4, 11, 8); ctx.fillStyle = P.tickDark; ctx.fillRect(-6, -1, 11, 2); ctx.restore();
      } else if (e.type === 'carpet') {
        for (var i = 0; i < 16; i++) {
          var aa = i * 2.4 + e.id, rr = (i % 4) * 4 + 2 + Math.sin(time * 3 + i) * 1.5, sx = x + Math.cos(aa) * rr, sy = y + Math.sin(aa) * rr * 0.8;
          ctx.fillStyle = fl ? '#fff' : (i % 3 ? P.carpet : P.carpetDark); ctx.fillRect(sx - 3, sy - 2, 6, 4);
        }
      } else if (e.type === 'spike') {
        ctx.strokeStyle = fl ? '#fff' : P.wire; ctx.lineWidth = P.pixel ? 2 : 1.6; ctx.beginPath();
        for (var j = 0; j < 7; j++) { var a2 = j / 7 * Math.PI * 2 + Math.sin(time * 2 + j) * 0.15, r1 = 12 + (j % 2) * 4; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a2 + 0.3) * r1 * 0.5, y + Math.sin(a2 + 0.3) * r1 * 0.5); ctx.lineTo(x + Math.cos(a2) * r1, y + Math.sin(a2) * r1); }
        ctx.stroke(); circ(ctx, x, y, 5, fl ? '#fff' : P.wireCore);
      } else if (e.type === 'nest') {
        circ(ctx, x, y, e.r, fl ? '#fff' : P.nest); circ(ctx, x - 4, y - 3, e.r * 0.6, P.nestLight);
        for (var q = 0; q < 4; q++) { var a3 = q * 1.7 + 0.5; circ(ctx, x + Math.cos(a3) * 9, y + Math.sin(a3) * 8, 3, P.nestHole); }
      } else if (e.type === 'node' || e.type === 'vein') {
        circ(ctx, x, y, e.r, fl ? '#fff' : (e.type === 'node' ? P.coil : P.vein));
        ctx.strokeStyle = e.type === 'node' ? P.coilRing : P.veinDark; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, e.r - 3, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }
  function boss(ctx, S, P, time) {
    var B = S.boss; if (!B || B.dead) return;
    var fl = B.flash > 0, alive = B.nodes.some(function (e) { return !e.dead; });
    // проводящие жилы к узлам
    ctx.strokeStyle = P.bossCable; ctx.lineWidth = P.pixel ? 3 : 2.5; ctx.beginPath();
    B.nodes.forEach(function (e) { if (!e.dead) { ctx.moveTo(B.x, B.y); ctx.lineTo(e.x, e.y); } }); ctx.stroke();
    if (B.key === 'matka') {
      ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.rot);
      ctx.fillStyle = fl ? '#fff' : P.boss; ctx.beginPath(); for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; ctx.lineTo(Math.cos(a) * B.r, Math.sin(a) * B.r); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.bossDark; for (i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(B.r - 10, -4, 12, 8); }
      ctx.restore();
      circ(ctx, B.x, B.y, 14, alive ? P.bossShell : (Math.sin(time * 10) > 0 ? P.core : P.coreHot));
    } else {
      var pulse = 1 + Math.sin(time * 5) * 0.05;
      circ(ctx, B.x, B.y, B.r * pulse, fl ? '#fff' : P.heart);
      ctx.strokeStyle = P.heartCrack; ctx.lineWidth = 2; ctx.beginPath();
      for (var j = 0; j < 6; j++) { var a2 = j + B.t * 0.2; ctx.moveTo(B.x + Math.cos(a2) * 6, B.y + Math.sin(a2) * 6); ctx.lineTo(B.x + Math.cos(a2 + 0.3) * B.r * 0.9, B.y + Math.sin(a2 + 0.3) * B.r * 0.9); }
      ctx.stroke();
      circ(ctx, B.x, B.y, B.open || !alive ? 13 : 6, B.open || !alive ? P.core : P.bossShell);
    }
  }
  function heroes(ctx, S, P, time) {
    S.heroes.forEach(function (h) {
      if (h.out || !h.alive) return;
      if (h.inv > 0.35 && Math.floor(time * 12) % 2) return;
      var a = Math.atan2(h.face[1], h.face[0]), body = P.hero[h.id], dark = P.heroDark[h.id];
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(a);
      if (!P.pixel) { ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(1, 3, 10, 9, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = P.tank; ctx.fillRect(-12, -6, 6, 12);                     // баллон за спиной
      ctx.fillStyle = dark; ctx.fillRect(-7, -9, 13, 18);                       // комбинезон
      ctx.fillStyle = body; ctx.fillRect(-6, -8, 11, 16);
      ctx.fillStyle = P.belt; ctx.fillRect(-2, -8, 3, 16);
      var gl = h.weapon === 'fan' ? 9 : h.weapon === 'cutter' ? 13 : h.weapon === 'flame' ? 11 : h.weapon === 'nail' ? 12 : 8;
      ctx.fillStyle = P.gun; ctx.fillRect(2, 3, gl, 4);                          // инструмент-оружие в правой руке
      if (h.weapon === 'fan') { ctx.fillRect(9, 1, 3, 8); }
      if (h.swing > 0) { ctx.fillStyle = P.gun; ctx.fillRect(6, -10, 4, 14); }
      circ(ctx, 0, 0, 6, P.helmet[h.id]);                                       // каска
      ctx.fillStyle = P.lampLens; ctx.fillRect(4, -2, 3, 4);                    // налобный фонарь
      ctx.restore();
      if (h.hurtT > 0) { ctx.strokeStyle = P.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, 13, 0, Math.PI * 2); ctx.stroke(); }
    });
  }
  function shots(ctx, S, P, time) {
    S.bullets.forEach(function (b) {
      if (b.k === 'f') { var fr = 1 - b.life / 0.3; circ(ctx, b.x, b.y, 4 + fr * 6, P.flame[Math.min(2, Math.floor(fr * 3))]); }
      else if (b.k === 'c') { ctx.strokeStyle = P.cutter; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.stroke(); circ(ctx, b.x, b.y, 3, P.cutterCore); }
      else { ctx.strokeStyle = b.k === 'n' ? P.nail : P.bullet; ctx.lineWidth = b.k === 'p' ? 2.5 : 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); ctx.stroke(); }
    });
    S.sparks.forEach(function (s) { circ(ctx, s.x, s.y, 5, P.sparkGlow); circ(ctx, s.x, s.y, 2.5, P.spark); });
  }
  // угольки роя поверх темноты: видно, что в черноте кто-то есть
  function embers(ctx, S, P, time) {
    S.enemies.forEach(function (e) {
      var k = e.awake ? 1 : 0.45, fl = 0.6 + 0.4 * Math.sin(time * 6 + e.id);
      ctx.globalAlpha = k * fl;
      if (e.type === 'tick') { var a = Math.atan2(e.vy || 0.01, e.vx || 1); ctx.fillStyle = P.ember; ctx.fillRect(e.x + Math.cos(a) * 4 - 1, e.y + Math.sin(a) * 4 - 1, 2.5, 2.5); }
      else if (e.type === 'carpet') { for (var i = 0; i < 4; i++) { ctx.fillStyle = P.ember; ctx.fillRect(e.x + Math.cos(i * 2 + e.id) * 8, e.y + Math.sin(i * 2 + e.id) * 6, 2, 2); } }
      else if (e.type === 'spike') { circ(ctx, e.x, e.y, e.warn > 0 ? 6 : 2.5, e.warn > 0 ? P.sparkGlow : P.ember); }
      else if (e.type === 'nest') { for (var q = 0; q < 4; q++) { var a3 = q * 1.7 + 0.5; ctx.fillStyle = P.ember; ctx.fillRect(e.x + Math.cos(a3) * 9 - 1, e.y + Math.sin(a3) * 8 - 1, 2.5, 2.5); } }
      else if (e.warn > 0) circ(ctx, e.x, e.y, 5, P.sparkGlow);
      ctx.globalAlpha = 1;
    });
    S.sparks.forEach(function (s) { circ(ctx, s.x, s.y, 2.5, P.spark); });
  }

  // ---------- Кадр мира ----------
  // ctx — уже со сдвигом/масштабом под область вида; dark — холст темноты размером области вида (в пикселях холста),
  // sc — масштаб (retro рисует в буфер 1/2).
  function world(ctx, S, P, time, cam, vw, vh, dark, sc) {
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    ctx.fillStyle = P.space; ctx.fillRect(cam.x, cam.y, vw, vh);
    tilesLayer(ctx, S, P, cam, vw, vh, time);
    props(ctx, S, P, time); doors(ctx, S, P, time);
    enemies(ctx, S, P, time); boss(ctx, S, P, time); heroes(ctx, S, P, time); shots(ctx, S, P, time);
    ctx.restore();
    // темнота
    if (dark) {
      var d = dark.getContext('2d'); d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, dark.width, dark.height);
      d.fillStyle = S.alarm ? P.darkAlarm : P.dark; d.fillRect(0, 0, dark.width, dark.height);
      d.setTransform(sc, 0, 0, sc, -cam.x * sc, -cam.y * sc);
      d.globalCompositeOperation = 'destination-out';
      lights(S, P, time).forEach(function (l) {
        var gr = d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r), k = l.k;
        if (P.pixel) { gr.addColorStop(0, 'rgba(0,0,0,' + k + ')'); gr.addColorStop(0.55, 'rgba(0,0,0,' + k + ')'); gr.addColorStop(0.551, 'rgba(0,0,0,' + (k * 0.7) + ')'); gr.addColorStop(0.8, 'rgba(0,0,0,' + (k * 0.7) + ')'); gr.addColorStop(0.801, 'rgba(0,0,0,' + (k * 0.35) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
        else { gr.addColorStop(0, 'rgba(0,0,0,' + k + ')'); gr.addColorStop(0.6, 'rgba(0,0,0,' + (k * 0.75) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
        d.fillStyle = gr; d.beginPath();
        if (l.poly) { l.poly.forEach(function (p, i) { if (i) d.lineTo(p[0], p[1]); else d.moveTo(p[0], p[1]); }); d.closePath(); }
        else d.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        d.fill();
      });
      d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over';
      ctx.drawImage(dark, 0, 0, vw, vh);
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      // тёплый отсвет фонаря
      if (!P.pixel) {
        ctx.globalCompositeOperation = 'lighter';
        S.heroes.forEach(function (h) { if (h.out || !h.alive) return; var gx = h.x + h.face[0] * 60, gy = h.y + h.face[1] * 60, gr2 = ctx.createRadialGradient(gx, gy, 0, gx, gy, 150); gr2.addColorStop(0, P.beam); gr2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr2; ctx.fillRect(gx - 150, gy - 150, 300, 300); });
        ctx.globalCompositeOperation = 'source-over';
      }
      embers(ctx, S, P, time);
      // светящиеся метки: свои лампы касок
      S.heroes.forEach(function (h) { if (!h.out && h.alive) circ(ctx, h.x + h.face[0] * 5, h.y + h.face[1] * 5, 2, P.lampLens); });
      ctx.restore();
    }
  }

  // ---------- Карта палубы (вкладка терминала) ----------
  function map(ctx, S, P, x, y, w, h, time) {
    var D = S.D, T = G.logic.T, k = Math.min(w / D.w, h / D.h), ox = x + (w - D.w * k) / 2, oy = y + (h - D.h * k) / 2, all = S.mapOwned;
    for (var ty = 0; ty < D.h; ty++) for (var tx = 0; tx < D.w; tx++) {
      var i = tx + ty * D.w, v = S.tiles[i]; if (v === 1 || (!all && !S.seen[i])) continue;
      ctx.fillStyle = v === 3 ? P.doorPath : v === 2 ? P.part : (S.seen[i] ? P.mapFloor : P.mapFloorDim); ctx.fillRect(ox + tx * k, oy + ty * k, Math.ceil(k), Math.ceil(k));
    }
    function dot(px, py, col, r) { ctx.fillStyle = col; ctx.fillRect(ox + px / T * k - r, oy + py / T * k - r, r * 2, r * 2); }
    var A = D.airlock; ctx.fillStyle = P.good; ctx.fillRect(ox + A.tx0 * k, oy + A.ty0 * k, (A.tx1 - A.tx0 + 1) * k, (A.ty1 - A.ty0 + 1) * k);
    S.terminals.forEach(function (t) { if (all || S.seen[Math.floor(t.x / T) + Math.floor(t.y / T) * D.w]) dot(t.x, t.y, P.termScreen, 3); });
    S.doors.forEach(function (d) { if (!d.open && (all || S.seen[d.tiles[0][0] + d.tiles[0][1] * D.w])) dot(d.x, d.y, d.path ? P.doorPath : P.doorSide, 3); });
    if (all) {
      S.cardsOnFloor.forEach(function (c) { if (!c.taken) dot(c.x, c.y, P.card, 3); });
      dot(D.objective.x, D.objective.y, P.consoleLamp, 4);
    }
    S.heroes.forEach(function (hh) { if (!hh.out && Math.sin(time * 8) > -0.3) dot(hh.x, hh.y, P.hero[hh.id], 3); });
  }

  G.render = { world: world, map: map, rrect: rrect, circ: circ, lightPoly: lightPoly, ray: ray };
})(typeof window !== 'undefined' ? window : globalThis);
