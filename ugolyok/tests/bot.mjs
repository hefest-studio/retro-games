/* УГОЛЁК · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Карту знает (как игрок, который уже открыл карту шахты), но управляет только как человек:
   setInput(dx, dy, jump) — те же «макросы» движения, что строит граф проходимости (logic.ACTS).
   Человеческие ограничения:
   - реакция: решение через 150–250 мс после завершения движения; часть решений «засматривается» (lapse);
   - время нажатий с ошибкой ±(timing) с: прыжок может выйти короче/длиннее задуманного, иногда — соседний по силе;
   - ловушки по такту (прессы, капли, вагонетки) и обитателей оценивает на ~2,4 с вперёд по своему пути,
     но часть обитателей не замечает (miss), а ждать готов лишь несколько секунд — потом идёт «на авось»;
   - если стоять опасно — отходит на соседнюю безопасную клетку.
   opts: { react:[0.15,0.25], timing=0.035, lapse=0.06, miss=0.15, perfect=false, safe=false, maxT=2400, stopAt=null (уголь) } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const shared = new WeakMap();
// общий для всех партий граф «все ключи, заслонка открыта» + обратные рёбра
function navAll(U){
  const L = U.logic, W = L.world();
  if (shared.has(W)) return shared.get(W);
  const nav = L.Nav(W), keys = {};
  for (let k = 1; k <= L.KEYS; k++) keys[k] = true;
  const st = { keys, gate: true }, rev = new Map();
  W.rooms.forEach(rm => { const R = nav.room(st, rm.i); R.nodes.forEach(n => { R.out[n].forEach(e => {
    if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push({ from: n, e });
  }); }); });
  const o = { nav, st, rev, fields: new Map() };
  shared.set(W, o); return o;
}
const allowed = (e, S) => !e.g || e.g.every(gq => gq === -1 ? S.gate : !!S.keys[gq]);
// поле расстояний до ближайшей цели (Дейкстра по обратным рёбрам) с учётом ключей и заслонки
function field(A, targets, S){
  const key = targets.slice().sort((a, b) => a - b).join(',') + (S.gate ? 'G' : '') + Object.keys(S.keys).sort().join('');
  if (A.fields.has(key)) return A.fields.get(key);
  if (A.fields.size > 400) A.fields.clear();
  const dist = new Map(), heap = [];
  const push = (n, d) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  targets.forEach(t => { dist.set(t, 0); push(t, 0); });
  while (heap.length){
    const [d, n] = pop(); if (d > dist.get(n)) continue;
    for (const { from, e } of (A.rev.get(n) || [])){
      if (!allowed(e, S)) continue;
      const nd = d + e.t + 0.3;
      if (nd < (dist.has(from) ? dist.get(from) : Infinity)){ dist.set(from, nd); push(from, nd); }
    }
  }
  A.fields.set(key, dist); return dist;
}

export function playUgolyok(U, seed, opts = {}){
  const L = U.logic, W = L.world(), A = navAll(U), NK = L.NK, COLS = L.COLS, ROWS = L.ROWS;
  const perfect = !!opts.perfect, brng = mulberry32(seed * 7919 + 17);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const timing = perfect ? 0 : (opts.timing == null ? 0.035 : opts.timing);
  const lapse = perfect ? 0 : (opts.lapse == null ? 0.06 : opts.lapse);
  const missP = perfect ? 0 : (opts.miss == null ? 0.15 : opts.miss);
  const maxT = opts.maxT || 2400;
  const res = { seed, coal: 0, firstRoom: false, won: false, time: 0, deaths: 0, why: {}, stuck: false, over: false, keys: 0, lives: 0 };
  const startRoomCoal = W.rooms[W.start.room].coal;
  const game = U.Game({ rng: mulberry32(seed), safe: opts.safe, lives: opts.lives, onEvent: (t, d) => {
    if (t === 'die'){ res.why[d.why] = (res.why[d.why] || 0) + 1; learn = true; }
  } }).start();
  const S = game.state(), dt = 1 / 60;
  let learn = false;   // после гибели игрок запоминает всех обитателей этого экрана
  const seen = new WeakMap();
  const noticed = src => {
    if (!seen.has(src)){ const p = src.type ? missP : src.y0 != null && src.per ? missP * 0.3 : 0; seen.set(src, brng() >= p); }
    return seen.get(src);
  };
  let mode = 'decide', wait = perfect ? 0.05 : r0 + brng() * (r1 - r0), act = null, actT = 0, mem = null, noise = 0;
  let waited = 0, patience = 3 + brng() * 3, lastKey = '', best = Infinity, bestT = 0, wander = 0;

  function targets(){
    const left = W.coal.filter(c => !S.got[c.id]).map(c => c.node);
    W.keys.forEach(k => { if (!S.keys[k.key]) left.push(k.node); });
    return left.length ? left : [W.forge.node];
  }
  function nodeHere(){
    const H = S.hero; if (!H.ground || H.climb) return null;
    const row = Math.round(H.y); if (Math.abs(H.y - row) > 0.01) return null;
    const rm = W.rooms[H.room]; let col = Math.floor(H.x);
    if (!L.isStand(S, rm, col, row)){ const alt = H.x - col < 0.5 ? col - 1 : col + 1; if (L.isStand(S, rm, alt, row)) col = alt; else return null; }
    return { n: H.room * NK + row * COLS + col, c: col, r: row, rm };
  }
  // координаты узла в системе текущего экрана (клетки): {x, y} — ноги
  function nodeXY(n){
    const rm = W.rooms[S.hero.room], q = W.rooms[Math.floor(n / NK)], rc = n % NK;
    return { x: (q.x - rm.x) * COLS + rc % COLS + 0.5, y: (q.y - rm.y) * ROWS + Math.floor(rc / COLS), same: q.i === rm.i };
  }
  // первое столкновение с опасностями на пути (секунды от «сейчас») или null
  function danger(path, standT){
    if (S.helmet > 1.2) return null;
    const rm = W.rooms[S.hero.room], m = perfect ? 0.05 : 0.15;
    const hit = (x, y, tau) => {
      const hb = { x0: x - L.HW - m, x1: x + L.HW + m, y0: y - L.HH - m, y1: y + m };
      const hz = L.hazards(rm, S.time + tau);
      for (const h of hz) if (noticed(h.src) && L.overlap(hb, h)) return true;
      return false;
    };
    // траектория — та же физика, что у игры (свои прыжки игрок «чувствует»); опасности — по наблюдаемым циклам
    let tau = 0, last = nodeXY(path.length ? path[0].from : nodeHere().n);
    for (const { from, e } of path){
      const a = nodeXY(from); if (!a.same) return null;
      const rc = from % NK, act = L.ACTS[e.a], Hs = L.newHero(W, Math.floor(from / NK), rc % COLS + 0.5, Math.floor(rc / COLS));
      const mm = { X0: L.absX(W, Hs), left: false, climbed: false }, r0m = Hs.room;
      let s = 0;
      for (let n = 0; n < 400; n++){
        const ev = L.heroStep(W, S, Hs, L.drive(W, act, s, Hs, mm.X0), dt); s += dt;
        if (Hs.room !== r0m) return null;
        if ((n & 1) === 0 && hit(Hs.x, Hs.y, tau + s)) return tau + s;
        if (ev.fatal || L.finished(W, act, s, Hs, mm)) break;
      }
      tau += s + (perfect ? 0.03 : 0.2); last = { x: Hs.x, y: Hs.y };
      const b = nodeXY(e.to); if (!b.same) return null;
    }
    for (let s = 0; s <= standT; s += 0.05) if (hit(last.x, last.y, tau + s)) return tau + s;
    return null;
  }
  // опасность при лазании: dir −1 вверх, 1 вниз, 0 — висеть на месте
  function climbDanger(dir, T){
    if (S.helmet > 1.2) return null;
    const H = S.hero, rm = W.rooms[H.room], m = perfect ? 0.05 : 0.15;
    for (let s = 0; s <= T; s += 0.05){
      const y = H.y + dir * L.CLIMB * s, hb = { x0: H.x - L.HW - m, x1: H.x + L.HW + m, y0: y - L.HH - m, y1: y + m };
      for (const h of L.hazards(rm, S.time + s)) if (noticed(h.src) && L.overlap(hb, h)) return s;
    }
    return null;
  }
  function plan(n0, dist, maxPT){
    const path = []; let n = n0, T = 0;
    for (let k = 0; k < 8 && T < maxPT; k++){
      let bE = null, bc = Infinity;
      for (const e of A.nav.edges(A.st, n)){ if (!allowed(e, S)) continue; const d = dist.get(e.to); if (d == null) continue; if (e.t + d < bc){ bc = e.t + d; bE = e; } }
      if (!bE) break;
      path.push({ from: n, e: bE }); T += bE.t + 0.2; n = bE.to;
      if (dist.get(n) === 0 || Math.floor(n / NK) !== S.hero.room) break;
    }
    return path;
  }
  function go(e){
    let a = L.ACTS[e.a];
    // ошибка исполнения: соседний по силе прыжок
    if (!perfect && a.k === 'jump' && a.d && brng() < 0.04){
      const alt = L.ACTS.filter(q => q.k === 'jump' && q.d === a.d && q.delay === a.delay);
      a = alt[Math.max(0, Math.min(alt.length - 1, alt.indexOf(a) + (brng() < 0.5 ? -1 : 1)))];
    }
    act = a; actT = 0; mem = { X0: L.absX(W, S.hero), left: false, climbed: false }; noise = gauss() * timing; mode = 'act';
    waited = 0; patience = 3 + brng() * 3;
  }

  for (let step = 0; step < maxT * 60 && !S.over && !S.won; step++){
    if (opts.stopAt && S.coal >= opts.stopAt) break;
    const H = S.hero;
    if (learn){ learn = false; W.rooms[H.room].hz.enemies.forEach(e => seen.set(e, true)); W.rooms[H.room].hz.drips.forEach(e => seen.set(e, true)); }
    if (S.phase !== 'play'){ mode = 'decide'; wait = 0.3; game.setInput(0, 0, false); game.update(dt); continue; }
    if (!res.firstRoom && W.rooms[W.start.room].items.every(it => it.k !== 'coal' || S.got[it.id]) && startRoomCoal) res.firstRoom = true;
    if (mode === 'act'){
      let inp = L.drive(W, act, actT, H, mem.X0, noise);
      // на лестнице/верёвке видно новый экран — не лезть под ловушку, переждать
      if (H.climb && inp.dy){
        const go2 = climbDanger(inp.dy, 0.9), stay = climbDanger(0, 0.9);
        if (go2 != null && stay == null && waited < patience){ waited += dt; inp = { dx: 0, dy: 0, jump: false }; }
        else if (go2 != null && stay != null && climbDanger(-inp.dy, 0.9) == null) inp = { dx: 0, dy: -inp.dy, jump: false };
      }
      actT += dt;
      game.setInput(inp.dx, inp.dy, inp.jump); game.update(dt);
      const f = L.finished(W, act, actT, H, mem);
      if (f){ mode = 'decide'; wait = perfect ? 0.03 : r0 + brng() * (r1 - r0); if (!perfect && brng() < lapse) wait += 0.3 + brng() * 0.5; }
      continue;
    }
    if (mode === 'wander'){
      wander -= dt; game.setInput(Math.floor(S.time) % 4 < 2 ? 1 : -1, 0, brng() < 0.02); game.update(dt);
      if (wander <= 0) mode = 'decide';
      continue;
    }
    // decide
    const here = nodeHere();
    if (!here){ game.setInput(0, 0, false); game.update(dt); continue; }
    const cx = here.c + 0.5;
    if (Math.abs(H.x - cx) > 0.1){ game.setInput(H.x < cx ? 1 : -1, 0, false); game.update(dt); continue; }   // в т.ч. против конвейера
    if (wait > 0){ wait -= dt; game.setInput(0, 0, false); game.update(dt); continue; }
    const tg = targets(), dist = field(A, tg, S), tkey = tg.length + (S.gate ? 'G' : '') + Object.keys(S.keys).length;
    if (tkey !== lastKey){ lastKey = tkey; best = Infinity; bestT = S.time; }
    const dHere = dist.has(here.n) ? dist.get(here.n) : Infinity;
    if (dHere < best - 0.5){ best = dHere; bestT = S.time; }
    if (S.time - bestT > 150){ best = Infinity; bestT = S.time; mode = 'wander'; wander = 2 + brng() * 2; res.stuck = true; continue; }
    const path = plan(here.n, dist, 2.4);
    if (!path.length){ mode = 'wander'; wander = 1.5; continue; }
    const bad = danger(path, 0.5);
    if (bad == null){ go(path[0].e); continue; }
    // лучший путь опасен — есть ли почти такой же по длине, но безопасный (например, пешком вместо прыжка)?
    const c0 = path[0].e.t + dist.get(path[0].e.to), cands = [];
    for (const e of A.nav.edges(A.st, here.n)){
      if (e === path[0].e || !allowed(e, S) || !dist.has(e.to)) continue;
      const c = e.t + dist.get(e.to); if (c < c0 + 2.5) cands.push({ e, c });
    }
    cands.sort((p, q) => p.c - q.c);
    let alt = null;
    for (const q of cands.slice(0, 4)){
      const p2 = [{ from: here.n, e: q.e }].concat(Math.floor(q.e.to / NK) === H.room ? plan(q.e.to, dist, 1.8) : []);
      if (danger(p2, 0.5) == null){ alt = q.e; break; }
    }
    if (alt){ go(alt); continue; }
    const stayBad = danger([], 1.0);
    if (stayBad == null && waited < patience){ waited += dt; game.setInput(0, 0, false); game.update(dt); continue; }
    if (stayBad != null){
      // стоять опасно — шаг на соседнюю клетку, где безопасно (ближе к цели — лучше)
      let esc = null, ec = Infinity;
      for (const e of A.nav.edges(A.st, here.n)){
        if (!allowed(e, S) || Math.floor(e.to / NK) !== H.room) continue;
        if (danger([{ from: here.n, e }], 1.0) != null) continue;
        const c = (dist.get(e.to) ?? 999) + e.t; if (c < ec){ ec = c; esc = e; }
      }
      if (esc){ go(esc); continue; }
    }
    go(path[0].e);
  }
  res.time = S.time; res.won = S.won; res.over = S.over; res.coal = S.coal; res.total = S.total;
  res.deaths = S.deaths; res.score = S.score; res.keys = Object.keys(S.keys).length; res.lives = S.lives;
  return res;
}
