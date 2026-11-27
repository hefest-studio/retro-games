/* ШПУЛЬКА · логика (DOM-free). SPOOL.Game / SPOOL.level
   Деревянная катушка-шпулька с красной ниткой летит по раскройному столу с постоянной скоростью. Одна кнопка: ДЕРЖИ — нитка цепляется
   за ближайшую булавку в радиусе, и шпулька кружит вокруг неё (петля понемногу стягивается); ОТПУСТИ — улетаешь по прямой по касательной.
   Собери все пуговицы — откроется игольное ушко (выход). Ножницы, моль и утюги опасны; ржавая булавка ломается, подвижная ходит по рельсу.
   Мир всегда портретный 450×600; в альбоме рендер поворачивает его. Запускается и в браузере, и в node (vm без DOM).
   Состояние S — чистые данные (клонируется JSON-ом: бот просчитывает прогоны вперёд). */
(function (global) {
  'use strict';
  var SP = global.SPOOL = global.SPOOL || {};
  var W = 450, H = 600, MAX_LEVEL = 8;
  var C = { W: W, H: H, MAX_LEVEL: MAX_LEVEL, HERO_R: 7, HIT_R: 6, SPEED: 150, HOOK_R: 120, RMIN: 30, REEL: 14, RUST_T: 1.3, LIVES: 3, START: [225, 530] };
  SP.consts = C;
  // параметры столов: pins — булавок, btn — пуговиц, sc — ножниц, moth — моли, iron — утюгов, rust — ржавых булавок, mov — подвижных, walls — коробок
  var LV = [
    { pins: 5, btn: 5, sc: 0, moth: 0, iron: 0, rust: 0, mov: 0, walls: 0 },
    { pins: 6, btn: 6, sc: 1, moth: 0, iron: 0, rust: 0, mov: 0, walls: 0 },
    { pins: 7, btn: 7, sc: 2, moth: 0, iron: 0, rust: 0, mov: 0, walls: 2 },
    { pins: 7, btn: 7, sc: 1, moth: 1, iron: 0, rust: 2, mov: 0, walls: 1 },
    { pins: 8, btn: 8, sc: 1, moth: 2, iron: 0, rust: 0, mov: 2, walls: 2 },
    { pins: 8, btn: 8, sc: 3, moth: 2, iron: 1, rust: 1, mov: 0, walls: 2 },
    { pins: 9, btn: 9, sc: 3, moth: 2, iron: 1, rust: 1, mov: 2, walls: 3 },
    { pins: 9, btn: 10, sc: 3, moth: 3, iron: 2, rust: 2, mov: 1, walls: 3 }
  ];
  SP.params = LV;

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  // ---------- физика шпульки (общая для игры и генератора) ----------
  function pinXY(p, t) { return p.k === 'm' ? { x: p.bx + Math.sin(t * p.sp + p.ph) * p.amp, y: p.y } : { x: p.x, y: p.y }; }
  function bumpOut(h, cx, cy, R, ev) {   // выталкивание из препятствия с отражением курса; true — было касание
    var dx = h.x - cx, dy = h.y - cy, d = Math.hypot(dx, dy);
    if (d >= R) return false;
    var nx, ny; if (d < 1e-6) { nx = -h.hx; ny = -h.hy; d = 0; } else { nx = dx / d; ny = dy / d; }
    h.x = cx + nx * R; h.y = cy + ny * R;
    var dot = h.hx * nx + h.hy * ny; if (dot < 0) { h.hx -= 2 * dot * nx; h.hy -= 2 * dot * ny; }
    return true;
  }
  // один подшаг героя: S.hero, S.pins, S.walls, S.t, S.hold. emit(type, data) — необязательно
  function heroStep(S, dt, emit) {
    var h = S.hero, i, p, bumped = false;
    for (i = 0; i < S.pins.length; i++) {
      p = S.pins[i]; if (p.cool > 0) p.cool -= dt;
      if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0) { p.dead = 0; p.hang = 0; } }
      if (p.k === 'm') { var q = pinXY(p, S.t); p.x = q.x; }
    }
    if (h.hook && !S.hold) { h.hook = null; if (emit) emit('release', { x: h.x, y: h.y }); }
    if (!h.hook && S.hold) {   // зацепиться за ближайшую свободную булавку
      var best = -1, bd = C.HOOK_R;
      for (i = 0; i < S.pins.length; i++) { p = S.pins[i]; if (p.dead > 0 || p.cool > 0) continue; var d0 = dist(h.x, h.y, p.x, p.y); if (d0 < bd) { bd = d0; best = i; } }
      if (best >= 0) {
        p = S.pins[best]; var cr = h.hx * (p.y - h.y) - h.hy * (p.x - h.x);
        h.hook = { pin: best, dir: cr >= 0 ? 1 : -1, phi: Math.atan2(h.y - p.y, h.x - p.x), r: Math.max(C.RMIN, bd) };
        if (emit) emit('hook', { x: p.x, y: p.y, rust: p.k === 'r' });
      }
    }
    if (h.hook) {
      var hk = h.hook; p = S.pins[hk.pin];
      if (p.dead > 0) { h.hook = null; }
      else {
        hk.phi += hk.dir * (C.SPEED / hk.r) * dt; hk.r = Math.max(C.RMIN, hk.r - C.REEL * dt);
        h.x = p.x + Math.cos(hk.phi) * hk.r; h.y = p.y + Math.sin(hk.phi) * hk.r;
        h.hx = -Math.sin(hk.phi) * hk.dir; h.hy = Math.cos(hk.phi) * hk.dir;
        if (p.k === 'r') { p.hang += dt; if (p.hang >= C.RUST_T) { p.dead = 3; p.cool = 3; p.hang = 0; h.hook = null; if (emit) emit('snap', { x: p.x, y: p.y }); } }
      }
    } else {
      for (i = 0; i < S.pins.length; i++) if (S.pins[i].k === 'r' && S.pins[i].hang > 0 && !(S.hero.hook && S.hero.hook.pin === i)) S.pins[i].hang = Math.max(0, S.pins[i].hang - dt * 0.5);
      h.x += h.hx * C.SPEED * dt; h.y += h.hy * C.SPEED * dt;
    }
    // стены и коробки
    var R = C.HERO_R;
    if (h.x < R) { h.x = R; if (h.hx < 0) h.hx = -h.hx; bumped = true; }
    if (h.x > W - R) { h.x = W - R; if (h.hx > 0) h.hx = -h.hx; bumped = true; }
    if (h.y < R) { h.y = R; if (h.hy < 0) h.hy = -h.hy; bumped = true; }
    if (h.y > H - R) { h.y = H - R; if (h.hy > 0) h.hy = -h.hy; bumped = true; }
    for (i = 0; i < S.walls.length; i++) {
      var w = S.walls[i], cx = Math.max(w.x, Math.min(w.x + w.w, h.x)), cy = Math.max(w.y, Math.min(w.y + w.h, h.y));
      if (bumpOut(h, cx, cy, R)) bumped = true;
    }
    if (bumped) {
      if (h.hook) { S.pins[h.hook.pin].cool = 0.35; h.hook = null; }
      var l = Math.hypot(h.hx, h.hy) || 1; h.hx /= l; h.hy /= l;
      if (emit) emit('bump', { x: h.x, y: h.y });
    }
  }

  // ---------- уровни ----------
  var cache = {};
  function level(i) {
    i = Math.max(0, Math.min(MAX_LEVEL - 1, i | 0)); if (cache[i]) return cache[i];
    var P = LV[i];
    for (var attempt = 0; attempt < 200; attempt++) {
      var rnd = mulberry(9001 + i * 211 + attempt * 31), k, n, x, y, ok;
      var st = { x: C.START[0], y: C.START[1] };
      // коробки
      var walls = [];
      for (n = 0; n < 60 && walls.length < P.walls; n++) {
        var ww = rnd() < 0.5 ? 56 : 28, hh = ww === 56 ? 22 : 56; x = 40 + rnd() * (W - 80 - ww); y = 90 + rnd() * (H - 260 - hh);
        if (walls.every(function (o) { return Math.abs(o.x - x) > 90 || Math.abs(o.y - y) > 90; })) walls.push({ x: Math.round(x), y: Math.round(y), w: ww, h: hh });
      }
      // булавки: на неровной сетке 3×4, не у краёв и не в коробках
      var pins = [], cells = [];
      for (var cy = 0; cy < 4; cy++) for (var cx = 0; cx < 3; cx++) cells.push([cx, cy]);
      for (k = cells.length - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)), t = cells[k]; cells[k] = cells[j]; cells[j] = t; }
      for (k = 0; k < cells.length && pins.length < P.pins; k++) {
        x = 60 + cells[k][0] * 165 + (rnd() - 0.5) * 70; y = 70 + cells[k][1] * 125 + (rnd() - 0.5) * 50;
        if (dist(x, y, st.x, st.y) < 100) continue;
        if (walls.some(function (w) { return x > w.x - 34 && x < w.x + w.w + 34 && y > w.y - 34 && y < w.y + w.h + 34; })) continue;
        if (pins.some(function (o) { return dist(o.x, o.y, x, y) < 80; })) continue;
        pins.push({ x: Math.round(x), y: Math.round(y), bx: Math.round(x), k: 'n', cool: 0, dead: 0, hang: 0, sp: 0, ph: 0, amp: 0 });
      }
      if (pins.length < P.pins) continue;
      var idx = pins.map(function (_, q) { return q; }); for (k = idx.length - 1; k > 0; k--) { var j2 = Math.floor(rnd() * (k + 1)), t2 = idx[k]; idx[k] = idx[j2]; idx[j2] = t2; }
      var ri = 0; for (k = 0; k < P.rust; k++) pins[idx[ri++]].k = 'r';
      for (k = 0; k < P.mov; k++) { var pm = pins[idx[ri++]]; pm.k = 'm'; pm.sp = 0.8 + rnd() * 0.5; pm.ph = rnd() * 6.28; pm.amp = 38 + rnd() * 18; if (pm.bx < 100) pm.bx = 100; if (pm.bx > W - 100) pm.bx = W - 100; pm.x = pm.bx; }
      // пуговицы и ушко: точки пути пробного полёта (достижимость по построению)
      var sim = { t: 0, hold: false, hero: { x: st.x, y: st.y, hx: 0, hy: -1, hook: null }, pins: JSON.parse(JSON.stringify(pins)), walls: walls }, path = [], phase = 0, tl = 0, dt = 1 / 60;
      sim.pins.forEach(function (p) { if (p.k === 'm') { p.k = 'n'; } else if (p.k === 'r') p.k = 'n'; });   // в пробе булавки не ломаются и стоят
      while (sim.t < 110) {
        if (tl <= 0) { phase ^= 1; sim.hold = !!phase; tl = phase ? 0.4 + rnd() * 1.5 : 0.15 + rnd() * 0.8; }
        tl -= dt; sim.t += dt; heroStep(sim, dt);
        if (Math.round(sim.t * 60) % 6 === 0) path.push([sim.hero.x, sim.hero.y, sim.t]);
      }
      var btns = [], minD = 78;
      for (k = 0; k < path.length && btns.length < P.btn + 1; k++) {
        var pt = path[k]; if (pt[2] < 1.2) continue;
        if (pt[0] < 26 || pt[0] > W - 26 || pt[1] < 26 || pt[1] > H - 26) continue;
        if (dist(pt[0], pt[1], st.x, st.y) < 70) continue;
        if (walls.some(function (w) { return pt[0] > w.x - 20 && pt[0] < w.x + w.w + 20 && pt[1] > w.y - 20 && pt[1] < w.y + w.h + 20; })) continue;
        if (pins.some(function (p) { return dist(p.x, p.y, pt[0], pt[1]) < 26; })) continue;
        if (btns.some(function (b) { return dist(b[0], b[1], pt[0], pt[1]) < minD; })) continue;
        btns.push([Math.round(pt[0]), Math.round(pt[1])]);
      }
      if (btns.length < P.btn + 1) continue;
      var exit = btns.pop();
      // враги
      var foes = [], okf = true;
      function farFrom(px, py, m) { return dist(px, py, st.x, st.y) > m; }
      for (k = 0; k < P.sc && okf; k++) {
        var tries = 0, f = null;
        while (!f && tries++ < 80) {
          var hz = rnd() < 0.5, len = 110 + rnd() * 80, x0 = 50 + rnd() * (W - 100 - (hz ? len : 0)), y0 = 70 + rnd() * (H - 230 - (hz ? 0 : len));
          var x1 = hz ? x0 + len : x0, y1 = hz ? y0 : y0 + len;
          if (!farFrom(x0, y0, 140) || !farFrom(x1, y1, 140)) continue;
          if (walls.some(function (w) { return Math.min(x0, x1) < w.x + w.w + 14 && Math.max(x0, x1) > w.x - 14 && Math.min(y0, y1) < w.y + h2(w) + 14 && Math.max(y0, y1) > w.y - 14; })) continue;
          f = { t: 's', ax: x0, ay: y0, bx: x1, by: y1, u: rnd(), dir: 1, sp: 62 + i * 5, x: x0, y: y0, r: 12 };
        }
        if (f) foes.push(f); else okf = false;
      }
      for (k = 0; k < P.moth && okf; k++) {
        var tm = 0, fm = null;
        while (!fm && tm++ < 80) {
          var rad = 55 + rnd() * 35, mx = rad + 30 + rnd() * (W - 2 * rad - 60), my = rad + 40 + rnd() * (H - 2 * rad - 200);
          if (!farFrom(mx, my, rad + 120)) continue;
          fm = { t: 'm', cx: Math.round(mx), cy: Math.round(my), rad: rad, a: rnd() * 6.28, w: (rnd() < 0.5 ? 1 : -1) * (0.9 + rnd() * 0.5 + i * 0.03), x: mx, y: my, r: 9 };
        }
        if (fm) foes.push(fm); else okf = false;
      }
      for (k = 0; k < P.iron && okf; k++) {
        var hz2 = k % 2 === 0, lane = hz2 ? 150 + rnd() * 220 : 80 + rnd() * 290;
        foes.push({ t: 'i', hz: hz2, lane: Math.round(lane), st: 'rest', tm: 1.2 + k * 1.1, sgn: 1, p: -40, x: -60, y: -60, r: 15 });
      }
      if (!okf) continue;
      return (cache[i] = { n: i, pins: pins, walls: walls, buttons: btns, exit: exit, foes: foes, start: [st.x, st.y] });
    }
    throw new Error('не удалось построить стол ' + i);
  }
  function h2(w) { return w.h; }
  SP.level = level;

  // ---------- игра ----------
  SP.Game = function (opts) {
    opts = opts || {};
    var onEvent = opts.onEvent || null, S;
    function emit(t, d) { if (onEvent) { try { onEvent(t, d || {}); } catch (e) { } } }

    function loadLevel(lv) {
      var L = level(lv), c = JSON.parse(JSON.stringify(L));
      S.level = lv; S.pins = c.pins; S.walls = c.walls; S.foes = c.foes; S.exit = { x: c.exit[0], y: c.exit[1] };
      S.buttons = c.buttons.map(function (b) { return { x: b[0], y: b[1], on: true }; }); S.left = S.buttons.length; S.total = S.left;
      S.time = 0; S.t = 0; S.exitOpen = false; S.combo = 0; S.comboT = 0; S.levelDeaths = 0; S.foes.forEach(function (f) { foeInit(f); });
      respawn();
    }
    function respawn() { S.hero = { x: C.START[0], y: C.START[1], hx: 0, hy: -1, hook: null }; S.hold = false; S.inv = 1.8; S.pins.forEach(function (p) { p.cool = 0; p.dead = 0; p.hang = 0; }); }
    function foeInit(f) { if (f.t === 'm') { f.x = f.cx + Math.cos(f.a) * f.rad; f.y = f.cy + Math.sin(f.a) * f.rad; } }
    function fresh() {
      S = { mode: 'play', level: 0, score: 0, lives: opts.lives == null ? C.LIVES : opts.lives, shield: 0, t: 0, time: 0, clearT: 0, dieT: 0, inv: 0,
        hero: null, hold: false, pins: [], walls: [], buttons: [], foes: [], exit: { x: 0, y: 0 }, exitOpen: false, combo: 0, comboT: 0, left: 0, total: 0, levelDeaths: 0, bonus: 0,
        stats: { hooks: 0, deaths: 0, maxCombo: 0 } };
      loadLevel(opts.level || 0);
    }

    function stepFoe(f, dt) {
      if (f.t === 's') {
        var dx = f.bx - f.ax, dy = f.by - f.ay, len = Math.hypot(dx, dy) || 1; f.u += f.dir * f.sp * dt / len;
        if (f.u >= 1) { f.u = 1; f.dir = -1; } else if (f.u <= 0) { f.u = 0; f.dir = 1; }
        f.x = f.ax + dx * f.u; f.y = f.ay + dy * f.u;
      } else if (f.t === 'm') { f.a += f.w * dt; f.x = f.cx + Math.cos(f.a) * f.rad; f.y = f.cy + Math.sin(f.a) * f.rad; }
      else {   // утюг: покой → предупреждение (красная полоса) → бросок через весь стол
        var lim = f.hz ? W : H;
        f.tm -= dt;
        if (f.st === 'rest') { f.x = f.y = -80; if (f.tm <= 0) { f.st = 'warn'; f.tm = 0.85; emit('warn', { hz: f.hz, lane: f.lane }); } }
        else if (f.st === 'warn') { if (f.tm <= 0) { f.st = 'dash'; f.p = f.sgn > 0 ? -30 : lim + 30; emit('dash', {}); } }
        else { f.p += f.sgn * 400 * dt; if (f.sgn > 0 ? f.p > lim + 30 : f.p < -30) { f.st = 'rest'; f.tm = 2.2; f.sgn = -f.sgn; } }
        if (f.st === 'dash') { f.x = f.hz ? f.p : f.lane; f.y = f.hz ? f.lane : f.p; }
      }
    }
    function clearLevel() {
      if (S.mode !== 'play') return;
      var bonus = 200 + Math.max(0, Math.round((60 - S.time) * 4)) + (S.levelDeaths === 0 ? 100 : 0);
      S.score += bonus; S.bonus = bonus;
      if ((S.level === 2 || S.level === 5) && S.lives < 5) { S.lives++; emit('life', {}); }
      S.mode = 'clear'; S.clearT = 1.7; S.hold = false; emit('clear', { bonus: bonus, level: S.level });
    }
    function hurt(f) {
      if (S.shield > 0) { S.shield--; S.inv = 1.6; emit('shield', { x: S.hero.x, y: S.hero.y }); return; }
      S.lives--; S.stats.deaths++; S.levelDeaths++; S.mode = 'dying'; S.dieT = 1.1; S.hold = false; S.combo = 0; emit('hurt', { x: S.hero.x, y: S.hero.y, lives: S.lives });
    }

    function sub(dt) {
      S.t += dt; S.time += dt; if (S.inv > 0) S.inv -= dt;
      if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
      var hadHook = !!S.hero.hook;
      heroStep(S, dt, function (t, d) { if (t === 'hook') S.stats.hooks++; emit(t, d); });
      var h = S.hero, i;
      for (i = 0; i < S.buttons.length; i++) {
        var b = S.buttons[i];
        if (b.on && dist(b.x, b.y, h.x, h.y) < 15) {
          b.on = false; S.left--; S.combo = S.comboT > 0 ? Math.min(6, S.combo + 1) : 1; S.comboT = 2.2; if (S.combo > S.stats.maxCombo) S.stats.maxCombo = S.combo;
          var pts = 50 * S.combo; S.score += pts; emit('button', { x: b.x, y: b.y, pts: pts, combo: S.combo });
          if (S.left <= 0) { S.exitOpen = true; emit('exitOpen', { x: S.exit.x, y: S.exit.y }); }
        }
      }
      for (i = 0; i < S.foes.length; i++) stepFoe(S.foes[i], dt);
      if (S.exitOpen && dist(S.exit.x, S.exit.y, h.x, h.y) < 17) { clearLevel(); return; }
      if (S.inv > 0) return;
      for (i = 0; i < S.foes.length; i++) { var f = S.foes[i]; if (f.t === 'i' && f.st !== 'dash') continue; if (dist(f.x, f.y, h.x, h.y) < f.r + C.HIT_R) { hurt(f); return; } }
    }

    function step(dt) {
      if (dt > 0.05) dt = 0.05;
      if (S.mode === 'clear') { S.clearT -= dt; if (S.clearT <= 0) { if (S.level + 1 >= MAX_LEVEL) { S.mode = 'victory'; emit('victory', { score: S.score }); } else { loadLevel(S.level + 1); S.mode = 'play'; emit('level', { level: S.level }); } } return; }
      if (S.mode === 'dying') { S.dieT -= dt; if (S.dieT <= 0) { if (S.lives <= 0) { S.mode = 'gameover'; emit('gameover', { score: S.score }); } else { respawn(); S.mode = 'play'; } } return; }
      if (S.mode !== 'play') return;
      var n = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-9)), d = dt / n;
      for (var k = 0; k < n && S.mode === 'play'; k++) sub(d);
    }

    fresh();
    return {
      state: function () { return S; }, step: step, consts: C,
      start: function () { fresh(); },
      setHold: function (b) { S.hold = !!b && S.mode === 'play'; },
      addShield: function () { S.shield = Math.min(2, S.shield + 1); },
      revive: function () { if (S.mode === 'gameover' || S.mode === 'dying') { S.lives = 1; S.shield = 0; respawn(); S.mode = 'play'; S.inv = 2.5; } },
      isOver: function () { return S.mode === 'gameover' || S.mode === 'victory'; },
      clone: function () { var o = SP.Game({ level: 0, lives: 1 }); o._set(JSON.parse(JSON.stringify(S))); return o; },
      _set: function (s) { S = s; }
    };
  };
  SP.heroStep = heroStep;
})(typeof window !== 'undefined' ? window : globalThis);
