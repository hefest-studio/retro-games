/* ============================================================================
   КРОТ · движок (DOM-free, детерминированный)
   Механика жанра подземных раскопок:
   копание, алмазы, мешки золота, ползуны/грызуны, вишня и бонус-режим.
   Владелец: Lead. Интерфейс — CONTRACT.md §3-§4.
   ========================================================================== */
(function (global) {
  'use strict';
  var DG = global.DG = global.DG || {};

  /* Миграция localStorage: ключи прежнего рабочего имени → ключи КРОТа.
     Старый → новый (если нового ещё нет) → удалить старый. Вызывают main.js (legacy.html)
     и index.html до первого чтения настроек/рекорда. ls — объект Storage (для тестов — подделка). */
  DG.STORE_KEYS = { settings: 'krot.settings.v1', hi: 'krot.hi.v1' };
  var LEGACY_STORE_KEYS = [['digger.settings.v1', 'krot.settings.v1'], ['digger.hi.v1', 'krot.hi.v1']];
  DG.migrateStorage = function (ls) {
    try {
      if (!ls) return;
      LEGACY_STORE_KEYS.forEach(function (pair) {
        var v = ls.getItem(pair[0]);
        if (v == null) return;
        if (ls.getItem(pair[1]) == null) ls.setItem(pair[1], v);
        ls.removeItem(pair[0]);
      });
    } catch (e) { /* file:// / приватный режим */ }
  };

  var COLS = 15, ROWS = 10;
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
  var MOVE_TIME = 0.105;                       // сек. на клетку у игрока
  var MOVE_SPEED = 1 / MOVE_TIME;
  var BULLET_SPEED = 16;                       // клеток в секунду
  var FALL_SPEED = 8;
  var WOBBLE_TIME = 0.8;
  var SPEED_CRAWLER = 0.30;                     // сек. на клетку (растёт на ранних уровнях)
  var SPEED_GNAWER = 0.42;
  var SPEED_SCARED = 0.22;
  var SPAWN_INTERVAL = 2.0;
  var READY_TIME = 1.8;
  var DEATH_TIME = 1.6;
  var CLEAR_TIME = 2.0;
  var EXTRA_LIFE = 20000;
  var MAX_PARTICLES = 260;
  var MAX_POPUPS = 40;

  var GEM_SHAPES = [
    [[0, 0]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, -1], [0, 0], [0, 1], [-1, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0]]
  ];

  DG.G = { COLS: COLS, ROWS: ROWS, DIRS: DIRS, W: 960, H: 600, MOVE_TIME: MOVE_TIME };

  /* Детерминированный PRNG (mulberry32). */
  DG.rng = function (seed) {
    var a = (seed >>> 0);
    if (a === 0) a = 0x9E3779B9;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function inBounds(cx, cy) { return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function makePlayer(cx, cy) {
    return {
      cx: cx, cy: cy, x: cx + 0.5, y: cy + 0.5,
      tx: cx + 0.5, ty: cy + 0.5,
      dir: 0, inputDir: -1, moving: false, alive: true,
      invuln: 2.0, shootCd: 0, shootMax: 1.2, shootAnim: 0, walkPhase: 0
    };
  }

  /* ------------------------------------------------------------------------- */
  DG.Game = function (opts) {
    opts = opts || {};
    var onEventFn = typeof opts.onEvent === 'function' ? opts.onEvent : null;
    var seed = (opts.seed == null ? 1337 : opts.seed) >>> 0;
    var vrng = DG.rng((seed ^ 0x5F356495) >>> 0); // только для визуальных эффектов
    var levelRng = DG.rng(seed);

    var S = {
      seed: seed, level: 1, score: 0, hi: opts.hiscore || 0, hiAtStart: opts.hiscore || 0,
      lives: 3, nextLife: EXTRA_LIFE,
      mode: 'title', paused: false,
      time: 0, anim: 0,
      gemsLeft: 0, gemsTotal: 0, gemsCollected: 0, gemChain: 0,
      bonus: false, bonusT: 0, bonusDur: 0, eatChain: 0,
      spawnLeft: 0, spawnTimer: 0, monstersMax: 0, gnawerChance: 0,
      cherrySpawned: false, kills: 0,
      shake: 0, readyT: 0, deadT: 0, clearT: 0,
      grid: new Uint8Array(COLS * ROWS),
      items: [], player: makePlayer(0, 0), monsters: [],
      bullets: [], particles: [], popups: [],
      stats: { dug: 0, bagKills: 0, shots: 0, gems: 0, levels: 0 }
    };

    /* ------------------------------ события -------------------------------- */
    function emit(type, data) {
      if (!onEventFn) return;
      try { onEventFn(type, data || {}); } catch (e) {
        if (global.console && console.error) console.error('DG event error:', e);
      }
    }

    /* ------------------------------ утилиты -------------------------------- */
    function isTunnel(cx, cy) { return inBounds(cx, cy) && S.grid[cy * COLS + cx] === 1; }
    function digCell(cx, cy) { if (inBounds(cx, cy)) S.grid[cy * COLS + cx] = 1; }
    function isPlaying() { return S.mode === 'play' || S.mode === 'bonus'; }

    function itemAtCell(cx, cy) {
      for (var i = 0; i < S.items.length; i++) {
        var it = S.items[i];
        if (it.cx === cx && it.cy === cy) return it;
      }
      return null;
    }
    function removeItem(it) {
      var i = S.items.indexOf(it);
      if (i >= 0) S.items.splice(i, 1);
    }
    function monsterAtCell(cx, cy) {
      for (var i = 0; i < S.monsters.length; i++) {
        var m = S.monsters[i];
        if (m.dying <= 0 && m.cx === cx && m.cy === cy) return m;
      }
      return null;
    }
    function aliveMonsters() {
      var out = [];
      for (var i = 0; i < S.monsters.length; i++) if (S.monsters[i].dying <= 0) out.push(S.monsters[i]);
      return out;
    }
    function addItem(type, cx, cy) {
      var it = { type: type, cx: cx, cy: cy, x: cx + 0.5, y: cy + 0.5 };
      if (type === 'bag') {
        it.falling = false; it.wobble = -1; it.vy = 0; it.fallFrom = cy;
      }
      S.items.push(it);
      return it;
    }
    function freeDirt(cx, cy) {
      return inBounds(cx, cy) && S.grid[cy * COLS + cx] === 0 && !itemAtCell(cx, cy);
    }
    function bagSupported(bag) {
      // низ поля считается опорой: мешок не улетает за экран
      return !inBounds(bag.cx, bag.cy + 1) || !isTunnel(bag.cx, bag.cy + 1);
    }

    /* ------------------------------ эффекты -------------------------------- */
    var PARTICLE_COLORS = {
      dirt: ['#a05a2c', '#c0763b', '#7a4220'],
      gem: ['#3ef08a', '#9dffc4', '#eafff2'],
      gold: ['#ffd166', '#ffe9a8', '#e0a52a'],
      spark: ['#ffffff', '#9ad9ff'],
      monster: ['#ff5d8f', '#ffa7c4'],
      eat: ['#ffd166', '#ff5d8f'],
      death: ['#ff5d5d', '#ffb3b3', '#ffd166']
    };
    function spawnBurst(x, y, kind, count) {
      var colors = PARTICLE_COLORS[kind] || PARTICLE_COLORS.dirt;
      for (var i = 0; i < count; i++) {
        if (S.particles.length >= MAX_PARTICLES) S.particles.shift();
        var life = 0.35 + vrng() * 0.5;
        S.particles.push({
          x: x, y: y,
          vx: (vrng() - 0.5) * 3.4,
          vy: (vrng() - 0.5) * 3.4 - 0.7,
          life: life, maxLife: life,
          size: 0.07 + vrng() * 0.12,
          color: colors[(vrng() * colors.length) | 0],
          kind: kind
        });
      }
    }
    function addPopup(text, x, y, kind) {
      if (S.popups.length >= MAX_POPUPS) S.popups.shift();
      S.popups.push({ text: String(text), x: x, y: y, life: 0.9, maxLife: 0.9, kind: kind || 'score' });
    }
    function updateParticles(dt) {
      for (var i = S.particles.length - 1; i >= 0; i--) {
        var p = S.particles[i];
        p.life -= dt;
        if (p.life <= 0) { S.particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 5 * dt;
        p.vx *= (1 - 1.4 * dt);
      }
    }
    function updatePopups(dt) {
      for (var i = S.popups.length - 1; i >= 0; i--) {
        var p = S.popups[i];
        p.life -= dt;
        if (p.life <= 0) { S.popups.splice(i, 1); continue; }
        p.y -= 0.55 * dt;
      }
    }

    /* --------------------------- генерация уровня -------------------------- */
    function carveMain(R, px, py) {
      var cx = COLS - 1, cy = 0, guard = 0;
      digCell(cx, cy);
      while (guard++ < 500) {
        if (cy >= ROWS - 1) {
          if (cx === px) break;
          cx += cx < px ? 1 : -1;
        } else {
          var r = R();
          if (r < 0.52) cy++;
          else if (r < 0.82 && cx > 1) cx--;
          else if (r < 0.90 && cx < COLS - 1) cx++;
          else cy++;
        }
        digCell(cx, cy);
      }
      digCell(px, py);
      digCell(px, Math.max(0, py - 1));
    }

    function carveExtras(R, count) {
      for (var e = 0; e < count; e++) {
        var kind = R(), k;
        if (kind < 0.5) {
          var y = 1 + Math.floor(R() * (ROWS - 2));
          var len = 2 + Math.floor(R() * 5);
          var x0 = Math.floor(R() * (COLS - len + 1));
          for (k = 0; k < len; k++) digCell(x0 + k, y);
        } else if (kind < 0.8) {
          var x = 1 + Math.floor(R() * (COLS - 2));
          var len2 = 2 + Math.floor(R() * 5);
          var y0 = Math.floor(R() * (ROWS - len2 + 1));
          for (k = 0; k < len2; k++) digCell(x, y0 + k);
        } else {
          var wx = 1 + Math.floor(R() * (COLS - 3));
          var wy = 1 + Math.floor(R() * (ROWS - 3));
          digCell(wx, wy); digCell(wx + 1, wy);
          digCell(wx, wy + 1); digCell(wx + 1, wy + 1);
        }
      }
    }

    function shapeFits(ax, ay, shape) {
      for (var i = 0; i < shape.length; i++) {
        var cx = ax + shape[i][0], cy = ay + shape[i][1];
        if (cx === COLS - 1 && cy === 0) return false;
        if (S.player && cx === S.player.cx && cy === S.player.cy) return false;
        if (!freeDirt(cx, cy)) return false;
      }
      return true;
    }

    function generateLevel(level) {
      var R = DG.rng(((seed * 1000003) ^ (level * 7919) ^ 0x9E3779B9) >>> 0);
      levelRng = R;
      S.level = level;
      var i;
      for (i = 0; i < COLS * ROWS; i++) S.grid[i] = 0;
      S.items.length = 0;
      S.monsters.length = 0;
      S.bullets.length = 0;
      S.particles.length = 0;
      S.popups.length = 0;
      S.bonus = false; S.bonusT = 0; S.eatChain = 0; S.gemChain = 0;
      S.kills = 0; S.cherrySpawned = false; S.spawnTimer = 1.2;
      S.readyT = 0; S.deadT = 0; S.clearT = 0;

      var px = 2 + Math.floor(R() * (COLS - 4)); // 2..12
      var py = ROWS - 1;
      carveMain(R, px, py);
      carveExtras(R, 2 + Math.floor(R() * 3) + Math.floor(level / 3));

      S.player = makePlayer(px, py);
      S.player.shootMax = Math.min(2.6, 1.2 + 0.12 * (level - 1));
      S.player.invuln = 2.5;

      /* алмазы: кластеры в земле */
      var target = Math.min(26, 9 + level * 2);
      var placed = 0, guard = 0;
      while (placed < target && guard++ < 900) {
        var ax = Math.floor(R() * COLS), ay = Math.floor(R() * ROWS);
        var shape = GEM_SHAPES[Math.floor(R() * GEM_SHAPES.length)];
        if (!shapeFits(ax, ay, shape)) continue;
        for (i = 0; i < shape.length; i++) {
          addItem('gem', ax + shape[i][0], ay + shape[i][1]);
          placed++;
        }
      }
      guard = 0;
      while (placed < target && guard++ < 2000) {
        var cx = Math.floor(R() * COLS), cy = Math.floor(R() * ROWS);
        if (freeDirt(cx, cy)) { addItem('gem', cx, cy); placed++; }
      }

      /* мешки золота: в земле, с землёй под ними */
      var bagTarget = 2 + Math.min(level, 3);
      var cands = [];
      for (var cy2 = 1; cy2 < ROWS - 1; cy2++) {
        for (var cx2 = 0; cx2 < COLS; cx2++) {
          if (!freeDirt(cx2, cy2)) continue;
          if (isTunnel(cx2, cy2 + 1)) continue;
          cands.push([cx2, cy2]);
        }
      }
      shuffle(cands, R);
      for (i = 0; i < bagTarget && i < cands.length; i++) {
        addItem('bag', cands[i][0], cands[i][1]);
      }

      /* монстры */
      S.spawnLeft = Math.min(1 + level, 9);
      S.monstersMax = Math.min(1 + Math.floor((level - 1) / 2), 4);
      S.gnawerChance = clamp((level - 3) * 0.15, 0, 0.65);

      var gems = 0;
      for (i = 0; i < S.items.length; i++) if (S.items[i].type === 'gem') gems++;
      S.gemsTotal = gems;
      S.gemsLeft = gems;
      S.gemsCollected = 0;
      S.spawnTimer = 1.2;
    }

    /* ------------------------------ монстры -------------------------------- */
    function spawnMonster(cx, cy, kind) {
      var m = {
        kind: kind || 'crawler',
        cx: cx, cy: cy, x: cx + 0.5, y: cy + 0.5, tx: cx + 0.5, ty: cy + 0.5,
        dir: 2, scared: !!S.bonus, dying: 0, spawnT: 0, moving: false,
        think: 0.2, fromX: cx, fromY: cy - 1, walkPhase: 0
      };
      S.monsters.push(m);
      emit('monsterSpawn', { kind: m.kind, x: m.x, y: m.y });
      return m;
    }

    function bfsFrom(sx, sy, allowDirt) {
      var dist = new Int16Array(COLS * ROWS);
      dist.fill(-1);
      if (!inBounds(sx, sy)) return dist;
      var q = [sy * COLS + sx], head = 0;
      dist[q[0]] = 0;
      while (head < q.length) {
        var c = q[head++];
        var cx = c % COLS, cy = (c / COLS) | 0, d = dist[c];
        for (var k = 0; k < 4; k++) {
          var nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
          if (!inBounds(nx, ny)) continue;
          var ni = ny * COLS + nx;
          if (dist[ni] !== -1) continue;
          if (!isTunnel(nx, ny) && !allowDirt) continue;
          dist[ni] = d + 1;
          q.push(ni);
        }
      }
      return dist;
    }

    function monsterCanEnter(m, cx, cy) {
      if (!inBounds(cx, cy)) return false;
      if (isTunnel(cx, cy)) return true;
      return m.kind === 'gnawer' && !m.scared; // грызун копает
    }

    function startMonsterMove(m, dir, nx, ny) {
      m.fromX = m.cx; m.fromY = m.cy;
      m.dir = dir;
      m.cx = nx; m.cy = ny;
      m.tx = nx + 0.5; m.ty = ny + 0.5;
      m.moving = true;
      if (!isTunnel(nx, ny)) {
        digCell(nx, ny);
        emit('dig', { cx: nx, cy: ny, by: 'gnawer' });
        var it = itemAtCell(nx, ny);
        if (it) {
          if (it.type === 'gem' && levelRng() < 0.25) {
            removeItem(it);
            S.gemsLeft = Math.max(0, S.gemsLeft - 1);
            spawnBurst(nx + 0.5, ny + 0.5, 'gem', 5);
          } else if (it.type === 'bag' && levelRng() < 0.5) {
            removeItem(it);
            spawnBurst(nx + 0.5, ny + 0.5, 'dirt', 6);
          }
        }
      }
    }

    function chooseMonsterMove(m) {
      var p = S.player;
      var allowDig = (m.kind === 'gnawer' && !m.scared);
      var dist = bfsFrom(p.cx, p.cy, allowDig);
      var opts = [], k, nx, ny, d;
      for (k = 0; k < 4; k++) {
        nx = m.cx + DIRS[k][0]; ny = m.cy + DIRS[k][1];
        if (!monsterCanEnter(m, nx, ny)) continue;
        if (nx === m.fromX && ny === m.fromY) continue;
        d = dist[ny * COLS + nx];
        opts.push({ dir: k, nx: nx, ny: ny, d: d < 0 ? 999 : d });
      }
      if (!opts.length) {
        for (k = 0; k < 4; k++) {
          nx = m.cx + DIRS[k][0]; ny = m.cy + DIRS[k][1];
          if (!monsterCanEnter(m, nx, ny)) continue;
          d = dist[ny * COLS + nx];
          opts.push({ dir: k, nx: nx, ny: ny, d: d < 0 ? 999 : d });
        }
      }
      if (!opts.length) { m.think = 0.35; return; }
      var best = opts[0];
      for (var i = 1; i < opts.length; i++) {
        if (m.scared ? opts[i].d > best.d : opts[i].d < best.d) best = opts[i];
      }
      if (levelRng() < 0.12) best = opts[Math.floor(levelRng() * opts.length)];
      startMonsterMove(m, best.dir, best.nx, best.ny);
    }

    function updateMonsters(dt) {
      for (var i = S.monsters.length - 1; i >= 0; i--) {
        var m = S.monsters[i];
        if (m.dying > 0) {
          m.dying -= dt;
          if (m.dying <= 0) S.monsters.splice(i, 1);
          continue;
        }
        m.spawnT = Math.min(1, m.spawnT + dt * 2.5);
        m.scared = !!S.bonus && m.dying <= 0;
        var levelSlow = Math.max(0, 3 - S.level) * 0.04; // первые уровни — помягче
        var secPerCell = m.scared ? SPEED_SCARED
          : (m.kind === 'gnawer' ? SPEED_GNAWER : SPEED_CRAWLER) + levelSlow;
        if (m.moving) {
          var dx = m.tx - m.x, dy = m.ty - m.y;
          var len = Math.sqrt(dx * dx + dy * dy);
          var step = dt / secPerCell;
          if (len <= step) {
            m.x = m.tx; m.y = m.ty; m.moving = false; m.walkPhase = 0; m.think = 0;
          } else {
            m.x += dx / len * step;
            m.y += dy / len * step;
            m.walkPhase += dt * 11;
          }
        }
        if (!m.moving) {
          m.think -= dt;
          if (m.think <= 0) chooseMonsterMove(m);
        }
      }
    }

    function maybeSpawnMonster(dt) {
      if (S.spawnLeft <= 0) return;
      if (aliveMonsters().length >= S.monstersMax) return;
      S.spawnTimer -= dt;
      if (S.spawnTimer > 0) return;
      var spawnCx = COLS - 1, spawnCy = 0;
      if (monsterAtCell(spawnCx, spawnCy) || (S.player.cx === spawnCx && S.player.cy === spawnCy)) {
        S.spawnTimer = 0.35;
        return;
      }
      var kind = levelRng() < S.gnawerChance ? 'gnawer' : 'crawler';
      spawnMonster(spawnCx, spawnCy, kind);
      S.spawnLeft--;
      S.spawnTimer = Math.max(1.3, 3.0 - S.level * 0.18);
    }

    function maybeSpawnCherry() {
      if (S.mode !== 'play' || S.spawnLeft > 0 || S.cherrySpawned) return;
      if (S.gemsLeft <= 0) return;
      var cx = COLS - 1, cy = 0;
      if (itemAtCell(cx, cy) || monsterAtCell(cx, cy)) return;
      if (S.player.cx === cx && S.player.cy === cy) return;
      addItem('cherry', cx, cy);
      S.cherrySpawned = true;
    }

    /* --------------------------- убийство/жизни ---------------------------- */
    function checkExtraLife() {
      var guard = 0;
      while (S.score >= S.nextLife && guard++ < 20) {
        S.nextLife += EXTRA_LIFE;
        S.lives++;
        emit('extraLife', { lives: S.lives });
      }
    }

    function killMonster(m, by, points) {
      if (m.dying > 0) return;
      m.dying = 0.4;
      m.scared = false;
      var gain = points == null ? 250 : points;
      S.score += gain;
      S.kills++;
      addPopup('+' + gain, m.x, m.y, 'score');
      spawnBurst(m.x, m.y, by === 'eat' ? 'eat' : 'monster', 10);
      emit('monsterDie', { x: m.x, y: m.y, by: by, score: gain });
      if (by === 'bag') S.shake = Math.max(S.shake, 0.45);
      checkExtraLife();
      checkLevelClear();
    }

    function eatMonster(m) {
      var gain = 200 * Math.pow(2, Math.min(S.eatChain, 5));
      S.eatChain++;
      killMonster(m, 'eat', gain);
    }

    function playerDie(cause) {
      var p = S.player;
      if (!p.alive || !isPlaying()) return;
      p.alive = false;
      S.lives = Math.max(0, S.lives - 1);
      S.bonus = false; S.bonusT = 0; S.eatChain = 0;
      S.shake = 1;
      spawnBurst(p.x, p.y, 'death', 16);
      emit('playerDie', { cause: cause || 'monster' });
      S.mode = 'dying';
      S.deadT = DEATH_TIME;
    }

    function checkLevelClear() {
      if (!isPlaying()) return;
      if (S.gemsLeft <= 0) { levelClear(); return; }
      if (S.spawnLeft <= 0 && aliveMonsters().length === 0) levelClear();
    }

    function levelClear() {
      if (!isPlaying()) return;
      S.bonus = false; S.bonusT = 0; S.eatChain = 0;
      S.score += 1000;
      S.stats.levels++;
      checkExtraLife();
      S.shake = Math.max(S.shake, 0.3);
      emit('levelClear', { level: S.level, score: S.score });
      S.mode = 'levelclear';
      S.clearT = CLEAR_TIME;
    }

    function afterDeath() {
      if (S.lives > 0) {
        generateLevel(S.level);
        S.mode = 'ready'; S.readyT = READY_TIME;
        emit('levelStart', { level: S.level, respawn: true });
      } else {
        var oldHi = S.hiAtStart;
        S.hi = Math.max(S.hi, S.score);
        S.mode = 'gameover';
        emit('gameOver', {
          score: S.score, hi: S.hi,
          record: S.score > oldHi && S.score > 0,
          stats: S.stats
        });
      }
    }

    function nextLevel() {
      generateLevel(S.level + 1);
      S.mode = 'ready'; S.readyT = READY_TIME;
      emit('levelStart', { level: S.level, newLevel: true });
    }

    /* ------------------------------- сумки --------------------------------- */
    function bagCrush(bag) {
      var p = S.player;
      if (p && p.alive) {
        var dx = p.x - bag.x, dy = p.y - bag.y;
        if (dx * dx + dy * dy < 0.5 * 0.5 && p.invuln <= 0) {
          emit('squash', { x: bag.x, y: bag.y });
          playerDie('bag');
          return;
        }
      }
      for (var i = 0; i < S.monsters.length; i++) {
        var m = S.monsters[i];
        if (m.dying > 0 || m.spawnT < 0.3) continue;
        var mx = m.x - bag.x, my = m.y - bag.y;
        if (mx * mx + my * my < 0.5 * 0.5) {
          emit('squash', { x: bag.x, y: bag.y });
          killMonster(m, 'bag', 250);
        }
      }
    }

    function landBag(bag) {
      bag.falling = false;
      bag.y = bag.cy + 0.5;
      var fell = bag.cy - bag.fallFrom;
      if (fell >= 2) breakBag(bag);
      else bag.wobble = -1;
    }

    function breakBag(bag) {
      var cx = bag.cx, cy = bag.cy, x = bag.x, y = bag.y;
      removeItem(bag);
      S.stats.bagKills++;
      spawnBurst(x, y, 'gold', 14);
      S.shake = Math.max(S.shake, 0.3);
      emit('bagBreak', { x: x, y: y });
      if (!itemAtCell(cx, cy)) {
        var g = addItem('gold', cx, cy);
        g.y = y;
      }
    }

    function updateBags(dt) {
      for (var i = S.items.length - 1; i >= 0; i--) {
        var bag = S.items[i];
        if (bag.type !== 'bag') continue;
        if (bag.falling) {
          var travel = FALL_SPEED * dt, guard = 0;
          while (travel > 0 && bag.falling && guard++ < 10) {
            var nextY = bag.cy + 1.5;
            var need = nextY - bag.y;
            if (need > travel) { bag.y += travel; travel = 0; }
            else {
              travel -= need;
              bag.y = nextY;
              bag.cy += 1;
              bagCrush(bag);
              if (bag.cy >= ROWS - 1 || !isTunnel(bag.cx, bag.cy + 1)) landBag(bag);
            }
          }
          if (bag.falling) bagCrush(bag);
        } else if (bag.wobble >= 0) {
          bag.wobble -= dt;
          if (bag.wobble < 0) {
            bag.falling = true;
            bag.fallFrom = bag.cy;
            bag.wobble = -1;
            emit('bagFall', { x: bag.x, y: bag.y });
          }
        } else if (!bagSupported(bag)) {
          bag.wobble = WOBBLE_TIME;
          emit('bagWobble', { x: bag.x, y: bag.y });
        }
      }
    }

    /* ------------------------------- игрок --------------------------------- */
    function tryPlayerMove(dir) {
      var p = S.player;
      var dx = DIRS[dir][0], dy = DIRS[dir][1];
      var nx = p.cx + dx, ny = p.cy + dy;
      if (!inBounds(nx, ny)) { p.dir = dir; return false; }

      var bag = itemAtCell(nx, ny);
      if (bag && bag.type === 'bag') {
        var ok = false;
        if (dy === 0) {
          var bx = bag.cx + dx, by = bag.cy;
          if (inBounds(bx, by) && isTunnel(bx, by) && !itemAtCell(bx, by) && !monsterAtCell(bx, by)) {
            bag.cx = bx; bag.x = bx + 0.5;
            ok = true;
            emit('bagPush', { x: bag.x, y: bag.y });
            if (bagSupported(bag) === false && bag.wobble < 0) {
              bag.wobble = WOBBLE_TIME;
              emit('bagWobble', { x: bag.x, y: bag.y });
            }
          }
        }
        if (!ok) { p.dir = dir; return false; }
      }

      if (!isTunnel(nx, ny)) {
        digCell(nx, ny);
        S.stats.dug++;
        emit('dig', { cx: nx, cy: ny, by: 'player' });
        spawnBurst(nx + 0.5, ny + 0.5, 'dirt', 7);
        var above = itemAtCell(nx, ny - 1);
        if (above && above.type === 'bag' && above.wobble < 0 && !bagSupported(above)) {
          above.wobble = WOBBLE_TIME;
          emit('bagWobble', { x: above.x, y: above.y });
        }
      }

      p.dir = dir;
      p.cx = nx; p.cy = ny;
      p.tx = nx + 0.5; p.ty = ny + 0.5;
      p.moving = true;
      return true;
    }

    function collectItem(it) {
      var p = S.player;
      if (it.type === 'gem') {
        removeItem(it);
        S.gemsLeft = Math.max(0, S.gemsLeft - 1);
        S.gemsCollected++;
        S.stats.gems++;
        S.gemChain++;
        var gain = 25;
        if (S.gemChain % 8 === 0) {
          gain += 250;
          addPopup('+250', it.x, it.y - 0.45, 'bonus');
        }
        S.score += gain;
        addPopup('+25', it.x, it.y, 'score');
        spawnBurst(it.x, it.y, 'gem', 8);
        emit('gem', { score: gain, chain: S.gemChain, x: it.x, y: it.y });
        checkExtraLife();
        if (S.gemsLeft <= 0) levelClear();
      } else if (it.type === 'gold') {
        removeItem(it);
        S.score += 500;
        S.gemChain = 0;
        addPopup('+500', it.x, it.y, 'score');
        spawnBurst(it.x, it.y, 'gold', 10);
        emit('gold', { x: it.x, y: it.y });
        checkExtraLife();
      } else if (it.type === 'cherry') {
        removeItem(it);
        S.score += 1000;
        S.gemChain = 0;
        addPopup('+1000', it.x, it.y, 'score');
        spawnBurst(it.x, it.y, 'gold', 12);
        emit('cherry', { x: it.x, y: it.y });
        checkExtraLife();
        startBonus();
      }
    }

    function startBonus() {
      S.bonus = true;
      S.bonusDur = Math.max(6, 15 - (S.level - 1) * 1.5);
      S.bonusT = S.bonusDur;
      S.eatChain = 0;
      S.mode = 'bonus';
      for (var i = 0; i < S.monsters.length; i++) S.monsters[i].scared = true;
      S.shake = Math.max(S.shake, 0.35);
      emit('bonusStart', { dur: S.bonusDur });
    }

    function endBonus() {
      S.bonus = false; S.bonusT = 0; S.eatChain = 0;
      for (var i = 0; i < S.monsters.length; i++) S.monsters[i].scared = false;
      if (S.mode === 'bonus') S.mode = 'play';
      emit('bonusEnd', {});
      if (S.gemsLeft > 0 && S.spawnLeft <= 0) {
        S.spawnLeft = Math.max(1, 1 + Math.floor(S.level / 2));
        S.cherrySpawned = false;
        S.spawnTimer = 1.2;
      }
    }

    function updatePlayer(dt) {
      var p = S.player;
      if (!p || !p.alive) return;
      p.invuln = Math.max(0, p.invuln - dt);
      p.shootCd = Math.max(0, p.shootCd - dt);
      p.shootAnim = Math.max(0, p.shootAnim - dt * 3.2);
      if (p.moving) {
        var dx = p.tx - p.x, dy = p.ty - p.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        var step = MOVE_SPEED * dt;
        p.walkPhase += dt * 12;
        if (len <= step) {
          p.x = p.tx; p.y = p.ty; p.moving = false; p.walkPhase = 0;
          var it = itemAtCell(p.cx, p.cy);
          if (it) collectItem(it);
          if (!isPlaying()) return;
        } else {
          p.x += dx / len * step;
          p.y += dy / len * step;
          return;
        }
      }
      if (p.inputDir >= 0) tryPlayerMove(p.inputDir);
    }

    function updateBullets(dt) {
      for (var i = S.bullets.length - 1; i >= 0; i--) {
        var b = S.bullets[i];
        var dx = DIRS[b.dir][0], dy = DIRS[b.dir][1];
        var total = BULLET_SPEED * dt;
        var steps = Math.max(1, Math.ceil(total / 0.28));
        var dead = false;
        for (var s = 0; s < steps && !dead; s++) {
          b.x += dx * total / steps;
          b.y += dy * total / steps;
          b.life -= dt / steps;
          if (b.x < -0.5 || b.x > COLS + 0.5 || b.y < -0.5 || b.y > ROWS + 0.5) { dead = true; break; }
          var cx = Math.floor(b.x), cy = Math.floor(b.y);
          if (inBounds(cx, cy) && !isTunnel(cx, cy)) {
            spawnBurst(b.x, b.y, 'spark', 5);
            emit('bulletHit', { x: b.x, y: b.y });
            dead = true; break;
          }
          for (var j = 0; j < S.monsters.length; j++) {
            var m = S.monsters[j];
            if (m.dying > 0) continue;
            var mx = m.x - b.x, my = m.y - b.y;
            if (mx * mx + my * my < 0.45 * 0.45) {
              killMonster(m, 'bullet', 250);
              spawnBurst(b.x, b.y, 'spark', 6);
              dead = true; break;
            }
          }
        }
        if (dead || b.life <= 0) S.bullets.splice(i, 1);
        if (!isPlaying()) return;
      }
    }

    function checkContacts() {
      var p = S.player;
      if (!p.alive) return;
      for (var i = 0; i < S.monsters.length; i++) {
        var m = S.monsters[i];
        if (m.dying > 0 || m.spawnT < 0.45) continue;
        var dx = m.x - p.x, dy = m.y - p.y;
        if (dx * dx + dy * dy < 0.58 * 0.58) {
          if (S.bonus) {
            eatMonster(m);
            if (!isPlaying()) return;
          } else if (p.invuln <= 0) {
            playerDie('monster');
            return;
          } else {
            // пока игрок неуязвим, монстр не может «сидеть» на нём — отбрасываем назад
            if (m.cx === p.cx && m.cy === p.cy) {
              m.moving = false; m.think = 0.35;
              m.cx = m.fromX; m.cy = m.fromY;
              m.x = m.cx + 0.5; m.y = m.cy + 0.5;
            }
          }
        }
      }
    }

    function updatePlay(dt) {
      updatePlayer(dt);
      if (!isPlaying()) return;
      updateBags(dt);
      if (!isPlaying()) return;
      updateBullets(dt);
      if (!isPlaying()) return;
      updateMonsters(dt);
      if (!isPlaying()) return;
      checkContacts();
      if (!isPlaying()) return;
      maybeSpawnMonster(dt);
      maybeSpawnCherry();
      if (S.bonus) {
        S.bonusT -= dt;
        if (S.bonusT <= 0) endBonus();
      }
      checkLevelClear();
    }

    /* ------------------------------- титул --------------------------------- */
    function tunnelSpots(n) {
      var cells = [];
      for (var cy = 0; cy < ROWS; cy++) {
        for (var cx = 0; cx < COLS; cx++) {
          if (!isTunnel(cx, cy)) continue;
          if (S.player && cx === S.player.cx && cy === S.player.cy) continue;
          if (cx === COLS - 1 && cy === 0) continue;
          cells.push([cx, cy]);
        }
      }
      shuffle(cells, vrng);
      return cells.slice(0, n);
    }

    function updateTitle(dt) {
      var slow = dt * 0.55;
      S.player.invuln = 99;
      updateMonsters(slow);
      updateBags(slow);
      maybeSpawnMonster(slow);
    }

    /* ----------------------------- управление ------------------------------ */
    function start() {
      S.score = 0; S.lives = 3; S.nextLife = EXTRA_LIFE; S.hiAtStart = S.hi;
      S.stats = { dug: 0, bagKills: 0, shots: 0, gems: 0, levels: 0 };
      S.paused = false;
      generateLevel(1);
      S.mode = 'ready'; S.readyT = READY_TIME;
      S.player.invuln = 2.5;
      emit('levelStart', { level: 1, newGame: true });
    }

    function toTitle() {
      S.score = 0; S.lives = 3; S.paused = false;
      generateLevel(1);
      S.mode = 'title';
      var spots = tunnelSpots(3);
      for (var i = 0; i < spots.length; i++) {
        var m = spawnMonster(spots[i][0], spots[i][1], i === 2 ? 'gnawer' : 'crawler');
        m.spawnT = 1;
      }
      S.player.invuln = 99;
      S.hi = Math.max(S.hi, opts.hiscore || 0);
    }

    function setLevel(n) {
      var lv = clamp(n | 0, 1, 99);
      generateLevel(lv);
      S.mode = 'ready'; S.readyT = READY_TIME;
      emit('levelStart', { level: lv, debug: true });
    }

    function forceMode(mode) {
      if (mode === 'title') { toTitle(); return; }
      if (mode === 'gameover') {
        S.mode = 'gameover'; S.player.alive = false;
        S.hi = Math.max(S.hi, S.score);
        return;
      }
      if (mode === 'dying') {
        S.mode = 'dying'; S.deadT = DEATH_TIME; S.player.alive = false; S.shake = 1;
        return;
      }
      if (mode === 'levelclear') { S.mode = 'levelclear'; S.clearT = CLEAR_TIME; return; }
      if (!S.gemsTotal) generateLevel(1);
      S.player.alive = true;
      S.player.invuln = 3;
      S.mode = 'play';
      if (aliveMonsters().length === 0) {
        var spots = tunnelSpots(3);
        for (var i = 0; i < spots.length; i++) {
          var m = spawnMonster(spots[i][0], spots[i][1], i === 2 ? 'gnawer' : 'crawler');
          m.spawnT = 1;
        }
      }
      if (mode === 'bonus') {
        S.bonus = true; S.bonusDur = 15; S.bonusT = 12; S.eatChain = 0;
        for (var j = 0; j < S.monsters.length; j++) S.monsters[j].scared = true;
        S.mode = 'bonus';
      }
      if (S.score === 0) S.score = S.level * 1250;
      S.hi = Math.max(S.hi, S.score);
    }

    function setDir(dir) {
      if (!isPlaying() || S.paused) return;
      var p = S.player;
      if (!p || !p.alive) return;
      p.inputDir = (dir >= 0 && dir <= 3) ? dir : -1;
      if (p.inputDir >= 0 && !p.moving) tryPlayerMove(p.inputDir);
    }

    function shoot() {
      if (!isPlaying() || S.paused) return;
      var p = S.player;
      if (!p || !p.alive || p.shootCd > 0) return;
      p.shootCd = p.shootMax;
      p.shootAnim = 1;
      S.stats.shots++;
      var d = DIRS[p.dir];
      S.bullets.push({
        x: p.x + d[0] * 0.45,
        y: p.y + d[1] * 0.45,
        dir: p.dir,
        life: 2.2
      });
      emit('shoot', { x: p.x, y: p.y, dir: p.dir });
      S.shake = Math.max(S.shake, 0.1);
    }

    function pause(flag) {
      var v = !!flag;
      if (S.paused === v) return;
      S.paused = v;
      emit('pause', { paused: v });
    }

    function update(dt) {
      if (typeof dt !== 'number' || !isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.05);
      S.time += dt;
      if (S.paused) return;
      S.anim += dt;
      S.shake = Math.max(0, S.shake - dt * 2.6);
      updateParticles(dt);
      updatePopups(dt);
      switch (S.mode) {
        case 'title': updateTitle(dt); break;
        case 'ready':
          S.readyT -= dt;
          if (S.readyT <= 0) S.mode = 'play';
          break;
        case 'dying':
          S.deadT -= dt;
          if (S.deadT <= 0) afterDeath();
          break;
        case 'levelclear':
          S.clearT -= dt;
          if (S.clearT <= 0) nextLevel();
          break;
        case 'play':
        case 'bonus':
          updatePlay(dt);
          break;
        default: break;
      }
      if (S.score > S.hi) S.hi = S.score;
    }

    /* ------------------------------- API ----------------------------------- */
    var api = {
      state: S,
      start: start,
      toTitle: toTitle,
      update: update,
      setDir: setDir,
      shoot: shoot,
      pause: pause,
      togglePause: function () { pause(!S.paused); },
      setLevel: setLevel,
      forceMode: forceMode,
      onEvent: function (fn) { onEventFn = typeof fn === 'function' ? fn : null; },
      resetHi: function (h) { S.hi = Math.max(0, h | 0); S.hiAtStart = S.hi; }
    };

    /* ------------------------------- boot ---------------------------------- */
    toTitle();
    return api;
  };
})(window);
