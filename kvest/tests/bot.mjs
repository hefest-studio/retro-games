/* МАЯЧНИЦА · tests/bot.mjs — бот-«игрок»: проходит главу ТОЛЬКО вводом (тап/перетаскивание в логических координатах)
   через G.down/move/up и G.update. Маршрут — кратчайший план из поиска по состояниям (solver.mjs); механизмы
   и мини-игры решаются поиском по их локальному состоянию, клики — по центрам зон/плиток.
   Помощники: бот переключает героя тапом по портрету (LAYOUT.heroes), удержание — тап нужным героем по зоне, отпустить — тап
   держащим героем по той же зоне; в переходе ведёт свободный герой, которого пускают обе сцены (Тая, если может).
   Под водой (water.js): перед каждым действием бот считает воздух — если до зоны не хватает (или впереди выход в другую подводную
   сцену), идёт через воздушные карманы (тап по пустому месту у кармана, ждёт, пока шкала наполнится); если героиню всё же вернуло
   к карману (мягкий возврат) — повторяет действие. Счётчики: refills — заходов в карманы, outs — мягких возвратов. */
import { makeSolver, solveWidget } from './solver.mjs';

export function playChapter(K, opts = {}) {
  const log = [], events = [];
  // opts.game — уже запущенная игра (например, в браузере — та, что на экране, со всей оболочкой)
  // opts.chapter — глава из реестра (по умолчанию K.SCENES/K.PUZZLES); таймеры главы у бота «ручные» — время ждёт, пока план не скажет «подождать»
  const CH = opts.chapter || null, PZ = CH ? CH.puzzles : K.PUZZLES;
  const G = opts.game || K.createGame({ chapter: CH, timers: false, onEvent: (t, d) => events.push({ t, d }) });
  const LAY = K.ThemeAPI.LAYOUT, SC = {}; G.data.scenes.forEach(s => { SC[s.id] = s; });
  const hsOf = (s, st) => K.logic.hotspots(SC[s], st);
  const HL = K.Helpers, MULTI = !!G.multi, LH = LAY.heroes, solver = makeSolver(K, CH);
  let switches = 0;
  function portraitPoint(id) { const l = G.portraits(), i = l.indexOf(id); if (i < 0) throw new Error('бот: нет портрета ' + id); return { x: LH.x + i * LH.gap, y: LH.y }; }
  function switchTo(id) {
    if (!MULTI || !id || G.activeHero() === id) return;
    if (!G.present(id)) throw new Error('бот: герой ' + id + ' не в сцене ' + G.state().scene);
    const p = portraitPoint(id); tap(p.x, p.y); tick(); switches++;
    if (G.activeHero() !== id) throw new Error('бот: не переключился на ' + id);
  }
  let clicks = 0, drags = 0, steps = 0;
  if (!opts.game) G.start();
  const plan = opts.plan || makeSolver(K, CH).explore().plan;
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
      if (G.portraitAt && G.portraitAt(px, py)) continue;   // под портретом героя клик уйдёт в переключатель
      const at = G.hotspotAt(px, py); if (at && at.id === hsId) return { x: px, y: py };
    }
    throw new Error('бот: зона ' + hsId + ' перекрыта');
  }
  function emptyPoint() { const w = K.logic.walkOf(G.scene(), G.state()); for (let x = 60; x < 900; x += 37) { const y = K.logic.yAt(w, x) - 30; if (!G.hotspotAt(x, y) && !(G.portraitAt && G.portraitAt(x, y))) return { x, y }; } throw new Error('бот: нет пустого места'); }
  function slotOf(item) { const i = G.state().inv.indexOf(item); if (i < 0) throw new Error('бот: нет предмета ' + item); const r = K.ThemeAPI.slotRect(i); return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 }; }
  function drag(from, to) { G.move(from.x, from.y); G.down(from.x, from.y); tick(); G.move((from.x + to.x) / 2, (from.y + to.y) / 2); G.move(to.x, to.y); G.up(to.x, to.y); drags++; }
  // ---------- воздух: путь к зоне через карманы ----------
  const WA = K.Water || null, AIRC = WA ? WA.conf(PZ) : null; let refills = 0, retries = 0;
  const wetNow = () => !!(AIRC && WA.isWater(G.scene()));
  function freePointAt(x0) {   // пустое место (не зона, не портрет, не инвентарь) с x рядом с x0 — тап туда = «идти в x»
    for (const dx of [0, -10, 10, -20, 20, -30, 30]) for (let y = 440; y > 70; y -= 24) { const x = x0 + dx; if (x < 4 || x > 956) continue; if (!G.hotspotAt(x, y) && !(G.portraitAt && G.portraitAt(x, y))) return { x, y }; }
    throw new Error('бот: у кармана ' + Math.round(x0) + ' нет пустого места в ' + G.state().scene);
  }
  function refillAt(p) {
    const q = freePointAt(p.x); tap(q.x, q.y); idle();
    for (let k = 0; k < 120 && G.air().left < AIRC.max - 0.02; k++) tick();
    if (G.air().left < AIRC.max - 0.02) throw new Error('бот: карман ' + p.id + ' не дал воздуха в ' + G.state().scene);
    refills++;
  }
  // хватит ли воздуха дойти до x, дотянуться И вернуться к ближайшему карману (не доводить до мягкого возврата); если нет
  // (или most — выход в другую подводную сцену: нужен максимум воздуха, возвращаться не надо) — сначала через карманы
  function airPath(tx, most) {
    if (!wetNow()) return;
    const sp = AIRC.speed, full = AIRC.max * sp;
    for (let guard = 0; guard < 6; guard++) {
      const x = G.runtime().hero.x, have = G.air().left * sp;
      const ps = WA.pockets(G.scene(), G.state()), prev = new Map(), q = [];
      const home = most || !ps.length ? 0 : Math.min(...ps.map(p => Math.abs(p.x - tx)));   // путь от зоны обратно к карману
      let M = 40 + WA.reachCost(PZ) + home; if (full - home - M < 0) M -= home;   // туда-обратно не выходит и от кармана — тогда хотя бы туда
      const direct = have - Math.abs(x - tx) - M;
      for (const p of ps) if (Math.abs(p.x - x) + 30 <= have) { prev.set(p, null); q.push(p); }
      for (let i = 0; i < q.length; i++) for (const p of ps) if (!prev.has(p) && Math.abs(p.x - q[i].x) + 30 <= full) { prev.set(p, q[i]); q.push(p); }
      let best = null; for (const p of q) if (!best || Math.abs(p.x - tx) < Math.abs(best.x - tx)) best = p;
      const via = best ? full - Math.abs(best.x - tx) - M : -Infinity;
      if (direct >= 0 && !(most && via > direct + 1)) return;
      if (!best || via < 0) { if (direct >= 0) return; throw new Error('бот: не хватает воздуха до x=' + Math.round(tx) + ' в ' + G.state().scene + ' (воздух ' + G.air().left.toFixed(1) + ' с)'); }
      const chain = []; for (let p = best; p; p = prev.get(p)) chain.unshift(p);
      for (const p of chain) refillAt(p);
      if (via >= 0) return;
    }
  }
  function prepHs(hsId) {
    if (!wetNow()) return; const h = G.hotspot(hsId); if (!h) return;
    const w = K.logic.walkOf(G.scene(), G.state()), tx = K.logic.clampX(w, h.at != null ? h.at : h.rect[0] + h.rect[2] / 2);
    airPath(tx, !!(h.to && SC[h.to] && WA.isWater(SC[h.to])));
  }
  // действие под водой: если воздух кончился по дороге (мягкий возврат) — повторить
  function withAir(hsId, act) {
    for (let k = 0; k < 3; k++) { prepHs(hsId); const o0 = AIRC ? G.air().outs : 0; act(); if (!AIRC || G.air().outs === o0) return; retries++; idle(); }
    throw new Error('бот: воздух кончается на пути к ' + hsId + ' в ' + G.state().scene);
  }
  function tapHs(hsId) { withAir(hsId, () => { const p = pointOf(hsId); tap(p.x, p.y); idle(); }); }
  // переход в сцену по графу выходов (BFS по текущему состоянию)
  function gotoScene(target) {
    for (let guard = 0; guard < 12 && G.state().scene !== target; guard++) {
      const st = G.state(), prev = { [st.scene]: null }, q = [st.scene];
      if (solver.AIR) {   // под водой путь выбирает та же достижимость с воздухом, что и у поиска
        const seen = solver.scenesFrom(st, st.scene, K.Water.isWater(SC[st.scene]) ? [G.runtime().hero.x] : undefined);
        for (const id of Object.keys(seen)) if (seen[id].prev != null) prev[id] = { s: seen[id].prev, hs: seen[id].hs };
      } else while (q.length) {
        const s = q.shift();
        for (const h of hsOf(s, st)) if (h.to && K.logic.ok(st, h.need) && K.logic.ok(st, h.toNeed) && !(h.to in prev) && solver.passBy(st, s, h).length) { prev[h.to] = { s, hs: h.id }; q.push(h.to); }
      }
      if (!(target in prev)) throw new Error('бот: сцена ' + target + ' недоступна из ' + st.scene);
      let cur = target; while (prev[cur].s !== st.scene) cur = prev[cur].s;
      if (MULTI) {   // ведёт свободный герой, которого пускают обе сцены: активный, если может, иначе Тая или другой
        const ex = G.hotspot(prev[cur].hs), ok = solver.passBy(st, st.scene, ex).filter(id => G.present(id));
        if (!ok.length) throw new Error('бот: некому пройти ' + prev[cur].hs + ' в ' + st.scene);
        if (ok.indexOf(G.activeHero()) < 0) switchTo(ok.indexOf('taya') >= 0 ? 'taya' : ok[0]);
      }
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
    const w = PZ.widgets.find(x => x.id === id), T = K.Widgets.types[w.type];
    const L = G.state().local[id] || T.init(w), sol = solveWidget(K, w, JSON.parse(JSON.stringify(L)));
    if (!sol) throw new Error('бот: механизм ' + id + ' без решения');
    for (const i of sol) tapHs(w.hs[i]);
    if (!G.state().flags['w:' + id]) throw new Error('бот: механизм ' + id + ' не решён');
  }

  idle();   // вступительная кат-сцена
  for (const a of plan) {
    log.push(a);
    if (a.kind === 'combo') { drag(slotOf(a.a), slotOf(a.b)); idle(); continue; }
    if (a.kind === 'timer') {   // «подождать»: дойти до сцены таймера и дать времени пройти
      if (a.scene) gotoScene(a.scene);
      const v0 = !!G.state().flags[a.flag]; G.waitTimer(a.flag); tick(2); idle();
      if (!!G.state().flags[a.flag] === v0) throw new Error('бот: таймер ' + a.flag + ' не сработал в ' + G.state().scene);
      continue;
    }
    if (a.kind === 'enter') {
      if (G.state().scene === a.scene) { const out = hsOf(a.scene, G.state()).find(h => h.to && K.logic.ok(G.state(), h.toNeed)); tapHs(out.id); }
      gotoScene(a.scene); idle(); continue;
    }
    gotoScene(a.scene);
    if (MULTI) switchTo(a.hero || 'taya');
    if (a.kind === 'release') {   // своя зона держащего — нажать её; зоны уже нет — шаг держащим по пустому месту
      if (!G.state().flags['held:' + a.hold]) continue;
      if (G.hotspot(a.hs)) tapHs(a.hs); else { const p = emptyPoint(); tap(p.x, p.y); idle(); }
      if (G.state().flags['held:' + a.hold]) throw new Error('бот: не отпустил ' + a.hold); continue;
    }
    if (a.kind === 'hold') { tapHs(a.hs); if (!G.state().flags['held:' + a.hold]) throw new Error('бот: не держит ' + a.hold); continue; }
    if (a.kind === 'hs') tapHs(a.hs);
    else if (a.kind === 'use') withAir(a.hs, () => { const p = pointOf(a.hs); drag(slotOf(a.item), p); idle(); });
    else if (a.kind === 'widget') solveSceneWidget(a.widget);
    if (G.runtime().mode === 'mini') solveMini();
  }
  for (let k = 0; k < 600 && !G.won(); k++) tick();
  const P = PZ.puzzles;
  return { won: G.won(), clicks, drags, steps, switches, refills, retries, outs: AIRC ? G.air().outs : 0, solved: P.filter(p => G.state().flags[p.id]).length, total: P.length,
    missing: P.filter(p => !G.state().flags[p.id]).map(p => p.id), events, game: G, log };
}
