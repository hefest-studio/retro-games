/* ШУСТРИК · tests/bot.mjs — граф проходимости по настоящей физике и «человеческий» бот.
   navFor(SH, LV) — граф: узлы «стою здесь» (столбец + высота опоры), рёбра — (а) шаг на соседний столбец по
   непрерывной опоре, (б) симуляция макро-действий настоящей физикой heroStep (разбег N кадров с места → прыжок
   с коротким/длинным удержанием → рулёжка в воздухе; просто бег до схода с опоры). Пружины, трубы, рельсы
   и паровые шахты срабатывают внутри симуляции сами. Ребро годно, если герой не упал в пропасть, не встал на шипы
   и приземлился на узел. Ящики считаются твердью (симуляция не разбивает их), враги не учитываются.
   playShustrik(SH, seed, opts) — бот играет как человек: setInput(dx, dy, jump), setFire(on). Видит то, что на экране.
   Человеческие ограничения (по умолчанию): реакция 150–250 мс; момент нажатия «гуляет» на ±timing с;
   часть врагов замечает поздно (miss); иногда «засматривается» (lapse).
   opts: { react:[0.15,0.25], timing=0.04, miss=0.15, lapse=0.03, perfect=false, god=false, world=1, act=1, only=false, maxT=900 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// ---------------- граф проходимости ----------------
export function navFor(SH, LV){
  const L = SH.logic, T = L.T, K = L.K, H = LV.h, dt = 1 / 60;
  const cols = new Map();             // c → [{id, c, x, y}]
  const nodes = [];
  for (let c = 1; c < LV.w - 1; c++){
    const x = c * T + 8, list = [];
    for (let r = 1; r < H; r++){
      const s = L.floorY(LV, x, r * T - 8, r * T + 7.99, r * T - 8);
      if (s == null || list.some(n => Math.abs(n.y - s) < 4)) continue;
      if (L.solidAt(LV, x, s - 6) || L.solidAt(LV, x, s - 20) || L.hazardAt(LV, x, s + 2)) continue;
      const n = { id: nodes.length, c, x, y: s }; nodes.push(n); list.push(n);
    }
    cols.set(c, list);
  }
  const nodeAt = (x, y) => { const c = Math.floor(x / T); for (const dc of [0, -1, 1]) for (const n of cols.get(c + dc) || []) if (Math.abs(n.y - y) < 7 && Math.abs(n.x - x) < 14) return n; return null; };
  // особые столбцы: пружины, вход в трубу, пар, начало рельса — в них не «шагаем», только симуляцией
  const special = new Set();
  const mark = (x0, x1) => { for (let c = Math.floor(x0 / T); c <= Math.floor(x1 / T); c++) special.add(c); };
  LV.springs.forEach(o => mark(o.x - 14, o.x + 14)); LV.pipes.forEach(o => mark(o.pts[0][0] - 8, o.pts[0][0] + 12));
  LV.steam.forEach(o => mark(o.x0 - 8, o.x1 + 8)); LV.rails.forEach(o => mark(o.pts[0][0] - 8, o.pts[0][0] + 8));
  const adj = nodes.map(() => new Set());
  const walkable = (a, b) => {   // непрерывная опора между центрами соседних столбцов
    const d = b.x > a.x ? 1 : -1; let y = a.y;
    for (let k = 4; k <= 16; k += 4){
      const x = a.x + d * k, s = L.floorY(LV, x, y - 7, y + 7, y - 7);
      if (s == null || L.hazardAt(LV, x, s + 2) || L.solidAt(LV, x + d * K.HW, s - 12) || L.solidAt(LV, x + d * K.HW, s - K.HH + 2)) return false;
      y = s;
    }
    return Math.abs(y - b.y) < 2;
  };
  const edgeOf = new Set();
  for (const n of nodes){
    for (const d of [1, -1]){
      if (special.has(n.c + d) || special.has(n.c)) { edgeOf.add(n.c); continue; }
      let ok = false;
      for (const m of cols.get(n.c + d) || []) if (walkable(n, m)){ adj[n.id].add(m.id); ok = true; }
      if (!ok) edgeOf.add(n.c);
    }
  }
  const key = new Set();
  for (const n of nodes){
    let k = n.c % 8 === 0;
    for (let dc = -5; dc <= 5 && !k; dc++){ if (edgeOf.has(n.c + dc)) k = true; const l = cols.get(n.c + dc); if (l && l.length > 1) k = true; }
    if (k) key.add(n.id);
  }
  const ACTS = [];
  for (const dir of [1, -1]){
    ACTS.push({ dir, run: 200, jump: false });
    for (const run of [0, 12, 28, 50]) for (const hold of [6, 40]) for (const steer of [dir, 0]) ACTS.push({ dir, run, jump: true, hold, steer });
  }
  function sim(n, A){
    const P = L.newHero(n.x, n.y); P.sim = true; P.ang = L.angleAt(LV, n.x, n.y);
    let air = false, held = false;
    for (let f = 0; f < 330; f++){
      let dx = A.dir, jump = false, jp = false;
      if (A.jump){
        if (f === A.run) { jp = true; held = true; }
        if (held && f < A.run + A.hold) jump = true;
        if (f >= A.run && (air || P.mode !== 'run')) dx = A.steer;
        if (P.mode !== 'run' && P.mode !== undefined) dx = A.dir;
      } else if (f >= A.run) return null;
      if (P.mode === 'rail' || P.mode === 'pipe') { dx = A.dir; jump = false; jp = false; }
      L.heroStep(LV, P, { dx, dy: 0, jump, jp }, dt, null);
      if (P.y > LV.h * T + 40) return null;
      if (!P.ground || P.mode !== 'run') { air = true; continue; }
      if (L.hazardAt(LV, P.x, P.y + 2)) return null;
      if (air){ const m = nodeAt(P.x, P.y); return m && m.id !== n.id ? m : null; }
      if (!A.jump && Math.abs(Math.floor(P.x / T) - n.c) >= 6){ const m = nodeAt(P.x, P.y); return m && m.id !== n.id ? m : null; }
      if (A.jump && f < A.run && special.has(Math.floor(P.x / T))) { /* бежим дальше — пружина/труба сработают */ }
    }
    return null;
  }
  const simmed = new Set();
  function expand(id){
    if (simmed.has(id) || !key.has(id)) return;
    simmed.add(id);
    for (const A of ACTS){ const m = sim(nodes[id], A); if (m) adj[id].add(m.id); }
  }
  function reach(fromX, fromY){
    const s = nodeAt(fromX, fromY); if (!s) return { seen: new Set(), start: null };
    const seen = new Set([s.id]), q = [s.id];
    while (q.length){ const u = q.shift(); expand(u); for (const v of adj[u]) if (!seen.has(v)){ seen.add(v); q.push(v); } }
    return { seen, start: s };
  }
  return { nodes, cols, adj, nodeAt, reach, sim, ACTS, key, special };
}

// ---------------- «человеческий» бот ----------------
export function playShustrik(SH, seed, opts = {}){
  const L = SH.logic, K = L.K, T = L.T, dt = 1 / 60;
  const perfect = !!opts.perfect, brng = mulberry32(seed * 7919 + 17);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const timing = perfect ? 0 : (opts.timing != null ? opts.timing : 0.04);
  const missP = perfect ? 0 : (opts.miss != null ? opts.miss : 0.15);
  const lapseP = perfect ? 0 : (opts.lapse != null ? opts.lapse : 0.03);
  const evs = {}, why = {};
  const game = SH.Game({ rng: mulberry32(seed), god: !!opts.god, world: opts.world || 1, act: opts.act || 1, lives: opts.lives,
    onEvent: (t, d) => { evs[t] = (evs[t] || 0) + 1; if (t === 'die') why[d.why] = (why[d.why] || 0) + 1; } }).start();
  const S = game.state();
  const react = () => perfect ? 0 : r0 + (r1 - r0) * brng();
  const res = { seed, won: false, acts: 0, firstAt: null, time: 0, deaths: 0, why: {}, stuck: false, score: 0, secrets: 0, firstDeaths: null };

  let t = 0, queue = [], jumpHold = 0, lapse = 0, noticed = new Map(), backT = 0;
  let dirX = 1, aimUp = false, fireWant = false, airDx = 1, steerN = 0, planN = 0, plan = null;
  const sched = (k, delay, hold) => { const at = t + Math.max(0, delay), q0 = queue.find(q => q.k === k); if (!q0) queue.push({ k, at, hold }); else if (at < q0.at) q0.at = at; };
  const LVf = () => S.LV;

  // рельеф впереди: первая яма/шипы или уступ на пути (до 300 px)
  function scan(P){ return scanAt(P.x, P.y, P.face >= 0 ? 1 : -1); }
  function scanAt(x0, y0, dir){
    const LV = LVf(), P = { x: x0 };
    let y = y0;
    for (let d = 8; d <= 300; d += 4){
      const x = P.x + dir * d;
      if (L.solidAt(LV, x, y - 20) || L.solidAt(LV, x, y - 12)){
        const top = L.floorY(LV, x, y - 260, y - 12, null);
        const crate = L.tile(LV, Math.floor(x / T), Math.floor((y - 12) / T)) === L.C.X;
        return { k: 'wall', d, h: top == null ? 999 : y - top, crate };
      }
      if (L.inSteam(LV, x, y - 12)) return null;   // паровая шахта — просто бежим в неё
      const s = L.floorY(LV, x, y - 20, y + 56, y - 20);
      if (s == null || L.hazardAt(LV, x, s + 2)){
        if (LV.rails.some(r => x >= r.pts[0][0] - 24 && x <= r.pts[0][0] + 24)) return null;   // въезд на рельс
        if (LV.pipes.some(p => Math.abs(x - p.pts[0][0]) < 30)) return null;
        return { k: 'gap', d };
      }
      y = s;
    }
    return null;
  }
  // прогноз полёта при рулёжке dx (без новых нажатий)
  function predict(P, dx){
    const LV = LVf(), Hh = Object.assign({}, P); Hh.sim = true;
    for (let i = 0; i < 150; i++){
      L.heroStep(LV, Hh, { dx, dy: 0, jump: true, jp: false }, dt, null);
      if (Hh.mode !== 'run') return 'ok';
      if (Hh.y > LV.h * T) return 'pit';
      if (Hh.ground) return L.hazardAt(LV, Hh.x, Hh.y + 2) ? 'hazard' : 'ok';
    }
    return 'ok';
  }
  function landing(P, dx){
    const LV = LVf(), Hh = Object.assign({}, P); Hh.sim = true;
    for (let i = 1; i < 120; i++){
      L.heroStep(LV, Hh, { dx, dy: 0, jump: true, jp: false }, dt, null);
      if (Hh.mode !== 'run' || Hh.y > LV.h * T) return null;
      if (Hh.ground) return { x: Hh.x, y: Hh.y, t: i * dt, vx: Hh.gsp };
    }
    return null;
  }
  function seen(e){
    if (!noticed.has(e.id)) noticed.set(e.id, brng() < missP ? t + 0.5 + brng() * 0.5 : t);
    return t >= noticed.get(e.id);
  }
  function decide(P){
    dirX = 1; aimUp = false; fireWant = false;
    const B = S.boss, A = LVf().arena;
    if (B && !B.dead && A){ return bossPlan(P, B, A); }
    for (const e of S.enemies){
      if (!e.alive || !seen(e)) continue;
      const dx = e.x - P.x, dy = (e.y - 10) - (P.y - 13);
      if (dx > -20 && dx < 360){
        if (Math.abs(dy) < 26) fireWant = true;
        else if (dy < -26 && dy > -280 && Math.abs(dx + dy) < 80) { fireWant = true; aimUp = true; }
        if (e.k === 'cannon' && dx < 110 && dx > 0 && P.ground && Math.abs(dy) < 30) sched('jump', react() - 0.05, 0.3);
        if ((e.k === 'beetle' || e.k === 'roller') && dx > 0 && dx < 36 + Math.abs(P.gsp) * 0.1 && P.ground && Math.abs(dy) < 30) sched('jump', react() * 0.4, 0.3);
      }
    }
    for (const q of S.eshots){
      const dx = q.x - P.x, dy = q.y - (P.y - 12);
      if (Math.abs(dy) < 22 && ((dx > 0 && dx < 120 && q.vx < 40) || (dx < 0 && dx > -60 && q.vx > 20)) && P.ground) sched('jump', react() * 0.5, 0.3);
    }
    for (const c of LVf().caps){ if (!S.got[c.id] && c.x > P.x && c.x - P.x < 260 && Math.abs(c.y - (P.y - 13)) < 14) fireWant = true; }
    if (!P.ground){
      // в падении «на глаз» намечает, куда встанет, и заранее готовит следующий прыжок (серии мостков)
      if (P.vy > -150 && P.mode === 'run' && !queue.some(q => q.k === 'jump')){
        const Ld = landing(P, airDx);
        if (Ld){ const ob = scanAt(Ld.x, Ld.y, Ld.vx >= 0 ? 1 : -1), v = Math.max(120, Math.abs(Ld.vx));
          if (ob && ob.k === 'gap' && ob.d < 140){ const at = Ld.t + ob.d / v - 0.06 + (brng() - 0.5) * 2 * timing; sched('jump', Math.max(at, perfect ? 0 : react() * 0.7), 0.4); } }
      }
      return;
    }
    const v = Math.max(120, Math.abs(P.gsp));
    const ob = scan(P);
    if (!ob) return;
    const lead = perfect ? 0 : react();
    if (ob.k === 'gap'){
      if (ob.d <= 10 + v * (lead + 0.02)) sched('jump', lead - ob.d / v + 0.01 + (brng() - 0.5) * 2 * timing, 0.4);
    } else if (ob.k === 'wall' && ob.h < 84 && !(ob.crate && P.tier === 2 && Math.abs(P.gsp) >= K.SMASH)){
      if (ob.d <= 22 + v * (lead + 0.08)) sched('jump', lead + (brng() - 0.5) * 2 * timing, 0.4);
    }
  }
  function bossPlan(P, B, A){
    const side = P.x < B.x ? -1 : 1, d = Math.abs(P.x - B.x);
    fireWant = true;
    if (B.k === 'cuckoo'){
      // держится чуть позади часовой птицы — бьёт по диагонали вверх
      const want = B.x - 120 * (P.x < B.x ? 1 : -1); dirX = Math.abs(P.x - want) < 16 ? 0 : P.x < want ? 1 : -1; aimUp = true;
      if (dirX) P.face = dirX;
    } else {
      dirX = d < 150 ? side : d > 230 ? -side : 0;
      if ((P.x < A.x0 + 60 && side < 0) || (P.x > A.x1 - 60 && side > 0)) dirX = 0;
    }
    if (P.x < A.x0 + 30 && dirX < 0) dirX = 0; if (P.x > A.x1 - 30 && dirX > 0) dirX = 0;
    for (const vt of S.vents) if (Math.abs(vt.x - P.x) < 46) dirX = vt.x < P.x ? 1 : -1;
    // уклонение: «прикидывает» на 0,8 с вперёд варианты (стоять/бежать/прыгать) и берёт безопасный
    if (--planN <= 0){
      planN = perfect ? 2 : 5;
      const opts2 = [[dirX, false], [dirX, true], [-dirX || 1, false], [-dirX || 1, true], [0, false], [0, true], [dirX || -1, true], [1, true], [-1, true], [1, false], [-1, false]];
      let best = null, bestD = -1e9;
      for (const [px, pj] of opts2){
        if (pj && !P.ground) continue;
        const dd = threat(P, px, pj) - (px === dirX && !pj ? 0 : 5);
        if (dd > bestD){ bestD = dd; best = [px, pj]; }
        if (px === dirX && !pj && dd > 8) break;
      }
      if (best){
        if (plan && plan.dx === best[0] && plan.j0 === best[1] && t < plan.until) plan.until = t + 0.35;
        else plan = { dx: best[0], j: best[1], j0: best[1], at: t + (perfect ? 0 : react() * 0.7), until: t + 0.35 };
      }
    }
    if (plan && t >= plan.at && t < plan.until){ dirX = plan.dx; if (plan.j){ if (P.ground) sched('jump', 0, 0.35); plan.j = false; } }
  }
  function threat(P, dxp, jmp){
    const LV = LVf(), A = LV.arena, Hh = Object.assign({}, P), B = S.boss; Hh.sim = true;
    const qs = S.eshots.map(q => ({ x: q.x, y: q.y, vx: q.vx, vy: q.vy, g: q.g || 0, r: q.r, roll: q.roll, rolling: q.rolling }));
    const bb = B && !B.dead ? { x: B.x, y: B.y, w: B.w, h: B.h, vx: B.state === 'dash' ? B.dir * (B.k === 'ram' ? 400 : 340) : 0, vy: B.vy || 0, air: B.air } : null;
    let minD = 1e9;
    for (let i = 0; i < 48; i++){
      L.heroStep(LV, Hh, { dx: dxp, dy: 0, jump: jmp && i < 24, jp: jmp && i === 0 }, dt, null);
      if (A){ Hh.x = Math.max(A.x0 + 10, Math.min(A.x1 - 10, Hh.x)); }
      const hy = Hh.y - 12;
      for (const q of qs){
        q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.roll != null && q.y > A.y - q.r){ q.y = A.y - q.r; q.vy = 0; if (!q.rolling){ q.rolling = true; q.vx = (P.x < q.x ? -1 : 1) * q.roll; } }
        minD = Math.min(minD, Math.max(Math.abs(q.x - Hh.x) - q.r - 7, Math.abs(q.y - hy) - q.r - 12));
      }
      if (bb){ bb.x += bb.vx * dt; if (bb.x < A.x0 + 50 || bb.x > A.x1 - 50) bb.vx = 0; if (bb.air){ bb.vy += 1500 * dt; bb.y = Math.min(A.y - bb.h / 2, bb.y + bb.vy * dt); }
        minD = Math.min(minD, Math.max(Math.abs(bb.x - Hh.x) - bb.w / 2 - 7, Math.abs(bb.y - hy) - bb.h / 2 - 12)); }
      for (const v of S.vents){ const ti = i * dt; if (v.warn - ti <= 0 && v.on + v.warn - ti > 0 && Hh.y > A.y - 150) minD = Math.min(minD, Math.abs(v.x - Hh.x) - 22); }
    }
    return minD;
  }

  const maxT = opts.maxT || 900;
  let bestX = S.hero.x, bestT = 0, curAct = S.world * 10 + S.act;
  while (t < maxT){
    const P = S.hero;
    if (S.phase === 'over') break;
    if (S.phase === 'won'){ res.won = true; break; }
    if (S.world * 10 + S.act !== curAct){
      res.acts++; if (res.firstAt == null){ res.firstAt = t; res.firstDeaths = S.deaths; }
      curAct = S.world * 10 + S.act; bestX = S.hero.x; bestT = t; noticed = new Map();
      if (opts.only) break;
    }
    if (S.phase === 'play' && P.mode === 'run'){
      if (lapse > 0) lapse -= dt; else if (brng() < lapseP * dt) lapse = 0.25 + brng() * 0.3;
      if (lapse <= 0) decide(P);
      // в воздухе: рулит, чтобы не перелететь/недолететь (прикидка «на глаз», раз в ~0,1 с)
      if (!P.ground){
        if (--steerN <= 0){
          steerN = perfect ? 3 : 6;
          if (predict(P, airDx) !== 'ok'){ for (const c of [1, 0, -1]) if (c !== airDx && predict(P, c) === 'ok'){ airDx = c; break; } }
          else if (airDx !== 1 && predict(P, 1) === 'ok') airDx = 1;
        }
        if (!(S.boss && !S.boss.dead)) dirX = airDx;
      } else { airDx = 1; steerN = 0; }
    } else if (S.phase !== 'play'){ queue = []; jumpHold = 0; }
    if (S.hero.x > bestX + 32){ bestX = S.hero.x; bestT = t; }
    if (S.phase === 'play' && !S.arenaOn && t - bestT > 5 && P.mode === 'run'){ backT = 0.45; bestT = t - 2; }
    if (t - bestT > 50 && !S.boss && !S.inBonus) { res.stuck = true; break; }
    // исполнение
    let jp = false;
    queue = queue.filter(q => { if (q.at <= t){ if (q.k === 'jump' && S.hero.ground){ jumpHold = q.hold || 0.32; jp = true; } return false; } return true; });
    if (S.hero.mode === 'rail' && !jp) { /* на рельсе не прыгаем без нужды */ }
    let dx = dirX;
    if (backT > 0){ backT -= dt; dx = -1; if (backT <= 0) sched('jump', 0.2, 0.4); }
    if (jp) game.setInput(dx, aimUp ? -1 : 0, false);
    const hold = jumpHold > 0; if (jumpHold > 0) jumpHold -= dt;
    game.setInput(dx, aimUp ? -1 : 0, hold);
    game.setFire(fireWant && (perfect || brng() < 0.7));
    game.update(dt); t += dt;
  }
  res.time = t; res.deaths = S.deaths; res.score = S.score; res.secrets = S.secrets; res.world = S.world; res.act = S.act;
  if (S.phase === 'won') res.won = true;
  res.ev = evs; res.why = why; res.lastDeath = S.lastDeath; res.x = S.hero.x;
  return res;
}
