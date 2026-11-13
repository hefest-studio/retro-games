/* ПОДРЯД · tests/engine.test.mjs — автотесты логики, экономики и баланса (Node, без зависимостей).
   Запуск: node podryad/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/data.js', 'js/economy.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const PD = sandbox.PODRYAD, D = PD.DATA, E = PD.Eco, K = PD.logic.K;
const { playMission, playCampaign, shop, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const plain = o => JSON.parse(JSON.stringify(o));

function mk(opts = {}){
  const ev = [];
  const game = PD.Game(Object.assign({ rng: mulberry32(1), onEvent: (t, a, b, c) => ev.push({ t, a, b, c }) }, opts)).start();
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, dy = 0){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy); game.tick(K.STEP); } }
const rich = (m = 1e6) => { const c = E.create('normal'); c.money = m; return c; };

// ---------- состав кампании ----------
test('кампания: 3 сектора × 3 задания; в каждом задании мид-босс, у третьего — свой босс сектора; задания различаются', () => {
  eq(D.SECTORS.length, 3); const bosses = new Set(), sigs = new Set();
  for (let i = 0; i < 9; i++){
    const m = D.buildMission(Math.floor(i / 3), i % 3);
    eq(m.waves.filter(w => w.boss && w.mid).length, 1, 'мид-босс ' + i);
    const big = m.waves.filter(w => w.boss && !w.mid); eq(big.length, i % 3 === 2 ? 1 : 0, 'босс ' + i);
    if (big.length) bosses.add(big[0].boss);
    ok(m.waves.length >= 15, 'волн ' + m.waves.length); ok(m.ground.length >= 15, 'наземных целей ' + m.ground.length);
    ok(m.isles.length >= 12, 'островов ' + m.isles.length);
    sigs.add(m.waves.map(w => w.kind + w.form).join());
  }
  eq(bosses.size, 3, 'боссы секторов разные'); eq(sigs.size, 9, 'задания разные');
});
test('задание собирается детерминированно из (сектор, номер)', () => {
  eq(JSON.stringify(D.buildMission(1, 2)), JSON.stringify(D.buildMission(1, 2)));
});
test('враги нарастают: тяжёлые машины (бочки, буксиры) появляются только дальше по кампании', () => {
  const kinds = i => new Set(D.buildMission(Math.floor(i / 3), i % 3).waves.filter(w => !w.boss).map(w => w.kind));
  ok(!kinds(0).has('tug') && !kinds(0).has('barrel'), 'в 1-м задании нет тяжёлых');
  ok([6, 7, 8].some(i => kinds(i).has('tug')), 'в 3-м секторе есть буксиры');
});

// ---------- экономика: цены ----------
test('цены: 4 основных орудия по 5 ступеней, 3 боковых модуля, мега-бомба, ячейка щита, щит-генератор 3 ступени, ремонт', () => {
  eq(D.GUN_IDS.length, 4); D.GUN_IDS.forEach(k => { eq(D.GUNS[k].up.length, 4, k); for (let i = 1; i < 4; i++) ok(D.GUNS[k].up[i] > D.GUNS[k].up[i - 1], k + ' ступени дорожают'); });
  eq(D.MOD_IDS.length, 3); eq(D.SPECIAL.gen.up.length, 3);
  const c = rich(); for (const r of D.SHOP) if (r.kind !== 'go' && r.kind !== 'repair') ok(E.price(c, r.id) > 0, 'цена ' + r.id);
  c.armor = 40; eq(E.price(c, 'repair'), 60 * D.REPAIR);
});
test('цены: ступени орудия — по таблице; на 5-й ступени купить больше нельзя', () => {
  const c = rich(); eq(E.price(c, 'g:fan'), D.GUNS.fan.price);
  E.buy(c, 'g:fan'); for (let lv = 1; lv < 5; lv++){ eq(E.price(c, 'g:fan'), D.GUNS.fan.up[lv - 1], 'ступень ' + (lv + 1)); E.buy(c, 'g:fan'); }
  eq(c.guns.fan, 5); eq(E.price(c, 'g:fan'), null); ok(!E.canBuy(c, 'g:fan')); eq(E.buy(c, 'g:fan'), 0);
});
test('продажа за полцены: по каждой строке купить и продать — казна теряет ровно половину цены', () => {
  for (const r of D.SHOP){
    if (r.kind === 'go' || r.kind === 'repair') continue;
    const c = rich(100000); if (r.key === 'rivet') E.buy(c, 'g:fan');   // чтобы было что держать в руках
    const m0 = c.money, p = E.price(c, r.id); E.buy(c, r.id); const v = E.sell(c, r.id);
    eq(v, Math.floor(p / 2), r.id); eq(c.money, m0 - p + Math.floor(p / 2), r.id);
  }
  // орудие с тремя ступенями: продаётся ступень за ступенью, каждая за полцены своей цены
  const c = rich(100000), m0 = c.money; E.buy(c, 'g:hammer'); E.buy(c, 'g:hammer'); E.buy(c, 'g:hammer');
  const paid = m0 - c.money; let got = 0; while (c.guns.hammer) got += E.sell(c, 'g:hammer');
  eq(got, Math.floor(D.GUNS.hammer.up[1] / 2) + Math.floor(D.GUNS.hammer.up[0] / 2) + Math.floor(D.GUNS.hammer.price / 2)); ok(got <= paid / 2);
});
test('нельзя продать последнее основное орудие; Клепальник выдаётся даром', () => {
  const c = E.create('normal'); eq(c.guns.rivet, 1); eq(E.sellPrice(c, 'g:rivet'), null); eq(E.sell(c, 'g:rivet'), 0); eq(c.guns.rivet, 1);
  c.money = 5000; E.buy(c, 'g:fan'); eq(c.gun, 'fan', 'новое — в руки'); ok(E.sell(c, 'g:rivet') > 0); ok(!c.guns.rivet); eq(E.sellPrice(c, 'g:fan'), null, 'теперь последнее — веерник');
});
test('модули: два гнезда (левое, правое), третий не купить; продажа освобождает гнездо', () => {
  const c = rich(); E.buy(c, 'm:turret'); E.buy(c, 'm:homer'); eq(c.mods.join(), 'turret,homer');
  eq(E.price(c, 'm:scythe'), null); eq(E.buy(c, 'm:scythe'), 0);
  E.sell(c, 'm:turret'); eq(c.mods[0], null); E.buy(c, 'm:scythe'); eq(c.mods.join(), 'scythe,homer');
  E.buy(c, 'm:turret'); eq(E.buy(c, 'm:turret'), 0, 'гнёзд нет');
});
test('казна никогда не уходит в минус: 20 000 случайных покупок/продаж/ремонтов при случайной казне', () => {
  const r = mulberry32(99), ids = D.SHOP.map(x => x.id).filter(x => x !== 'go');
  for (let k = 0; k < 40; k++){
    const c = E.create('normal'); c.money = Math.floor(r() * 6000); c.armor = 1 + Math.floor(r() * 100);
    for (let i = 0; i < 500; i++){
      const id = ids[(r() * ids.length) | 0], m0 = c.money;
      if (r() < 0.65){ const p = E.price(c, id), got = E.buy(c, id); if (got) ok(id === 'repair' ? got <= m0 : got === p, 'списано не по цене ' + id); else ok(p == null || m0 < (id === 'repair' ? D.REPAIR : p), 'отказ при достатке ' + id); }
      else E.sell(c, id);
      ok(c.money >= 0, 'минус: ' + c.money); ok(Number.isInteger(c.money)); ok(c.armor >= 1 && c.armor <= 100);
      ok(Object.keys(c.guns).length >= 1 && c.guns[c.gun], 'основное орудие в руках');
      if (r() < 0.05) c.money += Math.floor(r() * 3000);
    }
  }
});
test('ремонт: чинит сколько хватает денег (◈12 за единицу), полная броня — не продаётся', () => {
  const c = E.create('normal'); c.armor = 20; c.money = 500;
  const p = E.buy(c, 'repair'); eq(c.armor, 20 + Math.floor(500 / D.REPAIR)); eq(p, Math.floor(500 / D.REPAIR) * D.REPAIR); ok(c.money >= 0 && c.money < D.REPAIR);
  c.money = 5000; E.buy(c, 'repair'); eq(c.armor, 100); eq(E.price(c, 'repair'), null); eq(E.sellPrice(c, 'repair'), null);
});

// ---------- гибель и итог задания ----------
test('гибель: теряется ПОСЛЕДНЕЕ купленное снаряжение, по одному за раз; расходники не теряются', () => {
  const c = rich(100000);
  E.buy(c, 'm:turret'); E.buy(c, 'g:rivet'); E.buy(c, 'x:mega'); E.buy(c, 'x:cell'); E.buy(c, 'x:gen'); E.buy(c, 'g:fan'); E.buy(c, 'g:fan');
  const lose = () => E.finishMission(c, { ok: false, money: 0, armor: 0, mega: c.mega, cells: c.cells }).lost;
  eq(lose().id, 'g:fan'); eq(c.guns.fan, 1, 'ступень веерника снята');
  eq(lose().id, 'g:fan'); ok(!c.guns.fan, 'веерник потерян'); ok(c.guns[c.gun], 'в руках — оставшееся орудие');
  eq(lose().id, 'x:gen'); eq(c.gen, 0);
  eq(lose().id, 'g:rivet'); eq(c.guns.rivet, 1);
  const t = lose(); eq(t.id, 'm:turret'); eq(t.slot, 0); eq(c.mods[0], null);
  eq(lose(), null, 'терять больше нечего'); eq(c.guns.rivet, 1, 'даровой Клепальник остаётся');
  eq(c.mega, 1); eq(c.cells, 1); eq(c.deaths, 6); eq(c.armor, 100, 'броню мастерская чинит');
});
test('гибель: проданное снаряжение не «теряется» повторно — продажа убирает его из истории', () => {
  const c = rich(100000); E.buy(c, 'm:homer'); E.buy(c, 'm:turret'); E.sell(c, 'm:turret');
  eq(E.loseLast(c).id, 'm:homer'); eq(c.mods.join(), ',');
});
test('итог задания: успех — заработок в казну и следующее задание; провал — заработок пропадает', () => {
  const c = E.create('normal'), m0 = c.money;
  let f = E.finishMission(c, { ok: true, money: 2500, armor: 63.4, mega: 2, cells: 0 });
  ok(f.ok); eq(c.money, m0 + 2500); eq(c.mi, 1); eq(c.earned, 2500); eq(c.armor, 63); eq(c.mega, 2);
  f = E.finishMission(c, { ok: false, money: 0, armor: 0, mega: 1, cells: 0 }); ok(!f.ok); eq(c.money, m0 + 2500); eq(c.mi, 1);
  for (let i = 1; i < 9; i++) E.finishMission(c, { ok: true, money: 10, armor: 50, mega: 0, cells: 0 });
  ok(c.done);
});

// ---------- сохранение ----------
test('сохранение: туда-обратно без потерь; ключ arcade.podryad.save; очистка', () => {
  const mem = {}, store = { get: (k, d) => k in mem && mem[k] !== '' ? mem[k] : d, set: (k, v) => { mem[k] = String(v); } };
  const c = rich(4321); E.buy(c, 'm:scythe'); E.buy(c, 'g:arc'); E.buy(c, 'x:gen'); c.mi = 4; c.armor = 55; c.earned = 9999; c.deaths = 2;
  ok(E.save(store, c)); ok(typeof mem['arcade.podryad.save'] === 'string');
  const b = E.load(store); eq(JSON.stringify(plain(b)), JSON.stringify(plain(c)));
  E.clear(store); eq(E.load(store), null);
});
test('сохранение: битые и подделанные данные — без падения, поля приводятся к допустимым', () => {
  eq(E.deserialize('{не json'), null); eq(E.deserialize('null'), null); eq(E.deserialize('{"v":2}'), null);
  const b = E.deserialize(JSON.stringify({ v: 1, diff: 'бог', money: -500, mi: 99, guns: { rivet: 9, fan: 'x', laser: 3 }, gun: 'laser', mods: ['turret', 'pushka'], mega: 99, cells: -1, gen: 7, armor: 0, hist: [{ id: 'm:turret', slot: 0 }, { id: 'zzz' }, null] }));
  ok(b); eq(b.diff, 'normal'); eq(b.money, 0); eq(b.mi, 9); eq(b.guns.rivet, 5); ok(!b.guns.fan && !b.guns.laser); eq(b.gun, 'rivet');
  eq(b.mods.join(), 'turret,'); eq(b.mega, D.SPECIAL.mega.max); eq(b.cells, 0); eq(b.gen, 3); eq(b.armor, 1); eq(b.hist.length, 1); ok(b.done);
  const empty = E.deserialize(JSON.stringify({ v: 1, guns: {} })); eq(empty.guns.rivet, 1, 'без орудий — выдаётся Клепальник');
});
test('main.js: сохранение после покупок/продаж и заданий, загрузка при старте, рекорд — общий ключ для каталога', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/E\.load\(Store\)/.test(src)); ok((src.match(/saveCamp\(\)/g) || []).length >= 5); ok(src.includes("'arcade.best.podryad'"));
});

// ---------- бой ----------
test('орудия: у каждого 5 ступеней, урон в секунду растёт со ступенью; Молот — с разрывом, Дуговик — пробивает', () => {
  for (const k of D.GUN_IDS){
    let prev = 0;
    for (let lv = 1; lv <= 5; lv++){ const v = PD.logic.gunVolley(k, lv, 0, 0), dps = v.reduce((a, s) => a + s.dmg, 0) / PD.logic.gunIv(k, lv); ok(dps > prev, k + ' ст.' + lv + ' ' + dps.toFixed(1)); prev = dps; }
  }
  ok(PD.logic.gunVolley('hammer', 1, 0, 0)[0].splash > 0); ok(PD.logic.gunVolley('arc', 1, 0, 0)[0].pierce);
});
test('наземные цели: разрушаются выстрелами, дают деньги, склады и цеха роняют контейнеры; подбор зачисляется', () => {
  const { game, S, has } = mk({ noHit: true }); let pays = 0;
  for (let i = 0; i < 60 * 40; i++){ const t = S.G.find(g => g.hp > 0 && g.y > 60 && g.y < 500) || S.items[0]; game.setInput(t ? Math.sign(t.x - S.P.x) : 0, 0); game.tick(K.STEP); S.E.length = 0; S.eb.length = 0; }
  ok(has('gkill'), 'разрушено'); ok(S.gkills >= 3, 'наземных: ' + S.gkills); ok(S.money > 0);
  ok(has('pay')); pays = S.money; ok(pays >= S.gkills * 40);
});
test('щит: принимает урон раньше брони и подзаряжается после паузы; ячейка заряжает мгновенно', () => {
  const { game, S } = mk({ load: { cells: 1 } }); S.P.y = 600; S.E.length = 0;
  const cap = S.P.scap; game._hurt(K.BULLET_DMG); ok(S.P.shield < cap); eq(S.P.armor, 100, 'броня цела');
  run(game, 0.3); for (let i = 0; i < 8; i++){ S.P.inv = 0; game._hurt(K.BULLET_DMG); } ok(S.P.armor < 100, 'щит пробит — урон по броне');
  const sh = S.P.shield; run(game, 0.5); ok(S.P.shield <= sh + 0.01, 'подзарядка не сразу');
  run(game, 4); ok(S.P.shield > sh, 'подзарядилась');
  S.P.shield = 0; ok(game.cell()); eq(S.P.shield, cap); eq(S.P.cells, 0); ok(!game.cell(), 'ячеек больше нет');
});
test('щит-генератор: ёмкость 30 → 90 и подзарядка быстрее по ступеням', () => {
  eq(D.shieldCap(0), 30); eq(D.shieldCap(3), 90); ok(D.shieldRegen(3) > D.shieldRegen(0));
  const { S } = mk({ load: { gen: 2 } }); eq(S.P.scap, 70);
});
test('мега-бомба: гасит все заклёпки, бьёт всех на экране, тратит заряд; без зарядов не работает', () => {
  const { game, S, has } = mk({ noHit: true, load: { mega: 1 } }); run(game, 12);
  ok(S.E.length > 0 || S.eb.length > 0, 'есть цели'); S.eb.push({ x: 10, y: 10, vx: 0, vy: 0, r: 4 });
  ok(game.bomb()); eq(S.eb.length, 0); eq(S.P.mega, 0); ok(has('mega')); ok(!game.bomb());
});
test('гибель в бою: броня 0 → крыло сбито → провал задания, заработок не выплачивается', () => {
  const { game, S, has } = mk(); S.money = 700; S.P.shield = 0;
  for (let i = 0; i < 30 && S.phase === 'play'; i++){ S.P.inv = 0; game._hurt(20); }
  eq(S.phase, 'dead'); run(game, 2); eq(S.phase, 'fail'); ok(has('fail')); const r = game.result(); ok(!r.ok); eq(r.money, 0); eq(r.earnedRaw, 700);
});
test('модули: турель наводится сама, самонаводки доворачивают, лазер-коса срезает заклёпки', () => {
  const a = mk({ noHit: true, load: { mods: ['turret', 'homer'] } }); run(a.game, 1.2);
  const tur = a.S.shots.filter(s => s.k === 4), hom = a.S.shots.filter(s => s.k === 5); ok(tur.length > 0 && hom.length > 0);
  const b = mk({ noHit: true, load: { mods: ['scythe', null] } }); const P0 = b.S.P;
  b.S.eb.push({ x: P0.x - 24, y: P0.y - 30, vx: 0, vy: 10, r: 4 }); run(b.game, 0.1); eq(b.S.eb.filter(q => Math.abs(q.x - (P0.x - 24)) < 5).length, 0, 'срезана'); ok(b.has('cut'));
  const c2 = mk({ noHit: true, load: { guns: { rivet: 1, fan: 1 }, gun: 'rivet' } }); ok(c2.game.cycleGun()); eq(c2.S.P.gun, 'fan');
});
test('мид-босс: если не сбит за отведённое время — улетает без платы; босс сектора останавливает прокрутку', () => {
  const { game, S, has } = mk({ noHit: true, load: { guns: { rivet: 1 } } });
  S.P.y = 630; game._spawnBoss('zep', true); S.boss.hp = 1e9; S.boss.max = 1e9; const m0 = S.money;
  for (let i = 0; i < 60 * 40 && S.boss; i++){ game.setInput(-1, 0); game.tick(K.STEP); S.E.length = 0; S.G.length = 0; S.items.length = 0; }
  ok(has('bossLeft'), 'улетел'); ok(!S.boss); eq(S.money, m0, 'без платы');
  const b = mk({ noHit: true, si: 0, mj: 2 }); b.game._spawnBoss('crane'); const d0 = b.S.d; run(b.game, 3); eq(b.S.d, d0, 'прокрутка стоит'); eq(b.S.phase, 'boss');
  b.S.boss.hp = 1; for (let i = 0; i < 120 && b.S.boss; i++){ b.S.P.x = b.S.boss.x; b.game.tick(K.STEP); } ok(b.has('bossDown'), 'босс сбит'); run(b.game, 5); eq(b.S.phase, 'done');
});
test('детерминизм: тот же сид и ввод → тот же итог задания', () => {
  const r = s => { const { game, S } = mk({ rng: mulberry32(s), si: 1, mj: 1 }); for (let i = 0; i < 60 * 50; i++){ game.setInput(Math.sin(i / 50), 0); game.tick(K.STEP); } return [S.money, S.kills, S.gkills, S.P.armor.toFixed(2), S.eb.length].join('/'); };
  eq(r(5), r(5));
});
test('сложность: на Трудном урон и огонь выше, чем на Лёгком', () => {
  ok(D.DIFF.hard.dmg > D.DIFF.normal.dmg && D.DIFF.normal.dmg > D.DIFF.easy.dmg); ok(D.DIFF.hard.rate > D.DIFF.easy.rate);
  const shots = d => { const { game, S } = mk({ diff: d, noHit: true, rng: mulberry32(3) }); let n = 0, prev = 0; for (let i = 0; i < 60 * 40; i++){ game.tick(K.STEP); if (S.eb.length > prev) n += S.eb.length - prev; prev = S.eb.length; } return n; };
  ok(shots('hard') > shots('easy') * 1.3, 'заклёпок: ' + shots('easy') + ' vs ' + shots('hard'));
});

// ---------- экономика и задания ----------
test('на каждое задание можно заработать минимально необходимое (потенциал ≥ 2× «нужно»; «нужно» ≥ ремонта половины брони)', () => {
  for (let i = 0; i < 9; i++){
    const m = D.buildMission(Math.floor(i / 3), i % 3), pot = D.missionPotential(m);
    ok(pot >= 2 * D.NEED[i], 'задание ' + (i + 1) + ': потенциал ' + pot + ' < 2×' + D.NEED[i]);
    ok(D.NEED[i] >= 50 * D.REPAIR, 'нужно ' + D.NEED[i]);
  }
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек podryad подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.podryad; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0);
});
test('i18n: у RU и EN одинаковые ключи; все g.t(…) из кода и названия снаряжения/заданий/боссов есть', () => {
  const ru = Object.keys(PD.STR.ru).sort(), en = Object.keys(PD.STR.en).sort(); eq(ru.join(','), en.join(','));
  const src = ['js/main.js', 'js/render.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  for (const m of src.matchAll(/\.t\('([a-zA-Z_0-9]+)'\)/g)) ok(m[1] in PD.STR.ru, 'нет строки ' + m[1]);
  for (const r of D.SHOP){ const k = r.id.replace(':', '_'); ok(PD.STR.ru[k] && PD.STR.en[k], k); ok(PD.STR.ru['d_' + k] && PD.STR.en['d_' + k], 'd_' + k); }
  for (let i = 0; i < 9; i++) ok(PD.STR.ru['mn' + i] && PD.STR.en['mn' + i]);
  for (const b in D.BOSSES) ok(PD.STR.ru['b_' + b] && PD.STR.en['b_' + b]);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifFxicmFwdG9yXGJ80YDRjdC/0YLQvtGAfNGA0LDQv9GC0L7RgHx0eXJpYW580YLQuNGA0LjQsNC9fNGC0LDQudGA0LjQsNC9', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Ржавая артель') && !BAD.test('Клепальник') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест') && !BAD.test('Старшина артели') && !BAD.test('turret'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, ошибки оценки, ограниченное внимание; в ангаре — простая стратегия.
test('баланс: бот проходит задание 1 (Норма) с первой попытки почти всегда (≥ 90% из 30) и зарабатывает минимально необходимое', () => {
  const R = []; for (let s = 1; s <= 30; s++){ const c = E.create('normal'); shop(PD, c); R.push(playMission(PD, c, s)); }
  const n = R.filter(r => r.ok).length, earned = R.filter(r => r.ok).map(r => r.money).sort((a, b) => a - b);
  console.log('     задание 1: ' + n + '/30, заработок медиана ' + earned[earned.length >> 1] + ', мин ' + earned[0]);
  ok(n >= 27, 'слишком сложно: ' + n + '/30'); ok(earned[earned.length >> 1] >= D.NEED[0], 'медиана ниже «нужно»');
});
test('баланс: бот проходит сектор 1 (3 задания, Норма, до 3 попыток на задание) часто (≥ 60% из 15), казна не уходит в минус', () => {
  const R = []; for (let s = 1; s <= 15; s++) R.push(playCampaign(PD, s, { diff: 'normal', missions: 3, tries: 3 }));
  const n = R.filter(r => r.cleared >= 3).length, deaths = R.reduce((a, r) => a + r.deaths, 0);
  console.log('     сектор 1: ' + n + '/15, гибелей всего ' + deaths + ', казна после сектора — медиана ' + R.map(r => r.money[r.money.length - 1]).sort((a, b) => a - b)[7]);
  ok(n >= 9, 'сектор 1: ' + n + '/15'); R.forEach(r => r.money.forEach(m => ok(m >= 0)));
});
test('баланс: снаряжение решает — без покупок бот не берёт босса 3-го сектора, со снаряжением кампании — берёт', () => {
  let bare = 0, geared = 0;
  for (let s = 1; s <= 6; s++){ const c = E.create('normal'); c.mi = 8; if (playMission(PD, c, s, { maxT: 160 }).ok) bare++; }
  for (let s = 1; s <= 6; s++){ const c = E.create('normal'); c.mi = 8; c.money = 26000; shop(PD, c); if (playMission(PD, c, s, { maxT: 160 }).ok) geared++; }
  console.log('     босс 3-го сектора: без покупок ' + bare + '/6, со снаряжением ' + geared + '/6');
  ok(bare <= 1, 'без покупок слишком легко'); ok(geared >= 4, 'со снаряжением слишком сложно');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
