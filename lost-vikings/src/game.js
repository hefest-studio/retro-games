/* LOST VIKINGS · game core — физика, три викинга, головоломки.
   Владелец: Lead. Контракт: CONTRACT.md §§1–2, 6. */
(function () {
  "use strict";

  var T = 16, GW = 24, GH = 15;
  var WORLD_W = GW * T, WORLD_H = GH * T;
  var GRAV = 1400, TERM = 520;
  var ACTOR_W = 10, ACTOR_H = 22;
  var SHIELD_TOP = 30, SHIELD_HALF = 10;

  var SPEC = {
    erik:   { speed: 130, jump: 400 },
    baleog: { speed: 95,  jump: 330 },
    olaf:   { speed: 75,  jump: 260 }
  };
  var ORDER = ["erik", "baleog", "olaf"];

  var audio = null;
  var onEvent = function () {};
  var levels = [];

  var G = {
    mode: "idle",            // idle | playing | complete | dead
    paused: false,
    levelIndex: 0,
    level: null,
    theme: "cave",
    terrain: [],
    gates: [],
    plates: [],
    levers: [],
    traps: [],
    treasures: [],
    exits: [],
    enemies: [],
    actors: {},
    arrows: [],
    fx: [],
    activeId: "erik",
    held: { left: false, right: false, jump: false, action: false, down: false },
    jumpPressed: false,
    actionPressed: false,
    time: 0,
    t: 0,
    levelDeaths: 0,
    treasuresTaken: 0,
    treasuresTotal: 0,
    score: 0,
    deathTimer: 0,
    deathReason: "",
    deadActor: "",
    shake: 0,
    flash: 0,
    completed: false,
    groups: [false, false, false, false],
    wrongExitCd: 0,
    session: null,
    gateGrid: {},
    totalTreasureAvailable: 0
  };

  function emit(name, data) {
    try { onEvent(name, data || {}); } catch (e) { /* UI не должен ломать игру */ }
  }
  function sfx(name) {
    try { if (audio && audio.sfx) audio.sfx(name); } catch (e) {}
  }
  function jingle(name) {
    try { if (audio && audio.jingle) audio.jingle(name); } catch (e) {}
  }

  /* ───────────────────────── тайлы ───────────────────────── */

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= GW || ty < 0 || ty >= GH) return "#";
    return G.terrain[ty][tx];
  }
  function gateAt(tx, ty) {
    return G.gateGrid[tx + "," + ty] || null;
  }
  function isSolid(tx, ty) {
    var c = tileAt(tx, ty);
    if (c === "#" || c === "B") return true;
    var g = gateAt(tx, ty);
    if (g && !g.open) return true;
    return false;
  }
  function isOneWay(tx, ty) {
    return tileAt(tx, ty) === "=";
  }

  /* ───────────────────────── уровень ───────────────────────── */

  function resetDynamic() {
    G.terrain = [];
    G.gates = [];
    G.plates = [];
    G.levers = [];
    G.traps = [];
    G.treasures = [];
    G.exits = [];
    G.enemies = [];
    G.arrows = [];
    G.fx = [];
    G.gateGrid = {};
    G.groups = [false, false, false, false];
    G.treasuresTaken = 0;
    G.treasuresTotal = 0;
    G.score = 0;
    G.time = 0;
    G.completed = false;
    G.wrongExitCd = 0;
    G.deathTimer = 0;
    G.deathReason = "";
    G.deadActor = "";
    G.shake = 0;
    G.flash = 0;
    G.held = { left: false, right: false, jump: false, action: false, down: false };
    G.jumpPressed = false;
    G.actionPressed = false;
  }

  function makeActor(id, tx, ty) {
    return {
      id: id,
      x: tx * T + T / 2,
      y: ty * T + T,
      vx: 0,
      vy: 0,
      dir: 1,
      onGround: false,
      alive: true,
      gone: false,
      dead: false,
      state: "idle",
      anim: Math.random() * 2,
      braced: false,
      coyote: 0,
      jumpBuf: 0,
      dropTimer: 0,
      cooldown: 0,
      actTimer: 0,
      actKind: "",
      invuln: 0
    };
  }

  function parseLevel(level) {
    var starts = {};
    var rows = (level && level.rows) || [];
    for (var y = 0; y < GH; y++) {
      var row = rows[y] || "";
      var line = [];
      for (var x = 0; x < GW; x++) {
        var c = row.charAt(x) || ".";
        switch (c) {
          case "#": case "B": case "=": case "^": case ".":
            line.push(c);
            break;
          case "a": case "b": case "c": case "d":
            G.gates.push({ x: x, y: y, group: c.charCodeAt(0) - 97, open: false, anim: 0 });
            G.gateGrid[x + "," + y] = G.gates[G.gates.length - 1];
            line.push(".");
            break;
          case "1": case "2": case "3": case "4":
            G.plates.push({ x: x, y: y, group: c.charCodeAt(0) - 49, pressed: false });
            line.push(".");
            break;
          case "5": case "6": case "7": case "8":
            G.levers.push({ x: x, y: y, group: c.charCodeAt(0) - 53, on: false, anim: 0 });
            line.push(".");
            break;
          case "<":
            G.traps.push({ x: x, y: y, dir: -1, timer: 0.7 + G.traps.length * 0.45 });
            line.push(".");
            break;
          case ">":
            G.traps.push({ x: x, y: y, dir: 1, timer: 1.1 + G.traps.length * 0.45 });
            line.push(".");
            break;
          case "*":
            G.treasures.push({ x: x, y: y, taken: false });
            G.treasuresTotal++;
            line.push(".");
            break;
          case "M":
            G.enemies.push({
              x: x * T + T / 2, y: y * T + T, vx: 0, vy: 0, dir: -1,
              alive: true, state: "walk", anim: Math.random() * 2, deadTimer: 0, onGround: false
            });
            line.push(".");
            break;
          case "E": starts.erik = { tx: x, ty: y }; line.push("."); break;
          case "&": starts.baleog = { tx: x, ty: y }; line.push("."); break;
          case "O": starts.olaf = { tx: x, ty: y }; line.push("."); break;
          case "X": {
            var exitWho = ["erik", "baleog", "olaf"][G.exits.length];
            if (level && level.exitFor && level.exitFor[G.exits.length]) exitWho = level.exitFor[G.exits.length];
            G.exits.push({ x: x, y: y, filledBy: null, anim: Math.random() * 6, who: exitWho });
            line.push(".");
            break;
          }
          default:
            line.push(".");
        }
      }
      G.terrain.push(line);
    }

    G.actors = {};
    for (var i = 0; i < ORDER.length; i++) {
      var id = ORDER[i];
      var st = starts[id] || { tx: 1 + i * 2, ty: GH - 3 };
      G.actors[id] = makeActor(id, st.tx, st.ty);
    }

    // страховка: не даём старту застрять в твёрдом тайле
    for (var k = 0; k < ORDER.length; k++) {
      var a = G.actors[ORDER[k]];
      if (isSolid(Math.floor(a.x / T), Math.floor((a.y - 1) / T))) {
        a.y = Math.floor(a.y / T) * T;
      }
    }
  }

  function startLevel(index, keepDeaths) {
    if (!levels.length) return;
    index = Math.max(0, Math.min(levels.length - 1, index | 0));
    G.levelIndex = index;
    G.level = levels[index];
    G.theme = (G.level && G.level.theme) || "cave";
    G.mode = "playing";
    G.paused = false;
    G.activeId = "erik";
    resetDynamic();
    if (!keepDeaths) G.levelDeaths = 0;
    parseLevel(G.level);
    if (!G.session) resetSession();
    try { if (audio && audio.startMusic) audio.startMusic("game"); } catch (e) {}
    try { if (audio && audio.setGameTrack) audio.setGameTrack(index % 2); } catch (e) {}
    emit("levelStart", { index: index, level: G.level });
  }

  function restartLevel() {
    startLevel(G.levelIndex, true);
    emit("restart", { index: G.levelIndex, deaths: G.levelDeaths });
  }

  function resetSession() {
    G.session = { deaths: 0, treasure: 0, score: 0, time: 0, completedLevels: 0 };
    G.totalTreasureAvailable = 0;
    for (var i = 0; i < levels.length; i++) {
      var cnt = 0, rows = (levels[i] && levels[i].rows) || [];
      for (var y = 0; y < rows.length; y++) {
        for (var x = 0; x < rows[y].length; x++) if (rows[y].charAt(x) === "*") cnt++;
      }
      G.totalTreasureAvailable += cnt;
    }
    emit("sessionReset", { session: G.session, totalTreasures: G.totalTreasureAvailable });
  }

  /* ───────────────────────── ввод ───────────────────────── */

  function setActive(id) {
    var a = G.actors[id];
    if (!a || !a.alive || a.gone || a.dead) return false;
    if (G.activeId === id) return true;
    G.activeId = id;
    sfx("switch");
    emit("switch", { id: id });
    return true;
  }

  function cycleActive() {
    var start = ORDER.indexOf(G.activeId);
    for (var i = 1; i <= ORDER.length; i++) {
      var id = ORDER[(start + i) % ORDER.length];
      if (setActive(id)) return id;
    }
    return G.activeId;
  }

  function input(action, down) {
    down = !!down;
    if (action === "left" || action === "right" || action === "jump" || action === "action" || action === "down") {
      if (down && !G.held[action]) {
        if (action === "jump") G.jumpPressed = true;
        if (action === "action") G.actionPressed = true;
      }
      G.held[action] = down;
      if (action === "action" && !down && G.actors.olaf && G.activeId === "olaf") G.actors.olaf.braced = false;
      return;
    }
    if (!down) return;
    if (action === "switch") { cycleActive(); return; }
    if (action === "switch1") setActive("erik");
    else if (action === "switch2") setActive("baleog");
    else if (action === "switch3") setActive("olaf");
  }

  function actionTileFront(a, dy) {
    var fx = a.x + a.dir * (ACTOR_W / 2 + 1);
    var fy = a.y - (dy == null ? 11 : dy);
    return { tx: Math.floor(fx / T), ty: Math.floor(fy / T) };
  }

  function leverNear(a, range) {
    var fx = a.x + a.dir * range;
    for (var i = 0; i < G.levers.length; i++) {
      var lv = G.levers[i];
      var lx = lv.x * T + T / 2, ly = lv.y * T + T / 2;
      if (Math.abs(lx - fx) <= T * 0.9 && Math.abs(ly - (a.y - 10)) <= T * 1.1) return lv;
    }
    return null;
  }

  function toggleLever(lv) {
    lv.on = !lv.on;
    lv.anim = 0;
    sfx("lever");
    addFx("spark", lv.x * T + T / 2, lv.y * T + T / 2, 0.35);
    emit("lever", { x: lv.x, y: lv.y, on: lv.on });
  }

  function shootArrow(a) {
    G.arrows.push({
      x: a.x + a.dir * 7,
      y: a.y - 13,
      dir: a.dir,
      vx: a.dir * 300,
      vy: 0,
      hostile: false,
      life: 2.2
    });
    sfx("arrow");
    addFx("spark", a.x + a.dir * 9, a.y - 13, 0.2);
  }

  function triggerAction(a) {
    if (!a || !a.alive || a.gone || a.dead || G.mode !== "playing") return;
    if (a.cooldown > 0) return;
    if (a.id === "erik") {
      a.actKind = "headbutt";
      a.actTimer = 0.18;
      a.cooldown = 0.5;
      a.state = "act";
    } else if (a.id === "baleog") {
      a.actKind = "shoot";
      a.actTimer = 0.18;
      a.cooldown = 0.35;
      a.state = "act";
      shootArrow(a);
      for (var i = 0; i < G.enemies.length; i++) {
        var e = G.enemies[i];
        if (!e.alive) continue;
        var dx = (e.x - a.x) * a.dir;
        if (dx > -4 && dx < 26 && Math.abs(e.y - a.y) < 22) killEnemy(e);
      }
    }
  }

  /* ───────────────────────── физика ───────────────────────── */

  function spikeOverlap(a) {
    var tx0 = Math.floor((a.x - ACTOR_W / 2 + 1) / T), tx1 = Math.floor((a.x + ACTOR_W / 2 - 1) / T);
    var ty0 = Math.floor((a.y - ACTOR_H + 1) / T), ty1 = Math.floor((a.y - 1) / T);
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        if (tileAt(tx, ty) === "^") return true;
      }
    }
    return false;
  }

  function moveHorizontal(a, dt) {
    var oldX = a.x;
    a.x += a.vx * dt;
    if (a.x < ACTOR_W / 2 + 1) { a.x = ACTOR_W / 2 + 1; a.vx = 0; }
    if (a.x > WORLD_W - ACTOR_W / 2 - 1) { a.x = WORLD_W - ACTOR_W / 2 - 1; a.vx = 0; }
    var left = a.x - ACTOR_W / 2, right = a.x + ACTOR_W / 2;
    var ty0 = Math.floor((a.y - ACTOR_H + 1) / T), ty1 = Math.floor((a.y - 1) / T);
    var tx, ty;
    if (a.vx > 0) {
      tx = Math.floor(right / T);
      for (ty = ty0; ty <= ty1; ty++) {
        if (isSolid(tx, ty)) { a.x = tx * T - ACTOR_W / 2 - 0.01; a.vx = 0; break; }
      }
    } else if (a.vx < 0) {
      tx = Math.floor(left / T);
      for (ty = ty0; ty <= ty1; ty++) {
        if (isSolid(tx, ty)) { a.x = (tx + 1) * T + ACTOR_W / 2 + 0.01; a.vx = 0; break; }
      }
    }
    if (a.x === oldX) a.vx = 0;
  }

  function olafBraced() {
    var o = G.actors.olaf;
    return !!(o && o.alive && !o.gone && !o.dead && o.braced);
  }

  function standOnShield(a, prevBottom, bottom) {
    if (a.id === "olaf" || !olafBraced()) return false;
    if (a.vy < 0) return false;
    var o = G.actors.olaf;
    var top = o.y - SHIELD_TOP;
    if (a.x + ACTOR_W / 2 <= o.x - SHIELD_HALF || a.x - ACTOR_W / 2 >= o.x + SHIELD_HALF) return false;
    if (prevBottom <= top + 0.6 && bottom >= top) {
      a.y = top;
      a.vy = 0;
      a.onGround = true;
      return true;
    }
    return false;
  }

  function moveVertical(a, dt) {
    var prevBottom = a.y;
    a.y += a.vy * dt;
    var top = a.y - ACTOR_H, bottom = a.y;
    var landed = false;

    if (a.vy < 0) {
      var tx0 = Math.floor((a.x - ACTOR_W / 2 + 1) / T), tx1 = Math.floor((a.x + ACTOR_W / 2 - 1) / T);
      var ty = Math.floor(top / T);
      for (var tx = tx0; tx <= tx1; tx++) {
        if (isSolid(tx, ty)) {
          a.y = (ty + 1) * T + ACTOR_H;
          a.vy = 0;
          break;
        }
      }
      a.onGround = false;
    } else {
      var left = a.x - ACTOR_W / 2 + 1, right = a.x + ACTOR_W / 2 - 1;
      var bx0 = Math.floor(left / T), bx1 = Math.floor(right / T);
      var by = Math.floor(bottom / T);
      for (var bx = bx0; bx <= bx1; bx++) {
        var tile = tileAt(bx, by);
        var solid = isSolid(bx, by);
        var oneway = tile === "=" && a.dropTimer <= 0;
        if ((solid || oneway) && prevBottom <= by * T + 0.6) {
          a.y = by * T;
          a.vy = 0;
          a.onGround = true;
          landed = true;
          break;
        }
      }
      if (!landed && standOnShield(a, prevBottom, bottom)) landed = true;
      if (!landed) a.onGround = false;
    }

    if (a.y - ACTOR_H > WORLD_H + 40) killActor(a, "fall");
  }

  function standingOnPlatform(a) {
    var ty = Math.floor((a.y + 1) / T);
    var tx0 = Math.floor((a.x - ACTOR_W / 2 + 1) / T), tx1 = Math.floor((a.x + ACTOR_W / 2 - 1) / T);
    for (var tx = tx0; tx <= tx1; tx++) if (isOneWay(tx, ty)) return true;
    return false;
  }

  function updateActor(a, dt, isActive) {
    if (!a.alive || a.gone || a.dead) return;

    a.anim += dt;
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.dropTimer = Math.max(0, a.dropTimer - dt);
    a.invuln = Math.max(0, a.invuln - dt);
    if (a.jumpBuf > 0) a.jumpBuf -= dt;

    if (a.actTimer > 0) {
      a.actTimer -= dt;
      if (a.actTimer <= 0) resolveAction(a);
    }

    var speed = SPEC[a.id].speed;
    var move = 0;
    if (isActive && G.mode === "playing") {
      if (a.id === "olaf") a.braced = G.held.action && a.onGround;
      if (a.id !== "olaf" || !a.braced) {
        if (G.held.left) move -= 1;
        if (G.held.right) move += 1;
      }
    } else if (a.id === "olaf") {
      // Олаф держит щит, даже когда управляем другим викингом.
      if (!a.onGround) a.braced = false;
    }

    a.vx = move * speed;
    if (move !== 0) a.dir = move > 0 ? 1 : -1;

    if (isActive && a.jumpBuf > 0 && (a.onGround || a.coyote > 0)) {
      if (G.held.down && standingOnPlatform(a)) {
        a.dropTimer = 0.22;
        a.jumpBuf = 0;
      } else {
        a.vy = -SPEC[a.id].jump;
        a.onGround = false;
        a.coyote = 0;
        a.jumpBuf = 0;
        sfx("jump");
        addFx("dust", a.x, a.y, 0.3);
      }
    }

    if (!a.onGround) a.vy = Math.min(TERM, a.vy + GRAV * dt);
    else if (a.vy > 0) a.vy = 0;

    moveHorizontal(a, dt);
    moveVertical(a, dt);

    if (a.onGround) a.coyote = 0.08;
    else a.coyote = Math.max(0, a.coyote - dt);

    if (a.dead) a.state = "dead";
    else if (a.gone) a.state = "gone";
    else if (a.braced) a.state = "brace";
    else if (a.actTimer > 0) a.state = "act";
    else if (!a.onGround) a.state = a.vy < 0 ? "jump" : "fall";
    else if (Math.abs(a.vx) > 1) a.state = "run";
    else a.state = "idle";

    if (spikeOverlap(a)) killActor(a, "spikes");
  }

  function resolveAction(a) {
    if (!a.alive || a.gone) return;
    if (a.actKind === "headbutt") {
      // таран бьёт кирпич на уровне корпуса или головы (стопка из двух ломается за два удара)
      var fx = a.x + a.dir * (ACTOR_W / 2 + 1);
      var tx = Math.floor(fx / T);
      var rows = [Math.floor((a.y - 11) / T), Math.floor((a.y - 20) / T)];
      var broke = false;
      for (var ri = 0; ri < rows.length; ri++) {
        var tyy = rows[ri];
        if (tileAt(tx, tyy) === "B") {
          G.terrain[tyy][tx] = ".";
          sfx("break");
          addFx("break", tx * T + T / 2, tyy * T + T / 2, 0.55);
          G.shake = Math.min(1, G.shake + 0.45);
          G.flash = Math.min(1, G.flash + 0.25);
          emit("break", { x: tx, y: tyy });
          broke = true;
          break;
        }
      }
      if (!broke) {
        sfx("headbutt");
        addFx("dust", a.x + a.dir * 8, a.y - 12, 0.3);
        G.shake = Math.min(1, G.shake + 0.12);
      }
      a.vx = -a.dir * 40;
    }
    a.actKind = "";
  }

  /* ───────────────────────── враги, стрелы, ловушки ───────────────────────── */

  function killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    e.state = "die";
    e.deadTimer = 0.45;
    sfx("sword");
    addFx("hit", e.x, e.y - 10, 0.4);
    G.shake = Math.min(1, G.shake + 0.2);
    emit("enemyDown", { x: e.x, y: e.y });
  }

  function updateEnemies(dt) {
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.alive) {
        e.deadTimer -= dt;
        e.anim += dt;
        continue;
      }
      e.anim += dt;
      var aheadX = e.x + e.dir * (T * 0.55);
      var footTileX = Math.floor(aheadX / T);
      var footTileY = Math.floor((e.y + 4) / T);
      var groundAhead = isSolid(footTileX, footTileY) || isOneWay(footTileX, footTileY) || !!gateAt(footTileX, footTileY);
      var wallAhead = isSolid(Math.floor((e.x + e.dir * 12) / T), Math.floor((e.y - 10) / T));
      if (e.onGround && (!groundAhead || wallAhead)) e.dir *= -1;

      e.vx = e.dir * 38;
      var prevX = e.x;
      e.x += e.vx * dt;
      var tx = Math.floor((e.x + e.dir * 6) / T);
      var ty0 = Math.floor((e.y - 20) / T), ty1 = Math.floor((e.y - 1) / T);
      for (var ty = ty0; ty <= ty1; ty++) {
        if (isSolid(tx, ty)) { e.x = prevX; e.dir *= -1; e.vx = 0; break; }
      }
      if (e.x < 10 || e.x > WORLD_W - 10) { e.dir *= -1; e.x = Math.max(10, Math.min(WORLD_W - 10, e.x)); }

      e.vy = Math.min(TERM, e.vy + GRAV * dt);
      var prevBottom = e.y;
      e.y += e.vy * dt;
      e.onGround = false;
      var by = Math.floor(e.y / T);
      var bx0 = Math.floor((e.x - 4) / T), bx1 = Math.floor((e.x + 4) / T);
      for (var bx = bx0; bx <= bx1; bx++) {
        if ((isSolid(bx, by) || isOneWay(bx, by)) && prevBottom <= by * T + 0.6) {
          e.y = by * T; e.vy = 0; e.onGround = true; break;
        }
      }
      if (e.y > WORLD_H + 40) e.alive = false;

      for (var j = 0; j < ORDER.length; j++) {
        var a = G.actors[ORDER[j]];
        if (!a || !a.alive || a.gone || a.dead) continue;
        if (Math.abs(a.x - e.x) < 9 && Math.abs(a.y - e.y) < 20) killActor(a, "enemy");
      }
    }
  }

  function updateTraps(dt) {
    for (var i = 0; i < G.traps.length; i++) {
      var tr = G.traps[i];
      tr.timer -= dt;
      if (tr.timer <= 0) {
        tr.timer = 2.2;
        var ax = tr.x * T + T / 2 + tr.dir * 8;
        var ay = tr.y * T + T / 2;
        var wallX = Math.floor((ax + tr.dir * 9) / T);
        if (!isSolid(wallX, Math.floor(ay / T))) {
          G.arrows.push({ x: ax, y: ay, dir: tr.dir, vx: tr.dir * 150, vy: 0, hostile: true, life: 4 });
          sfx("trap");
        }
      }
    }
  }

  function updateArrows(dt) {
    for (var i = G.arrows.length - 1; i >= 0; i--) {
      var ar = G.arrows[i];
      ar.life -= dt;
      ar.x += ar.vx * dt;
      ar.y += ar.vy * dt;
      if (ar.life <= 0 || ar.x < -10 || ar.x > WORLD_W + 10) { G.arrows.splice(i, 1); continue; }

      var cx = Math.floor(ar.x / T), cy = Math.floor(ar.y / T);
      if (isSolid(cx, cy)) {
        G.arrows.splice(i, 1);
        addFx("spark", ar.x, ar.y, 0.2);
        continue;
      }

      if (ar.hostile) {
        var o = G.actors.olaf;
        if (olafBraced()) {
          if (ar.x > o.x - SHIELD_HALF - 6 && ar.x < o.x + SHIELD_HALF + 6 &&
              ar.y > o.y - SHIELD_TOP - 6 && ar.y < o.y - 6) {
            G.arrows.splice(i, 1);
            addFx("spark", ar.x, ar.y, 0.35);
            continue;
          }
        }
        var hit = false;
        for (var j = 0; j < ORDER.length; j++) {
          var a = G.actors[ORDER[j]];
          if (!a || !a.alive || a.gone || a.dead) continue;
          if (Math.abs(a.x - ar.x) < 6 && ar.y > a.y - ACTOR_H && ar.y < a.y) {
            hit = true;
            killActor(a, "arrow");
            break;
          }
        }
        if (hit) { G.arrows.splice(i, 1); continue; }
      } else {
        var killed = false;
        for (var k = 0; k < G.enemies.length; k++) {
          var e = G.enemies[k];
          if (!e.alive) continue;
          if (Math.abs(e.x - ar.x) < 8 && ar.y > e.y - 21 && ar.y < e.y) {
            killEnemy(e);
            killed = true;
            break;
          }
        }
        if (killed) { G.arrows.splice(i, 1); continue; }
        for (var l = 0; l < G.levers.length; l++) {
          if (G.levers[l].x === cx && G.levers[l].y === cy) {
            toggleLever(G.levers[l]);
            G.arrows.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  function updatePlatesAndGates(dt) {
    var i, p;
    for (i = 0; i < G.plates.length; i++) G.plates[i].pressed = false;
    for (i = 0; i < G.plates.length; i++) {
      p = G.plates[i];
      var px0 = p.x * T, px1 = px0 + T, py1 = (p.y + 1) * T;
      for (var j = 0; j < ORDER.length; j++) {
        var a = G.actors[ORDER[j]];
        if (!a || !a.alive || a.gone || a.dead) continue;
        if (a.x + ACTOR_W / 2 > px0 + 2 && a.x - ACTOR_W / 2 < px1 - 2 &&
            Math.abs(a.y - py1) <= 3) {
          p.pressed = true;
          break;
        }
      }
    }
    for (i = 0; i < 4; i++) {
      var pressed = false;
      for (var k = 0; k < G.plates.length; k++) if (G.plates[k].group === i && G.plates[k].pressed) pressed = true;
      var leverOn = false;
      for (var l = 0; l < G.levers.length; l++) if (G.levers[l].group === i && G.levers[l].on) leverOn = true;
      G.groups[i] = pressed || leverOn;
    }
    for (i = 0; i < G.gates.length; i++) {
      var g = G.gates[i];
      var want = G.groups[g.group];
      if (want !== g.open) {
        g.open = want;
        sfx("gate");
        addFx("spark", g.x * T + T / 2, g.y * T + T / 2, 0.3);
      }
      var target = g.open ? 1 : 0;
      g.anim += (target - g.anim) * Math.min(1, dt * 12);
      if (Math.abs(g.anim - target) < 0.01) g.anim = target;
    }
    for (i = 0; i < G.levers.length; i++) {
      var lv = G.levers[i];
      var lt = lv.on ? 1 : 0;
      lv.anim += (lt - lv.anim) * Math.min(1, dt * 12);
    }
  }

  /* ───────────────────────── сокровища / выходы ───────────────────────── */

  function collectTreasures() {
    for (var i = 0; i < G.treasures.length; i++) {
      var tr = G.treasures[i];
      if (tr.taken) continue;
      for (var j = 0; j < ORDER.length; j++) {
        var a = G.actors[ORDER[j]];
        if (!a || !a.alive || a.gone || a.dead) continue;
        if (Math.abs(a.x - (tr.x * T + T / 2)) < 9 &&
            a.y > tr.y * T && a.y - ACTOR_H < tr.y * T + T) {
          tr.taken = true;
          G.treasuresTaken++;
          G.score += 100;
          sfx("treasure");
          addFx("pickup", tr.x * T + T / 2, tr.y * T + T / 2, 0.5);
          emit("treasure", { x: tr.x, y: tr.y, taken: G.treasuresTaken, total: G.treasuresTotal });
          break;
        }
      }
    }
  }

  function firstAliveId() {
    for (var i = 0; i < ORDER.length; i++) {
      var a = G.actors[ORDER[i]];
      if (a && a.alive && !a.gone && !a.dead) return ORDER[i];
    }
    return null;
  }

  function checkExits() {
    for (var i = 0; i < G.exits.length; i++) {
      var ex = G.exits[i];
      if (ex.filledBy) continue;
      for (var j = 0; j < ORDER.length; j++) {
        var a = G.actors[ORDER[j]];
        if (!a || !a.alive || a.gone || a.dead) continue;
        if (Math.abs(a.x - (ex.x * T + T / 2)) < 9 &&
            a.y > ex.y * T + 2 && a.y - ACTOR_H < ex.y * T + T) {
          if (ex.who && a.id !== ex.who) {
            if (G.wrongExitCd <= 0) {
              G.wrongExitCd = 1.6;
              sfx("click");
              emit("wrongExit", { actor: a.id, who: ex.who, x: ex.x, y: ex.y });
            }
            continue;
          }
          a.gone = true;
          a.state = "gone";
          a.vx = 0;
          a.vy = 0;
          ex.filledBy = a.id;
          G.score += 250;
          sfx("exit");
          addFx("level", ex.x * T + T / 2, ex.y * T + T / 2, 0.8);
          emit("exit", { id: a.id, x: ex.x, y: ex.y });
          if (G.activeId === a.id) {
            var n = firstAliveId();
            if (n) setActive(n);
          }
          break;
        }
      }
    }
    var allGone = true;
    for (var k = 0; k < ORDER.length; k++) {
      var ac = G.actors[ORDER[k]];
      if (!ac.gone) allGone = false;
    }
    if (allGone && G.mode === "playing") completeLevel();
  }

  /* ───────────────────────── смерть / победа ───────────────────────── */

  function killActor(a, reason) {
    if (!a || !a.alive || a.gone || a.dead || G.mode !== "playing") return;
    a.alive = false;
    a.dead = true;
    a.state = "dead";
    a.vx = 0;
    a.vy = 0;
    a.braced = false;
    G.mode = "dead";
    G.deathTimer = 1.6;
    G.deathReason = reason || "spikes";
    G.deadActor = a.id;
    G.levelDeaths++;
    if (G.session) G.session.deaths++;
    G.shake = 1;
    G.flash = 0.6;
    addFx("death", a.x, a.y - 10, 1.0);
    jingle("death");
    sfx("death");
    emit("death", { id: a.id, reason: G.deathReason, deaths: G.levelDeaths });
  }

  function completeLevel() {
    G.mode = "complete";
    G.completed = true;
    G.score += 500;
    var stats = {
      index: G.levelIndex,
      time: G.time,
      deaths: G.levelDeaths,
      treasures: G.treasuresTaken,
      totalTreasures: G.treasuresTotal,
      score: G.score,
      level: G.level
    };
    if (G.session) {
      G.session.time += G.time;
      G.session.treasure += G.treasuresTaken;
      G.session.score += G.score;
      G.session.completedLevels++;
    }
    try { if (audio && audio.stopMusic) audio.stopMusic(); } catch (e) {}
    jingle(G.levelIndex >= levels.length - 1 ? "finale" : "win");
    emit("complete", stats);
  }

  /* ───────────────────────── fx / update ───────────────────────── */

  function addFx(type, x, y, ttl) {
    G.fx.push({ type: type, x: x, y: y, age: 0, ttl: ttl || 0.4, dir: 1 });
    if (G.fx.length > 64) G.fx.shift();
  }

  function updateFx(dt) {
    for (var i = G.fx.length - 1; i >= 0; i--) {
      G.fx[i].age += dt;
      if (G.fx[i].age >= G.fx[i].ttl) G.fx.splice(i, 1);
    }
    G.shake = Math.max(0, G.shake - dt * 2.2);
    G.flash = Math.max(0, G.flash - dt * 2.6);
  }

  function processInputEdges() {
    var a = G.actors[G.activeId];
    if (!a || !a.alive || a.gone || a.dead) {
      var n = firstAliveId();
      if (n) setActive(n);
      a = G.actors[G.activeId];
    }
    if (!a) return;
    if (G.jumpPressed) {
      a.jumpBuf = 0.12;
      G.jumpPressed = false;
    }
    if (G.actionPressed) {
      triggerAction(a);
      G.actionPressed = false;
    }
  }

  function physicsStep(dt) {
    for (var i = 0; i < ORDER.length; i++) {
      updateActor(G.actors[ORDER[i]], dt, ORDER[i] === G.activeId && G.mode === "playing");
    }
  }

  function update(dt) {
    if (!isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    G.t += dt;
    updateFx(dt);
    if (G.mode === "dead") {
      G.deathTimer -= dt;
      if (G.deathTimer <= 0) restartLevel();
      return;
    }
    if (G.mode !== "playing" || G.paused) return;

    G.time += dt;
    if (G.wrongExitCd > 0) G.wrongExitCd -= dt;
    processInputEdges();

    var steps = Math.max(1, Math.ceil(dt / 0.008));
    var sdt = dt / steps;
    for (var s = 0; s < steps; s++) physicsStep(sdt);

    updateEnemies(dt);
    updateTraps(dt);
    updateArrows(dt);
    updatePlatesAndGates(dt);
    collectTreasures();
    checkExits();
  }

  /* ───────────────────────── view ───────────────────────── */

  function getView() {
    var terrainRows = [];
    for (var ry = 0; ry < G.terrain.length; ry++) terrainRows.push(G.terrain[ry].join(""));
    var actors = [];
    for (var i = 0; i < ORDER.length; i++) {
      var a = G.actors[ORDER[i]];
      if (!a) continue;
      actors.push({
        id: a.id, x: a.x, y: a.y, dir: a.dir, vx: a.vx, vy: a.vy,
        onGround: a.onGround, state: a.state, active: a.id === G.activeId,
        shield: !!(a.id === "olaf" && a.braced), anim: a.anim
      });
    }
    var enemies = [];
    for (var j = 0; j < G.enemies.length; j++) {
      var e = G.enemies[j];
      if (!e.alive && e.deadTimer <= 0) continue;
      enemies.push({ x: e.x, y: e.y, dir: e.dir, state: e.alive ? "walk" : "die", alive: e.alive, anim: e.anim });
    }
    var gates = [];
    for (var k = 0; k < G.gates.length; k++) {
      var g = G.gates[k];
      gates.push({ x: g.x, y: g.y, group: "abcd".charAt(g.group), open: g.open ? 1 : 0, anim: g.anim });
    }
    var plates = [];
    for (var p = 0; p < G.plates.length; p++) {
      var pl = G.plates[p];
      plates.push({ x: pl.x, y: pl.y, group: "abcd".charAt(pl.group), pressed: pl.pressed });
    }
    var levers = [];
    for (var l = 0; l < G.levers.length; l++) {
      var lv = G.levers[l];
      levers.push({ x: lv.x, y: lv.y, group: "abcd".charAt(lv.group), on: lv.on, anim: lv.anim });
    }
    var traps = [];
    for (var t = 0; t < G.traps.length; t++) traps.push({ x: G.traps[t].x, y: G.traps[t].y, dir: G.traps[t].dir });
    var treasures = [];
    for (var tr = 0; tr < G.treasures.length; tr++) {
      treasures.push({ x: G.treasures[tr].x, y: G.treasures[tr].y, taken: G.treasures[tr].taken });
    }
    var exits = [];
    for (var ex = 0; ex < G.exits.length; ex++) {
      exits.push({ x: G.exits[ex].x, y: G.exits[ex].y, filledBy: G.exits[ex].filledBy, anim: G.exits[ex].anim, who: G.exits[ex].who });
    }
    var arrows = [];
    for (var ar = 0; ar < G.arrows.length; ar++) {
      arrows.push({ x: G.arrows[ar].x, y: G.arrows[ar].y, dir: G.arrows[ar].dir, hostile: G.arrows[ar].hostile });
    }
    var fx = [];
    for (var f = 0; f < G.fx.length; f++) {
      var o = G.fx[f];
      fx.push({ type: o.type, x: o.x, y: o.y, age: o.age, ttl: o.ttl, dir: o.dir });
    }
    return {
      t: G.time,
      theme: G.theme,
      w: GW, h: GH,
      terrain: terrainRows,
      gates: gates,
      plates: plates,
      levers: levers,
      traps: traps,
      treasures: treasures,
      exits: exits,
      actors: actors,
      enemies: enemies,
      arrows: arrows,
      fx: fx,
      shake: G.shake,
      flash: G.flash,
      active: G.activeId,
      mode: G.mode
    };
  }

  /* ───────────────────────── API ───────────────────────── */

  var API = {
    state: G,
    init: function (opts) {
      opts = opts || {};
      levels = opts.levels || [];
      audio = opts.audio || null;
      onEvent = opts.onEvent || function () {};
      resetSession();
      return API;
    },
    setAudio: function (a) { audio = a; },
    setLevels: function (l) { levels = l || []; },
    startLevel: startLevel,
    restartLevel: restartLevel,
    resetSession: resetSession,
    update: update,
    input: input,
    switchTo: setActive,
    cycleViking: cycleActive,
    pause: function (v) {
      G.paused = v == null ? !G.paused : !!v;
      try { if (audio && audio.setPaused) audio.setPaused(G.paused); } catch (e) {}
      return G.paused;
    },
    isPaused: function () { return G.paused; },
    getView: getView,
    getLevels: function () { return levels; },
    getLevelInfo: function (i) { return levels[i] || null; },
    isLastLevel: function () { return G.levelIndex >= levels.length - 1; },
    debug: {
      teleport: function (id, tx, ty) {
        var a = G.actors[id];
        if (!a) return;
        a.x = tx * T + T / 2;
        a.y = ty * T + T;
        a.vx = 0; a.vy = 0;
      },
      kill: function (id, reason) { if (G.actors[id]) killActor(G.actors[id], reason || "spikes"); },
      win: function () {
        for (var i = 0; i < ORDER.length; i++) {
          var a = G.actors[ORDER[i]];
          a.gone = true;
          a.alive = true;
          a.dead = false;
        }
        completeLevel();
      },
      activate: setActive,
      getView: getView
    }
  };

  window.LV_GAME = API;
})();
