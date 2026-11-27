/* ОСКОЛОК · tests/bot.mjs — граф проходимости и «человеческий» бот.
   makeNav(O, li, opts) — граф уровня: узел — клетка опоры (r*W+c; герой стоит по центру клетки), рёбра прогоняются НАСТОЯЩЕЙ игрой
   (O.Game в режиме calm — без врагов): шаг, шаг-спуск, прыжки (с разбега, с удержанием), бросок осколка с земли и в вершине прыжка + обмен.
   Ребро = {to, frames (RLE ввода), cost}. 'G' — выход. opts.noShard — граф без осколка (доказывает, что он обязателен).
   playGame(O, seed, opts) — вся игра подряд «как человек»: реакция 150–250 мс, центрируется у узла с допуском, исполняет макрос с ошибкой
   таймингов ±jit кадров, врагов замечает с вероятностью opts.aware и бьёт осколком, после урона перепланирует.
   opts: { react:[0.15,0.25], jit:2, off:0.18, aware:0.7, from:0, maxLevelT:200 } */
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const DT = 1 / 60;
export const toIn = (f) => ({ dx: f.x || 0, dy: f.dy || 0, jump: !!f.jump, act: !!f.act, recall: !!f.recall });
const AIM = [[1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];   // [ходит ли dx, dy] для видов броска 0..4

export function makeNav(O, li, opts = {}) {
  const L = O.logic, def = O.LEVELS[li], P = L.parse(def), W = P.W, H = P.H, M = { W, H, t: P.t };
  let bad = false;
  const game = O.Game({ calm: true, start: { fi: li }, onEvent: (t) => { if (t === 'hurt' || t === 'die' || t === 'fizzle') bad = true; } }).start();
  const S = game.state();
  const id = (c, r) => r * W + c;
  const standable = (c, r) => c > 0 && c < W - 1 && r > 1 && r < H && L.solid(M, c, r) && L.bodyFree(M, c + 0.5, r) && L.hazard({ x: c + 0.5, y: r }, M) === null;
  function rle(frames) { const out = []; for (const f of frames) { const k = JSON.stringify(f), l = out[out.length - 1]; if (l && l[0] === k) l[1]++; else out.push([k, 1]); } return out.map(([k, n]) => [JSON.parse(k), n]); }
  function run(c, r, face, plan) {
    bad = false; game._place(c + 0.5, r, face); game._reset();
    const frames = []; let idle = 0, done = false;
    for (let f = 0; f < 700; f++) {
      let inp = done ? null : plan(f, S);
      if (!inp) { done = true; inp = {}; }
      frames.push(inp); game.setInput(toIn(inp)); game.update(DT);
      if (bad) return null;
      if (S.phase !== 'play') return { to: 'G', frames: rle(frames), cost: frames.length };
      const h = S.hero;
      if (done) { if (h.ground && Math.abs(h.vx) < 0.05 && S.shard.st === 'hand') { if (++idle >= 3) break; } else idle = 0; }
    }
    const h = S.hero, c2 = Math.floor(h.x), r2 = Math.round(h.y);
    if (!h.ground || Math.abs(h.y - r2) > 1e-3 || S.shard.st !== 'hand' || !standable(c2, r2)) return null;
    return { to: id(c2, r2), frames: rle(frames), cost: frames.length };
  }
  // ---- макросы ----
  const walk = (c, d, mode) => (f, St) => {
    const h = St.hero; if (f > 90) return null;
    if (f > 0 && !h.ground) { if (mode === 'step') return null; return { x: d }; }   // сошёл с края: «шаг» — отпустить, «бег» — держать до приземления
    if (f > 3 && h.ground && (d > 0 ? h.x >= c + d + 0.5 : h.x <= c + d + 0.5)) return null;
    return { x: d };
  };
  const jump = (d, pre, hold) => { let jf = -1, air = 0; return (f, St) => {
    const h = St.hero;
    if (f < pre) return { x: d };
    if (f === pre) { jf = f; return { x: d, jump: true }; }
    if (f - jf > 4 && h.ground) return null;
    if (hold === 'full' || (f - jf) / 60 < hold) return { x: d };
    return {};
  }; };
  const throwM = (face, kind, apex) => { let st = 0, tf = -1; const a = AIM[kind];
    return (f, St) => {
      const sh = St.shard;
      if (apex && st === 0 && f < 20) return f === 0 ? { jump: true } : {};
      if (st === 0) { st = 1; tf = f; return { x: a[0] ? face : 0, dy: a[1], act: true }; }
      if (st === 1) { if (sh.st === 'plant') { st = 2; return { act: true }; } if (sh.st !== 'fly') return null; return {}; }
      return null;
    }; };
  function build(n) {
    const c = n % W, r = (n / W) | 0, out = [];
    const add = (e) => { if (e && e.to !== n) out.push(e); };
    for (const d of [-1, 1]) { add(run(c, r, d, walk(c, d, 'step'))); add(run(c, r, d, walk(c, d, 'run'))); }
    for (const d of [-1, 0, 1]) for (const pre of d ? [0, 10, 20] : [0]) for (const hold of d ? ['full', 0.3, 0.5] : ['full']) add(run(c, r, d || 1, jump(d, pre, hold)));
    if (!opts.noShard) for (const face of [-1, 1]) for (let k = 0; k < 5; k++) for (const apex of [false, true]) {
      if ((k === 2 || k === 4) && face === -1) continue;
      add(run(c, r, face, throwM(face, k, apex)));
    }
    const best = new Map(); for (const e of out) { const o = best.get(e.to); if (!o || e.cost < o.cost) best.set(e.to, e); }
    return [...best.values()];
  }
  const memo = new Map();
  const edges = (n) => { if (!memo.has(n)) memo.set(n, build(n)); return memo.get(n); };
  const start = id(Math.floor(P.start.x), Math.round(P.start.y));
  // Дейкстра с ленивой раскруткой; targets — Set узлов или 'G'
  function search(from, maxN = 4000, pen) {
    const dist = new Map([[from, 0]]), prev = new Map(), q = [[0, from]], seen = new Set();
    while (q.length) {
      let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
      const [d, n] = q.splice(bi, 1)[0];
      if (seen.has(n)) continue; seen.add(n);
      if (n === 'G') return { dist, prev, found: true, seen };
      if (seen.size > maxN) break;
      for (const e of edges(n)) { const nd = d + e.cost + (pen ? pen(n, e) : 0); if (nd < (dist.has(e.to) ? dist.get(e.to) : Infinity)) { dist.set(e.to, nd); prev.set(e.to, [n, e]); q.push([nd, e.to]); } }
    }
    return { dist, prev, found: false, seen };
  }
  function pathTo(res, to) { const out = []; let n = to; while (res.prev.has(n)) { const [p, e] = res.prev.get(n); out.unshift({ from: p, e }); n = p; } return out; }
  function reachable() { const res = search(start, 20000); return res; }
  return { O, L, def, W, H, M, id, start, standable, edges, search, pathTo, reachable, game, run };
}

// ---------- человеческий бот ----------
export function playGame(O, seed, opts = {}) {
  const L = O.logic, K = L.K, rng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25], jit = opts.jit == null ? 3 : opts.jit, offMax = opts.off == null ? 0.18 : opts.off, aware = opts.aware == null ? 0.7 : opts.aware;
  const maxLevelT = opts.maxLevelT || 200, from = opts.from || 0;
  const res = { seed, won: false, cleared: 0, deaths: 0, hurts: 0, over: false, stuck: false, levels: [], why: {}, t: 0 };
  let game, S;
  const navs = new Map(); const navFor = (li) => { if (!navs.has(li)) navs.set(li, makeNav(O, li)); return navs.get(li); };
  const lvRec = () => res.levels[S.fi] || (res.levels[S.fi] = { fi: S.fi, deaths: 0, hurts: 0, t0: S.time });
  game = O.Game({ rng: mulberry32(seed), calm: !!opts.calm, start: { fi: from }, onEvent: (t, d) => {
    if (!S) return;
    if (t === 'hurt') { res.hurts++; lvRec().hurts++; res.why[d.why] = (res.why[d.why] || 0) + 1; }
    if (t === 'die') { res.deaths++; lvRec().deaths++; queue = []; shotState = 0; }
    if (t === 'respawn' || t === 'respawnSafe') { queue = []; shotState = 0; wait = react(); }
    if (t === 'clear' || t === 'win') { res.cleared++; lvRec().done = true; queue = []; shotState = 0; }
    if (t === 'gameover') res.over = true;
  } }).start();
  S = game.state();
  let wait = Math.round((r0 + rng() * (r1 - r0)) * 60), queue = [], mode = 'idle', held = {}, lastT = 0, shotT = 0, shotState = 0;
  const react = () => Math.round((r0 + rng() * (r1 - r0)) * 60);
  const reactF = react;
  let stuckT = 0, expect = null; const bad = new Map();
  function expand(e) {   // RLE → кадры, со сдвигом событий (прыжок/бросок/обмен) на ±jit кадров
    const out = []; for (const [inp, n] of e.frames) for (let i = 0; i < n; i++) out.push(Object.assign({}, inp));
    // сдвиг: каждое событие (jump/act) двигаем на j ∈ [-jit, jit] кадров (внутри допустимого)
    const ev = []; out.forEach((f, i) => { if (f.jump || f.act) ev.push(i); });
    ev.forEach((i, ei) => {
      const late = ei > 0 && out[i].act && !out[i].jump;   // обмен нажимают, увидев воткнувшийся осколок: только позже
      const j = late ? Math.round(rng() * jit * 2) : Math.round((rng() * 2 - 1) * jit), t = Math.max(0, Math.min(out.length - 1, i + j)); if (t === i) return;
      const f = out[i], key = f.jump ? 'jump' : 'act';
      out[i] = Object.assign({}, f); delete out[i][key]; out[t] = Object.assign({}, out[t]); out[t][key] = true; if (f.dy != null && key === 'act') { out[t].dy = f.dy; if (f.x) out[t].x = f.x; }
    });
    return out;
  }
  function nearEnemy() {
    const h = S.hero; let best = null, bd = 1e9;
    for (const e of S.enemies) { if (!e.alive) continue; const dx = e.x - h.x, dy = (e.y - h.y); if (Math.abs(dx) > 7 || Math.abs(dy) > 1.6) continue; if (Math.abs(dx) < bd) { bd = Math.abs(dx); best = e; } }
    return best;
  }
  const h0 = () => S.hero;
  let frameN = 0;
  while (S.time < 1e9 && frameN < 60 * 60 * 25) {
    frameN++;
    const ph = S.phase;
    if (ph === 'won') { res.won = true; break; }
    if (opts.single && res.cleared > 0) break;
    if (ph === 'over') { res.over = true; break; }
    if (ph === 'cont') { if (S.conts > 0) game.continueGame(); else { game.giveUp(); res.over = true; break; } continue; }
    if (ph === 'clear') { game.setInput({}); game.update(DT); queue = []; continue; }
    if (ph === 'dead') { game.setInput({}); game.update(DT); continue; }
    const lr = lvRec();
    if (S.time - lr.t0 > maxLevelT) { res.stuck = true; res.stuckAt = S.hero.x.toFixed(1) + ',' + S.hero.y.toFixed(1); break; }
    const h = S.hero; let inp = {};
    if (wait > 0) { wait--; }
    else if (queue.length) { inp = queue.shift(); if (!queue.length) { mode = 'settle'; wait = 0; } }
    else if (shotState > 0) {   // отстрел врага: бросок → ждать → вернуть
      if (shotState === 1) { inp = { x: h.face, act: true }; shotState = 2; shotT = 0; }
      else { shotT++; if (S.shard.st !== 'fly' || shotT > 40) { inp = { recall: true }; shotState = 0; wait = reactF(); } }
    } else if (S.shard.st === 'plant' && h.ground && Math.abs(h.vx) < 0.1) { inp = { recall: true }; wait = reactF(); }
    else {
      // решение: стоим ли устойчиво?
      if (h.ground && Math.abs(h.vx) < 0.1 && S.shard.st === 'hand' && h.kb <= 0) {
        const nv = navFor(S.fi), c = Math.floor(h.x), r = Math.round(h.y);
        // враг рядом: заметил → отстрел
        const en = nearEnemy();
        if (en && S.shard.st === 'hand' && rng() < aware) { h.face = en.x > h.x ? 1 : -1; shotState = 1; inp = { x: en.x > h.x ? 1 : -1 }; }
        else if (!nv.standable(c, r)) { inp = { x: (h.x - c) < 0.5 ? 1 : -1 }; }   // не на узле (край): шаг к центру
        else {
          const err = h.x - (c + 0.5);
          if (Math.abs(err) > offMax) { const n = Math.max(1, Math.round(Math.abs(err) * 14)); for (let i = 0; i < n; i++) queue.push({ x: err > 0 ? -1 : 1 }); wait = 8 + Math.floor(rng() * 8); }
          else {
            const here = nv.id(c, r);
            if (expect && expect.to !== here) bad.set(expect.from + '>' + expect.to, (bad.get(expect.from + '>' + expect.to) || 0) + 1);
            expect = null;
            const rs = nv.search(here, 3000, (n0, e0) => (bad.get(n0 + '>' + e0.to) || 0) * 400);
            if (!rs.found) { res.stuck = true; res.stuckAt = c + ',' + r; break; }
            const path = nv.pathTo(rs, 'G');
            if (!path.length) { res.stuck = true; res.why.np = 1; break; }
            expect = { from: here, to: path[0].e.to };
            if (opts.log) console.log('t', S.time.toFixed(1), 'at', c, r, 'x', h.x.toFixed(2), '->', path[0].e.to === 'G' ? 'G' : (path[0].e.to % nv.W) + ',' + ((path[0].e.to / nv.W) | 0), JSON.stringify(path[0].e.frames.slice(0, 3).map(f => f[0])), 'sh', S.shard.st); queue = expand(path[0].e); wait = reactF(); stuckT = 0;
          }
        }
      }
    }
    game.setInput(toIn(inp)); game.update(DT);
    res.t = S.time; if (opts.trace && frameN % 30 === 0 && frameN < 900) console.log(frameN, h.x.toFixed(2), h.y.toFixed(2), 'w', wait, 'q', queue.length, JSON.stringify(inp));
  }
  res.progress = res.cleared / O.LEVELS.length;
  return res;
}
