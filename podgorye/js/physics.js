/* ПОДГОРЬЕ · physics.js — тайлы, константы и физика героини (общая для игры, графа проходимости и ботов).
   Координаты — в клетках комнаты: x — центр Огнёвки, y — подошвы; клетка (c, r) занимает [c, c+1) × [r, r+1).
   Без DOM, детерминирована: stepHero(h, inp, R, dt, ab, ev) — один шаг 1/60 с. */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};

  // ---------- тайлы ----------
  var T = { AIR: 0, ROCK: 1, ONE: 2, SPIKE: 3, CRACK: 4, IRON: 5, STEAM: 6, HEAT: 7, WATER: 8, LIGHT: 9, FALSE: 10, ICE: 11, SEAL: 12, SHUT: 13, HOTW: 14 };
  var CHARS = '.#=^CISH~LFiXBh';            // символ по коду (для отладки и тестов)
  var SOLID = new Uint8Array(16);           // «всегда твёрдые» для тела
  [T.ROCK, T.CRACK, T.IRON, T.ICE, T.FALSE, T.LIGHT, T.SEAL, T.SHUT].forEach(function (k) { SOLID[k] = 1; });
  function isWater(k) { return k === T.WATER || k === T.HOTW; }
  function isSteam(k) { return k === T.STEAM; }
  function isHeat(k) { return k === T.HEAT || k === T.HOTW; }

  // ---------- константы (клетки, секунды) ----------
  var K = {
    HW: 0.36, HH: 1.7,                         // полуширина и рост
    G: 62, MAXF: 22, RUN: 7.5,
    ACC: 95, ACC_AIR: 55, FRIC: 85, ICE_ACC: 14, ICE_FRIC: 5,
    JUMP: 22.5, CUT: 0.45, COYOTE: 0.08, BUF: 0.1,      // прыжок ≈ 4,1 клетки
    DJUMP: 19,                                 // паровые сапоги: второй прыжок ≈ +2,9
    DASH_V: 19, DASH_T: 0.17, DASH_CD: 0.32,   // рывок мехов ≈ 3,2 клетки
    SLIDE: 3.5, WJ_VX: 7, WJ_VY: 19, WJ_LOCK: 0.1,
    HOOK_R: 7, ROPE: 4, PUMP: 26, SWING_DAMP: 0.25, BRAKE: 4, REL_VY: 7,
    SLAM_V: 30,
    SWIM: 6, SWIM_ACC: 30, WATER_G: 18, BUOY: 58, WATER_DRAG: 3.2, WATER_RUN: 0.6,
    HEAT_KB: 14, STEAM_PUSH: 9,
    LIGHT_R: 4.5
  };

  // клетка комнаты; за краем — продолжение краевой клетки (проём → пусто, стена → камень)
  function tile(R, c, r) {
    if (c < 0 || c >= R.W || r < 0 || r >= R.H) {
      var cc = c < 0 ? 0 : c >= R.W ? R.W - 1 : c, rr = r < 0 ? 0 : r >= R.H ? R.H - 1 : r;
      var b = R.t[rr * R.W + cc];
      if (SOLID[b] || b === T.STEAM) return T.ROCK;
      return isWater(b) ? T.WATER : T.AIR;
    }
    return R.t[r * R.W + c];
  }
  function setTile(R, c, r, k) { if (c >= 0 && c < R.W && r >= 0 && r < R.H) R.t[r * R.W + c] = k; }

  // твёрдость клетки для героини: ONE — только сверху при падении; STEAM — пропускает рывок
  function solidFor(R, h, c, r, k, falling, prevY) {
    if (SOLID[k]) return true;
    if (k === T.STEAM) return !(h.dashT > 0) && !h.inSteam;
    if (k === T.ONE) return falling && prevY <= r + 1e-4 && !(h.dropT > 0);
    return false;
  }

  function newHero(x, y) {
    return { x: x, y: y, vx: 0, vy: 0, face: 1, ground: true, co: 0, jb: 0, dj: false, ad: false, dashT: 0, dashCd: 0,
      cling: 0, lockT: 0, lockD: 0, hook: null, slam: false, dropT: 0, wet: false, head: false, inSteam: false,
      pj: false, pd: false, ph: false, ps: false, hit: null, jumping: false, onIce: false, landV: 0, lastRing: -1, lastRingT: 0 };
  }

  function overlapsKind(R, h, pred) {
    var c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6), r0 = Math.floor(h.y - K.HH + 1e-6), r1 = Math.floor(h.y - 1e-6);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (pred(tile(R, c, r))) return true;
    return false;
  }
  function boxSolid(R, h, x, y) {
    var c0 = Math.floor(x - K.HW + 1e-6), c1 = Math.floor(x + K.HW - 1e-6), r0 = Math.floor(y - K.HH + 1e-6), r1 = Math.floor(y - 1e-6);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var k = tile(R, c, r); if (SOLID[k] || (k === T.STEAM && !(h.dashT > 0))) return true; }
    return false;
  }
  // ближайшее кольцо в радиусе крюка (выше центра героини); dir — если задан, только впереди
  function ringFor(R, h, dir) {
    var best = -1, bd = 1e9, cx = h.x, cy = h.y - K.HH / 2, rs = R.rings || [];
    for (var i = 0; i < rs.length; i++) {
      if (i === h.lastRing && h.lastRingT > 0) continue;   // только что отпущенное кольцо
      var o = rs[i], dx = o.x - cx, dy = o.y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > K.HOOK_R || dy > -0.8) continue;
      if (dir && dx * dir < -1.5) continue;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---------- шаг героини ----------
  // inp: { x:-1|0|1, y:-1|0|1, jump, dash, hook, slam } — удержания; фронты считаются здесь.
  // ab: { boots, dash, gloves, hook, hammer, bell, cloak, light }. ev(type, data) — события.
  function stepHero(h, inp, R, dt, ab, ev) {
    ev = ev || noop;
    var jE = inp.jump && !h.pj, dE = inp.dash && !h.pd, hE = inp.hook && !h.ph, sE = inp.slam && !h.ps;
    h.pj = !!inp.jump; h.pd = !!inp.dash; h.ph = !!inp.hook; h.ps = !!inp.slam;
    h.hit = null; h.landV = 0;
    if (h.dashCd > 0) h.dashCd -= dt;
    if (h.lockT > 0) h.lockT -= dt;
    if (h.dropT > 0) h.dropT -= dt;
    if (h.co > 0) h.co -= dt;
    if (h.lastRingT > 0) h.lastRingT -= dt;
    if (jE) h.jb = K.BUF; else if (h.jb > 0) h.jb -= dt;
    var ix = h.lockT > 0 ? h.lockD : (inp.x | 0);
    // проваливание сквозь мостки: ↓ + прыжок
    if (h.ground && inp.y > 0 && jE && !h.hook && standingOnOne(R, h)) { h.dropT = 0.2; h.ground = false; h.vy = 2; h.jb = 0; h.jumping = false; h.co = 0; }

    // --- на крюке: маятник длиной ROPE ---
    if (h.hook) {
      var hk = h.hook, ring = R.rings[hk.i];
      if (jE || hE || !ring) {
        h.hook = null; h.lastRing = hk.i; h.lastRingT = 0.35;
        if (jE) { h.vy = Math.min(h.vy, 0) - K.REL_VY; h.vx *= 1.1; ev('release'); }
        h.dj = false; h.ad = false; h.jb = 0; h.jumping = false;
        return;
      }
      var Lr = hk.L + (K.ROPE - hk.L) * Math.min(1, dt * 6); hk.L = Lr;
      var a = -(K.G / Lr) * Math.sin(hk.a);
      if (ix) { if (Math.abs(hk.w) < 0.4 || ix * hk.w > 0) a += ix * K.PUMP / Lr * Math.cos(hk.a); }
      if (inp.y > 0) a -= hk.w * K.BRAKE;
      hk.w += a * dt; hk.w *= 1 - K.SWING_DAMP * dt;
      var na = hk.a + hk.w * dt;
      if (na > 1.35) { na = 1.35; hk.w = Math.min(hk.w, 0); } else if (na < -1.35) { na = -1.35; hk.w = Math.max(hk.w, 0); }
      var nx = ring.x + Lr * Math.sin(na), ny = ring.y + Lr * Math.cos(na) + K.HH / 2;
      if (boxSolid(R, h, nx, ny)) { h.hook = null; h.vx = 0; h.vy = 0; ev('unhook'); return; }
      h.vx = (nx - h.x) / dt; h.vy = (ny - h.y) / dt; h.x = nx; h.y = ny; hk.a = na;
      if (ix) h.face = ix;
      h.ground = false; h.cling = 0;
      hazards(R, h, ab, ev);
      return;
    }

    var fw = R.fWater !== false;
    var wet = fw && isWater(tile(R, Math.floor(h.x), Math.floor(h.y - 0.85)));
    var head = fw && isWater(tile(R, Math.floor(h.x), Math.floor(h.y - 1.45)));
    if (wet && !h.wet) { ev('splash', { v: h.vy }); h.slam = false; h.dashT = 0; if (h.vy > 0) h.vy *= ab.bell ? 0.6 : 0.3; }
    h.wet = wet; h.head = head;
    h.inSteam = R.fSteam !== false && overlapsKind(R, h, isSteam);

    // --- рывок мехов ---
    if (dE && ab.dash && h.dashCd <= 0 && !wet && !h.slam && (h.ground || !h.ad)) {
      if (!h.ground) h.ad = true;
      h.dashT = K.DASH_T; h.dashCd = K.DASH_CD; h.cling = 0;
      if (ix) h.face = ix;
      h.vx = h.face * K.DASH_V; h.vy = 0; ev('dash');
    }
    // --- удар молотом вниз ---
    if (sE && ab.hammer && !h.ground && !wet && !h.slam) { h.slam = true; h.dashT = 0; h.cling = 0; h.vx = 0; h.vy = K.SLAM_V; ev('slam'); }
    // --- крюк ---
    if (hE && ab.hook && !h.ground && !wet && !h.slam) {
      var ri = ringFor(R, h, h.face);
      if (ri < 0) ri = ringFor(R, h, 0);
      if (ri >= 0) {
        var rg = R.rings[ri], dx = h.x - rg.x, dy = (h.y - K.HH / 2) - rg.y, L0 = Math.sqrt(dx * dx + dy * dy), an = Math.atan2(dx, dy);
        var w0 = (h.vx * Math.cos(an) - h.vy * Math.sin(an)) / Math.max(1, L0);
        h.hook = { i: ri, L: L0, a: an, w: w0 }; h.dashT = 0; h.cling = 0; ev('hook', { i: ri });
        return;
      }
    }

    var dashing = h.dashT > 0;
    if (dashing) { h.dashT -= dt; h.vy = 0; h.vx = h.face * K.DASH_V; }
    else if (h.slam) { h.vx = 0; h.vy = K.SLAM_V; }
    else {
      // горизонталь
      var ice = h.ground && h.onIce;
      var run = K.RUN * (wet && !ab.bell ? K.WATER_RUN : 1);
      var target = ix * run, acc;
      if (wet && ab.bell) { target = ix * K.SWIM; acc = K.SWIM_ACC; }
      else if (h.ground) acc = ix ? (ice ? K.ICE_ACC : K.ACC) : (ice ? K.ICE_FRIC : K.FRIC);
      else acc = K.ACC_AIR;
      if (h.vx < target) h.vx = Math.min(target, h.vx + acc * dt); else if (h.vx > target) h.vx = Math.max(target, h.vx - acc * dt);
      if (ix) h.face = ix;
      // прыжки
      if (h.jb > 0) {
        if (h.ground || h.co > 0) { h.vy = -K.JUMP; h.ground = false; h.co = 0; h.jb = 0; h.jumping = true; ev('jump'); }
        else if (h.cling) { h.vy = -K.WJ_VY; h.vx = -h.cling * K.WJ_VX; h.face = -h.cling; h.lockT = K.WJ_LOCK; h.lockD = -h.cling; h.cling = 0; h.jb = 0; h.dj = false; h.ad = false; h.jumping = true; ev('walljump'); }
        else if (wet && (!head || !ab.bell)) { h.vy = -K.JUMP * 0.92; h.jb = 0; h.jumping = true; ev('jump'); }
        else if (ab.boots && !h.dj && !wet) { h.vy = -K.DJUMP; h.dj = true; h.jb = 0; h.jumping = true; ev('djump'); }
      }
      if (h.jumping && !inp.jump && h.vy < 0) { h.vy *= K.CUT; h.jumping = false; }
      if (h.vy >= 0) h.jumping = false;
      // вертикаль
      if (wet) {
        if (ab.bell) {
          var ty = (inp.y || 0) * K.SWIM; if (inp.jump && head) ty = -K.SWIM;
          if (h.vy < ty) h.vy = Math.min(ty, h.vy + K.SWIM_ACC * dt); else if (h.vy > ty) h.vy = Math.max(ty, h.vy - K.SWIM_ACC * dt);
        } else {
          h.vy += K.WATER_G * dt;
          if (head) h.vy -= K.BUOY * dt;
          h.vy -= h.vy * K.WATER_DRAG * dt;
        }
      } else {
        h.vy = Math.min(K.MAXF, h.vy + K.G * dt);
        if (h.cling && h.vy > K.SLIDE) h.vy = K.SLIDE;
      }
    }
    if (h.inSteam && !dashing) { h.vx = -h.face * K.STEAM_PUSH; }

    // --- перемещение по X ---
    var wasGround = h.ground;
    var r0 = Math.floor(h.y - K.HH + 1e-6), r1 = Math.floor(h.y - 1e-6), r, c, k;
    h.x += h.vx * dt;
    var wall = 0;
    if (h.vx > 0) { c = Math.floor(h.x + K.HW - 1e-6); for (r = r0; r <= r1; r++) { k = tile(R, c, r); if (solidFor(R, h, c, r, k, false, 0)) { h.x = c - K.HW; h.vx = 0; wall = 1; if (dashing) h.dashT = 0; break; } } }
    else if (h.vx < 0) { c = Math.floor(h.x - K.HW + 1e-6); for (r = r0; r <= r1; r++) { k = tile(R, c, r); if (solidFor(R, h, c, r, k, false, 0)) { h.x = c + 1 + K.HW; h.vx = 0; wall = -1; if (dashing) h.dashT = 0; break; } } }
    // --- перемещение по Y ---
    var prevY = h.y, c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6);
    h.y += h.vy * dt; h.ground = false;
    if (h.vy > 0) {
      var fr = Math.floor(h.y);
      for (c = c0; c <= c1; c++) { k = tile(R, c, fr); if (solidFor(R, h, c, fr, k, true, prevY)) { landOn(h, fr, ev); break; } }
    } else if (h.vy < 0) {
      var hr = Math.floor(h.y - K.HH + 1e-6);
      for (c = c0; c <= c1; c++) { k = tile(R, c, hr); if (solidFor(R, h, c, hr, k, false, 0)) { h.y = hr + 1 + K.HH; h.vy = 0; h.jumping = false; break; } }
    }
    if (h.ground) {
      h.dj = false; h.ad = false; h.cling = 0; h.co = K.COYOTE;
      var under = tile(R, Math.floor(h.x), Math.floor(h.y + 0.01));
      h.onIce = under === T.ICE;
      if (h.slam) { h.slam = false; ev('slamLand', { x: h.x, y: h.y }); }
    } else if (wasGround && h.vy >= 0) { h.co = K.COYOTE; }
    // --- цепляние за стену (перчатки) ---
    if (!h.ground && ab.gloves && !wet && !h.slam && h.dashT <= 0) {
      var side = ix !== 0 ? ix : h.cling;
      if (side && touchWall(R, h, side) && h.vy > -6) { if (!h.cling) { h.vy = Math.max(h.vy, 0); ev('cling'); } h.cling = side; h.dj = false; h.ad = false; }
      else h.cling = 0;
      if (h.cling && ix === -h.cling) h.cling = 0;
    } else if (h.ground || wet) h.cling = 0;
    if (wall && h.cling === 0) h.wallHit = wall;
    hazards(R, h, ab, ev);
  }
  function landOn(h, fr, ev) { h.landV = h.vy; h.y = fr; h.vy = 0; h.ground = true; h.jumping = false; if (h.landV > 12) ev('land', { v: h.landV }); }
  function standingOnOne(R, h) {
    var c0 = Math.floor(h.x - K.HW + 1e-6), c1 = Math.floor(h.x + K.HW - 1e-6), r = Math.round(h.y), any = false;
    for (var c = c0; c <= c1; c++) { var k = tile(R, c, r); if (k === T.ONE) any = true; else if (SOLID[k]) return false; }
    return any;
  }
  function touchWall(R, h, side) {
    var c = side > 0 ? Math.floor(h.x + K.HW + 0.05) : Math.floor(h.x - K.HW - 0.05);
    var r0 = Math.floor(h.y - K.HH + 0.3), r1 = Math.floor(h.y - 0.3);
    for (var r = r0; r <= r1; r++) { var k = tile(R, c, r); if (!(SOLID[k] && k !== T.SHUT)) return false; }
    return true;
  }
  // шипы/расплав — удар; жар без плаща — ожог и отброс туда, откуда пришла
  function hazards(R, h, ab, ev) {
    if (R.fHaz === false) return;
    var c0 = Math.floor(h.x - K.HW + 0.1), c1 = Math.floor(h.x + K.HW - 0.1), r0 = Math.floor(h.y - K.HH + 0.2), r1 = Math.floor(h.y - 0.05);
    var spike = false, heat = false;
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var k = tile(R, c, r); if (k === T.SPIKE) spike = true; else if (isHeat(k)) heat = true; }
    if (heat && !ab.cloak) {
      h.hit = 'heat'; h.hook = null; h.slam = false; h.dashT = 0;
      var dx = -(h.vx || h.face), dy = h.vy;
      h.vx = (dx > 0 ? 1 : -1) * K.HEAT_KB * (Math.abs(h.vx) > 1 || !dy ? 1 : 0.3);
      h.vy = dy > 3 ? -K.HEAT_KB * 1.2 : dy < -3 ? K.HEAT_KB * 0.6 : -6;
      ev('heat');
    } else if (spike) { h.hit = 'spike'; ev('spike'); }
  }
  function noop() {}

  // ---------- группы клеток (ломкие полы, световые двери, ложные стены, печать) ----------
  function group(R, c, r) {
    var k0 = tile(R, c, r), out = [], seen = {}, st = [[c, r]];
    while (st.length && out.length < 200) {
      var p = st.pop(), key = p[0] + ',' + p[1];
      if (seen[key] || p[0] < 0 || p[1] < 0 || p[0] >= R.W || p[1] >= R.H) continue;
      seen[key] = 1;
      if (R.t[p[1] * R.W + p[0]] !== k0) continue;
      out.push(p); st.push([p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]);
    }
    return out;
  }

  // флаги комнаты для быстрых проверок (вода, пар, вред)
  function roomFlags(R) {
    var w = false, st = false, hz = false;
    for (var i = 0; i < R.t.length; i++) { var k = R.t[i]; if (k === T.WATER || k === T.HOTW) w = true; if (k === T.STEAM) st = true; if (k === T.SPIKE || k === T.HEAT || k === T.HOTW) hz = true; }
    R.fWater = w; R.fSteam = st; R.fHaz = hz; return R;
  }
  P.T = T; P.CHARS = CHARS; P.K = K; P.SOLID = SOLID;
  P.phys = { tile: tile, setTile: setTile, isWater: isWater, isHeat: isHeat, solidFor: solidFor, newHero: newHero, stepHero: stepHero,
    ringFor: ringFor, roomFlags: roomFlags, boxSolid: boxSolid, touchWall: touchWall, group: group, overlapsKind: overlapsKind, standingOnOne: standingOnOne };
})(typeof window !== 'undefined' ? window : globalThis);
