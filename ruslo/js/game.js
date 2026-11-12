/* ============================================================================
 * РУСЛО · HTML5 — игровой движок
 * Механика: вертикальный скролл реки, самолёт,
 * враги (катера/вертолёты/истребители), заправки, мосты, топливо, жизни.
 * Два режима графики (ретро/модерн) — в js/render.js.
 * ========================================================================== */
'use strict';
(function (RR) {
  if (!RR) return;
  const { W, H, PLAY_TOP, PLAY_H, PLANE_SY, clamp, lerp, rnd, rndi } = RR;
  const $ = (id) => document.getElementById(id);

  /* ====================== состояние ====================== */
  const cfg = {
    // По умолчанию — ретро-режим.
    // Если пользователь уже переключался, уважаем сохранённый выбор.
    gfx: RR.store.get('gfx', 'retro') === 'modern' ? 'modern' : 'retro',
    lang: RR.getLang(),
    sound: RR.store.get('sound', true) !== false,
    volume: clamp(Number(RR.store.get('volume', 0.65)) || 0.65, 0, 1),
    hi: Math.max(0, Number(RR.store.get('hi', 0)) || 0),
    audioReady: false,
    pendingTrack: null,
  };

  const S = {
    mode: 'menu',          // menu | play | dying | over
    paused: false,
    gfx: cfg.gfx,
    time: 0,
    camY: 3000,
    runTime: 0,
    score: 0,
    hi: cfg.hi,
    level: 1,
    lives: 3,
    fuel: 100,
    maxFuel: 100,
    planeX: W / 2,
    planeVX: 0,
    planeTilt: 0,
    invuln: 0,
    speed: 0,
    throttle: 0,
    bridge: null,
    levelPending: 0,
    bullets: [],
    enemies: [],
    depots: [],
    islands: [],
    particles: [],
    floaters: [],
    river: null,
    gen: { islandY: 0, depotY: 0, enemyY: 0 },
    msg: null,
    shake: 0,
    flash: 0,
    fuelAlarm: 0,
    shotCd: 0,
    shotsFired: 0,
    shotsHit: 0,
    deathReason: '',
    dyingT: 0,
    bridgeAhead: 0,
    menuIndex: 0,
    attract: 0,
    errors: [],
  };
  RR.S = S;
  RR.cfg = cfg;

  const keys = { left: false, right: false, up: false, down: false, fire: false };
  const view = { dpr: 1 };

  /* ====================== утилиты ====================== */
  function banner(title, sub, dur = 1.6, tone = 'info') {
    S.msg = { title, sub: sub || '', t: dur, max: dur, tone };
  }
  function boom(x, y, size = 1, tone = 'warm') {
    const n = Math.round(7 + size * 9);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(30, 190) * size;
      S.particles.push({
        type: i % 4 === 0 ? 'smoke' : 'spark',
        x, y, vx: Math.cos(a) * sp * 0.7, vy: Math.sin(a) * sp * 0.7,
        life: rnd(0.25, 0.75) * (1 + size * 0.2), max: 0.9,
        size: rnd(1.2, 3.2) * (0.7 + size * 0.3), tone,
      });
    }
    S.particles.push({ type: 'ring', x, y, vx: 0, vy: 0, life: 0.38, max: 0.38, size: 6 * size, tone });
    S.shake = Math.min(18, S.shake + 3 * size);
  }
  /** Всплывающие «+30» в точке события. */
  function popup(x, y, text, color) {
    S.floaters.push({ x, y, text: String(text), life: 0.9, max: 0.9, color: color || '#ffe36b' });
  }

  /* ====================== аудио ====================== */
  function audio() { return window.Chiptune || null; }
  function unlockAudio() {
    const a = audio();
    if (!a) return;
    try {
      if (!cfg.audioReady) {
        cfg.audioReady = true;
        a.init && a.init();
        a.setVolume && a.setVolume(cfg.volume);
        a.setMuted && a.setMuted(!cfg.sound);
        const track = cfg.pendingTrack || (S.mode === 'play' ? 'game' : S.mode === 'over' ? 'over' : 'menu');
        cfg.pendingTrack = null;
        a.startMusic && a.startMusic(track);
      } else {
        a.init && a.init();
      }
    } catch (e) { console.warn('audio unlock:', e && e.message); }
  }
  function sfx(name) {
    if (!cfg.sound || !cfg.audioReady) return;
    try { audio() && audio().sfx && audio().sfx(name); } catch (e) { /* звук не критичен */ }
  }
  function music(track) {
    if (!cfg.audioReady) { cfg.pendingTrack = track; return; }
    try { audio() && audio().startMusic && audio().startMusic(track); } catch (e) { /* noop */ }
  }
  function audioPause(p) {
    if (!cfg.audioReady) return;
    try { audio() && audio().setPaused && audio().setPaused(p); } catch (e) { /* noop */ }
  }

  /* ====================== река ====================== */
  function makeRiver(seed) {
    const r = RR.mulberry32(seed);
    return {
      a1: 28 + r() * 20, f1: 0.0055 + r() * 0.0032, p1: r() * 6.283,
      a2: 10 + r() * 10, f2: 0.016 + r() * 0.012, p2: r() * 6.283,
      a3: 4 + r() * 4, f3: 0.05 + r() * 0.04, p3: r() * 6.283,
      base: 68 + r() * 18,
      w1: 8 + r() * 7, f4: 0.004 + r() * 0.004, p4: r() * 6.283,
      w2: 5 + r() * 4, f5: 0.021 + r() * 0.02, p5: r() * 6.283,
    };
  }

  /** Границы реки в мировых координатах y (непрерывно, без дискретизации). */
  function riverAt(y) {
    const p = S.river;
    const i = y / RR.ROW;
    const c = W / 2
      + p.a1 * Math.sin(i * p.f1 + p.p1)
      + p.a2 * Math.sin(i * p.f2 + p.p2)
      + p.a3 * Math.sin(i * p.f3 + p.p3);
    const hw = clamp(p.base
      + p.w1 * Math.sin(i * p.f4 + p.p4)
      + p.w2 * Math.sin(i * p.f5 + p.p5), 40, 106);
    return { L: c - hw, R: c + hw, c, hw };
  }
  RR.riverAt = riverAt;

  function inIsland(x, y) {
    for (let i = 0; i < S.islands.length; i++) {
      const is = S.islands[i];
      if (Math.abs(y - is.y) > is.ry + 4) continue;
      const dx = (x - is.x) / is.rx, dy = (y - is.y) / is.ry;
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }
  RR.inIsland = inIsland;

  function onLand(x, y) {
    const r = riverAt(y);
    return x < r.L + 2 || x > r.R - 2 || inIsland(x, y);
  }

  function screenY(y) { return PLAY_TOP + PLANE_SY - (y - S.camY); }
  RR.screenY = screenY;

  /* ====================== генерация мира ====================== */
  function addIsland(y) {
    const r = riverAt(y);
    const rx = rnd(14, 26), ry = rnd(26, 56);
    let x = r.c + rnd(-0.5, 0.5) * r.hw;
    // оставляем проходимый проток минимум 48 px с одной стороны
    const leftGap = (x - rx) - r.L, rightGap = r.R - (x + rx);
    if (Math.max(leftGap, rightGap) < 58) {
      if (leftGap > rightGap) x = r.L + rx + 58;
      else x = r.R - rx - 58;
      x = clamp(x, r.L + rx * 0.6, r.R - rx * 0.6);
    }
    if (x - rx < r.L + 4 || x + rx > r.R - 4) return;
    S.islands.push({ x, y, rx, ry });
    return { x, y };
  }

  function addDepot(y) {
    const r = riverAt(y);
    if (r.hw < 46) return;
    const x = clamp(r.c + rnd(-0.4, 0.4) * r.hw, r.L + 22, r.R - 22);
    if (S.islands.some((is) => Math.abs(is.y - y) < is.ry + 42 && Math.abs(is.x - x) < is.rx + 30)) return;
    if (S.bridge && Math.abs(S.bridge.y - y) < 130) return;
    S.depots.push({ x, y, used: false, t: 0 });
  }

  function spawnEnemy(y) {
    if (S.bridge && Math.abs(S.bridge.y - y) < 150) return;
    if (S.depots.some((d) => Math.abs(d.y - y) < 55)) return;
    const r = riverAt(y);
    if (r.hw < 42) return;
    const L = S.level;
    let pool = ['boat', 'boat', 'boat'];
    if (L >= 2) pool.push('heli', 'heli');
    if (L >= 3) pool.push('jet');
    const type = pool[rndi(0, pool.length - 1)];
    if (type === 'jet') {
      const fromLeft = Math.random() < 0.5;
      const vx = (fromLeft ? 1 : -1) * (112 + L * 9);
      S.enemies.push({
        type, x: fromLeft ? -36 : W + 36, y,
        vx, w: 22, h: 12, dead: false, t: rnd(0, 6),
      });
      return;
    }
    const speed = type === 'boat' ? 22 + L * 3 : 44 + L * 4;
    const x = clamp(r.c + rnd(-0.5, 0.5) * r.hw, r.L + 18, r.R - 18);
    S.enemies.push({
      type, x, y,
      vx: (Math.random() < 0.5 ? -1 : 1) * speed,
      w: type === 'boat' ? 18 : 20, h: type === 'boat' ? 9 : 12,
      dead: false, t: rnd(0, 6),
    });
  }

  function spawnBridge() {
    const y = S.camY + 2450 + S.level * 150;
    S.bridge = { y, hp: 3, maxHp: 3, alive: true, flash: 0, destroyedT: 0 };
    // убираем всё, что оказалось бы прямо под мостом
    S.islands = S.islands.filter((is) => Math.abs(is.y - y) > 110);
    S.depots = S.depots.filter((d) => Math.abs(d.y - y) > 140);
    S.enemies = S.enemies.filter((e) => Math.abs(e.y - y) > 160);
  }

  function ensureWorld() {
    const horizon = S.camY + 3400;
    while (S.gen.islandY < horizon) {
      const y = S.gen.islandY;
      addIsland(y);
      S.gen.islandY = y + rnd(380, 760);
    }
    while (S.gen.depotY < horizon) {
      const y = S.gen.depotY;
      addDepot(y);
      S.gen.depotY = y + rnd(640, 1040);
    }
    while (S.gen.enemyY < horizon) {
      spawnEnemy(S.gen.enemyY);
      S.gen.enemyY += Math.max(70, 205 - S.level * 14) + rnd(0, 70);
    }
    const behind = S.camY - 520;
    if (S.islands.length && S.islands[0].y < behind) S.islands = S.islands.filter((i) => i.y > behind);
    if (S.depots.length && S.depots[0].y < behind) S.depots = S.depots.filter((d) => d.y > behind);
    if (S.enemies.length) {
      S.enemies = S.enemies.filter((e) => {
        if (e.dead) return false; // обломки уже ушли в particles
        if (e.type === 'jet') return e.x > -60 && e.x < W + 60;
        return e.y > behind;
      });
    }
  }

  /* ====================== жизненный цикл ====================== */
  function resetWorld(seed = (Math.random() * 1e9) | 0) {
    S.river = makeRiver(seed);
    S.seed = seed;
    S.camY = 3000;
    S.time = 0;
    S.runTime = 0;
    S.score = 0;
    S.level = 1;
    S.lives = 3;
    S.fuel = S.maxFuel;
    S.planeX = W / 2;
    S.planeVX = 0;
    S.planeTilt = 0;
    S.invuln = 2.2;
    S.speed = 0;
    S.throttle = 0;
    S.bullets = [];
    S.enemies = [];
    S.depots = [];
    S.islands = [];
    S.particles = [];
    S.floaters = [];
    S.bridge = null;
    S.levelPending = 0;
    S.msg = null;
    S.shake = 0;
    S.flash = 0;
    S.fuelAlarm = 0;
    S.shotCd = 0;
    S.shotsFired = 0;
    S.shotsHit = 0;
    S.deathReason = '';
    S.dyingT = 0;
    S.gen.islandY = S.camY + 140;
    S.gen.depotY = S.camY + 540;
    S.gen.enemyY = S.camY + 300;
    S.planeX = riverAt(S.camY).c;
    ensureWorld();
  }

  function startGame() {
    resetWorld();
    S.mode = 'play';
    S.paused = false;
    spawnBridge();
    setOverlay(null);
    syncUI();
    music('game');
    sfx('start');
    updateRecordUI();
    unlockAudio();
  }

  function toMenu() {
    S.mode = 'menu';
    S.paused = false;
    resetWorld();
    setOverlay('menu');
    syncUI();
    music('menu');
    audioPause(false);
  }

  function gameOver() {
    S.mode = 'over';
    S.paused = false;
    if (S.score > S.hi) { S.hi = S.score; RR.store.set('hi', S.hi); }
    updateRecordUI();
    const sr = $('scoreOver'), hr = $('hiOver'), rs = $('reasonOver');
    if (sr) sr.textContent = RR.pad(S.score, 6);
    if (hr) hr.textContent = RR.pad(S.hi, 6);
    if (rs) rs.textContent = RR.t('reasonLine') + ': ' + RR.t(reasonKey(S.deathReason));
    const acc = $('accuracyOver');
    if (acc) {
      const pct = S.shotsFired ? Math.round((S.shotsHit / S.shotsFired) * 100) : 0;
      acc.textContent = RR.t('shots') + ' ' + S.shotsFired + ' · ' + RR.t('hits') + ' ' + S.shotsHit + ' · ' + RR.t('accuracy') + ' ' + pct + '%';
    }
    const overTitle = $('overTitle');
    if (overTitle) overTitle.textContent = RR.t('gameOver');
    setOverlay('over');
    music('over');
    sfx('gameOver');
  }

  function reasonKey(r) {
    if (r === 'fuel') return 'diedFuel';
    if (r === 'enemy') return 'diedEnemy';
    if (r === 'bridge') return 'diedBridge';
    return 'diedBank';
  }

  function die(reason) {
    if (S.mode !== 'play') return;
    S.mode = 'dying';
    S.dyingT = 1.45;
    S.deathReason = reason;
    S.lives--;
    boom(S.planeX, S.camY, 2.6, 'warm');
    boom(S.planeX, S.camY, 1.4, 'hot');
    S.flash = 0.55;
    S.shake = 18;
    S.bullets = [];
    sfx('crash');
    S.particles.push({ type: 'ring', x: S.planeX, y: S.camY, vx: 0, vy: 0, life: 0.7, max: 0.7, size: 14, tone: 'hot' });
  }

  function respawn() {
    S.mode = 'play';
    S.planeX = clamp(riverAt(S.camY).c, 30, W - 30);
    S.planeVX = 0;
    S.invuln = 3.0;
    S.fuel = Math.max(S.fuel, 60);
    S.enemies = S.enemies.filter((e) => Math.abs(e.y - S.camY) > 320);
    S.particles = [];
    setOverlay(null);
  }

  function shoot() {
    if (S.mode !== 'play' || S.paused || S.shotCd > 0) return;
    if (S.bullets.length >= 4) return;
    S.shotCd = 0.16;
    S.shotsFired++;
    S.bullets.push({ x: S.planeX + (S.planeVX > 40 ? 4 : S.planeVX < -40 ? -4 : 0), y: S.camY + 12 });
    sfx('shot');
  }

  function damageBridge() {
    const b = S.bridge;
    if (!b || !b.alive) return;
    b.hp--;
    b.flash = 0.2;
    boom(W / 2, b.y, 0.8, 'hot');
    S.shake = Math.min(16, S.shake + 2);
    if (b.hp <= 0) {
      b.alive = false;
      b.destroyedT = 0;
      S.score += 500 + S.level * 50;
      boom(W / 2, b.y, 3.2, 'hot');
      boom(W / 2, b.y, 2, 'warm');
      S.flash = 0.5;
      S.shake = 20;
      S.levelPending = 1.8;
      banner(RR.t('levelDone'), '+' + (500 + S.level * 50), 1.8, 'good');
      sfx('bigExplosion');
    } else {
      sfx('explosion');
    }
  }

  function nextLevel() {
    S.level++;
    S.gen.enemyY = S.camY + 500;
    spawnBridge();
    S.fuel = Math.min(S.maxFuel, S.fuel + 22);
    if (S.level % 3 === 0 && S.lives < 5) S.lives++;
    banner(RR.t('levelNew') + ' ' + S.level, '', 1.5, 'good');
    sfx('levelUp');
  }

  /* ====================== обновление ====================== */
  function updateParticles(dt) {
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.life -= dt;
      if (p.life <= 0) { S.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'smoke') { p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt; }
    }
    for (let i = S.floaters.length - 1; i >= 0; i--) {
      const f = S.floaters[i];
      f.life -= dt;
      f.y += 30 * dt;
      if (f.life <= 0) S.floaters.splice(i, 1);
    }
  }

  function updateBullets(dt) {
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      b.y += 640 * dt;
      if (b.y > S.camY + PLANE_SY + 20) { S.bullets.splice(i, 1); continue; }

      // мост
      if (S.bridge && S.bridge.alive && Math.abs(b.y - S.bridge.y) < 15) {
        const r = riverAt(S.bridge.y);
        if (b.x > r.L - 22 && b.x < r.R + 22) {
          S.bullets.splice(i, 1);
          S.shotsHit++;
          damageBridge();
          continue;
        }
      }
      // заправки
      let hit = false;
      for (const d of S.depots) {
        if (d.used) continue;
        if (Math.abs(b.y - d.y) < 17 && Math.abs(b.x - d.x) < 19) {
          d.used = true;
          S.score += 80;
          S.shotsHit++;
          popup(d.x, d.y, '+80', '#ffd166');
          boom(d.x, d.y, 1.4, 'warm');
          sfx('explosion');
          S.bullets.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // враги
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (Math.abs(b.y - e.y) < e.h / 2 + 4 && Math.abs(b.x - e.x) < e.w / 2 + 3) {
          e.dead = true;
          S.shotsHit++;
          const pts = e.type === 'boat' ? 30 : e.type === 'heli' ? 60 : 80;
          S.score += pts;
          popup(e.x, e.y, '+' + pts, e.type === 'jet' ? '#8ff8e4' : '#ffe36b');
          boom(e.x, e.y, e.type === 'jet' ? 1.2 : 1, 'warm');
          sfx('explosion');
          S.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  function updateEnemies(dt) {
    for (const e of S.enemies) {
      if (e.dead) continue;
      e.t += dt;
      e.x += e.vx * dt;
      if (e.type !== 'jet') {
        const r = riverAt(e.y);
        const m = e.w / 2 + 4;
        if (e.x < r.L + m) { e.x = r.L + m; e.vx = Math.abs(e.vx); }
        if (e.x > r.R - m) { e.x = r.R - m; e.vx = -Math.abs(e.vx); }
        // не заезжать на острова: разворачиваемся у кромки
        if (inIsland(e.x + Math.sign(e.vx) * m, e.y)) e.vx = -e.vx;
      }
    }
  }

  function collideFuel() {
    for (const d of S.depots) {
      if (d.used) continue;
      if (Math.abs(S.camY - d.y) < 28 && Math.abs(S.planeX - d.x) < 23) {
        d.used = true;
        S.fuel = S.maxFuel;
        S.score += 50;
        popup(d.x, d.y, '+50', '#8ff8e4');
        banner(RR.t('fuelTaken'), '+' + 50, 1.1, 'good');
        boom(d.x, d.y, 0.8, 'cool');
        sfx('fuel');
      }
    }
  }

  function collideWorld() {
    if (S.invuln > 0) return;
    // берега и острова — проверяем точки корпуса
    const pts = [
      [S.planeX, S.camY + 9],
      [S.planeX - 8, S.camY + 1],
      [S.planeX + 8, S.camY + 1],
      [S.planeX, S.camY - 7],
    ];
    for (const [x, y] of pts) {
      if (onLand(x, y)) { die('bank'); return; }
    }
    // мост
    if (S.bridge && S.bridge.alive && S.camY + 9 > S.bridge.y - 9) { die('bridge'); return; }
    // враги
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (Math.abs(S.planeX - e.x) < e.w / 2 + 7 && Math.abs(S.camY - e.y) < e.h / 2 + 6) {
        e.dead = true;
        die('enemy');
        return;
      }
    }
  }

  function playUpdate(dt) {
    const L = S.level;
    // тяга/скорость
    const targetThrottle = keys.up ? 1 : keys.down ? -1 : 0;
    S.throttle = RR.approach(S.throttle, targetThrottle, dt * 3.2);
    const base = Math.min(180, 94 + (L - 1) * 8);
    S.speed = base * (1 + (S.throttle > 0 ? 0.62 * S.throttle : 0.45 * S.throttle));
    S.camY += S.speed * dt;
    S.runTime += dt;

    // самолёт
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    S.planeVX = RR.approach(S.planeVX, dir * 196, dt * (dir ? 1050 : 850));
    S.planeX = clamp(S.planeX + S.planeVX * dt, 8, W - 8);
    S.planeTilt = lerp(S.planeTilt, dir * 0.38, Math.min(1, dt * 9));

    // топливо
    S.fuel -= (1.8 + 0.9 * (S.speed / base)) * dt;
    if (S.fuel <= 0) {
      S.fuel = 0;
      die('fuel');
      return;
    }
    if (S.fuel < 26) {
      S.fuelAlarm -= dt;
      if (S.fuelAlarm <= 0) { S.fuelAlarm = 1.1; sfx('tick'); }
    }

    // выстрел
    S.shotCd = Math.max(0, S.shotCd - dt);
    if (keys.fire) shoot();

    // мир
    ensureWorld();
    updateEnemies(dt);
    updateBullets(dt);
    collideFuel();
    collideWorld();
    updateParticles(dt);

    // уровень
    if (S.levelPending > 0) {
      S.levelPending -= dt;
      if (S.levelPending <= 0) nextLevel();
    }

    // таймеры
    if (S.invuln > 0) S.invuln -= dt;
    if (S.bridge) {
      S.bridge.flash = Math.max(0, S.bridge.flash - dt);
      if (!S.bridge.alive) S.bridge.destroyedT += dt;
      S.bridgeAhead = S.bridge.alive ? clamp((S.bridge.y - S.camY) / 1000, 0, 1) : 0;
    }
    if (S.msg) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
    S.shake = Math.max(0, S.shake - 46 * dt);
    S.flash = Math.max(0, S.flash - 2.4 * dt);
  }

  function attractUpdate(dt) {
    // экран-заставка под меню: река живёт своей жизнью
    S.attract += dt;
    S.camY += 62 * dt;
    const mid = riverAt(S.camY).c;
    S.planeX = mid + Math.sin(S.attract * 0.55) * 52 + Math.sin(S.attract * 1.7) * 10;
    S.planeTilt = Math.cos(S.attract * 0.55) * 0.3;
    S.speed = 62;
    ensureWorld();
    updateEnemies(dt);
    updateParticles(dt);
    S.shake = Math.max(0, S.shake - 46 * dt);
    S.flash = Math.max(0, S.flash - 2.4 * dt);
    if (S.msg) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
  }

  function update(dt) {
    S.time += dt;
    if (S.mode === 'menu') { attractUpdate(dt); return; }
    if (S.mode === 'over') { updateParticles(dt); S.shake = Math.max(0, S.shake - 46 * dt); return; }
    if (S.paused) return;
    if (S.mode === 'dying') {
      S.dyingT -= dt;
      updateParticles(dt);
      S.shake = Math.max(0, S.shake - 40 * dt);
      S.flash = Math.max(0, S.flash - 2.4 * dt);
      if (S.dyingT <= 0) {
        if (S.lives > 0) respawn();
        else gameOver();
      }
      return;
    }
    playUpdate(dt);
  }

  /* ====================== интерфейс ====================== */
  function setOverlay(name) {
    document.body.dataset.state = name || 'play';
    for (const key of ['menu', 'help', 'pause', 'over']) {
      const el = $('ov-' + key);
      if (el) el.classList.toggle('is-open', key === name);
    }
    if (name) { RR.applyI18n(); applyStartHint(); }
  }

  function updateRecordUI() {
    const v = RR.pad(S.hi, 6);
    const a = $('menuRecord'), b = $('hiOver');
    if (a) a.textContent = v;
    if (b) b.textContent = v;
  }

  function syncUI() {
    document.documentElement.dataset.gfx = S.gfx;
    document.documentElement.dataset.lang = RR.getLang();
    const gf = $('valGfx'), sf = $('valSound'), lf = $('valLang');
    if (gf) gf.textContent = RR.t(S.gfx === 'retro' ? 'modeRetro' : 'modeModern');
    if (sf) sf.textContent = RR.t(cfg.sound ? 'on' : 'off');
    if (lf) lf.textContent = RR.getLang() === 'ru' ? 'РУС' : 'ENG';
    const qG = $('quickGfx'), qL = $('quickLang'), qS = $('quickSound');
    if (qG) qG.textContent = S.gfx === 'retro' ? '8-BIT' : 'NEON';
    if (qL) qL.textContent = RR.getLang() === 'ru' ? 'RU' : 'EN';
    if (qS) { qS.textContent = cfg.sound ? '♪' : '×'; qS.classList.toggle('is-off', !cfg.sound); }
    const gfxTag = $('gfxTag');
    if (gfxTag) gfxTag.textContent = RR.t(S.gfx === 'retro' ? 'tagRetro' : 'tagModern');
    applyStartHint();
    updateRecordUI();
  }

  function applyStartHint() {
    const el = document.querySelector('.start-hint');
    if (!el) return;
    el.textContent = RR.t(isTouchDevice() ? 'startHintTouch' : 'startHint');
  }

  function isTouchDevice() {
    try {
      return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    } catch (e) { return false; }
  }

  function setGfx(next) {
    S.gfx = next === 'retro' ? 'retro' : 'modern';
    cfg.gfx = S.gfx;
    RR.store.set('gfx', S.gfx);
    fit();
    S.flash = 0.25;
    syncUI();
    RR.on.gfx.forEach((fn) => { try { fn(S.gfx); } catch (e) { console.error(e); } });
  }
  function toggleGfx() { setGfx(S.gfx === 'retro' ? 'modern' : 'retro'); sfx('select'); }

  function setSound(on) {
    cfg.sound = !!on;
    RR.store.set('sound', cfg.sound);
    if (cfg.sound) unlockAudio();
    try { audio() && audio().setMuted && audio().setMuted(!cfg.sound); } catch (e) { /* noop */ }
    syncUI();
  }
  function toggleSound() { setSound(!cfg.sound); if (cfg.sound) sfx('select'); }

  function toggleLang() {
    RR.toggleLang();
    syncUI();
    updateRecordUI();
    if (S.mode === 'over') {
      const rs = $('reasonOver');
      if (rs) rs.textContent = RR.t('reasonLine') + ': ' + RR.t(reasonKey(S.deathReason));
      const overTitle = $('overTitle');
      if (overTitle) overTitle.textContent = RR.t('gameOver');
      const acc = $('accuracyOver');
      if (acc) {
        const pct = S.shotsFired ? Math.round((S.shotsHit / S.shotsFired) * 100) : 0;
        acc.textContent = RR.t('shots') + ' ' + S.shotsFired + ' · ' + RR.t('hits') + ' ' + S.shotsHit + ' · ' + RR.t('accuracy') + ' ' + pct + '%';
      }
    }
    sfx('select');
  }

  function togglePause() {
    if (S.mode !== 'play') return;
    S.paused = !S.paused;
    setOverlay(S.paused ? 'pause' : null);
    audioPause(S.paused);
    if (S.paused) sfx('pause');
  }

  function menuItems() { return Array.from(document.querySelectorAll('#menuList .m-item')); }

  function highlightMenu(index) {
    const items = menuItems();
    if (!items.length) return;
    S.menuIndex = (index + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('is-active', i === S.menuIndex));
  }

  function activateMenu() {
    const items = menuItems();
    const el = items[S.menuIndex];
    if (!el) return;
    const action = el.dataset.action;
    const kind = el.dataset.kind;
    if (kind === 'toggle') {
      if (action === 'graphics') toggleGfx();
      else if (action === 'sound') toggleSound();
      else if (action === 'lang') toggleLang();
      return;
    }
    sfx('select');
    if (action === 'play') startGame();
    else if (action === 'howto') { setOverlay('help'); }
  }

  function openHelp() { setOverlay('help'); syncUI(); }
  function closeHelp() { setOverlay('menu'); }

  function bindUi() {
    document.addEventListener('click', (ev) => {
      unlockAudio();
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'play') { sfx('select'); startGame(); }
      else if (action === 'howto') { sfx('select'); openHelp(); }
      else if (action === 'back') { sfx('select'); closeHelp(); }
      else if (action === 'resume') { sfx('select'); togglePause(); }
      else if (action === 'restart') { sfx('select'); startGame(); }
      else if (action === 'menu') { sfx('select'); toMenu(); }
      else if (action === 'graphics') { toggleGfx(); syncUI(); }
      else if (action === 'sound') { toggleSound(); }
      else if (action === 'lang') { toggleLang(); }
      else if (action === 'fullscreen') { toggleFullscreen(); }
    });
    document.querySelectorAll('#menuList .m-item').forEach((el, i) => {
      el.addEventListener('mouseenter', () => highlightMenu(i));
      el.addEventListener('focus', () => highlightMenu(i));
    });
    // экранные кнопки для тача
    document.querySelectorAll('[data-key]').forEach((el) => {
      const key = el.dataset.key;
      const down = (ev) => {
        ev.preventDefault();
        unlockAudio();
        if (key === 'pause') { togglePause(); return; }
        keys[key] = true;
        el.classList.add('is-down');
      };
      const up = (ev) => {
        ev.preventDefault();
        keys[key] = false;
        el.classList.remove('is-down');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      // клавиатура: Enter/пробел на сфокусированной экранной кнопке
      el.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
        if (key === 'pause' && ev.repeat) { ev.preventDefault(); return; }
        down(ev);
      });
      el.addEventListener('keyup', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
        up(ev);
      });
      el.addEventListener('click', (ev) => {
        if (key === 'pause' && ev.detail === 0) ev.preventDefault(); // клавиатурный клик обслужен keydown
      });
    });
    document.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => { unlockAudio(); });
    });
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement) {
        (document.getElementById('stage') || el).requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    } catch (e) { /* noop */ }
  }

  /* ====================== ввод ====================== */
  function onKeyDown(e) {
    const k = e.key;
    unlockAudio();

    // Кнопки внутри оверлеев и экранного пульта обрабатывают Enter/пробел
    // сами (нативный click / keydown-обработчик) — глобальной логике туда не надо.
    // Фокус, оставшийся на кнопках шапки после мыши, снимаем, чтобы Enter/пробел
    // не дёргали настройки вместо игры.
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.tagName === 'BUTTON') {
      const inOverlay = !!ae.closest('.overlay');
      const isPad = ae.hasAttribute('data-key');
      if ((inOverlay || isPad) && (k === 'Enter' || k === ' ' || k === 'Spacebar')) return;
      if (k === 'Enter' || k === ' ' || k === 'Spacebar' || k.startsWith('Arrow')) {
        ae.blur();
        if (k === ' ' || k === 'Spacebar') e.preventDefault();
      }
    }

    // В инструкции Enter/Escape/пробел — «назад», а не запуск игры;
    // быстрые настройки (G/L/M) должны работать и здесь.
    if (document.body.dataset.state === 'help') {
      if (k === 'Escape' || k === 'Enter' || k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        closeHelp();
        return;
      }
      if (k === 'g' || k === 'G' || k === 'п' || k === 'П') { toggleGfx(); return; }
      if (k === 'l' || k === 'L' || k === 'д' || k === 'Д') { toggleLang(); return; }
      if (k === 'm' || k === 'M' || k === 'ь' || k === 'Ь') { toggleSound(); return; }
      return;
    }

    if (k === 'Escape' && S.mode === 'menu') { return; }

    if (S.mode === 'menu') {
      if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); highlightMenu(S.menuIndex + 1); sfx('select'); return; }
      if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); highlightMenu(S.menuIndex - 1); sfx('select'); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        const el = menuItems()[S.menuIndex];
        if (el && el.dataset.kind === 'toggle') { e.preventDefault(); activateMenu(); }
        return;
      }
      if (k === 'Enter' || k === ' ') { e.preventDefault(); activateMenu(); return; }
    } else if (S.mode === 'over') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); startGame(); return; }
      if (k === 'Escape') { e.preventDefault(); toMenu(); return; }
      if (k === 'r' || k === 'R' || k === 'к' || k === 'К') { e.preventDefault(); startGame(); return; }
    } else if (S.mode === 'play' && S.paused) {
      if (k === 'Enter' || k === 'Escape' || k === 'p' || k === 'P' || k === 'з' || k === 'З') { e.preventDefault(); togglePause(); return; }
      if (k === 'r' || k === 'R' || k === 'к' || k === 'К') { e.preventDefault(); startGame(); return; }
    } else if (S.mode === 'play') {
      if (k === 'Enter') { togglePause(); return; }
    }

    switch (k) {
      case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф': keys.left = true; e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': case 'в': case 'В': keys.right = true; e.preventDefault(); break;
      case 'ArrowUp': case 'w': case 'W': case 'ц': case 'Ц': keys.up = true; e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы': keys.down = true; e.preventDefault(); break;
      case ' ': case 'Spacebar': keys.fire = true; e.preventDefault(); break;
      default: break;
    }
    if (k === 'p' || k === 'P' || k === 'Escape' || k === 'з' || k === 'З') { e.preventDefault(); togglePause(); }
    else if (k === 'm' || k === 'M' || k === 'ь' || k === 'Ь') toggleSound();
    else if (k === 'l' || k === 'L' || k === 'д' || k === 'Д') toggleLang();
    else if (k === 'g' || k === 'G' || k === 'п' || k === 'П') toggleGfx();
    else if (k === 'f' || k === 'F' || k === 'а' || k === 'А') toggleFullscreen();
  }

  function onKeyUp(e) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф': keys.left = false; break;
      case 'ArrowRight': case 'd': case 'D': case 'в': case 'В': keys.right = false; break;
      case 'ArrowUp': case 'w': case 'W': case 'ц': case 'Ц': keys.up = false; break;
      case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы': keys.down = false; break;
      case ' ': case 'Spacebar': keys.fire = false; break;
      default: break;
    }
  }

  /* ====================== отрисовка и цикл ====================== */
  const cv = $('game');
  const ctx = cv ? cv.getContext('2d', { alpha: false }) : null;

  function fit() {
    if (!cv) return;
    const baseRatio = window.devicePixelRatio || 1;
    const dpr = S.gfx === 'modern' ? (baseRatio >= 2 ? 2 : 1.5) : 1;
    view.dpr = dpr;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.imageRendering = S.gfx === 'retro' ? 'pixelated' : 'auto';
  }

  function drawFrame() {
    if (!ctx || !RR.Render) return;
    const dpr = view.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = S.gfx !== 'retro';
    RR.Render.draw(ctx, S, view);
  }

  let last = 0;
  function frame(ts) {
    const now = ts / 1000;
    const dt = last ? Math.min(0.05, now - last) : 1 / 60;
    last = now;
    try {
      update(dt);
      drawFrame();
    } catch (err) {
      S.errors.push(String(err && err.stack ? err.stack : err));
      console.error(err);
    }
    requestAnimationFrame(frame);
  }

  /* ====================== загрузка ====================== */
  function boot() {
    window.addEventListener('error', (ev) => { S.errors.push(String(ev.message || ev.error)); });
    window.addEventListener('unhandledrejection', (ev) => { S.errors.push('promise: ' + String(ev.reason)); });

    if (!ctx) return;
    document.documentElement.dataset.gfx = S.gfx;
    document.documentElement.dataset.lang = RR.getLang();
    fit();
    resetWorld();
    S.mode = 'menu';
    setOverlay('menu');
    RR.applyI18n();
    syncUI();
    highlightMenu(0);
    bindUi();
    updateRecordUI();
    setGfx(S.gfx); // синхронизирует dataset/размеры/подписи

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', fit);
    window.addEventListener('blur', () => { keys.left = keys.right = keys.up = keys.down = keys.fire = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && S.mode === 'play' && !S.paused) {
        S.paused = true;
        setOverlay('pause');
        audioPause(true);
      }
    });
    RR.onLang((l) => { cfg.lang = l; applyStartHint(); });
    if (isTouchDevice()) document.body.classList.add('is-touch');
    requestAnimationFrame(frame);
  }

  /* ====================== тестовые хуки ====================== */
  RR.test = {
    startGame,
    toMenu,
    update,
    step(seconds) {
      const step = 1 / 60;
      let left = Math.max(0, Number(seconds) || 0);
      while (left > 0) { update(Math.min(step, left)); left -= step; }
      drawFrame();
      return RR.test.state();
    },
    state() {
      return {
        mode: S.mode, paused: S.paused, score: S.score, level: S.level, lives: S.lives,
        fuel: Math.round(S.fuel * 10) / 10, camY: Math.round(S.camY), planeX: Math.round(S.planeX),
        speed: Math.round(S.speed), gfx: S.gfx, lang: RR.getLang(), sound: cfg.sound,
        bridge: S.bridge ? { y: Math.round(S.bridge.y), hp: S.bridge.hp, alive: S.bridge.alive, ahead: Math.round(S.bridge.y - S.camY) } : null,
        enemies: S.enemies.filter((e) => !e.dead).length,
        bullets: S.bullets.length,
        particles: S.particles.length,
        depots: S.depots.length,
        islands: S.islands.length,
        errors: S.errors.slice(-5),
      };
    },
    setFuel(v) { S.fuel = clamp(Number(v) || 0, 0, 100); return S.fuel; },
    setPlaneX(v) { S.planeX = clamp(Number(v) || 0, 8, W - 8); return S.planeX; },
    setCamY(v) { S.camY = Number(v) || S.camY; return S.camY; },
    nearBridge(gap = 420) { if (S.bridge) S.camY = S.bridge.y - gap; return RR.test.state(); },
    bridgeHits(n = 1) { for (let i = 0; i < n; i++) damageBridge(); return RR.test.state(); },
    setPaused(p) { S.paused = !!p; setOverlay(S.paused ? 'pause' : null); return S.paused; },
    setGfx, toggleGfx, toggleLang, toggleSound,
    forceGameOver() { S.lives = 0; S.fuel = 0; S.mode = 'play'; die('fuel'); S.dyingT = 0; update(1 / 60); gameOver(); return RR.test.state(); },
    drawFrame,
    spawnEnemyAt(type, y, x) {
      if (type === 'jet') {
        S.enemies.push({ type, x: x ?? W / 2, y, vx: 90, w: 22, h: 12, dead: false, t: 0 });
      } else {
        S.enemies.push({ type, x: x ?? W / 2, y, vx: 40, w: 18, h: 10, dead: false, t: 0 });
      }
    },
    /** Прокрутить игру, удерживая клавишу (для проверки полёта/стрельбы). */
    hold(key, on = true) { keys[key] = !!on; },
    setInvuln(sec) { S.invuln = Math.max(0, Number(sec) || 0); return S.invuln; },
    clearEnemies() { S.enemies = []; S.gen.enemyY = S.camY + 700; return 0; },
    setX(x) { S.planeX = clamp(Number(x), 8, W - 8); return S.planeX; },
    refuel() { S.fuel = S.maxFuel; return S.fuel; },
    /** Промотать реку до места, где впереди нет островов — для скриншотов. */
    seekClear() {
      for (let k = 0; k < 140; k++) {
        const r = riverAt(S.camY);
        const bad = S.islands.some((is) => is.y > S.camY - 30 && is.y < S.camY + 430 && Math.abs(is.x - r.c) < is.rx + 34);
        if (!bad) break;
        S.camY += 70;
        ensureWorld();
      }
      S.planeX = riverAt(S.camY).c;
      S.planeVX = 0;
      S.invuln = Math.max(S.invuln, 20);
      return { camY: Math.round(S.camY), planeX: Math.round(S.planeX) };
    },
    async withTime(seconds, fn) { return fn(RR.test.step(seconds)); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.RR);
