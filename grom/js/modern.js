/* ГРОМ · рендер «modern» (по умолчанию) + общее ядро спрайтов GROM.makeRenderer(P).
   Ядро рисует всё процедурно (без картинок); стиль задаёт палитра P: P.pixel=false — мягкие формы, градиенты, свечение;
   P.pixel=true (тема retro, js/classic.js) — квадратные пиксели, 16 цветов EGA, чёрный контур.
   Герой — штурмовик мастерской «Гефест»: стальной шлем с янтарной щелью-визором и гребнем-«молотом»,
   бронзовая кираса со знаком молнии, катушка-генератор за спиной, ствол на правой руке. */
(function (global) {
  'use strict';
  var GR = global.GROM = global.GROM || {};
  var L = GR.logic, T = L.T, VW = L.VIEW_W, VH = L.VIEW_H, E = L.E, R = L.R, P_ = L.P, K = L.K, B = L.B, G = L.G;

  function makeRenderer(P) {
    var px = P.pixel;
    var api = { P: P };
    function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    function circ(ctx, x, y, r, c) {
      ctx.fillStyle = c;
      if (px) { var s = Math.max(2, Math.round(r * 2 / 2) * 2); ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); if (r > 3) { ctx.fillRect(Math.round(x - s / 2 - 1), Math.round(y - s / 2 + 2), s + 2, s - 4); ctx.fillRect(Math.round(x - s / 2 + 2), Math.round(y - s / 2 - 1), s - 4, s + 2); } return; }
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    function glow(ctx, on, col, blur) { if (px) return; if (on) { ctx.shadowColor = col; ctx.shadowBlur = blur || 8; } else { ctx.shadowBlur = 0; } }
    function zone(V) { return P.zones[V.S.zone] || P.zones.foundry; }
    function hash(c, r) { var h = (c * 374761393 + r * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

    // ---------- Фон ----------
    api.bg = function (ctx, V, W, H) {
      var Z = zone(V);
      if (px) { rect(ctx, 0, L.HUD, W, H, Z.sky0); }
      else {
        var gr = ctx.createLinearGradient(0, L.HUD, 0, H); gr.addColorStop(0, Z.sky0); gr.addColorStop(1, Z.sky1);
        ctx.fillStyle = gr; ctx.fillRect(0, L.HUD, W, H - L.HUD);
      }
      // дальний план: силуэты труб и шестерён (параллакс 0.35)
      var par = 0.35, off = -(V.cx * T * par) % 160, offy = -(V.cy * T * par) % 120;
      ctx.fillStyle = Z.far;
      for (var x = off - 160; x < W + 160; x += 160) {
        for (var y = L.HUD + offy - 120; y < H + 120; y += 120) {
          var k = Math.abs(Math.floor((x - off) / 160) * 7 + Math.floor((y - offy) / 120) * 3) % 3;
          if (k === 0) { ctx.fillRect(Math.round(x + 20), Math.round(y), px ? 8 : 10, 120); ctx.fillRect(Math.round(x + 14), Math.round(y + 40), px ? 20 : 22, px ? 6 : 6); }
          else if (k === 1) { if (px) { ctx.fillRect(Math.round(x + 60), Math.round(y + 30), 28, 28); } else { ctx.beginPath(); ctx.arc(x + 74, y + 44, 16, 0, Math.PI * 2); ctx.fill(); for (var t = 0; t < 8; t++) { var a = t * Math.PI / 4 + V.t * 0.15; ctx.fillRect(x + 74 + Math.cos(a) * 18 - 3, y + 44 + Math.sin(a) * 18 - 3, 6, 6); } } }
          else { ctx.fillRect(Math.round(x + 100), Math.round(y + 70), 50, px ? 6 : 5); ctx.fillRect(Math.round(x + 120), Math.round(y + 70), px ? 6 : 5, 50); }
        }
      }
    };
    // ---------- Тайлы ----------
    api.tiles = function (ctx, V) {
      var S = V.S, Z = zone(V), c0 = Math.max(0, Math.floor(V.cx)), c1 = Math.min(S.W - 1, Math.floor(V.cx + VW + 1)), r0 = Math.max(0, Math.floor(V.cy)), r1 = Math.min(S.H - 1, Math.floor(V.cy + VH + 1));
      var t = S.t, W = S.W;
      function sol(c, r) { return c < 0 || r < 0 || c >= W || r >= S.H ? true : t[r * W + c] !== E; }
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
        var v = t[r * W + c]; if (v === E) continue;
        var x = V.sx(c), y = V.sy(r);
        if (v === R || v === K) {
          var up = !sol(c, r - 1), dn = !sol(c, r + 1), lf = !sol(c - 1, r), rt = !sol(c + 1, r), edge = up || dn || lf || rt;
          var deep = !edge && sol(c - 1, r - 1) && sol(c + 1, r - 1) && sol(c - 1, r + 1) && sol(c + 1, r + 1);
          rect(ctx, x, y, T, T, deep ? Z.deep : Z.rock);
          if (!deep) {
            var hv = hash(c, r);
            if (px) { if (hv < 0.5) rect(ctx, x + (hv * 20 | 0) % 10 + 2, y + 6, 4, 2, Z.rock2); rect(ctx, x, y + 15, T, 1, Z.rock2); if ((r & 1) ? c % 2 === 0 : c % 2 === 1) rect(ctx, x + 15, y, 1, T, Z.rock2); }
            else { rect(ctx, x + 2 + (hv * 9 | 0), y + 4 + (hv * 7 | 0), 3, 2, Z.rock2); rect(ctx, x + 9 - (hv * 5 | 0), y + 10, 2, 2, Z.rock2); }
            if (up) { rect(ctx, x, y, T, px ? 3 : 3, Z.lip); if (!px) rect(ctx, x, y + 3, T, 1, Z.lip2); }
            if (dn) rect(ctx, x, y + T - 2, T, 2, Z.under);
            if (lf) rect(ctx, x, y, 2, T, Z.side); if (rt) rect(ctx, x + T - 2, y, 2, T, Z.side);
          }
          if (v === K) {   // трещина: тайник — едва заметна
            ctx.strokeStyle = Z.crack; ctx.lineWidth = px ? 2 : 1.2; ctx.beginPath();
            ctx.moveTo(x + 3, y + 2); ctx.lineTo(x + 8, y + 7); ctx.lineTo(x + 6, y + 11); ctx.lineTo(x + 12, y + 14); ctx.moveTo(x + 8, y + 7); ctx.lineTo(x + 13, y + 5); ctx.stroke();
            var hp = S.thp[r * W + c]; if (hp < 3.5) { ctx.globalAlpha = 0.5; rect(ctx, x + 4, y + 4, 8, 8, '#000'); ctx.globalAlpha = 1; }
          }
        } else if (v === P_) {
          rect(ctx, x, y, T, T, Z.plate);
          rect(ctx, x, y, T, px ? 3 : 2, Z.plateHi); rect(ctx, x, y + T - 2, T, 2, Z.plateLo);
          rect(ctx, x + 3, y + 6, 2, 2, Z.plateLo); rect(ctx, x + 11, y + 6, 2, 2, Z.plateLo);
          if (!sol(c - 1, r)) rect(ctx, x, y, 2, T, Z.plateLo); if (!sol(c + 1, r)) rect(ctx, x + T - 2, y, 2, T, Z.plateLo);
        } else if (v === B) {
          var pulse = 0.5 + 0.5 * Math.sin(V.t * 4 + c);
          rect(ctx, x, y, T, T, P.bonusLo); rect(ctx, x + 1, y + 1, T - 2, T - 2, P.bonus);
          rect(ctx, x + 1, y + 1, T - 2, 2, P.bonusHi);
          if (!px) { ctx.globalAlpha = 0.25 + 0.35 * pulse; rect(ctx, x + 2, y + 2, T - 4, T - 4, '#fff3c0'); ctx.globalAlpha = 1; }
          bolt(ctx, x + 8, y + 8, 5, px ? '#000000' : '#3a1d06');
        } else if (v === G) {
          rect(ctx, x, y, T, T, P.gate);
          for (var q = 0; q < 4; q++) rect(ctx, x + q * 4, y, 2, T, P.gateHi);
        }
      }
    };
    function bolt(ctx, x, y, s, col) {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(x + s * 0.2, y - s); ctx.lineTo(x - s * 0.6, y + s * 0.15); ctx.lineTo(x - s * 0.05, y + s * 0.15);
      ctx.lineTo(x - s * 0.3, y + s); ctx.lineTo(x + s * 0.6, y - s * 0.2); ctx.lineTo(x + s * 0.05, y - s * 0.2); ctx.closePath(); ctx.fill();
    }
    api.boltGlyph = bolt;

    // ---------- Предметы ----------
    api.item = function (ctx, it, x, y, t) {
      var bob = it.k === 'beacon' ? 0 : Math.round(Math.sin(t * 3 + (it.x | 0)) * 2);
      y += bob;
      if (it.k === 'gem') {
        ctx.fillStyle = P.gem; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill();
        rect(ctx, x - 1, y - 3, 2, 2, '#ffffff');
      } else if (it.k === 'cap') {
        glow(ctx, true, P.wcol[it.w], 10);
        circ(ctx, x, y, 6, P.wcol[it.w]); glow(ctx, false);
        rect(ctx, x - 6, y - 1, 12, 2, px ? '#000' : 'rgba(0,0,0,.35)');
        ctx.fillStyle = px ? '#000' : '#10131a'; ctx.font = '900 8px ' + (px ? 'monospace' : 'Inter, system-ui, sans-serif'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((GR.wLabel || {})[it.w] || it.w, x, y + 0.5); ctx.textBaseline = 'alphabetic';
      } else if (it.k === 'hp') {
        rect(ctx, x - 6, y - 5, 12, 10, P.good); rect(ctx, x - 1, y - 3, 2, 6, '#fff'); rect(ctx, x - 3, y - 1, 6, 2, '#fff');
      } else if (it.k === 'thunder') {
        circ(ctx, x, y, 6.5, P.wheel); bolt(ctx, x, y, 5, px ? '#000' : '#10131a');
      } else if (it.k === 'life') {
        glow(ctx, true, P.accent, 12); api.lifeIcon(ctx, x, y + 3, 1.5); glow(ctx, false);
      } else if (it.k === 'charge') {
        circ(ctx, x, y, 6, P.wheel); circ(ctx, x, y, 3, P.bg2); rect(ctx, x - 1, y - 6, 2, 12, P.wheel);
      } else if (it.k === 'beacon') {
        // громоотвод: мачта с шаром, горит, если активен
        var on = it.on, top = y - 14;
        rect(ctx, x - 1, top, 2, 22, P.mast); rect(ctx, x - 5, y + 6, 10, 3, P.mast);
        if (on) glow(ctx, true, P.wheel, 14);
        circ(ctx, x, top - 2, 4, on ? P.wheel : P.mastOff); glow(ctx, false);
        if (on && Math.floor(t * 6) % 2 === 0) { ctx.strokeStyle = P.wheel; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, top - 6); ctx.lineTo(x + 3, top - 10); ctx.lineTo(x - 1, top - 12); ctx.stroke(); }
      }
    };
    api.portal = function (ctx, x, y, t) {
      var h = 40;
      for (var i = 0; i < 4; i++) {
        var a = 0.25 + 0.2 * Math.sin(t * 5 + i);
        ctx.globalAlpha = a; rect(ctx, x - 12 + i * 2, y - h + i * 3, 24 - i * 4, h - i * 3, i % 2 ? P.wheel : P.accent);
      }
      ctx.globalAlpha = 1; rect(ctx, x - 14, y - 2, 28, 2, P.ink);
    };
    api.mine = function (ctx, x, y, m, t) {
      circ(ctx, x, y - 4, 4, P.mineC); rect(ctx, x - 5, y - 2, 10, 2, P.mineC);
      if (Math.floor(t * 8) % 2 === 0 || m.t > 2.4) rect(ctx, x - 1, y - 6, 2, 2, P.bad);
    };

    // ---------- Враги ----------
    api.enemy = function (ctx, e, x, y, t) {
      var fl = e.flash > 0, hh = e.hh * T, w = e.hw * T;
      var body = fl ? '#ffffff' : P.foe, dark = fl ? '#dddddd' : P.foeLo;
      if (e.type === 'crawler') {
        // ползун-шестерня
        var cy = y - hh * 0.5;
        for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3 + e.x * 1.6; rect(ctx, x + Math.cos(a) * 7 - 2, cy + Math.sin(a) * 6 - 2, 4, 4, dark); }
        circ(ctx, x, cy, 6, body); circ(ctx, x, cy, 2.5, dark);
        rect(ctx, x + e.dir * 3 - 1.5, cy - 3, 3, 3, P.eye);
        rect(ctx, x - 6, y - 2, 3, 2, dark); rect(ctx, x + 3, y - 2, 3, 2, dark);
      } else if (e.type === 'hopper') {
        var sq = e.vy < 0 ? 1.3 : e.vy > 0 ? 1.1 : 0.8, sh = 7 * sq;
        for (var s = 0; s < 3; s++) rect(ctx, x - 4 + (s % 2) * 2, y - 2 - s * sh / 3, 6, 2, dark);
        var hy = y - sh - 6;
        if (px) { rect(ctx, x - 7, hy - 4, 14, 8, body); } else { ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x, hy, 7, 5, 0, 0, Math.PI * 2); ctx.fill(); }
        rect(ctx, x + e.dir * 3 - 2, hy - 2, 4, 3, P.eye);
      } else if (e.type === 'flyer') {
        var fy = y - hh / 2, rot = Math.sin(t * 40) * 7;
        rect(ctx, x - Math.abs(rot), fy - 9, Math.abs(rot) * 2 + 1, 2, P.muted);
        rect(ctx, x - 1, fy - 8, 2, 4, dark);
        if (px) rect(ctx, x - 6, fy - 4, 12, 8, body); else { ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x, fy, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill(); }
        rect(ctx, x + e.dir * 3 - 2, fy - 1, 4, 3, P.eye);
      } else if (e.type === 'turret') {
        var ceil = e.mount === 'ceil', base = ceil ? y - hh : y, sgn = ceil ? 1 : -1;
        rect(ctx, x - 7, ceil ? base : base - 3, 14, 3, dark);
        var cy2 = base + sgn * 7;
        circ(ctx, x, cy2, 6, body);
        rect(ctx, x + e.dir * 3, cy2 - 1.5, e.dir * 8, 3, dark);
        var warn = e.warn && Math.floor(t * 14) % 2 === 0;
        glow(ctx, warn, P.bad, 10); circ(ctx, x, cy2, 2.5, warn ? '#ffffff' : P.eye); glow(ctx, false);
      }
    };
    // ---------- Боссы ----------
    api.boss = function (ctx, b, x, y, t) {
      var fl = (b.flash > 0) || (b.shift > 0 && Math.floor(t * 12) % 2 === 0), dead = b.dead;
      if (dead) { ctx.globalAlpha = Math.max(0, b.deadT / 2); }
      var body = fl ? '#ffffff' : P.boss, lo = fl ? '#cccccc' : P.bossLo, hi = P.bossHi, w = b.hw * T, h = b.hh * T;
      if (b.key === 'anvil') {
        // «Наковальня»: тяжёлый шагоход с плитой-наковальней на спине
        var step = Math.sin(t * 6) * (b.ground ? 3 : 0);
        rect(ctx, x - w + 4, y + h - 10 + step, 10, 10 - step, lo); rect(ctx, x + w - 14, y + h - 10 - step, 10, 10 + step, lo);
        rect(ctx, x - w, y - h + 10, w * 2, h * 2 - 18, body);
        rect(ctx, x - w - 6, y - h, w * 2 + 12, 10, hi); rect(ctx, x - w - 10, y - h + 2, 6, 6, hi);
        rect(ctx, x - w + 6, y - 4, w * 2 - 12, 4, lo);
        var eye = b.cd < 0.4 ? '#ffffff' : P.eye; glow(ctx, true, P.eye, 12); rect(ctx, x - 10, y - h + 16, 20, 5, eye); glow(ctx, false);
      } else if (b.key === 'millstone') {
        // «Жернов»: каменный круг с бронзовыми зубьями
        circ(ctx, x, y, w, body); circ(ctx, x, y, w * 0.45, lo);
        for (var k = 0; k < 8; k++) { var a = b.spin + k * Math.PI / 4; rect(ctx, x + Math.cos(a) * (w - 3) - 3, y + Math.sin(a) * (w - 3) - 3, 6, 6, hi); }
        var ex = Math.cos(b.spin) * w * 0.25, ey = Math.sin(b.spin) * w * 0.25;
        glow(ctx, true, P.eye, 10); circ(ctx, x + ex, y + ey, 4, P.eye); glow(ctx, false);
      } else if (b.key === 'kite') {
        // «Флюгер»: летучий корпус с лопастями-флюгерами
        var flap = Math.sin(t * 10) * 6;
        ctx.fillStyle = hi; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w - 18, y - 10 - flap); ctx.lineTo(x - w - 12, y + 6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + 18, y - 10 - flap); ctx.lineTo(x + w + 12, y + 6); ctx.closePath(); ctx.fill();
        if (px) rect(ctx, x - w, y - h, w * 2, h * 2, body); else { ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill(); }
        rect(ctx, x - 2, y - h - 8, 4, 8, lo); rect(ctx, x - 10, y - h - 10, 20, 3, lo);
        glow(ctx, true, P.eye, 10); circ(ctx, x, y + 2, 5, P.eye); glow(ctx, false);
      } else {
        // «Грозовой горн»: раструб с ядром и кольцом громоотводов
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(x - w, y + h); ctx.lineTo(x - w * 0.4, y - h); ctx.lineTo(x + w * 0.4, y - h); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
        rect(ctx, x - w - 4, y + h - 4, w * 2 + 8, 6, lo);
        for (var q = 0; q < 6; q++) { var aa = b.spin * 0.6 + q * Math.PI / 3; rect(ctx, x + Math.cos(aa) * (w + 12) - 2, y + Math.sin(aa) * (h + 10) - 2, 4, 4, hi); }
        var core = b.cd3 < 0.1 ? '#ffffff' : P.wheel; glow(ctx, true, P.wheel, 16); circ(ctx, x, y + 2, 7, core); glow(ctx, false);
      }
      ctx.globalAlpha = 1;
    };
    api.wave = function (ctx, x, y, w, t) { var h = 12 + Math.sin(t * 30) * 2; glow(ctx, true, P.warn, 8); rect(ctx, x - 4, y - h, 8, h, P.warn); rect(ctx, x - 2, y - h - 3, 4, 3, '#ffffff'); glow(ctx, false); };
    api.mark = function (ctx, x, y0, y1, m, t) {
      if (m.t < m.warn) { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 20); rect(ctx, x - 10, y0, 20, y1 - y0, P.bad); ctx.globalAlpha = 1; rect(ctx, x - 12, y1 - 3, 24, 3, P.bad); }
      else { glow(ctx, true, P.wheel, 18); rect(ctx, x - 6, y0, 12, y1 - y0, '#ffffff'); rect(ctx, x - 10, y0, 3, y1 - y0, P.wheel); rect(ctx, x + 7, y0, 3, y1 - y0, P.wheel); glow(ctx, false); }
    };

    // ---------- Герой ----------
    api.hero = function (ctx, h, x, y, t, S, scale) {
      var s = scale || 1;
      if (h.form === 'wheel') {
        var r = 7 * s, cy = y - r, rot = (h.x * 1.6) % (Math.PI * 2);
        glow(ctx, true, P.wheel, 10); circ(ctx, x, cy, r, P.heroB); glow(ctx, false);
        circ(ctx, x, cy, r - 2 * s, P.heroS);
        for (var k = 0; k < 4; k++) { var a = rot + k * Math.PI / 2; rect(ctx, x + Math.cos(a) * 3.5 * s - 1.5, cy + Math.sin(a) * 3.5 * s - 1.5, 3, 3, P.heroB); }
        circ(ctx, x, cy, 2 * s, P.wheel);
        if (Math.floor(t * 20) % 3 === 0) rect(ctx, x - h.face * (r + 2), cy + r - 3, 2, 2, P.wheel);
        return;
      }
      var f = h.face, run = h.ground && h.vx ? Math.sin(h.runT * 16) : 0, air = !h.ground;
      function X(v) { return x + v * f * s; }
      function R2(a, b, w, hh, c) { var xa = f > 0 ? X(a) : X(a) - w * s; rect(ctx, xa, y + b * s, w * s, hh * s, c); }
      // ноги
      if (air) { R2(-4, -9, 4, 7, P.heroD); R2(1, -11, 4, 7, P.heroD); }
      else { R2(-4 + run * 2, -10, 4, 10, P.heroD); R2(1 - run * 2, -10, 4, 10, P.heroD); R2(-5 + run * 2, -2, 5, 2, P.heroS); R2(1 - run * 2, -2, 5, 2, P.heroS); }
      // катушка-генератор за спиной
      R2(-8, -24, 4, 11, P.heroS); R2(-8, -22, 4, 2, P.wheel); R2(-8, -17, 4, 2, P.wheel);
      // торс — бронзовая кираса
      R2(-5, -22, 11, 12, P.heroB); R2(-5, -12, 11, 2, P.heroD);
      if (px) R2(0, -19, 2, 5, '#55ffff'); else { ctx.save(); bolt(ctx, X(0.5), y - 16 * s, 3.2 * s, P.wheel); ctx.restore(); }
      // плечо
      R2(-6, -24, 7, 5, P.heroS);
      // шлем: стальной купол, янтарная щель-визор, гребень-«молот»
      R2(-4, -31, 9, 8, P.heroS); R2(-2, -33, 5, 2, P.heroB); R2(-1, -34, 3, 1, P.heroB);
      glow(ctx, true, P.visor, 6); R2(0, -28, 5, 2, P.visor); glow(ctx, false);
      // ствол по прицелу (8 сторон)
      var a2 = h.beam.on ? { x: Math.cos(h.beam.ang), y: Math.sin(h.beam.ang) } : h.aim || { x: f, y: 0 };
      var ax = x + 3 * f * s, ay = y - 18 * s, len = 9 * s;
      ctx.strokeStyle = P.heroS; ctx.lineWidth = 4 * s; ctx.lineCap = px ? 'butt' : 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + a2.x * len, ay + a2.y * len); ctx.stroke();
      ctx.strokeStyle = P.heroB; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(ax + a2.x * len * 0.5, ay + a2.y * len * 0.5); ctx.lineTo(ax + a2.x * len, ay + a2.y * len); ctx.stroke();
      if (h.shotT > 0) { glow(ctx, true, P.accent, 10); circ(ctx, ax + a2.x * (len + 2), ay + a2.y * (len + 2), 2.5 * s, '#ffffff'); glow(ctx, false); }
    };
    // луч-кнут: дрожащая молния от ствола до точки упора
    api.beam = function (ctx, x0, y0, x1, y1, t) {
      var n = 8, dx = (x1 - x0) / n, dy = (y1 - y0) / n, nx = -dy, ny = dx, l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      glow(ctx, true, P.wheel, 14);
      for (var pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? '#ffffff' : P.wheel; ctx.lineWidth = pass ? 1.5 : (px ? 4 : 4.5);
        ctx.beginPath(); ctx.moveTo(x0, y0);
        for (var i = 1; i <= n; i++) { var j = i === n ? 0 : Math.sin(t * 50 + i * 2.3) * 2.5; ctx.lineTo(x0 + dx * i + nx * j, y0 + dy * i + ny * j); }
        ctx.stroke();
      }
      glow(ctx, false);
      circ(ctx, x1, y1, 3 + Math.sin(t * 40), '#ffffff');
    };
    api.bullet = function (ctx, b, x, y) {
      if (b.k === 'L') {
        var v = Math.hypot(b.vx, b.vy) || 1, lx = b.vx / v * b.len * T, ly = b.vy / v * b.len * T;
        glow(ctx, true, P.wcol.L, 8); ctx.strokeStyle = P.wcol.L; ctx.lineWidth = px ? 3 : 3; ctx.beginPath(); ctx.moveTo(x - lx, y - ly); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); glow(ctx, false);
      } else if (b.k === 'B') { circ(ctx, x, y, 3, P.wcol.B); rect(ctx, x - 1, y - 1, 2, 2, '#ffffff'); }
      else { circ(ctx, x, y, 2.5, P.wcol.S); rect(ctx, x - 1, y - 1, 2, 2, '#ffffff'); }
    };
    api.ebullet = function (ctx, b, x, y, t) {
      if (b.bomb) { circ(ctx, x, y, 5, P.foeLo); rect(ctx, x - 1, y - 8, 2, 3, Math.floor(t * 12) % 2 ? P.bad : P.warn); return; }
      glow(ctx, true, P.bad, 8); circ(ctx, x, y, b.r * T, P.ebul); glow(ctx, false); rect(ctx, x - 1, y - 1, 2, 2, '#ffffff');
    };
    api.boom = function (ctx, x, y, o) {
      var k = 1 - o.t / 0.35, r = o.r * T * (0.4 + 0.6 * k);
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (px) { rect(ctx, x - r, y - r / 3, r * 2, r * 2 / 3, P.warn); rect(ctx, x - r / 3, y - r, r * 2 / 3, r * 2, P.warn); rect(ctx, x - r / 2, y - r / 2, r, r, '#ffffff'); }
      else { var gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, P.warn); gr.addColorStop(1, 'rgba(255,90,40,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    };
    // молния: зигзаги на весь экран
    api.storm = function (ctx, W, H, t) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = px ? 3 : 2.5; glow(ctx, true, P.wheel, 20);
      for (var k = 0; k < 4; k++) {
        var x = ((k * 173 + Math.floor(t * 30) * 61) % W), y = L.HUD;
        ctx.beginPath(); ctx.moveTo(x, y);
        while (y < H) { y += 18 + (k * 7 + y) % 14; x += ((Math.floor(y * 3.7 + k * 11) % 31) - 15); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      glow(ctx, false);
    };
    // ---------- Иконки HUD ----------
    api.lifeIcon = function (ctx, x, y, s) {
      s = s || 1;
      rect(ctx, x - 4 * s, y - 8 * s, 8 * s, 6 * s, P.heroS); rect(ctx, x - 2 * s, y - 6 * s, 5 * s, 2 * s, P.visor); rect(ctx, x - 1 * s, y - 10 * s, 3 * s, 2 * s, P.heroB);
      rect(ctx, x - 4 * s, y - 2 * s, 8 * s, 3 * s, P.heroB);
    };
    api.weaponIcon = function (ctx, x, y, k) { circ(ctx, x, y + 3, 6, P.wcol[k]); ctx.fillStyle = px ? '#000' : '#10131a'; ctx.font = '900 8px ' + (px ? 'monospace' : 'Inter, system-ui, sans-serif'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((GR.wLabel || {})[k] || k, x, y + 3.5); ctx.textBaseline = 'alphabetic'; };
    api.boltIcon = function (ctx, x, y, on) { bolt(ctx, x, y + 3, 5, on ? P.wheel : P.barBg); };
    return api;
  }
  GR.makeRenderer = makeRenderer;

  GR.modern = makeRenderer({
    pixel: false, font: 'Inter, system-ui, sans-serif',
    bg2: '#0d0f14', panel: '#151820', panelA: 'rgba(16,18,26,.92)', line: '#3a4152', ink: '#f1eee8', muted: '#9aa2b2',
    accent: '#ffb347', good: '#5fe08a', bad: '#ff5d5d', warn: '#ffcc4d', wheel: '#7ff6ff', flash: '#e8fbff',
    hudBg: '#0d0f14', hudLine: '#2a2f3c', barBg: '#2a2f3c', mapBg: 'rgba(0,0,0,.5)', mapRoom: '#6b7a92',
    gem: '#ff7ae0', mast: '#8a93a6', mastOff: '#4a5164', mineC: '#c9792e',
    bonus: '#d98a36', bonusHi: '#ffd08a', bonusLo: '#5a3410', gate: '#7a1f24', gateHi: '#d0443a',
    foe: '#b9c0cc', foeLo: '#5c6472', eye: '#ff5a3a', ebul: '#ff7a4a', boss: '#8f97a6', bossLo: '#4a505d', bossHi: '#d98a36',
    heroB: '#d4843a', heroS: '#7d8798', heroD: '#3b4252', visor: '#ffc23a',
    wcol: { S: '#ffb347', L: '#7ff6ff', B: '#9cff7a' },
    zones: {
      foundry: { sky0: '#1c120e', sky1: '#3b1d10', far: 'rgba(255,140,60,.07)', rock: '#4c3a31', rock2: '#5b463b', deep: '#2a1f1a', lip: '#a8744c', lip2: '#6d4d38', under: '#2e221c', side: '#3c2e27', crack: '#8c6a54', plate: '#6b7480', plateHi: '#b4bdc9', plateLo: '#454c57' },
      steam: { sky0: '#0b171b', sky1: '#173238', far: 'rgba(140,230,230,.06)', rock: '#34474b', rock2: '#405559', deep: '#1b2729', lip: '#78a3a1', lip2: '#4c6d6c', under: '#1f2b2d', side: '#2c3c3f', crack: '#6c8c8c', plate: '#6d6a62', plateHi: '#b8b2a4', plateLo: '#46443e' },
      copper: { sky0: '#0d1610', sky1: '#1b3123', far: 'rgba(120,220,150,.06)', rock: '#3c4636', rock2: '#485341', deep: '#20261d', lip: '#6fb08a', lip2: '#4a7a5c', under: '#232a20', side: '#333c2e', crack: '#7e8f6c', plate: '#9a6a3c', plateHi: '#e0a46a', plateLo: '#5e3e22' },
      storm: { sky0: '#100d20', sky1: '#261d4a', far: 'rgba(170,150,255,.07)', rock: '#383352', rock2: '#433d60', deep: '#1d1a2c', lip: '#8f80d6', lip2: '#5f549a', under: '#221e34', side: '#2f2a46', crack: '#7a70a8', plate: '#5f6b80', plateHi: '#a9b8d0', plateLo: '#3d4556' }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
