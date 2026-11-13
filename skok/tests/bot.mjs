/* СКОК · tests/bot.mjs — граф проходимости уровня по настоящей физике (L.heroStep) и «человеческий» бот.
   navFor(SK, LV, suit) — узлы «стою здесь» (столбец + высота опоры: ровная клетка или середина склона),
   рёбра — симуляция макро-действий с места: шаг (короткий/длинный), прыжок с разбегом 0/10/24/48 кадров и удержанием
   8/30 кадров (+60 для крыльев-зонтика — планирование), с торможением после приземления и без, прыжок на месте,
   подкат по склону. Склоны, доски, ящики, шипы и смола — та же физика, что в игре; враги и молоты не учитываются.
   Ребро годно, если герой не упал в пропасть/смолу, не встал на шипы (кроме медного панциря) и остановился на узле.
   Граф строится лениво: раскрываются только узлы, достижимые от старта.
   playLevel(SK, id, seed, opts) — бот играет как человек: реакция 150–250 мс, разброс моментов нажатия ±2–3 кадра,
   идёт к часовне по графу (граф — под текущий костюм), замечает врага впереди и прыгает на него (иногда не замечает). */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const DT = 1 / 60;

export function actionsList(suit){
  const A = [], holds = suit === 'wings' ? [8, 30, 70] : [8, 30];
  for (const d of [1, -1]){
    A.push({ d, walk: 6 }); A.push({ d, walk: 18 });
    for (const run of [0, 10, 24, 48]) for (const hold of holds){ A.push({ d, run, hold, steer: d }); A.push({ d, run, hold, steer: d, brake: true }); }
    A.push({ d, run: 0, hold: 30, steer: 0 });
    A.push({ d, slide: 50 });
  }
  A.push({ d: 0, run: 0, hold: 30, steer: 0 });
  return A;
}

// входы действия A в кадре f (st — состояние исполнения; jit — разброс моментов для бота)
export function actInput(A, f, P, st){
  let dx = 0, dy = 0, jump = false;
  if (A.walk != null){ if (f < A.walk) dx = A.d; return { dx, dy, jump }; }
  if (A.slide != null){ if (f < 4) dx = A.d; else if (f < 4 + A.slide) dy = 1; return { dx, dy, jump }; }
  if (f < A.run) dx = A.d;
  else {
    if (f < A.run + A.hold) jump = true;
    if (!P.ground) st.air = true;
    if (!st.air || !P.ground) dx = f < A.run ? A.d : A.steer;
    if (st.air && P.ground) dx = A.brake && Math.abs(P.vx) > 20 ? (P.vx > 0 ? -1 : 1) : 0;
  }
  return { dx, dy, jump };
}

export function navFor(SK, LV, suit = null){
  const L = SK.logic, T = L.T, K = L.K, W = { LV };
  const nodes = [], at = new Map();
  const key = (c, y) => c + ',' + Math.round(y / 8);
  for (let c = 0; c < LV.w; c++) for (let r = 1; r < LV.h; r++){
    const ch = L.tileAt(LV, c, r), a = L.tileAt(LV, c, r - 1), b = L.tileAt(LV, c, r - 2);
    if (a === '~' || L.isSolid(a)) continue;
    let y = null;
    if ((L.isSolid(ch) || ch === 'T') && !L.isSlope(a) && !L.isSolid(b)) { if (ch === '^' && suit !== 'armor') continue; y = r * T; }
    else if (L.isSlope(ch)) y = r * T + 8;
    if (y == null) continue;
    const n = { id: nodes.length, c, r, x: c * T + 8, y };
    nodes.push(n); at.set(key(c, y), n);
  }
  const nodeAt = (x, y) => {
    const c = Math.floor(x / T);
    for (const yy of [y - 0.5, y + 0.5]){ const ty = Math.floor(yy / T); if (L.isSlope(L.tileAt(LV, c, ty))) { const n = at.get(key(c, ty * T + 8)); if (n) return n; } }
    const r = Math.round(y / T); if (Math.abs(y - r * T) > 0.6) return null;
    return at.get(key(c, r * T)) || null;
  };
  const keyItem = LV.items.find(i => i.k === 'key');
  const touchKey = P => { if (!keyItem) return false; const h = L.heightOf(P), cx = keyItem.tx * T + 8, cy = keyItem.ty * T + 8; return Math.abs(cx - P.x) < K.HW + 6 && cy + 6 > P.y - h && cy - 6 < P.y; };
  const ACTS = actionsList(suit);
  const edges = new Map();
  function sim(n, A){
    const P = L.newHero(n.x, n.y); P.suit = suit;
    const st = { air: false };
    let moved = false, gotKey = false;
    for (let f = 0; f < 360; f++){
      const inp = actInput(A, f, P, st);
      L.heroStep(W, P, inp, DT, null);
      if (L.hazard(LV, P)) return null;
      if (!gotKey && touchKey(P)) gotKey = true;
      if (Math.abs(P.x - n.x) > 2 || Math.abs(P.y - n.y) > 2) moved = true;
      const idle = !inp.dx && !inp.dy && !inp.jump;
      if (idle && P.ground && !P.low && !P.slide && Math.abs(P.vx) < 1.5 && f > 3){
        if (!moved) return null;
        const m = nodeAt(P.x, P.y); if (!m || m === n) return null;
        return { to: m.id, f, key: gotKey };
      }
    }
    return null;
  }
  function edgesOf(n){
    if (edges.has(n.id)) return edges.get(n.id);
    const seen = new Map();
    ACTS.forEach((A, ai) => {
      const r = sim(n, A); if (!r) return;
      const k = r.to + '|' + (r.key ? 1 : 0), prev = seen.get(k);
      if (!prev || r.f < prev.f) seen.set(k, { to: r.to, f: r.f, a: ai, key: r.key });
    });
    const list = [...seen.values()]; edges.set(n.id, list); return list;
  }
  const start = nodeAt(LV.start.tx * T + 8, (LV.start.ty + 1) * T);
  function bfs(from, stopAt){
    const dist = new Map([[from.id, 0]]), prev = new Map(), q = [from.id];
    while (q.length){
      const u = q.shift(); if (stopAt && stopAt(nodes[u])) return { dist, prev, hit: u };
      for (const e of edgesOf(nodes[u])) if (!dist.has(e.to)){ dist.set(e.to, dist.get(u) + 1); prev.set(e.to, { from: u, e }); q.push(e.to); }
    }
    return { dist, prev, hit: null };
  }
  const isExit = n => LV.exit ? (n.c >= LV.exit.tx - 1 && Math.abs(n.y - (LV.exit.ty + 1) * T) < 40) : LV.fort ? n.x > LV.arenaX + 48 : false;
  const isDoor = n => LV.door && n.c === LV.door.tx && n.y === (LV.door.ty + 1) * T;
  return { nodes, edgesOf, ACTS, start, nodeAt, bfs, isExit, isDoor, keyItem, suit, LV };
}

// проходимость: выход (часовня / арена хозяина крепости), ключ и тайная дверь (дверь — от места, где взят ключ)
export function passability(SK, LV, suit = null){
  const nav = navFor(SK, LV, suit), res = { exit: false, key: null, door: null, nodes: nav.nodes.length };
  if (!nav.start) return res;
  const all = nav.bfs(nav.start);
  res.reached = all.dist.size;
  res.exit = [...all.dist.keys()].some(id => nav.isExit(nav.nodes[id]));
  if (LV.door){
    // узлы, куда приходит ребро, задевшее ключ (или стоя на узле ключ под рукой)
    const keyNodes = new Set();
    for (const id of all.dist.keys()) for (const e of nav.edgesOf(nav.nodes[id])) if (e.key) keyNodes.add(e.to);
    res.key = keyNodes.size > 0;
    res.door = false;
    for (const k of keyNodes){ const r = nav.bfs(nav.nodes[k], n => nav.isDoor(n)); if (r.hit != null){ res.door = true; break; } }
  }
  return res;
}

// ---------- «человеческий» бот ----------
export function playLevel(SK, id, seed, opts = {}){
  const L = SK.logic, T = L.T, K = L.K, rnd = mulberry32(seed * 7919 + 13);
  const ev = [];
  const game = SK.Game({ rng: mulberry32(seed), onEvent: (t, d) => ev.push(t) });
  game.startLevel(id, { lives: opts.lives || K.LIVES, nuts: 0, score: 0, suit: opts.suit || null });
  const S = game.state();
  const navs = {};
  const navOf = suit => navs[suit || 'none'] || (navs[suit || 'none'] = navFor(SK, S.LV, suit || null));
  let frame = 0, plan = null, wait = 0, threat = null, lastStuck = 0, lastX = S.hero.x, cleared = false;
  const react = () => Math.round((0.15 + rnd() * 0.10) * 60);
  function route(nav, from){
    const r = nav.bfs(from, n => nav.isExit(n));
    if (r.hit == null) return null;
    const path = []; let u = r.hit;
    while (u !== from.id){ const p = r.prev.get(u); path.unshift(p.e); u = p.from; }
    return path;
  }
  const maxF = (opts.maxT || 240) * 60;
  while (frame < maxF){
    let inp = { dx: 0, dy: 0, jump: false };
    const P = S.hero;
    if (S.phase === 'play'){
      // враг впереди: заметить (иногда — нет), отреагировать через 150–250 мс прыжком на него
      if (!threat){
        for (const e of S.enemies){
          if (!e.alive || !e.awake || e.k === 'P') continue;
          const dx = e.x - P.x, dy = e.y - P.y;
          if (Math.abs(dx) < 64 && Math.abs(dy) < 30 && (dx * (P.face || 1) > -8)){
            if (rnd() < 0.08) { e._ignored = (e._ignored || 0) + 1; continue; }   // не заметил
            threat = { e, at: frame + react(), hold: 14 + Math.floor(rnd() * 14), dir: Math.sign(dx) || 1 };
            break;
          }
        }
      }
      if (threat && frame >= threat.at){
        if (!threat.started){ threat.started = frame; plan = null; }
        const f = frame - threat.started;
        inp = { dx: threat.dir, dy: 0, jump: f < threat.hold };
        // в прыжке: впереди под ногами пропасть — отпустить/повернуть (как сделал бы человек)
        if (!P.ground && P.vy > 0){ const ax = P.x + threat.dir * 14; let floor = false; for (let r = Math.floor(P.y / T); r < S.LV.h; r++){ const ch = L.tileAt(S.LV, Math.floor(ax / T), r); if (L.isSolid(ch) || ch === 'T' || L.isSlope(ch)) { floor = true; break; } if (ch === '~') break; } if (!floor) inp.dx = -threat.dir; }
        if (f > 4 && P.ground) threat = null;
        else if (f > 80) threat = null;
      } else if (plan && plan.f < plan.len){
        inp = actInput(plan.A, plan.f, P, plan.st); plan.f++;
        if (plan.f >= plan.len) plan = null;
      } else if (wait > 0){ wait--; }
      else if (P.ground && Math.abs(P.vx) < 2 && !P.low){
        const nav = navOf(P.suit);
        const n = nav.nodeAt(P.x, P.y);
        if (n){
          const path = route(nav, n);
          if (path && path.length){
            const e = path[0], A = Object.assign({}, nav.ACTS[e.a]);
            if (A.run != null){ A.run = Math.max(0, A.run + Math.round((rnd() - 0.5) * 4)); A.hold = Math.max(4, A.hold + Math.round((rnd() - 0.5) * 6)); }
            plan = { A, f: 0, st: { air: false }, len: e.f + 2 };
            wait = Math.round(rnd() * 4);
          } else { inp = { dx: 1, dy: 0, jump: (frame % 50) < 20 }; }
        } else inp = { dx: 1, dy: 0, jump: false };
      }
      if (Math.abs(P.x - lastX) > 4){ lastX = P.x; lastStuck = frame; }
      if (frame - lastStuck > 600){ plan = null; threat = null; inp = { dx: rnd() < 0.5 ? 1 : -1, dy: 0, jump: true }; if (frame - lastStuck > 640) lastStuck = frame; }
    } else { plan = null; threat = null; }
    game.setInput(inp.dx, inp.dy, inp.jump);
    game.update(DT); frame++;
    if (ev.includes('clear')) { cleared = true; break; }
    if (S.phase === 'over') break;
  }
  return { won: cleared, seed, id, deaths: S.deaths, lives: S.lives, time: frame / 60, kills: S.kills, stuck: !cleared && S.phase !== 'over', ev };
}
