/* ПОДГОРЬЕ · bosses.js — боссы-механизмы (свои), арена 40×22, пол y = 19.
   BS.make(id, R) → босс; BS.update(B, G, dt) — паттерны атак. Части тела B.parts [{x,y,w,h}] — центр и размеры,
   B.weak — индексы уязвимых частей (по ним проходит урон). G: { hero, R, rng, shot(x,y,vx,vy,o), haz(o), spawn(type,x,y), ev(t,d) }.
   haz(o): { x0,y0,x1,y1, vx, life, warn, kind } — временная опасная зона (волна, струя, столб, луч); warn — предупреждение. */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};
  var FL = 19;

  var HP = { gatekeeper: 22, pump: 34, drill: 36, pendulum: 40, smelter: 44, smith: 48, scale: 100 };
  function make(id, R) {
    var B = { id: id, hp: HP[id], max: HP[id], st: 'intro', t: 0, cyc: 0, phase: 1, face: -1, flash: 0, dead: false, parts: [], weak: [0], d: {} };
    switch (id) {
      case 'gatekeeper': B.x = 30; B.y = FL - 2.3; B.parts = [{ x: 30, y: FL - 2.3, w: 3.4, h: 4.6 }]; break;
      case 'pump': B.x = 20; B.y = 6.2; B.parts = [{ x: 20, y: 6.2, w: 4.4, h: 4.4 }]; break;
      case 'drill': B.x = 44; B.y = FL - 1; B.parts = [{ x: 44, y: FL - 1, w: 3.6, h: 1.6 }]; break;
      case 'pendulum': B.x = 20; B.y = 1; B.d.a = 0.9; B.d.w = 0; B.parts = [{ x: 20, y: 14, w: 3.2, h: 3.2 }]; break;
      case 'smelter': B.x = 31; B.y = FL - 2.6; B.parts = [{ x: 31, y: FL - 2.6, w: 4.2, h: 5.2 }]; break;
      case 'smith': B.x = 20; B.y = 5; B.parts = [{ x: 20, y: 5, w: 3, h: 3 }, { x: 12, y: 8, w: 2.6, h: 2 }, { x: 28, y: 8, w: 2.6, h: 2 }]; B.d.hm = [{ x: 12, y: 8, st: 'float', t: 0 }, { x: 28, y: 8, st: 'float', t: 0.8 }]; break;
      case 'scale': B.x = 20; B.y = 7; B.parts = [{ x: 20, y: 7, w: 4.2, h: 4.2 }]; break;
    }
    return B;
  }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function aimShot(G, x, y, sp, spread, n, o) {
    var h = G.hero, a0 = Math.atan2((h.y - 0.9) - y, h.x - x);
    for (var i = 0; i < n; i++) { var a = a0 + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0); G.shot(x, y, Math.cos(a) * sp, Math.sin(a) * sp, o || {}); }
  }
  function ring(G, x, y, sp, n, off, o) { for (var i = 0; i < n; i++) { var a = off + i / n * Math.PI * 2; G.shot(x, y, Math.cos(a) * sp, Math.sin(a) * sp, o || {}); } }

  function update(B, G, dt) {
    if (B.dead) return;
    B.t += dt; if (B.flash > 0) B.flash -= dt;
    var h = G.hero, rage = B.hp < B.max / 2 ? 1.25 : 1, p0 = B.parts[0];
    if (B.st === 'intro') { if (B.t > 1.1) { B.st = 'idle'; B.t = 0; } return; }
    switch (B.id) {
      // ---------- Привратник: шагающий страж ворот ----------
      case 'gatekeeper': {
        var dir = sgn(h.x - B.x);
        if (B.st === 'idle') { if (B.t > 0.5 / rage) { B.st = ['walk', 'slam', 'rivets', 'walk', 'charge', 'slam'][B.cyc++ % 6]; B.t = 0; B.face = dir; } }
        else if (B.st === 'walk') { B.face = dir; if (Math.abs(h.x - B.x) > 4) B.x += dir * 2.0 * rage * dt; if (B.t > 1.2) { B.st = 'idle'; B.t = 0; } }
        else if (B.st === 'slam') {
          if (B.t > 0.65 / rage && !B.d.done) { B.d.done = 1; G.ev('slam', { x: B.x, y: FL }); [-1, 1].forEach(function (s) { G.haz({ x0: B.x - 0.6, x1: B.x + 0.6, y0: FL - 1.1, y1: FL, vx: s * 9 * rage, life: 3, warn: 0, kind: 'wave' }); }); }
          if (B.t > 1.2) { B.st = 'idle'; B.t = 0; B.d.done = 0; }
        } else if (B.st === 'rivets') {
          if (B.t > 0.55 && !B.d.done) { B.d.done = 1; aimShot(G, B.x + B.face * 1.4, B.y - 1.2, 8, 0.5, 3, { kind: 'rivet' }); G.ev('eshot', {}); }
          if (B.t > 1.0 && B.d.done === 1 && rage > 1) { B.d.done = 2; aimShot(G, B.x + B.face * 1.4, B.y - 1.2, 8, 0.5, 3, { kind: 'rivet' }); }
          if (B.t > 1.3) { B.st = 'idle'; B.t = 0; B.d.done = 0; }
        } else if (B.st === 'charge') {
          if (B.t < 0.7) { B.face = dir; }
          else { B.x += B.face * 11 * dt; if (B.x < 3 || B.x > 37) { B.x = Math.max(3, Math.min(37, B.x)); B.st = 'stun'; B.t = 0; G.ev('thud', { x: B.x }); } }
        } else if (B.st === 'stun') { if (B.t > 0.9) { B.st = 'idle'; B.t = 0; } }
        B.x = Math.max(3, Math.min(37, B.x)); p0.x = B.x;
        var low = B.st === 'charge' && B.t >= 0.7;   // таран — пригнувшись, можно перепрыгнуть
        p0.h = low ? 2.2 : 4.6; p0.y = FL - p0.h / 2; B.y = p0.y;
        break;
      }
      // ---------- Насос: висит под сводом, бьёт струями ----------
      case 'pump': {
        B.x += Math.sin(B.t * 0.9 * rage + B.cyc) * 3.2 * dt + sgn(h.x - B.x) * 0.6 * dt; B.x = Math.max(6, Math.min(34, B.x));
        B.y = 6.2 + Math.sin(B.t * 2) * 0.4;
        B.d.next = (B.d.next || 0) - dt;
        if (B.d.next <= 0) {
          var k = B.cyc++ % 3;
          if (k === 0) { G.haz({ x0: h.x - 1.1, x1: h.x + 1.1, y0: 0, y1: FL, vx: 0, life: 0.8, warn: 0.75 / rage, kind: 'jet' }); G.ev('warn', {}); }
          else if (k === 1) { for (var i = 0; i < 5; i++) G.shot(B.x + (i - 2) * 0.8, B.y + 2.2, (i - 2) * 1.4, 2.5, { kind: 'bubble', life: 6, hp: 1 }); G.ev('eshot', {}); }
          else { ring(G, B.x, B.y + 1.8, 7, 9, Math.PI * 0.08, { kind: 'drop', down: 1 }); G.ev('eshot', {}); }
          B.d.next = 1.7 / rage;
        }
        p0.x = B.x; p0.y = B.y;
        break;
      }
      // ---------- Бур: таранит из стен, роняет сосульки ----------
      case 'drill': {
        if (B.st === 'idle') {
          B.d.n = (B.d.n || 0) + 1;
          if (B.d.n % 4 === 0) { B.st = 'rise'; B.t = 0; B.d.rx = Math.max(4, Math.min(36, h.x)); G.ev('warn', {}); }
          else { B.st = 'aim'; B.t = 0; B.d.side = h.x < 20 ? 1 : -1; B.d.yy = Math.max(9, Math.min(FL - 0.8, h.y - 0.9)); B.x = B.d.side > 0 ? 41 : -1; B.y = B.d.yy; G.ev('warn', {}); }
        } else if (B.st === 'aim') {
          if (B.t > 0.7 / rage) { B.st = 'ram'; B.t = 0; }
        } else if (B.st === 'ram') {
          B.x -= B.d.side * 14 * rage * dt;
          if ((B.d.side > 0 && B.x < -2) || (B.d.side < 0 && B.x > 42)) { B.st = 'idle'; B.t = 0; G.ev('thud', {});
            for (var j = 0; j < 3; j++) { var cx = 4 + Math.floor(G.rng() * 32); G.haz({ x0: cx - 0.4, x1: cx + 0.4, y0: 1, y1: 2.4, vy: 16, life: 2, warn: 0.5, kind: 'icicle' }); } }
        } else if (B.st === 'rise') {
          B.x = B.d.rx; B.y = FL + 2;
          if (B.t > 0.8) { B.st = 'out'; B.t = 0; G.ev('slam', { x: B.x, y: FL }); G.haz({ x0: B.x - 1.4, x1: B.x + 1.4, y0: FL - 4, y1: FL, vx: 0, life: 0.35, warn: 0, kind: 'burst' }); }
        } else if (B.st === 'out') {
          B.y = FL - 1.8;
          if (B.t > 2.2) { B.st = 'idle'; B.t = 0; B.y = FL + 3; }
        }
        p0.x = B.x; p0.y = B.y; p0.w = B.st === 'out' || B.st === 'rise' ? 1.8 : 3.6; p0.h = B.st === 'out' || B.st === 'rise' ? 3.4 : 1.6;
        break;
      }
      // ---------- Маятник: качается ядро-противовес на цепи ----------
      case 'pendulum': {
        var L = 13, amp = rage > 1 ? 1.05 : 0.85;
        B.d.w += (-(30 / L) * Math.sin(B.d.a)) * dt; B.d.a += B.d.w * dt;
        if (Math.abs(B.d.a) < 0.05 && Math.abs(B.d.w) < Math.sqrt(2 * 30 / L * (1 - Math.cos(amp)))) B.d.w = sgn(B.d.w) * Math.sqrt(2 * 30 / L * (1 - Math.cos(amp)));
        p0.x = B.x + Math.sin(B.d.a) * L; p0.y = B.y + Math.cos(B.d.a) * L;
        B.d.next = (B.d.next || 2) - dt;
        if (B.d.next <= 0) {
          if (B.cyc++ % 2 === 0) { for (var s = 0; s < 3; s++) G.shot(p0.x, p0.y, (s - 1) * 4 + sgn(h.x - p0.x) * 2, -9, { kind: 'seed', g: 1 }); G.ev('eshot', {}); }
          else { [h.x, 40 - h.x].forEach(function (x) { G.haz({ x0: x - 0.8, x1: x + 0.8, y0: FL - 5, y1: FL, vx: 0, life: 0.7, warn: 0.8 / rage, kind: 'vine' }); }); G.ev('warn', {}); }
          B.d.next = 2.2 / rage;
        }
        break;
      }
      // ---------- Плавильщик: ковш-голем, волны расплава ----------
      case 'smelter': {
        var dr = sgn(h.x - B.x); B.face = dr;
        B.x += dr * 0.9 * dt; B.x = Math.max(5, Math.min(35, B.x));
        B.d.next = (B.d.next || 1) - dt;
        if (B.d.next <= 0) {
          var m = B.cyc++ % 3;
          if (m === 0) { G.haz({ x0: B.x - 0.8, x1: B.x + 0.8, y0: FL - 1.2, y1: FL, vx: dr * 7 * rage, life: 4, warn: 0.3, kind: 'slag' }); G.ev('slam', { x: B.x, y: FL }); }
          else if (m === 1) { for (var q = 0; q < 3; q++) { var tx = h.x + (q - 1) * 3, tt = 1.1, vx = (tx - B.x) / tt; G.shot(B.x, B.y - 2, vx, -(20 * tt) / 2 + (B.y - 2 - FL) / tt, { kind: 'glob', g: 1, gk: 20 }); } G.ev('eshot', {}); }
          else { G.haz({ x0: h.x - 1, x1: h.x + 1, y0: 3, y1: FL, vx: 0, life: 0.6, warn: 0.75 / rage, kind: 'pillar' }); G.ev('warn', {}); }
          B.d.next = 1.6 / rage;
        }
        p0.x = B.x; p0.y = B.y;
        break;
      }
      // ---------- Молотобоец: два молота и голова-наковальня ----------
      case 'smith': {
        B.x = 20 + Math.sin(B.t * 0.6) * 6; B.y = 4.5 + Math.sin(B.t * 1.3) * 0.6;
        B.d.hm.forEach(function (H, i) {
          H.t += dt;
          if (H.st === 'float') { var hx = B.x + (i ? 7 : -7), hy = 8; H.x += (hx - H.x) * 3 * dt; H.y += (hy - H.y) * 3 * dt; if (H.t > 2.4 / rage) { H.st = (B.cyc++ % 3 === 2) ? 'sweepW' : 'aim'; H.t = 0; H.tx = h.x; G.ev('warn', {}); } }
          else if (H.st === 'aim') { H.x += (H.tx - H.x) * 6 * dt; H.y += (4 - H.y) * 4 * dt; if (H.t > 0.65 / rage) { H.st = 'fall'; H.t = 0; } }
          else if (H.st === 'fall') { H.y += 26 * dt; if (H.y >= FL - 1) { H.y = FL - 1; H.st = 'rest'; H.t = 0; G.ev('slam', { x: H.x, y: FL }); [-1, 1].forEach(function (s) { G.shot(H.x, FL - 0.5, s * 8, -6, { kind: 'ember', g: 1 }); G.shot(H.x, FL - 0.5, s * 5, -10, { kind: 'ember', g: 1 }); }); } }
          else if (H.st === 'rest') { if (H.t > 0.7) { H.st = 'float'; H.t = 0; } }
          else if (H.st === 'sweepW') { H.side = H.x < 20 ? -1 : 1; H.x += (H.side * 21 + 20 - H.x) * 4 * dt; H.y += (FL - 1.1 - H.y) * 4 * dt; if (H.t > 0.8) { H.st = 'sweep'; H.t = 0; } }
          else if (H.st === 'sweep') { H.x -= H.side * 16 * dt; if (Math.abs(H.x - 20) > 21 && H.t > 0.5) { H.st = 'float'; H.t = 0; } }
          B.parts[i + 1].x = H.x; B.parts[i + 1].y = H.y;
        });
        p0.x = B.x; p0.y = B.y;
        break;
      }
      // ---------- Окалина: финальный, две фазы ----------
      case 'scale': {
        if (B.phase === 1 && B.hp <= 50) { B.phase = 2; B.st = 'shed'; B.t = 0; G.ev('phase2', {}); p0.w = 2.6; p0.h = 2.6; }
        if (B.st === 'shed') { if (B.t > 1.5) { B.st = 'idle'; B.t = 0; } break; }
        var sp2 = B.phase === 2 ? 1.5 : 1;
        B.x = 20 + Math.sin(B.t * 0.7 * sp2) * 12; B.y = 7 + Math.sin(B.t * 1.4 * sp2) * 2.5;
        B.d.next = (B.d.next || 1.5) - dt; B.d.spawn = (B.d.spawn || 6) - dt;
        if (B.d.next <= 0) {
          var kk = B.cyc++ % (B.phase === 2 ? 3 : 2);
          if (kk === 0) { ring(G, B.x, B.y, 6.5, B.phase === 2 ? 12 : 8, B.t, { kind: 'slagball' }); G.ev('eshot', {}); }
          else if (kk === 1) { aimShot(G, B.x, B.y, 9, 0.6, B.phase === 2 ? 5 : 3, { kind: 'slagball' }); G.ev('eshot', {}); }
          else { var yb = FL - 0.9; G.haz({ x0: 1, x1: 39, y0: yb - 0.5, y1: yb + 0.5, vx: 0, life: 0.5, warn: 1.0, kind: 'beam' }); G.ev('warn', {}); }
          B.d.next = (B.phase === 2 ? 1.5 : 2.3);
        }
        if (B.d.spawn <= 0) { G.spawn('spark', B.x - 2, B.y + 2); G.spawn('spark', B.x + 2, B.y + 2); B.d.spawn = B.phase === 2 ? 7 : 9; }
        if (B.phase === 2) { B.d.rain = (B.d.rain || 0) - dt; if (B.d.rain <= 0) { var rx = 2 + G.rng() * 36; G.haz({ x0: rx - 0.4, x1: rx + 0.4, y0: 1, y1: 2, vy: 14, life: 2, warn: 0.6, kind: 'drip' }); B.d.rain = 0.55; } }
        p0.x = B.x; p0.y = B.y;
        break;
      }
    }
  }
  // попадание по боссу: urom — уязвимые части
  function hitPart(B, x, y, pad) {
    pad = pad || 0;
    for (var i = 0; i < B.parts.length; i++) {
      var p = B.parts[i];
      if (Math.abs(x - p.x) < p.w / 2 + pad && Math.abs(y - p.y) < p.h / 2 + pad) return { part: i, weak: B.weak.indexOf(i) >= 0 };
    }
    return null;
  }
  P.BS = { HP: HP, make: make, update: update, hitPart: hitPart };
})(typeof window !== 'undefined' ? window : globalThis);
