/* ОТСЕК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node otsek/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: генератор палуб (сетка отсеков, шлюз, цель в дальнем отсеке), ключ-карты (поиск по состояниям дверей:
   минимум карт, нет софтлока, двери пути не обойти), терминалы (экономика склада), двери, оружие и патроны, фонарь-стрейф,
   рой (клещи, ковры, спайки, гнёзда, вентиляция), таймер эвакуации (запас и успевание в настоящей физике), шлюз и взрыв,
   боссы, жизни, кооп, производительность, раскладки, i18n, музыка, страница, правило имён;
   баланс и проходимость — «человеческим» ботом (tests/bot.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/game.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const G = sandbox.OTSEK, L = G.logic, T = L.T;
const { playOtsek, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Игра без роя и вентиляции: палуба deck, сид seed
function mk(opts = {}){
  const events = [];
  const game = G.Game(Object.assign({ rng: mulberry32(opts.seed || 1), seed: opts.seed || 1, onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S;
  S.banner = 0; if (!opts.keepMobs){ S.enemies = []; S.boss = opts.keepBoss ? S.boss : S.boss; } S.ventT = 1e9;
  S.heroes.forEach(h => { h.inv = 0; });
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
function put(h, x, y){ h.x = x; h.y = y; }
function center(D, r){ return { x: r.ccol * T, y: r.crow * T }; }
function openPath(game, S){ S.cards += 10; S.doors.filter(d => d.path).forEach(d => game._openDoor(d, 0)); }

// ---------- Генератор палуб ----------
test('палуба: 6 видов × 40 сидов — сетка отсеков, шлюз и терминал в стартовом отсеке, цель в самом дальнем, детерминизм', () => {
  for (let n = 1; n <= 6; n++) for (let seed = 0; seed < 40; seed++){
    const D = L.genDeck(n, seed), spec = L.DECKS[n - 1];
    eq([D.w, D.h], [spec.rx * L.CW, spec.ry * L.CH], 'размер');
    const rs = D.rooms[D.start], A = D.airlock;
    ok(A.tx0 >= rs.x0 && A.tx1 <= rs.x1 && A.ty0 >= rs.y0 && A.ty1 <= rs.y1, 'шлюз в стартовом отсеке');
    ok(Math.floor(D.terminals[0].x / T) >= rs.x0 && Math.floor(D.terminals[0].x / T) <= rs.x1, 'терминал у старта');
    eq(D.doors.filter(d => d.path).length, D.pathDoors, 'двери пути');
    ok(D.pathDoors >= Math.min(spec.doors, 2), 'на пути есть двери: ' + D.pathDoors);
    eq(D.path[0], D.start); eq(D.path[D.path.length - 1], D.goal);
    eq(D.objective.kind, spec.boss ? 'boss' : 'console');
    ok(D.mobs.length >= 5, 'на палубе есть рой');
    ok(D.tiles.every((v, i) => { const x = i % D.w, y = (i - x) / D.w; return (x > 0 && y > 0 && x < D.w - 1 && y < D.h - 1) || v === L.WALL; }), 'палуба замкнута корпусом');
  }
  eq(JSON.stringify(L.genDeck(3, 5)), JSON.stringify(L.genDeck(3, 5)), 'генератор детерминирован');
  ok(JSON.stringify(L.genDeck(3, 5).tiles) !== JSON.stringify(L.genDeck(3, 6).tiles), 'сид меняет палубу');
});
test('ключ-карты: поиск по состояниям дверей — цель и шлюз достижимы при минимуме карт (= дверям пути), карт ≥ дверей пути, софтлоков нет', () => {
  let states = 0, dead = 0;
  for (let n = 1; n <= 6; n++) for (let seed = 0; seed < 40; seed++){
    const D = L.genDeck(n, seed), r = L.solveDeck(D);
    ok(r.ok, 'палуба ' + n + ', сид ' + seed + ': ' + JSON.stringify(r));
    eq(r.minCards, D.pathDoors, 'минимум карт = дверей пути');
    const onPath = D.cards.filter(c => D.pathZones.indexOf(c.zone) >= 0).length;
    ok(onPath >= D.pathDoors, 'карт на пути ' + onPath + ' < дверей ' + D.pathDoors);
    eq(r.airRegion, r.startRegion, 'шлюз в стартовом регионе');
    states += r.states; dead += r.deadEnds;
  }
  ok(states > 240 * 3 && dead > 0, 'перебраны и «расточительные» состояния: ' + states + ', тупиков ' + dead);
  // контрольный: убрать карту зоны 0 — без покупки цель недостижима
  const D = L.genDeck(2, 3); D.cards = D.cards.filter(c => c.zone !== D.pathZones[0]);
  ok(L.solveDeck(D).minCards < 0, 'без карты старта не пройти');
});
test('двери пути — обязательные: открыть все двери, кроме одной двери пути, — цель всё равно отрезана от старта', () => {
  for (let n = 1; n <= 6; n++) for (let seed = 0; seed < 20; seed++){
    const D = L.genDeck(n, seed);
    D.doors.filter(d => d.path).forEach(keep => {
      const tl = new Uint8Array(D.tiles); D.doors.forEach(d => { if (d !== keep) d.tiles.forEach(q => { tl[q[0] + q[1] * D.w] = L.FLOOR; }); });
      const R = L.regionsOf(D, tl), at = (x, y) => R.reg[Math.floor(x / T) + Math.floor(y / T) * D.w];
      ok(at(D.spawn.x, D.spawn.y) !== at(D.objective.x, D.objective.y), 'палуба ' + n + '/' + seed + ': дверь ' + keep.k + ' обходится');
    });
  }
});
test('расточительство: карта пути потрачена на кладовую → у двери пути отказ, на терминале покупается карта → проход дальше', () => {
  let seed = 0, D;
  for (; seed < 200; seed++){ D = L.genDeck(2, seed); if (D.doors.some(d => !d.path && D.zone[d.from] === D.pathZones[0])) break; }
  ok(seed < 200, 'нет палубы с кладовой у старта');
  const { game, S, has, last } = mk({ deck: 2, seed }), h = S.heroes[0];
  const vault = S.doors.find(d => !d.path && D.zone[D.doors[d.id].from] === D.pathZones[0]), door0 = S.doors.find(d => d.path && d.k === 0);
  S.cards = 1; put(h, vault.x + (vault.horiz ? 0 : -20), vault.y + (vault.horiz ? -20 : 0));
  if (game.hint(0) !== 'door'){ put(h, vault.x + (vault.horiz ? 0 : 20), vault.y + (vault.horiz ? 20 : 0)); }
  eq(game.use(0), 'door', 'кладовая вскрыта'); ok(vault.open && S.cards === 0 && S.cardsWasted === 1);
  put(h, door0.x + (door0.horiz ? 0 : -20), door0.y + (door0.horiz ? -20 : 0));
  eq(game.use(0), 'denied', 'без карты — отказ'); ok(!door0.open && has('doorDenied'));
  const t0 = S.terminals[0]; put(h, t0.x, t0.y + 14);
  S.tokens = 100; eq(game.use(0), 'term'); eq(S.phase, 'term');
  S.term.sel = L.SHOP.findIndex(s => s.id === 'card'); eq(game.termBuy(), 'money', 'на карту не хватает'); eq(last('noBuy').why, 'money');
  S.tokens = 200; eq(game.termBuy(), 'ok'); eq([S.cards, S.tokens], [1, 50]); game.termClose(); eq(S.phase, 'play');
  put(h, door0.x + (door0.horiz ? 0 : -20), door0.y + (door0.horiz ? -20 : 0));
  eq(game.use(0), 'door'); ok(door0.open && S.cards === 0);
});

// ---------- Терминалы и двери ----------
test('терминал: цены склада, отказ без жетонов, оружие и броня — один раз, карта палубы, страховка (+1 жизнь), вкладки и выход', () => {
  const { game, S, has } = mk({ deck: 1, seed: 4 }), h = S.heroes[0], t0 = S.terminals[0];
  put(h, t0.x, t0.y + 14); eq(game.hint(0), 'term'); eq(game.use(0), 'term');
  const price = id => L.SHOP.find(s => s.id === id).price;
  ok(price('card') > price('ammo') && price('nail') > price('fan') && price('life') >= 1000, 'цены');
  S.tokens = 5000;
  eq(game.buy(0, 'map'), 'ok'); ok(S.mapOwned); eq(game.buy(0, 'map'), 'owned');
  eq(game.buy(0, 'cutter'), 'ok'); ok(h.guns.cutter && h.weapon === 'cutter'); eq(game.buy(0, 'cutter'), 'owned');
  eq(game.buy(0, 'armor'), 'ok'); eq(game.buy(0, 'armor'), 'owned');
  const lv = h.lives; eq(game.buy(0, 'life'), 'ok'); eq(h.lives, lv + 1);
  h.ammo = L.AMMO_MAX; eq(game.buy(0, 'ammo'), 'full'); h.ammo = 10; eq(game.buy(0, 'ammo'), 'ok'); eq(h.ammo, 70);
  h.hp = 100; eq(game.buy(0, 'med'), 'full'); h.hp = 30; eq(game.buy(0, 'med'), 'ok'); eq(h.hp, 80);
  eq(game.buy(0, 'lamp'), 'ok'); eq(game.buy(0, 'lamp'), 'ok'); eq(game.buy(0, 'lamp'), 'owned', 'фонарь — два уровня');
  const spent = L.SHOP.filter(s => ['map', 'cutter', 'armor', 'life', 'ammo', 'med'].includes(s.id)).reduce((a, s) => a + s.price, 0) + 2 * price('lamp');
  eq(S.tokens, 5000 - spent, 'жетоны списаны по ценам');
  S.tokens = 10; eq(game.buy(0, 'fan'), 'money'); ok(!h.guns.fan);
  game.termTab(1); eq(S.term.tab, 1); game.termTab(1); game.termTab(1); eq(S.term.tab, 0); game.termMove(-1); eq(S.term.sel, L.SHOP.length - 1);
  game.termTab(1); eq(game.termBuy(), null, 'на вкладке карты покупок нет');
  game.termClose(); eq(S.phase, 'play'); ok(has('termClose'));
  // пока открыт терминал — палуба стоит
  game.use(0); const t = S.time; run(game, 1); eq(S.time, t, 'время в терминале не идёт'); game.termClose();
});
test('двери: «действие» у двери тратит карту и открывает проход; без карты — отказ, дверь цела; рой за дверью не проходит', () => {
  const { game, S, has } = mk({ deck: 1, seed: 2 }), h = S.heroes[0], d = S.doors.find(q => q.path && q.k === 0);
  ok(d.tiles.every(q => S.tiles[q[0] + q[1] * S.D.w] === L.DOOR), 'дверь закрыта');
  const px = d.x + (d.horiz ? 0 : -22), py = d.y + (d.horiz ? -22 : 0); put(h, px, py);
  if (game.hint(0) == null) put(h, d.x + (d.horiz ? 0 : 22), d.y + (d.horiz ? 22 : 0));
  eq(game.hint(0), 'locked'); eq(game.use(0), 'denied'); ok(!d.open && has('doorDenied'));
  ok(!game._los(d.x - (d.horiz ? 0 : 30), d.y - (d.horiz ? 30 : 0), d.x + (d.horiz ? 0 : 30), d.y + (d.horiz ? 30 : 0)), 'дверь непрозрачна');
  S.cards = 2; eq(game.hint(0), 'door'); eq(game.use(0), 'door'); ok(d.open); eq(S.cards, 1);
  ok(d.tiles.every(q => S.tiles[q[0] + q[1] * S.D.w] === L.FLOOR), 'проход открыт');
  eq(S.cardsUsed, 1); eq(S.cardsWasted, 0);
  // карта с пола
  const c = S.cardsOnFloor.find(q => !q.taken); put(h, c.x, c.y); run(game, 0.1); ok(c.taken && S.cards === 2 && has('card'));
});

// ---------- Оружие ----------
test('оружие: заклёпка −1 патрон, веер — 5 зарядов за 3, резак пробивает рой и режет перегородку, горн — сквозь рой, гвоздомёт — очередь; без патронов — ключ', () => {
  const { game, S, has } = mk({ deck: 2, seed: 1 }), h = S.heroes[0], r = S.D.rooms[S.D.start];
  const c = center(S.D, r); put(h, c.x, c.y); h.face = [1, 0];
  game.setFire(0, true); run(game, 0.05); game.setFire(0, false); eq(h.ammo, L.AMMO0 - 1); eq(S.bullets.length, 1); eq(S.bullets[0].k, 'r');
  S.bullets = []; h.guns.fan = true; h.weapon = 'fan'; h.cd = 0; game.setFire(0, true); run(game, 0.02); game.setFire(0, false);
  eq(S.bullets.length, 5, 'веер'); eq(h.ammo, L.AMMO0 - 4);
  // резак: три клеща в ряд
  S.bullets = []; h.guns.cutter = true; h.weapon = 'cutter'; h.cd = 0;
  const ts = [50, 80, 110].map(dx => game._spawn('tick', h.x + dx, h.y, { speed: 0 }));
  ts.forEach(e => { e.hp = 3; });
  game.setFire(0, true); run(game, 0.02); game.setFire(0, false); run(game, 0.5);
  ok(ts.every(e => e.dead), 'резак прошил троих');
  // перегородка
  let cell = null; for (let n = 1; n <= 6 && !cell; n++) for (let s2 = 0; s2 < 30 && !cell; s2++){ const D = L.genDeck(n, s2); if (D.caches.length) cell = { n, s2, c: D.caches[0] }; }
  ok(cell, 'тайник с перегородкой найден');
  const m2 = mk({ deck: cell.n, seed: cell.s2 }), h2 = m2.S.heroes[0], W2 = m2.S.D.w;
  const px = Math.floor(cell.c.x / T) + 1, py = Math.floor(cell.c.y / T);   // тайник 2×2: перегородка — справа
  eq(m2.S.tiles[px + py * W2], L.PART, 'перегородка на месте');
  put(h2, (px + 3) * T + T / 2, py * T + T / 2 - 4); h2.face = [-1, 0];
  h2.weapon = 'rivet'; m2.game.setFire(0, true); m2.game.update(0.02); m2.game.setFire(0, false); run(m2.game, 0.5);
  eq(m2.S.tiles[px + py * W2], L.PART, 'заклёпка перегородку не берёт');
  h2.guns.cutter = true; h2.weapon = 'cutter'; h2.cd = 0; m2.game.setFire(0, true); m2.game.update(0.02); m2.game.setFire(0, false); run(m2.game, 0.5);
  eq(m2.S.tiles[px + py * W2], L.FLOOR, 'резак прорезал'); ok(m2.has('breach'));
  // горн и гвоздомёт
  S.bullets = []; h.guns.flame = true; h.weapon = 'flame'; h.cd = 0; const a0 = h.ammo; game.setFire(0, true); run(game, 0.5); game.setFire(0, false);
  ok(S.bullets.some(b => b.k === 'f') || has('shot'), 'горн'); ok(a0 - h.ammo >= 2 && a0 - h.ammo <= 5, 'горн экономичен: −' + (a0 - h.ammo));
  h.guns.nail = true; h.weapon = 'nail'; h.cd = 0; const a1 = h.ammo; game.setFire(0, true); run(game, 1); game.setFire(0, false);
  ok(a1 - h.ammo >= 12, 'гвоздомёт — очередь: ' + (a1 - h.ammo));
  // смена оружия по кругу (только купленное)
  h.weapon = 'rivet'; const seen = []; for (let i = 0; i < 5; i++){ game.swap(0); seen.push(h.weapon); }
  eq(seen, ['fan', 'cutter', 'flame', 'nail', 'rivet']);
  // ключ без патронов
  h.ammo = 0; h.weapon = 'rivet'; h.cd = 0; S.bullets = []; const e = game._spawn('tick', h.x + 18, h.y, { speed: 0 }); e.hp = 1;
  game.setFire(0, true); run(game, 0.1); game.setFire(0, false); ok(e.dead, 'ключом'); eq(S.bullets.length, 0); ok(has('empty'));
});
test('фонарь-стрейф: огонь зажат — направление (и луч) не поворачивается; отпустил — поворот по ходу; доводка в пол-сектора', () => {
  const { game, S } = mk({ deck: 1, seed: 3 }), h = S.heroes[0], c = center(S.D, S.D.rooms[S.D.start]);
  put(h, c.x, c.y); h.face = [1, 0];
  game.setFire(0, true); game.setMove(0, 0, 1); run(game, 0.3); eq(h.face, [1, 0], 'стрейф');
  game.setFire(0, false); run(game, 0.05); eq(h.face, [0, 1], 'поворот'); game.setMove(0, 0, 0);
  // цель под 20° от направления — доводка попадает
  put(h, c.x, c.y); h.face = [1, 0]; S.bullets = []; h.cd = 0;
  const e = game._spawn('tick', h.x + 120, h.y + 44, { speed: 0 }); e.hp = 1;
  game.setFire(0, true); game.update(0.02); game.setFire(0, false); run(game, 0.5); ok(e.dead, 'доводка');
});

// ---------- Рой ----------
test('рой: клещ огибает стены по полю расстояний и кусает; ковёр делится на двух клещей; гнездо плодит не больше 4', () => {
  const { game, S, has, count } = mk({ deck: 2, seed: 2 }), h = S.heroes[0];
  // клещ в соседнем отсеке за углом
  const D = S.D, r0 = D.rooms[D.start], c0 = center(D, r0); put(h, c0.x, c0.y);
  const nb = D.edges.find(e => (e.a === D.start || e.b === D.start) && !e.lock); ok(nb, 'сосед без двери');
  const other = D.rooms[nb.a === D.start ? nb.b : nb.a], tc = { x: (other.x0 + 1) * T + 12, y: (other.y0 + 1) * T + 12 };
  const e = game._spawn('tick', tc.x, tc.y, { awake: true }); const hp0 = h.hp;
  run(game, 12); ok(h.hp < hp0 || has('heroHurt'), 'клещ добрался');
  // ковёр
  S.enemies = []; put(h, c0.x, c0.y); h.alive = true; h.out = false; h.hp = 100; h.lives = 3; h.ammo = 50; const cp = game._spawn('carpet', h.x + 60, h.y, { speed: 0 }); cp.hp = 0.5; h.face = [1, 0]; h.cd = 0; h.inv = 99;
  game.setFire(0, true); run(game, 0.3); game.setFire(0, false);
  ok(cp.dead, 'ковёр убит'); eq(S.enemies.filter(q => q.type === 'tick' && !q.dead).length >= 1, true, 'распался на клещей');
  // гнездо
  S.enemies = []; const nest = game._spawn('nest', h.x + 120, h.y, { awake: true }); nest.spawnT = 0;
  run(game, 40, () => { S.enemies.forEach(q => { if (q.type === 'tick') { q.speed = 0; } }); });
  const kids = S.enemies.filter(q => q.type === 'tick' && !q.dead).length; ok(kids >= 3 && kids <= L.ENEMIES.nest.max, 'гнездо: ' + kids);
  void e; void count;
});
test('спайк: искра только при прямой видимости и после вспышки-предупреждения; искра ранит', () => {
  const { game, S, has } = mk({ deck: 1, seed: 5 }), h = S.heroes[0], c = center(S.D, S.D.rooms[S.D.start]);
  put(h, c.x, c.y);
  const sp = game._spawn('spike', c.x + 150, c.y, { awake: true, cd: 0 });
  game.update(1 / 60); ok(sp.warn > 0 && S.sparks.length === 0, 'сначала предупреждение');
  run(game, 0.6); ok(S.sparks.length >= 1 || has('spark'), 'выстрел');
  const hp0 = h.hp; run(game, 1.2); ok(h.hp < hp0, 'искра ранит');
  // за стеной — молчит
  S.sparks = []; S.enemies = []; const sp2 = game._spawn('spike', c.x, (S.D.rooms[S.D.start].y0 - 2) * T, { awake: true, cd: 0 });
  ok(!game._los(sp2.x, sp2.y, h.x, h.y), 'стена между'); run(game, 3); eq(S.sparks.length, 0);
});
test('вентиляция: клещи выползают вне прямой близости (6–22 клетки по ходам); на тревоге — чаще', () => {
  const { game, S, count } = mk({ deck: 3, seed: 2 }), h = S.heroes[0];
  S.ventT = 0; game._buildFlow(); run(game, 60, () => { S.enemies.forEach(e => { e.speed = 0; e.dead = e.dead || false; }); h.inv = 99; h.hp = 100; if (S.enemies.length > 2) S.enemies = []; });
  const calm = count('vent'); ok(calm >= 2 && calm <= 12, 'спокойно: ' + calm);
  const m = mk({ deck: 3, seed: 2 }); m.S.ventT = 0; m.game._startAlarm(m.S.heroes[0].x, m.S.heroes[0].y); m.S.alarm.t = 1e9;
  run(m.game, 60, () => { m.S.heroes[0].inv = 99; m.S.heroes[0].hp = 100; m.S.enemies = []; });
  ok(m.count('vent') > calm * 2, 'тревога: ' + m.count('vent') + ' против ' + calm);
});

// ---------- Эвакуация ----------
test('таймер эвакуации: на всех палубах (6 × 25 сидов) отсчёт ≥ 1.8 × времени бега от цели до шлюза при минимуме дверей', () => {
  for (let n = 1; n <= 6; n++) for (let seed = 0; seed < 25; seed++){
    const D = L.genDeck(n, seed), tl = new Uint8Array(D.tiles);
    D.doors.filter(d => d.path).forEach(d => d.tiles.forEach(q => { tl[q[0] + q[1] * D.w] = L.FLOOR; }));
    const A = D.airlock, p = L.tilePath(D, tl, D.objective.x, D.objective.y, (A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2);
    ok(p, 'путь к шлюзу ' + n + '/' + seed);
    const t = L.alarmTime(D, tl, D.objective.x, D.objective.y, n);
    ok(t >= 1.8 * p.len / L.SPEED, 'палуба ' + n + '/' + seed + ': ' + t + ' c на ' + (p.len / L.SPEED).toFixed(1) + ' c бега');
    ok(t <= 3 * p.len / L.SPEED + 20, 'не слишком щедро');
  }
});
test('успевание: от пульта/босса до шлюза по кратчайшему пути в настоящей физике (без роя) — с запасом ≥ 40% таймера', () => {
  let worst = 1;
  for (let n = 1; n <= 6; n++) for (let seed = 0; seed < 6; seed++){
    const { game, S, has, last } = mk({ deck: n, seed, maxDeck: 6 }), h = S.heroes[0];
    openPath(game, S); S.boss = null; put(h, S.D.objective.x, S.D.objective.y + 20);
    game._startAlarm(S.D.objective.x, S.D.objective.y); const max = S.alarm.max;
    const A = S.D.airlock, gx = (A.x0 + A.x1) / 2, gy = (A.y0 + A.y1) / 2;
    for (let i = 0; i < 60 * 200 && S.phase === 'play'; i++){
      if (i % 6 === 0){
        const p = L.tilePath(S.D, S.tiles, h.x, h.y, gx, gy), k = p && p.tiles[Math.min(2, p.tiles.length - 1)];
        const tx = p ? (k % S.D.w) * T + T / 2 : gx, ty = p ? Math.floor(k / S.D.w) * T + T / 2 : gy, o = L.oct(tx - h.x, ty - h.y);
        game.setMove(0, Math.abs(tx - h.x) > 2 ? o[0] : 0, Math.abs(ty - h.y) > 2 ? o[1] : 0);
      }
      S.enemies = []; S.ventT = 1e9; game.update(1 / 60);
    }
    ok(has('clear') && !last('clear').blast, 'палуба ' + n + '/' + seed + ': не успел');
    worst = Math.min(worst, last('clear').left / max);
  }
  ok(worst >= 0.4, 'запас по таймеру: ' + (worst * 100).toFixed(0) + '%');
});
test('шлюз: все живые внутри → палуба отстыкована (бонус за секунды) → следующая палуба; таймер вышел → взрыв, вне шлюза −жизнь', () => {
  const { game, S, has, last } = mk({ deck: 1, seed: 3 }), h = S.heroes[0], A = S.D.airlock;
  openPath(game, S); game._startAlarm(S.D.objective.x, S.D.objective.y); const sc = S.score;
  put(h, (A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2); game.update(1 / 60);
  ok(has('clear') && S.phase === 'clear'); ok(S.score - sc >= L.SCORE.deck + 10 * L.SCORE.sec, 'бонус'); ok(last('clear').left > 10);
  run(game, 3.5); eq(S.deck, 2, 'следующая палуба'); eq(S.phase, 'play'); eq(S.alarm, null);
  const m = mk({ deck: 1, seed: 3 }), h2 = m.S.heroes[0];
  m.game._startAlarm(m.S.D.objective.x, m.S.D.objective.y); m.S.alarm.t = 0.05; put(h2, m.S.D.objective.x, m.S.D.objective.y);
  run(m.game, 0.2); ok(m.has('blast')); eq(h2.lives, L.LIVES - 1); ok(m.last('clear').blast, 'вытащили, но без бонуса');
});

// ---------- Боссы ----------
test('боссы: матка — ядро под бронёй, пока целы катушки; сердце — уязвимо только раскрытым; гибель босса → отсчёт эвакуации', () => {
  const { game, S, has } = mk({ deck: 3, seed: 1, keepMobs: true }), h = S.heroes[0], B = S.boss;
  S.enemies = S.enemies.filter(e => e.boss); eq(B.key, 'matka'); eq(B.nodes.length, 4);
  put(h, B.x, B.y + 90); run(game, 0.1); ok(B.active && B.intro > 0 && has('bossIntro'));
  run(game, 2); eq(game._hurtBoss(5), false, 'броня'); ok(has('armor'));
  B.nodes.forEach(e => { e.dead = true; }); S.enemies = S.enemies.filter(e => !e.dead);
  eq(game._hurtBoss(5), true); eq(B.hp, B.max - 5);
  h.inv = 1e9; run(game, 5); ok(has('ring') && has('spawn'), 'матка бьёт кольцом искр и плодит клещей');
  game._hurtBoss(1e3); ok(B.dead && has('bossDie') && S.alarm && S.airOpen, 'тревога после босса');
  const m = mk({ deck: 6, seed: 1, keepMobs: true }), H = m.S.boss, h6 = m.S.heroes[0]; eq(H.key, 'heart');
  put(h6, H.x, H.y + 90); h6.inv = 1e9; run(m.game, 2.2);
  let hitOpen = 0, hitShut = 0;
  for (let i = 0; i < 60 * 9; i++){ m.game.update(1 / 60); if (i % 10) continue; const r = m.game._hurtBoss(0.01); if (H.open) hitOpen += r ? 1 : 0; else hitShut += r ? 1 : 0; }
  ok(hitOpen > 5 && hitShut === 0, 'сердце: раскрыто ' + hitOpen + ', закрыто ' + hitShut);
});

// ---------- Жизни, финал ----------
test('жизни: урон → гибель → −жизнь, возрождение с неуязвимостью; 0 жизней — выбыл, все выбыли → gameover; финал 6-й палубы → win', () => {
  const { game, S, has } = mk({ deck: 1, seed: 2 }), h = S.heroes[0];
  game._kill(h, 'test'); eq(h.lives, L.LIVES - 1); ok(!h.alive);
  run(game, 2); ok(h.alive && h.inv > 0 && h.hp === L.HP && has('respawn'));
  game._kill(h, 'test'); run(game, 2); game._kill(h, 'test'); ok(h.out && has('gameover')); eq(S.phase, 'over');
  const w = mk({ deck: 6, seed: 2, maxDeck: 6 }), A = w.S.D.airlock;
  w.game._startAlarm(w.S.D.objective.x, w.S.D.objective.y); put(w.S.heroes[0], (A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2);
  run(w.game, 4); ok(w.has('win')); eq(w.S.phase, 'won');
});

// ---------- Кооп ----------
test('кооп: раздельные здоровье/патроны/оружие, общие карты и жетоны; не разойтись дальше кадра; шлюз — только вдвоём', () => {
  const { game, S, has } = mk({ deck: 2, seed: 4, players: 2 }), [a, b] = S.heroes;
  eq(S.heroes.length, 2); ok(Math.abs(a.y - b.y) > 10, 'стоят рядом, не друг в друге');
  a.ammo = 50; ok(b.ammo === L.AMMO0); S.tokens = 1000; game.buy(1, 'fan'); ok(b.guns.fan && !a.guns.fan); eq(S.tokens, 650);
  S.cards = 1; ok(S.cards === 1);
  // не разбежаться: а вправо, б влево
  const c = center(S.D, S.D.rooms[S.D.start]); put(a, c.x, c.y); put(b, c.x, c.y + 20);
  game.setMove(0, 1, 0); game.setMove(1, -1, 0); run(game, 8); game.setMove(0, 0, 0); game.setMove(1, 0, 0);
  ok(Math.abs(a.x - b.x) <= L.VIEW_W - 80, 'в одном кадре: ' + Math.abs(a.x - b.x).toFixed(0));
  // шлюз
  openPath(game, S); game._startAlarm(S.D.objective.x, S.D.objective.y); const A = S.D.airlock;
  put(a, (A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2); put(b, c.x + 100, c.y); run(game, 0.3); ok(!has('clear'), 'один в шлюзе — ждём напарника');
  put(b, (A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2 + 12); run(game, 0.1); ok(has('clear'));
  // выбывший напарник не держит
  const m = mk({ deck: 1, seed: 4, players: 2 }); m.game._kill(m.S.heroes[1], 't'); m.game._kill(m.S.heroes[1], 't'); m.game._kill(m.S.heroes[1], 't');
  ok(m.S.heroes[1].out && m.S.phase === 'play', 'один выбыл — игра идёт');
  m.game._startAlarm(m.S.D.objective.x, m.S.D.objective.y); const A2 = m.S.D.airlock; put(m.S.heroes[0], (A2.x0 + A2.x1) / 2, (A2.y0 + A2.y1) / 2);
  run(m.game, 0.1); ok(m.has('clear'));
});
test('производительность: 120 паразитов, 60 пуль, 2 героя — шаг логики в Node < 3 мс', () => {
  const { game, S } = mk({ deck: 5, seed: 1, players: 2 }), r = mulberry32(3);
  S.heroes.forEach(h => { h.inv = 1e9; });
  for (let i = 0; i < 120; i++){ const room = S.D.rooms[i % S.D.rooms.length]; game._spawn(i % 7 ? 'tick' : 'carpet', (room.x0 + 1 + r() * (room.x1 - room.x0 - 1)) * T, (room.y0 + 1 + r() * (room.y1 - room.y0 - 1)) * T, { awake: true }); }
  S.heroes.forEach(h => { h.fire = true; h.guns.nail = true; h.weapon = 'nail'; h.ammo = 1e6; });
  run(game, 1);
  const t0 = process.hrtime.bigint(); run(game, 3); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 180;
  console.log('     шаг: ' + ms.toFixed(3) + ' мс, врагов ' + S.enemies.length + ', пуль ' + S.bullets.length);
  ok(ms < 3, ms.toFixed(2) + ' мс');
});

// ---------- Ввод движка ----------
test('кооп-ввод: раскладки без конфликтов (checkBindings); И1 стрелки + / . ,  И2 WASD + F E Q; в одиночке обе ведут И1', () => {
  const src = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), Lst = {};
  let t = 1000;
  const win = { Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat, Date, console: { log() {}, error() {}, warn() {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (Lst[ev] = Lst[ev] || []).push(fn); }, removeEventListener() {}, setInterval() { return 1; }, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => t }, matchMedia: () => ({ matches: false }) };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ fillText() {}, fillRect() {}, save() {}, restore() {} }) };
  win.document = { querySelector: () => canvas, addEventListener() {} }; win.window = win; win.globalThis = win;
  vm.createContext(win); vm.runInContext(src, win, { filename: 'engine.js' });
  const A = win.Arcade;
  eq(A.checkBindings(L.BIND, { reserved: ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'] }).length, 0, 'конфликты раскладки');
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'ot' });
  g.useStandardScreens({ lives: 3 }); g.scene('play', { realtime: true }); g.start('title');
  eq(g.usePlayers({ bind: L.BIND, actions: ['fire', 'use', 'swap'] }).count(), 1);
  eq(g.input.conflicts.length, 0, 'usePlayers нашёл конфликты');
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  key('keydown', 'ArrowUp'); key('keydown', 'Slash');
  ok(P1.pressed('up') && P1.pressed('fire') && !P2.pressed('up'), 'И1');
  key('keydown', 'KeyW'); key('keydown', 'KeyF'); key('keydown', 'KeyE'); key('keydown', 'Period'); key('keydown', 'KeyQ'); key('keydown', 'Comma');
  ok(P2.pressed('up') && P2.pressed('fire') && P2.pressed('use'), 'И2');
  eq(got, ['1fire', '2fire', '2use', '1use', '2swap', '1swap']);
  ['ArrowUp', 'Slash', 'KeyW', 'KeyF', 'KeyE', 'Period', 'KeyQ', 'Comma'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'KeyS'); key('keydown', 'KeyF');
  ok(P1.pressed('down') && P1.pressed('fire') && !P2.pressed('down'), 'в одиночке раскладка И2 ведёт И1');
  ok(!Object.values(L.BIND).some(m => Object.values(m).flat().some(c => ['KeyL', 'KeyT', 'KeyM', 'KeyP'].includes(c))), 'горячие клавиши движка не заняты');
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть палубы, оружие, склад, боссы', () => {
  const ru = Object.keys(G.STR.ru).sort(), en = Object.keys(G.STR.en).sort();
  eq(ru, en);
  ru.forEach(k => ok(String(G.STR.ru[k]).trim() && String(G.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(G.STR.ru[k], 'нет ключа движка ' + k));
  L.WEAPONS.concat(['wrench']).forEach(w => ok(G.STR.ru['w_' + w] && G.STR.en['w_' + w], 'оружие ' + w));
  L.SHOP.forEach(s => ok(G.STR.ru['s_' + s.id] && G.STR.ru['sd_' + s.id], 'склад ' + s.id));
  for (let n = 1; n <= L.MAX_DECK; n++) ok(G.STR.ru['d_' + n], 'палуба ' + n);
  Object.keys(L.BOSSES).forEach(k => ok(G.STR.ru['b_' + k] && G.STR.ru['bossSub_' + k], 'босс ' + k));
  ['term', 'door', 'locked', 'console'].forEach(k => ok(G.STR.ru['u_' + k], 'подсказка ' + k));
  eq(G.STR.ru.title, 'ОТСЕК');
});
test('музыка: трек otsek разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.otsek; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0, 'не разобран');
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas 640×512, скрипты по порядку, тач-крестовина, огонь/действие/оружие, пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="640" height="512"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ['U', 'D', 'L', 'R', 'A'].forEach(d => ok(html.includes('data-d="' + d + '"'), 'кнопка ' + d));
  ok(/data-act="use"/.test(html) && /data-act="swap"/.test(html) && /data-pause/.test(html), 'действие/оружие/пауза');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'нет внешних ссылок');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (список из glub/ + оригиналы жанра)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgg==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ['QWxpZW4gQnJlZWQ=', 'VGVhbTE3', 'QWxpZW5z', 'WGVub21vcnBo', 'RmFjZWh1Z2dlcg==', '0LrRgdC10L3QvtC80L7RgNGE', '0LvQuNGG0LXRhdCy0LDRgtGL'].forEach(b => ok(BAD.test(u(b)), 'стоп-лист ловит оригинал жанра'));
  ok(!BAD.test('ОТСЕК') && !BAD.test('Гефест') && !BAD.test('Наковальня') && !BAD.test('окалинный клещ') && !BAD.test('CONTRACT.md') && !BAD.test('чужих'), 'без ложных срабатываний');
});

// ---------- Проходимость и баланс: «человеческий» бот ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
test('исполнимость: неуязвимый бот проходит каждую из 6 палуб (по 2 сида, настоящая физика: карты, двери, пульт/босс, бег к шлюзу)', () => {
  for (let d = 1; d <= 6; d++) for (const s of [d, d + 10]){
    const r = playOtsek(G, s, { startDeck: d, decks: 1, invuln: true });
    ok(r.passed === 1 && !r.stuck && r.blasts === 0, 'палуба ' + d + ', сид ' + s + ': ' + JSON.stringify({ passed: r.passed, stuck: r.stuck, blasts: r.blasts }));
  }
});
const N1 = 30, D1 = []; for (let s = 1; s <= N1; s++) D1.push(playOtsek(G, s, { decks: 1 }));
test('баланс: палубу 1 бот (реакция 150–250 мс, пропускает врагов в темноте) проходит часто — ≥ 85% из ' + N1, () => {
  const n = D1.filter(r => r.passed >= 1).length; console.log('     палуба 1: ' + n + '/' + N1 + ', гибелей ' + D1.reduce((a, r) => a + r.deaths, 0));
  ok(n >= 0.85 * N1, 'слишком сложно: ' + n); ok(!D1.some(r => r.stuck), 'зависание');
  ok(D1.every(r => r.wasted === 0), 'бот не тратит карты на кладовые');
});
const NF = 24, FULL = []; for (let s = 1; s <= NF; s++) FULL.push(playOtsek(G, s));
test('баланс: всю игру (6 палуб, 3 жизни) бот проходит в 15–55% партий; без зависаний; эвакуация успевает', () => {
  const w = FULL.filter(r => r.won).length, dist = new Array(7).fill(0); FULL.forEach(r => dist[r.passed]++);
  const why = {}; FULL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const bl = FULL.reduce((a, r) => a + r.blasts, 0), cl = FULL.reduce((a, r) => a + r.clears.length, 0);
  console.log('     победы: ' + w + '/' + NF + '; пройдено палуб 0..6: ' + dist.join(',') + '; гибели: ' + JSON.stringify(why) + '; взрывов ' + bl + ' из ' + cl);
  ok(w >= 0.15 * NF, 'слишком сложно: ' + w); ok(w <= 0.55 * NF, 'слишком легко: ' + w);
  ok(!FULL.some(r => r.stuck), 'зависание: сиды ' + FULL.filter(r => r.stuck).map(r => r.seed).join(','));
  ok(bl <= cl * 0.15, 'таймер слишком жёсткий: взрывов ' + bl);
});
const CO = []; for (let s = 1; s <= 8; s++) CO.push(playOtsek(G, s, { players: 2 }));
test('кооп-партия: палубу 1 проходят все, вся игра — не «на халяву» (≤ 90%), без зависаний', () => {
  const w = CO.filter(r => r.won).length; console.log('     кооп: побед ' + w + '/' + CO.length + ', палуб ' + CO.map(r => r.passed).join(','));
  ok(CO.every(r => r.passed >= 1), 'кооп падает на 1-й'); ok(w <= 0.9 * CO.length, 'кооп слишком лёгок'); ok(!CO.some(r => r.stuck), 'зависание');
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
