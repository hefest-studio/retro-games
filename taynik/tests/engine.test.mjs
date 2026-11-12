/* ТАЙНИК · tests/engine.test.mjs — автотесты логики и обвязки (Node, без зависимостей).
   Запуск: node taynik/tests/engine.test.mjs   (FAST=1 — без долгих прогонов ботов)
   Логика (js/game.js) — в node:vm с шимом window. Физика проверяется на маленьких «ручных» картах,
   поведение обитателей и предметов — на настоящей игре с подменённым окружением.
   Бот (tests/bot.mjs): «идеальный» — проходимость каждого уровня самой игрой; «человеческий» — баланс. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/game.js'), sandbox, { filename: 'game.js' });
vm.runInContext(read('js/i18n.js'), sandbox, { filename: 'i18n.js' });
vm.runInContext(read('js/music.js'), sandbox, { filename: 'music.js' });
const K = sandbox.TAYNIK, L = K.logic;
const { playTaynik, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
const FAST = !!process.env.FAST;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, e, m){ if (Math.abs(a - b) > e) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }
const DT = L.DT, T = L.T;

// ---------- ручные карты для физики ----------
// '#' — кладка, '~' — кислота, ' ' — пусто. ropes: [{x, top, bot, kind, exit}]
function mkLv(rows, ropes = []){
  const th = rows.length, tw = rows[0].length, tiles = new Uint8Array(tw * th);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { tiles[y * tw + x] = ch === '#' ? 1 : ch === '~' ? 2 : 0; }));
  return { tw, th, pw: tw * T, ph: th * T, tiles, ropes };
}
function run(lv, h, inp, frames){ const evs = []; for (let i = 0; i < frames; i++){ const e = L.stepHero(lv, h, typeof inp === 'function' ? inp(i) : inp, DT); if (e) evs.push(e); } return evs; }
const FLAT = mkLv([
  '####################',
  '#                  #',
  '#                  #',
  '#                  #',
  '#                  #',
  '#                  #',
  '#                  #',
  '####################'
]);
const FLOOR = 7 * T;

// Игра на уровне level; окружение (обитатели/предметы) — по желанию теста
function arena(level = 1, opts = {}){
  const events = [];
  const game = K.Game(Object.assign({ rng: mulberry32(opts.seed || 1), level, onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S;
  if (!opts.keep){ S.enemies = []; S.items = []; }
  S.banner = 0;
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length };
}
function steps(game, n, inp){ for (let i = 0; i < n; i++){ if (inp) game.setInput(typeof inp === 'function' ? inp(i) : inp); game.step(); } }
// поставить героя на ровный пол мира (в стартовой ячейке)
function heroOnFloor(S){ S.hero = L.newHero(S.lv.start.x, S.lv.start.y); return S.hero; }

// ---------- физика героя ----------
test('ходьба: 80 px/с, стена останавливает', () => {
  const h = L.newHero(100, FLOOR);
  run(FLAT, h, { r: 1 }, 60);
  near(h.x, 180, 1.5, 'за 1 с');
  run(FLAT, h, { r: 1 }, 300);
  near(h.x, 19 * T - L.HALF, 0.01, 'упёрся в стену');
  eq(h.mode, 'ground');
});

test('прыжок с пола: высота ≈ 44 px (выше полки 40 px), длина ≈ 64 px, приземление без урона', () => {
  const h = L.newHero(100, FLOOR);
  const evs = run(FLAT, h, i => i === 0 ? { r: 1, u: 1 } : {}, 80);
  const h3 = L.newHero(100, FLOOR); let top = FLOOR;
  for (let i = 0; i < 60; i++){ L.stepHero(FLAT, h3, i === 0 ? { u: 1 } : {}, DT); top = Math.min(top, h3.y); }
  near(FLOOR - top, 44.5, 1.5, 'высота'); ok(FLOOR - top > 40, 'запрыгивает на полку');
  ok(evs.includes('jump') && evs.includes('land'), 'события прыжка/приземления');
  near(h.x - 100, 64, 4, 'длина');
  eq(h.mode, 'ground'); eq(h.y, FLOOR);
  // повторный прыжок — только новым нажатием ↑
  const h4 = L.newHero(100, FLOOR);
  const e4 = run(FLAT, h4, { u: 1 }, 120);
  eq(e4.filter(e => e === 'jump').length, 1, 'удержание ↑ не прыгает повторно');
});

test('верёвка: хват ↑ с пола, подъём 70 px/с, упор вверху, спуск до пола', () => {
  const R = { x: 200, top: T, bot: FLOOR - 4, kind: 'link' };
  const lv = mkLv(FLAT_ROWS(), [R]);
  const h = L.newHero(200 + 10, FLOOR);
  const e = run(lv, h, { u: 1 }, 1);
  eq(e, ['grab']); eq(h.mode, 'rope'); eq(h.x, 200);
  const y0 = h.y; run(lv, h, { u: 1 }, 30);
  near(y0 - h.y, 35, 1.5, 'полсекунды подъёма');
  run(lv, h, { u: 1 }, 200);
  eq(h.y, L.ropeMinY(R), 'упор в потолок');
  const e2 = run(lv, h, { d: 1 }, 300);
  ok(e2.includes('land'), 'спустился на пол'); eq(h.mode, 'ground'); eq(h.y, FLOOR);
  // далеко от верёвки ↑ — обычный прыжок
  const h2 = L.newHero(200 + 30, FLOOR);
  eq(run(lv, h2, { u: 1 }, 1), ['jump']);
});
function FLAT_ROWS(){ return ['####################', '#                  #', '#                  #', '#                  #', '#                  #', '#                  #', '#                  #', '####################']; }

test('прыжки между верёвками над кислотой и соскок на пол', () => {
  // яма 7 тайлов кислоты, две верёвки над ней
  const lv = mkLv([
    '##############',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '####~~~~~~~###'
  ]);
  const left = 4 * T, top = T, bot = FLOOR - 40;
  lv.ropes = [{ x: left + 47, top, bot, kind: 'pit' }, { x: left + 93, top, bot, kind: 'pit' }];
  // с края — прыжок на первую верёвку
  const h = L.newHero(left - 2, FLOOR);
  let e = run(lv, h, i => i === 0 ? { r: 1, u: 1 } : {}, 60);
  ok(e.includes('grab') && h.mode === 'rope' && h.rope === 0, 'поймал первую: ' + e.join(','));
  // удержание → не прыгает; новое нажатие → летит на вторую
  e = run(lv, h, { r: 1 }, 1);
  eq(h.mode, 'air', 'нажатие → прыжок с верёвки');
  e = run(lv, h, {}, 60);
  ok(h.mode === 'rope' && h.rope === 1, 'поймал вторую');
  e = run(lv, h, { r: 1 }, 20);
  ok(h.mode !== 'rope', 'спрыгнул');
  e = e.concat(run(lv, h, {}, 80));
  eq(h.mode, 'ground'); ok(!e.includes('acid'), 'перелетел кислоту'); ok(h.x > left + 7 * T, 'на правом берегу');
  // соскок вниз с верёвки над кислотой (↓ внизу) — гибель
  const h2 = L.newHero(left - 2, FLOOR);
  run(lv, h2, i => i === 0 ? { r: 1, u: 1 } : {}, 60);
  run(lv, h2, { d: 1 }, 120);
  eq(h2.mode, 'rope', 'держа ↓ внизу — висит');
  const e3 = run(lv, h2, i => i % 2 ? { d: 1 } : {}, 120);
  ok(e3.includes('acid'), 'новое ↓ внизу — отпустил и упал в кислоту');
});

test('люк: ↓ у края хватает верёвку, подъём и соскок на верхний пол', () => {
  const lv = mkLv([
    '##############',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '#####  #######',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '#            #',
    '##############'
  ]);
  const R = { x: 6 * T, top: T, bot: 14 * T - 4, kind: 'link' };
  lv.ropes = [R];
  const h = L.newHero(5 * T + 4, FLOOR);   // на краю люка (ещё стоит на полу)
  eq(run(lv, h, { d: 1 }, 1), ['grab']);
  run(lv, h, { d: 1 }, 400);
  eq(h.mode, 'ground', 'удержание ↓ внизу не хватает верёвку снова'); eq(h.y, 14 * T, 'внизу');
  run(lv, h, { u: 1 }, 1); eq(h.mode, 'rope');
  run(lv, h, { u: 1 }, 400);
  // спустимся до уровня верхнего пола и соскочим вправо
  while (h.y < FLOOR) L.stepHero(lv, h, { d: 1 }, DT);
  const e = run(lv, h, i => i === 0 ? { r: 1 } : {}, 60);
  eq(h.mode, 'ground'); eq(h.y, FLOOR, 'на верхнем полу'); ok(h.x > 7 * T, 'справа от люка: ' + h.x);
  ok(!e.includes('hurt'));
});

test('кислота: шаг на неё — гибель; падение > 100 px — урон 30, > 230 — 60', () => {
  const lv = mkLv(['##########', '#        #', '#        #', '####~~####']);
  const h = L.newHero(3 * T, 3 * T);
  ok(run(lv, h, { r: 1 }, 60).includes('acid'));
  const tall = mkLv(['#####', ...Array(16).fill('#   #'), '#####']);
  const h1 = L.newHero(50, 17 * T - 110); h1.mode = 'air'; h1.fallY = h1.y;
  const e1 = run(tall, h1, {}, 120); ok(e1.includes('hurt')); eq(h1.dmg, 30);
  const h2 = L.newHero(50, 17 * T - 250); h2.mode = 'air'; h2.fallY = h2.y;
  run(tall, h2, {}, 200); eq(h2.dmg, 60);
  const h3 = L.newHero(50, 17 * T - 90); h3.mode = 'air'; h3.fallY = h3.y;
  ok(!run(tall, h3, {}, 120).includes('hurt'), '90 px — без урона');
});

// ---------- скролл ----------
test('скролл: камера плавно следует за героем по x и y и упирается в края мира', () => {
  const { game, S } = arena(4);
  const lv = S.lv;
  // стоять героя ставим в устойчивые точки графа достижимости, ближайшие к заданной
  const nodes = [...lv.plan.nodes.values()].filter(n => n.h.mode === 'ground').map(n => n.h);
  const at = (x, y) => { let b = null, bd = 1e18; for (const h of nodes){ const d = (h.x - x) ** 2 + (h.y - y) ** 2; if (d < bd){ bd = d; b = h; } } S.hero = L.cloneHero(b); return S.hero; };
  S.cam.x = 0; S.cam.y = 0;
  let h = at(lv.pw, lv.ph);
  steps(game, 1, {});
  ok(S.cam.x > 0 && S.cam.x < lv.pw - L.VW, 'плавно, не рывком: ' + S.cam.x);
  steps(game, 180, {});
  near(S.cam.x, lv.pw - L.VW, 1, 'упор справа'); near(S.cam.y, lv.ph - L.VH, 1, 'упор снизу');
  h = at(lv.pw / 2, lv.ph / 2);
  steps(game, 240, {});
  near(S.cam.x, h.x + h.face * 30 - L.VW / 2, 2, 'центр по x'); near(S.cam.y, h.y - 10 - L.VH / 2, 2, 'центр по y');
  ok(Math.abs(h.x - lv.pw / 2) < lv.pw / 4 && Math.abs(h.y - lv.ph / 2) < lv.ph / 3, 'точка в середине мира');
  h = at(0, 0);
  steps(game, 240, {});
  near(S.cam.x, 0, 0.5, 'упор слева'); near(S.cam.y, 0, 0.5, 'упор сверху');
});

// ---------- стрельба и заряды ----------
test('стрельба: заряд −1, пауза между выстрелами, «пусто» при 0, ящик +4 (≤15)', () => {
  const { game, S, events, count } = arena(1);
  heroOnFloor(S); S.ammo = 2;
  game.fire(); steps(game, 1, {});
  eq(S.ammo, 1); eq(S.bullets.length, 1); eq(count('shot'), 1);
  game.fire(); steps(game, 1, {});
  eq(S.ammo, 1, 'кулдаун ' + L.FIRE_CD + ' с');
  steps(game, 20, {}); game.fire(); steps(game, 1, {}); eq(S.ammo, 0);
  steps(game, 20, {}); game.fire(); steps(game, 1, {});
  eq(S.ammo, 0); ok(events.some(e => e[0] === 'empty'), 'событие «пусто»');
  S.items = [{ type: 'crate', x: S.hero.x, y: S.hero.y }];
  steps(game, 1, {}); eq(S.ammo, L.CRATE);
  S.ammo = 13; S.items = [{ type: 'crate', x: S.hero.x, y: S.hero.y }];
  steps(game, 1, {}); eq(S.ammo, L.AMMO_MAX, 'не больше максимума');
});

test('пуля: летит по взгляду, гаснет в стене и на дальности, убивает паука (+100)', () => {
  const { game, S, events } = arena(1);
  const h = heroOnFloor(S); S.ammo = 5;
  const c = L.cellOf(S.lv, h.x, h.y), wallX = (c.i * L.CX) * T;
  h.face = -1; game.fire(); steps(game, 1, {});
  const b = S.bullets[0]; ok(b.vx < 0, 'влево');
  steps(game, 90, {});
  eq(S.bullets.length, 0, 'погасла');
  ok(events.some(e => e[0] === 'spark' && e[1].x >= wallX - 1 || e[0] === 'spark' && Math.abs(e[1].x - h.x) >= L.BULLET_R - 10), 'в стене или на дальности');
  // паук на линии огня
  S.enemies = [{ type: 'spider', x: h.x + 60, y: h.y - 11, top: h.y - 100, lo: h.y - 11, hi: h.y - 11, per: 3, ph: 0, hp: 1, alive: true }];
  h.face = 1; steps(game, 20, {}); const sc = S.score;
  game.fire(); steps(game, 20, {});
  ok(!S.enemies[0].alive, 'паук сбит'); eq(S.score - sc, L.PTS.spider); eq(S.kills, 1);
});

// ---------- обитатели ----------
test('паук: качается на нити между lo и hi, касание — урон 20', () => {
  const { game, S, events } = arena(1);
  const h = heroOnFloor(S);
  const e = { type: 'spider', x: h.x + 120, y: 0, top: h.y - 140, lo: h.y - 126, hi: h.y - 22, per: 3, ph: 0, hp: 1, alive: true };
  S.enemies = [e];
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < 200; i++){ steps(game, 1, {}); lo = Math.min(lo, e.y); hi = Math.max(hi, e.y); }
  near(lo, e.lo, 1); near(hi, e.hi, 1);
  e.x = h.x; e.ph = -S.time + e.per / 2;   // внизу — на уровне головы
  steps(game, 2, {});
  ok(events.some(x => x[0] === 'hurt' && x[1].src === 'spider'), 'урон'); eq(S.energy, L.ENERGY - L.DMG.spider);
});

test('искра: летает внутри ячейки и отскакивает от её границ', () => {
  const { game, S } = arena(1);
  const h = heroOnFloor(S); h.x = 30;
  const e = { type: 'spark', x: 300, y: 100, vx: 90, vy: 70, rx0: 250, rx1: 350, ry0: 50, ry1: 150, hp: 1, alive: true };
  S.enemies = [e];
  let out = false, flips = 0, pv = e.vx;
  for (let i = 0; i < 600; i++){ steps(game, 1, {}); if (e.x < 250 || e.x > 350 || e.y < 50 || e.y > 150) out = true; if (Math.sign(e.vx) !== Math.sign(pv)) flips++; pv = e.vx; }
  ok(!out, 'в границах'); ok(flips >= 4, 'отскоки: ' + flips);
});

test('капля кислоты: набухает → падает → брызги; опасна только в падении', () => {
  const e = { type: 'drop', x: 100, top: 20, floorY: 160, per: 2, ph: 0, alive: true };
  eq(L.dropAt(e, 0.1).stage, 'grow'); ok(!L.enemyBox(e, 0.1), 'набухание безопасно');
  const f = L.dropAt(e, 0.9); eq(f.stage, 'fall'); ok(f.y > 20 && f.y < 160); ok(L.enemyBox(e, 0.9));
  let splash = false; for (let t = 0.7; t < 2; t += 0.01){ const d = L.dropAt(e, t); if (d && d.stage === 'splash'){ splash = true; ok(!L.enemyBox(e, t)); } }
  ok(splash, 'брызги');
  eq(L.dropAt(e, 1.95), null, 'пауза до следующей');
  // периодичность
  eq(L.dropAt(e, 0.9).y, L.dropAt(e, 2.9).y);
});

test('призрак пара: летит к герою сквозь стены, после касания отступает; 2 попадания', () => {
  const { game, S, events } = arena(1);
  const h = heroOnFloor(S);
  const c = L.cellOf(S.lv, h.x, h.y);
  // за стеной слева/справа от ячейки героя
  const gx = (c.i * L.CX + (c.i > 0 ? -3 : L.CX + 3)) * T;
  const e = { type: 'ghost', x: gx, y: h.y - 9, hx: gx, hy: h.y - 9, v: 40, cool: 0, hp: 2, alive: true };
  S.enemies = [e];
  ok(L.tileAt(S.lv, Math.floor((c.i > 0 ? c.i * L.CX : (c.i + 1) * L.CX) ), Math.floor((h.y - 30) / T)) === 1, 'между ними кладка');
  const d0 = Math.abs(e.x - h.x);
  steps(game, 60, {});
  ok(Math.abs(e.x - h.x) < d0 - 30, 'приблизился сквозь стену');
  steps(game, 400, {});
  ok(events.some(x => x[0] === 'hurt' && x[1].src === 'ghost'), 'коснулся');
  ok(e.cool > 0, 'отступает'); const d1 = Math.hypot(e.x - h.x, e.y - h.y + 9); steps(game, 30, {}); ok(Math.hypot(e.x - h.x, e.y - h.y + 9) > d1, 'удаляется');
  // 2 попадания
  e.cool = 0; e.x = h.x + 70; e.y = h.y - 11; e.v = 0; h.face = 1; S.ammo = 5; S.inv = 0;
  game.fire(); steps(game, 16, {}); ok(e.alive, 'одно попадание — жив'); eq(e.hp, 1);
  e.x = h.x + 70; e.y = h.y - 11; e.cool = 0;
  game.fire(); steps(game, 16, {}); ok(!e.alive, 'второе — рассеян');
});

test('хамелеон: невидим и неуязвим, пока далеко; рядом — проявляется и ползёт по полу в своих границах', () => {
  const { game, S, events } = arena(1);
  const h = heroOnFloor(S);
  const e = { type: 'cham', x: h.x + 150, y: h.y, minX: h.x - 200, maxX: h.x + 150, v: 55, shown: false, cool: 0, face: 1, hp: 2, alive: true };
  S.enemies = [e];
  steps(game, 30, {});
  ok(!e.shown, 'далеко — скрыт'); eq(e.x, h.x + 150, 'стоит');
  h.face = 1; S.ammo = 3; game.fire(); steps(game, 40, {});
  eq(e.hp, 2, 'пуля проходит сквозь скрытого');
  e.x = h.x + 80; steps(game, 1, {});
  ok(e.shown && events.some(x => x[0] === 'reveal'), 'проявился');
  const x0 = e.x; steps(game, 20, {}); ok(e.x < x0, 'ползёт к герою');
  steps(game, 200, {}); ok(events.some(x => x[0] === 'hurt' && x[1].src === 'cham'), 'укусил');
  for (let i = 0; i < 300; i++){ steps(game, 1, {}); ok(e.x >= e.minX && e.x <= e.maxX, 'в границах'); }
});

// ---------- энергия, жизни, чекпойнты ----------
test('энергия: урон, неуязвимость 1,2 с, масло +35 (≤100), 0 — потеря жизни и возрождение у фонаря', () => {
  const { game, S, events } = arena(1);
  const h = heroOnFloor(S);
  game._damage(20, 'spark'); eq(S.energy, 80);
  game._damage(20, 'spark'); eq(S.energy, 80, 'неуязвим');
  steps(game, Math.ceil(L.INV_T / DT) + 1, {});
  game._damage(20, 'spark'); eq(S.energy, 60);
  S.items = [{ type: 'oil', x: h.x, y: h.y }]; steps(game, 1, {}); eq(S.energy, 95);
  S.items = [{ type: 'oil', x: h.x, y: h.y }]; steps(game, 1, {}); eq(S.energy, 100, 'не больше 100');
  // фонарь — чекпойнт
  const lamp = { type: 'lamp', x: h.x + 2, y: h.y }; S.items = [lamp]; steps(game, 1, {});
  ok(lamp.lit && events.some(x => x[0] === 'lamp')); eq(S.checkpoint.x, lamp.x);
  h.x += 40; S.inv = 0;
  for (let i = 0; i < 6; i++){ S.inv = 0; game._damage(20, 'cham'); }
  eq(S.phase, 'dead'); eq(S.lives, 2); ok(events.some(x => x[0] === 'die' && x[1].reason === 'energy'));
  steps(game, Math.ceil(L.DEAD_T / DT) + 2, {});
  eq(S.phase, 'play'); eq(S.energy, 100); eq(S.hero.x, lamp.x, 'у фонаря'); ok(S.inv > 0, 'защита после возрождения');
});

test('жизни: 3 на старте, последняя потеря — конец игры', () => {
  const { game, S, events } = arena(1);
  eq(S.lives, 3);
  for (let k = 0; k < 3; k++){ game._die('acid'); steps(game, Math.ceil(L.DEAD_T / DT) + 2, {}); }
  eq(S.phase, 'over'); ok(S.over); ok(events.some(e => e[0] === 'gameover'));
});

// ---------- карты-подсказки ----------
test('карта-подсказка: на 1,6 с показывает кусок лабиринта и путь от ячейки героя к люку', () => {
  const { game, S, events } = arena(3);
  const h = heroOnFloor(S);
  S.items = [{ type: 'map', x: h.x, y: h.y }];
  steps(game, 1, {});
  ok(S.hint && events.some(e => e[0] === 'map'));
  near(S.hint.t, L.HINT_T, 0.05);
  const c = L.cellOf(S.lv, h.x, h.y), p = S.hint.path;
  eq(p[0], [c.i, c.j], 'от героя'); eq(p[p.length - 1], [S.lv.exitCell.i, S.lv.exitCell.j], 'до люка');
  for (let k = 1; k < p.length; k++){
    const a = L.cellAt(S.lv, p[k - 1][0], p[k - 1][1]), b = L.cellAt(S.lv, p[k][0], p[k][1]);
    ok(L.neighbors(S.lv, a).includes(b), 'соседние через проход');
  }
  steps(game, Math.ceil(L.HINT_T / DT) + 1, {});
  eq(S.hint, null, 'исчезла');
});

// ---------- выход и переход ----------
test('люк: подъём по верёвке выхода — бонус, через паузу следующий ярус; после 6-го — победа', () => {
  const { game, S, events } = arena(1);
  const ex = S.lv.ropes.find(R => R.exit);
  ok(ex && ex.top === 0, 'верёвка из люка в потолке');
  S.hero = L.newHero(ex.x, ex.bot + 10); S.hero.mode = 'rope'; S.hero.rope = S.lv.ropes.indexOf(ex); S.hero.y = L.ropeMinY(ex) + 30;
  const sc = S.score, lv1 = S.lv;
  steps(game, 60, { u: 1 });
  eq(S.phase, 'clear'); ok(events.some(e => e[0] === 'clear')); ok(S.score - sc >= L.PTS.exit, 'бонус');
  steps(game, Math.ceil(L.CLEAR_T / DT) + 1, {});
  eq(S.level, 2); ok(S.lv !== lv1 && S.phase === 'play'); eq(S.energy, L.ENERGY);
  ok(S.lv.cols * S.lv.rows > lv1.cols * lv1.rows, 'лабиринт больше');
  // последний ярус → победа
  const w = arena(6); const ex6 = w.S.lv.ropes.find(R => R.exit);
  w.S.hero = L.newHero(ex6.x, 100); w.S.hero.mode = 'rope'; w.S.hero.rope = w.S.lv.ropes.indexOf(ex6); w.S.hero.y = L.ropeMinY(ex6) + 10;
  steps(w.game, 30, { u: 1 }); steps(w.game, Math.ceil(L.CLEAR_T / DT) + 2, {});
  ok(w.S.won && w.has('win'), 'победа');
});

// ---------- генерация и достижимость ----------
test('генерация: 6 уровней растут; люк вверху, старт внизу; кислота с верёвками; обитатели по уровням', () => {
  let prev = 0;
  for (let n = 1; n <= 6; n++){
    const lv = L.makeLevel(n, mulberry32(100 + n)), cfg = L.LEVELS[n - 1];
    ok(lv.cols * lv.rows > prev, 'растёт'); prev = lv.cols * lv.rows;
    eq(lv.exitCell.j, 0, 'люк в верхнем ряду'); eq(lv.startCell.j, lv.rows - 1, 'старт внизу');
    const pits = lv.ropes.filter(R => R.kind === 'pit').length, acidCells = lv.cells.filter(c => c.acid).length;
    ok(acidCells >= 1 && pits >= acidCells, 'ямы с верёвками: ' + acidCells + '/' + pits);
    const types = t => lv.enemies.filter(e => e.type === t).length;
    ok(types('spider') >= 1);
    if (cfg.ghost) ok(types('ghost') > 0, 'призраки с 3-го'); else eq(types('ghost'), 0);
    if (cfg.cham) ok(types('cham') > 0, 'хамелеоны с 4-го'); else eq(types('cham'), 0);
    if (cfg.drop) ok(types('drop') > 0, 'капли со 2-го'); else eq(types('drop'), 0);
    ok(lv.items.filter(i => i.type === 'map').length >= 1, 'карты');
  }
});

test('достижимость: на каждом уровне (8 сидов × 6) люк достижим по физике игры; предметы — в достижимых местах', () => {
  for (let s = 1; s <= 8; s++) for (let n = 1; n <= 6; n++){
    const lv = L.makeLevel(n, mulberry32(s * 977 + n));
    ok(lv.plan.exitReachable, 'уровень ' + n + ' сид ' + s);
    const keys = new Set(); lv.plan.nodes.forEach(nd => keys.add(nd.key));
    for (const it of lv.items){ const h = L.newHero(it.x, it.y); ok(keys.has(L.heroKey(h)), 'предмет ' + it.type + ' достижим'); }
    const d = L.distToExit(lv.plan);
    ok(d.has(L.heroKey(L.newHero(lv.start.x, lv.start.y))), 'от старта есть путь до люка');
  }
});

test('проходимость самой игрой: «идеальный» бот проходит каждый уровень (5 сидов × 6)', () => {
  for (let s = 1; s <= 5; s++) for (let n = 1; n <= 6; n++){
    const r = playTaynik(K, s * 31 + n, { perfect: true, startLevel: n, levels: 1, lives: 3 });
    ok(r.won && !r.stuck, 'уровень ' + n + ' сид ' + s + ': ' + JSON.stringify({ passed: r.passed, deaths: r.deaths, stuck: r.stuck }));
  }
});

// ---------- строки, музыка, страница ----------
test('i18n: ключи RU/EN совпадают; есть названия ярусов, причины потери, подсказки', () => {
  const ru = Object.keys(K.STR.ru).sort(), en = Object.keys(K.STR.en).sort();
  eq(ru, en);
  for (let n = 1; n <= 6; n++) ok(K.STR.ru['lv_' + n] && K.STR.en['lv_' + n]);
  ['d_acid', 'd_energy', 'hint', 'foot', 'hintmap', 'play', 'resume', 'pause'].forEach(k => ok(K.STR.ru[k] && K.STR.en[k], k));
});

test('музыка: оригинальный трек taynik разбирается секвенсором движка', () => {
  const sb = { console, Math, performance: { now: () => 0 } }; sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read('engine.js'), sb); vm.runInContext(read('js/music.js'), sb);
  const tr = sb.Arcade.parseTrack(sb.Arcade.tracks.taynik);
  ok(tr.steps > 0); eq(tr.melody.length, 64); eq(tr.bass.length, 32);
});

test('страница: engine.js = _shared, фавикон, «← Каталог», тач-кнопки, порядок скриптов', () => {
  const html = read('index.html');
  eq(read('engine.js'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js');
  const roy = fs.readFileSync(path.join(ROOT, '..', 'roy', 'index.html'), 'utf8').match(/<link rel="icon"[^>]*>/)[0];
  ok(html.includes(roy), 'фавикон студии как в roy');
  ok(/data-catalog-back/.test(html) && /href="\.\.\/"/.test(html), 'ссылка в каталог');
  ['U', 'D', 'L', 'R', 'A'].forEach(d => ok(html.includes('data-d="' + d + '"'), 'кнопка ' + d));
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/ui.js', 'js/modern.js', 'js/classic.js', 'js/main.js']);
});

test('Правило имён: в файлах игры нет чужих названий игр, компаний и персонажей', () => {
  // список чужих имён (в т.ч. ранние «гробничные» лабиринты и их герои) — в base64, чтобы сами имена не попадали в репозиторий открытым текстом
  const BAD = new RegExp(Buffer.from('XGJrb25hbWlcYnzQutC+0L3QsNC80Lh8XGJzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfG5pbnRlbmRvfNC90LjQvdGC0LXQvdC00L58bmFtY2980L3QsNC80LrQvnx0YWl0b3zRgtCw0LnRgtC+fGNhcGNvbXzQutCw0L/QutC+0Lx8dGVjbW98YWN0aXZpc2lvbnxhdGFyaXzQsNGC0LDRgNC4fHBhYy0/bWFufNC/0LDQutC80LDQvXx0ZXRyaXN80YLQtdGC0YDQuNGBfGdhbGFnfGdhbGF4fHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxkaWdnZXJ8cml2ZXIgP3JhaWR8XGJjb250cmFcYnzQutC+0L3RgtGA0LAoPyFb0LAt0Y/RkV0pfGRpenp5fGNoaXAgPyc/bic/ID9kYWxlfGRlZXBzZWVrfG1hcmlvfNC80LDRgNC40L58c29uaWN80YHQvtC90LjQunxtb250ZXp1bXzQvNC+0L3RgtC10LfRg9C8fNC80L7QvdGC0LXRgdGD0Lx8cGFuYW1hID9qb2V80L/QsNC90LDQvNCwID/QtNC20L58cGl0ZmFsbHzQv9C40YLRhNC+0Lt80L/QuNGC0YTQsNC7fHNwZWx1bmt80YHQv9C10LvRg9C90Lp8dHV0YW5raHzRgtGD0YLQsNC90YV8cGhhcmFvfNGE0LDRgNCw0L7QvXxweXJhbWlkfNC/0LjRgNCw0LzQuNC0fFxibXVtbXzQvNGD0LzQuNGPfNC80YPQvNC40Lh80LzRg9C80LjQuXx0b21iID9yYWlkZXJ8bGFyYSA/Y3JvZnR80LrRgNC+0YTRgnxpbmRpYW5hID9qb25lc3zQuNC90LTQuNCw0L3QsCA/0LTQttC+0L3RgXxyaWNrID9kYW5nZXJvdXN8cHJpbmNlID9vZiA/cGVyc2lhfNC/0YDQuNC90YYgP9C/0LXRgNGB0LjQuHxtb3VudGFpbiA/a2luZ3xhenRlY3zQsNGG0YLQtdC6fHNhYnJlID93dWxmfGpldCA/c2V0ID93aWxseXxtYW5pYyA/bWluZXI=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && !f.endsWith('engine.test.mjs') && /\.(js|mjs|html|css|md)$/.test(f));
  ok(files.length >= 13, 'файлов проверено: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
});

// ---------- баланс (бот) ----------
test('«человеческий» бот (реакция 150–250 мс, ошибки руки): уровень 1 ≥ 90 %, вся игра ~20–40 % (40 партий)', () => {
  if (FAST) return;
  const N = 40; let l1 = 0, won = 0, stuck = 0;
  for (let s = 1; s <= N; s++){ const r = playTaynik(K, s); if (r.passed >= 1) l1++; if (r.won) won++; if (r.stuck) stuck++; }
  console.log(`     уровень 1: ${(100 * l1 / N).toFixed(0)} %, вся игра: ${(100 * won / N).toFixed(0)} %, зависаний: ${stuck}`);
  ok(l1 / N >= 0.9, 'уровень 1: ' + l1 / N);
  ok(won / N >= 0.15 && won / N <= 0.45, 'вся игра: ' + won / N);
  eq(stuck, 0, 'бот не зависает');
});

console.log(`\n${passed} ok, ${failed} fail`);
process.exit(failed ? 1 : 0);
