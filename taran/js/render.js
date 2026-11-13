/* ТАРАН · общий рендер мира (обе темы — разные палитры, retro ещё и крупный пиксель в ui.js):
   двор-подложка по виду трассы (цех — плитка, крыши — профнастил, рельсы — щебень и пути, склад — доски), реквизит,
   дорога с бордюрами, старт, острова развилок, ремонтные боксы, трамплины со шлаковой канавой, лужи, рельсы с вагонетками,
   прессы, сброшенные масло и гайки, заклёпки, ракеты, взрывы, паровые самоходы с дымом из трубы. TARAN.render */
(function (global) {
  'use strict';
  var T = global.TARAN = global.TARAN || {};
  function L() { return T.logic; }

  // ---------- Кэш трассы: контуры (Path2D) и реквизит ----------
  var cache = {};
  function hash(a, b) { var h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h = (h ^ (h >>> 13)) >>> 0; return (h % 10000) / 10000; }
  function geo(tr) {
    if (cache[tr.id]) return cache[tr.id];
    var smp = tr.smp, n = tr.n, road = new Path2D(), eL = new Path2D(), eR = new Path2D(), i;
    for (i = 0; i <= n; i++) { var p = smp[i % n]; var x = p.x + p.nx * p.hw, y = p.y + p.ny * p.hw; if (i) { road.lineTo(x, y); eL.lineTo(x, y); } else { road.moveTo(x, y); eL.moveTo(x, y); } }
    road.closePath();
    for (i = 0; i <= n; i++) { var q = smp[i % n]; var x2 = q.x - q.nx * q.hw, y2 = q.y - q.ny * q.hw; if (i) { road.lineTo(x2, y2); eR.lineTo(x2, y2); } else { road.moveTo(x2, y2); eR.moveTo(x2, y2); } }
    road.closePath();
    var isl = tr.forks.map(function (fk) {
      var pth = new Path2D(), pts = [], k;
      for (k = fk.a; k <= fk.b; k++) { var s = smp[k % n]; pts.push([s.x + s.nx * s.isl, s.y + s.ny * s.isl]); }
      for (k = fk.b; k >= fk.a; k--) { var s2 = smp[k % n]; pts.push([s2.x - s2.nx * s2.isl, s2.y - s2.ny * s2.isl]); }
      pts.forEach(function (pp, j) { if (j) pth.lineTo(pp[0], pp[1]); else pth.moveTo(pp[0], pp[1]); }); pth.closePath();
      return { path: pth, mid: smp[Math.round((fk.a + fk.b) / 2) % n], fk: fk };
    });
    var pits = tr.pits.map(function (pt) {
      var pth = new Path2D(), k, s;
      for (k = pt.a; k <= pt.b; k++) { s = smp[k % n]; var o = pt.side * s.hw * 0.36; if (k === pt.a) pth.moveTo(s.x + s.nx * o, s.y + s.ny * o); else pth.lineTo(s.x + s.nx * o, s.y + s.ny * o); }
      for (k = pt.b; k >= pt.a; k--) { s = smp[k % n]; var o2 = pt.side * (s.hw - 3); pth.lineTo(s.x + s.nx * o2, s.y + s.ny * o2); }
      pth.closePath(); return { path: pth, pt: pt };
    });
    // реквизит двора: сетка с джиттером, только вдали от дороги
    var props = [], step = 130;
    for (var gy = 0; gy < tr.h; gy += step) for (var gx = 0; gx < tr.w; gx += step) {
      var r1 = hash(gx, gy), r2 = hash(gy + 7, gx + 3), px = gx + r1 * step, py = gy + r2 * step, size = 30 + hash(gx + 1, gy + 2) * 34;
      if (hash(gx + 5, gy + 9) < 0.15) continue;
      var md = 1e9; for (i = 0; i < n; i += 3) { var sp = smp[i], dd = Math.hypot(sp.x - px, sp.y - py) - sp.hw; if (dd < md) md = dd; }
      if (md < size + 34) continue;
      props.push({ x: px, y: py, s: size, k: Math.floor(hash(gx + 11, gy + 13) * 3), a: hash(gx + 17, gy + 19) < 0.5 ? 0 : Math.PI / 2 });
    }
    cache[tr.id] = { road: road, eL: eL, eR: eR, isl: isl, pits: pits, props: props };
    return cache[tr.id];
  }

  // ---------- Подложка двора ----------
  function ground(ctx, tr, P, vx, vy, vw, vh, time) {
    var C = P.set[tr.set], t = C.tile, x0 = Math.floor(vx / t) * t, y0 = Math.floor(vy / t) * t, x, y;
    ctx.fillStyle = C.ground; ctx.fillRect(vx, vy, vw, vh);
    ctx.fillStyle = C.ground2;
    if (tr.set === 'shop') {
      for (y = y0; y < vy + vh; y += t) for (x = x0; x < vx + vw; x += t) if (((x / t) + (y / t)) % 2 === 0) ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
      // жёлтая разметка проходов и масляные пятна на бетоне
      ctx.fillStyle = C.curbA; ctx.globalAlpha = P.pixel ? 0.5 : 0.28;
      for (y = Math.floor(vy / 448) * 448; y < vy + vh; y += 448) ctx.fillRect(vx, y, vw, 8);
      for (x = Math.floor(vx / 576) * 576; x < vx + vw; x += 576) ctx.fillRect(x, vy, 8, vh);
      ctx.globalAlpha = 1; ctx.fillStyle = C.edge;
      for (y = y0; y < vy + vh; y += t) for (x = x0; x < vx + vw; x += t) if (hash(x, y) < 0.08) { ctx.globalAlpha = 0.5; circ(ctx, x + hash(y, x) * t, y + hash(x + 3, y) * t, 6 + hash(x, y + 5) * 12); ctx.globalAlpha = 1; }
    } else if (tr.set === 'roof') {
      for (x = x0; x < vx + vw; x += t) if ((x / t) % 2 === 0) ctx.fillRect(x, vy, t / 2, vh);
      ctx.fillStyle = C.edge; for (y = Math.floor(vy / 384) * 384; y < vy + vh; y += 384) ctx.fillRect(vx, y, vw, 4);
    } else if (tr.set === 'rail') {
      for (y = y0; y < vy + vh; y += t) for (x = x0; x < vx + vw; x += t) {
        for (var k = 0; k < 4; k++) { var hx = hash(x + k, y), hy = hash(y + k, x); ctx.fillRect(x + hx * t, y + hy * t, 4, 3); }
      }
      // декоративные пути по двору (под дорогой)
      for (y = Math.floor(vy / 300) * 300 + 120; y < vy + vh; y += 300) {
        ctx.fillStyle = P.sleeper; for (x = Math.floor(vx / 20) * 20; x < vx + vw; x += 20) ctx.fillRect(x, y - 13, 7, 26);
        ctx.fillStyle = P.rail; ctx.fillRect(vx, y - 9, vw, 3); ctx.fillRect(vx, y + 6, vw, 3);
      }
    } else {
      for (y = y0; y < vy + vh; y += t) {
        if ((y / t) % 2 === 0) ctx.fillRect(vx, y, vw, t - 2);
        ctx.fillStyle = C.edge; var off = ((y / t) % 3) * 70;
        for (x = Math.floor((vx - off) / 210) * 210 + off; x < vx + vw; x += 210) ctx.fillRect(x, y, 2, t);
        ctx.fillStyle = C.ground2;
      }
    }
  }
  function prop(ctx, p, set, P, time) {
    var C = P.set[set], s = p.s, h = s / 2;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    if (!P.pixel) { ctx.fillStyle = P.shadow; ctx.fillRect(-h + 5, -h + 6, s, s); }
    if (set === 'shop') {
      if (p.k === 0) { ctx.fillStyle = C.prop; ctx.fillRect(-h, -h * 0.7, s, s * 0.7); ctx.fillStyle = C.propTop; ctx.fillRect(-h + 3, -h * 0.7 + 3, s - 6, s * 0.3); ctx.fillStyle = C.propAcc; ctx.fillRect(h - 8, -4, 5, 8); }
      else if (p.k === 1) { ctx.fillStyle = C.propAcc; circ(ctx, 0, 0, h * 0.6); ctx.fillStyle = C.prop; circ(ctx, 0, 0, h * 0.35); }
      else { ctx.fillStyle = C.prop; ctx.fillRect(-h, -5, s, 10); ctx.fillStyle = C.propTop; ctx.fillRect(-h, -5, s, 3); ctx.fillRect(-h - 3, -8, 6, 16); ctx.fillRect(h - 3, -8, 6, 16); }
    } else if (set === 'roof') {
      if (p.k === 0) { ctx.fillStyle = C.prop; ctx.fillRect(-h * 0.6, -h * 0.6, s * 0.6, s * 0.6); ctx.fillStyle = P.chimney; ctx.fillRect(-h * 0.35, -h * 0.35, s * 0.35, s * 0.35); puff(ctx, P, time, p.x); }
      else if (p.k === 1) { ctx.fillStyle = C.propTop; circ(ctx, 0, 0, h * 0.5); ctx.fillStyle = C.prop; circ(ctx, 0, 0, h * 0.3); }
      else { ctx.fillStyle = 'rgba(150,200,230,.5)'; if (P.pixel) ctx.fillStyle = '#5888a8'; ctx.fillRect(-h, -h * 0.5, s, s * 0.5); ctx.fillStyle = C.propAcc; ctx.fillRect(-h, -1, s, 2); }
    } else if (set === 'rail') {
      if (p.k === 0) { ctx.fillStyle = C.prop; ctx.fillRect(-h * 1.4, -h * 0.5, s * 1.4, s * 0.5); ctx.fillStyle = C.propTop; ctx.fillRect(-h * 1.4 + 3, -h * 0.5 + 3, s * 1.4 - 6, s * 0.5 - 6); ctx.fillStyle = P.ore; ctx.fillRect(-h * 1.1, -h * 0.3, s * 0.9, s * 0.25); }
      else if (p.k === 1) { ctx.fillStyle = P.ore; circ(ctx, 0, 0, h * 0.7); ctx.fillStyle = C.ground2; circ(ctx, -3, -3, h * 0.3); }
      else { ctx.fillStyle = C.propAcc; ctx.fillRect(-2, -h, 4, s); ctx.fillStyle = (Math.floor(time * 1.5 + p.x) % 2) ? '#e04030' : '#40c060'; circ(ctx, 0, -h, 4); }
    } else {
      if (p.k === 0) { ctx.fillStyle = C.prop; ctx.fillRect(-h, -h, s, s); ctx.strokeStyle = C.propTop; ctx.lineWidth = 3; ctx.strokeRect(-h + 2, -h + 2, s - 4, s - 4); ctx.beginPath(); ctx.moveTo(-h + 2, -h + 2); ctx.lineTo(h - 2, h - 2); ctx.stroke(); }
      else if (p.k === 1) { ctx.fillStyle = C.propTop; circ(ctx, 0, 0, h * 0.55); ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, h * 0.4, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.fillStyle = C.propAcc; ctx.fillRect(-h * 0.8, -h * 0.45, s * 0.8, s * 0.45); ctx.fillRect(-h * 0.1, -h * 0.2, s * 0.6, s * 0.5); }
    }
    ctx.restore();
  }
  function puff(ctx, P, time, seed) {
    for (var i = 0; i < 3; i++) { var t = (time * 0.6 + i / 3 + seed * 0.001) % 1; ctx.fillStyle = P.smoke + (0.35 * (1 - t)).toFixed(2) + ')'; circ(ctx, 6 + t * 26, -6 - t * 14, 5 + t * 9); }
  }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill(); }
  // четырёхугольник поперёк трассы на выборке i: продольно [l0..l1] px, поперёк [a..b] px
  function quad(ctx, tr, i, l0, l1, a, b) {
    var p = tr.smp[(i + tr.n) % tr.n];
    ctx.beginPath();
    ctx.moveTo(p.x + p.tx * l0 + p.nx * a, p.y + p.ty * l0 + p.ny * a); ctx.lineTo(p.x + p.tx * l1 + p.nx * a, p.y + p.ty * l1 + p.ny * a);
    ctx.lineTo(p.x + p.tx * l1 + p.nx * b, p.y + p.ty * l1 + p.ny * b); ctx.lineTo(p.x + p.tx * l0 + p.nx * b, p.y + p.ty * l0 + p.ny * b); ctx.closePath();
  }

  // ---------- Дорога и препятствия ----------
  function track(ctx, S, P, time) {
    var tr = S.track, G = geo(tr), C = P.set[tr.set], smp = tr.smp, n = tr.n, i;
    ctx.fillStyle = C.road; ctx.fill(G.road, 'evenodd');
    // продольная разметка-шов
    if (!P.pixel) { ctx.strokeStyle = C.road2; ctx.lineWidth = 3; ctx.setLineDash([26, 30]); ctx.beginPath(); for (i = 0; i <= n; i += 2) { var p = smp[i % n]; if (p.isl) { ctx.moveTo(p.x, p.y); continue; } if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]); }
    // бордюры: сплошная кромка + «зебра»
    ctx.lineWidth = P.pixel ? 8 : 7; ctx.strokeStyle = C.curbB; ctx.stroke(G.eL); ctx.stroke(G.eR);
    ctx.setLineDash([16, 16]); ctx.strokeStyle = C.curbA; ctx.stroke(G.eL); ctx.stroke(G.eR); ctx.setLineDash([]);
    ctx.lineWidth = 2; ctx.strokeStyle = C.edge; ctx.stroke(G.eL); ctx.stroke(G.eR);
    // старт/финиш — шахматка
    var s0 = smp[0], cw = 8;
    for (var r = 0; r < 2; r++) for (var c = -Math.ceil(s0.hw / cw); c < Math.ceil(s0.hw / cw); c++) {
      ctx.fillStyle = P.start[(r + c + 100) % 2]; quad(ctx, tr, 0, -8 + r * cw, r * cw, c * cw, Math.min(s0.hw, (c + 1) * cw)); ctx.fill();
    }
    // ремонтные боксы
    G.pits.forEach(function (pp) {
      ctx.fillStyle = P.pit; ctx.fill(pp.path);
      ctx.strokeStyle = P.pitEdge; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.stroke(pp.path); ctx.setLineDash([]);
      for (var k = pp.pt.a + 6; k < pp.pt.b; k += 12) {
        var s = smp[k % n], o = pp.pt.side * s.hw * 0.68, x = s.x + s.nx * o, y = s.y + s.ny * o;
        ctx.fillStyle = P.pitEdge; ctx.fillRect(x - 7, y - 2, 14, 4); ctx.fillRect(x - 2, y - 7, 4, 14);
      }
    });
    // лужи масла (статичные)
    tr.oils.forEach(function (ol) { var p = smp[ol.i], x = p.x + p.nx * ol.o * p.hw, y = p.y + p.ny * ol.o * p.hw; oilBlob(ctx, P, x, y, ol.r, p.ang, ol.i); });
    // трамплины и шлаковые канавы
    tr.jumps.forEach(function (jp) {
      var p = smp[jp.i], hw = p.hw, L0 = L(), T0 = L0.TRENCH;
      ctx.fillStyle = P.slagDark; quad(ctx, tr, jp.i, T0[0] - 4, T0[1] + 4, -hw - 2, hw + 2); ctx.fill();
      var fl = P.pixel ? (Math.floor(time * 6) % 2 ? P.slag : P.slagDark) : P.slag;
      ctx.fillStyle = fl; ctx.globalAlpha = P.pixel ? 1 : 0.75 + 0.25 * Math.sin(time * 7 + jp.i);
      for (var b = T0[0] + 6; b < T0[1] - 6; b += 18) { quad(ctx, tr, jp.i, b, b + 9, -hw + 4 + ((b * 7) % 11), hw - 6 - ((b * 5) % 9)); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = P.rampDark; quad(ctx, tr, jp.i, -4, L0.RAMP + 4, -hw, hw); ctx.fill();
      ctx.fillStyle = P.ramp; quad(ctx, tr, jp.i, 0, L0.RAMP, -hw + 3, hw - 3); ctx.fill();
      ctx.strokeStyle = P.chevron; ctx.lineWidth = 3;
      for (var c2 = -hw + 14; c2 < hw - 8; c2 += 22) { ctx.beginPath(); var a1 = local2(tr, jp.i, 4, c2), a2 = local2(tr, jp.i, 12, c2 + 8), a3 = local2(tr, jp.i, 4, c2 + 16); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(a3[0], a3[1]); ctx.stroke(); }
    });
    // рельсы поперёк трассы
    tr.rails.forEach(function (rl) {
      var p = smp[rl.i], span = p.hw + 70;
      ctx.fillStyle = P.sleeper; for (var o = -span; o < span; o += 12) { quad(ctx, tr, rl.i, -15, 15, o, o + 6); ctx.fill(); }
      ctx.fillStyle = P.rail; quad(ctx, tr, rl.i, -11, -8, -span, span); ctx.fill(); quad(ctx, tr, rl.i, 8, 11, -span, span); ctx.fill();
    });
    // острова развилок
    G.isl.forEach(function (is) {
      if (!P.pixel) { ctx.save(); ctx.translate(4, 5); ctx.fillStyle = P.shadow; ctx.fill(is.path); ctx.restore(); }
      ctx.fillStyle = C.isl; ctx.fill(is.path); ctx.strokeStyle = C.curbA; ctx.lineWidth = 3; ctx.stroke(is.path);
      for (var k = is.fk.a + 8; k < is.fk.b - 6; k += 9) {
        var s = smp[k % n]; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang);
        ctx.fillStyle = C.islTop; ctx.fillRect(-12, -s.isl + 9, 24, (s.isl - 9) * 2); ctx.fillStyle = C.edge; ctx.fillRect(-12, -1, 24, 2);
        ctx.restore();
      }
    });
  }
  function local2(tr, i, lon, lat) { var p = tr.smp[i % tr.n]; return [p.x + p.tx * lon + p.nx * lat, p.y + p.ty * lon + p.ny * lat]; }
  function oilBlob(ctx, P, x, y, r, a, seed) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = P.oil; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.6, r * 0.4, r * 0.5, r * 0.35, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.oilSheen; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.25, r * 0.45, r * 0.16, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function presses(ctx, S, P, time, top) {
    var tr = S.track;
    tr.presses.forEach(function (pr) {
      var p = tr.smp[pr.i], hw = p.hw, a = pr.o > 0 ? 0 : -hw, b = pr.o > 0 ? hw : 0, ph = S.track && pressPhaseR(pr, S.t);
      if (!top) {
        ctx.fillStyle = P.pressFrame; quad(ctx, tr, pr.i, -34, -28, a - 14, b + 14); ctx.fill(); quad(ctx, tr, pr.i, 28, 34, a - 14, b + 14); ctx.fill();
        if (ph.state === 'warn') { ctx.fillStyle = (Math.floor(time * 10) % 2) ? P.pressWarn : 'rgba(0,0,0,0)'; quad(ctx, tr, pr.i, -28, 28, a, b); ctx.fill(); }
        if (ph.state !== 'down') { ctx.strokeStyle = P.bad; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); quad(ctx, tr, pr.i, -28, 28, a + 2, b - 2); ctx.stroke(); ctx.setLineDash([]); }
        return;
      }
      // плита пресса: поднята — висит над дорогой (полупрозрачная тень), опускается — растёт, внизу — твёрдая
      var k = ph.state === 'down' ? 1 : ph.state === 'warn' ? (ph.x - 1.9) / 0.7 : 0;
      if (k <= 0) return;
      var lift = (1 - k) * 18;
      if (!P.pixel) { ctx.fillStyle = 'rgba(0,0,0,' + (0.2 + 0.3 * k).toFixed(2) + ')'; quad(ctx, tr, pr.i, -28, 28, a, b); ctx.fill(); }
      ctx.save(); ctx.translate(-lift * 0.3, -lift);
      ctx.globalAlpha = 0.45 + 0.55 * k; ctx.fillStyle = P.press; quad(ctx, tr, pr.i, -28, 28, a, b); ctx.fill();
      ctx.fillStyle = P.pressTop; quad(ctx, tr, pr.i, -22, 22, a + 6, b - 6); ctx.fill();
      ctx.strokeStyle = P.bad; ctx.lineWidth = 3; quad(ctx, tr, pr.i, -28, 28, a, b); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    });
  }
  function pressPhaseR(pr, t) { var Pp = 3.4, x = ((t + pr.ph) % Pp + Pp) % Pp; return { state: x < 1.9 ? 'up' : x < 2.6 ? 'warn' : 'down', x: x }; }
  function carts(ctx, S, P) {
    var tr = S.track;
    S.carts.forEach(function (ct) {
      if (!ct.active) return; var p = tr.smp[ct.i], x = p.x + p.nx * ct.lat, y = p.y + p.ny * ct.lat;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(p.ny, p.nx));
      if (!P.pixel) { ctx.fillStyle = P.shadow; ctx.fillRect(-15, -10, 34, 26); }
      ctx.fillStyle = P.wheel; ctx.fillRect(-13, -14, 7, 28); ctx.fillRect(7, -14, 7, 28);
      ctx.fillStyle = P.cart; ctx.fillRect(-17, -12, 34, 24); ctx.fillStyle = P.cartTop; ctx.fillRect(-14, -9, 28, 18);
      ctx.fillStyle = P.ore; circ(ctx, -5, -2, 6); circ(ctx, 5, 2, 6); circ(ctx, 2, -4, 5);
      ctx.fillStyle = P.bad; ctx.fillRect(15, -12, 3, 24);
      ctx.restore();
    });
  }

  // ---------- Машины ----------
  // Паровой самоход: колёса, рама цвета команды, котёл с латунным поясом, труба с дымом, стальной бампер-таран.
  function car(ctx, c, P, time, o) {
    o = o || {};
    var body = o.body != null ? o.body : (c.cfg ? c.cfg.body : 0), len = [30, 34, 36][body], wid = [17, 18, 21][body], hl = len / 2, hwid = wid / 2;
    var z = c.z || 0, wreck = c.wreckT > 0, blink = c.invT > 0 && Math.floor(time * 12) % 2 === 0;
    ctx.save(); ctx.translate(c.x, c.y);
    // тень (выше в прыжке — дальше)
    ctx.save(); ctx.translate(3 + z * 0.6, 4 + z * 0.9); ctx.rotate(c.a); ctx.fillStyle = P.shadow; ctx.fillRect(-hl, -hwid - 2, len, wid + 4); ctx.restore();
    ctx.translate(0, -z); ctx.rotate(c.a);
    var sc = 1 + z / 60; ctx.scale(sc, sc);
    if (blink) ctx.globalAlpha = 0.45;
    // колёса
    ctx.fillStyle = P.wheel;
    var wx = hl - 7; ctx.fillRect(wx - 4, -hwid - 3, 9, 4); ctx.fillRect(wx - 4, hwid - 1, 9, 4); ctx.fillRect(-wx - 5, -hwid - 3, 10, 5); ctx.fillRect(-wx - 5, hwid - 2, 10, 5);
    // рама
    ctx.fillStyle = wreck ? '#2a2420' : c.color;
    if (P.pixel) ctx.fillRect(-hl, -hwid, len, wid); else rr(ctx, -hl, -hwid, len, wid, 4);
    if (!P.pixel && !wreck) { ctx.fillStyle = P.carLight; ctx.fillRect(-hl + 3, -hwid + 2, len - 6, 3); ctx.fillStyle = P.carDark; ctx.fillRect(-hl + 3, hwid - 4, len - 6, 3); }
    // котёл (сзади): короткий цилиндр с латунным поясом — корпус цвета команды остаётся главным
    var bx = -hl + 3, bw = body === 0 ? 8 : 10;
    ctx.fillStyle = wreck ? '#1a1614' : P.boiler; ctx.fillRect(bx, -hwid + 3, bw, wid - 6);
    ctx.fillStyle = wreck ? '#3a2a20' : P.boilerBand; ctx.fillRect(bx + bw / 2 - 1.5, -hwid + 3, 3, wid - 6);
    // кабина / ковш: тёмное «стекло» и полоса
    var cx0 = bx + bw + 3;
    if (!wreck) {
      ctx.fillStyle = P.carDark;
      if (body === 0) ctx.fillRect(cx0, -hwid + 4, 6, wid - 8);
      else if (body === 1) { ctx.fillRect(cx0, -hwid + 3, 8, wid - 6); ctx.fillStyle = P.carLight; ctx.fillRect(cx0 + 1, -hwid + 4, 6, 2); }
      else { ctx.fillRect(cx0, -hwid + 3, 10, wid - 6); ctx.fillStyle = P.boilerBand; ctx.fillRect(cx0 + 12, -hwid + 2, 2, wid - 4); }
      ctx.fillStyle = P.carLight; ctx.fillRect(cx0 + 10, -1, hl - cx0 - 8, 2);
    }
    // труба
    ctx.fillStyle = P.chimney; circ(ctx, bx + bw - 1, 0, body === 2 ? 4 : 3.4);
    ctx.fillStyle = wreck ? '#000' : P.boilerBand; circ(ctx, bx + bw - 1, 0, 1.6);
    // бампер-таран
    ctx.fillStyle = P.bumper; var bp = body === 2 ? 4 : 3; ctx.fillRect(hl - 1, -hwid - 1, bp, wid + 2);
    if (body === 2) { ctx.fillRect(hl + 2, -3, 3, 6); }
    // нитро — пламя из котла
    if (c.nitroT > 0 && !wreck) { var fl = 6 + (Math.floor(time * 30) % 3) * 3; ctx.fillStyle = P.flame[1]; ctx.beginPath(); ctx.moveTo(-hl, -4); ctx.lineTo(-hl - fl, 0); ctx.lineTo(-hl, 4); ctx.fill(); ctx.fillStyle = P.flame[0]; ctx.fillRect(-hl - 3, -2, 3, 4); }
    if (!wreck && c.st && c.cd > c.st.rivetCd - 0.06 && c.cd > 0) { ctx.fillStyle = P.flame[0]; ctx.fillRect(hl + 2, -5, 6, 3); ctx.fillRect(hl + 2, 2, 6, 3); ctx.fillStyle = P.flame[1]; ctx.fillRect(hl + 7, -4, 4, 2); ctx.fillRect(hl + 7, 3, 4, 2); }
    if (wreck) { for (var f = 0; f < 3; f++) { ctx.fillStyle = P.flame[f]; var j = Math.sin(time * 20 + f) * 2; ctx.fillRect(-4 + f * 3 + j, -4 + f, 5, 5); } }
    ctx.restore();
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); }

  // дым и пар: частицы рендера (не логика)
  var puffs = [], lastT = 0;
  function smoke(S, P, time) {
    var dt = Math.min(0.05, Math.max(0, time - lastT)); lastT = time;
    S.cars.forEach(function (c) {
      if (c.out) return;
      c._pf = (c._pf || 0) + dt * (c.wreckT > 0 ? 18 : 6 + Math.abs(c.vf || 0) / 30);
      while (c._pf > 1) {
        c._pf -= 1; var body = c.cfg ? c.cfg.body : 0, back = [30, 34, 36][body] / 2 - 2 - [8, 10, 10][body];
        var x = c.x - Math.cos(c.a) * back, y = c.y - Math.sin(c.a) * back - (c.z || 0);
        puffs.push({ x: x, y: y, vx: -Math.cos(c.a) * 20 + (Math.random() - 0.5) * 14, vy: -Math.sin(c.a) * 20 - 10, t: 0, life: c.wreckT > 0 ? 1.1 : 0.7, dark: c.wreckT > 0 || c.hp < c.st.hp * 0.3, nit: c.nitroT > 0 });
      }
    });
    for (var i = puffs.length - 1; i >= 0; i--) { var p = puffs[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) puffs.splice(i, 1); }
    if (puffs.length > 400) puffs.splice(0, puffs.length - 400);
  }
  function drawPuffs(ctx, P) {
    puffs.forEach(function (p) {
      var k = p.t / p.life, r = 3 + k * 9;
      ctx.fillStyle = p.dark ? 'rgba(40,36,34,' + (0.6 * (1 - k)).toFixed(2) + ')' : (p.nit ? P.smoke : P.steam) + (0.5 * (1 - k)).toFixed(2) + ')';
      if (P.pixel) { var q = Math.round(r / 2) * 2; ctx.fillRect(Math.round(p.x - q / 2), Math.round(p.y - q / 2), q, q); } else circ(ctx, p.x, p.y, r);
    });
  }

  // ---------- Мир целиком: ctx уже сдвинут к левому верху окна обзора ----------
  function world(ctx, S, P, time, vw, vh) {
    var cx = Math.round(S.cam.x - vw / 2), cy = Math.round(S.cam.y - vh / 2), tr = S.track, G = geo(tr);
    ctx.save(); ctx.translate(-cx, -cy);
    ground(ctx, tr, P, cx, cy, vw, vh, time);
    G.props.forEach(function (p) { if (p.x > cx - 80 && p.x < cx + vw + 80 && p.y > cy - 80 && p.y < cy + vh + 80) prop(ctx, p, tr.set, P, time); });
    track(ctx, S, P, time);
    presses(ctx, S, P, time, false);
    S.drops.forEach(function (d) {
      if (d.k === 'oil') oilBlob(ctx, P, d.x, d.y, d.r * Math.min(1, 0.4 + d.t * 3), d.owner, d.owner);
      else { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.t * 0.5); ctx.fillStyle = P.mineDark; hex(ctx, 9); ctx.fillStyle = P.mine; hex(ctx, 7); ctx.fillStyle = P.mineDark; circ(ctx, 0, 0, 3); ctx.fillStyle = (Math.floor(time * 4) % 2 && d.t > 0.5) ? P.mineLed : P.mineDark; circ(ctx, 0, 0, 1.6); ctx.restore(); }
    });
    carts(ctx, S, P);
    smoke(S, P, time);
    var order = S.cars.filter(function (c) { return !c.out; }).sort(function (a, b) { return (a.z || 0) - (b.z || 0); });
    order.forEach(function (c) { car(ctx, c, P, time); });
    drawPuffs(ctx, P);
    presses(ctx, S, P, time, true);
    S.bullets.forEach(function (b) {
      var a = Math.atan2(b.vy, b.vx); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      if (!P.pixel) { ctx.fillStyle = 'rgba(255,200,90,.35)'; ctx.fillRect(-14, -3, 18, 6); }
      ctx.fillStyle = P.flame[1]; ctx.fillRect(-10, -1.5, 8, 3); ctx.fillStyle = P.rivet; ctx.fillRect(-3, -2.5, 8, 5);
      ctx.restore();
    });
    S.rockets.forEach(function (r) {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a);
      ctx.fillStyle = P.flame[Math.floor(time * 30) % 3]; ctx.fillRect(-12, -2, 5, 4);
      ctx.fillStyle = P.rocket; ctx.fillRect(-7, -2.5, 12, 5); ctx.fillStyle = P.rocketFin; ctx.fillRect(-7, -4, 3, 8); ctx.fillRect(4, -2, 3, 4);
      ctx.restore();
      puffs.push({ x: r.x, y: r.y, vx: 0, vy: -6, t: 0, life: 0.45, dark: false, nit: true });
    });
    S.booms.forEach(function (b) {
      var k = 1 - b.t / b.max, rad = b.r * (0.4 + 0.8 * k);
      ctx.globalAlpha = 1 - k; ctx.fillStyle = P.boom[Math.min(3, Math.floor(k * 4))]; circ(ctx, b.x, b.y, rad);
      ctx.fillStyle = P.boom[0]; circ(ctx, b.x, b.y, rad * 0.45 * (1 - k)); ctx.globalAlpha = 1;
    });
    // метки игроков
    S.cars.forEach(function (c) {
      if (c.human < 0 || c.out) return;
      var lbl = c.human ? 'P2' : 'P1';
      ctx.fillStyle = c.color; ctx.font = '800 ' + (P.pixel ? 22 : 11) + 'px ' + P.font; ctx.textAlign = 'center';
      ctx.fillText(T._lbl ? T._lbl(c.human) : lbl, c.x, c.y - 22 - (c.z || 0));
      if (c.offT > 0) { ctx.strokeStyle = P.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, 20 + Math.sin(time * 20) * 3, 0, Math.PI * 2); ctx.stroke(); }
    });
    ctx.restore();
  }
  function hex(ctx, r) { ctx.beginPath(); for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(r, 0); } ctx.closePath(); ctx.fill(); }

  // ---------- Мини-карта ----------
  function minimap(ctx, S, P, x, y, w, h) {
    var tr = S.track, k = Math.min((w - 10) / tr.w, (h - 10) / tr.h), ox = x + (w - tr.w * k) / 2, oy = y + (h - tr.h * k) / 2;
    ctx.fillStyle = P.mapBg; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = P.muted; ctx.lineWidth = P.pixel ? 3 : 2.5; ctx.beginPath();
    for (var i = 0; i <= tr.n; i += 4) { var p = tr.smp[i % tr.n]; if (i) ctx.lineTo(ox + p.x * k, oy + p.y * k); else ctx.moveTo(ox + p.x * k, oy + p.y * k); }
    ctx.closePath(); ctx.stroke();
    var s0 = tr.smp[0]; ctx.fillStyle = P.ink; ctx.fillRect(ox + s0.x * k - 2, oy + s0.y * k - 2, 4, 4);
    S.cars.forEach(function (c) { if (c.out) return; ctx.fillStyle = c.color; var r = c.human >= 0 ? 3.5 : 2.5; ctx.fillRect(ox + c.x * k - r, oy + c.y * k - r, r * 2, r * 2); });
  }

  T.render = { world: world, car: car, minimap: minimap, geo: geo, rr: rr, circ: circ, clearFx: function () { puffs = []; } };
})(typeof window !== 'undefined' ? window : globalThis);
