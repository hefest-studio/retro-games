/* МАЯЧНИЦА · tests/bot.mjs — бот-«игрок»: проходит главу ТОЛЬКО вводом (тап/перетаскивание в логических координатах)
   через G.down/move/up и G.update. Маршрут — кратчайший план из поиска по состояниям (solver.mjs); механизмы
   и мини-игры решаются поиском по их локальному состоянию, клики — по центрам зон/плиток. */
import { makeSolver, solveWidget } from './solver.mjs';

export function playChapter(K, opts = {}) {
  const log = [], events = [];
  const G = K.createGame({ onEvent: (t, d) => events.push({ t, d }) });
  const LAY = K.ThemeAPI.LAYOUT, SC = {}; K.SCENES.forEach(s => { SC[s.id] = s; });
  let clicks = 0, drags = 0, steps = 0;
  G.start();
  const plan = opts.plan || makeSolver(K).explore().plan;
  if (!plan) return { won: false, why: 'нет плана' };

  function tick(n = 1) { for (let i = 0; i < n; i++) { G.update(1 / 30); steps++; } }
  function idle(max = 6000) {
    for (let i = 0; i < max; i++) { if (!G.busy()) { tick(2); if (!G.busy()) return true; } tick(); }
    throw new Error('бот: зависание (сцена ' + G.state().scene + ', режим ' + G.runtime().mode + ')');
  }
  function tap(x, y) { G.move(x, y); G.down(x, y); G.up(x, y); clicks++; }
  // точка внутри зоны, куда клик действительно попадёт в эту зону (не перекрыта другой, не в полосе инвентаря)
  function pointOf(hsId) {
    const h = G.hotspot(hsId); if (!h) throw new Error('бот: нет активной зоны ' + hsId + ' в ' + G.state().scene);
    const [x, y, w, hh] = h.rect;
    for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const px = x + w * fx, py = y + hh * fy; if (py >= LAY.inv.y - 2) continue;
      const at = G.hotspotAt(px, py); if (at && at.id === hsId) return { x: px, y: py };
    }
    throw new Error('бот: зона ' + hsId + ' перекрыта');
  }
  function slotOf(item) { const i = G.state().inv.indexOf(item); if (i < 0) throw new Error('бот: нет предмета ' + item); const r = K.ThemeAPI.slotRect(i); return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 }; }
  function drag(from, to) { G.move(from.x, from.y); G.down(from.x, from.y); tick(); G.move((from.x + to.x) / 2, (from.y + to.y) / 2); G.move(to.x, to.y); G.up(to.x, to.y); drags++; }
  function tapHs(hsId) { const p = pointOf(hsId); tap(p.x, p.y); idle(); }
  // переход в сцену по графу выходов (BFS по текущему состоянию)
  function gotoScene(target) {
    for (let guard = 0; guard < 12 && G.state().scene !== target; guard++) {
      const st = G.state(), prev = { [st.scene]: null }, q = [st.scene];
      while (q.length) {
        const s = q.shift();
        for (const h of SC[s].hotspots) if (h.to && K.logic.ok(st, h.need) && K.logic.ok(st, h.toNeed) && !(h.to in prev) && !K.logic.resolve(K.PUZZLES, st, s, h.id, null)) { prev[h.to] = { s, hs: h.id }; q.push(h.to); }
      }
      if (!(target in prev)) throw new Error('бот: сцена ' + target + ' недоступна из ' + st.scene);
      let cur = target; while (prev[cur].s !== st.scene) cur = prev[cur].s;
      tapHs(prev[cur].hs);
    }
    if (G.state().scene !== target) throw new Error('бот: не дошёл до ' + target);
  }
  function solveMini() {
    const rt = G.runtime(); if (rt.mode !== 'mini') return;
    const w = rt.mini.w, T = K.Widgets.types[w.type], L = G.state().local[w.id];
    if (w.type === 'catch') {
      for (let k = 0; k < 50 && !T.solved(w, L); k++) { const i = L.got.indexOf(0); const p = T.pos(i, G.runtime().time); tap(p.x, p.y); tick(); }
    } else {
      const sol = solveWidget(K, w, JSON.parse(JSON.stringify(L)));
      if (!sol) throw new Error('бот: мини-игра ' + w.id + ' без решения');
      for (const i of sol) { const c = T.center(w, i); tap(c.x, c.y); tick(); }
    }
    for (let k = 0; k < 200 && G.runtime().mode === 'mini'; k++) tick();
    if (G.runtime().mode === 'mini') throw new Error('бот: мини-игра ' + w.id + ' не закрылась');
    idle();
  }
  function solveSceneWidget(id) {
    const w = K.PUZZLES.widgets.find(x => x.id === id), T = K.Widgets.types[w.type];
    const L = G.state().local[id] || T.init(w), sol = solveWidget(K, w, JSON.parse(JSON.stringify(L)));
    if (!sol) throw new Error('бот: механизм ' + id + ' без решения');
    for (const i of sol) tapHs(w.hs[i]);
    if (!G.state().flags['w:' + id]) throw new Error('бот: механизм ' + id + ' не решён');
  }

  idle();   // вступительная кат-сцена
  for (const a of plan) {
    log.push(a);
    if (a.kind === 'combo') { drag(slotOf(a.a), slotOf(a.b)); idle(); continue; }
    if (a.kind === 'enter') {
      if (G.state().scene === a.scene) { const out = SC[a.scene].hotspots.find(h => h.to && K.logic.ok(G.state(), h.need) && K.logic.ok(G.state(), h.toNeed)); tapHs(out.id); }
      gotoScene(a.scene); idle(); continue;
    }
    gotoScene(a.scene);
    if (a.kind === 'hs') tapHs(a.hs);
    else if (a.kind === 'use') { const p = pointOf(a.hs); drag(slotOf(a.item), p); idle(); }
    else if (a.kind === 'widget') solveSceneWidget(a.widget);
    if (G.runtime().mode === 'mini') solveMini();
  }
  for (let k = 0; k < 600 && !G.won(); k++) tick();
  const P = K.PUZZLES.puzzles;
  return { won: G.won(), clicks, drags, steps, solved: P.filter(p => G.state().flags[p.id]).length, total: P.length,
    missing: P.filter(p => !G.state().flags[p.id]).map(p => p.id), events, game: G, log };
}
