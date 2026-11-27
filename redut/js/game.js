/* РЕДУТ · логика (без DOM, детерминирована при заданном rng). REDUT.Game(opts), REDUT.logic
   Оборона маяка: ночь, из темноты по краям поля ползёт мгла и тянется к Горну-маяку в центре. Смотритель (игрок) ходит свободно
   (стик), а между маяком и им натянут ЛУЧ — луч жжёт всё, чего касается. Кнопка A ставит опору: луч ломается в угол и остаётся
   оградой (до MAXP опор, общая длина ограничена LMAX); повторное A у последней опоры снимает её. Кнопка B — вспышка (круг вокруг
   Смотрителя), заряд копится за убитую мглу. Мгла пяти видов: ползун, панцирник (3 ожога), прыгун (перепрыгивает луч), гаситель
   (луч его не берёт — глотает опоры, лечится вспышкой), Пожиратель Света (босс 6-й волны). Бонусов-значков нет: между волнами
   маяк чинится, а Смотритель получает улучшение (длина луча, опора, ширина, вспышка).
   Координаты: x 0..W, y 0..AH (поле под HUD; рисует render/ui со сдвигом HUD). Маяк — (CX, CY). */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};

  var W = 480, HUD = 44, SCREEN_H = 640, AH = SCREEN_H - HUD, CX = W / 2, CY = AH / 2, CORE_R = 22;
  var K = { LIVES: 4, CORE_HP: 6, LMAX: 250, MAXP: 3, PYL_HP: 3, PR: 9, SPEED: 150, BEAM: 11, HITPAD: 4, FLARE_R: 85, CHARGE_MAX: 100, REGEN: 1.2,
    PICK: 30, MIN_GAP: 36, TAIL: 24, TICK: 0.3, TRAIL: 0.45, HALO: 92, HALO_K: 0.5, TELE: 0.7, COMBO_T: 1.5 };
  var TYPES = {
    crawl: { r: 8, hp: 1, sp: 40, pts: 100, ch: 8 },
    armor: { r: 11, hp: 2, sp: 26, pts: 250, ch: 16 },
    leap: { r: 7, hp: 1, sp: 46, pts: 200, ch: 12 },
    snuff: { r: 10, hp: 2, sp: 50, pts: 400, ch: 30, immune: true },
    eater: { r: 34, hp: 24, sp: 11, pts: 5000, ch: 0, boss: true }
  };
  // Волны: n — [ползунов, панцирников, прыгунов, гасителей], t — окно выхода (с), e — веса краёв [верх, право, низ, лево]
  var WAVES = [
    { n: [9, 0, 0, 0], t: 34, e: [1, 0, 0, 0] },
    { n: [12, 3, 0, 0], t: 40, e: [3, 1, 0, 1] },
    { n: [12, 4, 5, 0], t: 44, e: [2, 1, 1, 1] },
    { n: [13, 4, 5, 2], t: 48, e: [1, 1, 1, 1] },
    { n: [14, 5, 6, 3], t: 52, e: [1, 1, 1, 1] },
    { n: [8, 3, 3, 2], t: 46, e: [1, 1, 1, 1], boss: true }
  ];
  var UPG = ['len', 'pyl', 'beam', 'flare', 'len'];   // улучшение после волны i (1…5)

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return dist(px, py, ax + dx * t, ay + dy * t);
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(1), emit = opts.onEvent || function () {}, maxWave = opts.maxWave || WAVES.length;
    var S = { W: W, AH: AH, HUD: HUD, cx: CX, cy: CY, coreR: CORE_R, time: 0, phase: 'intro', wave: opts.wave || 1, maxWave: maxWave, waveT: 0, introT: 2.4, clearT: 0, hold: false,
      score: 0, kills: 0, coreHp: K.CORE_HP, coreMax: K.CORE_HP, coreFlash: 0, lives: K.LIVES, lmax: K.LMAX, maxP: K.MAXP, beamR: K.BEAM, flareR: K.FLARE_R, chargeK: 1,
      charge: 0, flareT: 0, flareR0: 0, combo: 0, comboT: 0, mult: 1, boosts: 0, revived: false, over: null, won: false,
      pylons: [], trail: [], enemies: [], queue: [], marks: [], hero: null, hint: null, upg: [], bonus: 0, over_reason: null };
    var dirx = 0, diry = 0, hints = { move: !!opts.noHints, sweep: !!opts.noHints, pylon: !!opts.noHints, flare: !!opts.noHints }, moved = 0;

    function hero() { return S.hero; }
    function newHero() { return { x: CX, y: CY + CORE_R + 46, alive: true, inv: 0, rs: 0, face: -Math.PI / 2, moving: false }; }
    function setHint(k, t) { if (hints[k]) return; hints[k] = true; S.hint = { k: k, t: t || 7 }; }
    function fixedPts() { var a = [{ x: CX, y: CY }]; for (var i = 0; i < S.pylons.length; i++) a.push(S.pylons[i]); return a; }
    function fixedLen() { var a = fixedPts(), s = 0; for (var i = 1; i < a.length; i++) s += dist(a[i - 1].x, a[i - 1].y, a[i].x, a[i].y); return s; }
    function chainPts() { var a = fixedPts(); if (S.hero && S.hero.alive) a.push(S.hero); return a; }
    function segments() {   // активные отрезки луча: отрезок гаснет, если его опору глотает гаситель (dim)
      var a = chainPts(), out = [];
      for (var i = 1; i < a.length; i++) {
        var p = a[i - 1], q = a[i];
        if ((p.dim > 0) || (q.dim > 0)) continue;
        out.push([p.x, p.y, q.x, q.y]);
      }
      return out;
    }

    // ---------- Волны ----------
    function buildWave(n) {
      var w = WAVES[Math.min(n, WAVES.length) - 1], types = [], i, k;
      ['crawl', 'armor', 'leap', 'snuff'].forEach(function (t, ti) { for (k = 0; k < w.n[ti]; k++) types.push(t); });
      var extra = Math.max(0, n - WAVES.length); for (k = 0; k < extra * 4; k++) types.push('crawl');
      for (i = types.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), tmp = types[i]; types[i] = types[j]; types[j] = tmp; }
      var q = [], T = w.t, tot = w.e[0] + w.e[1] + w.e[2] + w.e[3];
      for (i = 0; i < types.length; i++) {
        var at = 1.5 + (T - 1.5) * (i + rng() * 0.7) / types.length, r = rng() * tot, e = 0;
        while (e < 3 && r >= w.e[e]) { r -= w.e[e]; e++; }
        var p = edgePt(e); q.push({ at: at, type: types[i], x: p[0], y: p[1], marked: false });
      }
      if (w.boss) { var bp = edgePt(0); bp[0] = CX; q.push({ at: 2, type: 'eater', x: bp[0], y: bp[1] - 20, marked: false }); }
      q.sort(function (a, b) { return a.at - b.at; });
      return q;
    }
    function edgePt(e) {
      if (e === 0) return [30 + rng() * (W - 60), -14];
      if (e === 1) return [W + 14, 30 + rng() * (AH - 60)];
      if (e === 2) return [30 + rng() * (W - 60), AH + 14];
      return [-14, 30 + rng() * (AH - 60)];
    }
    function startWave() {
      S.phase = 'intro'; S.introT = 2.4; S.waveT = 0; S.queue = buildWave(S.wave); S.marks = []; S.enemies = [];
      S.hold = false; emit('wave', { wave: S.wave });
    }
    function spawn(q) {
      var d = TYPES[q.type], sc = 1 + 0.045 * (S.wave - 1);
      var e = { id: ++uid, type: q.type, x: q.x, y: q.y, r: d.r, hp: d.hp, max: d.hp, sp: d.sp * (d.boss ? 1 : sc), zap: 0, sway: rng() * 6.28, air: 0, lt: 1.2 + rng() * 1.2, hit: 0, eat: 0, spawnT: 0, tgt: null, sp0: 0 };
      if (d.boss) { S.boss = e; emit('bossSpawn', { x: e.x, y: e.y }); }
      S.enemies.push(e); emit('spawn', { type: q.type, x: q.x, y: q.y });
    }
    var uid = 0;

    // ---------- Игрок ----------
    function hurt(src) {
      var h = S.hero; if (!h.alive || h.inv > 0 || S.phase === 'over') return;
      S.lives--; h.alive = false; h.rs = 1.1; S.combo = 0; S.mult = 1;
      emit('hurt', { x: h.x, y: h.y, src: src });
      if (S.lives <= 0) endGame('lives');
    }
    function respawn() { var h = S.hero; h.x = CX; h.y = CY + CORE_R + 46; h.alive = true; h.inv = 2.2; emit('respawn', { x: h.x, y: h.y }); }
    function coreHit(dmg, x, y) {
      if (S.phase === 'over') return;
      S.coreHp = Math.max(0, S.coreHp - dmg); S.coreFlash = 0.5; S.combo = 0; S.mult = 1; emit('coreHit', { x: x, y: y, dmg: dmg, hp: S.coreHp });
      if (S.coreHp <= 0) endGame('core');
    }
    function endGame(why) { S.phase = 'over'; S.over = why; emit('gameover', { why: why }); }

    function movePlayer(dt) {
      var h = S.hero;
      if (h.inv > 0) h.inv -= dt;
      if (!h.alive) { h.rs -= dt; if (h.rs <= 0 && S.phase !== 'over') respawn(); return; }
      var dx = dirx, dy = diry, l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      h.moving = l > 0.05;
      if (h.moving) { h.face = Math.atan2(dy, dx); moved += l * K.SPEED * dt; }
      h.x += dx * K.SPEED * dt; h.y += dy * K.SPEED * dt;
      h.x = clamp(h.x, 12, W - 12); h.y = clamp(h.y, 12, AH - 12);
      var cd = dist(h.x, h.y, CX, CY), minR = CORE_R + K.PR + 2;
      if (cd < minR) { var k = minR / (cd || 1); h.x = CX + (h.x - CX) * k; h.y = CY + (h.y - CY) * k; if (cd < 0.01) h.y = CY + minR; }
      // длина луча: от последней опоры не дальше остатка троса
      var a = fixedPts(), last = a[a.length - 1], rem = S.lmax - fixedLen(), d = dist(h.x, h.y, last.x, last.y);
      if (d > rem) { var f = rem / d; h.x = last.x + (h.x - last.x) * f; h.y = last.y + (h.y - last.y) * f; }
    }
    function place() {
      var h = S.hero; if (S.phase === 'over' || S.phase === 'won' || !h.alive) return false;
      var a = fixedPts(), last = a[a.length - 1];
      if (S.pylons.length && dist(h.x, h.y, last.x, last.y) <= K.PICK) { var p = S.pylons.pop(); emit('unpylon', { x: p.x, y: p.y }); return true; }
      if (S.pylons.length >= S.maxP) { emit('noPlace', { why: 'max' }); return false; }
      var d = dist(h.x, h.y, last.x, last.y), minGap = S.pylons.length ? K.MIN_GAP : CORE_R + K.PR + 16;
      if (d < minGap) { emit('noPlace', { why: 'near' }); return false; }
      if (fixedLen() + d > S.lmax - K.TAIL) { emit('noPlace', { why: 'len' }); return false; }
      S.pylons.push({ x: h.x, y: h.y, hp: K.PYL_HP, max: K.PYL_HP, dim: 0, flash: 0 }); hints.pylon = true; if (S.hint && S.hint.k === 'pylon') S.hint = null;
      emit('pylon', { x: h.x, y: h.y, n: S.pylons.length }); return true;
    }
    function flare() {
      var h = S.hero; if (S.phase === 'over' || S.phase === 'won' || !h.alive || S.charge < K.CHARGE_MAX) return false;
      S.charge = 0; S.flareT = 0.45; S.flareR0 = S.flareR; hints.flare = true; if (S.hint && S.hint.k === 'flare') S.hint = null;
      var i, e;
      for (i = S.enemies.length - 1; i >= 0; i--) {
        e = S.enemies[i]; var d = dist(e.x, e.y, h.x, h.y);
        if (d > S.flareR + e.r) continue;
        if (e.type === 'eater') { damage(e, 4, 'flare'); e.x += (e.x - h.x) / (d || 1) * 10; e.y += (e.y - h.y) / (d || 1) * 10; }
        else if (e.type === 'armor') { damage(e, 2, 'flare'); e.x += (e.x - h.x) / (d || 1) * 30; e.y += (e.y - h.y) / (d || 1) * 30; }
        else damage(e, 9, 'flare');
      }
      for (i = 0; i < S.pylons.length; i++) if (dist(S.pylons[i].x, S.pylons[i].y, h.x, h.y) <= S.flareR) { S.pylons[i].hp = Math.min(S.pylons[i].max, S.pylons[i].hp + 1.5); S.pylons[i].dim = 0; }
      emit('flare', { x: h.x, y: h.y, r: S.flareR }); return true;
    }

    // ---------- Враги ----------
    function damage(e, n, src) {
      if (e.hp <= 0) return;
      e.hp -= n; e.hit = 0.15;
      if (e.hp > 0) { emit(e.type === 'eater' ? 'bossHit' : 'zap', { x: e.x, y: e.y, type: e.type, src: src }); return; }
      var d = TYPES[e.type];
      S.combo = S.comboT > 0 ? S.combo + 1 : 1; S.comboT = K.COMBO_T; S.mult = Math.min(4, 1 + Math.floor((S.combo - 1) / 2));
      var pts = d.pts * S.mult; S.score += pts; S.kills++;
      S.charge = Math.min(K.CHARGE_MAX, S.charge + d.ch * S.chargeK); if (S.charge >= K.CHARGE_MAX && !hints.flare) setHint('flare', 8);
      if (!hints.sweep) { hints.sweep = true; if (S.hint && S.hint.k === 'sweep') S.hint = null; if (!hints.pylon) setHint('pylon', 10); }
      emit(e.type === 'eater' ? 'bossDie' : 'kill', { x: e.x, y: e.y, type: e.type, pts: pts, src: src, mult: S.mult });
    }
    function updateEnemies(dt) {
      var i, j, e, h = S.hero;
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i]; var d = TYPES[e.type]; e.hit = Math.max(0, e.hit - dt); e.zap = Math.max(0, e.zap - dt); e.sway += dt * 3;
        var tx = CX, ty = CY, speed = e.sp, dd;
        if (e.type === 'snuff' || e.type === 'eater') {
          var best = null, bd = 1e9;
          for (j = 0; j < S.pylons.length; j++) { var p = S.pylons[j]; dd = dist(e.x, e.y, p.x, p.y); if (e.type === 'eater' ? dd < 150 : true) if (dd < bd) { bd = dd; best = p; } }
          if (best && e.type === 'snuff') { tx = best.x; ty = best.y; }
        }
        var ex = tx - e.x, ey = ty - e.y, el = Math.hypot(ex, ey) || 1, ux = ex / el, uy = ey / el;
        if (e.type === 'leap') {
          if (e.air > 0) { e.air -= dt; speed = 250; if (e.air <= 0) e.lt = 1.0 + rng() * 1.0; }
          else { e.lt -= dt; speed = e.sp * 0.8; if (e.lt <= 0 && dist(e.x, e.y, CX, CY) > 110) { e.air = 0.5; emit('leap', { x: e.x, y: e.y }); } }
        }
        if (e.air <= 0 && el < K.HALO) speed *= K.HALO_K;   // свет маяка замедляет мглу
        var sw = e.type === 'crawl' ? Math.sin(e.sway) * 0.35 : 0, nx = ux - uy * sw, ny = uy + ux * sw, nl = Math.hypot(nx, ny) || 1;
        e.x += nx / nl * speed * dt; e.y += ny / nl * speed * dt; e.dx = nx / nl; e.dy = ny / nl;
        // гаситель и босс глотают опоры
        e.eat = 0;
        for (j = 0; j < S.pylons.length; j++) {
          var py = S.pylons[j], reach = e.type === 'eater' ? e.r + 26 : e.r + 14;
          if ((e.type === 'snuff' || e.type === 'eater') && dist(e.x, e.y, py.x, py.y) < reach) { py.hp -= dt * (e.type === 'eater' ? 1.3 : 0.9); py.dim = 0.25; py.flash = 0.2; e.eat = 1; }
        }
        // до маяка
        if (dist(e.x, e.y, CX, CY) <= CORE_R + e.r * (e.type === 'eater' ? 0.6 : 0.8)) {
          if (e.type === 'eater') { coreHit(99, e.x, e.y); } else { coreHit(1, e.x, e.y); e.hp = 0; e.gone = true; emit('splat', { x: e.x, y: e.y, type: e.type }); }
          continue;
        }
        // Смотритель
        if (h.alive && h.inv <= 0 && e.air <= 0 && dist(e.x, e.y, h.x, h.y) < e.r + K.PR - K.HITPAD) hurt(e.type);
      }
      // разделение, чтобы не слипались
      for (i = 0; i < S.enemies.length; i++) for (j = i + 1; j < S.enemies.length; j++) {
        var a = S.enemies[i], b = S.enemies[j]; if (a.air > 0 || b.air > 0 || a.type === 'eater' || b.type === 'eater') continue;
        var ax = b.x - a.x, ay = b.y - a.y, ad = Math.hypot(ax, ay), mn = (a.r + b.r) * 0.85;
        if (ad > 0 && ad < mn) { var pu = (mn - ad) / 2 / ad; a.x -= ax * pu; a.y -= ay * pu; b.x += ax * pu; b.y += ay * pu; }
      }
      // опоры: смерть, гашение
      for (i = S.pylons.length - 1; i >= 0; i--) {
        var q = S.pylons[i]; q.dim = Math.max(0, q.dim - dt); q.flash = Math.max(0, q.flash - dt);
        if (q.hp <= 0) { S.pylons.splice(i, 1); emit('pylonDie', { x: q.x, y: q.y }); }
      }
    }
    function beams(dt) {
      var segs = segments(), i, j, e, tick = K.TICK, tr = S.trail;
      // шлейф: луч, прошедший по полю за последние TRAIL секунд, ещё жжёт (след-«развёртка»)
      if (segs.length && (!tr.length || S.time - tr[tr.length - 1].t >= 0.08)) tr.push({ t: S.time, segs: segs });
      while (tr.length && S.time - tr[0].t > K.TRAIL) tr.shift();
      var all = segs.slice(); for (i = 0; i < tr.length; i++) for (j = 0; j < tr[i].segs.length; j++) all.push(tr[i].segs[j]);
      segs = all;
      if (!segs.length) return;
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i]; var d = TYPES[e.type]; if (e.hp <= 0 || d.immune || e.air > 0 || e.zap > 0) continue;
        for (j = 0; j < segs.length; j++) {
          var s = segs[j];
          if (segDist(e.x, e.y, s[0], s[1], s[2], s[3]) <= e.r + S.beamR) {
            e.zap = e.type === 'eater' ? 0.5 : tick; damage(e, 1, 'beam');
            if (e.hp > 0 && e.type === 'armor') { var kx = e.x - S.hero.x, ky = e.y - S.hero.y, kl = Math.hypot(kx, ky) || 1; e.x += kx / kl * 12; e.y += ky / kl * 12; }   // луч отбрасывает панцирника от Смотрителя
            break;
          }
        }
      }
    }

    // ---------- Шаг ----------
    function update(dt) {
      if (S.phase === 'over' || S.phase === 'won') return;
      dt = Math.min(dt, 0.05); S.time += dt;
      if (S.coreFlash > 0) S.coreFlash -= dt; if (S.flareT > 0) S.flareT -= dt;
      if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) { S.combo = 0; S.mult = 1; } }
      if (S.hint) { S.hint.t -= dt; if (S.hint.t <= 0) S.hint = null; }
      movePlayer(dt);
      if (!hints.move && moved > 60) { hints.move = true; if (S.hint && S.hint.k === 'move') S.hint = null; if (!hints.sweep && S.wave === 1) setHint('sweep', 9); }
      if (S.phase === 'intro') { S.introT -= dt; if (S.introT <= 0) { S.phase = 'play'; } if (S.wave === 1 && !hints.move && !S.hint) { S.hint = { k: 'move', t: 8 }; } return; }
      if (S.phase === 'clear') { if (!S.hold) S.clearT -= dt; if (S.clearT <= 0) { if (S.wave >= S.maxWave) { S.phase = 'won'; S.won = true; emit('win', {}); } else { S.wave++; startWave(); } } return; }
      S.waveT += dt;
      S.charge = Math.min(K.CHARGE_MAX, S.charge + K.REGEN * S.chargeK * dt);
      if (S.charge >= K.CHARGE_MAX && !hints.flare && S.wave >= 2) setHint('flare', 8);
      // выход мглы: сперва метка на краю, потом сама
      for (var i = 0; i < S.queue.length; i++) { var q = S.queue[i]; if (!q.marked && q.at - K.TELE <= S.waveT) { q.marked = true; S.marks.push({ x: clamp(q.x, 10, W - 10), y: clamp(q.y, 10, AH - 10), t: K.TELE, type: q.type }); } }
      while (S.queue.length && S.queue[0].at <= S.waveT) spawn(S.queue.shift());
      for (i = S.marks.length - 1; i >= 0; i--) { S.marks[i].t -= dt; if (S.marks[i].t <= 0) S.marks.splice(i, 1); }
      updateEnemies(dt); beams(dt);
      if (S.boss && S.boss.hp > 0) {   // босс рожает ползунов
        var b = S.boss; b.lt -= dt; if (b.hp < b.max / 2) b.sp = 17;
        if (b.lt <= 0) { b.lt = 3.6; for (var k = 0; k < 2; k++) { var c = { type: 'crawl', x: b.x + (k ? 20 : -20), y: b.y + 20 }; spawn(c); } emit('bossSpawnKids', { x: b.x, y: b.y }); }
      }
      S.enemies = S.enemies.filter(function (e) { if (e.hp <= 0) { if (e === S.boss) S.boss = null; return false; } return true; });
      if (S.phase === 'play' && !S.queue.length && !S.enemies.length) waveClear();
    }
    function waveClear() {
      var n = S.wave, bonus = 500 * n + 200 * S.coreHp; S.score += bonus; S.bonus = bonus;
      S.phase = 'clear'; S.clearT = 3.2; S.upg = [];
      if (n < S.maxWave) {
        var u = UPG[(n - 1) % UPG.length]; S.upg.push(u);
        if (u === 'len') S.lmax += 40; else if (u === 'pyl') S.maxP++; else if (u === 'beam') S.beamR += 2; else if (u === 'flare') { S.flareR += 20; S.chargeK = 1.3; }
        S.coreHp = Math.min(S.coreMax, S.coreHp + 2);
        if ((n === 3 || n === 5) && S.lives < 5) { S.lives++; S.upg.push('life'); }
      }
      S.charge = Math.min(K.CHARGE_MAX, S.charge + 30);
      emit('clear', { wave: n, bonus: bonus, upg: S.upg.slice() });
    }

    var api = {
      start: function () { S.hero = newHero(); startWave(); return api; },
      update: update, state: function () { return S; }, _S: S,
      setDir: function (x, y) { dirx = x; diry = y; }, place: place, flare: flare,
      canBoost: function () { return S.boosts < 2 && S.phase !== 'over' && (S.lives < 4 || S.coreHp < S.coreMax); },
      boost: function () { S.boosts++; S.lives = Math.min(5, S.lives + 1); S.coreHp = Math.min(S.coreMax, S.coreHp + 1); emit('boost', {}); },
      reviveAd: function () {   // «ещё один шанс» (раз за партию): 2 жизни, маяк ≥ 3, вспышка вокруг маяка
        if (S.revived || S.phase !== 'over') return false;
        S.revived = true; S.phase = 'play'; S.over = null; S.lives = 2; S.coreHp = Math.max(S.coreHp, 3); S.charge = K.CHARGE_MAX;
        S.hero.alive = false; S.hero.rs = 0.2;
        S.enemies.forEach(function (e) { if (dist(e.x, e.y, CX, CY) < 150 && e.type !== 'eater') e.hp = 0; }); S.enemies = S.enemies.filter(function (e) { return e.hp > 0; });
        S.flareT = 0.45; S.flareR0 = 150; emit('revive', {}); return true;
      },
      _spawn: function (type, x, y) { spawn({ type: type, x: x, y: y }); return S.enemies[S.enemies.length - 1]; }
    };
    return api;
  }

  R.Game = Game;
  R.logic = { W: W, HUD: HUD, SCREEN_H: SCREEN_H, AH: AH, CX: CX, CY: CY, CORE_R: CORE_R, K: K, TYPES: TYPES, WAVES: WAVES, UPG: UPG, mulberry32: mulberry32, dist: dist, segDist: segDist };
})(typeof window !== 'undefined' ? window : globalThis);
