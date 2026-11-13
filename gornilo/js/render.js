/* ГОРНИЛО · общий рендер арены (пол-кузня, стены, ворота-топки, наковальни, люки, трофеи, заготовки, босс-механизм,
   снаряды, взрывы, метки ударов) и карта этапа. Один рендер на обе темы: палитра P = GORNILO.modern | GORNILO.classic.
   В retro (P.pixel) — без градиентов и мягких теней; мир рисуется в буфер половинного размера (ui.js).
   world(ctx, S, P, time) рисует в координатах арены 640×480. GORNILO.render */
(function (global) {
  'use strict';
  var G = global.GORNILO = global.GORNILO || {};
  var PI = Math.PI;

  function hash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, PI * 2); ctx.fill(); }
  function ring(ctx, x, y, r, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, PI * 2); ctx.stroke(); }
  function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, PI * 2); ctx.fill(); }
  function line(ctx, x1, y1, x2, y2, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function rrect(ctx, x, y, w, h, r, c) {
    ctx.fillStyle = c; r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function box(ctx, P, x, y, w, h, c, r) { if (P.pixel) rect(ctx, Math.round(x), Math.round(y), Math.round(w), Math.round(h), c); else rrect(ctx, x, y, w, h, r == null ? 3 : r, c); }
  function shadow(ctx, P, x, y, rx, ry) { if (P.pixel) return; ell(ctx, x + 3, y + 5, rx, ry, P.shadow); }
  function glow(ctx, P, x, y, r, c) {
    if (P.pixel) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.fill();
  }

  // ---------- Пол (кэш по теме и планировке) ----------
  var floorCache = {};
  function floor(ctx, S, P) {
    var L = G.logic, key = P.name + ':' + (S.room ? S.room.layout : 0) + ':' + S.stage;
    var c = floorCache[key];
    if (!c && typeof document !== 'undefined') {
      c = document.createElement('canvas'); c.width = L.W; c.height = L.H; var x = c.getContext('2d');
      drawFloor(x, S, P); floorCache[key] = c;
    }
    if (c) ctx.drawImage(c, 0, 0); else drawFloor(ctx, S, P);
  }
  function drawFloor(ctx, S, P) {
    var L = G.logic, i, j;
    rect(ctx, 0, 0, L.W, L.H, P.floor);
    // плиты 64×64 с фаской
    for (j = 0; j < 8; j++) for (i = 0; i < 10; i++) {
      var x = i * 64, y = j * 64, h = hash(i * 31 + j * 17 + S.stage * 5);
      if ((i + j) % 2) rect(ctx, x, y, 64, 64, P.floor2);
      if (!P.pixel && h < 0.3) { ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fillRect(x + 4, y + 4, 56, 56); }
      rect(ctx, x, y, 64, 2, P.seam); rect(ctx, x, y, 2, 64, P.seam);
      if (h < 0.18 && !P.pixel) { rect(ctx, x + 10 + h * 100, y + 20, 4, 4, P.seam); rect(ctx, x + 40, y + 44 - h * 60, 4, 4, P.seam); }
    }
    // тлеющий круг горнила и радиальные трещины расплава
    var cx = 320, cy = 240;
    if (P.pixel) {   // круг горнила: два кольца из «кирпичиков» и четыре клейма-наковальни по сторонам
      for (i = 0; i < 40; i++) { var a = i / 40 * PI * 2; rect(ctx, Math.round((cx + Math.cos(a) * 128) / 4) * 4 - 4, Math.round((cy + Math.sin(a) * 128) / 4) * 4 - 4, 8, 8, P.glowSoft); }
      for (i = 0; i < 20; i++) { var a3 = i / 20 * PI * 2; rect(ctx, Math.round((cx + Math.cos(a3) * 52) / 4) * 4 - 4, Math.round((cy + Math.sin(a3) * 52) / 4) * 4 - 4, 8, 8, P.glowSoft); }
      for (i = 0; i < 4; i++) { var b = i / 4 * PI * 2, mx = Math.round(cx + Math.cos(b) * 90), my = Math.round(cy + Math.sin(b) * 90); rect(ctx, mx - 8, my - 4, 16, 4, P.glowSoft); rect(ctx, mx - 4, my, 8, 6, P.glowSoft); }
    } else {
      ring(ctx, cx, cy, 128, 6, 'rgba(255,122,42,.08)'); ring(ctx, cx, cy, 128, 2, 'rgba(255,140,60,.22)');
      ring(ctx, cx, cy, 52, 2, 'rgba(255,140,60,.14)');
      for (i = 0; i < 8; i++) { var d = i / 8 * PI * 2 + 0.2, h2 = hash(i + 99);
        ctx.strokeStyle = 'rgba(255,120,40,.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx + Math.cos(d) * 56, cy + Math.sin(d) * 56);
        ctx.lineTo(cx + Math.cos(d + 0.08) * (90 + h2 * 20), cy + Math.sin(d + 0.08) * (90 + h2 * 20)); ctx.lineTo(cx + Math.cos(d - 0.04) * 124, cy + Math.sin(d - 0.04) * 124); ctx.stroke(); }
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300); g.addColorStop(0, 'rgba(255,110,40,.07)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, L.H);
    }
    // люки турелей
    (S.hatches || []).forEach(function (hp) { hatch(ctx, P, hp[0], hp[1]); });
    // стены по периметру
    var T = L.WALL;
    rect(ctx, 0, 0, L.W, T, P.wall); rect(ctx, 0, L.H - T, L.W, T, P.wall); rect(ctx, 0, 0, T, L.H, P.wall); rect(ctx, L.W - T, 0, T, L.H, P.wall);
    rect(ctx, T - 4, T - 4, L.W - 2 * T + 8, 4, P.wallTop); rect(ctx, T - 4, T - 4, 4, L.H - 2 * T + 8, P.wallTop);
    rect(ctx, T - 4, L.H - T, L.W - 2 * T + 8, 4, P.wallDark); rect(ctx, L.W - T, T - 4, 4, L.H - 2 * T + 8, P.wallDark);
    for (i = 16; i < L.W; i += 32) { rect(ctx, i - 2, 12, 4, 4, P.rivet); rect(ctx, i - 2, L.H - 16, 4, 4, P.rivet); }
    for (j = 48; j < L.H - 32; j += 32) { rect(ctx, 12, j - 2, 4, 4, P.rivet); rect(ctx, L.W - 16, j - 2, 4, 4, P.rivet); }
  }
  function hatch(ctx, P, x, y) {
    if (P.pixel) { rect(ctx, x - 14, y - 14, 28, 28, P.hatchRing); rect(ctx, x - 10, y - 10, 20, 20, P.hatch); rect(ctx, x - 10, y - 1, 20, 2, P.hatchRing); return; }
    circ(ctx, x, y, 16, P.hatchRing); circ(ctx, x, y, 13, P.hatch);
    line(ctx, x - 9, y, x + 9, y, 1.5, P.hatchRing); line(ctx, x, y - 9, x, y + 9, 1.5, P.hatchRing);
  }

  // ---------- Ворота ----------
  function gates(ctx, S, P, time) {
    var L = G.logic;
    ['N', 'S', 'W', 'E'].forEach(function (k) {
      var g = L.GATES[k], hw = L.GATE_HALF, vert = !!g.nx;
      var x = vert ? (g.nx > 0 ? 0 : L.W - L.WALL) : g.x - hw, y = vert ? g.y - hw : (g.ny > 0 ? 0 : L.H - L.WALL), w = vert ? L.WALL : hw * 2, h = vert ? hw * 2 : L.WALL;
      var open = S.roomState === 'cleared' && S.room && S.room.exits && S.room.exits[k] && S.phase === 'play';
      var hot = 0;
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (e.enter === k && !e.dead) { hot = 1; break; } }
      rect(ctx, x, y, w, h, P.gate);
      if (open) {
        var pulse = 0.5 + 0.5 * Math.sin(time * 6);
        if (P.pixel) { if (pulse > 0.3) { rect(ctx, x + (vert ? 0 : 4), y + (vert ? 4 : 0), vert ? 6 : w - 8, vert ? h - 8 : 6, P.gateOpen); } }
        else { glow(ctx, P, g.x + g.nx * 12, g.y + g.ny * 12, 54, 'rgba(88,224,192,' + (0.25 + pulse * 0.25).toFixed(2) + ')'); ctx.strokeStyle = P.gateOpen; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); }
        var ex = S.room.exits[k], rm = L.roomAt(S.map, ex.l, ex.c);
        plaque(ctx, P, g.x + g.nx * 48, g.y + g.ny * 48, rm, time);
      } else {
        if (hot) { if (P.pixel) rect(ctx, x + 4, y + 4, w - 8, h - 8, P.gateHot); else glow(ctx, P, g.x, g.y, 46, 'rgba(255,138,58,.55)'); }
        // решётка
        var n = 5, c = S.roomState === 'cleared' ? P.gateBar : hot ? P.gateHot : P.gateLock;
        for (var b = 0; b < n; b++) {
          var t = (b + 0.5) / n;
          if (vert) rect(ctx, x + 3, y + t * h - 2, w - 6, P.pixel ? 4 : 3, c); else rect(ctx, x + t * w - 2, y + 3, P.pixel ? 4 : 3, h - 6, c);
        }
      }
    });
  }
  // табличка над открытыми воротами: что за комната и какая в ней награда
  var KIND_C = { crowd: '#b8bcc6', blast: '#ff7a3a', turret: '#9aa3b5', shield: '#d8dde4', roller: '#c09a4a', mixed: '#c8a0ff', vault: '#ffd34d', boss: '#ff4a2a' };
  function plaque(ctx, P, x, y, rm, time) {
    var w = 44, h = 22;
    if (P.pixel) { rect(ctx, x - w / 2, y - h / 2, w, h, '#000000'); rect(ctx, x - w / 2, y - h / 2, w, 2, P.gateOpen); }
    else { rrect(ctx, x - w / 2, y - h / 2, w, h, 6, 'rgba(10,12,14,.85)'); ctx.strokeStyle = P.gateOpen; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2 + 0.75, y - h / 2 + 0.75, w - 1.5, h - 1.5); }
    if (rm.kind === 'boss') { icon(ctx, P, 'boss', x, y, 8, time); return; }
    icon(ctx, P, rm.reward || 'none', x - 10, y, 7, time);
    for (var i = 0; i < rm.danger; i++) rect(ctx, x + 4 + i * 5, y - 2, 3, 6, KIND_C[rm.kind] || P.bad);
  }
  function icon(ctx, P, kind, x, y, s, time) {
    if (kind === 'weapon') { var c = P.pick.fan; ctx.fillStyle = c; ctx.beginPath(); for (var i = 0; i < 8; i++) { var a = i / 8 * PI * 2 - PI / 2, r = i % 2 ? s * 0.45 : s; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
    else if (kind === 'gold') { ctx.fillStyle = P.pick.gold; ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x + s, y + s * 0.6); ctx.lineTo(x + s * 0.6, y - s * 0.5); ctx.lineTo(x - s * 0.6, y - s * 0.5); ctx.closePath(); ctx.fill(); }
    else if (kind === 'life') { circ(ctx, x - s * 0.45, y - s * 0.2, s * 0.5, P.pick.life); circ(ctx, x + s * 0.45, y - s * 0.2, s * 0.5, P.pick.life); ctx.fillStyle = P.pick.life; ctx.beginPath(); ctx.moveTo(x - s * 0.95, y); ctx.lineTo(x + s * 0.95, y); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill(); }
    else if (kind === 'boss') { circ(ctx, x, y, s, P.markEdge); circ(ctx, x, y, s * 0.45, '#000000'); for (var k = 0; k < 6; k++) { var b = k / 6 * PI * 2 + (time || 0); rect(ctx, x + Math.cos(b) * s - 2, y + Math.sin(b) * s - 2, 4, 4, P.markEdge); } }
    else rect(ctx, x - 2, y - 2, 4, 4, P.muted);
  }

  // ---------- Наковальни ----------
  function anvils(ctx, S, P) {
    S.blocks.forEach(function (b) {
      var x = b[0], y = b[1], w = b[2], h = b[3];
      if (!P.pixel) { ctx.fillStyle = P.shadow; ctx.fillRect(x + 5, y + 7, w, h); }
      box(ctx, P, x, y, w, h, P.anvil, 4);
      rect(ctx, x + 3, y + 3, w - 6, Math.min(8, h / 3), P.anvilTop);
      rect(ctx, x + 3, y + h - 6, w - 6, 3, P.anvilDark);
      if (w >= 60 && h >= 30) { rect(ctx, x + w / 2 - 10, y + h / 2 - 3, 20, 6, P.anvilDark); }
    });
  }

  // ---------- Трофеи ----------
  function pickups(ctx, S, P, time) {
    S.pickups.forEach(function (p) {
      if (p.t < 2.5 && Math.floor(time * 8) % 2) return;
      var c = P.pick[p.kind] || P.ink, b = Math.sin(time * 4 + p.x) * 2;
      if (!P.pixel) { glow(ctx, P, p.x, p.y, 22, 'rgba(255,220,120,.18)'); ell(ctx, p.x + 2, p.y + 9, 9, 3, P.shadow); }
      var y = p.y + b;
      if (p.kind === 'gold') { icon(ctx, P, 'gold', p.x, y, 9, time); return; }
      if (p.kind === 'life') { icon(ctx, P, 'life', p.x, y, 9, time); return; }
      // жетон-шестигранник с символом оружия
      ctx.fillStyle = P.pixel ? '#000000' : 'rgba(12,12,16,.9)'; ctx.beginPath();
      for (var i = 0; i < 6; i++) { var a = i / 6 * PI * 2; ctx.lineTo(p.x + Math.cos(a) * 11, y + Math.sin(a) * 11); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
      glyph(ctx, P, p.kind, p.x, y, c, time);
    });
  }
  function glyph(ctx, P, k, x, y, c, time) {
    if (k === 'fan') { for (var i = -2; i <= 2; i++) line(ctx, x - 4, y + 3, x - 4 + Math.cos(-PI / 2 + i * 0.4) * 9, y + 3 + Math.sin(-PI / 2 + i * 0.4) * 9, 1.6, c); }
    else if (k === 'flame') { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.quadraticCurveTo(x + 6, y, x, y + 6); ctx.quadraticCurveTo(x - 6, y, x, y - 7); ctx.fill(); }
    else if (k === 'grenade') { circ(ctx, x, y + 1, 5, c); rect(ctx, x - 1, y - 7, 3, 4, c); }
    else if (k === 'disc') { ring(ctx, x, y, 5, 2.5, c); }
    else if (k === 'ring') { ring(ctx, x, y, 6, 1.5, c); circ(ctx, x, y, 2, c); }
    else if (k === 'hammers') { rect(ctx, x - 1, y - 5, 2, 10, c); rect(ctx, x - 5, y - 6, 10, 4, c); }
  }

  // ---------- Метки, взрывы ----------
  function marks(ctx, S, P, time) {
    S.slams.forEach(function (s) {
      var f = 1 - s.t / s.max;
      if (P.pixel) { if (Math.floor(time * 12) % 2) ring(ctx, s.x, s.y, s.r, 4, P.markEdge); circ(ctx, s.x, s.y, s.r * f, P.mark); return; }
      circ(ctx, s.x, s.y, s.r, P.mark); ring(ctx, s.x, s.y, s.r, 2, P.markEdge); circ(ctx, s.x, s.y, s.r * f, 'rgba(255,74,42,.25)');
    });
  }
  function booms(ctx, S, P) {
    S.booms.forEach(function (b) {
      var f = 1 - b.t / b.max, r = b.r * (0.35 + 0.65 * f);
      if (P.pixel) { circ(ctx, b.x, b.y, r, f < 0.4 ? P.boom[0] : f < 0.7 ? P.boom[1] : P.boom[2]); return; }
      ctx.globalAlpha = 1 - f;
      circ(ctx, b.x, b.y, r, P.boom[2]); circ(ctx, b.x, b.y, r * 0.75, P.boom[1]); circ(ctx, b.x, b.y, r * 0.45, P.boom[0]);
      ctx.globalAlpha = 1;
    });
  }

  // ---------- Герои ----------
  function hero(ctx, P, h, time) {
    if (!h.alive) return;
    if (h.inv > 0 && Math.floor(time * 14) % 2 && h.inv < 2.4) return;
    var c = P.hero[h.id], cd = P.heroDark[h.id], cl = P.heroLight[h.id], x = h.x, y = h.y, a = h.ang;
    shadow(ctx, P, x, y, 11, 6);
    if (h.ring > 0) {
      if (P.pixel) { if (h.ring > 2 || Math.floor(time * 10) % 2) ring(ctx, x, y, 28, 2, P.ring); }
      else { ring(ctx, x, y, 28, 3, P.ring); for (var k = 0; k < 6; k++) { var b = time * 3 + k / 6 * PI * 2; circ(ctx, x + Math.cos(b) * 28, y + Math.sin(b) * 28, 2.5, '#ffffff'); } }
    }
    // метка игрока под ногами — чтобы не потерять себя в толпе
    if (P.pixel) { for (var q = 0; q < 12; q++) { var qa = q / 12 * PI * 2; if (q % 2) rect(ctx, x + Math.cos(qa) * 15 - 2, y + Math.sin(qa) * 15 - 2, 4, 4, c); } }
    else ring(ctx, x, y, 15, 2, h.id ? 'rgba(90,209,199,.55)' : 'rgba(242,184,75,.55)');
    // ноги — шаг
    var st = h.moving ? Math.sin(time * 18) * 3 : 0, px = -Math.sin(a), py = Math.cos(a);
    circ(ctx, x + px * 5 + Math.cos(a) * st, y + py * 5 + Math.sin(a) * st, 3.2, cd);
    circ(ctx, x - px * 5 - Math.cos(a) * st, y - py * 5 - Math.sin(a) * st, 3.2, cd);
    // корпус: широкие плечи поперёк взгляда, кожаный наплечник-фартук на спине
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (P.pixel) { rect(ctx, -6, -11, 12, 22, c); rect(ctx, -8, -6, 4, 12, P.apron); }
    else { ell(ctx, 0, 0, 7, 11, c); ell(ctx, -4, 0, 3.5, 7, P.apron); }
    // клёпочник в руках
    rect(ctx, 2, 3, 14, 4, P.visor); rect(ctx, 14, 3.5, 3, 3, cl);
    // шлем и узкое смотровое окно
    if (P.pixel) { rect(ctx, -5, -5, 10, 10, cl); rect(ctx, 2, -4, 3, 8, P.visor); }
    else { circ(ctx, -0.5, 0, 5.5, cl); rrect(ctx, 1.8, -3.6, 2.6, 7.2, 1.2, P.visor); }
    ctx.restore();
    if (h.hammers > 0) for (var j = 0; j < 2; j++) {
      var ha = h.hamA + j * PI, hx = x + Math.cos(ha) * 46, hy = y + Math.sin(ha) * 46;
      line(ctx, x + Math.cos(ha) * 14, y + Math.sin(ha) * 14, hx, hy, 2, P.hammerHead);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha); rect(ctx, -6, -9, 12, 18, P.hammer); rect(ctx, -6, -9, 12, 4, P.hammerHead); ctx.restore();
    }
  }

  // ---------- Враги ----------
  function enemy(ctx, P, e, time) {
    var x = e.x, y = e.y, a = e.ang, fl = e.flash > 0;
    if (e.type === 'blank') {
      shadow(ctx, P, x, y, 9, 5);
      var st = Math.sin(time * 16 + e.id) * 2.5, px = -Math.sin(a), py = Math.cos(a);
      rect(ctx, x + px * 6 + Math.cos(a) * st - 2, y + py * 6 + Math.sin(a) * st - 2, 4, 4, P.blankDark);
      rect(ctx, x - px * 6 - Math.cos(a) * st - 2, y - py * 6 - Math.sin(a) * st - 2, 4, 4, P.blankDark);
      box(ctx, P, x - 8, y - 8, 16, 16, fl ? '#ffffff' : P.blank, 4);
      rect(ctx, x - 8, y + 4, 16, 4, P.blankDark);
      var ex = Math.cos(a) * 3, ey = Math.sin(a) * 3;
      rect(ctx, x + ex - 5, y + ey - 3, 3, 3, P.blankEye); rect(ctx, x + ex + 2, y + ey - 3, 3, 3, P.blankEye);
    } else if (e.type === 'runner') {
      shadow(ctx, P, x, y, 8, 4);
      var lit = e.fuse > 0, blink = lit && Math.floor(time * 20) % 2;
      circ(ctx, x, y, 8.5, fl || blink ? '#ffffff' : P.runner);
      circ(ctx, x, y, 4, P.runnerDark);
      var bx = x - Math.cos(a) * 9, by = y - Math.sin(a) * 9;
      line(ctx, x - Math.cos(a) * 6, y - Math.sin(a) * 6, bx, by, 2, P.runnerDark);
      if (Math.floor(time * 16 + e.id) % 2 || lit) circ(ctx, bx, by, lit ? 4 : 2.5, P.fuse);
      if (lit && !P.pixel) glow(ctx, P, x, y, 40, 'rgba(255,90,40,.25)');
    } else if (e.type === 'turret') {
      var k = e.rise > 0 ? 1 - e.rise / G.logic.ENEMIES.turret.rise : 1;
      if (e.warn > 0) { if (P.pixel) { if (Math.floor(time * 16) % 2) ring(ctx, x, y, 17, 2, P.markEdge); } else glow(ctx, P, x, y, 30, 'rgba(255,74,42,.5)'); }
      circ(ctx, x, y, 15 * Math.max(0.4, k), P.turretDark);
      circ(ctx, x, y, 11 * k, fl ? '#ffffff' : P.turret);
      if (k > 0.6) { line(ctx, x, y, x + Math.cos(a) * 17, y + Math.sin(a) * 17, P.pixel ? 6 : 5, P.turretBarrel); circ(ctx, x, y, 4, e.warn > 0 ? P.markEdge : P.turretBarrel); }
    } else if (e.type === 'shield') {
      shadow(ctx, P, x, y, 12, 6);
      circ(ctx, x, y, 12, fl ? '#ffffff' : P.shield);
      circ(ctx, x - Math.cos(a) * 3, y - Math.sin(a) * 3, 6, P.shieldDark);
      ctx.strokeStyle = e.stun > 0 ? P.shieldDark : P.shieldPlate; ctx.lineWidth = P.pixel ? 5 : 4.5; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(x, y, 15, a - 1.0, a + 1.0); ctx.stroke();
      rect(ctx, x + Math.cos(a) * 6 - 1.5, y + Math.sin(a) * 6 - 1.5, 3, 3, P.blankEye);
    } else if (e.type === 'roller') {
      if (e.state === 'wind') {
        var wl = Math.floor(time * 14) % 2;
        if (P.pixel) { if (wl) for (var d = 30; d < 260; d += 16) rect(ctx, x + Math.cos(a) * d - 2, y + Math.sin(a) * d - 2, 4, 4, P.markEdge); }
        else { ctx.save(); ctx.setLineDash([8, 8]); line(ctx, x, y, x + Math.cos(a) * 260, y + Math.sin(a) * 260, 3, 'rgba(255,74,42,' + (wl ? 0.75 : 0.45) + ')'); ctx.restore(); }
      }
      shadow(ctx, P, x, y, 22, 12);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      var sh = e.state === 'wind' ? (Math.random() - 0.5) * 2 : 0;
      box(ctx, P, -20 + sh, -17, 40, 34, P.rollerDark, 5);
      box(ctx, P, -15 + sh, -19, 30, 38, fl ? '#ffffff' : P.roller, 6);
      var off = (time * (e.state === 'charge' ? 60 : 14)) % 10;
      for (var s = -15; s < 15; s += 10) rect(ctx, s + off * (e.state === 'charge' ? 1 : 0.3) % 10 + sh, -19, 3, 38, P.rollerDark);
      rect(ctx, -15 + sh, -3, 30, 6, P.rollerBand);
      rect(ctx, 14 + sh, -8, 5, 16, e.state === 'wind' ? P.markEdge : P.rollerBand);
      ctx.restore();
    }
  }

  // ---------- Босс ----------
  function boss(ctx, S, P, time) {
    var b = S.boss; if (!b) return;
    var fl = b.flash > 0, x = b.x, y = b.y, dead = b.dead;
    if (dead && Math.floor(time * 10) % 2) return;
    if (b.intro > 0) ctx.globalAlpha = Math.max(0.2, 1 - b.intro / 1.6);
    if (b.key === 'press') {
      shadow(ctx, P, x, y + 10, 120, 30);
      box(ctx, P, x - 110, y - 40, 220, 70, P.bossDark, 8);
      box(ctx, P, x - 102, y - 34, 204, 56, P.boss, 6);
      for (var i = -3; i <= 3; i++) rect(ctx, x + i * 28 - 2, y - 30, 4, 48, P.bossDark);
      rect(ctx, x - 102, y - 34, 204, 6, P.bossLight);
    } else if (b.key === 'wheel') {
      shadow(ctx, P, x, y + 6, 70, 30);
      var n = 14;
      ctx.fillStyle = P.bossDark; ctx.beginPath();
      for (var k = 0; k < n * 2; k++) { var a = b.rot + k / (n * 2) * PI * 2, r = k % 2 ? 60 : 70; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      circ(ctx, x, y, 56, P.boss); ring(ctx, x, y, 40, P.pixel ? 4 : 3, P.bossLight);
      for (var s2 = 0; s2 < 6; s2++) { var a2 = b.rot * 1.5 + s2 / 6 * PI * 2; line(ctx, x + Math.cos(a2) * 24, y + Math.sin(a2) * 24, x + Math.cos(a2) * 52, y + Math.sin(a2) * 52, 4, P.bossDark); }
    } else {
      shadow(ctx, P, x, y + 12, 80, 30);
      ell(ctx, x, y + 6, 76, 52, P.bossDark); ell(ctx, x, y, 68, 46, P.boss);
      box(ctx, P, x - 30, y - 64, 60, 26, P.bossDark, 6); box(ctx, P, x - 24, y - 60, 48, 18, P.bossLight, 4);
      rect(ctx, x - 16, y - 54, 10, 5, P.core); rect(ctx, x + 6, y - 54, 10, 5, P.core);
      var stp = Math.sin(time * 4) * 4;
      box(ctx, P, x - 52, y + 40 + stp, 26, 22, P.bossDark, 4); box(ctx, P, x + 26, y + 40 - stp, 26, 22, P.bossDark, 4);
    }
    // узлы
    b.parts.forEach(function (p) {
      if (p.dead) { circ(ctx, p.x, p.y, p.r * 0.7, P.bossDark); circ(ctx, p.x, p.y, 3, P.boom[3]); return; }
      var pc = p.flash > 0 ? '#ffffff' : P.bossLight;
      if (p.kind === 'hammer') { box(ctx, P, p.x - p.r, p.y - p.r * 0.8, p.r * 2, p.r * 1.6, P.bossDark, 4); box(ctx, P, p.x - p.r + 3, p.y - p.r * 0.8 + 3, p.r * 2 - 6, p.r * 1.6 - 6, pc, 3); rect(ctx, p.x - 3, p.y - p.r * 0.8 - 12, 6, 12, P.bossDark); }
      else if (p.kind === 'cannon') { circ(ctx, p.x, p.y, p.r, P.bossDark); circ(ctx, p.x, p.y, p.r - 4, pc); var tg = S.heroes.find(function (h) { return h.alive; }); var ca = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : PI / 2; line(ctx, p.x, p.y, p.x + Math.cos(ca) * 20, p.y + Math.sin(ca) * 20, 6, P.bossDark); if (p.warn > 0) circ(ctx, p.x, p.y, 5, P.markEdge); }
      else if (p.kind === 'nozzle') { circ(ctx, p.x, p.y, p.r, P.bossDark); circ(ctx, p.x, p.y, p.r - 4, pc); circ(ctx, p.x, p.y, 4, (p.on % 2.6) < 1.2 ? P.core : P.bossDark); }
      else if (p.kind === 'hatch') { circ(ctx, p.x, p.y, p.r, P.bossDark); circ(ctx, p.x, p.y, p.r - 4, pc); rect(ctx, p.x - p.r + 4, p.y - 1.5, p.r * 2 - 8, 3, P.bossDark); }
      else if (p.kind === 'bellows') { box(ctx, P, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, P.bossDark, 5); for (var f = 0; f < 3; f++) rect(ctx, p.x - p.r + 3, p.y - p.r + 4 + f * 9, p.r * 2 - 6, 5, pc); if (p.warn > 0) circ(ctx, p.x, p.y + p.r, 5, P.core); }
      if (p.hp < p.max && !P.pixel) { rect(ctx, p.x - 12, p.y - p.r - 8, 24, 3, P.barBg); rect(ctx, p.x - 12, p.y - p.r - 8, 24 * Math.max(0, p.hp / p.max), 3, P.bad); }
    });
    // сердцевина
    if (b.armored) { circ(ctx, x, y, 20, P.coreArmor); ring(ctx, x, y, 20, 3, P.bossDark); rect(ctx, x - 14, y - 2, 28, 4, P.bossDark); rect(ctx, x - 2, y - 14, 4, 28, P.bossDark); }
    else { var pu = 0.5 + 0.5 * Math.sin(time * 10); glow(ctx, P, x, y, 50, 'rgba(255,122,42,.5)'); circ(ctx, x, y, 18 + pu * 3, fl ? '#ffffff' : P.core); circ(ctx, x, y, 8, '#fff0c0'); }
    ctx.globalAlpha = 1;
  }

  // ---------- Снаряды ----------
  function shots(ctx, S, P, time) {
    S.bullets.forEach(function (b) {
      if (b.k === 'b') { var n = Math.hypot(b.vx, b.vy) || 1; line(ctx, b.x - b.vx / n * 8, b.y - b.vy / n * 8, b.x, b.y, P.pixel ? 4 : 3, P.bullet); if (!P.pixel) circ(ctx, b.x, b.y, 1.6, P.bulletCore); }
      else if (b.k === 'f') { var f = b.life / b.max, c = f > 0.66 ? P.flame[0] : f > 0.33 ? P.flame[1] : P.flame[2]; if (!P.pixel) ctx.globalAlpha = 0.35 + f * 0.6; circ(ctx, b.x, b.y, 4 + (1 - f) * 7, c); ctx.globalAlpha = 1; }
      else if (b.k === 'g') { circ(ctx, b.x, b.y, 5, P.grenade); if (Math.floor(time * 12) % 2) circ(ctx, b.x, b.y, 2, P.markEdge); }
      else if (b.k === 'd') { var sp = time * 20; ring(ctx, b.x, b.y, 6, 3, P.disc); rect(ctx, b.x + Math.cos(sp) * 6 - 1.5, b.y + Math.sin(sp) * 6 - 1.5, 3, 3, '#ffffff'); if (!P.pixel) glow(ctx, P, b.x, b.y, 14, 'rgba(126,232,255,.3)'); }
    });
    S.ebullets.forEach(function (b) {
      if (b.kind === 'flame') { circ(ctx, b.x, b.y, 6, P.flame[1]); circ(ctx, b.x, b.y, 3, P.flame[0]); return; }
      if (!P.pixel) circ(ctx, b.x, b.y, 8, P.eglow);
      circ(ctx, b.x, b.y, P.pixel ? 4 : 4.5, P.ebullet); circ(ctx, b.x, b.y, 1.8, '#ffffff');
    });
  }

  function world(ctx, S, P, time) {
    floor(ctx, S, P);
    gates(ctx, S, P, time);
    marks(ctx, S, P, time);
    pickups(ctx, S, P, time);
    // турели в люках — ниже всех
    var i, e;
    for (i = 0; i < S.enemies.length; i++) { e = S.enemies[i]; if (!e.dead && e.type === 'turret') enemy(ctx, P, e, time); }
    anvils(ctx, S, P);
    for (i = 0; i < S.enemies.length; i++) { e = S.enemies[i]; if (!e.dead && e.type !== 'turret' && e.type !== 'roller') enemy(ctx, P, e, time); }
    for (i = 0; i < S.enemies.length; i++) { e = S.enemies[i]; if (!e.dead && e.type === 'roller') enemy(ctx, P, e, time); }
    boss(ctx, S, P, time);
    S.heroes.forEach(function (h) { hero(ctx, P, h, time); });
    shots(ctx, S, P, time);
    booms(ctx, S, P);
  }

  // ---------- Карта этапа (оверлей перехода) ----------
  function map(ctx, S, P, x0, y0, w, h, time, g) {
    var L = G.logic, M = S.map; if (!M) return;
    var rows = L.LAYERS + 1, dy = h / rows, dx = w / 3;
    function pos(l, c) { return [x0 + dx * (c + 0.5), y0 + h - dy * (l + 0.5)]; }
    var onPath = {}; S.path.forEach(function (p) { onPath[p[0] + ',' + p[1]] = 1; });
    // связи
    for (var l = 0; l < L.LAYERS; l++) for (var c = 0; c < 3; c++) {
      var r = M.layers[l][c]; if (!r) continue; var a = pos(l, c);
      for (var k in r.exits) {
        var e = r.exits[k], b = pos(e.l, e.c), walked = onPath[l + ',' + c] && onPath[e.l + ',' + e.c] && S.path.some(function (p, i) { return i > 0 && p[0] === e.l && p[1] === e.c && S.path[i - 1][0] === l && S.path[i - 1][1] === c; });
        line(ctx, a[0], a[1], b[0], b[1], walked ? 3 : 1.5, walked ? P.accent : P.line);
      }
    }
    // узлы
    var cur = S.path[S.path.length - 1];
    for (l = 0; l <= L.LAYERS; l++) for (c = 0; c < 3; c++) {
      var rm = L.roomAt(M, l, c); if (!rm || (l === L.LAYERS && c !== 1)) continue;
      var p = pos(l, c), sz = l === L.LAYERS ? 14 : 10, here = cur && cur[0] === l && cur[1] === c;
      var col = onPath[l + ',' + c] ? (P.pixel ? '#585858' : '#3c3c46') : (P.pixel ? '#000000' : 'rgba(10,10,14,.9)');
      box(ctx, P, p[0] - sz - 2, p[1] - sz + 1, sz * 2 + 4, sz * 2 - 2, col, 4);
      ctx.strokeStyle = here && Math.floor(time * 6) % 2 ? P.warn : (KIND_C[rm.kind] || P.line); ctx.lineWidth = here ? 2.5 : 1.2;
      ctx.strokeRect(p[0] - sz - 2 + 0.5, p[1] - sz + 1.5, sz * 2 + 3, sz * 2 - 3);
      if (rm.kind === 'boss') icon(ctx, P, 'boss', p[0], p[1], 8, time);
      else icon(ctx, P, rm.reward || 'none', p[0], p[1], 6, time);
    }
  }

  G.render = { world: world, map: map, hero: hero, enemy: enemy, icon: icon, rrect: rrect, box: box, rect: rect, circ: circ, line: line, KIND_C: KIND_C };
})(typeof window !== 'undefined' ? window : globalThis);
