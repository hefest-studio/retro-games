/* КАЛЁНЫЙ ДВОР (EN: CINDER COURT) · логика вышибал без DOM. Портретное поле 450×800: команда игрока снизу, соперник сверху.
   Два шара, 3 на 3. Попавший шар выбивает игрока: он уходит за заднюю линию соперника и бросает оттуда. Шар раскаляется в полёте
   (heat 0…1); ловля — окно-«клещи» по свечению шара: чем жарче, тем окно уже (0,52 → 0,18 с) и тем больше награда
   (heat ≥ 0,7 — «закалка»: бросавший выбыл + свой выбывший возвращается). Бросок: тап — холодный, удержание — накал.
   KALENY.Game(opts).start() → api; детерминирована при заданном rng. */
(function (global) {
  'use strict';
  var KL = global.KALENY = global.KALENY || {};
  var W = 450, H = 800, CX = 25, CR = 425, TOP = 130, BOT = 670, MID = 400, STT = 84, STB = 716;
  var UR = 16, BR = 9, SPEED = 150, DASH_V = 380, DASH_T = 0.2, DASH_CD = 1.0, LOCK_AFTER = 0.45;
  var GEO = { W: W, H: H, CX: CX, CR: CR, TOP: TOP, BOT: BOT, MID: MID, STT: STT, STB: STB, UR: UR, BR: BR };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Уровни ИИ (0…6): скорость, пауза перед броском, разброс прицела (рад), шанс ловить, шанс уклониться, ошибка времени ловли (с), шанс накала
  var LEVELS = [
    { speed: 108, delay: 1.7, aimErr: 0.30, catchP: 0.08, dodgeP: 0.15, timeErr: 0.18, chargeP: 0.02 },
    { speed: 114, delay: 1.5, aimErr: 0.26, catchP: 0.14, dodgeP: 0.22, timeErr: 0.16, chargeP: 0.05 },
    { speed: 120, delay: 1.35, aimErr: 0.23, catchP: 0.20, dodgeP: 0.30, timeErr: 0.14, chargeP: 0.09 },
    { speed: 126, delay: 1.2, aimErr: 0.21, catchP: 0.27, dodgeP: 0.38, timeErr: 0.13, chargeP: 0.13 },
    { speed: 128, delay: 1.15, aimErr: 0.20, catchP: 0.28, dodgeP: 0.40, timeErr: 0.13, chargeP: 0.15 },
    { speed: 132, delay: 1.1, aimErr: 0.19, catchP: 0.34, dodgeP: 0.45, timeErr: 0.12, chargeP: 0.19 },
    { speed: 138, delay: 1.0, aimErr: 0.17, catchP: 0.40, dodgeP: 0.50, timeErr: 0.11, chargeP: 0.25 }
  ];

  var FRIEND = { speed: 138, delay: 1.0, aimErr: 0.14, catchP: 0.40, dodgeP: 0.45, timeErr: 0.10, chargeP: 0.18 };

  // Арены: shields — plate (железная плита, отражает шар и не пускает игроков), steam (паровая завеса: пульсирует, гасит и остужает шар)
  var ARENAS = [
    { id: 'forge', shields: [] },
    { id: 'foundry', shields: [{ k: 'plate', x: 120, y: 385, w: 60, h: 30 }, { k: 'plate', x: 270, y: 385, w: 60, h: 30 }] },
    { id: 'steam', shields: [{ k: 'steam', x: 80, y: 440, w: 110, h: 22, period: 5, on: 2.4, ph: 0 }, { k: 'steam', x: 260, y: 338, w: 110, h: 22, period: 5, on: 2.4, ph: 2.5 }] },
    { id: 'locksmith', shields: [{ k: 'plate', x: 195, y: 385, w: 60, h: 30 }, { k: 'steam', x: 40, y: 450, w: 100, h: 22, period: 4.6, on: 2.2, ph: 0 }, { k: 'steam', x: 310, y: 328, w: 100, h: 22, period: 4.6, on: 2.2, ph: 2.3 }] },
    { id: 'boiler', shields: [{ k: 'steam', x: 40, y: 340, w: 120, h: 22, period: 4, on: 2, ph: 0 }, { k: 'steam', x: 290, y: 440, w: 120, h: 22, period: 4, on: 2, ph: 2 }, { k: 'steam', x: 165, y: 389, w: 120, h: 22, period: 4, on: 2, ph: 1 }] },
    { id: 'anvil', shields: [{ k: 'plate', x: 80, y: 360, w: 50, h: 28 }, { k: 'plate', x: 320, y: 412, w: 50, h: 28 }, { k: 'steam', x: 175, y: 389, w: 100, h: 22, period: 4, on: 2.2, ph: 0 }] },
    { id: 'grand', shields: [{ k: 'plate', x: 60, y: 385, w: 55, h: 30 }, { k: 'plate', x: 335, y: 385, w: 55, h: 30 }, { k: 'steam', x: 150, y: 330, w: 150, h: 20, period: 3.6, on: 1.8, ph: 0 }, { k: 'steam', x: 150, y: 450, w: 150, h: 20, period: 3.6, on: 1.8, ph: 1.8 }] }
  ];

  // Окно ловли по накалу шара: холодный — 0,52 с, раскалённый добела — 0,18 с
  function stanceLen(heat) { return 0.52 - 0.34 * Math.max(0, Math.min(1, heat)); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function steamOn(sh, t) { return ((t + sh.ph) % sh.period) < sh.on; }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || (opts.seed != null ? mulberry32(opts.seed) : Math.random), emit = opts.onEvent || function () {};
    var level = clamp(opts.level | 0, 0, LEVELS.length - 1), arena = ARENAS[opts.arena != null ? opts.arena : level % ARENAS.length];
    var S = { time: 0, left: opts.time || 100, sudden: 0, phase: 'play', result: null, level: level, arena: arena.id, units: [], balls: [], shields: arena.shields.map(function (s) { return Object.assign({}, s); }), shotNo: 0,
      stats: [{ hits: 0, catches: 0, perfect: 0, outs: 0 }, { hits: 0, catches: 0, perfect: 0, outs: 0 }], points: 0, hum: {}, over: false, tick: 0 };
    var PE = Object.assign({}, LEVELS[level], opts.enemy || {}), PF = Object.assign({}, FRIEND, opts.friend || {}), PH = opts.hero || null;
    var humans = opts.humans || [1];

    function mkUnit(id, team, i) {
      var x = [100, 225, 350][i], y = team === 0 ? 590 : 210;
      return { id: id, team: team, slot: i, x: x, y: y, state: 'in', hp: 2, hold: -1, fx: 0, fy: team === 0 ? -1 : 1, stance: 0, stanceMax: 0, lock: 0, dashT: 0, dashCd: 0, dx: 0, dy: 0, stun: 0, charge: -1, aPrev: false, inv: 0, outAt: 0,
        in: { mx: 0, my: 0, a: false, b: false, dash: false, tgt: -1 }, ai: null, human: -1, spd: 1, flash: 0 };
    }
    for (var t = 0; t < 2; t++) for (var i = 0; i < 3; i++) S.units.push(mkUnit(t * 3 + i, t, i));
    humans.forEach(function (uid, pi) { S.units[uid].human = pi; S.hum[uid] = pi; });
    S.balls.push({ id: 0, x: 150, y: MID + 34, vx: 0, vy: 0, heat: 0.15, state: 'loose', team: 0, owner: -1, t: 0, bounces: 0, pass: false, holder: -1, noPick: 0, sid: 0 });
    S.balls.push({ id: 1, x: 300, y: MID - 34, vx: 0, vy: 0, heat: 0.15, state: 'loose', team: 1, owner: -1, t: 0, bounces: 0, pass: false, holder: -1, noPick: 0, sid: 0 });

    function params(u) { return u.team === 1 ? PE : (u.human >= 0 ? null : (PH && u.slot === (PH.slot != null ? PH.slot : 1) ? PH : PF)); }
    function alive(team) { return S.units.filter(function (u) { return u.team === team && u.state === 'in'; }); }
    function outs(team) { return S.units.filter(function (u) { return u.team === team && u.state === 'out'; }); }
    function stripY(team) { return team === 0 ? (STT + TOP) / 2 : (BOT + STB) / 2; }
    function gauss() { return (rng() + rng() + rng() - 1.5) * 1.6; }

    // ---------- шары ----------
    function dropBall(u, vx, vy) {
      if (u.hold < 0) return; var b = S.balls[u.hold]; u.hold = -1; b.state = 'loose'; b.holder = -1; b.vx = vx || 0; b.vy = vy || 0; b.x = u.x; b.y = u.y; b.noPick = 0.4; b.heat = Math.min(b.heat, 0.5);
    }
    function pickTarget(u, mx, my) {
      var en = alive(1 - u.team), best = null, bs = 1e9, i, a, d, aa;
      var l = Math.hypot(mx, my);
      if (l > 0.35) {
        var ang = Math.atan2(my, mx), cands = en.concat(alive(u.team).filter(function (o) { return o !== u; }));
        for (i = 0; i < cands.length; i++) { a = Math.atan2(cands[i].y - u.y, cands[i].x - u.x); aa = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))); d = dist(u.x, u.y, cands[i].x, cands[i].y); if (aa < 0.7 && aa * 200 + d * 0.2 < bs) { bs = aa * 200 + d * 0.2; best = cands[i]; } }
        if (best) return best;
      }
      bs = 1e9; for (i = 0; i < en.length; i++) { d = dist(u.x, u.y, en[i].x, en[i].y); if (d < bs) { bs = d; best = en[i]; } }
      return best;
    }
    function throwBall(u, tg, heat0, err, lead) {
      if (u.hold < 0 || !tg) return false;
      var b = S.balls[u.hold], pass = tg.team === u.team, speed = pass ? 340 : 250 + 330 * heat0;
      var tx = tg.x, ty = tg.y;
      if (!pass && lead) { var tt = dist(u.x, u.y, tg.x, tg.y) / speed; tx += (tg.mvx || 0) * tt * lead; ty += (tg.mvy || 0) * tt * lead; }
      var a = Math.atan2(ty - u.y, tx - u.x) + (err ? gauss() * err : 0), ux = Math.cos(a), uy = Math.sin(a);
      u.hold = -1; b.holder = -1; b.state = 'fly'; b.pass = pass; b.team = u.team; b.owner = u.id; b.heat = pass ? 0.12 : heat0; b.t = 0; b.bounces = 0; b.noPick = 0.3; b.sid = ++S.shotNo; b.target = pass ? tg.id : -1;
      b.x = u.x + ux * (UR + BR + 2); b.y = u.y + uy * (UR + BR + 2); b.vx = ux * speed; b.vy = uy * speed;
      u.fx = ux; u.fy = uy; u.charge = -1; u.flash = 0.15;
      emit(pass ? 'pass' : 'throw', { uid: u.id, team: u.team, heat: heat0, x: b.x, y: b.y });
      return true;
    }
    function threatOf(u) {   // ближайший летящий в юнита шар соперника: { ball, eta }
      var best = null, i, b, dx, dy, sp, dot, d, cross, eta;
      for (i = 0; i < S.balls.length; i++) {
        b = S.balls[i]; if (b.state !== 'fly' || b.pass || b.team === u.team) continue;
        dx = u.x - b.x; dy = u.y - b.y; d = Math.hypot(dx, dy); sp = Math.hypot(b.vx, b.vy); if (d > 300 || sp < 1) continue;
        dot = (dx * b.vx + dy * b.vy) / sp; if (dot <= 0) continue;
        cross = Math.abs(dx * b.vy - dy * b.vx) / sp; if (cross > UR + BR + 30) continue;
        eta = dot / sp; if (!best || eta < best.eta) best = { ball: b, eta: eta, cross: cross };
      }
      return best;
    }
    function toStrip(u) { u.state = 'out'; u.outAt = S.time; u.y = stripY(u.team); u.charge = -1; u.stance = 0; u.dashT = 0; u.inv = 0; u.x = clamp(u.x, CX + UR, CR - UR); }
    function revive(team) {
      var o = outs(team).sort(function (a, b) { return b.outAt - a.outAt; })[0]; if (!o) return null;
      dropBall(o); o.state = 'in'; o.hp = 1; o.y = team === 0 ? 610 : 190; o.inv = 1.5; o.stun = 0; emit('revive', { uid: o.id, team: team, x: o.x, y: o.y }); return o;
    }

    // ---------- ИИ ----------
    function think(u, P, dt) {
      var inp = u.in, ai = u.ai || (u.ai = { wait: 0, press: -1, ct: 0, dec: {}, err: {}, ph: rng() * 6, tg: -1, dodgeDir: 1 }), i, b, d, best;
      inp.mx = 0; inp.my = 0; inp.b = false; inp.dash = false; inp.tgt = -1; u.spd = P.speed / SPEED;
      var out = u.state === 'out', front = u.team === 0 ? MID + 75 : MID - 75, back = u.team === 0 ? 600 : 200;
      var th = out ? null : threatOf(u);
      if (th) {
        var id = th.ball.sid;
        if (ai.dec[id] == null) { var r = rng(); ai.dec[id] = r < P.catchP ? 'c' : (rng() < P.dodgeP ? 'd' : 'n'); ai.err[id] = gauss() * P.timeErr; ai.dodgeDir = rng() < 0.5 ? -1 : 1; }
        if (ai.dec[id] === 'c') { if (u.hold < 0 && u.lock <= 0 && th.eta <= stanceLen(th.ball.heat) / 2 + ai.err[id]) inp.b = true; }
        else if (ai.dec[id] === 'd') {
          var bl = Math.hypot(th.ball.vx, th.ball.vy) || 1, px = -th.ball.vy / bl * ai.dodgeDir, py = th.ball.vx / bl * ai.dodgeDir; inp.mx = px; inp.my = py * 0.5;
          if (th.eta < 0.28 && u.dashCd <= 0) { inp.dash = true; inp.mx = px; inp.my = py; }
        }
        if (ai.dec[id] !== 'n') { ai.press = -1; return; }
      }
      if (ai.press >= 0) {   // идёт накал/нажатие броска
        inp.a = true; ai.press -= dt;
        if (ai.press <= 0) { inp.a = false; inp.tgt = ai.tg; ai.press = -1; ai.wait = 0; }
        return;
      }
      inp.a = false;
      if (u.hold >= 0) {
        ai.wait += dt;
        if (out) { var tg0 = nearestEnemy(u); if (tg0) inp.mx = clamp((tg0.x - u.x) / 40, -1, 1) * 0.7; }
        else { inp.my = (front - u.y) / 60; inp.mx = Math.sin(S.time * 1.1 + ai.ph) * 0.5; }
        if (ai.wait >= P.delay) {
          var tg = nearestEnemy(u, rng() < 0.3); if (!tg) return;
          ai.tg = tg.id; ai.press = rng() < P.chargeP ? 0.6 + rng() * 0.55 : 0.03; ai.ct = ai.press;
        }
        return;
      }
      ai.wait = 0;
      // свободный шар на своей стороне
      best = null; d = 1e9;
      for (i = 0; i < S.balls.length; i++) {
        b = S.balls[i]; if (b.state !== 'loose' || !ballIsMine(u, b)) continue;
        var dd = dist(u.x, u.y, b.x, b.y);
        if (dd < d) { var closer = true; S.units.forEach(function (o) { if (o !== u && o.team === u.team && o.state === u.state && o.hold < 0 && o.human < 0 && dist(o.x, o.y, b.x, b.y) < dd - 4) closer = false; }); if (closer) { d = dd; best = b; } }
      }
      if (best) { inp.mx = clamp((best.x - u.x) / 30, -1, 1); inp.my = out ? 0 : clamp((best.y - u.y) / 30, -1, 1); return; }
      if (out) { var te = nearestEnemy(u); if (te) inp.mx = clamp((te.x - u.x) / 50, -1, 1) * 0.6; return; }
      var hx = [100, 225, 350][u.slot] + Math.sin(S.time * 0.9 + ai.ph) * 45;
      inp.mx = clamp((hx - u.x) / 30, -1, 1) * 0.8; inp.my = clamp((back + Math.sin(S.time * 0.7 + ai.ph) * 25 - u.y) / 30, -1, 1) * 0.7;
    }
    function nearestEnemy(u, second) {
      var en = alive(1 - u.team).sort(function (a, b) { return dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, b.x, b.y); });
      return second && en.length > 1 ? en[1] : en[0];
    }
    function ballIsMine(u, b) {
      if (u.state === 'out') return u.team === 0 ? b.y < TOP : b.y > BOT;
      return u.team === 0 ? (b.y >= MID && b.y <= BOT) : (b.y < MID && b.y >= TOP);
    }

    // ---------- шаг ----------
    function plateHit(x, y, r, sh) {   // круг против плиты: вектор выталкивания или null
      var nx = clamp(x, sh.x, sh.x + sh.w), ny = clamp(y, sh.y, sh.y + sh.h), dx = x - nx, dy = y - ny, d = Math.hypot(dx, dy);
      if (d >= r) return null; if (d === 0) { return { x: 0, y: -1, d: r }; } return { x: dx / d, y: dy / d, d: r - d };
    }
    function stepUnit(u, dt) {
      var inp = u.in, pr = params(u), i;
      if (u.human < 0) { if (!pr) pr = FRIEND; think(u, pr, dt); } else u.spd = 1;
      u.stance = Math.max(0, u.stance - dt); u.lock = Math.max(0, u.lock - dt); u.dashCd = Math.max(0, u.dashCd - dt); u.stun = Math.max(0, u.stun - dt); u.inv = Math.max(0, u.inv - dt); u.flash = Math.max(0, u.flash - dt);
      var out = u.state === 'out', sp = SPEED * u.spd * (u.charge >= 0 ? 0.55 : 1) * (u.stance > 0 ? 0.5 : 1) * (u.stun > 0 ? 0 : 1);
      var mx = inp.mx, my = out ? 0 : inp.my, l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      u.mvx = 0; u.mvy = 0;
      // B: ловля при угрозе, иначе рывок
      var bp = inp.b; inp.b = false;
      if ((bp || inp.dash) && u.stun <= 0) {
        var th = !out && u.state === 'in' ? threatOf(u) : null;
        if (bp && th && u.lock <= 0 && u.hold < 0) { u.stanceMax = stanceLen(th.ball.heat); u.stance = u.stanceMax; u.lock = u.stanceMax + LOCK_AFTER; emit('stance', { uid: u.id, team: u.team, heat: th.ball.heat }); }
        else if (bp && !th && u.lock <= 0 && u.hold < 0 && !out && false) { /* зарезервировано */ }
        else if (!out && u.dashCd <= 0 && (!bp || !th || u.hold >= 0 || inp.dash)) {
          var ddx = mx, ddy = my; if (Math.hypot(ddx, ddy) < 0.3) { ddx = u.x < W / 2 ? 1 : -1; ddy = 0; } var dl = Math.hypot(ddx, ddy); u.dx = ddx / dl; u.dy = ddy / dl; u.dashT = DASH_T; u.dashCd = DASH_CD; emit('dash', { uid: u.id, team: u.team, x: u.x, y: u.y });
        }
      }
      var ox = u.x, oy = u.y;
      if (u.dashT > 0) { u.dashT -= dt; u.x += u.dx * DASH_V * dt; u.y += u.dy * DASH_V * dt; }
      else { u.x += mx * sp * dt; u.y += my * sp * dt; }
      u.x = clamp(u.x, CX + UR, CR - UR);
      if (out) u.y = stripY(u.team); else if (u.team === 0) u.y = clamp(u.y, MID + UR + 3, BOT - UR); else u.y = clamp(u.y, TOP + UR, MID - UR - 3);
      if (!out) for (i = 0; i < S.shields.length; i++) if (S.shields[i].k === 'plate') { var ph = plateHit(u.x, u.y, UR, S.shields[i]); if (ph) { u.x += ph.x * ph.d; u.y += ph.y * ph.d; } }
      u.mvx = (u.x - ox) / dt; u.mvy = (u.y - oy) / dt;
      if (Math.hypot(mx, my) > 0.2) { u.fx = mx; u.fy = my; }
      // бросок: A — удержание копит накал, отпускание — бросок
      var a = !!inp.a;
      if (a && !u.aPrev && u.hold >= 0 && u.stun <= 0) u.charge = 0;
      if (a && u.charge >= 0 && u.hold >= 0) {
        u.charge += dt; var bb = S.balls[u.hold]; if (u.charge > 0.12) bb.heat = 0.25 + Math.min(u.charge, 1.1) / 1.1 * 0.7;
        if (u.charge > 1.7) { u.charge = -1; u.stun = 0.9; var hb = S.balls[u.hold]; hb.heat = 1; dropBall(u, (rng() - 0.5) * 80, (u.team === 0 ? 1 : -1) * 40); emit('burn', { uid: u.id, team: u.team, x: u.x, y: u.y }); }
      }
      if (!a && u.aPrev && u.charge >= 0 && u.hold >= 0) {
        var tg = inp.tgt >= 0 && S.units[inp.tgt].state === 'in' ? S.units[inp.tgt] : pickTarget(u, inp.mx, inp.my), h0 = u.charge > 0.12 ? S.balls[u.hold].heat : 0.25;
        var humanLike = u.human >= 0 || (pr && pr === PH);
        if (tg) throwBall(u, tg, h0, humanLike ? 0.015 : (pr ? pr.aimErr : 0.1), humanLike ? 0.5 : 0.8); else u.charge = -1;
      }
      if (!a && u.charge >= 0 && u.hold < 0) u.charge = -1;
      u.aPrev = a;
      if (u.hold >= 0 && u.charge < 0) { var hh = S.balls[u.hold]; hh.heat = Math.max(0.15, hh.heat - 0.3 * dt); }
    }

    function catchBall(u, b) {
      var h = b.heat, perfect = h >= 0.7, thr = S.units[b.owner], T = u.team;
      u.hold = b.id; b.state = 'held'; b.holder = u.id; b.vx = b.vy = 0; b.team = T; b.heat = 0.3; u.stance = 0; u.lock = Math.min(u.lock, 0.1); u.charge = -1; b.pass = false;
      S.stats[T].catches++; if (perfect) S.stats[T].perfect++;
      if (h >= 0.35 && thr && thr.state === 'in') { dropBall(thr); toStrip(thr); S.stats[T].hits++; S.stats[thr.team].outs++; }
      if (perfect) revive(T);
      emit('catch', { uid: u.id, team: T, heat: h, perfect: perfect, x: u.x, y: u.y, thrower: b.owner });
    }
    function stepBall(b, dt) {
      var i, u, sp;
      if (b.state === 'held') { u = S.units[b.holder]; b.x = u.x + (u.fx || 0) * 14; b.y = u.y + (u.fy || 0) * 14; return; }
      b.noPick = Math.max(0, b.noPick - dt);
      if (b.state === 'fly') { b.t += dt; if (!b.pass) b.heat = Math.min(1, b.heat + 0.28 * dt); } else b.heat = Math.max(0.05, b.heat - 0.35 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < CX + BR) { b.x = CX + BR; b.vx = Math.abs(b.vx) * 0.85; b.bounces++; emit('wall', { x: b.x, y: b.y }); } else if (b.x > CR - BR) { b.x = CR - BR; b.vx = -Math.abs(b.vx) * 0.85; b.bounces++; emit('wall', { x: b.x, y: b.y }); }
      if (b.y < STT + BR) { b.y = STT + BR; b.vy = Math.abs(b.vy) * 0.8; b.bounces++; } else if (b.y > STB - BR) { b.y = STB - BR; b.vy = -Math.abs(b.vy) * 0.8; b.bounces++; }
      for (i = 0; i < S.shields.length; i++) {
        var sh = S.shields[i];
        if (sh.k === 'plate') { var ph = plateHit(b.x, b.y, BR, sh); if (ph) { b.x += ph.x * ph.d; b.y += ph.y * ph.d; var dv = b.vx * ph.x + b.vy * ph.y; if (dv < 0) { b.vx -= 1.8 * dv * ph.x; b.vy -= 1.8 * dv * ph.y; } b.bounces++; emit('plate', { x: b.x, y: b.y }); } }
        else if (steamOn(sh, S.time) && b.x > sh.x && b.x < sh.x + sh.w && b.y > sh.y && b.y < sh.y + sh.h) { b.heat = Math.max(0.05, b.heat - 1.6 * dt); b.vx *= (1 - 2.6 * dt); b.vy *= (1 - 2.6 * dt); if (!b.steamed) { b.steamed = true; emit('steam', { x: b.x, y: b.y }); } }
      }
      if (!b.vx && !b.vy) b.steamed = false;
      sp = Math.hypot(b.vx, b.vy);
      if (b.state === 'fly') {
        if (b.bounces >= 2 || b.t > (b.pass ? 1.2 : 1.8) || sp < 140) { b.state = 'loose'; b.vx *= 0.55; b.vy *= 0.55; b.pass = false; b.steamed = false; return; }
        // пас: подхватывает тот, кому адресован (или любой свой рядом)
        if (b.pass) {
          for (i = 0; i < S.units.length; i++) { u = S.units[i]; if (u.team !== b.team || u.hold >= 0 || u.state !== 'in' || u.id === b.owner && b.t < 0.2) continue; if (dist(u.x, u.y, b.x, b.y) < UR + BR + 10) { u.hold = b.id; b.state = 'held'; b.holder = u.id; b.vx = b.vy = 0; b.heat = 0.2; b.pass = false; emit('got', { uid: u.id, team: u.team }); return; } }
          return;
        }
        // попадание / ловля / уклон
        for (i = 0; i < S.units.length; i++) {
          u = S.units[i]; if (u.state !== 'in' || u.team === b.team) continue;
          var d = dist(u.x, u.y, b.x, b.y);
          if (u.stance > 0 && u.hold < 0 && d < UR + BR + 8) { catchBall(u, b); return; }
          if (d < UR + BR - 1) {
            if (u.dashT > 0 || u.inv > 0) { if (!b.dodged || b.dodged !== u.id) { b.dodged = u.id; emit('dodge', { uid: u.id, team: u.team, x: u.x, y: u.y }); } continue; }
            S.stats[b.team].hits++; u.hp--;
            if (u.hp > 0) { u.inv = 1.0; u.flash = 0.3; emit('wound', { uid: u.id, team: u.team, hp: u.hp, x: u.x, y: u.y, heat: b.heat }); }
            else { dropBall(u); toStrip(u); S.stats[u.team].outs++; }
            b.state = 'loose'; b.pass = false; b.vx = b.vx * 0.2 + (rng() - 0.5) * 60; b.vy = b.vy * 0.2 + (rng() - 0.5) * 60; b.heat *= 0.6; b.steamed = false;
            if (u.state === 'out') emit('hit', { uid: u.id, team: u.team, heat: b.heat, x: u.x, y: u.y, by: b.owner }); return;
          }
        }
        return;
      }
      // loose: трение, подбор
      var f = Math.max(0, 1 - 1.8 * dt); b.vx *= f; b.vy *= f; if (Math.hypot(b.vx, b.vy) < 6) { b.vx = 0; b.vy = 0; }
      var inStrip = b.y < TOP || b.y > BOT;
      if (b.noPick <= 0 && sp < 170) {
        var bestU = null, bd = 1e9;
        for (i = 0; i < S.units.length; i++) {
          u = S.units[i]; if (u.hold >= 0 || u.stun > 0 || !ballIsMine(u, b)) continue;
          var dd = dist(u.x, u.y, b.x, b.y), reach = UR + BR + (u.human >= 0 ? 10 : 4); if (dd < reach && dd < bd) { bd = dd; bestU = u; }
        }
        if (bestU) { bestU.hold = b.id; b.state = 'held'; b.holder = bestU.id; b.team = bestU.team; b.vx = b.vy = 0; emit('pick', { uid: bestU.id, team: bestU.team }); return; }
      }
      if (inStrip && sp < 30) {   // шар на решётке без хозяина — скатывается к полю
        var hasOut = S.units.some(function (o) { return o.state === 'out' && o.hold < 0 && ballIsMine(o, b); });
        if (!hasOut) { b.vy += (b.y < TOP ? 1 : -1) * 120 * dt; }
      }
    }

    function counts() { return [alive(0).length, alive(1).length]; }
    function hpSum(team) { return alive(team).reduce(function (n, u) { return n + u.hp; }, 0); }
    function finish(res) {
      if (S.phase !== 'play') return; S.phase = 'over'; S.over = true; S.result = res;
      if (res === 'win') { var c = counts(); S.points = Math.round((200 + 60 * c[0] + Math.max(0, Math.round(S.left)) * 3 + S.stats[0].perfect * 50 + S.stats[0].hits * 10) * (1 + 0.1 * level)); }
      emit('end', { result: res, points: S.points });
    }
    function update(dt) {
      if (S.phase !== 'play') return;
      var n = Math.max(1, Math.ceil(dt * 60 - 1e-6)), h = dt / n;
      for (var k = 0; k < n && S.phase === 'play'; k++) {
        S.time += h; S.tick++;
        if (S.left > 0) { S.left = Math.max(0, S.left - h); if (S.left === 0) { emit('time', {}); } } else S.sudden += h;
        S.units.forEach(function (u) { stepUnit(u, h); });
        S.balls.forEach(function (b) { stepBall(b, h); });
        var c = counts();
        if (c[1] === 0 && c[0] === 0) finish('draw'); else if (c[1] === 0) finish('win'); else if (c[0] === 0) finish('lose');
        else if (S.left === 0) { var hs = [hpSum(0), hpSum(1)]; if (c[0] > c[1] || (c[0] === c[1] && hs[0] > hs[1])) finish('win'); else if (c[0] < c[1] || hs[0] < hs[1]) finish('lose'); else if (S.sudden > 45) finish('draw'); }
      }
    }
    var api = {
      update: update, state: function () { return S; }, params: function () { return { level: level, enemy: PE, friend: PF }; }, _S: S,
      setInput: function (uid, mx, my, a) { var u = S.units[uid]; if (!u) return; u.in.mx = mx || 0; u.in.my = my || 0; u.in.a = !!a; },
      pressB: function (uid) { var u = S.units[uid]; if (u) u.in.b = true; },
      reinforce: function () { return !!revive(0); },
      canReinforce: function () { return outs(0).length > 0 && S.phase === 'play'; },
      counts: counts, think: think, threatOf: threatOf, _throw: throwBall, _toStrip: toStrip, _revive: revive, pickTarget: pickTarget,
      start: function () { return api; }
    };
    return api;
  }

  KL.Game = Game; KL.logic = { GEO: GEO, LEVELS: LEVELS, FRIEND: FRIEND, ARENAS: ARENAS, stanceLen: stanceLen, steamOn: steamOn, mulberry32: mulberry32, UR: UR, BR: BR, SPEED: SPEED };
})(typeof window !== 'undefined' ? window : globalThis);
