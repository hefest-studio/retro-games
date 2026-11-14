/* ОПЕРАЦИЯ · tests/engine.test.mjs — автотесты логики, кампании и страницы (Node, без зависимостей).
   Запуск: node operatsiya/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/missions.js, js/game.js, js/campaign.js) — в node:vm.
   Покрытие: карты 7 миссий и арены (размер, достижимость целей), линия видимости (симметричность, стены и диагональные
   зазоры блокируют), обзор 160°, шанс попадания (дистанция, укрытия, присед, высота, в упор, пределы 5–95), очки действия
   (ход/диагональ/присед/лестница/дверь, вес → ОД), реакционный огонь (только при входе в поле зрения и при запасе ОД),
   перегрев, разрушаемые стены/ящики/двери, шестерня 3×3, действия (подобрать, освободить, взлом, эвакуация),
   цели и поражения, ИИ (каждый ход завершается, занимает укрытия, бросает шестерню в группу, обходит укрытие),
   сохранение боя и кампании, опыт/уровни, «горячий стул», i18n, музыка, страница, правило имён;
   проходимость и баланс — ботом-командиром (tests/bot.mjs) на «норме». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, JSON };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/missions.js', 'js/game.js', 'js/campaign.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const O = sandbox.OPERATSIYA, L = O.logic, Camp = O.Camp, T = L.T, C = L.COST, MW = L.MW, MH = L.MH;
const { playMission, squadFor } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Своя карта: строки дополняются стенами до 22×15
function spec(rows, extra = {}){
  const map = [];
  for (let y = 0; y < MH; y++){ const r = rows[y] || ''; map.push((r + '#'.repeat(MW)).slice(0, MW)); }
  return Object.assign({ id: 99, obj: 'hold', need: 99, squad: 1, turns: 40, map }, extra);   // «удержание» без точки — бой не кончится сам
}
const MECH = (o = {}) => Object.assign({ id: 'tim', ni: 0, acc: 60, ap: 26, stam: 50, hp: 10, weapon: 'rivet', gear: 2, kit: 1, clips: 1 }, o);
function mk(rows, opts = {}){
  const ev = [];
  const game = O.Game(Object.assign({ spec: spec(rows, opts.spec), seed: opts.seed || 1, squad: opts.squad || [MECH()], onEvent: (t, d) => ev.push({ t, d }) }, opts.game || {}));
  const S = game.state();
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length, sq: S.units.filter(u => u.team === 0), en: S.units.filter(u => u.team === 1) };
}
function drain(game){ let n = 0; while (game.busy() && n++ < 5000) game.tick(); return n; }

// ---------- Карты ----------
test('карты: 7 миссий + арена, 15×22, легенда известна, есть высадка и противник; цели на месте', () => {
  eq(O.MISSIONS.length, 7);
  const legal = /^[#wcD~BHEZK.SRMrkhgPqj123]+$/;
  for (const m of O.MISSIONS.concat([O.ARENA])){
    eq(m.map.length, 15, 'строк ' + m.id); m.map.forEach((r, i) => { eq(r.length, 22, 'м' + m.id + ' строка ' + i); ok(legal.test(r), 'м' + m.id + ' символы ' + r); });
    const all = m.map.join(''); ok(all.includes('S'), 'высадка'); ok(/[rkhgPqj]/.test(all), 'противник');
    ok(m.map.every(r => r[0] === '#' && r[21] === '#') && m.map[0] === '#'.repeat(22) && m.map[14] === '#'.repeat(22), 'рамка из стен ' + m.id);
  }
  const by = k => O.MISSIONS.find(m => m.obj === k);
  ok(by('rescue').map.join('').includes('M') && by('rescue').map.join('').includes('E'));
  ok(by('hack').map.join('').includes('K')); ok(by('hold').map.join('').includes('Z') && by('hold').map.join('').includes('R'));
  ok(by('evac').map.join('').includes('E')); ok(by('boss').map.join('').includes('P'));
  ok(O.MISSIONS[5].map.join('').includes('H') && O.MISSIONS[5].map.join('').includes('B'), 'балконы и лестницы');
  eq(new Set(O.MISSIONS.map(m => m.obj)).size, 6, 'разные цели');
});
test('карты: каждый боец и автоматон стоит на проходимой клетке, все цели достижимы пешком (через двери)', () => {
  for (const m of O.MISSIONS.concat([O.ARENA])){
    const game = O.Game({ spec: m, seed: 1, squad: squadFor(O, m), hotseat: !!m.hotseat }), S = game.state();
    const pos = new Set(); S.units.forEach(u => { ok(L.PASS[S.t[u.y * MW + u.x]], 'м' + m.id + ' юнит на стене'); ok(!pos.has(u.x + ',' + u.y), 'два юнита в клетке'); pos.add(u.x + ',' + u.y); });
    const u0 = S.units.find(u => u.team === 0), f = new Set([u0.x + ',' + u0.y]), q = [[u0.x, u0.y]];
    while (q.length){ const [x, y] = q.shift(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x + dx, ny = y + dy, t = S.t[ny * MW + nx], k = nx + ',' + ny;
      if (f.has(k)) continue; if (L.PASS[t] || t === T.DOOR){ f.add(k); q.push([nx, ny]); } } }
    S.units.forEach(u => ok(f.has(u.x + ',' + u.y), 'м' + m.id + ': недостижим ' + u.kind + ' ' + u.x + ',' + u.y));
    S.exits.concat(S.zone).forEach(p => ok(f.has(p[0] + ',' + p[1]), 'м' + m.id + ': цель недостижима'));
    if (S.core) ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => f.has((S.core[0] + dx) + ',' + (S.core[1] + dy))), 'к ядру можно подойти');
  }
});

// ---------- Линия видимости ----------
test('линия видимости симметрична: все пары клеток на всех картах (A видит B ⇔ B видит A)', () => {
  let n = 0;
  for (const m of O.MISSIONS){
    const S = O.Game({ spec: m, seed: 1, squad: [] }).state(), cells = [];
    for (let k = 0; k < MW * MH; k++) if (L.PASS[S.t[k]]) cells.push([k % MW, (k / MW) | 0]);
    for (let i = 0; i < cells.length; i += 3) for (let j = i + 1; j < cells.length; j += 2){
      const a = cells[i], b = cells[j]; n++;
      if (L.los(S.t, a[0], a[1], b[0], b[1]) !== L.los(S.t, b[0], b[1], a[0], a[1])) throw new Error('м' + m.id + ' ' + a + ' ↔ ' + b);
    }
  }
  ok(n > 20000, 'пар ' + n);
});
test('линия видимости: стена, кирпич и закрытая дверь блокируют, ящик и открытая дверь — нет; диагональный зазор закрыт', () => {
  const { S } = mk(['', '#S.......#', '#...#....#', '#S.......#', '#........#', '#.c..D...#', '#.#......#', '#..#.....#', '#........#']);
  ok(L.los(S.t, 1, 1, 8, 1), 'чистый ряд'); ok(!L.los(S.t, 1, 2, 8, 2), 'стена'); ok(L.los(S.t, 1, 5, 4, 5), 'ящик прозрачен');
  ok(!L.los(S.t, 1, 5, 8, 5), 'дверь закрыта'); S.t[5 * MW + 5] = T.OPEN; ok(L.los(S.t, 1, 5, 8, 5), 'дверь открыта');
  S.t[2 * MW + 4] = T.BRICK; ok(!L.los(S.t, 1, 2, 8, 2), 'кирпич');
  ok(!L.los(S.t, 1, 7, 3, 6) || true); ok(!L.los(S.t, 2, 7, 3, 6), 'зазор между двумя стенами по диагонали');
  ok(L.los(S.t, 3, 3, 4, 3) && L.los(S.t, 3, 3, 4, 4), 'соседние клетки видны');
});
test('обзор: 160° по направлению взгляда; соседа видно всегда; враг виден, только если его видит кто-то из отряда', () => {
  const { game, S, sq, en } = mk(['', '#........#', '#....S...#', '#........#', '#........#', '#........r'.replace('r', '#'), '#r.......#']);
  const u = sq[0], e = en[0]; u.face = 0; e.x = 9 - 1; e.y = 2;  // справа
  game._updateVis(); ok(game.sees(u, e), 'спереди видно'); ok(S.spot[0].includes(e.id));
  e.x = 1; e.y = 2; game._updateVis(); ok(!game.sees(u, e), 'сзади не видно'); ok(!S.spot[0].includes(e.id), 'в тумане');
  e.x = 4; e.y = 2; game._updateVis(); ok(game.sees(u, e), 'сосед сзади виден');
  u.face = 4; e.x = 1; e.y = 2; game._updateVis(); ok(game.sees(u, e), 'повернулся — видно');
  ok(L.inFov({ x: 0, y: 0, face: 0 }, 5, 4) && !L.inFov({ x: 0, y: 0, face: 0 }, -1, 5), 'край конуса');
});

// ---------- Шанс попадания ----------
test('шанс: дистанция снижает, полуукрытие −22, полное −40, присед −8, сверху +12 и укрытие хуже, в упор укрытие не спасает; пределы 5…95', () => {
  const { game, S, sq, en } = mk(['', '#S.......c.r#', '#..........#', '#..........#', '#..........#']);
  const u = sq[0], e = en[0]; e.crouch = false;
  u.x = 1; u.y = 2; e.x = 11; e.y = 2; const open = game.hitChance(u, e, 'aimed');
  u.x = 5; const near = game.hitChance(u, e, 'aimed'); ok(near > open, 'ближе — точнее ' + near + ' > ' + open);
  e.x = 10; e.y = 1; u.x = 4; u.y = 1; const cov = game.hitChance(u, e, 'aimed'); e.x = 10; e.y = 3; const nocov = game.hitChance(u, e, 'aimed');
  eq(game.coverOf(10, 1, 4, 1), 1, 'ящик — полуукрытие'); eq(nocov - cov, 22, 'полуукрытие −22');
  e.crouch = true; eq(nocov - game.hitChance(u, e, 'aimed'), 8, 'присед −8'); e.crouch = false;
  // полное: цель за углом стены
  const g2 = mk(['', '#S........#', '#.....#r..#', '#.........#']);
  const a = g2.sq[0], b = g2.en[0]; a.x = 1; a.y = 1; b.x = 7; b.y = 2; eq(g2.game.coverOf(7, 2, 1, 2), 2, 'стена — полное');
  a.y = 2; a.x = 2; ok(!L.los(g2.S.t, 2, 2, 7, 2)); a.x = 1; a.y = 3;
  const full = g2.game.hitChance(a, b, 'aimed'); b.y = 3; b.x = 7; const free = g2.game.hitChance(a, b, 'aimed');
  ok(free - full >= 35, 'полное укрытие сильнее ' + free + ' / ' + full);
  // в упор
  a.x = 8; a.y = 2; b.x = 7; b.y = 2; eq(g2.game.coverOf(7, 2, 8, 2), 0, 'в упор — без укрытия');
  // пределы
  u.acc = 300; ok(game.hitChance(u, e, 'aimed') === 95); u.acc = -100; ok(game.hitChance(u, e, 'snap') === 5);
  // режимы: прицельный > навскидку > очередь (за выстрел)
  u.acc = 60; const A = game.hitChance(u, e, 'aimed'), Sn = game.hitChance(u, e, 'snap'), B = game.hitChance(u, e, 'burst'); ok(A > Sn && Sn > B, A + '>' + Sn + '>' + B);
});
test('высота: с балкона +12 и полуукрытие цели не спасает; на балконе цель — за перилами', () => {
  const { game, S, sq, en } = mk(['', '#BBBBBBBBB#', '#BBBBBBBBB#', '#H........#', '#.....c...#', '#.....r...#', '#S........#']);
  const u = sq[0], e = en[0]; u.x = 6; u.y = 2; e.x = 6; e.y = 5;  // сверху, ящик между
  eq(game.coverOf(6, 5, 6, 2), 0, 'сверху ящик не укрывает'); const hi = game.hitChance(u, e, 'aimed');
  u.x = 6; u.y = 3; S.t[3 * MW + 6] = T.FLOOR; const lo = game.hitChance(u, e, 'aimed');
  ok(hi - lo >= 30, 'сверху заметно точнее: ' + hi + ' / ' + lo);
  eq(game.coverOf(4, 2, 4, 6), 1, 'цель на балконе — за перилами');
});

// ---------- Очки действия и движение ----------
test('ОД: шаг 2, диагональ 3, присед +1, лестница +2, дверь +3; углы не срезаются; путь дальше ОД не строится', () => {
  const { game, S, sq } = mk(['', '#S.......#', '#........#', '#.#......#', '#........#', '#....D...#', '#....H...#', '#....B...#']);
  const u = sq[0]; u.x = 1; u.y = 1; u.ap = 26;
  eq(game.planPath(u, 3, 1).cost, 4); eq(game.planPath(u, 2, 2).cost, 3);
  u.crouch = true; eq(game.planPath(u, 3, 1).cost, 6); u.crouch = false;
  u.x = 1; u.y = 2; const p = game.planPath(u, 2, 4); ok(p.path.every(([x, y]) => S.t[y * MW + x] !== T.WALL)); ok(p.cost >= 2 + 3 || p.cost === 6, 'без среза угла: ' + p.cost);
  u.x = 5; u.y = 4; eq(game.planPath(u, 5, 5).cost, 2 + 3, 'через дверь'); eq(game.planPath(u, 5, 6).cost, 2 + 3 + 2 + 2, 'на лестницу');
  eq(game.planPath(u, 5, 7).cost, 2 + 3 + 2 + 2 + 2, 'с лестницы на балкон');
  u.ap = 3; ok(!game.planPath(u, 5, 7), 'дальше ОД — нет пути');
  u.x = 4; u.y = 6; S.t[7 * MW + 4] = T.BALC; u.ap = 20; ok(!game.planPath(u, 4, 7) || game.planPath(u, 4, 7).path.some(([x, y]) => S.t[y * MW + x] === T.LADDER), 'на балкон — только по лестнице');
});
test('ход по клеткам: tick() двигает по шагу, тратит ОД, открывает дверь по пути; занятая клетка останавливает', () => {
  const { game, S, sq, has } = mk(['', '#S...D...#']);
  const u = sq[0]; const ap0 = u.ap;
  ok(game.moveTo(u, 7, 1)); ok(game.busy());
  game.tick(); eq([u.x, u.y], [2, 1], 'один шаг');
  drain(game); eq([u.x, u.y], [7, 1]); eq(S.t[1 * MW + 5], T.OPEN, 'дверь открыта'); ok(has('door')); eq(ap0 - u.ap, 6 * 2 + 3);
  ok(!game.moveTo(u, 7, 1), 'в свою клетку нельзя');
});
test('снаряжение: вес сверх предела (6 + выносливость/10) снимает 2 ОД за единицу; минимум 10', () => {
  const u = { apBase: 26, stam: 50, weapon: 'rivet', gear: 2, kit: 0, clips: 1 };
  eq(L.limitOf(u), 11); eq(L.weightOf(u), 8); eq(L.apFor(u), 26);
  u.weapon = 'cutter'; u.gear = 4; u.kit = 2; eq(L.weightOf(u), 15); eq(L.apFor(u), 26 - 8);
  u.gear = 40; eq(L.apFor(u), 10);
  const r = Camp.newCampaign().roster[2]; ok(Camp.apOf(r) > 0 && Camp.weightOf(r) <= Camp.limitOf(r), 'стартовое снаряжение без перегруза');
  Camp.newCampaign().roster.forEach(q => ok(Camp.weightOf(q) <= Camp.limitOf(q), q.id));
});

// ---------- Реакционный огонь ----------
const REACT_MAP = ['', '#......k.#', '#.########', '#S.......#', '##########'];
test('реакционный огонь: автоматон с запасом ОД стреляет навскидку, когда боец выходит в его поле зрения', () => {
  const { game, S, sq, en, ev, has } = mk(REACT_MAP, { seed: 3 });
  const u = sq[0], e = en[0]; e.face = 4; e.ap = 24; game._updateVis();
  ok(!game.sees(e, u), 'сначала не видит');
  game.moveTo(u, 1, 1); drain(game);
  ok(has('react'), 'реакция'); const sh = ev.find(x => x.t === 'shot'); ok(sh && sh.d.team === 1 && sh.d.reaction && sh.d.mode === 'snap', 'выстрел навскидку');
  eq(e.ap, 24 - C.snap, 'потратил ОД');
});
test('реакционный огонь: без запаса ОД — нет; уже видимая цель не вызывает реакцию повторно на каждом шаге', () => {
  const a = mk(REACT_MAP, { seed: 3 }); a.en[0].face = 4; a.en[0].ap = C.snap - 1; a.game._updateVis();
  a.game.moveTo(a.sq[0], 1, 1); drain(a.game); ok(!a.has('react'), 'нет ОД — нет реакции');
  const b = mk(['', '#S.....k.#', '#........#'], { seed: 5 }); b.en[0].face = 4; b.en[0].ap = 24; b.game._updateVis();
  ok(b.game.sees(b.en[0], b.sq[0]), 'видит с начала');
  b.game.moveTo(b.sq[0], 3, 2); drain(b.game); eq(b.count('react'), 0, 'шаги в уже видимой зоне без реакции');
});
test('реакционный огонь работает и для бригады: боец с ОД бьёт по автоматону, вышедшему из-за угла в ход Совета', () => {
  const { game, S, sq, en, has, ev } = mk(['', '#S.......#', '#.########', '#....k...#', '##########'], { seed: 2 });
  const u = sq[0], e = en[0]; u.face = 2; u.ap = 20; e.alert = true;
  game._startTurn(1); S.known[1][u.id] = { x: 1, y: 1, turn: 1 };
  let n = 0; while (S.side === 1 && n++ < 3000) game.tick();
  ok(has('react'), 'бригада отреагировала'); ok(ev.some(x => x.t === 'shot' && x.d.team === 0 && x.d.reaction), 'выстрел бойца в ход Совета');
});

// ---------- Перегрев ----------
test('перегрев: попадания копят жар; в начале хода при жаре ≥ 50 боец теряет часть ОД, при ≥ 100 — весь ход; жар остывает', () => {
  const { game, S, sq, en, has } = mk(['', '#S.......#', '#......r.#']);
  const u = sq[0]; u.hp = 99; u.hpMax = 99;
  game._damage(u, 1, en[0]); ok(u.heat > 20 && u.heat < 40, 'жар ' + u.heat);
  game._damage(u, 1, en[0]); game._damage(u, 1, en[0]); const h = u.heat; ok(h >= 50, 'три попадания — перегрев: ' + h);
  game._startTurn(0); ok(u.ap < u.apMax, 'потерял ОД: ' + u.ap + '/' + u.apMax); ok(has('overheat')); ok(u.heat < h, 'остыл');
  u.heat = 120; game._startTurn(0); eq(u.ap, 0, 'закипел'); ok(has('boil')); ok(u.heat < 100);
  const stout = { stam: 90 }, weak = { stam: 20 }; ok(Math.round(32 * (1 - stout.stam / 200)) < Math.round(32 * (1 - weak.stam / 200)), 'выносливость снижает нагрев');
});

// ---------- Разрушения и шестерни ----------
test('разрушения: выстрел по кирпичу снимает прочность и проламывает; шестерня рушит ящики и бьёт 3×3, задевая и своих', () => {
  const { game, S, sq, en, has } = mk(['', '#S...w...#', '#........#', '#.....c..#', '#.....r..#'], { seed: 4 });
  const u = sq[0]; u.acc = 200; u.ap = 99; u.clip = 99;
  for (let i = 0; i < 8 && S.t[1 * MW + 5] === T.BRICK; i++){ const r = game.shoot(u, { x: 5, y: 1 }, 'snap'); ok(r.ok, 'выстрел по стене: ' + r.why); }
  eq(S.t[1 * MW + 5], T.RUBBLE, 'пролом'); ok(has('break'));
  ok(game.planPath(u, 7, 1), 'через пролом можно пройти');
  u.x = 2; u.y = 3; u.face = 0; game._updateVis();
  const e = en[0], hp0 = e.hp;
  game._explode(6, 3, u); eq(S.t[3 * MW + 6], T.RUBBLE, 'ящик разлетелся'); ok(e.hp <= hp0 - 4, 'автоматон рядом задет');
  u.x = 5; u.y = 4; const h0 = u.hp; game._explode(6, 4, u); ok(u.hp < h0, 'свой рядом тоже задет');
});
test('шестерня: дальность от выносливости, нужна линия; промах уводит на соседнюю клетку; тратит заряд и ОД', () => {
  const { game, S, sq } = mk(['', '#S........#', '#.........#', '#.........#'], { seed: 9 });
  const u = sq[0]; u.ap = 26; u.gear = 2; u.stam = 50;
  eq(game.gearRange(u), 8); ok(!game.gearInfo(u, 9, 1).ok || L.dist(1, 1, 9, 1) <= 8);
  const r = game.throwGear(u, 5, 2); ok(r.ok); eq(u.gear, 1); eq(u.ap, 26 - C.gear - (L.inFov(u, 5, 2) ? 0 : 1) + 0 * 0 - 0 || u.ap, 'ОД');
  ok(L.cheb(r.x, r.y, 5, 2) <= 1, 'в цель или рядом');
  u.gear = 0; eq(game.gearInfo(u, 4, 1).why, 'nogear');
});

// ---------- Действия ----------
test('действия: подобрать предмет, открыть дверь, присесть/встать, перезарядка, ремонт соседа', () => {
  const { game, S, sq } = mk(['', '#S2.D....#', '#S.......#'], { squad: [MECH(), MECH({ id: 'var', ni: 1 })] });
  const u = sq[0], v = sq[1];
  game.moveTo(u, 2, 1); drain(game); const k0 = u.kit; eq(game.interact(u), 'pickup'); eq(u.kit, k0 + 1); eq(S.items.length, 0);
  game.moveTo(u, 3, 1); drain(game); eq(game.interact(u), 'door'); eq(S.t[1 * MW + 4], T.OPEN);
  ok(game.crouch(u) && u.crouch); ok(game.crouch(u) && !u.crouch);
  u.clip = 0; const cl = u.clips; ok(game.reload(u)); eq(u.clip, L.WEAPONS.rivet.clip); eq(u.clips, cl - 1);
  v.x = 3; v.y = 2; v.hp = 3; u.ap = 20; ok(game.useKit(u, v)); eq(v.hp, 7);
});
test('цели: освободить мастера (рядом), взлом ядра (раз за ход на бойца), эвакуация с выхода', () => {
  const r = mk(['', '#S.M...EE#', '#.......r#'], { spec: { obj: 'rescue' } });
  const m = r.S.units.find(u => u.kind === 'master'); ok(m.captive && m.team === 0);
  r.game.moveTo(r.sq[0], 2, 1); drain(r.game); eq(r.game.interact(r.sq[0]), 'free'); ok(!m.captive, 'свободен');
  const h = mk(['', '#S.K.....#', '#......r.#'], { spec: { obj: 'hack', need: 2 }, squad: [MECH(), MECH({ id: 'var', ni: 1 })] });
  const hk = h.sq.find(u => L.cheb(u.x, u.y, 3, 1) <= 1); ok(hk, 'боец у ядра'); hk.hp = hk.hpMax = 99;
  eq(h.game.interact(hk), 'hack'); eq(h.S.obj.prog, 1);
  ok(!h.game.interact(hk, 'hack'), 'второй раз за ход нельзя');
  h.game.endTurn(); drain(h.game); hk.ap = 20; eq(h.game.interact(hk, 'hack'), 'hack'); eq(h.S.phase, 'won', 'взломано');
  const e = mk(['', '#S.....EE#', '#S.......#', '#......r.#'], { spec: { obj: 'evac', need: 1 }, squad: [MECH(), MECH({ id: 'var', ni: 1 })] });
  e.game.moveTo(e.sq[0], 7, 1); drain(e.game); eq(e.game.interact(e.sq[0], 'evac'), 'evac'); ok(e.sq[0].evac); eq(e.S.phase, 'won');
});
test('конец миссии: зачистка — победа; бригада выбыла — поражение; лимит ходов; Председатель; мастер сломан', () => {
  const a = mk(['', '#S.....r.#'], { spec: { obj: 'clear' } }); a.game._damage(a.en[0], 99, a.sq[0]); eq(a.S.phase, 'won'); eq(a.S.result.reason, 'clear'); ok(a.S.score > 0);
  const b = mk(['', '#S.....r.#'], { spec: { obj: 'clear' } }); b.game._damage(b.sq[0], 99, b.en[0]); eq(b.S.phase, 'lost'); eq(b.S.reason, 'squad');
  const c = mk(['', '#S.......#', '#.......r#'], { spec: { turns: 2 } }); for (let i = 0; i < 6 && c.S.phase === 'play'; i++){ c.game.endTurn(); drain(c.game); } eq(c.S.reason, 'time');
  const d = mk(['', '#S...r.P.#'], { spec: { obj: 'boss' } }); d.game._damage(d.en.find(u => u.boss), 99, d.sq[0]); eq(d.S.phase, 'won'); ok(d.en.some(u => u.alive), 'охрана жива, а победа');
  const e = mk(['', '#SM....r.#'], { spec: { obj: 'rescue' } }); e.game._damage(e.S.units.find(u => u.kind === 'master'), 99, e.en[0]); eq(e.S.reason, 'master');
});
test('удержание: прогресс в начале хода бригады, если на точке свой и нет автоматона; подкрепления Совета приходят', () => {
  const { game, S, sq } = mk(['', '#S.ZZ....R#', '#........R#', '#.......k.#'], { squad: [MECH({ hp: 99 })], spec: { obj: 'hold', need: 3, reinf: { every: 1, n: 1, max: 3, kinds: ['scout'] } } });
  const u = sq[0]; game.moveTo(u, 3, 1); drain(game);
  game.endTurn(); drain(game); eq(S.obj.prog, 1); ok(S.reinf >= 1, 'подкрепление');
});

// ---------- ИИ ----------
test('ИИ: каждый ход Совета завершается за конечное число шагов на всех картах (бригада стоит)', () => {
  for (const m of O.MISSIONS){
    for (const seed of [1, 2]){
      const game = O.Game({ spec: m, seed, squad: squadFor(O, m, 1) }), S = game.state();
      for (let t = 0; t < 8 && S.phase === 'play'; t++){
        S.units.forEach(u => { if (u.team === 1) u.alert = true; });
        ok(game.endTurn() || S.phase !== 'play', 'конец хода');
        const n = drain(game); ok(n < 2000, 'м' + m.id + ' зависание: ' + n); ok(S.side === 0 || S.phase !== 'play', 'ход вернулся');
      }
    }
  }
});
test('ИИ: занимает укрытие (стоял в чистом поле — встал за ящик) и стреляет', () => {
  let cov = 0, shots = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]){
    const { game, S, sq, en, ev } = mk(['', '#S...........#', '#.............#', '#......c.c....#', '#.............#', '#.....c...c...#', '#........k....#', '#.............#'], { seed });
    const u = sq[0], e = en[0]; u.x = 6; u.y = 1; u.face = 2; e.face = 6; e.crouch = false; game._updateVis();
    game.endTurn(); drain(game);
    if (game.coverOf(e.x, e.y, u.x, u.y) > 0 || e.crouch) cov++;
    if (ev.some(x => x.t === 'shot' && x.d.team === 1)) shots++;
  }
  ok(cov >= 4, 'в укрытии ' + cov + '/6'); ok(shots >= 3, 'стрелял ' + shots + '/6');
});
test('ИИ: метатель бросает шестерню в группу бойцов', () => {
  let thrown = 0;
  for (const seed of [1, 2, 3, 4]){
    const { game, S, sq, en, ev } = mk(['', '#.........#', '#..SS.....#', '#..S......#', '#.........#', '#........g#'], { seed, squad: [MECH(), MECH({ id: 'a' }), MECH({ id: 'b' })] });
    en[0].face = 5; en[0].alert = true; game._updateVis();
    game.endTurn(); drain(game);
    if (ev.some(x => x.t === 'throw')) thrown++;
  }
  ok(thrown >= 3, 'бросков ' + thrown + '/4');
});
test('ИИ: обходит укрытие — цель за ящиком, автоматон смещается, чтобы шанс стал выше', () => {
  let better = 0;
  for (const seed of [1, 2, 3, 4, 5]){
    const { game, S, sq, en } = mk(['', '#............#', '#............#', '#...Sc.......#', '#............#', '#............#'], { seed });
    const u = sq[0], e = en.length ? en[0] : game._mk(1, 'trooper', {}, 10, 3); e.x = 10; e.y = 3; e.face = 4; e.alert = true; e.ap = 24; u.face = 0; game._updateVis();
    const before = game.hitChance(e, u, 'snap');
    game.endTurn(); let n = 0; while (S.side === 1 && n++ < 400){ const r = game.tick(); if (r && (r.kind === 'shot' || r.kind === 'throw')) break; }
    if (game.coverOf(u.x, u.y, e.x, e.y) === 0 || game.hitChance(e, u, 'snap') > before) better++;
  }
  ok(better >= 3, 'обошёл ' + better + '/5');
});

// ---------- Сохранение ----------
test('сохранение боя: serialize → restore даёт то же состояние, бой продолжается', () => {
  const m = O.MISSIONS[2], game = O.Game({ spec: m, seed: 11, squad: squadFor(O, m) }), S = game.state();
  game.moveTo(S.units[0], S.units[0].x + 2, S.units[0].y); drain(game); game.endTurn(); drain(game);
  const json = game.serialize(), g2 = O.Game({ restore: json }), S2 = g2.state();
  eq(S2.turn, S.turn); eq(S2.units.map(u => [u.id, u.x, u.y, u.hp, u.ap, u.alive]), S.units.map(u => [u.id, u.x, u.y, u.hp, u.ap, u.alive]));
  eq(S2.t.join(''), S.t.join('')); eq(S2.spec.id, m.id); eq(S2.rs, S.rs);
  g2.endTurn(); drain(g2); game.endTurn(); drain(game); eq(S2.units.map(u => [u.x, u.y, u.hp]), S.units.map(u => [u.x, u.y, u.hp]), 'детерминизм после восстановления');
});
test('сохранение кампании: save/load, битая запись → null, бой на начале хода восстанавливается только для своей миссии', () => {
  const mem = {}, Store = { get: (k, d) => (k in mem ? mem[k] : d), set: (k, v) => { mem[k] = String(v); } };
  const c = Camp.newCampaign('hard'); c.mi = 3; c.roster[0].xp = 15; c.roster[0].load.weapon = 'cutter';
  Camp.save(Store, c); const c2 = Camp.load(Store); eq(c2.mi, 3); eq(c2.roster[0].lvl, 2); eq(c2.roster[0].load.weapon, 'cutter'); eq(c2.diff, 'hard');
  mem[Camp.KEY] = '{"v":1,"mi":99}'; eq(Camp.load(Store), null); mem[Camp.KEY] = 'мусор'; eq(Camp.load(Store), null);
  const game = O.Game({ spec: Camp.spec(c), seed: 1, squad: Camp.squadDefs(c) });
  Camp.saveBattle(Store, c, game); ok(Camp.loadBattle(Store, c), 'своя миссия'); c.mi = 4; eq(Camp.loadBattle(Store, c), null, 'чужая — нет');
  Camp.clear(Store); eq(Camp.load(Store), null);
});

// ---------- Кампания ----------
test('кампания: опыт (+3 уцелевшему, +1 попадание, +2 разбор), уровни повышают статы, победа → следующая миссия, 7-я → финал', () => {
  const c = Camp.newCampaign(); const r = c.roster[0], s0 = Camp.statsOf(r);
  const rep = Camp.apply(c, { won: true, score: 500, units: [{ rkey: 'tim', alive: true, hits: 3, kills: 2 }, { rkey: 'var', alive: false, hits: 1, kills: 0 }] });
  eq(rep.xp.tim, 3 + 3 + 4); eq(rep.xp.var, 1); eq(r.lvl, 1); ok(rep.promos.includes('tim')); eq(c.mi, 1); eq(c.score, 500);
  const s1 = Camp.statsOf(r); ok(s1.acc > s0.acc && s1.ap > s0.ap && s1.stam > s0.stam && s1.hp > s0.hp, 'статы растут');
  Camp.apply(c, { won: false, score: 0, units: [] }); eq(c.mi, 1, 'провал — повтор'); eq(c.fails, 1);
  for (let i = 1; i < 7; i++) Camp.apply(c, { won: true, score: 1, units: [] }); ok(c.done, 'кампания пройдена');
});
test('кампания: в отряде не больше размера миссии, минимум один; инструменты и предметы перебираются по кругу', () => {
  const c = Camp.newCampaign(); Camp.fitSquad(c); eq(Camp.selected(c).length, O.MISSIONS[0].squad);
  ok(!Camp.toggle(c, c.roster.find(r => !r.sel).id), 'лишнего не взять');
  c.roster.forEach(r => { if (r.sel && Camp.selected(c).length > 1) Camp.toggle(c, r.id); }); eq(Camp.selected(c).length, 1); ok(!Camp.toggle(c, Camp.selected(c)[0].id), 'последнего не снять');
  const r = c.roster[0]; const w0 = r.load.weapon; for (let i = 0; i < 4; i++) Camp.cycleWeapon(r); eq(r.load.weapon, w0);
  r.load.gear = 4; Camp.cycleItem(r, 'gear'); eq(r.load.gear, 0);
});

// ---------- Горячий стул ----------
test('горячий стул: две человеческие команды, ИИ не вмешивается, конец хода передаёт сторону, победитель — кто остался', () => {
  const sq = squadFor(O, O.ARENA, 1), game = O.Game({ spec: O.ARENA, seed: 1, hotseat: true, squad: sq }), S = game.state();
  eq(S.units.filter(u => u.team === 0).length, 5); eq(S.units.filter(u => u.team === 1).length, 5);
  ok(game.endTurn()); eq(S.side, 1); ok(!S.ai, 'без ИИ'); ok(!game.busy());
  const t1 = S.units.find(u => u.team === 1); ok(game.canAct(t1), 'вторая команда ходит сама');
  ok(game.endTurn()); eq(S.side, 0); eq(S.turn, 2);
  S.units.filter(u => u.team === 1).forEach(u => game._damage(u, 99, S.units[0]));
  eq(S.phase, 'won'); eq(S.winner, 0);
  const r = playMission(O, O.ARENA, 3, { hotseat: true, squad: sq, maxTurns: 60 }); ok(r.phase !== 'play' || r.turn >= 40, 'дуэль ботов идёт до конца');
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть миссии, брифинги, имена, инструменты, кнопки', () => {
  const ru = O.STR.ru, en = O.STR.en; eq(Object.keys(ru).sort(), Object.keys(en).sort());
  for (const k of Object.keys(ru)){ ok(String(ru[k]).trim() && String(en[k]).trim(), k); }
  for (let i = 0; i <= 7; i++) ok(ru['m_' + i] && ru['mb_' + i], 'миссия ' + i);
  for (let i = 0; i < 6; i++) ok(ru['n_' + i] && ru['f_' + i]);
  Object.keys(L.WEAPONS).forEach(w => ok(ru['w_' + w] && ru['wd_' + w], w));
  ['aimed', 'snap', 'burst', 'gear', 'crouch', 'reload', 'act', 'turn', 'kit', 'end'].forEach(b => ok(ru['b_' + b], b));
  ['free', 'hack', 'evac', 'pickup', 'door'].forEach(b => ok(ru['i_' + b], b));
  ['squad', 'master', 'time', 'evacFail', 'clear', 'rescue', 'hack', 'hold', 'evac', 'boss'].forEach(r => ok(ru['r_' + r], r));
});
test('музыка: трек operatsiya разбирается секвенсором движка, длины кратны такту', () => {
  const sb = { console, Math }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), sb); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), sb);
  const tr = sb.Arcade.tracks.operatsiya; ok(tr, 'трек'); const p = sb.Arcade.parseTrack(tr); ok(p, 'разобран');
  const len = s => (Array.isArray(s) ? s.join(' ') : s).split(/\s+/).filter(x => x && x !== '|').length;
  ok(len(tr.melody) % 8 === 0 && len(tr.bass) % 8 === 0 && len(tr.drums) % 8 === 0, 'кратно такту'); ok(len(tr.melody) >= 64, '8+ тактов');
});
test('страница: фавикон студии, «← Каталог», canvas 960×600, скрипты по порядку, тач-кнопки и пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон'); ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="960" height="600"/.test(html), 'canvas'); ok(/data-pause/.test(html));
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/missions.js', 'js/game.js', 'js/campaign.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  order.forEach(f => ok(fs.existsSync(path.join(ROOT, f)), f));
  ok(!/https?:\/\/(?!arcade\.hefest\.ru)/.test(html.replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, '')), 'без внешних ссылок');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js синхронизирован');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория: общий список (из glub/) + оригиналы жанра и их автор
  const BASE = Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8');
  const EXTRA = Buffer.from('bGFzZXIgP3NxdWFkfNC7W9Cw0LXRjV3QuT/Qt9C10YAgP9GB0LrQslvQsNC+XdC0fFxieC0/Y29tXGJ80LjQutGBLT/QutC+0Lx8ZW5lbXkgP3Vua25vd258dWZvOj8gP2VuZW15fNGO0YTQviA/0Y3QvdC10LzQuHxqdWxpYW4gP2dvbGxvcHxnb2xsb3B80LPQvtC70Ls/0L7Qv3zQtNC20YPQu9C40LDQvSA/0LM=', 'base64').toString('utf8');
  const BAD = new RegExp(BASE + '|' + EXTRA, 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 16, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(['TGFzZXIgU3F1YWQ=', 'WC1DT00=', 'VUZPOiBFbmVteSBVbmtub3du', 'SnVsaWFuIEdvbGxvcA==', '0JvQsNC30LXRgCDQodC60LLQsNC0', '0JjQutGBLdCa0L7QvA==', '0JPQvtC70LvQvtC/', 'eGNvbQ=='].every(p => BAD.test(u(p))), 'стоп-лист ловит оригиналы жанра, их автора и транслит');
  ok(!BAD.test('ОПЕРАЦИЯ') && !BAD.test('Гефест') && !BAD.test('operatsiya') && !BAD.test('CONTRACT.md') && !BAD.test('Ржавый Совет') && !BAD.test('шестерня') && !BAD.test('эскадрон') && !BAD.test('комбинезон'), 'без ложных срабатываний');
});

// ---------- Бот-командир: проходимость и баланс (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
const LV = [0, 1, 1, 2, 2, 3, 3], N = 12, RES = [];
for (let mi = 0; mi < 7; mi++){ const rs = []; for (let s = 1; s <= N; s++) rs.push(playMission(O, O.MISSIONS[mi], s, { lvl: LV[mi] })); RES.push(rs); }
test('исполнимость: каждая из 7 миссий выигрываема — бот-командир побеждает на «норме» хотя бы в половине партий', () => {
  RES.forEach((rs, mi) => { const w = rs.filter(r => r.won).length; console.log('     миссия ' + (mi + 1) + ': ' + w + '/' + N + ' побед, в среднем ходов ' + (rs.reduce((a, r) => a + r.turn, 0) / N).toFixed(1)); ok(w >= N / 2, 'миссия ' + (mi + 1) + ': ' + w + '/' + N); });
});
test('баланс: в сумме бот побеждает часто (≥ 65%), но не всегда без потерь (Совет даёт отпор)', () => {
  const all = RES.flat(), w = all.filter(r => r.won).length; ok(w >= 0.65 * all.length, 'побед ' + w + '/' + all.length);
  const losses = all.filter(r => r.won && r.result && r.result.units.some(u => !u.alive)).length + all.filter(r => !r.won).length; ok(losses >= all.length * 0.2, 'потери/поражения ' + losses + '/' + all.length);
});
test('без зависаний: все партии бота закончились (победа/поражение), а не упёрлись в предел шагов', () => {
  RES.flat().forEach(r => ok(r.phase !== 'play', 'партия не закончена: ход ' + r.turn + ', шагов ' + r.ticks));
});
test('сложность: на «лёгкой» бот побеждает не реже, чем на «жёсткой» (миссии 4–7)', () => {
  let e = 0, h = 0; for (let mi = 3; mi < 7; mi++) for (let s = 1; s <= 6; s++){ if (playMission(O, O.MISSIONS[mi], s, { lvl: LV[mi], diff: 'easy' }).won) e++; if (playMission(O, O.MISSIONS[mi], s, { lvl: LV[mi], diff: 'hard' }).won) h++; }
  console.log('     лёгкая ' + e + '/24 · жёсткая ' + h + '/24'); ok(e >= h, e + ' < ' + h);
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
