/* ============================================================================
   ЗАСЛОН · логика (DOM-free, детерминируемая через opts.rng)
   Вертикальный скролл-шутер с прокачкой. Корабль держит «заслон» — энергобарьер
   у нижнего края: каждый прорвавшийся враг отнимает прочность заслона.
   3 оружия (Искра — веер, Луч — непрерывный, Дробь — разлёт) × 3 уровня,
   боковые модули (до 2), энергощит корабля, мега-бомбы, металлолом,
   мастерская между секторами, 5 секторов с боссом в конце каждого.
   Рендер — js/classic.js (8-бит) и js/modern.js. Интерфейс — CONTRACT.md.
   ========================================================================== */
(function (global) {
  'use strict';
  var Z = global.ZASLON = global.ZASLON || {};

  var W = 480, H = 640;
  var SECTORS = 5;
  var Y_MIN = 300, Y_MAX = 604;          // коридор корабля по вертикали
  var P_SPEED = 245, P_HIT_R = 8;        // скорость и радиус хитбокса корабля
  var BASE_MAX = 100;                    // прочность заслона, %
  var BREACH_Y = H - 8;                  // линия заслона: враг, дошедший до неё центром, — прорыв
  var LIVES_MAX = 5, BOMBS_MAX = 5, SHIELD_BASE = 1, SHIELD_MAX = 3, MODULES_MAX = 2;
  var SHIELD_REGEN = 9;                  // сек. до восстановления одного деления щита
  var WEAPONS = ['spark', 'ray', 'shot'];
  var CAPSULE_CYCLE = 1.6;               // капсула меняет вид оружия каждые N сек

  // Враги (названия и вид — оригинальные студии).
  var KINDS = {
    mite:    { hp: 1, r: 11, pts: 50,  scrap: 1, breach: 6,  vy: 92, drop: 0.35 },   // «Клещ»
    dart:    { hp: 1, r: 10, pts: 80,  scrap: 2, breach: 9,  vy: 215, drop: 0.5 },  // «Стриж» — пикирует на корабль
    weaver:  { hp: 3, r: 13, pts: 120, scrap: 3, breach: 12, vy: 52, drop: 0.8 },   // «Ткач» — зигзаг, веер пуль
    hulk:    { hp: 8, r: 18, pts: 260, scrap: 6, breach: 20, vy: 38, drop: 1 },   // «Таран» — броня, прицельный огонь
    carrier: { hp: 4, r: 15, pts: 150, scrap: 3, breach: 8,  vy: 50, drop: 1 }    // «Носитель» — несёт капсулу оружия
  };
  // Боссы секторов (оригинальные): hp, полуразмеры хитбокса, награда.
  var BOSSES = [
    { kind: 'millstone', hp: 260, w: 46, h: 30 },   // «Жернов» — кольца пуль
    { kind: 'pincer',    hp: 420, w: 54, h: 28 },   // «Клешня» — следит за кораблём, выпускает клещей
    { kind: 'hive',      hp: 580, w: 46, h: 34 },   // «Улей» — стрижи, веер, спираль
    { kind: 'pendulum',  hp: 720, w: 40, h: 30 },   // «Маятник» — качается, бьёт столбом-лучом
    { kind: 'forge',     hp: 950, w: 56, h: 36 }    // «Горн» — финал, три фазы
  ];
  // Оружие по уровням (1..3).
  var GUN = {
    spark: { cd: 0.2, v: 600, dmg: 1, fan: [[-7, 0, 7], [-15, -7, 0, 7, 15], [-24, -15, -7, 0, 7, 15, 24]] },
    ray:   { dps: [8, 12.5, 18], w: [8, 13, 19] },
    shot:  { cd: 0.36, v: 560, dmg: 1.25, n: [6, 8, 11], spread: 30, life: 0.5 }
  };
  var MOD_CD = 0.3, MOD_DMG = 0.8, MOD_DX = 27;
  // Мастерская: цены в металлоломе (по номеру следующей покупки).
  var SHOP = ['weapon', 'module', 'shield', 'bomb', 'repair', 'life', 'next'];
  var PRICES = {
    weapon: [60, 120],       // ур.1→2, ур.2→3 текущего оружия
    module: [80, 150],       // 1-й, 2-й модуль
    shield: [70, 130],       // ёмкость щита 1→2→3
    bomb:   [35],            // +1 бомба (до 5)
    repair: [40],            // +25% заслона
    life:   [150]            // +1 корабль (до 5)
  };
  var REPAIR = 25;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rad(d) { return d * Math.PI / 180; }

  Z.Game = function (opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var onEventFn = typeof opts.onEvent === 'function' ? opts.onEvent : null;

    var S = {
      W: W, H: H, sectors: SECTORS, t: 0, scroll: 0,
      sector: 0, phase: 'idle', phaseT: 0, banner: null, bannerT: 0, bannerArg: null,
      score: 0, lives: 3, scrap: 0, base: BASE_MAX, baseHitT: 0,
      enemies: [], spawnQ: [], pb: [], eb: [], scraps: [], caps: [], booms: [],
      boss: null, flash: 0, uid: 0, waveIdx: 0, waveCount: 0, waveT: 0,
      shop: { sel: 0, t: 0 }, bought: 0,
      player: {
        x: W / 2, y: 560, dx: 0, dy: 0, alive: true, inv: 0, respawnT: 0,
        shield: SHIELD_BASE, shMax: SHIELD_BASE, regenT: SHIELD_REGEN,
        weapon: 'spark', lv: { spark: 1, ray: 1, shot: 1 }, modules: 0, bombs: 2,
        cd: 0, modCd: 0, fire: false, ray: null, shootT: 0
      },
      overT: 0, over: false, won: false, started: false, stats: { breaches: 0, kills: 0 }
    };

    function emit(type, data) { if (onEventFn) onEventFn(type, data || {}); }
    var diff = opts.diff || function (base, step, max) {
      var v = base + (S.sector - 1) * step;
      return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max));
    };
    function params() {
      return {
        spdMul: diff(1, 0.1, 1.45),         // скорость врагов
        hpMul: diff(1, 0.45, 2.8),           // прочность врагов
        eBulletV: diff(180, 39, 340),        // скорость вражеских пуль
        fireMul: diff(1, 0.5, 3),         // частота вражеского огня
        gap: diff(3.4, -0.3, 2.2),           // пауза между волнами
        maxLive: Math.round(diff(5, 3, 16)), // новая волна, только если живых не больше
        waves: 8 + S.sector * 2              // волн в секторе (10..18)
      };
    }
    function setBanner(key, time, arg) { S.banner = key; S.bannerT = time; S.bannerArg = arg == null ? null : arg; }

    // ---------- Волны ----------
    function addSpawn(kind, x, delay, pat, extra) {
      S.spawnQ.push(Object.assign({ kind: kind, x: clamp(x, 24, W - 24), delay: delay, pat: pat }, extra || {}));
    }
    function buildWave(type) {
      var s = S.sector, i, c;
      if (type === 'row') {
        var n = 5 + (s >= 3 ? 1 : 0) + (s >= 5 ? 1 : 0);
        for (i = 0; i < n; i++) addSpawn('mite', 50 + i * (380 / (n - 1)), 0, 'sine', { amp: 18, freq: 1.6, ph: i * 0.6 });
      } else if (type === 'column') {
        c = 90 + rng() * 300;
        for (i = 0; i < 6; i++) addSpawn('mite', c, i * 0.42, 'sine', { amp: 70, freq: 2.1, ph: 0 });
      } else if (type === 'vee') {
        c = 120 + rng() * 240;
        for (i = -2; i <= 2; i++) addSpawn('dart', c + i * 42, Math.abs(i) * 0.28, 'dive');
      } else if (type === 'pair') {
        addSpawn('weaver', 110, 0, 'zig', { vx: 85 }); addSpawn('weaver', 370, 0.3, 'zig', { vx: -85 });
        if (s >= 4) addSpawn('weaver', 240, 1.2, 'zig', { vx: rng() < 0.5 ? 85 : -85 });
      } else if (type === 'hulk') {
        c = 100 + rng() * 280;
        addSpawn('hulk', c, 0, 'hulk', { stopY: 140 + rng() * 70 });
        var o = c < W / 2 ? 380 : 100;
        for (i = 0; i < 4; i++) addSpawn('mite', o, 0.8 + i * 0.45, 'sine', { amp: 50, freq: 2, ph: 0 });
      } else if (type === 'mix') {
        addSpawn('weaver', 90, 0, 'zig', { vx: 80 }); addSpawn('weaver', 390, 0, 'zig', { vx: -80 });
        c = 160 + rng() * 160;
        for (i = -1; i <= 1; i++) addSpawn('dart', c + i * 46, 1.1 + Math.abs(i) * 0.3, 'dive');
      } else if (type === 'carrier') {
        c = 120 + rng() * 240;
        addSpawn('carrier', c, 0, 'carrier');
        for (i = 0; i < 3; i++) addSpawn('mite', c + (i - 1) * 70, 0.9, 'sine', { amp: 22, freq: 1.8, ph: i });
      }
    }
    function pickWave() {
      var s = S.sector, idx = S.waveIdx;
      if (idx === 1 || idx === 4 || idx === 7) return 'carrier';   // капсулы оружия — гарантированно
      var pool = [['row', 3], ['column', 3], ['vee', s >= 2 ? 3 : 2], ['pair', s >= 2 ? 2 : 1],
                  ['hulk', s >= 4 ? 3 : s >= 2 ? 1.5 : 0], ['mix', s >= 3 ? 2 + (s - 3) : 0]];
      var tot = 0, k; for (k = 0; k < pool.length; k++) tot += pool[k][1];
      var r = rng() * tot;
      for (k = 0; k < pool.length; k++) { r -= pool[k][1]; if (r < 0) return pool[k][0]; }
      return 'row';
    }
    function spawnEnemy(sp) {
      var K = KINDS[sp.kind], P = params();
      var hp = sp.kind === 'mite' || sp.kind === 'dart' ? K.hp * (S.sector >= 4 ? 2 : 1) : Math.ceil(K.hp * P.hpMul);
      var e = {
        id: ++S.uid, kind: sp.kind, x: sp.x, x0: sp.x, y: -K.r - 6, r: K.r, hp: hp, max: hp, hurtT: 0,
        pat: sp.pat, t: 0, amp: sp.amp || 0, freq: sp.freq || 1, ph: sp.ph || 0,
        vx: sp.vx || 0, vy: K.vy * P.spdMul, stopY: sp.stopY || 180, hang: 3.5, lock: false,
        fireT: 0.7 + rng() * 1.2, dead: false, minion: !!sp.minion
      };
      S.enemies.push(e);
      return e;
    }

    function startSector(n) {
      S.sector = n; S.phase = 'intro'; S.phaseT = 2.0; S.waveIdx = 0; S.waveCount = params().waves;
      S.waveT = 0.4; S.spawnQ = []; S.enemies = []; S.eb = []; S.boss = null; S.caps = [];
      setBanner('sector', 2.0, n);
      emit('sector', { sector: n });
    }

    // ---------- Игрок ----------
    function fireWeapons(dt) {
      var p = S.player, w = p.weapon, lv = p.lv[w], G = GUN[w], i;
      p.ray = null;
      if (!p.fire || !p.alive || !combat()) return;
      if (w === 'spark') {
        if (p.cd <= 0) {
          var fan = G.fan[lv - 1];
          for (i = 0; i < fan.length; i++) {
            var a = rad(fan[i]);
            S.pb.push({ x: p.x, y: p.y - 14, vx: Math.sin(a) * G.v, vy: -Math.cos(a) * G.v, dmg: G.dmg, life: 2, k: 'spark' });
          }
          p.cd = G.cd; shootSfx();
        }
      } else if (w === 'shot') {
        if (p.cd <= 0) {
          var n = G.n[lv - 1];
          for (i = 0; i < n; i++) {
            var b = rad((i / (n - 1) - 0.5) * 2 * G.spread + (rng() - 0.5) * 6), v = G.v * (0.85 + rng() * 0.3);
            S.pb.push({ x: p.x, y: p.y - 12, vx: Math.sin(b) * v, vy: -Math.cos(b) * v, dmg: G.dmg, life: G.life, k: 'shot' });
          }
          p.cd = G.cd; shootSfx(true);
        }
      } else if (w === 'ray') {
        var hw = G.w[lv - 1] / 2, dps = G.dps[lv - 1], top = -10, tgt = null;
        for (i = 0; i < S.enemies.length; i++) {
          var e = S.enemies[i];
          if (e.dead || e.y > p.y || e.y < -e.r) continue;
          if (Math.abs(e.x - p.x) < e.r + hw && e.y + e.r > top) { top = e.y + e.r * 0.5; tgt = e; }
        }
        var B = S.boss;
        if (B && B.vuln && Math.abs(B.x - p.x) < B.w + hw && B.y < p.y && B.y + B.h > top) { top = B.y + B.h * 0.6; tgt = B; }
        p.ray = { x: p.x, y0: p.y - 14, y1: top, w: hw * 2 };
        if (tgt) { if (tgt === B) hitBoss(dps * dt, p.x, top); else damageEnemy(tgt, dps * dt); }
        p.shootT -= dt; if (p.shootT <= 0) { p.shootT = 0.14; emit('ray', {}); }
      }
      if (p.modules > 0 && p.modCd <= 0) {
        for (i = 0; i < p.modules; i++) {
          var mx = p.x + (i === 0 ? -MOD_DX : MOD_DX);
          S.pb.push({ x: mx, y: p.y - 4, vx: 0, vy: -640, dmg: MOD_DMG, life: 2, k: 'mod' });
        }
        p.modCd = MOD_CD;
      }
    }
    function shootSfx(heavy) { var p = S.player; if (p.shootT <= 0) { p.shootT = heavy ? 0.3 : 0.16; emit('shoot', { weapon: p.weapon }); } }
    function combat() { return S.phase === 'waves' || S.phase === 'warn' || S.phase === 'boss' || S.phase === 'intro'; }

    function hitPlayer(src) {
      var p = S.player;
      if (!p.alive || p.inv > 0 || S.over) return false;
      if (p.shield > 0) {
        p.shield--; p.inv = 1.0; p.regenT = SHIELD_REGEN;
        emit('shieldHit', { x: p.x, y: p.y, left: p.shield });
        return true;
      }
      p.alive = false; S.lives--; p.ray = null;
      if (p.lv[p.weapon] > 1) p.lv[p.weapon]--;
      S.booms.push({ x: p.x, y: p.y, t: 0, life: 0.9, r: 60 });
      emit('die', { x: p.x, y: p.y, src: src || '' });
      if (S.lives <= 0) S.overT = 1.8; else p.respawnT = 1.7;
      return true;
    }

    function bomb() {
      var p = S.player;
      if (!S.started || S.over || !p.alive || p.bombs <= 0 || !combat()) return false;
      p.bombs--; S.flash = 0.6; p.inv = Math.max(p.inv, 0.6);
      S.eb = [];
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && e.y > -e.r) damageEnemy(e, 30); }
      if (S.boss && S.boss.vuln) hitBoss(22, S.boss.x, S.boss.y);
      emit('bomb', { left: p.bombs });
      return true;
    }

    // ---------- Враги ----------
    function enemyShoot(x, y, angDeg, v) {
      var a = rad(angDeg);
      S.eb.push({ x: x, y: y, vx: Math.sin(a) * v, vy: Math.cos(a) * v, r: 5 });
    }
    function aimAngle(x, y) { var p = S.player; var tx = p.alive ? p.x : W / 2, ty = p.alive ? p.y : 560; return Math.atan2(tx - x, ty - y) * 180 / Math.PI; }
    function shootAt(x, y, v, spreads) {
      var a = aimAngle(x, y); spreads = spreads || [0];
      for (var i = 0; i < spreads.length; i++) enemyShoot(x, y, a + spreads[i], v);
      emit('eshoot', {});
    }
    function ring(x, y, n, v, off) { for (var i = 0; i < n; i++) enemyShoot(x, y, off + i * 360 / n, v); emit('eshoot', { ring: true }); }

    function damageEnemy(e, dmg) {
      if (e.dead) return;
      e.hp -= dmg; e.hurtT = 0.08;
      if (e.hp <= 0) killEnemy(e);
    }
    function killEnemy(e) {
      var K = KINDS[e.kind];
      e.dead = true; S.score += K.pts; S.stats.kills++;
      S.booms.push({ x: e.x, y: e.y, t: 0, life: 0.45, r: e.r * 2.2 });
      emit('kill', { x: e.x, y: e.y, kind: e.kind, pts: K.pts });
      if (rng() < (e.minion ? 0.3 : K.drop)) S.scraps.push({ x: e.x, y: e.y, v: K.scrap, vy: 70, mag: false });
      if (e.kind === 'carrier') {
        var cur = WEAPONS.indexOf(S.player.weapon);
        S.caps.push({ x: e.x, y: e.y, x0: e.x, t: 0, type: cur, ty: WEAPONS[cur] });
      }
    }
    function updEnemy(e, dt, P) {
      e.t += dt; if (e.hurtT > 0) e.hurtT -= dt;
      var p = S.player;
      switch (e.pat) {
        case 'sine': e.y += e.vy * dt; e.x = clamp(e.x0 + e.amp * Math.sin(e.t * e.freq + e.ph), 14, W - 14); break;
        case 'dive':
          if (!e.lock) {
            e.y += 70 * dt;
            if (e.t > 0.75) {
              e.lock = true;
              var tx = p.alive ? p.x : W / 2, ty = p.alive ? p.y : 560, dy = Math.max(60, ty - e.y);
              e.vx = clamp((tx - e.x) / (dy / e.vy), -150, 150);
              emit('dive', {});
            }
          } else {
            e.y += e.vy * dt; e.x = clamp(e.x + e.vx * dt, 12, W - 12);
            if (!e.re && e.y > 300 && p.alive) {   // довернуть ещё раз — пике не по прямой
              e.re = true; var dy2 = Math.max(60, p.y - e.y);
              e.vx = clamp(e.vx * 0.3 + 0.7 * (p.x - e.x) / (dy2 / e.vy), -170, 170);
            }
          }
          break;
        case 'zig':
          e.y += e.vy * dt; e.x += e.vx * P.spdMul * dt;
          if (e.x < 28) { e.x = 28; e.vx = Math.abs(e.vx); } else if (e.x > W - 28) { e.x = W - 28; e.vx = -Math.abs(e.vx); }
          break;
        case 'hulk':
          if (e.y < e.stopY) e.y += Math.max(e.vy, 60) * dt;
          else if (e.hang > 0) e.hang -= dt;
          else e.y += e.vy * dt;
          e.x = clamp(e.x0 + Math.sin(e.t * 0.7) * 30, 24, W - 24);
          break;
        case 'carrier': e.y += e.vy * dt; e.x = clamp(e.x0 + Math.sin(e.t * 1.2) * 40, 20, W - 20); break;
      }
      // огонь
      if (p.alive && e.y > 20 && e.y < p.y - 70) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          var base = e.kind === 'hulk' ? 1.4 : e.kind === 'weaver' ? 2.4 : e.kind === 'mite' ? 5 : e.kind === 'carrier' ? 3.2 : 0;
          if (base > 0) {
            if (e.kind === 'weaver') shootAt(e.x, e.y + 8, P.eBulletV * 0.9, S.sector >= 3 ? [-24, -12, 0, 12, 24] : [-14, 0, 14]);
            else if (e.kind === 'hulk') shootAt(e.x, e.y + 14, P.eBulletV * 1.05, S.sector >= 3 ? [-10, 0, 10] : [-5, 5]);
            else if (e.kind === 'carrier') shootAt(e.x, e.y + 8, P.eBulletV * 0.8);
            else if (S.sector >= 2 || rng() < 0.5) shootAt(e.x, e.y + 6, P.eBulletV * 0.85);
            e.fireT = base / P.fireMul * (0.8 + rng() * 0.4);
          } else e.fireT = 99;
        }
      }
    }

    // ---------- Боссы ----------
    function spawnBoss() {
      var D = BOSSES[S.sector - 1];
      S.boss = { kind: D.kind, x: W / 2, y: -70, w: D.w, h: D.h, hp: D.hp, max: D.hp, t: 0, bt: 0,
        ta: 1.2, tb: 2.2, tc: 3.5, vuln: false, entering: true, hurtT: 0, beam: null, spin: 0 };
      setBanner('boss', 2.2, S.sector);
      emit('bossIn', { kind: D.kind });
    }
    function hitBoss(dmg, x, y) {
      var B = S.boss; if (!B || !B.vuln) return;
      B.hp -= dmg; B.hurtT = 0.06;
      if (B.hp <= 0) killBoss();
    }
    function killBoss() {
      var B = S.boss, pts = 2000 + 1000 * S.sector, sc = 30 + 10 * S.sector;
      S.score += pts; S.scrap += sc; S.boss = null; S.eb = [];
      for (var i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead) killEnemy(S.enemies[i]);
      S.booms.push({ x: B.x, y: B.y, t: 0, life: 1.2, r: 140 });
      S.flash = 0.4;
      emit('bossDie', { x: B.x, y: B.y, kind: B.kind, pts: pts, scrap: sc });
      sectorClear();
    }
    function minion(kind, x, y, pat, extra) {
      var e = spawnEnemy(Object.assign({ kind: kind, x: x, pat: pat, minion: true }, extra || {}));
      e.y = y; return e;
    }
    function updBoss(dt, P) {
      var B = S.boss, p = S.player, low = B.hp < B.max * 0.5, v = P.eBulletV;
      B.t += dt; if (B.hurtT > 0) B.hurtT -= dt;
      if (B.entering) {
        B.y += 70 * dt; if (B.y > 30) B.vuln = true;
        if (B.y >= 112) { B.y = 112; B.entering = false; }
        return;
      }
      B.ta -= dt; B.tb -= dt; B.tc -= dt;
      var k = B.kind;
      if (k === 'millstone') {
        B.x = W / 2 + Math.sin(B.t * 0.6) * 130; B.spin += dt * 2;
        if (B.ta <= 0) { ring(B.x, B.y, low ? 14 : 10, v * 0.82, B.t * 40); B.ta = low ? 1.3 : 1.75; }
        if (B.tb <= 0) { shootAt(B.x, B.y + 20, v * 1.05, [-12, 0, 12]); B.tb = 2.6; }
      } else if (k === 'pincer') {
        var tx = p.alive ? p.x : W / 2; B.x += clamp(tx - B.x, -70 * dt, 70 * dt); B.x = clamp(B.x, 80, W - 80);
        if (B.ta <= 0) { shootAt(B.x - 46, B.y + 22, v); shootAt(B.x + 46, B.y + 22, v); B.ta = low ? 1.0 : 1.4; }
        if (B.tb <= 0) {
          minion('mite', B.x - 46, B.y + 20, 'sine', { amp: 16, freq: 2, ph: 0 });
          minion('mite', B.x + 46, B.y + 20, 'sine', { amp: 16, freq: 2, ph: 2 });
          B.tb = 6; emit('spawn', {});
        }
      } else if (k === 'hive') {
        B.x = W / 2 + Math.sin(B.t * 0.4) * 80;
        if (B.ta <= 0) { minion('dart', B.x - 30, B.y + 20, 'dive'); minion('dart', B.x + 30, B.y + 20, 'dive'); if (low) minion('dart', B.x, B.y + 30, 'dive'); B.ta = 3.2; emit('spawn', {}); }
        if (B.tb <= 0) { var fo = aimAngle(B.x, B.y) * 0.5; for (var i = -3; i <= 3; i++) enemyShoot(B.x, B.y + 24, fo + i * 12, v * 0.92); emit('eshoot', {}); B.tb = 1.7; }
        if ((B.t % 6) < (low ? 2.6 : 1.4)) {
          if (B.tc <= 0) { enemyShoot(B.x, B.y, B.t * 230, v * 0.85); enemyShoot(B.x, B.y, B.t * 230 + 180, v * 0.85); B.tc = 0.13; }
        }
      } else if (k === 'pendulum' || k === 'forge') {
        var ph = k === 'forge' ? (B.hp > B.max * 0.66 ? 1 : B.hp > B.max * 0.33 ? 2 : 3) : 3;
        B.phaseN = ph;
        if (!B.beam) { B.bt += dt; B.x = W / 2 + Math.sin(B.bt * (k === 'forge' ? 0.5 : 0.9)) * (k === 'forge' ? 110 : 170); }
        if (B.beam) {
          B.beam.t += dt;
          if (B.beam.t > B.beam.warn + B.beam.on) { B.beam = null; }
          else if (B.beam.t > B.beam.warn) {
            if (!B.beam.fired) { B.beam.fired = true; emit('beam', { x: B.beam.x }); }
            if (p.alive && Math.abs(p.x - B.beam.x) < 14 + P_HIT_R) hitPlayer('beam');
          }
        } else if (ph === 3 && B.tc <= 0) {
          B.beam = { x: B.x, t: 0, warn: 1.0, on: 1.15, fired: false }; B.tc = k === 'forge' ? 3.6 : 3.4;
          emit('beamWarn', { x: B.x });
        }
        if (ph === 1) {
          if (B.ta <= 0) { ring(B.x, B.y, k === 'forge' ? 14 : 12, v * 0.8, B.t * 50); B.ta = 1.6; }
          if (B.tb <= 0) { shootAt(B.x, B.y + 20, v * 1.1, [-8, 8]); B.tb = 2.2; }
        } else if (ph === 2) {
          if (B.tc <= 0) { enemyShoot(B.x, B.y, B.t * 210, v * 0.8); enemyShoot(B.x, B.y, B.t * 210 + 120, v * 0.8); enemyShoot(B.x, B.y, B.t * 210 + 240, v * 0.8); B.tc = 0.17; }
          if (B.tb <= 0) { minion('dart', B.x - 40, B.y + 20, 'dive'); minion('dart', B.x + 40, B.y + 20, 'dive'); B.tb = 4.2; emit('spawn', {}); }
        } else {
          if (B.ta <= 0 && !B.beam) { shootAt(B.x, B.y + 20, v * 1.1, [-9, 0, 9]); B.ta = k === 'forge' ? 1.1 : 1.3; }
          if (B.tb <= 0) { ring(B.x, B.y, k === 'forge' ? 16 : 12, v * 0.8, B.t * 30); B.tb = k === 'forge' ? 2.0 : 2.6; }
        }
      }
      // таран о босса
      if (p.alive && Math.abs(p.x - B.x) < B.w + P_HIT_R && Math.abs(p.y - B.y) < B.h + P_HIT_R) hitPlayer('boss');
    }

    function sectorClear() {
      S.phase = 'clear'; S.phaseT = 2.6;
      var bonus = Math.round(S.base) * 10 + S.sector * 500, sb = Math.floor(S.base / 5);
      S.score += bonus; S.scrap += sb;
      setBanner(S.sector >= SECTORS ? 'final' : 'cleared', 2.6);
      emit('clear', { sector: S.sector, bonus: bonus, scrap: sb });
    }

    // ---------- Мастерская ----------
    function nextPrice(key) {
      var p = S.player, L = PRICES[key];
      if (key === 'weapon') return p.lv[p.weapon] >= 3 ? null : L[p.lv[p.weapon] - 1];
      if (key === 'module') return p.modules >= MODULES_MAX ? null : L[p.modules];
      if (key === 'shield') return p.shMax >= SHIELD_MAX ? null : L[p.shMax - SHIELD_BASE];
      if (key === 'bomb') return p.bombs >= BOMBS_MAX ? null : L[0];
      if (key === 'repair') return S.base >= BASE_MAX ? null : L[0];
      if (key === 'life') return S.lives >= LIVES_MAX ? null : L[0];
      return 0;
    }
    function shopItems() {
      return SHOP.map(function (k) {
        var pr = k === 'next' ? 0 : nextPrice(k);
        return { key: k, price: pr, maxed: pr == null, can: k === 'next' || (pr != null && S.scrap >= pr) };
      });
    }
    function buy(key) {
      if (S.phase !== 'shop') return false;
      if (key === 'next') { leaveShop(); return true; }
      var pr = nextPrice(key), p = S.player;
      if (pr == null || S.scrap < pr) { emit('deny', { key: key }); return false; }
      S.scrap -= pr; S.bought++;
      if (key === 'weapon') p.lv[p.weapon]++;
      else if (key === 'module') p.modules++;
      else if (key === 'shield') { p.shMax++; p.shield = p.shMax; }
      else if (key === 'bomb') p.bombs++;
      else if (key === 'repair') S.base = Math.min(BASE_MAX, S.base + REPAIR);
      else if (key === 'life') S.lives++;
      emit('buy', { key: key, price: pr });
      return true;
    }
    function leaveShop() {
      if (S.phase !== 'shop') return;
      emit('shopOut', {});
      startSector(S.sector + 1);
    }
    function shopMove(d) { if (S.phase !== 'shop') return; S.shop.sel = (S.shop.sel + d + SHOP.length) % SHOP.length; emit('shopMove', {}); }
    function shopConfirm() { if (S.phase !== 'shop' || S.shop.t < 0.5) return false; return buy(SHOP[S.shop.sel]); }

    // ---------- Шаг симуляции ----------
    function step(dt) {
      var p = S.player, P = params(), i, j, e, b;
      S.t += dt; S.scroll += dt * (S.phase === 'shop' ? 12 : 60);
      if (S.bannerT > 0) { S.bannerT -= dt; if (S.bannerT <= 0) S.banner = null; }
      if (S.flash > 0) S.flash -= dt;
      if (S.baseHitT > 0) S.baseHitT -= dt;
      for (i = S.booms.length - 1; i >= 0; i--) { S.booms[i].t += dt; if (S.booms[i].t >= S.booms[i].life) S.booms.splice(i, 1); }

      if (S.overT > 0) {
        S.overT -= dt;
        if (S.overT <= 0) { S.over = true; emit('gameover', { score: S.score, reason: S.base <= 0 ? 'base' : 'ship' }); return; }
      }

      // фазы
      if (S.phase === 'intro') {
        S.phaseT -= dt; if (S.phaseT <= 0) S.phase = 'waves';
      } else if (S.phase === 'waves') {
        S.waveT -= dt;
        var live = 0; for (i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead) live++;
        if (S.waveIdx < S.waveCount) {
          if (S.waveT <= 0 && S.spawnQ.length === 0 && live <= P.maxLive) {
            buildWave(pickWave()); S.waveIdx++; S.waveT = P.gap;
          }
        } else if (S.spawnQ.length === 0 && live === 0 && S.overT <= 0) {
          S.phase = 'warn'; S.phaseT = 1.6; setBanner('warn', 1.6); emit('warn', {});
        }
      } else if (S.phase === 'warn') {
        S.phaseT -= dt; if (S.phaseT <= 0) { S.phase = 'boss'; spawnBoss(); }
      } else if (S.phase === 'clear') {
        S.phaseT -= dt;
        for (i = 0; i < S.scraps.length; i++) S.scraps[i].mag = true;
        if (S.phaseT <= 0 && S.overT <= 0) {
          if (S.sector >= SECTORS) { S.over = true; S.won = true; emit('win', { score: S.score }); return; }
          S.phase = 'shop'; S.shop.sel = 0; S.shop.t = 0; S.eb = []; S.pb = [];
          // «добираем» оставшийся металлолом
          for (i = 0; i < S.scraps.length; i++) S.scrap += S.scraps[i].v;
          S.scraps = [];
          emit('shop', {});
        }
      } else if (S.phase === 'shop') {
        S.shop.t += dt;
      }

      // спавн из очереди
      for (i = S.spawnQ.length - 1; i >= 0; i--) {
        S.spawnQ[i].delay -= dt;
        if (S.spawnQ[i].delay <= 0) { spawnEnemy(S.spawnQ[i]); S.spawnQ.splice(i, 1); }
      }

      // игрок
      if (p.alive && S.phase !== 'shop') {
        var len = Math.sqrt(p.dx * p.dx + p.dy * p.dy) || 1, k = len > 1 ? 1 / len : 1;
        p.x = clamp(p.x + p.dx * k * P_SPEED * dt, 16, W - 16);
        p.y = clamp(p.y + p.dy * k * P_SPEED * dt, Y_MIN, Y_MAX);
        if (p.inv > 0) p.inv -= dt;
        if (p.shield < p.shMax) { p.regenT -= dt; if (p.regenT <= 0) { p.shield++; p.regenT = SHIELD_REGEN; emit('shieldUp', {}); } }
      }
      if (p.cd > 0) p.cd -= dt; if (p.modCd > 0) p.modCd -= dt; if (p.shootT > 0 && p.weapon !== 'ray') p.shootT -= dt;
      if (!p.alive && S.overT <= 0 && p.respawnT > 0) {
        p.respawnT -= dt;
        if (p.respawnT <= 0 && S.lives > 0) {
          p.alive = true; p.x = W / 2; p.y = 570; p.inv = 2.4; p.shield = p.shMax; p.regenT = SHIELD_REGEN;
          emit('respawn', {}); setBanner('ready', 1.0);
        }
      }
      fireWeapons(dt);

      // враги
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i]; if (e.dead) continue;
        updEnemy(e, dt, P);
        if (e.y > BREACH_Y) {   // врезался в заслон у нижнего края
          e.dead = true; e.breached = true; S.booms.push({ x: e.x, y: BREACH_Y, t: 0, life: 0.5, r: e.r * 2.5, base: true });
          var dmg = KINDS[e.kind].breach;
          S.base = Math.max(0, S.base - dmg); S.baseHitT = 0.5; S.stats.breaches++;
          emit('breach', { x: e.x, dmg: dmg, base: S.base });
          if (S.base <= 0 && S.overT <= 0) { S.overT = 1.6; setBanner('baseDown', 1.6); emit('baseDown', {}); }
          continue;
        }
        // таран
        if (p.alive && p.inv <= 0) {
          var dx = e.x - p.x, dy = e.y - p.y, rr = e.r + P_HIT_R;
          if (dx * dx + dy * dy < rr * rr) { if (hitPlayer('ram')) damageEnemy(e, 3); }
        }
      }
      if (S.enemies.length > 40 || (S.t % 2 < dt)) S.enemies = S.enemies.filter(function (q) { return !q.dead; });

      if (S.boss) updBoss(dt, P);

      // пули игрока
      for (i = S.pb.length - 1; i >= 0; i--) {
        b = S.pb[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.y < -20 || b.x < -20 || b.x > W + 20 || b.life <= 0) { S.pb.splice(i, 1); continue; }
        var hit = false;
        for (j = 0; j < S.enemies.length; j++) {
          e = S.enemies[j]; if (e.dead || e.y < -e.r) continue;
          var ex = b.x - e.x, ey = b.y - e.y, r2 = e.r + 3;
          if (ex * ex + ey * ey < r2 * r2) { damageEnemy(e, b.dmg); hit = true; break; }
        }
        if (!hit && S.boss && S.boss.vuln && Math.abs(b.x - S.boss.x) < S.boss.w && Math.abs(b.y - S.boss.y) < S.boss.h) {
          hitBoss(b.dmg, b.x, b.y); hit = true; if (rng() < 0.15) emit('bossHit', { x: b.x, y: b.y });
        }
        if (hit) S.pb.splice(i, 1);
      }
      // пули врагов
      for (i = S.eb.length - 1; i >= 0; i--) {
        var q = S.eb[i]; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.y > H + 20 || q.y < -40 || q.x < -20 || q.x > W + 20) { S.eb.splice(i, 1); continue; }
        if (p.alive && p.inv <= 0) {
          var qx = q.x - p.x, qy = q.y - p.y, qr = q.r + P_HIT_R;
          if (qx * qx + qy * qy < qr * qr) { S.eb.splice(i, 1); hitPlayer('bullet'); }
        }
      }
      // металлолом
      for (i = S.scraps.length - 1; i >= 0; i--) {
        var s = S.scraps[i];
        var sx = p.x - s.x, sy = p.y - s.y, d = Math.sqrt(sx * sx + sy * sy) || 1;
        if (p.alive && (d < 80 || s.mag)) { s.mag = true; var sp = (s.mag && S.phase === 'clear' ? 520 : 300) * dt; s.x += sx / d * Math.min(sp, d); s.y += sy / d * Math.min(sp, d); }
        else s.y += s.vy * dt;
        if (p.alive && d < 18) { S.scrap += s.v; S.scraps.splice(i, 1); emit('scrap', { v: s.v, x: s.x, y: s.y }); continue; }
        if (s.y > H + 20) S.scraps.splice(i, 1);
      }
      // капсулы оружия: вид меняется по кругу
      for (i = S.caps.length - 1; i >= 0; i--) {
        var c = S.caps[i]; c.t += dt; c.y += 48 * dt; c.x = c.x0 + Math.sin(c.t * 2) * 18;
        c.type = (WEAPONS.indexOf(S.player.weapon) + Math.floor(c.t / CAPSULE_CYCLE)) % 3; c.ty = WEAPONS[c.type];
        var cx = c.x - p.x, cy = c.y - p.y;
        if (p.alive && cx * cx + cy * cy < 24 * 24) { takeCapsule(c.ty); S.caps.splice(i, 1); continue; }
        if (c.y > H + 20) S.caps.splice(i, 1);
      }

    }
    function takeCapsule(type) {
      var p = S.player;
      if (p.weapon === type) {
        if (p.lv[type] < 3) { p.lv[type]++; emit('capsule', { type: type, lv: p.lv[type], up: true }); }
        else { S.score += 500; emit('capsule', { type: type, lv: 3, bonus: 500 }); }
      } else { p.weapon = type; p.cd = 0; emit('capsule', { type: type, lv: p.lv[type], sw: true }); }
    }

    function update(dt) {
      if (!S.started || S.over) return;
      var n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
      for (var i = 0; i < n && !S.over; i++) step(h);
    }
    function start() {
      var p = S.player;
      S.score = 0; S.lives = opts.lives || 3; S.scrap = opts.scrap || 0; S.base = BASE_MAX; S.over = false; S.won = false;
      S.started = true; S.t = 0; S.overT = 0; S.pb = []; S.scraps = []; S.booms = []; S.bought = 0;
      p.x = W / 2; p.y = 560; p.alive = true; p.inv = 1.2; p.respawnT = 0; p.cd = 0; p.modCd = 0;
      p.shMax = SHIELD_BASE; p.shield = SHIELD_BASE; p.regenT = SHIELD_REGEN; p.weapon = 'spark';
      p.lv = { spark: 1, ray: 1, shot: 1 }; p.modules = 0; p.bombs = 2;
      startSector(opts.startSector || 1);
      emit('start', {});
      return api;
    }

    var api = {
      W: W, H: H,
      start: start, reset: start, update: update,
      setDir: function (x, y) { S.player.dx = x < 0 ? -1 : x > 0 ? 1 : 0; S.player.dy = y < 0 ? -1 : y > 0 ? 1 : 0; },
      setFire: function (v) { S.player.fire = !!v; },
      bomb: bomb,
      shopItems: shopItems, shopMove: shopMove, shopConfirm: shopConfirm, buy: buy, leaveShop: leaveShop,
      shopSelect: function (i) { if (S.phase === 'shop' && i >= 0 && i < SHOP.length) S.shop.sel = i; },
      price: nextPrice,
      isOver: function () { return S.over; },
      state: function () { return S; },
      params: params,
      // для тестов:
      _S: S, _step: step, _spawn: spawnEnemy, _damage: damageEnemy, _hitPlayer: hitPlayer,
      _spawnBoss: spawnBoss, _hitBoss: hitBoss, _clear: sectorClear, _take: takeCapsule, _startSector: startSector
    };
    return api;
  };

  Z.consts = {
    W: W, H: H, SECTORS: SECTORS, Y_MIN: Y_MIN, Y_MAX: Y_MAX, P_SPEED: P_SPEED, P_HIT_R: P_HIT_R,
    KINDS: KINDS, BOSSES: BOSSES, GUN: GUN, WEAPONS: WEAPONS, SHOP: SHOP, PRICES: PRICES, REPAIR: REPAIR,
    BASE_MAX: BASE_MAX, BREACH_Y: BREACH_Y, LIVES_MAX: LIVES_MAX, BOMBS_MAX: BOMBS_MAX, SHIELD_BASE: SHIELD_BASE, SHIELD_MAX: SHIELD_MAX,
    MODULES_MAX: MODULES_MAX, MOD_DX: MOD_DX, CAPSULE_CYCLE: CAPSULE_CYCLE
  };
  Z.W = W; Z.H = H;
})(typeof window !== 'undefined' ? window : globalThis);
