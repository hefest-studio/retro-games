/* ЛЕДНИК · tests/bot.mjs — граф проходимости уровня по настоящей физике (L.heroStep) и «человеческий» бот.
   navFor(LD, LV) — узлы «стою здесь» (столбец + ряд опоры), рёбра — симуляция макро-действий с места:
   шаг (короткий/длинный), прыжок с разбегом 0/8/20/40 кадров и удержанием 5/30 кадров (с рулёжкой в сторону
   разбега), прыжок вверх, подкат (под низкие своды), подкат-прыжок, подъём/спуск по сосульке. Лёд, сугробы,
   односторонние уступы и мосты — та же физика, что в игре (мосты считаются целыми, ветра нет, враги не учитываются).
   Ребро годно, если герой не упал в пропасть/прорубь, не задел шипы и остановился на узле. По ходу ребра
   записываются задетые предметы. foxItems — что Бураш достанет с узла (бег по ряду ног, щели «%» проходимы).
   playLevel(LD, id, seed, opts) — бот играет как человек: реакция 150–250 мс, разброс моментов нажатия, иногда
   не замечает врага. Идёт к ближайшим припасам по графу, пока не наберёт норму (+ «по пути»), потом к стойбищу. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const DT = 1 / 60;

export function actionsList(){
  const A = [];
  for (const d of [1, -1]){
    A.push({ d, walk: 6 }); A.push({ d, walk: 18 });
    for (const run of [0, 8, 20, 40]) for (const hold of [5, 30]) { A.push({ d, run, hold, steer: d }); A.push({ d, run, hold, steer: d, brake: true }); }
    A.push({ d, run: 0, hold: 30, steer: 0 });
    A.push({ d, slide: 40 }); A.push({ d, slide: 90 });
    A.push({ d, slide: 12, sjump: 30 });
  }
  A.push({ d: 0, run: 0, hold: 30, steer: 0 });
  A.push({ climb: -1 }); A.push({ climb: 1 });
  return A;
}

// входы действия A в кадре f (st — состояние исполнения)
export function actInput(A, f, P, st){
  let dx = 0, dy = 0, jump = false;
  if (A.climb){ dy = A.climb; return { dx, dy, jump }; }
  if (A.walk != null){ if (f < A.walk) dx = A.d; return { dx, dy, jump }; }
  if (A.slide != null){
    if (A.sjump){ dx = A.d; if (f >= 6 && f < 6 + A.slide) dy = 1; if (f >= 6 + A.slide && f < 6 + A.slide + A.sjump) jump = true; if (f >= 6 + A.slide && st.air && P.ground) dx = 0; if (!P.ground) st.air = true; return { dx, dy, jump }; }
    if (f < 6 + A.slide) { dx = A.d; if (f >= 6) dy = 1; }
    else if (P.low && !P.slide) dx = A.d;   // под сводом — ползком
    return { dx, dy, jump };
  }
  // прыжок
  if (f < A.run) dx = A.d;
  else {
    if (f < A.run + A.hold) jump = true;
    if (!P.ground) st.air = true;
    if (!st.air || !P.ground) dx = f < A.run ? A.d : A.steer;
    if (st.air && P.ground) dx = A.brake && Math.abs(P.vx) > 20 ? (P.vx > 0 ? -1 : 1) : 0;
  }
  return { dx, dy, jump };
}

export function navFor(LD, LV){
  const L = LD.logic, T = L.T, K = L.K, W = { LV, br: null, time: 0, wind: false };
  const nodes = [], at = new Map();
  for (let c = 0; c < LV.w; c++) for (let r = 1; r < LV.h; r++){
    const ch = L.tileAt(LV, c, r);
    if (!(L.isSolid(ch) || L.isTop(W, c, r))) continue;
    const a = L.tileAt(LV, c, r - 1), b = L.tileAt(LV, c, r - 2);
    if (L.isSolid(a) || L.isSolid(b) || a === '^' || a === '~') continue;
    const n = { id: nodes.length, c, r, x: c * T + 8, y: r * T };
    nodes.push(n); at.set(c + ',' + r, n);
  }
  const nodeAt = (x, y) => at.get(Math.floor(x / T) + ',' + Math.round(y / T)) || null;
  const itemBox = (P, it) => { const h = L.heightOf(P), cx = it.tx * T + 8, cy = it.ty * T + 8; return Math.abs(cx - P.x) < K.HW + 6 && cy + 6 > P.y - h && cy - 6 < P.y; };
  const hazard = P => {
    if (P.y > LV.h * T + 24 || L.tilePx(LV, P.x, P.y - 4) === '~') return true;
    const h = L.heightOf(P);
    for (let x = P.x - K.HW + 1; x <= P.x + K.HW; x += K.HW * 2 - 2) for (let y = P.y - 1; y >= P.y - h + 1; y -= 6){ const ty = Math.floor(y / T); if (L.tileAt(LV, Math.floor(x / T), ty) === '^' && y > ty * T + 6) return true; }
    return false;
  };
  const ACTS = actionsList();
  const edges = nodes.map(() => []);
  function sim(n, A){
    const P = L.newHero(n.x, n.y); P.sim = true;
    if (A.climb === -1 && L.columnAt(LV, P) == null) return null;
    if (A.climb === 1){ const tx = Math.floor(P.x / T); if (!(L.tileAt(LV, tx, n.r) === '|' && L.tileAt(LV, tx, n.r - 1) !== '|')) return null; }
    const st = { air: false }, items = new Set();
    let moved = false;
    for (let f = 0; f < 420; f++){
      const inp = actInput(A, f, P, st);
      L.heroStep(W, P, inp, DT, null);
      if (hazard(P)) return null;
      for (const it of LV.items) if (itemBox(P, it)) items.add(it.id);
      if (Math.abs(P.x - n.x) > 2 || Math.abs(P.y - n.y) > 2) moved = true;
      const idle = !inp.dx && !inp.dy && !inp.jump;
      if (A.climb && !P.climb && f > 2) { if (!P.ground) continue; const m = nodeAt(P.x, P.y); return m && m !== n ? { to: m.id, f, items } : null; }
      if (idle && P.ground && !P.climb && !P.low && Math.abs(P.vx) < 1.5 && f > 3){
        if (!moved) return null;
        const m = nodeAt(P.x, P.y); if (!m || m === n) return null;
        return { to: m.id, f, items };
      }
    }
    return null;
  }
  for (const n of nodes){
    const seen = new Map();
    ACTS.forEach((A, ai) => {
      const r = sim(n, A); if (!r) return;
      // одно и то же место с разными наборами предметов — разные рёбра (берём самое быстрое)
      const items = [...r.items].sort((x, y) => x - y), key = r.to + '|' + items.join(',');
      const prev = seen.get(key);
      if (!prev || r.f < prev.f) seen.set(key, { to: r.to, f: r.f, a: ai, items });
    });
    for (const e of seen.values()) edges[n.id].push(e);
  }
  const start = nodeAt(LV.start.tx * T + 8, (LV.start.ty + 1) * T);
  // стоя на узле — предметы, что задевает герой
  const standItems = nodes.map(n => { const P = L.newHero(n.x, n.y); return LV.items.filter(it => itemBox(P, it)).map(it => it.id); });
  // Бураш: с узла в обе стороны
  const foxItems = nodes.map(n => foxFrom(LD, LV, n));
  function bfs(from){ const dist = new Map([[from.id, 0]]), q = [from.id]; while (q.length){ const u = q.shift(); for (const e of edges[u]) if (!dist.has(e.to)){ dist.set(e.to, dist.get(u) + 1); q.push(e.to); } } return dist; }
  const reach = start ? bfs(start) : new Map();
  // обратный граф: откуда достижим выход
  const exitNodes = nodes.filter(n => LV.exit && Math.abs(n.x - (LV.exit.tx * T + 8)) < 14 && Math.abs(n.y - (LV.exit.ty + 1) * T) < 24);
  const rev = nodes.map(() => []); nodes.forEach(n => edges[n.id].forEach(e => rev[e.to].push(n.id)));
  const back = new Set(exitNodes.map(n => n.id)), q = [...back];
  while (q.length){ const u = q.shift(); for (const v of rev[u]) if (!back.has(v)){ back.add(v); q.push(v); } }
  return { nodes, edges, ACTS, start, nodeAt, reach, back, exitNodes, standItems, foxItems, itemBox };
}

// какие предметы достанет Бураш, стоя герою на узле n (все по очереди, вплоть до первой преграды)
export function foxFrom(LD, LV, n){
  const L = LD.logic, T = L.T, K = L.K, W = { LV, br: null };
  const out = [], ty = n.r - 1;
  for (const d of [1, -1]){
    for (let x = n.x; Math.abs(x - n.x) <= K.FOX_RANGE * T; x += d * 4){
      const front = x + d * 5, tx = Math.floor(front / T), ch = L.tileAt(LV, tx, ty);
      const fl = L.tileAt(LV, tx, ty + 1), floorOk = L.isSolid(fl) || fl === 's' || L.isTop(W, tx, ty + 1);
      const pass = ch === '.' || ch === '%' || ch === 's' || ch === 'T' || ch === '-' || ch === '|';
      if (!pass || !floorOk) break;
      for (const it of LV.items) if (it.tx === Math.floor(x / T) && it.ty === ty && !out.includes(it.id)) out.push(it.id);
    }
  }
  return out;
}

// сводка проходимости: какие предметы реально можно собрать и вернуться к выходу
export function passability(LD, LV, nav){
  nav = nav || navFor(LD, LV);
  const ok = new Set(), any = new Set();
  for (const [u] of nav.reach){
    const live = nav.back.has(u);
    nav.standItems[u].forEach(i => { any.add(i); if (live) ok.add(i); });
    nav.foxItems[u].forEach(i => { any.add(i); if (live) ok.add(i); });
    for (const e of nav.edges[u]) if (nav.reach.has(e.to)) e.items.forEach(i => { any.add(i); if (live && nav.back.has(e.to)) ok.add(i); });
  }
  const supIds = new Set(LV.items.filter(it => it.k === 'food' || it.k === 'hide' || it.k === 'flint' || it.k === 'hidden').map(it => it.id));
  const supOk = [...ok].filter(i => supIds.has(i)).length;
  const exitOk = nav.start && nav.exitNodes.some(n => nav.reach.has(n.id));
  return { nav, ok, any, supOk, exitOk, keyOk: LV.items.filter(it => it.k === 'key').every(it => ok.has(it.id)) };
}

// ---------------- «человеческий» бот ----------------
export function playLevel(LD, id, seed, opts = {}){
  const L = LD.logic, T = L.T;
  const rnd = mulberry32(seed * 7919 + 13);
  const react = opts.react || [0.15, 0.25], timing = opts.timing == null ? 1.5 : opts.timing, miss = opts.miss == null ? 0.12 : opts.miss;
  const ev = [];
  const game = LD.Game({ rng: mulberry32(seed), god: !!opts.god, onEvent: (t, d) => ev.push(t) });
  game.startLevel(id, { lives: opts.lives || 3 });
  const S = game.state(), LV = S.LV;
  const nav = opts.nav || navFor(LD, LV);
  const pass = passability(LD, LV, nav);
  const maxT = opts.maxT || 240;
  let plan = null, wait = 0, frame = 0, stuck = 0, lastSup = 0, lastProgressT = 0;
  const fails = new Map(), fk = (u, e) => u + ':' + e.a + ':' + e.to, pen = (u, e) => (fails.get(fk(u, e)) || 0) * 300;
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 0.9; };
  function curNode(){ const P = S.hero; return nav.nodeAt(P.x, P.y); }
  function route(from){
    // Дейкстра по кадрам → ближайшая цель
    const dist = new Map([[from.id, 0]]), prev = new Map(), done = new Set();
    const pq = [[0, from.id]];
    while (pq.length){
      pq.sort((a, b) => a[0] - b[0]); const [d, u] = pq.shift(); if (done.has(u)) continue; done.add(u);
      for (const e of nav.edges[u]){ if (!nav.back.has(e.to)) continue; const nd = d + e.f + 20 + pen(u, e); if (nd < (dist.get(e.to) ?? 1e9)){ dist.set(e.to, nd); prev.set(e.to, { u, e }); pq.push([nd, e.to]); } }
    }
    const path = to => { const p = []; let v = to; while (v !== from.id){ const s = prev.get(v); if (!s) return null; p.unshift(s.e); v = s.u; } return p; };
    return { dist, prev, path };
  }
  function pickTarget(n){
    const R = route(n), want = S.sup < LV.need + (opts.greedy ? 99 : 2);
    let best = null;
    if (want){
      // предметы: на узле (стоя), через Бураша, на рёбрах
      for (const [v, d] of R.dist){
        if (nav.foxItems[v].some(i => !S.got[i]) && (!best || d < best.d)) best = { d, v, fox: true };
        for (const e of nav.edges[v]) if (nav.back.has(e.to) && e.items.some(i => !S.got[i] && LV.items[i].k !== 'heart')){ const dd = d + e.f + pen(v, e); if (!best || dd < best.d) best = { d: dd, v, edge: e }; }
      }
    }
    if (!best || (S.sup >= LV.need && best.d > 400)){
      let ex = null; for (const x of nav.exitNodes){ const d = R.dist.get(x.id); if (d != null && (!ex || d < ex.d)) ex = { d, v: x.id, exit: true }; }
      if (ex) best = ex;
    }
    if (!best) return null;
    const p = R.path(best.v) || [];
    if (best.edge) p.push(best.edge);
    return { steps: p, fox: best.fox, exit: best.exit, v: best.v };
  }
  function foxDir(v){
    const n = nav.nodes[v];
    for (const d of [1, -1]){ const ids = foxFrom(LD, LV, n).filter(i => !S.got[i]); if (!ids.length) continue;
      const it = LV.items[ids[0]]; return it.tx * T + 8 > n.x ? 1 : -1; }
    return 1;
  }
  // сплошной пол между столбцами c0..c1 на ряду r (без шипов/воды над ним)
  function solidRun(r, c0, c1){
    const a = Math.min(c0, c1), b = Math.max(c0, c1);
    for (let c = a; c <= b; c++){ const ch = L.tileAt(LV, c, r), up = L.tileAt(LV, c, r - 1), up2 = L.tileAt(LV, c, r - 2);
      if (!(L.isSolid(ch) || L.isTop({ LV, br: null }, c, r)) || up === '^' || up === '~' || L.isSolid(up) || L.isSolid(up2)) return false; }
    return true;
  }
  // подряд идущие рёбра по одному ряду и сплошному полу → одна пробежка
  function runSpan(steps, from){
    let k = 0, cur = from;
    while (k < steps.length){ const to = nav.nodes[steps[k].to]; if (steps[k].items.some(i => !S.got[i]) || to.r !== cur.r || Math.abs(to.c - cur.c) > 3 || !solidRun(cur.r, cur.c, to.c)) break; cur = to; k++; }
    return k >= 1 && cur !== from ? { k, to: cur } : null;
  }
  // исполнение одного ребра
  let exec = null;
  function startExec(e){
    const A = nav.ACTS[e.a];
    const j = Math.round(gauss() * timing);
    const B = Object.assign({}, A);
    if (B.run != null) B.run = Math.max(0, B.run + j);
    if (B.hold != null) B.hold = Math.max(3, B.hold + Math.round(gauss() * timing));
    exec = { A: B, f: 0, st: { air: false }, to: e.to, e, from: curNode() };
  }
  let enemyCd = 0, boomWait = 0;
  const run = () => {
    for (let k = 0; k < maxT * 60; k++){
      frame++;
      const P = S.hero;
      if (S.phase === 'clear') return res(true);
      if (S.phase === 'over') return res(false);
      if (S.sup > lastSup){ lastSup = S.sup; lastProgressT = frame; }
      if (frame - lastProgressT > 60 * 60) return res(false, true);
      if (S.phase !== 'play'){ game.setInput(0, 0, false); game.update(DT); exec = null; plan = null; wait = 0; continue; }
      if (enemyCd > 0) enemyCd -= DT;
      // враги: заметил → (реакция) → бросок бумеранга
      if (!exec && !boomWait && enemyCd <= 0 && P.ground && !S.boom){
        const e = S.enemies.find(e => e.alive && e.st !== 'stun' && e.st !== 'flee' && Math.abs(e.x - P.x) < 6.5 * T && Math.abs(e.y - P.y) < 14);
        if (e){ enemyCd = 0.6; if (rnd() > miss){ boomWait = react[0] + rnd() * (react[1] - react[0]); boomWait = { t: boomWait, dir: e.x > P.x ? 1 : -1 }; } }
      }
      if (boomWait){
        boomWait.t -= DT;
        if (boomWait.t <= 0){
          if (P.face !== boomWait.dir){ game.setInput(boomWait.dir, 0, false); game.update(DT); }
          game.throwBoom(); boomWait = 0; wait = 0.5;
        }
        game.setInput(0, 0, false); game.update(DT); continue;
      }
      if (exec && exec.runTo != null){
        const rem = exec.runTo - P.x, d = rem > 0 ? 1 : -1, v = P.vx * d;
        const dec = P.ice ? L.K.ICE_TURN : L.K.DEC, stopD = v > 0 ? v * v / (2 * dec) + 1 : 0;
        let dx = 0;
        if (Math.abs(rem) < 4) dx = 0;
        else if (Math.abs(rem) > stopD + 2) dx = d;
        else if (v > 3 && P.ice) dx = -d;
        exec.f++; game.setInput(dx, 0, false); game.update(DT);
        if ((Math.abs(rem) < 5 && Math.abs(P.vx) < 1.5) || exec.f > 600 || !P.ground) exec = null;
        continue;
      }
      if (exec){
        const inp = actInput(exec.A, exec.f, P, exec.st); exec.f++;
        game.setInput(inp.dx, inp.dy, inp.jump); game.update(DT);
        const idle = !inp.dx && !inp.dy && !inp.jump;
        if ((idle && P.ground && !P.low && Math.abs(P.vx) < 1.5 && exec.f > 3) || exec.f > 420 || (exec.A.climb && !P.climb && P.ground && exec.f > 2)){
          // промах: не туда пришли или предметы ребра не взяты — в следующий раз это действие «дороже»
          const at = curNode(), miss = !at || at.id !== exec.to || exec.e.items.some(i => !S.got[i] && LV.items[i].k !== 'heart');
          if (miss && exec.from){ const key = fk(exec.from.id, exec.e); fails.set(key, (fails.get(key) || 0) + 1); }
          exec = null;
        }
        continue;
      }
      // стоим: план
      if (wait > 0){ wait -= DT; game.setInput(0, 0, false); game.update(DT); continue; }
      if (!P.ground || P.climb || Math.abs(P.vx) > 1.5){ game.setInput(0, 0, false); game.update(DT); continue; }
      // ветер: ждём затишья
      if (LV.wind.length && LV.wind.some(z => P.x > z.x0 - 6 * T && P.x < z.x1 + 2 * T && (L.gustOn(z, S.time) || L.gustOn(z, S.time + 0.8) || L.gustOn(z, S.time + 1.6) || L.gustOn(z, S.time + 2.2)))){ game.setInput(0, LV.wind.some(z => P.x > z.x0 - T && P.x < z.x1 + T) ? 1 : 0, false); game.update(DT); continue; }
      const n = curNode();
      if (!n){ game.setInput(rnd() < 0.5 ? 1 : -1, 0, false); game.update(DT); continue; }
      // подровняться к центру клетки
      if (Math.abs(P.x - n.x) > (P.ice ? 4 : 2)){ game.setInput(P.x < n.x ? 1 : -1, 0, false); game.update(DT); game.setInput(0, 0, false); game.update(DT); continue; }
      plan = pickTarget(n);
      if (!plan){ stuck++; if (stuck > 30) return res(false, true); game.setInput(0, 0, false); game.update(DT); continue; }
      if (plan.steps.length === 0 && plan.fox){
        if (S.fox){ game.setInput(0, 0, false); game.update(DT); continue; }
        const d = foxDir(n.id);
        if (P.face !== d){ game.setInput(d, 0, false); game.update(DT); game.setInput(0, 0, false); }
        game.callFox(); wait = react[0] + rnd() * (react[1] - react[0]); continue;
      }
      if (plan.steps.length === 0){ game.setInput(0, 0, false); game.update(DT); stuck++; if (stuck > 60) return res(false, true); continue; }
      const span = runSpan(plan.steps, n);
      if (span) exec = { runTo: span.to.x, f: 0 }; else startExec(plan.steps[0]);
      wait = 0;
      // реакция перед действием
      const onBridge = L.tileAt(LV, Math.floor(P.x / T), Math.round(P.y / T)) === '-';   // на мосту не мешкаем
      const rt = onBridge ? 0.05 : react[0] + rnd() * (react[1] - react[0]);
      for (let i = 0; i < Math.round(rt * 60); i++){ game.setInput(0, 0, false); game.update(DT); frame++; }
    }
    return res(false, true);
  };
  function res(won, timeout){ return { won, seed, id, sup: S.sup, need: LV.need, total: LV.total, deaths: S.deaths, lives: S.lives, time: frame / 60, stuck: !!timeout && !won, ev, pass }; }
  return run();
}
