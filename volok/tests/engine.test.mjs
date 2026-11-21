/* ВОЛОК · tests/engine.test.mjs — автотесты логики, музыки, страницы и правила имён (Node, без зависимостей).
   Запуск: node volok/tests/engine.test.mjs   (QUICK=1 — без долгих прогонов бота). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { playVolok, mulberry32 } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const box = { console, Math, JSON, Array, Object };
box.window = box; box.globalThis = box; vm.createContext(box);
for (const f of ['js/game.js', 'js/meta.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box, { filename: f });
const V = box.VOLOK, L = V.logic, ST = L.ST, OBI = L.OBI;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e){ failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error((m || '') + ' ждали ' + B + ', получили ' + A); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// ---------- помощники ----------
const DT = 1 / 60;
function mk(snap, ev){ const log = []; const g = V.Game({ rng: mulberry32(7), snapshot: snap, onEvent: (t, d) => { log.push(t); if (ev) ev(t, d); } }).start(); g.log = log; return g; }
function run(g, sec, fn){ for (let i = 0; i < sec * 60; i++){ if (fn && fn(g.state()) === false) break; g.update(DT); } }
// провести героя к станции/точке тапом (goTo) и дождаться, пока он закончит дело
function act(g, id, maxSec = 20){ g.goTo(id); run(g, maxSec, s => !!s.hero.auto); }
function walkTo(g, f, x, maxSec = 15){ g.goToSpot(f, x); run(g, maxSec, s => !!s.hero.auto); }
function at(x, extra = {}){ // снимок «машина стоит в точке x», препятствия до неё пройдены
  const sn = { mx: x, water: x > L.SHORE_X, prog: { barrier: 0, rubble: 0, floatsWood: 0, floats: 0, launch: 0 }, solved: {}, breaks: {}, taken: {}, bunker: [], F: 60, P: 60 };
  L.OB.forEach(o => { if (o.x < x - 10) { sn.solved[o.id] = 1; if (o.need) sn.prog[o.id] = o.need; } });
  if (sn.water) Object.assign(sn.prog, { floatsWood: 2, floats: 100, launch: 100 });
  L.BREAKS.forEach((b, i) => { if (b < x + 2000) sn.breaks[i] = 1; });
  return Object.assign(sn, extra);
}
function setMode(g, m){ let n = 0; while (g.state().mode !== m && n++ < 4) act(g, 'lever'); }

// ---------- Котёл: давление / топливо / скорость ----------
test('котёл: огонь поднимает давление, без топлива давление падает до нуля', () => {
  const g = mk(at(2000, { F: 60, P: 30 })); const s = g.state();
  run(g, 5); ok(s.P > 45, 'давление не растёт: ' + s.P);
  s.F = 0; s.mode = 2; run(g, 40); ok(s.P < 5, 'давление без топки не падает: ' + s.P);
});
test('котёл: топливо сгорает, на ходу быстрее, чем на стоянке', () => {
  const a = mk(at(2000, { F: 60 })), b = mk(at(2000, { F: 60 }));
  b.state().mode = 2; run(a, 10); run(b, 10);
  ok(a.state().F < 60 && b.state().F < a.state().F, 'расход: стоянка ' + a.state().F + ', ход ' + b.state().F);
});
test('ход: скорость растёт с режимом; режим 2 быстрее режима 1; тормоз держит на месте', () => {
  const v = m => { const g = mk(at(3000, { F: 90, P: 70 })); g.state().mode = m; run(g, 30, s => { s.F = 90; }); return g.state().v; };
  const v0 = v(0), v1 = v(1), v2 = v(2);
  ok(Math.abs(v0) < 0.5, 'тормоз: ' + v0); ok(v1 > 15 && v2 > v1 + 10, 'скорости: ' + v1.toFixed(1) + ' / ' + v2.toFixed(1));
});
test('ход: давление ниже 60 ослабляет тягу (меньше пара — медленнее)', () => {
  const g1 = mk(at(3000)), g2 = mk(at(3000));
  g1.state().mode = 2; g2.state().mode = 2;
  run(g1, 20, s => { s.P = 70; s.F = 60; }); run(g2, 20, s => { s.P = 25; s.F = 60; });
  ok(g2.state().v < g1.state().v * 0.6, g2.state().v + ' vs ' + g1.state().v);
});
test('перегрев → пожар: давление ≥ 100 дольше 2.5 с зажигает топку, пожар портит корпус', () => {
  const g = mk(at(2000, { F: 100, P: 99 })); const s = g.state();
  run(g, 6, s2 => { s2.F = 100; if (!s2.fires.length) s2.P = Math.max(s2.P, 100.5); return !s2.fires.length; });
  ok(s.fires.length === 1 && g.log.includes('overheat'), 'пожара нет'); eq(s.fires[0].at, 'furnace');
  const h0 = s.hull; run(g, 4); ok(s.hull < h0 - 4, 'корпус не страдает: ' + s.hull);
});
test('пожар тушится: герой держит действие у огня; пожар без присмотра перекидывается', () => {
  const g = mk(at(2000, { F: 40, P: 40 })); const s = g.state();
  run(g, 0.1); s.fires.push({ at: 'furnace', f: 0, x: ST.furnace.x + 14, t: 1.4 });
  run(g, 15); ok(s.fires.length >= 2, 'не перекинулся: ' + s.fires.length);
  while (s.fires.length) { const f = s.fires[0]; walkTo(g, f.f, f.x); }
  eq(s.fires.length, 0); ok(g.log.includes('extinguish'));
});
test('авария: корпус 0 → откат на последний чекпоинт с починенной избой', () => {
  const g = mk(at(5000)); const s0 = g.state(); s0.mode = 2; run(g, 1);
  const cpX = s0.cp.mx; s0.hull = 0.01; s0.fires.push({ at: 'bench', f: 1, x: 80, t: 1.4 }); run(g, 1);
  const s = g.state(); ok(g.log.includes('wreck'), 'нет аварии'); ok(s.hull >= 60 && Math.abs(s.mx - cpX) < 1 && !s.fires.length, JSON.stringify({ hull: s.hull, mx: s.mx, cpX }));
});
test('течь: давление уходит; заплатка с верстака закрывает течь', () => {
  const g = mk(at(2000, { F: 60, P: 60 })); const s = g.state(); run(g, 0.1);
  s.leaks.push({ f: 0, x: 210, t: 0 }); const p0 = s.P; run(g, 3); const leakDrop = p0 - s.P;
  const g2 = mk(at(2000, { F: 60, P: 60 })); run(g2, 3.1); ok(leakDrop > (60 - g2.state().P) + 5, 'течь не тратит пар');
  act(g, 'bench'); eq(s.hero.carry, 'patch', 'нет заплатки');
  walkTo(g, 0, 210); eq(s.leaks.length, 0, 'течь осталась'); eq(s.hero.carry, null);
});

// ---------- Герой ----------
test('герой: ходит, лезет по лестнице с низа на чердак и обратно; не выходит за срез', () => {
  const g = mk(at(2000)); const s = g.state(), h = s.hero;
  g.setInput(-1, 0, false); run(g, 5); ok(h.x <= L.FB[0][0] + 0.01, 'граница: ' + h.x); g.setInput(0, 0, false);
  walkTo(g, 2, 220); ok(h.lv === 2 && Math.abs(h.x - 220) < 8, 'чердак: ' + h.lv + ' ' + h.x);
  walkTo(g, 0, 300); ok(h.lv === 0 && Math.abs(h.x - 300) < 8, 'низ: ' + h.lv + ' ' + h.x);
  // клавишами: к лестнице, вверх
  const l = L.LADDERS[0]; walkTo(g, 0, l.x); g.setInput(0, -1, false); run(g, 3); g.setInput(0, 0, false); eq(h.lv, 1, 'клавиша вверх');
});
test('герой: бункер ↔ топка — взять полено, бросить в топку (огонь +), рычаг хода по кругу, парус вверх/вниз', () => {
  const g = mk(at(2000, { bunker: ['coal', 'wood'], F: 20 })); const s = g.state();
  act(g, 'bunker'); eq(s.hero.carry, 'wood'); eq(s.bunker.length, 1);
  const f0 = s.F; act(g, 'furnace'); eq(s.hero.carry, null); ok(s.F > f0 + 20, 'огонь: ' + s.F);
  const modes = []; for (let i = 0; i < 3; i++) { act(g, 'lever'); modes.push(s.mode); } eq(modes, [1, 2, 0]);
  act(g, 'sail'); eq(s.sailUp, true); act(g, 'sail'); eq(s.sailUp, false);
  act(g, 'bunker'); act(g, 'bunker'); eq(s.bunker, ['coal'], 'положить обратно');
});
test('кучи: взять топливо через люк можно, только когда изба почти стоит рядом с кучей', () => {
  const g = mk(at(3000)); const s = g.state(), piles = g.piles;
  const i = piles.findIndex(p => !p.water && p.x > 3000); const p = piles[i];
  s.mx = p.x - ST.hatch.x + L.MW; s.v = 30; s.mode = 2;                     // мчимся мимо
  walkTo(g, 0, ST.hatch.x); g.setInput(0, 0, true); run(g, 0.1); g.setInput(0, 0, false); ok(!s.hero.carry, 'на ходу взять нельзя');
  s.mx = p.x - ST.hatch.x + L.MW; s.v = 0; s.mode = 0;
  act(g, 'hatch'); eq(s.hero.carry, p.type); eq(s.taken[i], 1);
});
test('тап по месту: goTo доводит героя до станции на другом этаже и выполняет действие', () => {
  const g = mk(at(2000)); const s = g.state(); s.hero.lv = 2; s.hero.x = 200;
  act(g, 'lever'); eq(s.mode, 1); eq(s.hero.lv, 0);
});

// ---------- Препятствия-головоломки ----------
function approach(g, maxSec = 200, until){ setMode(g, 1); run(g, maxSec, s => { s.F = Math.max(s.F, 60); return !(until(s)); }); }
test('шлагбаум: изба упирается носом, лебёдка поднимает шлагбаум, путь свободен (чекпоинт)', () => {
  const o = OBI.barrier, g = mk(at(o.x - 900)); const s = g.state();
  approach(g, 120, s2 => g.activeGate() && Math.abs(s2.v) < 1 && s2.mx > o.x - 10);
  ok(s.mx <= o.x && s.mx > o.x - 8, 'не упёрлась: ' + s.mx); const h0 = s.hull;
  act(g, 'winch', 30); ok(s.prog.barrier >= o.need, 'шлагбаум не поднят'); ok(s.hull >= h0 - 0.01);
  setMode(g, 2); run(g, 40, s2 => { s2.F = 70; return !s2.solved.barrier; }); ok(s.solved.barrier && g.log.includes('checkpoint'), 'не проехали');
});
test('подъём в гору: без паруса и в режиме 1 изба скатывается; с парусом по ветру и полным паром — въезжает', () => {
  const H = L.HILL, top = H.x + H.ramp + H.steep + 60;
  const g1 = mk(at(H.x - 300, { F: 90, P: 70 })); g1.state().mode = 1;
  run(g1, 90, s => { s.F = 90; }); ok(g1.state().mx < top, 'въехала без пара: ' + g1.state().mx);
  const g2 = mk(at(H.x - 300, { F: 90, P: 70 })); act(g2, 'sail'); setMode(g2, 2);
  run(g2, 120, s => { s.F = Math.max(s.F, 70); if (s.P > 97) s.P = 90; return s.mx < top + L.MW; });
  ok(g2.state().mx >= top + L.MW, 'не въехала: ' + g2.state().mx);
});
test('подъём: «форсаж» — давление выше 85 даёт лишнюю тягу и вытягивает крутизну даже без паруса', () => {
  const H = L.HILL, top = H.x + H.ramp + H.steep + 60;
  const g = mk(at(H.x - 300, { F: 90, P: 92 })); setMode(g, 2);
  run(g, 150, s => { s.F = 100; s.P = Math.min(Math.max(s.P, 88), 96); return s.mx < top + L.MW; });
  ok(g.state().mx >= top + L.MW, 'форсаж не тянет: ' + g.state().mx);
});
test('завал: лебёдка только на пару (давление ≥ 30) — без пара не тянет; с паром разбирает', () => {
  const o = OBI.rubble, g = mk(at(o.x - 600, { F: 60, P: 60 })); const s = g.state();
  approach(g, 120, s2 => g.activeGate() && Math.abs(s2.v) < 1 && s2.mx > o.x - 10);
  s.P = 10; s.F = 0; walkTo(g, 1, ST.winch.x); g.setInput(0, 0, true); run(g, 3); g.setInput(0, 0, false); ok(s.prog.rubble === 0, 'тянет без пара: ' + s.prog.rubble);
  s.F = 80; s.P = 70; act(g, 'winch', 30); ok(s.prog.rubble >= o.need, 'завал не разобран');
});
test('брод: тихо (≤ 30) — без последствий; с разгону — вода плеснула в топку (огонь −, течь)', () => {
  const o = OBI.ford;
  const slow = mk(at(o.x - 600, { F: 80, P: 70 })); setMode(slow, 1);
  run(slow, 120, s => { s.F = Math.max(s.F, 60); if (s.v > 24) s.mode = 0; else if (s.mode === 0) s.mode = 1; return s.mx - L.MW < o.x2 + 20; });
  ok(!slow.log.includes('splash') && slow.state().solved.ford, 'тихо — плеснуло');
  const fast = mk(at(o.x - 1200, { F: 80, P: 70 })); setMode(fast, 2);
  run(fast, 120, s => { s.F = Math.max(s.F, 60); return s.mx - L.MW < o.x2 + 20; });
  ok(fast.log.includes('splash') && fast.log.includes('leak'), 'с разгону не плеснуло');
});
test('берег → вода: 2 полена на верстак, собрать поплавки, лебёдкой спустить — изба становится судном', () => {
  const g = mk(at(L.SHORE_X - 700, { F: 70, P: 70 })); const s = g.state();
  approach(g, 120, s2 => g.activeGate() && Math.abs(s2.v) < 1);
  ok(!s.water && s.mx > L.SHORE_X - 8, 'не у кромки'); setMode(g, 0);
  act(g, 'winch'); eq(s.water, false, 'без поплавков спустить нельзя');
  for (let i = 0; i < 2; i++){ act(g, 'hatch'); eq(s.hero.carry, 'wood', 'дрова у берега'); act(g, 'bench'); }
  eq(s.prog.floatsWood, 2); act(g, 'bench'); eq(s.prog.floats, 100, 'поплавки');
  act(g, 'winch'); ok(s.water && g.log.includes('launch'), 'не спустились');
  setMode(g, 2); run(g, 60, s2 => { s2.F = 70; return !s2.solved.shore; }); ok(s.solved.shore, 'не отошли от берега');
});
test('шторм: парус вверх → мачту ломает (корпус −); парус убран — шторм проходится', () => {
  const o = OBI.storm;
  const g1 = mk(at(o.x + 200)); const s1 = g1.state(); act(g1, 'sail'); run(g1, 6); ok(s1.mastBroken && !s1.sailUp && g1.log.includes('mast'), 'мачта цела');
  const g2 = mk(at(o.x - 300, { F: 80, P: 70 })); const s2 = g2.state(); setMode(g2, 2);
  run(g2, 600, s => { s.F = Math.max(s.F, 60); s.leaks.length = 0; return s.mx - L.MW < o.x2; });
  ok(s2.mx - L.MW >= o.x2 && !s2.mastBroken, 'шторм не пройден: ' + s2.mx);
});
test('мачта: заплаткой чинится после шторма', () => {
  const g = mk(at(OBI.storm.x2 + 800)); const s = g.state(); s.mastBroken = true;
  act(g, 'bench'); eq(s.hero.carry, 'patch'); act(g, 'sail'); ok(!s.mastBroken && !s.hero.carry, 'не починена'); act(g, 'sail'); ok(s.sailUp);
});
test('льды: на поверхности льдина не пускает; колокол (балласт) — проходим подо льдом, воздух тратится и пополняется в полынье', () => {
  const sh = OBI.ice.sheets[0], g = mk(at(sh[0] - 500, { F: 70, P: 70 })); const s = g.state(); setMode(g, 2);
  run(g, 40, s2 => { s2.F = 70; return Math.abs(s2.v) > 1 || s2.mx < sh[0] - 10; });
  ok(s.mx <= sh[0] && s.mx > sh[0] - 8, 'проехали по льду: ' + s.mx);
  act(g, 'ballast'); ok(s.dive); run(g, 4); ok(s.depth > 0.8, 'не погрузились');
  run(g, 200, s2 => { s2.F = 70; return !g.underIce(); }); ok(g.underIce(), 'не зашли под лёд');
  const a0 = s.air; run(g, 5); ok(s.air < a0 - 4, 'воздух не тратится');
  act(g, 'ballast'); ok(s.dive, 'подо льдом всплыть нельзя'); ok(g.log.includes('nope'));
  run(g, 200, s2 => { s2.F = 70; return g.underIce(); });
  act(g, 'ballast'); run(g, 4); ok(s.depth < 0.2 && s.air > 90, 'полынья: глубина ' + s.depth.toFixed(2) + ', воздух ' + s.air.toFixed(0));
});
test('льды: кончился воздух подо льдом — топка гаснет, корпус страдает', () => {
  const sh = OBI.ice.sheets[1], g = mk(at(sh[0] + 300, { F: 70, P: 70 })); const s = g.state();
  s.dive = true; s.depth = 1; s.air = 3; s.mode = 0; run(g, 4);
  ok(s.F === 0 && g.log.includes('choke'), 'топка горит'); ok(s.hull < 100);
});
test('чекпоинт перед льдами: восстановление подо льдом ставит избу перед первой льдиной', () => {
  const g = mk(at(OBI.ice.sheets[1][0] + 100)); ok(g.state().mx < OBI.ice.sheets[0][0], 'не перед льдами: ' + g.state().mx);
});
test('финал: доехали до зимовья — финальная сцена и победа', () => {
  const g = mk(at(L.FIN_X - 400, { F: 80, P: 70 })); setMode(g, 2);
  run(g, 60, s => { s.F = 80; return s.phase !== 'won'; });
  ok(g.state().phase === 'won' && g.log.includes('finale') && g.log.includes('win'));
});

// ---------- Сохранение ----------
test('сохранение: snapshot → JSON → restore возвращает путь, решённое, бункер; события checkpoint несут снимок', () => {
  const saves = []; const g = mk(at(OBI.barrier.x + 600, { bunker: ['coal', 'wood'] }), (t, d) => { if (t === 'checkpoint') saves.push(d.save); });
  g.state().mode = 2; run(g, 120, s => { s.F = 70; return s.sec === 0; });
  ok(saves.length >= 1 && saves[saves.length - 1].why === 'sec1', 'чекпоинт участка: ' + saves.map(x => x.why));
  const sn = JSON.parse(JSON.stringify(saves[saves.length - 1]));
  const g2 = mk(sn); const s2 = g2.state();
  ok(Math.abs(s2.mx - sn.mx) < 1 && s2.solved.barrier && s2.sec === 1, 'восстановлено: ' + JSON.stringify({ mx: s2.mx, sec: s2.sec }));
  eq(s2.prog.barrier, OBI.barrier.need); ok(s2.bunker.length === sn.bunker.length);
});
test('сохранение: на воде снимок помнит переделку в судно', () => {
  const g = mk(at(33000)); const sn = JSON.parse(JSON.stringify(g.snapshot())); const g2 = mk(sn);
  ok(g2.state().water && g2.state().prog.floats === 100);
});

// ---------- Путь, окружение ----------
test('путь: 6 участков, 7 препятствий по участкам, финал в последнем; погода и время суток меняются', () => {
  eq(L.SEC.length, 7); ok(L.FIN_X > L.SEC[5] && L.FIN_X < L.SEC[6]);
  const secs = L.OB.map(o => L.secOf(o.x)); eq(secs, [0, 1, 1, 2, 3, 4, 5]);
  const ws = new Set(), tods = []; for (let i = 0; i < 6; i++){ const e = L.env((L.SEC[i] + L.SEC[i + 1]) / 2, 0); ws.add(e.weather); tods.push(e.tod.toFixed(2)); }
  ok(ws.size === 6, 'погода: ' + [...ws]); ok(new Set(tods).size === 6, 'время суток: ' + tods);
  ok(L.env(OBI.storm.x + 500, 0).wind < -0.6 && L.env(OBI.storm.x + 500, 0).storm > 0.9, 'шторм — встречный ветер');
  ok(L.makePiles().length >= 35, 'куч топлива: ' + L.makePiles().length);
});
test('узнаваемость: герой не в красном, изба в охре/меди (не красно-серая)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/render.js'), 'utf8');
  const box2 = { console, Math, JSON }; box2.window = box2; box2.globalThis = box2; vm.createContext(box2); vm.runInContext(src, box2);
  for (const th of ['modern', 'retro']){ const P = box2.VOLOK.render.PAL[th];
    const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); const [r, g, b] = rgb(P.shirt);
    ok(b > r && b > g, th + ': рубаха не синяя ' + P.shirt); const [wr, wg, wb] = rgb(P.wood); ok(wr > wg && wg > wb && wr - wb > 80, th + ': сруб не охристый ' + P.wood); }
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; ключи меню движка; названия', () => {
  eq(Object.keys(V.STR.ru).sort(), Object.keys(V.STR.en).sort());
  for (const k in V.STR.ru) ok(String(V.STR.ru[k]).trim() && String(V.STR.en[k]).trim(), 'пусто: ' + k);
  ['play', 'cont', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'best', 'score', 'title', 'subtitle', 'tapstart'].forEach(k => ok(V.STR.ru[k], 'ключ ' + k));
  eq(V.STR.ru.title, 'ВОЛОК'); eq(V.STR.en.title, 'KETTLEWAKE');
});
// музыка — как в _shared/tests/music.test.mjs: фейковый AudioContext, трек играет и планирует ноты
function musicEnv(){
  const listeners = {}, timers = [];
  function param(v){ return { value: v, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(x){ if (!(x > 0)) throw new Error('exp ≤0'); }, setTargetAtTime(){} }; }
  function node(){ return { connect(){}, disconnect(){}, start(){}, stop(){}, frequency: param(440), detune: param(0), gain: param(1), Q: param(1), type: '' }; }
  class AC { constructor(){ this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; } createOscillator(){ return node(); } createGain(){ return node(); } createBiquadFilter(){ return node(); } createBufferSource(){ return node(); } createBuffer(c, len){ return { getChannelData: () => new Float32Array(len) }; } resume(){} suspend(){} }
  const win = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt,
    localStorage: { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k, v){ this._d[k] = String(v); } },
    addEventListener(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); }, setInterval(fn){ timers.push(fn); return timers.length; }, clearInterval(id){ timers[id - 1] = null; },
    setTimeout(){ return 0; }, requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){}, performance: { now: () => 0 }, AudioContext: AC };
  const canvas = { width: 100, height: 100, style: {}, addEventListener(){}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener(){}, hidden: false }; win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), win);
  return { win, fire: ev => (listeners[ev] || []).forEach(f => f({ code: 'Enter', preventDefault(){} })), tick: (ac, dt) => { ac.currentTime += dt; timers.forEach(t => t && t()); } };
}
test('музыка: трек volok и все 7 тем участков — 8–16 тактов, ноты в диапазоне, трек играет (>30 нот в окне, без ошибок)', () => {
  const env = musicEnv(), A = env.win.Arcade;
  ok(A.tracks.volok && A.volokTracks.length === 7 && A.tracks.volok === A.volokTracks[0], 'треки');
  A.volokTracks.forEach((tr, i) => { const c = A.parseTrack(tr), perBar = c.div * 4, bars = c.melody.length / perBar;
    ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тема ' + (i + 1) + ': тактов ' + bars);
    ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'тема ' + (i + 1) + ': голоса не кратны мелодии');
    [c.melody, c.bass].forEach(v => v.forEach(n => { if (n) ok(n.f > 40 && n.f < 2200, 'нота ' + n.f); })); });
  const g = A.createGame({ canvas: '#c', gameId: 'volok' }); g.useStandardScreens(); g.scene('play', {}); g.goto('play'); env.fire('keydown');
  const ac = g.audio.ac; for (let i = 0; i < 200; i++) env.tick(ac, 0.05);   // окно 10 с, как в _shared/tests/music.test.mjs
  ok(g.audio.music.stats.scheduled > 30 && g.audio.music.stats.errors === 0, JSON.stringify(g.audio.music.stats));
  g.audio.setMusic(A.volokTracks[4]); for (let i = 0; i < 80; i++) env.tick(ac, 0.05); ok(g.audio.music.stats.errors === 0, 'смена темы');
});
test('страница: фавикон студии, «← Каталог» с data-en, canvas 960×540, порядок скриптов, тач-кнопки ◀▶▲▼ и действие, пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"[^>]*data-en="← Catalog"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="960" height="540"/.test(html), 'canvas');
  eq([...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]), ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/meta.js', 'js/icons.js', 'js/audio.js', 'js/render.js', 'js/main.js']);
  ['U', 'D', 'L', 'R', 'A'].forEach(d => ok(html.includes('data-d="' + d + '"'), 'кнопка ' + d));
  ok(/id="bPause"/.test(html), 'пауза');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'нет внешних ссылок');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8'); ok(/a\.back\s*\{[^}]*position:\s*fixed/.test(css) && /z-index:\s*20/.test(css), 'ссылка видна поверх');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список + ориентиры жанра этой игры)
  const BASE = 'dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgg==';
  const GENRE = 'b2tvbW90aXZlfGxvbmUgP3NhaWxzfGNoYW5naW5nID90aWRlc3xcYmZhciA/OnzQvtC60L7QvNC+0YLQuNCyfNC70L7Rg9C9ID/RgdC10LnQuw==';
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  const BAD = new RegExp(u(BASE) + '|' + u(GENRE), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  // ловит ориентиры жанра (в base64), не ловит наши имена и обычные слова
  ['RkFSOiBMb25lIFNhaWxz', 'RkFSOiBDaGFuZ2luZyBUaWRlcw==', 'T2tvbW90aXZl', 'TG9uZSBTYWlscw==', '0J7QutC+0LzQvtGC0LjQsg=='].forEach(b => ok(BAD.test(u(b)), 'стоп-лист ловит ориентир жанра'));
  ok(!BAD.test('ВОЛОК') && !BAD.test('KETTLEWAKE') && !BAD.test('Гефест') && !BAD.test('зимовье') && !BAD.test('how far the hut') && !BAD.test('farther'), 'без ложных срабатываний');
});

// ---------- волна 4 (площадки): звёзды участков, авария с «ещё одним шансом», бонус, языки ----------
test('мета: 6 участков, звёзды (прошли / без аварий / без пожара), открытие по порядку, рекорд не падает', () => {
  const M = V.meta, mem = {}, G = M.Progress({ get: k => (k in mem ? mem[k] : null), set: (k, v) => { mem[k] = v; } });
  eq(M.LEVELS, L.SEC.length - 1); eq(M.stars({ wrecks: 0, fires: 0 }).n, 3); eq(M.stars({ wrecks: 1, fires: 0 }).n, 2); eq(M.stars({ wrecks: 2, fires: 3 }).n, 1);
  ok(!G.unlocked(2)); ok(G.record(1, 2)); ok(G.unlocked(2)); ok(!G.record(1, 1)); eq(mem['arcade.volok.stars.1'], '2'); eq(G.next(1, 1), 2); eq(G.next(2, 1), 1); eq(G.total(), 2);
});
test('авария при holdWreck: игра ждёт (wrecked), repairHere — ремонт на месте без отката, restoreCp — откат к чекпоинту', () => {
  const g = V.Game({ rng: mulberry32(3), holdWreck: true, snapshot: at(20000) }).start(), S = g.state();
  const x0 = S.mx; S.hull = 0; g.update(DT); eq(S.phase, 'wrecked'); eq(S.wrecks, 1); const mx = S.mx; g.update(DT); eq(S.mx, mx, 'стоит');
  ok(g.repairHere()); eq(S.phase, 'play'); eq(S.hull, 60); eq(S.mx, mx, 'на месте'); ok(!g.repairHere(), 'второй раз — нет');
  S.hull = 0; g.update(DT); eq(g.state().phase, 'wrecked'); g.restoreCp(); const S2 = g.state(); eq(S2.phase, 'play'); eq(S2.wrecks, 2); ok(Math.abs(S2.mx - x0) < 1, 'откат к чекпоинту');
  const g2 = V.Game({ rng: mulberry32(3), snapshot: at(20000) }).start(); g2.state().hull = 0; g2.update(DT); eq(g2.state().phase, 'play', 'без holdWreck — сразу откат, как раньше');
});
test('бонус за рекламу: корпус 100 и полный бункер угля; недоступен, когда всё полно', () => {
  const g = V.Game({ rng: mulberry32(3), snapshot: at(5000) }).start(), S = g.state(); S.hull = 40;
  ok(g.canBoost()); ok(g.boost()); eq(S.hull, 100); eq(S.bunker.length, L.CAP.bunker); ok(!g.canBoost()); ok(!g.boost());
});
test('языки: ru/en/tr/es/pt — одинаковые ключи; название RU ВОЛОК, EN/TR/ES/PT KETTLEWAKE', () => {
  const ks = Object.keys(V.STR.en).sort().join(','); eq(Object.keys(V.STR).join(','), 'ru,en,tr,es,pt');
  for (const l of ['ru', 'tr', 'es', 'pt']) eq(Object.keys(V.STR[l]).sort().join(','), ks, l);
  eq(V.STR.ru.title, 'ВОЛОК'); for (const l of ['en', 'tr', 'es', 'pt']) eq(V.STR[l].title, 'KETTLEWAKE', l);
});

// ---------- Проходимость: «человеческий» бот ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
const RUNS = [1, 2, 3, 4, 5, 6].map(sd => playVolok(V, sd, { maxT: 3600 }));
test('бот (реакция 150–250 мс, только клавиши ◀▶▲▼ и действие) доезжает до зимовья во всех 6 партиях, без зависаний', () => {
  RUNS.forEach((r, i) => ok(r.won && !r.stuck, 'сид ' + (i + 1) + ': ' + JSON.stringify({ won: r.won, stuck: r.stuck, mx: Math.round(r.mx), sec: r.sec, solved: r.solved })));
  RUNS.forEach(r => eq(r.solved, ['barrier', 'hill', 'rubble', 'ford', 'shore', 'storm', 'ice']));
});
test('длительность пути: 25–40 минут у бота; аварий мало (≤ 1 за партию), чекпоинты по пути', () => {
  const mins = RUNS.map(r => +(r.time / 60).toFixed(1)); console.log('     минуты: ' + mins.join(', ') + '; аварий: ' + RUNS.map(r => r.wrecks).join(',') + '; топлива подобрано: ' + RUNS.map(r => r.picks).join(','));
  ok(mins.every(m => m >= 25 && m <= 40), 'вне 25–40 мин'); ok(RUNS.every(r => r.wrecks <= 1), 'много аварий'); ok(RUNS.every(r => r.cps >= 12), 'мало чекпоинтов');
});
test('бот с медленной реакцией (300–450 мс) и рассеянностью тоже доезжает (возможно, с откатами)', () => {
  const r = playVolok(V, 11, { react: [0.3, 0.45], lazy: 0.15, maxT: 4200 });
  console.log('     медленный бот: ' + (r.time / 60).toFixed(1) + ' мин, аварий ' + r.wrecks + ', пожаров ' + r.fires);
  ok(r.won && !r.stuck, JSON.stringify({ mx: Math.round(r.mx), solved: r.solved }));
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
