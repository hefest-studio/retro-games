/* ЛАЗУТЧИК · tests/bot.mjs — граф проходимости комплекса по настоящей физике и «человеческий» бот.
   navFor(LZ, map) — граф. Узел: «стою» на клетке (столбец, ряд опоры). Рёбра — макро-действия, просчитанные настоящей
   физикой LZ.logic.heroStep на «разрешающем» мире (двери/решётки открыты, створки тревоги открыты, люки закрыты):
   шаг влево/вправо (со сходом с края и падением), подъём/спуск по лестнице, присед на люке (сброс вниз),
   поездка на лифте, дрезина, рычаг решётки. Ребро помечается требованием: цвет двери или 'lever' (решётка), если тело
   героя проходило через такую клетку. Стоимость ребра — кадры шагом (без бега: оценка с запасом).
   Ключи состояния (биты): red 1, blue 2, yellow 4, lever 8, matrix 16, planted 32.
   playLaz(LZ, seed, opts) — бот играет через setInput/press, как человек: реакция 150–250 мс, ошибки момента, часть угроз
   замечает поздно. opts: { diff=1, react:[0.15,0.25], miss=0.12, maxT=1500, god=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const BIT = { red: 1, blue: 2, yellow: 4, lever: 8, matrix: 16, planted: 32 };
const DT = 1 / 60;

function permissive(LZ, map){
  const L = LZ.logic, C = L.C, Wd = L.World(map);
  for (let i = 0; i < map.t.length; i++) if (map.t[i] === C.D || map.t[i] === C.O) Wd.open[i] = 1;
  Wd.keys = { red: true, blue: true, yellow: true };
  return Wd;
}
function reqOf(Wd, P, req){
  const L = Wd.map, T = L.T, C = Wd.map.C;
  const a = Math.floor((P.x - 8) / T), b = Math.floor((P.x + 8) / T), r0 = Math.floor((P.y - 50) / T), r1 = Math.floor((P.y - 1) / T);
  for (let x = a; x <= b; x++) for (let r = r0; r <= r1; r++){
    const v = Wd.tile(x, r);
    if (v === C.D){ const d = Wd.doorAt(x); if (d) req.add(d.color); }
    else if (v === C.O) req.add('lever');
  }
}
// прогон макро из узла; → { to:[x,r], frames, req:Set } или null
function simMacro(LZ, Wd, nx, nr, kind){
  const L = LZ.logic, T = L.T, P = L.newHero(nx * T + 16, nr * T);
  const req = new Set(); let f = 0, phase = 0, startX = P.x;
  const cart = Wd.cart; cart.x = kind === 'C' ? P.x : cart.x; cart.to = null; cart.carry = false;
  Wd.hatchT = {}; for (const h of Wd.map.hatches) Wd.open[h.ty * Wd.W + h.tx] = 0;
  const target = (kind === 'R' ? nx + 1 : kind === 'L' ? nx - 1 : null);
  for (f = 0; f < 900; f++){
    const I = { dx: 0, dy: 0, run: false, upP: false, downP: false };
    if (kind === 'R' || kind === 'L'){
      if (P.ground && phase === 0) I.dx = kind === 'R' ? 1 : -1;
    } else if (kind === 'U') I.dy = -1;
    else if (kind === 'D' || kind === 'H') I.dy = 1;
    else if (kind === 'LU'){ if (f === 0){ I.dy = -1; I.upP = true; } }
    else if (kind === 'LD'){ if (f === 0){ I.dy = 1; I.downP = true; } }
    else if (kind === 'C'){ if (f === 0){ I.dy = -1; I.upP = true; } }
    L.worldStep(Wd, DT);
    let moved = null;
    L.heroStep(Wd, P, I, DT, () => {});
    reqOf(Wd, P, req);
    if (P.dead) return null;
    if (kind === 'R' || kind === 'L'){
      if (!P.ground) phase = 1;
      if (P.ground && phase === 0 && Math.floor(P.x / T) === target && Math.abs(P.x - (target * T + 16)) < 2) break;
      if (P.ground && phase === 1) break;
      if (P.ground && phase === 0 && f > 30 && Math.abs(P.x - startX) < 1) return null;
      if (P.ground && phase === 0 && f > 3 && ((kind === 'R' && P.x >= target * T + 16) || (kind === 'L' && P.x <= target * T + 16))) break;
    } else if (kind === 'U' || kind === 'D'){
      if (f === 0 && !P.climb) return null;
      if (!P.climb && P.ground && f > 0) break;
      if (!P.climb && !P.ground) { /* сорвался — досчитаем падение */ }
    } else if (kind === 'H'){
      if (f > 40 && P.ground && P.y > nr * T + 4) break;
      if (f > 60 && P.ground && P.y === nr * T) return null;
    } else {
      if (f === 0 && !P.ride) return null;
      if (!P.ride && f > 0 && P.ground) break;
    }
    startX = (f === 30) ? P.x : startX;
  }
  if (!P.ground || P.climb || P.ride) return null;
  const tx = Math.floor(P.x / T), tr = Math.round(P.y / T);
  if (tx === nx && tr === nr) return null;
  return { to: [tx, tr], frames: f + 1, req };
}

export function navFor(LZ, map){
  const L = LZ.logic, T = map.T, C = map.C, Wd = permissive(LZ, map), W = map.W;
  const id = (x, r) => r * W + x;
  const nodes = new Map();
  for (let r = 1; r < map.H; r++) for (let x = 0; x < W; x++){
    if (!Wd.support(x, r) || Wd.solid(x, r - 1) || Wd.solid(x, r - 2)) continue;
    nodes.set(id(x, r), { x, r, out: [], inn: [] });
  }
  const cartSt = new Set([Math.floor(map.cart.a / T), Math.floor(map.cart.b / T)]);
  const cartR = Math.round(map.cart.y / T);
  let sims = 0;
  for (const n of nodes.values()){
    const kinds = ['R', 'L'];
    const tB = Wd.tile(n.x, n.r - 1), tU = Wd.tile(n.x, n.r);
    if (tB === C.L) kinds.push('U');
    if (tU === C.L) kinds.push('D');
    if (tU === C.H) kinds.push('H');
    if (tU === C.V){ kinds.push('LU'); kinds.push('LD'); }
    if (n.r === cartR && cartSt.has(n.x)) kinds.push('C');
    for (const k of kinds){
      sims++;
      const res = simMacro(LZ, Wd, n.x, n.r, k);
      if (!res) continue;
      const to = nodes.get(id(res.to[0], res.to[1])); if (!to) continue;
      const e = { from: id(n.x, n.r), to: id(to.x, to.r), k, cost: res.frames, req: [...res.req] };
      n.out.push(e); to.inn.push(e);
    }
  }
  // особые узлы
  const nodeAt = (px, py) => id(Math.floor(px / T), Math.round(py / T));
  const pick = {};
  map.items.forEach(it => { if (it.k === 'card') pick[nodeAt(it.x, it.y)] = (pick[nodeAt(it.x, it.y)] || 0) | BIT[it.color]; if (it.k === 'matrix') pick[nodeAt(it.x, it.y)] = (pick[nodeAt(it.x, it.y)] || 0) | BIT.matrix; });
  const lever = new Set(map.grates.map(g => id(g.tx + 1, g.r1 + 1)));
  const plant = new Set(); for (const n of nodes.values()) if (Math.abs(n.x * T + 16 - map.plant.x) < 30 && n.r * T === map.plant.y) plant.add(id(n.x, n.r));
  const exit = new Set(); for (const n of nodes.values()) if (n.r * T === map.exit.y && n.x * T + 16 < map.exit.x1 && Math.floor(n.x / map.SW) === map.exit.X) exit.add(id(n.x, n.r));
  const start = nodeAt(map.start.x, map.start.y);
  return { nodes, pick, lever, plant, exit, start, id, sims, T, W, Wd };
}
function allowed(e, mask){ for (const q of e.req) if (!(mask & BIT[q])) return false; return true; }
// состояние = узел*64 + маска; переходы с автоподбором ключей, рычаг и закладка — по желанию
export function stateGraph(nav, opts = {}){
  const noHatch = !!opts.noHatch;
  function arrive(n, mask){ return mask | (nav.pick[n] || 0); }
  function* next(s){
    const n = Math.floor(s / 64), mask = s % 64, node = nav.nodes.get(n);
    for (const e of node.out){ if (noHatch && e.k === 'H') continue; if (allowed(e, mask)) yield [e.to * 64 + arrive(e.to, mask), e]; }
    if (nav.lever.has(n) && !(mask & BIT.lever)) yield [n * 64 + (mask | BIT.lever), { k: 'G', cost: 2 }];
    if (nav.plant.has(n) && (mask & BIT.matrix) && !(mask & BIT.planted)) yield [n * 64 + (mask | BIT.planted), { k: 'P', cost: 75 }];
  }
  return { next, arrive, startState: nav.start * 64 + arrive(nav.start, 0), won: s => nav.exit.has(Math.floor(s / 64)) && (s % 64 & BIT.planted) };
}
export function forward(G){
  const seen = new Set([G.startState]), q = [G.startState];
  while (q.length){ const s = q.pop(); for (const [t] of G.next(s)) if (!seen.has(t)){ seen.add(t); q.push(t); } }
  return seen;
}
export function canWinSet(G, states){
  // обратный обход по рёбрам среди достижимых состояний
  const back = new Map(); for (const s of states) for (const [t] of G.next(s)){ if (!back.has(t)) back.set(t, []); back.get(t).push(s); }
  const ok = new Set(), q = []; for (const s of states) if (G.won(s)){ ok.add(s); q.push(s); }
  while (q.length){ const s = q.pop(); for (const p of back.get(s) || []) if (!ok.has(p)){ ok.add(p); q.push(p); } }
  return ok;
}
// Дейкстра по кадрам из состояния s0 до победы
export function fastest(G, s0){
  const dist = new Map([[s0, 0]]), pq = [[0, s0]];
  while (pq.length){
    let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [d, s] = pq.splice(bi, 1)[0]; if (d > dist.get(s)) continue;
    if (G.won(s)) return d;
    for (const [t, e] of G.next(s)){ const nd = d + e.cost; if (nd < (dist.has(t) ? dist.get(t) : 1e18)){ dist.set(t, nd); pq.push([nd, t]); } }
  }
  return Infinity;
}
// расстояния до цели (узлы) при фиксированной маске — обратная Дейкстра
function distTo(nav, targets, mask){
  const dist = new Map(), pq = []; for (const t of targets){ dist.set(t, 0); pq.push([0, t]); }
  // двоичная куча
  const heap = []; const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const [d, n] of pq) push(d, n);
  while (heap.length){
    const [d, n] = pop(); if (d > dist.get(n)) continue;
    for (const e of nav.nodes.get(n).inn){ if (!allowed(e, mask)) continue; const nd = d + e.cost; if (nd < (dist.has(e.from) ? dist.get(e.from) : 1e18)){ dist.set(e.from, nd); push(nd, e.from); } }
  }
  return dist;
}

// ---------- бот ----------
export function playLaz(LZ, seed, opts = {}){
  const o = Object.assign({ diff: 1, react: [0.15, 0.25], miss: 0.12, maxT: 1500, god: false, timing: 0.04 }, opts);
  const rng = mulberry32(seed * 7919 + 13), L = LZ.logic, T = L.T;
  const events = [];
  const game = LZ.Game({ diff: o.diff, rng: mulberry32(seed), god: o.god, onEvent: (t) => events.push(t) }).start();
  const S = game.state(), map = S.map;
  const nav = o.nav || navFor(LZ, map);
  const cardNode = c => { const it = map.items.find(i => i.k === 'card' && i.color === c); return nav.id(Math.floor(it.x / T), Math.round(it.y / T)); };
  const matNode = (() => { const it = map.items.find(i => i.k === 'matrix'); return nav.id(Math.floor(it.x / T), Math.round(it.y / T)); })();
  const phases = [
    { name: 'red', tgt: [cardNode('red')], mask: 0, done: () => S.cards.red },
    { name: 'blue', tgt: [cardNode('blue')], mask: BIT.red, done: () => S.cards.blue },
    { name: 'yellow', tgt: [cardNode('yellow')], mask: BIT.red | BIT.blue, done: () => S.cards.yellow },
    { name: 'matrix', tgt: [matNode], mask: 7, done: () => S.matrix },
    { name: 'plant', tgt: [...nav.plant], mask: 7 | BIT.matrix, done: () => S.planted },
    { name: 'lever', tgt: [...nav.lever], mask: 7 | BIT.matrix | BIT.planted, done: () => map.grates.every(g => S.wd.open[g.r0 * S.wd.W + g.tx]) },
    { name: 'exit', tgt: [...nav.exit], mask: 7 | BIT.matrix | BIT.planted | BIT.lever, done: () => S.won }
  ];
  phases.forEach(p => { p.dist = (o.distCache && o.distCache[p.name]) || distTo(nav, p.tgt, p.mask); if (o.distCache) o.distCache[p.name] = p.dist; });
  let ph = 0, t = 0, think = 0, cur = null, plan = null, fight = null, lastNode = -1, nodeT = 0, stuck = false, firstAt = null;
  const R = () => o.react[0] + rng() * (o.react[1] - o.react[0]);
  let pending = [], thermo = null;   // отложенные нажатия (реакция)
  let hold = { dx: 0, dy: 0, run: false };
  const why = {};
  while (t < o.maxT && !S.over){
    const P = S.hero;
    while (ph < phases.length && phases[ph].done()) ph++;
    if (ph >= phases.length) break;
    if (ph >= 1 && firstAt == null) firstAt = t;
    think -= DT;
    // решения — раз в «реакцию»
    if (think <= 0 && !P.dead){
      think = R();
      fight = null;
      // угрозы на том же уровне
      let best = null, bd = 1e9;
      for (const e of S.enemies){
        if (e.out || !L.scrOf || Math.abs(e.y - P.y) > 24) continue;
        const es = L.scrOf(e.x, e.y), hs = L.scrOf(P.x, P.y); if (es.X !== hs.X || es.Y !== hs.Y) continue;
        const d = Math.abs(e.x - P.x); if (d < bd){ bd = d; best = e; }
      }
      if (best && bd < 150 && P.ground && !P.climb && !P.ride && rng() > o.miss * 0.5){
        const e = best, aware = e.st === 'chase' || e.susp > 0.6, front = (e.x - P.x) * P.face > 0;
        const kind = L.KINDS[e.k];
        if (!aware && bd < 34 && ((P.x - e.x) * e.face < 0 || e.sleep)) fight = { e, act: 'takedown' };
        else if (aware || bd < 60) fight = { e, act: 'fight' };
        if (fight && e.atk && !e.atk.done && kind.high && rng() < 0.75) fight.duck = true;
      }
      // орех на подлёте — пригнуться
      if (S.proj.some(p => p.from === 'enemy' && Math.abs(p.y - (P.y - 44)) < 20 && Math.abs(p.x - P.x) < 140 && (p.x - P.x) * p.vx < 0)) fight = Object.assign(fight || {}, { duck: true });
    }
    // исполнение
    let dx = 0, dy = 0, run = false;
    if (P.dead){ game.setInput(0, 0, false); }
    else if (fight && fight.e && !fight.e.out){
      const e = fight.e, d = e.x - P.x, ad = Math.abs(d), kind = L.KINDS[e.k];
      const need = fight.act === 'takedown' ? 26 : (e.k === 'heavy' ? 40 : 36);
      const overLadder = S.wd.tile(Math.floor(P.x / T), Math.round(P.y / T)) === L.C.L || S.wd.tile(Math.floor(P.x / T), Math.round(P.y / T)) === L.C.V;
      if (fight.duck && !overLadder){ dy = 1; }
      else if (ad > need){ dx = Math.sign(d); }
      else {
        if (Math.sign(d) !== P.face && ad > 4) dx = Math.sign(d);
        else if (!P.atk && think < DT * 2){
          const lowE = P.en < 12;
          if (fight.act === 'takedown') pending.push({ at: t + rng() * o.timing, a: 'punch' });
          else if (!lowE) pending.push({ at: t + rng() * o.timing, a: e.k === 'heavy' && e.down <= 0 && rng() < 0.4 ? 'kickLow' : 'kick' });
        }
      }
    } else if (P.ground && !P.climb && !P.ride && P.hp < 6.5 && (thermo = S.items.find(it => it.k === 'thermos' && !it.taken && Math.abs(it.y - P.y) < 4 && Math.abs(it.x - P.x) < 560 && L.scrOf(it.x, it.y).X === L.scrOf(P.x, P.y).X))) {
      dx = Math.sign(thermo.x - P.x);   // термос на этом экране — сначала чай
    } else {
      // навигация
      const p = phases[ph];
      if (P.ground && !P.climb && !P.ride){
        const n = nav.id(Math.floor(P.x / T), Math.round(P.y / T));
        if (n !== lastNode){ lastNode = n; nodeT = 0; } else nodeT += DT;
        let bestE = null, bv = p.dist.has(n) ? p.dist.get(n) : 1e18;
        const node = nav.nodes.get(n);
        if (node) for (const e of node.out){
          if (!allowed(e, p.mask)) continue;
          const v = e.cost + (p.dist.has(e.to) ? p.dist.get(e.to) : 1e18);
          if (v < bv - 0.5 || (bestE == null && v <= bv && p.dist.get(n) > 0)){ bv = v; bestE = e; }
        }
        if (p.name === 'lever' && nav.lever.has(n)) { cur = { k: 'G' }; }
        else if (p.name === 'plant' && nav.plant.has(n)) { cur = { k: 'P' }; }
        else if (node) cur = bestE;   // на краю клетки без опоры — продолжаем прежнее ребро
        if (nodeT > 10){ stuck = true; why.stuck = (why.stuck || 0) + 1; nodeT = 0; }
      }
      if (cur){
        const cx = Math.floor(P.x / T) * T + 16;
        const align = ['U', 'D', 'H', 'LU', 'LD', 'C', 'G', 'P'].includes(cur.k);
        if (align && P.ground && !P.climb && !P.ride && Math.abs(P.x - cx) > 5) dx = Math.sign(cx - P.x);
        else if (cur.k === 'R') dx = 1;
        else if (cur.k === 'L') dx = -1;
        else if (cur.k === 'U') dy = -1;
        else if (cur.k === 'D' || cur.k === 'H') dy = 1;
        else if (cur.k === 'P') dy = -1;
        else if (P.ground && !P.ride && (cur.k === 'LU' || cur.k === 'C' || cur.k === 'G')) dy = (Math.floor(t * 4) % 2) ? -1 : 0;
        else if (P.ground && !P.ride && cur.k === 'LD') dy = (Math.floor(t * 4) % 2) ? 1 : 0;
        if (P.climb) dy = cur.k === 'D' ? 1 : cur.k === 'U' ? -1 : dy;
        run = ph >= 4 && P.en > 35 && (cur.k === 'R' || cur.k === 'L');
      }
    }
    if (!P.dead) game.setInput(dx, dy, run);
    pending = pending.filter(q => { if (q.at <= t){ if (q.a === 'kickLow'){ game.setInput(dx, 1, false); game.press('kick'); } else game.press(q.a); return false; } return true; });
    game.update(DT); t += DT;
  }
  const evc = {}; events.forEach(e => evc[e] = (evc[e] || 0) + 1);
  return { evc: o.debugEv ? evc : undefined, won: !!S.won, seed, time: S.time, phase: phases[Math.min(ph, phases.length - 1)].name, ph, deaths: S.deaths, kos: S.kos, alarms: S.alarms, lose: S.lose, stuck, firstAt, why, bombT: S.bombT, score: S.score };
}
