/* ПОСОХ · tests/bot.mjs — граф проходимости экспедиции по настоящей физике (logic.heroStep) и «человеческий» бот.
   navFor(PS, LV) — узлы «стою здесь» (столбец + ряд опоры; шипы — не опора), рёбра — симуляция макро-действий:
   шаг, прыжок с разбегом 0/8/20/40 кадров и удержанием 5/30 (с рулёжкой и торможением), прыжок на месте и
   ПОГО: прыжок + зажатый ↓, 1…5 отскоков подряд (каждый выше прежнего), рулёжка всё время / только на последнем
   отскоке / с разбегом. Решётка стража, ворота арены, двери тайников и треснувшие камни считаются открытыми, но
   ребро помечается, если героиня прошла через такую клетку (gate / door / crack) — так проверяется доступность
   «без предмета», «до стража» и т. п. Ребро годно, если не было гибели (пропасть, трясина) и шипов без посоха.
   playExp(PS, id, seed, opts) — бот играет как человек: реакция 150–250 мс, разброс моментов нажатий, иногда
   не замечает врага; идёт к арене по графу (без тайников), врагов и хозяев бьёт посохом-пружиной сверху. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const DT = 1 / 60;

export function actionsList(){
  const A = [];
  for (const d of [1, -1]){
    A.push({ d, walk: 6 }); A.push({ d, walk: 18 });
    for (const run of [0, 8, 20, 40]) for (const hold of [5, 30]) { A.push({ d, run, hold, steer: d }); A.push({ d, run, hold, steer: d, brake: true }); }
    A.push({ d, run: 0, hold: 30, steer: 0 });
    for (let nb = 1; nb <= 5; nb++){ A.push({ d, pogo: nb, steer: 'all' }); A.push({ d, pogo: nb, steer: 'last' }); }
    for (const nb of [1, 2]) A.push({ d, pogo: nb, steer: 'all', run: 14 });
  }
  A.push({ d: 0, run: 0, hold: 30, steer: 0 });
  return A;
}
// вход действия A в кадре f; st — состояние исполнения ({ air, b — отскоков, rel — ↓ отпущена })
export function actInput(A, f, P, st){
  let dx = 0, dn = false, jump = false;
  if (A.walk != null){ if (f < A.walk) dx = A.d; return { dx, dn, jump }; }
  if (A.pogo != null){
    const run = A.run || 0;
    if (f < run){ return { dx: A.d, dn: false, jump: false }; }
    const g = f - run;
    jump = g < 30;
    if (!P.ground) st.air = true;
    dn = st.b < A.pogo && g >= 2;
    if (st.b >= A.pogo) st.rel = true;
    if (st.rel && P.ground){ dx = Math.abs(P.vx) > 20 ? (P.vx > 0 ? -1 : 1) : 0; return { dx, dn: false, jump: false }; }
    if (A.steer === 'all') dx = A.d; else dx = st.b >= A.pogo - 1 ? A.d : 0;
    return { dx, dn, jump };
  }
  if (f < A.run) dx = A.d;
  else {
    if (f < A.run + A.hold) jump = true;
    if (!P.ground) st.air = true;
    if (!st.air || !P.ground) dx = f < A.run ? A.d : A.steer;
    if (st.air && P.ground) dx = A.brake && Math.abs(P.vx) > 20 ? (P.vx > 0 ? -1 : 1) : 0;
  }
  return { dx, dn, jump };
}

export function navFor(PS, LV){
  const L = PS.logic, T = L.T, K = L.K;
  // «открытый» мир: c, X, a, D → воздух; исходные клетки — для пометок рёбер
  const g = L.grid(LV), orig = L.grid(LV);
  for (const row of g) for (let x = 0; x < row.length; x++) if ('cXaD'.includes(row[x])) row[x] = '.';
  const W = { LV, g };
  const nodes = [], at = new Map();
  for (let c = 0; c < LV.w; c++) for (let r = 2; r < LV.h; r++){
    const ch = L.tileAt(W, c, r);
    if (!(L.isSolid(ch) || L.isTop(ch)) || ch === '^') continue;
    const a = L.tileAt(W, c, r - 1), b = L.tileAt(W, c, r - 2);
    if (L.isSolid(a) || L.isSolid(b) || a === '~') continue;
    const n = { id: nodes.length, c, r, x: c * T + 8, y: r * T };
    nodes.push(n); at.set(c + ',' + r, n);
  }
  const nodeAt = (x, y) => at.get(Math.floor(x / T) + ',' + Math.round(y / T)) || null;
  const itemBox = (P, it) => { const cx = it.tx * T + 8, cy = it.ty * T + 8; return Math.abs(cx - P.x) < K.HW + 6 && cy + 6 > P.y - K.HH && cy - 6 < P.y; };
  // какие «особые» клетки задевает тело
  function marks(P, m){
    for (let x = P.x - K.HW + 0.5; x <= P.x + K.HW; x += K.HW * 2 - 1) for (let y = P.y - K.HH + 0.5; y < P.y; y += 7){
      const ch = orig[Math.floor(y / T)] && orig[Math.floor(y / T)][Math.floor(x / T)];
      if (ch === 'X') m.gate = true; else if (ch === 'D') m.door = true; else if (ch === 'c') m.crack = true; else if (ch === 'a') m.arena = true;
    }
  }
  const ACTS = actionsList();
  const edges = nodes.map(() => []);
  function sim(n, A){
    const P = L.newHero(n.x, n.y); P.sim = true;
    const st = { air: false, b: 0, rel: false }, items = new Set(), m = {};
    let bad = false, moved = false;
    const ev = (t) => { if (t === 'spike' || t === 'fall' || t === 'drown') bad = true; if (t === 'bounce') st.b++; };
    for (let f = 0; f < 480; f++){
      const inp = actInput(A, f, P, st);
      L.heroStep(W, P, inp, DT, ev);
      if (bad) return null;
      for (const it of LV.items) if (itemBox(P, it)) items.add(it.id);
      marks(P, m);
      if (Math.abs(P.x - n.x) > 2 || Math.abs(P.y - n.y) > 2) moved = true;
      const idle = !inp.dx && !inp.dn && !inp.jump;
      if (idle && P.ground && Math.abs(P.vx) < 1.5 && f > 3){
        if (!moved) return null;
        const to = nodeAt(P.x, P.y); if (!to || to === n) return null;
        return { to: to.id, f, items, m, b: st.b };
      }
    }
    return null;
  }
  for (const n of nodes){
    const seen = new Map();
    ACTS.forEach((A, ai) => {
      const r = sim(n, A); if (!r) return;
      const items = [...r.items].sort((x, y) => x - y), fl = (r.m.gate ? 'g' : '') + (r.m.door ? 'd' : '') + (r.m.crack ? 'c' : '');
      const key = r.to + '|' + items.join(',') + '|' + fl;
      const prev = seen.get(key);
      if (!prev || r.f < prev.f) seen.set(key, { to: r.to, f: r.f, a: ai, items, gate: !!r.m.gate, door: !!r.m.door, crack: !!r.m.crack, pogo: A.pogo || 0 });
    });
    for (const e of seen.values()) edges[n.id].push(e);
  }
  const start = nodeAt(LV.start.tx * T + 8, (LV.start.ty + 1) * T);
  const standItems = nodes.map(n => { const P = L.newHero(n.x, n.y); return LV.items.filter(it => itemBox(P, it)).map(it => it.id); });
  // BFS с фильтром рёбер
  function reachFrom(from, ok){ const seen = new Set([from.id]), q = [from.id]; while (q.length){ const u = q.shift(); for (const e of edges[u]) if (ok(e) && !seen.has(e.to)){ seen.add(e.to); q.push(e.to); } } return seen; }
  // предметы, достижимые при фильтре (стоя на узле или по ребру между достижимыми узлами)
  function itemsReach(ok){
    const R = reachFrom(start, ok), got = new Set();
    for (const u of R){ standItems[u].forEach(i => got.add(i)); for (const e of edges[u]) if (ok(e) && R.has(e.to)) e.items.forEach(i => got.add(i)); }
    return { R, got };
  }
  // узлы, с которых удар посохом ломает клетку c (стоя вплотную, лицом к ней)
  function crackFrom(){
    const out = new Set();
    for (const n of nodes) for (const d of [1, -1]){
      const fx = Math.floor((n.x + d * (K.HW + 8)) / T);
      for (let ty = Math.floor((n.y - K.HH + 1) / T); ty <= Math.floor((n.y - 1) / T); ty++) if (orig[ty] && orig[ty][fx] === 'c') out.add(fx + ',' + ty + '|' + n.id);
    }
    return out;
  }
  return { nodes, edges, ACTS, start, nodeAt, standItems, reachFrom, itemsReach, crackFrom, orig, W };
}

// сводка проходимости экспедиции
export function passability(PS, LV, nav){
  nav = nav || navFor(PS, LV);
  const T = PS.logic.T;
  const near = (n, tx, ty, dx = 1) => Math.abs(n.c - tx) <= dx && n.r === ty + 1;
  const all = nav.itemsReach(() => true), noDoor = nav.itemsReach(e => !e.door), noGate = nav.itemsReach(e => !e.gate && !e.door);
  const guardOk = [...noGate.R].some(u => { const n = nav.nodes[u]; return Math.abs(n.c - LV.guardAt.tx) <= 6 && n.r === LV.guardAt.ty + 1; });
  const arenaNodes = nav.nodes.filter(n => n.c > LV.arenaX + 3 && n.r === LV.bossAt.ty + 1);
  const bossOk = arenaNodes.some(n => noDoor.R.has(n.id));
  const itemOk = LV.items.filter(i => i.k === 'item').every(i => noDoor.got.has(i.id));
  const relic = LV.items.filter(i => i.k === 'relic');
  const relicOk = relic.every(i => all.got.has(i.id) && !noDoor.got.has(i.id));
  return { nav, all, noDoor, noGate, guardOk, bossOk, itemOk, relicOk, gemsOk: LV.items.filter(i => i.k === 'gem' || i.k === 'big').filter(i => all.got.has(i.id)).length, gems: LV.items.filter(i => i.k === 'gem' || i.k === 'big').length, near };
}

// ---------------- «человеческий» бот ----------------
export function playExp(PS, id, seed, opts = {}){
  const L = PS.logic, T = L.T, K = L.K;
  const rnd = mulberry32(seed * 7919 + 13);
  const react = opts.react || [0.15, 0.25], timing = opts.timing == null ? 1.5 : opts.timing, miss = opts.miss == null ? 0.1 : opts.miss;
  const ev = [];
  let bounces = 0;
  const game = PS.Game({ rng: mulberry32(seed), god: !!opts.god, onEvent: (t, d) => { ev.push(t); if (t === 'bounce') bounces++; } });
  game.start(id, { lives: opts.lives || 3, items: opts.items || {} });
  const S = game.state(), LV = S.LV;
  const nav = opts.nav || navFor(PS, LV);
  const maxT = opts.maxT || 300;
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 0.9; };
  const fails = new Map(), fk = (u, e) => u + ':' + e.a + ':' + e.to, pen = (u, e) => (fails.get(fk(u, e)) || 0) * 300;
  let frame = 0;
  const hist = [];   // запаздывающее восприятие цели (реакция)
  function tick(dx, dn, jump){ game.setInput(dx, dn, jump); game.update(DT); frame++; }
  function curNode(){ const P = S.hero; return nav.nodeAt(P.x, P.y); }
  function route(from){
    const gateOpen = !S.guard.alive;
    const ok = e => !e.door && !e.crack && (gateOpen || !e.gate);
    const dist = new Map([[from.id, 0]]), prev = new Map(), done = new Set(), pq = [[0, from.id]];
    while (pq.length){
      pq.sort((a, b) => a[0] - b[0]); const [d, u] = pq.shift(); if (done.has(u)) continue; done.add(u);
      for (const e of nav.edges[u]){ if (!ok(e)) continue; const nd = d + e.f + 20 + pen(u, e) + (e.pogo ? 25 : 0); if (nd < (dist.get(e.to) ?? 1e9)){ dist.set(e.to, nd); prev.set(e.to, { u, e }); pq.push([nd, e.to]); } }
    }
    // цель — самая правая достижимая точка (к стражу, потом к арене)
    let best = null; for (const [v] of dist){ const n = nav.nodes[v]; if (!best || n.c > best.c || (n.c === best.c && n.r > best.r)) best = n; }
    if (!best || best.id === from.id) return null;
    const p = []; let v = best.id; while (v !== from.id){ const s = prev.get(v); p.unshift(s.e); v = s.u; }
    return p;
  }
  let exec = null, wait = 0, enemyCd = 0, attack = null, stuck = 0;
  function startExec(e){
    const A = Object.assign({}, nav.ACTS[e.a]);
    if (A.run != null && A.pogo == null) A.run = Math.max(0, A.run + Math.round(gauss() * timing));
    if (A.hold != null) A.hold = Math.max(3, A.hold + Math.round(gauss() * timing));
    exec = { A, f: 0, st: { air: false, b: 0, rel: false }, to: e.to, e, from: curNode(), b0: bounces };
  }
  function foe(){
    const P = S.hero;
    for (const b of [S.boss, S.guard]) if (b && b.alive && b.awake && Math.abs(b.x - P.x) < 14 * T) return b;
    return null;
  }
  for (; frame < maxT * 60;){
    const P = S.hero;
    if (S.phase === 'clear') return res(true);
    if (S.phase === 'over') return res(false);
    if (S.phase !== 'play'){ tick(0, false, false); exec = null; attack = null; wait = 0; hist.length = 0; continue; }
    if (enemyCd > 0) enemyCd -= DT;
    // ключ после хозяина — подобрать
    if (S.keyDrop && !S.keyGot){ const d = S.keyDrop.x - P.x; tick(Math.abs(d) > 4 ? Math.sign(d) : 0, false, false); continue; }
    // бой со стражем/хозяином: пого-«танец» над ним, цель — с запаздыванием реакции
    const B = foe();
    if (B){
      exec = null;
      hist.push({ x: B.x, top: B.y - B.h, st: B.st });
      const lag = Math.round((react[0] + (react[1] - react[0]) * 0.5) * 60);
      const seen = hist.length > lag ? hist[hist.length - 1 - lag] : hist[0];
      if (hist.length > 120) hist.shift();
      const high = P.y - seen.top > 7 * T;                    // слишком высоко (летун парит) — ждём, держась в стороне
      const dx0 = seen.x - P.x;
      let dx = Math.abs(dx0) > 5 ? Math.sign(dx0) : 0;
      if (high){ dx = Math.abs(dx0) < 3 * T ? -Math.sign(dx0 || 1) : 0; tick(dx, false, false); continue; }
      if (P.ground){
        if (!attack){ attack = { t: react[0] + rnd() * (react[1] - react[0]) }; }
        attack.t -= DT;
        if (attack.t > 0){ tick(0, false, false); continue; }
        tick(dx, true, true); continue;
      }
      attack = null;
      tick(dx, true, P.vy < 0);
      continue;
    }
    hist.length = 0;
    // мелкие враги: заметил → реакция → прыжок на посохе на врага
    if (attack && attack.e){
      const e = attack.e;
      if (attack.t > 0){ attack.t -= DT; tick(0, false, false); continue; }
      attack.f = (attack.f || 0) + 1;
      if (!e.alive || attack.f > 150 || (attack.f > 10 && P.ground)){ attack = null; tick(0, false, false); continue; }
      const dx0 = e.x - P.x; tick(Math.abs(dx0) > 4 ? Math.sign(dx0) : 0, attack.f > 2 && !attack.hit, attack.f < 25);
      if (bounces > attack.b0) attack.hit = true;
      continue;
    }
    if (!exec && P.ground && enemyCd <= 0){
      const e = S.enemies.find(e => e.alive && Math.abs(e.x - P.x) < 4 * T && e.y - P.y < 20 && P.y - e.y < 3 * T);
      if (e){ enemyCd = 0.8; if (rnd() > miss){ attack = { e, t: react[0] + rnd() * (react[1] - react[0]), b0: bounces }; continue; } }
    }
    if (exec){
      exec.st.b = bounces - exec.b0;
      const inp = actInput(exec.A, exec.f, P, exec.st);
      exec.f++; tick(inp.dx, inp.dn, inp.jump);
      const idle = !inp.dx && !inp.dn && !inp.jump;
      if ((idle && P.ground && Math.abs(P.vx) < 1.5 && exec.f > 3) || exec.f > 480){
        const at = curNode();
        if ((!at || at.id !== exec.to) && exec.from){ const key = fk(exec.from.id, exec.e); fails.set(key, (fails.get(key) || 0) + 1); }
        exec = null;
      }
      continue;
    }
    if (wait > 0){ wait -= DT; tick(0, false, false); continue; }
    if (!P.ground || Math.abs(P.vx) > 1.5){ tick(0, false, false); continue; }
    const n = curNode();
    if (!n){ tick(rnd() < 0.5 ? 1 : -1, false, false); continue; }
    if (Math.abs(P.x - n.x) > 2){ tick(P.x < n.x ? 1 : -1, false, false); tick(0, false, false); continue; }
    const steps = route(n);
    if (!steps || !steps.length){ stuck++; if (stuck > 600) return res(false, true); tick(0, false, false); continue; }
    startExec(steps[0]);
    const rt = react[0] + rnd() * (react[1] - react[0]);
    for (let i = 0; i < Math.round(rt * 60); i++) tick(0, false, false);
  }
  return res(false, true);
  function res(won, timeout){ return { won, seed, id, bag: S.bag, deaths: S.deaths, lives: S.lives, hurts: S.hurts, kills: S.kills, time: frame / 60, stuck: !!timeout && !won, ev }; }
}
