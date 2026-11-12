/* ПОДКОП · tests/engine.test.mjs — автотесты логики (js/game.js + js/levels.js), трека, миграции
   рекорда и оболочки v2. Запуск: node podkop/tests/engine.test.mjs. Node без зависимостей. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Array, Object, Set, Map, String, JSON };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/levels.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const P = sandbox.PODKOP, LEVELS = sandbox.PODKOP_LEVELS;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

function mk(ev) { const g = new P.Game(LEVELS, { onEvent: (t, d) => ev && ev.push([t, d]) }); g.startRun(); return g; }
function run(g, sec, input) { if (input) g.setInput(input); for (let i = 0; i < Math.round(sec * 60); i++) g.update(1 / 60); g.setInput({}); }
// Пустая «коробка» 28×16: монолит по краю, пол — кирпич (=) в ряд 14, без врагов и золота.
function box(g) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 28; x++) g.base[y][x] = (x === 0 || y === 0 || x === 27 || y === 15) ? '#' : (y === 14 ? '=' : '.');
  g.enemies = []; g.gold.clear(); g.gold.add('20,1'); g.totalGold = 1; g.holes.clear(); g.freeze = 0;
  const p = g.player; p.x = p.px = 5; p.y = p.py = 13; p.move = null; p.state = 'idle';
  return g;
}

test('уровни: 10 штук, у каждого 16 строк по 28, есть @, золото, выход и стража', () => {
  eq(LEVELS.length, 10);
  LEVELS.forEach((l, i) => {
    eq(l.rows.length, 16, 'строк в уровне ' + (i + 1)); l.rows.forEach((r) => eq(r.length, 28, 'ширина ур.' + (i + 1)));
    const all = l.rows.join(''); ok(all.includes('@') && all.includes('$') && all.includes('E') && all.includes('X'), 'нет @/$/E/X в ур.' + (i + 1));
    ok(l.name && l.nameEn && l.hint && l.hintEn, 'нет RU/EN названия/подсказки ур.' + (i + 1));
  });
});

test('уровни: BFS-валидатор (золото и выход достижимы без копания) — tools/validate-levels.mjs', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/validate-levels.mjs')], { encoding: 'utf8' });
  eq(r.status, 0, 'валидатор упал:\n' + (r.stdout || '') + (r.stderr || ''));
  ok(/ошибок нет/.test(r.stdout), 'нет строки «ошибок нет»');
});

test('старт забега: уровень 1, 3 жизни, счёт 0, игрок стоит на опоре', () => {
  const g = mk(); eq(g.state, 'playing'); eq(g.levelIndex, 0); eq(g.lives, 3); eq(g.score, 0);
  ok(g.totalGold > 0 && g.gold.size === g.totalGold, 'золото'); ok(g.isSupported(g.player.x, g.player.y), 'игрок висит в воздухе');
});

test('бег: удержание → игрок идёт по клеткам, в монолит не проходит', () => {
  const g = box(mk()); run(g, 0.6, { right: true }); ok(g.player.x > 5, 'не пошёл вправо: ' + g.player.x);
  run(g, 6, { right: true }); eq(g.player.x, 26, 'должен упереться в правую стену');
});

test('лестница: ↑ поднимает, ↓ опускает; без лестницы ↑ не работает', () => {
  const g = box(mk()); for (let y = 8; y <= 13; y++) g.base[y][6] = 'H';
  run(g, 0.5, { up: true }); eq(g.player.y, 13, 'без лестницы подъёма нет');
  g.player.x = g.player.px = 6; run(g, 1.2, { up: true }); ok(g.player.y < 13, 'не поднялся: y=' + g.player.y);
  const top = g.player.y; run(g, 1.2, { down: true }); ok(g.player.y > top, 'не спустился');
});

test('канат: висит на канате, не падает; ↓ — спрыгнуть', () => {
  const g = box(mk()); for (let x = 3; x <= 12; x++) g.base[8][x] = '-';
  g.player.x = g.player.px = 3; g.player.y = g.player.py = 8; run(g, 1, { right: true });
  eq(g.player.y, 8, 'сорвался с каната'); ok(g.player.x > 3, 'не перебирается по канату');
  run(g, 1.5, { down: true }); eq(g.player.y, 13, 'не спрыгнул на пол');
});

test('падение: шаг в пустоту — падает до опоры', () => {
  const g = box(mk()); for (let x = 1; x < 27; x++) g.base[10][x] = '='; g.base[10][8] = '.';
  g.player.y = g.player.py = 9; g.player.x = g.player.px = 7; run(g, 1.2, { right: true });
  ok(g.player.y === 13 || g.player.y === 9, 'странная высота'); // сначала шаг на 8 и провал вниз до пола
  const g2 = box(mk()); for (let x = 1; x < 27; x++) g2.base[10][x] = '='; g2.base[10][8] = '.';
  g2.player.y = g2.player.py = 9; g2.player.x = g2.player.px = 7; run(g2, 0.15, { right: true }); run(g2, 1.2);
  eq(g2.player.x, 8); eq(g2.player.y, 13, 'не упал на пол');
});

test('копание: яма в кирпиче слева/справа снизу; в монолите — нельзя; яма зарастает', () => {
  const g = box(mk()); ok(g.dig(1), 'dig вправо отказал'); run(g, 0.4); ok(g.isHole(6, 14), 'нет ямы справа-снизу');
  ok(g.dig(-1), 'dig влево отказал'); run(g, 0.4); ok(g.isHole(4, 14), 'нет ямы слева-снизу');
  g.base[14][7] = '#'; g.player.x = g.player.px = 6; g.holes.clear(); g.base[14][6] = '='; g.base[14][4] = '=';
  ok(!g.dig(1), 'копнул монолит');
  g.player.x = g.player.px = 9; ok(g.dig(1), 'dig'); run(g, 0.4); ok(g.isHole(10, 14));
  run(g, P.Game.HOLE_TIME + 0.2); ok(!g.isHole(10, 14), 'яма не заросла'); eq(g.base[14][10], '=');
});

test('ловушка: страж проваливается в яму, когда она зарастает — погибает, +150', () => {
  const ev = []; const g = box(mk(ev)); const en = { ...g.player };
  Object.assign(en, { kind: 'enemy', id: 99, x: 10, y: 13, px: 10, py: 13, state: 'idle', move: null, actCooldown: 99, spawnX: 20, spawnY: 13, path: null, pathKey: '' });
  g.enemies = [en]; g._makeHole(10, 14); const sc = g.score;
  run(g, 0.6); eq(en.state, 'hole', 'страж не попал в яму: ' + en.state);
  run(g, P.Game.HOLE_TIME); eq(en.state === 'dead' || en.state === 'spawn', true, 'страж не погиб: ' + en.state);
  ok(g.score >= sc + 150, 'очков нет'); ok(ev.some(([t]) => t === 'enemyTrap'), 'нет события enemyTrap');
});

test('игрок в зарастающей яме погибает: −1 жизнь, уровень заново', () => {
  const ev = []; const g = box(mk(ev)); g._makeHole(5, 14); run(g, 0.5);
  run(g, P.Game.HOLE_TIME + 1.5);
  ok(ev.some(([t, d]) => t === 'die' && d.reason === 'hole'), 'не погиб в яме'); eq(g.lives, 2);
});

test('контакт со стражей — смерть; на последней жизни — gameover', () => {
  const ev = []; const g = box(mk(ev)); g.lives = 1; const en = { ...g.player };
  Object.assign(en, { kind: 'enemy', x: 5, y: 13, px: 5, py: 13, state: 'idle', actCooldown: 99, move: null });
  g.enemies = [en]; run(g, 0.1); eq(g.state, 'dying'); run(g, 1.5);
  eq(g.state, 'gameover'); ok(ev.some(([t]) => t === 'gameover'), 'нет события gameover');
});

test('золото: всё собрано → выход открыт (openAt), касание выхода → complete → уровень 2', () => {
  const ev = []; const g = mk(ev); g.freeze = 0; g.enemies = [];
  [...g.gold].forEach((k) => { const [x, y] = k.split(',').map(Number); g._collectGoldAt(x, y); });
  ok(g.exit.open && g.exitIsUsable(), 'выход закрыт'); ok(typeof g.exit.openAt === 'number', 'нет exit.openAt (для лестницы)');
  ok(ev.some(([t]) => t === 'exitOpen'), 'нет exitOpen');
  const p = g.player; p.move = null; p.x = g.exit.x; p.y = g.exit.y; g._arrive(p);
  eq(g.state, 'complete'); const c = ev.find(([t]) => t === 'complete'); ok(c && c[1].total >= 250, 'нет бонуса');
  g.nextLevel(); eq(g.levelIndex, 1); eq(g.state, 'playing');
});

test('выход заперт, пока есть золото', () => {
  const g = mk(); g.freeze = 0; g.enemies = []; const p = g.player; p.move = null; p.x = g.exit.x; p.y = g.exit.y; g._arrive(p);
  ok(g.state !== 'complete', 'прошёл уровень без золота');
});

test('все 10 уровней подряд → victory', () => {
  const ev = []; const g = mk(ev);
  for (let i = 0; i < 10; i++) {
    g.enemies = []; [...g.gold].forEach((k) => { const [x, y] = k.split(',').map(Number); g._collectGoldAt(x, y); });
    const p = g.player; p.move = null; p.x = g.exit.x; p.y = g.exit.y; g._arrive(p); eq(g.state, 'complete', 'ур.' + (i + 1)); g.nextLevel();
  }
  eq(g.state, 'victory'); ok(ev.some(([t]) => t === 'victory'), 'нет события victory');
});

test('стража на каждом уровне просыпается и двигается (ИИ не стоит)', () => {
  for (let L = 0; L < 10; L++) {
    const g = new P.Game(LEVELS, {}); g.startLevel(L); const start = g.enemies.map((e) => e.x + ',' + e.y);
    run(g, 4); const moved = g.enemies.some((e, i) => (e.x + ',' + e.y) !== start[i]); ok(moved || g.state !== 'playing', 'стража стоит на ур.' + (L + 1));
  }
});

// ---------- Миграция рекорда из прежних ключей ----------
{
  const box2 = { console, Math, Array, Object, String, parseInt };
  box2.window = box2; box2.globalThis = box2; vm.createContext(box2);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/store-migrate.js'), 'utf8'), box2, { filename: 'store-migrate.js' });
  const M = box2.PODKOP;
  function mem(init) { const m = new Map(Object.entries(init || {})); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
  const OLD = M.OLD_KEYS;
  test('миграция: старый рекорд переносится в arcade.best.podkop, старые ключи удаляются', () => {
    const s = mem({ [OLD[0]]: '4210', [OLD[1]]: 'retro', [OLD[2]]: 'en', [OLD[3]]: '1', [OLD[4]]: '1', 'arcade.lang': 'ru' });
    eq(M.migrateStore(s), 4210); eq(s.getItem('arcade.best.podkop'), '4210');
    OLD.forEach((k) => eq(s.getItem(k), null, 'остался ' + k)); eq(s.getItem('arcade.lang'), 'ru', 'чужой ключ тронут');
  });
  test('миграция: новый рекорд больше старого — не затирается; повторный запуск безопасен', () => {
    const s = mem({ [OLD[0]]: '300', 'arcade.best.podkop': '900' }); eq(M.migrateStore(s), 900); eq(s.getItem('arcade.best.podkop'), '900');
    eq(M.migrateStore(s), 900); eq(s.getItem(OLD[0]), null);
  });
  test('миграция: без хранилища / с исключением — не падает', () => {
    eq(M.migrateStore(null), 0); eq(M.migrateStore({ getItem() { throw new Error('denied'); } }), 0);
  });
}

// ---------- Оболочка v2 ----------
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const box3 = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat };
  box3.window = box3; box3.globalThis = box3; vm.createContext(box3);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box3, { filename: 'engine.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box3, { filename: 'music.js' });
  const A = box3.Arcade;
  test('v2: engine.js — копия _shared/engine.js (v2.1+)', () => {
    eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '../_shared/engine.js'), 'utf8'), 'engine.js рассинхронизирован');
    ok(/^2\.(1|[2-9])/.test(A.version), 'версия ' + A.version);
  });
  test('v2: оригинальный трек Arcade.tracks.podkop — 8 тактов, валидные ноты', () => {
    const t = A.tracks && A.tracks.podkop; ok(t, 'нет трека'); const c = A.parseTrack(t);
    eq(c.melody.length, 8 * t.div * 4, 'шагов мелодии'); ok(c.bass.length && c.drums.length, 'нет баса/ударных');
    ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'длины голосов не кратны');
  });
  test('v2: порядок скриптов, gameId, фавикон, «← Каталог», тач-кнопки копания', () => {
    const srcs = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map((m) => m[1].replace(/^\.\//, ''));
    eq(srcs[0], 'engine.js'); eq(srcs[1], 'js/music.js'); eq(srcs[2], 'js/store-migrate.js', 'миграция до createGame');
    ['js/levels.js', 'js/game.js', 'js/render.js'].forEach((s) => { ok(srcs.includes(s), 'нет ' + s); ok(fs.existsSync(path.join(ROOT, s)), 'нет файла ' + s); });
    ok(html.includes("gameId:'podkop'"), 'gameId'); ok(html.includes('rel="icon"') && html.includes('%23EA6A12'), 'фавикон студии');
    ok(html.includes('href="../">← Каталог'), 'нет «← Каталог»'); ok(html.includes('id="bDigL"') && html.includes('id="bDigR"'), 'нет тач-копания');
    ok(/theme:'modern'/.test(html), 'modern по умолчанию');
  });
  test('v2: строки RU/EN оболочки — одинаковые ключи', () => {
    const m = /var STR=\{([\s\S]*?)\n\};/.exec(html); ok(m, 'нет STR');
    const keys = (lang) => [...new RegExp(lang + ':\\{([\\s\\S]*?)\\}(,|\\s*$)').exec(m[1])[1].matchAll(/(\w+):'/g)].map((x) => x[1]).sort().join(',');
    eq(keys('ru'), keys('en'));
  });
  test('рендер: темы retro и modern, «проявившаяся лестница» над выходом', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/render.js'), 'utf8');
    ok(src.includes('_drawRetro') && src.includes('_drawModern'), 'нет одного из рендеров'); ok(src.includes('_exitLadder'), 'нет лестницы выхода');
  });
}

// ---------- Правило имён ----------
// Полная grep-проверка по списку чужих названий делается вне репо (список сам по себе — чужие имена).
test('правило имён: прежнего префикса ключей нет целиком ни в одном файле игры', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const OLD = ['lode', 'runner'].join('');
  for (const f of walk(ROOT)) {
    ok(!path.basename(f).toLowerCase().includes('runner'), 'старое имя в имени файла ' + f);
    if (/\.(html|js|mjs|md|json|css)$/.test(f)) ok(!fs.readFileSync(f, 'utf8').toLowerCase().includes(OLD), path.relative(ROOT, f));
  }
});

console.log('\n' + (failed ? 'НЕУСПЕХ' : 'OK') + ' ' + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
