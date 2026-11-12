/* ============================================================
   ПРОРЫВ HTML5 — ядро игры
   Оригинальная механика жанра (студия «Гефест»)
   256×192 поле + 16 px HUD, тайл 8 px, 32×24 тайла.
   Здесь: настройки, уровни/экраны, физика, враги, оружие,
   состояние (меню/брифинг/игра/бонус), ввод, счёт, тесты.
   ============================================================ */
(function () {
  'use strict';

  const TILE = 8;
  const COLS = 32;
  const ROWS = 24;
  const W = COLS * TILE;          // 256
  const H = ROWS * TILE;          // 192
  const HUD = 16;
  const VH = H + HUD;             // 208

  /* тайлы */
  const T_EMPTY = 0, T_SOLID = 1, T_THIN = 2, T_ROCK = 3, T_SPIKE = 4, T_FLORA = 5;
  const TILE_CHARS = { ' ': T_EMPTY, '#': T_SOLID, '=': T_THIN, '%': T_ROCK, '^': T_SPIKE, 'x': T_FLORA };

  /* палитра ZX Spectrum */
  const PAL = {
    black: '#000000', blue: '#0000d7', red: '#d70000', magenta: '#d700d7',
    green: '#00d700', cyan: '#00d7d7', yellow: '#d7d700', white: '#d7d7d7',
    bblue: '#0000ff', bred: '#ff0000', bmagenta: '#ff00ff', bgreen: '#00ff00',
    bcyan: '#00ffff', byellow: '#ffff00', bwhite: '#ffffff'
  };
  /* современная неоновая палитра */
  const NEON = {
    void: '#05030f', deep: '#0b0820', panel: 'rgba(14,10,32,0.72)',
    cyan: '#39f6ff', lime: '#b6ff3c', magenta: '#ff3ff0', violet: '#8a5cff',
    amber: '#ffcc55', red: '#ff4d6d', white: '#f2f0ff', dim: '#7c74a8'
  };

  /* ---------- ГСЧ ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

  /* ---------- настройки ---------- */
  const DEFAULTS = { lang: 'ru', gfx: 'retro', music: true, sfx: true, crt: true };
  const SETTINGS_KEY = 'exolon.settings';
  const RECORD_KEY = 'exolon.record';

  function parseHash() {
    const out = {};
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return out;
    raw.split('&').forEach((pair) => {
      const i = pair.indexOf('=');
      if (i < 0) out[pair] = true;
      else out[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
    });
    return out;
  }
  const HASH = parseHash();

  function loadSettings() {
    const s = Object.assign({}, DEFAULTS);
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(s, JSON.parse(raw));
    } catch (e) { /* приватный режим */ }
    /* RETRO — режим по умолчанию всегда: выбор графики живёт только в рамках сессии,
       чтобы после перезапуска игра снова открывалась в аутентичном ZX-стиле. */
    s.gfx = 'retro';
    if (HASH.lang === 'en' || HASH.lang === 'ru') s.lang = HASH.lang;
    if (HASH.gfx === 'modern' || HASH.gfx === 'retro') s.gfx = HASH.gfx;
    if (HASH.nosound) { s.music = false; s.sfx = false; }
    if (s.gfx !== 'modern') s.gfx = 'retro';
    if (s.lang !== 'en') s.lang = 'ru';
    return s;
  }

  const EX = (window.EX = window.EX || {});
  EX.HASH = HASH;
  EX.TILE = TILE; EX.COLS = COLS; EX.ROWS = ROWS; EX.W = W; EX.H = H;
  EX.HUD = HUD; EX.VH = VH; EX.PAL = PAL; EX.NEON = NEON;
  EX.TILES = { EMPTY: T_EMPTY, SOLID: T_SOLID, THIN: T_THIN, ROCK: T_ROCK, SPIKE: T_SPIKE, FLORA: T_FLORA };
  EX.clamp = clamp;
  EX.settings = loadSettings();

  EX.t = function (key, vars) { return window.EX_T(key, vars); };
  EX.saveSettings = function () {
    try {
      /* gfx не сохраняем: при каждом запуске — RETRO, переключение только на сессию */
      const toSave = {
        lang: EX.settings.lang,
        music: EX.settings.music,
        sfx: EX.settings.sfx,
        crt: EX.settings.crt
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSave));
    } catch (e) { /* ok */ }
  };
  EX.loadRecord = function () {
    try { return parseInt(localStorage.getItem(RECORD_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  };
  EX.saveRecord = function (v) {
    try { localStorage.setItem(RECORD_KEY, String(v | 0)); } catch (e) { /* ok */ }
  };

  /* ---------- аудио-хелперы (модуль может быть заглушкой) ---------- */
  const A = () => window.EX_AUDIO;
  function snd(id) { try { const a = A(); if (a && a.sfx) a.sfx(id); } catch (e) { /* ok */ } }
  function music(id) { try { const a = A(); if (a && a.playMusic) a.playMusic(id); } catch (e) { /* ok */ } }
  function duck(on) { try { const a = A(); if (a && a.duck) a.duck(on); } catch (e) { /* ok */ } }
  function intensity(v) { try { const a = A(); if (a && a.setIntensity) a.setIntensity(v); } catch (e) { /* ok */ } }

  /* ============================================================
     ВВОД
     main.js пишет сюда состояния; ядро читает и потребляет actions.
     ============================================================ */
  const input = EX.input = {
    left: false, right: false, up: false, down: false, fire: false,
    actions: [],              // строки: 'enter','escape','pause','lang','gfx','music','sfx','restart','fullscreen','action'
    pointer: { x: -1, y: -1, down: false, clicked: false },
    prevFire: false
  };
  EX.pushAction = function (a) { input.actions.push(a); };

  /* ============================================================
     СОСТОЯНИЕ
     ============================================================ */
  const state = EX.state = {
    mode: 'boot',
    t: 0,                  // глобальное время, c
    screenT: 0,            // время на текущем экране
    level: 0,
    screen: 0,
    lives: 5,
    score: 0,
    record: 0,
    woreExo: false,
    menuIndex: 0,
    settingsIndex: 0,
    settingsReturn: 'title',
    player: null,
    ents: [],
    shots: [],
    eShots: [],
    particles: [],
    pops: [],
    booms: [],
    world: null,
    transition: 0,         // 0..1 прогресс флипа
    transDir: 1,
    bonus: null,
    message: null,
    deadTimer: 0,
    clearTimer: 0,
    fx: { shake: 0, flash: 0, flashColor: '#ffffff', chroma: 0, hitFlash: 0 },
    tips: 0,
    tutorial: 0,
    debug: {}
  };

  /* ============================================================
     УРОВНИ / ЭКРАНЫ
     ============================================================ */
  function levelData(i) {
    const L = window.EX_LEVELS || [];
    return L[clamp(i, 0, Math.max(0, L.length - 1))] || null;
  }
  EX.levelData = levelData;
  EX.levelCount = function () { return (window.EX_LEVELS || []).length; };
  EX.screenCount = function (li) { const l = levelData(li); return l ? l.screens.length : 0; };

  const TIDX = (x, y) => y * COLS + x;
  const world = (window.EX_WORLD = window.EX_WORLD || {});

  function tileIdAt(tx, ty) {
    const w = state.world;
    if (!w) return T_EMPTY;
    if (tx < 0 || tx >= COLS) return T_EMPTY;
    if (ty >= ROWS) return T_SOLID;       // ниже экрана — пол
    if (ty < 0) return T_EMPTY;
    return w.tiles[TIDX(tx, ty)];
  }
  EX.tileAt = tileIdAt;

  function isBlocking(tx, ty) {
    const t = tileIdAt(tx, ty);
    return t === T_SOLID || t === T_ROCK;
  }
  EX.isBlocking = isBlocking;

  function findSpawn(tiles) {
    for (let y = ROWS - 2; y >= 0; y--) {
      for (let x = 1; x < COLS - 1; x++) {
        const t = tiles[TIDX(x, y)];
        const below = tiles[TIDX(x, y + 1)];
        if ((t === T_EMPTY || t === T_FLORA) && (below === T_SOLID || below === T_THIN)) {
          return { x: x * TILE, y: (y + 1) * TILE - 18 };
        }
      }
    }
    return { x: 16, y: 96 };
  }

  function loadScreen(level, screen, opts) {
    opts = opts || {};
    const lv = levelData(level);
    if (!lv) return;
    const def = lv.screens[clamp(screen, 0, lv.screens.length - 1)];
    state.level = level;
    state.screen = screen;
    state.woreExo = state.woreExo && !!opts.keepExo;
    state.screenT = 0;
    state.transition = 0;
    state.ents = [];
    state.shots = [];
    state.eShots = [];
    state.particles = [];
    state.pops = [];
    state.booms = [];
    state.fx.shake = 0;
    state.fx.flash = 0;
    state.bonus = null;
    state.tutorial = 0;

    const tiles = new Uint8Array(COLS * ROWS);
    const rows = def.tiles || [];
    for (let y = 0; y < ROWS; y++) {
      const row = rows[y] || '';
      for (let x = 0; x < COLS; x++) {
        const ch = row[x] || ' ';
        tiles[TIDX(x, y)] = TILE_CHARS[ch] == null ? T_EMPTY : TILE_CHARS[ch];
      }
    }
    state.world = {
      tiles,
      level,
      screen,
      theme: lv.theme || 'space',
      name: def.name || null
    };
    if (opts.seed != null) state.world.seed = opts.seed;
    else state.world.seed = (level * 131 + screen * 17 + 7) | 0;

    /* сущности */
    (def.entities || []).forEach(function (d) { addEntity(d); });

    /* игрок */
    if (!state.player || opts.fresh) {
      state.player = makePlayer();
    }
    const sp = def.spawn ? { x: def.spawn.x * TILE, y: (def.spawn.y + 1) * TILE - 18 } : findSpawn(tiles);
    const p = state.player;
    p.x = sp.x; p.y = sp.y;
    p.vx = 0; p.vy = 0;
    p.onGround = false;
    p.duck = false;
    p.alive = true;
    p.invuln = opts.invuln != null ? opts.invuln : 1.2;
    p.fireHeld = 0;
    p.cool = 0;
    p.didGrenade = false;
    if (opts.freshAmmo) { p.laser = 60; p.rockets = 2; }
    if (opts.keepExo) { p.exo = true; p.armor = 3; } else if (!opts.keepExo) { p.exo = false; p.armor = 0; }
  }
  EX.loadScreen = loadScreen;

  function makePlayer() {
    return {
      x: 16, y: 100, w: 10, h: 16, vx: 0, vy: 0,
      dir: 1, facing: 1, onGround: false, duck: false,
      laser: 60, maxLaser: 100, rockets: 2, maxRockets: 6,
      exo: false, armor: 0, invuln: 1.5, alive: true,
      fireHeld: 0, cool: 0, didGrenade: false, coyote: 0, jumpBuf: 0,
      anim: 0, step: 0, air: 0, hitT: 0
    };
  }
  EX.makePlayer = makePlayer;

  /* ============================================================
     СУЩНОСТИ
     ============================================================ */
  const ENEMY = {
    walker: { w: 14, h: 12, hp: 1, score: 150, blast: true, grenade: true },
    flyer: { w: 16, h: 12, hp: 1, score: 150, blast: true, grenade: true },
    swarmer: { w: 8, h: 8, hp: 1, score: 50, blast: true, grenade: true },
    turret: { w: 12, h: 10, hp: 1, score: 150, blast: false, grenade: true },
    tank: { w: 16, h: 12, hp: 2, score: 200, blast: false, grenade: true },
    mine: { w: 8, h: 6, hp: 1, score: 50, blast: true, grenade: true },
    crusher: { w: 16, h: 16, hp: 999, score: 0, blast: false, grenade: false },
    pod: { w: 14, h: 12, hp: 1, score: 150, blast: false, grenade: true },
    homer: { w: 14, h: 12, hp: 3, score: 1000, blast: true, grenade: true },
    double_launcher: { w: 12, h: 16, hp: 1, score: 2000, blast: false, grenade: false },
    combo_launcher: { w: 14, h: 16, hp: 1, score: 3000, blast: false, grenade: false },
    power_laser: { w: 8, h: 8, hp: 1, score: 0, blast: false, grenade: false },
    power_rocket: { w: 8, h: 8, hp: 1, score: 0, blast: false, grenade: false },
    exo: { w: 16, h: 20, hp: 1, score: 0, blast: false, grenade: false },
    teleporter: { w: 12, h: 16, hp: 1, score: 0, blast: false, grenade: false }
  };
  EX.ENEMY = ENEMY;

  function addEntity(d) {
    const spec = ENEMY[d.t];
    if (!spec) return null;
    const e = {
      t: d.t,
      x: d.x * TILE, y: (d.y + 1) * TILE - spec.h,
      w: spec.w, h: spec.h,
      vx: 0, vy: 0,
      dir: d.dir != null ? d.dir : -1,
      hp: d.hp != null ? d.hp : spec.hp,
      range: (d.range != null ? d.range : 4) * TILE,
      phase: d.phase != null ? d.phase : Math.random(),
      group: d.group || 0,
      flip: !!d.flip,
      homeX: d.x * TILE, homeY: (d.y + 1) * TILE - spec.h,
      baseY: (d.y + 1) * TILE - spec.h,
      timer: d.t === 'teleporter' ? 0 : 0.4 + Math.random() * 1.2,
      anim: 0, dead: false, hitT: 0, state: 0, used: false,
      score: spec.score
    };
    state.ents.push(e);
    return e;
  }
  EX.addEntity = addEntity;

  /* ============================================================
     ФИЗИКА
     ============================================================ */
  function moveBody(e, dt) {
    const tiles = state.world ? state.world.tiles : null;
    if (!tiles) return;
    /* X */
    if (e.vx) {
      e.x += e.vx * dt;
      const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 0.01) / TILE);
      if (e.vx > 0) {
        const tx = Math.floor((e.x + e.w - 0.01) / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          if (isBlocking(tx, ty)) { e.x = tx * TILE - e.w; e.vx = 0; break; }
        }
      } else {
        const tx = Math.floor(e.x / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          if (isBlocking(tx, ty)) { e.x = (tx + 1) * TILE; e.vx = 0; break; }
        }
      }
      if (e.x < 0) { e.x = 0; e.vx = 0; }
      if (e.x > W - e.w) { e.x = W - e.w; e.vx = 0; }
    }
    /* Y */
    const prevBottom = e.y + e.h;
    e.y += e.vy * dt;
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
    e.onGround = false;
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const t = tileIdAt(tx, ty);
        const thin = t === T_THIN && prevBottom <= ty * TILE + 1.5;
        if (t === T_SOLID || t === T_ROCK || thin || ty >= ROWS) {
          e.y = ty * TILE - e.h; e.vy = 0; e.onGround = true; break;
        }
      }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (isBlocking(tx, ty)) { e.y = (ty + 1) * TILE; e.vy = 0; break; }
      }
    }
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function entityBox(e) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }
  function playerBox() {
    const p = state.player;
    const h = p.duck ? 10 : p.h;
    return { x: p.x, y: p.y + (p.h - h), w: p.w, h: h };
  }

  /* ============================================================
     ИГРОК
     ============================================================ */
  const PHYS = {
    speed: 78, accel: 700, airAccel: 520, friction: 900,
    gravity: 900, jump: -252, jumpCut: 0.42, maxFall: 420,
    duckSpeed: 32
  };
  EX.PHYS = PHYS;

  function updatePlayer(dt) {
    const p = state.player;
    if (!p || !p.alive) return;

    const wasFire = input.prevFire;
    input.prevFire = input.fire;

    if (p.invuln > 0) p.invuln -= dt;
    if (p.cool > 0) p.cool -= dt;
    if (p.hitT > 0) p.hitT -= dt;

    const duck = input.down && p.onGround && !p.exo;
    p.duck = duck;

    /* горизонталь */
    const maxSp = duck ? PHYS.duckSpeed : (p.exo ? PHYS.speed * 0.88 : PHYS.speed);
    const acc = p.onGround ? PHYS.accel : PHYS.airAccel;
    let want = 0;
    if (!duck) {
      if (input.left) want -= 1;
      if (input.right) want += 1;
    }
    if (want) {
      p.vx += want * acc * dt;
      p.vx = clamp(p.vx, -maxSp, maxSp);
      p.dir = want;
      p.facing = want;
    } else {
      const f = (p.onGround ? PHYS.friction : PHYS.airAccel * 0.5) * dt;
      if (Math.abs(p.vx) <= f) p.vx = 0; else p.vx -= sign(p.vx) * f;
    }

    /* прыжок */
    if (p.onGround) p.coyote = 0.09; else if (p.coyote > 0) p.coyote -= dt;
    if (input.up && !p.jumpHeld) p.jumpBuf = 0.12;
    p.jumpHeld = !!input.up;
    if (p.jumpBuf > 0) p.jumpBuf -= dt;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = PHYS.jump;
      p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
      snd('jump');
    }
    if (!input.up && p.vy < 0) p.vy *= 1 - (1 - PHYS.jumpCut) * clamp(dt * 22, 0, 1);

    /* гравитация */
    p.vy = clamp(p.vy + PHYS.gravity * dt, -600, PHYS.maxFall);
    p.air = p.onGround ? 0 : p.air + dt;

    const prevOnGround = p.onGround;
    moveBody(p, dt);
    if (!prevOnGround && p.onGround) {
      p.air = 0;
      if (p.invuln <= 0) snd('land');
    }

    /* анимация */
    p.anim += dt * (Math.abs(p.vx) > 6 ? 1 : 0);
    p.step = Math.abs(p.vx) > 6 ? (p.step + dt * 12) % 2 : 0;

    /* шипы */
    if (overlaps(playerBox(), { x: p.x, y: p.y, w: p.w, h: p.h })) {
      const b = playerBox();
      const tx0 = Math.floor(b.x / TILE), tx1 = Math.floor((b.x + b.w - 1) / TILE);
      const ty0 = Math.floor(b.y / TILE), ty1 = Math.floor((b.y + b.h - 1) / TILE);
      let spike = false;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (tileIdAt(tx, ty) === T_SPIKE) spike = true;
      }
      if (spike) hurtPlayer(1, 'spike');
    }

    /* оружие: клик — бластер, удержание — граната */
    const fireEdge = input.fire && !wasFire;
    const fireHeldNow = input.fire;
    if (fireEdge) {
      p.fireHeld = 0;
      p.didGrenade = false;
      fireBlaster();
    }
    if (fireHeldNow && input.fire) {
      p.fireHeld += dt;
      if (!p.didGrenade && p.fireHeld > 0.24) {
        p.didGrenade = true;
        throwGrenade();
      }
    }
    if (!input.fire) { p.fireHeld = 0; p.didGrenade = false; }
  }

  function fireBlaster() {
    const p = state.player;
    if (!p || !p.alive || p.cool > 0) return;
    if (p.laser < 4) { snd('deny'); return; }
    const b = playerBox();
    const dir = p.facing || 1;
    p.laser -= 4;
    p.cool = p.exo ? 0.085 : 0.17;
    const cx = dir > 0 ? b.x + b.w - 1 : b.x + 1;
    const cy = b.y + (p.duck ? 5 : 7);
    state.shots.push({ x: cx, y: cy, vx: dir * 320, vy: 0, w: 7, h: 2, life: 0.85, exo: p.exo });
    snd('laser');
    for (let i = 0; i < 2; i++) {
      state.particles.push({
        x: cx, y: cy, vx: -dir * (20 + Math.random() * 40), vy: (Math.random() - 0.5) * 30,
        life: 0.14, max: 0.14, size: 1.6, color: p.exo ? PAL.bcyan : PAL.byellow, grav: 0
      });
    }
    state.fx.shake = Math.max(state.fx.shake, 0.6);
  }

  function throwGrenade() {
    const p = state.player;
    if (!p || !p.alive) return;
    if (p.rockets <= 0) { snd('deny'); return; }
    p.rockets--;
    const b = playerBox();
    const dir = p.facing || 1;
    state.shots.push({
      x: dir > 0 ? b.x + b.w - 2 : b.x - 2, y: b.y + 4,
      vx: dir * 96 + p.vx * 0.3, vy: -212, w: 5, h: 5,
      life: 2.2, grenade: true, r: 0, spin: 0
    });
    snd('grenade');
  }

  /* ============================================================
     ВЫСТРЕЛЫ И ВРАЖЕСКИЕ СНАРЯДЫ
     ============================================================ */
  function updateShots(dt) {
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const s = state.shots[i];
      s.life -= dt;
      if (s.grenade) {
        s.vy += 620 * dt;
        s.vx *= 1 - 0.25 * dt;
        s.spin += dt * 12;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.life <= 0) { state.shots.splice(i, 1); continue; }
      if (s.x < -20 || s.x > W + 20 || s.y > H + 20 || s.y < -40) { state.shots.splice(i, 1); continue; }

      if (s.grenade) {
        const hitTerrain = tileIdAt(Math.floor(s.x / TILE), Math.floor((s.y + 4) / TILE)) === T_SOLID ||
          tileIdAt(Math.floor(s.x / TILE), Math.floor((s.y + 4) / TILE)) === T_ROCK ||
          tileIdAt(Math.floor(s.x / TILE), Math.floor((s.y + 4) / TILE)) === T_THIN;
        if (hitTerrain && s.life < 2.1) { explode(s.x, s.y, 22); state.shots.splice(i, 1); }
        else {
          /* дымный след */
          if (Math.random() < 0.5) {
            state.particles.push({
              x: s.x, y: s.y, vx: (Math.random() - 0.5) * 12, vy: -8 - Math.random() * 10,
              life: 0.4, max: 0.4, size: 1.8, color: PAL.white, grav: -6
            });
          }
        }
        continue;
      }

      /* попадание бластера по врагу */
      const sb = { x: s.x, y: s.y, w: s.w, h: s.h };
      let hit = false;
      for (let j = 0; j < state.ents.length; j++) {
        const e = state.ents[j];
        if (e.dead || e.t === 'teleporter') continue;
        if (!ENEMY[e.t] || !ENEMY[e.t].blast) continue;
        if (overlaps(sb, entityBox(e))) {
          damageEntity(e, 1, 'blast');
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let j = 0; j < state.eShots.length; j++) {
          const es = state.eShots[j];
          if (es.missile && overlaps(sb, { x: es.x - 2, y: es.y - 2, w: 8, h: 8 })) {
            state.eShots.splice(j, 1);
            addScore(50, es.x, es.y);
            boom(es.x, es.y, 8, PAL.bred);
            burst(es.x, es.y, PAL.bred, 6);
            hit = true;
            break;
          }
        }
      }
      if (!hit && (tileIdAt(Math.floor(s.x / TILE), Math.floor(s.y / TILE)) === T_SOLID ||
        tileIdAt(Math.floor(s.x / TILE), Math.floor(s.y / TILE)) === T_ROCK)) {
        burst(s.x, s.y, PAL.byellow, 3);
        hit = true;
      }
      if (hit) state.shots.splice(i, 1);
    }
  }

  function updateEnemyShots(dt) {
    const p = state.player;
    for (let i = state.eShots.length - 1; i >= 0; i--) {
      const s = state.eShots[i];
      s.life -= dt;
      if (s.missile) {
        const tx = p.x + p.w / 2, ty = p.y + p.h / 2;
        const ang = Math.atan2(ty - s.y, tx - s.x);
        s.ang = s.ang == null ? ang : s.ang + clamp(((ang - s.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2.4 * dt, 2.4 * dt);
        s.x += Math.cos(s.ang) * 88 * dt;
        s.y += Math.sin(s.ang) * 88 * dt;
        s.spin = (s.spin || 0) + dt * 14;
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      if (s.life <= 0 || s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) {
        state.eShots.splice(i, 1);
        continue;
      }
      const box = { x: s.x - 3, y: s.y - 3, w: 6, h: 6 };
      if (overlaps(box, playerBox())) {
        hurtPlayer(1, 'shot');
        state.eShots.splice(i, 1);
        continue;
      }
      if (isBlocking(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) {
        burst(s.x, s.y, PAL.magenta, 3);
        state.eShots.splice(i, 1);
      }
    }
  }

  /* ============================================================
     ВЗРЫВ / ЭФФЕКТЫ / СЧЁТ
     ============================================================ */
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 0.25 + Math.random() * 0.4, max: 0.65, size: 1.2 + Math.random() * 1.6,
        color, grav: 180
      });
    }
  }
  function boom(x, y, r, color) {
    state.booms.push({ x, y, r, t: 0, dur: 0.32, color: color || PAL.byellow });
  }

  function explode(x, y, radius) {
    boom(x, y, radius, PAL.byellow);
    burst(x, y, PAL.byellow, 14);
    burst(x, y, PAL.bred, 8);
    state.fx.shake = Math.max(state.fx.shake, 5);
    state.fx.flash = Math.max(state.fx.flash, 0.22);
    state.fx.flashColor = PAL.byellow;
    snd('explosion');
    /* разрушаемые тайлы */
    const r = 2;
    const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    for (let ty = cy - r; ty <= cy + r; ty++) {
      for (let tx = cx - r; tx <= cx + r; tx++) {
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) continue;
        if (state.world.tiles[TIDX(tx, ty)] !== T_ROCK) continue;
        if (Math.hypot((tx + 0.5) * TILE - x, (ty + 0.5) * TILE - y) > radius + 4) continue;
        state.world.tiles[TIDX(tx, ty)] = T_EMPTY;
        addScore(150);
        burst((tx + 0.5) * TILE, (ty + 0.5) * TILE, PAL.magenta, 4);
      }
    }
    /* враги в радиусе */
    for (let j = state.ents.length - 1; j >= 0; j--) {
      const e = state.ents[j];
      if (e.dead || e.t === 'teleporter') continue;
      const spec = ENEMY[e.t];
      if (!spec || !spec.grenade) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      if (Math.hypot(ex - x, ey - y) < radius + Math.max(e.w, e.h) / 2) damageEntity(e, 1, 'grenade');
    }
    /* мины детонируют цепочкой */
    for (let j = 0; j < state.ents.length; j++) {
      const e = state.ents[j];
      if (e.t === 'mine' && !e.dead && Math.hypot(e.x + 4 - x, e.y + 3 - y) < radius + 10) {
        e.dead = true; addScore(ENEMY.mine.score);
        setTimeout(function () {}, 0);
        boom(e.x + 4, e.y + 3, 10, PAL.bred);
        burst(e.x + 4, e.y + 3, PAL.bred, 5);
      }
    }
  }
  EX.explode = explode;

  function addScore(n, x, y) {
    state.score += n;
    if (x != null) state.pops.push({ x, y, text: (n > 0 ? '+' : '') + n, life: 0.9, max: 0.9, color: PAL.byellow });
  }
  EX.addScore = addScore;

  function damageEntity(e, dmg, src) {
    const spec = ENEMY[e.t];
    if (!spec) return;
    e.hp -= dmg;
    e.hitT = 0.12;
    if (e.hp > 0) { snd('hit'); return; }
    e.dead = true;
    addScore(spec.score, e.x + e.w / 2, e.y);
    if (spec.score) snd(e.t === 'pod' || e.t === 'turret' || e.t === 'tank' ? 'bigexpl' : 'explosion');
    burst(e.x + e.w / 2, e.y + e.h / 2, PAL.bmagenta, 6);
    if (e.t === 'pod') { boom(e.x + e.w / 2, e.y + e.h / 2, 10, PAL.bgreen); }
    if (e.t === 'tank') { boom(e.x + e.w / 2, e.y + e.h / 2, 14, PAL.bred); state.fx.shake = 4; }
  }

  /* ============================================================
     ВРАГИ
     ============================================================ */
  function updateEntities(dt) {
    const p = state.player;
    const pb = playerBox();
    for (let i = 0; i < state.ents.length; i++) {
      const e = state.ents[i];
      if (e.dead) continue;
      e.timer -= dt;
      e.anim += dt;
      if (e.hitT > 0) e.hitT -= dt;

      switch (e.t) {
        case 'walker': {
          const speed = 28;
          e.vx = e.dir * speed;
          e.x += e.vx * dt;
          if (e.x < e.homeX - e.range || e.x > e.homeX + e.range) e.dir *= -1;
          /* край платформы */
          const footY = Math.floor((e.y + e.h + 1) / TILE);
          const aheadX = Math.floor((e.dir > 0 ? e.x + e.w + 1 : e.x - 1) / TILE);
          if (!isBlocking(aheadX, footY) && !isBlocking(Math.floor((e.dir > 0 ? e.x + e.w - 2 : e.x + 1) / TILE), footY)) {
            e.dir *= -1;
          }
          if (isBlocking(Math.floor((e.dir > 0 ? e.x + e.w : e.x - 1) / TILE), Math.floor((e.y + e.h - 2) / TILE))) e.dir *= -1;
          e.x = clamp(e.x, 0, W - e.w);
          break;
        }
        case 'flyer': {
          const speed = 34;
          e.x += e.dir * speed * dt;
          e.baseY += 0;
          e.y = e.baseY + Math.sin((e.anim + e.phase * 6) * 2.4) * 14;
          if (e.x < e.homeX - e.range) e.dir = 1;
          if (e.x > e.homeX + e.range) e.dir = -1;
          e.x = clamp(e.x, 0, W - e.w);
          break;
        }
        case 'swarmer': {
          const dx = (pb.x + pb.w / 2) - (e.x + e.w / 2);
          const dy = (pb.y + pb.h / 2) - (e.y + e.h / 2);
          const d = Math.hypot(dx, dy) || 1;
          e.x += (dx / d) * 26 * dt;
          e.y += (dy / d) * 22 * dt + Math.sin(e.anim * 7) * 12 * dt;
          break;
        }
        case 'turret': {
          if (e.timer <= 0 && Math.abs((e.x + e.w / 2) - (pb.x + pb.w / 2)) < 150) {
            e.timer = 2.0;
            const dir = (pb.x + pb.w / 2) > (e.x + e.w / 2) ? 1 : -1;
            e.dir = dir;
            state.eShots.push({ x: e.x + e.w / 2 + dir * 6, y: e.y + e.h / 2, vx: dir * 120, vy: 0, life: 3, type: 'turret' });
            snd('missile');
          }
          break;
        }
        case 'tank': {
          if (e.timer <= 0) {
            e.timer = 2.4;
            const dir = (pb.x + pb.w / 2) > (e.x + e.w / 2) ? 1 : -1;
            e.dir = dir;
            state.eShots.push({ x: e.x + e.w / 2 + dir * 8, y: e.y + e.h / 2 - 2, vx: dir * 92, vy: -40, life: 3, type: 'tank' });
            snd('missile');
          }
          /* медленно едет к игроку */
          if (Math.abs(e.x - e.homeX) < 40) {
            e.x += (pb.x > e.x ? 1 : -1) * 8 * dt;
          }
          break;
        }
        case 'mine': {
          if (e.timer <= 0) {
            e.timer = 0.05;
            if (Math.abs(pb.x + pb.w / 2 - (e.x + 4)) < 20 && Math.abs(pb.y + pb.h - (e.y + 6)) < 16) {
              e.dead = true;
              explode(e.x + 4, e.y + 3, 14);
            }
          }
          break;
        }
        case 'crusher': {
          /* цикл: 0 — вверху, 1 — удар, 2 — возврат */
          if (e.state === 0) {
            if (e.timer <= 0) { e.state = 1; e.timer = 0.16; snd('crusher'); }
          } else if (e.state === 1) {
            e.y = e.baseY + 16;
            if (e.timer <= 0) { e.state = 2; e.timer = 0.9; }
            if (overlaps({ x: e.x + 1, y: e.y, w: e.w - 2, h: e.h }, pb)) {
              hurtPlayer(1, 'crusher');
              p.vx = (pb.x < e.x ? -1 : 1) * 220;
              p.vy = -160;
            }
          } else {
            e.y = e.baseY;
            if (e.timer <= 0) { e.state = 0; e.timer = 1.6 + e.phase; }
          }
          break;
        }
        case 'pod': {
          if (e.timer <= 0) {
            const alive = state.ents.filter((x) => x.t === 'swarmer' && !x.dead).length;
            if (alive < 3) {
              e.timer = 2.6;
              addEntity({ t: 'swarmer', x: Math.floor((e.x + e.w / 2) / TILE), y: Math.floor((e.y + e.h - 8) / TILE) });
              snd('alarm');
            } else e.timer = 1.2;
          }
          break;
        }
        case 'homer': {
          if (e.timer <= 0) {
            e.timer = 3.0;
            state.eShots.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: 0, vy: 0, life: 6, missile: true, spin: 0, ang: Math.PI / 2 });
            snd('missile');
          }
          e.y = e.baseY + Math.sin((e.anim + e.phase * 4) * 1.7) * 4;
          break;
        }
        case 'double_launcher':
        case 'combo_launcher': {
          if (overlaps(entityBox(e), pb)) {
            e.dead = true;
            addScore(ENEMY[e.t].score, e.x + e.w / 2, e.y);
            snd('pickup');
            burst(e.x + e.w / 2, e.y + e.h / 2, PAL.bcyan, 10);
          }
          break;
        }
        case 'power_laser': {
          if (overlaps(entityBox(e), pb)) {
            e.dead = true;
            state.player.laser = clamp(state.player.laser + 30, 0, state.player.maxLaser);
            addScore(0);
            snd('pickup');
            state.pops.push({ x: e.x, y: e.y, text: '+30', life: 0.8, max: 0.8, color: PAL.bcyan });
          }
          break;
        }
        case 'power_rocket': {
          if (overlaps(entityBox(e), pb)) {
            e.dead = true;
            state.player.rockets = clamp(state.player.rockets + 3, 0, state.player.maxRockets);
            snd('pickup');
            state.pops.push({ x: e.x, y: e.y, text: '+3', life: 0.8, max: 0.8, color: PAL.bmagenta });
          }
          break;
        }
        case 'exo': {
          if (overlaps(entityBox(e), pb) && !p.exo) {
            e.dead = true;
            p.exo = true;
            p.armor = 3;
            state.woreExo = true;
            state.message = { key: 'msg.exo.on', t: 0, dur: 2.2 };
            snd('exo');
            for (let k = 0; k < 18; k++) {
              burst(e.x + e.w / 2, e.y + e.h / 2, k % 2 ? PAL.bcyan : PAL.bwhite, 1);
            }
            state.fx.flash = 0.25;
            state.fx.flashColor = PAL.bcyan;
          }
          break;
        }
        case 'teleporter': {
          if (input.down && overlaps(entityBox(e), pb) && p.onGround && e.timer <= 0) {
            let dest = null;
            for (let j = 0; j < state.ents.length; j++) {
              const o = state.ents[j];
              if (o !== e && o.t === 'teleporter' && o.group === e.group && !o.dead) dest = o;
            }
            if (dest) {
              e.timer = 1.0; dest.timer = 1.0;
              p.x = dest.x + dest.w / 2 - p.w / 2;
              p.y = dest.y + dest.h - p.h;
              p.vx = 0; p.vy = 0;
              state.fx.flash = 0.3;
              state.fx.flashColor = PAL.bwhite;
              snd('teleport');
              burst(p.x + p.w / 2, p.y + p.h / 2, PAL.bcyan, 12);
              state.message = { key: 'msg.teleport', t: 0, dur: 1.2 };
            }
          }
          break;
        }
        default: break;
      }

      /* контакт врага с игроком */
      if (!e.dead && e.t !== 'teleporter' && e.t !== 'power_laser' && e.t !== 'power_rocket' &&
        e.t !== 'exo' && e.t !== 'double_launcher' && e.t !== 'combo_launcher' && e.t !== 'crusher') {
        if (overlaps(entityBox(e), pb)) hurtPlayer(1, e.t);
      }
    }
    /* чистим мёртвых (кроме телепортов/декора) */
    state.ents = state.ents.filter((e) => !e.dead || e.t === 'teleporter');
  }

  /* ============================================================
     УРОН ИГРОКУ / СМЕРТЬ
     ============================================================ */
  function hurtPlayer(dmg, cause) {
    const p = state.player;
    if (!p || !p.alive || p.invuln > 0 || state.mode !== 'play') return;
    if (p.exo && p.armor > 0) {
      p.armor -= dmg;
      p.invuln = 1.05;
      p.hitT = 0.25;
      state.fx.shake = 4;
      state.fx.flash = 0.12;
      state.fx.flashColor = PAL.bcyan;
      snd('hit');
      if (p.armor <= 0) {
        p.armor = 0;
        p.exo = false;
        p.invuln = 1.4;
        state.message = { key: 'msg.exo.off', t: 0, dur: 1.8 };
        snd('bigexpl');
        burst(p.x + p.w / 2, p.y + p.h / 2, PAL.bcyan, 16);
      }
      return;
    }
    die(cause);
  }
  EX.hurtPlayer = hurtPlayer;

  function die(cause) {
    const p = state.player;
    if (!p.alive) return;
    p.alive = false;
    p.exo = false;
    p.armor = 0;
    state.lives -= 1;
    state.deadTimer = 1.4;
    state.mode = 'dead';
    state.fx.shake = 7;
    state.fx.flash = 0.3;
    state.fx.flashColor = PAL.bred;
    burst(p.x + p.w / 2, p.y + p.h / 2, PAL.bwhite, 14);
    burst(p.x + p.w / 2, p.y + p.h / 2, PAL.bred, 12);
    snd('death');
    duck(true);
  }
  EX.die = die;

  /* ============================================================
     ПЕРЕХОД ЭКРАНОВ
     ============================================================ */
  function nextScreen() {
    const prevScreen = state.screen;
    const lv = levelData(state.level);
    if (!lv) return;
    if (prevScreen + 1 < lv.screens.length) {
      loadScreen(state.level, prevScreen + 1, { keepExo: state.player.exo && state.player.armor > 0, invuln: 0.6 });
      state.transDir = 1;
      state.transition = 1;
      music(state.level >= 4 ? 'final' : (state.player.exo ? 'exo' : 'game'));
    } else {
      levelComplete();
    }
  }

  function levelComplete() {
    state.mode = 'levelclear';
    state.clearTimer = 2.0;
    music('clear');
    state.fx.flash = 0.3;
    state.fx.flashColor = PAL.bwhite;
    snd('clear');
  }

  function startBonus() {
    const values = [500, 1000, 2500, 5000];
    state.mode = 'bonus';
    state.bonus = {
      values,
      index: Math.floor(Math.random() * values.length),
      timer: 0,
      speed: 0.085,
      phase: 'pick',
      chosen: 0,
      resultTimer: 0,
      gained: 0,
      bonusText: '',
      extraLife: false
    };
    music('clear');
    duck(true);
  }

  function resolveBonus(chosen) {
    const b = state.bonus;
    b.phase = 'result';
    b.chosen = chosen;
    b.index = b.values.indexOf(chosen);
    let gained = chosen;
    b.lines = [EX.t('msg.bonus.pick2')];
    const livesBonus = state.lives * 1000;
    gained += livesBonus;
    b.livesBonus = livesBonus;
    b.noExoBonus = state.woreExo ? 0 : 10000;
    gained += b.noExoBonus;
    b.extraLife = state.lives < 9;
    if (b.extraLife) { state.lives += 1; }
    state.score += gained;
    b.gained = gained;
    b.resultTimer = 0;
    addScore(0);
    snd('powerup');
  }

  function nextLevel() {
    const lv = levelData(state.level);
    const last = !lv || state.level + 1 >= EX.levelCount();
    if (last) {
      state.mode = 'win';
      state.winTimer = 0;
      music('win');
      snd('win');
      if (state.score > state.record) {
        state.record = state.score;
        EX.saveRecord(state.record);
        state.newRecord = true;
      }
      duck(true);
      return;
    }
    state.level += 1;
    state.woreExo = false;
    state.mode = 'briefing';
    state.briefT = 0;
    state.player.exo = false;
    state.player.armor = 0;
    state.player.laser = 60;
    state.player.rockets = 2;
    music(state.level >= 4 ? 'final' : 'game');
    duck(false);
  }

  function newGame() {
    state.lives = 5;
    state.score = 0;
    state.level = 0;
    state.screen = 0;
    state.woreExo = false;
    state.bonus = null;
    state.newRecord = false;
    state.player = makePlayer();
    loadScreen(0, 0, { fresh: true, freshAmmo: true, invuln: 1.2, seed: 1 });
    state.mode = 'briefing';
    state.briefT = 0;
    duck(false);
    music('game');
    intensity(0);
  }
  EX.newGame = newGame;

  function respawn() {
    state.mode = 'play';
    loadScreen(state.level, state.screen, {
      keepExo: false, freshAmmo: true, invuln: 1.6, seed: (state.level * 131 + state.screen * 17 + 7) | 0
    });
    duck(false);
    music(state.level >= 4 ? 'final' : 'game');
    intensity(state.exo === true ? 0.7 : 0);
  }
  EX.respawn = respawn;

  /* ============================================================
     РЕЖИМЫ / МЕНЮ
     ============================================================ */
  function setMode(mode, opts) {
    opts = opts || {};
    state.mode = mode;
    state.transition = opts.transition || 0;
    if (mode === 'paused') duck(true); else duck(false);
    if (mode === 'title') {
      state.menuIndex = 0;
      music('title');
    }
    if (mode === 'gameover') {
      duck(true);
      if (state.score > state.record) {
        state.record = state.score;
        EX.saveRecord(state.record);
        state.newRecord = true;
      }
      music('gameover');
    }
  }
  EX.setMode = setMode;

  function titleItems() {
    return [
      { key: 'play', label: EX.t('menu.play') },
      { key: 'help', label: EX.t('menu.help') },
      { key: 'settings', label: EX.t('menu.settings') },
      { key: 'about', label: EX.t('menu.about') }
    ];
  }
  function pauseItems() {
    return [
      { key: 'resume', label: EX.t('pause.resume') },
      { key: 'restart', label: EX.t('pause.restart') },
      { key: 'settings', label: EX.t('pause.settings') },
      { key: 'menu', label: EX.t('pause.menu') }
    ];
  }
  function settingsItems() {
    const s = EX.settings;
    return [
      { key: 'lang', label: EX.t('settings.lang'), value: s.lang === 'ru' ? 'РУССКИЙ' : 'ENGLISH' },
      { key: 'gfx', label: EX.t('settings.gfx'), value: s.gfx === 'retro' ? EX.t('gfx.retro') : EX.t('gfx.modern') },
      { key: 'music', label: EX.t('settings.music'), value: s.music ? EX.t('settings.on') : EX.t('settings.off') },
      { key: 'sfx', label: EX.t('settings.sfx'), value: s.sfx ? EX.t('settings.on') : EX.t('settings.off') },
      { key: 'crt', label: EX.t('settings.crt'), value: s.crt ? EX.t('settings.on') : EX.t('settings.off') },
      { key: 'reset', label: EX.t('settings.reset'), value: '' },
      { key: 'back', label: 'ESC', value: EX.t('settings.back') }
    ];
  }
  function gameoverItems() {
    return [
      { key: 'retry', label: EX.t('msg.continue') },
      { key: 'menu', label: EX.t('pause.menu') }
    ];
  }

  const UI = EX.ui = {
    items: function () {
      const m = state.mode;
      if (m === 'title') return titleItems();
      if (m === 'paused') return pauseItems();
      if (m === 'settings') return settingsItems();
      if (m === 'gameover') return gameoverItems();
      if (m === 'win') return [{ key: 'menu', label: EX.t('pause.menu') }];
      return [];
    },
    /* раскладка — общая для обоих рендереров; координаты логические 256×208 */
    layout: function () {
      const m = state.mode;
      const items = UI.items();
      let rowH = 13;
      const gap = 2;
      let y0 = 92;
      let x = 76, w = 104;
      if (m === 'title') { y0 = 124; }
      else if (m === 'settings') { y0 = 56; rowH = 13; }
      else if (m === 'paused') { y0 = 66; }
      else if (m === 'gameover') { y0 = 122; }
      else if (m === 'win') { y0 = 150; }
      return items.map(function (it, i) {
        return {
          item: it, index: i,
          x, y: y0 + i * (rowH + gap), w, h: rowH,
          cx: x + w / 2, cy: y0 + i * (rowH + gap) + rowH / 2
        };
      });
    },
    hit: function (x, y) {
      const rects = UI.layout();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
    }
  };

  function activate(index) {
    const items = UI.items();
    const it = items[index];
    if (!it) return;
    snd('menu');
    const m = state.mode;
    switch (m) {
      case 'title':
        if (it.key === 'play') newGame();
        else if (it.key === 'help') { state.helpReturn = 'title'; setMode('help'); }
        else if (it.key === 'settings') { state.settingsIndex = 0; state.settingsReturn = 'title'; setMode('settings'); }
        else if (it.key === 'about') { state.helpReturn = 'title'; setMode('about'); }
        break;
      case 'paused':
        if (it.key === 'resume') { setMode('play'); music(state.level >= 4 ? 'final' : (state.player.exo ? 'exo' : 'game')); }
        else if (it.key === 'restart') { state.mode = 'play'; respawn(); }
        else if (it.key === 'settings') { state.settingsIndex = 0; state.settingsReturn = 'paused'; setMode('settings'); }
        else if (it.key === 'menu') { setMode('title'); }
        break;
      case 'settings':
        if (it.key === 'lang') { EX.toggleLang(); }
        else if (it.key === 'gfx') { EX.toggleGfx(); }
        else if (it.key === 'music') { EX.toggleMusic(); }
        else if (it.key === 'sfx') { EX.toggleSfx(); }
        else if (it.key === 'crt') { EX.toggleCrt(); }
        else if (it.key === 'reset') { EX.resetRecord(); state.resetAsk = 1.2; }
        else if (it.key === 'back') { leaveSettings(); }
        break;
      case 'gameover':
        if (it.key === 'retry') { newGame(); }
        else if (it.key === 'menu') setMode('title');
        break;
      case 'win':
        setMode('title');
        break;
      default: break;
    }
  }

  function leaveSettings() {
    if (state.settingsReturn === 'paused') { setMode('paused'); }
    else setMode('title');
  }

  /* переключатели настроек */
  EX.toggleLang = function () {
    EX.settings.lang = EX.settings.lang === 'ru' ? 'en' : 'ru';
    EX.saveSettings();
    snd('select');
    if (state.mode === 'briefing' || state.mode === 'levelclear') { /* тексты берутся заново */ }
  };
  EX.toggleGfx = function () {
    EX.settings.gfx = EX.settings.gfx === 'retro' ? 'modern' : 'retro';
    EX.saveSettings();
    snd('select');
    state.fx.flash = 0.18;
    state.fx.flashColor = EX.settings.gfx === 'modern' ? NEON.cyan : PAL.bwhite;
  };
  EX.toggleMusic = function () {
    EX.settings.music = !EX.settings.music;
    EX.saveSettings();
    const a = A();
    if (a && a.setMusic) a.setMusic(EX.settings.music);
    if (EX.settings.music) {
      music(state.mode === 'title' ? 'title' : state.mode === 'gameover' ? 'gameover' : state.level >= 4 ? 'final' : (state.player && state.player.exo ? 'exo' : 'game'));
    } else if (a && a.stopMusic) a.stopMusic();
    snd('select');
  };
  EX.toggleSfx = function () {
    EX.settings.sfx = !EX.settings.sfx;
    EX.saveSettings();
    const a = A();
    if (a && a.setSfx) a.setSfx(EX.settings.sfx);
    snd('select');
  };
  EX.toggleCrt = function () {
    EX.settings.crt = !EX.settings.crt;
    EX.saveSettings();
    snd('select');
  };
  EX.resetRecord = function () {
    state.record = 0;
    EX.saveRecord(0);
    snd('deny');
  };
  EX.setLang = function (lang) { EX.settings.lang = lang === 'en' ? 'en' : 'ru'; EX.saveSettings(); };
  EX.setGfx = function (gfx) { EX.settings.gfx = gfx === 'modern' ? 'modern' : 'retro'; EX.saveSettings(); };

  /* ============================================================
     ОБРАБОТКА ДЕЙСТВИЙ И ХОТКЕЕВ
     ============================================================ */
  function handleActions() {
    const acts = input.actions;
    if (!acts.length) return;
    input.actions = [];
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      /* глобальные переключатели */
      if (a === 'lang') { EX.toggleLang(); continue; }
      if (a === 'gfx') { EX.toggleGfx(); continue; }
      if (a === 'music') { EX.toggleMusic(); continue; }
      if (a === 'sfx') { EX.toggleSfx(); continue; }
      if (a === 'mute') { EX.toggleMusic(); continue; }
      const m = state.mode;
      if (a === 'enter' || a === 'action') {
        if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') {
          if (m === 'settings' && state.resetAsk > 0 && UI.items()[state.menuIndex] && UI.items()[state.menuIndex].key === 'reset') {
            EX.resetRecord(); state.resetAsk = 0; continue;
          }
          activate(state.menuIndex);
        } else if (m === 'help' || m === 'about') {
          setMode(state.helpReturn === 'paused' ? 'paused' : 'title');
        } else if (m === 'briefing') {
          state.mode = 'play';
          snd('select');
        } else if (m === 'dead') {
          /* пропуск анимации */
          state.deadTimer = Math.min(state.deadTimer, 0.1);
        } else if (m === 'bonus') {
          if (state.bonus && state.bonus.phase === 'pick') {
            resolveBonus(state.bonus.values[state.bonus.index]);
          } else if (state.bonus && state.bonus.phase === 'result') {
            state.bonus.resultTimer = 99;
          }
        } else if (m === 'levelclear') {
          state.clearTimer = Math.min(state.clearTimer, 0.05);
        }
        continue;
      }
      if (a === 'escape' || a === 'pause') {
        if (m === 'play') setMode('paused');
        else if (m === 'paused') { setMode('play'); music(state.level >= 4 ? 'final' : (state.player.exo ? 'exo' : 'game')); }
        else if (m === 'settings') leaveSettings();
        else if (m === 'help' || m === 'about') setMode(state.helpReturn === 'paused' ? 'paused' : 'title');
        continue;
      }
      if (a === 'up') { if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') { moveMenu(-1); } continue; }
      if (a === 'down') { if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') { moveMenu(1); } continue; }
      if (a === 'left' || a === 'right') {
        if (m === 'settings') changeSetting(state.menuIndex, a === 'right' ? 1 : -1);
        continue;
      }
      if (a === 'restart') {
        if (m === 'play' || m === 'paused' || m === 'dead') { respawn(); }
        continue;
      }
    }
  }

  function moveMenu(d) {
    const items = UI.items();
    if (!items.length) return;
    state.menuIndex = (state.menuIndex + d + items.length) % items.length;
    snd('select');
  }

  function changeSetting(index, d) {
    const items = UI.items();
    const it = items[index];
    if (!it) return;
    if (it.key === 'lang') { EX.toggleLang(); return; }
    if (it.key === 'gfx') { EX.toggleGfx(); return; }
    if (it.key === 'music') { EX.toggleMusic(); return; }
    if (it.key === 'sfx') { EX.toggleSfx(); return; }
    if (it.key === 'crt') { EX.toggleCrt(); return; }
  }

  /* клик мышью/тапом по меню */
  EX.click = function (x, y) {
    const m = state.mode;
    if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') {
      const idx = UI.hit(x, y);
      if (idx >= 0) { state.menuIndex = idx; activate(idx); }
      return true;
    }
    return false;
  };
  EX.hover = function (x, y) {
    const m = state.mode;
    if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') {
      const idx = UI.hit(x, y);
      if (idx >= 0 && idx !== state.menuIndex) { state.menuIndex = idx; }
    }
  };

  /* ============================================================
     ШАГ ИГРЫ
     ============================================================ */
  function updatePlay(dt) {
    state.screenT += dt;
    updatePlayer(dt);
    updateEntities(dt);
    updateShots(dt);
    updateEnemyShots(dt);
    if (state.message) {
      state.message.t += dt;
      if (state.message.t > state.message.dur) state.message = null;
    }
    /* выход за правый край */
    const p = state.player;
    if (p.alive && p.x + p.w >= W - 1) nextScreen();
    /* индикатор заряда */
    intensity(p.exo ? 0.75 : clamp(1 - (p.laser + p.rockets * 20) / 120, 0, 0.6));
  }

  function updateFX(dt) {
    const fx = state.fx;
    fx.shake *= Math.pow(0.02, dt);
    if (fx.shake < 0.05) fx.shake = 0;
    fx.flash = Math.max(0, fx.flash - dt * 2.6);
    fx.hitFlash = Math.max(0, fx.hitFlash - dt * 3);

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = state.pops.length - 1; i >= 0; i--) {
      const p = state.pops[i];
      p.life -= dt;
      p.y -= 18 * dt;
      if (p.life <= 0) state.pops.splice(i, 1);
    }
    for (let i = state.booms.length - 1; i >= 0; i--) {
      const b = state.booms[i];
      b.t += dt;
      if (b.t > b.dur) state.booms.splice(i, 1);
    }
    if (state.transition > 0) {
      state.transition = Math.max(0, state.transition - dt * 3.2);
    }
    if (state.resetAsk > 0) state.resetAsk -= dt;
  }

  function updateBonus(dt) {
    const b = state.bonus;
    if (!b) { state.mode = 'play'; return; }
    if (b.phase === 'pick') {
      b.timer += dt;
      if (b.timer > b.speed) {
        b.timer = 0;
        b.index = (b.index + 1) % b.values.length;
        snd('select');
      }
      const p = state.player;
      if (p) p.anim += dt;
    } else {
      b.resultTimer += dt;
      if (b.resultTimer > 3.2 || b.resultTimer > 99) {
        if (state.level + 1 >= EX.levelCount()) {
          nextLevel();
        } else {
          nextLevel();
        }
      }
    }
  }

  EX.update = function (dt) {
    dt = Math.min(dt, 0.05);
    state.t += dt;
    handleActions();
    if (input.pointer.clicked) {
      input.pointer.clicked = false;
      EX.click(input.pointer.x, input.pointer.y);
    }
    const m = state.mode;
    if (m === 'play') updatePlay(dt);
    else if (m === 'dead') {
      state.deadTimer -= dt;
      if (state.deadTimer <= 0) {
        if (state.lives <= 0) setMode('gameover');
        else respawn();
      }
    } else if (m === 'levelclear') {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) startBonus();
    } else if (m === 'bonus') {
      updateBonus(dt);
    } else if (m === 'briefing') {
      state.briefT = (state.briefT || 0) + dt;
      if (state.briefBypass) state.briefT = Math.max(state.briefT, 0);
      const p = state.player;
      if (p) p.anim += dt;
    } else if (m === 'win') {
      state.winTimer = (state.winTimer || 0) + dt;
    }
    updateFX(dt);
  };

  /* окно детерминированного шага для тестов */
  EX.stepFixed = function (dt) { EX.update(dt); return state; };

  /* ============================================================
     НАЧАЛЬНОЕ СОСТОЯНИЕ / ДЕМО-РЕЖИМ
     ============================================================ */
  EX.prepareTitle = function () {
    state.record = EX.loadRecord();
    state.mode = 'title';
    state.menuIndex = 0;
    /* фоновая сцена для титульного экрана: первый экран первого уровня */
    state.level = 0;
    state.screen = 0;
    state.lives = 5;
    state.score = 0;
    state.player = makePlayer();
    loadScreen(0, 0, { fresh: true, freshAmmo: true, invuln: 999, seed: 1 });
    state.player.alive = true;
  };

  /* debug-сценарии для скриншотов (#shot=...) */
  EX.prepareShot = function (shot, opts) {
    opts = opts || {};
    const lv = opts.level != null ? opts.level : 0;
    const sc = opts.screen != null ? opts.screen : 0;
    state.record = EX.loadRecord();
    state.lives = 4;
    state.score = 12750;
    state.level = lv;
    state.screen = sc;
    state.woreExo = false;
    state.player = makePlayer();
    loadScreen(lv, sc, { fresh: true, freshAmmo: true, invuln: 999, seed: 1 });
    state.fx.shake = 0;
    state.t = 3.2;
    switch (shot) {
      case 'play':
        state.mode = 'play';
        state.player.laser = 72;
        state.player.rockets = 3;
        break;
      case 'exo':
        state.mode = 'play';
        state.player.exo = true;
        state.player.armor = 3;
        state.player.laser = 44;
        state.player.rockets = 2;
        break;
      case 'paused':
        state.mode = 'paused';
        state.menuIndex = 0;
        break;
      case 'settings':
        state.mode = 'settings';
        state.settingsReturn = 'title';
        state.menuIndex = 1;
        break;
      case 'help':
        state.mode = 'help';
        state.helpReturn = 'title';
        break;
      case 'about':
        state.mode = 'about';
        state.helpReturn = 'title';
        break;
      case 'briefing':
        state.mode = 'briefing';
        state.briefT = 0.4;
        break;
      case 'bonus':
        state.mode = 'levelclear';
        state.clearTimer = 0.01;
        startBonus();
        state.bonus.index = 2;
        break;
      case 'levelclear':
        state.mode = 'levelclear';
        state.clearTimer = 30;   /* не уходить в bonus, чтобы кадр был стабильным */
        break;
      case 'gameover':
        state.mode = 'gameover';
        state.score = 24750;
        state.record = 19800;
        state.newRecord = true;
        break;
      case 'win':
        state.mode = 'win';
        state.score = 84500;
        state.record = 79200;
        state.newRecord = true;
        state.winTimer = 2;
        break;
      case 'title':
      default:
        EX.prepareTitle();
        break;
    }
    state.menuIndex = state.menuIndex || 0;
    return state;
  };

  /* ============================================================
     ТЕСТЫ (#test)
     ============================================================ */
  EX.runTests = function () {
    const res = [];
    const ok = function (name, cond) { res.push({ name, ok: !!cond }); };
    const levels = window.EX_LEVELS || [];

    ok('уровней 5', levels.length === 5);
    ok('экранов по 5', levels.every((l) => l && l.screens && l.screens.length === 5));
    ok('сетка 32×24', levels.every((l) => l.screens.every((s) => s.tiles.length === 24 && s.tiles.every((r) => r.length === 32))));
    ok('только легальные тайлы', levels.every((l) => l.screens.every((s) => s.tiles.every((r) => /^[ #=%^x]+$/.test(r)))));
    ok('капсула exo на 3-м экране', levels.every((l) => l.screens[2].entities.some((e) => e.t === 'exo')));
    ok('телепорты парами', levels.every((l) => l.screens.every((s) => {
      const g = {}; s.entities.forEach((e) => { if (e.t === 'teleporter') g[e.group] = (g[e.group] || 0) + 1; });
      return Object.keys(g).every((k) => g[k] === 2);
    })));

    /* шрифт покрывает все строки локализации */
    const chars = new Set();
    ['ru', 'en'].forEach((lang) => {
      Object.values(window.EX_I18N[lang]).forEach((s) => { for (const ch of String(s)) chars.add(ch); });
    });
    levels.forEach((l) => {
      ['ru', 'en'].forEach((lang) => {
        String(l.name[lang] + l.intro[lang]).split('').forEach((c) => chars.add(c));
      });
    });
    const missing = [];
    chars.forEach((ch) => { if (!/\s/.test(ch) && !window.EX_FONT.has(ch)) missing.push(ch); });
    ok('шрифт: все символы (' + (chars.size) + ')', missing.length === 0);
    if (missing.length) state.debug.missingGlyphs = missing.join('');

    ok('локализация: паритет ключей', (function () {
      const a = Object.keys(window.EX_I18N.ru).sort().join('|');
      const b = Object.keys(window.EX_I18N.en).sort().join('|');
      return a === b;
    })());

    /* физика: игрок падает на землю */
    EX.prepareShot('play', { level: 0, screen: 0 });
    state.player.y = 40;
    for (let i = 0; i < 90; i++) EX.stepFixed(1 / 60);
    ok('игрок стоит на земле', state.player.onGround === true);

    /* бластер убивает ходячего */
    state.ents.forEach((e) => { if (e.t === 'walker') e.dead = true; });
    state.ents = state.ents.filter((e) => !e.dead);
    let w = addEntity({ t: 'walker', x: 10, y: 20 });
    const before = state.score;
    state.player.x = w.x - 40; state.player.y = w.y; state.player.facing = 1; state.player.dir = 1;
    state.player.cool = 0; state.player.laser = 100;
    fireBlaster();
    for (let i = 0; i < 40; i++) EX.stepFixed(1 / 60);
    ok('бластер убивает врага (+150)', w.dead && state.score - before >= 150);

    /* пушка не боится бластера */
    state.ents = [];
    const tur = addEntity({ t: 'turret', x: 12, y: 20 });
    state.score = 0;
    state.shots = [];
    state.player.x = tur.x - 40;
    state.player.cool = 0;
    fireBlaster();
    for (let i = 0; i < 40; i++) EX.stepFixed(1 / 60);
    ok('пушка неуязвима для бластера', !tur.dead);

    /* граната взрывает пушку */
    state.player.facing = 1;
    state.player.rockets = 3;
    throwGrenade();
    for (let i = 0; i < 120 && !tur.dead; i++) EX.stepFixed(1 / 60);
    ok('граната убивает пушку', tur.dead);

    /* разрушаемый камень */
    state.ents = [];
    state.world.tiles[22 * COLS + 20] = T_ROCK;
    explode(20 * TILE + 4, 22 * TILE + 4, 22);
    ok('граната разрушает камень', state.world.tiles[22 * COLS + 20] === T_EMPTY);

    /* бонус за уровень */
    state.lives = 3; state.woreExo = false;
    state.bonus = null; startBonus();
    resolveBonus(5000);
    ok('бонус = очки + жизни×1000 + 10000', state.bonus.gained === 5000 + 3000 + 10000);
    ok('доп. жизнь за уровень', state.lives === 4);

    /* рекорд */
    EX.saveRecord(12345);
    ok('рекорд в localStorage', EX.loadRecord() === 12345);
    EX.saveRecord(0);

    /* переключения */
    const g0 = EX.settings.gfx; EX.toggleGfx(); const g1 = EX.settings.gfx;
    EX.toggleGfx();
    ok('переключение графики', g0 !== g1 && EX.settings.gfx === g0);
    const l0 = EX.settings.lang; EX.toggleLang();
    ok('переключение языка', EX.settings.lang !== l0);
    EX.toggleLang();

    /* меню */
    EX.prepareTitle();
    state.menuIndex = 1;
    EX.pushAction('down');
    EX.stepFixed(1 / 60);
    ok('навигация меню', state.menuIndex === 2);

    /* пауза */
    EX.prepareShot('play');
    EX.pushAction('pause');
    EX.stepFixed(1 / 60);
    ok('пауза', state.mode === 'paused');
    EX.pushAction('pause');
    EX.stepFixed(1 / 60);
    ok('снятие паузы', state.mode === 'play');

    /* переход на следующий экран */
    state.mode = 'play';
    state.screen = 0;
    loadScreen(0, 0, { fresh: true, freshAmmo: true, invuln: 999 });
    state.player.x = W - 2;
    EX.stepFixed(1 / 60);
    ok('выход за правый край = новый экран', state.screen === 1);

    /* последний экран уровня → уровень пройден */
    loadScreen(0, 4, { fresh: true, freshAmmo: true, invuln: 999 });
    state.player.x = W - 2;
    EX.stepFixed(1 / 60);
    ok('конец уровня → зачёт бонуса', state.mode === 'levelclear');

    /* телепорт */
    EX.prepareShot('play');
    state.ents = [];
    addEntity({ t: 'teleporter', x: 2, y: 20, group: 1 });
    addEntity({ t: 'teleporter', x: 26, y: 8, group: 1 });
    const p = state.player;
    p.x = 2 * 8 + 1; p.y = 21 * 8 - p.h; p.onGround = true;
    input.down = true;
    EX.stepFixed(1 / 60);
    input.down = false;
    ok('телепорт переносит', p.x > 100);

    /* --- интеграционные проверки механик --- */
    /* смерть и респавн */
    EX.newGame();
    state.mode = 'play';
    state.player.invuln = 0;
    const lives0 = state.lives;
    hurtPlayer(1, 'test');
    ok('смерть: -1 жизнь, режим dead', state.mode === 'dead' && state.lives === lives0 - 1);
    for (let i = 0; i < 120; i++) EX.stepFixed(1 / 60);
    ok('респавн после смерти', state.mode === 'play' && state.player.alive === true);

    /* экзоскелет: 3 удара */
    EX.newGame();
    state.mode = 'play';
    state.player.exo = true;
    state.player.armor = 3;
    const arm = [];
    for (let i = 0; i < 3; i++) { state.player.invuln = 0; hurtPlayer(1, 't'); arm.push(state.player.armor); }
    ok('экзоскелет: 3 удара, потом потеря', arm.join(',') === '2,1,0' && !state.player.exo && state.player.alive);

    /* формула бонуса без экзо и с экзо */
    EX.prepareShot('bonus');
    state.lives = 2; state.woreExo = false;
    state.bonus.phase = 'pick';
    EX.pushAction('action'); EX.stepFixed(1 / 60);
    const chosenV = state.bonus.chosen;
    const wantNoExo = chosenV + 2 * 1000 + 10000;
    const gotNoExo = state.bonus.gained;
    EX.prepareShot('bonus');
    state.lives = 2; state.woreExo = true;
    state.bonus.phase = 'pick';
    EX.pushAction('action'); EX.stepFixed(1 / 60);
    const wantExo = state.bonus.chosen + 2 * 1000;
    ok('бонус: +10000 без экзо / 0 с экзо', gotNoExo === wantNoExo && state.bonus.gained === wantExo);

    /* полный проход первого уровня */
    EX.newGame();
    state.mode = 'play';
    state.player.invuln = 1e6;
    input.left = input.right = input.up = input.down = input.fire = false;
    let lastMode = 'play';
    for (let scr = 0; scr < 5 && state.mode === 'play'; scr++) {
      let guard = 0;
      while (state.mode === 'play' && state.screen === scr && guard++ < 1200) {
        input.right = true; input.up = (guard % 26) < 4;
        state.player.invuln = 1e6;   /* проверяем геометрию, а не бой */
        EX.stepFixed(1 / 60);
      }
      input.right = false; input.up = false;
      lastMode = state.mode;
    }
    ok('экран за экраном → бонус сектора', lastMode === 'levelclear' || lastMode === 'bonus');

    /* телепорт */
    EX.prepareShot('play');
    state.ents = [];
    addEntity({ t: 'teleporter', x: 2, y: 20, group: 1 });
    addEntity({ t: 'teleporter', x: 26, y: 9, group: 1 });
    state.player.x = 17;
    state.player.y = 152;
    state.player.onGround = true;
    input.down = true;
    EX.stepFixed(1 / 60);
    input.down = false;
    ok('телепорт переносит к паре', state.player.x > 150);

    /* режимы стрельбы: клик vs удержание */
    EX.prepareShot('play');
    state.player.laser = 100;
    state.player.rockets = 3;
    input.fire = false;
    EX.stepFixed(1 / 60);
    input.fire = true;
    EX.stepFixed(1 / 60);
    const firedLaser = state.shots.length >= 1 && state.player.laser < 100;
    for (let i = 0; i < 22; i++) EX.stepFixed(1 / 60);
    const firedGrenade = state.shots.some((sh) => sh.grenade) && state.player.rockets === 2;
    input.fire = false;
    EX.stepFixed(1 / 60);
    ok('клик — бластер, удержание — граната', firedLaser && firedGrenade);

    /* пушка: бластер не берёт, граната берёт */
    EX.prepareShot('play');
    state.ents = [];
    const tur2 = addEntity({ t: 'turret', x: 12, y: 20 });
    state.player.x = tur2.x - 44;
    state.player.facing = 1;
    state.player.cool = 0;
    state.player.laser = 100;
    state.shots = [];
    fireBlaster();
    for (let i = 0; i < 30; i++) EX.stepFixed(1 / 60);
    const turAlive = !tur2.dead;
    state.player.rockets = 3;
    state.player.cool = 0;
    throwGrenade();
    for (let i = 0; i < 150 && !tur2.dead; i++) EX.stepFixed(1 / 60);
    ok('пушка: бластер мимо, граната в цель', turAlive && tur2.dead);

    /* аудио-модуль */
    const A = window.EX_AUDIO || {};
    ok('аудио-API на месте', ['init', 'unlock', 'setMusic', 'setSfx', 'playMusic', 'stopMusic', 'sfx', 'duck'].every((k) => typeof A[k] === 'function'));

    /* меню настроек открывается без исключений */
    let settingsOk = true;
    try {
      EX.prepareShot('settings');
      if (window.EX_RENDER_RETRO) window.EX_RENDER_RETRO.draw(document.createElement('canvas').getContext('2d'), { t: 0 });
    } catch (e) { settingsOk = false; }
    ok('экран настроек рисуется', settingsOk);

    /* режимы не падают */
    ok('режим title', (EX.prepareTitle(), state.mode === 'title'));

    return res;
  };
})();
