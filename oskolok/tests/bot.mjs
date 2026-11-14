/* ОСКОЛОК · tests/bot.mjs — граф проходимости эпизодов и «человеческий» бот.
   Nav(O, idx): граф по НАСТОЯЩЕЙ физике игры (logic.stepHero внутри Game в режиме sim — без стражей, Теней и погони).
   Узел — клетка, на которой стоит Вера (центр клетки), плюс «ключ» изменяемого мира (карта клеток, рычаги, дрон).
   Рёбра — макро-действия: шаг на клетку, прыжки (разбег 0/4 кадра × удержание стрелки 0…40 кадров), а также
   взаимодействия, исполняемые кодом игры: рычаг, импульс, пробой, дрон к кнопке/зеркалу/кристаллу/Сердцу.
   Поиск (Дейкстра) по паре «узел + ключ» решает головоломки окружения: разбить стекло, уронить кристалл-ступень,
   повернуть зеркала, открыть двери. Бот (playScreens): реакция 150–250 мс между действиями, ошибка удержания
   ±2 кадра, разбега ±1 кадр; щит против осколков с той же реакцией; импульс по стражу на пути; дрон — на Тень;
   погоня: держит «вправо», прыжок — по «чтению сцены» (прогноз физики), вход в экран — с задержкой реакции,
   момент прыжка — с ошибкой ±3 кадра (±50 мс). */
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const DT = 1 / 60;
const KS = [0, 4, 8, 12, 18, 26, 40];

// ---------- драйверы макро-действий (общие для графа и бота) ----------
function standCell(L, M, h){   // клетка с полом под Верой, ближайшая к центру
  const r = Math.round(h.y), cs = [Math.floor(h.x), Math.floor(h.x - L.K.HW + 0.02), Math.floor(h.x + L.K.HW - 0.02)];
  let best = null, bd = 9;
  for (const c of cs){ if (!L.cellSolid(M, c, r) || L.cellSolid(M, c, r - 1) || L.cellSolid(M, c, r - 2)) continue; const d = Math.abs(c + 0.5 - h.x); if (d < bd){ bd = d; best = c; } }
  return best;
}
function steer(L, h, tx){
  const dx = tx - h.x, sd = h.vx * h.vx / (2 * L.K.FRIC) + 0.02;
  if (Math.abs(dx) < 0.04 && Math.abs(h.vx) < 0.3) return 0;
  if (Math.sign(h.vx) === Math.sign(dx) && Math.abs(dx) <= sd) return 0;
  return Math.abs(dx) > 0.04 ? Math.sign(dx) : 0;
}
// макро: { k:'walk', d } | { k:'jump', d, w, h } ; возвращает драйвер f(frame, S) → input | 'done'
export function driver(L, mac){
  let phase = 0, target = null, f0 = 0;
  return (f, S) => {
    const h = S.hero, M = S.M;
    if (phase === 0){
      if (mac.k === 'walk'){ if (target == null) target = Math.floor(h.x) + mac.d + 0.5; const x = steer(L, h, target); if (!h.ground && f > 2) { phase = 2; return { x: 0 }; } if (x === 0 && Math.abs(h.x - target) < 0.08 && h.ground) return 'done'; if (f > 90) phase = 2; return { x }; }
      // прыжок
      if (f < mac.w) return { x: mac.d };
      if (f === mac.w) return { x: mac.d, jump: true };
      if (f <= mac.w + mac.h) return { x: mac.d };
      phase = 1;
    }
    if (phase === 1){ if (!h.ground) return { x: 0 }; phase = 2; f0 = f; }
    // осесть в центр клетки
    if (phase === 2){
      if (!h.ground) return { x: 0 };
      const c = standCell(L, M, h); if (c == null) return f - f0 > 60 ? 'done' : { x: 0 };
      const x = steer(L, h, c + 0.5);
      if (x === 0 && Math.abs(h.x - (c + 0.5)) < 0.08 && Math.abs(h.vx) < 0.3) return 'done';
      if (f - f0 > 90) return 'done';
      return { x };
    }
    return 'done';
  };
}
export function macros(){
  const out = [{ k: 'walk', d: 1 }, { k: 'walk', d: -1 }, { k: 'jump', d: 0, w: 0, h: 0 }];
  for (const d of [1, -1]) for (const w of [0, 4]) for (const h of KS) out.push({ k: 'jump', d, w, h });
  return out;
}

// ---------- граф эпизода ----------
export class Nav {
  constructor(O, idx, o = {}){
    this.O = O; this.L = O.logic; this.idx = idx; this.C = this.L.COLS;
    this.g = O.Game({ sim: true, idx, have: o.have }).start(); this.S = this.g.state();
    this.startKey = this.g.key(); const st = this.S.hero; this.startNode = Math.floor(st.x) + Math.round(st.y) * this.C;
    this.noInteract = !!o.noInteract; this.cache = new Map(); this.sims = 0; this.MAC = macros(); this.pen = new Map(); this.rob = new Map();
  }
  run(key, node, face, drv, maxF = 220){
    const g = this.g, S = this.S, C = this.C; g._load(key); g._place(node % C + 0.5, Math.floor(node / C), face); this.sims++;
    let f = 0;
    for (; f < maxF; f++){
      const inp = drv(f, S); if (inp === 'done') break;
      g.setInput(inp); g.update(DT);
      if (S.phase === 'dead') return { dead: S.dieWhy };
      if (S.exited) return { exit: S.exited, t: (f + 1) * DT, key: g.key() };
    }
    g.setInput({});
    for (let i = 0; i < 120 && S.M.fall.length; i++){ g.update(DT); f++; if (S.phase === 'dead') return { dead: S.dieWhy }; }
    const h = S.hero; if (!h.ground) return null;
    const c = Math.floor(h.x), r = Math.round(h.y);
    if (Math.abs(h.x - (c + 0.5)) > 0.12) return null;
    return { to: c + r * C, t: f * DT, key: g.key() };
  }
  runMacro(key, node, mac){ return this.run(key, node, mac.d >= 0 ? 1 : -1, driver(this.L, mac)); }
  interactions(key, node){
    const L = this.L, C = this.C, out = [], g = this.g, S = this.S;
    if (this.noInteract) return out;
    g._load(key); g._place(node % C + 0.5, Math.floor(node / C), 1);
    const M = S.M, h = S.hero;
    const r0 = Math.floor(h.y - L.K.HH + 1e-6), r1 = Math.floor(h.y - 1e-6), cc = Math.floor(h.x);
    for (let r = r0; r <= r1; r++){ const t = M.t[r * C + cc]; if (t === 'L' || t === 'l') { out.push({ k: 'lever' }); break; } }
    for (const d of [1, -1]) { out.push({ k: 'pulse', d }); out.push({ k: 'breach', d }); }
    if (S.drone.have) for (let k = 0; k < M.t.length; k++) if (L.OBJ[M.t[k]]) out.push({ k: 'drone', tx: k % C + 0.5, ty: Math.floor(k / C) + 0.5 });
    return out;
  }
  runInteract(key, node, act){
    const g = this.g, S = this.S, C = this.C, K = this.L.K;
    g._load(key); g._place(node % C + 0.5, Math.floor(node / C), act.d || 1); this.sims++;
    let n = 0;
    const step = (inp) => { g.setInput(inp); g.update(DT); n++; };
    if (act.k === 'lever'){ step({ down: true }); step({}); }
    else if (act.k === 'pulse'){ step({ res: true }); step({}); }
    else if (act.k === 'breach'){ const hold = Math.ceil(K.CHARGE_T / DT) + 2; for (let i = 0; i < hold; i++) step({ charge: true }); step({}); }
    else if (act.k === 'drone'){ g.sendDrone(act.tx, act.ty); step({}); for (let i = 0; i < 300 && S.drone.st === 'fly' && !S.exited; i++) step({}); }
    for (let i = 0; i < 150 && S.M.fall.length && !S.exited; i++) step({});
    if (S.phase === 'dead') return null;
    if (S.exited) return { exit: S.exited, t: n * DT, key: g.key() };
    const k2 = g.key(); if (k2 === key) return null;
    return { to: node, t: 0.6 + n * DT, key: k2 };
  }
  standable(key, node){
    const g = this.g, S = this.S, C = this.C, L = this.L; g._load(key);
    const c = node % C, r = Math.floor(node / C);
    return L.cellSolid(S.M, c, r) && !L.cellSolid(S.M, c, r - 1) && !L.cellSolid(S.M, c, r - 2);
  }
  edges(key, node){
    const id = node + '#' + key; let e = this.cache.get(id); if (e) return e;
    e = [];
    const best = new Map();
    const add = (act, res) => {
      if (!res || res.dead) return;
      const tk = res.exit ? 'EXIT:' + res.exit : res.to + '#' + res.key;
      if (!res.exit && res.to === node && res.key === key) return;
      const c = res.t + (act.k === 'walk' || act.k === 'jump' ? 0.2 : 1.0);
      const o = best.get(tk); if (!o || c < o.c) best.set(tk, { act, to: res.to, key: res.key, exit: res.exit, c });
    };
    for (const m of this.MAC) add(m, this.runMacro(key, node, m));
    for (const a of this.interactions(key, node)) add(a, this.runInteract(key, node, a));
    e = [...best.values()]; this.cache.set(id, e); return e;
  }
  // Дейкстра от (узел, ключ) до выхода; goal(e) — какое ребро-выход годится (по умолчанию любое)
  route(node, key, goal = () => true, maxStates = 20000){
    const start = node + '#' + key, dist = new Map([[start, 0]]), prev = new Map(), heap = [[0, start, node, key]];
    let n = 0;
    while (heap.length && n < maxStates){
      let bi = 0; for (let j = 1; j < heap.length; j++) if (heap[j][0] < heap[bi][0]) bi = j;
      const [d, id, nd, k] = heap.splice(bi, 1)[0]; if (d > dist.get(id)) continue; n++;
      for (const e of this.edges(k, nd)){
        const pc = e.c + (this.pen.get(this.penKey(nd, k, e.act)) || 0);
        if (e.exit){ if (!goal(e)) continue; const steps = [{ act: e.act, from: nd, key: k, exit: e.exit }]; let v = id; while (v !== start){ const p = prev.get(v); steps.unshift(p.step); v = p.u; } return { steps, cost: d + pc, states: n }; }
        const tid = e.to + '#' + e.key, nd2 = d + pc;
        if (nd2 < (dist.has(tid) ? dist.get(tid) : Infinity)){ dist.set(tid, nd2); prev.set(tid, { u: id, step: { act: e.act, from: nd, key: k, to: e.to, toKey: e.key } }); heap.push([nd2, tid, e.to, e.key]); }
      }
    }
    return null;
  }
  penKey(node, key, act){ return node + '#' + key.length + ':' + JSON.stringify(act) + key.slice(-3) + hash(key); }
  // устойчивость прыжка к ошибкам человека: удержание ±2 кадра, разбег ±1 — тот же результат
  robust(step){
    const a = step.act; if (a.k !== 'jump') return true;
    const ck = step.from + '#' + step.key + JSON.stringify(a); if (this.rob.has(ck)) return this.rob.get(ck);
    const v = this._robust(step); this.rob.set(ck, v); return v;
  }
  _robust(step){
    const a = step.act;
    const ref = this.runMacro(step.key, step.from, a); if (!ref || ref.dead) return false;
    for (const [dw, dh] of [[0, -2], [0, 2], [1, 0], [-1, 0]]){
      const m = { k: 'jump', d: a.d, w: Math.max(0, a.w + dw), h: Math.max(0, a.h + dh) };
      const r = this.runMacro(step.key, step.from, m);
      if (!r || r.dead) return false;
      if (!ref.exit && (r.exit ? false : r.to !== ref.to)) return false;   // к выходу — лишь бы не гибель
    }
    return true;
  }
  robustRoute(node, key, goal){
    for (let it = 0; it < 12; it++){
      const p = this.route(node, key, goal); if (!p) return null;
      let bad = 0;
      for (const s of p.steps) if (!this.robust(s)){ this.pen.set(this.penKey(s.from, s.key, s.act), 4); bad++; }
      if (!bad) return p;
    }
    return this.route(node, key, goal);
  }
}
function hash(s){ let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

const NAVS = new Map();
export function navFor(O, idx, have){ const k = idx + ':' + have; if (!NAVS.has(k)) NAVS.set(k, new Nav(O, idx, { have })); return NAVS.get(k); }

// ---------- погоня: «держать вправо, прыгать по чтению сцены» ----------
function cloneH(h){ return Object.assign({}, h); }
function predict(L, M, h0, jumpAt, maxF){
  const h = cloneH(h0); let took = false, landedAt = -1;
  for (let f = 0; f < maxF; f++){
    L.stepHero(h, { x: 1, jump: f === jumpAt }, M, DT);
    if (L.hazard(h, M)) return { dead: true };
    if (f >= jumpAt && jumpAt >= 0 && !h.ground) took = true;
    if (took && h.ground && landedAt < 0) landedAt = f;
    if (landedAt >= 0 && f > landedAt + 6) return { x: h.x, f, ground: true };
  }
  return { x: h.x, f: maxF, ground: h.ground };
}
export function chaseDecide(L, M, h){
  const K = L.K;
  // без прыжка: 0,45 с бега и до приземления
  const nj = predictNoJump(L, M, h);
  if (nj.ok) return null;
  const ok = [];
  for (let d = 0; d <= 36; d++){
    const r = predict(L, M, h, d, d + 80);
    ok.push(!r.dead && r.ground && r.x - h.x >= (r.f / 60) * K.RUN * 0.55);
  }
  let a = ok.indexOf(true); if (a < 0) return 0;
  let b = a; while (b + 1 < ok.length && ok[b + 1]) b++;
  return Math.round((a + b) / 2);
}
function predictNoJump(L, M, h0){
  const h = cloneH(h0), K = L.K;
  for (let f = 0; f < 90; f++){
    L.stepHero(h, { x: 1, jump: false }, M, DT);
    if (L.hazard(h, M)) return { ok: false };
    if (f >= 26 && h.ground) return { ok: h.x - h0.x >= (f / 60) * K.RUN * 0.6 };
  }
  return { ok: false };
}

// ---------- бот: проходит экраны idx0..idx1 в настоящей игре ----------
export function playScreens(O, seed, o = {}){
  const L = O.logic, K = L.K, C = L.COLS, rnd = mulberry32(seed * 7919 + 13);
  const react = () => (o.react || [0.15, 0.25])[0] + rnd() * ((o.react || [0.15, 0.25])[1] - (o.react || [0.15, 0.25])[0]);
  const from = o.from || 0, to = o.to != null ? o.to : from;
  const game = O.Game({ idx: from, rng: mulberry32(seed), have: o.have, noCut: false, onEvent: o.onEvent }).start(), S = game.state();
  const res = { seed, won: false, deaths: 0, why: {}, time: 0, screens: 0, stuck: false };
  let curIdx = -1, act = null, drv = null, f = 0, wait = 0, threatSeen = -1, shieldOn = false, clearT = 0, jumpAt = -1, frame = 0, lastProg = 0, lastNode = -1, planFails = 0;
  let deathsHere = 0;
  const maxF = Math.round((o.maxT || 400) * 60);
  for (frame = 0; frame < maxF; frame++){
    const t = frame * DT;
    if (S.phase === 'won'){ res.won = true; break; }
    if (S.phase === 'cut'){ game.setInput({}); if (S.cut.t > 0.35) game.skip(); game.update(DT); continue; }
    if (S.phase === 'dead'){ if (!res._dead){ res._dead = 1; res.deaths++; res.why[S.dieWhy] = (res.why[S.dieWhy] || 0) + 1; deathsHere++; } game.setInput({}); game.update(DT); act = null; continue; }
    res._dead = 0;
    if (S.idx !== curIdx){
      if (S.idx > to || S.idx < curIdx){ res.won = true; break; }
      if (curIdx >= 0 && S.idx > curIdx) res.screens++;
      curIdx = S.idx; act = null; wait = react(); jumpAt = -1; deathsHere = 0; lastProg = t;
    }
    if (S.screenT < 0.02){ act = null; wait = Math.max(wait, react()); jumpAt = -1; shieldOn = false; threatSeen = -1; }
    if (t - lastProg > 60){ res.stuck = true; break; }
    const h = S.hero;
    let inp = {};
    if (S.def.chase){
      // погоня
      if (wait > 0){ wait -= DT; inp = { x: h.vx > 1 ? 1 : 0 }; }
      else {
        inp = { x: 1 };
        if (jumpAt >= 0){ if (frame >= jumpAt){ inp.jump = true; jumpAt = -1; } }
        else if (h.ground){ const d = chaseDecide(L, S.M, h); if (d != null){ const n = Math.round((rnd() * 2 - 1) * 3); jumpAt = frame + Math.max(0, d + n); if (jumpAt === frame){ inp.jump = true; jumpAt = -1; } } }
      }
      lastProg = t;
      if (S.chase && S.chase.t > S.chase.delay) res.minGap = Math.min(res.minGap == null ? 99 : res.minGap, h.x - S.chase.x);
      game.setInput(inp); game.update(DT); continue;
    }
    // угрозы: Стеклодув на замахе / летящий осколок → щит (с реакцией)
    const threat = threatOf(L, S);
    if (threat){ if (threatSeen < 0) threatSeen = t; clearT = 0; }
    else if (threatSeen >= 0){ clearT += DT; if (clearT > 0.2){ threatSeen = -1; shieldOn = false; } }
    if (threatSeen >= 0 && t - threatSeen >= reactFor(seed, threatSeen, o)){
      act = null; shieldOn = true;
      const face = threat ? Math.sign(threat.x - h.x) || h.face : h.face;
      inp = { res: true, x: face !== h.face ? face : 0 };
      game.setInput(inp); game.update(DT); wait = react(); continue;
    }
    if (act){
      const r = drv(f++, S);
      if (r === 'done'){ act = null; wait = react(); inp = {}; }
      else inp = r;
      game.setInput(inp); game.update(DT); continue;
    }
    if (wait > 0){ wait -= DT; game.setInput({}); game.update(DT); continue; }
    // план
    const node = Math.floor(h.x) + Math.round(h.y) * C;
    if (!h.ground || Math.abs(h.x - (Math.floor(h.x) + 0.5)) > 0.12){ act = { k: 'settle' }; drv = driver(L, { k: 'jump', d: 0, w: 0, h: 0 }); drv = settleDriver(L); f = 0; game.setInput({}); game.update(DT); continue; }
    const nav = navFor(O, S.idx, S.entryHave);
    const key = game.key();
    const goal = o.ending ? (e => e.exit === o.ending || e.exit === 'X') : (() => true);
    const plan = nav.robustRoute(node, key, goal);
    if (!plan){ planFails++; if (planFails > 3){ game.restartScreen(); planFails = 0; } wait = 0.5; game.setInput({}); game.update(DT); continue; }
    planFails = 0;
    const step = plan.steps[0], a = step.act;
    if (node !== lastNode){ lastNode = node; lastProg = t; }
    // враги у места приземления (спрыгнуть к стражу — ждать, пока он отойдёт; к Тени — сперва дрон)
    if (step.to != null && (a.k === 'walk' || a.k === 'jump')){
      const lx = step.to % C + 0.5, ly = Math.floor(step.to / C);
      const gd = S.guards.find(e => e.alive && e.st !== 'stun' && Math.abs(e.y - ly) < 1.5 && Math.abs(e.y - h.y) >= 1.5 && (Math.abs(e.x - lx) < 3.5 || Math.sign(lx - e.x) === e.face && Math.abs(e.x - lx) < 5));
      if (gd){ wait = 0.15; game.setInput({}); game.update(DT); continue; }
      const lu = S.lurkers.find(e => e.alive && e.st !== 'burn' && e.st !== 'stun' && Math.abs(e.y - ly) < 1.5 && Math.abs(e.x - lx) < 4.5);
      if (lu){ if (S.drone.st === 'follow' || S.drone.st === 'ret') game.sendDrone(lu.x, lu.y - 1); wait = react(); game.setInput({}); game.update(DT); continue; }
    }
    // враги на пути
    const blk = blocker(L, S, a);
    if (blk){
      if (blk.kind === 'guard' && Math.abs(blk.e.x - h.x) < K.PULSE_R - 0.4 && blk.e.st !== 'stun'){ if (Math.sign(blk.e.x - h.x) !== h.face){ game.setInput({ x: Math.sign(blk.e.x - h.x) }); game.update(DT); game.setInput({}); game.update(DT); } act = { k: 'pulse' }; drv = tapDriver({ res: true }); f = 0; continue; }
      if (blk.kind === 'lurker' && S.drone.st === 'follow'){ game.sendDrone(blk.e.x, blk.e.y - 1); wait = react(); continue; }
      wait = 0.2; game.setInput({}); game.update(DT); continue;
    }
    act = a; f = 0;
    if (a.k === 'walk' || a.k === 'jump'){
      const m = a.k === 'jump' ? { k: 'jump', d: a.d, w: Math.max(0, a.w + Math.round((rnd() * 2 - 1))), h: Math.max(0, a.h + Math.round((rnd() * 2 - 1) * 2)) } : a;
      drv = driver(L, m);
    } else if (a.k === 'lever') drv = tapDriver({ down: true });
    else if (a.k === 'pulse') drv = faceThen(a.d, tapDriver({ res: true }));
    else if (a.k === 'breach') drv = faceThen(a.d, holdDriver({ charge: true }, Math.ceil(K.CHARGE_T / DT) + 4));
    else if (a.k === 'drone'){ game.sendDrone(a.tx, a.ty); drv = waitDriver(() => S.drone.st !== 'fly' && !S.M.fall.length, 300); }
    game.setInput({}); game.update(DT);
  }
  res.time = frame * DT; res.deathsAll = res.deaths; delete res._dead;
  return res;
}
function reactFor(seed, t0, o){ const r = mulberry32((seed * 131 + Math.round(t0 * 600)) | 0)(); const R = o.react || [0.15, 0.25]; return R[0] + r * (R[1] - R[0]); }
function shardPath(L, S, x0, x1, y){   // осколок долетит: на ряду нет твёрдых клеток (стекло тоже держит)
  const r = Math.floor(y), a = Math.floor(Math.min(x0, x1)), b = Math.floor(Math.max(x0, x1));
  for (let c = a + 1; c < b; c++) if (L.cellSolid(S.M, c, r)) return false;
  return true;
}
function threatOf(L, S){
  const h = S.hero, K = L.K;
  for (const s of S.shards){ if (s.fr) continue; const dx = h.x - s.x; if (Math.sign(dx) === Math.sign(s.vx) && Math.abs(dx) < 8 && s.y > h.y - K.HH - 0.3 && s.y < h.y + 0.3 && shardPath(L, S, s.x, h.x, s.y)) return { x: s.x }; }
  for (const g of S.guards){ if (g.alive && (g.st === 'wind') && Math.abs(g.y - h.y) < 1.2 && Math.abs(g.x - h.x) <= K.G_VIEW + 0.5 && Math.sign(h.x - g.x) === g.face && shardPath(L, S, g.x, h.x, g.y - 1.15)) return { x: g.x }; }
  return null;
}
function blocker(L, S, a){
  const h = S.hero, d = a.d || 0; if (a.k !== 'walk' && a.k !== 'jump') return null;
  for (const g of S.guards){ if (!g.alive || g.st === 'stun') continue; const dx = g.x - h.x; if (Math.abs(g.y - h.y) < 1.5 && Math.abs(dx) < 4.5 && (d === 0 || Math.sign(dx) === d)) return { kind: 'guard', e: g }; }
  for (const l of S.lurkers){ if (!l.alive || l.st === 'burn' || l.st === 'stun') continue; const dx = l.x - h.x; if (Math.abs(l.y - h.y) < 1.5 && Math.abs(dx) < 7 && (d === 0 || Math.sign(dx) === d)) return { kind: 'lurker', e: l }; }
  return null;
}
function tapDriver(i){ return (f) => f === 0 ? i : f < 4 ? {} : 'done'; }
function holdDriver(i, n){ return (f) => f < n ? i : f < n + 3 ? {} : 'done'; }
function waitDriver(cond, n){ return (f) => (f > 2 && cond()) || f > n ? 'done' : {}; }
function faceThen(d, next){ let off = -1; return (f, S) => { if (off < 0){ if (S.hero.face !== d){ off = 1; return { x: d }; } off = 0; } return next(f - off, S); }; }
function settleDriver(L){ return driver(L, { k: 'jump', d: 0, w: -5, h: -5 }); }
