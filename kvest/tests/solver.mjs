/* МАЯЧНИЦА · tests/solver.mjs — поиск по состояниям главы (для тестов решаемости и бота).
   Состояние = флаги + инвентарь (сцена не нужна: переходы обратимы, доступность сцены считается по флагам).
   Переходы — ровно те же правила, что у движка (KVEST.logic: resolve/runRule/solveWidget/autos), кат-сцены и мини-игры
   применяются сразу (их решаемость проверяется отдельно). */
export function load(sandbox) { return sandbox.KVEST; }

export function makeSolver(K) {
  const P = K.PUZZLES, L = K.logic, SC = {}; K.SCENES.forEach(s => { SC[s.id] = s; });
  const hsWidget = {}; P.widgets.forEach(w => { if (w.scene) w.hs.forEach((h, i) => { hsWidget[w.scene + ':' + h] = { w, i }; }); });
  const key = st => Object.keys(st.flags).filter(k => st.flags[k]).sort().join(',') + '|' + st.inv.slice().sort().join(',');
  const clone = st => ({ flags: Object.assign({}, st.flags), inv: st.inv.slice() });
  function settle(st) { for (let i = 0; i < 6; i++) { const k0 = key(st); L.autos(P, st, null); if (key(st) === k0) break; } return st; }
  function scenesFrom(st, from) {
    const seen = { [from]: { prev: null, hs: null } }, q = [from];
    while (q.length) {
      const s = q.shift();
      for (const h of SC[s].hotspots) if (h.to && L.ok(st, h.need) && L.ok(st, h.toNeed) && !seen[h.to]) {
        // переход срабатывает, только если на клик без предмета нет правила (правила проверяются первыми)
        if (L.resolve(P, st, s, h.id, null)) continue;
        const wk = hsWidget[s + ':' + h.id]; if (wk && L.ok(st, wk.w.need) && !st.flags['w:' + wk.w.id]) continue;
        seen[h.to] = { prev: s, hs: h.id }; q.push(h.to);
      }
    }
    return seen;
  }
  function start() {
    const st = { flags: Object.assign({}, P.start.flags || {}), inv: (P.start.inv || []).slice() };
    for (const r of P.enter) if (r.scene === P.start.scene && L.ok(st, r.need)) { L.apply(P, st, r.do, null); if (r.puzzle) st.flags[r.puzzle] = true; }
    return settle(st);
  }
  function successors(st) {
    const out = [], k0 = key(st), seen = scenesFrom(st, P.start.scene);
    const push = (n, act) => { settle(n); if (key(n) !== k0) out.push({ st: n, act }); };
    for (const s of Object.keys(seen)) {
      // вход в сцену
      { const n = clone(st); let ch = false; for (const r of P.enter) if (r.scene === s && L.ok(n, r.need)) { L.apply(P, n, r.do, null); if (r.puzzle) n.flags[r.puzzle] = true; ch = true; } if (ch) push(n, { kind: 'enter', scene: s }); }
      for (const h of SC[s].hotspots) {
        if (!L.ok(st, h.need)) continue;
        const wk = hsWidget[s + ':' + h.id];
        if (wk && L.ok(st, wk.w.need) && !st.flags['w:' + wk.w.id]) { if (wk.i === 0) { const n = clone(st); L.solveWidget(P, n, wk.w, null); push(n, { kind: 'widget', scene: s, widget: wk.w.id }); } }
        else { const r = L.resolve(P, st, s, h.id, null); if (r) { const n = clone(st); L.runRule(P, n, r, null); push(n, { kind: 'hs', scene: s, hs: h.id }); } }
        for (const it of st.inv) { const r = L.resolve(P, st, s, h.id, it); if (r) { const n = clone(st); L.runRule(P, n, r, null); push(n, { kind: 'use', scene: s, hs: h.id, item: it }); } }
      }
    }
    for (let i = 0; i < st.inv.length; i++) for (let j = i + 1; j < st.inv.length; j++) {
      const c = L.resolveCombo(P, st, st.inv[i], st.inv[j]); if (c) { const n = clone(st); L.runRule(P, n, c, null); push(n, { kind: 'combo', a: st.inv[i], b: st.inv[j] }); }
    }
    return out;
  }
  function explore(limit = 2e6) {
    const s0 = start(), k0 = key(s0), nodes = new Map([[k0, { id: 0, st: s0, parent: -1, act: null }]]), list = [nodes.get(k0)], edges = [];
    for (let i = 0; i < list.length; i++) {
      if (list.length > limit) throw new Error('слишком много состояний');
      const nd = list[i], succ = successors(nd.st), e = [];
      for (const { st, act } of succ) {
        const k = key(st); let m = nodes.get(k);
        if (!m) { m = { id: list.length, st, parent: i, act }; nodes.set(k, m); list.push(m); }
        e.push(m.id);
      }
      edges.push(e);
    }
    const goals = list.filter(n => n.st.flags[P.goal]).map(n => n.id);
    // обратная достижимость финала
    const rev = list.map(() => []); edges.forEach((e, i) => e.forEach(j => rev[j].push(i)));
    const good = new Uint8Array(list.length), q = goals.slice(); goals.forEach(g => { good[g] = 1; });
    while (q.length) { const j = q.pop(); for (const i of rev[j]) if (!good[i]) { good[i] = 1; q.push(i); } }
    const dead = list.filter(n => !good[n.id]);
    function plan(toId) { const out = []; let n = list[toId]; while (n && n.parent >= 0) { out.push(n.act); n = list[n.parent]; } return out.reverse(); }
    let best = goals.length ? goals[0] : -1;   // BFS → первый найденный финал — кратчайший
    return { list, edges, goals, dead, start: s0, plan: best >= 0 ? plan(best) : null, planTo: plan };
  }
  return { key, start, successors, explore, scenesFrom };
}

// Поиск решения механизма/мини-игры по его локальному состоянию (BFS по ходам). → массив индексов или null.
export function solveWidget(K, w, L0, maxStates = 400000) {
  const T = K.Widgets.types[w.type];
  if (w.type === 'pipes') return T.solve(w, L0);
  if (w.type === 'melody') return w.target.slice();
  const cl = L => JSON.parse(JSON.stringify(L));
  const k0 = T.key(L0), seen = new Map([[k0, null]]), q = [[L0, k0]];
  if (T.solved(w, L0)) return [];
  for (let qi = 0; qi < q.length; qi++) {
    const [L, k] = q[qi];
    const moves = w.type === 'slider' ? T.neighbours(w, L) : T.moves(w, L);
    for (const i of moves) {
      const n = cl(L), r = T.act(w, n, i, 0); if (r && r.fail && w.type !== 'sequence') continue;
      const nk = T.key(n); if (seen.has(nk)) continue;
      seen.set(nk, [k, i]);
      if (T.solved(w, n)) { const path = []; let c = nk; while (seen.get(c)) { const [pk, mi] = seen.get(c); path.push(mi); c = pk; } return path.reverse(); }
      if (seen.size > maxStates) return null;
      q.push([n, nk]);
    }
  }
  return null;
}
// Все состояния механизма, достижимые из начального; для каждого проверяем, что решение есть (нет тупиков).
export function widgetReach(K, w, L0, maxStates = 300000) {
  const T = K.Widgets.types[w.type], cl = L => JSON.parse(JSON.stringify(L));
  const seen = new Map([[T.key(L0), L0]]), q = [L0];
  for (let qi = 0; qi < q.length && seen.size < maxStates; qi++) {
    const L = q[qi]; if (T.solved(w, L)) continue;
    const moves = w.type === 'slider' ? T.neighbours(w, L) : T.moves(w, L);
    for (const i of moves) { const n = cl(L); T.act(w, n, i, 0); const k = T.key(n); if (!seen.has(k)) { seen.set(k, n); q.push(n); } }
  }
  return [...seen.values()];
}
