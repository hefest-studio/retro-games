/* МАЯЧНИЦА · tests/solver.mjs — поиск по состояниям главы (для тестов решаемости и бота).
   Состояние = флаги + инвентарь (сцена не нужна: переходы обратимы, доступность сцены считается по флагам).
   Переходы — ровно те же правила, что у движка (KVEST.logic: resolve/runRule/solveWidget/autos), кат-сцены и мини-игры
   применяются сразу (их решаемость проверяется отдельно). Глава — makeSolver(K, chapter) (по умолчанию K.SCENES/K.PUZZLES):
   зоны сцены — с учётом её фазы (прилив/отлив) и открытых узлов карты (KVEST.logic.hotspots); таймеры главы (puzzles.timers) —
   ещё один переход «подождать» (флаг таймера меняется). Положение героини не входит в состояние — поэтому отдельная проверка
   positionSafe: из любой достижимой сцены можно вернуться к старту (сейчас или после смены флага таймера, если сцена в его where).
   Помощники (helpers.js): действие в сцене может сделать любой свободный герой, которого сцена пускает (правила с hero), — переходы
   помечены act.hero; удержание — переход 'hold' (флаги held:/by: входят в состояние), отпустить — переход 'release' (если сцена
   удержания достижима до и после). Свободные герои ходят отрядом, поэтому их положение не нужно; выход проходим, если его может
   пройти хотя бы один свободный герой (его пускают обе сцены и на клик им по выходу нет правила/удержания).
   Под водой (water.js): воздух в состояние НЕ входит (перебор не растёт) — это ограничение длины пути между воздушными карманами:
   достижимость сцен считает KVEST.Water.reach (с каким запасом воздуха героиня входит в подводную сцену; карман даёт полный запас),
   зона подводной сцены доступна, только если до неё хватает воздуха (hsOk). Зоны в мутной воде с полем guide активны, пока звучит
   их колокол (KVEST.logic.hotspots). positionSafe: из КАЖДОГО активного кармана подводной сцены можно вернуться к старту главы
   (мягкий возврат приводит героиню в последний карман — значит, застрять можно только в нём). */
export function load(sandbox) { return sandbox.KVEST; }

export function makeSolver(K, ch) {
  const P = ch ? ch.puzzles : K.PUZZLES, L = K.logic, SC = {}, SCN = ch ? L.withMap(ch.scenes, ch.map) : K.SCENES; SCN.forEach(s => { SC[s.id] = s; });
  const TIMERS = P.timers || [];
  const HL = K.Helpers || null, MULTI = !!(HL && HL.multi(P)), HEROES = MULTI ? HL.list(P) : ['taya'];
  const as = (st, h) => ({ flags: st.flags, inv: st.inv, hero: h });
  // кто может действовать в сцене s: свободный и пущенный сценой (держащий действует, только отпустив — переход release)
  const actors = (st, s) => MULTI ? HEROES.filter(h => HL.free(P, st, h) && HL.allowed(SC[s], h, P)) : ['taya'];
  const WA = K.Water || null, AIR = !!(WA && WA.conf(P)), wet = s => AIR && WA.isWater(SC[s]);
  const standX = (s, st, h) => L.clampX(L.walkOf(SC[s], st), h.at != null ? h.at : h.rect[0] + h.rect[2] / 2);
  function blocks(st, s, h, hero) {   // на клик героя по зоне сработает не выход, а правило/удержание/механизм
    const sh = as(st, hero); if (L.resolve(P, sh, s, h.id, null)) return true;
    if (MULTI && HL.holdFor(P, sh, s, h.id, hero)) return true;
    const wk = hsWidget[s + ':' + h.id]; return hero === 'taya' && !!wk && L.ok(st, wk.w.need) && !st.flags['w:' + wk.w.id];
  }
  function passBy(st, s, h) { return actors(st, s).filter(id => (!MULTI || HL.allowed(SC[h.to], id, P)) && !blocks(st, s, h, id)); }
  const hsOf = (s, st) => L.hotspots(SC[s], st);
  const hsWidget = {}; P.widgets.forEach(w => { if (w.scene) w.hs.forEach((h, i) => { hsWidget[w.scene + ':' + h] = { w, i }; }); });
  const key = st => Object.keys(st.flags).filter(k => st.flags[k]).sort().join(',') + '|' + st.inv.slice().sort().join(',');
  const clone = st => ({ flags: Object.assign({}, st.flags), inv: st.inv.slice() });
  function settle(st) { for (let i = 0; i < 6; i++) { const k0 = key(st); L.autos(P, st, null); if (MULTI) HL.autoRelease(P, st); if (key(st) === k0) break; } return st; }
  // достижимость с учётом воздуха: результат Water.reach (seen + запас воздуха в точках входа); fromX — точки старта под водой
  function airReach(st, from, fromX) {
    return WA.reach(SC, P, st, from, { fromX,
      hotspots: s => hsOf(s, st),
      pass: (s, h) => L.ok(st, h.need) && L.ok(st, h.toNeed) && passBy(st, s, h).length > 0,
      stand: (s, h) => standX(s, st, h),
      entryX: (s, h) => L.clampX(L.walkOf(SC[h.to], st), h.toX != null ? h.toX : SC[h.to].hero.x) });
  }
  function scenesFrom(st, from, fromX) {
    if (AIR) { const R = airReach(st, from, fromX); Object.defineProperty(R.seen, '__air', { value: R, enumerable: false }); return R.seen; }
    const seen = { [from]: { prev: null, hs: null } }, q = [from];
    while (q.length) {
      const s = q.shift();
      for (const h of hsOf(s, st)) if (h.to && L.ok(st, h.need) && L.ok(st, h.toNeed) && !seen[h.to]) {
        // переход срабатывает, только если на клик без предмета нет правила (правила проверяются первыми); с помощниками — хоть у одного героя
        if (!passBy(st, s, h).length) continue;
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
    const out = [], k0 = key(st), seen = scenesFrom(st, P.start.scene), RA = seen.__air || null;
    const inAir = (s, h) => !RA || WA.hsOk(SC, P, RA, s, standX(s, st, h));   // до зоны под водой хватает воздуха
    const push = (n, act) => { settle(n); if (key(n) !== k0) out.push({ st: n, act }); };
    for (const s of Object.keys(seen)) {
      // вход в сцену
      { const n = clone(st); let ch = false; for (const r of P.enter) if (r.scene === s && L.ok(n, r.need)) { L.apply(P, n, r.do, null); if (r.puzzle) n.flags[r.puzzle] = true; ch = true; } if (ch) push(n, { kind: 'enter', scene: s }); }
      for (const hero of actors(st, s)) {
        const sh = as(st, hero), tag = a => (MULTI ? Object.assign(a, { hero }) : a);
        for (const h of hsOf(s, st)) {
          if (!L.ok(st, h.need) || !inAir(s, h)) continue;
          const wk = hsWidget[s + ':' + h.id], hd = MULTI ? HL.holdFor(P, sh, s, h.id, hero) : null;
          if (hd) { const n = clone(st); HL.start(P, n, hd, hero); if (hd.puzzle) n.flags[hd.puzzle] = true; push(n, tag({ kind: 'hold', scene: s, hs: h.id, hold: hd.id })); }
          else if (hero === 'taya' && wk && L.ok(st, wk.w.need) && !st.flags['w:' + wk.w.id]) { if (wk.i === 0) { const n = clone(st); L.solveWidget(P, n, wk.w, null); push(n, tag({ kind: 'widget', scene: s, widget: wk.w.id })); } }
          else { const r = L.resolve(P, sh, s, h.id, null); if (r) { const n = clone(st); L.runRule(P, n, r, null); push(n, tag({ kind: 'hs', scene: s, hs: h.id })); } }
          for (const it of st.inv) { const r = L.resolve(P, sh, s, h.id, it); if (r) { const n = clone(st); L.runRule(P, n, r, null); push(n, tag({ kind: 'use', scene: s, hs: h.id, item: it })); } }
        }
      }
    }
    // отпустить удержание: дойти до сцены удержания (сейчас) и оказаться в ней же после (держащий присоединяется к отряду)
    if (MULTI) for (const hd of HL.heldList(P, st)) if (seen[hd.scene]) {
      const n = clone(st), who = HL.holder(P, st, hd.id); HL.release(P, n, hd.id); settle(n);
      if (scenesFrom(n, P.start.scene)[hd.scene]) push(n, { kind: 'release', scene: hd.scene, hold: hd.id, hs: hd.hs, hero: who });
    }
    // таймеры главы: «подождать» — флаг меняется (если хоть одна сцена таймера достижима)
    for (const T of TIMERS) if ((!T.where || T.where.some(w => seen[w])) && L.ok(st, T.need)) { const n = clone(st); if (n.flags[T.flag]) delete n.flags[T.flag]; else n.flags[T.flag] = true; push(n, { kind: 'timer', flag: T.flag, scene: (T.where || []).find(w => seen[w]) }); }
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
  // положение: из каждой сцены, достижимой в состоянии st, можно вернуться к старту главы (сразу или переждав таймер)
  function positionSafe(st) {
    const bad = [];
    for (const s of Object.keys(scenesFrom(st, P.start.scene))) {
      if (wet(s)) {   // под водой: из каждого активного кармана сцены (туда приводит мягкий возврат) можно вернуться к старту
        const R0 = scenesFrom(st, P.start.scene).__air, ps = WA.pockets(SC[s], st).filter(p => R0.best(s, p.x) >= 0);   // только карманы, до которых она может дойти
        if (ps.every(p => scenesFrom(st, s, [p.x])[P.start.scene])) continue;
        bad.push(s); continue;
      }
      if (scenesFrom(st, s)[P.start.scene]) continue;
      const T = TIMERS.find(t => (!t.where || t.where.includes(s)) && L.ok(st, t.need));
      if (T) { const n = clone(st); if (n.flags[T.flag]) delete n.flags[T.flag]; else n.flags[T.flag] = true; if (scenesFrom(n, s)[P.start.scene]) continue; }
      bad.push(s);
    }
    return bad;
  }
  return { key, start, successors, explore, scenesFrom, positionSafe, actors, passBy, airReach, standX, P, SC, HEROES, MULTI, AIR };
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
