/* ВОЛОК · tests/bot.mjs — «человеческий» бот: проезжает весь путь, управляя только как игрок.
   Ввод — setInput(dx, dy, held) (клавиши ◀▶▲▼ и «действие»), как с клавиатуры. Без читов: состояние
   машины бот читает с приборов (давление, топка, корпус, воздух, ветер) и видит то же, что игрок на экране.
   - решения раз в 150–250 мс (реакция), между решениями держит прежние клавиши;
   - подход к станции — касание стрелки нужной длины (как человек отпускает клавишу), погрешность ±25 мс;
   - приоритеты: пожар → течь (заплатка с верстака) → перегрев (клапан) → топка → кучи топлива у люка
     → препятствия (лебёдка, брод, берег, шторм, льды) → режим хода и парус.
   opts: { react:[0.15,0.25], maxT=3600, from: snapshot, until: x (остановиться, когда нос дальше x), lazy=0 (шанс «зазеваться») } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playVolok(V, seed, opts = {}){
  const L = V.logic, ST = L.ST, OBI = L.OBI;
  const brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const maxT = opts.maxT || 3600, dt = 1 / 60, lazy = opts.lazy || 0;
  const ev = { fires: 0, wrecks: 0, leaks: 0, bumps: 0, splash: 0, mast: 0, overheat: 0, picks: 0, events: {}, solved: [], cps: 0, won: false };
  const game = V.Game({ rng: mulberry32(seed), snapshot: opts.from, onEvent: (t, d) => {
    ev.events[t] = (ev.events[t] || 0) + 1;
    if (t === 'fire') ev.fires++; else if (t === 'wreck') ev.wrecks++; else if (t === 'leak') ev.leaks++;
    else if (t === 'bump') ev.bumps++; else if (t === 'splash') ev.splash++; else if (t === 'mast') ev.mast++;
    else if (t === 'overheat') ev.overheat++; else if (t === 'pick') ev.picks++;
    else if (t === 'solved') ev.solved.push(d.id); else if (t === 'checkpoint') ev.cps++; else if (t === 'win') ev.won = true;
  } }).start();
  const S = game.state;
  let tm = 0, next = 0, release = 1e9, keys = { dx: 0, dy: 0, held: false }, task = null;

  const hatchW = () => S().mx - L.MW + ST.hatch.x;
  function pileAhead(){ // ближайшая куча впереди люка (видна на экране)
    const s = S(); let best = null;
    game.piles.forEach((p, i) => { const left = p.n - (s.taken[i] || 0); if (left <= 0) return; const d = p.x - hatchW(); if (d > -60 && d < 700 && (!best || d < best.d)) best = { d, p, i, left }; });
    return best;
  }
  // куда идти и что делать: {f, x, hold, edge}
  function want(){
    const s = S(), h = s.hero, e = s.env || L.env(s.mx, 0);
    const near = (id) => ({ f: ST[id].f, x: ST[id].x, id });
    if (s.fires.length) { const f = s.fires[0]; return { f: f.f, x: f.x, hold: true }; }
    if (s.leaks.length || s.mastBroken) {
      if (h.carry === 'patch') { if (s.leaks.length) { const l = s.leaks[0]; return { f: l.f, x: l.x, hold: true }; } if (e.storm < 0.6) return { ...near('sail'), hold: true }; }
      else if (h.carry) { if (s.F < 80) return { ...near('furnace'), edge: true }; if (s.bunker.length < L.CAP.bunker) return { ...near('bunker'), edge: true }; }
      else if (s.leaks.length || e.storm < 0.6) return { ...near('bench'), hold: true };
    }
    const onHill = !s.water && s.mx > L.HILL.x - 300 && s.mx < L.HILL.x + L.HILL.ramp + L.HILL.steep + 100;
    if (s.P > (onHill ? 98 : 94) || (task === 'vent' && s.P > (onHill ? 90 : 78))) { task = 'vent'; return { ...near('valve'), hold: true }; }
    if (task === 'vent') task = null;
    // берег: дрова → верстак → поплавки → лебёдка
    const gate = game.activeGate();
    if (gate && gate.kind === 'shore' && Math.abs(s.v) < 3) {
      if (s.prog.floatsWood < 2) {
        if (h.carry === 'wood') return { ...near('bench'), edge: true };
        if (h.carry) return { ...near('furnace'), edge: true };
        if (s.bunker.includes('wood') && s.bunker[s.bunker.length - 1] === 'wood') return { ...near('bunker'), edge: true };
        if (game.pileNear()) return { ...near('hatch'), edge: true };
        if (s.bunker.length) return { ...near('bunker'), edge: true };     // переложить в топку
      } else if (s.prog.floats < 100) return { ...near('bench'), hold: true };
      else return { ...near('winch'), hold: true };
    }
    if (gate && gate.kind === 'gate' && Math.abs(s.v) < 3) {
      if (gate.steamOnly && s.P < 34) { if (s.F < 60 && h.carry) return { ...near('furnace'), edge: true }; if (s.F < 60 && s.bunker.length) return { ...near(h.carry ? 'furnace' : 'bunker'), edge: true }; return { ...near('valve'), idle: true }; }
      return { ...near('winch'), hold: true };
    }
    // топка
    if (h.carry && h.carry !== 'patch') { if (s.F < 70) return { ...near('furnace'), edge: true }; if (s.bunker.length < L.CAP.bunker) return { ...near('bunker'), edge: true }; return { ...near('furnace'), edge: true }; }
    const lowF = s.F < (onHill ? 70 : 45);
    if (lowF && s.bunker.length) return { ...near('bunker'), edge: true };
    // куча у люка
    const pn = game.pileNear();
    if (pn && s.bunker.length < (s.water ? 8 : 6) && !s.dive) return { ...near('hatch'), edge: true };
    // парус по ветру
    const iceZone = s.water && s.mx > OBI.ice.x - 600 && s.mx - L.MW < OBI.ice.x2;   // среди льдин парус не нужен — всё равно нырять
    const wantSail = e.wind > 0.12 && e.storm < 0.2 && !(s.depth > 0.3) && !s.mastBroken && !iceZone;
    const stormSoon = s.water && s.mx > OBI.storm.x - 900 && s.mx < OBI.storm.x2;
    if ((wantSail && !stormSoon) !== s.sailUp && !s.mastBroken && !(s.depth > 0.6)) return { ...near('sail'), edge: true };
    // балласт подо льдом
    if (s.water) {
      const sh = OBI.ice.sheets, front = s.mx, back = s.mx - L.MW;
      let needDive = false;
      for (const [a, b] of sh) { if (front > a - 170 && back < b + 10) needDive = true; }
      if (needDive && s.air < 40) { const nxt = sh.find(([a]) => a > front); if (game.underIce() === false && nxt && nxt[0] - front > 120) needDive = false; }
      if (!game.underIce() && s.air < 99 && s.depth > 0.5) { const nxt = sh.find(([a]) => a > front); if (nxt && nxt[0] - front > 140 && !sh.some(([a, b]) => back < b && front > a)) needDive = false; }
      if (needDive !== s.dive && !(s.dive && game.underIce())) return { ...near('ballast'), edge: true };
    }
    // режим хода
    let mode = 2;
    const ford = OBI.ford;
    if (!s.water && s.mx > ford.x - 500 && s.mx - L.MW < ford.x2) mode = s.v > 22 ? 0 : 1;   // в брод — тихо, иначе вода плеснёт в топку
    for (const o of L.OB) {
      if ((o.kind === 'gate' && s.prog[o.id] < o.need) || (o.kind === 'shore' && !s.water)) { const d = o.x - s.mx; if (d > -5 && d < 700) mode = d < 60 + s.v * s.v / 70 ? 0 : 1; }
    }
    if (s.water) { const nxt = OBI.ice.sheets.find(([a]) => a > s.mx); if (nxt && nxt[0] - s.mx < 220 && s.depth < 0.8) mode = 0; }
    const pa = pileAhead();
    if (pa && s.bunker.length < (s.water ? 7 : 5) && !s.dive) { const stopD = s.water ? s.v * s.v / 30 + 20 : (s.v * s.v) / 70 + 25; if (pa.d < stopD + 40) mode = 0; else if (pa.d < stopD + 200 && mode > 1) mode = 1; }
    if (onHill && !(pa && pa.d < 200)) mode = 2;
    if (mode === 0 && gate && Math.abs(s.v) < 3) mode = 0;
    if (s.mode !== mode) return { ...near('lever'), edge: true, cycles: true };
    if (s.F < 60 && s.bunker.length) return { ...near('bunker'), edge: true };
    return { ...near('furnace'), idle: true };
  }

  function decide(){
    const s = S(), h = s.hero; const w = want();
    if (lazy && brng() < lazy) return { dx: 0, dy: 0, held: false };
    const tg = game.target();
    const f = Math.round(h.lv), onLadMid = h.lad >= 0 && Math.abs(h.lv - f) > 0.02;
    if (!onLadMid && f === w.f && Math.abs(h.x - w.x) <= L.REACH - 4) {
      if (w.idle) return { dx: 0, dy: 0, held: false };
      if (w.hold) return { dx: 0, dy: 0, held: !!tg };
      return { dx: 0, dy: 0, held: !keys.held && !!tg, tap: true };          // нажать и отпустить
    }
    const r = game.route(w.f, w.x);
    let rel = 1e9;
    if (r.dx && !r.dy) {
      // до ближайшей точки остановки (станция/лестница) — отпускаем клавишу вовремя
      let goal = w.x;
      if (f !== w.f && h.lad < 0) { const up = w.f > f; const ls = L.LADDERS.filter(l => up ? l.a === f : l.b === f); goal = ls.reduce((a, l) => Math.abs(l.x - h.x) + Math.abs(l.x - w.x) < Math.abs(a - h.x) + Math.abs(a - w.x) ? l.x : a, ls[0].x); }
      const d = Math.abs(goal - h.x), tol = goal === w.x ? 6 : 3;
      if (d < 50) rel = Math.max(0.01, (d - tol) / 82 + (brng() - 0.5) * 0.04);
    }
    return { dx: r.dx, dy: r.dy, held: false, rel };
  }

  let lastX = S().mx, lastProg = 0;   // зависание: 240 с без нового максимума пути
  while (tm < maxT && !ev.won){
    if (tm >= next){
      const k = decide(); keys = k; if (opts.trace && tm < opts.trace) console.log(tm.toFixed(2), JSON.stringify(k), JSON.stringify(want()), S().hero.x.toFixed(0), S().hero.lv, S().P.toFixed(0), S().F.toFixed(0), S().mode); release = k.rel != null && k.rel < 1e8 ? tm + k.rel : (k.tap ? tm + 0.08 : 1e9);
      next = tm + r0 + brng() * (r1 - r0);
    }
    if (tm >= release){ if (keys.tap) keys = { dx: 0, dy: 0, held: false }; else keys = { ...keys, dx: 0 }; release = 1e9; }
    game.setInput(keys.dx, keys.dy, keys.held);
    game.update(dt); tm += dt;
    if (opts.log && Math.floor(tm / opts.log) !== Math.floor((tm - dt) / opts.log)) { const q = S(); console.log('t', Math.round(tm), 'x', Math.round(q.mx), 'v', q.v.toFixed(0), 'm', q.mode, 'P', q.P.toFixed(0), 'F', q.F.toFixed(0), 'b', q.bunker.length, 'hull', q.hull.toFixed(0), 'air', q.air.toFixed(0), 'd', q.depth.toFixed(2), q.hero.carry, JSON.stringify(want())); }
    if (opts.until && S().mx > opts.until) break;
    if (S().mx > lastX + 30){ lastX = S().mx; lastProg = tm; } else if (tm - lastProg > 240 && S().phase === 'play') { ev.stuck = true; break; }
  }
  const s = S();
  return { ...ev, time: tm, mx: s.mx, sec: s.sec, phase: s.phase, hull: s.hull, state: s, game };
}
