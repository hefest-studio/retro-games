/* ВОЛОК · рендер (канва 960×540). Одна сцена, две темы:
   modern — мягкие градиенты, тёплые медные и охристые тона; retro — та же сцена в половинном
   разрешении с плоскими полосами неба и «пиксельным» апскейлом (как на 8-битной машине).
   VOLOK.render.draw(ctx, S, g, opts) · VOLOK.render.toLocal(S, sx, sy) — экран → место в избе (для тапа). */
(function (global) {
  'use strict';
  var V = global.VOLOK = global.VOLOK || {};
  var W = 960, H = 540, BASE = 404, FRONT = 640;

  function lerp(a, b, k) { return a + (b - a) * k; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, k) { var x = hex(a), y = hex(b); return 'rgb(' + Math.round(lerp(x[0], y[0], k)) + ',' + Math.round(lerp(x[1], y[1], k)) + ',' + Math.round(lerp(x[2], y[2], k)) + ')'; }
  function mixH(a, b, k) { var x = hex(a), y = hex(b), r = function (i) { var v = Math.round(lerp(x[i], y[i], k)).toString(16); return v.length < 2 ? '0' + v : v; }; return '#' + r(0) + r(1) + r(2); }
  function hsh(n) { var x = Math.sin(n * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); }

  // Небо по времени суток: ключи [tod, верх, низ]
  var SKY = [[0, '#3a4766', '#e7a676'], [0.12, '#6f93bd', '#efd2a4'], [0.25, '#7ea7cc', '#e4e3d2'], [0.42, '#6d7fa6', '#e8c08e'],
    [0.5, '#4b3f66', '#ee9a58'], [0.6, '#1e2440', '#5a4a66'], [0.75, '#0b1224', '#1f2b45'], [0.92, '#1c2442', '#6a5a72'], [1, '#3a4766', '#e7a676']];
  function sky(tod) {
    for (var i = 0; i < SKY.length - 1; i++) if (tod >= SKY[i][0] && tod <= SKY[i + 1][0]) {
      var k = (tod - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]); return [mixH(SKY[i][1], SKY[i + 1][1], k), mixH(SKY[i][2], SKY[i + 1][2], k)];
    }
    return [SKY[0][1], SKY[0][2]];
  }
  function night(tod) { return tod > 0.55 && tod < 0.95 ? Math.min(1, (tod - 0.55) / 0.08, (0.95 - tod) / 0.08) : 0; }

  // Палитры тем
  var PAL = {
    modern: { wood: '#b9793c', woodD: '#8a5426', woodL: '#d9a066', log: '#a8692f', plank: '#6e4322', copper: '#c8743c', copperL: '#e9a46a', copperD: '#7c3f1c',
      brick: '#9a4b32', iron: '#4b4a4f', ironL: '#7b7a80', rope: '#d8c49a', sail: '#ecd9b0', sailD: '#c9ad7c', roof: '#6c7a52', roofD: '#4d5a3a',
      moss: '#8d8a4c', mossD: '#5f6236', soil: '#6f5a3e', rock: '#8c8a85', rockD: '#5d5c5a', water: '#2f6f86', waterD: '#16405a', foam: '#e8f1f2', ice: '#dfeef3', iceD: '#a8c6d3',
      shirt: '#3e5a8c', shirtD: '#2b416a', apron: '#7a4b2a', skin: '#e2b48c', cap: '#8a8f99', boot: '#3a2a20', hud: 'rgba(20,16,12,.55)', hudInk: '#f3e6cf', good: '#9fd36b', warn: '#f2b13a', bad: '#e2553a', accent: '#f0a04b' },
    retro: { wood: '#c07a38', woodD: '#7a4416', woodL: '#e8a860', log: '#a86428', plank: '#603818', copper: '#d87838', copperL: '#f8b070', copperD: '#783810',
      brick: '#a84830', iron: '#404048', ironL: '#888890', rope: '#e0c890', sail: '#f0e0b0', sailD: '#c8a870', roof: '#688048', roofD: '#405028',
      moss: '#988c40', mossD: '#586028', soil: '#705838', rock: '#909088', rockD: '#585850', water: '#2878a0', waterD: '#104060', foam: '#f0f8f8', ice: '#e8f8f8', iceD: '#a0c8d8',
      shirt: '#3858a0', shirtD: '#203870', apron: '#804820', skin: '#f0b888', cap: '#909098', boot: '#382818', hud: 'rgba(0,0,0,.7)', hudInk: '#f8e8c8', good: '#a8e050', warn: '#f8b830', bad: '#f05030', accent: '#f8a040' }
  };

  var off = null, offCtx = null;
  function offscreen() {
    if (!off && typeof document !== 'undefined') { off = document.createElement('canvas'); off.width = W / 3; off.height = H / 3; offCtx = off.getContext('2d'); }
    return offCtx;
  }

  // ---------- Камера ----------
  var cam = { h: 0, x: 0, init: false };
  function machineGeom(S, L, t) {
    var rear = S.mx - L.MW, hr, hf, ang, y0;
    if (!S.water) {
      hr = L.groundH(rear + 70); hf = L.groundH(rear + 310);
      ang = -Math.atan2(hf - hr, 240); y0 = (hr + hf) / 2 + 60;
    } else {
      var st = S.env ? S.env.storm : 0;
      ang = Math.sin(t * 1.3) * 0.025 * (1 + st * 3) * (1 - S.depth * 0.7);
      y0 = L.SEA + 26 + Math.sin(t * 1.7) * (2 + st * 6) - S.depth * 250;
    }
    return { rear: rear, ang: ang, y0: y0 };
  }
  function updCam(S, L, geo, dt) {
    var target = S.water ? L.SEA + 40 - S.depth * 190 : geo.y0 - 40;
    if (!cam.init || dt > 1) { cam.h = target; cam.init = true; }
    cam.h += (target - cam.h) * Math.min(1, dt * 2.5);
    cam.x = S.mx - FRONT;
  }
  function sx(x) { return x - cam.x; }
  function sy(h) { return BASE - (h - cam.h); }

  // ---------- Фон ----------
  function drawSky(ctx, P, E, retro, t) {
    var c = sky(E.tod), wet = E.weather === 'rain' ? 0.45 : E.weather === 'storm' ? 0.35 + E.storm * 0.45 : E.weather === 'snow' ? 0.25 : 0;
    var top = wet ? mixH(c[0], '#4c5458', wet) : c[0], bot = wet ? mixH(c[1], '#8d9496', wet) : c[1];
    if (retro) { for (var i = 0; i < 8; i++) { ctx.fillStyle = mix(top, bot, i / 7); ctx.fillRect(0, i * H / 8 * 0.9, W, H / 8 + 2); } }
    else { var gr = ctx.createLinearGradient(0, 0, 0, H * 0.8); gr.addColorStop(0, top); gr.addColorStop(1, bot); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
    var n = night(E.tod);
    if (n > 0) { // звёзды
      ctx.fillStyle = 'rgba(255,248,230,' + (0.8 * n * (1 - wet)) + ')';
      for (var s = 0; s < 70; s++) { var x = hsh(s) * W, y = hsh(s + 300) * 260, tw = 0.6 + 0.4 * Math.sin(t * 2 + s); ctx.fillRect(x, y, retro ? 2 : 1.6 * tw, retro ? 2 : 1.6 * tw); }
    }
    if (E.weather === 'aurora' && n > 0.1) { // северное сияние — зелёно-бирюзовые ленты
      ctx.save(); ctx.globalAlpha = 0.5 * n;
      for (var b = 0; b < 3; b++) {
        ctx.fillStyle = b === 1 ? 'rgba(120,230,170,.55)' : 'rgba(90,200,190,.4)';
        ctx.beginPath();
        for (var xx = 0; xx <= W; xx += retro ? 16 : 8) { var yy = 70 + b * 26 + Math.sin(xx / 140 + t * 0.25 + b) * 26 + Math.sin(xx / 53 + t * 0.6) * 8; if (xx === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
        for (var x2 = W; x2 >= 0; x2 -= retro ? 16 : 8) { var y2 = 120 + b * 30 + Math.sin(x2 / 140 + t * 0.25 + b) * 26 + Math.sin(x2 / 37 + t) * 14; ctx.lineTo(x2, y2); }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // солнце / луна
    var day = Math.sin(E.tod * Math.PI * 2), alt = day; // >0 день
    if (alt > -0.15 && wet < 0.4) {
      var syy = 330 - alt * 260, sxx = 260 + E.tod * 900;
      ctx.fillStyle = alt < 0.2 ? '#ffc88a' : '#fff1cf';
      if (!retro) { ctx.save(); ctx.shadowColor = 'rgba(255,210,150,.8)'; ctx.shadowBlur = 40; }
      ctx.beginPath(); ctx.arc(sxx % (W + 80), syy, 22, 0, 7); ctx.fill(); if (!retro) ctx.restore();
    } else if (n > 0.3 && wet < 0.6) { ctx.fillStyle = '#f2ecd8'; ctx.beginPath(); ctx.arc(780, 90, 16, 0, 7); ctx.fill(); ctx.fillStyle = sky(E.tod)[0]; ctx.beginPath(); ctx.arc(788, 85, 14, 0, 7); ctx.fill(); }
  }
  function ridge(ctx, par, base, amp, f1, f2, color, step) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= W + step; x += step) { var wx = x + cam.x * par; var y = base - amp * (0.6 * Math.sin(wx / f1) + 0.4 * Math.sin(wx / f2 + 2) + 0.25 * Math.sin(wx / (f2 * 0.37))); ctx.lineTo(x, y); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function drawFar(ctx, P, E, L, retro, S) {
    var c = sky(E.tod), haze = c[1], n = night(E.tod), step = retro ? 8 : 4;
    var sea = cam.x > L.SHORE_X - 2600;
    var dy = (cam.h - 0) * 0.15;
    if (E.sec <= 2) ridge(ctx, 0.08, 240 + dy, 70, 260, 140, mixH(mixH('#6d7c94', '#2c3346', n), haze, 0.45), step);   // дальние сопки
    if (E.sec >= 3) { // горизонт моря
      ctx.fillStyle = mixH(mixH('#3f7d93', '#0f1d2c', n), haze, 0.35); ctx.fillRect(0, 268 + dy, W, H);
      if (E.sec >= 5) { ctx.fillStyle = mixH(P.ice, haze, 0.35); for (var i = 0; i < 6; i++) { var bx = ((i * 263 - cam.x * 0.05) % (W + 200) + W + 200) % (W + 200) - 100; ctx.beginPath(); ctx.moveTo(bx, 270 + dy); ctx.lineTo(bx + 30, 240 + dy - i % 3 * 8); ctx.lineTo(bx + 70, 252 + dy); ctx.lineTo(bx + 90, 270 + dy); ctx.fill(); } }
    }
    if (!sea || E.sec <= 3) ridge(ctx, 0.25, 300 + dy * 2, 40, 180, 90, mixH(mixH('#59683f', '#1c2418', n), haze, 0.3), step);
  }
  function groundY(L, x) { return sy(L.groundH(x)); }
  function drawGround(ctx, P, E, L, S, retro, t) {
    var n = night(E.tod), dk = function (c) { return mixH(c, '#141821', n * 0.6); }, step = retro ? 8 : 4;
    var x0 = cam.x - 20, x1 = cam.x + W + 20, shore = L.SHORE_X;
    // суша
    if (x0 < shore + 60) {
      ctx.fillStyle = dk(P.soil); ctx.beginPath(); ctx.moveTo(sx(x0), H);
      for (var x = x0; x <= Math.min(x1, shore + 60); x += step) ctx.lineTo(sx(x), groundY(L, x));
      ctx.lineTo(sx(Math.min(x1, shore + 60)), H); ctx.closePath(); ctx.fill();
      // мох поверху
      ctx.strokeStyle = dk(E.weather === 'snow' ? '#e6edf0' : P.moss); ctx.lineWidth = retro ? 8 : 7; ctx.beginPath();
      for (var x2 = x0; x2 <= Math.min(x1, shore - 40); x2 += step) { var y = groundY(L, x2) + 3; if (x2 === x0) ctx.moveTo(sx(x2), y); else ctx.lineTo(sx(x2), y); }
      ctx.stroke();
      // камни, кочки, карликовые берёзы
      for (var k = Math.floor(x0 / 70); k < x1 / 70; k++) {
        var wx = k * 70 + hsh(k) * 40; if (wx > shore - 60) break; var gy = groundY(L, wx), r = hsh(k + 7);
        if (r < 0.3) { ctx.fillStyle = dk(P.rock); ctx.fillRect(sx(wx) - 6, gy - 5, 12, 7); ctx.fillStyle = dk(P.rockD); ctx.fillRect(sx(wx) - 6, gy, 12, 3); }
        else if (r < 0.5) { ctx.strokeStyle = dk('#6b5a44'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(wx), gy); ctx.lineTo(sx(wx) + 3, gy - 18); ctx.stroke(); ctx.fillStyle = dk(E.sec === 2 ? '#a77c3a' : '#a9a24a'); ctx.fillRect(sx(wx) - 4, gy - 24, 12, 8); }
        else if (r < 0.62) { ctx.fillStyle = dk(P.mossD); ctx.fillRect(sx(wx) - 8, gy - 3, 16, 5); }
      }
    }
    // брод
    var fo = L.OBI.ford;
    if (x1 > fo.x - 260 && x0 < fo.x2 + 260) {
      ctx.fillStyle = 'rgba(60,120,140,.75)'; ctx.beginPath();
      var wl = sy(-14);
      ctx.moveTo(sx(fo.x - 140), wl);
      for (var fx = fo.x - 140; fx <= fo.x2 + 140; fx += step) ctx.lineTo(sx(fx), Math.max(wl + Math.sin(fx / 30 + t * 2) * 1.5, wl));
      for (var fx2 = fo.x2 + 140; fx2 >= fo.x - 140; fx2 -= step) ctx.lineTo(sx(fx2), Math.max(wl, groundY(L, fx2)));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(230,245,245,.6)'; for (var q = 0; q < 6; q++) ctx.fillRect(sx(fo.x + q * 120 + (t * 20) % 120), wl - 1, 18, 2);
    }
  }
  function drawSea(ctx, P, E, L, S, retro, t, front) {
    var x0 = Math.max(cam.x - 20, L.SHORE_X - 120), x1 = cam.x + W + 20; if (x0 > x1) return;
    var n = night(E.tod), st = E.storm || 0, step = retro ? 8 : 6;
    var amp = 3 + st * 12, lvl = sy(L.SEA);
    var wave = function (x) { return lvl + Math.sin(x / 46 + t * 1.6) * amp * 0.6 + Math.sin(x / 19 - t * 2.3) * amp * 0.3; };
    if (!front) {
      var gr = retro ? null : ctx.createLinearGradient(0, lvl, 0, H);
      if (gr) { gr.addColorStop(0, mixH(P.water, '#0b1a28', n * 0.7)); gr.addColorStop(1, mixH(P.waterD, '#050c14', n * 0.7)); }
      ctx.fillStyle = gr || mixH(P.water, '#0b1a28', n * 0.7);
      ctx.beginPath(); ctx.moveTo(sx(x0), H); for (var x = x0; x <= x1; x += step) ctx.lineTo(sx(x), wave(x)); ctx.lineTo(sx(x1), H); ctx.closePath(); ctx.fill();
      // льдины
      L.OBI.ice.sheets.forEach(function (sh) {
        if (sh[1] < x0 || sh[0] > x1) return;
        ctx.fillStyle = mixH(P.ice, '#5d7180', n * 0.6); ctx.fillRect(sx(sh[0]), lvl - 10, sh[1] - sh[0], 26);
        ctx.fillStyle = mixH(P.iceD, '#34495a', n * 0.6); ctx.fillRect(sx(sh[0]), lvl + 12, sh[1] - sh[0], 10);
        for (var c = sh[0] + 40; c < sh[1]; c += 140) { ctx.fillStyle = mixH('#ffffff', '#7d93a3', n * 0.6); ctx.fillRect(sx(c), lvl - 16, 40 + (c % 50), 8); }
      });
      return;
    }
    // передний план воды: полупрозрачная «кромка» поверх машины
    ctx.fillStyle = 'rgba(40,110,140,' + (0.24 + S.depth * 0.08) + ')';
    ctx.beginPath(); ctx.moveTo(sx(x0), H); for (var x3 = x0; x3 <= x1; x3 += step) ctx.lineTo(sx(x3), wave(x3) + 4); ctx.lineTo(sx(x1), H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = mixH(P.foam, '#6e8ea0', n * 0.5); ctx.lineWidth = retro ? 2 : 1.6; ctx.beginPath();
    for (var x4 = x0; x4 <= x1; x4 += step) { var yy = wave(x4); if (x4 === x0) ctx.moveTo(sx(x4), yy); else ctx.lineTo(sx(x4), yy); } ctx.stroke();
    if (st > 0.3) { ctx.fillStyle = 'rgba(240,248,248,.5)'; for (var f = 0; f < 14; f++) { var fx = ((f * 97 - t * 60) % W + W) % W; ctx.fillRect(fx, wave(fx + cam.x) - 3, 14, 3); } }
  }

  // ---------- Препятствия, кучи, финал ----------
  function drawProps(ctx, P, E, L, S, retro, t) {
    var x0 = cam.x - 200, x1 = cam.x + W + 200, n = night(E.tod), dk = function (c) { return mixH(c, '#141821', n * 0.55); };
    L.OB.forEach(function (o) {
      if (o.x < x0 || o.x > x1 + 400) return;
      if (o.kind === 'gate' && o.id === 'barrier') { // шлагбаум с противовесом: поднимается лебёдкой
        var gx = sx(o.x), gy = groundY(L, o.x), k = Math.min(1, S.prog.barrier / o.need);
        ctx.fillStyle = dk(P.woodD); ctx.fillRect(gx + 4, gy - 70, 12, 70);
        ctx.save(); ctx.translate(gx + 10, gy - 60); ctx.rotate(-k * 1.35);
        for (var i = 0; i < 6; i++) { ctx.fillStyle = dk(i % 2 ? '#e8d6a8' : '#3b3a3d'); ctx.fillRect(-220 + i * 37, -5, 37, 10); }
        ctx.fillStyle = dk(P.iron); ctx.fillRect(10, -9, 24, 18); ctx.restore();
      }
      if (o.kind === 'gate' && o.id === 'rubble') { // завал: брёвна и валуны, лебёдка утаскивает в сторону
        var k2 = Math.min(1, S.prog.rubble / o.need), rx = sx(o.x) + k2 * 40, ry = groundY(L, o.x);
        ctx.save(); ctx.globalAlpha = 1 - k2 * 0.85;
        for (var j = 0; j < 7; j++) { var bx = rx + (j % 4) * 22 - 10 + k2 * j * 18, by = ry - 10 - Math.floor(j / 4) * 20 - (j % 2) * 6;
          if (j % 3) { ctx.fillStyle = dk(P.rock); ctx.beginPath(); ctx.arc(bx + 12, by, 14, 0, 7); ctx.fill(); }
          else { ctx.fillStyle = dk(P.log); ctx.fillRect(bx - 20, by - 7, 64, 13); ctx.fillStyle = dk(P.woodL); ctx.beginPath(); ctx.arc(bx + 44, by, 6, 0, 7); ctx.fill(); } }
        ctx.restore();
      }
      if (o.kind === 'shore' && !S.water) { // стапель у кромки берега
        var sxx = sx(o.x), syy = groundY(L, o.x - 10);
        ctx.fillStyle = dk(P.plank); for (var p = 0; p < 4; p++) ctx.fillRect(sxx - 10 + p * 26, syy - 4 + p * 14, 30, 6);
        ctx.fillStyle = dk(P.woodD); ctx.fillRect(sxx - 4, syy - 40, 6, 40);
      }
    });
    // кучи топлива
    S._piles.forEach(function (p, i) {
      if (p.x < x0 || p.x > x1) return; var left = p.n - (S.taken[i] || 0); if (left <= 0) return;
      var px = sx(p.x), py = p.water ? sy(L.SEA) + Math.sin(t * 1.6 + p.x) * 3 : groundY(L, p.x);
      for (var k = 0; k < left; k++) {
        var ox = (k % 2) * 14 - 7, oy = -6 - Math.floor(k / 2) * 9;
        if (p.type === 'wood') { ctx.fillStyle = dk(P.log); ctx.fillRect(px + ox - 10, py + oy, 22, 8); ctx.fillStyle = dk(P.woodL); ctx.fillRect(px + ox + 10, py + oy + 1, 4, 6); }
        else if (p.type === 'coal') { ctx.fillStyle = dk('#26252b'); ctx.beginPath(); ctx.arc(px + ox, py + oy + 4, 7, 0, 7); ctx.fill(); ctx.fillStyle = dk('#5a5966'); ctx.fillRect(px + ox - 2, py + oy, 3, 2); }
        else { ctx.fillStyle = dk(P.ironL); ctx.fillRect(px + ox - 8, py + oy + 1, 16, 6); ctx.fillStyle = dk(P.copper); ctx.fillRect(px + ox - 2, py + oy - 2, 5, 4); }
      }
      if (p.water) { ctx.fillStyle = 'rgba(240,248,248,.5)'; ctx.fillRect(px - 16, py + 2, 32, 2); }
    });
    // зимовье — финал
    var fx = sx(L.FIN_X + 260);
    if (fx < W + 300) {
      var fy = sy(L.SEA);
      ctx.fillStyle = dk('#d8dde0'); ctx.beginPath(); ctx.moveTo(fx - 120, fy + 6); ctx.lineTo(fx - 60, fy - 40); ctx.lineTo(fx + 260, fy - 52); ctx.lineTo(fx + 420, fy + 6); ctx.fill();
      ctx.fillStyle = dk(P.log); ctx.fillRect(fx, fy - 96, 120, 56); ctx.fillStyle = dk(P.roofD); ctx.beginPath(); ctx.moveTo(fx - 10, fy - 96); ctx.lineTo(fx + 60, fy - 134); ctx.lineTo(fx + 130, fy - 96); ctx.fill();
      ctx.fillStyle = '#ffd27a'; ctx.fillRect(fx + 20, fy - 80, 16, 14); ctx.fillRect(fx + 80, fy - 80, 16, 14);
      ctx.fillStyle = dk(P.brick); ctx.fillRect(fx + 90, fy - 140, 12, 30);
      ctx.fillStyle = 'rgba(220,220,220,.5)'; for (var sm = 0; sm < 4; sm++) { ctx.beginPath(); ctx.arc(fx + 96 + sm * 8 + Math.sin(t + sm) * 4, fy - 150 - sm * 16 - (t * 10 % 16), 6 + sm * 2, 0, 7); ctx.fill(); }
      ctx.fillStyle = dk(P.plank); ctx.fillRect(fx - 100, fy - 6, 110, 6); for (var pl = 0; pl < 4; pl++) ctx.fillRect(fx - 96 + pl * 30, fy - 6, 4, 26);
    }
  }

  // ---------- Машина (изба) ----------
  var FH = 58;
  function plankRow(ctx, x, y, w, c1, c2) { ctx.fillStyle = c1; ctx.fillRect(x, y, w, 7); ctx.fillStyle = c2; ctx.fillRect(x, y + 7, w, 2); }
  function drawMachine(ctx, P, E, L, S, retro, t, geo, hl) {
    var MW = L.MW, n = night(E.tod), lamp = Math.max(0, n * 0.9 + (S.depth > 0.5 ? 0.6 : 0)), sub = S.depth > 0.6;
    var dk = function (c) { return mixH(c, '#1a1410', n * 0.35); };
    ctx.save(); ctx.translate(sx(geo.rear), sy(geo.y0)); ctx.rotate(geo.ang);
    // ---- шасси / поплавки / колёса ----
    var wr = S.water ? 0 : 1, spin = S.mx / 34;
    if (!S.water || S.depth < 1) {
      if (S.water) { // поплавки и гребное колесо
        ctx.fillStyle = dk(P.copperD); ctx.fillRect(-10, 8, MW + 30, 26); ctx.fillStyle = dk(P.copper); ctx.fillRect(-6, 10, MW + 22, 16);
        ctx.fillStyle = dk(P.copperL); ctx.fillRect(-6, 10, MW + 22, 4);
        for (var rv = 0; rv < 9; rv++) { ctx.fillStyle = dk(P.copperD); ctx.fillRect(10 + rv * 44, 16, 3, 3); }
        ctx.save(); ctx.translate(-26, 2); ctx.rotate(spin * 0.4);
        ctx.strokeStyle = dk(P.woodD); ctx.lineWidth = 5; for (var pd = 0; pd < 8; pd++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.stroke(); ctx.fillStyle = dk(P.wood); ctx.fillRect(-7, 24, 14, 8); }
        ctx.restore();
      }
    }
    if (wr) {
      ctx.fillStyle = dk(P.iron); ctx.fillRect(20, 2, MW - 40, 14);
      [70, 310].forEach(function (wx) {
        ctx.save(); ctx.translate(wx, 26); ctx.rotate(spin);
        ctx.fillStyle = dk(P.woodD); ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill();
        ctx.fillStyle = dk(P.iron); ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.arc(0, 0, 28, 0, 7, true); ctx.fill();
        ctx.strokeStyle = dk(P.wood); ctx.lineWidth = 4; for (var sp = 0; sp < 6; sp++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 28); ctx.stroke(); }
        ctx.fillStyle = dk(P.copper); ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = dk(P.copperD); ctx.fillRect(90, 18, 200, 6);    // шатун
    }
    // ---- сруб: задняя стена (брёвна) ----
    var top = -2 * FH;
    for (var ly = top; ly < 0; ly += 9) plankRow(ctx, 0, ly, MW, dk(ly % 18 ? P.log : P.wood), dk(P.woodD));
    // тёплый свет фонаря внутри
    if (lamp > 0 && !retro) { var lg = ctx.createRadialGradient(190, -60, 10, 190, -60, 220); lg.addColorStop(0, 'rgba(255,190,110,' + 0.35 * lamp + ')'); lg.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = lg; ctx.fillRect(0, top, MW, -top); }
    // ---- чердак под крышей ----
    ctx.fillStyle = dk(P.woodD); ctx.beginPath(); ctx.moveTo(-14, top); ctx.lineTo(MW / 2, top - 74); ctx.lineTo(MW + 14, top); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dk(P.log); ctx.beginPath(); ctx.moveTo(14, top); ctx.lineTo(MW / 2, top - 62); ctx.lineTo(MW - 14, top); ctx.closePath(); ctx.fill();
    for (var ay = top - 9; ay > top - 60; ay -= 9) { var half = (ay - (top - 62)) / 62 * (MW / 2 - 14); ctx.fillStyle = dk(P.woodD); ctx.fillRect(MW / 2 - half, ay, half * 2, 2); }
    // ---- перекрытия ----
    [0, -FH, -2 * FH].forEach(function (fy, i) { ctx.fillStyle = dk(P.plank); ctx.fillRect(-4, fy, MW + 8, i === 0 ? 8 : 6); ctx.fillStyle = dk(P.woodL); ctx.fillRect(-4, fy, MW + 8, 2); });
    // ---- лестницы ----
    L.LADDERS.forEach(function (l) { var y1 = -l.a * FH, y2 = -l.b * FH; ctx.fillStyle = dk(P.woodL); ctx.fillRect(l.x - 9, y2, 3, y1 - y2); ctx.fillRect(l.x + 6, y2, 3, y1 - y2); for (var r = y2 + 6; r < y1; r += 10) ctx.fillRect(l.x - 9, r, 18, 3); ctx.fillStyle = dk(P.plank); ctx.fillRect(l.x - 12, y2 - 1, 24, 7); ctx.fillStyle = '#1d140d'; ctx.fillRect(l.x - 10, y2, 20, 5); });
    // ---- станции ----
    drawStations(ctx, P, L, S, retro, t, dk, hl);
    // ---- пожары и течи ----
    S.fires.forEach(function (f) { flame(ctx, f.x, -f.f * FH, t, 1.1, retro); });
    S.leaks.forEach(function (l, i) { var y = -l.f * FH - 34; ctx.fillStyle = 'rgba(240,240,240,.75)'; for (var k = 0; k < 5; k++) { var a = (t * 3 + k * 0.7 + i) % 1; ctx.globalAlpha = 0.8 * (1 - a); ctx.beginPath(); ctx.arc(l.x + a * 30, y - a * 16, 3 + a * 8, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; ctx.fillStyle = dk(P.copperD); ctx.fillRect(l.x - 14, y - 2, 28, 5); });
    // ---- герой ----
    drawHero(ctx, P, S, t, retro);
    // ---- передний срез: столбы, наличники ----
    ctx.fillStyle = dk(P.woodD); ctx.fillRect(-8, top, 10, -top + 6); ctx.fillRect(MW - 2, top, 10, -top + 6);
    ctx.fillStyle = dk(P.wood); ctx.fillRect(-12, top - 2, 18, 8); ctx.fillRect(MW - 6, top - 2, 18, 8);
    // крыша (дерн)
    ctx.strokeStyle = dk(E.weather === 'snow' ? '#e9eff2' : P.roof); ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-22, top + 4); ctx.lineTo(MW / 2, top - 78); ctx.lineTo(MW + 22, top + 4); ctx.stroke();
    ctx.strokeStyle = dk(P.roofD); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, top + 9); ctx.lineTo(MW / 2, top - 72); ctx.lineTo(MW + 22, top + 9); ctx.stroke();
    // конёк-резьба на носу: медный завиток
    ctx.strokeStyle = dk(P.copperL); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(MW + 24, top - 2, 9, Math.PI, Math.PI * 2.6); ctx.stroke();
    // труба и дым
    ctx.fillStyle = dk(P.brick); ctx.fillRect(150, top - 64, 18, 40); ctx.fillStyle = dk(P.iron); ctx.fillRect(146, top - 68, 26, 6);
    if (S.F > 0 && !sub) { var puffs = 3 + S.mode * 2; for (var s = 0; s < puffs; s++) { var a2 = (t * (0.6 + S.mode * 0.3) + s / puffs) % 1; ctx.fillStyle = 'rgba(' + (S.F > 30 ? '210,205,198' : '120,116,112') + ',' + (0.5 * (1 - a2)) + ')'; ctx.beginPath(); ctx.arc(159 - a2 * 60 * (1 + Math.abs(S.v) / 40), top - 72 - a2 * 70, 7 + a2 * 16, 0, 7); ctx.fill(); } }
    // мачта и парус
    var mastX = 250, mTop = top - 230, sBot = top - 62;
    if (S.depth > 0.3) { ctx.fillStyle = dk(P.woodD); ctx.fillRect(40, top - 84, 300, 7); ctx.fillStyle = dk(P.sailD); ctx.fillRect(70, top - 92, 230, 8); }   // под водой мачта сложена вдоль конька
    else if (S.mastBroken) { ctx.fillStyle = dk(P.woodD); ctx.fillRect(mastX - 4, top - 90, 8, 90); ctx.save(); ctx.translate(mastX, top - 90); ctx.rotate(1.1); ctx.fillRect(-4, -110, 8, 110); ctx.restore(); }
    else {
      ctx.fillStyle = dk(P.woodD); ctx.fillRect(mastX - 4, mTop, 8, -mTop + top);
      ctx.fillStyle = dk(P.wood); ctx.fillRect(mastX - 60, mTop + 10, 120, 6);    // рей
      if (S.sailUp) {
        var wind = S.env ? S.env.wind : 0, bulge = Math.max(-1, Math.min(1, wind)) * 22;
        ctx.fillStyle = dk(P.sail); ctx.beginPath(); ctx.moveTo(mastX - 58, mTop + 16); ctx.quadraticCurveTo(mastX - 58 + bulge * 0.4, mTop + 90, mastX - 54, sBot);
        ctx.lineTo(mastX + 54, sBot); ctx.quadraticCurveTo(mastX + 58 + bulge, mTop + 90, mastX + 58, mTop + 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = dk(P.sailD); for (var sl = 0; sl < 3; sl++) ctx.fillRect(mastX - 56, mTop + 40 + sl * 36, 112, 3);
        ctx.fillStyle = dk(P.copper); ctx.beginPath(); ctx.arc(mastX, mTop + 80, 16, 0, 7); ctx.fill(); ctx.fillStyle = dk(P.sail); ctx.beginPath(); ctx.arc(mastX, mTop + 80, 9, 0, 7); ctx.fill();   // знак мастерской — шестерня-солнце
      } else { ctx.fillStyle = dk(P.sailD); ctx.fillRect(mastX - 58, mTop + 14, 116, 10); }
      ctx.strokeStyle = dk(P.rope); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(mastX, mTop); ctx.lineTo(-10, top); ctx.moveTo(mastX, mTop); ctx.lineTo(MW + 10, top); ctx.stroke();
      ctx.fillStyle = dk(P.copperL); ctx.fillRect(mastX - 2, mTop - 14, 18, 8);   // вымпел
    }
    // лебёдка: трос и крюк к носу
    var task = S._winchTask;
    ctx.strokeStyle = dk(P.rope); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(352, -FH - 26); ctx.lineTo(MW + 30, -FH - 30);
    if (task) { var hx = task.x - S.mx + MW, hy = task.kind === 'shore' ? 10 : -40; ctx.lineTo(hx + 10, hy); } else ctx.lineTo(MW + 30, -FH + 4);
    ctx.stroke(); ctx.fillStyle = dk(P.iron); ctx.fillRect(MW + 2, -FH - 36, 34, 8);
    // колокол — при погружении стыки светятся пузырьками
    if (S.depth > 0.05) { ctx.fillStyle = 'rgba(220,240,255,' + 0.5 * S.depth + ')'; for (var bb = 0; bb < 8; bb++) { var a3 = (t * 0.7 + bb / 8) % 1; ctx.beginPath(); ctx.arc(30 + bb * 44 + Math.sin(t * 3 + bb) * 4, top - 70 - a3 * 120, 2 + a3 * 3, 0, 7); ctx.fill(); } }
    ctx.restore();
  }
  function flame(ctx, x, y, t, s, retro) {
    for (var i = 0; i < 4; i++) { var k = Math.sin(t * 12 + i * 2) * 0.5 + 0.5; ctx.fillStyle = i % 2 ? '#ffd35a' : '#f06a26'; ctx.beginPath(); ctx.moveTo(x - 10 * s + i * 5, y); ctx.quadraticCurveTo(x - 6 * s + i * 5, y - (16 + k * 12) * s, x + i * 5 - 2, y - (26 + k * 10) * s); ctx.quadraticCurveTo(x + 6 * s + i * 4, y - 10 * s, x + 8 * s + i * 4, y); ctx.fill(); }
  }
  function icon(ctx, kind, x, y, P, t, s) { V.icons.draw(ctx, kind, x, y, P, t, s || 1); }
  function drawStations(ctx, P, L, S, retro, t, dk, hl) {
    var ST = L.ST, y0 = 0, y1 = -FH;
    // люк
    ctx.fillStyle = dk(P.woodD); ctx.fillRect(ST.hatch.x - 16, y0 - 40, 32, 40); ctx.fillStyle = dk(P.plank); ctx.fillRect(ST.hatch.x - 13, y0 - 37, 26, 37);
    ctx.fillStyle = dk(P.copper); ctx.fillRect(ST.hatch.x + 6, y0 - 22, 4, 4);
    // бункер
    ctx.fillStyle = dk(P.woodD); ctx.fillRect(ST.bunker.x - 22, y0 - 30, 44, 30); ctx.fillStyle = dk(P.wood); ctx.fillRect(ST.bunker.x - 20, y0 - 28, 40, 6);
    for (var b = 0; b < S.bunker.length; b++) { var it = S.bunker[b], bx = ST.bunker.x - 18 + (b % 4) * 10, by = y0 - 20 + Math.floor(b / 4) * 8;
      ctx.fillStyle = dk(it === 'coal' ? '#2a292e' : it === 'scrap' ? P.ironL : P.log); ctx.fillRect(bx, by, 9, 7); }
    // топка + котёл
    var fx = ST.furnace.x;
    ctx.fillStyle = dk(P.brick); ctx.fillRect(fx - 26, y0 - 44, 52, 44); ctx.fillStyle = dk('#6e3020'); for (var r = 0; r < 5; r++) ctx.fillRect(fx - 26, y0 - 44 + r * 9, 52, 1);
    ctx.fillStyle = '#1b1210'; ctx.fillRect(fx - 12, y0 - 26, 24, 18);
    if (S.F > 0) { var gl = Math.min(1, S.F / 50); ctx.fillStyle = 'rgba(255,' + (120 + gl * 80) + ',40,' + (0.4 + gl * 0.6) + ')'; ctx.fillRect(fx - 10, y0 - 22, 20, 14); flame(ctx, fx - 2, y0 - 9, t, 0.35 + gl * 0.25, retro); }
    // котёл: медный бак через перекрытие
    ctx.fillStyle = dk(P.copperD); ctx.fillRect(fx - 22, y1 - 34, 64, 34 + 14); ctx.fillStyle = dk(P.copper); ctx.fillRect(fx - 20, y1 - 32, 60, 44);
    ctx.fillStyle = dk(P.copperL); ctx.fillRect(fx - 20, y1 - 32, 60, 6);
    for (var rv = 0; rv < 4; rv++) { ctx.fillStyle = dk(P.copperD); ctx.fillRect(fx - 16 + rv * 16, y1 - 22, 3, 3); }
    // манометр на котле
    gauge(ctx, fx + 10, y1 - 8, 11, S.P / 100, P, retro);
    // клапан (вентиль-колесо) и труба
    var vx = ST.valve.x; ctx.fillStyle = dk(P.copperD); ctx.fillRect(fx + 40, y1 + 4, vx - fx - 40, 6); ctx.fillRect(vx - 3, y1 + 4, 6, 24);
    ctx.save(); ctx.translate(vx, y0 - 30); ctx.rotate(S._ventA || 0); ctx.strokeStyle = dk(P.iron); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke(); ctx.restore();
    if (S._venting) { for (var k = 0; k < 6; k++) { var a = (t * 4 + k / 6) % 1; ctx.fillStyle = 'rgba(245,245,245,' + (0.7 * (1 - a)) + ')'; ctx.beginPath(); ctx.arc(vx + 6 + a * 20, y1 + 4 - a * 30, 4 + a * 10, 0, 7); ctx.fill(); } }
    // рычаг хода: три положения
    var lx = ST.lever.x; ctx.fillStyle = dk(P.iron); ctx.fillRect(lx - 14, y0 - 10, 28, 10);
    for (var m = 0; m < 3; m++) { ctx.fillStyle = m === S.mode ? (m === 0 ? P.bad : m === 1 ? P.warn : P.good) : dk(P.ironL); ctx.fillRect(lx - 14 + m * 10, y0 - 46, 8, 5); }
    ctx.save(); ctx.translate(lx, y0 - 8); ctx.rotate(-0.6 + S.mode * 0.6); ctx.fillStyle = dk(P.ironL); ctx.fillRect(-2, -32, 4, 32); ctx.fillStyle = dk(P.copper); ctx.beginPath(); ctx.arc(0, -32, 5, 0, 7); ctx.fill(); ctx.restore();
    // верстак
    var wx = ST.bench.x; ctx.fillStyle = dk(P.woodD); ctx.fillRect(wx - 30, y1 - 22, 60, 6); ctx.fillRect(wx - 26, y1 - 16, 5, 16); ctx.fillRect(wx + 21, y1 - 16, 5, 16);
    ctx.fillStyle = dk(P.iron); ctx.fillRect(wx - 22, y1 - 30, 14, 8); ctx.fillStyle = dk(P.copperL); ctx.fillRect(wx + 4, y1 - 26, 16, 4);
    ctx.fillStyle = dk(P.ironL); ctx.fillRect(wx - 28, y1 - 50, 3, 18); ctx.fillRect(wx - 18, y1 - 48, 3, 16); ctx.fillRect(wx - 8, y1 - 50, 3, 18);   // инструменты на стене
    if (!S.water && S.mx > L.SHORE_X - 600) { for (var fw = 0; fw < S.prog.floatsWood; fw++) { ctx.fillStyle = dk(P.log); ctx.fillRect(wx - 26 + fw * 26, y1 - 32, 24, 8); } if (S.prog.floats > 0) { ctx.fillStyle = dk(P.copper); ctx.fillRect(wx - 30, y1 - 8, 60 * S.prog.floats / 100, 6); } }
    // балласт (после переделки — колесо клапана колокола; до — ящик)
    var bxx = ST.ballast.x;
    if (S.water) { ctx.fillStyle = dk(P.copperD); ctx.fillRect(bxx - 16, y1 - 8, 32, 8); ctx.save(); ctx.translate(bxx, y1 - 22); ctx.rotate(S.depth * 6); ctx.strokeStyle = dk(P.copperL); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke(); ctx.restore(); }
    else { ctx.fillStyle = dk(P.woodD); ctx.fillRect(bxx - 14, y1 - 18, 28, 18); ctx.fillStyle = dk(P.wood); ctx.fillRect(bxx - 12, y1 - 16, 24, 3); }
    // лебёдка
    var wcx = ST.winch.x; ctx.fillStyle = dk(P.iron); ctx.fillRect(wcx - 18, y1 - 6, 36, 6); ctx.fillRect(wcx - 16, y1 - 34, 4, 28); ctx.fillRect(wcx + 12, y1 - 34, 4, 28);
    ctx.save(); ctx.translate(wcx, y1 - 26); ctx.rotate(S._winchA || 0); ctx.fillStyle = dk(P.woodL); ctx.fillRect(-12, -8, 24, 16); ctx.fillStyle = dk(P.rope); ctx.fillRect(-12, -4, 24, 8); ctx.fillStyle = dk(P.ironL); ctx.fillRect(-2, -16, 4, 32); ctx.restore();
    // парус: стойка с фалом на чердаке
    var sx2 = ST.sail.x, ys = -2 * FH; ctx.fillStyle = dk(P.woodD); ctx.fillRect(sx2 - 4, ys - 40, 8, 40); ctx.fillStyle = dk(P.rope); ctx.fillRect(sx2 - 9, ys - 30, 18, 12); ctx.strokeStyle = dk(P.rope); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx2, ys - 40); ctx.lineTo(250, ys - 62); ctx.stroke();
    // подсветка цели героя
    if (hl) { var s = ST[hl.id] || null, hx = s ? s.x : hl.ref ? hl.ref.x : null, hf = s ? s.f : hl.ref ? hl.ref.f : 0;
      if (hx != null) { ctx.strokeStyle = 'rgba(255,214,140,.8)'; ctx.lineWidth = 2; ctx.setLineDash(retro ? [4, 4] : [5, 4]); ctx.strokeRect(hx - 26, -hf * FH - 52, 52, 50); ctx.setLineDash([]); } }
  }
  function gauge(ctx, x, y, r, k, P, retro) {
    ctx.fillStyle = '#f3ead5'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = P.copperD; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = P.warn; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r - 3, Math.PI * (0.75 + 1.5 * 0.85), Math.PI * (0.75 + 1.5)); ctx.stroke();
    ctx.strokeStyle = P.bad; ctx.beginPath(); ctx.arc(x, y, r - 3, Math.PI * (0.75 + 1.5 * 0.97), Math.PI * (0.75 + 1.5 * 1.06)); ctx.stroke();
    var a = Math.PI * (0.75 + 1.5 * Math.min(1.06, k)); ctx.strokeStyle = '#2a1d16'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2)); ctx.stroke();
  }
  function drawHero(ctx, P, S, t, retro) {
    var h = S.hero, x = h.x, y = -h.lv * FH, walk = (S._heroMoving ? Math.sin(t * 14) : 0), onLad = h.lad >= 0;
    ctx.save(); ctx.translate(x, y); if (h.face < 0 && !onLad) ctx.scale(-1, 1);
    // ноги
    ctx.fillStyle = P.boot; if (onLad) { ctx.fillRect(-5, -8 + walk * 2, 4, 8); ctx.fillRect(1, -8 - walk * 2, 4, 8); } else { ctx.fillRect(-4 + walk * 3, -8, 4, 8); ctx.fillRect(1 - walk * 3, -8, 4, 8); }
    // рубаха (индиго), фартук (кожа)
    ctx.fillStyle = P.shirt; ctx.fillRect(-6, -22, 12, 15); ctx.fillStyle = P.shirtD; ctx.fillRect(-6, -10, 12, 3);
    ctx.fillStyle = P.apron; ctx.fillRect(-4, -18, 9, 12);
    // руки
    var carry = h.carry, work = h.work > 0;
    ctx.fillStyle = P.shirt;
    if (carry) { ctx.fillRect(-7, -32, 3, 12); ctx.fillRect(4, -32, 3, 12); }
    else if (work) { var sw = Math.sin(t * 16) * 3; ctx.fillRect(5, -20 + sw, 7, 3); }
    else ctx.fillRect(5, -20, 3, 9);
    // голова и войлочная шапка
    ctx.fillStyle = P.skin; ctx.fillRect(-4, -30, 9, 8);
    ctx.fillStyle = P.cap; ctx.fillRect(-5, -34, 11, 5); ctx.fillRect(-3, -36, 7, 3);
    ctx.fillStyle = '#2b2018'; ctx.fillRect(2, -28, 2, 2);
    ctx.restore();
    if (carry) { // ноша над головой
      var cy = y - 40;
      if (carry === 'wood') { ctx.fillStyle = P.log; ctx.fillRect(x - 11, cy, 22, 7); ctx.fillStyle = P.woodL; ctx.fillRect(x + 9, cy + 1, 3, 5); }
      else if (carry === 'coal') { ctx.fillStyle = '#26252b'; ctx.beginPath(); ctx.arc(x, cy + 3, 6, 0, 7); ctx.fill(); }
      else if (carry === 'scrap') { ctx.fillStyle = P.ironL; ctx.fillRect(x - 8, cy, 16, 6); }
      else if (carry === 'patch') { ctx.fillStyle = P.copperL; ctx.fillRect(x - 8, cy - 1, 16, 9); ctx.fillStyle = P.copperD; ctx.fillRect(x - 6, cy + 1, 2, 2); ctx.fillRect(x + 4, cy + 1, 2, 2); ctx.fillRect(x - 6, cy + 5, 2, 2); ctx.fillRect(x + 4, cy + 5, 2, 2); }
    }
    if (h.work > 0) { ctx.strokeStyle = P.good; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 50, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, h.work)); ctx.stroke(); }
  }

  // ---------- Пиктограммы-подсказки над станциями (без слов) ----------
  function needs(S, L, game) {
    var out = [], h = S.hero;
    if (S.F < 22) out.push({ id: 'furnace', icon: S.bunker.length || h.carry ? 'log' : 'hatch' });
    if (S.P > 94) out.push({ id: 'valve', icon: 'steam' });
    if (game.pileNear() && !h.carry) out.push({ id: 'hatch', icon: 'hand' });
    var g = game.activeGate();
    if (g && Math.abs(S.v) < 3) {
      if (g.kind === 'gate') out.push({ id: 'winch', icon: g.steamOnly && S.P < 30 ? 'gauge' : 'winch' });
      else if (g.kind === 'shore') out.push(S.prog.floatsWood < 2 ? { id: 'bench', icon: 'log' } : S.prog.floats < 100 ? { id: 'bench', icon: 'hammer' } : { id: 'winch', icon: 'winch' });
    }
    if ((S.leaks.length || S.mastBroken) && h.carry !== 'patch') out.push({ id: 'bench', icon: 'patch' });
    if (S.mastBroken && h.carry === 'patch' && !S.leaks.length) out.push({ id: 'sail', icon: 'patch' });
    var E = S.env;
    if (E && E.storm > 0.2 && S.sailUp) out.push({ id: 'sail', icon: 'down' });
    if (E && E.wind > 0.3 && !S.sailUp && !S.mastBroken && E.storm < 0.1 && S.depth < 0.3) out.push({ id: 'sail', icon: 'wind', soft: true });
    if (S.water) { var sh = L.OBI.ice.sheets.find(function (q) { return q[0] > S.mx - 2; }); if (sh && sh[0] - S.mx < 500 && !S.dive) out.push({ id: 'ballast', icon: 'dive' });
      if (S.dive && !game.underIce() && S.air < 60) out.push({ id: 'ballast', icon: 'air' }); }
    if (g && g.kind !== 'shore' && Math.abs(S.v) > 3 && S.mode) out.push({ id: 'lever', icon: 'stop' });
    return out;
  }

  // ---------- HUD (только пиктограммы) ----------
  function bar(ctx, x, y, w, h, k, col, P, retro) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, Math.min(1, k)) * w, h);
    if (!retro) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, Math.max(0, Math.min(1, k)) * w, h / 3); }
  }
  function drawHud(ctx, P, L, S, retro, t) {
    var y = 10, x = 10;
    ctx.fillStyle = P.hud; if (retro) ctx.fillRect(x, y, 330, 58); else { ctx.beginPath(); rr(ctx, x, y, 330, 58, 12); ctx.fill(); }
    // давление
    gauge(ctx, x + 30, y + 30, 20, S.P / 100, P, retro);
    if (S.overT > 0) { ctx.fillStyle = 'rgba(240,80,50,' + (0.5 + 0.5 * Math.sin(t * 20)) + ')'; ctx.fillRect(x + 8, y + 50, 44 * Math.min(1, S.overT / 2.5), 4); }
    // огонь в топке
    icon(ctx, 'flame', x + 66, y + 18, P, t, 0.8); bar(ctx, x + 80, y + 12, 70, 10, S.F / 100, S.F < 22 ? P.bad : P.warn, P, retro);
    // корпус
    icon(ctx, 'hut', x + 66, y + 40, P, t, 0.8); bar(ctx, x + 80, y + 34, 70, 10, S.hull / 100, S.hull < 35 ? P.bad : P.good, P, retro);
    // режим хода
    for (var m = 1; m <= 2; m++) { ctx.fillStyle = S.mode >= m ? P.hudInk : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(x + 162 + m * 12, y + 14); ctx.lineTo(x + 170 + m * 12, y + 22); ctx.lineTo(x + 162 + m * 12, y + 30); ctx.closePath(); ctx.fill(); }
    if (S.mode === 0) { ctx.fillStyle = P.bad; ctx.fillRect(x + 172, y + 14, 6, 16); ctx.fillRect(x + 184, y + 14, 6, 16); }
    // ветер
    var w = S.env ? S.env.wind : 0; ctx.save(); ctx.translate(x + 182, y + 44); ctx.strokeStyle = w >= 0 ? P.good : P.bad; ctx.lineWidth = 3; ctx.beginPath(); var len = 4 + Math.abs(w) * 16, d = w >= 0 ? 1 : -1;
    ctx.moveTo(-len * d, 0); ctx.lineTo(len * d, 0); ctx.lineTo(len * d - 6 * d, -5); ctx.moveTo(len * d, 0); ctx.lineTo(len * d - 6 * d, 5); ctx.stroke(); ctx.restore();
    // бункер
    icon(ctx, 'log', x + 222, y + 18, P, t, 0.8); for (var b = 0; b < L.CAP.bunker; b++) { ctx.fillStyle = b < S.bunker.length ? P.woodL : 'rgba(255,255,255,.15)'; ctx.fillRect(x + 236 + b * 11, y + 13, 8, 10); }
    // воздух (на воде)
    if (S.water) { icon(ctx, 'air', x + 222, y + 40, P, t, 0.8); bar(ctx, x + 236, y + 34, 86, 10, S.air / 100, S.air < 30 ? P.bad : '#8fd0ef', P, retro); }
    else { icon(ctx, 'speed', x + 222, y + 40, P, t, 0.8); bar(ctx, x + 236, y + 34, 86, 10, Math.abs(S.v) / 70, P.hudInk, P, retro); }
    // путь: 6 участков
    var px = 380, pw = 400, py = 18;
    ctx.fillStyle = P.hud; if (retro) ctx.fillRect(px - 10, py - 8, pw + 20, 30); else { ctx.beginPath(); rr(ctx, px - 10, py - 8, pw + 20, 30, 12); ctx.fill(); }
    var icons = ['tree', 'hill', 'river', 'shore', 'wave', 'ice'];
    for (var i = 0; i < 6; i++) { var a = L.SEC[i] / L.FIN_X, bb = Math.min(1, L.SEC[i + 1] / L.FIN_X); ctx.fillStyle = i <= S.sec ? 'rgba(240,160,75,.55)' : 'rgba(255,255,255,.12)'; ctx.fillRect(px + a * pw + 1, py + 4, (bb - a) * pw - 2, 6); icon(ctx, icons[i], px + (a + bb) / 2 * pw, py - 1, P, t, 0.55); }
    var k = Math.min(1, S.mx / L.FIN_X); ctx.fillStyle = P.hudInk; ctx.beginPath(); ctx.moveTo(px + k * pw, py + 2); ctx.lineTo(px + k * pw - 5, py + 16); ctx.lineTo(px + k * pw + 5, py + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.accent; ctx.fillRect(px + pw - 2, py, 4, 14);
  }
  function rr(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawWeather(ctx, E, t, retro, S) {
    if (E.weather === 'rain') { ctx.strokeStyle = 'rgba(200,215,230,.35)'; ctx.lineWidth = 1; ctx.beginPath(); for (var i = 0; i < 90; i++) { var x = (hsh(i) * W + t * 60) % W, y = (hsh(i + 9) * H + t * 520) % H; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); } ctx.stroke(); }
    if (E.weather === 'storm' && E.storm > 0.1) { ctx.strokeStyle = 'rgba(210,220,230,' + 0.45 * E.storm + ')'; ctx.lineWidth = retro ? 2 : 1.3; ctx.beginPath(); for (var j = 0; j < 140; j++) { var x2 = (hsh(j) * W - t * 260) % W + W, y2 = (hsh(j + 9) * H + t * 640) % H; ctx.moveTo(x2 % W, y2); ctx.lineTo(x2 % W + 10, y2 + 14); } ctx.stroke();
      if (Math.sin(t * 0.7) > 0.995) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 0, W, H); } }
    if (E.weather === 'snow' || E.sec === 0 && E.tod < 0.06) { ctx.fillStyle = 'rgba(255,255,255,.75)'; for (var k = 0; k < (E.weather === 'snow' ? 80 : 20); k++) { var x3 = (hsh(k) * W + Math.sin(t + k) * 20 + t * 15) % W, y3 = (hsh(k + 5) * H + t * 40) % H; ctx.fillRect(x3, y3, retro ? 2 : 2.2, retro ? 2 : 2.2); } }
    if (S.depth > 0.3) { ctx.fillStyle = 'rgba(10,40,60,' + (S.depth - 0.3) * 0.25 + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function scene(ctx, S, g, o, retro) {
    var L = V.logic, P = retro ? PAL.retro : PAL.modern, t = S.t, E = S.env || L.env(S.mx, t), dt = o.dt || 0.016;
    var geo = machineGeom(S, L, t); updCam(S, L, geo, dt);
    drawSky(ctx, P, E, retro, t); drawFar(ctx, P, E, L, retro, S);
    drawSea(ctx, P, E, L, S, retro, t, false);
    drawGround(ctx, P, E, L, S, retro, t);
    drawProps(ctx, P, E, L, S, retro, t);
    drawMachine(ctx, P, E, L, S, retro, t, geo, o.title ? null : S.hint);
    if (S.water) drawSea(ctx, P, E, L, S, retro, t, true);
    drawWeather(ctx, E, t, retro, S);
    if (!o.title && o.game) { // пиктограммы над станциями
      var ns = needs(S, L, o.game), shown = {};
      ns.forEach(function (n) {
        if (shown[n.id]) return; shown[n.id] = 1; var s = L.ST[n.id];
        var p = toScreen(geo, s.x, -s.f * FH - 70), bob = Math.sin(t * 4) * 3;
        ctx.save(); ctx.globalAlpha = n.soft ? 0.6 : 0.95; V.icons.bubble(ctx, n.icon, p.x, p.y + bob, P, t, retro); ctx.restore();
      });
      S.fires.forEach(function (f) { var p = toScreen(geo, f.x, -f.f * FH - 70); V.icons.bubble(ctx, 'bucket', p.x, p.y + Math.sin(t * 6) * 3, P, t, retro); });
    }
    return { P: P, geo: geo };
  }
  function toScreen(geo, lx, ly) { var c = Math.cos(geo.ang), s = Math.sin(geo.ang); return { x: sx(geo.rear) + lx * c - ly * s, y: sy(geo.y0) + lx * s + ly * c }; }

  var lastGeo = null;
  V.render = {
    W: W, H: H, PAL: PAL,
    draw: function (ctx, S, g, o) {
      o = o || {}; var retro = g.themeName === 'retro', res;
      if (retro && offscreen()) {
        var oc = offCtx; oc.save(); oc.imageSmoothingEnabled = false; oc.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0); res = scene(oc, S, g, o, true); oc.restore();
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,.16)'; for (var yy = 0; yy < H; yy += 3) ctx.fillRect(0, yy, W, 1);   // строки развёртки
        ctx.restore();
      } else res = scene(ctx, S, g, o, retro);
      lastGeo = res.geo;
      if (!o.title) drawHud(ctx, res.P, V.logic, S, retro, S.t);
      return res;
    },
    // экран (канва) → {f, x} внутри избы, либо null
    toLocal: function (S, px, py) {
      if (!lastGeo) return null; var geo = lastGeo, c = Math.cos(-geo.ang), s = Math.sin(-geo.ang);
      var dx = px - sx(geo.rear), dy = py - sy(geo.y0), lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (lx < -20 || lx > V.logic.MW + 20 || ly > 20 || ly < -3 * FH - 30) return null;
      var f = Math.max(0, Math.min(2, Math.floor(-ly / FH))); return { f: f, x: lx };
    },
    resetCam: function () { cam.init = false; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
