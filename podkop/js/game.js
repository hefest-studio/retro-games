/* ПОДКОП · логика (без DOM): клеточный сыпучий песок + герой-землекоп.
   Песок — не жидкость: зерно падает вниз, а если внизу занято — съезжает по диагонали, только когда и боковая, и диагональная клетки свободны
   (откос ровно 45°). Герой копает песок (зерно уходит в мешок) и сыплет его обратно; песок засыпает врагов и самого героя, если падает на голову.
   Цель яруса — дойти до двери. PODKOP.Game({level, seed, onEvent, lives}) → state(), setInput(), step(dt), … */
(function (global) {
  'use strict';
  var PK = global.PODKOP = global.PODKOP || {};
  var COLS = 22, ROWS = 18, CAP = 12, LIVES = 3;
  var AIR = 0, SAND = 1, WALL = 2, SPOUT = 3, SPIKE = 4;
  var T = { sand: 1 / 24, hero: 0.11, fall: 0.06, dig: 0.16, pour: 0.13, walker: 0.42, chaser: 0.28, efall: 0.08, spout: 0.5, dying: 1.1, clear: 1.7 };
  PK.consts = { COLS: COLS, ROWS: ROWS, CAP: CAP, LIVES: LIVES, AIR: AIR, SAND: SAND, WALL: WALL, SPOUT: SPOUT, SPIKE: SPIKE, T: T, MAX_LEVEL: 0 };
  var N = COLS * ROWS;
  function idx(x, y) { return y * COLS + x; }
  function inb(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }

  // ---------- уровни ----------
  // Строки карты — снизу вверх по высоте поля: недостающие верхние строки достраиваются монолитом. Символы: # скала, s песок, ^ шипы, V пескопад,
  // H герой, E дверь, w ходок, c охотник, пробел — воздух.
  PK.level = function (i) {
    var L = PK.LEVELS[i], rows = L.map.slice(), g = new Uint8Array(N), hero = null, exit = null, enemies = [], spouts = [];
    while (rows.length < ROWS) rows.unshift(new Array(COLS + 1).join('#'));
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var ch = rows[y].charAt(x) || '#', v = AIR;
      if (ch === '#') v = WALL; else if (ch === 's') v = SAND; else if (ch === '^') v = SPIKE;
      else if (ch === 'V') { v = SPOUT; spouts.push({ x: x, y: y, c: 0.2 }); }
      else if (ch === 'H') hero = { x: x, y: y }; else if (ch === 'E') exit = { x: x, y: y };
      else if (ch === 'w' || ch === 'W' || ch === 'c') enemies.push({ t: ch === 'c' ? 'c' : 'w', fast: ch === 'W', x: x, y: y, d: ch === 'c' ? 1 : -1, mc: 0.3, fc: 0, alive: true });
      g[idx(x, y)] = v;
    }
    var top = 0; while (top < ROWS - 1 && rows[top + 1].replace(/#/g, '') === '') top++;
    return { id: L.id, name: L.name, hint: L.hint, bag: L.bag || 0, top: top, g: g, hero: hero, exit: exit, enemies: enemies, spouts: spouts, par: L.par || 60 };
  };

  function Game(o) {
    o = o || {};
    var onEvent = o.onEvent || function () {}, S = o.state || null;
    function ev(t, d) { onEvent(t, d || {}); }
    function load(level, keep) {
      var L = PK.level(level), prev = S;
      S = {
        level: level, top: L.top, hint: L.hint, g: L.g, fl: new Uint8Array(N), exit: L.exit, spouts: L.spouts, enemies: L.enemies, tick: 0, t: 0, sacc: 0, timer: 0,
        hero: { x: L.hero.x, y: L.hero.y, f: 1, bag: L.bag, mc: 0, fc: 0, dc: 0, pc: 0, ac: 0 },
        mode: 'play', lives: keep ? prev.lives : (o.lives || LIVES), score: keep ? prev.score : 0, buried: 0, why: '', par: L.par,
        input: { dx: 0, dy: 0, dig: false, pour: false }, seed: o.seed || 1, bonus: null
      };
    }
    if (!S) load(o.level || 0, false);

    function actorAt(x, y) {
      var h = S.hero; if (S.mode === 'play' && h.x === x && h.y === y) return h;
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (e.alive && e.x === x && e.y === y) return e; }
      return null;
    }
    function cell(x, y) { return inb(x, y) ? S.g[idx(x, y)] : (y >= ROWS ? 9 : WALL); }   // 9 — бездна под полем
    function freeCell(x, y) { return inb(x, y) && S.g[idx(x, y)] === AIR && !actorAt(x, y); }
    function solid(v) { return v === SAND || v === WALL || v === SPOUT || v === SPIKE; }
    function hurt(why) {
      if (S.mode !== 'play') return; S.mode = 'dying'; S.timer = T.dying; S.why = why; ev('hurt', { x: S.hero.x, y: S.hero.y, why: why });
    }
    function killEnemy(e, why) {
      if (!e.alive) return; e.alive = false; S.buried++; S.score += 100; ev('bury', { x: e.x, y: e.y, t: e.t, why: why });
    }
    function hit(a) { if (a === S.hero) hurt('sand'); else killEnemy(a, 'sand'); }

    // ---------- песок ----------
    function sandTick() {
      var g = S.g, fl = S.fl, nf = new Uint8Array(N), tk = S.tick++;
      for (var y = ROWS - 1; y >= 0; y--) {
        for (var k = 0; k < COLS; k++) {
          var x = (tk & 1) ? COLS - 1 - k : k, i = y * COLS + x; if (g[i] !== SAND) continue;
          if (y === ROWS - 1) { g[i] = AIR; continue; }          // зерно ушло в бездну
          var b = i + COLS;
          if (g[b] === AIR) {
            var a = actorAt(x, y + 1);
            if (!a) { g[b] = SAND; g[i] = AIR; nf[b] = 1; continue; }
            if (fl[i]) { g[b] = SAND; g[i] = AIR; nf[b] = 1; hit(a); }
            continue;
          }
          var s0 = ((x * 5 + y * 3 + tk) & 1) ? 1 : -1;
          for (var q = 0; q < 2; q++) {
            var s = q ? -s0 : s0, nx = x + s; if (nx < 0 || nx >= COLS) continue;
            if (g[y * COLS + nx] === AIR && g[(y + 1) * COLS + nx] === AIR && !actorAt(nx, y) && !actorAt(nx, y + 1)) { g[(y + 1) * COLS + nx] = SAND; g[i] = AIR; nf[(y + 1) * COLS + nx] = 1; break; }
          }
        }
      }
      S.fl = nf;
    }

    // ---------- герой ----------
    function heroMoveTo(x, y) { S.hero.x = x; S.hero.y = y; checkContact(); }
    function checkContact() {
      if (S.mode !== 'play') return; var h = S.hero;
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (e.alive && e.x === h.x && e.y === h.y) { hurt('bite'); return; } }
      if (S.exit && h.x === S.exit.x && h.y === S.exit.y) win();
    }
    function win() {
      var h = S.hero, tb = Math.max(0, Math.round((S.par - S.t) * 3)), sb = h.bag * 10, tot = 200 + tb + sb;
      S.score += tot; S.mode = 'clear'; S.timer = T.clear; S.bonus = { base: 200, time: tb, sand: sb, total: tot };
      ev('clear', { level: S.level, bonus: S.bonus });
    }
    function aimCell() {
      var h = S.hero, inp = S.input; if (inp.dy < 0) return [h.x, h.y - 1, 'up']; if (inp.dy > 0) return [h.x, h.y + 1, 'down']; return [h.x + h.f, h.y, 'front'];
    }
    function heroUpdate(dt) {
      var h = S.hero, inp = S.input; h.mc -= dt; h.fc -= dt; h.dc -= dt; h.pc -= dt;
      if (inp.dx && (inp.dig || inp.pour)) h.f = inp.dx > 0 ? 1 : -1;   // с кнопкой действия стик только поворачивает
      var below = cell(h.x, h.y + 1);
      if (below === AIR || below === 9) {                 // падение
        if (h.fc <= 0) { h.fc = T.fall; if (h.y + 1 >= ROWS) { hurt('void'); return; } h.y++; checkContact(); }
        return;
      }
      if (below === SPIKE) { hurt('spike'); return; }
      var i;
      if (inp.dig && h.dc <= 0) {
        var a = aimCell(), v = cell(a[0], a[1]);
        if (v === SAND) { if (h.bag < CAP) { S.g[idx(a[0], a[1])] = AIR; S.fl[idx(a[0], a[1])] = 0; h.bag++; h.dc = T.dig; ev('dig', { x: a[0], y: a[1], aim: a[2] }); } else { h.dc = 0.4; ev('full', {}); } }
        else if (v !== AIR) { h.dc = 0.3; ev('nogo', {}); }
      }
      if (inp.pour && h.pc <= 0) {
        var tx = h.x + h.f, ty = h.y;
        if (h.bag > 0 && freeCell(tx, ty)) { S.g[idx(tx, ty)] = SAND; S.fl[idx(tx, ty)] = 1; h.bag--; h.pc = T.pour; ev('pour', { x: tx, y: ty }); }
        else { h.pc = 0.3; ev('nogo', {}); }
      }
      if (inp.dx && !(inp.dig || inp.pour) && h.mc <= 0) {
        var dx = inp.dx > 0 ? 1 : -1, nx = h.x + dx; h.f = dx;
        if (inb(nx, h.y)) {
          var c = S.g[idx(nx, h.y)];
          if (c === AIR) { h.mc = T.hero; heroMoveTo(nx, h.y); ev('step', { x: nx, y: h.y }); }
          else if (inb(nx, h.y - 1) && S.g[idx(nx, h.y - 1)] === AIR && S.g[idx(h.x, h.y - 1)] === AIR) { h.mc = T.hero * 1.2; heroMoveTo(nx, h.y - 1); ev('step', { x: nx, y: h.y - 1 }); }
          else h.mc = 0.05;
        }
      }
    }

    // ---------- враги ----------
    function floorOk(x, y) { var v = cell(x, y + 1); return v === SAND || v === WALL || v === SPOUT; }
    function enemyUpdate(dt) {
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i]; if (!e.alive) continue; e.mc -= dt; e.fc -= dt;
        var below = cell(e.x, e.y + 1);
        if (below === AIR || below === 9) { if (e.fc <= 0) { e.fc = T.efall; if (e.y + 1 >= ROWS) { e.alive = false; continue; } e.y++; } continue; }
        if (below === SPIKE) { killEnemy(e, 'spike'); continue; }
        if (e.mc > 0) continue;
        var h = S.hero, d = e.d;
        if (e.t === 'c' && S.mode === 'play' && Math.abs(h.x - e.x) <= 10 && Math.abs(h.y - e.y) <= 7 && h.x !== e.x) d = h.x > e.x ? 1 : -1;
        e.d = d; var nx = e.x + d;
        if (!inb(nx, e.y)) { e.d = -d; e.mc = 0.2; continue; }
        if (S.g[idx(nx, e.y)] === AIR && floorOk(nx, e.y)) { e.x = nx; e.mc = e.t === 'c' ? T.chaser : (e.fast ? 0.3 : T.walker); }
        else if (e.t === 'c' && S.g[idx(nx, e.y)] !== AIR && cell(nx, e.y - 1) === AIR && cell(e.x, e.y - 1) === AIR) { e.x = nx; e.y--; e.mc = T.chaser * 1.3; }
        else { if (e.t === 'w' || !(h.x !== e.x && Math.abs(h.x - e.x) <= 10)) e.d = -d; e.mc = e.t === 'c' ? 0.12 : (e.fast ? 0.25 : 0.8); }
        checkContact();
      }
    }
    function spoutUpdate(dt) {
      for (var i = 0; i < S.spouts.length; i++) {
        var p = S.spouts[i]; p.c -= dt; if (p.c > 0) continue;
        var by = p.y + 1; if (!inb(p.x, by) || S.g[idx(p.x, by)] !== AIR) { p.c = 0.1; continue; }
        p.c = T.spout; var a = actorAt(p.x, by); S.g[idx(p.x, by)] = SAND; S.fl[idx(p.x, by)] = 1; ev('spout', { x: p.x, y: by }); if (a) hit(a);
      }
    }

    function step(dt) {
      if (S.mode === 'play') {
        S.t += dt; heroUpdate(dt);
        if (S.mode === 'play') enemyUpdate(dt);
        if (S.mode === 'play') spoutUpdate(dt);
        S.sacc += dt; var n = 0; while (S.sacc >= T.sand && n++ < 4) { S.sacc -= T.sand; sandTick(); }
        if (S.mode === 'play') checkContact();
      } else if (S.mode === 'dying') {
        S.timer -= dt; S.sacc += dt; var m = 0; while (S.sacc >= T.sand && m++ < 4) { S.sacc -= T.sand; sandTick(); }
        if (S.timer <= 0) { S.lives--; if (S.lives <= 0) { S.mode = 'gameover'; ev('gameover', { score: S.score }); } else { load(S.level, true); ev('retry', { level: S.level }); } }
      } else if (S.mode === 'clear') {
        S.timer -= dt; S.sacc += dt; var k2 = 0; while (S.sacc >= T.sand && k2++ < 4) { S.sacc -= T.sand; sandTick(); }
        if (S.timer <= 0) next();
      }
    }
    function next() {
      if (S.mode !== 'clear') return;
      var lv = S.level + 1, lives = S.lives; if ((S.level === 2 || S.level === 5) && lives < 5) { lives++; ev('life', {}); }
      if (lv >= PK.consts.MAX_LEVEL) { S.mode = 'victory'; ev('victory', { score: S.score }); return; }
      S.lives = lives; load(lv, true); ev('level', { level: lv });
    }
    function skip() { if (S.mode === 'clear') { S.timer = 0; next(); } }
    function restart() { if (S.mode !== 'play') return; S.lives--; if (S.lives <= 0) { S.mode = 'gameover'; ev('gameover', { score: S.score }); } else { load(S.level, true); ev('retry', { level: S.level }); } }
    function setInput(i) { var I = S.input; I.dx = i.dx || 0; I.dy = i.dy || 0; I.dig = !!i.dig; I.pour = !!i.pour; }

    return {
      state: function () { return S; }, step: step, setInput: setInput, next: next, skip: skip, restart: restart,
      isOver: function () { return S.mode === 'gameover' || S.mode === 'victory'; },
      revive: function () { S.lives = 1; load(S.level, true); },
      addSand: function (n) { S.hero.bag = Math.min(CAP, S.hero.bag + n); },
      load: function (lv) { load(lv, true); },
      clone: function () { return PK.fromState(clone(S), o); }
    };
  }
  function clone(S) {
    var c = Object.assign({}, S); c.g = S.g.slice(); c.fl = S.fl.slice(); c.hero = Object.assign({}, S.hero); c.input = Object.assign({}, S.input);
    c.enemies = S.enemies.map(function (e) { return Object.assign({}, e); }); c.spouts = S.spouts.map(function (p) { return Object.assign({}, p); }); return c;
  }
  PK.Game = Game; PK.fromState = function (S, o) { return Game(Object.assign({}, o, { state: S })); };
})(typeof window !== 'undefined' ? window : globalThis);
