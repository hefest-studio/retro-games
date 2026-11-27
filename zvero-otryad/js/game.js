/* ЗВЕРО-ОТРЯД · логика (переделка 2026-11: «два зверя на упругом канате»). DOM-free, детерминирована при заданном rng.
   Мир — одна экранная «клетка 32 px» (30×17), два зверя связаны упругим канатом. Ёж Пыж — тяжёлый и колючий (давит жуков боком),
   заяц Тяпа — лёгкий и прыгучий. Канат — пружина с демпфером: тянет обоих друг к другу (тяжёлый почти не сдвигается), «упереться» (hold)
   — стать якорем (канат тебя не двигает), в воздухе у натянутого каната ↑ — выбрать канат (вытащить себя / партнёра). Свисающий зверь
   качается маятником вокруг якоря. Кнопки-плиты открывают ворота, шипы и жуки — беда, на последнем уровне канат, натянутый поперёк
   арены, подсекает босса.
   API: ZVERO.Game({ rng, onEvent(type, data), players, level, noHints }) → start(), update(dt), state(), setInput(i, x, up, hold),
        jump(i), swap(), restart(), reviveAd(), boost(), nextLevel(); ZVERO.logic = { W, H, TS, K, mulberry32 }. */
(function (global) {
  'use strict';
  var Z = global.ZVERO = global.ZVERO || {};
  var TS = 32, COLS = 30, ROWS = 17, W = COLS * TS, H = ROWS * TS;
  var K = {
    G: 1700, FALL: 900, DT: 1 / 120, KS: 1000, KD: 42, LIVES: 5, MAXLIVES: 9,
    REEL: 105, UNREEL: 75, MINLEN: 24, COYOTE: 0.1, JBUF: 0.12, INTRO: 1.5, CLEAR: 2.2, RESPAWN: 0.9, EXIT_T: 0.35
  };
  var SPEC = [
    { id: 'pyzh', w: 24, h: 26, m: 1.5, run: 128, jump: 545, acc: 1500, air: 820 },
    { id: 'tyapa', w: 22, h: 34, m: 1.0, run: 160, jump: 625, acc: 1700, air: 900 }
  ];
  // плиты: символ → [ворота, защёлка]
  var PLATES = { '1': ['a', 0], '2': ['b', 0], '3': ['c', 0], '4': ['d', 1], '5': ['e', 1], '6': ['f', 1] };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hyp(a, b) { return Math.sqrt(a * a + b * b); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, onEvent = opts.onEvent || function () {};
    var LV = Z.LEVELS, S = null;
    function ev(t, d) { onEvent(t, d || {}); }

    // ---------- Загрузка уровня ----------
    function load(idx) {
      var L = LV[idx], map = L.map, i, j, c;
      var o = {
        lv: idx, name: L.name, hintKey: L.hint || null, par: L.par || 90, sky: L.sky || 0,
        tiles: [], gateOpen: {}, plateOn: {}, latched: {}, stars: [], plates: [], gates: [], spikes: [], enemies: [], exit: null,
        boss: null, gears: [], marks: [], t: 0, deaths: 0, got: 0, exitT: 0, shake: 0
      };
      for (j = 0; j < ROWS; j++) {
        o.tiles[j] = [];
        for (i = 0; i < COLS; i++) {
          c = (map[j] || '').charAt(i) || '.'; o.tiles[j][i] = c;
          if (c === 'P') { o.sp0 = { x: i * TS + TS / 2, y: (j + 1) * TS }; o.tiles[j][i] = '.'; }
          else if (c === 'T') { o.sp1 = { x: i * TS + TS / 2, y: (j + 1) * TS }; o.tiles[j][i] = '.'; }
          else if (c === 'S') { o.stars.push({ x: i * TS + TS / 2, y: j * TS + TS / 2, got: false, ph: i * 0.7 }); o.tiles[j][i] = '.'; }
          else if (c === 'E') { o.exit = { x: i * TS + TS / 2, y: (j + 1) * TS, w: 44, h: 66, open: !L.boss }; o.tiles[j][i] = '.'; }
          else if (c === '^') o.spikes.push({ c: i, r: j });
          else if (PLATES[c]) o.plates.push({ c: i, r: j, ch: c, gate: PLATES[c][0], latch: PLATES[c][1], on: false });
          else if (c >= 'a' && c <= 'f') { o.gates.push({ c: i, r: j, id: c }); o.gateOpen[c] = false; }
          else if (c === 'w') { o.enemies.push({ x: i * TS + TS / 2, y: (j + 1) * TS, w: 28, h: 22, dir: i > COLS / 2 ? -1 : 1, vx: 0, alive: true, die: 0, t: rng() * 3 }); o.tiles[j][i] = '.'; }
          else if (c === 'B') {
            o.boss = { x: i * TS + TS / 2, y: (j + 1) * TS, w: 92, h: 96, hp: 3, max: 3, state: 'idle', t: 2.6, dir: 1, speed: 210, die: 0, gearT: 4.2, flash: 0, bash: 0 };
            o.tiles[j][i] = '.';
          }
        }
      }
      o.len = o.base = L.rope || 150; o.minLen = K.MINLEN;
      o.rope = { d: 0, taut: false, tension: 0, reel: 0 };
      if (o.boss) { o.boss.x0 = L.arena[0] * TS; o.boss.x1 = (L.arena[1] + 1) * TS; }
      return o;
    }
    function mkAnimal(i, sp) {
      var s = SPEC[i];
      return { i: i, id: s.id, w: s.w, h: s.h, m: s.m, run: s.run, jump: s.jump, acc: s.acc, air: s.air, x: sp.x, y: sp.y, vx: 0, vy: 0,
        on: false, coyote: 0, jbuf: 0, jheld: false, face: i ? -1 : 1, brace: false, dead: 0, inv: 0, sx: sp.x, sy: sp.y, safe: { x: sp.x, y: sp.y }, safeT: 0,
        walk: 0, air_t: 0, land: 0, hang: false, ix: 0, hurtT: 0 };
    }
    function resetAnimals() {
      S.an = [mkAnimal(0, S.sp0), mkAnimal(1, S.sp1)];
      S.rope.reel = 0; S.len = S.base;
    }

    // ---------- Клетки ----------
    function cell(c, r) {
      if (c < 0 || c >= COLS || r < 0) return '#';
      if (r >= ROWS) return S.tiles[ROWS - 1][c] === '#' ? '#' : '.';   // земля уходит вниз за кадр, пропасти — пустота
      return S.tiles[r][c];
    }
    function isGate(ch) { return ch >= 'a' && ch <= 'f'; }
    function solidCh(ch) { return ch === '#' || (isGate(ch) && !S.gateOpen[ch]); }
    function solidAt(c, r) { return solidCh(cell(c, r)); }
    function oneAt(c, r) { return cell(c, r) === '='; }

    function rectHitsSolid(x0, y0, x1, y1) {
      var c0 = Math.floor(x0 / TS), c1 = Math.floor((x1 - 0.001) / TS), r0 = Math.floor(y0 / TS), r1 = Math.floor((y1 - 0.001) / TS), c, r;
      for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) if (solidAt(c, r)) return true;
      return false;
    }
    function moveX(a, dx) {
      if (!dx) return;
      var n = Math.ceil(Math.abs(dx) / 6), sx = dx / n, k;
      for (k = 0; k < n; k++) {
        a.x += sx;
        var l = a.x - a.w / 2, r = a.x + a.w / 2, t = a.y - a.h + 0.5, b = a.y - 0.5;
        var c0 = Math.floor(l / TS), c1 = Math.floor((r - 0.001) / TS), r0 = Math.floor(t / TS), r1 = Math.floor((b - 0.001) / TS), c, rr, hit = false;
        for (rr = r0; rr <= r1 && !hit; rr++) for (c = c0; c <= c1; c++) if (solidAt(c, rr)) {
          hit = true; a.x = sx > 0 ? c * TS - a.w / 2 : (c + 1) * TS + a.w / 2; break;
        }
        if (hit) {
          // «зацеп за кромку»: невысокий уступ (до 20 px) — забираемся, не останавливаясь (вытащили на край — перекатился на уступ)
          var ok = false, up, ty, tx = a.x - sx * 0;   // a.x уже прижат; пробуем вернуть шаг и поднять
          if (a.vx * sx > 0 && a.vy > -80) {
            tx = a.x + (sx > 0 ? 1 : -1) * 0;
            var wx = (sx > 0 ? c * TS - a.w / 2 : (c + 1) * TS + a.w / 2) + sx;   // чуть вглубь стены
            for (up = 4; up <= 20 && !ok; up += 4) { ty = a.y - up; if (!rectHitsSolid(wx - a.w / 2, ty - a.h + 0.5, wx + a.w / 2, ty - 0.5)) { ok = true; a.x = wx; a.y = ty; } }
          }
          if (!ok && a.vx * sx > 0) a.vx = 0;
          if (!ok) break;
        }
      }
    }
    function moveY(a, dy) {
      var n = Math.max(1, Math.ceil(Math.abs(dy) / 6)), sy = dy / n, k;
      a.onNow = false;
      for (k = 0; k < n; k++) {
        var py = a.y; a.y += sy;
        var l = a.x - a.w / 2, r = a.x + a.w / 2, t = a.y - a.h, b = a.y;
        var c0 = Math.floor(l / TS), c1 = Math.floor((r - 0.001) / TS), c, rr, hit = false;
        if (sy < 0) {
          rr = Math.floor(t / TS);
          for (c = c0; c <= c1; c++) if (solidAt(c, rr)) { hit = true; a.y = (rr + 1) * TS + a.h; break; }
          if (hit) { if (a.vy < 0) a.vy = 0; break; }
        } else {
          rr = Math.floor((b - 0.001) / TS);
          for (c = c0; c <= c1; c++) {
            if (solidAt(c, rr) || (oneAt(c, rr) && py <= rr * TS + 0.5 && !a.drop)) { hit = true; a.y = rr * TS; break; }
          }
          if (hit) { a.onNow = true; if (a.vy > 0) a.vy = 0; break; }
        }
      }
    }
    function groundBelow(a) {
      var l = a.x - a.w / 2, r = a.x + a.w / 2, rr = Math.floor((a.y + 1) / TS), c;
      for (c = Math.floor(l / TS); c <= Math.floor((r - 0.001) / TS); c++) if (solidAt(c, rr) || (oneAt(c, rr) && Math.abs(a.y - rr * TS) < 0.6)) return true;
      return false;
    }

    // ---------- Ввод ----------
    function intent(i) {
      if (S.players === 2) return S.inp[i];
      return i === S.active ? S.inp[0] : null;
    }
    function isBraced(a) {
      if (a.dead > 0 || !a.on) return false;
      if (S.players === 2) return !!S.inp[a.i].hold;
      return a.i !== S.active;
    }

    // ---------- Смерть / возрождение ----------
    function kill(a, why) {
      if (a.dead > 0 || a.inv > 0 || S.phase !== 'play') return;
      a.dead = K.RESPAWN; a.vx = a.vy = 0; S.lives--; S.deaths++;
      ev('die', { i: a.i, x: a.x, y: a.y - a.h / 2, why: why });
      if (S.lives <= 0) { S.phase = 'over'; S.overT = 0; ev('gameover', {}); }
    }
    function respawn(a) {
      var o = S.an[1 - a.i], p = (o.dead <= 0 && o.on) ? { x: o.x, y: o.y } : (o.dead <= 0 ? o.safe : { x: S.sp0.x, y: S.sp0.y });
      var x = p.x + (a.i ? 18 : -18), y = p.y, k = 0;
      if (o.dead > 0) { x = a.sx; y = a.sy; }
      if (rectHitsSolid(x - a.w / 2, y - a.h, x + a.w / 2, y - 0.5)) x = p.x;
      while (k++ < 8 && rectHitsSolid(x - a.w / 2, y - a.h, x + a.w / 2, y - 0.5)) y -= TS;
      a.x = x; a.y = y; a.vx = a.vy = 0; a.dead = 0; a.inv = 1.6; a.on = false; a.safe = { x: x, y: y };
      ev('respawn', { i: a.i, x: x, y: y });
    }

    // ---------- Шаг ----------
    function ropeEnds() {
      var A = S.an[0], B = S.an[1];
      return { ax: A.x, ay: A.y - A.h * 0.55, bx: B.x, by: B.y - B.h * 0.55 };
    }
    function stepAnimals(dt) {
      var A = S.an[0], B = S.an[1], i, a, it, tgt, ac, jumpedNow;
      for (i = 0; i < 2; i++) {
        a = S.an[i];
        if (a.dead > 0) { a.dead -= dt; if (a.dead <= 0 && S.phase === 'play') respawn(a); continue; }
        if (a.inv > 0) a.inv -= dt;
        it = intent(i);
        a.brace = isBraced(a);
        var ix = it ? it.x : 0;
        a.ix = ix;
        if (a.brace) { a.vx = 0; if (a.on) a.vy = 0; }
        else {
          tgt = ix * a.run; ac = a.on ? a.acc : a.air;
          if (ix) {
            a.face = ix > 0 ? 1 : -1;
            if (Math.abs(ix) < 1 || a.vx * ix < Math.abs(tgt)) { var nv = a.vx + clamp(tgt - a.vx, -ac * dt, ac * dt); if (Math.abs(ix) >= 1 && a.vx * ix >= 0 && nv * ix > Math.abs(tgt)) nv = tgt; a.vx = nv; }
            else if (a.on) a.vx -= Math.sign(a.vx) * Math.min(Math.abs(a.vx) - Math.abs(tgt), 900 * dt);   // быстрее бега по земле — гасим мягко
          }
          else if (a.on) { var fr = 1900 * dt; a.vx = Math.abs(a.vx) <= fr ? 0 : a.vx - Math.sign(a.vx) * fr; }
          else a.vx *= (1 - 0.35 * dt);
        }
        // прыжок: буфер + «койот»
        a.jbuf = Math.max(0, a.jbuf - dt); a.coyote = a.on ? K.COYOTE : Math.max(0, a.coyote - dt);
        if (a.jbuf > 0 && a.coyote > 0 && !a.brace && it) {
          a.vy = -a.jump; a.on = false; a.coyote = 0; a.jbuf = 0; a.land = 0; ev('jump', { i: i, x: a.x, y: a.y });
        } else if (a.jbuf > 0 && a.brace) a.jbuf = 0;
        if (!a.brace) {
          var g = K.G; if (a.vy < 0 && !(it && it.up)) g *= 1.9;   // отпустил «вверх» — прыжок короче
          a.vy = Math.min(K.FALL, a.vy + g * dt);
        }
      }
      // канат — пружина с демпфером
      var rp = S.rope, e0 = ropeEnds(), dx = e0.bx - e0.ax, dy = e0.by - e0.ay, d = hyp(dx, dy) || 0.001;
      rp.d = d; rp.taut = d > S.len - 2; rp.tension = clamp((d - S.len) / 40, 0, 1);
      if (A.dead <= 0 && B.dead <= 0) {
        // выбирание каната: у натянутого каната ↑ — в воздухе (падаю / вишу) или когда партнёр выше
        var reeling = 0;
        for (i = 0; i < 2; i++) {
          a = S.an[i]; it = intent(i); var o = S.an[1 - i];
          if (it && it.up && !a.brace && a.jbuf <= 0 && a.vy > -120 && d > 40 && ((!a.on && o.y - o.h < a.y - a.h + 40) || (a.on && o.y - o.h < a.y - a.h - 20))) reeling = 1;
        }
        if (reeling) { S.len = Math.max(S.minLen, Math.min(S.len, d + 2) - K.REEL * dt); }
        else if (S.len < S.base) S.len = Math.min(S.base, S.len + K.UNREEL * dt);
        rp.reel = reeling;
        if (d > S.len) {
          var nx = dx / d, ny = dy / d, e = d - S.len;
          var vr = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny, F = K.KS * e + K.KD * Math.max(vr, 0) * 0.5;
          var iA = A.brace ? 0 : 1 / A.m, iB = B.brace ? 0 : 1 / B.m;
          A.vx += nx * F * iA * dt; A.vy += ny * F * iA * dt;
          B.vx -= nx * F * iB * dt; B.vy -= ny * F * iB * dt;
          if (vr > 0) { var cd = Math.min(1, K.KD * dt * 0.5); if (iA) { A.vx += nx * vr * cd * iA / (iA + iB); A.vy += ny * vr * cd * iA / (iA + iB); } if (iB) { B.vx -= nx * vr * cd * iB / (iA + iB); B.vy -= ny * vr * cd * iB / (iA + iB); } }
        }
      }
      for (i = 0; i < 2; i++) {
        a = S.an[i]; if (a.dead > 0) continue;
        a.drop = false;
        var wasOn = a.on, vyIn = a.vy;
        moveX(a, a.vx * dt); moveY(a, a.vy * dt);
        a.on = a.onNow || (a.vy >= 0 && groundBelow(a) && Math.abs(a.vy) < 40 && wasOn);
        if (a.onNow) a.on = true;
        if (!wasOn && a.on) { a.land = 0.18; if (vyIn > 330) ev('land', { i: i, x: a.x, y: a.y, v: vyIn }); }
        if (a.land > 0) a.land -= dt;
        var spd = Math.abs(a.vx); if (a.on && spd > 8) a.walk += dt * spd * 0.055; else if (!a.on) a.air_t += dt;
        if (a.on) a.air_t = 0;
        a.hang = !a.on && rp.taut && !a.brace;
        // безопасная точка для возрождения партнёра
        if (a.on) { a.safeT += dt; if (a.safeT > 0.35 && !nearHazard(a)) { a.safe = { x: a.x, y: a.y }; a.safeT = 0; } } else a.safeT = 0;
      }
    }
    function nearHazard(a) {
      var c = Math.floor(a.x / TS), r = Math.floor((a.y - 1) / TS), k;
      for (k = -2; k <= 2; k++) { if (cell(c + k, r) === '^' || cell(c + k, r + 1) === '^') return true; }
      return false;
    }

    function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }

    function stepWorld(dt) {
      var i, a, k;
      S.t += dt;
      // плиты и ворота
      for (k = 0; k < S.plates.length; k++) {
        var p = S.plates[k], on = false;
        for (i = 0; i < 2; i++) {
          a = S.an[i]; if (a.dead > 0) continue;
          if (a.on && a.x > p.c * TS + 2 && a.x < p.c * TS + TS - 2 && a.y > p.r * TS + TS - 4 && a.y <= p.r * TS + TS + 1) on = true;
        }
        if (on && !p.on) ev('plate', { c: p.c, r: p.r, latch: p.latch });
        p.on = on;
        if (p.latch && on) S.latched[p.gate] = true;
      }
      var want = {}, ch;
      for (k = 0; k < S.plates.length; k++) if (S.plates[k].on || (S.plates[k].latch && S.latched[S.plates[k].gate])) want[S.plates[k].gate] = true;
      for (k = 0; k < S.gates.length; k++) {
        var gt = S.gates[k]; ch = gt.id;
        if (want[ch] && !S.gateOpen[ch]) { S.gateOpen[ch] = true; ev('gate', { open: true, c: gt.c, r: gt.r }); }
        else if (!want[ch] && S.gateOpen[ch]) {
          var blocked = false;
          for (i = 0; i < 2; i++) { a = S.an[i]; if (a.dead <= 0 && overlap(a.x - a.w / 2, a.y - a.h, a.w, a.h, gt.c * TS, gt.r * TS, TS, TS)) blocked = true; }
          if (!blocked) { S.gateOpen[ch] = false; ev('gate', { open: false, c: gt.c, r: gt.r }); }
        }
      }
      // звёзды
      for (k = 0; k < S.stars.length; k++) {
        var s = S.stars[k]; if (s.got) continue;
        for (i = 0; i < 2; i++) { a = S.an[i]; if (a.dead <= 0 && Math.abs(a.x - s.x) < 20 && Math.abs(a.y - a.h / 2 - s.y) < 26) { s.got = true; S.got++; S.score += 100; ev('star', { x: s.x, y: s.y, n: S.got }); break; } }
      }
      // шипы, пропасть
      for (i = 0; i < 2; i++) {
        a = S.an[i]; if (a.dead > 0 || a.inv > 0) continue;
        if (a.y > H + 70) { kill(a, 'pit'); continue; }
        for (k = 0; k < S.spikes.length; k++) {
          var sp = S.spikes[k];
          if (overlap(a.x - a.w / 2 + 3, a.y - a.h + 4, a.w - 6, a.h - 4, sp.c * TS + 5, sp.r * TS + TS - 13, TS - 10, 13)) { kill(a, 'spike'); break; }
        }
      }
      stepEnemies(dt);
      if (S.boss) stepBoss(dt);
      // дверь
      var ex = S.exit;
      if (ex && ex.open) {
        var both = true;
        for (i = 0; i < 2; i++) { a = S.an[i]; if (a.dead > 0 || Math.abs(a.x - ex.x) > ex.w / 2 || a.y < ex.y - ex.h + 14 || a.y > ex.y + 2) both = false; }
        S.exitT = both ? S.exitT + dt : 0;
        if (S.exitT >= K.EXIT_T) levelClear();
      }
    }

    function stepEnemies(dt) {
      var k, i, a, en;
      for (k = 0; k < S.enemies.length; k++) {
        en = S.enemies[k];
        if (!en.alive) { en.die += dt; continue; }
        en.t += dt;
        var sp = 46;
        var nx = en.x + en.dir * (en.w / 2 + 2), ahead = solidAt(Math.floor(nx / TS), Math.floor((en.y - 4) / TS)), edge = !(solidAt(Math.floor(nx / TS), Math.floor((en.y + 2) / TS)) || oneAt(Math.floor(nx / TS), Math.floor((en.y + 2) / TS)));
        if (ahead || edge) en.dir = -en.dir; else en.x += en.dir * sp * dt;
        for (i = 0; i < 2; i++) {
          a = S.an[i]; if (a.dead > 0 || a.inv > 0) continue;
          if (!overlap(a.x - a.w / 2 + 2, a.y - a.h, a.w - 4, a.h, en.x - en.w / 2, en.y - en.h, en.w, en.h)) continue;
          var top = en.y - en.h, stomp = a.vy > 0 && a.y < top + 18;
          if (!stomp && a.vy <= 0 && a.y < top + 10) continue;   // летит над жуком вверх — не задел
          if (stomp) { a.vy = -430; en.alive = false; S.score += 100; ev('kill', { x: en.x, y: en.y - en.h / 2, how: 'stomp' }); }
          else if (a.i === 0) { en.alive = false; S.score += 100; ev('kill', { x: en.x, y: en.y - en.h / 2, how: 'spike' }); }
          else kill(a, 'bug');
          if (!en.alive) break;
        }
      }
    }

    function ropeCrosses(bx0, by0, bx1, by1) {
      // натянутый канат (отрезок между зверями) пересекает прямоугольник босса?
      var e = ropeEnds(), x0 = e.ax, y0 = e.ay, x1 = e.bx, y1 = e.by, t, px, py, n = 24;
      for (t = 0; t <= n; t++) { px = x0 + (x1 - x0) * t / n; py = y0 + (y1 - y0) * t / n; if (px > bx0 && px < bx1 && py > by0 && py < by1) return true; }
      return false;
    }
    function stepBoss(dt) {
      var B = S.boss, i, a, k;
      if (B.flash > 0) B.flash -= dt;
      if (B.state === 'dead') { B.die += dt; return; }
      B.t -= dt; B.bash = Math.max(0, B.bash - dt);
      var half = B.w / 2;
      if (B.state === 'idle') { if (B.t <= 0) { B.state = 'charge'; B.run = 0; B.dir = B.x < (B.x0 + B.x1) / 2 ? 1 : -1; ev('bossCharge', {}); } }
      else if (B.state === 'charge') {
        B.x += B.dir * B.speed * dt; B.run += B.speed * dt;
        if (B.x + half >= B.x1) { B.x = B.x1 - half; B.dir = -1; B.state = 'idle'; B.t = 0.9; B.bash = 0.4; S.shake = 0.35; ev('bossBash', {}); }
        else if (B.x - half <= B.x0) { B.x = B.x0 + half; B.dir = 1; B.state = 'idle'; B.t = 0.9; B.bash = 0.4; S.shake = 0.35; ev('bossBash', {}); }
        else if (S.rope.taut && B.run > 70 && ropeCrosses(B.x - half + 8, B.y - B.h, B.x + half - 8, B.y)) {
          B.hp--; B.state = 'stun'; B.t = 2.8; B.flash = 0.6; S.score += 300; S.shake = 0.5; ev('bossHit', { x: B.x, y: B.y - B.h / 2, hp: B.hp });
          if (B.hp <= 0) { B.state = 'dead'; B.die = 0; S.exit.open = true; S.score += 1000; S.gears = []; S.marks = []; ev('bossDie', { x: B.x, y: B.y - B.h / 2 }); return; }
          B.speed += 45;
        }
      } else if (B.state === 'stun') { if (B.t <= 0) { B.state = 'idle'; B.t = 0.7; } }
      // зверь на арене — беда
      if (B.state !== 'stun') for (i = 0; i < 2; i++) {
        a = S.an[i]; if (a.dead > 0 || a.inv > 0) continue;
        if (overlap(a.x - a.w / 2 + 3, a.y - a.h + 3, a.w - 6, a.h - 3, B.x - half + 6, B.y - B.h + 10, B.w - 12, B.h - 10)) kill(a, 'boss');
      }
      // шестерёнки
      if (B.state !== 'stun') B.gearT -= dt;
      if (B.gearT <= 0) {
        var cand = [];
        for (i = 0; i < 2; i++) if (S.an[i].dead <= 0) cand.push(S.an[i]);
        if (cand.length) {
          var tg = cand[Math.floor(rng() * cand.length)], T = 0.85, sx = B.x, sy = B.y - B.h, gg = 1300, ty = tg.y - tg.h / 2;
          S.marks.push({ x: tg.x, y: tg.y, t: T });
          S.gears.push({ x: sx, y: sy, vx: (tg.x - sx) / T, vy: (ty - sy - 0.5 * gg * T * T) / T, g: gg, r: 14, rot: 0, life: T + 0.5 });
          ev('gear', {});
        }
        B.gearT = B.hp <= 1 ? 1.7 : B.hp === 2 ? 2.2 : 2.8;
      }
      for (k = S.gears.length - 1; k >= 0; k--) {
        var gr = S.gears[k]; gr.vy += gr.g * dt; gr.x += gr.vx * dt; gr.y += gr.vy * dt; gr.rot += dt * 9; gr.life -= dt;
        var hitSolid = solidAt(Math.floor(gr.x / TS), Math.floor(gr.y / TS)) && gr.life < 1.4;
        for (i = 0; i < 2; i++) { a = S.an[i]; if (a.dead <= 0 && a.inv <= 0 && Math.abs(gr.x - a.x) < gr.r + a.w / 2 && Math.abs(gr.y - (a.y - a.h / 2)) < gr.r + a.h / 2) { kill(a, 'gear'); gr.life = 0; } }
        if (gr.life <= 0 || hitSolid || gr.y > H + 40) { if (hitSolid) ev('gearHit', { x: gr.x, y: gr.y }); S.gears.splice(k, 1); }
      }
      for (k = S.marks.length - 1; k >= 0; k--) { S.marks[k].t -= dt; if (S.marks[k].t <= 0) S.marks.splice(k, 1); }
    }

    function levelClear() {
      if (S.phase !== 'play') return;
      var tb = Math.max(0, Math.min(300, Math.round((S.par - S.t) * 6))), star = S.got * 100;
      S.bonus = { time: tb, noDeath: S.deaths === 0 ? 200 : 0, base: 300 };
      S.score += tb + S.bonus.noDeath + S.bonus.base;
      S.phase = 'clear'; S.clearT = 0; S.hold = false;
      S.starsAll += S.got; S.starsMax += S.stars.length;
      ev('clear', { lv: S.lv, got: S.got, of: S.stars.length, bonus: S.bonus, final: S.lv === LV.length - 1 });
      if (S.lv === LV.length - 1) { S.phase = 'won'; S.clearT = 0; ev('win', {}); }
    }

    function begin(idx, keep) {
      var w = load(idx);
      if (!keep) keep = {};
      S = w; S.phase = 'intro'; S.introT = 0; S.clearT = 0; S.overT = 0; S.hold = false;
      S.players = keep.players || opts.players || 1; S.active = 0;
      S.score = keep.score || 0; S.lives = keep.lives != null ? keep.lives : K.LIVES; S.starsAll = keep.starsAll || 0; S.starsMax = keep.starsMax || 0;
      S.inp = [{ x: 0, up: false, hold: false }, { x: 0, up: false, hold: false }];
      S.hint = null; S.hintShown = keep.hintShown || {};
      resetAnimals();
      ev('level', { lv: idx, name: S.name });
    }

    var api = {
      start: function (idx) { begin(idx || opts.level || 0, { players: opts.players }); return api; },
      state: function () { return S; },
      setPlayers: function (n) { if (S) S.players = n === 2 ? 2 : 1; opts.players = n === 2 ? 2 : 1; },
      setInput: function (i, x, up, hold) { if (!S) return; var p = S.inp[i]; p.x = clamp(x || 0, -1, 1); p.up = !!up; p.hold = !!hold; },
      jump: function (i) {
        if (!S || S.phase !== 'play') return;
        var a = S.players === 2 ? S.an[i] : S.an[S.active]; if (a) a.jbuf = K.JBUF;
      },
      swap: function () {
        if (!S || S.phase !== 'play' || S.players !== 1) return;
        S.active = 1 - S.active; ev('swap', { active: S.active });
      },
      restart: function () { var k = { players: S.players, score: S.score, lives: S.lives, starsAll: S.starsAll, starsMax: S.starsMax, hintShown: S.hintShown }; begin(S.lv, k); S.phase = 'play'; },
      nextLevel: function () {
        var k = { players: S.players, score: S.score, lives: S.lives, starsAll: S.starsAll, starsMax: S.starsMax, hintShown: S.hintShown };
        begin(S.lv + 1, k); return api;
      },
      reviveAd: function () {   // «ещё один шанс»: 3 жизни, уровень заново
        if (!S || S.phase !== 'over') return false;
        var k = { players: S.players, score: S.score, lives: 3, starsAll: S.starsAll, starsMax: S.starsMax, hintShown: S.hintShown };
        begin(S.lv, k); S.phase = 'play'; ev('revive', {}); return true;
      },
      canBoost: function () { return !!S && S.phase === 'play' && S.lives < K.MAXLIVES; },
      boost: function () { if (S && S.lives < K.MAXLIVES) { S.lives = Math.min(K.MAXLIVES, S.lives + 1); ev('boost', {}); } },
      update: function (dt) {
        if (!S) return;
        dt = Math.min(dt, 0.05);
        if (S.phase === 'intro') {
          S.introT += dt; if (S.introT >= K.INTRO) { S.phase = 'play'; S.hint = null; }
          return;
        }
        if (S.phase === 'clear') {
          S.clearT += dt; if (S.clearT > K.CLEAR && !S.hold) api.nextLevel(); return;
        }
        if (S.phase === 'won' || S.phase === 'over') { S.clearT += dt; S.overT += dt; return; }
        var acc = dt, n = 0;
        while (acc > 1e-6 && n < 12) { var h = Math.min(K.DT, acc); stepAnimals(h); stepWorld(h); acc -= h; n++; if (S.phase !== 'play') break; }
        if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
        // подсказка уровня: один раз за прохождение
        var L = LV[S.lv];
        if (L.hint && !opts.noHints && !S.hintShown[S.lv] && S.phase === 'play') { S.hint = { k: L.hint, t: 0 }; S.hintShown[S.lv] = 1; }
        if (S.hint) { S.hint.t += dt; if (S.hint.t > 7) S.hint = null; }
      }
    };
    return api;
  }

  Z.Game = Game;
  Z.logic = { W: W, H: H, TS: TS, COLS: COLS, ROWS: ROWS, K: K, SPEC: SPEC, PLATES: PLATES, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
