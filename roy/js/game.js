/* ============================================================================
   РОЙ · логика (DOM-free, детерминируемая через opts.rng). Переделка 2026-11.
   Главная механика — «искра и манок»: рой живёт стаей (без строя и рядов), кружит
   вокруг Матки-улья. Искра поджигает одного; горящий за полсекунды перекидывает огонь
   на соседей ближе IGN px — цепь. Манок (◆) взлетает и висит: рой сбивается к нему
   в плотный клубок — подожги клубок или сам манок, и огонь пройдёт по всем.
   Огонь рядом с Маткой ранит её; Матка откладывает новых мошек и время от времени
   бросает весь рой на корабль. Рендер — js/classic.js и js/modern.js. Интерфейс — CONTRACT.md.
   ========================================================================== */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};

  var W = 480, H = 640;
  var PY0 = 410, PY1 = 606;          // корабль ходит в нижней части поля (по x и по y)
  var P_SPEED = 240, SPARK_V = 560, FIRE_CD = 0.16;
  var CHARGES = 3, RECHARGE = 0.62;   // запас искр и время на одну
  var SHIP_R = 11;
  var IGN = 30;                       // радиус перекидывания огня (центр–центр)
  var BURN = 0.5, SPREAD0 = 0.12;     // горит 0,5 с; поджигает соседей с 0,12 с
  var SEP = 34, SEP_HUDDLE = 15;      // дистанция в стае / в клубке у манка
  var LURE_CD = 6, LURE_HOVER = 3.6, LURE_V = 330, LURE_ATTR = 430, LURE_BURST = 64;
  var QUEEN_R = 26, WAVES = 5, MAX_LIVES = 5;

  // Виды роя (названия и облик — свои)
  var KINDS = {
    gnat:   { pts: 10, r: 9,  spd: 1.0 },   // «Мошка»
    shell:  { pts: 20, r: 10, spd: 0.85 },  // «Панцирник»: первый огонь только срывает панцирь
    powder: { pts: 15, r: 9,  spd: 1.1 }    // «Пороховик»: горит с большим радиусом
  };
  // Волны: стартовый рой, здоровье Матки, кладка, бросок роя, плевки
  var WAVE_DEF = [
    { gnat: 12, shell: 0, powder: 0, hp: 8,  lay: 6.0, cap: 16, surge: 0,  spit: 0,   fan: 1 },   // 1 — обучение
    { gnat: 16, shell: 0, powder: 0, hp: 16, lay: 4.0, cap: 22, surge: 9,  spit: 5.5, fan: 1 },
    { gnat: 15, shell: 4, powder: 0, hp: 22, lay: 3.4, cap: 26, surge: 6, spit: 3.6, fan: 2 },
    { gnat: 15, shell: 5, powder: 3, hp: 28, lay: 2.9, cap: 30, surge: 5, spit: 2.7, fan: 3 },
    { gnat: 18, shell: 6, powder: 4, hp: 36, lay: 2.5, cap: 34, surge: 4, spit: 2.2, fan: 3 }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  R.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var onEventFn = typeof opts.onEvent === 'function' ? opts.onEvent : null;
    function emit(type, data) { if (onEventFn) onEventFn(type, data || {}); }

    var S = {
      W: W, H: H, IGN: IGN, t: 0, wave: 0, waves: WAVES, score: 0, lives: opts.lives || 3,
      phase: 'idle', phaseT: 0, banner: null, bannerT: 0, tip: null, tipT: 0, tut: 0,
      drones: [], sparks: [], spores: [], lure: null, queen: null, uid: 0, chains: {}, chainN: 0,
      player: { x: W / 2, y: 560, alive: true, inv: 0, respawnT: 0, cd: 0, dx: 0, dy: 0, fire: false, charges: CHARGES, rech: 0, lureCd: 0 },
      surge: null, layT: 0, spitT: 0, surgeT: 0, overT: 0, bestChain: 0, lastChain: null,
      over: false, won: false, started: false
    };

    var diff = opts.diff || function (base, step, max) {
      var v = base + (S.wave - 1) * step;
      return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max));
    };
    function params() {
      var D = WAVE_DEF[S.wave - 1] || WAVE_DEF[WAVES - 1];
      return {
        speed: diff(80, 11, 130),          // крейсерская скорость роя, px/с
        hunt: diff(98, 22, 190),          // скорость мошки, охотящейся на корабль
        huntR: diff(100, 18, 175),         // с какого расстояния мошка бросается на корабль
        spore: diff(170, 22, 260),        // скорость плевка Матки
        lay: D.lay, cap: D.cap, surge: D.surge, spit: D.spit, fan: D.fan
      };
    }
    function setBanner(key, time) { S.banner = key; S.bannerT = time; }
    function setTip(key) { S.tip = key; S.tipT = 0; }

    // ---------- Рой ----------
    function addDrone(kind, x, y) {
      var K = KINDS[kind];
      var d = { id: ++S.uid, kind: kind, x: x, y: y, vx: (rng() - 0.5) * 60, vy: (rng() - 0.5) * 60, r: K.r,
        state: 'live', shell: kind === 'shell', burnT: 0, chain: 0, ph: rng() * 6.283, orb: 60 + rng() * 140, qHit: false, crackT: 0 };
      S.drones.push(d); return d;
    }
    function startWave(n) {
      S.wave = n; S.drones = []; S.sparks = []; S.spores = []; S.lure = null; S.chains = {}; S.surge = null;
      S.phase = 'intro'; S.phaseT = 1.6;
      var D = WAVE_DEF[n - 1], P = params();
      S.queen = { x: W / 2, y: 130, hp: D.hp, max: D.hp, alive: true, t: rng() * 10, warn: 0, hurtT: 0 };
      var list = [], k;
      for (k = 0; k < D.gnat; k++) list.push('gnat');
      for (k = 0; k < D.shell; k++) list.push('shell');
      for (k = 0; k < D.powder; k++) list.push('powder');
      for (k = 0; k < list.length; k++) {
        var a = k / list.length * 6.283, rr = 60 + (k % 3) * 40;
        addDrone(list[k], W / 2 + Math.cos(a) * rr, 130 + Math.sin(a) * rr * 0.55 - 160);
      }
      S.layT = P.lay; S.spitT = P.spit || 0; S.surgeT = P.surge || 0;
      S.player.lureCd = 0;
      emit('wave', { wave: n }); setBanner('wave', 2.0);
      if (n === 1) { S.tut = 1; setTip('tut1'); } else { S.tut = 0; S.tip = null; }
    }
    function liveDrones() { var n = 0; for (var i = 0; i < S.drones.length; i++) if (S.drones[i].state !== 'dead') n++; return n; }

    function newChain() { var id = ++S.chainN; S.chains[id] = { id: id, n: 0, pts: 0, live: 0 }; return id; }
    function ignite(d, chainId) {
      if (d.state !== 'live' || d.crackT > 0) return false;   // только что сорванный панцирь — огонь соседа второй раз не берёт
      if (d.shell) { d.shell = false; d.crackT = 0.6; emit('crack', { x: d.x, y: d.y }); return false; }
      var c = S.chains[chainId]; c.n++; c.live++;
      var pts = KINDS[d.kind].pts * Math.min(c.n, 20);
      c.pts += pts; S.score += pts;
      d.state = 'burn'; d.burnT = 0; d.chain = chainId; d.qHit = false;
      emit('ignite', { x: d.x, y: d.y, kind: d.kind, n: c.n, pts: pts });
      if (S.tut === 1) { S.tut = 2; setTip('tut2'); }
      return true;
    }
    function damageQueen(q, n, x, y) {
      if (!q || !q.alive) return;
      q.hp -= n; q.hurtT = 0.25; emit('qhurt', { x: x == null ? q.x : x, y: y == null ? q.y : y });
      if (S.tut === 4) { S.tut = 5; S.tip = null; }
      if (q.hp <= 0) {
        q.alive = false; q.hp = 0;
        var bonus = 300 + 200 * S.wave; S.score += bonus;
        emit('queen', { x: q.x, y: q.y, pts: bonus });
        var id = newChain();
        for (var i = 0; i < S.drones.length; i++) { var d = S.drones[i]; if (d.state === 'live' && Math.hypot(d.x - q.x, d.y - q.y) < 90) ignite(d, id); }
        S.surge = null; q.warn = 0;
      }
    }

    // ---------- Игрок ----------
    function fire() {
      var p = S.player;
      if (!S.started || S.over || !p.alive || p.cd > 0 || p.charges < 1) return false;
      if (S.phase === 'clear') return false;
      p.charges--; p.cd = FIRE_CD; if (p.rech <= 0) p.rech = RECHARGE;
      S.sparks.push({ x: p.x, y: p.y - 14 });
      emit('shoot', {});
      return true;
    }
    function lure() {
      var p = S.player;
      if (!S.started || S.over || !p.alive || p.lureCd > 0 || S.lure || S.phase === 'clear') return false;
      S.lure = { x: p.x, y: p.y - 18, ty: Math.max(150, p.y - 200), state: 'fly', t: 0 };
      p.lureCd = LURE_CD; emit('lure', { x: p.x, y: p.y });
      if (S.tut === 2) { S.tut = 3; setTip('tut3'); }
      return true;
    }
    function burstLure() {
      var L = S.lure; if (!L) return;
      var id = newChain(), hit = 0;
      for (var i = 0; i < S.drones.length; i++) { var d = S.drones[i]; if (d.state === 'live' && Math.hypot(d.x - L.x, d.y - L.y) < LURE_BURST) { ignite(d, id); hit++; } }
      if (S.queen && S.queen.alive && Math.hypot(S.queen.x - L.x, S.queen.y - L.y) < LURE_BURST + QUEEN_R) damageQueen(S.queen, 2, L.x, L.y);
      emit('burst', { x: L.x, y: L.y, n: hit });
      S.lure = null;
    }
    function hitPlayer(x, y, cause) {
      var p = S.player;
      if (!p.alive || p.inv > 0) return;
      p.alive = false; S.lives--; emit('die', { x: p.x, y: p.y, cause: cause || 'drone', surge: !!S.surge });
      S.spores = [];
      // рой отлетает от места гибели
      for (var i = 0; i < S.drones.length; i++) {
        var d = S.drones[i]; if (d.state !== 'live') continue;
        var dx = d.x - p.x, dy = d.y - p.y, l = Math.hypot(dx, dy) || 1;
        if (l < 200) { d.vx += dx / l * 260; d.vy += dy / l * 260 - 120; }
      }
      S.surge = null;
      if (S.lives <= 0) S.overT = 1.6; else p.respawnT = 1.8;
    }

    // ---------- Шаг ----------
    function steerDrones(dt, P) {
      var q = S.queen, L = S.lure, p = S.player, i, j, d, e;
      var qx = q ? q.x : W / 2, qy = q ? q.y : 140;
      var surge = S.surge && S.surge.t > 0;
      for (i = 0; i < S.drones.length; i++) {
        d = S.drones[i];
        if (d.state === 'dead') continue;
        if (d.state === 'burn') { d.vx *= 1 - dt * 3; d.vy = d.vy * (1 - dt * 3) + 30 * dt; d.x += d.vx * dt; d.y += d.vy * dt; continue; }
        if (d.crackT > 0) d.crackT -= dt;
        var K = KINDS[d.kind], sp = P.speed * K.spd, tx, ty, huddle = false, k = 1.6;
        d.ph += dt * (0.55 + (d.id % 5) * 0.08);
        if (L && Math.hypot(d.x - L.x, d.y - L.y) < LURE_ATTR) { tx = L.x; ty = L.y; huddle = true; sp *= 2.4; k = 2.8; }
        else if (surge && p.alive) { tx = S.surge.x + Math.cos(d.ph) * 30; ty = S.surge.y + Math.sin(d.ph) * 20; sp *= 1.25 + 0.17 * S.wave; }
        else if (q && q.alive) { tx = qx + Math.cos(d.ph) * d.orb; ty = qy + 50 + Math.sin(d.ph * 1.3) * d.orb * 0.8; }
        else { tx = W / 2 + Math.cos(d.ph) * 170; ty = 230 + Math.sin(d.ph * 1.3) * 90; sp *= 1.15; }
        var dvx = (tx - d.x) * k, dvy = (ty - d.y) * k;
        // охота: близкий корабль притягивает мошку (кроме клубка у манка)
        if (!huddle && p.alive && p.inv <= 0) {
          var hx = p.x - d.x, hy = p.y - d.y, hl = Math.hypot(hx, hy);
          if (hl < P.huntR && hl > 0.5) { dvx = hx / hl * P.hunt * 1.2; dvy = hy / hl * P.hunt * 1.2; sp = Math.max(sp, P.hunt); }
        }
        var dl = Math.hypot(dvx, dvy); if (dl > sp) { dvx = dvx / dl * sp; dvy = dvy / dl * sp; }
        // разлёт: в стае — SEP, в клубке — SEP_HUDDLE
        var sep = huddle ? SEP_HUDDLE : SEP, sx = 0, sy = 0;
        for (j = 0; j < S.drones.length; j++) {
          if (j === i) continue; e = S.drones[j]; if (e.state === 'dead') continue;
          var ex = d.x - e.x, ey = d.y - e.y;
          if (ex > sep || ex < -sep || ey > sep || ey < -sep) continue;
          var el = Math.sqrt(ex * ex + ey * ey);
          if (el < sep && el > 0.01) { var f = (sep - el) / sep; sx += ex / el * f; sy += ey / el * f; }
        }
        if (q && q.alive) { var qx2 = d.x - qx, qy2 = d.y - qy, ql = Math.hypot(qx2, qy2); if (ql < QUEEN_R + 16 && ql > 0.01) { sx += qx2 / ql * 1.5; sy += qy2 / ql * 1.5; } }
        dvx += sx * 140; dvy += sy * 140;
        var a = Math.min(1, dt * 4);
        d.vx += (dvx - d.vx) * a; d.vy += (dvy - d.vy) * a;
        d.x = clamp(d.x + d.vx * dt, 10, W - 10); d.y = clamp(d.y + d.vy * dt, -40, H - 10);
      }
    }
    function burnStep(dt) {
      var i, j, d, e, q = S.queen;
      for (i = 0; i < S.drones.length; i++) {
        d = S.drones[i]; if (d.state !== 'burn') continue;
        d.burnT += dt;
        if (d.burnT >= SPREAD0) {
          var rr = d.kind === 'powder' ? IGN * 1.9 : IGN;
          for (j = 0; j < S.drones.length; j++) {
            e = S.drones[j]; if (e.state !== 'live') continue;
            var ex = e.x - d.x, ey = e.y - d.y;
            if (ex * ex + ey * ey < rr * rr) ignite(e, d.chain);
          }
          if (!d.qHit && q && q.alive && Math.hypot(q.x - d.x, q.y - d.y) < rr + QUEEN_R) { d.qHit = true; damageQueen(q, 1, d.x, d.y); }
        }
        if (d.burnT >= BURN) {
          d.state = 'dead'; emit('burnout', { x: d.x, y: d.y, kind: d.kind });
          var c = S.chains[d.chain];
          if (c && --c.live <= 0) {
            if (c.n >= 3) {
              var bonus = c.n >= 8 ? c.n * 20 : 0; S.score += bonus;
              S.lastChain = { n: c.n, pts: c.pts + bonus, t: 1.6 }; emit('chain', { n: c.n, pts: c.pts + bonus });
              if (c.n > S.bestChain) S.bestChain = c.n;
              if (S.tut === 3 && c.n >= 4) { S.tut = 4; setTip('tut4'); }
            }
            delete S.chains[d.chain];
          }
        }
      }
    }

    function step(dt) {
      var p = S.player, P = params(), i, j, d, q = S.queen;
      S.t += dt;
      if (S.bannerT > 0) { S.bannerT -= dt; if (S.bannerT <= 0) S.banner = null; }
      if (S.tip) S.tipT += dt;
      if (S.lastChain) { S.lastChain.t -= dt; if (S.lastChain.t <= 0) S.lastChain = null; }

      // игрок
      if (p.alive) {
        var l = Math.hypot(p.dx, p.dy), mx = p.dx, my = p.dy; if (l > 1) { mx /= l; my /= l; }
        p.x = clamp(p.x + mx * P_SPEED * dt, 16, W - 16); p.y = clamp(p.y + my * P_SPEED * dt, PY0, PY1);
        if (p.inv > 0) p.inv -= dt;
      }
      if (p.cd > 0) p.cd -= dt;
      if (p.charges < CHARGES) { p.rech -= dt; if (p.rech <= 0) { p.charges++; p.rech = p.charges < CHARGES ? RECHARGE : 0; } }
      if (p.lureCd > 0) p.lureCd -= dt;
      if (p.fire) fire();
      if (!p.alive && S.overT <= 0 && p.respawnT > 0) {
        p.respawnT -= dt;
        if (p.respawnT <= 0 && S.lives > 0) {
          p.alive = true; p.x = W / 2; p.y = 572; p.inv = 2.2; p.charges = CHARGES; emit('respawn', {}); setBanner('ready', 1.1);
        }
      }
      if (S.overT > 0) { S.overT -= dt; if (S.overT <= 0) { S.over = true; emit('gameover', { score: S.score }); return; } }

      // фазы
      if (S.phase === 'intro') { S.phaseT -= dt; if (S.phaseT <= 0) S.phase = 'fight'; }
      else if (S.phase === 'clear') {
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.wave >= WAVES) { S.over = true; S.won = true; emit('win', { score: S.score }); return; }
          startWave(S.wave + 1);
        }
      }

      // Матка: полёт, кладка, плевки, бросок роя
      if (q && q.alive) {
        q.t += dt; if (q.hurtT > 0) q.hurtT -= dt;
        q.x = W / 2 + Math.sin(q.t * 0.33) * 150; q.y = 118 + Math.sin(q.t * 0.51) * 36;
        if (S.phase === 'fight' && p.alive) {
          S.layT -= dt;
          if (S.layT <= 0) { S.layT = P.lay; if (liveDrones() < P.cap) { addDrone('gnat', q.x, q.y + 20); emit('lay', { x: q.x, y: q.y }); } }
          if (P.spit) { S.spitT -= dt; if (S.spitT <= 0) { S.spitT = P.spit * (0.8 + rng() * 0.4);
            var dx = p.x - q.x, dy = p.y - q.y, dl = Math.hypot(dx, dy) || 1;
            for (var fi = 0; fi < P.fan; fi++) { var a0 = Math.atan2(dy, dx) + (fi - (P.fan - 1) / 2) * 0.32;
              S.spores.push({ x: q.x, y: q.y + 18, vx: Math.cos(a0) * P.spore, vy: Math.sin(a0) * P.spore }); }
            emit('spit', {}); } }
          if (P.surge) {
            if (q.warn > 0) { q.warn -= dt; if (q.warn <= 0) { S.surge = { x: p.x, y: p.y - 40, t: 3.4 }; emit('surge', {}); } }
            else if (!S.surge) { S.surgeT -= dt; if (S.surgeT <= 0) { S.surgeT = P.surge * (0.85 + rng() * 0.3); q.warn = 0.9; emit('warn', {}); } }
          }
        }
      }
      if (S.surge) {   // бросок: точка сбора роя ползёт за кораблём
        S.surge.t -= dt; if (S.surge.t <= 0) S.surge = null;
        else if (p.alive) { var gx = p.x - S.surge.x, gy = p.y - S.surge.y, gl = Math.hypot(gx, gy), gs = 125 * dt; if (gl > gs) { S.surge.x += gx / gl * gs; S.surge.y += gy / gl * gs; } }
      }

      // манок
      var L = S.lure;
      if (L) {
        L.t += dt;
        if (L.state === 'fly') { L.y -= LURE_V * dt; if (L.y <= L.ty) { L.y = L.ty; L.state = 'hover'; L.t = 0; } }
        else if (L.t >= LURE_HOVER) { S.lure = null; emit('fizzle', { x: L.x, y: L.y }); }
      }

      steerDrones(dt, P);
      burnStep(dt);

      // искры
      for (i = S.sparks.length - 1; i >= 0; i--) {
        var s = S.sparks[i]; s.y -= SPARK_V * dt;
        if (s.y < -20) { S.sparks.splice(i, 1); continue; }
        var used = false;
        if (S.lure && S.lure.state === 'hover' && Math.abs(s.x - S.lure.x) < 15 && Math.abs(s.y - S.lure.y) < 15) { burstLure(); used = true; }
        for (j = 0; j < S.drones.length && !used; j++) {
          d = S.drones[j]; if (d.state !== 'live') continue;
          var ex = s.x - d.x, ey = s.y - d.y, rr = d.r + 4;
          if (ex * ex + ey * ey < rr * rr) { if (d.shell) ignite(d, 0); else ignite(d, newChain()); used = true; }
        }
        if (!used && q && q.alive && Math.abs(s.x - q.x) < QUEEN_R && Math.abs(s.y - q.y) < QUEEN_R) { damageQueen(q, 1, s.x, s.y); used = true; }
        if (used) S.sparks.splice(i, 1);
      }
      // плевки Матки
      for (i = S.spores.length - 1; i >= 0; i--) {
        var b = S.spores[i]; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y > H + 20 || b.x < -20 || b.x > W + 20 || b.y < -20) { S.spores.splice(i, 1); continue; }
        if (p.alive && p.inv <= 0 && Math.abs(b.x - p.x) < SHIP_R - 1 && Math.abs(b.y - p.y) < SHIP_R) { S.spores.splice(i, 1); hitPlayer(b.x, b.y, 'spore'); break; }
      }
      // столкновение с живой мошкой
      if (p.alive && p.inv <= 0) {
        for (i = 0; i < S.drones.length; i++) {
          d = S.drones[i]; if (d.state !== 'live') continue;
          var cx = d.x - p.x, cy = d.y - p.y, cr = d.r + SHIP_R - 3;
          if (cx * cx + cy * cy < cr * cr) { hitPlayer(d.x, d.y); break; }
        }
      }
      // волна отбита: Матка погашена, рой сгорел
      if (S.phase === 'fight' && q && !q.alive && liveDrones() === 0 && S.overT <= 0) {
        S.phase = 'clear'; S.phaseT = 2.0; S.spores = []; S.lure = null;
        var wb = 100 * S.wave; S.score += wb;
        setBanner(S.wave >= WAVES ? 'final' : 'cleared', 2.0); S.tip = null;
        emit('clear', { wave: S.wave, pts: wb });
      }
    }

    function update(dt) {
      if (!S.started || S.over) return;
      var n = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-9)), h = dt / n;
      for (var i = 0; i < n && !S.over; i++) step(h);
    }
    function start() {
      S.score = 0; S.lives = opts.lives || 3; S.over = false; S.won = false; S.started = true; S.t = 0; S.overT = 0; S.bestChain = 0;
      var p = S.player; p.x = W / 2; p.y = 572; p.alive = true; p.inv = 0; p.respawnT = 0; p.cd = 0; p.charges = CHARGES; p.rech = 0; p.lureCd = 0;
      startWave(opts.startWave || 1);
      emit('start', {});
      return api;
    }
    // «Ещё один шанс» за рекламу: корабль на той же волне, рой отогнан
    function reviveAd() {
      if (!S.over || S.won) return false;
      S.over = false; S.overT = 0; S.lives = 1;
      var p = S.player; p.alive = true; p.x = W / 2; p.y = 572; p.inv = 2.6; p.charges = CHARGES; p.respawnT = 0;
      S.spores = []; S.surge = null; if (S.queen) S.queen.warn = 0;
      for (var i = 0; i < S.drones.length; i++) { var d = S.drones[i]; if (d.state === 'live' && d.y > 300) { d.y = 260; d.vy = -120; } }
      emit('respawn', {}); setBanner('ready', 1.1);
      return true;
    }
    function canBoost() { return S.started && !S.over && S.lives < MAX_LIVES; }
    function boost() { if (!canBoost()) return false; S.lives++; emit('life', {}); return true; }

    var api = {
      W: W, H: H,
      start: start, reset: start, update: update,
      setDir: function (dx, dy) { S.player.dx = clamp(+dx || 0, -1, 1); S.player.dy = clamp(+dy || 0, -1, 1); },
      setFire: function (v) { S.player.fire = !!v; },
      fire: fire, lure: lure, reviveAd: reviveAd, canBoost: canBoost, boost: boost,
      isOver: function () { return S.over; },
      state: function () { return S; },
      params: params,
      // для тестов и промо-съёмки:
      _S: S, _step: step, _startWave: startWave, _ignite: ignite, _newChain: newChain, _addDrone: addDrone, _hitPlayer: hitPlayer, _damageQueen: damageQueen
    };
    return api;
  };

  // Переделка 2026-11: правила и счёт новые. Прежний рекорд (старые правила) уходит в arcade.roy.oldBest,
  // рекорд начинается заново; метка версии arcade.roy.v = 2. Возвращает прежний рекорд (0 — переносить нечего).
  R.migrate = function (ls) {
    var old = 0;
    try {
      if (ls && ls.getItem('arcade.roy.v') !== '2') {
        old = +ls.getItem('arcade.best.roy') || 0;
        if (old) { ls.setItem('arcade.roy.oldBest', String(old)); ls.removeItem('arcade.best.roy'); }
        ls.setItem('arcade.roy.v', '2');
      }
    } catch (e) { old = 0; }
    return old;
  };

  R.consts = { W: W, H: H, PY0: PY0, PY1: PY1, WAVES: WAVES, KINDS: KINDS, WAVE_DEF: WAVE_DEF, IGN: IGN, BURN: BURN, SPREAD0: SPREAD0,
    SEP: SEP, SEP_HUDDLE: SEP_HUDDLE, LURE_CD: LURE_CD, LURE_HOVER: LURE_HOVER, LURE_BURST: LURE_BURST, QUEEN_R: QUEEN_R,
    CHARGES: CHARGES, RECHARGE: RECHARGE, SPARK_V: SPARK_V, P_SPEED: P_SPEED, SHIP_R: SHIP_R, MAX_LIVES: MAX_LIVES, FIRE_CD: FIRE_CD };
  R.W = W; R.H = H;
})(typeof window !== 'undefined' ? window : globalThis);
