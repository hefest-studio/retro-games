/* ЖЕОДА · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node zheoda/tests/engine.test.mjs. Логика (js/game.js) в node:vm с шимом window.
   Проходимость: граф достижимости (tests/bot.mjs: узлы × гравитация × лифты × рычаг, монотонно — ключи
   и взорванные стены) + «идеальный» агент-планировщик. Баланс — «человеческий» бот на 40 партиях. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8'), sandbox, { filename: 'i18n.js' });
const Z = sandbox.ZHEODA, L = Z.logic;
const { playZheoda, reachLevel, makePlanner, mulberry32 } = await import('./bot.mjs');

const STOP = 'Y3J5c3RhbCA/Y2F2ZXN80LrRgNC40YHRgtCw0LvQuz8g0LrQtdC50LJ80LrRgNC40YHRgtCw0LvRjNC9XFMqINC/0LXRidC10YB8XGJteWxvXGJ8KD88IVvQsC3Rj9GRXSnQvNCw0LnQu9C+KD8hW9CwLdGP0ZFdKXxzdGVhbXdpdHp80YHRgtC40LzQstC40YZ8Y29tbWFuZGVyID9rZWVufNC60L7QvNC80LDQvdC00LXRgCA/0LrQuNC9fFxia2VlblxifGR1a2UgP251a2VtfNC00Y7QuiA/0L3RjtC60LXQvHxjb3Ntbyc/cyBjb3NtaWN8c2VjcmV0ID9hZ2VudHxtb25zdGVyID9iYXNofGppbGwgb2YgdGhlIGp1bmdsZXxiaW8gP21lbmFjZXxob2N1cyA/cG9jdXN8aGFsbG93ZWVuID9oYXJyeXxkYW5nZXJvdXMgP2RhdmV8cHJpbmNlIG9mIHBlcnNpYXxjYXB0YWluID9jb21pY3x4YXJnb258a2lsb2JsYXN0ZXJ8YXBvZ2VlfNCw0L/QvtC00LbQuHxlcGljID9tZWdhID9nYW1lc3xcYmlkID9zb2Z0d2FyZXwzZCA/cmVhbG1zfG1pbmVyID8yMDQ5fG1hbmljID9taW5lcnxqZXQgP3NldCA/d2lsbHl8bG9kZSA/cnVubmVyfGJvdWxkZXIgP2Rhc2h8cm9ja2ZvcmR8XGJkaWdnZXJcYnxkaXp6eXxzcGVsdW5reXxnaWFuYSBzaXN0ZXJzfFxibWFyaW9cYnwoPzwhW9CwLdGP0ZFdKdC80LDRgNC40L4oPyFb0LAt0Y/RkV0pfFxic29uaWNcYnxtZXRyb2lkfGNhc3RsZXZhbmlhfG1lZ2EgP21hblxifFxiY29udHJhXGJ8bmludGVuZG98XGJzZWdhXGJ8a29uYW1pfGNhcGNvbXxuYW1jb3x0YWl0b3x0ZWNtb3xwYWMtP21hbnx0ZXRyaXN80YLQtdGC0YDQuNGBfGdhbGFnYXx4b25peHxkZWVwc2Vlaw==';
let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const STEP = L.STEP;
function run(game, sec, dx = 0, jump = false){ game.setInput(dx, jump); for (let i = 0; i < Math.round(sec / STEP); i++) game.update(STEP); }

// Тестовый уровень из ASCII-карты: подменяем первый уровень, игра входит в него
function arena(map, opts = {}){
  const keep = L.LEVELS[0]; L.LEVELS[0] = { name: 'test', ep: 1, map, respawn: opts.respawn };
  const ev = [];
  const game = Z.Game(Object.assign({ rng: mulberry32(opts.seed || 1), onEvent: (t, d) => ev.push(t) }, opts)).start();
  game.enter(1); L.LEVELS[0] = keep;
  const S = game.state(); S.banner = 0;
  return { game, S, ev };
}
function place(S, cx, cy){ S.pl.x = cx + 0.5 - L.PW / 2; S.pl.y = S.pl.gs > 0 ? cy + 1 - L.PH : cy; S.pl.vy = 0; S.pl.ground = true; }
const BOX = (rows) => ['############', ...rows.map(r => '#' + r.padEnd(10, '.') + '#'), '############'];

// ---------- Карты ----------
test('17 уровней: 8 + 8 эпизодов и финал; у каждого старт, выход (кроме финала), края — скала', () => {
  eq(L.LEVELS.length, 17);
  eq(L.LEVELS.filter(l => l.ep === 1).length, 8); eq(L.LEVELS.filter(l => l.ep === 2).length, 8); eq(L.LEVELS[16].ep, 3);
  L.LEVELS.forEach((lv, i) => {
    const P = L.parseLevel(lv), w = lv.map[0].length;
    ok(lv.map.every(r => r.length === w), 'ширина строк ' + lv.name);
    ok(P.start, 'старт ' + lv.name); ok(i === 16 ? P.boss && !P.exit : P.exit, 'выход/босс ' + lv.name);
    ok(w >= 20 && w <= 44 && lv.map.length >= 11 && lv.map.length <= 22, 'размер 1–2 экрана ' + lv.name);
    for (let x = 0; x < w; x++) ok(lv.map[0][x] === '#' && '#H'.includes(lv.map[lv.map.length - 1][x]), 'край ' + lv.name);
    ok(i === 16 || P.items.some(it => it.k === '*'), 'кристаллы ' + lv.name);
  });
});
test('механики разложены по уровням: рычаги, ключи, лифты, сферы, взрывчатка, сталактиты, кислота, шипы, секреты, все 4 обитателя', () => {
  const all = L.LEVELS.map(l => l.map.join(''));
  const has = ch => all.filter(m => m.includes(ch)).length;
  ok(has('\\') >= 3 && has('r') >= 3 && has('R') >= 3 && has('H') >= 3 && has('G') >= 4 && has('d') >= 3 && has('%') >= 3, 'механики');
  ok(has('V') >= 2 && has('~') >= 4 && has('^') >= 5 && has('+') >= 4, 'ловушки и тайники');
  for (const e of 'cfjs') ok(has(e) >= 4, 'обитатель ' + e);
});

// ---------- Физика ----------
test('физика: бег 6 кл/с, прыжок ≈ 3.1 клетки (короткое нажатие — ниже), упор в стену', () => {
  const { game, S } = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P.........']));
  const x0 = S.pl.x; run(game, 0.5, 1); ok(Math.abs(S.pl.x - x0 - 3) < 0.05, 'бег ' + (S.pl.x - x0));
  run(game, 3, 1); eq(S.pl.x, 11 - L.PW, 'стена');
  place(S, 5, 6); let top = 9; game.setInput(0, true); for (let i = 0; i < 40; i++){ game.update(STEP); top = Math.min(top, S.pl.y); }
  const hi = 7 - L.PH - top; ok(hi > 3.0 && hi < 3.3, 'высота ' + hi);
  run(game, 1, 0, false); place(S, 5, 6); top = 9; game.setInput(0, true); game.update(STEP); game.setInput(0, false); for (let i = 0; i < 40; i++){ game.update(STEP); top = Math.min(top, S.pl.y); }
  ok(7 - L.PH - top < 1.2, 'короткий прыжок ' + (7 - L.PH - top));
});
test('карниз «-»: снизу пролетаешь, сверху стоишь', () => {
  const { game, S } = arena(BOX(['..........', '..........', '..........', '..........', '...----...', '..........', 'P.........']));
  place(S, 5, 7); run(game, 0.6, 0, true); run(game, 0.6);
  ok(S.pl.ground && Math.abs(S.pl.y + L.PH - 5) < 1e-6, 'стоит на карнизе, y=' + (S.pl.y + L.PH));
});

// ---------- Кристаллы и выход ----------
test('кристаллы: сбор + очки; выход открыт только когда собраны ВСЕ; вход в открытый выход — уровень пройден', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P.*..*..E.']));
  eq(S.crystals, 2); ok(!S.exitOpen, 'выход закрыт');
  run(game, 0.6, 1); eq(S.crystalsLeft, 1); ok(!S.exitOpen);
  run(game, 0.5, 1); eq(S.crystalsLeft, 0); ok(S.exitOpen, 'открыт'); ok(ev.includes('exitOpen'));
  eq(S.score, 2 * L.SCORE.crystal);
  run(game, 0.6, 1); eq(S.phase, 'clear'); ok(ev.includes('clear'));
});
test('выход не пускает, пока кристаллы не собраны', () => {
  const { game, S } = arena(BOX(['..........', '..*.......', '..........', '..........', '..........', 'P.....E...']));
  run(game, 1.2, 1); eq(S.phase, 'play'); ok(!S.exitOpen);
});

// ---------- Рычаг: решётки и мосты ----------
test('рычаг (↓): решётка «|» открывается, мост «:» появляется; повтор — обратно', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '.....|....', '.....|.*..', 'P\\...|..E.', '##::######']));
  const W = game.world();
  ok(L.cellSolid(W, 6, 6) && !L.cellSolid(W, 3, 7), 'исходно: решётка закрыта, моста нет');
  place(S, 2, 6); game.down(); ok(S.chan && ev.includes('lever'));
  ok(!L.cellSolid(game.world(), 6, 6) && L.cellSolid(game.world(), 3, 7), 'решётка открыта, мост есть');
  game.down(); ok(!S.chan && L.cellSolid(game.world(), 6, 6), 'выкл — снова закрыто');
});
test('без рычага ↓ ничего не делает (нет взрывчатки)', () => {
  const { game, S } = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P.........']));
  ok(!game.down()); eq(S.dynas.length, 0);
});

// ---------- Ключи и двери ----------
test('ключи: дверь без ключа — стена; с ключом своего цвета открывается вся створка; чужой ключ не подходит', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '......B...', '......R...', 'P.r...R.*E']));
  run(game, 1.5, 1); ok(S.keys.R, 'ключ взят'); ok(ev.includes('key'));
  ok(S.pl.x > 7, 'прошла сквозь красную дверь'); ok(ev.includes('door'));
  eq(S.grid[5 * S.cols + 7], '.'); eq(S.grid[6 * S.cols + 7], '.'); eq(S.grid[4 * S.cols + 7], 'B', 'синяя осталась');
  const b = arena(BOX(['..........', '..........', '..........', '..........', '......B...', 'P.r...B.*E']));
  run(b.game, 1.5, 1); ok(b.S.pl.x < 7 - L.PW + 0.01, 'синяя дверь не открылась красным ключом');
});

// ---------- Лифты ----------
test('лифт: стоит на остановке, везёт наверх, ждёт и едет обратно; героиню несёт', () => {
  const { game, S, ev } = arena(['############', '#..........#', '#..........#', '#..........#', '####=.######', '#..........#', '#..........#', '#..........#', '#P.#..#...E#', '####HH######', '############']);
  const Lf = S.lifts[0]; eq(Lf.yB, 9); eq(Lf.yT, 4); eq(Lf.w, 2);
  S.pl.x = 5 - L.PW / 2; S.pl.y = 9 - L.PH; S.pl.ground = true;
  for (let i = 0; i < 60 * 4; i++){ game.setInput(0, false); game.update(STEP); }
  ok(Lf.y === 4 || Lf.dir > 0, 'лифт доехал до верха');
  ok(Math.abs(S.pl.y + L.PH - 4) < 0.05, 'героиня наверху, ноги на ' + (S.pl.y + L.PH)); ok(ev.includes('lift'));
  for (let i = 0; i < 60 * 4; i++) game.update(STEP);
  ok(Lf.y > 4, 'поехал вниз');
});

// ---------- Гравитация ----------
test('сфера гравитации: вход переворачивает тяготение — героиня и обитатели «падают» вверх; повторный вход — обратно', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '...G......', '..........', 'P......c..']));
  const crawler = S.enemies[0];
  place(S, 4, 6); run(game, 0.2, 0, true); run(game, 0.1);
  eq(S.gs, -1); ok(ev.includes('flip'));
  run(game, 1.2); ok(S.pl.ground && S.pl.y < 1.1, 'на потолке, y=' + S.pl.y);
  ok(crawler.y < 2, 'обитатель тоже на потолке');
  run(game, 0.25, 0, true); run(game, 1.2); eq(S.gs, 1, 'обратно'); ok(S.pl.y > 4, 'снова на полу');
});
test('сфера срабатывает один раз за вход (стоя внутри — не мигает)', () => {
  const { game, S } = arena(BOX(['..........', '..........', '..........', '..........', '...G......', 'P.........']));
  place(S, 4, 6); S.pl.orbLock = false; run(game, 0.02); eq(S.gs, -1); run(game, 0.05); eq(S.gs, -1);
});

// ---------- Взрывчатка ----------
test('взрывчатка: подбор, закладка ↓, через 2 с — взрыв рушит трещиноватые стены рядом, ранит героиню рядом', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '....%.....', '....%.....', 'Pd..%...*E']));
  run(game, 0.4, 1); eq(S.dyn, 1); ok(ev.includes('dyn'));
  place(S, 4, 6); ok(game.down(), 'заложена'); eq(S.dyn, 0); eq(S.dynas.length, 1);
  run(game, 1.0, -1); eq(S.grid[6 * S.cols + 5], '%', 'ещё не взорвалось');
  run(game, 1.2); ok(ev.includes('blast'));
  eq(S.grid[6 * S.cols + 5], '.'); eq(S.grid[4 * S.cols + 5], '%', 'дальняя клетка цела'); eq(S.hp, 3, 'отбежала — цела');
  const b = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'Pd..%...*E']));
  run(b.game, 0.4, 1); b.game.down(); run(b.game, 2.2); eq(b.S.hp, 2, 'рядом со взрывом — минус здоровье');
});

// ---------- Бластер ----------
test('бластер: заряды ограничены, выстрел тратит заряд, пусто — щелчок; ящик пополняет (+4, не выше 12)', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P.......a.']));
  eq(S.ammo, L.AMMO0);
  for (let i = 0; i < 10; i++){ game.fire(); run(game, 0.3); }
  eq(S.ammo, 0); ok(ev.includes('empty'), 'пусто'); ok(!game.fire());
  run(game, 1.5, 1); eq(S.ammo, L.CRATE); ok(ev.includes('ammo'));
  S.ammo = 12; S.items.forEach(i => { i.taken = false; }); place(S, 7, 6); run(game, 0.3, 1); eq(S.ammo, 12); ok(!S.items[0].taken, 'полный запас — ящик остаётся');
});
test('выстрел попадает в низкого ползуна, в стену — гаснет', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P.....c#..']));
  S.enemies[0].vx = 0; game.fire(); run(game, 0.5); ok(S.enemies[0].dead, 'хрупень убит'); ok(ev.includes('kill'));
  game.fire(); run(game, 0.6); eq(S.shots.length, 0);
});

// ---------- Обитатели ----------
test('обитатели: хрупень разворачивается у края и стены; светляк летает; скакун прыгает к героине; плевун плюётся по линии', () => {
  let a = arena(BOX(['..........', '..........', '..........', '..........', '.c........', '####.....P']));
  const c = a.S.enemies[0]; run(a.game, 3); ok(c.y < 6 && c.x >= 1 && c.x + c.w <= 5.05, 'хрупень остался на уступе: ' + c.x.toFixed(2));
  a = arena(BOX(['..........', '..........', '....f.....', '..........', '..........', 'P.........']));
  const f = a.S.enemies[0], fx = f.x; run(a.game, 1); ok(Math.abs(f.x - fx) > 1, 'светляк летит');
  a = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P....j....']));
  const j = a.S.enemies[0]; let air = false; for (let i = 0; i < 200; i++){ a.game.update(STEP); if (!j.ground) air = true; } ok(air, 'скакун прыгал');
  a = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P.......s.']));
  run(a.game, 3.5); ok(a.ev.includes('spit'), 'плевок'); ok(a.S.hp < 3, 'камешек попал');
});
test('касание обитателя: −1 здоровья и неуязвимость 1.4 с; 0 здоровья — минус жизнь, уровень заново', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P.c.....*E']));
  S.enemies[0].vx = -2; run(game, 0.9); eq(S.hp, 2); ok(S.pl.inv > 0);
  game._hurt('x'); eq(S.hp, 2, 'неуязвима'); S.pl.inv = 0; game._hurt('x'); S.pl.inv = 0; game._hurt('x');
  eq(S.phase, 'dead'); eq(S.lives, 2); ok(ev.includes('die'));
  run(game, 2); eq(S.phase, 'play'); eq(S.hp, 3); eq(S.crystalsLeft, S.crystals, 'уровень заново'); ok(S.pl.x < 2, 'на старте');
});

// ---------- Ловушки ----------
test('ловушки: шипы ранят, кислота — сразу минус жизнь, сталактит срывается над героиней', () => {
  let a = arena(BOX(['..........', '..........', '..........', '..........', '..........', 'P..^......']));
  run(a.game, 0.5, 1); ok(a.S.hp < 3, 'шипы'); ok(a.ev.includes('hurt'));
  a = arena(['############', '#..........#', '#..........#', '#P.........#', '###~~~######', '############']);
  run(a.game, 0.6, 1); eq(a.S.phase, 'dead'); eq(a.S.lives, 2);
  a = arena(BOX(['....V.....', '..........', '..........', '..........', '..........', 'P.........']));
  run(a.game, 0.55, 1); ok(['shake', 'fall'].includes(a.S.stal[0].state), 'сорвался: ' + a.S.stal[0].state);
  run(a.game, 1.5); eq(a.S.stal[0].state, 'gone');
});

// ---------- Секреты ----------
test('секрет: ложная стена «+» проходима, находка даёт очки и считается один раз; самоцвет внутри', () => {
  const { game, S, ev } = arena(BOX(['..........', '..........', '..........', '..........', '.....+....', 'P....+.$*E']));
  eq(S.secrets.length, 1); run(game, 1.4, 1);
  ok(ev.includes('secret') && ev.includes('gem')); eq(S.secretsFound, 1);
  ok(S.score >= L.SCORE.secret + L.SCORE.gem);
  const n = ev.filter(e => e === 'secret').length; run(game, 0.5, -1); run(game, 0.5, 1); eq(ev.filter(e => e === 'secret').length, n);
});

// ---------- Хаб ----------
test('хаб: открыт только 1-й, уровни открываются по очереди, пройденный не перепроходится, курсор в пределах открытых', () => {
  const g = Z.Game({ rng: mulberry32(3) }).start(), S = g.state();
  eq(S.phase, 'hub'); eq(S.open, 1);
  g.hubMove(1); eq(S.hubSel, 1, 'дальше закрыто'); ok(!g.enter(2));
  ok(g.enter(1)); eq(S.level, 1); eq(S.phase, 'play');
  g._clear(); for (let i = 0; i < 200; i++) g.update(STEP);
  eq(S.phase, 'hub'); eq(S.open, 2); eq(S.hubSel, 2); ok(S.cleared[1]);
  g.hubMove(-1); eq(S.hubSel, 1); ok(!g.enter(1), 'пройденный'); g.hubMove(1); ok(g.enter()); eq(S.level, 2);
  const g2 = Z.Game({ level: 9 }).start(); eq(g2.state().open, 9); ok(g2.state().cleared[8], 'эпизод 2: первые 8 пройдены');
});
test('финал: Исполин — 24 удара, не заживает между попытками; победа после него → win', () => {
  const ev = []; const g = Z.Game({ rng: mulberry32(1), level: 17, onEvent: t => ev.push(t) }).start(); g.enter(17);
  const S = g.state(), B = S.boss; eq(B.hp, 24); ok(S.bossLevel && !S.exitOpen);
  for (let i = 0; i < 5; i++) g._explode({ x: B.x + B.w / 2, y: B.y + B.h / 2 });
  ok(B.hp <= 4, 'взрывчатка ранит Исполина: ' + B.hp);
  const hp = B.hp; S.pl.inv = 0; g._hurt('t'); S.pl.inv = 0; g._hurt('t'); S.pl.inv = 0; g._hurt('t');
  for (let i = 0; i < 150; i++) g.update(STEP); eq(S.boss.hp, hp, 'не зажил');
  S.boss.hp = 1; S.shots.push({ x: S.boss.x - 0.2, y: S.boss.y + 1, vx: 16, d: 0 }); g.update(STEP);
  ok(ev.includes('bossDie')); for (let i = 0; i < 200; i++) g.update(STEP); ok(ev.includes('win') && S.won);
});
test('сложность растёт: обитатели быстрее, плевун чаще к концу игры', () => {
  const p = []; for (const n of [1, 16]){ const g = Z.Game({ level: n, rng: mulberry32(2) }).start(); g.enter(n); const c = g.state().enemies.find(e => e.type === 'c'); p.push(Math.abs(c.vx)); }
  ok(p[1] > p[0] * 1.4, 'хрупень: ' + p.join(' → '));
});

// ---------- Музыка и тексты ----------
test('музыка: трек есть, длины голосов кратны такту', () => {
  const sb = { window: {} }; sb.window.Arcade = {}; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), sb);
  const T = sb.window.Arcade.tracks.zheoda; ok(T && T.bpm > 0);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0); eq(n(T.drums) % 8, 0);
});
test('i18n: RU/EN — одинаковые ключи, у всех уровней есть названия', () => {
  const ru = Object.keys(Z.STR.ru).sort(), en = Object.keys(Z.STR.en).sort();
  eq(ru.join(), en.join());
  L.LEVELS.forEach(l => { ok(Z.STR.ru['lv_' + l.name] && Z.STR.en['lv_' + l.name], l.name); if (l.tip) ok(Z.STR.ru['tip_' + l.tip], 'tip ' + l.tip); });
});
test('правило имён: нет чужих игр, героев, компаний (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from(STOP, 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('Q3J5c3RhbCBDYXZlcw==')) && BAD.test(u('0JzQsNC50LvQvg==')) && BAD.test(u('Q29tbWFuZGVyIEtlZW4=')), 'стоп-лист работает');
  ok(!BAD.test('кристаллы в пещерах') && !BAD.test('Crystal') && !BAD.test('жеода') && !BAD.test('космос') && !BAD.test('кинул') && !BAD.test('скин'), 'без ложных срабатываний');
});

// ---------- Проходимость ----------
const PL = makePlanner(Z);
test('проходимость: граф достижимости (гравитация, ключи, рычаги, лифты, взрывчатка) — все кристаллы и выход каждого уровня достижимы', () => {
  const bad = [];
  for (let n = 1; n <= 16; n++){ const r = reachLevel(Z, n, PL); if (r.got !== r.crystals || !r.exit) bad.push(n + ':' + r.got + '/' + r.crystals + (r.exit ? '' : ' без выхода')); }
  ok(!bad.length, bad.join(', '));
});
const PASS = []; for (let n = 1; n <= 17; n++) PASS.push({ n, r: playZheoda(Z, 1, { perfect: true, startLevel: n, levels: 1, noEnemies: n < 17, planner: PL, maxLevelT: 200 }) });
test('проходимость: «идеальный» агент проходит каждый из 17 уровней (без ловушек-тупиков) ≤ 200 с', () => {
  console.log('     время, с: ' + PASS.map(p => p.n + ':' + (p.r.levelTime[p.n] || 0).toFixed(0)).join(' '));
  const bad = PASS.filter(p => !p.r.won).map(p => p.n + (p.r.stuck ? '(тупик)' : ''));
  ok(!bad.length, 'не пройдены: ' + bad.join(', '));
});

// ---------- Баланс ----------
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс нажатий ±1 кадр, промахи, осторожность
// к рискованным прыжкам; ввод только setInput/fire/down. 40 партий (сиды 1..40), ~25 с.
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playZheoda(Z, s, { planner: PL }));
test('баланс: бот проходит 1-й уровень в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.passed >= 1).length; console.log('     уровень 1: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: вся игра (16 уровней + Исполин) — 20–45% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(18).fill(0); BAL.forEach(r => dist[r.passed]++);
  console.log('     вся игра: ' + n + '/' + N + '; пройдено уровней 0..17: ' + dist.join(','));
  ok(n >= 0.2 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.45 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => r.stuck), 'бот застрял на уровне: ' + BAL.filter(r => r.stuck).map(r => r.stuck).join(','));
});
test('непресность: смертей на уровень больше во втором эпизоде', () => {
  const per = []; for (let w = 1; w <= 17; w++){ const reach = BAL.filter(r => r.passed >= w - 1).length; let d = 0; for (const r of BAL) d += (r.deaths[w] || 0); per.push(d / Math.max(1, reach)); }
  console.log('     смертей на уровень: ' + per.map(v => v.toFixed(2)).join(' '));
  const a = per.slice(0, 8).reduce((x, y) => x + y) / 8, b = per.slice(8, 17).reduce((x, y) => x + y) / 9;
  ok(b > a * 1.5, 'нет нарастания: ' + a.toFixed(2) + ' → ' + b.toFixed(2));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
