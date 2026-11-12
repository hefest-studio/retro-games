/* ============================================================================
   РОЙ · движок (DOM-free, детерминируемый через opts.rng)
   Вертикальный шутер: строй пришельцев с «дыханием», пике-атаки по дуге,
   5 волн с ростом сложности, 3 жизни, «Медуза» лучом захватывает корабль —
   если сбить её в полёте, корабль возвращается и становится вторым корпусом.
   Рендер — js/classic.js (8-бит) и js/modern.js. Интерфейс — CONTRACT.md.
   ========================================================================== */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};

  var W = 480, H = 640;
  var PLAYER_Y = 592;            // линия корабля игрока
  var WAVES = 5;                 // после 5-й волны — победа
  var COLS = 8, ROWS = 5, SPX = 44, SPY = 38, TOPY = 100;
  var HULL_GAP = 36;             // смещение второго корпуса (двойной корабль)
  var P_SPEED = 250, P_BULLET_V = 580, FIRE_CD = 0.2;
  var HULL_HX = 13, HULL_HY = 12; // полуразмеры хитбокса корпуса
  var BEAM_Y = PLAYER_Y - 205;   // высота, на которой Медуза зависает и включает луч
  var BEAM_TIME = 3.2, BEAM_HALF = 34;
  var ENTER_TIME = 1.7, ARC_TIME = 0.75, ARC_R = 34;

  // Виды пришельцев (названия и вид — оригинальные).
  var KINDS = {
    spore:  { hp: 1, pts: 50,  divePts: 100, r: 13 },  // «Спора»
    wedge:  { hp: 1, pts: 80,  divePts: 160, r: 13 },  // «Клин»
    medusa: { hp: 2, pts: 150, divePts: 400, r: 15 }   // «Медуза» — ловец с лучом
  };
  var ROW_KIND = ['medusa', 'wedge', 'wedge', 'spore', 'spore'];
  // Раскладка волн: по каждому ряду [от, до] колонок (включительно) или null.
  var LAYOUTS = [
    [[3, 4], [1, 6], null,   [1, 6], [2, 5]],   // 18
    [[2, 5], [1, 6], [2, 5], [1, 6], [1, 6]],   // 26
    [[2, 5], [0, 7], [0, 7], [1, 6], [1, 6]],   // 32
    [[2, 5], [0, 7], [0, 7], [0, 7], [0, 7]],   // 36
    [[2, 5], [0, 7], [0, 7], [0, 7], [0, 7]]    // 36
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function bez(a, b, c, d, u) { var v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; }
  function countLayout(n) {
    var L = LAYOUTS[n - 1], k = 0;
    for (var r = 0; r < ROWS; r++) if (L[r]) k += L[r][1] - L[r][0] + 1;
    return k;
  }

  R.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var onEventFn = typeof opts.onEvent === 'function' ? opts.onEvent : null;

    var S = {
      W: W, H: H, PLAYER_Y: PLAYER_Y, HULL_GAP: HULL_GAP, BEAM_HALF: BEAM_HALF,
      t: 0, wave: 0, waves: WAVES, score: 0, lives: opts.lives || 3,
      phase: 'idle', phaseT: 0, banner: null, bannerT: 0,
      enemies: [], pb: [], eb: [], uid: 0,
      player: { x: W / 2, alive: true, dual: false, inv: 0, respawnT: 0, cd: 0, dir: 0, fire: false },
      captive: null,   // корабль, который тянет луч Медузы
      rescue: null,    // отбитый корабль летит к игроку
      diveT: 0, formFireT: 0, overT: 0,
      over: false, won: false, started: false
    };

    function emit(type, data) { if (onEventFn) onEventFn(type, data || {}); }

    // Сложность: по умолчанию та же формула, что g.difficulty (base + (волна-1)*step).
    var diff = opts.diff || function (base, step, max) {
      var v = base + (S.wave - 1) * step;
      return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max));
    };
    function params() {
      return {
        diveEvery: diff(2.6, -0.35, 1.1),        // пауза между пике
        maxDivers: Math.round(diff(2, 1, 5)),    // одновременно в пике
        diveSpeed: diff(165, 22, 260),           // скорость пике, px/с
        shotChance: diff(0.35, 0.15, 0.95),      // шанс, что пикирующий стреляет
        eBulletV: diff(220, 22, 320),            // скорость вражеских пуль
        wobble: diff(70, 8, 110),                // размах «виляния» в пике, px: 70,78,86,94,102 (баланс — README)
        formFireEvery: S.wave >= 2 ? diff(7.2, -1.2, 2.6) : 0 // стрельба из строя (с 2-й волны)
      };
    }

    // Позиция ячейки строя с «дыханием» (строй расширяется/сжимается) и покачиванием.
    function slot(row, col) {
      var b = 1 + 0.07 * Math.sin(S.t * 1.7), sway = Math.sin(S.t * 0.45) * 24;
      return { x: W / 2 + sway + (col - 3.5) * SPX * b, y: TOPY + row * SPY * (1 + 0.04 * Math.sin(S.t * 1.7)) };
    }

    function startWave(n) {
      S.wave = n; S.enemies = []; S.pb = []; S.eb = [];
      S.phase = 'intro'; S.phaseT = 0; S.diveT = 1.6; S.formFireT = 4;
      S.captive = null; S.rescue = null;
      emit('wave', { wave: n });
      setBanner('wave', 2.2);
      var L = LAYOUTS[Math.min(n, LAYOUTS.length) - 1];
      for (var r = 0; r < ROWS; r++) {
        var rg = L[r]; if (!rg) continue;
        for (var c = rg[0]; c <= rg[1]; c++) {
          var kind = ROW_KIND[r], K = KINDS[kind];
          S.enemies.push({
            id: ++S.uid, kind: kind, row: r, col: c, hp: K.hp, r: K.r, hurt: false,
            x: -100, y: -100, ang: 0, state: 'wait', delay: 0.5 + r * 0.75 + (c - rg[0]) * 0.1,
            t: 0, side: (r % 2 ? 1 : -1), carry: false, mode: null, sub: null,
            vx: 0, tx: W / 2, shotYs: [], beamT: 0
          });
        }
      }
    }
    function setBanner(key, time) { S.banner = key; S.bannerT = time; }

    function alive(e) { return e.state !== 'dead' && e.state !== 'wait'; }

    // ---------- Игрок ----------
    function hulls() {
      var p = S.player; if (!p.alive) return [];
      return p.dual ? [p.x, p.x + HULL_GAP] : [p.x];
    }
    function fire() {
      var p = S.player;
      if (!S.started || S.over || !p.alive || p.cd > 0) return false;
      if (S.phase === 'clear') return false;
      var hs = hulls(), lim = p.dual ? 4 : 2;
      if (S.pb.length + hs.length > lim) return false;
      for (var i = 0; i < hs.length; i++) S.pb.push({ x: hs[i], y: PLAYER_Y - 16, vy: -P_BULLET_V });
      p.cd = FIRE_CD; emit('shoot', {});
      return true;
    }
    function hitPlayer(hx) {
      var p = S.player;
      if (!p.alive || p.inv > 0) return;
      if (p.dual) { // теряем один корпус, жизнь цела
        if (hx === p.x) p.x += HULL_GAP;
        p.dual = false; p.inv = 0.6; emit('hull', { x: hx, y: PLAYER_Y });
        return;
      }
      p.alive = false; S.lives--; emit('die', { x: p.x, y: PLAYER_Y });
      if (S.lives <= 0) S.overT = 1.8; else p.respawnT = 2.2;
    }

    // ---------- Враги ----------
    function enemyShoot(e) {
      var p = S.player, v = params().eBulletV;
      var tx = p.alive ? p.x : W / 2, ty = Math.max(40, PLAYER_Y - e.y);
      var vx = clamp((tx - e.x) / (ty / v), -90, 90);
      S.eb.push({ x: e.x, y: e.y + 10, vx: vx, vy: v });
      emit('eshoot', {});
    }
    function startDive(e, capture) {
      var P = params();
      e.state = 'dive'; e.mode = capture ? 'capture' : 'attack'; e.sub = 'arc'; e.t = 0;
      e.dir = e.x < W / 2 ? -1 : 1; e.cx = e.x + e.dir * ARC_R; e.cy = e.y; e.a0 = e.dir < 0 ? 0 : Math.PI;
      e.vx = 0; e.tx = S.player.alive ? S.player.x : W / 2;
      e.shotYs = [];
      if (!capture && rng() < P.shotChance) {
        e.shotYs.push(230 + rng() * 60);
        if (S.wave >= 3 && rng() < 0.45) e.shotYs.push(340 + rng() * 40);
      }
      emit('dive', { kind: e.kind });
    }
    function canCapture() {
      var p = S.player;
      if (!p.alive || p.dual || p.inv > 0 || S.captive || S.rescue) return false;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (e.state === 'dead') continue;
        if (e.carry || e.mode === 'capture' && e.state === 'dive') return false;
      }
      return true;
    }
    function pickDiver() {
      var form = [], med = [];
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (e.state !== 'form') continue;
        form.push(e); if (e.kind === 'medusa') med.push(e);
      }
      if (!form.length) return;
      if (med.length && rng() < 0.3) {
        var m = med[(rng() * med.length) | 0];
        startDive(m, !m.carry && canCapture() && rng() < 0.6);
        return;
      }
      var e2 = form[(rng() * form.length) | 0];
      startDive(e2, false);
    }
    function divingCount() { var n = 0; for (var i = 0; i < S.enemies.length; i++) if (S.enemies[i].state === 'dive') n++; return n; }
    function liveCount() { var n = 0; for (var i = 0; i < S.enemies.length; i++) if (S.enemies[i].state !== 'dead') n++; return n; }

    function killEnemy(e) {
      var K = KINDS[e.kind];
      var inFlight = e.state === 'dive' || e.state === 'return';
      var pts = inFlight ? K.divePts : K.pts;
      S.score += pts;
      emit('kill', { x: e.x, y: e.y, kind: e.kind, pts: pts });
      if (e.carry) {
        if (inFlight) { S.rescue = { x: e.x, y: e.y - 24, t: 0 }; emit('release', { x: e.x, y: e.y }); }
        else emit('lost', { x: e.x, y: e.y });
        e.carry = false;
      }
      e.state = 'dead';
    }
    function damageEnemy(e) {
      e.hp--;
      if (e.hp > 0) { e.hurt = true; emit('hurt', { x: e.x, y: e.y }); return; }
      killEnemy(e);
    }

    function updEnemy(e, dt, P) {
      var ox = e.x, oy = e.y, s;
      e.t += dt;
      switch (e.state) {
        case 'wait':
          e.delay -= dt;
          if (e.delay <= 0) { e.state = 'enter'; e.t = 0; }
          return;
        case 'enter': {
          var u = clamp(e.t / ENTER_TIME, 0, 1);
          s = slot(e.row, e.col);
          var sd = e.side;
          var x0 = sd < 0 ? -30 : W + 30, y0 = 300 + e.row * 12;
          var x1 = sd < 0 ? W * 0.75 : W * 0.25, y1 = 440;
          var x2 = sd < 0 ? W * 0.18 : W * 0.82, y2 = -10;
          e.x = bez(x0, x1, x2, s.x, u); e.y = bez(y0, y1, y2, s.y, u);
          if (u >= 1) { e.state = 'form'; e.t = 0; }
          break;
        }
        case 'form':
          s = slot(e.row, e.col); e.x = s.x; e.y = s.y;
          break;
        case 'dive':
          if (e.sub === 'arc') {
            var k = clamp(e.t / ARC_TIME, 0, 1), th = e.a0 + e.dir * Math.PI * k;
            e.x = e.cx + ARC_R * Math.cos(th); e.y = e.cy + ARC_R * Math.sin(th);
            if (k >= 1) { e.sub = 'down'; e.t = 0; }
          } else if (e.sub === 'down') {
            var p = S.player;
            if (e.y < PLAYER_Y - 170 && p.alive) e.tx = p.x + (e.mode === 'capture' ? 0 : 0);
            var wob = e.mode === 'capture' ? 0 : Math.sin(e.t * 3.2 + e.id) * P.wobble;
            var want = clamp((e.tx - e.x) * 1.8 + wob, -170, 170);
            e.vx += (want - e.vx) * Math.min(1, dt * 3);
            var oldY = e.y;
            e.y += P.diveSpeed * dt; e.x = clamp(e.x + e.vx * dt, 16, W - 16);
            for (var i = 0; i < e.shotYs.length; i++) {
              if (oldY < e.shotYs[i] && e.y >= e.shotYs[i] && e.y < PLAYER_Y - 120) enemyShoot(e);
            }
            if (e.mode === 'capture' && e.y >= BEAM_Y) { e.y = BEAM_Y; e.sub = 'beam'; e.beamT = 0; emit('beam', { x: e.x }); }
            if (e.y > H + 30) { // ушёл вниз — возвращается сверху в строй
              s = slot(e.row, e.col); e.y = -30; e.x = s.x; e.state = 'return'; e.mode = null; e.t = 0;
            }
          } else if (e.sub === 'beam') {
            e.beamT += dt;
            var bp = S.player;
            // захват: луч полностью развернут, корабль в конусе
            if (!e.carry && !S.captive && e.beamT > 0.8 && e.beamT < BEAM_TIME - 0.5 &&
                bp.alive && !bp.dual && bp.inv <= 0 && Math.abs(bp.x - e.x) < BEAM_HALF - 4) {
              bp.alive = false; S.lives--;
              S.captive = { x: bp.x, y: PLAYER_Y, owner: e.id, t: 0, sx: bp.x };
              e.sub = 'hold'; setBanner('captured', 1.8); emit('captured', { x: bp.x });
            } else if (e.beamT >= BEAM_TIME) {
              e.sub = 'down'; e.mode = 'attack'; e.shotYs = []; e.t = 0;
            }
          } else if (e.sub === 'hold') {
            // ждём, пока луч дотянет корабль
            if (!S.captive) { e.state = 'return'; e.mode = null; e.t = 0; }
          }
          break;
        case 'return': {
          s = slot(e.row, e.col);
          var dx = s.x - e.x, dy = s.y - e.y, d = Math.sqrt(dx * dx + dy * dy), sp = 210 * dt;
          if (d <= sp + 1) { e.x = s.x; e.y = s.y; e.state = 'form'; e.t = 0; }
          else { e.x += dx / d * sp; e.y += dy / d * sp; }
          break;
        }
      }
      // угол «носа» по направлению движения (0 — смотрит вниз)
      var mx = e.x - ox, my = e.y - oy;
      if (e.state === 'form' || (e.state === 'dive' && (e.sub === 'beam' || e.sub === 'hold'))) e.ang *= Math.max(0, 1 - dt * 8);
      else if (mx * mx + my * my > 0.0004) e.ang = Math.atan2(my, mx) - Math.PI / 2;
    }

    // ---------- Шаг симуляции ----------
    function step(dt) {
      var p = S.player, P = params(), i, j, e;
      S.t += dt;
      if (S.bannerT > 0) { S.bannerT -= dt; if (S.bannerT <= 0) S.banner = null; }

      // игрок
      if (p.alive) {
        var maxX = W - 18 - (p.dual ? HULL_GAP : 0);
        p.x = clamp(p.x + p.dir * P_SPEED * dt, 18, maxX);
        if (p.inv > 0) p.inv -= dt;
      }
      if (p.cd > 0) p.cd -= dt;
      if (p.fire) fire();
      if (!p.alive && S.overT <= 0 && !S.captive && p.respawnT > 0) {
        p.respawnT -= dt;
        if (p.respawnT <= 0 && S.lives > 0) {
          p.alive = true; p.dual = false; p.x = W / 2; p.inv = 2.2; emit('respawn', {});
          setBanner('ready', 1.2);
        }
      }
      if (S.overT > 0 && !S.captive) {
        S.overT -= dt;
        if (S.overT <= 0) { S.over = true; emit('gameover', { score: S.score }); return; }
      }

      // фазы волны
      if (S.phase === 'intro') {
        var entering = false;
        for (i = 0; i < S.enemies.length; i++) if (S.enemies[i].state === 'wait' || S.enemies[i].state === 'enter') { entering = true; break; }
        if (!entering) S.phase = 'fight';
      } else if (S.phase === 'fight') {
        if (p.alive) {
          S.diveT -= dt;
          var few = liveCount() <= 4 ? 0.55 : 1;
          if (S.diveT <= 0) {
            if (divingCount() < P.maxDivers) pickDiver();
            S.diveT = P.diveEvery * few * (0.7 + rng() * 0.6);
          }
          if (P.formFireEvery > 0) {
            S.formFireT -= dt;
            if (S.formFireT <= 0) {
              S.formFireT = P.formFireEvery * (0.7 + rng() * 0.6);
              var cand = [];
              for (i = 0; i < S.enemies.length; i++) { e = S.enemies[i]; if (e.state === 'form' && Math.abs(e.x - p.x) < 140) cand.push(e); }
              if (cand.length) enemyShoot(cand[(rng() * cand.length) | 0]);
            }
          }
        }
      } else if (S.phase === 'clear') {
        S.phaseT -= dt;
        if (S.phaseT <= 0) {
          if (S.wave >= WAVES) { S.over = true; S.won = true; emit('win', { score: S.score }); return; }
          startWave(S.wave + 1);
        }
      }

      for (i = 0; i < S.enemies.length; i++) { e = S.enemies[i]; if (e.state !== 'dead') updEnemy(e, dt, P); }

      // захваченный корабль: луч тянет его к Медузе
      if (S.captive) {
        var c = S.captive, own = null;
        for (i = 0; i < S.enemies.length; i++) if (S.enemies[i].id === c.owner) own = S.enemies[i];
        c.t += dt;
        if (!own || own.state === 'dead') { S.captive = null; if (S.lives > 0) p.respawnT = Math.max(p.respawnT, 1.2); }
        else {
          var tY = own.y - 26, k = clamp(c.t / 1.3, 0, 1);
          c.x = c.sx + (own.x - c.sx) * k; c.y = PLAYER_Y + (tY - PLAYER_Y) * k;
          if (k >= 1) {
            own.carry = true; S.captive = null;
            if (S.lives > 0) p.respawnT = 1.6; else S.overT = Math.max(S.overT, 1.4);
          }
        }
      }
      // отбитый корабль: летит к игроку и пристыковывается вторым корпусом
      if (S.rescue) {
        var rs = S.rescue; rs.t += dt;
        var tx = p.alive ? Math.min(p.x + HULL_GAP, W - 18) : W / 2, ty = PLAYER_Y;
        var ddx = tx - rs.x, ddy = ty - rs.y, dd = Math.sqrt(ddx * ddx + ddy * ddy), spd = 260 * dt;
        if (dd <= spd + 1) {
          S.rescue = null;
          if (p.alive) {
            p.dual = true; if (p.x > W - 18 - HULL_GAP) p.x = W - 18 - HULL_GAP;
          } else S.lives++;
          emit('rescue', {}); setBanner('twin', 1.6);
        } else { rs.x += ddx / dd * spd; rs.y += ddy / dd * spd; }
      }

      // пули игрока
      for (i = S.pb.length - 1; i >= 0; i--) {
        var b = S.pb[i]; b.y += b.vy * dt;
        if (b.y < -20) { S.pb.splice(i, 1); continue; }
        for (j = 0; j < S.enemies.length; j++) {
          e = S.enemies[j]; if (!alive(e)) continue;
          var ex = b.x - e.x, ey = b.y - e.y, rr = e.r + 3;
          if (ex * ex + ey * ey < rr * rr) { damageEnemy(e); S.pb.splice(i, 1); break; }
        }
      }
      // пули врагов
      var hs = hulls();
      for (i = S.eb.length - 1; i >= 0; i--) {
        var q = S.eb[i]; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.y > H + 20 || q.x < -20 || q.x > W + 20) { S.eb.splice(i, 1); continue; }
        for (j = 0; j < hs.length; j++) {
          if (Math.abs(q.x - hs[j]) < HULL_HX - 2 && Math.abs(q.y - PLAYER_Y) < HULL_HY) { S.eb.splice(i, 1); hitPlayer(hs[j]); hs = hulls(); break; }
        }
      }
      // таран пикирующим врагом
      hs = hulls();
      for (i = 0; i < S.enemies.length && hs.length; i++) {
        e = S.enemies[i];
        if (e.state !== 'dive' && e.state !== 'return') continue;
        for (j = 0; j < hs.length; j++) {
          if (Math.abs(e.x - hs[j]) < e.r + HULL_HX - 4 && Math.abs(e.y - PLAYER_Y) < e.r + HULL_HY - 4) {
            if (S.player.inv > 0) break;
            killEnemy(e); hitPlayer(hs[j]); hs = hulls(); break;
          }
        }
      }

      // волна зачищена?
      if ((S.phase === 'fight' || S.phase === 'intro') && liveCount() === 0 && !S.captive && !S.rescue && S.overT <= 0) {
        S.phase = 'clear'; S.phaseT = 2.0; S.eb = [];
        setBanner(S.wave >= WAVES ? 'final' : 'cleared', 2.0);
        emit('clear', { wave: S.wave });
      }
    }

    function update(dt) {
      if (!S.started || S.over) return;
      // подшаги ≤ 1/120 с — пули не «проскакивают» сквозь врагов
      var n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
      for (var i = 0; i < n && !S.over; i++) step(h);
    }

    function start() {
      S.score = 0; S.lives = opts.lives || 3; S.over = false; S.won = false; S.started = true; S.t = 0; S.overT = 0;
      var p = S.player; p.x = W / 2; p.alive = true; p.dual = false; p.inv = 0; p.respawnT = 0; p.cd = 0;
      startWave(opts.startWave || 1);
      emit('start', {});
    }

    return {
      W: W, H: H,
      start: start, reset: start, update: update,
      setDir: function (d) { S.player.dir = d < 0 ? -1 : d > 0 ? 1 : 0; },
      setFire: function (v) { S.player.fire = !!v; },
      fire: fire,
      isOver: function () { return S.over; },
      state: function () { return S; },
      params: params,
      // для тестов:
      _S: S, _slot: slot, _step: step, _startWave: startWave, _startDive: startDive,
      _damage: damageEnemy, _hitPlayer: hitPlayer
    };
  };

  R.consts = { W: W, H: H, PLAYER_Y: PLAYER_Y, WAVES: WAVES, KINDS: KINDS, LAYOUTS: LAYOUTS, HULL_GAP: HULL_GAP, countLayout: countLayout, BEAM_Y: BEAM_Y };
  R.W = W; R.H = H;
})(typeof window !== 'undefined' ? window : globalThis);
