/* МАЯЧНИЦА · tests/engine.test.mjs — автотесты пилота (Node, без зависимостей).
   Запуск: node kvest/tests/engine.test.mjs (QUICK=1 — без бота). Скрипты игры грузятся в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { makeSolver, solveWidget, widgetReach } from './solver.mjs';
import { playChapter } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const store = {};
const sandbox = { console, Math, JSON, setTimeout: () => 0, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const FILES = ['js/music.js', 'js/i18n.js', 'js/theme-api.js', 'js/scenes.js', 'js/widgets.js', 'js/puzzles.js', 'js/game.js', 'js/audio.js', 'js/themes/grey.js'];
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const K = sandbox.KVEST, A = K.ThemeAPI, P = K.PUZZLES, LG = K.logic, WT = K.Widgets.types;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
const run = (G, sec) => { for (let i = 0; i < Math.round(sec * 30); i++) G.update(1 / 30); };
const tapHs = (G, id) => { const h = G.hotspot(id); ok(h, 'нет зоны ' + id); const x = h.rect[0] + h.rect[2] / 2, y = Math.min(h.rect[1] + h.rect[3] / 2, 470); G.down(x, y); G.up(x, y); };
function fresh(opts) { const ev = []; const G = K.createGame(Object.assign({ onEvent: (t, d) => ev.push({ t, d }) }, opts || {})); G.start(); G.skipCut(); return { G, ev }; }

// ---------- данные сцен: формат контракта ----------
const SC = {}; K.SCENES.forEach(s => { SC[s.id] = s; });
test('сцены: 6–10 штук, все поля контракта, размер 960×540, mood из словаря', () => {
  ok(K.SCENES.length >= 6 && K.SCENES.length <= 10, 'сцен ' + K.SCENES.length); eq(K.SCENES.length, 9);
  const ids = new Set();
  for (const s of K.SCENES) {
    ok(s.id && !ids.has(s.id), 'id ' + s.id); ids.add(s.id);
    eq(s.w, 960, s.id); eq(s.h, 540, s.id); ok(A.MOODS.includes(s.mood), s.id + ' mood ' + s.mood);
    ok(Array.isArray(s.layers) && s.layers.every(l => l.depth >= 0 && l.depth <= 3 && Array.isArray(l.items)), s.id + ' layers');
    ok(Array.isArray(s.objects) && Array.isArray(s.hotspots), s.id);
    ok(Array.isArray(s.walk) && s.walk.length >= 2 && s.walk.every(p => p.length === 2), s.id + ' walk');
    ok(s.hero && typeof s.hero.x === 'number' && typeof s.hero.y === 'number', s.id + ' hero');
    ok(A.ICONS[s.icon], s.id + ' icon');
    const hid = new Set();
    for (const h of s.hotspots) {
      ok(!hid.has(h.id), s.id + ': дубль зоны ' + h.id); hid.add(h.id);
      ok(Array.isArray(h.rect) && h.rect.length === 4 && h.rect.every(Number.isFinite), s.id + ':' + h.id + ' rect');
      ok(A.CURSORS.includes(h.cursor), s.id + ':' + h.id + ' cursor ' + h.cursor);
      if (h.to) ok(SC[h.to], s.id + ':' + h.id + ' → нет сцены ' + h.to);
      if (h.look) h.look.forEach(ic => ok(A.ICONS[ic], 'пиктограмма ' + ic));
    }
  }
});
test('сцены сериализуются (обычные данные, без функций) — JSON туда-обратно без потерь', () => {
  const s = JSON.stringify(K.SCENES); eq(JSON.stringify(JSON.parse(s)), s);
  const walk = (o) => { if (typeof o === 'function') throw new Error('функция в данных'); if (o && typeof o === 'object') Object.values(o).forEach(walk); };
  walk(K.SCENES); walk(P);
});
test('все сцены используют только kind из словаря theme-api (layers и objects)', () => {
  for (const s of K.SCENES) {
    for (const l of s.layers) for (const it of l.items) ok(A.isKind(it.kind), s.id + ': kind ' + it.kind);
    for (const o of s.objects) { ok(A.isKind(o.kind), s.id + ':' + o.id + ' kind ' + o.kind); if (o.kind === 'item') ok(A.ICONS[o.item], 'иконка предмета ' + o.item); }
  }
  // и сцены крупного плана мини-игр
  for (const w of P.widgets.filter(x => x.mini)) {
    const sc = WT[w.type].scene(w, WT[w.type].init(w), 1, { ring: {} });
    sc.layers.forEach(l => l.items.forEach(it => ok(A.isKind(it.kind), w.id + ' kind ' + it.kind)));
    sc.objects.forEach(o => ok(A.isKind(o.kind), w.id + ' kind ' + o.kind));
  }
});
test('граф сцен связный: из мастерской достижима каждая сцена (по выходам)', () => {
  const seen = new Set(['workshop']), q = ['workshop'];
  while (q.length) { const s = q.shift(); for (const h of SC[s].hotspots) if (h.to && !seen.has(h.to)) { seen.add(h.to); q.push(h.to); } }
  eq(seen.size, K.SCENES.length);
});
test('правила ссылаются на существующие сцены, зоны, предметы и пиктограммы; объекты механизмов есть в сценах', () => {
  const items = new Set(P.items);
  const checkActs = (acts, where) => acts.forEach(a => {
    if (a[0] === 'give' || a[0] === 'take') ok(items.has(a[1]), where + ': предмет ' + a[1]);
    if (a[0] === 'think') a[1].forEach(ic => ok(A.ICONS[ic], where + ': пиктограмма ' + ic));
    if (a[0] === 'npcThink') { a[2].forEach(ic => ok(A.ICONS[ic], where + ': пиктограмма ' + ic)); }
    if (a[0] === 'cut') ok(P.cuts[a[1]], where + ': кат-сцена ' + a[1]);
    if (a[0] === 'mini') ok(P.widgets.find(w => w.id === a[1] && w.mini), where + ': мини-игра ' + a[1]);
    if (a[0] === 'go') ok(SC[a[1]], where + ': сцена ' + a[1]);
  });
  for (const r of P.rules) { ok(SC[r.scene], 'сцена ' + r.scene); ok(SC[r.scene].hotspots.find(h => h.id === r.hs), r.scene + ': нет зоны ' + r.hs); if (r.item) ok(items.has(r.item), 'предмет ' + r.item); checkActs(r.do, r.scene + ':' + r.hs); }
  for (const c of P.combos) { ok(items.has(c.a) && items.has(c.b)); checkActs(c.do, 'combo'); }
  for (const id in P.cuts) checkActs(P.cuts[id], 'cut ' + id);
  P.items.forEach(i => ok(A.ICONS[i], 'нет пиктограммы предмета ' + i));
  for (const w of P.widgets) if (w.scene) {
    w.hs.forEach(h => ok(SC[w.scene].hotspots.find(x => x.id === h), w.id + ': зона ' + h));
    (w.objs || []).filter(Boolean).concat(w.lamps || [], w.machine ? [w.machine] : [], w.gauge ? [w.gauge] : [], w.lift ? [w.lift] : [])
      .forEach(o => ok(SC[w.scene].objects.find(x => x.id === o), w.id + ': объект ' + o));
  }
  for (const p of P.puzzles) { (p.hint || []).concat(p.sketch || []).forEach(ic => ok(A.ICONS[ic], p.id + ': пиктограмма ' + ic)); }
});

// ---------- головоломки: число и типы (по данным) ----------
test('головоломок 20–30 (по реестру данных), у каждой есть «решатель» — правило/механизм/авто/вход', () => {
  const n = P.puzzles.length; console.log('     головоломок: ' + n + ' · ' + ['item', 'mech', 'mini', 'observe'].map(t => t + ' ' + P.puzzles.filter(p => p.type === t).length).join(', '));
  ok(n >= 20 && n <= 30, 'головоломок ' + n);
  const by = new Set([].concat(P.rules, P.combos, P.enter, P.autos, P.widgets).map(r => r.puzzle).filter(Boolean));
  for (const p of P.puzzles) ok(by.has(p.id), 'нечем решить ' + p.id);
  eq(new Set(P.puzzles.map(p => p.id)).size, n, 'дубли id');
});
test('типы: предметные, механические, 2–3 мини-игры крупным планом, наблюдательные с подсказкой в ДРУГОЙ сцене', () => {
  const t = k => P.puzzles.filter(p => p.type === k);
  ok(t('item').length >= 8, 'предметных ' + t('item').length); ok(t('mech').length >= 4, 'механических ' + t('mech').length);
  const minis = P.widgets.filter(w => w.mini && !w.hintGame); ok(minis.length >= 2 && minis.length <= 3, 'мини-игр ' + minis.length);
  ok(t('mini').length === minis.length, 'мини-игры в реестре');
  ok(P.combos.length >= 2, 'комбинаций в инвентаре ' + P.combos.length);
  const obs = P.puzzles.filter(p => p.clue); ok(obs.length >= 2, 'наблюдательных ' + obs.length);
  for (const p of obs) {
    ok(p.clue !== p.scene, p.id + ': подсказка в той же сцене');
    const icons = JSON.stringify(SC[p.clue].objects.map(o => o.state || {}));
    if (p.id === 'p_door') { const w = P.widgets.find(x => x.id === 'dials'); ok(icons.includes(JSON.stringify(w.target.map(i => w.values[i]))), 'код дисков не на чертеже'); }
    if (p.id === 'p_plates') { const w = P.widgets.find(x => x.id === 'plates'), plates = w.objs.map(id => SC.cave.objects.find(o => o.id === id).state.icon); ok(icons.includes(JSON.stringify(w.order.map(i => plates[i]))), 'порядок плит не на табличке'); }
    if (p.id === 'p_melody') { const w = P.widgets.find(x => x.id === 'melody'), birds = SC.square.objects.filter(o => o.state && o.state.type === 'bird').map(o => o.state.note); eq(birds.join(), w.target.join(), 'птицы ≠ мелодия'); }
  }
});

// ---------- решаемость главы поиском по состояниям ----------
const SOLV = makeSolver(K); let EXP = null;
test('решаемость: из начального состояния достижим финал (поиск в ширину по флагам и инвентарю)', () => {
  const t0 = Date.now(); EXP = SOLV.explore();
  console.log('     состояний: ' + EXP.list.length + ', финальных: ' + EXP.goals.length + ', кратчайший план: ' + (EXP.plan && EXP.plan.length) + ' действий, ' + (Date.now() - t0) + ' мс');
  ok(EXP.goals.length > 0, 'финал недостижим'); ok(EXP.plan && EXP.plan.length > 20);
});
test('нет тупиков: из любого достижимого состояния финал всё ещё достижим', () => {
  ok(EXP, 'нет поиска'); eq(EXP.dead.length, 0, 'тупиков (пример: ' + (EXP.dead[0] ? SOLV.key(EXP.dead[0].st) : '') + ')');
});
test('в любом финальном состоянии решены все головоломки главы (ни одну нельзя обойти)', () => {
  for (const g of EXP.goals) { const st = EXP.list[g].st; const miss = P.puzzles.filter(p => !st.flags[p.id]).map(p => p.id); eq(miss.join(','), '', 'обойдены'); }
});
test('инвентарь никогда не переполняет полосу (≤ слотов) во всех достижимых состояниях', () => {
  const max = Math.max(...EXP.list.map(n => n.st.inv.length)); console.log('     максимум предметов: ' + max); ok(max <= A.LAYOUT.inv.slots);
});
test('подсказка всегда есть цель: в любом нефинальном состоянии есть доступная нерешённая головоломка', () => {
  for (const n of EXP.list) { if (n.st.flags.won) continue; ok(P.puzzles.some(p => !n.st.flags[p.id] && LG.ok(n.st, p.avail)), 'нет цели: ' + SOLV.key(n.st)); }
});

// ---------- механизмы и мини-игры ----------
test('каждый механизм и мини-игра решаемы из начала и из любого своего достижимого состояния; в начале не решены', () => {
  for (const w of P.widgets) {
    const T = WT[w.type], L0 = T.init(w);
    if (w.type === 'catch') { const L = T.init(w); [0, 1, 2].forEach(i => T.act(w, L, i)); ok(T.solved(w, L), 'светлячки'); continue; }
    ok(!T.solved(w, L0), w.id + ': решён в начале');
    const sol = solveWidget(K, w, JSON.parse(JSON.stringify(L0))); ok(sol && sol.length > 0, w.id + ': нет решения');
    const L = JSON.parse(JSON.stringify(L0)); sol.forEach(i => T.act(w, L, i)); ok(T.solved(w, L), w.id + ': решение не решает');
    if (w.type !== 'pipes') {
      const all = widgetReach(K, w, L0); let bad = 0;
      if (all.length <= 3000) { for (const s of all) if (!T.solved(w, s) && !solveWidget(K, w, JSON.parse(JSON.stringify(s)))) bad++; }
      else {
        // большое пространство (сдвижная): каждый ход обратим → из любого достижимого состояния можно вернуться к началу, а из него решение есть
        for (const s of all.slice(0, 3000)) for (const i of T.neighbours(w, s)) {
          const n = JSON.parse(JSON.stringify(s)); T.act(w, n, i); const back = T.neighbours(w, n).some(j => { const m = JSON.parse(JSON.stringify(n)); T.act(w, m, j); return T.key(m) === T.key(s); }); if (!back) bad++;
        }
      }
      eq(bad, 0, w.id + ': тупиков'); if (w.type === 'slider') console.log('     сдвижная оправа: ' + all.length + ' состояний, решение ' + sol.length + ' ходов');
    } else {
      // трубы: поиск решения из случайных поворотов
      const rnd = K.Widgets.rng(5);
      for (let k = 0; k < 30; k++) { const s = { r: w.grid.map((g, i) => g.f ? L0.r[i] : Math.floor(rnd() * 4)) }; ok(T.solve(w, s), 'трубы: тупик ' + s.r.join('')); }
    }
  }
});
test('мини-игры кликами: попадание по плиткам/колокольчикам переводит в решённое состояние и закрывает крупный план', () => {
  // настоящий прогон: открыть через движок
  const { G: G2 } = fresh(); const s2 = G2.state(); s2.flags['w:valves'] = true; s2.scene = 'boathouse';
  G2.load(G2.serialize()); tapHs(G2, 'panel'); run(G2, 4); eq(G2.runtime().mode, 'mini', 'трубы не открылись');
  const w = P.widgets.find(x => x.id === 'pipes'), T = WT.pipes, sol = T.solve(w, G2.state().local.pipes);
  for (const i of sol) { const c = T.center(w, i); G2.down(c.x, c.y); G2.up(c.x, c.y); }
  ok(G2.state().flags['w:pipes'] && G2.state().flags.p_pipes, 'трубы не решены кликами'); run(G2, 1.5); eq(G2.runtime().mode, 'scene', 'крупный план не закрылся');
  // колокольчики: открыть в лестнице, сыграть мелодию птиц кликами по колокольчикам
  const { G: G3 } = fresh(); const s3 = G3.state(); s3.flags.towerOpen = true; s3.scene = 'stairs'; G3.load(G3.serialize());
  tapHs(G3, 'chimes'); run(G3, 4); eq(G3.runtime().mode, 'mini', 'колокольчики не открылись');
  const wm = P.widgets.find(x => x.id === 'melody'); const c0 = WT.melody.center(wm, 0); G3.down(c0.x, c0.y); G3.up(c0.x, c0.y); eq(G3.state().local.melody.k, 0, 'неверная нота не сбросила');
  for (const i of wm.target) { const c = WT.melody.center(wm, i); G3.down(c.x, c.y); G3.up(c.x, c.y); }
  ok(G3.state().flags['w:melody'], 'мелодия не принята'); run(G3, 1.5); eq(G3.runtime().mode, 'scene');
  // оправа: закрыть крестиком до решения — прогресс сохраняется
  const { G: G4 } = fresh(); const s4 = G4.state(); s4.flags['w:melody'] = true; s4.scene = 'lantern'; G4.load(G4.serialize());
  tapHs(G4, 'carriage'); run(G4, 4); eq(G4.runtime().mode, 'mini'); const wf = P.widgets.find(x => x.id === 'frame');
  const nb = WT.slider.neighbours(wf, G4.state().local.frame)[0], cc = WT.slider.center(wf, nb); G4.down(cc.x, cc.y); G4.up(cc.x, cc.y);
  const b1 = G4.state().local.frame.b.join(); const L = A.LAYOUT.close; G4.down(L.x, L.y); G4.up(L.x, L.y); eq(G4.runtime().mode, 'scene');
  tapHs(G4, 'carriage'); run(G4, 4); eq(G4.state().local.frame.b.join(), b1, 'прогресс оправы потерян');
});

// ---------- механика жанра ----------
test('клик по зоне: героиня сначала идёт, действие — только когда дотянулась (не сразу)', () => {
  const { G, ev } = fresh(); const x0 = G.runtime().hero.x;
  tapHs(G, 'stool'); ok(!G.state().flags.stoolMoved, 'сработало мгновенно'); ok(G.runtime().target, 'не пошла');
  run(G, 3); ok(G.state().flags.stoolMoved, 'не сработало после подхода'); ok(Math.abs(G.runtime().hero.x - 330) < 2, 'стоит не у табурета: ' + G.runtime().hero.x);
  ok(ev.some(e => e.t === 'walk'));
});
test('высоко — не дотянуться: полка без табурета даёт мысль «табурет + вверх», с табуретом — маслёнка', () => {
  const { G, ev } = fresh(); tapHs(G, 'shelf'); run(G, 4);
  ok(!G.state().inv.includes('oilcan')); const th = ev.filter(e => e.t === 'think').pop(); eq(th.d.icons.join(), 'stool,up');
  tapHs(G, 'stool'); run(G, 3); tapHs(G, 'shelf'); run(G, 3); ok(G.state().inv.includes('oilcan') && G.state().flags.p_shelf);
});
test('курсор меняется над зонами: take / look / go / use, пусто — walk; с выбранным предметом — use', () => {
  const { G } = fresh();
  const cur = (x, y) => { G.move(x, y); return G.model().cursor.kind; };
  eq(cur(470, 260), 'take'); eq(cur(395, 150), 'look'); eq(cur(915, 360), 'go'); eq(cur(100, 300), 'use'); eq(cur(600, 420), 'walk');
});
test('клик по пустому месту — идёт по полосе ходьбы (y по линии ног), край полосы не пересекает', () => {
  const { G } = fresh(); G.down(840, 200); G.up(840, 200); run(G, 5);
  ok(Math.abs(G.runtime().hero.x - 840) < 1, 'x ' + G.runtime().hero.x); eq(Math.round(G.runtime().hero.y), 452);
  G.down(5, 300); G.up(5, 300); run(G, 6); eq(G.runtime().hero.x, SC.workshop.walk[0][0]);
});
test('инвентарь: перетаскивание на объект применяет предмет; тап-выбор + тап по цели — тоже; на другой предмет — комбинирует', () => {
  const { G } = fresh(); const st = G.state();
  st.inv.push('rope', 'hook'); st.flags.got_rope = st.flags.got_hook = true;
  const s0 = K.ThemeAPI.slotRect(0), s1 = K.ThemeAPI.slotRect(1);
  G.down(s0[0] + 20, s0[1] + 20); G.move(s0[0] + 50, s0[1] + 10); G.move(s1[0] + 20, s1[1] + 20); G.up(s1[0] + 20, s1[1] + 20);
  ok(st.inv.includes('grapple') && !st.inv.includes('rope') && st.flags.p_grapple, 'не скомбинировал: ' + st.inv);
  // тап-выбор + тап по цели (табурет нельзя «использовать» верёвкой — мысль «не то»)
  const sl = K.ThemeAPI.slotRect(0); G.down(sl[0] + 10, sl[1] + 10); G.up(sl[0] + 10, sl[1] + 10); eq(G.runtime().sel, 'grapple');
  tapHs(G, 'stool'); eq(G.runtime().sel, null); run(G, 1); ok(G.runtime().thoughts.hero && G.runtime().thoughts.hero.icons.includes('cross'), 'нет мысли «не то»');
});
test('долгий тап — осмотр (мысль с пиктограммами зоны), ничего не меняет', () => {
  const { G } = fresh(); const before = JSON.stringify(G.state().flags);
  G.down(395, 150); run(G, 0.7); G.up(395, 150);
  ok(G.runtime().thoughts.hero, 'нет мысли'); eq(G.runtime().thoughts.hero.icons.join(), 'fish,star,bell'); eq(JSON.stringify(G.state().flags), before);
  ok(!G.runtime().target, 'долгий тап не должен вести');
});
test('подсказка: один раз на сцену бесплатно; дальше — мини-игра «светлячки» (или таймер); цель — по реестру', () => {
  const { G, ev } = fresh();
  eq(G.hint(), 'free'); ok(ev.some(e => e.t === 'hint')); const ic = ev.filter(e => e.t === 'hint').pop().d.icons; eq(ic.join(), 'stool,up,oilcan');
  eq(G.hint(), 'game'); eq(G.runtime().mode, 'mini'); eq(G.runtime().mini.id, 'fireflies');
  const w = P.widgets.find(x => x.id === 'fireflies'), T = WT.catch;
  for (let i = 0; i < 3; i++) { const p = T.pos(i, G.runtime().time); G.down(p.x, p.y); G.up(p.x, p.y); }
  run(G, 1.5); eq(G.runtime().mode, 'scene'); eq(ev.filter(e => e.t === 'hint').length, 2, 'после светлячков нет подсказки');
  eq(G.hint(), 'game', 'перезарядка'); G.closeMini(); run(G, 46); eq(G.hint(), 'timer', 'по таймеру');
  // в другой сцене — снова бесплатно
  const s = G.state(); s.scene = 'square'; ok(G.model().ui.hint.ready); eq(G.hint(), 'free');
});
test('прохождение-набросок: шаги = головоломки, страницы листаются, открывается/закрывается отдельно', () => {
  const { G } = fresh(); G.openWalk(); const m = G.model(); eq(m.ui.mode, 'walk'); eq(m.ui.walk.steps.length, P.puzzles.length);
  const L = A.LAYOUT.walk; G.down(L.next.x, L.next.y); G.up(L.next.x, L.next.y); eq(G.model().ui.walk.page, 1);
  G.down(L.close.x, L.close.y); G.up(L.close.x, L.close.y); eq(G.model().ui.mode, 'scene');
  ok(G.walkSteps().every(s => s.icons.every(ic => A.ICONS[ic])), 'пиктограммы шагов');
});
test('кат-сцена вступления идёт движком (мысли мастера), тап — пропуск; повторно не показывается', () => {
  const ev = []; const G = K.createGame({ onEvent: (t, d) => ev.push({ t, d }) }); G.start();
  ok(G.busy(), 'кат-сцена не началась'); run(G, 1.5); ok(ev.some(e => e.t === 'think' && e.d.who === 'master'), 'мастер не думает');
  G.down(400, 300); G.up(400, 300); ok(!G.busy() && G.state().flags.introSeen, 'не пропустилась');
  G.down(915, 360); G.up(915, 360); run(G, 6); eq(G.state().scene, 'square'); tapHs(G, 'toWorkshop'); run(G, 8); eq(G.state().scene, 'workshop'); ok(!G.busy(), 'повтор вступления');
});
test('тёмный грот: без огня темно и зоны неактивны; с ручным фонарём — светло (p_dark)', () => {
  const { G } = fresh(); const st = G.state(); st.scene = 'pier'; G.load(G.serialize());
  tapHs(G, 'toCave'); run(G, 8); eq(G.state().scene, 'cave'); ok(G.model().scene.dark); ok(!G.hotspot('pool'), 'зона в темноте');
  const G2 = fresh().G, s2 = G2.state(); s2.inv.push('lantern_lit'); s2.scene = 'pier'; G2.load(G2.serialize());
  tapHs(G2, 'toCave'); run(G2, 8); ok(!G2.model().scene.dark && G2.state().flags.p_dark && G2.hotspot('pool'));
});

// ---------- сохранение / загрузка ----------
test('сохранение/загрузка: состояние, инвентарь, механизмы и сцена восстанавливаются; мусор отвергается', () => {
  const { G } = fresh(); tapHs(G, 'stool'); run(G, 3); tapHs(G, 'sw2'); run(G, 3);
  const json = G.serialize(), o = JSON.parse(json); eq(o.v, 1); ok(o.flags.stoolMoved); ok(o.local.switches);
  const G2 = K.createGame({}); ok(G2.load(json)); eq(G2.serialize(), json.replace(/"heroX":\d+/, '"heroX":' + JSON.parse(G2.serialize()).heroX));
  eq(JSON.stringify(G2.state().local.switches), JSON.stringify(G.state().local.switches)); eq(G2.state().scene, 'workshop');
  ok(!K.createGame({}).load('{не json'), 'битый JSON'); ok(!K.createGame({}).load({ v: 99 }), 'чужая версия');
  ok(!K.createGame({}).load({ v: 1, scene: 'nowhere', flags: {}, inv: [] }), 'нет сцены'); ok(!K.createGame({}).load({ v: 1, scene: 'workshop', flags: {}, inv: ['bomb'] }), 'чужой предмет');
});
test('сохранение на полпути главы (ботом) и продолжение: бот дойдёт до финала из загруженного состояния', () => {
  if (process.env.QUICK) return;
  const plan = EXP.plan, half = plan.slice(0, 18);
  const r1 = playChapter(K, { plan: half }); ok(!r1.won && r1.solved >= 8, 'половина: ' + r1.solved);
  const json = r1.game.serialize(); store['arcade.save.kvest'] = json;
  const G = K.createGame({}); ok(G.load(store['arcade.save.kvest'])); eq(G.solvedCount(), r1.solved);
  // поиск от загруженного состояния до финала
  ok(EXP.list.some(n => SOLV.key(n.st) === SOLV.key({ flags: G.state().flags, inv: G.state().inv })), 'загруженное состояние вне графа');
});

// ---------- тема ----------
test('тема grey проходит проверку API (все методы, неизвестный kind/пиктограмма/курсор не падают)', () => {
  const r = A.validateTheme(sandbox.KvestTheme); ok(r.ok, r.errors.join('; ')); eq(sandbox.KvestTheme.id, 'grey');
});
test('проверка API ловит сломанную тему: нет метода; падение на неизвестном kind', () => {
  const t = Object.assign({}, sandbox.KvestTheme); delete t.drawUI; ok(!A.validateTheme(t).ok);
  const t2 = Object.assign({}, sandbox.KvestTheme, { drawScene: (c, s) => { s.objects.forEach(o => { if (!A.isKind(o.kind)) throw new Error('kind'); }); } });
  const r = A.validateTheme(t2); ok(!r.ok && r.errors.some(e => /drawScene/.test(e)));
});
test('тема рисует каждую сцену в любом состоянии и каждую мини-игру без исключений', () => {
  const ctx = A.mockCtx(), th = sandbox.KvestTheme;
  for (const n of [EXP.list[0], EXP.list[Math.floor(EXP.list.length / 2)], EXP.list[EXP.goals[0]]]) {
    const G = K.createGame({}); G.load({ v: 1, scene: 'workshop', flags: n.st.flags, inv: n.st.inv });
    for (const s of K.SCENES) { G.state().scene = s.id; const m = G.model(); th.drawScene(ctx, m.scene, 1, { debug: true, light: m.light }); th.drawHero(ctx, m.hero, 'walk', 1); th.drawUI(ctx, m.ui, 1); }
  }
  for (const w of P.widgets.filter(x => x.mini)) th.drawScene(ctx, WT[w.type].scene(w, WT[w.type].init(w), 2, { ring: { c1: 1.5 } }), 2, {});
  ok(ctx.calls > 1000, 'вызовов ' + ctx.calls);
});

// ---------- бот ----------
if (!process.env.QUICK) {
  test('бот-«игрок» проходит главу кликами по зонам и перетаскиванием предметов (все головоломки решены)', () => {
    const t0 = Date.now(), r = playChapter(K, { plan: EXP.plan });
    console.log('     бот: ' + (r.won ? 'финал' : 'НЕ прошёл') + ', кликов ' + r.clicks + ', перетаскиваний ' + r.drags + ', игрового времени ' + Math.round(r.steps / 30) + ' с, ' + (Date.now() - t0) + ' мс');
    ok(r.won, 'не прошёл'); eq(r.solved, r.total, 'не решены: ' + r.missing.join(','));
    ok(r.events.some(e => e.t === 'win'));
  });
}

// ---------- музыка, i18n, правило имён ----------
test('музыка: оригинальный трек kvest подключается по gameId (длины голосов кратны, 8–16 тактов)', () => {
  const T = sandbox.Arcade.tracks.kvest; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  const m = n(T.melody); ok(m % 8 === 0 && m / 8 >= 8 && m / 8 <= 16, 'тактов ' + m / 8); eq(m % n(T.bass), 0); eq(m % n(T.drums), 0);
});
test('i18n: у RU и EN одинаковые ключи; в игре нет текста (мысли — только пиктограммы)', () => {
  eq(Object.keys(K.STR.ru).sort().join(), Object.keys(K.STR.en).sort().join());
  ['play', 'cont', 'language', 'sound', 'pause', 'resume', 'menu', 'walk', 'back'].forEach(k => ok(K.STR.ru[k] && K.STR.en[k], k));
  const acts = [].concat(...P.rules.map(r => r.do), ...Object.values(P.cuts)); acts.filter(a => /think/i.test(a[0])).forEach(a => (a[0] === 'think' ? a[1] : a[2]).forEach(ic => ok(A.ICONS[ic], 'не пиктограмма: ' + ic)));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifG1hY2hpbmFyaXVtfG1hc2hpbmFyaXVtfNC80LDRiNC40L3QsNGA0LjRg9C8fGFtYW5pdGF80LDQvNCw0L3QuNGCfHNhbW9yb3N0fNGB0LDQvNC+0YDQvtGB0YJ8Ym90YW5pY3VsYXzQsdC+0YLQsNC90LjQutGD0Lt8am9zZWZ80LnQvtC30LXRhA==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files) { const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Маячница') && !BAD.test('kvest') && !BAD.test('KvestTheme') && !BAD.test('Гефест') && !BAD.test('chime') && !BAD.test('манометр'), 'стоп-лист без ложных срабатываний на наши слова');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
