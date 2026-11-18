/* ОТГОН · логика игры (чистая, без DOM и канвы — тестируется в Node).
   Вид сверху: подросток-пастух мастеровых ведёт стадо мохнатых северных оленей-«шерстней»
   с медными колокольчиками через шесть перевалов. Мир — горный коридор вдоль оси X между верхней
   и нижней кромкой (скала или обрыв), высота мира = высота экрана (540), камера едет по X.
   Стадо — флокинг (разделение, сближение, выравнивание), особи обходят скалы, боятся пастуха вблизи,
   идут на свист, разбегаются от окрика, успокаиваются от колокола на посохе.
   API: OTGON.Game({ rng, onEvent, snapshot, level }) → { state(), update(dt), setMove(dx,dy), moveTo(x,y),
        whistle(), shout(), staff(), snapshot(), restore(sn), ... } */
(function (global) {
  'use strict';
  var O = global.OTGON = global.OTGON || {};

  // ---------- Константы ----------
  var WH = 540, HERO_V = 104, WALK = 34, RUN = 84, CALF_K = 0.78;
  var WHISTLE_R = 340, WHISTLE_T = 4, SHOUT_R = 230, SHOUT_T = 1.6, BELL_R = 170, TORCH_R = 115, WAVE_R = 215;
  var SEP_R = 19, COH_R = 120, PRESS_R = 62, EDGE_AV = 36;
  var HUNGER_RATE = 1 / 200, TIRE_RATE = 1 / 140, GRAZE_RATE = 0.085;
  var NIGHT_MAX = 150, SLEEP_NEED = 3, SHELTER_PART = 0.75;

  // ---------- Перевалы ----------
  // top/bot — кромки коридора (точки [x,y]); cliffs — участки нижней кромки-обрыва [x0,x1];
  // rocks/pastures/waters/shelters — круги [x,y,r]; river {x,w,f0,f1} — бурная река поперёк пути, брод — только y∈[f0,f1];
  // falls — зоны камнепада [x0,x1]; aval — лавина [x0,x1]; snow — метель [x0,x1,сила]; night — x наступления ночи (укрытие — shelters[0]);
  // pred — хищник ночи; joins — отбившиеся дикие шерстни [x,y]; calf — к утру рождается телёнок; cps — x чекпоинтов; end — x ворот перевала.
  var LEVELS = [
    { len: 5400, start: 220, end: 5180,
      top: [[0, 96], [900, 118], [1700, 84], [2600, 120], [3400, 92], [4300, 126], [5400, 100]],
      bot: [[0, 474], [1100, 500], [2000, 452], [2900, 470], [3800, 498], [4700, 462], [5400, 480]],
      cliffs: [[2250, 3050]], rocks: [[760, 250, 30], [1500, 380, 26], [2400, 210, 34], [3550, 300, 30], [4450, 210, 28], [4800, 400, 24]],
      pastures: [[1250, 300, 95], [3250, 250, 100]], waters: [[2050, 200, 48], [4250, 360, 52]], shelters: [],
      falls: [], snow: null, aval: null, river: null, night: 0, pred: null, joins: [], calf: false, cps: [1900, 3700] },
    { len: 6200, start: 200, end: 5980,
      top: [[0, 100], [1000, 80], [1800, 130], [2700, 96], [3600, 120], [4500, 90], [5300, 110], [6200, 100]],
      bot: [[0, 470], [900, 490], [1800, 440], [2700, 486], [3500, 456], [4400, 494], [5300, 470], [6200, 480]],
      cliffs: [[3050, 3750]], rocks: [[600, 300, 28], [1700, 220, 30], [2500, 360, 26], [3300, 220, 32], [4100, 380, 28], [5300, 240, 30], [5600, 420, 22]],
      pastures: [[1150, 330, 92], [3150, 360, 90], [5550, 300, 90]], waters: [[2700, 420, 46], [5000, 250, 50]], shelters: [[4920, 330, 84]],
      falls: [[1500, 2250], [3850, 4400]], snow: null, aval: null, river: null, night: 4620, pred: 'wolf', joins: [[2850, 170]], calf: false, cps: [2600, 3900] },
    { len: 6400, start: 200, end: 6180,
      top: [[0, 96], [1200, 120], [2200, 90], [2900, 110], [3800, 92], [4800, 126], [5600, 96], [6400, 110]],
      bot: [[0, 476], [1100, 452], [2100, 496], [2900, 492], [3900, 462], [4900, 486], [5700, 470], [6400, 480]],
      cliffs: [[4750, 5350]], rocks: [[700, 280, 28], [1650, 380, 30], [2250, 300, 26], [3200, 200, 30], [3550, 400, 26], [4500, 240, 30], [5800, 360, 26]],
      pastures: [[1250, 270, 95], [3400, 330, 92], [5500, 270, 90]], waters: [[2350, 430, 42], [5150, 230, 46]], shelters: [[4250, 340, 86]],
      falls: [], snow: null, aval: null, river: { x: 2620, w: 150, f0: 150, f1: 238 }, night: 3900, pred: 'wolf', joins: [], calf: true, cps: [2950, 4700] },
    { len: 6600, start: 200, end: 6380,
      top: [[0, 110], [800, 130], [1700, 170], [2600, 190], [3500, 170], [4300, 110], [5200, 96], [6600, 110]],
      bot: [[0, 470], [800, 440], [1700, 330], [2600, 350], [3500, 330], [4300, 450], [5200, 480], [6600, 470]],
      cliffs: [[1700, 3650]], rocks: [[900, 300, 30], [2200, 240, 18], [3100, 250, 18], [4700, 300, 30], [5500, 230, 28], [5900, 400, 26]],
      pastures: [[1000, 220, 90], [4000, 300, 95], [5800, 300, 90]], waters: [[1450, 300, 40], [5150, 330, 48]], shelters: [[4620, 260, 86]],
      falls: [[2350, 3000]], snow: null, aval: null, river: null, night: 4300, pred: 'lynx', joins: [[5300, 430]], calf: false, cps: [1600, 3800, 5400] },
    { len: 6800, start: 200, end: 6580,
      top: [[0, 100], [1000, 120], [2000, 90], [2900, 110], [3800, 96], [4700, 120], [5600, 100], [6800, 110]],
      bot: [[0, 480], [1000, 470], [2000, 496], [2900, 470], [3800, 450], [4700, 480], [5600, 470], [6800, 476]],
      cliffs: [[3450, 4150]], rocks: [[800, 320, 28], [1800, 200, 28], [2400, 400, 26], [3700, 230, 30], [4500, 360, 26], [5900, 240, 30]],
      pastures: [[1100, 260, 92], [4350, 260, 92], [6000, 380, 90]], waters: [[1450, 400, 44], [5550, 250, 46]], shelters: [[5050, 300, 86]],
      falls: [], snow: [1600, 4300, 1], aval: [2650, 3200], river: null, night: 4750, pred: 'wolf', joins: [], calf: true, cps: [2400, 3400, 4400] },
    { len: 7200, start: 200, end: 6980,
      top: [[0, 96], [1000, 120], [2000, 96], [2800, 110], [3700, 130], [4600, 100], [5500, 120], [6400, 92], [7200, 100]],
      bot: [[0, 478], [1000, 456], [2000, 490], [2800, 492], [3700, 460], [4600, 490], [5500, 470], [6400, 486], [7200, 476]],
      cliffs: [[3550, 4200]], rocks: [[700, 300, 28], [1600, 220, 28], [2200, 380, 26], [3300, 240, 30], [4400, 300, 28], [5300, 200, 26], [6200, 380, 28]],
      pastures: [[950, 330, 92], [3300, 380, 90], [5000, 280, 92]], waters: [[2250, 230, 44], [4700, 420, 44], [6600, 300, 46]], shelters: [[6000, 300, 88]],
      falls: [[1150, 1800]], snow: [4500, 5500, 0.6], aval: null, river: { x: 2700, w: 150, f0: 340, f1: 430 }, night: 5650, pred: 'wolf', joins: [[1900, 440]], calf: false, cps: [1950, 3000, 4500] }
  ];
  var START_HERD = 12;

  function interp(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) { var a = pts[i - 1], b = pts[i], k = (x - a[0]) / (b[0] - a[0]); k = k * k * (3 - 2 * k); return a[1] + (b[1] - a[1]) * k; }
    return pts[pts.length - 1][1];
  }
  function wob(x, s) { return 7 * Math.sin(x / 61 + s) + 4 * Math.sin(x / 23 + s * 2.1); }
  function topY(L, x) { return interp(L.top, x) + wob(x, 1.3); }
  function botY(L, x) { return interp(L.bot, x) - wob(x, 4.1); }
  function isCliff(L, x) { for (var i = 0; i < L.cliffs.length; i++) if (x >= L.cliffs[i][0] && x <= L.cliffs[i][1]) return true; return false; }
  function inRiver(L, x) { var r = L.river; return !!r && x > r.x && x < r.x + r.w; }
  function inFord(L, y) { var r = L.river; return !!r && y >= r.f0 && y <= r.f1; }
  function inCircle(c, x, y, pad) { var dx = x - c[0], dy = y - c[1]; return dx * dx + dy * dy < (c[2] + (pad || 0)) * (c[2] + (pad || 0)); }
  function snowAt(L, x) { var s = L.snow; if (!s || x < s[0] || x > s[1]) return 0; return s[2] * Math.min(1, (x - s[0]) / 300, (s[1] - x) / 300); }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  function stars(k) { return k >= 0.95 ? 3 : k >= 0.75 ? 2 : k >= 0.4 ? 1 : 0; }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || mulberry32(1), emit = opts.onEvent || function () {};
    var S = null, nextId = 1, moveIn = { x: 0, y: 0 }, target = null;

    function animal(x, y, calf, st) {
      return { id: nextId++, x: x, y: y, vx: 0, vy: 0, calf: !!calf, st: st || 'ok', hunger: 0.9, tired: 0.1, fear: 0,
        whT: 0, pushT: 0, px: 0, py: 0, calmT: 0, fx: 0, fy: 0, fallT: 0, lie: false, ph: rng() * 6.28, inj: false, seizeT: 0, face: 0 };
    }
    function L() { return LEVELS[S.lv]; }
    function midY(x) { var l = L(); return (topY(l, x) + botY(l, x)) / 2; }

    function placeHerd(list, cx) {
      var l = L(), cy = midY(cx), n = list.length;
      S.herd = list.map(function (h, i) {
        var a = (i / Math.max(1, n)) * 6.28 + 0.4, r = 18 + (i % 3) * 16;
        var x = cx + Math.cos(a) * r, y = Math.max(topY(l, x) + 22, Math.min(botY(l, x) - 22, cy + Math.sin(a) * r * 0.8));
        var an = animal(x, y, h.calf); an.hunger = h.hunger != null ? h.hunger : 0.9; an.tired = h.tired != null ? h.tired : 0.1; return an;
      });
      S.hero.x = cx - 70; S.hero.y = cy; target = null;
    }
    function newLevel(lv, herdList, keep) {
      S.lv = lv; var l = L();
      S.phase = 'play'; S.t = 0; S.night = 0; S.nightOn = false; S.nightDone = !l.night; S.nightT = 0; S.sleepT = 0; S.sleeping = 0;
      S.preds = []; S.predT = 6; S.rocksFall = []; S.fallZ = l.falls.map(function () { return { st: 'idle', t: 2 + rng() * 2, spots: [] }; });
      S.aval = l.aval ? { st: 'idle', t: 0, front: 0, cool: 0 } : null;
      S.wild = l.joins.map(function (j) { var a = animal(j[0], j[1], false, 'wild'); a.hunger = 1; return a; });
      S.calfBorn = !l.calf; S.cpIdx = 0; S.done = null; S.levelStart = herdList.length;
      S.hero = S.hero || { x: 0, y: 0 }; S.hero.carry = null; S.hero.tend = null; S.hero.stun = 0; S.hero.face = { x: 1, y: 0 }; S.hero.waveT = 0;
      placeHerd(herdList, l.start + 80);
      S.cp = makeCp(l.start + 80);
      if (!keep) emit('level', { lv: lv });
    }
    function liveHerd() { return S.herd.filter(function (a) { return a.st !== 'lost'; }); }
    function makeCp(x) {
      return { lv: S.lv, x: x, herd: liveHerd().map(function (a) { return { calf: a.calf, hunger: Math.max(0.6, a.hunger), tired: Math.min(0.3, a.tired) }; }),
        totalEver: S.totalEver, delivered: S.delivered.slice(), starsLv: S.starsLv.slice(), nightDone: S.nightDone, calfBorn: S.calfBorn,
        wild: S.wild.filter(function (w) { return w.st === 'wild'; }).map(function (w) { return [w.x, w.y]; }), cpIdx: S.cpIdx, score: S.score };
    }
    function checkpoint(x) { S.cp = makeCp(x); emit('checkpoint', { save: S.cp }); }

    function restoreCp(cp) {
      S.totalEver = cp.totalEver; S.delivered = cp.delivered.slice(); S.starsLv = cp.starsLv.slice(); S.score = cp.score || 0;
      newLevel(cp.lv, cp.herd, true);
      S.nightDone = cp.nightDone; S.calfBorn = cp.calfBorn; S.cpIdx = cp.cpIdx || 0;
      S.wild = (cp.wild || []).map(function (j) { var a = animal(j[0], j[1], false, 'wild'); return a; });
      placeHerd(cp.herd, cp.x); S.cp = cp;
    }

    function start() {
      S = { lv: 0, herd: [], hero: { x: 0, y: 0 }, totalEver: START_HERD, delivered: [], starsLv: [], score: 0, t: 0, events: 0, won: false, cool: { wh: 0, sh: 0, st: 0 } };
      if (opts.snapshot) { restoreCp(opts.snapshot); return api; }
      var list = []; for (var i = 0; i < START_HERD; i++) list.push({ calf: false });
      newLevel(opts.level || 0, list);
      return api;
    }

    // ---------- Действия пастуха ----------
    function whistle() {
      if (S.cool.wh > 0 || S.phase !== 'play') return false; S.cool.wh = 0.5; var h = S.hero;
      S.herd.forEach(function (a) { if (a.st === 'ok' && len(a.x - h.x, a.y - h.y) < WHISTLE_R) a.whT = WHISTLE_T; });
      S.wild.forEach(function (w) { if (w.st === 'wild' && len(w.x - h.x, w.y - h.y) < 260) { w.st = 'ok'; w.whT = WHISTLE_T; S.herd.push(w); S.totalEver++; emit('join', {}); } });
      S.wild = S.wild.filter(function (w) { return w.st === 'wild'; });
      S.lastWh = 0.6; emit('whistle', {}); return true;
    }
    function shout() {
      if (S.cool.sh > 0 || S.phase !== 'play') return false; S.cool.sh = 0.6; var h = S.hero, f = h.face;
      S.herd.forEach(function (a) {
        if (a.st !== 'ok') return; var dx = a.x - h.x, dy = a.y - h.y, d = len(dx, dy); if (d > SHOUT_R) return;
        var ux = dx / (d || 1), uy = dy / (d || 1), px = ux * 0.55 + f.x * 0.75, py = uy * 0.55 + f.y * 0.75, pl = len(px, py) || 1;
        a.pushT = SHOUT_T; a.px = px / pl; a.py = py / pl; a.whT = 0; a.fear = Math.min(1, a.fear + (d < 90 ? 0.22 : 0.1)); a.fx = h.x; a.fy = h.y; a.lie = false;
      });
      S.lastSh = 0.6; emit('shout', {}); return true;
    }
    function staff() {
      if (S.cool.st > 0 || S.phase !== 'play') return false; S.cool.st = 0.35; var h = S.hero;
      if (h.carry) { var c = byId(h.carry); h.carry = null; if (c) { c.st = 'ok'; c.x = h.x + 14; c.y = h.y + 6; c.lie = false; clampAnimal(c); } emit('drop', {}); return 'drop'; }
      var inj = nearest(function (a) { return a.st === 'ok' && a.inj; }, 38);
      if (inj) { h.tend = { id: inj.id, t: 0 }; emit('tend', {}); return 'tend'; }
      var calf = nearest(function (a) { return a.st === 'ok' && a.calf && (a.lie || a.tired > 0.5); }, 34);
      if (calf) { h.carry = calf.id; calf.st = 'carried'; emit('pick', {}); return 'pick'; }
      // колокол на посохе: успокоить; ночью — ещё и махнуть факелом
      S.herd.forEach(function (a) { if ((a.st === 'ok' || a.st === 'carried') && len(a.x - h.x, a.y - h.y) < BELL_R) a.calmT = 2.2; });
      if (S.night > 0.3) { h.waveT = 1.6; emit('torch', {}); } else emit('bell', {});
      S.lastBell = 0.7; return 'bell';
    }
    function byId(id) { for (var i = 0; i < S.herd.length; i++) if (S.herd[i].id === id) return S.herd[i]; return null; }
    function nearest(pred, r) { var h = S.hero, best = null, bd = r; S.herd.forEach(function (a) { if (!pred(a)) return; var d = len(a.x - h.x, a.y - h.y); if (d < bd) { bd = d; best = a; } }); return best; }

    // ---------- Коллизии ----------
    function clampAnimal(a) {
      var l = L(), t = topY(l, a.x) + 9, b = botY(l, a.x) - 9;
      if (a.x < 16) a.x = 16; if (a.x > l.len - 16) a.x = l.len - 16;
      if (a.y < t) { a.y = t; if (a.vy < 0) a.vy = 0; }
      if (a.y > b && !(isCliff(l, a.x) || inRiver(l, a.x))) { a.y = b; if (a.vy > 0) a.vy = 0; }
      for (var i = 0; i < l.rocks.length; i++) { var r = l.rocks[i], dx = a.x - r[0], dy = a.y - r[1], d = len(dx, dy), m = r[2] + 7;
        if (d < m) { if (d < 0.01) { dx = 1; dy = 0; d = 1; } a.x = r[0] + dx / d * m; a.y = r[1] + dy / d * m; } }
    }
    function clampHero(h, ox) {
      var l = L();
      if (inRiver(l, h.x) && !inFord(l, h.y)) { h.x = ox; }
      var t = topY(l, h.x) + 10, b = botY(l, h.x) - (isCliff(l, h.x) ? 14 : 10);
      if (inRiver(l, h.x)) { var r = l.river; t = Math.max(t, r.f0); b = Math.min(b, r.f1); }
      h.x = Math.max(14, Math.min(l.len - 14, h.x)); h.y = Math.max(t, Math.min(b, h.y));
      for (var i = 0; i < l.rocks.length; i++) { var r2 = l.rocks[i], dx = h.x - r2[0], dy = h.y - r2[1], d = len(dx, dy), m = r2[2] + 8;
        if (d < m) { if (d < 0.01) { dx = 1; d = 1; } h.x = r2[0] + dx / d * m; h.y = r2[1] + dy / d * m; } }
    }

    // ---------- Шаг ----------
    function centroid(list) { var x = 0, y = 0, n = 0; list.forEach(function (a) { x += a.x; y += a.y; n++; }); return n ? { x: x / n, y: y / n, n: n } : null; }
    function active() { return S.herd.filter(function (a) { return a.st === 'ok' || a.st === 'carried' || a.st === 'seized'; }); }

    function update(dt) {
      if (!S || S.phase === 'won') return;
      S.t += dt; S.cool.wh -= dt; S.cool.sh -= dt; S.cool.st -= dt; S.lastWh = (S.lastWh || 0) - dt; S.lastSh = (S.lastSh || 0) - dt; S.lastBell = (S.lastBell || 0) - dt;
      if (S.phase === 'done') { S.doneT -= dt; if (S.doneT <= 0) nextLevel(); return; }
      if (S.sleeping > 0) { S.sleeping -= dt; if (S.sleeping <= 0) dawn(); return; }
      var l = L(), h = S.hero;
      // пастух
      var ox = h.x, mx = moveIn.x, my = moveIn.y;
      if (target && !mx && !my) { var tx = target.x - h.x, ty = target.y - h.y, tl = len(tx, ty); if (tl < 6) target = null; else { mx = tx / tl; my = ty / tl; } }
      var ml = len(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
      if (h.stun > 0) { h.stun -= dt; mx = my = 0; }
      if (ml > 0.05) { h.face = { x: mx / (ml > 1 ? 1 : (ml || 1)), y: my / (ml > 1 ? 1 : (ml || 1)) }; var fl = len(h.face.x, h.face.y) || 1; h.face.x /= fl; h.face.y /= fl; if (h.tend) h.tend = null; }
      var hv = HERO_V * (h.carry ? 0.8 : 1) * (1 - snowAt(l, h.x) * 0.25);
      h.x += mx * hv * dt; h.y += my * hv * dt; clampHero(h, ox); h.moving = ml > 0.05;
      h.waveT = Math.max(0, h.waveT - dt);
      if (h.tend) { var ta = byId(h.tend.id); if (!ta || ta.st !== 'ok' || len(ta.x - h.x, ta.y - h.y) > 46) h.tend = null; else { h.tend.t += dt; ta.vx *= 0.8; ta.vy *= 0.8; if (h.tend.t >= 1.8) { ta.inj = false; ta.fear = 0; h.tend = null; emit('heal', {}); } } }
      if (h.carry) { var cc = byId(h.carry); if (cc) { cc.x = h.x - 4; cc.y = h.y - 12; cc.tired = Math.max(0, cc.tired - 0.08 * dt); cc.fear = Math.max(0, cc.fear - dt); } else h.carry = null; }

      var act = active(), C = centroid(act.filter(function (a) { return a.st !== 'seized'; })) || centroid(act);
      S.C = C;
      updNight(dt, l, C);
      updHazards(dt, l, C);
      updPreds(dt, l, C);
      for (var i = 0; i < S.herd.length; i++) stepAnimal(S.herd[i], dt, l);
      S.wild.forEach(function (w) { w.ph += dt; if (C && len(w.x - C.x, w.y - C.y) < 110) { w.st = 'ok'; S.herd.push(w); S.totalEver++; emit('join', {}); } });
      S.wild = S.wild.filter(function (w) { return w.st === 'wild'; });

      act = active();
      if (!act.length) { emit('regroup', {}); restoreCp(S.cp); return; }
      // чекпоинты — каменные туры с колокольцем
      if (C && S.cpIdx < l.cps.length && C.x > l.cps[S.cpIdx] && !S.nightOn) { var cx = l.cps[S.cpIdx]; S.cpIdx++; checkpoint(cx); }
      // ворота перевала
      if (h.x > l.end - 70) {
        var near = act.filter(function (a) { return a.x > l.end - 170; }).length;
        if (near >= Math.ceil(act.length * 0.6)) finishLevel(l);
      }
    }

    function stepAnimal(a, dt, l) {
      if (a.st === 'lost' || a.st === 'carried' || a.st === 'wild') { if (a.st === 'wild') { a.vx = a.vy = 0; } return; }
      if (a.st === 'fall') { a.fallT += dt; a.y += 60 * dt; if (a.fallT > 0.9) { a.st = 'lost'; emit('lost', { why: 'fall' }); } return; }
      if (a.st === 'swept') { a.y += 95 * dt; a.x += (l.river.x + l.river.w / 2 - a.x) * dt; if (a.y > botY(l, a.x) - 6) { a.st = 'lost'; emit('lost', { why: 'river' }); } return; }
      if (a.st === 'seized') { a.seizeT -= dt; a.fear = 1; if (a.seizeT <= 0) { a.st = 'lost'; emit('lost', { why: 'pred' }); } return; }
      var h = S.hero, ax = 0, ay = 0, sepR = a.calf ? 14 : SEP_R, snow = snowAt(l, a.x), cohR = COH_R * (1 - snow * 0.5);
      var cx = 0, cy = 0, cn = 0, vx = 0, vy = 0;
      for (var i = 0; i < S.herd.length; i++) {
        var b = S.herd[i]; if (b === a || (b.st !== 'ok' && b.st !== 'seized')) continue;
        var dx = a.x - b.x, dy = a.y - b.y, d = len(dx, dy);
        if (d < sepR && d > 0.01) { var k = (sepR - d) / sepR * 1.7; ax += dx / d * k; ay += dy / d * k; }
        if (d < cohR) { cx += b.x; cy += b.y; vx += b.vx; vy += b.vy; cn++; if (b.fear > a.fear + 0.3 && d < 50) { a.fear += 0.35 * dt; a.fx = b.fx; a.fy = b.fy; } }
      }
      if (cn) { var gx = cx / cn - a.x, gy = cy / cn - a.y, gl = len(gx, gy); if (gl > 30) { ax += gx / gl * 0.32; ay += gy / gl * 0.32; } ax += vx / cn / WALK * 0.22; ay += vy / cn / WALK * 0.22; }
      // пастух рядом — отходят (так его «давлением» можно подгонять)
      var hdx = a.x - h.x, hdy = a.y - h.y, hd = len(hdx, hdy), pr = a.whT > 0 ? 30 : PRESS_R;
      if (hd < pr && hd > 0.01) { var hk = (1 - hd / pr) * 1.2; ax += hdx / hd * hk; ay += hdy / hd * hk; }
      // свист — идут к пастуху (паника глушит свист)
      if (a.whT > 0) { a.whT -= dt; if (hd > 46 && a.fear < 0.55) { ax -= hdx / hd * 1.25; ay -= hdy / hd * 1.25; } }
      // окрик — погнать по направлению
      if (a.pushT > 0) { a.pushT -= dt; ax += a.px * 1.5; ay += a.py * 1.5; }
      // страх — бегут прочь от источника
      if (a.fear > 0.45) { var fdx = a.x - a.fx, fdy = a.y - a.fy, fd = len(fdx, fdy) || 1; ax += fdx / fd * a.fear * 1.6; ay += fdy / fd * a.fear * 1.6; }
      // бродят понемногу
      a.ph += dt * (0.6 + (a.id % 5) * 0.07);
      var wk = 0.12 + (a.hunger < 0.25 ? 0.25 : 0) + snow * 0.25;
      ax += Math.cos(a.ph * 0.7 + a.id) * wk; ay += Math.sin(a.ph * 0.9 + a.id * 2) * wk;
      // метель — ветер к обрыву (вниз)
      if (snow) ay += snow * 0.32;
      // кромки, скалы, река — обходят (паника притупляет осторожность)
      var care = a.fear > 0.75 ? 0.45 : 1, t = topY(l, a.x), bt = botY(l, a.x), cl = isCliff(l, a.x);
      if (a.y - t < EDGE_AV) ax += 0, ay += (EDGE_AV - (a.y - t)) / EDGE_AV * 1.4;
      if (bt - a.y < EDGE_AV + (cl ? 14 : 0)) ay -= (EDGE_AV + (cl ? 14 : 0) - (bt - a.y)) / EDGE_AV * (cl ? 2.6 * care : 1.4);
      l.rocks.forEach(function (r) { var dx = a.x - r[0], dy = a.y - r[1], d = len(dx, dy), m = r[2] + 26; if (d < m && d > 0.01) { var k = (m - d) / 26 * 1.2; ax += dx / d * k; ay += dy / d * k; } });
      if (l.river && !inFord(l, a.y)) { var rv = l.river, lx = rv.x - a.x, rx = a.x - (rv.x + rv.w);
        if (lx > 0 && lx < 44) ax -= (44 - lx) / 44 * 2.4 * care; if (rx > 0 && rx < 44) ax += (44 - rx) / 44 * 2.4 * care; }
      if (l.river && inRiver(l, a.x) && inFord(l, a.y)) { var fm = (l.river.f0 + l.river.f1) / 2; ay += (fm - a.y) / 40 * 0.8; }
      // тени камнепада: сыплется мелкий щебень — особи шарахаются от места удара
      for (var fz = 0; fz < S.fallZ.length; fz++) { var FZ = S.fallZ[fz]; if (FZ.st !== 'warn') continue;
        for (var q = 0; q < FZ.spots.length; q++) { var sq = FZ.spots[q], qx = a.x - sq[0], qy = a.y - sq[1], qd = len(qx, qy), qm = sq[2] + 18;
          if (qd < qm && qd > 0.01) { var qk = (qm - qd) / qm * 2.2; ax += qx / qd * qk; ay += qy / qd * qk; } } }
      // пастбище / водопой / лежка
      var onPast = false, onWater = false;
      for (var p = 0; p < l.pastures.length; p++) if (inCircle(l.pastures[p], a.x, a.y)) onPast = true;
      for (var w = 0; w < l.waters.length; w++) if (inCircle(l.waters[w], a.x, a.y, 14)) onWater = true;
      // голодные чуют траву, уставшие — воду (если их не зовут и не гонят)
      if (a.whT <= 0 && a.pushT <= 0 && a.fear < 0.4) {
        if (a.hunger < 0.6 && !onPast) for (var p2 = 0; p2 < l.pastures.length; p2++) { var pp = l.pastures[p2], pdx = pp[0] - a.x, pdy = pp[1] - a.y, pd = len(pdx, pdy); if (pd < pp[2] + 140 && pd > 1) { ax += pdx / pd * 0.6; ay += pdy / pd * 0.6; break; } }
        if (a.tired > 0.5 && !onWater) for (var w2 = 0; w2 < l.waters.length; w2++) { var ww = l.waters[w2], wdx = ww[0] - a.x, wdy = ww[1] - a.y, wd = len(wdx, wdy); if (wd < ww[2] + 120 && wd > 1) { ax += wdx / wd * 0.5; ay += wdy / wd * 0.5; break; } }
      }
      var al = len(ax, ay); if (al > 1) { ax /= al; ay /= al; al = 1; }
      var sp = WALK * (1 - a.tired * 0.5) * (a.calf ? CALF_K : 1) * (a.inj ? 0.45 : 1) * (a.hunger < 0.12 ? 0.7 : 1) * (1 - snow * 0.25);
      if (a.fear > 0.45 && !a.inj) sp = Math.max(sp, RUN * a.fear);
      var grazing = onPast && a.hunger < 0.97 && a.whT <= 0 && a.pushT <= 0 && a.fear < 0.4 && hd > 40;
      if (grazing) { sp *= 0.12; a.hunger = Math.min(1, a.hunger + GRAZE_RATE * dt); }
      if (a.tired >= 1) a.lie = true; if (a.lie && (a.tired < 0.45 || a.fear > 0.7 || a.pushT > 0.5 && !a.calf)) a.lie = false;
      if (a.lie) sp = 0;
      if (al < 0.18 && !a.lie) sp *= al / 0.18;    // мелкие силы — стоят на месте
      var dvx = ax * sp, dvy = ay * sp, kk = Math.min(1, dt * 3.2);
      a.vx += (dvx - a.vx) * kk; a.vy += (dvy - a.vy) * kk;
      // река вне брода — уносит
      var ox = a.x, oy = a.y;
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (inRiver(l, a.x)) { if (inFord(l, a.y)) { a.x = ox + (a.x - ox) * 0.6; a.y += 6 * dt; } else { a.st = 'swept'; a.fear = 1; emit('swept', {}); return; } }
      if (cl && a.y > bt - 3) { a.st = 'fall'; a.fallT = 0; emit('fall', {}); return; }
      clampAnimal(a);
      var spd = len(a.vx, a.vy); if (spd > 2) a.face = Math.atan2(a.vy, a.vx);
      // показатели
      a.hunger = Math.max(0, a.hunger - HUNGER_RATE * dt * (spd > 5 ? 1.1 : 0.8));
      if (spd > 5) a.tired = Math.min(1, a.tired + TIRE_RATE * dt * (spd / WALK) * (a.calf ? 2 : 1) * (1 + snow * 0.8));
      else a.tired = Math.max(0, a.tired - (onWater ? 0.11 : 0.025) * dt);
      if (onWater && spd < 8) a.tired = Math.max(0, a.tired - 0.04 * dt);
      var inShelter = l.shelters.length && inCircle(l.shelters[0], a.x, a.y, 10);
      if (S.night > 0.5 && !inShelter && hd > TORCH_R) a.fear = Math.min(1, a.fear + 0.02 * dt);
      if (snow > 0.3 && a.calmT <= 0) a.fear = Math.min(0.7, a.fear + 0.018 * snow * dt);
      if (a.calmT > 0) { a.calmT -= dt; a.fear = Math.max(0, a.fear - 1.3 * dt); }
      a.fear = Math.max(0, a.fear - (inShelter ? 0.3 : 0.11) * dt);
      a.grazing = grazing; a.onWater = onWater; a.spd = spd;
    }

    // ---------- Ночь ----------
    function updNight(dt, l, C) {
      if (!l.night || S.nightDone) { S.night = Math.max(0, S.night - dt / 8); return; }
      if (!S.nightOn && C && (C.x > l.night || S.hero.x > l.night + 300)) { S.nightOn = true; S.nightT = 0; emit('dusk', {}); }
      if (!S.nightOn) return;
      S.nightT += dt; S.night = Math.min(1, S.nightT / 12);
      var sh = l.shelters[0], act = active(), inside = act.filter(function (a) { return inCircle(sh, a.x, a.y, 10); }).length;
      S.inShelter = inside; S.shelterNeed = Math.ceil(act.length * SHELTER_PART);
      if (S.night > 0.6 && inCircle(sh, S.hero.x, S.hero.y, 6) && inside >= S.shelterNeed) { S.sleepT += dt; if (S.sleepT >= SLEEP_NEED) { S.sleeping = 3; emit('sleep', {}); } }
      else S.sleepT = Math.max(0, S.sleepT - dt);
      if (S.nightT > NIGHT_MAX) dawn();
    }
    function dawn() {
      var l = L(); S.nightOn = false; S.nightDone = true; S.sleepT = 0; S.sleeping = 0; S.preds = [];
      S.herd.forEach(function (a) { if (a.st === 'ok' || a.st === 'carried') { a.tired = 0; a.fear = 0; a.lie = false; a.hunger = Math.max(0.35, a.hunger - 0.15); } });
      if (!S.calfBorn) {
        S.calfBorn = true; var sh = l.shelters[0], c = animal(sh[0] + 10, sh[1] + 8, true); c.hunger = 1; c.tired = 0; S.herd.push(c); S.totalEver++; emit('calf', {});
      }
      emit('dawn', {}); checkpoint(Math.max(S.cp.x, (S.C ? S.C.x : S.hero.x)));
    }

    // ---------- Камнепад, лавина ----------
    function updHazards(dt, l, C) {
      var h = S.hero;
      l.falls.forEach(function (z, i) {
        var f = S.fallZ[i], occ = (h.x > z[0] && h.x < z[1]) || S.herd.some(function (a) { return a.st === 'ok' && a.x > z[0] && a.x < z[1]; });
        f.t -= dt;
        if (f.st === 'idle' && occ && f.t <= 0) {
          f.st = 'warn'; f.t = 2; f.spots = [];
          var pool = S.herd.filter(function (a) { return a.st === 'ok' && a.x > z[0] && a.x < z[1]; });
          var n = 2 + Math.floor(rng() * 3);
          for (var k = 0; k < n; k++) {
            var base = pool.length && rng() < 0.35 ? pool[Math.floor(rng() * pool.length)] : null;
            var x = base ? base.x + (rng() - 0.5) * 60 : z[0] + rng() * (z[1] - z[0]);
            var y = base ? base.y + (rng() - 0.5) * 60 : topY(l, x) + 20 + rng() * (botY(l, x) - topY(l, x) - 40);
            f.spots.push([x, y, 24]);
          }
          emit('rumble', {});
        } else if (f.st === 'warn' && f.t <= 0) {
          f.st = 'idle'; f.t = 5 + rng() * 3;
          f.spots.forEach(function (sp) {
            S.rocksFall.push({ x: sp[0], y: sp[1], t: 0 });
            S.herd.forEach(function (a) {
              if (a.st !== 'ok') return; var d = len(a.x - sp[0], a.y - sp[1]);
              if (d < sp[2]) { if (!a.inj) emit('hurt', {}); a.inj = true; a.fear = 1; a.fx = sp[0]; a.fy = sp[1]; }
              else if (d < 130) { a.fear = Math.min(1, a.fear + 0.55); a.fx = sp[0]; a.fy = sp[1]; }
            });
            if (len(h.x - sp[0], h.y - sp[1]) < sp[2]) h.stun = 1;
          });
          f.spots = []; emit('rocks', {});
        } else if (f.st === 'idle' && !occ) f.t = Math.max(f.t, 1.2);
      });
      S.rocksFall = S.rocksFall.filter(function (r) { r.t += dt; return r.t < 4; });
      var av = S.aval, z2 = l.aval;
      if (av) {
        av.cool -= dt;
        if (av.st === 'idle' && av.cool <= 0 && C && C.x > z2[0] - 160 && C.x < z2[1]) { av.st = 'warn'; av.t = 3.2; emit('avalwarn', {}); }
        else if (av.st === 'warn') { av.t -= dt; if (av.t <= 0) { av.st = 'run'; av.front = 0; emit('aval', {}); } }
        else if (av.st === 'run') {
          av.front += dt / 2.2;
          S.herd.forEach(function (a) {
            if (a.st !== 'ok' || a.x < z2[0] || a.x > z2[1]) return;
            var t = topY(l, a.x), b = botY(l, a.x), fy = t + (b - t) * av.front;
            if (a.y < fy + 6) { a.y = Math.min(b - 10, fy + 6); a.inj = true; a.fear = 1; a.fx = a.x; a.fy = t; a.hit = (a.hit || 0) + 1; if (a.hit === 1) emit('hurt', {}); }
          });
          if (h.x > z2[0] && h.x < z2[1]) { var ht = topY(l, h.x), hb = botY(l, h.x), hy = ht + (hb - ht) * av.front; if (h.y < hy) { h.y = Math.min(hb - 12, hy + 4); h.stun = 0.8; } }
          if (av.front >= 1) { av.st = 'idle'; av.cool = 18; S.herd.forEach(function (a) { a.hit = 0; }); }
        }
      }
    }

    // ---------- Хищники ----------
    function updPreds(dt, l, C) {
      var h = S.hero;
      if (S.nightOn && S.night > 0.5 && C && l.pred) {
        S.predT -= dt;
        var maxP = l.pred === 'lynx' ? 2 : (S.lv >= 4 ? 3 : 2);
        if (S.predT <= 0 && S.preds.length < maxP) {
          S.predT = 8 + rng() * 5;
          var side = rng() < 0.5 ? -1 : 1, x = Math.max(40, Math.min(l.len - 40, C.x + side * (300 + rng() * 160)));
          var y = rng() < 0.5 ? topY(l, x) + 14 : botY(l, x) - 14;
          S.preds.push({ x: x, y: y, kind: l.pred, st: 'stalk', tgt: null, t: 0, vx: 0, vy: 0 });
          emit('howl', { kind: l.pred });
        }
      }
      var sh = l.shelters[0];
      S.preds.forEach(function (p) {
        p.t += dt; var tr = h.waveT > 0 ? WAVE_R : TORCH_R, dh = len(p.x - h.x, p.y - h.y);
        if (p.st !== 'flee' && dh < tr && S.night > 0.3) {
          if (p.st === 'hold') { var v = byId(p.tgt); if (v && v.st === 'seized') { v.st = 'ok'; v.inj = true; v.fear = 1; v.fx = p.x; v.fy = p.y; emit('saved', {}); } }
          p.st = 'flee'; emit('scared', {});
        }
        if (p.st === 'stalk') {
          var best = null, bd = 1e9;
          S.herd.forEach(function (a) {
            if (a.st !== 'ok' || (sh && inCircle(sh, a.x, a.y, 10))) return;
            var d = len(a.x - p.x, a.y - p.y) - (C ? len(a.x - C.x, a.y - C.y) * 1.5 : 0) + len(a.x - h.x, a.y - h.y) * -0.3;
            if (d < bd) { bd = d; best = a; }
          });
          if (!best) { p.st = 'flee'; return; }
          p.tgt = best.id; var dx = best.x - p.x, dy = best.y - p.y, d = len(dx, dy) || 1, sp = p.kind === 'lynx' ? 74 : 62;
          // обходит пастуха по дуге
          var ax = dx / d, ay = dy / d; if (dh < 170) { ax += (p.x - h.x) / dh * 0.9; ay += (p.y - h.y) / dh * 0.9; }
          var al = len(ax, ay) || 1; p.vx = ax / al * sp; p.vy = ay / al * sp; p.x += p.vx * dt; p.y += p.vy * dt;
          if (d < 12) { p.st = 'hold'; best.st = 'seized'; best.seizeT = 2.8; best.vx = best.vy = 0; emit('seize', {}); }
        } else if (p.st === 'hold') {
          var v2 = byId(p.tgt); if (!v2 || v2.st !== 'seized') { p.st = 'flee'; return; } p.x = v2.x - 8; p.y = v2.y - 4;
        } else if (p.st === 'flee') {
          var fx = p.x - h.x, fy = p.y - h.y, fl = len(fx, fy) || 1; p.vx = fx / fl * 130; p.vy = fy / fl * 130; p.x += p.vx * dt; p.y += p.vy * dt;
          if (fl > 560) p.gone = true;
        }
        S.herd.forEach(function (a) { if (a.st !== 'ok') return; var d2 = len(a.x - p.x, a.y - p.y); if (d2 < 150 && p.st !== 'flee') { a.fear = Math.min(1, a.fear + 0.9 * dt); a.fx = p.x; a.fy = p.y; } });
      });
      S.preds = S.preds.filter(function (p) { return !p.gone; });
      if (!S.nightOn && S.preds.length) S.preds.forEach(function (p) { if (p.st !== 'hold') p.st = 'flee'; });
    }

    // ---------- Конец перевала ----------
    function finishLevel(l) {
      var act = active(), got = act.filter(function (a) { return a.st !== 'seized' && a.x > l.end - 900; });
      var left = act.length - got.length;
      got.forEach(function (a) { if (a.st === 'carried') a.st = 'ok'; });
      S.hero.carry = null;
      var k = got.length / Math.max(1, S.levelStart + countAdded()), st = stars(Math.min(1, got.length / Math.max(1, S.levelStart)));
      S.delivered[S.lv] = got.length; S.starsLv[S.lv] = st; S.score += got.length * 10 + st * 50;
      S.done = { got: got.length, left: left, stars: st, lv: S.lv };
      S.nextHerd = got.map(function (a) { return { calf: a.calf, hunger: Math.max(0.7, a.hunger), tired: 0.1 }; });
      S.phase = 'done'; S.doneT = 4.5; emit('pass', S.done);
      if (S.lv === LEVELS.length - 1) { S.phase = 'won'; S.won = true; S.finalStars = stars(got.length / S.totalEver); emit('win', { got: got.length, total: S.totalEver, stars: S.finalStars }); }
    }
    function countAdded() { return 0; }
    function nextLevel() {
      var lv = S.lv + 1; newLevel(lv, S.nextHerd);
      checkpoint(L().start + 80);
    }

    var api = {
      start: start, update: update,
      state: function () { return S; },
      setMove: function (x, y) { moveIn.x = x || 0; moveIn.y = y || 0; if (x || y) target = null; },
      moveTo: function (x, y) { target = { x: x, y: y }; },
      clearTarget: function () { target = null; },
      target: function () { return target; },
      whistle: whistle, shout: shout, staff: staff,
      active: active, level: function () { return L(); },
      snapshot: function () { return JSON.parse(JSON.stringify(S.cp)); },
      restore: function (cp) { restoreCp(cp); },
      gotoLevel: function (lv) { var list = liveHerd().map(function (a) { return { calf: a.calf }; }); newLevel(lv, list); S.cp = makeCp(L().start + 80); }
    };
    return api;
  }

  O.logic = { LEVELS: LEVELS, WH: WH, topY: topY, botY: botY, isCliff: isCliff, inRiver: inRiver, inFord: inFord, inCircle: inCircle, snowAt: snowAt, stars: stars,
    START_HERD: START_HERD, WHISTLE_R: WHISTLE_R, SHOUT_R: SHOUT_R, BELL_R: BELL_R, TORCH_R: TORCH_R, WAVE_R: WAVE_R, mulberry32: mulberry32 };
  O.Game = function (o) { return Game(o); };
})(typeof window !== 'undefined' ? window : globalThis);
