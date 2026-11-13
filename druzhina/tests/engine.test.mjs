/* ДРУЖИНА · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node druzhina/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: герои и их комбо, бег и удар в беге, удар в прыжке, захват/колено/бросок, «спина», щит,
   магия кувшинов (уровни 1–4), бесы и предметы, ездовые ящеры (выбить/оседлать/атака/спешиться),
   волны и камера («ВПЕРЁД»), боссы (фазы, волна по земле, лужи), привал, жизни и продолжения, кооп,
   i18n, музыка, страница, правило имён; проходимость и баланс — «человеческим» ботом. */
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
const D = sandbox.DRUZHINA, L = D.logic;
const { playDruzhina, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Песочница: arena — без волн и камеры; герой в x=400, z=90
function setup(o = {}){
  const events = [];
  const game = D.Game(Object.assign({ rng: mulberry32(o.seed || 1), arena: true, heroes: ['zhdan'], onEvent: (t, d) => events.push([t, d]) }, o)).start();
  const S = game.state(); S.banner = 0; S.foes = []; S.mounts = [];
  S.heroes.forEach((h, i) => { h.x = 400 + i * 200; h.z = 90; h.inv = 0; });
  return { game, S, h: S.heroes[0], events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
// враг-«манекен»: стоит на месте (скорость 0) и не бьёт (cd), но блокирует/падает/держит удары как обычно
function foe(game, type, x, z, o){
  const f = game._spawn(type, x, z, o); f.cd = 99; f.remountT = 99; f.entered = true;
  f.def = Object.assign({}, f.def, { speed: 0, zs: 0 }); if (f.mount) f.mount.def = Object.assign({}, f.mount.def, { speed: 0, zs: 0 });
  return f;
}

// ---------- Данные ----------
test('герои: трое с разными статами; комбо — 3/4/3 удара, последний сбивает; у каждого своя магия на 4 уровня', () => {
  eq(L.HERO_KEYS, ['zhdan', 'secha', 'olha']);
  const H = L.HEROES;
  ok(H.zhdan.hp > H.secha.hp && H.secha.hp > H.olha.hp, 'здоровье'); ok(H.secha.speed > H.olha.speed && H.olha.speed > H.zhdan.speed, 'скорость');
  eq([H.zhdan.combo.length, H.secha.combo.length, H.olha.combo.length], [3, 4, 3]);
  L.HERO_KEYS.forEach(k => { const c = H[k].combo; ok(c[c.length - 1].kd && !c[0].kd, 'сбивает последний: ' + k); eq(H[k].magic.costs.length, 4); eq(H[k].magic.dmg.length, 4); ok(H[k].back.cost > 0); });
  ok(H.olha.ranged && H.olha.range > 250, 'лучница — средняя дистанция');
  eq(new Set(L.HERO_KEYS.map(k => H[k].magic.kind)).size, 3, 'магия у всех своя');
});
test('этапы: 6 штук (тракт…литейня), у каждого 4–5 волн, свой босс; есть все враги, оба зверя и бесы; привал после 1, 3, 5', () => {
  eq(L.STAGES.map(s => s.key), ['trakt', 'village', 'forest', 'crossing', 'walls', 'foundry']);
  const types = new Set(), mounts = new Set();
  L.STAGES.forEach((st, i) => {
    ok(st.waves.length >= 4 && st.waves.length <= 5, 'волн ' + st.key); ok(L.BOSSES[st.boss], 'босс ' + st.key);
    let imps = 0; st.waves.forEach(w => L.parseWave(w[1]).forEach(e => { if (e.imp) imps++; else { types.add(e.type); if (e.mount) mounts.add(e.mount); } }));
    ok(imps >= 1, 'бесы на этапе ' + st.key);
    for (let k = 1; k < st.waves.length; k++) ok(st.waves[k][0] > st.waves[k - 1][0], 'порядок волн');
    ok(st.waves[st.waves.length - 1][0] < st.len - L.VIEW_W, 'арена босса после волн');
  });
  eq([...types].sort(), ['brute', 'raider', 'shield', 'spear']); eq([...mounts].sort(), ['fire', 'tail']);
  eq(new Set(L.STAGES.map(s => s.boss)).size, 6, 'боссы разные'); eq(Object.keys(L.BONUS_AFTER).map(Number), [1, 3, 5]);
});

// ---------- Движение и удары ----------
test('ходьба по полосе: x и глубина z, края полосы и экрана держат; двойное нажатие — бег быстрее', () => {
  const { game, h } = setup();
  game.setDir(0, 0, -1); run(game, 3); eq(h.z, 0, 'дальний край'); game.setDir(0, 0, 1); run(game, 4); eq(h.z, L.DEPTH, 'ближний край');
  game.setDir(0, -1, 0); run(game, 5); eq(h.x, 22, 'левый край экрана');
  const x0 = h.x; game.setDir(0, 1, 0); run(game, 0.5); const walk = h.x - x0;
  game.setDir(0, 0, 0); game.update(1 / 60); game.setDir(0, 1, 0); game.update(1 / 60); game.setDir(0, 0, 0); game.update(1 / 60); game.setDir(0, 1, 0);
  ok(h.running, 'бег'); const x1 = h.x; run(game, 0.5); ok(h.x - x1 > walk * 1.5, 'бег быстрее: ' + (h.x - x1).toFixed(0) + ' против ' + walk.toFixed(0));
  game.setDir(0, 0, 0); game.update(1 / 60); ok(!h.running, 'отпустил — шаг');
});
test('комбо: Ждан — 3 удара, Сеча — 4; последний удар сбивает с ног', () => {
  for (const [k, n] of [['zhdan', 3], ['secha', 4], ['olha', 3]]){
    const { game, h, count } = setup({ heroes: [k] }), f = foe(game, 'spear', 445, 90); f.hp = f.max = 999;
    for (let i = 0; i < n; i++){ game.attack(0); run(game, k === 'secha' ? 0.2 : 0.3); }
    run(game, 0.35);
    eq(count('hit'), n, 'попаданий ' + k); eq(f.state, 'down', 'сбит ' + k); ok(h.combo === 0, 'комбо сброшено');
  }
});
test('лучница: враг далеко на одной линии — стрела (летит и бьёт), вплотную — посох', () => {
  const { game, S, count, has } = setup({ heroes: ['olha'] }), f = foe(game, 'spear', 700, 92); f.hp = f.max = 999;
  game.attack(0); run(game, 0.15); ok(has('arrow') && S.projs.length === 1, 'стрела'); run(game, 0.6); eq(count('hit'), 1, 'стрела попала'); eq(S.projs.length, 0);
  f.x = 450; f.z = 90; run(game, 0.6); game.attack(0); run(game, 0.3); ok(!S.projs.length && count('hit') === 2, 'вплотную — посох');
});
test('удар в прыжке и в беге — сбивают и щитом не блокируются', () => {
  const a = setup(), f = foe(a.game, 'shield', 450, 90); f.face = -1; f.def = Object.assign({}, f.def, { block: 1 });
  a.game.jump(0); run(a.game, 0.1); a.game.attack(0); run(a.game, 0.6); eq(a.count('block'), 0); eq(f.state, 'down', 'прыжок');
  const b = setup(), g = foe(b.game, 'shield', 560, 90); g.face = -1; g.def = Object.assign({}, g.def, { block: 1 });
  b.game.setDir(0, 1, 0); b.game.update(1 / 60); b.game.setDir(0, 0, 0); b.game.update(1 / 60); b.game.setDir(0, 1, 0); b.game.update(1 / 60);
  ok(b.h.running); run(b.game, 0.15); b.game.attack(0); eq(b.h.move.name, 'dash'); run(b.game, 0.6); eq(b.count('block'), 0); eq(g.state, 'down', 'бег');
});
test('щитоносец держит удары в лоб (блок без урона); со спины (И2 сзади) и оглушённый — получает', () => {
  const { game, S, count } = setup({ players: 2, heroes: ['zhdan', 'secha'] }), f = foe(game, 'shield', 455, 90); f.def = Object.assign({}, f.def, { block: 1 });
  const [a, b] = S.heroes; b.x = 510; b.z = 90; b.face = -1;
  const hp = f.hp; game.attack(0); run(game, 0.35); eq(count('block'), 1); eq(f.hp, hp, 'урона нет');
  ok(f.face === -1, 'смотрит на И1'); game.attack(1); run(game, 0.2); ok(f.hp < hp, 'со спины прошло');
  const hp2 = f.hp; f.state = 'hurt'; f.st = 0; f.hurtT = 1; game.attack(0); run(game, 0.35); ok(f.hp < hp2, 'оглушённый не блокирует');
});
test('захват: вплотную — захват; удар — колено, третий — бросок; брошенный сбивает соседа; громилу не схватить', () => {
  const { game, h, has, count } = setup(), f = foe(game, 'raider', 445, 90), g2 = foe(game, 'raider', 520, 90);
  f.hp = f.max = 200; g2.hp = g2.max = 200; g2.def = Object.assign({}, g2.def); g2.x = 520;
  game.setDir(0, 1, 0); run(game, 0.3); game.setDir(0, 0, 0);
  ok(has('grab') && h.state === 'grab' && f.state === 'grabbed', 'захват');
  const hp0 = f.hp; game.attack(0); game.update(1 / 60); eq(f.hp, hp0 - L.HEROES.zhdan.knee, 'колено');
  game.attack(0); game.update(1 / 60); game.attack(0); game.update(1 / 60); ok(has('toss') && f.state === 'thrown', 'бросок');
  run(game, 0.8); ok(f.hp <= hp0 - L.HEROES.zhdan.knee * 2 - L.HEROES.zhdan.toss, 'урон броска'); eq(g2.state === 'down' || g2.state === 'rise', true, 'сосед сбит');
  const b = setup(), br = foe(b.game, 'brute', 445, 90); b.game.setDir(0, 1, 0); run(b.game, 0.5); ok(!b.has('grab') && br.state !== 'grabbed', 'громила');
  const c = setup(), q = foe(c.game, 'raider', 445, 90); q.hp = 200; c.game.setDir(0, 1, 0); run(c.game, 0.3); c.game.setDir(0, -1, 0); c.game.attack(0); eq(q.state, 'thrown'); ok(q.vx < 0, 'от врага — бросок назад');
});
test('«спина»: бьёт по обе стороны, сбивает, стоит немного здоровья (не ниже 1)', () => {
  const { game, h, has } = setup(), a = foe(game, 'spear', 350, 90), b = foe(game, 'spear', 450, 90);
  game.special(0); ok(has('back')); eq(h.hp, h.max - L.HEROES.zhdan.back.cost); run(game, 0.4); eq([a.state, b.state], ['down', 'down']);
  run(game, 1); h.hp = 2; game.special(0); eq(h.hp, 1, 'не ниже 1');
  // прыжок и удар одновременно — тоже «спина»
  const c = setup(); c.game.jump(0); c.game.attack(0); ok(c.has('back'), 'прыжок+удар');
});

// ---------- Магия, бесы, предметы ----------
test('магия: без кувшинов — нет; уровень по числу кувшинов (тратит порог), бьёт всех на экране, сила растёт с уровнем', () => {
  const { game, h, has, last } = setup(); const fs3 = [foe(game, 'spear', 600, 40), foe(game, 'brute', 800, 150), foe(game, 'raider', 200, 90)];
  fs3.forEach(f => { f.hp = f.max = 500; });
  eq(game.magic(0), false); ok(has('noMagic'));
  h.jugs = 5; eq(game.magic(0), 2); eq(h.jugs, 1); eq(last('magic').level, 2); eq(h.state, 'cast');
  run(game, 0.9); fs3.forEach(f => eq(f.hp, 500 - L.HEROES.zhdan.magic.dmg[1], 'урон ' + f.type)); ok(fs3.every(f => f.state === 'down'));
  const b = setup({ heroes: ['secha'] }); b.h.jugs = 9; eq(b.game.magic(0), 4); eq(b.h.jugs, 5, 'Сеча: 4 кувшина на 4-й уровень');
  const c = setup({ heroes: ['olha'] }); c.h.jugs = 2; eq(c.game.magic(0), 1); eq(c.h.jugs, 1);
  const H = L.HEROES; L.HERO_KEYS.forEach(k => { const d = H[k].magic.dmg; for (let i = 1; i < 4; i++) ok(d[i] > d[i - 1], 'сила растёт ' + k); });
});
test('бесы-кладовики: удар роняет кувшин/еду (до 3 раз), потом бес убегает; подбор — кувшин +1, еда лечит', () => {
  const { game, S, h, count } = setup(), imp = game._imp(445, 90, -1, 3); imp.pause = 99;
  for (let i = 0; i < 3; i++){ imp.x = 445; imp.z = 90; imp.inv = 0; game.attack(0); run(game, 0.45); }
  eq(count('drop'), 3); ok(imp.flee, 'убегает'); ok(S.items.length >= 3);
  S.items = [{ kind: 'jug', x: h.x, z: h.z, h: 0, vh: 0, t: 1 }]; game.update(1 / 60); eq(h.jugs, 1);
  h.hp = 50; S.items = [{ kind: 'bread', x: h.x, z: h.z, h: 0, vh: 0, t: 1 }]; game.update(1 / 60); eq(h.hp, 78);
  S.items = [{ kind: 'pie', x: h.x, z: h.z, h: 0, vh: 0, t: 1 }]; game.update(1 / 60); eq(h.hp, 138);
  h.hp = h.max; S.items = [{ kind: 'bread', x: h.x, z: h.z, h: 0, vh: 0, t: 1 }]; game.update(1 / 60); eq(S.items.length, 1, 'сытый еду не берёт');
  h.jugs = L.JUG_MAX; S.items = [{ kind: 'jug', x: h.x, z: h.z, h: 0, vh: 0, t: 1 }]; game.update(1 / 60); eq(h.jugs, L.JUG_MAX);
});

// ---------- Ездовые звери ----------
test('звери: удар по седоку выбивает его из седла; ничейного зверя можно оседлать', () => {
  const { game, S, h, has } = setup(), f = foe(game, 'shield', 460, 90, { mount: 'tail' }), m = f.mount; f.hp = 200;
  game.jump(0); run(game, 0.1); game.attack(0); run(game, 0.5);
  ok(has('knockOff') && !f.mount && !m.rider, 'выбит'); run(game, 2.5);
  f.hp = 0; f.alive = false; S.foes = [];
  m.x = h.x + 40; m.z = h.z; m.state = 'idle'; m.lockT = 0; game.setDir(0, 1, 0); run(game, 0.5); game.setDir(0, 0, 0);
  ok(has('mount') && h.mount === m && m.rider === h, 'оседлал');
});
test('в седле: хвостобой бьёт по обе стороны, огнеящер — пламенем вперёд; удар по герою — выбит; «спина» — спешиться', () => {
  const a = setup(), m = a.game._mount('tail', 440, 90); a.game.setDir(0, 1, 0); run(a.game, 0.3); a.game.setDir(0, 0, 0); ok(a.h.mount === m);
  const l = foe(a.game, 'raider', a.h.x - 60, 90), r = foe(a.game, 'raider', a.h.x + 60, 90); l.hp = r.hp = 200;
  a.game.attack(0); eq(a.h.state, 'mountAtk'); run(a.game, 0.8); eq([l.state, r.state], ['down', 'down'], 'хвост по обе стороны');
  a.game._hitHero(a.h, 10, { dir: -1 }); ok(!a.h.mount && !m.rider && a.h.state === 'down', 'выбит из седла');
  const b = setup(), fm = b.game._mount('fire', 440, 90); b.game.setDir(0, 1, 0); run(b.game, 0.3); b.game.setDir(0, 0, 0); ok(b.h.mount === fm);
  const far = foe(b.game, 'spear', b.h.x + 150, 90); far.hp = 500; b.game.attack(0); run(b.game, 1.8); ok(b.count('hit') >= 2 && far.hp < 500, 'пламя достаёт на 150');
  b.game.special(0); ok(!b.h.mount && b.has('dismount'), 'спешился');
});
test('враг в седле атакует зверем; зверь остаётся на поле, враги могут оседлать ничейного', () => {
  const { game, S, h, has } = setup(), f = game._spawn('spear', 600, 90, { mount: 'fire' }); f.entered = true; f.cd = 0;
  let hit = false; run(game, 4, () => { if (h.hp < h.max) hit = true; h.inv = 0; });
  ok(has('breath') && hit, 'огнеящер дышит огнём');
  const s = setup(), m = s.game._mount('tail', 700, 90), e = s.game._spawn('spear', 640, 90); e.entered = true; e.cd = 99; e.remountT = 0; s.h.x = 120;
  run(s.game, 3); ok(s.has('foeMount') && e.mount === m, 'враг оседлал');
});

// ---------- Враги ----------
test('враги: замах (предупреждение) перед ударом; копейщик бьёт дальше всех; налётчица прыгает; громила держит удары и сбивает', () => {
  const E = L.ENEMIES; ok(E.spear.reach > E.shield.reach && E.spear.reach > E.raider.reach); ok(E.raider.leap && E.brute.poise > 0 && E.brute.kd);
  const { game, h, has, events } = setup(), f = foe(game, 'spear', 480, 90); f.cd = 0;
  let wind = -1, hitAt = -1; run(game, 3, i => { if (wind < 0 && f.state === 'atk') wind = i; if (hitAt < 0 && h.hp < h.max) hitAt = i; });
  ok(wind >= 0 && hitAt > wind && (hitAt - wind) / 60 >= E.spear.windup - 0.02, 'замах ' + ((hitAt - wind) / 60).toFixed(2));
  const b = setup(), br = foe(b.game, 'brute', 455, 90); br.hp = 999; b.game.attack(0); run(b.game, 0.3); ok(br.state !== 'hurt', 'громила не дрогнул от одного удара');
  let leaps = 0;
  for (let sd = 1; sd <= 10; sd++){ const c = setup({ seed: sd }), ra = c.game._spawn('raider', 560, 90); ra.entered = true; ra.cd = 0; let lp = false; run(c.game, 4, () => { if (ra.state === 'leap') lp = true; c.h.inv = 0; c.h.hp = c.h.max; }); if (lp) leaps++; }
  ok(leaps >= 2 && leaps <= 9, 'прыжок-удар налётчицы: ' + leaps + '/10');
});

// ---------- Волны, камера, боссы ----------
test('волна запирает камеру; пока враги живы — дальше нельзя; после — «ВПЕРЁД», камера только вперёд', () => {
  const ev = []; const game = D.Game({ rng: mulberry32(3), heroes: ['zhdan'], onEvent: t => ev.push(t) }).start(), S = game.state(), h = S.heroes[0];
  let back = 0, last = 0; game.setDir(0, 1, 0);
  for (let i = 0; i < 600; i++){ game.update(1 / 60); h.inv = 1; if (S.cam < last) back++; last = S.cam; }
  ok(ev.includes('wave') && S.lock === 250 && S.cam === 250, 'заперто на 250'); ok(h.x <= S.cam + L.VIEW_W - 22, 'не уйти за край');
  for (let i = 0; i < 400; i++){ S.foes.forEach(f => { if (f.alive && !f.dying && f.kind === 'foe') game._hitFoe(f, 999, { dir: 1 }); }); game.update(1 / 60); h.inv = 1; }
  ok(ev.includes('go') && S.lock === null, 'ВПЕРЁД'); run(game, 2); ok(S.cam > 250, 'камера пошла'); eq(back, 0, 'камера назад');
});
test('боссы: у каждого свои приёмы; Литейщик — фазы ярости и подмога; волна по земле — перепрыгнуть; лужа жжёт', () => {
  Object.keys(L.BOSSES).forEach(k => ok(L.BOSSES[k].moves.length >= 2, k));
  const { game, S, h, has, count } = setup(), b = game._boss('liteyshchik', 700, 90); b.cd = 99;
  game._hitFoe(b, Math.ceil(b.max * 0.4), { dir: 1 }); run(game, 0.2); ok(has('phase') && b.stage === 1, 'фаза 1');
  game._hitFoe(b, Math.ceil(b.max * 0.35), { dir: 1 }); run(game, 0.2); eq(b.stage, 2, 'фаза 2');
  // волна по земле: стоя — сбивает, в прыжке — мимо
  S.waves.push({ x: h.x - 100, z: h.z, dir: 1, life: 1.5, hits: {}, dmg: 10 }); run(game, 0.5); ok(h.state === 'down', 'волна сбила');
  const c = setup(); c.S.waves.push({ x: c.h.x - 100, z: c.h.z, dir: 1, life: 1.5, hits: {}, dmg: 10 }); run(c.game, 0.12); c.game.jump(0); run(c.game, 0.5); eq(c.h.hp, c.h.max, 'перепрыгнул');
  const d = setup(); d.S.puddles.push({ x: d.h.x, z: d.h.z, warn: 0.3, burn: 2, r: 40, tick: 0 }); run(d.game, 0.25); eq(d.h.hp, d.h.max, 'пока предупреждение — не жжёт'); run(d.game, 0.5); ok(d.h.hp < d.h.max, 'жжёт');
  // приёмы босса в бою
  const e = setup({ seed: 4 }), bb = e.game._boss('cepnik', 650, 90); const moves = new Set(); e.events.length = 0;
  run(e.game, 30, () => { e.h.inv = 1; if (bb.move) moves.add(bb.move); }); ok(moves.size >= 2, 'приёмы: ' + [...moves]);
});
test('ход игры: смерть босса — этап пройден (бонус), после 1-го — привал с бесами, затем этап 2; после 6-го — победа', () => {
  const ev = []; const game = D.Game({ rng: mulberry32(2), heroes: ['secha'], onEvent: (t, d) => ev.push([t, d]) }).start(), S = game.state();
  S.cam = S.len - L.VIEW_W; game._lockBoss(); const b = S.foes.find(f => f.kind === 'boss'); b.intro = 0;
  run(game, 0.1); game._hitFoe(b, 9999, { dir: 1 }); run(game, 3);
  ok(ev.some(e => e[0] === 'bossDie') && S.phase === 'clear' && S.lastBonus > 0, 'этап пройден');
  for (let i = 0; i < 600 && S.phase === 'clear'; i++) game.update(1 / 60);
  eq(S.phase, 'bonus'); ok(ev.some(e => e[0] === 'bonus'));
  run(game, 5); ok(S.foes.some(f => f.kind === 'imp'), 'бесы пришли');
  run(game, 10); eq(S.phase, 'play'); eq(S.stage, 2);
  const g6 = D.Game({ rng: mulberry32(2), heroes: ['olha'], stage: 6 }).start(), S6 = g6.state();
  S6.cam = S6.len - L.VIEW_W; g6._lockBoss(); S6.queue = []; const b6 = S6.foes.find(f => f.kind === 'boss'); b6.intro = 0; g6._hitFoe(b6, 9999, { dir: 1 }); run(g6, 8);
  ok(S6.won && S6.phase === 'won', 'победа');
});

// ---------- Жизни, продолжения ----------
test('жизни: здоровье 0 — минус жизнь, возрождение с полным здоровьем и неуязвимостью; все выбыли — «продолжить?» (2 раза), потом конец', () => {
  const { game, S, h, has } = setup();
  h.hp = 1; game._hitHero(h, 50, { dir: -1 }); ok(has('heroDie')); run(game, 3); eq(h.lives, 2); ok(has('respawn') && h.hp === h.max && h.inv > 0);
  run(game, 3); h.lives = 1; h.inv = 0; h.hp = 1; game._hitHero(h, 50, {}); run(game, 3);
  ok(h.out && S.phase === 'continue' && has('continueAsk'));
  ok(game.continue_()); eq(S.continues, 1); eq(h.lives, 3); ok(!h.out && S.phase === 'play');
  const b = setup({ continues: 0 }); b.h.lives = 1; b.h.hp = 1; b.game._hitHero(b.h, 50, {}); run(b.game, 3); ok(b.S.over && b.has('gameover'), 'без продолжений — конец');
  const c = setup(); c.h.lives = 1; c.h.hp = 1; c.game._hitHero(c.h, 50, {}); run(c.game, 3); eq(c.S.phase, 'continue'); run(c.game, 10.5); ok(c.S.over, 'отсчёт истёк — конец');
});

// ---------- Кооп ----------
test('кооп: два разных героя, ввод независим; урон, кувшины и жизни у каждого свои; выбыл один — игра идёт', () => {
  const { game, S, has } = setup({ players: 2, heroes: ['zhdan', 'olha'] }), [a, b] = S.heroes;
  eq([a.hero, b.hero], ['zhdan', 'olha']);
  const bx = b.x; game.setDir(0, 1, 0); game.jump(0); run(game, 0.3); eq(b.x, bx, 'И2 стоял'); ok(b.state === 'idle');
  game.attack(1); eq(b.state, 'atk'); ok(a.state !== 'atk');
  a.jugs = 3; S.items = [{ kind: 'jug', x: b.x, z: b.z, h: 0, vh: 0, t: 1 }]; game.update(1 / 60); eq([a.jugs, b.jugs], [3, 1]);
  a.lives = 1; a.hp = 1; a.inv = 0; game._hitHero(a, 99, {}); run(game, 3); ok(a.out && !b.out && S.phase === 'play', 'выбыл один');
});
test('кооп: камера держит обоих в кадре (поводок), враги толще', () => {
  const game = D.Game({ rng: mulberry32(5), players: 2, heroes: ['secha', 'zhdan'] }).start(), S = game.state();
  S.heroes.forEach(h => { h.inv = 1e9; h.lives = 99; });
  let bad = 0; game.setDir(0, 1, 0); game.setDir(1, 0, 0);
  for (let i = 0; i < 900; i++){ game.update(1 / 60); S.heroes.forEach(h => { if (h.x < S.cam || h.x > S.cam + L.VIEW_W) bad++; }); }
  eq(bad, 0); ok(S.cam <= S.heroes[1].x, 'камера ждёт отставшего');
  const s1 = D.Game({ rng: mulberry32(5), heroes: ['zhdan'], arena: true }).start(), s2 = D.Game({ rng: mulberry32(5), players: 2, heroes: ['zhdan', 'secha'], arena: true }).start();
  ok(s2._spawn('brute', 500, 90).max > s1._spawn('brute', 500, 90).max, 'в коопе враги толще');
});
test('кооп: ввод движка по игрокам — раскладки без конфликтов, И1 стрелки / И2 WASD раздельно, удар/прыжок/магия/«спина» по игрокам, в одиночке обе ведут И1', () => {
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
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'dd' });
  g.useStandardScreens({ lives: 3 }); g.scene('play', { realtime: true }); g.start('title');
  g.usePlayers({ bind: L.BIND, actions: ['attack', 'jump', 'magic', 'back'] });
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  key('keydown', 'KeyW'); key('keydown', 'KeyX');
  ok(P2.pressed('up') && P2.pressed('attack') && !P1.pressed('up') && !P1.pressed('attack'), 'WASD/X ушли не тому');
  ['ArrowLeft', 'Slash', 'Space', 'Period', 'Comma', 'KeyZ', 'KeyC', 'KeyV'].forEach(c => key('keydown', c));
  ok(P1.pressed('left') && P1.pressed('attack') && !P2.pressed('left'), 'стрелки ушли не тому');
  eq(got, ['2attack', '1attack', '1jump', '1magic', '1back', '2jump', '2magic', '2back'], 'действия по игрокам');
  ['KeyW', 'KeyX', 'ArrowLeft', 'Slash', 'Space', 'Period', 'Comma', 'KeyZ', 'KeyC', 'KeyV'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'KeyD'); key('keydown', 'KeyX');
  ok(P1.pressed('right') && P1.pressed('attack') && !P2.pressed('right'), 'в одиночке WASD/X не ведут И1');
});

// ---------- i18n, музыка, страница, имена ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть герои, этапы, боссы, магия', () => {
  const ru = Object.keys(D.STR.ru).sort(), en = Object.keys(D.STR.en).sort(); eq(ru, en);
  ru.forEach(k => ok(String(D.STR.ru[k]).trim() && String(D.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(D.STR.ru[k], 'нет ключа движка ' + k));
  L.HERO_KEYS.forEach(k => ok(D.STR.ru['h_' + k] && D.STR.ru['d_' + k] && D.STR.ru['m_' + L.HEROES[k].magic.kind], 'герой ' + k));
  L.STAGES.forEach(s => ok(D.STR.ru['s_' + s.key] && D.STR.en['b_' + s.boss], 'этап ' + s.key));
  eq([D.STR.ru.h_zhdan, D.STR.ru.h_secha, D.STR.ru.h_olha], ['Ждан', 'Сеча', 'Ольха']); eq(D.STR.ru.b_liteyshchik, 'ЧЁРНЫЙ ЛИТЕЙЩИК');
});
test('музыка: трек druzhina разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.druzhina; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0, 'не разобран');
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas, скрипты по порядку, тач-кнопки; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="960" height="540"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ok(/data-jump/.test(html) && /data-magic/.test(html) && /data-back/.test(html) && /data-pause/.test(html) && /data-d="A"/.test(html), 'тач-кнопки');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
});
test('рендер: кадр всех этапов и привала рисуется без исключений в обеих темах (фиктивный canvas)', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  for (const f of ['js/game.js', 'js/i18n.js', 'js/modern.js', 'js/classic.js', 'js/render.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box, { filename: f });
  const R = box.DRUZHINA, grad = { addColorStop(){} };
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => grad : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (o, k, v) => { o[k] = v; return true; } });
  for (let st = 1; st <= 6; st++) for (const P of [R.modern, R.classic]){
    const g = R.Game({ rng: mulberry32(st), players: 2, heroes: ['zhdan', 'olha'], stage: st, arena: true }).start(), S = g.state();
    g._spawn('shield', 300, 50, { mount: 'tail' }); g._spawn('raider', 500, 90, { mount: 'fire' }); g._spawn('brute', 600, 150); g._spawn('spear', 700, 20); g._imp(800, 60, -1, 3); g._mount('fire', 350, 170);
    g._boss(L.STAGES[st - 1].boss, 760, 120); S.items.push({ kind: 'jug', x: 200, z: 20, h: 0, vh: 0, t: 1 }, { kind: 'pie', x: 220, z: 60, h: 0, vh: 0, t: 1 });
    S.heroes[0].jugs = 8; g.magic(0); for (let i = 0; i < 90; i++){ g.update(1 / 60); R.render.world(ctx, S, P, {}); }
  }
  const g = R.Game({ rng: mulberry32(1), heroes: ['secha'] }).start(), S = g.state(); S.key = 'camp'; R.render.world(ctx, S, R.classic, {});
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGdvbGRlbiA/YXhlfNCz0L7Qu9C00LXQvSA/0Y3QutGBfFxic3RyZWV0cyA/b2YgP3JhZ2VcYnzRgdGC0YDQuNGC0YEgP9C+0YQgP9GA0LXQudC00LZ8ZmluYWwgP2ZpZ2h0fNGE0LDQudC90LDQuyA/0YTQsNC50YI=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ok(BAD.test(u('R29sZGVuIEF4ZQ==')) && BAD.test(u('U3RyZWV0cyBvZiBSYWdl')) && BAD.test(u('RklOQUwgRklHSFQ=')) && BAD.test(u('0LPQvtC70LTQtdC9INGN0LrRgQ==')), 'стоп-лист ловит оригиналы жанра');
  ok(!BAD.test('Дружина') && !BAD.test('Литейщик') && !BAD.test('Гефест') && !BAD.test('final battle') && !BAD.test('CONTRACT.md') && !BAD.test('Foundry Keep'), 'без ложных срабатываний');
});

// ---------- Проходимость и баланс: «человеческий» бот ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
// «Собранный» бот (реакция 0.12–0.2 с, редкие зевки) проходит каждый этап с нуля (3 жизни) хотя бы в 2 из 3 партий.
const PASS = [];
for (let st = 1; st <= 6; st++) for (const s of [1, 2, 3]) PASS.push({ st, r: playDruzhina(D, s, { stage: st, stages: 1, miss: 0.1, react: [0.12, 0.2] }) });
test('проходимость: каждый из 6 этапов проходится «собранным» ботом (≥ 2 из 3)', () => {
  console.log('     время, с: ' + PASS.map(p => p.st + ':' + p.r.time.toFixed(0) + (p.r.won ? '' : '✗')).join(' '));
  const bad = []; for (let st = 1; st <= 6; st++) if (PASS.filter(p => p.st === st && p.r.won).length < 2) bad.push(st);
  ok(!bad.length, 'не пройдены: ' + bad.join(', ')); ok(!PASS.some(p => p.r.stuck), 'зависание');
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, видит только кадр, замах замечает не всегда (зевок 40%), без продолжений.
const NB = 40, BAL = []; for (let s = 1; s <= NB; s++) BAL.push(playDruzhina(D, s));
const reach = {}; BAL.forEach(r => { reach[r.cleared] = (reach[r.cleared] || 0) + 1; });
const byHero = {}; BAL.forEach(r => { const k = r.heroes[0]; byHero[k] = byHero[k] || [0, 0]; byHero[k][0]++; if (r.won) byHero[k][1]++; });
console.log('     бот (1 игрок, ' + NB + ' партий): этап 1 — ' + BAL.filter(r => r.cleared >= 1).length + '/' + NB + ', вся игра — ' + BAL.filter(r => r.won).length + '/' + NB + ', пройдено этапов → партий: ' + JSON.stringify(reach) + ', победы по героям: ' + JSON.stringify(byHero));
console.log('     приёмы за все партии: магия ' + BAL.reduce((a, r) => a + r.magic, 0) + ', седло ' + BAL.reduce((a, r) => a + r.mounts, 0) + ', захваты ' + BAL.reduce((a, r) => a + r.grabs, 0) + ', «спина» ' + BAL.reduce((a, r) => a + r.backs, 0));
test('баланс: этап 1 проходят ≥ 90% партий бота', () => ok(BAL.filter(r => r.cleared >= 1).length >= 0.9 * NB, 'этап 1: ' + BAL.filter(r => r.cleared >= 1).length + '/' + NB));
test('баланс: всю игру (6 этапов) без продолжений проходят ~20–50%', () => { const w = BAL.filter(r => r.won).length / NB; ok(w >= 0.2 && w <= 0.5, 'вся игра: ' + w); });
test('баланс: каждым героем игру можно пройти; бот нигде не застревает', () => { Object.keys(byHero).forEach(k => ok(byHero[k][1] >= 1, 'не прошёл ни разу: ' + k)); eq(BAL.filter(r => r.stuck).length, 0); });
const CO = []; for (let s = 1; s <= 12; s++) CO.push(playDruzhina(D, s, { players: 2 }));
const cw = CO.filter(r => r.won).length / CO.length;
console.log('     бот (кооп, 12 партий): этап 1 — ' + CO.filter(r => r.cleared >= 1).length + '/12, вся игра — ' + CO.filter(r => r.won).length + '/12');
test('баланс кооп: этап 1 — все, всю игру — не «на халяву» (≤ 85%), без зависаний', () => { ok(CO.every(r => r.cleared >= 1), 'кооп падает на 1-м'); ok(cw <= 0.85, 'кооп слишком лёгок: ' + cw); ok(!CO.some(r => r.stuck)); });

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
