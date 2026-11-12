/* ТАЙНИК · рендер MODERN (по умолчанию). TAYNIK.modern = { P, world, light, lifeIcon, ammoIcon, hero }
   Нутро водонапорной башни: тёмная кирпичная кладка с трубами, каменные перекрытия с фаской,
   пеньковые верёвки, светящаяся кислота, свет фонаря героя и зажжённых фонарей.
   Герой — подмастерье-фонарщик Светляк (картуз с фонариком, оранжевая куртка, пневмопистолет).
   Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var K = global.TAYNIK = global.TAYNIK || {};
  var L = K.logic, T = L.T, TAU = Math.PI * 2;

  var P = {
    pixel: false, font: null, bg: '#0b0d12',
    hudBg: '#0e1117', hudLine: '#232a35', ink: '#eef2f8', muted: '#8d98a8', accent: '#ff8a3d',
    good: '#4fd88a', bad: '#ff5d6c', warn: '#ffc341', panel: '#141a22', bar: '#232b35',
    rope: '#c9a46a', acid: '#7cf05a', mapCell: '#1d2530', mapPath: '#2f4a3a', mapWall: '#6b7685', mapVoid: '#0b0e13'
  };
  function rr(ctx, x, y, w, h, r) { K.ui.roundRect(ctx, x, y, w, h, r); }
  function hash(a, b) { var n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }

  // ---------- Статичный слой уровня (кэш) ----------
  var cache = { lv: null, c: null };
  function buildStatic(lv) {
    var c = document.createElement('canvas'); c.width = lv.pw; c.height = lv.ph;
    var x = c.getContext('2d');
    // задник: кирпичная кладка башни, темнее книзу
    var g0 = x.createLinearGradient(0, 0, 0, lv.ph);
    g0.addColorStop(0, '#1a1f29'); g0.addColorStop(1, '#11141b');
    x.fillStyle = g0; x.fillRect(0, 0, lv.pw, lv.ph);
    for (var by = 0; by < lv.ph; by += 10) {
      var off = (by / 10) % 2 ? 10 : 0;
      for (var bx = -off; bx < lv.pw; bx += 20) {
        var v = hash(bx, by);
        x.fillStyle = 'rgba(255,255,255,' + (0.015 + v * 0.03).toFixed(3) + ')';
        x.fillRect(bx + 1, by + 1, 18, 8);
      }
    }
    // трубы и вентили — по ячейкам (детерминированно)
    lv.cells.forEach(function (cl) {
      var r = hash(cl.i + 3, cl.j + 7), x0 = (cl.i * L.CX + 1) * T, y0 = (cl.j * L.CY + 1) * T, w = (L.CX - 1) * T, h = (L.CY - 1) * T;
      if (r < 0.45) {
        var py = y0 + 26 + Math.floor(hash(cl.i, cl.j) * 40);
        var pg = x.createLinearGradient(0, py - 5, 0, py + 5);
        pg.addColorStop(0, '#3b4350'); pg.addColorStop(0.5, '#59626f'); pg.addColorStop(1, '#2a3039');
        x.fillStyle = pg; x.fillRect(x0, py - 5, w, 10);
        x.fillStyle = '#6d4a2e'; for (var fx = x0 + 30; fx < x0 + w; fx += 70) x.fillRect(fx, py - 7, 6, 14);
      } else if (r < 0.7) {
        var vx = x0 + 20 + Math.floor(hash(cl.j, cl.i) * (w - 40));
        x.fillStyle = '#2b323c'; x.fillRect(vx - 4, y0, 8, h);
        x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(vx - 3, y0, 2, h);
        x.strokeStyle = '#8a5a34'; x.lineWidth = 2; x.beginPath(); x.arc(vx, y0 + h * 0.45, 7, 0, TAU); x.stroke();
      }
      // потёки ржавчины
      x.fillStyle = 'rgba(160,80,30,.07)';
      for (var k = 0; k < 3; k++) { var sx = x0 + hash(cl.i * 3 + k, cl.j) * w; x.fillRect(sx, y0, 3, 20 + hash(k, cl.i + cl.j) * 50); }
    });
    // кладка перекрытий и стен
    for (var ty = 0; ty < lv.th; ty++) for (var tx = 0; tx < lv.tw; tx++) {
      var t = lv.tiles[ty * lv.tw + tx]; if (t !== 1) continue;
      var px = tx * T, py2 = ty * T, v2 = hash(tx, ty);
      var g1 = x.createLinearGradient(0, py2, 0, py2 + T);
      g1.addColorStop(0, v2 < 0.5 ? '#4a505b' : '#454b55'); g1.addColorStop(1, '#30353d');
      x.fillStyle = g1; x.fillRect(px, py2, T, T);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(px, py2 + T - 1, T, 1); x.fillRect(px + T - 1, py2, 1, T);
      if (ty % 2) x.fillRect(px + T / 2, py2, 1, T);
      var above = L.tileAt(lv, tx, ty - 1);
      if (!above && ty > 0) { x.fillStyle = '#7a828f'; x.fillRect(px, py2, T, 2); x.fillStyle = 'rgba(255,190,120,.10)'; x.fillRect(px, py2 + 2, T, 2); }
      if (!L.tileAt(lv, tx, ty + 1) && ty + 1 < lv.th) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(px, py2 + T - 3, T, 3); }
      if (v2 > 0.86) { x.fillStyle = '#5c6470'; x.beginPath(); x.arc(px + 5 + v2 * 8, py2 + 8, 1.4, 0, TAU); x.fill(); }
    }
    // люк выхода — рама в потолке
    var ex = lv.exitRope;
    x.fillStyle = '#b8873a'; x.fillRect(ex.x - 24, 0, 4, T + 4); x.fillRect(ex.x + 20, 0, 4, T + 4);
    x.fillStyle = '#e2b25a'; x.fillRect(ex.x - 24, T, 48, 3);
    return c;
  }

  // ---------- Фигуры ----------
  function hero(ctx, h, t, opts) {
    opts = opts || {};
    var x = h.x, y = h.y, f = h.face || 1, rope = h.mode === 'rope', air = h.mode === 'air';
    var walk = !rope && !air && Math.abs(h.vx) > 1 ? Math.sin(t * 16) : 0;
    ctx.save();
    if (opts.blink) ctx.globalAlpha = 0.45;
    // ноги
    ctx.fillStyle = '#2c3442';
    if (rope) { ctx.fillRect(x - 3, y - 6, 2.5, 6); ctx.fillRect(x + 0.5, y - 7, 2.5, 6); }
    else if (air) { ctx.fillRect(x - 4, y - 6, 3, 5); ctx.fillRect(x + 1, y - 7, 3, 5); }
    else { ctx.fillRect(x - 3.5 + walk * 1.5, y - 6, 3, 6); ctx.fillRect(x + 0.5 - walk * 1.5, y - 6, 3, 6); }
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 4 + (rope ? 0.5 : walk * 1.5), y - 1.5, 4, 1.5); ctx.fillRect(x + 0.5 - (rope ? 0 : walk * 1.5), y - 1.5, 4, 1.5);
    // куртка
    var jg = ctx.createLinearGradient(x - 5, 0, x + 5, 0); jg.addColorStop(0, '#f08a3a'); jg.addColorStop(1, '#c4621f');
    ctx.fillStyle = jg; rr(ctx, x - 5, y - 13.5, 10, 8.5, 2.5); ctx.fill();
    ctx.fillStyle = '#7a3e14'; ctx.fillRect(x - 5, y - 7.5, 10, 1.5);
    // фонарик на поясе (сзади)
    ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(x - f * 5.5, y - 7, 1.8, 0, TAU); ctx.fill();
    // руки
    ctx.strokeStyle = '#f3c7a0'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    if (rope) { ctx.moveTo(x - 3, y - 12); ctx.lineTo(x - 0.5, y - 17.5); ctx.moveTo(x + 3, y - 12); ctx.lineTo(x + 0.5, y - 15); }
    else { ctx.moveTo(x + f * 3, y - 11); ctx.lineTo(x + f * 7, y - 10.5); }
    ctx.stroke();
    // пневмопистолет
    if (!rope) { ctx.fillStyle = '#9aa4b2'; ctx.fillRect(f > 0 ? x + 6 : x - 11, y - 12, 5, 2.5); ctx.fillStyle = '#b8873a'; ctx.fillRect(f > 0 ? x + 6 : x - 8, y - 10, 2, 2.5); }
    // голова и картуз с фонариком
    ctx.fillStyle = '#f3c7a0'; ctx.beginPath(); ctx.arc(x, y - 15.5, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2d4a7a'; rr(ctx, x - 4, y - 19.5, 8, 3.5, 1.5); ctx.fill();
    ctx.fillRect(x + (f > 0 ? 1 : -6), y - 16.8, 5, 1.4);
    ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(x + f * 1.5, y - 18.3, 1.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function rope(ctx, R, t) {
    var x = R.x;
    ctx.strokeStyle = R.exit ? '#e7c27a' : P.rope; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x, R.top); ctx.lineTo(x, R.bot); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,45,20,.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); for (var y = R.top + 3; y < R.bot; y += 6) { ctx.moveTo(x - 1.2, y); ctx.lineTo(x + 1.2, y + 2.5); } ctx.stroke();
    ctx.fillStyle = '#7a5a34'; ctx.beginPath(); ctx.arc(x, R.bot + 1.5, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8b939f'; ctx.fillRect(x - 4, R.top, 8, 3);
  }
  function spider(ctx, e, t) {
    ctx.strokeStyle = 'rgba(210,210,220,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e.x, e.top); ctx.lineTo(e.x, e.y - 5); ctx.stroke();
    ctx.strokeStyle = '#6e3a1c'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var a = Math.sin(t * 10 + i) * 1.5, ly = e.y - 3 + i * 2.2;
      ctx.moveTo(e.x - 3, ly); ctx.lineTo(e.x - 8, ly - 2 + a); ctx.lineTo(e.x - 10, ly + 3 + a);
      ctx.moveTo(e.x + 3, ly); ctx.lineTo(e.x + 8, ly - 2 - a); ctx.lineTo(e.x + 10, ly + 3 - a);
    }
    ctx.stroke();
    var g = ctx.createRadialGradient(e.x - 2, e.y - 2, 1, e.x, e.y, 7); g.addColorStop(0, '#d9783a'); g.addColorStop(1, '#7a3412');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, e.y, 6, 6.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(e.x - 3, e.y + 1, 2, 2); ctx.fillRect(e.x + 1, e.y + 1, 2, 2);
  }
  function spark(ctx, e, t) {
    var fl = 0.8 + 0.2 * Math.sin(t * 30 + e.x);
    var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 13 * fl);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,210,90,.9)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 13 * fl, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,140,.8)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (var i = 0; i < 4; i++) { var a = t * 7 + i * TAU / 4; ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * 9, e.y + Math.sin(a) * 9); }
    ctx.stroke();
  }
  function drop(ctx, e, t) {
    var d = L.dropAt(e, t);
    ctx.fillStyle = '#4fc23a'; ctx.fillRect(e.x - 4, e.top, 8, 2);
    if (!d) return;
    ctx.fillStyle = '#8cff6a';
    if (d.stage === 'grow') { ctx.beginPath(); ctx.ellipse(e.x, e.top + 2 + d.k * 2, 1.5 + d.k * 2, 1 + d.k * 3, 0, 0, TAU); ctx.fill(); }
    else if (d.stage === 'fall') { ctx.beginPath(); ctx.moveTo(e.x, d.y - 6); ctx.quadraticCurveTo(e.x + 4, d.y + 1, e.x, d.y + 3); ctx.quadraticCurveTo(e.x - 4, d.y + 1, e.x, d.y - 6); ctx.fill(); }
    else { ctx.globalAlpha = 1 - d.k; ctx.strokeStyle = '#8cff6a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, d.y, 3 + d.k * 8, Math.PI, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  function ghost(ctx, e, t) {
    ctx.save(); ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 4 + e.hx);
    var g = ctx.createRadialGradient(e.x, e.y - 3, 2, e.x, e.y, 16); g.addColorStop(0, '#f3f8ff'); g.addColorStop(1, 'rgba(160,200,235,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(225,238,250,.85)'; ctx.beginPath(); ctx.arc(e.x, e.y - 3, 8, Math.PI, 0);
    for (var i = 0; i <= 4; i++) ctx.lineTo(e.x + 8 - i * 4, e.y + 7 + (i % 2 ? -2 : 1) + Math.sin(t * 8 + i) * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#26324a'; ctx.fillRect(e.x - 4, e.y - 4, 2.5, 3.5); ctx.fillRect(e.x + 1.5, e.y - 4, 2.5, 3.5);
    ctx.restore();
  }
  function cham(ctx, e, t) {
    var x = e.x, y = e.y;
    if (!e.shown) {   // сливается с полом: еле заметное марево
      ctx.save(); ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 3 + x);
      ctx.fillStyle = '#6a737f'; rr(ctx, x - 10, y - 7, 20, 7, 3); ctx.fill(); ctx.restore(); return;
    }
    var f = e.face || 1;
    ctx.fillStyle = '#2f8f7a'; rr(ctx, x - 10, y - 11, 20, 9, 4); ctx.fill();
    ctx.fillStyle = '#46c2a2'; rr(ctx, x - 9, y - 11, 18, 3, 2); ctx.fill();
    ctx.strokeStyle = '#2f8f7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - f * 10, y - 6); ctx.quadraticCurveTo(x - f * 16, y - 5, x - f * 14, y - 10); ctx.stroke();
    ctx.fillStyle = '#c9a046'; for (var i = 0; i < 2; i++) { var wx = x - 5 + i * 10; ctx.beginPath(); ctx.arc(wx, y - 2, 2.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(x + f * 7, y - 8, 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a2a24'; ctx.fillRect(x + f * 7 - 0.8, y - 9.5, 1.6, 3);
  }
  function item(ctx, it, t) {
    var x = it.x, y = it.y - 9, b = Math.sin(t * 3 + x) * 1.5;
    switch (it.type) {
      case 'gem':
        ctx.save(); ctx.translate(x, y + b);
        var g = ctx.createLinearGradient(-6, -7, 6, 7); g.addColorStop(0, '#9ff3ff'); g.addColorStop(1, '#2b8ad8');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, -1); ctx.lineTo(0, 7); ctx.lineTo(-6, -1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-2, -4, 2, 3);
        ctx.restore(); break;
      case 'gear':
        ctx.save(); ctx.translate(x, y + b); ctx.rotate(t * 1.5);
        ctx.fillStyle = '#d6a64a'; for (var i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillRect(-1.5, -7.5, 3, 3); }
        ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#5a4020'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill();
        ctx.restore(); break;
      case 'crate':
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x - 8, it.y - 13, 16, 13);
        ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 7.5, it.y - 12.5, 15, 12);
        ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.moveTo(x + 1, it.y - 11); ctx.lineTo(x - 3, it.y - 6); ctx.lineTo(x, it.y - 6); ctx.lineTo(x - 1, it.y - 2); ctx.lineTo(x + 3, it.y - 7); ctx.lineTo(x, it.y - 7); ctx.closePath(); ctx.fill();
        break;
      case 'oil':
        ctx.fillStyle = '#b8332e'; rr(ctx, x - 5, it.y - 12, 10, 12, 2); ctx.fill();
        ctx.fillStyle = '#e05a4a'; ctx.fillRect(x - 4, it.y - 11, 2, 9);
        ctx.strokeStyle = '#9aa4b2'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 4, it.y - 10); ctx.lineTo(x + 9, it.y - 15); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '700 6px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', x, it.y - 3);
        break;
      case 'map':
        ctx.save(); ctx.translate(x, y + b);
        ctx.fillStyle = '#e8d4a2'; ctx.fillRect(-7, -5, 14, 10); ctx.fillStyle = '#b89a5a'; ctx.fillRect(-8, -6, 3, 12); ctx.fillRect(5, -6, 3, 12);
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(1, 2); ctx.moveTo(1, -2); ctx.lineTo(-3, 2); ctx.stroke();
        ctx.restore(); break;
      case 'lamp':
        var ly = it.y - 34;
        ctx.fillStyle = '#4a515c'; ctx.fillRect(x - 1, ly - 8, 2, 8); ctx.fillRect(x - 6, ly - 9, 12, 2);
        ctx.fillStyle = it.lit ? '#ffe08a' : '#3a414c'; rr(ctx, x - 4, ly, 8, 10, 2); ctx.fill();
        ctx.strokeStyle = '#8b939f'; ctx.lineWidth = 1; ctx.strokeRect(x - 4.5, ly - 0.5, 9, 11);
        if (it.lit) { var lg = ctx.createRadialGradient(x, ly + 5, 1, x, ly + 5, 22); lg.addColorStop(0, 'rgba(255,220,120,.5)'); lg.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, ly + 5, 22, 0, TAU); ctx.fill(); }
        break;
    }
  }
  function acidRow(ctx, lv, x0, x1, y0, y1, t) {
    var tx0 = Math.max(0, Math.floor(x0 / T)), tx1 = Math.min(lv.tw - 1, Math.floor(x1 / T)), ty0 = Math.max(0, Math.floor(y0 / T)), ty1 = Math.min(lv.th - 1, Math.floor(y1 / T));
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
      if (lv.tiles[ty * lv.tw + tx] !== 2) continue;
      var px = tx * T, py = ty * T;
      var g = ctx.createLinearGradient(0, py, 0, py + T); g.addColorStop(0, '#9dff6e'); g.addColorStop(0.35, '#3fbf2c'); g.addColorStop(1, '#1d5a16');
      ctx.fillStyle = g; ctx.fillRect(px, py + 2, T, T - 2);
      ctx.fillStyle = 'rgba(200,255,170,.8)';
      for (var k = 0; k < 2; k++) { var bx = px + ((t * 9 + k * 9 + tx * 7) % T), by = py + 4 + ((t * 5 + k * 6 + tx) % 10); ctx.fillRect(bx, by, 2, 2); }
      ctx.fillStyle = 'rgba(150,255,110,.18)'; ctx.fillRect(px, py - 6, T, 8);
    }
  }

  // ---------- Мир ----------
  function world(ctx, S, g, cam) {
    var lv = S.lv, t = g.time;
    if (cache.lv !== lv) { cache.lv = lv; cache.c = buildStatic(lv); }
    var vx0 = cam.x - 30, vy0 = cam.y - 30, vx1 = cam.x + L.VW + 30, vy1 = cam.y + L.VH + 30;
    ctx.drawImage(cache.c, cam.x, cam.y, L.VW, L.VH, cam.x, cam.y, L.VW, L.VH);
    acidRow(ctx, lv, vx0, vx1, vy0, vy1, t);
    // свет из люка
    var ex = lv.exitRope;
    if (ex.x > vx0 && ex.x < vx1 && vy0 < 200) {
      var bg = ctx.createLinearGradient(0, 0, 0, L.CY * T);
      bg.addColorStop(0, 'rgba(255,236,170,.35)'); bg.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(ex.x - 20, 0); ctx.lineTo(ex.x + 20, 0); ctx.lineTo(ex.x + 60, L.CY * T); ctx.lineTo(ex.x - 60, L.CY * T); ctx.closePath(); ctx.fill();
    }
    lv.ropes.forEach(function (R) { if (R.x > vx0 && R.x < vx1 && R.bot > vy0 && R.top < vy1) rope(ctx, R, t); });
    S.items.forEach(function (it) { if (it.taken || it.x < vx0 || it.x > vx1 || it.y < vy0 || it.y > vy1 + 20) return; item(ctx, it, t); });
    if (cam.bare) return;
    S.enemies.forEach(function (e) {
      if (!e.alive || e.x < vx0 - 20 || e.x > vx1 + 20) return;
      if (e.type === 'spider') { if (e.y > vy0 - 40 && e.top < vy1) spider(ctx, e, t); }
      else if (e.y < vy0 - 30 || e.y > vy1 + 30) { if (e.type !== 'drop') return; if (e.top > vy1 || e.floorY < vy0) return; drop(ctx, e, t); }
      else if (e.type === 'spark') spark(ctx, e, t);
      else if (e.type === 'drop') drop(ctx, e, t);
      else if (e.type === 'ghost') ghost(ctx, e, t);
      else if (e.type === 'cham') cham(ctx, e, t);
    });
    S.bullets.forEach(function (b) {
      ctx.fillStyle = 'rgba(160,220,255,.35)'; ctx.fillRect(b.x - (b.vx > 0 ? 10 : 0), b.y - 1.5, 10, 3);
      ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.2, 0, TAU); ctx.fill();
    });
    if (S.phase === 'play' || S.phase === 'clear') hero(ctx, S.hero, t, { blink: S.inv > 0 && Math.floor(t * 14) % 2 === 0 });
  }

  // ---------- Свет: темнота башни с пятнами света (фонарь героя, фонари на стенах, люк) ----------
  var dark = null;
  function light(ctx, S, g, cx, cy, o) {
    if (!dark) { dark = document.createElement('canvas'); dark.width = L.VW; dark.height = L.VH; }
    var d = dark.getContext('2d'), lv = S.lv;
    d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, L.VW, L.VH);
    d.fillStyle = 'rgba(3,4,8,.62)'; d.fillRect(0, 0, L.VW, L.VH);
    d.globalCompositeOperation = 'destination-out';
    function hole(x, y, r, a) {
      var sx = x - cx, sy = y - cy; if (sx < -r || sx > L.VW + r || sy < -r || sy > L.VH + r) return;
      var gr = d.createRadialGradient(sx, sy, r * 0.2, sx, sy, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = gr; d.beginPath(); d.arc(sx, sy, r, 0, TAU); d.fill();
    }
    if (!o.bare && S.phase !== 'dead') hole(S.hero.x, S.hero.y - 10, 175 + Math.sin(g.time * 7) * 4, 1);
    else if (o.bare) hole(cx + L.VW / 2, cy + L.VH / 2, 280, 0.9);
    S.items.forEach(function (it) { if (it.type === 'lamp' && it.lit) hole(it.x, it.y - 30, 150, 0.95); });
    var ex = lv.exitRope; hole(ex.x, 40, 150, 0.9);
    S.enemies.forEach(function (e) { if (e.alive && e.type === 'spark') hole(e.x, e.y, 45, 0.8); });
    S.bullets.forEach(function (b) { hole(b.x, b.y, 30, 0.6); });
    ctx.drawImage(dark, 0, L.HUD);
  }

  function lifeIcon(ctx, x, y, on) {
    ctx.fillStyle = on ? '#ffd36b' : '#2d3540';
    rr(ctx, x - 5, y - 7, 10, 13, 3); ctx.fill();
    ctx.fillStyle = on ? '#fff3c4' : '#3a434f'; ctx.beginPath(); ctx.arc(x, y - 0.5, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = on ? '#8a6a2a' : '#262d36'; ctx.fillRect(x - 6, y - 9, 12, 2.5);
  }
  function ammoIcon(ctx, x, y) {
    ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(159,216,255,.3)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
  }

  K.modern = { P: P, world: world, light: light, lifeIcon: lifeIcon, ammoIcon: ammoIcon, hero: hero,
    sprites: { spider: spider, spark: spark, ghost: ghost, cham: cham, item: item } };
})(typeof window !== 'undefined' ? window : globalThis);
