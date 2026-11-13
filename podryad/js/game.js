/* ПОДРЯД · логика задания (без DOM, детерминирована при заданном rng).
   Вертикальный скролл-шутер: пилот-подрядчик мастерской «Гефест» на крыле-толкаче расчищает небесный путь от машин
   Ржавой артели. Внизу проплывают парящие острова с цехами, складами и зенитными лебёдками (разрушаемые — дают деньги),
   в воздухе — волны, мид-босс (клёпаный дирижабль), у третьего задания сектора — босс.
   Поле 440×640 (x вправо, y вниз), фикс-шаг 1/60 с. Броня + щит (щит подзаряжается после паузы в попаданиях).
   PODRYAD.Game(opts) → api; PODRYAD.logic — константы для тестов/бота/рендера.
   opts: { load: {gun, guns, mods, mega, cells, gen, armor} (снаряжение из ангара), diff, si, mj, rng, onEvent, noHit }. */
(function (global) {
  'use strict';
  var P = global.PODRYAD = global.PODRYAD || {};
  var D = P.DATA, TAU = Math.PI * 2;
  var K = { FW: 440, FH: 640, STEP: 1 / 60, SPD: 240, PR: 9, PX0: 220, PY0: 560, INV_HIT: 0.22, SDELAY: 2.4,
    BULLET_DMG: 12, RAM_DMG: 24, MEGA_DMG: 70, END_WAIT: 2.2, ZEP_LEAVE: 26, MAGNET: 70 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // огонь основного орудия: → массив выстрелов {x,y,vx,vy,dmg,k,pierce,splash}
  function gunVolley(gun, lv, x, y) {
    var o = [], i, a;
    switch (gun) {
      case 'rivet': { // двойная очередь: 2..4 болта, урон растёт
        var n = [2, 2, 3, 4, 4][lv - 1], dm = [1, 1.35, 1.3, 1.25, 1.6][lv - 1];
        for (i = 0; i < n; i++) o.push({ x: x + (i - (n - 1) / 2) * 8, y: y - 10, vx: 0, vy: -720, dmg: dm, k: 0 });
        break;
      }
      case 'fan': { // разлёт
        var m = [3, 5, 5, 7, 7][lv - 1], sp = [0.16, 0.24, 0.26, 0.34, 0.36][lv - 1], d2 = [1, 1, 1.25, 1.2, 1.45][lv - 1];
        for (i = 0; i < m; i++) { a = -Math.PI / 2 + (i - (m - 1) / 2) * (sp * 2 / (m - 1)); o.push({ x: x, y: y - 10, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, dmg: d2, k: 1 }); }
        break;
      }
      case 'hammer': // тяжёлый снаряд с разрывом
        o.push({ x: x, y: y - 14, vx: 0, vy: -440, dmg: 5 + lv * 1.5, k: 2, splash: 32 + lv * 5 });
        if (lv >= 4) { o.push({ x: x - 14, y: y - 4, vx: -40, vy: -430, dmg: 3 + lv, k: 2, splash: 26 + lv * 3 }); o.push({ x: x + 14, y: y - 4, vx: 40, vy: -430, dmg: 3 + lv, k: 2, splash: 26 + lv * 3 }); }
        break;
      case 'arc': { // пробивающие разряды
        var ln = [1, 1, 2, 2, 3][lv - 1], dd = 2 + lv * 0.6;
        for (i = 0; i < ln; i++) o.push({ x: x + (i - (ln - 1) / 2) * 12, y: y - 12, vx: 0, vy: -900, dmg: dd, k: 3, pierce: 1 });
        break;
      }
    }
    return o;
  }
  var GUN_IV = { rivet: 1 / 9, fan: 1 / 6, hammer: 0, arc: 1 / 5 };
  function gunIv(gun, lv) { return gun === 'hammer' ? 1 / (2 + lv * 0.3) : GUN_IV[gun]; }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || D.mulberry32(7), emit = opts.onEvent || function () {};
    var DF0 = D.DIFF[opts.diff] || D.DIFF.normal;
    var si = opts.si || 0, mj = opts.mj || 0, M = D.buildMission(si, mj);
    var ld = opts.load || {}, uid = 1;
    var hpMul = DF0.hp * (1 + 0.12 * M.h), payMul = 1 + 0.25 * si;
    // дальше по кампании артель стреляет чаще и быстрее
    var DF = { hp: DF0.hp, dmg: DF0.dmg, rate: DF0.rate * (1 + 0.1 * M.h), bspd: DF0.bspd * (1 + 0.05 * M.h) };
    var S = {
      FW: K.FW, FH: K.FH, si: si, mj: mj, h: M.h, mission: M, diff: opts.diff || 'normal',
      t: 0, d: 0, phase: 'play', endT: 0, ok: false, money: 0, kills: 0, gkills: 0, wi: 0, gi: 0, ii: 0,
      P: { x: K.PX0, y: K.PY0, vx: 0, armor: ld.armor == null ? D.ARMOR_MAX : ld.armor, shield: D.shieldCap(ld.gen || 0), scap: D.shieldCap(ld.gen || 0),
        sreg: D.shieldRegen(ld.gen || 0), sdl: 0, inv: 0, fireT: 0, modT: [0.3, 0.6], gun: ld.gun || 'rivet', guns: Object.assign({ rivet: 1 }, ld.guns || {}),
        mods: (ld.mods || [null, null]).slice(), mega: ld.mega || 0, cells: ld.cells || 0, gen: ld.gen || 0, scy: 0, hitT: 0, bank: 0 },
      shots: [], eb: [], E: [], G: [], isles: [], items: [], boss: null, flash: 0, bossDone: false
    };
    if (ld.guns && !ld.guns.rivet) delete S.P.guns.rivet;
    if (!S.P.guns[S.P.gun]) S.P.gun = Object.keys(S.P.guns)[0];
    var inp = { dx: 0, dy: 0, mx: 0, my: 0 };

    function pay(v, x, y) { v = Math.round(v * payMul); S.money += v; emit('pay', x, y, v); }
    function hurt(dmg) {
      if (opts.noHit || S.phase !== 'play' && S.phase !== 'boss') return;
      var p = S.P; if (p.inv > 0) return;
      dmg *= DF.dmg; p.sdl = K.SDELAY; p.inv = K.INV_HIT; p.hitT = 0.25;
      var a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a;
      if (dmg > 0) { p.armor -= dmg; emit('hit', p.x, p.y, 1); } else emit('shieldHit', p.x, p.y);
      if (p.armor <= 0) { p.armor = 0; S.shots.length = 0; S.phase = 'dead'; S.endT = 1.6; S.ok = false; emit('die', p.x, p.y); }
    }
    function fireAt(x, y, tx, ty, spd, r) { var a = Math.atan2(ty - y, tx - x); S.eb.push({ x: x, y: y, vx: Math.cos(a) * spd * DF.bspd, vy: Math.sin(a) * spd * DF.bspd, r: r || 4.5 }); }
    function fireAng(x, y, a, spd, r) { S.eb.push({ x: x, y: y, vx: Math.cos(a) * spd * DF.bspd, vy: Math.sin(a) * spd * DF.bspd, r: r || 4.5 }); }

    // ---------- появление ----------
    function spawnWave(w) {
      var A = D.AIR[w.kind];
      for (var i = 0; i < w.n; i++) {
        var e = { id: uid++, kind: w.kind, form: w.form, i: i, hp: A.hp * hpMul, max: A.hp * hpMul, r: A.r, x: w.x, y: -30, vx: 0, vy: 0, t: -i * 0.35, fireT: A.fire ? A.fire * (0.6 + rng() * 0.8) / DF.rate : 0, side: w.side, x0: w.x, on: true };
        switch (w.form) {
          case 'line': e.x = clamp(w.x, 30, K.FW - 30); e.y = -30 - i * 44; e.t = 0; break;
          case 'vee': e.x = clamp(w.x + (i - (w.n - 1) / 2) * 40, 24, K.FW - 24); e.y = -30 - Math.abs(i - (w.n - 1) / 2) * 34; e.t = 0; break;
          case 'sine': e.x0 = clamp(w.x, 80, K.FW - 80); e.x = e.x0; e.y = -30 - i * 46; e.t = 0; break;
          case 'sweep': e.x = w.side < 0 ? -30 - i * 40 : K.FW + 30 + i * 40; e.y = 50 + i * 6; e.t = 0; break;
          case 'dive': e.x = clamp(60 + (K.FW - 120) * (w.n > 1 ? i / (w.n - 1) : 0.5), 40, K.FW - 40); e.y = -30 - i * 30; e.t = 0; e.st = 0; break;
          case 'hover': e.x = clamp(w.x + (i - (w.n - 1) / 2) * 110, 50, K.FW - 50); e.y = -40; e.ty = 100 + i * 30; e.t = 0; break;
        }
        S.E.push(e);
      }
    }
    function spawnBoss(id, mid) {
      var B = D.BOSSES[id], hp = B.hp * DF.hp * (1 + 0.1 * si);
      S.boss = { id: id, mid: !!mid, hp: hp, max: hp, r: B.r, x: K.FW / 2, y: -90, t: 0, fireT: 1.6, ph: 0, a: 0, dead: false, leaveT: mid ? K.ZEP_LEAVE : 0 };
      if (!mid) S.phase = 'boss';
      emit(mid ? 'midboss' : 'boss', id);
    }

    // ---------- поведение врагов ----------
    function moveAir(e, dt) {
      if (e.fl > 0) e.fl -= dt;
      e.t += dt; if (e.t < 0) return;
      var A = D.AIR[e.kind], sp = e.kind === 'barrel' || e.kind === 'tug' ? 70 : e.kind === 'kite' ? 115 : 135;
      switch (e.form) {
        case 'line': case 'vee': e.y += sp * dt; break;
        case 'sine': e.y += sp * 0.9 * dt; e.x = e.x0 + Math.sin(e.t * 2.4 + e.i * 0.6) * 64; break;
        case 'sweep': e.x += -e.side * 170 * dt; e.y += (40 + Math.sin(e.t * 1.6) * 60) * dt; if (e.x < -80 || e.x > K.FW + 80) e.on = e.t < 0.5; break;
        case 'dive':
          if (e.st === 0) { e.y += 160 * dt; if (e.y > 110 + e.i * 14) { e.st = 1; e.tw = 0.45; } }
          else if (e.st === 1) { e.tw -= dt; e.x += clamp(S.P.x - e.x, -1, 1) * 90 * dt; if (e.tw <= 0) { e.st = 2; e.vx = clamp((S.P.x - e.x) * 0.9, -160, 160); } }
          else { e.y += 330 * dt; e.x += e.vx * dt; }
          break;
        case 'hover':
          if (e.y < e.ty && e.t < 10) e.y += 90 * dt;
          else if (e.t < 10) e.x = clamp(e.x + Math.sin(e.t * 0.9 + e.i) * 60 * dt, 40, K.FW - 40);
          else e.y += 80 * dt;
          break;
      }
      if (e.y > K.FH + 60) e.on = false;
      // огонь
      if (A.fire && e.y > 20 && e.y < K.FH * 0.66) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = A.fire / DF.rate * (0.85 + rng() * 0.3);
          var p = S.P;
          if (e.kind === 'kite') { fireAt(e.x, e.y + 8, p.x, p.y, 240); fireAt(e.x, e.y + 8, p.x + (rng() - 0.5) * 60, p.y, 200); }
          else if (e.kind === 'gnat') { if (M.h >= 1 || rng() < 0.5) fireAt(e.x, e.y + 6, p.x, p.y, 200, 4); }
          else if (e.kind === 'barrel') { var a0 = Math.atan2(p.y - e.y, p.x - e.x); for (var k = -1; k <= 1; k++) fireAng(e.x, e.y + 10, a0 + k * 0.24, 195); }
          else if (e.kind === 'tug') { var off = rng() * TAU; for (var j = 0; j < 12; j++) fireAng(e.x, e.y, off + j * TAU / 12, 140, 5); emit('ring', e.x, e.y); }
        }
      }
    }
    function moveBoss(b, dt) {
      b.t += dt; if (b.fl > 0) b.fl -= dt; var p = S.P;
      var ty = b.mid ? 96 : 116;
      if (b.y < ty) b.y += 70 * dt;
      else b.x = K.FW / 2 + Math.sin(b.t * (b.mid ? 0.55 : 0.45)) * (K.FW / 2 - b.r - 16);
      if (b.mid) { b.leaveT -= dt; if (b.leaveT <= 0) { b.y -= 140 * dt; if (b.y < -120) { S.boss = null; emit('bossLeft'); } return; } }
      if (b.y < ty - 4) return;
      var frac = b.hp / b.max; b.ph = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
      b.fireT -= dt; if (b.fireT > 0) return;
      var r8 = DF.rate * (!b.mid && b.t > 70 ? 1.8 : 1), i, a;   // босс сектора «звереет» после 70 с — без снаряжения не выстоять
      switch (b.id) {
        case 'zep':
          if (((b.t * 10) | 0) % 2) { a = Math.atan2(p.y - b.y, p.x - b.x); for (i = -2; i <= 2; i++) fireAng(b.x, b.y + 20, a + i * 0.2, 160); }
          else { fireAt(b.x - 34, b.y + 10, p.x, p.y, 200); fireAt(b.x + 34, b.y + 10, p.x, p.y, 200); }
          b.fireT = 1.1 / r8; break;
        case 'crane':
          if (b.ph === 0) { for (i = 0; i < 3; i++) fireAt(b.x + (i - 1) * 40, b.y + 30, p.x, p.y, 210); b.fireT = 1.1 / r8; }
          else if (b.ph === 1) { b.a += 0.5; for (i = 0; i < 7; i++) fireAng(b.x, b.y + 30, Math.PI / 2 + Math.sin(b.a) * 0.6 + (i - 3) * 0.16, 170); b.fireT = 1.0 / r8; }
          else { var o = rng() * TAU; for (i = 0; i < 12; i++) fireAng(b.x, b.y, o + i * TAU / 12, 140, 5); fireAt(b.x, b.y + 30, p.x, p.y, 230); b.fireT = 1.15 / r8; }
          break;
        case 'lock': // стенка заклёпок с проходом + прицельные молоты
          if (b.ph === 0 || ((b.t * 2) | 0) % 2) {
            var gap = clamp(p.x + (rng() - 0.5) * 120, 60, K.FW - 60);
            for (var x = 16; x < K.FW; x += 30) if (Math.abs(x - gap) > 46) S.eb.push({ x: x, y: b.y + 40, vx: 0, vy: 120 * DF.bspd, r: 5 });
            b.fireT = (b.ph === 2 ? 1.4 : 1.8) / r8;
          } else { for (i = -3; i <= 3; i++) fireAng(b.x, b.y + 40, Math.PI / 2 + i * 0.22, 180); fireAt(b.x - 50, b.y, p.x, p.y, 220); fireAt(b.x + 50, b.y, p.x, p.y, 220); b.fireT = 1.1 / r8; }
          break;
        case 'elder':
          b.a += 0.37;
          if (b.ph === 0) { for (i = 0; i < 4; i++) fireAng(b.x, b.y + 20, b.a + i * TAU / 4, 150); b.fireT = 0.32 / r8; }
          else if (b.ph === 1) { for (i = 0; i < 5; i++) fireAng(b.x, b.y + 20, b.a + i * TAU / 5, 150); if ((b.t | 0) % 2) fireAt(b.x, b.y + 40, p.x, p.y, 240); b.fireT = 0.36 / r8; }
          else { for (i = 0; i < 6; i++) { fireAng(b.x, b.y + 20, b.a + i * TAU / 6, 155); } fireAt(b.x - 60, b.y + 20, p.x, p.y, 230); fireAt(b.x + 60, b.y + 20, p.x, p.y, 230); b.fireT = 0.42 / r8; }
          break;
      }
    }

    // ---------- урон по целям ----------
    function damageAir(e, d) {
      if (!e.on || e.hp <= 0) return; e.hp -= d; e.fl = 0.06; emit('ehit', e.x, e.y);
      if (e.hp <= 0) {
        e.on = false; S.kills++; pay(D.AIR[e.kind].pay, e.x, e.y); emit('kill', e.x, e.y, e.kind);
        var ch = e.kind === 'tug' ? 1 : e.kind === 'barrel' ? 0.35 : e.kind === 'kite' ? 0.1 : 0.04;
        if (rng() < ch) S.items.push({ k: 'coin', v: e.kind === 'tug' ? 100 : 35, x: e.x, y: e.y });
      }
    }
    function damageGround(gd, d) {
      if (gd.hp <= 0) return; gd.hp -= d; emit('ghit', gd.x, gd.y);
      if (gd.hp <= 0) {
        S.gkills++; var G = D.GROUND[gd.kind]; pay(G.pay, gd.x, gd.y); emit('gkill', gd.x, gd.y, gd.kind);
        if (G.drop === 'coin') S.items.push({ k: 'coin', v: 50, x: gd.x, y: gd.y });
        else if (G.drop === 'box') { var r = rng(); S.items.push(r < 0.6 ? { k: 'coin', v: 110, x: gd.x, y: gd.y } : r < 0.85 ? { k: 'armor', v: 20, x: gd.x, y: gd.y } : { k: 'mega', v: 1, x: gd.x, y: gd.y }); }
      }
    }
    function damageBoss(d) {
      var b = S.boss; if (!b || b.dead || b.y < -40) return; b.hp -= d; b.fl = 0.05; emit('bhit', b.x, b.y);
      if (b.hp <= 0) {
        b.dead = true; b.hp = 0; pay(D.BOSSES[b.id].pay, b.x, b.y); emit(b.mid ? 'midDown' : 'bossDown', b.x, b.y);
        for (var i = 0; i < (b.mid ? 2 : 4); i++) S.items.push({ k: 'coin', v: 80, x: b.x + (i - 1) * 30, y: b.y });
        S.eb.length = 0;
        if (!b.mid) { S.bossDone = true; S.endT = K.END_WAIT + 1; }
        S.boss = null;
      }
    }
    function hitAt(x, y, r, d, sh) { // точечное попадание: первая цель → true
      var i, e;
      if (S.boss && !S.boss.dead) { var b = S.boss, dx = x - b.x, dy = y - b.y; if (dx * dx + dy * dy < (b.r + r) * (b.r + r) * 0.8 && notHit(sh, -1)) { damageBoss(d); return true; } }
      for (i = 0; i < S.E.length; i++) { e = S.E[i]; if (!e.on || e.t < 0 || e.y < -e.r) continue; var ex = x - e.x, ey = y - e.y; if (ex * ex + ey * ey < (e.r + r) * (e.r + r) && notHit(sh, e.id)) { damageAir(e, d); return true; } }
      for (i = 0; i < S.G.length; i++) { e = S.G[i]; if (e.hp <= 0 || e.y < 0) continue; var gx = x - e.x, gy = y - e.y; if (gx * gx + gy * gy < (e.r + r) * (e.r + r) && notHit(sh, -1000 - e.id)) { damageGround(e, d); return true; } }
      return false;
    }
    function notHit(sh, id) { if (!sh || !sh.pierce) return true; if (sh.hit.indexOf(id) >= 0) return false; sh.hit.push(id); return true; }
    function splash(x, y, rad, d) {
      emit('blast', x, y, rad);
      if (S.boss && !S.boss.dead) { var b = S.boss; if (Math.hypot(x - b.x, y - b.y) < rad + b.r) damageBoss(d * 0.6); }
      S.E.forEach(function (e) { if (e.on && e.t >= 0 && Math.hypot(x - e.x, y - e.y) < rad + e.r) damageAir(e, d * 0.6); });
      S.G.forEach(function (gd) { if (gd.hp > 0 && gd.y > 0 && Math.hypot(x - gd.x, y - gd.y) < rad + gd.r) damageGround(gd, d * 0.6); });
    }
    function nearest(x, y, maxD, preferAir) {
      var best = null, bd = maxD * maxD;
      function chk(o, dx, dy, w) { var dd = (dx * dx + dy * dy) * w; if (dd < bd) { bd = dd; best = o; } }
      if (S.boss && !S.boss.dead && S.boss.y > 0) chk(S.boss, S.boss.x - x, S.boss.y - y, 0.7);
      S.E.forEach(function (e) { if (e.on && e.t >= 0 && e.y > 0 && e.y < K.FH) chk(e, e.x - x, e.y - y, 1); });
      S.G.forEach(function (gd) { if (gd.hp > 0 && gd.y > 0 && gd.y < y) chk(gd, gd.x - x, gd.y - y, preferAir ? 2.5 : 1.2); });
      return best;
    }

    // ---------- стрельба пилота ----------
    function firePlayer(dt) {
      var p = S.P, lv = p.guns[p.gun] || 1;
      p.fireT -= dt;
      if (p.fireT <= 0) {
        p.fireT += gunIv(p.gun, lv);
        gunVolley(p.gun, lv, p.x, p.y).forEach(function (s) { s.hit = []; s.life = 2; S.shots.push(s); });
        emit('shot', p.gun);
      }
      for (var sl = 0; sl < 2; sl++) {
        var m = p.mods[sl]; if (!m) continue;
        var wx = p.x + (sl ? 24 : -24), wy = p.y + 2;
        if (m === 'scythe') {
          p.scy += dt;
          var reach = 74;
          S.E.forEach(function (e) { if (e.on && e.t >= 0 && e.y < wy + 8 && Math.hypot(e.x - wx, e.y - wy) < reach + e.r) damageAir(e, 16 * dt); });
          S.G.forEach(function (gd) { if (gd.hp > 0 && gd.y < wy && Math.hypot(gd.x - wx, gd.y - wy) < reach + gd.r) damageGround(gd, 16 * dt); });
          if (S.boss && !S.boss.dead && Math.hypot(S.boss.x - wx, S.boss.y - wy) < reach + S.boss.r) damageBoss(16 * dt);
          for (var bi = S.eb.length - 1; bi >= 0; bi--) { var q = S.eb[bi]; if (q.y < wy + 6 && Math.hypot(q.x - wx, q.y - wy) < 50) { S.eb.splice(bi, 1); emit('cut', q.x, q.y); } }
          continue;
        }
        p.modT[sl] -= dt; if (p.modT[sl] > 0) continue;
        if (m === 'turret') {
          p.modT[sl] = 0.28; var tg = nearest(wx, wy, 380, false);
          var a = tg ? Math.atan2(tg.y - wy, tg.x - wx) : -Math.PI / 2;
          S.shots.push({ x: wx, y: wy - 6, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, dmg: 1.4, k: 4, hit: [], life: 1.2 });
        } else if (m === 'homer') {
          p.modT[sl] = 1.0;
          S.shots.push({ x: wx, y: wy - 4, vx: sl ? 90 : -90, vy: -180, dmg: 5.5, k: 5, hit: [], life: 3, homing: 1 });
          emit('missile');
        }
      }
    }
    function moveShots(dt) {
      for (var i = S.shots.length - 1; i >= 0; i--) {
        var s = S.shots[i]; s.life -= dt;
        if (s.homing) {
          var tg = nearest(s.x, s.y, 420, true);
          var sp = 330, a = Math.atan2(s.vy, s.vx);
          if (tg) { var want = Math.atan2(tg.y - s.y, tg.x - s.x), da = ((want - a + Math.PI * 3) % TAU) - Math.PI; a += clamp(da, -4.5 * dt, 4.5 * dt); }
          else a += clamp(((-Math.PI / 2 - a + Math.PI * 3) % TAU) - Math.PI, -3 * dt, 3 * dt);
          s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        var gone = s.life <= 0 || s.y < -30 || s.y > K.FH + 30 || s.x < -30 || s.x > K.FW + 30;
        if (!gone && hitAt(s.x, s.y, s.k === 2 ? 6 : 3, s.dmg, s)) {
          if (s.splash) { splash(s.x, s.y, s.splash, s.dmg); gone = true; }
          else if (!s.pierce) gone = true;
        }
        if (gone) S.shots.splice(i, 1);
      }
    }

    // ---------- тик ----------
    function tick(dt) {
      if (S.phase === 'done' || S.phase === 'fail') return;
      var p = S.P;
      S.flash = Math.max(0, S.flash - dt);
      if (S.phase === 'dead') { S.endT -= dt; moveEB(dt); if (S.endT <= 0) { S.phase = 'fail'; emit('fail'); } return; }
      S.t += dt;
      if (!(S.phase === 'boss' && S.boss)) S.d += D.SCROLL * dt;
      // волны и боссы
      var W = M.waves;
      while (S.wi < W.length && W[S.wi].t <= S.t) { var w = W[S.wi++]; if (w.boss) spawnBoss(w.boss, w.mid); else spawnWave(w); }
      // острова и наземные цели: появляются сверху по дистанции
      while (S.ii < M.isles.length && M.isles[S.ii].y <= S.d + 10) {
        var is = M.isles[S.ii], isl = { x: is.x, y: -is.h, w: is.w, h: is.h, s: is.s }; S.isles.push(isl);
        while (S.gi < M.ground.length && M.ground[S.gi].is === S.ii) {
          var gd = M.ground[S.gi++], G = D.GROUND[gd.kind], ghp = G.hp * DF.hp * (1 + 0.1 * M.h);
          S.G.push({ id: S.gi, kind: gd.kind, x: gd.x, y: isl.y + gd.dy, hp: ghp, max: ghp, r: G.r, fireT: G.fire ? G.fire / DF.rate : 0 });
        }
        S.ii++;
      }
      var scr = (S.phase === 'boss' && S.boss) ? 0 : D.SCROLL * dt;
      for (var i = S.isles.length - 1; i >= 0; i--) { S.isles[i].y += scr; if (S.isles[i].y > K.FH + 20) S.isles.splice(i, 1); }
      for (i = S.G.length - 1; i >= 0; i--) {
        var g2 = S.G[i]; g2.y += scr;
        if (g2.y > K.FH + 40) { S.G.splice(i, 1); continue; }
        if (g2.hp > 0 && g2.fireT && g2.y > 30 && g2.y < K.FH * 0.7) { g2.fireT -= dt; if (g2.fireT <= 0) { g2.fireT = D.GROUND[g2.kind].fire / DF.rate; fireAt(g2.x, g2.y, p.x, p.y, 210); } }
      }
      // пилот
      var len = Math.hypot(inp.dx, inp.dy) || 1, mx = inp.dx / Math.max(1, len), my = inp.dy / Math.max(1, len);
      var ox = p.x;
      p.x = clamp(p.x + mx * K.SPD * dt + inp.mx, 16, K.FW - 16); p.y = clamp(p.y + my * K.SPD * dt + inp.my, 40, K.FH - 24);
      inp.mx = 0; inp.my = 0;
      p.bank += clamp((p.x - ox) / Math.max(dt, 1e-3) / K.SPD - p.bank, -6 * dt, 6 * dt);
      p.inv = Math.max(0, p.inv - dt); p.hitT = Math.max(0, p.hitT - dt);
      if (p.sdl > 0) p.sdl -= dt; else p.shield = Math.min(p.scap, p.shield + p.sreg * dt);
      firePlayer(dt);
      moveShots(dt);
      // враги
      for (i = S.E.length - 1; i >= 0; i--) {
        var e = S.E[i]; if (e.on) moveAir(e, dt);
        if (e.on && e.t >= 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + K.PR) { hurt(K.RAM_DMG * (e.kind === 'tug' ? 1.6 : 1)); damageAir(e, 10); }
        if (!e.on) S.E.splice(i, 1);
      }
      if (S.boss) { moveBoss(S.boss, dt); var b = S.boss; if (b && !b.dead && Math.hypot(b.x - p.x, b.y - p.y) < b.r * 0.8 + K.PR) hurt(K.RAM_DMG); }
      moveEB(dt);
      // предметы
      for (i = S.items.length - 1; i >= 0; i--) {
        var it = S.items[i], dx = p.x - it.x, dy = p.y - it.y, dd = Math.hypot(dx, dy);
        if (dd < K.MAGNET) { it.x += dx / dd * 260 * dt; it.y += dy / dd * 260 * dt; } else it.y += (D.SCROLL + 30) * dt;
        if (dd < 18) {
          if (it.k === 'coin') pay(it.v, it.x, it.y);
          else if (it.k === 'armor') { p.armor = Math.min(D.ARMOR_MAX, p.armor + it.v); emit('armor', it.x, it.y, it.v); }
          else if (it.k === 'mega') { if (p.mega < D.SPECIAL.mega.max) { p.mega++; emit('megaGet', it.x, it.y); } else pay(D.SPECIAL.mega.price / 2, it.x, it.y); }
          S.items.splice(i, 1); continue;
        }
        if (it.y > K.FH + 20) S.items.splice(i, 1);
      }
      // финал задания
      if (S.phase === 'play' || S.phase === 'boss') {
        var noBossEnd = !M.bossT && S.t > D.MISSION_T + 3 && !S.E.length && !S.boss;
        if (S.bossDone || noBossEnd) {
          if (S.endT <= 0) S.endT = K.END_WAIT;
          S.endT -= dt;
          if (S.endT <= 0 || (!S.bossDone && S.t > D.MISSION_T + 8)) { S.phase = 'done'; S.ok = true; S.items.forEach(function (q) { if (q.k === 'coin') pay(q.v, q.x, q.y); }); S.items.length = 0; emit('done'); }
        }
      }
    }
    function moveEB(dt) {
      var p = S.P;
      for (var i = S.eb.length - 1; i >= 0; i--) {
        var q = S.eb[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.t = (q.t || 0) + dt;
        if (q.y > K.FH + 20 || q.y < -40 || q.x < -20 || q.x > K.FW + 20) { S.eb.splice(i, 1); continue; }
        if (S.phase !== 'dead' && Math.hypot(q.x - p.x, q.y - p.y) < q.r + K.PR - 2) { S.eb.splice(i, 1); hurt(K.BULLET_DMG); }
      }
    }

    var acc = 0;
    var api = {
      start: function () { emit('start', si, mj); return api; },
      tick: tick,
      update: function (dt) { acc += Math.min(dt, 0.1); while (acc >= K.STEP) { acc -= K.STEP; tick(K.STEP); } },
      setInput: function (dx, dy) { inp.dx = dx; inp.dy = dy; },
      drag: function (dx, dy) { inp.mx += dx; inp.my += dy; },
      bomb: function () {
        var p = S.P; if (p.mega <= 0 || (S.phase !== 'play' && S.phase !== 'boss')) return false;
        p.mega--; S.flash = 0.5; p.inv = Math.max(p.inv, 1.0);
        var n = S.eb.length; S.eb.length = 0;
        S.E.slice().forEach(function (e) { if (e.on && e.t >= 0 && e.y > -10) damageAir(e, K.MEGA_DMG); });
        S.G.slice().forEach(function (gd) { if (gd.hp > 0 && gd.y > 0) damageGround(gd, K.MEGA_DMG * 0.6); });
        if (S.boss && S.boss.y > 0) damageBoss(K.MEGA_DMG);
        emit('mega', p.x, p.y, n); return true;
      },
      cell: function () {
        var p = S.P; if (p.cells <= 0 || p.shield >= p.scap - 1 || (S.phase !== 'play' && S.phase !== 'boss')) return false;
        p.cells--; p.shield = p.scap; emit('cell', p.x, p.y); return true;
      },
      cycleGun: function () {
        var p = S.P, own = D.GUN_IDS.filter(function (k) { return p.guns[k]; }); if (own.length < 2) return false;
        p.gun = own[(own.indexOf(p.gun) + 1) % own.length]; p.fireT = 0.1; emit('gun', p.gun); return true;
      },
      state: function () { return S; },
      result: function () { return { ok: S.phase === 'done', money: S.phase === 'done' ? Math.round(S.money) : 0, earnedRaw: Math.round(S.money), armor: S.P.armor, mega: S.P.mega, cells: S.P.cells, gun: S.P.gun, kills: S.kills, gkills: S.gkills }; },
      _spawnBoss: spawnBoss, _hurt: hurt
    };
    return api;
  }

  P.logic = { K: K, gunVolley: gunVolley, gunIv: gunIv, clamp: clamp };
  P.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
