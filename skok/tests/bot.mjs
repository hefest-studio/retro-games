/* СКОК · tests/bot.mjs — граф проходимости уровня по настоящей физике (L.heroStep) и «человеческий» бот.
   navFor(SK, LV, wound) — узлы «стою здесь» (столбец + высота опоры), рёбра — симуляция макро-действий с места: шаг
   (короткий/длинный/долгий — для пружинных плит), прыжок с разбегом 0/10/24/48 кадров и удержанием 8/30 кадров, с торможением
   после приземления и без, прыжок на месте. wound = true — механизмы заведены (мосты выдвинуты, плиты подбрасывают);
   враги и молоты не учитываются. Ребро годно, если герой не упал в пропасть/смолу, не встал на шипы и остановился на узле.
   playLevel(SK, id, seed, opts) — бот играет как человек: реакция 150–250 мс, разброс нажатий; идёт к детали по графу
   «с заводом», по пути бьёт ключом по лебёдкам (если механизм впереди и завода мало), останавливает и разбирает врагов
   перед собой, ждёт, пока заведённый враг подойдёт под удар; в крепости бьёт хозяина, пока тот подзаводится. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const DT = 1 / 60;

export function actionsList(){
  const A = [];
  for (const d of [1, -1]){
    for (const w of [6, 18, 40, 70, 100]) A.push({ d, walk: w });
    for (const run of [0, 10, 24, 48]) for (const hold of [8, 30]){ A.push({ d, run, hold, steer: d }); A.push({ d, run, hold, steer: d, brake: true }); }
    A.push({ d, run: 0, hold: 30, steer: 0 });
  }
  A.push({ d: 0, run: 0, hold: 30, steer: 0 });
  return A;
}
export function actInput(A, f, P, st){
  let dx = 0, jump = false;
  if (A.walk != null){ if (f < A.walk) dx = A.d; return { dx, jump }; }
  if (f < A.run) dx = A.d;
  else {
    if (f < A.run + A.hold) jump = true;
    if (!P.ground) st.air = true;
    if (!st.air || !P.ground) dx = f < A.run ? A.d : A.steer;
    if (st.air && P.ground) dx = A.brake && Math.abs(P.vx) > 20 ? (P.vx > 0 ? -1 : 1) : 0;
  }
  return { dx, jump };
}

export function navFor(SK, LV0, wound = true, robust = true){
  const L = SK.logic, T = L.T, LV = wound ? L.woundCopy(LV0) : LV0, W = { LV, plats: [] };
  const nodes = [], at = new Map();
  const key = (c, y) => c + ',' + Math.round(y / 8);
  for (let c = 0; c < LV.w; c++) for (let r = 1; r < LV.h; r++){
    const ch = L.tileAt(LV, c, r), a = L.tileAt(LV, c, r - 1), b = L.tileAt(LV, c, r - 2);
    if (a === '~' || L.isSolid(a)) continue;
    let y = null;
    if ((L.isSolid(ch) || L.isBoard(ch)) && !L.isSlope(a) && !L.isSolid(b)) { if (ch === '^' || ch === 'Q') continue; y = r * T; }
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
  const ACTS = actionsList();
  const edges = new Map();
  function sim(n, A){
    const P = L.newHero(n.x + (A.dx0 || 0), n.y), st = { air: false };
    let moved = false;
    for (let f = 0; f < 360; f++){
      const inp = actInput(A, f, P, st);
      L.heroStep(W, P, inp, DT, null);
      if (L.hazard(LV, P)) return null;
      if (Math.abs(P.x - n.x) > 3 || Math.abs(P.y - n.y) > 2) moved = true;
      if (!inp.dx && !inp.jump && P.ground && P.under !== 'Q' && Math.abs(P.vx) < 1.5 && f > 3){
        if (!moved) return null;
        const m = nodeAt(P.x, P.y); if (!m || m === n) return null;
        return { to: m.id, f };
      }
    }
    return null;
  }
  function edgesOf(n){
    if (edges.has(n.id)) return edges.get(n.id);
    const seen = new Map();
    ACTS.forEach((A, ai) => {
      const r = sim(n, A); if (!r) return;
      // «по-человечески» надёжное ребро: разбег ±2 кадра и удержание ±4 кадра ведут туда же
      if (A.run != null && robust){ for (const v of [{ run: A.run + 2 }, { run: Math.max(0, A.run - 2) }, { hold: A.hold + 4 }, { hold: Math.max(4, A.hold - 4) }, { dx0: -2 }, { dx0: 2 }]){ const r2 = sim(n, Object.assign({}, A, v)); if (!r2 || r2.to !== r.to) return; } }
      const prev = seen.get(r.to); if (!prev || r.f < prev.f) seen.set(r.to, { to: r.to, f: r.f, a: ai });
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
  const isExit = n => LV.exit ? (Math.abs(n.x - (LV.exit.tx * T + 8)) < 14 && Math.abs(n.y - (LV.exit.ty + 1) * T) < 2) : LV.fort ? n.x > LV.arenaX + 48 : false;
  return { nodes, edgesOf, ACTS, start, nodeAt, bfs, isExit, LV };
}

export function passability(SK, LV, wound = true){
  const nav = navFor(SK, LV, wound), res = { exit: false, nodes: nav.nodes.length, reached: 0, winches: [] };
  if (!nav.start) return res;
  const all = nav.bfs(nav.start);
  res.reached = all.dist.size;
  res.exit = [...all.dist.keys()].some(id => nav.isExit(nav.nodes[id]));
  // до каждой лебёдки можно дойти (узел в 2 клетках от неё)
  const T = SK.logic.T;
  res.winches = LV.groups.map(gr => [...all.dist.keys()].some(id => { const n = nav.nodes[id]; return Math.abs(n.x - (gr.winch.tx * T + 8)) <= 2 * T && Math.abs(n.y - (gr.winch.ty + 1) * T) <= T; }));
  return res;
}

// ---------- «человеческий» бот ----------
export function playLevel(SK, id, seed, opts = {}){
  const L = SK.logic, T = L.T, K = L.K, rnd = mulberry32(seed * 7919 + 13);
  const ev = [];
  const game = SK.Game({ rng: mulberry32(seed), god: !!opts.god, onEvent: (t) => ev.push(t) });
  game.startLevel(id, { lives: opts.lives || K.LIVES });
  const S = game.state(), LV = S.LV, nav = navFor(SK, LV, true);
  let frame = 0, plan = null, wait = 0, lastStuck = 0, lastX = S.hero.x, cleared = false, strikeAt = -1, waitEnemy = 0;
  const react = () => Math.round((0.15 + rnd() * 0.10) * 60);
  function route(from){
    const r = nav.bfs(from, n => nav.isExit(n));
    if (r.hit == null) return null;
    const path = []; let u = r.hit;
    while (u !== from.id){ const p = r.prev.get(u); path.unshift(p.e); u = p.from; }
    return path;
  }
  const inReach = (P, x, y, hw, h) => { const f = P.face || 1, x0 = f > 0 ? P.x + 1 : P.x - K.REACH, x1 = f > 0 ? P.x + K.REACH : P.x - 1; return x + hw >= x0 && x - hw <= x1 && y >= P.y - K.HH - 6 && y - h <= P.y + 2; };
  const maxF = (opts.maxT || 300) * 60;
  while (frame < maxF){
    let inp = { dx: 0, jump: false };
    const P = S.hero;
    if (S.phase === 'play'){
      if (strikeAt >= 0 && frame >= strikeAt){ game.strike(); strikeAt = -1; }
      let override = null;
      // хозяин крепости: держать дистанцию, бить, пока подзаводится
      const B = S.boss;
      if (B && B.alive && B.st !== 'sleep'){
        const dx = B.x - P.x;
        const bolt = S.bolts.some(b => Math.abs(b.x - P.x) < 56 || (b.x - P.x) * Math.sign(B.x - P.x) > 0);
        if (B.st === 'wind' && bolt && Math.abs(dx) > 26) override = { dx: 0, jump: false };   // болты ещё летят — переждать
        else if (B.st === 'wind'){ if (Math.abs(dx) > 18) override = { dx: Math.sign(dx), jump: false }; else { override = { dx: frame % 2 ? Math.sign(dx) : 0, jump: false }; if (strikeAt < 0 && P.face === Math.sign(dx)) strikeAt = frame + react(); } }
        else if (Math.abs(dx) < 90){ const away = -Math.sign(dx) || -1, wall = P.x < LV.arenaX + 24 || P.x > LV.w * T - 40; override = { dx: wall ? -away : away, jump: wall || (B.st === 'leap' && Math.abs(dx) < 50) }; }
      }
      // лебёдка рядом, механизм впереди, завода мало — подойти и ударить
      if (!override && P.ground) for (const gr of LV.groups){
        if (gr.t > 4) continue;
        const wx = gr.winch.tx * T + 8, wy = (gr.winch.ty + 1) * T, dx = wx - P.x;
        if (Math.abs(dx) > 90 || Math.abs(wy - P.y) > 20 || !gr.tiles.some(q => q.tx * T > P.x - 8)) continue;
        if (Math.abs(dx) > 14 || (P.face || 1) !== (Math.sign(dx) || 1)) override = { dx: Math.abs(dx) > 14 ? Math.sign(dx) : (Math.sign(dx) || 1), jump: false };
        else if (strikeAt < 0 && P.ground) { strikeAt = frame + react(); override = { dx: 0, jump: false }; }
        else override = { dx: 0, jump: false };
        break;
      }
      // враг перед собой: в досягаемости — удар (остановить, потом разобрать); ближе 80 px — ждать, пока подойдёт
      if (!override && !P.ground){   // в прыжке план не ломаем: враг под ударом — просто ударить
        for (const e of S.enemies) if (e.alive && e.k !== 'P' && e.k !== 'Z' && !e.stop && inReach(P, e.x, e.y, e.hw, e.h) && strikeAt < 0) strikeAt = frame + react();
      } else if (!override){
        let near = null;
        for (const e of S.enemies){
          if (!e.alive || e.k === 'P' || e.k === 'Z') continue;
          const dx = e.x - P.x, dy = e.y - P.y;
          if (Math.abs(dy) > 34 || Math.abs(dx) > 80) continue;
          if (e.stop > 0 && e.stop < 1.5 && Math.abs(dx) < 40 && inReach(P, e.x, e.y, e.hw, e.h)) { near = e; break; }
          if (e.stop > 0) continue;
          if (!near || Math.abs(dx) < Math.abs(near.x - P.x)) near = e;
        }
        if (near){
          const dx = near.x - P.x;
          if (inReach(P, near.x, near.y, near.hw, near.h) || (Math.abs(dx) < 30 && P.face !== Math.sign(dx))){
            if (P.face !== (Math.sign(dx) || 1)) override = { dx: Math.sign(dx) || 1, jump: false };
            else { if (strikeAt < 0 && rnd() > 0.04) strikeAt = frame + react(); override = { dx: 0, jump: false }; }
            waitEnemy = 0; plan = null;
          } else if (Math.abs(dx) < 80 && waitEnemy < 90 && P.ground && Math.sign(dx) === (plan ? plan.A.d : 1)){ waitEnemy++; override = { dx: 0, jump: false }; plan = null; }
        } else waitEnemy = 0;
      }
      if (override) { inp = override; plan = null; }
      else if (plan && plan.f < plan.len){ inp = actInput(plan.A, plan.f, P, plan.st); plan.f++; if (plan.f >= plan.len) plan = null; }
      else if (wait > 0){ wait--; }
      else if (P.ground && Math.abs(P.vx) < 2){
        const n = nav.nodeAt(P.x, P.y);
        const path = n && Math.abs(P.x - n.x) <= 1.2 ? route(n) : null;
        if (n && Math.abs(P.x - n.x) > 1.2) inp = { dx: Math.sign(n.x - P.x), jump: false };   // встать на середину клетки (как в графе)
        else
        if (path && path.length){
          const e = path[0], A = Object.assign({}, nav.ACTS[e.a]);
          if (A.run != null){ A.run = Math.max(0, A.run + Math.round((rnd() - 0.5) * 4)); A.hold = Math.max(4, A.hold + Math.round((rnd() - 0.5) * 8)); }
          plan = { A, f: 0, st: { air: false }, len: e.f + 2 };
          wait = Math.round(rnd() * 4);
        } else if (!n) inp = { dx: 1, jump: (frame % 50) < 20 };
      }
      if (Math.abs(P.x - lastX) > 4){ lastX = P.x; lastStuck = frame; }
      if (frame - lastStuck > 600){ plan = null; inp = { dx: rnd() < 0.5 ? 1 : -1, jump: true }; if (frame - lastStuck > 640) lastStuck = frame; }
    } else { plan = null; strikeAt = -1; }
    game.setInput(inp.dx, inp.jump);
    game.update(DT); frame++;
    if (ev.includes('clear')) { cleared = true; break; }
    if (S.phase === 'over') break;
  }
  return { won: cleared, seed, id, deaths: S.deaths, lives: S.lives, hits: S.hits, time: frame / 60, kills: S.kills, stops: S.stops, score: S.score, stuck: !cleared && S.phase !== 'over' };
}
