/* ==========================================================================
   СЕВЕРНАЯ САГА 2 · СТУДИЯ ГЕФЕСТ — игровой движок
   Платформер-головоломка: три северянина, переключение, способности сиквела.
   Координаты: x — центр, y — ноги (низ AABB). Тайл 32 px, экран 1024×576.
   Классические скрипты, без ES-модулей (работает по file://).
   ========================================================================== */
(function () {
  'use strict';

  var SAGA2 = window.SAGA2 = window.SAGA2 || {};

  var TILE = 32;
  var VIEW_W = 1024;
  var VIEW_H = 576;
  var GRAVITY = 1800;
  var TERM_VEL = 900;
  var LADDER_SPEED = 140;

  var CHARS = {
    snorri:   { id: 'snorri',   w: 24, h: 44, speed: 300, jump: 630, canJump: true  },
    gunnar: { id: 'gunnar', w: 26, h: 46, speed: 220, jump: 0,   canJump: false },
    bjorn:   { id: 'bjorn',   w: 32, h: 40, speed: 180, jump: 510, canJump: true  }
  };
  var ORDER = ['snorri', 'gunnar', 'bjorn'];
  var MAX_HP = 3;
  var TILE_CHARS = '#=^~L.GT';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function approach(v, target, step) {
    if (v < target) return Math.min(target, v + step);
    if (v > target) return Math.max(target, v - step);
    return target;
  }
  function overlaps(a, b) {
    return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  }
  function actorRect(a) {
    return { l: a.x - a.w / 2, r: a.x + a.w / 2, t: a.y - a.h, b: a.y };
  }
  function copyInput(src) {
    return {
      left: !!src.left, right: !!src.right, up: !!src.up, down: !!src.down,
      jump: !!src.jump, action: !!src.action, special: !!src.special, hook: !!src.hook
    };
  }

  function makeActor(id, x, y) {
    var c = CHARS[id];
    return {
      id: id,
      x: x, y: y, w: c.w, h: c.h,
      dir: 1, vx: 0, vy: 0,
      onGround: false, onBjorn: false, groundProp: null,
      state: 'idle', anim: Math.random() * 6,
      hp: MAX_HP, maxHp: MAX_HP, invuln: 0,
      active: false, exited: false, dead: false,
      shieldUp: false, glide: false, aimUp: false,
      attack: null, cooldown: 0,
      hook: null,
      coyote: 0, jumpBuf: 0, respawnTimer: 0,
      stepTimer: 0
    };
  }

  function Game(opts) {
    opts = opts || {};
    this.levels = opts.levels || [];
    this.onEvent = opts.onEvent || null;
    this.onLevelComplete = opts.onLevelComplete || null;

    this.input = copyInput({});
    this.prevInput = copyInput({});

    this.levelIndex = 0;
    this.level = null;
    this.grid = [];
    this.cols = 0;
    this.rowsN = 0;

    this.actors = [];
    this.enemies = [];
    this.props = [];
    this.projectiles = [];
    this.solids = [];

    this.plates = [];
    this.doors = [];
    this.levers = [];
    this.platforms = [];
    this.runes = [];
    this.checkpoints = [];
    this.signs = [];
    this.torches = [];
    this.anchors = [];
    this.exit = null;

    this.active = 'snorri';
    this.time = 0;
    this.globalTime = 0;
    this.deaths = 0;
    this.levelDeaths = 0;
    this.runScore = 0;
    this.levelStartScore = 0;
    this.levelRunes = 0;
    this.runesTotal = 3;
    this.paused = false;
    this.completed = false;
    this.levelStats = null;
    this.respawnPoints = {};
    this.spawnPoints = {};
    this.camera = { x: 0, y: 0, w: VIEW_W, h: VIEW_H, shake: 0 };
    this.world = null;
    this.signCooldown = 0;

    this.debug = {
      loadLevel: this.loadLevel.bind(this),
      teleport: this.debugTeleport.bind(this),
      winLevel: this.debugWinLevel.bind(this),
      getState: this.getDebugState.bind(this),
      setCamera: this.debugSetCamera.bind(this)
    };
  }

  Game.prototype.emit = function (ev) {
    if (this.onEvent) this.onEvent(ev);
  };

  Game.prototype.setEventSink = function (fn) {
    this.onEvent = fn || null;
  };

  Game.prototype.setInput = function (input) {
    if (input) this.input = input;
  };

  Game.prototype.getTile = function (col, row) {
    if (row < 0 || row >= this.rowsN) return row < 0 ? '#' : '.';
    if (col < 0 || col >= this.cols) return '#';
    return this.grid[row][col];
  };

  Game.prototype.isSolidTile = function (col, row) {
    if (row < 0) return true;
    if (row >= this.rowsN) return false;
    if (col < 0 || col >= this.cols) return true;
    var ch = this.grid[row][col];
    return ch === '#' || ch === '=';
  };

  Game.prototype.levelWidth = function () { return this.cols * TILE; };
  Game.prototype.levelHeight = function () { return this.rowsN * TILE; };

  Game.prototype.activeActor = function () {
    for (var i = 0; i < this.actors.length; i++) {
      var a = this.actors[i];
      if (a.id === this.active && !a.dead && !a.exited) return a;
    }
    for (var j = 0; j < this.actors.length; j++) {
      if (!this.actors[j].dead && !this.actors[j].exited) {
        this.active = this.actors[j].id;
        return this.actors[j];
      }
    }
    return null;
  };

  Game.prototype.actorById = function (id) {
    for (var i = 0; i < this.actors.length; i++) {
      if (this.actors[i].id === id) return this.actors[i];
    }
    return null;
  };

  /* ---------------------------------------------------------------- уровни */

  Game.prototype.loadLevel = function (index) {
    if (!this.levels.length) return;
    var i = ((index | 0) % this.levels.length + this.levels.length) % this.levels.length;
    var lv = this.levels[i];
    this.levelIndex = i;
    this.level = lv;

    this.grid = [];
    this.cols = 0;
    var rows = lv.rows || [];
    var r, c;
    for (r = 0; r < rows.length; r++) {
      var line = String(rows[r]).split('');
      if (line.length > this.cols) this.cols = line.length;
      this.grid.push(line);
    }
    this.rowsN = this.grid.length;
    for (r = 0; r < this.rowsN; r++) {
      while (this.grid[r].length < this.cols) this.grid[r].push('.');
    }

    this.actors = [];
    this.enemies = [];
    this.props = [];
    this.projectiles = [];
    this.plates = [];
    this.doors = [];
    this.levers = [];
    this.platforms = [];
    this.runes = [];
    this.checkpoints = [];
    this.signs = [];
    this.torches = [];
    this.anchors = [];
    this.exit = null;
    this.runesTotal = 0;

    this.time = 0;
    this.levelDeaths = 0;
    this.levelRunes = 0;
    this.levelStartScore = this.runScore;
    this.levelStats = null;
    this.paused = false;
    this.completed = false;
    this.signCooldown = 0;
    this.respawnPoints = {};

    var ents = lv.entities || [];
    for (var e = 0; e < ents.length; e++) {
      this.buildEntity(ents[e]);
    }

    if (!this.exit) {
      this.exit = {
        type: 'exit', x: this.levelWidth() - 3 * TILE, y: this.levelHeight() - 4 * TILE,
        w: 2 * TILE, h: 3 * TILE, collected: 0, total: 3
      };
      this.props.push(this.exit);
    }
    this.runesTotal = this.runes.length;

    var sp = lv.spawn || {};
    for (var k = 0; k < ORDER.length; k++) {
      var id = ORDER[k];
      var point = sp[id] || [2 + k * 2, this.rowsN - 3];
      var sx = point[0] * TILE + TILE / 2;
      var sy = (point[1] + 1) * TILE;
      var a = makeActor(id, sx, sy);
      a.active = (id === 'snorri');
      this.actors.push(a);
      this.spawnPoints[id] = { x: sx, y: sy };
      this.respawnPoints[id] = { x: sx, y: sy };
    }
    this.active = 'snorri';

    this.camera.x = clamp(this.actors[0].x - VIEW_W / 2, 0, Math.max(0, this.levelWidth() - VIEW_W));
    this.camera.y = clamp(this.actors[0].y - VIEW_H * 0.62, 0, Math.max(0, this.levelHeight() - VIEW_H));
    this.camera.shake = 0;

    this.syncWorld();
  };

  Game.prototype.buildEntity = function (ent) {
    if (!ent || !ent.type) return;
    var col = Math.round(ent.x || 0);
    var row = Math.round(ent.y || 0);
    var prop;
    switch (ent.type) {
      case 'plate':
        prop = {
          type: 'plate', group: ent.group || 'a',
          x: col * TILE + TILE / 2, y: (row + 1) * TILE,
          w: TILE - 6, h: 10, pressed: false
        };
        this.plates.push(prop);
        this.props.push(prop);
        break;
      case 'door':
        prop = {
          type: 'door', group: ent.group || 'a',
          x: col * TILE, y: row * TILE,
          w: (ent.w || 1) * TILE, h: (ent.h || 3) * TILE,
          open: 0
        };
        this.doors.push(prop);
        this.props.push(prop);
        break;
      case 'lever':
        prop = {
          type: 'lever', group: ent.group || 'a', on: false,
          x: col * TILE + TILE / 2, y: (row + 1) * TILE,
          w: 26, h: 34
        };
        this.levers.push(prop);
        this.props.push(prop);
        break;
      case 'platform':
        prop = {
          type: 'platform',
          x: col * TILE, y: row * TILE,
          w: (ent.w || 3) * TILE, h: 16,
          ox: col * TILE, oy: row * TILE,
          dx: (ent.dx || 0) * TILE, dy: (ent.dy || 0) * TILE,
          speed: (ent.speed || 1.5) * TILE,
          u: 0, prevX: col * TILE, prevY: row * TILE
        };
        this.platforms.push(prop);
        this.props.push(prop);
        break;
      case 'enemy':
        prop = {
          type: 'enemy', kind: ent.kind || 'grunt',
          x: col * TILE + TILE / 2, y: (row + 1) * TILE,
          w: ent.kind === 'bat' ? 30 : 30, h: ent.kind === 'bat' ? 24 : 34,
          dir: ent.dir === -1 ? -1 : 1,
          range: (ent.range || 4) * TILE,
          homeX: col * TILE + TILE / 2,
          homeY: (row + 1) * TILE,
          hp: 1, active: true, state: 'patrol', anim: Math.random() * 6,
          shootTimer: 1.2 + Math.random() * 1.4, hurtTimer: 0
        };
        this.enemies.push(prop);
        this.props.push(prop);
        break;
      case 'rune':
        prop = {
          type: 'rune', x: col * TILE + TILE / 2, y: row * TILE + TILE / 2,
          w: 24, h: 24, taken: false
        };
        this.runes.push(prop);
        this.props.push(prop);
        break;
      case 'checkpoint':
        prop = {
          type: 'checkpoint', x: col * TILE + TILE / 2, y: (row + 1) * TILE,
          w: 44, h: 62, active: false
        };
        this.checkpoints.push(prop);
        this.props.push(prop);
        break;
      case 'exit':
        prop = {
          type: 'exit',
          x: col * TILE, y: row * TILE,
          w: (ent.w || 2) * TILE, h: (ent.h || 2) * TILE,
          collected: 0, total: 3
        };
        this.exit = prop;
        this.props.push(prop);
        break;
      case 'sign':
        prop = {
          type: 'sign', x: col * TILE + TILE / 2, y: (row + 1) * TILE,
          w: 26, h: 48, ru: ent.ru || '', en: ent.en || '', seen: false, near: false
        };
        this.signs.push(prop);
        this.props.push(prop);
        break;
      case 'torch':
        prop = {
          type: 'torch', x: col * TILE + TILE / 2, y: row * TILE + TILE / 2,
          w: 16, h: 26, seed: Math.random() * 10
        };
        this.torches.push(prop);
        this.props.push(prop);
        break;
      case 'anchor':
        prop = {
          type: 'anchor', x: col * TILE + TILE / 2, y: row * TILE + TILE / 2,
          w: 18, h: 18
        };
        this.anchors.push(prop);
        this.props.push(prop);
        break;
      default:
        break;
    }
  };

  Game.prototype.restartLevel = function () {
    this.loadLevel(this.levelIndex);
  };

  Game.prototype.pause = function () { this.paused = true; };
  Game.prototype.resume = function () { this.paused = false; };

  Game.prototype.switchTo = function (id) {
    if (this.completed) return false;
    if (ORDER.indexOf(id) < 0) return false;
    if (id === this.active) return false;
    var target = this.actorById(id);
    if (!target || target.dead || target.exited) return false;
    var cur = this.actorById(this.active);
    if (cur && cur !== target) {
      cur.active = false;
      cur.vx = 0;
      cur.vy = 0;
      cur.attack = null;
    }
    target.active = true;
    this.active = id;
    this.emit({ type: 'switch', actor: id, x: target.x, y: target.y });
    return true;
  };

  Game.prototype.nextActor = function () {
    var start = ORDER.indexOf(this.active);
    for (var k = 1; k <= ORDER.length; k++) {
      var id = ORDER[(start + k + ORDER.length) % ORDER.length];
      if (this.switchTo(id)) return true;
    }
    return false;
  };

  Game.prototype.syncWorld = function () {
    var w = this.world;
    if (!w) w = this.world = {};
    w.levelIndex = this.levelIndex;
    w.levelCount = this.levels.length;
    w.cols = this.cols;
    w.rows = this.rowsN;
    w.tile = TILE;
    w.width = this.levelWidth();
    w.height = this.levelHeight();
    w.time = this.time;
    w.globalTime = this.globalTime;
    w.camera = this.camera;
    w.actors = this.actors;
    w.enemies = this.enemies;
    w.props = this.props;
    w.projectiles = this.projectiles;
    w.exit = this.exit;
    w.active = this.active;
    w.runes = { got: this.levelRunes, total: this.runesTotal };
    w.level = { name: this.level ? this.level.name : '', nameEn: this.level ? this.level.nameEn : '' };
    w.completed = this.completed;
    w.mode = 'play';
  };

  Game.prototype.getUIState = function () {
    var actors = [];
    for (var i = 0; i < this.actors.length; i++) {
      var a = this.actors[i];
      actors.push({
        id: a.id, hp: a.hp, maxHp: a.maxHp,
        dead: a.dead, exited: a.exited, active: a.id === this.active
      });
    }
    var lv = this.level || {};
    return {
      levelIndex: this.levelIndex,
      levelCount: this.levels.length,
      name: lv.name || '',
      nameEn: lv.nameEn || '',
      hint: lv.hint || '',
      hintEn: lv.hintEn || '',
      runes: this.levelRunes,
      runesTotal: this.runesTotal,
      score: this.runScore,
      deaths: this.deaths,
      levelDeaths: this.levelDeaths,
      time: this.time,
      active: this.active,
      actors: actors,
      exitCollected: this.exit ? this.exit.collected : 0,
      exitTotal: 3,
      paused: this.paused,
      completed: this.completed,
      music: lv.music || 0
    };
  };

  Game.prototype.getDebugState = function () {
    return {
      levelIndex: this.levelIndex,
      active: this.active,
      time: Math.round(this.time * 10) / 10,
      completed: this.completed,
      actors: this.actors.map(function (a) {
        return { id: a.id, x: Math.round(a.x), y: Math.round(a.y), hp: a.hp, dead: a.dead, exited: a.exited };
      }),
      runes: this.levelRunes,
      exit: this.exit ? this.exit.collected : 0
    };
  };

  Game.prototype.debugTeleport = function (id, col, row) {
    var a = this.actorById(id);
    if (!a) return false;
    a.x = col * TILE + TILE / 2;
    a.y = (row + 1) * TILE;
    a.vx = a.vy = 0;
    a.dead = false;
    a.hp = a.maxHp;
    return true;
  };

  Game.prototype.debugWinLevel = function () {
    for (var i = 0; i < this.actors.length; i++) {
      this.actors[i].exited = true;
      this.actors[i].x = this.exit.x + this.exit.w / 2;
      this.actors[i].y = this.exit.y + this.exit.h;
    }
    this.exit.collected = 3;
    this.completeLevel();
  };

  Game.prototype.debugSetCamera = function (x, y) {
    this.camera.x = x;
    this.camera.y = y;
  };

  /* -------------------------------------------------------------- главный цикл */

  Game.prototype.update = function (dt) {
    if (this.paused || this.completed) {
      this.syncWorld();
      return;
    }
    dt = clamp(dt || 0, 0, 1 / 30);
    this.time += dt;
    this.globalTime += dt;
    if (this.camera.shake > 0) this.camera.shake = Math.max(0, this.camera.shake - dt * 2.4);
    if (this.signCooldown > 0) this.signCooldown -= dt;

    this.updateTimers(dt);
    this.updatePlatforms(dt);
    this.updateSwitches(dt);

    this.solids = this.collectSolids();
    var bjorn = this.actorById('bjorn');
    this.bjornPrev = bjorn ? { x: bjorn.x, y: bjorn.y } : null;

    var a = this.activeActor();
    if (a) this.updateActor(a, dt);
    this.updateCarried();
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updatePickups(a);
    this.updateSigns(a);

    a = this.activeActor();
    if (a && !a.dead && !a.exited) this.updateHazards(a);
    if (this.exit && this.exit.collected >= 3 && !this.completed) this.completeLevel();

    this.updateCamera(dt);
    this.prevInput = copyInput(this.input);
    this.syncWorld();
  };

  Game.prototype.updateTimers = function (dt) {
    for (var i = 0; i < this.actors.length; i++) {
      var a = this.actors[i];
      a.anim += dt;
      if (a.invuln > 0) a.invuln = Math.max(0, a.invuln - dt);
      if (a.cooldown > 0) a.cooldown = Math.max(0, a.cooldown - dt);
      if (a.attack) {
        a.attack.t += dt / (a.attack.kind === 'bow' ? 0.26 : 0.3);
        if (a.attack.t >= 1) a.attack = null;
      }
      if (a.dead) {
        a.respawnTimer -= dt;
        if (a.respawnTimer <= 0) this.respawnActor(a);
      }
    }
  };

  Game.prototype.updatePlatforms = function (dt) {
    for (var i = 0; i < this.platforms.length; i++) {
      var p = this.platforms[i];
      p.prevX = p.x;
      p.prevY = p.y;
      var dist = Math.abs(p.dx) + Math.abs(p.dy);
      if (dist > 0) {
        p.u += dt * p.speed / dist;
        var ph = p.u % 2;
        var k = ph < 1 ? ph : 2 - ph;
        p.x = p.ox + p.dx * k;
        p.y = p.oy + p.dy * k;
      }
      var mx = p.x - p.prevX;
      var my = p.y - p.prevY;
      if (mx || my) {
        for (var j = 0; j < this.actors.length; j++) {
          var a = this.actors[j];
          if (!a.dead && !a.exited && a.groundProp === p) {
            a.x += mx;
            a.y += my;
          }
        }
      }
    }
  };

  Game.prototype.updateSwitches = function (dt) {
    var groupOpen = {};
    var i, j, a;
    for (i = 0; i < this.levers.length; i++) {
      if (this.levers[i].on) groupOpen[this.levers[i].group] = true;
    }
    for (i = 0; i < this.plates.length; i++) {
      var plate = this.plates[i];
      var pressed = false;
      for (j = 0; j < this.actors.length; j++) {
        a = this.actors[j];
        if (a.dead || a.exited) continue;
        if (a.onGround && Math.abs(a.y - plate.y) < 10 &&
            a.x + a.w / 2 > plate.x - plate.w / 2 &&
            a.x - a.w / 2 < plate.x + plate.w / 2) {
          pressed = true;
          break;
        }
      }
      if (pressed !== plate.pressed) {
        plate.pressed = pressed;
        this.emit({
          type: pressed ? 'plateOn' : 'plateOff',
          x: plate.x, y: plate.y
        });
      }
      if (pressed) groupOpen[plate.group] = true;
    }

    for (i = 0; i < this.doors.length; i++) {
      var d = this.doors[i];
      var target = groupOpen[d.group] ? 1 : 0;
      var wasSolid = d.open < 0.72;
      if (d.open < target) d.open = Math.min(1, d.open + dt * 2.8);
      else if (d.open > target) d.open = Math.max(0, d.open - dt * 2.8);
      var nowSolid = d.open < 0.72;
      if (nowSolid !== wasSolid) {
        d.solidNow = nowSolid;
        this.emit({
          type: nowSolid ? 'doorClose' : 'doorOpen',
          x: d.x + d.w / 2, y: d.y + d.h / 2
        });
        if (nowSolid) this.pushActorsOut(d);
      }
    }
  };

  Game.prototype.collectSolids = function () {
    var solids = [];
    var i;
    for (i = 0; i < this.doors.length; i++) {
      var d = this.doors[i];
      if (d.open < 0.72) {
        solids.push({ l: d.x, r: d.x + d.w, t: d.y, b: d.y + d.h, door: d });
      }
    }
    for (i = 0; i < this.platforms.length; i++) {
      var p = this.platforms[i];
      solids.push({ l: p.x, r: p.x + p.w, t: p.y, b: p.y + p.h, platform: p });
    }
    return solids;
  };

  Game.prototype.freeAt = function (a, x, y) {
    var r = { l: x - a.w / 2, r: x + a.w / 2, t: y - a.h, b: y };
    var c0 = Math.floor(r.l / TILE), c1 = Math.floor((r.r - 0.01) / TILE);
    var r0 = Math.floor(r.t / TILE), r1 = Math.floor((r.b - 0.01) / TILE);
    for (var row = r0; row <= r1; row++) {
      for (var col = c0; col <= c1; col++) {
        if (this.isSolidTile(col, row)) return false;
      }
    }
    return true;
  };

  Game.prototype.pushActorsOut = function (d) {
    var dr = { l: d.x, r: d.x + d.w, t: d.y, b: d.y + d.h };
    for (var i = 0; i < this.actors.length; i++) {
      var a = this.actors[i];
      if (a.dead || a.exited) continue;
      if (!overlaps(actorRect(a), dr)) continue;
      var leftX = d.x - a.w / 2 - 2;
      var rightX = d.x + d.w + a.w / 2 + 2;
      if (this.freeAt(a, leftX, a.y)) a.x = leftX;
      else if (this.freeAt(a, rightX, a.y)) a.x = rightX;
      else this.hurtActor(a, a.x < d.x + d.w / 2 ? 1 : -1);
    }
  };

  /* ------------------------------------------------------------- движение */

  Game.prototype.onLadder = function (a) {
    var col = Math.floor(a.x / TILE);
    var rowMid = Math.floor((a.y - a.h * 0.55) / TILE);
    var rowLow = Math.floor((a.y - 4) / TILE);
    return this.getTile(col, rowMid) === 'L' || this.getTile(col, rowLow) === 'L';
  };

  Game.prototype.bjornPlatform = function () {
    var o = this.actorById('bjorn');
    if (!o || !o.shieldUp || o.dead || o.exited) return null;
    return { l: o.x - 20, r: o.x + 20, t: o.y - o.h - 6 };
  };

  Game.prototype.moveActor = function (a, dt) {
    a.onBjorn = false;
    var dx = a.vx * dt;
    if (dx !== 0) {
      a.x += dx;
      this.resolveX(a);
    }
    var prevFeet = a.y;
    var dy = a.vy * dt;
    a.onGround = false;
    a.groundProp = null;

    if (dy > 0 && a.id !== 'bjorn') {
      var op = this.bjornPlatform();
      if (op && a.x + a.w / 2 > op.l && a.x - a.w / 2 < op.r &&
          prevFeet <= op.t + 3 && prevFeet + dy >= op.t) {
        a.y = op.t;
        a.vy = 0;
        a.onGround = true;
        a.onBjorn = true;
        dy = 0;
      }
    }
    if (dy !== 0) {
      a.y += dy;
      this.resolveY(a);
    }
  };

  Game.prototype.resolveX = function (a) {
    var r = actorRect(a);
    var c0 = Math.floor(r.l / TILE), c1 = Math.floor((r.r - 0.01) / TILE);
    var r0 = Math.floor(r.t / TILE), r1 = Math.floor((r.b - 0.01) / TILE);
    var edge = null;
    var row, col;
    for (row = r0; row <= r1; row++) {
      for (col = c0; col <= c1; col++) {
        if (!this.isSolidTile(col, row)) continue;
        if (a.vx > 0) {
          if (edge === null || col * TILE < edge) edge = col * TILE;
        } else if (a.vx < 0) {
          if (edge === null || (col + 1) * TILE > edge) edge = (col + 1) * TILE;
        }
      }
    }
    if (edge !== null) {
      a.x = a.vx > 0 ? edge - a.w / 2 : edge + a.w / 2;
      a.vx = 0;
    }
    for (var i = 0; i < this.solids.length; i++) {
      var s = this.solids[i];
      var rr = actorRect(a);
      if (rr.l < s.r && rr.r > s.l && rr.t < s.b && rr.b > s.t) {
        if (a.vx > 0) a.x = s.l - a.w / 2;
        else if (a.vx < 0) a.x = s.r + a.w / 2;
        a.vx = 0;
        break;
      }
    }
  };

  Game.prototype.resolveY = function (a) {
    var r = actorRect(a);
    var c0 = Math.floor(r.l / TILE), c1 = Math.floor((r.r - 0.01) / TILE);
    var r0 = Math.floor(r.t / TILE), r1 = Math.floor((r.b - 0.01) / TILE);
    var land = Infinity;
    var ceil = -Infinity;
    var landProp = null;
    var row, col;
    for (row = r0; row <= r1; row++) {
      for (col = c0; col <= c1; col++) {
        if (!this.isSolidTile(col, row)) continue;
        if (a.vy > 0) {
          land = Math.min(land, row * TILE);
        } else if (a.vy < 0) {
          ceil = Math.max(ceil, (row + 1) * TILE);
        }
      }
    }
    for (var i = 0; i < this.solids.length; i++) {
      var s = this.solids[i];
      if (r.l < s.r && r.r > s.l && r.t < s.b && r.b > s.t) {
        if (a.vy > 0) {
          if (s.t < land) {
            land = s.t;
            landProp = s.platform || null;
          }
        } else if (a.vy < 0) {
          if (s.b > ceil) ceil = s.b;
        }
      }
    }
    if (a.vy > 0 && land !== Infinity) {
      a.y = land;
      a.vy = 0;
      a.onGround = true;
      a.groundProp = landProp;
    } else if (a.vy < 0 && ceil !== -Infinity) {
      a.y = ceil + a.h;
      a.vy = 0;
    }
  };

  Game.prototype.updateCarried = function () {
    var o = this.actorById('bjorn');
    if (!o || !this.bjornPrev) return;
    var dx = o.x - this.bjornPrev.x;
    var dy = o.y - this.bjornPrev.y;
    if (dx === 0 && dy === 0) return;
    var plat = this.bjornPlatform();
    for (var i = 0; i < this.actors.length; i++) {
      var a = this.actors[i];
      if (a === o || !a.onBjorn || a.dead || a.exited) continue;
      if (!plat) {
        a.onBjorn = false;
        continue;
      }
      a.x += dx;
      a.y = plat.t;
      if (a.active) {
        a.y = plat.t;
      }
    }
  };

  /* ------------------------------------------------------------- актор */

  Game.prototype.updateActor = function (a, dt) {
    if (a.dead || a.exited) return;
    var inp = this.input;
    var chars = CHARS[a.id];
    var jumpHeld = !!inp.jump;
    var jumpPressed = jumpHeld && !this.prevInput.jump;
    var actionPressed = !!inp.action && !this.prevInput.action;
    var actionHeld = !!inp.action;
    var specialPressed = !!inp.special && !this.prevInput.special;
    var hookPressed = !!inp.hook && !this.prevInput.hook;
    a.aimUp = !!inp.up;

    if (a.id === 'gunnar' && a.hook) {
      this.updateHook(a, dt, hookPressed);
      return;
    }
    if (a.id === 'bjorn') a.shieldUp = actionHeld;
    else a.shieldUp = false;

    var onLadder = this.onLadder(a);
    if (onLadder && (inp.up || inp.down)) {
      a.state = 'climb';
      var climbDir = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      a.vx = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 70;
      a.vy = climbDir * LADDER_SPEED;
      if (a.vx !== 0) a.dir = a.vx > 0 ? 1 : -1;
      this.moveActor(a, dt);
      if (jumpPressed && chars.canJump) {
        a.vy = -chars.jump;
        a.y -= 2;
        this.emit({ type: 'jump', actor: a.id, x: a.x, y: a.y });
      }
      return;
    }

    var target = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * chars.speed;
    if (a.shieldUp) target *= 0.5;
    if (target !== 0) a.dir = target > 0 ? 1 : -1;
    var accel = a.onGround ? 2600 : 1700;
    a.vx = approach(a.vx, target, accel * dt);
    if (target === 0 && a.onGround) a.vx = approach(a.vx, 0, 3200 * dt);

    if (a.onGround) a.coyote = 0.1;
    else a.coyote = Math.max(0, a.coyote - dt);
    if (jumpPressed && chars.canJump && (a.onGround || a.coyote > 0)) {
      a.vy = -chars.jump;
      a.onGround = false;
      a.coyote = 0;
      this.emit({ type: 'jump', actor: a.id, x: a.x, y: a.y });
    }

    a.vy += GRAVITY * dt;
    if (a.vy > TERM_VEL) a.vy = TERM_VEL;
    if (a.id === 'snorri' && jumpHeld && !a.onGround && a.vy > 0) {
      a.vy = Math.min(a.vy, 110);
      a.glide = true;
    } else {
      a.glide = false;
    }
    if (a.id === 'bjorn' && a.shieldUp && a.vy > 0) {
      a.vy = Math.min(a.vy, 70);
    }

    var wasAir = !a.onGround;
    this.moveActor(a, dt);
    if (wasAir && a.onGround) {
      this.emit({ type: 'land', actor: a.id, x: a.x, y: a.y });
      this.camera.shake = Math.min(0.25, this.camera.shake + 0.06);
    }

    if (a.onGround && Math.abs(a.vx) > 40) {
      a.stepTimer -= dt;
      if (a.stepTimer <= 0) {
        a.stepTimer = 0.24;
        this.emit({ type: 'step', actor: a.id, x: a.x, y: a.y });
      }
    } else {
      a.stepTimer = 0;
    }

    if (a.id === 'snorri') {
      if (actionPressed && a.cooldown <= 0) this.doHeadbutt(a);
    } else if (a.id === 'gunnar') {
      if (actionPressed && a.cooldown <= 0) this.doSword(a);
      else if (specialPressed && a.cooldown <= 0) this.doBow(a);
      if (hookPressed) this.startHook(a);
    }

    if (a.attack) a.state = a.attack.kind === 'bow' ? 'shoot' : 'act';
    else if (a.state === 'hurt') { /* сохраняем */ }
    else if (a.onGround) a.state = Math.abs(a.vx) > 24 ? 'run' : 'idle';
    else a.state = a.vy < 0 ? 'jump' : 'fall';
    if (a.hook) a.state = 'hook';
  };

  Game.prototype.updateCamera = function (dt) {
    var a = this.activeActor();
    if (!a) return;
    var tx = clamp(a.x - VIEW_W / 2 + a.dir * 34, 0, Math.max(0, this.levelWidth() - VIEW_W));
    var ty = clamp(a.y - a.h / 2 - VIEW_H * 0.56, 0, Math.max(0, this.levelHeight() - VIEW_H));
    var k = 1 - Math.exp(-8 * dt);
    this.camera.x = lerp(this.camera.x, tx, k);
    this.camera.y = lerp(this.camera.y, ty, k);
  };

  /* ------------------------------------------------------------- способности */

  Game.prototype.enemyRect = function (e) {
    return { l: e.x - e.w / 2, r: e.x + e.w / 2, t: e.y - e.h, b: e.y };
  };

  Game.prototype.hitEnemies = function (box, dmg) {
    var hits = 0;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.active) continue;
      if (!overlaps(box, this.enemyRect(e))) continue;
      this.damageEnemy(e, dmg);
      hits++;
    }
    return hits;
  };

  Game.prototype.damageEnemy = function (e, dmg) {
    if (!e.active) return;
    e.hp -= dmg;
    e.hurtTimer = 0.18;
    if (e.hp <= 0) {
      e.active = false;
      this.emit({ type: 'enemyDie', x: e.x, y: e.y });
      this.runScore += 50;
      this.camera.shake = Math.min(0.4, this.camera.shake + 0.1);
    } else {
      this.emit({ type: 'enemyHit', x: e.x, y: e.y });
    }
  };

  Game.prototype.toggleLever = function (l) {
    l.on = !l.on;
    this.emit({ type: 'lever', x: l.x, y: l.y - l.h * 0.5 });
    this.camera.shake = Math.min(0.3, this.camera.shake + 0.07);
  };

  Game.prototype.doHeadbutt = function (a) {
    a.cooldown = 0.42;
    a.attack = { kind: 'headbutt', t: 0 };
    a.vx = a.dir * 190;
    var box = {
      l: a.dir > 0 ? a.x + a.w * 0.15 : a.x - a.w * 0.15 - 52,
      r: a.dir > 0 ? a.x + a.w * 0.15 + 52 : a.x - a.w * 0.15,
      t: a.y - a.h * 0.85,
      b: a.y - 2
    };
    this.emit({ type: 'headbutt', actor: a.id, x: a.x, y: a.y - a.h * 0.6 });
    this.camera.shake = Math.min(0.45, this.camera.shake + 0.14);

    var c0 = Math.floor(box.l / TILE), c1 = Math.floor((box.r - 0.01) / TILE);
    var r0 = Math.floor(box.t / TILE), r1 = Math.floor((box.b - 0.01) / TILE);
    for (var row = r0; row <= r1; row++) {
      for (var col = c0; col <= c1; col++) {
        if (this.getTile(col, row) === '=') {
          this.grid[row][col] = '.';
          this.emit({ type: 'break', x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
          this.camera.shake = Math.min(0.6, this.camera.shake + 0.12);
        }
      }
    }
    this.hitEnemies(box, 2);
  };

  Game.prototype.doSword = function (a) {
    a.cooldown = 0.34;
    a.attack = { kind: 'sword', t: 0 };
    var box = {
      l: a.dir > 0 ? a.x + a.w * 0.2 : a.x - a.w * 0.2 - 50,
      r: a.dir > 0 ? a.x + a.w * 0.2 + 50 : a.x - a.w * 0.2,
      t: a.y - a.h * 0.9,
      b: a.y - 2
    };
    this.emit({ type: 'sword', actor: a.id, x: a.x, y: a.y - a.h * 0.55 });
    this.hitEnemies(box, 1);
    for (var i = 0; i < this.levers.length; i++) {
      var l = this.levers[i];
      var lr = { l: l.x - l.w / 2, r: l.x + l.w / 2, t: l.y - l.h, b: l.y };
      if (overlaps(box, lr)) this.toggleLever(l);
    }
  };

  Game.prototype.doBow = function (a) {
    a.cooldown = 0.5;
    a.attack = { kind: 'bow', t: 0 };
    var p;
    if (a.aimUp) {
      p = {
        kind: 'arrow', x: a.x, y: a.y - a.h * 0.6,
        vx: 0, vy: -640, life: 1.5, dir: 0, owner: a.id
      };
    } else {
      p = {
        kind: 'arrow', x: a.x + a.dir * (a.w / 2 + 6), y: a.y - a.h * 0.58,
        vx: a.dir * 640, vy: 0, life: 1.5, dir: a.dir, owner: a.id
      };
    }
    this.projectiles.push(p);
    this.emit({ type: 'bow', actor: a.id, x: a.x, y: a.y - a.h * 0.6 });
  };

  Game.prototype.startHook = function (a) {
    if (a.hook) return;
    var dx = 0, dy = 0;
    if (this.input.up) dy = -1;
    else dx = a.dir;
    var sx = a.x + (dx === 0 ? 0 : dx * 10);
    var sy = a.y - a.h * 0.62;
    a.hook = {
      state: 'shoot', ax: sx, ay: sy, bx: sx, by: sy,
      vx: dx * 940, vy: dy * 940, dist: 0, maxDist: 7 * TILE,
      dirX: dx, dirY: dy
    };
    a.state = 'hook';
    a.vx = 0;
    a.vy = 0;
    this.emit({ type: 'hookShoot', actor: a.id, x: sx, y: sy });
  };

  Game.prototype.pointBlocked = function (x, y) {
    var col = Math.floor(x / TILE), row = Math.floor(y / TILE);
    if (this.isSolidTile(col, row)) return true;
    for (var i = 0; i < this.doors.length; i++) {
      var d = this.doors[i];
      if (d.open < 0.72 && x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h) return true;
    }
    for (var a = 0; a < this.anchors.length; a++) {
      var an = this.anchors[a];
      if (Math.abs(x - an.x) < 16 && Math.abs(y - an.y) < 16) return true;
    }
    return false;
  };

  Game.prototype.updateHook = function (a, dt, pressed) {
    var h = a.hook;
    if (!h) return;
    if (pressed || (h.state === 'attached' && this.input.jump)) {
      a.hook = null;
      a.state = 'fall';
      this.emit({ type: 'hookDetach', x: h.bx, y: h.by });
      return;
    }
    h.ax = a.x;
    h.ay = a.y - a.h * 0.62;
    if (h.state === 'shoot') {
      h.bx += h.vx * dt;
      h.by += h.vy * dt;
      h.dist += 940 * dt;
      if (this.pointBlocked(h.bx, h.by)) {
        h.state = 'attached';
        this.emit({ type: 'hookHit', x: h.bx, y: h.by });
        this.camera.shake = Math.min(0.3, this.camera.shake + 0.08);
        return;
      }
      if (h.dist > h.maxDist) {
        a.hook = null;
        a.state = 'fall';
        this.emit({ type: 'hookDetach', x: h.bx, y: h.by });
      }
      a.state = 'hook';
      return;
    }
    // подтягивание
    var dx = h.bx - a.x;
    var dy = h.by - (a.y - a.h * 0.55);
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 26) {
      a.hook = null;
      a.vy = -70;
      a.state = 'fall';
      this.emit({ type: 'hookDetach', x: h.bx, y: h.by });
      return;
    }
    var spd = 340;
    a.vx = dx / dist * spd;
    a.vy = dy / dist * spd;
    var ox = a.x, oy = a.y;
    a.onGround = false;
    this.moveActor(a, dt);
    if (Math.abs(a.x - ox) < 0.15 && Math.abs(a.y - oy) < 0.15) {
      a.hook = null;
      a.state = 'fall';
      this.emit({ type: 'hookDetach', x: h.bx, y: h.by });
      return;
    }
    a.state = 'hook';
  };

  /* ------------------------------------------------------------- снаряды */

  Game.prototype.updateProjectiles = function (dt) {
    var arr = this.projectiles;
    for (var i = arr.length - 1; i >= 0; i--) {
      var p = arr[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        arr.splice(i, 1);
        continue;
      }
      if (this.pointBlocked(p.x, p.y)) {
        this.emit({ type: 'arrowHit', x: p.x, y: p.y });
        arr.splice(i, 1);
        continue;
      }
      if (p.kind === 'arrow') {
        var hit = false;
        for (var j = 0; j < this.levers.length; j++) {
          var l = this.levers[j];
          if (p.x > l.x - l.w / 2 && p.x < l.x + l.w / 2 &&
              p.y > l.y - l.h && p.y < l.y) {
            this.toggleLever(l);
            this.emit({ type: 'arrowHit', x: p.x, y: p.y });
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (var k = 0; k < this.enemies.length; k++) {
            var e = this.enemies[k];
            if (!e.active) continue;
            var er = this.enemyRect(e);
            if (p.x > er.l && p.x < er.r && p.y > er.t && p.y < er.b) {
              this.damageEnemy(e, 1);
              this.emit({ type: 'arrowHit', x: p.x, y: p.y });
              hit = true;
              break;
            }
          }
        }
        if (hit) arr.splice(i, 1);
      } else {
        var act = this.activeActor();
        if (act && !act.dead && !act.exited) {
          var ar = actorRect(act);
          if (p.x > ar.l && p.x < ar.r && p.y > ar.t && p.y < ar.b) {
            if (act.id === 'bjorn' && act.shieldUp) {
              this.emit({ type: 'block', actor: act.id, x: p.x, y: p.y });
              this.camera.shake = Math.min(0.3, this.camera.shake + 0.06);
            } else {
              this.hurtActor(act, p.vx > 0 ? 1 : -1);
            }
            arr.splice(i, 1);
          }
        }
      }
    }
  };

  /* ------------------------------------------------------------- враги */

  Game.prototype.updateEnemies = function (dt) {
    var act = this.activeActor();
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.active) continue;
      e.anim += dt;
      if (e.hurtTimer > 0) e.hurtTimer -= dt;

      if (e.kind === 'bat') {
        var t = this.globalTime;
        e.x = e.homeX + Math.sin(t * 1.5 + e.homeY * 0.013) * Math.max(TILE, e.range);
        e.y = e.homeY - 46 + Math.sin(t * 2.2 + e.homeX * 0.01) * 20;
        e.dir = Math.cos(t * 1.5 + e.homeY * 0.013) >= 0 ? 1 : -1;
      } else {
        var speed = e.kind === 'thrower' ? 34 : 62;
        e.x += e.dir * speed * dt;
        if (Math.abs(e.x - e.homeX) > e.range) {
          e.x = e.homeX + e.dir * e.range;
          e.dir *= -1;
        }
        var aheadCol = Math.floor((e.x + e.dir * (e.w / 2 + 4)) / TILE);
        var bodyRow = Math.floor((e.y - e.h * 0.5) / TILE);
        var floorRow = Math.floor(e.y / TILE);
        if (this.isSolidTile(aheadCol, bodyRow) || !this.isSolidTile(aheadCol, floorRow)) {
          e.dir *= -1;
        }
        e.x = clamp(e.x, e.w / 2, this.levelWidth() - e.w / 2);
        if (e.kind === 'thrower' && act && !act.dead && !act.exited) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            var dx = act.x - e.x;
            var dy = act.y - e.y;
            if (Math.abs(dx) < 430 && Math.abs(dy) < 170) {
              e.dir = dx > 0 ? 1 : -1;
              this.projectiles.push({
                kind: 'shot', x: e.x + e.dir * 18, y: e.y - e.h * 0.55,
                vx: e.dir * 240, vy: 0, life: 2.2
              });
              e.shootTimer = 2.1;
            } else {
              e.shootTimer = 0.5;
            }
          }
        }
      }

      if (act && !act.dead && !act.exited && act.invuln <= 0) {
        if (overlaps(actorRect(act), this.enemyRect(e))) {
          this.hurtActor(act, act.x < e.x ? -1 : 1);
        }
      }
    }
  };

  /* ------------------------------------------------------------- подборы */

  Game.prototype.updatePickups = function (act) {
    var i, j;
    if (act && !act.dead && !act.exited) {
      var ar = actorRect(act);
      for (i = 0; i < this.runes.length; i++) {
        var r = this.runes[i];
        if (r.taken) continue;
        var rr = { l: r.x - r.w / 2, r: r.x + r.w / 2, t: r.y - r.h / 2, b: r.y + r.h / 2 };
        if (overlaps(ar, rr)) {
          r.taken = true;
          this.levelRunes++;
          this.runScore += 150;
          this.emit({ type: 'rune', x: r.x, y: r.y });
          this.camera.shake = Math.min(0.2, this.camera.shake + 0.05);
        }
      }

      if (this.exit) {
        var ex = { l: this.exit.x + 8, r: this.exit.x + this.exit.w - 8, t: this.exit.y + 8, b: this.exit.y + this.exit.h };
        if (overlaps(ar, ex)) {
          act.exited = true;
          act.active = false;
          act.vx = 0;
          act.vy = 0;
          act.shieldUp = false;
          act.hook = null;
          this.exit.collected = Math.min(3, this.exit.collected + 1);
          this.emit({ type: 'exit', actor: act.id, x: act.x, y: act.y });
          this.nextActor();
        }
      }
    }

    for (i = 0; i < this.actors.length; i++) {
      var a = this.actors[i];
      if (a.dead || a.exited) continue;
      var aRect = actorRect(a);
      for (j = 0; j < this.checkpoints.length; j++) {
        var cp = this.checkpoints[j];
        if (cp.active) continue;
        var cr = { l: cp.x - cp.w / 2, r: cp.x + cp.w / 2, t: cp.y - cp.h, b: cp.y };
        if (overlaps(aRect, cr)) this.activateCheckpoint(cp);
      }
    }
  };

  Game.prototype.activateCheckpoint = function (cp) {
    for (var i = 0; i < this.checkpoints.length; i++) this.checkpoints[i].active = false;
    cp.active = true;
    for (var k = 0; k < ORDER.length; k++) {
      var id = ORDER[k];
      var ox = cp.x + (k - 1) * 28;
      this.respawnPoints[id] = {
        x: clamp(ox, TILE, this.levelWidth() - TILE),
        y: cp.y
      };
    }
    this.emit({ type: 'checkpoint', x: cp.x, y: cp.y });
  };

  /* ------------------------------------------------------------- знаки и опасности */

  Game.prototype.updateSigns = function (act) {
    if (!act) return;
    for (var i = 0; i < this.signs.length; i++) {
      var s = this.signs[i];
      var dist = Math.abs(act.x - s.x) + Math.abs(act.y - s.y);
      s.near = dist < 170;
      if (!s.seen && dist < 85 && this.signCooldown <= 0) {
        s.seen = true;
        this.signCooldown = 2.5;
        var lang = (window.SAGA2 && SAGA2.i18n && SAGA2.i18n.getLang) ? SAGA2.i18n.getLang() : 'ru';
        var text = lang === 'en' ? (s.en || s.ru) : (s.ru || s.en);
        if (text) this.emit({ type: 'toast', text: text, tone: 'info' });
      }
    }
  };

  Game.prototype.updateHazards = function (a) {
    if (a.dead || a.exited) return;
    var r = actorRect(a);
    var c0 = Math.floor(r.l / TILE), c1 = Math.floor((r.r - 0.01) / TILE);
    var r0 = Math.floor(r.t / TILE), r1 = Math.floor((r.b - 0.01) / TILE);
    for (var row = r0; row <= r1; row++) {
      for (var col = c0; col <= c1; col++) {
        var ch = this.getTile(col, row);
        if (ch === '~') {
          this.killActor(a);
          return;
        }
        if (ch === '^' && a.invuln <= 0) {
          this.hurtActor(a, a.dir * -1);
          a.vy = -440;
        }
      }
    }
    if (a.y > this.levelHeight() + 120) this.killActor(a);
  };

  /* ------------------------------------------------------------- урон и смерть */

  Game.prototype.hurtActor = function (a, dir) {
    if (!a || a.dead || a.exited || a.invuln > 0) return;
    a.hp -= 1;
    a.invuln = 1.2;
    a.vx = (dir || 1) * 240;
    a.vy = -300;
    a.state = 'hurt';
    a.attack = null;
    if (a.hook) a.hook = null;
    this.camera.shake = Math.min(0.65, this.camera.shake + 0.25);
    this.emit({ type: 'hurt', actor: a.id, x: a.x, y: a.y });
    if (a.hp <= 0) this.killActor(a);
  };

  Game.prototype.killActor = function (a) {
    if (!a || a.dead) return;
    a.hp = 0;
    a.dead = true;
    a.exited = false;
    a.active = false;
    a.state = 'dead';
    a.respawnTimer = 1.4;
    a.invuln = 0;
    a.vx = 0;
    a.vy = 0;
    a.attack = null;
    a.shieldUp = false;
    a.hook = null;
    this.deaths++;
    this.levelDeaths++;
    this.camera.shake = Math.min(0.9, this.camera.shake + 0.5);
    this.emit({ type: 'death', actor: a.id, x: a.x, y: a.y });
    if (a.id === this.active) {
      this.active = '';
      for (var i = 0; i < ORDER.length; i++) {
        if (this.switchTo(ORDER[i])) break;
      }
    }
  };

  Game.prototype.respawnActor = function (a) {
    if (this.completed) return;
    var p = this.respawnPoints[a.id] || this.spawnPoints[a.id];
    if (!p) return;
    a.dead = false;
    a.hp = a.maxHp;
    a.x = p.x;
    a.y = p.y;
    a.vx = 0;
    a.vy = 0;
    a.invuln = 2;
    a.state = 'idle';
    a.attack = null;
    a.hook = null;
    a.shieldUp = false;
    a.onGround = false;
    if (!this.active) this.active = a.id;
    this.emit({ type: 'respawn', actor: a.id, x: a.x, y: a.y });
  };

  /* ------------------------------------------------------------- финиш уровня */

  Game.prototype.completeLevel = function () {
    if (this.completed) return;
    this.completed = true;
    var hearts = 0;
    for (var i = 0; i < this.actors.length; i++) {
      hearts += Math.max(0, this.actors[i].hp);
    }
    var bonus = Math.max(0, Math.round(900 - this.time * 8)) + hearts * 40 - this.levelDeaths * 30;
    if (bonus < 0) bonus = 0;
    this.runScore += bonus;
    var lv = this.level || {};
    var stats = {
      levelIndex: this.levelIndex,
      levelCount: this.levels.length,
      name: lv.name || '',
      nameEn: lv.nameEn || '',
      time: this.time,
      deaths: this.levelDeaths,
      runes: this.levelRunes,
      runesTotal: this.runesTotal,
      score: this.runScore - this.levelStartScore,
      totalScore: this.runScore,
      hasNext: this.levelIndex < this.levels.length - 1,
      music: lv.music || 0
    };
    this.levelStats = stats;
    this.emit({ type: 'levelComplete', x: this.exit ? this.exit.x : 0, y: this.exit ? this.exit.y : 0 });
    if (this.onLevelComplete) this.onLevelComplete(stats);
  };

  /* ------------------------------------------------------------- экспорт */

  SAGA2.Game = Game;
  SAGA2.consts = {
    TILE: TILE,
    VIEW_W: VIEW_W,
    VIEW_H: VIEW_H,
    ORDER: ORDER.slice(),
    CHARS: CHARS
  };
})();
