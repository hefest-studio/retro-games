/* ГЛУБЬ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Карту знает (как игрок, который уже открыл мини-карту), но управляет только как человек:
   setInput(dx, dy, jump) и mole(dir) — те же «макросы» движения, что строит граф проходимости (logic.ACTS).
   Человеческие ограничения:
   - реакция: решение через 150–250 мс после приземления; часть решений «засматривается» (lapse);
   - время нажатий с ошибкой ±(timing) с: прыжок может выйти короче/длиннее задуманного;
   - обитателей видит с задержкой и часть не замечает (miss); ждёт, пока путь освободится, но не дольше ~1.3 с;
   - ползунов впереди на своём полу иногда снимает кротом (как сделал бы игрок).
   opts: { react:[0.15,0.25], timing=0.035, lapse=0.06, miss=0.2, perfect=false, maxT=1800, stopAt=null (число кристаллов) } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const shared = new WeakMap();
// общий для всех партий граф «всё выкопано, Печать открыта» + обратные рёбра
function navAll(Gb){
  const L = Gb.logic, W = L.world();
  if (shared.has(W)) return shared.get(W);
  const nav = L.Nav(W), dug = {};
  for (let g = 1; g <= W.nGroups; g++) dug[g] = true;
  const st = { dug, gate: true }, rev = new Map(), nodes = [];
  const st0 = { dug: {}, gate: false };
  W.rooms.forEach(rm => { const R = nav.room(st, rm.i); R.nodes.forEach(n => { nodes.push(n); R.out[n].forEach(e => {
    if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push({ from: n, e });
    // откуда крот достанет мягкую породу ребра: направление из исходной клетки (или null — отсюда не прокопать)
    if (e.g){ e.dig = {}; const rc = n % L.NK, r = Math.floor(rc / L.COLS), c = rc % L.COLS, a = L.ACTS[e.a];
      const dir = a.k === 'down' ? 'D' : a.k === 'up' ? 'U' : (a.d || ((e.to % L.COLS) > c ? 1 : -1));
      e.g.forEach(gq => { if (gq > 0) { const d = [dir, 'D', 1, -1].find(q => L.moleScan(st0, rm, c, r, q) === gq); e.dig[gq] = d == null ? null : d; } }); }
  }); }); });
  const o = { nav, st, rev, nodes, fields: new Map() };
  shared.set(W, o); return o;
}
// поле расстояний до ближайшей цели (Дейкстра по обратным рёбрам); gate — можно ли через Печать
function field(A, targets, gate, dug, nG){
  let dk = ''; for (let g = 1; g <= nG; g++) dk += dug[g] ? '1' : '0';
  const key = targets.slice().sort((a, b) => a - b).join(',') + (gate ? 'G' : '') + dk;
  if (A.fields.has(key)) return A.fields.get(key);
  const dist = new Map(), heap = [];
  const push = (n, d) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  targets.forEach(t => { dist.set(t, 0); push(t, 0); });
  while (heap.length){
    const [d, n] = pop(); if (d > dist.get(n)) continue;
    for (const { from, e } of (A.rev.get(n) || [])){
      if (e.g && e.g.some(gq => gq === -1 ? !gate : !dug[gq] && e.dig[gq] == null)) continue;
      const nd = d + e.t + 0.35;
      if (nd < (dist.has(from) ? dist.get(from) : Infinity)){ dist.set(from, nd); push(from, nd); }
    }
  }
  A.fields.set(key, dist); return dist;
}

export function playGlub(Gb, seed, opts = {}){
  const L = Gb.logic, W = L.world(), A = navAll(Gb), NK = L.NK, COLS = L.COLS;
  const perfect = !!opts.perfect, brng = mulberry32(seed * 7919 + 17);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const timing = perfect ? 0 : (opts.timing == null ? 0.035 : opts.timing);
  const lapse = perfect ? 0 : (opts.lapse == null ? 0.06 : opts.lapse);
  const missP = perfect ? 0 : (opts.miss == null ? 0.2 : opts.miss);
  const maxT = opts.maxT || 1800;
  const res = { seed, crystals: 0, firstAt: null, won: false, time: 0, deaths: 0, stuns: 0, hurts: 0, why: {}, kills: 0, stuck: false, over: false };
  const game = Gb.Game({ rng: mulberry32(seed), dmgMul: opts.dmgMul, onEvent: (t, d) => {
    if (t === 'crystal'){ res.crystals = d.n; if (d.n === 1) res.firstAt = S.time; }
    if (t === 'hurt') res.why[d.why] = (res.why[d.why] || 0) + 1;
  } }).start();
  const S = game.state(), dt = 1 / 60;
  const seen = new WeakMap();
  const noticed = e => { if (!seen.has(e)) seen.set(e, brng() >= missP); return seen.get(e); };
  let mode = 'decide', wait = perfect ? 0.05 : r0 + brng() * (r1 - r0), act = null, actT = 0, mem = null, noise = 0;
  let waited = 0, lastKey = '', lastRoom = -1, best = Infinity, bestT = 0, wander = 0, waitMole = 0;

  function targets(){
    const left = W.crystals.filter(c => !S.got[c.id]).map(c => c.node);
    return left.length ? left : [W.heart.node];
  }
  function nodeHere(){
    const H = S.hero; if (!H.ground || H.climb || H.kb > 0) return null;
    const row = Math.round(H.y); if (Math.abs(H.y - row) > 0.01) return null;
    const rm = W.rooms[H.room]; let col = Math.floor(H.x);
    if (!L.isStand(S, rm, col, row)){ const alt = H.x - col < 0.5 ? col - 1 : col + 1; if (L.isStand(S, rm, alt, row)) col = alt; else return null; }
    return { n: H.room * NK + row * COLS + col, c: col, r: row, rm };
  }
  // опасно ли сейчас идти к точке (tx,ty) — видит обитателей с небольшой задержкой
  function danger(tx, ty){
    const H = S.hero, rm = W.rooms[H.room], hx = H.x, hy = H.y - 0.85;
    for (const e of S.enemies){
      if (!e.alive || !noticed(e)) continue;
      const ex = e.x - (e.vx || 0) * 0.15, ey = e.type === 'moth' ? e.y : e.y - 0.3;
      // расстояние от обитателя до отрезка «я → цель», с запасом на его ход
      const vx = tx - hx, vy = ty - hy, l2 = vx * vx + vy * vy || 1;
      let k = ((ex - hx) * vx + (ey - hy) * vy) / l2; k = Math.max(0, Math.min(1, k));
      const d = Math.hypot(ex - (hx + vx * k), ey - (hy + vy * k));
      if (d < (e.type === 'moth' ? 1.7 : 1.3)) return true;
    }
    for (const v of rm.vents){
      if (!(L.ventOn(v, S.time) || L.ventWarn(v, S.time))) continue;
      const vx = v.x + 0.5; if (Math.min(hx, tx) - 0.9 < vx && vx < Math.max(hx, tx) + 0.9) return true;
    }
    return false;
  }

  for (let step = 0; step < maxT * 60 && !S.over && !S.won; step++){
    if (opts.stopAt && S.crystals.length >= opts.stopAt) break;
    const H = S.hero;
    let inp = { dx: 0, dy: 0, jump: false };
    if (S.phase !== 'play'){ mode = 'decide'; wait = 0.3; game.setInput(0, 0, false); game.update(dt); continue; }
    if (H.room !== lastRoom){ lastRoom = H.room; }
    if (mode === 'act'){
      inp = L.drive(W, act, actT, H, mem.X0, noise);
      actT += dt;
      game.setInput(inp.dx, inp.dy, inp.jump); game.update(dt);
      const f = L.finished(W, act, actT, H, mem);
      if (f || H.kb > 0){ mode = 'decide'; wait = perfect ? 0.03 : r0 + brng() * (r1 - r0); if (!perfect && brng() < lapse) wait += 0.3 + brng() * 0.5; }
      continue;
    }
    if (mode === 'wander'){
      wander -= dt; game.setInput(inp.dx = (Math.floor(S.time) % 4 < 2 ? 1 : -1), 0, brng() < 0.02); game.update(dt);
      if (wander <= 0) mode = 'decide';
      continue;
    }
    // decide
    if (wait > 0 || S.mole.state !== 'home' && waitMole > 0){ wait -= dt; waitMole -= dt; game.setInput(0, 0, false); game.update(dt); continue; }
    const here = nodeHere();
    if (!here){ game.setInput(0, 0, false); game.update(dt); continue; }
    const cx = here.c + 0.5;
    if (Math.abs(H.x - cx) > 0.1){ game.setInput(H.x < cx ? 1 : -1, 0, false); game.update(dt); continue; }
    const tg = targets(), dist = field(A, tg, S.gate, S.dug, W.nGroups), tkey = tg.length + (S.gate ? 'G' : '');
    if (tkey !== lastKey){ lastKey = tkey; best = Infinity; bestT = S.time; }
    const dHere = dist.has(here.n) ? dist.get(here.n) : Infinity;
    if (dHere < best - 0.5){ best = dHere; bestT = S.time; }
    if (S.time - bestT > 120){ if (opts.log) console.log("stuck", W.rooms[H.room].x, W.rooms[H.room].y, here.c, here.r, S.crystals.length); best = Infinity; bestT = S.time; mode = 'wander'; wander = 2 + brng() * 2; res.stuck = true; continue; }
    // ползун впереди на этом полу — снять кротом
    if (S.mole.state === 'home' && !perfect){
      const cr = S.enemies.find(e => e.alive && e.type === 'crawler' && noticed(e) && Math.abs(e.y - H.y) < 0.1 && Math.abs(e.x - H.x) < 7 && Math.abs(e.x - H.x) > 0.8);
      if (cr && brng() < 0.7){ game.mole(cr.x > H.x ? 1 : -1); waitMole = 0.2; wait = 0.15; continue; }
    }
    // лучшее ребро
    let bestE = null, bestC = Infinity, dig = null;
    for (const e of A.nav.edges(A.st, here.n)){
      const dt2 = dist.get(e.to); if (dt2 == null) continue;
      let need = null, ok = true;
      if (e.g) for (const gq of e.g){
        if (gq === -1){ if (!S.gate) ok = false; continue; }
        if (S.dug[gq]) continue;
        const d = e.dig[gq];
        if (d == null || L.moleScan(S, here.rm, here.c, here.r, d) !== gq){ ok = false; break; } need = d;
      }
      if (!ok) continue;
      const cost = e.t + dt2 + (need != null ? 0.6 : 0);
      if (cost < bestC){ bestC = cost; bestE = e; dig = need; }
    }
    if (!bestE){ mode = 'wander'; wander = 1.5; continue; }
    if (dig != null){
      if (S.mole.state === 'home'){ game.mole(dig); waitMole = 3; wait = 0.2; }
      else { game.setInput(0, 0, false); game.update(dt); }
      continue;
    }
    // ошибка исполнения: соседний по силе прыжок
    let a = L.ACTS[bestE.a];
    if (!perfect && a.k === 'jump' && a.d && brng() < 0.04){
      const alt = L.ACTS.filter(q => q.k === 'jump' && q.d === a.d && q.delay === a.delay);
      a = alt[Math.max(0, Math.min(alt.length - 1, alt.indexOf(a) + (brng() < 0.5 ? -1 : 1)))];
    }
    const to = bestE.to, trm = W.rooms[Math.floor(to / NK)], tc = to % NK;
    const tx = (trm.x - W.rooms[H.room].x) * COLS + (tc % COLS) + 0.5, ty = (trm.y - W.rooms[H.room].y) * L.ROWS + Math.floor(tc / COLS) - 0.85;
    if (danger(tx, ty) && waited < 1.3){ waited += dt; game.setInput(0, 0, false); game.update(dt); continue; }
    waited = 0;
    act = a; actT = 0; mem = { X0: L.absX(W, H), left: false, climbed: false }; noise = gauss() * timing; mode = 'act';
  }
  res.time = S.time; res.won = S.won; res.over = S.over; res.crystals = S.crystals.length;
  res.deaths = S.deaths; res.stuns = S.stuns; res.hurts = S.hurts; res.kills = S.kills; res.score = S.score;
  return res;
}
