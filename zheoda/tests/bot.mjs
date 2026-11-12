/* ЖЕОДА · tests/bot.mjs — планировщик маршрутов и «человеческий» бот.
   Планировщик: граф «стоячих» положений героини (клетка + направление гравитации + лифты),
   рёбра — короткие макросы ввода (шаг, разбег, прыжки с разной длиной удержания), которые
   ПРОГОНЯЮТСЯ на настоящей физике игры (logic.stepPlayer). Поэтому граф учитывает гравитацию
   (сферы), карнизы, ключи/двери, рычаг (ворота/мосты), разрушенные стены, лифты и опасности.
   Бот: жадно идёт к ближайшему нужному (кристаллы, ключи, взрывчатка, заряды, выход), а если
   цели недостижимы — дёргает рычаг или подрывает стену, когда это расширяет достижимое.
   «Человеческие» ограничения: реакция 150–250 мс (видит врагов/снаряды с задержкой),
   разброс длительности нажатий в макросах (±1–2 кадра), промахи при стрельбе. Ввод — только
   game.setInput(dx, jump) / fire() / down(), как у игрока (dx аналоговый — как перетаскивание пальцем).
   perfect:true — без задержки и разброса (проверка проходимости). */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const STEPF = 1 / 60;
// Макросы: d — шаг/разбег (кадров), j — удержание прыжка (кадров), k — сколько кадров держать направление (Infinity — до приземления)
function buildMacros(){
  const M = [];
  for (const s of [-1, 1]){
    M.push({ dx: s, k: 10, j: 0 });            // шаг на клетку
    M.push({ dx: s, k: 20, j: 0 });            // две клетки / сход с уступа
    M.push({ dx: s, k: Infinity, j: 0 });      // сход с уступа «с разбегу»
    for (const k of [4, 8, 12, 18, 26, Infinity]) M.push({ dx: s, k, j: 20 });
    for (const k of [8, 14, Infinity]) M.push({ dx: s, k, j: 5 });
    for (const st of [8, 14]) M.push({ dx: s, k: Infinity, j: 20, s: st });   // вверх, затем на уступ
  }
  M.push({ dx: 0, k: 0, j: 20 });
  return M;
}
export const MACROS = buildMacros();
const JITS = [{ k: -2, j: 0 }, { k: 2, j: 0 }, { k: 0, j: -2 }, { k: 0, j: 2 }];

// Ввод макроса на кадре f. st = {air, landed} — состояние полёта (обновляется). → {dx, jump, active}
export function macInput(m, jit, f, st, ground){
  if (!ground) st.air = true; else if (st.air) st.landed = true;
  const kk = m.k === Infinity ? Infinity : Math.max(0, m.k + (jit ? jit.k : 0)), jj = m.j ? Math.max(1, m.j + (jit ? jit.j : 0)) : 0;
  const jump = f < jj;
  let dx = 0, active;
  if (kk === Infinity){ if (!st.landed && f >= (m.s || 0)) dx = m.dx; active = jump || (!st.landed && (st.air || f < 60)); }
  else { if (f < kk) dx = m.dx; active = f < Math.max(kk, jj, 1); }
  return { dx, jump, active };
}

export function makePlanner(Z){
  const L = Z.logic, PW = L.PW, PH = L.PH;
  const cache = new Map();          // ключ конфигурации → граф

  function cfgKey(S){
    let s = (S.chan ? 1 : 0) + '|' + (S.keys.R ? 1 : 0) + (S.keys.B ? 1 : 0) + (S.keys.Y ? 1 : 0) + '|' + S.level + '|';
    s += S.grid.join('');
    s += '|' + S.stal.map(x => x.state === 'hang' || x.state === 'shake' ? 1 : 0).join('');
    return s;
  }
  function liftRect(Lf, k){ return { x: Lf.x, y: k ? Lf.yT : Lf.yB, w: Lf.w, h: L.LIFT_H, dy: 0 }; }

  function graphFor(S, cfg){
    const key = cfg ? cfg.key : cfgKey(S);
    let G = cache.get(key);
    if (G) return G;
    const src = cfg || S;
    const stal = (cfg && cfg.stal) || S.stal.map(x => ({ cx: x.cx, cy: x.cy, state: x.state }));
    const base = { cols: S.cols, rows: S.rows, grid: src.grid.slice(), keys: Object.assign({}, src.keys), chan: src.chan, stal, orbs: S.orbs, lifts: [] };
    const world = L.makeWorld(base);
    const liftWorlds = S.lifts.map(Lf => [0, 1].map(k => L.makeWorld(Object.assign({}, base, { lifts: [liftRect(Lf, k)] }))));
    // предметы: клетка → индексы
    const itemAt = new Map();
    S.items.forEach((it, i) => { const k = it.cy * S.cols + it.cx; if (!itemAt.has(k)) itemAt.set(k, []); itemAt.get(k).push(i); });
    G = { key, world, liftWorlds, edges: new Map(), itemAt, S0: { cols: S.cols, rows: S.rows, items: S.items, exit: S.exit, lifts: S.lifts, levers: S.levers, orbs: S.orbs } };
    cache.set(key, G);
    return G;
  }

  // ---- узлы ----
  const LIFT_BASE = 1e7;
  function nodeKey(cx, cy, gs){ return ((cy * 4096 + cx) * 2) + (gs < 0 ? 1 : 0); }
  function nodeDecode(k){ if (k >= LIFT_BASE){ const v = k - LIFT_BASE; return { lift: v >> 1, stop: v & 1 }; } const gs = (k & 1) ? -1 : 1, v = k >> 1; return { cx: v % 4096, cy: Math.floor(v / 4096), gs }; }
  function liftKey(i, k){ return LIFT_BASE + i * 2 + k; }
  function bodyAt(G, k){
    const n = nodeDecode(k);
    if (n.lift != null){ const Lf = G.S0.lifts[n.lift], y = n.stop ? Lf.yT : Lf.yB; return { x: Lf.x + Lf.w / 2 - PW / 2, y: y - PH, gs: 1, lift: n.lift, stop: n.stop }; }
    return { x: n.cx + 0.5 - PW / 2, y: n.gs > 0 ? n.cy + 1 - PH : n.cy, gs: n.gs };
  }
  function nodeOfBody(b, liftIdx, liftStop){
    if (b.lift >= 0 && liftIdx != null) return liftKey(liftIdx, liftStop);
    const cx = Math.floor(b.x + PW / 2), cy = b.gs > 0 ? Math.round(b.y + PH) - 1 : Math.round(b.y);
    return nodeKey(cx, cy, b.gs);
  }
  // Узел по текущему телу игры (если стоит; иначе null)
  function currentNode(S){
    const p = S.pl; if (!p.ground) return null;
    if (p.lift >= 0){ const Lf = S.lifts[p.lift]; if (Lf.wait > 0) return liftKey(p.lift, Lf.y === Lf.yT ? 1 : 0); return null; }
    return nodeOfBody(p);
  }

  // ---- симуляция макроса ----
  function inOrb(b, orbs){ for (const o of orbs) if (o.x > b.x - 0.25 && o.x < b.x + b.w + 0.25 && o.y > b.y - 0.25 && o.y < b.y + b.h + 0.25) return true; return false; }
  function touchItems(G, b, out){
    const x0 = Math.floor(b.x - 0.35), x1 = Math.floor(b.x + PW + 0.35), y0 = Math.floor(b.y - 0.35), y1 = Math.floor(b.y + PH + 0.35);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++){
      const l = G.itemAt.get(cy * G.S0.cols + cx); if (!l) continue;
      for (const i of l){ const it = G.S0.items[i]; if (it.x > b.x - 0.35 && it.x < b.x + PW + 0.35 && it.y > b.y - 0.35 && it.y < b.y + PH + 0.35 && out.indexOf(i) < 0) out.push(i); }
    }
    const E = G.S0.exit;
    if (E && b.x < E.cx + 0.8 && b.x + PW > E.cx + 0.2 && b.y < E.cy + 1 && b.y + PH > E.cy - 0.8 && out.indexOf(-1) < 0) out.push(-1);
  }
  // Прогон: старт в узле k, макрос m (с поправками jit) → { to, frames, touched } или null
  function simulate(G, k, m, jit, world){
    const st = bodyAt(G, k), b = L.makeBody(st.x, st.y, st.gs);
    b.ground = true; b.lift = st.lift != null ? 0 : -1;
    const W = world || (st.lift != null ? G.liftWorlds[st.lift][st.stop] : G.world);
    b.orbLock = inOrb(b, W.orbs);
    const touched = [], rows = G.S0.rows, st2 = { air: false, landed: false };
    for (let f = 0; f < 260; f++){
      const mi = macInput(m, jit, f, st2, b.ground);
      let dx = mi.dx;
      if (!mi.active && b.ground){
        const d = Math.floor(b.x + PW / 2) + 0.5 - (b.x + PW / 2);
        if (Math.abs(d) < 1e-4) return { to: nodeOfBody(b, st.lift, st.stop), frames: f + 1, touched, gs: b.gs };
        dx = Math.max(-1, Math.min(1, d / (L.RUN * STEPF)));
      }
      const fl = L.stepPlayer(b, { dx, jump: mi.jump }, W, STEPF);
      if (fl.hazard) return null;
      if (b.y > rows + 1 || b.y < -3) return null;
      touchItems(G, b, touched);
    }
    return null;
  }
  function validNode(G, k){
    const n = nodeDecode(k); if (n.lift != null) return true;
    const b = bodyAt(G, k), W = G.world;
    if (L.boxHits(W, b.x, b.y, PW, PH)) return false;
    const fy = n.gs > 0 ? n.cy + 1 : n.cy - 1;
    return L.cellSolid(W, n.cx, fy) || W.oneway(n.cx, fy);
  }
  function edgesOf(G, k){
    let E = G.edges.get(k);
    if (E) return E;
    E = [];
    for (let mi = 0; mi < MACROS.length; mi++){
      const m = MACROS[mi], r = simulate(G, k, m);
      if (!r || (r.to === k && !r.touched.length)) continue;
      // «осторожность»: ребро, которое при сбое нажатия на ±2 кадра ведёт в опасность или мимо, дороже
      let risk = 0;
      if (m.k !== 0 || m.j){
        for (const jit of JITS){
          if ((jit.k && !m.k) || (jit.j && !m.j)) continue;
          const r2 = simulate(G, k, m, jit);
          if (!r2) risk += 2; else if (r2.to !== r.to) risk += 0.5;
        }
      }
      E.push({ to: r.to, cost: r.frames + risk * 60, risk, mi, touched: r.touched });
    }
    // лифты: посадка с соседней клетки на уровне остановки и поездка
    const n = nodeDecode(k);
    if (n.lift != null){
      const Lf = G.S0.lifts[n.lift];
      E.push({ to: liftKey(n.lift, 1 - n.stop), cost: Math.round((Math.abs(Lf.yB - Lf.yT) / Z.logic.LIFT_V + Z.logic.LIFT_WAIT) * 60), ride: true, touched: [] });
    } else if (n.gs > 0){
      G.S0.lifts.forEach((Lf, i) => {
        for (const stop of [0, 1]){
          const y = stop ? Lf.yT : Lf.yB;
          if (n.cy + 1 === y && (n.cx === Lf.x - 1 || n.cx === Lf.x + Lf.w)) E.push({ to: liftKey(i, stop), cost: 90, board: { lift: i, stop }, touched: [] });
        }
      });
    }
    G.edges.set(k, E);
    return E;
  }
  // Дейкстра от узла k → { dist: Map, prev: Map(node → {from, e}) }
  function dijkstra(G, k0, limit){
    const dist = new Map([[k0, 0]]), prev = new Map(), heap = [[0, k0]];
    const push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length){
      const [d, k] = pop(); if (d > dist.get(k)) continue; if (limit && d > limit) break;
      for (const e of edgesOf(G, k)){
        const nd = d + e.cost;
        if (!dist.has(e.to) || nd < dist.get(e.to)){ dist.set(e.to, nd); prev.set(e.to, { from: k, e }); push(nd, e.to); }
      }
    }
    return { dist, prev };
  }
  function pathTo(D, k0, k, lastEdge){
    const out = lastEdge ? [lastEdge] : [];
    let cur = k;
    while (cur !== k0){ const p = D.prev.get(cur); if (!p) return null; out.unshift(p.e); cur = p.from; }
    return out;
  }
  // Все достижимые «касания» предметов: item → {cost, from, e}
  function reachItems(G, D){
    const best = new Map();
    for (const [k, d] of D.dist){
      for (const e of edgesOf(G, k)){
        for (const i of e.touched){ const c = d + e.cost; if (!best.has(i) || c < best.get(i).cost) best.set(i, { cost: c, from: k, e }); }
      }
    }
    return best;
  }
  function leverNodes(G, D){
    const out = [];
    for (const [k, d] of D.dist){
      const n = nodeDecode(k); if (n.lift != null) continue;
      const b = bodyAt(G, k);
      G.S0.levers.forEach((l, li) => { if (b.x < l.cx + 0.9 && b.x + PW > l.cx + 0.1 && b.y < l.cy + 1 && b.y + PH > l.cy) out.push({ k, d, li }); });
    }
    return out;
  }
  // Точки подрыва: узел → какие трещиноватые клетки снесёт взрыв
  function blastSpots(G, D, S){
    const out = [];
    for (const [k, d] of D.dist){
      const n = nodeDecode(k); if (n.lift != null) continue;
      const b = bodyAt(G, k), x = b.x + PW / 2, y = n.gs > 0 ? b.y + PH - 0.3 : b.y + 0.3, cells = [];
      for (let cy = Math.floor(y - 2); cy <= Math.floor(y + 2); cy++) for (let cx = Math.floor(x - 2); cx <= Math.floor(x + 2); cx++){
        if (cx < 0 || cy < 0 || cx >= S.cols || cy >= S.rows) continue;
        if (S.grid[cy * S.cols + cx] === '%' && Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= L.BLAST_R) cells.push(cy * S.cols + cx);
      }
      if (cells.length) out.push({ k, d, cells, x, y });
    }
    return out;
  }
  function cfgOf(S, over){
    const c = { grid: S.grid.slice(), keys: Object.assign({}, S.keys), chan: S.chan, stal: S.stal.map(x => ({ cx: x.cx, cy: x.cy, state: x.state })) };
    if (over) over(c);
    c.key = (c.chan ? 1 : 0) + '|' + (c.keys.R ? 1 : 0) + (c.keys.B ? 1 : 0) + (c.keys.Y ? 1 : 0) + '|' + S.level + '|' + c.grid.join('') + '|' + c.stal.map(x => x.state === 'hang' || x.state === 'shake' ? 1 : 0).join('');
    return c;
  }
  return { cache, graphFor, cfgOf, cfgKey, nodeKey, nodeDecode, liftKey, bodyAt, currentNode, simulate, edgesOf, dijkstra, pathTo, reachItems, leverNodes, blastSpots, validNode, MACROS };
}

// Нужные предметы: кристаллы, ключи (если их дверь есть), взрывчатка (если есть стены и места), выход (если открыт)
function wanted(S, i, opts){
  if (i === -1) return S.exitOpen ? 0.5 : 0;
  const it = S.items[i]; if (it.taken) return 0;
  switch (it.k){
    case '*': return 1;
    case 'r': case 'b': case 'y': return S.grid.indexOf(it.k.toUpperCase()) >= 0 ? 1 : 0;
    case 'd': return S.dyn < 5 && S.grid.indexOf('%') >= 0 ? 1 : 0;
    case 'a': return S.ammo <= (opts.boss ? 5 : 8) ? (S.ammo <= 2 ? 1.2 : 0.6) : 0;
    case 'h': return S.hp < 3 ? 0.7 : 0;
    case '$': return 0.4;
  }
  return 0;
}

// ---------- Бот ----------
// opts: { levels, startLevel, perfect, react:[a,b], jit (σ кадров), maxLevelT, noEnemies }
export function playZheoda(Z, seed, opts = {}){
  const L = Z.logic, PW = L.PW, PH = L.PH;
  const PL = opts.planner || makePlanner(Z);
  const brng = mulberry32(seed * 7919 + 17);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const perfect = !!opts.perfect;
  const [r0, r1] = opts.react || [0.15, 0.25];
  const react = perfect ? 0 : r0 + brng() * (r1 - r0);
  const jitS = perfect ? 0 : (opts.jit == null ? 1.1 : opts.jit);
  const aimErr = perfect ? 0 : (opts.aimErr == null ? 0.12 : opts.aimErr);
  const startLevel = opts.startLevel || 1, levels = opts.levels || Z.logic.LEVELS.length;
  const maxLevelT = opts.maxLevelT || 240;
  const deaths = {}, levelTime = {}, hurtBy = {};
  let stuck = 0;
  const game = Z.Game({ rng: mulberry32(seed), level: startLevel, maxLevel: startLevel + levels - 1, noEnemies: opts.noEnemies,
    onEvent: (t, d) => { if (t === 'die'){ deaths[S.level] = (deaths[S.level] || 0) + 1; hurtBy[d.src] = (hurtBy[d.src] || 0) + 1; } } }).start();
  const S = game.state(), h = L.STEP;
  let t = 0, tLevel = 0, curLevel = 0;
  const hist = [];
  let toggles = 0, plan = null, ex = null, wait = 0, fleeUntil = 0, lastCfg = '', fireCd = 0, idle = 0, dodgeCd = 0;

  function snap(){ return { t, en: S.enemies.filter(e => !e.dead).map(e => ({ x: e.x, y: e.y, w: e.w, h: e.h, type: e.type, vx: e.vx })), peb: S.pebbles.map(p => ({ x: p.x, y: p.y, vx: p.vx })), sh: S.shards.map(s => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy })).concat(S.waves.map(w => ({ x: w.x, y: w.gs > 0 ? w.y - 0.35 : w.y + 0.35, vx: w.dir * 7, vy: 0 }))), boss: S.boss && !S.boss.dead ? { x: S.boss.x, y: S.boss.y, w: S.boss.w, h: S.boss.h } : null, stal: S.stal.filter(s => s.state === 'shake' || s.state === 'fall').map(s => ({ x: s.x, y: s.y })) }; }
  function seen(){ for (let i = hist.length - 1; i >= 0; i--) if (hist[i].t <= t - react) return hist[i]; return hist[0]; }

  function chooseTarget(){
    const G = PL.graphFor(S), k0 = PL.currentNode(S);
    if (k0 == null) return null;
    const D = PL.dijkstra(G, k0);
    const R = PL.reachItems(G, D);
    let best = null;
    for (const [i, r] of R){
      const w = wanted(S, i, { boss: S.bossLevel }); if (!w) continue;
      if (S.boss && !S.boss.dead && i >= 0){ const bx = S.boss.x + S.boss.w / 2, ix = S.items[i].x, px = S.pl.x + PW / 2; if (Math.abs(ix - bx) < 3.5 || Math.sign(ix - bx) !== Math.sign(px - bx)) continue; }
      const sc = r.cost / w;
      if (!best || sc < best.sc) best = { sc, r, i };
    }
    if (best) toggles = 0;
    if (best && !(S.bossLevel && S.ammo > 2 && best.r.cost > 240)) return { path: PL.pathTo(D, k0, best.r.from, best.r.e), kind: 'item', item: best.i };
    if (S.bossLevel){
      // бой с Исполином: держаться на расстоянии 4–8 клеток по горизонтали, стрелять, когда он на линии
      const B = S.boss, bx = B ? B.x + B.w / 2 : 0;
      const cand = [];
      for (const [k, d] of D.dist){ const n = PL.nodeDecode(k); if (n.lift != null || n.gs < 0 || d > 150) continue; const b = PL.bodyAt(G, k), dx = Math.abs(b.x + PW / 2 - bx), side = Math.sign(b.x + PW / 2 - bx) === Math.sign(S.pl.x + PW / 2 - bx); if (side && dx > 3.5 && dx < 8.5) cand.push(k); }
      if (cand.length){ const k = cand[(brng() * cand.length) | 0]; return { path: PL.pathTo(D, k0, k), kind: 'boss' }; }
      return { path: [], kind: 'boss' };
    }
    // ничего не достать: рычаг или подрыв, если это открывает новые цели
    const reachNow = new Set([...R.keys()].filter(i => wanted(S, i, {}) >= 0.5 || i === -1));
    const gain = (cfg, from) => {
      const G2 = PL.graphFor(S, cfg);
      // из того же узла — достижимость в новой конфигурации: новые цели, иначе — новые узлы (разведка)
      const D2 = PL.dijkstra(G2, from); const R2 = PL.reachItems(G2, D2);
      let n = 0; for (const i of R2.keys()) if (!reachNow.has(i) && (wanted(S, i, {}) >= 0.5 || (i === -1 && S.crystalsLeft === 0))) n++;
      let nn = 0; for (const k of D2.dist.keys()) if (!D.dist.has(k)) nn++;
      return n * 1000 + nn;
    };
    const opts2 = [];
    for (const lv of PL.leverNodes(G, D)){
      const c = PL.cfgOf(S, x => { x.chan = !x.chan; });
      opts2.push({ d: lv.d, k: lv.k, act: 'lever', cfg: c });
    }
    if (S.dyn > 0) for (const bs of PL.blastSpots(G, D, S)){
      const c = PL.cfgOf(S, x => { bs.cells.forEach(ci => { x.grid[ci] = '.'; }); });
      opts2.push({ d: bs.d, k: bs.k, act: 'blast', cfg: c, bs });
    }
    opts2.sort((a, b) => a.d - b.d);
    let bestO = null, bestG = 0;
    for (const o of opts2){
      const gv = gain(o.cfg, o.act === 'lever' ? o.k : k0);
      if (gv >= 1000) return { path: PL.pathTo(D, k0, o.k), kind: o.act, node: o.k, bs: o.bs };
      if (o.act === 'lever' && gv > bestG && toggles < 6){ bestG = gv; bestO = o; }
    }
    if (bestO){ toggles++; return { path: PL.pathTo(D, k0, bestO.k), kind: bestO.act, node: bestO.k }; }
    return null;
  }
  function fleeFrom(x, y){
    const G = PL.graphFor(S), k0 = PL.currentNode(S); if (k0 == null) return null;
    const D = PL.dijkstra(G, k0, 100);
    let best = null;
    for (const [k, d] of D.dist){
      if (d > 95) continue;
      const b = PL.bodyAt(G, k), dist = Math.hypot(b.x + PW / 2 - x, b.y + PH / 2 - y);
      if (dist < L.BLAST_HURT + 1.0) continue;
      if (!best || d < best.d) best = { k, d };
    }
    return best ? PL.pathTo(D, k0, best.k) : null;
  }

  function startEdge(e){
    const m = e.mi != null ? PL.MACROS[e.mi] : null;
    ex = { e, m, f: 0, jit: perfect || !m ? null : { k: Math.round(gauss() * jitS), j: Math.round(gauss() * jitS * 0.7) }, air: false, landed: false, waitT: 0 };
  }
  function align(){
    const p = S.pl, d = Math.floor(p.x + PW / 2) + 0.5 - (p.x + PW / 2);
    if (Math.abs(d) < 1e-3) return 0;
    return Math.max(-1, Math.min(1, d / (L.RUN * h)));
  }

  function los(x0, y, x1){ const W = game.world(), cy = Math.floor(y); for (let cx = Math.floor(Math.min(x0, x1)); cx <= Math.floor(Math.max(x0, x1)); cx++) if (L.cellSolid(W, cx, cy)) return false; return true; }
  // Бой: стрелять во врага на линии, перепрыгивать снаряды
  function combat(){
    const V = seen(), p = S.pl, pcx = p.x + PW / 2, pcy = p.y + PH / 2;
    if (!V) return null;
    let act = null;
    if (fireCd <= 0 && S.ammo > 0){
      let tgt = null, td = 1e9;
      for (const e of V.en){
        const ex_ = e.x + e.w / 2, ey = e.y + e.h / 2, dx = ex_ - pcx;
        const sy = L.shotY(p) + (perfect ? 0 : (brng() - 0.5) * 2 * aimErr);
        if (sy < e.y - 0.1 || sy > e.y + e.h + 0.1) continue;
        if (Math.abs(dx) > 7.5) continue;
        if (!los(pcx, L.shotY(p), ex_)) continue;
        if (Math.abs(dx) < td){ td = Math.abs(dx); tgt = { dx }; }
      }
      if (V.boss){
        const B = V.boss, by = B.y + B.h / 2;
        const sy = L.shotY(p);
        if (sy > B.y + 0.1 && sy < B.y + B.h - 0.1 && Math.abs(B.x + B.w / 2 - pcx) < 8.5) tgt = { dx: B.x + B.w / 2 - pcx };
      }
      if (tgt && (!perfect ? brng() < 0.6 : true)) act = { fire: true, face: tgt.dx > 0 ? 1 : -1 };
    }
    if (dodgeCd <= 0 && p.ground){
      // снаряды: ближайшее сближение за 0.6 с
      for (const q of V.peb.concat(V.sh)){
        const lag = t - V.t;   // видим с задержкой — экстраполируем на «сейчас»
        for (let tt = 0; tt <= 0.6; tt += 0.05){
          const qx = q.x + (q.vx || 0) * (tt + lag), qy = q.y + (q.vy || 0) * (tt + lag);
          if (qx > p.x - 0.3 && qx < p.x + PW + 0.3 && qy > p.y - 0.3 && qy < p.y + PH + 0.3){
            act = Object.assign(act || {}, Math.abs(q.vy || 0) < Math.abs(q.vx || 0) * 0.6 ? { dodge: 'jump' } : { dodge: 'run', dir: (q.vx || 0) > 0 ? 1 : (q.vx || 0) < 0 ? -1 : (pcx < S.cols / 2 ? 1 : -1) });
            break;
          }
        }
        if (act && act.dodge) break;
      }
      if (!act || !act.dodge) for (const e of V.en){
        if (e.type !== 'c' && e.type !== 'j') continue;
        const dx = e.x + e.w / 2 - pcx;
        if (Math.abs(dx) < 1.6 && Math.abs(e.y + e.h / 2 - pcy) < 1.2 && (S.ammo <= 0 || Math.abs(dx) < 0.9) && Math.sign(e.vx || -dx) === -Math.sign(dx)) { act = Object.assign(act || {}, { dodge: 'jump' }); break; }
      }
      if ((!act || !act.dodge) && V.boss){
        const B = V.boss, bx = B.x + B.w / 2, dx = bx - pcx;
        if (Math.abs(dx) < 3.4 && B.y + B.h > p.y - 1.5 && B.y < p.y + PH + 1.5){
          // загнали к стене — перепрыгнуть Исполина, иначе отбежать
          const away = dx > 0 ? -1 : 1, room = away < 0 ? pcx - 1 : S.cols - 1 - pcx;
          if (room > 3) act = Object.assign(act || {}, { dodge: 'run', dir: away });
          else if (Math.abs(dx) < 2.5 + (perfect ? 0 : (brng() - 0.5) * 0.8)) act = Object.assign(act || {}, { dodge: 'over', dir: -away });
        }
      }
    }
    return act;
  }

  let deadLevel = 0, lastLevel = 0;
  const limitT = opts.maxT || 3600;
  while (t < limitT){
    if (S.phase === 'over' || S.phase === 'won') break;
    if (S.phase === 'hub'){ game.enter(S.open); plan = null; ex = null; t += h; continue; }
    if (S.level !== lastLevel){ lastLevel = S.level; tLevel = 0; }
    if (S.phase !== 'play'){ game.setInput(0, false); game.update(h); t += h; plan = null; ex = null; hist.length = 0; continue; }
    hist.push(snap()); if (hist.length > 40) hist.shift();
    tLevel += h; levelTime[S.level] = tLevel;
    if (tLevel > maxLevelT){ stuck = S.level; break; }
    if (fireCd > 0) fireCd -= h; if (dodgeCd > 0) dodgeCd -= h;
    const p = S.pl;
    let dx = 0, jump = false;

    // боевые решения — только стоя и между рёбрами (или на шаге)
    const between = !ex || !ex.m || (ex.m.j === 0 && ex.m.k <= 20);
    const cb = p.ground && between ? combat() : null;
    if (cb && cb.fire){
      if (p.face !== cb.face){ dx = cb.face * 0.05; game.setInput(dx, false); game.update(h); t += h; if (ex && ex.m) ex = null; continue; }
      game.fire(); fireCd = perfect ? 0.27 : 0.35 + brng() * 0.2;
    }
    if (cb && cb.dodge && (!ex || (ex.m && ex.f === 0))){
      let mi = PL.MACROS.length - 1;
      if (cb.dodge === 'over') mi = PL.MACROS.findIndex(m => m.dx === cb.dir && m.k === Infinity && m.j === 20 && !m.s);
      if (cb.dodge === 'run'){ const d = cb.dir; mi = PL.MACROS.findIndex(m => m.dx === d && m.k === 20 && m.j === 0);
        // упрёмся в стену — тогда прыжок
        const nx = Math.floor(p.x + PW / 2 + d * 2); if (nx < 1 || nx > S.cols - 2) mi = PL.MACROS.length - 1; }
      startEdge({ mi, to: null, touched: [] }); dodgeCd = perfect ? 0.3 : 0.6; plan = null;
    }
    if (!ex){
      if (wait > 0){ wait -= h; game.setInput(align(), false); game.update(h); t += h; continue; }
      const k0 = p.ground ? PL.currentNode(S) : null;
      if (k0 == null){ game.setInput(p.ground && p.lift < 0 ? align() : 0, false); game.update(h); t += h; continue; }
      const ad = align();
      if (ad && p.lift < 0){ game.setInput(ad, false); game.update(h); t += h; continue; }
      const ck = PL.cfgKey(S);
      if (!plan || !plan.length || ck !== lastCfg){
        lastCfg = ck;
        if (S.dynas.length){ const dn = S.dynas[0]; plan = fleeFrom(dn.x, dn.y); if (!plan || !plan.length){ wait = 0.3; plan = null; lastCfg = ''; game.setInput(0, false); game.update(h); t += h; continue; } plan.kind = 'flee'; }
        else {
          const tg = chooseTarget();
          if (!tg || !tg.path){ idle += h; if (idle > 6){ stuck = S.level; break; } wait = 0.25; game.setInput(0, false); game.update(h); t += h; continue; }
          idle = 0; plan = tg.path; plan.kind = tg.kind;
          if (tg.kind === 'boss') wait = perfect ? 0.6 : 0.6 + brng() * 0.8;
          if (!plan.length){
            if (tg.kind === 'boss'){ plan = null; game.setInput(0, false); game.update(h); t += h; continue; }
            if (tg.kind === 'lever'){ game.down(); lastCfg = ''; plan = null; wait = perfect ? 0.05 : 0.2; game.setInput(0, false); game.update(h); t += h; continue; }
            if (tg.kind === 'blast'){ if (!game.down()){ plan = null; } lastCfg = ''; plan = null; game.setInput(0, false); game.update(h); t += h; continue; }
          }
          if (tg.kind === 'lever' || tg.kind === 'blast'){ plan.push({ act: tg.kind }); }
        }
      }
      const e = plan.shift();
      if (!e){ plan = null; game.setInput(0, false); game.update(h); t += h; continue; }
      if (e.act){ game.down(); lastCfg = ''; plan = null; wait = perfect ? 0.05 : 0.2; game.setInput(0, false); game.update(h); t += h; continue; }
      startEdge(e);
    }
    // исполнение ребра
    const e = ex.e, m = ex.m;
    if (e.ride){
      // стоим на лифте, пока он не встанет на другой остановке
      const tgt = PL.nodeDecode(e.to), Lf = S.lifts[tgt.lift], ty = tgt.stop ? Lf.yT : Lf.yB;
      dx = 0;
      if (Lf.wait > 0 && Lf.y === ty && p.ground && p.lift === tgt.lift){ ex = null; }
      else if (!p.ground && ex.f > 30){ ex = null; plan = null; }
      else if (ex.f > 900){ ex = null; plan = null; }
    } else if (e.board){
      const Lf = S.lifts[e.board.lift], stopY = e.board.stop ? Lf.yT : Lf.yB;
      if (ex.f === 0 && !(Lf.wait > 0.8 && Lf.y === stopY)){ ex.waitT += h; if (ex.waitT > 12){ ex = null; plan = null; } game.setInput(align(), false); game.update(h); t += h; continue; }
      const c = Lf.x + Lf.w / 2 - PW / 2 - p.x;
      dx = Math.max(-1, Math.min(1, c / (L.RUN * h)));
      if (Math.abs(c) < 1e-3 && p.ground && p.lift === e.board.lift) ex = null;
      else if (ex.f > 80) { ex = null; plan = null; }
    } else {
      const mi = macInput(m, ex.jit, ex.f, ex, p.ground);
      jump = mi.jump; dx = mi.dx;
      if (!mi.active && p.ground){
        const ad = align();
        if (!ad){
          // ребро завершено — сверяем узел
          const cur = PL.currentNode(S);
          if (e.to != null && cur !== e.to) plan = null;
          ex = null;
        } else dx = ad;
      }
      if (ex && ex.f > 300){ ex = null; plan = null; }
    }
    if (ex) ex.f++;
    game.setInput(dx, jump); game.update(h); t += h;
  }
  const passed = S.won ? levels : Math.max(0, S.level - startLevel + (S.phase === 'clear' || (S.cleared[S.level] && S.phase !== 'over') ? 1 : 0));
  return { won: !!S.won, passed, level: S.level, score: S.score, deaths, levelTime, stuck, hurtBy, t };
}

// ---------- Граф достижимости уровня (для тестов проходимости и отладки карт) ----------
// Монотонное замыкание: узлы (клетка × гравитация × лифты) × положение рычага; ключи и разрушенные
// стены только добавляются; взрывчатка — по числу подобранных шашек. → { crystals, got, exit, keys, blasts, nodes }
export function reachLevel(Z, n, PLx){
  const PL = PLx || makePlanner(Z);
  const game = Z.Game({ level: n, noEnemies: true }).start(); game.enter(n);
  const S = game.state();
  const k0 = PL.currentNode(S);
  const st = { keys: { R: false, B: false, Y: false }, grid: S.grid.slice(), blasts: 0 };
  const hasLever = S.levers.length > 0;
  let touched = new Set(), nodes = new Set();
  for (let iter = 0; iter < 30; iter++){
    const cfgs = [false, true].map(ch => PL.cfgOf(S, c => { c.grid = st.grid.slice(); c.keys = Object.assign({}, st.keys); c.chan = ch; }));
    const Gs = cfgs.map(c => PL.graphFor(S, c));
    const seen = new Set(), q = [[k0, 0]]; seen.add(k0 * 2);
    touched = new Set(); nodes = new Set();
    while (q.length){
      const [k, ch] = q.pop(); nodes.add(k);
      const G = Gs[ch];
      for (const e of PL.edgesOf(G, k)){
        e.touched.forEach(i => touched.add(i));
        const id = e.to * 2 + ch; if (!seen.has(id)){ seen.add(id); q.push([e.to, ch]); }
      }
      if (hasLever && PL.leverNodes(G, { dist: new Map([[k, 0]]) }).length){ const id = k * 2 + (1 - ch); if (!seen.has(id)){ seen.add(id); q.push([k, 1 - ch]); } }
    }
    let changed = false;
    for (const i of touched){ const it = S.items[i]; if (i >= 0 && 'rby'.includes(it.k) && !st.keys[it.k.toUpperCase()]){ st.keys[it.k.toUpperCase()] = true; changed = true; } }
    if (changed) continue;
    const dynGot = [...touched].filter(i => i >= 0 && S.items[i].k === 'd').length;
    if (dynGot > st.blasts){
      // подрыв из любого достигнутого узла, который сносит хоть одну стену
      const S2 = Object.assign({}, S, { grid: st.grid });
      let done = false;
      for (const ch of [0, 1]){
        const D = { dist: new Map([...seen].filter(id => (id & 1) === ch).map(id => [id >> 1, 0])) };
        for (const bs of PL.blastSpots(Gs[ch], D, S2)){ bs.cells.forEach(ci => { st.grid[ci] = '.'; }); st.blasts++; done = true; break; }
        if (done) break;
      }
      if (done) continue;
    }
    break;
  }
  const crystals = S.items.map((it, i) => it.k === '*' ? i : -2).filter(i => i >= 0);
  return { crystals: crystals.length, got: crystals.filter(i => touched.has(i)).length, missing: crystals.filter(i => !touched.has(i)).map(i => [S.items[i].cx, S.items[i].cy]),
    exit: touched.has(-1), keys: st.keys, blasts: st.blasts, nodes: nodes.size, touched, S, items: S.items };
}
