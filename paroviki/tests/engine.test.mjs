/* ПАРОВИКИ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node paroviki/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: генератор лабиринтов (достижимость всех узлов-вентилей и шлюза — A*, ключи до дверей, рычаги до заслонок),
   ход/стены, стволы 4 героев и ступени, вентили → шлюз, ключи/двери/рычаги/тайники, спецприёмы, деньги поровну,
   ИИ-напарник (следует, стреляет, держит дистанцию, делит еду, телепорт при отставании, детектор застревания),
   лавка (без минусов, пределы, свои деревья), сохранение и пароль, жизни/продолжения, кооп двух людей,
   механизмы-боссы, раскладки без конфликтов, i18n, музыка, страница, правило имён;
   баланс и проходимость — «человеческим» ботом (tests/bot.mjs) вместе со встроенным ИИ-напарником. */
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
const PV = sandbox.PAROVIKI, L = PV.logic, T = L.T;
const { playParoviki, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

// Уровень без чудищ (по желанию): герои у старта, баннер снят
function setup(opts = {}){
  const events = [];
  const game = PV.Game(Object.assign({ rng: mulberry32(opts.seed || 1), seed: opts.seed || 1, onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game.state();
  if (!opts.keepEnemies){ S.enemies = []; S.map.tiles.forEach((t, i) => { if (t === L.TILE.NEST) S.map.tiles[i] = L.TILE.FLOOR; }); }
  S.banner = 0; S.heroes.forEach(h => { h.inv = 0; });
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
function floorNear(S, x, y, r = 12){ // ближайшая к точке свободная клетка
  const m = S.map; let best = null, bd = 1e9;
  for (let ty = 0; ty < m.TH; ty++) for (let tx = 0; tx < m.TW; tx++){ if (L.WALK_SOLID[m.tiles[ty * m.TW + tx]]) continue; const cx = tx * T + T / 2, cy = ty * T + T / 2, d = Math.hypot(cx - x, cy - y); if (d < bd && d >= r){ bd = d; best = { x: cx, y: cy }; } }
  return best;
}
// открытая площадка 3×3 клетки (центр ячейки), на которой нет предметов
function openSpot(S, avoid = []){
  const m = S.map;
  for (let cy = m.CH - 1; cy >= 0; cy--) for (let cx = 0; cx < m.CW; cx++){
    let fine = true; const x0 = cx * 4 + 1, y0 = cy * 4 + 1;
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) if (m.tiles[y * m.TW + x] !== L.TILE.FLOOR) fine = false;
    const px = (cx * 4 + 2) * T + T / 2, py = (cy * 4 + 2) * T + T / 2;
    if (fine && !S.objs.some(o => Math.hypot(o.x - px, o.y - py) < 80) && !avoid.some(a => Math.hypot(a.x - px, a.y - py) < 200)) return { x: px, y: py };
  }
  throw new Error('нет площадки');
}

// ---------- Генератор лабиринтов ----------
test('уровни: 4 мира × (4 лабиринта + арена механизма), 15 сидов — все вентили и шлюз достижимы (симуляция ключей/рычагов + A*)', () => {
  let doors = 0, bars = 0, secrets = 0, total = 0;
  for (let w = 1; w <= L.WORLDS; w++) for (let lv = 1; lv <= L.LEVELS; lv++) for (let s = 0; s < 15; s++){
    const m = L.genLevel(w, lv, s), r = L.solveLevel(m); total++;
    ok(r.ok, w + '-' + lv + ' сид ' + s + ': ' + JSON.stringify({ v: r.valvesOk, e: r.exitOk, k: r.keysFree }));
    const nv = m.objs.filter(o => o.kind === 'valve').length;
    if (lv < L.LEVELS) eq(nv, L.valveCount(w, lv), 'число вентилей ' + w + '-' + lv); else ok(nv >= 2 && !!m.boss, 'арена: вентили и механизм');
    // A*: при открытых (по ходу игры) группах путь от старта до каждого вентиля и до шлюза существует
    m.objs.filter(o => o.kind === 'valve').concat([{ x: m.exit.x, y: m.exit.y }]).forEach(o => ok(L.astar(m, m.start, o, r.open) >= 0, 'A* до ' + Math.floor(o.x / T) + ',' + Math.floor(o.y / T)));
    // ключи — без единой открытой двери/заслонки (любой порядок открывания честен)
    m.objs.filter(o => o.kind === 'key').forEach(o => ok(L.astar(m, m.start, o, {}) >= 0, 'ключ за дверью'));
    eq(m.objs.filter(o => o.kind === 'key').length, m.groups.filter(g => g.kind === 'door').length, 'ключей = дверей');
    eq(m.objs.filter(o => o.kind === 'lever').length, m.groups.filter(g => g.kind === 'bar').length, 'рычагов = заслонок');
    doors += m.groups.filter(g => g.kind === 'door').length; bars += m.groups.filter(g => g.kind === 'bar').length;
    secrets += m.tiles.filter(t => t === L.TILE.CRACK).length;
  }
  ok(doors > 50 && bars > 20 && secrets > 50, 'двери/заслонки/тайники: ' + doors + '/' + bars + '/' + secrets);
  eq(JSON.stringify(Array.from(L.genLevel(2, 3, 5).tiles)), JSON.stringify(Array.from(L.genLevel(2, 3, 5).tiles)), 'генератор детерминирован');
  ok(JSON.stringify(Array.from(L.genLevel(2, 3, 5).tiles)) !== JSON.stringify(Array.from(L.genLevel(2, 3, 6).tiles)), 'сид меняет карту');
});
test('уровни: закрытая дверь без ключа или убранный рычаг — проверка ловит непроходимость', () => {
  let caught = 0;
  for (let s = 0; s < 20 && caught < 3; s++){
    const m = L.genLevel(1, 4, s);
    if (!m.groups.some(g => g.kind === 'bar')) continue;
    const broken = Object.assign({}, m, { objs: m.objs.filter(o => o.kind !== 'lever' && o.kind !== 'key') });
    const r = L.solveLevel(broken);
    // за дверью/заслонкой всегда стоит хотя бы один вентиль или шлюз
    ok(!r.ok, 'без ключей и рычагов уровень 1-4 сид ' + s + ' не должен проходиться'); caught++;
  }
  ok(caught >= 3, 'мало уровней с заслонками');
});

// ---------- Ход, стены, стрельба ----------
test('ход: 8 сторон, по диагонали не быстрее; стены держат; огонь держит направление (стрейф)', () => {
  const { game, S } = setup();
  const h = S.heroes[0], p = openSpot(S); h.x = p.x; h.y = p.y; S.heroes[1].x = p.x + 300; S.heroes[1].y = p.y;
  const spd = L.HEROES[h.t.hid].spd, x0 = h.x;
  game.setMove(0, 1, 0); run(game, 0.25); near(h.x - x0, spd * 0.25, 3, 'вправо');
  const x1 = h.x, y1 = h.y; game.setMove(0, -1, -1); run(game, 0.2); near(Math.hypot(h.x - x1, h.y - y1), spd * 0.2, 3, 'диагональ');
  game.setMove(0, 0, 1); run(game, 4); ok(!game._hitsWall(h.x, h.y, h.r - 0.5), 'в стене');
  game.setMove(0, 1, 0); run(game, 0.1); eq(h.face, [1, 0]);
  game.setFire(0, true); game.setMove(0, -1, 0); run(game, 1 / 60);
  const my = S.shots.filter(s => s.pi === 0); ok(my.length > 0 && my.every(s => s.vx > 0), 'пули летят вправо');
  run(game, 0.3); eq(h.face, [1, 0], 'с зажатым огнём направление не меняется'); ok(h.x < x1, 'не пятится');
  game.setFire(0, false); game.setMove(0, 0, 0);
});
test('стволы: у каждого героя свой характер; ступени 1→4 сильнее (пуль/урон/темп)', () => {
  const G = L.GUNS;
  ok(G.rivet[3].n === 5 && G.rivet[0].rate >= 6, 'заклёпочник — скорострел, к 4-й ступени веер из 5');
  ok(!G.steam[0].splash && G.steam[1].splash > 0 && G.steam[3].splash > G.steam[1].splash, 'мортирка — разрыв со 2-й ступени');
  ok(G.saw.every(g => g.bounce >= 1) && G.saw[3].bounce > G.saw[0].bounce, 'пилы — рикошет');
  ok(G.bolt.every(g => g.pierce >= 2) && G.bolt[3].pierce > G.bolt[0].pierce, 'разрядник — насквозь');
  Object.keys(G).forEach(k => { eq(G[k].length, 4, k); const pw = g => g.n * g.dmg * g.rate * (1 + (g.splash || 0) / 40) * (g.pierce || 1); for (let i = 1; i < 4; i++) ok(pw(G[k][i]) > pw(G[k][i - 1]), k + ' ступень ' + (i + 1)); });
  eq(new Set(L.HEROES.map(h => h.gun)).size, 4, 'стволы разные'); eq(new Set(L.HEROES.map(h => h.spec)).size, 4, 'спецприёмы разные');
  // рикошет пилы от стены и разрыв мортирки — в игре
  const { game, S } = setup({ heroes: [2, 1] });
  const h = S.heroes[0], p = openSpot(S); h.x = p.x; h.y = p.y; S.heroes[1].x = p.x; S.heroes[1].y = p.y + 300; h.face = [1, 0];
  game.setFire(0, true); run(game, 0.05); game.setFire(0, false);
  const saw = S.shots.find(s => s.gun === 'saw'); ok(saw, 'нет пилы'); run(game, 0.6); ok(saw.vx < 0 || saw.bounce < 1 || S.shots.indexOf(saw) < 0, 'пила не отскочила');
});

// ---------- Вентили, шлюз, ключи, тайники ----------
test('вентиль: постоять 0.6 с — открыт (+очки, «засада»), уйти раньше — прогресс спадает; все вентили → шлюз; шлюз → уровень пройден → лавка', () => {
  const { game, S, has, count } = setup();
  const vs = S.objs.filter(o => o.kind === 'valve'), h = S.heroes[0];
  h.x = vs[0].x; h.y = vs[0].y; run(game, 0.3); ok(vs[0].prog > 0.3 && !vs[0].on, 'крутится');
  h.x += 80; run(game, 0.5); ok(vs[0].prog < 0.3, 'прогресс не спадает');
  h.x = vs[0].x; run(game, 0.7); ok(vs[0].on && has('valve'), 'не открылся');
  for (let i = 1; i < vs.length; i++){ h.x = vs[i].x; h.y = vs[i].y; run(game, 0.7); ok(vs[i].on, 'вентиль ' + i); }
  ok(S.exitOpen && has('exitOpen'), 'шлюз не открылся'); eq(count('valve'), vs.length);
  S.enemies = []; h.x = S.map.exit.x; h.y = S.map.exit.y; run(game, 0.1);
  eq(S.phase, 'clear'); ok(has('levelDone'));
  run(game, 2.5); eq(S.phase, 'shop'); ok(has('shop'));
});
test('ключи и двери: ключ общий у команды, касание двери тратит ключ и открывает весь проход; рычаг поднимает заслонку', () => {
  let tested = 0;
  for (let s = 1; s < 30 && tested < 2; s++){
    const { game, S, has } = setup({ world: 1, lvl: 4, seed: s });
    const door = S.map.groups.find(g => g.kind === 'door'), bar = S.map.groups.find(g => g.kind === 'bar');
    if (!door || !bar) continue;
    const key = S.objs.find(o => o.kind === 'key'), h = S.heroes[1].ai ? S.heroes[0] : S.heroes[0];
    S.heroes[1].x = S.heroes[1].y = -999; S.heroes[1].alive = false;
    h.x = key.x; h.y = key.y; run(game, 0.05); eq(S.keys, 1, 'ключ');
    const dt = door.tiles[1], free = floorNear(S, dt[0] * T + T / 2, dt[1] * T + T / 2, 28);
    h.x = free.x; h.y = free.y; const dx = Math.sign(dt[0] * T + T / 2 - h.x), dy = Math.sign(dt[1] * T + T / 2 - h.y);
    game.setMove(0, dx, dy); run(game, 0.6); game.setMove(0, 0, 0);
    ok(door.open && S.keys === 0 && has('open'), 'дверь не открылась');
    door.tiles.forEach(p => eq(S.map.tiles[p[1] * S.map.TW + p[0]], L.TILE.FLOOR));
    const lev = S.objs.find(o => o.kind === 'lever'); ok(lev, 'нет рычага');
    h.x = lev.x; h.y = lev.y; run(game, 0.05); ok(lev.on && bar.open && has('lever'), 'заслонка не поднялась');
    tested++;
  }
  eq(tested, 2, 'нет уровней с дверью и заслонкой');
});
test('тайник: трещина в стене ломается выстрелами (+очки, событие), за ней — сундук с деньгами', () => {
  const { game, S, has } = setup({ world: 1, lvl: 1, seed: 4 });
  const m = S.map; let ct = -1; m.tiles.forEach((t, i) => { if (t === L.TILE.CRACK && ct < 0) ct = i; });
  ok(ct >= 0, 'нет трещины'); const tx = ct % m.TW, ty = (ct - tx) / m.TW;
  const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => m.tiles[(ty + dy) * m.TW + tx + dx] === L.TILE.FLOOR);
  const [dx, dy] = sides[0], h = S.heroes[0];
  h.x = (tx + dx * 2) * T + T / 2; h.y = (ty + dy * 2) * T + T / 2; h.face = [-dx, -dy];
  game.setFire(0, true); run(game, 2.5); game.setFire(0, false);
  eq(m.tiles[ct], L.TILE.FLOOR, 'трещина цела'); ok(has('secret'));
  ok(S.objs.some(o => o.kind === 'chest'), 'нет сундука в тайнике');
});

// ---------- Спецприёмы ----------
test('спецприёмы: заплатка лечит обоих и поднимает напарника; котёл-бомба бьёт всех вокруг; зонт — неуязвимость; лоция — карта и оглушение; заряды тратятся', () => {
  let r = setup({ heroes: [0, 1] }); let S = r.S;
  S.heroes[0].hp = 30; S.heroes[1].hp = 0; S.heroes[1].down = true; S.heroes[1].downT = 9;
  ok(r.game.special(0)); ok(S.heroes[0].hp > 70 && !S.heroes[1].down && S.heroes[1].hp > 50, 'заплатка'); eq(S.team[0].spec, 0);
  ok(!r.game.special(0), 'без зарядов сработало');
  r = setup({ heroes: [1, 0] }); S = r.S; const h = S.heroes[0];
  const e1 = r.game._addEnemy('tin', h.x + 100, h.y), e2 = r.game._addEnemy('heavy', h.x - 120, h.y); S.eshots.push({ x: h.x + 50, y: h.y, vx: 0, vy: 0, r: 5, dmg: 10, life: 3 });
  r.game.special(0); ok(e1.dead && e2.hp < e2.max && S.eshots.length === 0, 'бомба');
  r = setup({ heroes: [2, 0] }); S = r.S; r.game.special(0); ok(S.heroes.every(x => x.shieldT > 4), 'зонт обоим');
  const hp0 = S.heroes[0].hp; r.game._hurtHero(S.heroes[0], 50, 'test'); eq(S.heroes[0].hp, hp0, 'урон сквозь зонт');
  r = setup({ heroes: [3, 0] }); S = r.S; const e3 = r.game._addEnemy('tin', S.heroes[0].x + 90, S.heroes[0].y);
  r.game.special(0); ok(S.chartT > 10 && S.seen.every(v => v === 1) && e3.stun > 2, 'лоция');
});

// ---------- Деньги поровну, еда ----------
test('деньги — поровну на двоих (нечётная монета — тому, у кого меньше); еду не берёт сытый (оставляет напарнику)', () => {
  const { game, S } = setup();
  const h = S.heroes[0], p = openSpot(S); h.x = p.x; h.y = p.y; S.heroes[1].x = p.x + 400;
  S.objs.push({ kind: 'coin', v: 15, x: h.x, y: h.y }); run(game, 0.05);
  eq(S.team[0].money + S.team[1].money, 15); ok(Math.abs(S.team[0].money - S.team[1].money) <= 1, 'не поровну');
  S.objs.push({ kind: 'coin', v: 15, x: h.x, y: h.y }); run(game, 0.05); eq([S.team[0].money, S.team[1].money], [15, 15]);
  const food = { kind: 'food', x: h.x, y: h.y }; S.objs.push(food); run(game, 0.05); ok(S.objs.indexOf(food) >= 0, 'сытый съел');
  h.hp = 40; run(game, 0.05); ok(S.objs.indexOf(food) < 0 && h.hp > 70, 'голодный не съел');
});

// ---------- ИИ-напарник ----------
test('ИИ-напарник: идёт за игроком по лабиринту и держится рядом (не дальше ~3 клеток)', () => {
  const { game, S } = setup({ seed: 2 });
  const P = S.heroes[0], A = S.heroes[1]; ok(A.ai && !P.ai);
  const v = S.objs.filter(o => o.kind === 'valve').sort((a, b) => Math.hypot(b.x - P.x, b.y - P.y) - Math.hypot(a.x - P.x, a.y - P.y))[0];
  // игрок «бежит» к дальнему вентилю по полю расстояний
  let far = 0;
  run(game, 25, () => {
    const f = game._bfsFrom([v], 0), w = game._downhill(f, P);
    if (w){ const dx = w.x - P.x, dy = w.y - P.y, l = Math.hypot(dx, dy) || 1; game.setMove(0, dx / l, dy / l); } else game.setMove(0, 0, 0);
    if (Math.hypot(A.x - P.x, A.y - P.y) > 6 * T) far++;
  });
  ok(Math.hypot(P.x - v.x, P.y - v.y) < 40, 'игрок не дошёл');
  ok(far < 60 * 4, 'напарник отстаёт: ' + (far / 60).toFixed(1) + ' с');
  ok(Math.hypot(A.x - P.x, A.y - P.y) < 4 * T, 'в конце далеко: ' + Math.hypot(A.x - P.x, A.y - P.y));
});
test('ИИ-напарник: отрезан (за закрытой дверью/далеко) — «паровой рывок» к игроку, не застревает', () => {
  const { game, S, has } = setup({ seed: 3 });
  const P = S.heroes[0], A = S.heroes[1];
  const far = S.objs.filter(o => o.kind === 'valve').sort((a, b) => Math.hypot(b.x - P.x, b.y - P.y) - Math.hypot(a.x - P.x, a.y - P.y))[0];
  A.x = far.x + 20; A.y = far.y;
  run(game, 4);
  ok(has('warp'), 'не телепортировался'); ok(Math.hypot(A.x - P.x, A.y - P.y) < 4 * T, 'не рядом с игроком');
  ok(!game._hitsWall(A.x, A.y, A.r - 1), 'телепорт в стену');
});
test('ИИ-напарник: стреляет по чудищу в зоне видимости и держит дистанцию (не лезет в упор)', () => {
  const { game, S, count } = setup({ seed: 5, heroes: [0, 1] });
  const P = S.heroes[0], A = S.heroes[1], p = openSpot(S);
  P.x = p.x; P.y = p.y + 20; A.x = p.x; A.y = p.y - 20; P.inv = 99; S.cam.x = p.x - L.W / 2; S.cam.y = p.y - L.VH / 2;
  const e = game._addEnemy('heavy', p.x + 40, p.y - 34); e.hp = e.max = 1e6; e.spd = 0;
  let minD = 1e9; run(game, 3, () => { minD = Math.min(minD, Math.hypot(A.x - e.x, A.y - e.y)); });
  ok(S.shots.some(s => s.pi === 1) || count('shot') > 3, 'не стреляет'); ok(e.hp < e.max, 'не попал');
  ok(Math.hypot(A.x - e.x, A.y - e.y) > 70, 'стоит вплотную: ' + Math.hypot(A.x - e.x, A.y - e.y).toFixed(0));
  e.dead = true; const t = game._addEnemy('tin', p.x - 30, p.y + 30); t.spd = 0; run(game, 3); ok(t.dead, 'жестянщик жив');
});
test('ИИ-напарник: деньги подбирает (поровну), еду берёт, только если ему нужнее, чем игроку; выбыл — встаёт через время у игрока', () => {
  const { game, S, has } = setup({ seed: 6 });
  const P = S.heroes[0], A = S.heroes[1], p = openSpot(S); P.x = p.x; P.y = p.y; A.x = p.x + 40; A.y = p.y;
  S.objs = S.objs.filter(o => o.kind === 'valve');
  S.objs.push({ kind: 'coin', v: 20, x: p.x + 60, y: p.y + 40 });
  run(game, 3); eq([S.team[0].money, S.team[1].money], [10, 10], 'монета не поделена');
  const food = { kind: 'food', x: A.x + 50, y: A.y }; S.objs.push(food);
  A.hp = A.maxHp * 0.6; P.hp = P.maxHp * 0.3; run(game, 3); ok(S.objs.indexOf(food) >= 0, 'ИИ съел еду, хотя игроку нужнее');
  P.hp = P.maxHp; A.hp = A.maxHp * 0.4; run(game, 3); ok(S.objs.indexOf(food) < 0, 'ИИ не взял еду, хотя ему нужнее');
  A.inv = 0; A.shieldT = 0; game._hurtHero(A, 1e4, 'test'); ok(A.down && has('heroDie') && P.alive, 'выбытие');
  eq(S.phase, 'play', 'выбывший ИИ не должен заканчивать игру'); eq(S.team[0].lives, L.START_LIVES, 'ИИ не тратит жизни игрока');
  run(game, 13); ok(!A.down && A.hp > 0 && has('revive') && Math.hypot(A.x - P.x, A.y - P.y) < 4 * T, 'не встал');
});

// ---------- Лавка ----------
test('лавка: деньги не уходят в минус (5000 случайных покупок), пределы ступеней, цены растут; у героев свои деревья мастерства', () => {
  const r = mulberry32(42);
  for (let k = 0; k < 40; k++){
    const { game, S } = setup({ seed: k + 1, heroes: [k % 4, (k + 1) % 4] }); game._openShop();
    for (let i = 0; i < 125; i++){
      const pi = r() < 0.5 ? 0 : 1, items = game.shopItems(pi).filter(x => x !== 'ready'), it = items[Math.floor(r() * items.length)];
      S.team[pi].money += Math.floor(r() * 300);
      const before = S.team[pi].money, p = game.price(pi, it), okb = game.buy(pi, it);
      ok(S.team[pi].money >= 0, 'минус');
      if (okb) eq(S.team[pi].money, before - p); else ok(p == null || before < p, 'не купил при деньгах');
      ok(S.team[pi].gun <= 4 && S.team[pi].hpL <= 3 && S.team[pi].spec <= L.SHOP.SPEC_MAX && S.team[pi].mA <= 3 && S.team[pi].mB <= 3, 'предел');
    }
  }
  const { game, S } = setup(); game._openShop(); S.team[0].money = 1e6;
  let last = 0; for (let i = 0; i < 3; i++){ const p = game.price(0, 'gun'); ok(p > last, 'цена ствола не растёт'); last = p; ok(game.buy(0, 'gun')); }
  eq(game.price(0, 'gun'), null, 'ступень 5'); eq(S.team[0].gun, 4);
  eq(game.price(0, 'heal'), null, 'латка при полном здоровье');
  const trees = L.HEROES.map(h => h.tree.join('+')); eq(new Set(trees).size, 4, 'деревья одинаковые: ' + trees);
  ok(L.HEROES.every(h => h.tree.includes('speed') || h.tree.includes('life')), 'в мастерстве — скорость или жизни');
  const lives = S.team[0].lives; ok(game.buy(0, 'life')); eq(S.team[0].lives, lives + 1, 'запасная жизнь');
});
test('лавка: ИИ-напарник закупается сам и не уходит в минус; переход дальше — когда готовы все люди', () => {
  const { game, S } = setup(); S.team[1].money = 1234; S.team[1].hp = 30; game._openShop();
  ok(S.shop[1].ready && S.shop[1].bought.length > 0 && S.team[1].money >= 0 && S.team[1].money < 300, 'ИИ: ' + JSON.stringify(S.shop[1].bought) + ' ' + S.team[1].money);
  ok(S.shop[1].bought.includes('heal') && S.shop[1].bought.includes('gun'), 'ИИ не подлатался / не купил ствол');
  game.shopReady(0); eq(S.phase, 'play'); eq([S.world, S.lvl], [1, 2]);
  const c = setup({ players: 2 }); c.game._openShop(); c.game.shopReady(0); eq(c.S.phase, 'shop', 'вдвоём ждём второго'); c.game.shopReady(1); eq(c.S.phase, 'play');
});

// ---------- Сохранение и пароль ----------
test('сохранение: progress() → JSON → новая игра продолжает с того же уровня, со стволами, деньгами и жизнями', () => {
  const { game, S } = setup({ heroes: [3, 2] }); S.team[0].gun = 3; S.team[0].money = 444; S.team[1].mA = 2; S.score = 9000;
  game._openShop(); const p = JSON.parse(JSON.stringify(game.progress()));
  eq([p.world, p.lvl], [1, 2]);
  const g2 = PV.Game({ seed: 1, save: p }).start(), S2 = g2.state();
  eq([S2.world, S2.lvl, S2.score], [1, 2, 9000]); eq(S2.team.map(t => [t.hid, t.gun, t.money, t.mA]), [[3, 3, 444, 0], [2, 1, 0, 2]]);
  const bad = PV.Game({ seed: 1, save: { team: [{ hid: 9, gun: 99, money: -5 }, { hid: 0 }], world: 7, lvl: 0 } }).start().state();
  ok(bad.world === 4 && bad.lvl === 1 && bad.team[0].gun === 4 && bad.team[0].money === 0 && bad.team[0].hid === 3, 'мусор в сохранении не зажат');
});
test('пароль: 10 знаков без похожих символов, туда-обратно для 500 случайных состояний; опечатка/подделка — отказ', () => {
  const r = mulberry32(7);
  for (let i = 0; i < 500; i++){
    const h0 = Math.floor(r() * 4), h1 = (h0 + 1 + Math.floor(r() * 3)) % 4;
    const mk = hid => { const tr = L.HEROES[hid].tree; return { hid, gun: 1 + Math.floor(r() * 4), hpL: Math.floor(r() * 4), mA: Math.floor(r() * (tr[0] === 'life' ? 3 : 4)), mB: Math.floor(r() * (tr[1] === 'life' ? 3 : 4)), spec: Math.floor(r() * 4), money: Math.floor(r() * 64) * 50 }; };
    const p = { world: 1 + Math.floor(r() * 4), lvl: 1 + Math.floor(r() * 5), players: 1 + Math.floor(r() * 2), team: [mk(h0), mk(h1)] };
    const s = L.encodePass(p); eq(s.length, 10); ok(/^[A-HJ-NP-Z2-9]+$/.test(s), 'символы: ' + s);
    eq(L.decodePass(s), p, 'пароль ' + s);
    eq(L.decodePass(s.toLowerCase()), p, 'регистр');
    const j = Math.floor(r() * 10), alt = L.ALPHA[(L.ALPHA.indexOf(s[j]) + 1 + Math.floor(r() * 30)) % 32], t = s.slice(0, j) + alt + s.slice(j + 1);
    const d = L.decodePass(t); ok(d === null || JSON.stringify(d) !== JSON.stringify(p), 'опечатка принята как тот же пароль');
  }
  eq(L.decodePass('ABC'), null); eq(L.decodePass(''), null);
  let rej = 0; const rr = mulberry32(9); for (let i = 0; i < 300; i++){ let s = ''; for (let k = 0; k < 10; k++) s += L.ALPHA[Math.floor(rr() * 32)]; if (!L.decodePass(s)) rej++; }
  ok(rej > 280, 'случайные строки принимаются: ' + (300 - rej));
});

// ---------- Жизни, продолжения ----------
test('жизни: 3; гибель — возрождение с неуязвимостью; все жизни — «Продолжить?» (снова 3 жизни), без продолжений — конец игры', () => {
  const { game, S, has } = setup();
  const h = S.heroes[0];
  game._hurtHero(h, 1e4, 'test'); ok(!h.alive && h.t.lives === 2); run(game, 1.6); ok(h.alive && h.inv > 0 && has('respawn'));
  for (let i = 0; i < 2; i++){ h.inv = 0; game._hurtHero(h, 1e4, 'test'); run(game, 1.6); }
  eq(S.phase, 'cont'); ok(has('contAsk'));
  ok(game.cont()); eq(S.phase, 'play'); eq(h.t.lives, 3); eq(S.continues, L.CONTINUES - 1);
  for (let c = 0; c < L.CONTINUES; c++){ for (let i = 0; i < 3; i++){ h.inv = 0; game._hurtHero(h, 1e4, 'test'); run(game, 1.6); } if (c < L.CONTINUES - 1) ok(game.cont()); }
  eq(S.phase, 'cont'); ok(!game.cont()); run(game, L.CONT_T + 0.5); eq(S.phase, 'over'); ok(has('gameover'));
});

// ---------- Кооп двух людей ----------
test('кооп: вдвоём ИИ нет, герои независимы (ход/огонь/жизни), поводок не даёт разойтись за экран, выбывший ждёт напарника', () => {
  const c2 = setup({ players: 2 }), { game, S } = c2;
  ok(!S.heroes[0].ai && !S.heroes[1].ai && !S.aiOn, 'ИИ при двух людях');
  const [a, b] = S.heroes;
  game.setMove(0, 1, 0); game.setMove(1, -1, 0); const ax = a.x, bx = b.x; run(game, 0.3);
  ok(a.x > ax && b.x < bx, 'ход независим'); game.setMove(0, 0, 0); game.setMove(1, 0, 0);
  game.setFire(1, true); run(game, 0.2); game.setFire(1, false);
  ok(c2.events.some(e => e[0] === 'shot' && e[1].pi === 1) && !c2.events.some(e => e[0] === 'shot' && e[1].pi === 0), 'огонь И2');
  // поводок
  a.x = 200; b.x = 200 + L.W - 72; const bx0 = b.x; game.setMove(1, 1, 0); run(game, 0.5); ok(b.x <= bx0 + 1, 'разошлись за экран'); game.setMove(1, 0, 0);
  for (let i = 0; i < 3; i++){ a.inv = 0; game._hurtHero(a, 1e4, 'test'); run(game, 1.6); }
  ok(a.out && S.phase === 'play', 'выбывший И1 должен ждать'); ok(b.alive);
  b.inv = 0; for (let i = 0; i < 3; i++){ b.inv = 0; game._hurtHero(b, 1e4, 'test'); run(game, 1.6); }
  eq(S.phase, 'cont');
  ok(S.hpMul > 1, 'вдвоём чудища не толще');
});
test('кооп-ввод: раскладки без конфликтов (checkBindings); И1 стрелки + / . пробел, И2 WASD + F; в одиночке обе ведут И1', () => {
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
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'pv' });
  g.useStandardScreens({ lives: 3 }); g.scene('play', { realtime: true }); g.start('title');
  eq(g.usePlayers({ bind: L.BIND, actions: ['fire', 'spec'] }).count(), 1);
  eq(g.input.conflicts.length, 0, 'usePlayers нашёл конфликты');
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1); let sp2 = 0; P2.onPress(a => { if (a === 'spec') sp2++; });
  key('keydown', 'ArrowUp'); key('keydown', 'Slash');
  ok(P1.pressed('up') && P1.pressed('fire') && !P2.pressed('up') && !P2.pressed('fire'), 'И1');
  key('keydown', 'KeyW'); key('keydown', 'KeyF'); key('keydown', 'KeyG');
  ok(P2.pressed('up') && P2.pressed('fire') && sp2 === 1, 'И2');
  ['ArrowUp', 'Slash', 'KeyW', 'KeyF', 'KeyG'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'KeyS'); key('keydown', 'KeyF');
  ok(P1.pressed('down') && P1.pressed('fire') && !P2.pressed('down'), 'в одиночке раскладка И2 ведёт И1');
  ok(!Object.values(L.BIND).some(m => Object.values(m).flat().some(c => ['KeyL', 'KeyT', 'KeyM', 'KeyP', 'Escape', 'Enter'].includes(c))), 'горячие клавиши движка в раскладке');
});

// ---------- Механизмы-боссы ----------
test('механизмы: у каждого мира свой; броня держит (урон ×0.25), пока не открыты вентили арены; каждый вентиль бьёт по механизму; гибель — шлюз', () => {
  for (let w = 1; w <= 4; w++){
    const { game, S, has } = setup({ world: w, lvl: 5, seed: w });
    const B = S.boss; ok(B && B.key === L.BOSSES[w].key, 'механизм мира ' + w);
    run(game, 2.5); ok(!B.dead && B.intro <= 0);
    const h = S.heroes[0]; h.inv = 1e9; S.heroes[1].inv = 1e9;
    const shotsBefore = S.eshots.length + S.bombs.length; run(game, 10); ok(has('eshot') || has('drop') || S.eshots.length + S.bombs.length > shotsBefore, 'механизм ' + w + ' не атакует');
    const hp0 = B.hp; game.state().shots.push({ x: B.x, y: B.y, vx: 1, vy: 0, dmg: 10, life: 1, r: 4, pierce: 1, bounce: 0, splash: 0, pi: 0, gun: 'rivet', hit: [] }); run(game, 1 / 60);
    near(hp0 - B.hp, 2.5, 0.01, 'броня');
    const vs = S.objs.filter(o => o.kind === 'valve');
    vs.forEach(v => { h.x = v.x; h.y = v.y; run(game, 0.7); ok(v.on, 'вентиль арены'); });
    eq(B.armor, 0); ok(has('armorDown'));
    const hp1 = B.hp; game.state().shots.push({ x: B.x, y: B.y, vx: 1, vy: 0, dmg: 10, life: 1, r: 4, pierce: 1, bounce: 0, splash: 0, pi: 0, gun: 'rivet', hit: [] }); run(game, 1 / 60);
    near(hp1 - B.hp, 10, 0.01, 'без брони');
    ok(!S.exitOpen, 'шлюз открыт при живом механизме');
    B.hp = 1; game.state().shots.push({ x: B.x, y: B.y, vx: 1, vy: 0, dmg: 10, life: 1, r: 4, pierce: 1, bounce: 0, splash: 0, pi: 0, gun: 'rivet', hit: [] }); run(game, 1 / 60);
    ok(B.dead && S.exitOpen && has('bossDie'), 'гибель механизма');
    S.eshots = []; S.bombs = []; h.x = S.map.exit.x; h.y = S.map.exit.y; run(game, 2.5);
    if (w < 4) eq(S.phase, 'shop'); else { eq(S.phase, 'won'); ok(has('win')); }
  }
});

// ---------- Производительность ----------
test('производительность: пик толпы (до 90 чудищ — предел), 60 снарядов, ИИ-напарник — шаг логики в Node < 3 мс', () => {
  const { game, S } = setup({ world: 4, lvl: 4, keepEnemies: true });
  const h = S.heroes[0]; h.inv = 1e9; S.heroes[1].inv = 1e9;
  for (let i = 0; i < 80 && S.enemies.length < 90; i++){ const p = floorNear(S, h.x + Math.cos(i) * (60 + i * 3), h.y + Math.sin(i) * (60 + i * 3), 0); if (p) game._addEnemy(i % 3 ? 'tin' : 'bug', p.x, p.y); }
  game.setFire(0, true);
  run(game, 0.5); ok(S.enemies.length <= 90 + 1, 'предел толпы: ' + S.enemies.length);
  for (let i = 0; i < 60; i++) S.eshots.push({ x: h.x + 200, y: h.y, vx: 0, vy: 0, r: 5, dmg: 1, life: 99 });
  const t0 = process.hrtime.bigint(); run(game, 3); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 180;
  console.log('     шаг: ' + ms.toFixed(2) + ' мс, чудищ ' + S.enemies.length + ', снарядов ' + S.eshots.length);
  ok(ms < 3, 'медленно: ' + ms.toFixed(2));
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть герои, стволы, спецприёмы, лавка, миры, механизмы', () => {
  const ru = Object.keys(PV.STR.ru).sort(), en = Object.keys(PV.STR.en).sort();
  eq(ru, en);
  ru.forEach(k => ok(String(PV.STR.ru[k]).trim() && String(PV.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(PV.STR.ru[k], 'нет ключа движка ' + k));
  L.HEROES.forEach(h => ['h_' + h.key, 'hd_' + h.key, 'g_' + h.gun, 's_' + h.spec, 'sd_' + h.spec].forEach(k => ok(PV.STR.ru[k], 'нет ' + k)));
  ['gun', 'hp', 'heal', 'spec', 'speed', 'life', 'armor', 'magnet', 'regen', 'ready'].forEach(k => ok(PV.STR.ru['u_' + k], 'лавка ' + k));
  [1, 2, 3, 4].forEach(w => { ok(PV.STR.ru['w_' + w], 'мир ' + w); ok(PV.STR.ru['b_' + L.BOSSES[w].key], 'механизм ' + w); });
  eq(PV.STR.ru.title, 'ПАРОВИКИ');
});
test('музыка: трек paroviki разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.paroviki; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0, 'не разобран');
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas 640×512, скрипты по порядку, тач-крестовина, огонь/спецприём, пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="640" height="512"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ok(['U', 'D', 'L', 'R'].every(d => html.includes('data-d="' + d + '"')) && /data-act="fire"/.test(html) && /data-act="spec"/.test(html) && /data-pause/.test(html), 'тач');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (список из glub/ + оригинал жанра)
  const BASE = Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8');
  const EXTRA = Buffer.from('Y2hhb3MgP2VuZ2luZXxiaXRtYXAgP2Jyb3xzb2xkaWVycyA/b2YgP2ZvcnR1bmV80YXQsD/Qvj/RgVstIF0/0Y3QvdC00LbQuNC9fNC60LVb0LnQuF0/0L7RgSA/0Y3QvdC00LbQuNC9fNGH0LDQvtGBID/RjdC90LTQttC40L180LTQstC40LPQsNGC0LXQu1vRjNGP0Y7QtdC8XSsg0YXQsNC+0YHQsHzQsdC40YLQvNCw0L980YHQvtC70LTQsNGCW9GL0LBdPyDRg9C00LDRh9C4fG5hdnZpZXxwcmVhY2hlcnxicmlnYW5k', 'base64').toString('utf8');
  const BAD = new RegExp(BASE + '|' + EXTRA, 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('VGhlIENoYW9zIEVuZ2luZQ==')) && BAD.test(u('Qml0bWFwIEJyb3RoZXJz')) && BAD.test(u('U29sZGllcnMgb2YgRm9ydHVuZQ==')) && BAD.test(u('0JTQstC40LPQsNGC0LXQu9GMINGF0LDQvtGB0LA=')), 'стоп-лист ловит оригинал жанра');
  ok(!BAD.test('ПАРОВИКИ') && !BAD.test('Гефест') && !BAD.test('Паровая Машина Губернии') && !BAD.test('CONTRACT.md') && !BAD.test('хаос') && !BAD.test('двигатель'), 'без ложных срабатываний');
});

// ---------- Проходимость и баланс: «человеческий» бот + ИИ-напарник ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
// Исполнимость: неуязвимый бот проходит каждый мир (4 лабиринта + механизм) в настоящей физике.
// прокачка — как к этому миру у живого игрока (ствол = номер мира, котёл и заряды)
const upTeam = w => [0, 1].map(i => ({ hid: i, gun: w, hpL: Math.min(3, w - 1), mA: Math.min(2, w - 1), mB: 0, spec: 2, money: 0 }));
const EXE = []; for (let w = 1; w <= 4; w++) EXE.push(playParoviki(PV, w, { save: { world: w, lvl: 1, players: 1, team: upTeam(w) }, levels: 5, invuln: true }));
test('исполнимость: каждый из 4 миров (4 лабиринта + механизм) проходится до конца — бот без урона + ИИ-напарник', () => {
  console.log('     время мира, с: ' + EXE.map((r, i) => (i + 1) + ':' + r.time.toFixed(0)).join(' '));
  EXE.forEach((r, i) => ok((r.passed >= 5 || r.won) && !r.stuck, 'мир ' + (i + 1) + ' не пройден: ' + r.passed));
});
// «Человеческий» бот: реакция 150–250 мс, разворот «тычком», снаряды замечает не всегда (зевок 35%).
const N1 = 24, ST1 = []; for (let s = 1; s <= N1; s++) ST1.push(playParoviki(PV, 100 + s, { levels: 1, heroes: [s % 4, (s + 1) % 4] }));
test('баланс: уровень 1 — бот + ИИ-напарник проходят часто (≥ 85% из ' + N1 + ', все 4 героя), без «зависаний»', () => {
  const n = ST1.filter(r => r.passed >= 1).length;
  console.log('     уровень 1: ' + n + '/' + N1 + ', без гибелей: ' + ST1.filter(r => r.passed >= 1 && !r.deaths).length + ', среднее время ' + (ST1.reduce((a, r) => a + r.time, 0) / N1).toFixed(0) + ' с');
  ok(n >= 0.85 * N1, 'уровень 1: ' + n + '/' + N1); eq(ST1.filter(r => r.stuck).map(r => r.seed), []);
});
test('ИИ-напарник: детектор застревания — ни разу не отстал дольше 3.5 с, не замер вдали, не в стене; выбывает редко', () => {
  const all = ST1.concat(EXE);
  const st = all.reduce((a, r) => a + r.ai.stuckEv, 0), still = all.reduce((a, r) => a + r.ai.stillEv, 0), wall = all.reduce((a, r) => a + r.ai.inWall, 0);
  const lv = all.reduce((a, r) => a + Math.max(1, r.passed), 0), downs = ST1.reduce((a, r) => a + r.aiDown, 0), warps = all.reduce((a, r) => a + r.warps, 0);
  console.log('     уровней: ' + lv + ', застреваний: ' + st + ', замираний: ' + still + ', кадров в стене: ' + wall + ', «рывков»: ' + warps + ' (' + (warps / lv).toFixed(1) + '/ур.), выбываний ИИ на ур.1: ' + downs + '/' + N1);
  eq([st, still, wall], [0, 0, 0]);
  ok(downs <= N1 * 0.25, 'ИИ выбывает слишком часто: ' + downs);
  ok(warps / lv <= 8, 'слишком частые «рывки»: ' + (warps / lv).toFixed(1));
});
const NB = 8, BAL = []; for (let s = 1; s <= NB; s++) BAL.push(playParoviki(PV, s, { levels: 20, heroes: [(s + 1) % 4, s % 4] }));
const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
console.log('     бот + ИИ (' + NB + ' партий): вся игра — ' + BAL.filter(r => r.won).length + '/' + NB + ', уровней пройдено: ' + BAL.map(r => r.passed).join(',') + '; продолжений: ' + BAL.map(r => r.conts).join(',') + '; гибели: ' + JSON.stringify(why));
test('баланс: всю игру (20 уровней, 3 жизни + 2 продолжения + лавка) бот с ИИ проходит не всегда и не никогда (15–85%), без «зависаний»', () => {
  const w = BAL.filter(r => r.won).length / NB; ok(w >= 0.15 && w <= 0.85, 'вся игра: ' + w);
  ok(BAL.every(r => r.passed >= 4), 'падает в 1-м мире'); eq(BAL.filter(r => r.stuck).map(r => r.seed), [], 'зависание');
  ok(BAL.some(r => r.deaths > 0), 'никто не гибнет — слишком легко');
  BAL.forEach(r => ok(r.money.every(m => m >= 0), 'минус в кошельке'));
});
const CO = []; for (let s = 1; s <= 6; s++) CO.push(playParoviki(PV, 200 + s, { players: 2, levels: 2, heroes: [s % 4, (s + 2) % 4] }));
test('кооп двух людей (два бота): уровни 1–2 проходятся, без «зависаний»', () => {
  console.log('     кооп: ' + CO.map(r => r.passed).join(',') + '; гибели ' + CO.map(r => r.deaths).join(','));
  ok(CO.filter(r => r.passed >= 2).length >= 5, 'кооп не проходит'); ok(!CO.some(r => r.stuck), 'зависание');
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
