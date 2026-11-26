/* ПОСОХ · tests/bot.mjs — граф проходимости экспедиции по настоящей физике (logic.heroStep, logic.stakeRay) и «человеческий» бот.
   navFor(PS, LV) — узлы «стою здесь» (столбец + ряд опоры; шипы — не опора) и узлы-ВЕХИ: свободная клетка у мягкой породы,
   где может торчать воткнутая веха (стоять на ней можно, только если её туда вбили). Рёбра — симуляция макро-действий:
   шаг, прыжок с разбегом 0/8/20/40 кадров и удержанием 5/30 (с рулёжкой и торможением), прыжок на месте; рёбра-БРОСКИ:
   с узла бросить веху (вперёд / вверх, лицом влево / вправо) — где она воткнулась, туда и прыжок (в мире есть веха, на которой
   стоим, и новая — не больше трёх). Решётка стража, ворота арены и треснувшие камни считаются открытыми, но ребро помечается
   (gate / crack), если тело прошло через такую клетку. Реперы и треснувшие камни: с каких узлов в них попадает бросок.
   playExp(PS, id, seed, opts) — бот играет как человек: реакция 150–250 мс, разброс моментов нажатий, иногда не замечает
   врага; идёт к арене по графу (тайники — нет), врагов, стража и хозяина сбивает вехами издали. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const DT = 1 / 60;

export function actionsList(){
  const A = [];
  for (const d of [1, -1]){
    A.push({ d, walk: 6 }); A.push({ d, walk: 18 });
    for (const run of [0, 8, 20, 40]) for (const hold of [5, 30]) { A.push({ d, run, hold, steer: d }); A.push({ d, run, hold, steer: d, brake: true }); }
    A.push({ d, run: 0, hold: 30, steer: 0 });
    A.push({ d, run: 0, hold: 30, steer: d, late: 10 });   // прыжок вверх, рулёжка позже (на веху над головой и вбок)
  }
  A.push({ d: 0, run: 0, hold: 30, steer: 0 });
  return A;
}
// вход действия A в кадре f; st — состояние исполнения ({ air })
export function actInput(A, f, P, st){
  let dx = 0, jump = false;
  if (A.walk != null){ if (f < A.walk) dx = A.d; return { dx, jump }; }
  if (f < A.run) dx = A.d;
  else {
    if (f < A.run + A.hold) jump = true;
    if (!P.ground) st.air = true;
    if (!st.air || !P.ground) dx = f < A.run ? A.d : (A.late && f < A.run + A.late ? 0 : A.steer);
    if (st.air && P.ground) dx = A.brake && Math.abs(P.vx) > 20 ? (P.vx > 0 ? -1 : 1) : 0;
  }
  return { dx, jump };
}

export function navFor(PS, LV){
  const L = PS.logic, T = L.T, K = L.K;
  const orig = L.grid(LV), g = L.grid(LV);
  for (const row of g) for (let x = 0; x < row.length; x++) if ('cXa'.includes(row[x])) row[x] = '.';
  const W = { LV, g }, WO = { LV, g: orig };
  const nodes = [], at = new Map();
  const free = (ch) => !L.isSolid(ch) && ch !== '~';
  for (let c = 0; c < LV.w; c++) for (let r = 2; r < LV.h; r++){
    const ch = L.tileAt(W, c, r);
    let peg = false;
    if (ch === '.' && (L.tileAt(W, c - 1, r) === '=' || L.tileAt(W, c + 1, r) === '=')) peg = true;
    else if (!(L.isSolid(ch) || L.isTop(ch)) || ch === '^') continue;
    if (!free(L.tileAt(W, c, r - 1)) || !free(L.tileAt(W, c, r - 2))) continue;
    const n = { id: nodes.length, c, r, x: c * T + 8, y: r * T, peg };
    nodes.push(n); at.set(c + ',' + r, n);
  }
  const nodeAt = (x, y) => at.get(Math.floor(x / T) + ',' + Math.round(y / T)) || null;
  const itemBox = (P, it) => { const cx = it.tx * T + 8, cy = it.ty * T + 8; return Math.abs(cx - P.x) < K.HW + 6 && cy + 6 > P.y - K.HH && cy - 6 < P.y; };
  function marks(P, m){
    for (let x = P.x - K.HW + 0.5; x <= P.x + K.HW; x += K.HW * 2 - 1) for (let y = P.y - K.HH + 0.5; y < P.y; y += 7){
      const ch = orig[Math.floor(y / T)] && orig[Math.floor(y / T)][Math.floor(x / T)];
      if (ch === 'X') m.gate = true; else if (ch === 'c') m.crack = true; else if (ch === 'a') m.arena = true;
    }
  }
  // мир с вехами в клетках list ([[c,r]…]); снять — undo()
  function withPegs(Wx, list){ const old = list.map(([c, r]) => Wx.g[r][c]); list.forEach(([c, r]) => { Wx.g[r][c] = '|'; }); return () => list.forEach(([c, r], i) => { Wx.g[r][c] = old[i]; }); }
  const ACTS = actionsList();
  const edges = nodes.map(() => []);
  function sim(n, A, okTo){
    const P = L.newHero(n.x, n.y);
    const st = { air: false }, items = new Set(), m = {};
    let bad = false, moved = false;
    const ev = (t) => { if (t === 'spike' || t === 'fall' || t === 'drown') bad = true; };
    for (let f = 0; f < 480; f++){
      const inp = actInput(A, f, P, st);
      L.heroStep(W, P, inp, DT, ev);
      if (bad) return null;
      for (const it of LV.items) if (itemBox(P, it)) items.add(it.id);
      marks(P, m);
      if (Math.abs(P.x - n.x) > 2 || Math.abs(P.y - n.y) > 2) moved = true;
      if (!inp.dx && !inp.jump && P.ground && Math.abs(P.vx) < 1.5 && f > 3){
        if (!moved) return null;
        const to = nodeAt(P.x, P.y); if (!to || to === n || !okTo(to)) return null;
        return { to: to.id, f, items, m };
      }
    }
    return null;
  }
  // броски с узла n (в мире есть веха под ногами, если n — веха): face ±1, up 0/1
  const THROWS = [[1, 0], [1, 1], [-1, 0], [-1, 1]];
  function rayFrom(Wx, n, face, up){ const P = L.newHero(n.x, n.y); P.face = face; return L.stakeRay(Wx, P, up); }
  const markFrom = new Map(), crackFrom = new Map();   // 'tx,ty' → [node ids]
  for (const n of nodes){
    const base = n.peg ? [[n.c, n.r]] : [];
    let undo = withPegs(W, base);
    const seen = new Map();
    const keep = (r, ai, extra) => {
      const items = [...r.items].sort((x, y) => x - y), fl = (r.m.gate ? 'g' : '') + (r.m.crack ? 'c' : '');
      const key = r.to + '|' + items.join(',') + '|' + fl + '|' + (extra ? 't' : '');
      const prev = seen.get(key);
      if (!prev || r.f < prev.f) seen.set(key, Object.assign({ to: r.to, f: r.f, a: ai, items, gate: !!r.m.gate, crack: !!r.m.crack, arena: !!r.m.arena }, extra || {}));
    };
    ACTS.forEach((A, ai) => { const r = sim(n, A, to => !to.peg); if (r) keep(r, ai); });
    for (const [face, up] of THROWS){
      const r = rayFrom(W, n, face, up);
      if (r.k !== 'peg' || (r.tx === n.c && r.ty === n.r)) continue;
      const C = at.get(r.tx + ',' + r.ty); if (!C) continue;
      const u2 = withPegs(W, [[r.tx, r.ty]]);
      ACTS.forEach((A, ai) => { const s = sim(n, A, to => to === C); if (s) keep(s, ai, { throwF: face, up, peg: [r.tx, r.ty] }); });
      u2();
    }
    undo();
    // реперы и треснувшие камни — по настоящему миру (камни целы)
    undo = withPegs(WO, base);
    for (const [face, up] of THROWS){
      const r = rayFrom(WO, n, face, up), key = r.tx + ',' + r.ty;
      if (r.k === 'mark'){ if (!markFrom.has(key)) markFrom.set(key, []); markFrom.get(key).push(n.id); }
      if (r.k === 'crack'){ if (!crackFrom.has(key)) crackFrom.set(key, []); crackFrom.get(key).push(n.id); }
    }
    undo();
    for (const e of seen.values()) edges[n.id].push(e);
  }
  const start = nodeAt(LV.start.tx * T + 8, (LV.start.ty + 1) * T);
  const standItems = nodes.map(n => { const P = L.newHero(n.x, n.y); return LV.items.filter(it => itemBox(P, it)).map(it => it.id); });
  function reachFrom(from, ok){ const seen = new Set([from.id]), q = [from.id]; while (q.length){ const u = q.shift(); for (const e of edges[u]) if (ok(e) && !seen.has(e.to)){ seen.add(e.to); q.push(e.to); } } return seen; }
  function itemsReach(ok){
    const R = reachFrom(start, ok), got = new Set();
    for (const u of R){ standItems[u].forEach(i => got.add(i)); for (const e of edges[u]) if (ok(e) && R.has(e.to)) e.items.forEach(i => got.add(i)); }
    return { R, got };
  }
  return { nodes, edges, ACTS, start, nodeAt, standItems, reachFrom, itemsReach, markFrom, crackFrom, orig, W };
}

// сводка проходимости экспедиции
export function passability(PS, LV, nav){
  nav = nav || navFor(PS, LV);
  const all = nav.itemsReach(() => true), noGate = nav.itemsReach(e => !e.gate), noPeg = nav.itemsReach(e => !e.throwF);
  const guardOk = [...noGate.R].some(u => { const n = nav.nodes[u]; return Math.abs(n.c - LV.guardAt.tx) <= 6 && n.r === LV.guardAt.ty + 1; });
  const arenaNodes = nav.nodes.filter(n => n.c > LV.arenaX + 3 && n.r === LV.bossAt.ty + 1);
  const bossOk = arenaNodes.some(n => all.R.has(n.id));
  const bossNoPeg = arenaNodes.some(n => noPeg.R.has(n.id));
  const marksOk = LV.marks.filter(m => (nav.markFrom.get(m.tx + ',' + m.ty) || []).some(u => all.R.has(u)));
  const marksNoPeg = LV.marks.filter(m => (nav.markFrom.get(m.tx + ',' + m.ty) || []).some(u => noPeg.R.has(u)));
  const gems = LV.items.filter(i => i.k === 'gem' || i.k === 'big');
  return { nav, all, noGate, noPeg, guardOk, bossOk, bossNoPeg, marksOk, marksNoPeg,
    itemsOk: LV.items.filter(i => all.got.has(i.id)).length, items: LV.items.length,
    gemsOk: gems.filter(i => all.got.has(i.id)).length, gemsNoPeg: gems.filter(i => noPeg.got.has(i.id)).length, gems: gems.length,
    missing: LV.items.filter(i => !all.got.has(i.id)) };
}

// ---------------- «человеческий» бот ----------------
export function playExp(PS, id, seed, opts = {}){
  const L = PS.logic, T = L.T, K = L.K;
  const rnd = mulberry32(seed * 7919 + 13);
  const react = opts.react || [0.15, 0.25], timing = opts.timing == null ? 1.5 : opts.timing, miss = opts.miss == null ? 0.1 : opts.miss;
  const ev = [];
  const game = PS.Game({ rng: mulberry32(seed), god: !!opts.god, onEvent: (t) => { ev.push(t); } });
  game.start(id, { lives: opts.lives || 3 });
  const S = game.state(), LV = S.LV;
  const nav = opts.nav || navFor(PS, LV);
  const maxT = opts.maxT || 300;
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 0.9; };
  const fails = new Map(), fk = (u, e) => u + ':' + e.a + ':' + e.to + ':' + (e.throwF || 0) + (e.up || 0), pen = (u, e) => (fails.get(fk(u, e)) || 0) * 300;
  let frame = 0;
  let up = false;
  function tick(dx, jump, thr){ game.setInput(dx, up, jump); if (thr) game.throwStake(); game.update(DT); frame++; }
  function idle(n){ for (let i = 0; i < n; i++) tick(0, false); }
  function curNode(){ const P = S.hero; const n = nav.nodeAt(P.x, P.y); if (n && n.peg && L.tileAt(S.W, n.c, n.r) !== '|') return null; return n; }
  function route(from){
    const gateOpen = !S.guard.alive;
    const ok = e => !e.crack && (gateOpen || !e.gate);
    const dist = new Map([[from.id, 0]]), prev = new Map(), done = new Set(), pq = [[0, from.id]];
    while (pq.length){
      pq.sort((a, b) => a[0] - b[0]); const [d, u] = pq.shift(); if (done.has(u)) continue; done.add(u);
      for (const e of nav.edges[u]){ if (!ok(e)) continue; const nd = d + e.f + 20 + pen(u, e) + (e.throwF ? 40 : 0); if (nd < (dist.get(e.to) ?? 1e9)){ dist.set(e.to, nd); prev.set(e.to, { u, e }); pq.push([nd, e.to]); } }
    }
    let best = null; for (const [v] of dist){ const n = nav.nodes[v]; if (n.peg) continue; if (!best || n.c > best.c || (n.c === best.c && n.r > best.r)) best = n; }
    if (!best || best.id === from.id) return null;
    const p = []; let v = best.id; while (v !== from.id){ const s = prev.get(v); p.unshift(s.e); v = s.u; }
    return p;
  }
  let exec = null, wait = 0, enemyCd = 0, stuck = 0, fightT = 0;
  function startExec(e){
    const A = Object.assign({}, nav.ACTS[e.a]);
    if (A.run != null) A.run = Math.max(0, A.run + Math.round(gauss() * timing));
    if (A.hold != null) A.hold = Math.max(3, A.hold + Math.round(gauss() * timing));
    exec = { A, f: 0, st: { air: false }, to: e.to, e, from: curNode() };
  }
  function failEdge(){ if (exec && exec.from){ const key = fk(exec.from.id, exec.e); fails.set(key, (fails.get(key) || 0) + 1); } exec = null; }
  // бросок вехи: повернуться лицом, отдышаться, бросить, дождаться конца полёта
  function throwAt(face, u){
    const P = S.hero;
    if (P.face !== face){ tick(face, false); idle(6); }
    up = !!u; tick(0, false, true); up = false;
    for (let i = 0; i < 120 && S.darts.length && S.phase === 'play'; i++) tick(0, false);
  }
  function foe(){
    const P = S.hero;
    for (const b of [S.boss, S.guard]) if (b && b.alive && b.awake && Math.abs(b.x - P.x) < 16 * T) return b;
    return null;
  }
  for (; frame < maxT * 60;){
    const P = S.hero;
    if (S.phase === 'clear') return res(true);
    if (S.phase === 'over') return res(false);
    if (S.phase !== 'play'){ tick(0, false); exec = null; wait = 0; continue; }
    if (enemyCd > 0) enemyCd -= DT;
    if (S.sign && !S.signGot){ const d = S.sign.x - P.x; tick(Math.abs(d) > 4 ? Math.sign(d) : 0, false); continue; }
    // бой: держать дистанцию, бить вехами, когда цель на линии броска (вперёд или под 45°)
    const B = foe();
    if (B){
      exec = null; fightT += DT;
      const dx0 = B.x - P.x, adx = Math.abs(dx0), face = Math.sign(dx0) || 1;
      const y0 = P.y - K.STAKE_DY, bc = B.y - B.h / 2;
      const flat = Math.abs(bc - y0) < B.h / 2 + 2, diag = Math.abs((y0 - bc) - (adx - 4)) < B.h / 2 + 4 && y0 > bc;
      const shot = S.shots.find(s => Math.abs(s.x - P.x) < 3 * T && Math.sign(P.x - s.x) === Math.sign(s.vx) && s.y > P.y - K.HH - 4);
      const rushing = Math.sign(B.vx) === Math.sign(P.x - B.x) && Math.abs(B.vx) > 60 && adx < 6 * T;
      if (B.def && B.def.fly && (B.st === 'hover' || B.st === 'rise')){
        // летун парит: встать так, чтобы он оказался на линии броска под 45°, и бить вверх
        const want = (y0 - bc) + 4, err = adx - want;
        if (Math.abs(err) > 8){ tick(err > 0 ? face : -face, false); continue; }
        if (P.ground && S.cool <= 0 && !S.darts.length){ if (P.face !== face){ tick(face, false); continue; } idle(3); up = true; tick(0, false, true); up = false; continue; }
        tick(0, false); continue;
      }
      if (B.def && B.def.fly && B.st === 'dive' && adx < 4 * T){ tick(-face, false); continue; }
      if (P.ground && (shot || rushing)){ tick(-face, true); continue; }
      if (adx < 3.2 * T){ const away = -face, wallNear = L.isSolid(L.tileAt(S.W, Math.floor((P.x + away * 24) / T), Math.floor((P.y - 4) / T))); tick(wallNear ? face : away, wallNear && P.ground); continue; }
      if (adx > 8 * T && !(B.def && B.def.fly)){ tick(face, false); continue; }
      if (P.ground && S.cool <= 0 && !S.darts.length && (flat || diag)){
        const rt = Math.round((react[0] + rnd() * (react[1] - react[0])) * 30);
        if (P.face !== face){ tick(face, false); continue; }
        idle(Math.min(4, rt)); up = !flat && diag; tick(0, false, true); up = false; continue;
      }
      tick(B.def && B.def.fly ? (adx > 5 * T ? face : 0) : 0, false); continue;
    }
    // мелкие враги: заметил → реакция → веха
    if (!exec && P.ground && enemyCd <= 0 && !S.darts.length){
      const y0 = P.y - K.STAKE_DY;
      const e = S.enemies.find(e => e.alive && Math.abs(e.x - P.x) < 7 * T && Math.abs(e.x - P.x) > 10 && ((Math.abs((e.y - e.h / 2) - y0) < e.h / 2 + 3) || Math.abs((y0 - (e.y - e.h / 2)) - Math.abs(e.x - P.x)) < 8));
      if (e){
        enemyCd = 0.7;
        if (rnd() > miss){
          idle(Math.round((react[0] + rnd() * (react[1] - react[0])) * 60));
          if (e.alive) throwAt(Math.sign(e.x - P.x) || 1, Math.abs((e.y - e.h / 2) - y0) >= e.h / 2 + 3);
          continue;
        }
      }
    }
    if (exec){
      const inp = actInput(exec.A, exec.f, P, exec.st);
      exec.f++; tick(inp.dx, inp.jump);
      if ((!inp.dx && !inp.jump && P.ground && Math.abs(P.vx) < 1.5 && exec.f > 3) || exec.f > 480){
        const n = curNode();
        if (!n || n.id !== exec.to) failEdge(); else exec = null;
      }
      continue;
    }
    if (wait > 0){ wait -= DT; tick(0, false); continue; }
    if (!P.ground || Math.abs(P.vx) > 1.5){ tick(0, false); continue; }
    const n = curNode();
    if (!n){ tick(rnd() < 0.5 ? 1 : -1, false); continue; }
    if (Math.abs(P.x - n.x) > 2){ tick(P.x < n.x ? 1 : -1, false); tick(0, false); continue; }
    const steps = route(n);
    if (!steps || !steps.length){ stuck++; if (stuck > 600) return res(false, true); tick(0, false); continue; }
    const e0 = steps[0];
    const rt = react[0] + rnd() * (react[1] - react[0]);
    idle(Math.round(rt * 60));
    if (e0.throwF){
      throwAt(e0.throwF, e0.up);
      if (L.tileAt(S.W, e0.peg[0], e0.peg[1]) !== '|'){ fails.set(fk(n.id, e0), (fails.get(fk(n.id, e0)) || 0) + 1); continue; }
      idle(4);
    }
    startExec(e0); exec.from = n;
  }
  return res(false, true);
  function res(won, timeout){ return { won, seed, id, score: S.score, deaths: S.deaths, lives: S.lives, hurts: S.hurts, kills: S.kills, throws: S.throws, marks: Object.keys(S.marks).length, time: frame / 60, stuck: !!timeout && !won, ev }; }
}
