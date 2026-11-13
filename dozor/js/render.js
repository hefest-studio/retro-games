/* ДОЗОР · общий рендер мира (поле, реки, стены, дома, бараки, площадки, крепость, броневики, враги артели,
   поезд, пленные, снаряды, взрывы). Один рендер на обе темы: палитра P = DOZOR.modern | DOZOR.classic.
   В retro (P.pixel) — без градиентов и мягких теней, мир рисуется в буфер половинного размера (ui.js).
   world(ctx, S, P, time) рисует в мировых координатах: вызывающий уже сдвинул ctx на (0, −camY). DOZOR.render */
(function (global) {
  'use strict';
  var D = global.DOZOR = global.DOZOR || {};
  var PI = Math.PI;

  function hash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function hex2(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function shade(c, f) {
    if (!c || c[0] !== '#' || c.length !== 7) return c; var a = hex2(c), t = function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); };
    return f < 1 ? '#' + t(a[0] * f) + t(a[1] * f) + t(a[2] * f) : '#' + t(a[0] + (255 - a[0]) * (f - 1)) + t(a[1] + (255 - a[1]) * (f - 1)) + t(a[2] + (255 - a[2]) * (f - 1));
  }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, PI * 2); ctx.fill(); }
  function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, PI * 2); ctx.fill(); }
  function line(ctx, x1, y1, x2, y2, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function rrect(ctx, x, y, w, h, r, c) {
    ctx.fillStyle = c; r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function box(ctx, P, x, y, w, h, c, r) { if (P.pixel) rect(ctx, Math.round(x), Math.round(y), Math.round(w), Math.round(h), c); else rrect(ctx, x, y, w, h, r == null ? 3 : r, c); }
  function shadow(ctx, P, x, y, rx, ry) { if (P.pixel) return; ell(ctx, x + 3, y + 4, rx, ry, P.shadow); }

  // ---------- Поле ----------
  function tiles(ctx, S, P, time) {
    var L = D.logic, T = L.T, C = L.CELL, W = L.COLS;
    var r0 = Math.max(0, Math.floor(S.camY / T) - 1), r1 = Math.min(S.H - 1, Math.floor((S.camY + L.VIEW_H) / T) + 1);
    var g0 = P.ground[S.name] || P.ground.sand;
    rect(ctx, 0, r0 * T, W * T, (r1 - r0 + 1) * T, g0);
    var c, r, i, t, x, y, h;
    // 1-й проход — плоское: трава/песок, дорога, вода, мост, рельсы, щебень, площадки
    for (r = r0; r <= r1; r++) for (c = 0; c < W; c++) {
      i = r * W + c; t = S.grid[i]; x = c * T; y = r * T; h = hash(i * 7 + S.stage);
      if (t === C.G && h < 0.07) {   // пятна грунта и воронки
        if (P.pixel) rect(ctx, x + 2, y + 4, 20, 14, shade(g0, 0.92));
        else ell(ctx, x + 12, y + 12, 16 + h * 60, 10 + h * 40, shade(g0, 0.94));
        if (h < 0.025) { circ(ctx, x + 12, y + 12, 7, shade(g0, 0.78)); circ(ctx, x + 11, y + 11, 4, shade(g0, 0.68)); }
      }
      if (t === C.G || t === C.PAD || breakableBase(t, C)) {
        if (h < 0.35) rect(ctx, x + Math.floor(h * 40) % 20, y + Math.floor(h * 97) % 20, P.pixel ? 2 : 3, 2, shade(g0, 0.86));
        else if (h > 0.85) rect(ctx, x + Math.floor(h * 53) % 18, y + Math.floor(h * 71) % 18, 2, P.pixel ? 2 : 3, shade(g0, 1.12));
      }
      if (t === C.ROAD) { rect(ctx, x, y, T, T, P.road); if (h < 0.4) rect(ctx, x + 6, y + 8, 3, 2, shade(P.road, 0.88)); }
      else if (t === C.RUBBLE) { rect(ctx, x + 2, y + 2, T - 4, T - 4, shade(g0, 0.8)); for (var k = 0; k < 4; k++) rect(ctx, x + 3 + hash(i + k) * 15, y + 3 + hash(i * 3 + k) * 15, 4, 3, P.rubble); }
      else if (t === C.WATER) {
        rect(ctx, x, y, T, T, P.water);
        var wv = Math.floor((time * 18 + c * 7 + r * 11) % 24);
        rect(ctx, x + (wv % 16), y + (r % 2 ? 6 : 15), 6, 2, P.waterLight);
        if (S.grid[i - W] !== C.WATER && S.grid[i - W] !== C.BRIDGE) rect(ctx, x, y, T, 3, P.waterDeep);
      } else if (t === C.BRIDGE) {
        rect(ctx, x, y, T, T, P.water); rect(ctx, x + 1, y, T - 2, T, P.bridge);
        for (var p = 0; p < 4; p++) rect(ctx, x + 1, y + p * 6 + 1, T - 2, 4, P.plank);
        var lc = c > 0 && S.grid[i - 1] === C.BRIDGE, rc = c < W - 1 && S.grid[i + 1] === C.BRIDGE;
        if (!lc) rect(ctx, x, y, 3, T, P.sleeper); if (!rc) rect(ctx, x + T - 3, y, 3, T, P.sleeper);
      } else if (t === C.RAIL) {
        for (var s = 0; s < 3; s++) rect(ctx, x + s * 8 + 1, y + 3, 5, T - 6, P.sleeper);
        rect(ctx, x, y + 6, T, 2, P.railMetal); rect(ctx, x, y + T - 8, T, 2, P.railMetal);
      }
    }
    // 2-й проход — объёмное: стены, скалы, дома, деревья, мешки
    for (r = r0; r <= r1; r++) for (c = 0; c < W; c++) {
      i = r * W + c; t = S.grid[i]; x = c * T; y = r * T; h = hash(i * 13 + 5);
      if (t === C.WALL) {
        rect(ctx, x, y, T, T, P.wall); rect(ctx, x, y, T, 6, P.wallTop); rect(ctx, x, y + T - 3, T, 3, P.wallDark);
        rect(ctx, x + (r % 2 ? 11 : 4), y + 8, 2, T - 11, P.wallDark);
      } else if (t === C.ROCK) {
        if (!P.pixel) ell(ctx, x + 14, y + 16, 11, 9, P.shadow);
        box(ctx, P, x + 2, y + 3, T - 4, T - 5, P.rock, 8); box(ctx, P, x + 5, y + 4, T - 12, 7, P.rockTop, 4);
      } else if (t === C.BLD) {
        var hp = S.hp[i] / 5;
        rect(ctx, x, y, T, T, P.bldWall); rect(ctx, x + 2, y + 2, T - 4, T - 6, P.roof); rect(ctx, x + 2, y + 2, T - 4, 5, P.roofTop);
        if (S.grid[i + 1] === C.BLD) rect(ctx, x + T - 2, y + 2, 2, T - 6, P.roof);
        if (S.grid[i + W] === C.BLD) rect(ctx, x + 2, y + T - 4, T - 4, 4, P.roof);
        if (hp < 0.7) { rect(ctx, x + 6, y + 9, 5, 4, P.rubble); }
        if (hp < 0.4) { rect(ctx, x + 13, y + 13, 6, 5, P.rubble); }
      } else if (t === C.TREE) {
        shadow(ctx, P, x + 12, y + 14, 11, 8);
        if (P.pixel) { rect(ctx, x + 3, y + 3, 18, 18, P.tree); rect(ctx, x + 6, y + 5, 9, 7, P.treeTop); rect(ctx, x + 14, y + 15, 5, 4, P.treeDark); }
        else { circ(ctx, x + 12, y + 12, 11, P.tree); circ(ctx, x + 9 + h * 4, y + 9, 6, P.treeTop); circ(ctx, x + 16, y + 16, 3, P.treeDark); }
      } else if (t === C.SAND) {
        for (var q = 0; q < 2; q++) for (var u = 0; u < 3; u++) box(ctx, P, x + u * 8 - (q ? 0 : 4) + 4, y + 5 + q * 8, 8, 7, (q + u) % 2 ? P.sandbag : shade(P.sandbag, 0.92), 3);
        rect(ctx, x + 2, y + T - 4, T - 4, 2, P.sandbagDark);
      }
    }
  }
  function breakableBase(t, C) { return t === C.BLD || t === C.TREE || t === C.SAND; }

  // ---------- Объекты ----------
  function pad(ctx, P, pd, time) {
    var x = pd.x, y = pd.y, R = 34;
    box(ctx, P, x - R, y - R, 2 * R, 2 * R, P.pad, 6);
    if (P.pixel) { rect(ctx, x - 26, y - 26, 52, 2, P.padRing); rect(ctx, x - 26, y + 24, 52, 2, P.padRing); rect(ctx, x - 26, y - 26, 2, 52, P.padRing); rect(ctx, x + 24, y - 26, 2, 52, P.padRing); }
    else { ctx.strokeStyle = P.padRing; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 25, 0, PI * 2); ctx.stroke(); }
    // знак площадки — крест-шестерёнка студии (не буква)
    rect(ctx, x - 12, y - 3, 24, 6, P.padMark); rect(ctx, x - 3, y - 12, 6, 24, P.padMark);
    var blink = (time * 2) % 1 < 0.5;
    [[-30, -30], [26, -30], [-30, 26], [26, 26]].forEach(function (o) { rect(ctx, x + o[0], y + o[1], 4, 4, blink ? P.padMark : shade(P.pad, 1.3)); });
    if (pd.heliT > 0) rescueHeli(ctx, P, x, y - 4 - Math.max(0, pd.heliT - 2) * 60, time);
  }
  function rescueHeli(ctx, P, x, y, time) {
    shadow(ctx, P, x, y + 10, 18, 8);
    box(ctx, P, x - 10, y - 14, 20, 30, P.rescue, 9); rect(ctx, x - 10, y - 2, 20, 4, P.rescueStripe);
    box(ctx, P, x - 6, y - 12, 12, 8, P.waterLight, 4);
    rect(ctx, x - 2, y + 14, 4, 18, P.rescue); rect(ctx, x - 6, y + 30, 12, 3, P.rescueStripe);
    var a = time * 22;
    for (var k = 0; k < 2; k++) { var aa = a + k * PI / 2; line(ctx, x - Math.cos(aa) * 30, y - Math.sin(aa) * 30, x + Math.cos(aa) * 30, y + Math.sin(aa) * 30, P.pixel ? 2 : 2.5, P.metalDark); }
  }
  function barracks(ctx, P, b, time) {
    var x = b.x - 24, y = b.y - 24;
    if (!P.pixel) rect(ctx, x + 4, y + 6, 48, 46, P.shadow);
    var fl = b.flash > 0;
    box(ctx, P, x + 1, y + 1, 46, 46, fl ? '#ffffff' : P.barracks, 4);
    rect(ctx, x + 3, y + 3, 42, 18, P.barracksRoof); rect(ctx, x + 3, y + 21, 42, 3, shade(P.barracksRoof, 0.7));
    for (var k = 0; k < 4; k++) rect(ctx, x + 6 + k * 10, y + 5, 2, 14, shade(P.barracksRoof, 1.25));
    rect(ctx, x + 18, y + 32, 12, 14, P.barracksDoor); rect(ctx, x + 5, y + 30, 8, 6, P.barracksDoor); rect(ctx, x + 35, y + 30, 8, 6, P.barracksDoor);
    // решётка на окнах — внутри пленные
    rect(ctx, x + 8, y + 30, 1, 6, P.metalLight); rect(ctx, x + 38, y + 30, 1, 6, P.metalLight);
    var dmg = 1 - b.hp / b.max;
    if (dmg > 0.3) rect(ctx, x + 10, y + 8, 7, 5, P.rubble);
    if (dmg > 0.6) { rect(ctx, x + 28, y + 12, 9, 6, P.rubble); rect(ctx, x + 22, y + 24, 5, 4, P.rubble); }
    if (b.flag) {
      rect(ctx, x + 44, y - 14, 2, 22, P.metalDark);
      var on = (time * 3) % 1 < 0.6;
      rect(ctx, x + 46, y - 14, 12, 8, on ? P.flag : shade(P.flag, 0.6)); rect(ctx, x + 49, y - 12, 5, 4, P.rustDark);
    }
  }
  function core(ctx, P, B, time) {
    var x = B.x0, y = B.y0, w = B.x1 - B.x0, h = B.y1 - B.y0, fl = B.flash > 0 || B.shift > 0 && (time * 12) % 1 < 0.5;
    rect(ctx, x, y, w, h, fl ? '#ffffff' : P.core); rect(ctx, x, y, w, 8, P.coreTop); rect(ctx, x, y + h - 4, w, 4, P.coreDark);
    for (var k = 0; k < 6; k++) rect(ctx, x + 6 + k * 23, y + 12, 3, h - 22, P.coreDark);
    // зев печи — светится, тускнеет с уроном
    var hp = B.max ? B.hp / B.max : 1, gl = 0.6 + 0.4 * Math.sin(time * (4 + B.phase * 3));
    box(ctx, P, B.x - 26, y + h - 30, 52, 24, P.coreDark, 6);
    box(ctx, P, B.x - 20, y + h - 26, 40, 16, gl > 0.7 ? P.coreGlow : shade(P.coreGlow, 0.7 + 0.3 * hp), 4);
    for (var j = 0; j < 3; j++) rect(ctx, B.x - 18 + j * 14, y + h - 26, 3, 16, P.coreDark);
    // трубы
    [x + 14, x + w - 22].forEach(function (cx, i) {
      rect(ctx, cx, y - 30, 10, 32, P.metalDark); rect(ctx, cx - 2, y - 32, 14, 5, P.metal);
      if (!B.dead) { var s = (time * 0.8 + i * 0.5) % 1; circ(ctx, cx + 5 + s * 6, y - 36 - s * 22, 4 + s * 6, P.pixel ? P.rubble : 'rgba(90,80,75,' + (0.6 - s * 0.5) + ')'); }
    });
    if (hp < 0.66) rect(ctx, x + 30, y + 14, 12, 8, P.rubble);
    if (hp < 0.33) { rect(ctx, x + w - 46, y + 18, 14, 9, P.rubble); rect(ctx, x + 60, y + 26, 8, 6, P.coreGlow); }
  }
  function pow(ctx, P, p, time) {
    var x = p.x, y = p.y, wv = Math.sin(time * 10 + p.wander * 3) > 0;
    shadow(ctx, P, x, y + 4, 4, 2);
    rect(ctx, x - 3, y - 2, 6, 7, P.powShirt);
    rect(ctx, x - 2, y - 7, 5, 5, P.pow);
    if (p.master) rect(ctx, x - 3, y - 9, 7, 3, P.powCap);
    rect(ctx, wv ? x - 6 : x - 5, wv ? y - 7 : y - 1, 2, 5, P.pow); rect(ctx, wv ? x + 4 : x + 3, wv ? y - 1 : y - 7, 2, 5, P.pow);
  }
  function hero(ctx, P, h, time) {
    if (!h.alive) return;
    if (h.inv > 0 && (time * 10) % 1 < 0.25) return;
    var i = h.id, x = h.x, y = h.y;
    shadow(ctx, P, x, y, 14, 15);
    ctx.save(); ctx.translate(x, y); ctx.rotate(h.ang);
    var sp = h.moving ? Math.floor(time * 20) % 2 : 0;
    // колёса
    [[-12, -11], [7, -11], [-12, 5], [7, 5]].forEach(function (o) { rect(ctx, o[0], o[1], 5, 8, P.tire); if (sp) rect(ctx, o[0] + 1, o[1] + 2, 3, 2, P.metalDark); });
    box(ctx, P, -9, -15, 18, 30, P.heroDark[i], 4);
    box(ctx, P, -8, -14, 16, 27, P.hero[i], 4);
    rect(ctx, -6, -14, 12, 4, P.heroLight[i]);           // нос с фарами
    rect(ctx, -7, -15, 3, 2, P.warn); rect(ctx, 4, -15, 3, 2, P.warn);
    rect(ctx, -6, 8, 12, 4, P.heroDark[i]);               // корма
    rect(ctx, -2, -3, 4, 13, P.heroDark[i]);
    ctx.restore();
    // пулемётная башенка — всегда смотрит вверх
    circ(ctx, x, y + 1, 5.5, P.gun); rect(ctx, x - 1.5, y - 13, 3, 12, P.gun);
    circ(ctx, x, y + 1, 2.5, P.heroLight[i]);
    if (h.carried) { rect(ctx, x + 9, y + 9, 9, 9, P.panel); ctx.fillStyle = P.powCap; ctx.font = '700 9px ' + P.font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(h.carried), x + 13.5, y + 17); }
  }
  function enemy(ctx, P, e, time) {
    var x = e.x, y = e.y, fl = e.flash > 0, warn = e.warn > 0 && (time * 16) % 1 < 0.6;
    var body = fl ? '#ffffff' : P.rust;
    if (e.type === 'infantry') {
      var st = Math.floor((time * 6 + x) % 2);
      shadow(ctx, P, x, y + 4, 5, 3);
      rect(ctx, x - 4, y - 1 + st, 3, 6, P.metalDark); rect(ctx, x + 1, y - st, 3, 6, P.metalDark);
      box(ctx, P, x - 5, y - 6, 10, 9, body, 3);
      rect(ctx, x - 3, y - 10, 6, 5, fl ? '#ffffff' : P.metal);
      rect(ctx, x - 2, y - 9, 4, 2, warn ? P.warn : P.eye);
      var a = Math.atan2(e.aimY || 1, e.aimX || 0);
      line(ctx, x + 3, y - 2, x + 3 + Math.cos(a) * 7, y - 2 + Math.sin(a) * 7, 2, P.metalDark);
    } else if (e.type === 'turret' || e.type === 'cannon') {
      var big = e.type === 'cannon';
      shadow(ctx, P, x, y, 12, 11);
      box(ctx, P, x - 11, y - 11, 22, 22, fl ? '#ffffff' : (big ? P.metalDark : P.metal), 4);
      rect(ctx, x - 9, y - 9, 18, 3, P.metalLight);
      circ(ctx, x, y, big ? 8 : 7, body);
      var a2 = e.ang;
      line(ctx, x, y, x + Math.cos(a2) * (big ? 16 : 13), y + Math.sin(a2) * (big ? 16 : 13), big ? 5 : 4, P.metalDark);
      circ(ctx, x, y, 3, warn ? P.warn : P.eye);
    } else if (e.type === 'tank') {
      shadow(ctx, P, x, y, 15, 16);
      ctx.save(); ctx.translate(x, y);
      rect(ctx, -15, -14, 6, 28, P.tire); rect(ctx, 9, -14, 6, 28, P.tire);
      for (var k = 0; k < 4; k++) { rect(ctx, -15, -12 + k * 7 + (Math.floor(time * 8) % 2) * 3, 6, 2, P.metalDark); rect(ctx, 9, -12 + k * 7 + (Math.floor(time * 8) % 2) * 3, 6, 2, P.metalDark); }
      box(ctx, P, -10, -13, 20, 26, fl ? '#ffffff' : P.rustDark, 3); rect(ctx, -9, -12, 18, 4, P.rust);
      ctx.restore();
      circ(ctx, x, y, 7.5, body); line(ctx, x, y, x + Math.cos(e.ang) * 17, y + Math.sin(e.ang) * 17, 5, P.metalDark);
      circ(ctx, x, y, 3, warn ? P.warn : P.metalDark);
    } else if (e.type === 'boat') {
      var dir = e.vx >= 0 ? 1 : -1;
      if (!P.pixel) ell(ctx, x - dir * 18, y, 10, 4, 'rgba(255,255,255,.35)'); else rect(ctx, x - dir * 22 - 4, y - 2, 8, 4, P.waterLight);
      ctx.fillStyle = fl ? '#ffffff' : P.rustDark; ctx.beginPath(); ctx.moveTo(x + dir * 16, y); ctx.lineTo(x + dir * 6, y - 8); ctx.lineTo(x - dir * 14, y - 8); ctx.lineTo(x - dir * 14, y + 8); ctx.lineTo(x + dir * 6, y + 8); ctx.closePath(); ctx.fill();
      rect(ctx, x - 8, y - 5, 10, 10, P.metal); circ(ctx, x + dir * 5, y, 4, body);
      line(ctx, x + dir * 5, y, x + dir * 5 + Math.cos(e.ang) * 10, y + Math.sin(e.ang) * 10, 3, P.metalDark);
      circ(ctx, x - 3, y, 2, warn ? P.warn : P.eye);
    } else if (e.type === 'heli') {
      if (!P.pixel) ell(ctx, x + 18, y + 34, 14, 7, P.shadow); else rect(ctx, x + 6, y + 30, 22, 6, '#00000055');
      box(ctx, P, x - 9, y - 12, 18, 24, fl ? '#ffffff' : P.rustDark, 8);
      rect(ctx, x - 2, y + 10, 4, 18, P.rustDark); rect(ctx, x - 7, y + 26, 14, 3, P.rust);
      box(ctx, P, x - 6, y - 10, 12, 9, P.metalLight, 4);
      rect(ctx, x - 13, y - 2, 4, 8, P.metalDark); rect(ctx, x + 9, y - 2, 4, 8, P.metalDark);
      circ(ctx, x, y + 4, 2.5, warn ? P.warn : P.eye);
      var ra = time * 26;
      for (var j = 0; j < 2; j++) { var aa = ra + j * PI / 2; line(ctx, x - Math.cos(aa) * 26, y - Math.sin(aa) * 26, x + Math.cos(aa) * 26, y + Math.sin(aa) * 26, 2, P.metalDark); }
    }
  }
  function train(ctx, P, tr, time) {
    if (!tr.cars || tr.state !== 'run') return;
    var CAR = D.logic.CAR, y = tr.y;
    tr.cars.forEach(function (cr, k) {
      if (cr.dead) { if (cr.x > -60 && cr.x < 540) { rect(ctx, cr.x - CAR.w / 2, y - 9, CAR.w, 18, P.rubble); } return; }
      var x = cr.x - CAR.w / 2, fl = cr.flash > 0;
      if (!P.pixel) rect(ctx, x + 3, y - CAR.h / 2 + 5, CAR.w, CAR.h, P.shadow);
      box(ctx, P, x, y - CAR.h / 2, CAR.w, CAR.h, fl ? '#ffffff' : (k === 0 ? P.rustDark : P.metalDark), 3);
      rect(ctx, x + 3, y - CAR.h / 2 + 2, CAR.w - 6, 4, k === 0 ? P.rust : P.metal);
      for (var r = 0; r < 4; r++) rect(ctx, x + 8 + r * 16, y - 3, 6, 6, P.metal);
      if (k === 0) { var fx = tr.dir > 0 ? x + CAR.w - 6 : x; rect(ctx, fx, y - 8, 6, 16, P.warn); }
      circ(ctx, cr.x, y, 5, P.rust); circ(ctx, cr.x, y, 2, cr.warn > 0 && (time * 16) % 1 < 0.6 ? P.warn : P.eye);
    });
  }
  function trainSignal(ctx, P, tr, time) {
    if (tr.done) return;
    var on = tr.state === 'warn' || tr.state === 'run', bl = on && (time * 4) % 1 < 0.5;
    [6, 474].forEach(function (x) { rect(ctx, x - 2, tr.y - 22, 4, 12, P.metalDark); circ(ctx, x, tr.y - 24, 4, bl ? P.ebullet : P.metal); });
  }
  function bullets(ctx, P, S, time) {
    S.bullets.forEach(function (b) { rect(ctx, b.x - 1.5, b.y - 5, 3, 8, P.bullet); });
    S.shots.forEach(function (s) {
      var W = D.logic.SEC[s.tier];
      if (W.name === 'grenade') {
        var f = s.d / s.range, hgt = Math.sin(f * PI) * 14;   // дуга: тень на земле, граната — выше
        circ(ctx, s.x, s.y, 3, P.shadow === 'rgba(0,0,0,.28)' ? 'rgba(0,0,0,.3)' : P.metalDark);
        circ(ctx, s.x, s.y - hgt, 4 + hgt * 0.12, P.grenade); rect(ctx, s.x - 1, s.y - hgt - 4, 2, 2, P.metalLight);
      } else {
        var a = Math.atan2(s.vy, s.vx);
        line(ctx, s.x - Math.cos(a) * 9, s.y - Math.sin(a) * 9, s.x - Math.cos(a) * 16, s.y - Math.sin(a) * 16, 3, P.flame);
        line(ctx, s.x, s.y, s.x - Math.cos(a) * 9, s.y - Math.sin(a) * 9, 4, s.tier === 3 ? P.padMark : P.rocket);
      }
    });
    S.ebullets.forEach(function (b) {
      if (!P.pixel) circ(ctx, b.x, b.y, b.r + 3, P.eglow);
      if (P.pixel) rect(ctx, Math.round(b.x - b.r), Math.round(b.y - b.r), b.r * 2, b.r * 2, b.kind === 'shell' ? P.shell : P.ebullet);
      else circ(ctx, b.x, b.y, b.r, b.kind === 'shell' ? P.shell : P.ebullet);
    });
  }
  function marks(ctx, P, S, time) {
    S.marks.forEach(function (m) {
      var f = 1 - m.t / m.max, on = (time * (6 + f * 10)) % 1 < 0.6;
      ctx.strokeStyle = on ? P.mark : P.warn; ctx.lineWidth = 2;
      if (P.pixel) { rect(ctx, m.x - 14, m.y - 1, 28, 2, on ? P.mark : P.warn); rect(ctx, m.x - 1, m.y - 14, 2, 28, on ? P.mark : P.warn); }
      else { ctx.beginPath(); ctx.arc(m.x, m.y, 26 * (1 - f * 0.4), 0, PI * 2); ctx.stroke(); line(ctx, m.x - 8, m.y, m.x + 8, m.y, 2, P.mark); line(ctx, m.x, m.y - 8, m.x, m.y + 8, 2, P.mark); }
      var sy = m.y - 140 * (1 - f); circ(ctx, m.x, sy, 4, P.shell);
    });
  }
  function booms(ctx, P, S) {
    S.booms.forEach(function (b) {
      var f = 1 - b.t / b.max, r = b.r * (0.4 + f * 0.8);
      if (P.pixel) { var k = Math.min(3, Math.floor(f * 4)); rect(ctx, Math.round(b.x - r), Math.round(b.y - r), Math.round(r * 2), Math.round(r * 2), P.boom[k]); if (k < 2) rect(ctx, Math.round(b.x - r / 2), Math.round(b.y - r / 2), Math.round(r), Math.round(r), P.boom[k + 1]); return; }
      ctx.globalAlpha = Math.max(0, 1 - f * 0.9);
      circ(ctx, b.x, b.y, r, P.boom[2]); circ(ctx, b.x, b.y, r * 0.7, P.boom[1]); circ(ctx, b.x, b.y, r * 0.35 * (1 - f), P.boom[0]);
      ctx.globalAlpha = 1;
    });
  }

  function world(ctx, S, P, time) {
    tiles(ctx, S, P, time);
    S.trains.forEach(function (tr) { trainSignal(ctx, P, tr, time); });
    S.pads.forEach(function (pd) { if (pd.y > S.camY - 60 && pd.y < S.camY + 660) pad(ctx, P, pd, time); });
    marks(ctx, P, S, time);
    S.barracks.forEach(function (b) { if (!b.dead && b.y > S.camY - 60 && b.y < S.camY + 660) barracks(ctx, P, b, time); });
    if (S.boss && S.camY < S.boss.y1 + 40) core(ctx, P, S.boss, time);
    S.pows.forEach(function (p) { pow(ctx, P, p, time); });
    S.enemies.forEach(function (e) { if (!e.dead && !e.air && e.active) enemy(ctx, P, e, time); });
    S.trains.forEach(function (tr) { train(ctx, P, tr, time); });
    S.heroes.forEach(function (h) { hero(ctx, P, h, time); });
    bullets(ctx, P, S, time);
    S.enemies.forEach(function (e) { if (!e.dead && e.air && e.active) enemy(ctx, P, e, time); });
    booms(ctx, P, S);
  }

  D.render = { world: world, hero: hero, enemy: enemy, pow: pow, barracks: barracks, rescueHeli: rescueHeli, shade: shade, rrect: rrect, box: box };
})(typeof window !== 'undefined' ? window : globalThis);
