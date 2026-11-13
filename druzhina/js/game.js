/* ДРУЖИНА · логика (без DOM): beat 'em up на «полосе» с глубиной для 1–2 игроков.
   Мир: x — вдоль тракта, z — глубина полосы (0 — дальний край, DEPTH — ближний), h — высота прыжка.
   Экран: sx = x − cam, sy = FLOOR_TOP + z − h. Логика детерминирована при заданном rng.
   API: DRUZHINA.Game(opts) → { start, update(dt), state, setDir(pi,dx,dy), attack(pi), jump(pi), magic(pi),
   special(pi), continue_(), … }; DRUZHINA.logic — константы, данные героев/врагов/этапов, утилиты. */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v < 0 ? -1 : 1; }

  var VIEW_W = 960, SCREEN_H = 540, HUD = 56, FLOOR_TOP = 322, DEPTH = 186, GRAV = 1750, ZR = 17;

  // ---------- Герои ----------
  // Ход атаки: w — замах, a — активная фаза (удар), r — восстановление; d — урон; kd — сбивает с ног.
  var HEROES = {
    zhdan: { hp: 180, speed: 140, zs: 92, run: 260, jump: 560, reach: 68,
      combo: [{ w: 0.10, a: 0.07, r: 0.15, d: 8 }, { w: 0.10, a: 0.07, r: 0.17, d: 9 }, { w: 0.17, a: 0.09, r: 0.32, d: 17, kd: 1 }],
      air: { d: 15, reach: 60 }, dash: { d: 15, reach: 56 }, back: { d: 15, cost: 6, reach: 70 }, knee: 6, toss: 18,
      magic: { kind: 'forge', costs: [2, 4, 6, 8], dmg: [22, 36, 52, 76] } },
    secha: { hp: 140, speed: 185, zs: 115, run: 320, jump: 600, reach: 54,
      combo: [{ w: 0.05, a: 0.06, r: 0.08, d: 6 }, { w: 0.05, a: 0.06, r: 0.08, d: 6 }, { w: 0.05, a: 0.06, r: 0.09, d: 7 }, { w: 0.08, a: 0.08, r: 0.22, d: 13, kd: 1 }],
      air: { d: 12, reach: 54 }, dash: { d: 13, reach: 50 }, back: { d: 11, cost: 5, reach: 60 }, knee: 5, toss: 15,
      magic: { kind: 'whirl', costs: [1, 2, 3, 4], dmg: [13, 22, 32, 45] } },
    olha: { hp: 115, speed: 160, zs: 104, run: 290, jump: 580, reach: 52, ranged: true,
      combo: [{ w: 0.06, a: 0.07, r: 0.11, d: 6 }, { w: 0.06, a: 0.07, r: 0.11, d: 6 }, { w: 0.11, a: 0.07, r: 0.24, d: 10, kd: 1 }],
      shot: { w: 0.12, a: 0.05, r: 0.26, d: 6, arrow: 1 }, range: 340,
      air: { d: 12, reach: 54 }, dash: { d: 13, reach: 50 }, back: { d: 11, cost: 5, reach: 62 }, knee: 5, toss: 15,
      magic: { kind: 'roots', costs: [1, 3, 5, 7], dmg: [16, 30, 46, 66] } }
  };
  var HERO_KEYS = ['zhdan', 'secha', 'olha'];
  var JUG_MAX = 9;

  // ---------- Враги и звери ----------
  var ENEMIES = {
    shield: { hp: 34, speed: 82, zs: 62, reach: 46, dmg: 7, windup: 0.40, act: 0.10, rec: 0.42, cd: [0.9, 1.7], block: 0.5, score: 150, grab: true },
    spear: { hp: 30, speed: 86, zs: 66, reach: 84, dmg: 8, windup: 0.52, act: 0.12, rec: 0.48, cd: [1.0, 1.9], score: 150, grab: true },
    raider: { hp: 24, speed: 150, zs: 96, reach: 42, dmg: 6, windup: 0.30, act: 0.10, rec: 0.34, cd: [0.8, 1.5], leap: true, score: 200, grab: true },
    brute: { hp: 70, speed: 62, zs: 46, reach: 54, dmg: 10, windup: 0.62, act: 0.12, rec: 0.58, cd: [1.3, 2.3], poise: 15, kd: true, score: 300, grab: false, big: 1.2 }
  };
  var CODES = { sh: 'shield', sp: 'spear', ra: 'raider', br: 'brute' };
  var MOUNTS = {
    tail: { speed: 150, zs: 90, reach: 78, dmg: 8, windup: 0.45, act: 0.12, rec: 0.45, cd: [1.0, 1.8], both: true },
    fire: { speed: 128, zs: 80, reach: 175, dmg: 3, windup: 0.7, act: 0.5, rec: 0.45, cd: [1.4, 2.4], breath: true }
  };

  // ---------- Боссы ----------
  var BOSSES = {
    voevoda: { hp: 230, speed: 92, zs: 70, reach: 66, dmg: 12, poise: 26, moves: ['combo', 'charge'], score: 5000, big: 1.3 },
    twins: { hp: 140, speed: 78, zs: 60, reach: 62, dmg: 10, poise: 24, moves: ['combo', 'slam'], score: 3000, big: 1.3, pair: true },
    lovchiy: { hp: 250, speed: 120, zs: 80, reach: 70, dmg: 11, poise: 28, moves: ['combo', 'breath', 'charge'], score: 5000, big: 1.25, rider: true },
    cepnik: { hp: 270, speed: 88, zs: 66, reach: 70, dmg: 12, poise: 28, moves: ['combo', 'sweep', 'slam'], score: 5000, big: 1.35 },
    stenoboy: { hp: 280, speed: 78, zs: 56, reach: 72, dmg: 12, poise: 32, moves: ['combo', 'charge', 'slam'], score: 6000, big: 1.5 },
    liteyshchik: { hp: 380, speed: 90, zs: 70, reach: 72, dmg: 13, poise: 30, moves: ['combo', 'slam', 'pour', 'summon'], score: 10000, big: 1.45, phases: true }
  };

  // ---------- Этапы ----------
  // Волна: x камеры, где она запирается; строка врагов: код[@зверь], «imp» — бес-кладовик с кувшинами.
  var STAGES = [
    { key: 'trakt', len: 3000, boss: 'voevoda', escort: 'sh', waves: [[250, 'sh sh'], [800, 'sp sh imp'], [1350, 'ra sh sh'], [1900, 'sh@tail sp']] },
    { key: 'village', len: 3500, boss: 'twins', escort: '', waves: [[250, 'sh sp sp'], [800, 'ra ra imp'], [1350, 'br sh'], [1900, 'sp@tail ra ra'], [2450, 'br sp imp']] },
    { key: 'forest', len: 3500, boss: 'lovchiy', escort: 'ra', waves: [[250, 'ra ra ra'], [800, 'sh@fire sp imp'], [1350, 'br br'], [1900, 'ra@tail ra sh'], [2450, 'sp sp sh imp']] },
    { key: 'crossing', len: 3500, boss: 'cepnik', escort: 'sp', waves: [[250, 'sh sh sp'], [800, 'ra@fire sh'], [1350, 'br ra imp'], [1900, 'sp sp ra ra'], [2450, 'sh@tail br imp']] },
    { key: 'walls', len: 3600, boss: 'stenoboy', escort: 'sh sp', waves: [[250, 'br sh sh'], [800, 'sp@tail sp@fire'], [1350, 'ra ra ra imp'], [1950, 'br br sp'], [2550, 'sh@fire ra ra imp']] },
    { key: 'foundry', len: 3800, boss: 'liteyshchik', escort: '', waves: [[250, 'br sp sh sh'], [850, 'ra@fire ra@tail imp'], [1450, 'br br ra'], [2050, 'sh sh sp sp imp'], [2650, 'br@tail sp ra ra']] }
  ];
  var BONUS_AFTER = { 1: 1, 3: 1, 5: 1 };   // привал с бесами — после этапов 1, 3, 5
  var STAGE_MUL = [1, 1.06, 1.12, 1.18, 1.24, 1.3];
  var PTS = { hit: 20, jug: 200, food: 100, impHit: 50, extra: 60000 };

  function parseWave(s) {
    return s.trim().split(/\s+/).filter(Boolean).map(function (tok) {
      if (tok === 'imp') return { imp: true };
      var p = tok.split('@'); if (!CODES[p[0]]) throw new Error('ДРУЖИНА: неизвестный враг ' + tok);
      return { type: CODES[p[0]], mount: p[1] || null };
    });
  }

  // ======================================================================
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var players = opts.players === 2 ? 2 : 1;
    var heroKeys = (opts.heroes || ['zhdan', 'secha']).slice(0, players);
    var startStage = opts.stage || 1, maxStage = opts.maxStage || STAGES.length;
    var S = null, uid = 1;
    function R(a, b) { return a + rng() * (b - a); }
    function ev(t, d) { emit(t, d || {}); }

    function mkHero(pi, key) {
      var H = HEROES[key];
      return { id: uid++, kind: 'hero', pi: pi, hero: key, def: H, x: 0, z: 0, h: 0, vh: 0, vx: 0, vz: 0, face: 1,
        hp: H.hp, max: H.hp, lives: 3, jugs: 0, state: 'idle', st: 0, phase: '', pt: 0, move: null, inv: 0,
        combo: 0, comboT: 0, buf: 0, running: false, lastTap: 0, lastTapT: -9, prevDx: 0, dx: 0, dy: 0,
        grab: null, grabT: 0, knees: 0, contact: null, contactT: 0, mount: null, out: false, respawnT: 0, dying: false,
        airUsed: false, jumpT: 9, w: 16, alive: true, castT: 0 };
    }

    function start() {
      S = { time: 0, stage: startStage, maxStage: maxStage, players: players, score: 0, nextExtra: PTS.extra,
        heroes: heroKeys.map(function (k, i) { return mkHero(i, k); }), foes: [], mounts: [], items: [], projs: [], waves: [], puddles: [],
        fx: [], spells: [], phase: 'play', phaseT: 0, cam: 0, lock: null, waveIdx: 0, queue: [], spawnT: 0, go: 0, freeze: 0,
        continues: opts.continues != null ? opts.continues : 2, contT: 0, banner: 2.2, bonus: false, bonusT: 0, impQ: 0, impT: 0,
        bossOn: false, won: false, over: false, lastBonus: 0, kills: 0 };
      setupStage(startStage);
      return api;
    }

    function setupStage(n) {
      var st = STAGES[n - 1];
      S.stage = n; S.key = st.key; S.len = st.len; S.cam = 0; S.lock = null; S.waveIdx = 0; S.queue = []; S.foes = []; S.mounts = [];
      S.items = []; S.projs = []; S.waves = []; S.puddles = []; S.spells = []; S.bossOn = false; S.bonus = false; S.banner = 2.2; S.go = 0;
      S.mul = STAGE_MUL[n - 1] * (players === 2 ? 1.5 : 1);
      S.dmgMul = 0.725 * (1 + (STAGE_MUL[n - 1] - 1) * 0.7) * (players === 2 ? 1.3 : 1);
      S.heroes.forEach(function (h, i) {
        h.x = 140 + i * 90; h.z = DEPTH * (i ? 0.75 : 0.45); h.h = 0; h.vh = 0; h.state = h.out ? 'out' : 'idle'; h.move = null; h.grab = null;
        h.mount = null; h.inv = 1; h.face = 1; h.running = false;
      });
      ev('stage', { stage: n, key: st.key });
    }
    function setupBonus() {
      S.bonus = true; S.phase = 'bonus'; S.bonusT = 14; S.foes = []; S.mounts = []; S.items = []; S.projs = []; S.waves = []; S.puddles = [];
      S.cam = 0; S.lock = 0; S.impQ = 8 + (players === 2 ? 2 : 0); S.impT = 1.2; S.banner = 1.8; S.key = 'camp';
      S.heroes.forEach(function (h, i) { if (h.out) return; h.x = 380 + i * 160; h.z = DEPTH * 0.55; h.h = 0; h.state = 'idle'; h.mount = null; h.grab = null; h.move = null; });
      ev('bonus', {});
    }

    // ---------- Создание врагов ----------
    function mkFoe(type, x, z, o) {
      var E = ENEMIES[type], m = S.mul;
      var f = { id: uid++, kind: 'foe', type: type, def: E, x: x, z: z, h: 0, vh: 0, vx: 0, vz: 0, face: -1, hp: Math.round(E.hp * m), max: Math.round(E.hp * m),
        state: 'walk', st: 0, phase: '', pt: 0, move: null, inv: 0, cd: R(0.6, 1.4), mount: null, alive: true, dying: false, poise: 0, w: E.big ? 20 : 15,
        hitBy: null, remountT: 0, aggro: rng(), wz: rng() };
      if (o && o.mount) { var mt = mkMount(o.mount, x, z); mt.rider = f; f.mount = mt; }
      S.foes.push(f); return f;
    }
    function mkMount(type, x, z) {
      var mt = { id: uid++, kind: 'mount', type: type, def: MOUNTS[type], x: x, z: z, h: 0, vh: 0, face: -1, rider: null, state: 'idle', st: 0, spookT: 0, dir: 1, w: 26 };
      S.mounts.push(mt); return mt;
    }
    function mkImp(x, z, dir, bags) {
      var f = { id: uid++, kind: 'imp', type: 'imp', x: x, z: z, h: 0, vh: 0, vx: 0, face: dir, dir: dir, hp: 1, state: 'walk', st: 0, bags: bags || 3,
        alive: true, inv: 0, w: 14, flee: false, pause: R(0.6, 1.4) };
      S.foes.push(f); return f;
    }
    function mkBoss(key, x, z) {
      var B = BOSSES[key], m = players === 2 ? 1.9 : 1;
      var b = { id: uid++, kind: 'boss', type: key, def: B, x: x, z: z, h: 0, vh: 0, vx: 0, vz: 0, face: -1, hp: Math.round(B.hp * m), max: Math.round(B.hp * m),
        state: 'walk', st: 0, phase: '', pt: 0, move: null, inv: 0, cd: 1.6, alive: true, dying: false, poise: 0, w: 26, intro: 1.6, summonT: 6, stage: 0 };
      S.foes.push(b); return b;
    }

    function spawnEntry(e) {
      var side = e.side || (rng() < 0.65 ? 1 : -1), x = side > 0 ? S.cam + VIEW_W + 50 : S.cam - 50, z = R(10, DEPTH - 10);
      if (e.imp) { mkImp(x, z, -side, 3); ev('imp', {}); return; }
      var f = mkFoe(e.type, x, z, e);
      f.face = -side;
    }

    function lockWave(w) {
      S.lock = w[0]; S.waveIdx++;
      var list = parseWave(w[1]);
      if (players === 2) { var foes = list.filter(function (q) { return !q.imp; }); foes.slice(0, 2).forEach(function (q) { list.push({ type: q.type }); }); }
      list.forEach(function (q, i) { q.side = q.imp ? (i % 2 ? -1 : 1) : (i % 3 === 2 ? -1 : 1); });
      S.queue = list; S.spawnT = 0.3; ev('wave', { n: S.waveIdx });
    }
    function lockBoss() {
      var st = STAGES[S.stage - 1];
      S.lock = S.len - VIEW_W; S.bossOn = true;
      if (st.boss === 'twins') { mkBoss('twins', S.lock + VIEW_W + 40, DEPTH * 0.3).twin = 0; mkBoss('twins', S.lock + VIEW_W + 120, DEPTH * 0.75).twin = 1; }
      else mkBoss(st.boss, S.lock + VIEW_W + 60, DEPTH * 0.5);
      S.queue = st.escort ? parseWave(st.escort) : []; S.queue.forEach(function (q) { q.side = -1; }); S.spawnT = 2.5;
      ev('boss', { key: st.boss });
    }

    // ---------- Ввод ----------
    function hero(pi) { return S && S.heroes[pi]; }
    function setDir(pi, dx, dy) {
      var h = hero(pi); if (!h) return;
      dx = dx > 0 ? 1 : dx < 0 ? -1 : 0; dy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
      if (dx !== h.prevDx) {   // двойное нажатие в сторону — бег
        if (dx !== 0) {
          if (h.lastTap === dx && S.time - h.lastTapT < 0.3) { h.running = true; h.runDir = dx; }
          else if (h.running && dx !== h.runDir) h.running = false;
          h.lastTap = dx; h.lastTapT = S.time;
        } else h.running = false;
        h.prevDx = dx;
      }
      h.dx = dx; h.dy = dy;
    }
    function canAct(h) { return h && !h.out && h.alive && S.phase !== 'continue' && S.phase !== 'over' && S.phase !== 'won'; }
    function attack(pi) {
      var h = hero(pi); if (!canAct(h)) return;
      if (h.state === 'jump' && h.jumpT < 0.09 && h.h < 30 && !h.mount) { h.h = 0; h.vh = 0; return doBack(h); }
      if (h.state === 'atk' || h.state === 'mountAtk') { h.buf = 0.35; return; }
      if (h.state === 'grab') return grabAct(h);
      if (h.state === 'jump') {
        if (!h.airUsed && !h.mount) { h.airUsed = true; h.airAtk = 0.35; h.airHit = {}; ev('swing', { pi: pi, hero: h.hero, air: 1 }); }
        return;
      }
      if (h.state !== 'idle' && h.state !== 'walk') { if (h.state === 'hurt') h.buf = 0.2; return; }
      if (h.mount) return mountAttack(h, h.mount.def);
      if (h.running) { h.running = false; return startMove(h, { name: 'dash', w: 0.04, a: 0.22, r: 0.24, d: h.def.dash.d, reach: h.def.dash.reach, kd: 1, dash: 1, unblock: 1 }); }
      if (h.def.ranged && !foeInReach(h, h.def.reach + 14) && foeInLane(h, h.def.range)) {
        var sh = h.def.shot; return startMove(h, { name: 'shot', w: sh.w, a: sh.a, r: sh.r, d: sh.d, arrow: 1 });
      }
      var c = h.comboT > 0 ? h.combo : 0, mv = h.def.combo[c % h.def.combo.length];
      h.combo = (c + 1) % h.def.combo.length;
      startMove(h, { name: 'c' + (c % h.def.combo.length), step: c % h.def.combo.length, w: mv.w, a: mv.a, r: mv.r, d: mv.d, kd: mv.kd, reach: h.def.reach });
    }
    function jump(pi) {
      var h = hero(pi); if (!canAct(h)) return;
      if (h.state === 'grab') { releaseGrab(h, true); return; }
      if (h.state === 'atk' && h.move && h.move.name === 'c0' && h.pt < 0.08 && h.phase === 'w') return doBack(h);
      if (h.state !== 'idle' && h.state !== 'walk') return;
      var spd = h.mount ? 0.8 : 1;
      h.state = 'jump'; h.st = 0; h.vh = h.def.jump * (h.mount ? 0.78 : 1); h.jumpT = 0; h.airUsed = false; h.airAtk = 0;
      h.vx = h.dx * (h.running ? h.def.run : h.def.speed) * spd; h.vz = h.dy * h.def.zs * 0.8;
      ev('jump', { pi: pi });
    }
    function special(pi) {
      var h = hero(pi); if (!canAct(h)) return;
      if (h.mount && (h.state === 'idle' || h.state === 'walk')) { dismount(h, false); return; }
      if (h.state === 'idle' || h.state === 'walk' || h.state === 'hurt' && h.st > 0.12) doBack(h);
    }
    function magic(pi) {
      var h = hero(pi); if (!canAct(h)) return false;
      if (h.state !== 'idle' && h.state !== 'walk' && h.state !== 'hurt') return false;
      var M = h.def.magic, lvl = 0;
      for (var i = 0; i < M.costs.length; i++) if (h.jugs >= M.costs[i]) lvl = i + 1;
      if (!lvl) { ev('noMagic', { pi: pi }); return false; }
      h.jugs -= M.costs[lvl - 1];
      if (h.mount) dismount(h, false);
      h.state = 'cast'; h.st = 0; h.inv = Math.max(h.inv, 1.6); h.move = null; h.grab = null;
      S.spells.push({ kind: M.kind, level: lvl, t: 0, pi: pi, x: h.x, z: h.z, done: false, dmg: M.dmg[lvl - 1] });
      S.freeze = Math.max(S.freeze, 1.15);
      ev('magic', { pi: pi, kind: M.kind, level: lvl, x: h.x, z: h.z });
      return lvl;
    }
    function magicLevel(h) { var c = h.def.magic.costs, l = 0; for (var i = 0; i < c.length; i++) if (h.jugs >= c[i]) l = i + 1; return l; }
    function doBack(h) {
      var B = h.def.back;
      if (h.mount) return;
      h.hp = Math.max(1, h.hp - B.cost);
      h.inv = Math.max(h.inv, 0.35);
      startMove(h, { name: 'back', w: 0.06, a: 0.14, r: 0.22, d: B.d, reach: B.reach, kd: 1, both: 1, unblock: 1 });
      ev('back', { pi: h.pi });
    }

    // ---------- Ходы героя ----------
    function startMove(h, mv) { h.state = 'atk'; h.st = 0; h.move = mv; h.phase = 'w'; h.pt = 0; h.hits = {}; h.buf = 0; if (mv.name !== 'shot') ev('swing', { pi: h.pi, hero: h.hero, step: mv.step, name: mv.name }); }
    function foesAlive() { return S.foes.filter(function (f) { return f.alive && !f.dying && f.kind !== 'imp'; }); }
    function onScreen(o, m) { m = m || 0; return o.x > S.cam - m && o.x < S.cam + VIEW_W + m; }
    function foeInReach(h, reach) {
      return S.foes.some(function (f) { if (!f.alive || f.dying) return false; var dx = (f.x - h.x) * h.face; return dx > -8 && dx < reach + f.w && Math.abs(f.z - h.z) < ZR + 4; });
    }
    function foeInLane(h, range) {
      return S.foes.some(function (f) { if (!f.alive || f.dying || f.kind === 'imp') return false; var dx = (f.x - h.x) * h.face; return dx > 0 && dx < range && Math.abs(f.z - h.z) < 26 && onScreen(f, 10); });
    }
    function targetable(f) { return f.alive && !f.dying && f.inv <= 0 && f.state !== 'down' && f.state !== 'rise' && f.state !== 'thrown' && f.state !== 'grabbed' && !(f.kind === 'boss' && f.intro > 0); }
    function hitBox(att, reach, both, f, hRange) {
      var dx = f.x - att.x;
      if (Math.abs(f.z - att.z) > ZR + (f.kind === 'boss' ? 6 : 0)) return false;
      if (Math.abs(f.h - att.h) > (hRange || 70)) return false;
      var w = f.w || 16;
      if (both) return Math.abs(dx) < reach + w;
      dx *= att.face; return dx > -10 && dx < reach + w;
    }
    function heroStrike(h, mv) {
      var n = 0;
      S.foes.forEach(function (f) {
        if (!targetable(f) || h.hits[f.id]) return;
        if (!hitBox(h, mv.reach, mv.both, f)) return;
        h.hits[f.id] = 1; n++;
        var dir = mv.both ? sgn(f.x - h.x) : h.face;
        hitFoe(f, mv.d, { kd: mv.kd, dir: dir, unblock: mv.unblock, src: h, name: mv.name });
      });
      return n;
    }

    function hitFoe(f, dmg, o) {
      o = o || {}; var dir = o.dir || 1;
      if (f.kind === 'imp') { impHit(f, dir, o.src); return; }
      // щитоносец держит удары в лоб
      if (f.type === 'shield' && !f.mount && f.kind === 'foe' && !o.unblock && !o.magic && (f.state === 'walk' || f.state === 'idle' || f.state === 'guard') && f.face === -dir && rng() < f.def.block) {
        f.state = 'guard'; f.st = 0; ev('block', { x: f.x, z: f.z, h: 50 }); return;
      }
      f.hp -= dmg; S.score += PTS.hit; f.flash = 0.12;
      ev('hit', { x: f.x, z: f.z, h: 50, dmg: dmg, kind: f.kind, src: o.src ? o.src.pi : -1 });
      if (f.mount) { knockOff(f, dir); o.kd = 1; }
      if (f.hp <= 0) { killFoe(f, dir, o); return; }
      if (f.kind === 'boss') {
        f.poise += dmg;
        if (o.magic) { knockDown(f, dir, 0.9); f.poise = 0; return; }
        if (f.poise >= f.def.poise) { f.poise = 0; if (o.kd) knockDown(f, dir, 0.7); else hurt(f, dir, 0.42); }
        return;
      }
      if (f.def.poise && !o.kd && !o.magic) { f.poise += dmg; if (f.poise < f.def.poise) return; f.poise = 0; }
      if (o.kd || o.magic) knockDown(f, dir, 0.9); else hurt(f, dir, 0.34);
    }
    function hurt(e, dir, t) { e.state = 'hurt'; e.st = 0; e.hurtT = t; e.vx = dir * 70; e.move = null; e.phase = ''; if (e.grab) releaseGrab(e, false); }
    function knockDown(e, dir, lie) {
      e.state = 'down'; e.st = 0; e.vh = 330; e.h = Math.max(e.h, 1); e.vx = dir * 170; e.lie = lie; e.landed = false; e.move = null; e.phase = '';
      if (e.grab) releaseGrab(e, false);
      if (e.kind === 'hero' && e.mount) dismount(e, true);
    }
    function killFoe(f, dir, o) {
      if (f.mount) knockOff(f, dir);
      f.dying = true; knockDown(f, dir, 0.9);
      S.kills++;
      S.score += f.def.score || 100;
      ev('kill', { x: f.x, z: f.z, type: f.type, kind: f.kind, boss: f.kind === 'boss' });
      if (f.type === 'brute' && rng() < 0.5) S.items.push({ kind: 'bread', x: f.x, z: f.z, h: 20, vh: 150, t: 0 });
      if (f.kind === 'boss') { f.lie = 2.2; ev('bossDie', { x: f.x, z: f.z, key: f.type }); }
    }
    function impHit(f, dir, src) {
      if (f.inv > 0) return;
      f.inv = 0.35; f.state = 'hurt'; f.st = 0; f.vx = dir * 60;
      S.score += PTS.impHit;
      if (f.bags > 0) {
        f.bags--;
        var kind = (S.bonus ? rng() < 0.7 : rng() < 0.8) ? 'jug' : (rng() < 0.75 ? 'bread' : 'pie');
        S.items.push({ kind: kind, x: f.x + dir * 22, z: clamp(f.z + R(-10, 10), 4, DEPTH - 4), h: 30, vh: 160, t: 0 });
        ev('drop', { x: f.x, z: f.z, kind: kind });
      }
      if (f.bags <= 0) f.flee = true;
    }

    // ---------- Звери ----------
    function knockOff(rider, dir) {
      var m = rider.mount; if (!m) return;
      rider.mount = null; m.rider = null; m.state = 'spook'; m.spookT = 1.0; m.dir = dir || 1; m.face = m.dir;
      if (rider.kind === 'foe') rider.remountT = 5;
      ev('knockOff', { x: m.x, z: m.z, type: m.type });
    }
    function dismount(h, hit) {
      var m = h.mount; if (!m) return;
      h.mount = null; m.rider = null; m.state = hit ? 'spook' : 'idle'; m.spookT = hit ? 1.0 : 0; m.dir = -h.face; m.st = 0; m.lockT = 0.6;
      ev(hit ? 'knockOff' : 'dismount', { x: m.x, z: m.z, type: m.type, pi: h.pi });
    }
    function tryMount(h) {
      if (h.mount || h.state !== 'walk') return;
      for (var i = 0; i < S.mounts.length; i++) {
        var m = S.mounts[i];
        if (m.rider || m.state === 'spook' || m.lockT > 0) continue;
        if (Math.abs(m.x - h.x) < 30 && Math.abs(m.z - h.z) < 14) {
          h.mount = m; m.rider = h; m.state = 'ridden'; h.x = m.x; h.z = m.z; m.face = h.face;
          ev('mount', { pi: h.pi, type: m.type, x: m.x, z: m.z }); return;
        }
      }
    }
    function mountAttack(r, M) {
      r.state = 'mountAtk'; r.st = 0; r.phase = 'w'; r.pt = 0; r.hits = {}; r.tick = 0; r.mm = M;
      ev('beastWind', { type: r.mount.type, x: r.x, z: r.z });
    }
    function mountStrike(r) {
      var M = r.mm, isHero = r.kind === 'hero';
      if (M.breath) {
        r.tick -= 1 / 60;
        if (r.tick > 0) return; r.tick = 0.2;
        var targets = isHero ? S.foes : S.heroes;
        targets.forEach(function (t) {
          if (isHero ? !targetable(t) : !heroHittable(t)) return;
          var dx = (t.x - r.x) * r.face; if (dx < 10 || dx > M.reach || Math.abs(t.z - r.z) > 26 || t.h > 80) return;
          if (isHero) hitFoe(t, 4, { dir: r.face, unblock: 1, src: r }); else hitHero(t, M.dmg, { dir: r.face, src: 'breath' });
        });
        return;
      }
      var tg = isHero ? S.foes : S.heroes;
      tg.forEach(function (t) {
        if (r.hits[t.id]) return;
        if (isHero ? !targetable(t) : !heroHittable(t)) return;
        if (!hitBox(r, M.reach, M.both, t)) return;
        r.hits[t.id] = 1;
        var dir = sgn(t.x - r.x);
        if (isHero) hitFoe(t, 12, { kd: 1, dir: dir, unblock: 1, src: r }); else hitHero(t, M.dmg, { kd: 1, dir: dir, src: 'tail' });
      });
    }
    function updMountAtk(r, dt) {
      var M = r.mm; r.pt += dt;
      if (r.phase === 'w' && r.pt >= M.windup) { r.phase = 'a'; r.pt = 0; ev(M.breath ? 'breath' : 'tail', { x: r.x, z: r.z }); }
      if (r.phase === 'a') { mountStrike(r); if (r.pt >= M.act) { r.phase = 'r'; r.pt = 0; } }
      else if (r.phase === 'r' && r.pt >= M.rec) { r.state = r.kind === 'hero' ? 'idle' : 'walk'; r.phase = ''; r.cd = R(M.cd[0], M.cd[1]); }
    }

    // ---------- Захват и бросок ----------
    function grabAct(h) {
      var f = h.grab; if (!f) { h.state = 'idle'; return; }
      if (h.dx === -h.face || h.knees >= 2) { tossFoe(h, h.dx === -h.face ? -h.face : h.face); return; }
      h.knees++; h.grabT = 0; h.kneeT = 0.18;
      f.hp -= h.def.knee; S.score += PTS.hit; f.flash = 0.12;
      ev('hit', { x: f.x, z: f.z, h: 40, dmg: h.def.knee, kind: 'foe', knee: 1 });
      if (f.hp <= 0) { h.grab = null; h.state = 'idle'; f.state = 'walk'; killFoe(f, h.face, {}); }
    }
    function tossFoe(h, dir) {
      var f = h.grab; h.grab = null; h.state = 'toss'; h.st = 0; h.face = dir;
      f.state = 'thrown'; f.st = 0; f.vx = dir * 290; f.vh = 380; f.h = 30; f.x = h.x + dir * 10; f.tossDmg = h.def.toss; f.tossBy = h; f.hitSet = {};
      ev('toss', { pi: h.pi, x: h.x, z: h.z });
    }
    function releaseGrab(h, push) {
      var f = h.grab; h.grab = null; if (h.state === 'grab') h.state = 'idle';
      if (f && f.alive && f.state === 'grabbed') { f.state = 'hurt'; f.st = 0; f.hurtT = 0.25; f.vx = h.face * (push ? 120 : 60); }
    }

    // ---------- Урон героям ----------
    function heroHittable(h) { return h.alive && !h.out && h.inv <= 0 && h.state !== 'down' && h.state !== 'rise' && h.state !== 'cast' && h.state !== 'dead' && h.state !== 'out'; }
    function hitHero(h, dmg, o) {
      o = o || {}; if (!heroHittable(h)) return false;
      dmg = Math.round(dmg * S.dmgMul);
      h.hp -= dmg; ev('heroHit', { pi: h.pi, dmg: dmg, x: h.x, z: h.z, src: o.src });
      if (h.grab) releaseGrab(h, false);
      if (h.mount) { dismount(h, true); o.kd = 1; }
      h.combo = 0; h.comboT = 0; h.running = false;
      if (h.hp <= 0) { h.hp = 0; h.dying = true; h.lastHit = o.src || '?'; knockDown(h, o.dir || -h.face, 1.2); ev('heroDie', { pi: h.pi, x: h.x, z: h.z, src: o.src || '?' }); return true; }
      if (o.kd) knockDown(h, o.dir || -h.face, 0.55); else { hurt(h, o.dir || -h.face, 0.32); h.inv = 0.1; }
      return true;
    }

    // ---------- Обновление героя ----------
    function updHero(h, dt) {
      h.inv = Math.max(0, h.inv - dt); h.st += dt; h.jumpT += dt;
      if (h.comboT > 0) h.comboT -= dt; if (h.buf > 0) h.buf -= dt;
      if (h.out) return;
      if (h.state === 'dead') { h.respawnT -= dt; if (h.respawnT <= 0) respawn(h); return; }
      var sp = h.mount ? h.mount.def.speed : (h.running ? h.def.run : h.def.speed), zs = h.mount ? h.mount.def.zs : h.def.zs;
      switch (h.state) {
        case 'idle': case 'walk': {
          if (h.dx || h.dy) {
            h.state = 'walk';
            h.x += h.dx * sp * dt; h.z += h.dy * zs * dt;
            if (h.dx) h.face = h.dx;
            if (!h.mount) tryGrab(h, dt); tryMount(h);
          } else { h.state = 'idle'; h.contactT = 0; h.running = false; }
          if (h.buf > 0 && h.state !== 'grab') { h.buf = 0; attack(h.pi); }
          break;
        }
        case 'atk': {
          var mv = h.move; h.pt += dt;
          if (mv.dash && h.phase !== 'r') h.x += h.face * h.def.run * 1.05 * dt;
          if (mv.dash && h.phase === 'r') h.x += h.face * h.def.run * 0.4 * dt * Math.max(0, 1 - h.pt / mv.r);
          if (h.phase === 'w' && h.pt >= mv.w) {
            h.phase = 'a'; h.pt = 0;
            if (mv.arrow) { S.projs.push({ kind: 'arrow', x: h.x + h.face * 26, z: h.z, h: 52, vx: h.face * 620, d: mv.d, owner: h, life: h.def.range / 620 + 0.05 }); ev('arrow', { pi: h.pi }); }
          }
          if (h.phase === 'a') { if (!mv.arrow) heroStrike(h, mv); if (h.pt >= mv.a) { h.phase = 'r'; h.pt = 0; } }
          else if (h.phase === 'r' && h.pt >= mv.r) {
            h.state = 'idle'; h.move = null; h.comboT = mv.step != null ? 0.38 : 0;
            if (mv.step == null) h.combo = 0;
            if (mv.kd && mv.step != null) h.combo = 0;
            if (h.buf > 0) { h.buf = 0; attack(h.pi); }
          }
          break;
        }
        case 'mountAtk': updMountAtk(h, dt); if (h.dx) h.x += h.dx * sp * 0.2 * dt; break;
        case 'jump': {
          h.h += h.vh * dt; h.vh -= GRAV * dt; h.x += h.vx * dt; h.z += h.vz * dt;
          if (h.airAtk > 0) {
            h.airAtk -= dt;
            var A = h.def.air;
            S.foes.forEach(function (f) {
              if (!targetable(f) || h.airHit[f.id]) return;
              if (!hitBox(h, A.reach, false, f, 120)) return;
              h.airHit[f.id] = 1; hitFoe(f, A.d, { kd: 1, dir: h.face, unblock: 1, src: h, name: 'air' });
            });
          }
          if (h.h <= 0) { h.h = 0; h.vh = 0; h.state = 'idle'; h.airAtk = 0; ev('land', { pi: h.pi }); }
          break;
        }
        case 'grab': {
          var f = h.grab; h.grabT += dt; if (h.kneeT > 0) h.kneeT -= dt;
          if (!f || !f.alive || f.state !== 'grabbed') { h.grab = null; h.state = 'idle'; break; }
          f.x = clamp(h.x + h.face * 30, S.cam + 16, S.cam + VIEW_W - 16); h.x = f.x - h.face * 30; f.z = h.z; f.face = -h.face;
          if (h.grabT > 1.5) releaseGrab(h, false);
          break;
        }
        case 'toss': if (h.st > 0.34) h.state = 'idle'; break;
        case 'hurt': h.x += h.vx * dt; h.vx *= 0.85; if (h.st > h.hurtT) h.state = 'idle'; break;
        case 'cast': if (h.st > 1.15) { h.state = 'idle'; } break;
        case 'down': {
          if (!h.landed) {
            h.h += h.vh * dt; h.vh -= GRAV * dt; h.x += h.vx * dt;
            if (h.h <= 0) { h.h = 0; h.landed = true; h.st = 0; ev('thud', { x: h.x, z: h.z }); }
          } else if (h.st > h.lie) {
            if (h.dying) { h.state = 'dead'; h.lives--; h.respawnT = 1.0; ev('lifeLost', { pi: h.pi, lives: h.lives });
              if (h.lives <= 0) { h.out = true; h.state = 'out'; h.alive = false; ev('out', { pi: h.pi }); } }
            else { h.state = 'rise'; h.st = 0; }
          }
          break;
        }
        case 'rise': if (h.st > 0.32) { h.state = 'idle'; h.inv = Math.max(h.inv, 0.9); } break;
      }
      h.z = clamp(h.z, 0, DEPTH);
      var lo = S.cam + 22, hi = S.cam + VIEW_W - 22;
      h.x = clamp(h.x, lo, hi);
      if (h.mount) { h.mount.x = h.x; h.mount.z = h.z; h.mount.h = h.h; h.mount.face = h.face; }
    }
    function tryGrab(h, dt) {
      var best = null;
      for (var i = 0; i < S.foes.length; i++) {
        var f = S.foes[i];
        if (f.kind !== 'foe' || !f.alive || f.dying || f.mount || !f.def.grab) continue;
        if (f.state !== 'walk' && f.state !== 'idle' && f.state !== 'guard') continue;
        var dx = (f.x - h.x) * h.dx;
        if (dx > 0 && dx < 40 && Math.abs(f.z - h.z) < 12) { best = f; break; }
      }
      if (!best) { h.contactT = 0; h.contact = null; return; }
      if (h.contact !== best) { h.contact = best; h.contactT = 0; }
      h.contactT += dt;
      if (h.contactT > 0.14) {
        h.state = 'grab'; h.grab = best; h.grabT = 0; h.knees = 0; h.contactT = 0; h.running = false;
        best.state = 'grabbed'; best.st = 0; best.move = null; best.phase = '';
        ev('grab', { pi: h.pi, x: best.x, z: best.z });
      }
    }
    function respawn(h) {
      h.state = 'jump'; h.vh = 0; h.h = 220; h.vx = 0; h.vz = 0; h.airUsed = true; h.airAtk = 0; h.jumpT = 9;
      var mate = S.heroes.filter(function (o) { return o !== h && !o.out && o.alive; })[0];
      h.x = mate ? clamp(mate.x - 60, S.cam + 60, S.cam + VIEW_W - 60) : S.cam + 160; h.z = mate ? clamp(mate.z + 30, 0, DEPTH) : DEPTH * 0.5;
      h.hp = h.max; h.inv = 2.6; h.dying = false; h.combo = 0;
      // взрыв появления отталкивает ближайших
      S.foes.forEach(function (f) { if (f.kind === 'foe' && targetable(f) && Math.abs(f.x - h.x) < 150 && !f.mount) knockDown(f, sgn(f.x - h.x), 0.6); });
      ev('respawn', { pi: h.pi, x: h.x, z: h.z });
    }

    // ---------- Враги ----------
    function nearestHero(f) {
      var best = null, bd = 1e9;
      S.heroes.forEach(function (h) { if (h.out || !h.alive || h.state === 'dead') return; var d = Math.abs(h.x - f.x) + Math.abs(h.z - f.z) * 1.5; if (d < bd) { bd = d; best = h; } });
      return best;
    }
    function attackers() { var n = 0; S.foes.forEach(function (f) { if ((f.kind === 'foe' || f.kind === 'boss') && (f.state === 'atk' || f.state === 'mountAtk' || f.state === 'leap')) n++; }); return n; }
    function updFoe(f, dt) {
      f.st += dt; f.inv = Math.max(0, f.inv - dt); if (f.flash > 0) f.flash -= dt; if (f.remountT > 0) f.remountT -= dt;
      if (f.kind === 'imp') return updImp(f, dt);
      if (f.kind === 'boss') return updBoss(f, dt);
      var E = f.def, M = f.mount ? f.mount.def : null, t = nearestHero(f);
      var sp = M ? M.speed : E.speed, zs = M ? M.zs : E.zs;
      switch (f.state) {
        case 'walk': case 'idle': {
          f.cd -= dt;
          if (!t) { f.state = 'idle'; break; }
          // ничейный зверь рядом — оседлать
          if (!f.mount && f.remountT <= 0) {
            var mt = S.mounts.filter(function (m) { return !m.rider && m.state === 'idle' && !(m.lockT > 0) && Math.abs(m.x - f.x) < 220; })[0];
            if (mt && Math.abs(t.x - f.x) > 120) {
              moveTo(f, mt.x, mt.z, sp, zs, dt);
              if (Math.abs(mt.x - f.x) < 10 && Math.abs(mt.z - f.z) < 8) { f.mount = mt; mt.rider = f; mt.state = 'ridden'; ev('foeMount', { x: f.x, z: f.z }); }
              break;
            }
          }
          var reach = M ? M.reach : E.reach, side = sgn(f.x - t.x), slots = attackers() < (players === 2 ? 3 : 2);
          var range = reach * (M && M.breath ? 0.7 : 0.8);
          var tx = t.x + side * (slots && f.cd <= 0.4 ? range : 150 + f.aggro * 120), tz = slots && f.cd <= 0.4 ? t.z : clamp(t.z + (f.wz - 0.5) * 120, 0, DEPTH);
          moveTo(f, clamp(tx, S.cam + 34, S.cam + VIEW_W - 34), tz, sp * (slots ? 1 : 0.7), zs, dt);
          f.face = -side;
          var adx = Math.abs(t.x - f.x), adz = Math.abs(t.z - f.z);
          if (E.leap && !M && f.cd <= 0 && adx > 110 && adx < 200 && adz < 18 && slots) {
            if (!f.leapTry) { f.leapTry = true; if (rng() < 0.45) { f.state = 'leapWind'; f.st = 0; break; } }   // решает один раз на подходе
          } else if (adx > 220) f.leapTry = false;
          if (f.cd <= 0 && slots && adx < (M && M.breath ? reach - 15 : reach + 12) && adx > 12 && adz < 12 && onScreen(f, -10)) {
            if (M) { mountAttack(f, M); break; }
            f.state = 'atk'; f.phase = 'w'; f.pt = 0; f.hits = {}; ev('foeWind', { type: f.type, x: f.x, z: f.z });
          }
          break;
        }
        case 'atk': {
          f.pt += dt;
          if (f.phase === 'w' && f.pt >= E.windup) { f.phase = 'a'; f.pt = 0; ev('foeSwing', { type: f.type }); }
          if (f.phase === 'a') {
            S.heroes.forEach(function (h) {
              if (f.hits[h.id] || !heroHittable(h)) return;
              if (!hitBox(f, E.reach, false, h)) return;
              f.hits[h.id] = 1; hitHero(h, E.dmg, { kd: E.kd, dir: f.face, src: f.type });
            });
            if (f.pt >= E.act) { f.phase = 'r'; f.pt = 0; }
          } else if (f.phase === 'r' && f.pt >= E.rec) { f.state = 'walk'; f.phase = ''; f.cd = R(E.cd[0], E.cd[1]); }
          break;
        }
        case 'mountAtk': updMountAtk(f, dt); break;
        case 'leapWind': if (f.st > 0.28) { f.state = 'leap'; f.st = 0; f.vh = 430; f.h = 1; f.vx = f.face * 260; f.hits = {}; ev('leap', { x: f.x, z: f.z }); } break;
        case 'leap': {
          f.h += f.vh * dt; f.vh -= GRAV * dt; f.x += f.vx * dt;
          S.heroes.forEach(function (h) {
            if (f.hits[h.id] || !heroHittable(h)) return;
            if (Math.abs(h.x - f.x) < 34 && Math.abs(h.z - f.z) < ZR && h.h < 60) { f.hits[h.id] = 1; hitHero(h, E.dmg + 2, { kd: 1, dir: f.face, src: 'leap' }); }
          });
          if (f.h <= 0) { f.h = 0; f.state = 'walk'; f.cd = R(1.0, 1.8); }
          break;
        }
        case 'guard': if (f.st > 0.3) f.state = 'walk'; break;
        case 'hurt': f.x += f.vx * dt; f.vx *= 0.85; if (f.st > f.hurtT) { f.state = 'walk'; f.cd = Math.max(f.cd, R(0.4, 0.9)); } break;
        case 'grabbed': if (f.st > 2.2) { f.state = 'walk'; } break;
        case 'thrown': {
          f.h += f.vh * dt; f.vh -= GRAV * dt; f.x += f.vx * dt;
          S.foes.forEach(function (o) {
            if (o === f || o.kind !== 'foe' || !targetable(o) || f.hitSet[o.id]) return;
            if (Math.abs(o.x - f.x) < 38 && Math.abs(o.z - f.z) < 20) { f.hitSet[o.id] = 1; hitFoe(o, 9, { kd: 1, dir: sgn(f.vx), unblock: 1 }); }
          });
          if (f.h <= 0) {
            f.h = 0; f.hp -= f.tossDmg; S.score += PTS.hit * 2; ev('thud', { x: f.x, z: f.z, big: 1 }); f.flash = 0.15;
            if (f.hp <= 0) { f.state = 'walk'; killFoe(f, sgn(f.vx), {}); f.vh = 120; }
            else { f.state = 'down'; f.landed = true; f.st = 0; f.lie = 0.9; f.vx = 0; }
          }
          break;
        }
        case 'down': {
          if (!f.landed) {
            f.h += f.vh * dt; f.vh -= GRAV * dt; f.x += f.vx * dt;
            if (f.h <= 0) { f.h = 0; f.landed = true; f.st = 0; ev('thud', { x: f.x, z: f.z }); }
          } else if (f.st > f.lie) {
            if (f.dying) { f.alive = false; } else { f.state = 'rise'; f.st = 0; }
          }
          break;
        }
        case 'rise': if (f.st > 0.4) { f.state = 'walk'; f.cd = R(0.5, 1.1); f.inv = 0.2; } break;
      }
      f.z = clamp(f.z, 0, DEPTH);
      if (!f.entered && onScreen(f, -30)) f.entered = true;
      if (f.entered) f.x = clamp(f.x, S.cam + 16, S.cam + VIEW_W - 16);
      if (f.mount) { f.mount.x = f.x; f.mount.z = f.z; f.mount.h = f.h; f.mount.face = f.face; }
    }
    function moveTo(f, tx, tz, sp, zs, dt) {
      var dx = tx - f.x, dz = tz - f.z;
      if (Math.abs(dx) > 4) f.x += sgn(dx) * Math.min(Math.abs(dx), sp * dt);
      if (Math.abs(dz) > 3) f.z += sgn(dz) * Math.min(Math.abs(dz), zs * dt);
      f.moving = Math.abs(dx) > 4 || Math.abs(dz) > 3;
    }
    function updImp(f, dt) {
      if (f.state === 'hurt') { f.x += f.vx * dt; f.vx *= 0.85; if (f.st > 0.3) f.state = 'walk'; return; }
      f.pause -= dt;
      if (f.flee) { f.x += f.dir * 230 * dt; f.face = f.dir; }
      else if (f.pause > 0) { f.x += f.dir * 120 * dt; f.face = f.dir; }
      else { f.pause = R(0.8, 1.6); if (rng() < 0.3) f.dir = -f.dir; f.z = clamp(f.z + R(-30, 30), 4, DEPTH - 4); }
      if (!f.flee && (f.x < S.cam - 10 && f.dir < 0 || f.x > S.cam + VIEW_W + 10 && f.dir > 0)) { if (f.st > 6) f.flee = true; else f.dir = -f.dir; }
      if (f.flee && (f.x < S.cam - 80 || f.x > S.cam + VIEW_W + 80)) f.alive = false;
      if (f.st > 16) f.flee = true;
    }

    // ---------- Босс ----------
    function updBoss(b, dt) {
      var B = b.def, t = nearestHero(b);
      if (b.intro > 0) { b.intro -= dt; b.x -= 60 * dt; b.face = -1; return; }
      if (B.phases) { var ph = b.hp < b.max * 0.34 ? 2 : b.hp < b.max * 0.67 ? 1 : 0; if (ph > b.stage) { b.stage = ph; ev('phase', { n: ph }); b.summonT = 0; } }
      var fast = B.phases && b.stage >= 2 ? 1.25 : 1, sp = B.speed * fast;
      switch (b.state) {
        case 'walk': case 'idle': {
          b.cd -= dt * fast; b.summonT -= dt;
          if (!t) break;
          var side = sgn(b.x - t.x), adx = Math.abs(t.x - b.x), adz = Math.abs(t.z - b.z);
          b.face = -side;
          if (b.cd <= 0) {
            var mv = pickBossMove(b, adx, adz);
            if (mv) { b.state = 'atk'; b.move = mv; b.phase = 'w'; b.pt = 0; b.hits = {}; b.tz = t.z; ev('bossWind', { move: mv, key: b.type }); break; }
          }
          if (b.twin != null) { var other = S.foes.filter(function (o) { return o !== b && o.kind === 'boss' && o.alive && !o.dying; })[0]; if (other && other.state === 'atk' && b.cd < 0.6) b.cd = 0.6; }
          moveTo(b, clamp(t.x + side * B.reach * 0.75, S.cam + 40, S.cam + VIEW_W - 40), t.z, sp, B.zs, dt);
          break;
        }
        case 'atk': bossMove(b, dt, t); break;
        case 'hurt': b.x += b.vx * dt; b.vx *= 0.85; if (b.st > b.hurtT) { b.state = 'walk'; b.cd = Math.max(b.cd, 0.5); } break;
        case 'down': {
          if (!b.landed) { b.h += b.vh * dt; b.vh -= GRAV * dt; b.x += b.vx * 0.6 * dt; if (b.h <= 0) { b.h = 0; b.landed = true; b.st = 0; ev('thud', { x: b.x, z: b.z, big: 1 }); } }
          else if (b.st > b.lie) { if (b.dying) b.alive = false; else { b.state = 'rise'; b.st = 0; } }
          break;
        }
        case 'rise': if (b.st > 0.5) { b.state = 'walk'; b.inv = 0.6; b.cd = 0.8; } break;
      }
      b.z = clamp(b.z, 0, DEPTH);
      b.x = clamp(b.x, S.cam + 30, S.cam + VIEW_W - 30 + (b.intro > 0 ? 200 : 0));
    }
    function pickBossMove(b, adx, adz) {
      var mv = b.def.moves, opts = [];
      if (adx < b.def.reach + 26 && adz < 16) { if (mv.indexOf('combo') >= 0) opts.push('combo', 'combo'); if (mv.indexOf('sweep') >= 0) opts.push('sweep'); }
      if (adx > 200 && mv.indexOf('charge') >= 0 && adz < 40) opts.push('charge');
      if (adx > 120 && adx < 420 && mv.indexOf('slam') >= 0) opts.push('slam');
      if (adx > 60 && adx < 200 && adz < 22 && mv.indexOf('breath') >= 0) opts.push('breath', 'breath');
      if (mv.indexOf('pour') >= 0 && b.stage >= 1 && adx > 80) opts.push('pour');
      if (mv.indexOf('summon') >= 0 && b.stage >= 2 && b.summonT <= 0 && S.foes.filter(function (f) { return f.kind === 'foe' && f.alive; }).length < 2) opts.push('summon', 'summon', 'summon');
      if (!opts.length) return null;
      return opts[Math.floor(rng() * opts.length)];
    }
    var BMOVE = { combo: { w: 0.56, a: 0.12, r: 0.6 }, charge: { w: 0.7, a: 1.1, r: 0.6 }, slam: { w: 0.75, a: 0.1, r: 0.7 }, sweep: { w: 0.6, a: 0.14, r: 0.6 },
      breath: { w: 0.6, a: 0.9, r: 0.55 }, pour: { w: 0.7, a: 0.1, r: 0.8 }, summon: { w: 0.8, a: 0.1, r: 0.6 } };
    function bossMove(b, dt, t) {
      var B = b.def, m = BMOVE[b.move]; b.pt += dt;
      if (b.phase === 'w') {
        if (b.move === 'charge' && t) { b.z += clamp(b.tz - b.z, -40 * dt, 40 * dt); b.face = sgn(t.x - b.x); }
        if (b.pt >= m.w) { b.phase = 'a'; b.pt = 0; b.tick = 0; ev('bossAct', { move: b.move, key: b.type, x: b.x, z: b.z }); bossActStart(b); }
        return;
      }
      if (b.phase === 'a') {
        if (b.move === 'combo' || b.move === 'sweep') bossHitBox(b, b.move === 'sweep' ? B.reach + 40 : B.reach + 8, b.move === 'sweep', B.dmg, true);
        else if (b.move === 'charge') {
          b.x += b.face * 440 * dt;
          bossHitBox(b, 30, true, B.dmg + 2, true);
          if (b.x < S.cam + 40 || b.x > S.cam + VIEW_W - 40) b.pt = m.a;
        } else if (b.move === 'breath') {
          b.tick -= dt; if (b.tick <= 0) { b.tick = 0.15; S.heroes.forEach(function (h) { if (!heroHittable(h)) return; var dx = (h.x - b.x) * b.face; if (dx > 10 && dx < 210 && Math.abs(h.z - b.z) < 28 && h.h < 80) hitHero(h, 4, { dir: b.face, src: 'breath' }); }); }
        }
        if (b.pt >= m.a) { b.phase = 'r'; b.pt = 0; }
        return;
      }
      if (b.pt >= m.r) { b.state = 'walk'; b.phase = ''; b.move = null; b.cd = R(1.0, 1.9) * (b.twin != null ? 1.4 : 1); }
    }
    function bossActStart(b) {
      if (b.move === 'slam') { [-1, 1].forEach(function (d) { S.waves.push({ x: b.x + d * 30, z: b.z, dir: d, life: 1.5, hits: {}, dmg: b.def.dmg }); }); }
      if (b.move === 'pour') {
        S.heroes.forEach(function (h) { if (h.out || !h.alive) return; S.puddles.push({ x: h.x, z: h.z, warn: 0.9, burn: 2.6, r: 44, tick: 0 }); });
        S.puddles.push({ x: S.cam + R(100, VIEW_W - 100), z: R(20, DEPTH - 20), warn: 1.0, burn: 2.4, r: 40, tick: 0 });
      }
      if (b.move === 'summon') {
        b.summonT = 12;
        ['brute', 'raider'].forEach(function (ty, i) { var f = mkFoe(ty, i ? S.cam - 40 : S.cam + VIEW_W + 40, R(20, DEPTH - 20)); f.face = i ? 1 : -1; });
        ev('summon', {});
      }
    }
    function bossHitBox(b, reach, both, dmg, kd) {
      S.heroes.forEach(function (h) {
        if (b.hits[h.id] || !heroHittable(h)) return;
        if (!hitBox(b, reach, both, h)) return;
        b.hits[h.id] = 1; hitHero(h, dmg, { kd: kd, dir: sgn(h.x - b.x), src: 'boss:' + b.type + ':' + b.move });
      });
    }

    // ---------- Звери без седока ----------
    function updMount(m, dt) {
      m.st += dt; if (m.lockT > 0) m.lockT -= dt;
      if (m.rider) return;
      if (m.state === 'spook') { m.x += m.dir * 160 * dt; m.spookT -= dt; m.face = m.dir; if (m.spookT <= 0) { m.state = 'idle'; m.st = 0; } }
      else { m.state = 'idle'; if (m.st > 1.5) { m.st = 0; m.face = rng() < 0.5 ? 1 : -1; } m.x += m.face * 14 * dt; }
      m.x = clamp(m.x, S.cam + 30, S.cam + VIEW_W - 30); m.z = clamp(m.z, 0, DEPTH); m.h = 0;
    }

    // ---------- Снаряды, волны, лужи, предметы ----------
    function updProjs(dt) {
      S.projs = S.projs.filter(function (p) {
        p.x += p.vx * dt; p.life -= dt;
        for (var i = 0; i < S.foes.length; i++) {
          var f = S.foes[i]; if (!targetable(f)) continue;
          if (Math.abs(f.x - p.x) < f.w + 6 && Math.abs(f.z - p.z) < ZR + 4 && f.h < 80) { hitFoe(f, p.d, { dir: sgn(p.vx), src: p.owner, name: 'arrow' }); return false; }
        }
        return p.life > 0 && onScreen(p, 40);
      });
      S.waves = S.waves.filter(function (w) {
        w.x += w.dir * 380 * dt; w.life -= dt;
        S.heroes.forEach(function (h) { if (w.hits[h.id] || !heroHittable(h)) return; if (Math.abs(h.x - w.x) < 22 && Math.abs(h.z - w.z) < 30 && h.h < 14) { w.hits[h.id] = 1; hitHero(h, w.dmg, { kd: 1, dir: w.dir, src: 'wave' }); } });
        return w.life > 0;
      });
      S.puddles = S.puddles.filter(function (p) {
        if (p.warn > 0) { p.warn -= dt; return true; }
        p.burn -= dt; p.tick -= dt;
        if (p.tick <= 0) { p.tick = 0.4; S.heroes.forEach(function (h) { if (!heroHittable(h)) return; if (Math.abs(h.x - p.x) < p.r && Math.abs(h.z - p.z) < p.r * 0.45 && h.h < 10) hitHero(h, 5, { dir: sgn(h.x - p.x), src: 'pour' }); }); }
        return p.burn > 0;
      });
      S.items = S.items.filter(function (it) {
        it.t += dt;
        if (it.h > 0 || it.vh > 0) { it.h += it.vh * dt; it.vh -= GRAV * dt; if (it.h <= 0) { it.h = 0; it.vh = 0; } }
        if (it.t < 0.3) return true;
        for (var i = 0; i < S.heroes.length; i++) {
          var h = S.heroes[i]; if (h.out || !h.alive || h.state === 'dead' || h.state === 'down') continue;
          if (Math.abs(h.x - it.x) < 28 && Math.abs(h.z - it.z) < 18 && h.h < 30) {
            if (it.kind === 'jug') { if (h.jugs >= JUG_MAX) continue; h.jugs++; S.score += PTS.jug; }
            else { if (h.hp >= h.max && !S.bonus) continue; h.hp = Math.min(h.max, h.hp + (it.kind === 'pie' ? 60 : 28)); S.score += PTS.food; }
            ev('pickup', { pi: h.pi, kind: it.kind, x: it.x, z: it.z }); return false;
          }
        }
        return it.t < 25 && it.x > S.cam - 60;
      });
    }
    function updSpells(dt) {
      S.spells = S.spells.filter(function (sp) {
        sp.t += dt;
        if (!sp.done && sp.t >= 0.7) {
          sp.done = true;
          S.foes.forEach(function (f) {
            if (!f.alive || f.dying || !onScreen(f, 10) || f.kind === 'imp') return;
            if (f.kind === 'boss' && f.intro > 0) return;
            if (f.state === 'grabbed') f.state = 'walk';
            f.inv = 0;
            hitFoe(f, f.kind === 'boss' ? Math.round(sp.dmg * 0.6) : sp.dmg, { magic: 1, kd: 1, dir: sgn(f.x - sp.x), unblock: 1 });
          });
          ev('spell', { kind: sp.kind, level: sp.level, pi: sp.pi });
        }
        return sp.t < 1.4;
      });
    }

    // ---------- Камера, волны, ход этапа ----------
    function updCamera(dt) {
      var live = S.heroes.filter(function (h) { return !h.out && h.state !== 'dead'; });
      if (!live.length) return;
      var lead = Math.max.apply(null, live.map(function (h) { return h.x; })), back = Math.min.apply(null, live.map(function (h) { return h.x; }));
      var want = Math.min(lead - VIEW_W * 0.5, back - 40);
      var st = STAGES[S.stage - 1];
      if (S.lock == null) {
        var next = S.waveIdx < st.waves.length ? st.waves[S.waveIdx][0] : S.len - VIEW_W;
        var nc = clamp(want, S.cam, next);
        S.cam += Math.min(nc - S.cam, 240 * dt);
        if (S.cam >= next - 0.5) { S.cam = next; if (S.waveIdx < st.waves.length) lockWave(st.waves[S.waveIdx]); else if (!S.bossOn) lockBoss(); }
      }
    }
    function updWaves(dt) {
      if (S.queue.length) {
        S.spawnT -= dt;
        var live = S.foes.filter(function (f) { return f.alive && f.kind === 'foe'; }).length;
        if (S.spawnT <= 0 && live < (players === 2 ? 5 : 4)) { spawnEntry(S.queue.shift()); S.spawnT = R(0.5, 1.0); }
      }
      var active = S.foes.some(function (f) { return f.alive && (f.kind === 'foe' || f.kind === 'boss'); });
      if (S.lock != null && !S.queue.length && !active && !S.bossOn) { S.lock = null; S.go = 2.5; ev('go', {}); }
      if (S.bossOn && !S.queue.length && !S.foes.some(function (f) { return f.kind === 'boss' && f.alive; })) stageClear();
      if (S.go > 0) S.go -= dt;
    }
    function stageClear() {
      if (S.phase !== 'play') return;
      S.foes.forEach(function (f) { if (f.alive && f.kind === 'foe' && !f.dying) killFoe(f, 1, {}); });
      var bonus = 0; S.heroes.forEach(function (h) { if (!h.out) bonus += Math.round(h.hp / h.max * 1000) * S.stage; });
      bonus += 2000 * S.stage; S.score += bonus; S.lastBonus = bonus;
      S.phase = 'clear'; S.phaseT = 3.2; ev('clear', { stage: S.stage, bonus: bonus });
    }
    function nextAfterClear() {
      if (S.stage >= S.maxStage) { S.phase = 'won'; S.won = true; ev('win', { score: S.score }); return; }
      if (BONUS_AFTER[S.stage] && opts.bonus !== false) { setupBonus(); return; }
      S.phase = 'play'; setupStage(S.stage + 1);
    }
    function updBonus(dt) {
      S.bonusT -= dt; S.impT -= dt;
      if (S.impQ > 0 && S.impT <= 0) { S.impQ--; S.impT = R(1.0, 1.6); var side = rng() < 0.5 ? 1 : -1; mkImp(side > 0 ? VIEW_W + 30 : -30, R(15, DEPTH - 15), -side, 2); }
      if (S.bonusT <= 0) {
        S.foes = []; S.items.forEach(function (it) { /* несобранное пропадает */ });
        ev('bonusEnd', {}); S.phase = 'play'; setupStage(S.stage + 1);
      }
    }

    function separate() {
      var list = S.foes.filter(function (f) { return f.alive && !f.dying && (f.state === 'walk' || f.state === 'idle') && f.kind !== 'imp'; });
      for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j], dx = b.x - a.x, dz = b.z - a.z;
        if (Math.abs(dx) < 28 && Math.abs(dz) < 12) { var p = (28 - Math.abs(dx)) * 0.5 * 0.2; a.x -= sgn(dx) * p; b.x += sgn(dx) * p; }
      }
    }

    function checkLoss() {
      if (S.phase === 'continue' || S.phase === 'over') return;
      if (S.heroes.every(function (h) { return h.out; })) {
        if (S.continues > 0) { S.phase = 'continue'; S.contT = 9.99; ev('continueAsk', { left: S.continues }); }
        else { S.phase = 'over'; S.over = true; ev('gameover', { score: S.score }); }
      }
    }
    function continue_() {
      if (S.phase !== 'continue') return false;
      S.continues--; S.phase = S.bonus ? 'bonus' : 'play';
      S.heroes.forEach(function (h) { h.lives = 3; h.out = false; h.alive = true; h.dying = false; h.jugs = Math.max(h.jugs, 2); respawn(h); });
      ev('continue', { left: S.continues });
      return true;
    }

    function update(dt) {
      if (!S) return;
      dt = Math.min(dt, 0.05);
      S.time += dt; if (S.banner > 0) S.banner -= dt;
      if (S.phase === 'won' || S.phase === 'over') return;
      if (S.phase === 'continue') { S.contT -= dt; if (S.contT <= 0) { S.phase = 'over'; S.over = true; ev('gameover', { score: S.score }); } return; }
      if (S.phase === 'clear') {
        S.phaseT -= dt; S.heroes.forEach(function (h) { if (!h.out && h.state !== 'dead') updHero(h, dt); });
        S.foes.forEach(function (f) { if (f.alive) updFoe(f, dt); }); S.foes = S.foes.filter(function (f) { return f.alive; });
        if (S.phaseT <= 0) nextAfterClear(); return;
      }
      var frozen = S.freeze > 0; if (frozen) S.freeze -= dt;
      S.heroes.forEach(function (h) { if (!frozen || h.state === 'cast') updHero(h, dt); });
      if (!frozen) {
        S.foes.forEach(function (f) { if (f.alive) updFoe(f, dt); });
        S.mounts.forEach(function (m) { updMount(m, dt); });
        updProjs(dt); separate();
      }
      updSpells(dt);
      S.foes = S.foes.filter(function (f) { return f.alive; });
      S.mounts = S.mounts.filter(function (m) { return m.rider || m.x > S.cam - 150; });
      if (S.phase === 'bonus') updBonus(dt);
      else if (!opts.arena) { updCamera(dt); updWaves(dt); }   // arena — песочница для автотестов: без волн и камеры
      if (S.score >= S.nextExtra) { S.nextExtra += PTS.extra; S.heroes.forEach(function (h) { if (!h.out) h.lives++; }); ev('extraLife', {}); }
      checkLoss();
    }

    var api = {
      start: start, update: update, state: function () { return S; }, get _S() { return S; },
      setDir: setDir, attack: attack, jump: jump, magic: magic, special: special, continue_: continue_, magicLevel: magicLevel,
      _spawn: function (type, x, z, o) { return mkFoe(type, x, z, o); }, _imp: function (x, z, d, b) { return mkImp(x, z, d, b); },
      _boss: function (key, x, z) { var b = mkBoss(key, x, z); b.intro = 0; return b; }, _mount: mkMount,
      _hitHero: hitHero, _hitFoe: hitFoe, _stageClear: stageClear, _lockBoss: lockBoss
    };
    return api;
  }

  D.logic = { VIEW_W: VIEW_W, SCREEN_H: SCREEN_H, HUD: HUD, FLOOR_TOP: FLOOR_TOP, DEPTH: DEPTH, GRAV: GRAV, ZR: ZR,
    HEROES: HEROES, HERO_KEYS: HERO_KEYS, ENEMIES: ENEMIES, MOUNTS: MOUNTS, BOSSES: BOSSES, STAGES: STAGES, BONUS_AFTER: BONUS_AFTER,
    JUG_MAX: JUG_MAX, PTS: PTS, parseWave: parseWave, mulberry32: mulberry32, clamp: clamp,
    // раскладки: И1 — стрелки, / удар, пробел прыжок, . магия, , «спина»; И2 — WASD, X удар, Z прыжок, C магия, V «спина»
    BIND: {
      p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], attack: ['Slash'], jump: ['Space'], magic: ['Period'], back: ['Comma'] },
      p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], attack: ['KeyX'], jump: ['KeyZ'], magic: ['KeyC'], back: ['KeyV'] }
    } };
  D.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
