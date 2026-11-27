/* РЕДУТ · общий рендер мира: ночное поле, Горн-маяк, луч (развёртка-шлейф), опоры, Смотритель с фонарём, мгла пяти видов, вспышка.
   Один рендер на обе темы: палитра P = REDUT.modern | REDUT.classic. В retro (P.pixel) — без градиентов и мягких теней, мир рисуется
   в буфер половинного размера (ui.js). world(ctx, S, P, time) рисует в координатах поля (0..W, 0..AH); вызывающий уже сдвинул ctx на HUD. REDUT.render */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  var PI = Math.PI, TAU = PI * 2;

  function hash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.fill(); }
  function ring(ctx, x, y, r, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.stroke(); }
  function ell(ctx, x, y, rx, ry, c, a) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), a || 0, 0, TAU); ctx.fill(); }
  function line(ctx, x1, y1, x2, y2, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function glow(ctx, P, x, y, r, c0) {   // мягкое свечение (только modern)
    if (P.pixel) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }

  // ---------- Поле ----------
  function ground(ctx, S, P, time) {
    var L = R.logic, W = L.W, H = L.AH, cx = S.cx, cy = S.cy, i;
    ctx.fillStyle = P.bg0; ctx.fillRect(0, 0, W, H);
    if (!P.pixel) { var g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 360); g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg0); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    else { ctx.fillStyle = P.bg1; ctx.beginPath(); ctx.arc(cx, cy, 250, 0, TAU); ctx.fill(); }
    for (i = 0; i < 70; i++) {   // камни и пучки травы — неподвижный узор
      var x = hash(i * 3 + 1) * W, y = hash(i * 3 + 2) * H, k = hash(i * 3 + 3);
      if (Math.hypot(x - cx, y - cy) < 48) continue;
      if (k < 0.45) { ctx.fillStyle = P.stone; if (P.pixel) ctx.fillRect(Math.round(x), Math.round(y), 4, 2); else { ctx.beginPath(); ctx.ellipse(x, y, 3 + k * 6, 2 + k * 3, k * 3, 0, TAU); ctx.fill(); } }
      else { ctx.strokeStyle = P.tuft; ctx.lineWidth = P.pixel ? 2 : 1.2; ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.lineTo(x - 1, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x + 1, y - 5); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + 3, y - 2); ctx.stroke(); }
    }
    // граница света маяка — замедляет мглу
    ctx.save(); ctx.setLineDash(P.pixel ? [6, 6] : [4, 7]); ring(ctx, cx, cy, R.logic.K.HALO, P.pixel ? 2 : 1.2, P.haloEdge); ctx.restore();
  }

  // ---------- Луч и опоры ----------
  function beams(ctx, S, P, time) {
    var h = S.hero, a = [{ x: S.cx, y: S.cy }], i, j;
    for (i = 0; i < S.pylons.length; i++) a.push(S.pylons[i]);
    if (h && h.alive) a.push(h);
    var fl = 0.85 + 0.15 * Math.sin(time * 23);
    // шлейф (развёртка): прежние положения луча гаснут
    ctx.save(); ctx.lineCap = 'round';
    for (i = 0; i < S.trail.length; i++) {
      var tr = S.trail[i], age = (S.time - tr.t) / R.logic.K.TRAIL; if (age >= 1 || age < 0.02) continue;
      ctx.globalAlpha = (1 - age) * (P.pixel ? 1 : 0.55);
      if (P.pixel && age > 0.6) continue;
      for (j = 0; j < tr.segs.length; j++) { var s = tr.segs[j]; line(ctx, s[0], s[1], s[2], s[3], P.pixel ? 2 : 5 * (1 - age * 0.6), P.trail); }
    }
    ctx.globalAlpha = 1;
    for (i = 1; i < a.length; i++) {
      var p = a[i - 1], q = a[i], dead = (p.dim > 0) || (q.dim > 0);
      if (dead) { ctx.setLineDash([4, 6]); line(ctx, p.x, p.y, q.x, q.y, 1.5, P.pylonDim); ctx.setLineDash([]); continue; }
      if (P.pixel) { line(ctx, p.x, p.y, q.x, q.y, 6, P.beamGlow); line(ctx, p.x, p.y, q.x, q.y, 4, P.beam); line(ctx, p.x, p.y, q.x, q.y, 2, P.beamHot); }
      else {
        ctx.globalCompositeOperation = 'lighter';
        line(ctx, p.x, p.y, q.x, q.y, S.beamR * 2.2, P.beamGlow); line(ctx, p.x, p.y, q.x, q.y, 6 * fl, P.beam); line(ctx, p.x, p.y, q.x, q.y, 2.4, P.beamHot);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
  }
  function pylon(ctx, P, p, time) {
    var dim = p.dim > 0, c = dim ? P.pylonDim : P.pylon;
    if (!P.pixel && !dim) glow(ctx, P, p.x, p.y, 26, 'rgba(159,211,255,.35)');
    ell(ctx, p.x + 2, p.y + 6, 7, 3, P.shadow);
    ctx.fillStyle = P.pylonDark; ctx.beginPath(); ctx.moveTo(p.x - 6, p.y + 6); ctx.lineTo(p.x + 6, p.y + 6); ctx.lineTo(p.x + 3, p.y - 2); ctx.lineTo(p.x - 3, p.y - 2); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(p.x, p.y - 11); ctx.lineTo(p.x + 5, p.y - 3); ctx.lineTo(p.x, p.y + 1); ctx.lineTo(p.x - 5, p.y - 3); ctx.closePath(); ctx.fill();
    if (p.hp < p.max) { ctx.strokeStyle = p.flash > 0 ? P.bad : P.warn; ctx.lineWidth = P.pixel ? 2 : 2; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 11, -PI / 2, -PI / 2 + TAU * Math.max(0, p.hp) / p.max); ctx.stroke(); }
  }

  // ---------- Маяк ----------
  function core(ctx, S, P, time) {
    var x = S.cx, y = S.cy, r = S.coreR, hp = S.coreHp, mx = S.coreMax, flash = S.coreFlash > 0 && Math.floor(time * 16) % 2 === 0, i;
    if (!P.pixel) {
      glow(ctx, P, x, y, 110, P.halo);
      // медленный вращающийся световой клин
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.rotate(time * 0.6);
      var gr = ctx.createLinearGradient(0, 0, 120, 0); gr.addColorStop(0, 'rgba(255,230,150,.16)'); gr.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(120, -16); ctx.lineTo(120, 16); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ell(ctx, x + 3, y + 6, r, r * 0.8, P.shadow);
    circ(ctx, x, y, r, P.coreDark); ring(ctx, x, y, r - 2, P.pixel ? 4 : 3, P.core);
    circ(ctx, x, y, r - 8, flash ? P.bad : P.coreTop);
    var pulse = 0.8 + 0.2 * Math.sin(time * 4);
    circ(ctx, x, y, 7 * pulse, flash ? '#ffffff' : P.lamp);
    glow(ctx, P, x, y, 38, 'rgba(255,233,168,.55)');
    for (i = 0; i < mx; i++) {   // ячейки прочности — дуги вокруг башни
      var a0 = -PI / 2 + i * TAU / mx + 0.07, a1 = -PI / 2 + (i + 1) * TAU / mx - 0.07;
      ctx.strokeStyle = i < hp ? (hp <= 2 ? P.bad : P.lamp) : P.coreDark; ctx.lineWidth = P.pixel ? 4 : 3;
      ctx.beginPath(); ctx.arc(x, y, r + 5, a0, a1); ctx.stroke();
    }
  }

  // ---------- Смотритель ----------
  function hero(ctx, P, h, time) {
    if (!h.alive) return;
    if (h.inv > 0 && Math.floor(time * 14) % 2 === 0) return;
    var x = h.x, y = h.y, f = h.face, fx = Math.cos(f), fy = Math.sin(f), bob = h.moving ? Math.sin(time * 16) * 1 : 0;
    ell(ctx, x + 2, y + 8, 9, 4, P.shadow);
    circ(ctx, x, y + bob, 9, P.heroDark); circ(ctx, x, y + bob - 1, 7.5, P.hero);
    circ(ctx, x - fx * 2, y + bob - fy * 2 - 1, 5, P.heroHood);   // капюшон
    glow(ctx, P, x + fx * 10, y + fy * 10, 30, 'rgba(255,240,176,.55)');
    circ(ctx, x + fx * 10, y + fy * 10, 3.6, P.lantern);
    line(ctx, x + fx * 5, y + fy * 5, x + fx * 9, y + fy * 9, 1.5, P.heroDark);
  }

  // ---------- Мгла ----------
  function legs(ctx, P, e, n, len, time, c) {
    for (var i = 0; i < n; i++) {
      var a = i * TAU / n + 0.4, w = Math.sin(time * 9 + i * 2 + e.id) * 0.35;
      line(ctx, e.x + Math.cos(a) * e.r * 0.6, e.y + Math.sin(a) * e.r * 0.5, e.x + Math.cos(a + w) * (e.r + len), e.y + Math.sin(a + w) * (e.r * 0.8 + len), P.pixel ? 2 : 1.5, c);
    }
  }
  function eyes(ctx, P, e, c, sep, size, dy) {
    var dx = e.dx || 0, dy2 = e.dy || 1, px = -dy2, py = dx;
    for (var k = -1; k <= 1; k += 2) circ(ctx, e.x + dx * (e.r * 0.35 + (dy || 0)) + px * sep * k, e.y + dy2 * (e.r * 0.35 + (dy || 0)) + py * sep * k, size, c);
  }
  function enemy(ctx, P, e, time) {
    var hit = e.hit > 0, t = e.type, r = e.r;
    if (t === 'crawl') {
      ell(ctx, e.x + 2, e.y + 5, r, r * 0.5, P.shadow);
      legs(ctx, P, e, 6, 4, time, P.mistEdge);
      ell(ctx, e.x, e.y, r, r * 0.85, hit ? '#ffffff' : P.mist); ring(ctx, e.x, e.y, r * 0.9, P.pixel ? 2 : 1.4, P.mistEdge);
      eyes(ctx, P, e, P.eye, r * 0.38, r * 0.2, 0);
    } else if (t === 'armor') {
      ell(ctx, e.x + 2, e.y + 6, r, r * 0.5, P.shadow);
      legs(ctx, P, e, 6, 4, time, P.mistEdge);
      ctx.fillStyle = hit ? '#ffffff' : P.armor; ctx.beginPath();
      for (var i = 0; i < 6; i++) { var a = i * TAU / 6 + 0.3; ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.9); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.shell; ctx.lineWidth = P.pixel ? 3 : 2.4; ctx.stroke();
      if (e.hp < e.max) line(ctx, e.x - r * 0.5, e.y - r * 0.2, e.x + r * 0.3, e.y + r * 0.4, 1.5, P.eye);
      eyes(ctx, P, e, P.eye, r * 0.3, r * 0.16, 0);
    } else if (t === 'leap') {
      var lift = e.air > 0 ? Math.sin(Math.min(1, (0.5 - e.air) / 0.5) * PI) * 16 : 0;
      ell(ctx, e.x + 2, e.y + 5, r * (1 - lift / 50), r * 0.45, P.shadow);
      var ey = e.y - lift, c = { x: e.x, y: ey, r: r, id: e.id, dx: e.dx, dy: e.dy };
      legs(ctx, P, c, 4, e.air > 0 ? 2 : 7, time, P.leapEye);
      ell(ctx, e.x, ey, r, r * 0.8, hit ? '#ffffff' : P.leap); ring(ctx, e.x, ey, r * 0.85, P.pixel ? 2 : 1.2, P.leapEye);
      eyes(ctx, P, c, P.leapEye, r * 0.35, r * 0.2, 0);
    } else if (t === 'snuff') {
      var pu = 1 + 0.12 * Math.sin(time * 6 + e.id);
      if (!P.pixel) { var g = ctx.createRadialGradient(e.x, e.y, r * 0.6, e.x, e.y, r * 3); g.addColorStop(0, 'rgba(160,92,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(e.x - r * 3, e.y - r * 3, r * 6, r * 6); }
      ring(ctx, e.x, e.y, r * 1.5 * pu, P.pixel ? 2 : 1.5, P.snuffRing);
      circ(ctx, e.x, e.y, r, hit ? '#ffffff' : P.snuff); ring(ctx, e.x, e.y, r, P.pixel ? 2 : 1.6, P.snuffRing);
      circ(ctx, e.x + (e.dx || 0) * 3, e.y + (e.dy || 1) * 3, r * 0.34, P.snuffRing);
    } else if (t === 'eater') {
      var rr = r * (1 + 0.04 * Math.sin(time * 3));
      if (!P.pixel) glow(ctx, P, e.x, e.y, r * 2.4, 'rgba(120,50,200,.35)');
      ell(ctx, e.x + 4, e.y + 10, rr, rr * 0.5, P.shadow);
      for (var k = 0; k < 9; k++) {   // щупальца
        var a2 = k * TAU / 9 + time * 0.4, w = Math.sin(time * 3 + k) * 0.3;
        ctx.strokeStyle = P.eaterEdge; ctx.lineWidth = P.pixel ? 4 : 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a2) * rr * 0.7, e.y + Math.sin(a2) * rr * 0.7);
        ctx.quadraticCurveTo(e.x + Math.cos(a2 + w) * rr * 1.25, e.y + Math.sin(a2 + w) * rr * 1.25, e.x + Math.cos(a2 + w * 2) * rr * 1.5, e.y + Math.sin(a2 + w * 2) * rr * 1.5); ctx.stroke();
      }
      circ(ctx, e.x, e.y, rr, hit ? '#ffffff' : P.eater); ring(ctx, e.x, e.y, rr - 1, P.pixel ? 3 : 2.5, P.eaterEdge);
      var dx = e.dx || 0, dy = e.dy || 1;
      ctx.fillStyle = P.maw; ctx.beginPath(); ctx.ellipse(e.x + dx * rr * 0.35, e.y + dy * rr * 0.35, rr * 0.5, rr * 0.2, Math.atan2(dy, dx) + PI / 2, 0, TAU); ctx.fill();
      for (var q = -1; q <= 1; q++) circ(ctx, e.x - dx * rr * 0.2 + (-dy) * q * rr * 0.4, e.y - dy * rr * 0.2 + dx * q * rr * 0.4, 3.2, P.eye);
    }
  }

  // ---------- Метки выхода и вспышка ----------
  function marks(ctx, S, P, time) {
    for (var i = 0; i < S.marks.length; i++) {
      var m = S.marks[i], a = Math.min(1, m.t * 3) * (0.5 + 0.5 * Math.sin(time * 24)), W = R.logic.W, H = R.logic.AH;
      var ang = Math.atan2(S.cy - m.y, S.cx - m.x);
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(ang); ctx.globalAlpha = 0.35 + 0.65 * a; ctx.fillStyle = P.mark;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-4, -9); ctx.lineTo(0, 0); ctx.lineTo(-4, 9); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  function flare(ctx, S, P, time) {
    if (S.flareT <= 0) return;
    var p = 1 - S.flareT / 0.45, c = S.hero && S.hero.alive ? S.hero : { x: S.cx, y: S.cy }, rr = S.flareR0 * (1 - Math.pow(1 - p, 3));
    if (!P.pixel) { var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rr); g.addColorStop(0, 'rgba(255,244,194,' + (0.5 * (1 - p)) + ')'); g.addColorStop(1, 'rgba(255,244,194,' + (0.12 * (1 - p)) + ')'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, TAU); ctx.fill(); }
    ring(ctx, c.x, c.y, rr, P.pixel ? 4 : 4 * (1 - p) + 1, P.flare); if (!P.pixel) ring(ctx, c.x, c.y, rr * 0.82, 2, P.flareEdge);
  }
  function readyRing(ctx, S, P, time) {   // пока заряд полон — кольцо у Смотрителя
    if (S.charge < R.logic.K.CHARGE_MAX || !S.hero || !S.hero.alive) return;
    ctx.save(); ctx.globalAlpha = 0.45 + 0.35 * Math.sin(time * 8); ring(ctx, S.hero.x, S.hero.y, 15, P.pixel ? 2 : 1.6, P.flare); ctx.restore();
  }

  function world(ctx, S, P, time) {
    ground(ctx, S, P, time);
    marks(ctx, S, P, time);
    beams(ctx, S, P, time);
    core(ctx, S, P, time);
    S.pylons.forEach(function (p) { pylon(ctx, P, p, time); });
    var list = S.enemies.slice().sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (e) { enemy(ctx, P, e, time); });
    if (S.hero) hero(ctx, P, S.hero, time);
    readyRing(ctx, S, P, time);
    flare(ctx, S, P, time);
  }

  R.render = { world: world, hero: hero, enemy: enemy, core: core, pylon: pylon, circ: circ, ring: ring, glow: glow, line: line, ell: ell, hash: hash };
})(typeof window !== 'undefined' ? window : globalThis);
