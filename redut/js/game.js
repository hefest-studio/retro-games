/* ============================================================================
   РЕДУТ · движок (DOM-free, детерминированный по вводу)
   Танковый бой сверху: оборона базы-редута от волн вражеских танков.
   Разрушаемый кирпич (по четвертям), сталь, вода, лес, усилители, кооп 1–2.
   Рендереры (classic/modern) и main.js только читают R.Game.state().
   Вдохновлено только свободной механикой «танчиков» — без чужих имён и арта.
   ========================================================================== */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};

  // --- геометрия поля ---
  var COLS = 15, ROWS = 15, CELL = 40;        // 15*40 = 600 px поле
  var FIELD = COLS * CELL;                     // 600
  var SIZE = 36, OFF = (CELL - SIZE) / 2;      // танк 36, поля клетки 40 (отступ 2)

  // --- скорости / тайминги ---
  var P_SPD = 104, E_SPD = 66, E_FAST = 108, BULLET = 320;
  var P_CD = 0.36, SPAWN_EVERY = 1.8, MAX_ACTIVE = 4, RESPAWN_SHIELD = 2.4;

  // --- стадии (внешние преграды; базу и спауны ставит код) ---
  // Легенда: . пусто  B кирпич  S сталь  W вода  F лес
  var LEVELS = [
    [
      '...............',
      '.BB.S.....S.BB.',
      '.BB.........BB.',
      '....BB...BB....',
      '..W..B...B..W..',
      '.S....BBB....S.',
      '...F.......F...',
      '..BB..SSS..BB..',
      '...F.......F...',
      '.S...........S.',
      '....B.....B....',
      '..W.BB...BB.W..',
      '....B.....B....',
      '...............',
      '...............'
    ],
    [
      'S.....S.S.....S',
      '.BBB.......BBB.',
      '.B.F.SS.SS.F.B.',
      '.B...........B.',
      '...WW.....WW...',
      '.FF..BB.BB..FF.',
      '....B.....B....',
      'SS..B..A..B..SS',
      '....B.....B....',
      '.FF..BB.BB..FF.',
      '...WW.....WW...',
      '.B...........B.',
      '.B.F.SS.SS.F.B.',
      '.BBB.......BBB.',
      '...............'
    ],
    [
      '..S.......S....',
      '.BBB.BBB.BBB.B.',
      '.B.....F.....B.',
      '.B.WW.....WW.B.',
      '...B.SSSSS.B...',
      '.F.B.......B.F.',
      '.S.B.BB.BB.B.S.',
      '...B.......B...',
      '.SBB..WWW..BBS.',
      '.F...B...B...F.',
      '..SSB.....BSS..',
      '.B...F...F...B.',
      '.BB.BB...BB.BB.',
      '...............',
      '...............'
    ]
  ];
  // Боевой состав стадий: число врагов и доля «бонусных» (роняют усилитель).
  var STAGE_TOTAL = [12, 16, 20];

  function solidTile(ch) { return ch === 'S' || ch === 'W' || ch === 'A'; } // + кирпич по маске

  R.Game = function (opts) {
    opts = opts || {};
    var emit = opts.onEvent || function () {};
    var numPlayers = opts.players === 2 ? 2 : 1;

    var S = {
      phase: 'title',            // title | play | levelclear | gameover | win
      paused: false,
      stage: 0,
      score: 0,
      hi: opts.hi || 0,
      cols: COLS, rows: ROWS, cell: CELL, fieldPx: FIELD, size: SIZE,
      grid: [], brickMask: {},
      players: [],
      enemies: [],
      bullets: [],
      powerups: [],
      particles: [],
      base: { col: 7, row: 14, alive: true },
      spawnPoints: [{ col: 0, row: 0 }, { col: 7, row: 0 }, { col: 14, row: 0 }],
      numPlayers: numPlayers,
      total: 0, spawned: 0, killed: 0,
      spawnCd: 0, spawnIdx: 0,
      freeze: 0,
      intro: 0, banner: 0,
      bonusFlash: 0
    };

    // ---------- карта ----------
    function key(c, r) { return c + ',' + r; }

    function normalize(rows) {
      var out = [];
      for (var r = 0; r < ROWS; r++) {
        var s = rows[r] || '';
        if (s.length > COLS) s = s.slice(0, COLS);
        while (s.length < COLS) s += '.';
        out.push(s.split(''));
      }
      return out;
    }

    function loadStage(idx) {
      var g = normalize(LEVELS[idx]);
      // база-редут снизу по центру + кирпичная подкова
      var bc = S.base.col, br = S.base.row;
      g[br][bc] = 'A';
      [[bc - 1, br], [bc + 1, br], [bc - 1, br - 1], [bc, br - 1], [bc + 1, br - 1]].forEach(function (p) {
        if (p[1] >= 0 && p[1] < ROWS && p[0] >= 0 && p[0] < COLS) g[p[1]][p[0]] = 'B';
      });
      // спауны врагов и игроков — чистые клетки
      S.spawnPoints.forEach(function (sp) { g[sp.row][sp.col] = '.'; if (g[sp.row + 1]) g[sp.row + 1][sp.col] = '.'; });
      var pStarts = [{ col: 5, row: 14 }, { col: 9, row: 14 }];
      pStarts.forEach(function (p) { g[p.row][p.col] = '.'; if (g[p.row - 1]) g[p.row - 1][p.col] = '.'; });

      S.grid = g;
      S.brickMask = {};
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (g[r][c] === 'B') S.brickMask[key(c, r)] = 15;

      S.base.alive = true;
      S.enemies = []; S.bullets = []; S.powerups = []; S.particles = [];
      S.total = STAGE_TOTAL[idx]; S.spawned = 0; S.killed = 0;
      S.spawnCd = 0.6; S.spawnIdx = 0; S.freeze = 0;

      // игроки
      S.players = [];
      for (var i = 0; i < S.numPlayers; i++) {
        var ps = pStarts[i];
        S.players.push(makePlayer(i, ps.col, ps.row));
      }
    }

    function makePlayer(idx, col, row) {
      return {
        idx: idx, x: col * CELL + OFF, y: row * CELL + OFF, dir: 'up',
        alive: true, lives: 3, power: 0, shield: RESPAWN_SHIELD, cd: 0,
        held: { up: false, down: false, left: false, right: false }, lastDir: 'up',
        spawnX: col * CELL + OFF, spawnY: row * CELL + OFF, score: 0
      };
    }

    // ---------- тайлы ----------
    function tileAt(c, r) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return '#'; // граница
      return S.grid[r][c];
    }
    function brickSolid(c, r) { return tileAt(c, r) === 'B' && S.brickMask[key(c, r)]; }
    function cellBlocksTank(c, r) {
      var ch = tileAt(c, r);
      if (ch === '#') return true;
      if (solidTile(ch)) return true;
      if (ch === 'B' && S.brickMask[key(c, r)]) return true;
      return false;
    }
    // AABB прямоугольника с танко-твёрдыми клетками
    function rectBlocked(x, y, w, h) {
      if (x < 0 || y < 0 || x + w > FIELD || y + h > FIELD) return true;
      var c0 = Math.floor(x / CELL), c1 = Math.floor((x + w - 1) / CELL);
      var r0 = Math.floor(y / CELL), r1 = Math.floor((y + h - 1) / CELL);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (cellBlocksTank(c, r)) return true;
      return false;
    }

    function align(v) { return Math.round((v - OFF) / CELL) * CELL + OFF; }

    // ---------- движение танка ----------
    function dvec(dir) {
      return dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : dir === 'up' ? [0, -1] : [0, 1];
    }
    function moveTank(a, dir, dist) {
      var v = dvec(dir), ox = a.x, oy = a.y;
      // авто-центровка по перпендикулярной оси (вкатывание в коридор)
      if (v[0] !== 0) { var ty = align(a.y); a.y += Math.max(-dist, Math.min(dist, ty - a.y)); }
      else { var tx = align(a.x); a.x += Math.max(-dist, Math.min(dist, tx - a.x)); }
      a.x += v[0] * dist; a.y += v[1] * dist;
      if (rectBlocked(a.x, a.y, SIZE, SIZE)) { a.x = ox; a.y = oy; return false; }
      return true;
    }

    // ---------- стрельба ----------
    function barrel(a) {
      var v = dvec(a.dir), cx = a.x + SIZE / 2, cy = a.y + SIZE / 2;
      return { x: cx + v[0] * (SIZE / 2 + 2), y: cy + v[1] * (SIZE / 2 + 2), v: v };
    }
    function playerFire(idx) {
      var p = S.players[idx];
      if (!p || !p.alive || p.cd > 0 || S.phase !== 'play' || S.paused || S.intro > 0) return;
      var mine = 0, i;
      for (i = 0; i < S.bullets.length; i++) if (S.bullets[i].owner === 'p' && S.bullets[i].pIdx === idx) mine++;
      var maxB = p.power >= 2 ? 2 : 1;
      if (mine >= maxB) return;
      var b = barrel(p), spd = BULLET + (p.power >= 1 ? 90 : 0);
      S.bullets.push({ owner: 'p', pIdx: idx, x: b.x, y: b.y, dir: p.dir, vx: b.v[0] * spd, vy: b.v[1] * spd, power: p.power, life: 2.2, r: 4 });
      p.cd = P_CD; emit('shoot');
    }
    function enemyFire(e) {
      var b = barrel(e), v = dvec(e.dir);
      S.bullets.push({ owner: 'e', x: b.x, y: b.y, dir: e.dir, vx: v[0] * (BULLET - 40), vy: v[1] * (BULLET - 40), power: 0, life: 2.4, r: 4 });
    }

    // ---------- враги ----------
    function makeEnemy(sp, kind, bonus) {
      var hp = kind === 'armor' ? 2 : 1;
      var spd = kind === 'fast' ? E_FAST : E_SPD;
      return {
        kind: kind, x: sp.col * CELL + OFF, y: sp.row * CELL + OFF, dir: 'down',
        hp: hp, spd: spd, bonus: !!bonus, spawn: 0.9, reDir: 0.3, fireCd: 1 + Math.random(), t: Math.random() * 6
      };
    }
    function spawnEnemy() {
      if (S.spawned >= S.total) return;
      var sp = S.spawnPoints[S.spawnIdx % S.spawnPoints.length]; S.spawnIdx++;
      // не спаунить поверх танка
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (Math.abs(e.x - (sp.col * CELL + OFF)) < CELL && Math.abs(e.y - (sp.row * CELL + OFF)) < CELL) return;
      }
      var n = S.spawned;
      var kind = (n % 5 === 4) ? 'armor' : (n % 3 === 1 ? 'fast' : 'basic');
      var bonus = (n % 4 === 3);
      S.enemies.push(makeEnemy(sp, kind, bonus));
      S.spawned++; emit('spawn');
    }

    function chooseDir(e) {
      // цель — база; иногда ближайший игрок
      var tx = S.base.col * CELL, ty = S.base.row * CELL, p = nearestPlayer(e);
      if (p && Math.random() < 0.35) { tx = p.x; ty = p.y; }
      var dirs = [];
      if (Math.random() < 0.7) {
        if (Math.abs(tx - e.x) > Math.abs(ty - e.y)) dirs = [tx < e.x ? 'left' : 'right', ty < e.y ? 'up' : 'down'];
        else dirs = [ty < e.y ? 'up' : 'down', tx < e.x ? 'left' : 'right'];
      }
      var all = ['up', 'down', 'left', 'right'];
      for (var i = all.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = all[i]; all[i] = all[j]; all[j] = t; }
      dirs = dirs.concat(all);
      for (var k = 0; k < dirs.length; k++) {
        var v = dvec(dirs[k]);
        if (!rectBlocked(e.x + v[0] * 2, e.y + v[1] * 2, SIZE, SIZE)) return dirs[k];
      }
      return e.dir;
    }
    function nearestPlayer(e) {
      var best = null, bd = 1e9;
      for (var i = 0; i < S.players.length; i++) {
        var p = S.players[i]; if (!p.alive) continue;
        var d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }

    function stepEnemies(dt) {
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; e.t += dt;
        if (e.spawn > 0) { e.spawn -= dt; continue; }
        if (S.freeze > 0) continue;
        e.reDir -= dt; e.fireCd -= dt;
        if (e.reDir <= 0) { e.dir = chooseDir(e); e.reDir = 0.4 + Math.random() * 1.0; }
        if (!moveTank(e, e.dir, e.spd * dt)) { e.dir = chooseDir(e); e.reDir = 0.3 + Math.random() * 0.6; }
        if (e.fireCd <= 0) { enemyFire(e); e.fireCd = 0.9 + Math.random() * 1.4; }
      }
    }

    // ---------- пули ----------
    function cellOf(x, y) { return [Math.floor(x / CELL), Math.floor(y / CELL)]; }

    function hitBrick(c, r, bx, by, power) {
      var kk = key(c, r), m = S.brickMask[kk]; if (!m) return false;
      // четверть по положению пули внутри клетки
      var lx = bx - c * CELL, ly = by - r * CELL;
      var sc = lx < CELL / 2 ? 0 : 1, sr = ly < CELL / 2 ? 0 : 1;
      var bit = 1 << (sr * 2 + sc);
      if (power >= 2) m = 0; else { m &= ~bit; // снести и соседнюю по ходу для заметной бреши
        if (lx > CELL / 2 - 6 && lx < CELL / 2 + 6) m &= ~(1 << (sr * 2 + (1 - sc)));
        if (ly > CELL / 2 - 6 && ly < CELL / 2 + 6) m &= ~(1 << ((1 - sr) * 2 + sc));
      }
      if (m) S.brickMask[kk] = m; else { delete S.brickMask[kk]; S.grid[r][c] = '.'; }
      emit('brick'); return true;
    }

    function killEnemy(idx) {
      var e = S.enemies[idx];
      var pts = e.kind === 'armor' ? 300 : e.kind === 'fast' ? 200 : 100;
      S.score += pts; S.killed++;
      burst(e.x + SIZE / 2, e.y + SIZE / 2, 14);
      if (e.bonus) dropPowerup();
      S.enemies.splice(idx, 1); emit('explode');
    }

    function hurtPlayer(p) {
      if (!p.alive || p.shield > 0) return;
      p.lives--; burst(p.x + SIZE / 2, p.y + SIZE / 2, 16); emit('hit');
      p.power = 0;
      if (p.lives <= 0) { p.alive = false; checkDefeat(); }
      else { p.x = p.spawnX; p.y = p.spawnY; p.dir = 'up'; p.lastDir = 'up'; p.shield = RESPAWN_SHIELD; }
    }

    function destroyBase() {
      if (!S.base.alive) return;
      S.base.alive = false; burst(S.base.col * CELL + CELL / 2, S.base.row * CELL + CELL / 2, 28);
      S.grid[S.base.row][S.base.col] = '.';
      S.phase = 'gameover'; S.banner = 0; emit('gameover', { score: S.score });
    }

    function stepBullets(dt) {
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i], steps = 3, sx = (b.vx * dt) / steps, sy = (b.vy * dt) / steps, dead = false;
        for (var s = 0; s < steps && !dead; s++) {
          b.x += sx; b.y += sy; b.life -= dt / steps;
          if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > FIELD || b.y > FIELD) { dead = true; break; }
          var cr = cellOf(b.x, b.y), c = cr[0], r = cr[1], ch = tileAt(c, r);
          if (ch === 'A') { destroyBase(); dead = true; break; }
          if (ch === 'S') { if (b.power >= 2) { S.grid[r][c] = '.'; emit('steel'); } else emit('steel'); dead = true; break; }
          if (ch === 'B' && S.brickMask[key(c, r)]) { hitBrick(c, r, b.x, b.y, b.power); dead = true; break; }
          // по танкам
          if (b.owner === 'p') {
            for (var e = 0; e < S.enemies.length; e++) {
              var en = S.enemies[e];
              if (en.spawn > 0) continue;
              if (b.x > en.x && b.x < en.x + SIZE && b.y > en.y && b.y < en.y + SIZE) {
                en.hp--; if (en.hp <= 0) { if (S.players[b.pIdx]) S.players[b.pIdx].score += 0; killEnemy(e); } else { emit('hit'); burst(b.x, b.y, 5); }
                dead = true; break;
              }
            }
          } else {
            for (var pi = 0; pi < S.players.length; pi++) {
              var pl = S.players[pi];
              if (!pl.alive) continue;
              if (b.x > pl.x && b.x < pl.x + SIZE && b.y > pl.y && b.y < pl.y + SIZE) { hurtPlayer(pl); dead = true; break; }
            }
          }
        }
        if (!dead) {
          // пуля-пуля: гасим встречные игрок/враг
          for (var j = i - 1; j >= 0; j--) {
            var o = S.bullets[j];
            if (o.owner !== b.owner && Math.abs(o.x - b.x) < 8 && Math.abs(o.y - b.y) < 8) { dead = true; S.bullets.splice(j, 1); i--; break; }
          }
        }
        if (dead) S.bullets.splice(i, 1);
      }
    }

    // ---------- усилители ----------
    var PU_KINDS = ['shield', 'freeze', 'life', 'upgrade'];
    function dropPowerup() {
      var tries = 20;
      while (tries-- > 0) {
        var c = 1 + ((Math.random() * (COLS - 2)) | 0), r = 1 + ((Math.random() * (ROWS - 4)) | 0);
        if (!cellBlocksTank(c, r) && tileAt(c, r) !== 'A') {
          S.powerups.push({ kind: PU_KINDS[(Math.random() * PU_KINDS.length) | 0], x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, t: 0, life: 14 });
          return;
        }
      }
    }
    function applyPowerup(pu, p) {
      switch (pu.kind) {
        case 'shield': p.shield = Math.max(p.shield, 7); emit('pickup'); break;
        case 'freeze': S.freeze = 6; emit('freeze'); break;
        case 'life': p.lives++; emit('life'); break;
        case 'upgrade': p.power = Math.min(3, p.power + 1); emit('pickup'); break;
      }
      S.score += 200;
    }
    function stepPowerups(dt) {
      for (var i = S.powerups.length - 1; i >= 0; i--) {
        var pu = S.powerups[i]; pu.t += dt; pu.life -= dt;
        if (pu.life <= 0) { S.powerups.splice(i, 1); continue; }
        for (var pi = 0; pi < S.players.length; pi++) {
          var p = S.players[pi]; if (!p.alive) continue;
          if (p.x < pu.x + 14 && p.x + SIZE > pu.x - 14 && p.y < pu.y + 14 && p.y + SIZE > pu.y - 14) { applyPowerup(pu, p); S.powerups.splice(i, 1); break; }
        }
      }
    }

    // ---------- частицы ----------
    function burst(x, y, n) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 170;
        S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.35, c: i % 3 });
      }
    }
    function stepParticles(dt) {
      for (var i = S.particles.length - 1; i >= 0; i--) {
        var p = S.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
        if (p.life <= 0) S.particles.splice(i, 1);
      }
    }

    // ---------- игроки ----------
    function stepPlayers(dt) {
      for (var i = 0; i < S.players.length; i++) {
        var p = S.players[i]; if (!p.alive) continue;
        if (p.cd > 0) p.cd -= dt; if (p.shield > 0) p.shield -= dt;
        var dir = null;
        if (p.held[p.lastDir]) dir = p.lastDir;
        else { ['up', 'down', 'left', 'right'].forEach(function (d) { if (dir === null && p.held[d]) dir = d; }); }
        if (dir) { p.dir = dir; moveTank(p, dir, P_SPD * dt); }
        // контакт с врагом = урон
        for (var e = 0; e < S.enemies.length; e++) {
          var en = S.enemies[e]; if (en.spawn > 0) continue;
          if (p.x < en.x + SIZE && p.x + SIZE > en.x && p.y < en.y + SIZE && p.y + SIZE > en.y) hurtPlayer(p);
        }
      }
    }

    function anyPlayerAlive() {
      for (var i = 0; i < S.players.length; i++) if (S.players[i].alive || S.players[i].lives > 0) return true;
      return false;
    }
    function checkDefeat() {
      if (!anyPlayerAlive()) { S.phase = 'gameover'; S.banner = 0; emit('gameover', { score: S.score }); }
    }

    function stageCleared() { return S.killed >= S.total && S.enemies.length === 0; }
    function nextStage() {
      if (S.stage + 1 >= LEVELS.length) { S.phase = 'win'; emit('win', { score: S.score }); return; }
      S.stage++; loadStage(S.stage); S.phase = 'play'; S.intro = 1.3;
    }

    // ---------- главный шаг ----------
    function step(dt) {
      if (dt > 0.05) dt = 0.05;
      if (S.paused) return;
      S.bonusFlash += dt;
      if (S.phase === 'play') {
        if (S.intro > 0) { S.intro -= dt; return; }
        if (S.freeze > 0) S.freeze -= dt;
        // спаун врагов
        if (S.spawned < S.total && S.enemies.length < MAX_ACTIVE) {
          S.spawnCd -= dt; if (S.spawnCd <= 0) { spawnEnemy(); S.spawnCd = SPAWN_EVERY; }
        }
        stepPlayers(dt);
        if (S.phase !== 'play') return;
        stepEnemies(dt);
        stepBullets(dt);
        if (S.phase !== 'play') return;
        stepPowerups(dt);
        stepParticles(dt);
        if (stageCleared()) { S.phase = 'levelclear'; S.banner = 1.4; }
      } else if (S.phase === 'levelclear') {
        stepParticles(dt);
        S.banner -= dt; if (S.banner <= 0) nextStage();
      } else {
        stepParticles(dt);
      }
    }

    // ---------- публичный API ----------
    var api = {
      start: function () {
        S.phase = 'play'; S.paused = false; S.stage = 0; S.score = 0;
        loadStage(0); S.intro = 1.3; S.banner = 0;
      },
      update: step,
      step: step,
      state: function () { return S; },
      setPlayers: function (n) { S.numPlayers = (n === 2) ? 2 : 1; },
      setHeld: function (idx, dir, down) {
        var p = S.players[idx]; if (!p) return;
        if (dir !== 'up' && dir !== 'down' && dir !== 'left' && dir !== 'right') return;
        p.held[dir] = !!down; if (down) p.lastDir = dir;
      },
      fire: function (idx) { playerFire(idx); },
      pause: function () { if (S.phase === 'play' || S.phase === 'levelclear') S.paused = !S.paused; },
      isPaused: function () { return S.paused; },
      phase: function () { return S.phase; },
      setHi: function (v) { S.hi = v; }
    };
    return api;
  };

  // Константы и раскладка поля для рендереров.
  R.consts = { COLS: COLS, ROWS: ROWS, CELL: CELL, FIELD: FIELD, SIZE: SIZE, OFF: OFF,
    VIEW_W: 960, VIEW_H: 600, FIELD_X: 14, FIELD_Y: 0, PANEL_X: 628 };
})(typeof window !== 'undefined' ? window : globalThis);
