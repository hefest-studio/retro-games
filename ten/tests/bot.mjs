/* ТЕНЬ · tests/bot.mjs — граф проходимости по настоящей физике и «человеческий» бот.
   navFor(TEN, LV) — граф. Узлы: «стою» (столбец + высота опоры; low — под низким потолком, только ползком) и «вишу на стене»
   (сторона, x, y с шагом 4 px). Рёбра: (а) шаг на соседний столбец по непрерывной опоре; (б) макро-действия, просчитанные
   настоящей физикой TEN.logic.heroStep: разбег k кадров → прыжок → рулёжка в воздухе; сход с края; бросок крюка через j кадров
   после отрыва → раскачка r кадров → бросок (прыжок) с троса; со стены — прыжок от стены с рулёжкой (и крюком),
   подтягивание на край, спуск скольжением, отпускание. Ребро годно, если героиня не упала в пропасть и не задела шипы.
   Враги не учитываются (это проверка геометрии).
   playTen(TEN, seed, opts) — бот играет как человек: setInput/press. Реакция 150–250 мс (на врагов и перед каждым
   сложным действием), ошибка момента нажатия ±timing с, часть врагов замечает поздно (miss), иногда «засматривается» (lapse).
   opts: { react:[0.15,0.25], timing=0.035, miss=0.12, lapse=0.02, god=false, act=1, untilAct=1, maxT=1500 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const DT = 1 / 60;

// вход макро-действия на кадре f
function macroInput(m, f, P){
  const I = { dx: 0, dy: 0, jump: false, jumpP: false, hookP: false };
  if (m.kind === 'jump' || m.kind === 'walkoff'){
    if (m.kind === 'walkoff'){ I.dx = (P.ground && !m._air) ? m.d : m.s; if (!P.ground) m._air = true; }
    else if (f < m.k) I.dx = m.d;
    else { if (f === m.k) I.jumpP = true; I.jump = f < m.k + 16; I.dx = f === m.k ? m.d : m.s; }
    if (m.hook){
      const base = m.kind === 'jump' ? m.k : (m._airF != null ? m._airF : 1e9);
      if (m.kind === 'walkoff' && !P.ground && m._airF == null) m._airF = f;
      const hf = base + m.hook.j;
      if (f === hf) I.hookP = true;
      if (f > hf && f < hf + m.hook.r){ I.dx = m.hook.p; I.jump = false; I.dy = m.hook.reel || 0; }
      if (f === hf + m.hook.r){ I.jumpP = true; I.jump = true; }
      if (f > hf + m.hook.r) I.dx = m.s;
    }
  } else if (m.kind === 'wj'){
    if (f === 0){ I.jumpP = true; }
    I.jump = f < 16; I.dx = f < 9 ? 0 : m.s;
    if (m.hook){
      if (f === m.hook.j) I.hookP = true;
      if (f > m.hook.j && f < m.hook.j + m.hook.r){ I.dx = m.hook.p; I.jump = false; }
      if (f === m.hook.j + m.hook.r){ I.jumpP = true; I.jump = true; }
      if (f > m.hook.j + m.hook.r) I.dx = m.s;
    }
  } else if (m.kind === 'mantle'){ I.dy = -1; I.dx = m.side; }
  else if (m.kind === 'slide'){ I.dy = P.cling ? 1 : 0; }
  else if (m.kind === 'detach'){ I.dx = P.cling ? -m.side : m.s; }
  return I;
}

export function startHero(TEN, n){
  const L = TEN.logic, P = L.newHero(n.x, n.y);
  if (n.side){ P.cling = n.side; P.ground = false; P.face = -n.side; }
  else if (n.low) P.crouch = true;
  return P;
}

// прогон макро; → { end:'stand'|'cling'|'fail', x, y, side, frames }
export function simMacro(TEN, LV, n, m0, opts = {}){
  const L = TEN.logic, P = startHero(TEN, n), m = Object.assign({}, m0);
  if (opts.dx) P.x += opts.dx;
  let air = false, f;
  for (f = 0; f < 320; f++){
    const I = macroInput(m, f + (opts.df && f >= m.k ? 0 : 0), P);
    L.heroStep(LV, P, I, DT, null);
    if (P.fell || P.hazard) return { end: 'fail', frames: f };
    if (!P.ground && !P.cling) air = true;
    if (P.mantle) continue;
    if (P.cling && (m.kind !== 'wj' || f > 2) && f >= 1 && !(n.side && m.kind !== 'wj' && m.kind !== 'detach' && P.cling === n.side && !air)) return { end: 'cling', x: P.x, y: P.y, side: P.cling, frames: f + 1 };
    if (P.ground && (air || m.kind === 'mantle') && !P.hook) return { end: 'stand', x: P.x, y: P.y, frames: f + 1 };
    if (m.kind === 'walkoff' && f > 90 && !air) return { end: 'fail', frames: f };
  }
  return { end: 'fail', frames: f };
}

// ---------------- граф проходимости ----------------
export function navFor(TEN, LV){
  const L = TEN.logic, T = L.T, C = L.C, K = L.K;
  const nodes = [], cols = new Map(), clingMap = new Map();
  const tile = (c, r) => L.tile(LV, c, r);
  for (let c = 1; c < LV.w - 1; c++){
    const list = [];
    for (let r = 1; r < LV.h; r++){
      const v = tile(c, r); if (v !== C.S && v !== C.P) continue;
      if (tile(c, r - 1) === C.S) continue;
      if (tile(c, r - 1) === C.X) continue;
      const low = tile(c, r - 2) === C.S;
      const n = { id: nodes.length, c, x: c * T + 8, y: r * T, low, side: 0 }; nodes.push(n); list.push(n);
    }
    cols.set(c, list);
  }
  const standAt = (x, y) => {
    const c = Math.floor(x / T); for (const n of cols.get(c) || []) if (Math.abs(n.y - y) < 2) return n;
    for (const cc of [Math.floor((x - K.HW) / T), Math.floor((x + K.HW - 0.01) / T)]) if (cc !== c) for (const n of cols.get(cc) || []) if (Math.abs(n.y - y) < 2) return n;
    return null;
  };
  const clingAt = (side, x, y) => {
    const key = side + ':' + Math.round(x) + ':' + Math.round(y / 4) * 4;
    let n = clingMap.get(key);
    if (!n){ n = { id: nodes.length, side, x: Math.round(x), y: Math.round(y / 4) * 4, cling: true }; nodes.push(n); clingMap.set(key, n); }
    return n;
  };
  const exactCling = (side, x, y) => { const n = { id: nodes.length, side, x, y, cling: true, exact: true }; nodes.push(n); return n; };
  const adj = [];
  const addEdge = (a, b, e) => { (adj[a.id] || (adj[a.id] = [])).push(Object.assign({ to: b.id }, e)); };
  // шаги
  const walkable = (a, b) => {
    const d = b.x > a.x ? 1 : -1;
    for (let k = 2; k <= 16; k += 2){
      const x = a.x + d * k, ok = L.floorY(LV, x - 6 * d, a.y - 1, a.y + 1) === a.y || L.floorY(LV, x + 6 * d, a.y - 1, a.y + 1) === a.y;
      if (!ok) return false;
    }
    return !L.boxHits(LV, b.x - K.HW, b.y - (a.low || b.low ? K.HC : K.HH), b.x + K.HW, b.y);
  };
  for (const n of nodes) for (const dc of [-1, 1]) for (const m of cols.get(n.c + dc) || []) if (m.y === n.y && walkable(n, m)) addEdge(n, m, { kind: 'walk', cost: 7 });
  const ringNear = (x, y) => LV.rings.some(r => Math.abs(r.x - x) < 260 && r.y < y && y - r.y < 260);
  const done = new Set();
  const expand = (n) => {
    if (done.has(n.id)) return; done.add(n.id);
    const ms = [];
    if (!n.side){
      if (n.low) return;
      // сокращение: из середины ровной площадки прыжки не нужны, если соседи по обе стороны на том же уровне и над головой пусто на 6 клеток
      for (const d of [-1, 1]){
        for (const k of [0, 6, 18]) for (const s of [d, 0, -d]) ms.push({ kind: 'jump', d, k, s });
        for (const s of [d, 0, -d]) ms.push({ kind: 'walkoff', d, s });
        if (ringNear(n.x, n.y)) for (const k of [0, 10, 20]) for (const j of [6, 12, 18, 24]) for (const r of [14, 22, 30, 40, 52]) ms.push({ kind: 'jump', d, k, s: d, hook: { j, r, p: d } });
      }
    } else {
      const a = -n.side;
      for (const s of [a, 0, n.side]) ms.push({ kind: 'wj', s });
      if (ringNear(n.x, n.y)) for (const j of [6, 12, 18, 24]) for (const r of [14, 22, 30, 40, 52]) ms.push({ kind: 'wj', s: a, hook: { j, r, p: a } });
      ms.push({ kind: 'mantle', side: n.side }); ms.push({ kind: 'slide', side: n.side });
      for (const s of [a, 0]) ms.push({ kind: 'detach', side: n.side, s });
    }
    for (const m of ms){
      const r = simMacro(TEN, LV, n, m);
      if (r.end === 'fail') continue;
      const to = r.end === 'stand' ? standAt(r.x, r.y) : clingAt(r.side, r.x, r.y);
      if (!to || to.id === n.id) continue;
      addEdge(n, to, { kind: 'sim', m, cost: r.frames + 12, frames: r.frames });
    }
  };
  // BFS c ленивым раскрытием
  const start = standAt(LV.start.x, LV.start.y);
  const seen = new Uint8Array(nodes.length + 100000), queue = [start]; seen[start.id] = 1;
  let goal = null;
  const isGoal = n => LV.exit && !n.side && n.x >= LV.exit.x - 6 && Math.abs(n.y - LV.exit.y) < 48;
  while (queue.length){
    const n = queue.shift();
    if (isGoal(n)){ goal = goal || n; }
    expand(n);
    for (const e of adj[n.id] || []) if (!seen[e.to]){ seen[e.to] = 1; queue.push(nodes[e.to]); }
  }
  const reached = nodes.filter(n => seen[n.id]);
  const maxX = reached.reduce((a, n) => Math.max(a, n.x), 0);
  return { nodes, adj, cols, start, goal, reached: reached.length, maxX, standAt, clingAt, exactCling, isGoal, expand,
    // путь Дейкстрой: от узла from к цели; bad — множество «ненадёжных» рёбер (ключ a>b#i), их цена ×12
    path(from, bad){
      const N = nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Array(N).fill(null);
      dist[from.id] = 0; const open = [from.id];
      while (open.length){
        let bi = 0; for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
        const u = open.splice(bi, 1)[0]; const nu = nodes[u];
        if (isGoal(nu)){ const out = []; let v = u; while (prev[v]){ out.unshift(prev[v].e); v = prev[v].from; } return out; }
        (adj[u] || []).forEach((e, i) => {
          const key = u + '>' + e.to + '#' + i; e.key = key; e.from = u;
          const c = dist[u] + e.cost * (bad && bad.has(key) ? 12 : 1);
          if (c < dist[e.to]){ if (dist[e.to] === Infinity) open.push(e.to); dist[e.to] = c; prev[e.to] = { from: u, e }; }
        });
      }
      return null;
    }
  };
}

// надёжность ребра: тот же итог при сдвиге старта ±3 px и момента прыжка ±2 кадра
export function robust(TEN, LV, nav, e){
  if (e.kind !== 'sim') return true;
  if (e._rob != null) return e._rob;
  const n = nav.nodes[e.from], m = e.m, want = nav.nodes[e.to];
  let ok = true;
  const tries = [];
  for (const dx of [-3, 3]) tries.push([dx, m]);
  if (m.kind === 'jump') for (const dk of [-2, 2]) if (m.k + dk >= 0) tries.push([0, Object.assign({}, m, { k: m.k + dk })]);
  for (const [dx, mm] of tries){
    const r = simMacro(TEN, LV, n, mm, { dx });
    if (r.end === 'fail'){ ok = false; break; }
    const to = r.end === 'stand' ? nav.standAt(r.x, r.y) : null;
    if (r.end === 'stand' && (!to || Math.abs(to.x - want.x) > 40 || to.y !== want.y)){ ok = false; break; }
    if (r.end === 'cling' && (!want.side || r.side !== want.side || Math.abs(r.y - want.y) > 24)){ ok = false; break; }
  }
  return (e._rob = ok);
}

// ---------------- «человеческий» бот ----------------
export function playTen(TEN, seed, opts = {}){
  const L = TEN.logic, T = L.T, K = L.K, rnd = mulberry32(seed * 7919 + 17);
  const react = opts.react || [0.15, 0.25], timing = opts.timing != null ? opts.timing : 0.035, miss = opts.miss != null ? opts.miss : 0.12, lapse = opts.lapse != null ? opts.lapse : 0.02;
  const R = () => react[0] + rnd() * (react[1] - react[0]);
  const ev = [];
  const game = TEN.Game({ rng: mulberry32(seed), act: opts.act || 1, god: !!opts.god, autoCut: true, onEvent: (t, d) => ev.push(t) }).start();
  const S = () => game.state();
  const navCache = opts.navCache || {};
  let exactN = null, nav = null, navKey = '', bad = new Set(), plan = null, pi = 0, cur = null, f = 0, wait = 0, lastSim = false;
  const seen = new Map(), ignored = new Set();
  let t = 0, lastT = 0, stuckT = 0, bestProg = -1, progKey = '', lapseT = 0, strikeCd = 0, starCd = 0, firstSceneAt = null;
  const maxT = opts.maxT || 1500, untilAct = opts.untilAct || 6;
  const res = { seed, won: false, scenes: 0, deaths: 0, stuck: false, why: {}, time: 0, act1: false };
  let prevScene = '';

  const resting = P => (P.ground && Math.abs(P.vx) < 4 && P.slideT <= 0 && !P.mantle) || (P.cling && !P.mantle);
  function curNode(P){
    if (P.cling){ if (!exactN || exactN.x !== P.x || exactN.y !== P.y || exactN.side !== P.cling) exactN = nav.exactCling(P.cling, P.x, P.y); return exactN; }
    const n = nav.standAt(P.x, P.y); return n;
  }
  function replan(P){
    const n = curNode(P); if (!n) return false;
    let p = null;
    for (let it = 0; it < 6; it++){
      p = nav.path(n, bad); if (!p) break;
      let allOk = true;
      for (const e of p){ nav.expand(nav.nodes[e.to]); if (!robust(TEN, S().LV, nav, e)){ if (!bad.has(e.key)){ bad.add(e.key); allOk = false; } } }
      if (allOk) break;
    }
    if (!p){ // узлы, ещё не раскрытые: раскрыть окрестность и повторить
      for (const m of nav.nodes) if (Math.abs(m.x - n.x) < 400) nav.expand(m);
      p = nav.path(n, bad);
    }
    plan = p; pi = 0; cur = null; return !!p;
  }

  while (t < maxT){
    const s = S();
    if (s.over){ break; }
    if (s.won){ res.won = true; break; }
    if (s.act > untilAct){ res.won = true; break; }
    const key = s.act + '-' + s.scene;
    if (key !== prevScene){ prevScene = key; plan = null; cur = null; bestProg = -1; stuckT = 0; ignored.clear(); seen.clear(); if (s.act === 1 && s.scene === 2 && firstSceneAt == null) firstSceneAt = t; }
    if (s.phase !== 'play'){ game.setInput(0, 0, false); game.update(DT); t += DT; plan = null; cur = null; continue; }
    const P = s.hero, LV = s.LV;
    if (!LV.arena && navKey !== key){ navKey = key; nav = navCache[key] || (navCache[key] = navFor(TEN, LV)); bad = navCache[key + ':bad'] || (navCache[key + ':bad'] = new Set()); plan = null; cur = null; }
    // прогресс / застревание
    const prog = LV.arena ? (s.boss ? -s.boss.hp : 0) : Math.floor(P.x / 32);
    if (prog > bestProg || progKey !== key){ bestProg = prog; stuckT = 0; progKey = key; lastT = t; } else { stuckT += t - lastT; lastT = t; }
    if (stuckT > 40){ res.stuck = true; res.stuckAt = key + ' x=' + Math.round(P.x) + ' y=' + Math.round(P.y) + ' st=' + L.stateOf(P) + ' vx=' + P.vx.toFixed(1) + ' plan=' + (plan ? plan.length - pi + ' e=' + JSON.stringify(Object.assign({}, plan[pi], {_rob: undefined})) + ' from=' + JSON.stringify(nav && nav.nodes[plan[pi].from]) : 'none') + ' cur=' + (cur ? JSON.stringify(cur.m) : '-') + ' here=' + JSON.stringify(nav && !LV.arena && curNode(P) && { x: curNode(P).x, y: curNode(P).y, s: curNode(P).side }) + ' en=' + JSON.stringify(s.enemies.filter(e => !e.dead && Math.abs(e.x - P.x) < 200).map(e => [e.k, Math.round(e.x), Math.round(e.y)])); break; }

    let I = { dx: 0, dy: 0, jump: false };
    // ---- угрозы: замечает с задержкой реакции ----
    strikeCd -= DT; starCd -= DT;
    let threat = null;
    for (const e of s.enemies){
      if (e.dead){ seen.delete(e.id + (e.respawned ? 'r' : '')); continue; }
      const id = e.id + (e.respawned ? 'r' : '');
      const vis = Math.abs(e.x - P.x) < 300 && Math.abs(e.y - P.y) < 170;
      if (!vis) continue;
      if (!seen.has(id)){ seen.set(id, t + R()); if (rnd() < miss) ignored.add(id); }
      if (t < seen.get(id) || ignored.has(id)) continue;
      const dx = e.x - P.x, dy = (e.y - L.EN[e.k].h / 2) - (P.y - 12);
      if (Math.abs(dy) < 30 && Math.abs(dx) < 44){ if (!threat || Math.abs(dx) < Math.abs(threat.dx)) threat = { e, dx, dy }; }
      if (e.k !== 'drone' && Math.abs(dy) < 26 && Math.abs(dx) < 220 && Math.abs(dx) > 50 && s.charge >= 6 && s.special === 'star' && starCd <= 0 && (dx > 0) === (P.face > 0) && resting(P) && P.ground){ game.press('special'); starCd = 0.8 + rnd(); }
    }
    let bolt = null;
    for (const b of s.eshots){
      const dx = b.x - P.x, dy = b.y - (P.y - 12);
      if (Math.abs(dy) < 18 && Math.abs(dx) < 60 && Math.sign(b.vx || 0) === -Math.sign(dx)){ bolt = { b, dx }; break; }
    }
    if (lapseT > 0){ lapseT -= DT; game.setInput(0, 0, false); game.update(DT); t += DT; continue; }
    if (rnd() < lapse * DT){ lapseT = 0.2 + rnd() * 0.3; }

    if (LV.arena){
      I = bossBrain(s, P, rnd, I);
      if (I.press) { game.press(I.press); }
      game.setInput(I.dx, I.dy, I.jump); game.update(DT); t += DT; continue;
    }
    // ---- бой: враг вплотную — удар (повернувшись) ----
    let fight = false;
    if ((threat || bolt) && !cur){
      const dx = threat ? threat.dx : bolt.dx;
      if (P.ground && strikeCd <= 0){
        if ((dx > 0) !== (P.face > 0)){ I.dx = dx > 0 ? 1 : -1; game.setInput(I.dx, 0, false); game.update(DT); t += DT; continue; }
        if (threat && Math.abs(dx) > 26 + L.EN[threat.e.k].w - 8 && !bolt){ game.setInput(Math.sign(dx), 0, false); game.update(DT); t += DT; continue; }
        game.press('strike'); strikeCd = 0.26 + rnd() * 0.08; fight = true;
      } else if (P.ground) fight = true;
    } else if (threat && cur && strikeCd <= 0 && (threat.dx > 0) === (P.face > 0)){ game.press('strike'); strikeCd = 0.3; }
    if (fight){ game.setInput(0, 0, false); game.update(DT); t += DT; continue; }

    // ---- навигация ----
    if (cur){
      const m = cur.mm;
      if (f > 0){
        if (!P.ground && !P.cling) cur.air = true;
        const fs = f - 1;
        let end = f > 320;
        if (!P.mantle){
          if (P.cling && (m.kind !== 'wj' || fs > 2) && fs >= 1 && !(cur.side0 && m.kind !== 'wj' && m.kind !== 'detach' && P.cling === cur.side0 && !cur.air)) end = true;
          if (P.ground && (cur.air || m.kind === 'mantle') && !P.hook) end = true;
        }
        if (end){
          cur = null; lastSim = true; wait = R() * 0.6;
          if (opts.trace) opts.trace.push(['  end', Math.round(P.x), Math.round(P.y), P.cling, P.ground]);
          game.setInput(0, 0, false); game.update(DT); t += DT; continue;
        }
      }
      const In = macroInput(m, f, P); f++;
      if (In.jumpP) game.press('jump'); if (In.hookP) game.press('hook');
      game.setInput(In.dx, In.dy, In.jump); game.update(DT); t += DT; continue;
    }
    if (wait > 0){ wait -= DT; game.setInput(0, 0, false); game.update(DT); t += DT; continue; }
    const walking = plan && pi < plan.length && plan[pi].kind === 'walk' && P.ground;
    if (!walking && !resting(P)){ game.setInput(0, P.crouch ? 1 : 0, false); game.update(DT); t += DT; continue; }
    if (!plan || pi >= plan.length){ if (!replan(P)){ game.setInput(0, 0, false); game.update(DT); t += DT; continue; } }
    const e = plan[pi], from = nav.nodes[e.from], to = nav.nodes[e.to];
    // стоим не там, где начинается ребро — перепланировать
    const here = curNode(P);
    if (!here || (here.id !== from.id && !(e.kind === 'walk' && here.side === 0 && Math.abs(P.x - from.x) < 16 && here.y === from.y))){
      if (!replan(P)){ game.setInput(0, 0, false); game.update(DT); t += DT; } continue;
    }
    if (e.kind === 'walk'){
      // идём до последнего шага подряд
      let j = pi; while (j + 1 < plan.length && plan[j + 1].kind === 'walk') j++;
      const dir = Math.sign(nav.nodes[plan[j].to].x - from.x);
      while (pi < j && (nav.nodes[plan[pi].to].x - P.x) * dir <= 0) pi++;
      const goal = nav.nodes[plan[j].to], dx = goal.x - P.x;
      let low = false; for (let q = pi; q <= Math.min(j, pi + 2); q++) if (nav.nodes[plan[q].to].low || nav.nodes[plan[q].from].low) low = true;
      if (Math.abs(dx) < 3){ pi = j + 1; game.setInput(0, low ? 1 : 0, false); game.update(DT); t += DT; continue; }
      const slow = Math.abs(dx) < 12 && Math.abs(P.vx) > 60;
      game.setInput(slow ? 0 : Math.sign(dx), low ? 1 : 0, false); game.update(DT); t += DT; continue;
    }
    // сложное действие: выровняться точно, «подумать», выполнить с ошибкой момента
    if (!from.side && Math.abs(P.x - from.x) > 1.6){ const dx = from.x - P.x; game.setInput(Math.abs(P.vx) > 30 && Math.abs(dx) < 8 ? 0 : Math.sign(dx), 0, false); game.update(DT); t += DT; continue; }
    if (lastSim){ lastSim = false; wait = R(); continue; }
    const mm = Object.assign({}, e.m);
    const jit = Math.round((rnd() * 2 - 1) * timing * 60);
    if (mm.kind === 'jump') mm.k = Math.max(0, mm.k + jit);
    if (mm.hook) mm.hook = Object.assign({}, mm.hook, { j: Math.max(2, mm.hook.j + Math.round((rnd() * 2 - 1) * timing * 40)), r: Math.max(6, mm.hook.r + Math.round((rnd() * 2 - 1) * timing * 40)) });
    cur = { m: e.m, mm, air: false, side0: P.cling }; f = 0; pi++;
    if (opts.trace) opts.trace.push([+t.toFixed(2), JSON.stringify(mm), Math.round(P.x * 10) / 10, P.y, P.cling, '->', to.x, to.y, to.side || 0]);
  }
  const s = S();
  res.time = t; res.deaths = s.deaths; res.why = s.why; res.score = s.score; res.act = s.act; res.scene = s.scene;
  res.hurts = ev.filter(x => x === 'hurt').length; res.kills = s.kills; res.alarms = ev.filter(x => x === 'alarm').length;
  res.scenes = s.cleared.length; res.act1 = s.act > 1 || s.won; res.firstScene = firstSceneAt != null || s.cleared.length > 0;
  return res;
}

// бой с боссом: держаться на дистанции удара, перепрыгивать тараны и волны, бить, когда достаёт
function bossBrain(s, P, rnd, I){
  const B = s.boss; if (!B || B.dead) return { dx: 0, dy: 0, jump: false };
  const tx = B.k === 'crane' ? B.x : B.x, dx = tx - P.x, adx = Math.abs(dx);
  const by = B.k === 'crane' ? B.clawY : B.y, top = by - B.h;
  const reach = P.y - 30 < by && P.y > top - 4;
  let out = { dx: 0, dy: 0, jump: false, press: null };
  // опасность: таран к героине / волна рядом / снаряд — прыжок
  const danger = (B.k === 'foreman' && B.state === 'charge' && Math.sign(B.face) === Math.sign(-dx) && adx < 110) ||
    s.eshots.some(b => Math.abs(b.x - P.x) < (b.k === 'wave' ? 50 : 40) && Math.abs(b.y - (P.y - 10)) < 26 && Math.sign(b.vx || 0) === Math.sign(P.x - b.x));
  if (danger && P.ground){ out.press = 'jump'; out.jump = true; out.dx = Math.sign(dx) || 1; return out; }
  if (!P.ground){ out.jump = true; out.dx = Math.sign(dx); if (adx < 40 && reach) out.press = 'strike'; return out; }
  if (B.k === 'crane' && B.state !== 'grip'){ // под краном не стоять, пока клешня не внизу
    out.dx = adx < 60 ? -Math.sign(dx) : 0; if (B.state === 'move' && adx < 60) out.dx = -Math.sign(dx) || 1; return out; }
  const keep = B.w + 22;
  if (adx > keep + 10) out.dx = Math.sign(dx); else if (adx < keep - 6) out.dx = -Math.sign(dx);
  if (adx < B.w + 34){
    if ((dx > 0) !== (P.face > 0)) { out.dx = Math.sign(dx); }
    else if (reach) out.press = 'strike';
    else if (by < P.y && P.y - by < 95){ out.press = 'jump'; out.jump = true; }
    else if (rnd() < 0.05){ out.press = 'jump'; out.jump = true; }
  }
  if (s.special === 'star' && s.charge >= 3 && adx > 60 && Math.abs((by - B.h / 2) - (P.y - 15)) < B.h / 2 && rnd() < 0.03) out.press = 'special';
  return out;
}
