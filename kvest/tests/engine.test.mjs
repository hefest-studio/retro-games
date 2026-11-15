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
const FILES = ['js/music.js', 'js/i18n.js', 'js/edition.js', 'js/stats.js', 'js/theme-api.js', 'js/scenes.js', 'js/widgets.js', 'js/puzzles.js', 'js/coast.js', 'js/chapters/index.js', 'js/game.js', 'js/audio.js', 'js/themes/icons-ext.js', 'js/themes/grey.js', 'js/themes/paper.js', 'js/themes/ink-sketch.js'];
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
test('прохождение-набросок: открыты только пройденные шаги и текущая цель; развороты листаются кнопками и свайпом', () => {
  const { G } = fresh(); G.openWalk(); let m = G.model(); eq(m.ui.mode, 'walk'); eq(G.walkSteps().length, P.puzzles.length);
  eq(m.ui.walk.steps.length, 1, 'в начале открыт только текущий шаг'); ok(m.ui.walk.steps[0].current && m.ui.walk.steps[0].id === 'p_shelf');
  G.closeWalk();
  // середина главы: открытые = решённые + текущая, по 2 на разворот, открывается на развороте с текущей целью
  const half = EXP.plan.slice(0, Math.floor(EXP.plan.length / 2)), r1 = playChapter(K, { plan: half }), G2 = r1.game;
  G2.openWalk(); m = G2.model(); const open = m.ui.walk.steps;
  eq(open.length, G2.solvedCount() + 1); ok(open.every(s => s.done || s.current)); eq(open.filter(s => s.current).length, 1);
  eq(m.ui.walk.pages, Math.ceil(open.length / A.LAYOUT.walk.per)); const pg0 = Math.floor(open.findIndex(s => s.current) / A.LAYOUT.walk.per); eq(m.ui.walk.page, pg0, 'открыт разворот текущей цели');
  ok(m.ui.walk.pages >= 2, 'разворотов ' + m.ui.walk.pages);
  const L = A.LAYOUT.walk; while (G2.model().ui.walk.page > 0) { G2.down(L.prev.x, L.prev.y); G2.up(L.prev.x, L.prev.y); }
  eq(G2.model().ui.walk.page, 0);
  G2.down(700, 300); G2.move(500, 310); G2.move(400, 310); G2.up(400, 310); eq(G2.model().ui.walk.page, 1, 'свайп влево — вперёд');
  G2.down(300, 300); G2.move(500, 300); G2.up(520, 300); eq(G2.model().ui.walk.page, 0, 'свайп вправо — назад');
  G2.down(L.close.x, L.close.y); G2.up(L.close.x, L.close.y); eq(G2.model().ui.mode, 'scene');
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
const THEMES = K.themes;
test('реестр тем: grey (отладочная) и paper (по умолчанию — подключена последней)', () => {
  ok(THEMES && THEMES.grey && THEMES.paper, 'нет реестра KVEST.themes'); eq(sandbox.KvestTheme.id, 'paper'); eq(THEMES.grey.id, 'grey');
});
for (const id of ['grey', 'paper']) test('тема ' + id + ' проходит проверку API (все методы, неизвестный kind/пиктограмма/курсор не падают)', () => {
  sandbox.KVEST_STRICT = true;
  try { const r = A.validateTheme(THEMES[id]); ok(r.ok, r.errors.join('; ')); eq(THEMES[id].id, id); } finally { sandbox.KVEST_STRICT = false; }
});
test('проверка API ловит сломанную тему: нет метода; падение на неизвестном kind', () => {
  const t = Object.assign({}, THEMES.grey); delete t.drawUI; ok(!A.validateTheme(t).ok);
  const t2 = Object.assign({}, THEMES.grey, { drawScene: (c, s) => { s.objects.forEach(o => { if (!A.isKind(o.kind)) throw new Error('kind'); }); } });
  const r = A.validateTheme(t2); ok(r.ok === false && r.errors.some(e => /drawScene/.test(e)));
});
for (const id of ['grey', 'paper']) test('тема ' + id + ' рисует каждую сцену в любом состоянии и каждую мини-игру без исключений', () => {
  const ctx = A.mockCtx(), th = THEMES[id]; sandbox.KVEST_STRICT = true;   // paper не глотает ошибки отрисовки
  try {
    for (const n of [EXP.list[0], EXP.list[Math.floor(EXP.list.length / 2)], EXP.list[EXP.goals[0]]]) {
      const G = K.createGame({}); G.load({ v: 1, scene: 'workshop', flags: n.st.flags, inv: n.st.inv });
      for (const s of K.SCENES) { G.state().scene = s.id; const m = G.model(); th.drawScene(ctx, m.scene, 1, { debug: true, light: m.light, hover: { x: 480, y: 300, kind: 'use' } }); th.drawHero(ctx, m.hero, 'walk', 1); th.drawUI(ctx, m.ui, 1); m.thoughts.forEach(q => th.drawThought(ctx, q.x, q.y, q.icons, 1)); }
    }
    for (const w of P.widgets.filter(x => x.mini)) th.drawScene(ctx, WT[w.type].scene(w, WT[w.type].init(w), 2, { ring: { c1: 1.5 } }), 2, {});
  } finally { sandbox.KVEST_STRICT = false; }
  ok(ctx.calls > 1000, 'вызовов ' + ctx.calls);
});
test('paper: цвет-метки головоломок в данных — птицы с нотами 0..4 = колокольчики, рычаги крана помечены частями крана', () => {
  const birds = SC.square.objects.filter(o => o.state && o.state.type === 'bird').map(o => o.state.note);
  eq(JSON.stringify(birds), JSON.stringify(P.widgets.find(w => w.id === 'melody').target), 'птицы слева направо = мелодия');
  const cr = P.widgets.find(w => w.id === 'crane'), tints = cr.objs.map(id => SC.pier.objects.find(o => o.id === id).state.tint);
  eq(tints[cr.order[0]], 'pin', 'первым — стопор'); eq(SC.cliff.objects.find(o => o.id === 'pawl').state.tint, 'pin');
  const vs = P.widgets.find(w => w.id === 'valves'); eq(JSON.stringify(vs.objs.map(id => SC.boathouse.objects.find(o => o.id === id).state.pips)), JSON.stringify(vs.weights));
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


// ---------- спринт 0: издание (демо/полная), i18n, статистика, тач, HiDPI, подсказки ----------
const ED = K.Edition;
test('издание: флаг сборки KVEST_EDITION + параметры ?demo / ?edition=full|demo', () => {
  ok(ED && (ED.BUILD === 'demo' || ED.BUILD === 'full'), 'нет константы сборки'); ok(typeof ED.MORE_URL === 'string' && ED.MORE_URL.length, 'нет ссылки «Узнать больше»');
  eq(ED.resolve('', 'demo'), 'demo'); eq(ED.resolve('', 'full'), 'full'); eq(ED.resolve('?demo', 'full'), 'demo'); eq(ED.resolve('?x=1&demo', 'full'), 'demo');
  eq(ED.resolve('?edition=full', 'demo'), 'full'); eq(ED.resolve('?edition=demo', 'full'), 'demo'); eq(ED.resolve('?demolition', 'full'), 'full', 'ложное срабатывание');
  eq(K.EDITION, ED.BUILD, 'без параметров — издание сборки');
});
test('издание: после финала — демо «Продолжение — в полной версии» (меню + «Узнать больше»), полная — «Глава N» или «Глава N — скоро»', () => {
  const d = ED.finale('demo'), f = ED.finale('full', null, 1), nx = ED.finale('full', { id: 'ch2', n: 2 }, 1);
  eq(d.kind, 'demo'); eq(d.items.join(), 'toMenu,more'); eq(f.kind, 'soon'); eq(f.items.join(), 'toMenu'); eq(f.n, 2);
  eq(nx.kind, 'next'); eq(nx.items.join(), 'next,toMenu'); eq(nx.n, 2); eq(ED.finale('demo', { id: 'ch2', n: 2 }, 1).kind, 'demo', 'демо никогда не ведёт дальше');
  for (const x of [d, f, nx]) for (const k of [x.title, x.sub].concat(x.items)) for (const L of ['ru', 'en']) ok(K.STR[L][k], L + ': нет строки ' + k);
  ok(/полной верси/i.test(K.STR.ru.demoTitle) && /full version/i.test(K.STR.en.demoTitle), 'текст демо-экрана');
  eq(K.STR.ru.soonTitle.replace('{n}', 2), 'Глава 2 — скоро'); ok(/Chapter 2/.test(K.STR.en.soonTitle.replace('{n}', 2)));
});
if (!process.env.QUICK) test('бот проходит главу в обоих изданиях; экран после финала соответствует изданию', () => {
  for (const ed of ['demo', 'full']) {
    sandbox.KVEST.EDITION = ed; const r = playChapter(K, { plan: EXP.plan });
    ok(r.won && r.solved === r.total, ed + ': не прошёл'); ok(r.events.some(e => e.t === 'win'), ed + ': нет события win');
    eq(ED.finale(K.EDITION).kind, ed === 'demo' ? 'demo' : 'soon', ed);
  }
  sandbox.KVEST.EDITION = ED.BUILD;
});
test('i18n: полнота RU/EN — каждый ключ, который зовёт оболочка (main.js, edition.js), есть в обоих языках; EN без кириллицы', () => {
  const ru = K.STR.ru, en = K.STR.en; eq(Object.keys(ru).sort().join(), Object.keys(en).sort().join(), 'разные ключи');
  for (const k in ru) { ok(String(ru[k]).trim() && String(en[k]).trim(), 'пустая строка ' + k); ok(!/[а-яё]/i.test(en[k]), 'кириллица в EN: ' + k); }
  const src = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js/edition.js'), 'utf8');
  const used = new Set([...src.matchAll(/\.t\(\s*'([a-zA-Z0-9]+)'/g)].map(m => m[1]).concat([...src.matchAll(/t\((?:[^()]*\?\s*)'([a-zA-Z0-9]+)'\s*:\s*'([a-zA-Z0-9]+)'/g)].flatMap(m => [m[1], m[2]])));
  ['title', 'subtitle', 'sub2', 'hint', 'hintTouch', 'foot', 'docTitle', 'rotate', 'rotateSub', 'fullscreen', 'fsExit', 'pauseBtn', 'stats', 'win', 'winSub', 'toMenu', 'more', 'demoTitle', 'soonTitle'].forEach(k => used.add(k));
  ok(used.size >= 25, 'ключей найдено ' + used.size);
  for (const k of used) ok(ru[k] && en[k], 'нет строки ' + k);
  // меню движка: встроенные ключи
  ['play', 'language', 'sound', 'on', 'off', 'pause', 'resume', 'menu', 'tapstart', 'win'].forEach(k => ok(ru[k] && en[k], 'движок: ' + k));
  eq(K.TITLE.en, en.title, 'EN-название — одна константа'); ok(en.foot.includes(K.TITLE.en) && en.docTitle.includes(K.TITLE.en));
});
test('i18n: язык по системе (navigator.language) — ru/be/uk/kk → RU, иначе EN; сохранённый выбор важнее', () => {
  eq(K.pickLang(null, ['ru-RU']), 'ru'); eq(K.pickLang(null, ['uk']), 'ru'); eq(K.pickLang(null, ['en-US', 'ru']), 'en'); eq(K.pickLang(null, ['de-DE']), 'en');
  eq(K.pickLang('ru', ['en-US']), 'ru'); eq(K.pickLang('en', ['ru-RU']), 'en'); eq(K.pickLang('xx', ['fr']), 'en'); eq(K.pickLang(null, []), 'ru');
});
test('i18n: длинные EN-строки помещаются в панели меню (оценка ширины шрифта 17px ≤ 440 логических пикселей)', () => {
  const w = s => [...String(s)].reduce((a, ch) => a + (/[A-ZА-ЯЁMWmw]/.test(ch) ? 11.5 : /[ .,:·'il|!]/.test(ch) ? 4.5 : 9.2), 0);
  for (const L of ['ru', 'en']) {
    const S = K.STR[L];
    [S.play, S.cont + ' · 26 / 26', S.language + ': EN', S.sound + ': ' + S.off, S.inkAnim + ': ' + S.off, S.walk, S.restart, S.menu, S.resume, S.stats, S.toMenu, S.more].forEach(s => ok(w(s) + 20 <= 440, L + ': длинный пункт «' + s + '» ' + Math.round(w(s))));
  }
});
test('статистика: время по сценам, подсказки, ошибки, головоломки; сохраняется локально и продолжается; экспорт — JSON', () => {
  const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const S = K.Stats.create({ store: st }); S.begin(false, { edition: 'demo' });
  const tk = (sec, on) => { for (let i = 0; i < Math.round(sec * 10); i++) S.tick(0.1, on); };
  S.event('scene', { id: 'workshop' }); tk(2, true); tk(5, false); S.event('hint', { how: 'free' }); S.event('error', { kind: 'item' });
  S.event('scene', { id: 'square' }); tk(1.5, true); S.event('hint', { how: 'game' }); S.event('error', { kind: 'combo' }); S.event('look', {}); S.event('puzzle', { id: 'p_well' });
  const m = S.summary(); eq(m.time, 4); eq(m.hints.total, 2); eq(m.hints.free, 1); eq(m.hints.game, 1); eq(m.errors.total, 2); eq(m.solved, 1); eq(m.looks, 1);
  const ws = m.rows.find(r => r.id === 'workshop'); eq(ws.time, 2); eq(ws.hints, 1); eq(ws.errors, 1);
  S.flush(); ok(mem[K.Stats.KEY], 'не сохранилось');
  const S2 = K.Stats.create({ store: st }); S2.begin(true, {}); eq(S2.data().sessions, 2, 'продолжение'); eq(Math.round(S2.data().time), 4);
  S2.event('win', {}); ok(S2.data().finished); const j = JSON.parse(S2.exportJSON({ x: 1 })); ok(j.summary && j.scenes.square && j.extra.x === 1 && j.exported);
  const S3 = K.Stats.create({ store: st }); S3.begin(false, {}); eq(S3.data().time, 0, 'новая игра — новая статистика');
  eq(K.Stats.fmt(75), '1:15');
});
test('статистика: никакой отправки наружу — в оболочке и модулях нет сетевых API', () => {
  for (const f of ['js/stats.js', 'js/main.js', 'js/edition.js', 'js/game.js', 'js/i18n.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8'); ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|navigator\.share|new\s+Image\s*\(/.test(src), f + ': сетевой API');
  }
});
test('игра шлёт события для статистики: ошибка предмета/комбинации/механизма, осмотр, подсказка с типом', () => {
  const { G, ev } = fresh(); const st = G.state(); st.inv.push('rope', 'bread'); st.flags.got_rope = true;
  G.combine('rope', 'bread'); ok(ev.some(e => e.t === 'error' && e.d.kind === 'combo'), 'combo');
  const sl = A.slotRect(0); G.down(sl[0] + 10, sl[1] + 10); G.up(sl[0] + 10, sl[1] + 10); tapHs(G, 'stool'); run(G, 3); ok(ev.some(e => e.t === 'error' && e.d.kind === 'item'), 'item');
  G.look(395, 150); ok(ev.some(e => e.t === 'look'), 'look');
  G.hint(); ok(ev.some(e => e.t === 'hint' && e.d.how === 'free'), 'hint how');
  const { G: G3, ev: ev3 } = fresh(); const s3 = G3.state(); s3.flags.towerOpen = true; s3.scene = 'stairs'; G3.load(G3.serialize()); tapHs(G3, 'chimes'); run(G3, 4);
  const wm = P.widgets.find(x => x.id === 'melody'), wrong = [0, 1, 2, 3, 4].find(i => i !== wm.target[0]), c = WT.melody.center(wm, wrong); G3.down(c.x, c.y); G3.up(c.x, c.y);
  ok(ev3.some(e => e.t === 'error' && e.d.kind === 'mech'), 'mech');
});
test('тач: на маленьком экране промах рядом с зоной попадает в ближайшую зону (pad), мышью — нет; захват предмета — по всей высоте полосы', () => {
  const { G } = fresh(); const h = G.hotspot('stool'), x = h.rect[0] - 10, y = h.rect[1] + h.rect[3] / 2;
  ok(!G.hotspotAt(x, y) || G.hotspotAt(x, y).id !== 'stool', 'точка не должна быть внутри');
  G.down(x, y); G.up(x, y); eq(G.runtime().target && G.runtime().target.hs, null, 'мышь: промах — просто идти');
  G.setTouchPad(16); G.down(x, y); G.up(x, y); eq(G.runtime().target && G.runtime().target.hs, 'stool', 'тач: ближайшая зона');
  G.state().inv.push('rope'); const r0 = A.slotRect(0), I = A.LAYOUT.inv;
  eq(G.slotAt(r0[0] + r0[2] + I.gap / 2 - 1, A.LAYOUT.H - 2), 0, 'тач: промежуток и низ полосы — та же ячейка');
  G.setTouchPad(0); eq(G.slotAt(r0[0] + r0[2] + I.gap / 2 - 1, A.LAYOUT.H - 2), -1, 'мышь: только сама ячейка');
});
test('HiDPI: тема paper принимает масштаб кэшей и бюджет, отдаёт статистику кэша; рисует в любом масштабе', () => {
  const th = THEMES.paper; ok(th.setResolution && th.cacheStats && th.setCacheBudget && th.setQuality, 'нет API масштаба');
  th.setResolution(2); eq(th.resolution(), 2); th.setQuality('low'); const ctx = A.mockCtx(); sandbox.KVEST_STRICT = true;
  try { for (const s of K.SCENES) { const G = K.createGame({}); G.state().scene = s.id; const m = G.model(); th.drawScene(ctx, m.scene, 1, {}); th.drawHero(ctx, m.hero, 'idle', 1); th.drawUI(ctx, m.ui, 1); } }
  finally { sandbox.KVEST_STRICT = false; th.setResolution(1); th.setQuality('high'); }
  const cs = th.cacheStats(); ok(typeof cs.mb === 'number' && typeof cs.px === 'number' && cs.res === 1);
  ok(K.InkSketch.cacheStats && K.InkSketch.setCacheBudget, 'ink: нет статистики кэша');
});
test('подсказки крана и щита: цвет-метки и номера на эскизе совпадают со сценой и решением', () => {
  const pc = P.puzzles.find(p => p.id === 'p_crane'), cr = P.widgets.find(w => w.id === 'crane');
  const lev = pc.ink.filter(q => q.o && /pier\/cl/.test(q.o));
  eq(lev.map(q => q.o.split('/')[1]).join(), 'cl1,cl2,cl3', 'рычаги в порядке сцены');
  lev.forEach(q => { const id = q.o.split('/')[1], o = SC.pier.objects.find(x => x.id === id); eq(q.c, o.state.tint, id + ': цвет'); eq(q.n, cr.order.indexOf(cr.objs.indexOf(id)) + 1, id + ': номер хода'); });
  const pv = P.puzzles.find(p => p.id === 'p_valves'), wv = P.widgets.find(w => w.id === 'valves');
  const flags = wv.objs.map(id => (pv.ink.find(q => q.o === 'boathouse/' + id) || {}).flag);
  eq(flags.reduce((a, f, i) => a + (f === 'up' ? wv.weights[i] : 0), 0), wv.target, 'стрелки ↑ дают цель манометра');
  ok(flags.every(f => f === 'up' || f === 'down'), 'у каждого вентиля стрелка');
  const pp = P.puzzles.find(p => p.id === 'p_pipes'); ok(pp.ink.some(q => q.o === 'boathouse/panel' && q.st && q.st.ok) && pp.ink.some(q => q.o === 'boathouse/spout'), 'щит: «до → после → масло»');
  // вентили не перекрываются в сцене (рукоять до ~30 px влево) и героиня не загораживает их
  const vx = wv.objs.map(id => SC.boathouse.objects.find(o => o.id === id).x); ok(vx[1] - vx[0] >= 44 && vx[2] - vx[1] >= 44, 'вентили тесно');
  wv.hs.forEach(id => ok(SC.boathouse.hotspots.find(h => h.id === id).at < vx[0] - 10, 'героиня встаёт на вентиль ' + id));
});

// ---------- музыка, i18n, правило имён ----------
// ---------- эскизы тушью (подсказки, блокнот, мысли мастера) ----------
const INK = K.InkSketch;
function inkGlyphs(seq) { return (seq || []).filter(q => typeof q !== 'string'); }
test('тушь: у каждой цели главы есть эскиз подсказки — глифы ссылаются на настоящие объекты сцен, цель отмечена', () => {
  const ops = new Set(['>', '+', '=', 'up', '|']);
  for (const p of P.puzzles) {
    ok(Array.isArray(p.ink) && p.ink.length, p.id + ': нет ink');
    const gl = inkGlyphs(p.ink); ok(gl.length >= 1 && gl.some(q => q.mark), p.id + ': нет отмеченной цели (mark)');
    p.ink.filter(q => typeof q === 'string').forEach(q => ok(ops.has(q), p.id + ': знак ' + q));
    for (const q of gl) {
      if (q.i) ok(A.ICONS[q.i], p.id + ': пиктограмма ' + q.i);
      const refs = (q.o ? [q.o] : []).concat(q.g || []);
      refs.forEach(ref => { const [sid, oid] = ref.split('/'); ok(SC[sid] && SC[sid].objects.some(o => o.id === oid), p.id + ': нет объекта ' + ref); });
      if (q.l) { const [sid, kind] = q.l.split('/'); ok(SC[sid].layers.some(L => L.items.some(it => it.kind === kind)), p.id + ': нет элемента слоя ' + q.l); }
      const src = INK.sourceOf(q); ok(src.icon || (src.parts && src.parts.length === refs.length + (q.l ? 1 : 0)), p.id + ': источник глифа');
    }
    // эскиз цели в своей сцене указывает на объект этой сцены (или предмет)
    if (p.scene && p.type !== 'observe') ok(gl.some(q => q.i || (q.o || '').startsWith(p.scene + '/') || (q.g || []).some(r => r.startsWith(p.scene + '/'))), p.id + ': эскиз не про сцену ' + p.scene);
  }
});
test('тушь: подсказка в игре несёт цель и эскиз; рисуется хуком drawHint по всем целям (Node-строгий режим)', () => {
  const ctx = A.mockCtx(), th = THEMES.paper; sandbox.KVEST_STRICT = true;
  try {
    ok(typeof th.drawHint === 'function' && typeof th.drawWalkbook === 'function', 'хуки не подключены');
    const { G } = fresh(); G.hint(); const q = G.model().thoughts[0];
    eq(q.style, 'ink'); eq(q.hint.target, 'p_shelf'); ok(Array.isArray(q.hint.ink));
    for (const p of P.puzzles) for (const here of [true, false]) { th.drawHint(ctx, 300, 320, { target: p.id, scene: p.scene, here, icons: p.hint, ink: p.ink }, 1, { age: 0.7 }); th.drawHint(ctx, 300, 320, { target: p.id, scene: p.scene, here, icons: p.hint, ink: p.ink }, 1, { age: 9 }); }
  } finally { sandbox.KVEST_STRICT = false; }
});
test('тушь: блокнот рисует все шаги главы (каждый разворот, пройденные и текущий) без исключений', () => {
  const ctx = A.mockCtx(), th = THEMES.paper; sandbox.KVEST_STRICT = true;
  try {
    const all = P.puzzles.map((p, i) => ({ id: p.id, scene: p.scene, icons: ['gear'].concat(p.hint), done: i < 25, current: i === 25, open: true, ink: p.ink }));
    const per = A.LAYOUT.walk.per;
    for (let page = 0; page < Math.ceil(all.length / per); page++) for (const flip of [null, { d: 1, t: 0.9 }]) th.drawWalkbook(ctx, { page, pages: 13, per, steps: all, total: all.length, flip, open: 0.5, time: 1 }, A.LAYOUT, 1);
    // и через drawUI в режиме walk по настоящей модели
    const { G } = fresh(); G.openWalk(); th.drawUI(ctx, G.model().ui, 1);
  } finally { sandbox.KVEST_STRICT = false; }
  ok(ctx.calls > 1000);
});
test('тушь: мысли мастера в кат-сцене — style ink (перо), обычные мысли героини — бумага', () => {
  const G = K.createGame({}); G.start(); for (let i = 0; i < 40; i++) G.update(1 / 30);
  const q = G.model().thoughts.find(x => x.who === 'master'); ok(q, 'нет мысли мастера'); eq(q.style, 'ink'); ok(q.age >= 0);
  const ctx = A.mockCtx(); sandbox.KVEST_STRICT = true; try { THEMES.paper.drawThought(ctx, q.x, q.y, q.icons, 1, { style: 'ink', age: q.age }); } finally { sandbox.KVEST_STRICT = false; }
  G.skipCut(); G.look(396, 150); const h = G.model().thoughts.find(x => x.who === 'hero'); ok(h && h.style !== 'ink', 'осмотр — не тушь');
});
test('тушь: переключатель «Анимация штриха» сохраняется (localStorage), по умолчанию — вкл (спокойный режим)', () => {
  delete store[INK.KEY];
  const fresh2 = () => { const sb = { console, Math, JSON, localStorage: sandbox.localStorage }; sb.window = sb; vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/themes/ink-sketch.js'), 'utf8'), sb); return sb.KVEST.InkSketch; };
  eq(fresh2().anim(), true, 'по умолчанию');
  INK.setAnim(false); eq(store[INK.KEY], '0'); eq(fresh2().anim(), false, 'после перезапуска');
  INK.setAnim(true); eq(store[INK.KEY], '1'); eq(fresh2().anim(), true);
  ok(K.STR.ru.inkAnim && K.STR.en.inkAnim, 'строки меню');
});
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

// ---------- спринт 1: реестр глав, сохранения по главам, карта побережья, сцена с двумя состояниями, «Узнать больше» ----------
const CHS = K.Chapters;
test('«Узнать больше»: одно действие — переход в той же вкладке (без window.open, который с noopener всегда даёт null)', () => {
  const loc = { href: 'x' }; let opened = 0; sandbox.open = () => { opened++; return null; };
  eq(ED.goMore(loc), ED.MORE_URL); eq(loc.href, ED.MORE_URL); eq(opened, 0, 'открыта новая вкладка');
  const src = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(!/\.open\s*\(/.test(src.replace(/\/\/.*$/gm, '')), 'в main.js остался вызов window.open'); ok(/goMore\(global\.location\)/.test(src), 'кнопка не через goMore');
  delete sandbox.open;
});
// на собранной полной копии (метка .arcade-full-build у <out>) файлы глав 2+ лежат рядом — это ожидаемо; в публичном дереве их быть не должно
const FULL_BUILD = fs.existsSync(path.join(ROOT, '..', '.arcade-full-build'));
test('реестр глав: демо = только глава 1; файлы полной версии — только id в списке full, самих файлов в публичном дереве нет', () => {
  eq(CHS.files('demo').join(), 'ch1'); ok(CHS.files('full').includes('ch2'), 'ch2 нет в списке full');
  eq(CHS.available('demo').map(c => c.id).join(), 'ch1'); ok(CHS.get('ch1') && CHS.get('ch1').scenes === K.SCENES && CHS.get('ch1').puzzles === P);
  eq(CHS.get('ch2'), null, 'глава 2 в публичной сборке'); eq(CHS.available('full').map(c => c.id).join(), 'ch1', 'без файла главы её нет и в полной');
  for (const id of CHS.files('full')) if (id !== 'ch1') ok(fs.existsSync(path.join(ROOT, 'js/chapters', id + '.js')) === FULL_BUILD, (FULL_BUILD ? 'нет файла главы в полной сборке: ' : 'файл полной версии в публичном дереве: ') + id);
  eq(ED.BUILD, FULL_BUILD ? 'full' : 'demo', 'флаг издания');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); ok(!/chapters\/ch\d/.test(html), 'index.html грузит файл главы напрямую');
  ok(/\['ch1'\]/.test(fs.readFileSync(path.join(ROOT, 'js/chapters/index.js'), 'utf8')), 'демо-список');
  eq(CHS.next('ch1', 'demo'), null); eq(CHS.fromQuery('?chapter=2'), 'ch2'); eq(CHS.fromQuery('?x=1&chapter=ch3'), 'ch3'); eq(CHS.fromQuery('?chapterx'), null);
  const cw = sandbox.console; sandbox.console = { warn() {}, log() {} }; try { eq(CHS.register({ id: 'bad' }), null, 'кривая глава зарегистрировалась'); } finally { sandbox.console = cw; }
});
test('сохранение пилота переносится в главу 1 (прогресс игроков демо не теряется), старый ключ удаляется; новая запись не затирается', () => {
  const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const { G } = fresh(); tapHs(G, 'stool'); run(G, 3); const old = G.serialize(); mem['arcade.save.kvest'] = old;
  ok(CHS.migrate(st)); eq(mem['arcade.save.kvest.ch1'], old, 'не перенесено'); ok(!('arcade.save.kvest' in mem), 'старый ключ остался');
  ok(!CHS.migrate(st), 'повторная миграция'); const G2 = K.createGame({ chapter: CHS.get('ch1') }); ok(G2.load(mem['arcade.save.kvest.ch1']), 'перенесённое не грузится'); ok(G2.state().flags.stoolMoved);
  mem['arcade.save.kvest'] = '{"v":1,"flags":{"x":1},"scene":"workshop","inv":[]}'; CHS.migrate(st); eq(mem['arcade.save.kvest.ch1'], old, 'затёрто более новое сохранение главы 1');
  mem['arcade.save.kvest'] = '{битое'; CHS.migrate(st); ok(!('arcade.save.kvest' in mem) && mem['arcade.save.kvest.ch1'] === old);
  const pr = CHS.progress(st); eq(pr.sel, 'ch1'); eq(pr.done.length, 0); pr.done.push('ch1'); CHS.setProgress(st, pr); eq(CHS.progress(st).done.join(), 'ch1');
  eq(CHS.saveKey('ch2'), 'arcade.save.kvest.ch2');
});
test('сохранение по главам: запись помнит главу; сохранение другой главы не загружается', () => {
  const G = K.createGame({ chapter: CHS.get('ch1') }); G.start(); const o = JSON.parse(G.serialize()); eq(o.ch, 'ch1');
  ok(!K.createGame({ chapter: CHS.get('ch1') }).load(Object.assign({}, o, { ch: 'ch2' })), 'чужая глава загрузилась');
  ok(K.createGame({ chapter: CHS.get('ch1') }).load(Object.assign({}, o, { ch: undefined })), 'сохранение пилота без поля ch');
});

// тестовая глава (данные только для проверки движка): карта из трёх мест, берег с приливом/отливом и таймером, шестерни
const TCH = {
  id: 'ch9', n: 9, title: { ru: 'Проверка', en: 'Check' },
  map: { id: 'tmap', start: 'na', coast: [[0, 0], [960, 0], [960, 300], [0, 360]],
    nodes: [{ id: 'na', scene: 'ta', x: 200, y: 300, icon: 'tide', toX: 60 }, { id: 'nb', scene: 'tb', x: 480, y: 200, icon: 'hut', toX: 60 },
      { id: 'nc', scene: 'tc', x: 760, y: 300, icon: 'rocktower', toX: 60, need: ['p_t1'], lit: 'p_t3' }],
    trails: [{ a: 'na', b: 'nb', pts: [[340, 230]] }, { a: 'nb', b: 'nc', pts: [[620, 230]] }] },
  scenes: [
    { id: 'ta', w: 960, h: 540, mood: 'day', pal: 'morning', icon: 'tide', phase: { flag: 'low', a: 'high', b: 'low' },
      layers: [{ depth: 0, items: [{ kind: 'sky' }, { kind: 'tide', x: 0, y: 300, w: 960, h: 240, state: { low: 400 } }] },
        { depth: 1, items: [{ kind: 'rock', x: 600, y: 420, w: 60, h: 30, seed: 2, phase: 'low' }] }, { depth: 2, items: [{ kind: 'ground', x: 0, y: 452, w: 960, h: 88 }] }],
      objects: [{ id: 'shell', kind: 'item', item: 'shell', x: 500, y: 420, w: 30, h: 30, phase: 'low', show: ['!got_shell'] }, { id: 'post', kind: 'tidepost', x: 100, y: 300, w: 30, h: 150, state: {}, bind: { low: 'low' } }],
      hotspots: [{ id: 'shell', rect: [490, 400, 50, 52], cursor: 'take', at: 515, phase: 'low', need: ['!got_shell'] }, { id: 'post', rect: [96, 300, 40, 150], cursor: 'use', at: 140 },
        { id: 'toMap', rect: [0, 300, 40, 152], cursor: 'go', at: 20, to: 'tmap' }, { id: 'toB', rect: [900, 300, 60, 152], cursor: 'go', at: 930, to: 'tb', toX: 60, phase: 'low' }],
      walk: [[20, 452], [700, 452]], walkPhase: { low: [[20, 452], [940, 452]] }, hero: { x: 100, y: 452 } },
    { id: 'tb', w: 960, h: 540, mood: 'day', icon: 'hut', layers: [{ depth: 0, items: [{ kind: 'sky' }] }, { depth: 2, items: [{ kind: 'ground', x: 0, y: 452, w: 960, h: 88 }] }],
      objects: [{ id: 'g1', kind: 'machine', x: 300, y: 200, w: 80, h: 80, state: { variant: 'gear' } }, { id: 'g2', kind: 'machine', x: 390, y: 200, w: 80, h: 80, state: { variant: 'gear' } },
        { id: 'key', kind: 'item', item: 'key', x: 600, y: 420, w: 30, h: 30, show: ['gearsOk', '!got_key'] }],
      hotspots: [{ id: 'g1', rect: [300, 200, 80, 80], cursor: 'use', at: 340 }, { id: 'g2', rect: [390, 200, 80, 80], cursor: 'use', at: 430 },
        { id: 'key', rect: [590, 410, 50, 42], cursor: 'take', at: 615, need: ['gearsOk', '!got_key'] },
        { id: 'toA', rect: [0, 300, 40, 152], cursor: 'go', at: 20, to: 'ta', toX: 680 }, { id: 'toMap', rect: [920, 300, 40, 152], cursor: 'go', at: 940, to: 'tmap' }],
      walk: [[20, 452], [940, 452]], hero: { x: 80, y: 452 } },
    { id: 'tc', w: 960, h: 540, mood: 'dusk', icon: 'rocktower', layers: [{ depth: 0, items: [{ kind: 'sky' }] }],
      objects: [{ id: 'fire', kind: 'beacon', x: 500, y: 300, w: 80, h: 150, state: { variant: 'brazier' }, bind: { lit: 'won', fuel: 'won' } }],
      hotspots: [{ id: 'fire', rect: [500, 300, 80, 150], cursor: 'use', at: 540 }, { id: 'toMap', rect: [0, 300, 40, 152], cursor: 'go', at: 20, to: 'tmap' }],
      walk: [[20, 452], [940, 452]], hero: { x: 80, y: 452 } }
  ],
  puzzles: { start: { scene: 'ta', flags: {}, inv: [] }, goal: 'won', items: ['shell', 'key'],
    timers: [{ flag: 'low', every: 12, where: ['ta'] }],
    rules: [{ scene: 'ta', hs: 'shell', do: [['give', 'shell'], ['set', 'got_shell']], puzzle: 'p_t1' }, { scene: 'ta', hs: 'post', do: [['toggle', 'low']] },
      { scene: 'tb', hs: 'key', do: [['give', 'key'], ['set', 'got_key']] }, { scene: 'tc', hs: 'fire', item: 'key', do: [['take', 'key'], ['win']], puzzle: 'p_t3' }],
    combos: [], enter: [], autos: [], cuts: {},
    widgets: [{ id: 'gears', type: 'gears', scene: 'tb', hs: ['g1', 'g2'], objs: ['g1', 'g2'], m: 4, links: [[1], [0]], start: [0, 0], target: [2, 2], onSolve: [['set', 'gearsOk']], puzzle: 'p_t2' }],
    puzzles: [{ id: 'p_t1', scene: 'ta', type: 'item', hint: ['low', 'shell'] }, { id: 'p_t2', scene: 'tb', type: 'mech', hint: ['gearwheel'] }, { id: 'p_t3', scene: 'tc', type: 'item', hint: ['key'] }] }
};
const TC = CHS.register(TCH);
test('тестовая глава регистрируется; карта — сцена главы; демо её не видит (только id из списков изданий)', () => {
  ok(TC && TC.scenes.some(s => s.map && s.id === 'tmap'), 'карты нет среди сцен'); eq(CHS.available('demo').map(c => c.id).join(), 'ch1');
});
test('сцена с двумя состояниями: зоны, объекты, элементы слоёв и полоса ходьбы по фазе; смена — рычагом и таймером; уровень воды анимируется', () => {
  const ev = [], G = K.createGame({ chapter: TC, onEvent: (t, d) => ev.push({ t, d }) }); G.start();
  let m = G.model(); eq(m.scene.phase, 'high'); eq(m.scene.phaseMix, 0); ok(!G.hotspot('shell') && !G.hotspot('toB'), 'зоны отлива в прилив');
  ok(!m.scene.objects.some(o => o.id === 'shell'), 'объект отлива в прилив'); ok(!m.scene.layers[1].items.length, 'камень отлива в слое');
  eq(JSON.stringify(m.scene.walk), JSON.stringify(TC.scenes[0].walk)); eq(m.scene.objects.find(o => o.id === 'post').state.low, false);
  const L1 = m.scene.layers;
  tapHs(G, 'post'); run(G, 3); ok(G.state().flags.low, 'вешка не сменила фазу'); ok(ev.some(e => e.t === 'phase' && e.d.phase === 'low'));
  m = G.model(); eq(m.scene.phase, 'low'); ok(m.scene.phaseMix > 0, 'уровень не движется'); ok(G.hotspot('shell') && G.hotspot('toB')); eq(m.scene.walk[1][0], 940);
  ok(m.scene.layers[1].items.length === 1 && m.scene.layers !== L1, 'слой отлива'); ok(K.Coast.layersOf(TC.scenes[0], 'low') === m.scene.layers, 'массив слоёв фазы неустойчив (кэш темы)');
  run(G, 2); eq(G.model().scene.phaseMix, 1);
  // героиня у дальнего края в отлив; прилив — полоса короче, она отходит к берегу
  G.down(880, 300); G.up(880, 300); run(G, 6); eq(G.state().scene, 'ta'); ok(G.runtime().hero.x > 870, 'x ' + G.runtime().hero.x);
  G.state().tt.low = 11.95; run(G, 0.2); ok(!G.state().flags.low, 'таймер не вернул прилив'); ok(ev.some(e => e.t === 'timer'));
  run(G, 6); ok(G.runtime().hero.x <= 700.5, 'не отошла от воды: ' + G.runtime().hero.x);
  // таймер идёт только в своих сценах
  const G2 = K.createGame({ chapter: TC }); G2.start(); G2.state().scene = 'tb'; run(G2, 20); ok(!G2.state().flags.low, 'таймер в чужой сцене');
  const G3 = K.createGame({ chapter: TC, timers: false }); G3.start(); run(G3, 30); ok(!G3.state().flags.low, 'timers:false'); ok(G3.waitTimer('low')); run(G3, 0.1); ok(G3.state().flags.low, 'waitTimer');
});
test('карта побережья: открыты места, связанные открытыми тропами; фишка идёт по тропе и входит в сцену; закрытое место — «?»', () => {
  const M = TCH.map, st0 = { flags: {}, inv: [] };
  eq(Object.keys(K.Coast.reach(M, st0)).sort().join(), 'na,nb'); eq(K.Coast.hotspots(M, st0).map(h => h.to).join(), 'ta,tb');
  const st1 = { flags: { p_t1: true }, inv: [] }; eq(Object.keys(K.Coast.reach(M, st1)).sort().join(), 'na,nb,nc');
  const pth = K.Coast.path(M, st1, 'na', 'nc'); eq(JSON.stringify(pth), JSON.stringify([[200, 300], [340, 230], [480, 200], [620, 230], [760, 300]]));
  eq(JSON.stringify(K.Coast.path(M, st1, 'nc', 'na')), JSON.stringify(pth.slice().reverse()));
  const G = K.createGame({ chapter: TC }); G.start(); tapHs(G, 'toMap'); run(G, 3); eq(G.state().scene, 'tmap'); eq(G.state().mapAt, 'na');
  let m = G.model(); ok(!m.showHero, 'героиня на карте'); const nc = m.scene.objects.find(o => o.id === 'n_nc'); eq(nc.state.open, false); eq(nc.state.icon, 'question');
  ok(m.scene.objects.some(o => o.kind === 'maptoken') && m.scene.objects.filter(o => o.kind === 'trail').length === 2);
  ok(m.scene.objects.find(o => o.id === 'n_na').state.here); ok(!G.hotspot('n_nc'), 'закрытое место кликабельно');
  tapHs(G, 'n_nb'); ok(G.busy(), 'фишка не пошла'); run(G, 0.3); eq(G.state().scene, 'tmap'); const tk = G.runtime().token; ok(tk.x > 200 && tk.y < 300, 'фишка не на тропе');
  run(G, 4); eq(G.state().scene, 'tb'); eq(G.state().mapAt, 'nb'); eq(G.runtime().hero.x, 60);
  tapHs(G, 'toMap'); run(G, 7); eq(G.state().scene, 'tmap'); eq(G.state().mapAt, 'nb', 'фишка не у места, откуда пришли');
  const json = G.serialize(); const G2 = K.createGame({ chapter: TC }); ok(G2.load(json)); eq(G2.state().mapAt, 'nb'); eq(G2.runtime().token.x, 480);
});
test('шестерни (новый механизм): клик крутит шестерню вперёд, сцепленную — назад; решаемы из любого состояния', () => {
  const w = TCH.puzzles.widgets[0], T = WT.gears, L = T.init(w); T.act(w, L, 0); eq(L.s.join(), '1,3'); ok(!T.solved(w, L));
  const sol = solveWidget(K, w, T.init(w)); ok(sol && sol.length, 'нет решения'); const all = widgetReach(K, w, T.init(w)); ok(all.every(s => T.solved(w, s) || solveWidget(K, w, s)), 'тупик шестерён');
  const v = T.view(w, L); ok(v.g1.rot === 0.25 && v.g1.mark === 0.5 && v.g1.ok === false && v.g2.solved === false);
});
test('поиск по тестовой главе: финал достижим, тупиков нет (в т.ч. по положению: из любой сцены можно вернуться), таймер — переход «подождать»', () => {
  const S = makeSolver(K, TC), E = S.explore(); ok(E.goals.length, 'финал'); eq(E.dead.length, 0, 'тупики');
  ok(E.plan.some(a => (a.kind === 'timer') || (a.kind === 'hs' && a.hs === 'post')), 'в плане нет смены прилива');
  for (const n of E.list) eq(S.positionSafe(n.st).join(), '', 'застрять можно в');
  ok(S.successors(S.start()).some(x => x.act.kind === 'timer'), 'нет перехода «подождать»');
});
test('бот проходит тестовую главу: прилив/отлив, шестерни, карта (фишка по тропе), финал', () => {
  const r = playChapter(K, { chapter: TC }); ok(r.won, 'не прошёл'); eq(r.solved, r.total, 'не решены: ' + r.missing.join(','));
});
for (const id of ['grey', 'paper']) test('тема ' + id + ': новые kind движка глав рисуются в обеих фазах и на карте (строгий режим)', () => {
  const ctx = A.mockCtx(), th = THEMES[id]; sandbox.KVEST_STRICT = true;
  try {
    const G = K.createGame({ chapter: TC }); G.start();
    for (const flags of [{}, { low: true }, { low: true, p_t1: true, won: true }]) for (const s of TC.scenes) {
      G.load({ v: 1, scene: s.id, flags: Object.assign({}, flags), inv: [], mapAt: 'nb' }); for (const tt of [0, 0.7, 3]) { run(G, tt); const m = G.model(); th.drawScene(ctx, m.scene, 1 + tt, { hover: { x: 480, y: 200, kind: 'go' }, light: m.light }); if (m.showHero) th.drawHero(ctx, m.hero, 'idle', 1); th.drawUI(ctx, m.ui, 1); }
    }
    ['map', 'tide', 'low', 'high', 'dog', 'crab', 'gearwheel', 'salt', 'embers'].forEach(ic => { th.drawIcon(ctx, ic, 100, 100, 40); ok(A.ICONS[ic], 'нет в словаре: ' + ic); });
  } finally { sandbox.KVEST_STRICT = false; }
  ok(ctx.calls > 500);
});
test('контракт: новые kind описаны в theme-api (tide, mapsheet, trail, mapnode, maptoken, beacon, saltpan, sluice, boat, tidepost)', () => {
  ['tide', 'mapsheet', 'trail', 'mapnode', 'maptoken', 'beacon', 'saltpan', 'sluice', 'boat', 'tidepost'].forEach(k => ok(A.isKind(k), k));
  ok(/fisher \| dog \| crab/.test(A.KINDS.npc) && /clockwork/.test(A.KINDS.machine) && /rack/.test(A.KINDS.fence));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
