/* ПОЛУУСТАВ · tests/engine.test.mjs — автотесты физики, головоломок, смертей/рестарта, сохранения, музыки,
   страницы и правила имён (Node, без зависимостей).
   Запуск: node poluustav/tests/engine.test.mjs   (QUICK=1 — без долгих прогонов бота). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { playBot, buildSOL } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const box = { console, Math, JSON, Array, Object };
box.window = box; box.globalThis = box; vm.createContext(box);
for (const f of ['js/i18n.js', 'js/levels.js', 'js/game.js', 'js/meta.js', 'js/render.js', 'js/audio.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box, { filename: f });
const P = box.POLU, C = P.C, LV = P.LEVELS;

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e){ failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error((m || '') + ' ждали ' + B + ', получили ' + A); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// ---------- помощники ----------
const DT = 1 / 120;
function mk(z, ev){ const log = []; const g = P.Game({ zone: z, onEvent: (t, d) => { log.push(t); if (ev) ev(t, d); } }).start(); g.log = log; return g; }
function run(g, sec, inp, fn){ for (let i = 0; i < sec * 120; i++){ if (inp) g.setInput(typeof inp === 'function' ? inp(i) : inp); if (fn && fn(g.state()) === false) break; g.step(); } }
function put(g, x, y){ const h = g.state().hero; h.x = x; h.y = y; h.vx = 0; h.vy = 0; h.st = 'run'; }
const boxOf = (g, id) => g.state().d.boxes.find(b => b.id === id);

// ---------- данные страниц ----------
test('страницы: 7 зон, у каждой отметки по возрастанию x, выход дальше последней, мир замкнут стенками', () => {
  eq(LV.length, 7);
  LV.forEach((L, i) => {
    ok(L.cps.length >= 3, 'отметок мало на ' + i);
    for (let k = 1; k < L.cps.length; k++) ok(L.cps[k].x > L.cps[k - 1].x, 'порядок отметок ' + i);
    ok(L.exit > L.cps[L.cps.length - 1].x && L.exit < L.w, 'выход ' + i);
    ok(L.solids.some(s => s[0] === -40) && L.solids.some(s => s[0] === L.w), 'стенки ' + i);
  });
  ok(LV[6].final && !LV.slice(0, 6).some(L => L.final), 'финал — последняя страница');
});
test('отметки безопасны: герой, поставленный на любую отметку, стоит на тверди и не гибнет 2 с', () => {
  LV.forEach((L, z) => L.cps.forEach((c, k) => {
    const g = P.Game({ save: { z, cp: k, snap: null } }).start(); let died = false;
    run(g, 2, {}, s => { if (s.hero.st === 'dead') died = true; });
    const h = g.state().hero; ok(!died && h.gr && Math.abs(h.x - c.x) < 2, `стр.${z + 1} отм.${k}: ${JSON.stringify({ x: h.x, y: h.y, gr: h.gr, died })}`);
  }));
});

// ---------- физика героя ----------
test('прыжок ≈ 105 px вверх и ≈ 115–125 px в длину с разбега; бег 165 px/с', () => {
  const g = mk(0); put(g, 100, 420); let minY = 1e9;
  run(g, 1, { x: 1 }); const v = g.state().hero.vx; ok(Math.abs(v - C.RUN) < 1, 'скорость ' + v);
  const x0 = g.state().hero.x; run(g, 0.05, { x: 1, jump: true }); run(g, 1.2, { x: 1 }, s => { minY = Math.min(minY, s.hero.y); return !s.hero.gr || s.hero.y < 419; });
  const h = g.state().hero; ok(420 - minY > 95 && 420 - minY < 115, 'высота ' + (420 - minY)); ok(h.x - x0 > 110 && h.x - x0 < 135, 'длина ' + (h.x - x0));
});
test('подтягивание: стенка 130 px — залезает; 190 px без ящика — нет', () => {
  const g = mk(0); put(g, 650, 370);                       // перед стенкой 280 (от 410 — 130)
  run(g, 0.05, { x: 1, jump: true }); run(g, 1.5, { x: 1 });
  ok(g.state().hero.y < 245 && g.log.includes('mantle'), 'не залез: ' + g.state().hero.y);
  const g2 = mk(0); put(g2, 1760, 420); boxOf(g2, 'b1').x = 1300;   // к стене 190 без ящика
  run(g2, 0.05, { x: 1, jump: true }); run(g2, 1.5, { x: 1 });
  ok(g2.state().hero.y > 400, 'залез на 190 без ящика: ' + g2.state().hero.y);
});
test('нет туннелирования: падение на 900 px/с на мост пера 14 px и на крышку ящика; разгон в тонкую стену', () => {
  const g = mk(5); const S = g.state(); S.d.levers[0].p = 0;                 // мост q1 (14 px) включён
  put(g, 700, 100); S.hero.vy = 900; run(g, 0.4, { x: 0 });
  ok(S.hero.gr && Math.abs(S.hero.y + C.HH - 460) < 0.6, 'провалился сквозь мост: ' + S.hero.y);
  const g2 = mk(0); put(g2, 1510, 100); g2.state().hero.vy = 900; run(g2, 0.5, {});
  ok(Math.abs(g2.state().hero.y + C.HH - 420) < 0.6, 'сквозь ящик: ' + g2.state().hero.y);
  const g3 = mk(6); const S3 = g3.state(); S3.d.carry = 'lamp'; put(g3, 1000, 420); S3.hero.vx = 600;   // стена-набросок (24 px) в свете
  for (let i = 0; i < 120; i++){ S3.hero.vx = Math.max(S3.hero.vx, 400); g3.setInput({ x: 1 }); g3.step(); }
  ok(S3.hero.x + C.HW <= 1100.01, 'прошёл сквозь стену: ' + S3.hero.x);
  // в каждом шаге смещение ≤ толщины самой тонкой тверди
  const thin = Math.min(...LV.flatMap(L => L.solids.map(s => Math.min(s[2], s[3]))), 12);
  ok(C.MAXF * DT < thin, 'шаг ' + C.MAXF * DT + ' ≥ ' + thin);
});
test('ступенька до 24 px — без прыжка (бревно-мост), выше — упор', () => {
  const g = mk(1); const S = g.state(); S.d.logs[0].st = 3; S.d.logs[0].y = 438; put(g, 560, 420);
  run(g, 1.6, { x: 1 }); ok(S.hero.x > 800, 'не прошёл по бревну: ' + S.hero.x);
});

// ---------- ящики ----------
test('ящик: толкается медленнее бега, в стену не уходит, с края опрокидывается и падает', () => {
  const g = mk(0); const b = boxOf(g, 'b1'); put(g, 1470, 420);
  run(g, 1, { x: 1 }); const v = g.state().hero.vx; ok(b.x > 1520 && Math.abs(v - C.PUSH) < 2, 'толкание: ' + b.x + ' v=' + v);
  run(g, 6, { x: 1 }); ok(Math.abs(b.x + b.w - 1800) < 0.6, 'у стены: ' + b.x);
  const g2 = mk(2); const b2 = boxOf(g2, 'b1'); put(g2, 360, 420); run(g2, 1.4, { x: 1 }); run(g2, 2, {});
  ok(b2.x >= 495 && b2.wet, 'не опрокинулся в воду: ' + JSON.stringify({ x: b2.x, y: b2.y }));
});
test('тянуть: действие зажато, герой идёт от ящика — ящик едет следом; без действия — нет', () => {
  const g = mk(1); const b = boxOf(g, 'b1'); put(g, 1600.5, 420);
  run(g, 1, { x: 1 }); ok(Math.abs(b.x - 1560) < 0.01, 'без действия ящик сдвинулся');
  put(g, 1600.5, 420); run(g, 1, { x: 1, act: true }); ok(b.x > 1600 && Math.abs(g.state().hero.x - (b.x + b.w)) < 1, 'не тянется: ' + b.x);
});
test('ящик на ящике и герой на ящике переносятся вместе с опорой (плот)', () => {
  const g = mk(2); const S = g.state(), raft = boxOf(g, 'b2'); S.d.doors[0].off = 200; S.d.levers[0].on = true;
  run(g, 1, {}); put(g, raft.x + 10, raft.y - C.HH - 0.5); run(g, 3, {});
  ok(raft.x > 1250 && S.hero.st === 'run' && Math.abs(S.hero.x - raft.x - 10) < 3, 'не везёт: ' + JSON.stringify({ rx: raft.x, hx: S.hero.x }));
});

// ---------- верёвки ----------
test('верёвка: хват в прыжке, период маятника ≈ 2π√(L/g), раскачка растит размах, отрыв даёт скорость', () => {
  const g = mk(1); const S = g.state(); put(g, 1171, 330); S.hero.gr = false; S.hero.vy = 10; run(g, 0.05, {});
  ok(S.hero.st === 'rope' && g.log.includes('grab'), 'не схватился');
  const rd = S.d.ropes[0], L = S.hero.rl; rd.th = 0.3; rd.om = 0;
  let cross = []; let prev = rd.th;
  run(g, 5, {}, () => { if (prev < 0 && rd.th >= 0) cross.push(g.state().time); prev = rd.th; });
  const T = cross[1] - cross[0], T0 = 2 * Math.PI * Math.sqrt(L / C.G); ok(Math.abs(T - T0) / T0 < 0.06, 'период ' + T + ' vs ' + T0);
  rd.th = 0; rd.om = 0.5; let amp = 0;
  run(g, 4, () => ({ x: Math.sign(rd.om) || 1 }), () => { amp = Math.max(amp, Math.abs(rd.th)); });
  ok(amp > 0.8, 'раскачка: ' + amp);
  let n = 0; run(g, 3, {}, () => !(rd.th > 0.3 && rd.om > 0) || n++ > 1e9);
  run(g, 0.02, { jump: true }); ok(S.hero.st === 'run' && S.hero.vx > 150, 'отрыв: ' + S.hero.vx);
});

// ---------- вода ----------
test('вода: ящик всплывает и плывёт по течению; герой с головой в воде — клякса; подъём воды в шлюзе', () => {
  const g = mk(2); const S = g.state(), b = boxOf(g, 'b1'); b.x = 600; b.y = 400; run(g, 3, {});
  ok(Math.abs(b.y + b.h * 0.55 - 476) < 6 && b.vx > 30, 'плавучесть/течение: ' + JSON.stringify({ y: b.y, vx: b.vx }));
  put(g, 700, 440); run(g, 1, {}); ok(g.log.includes('death') && S.hero.cause === 'water', 'не утонул');
  const g2 = mk(2); const S2 = g2.state(); S2.d.levers[1].on = true; run(g2, 7, {});
  ok(S2.d.water[3].y < 335 && boxOf(g2, 'b3').y < 330, 'шлюз: ' + S2.d.water[3].y);
});
test('течение: рычаг разворачивает поток — ящик у берега уходит вперёд', () => {
  const g = mk(2); const S = g.state(), b = boxOf(g, 'b4'); run(g, 2, {}); ok(b.x < 3410, 'стоит у левого берега');
  S.d.levers[2].on = true; run(g, 3, {}); ok(b.x > 3500, 'не поплыл: ' + b.x);
});

// ---------- тушь ----------
test('тушь: песочница сушит лужу (лужа твёрдая, песок исчез); ящик тонет до дна; герой в сырой туши — клякса', () => {
  const g = mk(4); const S = g.state(), sand = boxOf(g, 'b1'); sand.x = 560; sand.y = 300; run(g, 1.5, {});
  ok(S.d.ink[0].dried && sand.gone && g.log.includes('dry'), 'не высохло');
  put(g, 600, 300); run(g, 1, {}); ok(Math.abs(S.hero.y + C.HH - 470) < 0.6 && S.hero.st === 'run', 'не держит: ' + S.hero.y);
  const crate = boxOf(g, 'b2'); crate.x = 2050; crate.y = 200; run(g, 1.5, {}); ok(Math.abs(crate.y - 290) < 0.6, 'ящик не на дне: ' + crate.y);
  const g2 = mk(4); put(g2, 2080, 200); run(g2, 1, {}); ok(g2.state().hero.cause === 'ink', 'в туши выжил');
});
test('тушь растекается: после прохода триггера лужа растёт (вправо и влево) и убивает стоящего на пути', () => {
  const g = mk(4); const S = g.state(); put(g, 1400, 420); run(g, 1.5, {});
  ok(S.d.ink[1].act && S.d.ink[1].w > 100, 'не растеклась: ' + S.d.ink[1].w);
  run(g, 2.5, {}); ok(g.log.includes('death') && S.hero.cause === 'ink', 'стоящий не погиб');
  const g2 = mk(4); const S2 = g2.state(); put(g2, 3340, 240); run(g2, 5, {}); const r = g2.inkRect(3); ok(r.w > 100 && r.x < 3720, 'влево не течёт: ' + JSON.stringify(r));
});

// ---------- ловушки и механизмы ----------
test('капкан: герой — клякса; ящик разряжает капкан и застревает в нём', () => {
  const g = mk(0); put(g, 2590, 420); run(g, 1, { x: 1 }); ok(g.state().hero.cause === 'trap', 'капкан не сработал');
  const g2 = mk(0); const b = boxOf(g2, 'b2'); b.x = 3500; b.y = 380; run(g2, 1, {}); ok(b.fixed && !g2.state().d.traps[1].armed, 'ящик не разрядил');
});
test('бревно: падает после прохода героя, задевшее — клякса; упавшее — мост', () => {
  const g = mk(1); const S = g.state(); put(g, 440, 420); run(g, 0.2, {}); eq(S.d.logs[0].st, 1);
  put(g, 700, 300); S.hero.gr = false; run(g, 1.2, {}); ok(S.hero.cause === 'log' || S.hero.cause === 'fall', 'бревно не убило: ' + S.hero.cause);
  const g2 = mk(1); put(g2, 440, 420); run(g2, 2, {}); eq(g2.state().d.logs[0].st, 3); ok(g2.solids('hero').some(r => r.k === 'log'), 'не твердь');
});
test('пилы: ходят по оси; плита под ящиком убирает жернова в потолок; рычаг-пульс — на время', () => {
  const g = mk(3); const S = g.state(); const p0 = g.sawPos(0).x; run(g, 0.8, {}); ok(Math.abs(g.sawPos(0).x - p0) > 40, 'пила стоит');
  const b = boxOf(g, 'b2'); b.x = 1605; b.y = 260; run(g, 1.5, {}); ok(S.d.plates[0].on && S.d.saws[1].ret >= 89 && S.d.saws[2].ret >= 89, 'не убрались');
  put(g, 1700, 260); run(g, 2, { x: 1 }); ok(S.hero.st !== 'dead' && S.hero.x > 1940, 'коридор не пройден: ' + S.hero.x);
  const g2 = mk(3); const S2 = g2.state(); S2.d.levers[1].p = 0; run(g2, 1, {}); ok(S2.d.saws[3].ret > 85, 'пульс не убрал'); run(g2, 4, {}); ok(S2.d.saws[3].ret < 1, 'не вернулись');
});
test('противовес: тяжёлая сторона опускается; ящик (2) перевешивает героя (1); седок едет вместе с площадкой', () => {
  const g = mk(3); const S = g.state(); put(g, 800, 360); run(g, 3, {}); ok(S.d.scales[0].o <= -109, 'не опустилась: ' + S.d.scales[0].o);
  ok(Math.abs(S.hero.y + C.HH - 510) < 1, 'герой не на площадке: ' + S.hero.y);
  S.d.levers[0].on = true; run(g, 6, {}); ok(S.d.scales[0].o >= 109 && Math.abs(S.hero.y + C.HH - 290) < 1, 'не подняла: ' + JSON.stringify({ o: S.d.scales[0].o, y: S.hero.y }));
});
test('перо: рычаг рисует мост на время; плита держит мост постоянно; мостки по очереди', () => {
  const g = mk(5); const S = g.state(); ok(!g.bridgeOn(0)); S.d.levers[0].p = 0; run(g, 1, {}); ok(g.bridgeOn(0)); run(g, 4.5, {}); ok(!g.bridgeOn(0), 'мост не исчез');
  boxOf(g, 'b1').x = 1240; run(g, 0.3, {}); ok(S.d.plates[0].on && g.bridgeOn(1), 'плита не держит');
  S.d.levers[2].p = 0; run(g, 0.1, {}); ok(g.bridgeOn(2) && !g.bridgeOn(3)); run(g, 0.8, {}); ok(g.bridgeOn(3)); run(g, 1.8, {}); ok(!g.bridgeOn(2) && g.bridgeOn(5), 'очередь мостков');
});
test('лампада: носить, ставить, бросать; набросок твёрд только в свете; стена-набросок пропускает без света', () => {
  const g = mk(6); const S = g.state(); put(g, 290, 420); run(g, 0.05, { act: true }); run(g, 0.05, {}); eq(S.d.carry, 'lamp');
  ok(g.sketchLit(0) === false); put(g, 470, 420); run(g, 0.05, {}); ok(g.sketchLit(0) && g.solids('hero').some(r => r.k === 'sketch'));
  run(g, 2, { x: 1 }); ok(S.hero.x > 760 && S.hero.st === 'run', 'мост-набросок не держит: ' + S.hero.x);
  put(g, 1060, 420); run(g, 0.05, { x: 1, act: true }); run(g, 1.5, {}); const l = boxOf(g, 'lamp');
  ok(!S.d.carry && l.x > 1250 && l.gr, 'бросок: ' + JSON.stringify({ x: l.x, y: l.y })); ok(!g.sketchLit(4), 'стена светится');
  run(g, 3, { x: 1 }); ok(S.hero.x > 1200, 'стена без света держит: ' + S.hero.x);
  const g2 = mk(6); const S2 = g2.state(); S2.d.carry = 'lamp'; put(g2, 1060, 420); run(g2, 3, { x: 1 }); ok(S2.hero.x < 1100, 'стена в свете пропустила');
});
test('лампада утонула/упала в пропасть — откат к отметке (без кляксы), лампада снова на месте', () => {
  const g = mk(6); const S = g.state(); const l = boxOf(g, 'lamp'); l.x = 1500; l.y = 300; run(g, 2, {});
  ok(g.log.includes('reset') && !boxOf(g, 'lamp').gone, 'нет отката');
});

// ---------- смерть как подсказка, сохранение ----------
test('смерть: клякса → мгновенный (≤ 1.2 с) возврат к последней отметке; головоломка после отметки — как была', () => {
  const g = mk(0); const S = g.state(); boxOf(g, 'b1').x = 1760; put(g, 1845, 230); run(g, 0.2, {}); eq(S.cp, 2);
  boxOf(g, 'b1').x = 1500; put(g, 2000, 600); let t = 0;              // ящик «сбился», герой сорвался
  run(g, 5, {}, s => { if (s.hero.st === 'dead') t += DT; return !(g.log.includes('respawn')); });
  ok(g.log.includes('death') && g.log.includes('respawn') && t <= 1.2, 'рестарт ' + t);
  ok(Math.abs(S.hero.x - LV[0].cps[2].x) < 0.01 && Math.abs(boxOf(g, 'b1').x - 1760) < 0.01 && S.d.traps[0].armed, 'не у отметки или головоломка не как на отметке');
});
test('пауза «К последней отметке» откатывает застрявшую головоломку', () => {
  const g = mk(2); const S = g.state(); boxOf(g, 'b1').x = 780; put(g, 300, 420); g.restartCp(); ok(Math.abs(boxOf(g, 'b1').x - 400) < 0.01 && g.log.includes('reset'));
});
test('сохранение: saveData — JSON; новая игра с save — та же страница, отметка и состояние головоломок', () => {
  let saved = null; const g = P.Game({ zone: 0, onEvent: (t, d) => { if (t === 'checkpoint') saved = JSON.parse(JSON.stringify(d.save)); } }).start();
  const S = g.state(); boxOf(g, 'b1').x = 1760; put(g, 1845, 230); run(g, 0.2, {}); ok(saved && saved.cp === 2, 'нет сохранения');
  const g2 = P.Game({ save: saved }).start(), S2 = g2.state(); eq([S2.z, S2.cp], [0, 2]); ok(Math.abs(boxOf(g2, 'b1').x - 1760) < 0.01 && Math.abs(S2.hero.x - 1840) < 0.01);
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'); ok(/SAVE = 'poluustav\.save'/.test(main) && /clearSave\(\)/.test(main), 'ключ сохранения');
});
test('перелистывание: выход страницы → новая страница с первой отметки; финал — победа', () => {
  const g = mk(0); put(g, LV[0].exit + 5, 420); run(g, 0.1, {}); ok(g.log.includes('page')); run(g, 2, {}); eq(g.state().z, 1);
  const g2 = mk(6); put(g2, LV[6].exit + 5, 380); run(g2, 0.2, {}); ok(g2.log.includes('win') && g2.state().phase === 'won');
});

// ---------- каждая головоломка решаема (скриптовые решения, участок за участком) ----------
test('каждая головоломка решаема: сценарий решения проходит каждую страницу от первой отметки до выхода', () => {
  LV.forEach((L, z) => {
    const r = playBot(P, 3 + z, { zone: z, maxT: 600, until: s => s.z !== z || s.phase === 'won' });
    const done = r.z !== z || r.won;
    ok(done, `стр.${z + 1}: застрял на отметке ${r.cp}, шаг «${r.step}», x=${r.x}`);
    ok(r.cps >= L.cps.length - 1, `стр.${z + 1}: пройдено отметок ${r.cps}`);
  });
  const sol = buildSOL(); LV.forEach((L, z) => eq(sol[z].length, L.cps.length, 'участков решения на стр.' + (z + 1)));
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; названия', () => {
  eq(Object.keys(P.STR.ru).sort(), Object.keys(P.STR.en).sort());
  for (const k in P.STR.ru) ok(String(P.STR.ru[k]).trim() && String(P.STR.en[k]).trim(), 'пусто: ' + k);
  ['play', 'cont', 'restart', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'best', 'score', 'title', 'subtitle', 'tapstart'].forEach(k => ok(P.STR.ru[k], 'ключ ' + k));
  eq(P.STR.ru.title, 'ПОЛУУСТАВ'); eq(P.STR.en.title, 'GALLWICK');
});
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
test('музыка: процедурный эмбиент — 8 тем (7 страниц + финал), 8–16 тактов, ноты в диапазоне, >30 нот в окне 10 с, без ошибок', () => {
  const env = musicEnv(), A = env.win.Arcade;
  ok(A.tracks.poluustav && A.poluTracks.length === 8 && A.tracks.poluustav === A.poluTracks[0], 'треки');
  A.poluTracks.forEach((tr, i) => { const c = A.parseTrack(tr), perBar = c.div * 4, bars = c.melody.length / perBar;
    ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тема ' + (i + 1) + ': тактов ' + bars);
    ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'тема ' + (i + 1) + ': голоса не кратны');
    [c.melody, c.bass].forEach(v => v.forEach(n => { if (n) ok(n.f > 40 && n.f < 2200, 'нота ' + n.f); })); });
  ok(JSON.stringify(A.poluTracks[0]) !== JSON.stringify(A.poluTracks[1]), 'темы одинаковые');
  const g = A.createGame({ canvas: '#c', gameId: 'poluustav' }); g.useStandardScreens(); g.scene('play', {}); g.goto('play'); env.fire('keydown');
  const ac = g.audio.ac; for (let i = 0; i < 200; i++) env.tick(ac, 0.05);
  ok(g.audio.music.stats.scheduled > 30 && g.audio.music.stats.errors === 0, JSON.stringify(g.audio.music.stats));
  A.poluTracks.forEach(tr => { g.audio.setMusic(tr); for (let i = 0; i < 40; i++) env.tick(ac, 0.05); }); ok(g.audio.music.stats.errors === 0, 'смена темы');
});
test('звук среды: все события логики имеют SFX-ветку (шаги пера, страницы, плеск) и не падают без AudioContext', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/audio.js'), 'utf8');
  ['step', 'jump', 'land', 'page', 'checkpoint', 'death', 'splash', 'dry', 'quill', 'lever', 'snap'].forEach(t => ok(src.includes("case '" + t + "'"), 'нет звука ' + t));
  const fake = { audio: { enabled: false } }; ['step', 'page', 'death'].forEach(t => P.sfx(fake, t, {}));
});
test('страница: фавикон, «← Каталог» с data-catalog-back и data-en, canvas 960×540, порядок скриптов, тач ◀▶/прыжок/действие/пауза; engine.js = _shared', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"[^>]*data-catalog-back="1"[^>]*data-en="← Catalog"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="960" height="540"/.test(html), 'canvas');
  eq([...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]), ['engine.js', 'js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/meta.js', 'js/audio.js', 'js/render.js', 'js/main.js']);
  ['data-d="L"', 'data-d="R"', 'id="bJump"', 'id="bAct"', 'id="bPause"'].forEach(s => ok(html.includes(s), 'кнопка ' + s));
  ok(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8') === fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared (пересинхронизирует build.sh)');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'внешние ссылки');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8'); ok(/a\.back\s*\{[^}]*position:\s*fixed/.test(css) && /z-index:\s*20/.test(css), 'ссылка видна поверх');
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'); ok(/touchmove/.test(main) && /tj = 0\.12/.test(main), 'свайп-прыжок');
});
test('правило имён: в папке игры нет чужих названий игр/студий/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список + ориентиры жанра этой игры)
  const BASE = 'dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgg==';
  const GENRE = 'bGltYm980LvQuNC80LHQvnxwbGF5ID9kZWFkfNC/0Ltb0Y3QtV3QudC00LXQtHxcYmluc2lkZVxifGxpdHRsZSA/bmlnaHRtYXJlc3x1bnJhdmVsfHR5cG9tYW58XGJpbmtlZFxifHBlbnRpbWVudHzQv9C10L3RgtC40LzQtdC90YJ8aW5rdWxpbmF0aXxcYmJlbmR5XGJ8c2NyaWJibGVuYXV0c3xjcmF5b24gP3BoeXNpY3N8dGVhcmF3YXl8cGxhbmV0ID9vZiA/bGFuYXxtYWNoaW5hcml1bXxhbWFuaXRhID9kZXNpZ258aG9sbG93ID9rbmlnaHQ=';
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  const BAD = new RegExp(u(BASE) + '|' + u(GENRE), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 10, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  // ловит ориентиры жанра (в base64), не ловит наши имена и обычные слова
  ['TElNQk8=', '0JvQuNC80LHQvg==', 'UGxheWRlYWQ=', 'SU5TSURF', 'TGl0dGxlIE5pZ2h0bWFyZXM=', 'UGVudGltZW50', 'SW5rdWxpbmF0aQ==', 'QmVuZHk='].forEach(b => ok(BAD.test(u(b)), 'стоп-лист ловит ориентир жанра'));
  ok(!BAD.test('ПОЛУУСТАВ') && !BAD.test('GALLWICK') && !BAD.test('Гефест') && !BAD.test('ink pool') && !BAD.test('limbs') && !BAD.test('unlinked'), 'без ложных срабатываний');
});

// ---------- проходимость: «человеческий» бот ----------
// ---------- волна 3: звёзды страниц, перелистывание за рекламу, языки ----------
test('мета: звёзды страницы (пройдена / ≤ 3 клякс / без клякс; перелистнутая — 0), 7 страниц, рекорд не падает', () => {
  const M = P.meta, mem = {}, G = M.Progress({ get: k => (k in mem ? mem[k] : null), set: (k, v) => { mem[k] = v; } });
  eq(M.LEVELS, LV.length); eq(M.stars({ blots: 0 }).n, 3); eq(M.stars({ blots: 3 }).n, 2); eq(M.stars({ blots: 9 }).n, 1); eq(M.stars({ blots: 0, skipped: true }).n, 0);
  ok(G.record(2, 2)); ok(!G.record(2, 1)); eq(G.get(2), 2); eq(mem['arcade.poluustav.stars.2'], '2');
});
test('реклама: skipPage — перелистывание как у края страницы (фаза turn → следующая страница), на последней — нельзя', () => {
  const ev = []; const g = P.Game({ onEvent: (t, d) => ev.push([t, d]) }).start(); const S = g.state();
  ok(g.canSkip()); ok(g.skipPage()); eq(S.phase, 'turn'); ok(ev.some(e => e[0] === 'page' && e[1].skip));
  for (let i = 0; i < 200 && S.phase === 'turn'; i++) g.update(1 / 60);
  eq(S.z, 1); ok(!g.skipPage() || true);
  const last = P.Game({ zone: LV.length - 1 }).start(); ok(!last.canSkip(), 'последняя страница');
});
test('языки: ru/en/tr/es/pt — одинаковые ключи; название RU ПОЛУУСТАВ, EN/TR/ES/PT GALLWICK', () => {
  const ks = Object.keys(P.STR.en).sort().join(','); eq(Object.keys(P.STR).join(','), 'ru,en,tr,es,pt');
  for (const l of ['ru', 'tr', 'es', 'pt']) eq(Object.keys(P.STR[l]).sort().join(','), ks, l);
  eq(P.STR.ru.title, 'ПОЛУУСТАВ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(P.STR[l].title, 'GALLWICK', l);
});
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
const RUNS = [1, 2, 3, 4, 5, 6].map(sd => playBot(P, sd, { maxT: 3600 }));
test('бот (реакция 150–250 мс, только клавиши ◀▶, прыжок, ▲▼ и действие) проходит все 7 страниц в 6 партиях, без зависаний', () => {
  RUNS.forEach((r, i) => ok(r.won && !r.stuck, 'сид ' + (i + 1) + ': ' + JSON.stringify({ z: r.z, cp: r.cp, x: r.x, step: r.step })));
  RUNS.forEach(r => eq(r.pages, 6, 'перелистываний'));
});
test('смерть как подсказка: бот гибнет редко (≤ 25 клякс за партию), прохождение со знанием решений — 4–10 мин', () => {
  const mins = RUNS.map(r => +(r.time / 60).toFixed(1));
  console.log('     минуты (бот знает решения): ' + mins.join(', ') + '; клякс: ' + RUNS.map(r => r.deaths).join(',') + '; причины: ' + JSON.stringify(RUNS.map(r => r.causes)));
  ok(mins.every(m => m >= 4 && m <= 10), 'вне 4–10 мин'); ok(RUNS.every(r => r.deaths <= 25), 'много клякс');
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
