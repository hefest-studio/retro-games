/* ОСКОЛОК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node oskolok/tests/engine.test.mjs (QUICK=1 — без графов и партий бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: физику героя (дуга прыжка), осколок (бросок по стрелкам, втыкание в камень, прохождение сквозь стекло, обмен, «не влезло», возврат,
   подбор бусин и бой на лету), врагов (ползун, мотылёк, лампа-стрелок), сердечки/жизни/продолжения, стекляшки и яму с возвратом на опору,
   лампы-отметки, зал → зал → победа, сохранение, миграцию записей, музыку, i18n (5 языков), правило имён,
   проходимость каждого зала графом по настоящей игре (без осколка — непроходим; без тупиков), исполнение пути, «человеческий» бот. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { checkPlatformFeatures } from '../../tools/promo/platform-features.check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const O = sandbox.OSKOLOK, L = O.logic, K = L.K, DT = 1 / 60;
const { makeNav, playGame, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, d, m){ if (Math.abs(a - b) > d) throw new Error((m || '') + ' ждали ≈' + b + '±' + d + ', получили ' + a); }
// игра на зале fi; calm — без врагов; свой «пустой» зал flat(): пол на ряду 16
function mk(fi = 0, o = {}){
  const ev = [];
  const game = O.Game({ calm: o.calm !== false, start: { fi }, onEvent: (t, d) => ev.push({ t, d }) }).start();
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(typeof inp === 'function' ? inp(game.state(), i) : inp); game.update(DT); } game.setInput({}); }
function tap(game, inp, n = 1){ for (let i = 0; i < n; i++){ game.setInput(inp); game.update(DT); } game.setInput({}); game.update(DT); }
function setCells(S, list){ list.forEach(([c, r, ch]) => { S.lv.t[r * S.lv.W + c] = ch; }); }

test('уровни: шесть залов, карта W×H, старт P, выход X, рамка из камня, знаки только из набора', () => {
  eq(O.LEVELS.length, 6);
  for (const lv of O.LEVELS){
    eq(lv.map.length, lv.H, lv.key); lv.map.forEach(r => eq(r.length, lv.W, lv.key + ' ширина'));
    const all = lv.map.join(''); eq((all.match(/P/g) || []).length, 1, lv.key + ' старт'); ok(/X/.test(all), lv.key + ' выход');
    ok(!/[^.#g^PXohkebtT]/.test(all), lv.key + ' чужой знак: ' + (all.match(/[^.#g^PXohkebtT]/) || [])[0]);
    ok(lv.map[0].split('').every(c => c === '#') && lv.map.every(r => r[0] === '#' && r[lv.W - 1] === '#'), lv.key + ' рамка');
  }
  ok(O.LEVELS[2].H > 30, 'башня высокая');
});
test('физика: прыжок на ≈2.5 клетки, бег 6.5 кл/с, стена останавливает', () => {
  const { game, S } = mk(0); S.hero.x = 5.5; let top = 16;
  tap(game, { jump: true }); for (let i = 0; i < 60; i++){ game.update(DT); top = Math.min(top, S.hero.y); }
  near(16 - top, 2.5, 0.15, 'высота');
  game._place(5.5, 16); run(game, 0.6, { dx: 1 }); near(S.hero.vx, 6.5, 0.05); ok(S.hero.x > 8, 'x=' + S.hero.x);
  game._place(2.5, 16); run(game, 1, { dx: -1 }); near(S.hero.x, 1.32, 0.02, 'стена');
});
test('осколок: бросок «прямо» — дуга ≈ 8 клеток, втыкается в пол; повторное нажатие — обмен', () => {
  const { game, S, ev } = mk(0); game._place(14.5, 16, 1);
  tap(game, { dx: 1, act: true }); eq(S.shard.st, 'fly'); run(game, 1.2); eq(S.shard.st, 'plant'); eq(S.shard.kind, 'floor');
  ok(S.shard.x > 22 && S.shard.x < 25, 'x=' + S.shard.x);
  tap(game, { act: true }); run(game, 0.2);
  near(S.hero.x, 23.5, 1.5); near(S.hero.y, 16, 0.01); eq(S.shard.st, 'hand'); ok(ev.some(e => e.t === 'swap'));
});
test('осколок: стрелки задают наклон — вверх по диагонали ложится на высокий уступ; ↑ — почти вертикально; ↓ — близко', () => {
  const { game, S } = mk(0); game._place(26.5, 16, 1);
  tap(game, { dx: 1, dy: -1, act: true }); run(game, 1.5); eq(S.shard.st, 'plant'); ok(S.shard.y < 13 && S.shard.x > 30, 'уступ: ' + S.shard.x + ',' + S.shard.y);
  tap(game, { act: true }); run(game, 0.3); near(S.hero.y, 12, 0.01, 'встал на уступ');
  game._place(5.5, 16, 1); tap(game, { dy: -1, act: true }); run(game, 0.3); ok(Math.abs(S.shard.x - 5.5) < 0.1 && S.shard.y < 12, 'вертикаль');
  game._reset(); game._place(5.5, 16, 1); tap(game, { dx: 1, dy: 1, act: true }); run(game, 1); ok(S.shard.x - 5.5 < 6, 'вниз-вперёд: ' + S.shard.x);
});
test('стекло: осколок проходит сквозь стеклянную стену, герой — нет; камень осколок втыкает в стену', () => {
  const { game, S } = mk(0); game._place(38.5, 16, 1);
  run(game, 1, { dx: 1 }); ok(S.hero.x < 44.7, 'герой упёрся в стекло: ' + S.hero.x);
  game._place(40.5, 16, 1); tap(game, { dx: 1, act: true }); run(game, 1.2); ok(S.shard.x > 46, 'осколок за стеклом: ' + S.shard.x);
  tap(game, { act: true }); run(game, 0.3); ok(S.hero.x > 46, 'герой за стеклом');
  game._reset(); game._place(40.5, 16, 1); setCells(S, [[44, 13, '#'], [44, 14, '#'], [44, 15, '#']]); tap(game, { dx: 1, act: true }); run(game, 1); eq(S.shard.kind, 'wall'); ok(S.shard.x < 44.1);
});
test('обмен: «не влезло» — осколок в щели ниже роста героя возвращается в руку, героя не двигает', () => {
  const { game, S, ev } = mk(0); game._place(5.5, 16, 1);
  S.shard = { st: 'plant', x: 12.5, y: 5.2, kind: 'floor', dir: 1, vx: 0, vy: 0 };
  setCells(S, [[12, 5, '#'], [12, 3, '#'], [11, 4, '#'], [13, 4, '#'], [12, 4, '.'], [12, 6, '#'], [11, 5, '#'], [13, 5, '#']]);
  const x0 = S.hero.x; tap(game, { act: true }); eq(S.hero.x, x0); eq(S.shard.st, 'hand'); ok(ev.some(e => e.t === 'fizzle'));
});
test('осколок: возврат (C) в руку; падение за карту — «потерян»; бросать, пока он не в руке, нельзя', () => {
  const { game, S, ev } = mk(0); game._place(3.5, 16, 1);
  tap(game, { dx: 1, act: true }); tap(game, { act: true }); eq(S.shard.st, 'fly', 'во время полёта X ничего не делает');
  tap(game, { recall: true }); eq(S.shard.st, 'hand'); ok(ev.some(e => e.t === 'recall'));
  game._place(11.5, 16, 1); tap(game, { dx: 1, dy: 1, act: true }); run(game, 3.2); ok(S.shard.st === 'hand' || S.shard.st === 'plant');
});
test('осколок: на лету подбирает бусины и бьёт врагов (ползун, мотылёк, лампа) — +200', () => {
  const { game, S, ev } = mk(1, { calm: false }); game._place(3.5, 16, 1); S.enemies = [];
  game._spawn('e', 8, 15); game._spawn('t', 12, 15); game._spawn('b', 6, 14);
  S.items.push({ x: 5.5, y: 14.9, k: 'bead', got: false });
  S.enemies.forEach(e => { e.minX = e.maxX = e.x; });
  tap(game, { dx: 1, act: true }); run(game, 0.5);
  ok(S.enemies.some(e => !e.alive), 'кого-то поразил'); ok(S.score >= 200); ok(ev.some(e => e.t === 'kill'));
  const sc = S.score; S.items.forEach(it => { it.got = false; }); S.items.push({ x: S.shard.x, y: S.shard.y, k: 'bead', got: false }); run(game, 0.05); ok(S.score >= sc + K.BEAD, 'бусина подобрана осколком');
});
test('герой: ползун ранит (−1 сердечко, отброс, неуязвимость 1.4 с), стекляшки и яма — возврат на безопасную опору', () => {
  const { game, S, ev } = mk(1, { calm: false }); game._place(3.5, 16, 1); S.enemies = []; game._spawn('e', 8, 15); S.enemies[0].x = 3.5;
  run(game, 0.1); eq(S.hp, 2); ok(S.hero.inv > 1); const hp = S.hp; run(game, 0.3); eq(S.hp, hp, 'неуязвим');
  game._reset(); S.enemies = []; game._place(8.5, 16, 1); run(game, 0.8); S.safe = { x: 8.5, y: 16 };
  game._place(12.5, 14, 1); S.safe = { x: 8.5, y: 16 }; run(game, 2);
  eq(S.hp, 2, 'яма: −1'); ok(ev.some(e => e.t === 'respawnSafe')); ok(S.hero.x < 9.6 && S.hero.y === 16, 'на опоре ' + S.hero.x + ',' + S.hero.y);
});
test('лампа-стрелок: искра раз в 2.4 с летит вдоль ряда, ранит, камнем гасится; сердечко лечит', () => {
  const { game, S, ev } = mk(0, { calm: false }); S.enemies = []; game._place(6.5, 16, 1); game._spawn('T', 3, 15); S.enemies[0].t = K.TURRET_T - 0.01; S.hero.inv = 0;
  run(game, 0.3); ok(ev.some(e => e.t === 'spark')); run(game, 1); ok(S.hp < 3 || ev.some(e => e.t === 'hurt'), 'искра ранила');
  const g2 = mk(1); g2.S.hp = 1; g2.S.items.push({ x: 3.5, y: 15, k: 'heart', got: false }); g2.game._place(3.5, 16); run(g2.game, 0.1); eq(g2.S.hp, 2);
});
test('сердечки, жизни, продолжения: 0 сердечек — потеря жизни и возврат на лампу; 0 жизней — «продолжить?», 3 продолжения, затем конец', () => {
  const { game, S, ev } = mk(1); game._place(21.5, 16); run(game, 0.2); ok(ev.some(e => e.t === 'checkpoint'), 'лампа зажглась');
  game._place(10, 16); S.hp = 1; game._hurt('crawler'); eq(S.phase, 'dead'); eq(S.lives, 2); run(game, 1.5); eq(S.phase, 'play'); eq(S.hp, 3); near(S.hero.x, 21.5, 0.01, 'на лампе');
  S.lives = 1; S.hp = 1; game._hurt('crawler'); run(game, 1.5); eq(S.phase, 'cont'); ok(ev.some(e => e.t === 'continueQ'));
  game.continueGame(); eq(S.phase, 'play'); eq(S.lives, K.LIVES); eq(S.conts, K.CONTS - 1);
  S.lives = 1; S.conts = 0; S.hp = 1; game._hurt('crawler'); run(game, 1.5); eq(S.phase, 'over'); ok(ev.some(e => e.t === 'gameover'));
});
test('площадка: reviveAd — одна жизнь и 2 сердечка; boost — полное здоровье раз за партию', () => {
  const { game, S } = mk(1); S.lives = 0; S.conts = 0; S.hp = 1; game._hurt('crawler'); run(game, 1.5); eq(S.phase, 'over'); ok(game.reviveAd()); eq(S.phase, 'play'); eq(S.lives, 1); eq(S.hp, 2);
  ok(game.canBoost()); ok(game.boost()); eq(S.hp, 3); ok(!game.canBoost());
});
test('зал пройден: бонус (сердечки×300, без гибели +500), следующий зал, победа на последнем', () => {
  const { game, S, ev } = mk(0); game._place(56.5, 16); run(game, 0.2); eq(S.phase, 'clear'); eq(ev.find(e => e.t === 'clear').d.bonus, 3 * 300 + 500);
  run(game, K.CLEAR + 0.1); eq(S.fi, 1); eq(S.phase, 'play'); eq(S.hp, 3);
  game._level(5); game._place(113.5, 16); run(game, 0.2); eq(S.phase, 'won'); ok(ev.some(e => e.t === 'win'));
});
test('жизнь за очки: 6000, затем каждые 9000', () => {
  const { game, S, ev } = mk(1); S.score = 5950; S.items.push({ x: 3.5, y: 15, k: 'bead', got: false }); game._place(3.5, 16); run(game, 0.1); eq(S.lives, K.LIVES + 1); ok(ev.some(e => e.t === 'life'));
});
test('сохранение и старт с зала: saveData → start; миграция: старое сохранение/концовки стираются, прежний рекорд-время переезжает', () => {
  const g = O.Game({ start: { fi: 3, score: 1234, lives: 2 } }).start(); eq(g.state().fi, 3); eq(g.state().score, 1234); eq(g.state().lives, 2);
  const sd = g.saveData(); eq(sd.fi, 3);
  const st = { 'arcade.besttime.oskolok': '754', 'arcade.save.oskolok': '{"chapter":3}', 'arcade.endings.oskolok': 'AB', 'arcade.best.oskolok': '55' };
  const io = { get: k => st[k] == null ? null : st[k], set: (k, v) => { st[k] = v; }, del: k => { delete st[k]; } };
  const m = O.migrate(io); eq(m.migrated, true); eq(m.oldBest, 754); eq(st['arcade.oskolok.oldBest'], '754'); eq(st['arcade.oskolok.v'], '2'); ok(!st['arcade.save.oskolok'] && !st['arcade.endings.oskolok'] && !st['arcade.besttime.oskolok']); eq(st['arcade.oskolok.notice'], '1');
  const m2 = O.migrate(io); eq(m2.migrated, false); eq(m2.oldBest, 754);
  const fresh = {}; const m3 = O.migrate({ get: k => fresh[k] == null ? null : fresh[k], set: (k, v) => { fresh[k] = v; }, del: k => { delete fresh[k]; } }); eq(m3.migrated, false); eq(fresh['arcade.oskolok.v'], '2');
});
test('музыка и i18n: трек зарегистрирован, 5 языков с одинаковым набором ключей, названия залов и подсказок, EN-название отдельное', () => {
  ok(sandbox.Arcade && sandbox.Arcade.tracks && sandbox.Arcade.tracks.oskolok && sandbox.Arcade.tracks.oskolok.melody.length >= 2, 'трек');
  const langs = ['ru', 'en', 'tr', 'es', 'pt'], keys = Object.keys(O.STR.ru);
  for (const l of langs){ ok(O.STR[l], l); eq(Object.keys(O.STR[l]).length, keys.length, l + ' число ключей'); for (const k of keys) ok(O.STR[l][k], l + ':' + k); }
  for (const k of O.KEYS) ok(O.STR.ru['f_' + k], 'f_' + k);
  ['tutThrow', 'tutUp', 'tutGlass', 'tutSwap'].forEach(k => ok(O.STR.en[k]));
  ok(O.STR.en.title !== O.STR.ru.title);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  const src = fs.readFileSync(path.join(HERE, '..', '..', 'tsep', 'tests', 'engine.test.mjs'), 'utf8').match(/Buffer\.from\('([A-Za-z0-9+/=]+)'/);
  ok(src, 'стоп-лист');
  const BAD = new RegExp(Buffer.from(src[1], 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && !f.endsWith('engine.test.mjs') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 10, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
});
test('прежняя игра убрана: в коде нет резонатора, дрона, Стеклодувов, Теней, провала в чужой мир', () => {
  const OLD = /резонатор|дрон|Стеклодув|Тен[иь]-ловц|Звёздный Горн|чужого мира|кат-сцен|resonator|drone/i;
  for (const f of ['js/game.js', 'js/render.js', 'js/levels.js', 'js/i18n.js', 'js/main.js', 'index.html', 'README.md', 'CONTRACT.md']){
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/Переделка 2026-11[\s\S]*?(?=\n## )/, '').replace(/\n## Что было узнаваемым[\s\S]*?(?=\n## )/, '');
    ok(!OLD.test(s), f + ': ' + (s.match(OLD) || [])[0]);
  }
});
test('площадка: таблица oskolok, «Без рекламы», промо-список для Консоли', () => { /* проверка ниже */ });
checkPlatformFeatures({ ROOT, slug: 'oskolok', boards: ['oskolok'], test, ok });
test('площадка: rewarded-продолжение, бонус в паузе, adBreak на карточке, g.persist рекорда', () => {
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/g\.useRewardedContinue\(/.test(main) && /g\.useRewardedBonus\(/.test(main) && /g\.adBreak\(\)/.test(main) && /g\.persist\('arcade\.best\.oskolok', 'max'\)/.test(main));
  ok(/menuFit\(/.test(main) && /stick\.js/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
});

if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без графов и бота)'); process.exit(failed ? 1 : 0); }
// ---------- проходимость: граф по настоящей игре ----------
const NAVS = [];
O.LEVELS.forEach((lv, li) => {
  test('проходимость зала ' + (li + 1) + ' «' + lv.key + '»: путь к выходу есть, без осколка — нет, тупиков нет', () => {
    const nav = makeNav(O, li), r = nav.search(nav.start, 20000); ok(r.found, 'выход недостижим');
    const path = nav.pathTo(r, 'G'); const throws = path.filter(s => s.e.frames.some(f => f[0].act)).length; ok(throws >= (li === 0 ? 3 : 4), 'бросков на пути: ' + throws);
    const ns = makeNav(O, li, { noShard: true }); ok(!ns.search(ns.start, 20000).found, 'без осколка зал проходится');
    const bad = []; for (const n of r.seen) if (n !== 'G' && !nav.search(n, 20000).found) bad.push(n % nav.W + ',' + ((n / nav.W) | 0)); ok(!bad.length, 'тупики: ' + bad.join(' '));
    NAVS[li] = { nodes: r.seen.size, throws, steps: path.length };
  });
});
test('исполнение: «точный» бот (без ошибок, без врагов) проходит каждый зал по графу в настоящей игре', () => {
  for (let li = 0; li < 6; li++){ const res = playGame(O, 1, { from: li, calm: true, jit: 0, off: 0.05, single: true, maxLevelT: 120 }); ok(res.cleared >= 1, 'зал ' + (li + 1) + ': ' + JSON.stringify({ at: res.why, stuck: res.stuck })); }
});
const NB = +process.env.NB || 12, BR = []; for (let s = 1; s <= NB; s++) BR.push(playGame(O, s, {}));
test('баланс: «человеческий» бот (реакция 150–250 мс, ошибки таймингов ±3 кадра, ловит часть врагов) проходит 20–45% игры, получает урон', () => {
  const avg = BR.reduce((a, r) => a + r.progress, 0) / NB, why = {}; BR.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  console.log('     партий ' + NB + ', средний прогресс ' + (avg * 100).toFixed(0) + '%, побед ' + BR.filter(r => r.won).length + ', по залам взято: ' + [0, 1, 2, 3, 4, 5].map(i => BR.filter(r => r.cleared > i).length).join('/') + ', урон: ' + JSON.stringify(why) + (NAVS.length ? ', граф: ' + NAVS.map(n => n.nodes + 'у/' + n.throws + 'б').join(' ') : ''));
  ok(avg >= 0.2 && avg <= 0.45, 'прогресс ' + avg.toFixed(2));
  ok(BR.some(r => r.hurts > 0), 'и не пресно: бот получает урон');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
