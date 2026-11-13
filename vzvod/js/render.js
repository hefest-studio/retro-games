/* ВЗВОД · рендер мира: карта (кэш в offscreen-канве по теме и версии карты), болванчики, механизмы Улья, ульи,
   транспорт, наладчик, ящики, выстрелы и взрывы, маркеры цели и прицел; миникарта. Палитра — VZVOD.modern / VZVOD.classic.
   Координаты мира; вызывающий задаёт сдвиг камеры. VZVOD.render */
(function (global) {
  'use strict';
  var V = global.VZVOD = global.VZVOD || {};
  var cache = { key: '', cv: null };

  function rrect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------- Карта ----------
  function drawTile(ctx, S, P, B, x, y) {
    var L = V.logic, T = L.T, TS = L.TS, t = L.tget(S.map, x, y), px = x * TS, py = y * TS, r = hash(x, y);
    // плиты 2×2 клетки со швами и лёгким разнобоем тона
    var slab = hash(x >> 1, y >> 1);
    ctx.fillStyle = slab < 0.35 ? B.ground2 : B.ground; ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = B.seam;
    if (!(x & 1)) ctx.fillRect(px, py, 1, TS);
    if (!(y & 1)) ctx.fillRect(px, py, TS, 1);
    if (t === T.DECOR) {
      if (S.map.biome === 'swamp') { ctx.fillStyle = B.decor; ctx.fillRect(px + 4, py + 6, 2, 7); ctx.fillRect(px + 8, py + 4, 2, 9); ctx.fillRect(px + 11, py + 7, 2, 6); }
      else if (S.map.biome === 'snow') { ctx.fillStyle = B.decor; if (P.pixel) ctx.fillRect(px + 2, py + 8, 12, 4); else { ctx.beginPath(); ctx.ellipse(px + 8, py + 10, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); } }
      else if (r < 0.5) { ctx.fillStyle = B.decor; ctx.fillRect(px + 4, py + 4, 8, 8); ctx.fillStyle = B.oil; for (var gq = 5; gq < 12; gq += 2) ctx.fillRect(px + gq, py + 5, 1, 6); }   // решётка стока
      else { ctx.fillStyle = B.decor; ctx.fillRect(px + 3 + (r * 6 | 0), py + 5, 2, 2); ctx.fillRect(px + 9, py + 10 - (r * 4 | 0), 2, 2); }   // заклёпки плиты
    } else if (t === T.RAIL) {
      ctx.fillStyle = B.sleeper; for (var k = 2; k < TS; k += 5) ctx.fillRect(px + k, py + 3, 2, 10);
      ctx.fillStyle = B.rail; ctx.fillRect(px, py + 4, TS, 2); ctx.fillRect(px, py + 10, TS, 2);
    } else if (t === T.LIQ) {
      ctx.fillStyle = B.liq; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = B.liq2;
      if (S.map.biome === 'snow') { ctx.fillRect(px + 2 + (r * 6 | 0), py + 4, 6, 1); ctx.fillRect(px + 6, py + 11, 5, 1); }
      else { ctx.fillRect(px + 3 + (r * 7 | 0), py + 5, 2, 2); ctx.fillRect(px + 10, py + 11 - (r * 4 | 0), 2, 2); }
      // берег
      ctx.fillStyle = B.seam;
      if (L.tget(S.map, x, y - 1) !== T.LIQ) ctx.fillRect(px, py, TS, 2);
      if (L.tget(S.map, x - 1, y) !== T.LIQ) ctx.fillRect(px, py, 2, TS);
    } else if (t === T.WALL) {
      var below = L.tget(S.map, x, y + 1) === T.WALL, above = L.tget(S.map, x, y - 1) === T.WALL;
      ctx.fillStyle = B.wall; ctx.fillRect(px, py, TS, TS);
      if (!above) { ctx.fillStyle = B.wallTop; ctx.fillRect(px, py, TS, 3); }
      if (!below) { ctx.fillStyle = B.wallFront; ctx.fillRect(px, py + TS - 5, TS, 5); }
      ctx.fillStyle = B.wallFront;
      if (S.map.biome === 'snow') { for (var c = 3; c < TS; c += 4) ctx.fillRect(px + c, py + 3, 1, TS - 8); }
      else if (!P.pixel || (x + y) % 2) { ctx.fillRect(px + ((y % 2) ? 4 : 11), py + 4, 1, 6); ctx.fillRect(px, py + 8, TS, 1); }
    } else if (t === T.CRATE) {
      ctx.fillStyle = B.crateDark; ctx.fillRect(px + 1, py + 2, 14, 13);
      ctx.fillStyle = B.crate; ctx.fillRect(px + 2, py + 2, 12, 11);
      ctx.fillStyle = B.crateDark; ctx.fillRect(px + 2, py + 7, 12, 1); ctx.fillRect(px + 7, py + 2, 1, 11);
    } else if (t === T.PIPE) {
      var hor = L.tget(S.map, x - 1, y) === T.PIPE || L.tget(S.map, x + 1, y) === T.PIPE;
      ctx.fillStyle = B.pipeDark; if (hor) ctx.fillRect(px, py + 3, TS, 11); else ctx.fillRect(px + 3, py, 11, TS);
      ctx.fillStyle = B.pipe; if (hor) ctx.fillRect(px, py + 4, TS, 6); else ctx.fillRect(px + 4, py, 6, TS);
      ctx.fillStyle = B.pipeDark; if (hor) ctx.fillRect(px + 7, py + 2, 2, 13); else ctx.fillRect(px + 2, py + 7, 13, 2);
    }
    if (t === T.DECOR && S.src && isRubble(S, x, y)) {
      ctx.fillStyle = B.rubble; ctx.fillRect(px + 2, py + 3, 5, 4); ctx.fillRect(px + 9, py + 8, 5, 5); ctx.fillRect(px + 4, py + 11, 3, 3);
    }
  }
  function isRubble(S, x, y) { for (var i = 0; i < S.hives.length; i++) { var h = S.hives[i]; if (h.dead && x >= h.tx && x <= h.tx + 1 && y >= h.ty && y <= h.ty + 1) return true; } return false; }
  function mapCanvas(S, P) {
    var key = P.name + '|' + S.mapVer + '|' + S.map.w + 'x' + S.map.h + '|' + (S.src && S.src.seed) + '|' + S.spec.id;
    if (cache.key === key && cache.map === S.map) return cache.cv;
    var TS = V.logic.TS, cv = cache.cv;
    if (!cv) cv = document.createElement('canvas');
    cv.width = S.map.w * TS; cv.height = S.map.h * TS;
    var ctx = cv.getContext('2d'), B = P.biome[S.map.biome] || P.biome.factory;
    for (var y = 0; y < S.map.h; y++) for (var x = 0; x < S.map.w; x++) drawTile(ctx, S, P, B, x, y);
    cache.key = key; cache.cv = cv; cache.map = S.map;
    return cv;
  }

  // ---------- Существа ----------
  function shadowAt(ctx, P, x, y, rx) { ctx.fillStyle = P.shadow; if (P.pixel) ctx.fillRect(x - rx, y + 4, rx * 2, 3); else { ctx.beginPath(); ctx.ellipse(x, y + 5, rx, rx * 0.45, 0, 0, Math.PI * 2); ctx.fill(); } }
  function drawUnit(ctx, u, P, gi, lead, active, t) {
    var x = Math.round(u.x), y = Math.round(u.y);
    if (!u.alive) {
      // сломан: завалился на бок, искрит и «уезжает» в мастерскую (тает)
      if (u.deadT > 1.6) return;
      ctx.globalAlpha = Math.max(0, 1 - u.deadT / 1.6);
      ctx.fillStyle = P.unitDark[gi]; ctx.fillRect(x - 6, y - 2, 12, 5);
      ctx.fillStyle = P.unit[gi]; ctx.fillRect(x - 5, y - 2, 8, 4);
      if ((t * 10 | 0) % 2) { ctx.fillStyle = P.spark; ctx.fillRect(x + 3, y - 6, 2, 2); ctx.fillRect(x - 2, y - 7, 1, 1); }
      ctx.globalAlpha = 1; return;
    }
    if (u.inV != null) return;
    shadowAt(ctx, P, x, y, 5);
    var step = u.moving ? Math.sin(u.walk * 18) : 0;
    // ножки
    ctx.fillStyle = P.unitDark[gi]; ctx.fillRect(x - 3, y + 2 + (step > 0 ? -1 : 0), 2, 4); ctx.fillRect(x + 1, y + 2 + (step < 0 ? -1 : 0), 2, 4);
    // корпус-бочонок
    if (P.pixel) { ctx.fillStyle = P.unitDark[gi]; ctx.fillRect(x - 4, y - 3, 8, 7); ctx.fillStyle = P.unit[gi]; ctx.fillRect(x - 3, y - 3, 6, 6); }
    else { rrect(ctx, x - 4.5, y - 3.5, 9, 7.5, 3, P.unitDark[gi]); rrect(ctx, x - 3.5, y - 3.5, 7, 6.5, 3, P.unit[gi]); }
    // заводной ключ сзади (противоположно взгляду)
    var bx = x - Math.cos(u.ang) * 5, by = y - Math.sin(u.ang) * 3 - 1, kk = (t * 6 + u.id) % 2 < 1;
    ctx.fillStyle = P.key; ctx.fillRect(Math.round(bx) - (kk ? 2 : 0), Math.round(by) - (kk ? 0 : 2), kk ? 5 : 1, kk ? 1 : 5);
    // голова с визором
    ctx.fillStyle = P.unitLight[gi]; if (P.pixel) ctx.fillRect(x - 3, y - 8, 6, 5); else circ(ctx, x, y - 5.5, 3, P.unitLight[gi]);
    var vx = Math.cos(u.ang), vy = Math.sin(u.ang);
    ctx.fillStyle = P.visor; ctx.fillRect(Math.round(x - 1 + vx * 1.5), Math.round(y - 7 + Math.max(0, vy) * 1.5), 3, 2);
    // паяльник-излучатель
    var tx = x + vx * 7, ty = y + vy * 5;
    ctx.strokeStyle = P.tool; ctx.lineWidth = P.pixel ? 2 : 1.5; ctx.beginPath(); ctx.moveTo(x + vx * 2, y + vy * 1); ctx.lineTo(tx, ty); ctx.stroke();
    if (u.flash > 0) circ(ctx, tx, ty, P.pixel ? 2 : 2.5, P.toolTip);
    // ранг — точки-заклёпки
    if (u.rank > 0) { ctx.fillStyle = P.warn; for (var i = 0; i < u.rank; i++) ctx.fillRect(x - u.rank * 1.5 + i * 3, y - 12, 2, 2); }
    if (lead) {
      ctx.fillStyle = active ? P.mark : P.muted; var by2 = y - (u.rank > 0 ? 17 : 14) + (active ? Math.sin(t * 6) : 0);
      ctx.beginPath(); ctx.moveTo(x - 3, by2 - 3); ctx.lineTo(x + 3, by2 - 3); ctx.lineTo(x, by2); ctx.closePath(); ctx.fill();
    }
  }
  function drawEnemy(ctx, e, P, t) {
    if (e.dead) return;
    var x = Math.round(e.x), y = Math.round(e.y), fl = e.flash > 0, ax = Math.cos(e.ang), ay = Math.sin(e.ang);
    shadowAt(ctx, P, x, y, e.r);
    if (e.type === 'drone') {
      var lg = e.walk ? Math.sin(e.walk * 14) * 1.5 : 0;
      ctx.fillStyle = P.rustDark; ctx.fillRect(x - 6, y + 1 + lg, 3, 2); ctx.fillRect(x + 3, y + 1 - lg, 3, 2); ctx.fillRect(x - 6, y - 3 - lg, 3, 2); ctx.fillRect(x + 3, y - 3 + lg, 3, 2);
      if (P.pixel) { ctx.fillStyle = fl ? '#fff' : P.rust; ctx.fillRect(x - 4, y - 4, 8, 7); }
      else { rrect(ctx, x - 4.5, y - 4.5, 9, 8, 2, fl ? '#fff' : P.rust); ctx.fillStyle = P.rustLight; ctx.fillRect(x - 3, y - 4, 6, 1); }
      ctx.fillStyle = P.rustDark; ctx.fillRect(x, y - 9, 1, 5);
      circ(ctx, x + ax * 2, y + ay * 2 - 1, P.pixel ? 1.5 : 1.8, P.eye);
    } else if (e.type === 'rusher') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(e.ang);
      ctx.fillStyle = P.rushDark; for (var k = -4; k <= 4; k += 4) { ctx.fillRect(k - 1, -6, 2, 12); }
      ctx.fillStyle = fl ? '#fff' : P.rush; if (P.pixel) ctx.fillRect(-6, -3, 12, 6); else { ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 3.6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = P.eye; ctx.fillRect(4, -1, 2, 2);
      ctx.restore();
    } else if (e.type === 'turret') {
      circ(ctx, x, y, 7.5, P.turretDark); circ(ctx, x, y, 6, fl ? '#fff' : P.turret);
      ctx.strokeStyle = P.turretDark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ax * 11, y + ay * 11); ctx.stroke();
      circ(ctx, x, y, 2.4, e.burst > 0 || e.cd < 0.4 ? P.eye : P.rustDark);
    } else if (e.type === 'heavy') {
      circ(ctx, x, y, 8.5, P.heavyDark); circ(ctx, x, y - 1, 7, fl ? '#fff' : P.heavy);
      ctx.fillStyle = P.heavyDark; ctx.fillRect(x - 2, y - 13, 4, 6);
      var sp = (t * 1.3 + e.id * 0.37) % 1; ctx.globalAlpha = 1 - sp; circ(ctx, x + sp * 3, y - 14 - sp * 10, 2 + sp * 3, P.smoke); ctx.globalAlpha = 1;
      ctx.fillStyle = P.rustLight; ctx.fillRect(x - 6, y - 1, 1, 1); ctx.fillRect(x + 5, y - 1, 1, 1);
      circ(ctx, x + ax * 4, y + ay * 3 - 1, 2, P.eye);
    }
    if (e.max > 1 && e.hp < e.max) { ctx.fillStyle = P.barBg; ctx.fillRect(x - 7, y - e.r - 6, 14, 2); ctx.fillStyle = P.bad; ctx.fillRect(x - 7, y - e.r - 6, 14 * e.hp / e.max, 2); }
  }
  function drawHive(ctx, h, P, t) {
    if (h.dead) return;
    var x = h.x, y = h.y, pulse = (Math.sin(t * 3 + h.id) + 1) / 2;
    if (!P.pixel) { ctx.save(); ctx.globalAlpha = 0.5 + pulse * 0.5; circ(ctx, x, y, 22, P.hiveGlow); ctx.restore(); }
    if (P.pixel) { ctx.fillStyle = P.hiveDark; ctx.fillRect(x - 15, y - 13, 30, 28); ctx.fillStyle = h.flash > 0 ? '#fff' : P.hive; ctx.fillRect(x - 13, y - 15, 26, 26); }
    else { rrect(ctx, x - 15, y - 13, 30, 28, 9, P.hiveDark); rrect(ctx, x - 14, y - 15, 28, 27, 9, h.flash > 0 ? '#fff' : P.hive); }
    ctx.fillStyle = P.hiveCell;
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) { var cx = x - 9 + c * 7 + (r % 2) * 3, cy = y - 10 + r * 7; ctx.fillRect(cx, cy, 4, 4); }
    ctx.fillStyle = P.pixel ? (pulse > 0.5 ? P.hiveCore : P.hiveGlow) : P.hiveCore; ctx.globalAlpha = P.pixel ? 1 : 0.6 + pulse * 0.4;
    ctx.fillRect(x - 3, y + 4, 6, 6); ctx.globalAlpha = 1;
    for (var i = 0; i < h.max; i++) { ctx.fillStyle = i < h.hp ? P.bad : P.barBg; ctx.fillRect(x - h.max * 3 + i * 6, y - 20, 4, 3); }
  }
  function drawVehicle(ctx, v, P, t, active) {
    if (v.dead) {
      ctx.fillStyle = P.shadow; ctx.fillRect(v.x - 9, v.y - 6, 18, 12); ctx.fillStyle = P.cartDark; ctx.fillRect(v.x - 7, v.y - 4, 14, 8); return;
    }
    var x = Math.round(v.x), y = Math.round(v.y), fl = v.flash > 0;
    shadowAt(ctx, P, x, y, 10);
    ctx.save(); ctx.translate(x, y);
    if (v.type === 'cart') {
      var hull = v.moving ? 0 : 0;
      ctx.fillStyle = P.cartDark; ctx.fillRect(-10, -7, 20, 14);
      ctx.fillStyle = fl ? '#fff' : P.cart; ctx.fillRect(-9, -6 + hull, 18, 10);
      ctx.fillStyle = P.cartDark; for (var k = -7; k <= 5; k += 4) { ctx.fillRect(k, 5, 3, 3); ctx.fillRect(k, -9, 3, 3); }
      ctx.rotate(v.ang); ctx.fillStyle = P.cartDark; ctx.fillRect(0, -2, 13, 4); circ(ctx, 0, 0, 4.5, fl ? '#fff' : P.cart);
    } else {
      ctx.rotate(v.ang);
      if (P.pixel) { ctx.fillStyle = P.skimmerDark; ctx.fillRect(-10, -7, 20, 14); ctx.fillStyle = fl ? '#fff' : P.skimmer; ctx.fillRect(-8, -6, 16, 12); }
      else { rrect(ctx, -10, -7, 20, 14, 6, P.skimmerDark); rrect(ctx, -8.5, -6, 17, 12, 5, fl ? '#fff' : P.skimmer); }
      ctx.strokeStyle = P.skimmerDark; ctx.lineWidth = 2; var a = t * 30; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-10 + Math.cos(a) * 1, Math.sin(a) * 6); ctx.stroke();
      ctx.fillStyle = P.visor; ctx.fillRect(3, -3, 4, 6);
    }
    ctx.restore();
    if (v.crew == null) {
      ctx.fillStyle = P.good; var bob = Math.sin(t * 5) * 2; ctx.beginPath(); ctx.moveTo(x - 4, y - 18 + bob); ctx.lineTo(x + 4, y - 18 + bob); ctx.lineTo(x, y - 13 + bob); ctx.closePath(); ctx.fill();
    } else if (v.hp < v.max) { ctx.fillStyle = P.barBg; ctx.fillRect(x - 9, y - 13, 18, 2); ctx.fillStyle = P.good; ctx.fillRect(x - 9, y - 13, 18 * v.hp / v.max, 2); }
    if (v.crew != null && active) { ctx.strokeStyle = P.mark; ctx.lineWidth = 1; ctx.strokeRect(x - 12.5, y - 10.5, 25, 21); }
  }
  function drawVip(ctx, v, P, t) {
    if (!v) return; var x = Math.round(v.x), y = Math.round(v.y);
    if (!v.alive) { ctx.fillStyle = P.vipDark; ctx.fillRect(x - 7, y - 2, 14, 6); return; }
    shadowAt(ctx, P, x, y, 7);
    var st = v.moving ? Math.sin(t * 14) : 0;
    ctx.fillStyle = P.vipDark; ctx.fillRect(x - 4, y + 3 + (st > 0 ? -1 : 0), 3, 4); ctx.fillRect(x + 1, y + 3 + (st < 0 ? -1 : 0), 3, 4);
    if (P.pixel) { ctx.fillStyle = v.flash > 0 ? '#fff' : P.vip; ctx.fillRect(x - 6, y - 5, 12, 9); } else rrect(ctx, x - 6, y - 5, 12, 9.5, 3, v.flash > 0 ? '#fff' : P.vip);
    ctx.fillStyle = P.vipDark; ctx.fillRect(x - 4, y - 11, 8, 6); ctx.fillStyle = P.visor; ctx.fillRect(x - 3, y - 9, 6, 2);
    ctx.fillStyle = P.crateBox; ctx.fillRect(x + 5, y - 1, 5, 4); // ящик с инструментом
    for (var i = 0; i < v.max; i++) { ctx.fillStyle = i < v.hp ? P.good : P.barBg; ctx.fillRect(x - 8 + i * 4, y - 16, 3, 2); }
    if (!v.near) { ctx.fillStyle = P.warn; ctx.fillRect(x + 7, y - 16, 2, 5); ctx.fillRect(x + 7, y - 9, 2, 2); }
  }
  function drawPickup(ctx, p, P, t) {
    if (p.taken) return; var x = Math.round(p.x), y = Math.round(p.y) + (Math.sin(t * 4 + p.x) > 0.6 ? -1 : 0);
    shadowAt(ctx, P, x, y, 6);
    ctx.fillStyle = P.crateBox; ctx.fillRect(x - 6, y - 5, 12, 10);
    var c = p.kind === 'gear' ? P.pickGear : P.pickRocket; ctx.fillStyle = c;
    if (p.kind === 'gear') { ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillRect(x - 1, y - 5, 2, 10); ctx.fillRect(x - 5, y - 1, 10, 2); ctx.fillStyle = P.crateBox; ctx.fillRect(x - 1, y - 1, 2, 2); }
    else { ctx.fillRect(x - 4, y - 1, 7, 2); ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + 2, y - 3); ctx.lineTo(x + 2, y + 3); ctx.closePath(); ctx.fill(); }
  }
  function gearIcon(ctx, x, y, r, c, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a || 0); ctx.fillStyle = c;
    for (var i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.fillRect(-1, -r - 1.5, 2, 3); }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // ---------- Кадр мира ----------
  // view = {x, y, w, h} — видимая область мира (камера); o = {aim:{x,y,fire}, target:{x,y}, time}
  function world(ctx, S, P, view, o) {
    o = o || {}; var t = o.time || 0, TS = V.logic.TS;
    var cv = mapCanvas(S, P);
    ctx.drawImage(cv, view.x, view.y, view.w, view.h, view.x, view.y, view.w, view.h);
    function vis(x, y, m) { return x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + view.h + m; }
    // зоны
    if (S.zone) {
      var z = S.zone, f = S.obj.need ? S.obj.prog / S.obj.need : 0;
      ctx.strokeStyle = P.zone; ctx.lineWidth = 2; ctx.setLineDash(P.pixel ? [6, 6] : [5, 4]); ctx.lineDashOffset = -t * 10;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (!P.pixel) { ctx.globalAlpha = z.inside ? 0.16 : 0.08; circ(ctx, z.x, z.y, z.r, P.zone); ctx.globalAlpha = 1; }
      ctx.strokeStyle = P.good; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(z.x, z.y, z.r - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
      ctx.fillStyle = P.zone; ctx.fillRect(z.x - 6, z.y - 6, 12, 12); ctx.fillStyle = P.hudBg; ctx.fillRect(z.x - 3, z.y - 3, 6, 6);
    }
    if (S.exit) {
      var e = S.exit, k = (t * 2) % 1;
      ctx.fillStyle = P.exit; ctx.globalAlpha = 0.25; ctx.fillRect(e.x - 18, e.y - 18, 36, 36); ctx.globalAlpha = 1;
      ctx.strokeStyle = P.exit; ctx.lineWidth = 2; ctx.strokeRect(e.x - 18, e.y - 18, 36, 36);
      ctx.fillStyle = P.exit; for (var c = 0; c < 2; c++) { var yy = e.y + 6 - ((k + c * 0.5) % 1) * 16; ctx.beginPath(); ctx.moveTo(e.x - 6, yy); ctx.lineTo(e.x, yy - 6); ctx.lineTo(e.x + 6, yy); ctx.lineTo(e.x + 6, yy + 2); ctx.lineTo(e.x, yy - 4); ctx.lineTo(e.x - 6, yy + 2); ctx.closePath(); ctx.fill(); }
    }
    if (o.target && S.phase === 'play') { var tg = o.target; ctx.strokeStyle = P.good; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(tg.x - 4, tg.y - 4); ctx.lineTo(tg.x + 4, tg.y + 4); ctx.moveTo(tg.x + 4, tg.y - 4); ctx.lineTo(tg.x - 4, tg.y + 4); ctx.stroke(); ctx.globalAlpha = 1; }
    S.pickups.forEach(function (p) { if (vis(p.x, p.y, 20)) drawPickup(ctx, p, P, t); });
    S.hives.forEach(function (h) { if (vis(h.x, h.y, 30)) drawHive(ctx, h, P, t); });
    S.vehicles.forEach(function (v) { if (vis(v.x, v.y, 24)) drawVehicle(ctx, v, P, t, v.crew === S.active); });
    // сортировка по y — псевдо-глубина
    var list = [];
    S.enemies.forEach(function (e) { if (!e.dead && vis(e.x, e.y, 20)) list.push({ y: e.y, k: 0, o: e }); });
    S.units.forEach(function (u) { if ((u.alive || u.deadT < 1.6) && vis(u.x, u.y, 20)) list.push({ y: u.y, k: 1, o: u }); });
    if (S.vip && vis(S.vip.x, S.vip.y, 20)) list.push({ y: S.vip.y, k: 2, o: S.vip });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (it) {
      if (it.k === 0) drawEnemy(ctx, it.o, P, t);
      else if (it.k === 1) { var u = it.o, g = S.groups[u.gi]; drawUnit(ctx, u, P, u.gi, u.alive && g.order[0] === u.id, u.gi === S.active, t); }
      else drawVip(ctx, it.o, P, t);
    });
    // выстрелы
    ctx.lineCap = P.pixel ? 'butt' : 'round';
    S.bullets.forEach(function (b) {
      if (!vis(b.x, b.y, 10)) return;
      ctx.strokeStyle = P.beam; ctx.lineWidth = P.pixel ? 2 : 2.2; ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (!P.pixel) { ctx.strokeStyle = P.beamCore; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.008, b.y - b.vy * 0.008); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    });
    ctx.lineCap = 'butt';
    S.bolts.forEach(function (b) { if (!vis(b.x, b.y, 10)) return; if (!P.pixel) circ(ctx, b.x, b.y, 5, P.boltGlow); if (P.pixel) { ctx.fillStyle = P.bolt; ctx.fillRect(b.x - 2, b.y - 2, 4, 4); } else circ(ctx, b.x, b.y, 2.6, P.bolt); });
    S.nades.forEach(function (n) { ctx.fillStyle = P.shadow; ctx.fillRect(n.x - 3, n.y - 1, 6, 3); gearIcon(ctx, n.x, n.y - n.z, 3, P.pickGear, n.t * 14); });
    S.missiles.forEach(function (m) {
      var a = Math.atan2(m.vy, m.vx);
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(a); ctx.fillStyle = m.kind === 'shell' ? P.shell : P.pickRocket; ctx.fillRect(-4, -1.5, 8, 3);
      ctx.fillStyle = P.boom[1]; ctx.fillRect(-8 - Math.random() * 3, -1, 4, 2); ctx.restore();
    });
    S.booms.forEach(function (b) {
      var f = b.t / b.max, r = b.r * (0.4 + f * 0.8);
      ctx.globalAlpha = 1 - f;
      if (P.pixel) { ctx.fillStyle = P.boom[Math.min(3, Math.floor(f * 4))]; ctx.fillRect(b.x - r * 0.8, b.y - r * 0.8, r * 1.6, r * 1.6); }
      else { circ(ctx, b.x, b.y, r, P.boom[2]); circ(ctx, b.x, b.y, r * 0.7, P.boom[1]); circ(ctx, b.x, b.y, r * 0.35 * (1 - f), P.boom[0]); }
      ctx.strokeStyle = P.boom[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.6 + f), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    S.sparks.forEach(function (s) { ctx.fillStyle = P.spark; ctx.globalAlpha = 1 - s.t / 0.35; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); ctx.globalAlpha = 1; });
    // прицел
    if (o.aim && S.phase === 'play') {
      var A = o.aim, cc = A.fire ? P.crossFire : P.cross, rr = A.fire ? 6 : 8;
      ctx.strokeStyle = cc; ctx.lineWidth = P.pixel ? 2 : 1.5;
      if (P.pixel) { ctx.strokeRect(A.x - rr, A.y - rr, rr * 2, rr * 2); }
      else { ctx.beginPath(); ctx.arc(A.x, A.y, rr, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(A.x - rr - 4, A.y); ctx.lineTo(A.x - rr + 3, A.y); ctx.moveTo(A.x + rr - 3, A.y); ctx.lineTo(A.x + rr + 4, A.y);
      ctx.moveTo(A.x, A.y - rr - 4); ctx.lineTo(A.x, A.y - rr + 3); ctx.moveTo(A.x, A.y + rr - 3); ctx.lineTo(A.x, A.y + rr + 4); ctx.stroke();
      if (A.mode && A.mode !== 'move') { ctx.fillStyle = A.mode === 'gear' ? P.pickGear : A.mode === 'rocket' ? P.pickRocket : P.crossFire; ctx.fillRect(A.x - 2, A.y - 2, 4, 4); }
    }
  }

  // ---------- Миникарта ----------
  function minimap(ctx, S, P, x0, y0, sc, view, t) {
    var L = V.logic, T = L.T, w = S.map.w, h = S.map.h;
    ctx.fillStyle = P.mm; ctx.fillRect(x0 - 2, y0 - 2, w * sc + 4, h * sc + 4);
    var B = P.biome[S.map.biome];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var tt = S.map.t[y * w + x];
      if (tt === T.WALL || tt === T.PIPE || tt === T.CRATE) ctx.fillStyle = B.wall; else if (tt === T.LIQ) ctx.fillStyle = B.liq2; else continue;
      ctx.fillRect(x0 + x * sc, y0 + y * sc, sc, sc);
    }
    var k = sc / L.TS;
    function dot(px, py, c, s) { ctx.fillStyle = c; ctx.fillRect(Math.round(x0 + px * k - s / 2), Math.round(y0 + py * k - s / 2), s, s); }
    if (S.zone) dot(S.zone.x, S.zone.y, P.zone, 5);
    if (S.exit) dot(S.exit.x, S.exit.y, P.exit, 5);
    S.pickups.forEach(function (p) { if (!p.taken) dot(p.x, p.y, P.pickGear, 3); });
    S.hives.forEach(function (hv) { if (!hv.dead) dot(hv.x, hv.y, (t * 3 | 0) % 2 ? P.bad : P.hiveCore, 5); });
    S.enemies.forEach(function (e) { if (!e.dead) dot(e.x, e.y, P.eye, 2); });
    S.vehicles.forEach(function (v) { if (!v.dead) dot(v.x, v.y, v.crew != null ? P.unit[v.crew] : P.cart, 4); });
    if (S.vip && S.vip.alive) dot(S.vip.x, S.vip.y, P.vip, 4);
    S.units.forEach(function (u) { if (u.alive && u.inV == null) dot(u.x, u.y, P.unit[u.gi], 3); });
    ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
    ctx.strokeRect(x0 + view.x * k + 0.5, y0 + view.y * k + 0.5, view.w * k, view.h * k); ctx.globalAlpha = 1;
  }

  V.render = { world: world, minimap: minimap, rrect: rrect, circ: circ, gearIcon: gearIcon, drawUnit: drawUnit, _cache: cache };
})(typeof window !== 'undefined' ? window : globalThis);
