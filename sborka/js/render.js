/* СБОРКА · рендер мира (вид сверху): рельеф (кэш offscreen по теме/карте), заводы, роботы из модулей, выстрелы,
   взрывы, дирижабль «Наковальня», миникарта. Только рисование — логика в game.js. SBORKA.render */
(function (global) {
  'use strict';
  var SB = global.SBORKA = global.SBORKA || {};
  var TS = 16;
  function rrect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function hsh(x, y, k) { var n = (x * 374761393 + y * 668265263 + (k || 0) * 1442695041) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function teamCol(P, side) { return side < 0 ? P.neutral : P.team[side]; }
  function teamDark(P, side) { return side < 0 ? P.neutralDark : P.teamDark[side]; }

  // ---------- Рельеф ----------
  var cache = { key: '', cv: null };
  function terrain(S, P) {
    var M = S.map, key = P.name + ':' + M.w + 'x' + M.h + ':' + S.spec.seed + ':' + S.mapVer + ':' + M.biome;
    if (cache.key === key) return cache.cv;
    var cv = document.createElement('canvas'); cv.width = M.w * TS; cv.height = M.h * TS;
    var c = cv.getContext('2d'), B = P.biome[M.biome] || P.biome.meadow, px = P.pixel;
    function at(x, y) { return x < 0 || y < 0 || x >= M.w || y >= M.h ? 3 : M.t[y * M.w + x]; }
    for (var y = 0; y < M.h; y++) for (var x = 0; x < M.w; x++) {
      var t = at(x, y), X = x * TS, Y = y * TS, h = hsh(x, y);
      c.fillStyle = h < 0.5 ? B.ground : B.ground2; c.fillRect(X, Y, TS, TS);
      if (t === 0) {
        if (h > 0.7) { c.fillStyle = B.speck; c.fillRect(X + (h * 97 % 12) | 0, Y + (h * 53 % 12) | 0, 2, 2); c.fillRect(X + (h * 31 % 10) + 3 | 0, Y + (h * 71 % 10) + 4 | 0, 2, 2); }
      } else if (t === 1) {   // камни: россыпь валунов
        for (var k = 0; k < 3; k++) {
          var bx = X + 2 + hsh(x, y, k + 1) * 10, by = Y + 2 + hsh(x, y, k + 5) * 10, br = 2.5 + hsh(x, y, k + 9) * 2.5;
          if (px) { c.fillStyle = B.rockDark; c.fillRect(bx - br + 1 | 0, by - br + 2 | 0, br * 2 | 0, br * 2 | 0); c.fillStyle = B.rock; c.fillRect(bx - br | 0, by - br | 0, br * 2 | 0, br * 2 - 1 | 0); c.fillStyle = B.rockLight; c.fillRect(bx - br + 1 | 0, by - br + 1 | 0, 2, 2); }
          else { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(bx + 1, by + 1.5, br, br * 0.8, 0, 0, 7); c.fill(); c.fillStyle = B.rock; c.beginPath(); c.ellipse(bx, by, br, br * 0.8, 0, 0, 7); c.fill(); c.fillStyle = B.rockLight; c.beginPath(); c.ellipse(bx - br * 0.3, by - br * 0.3, br * 0.35, br * 0.25, 0, 0, 7); c.fill(); }
        }
      } else if (t === 2) {   // болото
        c.fillStyle = B.swamp; c.fillRect(X, Y, TS, TS);
        c.fillStyle = B.swamp2; if (h > 0.3) c.fillRect(X + 3 + (h * 7 | 0), Y + 4 + (h * 5 | 0), 6, 2);
        if (hsh(x, y, 3) > 0.65) { c.fillStyle = B.reed; c.fillRect(X + 10, Y + 3, 1, 6); c.fillRect(X + 12, Y + 5, 1, 5); }
      } else if (t === 3) {   // скала: приподнятая плита с кромкой
        c.fillStyle = B.cliffDark; c.fillRect(X, Y, TS, TS);
        c.fillStyle = B.cliff; c.fillRect(X, Y, TS, TS - 4);
        c.fillStyle = B.cliffTop; c.fillRect(X + 1, Y + 1, TS - 2, (TS - 6) * 0.6 | 0);
        if (h > 0.5) { c.fillStyle = B.cliffDark; c.fillRect(X + 4 + (h * 6 | 0), Y + 5, 3, 1); }
        if (at(x, y - 1) !== 3) { c.fillStyle = B.cliffTop; c.fillRect(X, Y, TS, 2); }
      } else if (t === 4) {   // дорога: утоптанная колея
        c.fillStyle = B.road; c.fillRect(X, Y, TS, TS);
        c.fillStyle = B.roadEdge;
        if (at(x - 1, y) !== 4) c.fillRect(X, Y, 2, TS); if (at(x + 1, y) !== 4) c.fillRect(X + TS - 2, Y, 2, TS);
        if (at(x, y - 1) !== 4) c.fillRect(X, Y, TS, 2); if (at(x, y + 1) !== 4) c.fillRect(X, Y + TS - 2, TS, 2);
        if (h > 0.6) c.fillRect(X + 5, Y + 7, 2, 2);
      }
    }
    cache = { key: key, cv: cv };
    return cv;
  }

  // ---------- Значки ресурсов (и цехов) ----------
  function icon(ctx, kind, x, y, s, col, P) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s / 6);
    if (kind === 'metal') { ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.3); ctx.lineTo(x - s * 0.3, y - s * 0.3); ctx.lineTo(x + s * 0.3, y - s * 0.3); ctx.lineTo(x + s * 0.5, y + s * 0.3); ctx.closePath(); ctx.fill(); }
    else if (kind === 'energy') { ctx.beginPath(); ctx.moveTo(x + s * 0.1, y - s * 0.55); ctx.lineTo(x - s * 0.35, y + s * 0.08); ctx.lineTo(x, y + s * 0.08); ctx.lineTo(x - s * 0.1, y + s * 0.55); ctx.lineTo(x + s * 0.35, y - s * 0.08); ctx.lineTo(x, y - s * 0.08); ctx.closePath(); ctx.fill(); }
    else if (kind === 'drive') { ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, 7); ctx.stroke(); ctx.fillRect(x - s * 0.12, y - s * 0.12, s * 0.24, s * 0.24); for (var i = 0; i < 4; i++) { var a = i * Math.PI / 2; ctx.fillRect(x + Math.cos(a) * s * 0.45 - s * 0.08, y + Math.sin(a) * s * 0.45 - s * 0.08, s * 0.16, s * 0.16); } }
    else if (kind === 'arms') { ctx.beginPath(); ctx.arc(x, y, s * 0.32, 0, 7); ctx.stroke(); ctx.fillRect(x - s * 0.55, y - s * 0.06, s * 1.1, s * 0.12); ctx.fillRect(x - s * 0.06, y - s * 0.55, s * 0.12, s * 1.1); }
    else if (kind === 'chips') { ctx.fillRect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.6); for (var j = -1; j <= 1; j++) { ctx.fillRect(x - s * 0.5, y + j * s * 0.2 - s * 0.04, s * 1.0, s * 0.08); ctx.fillRect(x + j * s * 0.2 - s * 0.04, y - s * 0.5, s * 0.08, s * 1.0); } ctx.fillStyle = P.panel; ctx.fillRect(x - s * 0.15, y - s * 0.15, s * 0.3, s * 0.3); }
    else if (kind === 'base') { ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.3); ctx.lineTo(x + s * 0.5, y + s * 0.3); ctx.lineTo(x + s * 0.25, y); ctx.lineTo(x + s * 0.5, y - s * 0.3); ctx.lineTo(x - s * 0.2, y - s * 0.3); ctx.lineTo(x - s * 0.5, y - s * 0.05); ctx.closePath(); ctx.fill(); }   // наковальня
  }

  // ---------- Заводы ----------
  function factory(ctx, f, P, t) {
    var x0 = f.tx * TS, y0 = f.ty * TS, w = f.w * TS, h = f.h * TS, cx = f.x, cy = f.y, px = P.pixel, own = f.owner;
    var col = teamCol(P, own), dark = teamDark(P, own);
    // двор
    ctx.fillStyle = P.yard; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    if (f.ruinT > 0) {
      ctx.fillStyle = P.ruin; for (var i = 0; i < 7; i++) { var a = hsh(f.id, i) * 6.28, d = hsh(f.id, i + 9) * w * 0.35; ctx.fillRect(cx + Math.cos(a) * d - 3, cy + Math.sin(a) * d - 2, 6, 4); }
      ctx.fillStyle = P.bldDark; ctx.fillRect(cx - 6, cy - 3, 12, 6);
      if (!px) { ctx.fillStyle = P.smoke; ctx.beginPath(); ctx.arc(cx + Math.sin(t * 2) * 2, cy - 10 - (t * 8 % 10), 4, 0, 7); ctx.fill(); }
      return;
    }
    // корпус
    var bx = x0 + 3, by = y0 + 3, bw = w - 6, bh = h - 6;
    if (px) { ctx.fillStyle = P.bldDark; ctx.fillRect(bx, by + 2, bw, bh); ctx.fillStyle = P.bld; ctx.fillRect(bx, by, bw, bh - 2); ctx.fillStyle = P.bldRoof; ctx.fillRect(bx + 2, by + 2, bw - 4, 3); }
    else { ctx.fillStyle = P.shadow; ctx.fillRect(bx + 3, by + 4, bw, bh); rrect(ctx, bx, by, bw, bh, 3, P.bld); ctx.fillStyle = P.bldRoof; ctx.fillRect(bx + 2, by + 2, bw - 4, 3); }
    // полоса владельца
    ctx.fillStyle = col; ctx.fillRect(bx, by + bh - 5, bw, 3);
    if (f.type === 'base') {
      // генеральный завод: труба, ворота, купол турели
      ctx.fillStyle = P.bldDark; ctx.fillRect(bx + 3, by + 4, 6, 9); ctx.fillStyle = dark; ctx.fillRect(bx + bw - 14, by + bh - 14, 10, 8);
      var on = f.disT <= 0;
      ctx.fillStyle = on ? P.steelDark : P.ruin; ctx.beginPath(); ctx.arc(cx + 4, cy - 2, 8, 0, 7); ctx.fill();
      ctx.fillStyle = on ? col : P.bldDark; ctx.beginPath(); ctx.arc(cx + 4, cy - 2, 5, 0, 7); ctx.fill();
      icon(ctx, 'base', cx + 4, cy - 2, 7, P.anvil, P);
      if (!on) { ctx.fillStyle = P.bad; ctx.fillRect(cx - 4, cy - 12, 16, 2); }
      if (!px) { ctx.fillStyle = P.smoke; ctx.beginPath(); ctx.arc(bx + 6 + Math.sin(t * 1.7) * 2, by + 2 - (t * 9 % 12), 3.5, 0, 7); ctx.fill(); }
    } else {
      ctx.fillStyle = P.panel; ctx.beginPath(); ctx.arc(cx, cy - 2, 7, 0, 7); ctx.fill();
      icon(ctx, f.type, cx, cy - 2, 9, P.res[f.type], P);
    }
    // флажок
    ctx.fillStyle = P.steelDark; ctx.fillRect(x0 + w - 3, y0 - 9, 1.5, 11);
    ctx.fillStyle = col; ctx.fillRect(x0 + w - 2, y0 - 9, 7, 4);
    // захват
    if (f.cap.prog > 0 && f.cap.side >= 0) {
      var need = SB.logic.CAP_T[f.type === 'base' ? 'base' : 'other'], fr = Math.min(1, f.cap.prog / need), R = (f.type === 'base' ? 30 : 22);
      ctx.strokeStyle = teamCol(P, f.cap.side); ctx.lineWidth = px ? 2 : 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + fr * 6.283); ctx.stroke();
    }
  }

  // ---------- Робот ----------
  // r: { d:{chassis,w[],brain}, side, ang, x, y, hp, max, flash, moving }
  function robot(ctx, r, P, t, sc) {
    sc = sc || 1; var px = P.pixel, d = r.d, col = teamCol(P, r.side), dark = teamDark(P, r.side), light = P.teamLight[r.side] || P.steel;
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale(sc, sc);
    var hover = d.chassis === 'hover', bob = hover ? Math.sin(t * 4 + r.x * 0.1) * 0.8 : 0;
    // тень
    ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(hover ? 3 : 1.5, hover ? 4 : 2, 7, 5.5, 0, 0, 7); ctx.fill();
    ctx.rotate(r.ang || 0);
    // шасси
    if (d.chassis === 'wheels') {
      ctx.fillStyle = P.wheel; [[-4, -6], [3, -6], [-4, 4], [3, 4]].forEach(function (q) { ctx.fillRect(q[0] - 1, q[1], 4, 2.5); });
      if (r.moving && !px) { ctx.fillStyle = P.steelDark; ctx.fillRect(((t * 30) % 4) - 4, -6, 1, 2.5); }
    } else if (d.chassis === 'tracks') {
      ctx.fillStyle = P.track; ctx.fillRect(-7, -7.5, 14, 3.5); ctx.fillRect(-7, 4, 14, 3.5);
      ctx.fillStyle = P.steelDark; var o = r.moving ? (t * 24) % 3 : 0; for (var k = -6; k < 7; k += 3) { ctx.fillRect(k + o - 0.5, -7.5, 1, 3.5); ctx.fillRect(k + o - 0.5, 4, 1, 3.5); }
    } else {
      ctx.fillStyle = P.hover; ctx.beginPath(); ctx.arc(0, 0, 7.5 + (px ? 0 : Math.sin(t * 6) * 0.6), 0, 7); ctx.fill();
    }
    ctx.translate(0, bob);
    // корпус: «Гефест» — округлый, Артель — угловатый
    if (r.side === 1) {
      ctx.fillStyle = dark; ctx.beginPath(); for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = r.flash > 0 ? '#ffffff' : col; ctx.beginPath(); for (var j = 0; j < 6; j++) { var b = j * Math.PI / 3 + Math.PI / 6; ctx.lineTo(Math.cos(b) * 4.6, Math.sin(b) * 4.6); } ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
      ctx.fillStyle = r.flash > 0 ? '#ffffff' : col; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, 7); ctx.fill();
      if (!px) { ctx.fillStyle = light; ctx.beginPath(); ctx.arc(-1.4, -1.6, 1.6, 0, 7); ctx.fill(); }
    }
    // модули: стволы по слотам
    var slots = [[-2.2, 2], [-2.2, -2], [1, 0]];
    for (var s = 0; s < 3; s++) {
      var w = d.w[s]; if (!w) continue; var q = slots[s];
      if (w === 'hammer') { ctx.fillStyle = P.steelDark; ctx.fillRect(q[0], q[1] - 1.2, 8.5, 2.4); ctx.fillStyle = P.steel; ctx.fillRect(q[0] + 6.5, q[1] - 1.6, 2.5, 3.2); }
      else if (w === 'rocket') { ctx.fillStyle = P.steel; ctx.fillRect(q[0] - 1, q[1] - 1.8, 6, 3.6); ctx.fillStyle = P.rocket; ctx.fillRect(q[0] + 4.5, q[1] - 1, 1.6, 2); }
      else if (w === 'beam') { ctx.fillStyle = P.steelDark; ctx.fillRect(q[0], q[1] - 0.8, 7, 1.6); ctx.fillStyle = P.beam[0]; ctx.fillRect(q[0] + 6, q[1] - 1.2, 2, 2.4); }
      else if (w === 'core') { ctx.fillStyle = P.bad; ctx.beginPath(); ctx.arc(q[0] - 1.5, q[1], 2.4, 0, 7); ctx.fill(); if (r.core === false) { ctx.fillStyle = P.bldDark; ctx.beginPath(); ctx.arc(q[0] - 1.5, q[1], 1.6, 0, 7); ctx.fill(); } }
    }
    // электроника: антенна/купол-мозг
    if (d.brain === 'basic') { ctx.fillStyle = P.brain; ctx.fillRect(-4.5, -0.8, 2.2, 1.6); }
    else if (d.brain === 'smart') { ctx.fillStyle = P.brain; ctx.beginPath(); ctx.arc(-3, 0, 2, 0, 7); ctx.fill(); ctx.fillStyle = P.visor; ctx.fillRect(-6.5, -0.5, 2.5, 1); }
    ctx.restore();
  }

  // ---------- Дирижабль «Наковальня» ----------
  function ship(ctx, x, y, P, t, alpha) {
    var px = P.pixel; ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = P.shadow; ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.ellipse(x + 16, y + 22, 18, 8, 0, 0, 7); ctx.fill(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y - 6 + Math.sin(t * 1.3) * 1);
    // оболочка
    ctx.fillStyle = P.envelopeDark; ctx.beginPath(); ctx.ellipse(0, 1, 19, 8.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = P.envelope; ctx.beginPath(); ctx.ellipse(0, 0, 18, 7.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = P.rib; ctx.lineWidth = 1; for (var i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 6, -7 + Math.abs(i)); ctx.lineTo(i * 6, 7 - Math.abs(i)); ctx.stroke(); }
    if (!px) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-4, -3.5, 10, 2.2, 0, 0, 7); ctx.fill(); }
    // хвостовое оперение
    ctx.fillStyle = P.envelopeDark; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-24, -6); ctx.lineTo(-22, 0); ctx.lineTo(-24, 6); ctx.closePath(); ctx.fill();
    // знак-наковальня
    icon(ctx, 'base', 3, 0, 9, P.anvil, P);
    // винты
    var sp = t * 30; ctx.fillStyle = P.prop;
    [[-8, -9], [-8, 9]].forEach(function (q) { var l = px ? 3 : 4 * Math.abs(Math.cos(sp)); ctx.fillRect(q[0] - 1, q[1] - l, 2, l * 2); });
    ctx.restore();
  }

  // ---------- Кадр мира ----------
  // o: { sel:{id:true}, poss, time, bare, guardPick, hover }
  function world(ctx, S, P, view, o) {
    o = o || {}; var t = o.time || 0, px = P.pixel;
    var cv = terrain(S, P);
    var sx = Math.max(0, Math.floor(view.x)), sy = Math.max(0, Math.floor(view.y)), sw = Math.min(cv.width - sx, Math.ceil(view.w) + 2), sh = Math.min(cv.height - sy, Math.ceil(view.h) + 2);
    if (sw > 0 && sh > 0) ctx.drawImage(cv, sx, sy, sw, sh, sx, sy, sw, sh);
    var x0 = view.x - 40, y0 = view.y - 40, x1 = view.x + view.w + 40, y1 = view.y + view.h + 40;
    function vis(q) { return q.x > x0 && q.x < x1 && q.y > y0 && q.y < y1; }
    S.factories.forEach(function (f) { if (vis(f)) factory(ctx, f, P, t); });
    // точки охраны выделенных
    if (o.sel) S.robots.forEach(function (r) {
      if (!o.sel[r.id] || r.order.kind !== 'guard') return;
      ctx.strokeStyle = P.sel; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.order.x - 4, r.order.y - 4); ctx.lineTo(r.order.x + 4, r.order.y + 4); ctx.moveTo(r.order.x + 4, r.order.y - 4); ctx.lineTo(r.order.x - 4, r.order.y + 4); ctx.stroke(); ctx.globalAlpha = 1;
    });
    // роботы
    S.robots.forEach(function (r) {
      if (!vis(r)) return;
      var selected = o.sel && o.sel[r.id], poss = S.poss === r.id;
      if (selected || poss) { ctx.strokeStyle = poss ? P.warn : P.sel; ctx.lineWidth = px ? 1 : 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, 10 + (poss ? Math.sin(t * 8) * 1.5 : 0), 0, 7); ctx.stroke(); }
      robot(ctx, r, P, t, 1.2);
      if (r.hp < r.max || selected) { var bw = 14; ctx.fillStyle = P.barBg; ctx.fillRect(r.x - bw / 2, r.y - 12, bw, 2); ctx.fillStyle = r.hp / r.max > 0.5 ? P.good : r.hp / r.max > 0.25 ? P.warn : P.bad; ctx.fillRect(r.x - bw / 2, r.y - 12, bw * Math.max(0, r.hp / r.max), 2); }
    });
    // выстрелы
    S.shots.forEach(function (s) {
      if (s.kind === 'beam') { ctx.strokeStyle = P.beam[0]; ctx.lineWidth = px ? 1 : 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.tx, s.ty); ctx.stroke(); if (!px) { ctx.strokeStyle = P.beam[1]; ctx.lineWidth = 0.8; ctx.stroke(); } return; }
      if (!vis(s)) return;
      if (s.kind === 'rocket') { var a = s.ang || 0; ctx.fillStyle = P.trail; ctx.fillRect(s.x - Math.cos(a) * 6 - 1, s.y - Math.sin(a) * 6 - 1, 2, 2); ctx.fillStyle = P.rocket; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a); ctx.fillRect(-3, -1, 6, 2); ctx.restore(); }
      else { ctx.fillStyle = P.shell; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); }
    });
    // взрывы
    S.booms.forEach(function (b) {
      if (!vis(b)) return; var k = b.big ? 0.8 : 0.5, f = 1 - b.t / k, R = b.r * (0.4 + 0.8 * Math.max(0, f));
      ctx.fillStyle = P.boom[Math.min(3, Math.floor(Math.max(0, f) * 4))]; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.fill();
      if (!px && f < 0.5) { ctx.fillStyle = P.boom[0]; ctx.beginPath(); ctx.arc(b.x, b.y, R * 0.5, 0, 7); ctx.fill(); }
    });
    // дирижабль
    if (!o.bare && S.poss == null) ship(ctx, S.ship.x, S.ship.y, P, t, 0.85);   // в прямом управлении «Наковальня» не мешает обзору
  }

  // ---------- Миникарта ----------
  var mmCache = { key: '', cv: null };
  function minimap(ctx, S, P, rect, view, o) {
    var M = S.map, sc = rect.sc, key = P.name + ':' + S.spec.seed + ':' + M.w + ':' + S.mapVer;
    if (mmCache.key !== key) {
      var cv = document.createElement('canvas'); cv.width = M.w; cv.height = M.h; var c = cv.getContext('2d'), B = P.biome[M.biome] || P.biome.meadow;
      var cols = [B.ground, B.rock, B.swamp, B.cliffDark, B.road];
      for (var y = 0; y < M.h; y++) for (var x = 0; x < M.w; x++) { c.fillStyle = cols[M.t[y * M.w + x]]; c.fillRect(x, y, 1, 1); }
      mmCache = { key: key, cv: cv };
    }
    ctx.save();
    ctx.fillStyle = P.mm; ctx.fillRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 0.85; ctx.drawImage(mmCache.cv, rect.x, rect.y, rect.w, rect.h); ctx.globalAlpha = 1;
    var k = sc / TS;
    S.factories.forEach(function (f) { ctx.fillStyle = f.ruinT > 0 ? P.ruin : teamCol(P, f.owner); var s = f.type === 'base' ? 6 : 4; ctx.fillRect(rect.x + f.x * k - s / 2, rect.y + f.y * k - s / 2, s, s); });
    S.robots.forEach(function (r) { ctx.fillStyle = (o && o.sel && o.sel[r.id]) ? P.sel : P.teamLight[r.side]; ctx.fillRect(rect.x + r.x * k - 1, rect.y + r.y * k - 1, 2, 2); });
    if (view) { ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.strokeRect(rect.x + view.x * k + 0.5, rect.y + view.y * k + 0.5, view.w * k, view.h * k); }
    ctx.strokeStyle = P.line; ctx.strokeRect(rect.x - 2.5, rect.y - 2.5, rect.w + 5, rect.h + 5);
    ctx.restore();
  }

  SB.render = { rrect: rrect, terrain: terrain, world: world, robot: robot, factory: factory, ship: ship, icon: icon, minimap: minimap, teamCol: teamCol };
})(typeof window !== 'undefined' ? window : globalThis);
