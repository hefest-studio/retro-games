/* ВОЛОК · логика игры (чистая, без DOM и канвы — тестируется в Node).
   Изба-мастерская на колёсах идёт сбоку через тундру, холмы, реку и берег, на берегу
   переделывается в судно (поплавки + гребное колесо + колокол для погружения) и уходит
   через шторм и льды к зимовью. Подмастерье бегает внутри по трём этажам:
   топка, бункер, клапан, рычаг хода (низ), верстак, балласт, лебёдка (середина), парус (крыша).
   Мир — одна ось X (px). mx — мировая X носа машины, корма = mx - MW.
   API: VOLOK.Game({ rng, onEvent, snapshot }) → { state(), update(dt), setInput(dx,dy,held), goTo(id), snapshot(), restore(s) } */
(function (global) {
  'use strict';
  var V = global.VOLOK = global.VOLOK || {};

  // ---------- Константы ----------
  var MW = 380, FH = 58;                    // длина машины, высота этажа
  var REACH = 24, HERO_V = 82, LADDER_V = 66;
  var A = 22, G = 30, MODE_K = [0, 0.5, 1], K_LAND = 0.35, K_WATER = 0.45, C2 = 0.0015;
  var P_MAX = 100, OVER_T = 2.5, BOOST_P = 85;
  var CAP = { bunker: 8 };
  var FUEL = { wood: 22, coal: 34, scrap: 14 };

  // Станции внутри: f — этаж (0 низ, 1 середина, 2 крыша), x — от кормы
  var ST = {
    hatch:   { f: 0, x: 34 },  bunker: { f: 0, x: 84 }, furnace: { f: 0, x: 178 },
    valve:   { f: 0, x: 238 }, lever:  { f: 0, x: 336 },
    bench:   { f: 1, x: 66 },  ballast: { f: 1, x: 236 }, winch: { f: 1, x: 338 },
    sail:    { f: 2, x: 196 }
  };
  var FB = [[14, MW - 14], [14, MW - 14], [112, 300]];   // границы хода по этажам (чердак уже — под скатами)
  var LADDERS = [{ x: 128, a: 0, b: 1 }, { x: 288, a: 0, b: 1 }, { x: 264, a: 1, b: 2 }];
  var FIRE_SPOTS = ['furnace', 'bunker', 'bench', 'valve', 'winch'];

  // ---------- Путь ----------
  var SEC = [0, 9000, 19000, 28000, 36000, 46000, 56500];   // границы 6 участков
  var SHORE_X = 31000, FIN_X = 55600;
  var HILL = { x: 12400, ramp: 300, rs: 0.25, steep: 320, ss: 0.78, top: 600, ds: 0.2 };
  HILL.rise = HILL.ramp * HILL.rs + HILL.steep * HILL.ss;
  HILL.end = HILL.x + HILL.ramp + HILL.steep + HILL.top + HILL.rise / HILL.ds;
  var OB = [
    { id: 'barrier', kind: 'gate', x: 6000, need: 100, sec: 0 },
    { id: 'hill', kind: 'hill', x: HILL.x, x2: HILL.x + HILL.ramp + HILL.steep + 40, sec: 1 },
    { id: 'rubble', kind: 'gate', x: 16800, need: 140, sec: 1, steamOnly: true },
    { id: 'ford', kind: 'ford', x: 23000, x2: 23700, sec: 2 },
    { id: 'shore', kind: 'shore', x: SHORE_X, sec: 3 },
    { id: 'storm', kind: 'storm', x: 38200, x2: 43600, sec: 4 },
    { id: 'ice', kind: 'ice', x: 48000, x2: 52900, sheets: [[48000, 49000], [49900, 51000], [51900, 52900]], sec: 5 }
  ];
  var OBI = {}; OB.forEach(function (o) { OBI[o.id] = o; });
  // Поломки по пути (трубка лопнула → течь пара): X носа, где случаются
  var BREAKS = [14800, 21000, 26200, 34200, 47100, 54200];

  function secOf(x) { for (var i = SEC.length - 2; i >= 0; i--) if (x >= SEC[i]) return i; return 0; }

  // Рельеф суши: высота (вверх +) по X. Мягкие волны + холм + брод + спуск к берегу.
  function hillH(x) {
    var h = HILL, d = x - h.x; if (d <= 0) return 0;
    if (d < h.ramp) return d * h.rs; d -= h.ramp; var y = h.ramp * h.rs;
    if (d < h.steep) return y + d * h.ss; d -= h.steep; y += h.steep * h.ss;
    if (d < h.top) return y; d -= h.top;
    return Math.max(0, y - d * h.ds);
  }
  function fordH(x) { var o = OBI.ford; if (x < o.x - 260 || x > o.x2 + 260) return 0;
    if (x < o.x) return -(x - (o.x - 260)) * 0.15; if (x > o.x2) return -((o.x2 + 260) - x) * 0.15; return -39; }
  function nearFlat(x) { // у ворот/брода/берега рельеф выравнивается
    var k = 1; [OBI.barrier.x, OBI.rubble.x].forEach(function (c) { var d = Math.abs(x - c); if (d < 700) k = Math.min(k, d / 700); });
    if (x > SHORE_X - 1400) k = Math.min(k, Math.max(0, (SHORE_X - x) / 1400));
    if (x > HILL.x - 500 && x < HILL.end + 300) k = Math.min(k, 0.25);
    return k;
  }
  function groundH(x) {
    if (x > SHORE_X + 40) return -60 - Math.min(200, (x - SHORE_X) * 0.5);   // морское дно у берега
    var base = 18 * Math.sin(x / 900) + 10 * Math.sin(x / 370 + 1.3) + 6 * Math.sin(x / 151 + 0.4);
    var h = base * nearFlat(x) + hillH(x) + fordH(x);
    if (x > SHORE_X - 80) h -= (x - (SHORE_X - 80)) * 0.6;                  // кромка берега
    return h;
  }
  var SEA = -30;                      // уровень моря (высота)
  // Окружение по X: время суток 0..1 (0 рассвет, .25 день, .5 закат, .75 ночь), погода, ветер
  var ENV = [
    { tod0: 0.02, tod1: 0.2, weather: 'clear', wind: 0.25 },
    { tod0: 0.22, tod1: 0.32, weather: 'breeze', wind: 0.6 },
    { tod0: 0.36, tod1: 0.48, weather: 'rain', wind: -0.2 },
    { tod0: 0.5, tod1: 0.72, weather: 'aurora', wind: 0.55 },
    { tod0: 0.28, tod1: 0.34, weather: 'storm', wind: 0.35 },
    { tod0: 0.76, tod1: 1.02, weather: 'snow', wind: 0.3 }
  ];
  function env(x, t) {
    var s = secOf(x), e = ENV[s], k = Math.max(0, Math.min(1, (x - SEC[s]) / (SEC[s + 1] - SEC[s])));
    var wind = e.wind, st = OBI.storm, storm = 0;
    if (s === 4) { // шторм нарастает за 700 px до зоны и стихает после
      if (x > st.x - 700 && x < st.x2 + 500) storm = Math.min(1, (x - (st.x - 700)) / 700, (st.x2 + 500 - x) / 500);
      wind = wind * (1 - storm) + (-0.95 - 0.25 * Math.sin((t || 0) * 0.9)) * storm;
    }
    if (s === 2) wind = -0.2 + 0.25 * Math.sin(x / 1300);
    return { sec: s, k: k, tod: (e.tod0 + (e.tod1 - e.tod0) * k) % 1, weather: e.weather, wind: wind, storm: storm };
  }

  // Кучи топлива по пути (детерминированно)
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function makePiles() {
    var out = [], x = 900, i = 0;
    var TYPES = [['wood', 'scrap', 'wood'], ['wood', 'coal'], ['wood', 'wood', 'coal'], ['wood', 'scrap'], ['wood', 'coal'], ['coal', 'wood']];
    while (x < FIN_X - 800) {
      var s = secOf(x), bad = false;
      OB.forEach(function (o) { if (o.kind === 'storm') return; var a = o.x - 500, b = (o.x2 || o.x) + 200; if (o.kind === 'ice') { b = o.x2; } if (x > a && x < b) bad = true; });
      if (Math.abs(x - SHORE_X) < 900) bad = true;
      if (!bad) { var tl = TYPES[s]; out.push({ x: x, type: tl[(hash(i) * tl.length) | 0], n: 2 + ((hash(i + 50) * 2) | 0), water: x > SHORE_X }); }
      x += (x > SHORE_X ? 900 : 1050) + hash(i + 99) * 500; i++;
    }
    // дрова у берега — на поплавки (их хватит с запасом)
    out.push({ x: SHORE_X - MW + 40, type: 'wood', n: 3, water: false, shore: true });
    out.push({ x: SHORE_X - MW - 240, type: 'wood', n: 2, water: false, shore: true });
    out.sort(function (a, b) { return a.x - b.x; });
    return out;
  }

  // ---------- Игра ----------
  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var S;

    function fresh() {
      return {
        t: 0, mx: MW + 200, v: 0, water: false, depth: 0, dive: false, mode: 0,
        P: 45, F: 50, overT: 0, hull: 100, air: 100, sailUp: false, mastBroken: false,
        bunker: ['wood', 'wood', 'scrap'], fires: [], leaks: [],
        hero: { x: 200, lv: 0, lad: -1, carry: null, face: 1, work: 0, workOn: null, auto: null },
        prog: { barrier: 0, rubble: 0, floatsWood: 0, floats: 0, launch: 0 },
        solved: {}, breaks: {}, taken: {}, sec: 0, score: 0, picked: 0,
        phase: 'play', finT: 0, bumpT: 0, splashT: 0, mastT: 0, stormLeakT: 0, fireSpreadT: 0,
        lastBump: null, hint: null, tip: null, wrecks: 0, held: false, prevHeld: false,
        inDx: 0, inDy: 0, cp: null, time: 0, wind: 0, env: null, ver: 0
      };
    }
    var PILES = makePiles();

    // ---------- Сохранение (чекпоинт) ----------
    function snapshot() {
      return JSON.parse(JSON.stringify({
        mx: S.mx, water: S.water, P: Math.max(S.P, 40), F: Math.max(S.F, 40), hull: Math.max(S.hull, 60),
        bunker: S.bunker, prog: S.prog, solved: S.solved, breaks: S.breaks, taken: S.taken,
        score: S.score, picked: S.picked, time: S.time, wrecks: S.wrecks, mastBroken: false, carry: S.hero.carry === 'wood' ? 'wood' : null
      }));
    }
    function restore(sn) {
      S = fresh(); if (!sn) return;
      ['mx', 'water', 'P', 'F', 'hull', 'bunker', 'prog', 'solved', 'breaks', 'taken', 'score', 'picked', 'time', 'wrecks'].forEach(function (k) { if (sn[k] != null) S[k] = JSON.parse(JSON.stringify(sn[k])); });
      S.hero.carry = sn.carry || null;
      if (S.water && S.mx >= OBI.ice.x && S.mx < OBI.ice.x2) S.mx = OBI.ice.x - 200;
      S.sec = secOf(S.mx); S.cp = snapshot(); S.mode = 0; S.v = 0;
    }
    function checkpoint(why) { S.cp = snapshot(); S.cp.why = why; emit('checkpoint', { why: why, sec: secOf(S.mx), save: S.cp }); }

    // ---------- Вспомогательное ----------
    function rear() { return S.mx - MW; }
    function stationAt(id) { var s = ST[id]; return { f: s.f, x: s.x }; }
    function stationOn(id) { // станция в огне не работает
      for (var i = 0; i < S.fires.length; i++) if (S.fires[i].at === id) return false;
      if (id === 'ballast' && !S.water) return false;
      return true;
    }
    function activeGate() { // ворота/завал/берег перед носом
      for (var i = 0; i < OB.length; i++) { var o = OB[i];
        if ((o.kind === 'gate' && S.prog[o.id] < o.need) || (o.kind === 'shore' && !S.water))
          if (S.mx >= o.x - 100 && S.mx <= o.x + 4) return o; }
      return null;
    }
    function blockX() { // ближайшая преграда впереди, через которую не проехать
      var bx = Infinity;
      OB.forEach(function (o) {
        if ((o.kind === 'gate' && S.prog[o.id] < o.need) || (o.kind === 'shore' && !S.water)) if (o.x >= S.mx - 2) bx = Math.min(bx, o.x);
      });
      if (S.water && S.depth < 0.8) OBI.ice.sheets.forEach(function (sh) { if (sh[0] >= S.mx - 2) bx = Math.min(bx, sh[0]); });
      return bx;
    }
    function underIce() { var x = S.mx, r = rear(); return S.water && OBI.ice.sheets.some(function (sh) { return r < sh[1] && x > sh[0]; }); }
    function pileNear() { // куча у люка, если машина почти стоит
      if (Math.abs(S.v) > (S.water ? 16 : 12) || S.depth > 0.2) return null;
      var hx = rear() + ST.hatch.x;
      for (var i = 0; i < PILES.length; i++) { var p = PILES[i], left = p.n - (S.taken[i] || 0);
        if (left > 0 && Math.abs(p.x - hx) < 70) return { i: i, p: p, left: left }; }
      return null;
    }
    function addLeak() {
      var spots = [{ f: 0, x: 210 }, { f: 0, x: 120 }, { f: 1, x: 250 }, { f: 1, x: 110 }, { f: 0, x: 300 }, { f: 1, x: 300 }];
      var s = spots[(rng() * spots.length) | 0];
      if (S.leaks.some(function (l) { return l.f === s.f && Math.abs(l.x - s.x) < 30; })) return;
      S.leaks.push({ f: s.f, x: s.x, t: 0 }); emit('leak', s);
    }
    function addFire(at) {
      if (S.fires.length >= 3) return;
      if (!at) { var free = FIRE_SPOTS.filter(function (id) { return !S.fires.some(function (f) { return f.at === id; }); }); at = free[(rng() * free.length) | 0]; }
      if (!at || S.fires.some(function (f) { return f.at === at; })) return;
      var s = ST[at]; S.fires.push({ at: at, f: s.f, x: s.x + 14, t: 1.4 }); S.fireSpreadT = 0; emit('fire', { at: at });
    }

    // ---------- Цели действия у героя ----------
    // Возвращает {kind, id, hold} — что сделает «действие» в этой точке
    function targetAt(h) {
      if (h.lad >= 0 && Math.abs(h.lv - Math.round(h.lv)) > 0.05) return null;
      var f = Math.round(h.lv), best = null, bd = REACH + 1;
      S.fires.forEach(function (fi) { var d = Math.abs(fi.x - h.x); if (fi.f === f && d < bd + 6) { bd = d - 6; best = { kind: 'fire', ref: fi, hold: true }; } });
      if (best) return best;
      if (h.carry === 'patch') S.leaks.forEach(function (l) { var d = Math.abs(l.x - h.x); if (l.f === f && d < bd + 6) { bd = d - 6; best = { kind: 'leak', ref: l, hold: true }; } });
      if (best) return best;
      for (var id in ST) { var s = ST[id], d = Math.abs(s.x - h.x);
        if (s.f === f && d < bd && stationOn(id)) { var k = stationKind(id, h); if (k) { bd = d; best = k; } } }
      return best;
    }
    function stationKind(id, h) {
      var c = h.carry;
      switch (id) {
        case 'hatch': return !c ? { kind: 'hatch', id: id, idle: !pileNear() } : null;
        case 'bunker': if (c && FUEL[c]) return S.bunker.length < CAP.bunker ? { kind: 'stow', id: id } : null;
          return (!c && S.bunker.length) ? { kind: 'unstow', id: id } : null;
        case 'furnace': return (c && FUEL[c]) ? { kind: 'feed', id: id } : { kind: 'furnace', id: id, idle: true };
        case 'valve': return { kind: 'vent', id: id, hold: true };
        case 'lever': return { kind: 'lever', id: id };
        case 'bench':
          if (c === 'wood' && S.mx >= SHORE_X - 200 && !S.water && S.prog.floatsWood < 2) return { kind: 'wood', id: id };
          if (!c && S.mx >= SHORE_X - 200 && !S.water && S.prog.floatsWood >= 2 && S.prog.floats < 100) return { kind: 'build', id: id, hold: true };
          return !c ? { kind: 'craft', id: id, hold: true } : null;
        case 'winch': return { kind: 'winch', id: id, hold: true };
        case 'ballast': return { kind: 'ballast', id: id };
        case 'sail': if (S.mastBroken) return c === 'patch' ? { kind: 'mast', id: id, hold: true } : null;
          return { kind: 'sail', id: id };
      }
      return null;
    }
    function winchTask() { // что тянет лебёдка сейчас
      var g = activeGate(); if (!g) return null;
      if (g.kind === 'gate') return g;
      if (g.kind === 'shore' && S.prog.floats >= 100) return g;
      return null;
    }

    function doAction(tg, dt, edge) {
      var h = S.hero;
      switch (tg.kind) {
        case 'fire': tg.ref.t -= dt; h.work = 1 - tg.ref.t / 1.4; if (tg.ref.t <= 0) { S.fires.splice(S.fires.indexOf(tg.ref), 1); emit('extinguish', {}); h.work = 0; } return true;
        case 'leak': tg.ref.t += dt; h.work = tg.ref.t / 0.8; if (tg.ref.t >= 0.8) { S.leaks.splice(S.leaks.indexOf(tg.ref), 1); h.carry = null; emit('patched', {}); h.work = 0; S.score += 10; } return true;
        case 'vent': if (S.P > 0) { S.P = Math.max(0, S.P - 22 * dt); emit('vent', {}); } return S.P > 0;
        case 'winch': {
          var w = winchTask(); if (!w) { if (edge) emit('nope', { at: 'winch' }); return false; }
          var steam = S.P >= 30, key = w.kind === 'shore' ? 'launch' : w.id;
          if (w.steamOnly && !steam) { if (edge) emit('nope', { at: 'winch' }); return false; }
          S.prog[key] = Math.min(w.need || 100, S.prog[key] + (steam ? 22 : 6) * dt);
          if (steam) S.P -= 4 * dt;
          h.work = S.prog[key] / (w.need || 100); emit('crank', { steam: steam });
          if (S.prog[key] >= (w.need || 100)) {
            h.work = 0;
            if (w.kind === 'shore') { S.water = true; S.mode = 0; emit('launch', {}); S.score += 100; checkpoint('launch'); }
            else { emit('gateOpen', { id: w.id }); S.score += 100; checkpoint(w.id); }
            return false;
          }
          return true;
        }
        case 'craft': h.work += dt / 1.6; if (h.work >= 1) { h.work = 0; h.carry = 'patch'; emit('crafted', {}); return false; } return true;
        case 'build': S.prog.floats = Math.min(100, S.prog.floats + 100 * dt / 3); h.work = S.prog.floats / 100;
          if (S.prog.floats >= 100) { h.work = 0; emit('built', {}); return false; } return true;
        case 'mast': h.work += dt / 1.2; if (h.work >= 1) { h.work = 0; h.carry = null; S.mastBroken = false; emit('mastFixed', {}); return false; } return true;
      }
      if (!edge) return false;
      switch (tg.kind) {
        case 'hatch': { var pn = pileNear(); if (!pn) { emit('nope', { at: 'hatch' }); return false; }
          S.taken[pn.i] = (S.taken[pn.i] || 0) + 1; h.carry = pn.p.type; S.picked++; S.score += 5; emit('pick', { type: pn.p.type }); return false; }
        case 'stow': S.bunker.push(h.carry); h.carry = null; emit('stow', {}); return false;
        case 'unstow': h.carry = S.bunker.pop(); emit('unstow', {}); return false;
        case 'feed': S.F = Math.min(100, S.F + FUEL[h.carry]); emit('feed', { type: h.carry }); h.carry = null; return false;
        case 'lever': S.mode = (S.mode + 1) % 3; emit('lever', { mode: S.mode }); return false;
        case 'wood': S.prog.floatsWood++; h.carry = null; emit('stow', {}); return false;
        case 'ballast':
          if (S.dive && underIce()) { emit('nope', { at: 'ballast' }); return false; }
          S.dive = !S.dive; if (S.dive && S.sailUp) { S.sailUp = false; emit('sail', { up: false }); } emit('ballast', { dive: S.dive }); return false;
        case 'sail': if (S.depth > 0.3) { emit('nope', { at: 'sail' }); return false; } S.sailUp = !S.sailUp; emit('sail', { up: S.sailUp }); return false;
      }
      return false;
    }

    // ---------- Движение героя ----------
    function moveHero(dt, dx, dy) {
      var h = S.hero;
      if (h.lad >= 0) {
        var L = LADDERS[h.lad];
        if (dy) { h.lv = Math.max(L.a, Math.min(L.b, h.lv - dy * LADDER_V / FH * dt)); }
        var atEnd = h.lv === L.a || h.lv === L.b;
        if (dx && atEnd) h.lad = -1; else return;
      }
      if (dy) {
        for (var i = 0; i < LADDERS.length; i++) { var l = LADDERS[i];
          if (Math.abs(h.x - l.x) < 10 && ((dy < 0 && l.a === h.lv) || (dy > 0 && l.b === h.lv))) { h.lad = i; h.x = l.x; return; } }
      }
      if (dx) { var fb = FB[h.lv]; h.x = Math.max(fb[0], Math.min(fb[1], h.x + dx * HERO_V * dt)); h.face = dx; }
    }
    // Маршрут к точке {f,x}: {dx,dy} как клавиши (для тапа и бота)
    function route(h, tf, tx) {
      var f = h.lv;
      if (h.lad >= 0) {
        var L = LADDERS[h.lad], onEnd = f === L.a || f === L.b;
        if (!onEnd) return { dx: 0, dy: tf > f ? -1 : 1 };
        if (tf > f && f < L.b) return { dx: 0, dy: -1 };
        if (tf < f && f > L.a) return { dx: 0, dy: 1 };
        if (f === tf) return { dx: Math.sign(tx - h.x) || 1, dy: 0 };
        // слезть и идти к следующей лестнице
        var nx = null; LADDERS.forEach(function (l) { if ((tf > f && l.a === f) || (tf < f && l.b === f)) nx = l; });
        return { dx: nx ? (Math.sign(nx.x - h.x) || 1) : 1, dy: 0 };
      }
      if (f === tf) { var d = tx - h.x; return { dx: Math.abs(d) < 3 ? 0 : Math.sign(d), dy: 0, here: Math.abs(d) < 6 }; }
      var up = tf > f, best = null, bc = 1e9;
      LADDERS.forEach(function (l, i) { if ((up && l.a === f) || (!up && l.b === f)) { var c = Math.abs(h.x - l.x) + Math.abs(l.x - tx); if (c < bc) { bc = c; best = l; } } });
      if (!best) return { dx: 0, dy: 0 };
      var dd = best.x - h.x;
      if (Math.abs(dd) < 4) return { dx: 0, dy: up ? -1 : 1 };
      return { dx: Math.sign(dd), dy: 0 };
    }

    // ---------- Шаг ----------
    function update(dt) {
      if (S.phase === 'won') return;
      S.t += dt; S.time += dt;
      var h = S.hero;
      if (S.phase === 'finale') { S.finT += dt; S.v *= Math.pow(0.4, dt); S.mx += S.v * dt; if (S.finT > 7) { S.phase = 'won'; emit('win', {}); } return; }

      // ввод: авто-путь (тап) или клавиши
      var dx = S.inDx, dy = S.inDy, held = S.held;
      if (h.auto) {
        if (dx || dy) h.auto = null;
        else {
          var a = h.auto, r = route(h, a.f, a.x);
          if (r.here) { dx = 0; dy = 0; held = true; if (!a.started) { a.started = true; S.prevHeld = false; } }
          else { dx = r.dx; dy = r.dy; held = false; }
        }
      }
      moveHero(dt, dx, dy);
      var tg = targetAt(h), edge = held && !S.prevHeld;
      S.hint = tg;
      if (held && tg) {
        var cont = doAction(tg, dt, edge);
        if (tg.kind === 'vent' && h.auto && S.P < 65) cont = false;
        if (h.auto && h.auto.started && !cont) h.auto = null;
      } else { if (h.auto && h.auto.started) h.auto = null; h.work = 0; }
      S.prevHeld = held;

      // ---- Котёл ----
      var e = S.env = env(S.mx, S.t); S.wind = e.wind;
      var sub = S.depth > 0.6;
      var burn = S.F > 0 ? (S.mode > 0 ? 0.7 : 0.35) : 0;
      S.F = Math.max(0, S.F - burn * dt);
      var heat = S.F > 0 ? 7 * Math.min(1, S.F / 50) : 0;
      var use = [0.6, 1.8, 3.2][S.mode] + S.leaks.length * 2.5 + 0.06 * S.P;
      S.P = Math.max(0, Math.min(110, S.P + (heat - use) * dt));
      if (S.P >= P_MAX) { S.overT += dt; if (S.overT > OVER_T) { S.overT = 0; S.P = 82; addFire('furnace'); emit('overheat', {}); } }
      else S.overT = Math.max(0, S.overT - dt * 0.5);

      // ---- Пожары и корпус ----
      if (S.fires.length) {
        S.hull -= 1.5 * S.fires.length * dt; S.fireSpreadT += dt;
        if (S.fireSpreadT > 14) { S.fireSpreadT = 0; addFire(); }
      }
      // ---- Воздух под водой ----
      if (S.water) {
        if (sub) { S.air = Math.max(0, S.air - (S.F > 0 ? 1.4 : 0.8) * dt);
          if (S.air <= 0) { if (S.F > 0) emit('choke', {}); S.F = 0; S.hull -= 4 * dt; } }
        else S.air = Math.min(100, S.air + 25 * dt);
        var tgt = S.dive ? 1 : 0, ui = underIce();
        if (ui) tgt = Math.max(tgt, 0.85);                 // подо льдом не всплыть
        S.depth += Math.max(-0.4 * dt, Math.min(0.4 * dt, tgt - S.depth));
      }
      // ---- Ход ----
      var pf = Math.min(1, S.P / 60) * (S.P > BOOST_P ? 1.35 : 1);
      var drive = A * MODE_K[S.mode] * pf * (S.water ? (sub ? 0.7 : 0.8) : 1);
      var sailOk = S.sailUp && !S.mastBroken && !sub;
      var windF = (sailOk ? e.wind * (S.water ? 13 : 8) : 0) + (S.water && !sub ? e.wind * 2.5 : 0);
      var slope = S.water ? 0 : (groundH(S.mx - 40) - groundH(S.mx - 200)) / 160;
      var grav = -G * slope, K = S.water ? K_WATER : K_LAND;
      var o = OBI.ford; var inFord = !S.water && S.mx > o.x && rear() < o.x2;
      if (inFord) K += 0.25;
      var acc = drive + windF + grav - K * S.v - C2 * S.v * Math.abs(S.v);
      if (!S.water && S.mode === 0) { // тормоз
        var hold = G * 0.9;
        if (Math.abs(S.v) < 2 && Math.abs(grav + windF) < hold) { S.v = 0; acc = 0; }
        else acc -= Math.sign(S.v) * 35;
      } else if (S.water && S.mode === 0 && Math.abs(S.v) > 0.5) acc -= Math.sign(S.v) * 12;   // гребное колесо табанит
      var v0 = S.v; S.v += acc * dt;
      if (!S.water && S.mode === 0 && v0 !== 0 && Math.sign(S.v) !== Math.sign(v0)) S.v = 0;
      var nx = S.mx + S.v * dt, bx = blockX();
      if (nx > bx - 2) { // упёрлись: мягко встаём носом к преграде, сильный удар — отскок и урон
        var hit = S.v;
        nx = bx - 2; S.v = hit > 25 ? -6 : 0;
        if (hit > 6 && S.bumpT <= 0) { S.bumpT = 1; if (hit > 25) S.hull -= Math.min(10, (hit - 25) * 0.4); emit('bump', { v: hit }); }
      }
      S.bumpT -= dt;
      S.mx = Math.max(MW + 50, nx);
      if (inFord && Math.abs(S.v) > 30 && S.splashT <= 0) { S.splashT = 3; S.F = Math.max(0, S.F - 25); emit('splash', {}); addLeak(); }
      S.splashT -= dt;

      // ---- Шторм: парус рвёт мачту, волны дают течи ----
      if (e.storm > 0.6) {
        if (S.sailUp && !S.mastBroken) { S.mastT += dt; if (S.mastT > 3) { S.mastT = 0; S.mastBroken = true; S.sailUp = false; S.hull -= 8; emit('mast', {}); } }
        S.stormLeakT += dt; if (S.stormLeakT > 17) { S.stormLeakT = 0; if (S.leaks.length < 3) addLeak(); }
      } else S.mastT = 0;
      // ---- Поломки по пути ----
      BREAKS.forEach(function (bx2, i) { if (!S.breaks[i] && S.mx > bx2) { S.breaks[i] = 1; addLeak(); emit('break', {}); } });

      // ---- Авария → чекпоинт ----
      if (S.hull <= 0) { S.wrecks++; emit('wreck', {}); var w = S.wrecks, cp = S.cp; restore(cp); S.wrecks = w; S.cp = cp; return; }

      // ---- Участки и решённые препятствия ----
      var ns = secOf(S.mx);
      if (ns !== S.sec) { S.sec = ns; emit('section', { sec: ns }); checkpoint('sec' + ns); }
      OB.forEach(function (ob) {
        if (S.solved[ob.id]) return;
        var done = false;
        if (ob.kind === 'gate') done = S.prog[ob.id] >= ob.need && rear() > ob.x;
        else if (ob.kind === 'shore') done = S.water && rear() > ob.x + 100;
        else done = rear() > (ob.x2 || ob.x);
        if (done) { S.solved[ob.id] = 1; S.score += 50; emit('solved', { id: ob.id }); checkpoint(ob.id); }
      });
      if (S.mx >= FIN_X && S.phase === 'play') { S.phase = 'finale'; S.mode = 0; S.score += 500; emit('finale', {}); }
      S.ver++;
    }

    var api = {
      start: function () { if (opts.snapshot) restore(opts.snapshot); else { S = fresh(); S.cp = snapshot(); } return api; },
      state: function () { return S; },
      update: update,
      setInput: function (dx, dy, held) { S.inDx = dx || 0; S.inDy = dy || 0; S.held = !!held; },
      goTo: function (id) { var s = ST[id]; if (!s) return; S.hero.auto = { f: s.f, x: s.x, id: id, started: false }; },
      goToSpot: function (f, x) { S.hero.auto = { f: f, x: x, started: false }; },
      route: function (f, x) { return route(S.hero, f, x); },
      target: function () { return targetAt(S.hero); },
      snapshot: snapshot, restore: function (s) { restore(s); return api; },
      pileNear: pileNear, winchTask: winchTask, activeGate: activeGate, underIce: underIce, piles: PILES
    };
    return api;
  }

  V.logic = { FB: FB, MODE_K: MODE_K, MW: MW, FH: FH, REACH: REACH, ST: ST, LADDERS: LADDERS, SEC: SEC, OB: OB, OBI: OBI, HILL: HILL, SHORE_X: SHORE_X, FIN_X: FIN_X,
    SEA: SEA, FUEL: FUEL, BREAKS: BREAKS, groundH: groundH, env: env, secOf: secOf, makePiles: makePiles, CAP: CAP };
  V.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
