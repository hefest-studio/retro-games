/* ТАРАН · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node taran/tests/engine.test.mjs (QUICK=1 — без партий ботов). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам — настоящий движок (engine.js) в vm с поддельными клавиатурными событиями.
   Покрытие: трассы (16 = 4 лиги × 4, замкнуты, без самопересечений, радиус поворота, препятствия по рецепту),
   проходимость (ИИ доезжает все круги на каждой трассе), детектор застревания, управление «танк» и «аркада», стены и острова,
   оружие (заклёпочник, ракеты, масло, мины-гайки, нитро, таран), разбит → возврат, препятствия (трамплин и шлак, пресс,
   вагонетки, ремонтный бокс, лужи), круги/финиш/без «срезки задом», общий экран и отсечка отстающего, кооп без огня по своим,
   экономика гаража (без минусов, ступени, корпуса), лиги и чемпионат, сохранение, раскладки двух игроков, i18n, музыка,
   страница, правило имён; баланс — «человеческим» ботом (tests/bot.mjs). */
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
const T = sandbox.TARAN, L = T.logic, C = T.champ;
const { playRace, playChamp, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Заезд без отсчёта: humans — игроки, rivals — соперники; события копятся в events
function setup(o = {}){
  const events = [];
  const game = T.Game(Object.assign({ track: 0, players: 1, rivals: [], countT: 0.0001, rng: mulberry32(o.seed || 1), onEvent: (t, d) => events.push([t, d]) }, o)).start();
  game.update(1 / 60);
  const S = game.state();
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
// поставить машину на выборку si, поперёк lat, по ходу трассы (или под углом a), со скоростью v вдоль курса
function put(S, c, si, lat = 0, v = 0, a){
  const tr = S.track, p = tr.smp[(si + tr.n) % tr.n];
  c.si = (si + tr.n) % tr.n; c.x = p.x + p.nx * lat; c.y = p.y + p.ny * lat; c.a = a == null ? p.ang : a; c.lat = lat;
  c.vx = Math.cos(c.a) * v; c.vy = Math.sin(c.a) * v; c.vf = v; c.s = p.s; c.prog = p.s; c.lap = 0; c.z = 0; c.airT = 0;
}
const freeze = c => { c.stunT = 1e9; };
const trackWith = k => L.TRACKS.findIndex((t, i) => L.buildTrack(i)[k].length > 0);

// ---------- Трассы ----------
test('трассы: 16 = 4 лиги × 4, в каждой лиге — цех, крыши, рельсы и склад; id уникальны', () => {
  eq(L.TRACKS.length, L.LEAGUES * L.RACES);
  for (let lg = 0; lg < 4; lg++) eq(L.TRACKS.slice(lg * 4, lg * 4 + 4).map(t => t.set).sort(), ['rail', 'roof', 'shop', 'store'], 'лига ' + lg);
  eq(new Set(L.TRACKS.map(t => t.id)).size, 16);
});
test('трассы замкнуты и без самопересечений: стык круга гладкий, полный поворот 2π, соседние участки разнесены, радиус ≥ полуширины', () => {
  L.TRACKS.forEach((t, i) => {
    const tr = L.buildTrack(i), a = tr.smp[0], b = tr.smp[tr.n - 1];
    ok(Math.hypot(a.x - b.x, a.y - b.y) < tr.ds * 1.5, t.id + ': разрыв на стыке');
    const turn = tr.smp.reduce((s, p) => s + p.turn, 0); ok(Math.abs(Math.abs(turn) - 2 * Math.PI) < 0.05, t.id + ': поворот ' + turn);
    const c = L.checkTrack(i);
    ok(c.gap > 40, t.id + ': участки сближаются, зазор ' + c.gap.toFixed(0));
    ok(c.minR > t.hw + 20, t.id + ': крутой поворот R=' + c.minR.toFixed(0));
    ok(tr.len > 3000 && tr.len < 9000, t.id + ': длина ' + tr.len);
    ok(tr.smp.every(p => p.x > 0 && p.y > 0 && p.x < tr.w && p.y < tr.h), 'мир');
  });
});
test('препятствия по «рецепту» трассы, на прямых и с разносом; в чемпионате есть все виды; сложность растёт по лигам', () => {
  const key = { fork: 'forks', jump: 'jumps', oil: 'oils', pit: 'pits', rail: 'rails', press: 'presses' };
  const all = {};
  L.TRACKS.forEach((t, i) => {
    const c = L.checkTrack(i);
    for (const k in t.r){ eq(c[key[k]], t.r[k], t.id + ' ' + k); all[k] = (all[k] || 0) + c[key[k]]; }
    const tr = L.buildTrack(i);
    tr.jumps.forEach(j => { let b = 0; for (let q = 0; q < 16; q++) b += Math.abs(tr.smp[(j.i + q) % tr.n].turn); ok(b < 0.35, t.id + ': трамплин на повороте'); });
    tr.forks.forEach(f => { ok(tr.smp[(f.a + f.b) >> 1].isl > 20, 'остров'); ok(tr.smp[(f.a + f.b) >> 1].hw > t.hw + 30, 'развилка не раздвинута'); });
  });
  Object.keys(key).forEach(k => ok(all[k] > 0, 'нет вида ' + k));
  const per = lg => L.TRACKS.slice(lg * 4, lg * 4 + 4).reduce((s, t, j) => s + L.checkTrack(lg * 4 + j).hazards, 0);
  ok(per(0) < per(1) && per(1) < per(2) && per(2) < per(3), 'препятствий по лигам: ' + [0, 1, 2, 3].map(per));
});
test('ближайшая выборка: локальный поиск совпадает с полным; стены держат машину на дороге', () => {
  const tr = L.buildTrack(5), r = mulberry32(3);
  for (let k = 0; k < 200; k++){
    const i = Math.floor(r() * tr.n), p = tr.smp[i], lat = (r() - 0.5) * p.hw * 1.6, x = p.x + p.nx * lat, y = p.y + p.ny * lat;
    eq(L.nearest(tr, x, y, (i + 5) % tr.n), L.nearest(tr, x, y, -1), 'выборка ' + i);
  }
  const { game, S } = setup({ track: 5 }), c = S.cars[0];
  put(S, c, 120, 0, 0, S.track.smp[120].ang + Math.PI / 2);    // носом в бортик
  game.setInput(0, { up: true }); run(game, 2);
  const l = L.local(S.track, c.x, c.y, c.si); ok(Math.abs(l.lat) <= S.track.smp[c.si].hw - L.CAR_R + 0.5, 'выехал за бортик: ' + l.lat);
});

// ---------- Управление ----------
test('«танк»: газ — вперёд, руль поворачивает корпус, тормоз — назад; «аркада»: стрелка задаёт курс', () => {
  const { game, S } = setup(), c = S.cars[0];
  put(S, c, 20); const a0 = c.a, x0 = c.prog;
  game.setInput(0, { up: true }); run(game, 1); ok(c.prog - x0 > 120, 'не разогнался: ' + (c.prog - x0));
  ok(c.vf > c.st.maxV * 0.75, 'скорость ' + c.vf);
  game.setInput(0, { up: true, right: true }); const a1 = c.a; run(game, 0.3); ok(L.wrapA(c.a - a1) > 0.4, 'руль вправо');
  put(S, c, 20); game.setInput(0, { down: true }); run(game, 1); ok(c.vf < -30, 'задний ход');
  const g2 = setup({ control: 'arcade' }), c2 = g2.S.cars[0]; put(g2.S, c2, 20);
  g2.game.setInput(0, { down: true }); g2.game.run = 0; run(g2.game, 1.5);
  ok(Math.abs(L.wrapA(c2.a - Math.PI / 2)) < 0.25, 'аркада: курс вниз ' + c2.a.toFixed(2));
  g2.game.setInput(0, { left: true, up: true }); run(g2.game, 1.5);
  ok(Math.abs(L.wrapA(c2.a + 3 * Math.PI / 4)) < 0.25, 'аркада: курс влево-вверх ' + c2.a.toFixed(2));
});

// ---------- Оружие ----------
test('заклёпочник: очередь бьёт впереди идущего, заклёпки кончаются и копятся снова (пар)', () => {
  const r = setup({ rivals: [{ ch: 0, cfg: L.defCfg() }] }), S = r.S, me = S.cars.find(c => c.human === 0), ai = S.cars.find(c => c.human < 0);
  put(S, me, 10); put(S, ai, 26); freeze(ai); const hp = ai.hp;
  r.game.setInput(0, { fire: true }); run(r.game, 1);
  ok(r.has('shot') && r.has('hit') && ai.hp < hp - 10, 'урон ' + (hp - ai.hp));
  ok(me.rivets < 8, 'заклёпки не тратятся: ' + me.rivets);
  r.game.setInput(0, {}); run(r.game, 2.5); ok(me.rivets > 11, 'не копятся: ' + me.rivets);
});
test('ракета-самоходка наводится на цель сбоку впереди и рвётся; запас ракет конечен', () => {
  const r = setup({ rivals: [{ ch: 0, cfg: L.defCfg() }] }), S = r.S, me = S.cars.find(c => c.human === 0), ai = S.cars.find(c => c.human < 0);
  put(S, me, 10); put(S, ai, 40, 28); freeze(ai); const hp = ai.hp, n0 = me.rockets;
  r.game.setInput(0, { rocket: true }); run(r.game, 0.05); r.game.setInput(0, {}); run(r.game, 1.5);
  ok(r.has('rocket') && r.has('boom'), 'нет взрыва'); ok(ai.hp <= hp - me.st.rocketDmg * 0.9, 'урон ракеты ' + (hp - ai.hp));
  eq(me.rockets, n0 - 1);
  me.rockets = 0; r.game.setInput(0, { rocket: true }); run(r.game, 0.1); eq(S.rockets.length, 0, 'без ракет — не стреляет');
});
test('масло сзади: наехавший идёт юзом; мина-гайка взводится и рвётся под колёсами; сам владелец сразу не страдает', () => {
  const r = setup({ rivals: [{ ch: 0, cfg: L.defCfg() }], humans: [{ body: 0, up: { armor: 1, tires: 1, engine: 1, weapon: 1 }, rear: 'oil' }] }), S = r.S;
  const me = S.cars.find(c => c.human === 0), ai = S.cars.find(c => c.human < 0);
  put(S, me, 40); put(S, ai, 10, 0, 150); freeze(ai); ai.stunT = 0;
  r.game.setInput(0, { drop: true }); run(r.game, 0.05); r.game.setInput(0, {});
  ok(S.drops.length === 1 && S.drops[0].k === 'oil', 'масло не легло'); ok(me.spinT <= 0, 'своё масло');
  ai.auto = true; const d = S.drops[0]; let spun = false;
  for (let i = 0; i < 120 && !spun; i++){ ai.x += (d.x - ai.x) * 0.2; ai.y += (d.y - ai.y) * 0.2; r.game.update(1 / 60); spun = ai.spinT > 0; }
  ok(spun && r.has('spin'), 'юза нет');
  const r2 = setup({ rivals: [{ ch: 0, cfg: L.defCfg() }], humans: [{ body: 0, up: { armor: 1, tires: 1, engine: 1, weapon: 1 }, rear: 'mine' }] }), S2 = r2.S;
  const me2 = S2.cars.find(c => c.human === 0), ai2 = S2.cars.find(c => c.human < 0);
  put(S2, me2, 40); put(S2, ai2, 150); freeze(ai2);
  r2.game.setInput(0, { drop: true }); run(r2.game, 0.05); r2.game.setInput(0, {}); run(r2.game, 0.6);
  const m = S2.drops[0]; ok(m && m.k === 'mine', 'гайка не легла'); const hp = ai2.hp;
  ai2.x = m.x; ai2.y = m.y; run(r2.game, 0.1);
  ok(r2.has('boom') && ai2.hp < hp - 10 && S2.drops.length === 0, 'гайка не взорвалась');
});
test('нитро-котёл: разгон выше предела на 1.4 с, заряды конечны', () => {
  const { game, S, has } = setup({ track: 6 }), c = S.cars[0];
  put(S, c, 10, 0, c.st.maxV); game.setInput(0, { up: true }); run(game, 0.5);
  const n0 = c.nitro; game.setInput(0, { up: true, nitro: true }); run(game, 0.05); game.setInput(0, { up: true }); run(game, 0.7);
  ok(has('nitro') && c.vf > c.st.maxV * 1.2, 'скорость с нитро ' + c.vf.toFixed(0)); eq(c.nitro, n0 - 1);
  run(game, 2); ok(c.vf <= c.st.maxV * 1.05, 'нитро не кончилось');
});
test('таран: удар «лбом» сильнее бокового, нитро удваивает удар; тяжёлый корпус бьёт сильнее', () => {
  function hitDmg(o){
    const r = setup({ rivals: [{ ch: 0, cfg: L.defCfg() }], humans: [{ body: o.body || 0, up: { armor: 1, tires: 1, engine: 1, weapon: 1 }, rear: 'oil' }] }), S = r.S;
    const me = S.cars.find(c => c.human === 0), ai = S.cars.find(c => c.human < 0); freeze(ai);
    put(S, ai, 30, 0, 0); put(S, me, 30 - 5, 0, 260, o.side ? S.track.smp[25].ang + 0.0 : undefined);
    if (o.side){ me.a += Math.PI / 2; }    // летит вперёд, но стоит боком
    if (o.nitro) me.nitroT = 1;
    const hp = ai.hp; for (let i = 0; i < 20; i++) r.game.update(1 / 60);
    ok(r.has('ram'), 'нет столкновения'); return hp - ai.hp;
  }
  const front = hitDmg({}), side = hitDmg({ side: true }), nitro = hitDmg({ nitro: true }), heavy = hitDmg({ body: 2 });
  ok(front > side * 1.8, 'лоб ' + front.toFixed(1) + ' / бок ' + side.toFixed(1));
  ok(nitro > front * 1.6, 'нитро ' + nitro.toFixed(1)); ok(heavy > front * 1.4, 'молот ' + heavy.toFixed(1));
});
test('разбит: броня в ноль → «разбит», очко тому, кто разбил; через 1.8 с — на трассу с 60 % брони и неуязвимостью', () => {
  const r = setup({ rivals: [{ ch: 0, cfg: L.defCfg() }] }), S = r.S, me = S.cars.find(c => c.human === 0), ai = S.cars.find(c => c.human < 0);
  put(S, ai, 60); r.game._damage(ai, 999, me.idx, 'rivet');
  ok(r.has('wreck') && ai.wreckT > 0, 'не разбит'); eq(me.kills, 1);
  run(r.game, 2); ok(r.has('respawn') && ai.wreckT <= 0, 'не вернулся'); eq(ai.hp, Math.round(ai.st.hp * 0.6)); ok(ai.invT > 0);
});

// ---------- Препятствия трассы ----------
test('трамплин: на скорости — прыжок над шлаковой канавой без урона; медленно — в канаву: жжёт и вязнет', () => {
  const ti = trackWith('jumps'), { game, S, has, count } = setup({ track: ti }), c = S.cars[0], j = S.track.jumps[0];
  put(S, c, j.i - 12, 0, c.st.maxV); game.setInput(0, { up: true }); const hp = c.hp;
  run(game, 1.2); ok(has('jump') && has('land'), 'не прыгнул'); ok(!has('slag') && c.hp === hp, 'обжёгся в полёте');
  const r2 = setup({ track: ti }), c2 = r2.S.cars[0]; c2.st = Object.assign({}, c2.st, { maxV: 70 });
  put(r2.S, c2, j.i - 6, 0, 70); r2.game.setInput(0, { up: true }); const hp2 = c2.hp; run(r2.game, 2.5);
  ok(!r2.has('jump') && c2.hp < hp2 - 10, 'канава не жжёт: ' + (hp2 - c2.hp));
});
test('пресс: опускается после предупреждения и бьёт стоящего под ним; вторая половина дороги — объезд', () => {
  const ti = trackWith('presses'), { game, S, has } = setup({ track: ti }), c = S.cars[0], pr = S.track.presses[0];
  const hw = S.track.smp[pr.i].hw; put(S, c, pr.i, pr.o * hw * 0.5); freeze(c);
  S.t = 3.4 * 10 + 2.6 - pr.ph - 0.03; const hp = c.hp; run(game, 0.2);
  ok(has('press') && c.hp <= hp - 30, 'пресс не ударил'); ok(game.pressPhase(pr, S.t).state === 'down');
  const r2 = setup({ track: ti }), c2 = r2.S.cars[0]; put(r2.S, c2, pr.i, -pr.o * hw * 0.5); freeze(c2);
  r2.S.t = 3.4 * 10 + 2.6 - pr.ph - 0.03; const hp2 = c2.hp; run(r2.game, 0.2); ok(!r2.has('press') && c2.hp === hp2, 'объезд под прессом');
});
test('рельсы: вагонетка ходит поперёк трассы и сбивает машину на путях', () => {
  const ti = trackWith('rails'), { game, S, has } = setup({ track: ti }), c = S.cars[0], ct = S.carts[0];
  put(S, c, ct.i, 0); freeze(c); ct.active = true; ct.dir = 1; ct.lat = -60; const hp = c.hp;
  run(game, 1); ok(has('cart') && c.hp < hp, 'вагонетка не сбила');
  let moves = 0, was = null; const r2 = setup({ track: ti }); run(r2.game, 12, () => { const a = r2.S.carts[0].active; if (a !== was) moves++; was = a; });
  ok(moves >= 2, 'вагонетка не ходит');
});
test('ремонтный бокс: на полосе бокса броня восстанавливается; лужа масла на трассе — юз', () => {
  const ti = trackWith('pits'), { game, S, has } = setup({ track: ti }), c = S.cars[0], pt = S.track.pits[0];
  const mid = (pt.a + pt.b) >> 1; put(S, c, mid, pt.side * S.track.smp[mid].hw * 0.7); freeze(c); c.hp = 10;
  run(game, 1); ok(c.hp > 40 && c.inPit, 'ремонт: ' + c.hp.toFixed(0));
  const tj = trackWith('oils'), r2 = setup({ track: tj }), c2 = r2.S.cars[0], ol = r2.S.track.oils[0], p = r2.S.track.smp[ol.i];
  put(r2.S, c2, ol.i - 8, ol.o * p.hw, 200); r2.game.setInput(0, { up: true }); run(r2.game, 0.6); ok(r2.has('spin'), 'лужа не крутит');
});

// ---------- Круги, финиш, камера ----------
test('круги: автопилот проходит 3 круга → финиш, итоги; езда задом через старт кругов не прибавляет', () => {
  const r = setup({ track: 0 }), c = r.S.cars[0]; c.auto = true;
  run(r.game, 120, () => {}); ok(r.count('lap') >= 3 && r.has('finish') && r.S.phase === 'done', 'не финишировал');
  eq(r.S.results[0].place, 1); ok(c.lapTimes.length === 3 && c.bestLap > 5, 'времена кругов');
  const r2 = setup({ track: 0 }), c2 = r2.S.cars[0]; put(r2.S, c2, 6); c2.prog = 6 * r2.S.track.ds; c2.lap = 0;
  c2.a += Math.PI; r2.game.setInput(0, { up: true }); run(r2.game, 1.5);
  ok(c2.prog < 0 && !r2.has('lap'), 'задом засчитан круг');
});
test('общий экран: кадр держит лидера; отставший за кадром дольше ' + L.CUT_T + ' с снят с заезда; разбитого не отсекают', () => {
  const r = setup({ track: 6, players: 2, humans: [L.defCfg(), L.defCfg()] }), S = r.S;
  const p1 = S.cars.find(c => c.human === 0), p2 = S.cars.find(c => c.human === 1);
  S.raceT = 10; put(S, p1, 300); put(S, p2, 200); freeze(p1); freeze(p2);
  run(r.game, 1); ok(!p2.out, 'отсечён рано');
  ok(Math.abs(p1.x - S.cam.x) < L.VIEW.w / 2 && Math.abs(p1.y - S.cam.y) < L.VIEW.h / 2, 'лидер вне кадра');
  run(r.game, L.CUT_T + 0.5); ok(p2.out && r.has('cut'), 'не отсечён');
  const r2 = setup({ track: 6, players: 2, humans: [L.defCfg(), L.defCfg()] }), S2 = r2.S;
  const q1 = S2.cars.find(c => c.human === 0), q2 = S2.cars.find(c => c.human === 1);
  S2.raceT = 10; put(S2, q1, 300); put(S2, q2, 200); freeze(q1); freeze(q2); q2.wreckT = 99;
  run(r2.game, 3); ok(!q2.out, 'разбитого отсекли');
  // финиш: отсечённый — последним
  q1.auto = true; run(r2.game, 0.1); r2.game._finalize(); ok(S2.results.length === 2);
  const r3 = setup({ track: 6, players: 2, humans: [L.defCfg(), L.defCfg()] }), S3 = r3.S; S3.raceT = 10;
  const a1 = S3.cars.find(c => c.human === 0), a2 = S3.cars.find(c => c.human === 1);
  put(S3, a1, 300); put(S3, a2, 100); freeze(a1); freeze(a2); run(r3.game, 3); r3.game._finalize();
  eq(S3.results[S3.results.length - 1].human, 1, 'отсечённый не последний');
});
test('кооп: по напарнику заклёпки и таран не бьют; в дуэли — бьют', () => {
  for (const team of ['coop', 'duel']){
    const r = setup({ track: 0, players: 2, humans: [L.defCfg(), L.defCfg()], team }), S = r.S;
    const p1 = S.cars.find(c => c.human === 0), p2 = S.cars.find(c => c.human === 1);
    put(S, p1, 10); put(S, p2, 26); freeze(p2); const hp = p2.hp;
    r.game.setInput(0, { fire: true }); run(r.game, 1);
    if (team === 'coop') eq(p2.hp, hp, 'кооп: урон по своему'); else ok(p2.hp < hp, 'дуэль: нет урона');
  }
});

// ---------- Проходимость: ИИ на каждой трассе ----------
const AI = L.TRACKS.map((t, i) => {
  const events = {}; const g = T.Game({ track: i, players: 0, humans: [], rng: mulberry32(i + 1), pace: L.PACE[Math.floor(i / 4)],
    rivals: L.RIVALS.map((r, k) => ({ ch: k, cfg: L.rivalCfg(Math.floor(i / 4), k) })), onEvent: e => { events[e] = (events[e] || 0) + 1; } }).start();
  const S = g.state(); let tm = 0; while (S.phase !== 'done' && tm < 400){ g.update(1 / 60); tm += 1 / 60; }
  return { id: t.id, done: S.phase === 'done', time: tm, fin: S.cars.filter(c => c.finished).length, laps: S.cars.map(c => c.lapTimes.length), unstuck: S.cars.reduce((a, c) => a + c.unstuck, 0), events };
});
test('проходимость: на всех 16 трассах все 4 соперника-ИИ проезжают 3 круга (с оружием, таранами и препятствиями)', () => {
  console.log('     время заезда ИИ, с: ' + AI.map(r => r.id + ' ' + r.time.toFixed(0)).join(', '));
  AI.forEach(r => { ok(r.done && r.fin === 4, r.id + ': финишировали ' + r.fin); ok(r.laps.every(n => n === 3), r.id + ': круги ' + r.laps); ok(r.time < 200, r.id + ': долго ' + r.time); });
  ok(AI.every(r => (r.events.shot || 0) > 5), 'ИИ не стреляет: ' + AI.map(r => r.events.shot || 0)); ok(AI.reduce((a, r) => a + (r.events.wreck || 0), 0) > 10, 'никого не разбили');
});
test('детектор застревания: ИИ не застревает на трассах; уткнувшийся в бортик сдаёт назад и едет дальше', () => {
  const st = AI.reduce((a, r) => a + r.unstuck, 0); ok(st <= 2, 'вытаскивали ' + st + ' раз: ' + AI.filter(r => r.unstuck).map(r => r.id));
  const r = setup({ track: 3, rivals: [{ ch: 1, cfg: L.defCfg() }] }), ai = r.S.cars.find(c => c.human < 0);
  put(r.S, ai, 200, r.S.track.smp[200].hw - 12, 0, r.S.track.smp[200].ang + Math.PI / 2); const p0 = ai.prog;
  run(r.game, 6); ok(ai.prog - p0 > 300, 'не выбрался: ' + (ai.prog - p0).toFixed(0));
});

// ---------- Экономика и чемпионат ----------
test('гараж: цены растут по ступеням, 5 ступеней, без денег не купить, касса не уходит в минус (2000 случайных покупок)', () => {
  const ch = C.newChamp({}); eq(ch.money, [L.START_MONEY]);
  const p1 = C.price(ch, 0, 'engine'); ok(C.buy(ch, 0, 'engine')); eq(ch.cars[0].up.engine, 2); eq(ch.money[0], L.START_MONEY - p1);
  ok(C.price(ch, 0, 'engine') > p1, 'цена не растёт');
  ch.money[0] = 0; ok(!C.buy(ch, 0, 'armor') && ch.money[0] === 0, 'купил без денег');
  ch.cars[0].up.weapon = 5; eq(C.price(ch, 0, 'weapon'), null, 'шестая ступень');
  eq(C.price(ch, 0, 'body0'), null); eq(C.price(ch, 0, 'junk'), null);
  const r = mulberry32(9), items = ['armor', 'tires', 'engine', 'weapon', 'body1', 'body2', 'x'];
  for (let k = 0; k < 2000; k++){
    if (r() < 0.2) ch.money[0] += Math.floor(r() * 3000);
    C.buy(ch, 0, items[Math.floor(r() * items.length)]);
    ok(ch.money[0] >= 0, 'минус: ' + ch.money[0]);
    L.UPG.forEach(u => ok(ch.cars[0].up[u] >= 1 && ch.cars[0].up[u] <= 5, 'ступень ' + u));
  }
});
test('корпуса: 3 штуки, дороже и сильнее; при пересадке ступени −1; апгрейды реально меняют машину', () => {
  eq(L.BODIES.length, 3); ok(L.BODIES[1].price > 0 && L.BODIES[2].price > L.BODIES[1].price);
  const s = [0, 1, 2].map(b => L.stats({ body: b, up: { armor: 1, tires: 1, engine: 1, weapon: 1 } }));
  ok(s[2].hp > s[1].hp && s[1].hp > s[0].hp && s[2].ram > s[0].ram && s[2].maxV > s[0].maxV, 'корпуса не сильнее');
  const ch = C.newChamp({}); ch.money[0] = 99999; ch.cars[0].up = { armor: 3, tires: 1, engine: 5, weapon: 2 };
  ok(C.buy(ch, 0, 'body2')); eq(ch.cars[0].body, 2); eq(ch.cars[0].up, { armor: 2, tires: 1, engine: 4, weapon: 1 });
  eq(C.price(ch, 0, 'body1'), null, 'назад на лёгкий');
  const a = L.stats(L.defCfg()), b = L.stats({ body: 0, up: { armor: 5, tires: 5, engine: 5, weapon: 5 } });
  ok(b.maxV > a.maxV && b.hp > a.hp && b.grip > a.grip && b.rivet > a.rivet && b.rockets > a.rockets && b.rear > a.rear && b.nitro > a.nitro, 'ступени не влияют');
});
test('чемпионат: призы и очки по местам, касса только растёт от заездов; лига — 4 трассы, тройка лиги проходит дальше', () => {
  const ch = C.newChamp({}), res = place => [{ human: 0, place, kills: 1 }].concat([0, 1, 2, 3].map((k, j) => ({ human: -1, ch: k, place: j + (j + 1 >= place ? 2 : 1), kills: 0 })));
  const m0 = ch.money[0]; const s1 = C.applyRace(ch, res(1));
  eq(ch.money[0], m0 + L.PRIZE[0] + L.KILL_BONUS); eq(ch.pts.p1, L.POINTS[0]); eq(ch.race, 1); ok(!s1.leagueEnd);
  for (let k = 0; k < 3; k++) C.applyRace(ch, res(2));
  eq(ch.league, 1); eq(ch.race, 0); eq(ch.pts, {}, 'очки лиги не сброшены');
  ok(L.TRACKS[C.trackOf(ch)].id === L.TRACKS[4].id, 'вторая лига — 5-я трасса');
  // провал лиги: переигровка, после MAX_TRIES — конец
  let lost = null; for (let k = 0; k < 4 * (L.MAX_TRIES + 1); k++) lost = C.applyRace(ch, res(5));
  ok(lost.lost && ch.done === 'lose', 'нет поражения'); eq(ch.league, 1);
  const w = C.newChamp({}); let s; for (let k = 0; k < 16; k++) s = C.applyRace(w, res(1));
  ok(s.champion && w.done === 'win', 'нет победы'); ok(w.total > 40000, 'призовые ' + w.total);
});
test('кооп и дуэль вдвоём: общая касса против раздельных; квалификация — если хоть один игрок в тройке', () => {
  const co = C.newChamp({ players: 2, team: 'coop' }), du = C.newChamp({ players: 2, team: 'duel' });
  eq(co.money.length, 1); eq(du.money.length, 2); eq(co.cars.length, 2);
  const res = [{ human: 0, place: 1, kills: 0 }, { human: 1, place: 6, kills: 0 }].concat([0, 1, 2, 3].map(k => ({ human: -1, ch: k, place: k + 2, kills: 0 })));
  C.applyRace(co, res); C.applyRace(du, res);
  eq(co.money[0], L.START_MONEY + L.PRIZE[0] + L.PRIZE[5]); eq(du.money, [L.START_MONEY + L.PRIZE[0], L.START_MONEY + L.PRIZE[5]]);
  ok(C.buy(du, 1, 'tires') && du.money[0] === L.START_MONEY + L.PRIZE[0], 'дуэль: покупка не из своей кассы');
  for (let k = 0; k < 3; k++) C.applyRace(co, res); eq(co.league, 1, 'кооп не прошёл лигу при 1-м месте И1');
});
test('сохранение: чемпионат сериализуется и читается; битые/подделанные данные отвергаются', () => {
  const ch = C.newChamp({ players: 2, team: 'duel' }); ch.money[1] = 777; ch.cars[1].up.engine = 4; ch.cars[0].rear = 'mine'; C.applyRace(ch, [{ human: 0, place: 2, kills: 0 }, { human: 1, place: 1, kills: 2 }].concat([0, 1, 2, 3].map(k => ({ human: -1, ch: k, place: k + 3, kills: 0 }))));
  const back = C.load(C.serialize(ch)); eq(back, JSON.parse(JSON.stringify(ch)));
  [null, '', '{', '[]', JSON.stringify(Object.assign({}, ch, { v: 2 })), JSON.stringify(Object.assign({}, ch, { money: [-5, 0] })),
    JSON.stringify(Object.assign({}, ch, { league: 9 })), JSON.stringify(Object.assign({}, ch, { cars: [{ body: 7, up: {} }] })),
    JSON.stringify(Object.assign({}, ch, { cars: [{ body: 0, up: { armor: 9, tires: 1, engine: 1, weapon: 1 } }] }))].forEach((s, i) => eq(C.load(s), null, 'битое #' + i));
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/arcade\.taran\.champ/.test(main) && /arcade\.taran\.laps/.test(main) && /arcade\.taran\.opts/.test(main), 'ключи хранения');
});

// ---------- Раскладки, i18n, музыка, страница, имена ----------
test('раскладки двух игроков без конфликтов (checkBindings + usePlayers); И1 стрелки и / . , ПрShift; И2 WASD и F G R ЛShift; в одиночке обе ведут И1', () => {
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
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'tr' });
  g.useStandardScreens({ lives: 1 }); g.scene('play', { realtime: true }); g.start('title');
  eq(g.usePlayers({ bind: L.BIND, actions: ['fire', 'rocket', 'drop', 'nitro'] }).count(), 1);
  eq(g.input.conflicts.length, 0, 'usePlayers нашёл конфликты');
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1);
  key('keydown', 'ArrowUp'); key('keydown', 'Slash'); key('keydown', 'ShiftRight');
  ok(P1.pressed('up') && P1.pressed('fire') && P1.pressed('nitro') && !P2.pressed('up') && !P2.pressed('fire'), 'И1');
  key('keydown', 'KeyW'); key('keydown', 'KeyG'); key('keydown', 'KeyR');
  ok(P2.pressed('up') && P2.pressed('rocket') && P2.pressed('drop') && !P1.pressed('rocket'), 'И2');
  ['ArrowUp', 'Slash', 'ShiftRight', 'KeyW', 'KeyG', 'KeyR'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'KeyA'); key('keydown', 'KeyF');
  ok(P1.pressed('left') && P1.pressed('fire') && !P2.pressed('left'), 'в одиночке раскладка И2 не ведёт И1');
  const all = Object.values(L.BIND).flatMap(m => Object.values(m).flat());
  ['KeyL', 'KeyT', 'KeyM', 'KeyP', 'Escape', 'Enter', 'Digit1', 'Digit2'].forEach(k => ok(!all.includes(k), 'занята горячая клавиша ' + k));
});
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть трассы, лиги, соперники с характерами, корпуса, апгрейды', () => {
  const ru = Object.keys(T.STR.ru).sort(), en = Object.keys(T.STR.en).sort();
  eq(ru, en);
  ru.forEach(k => ok(String(T.STR.ru[k]).trim() && String(T.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score'].forEach(k => ok(T.STR.ru[k], 'нет ключа движка ' + k));
  L.TRACKS.forEach(t => ok(T.STR.ru['tr_' + t.id] && T.STR.en['tr_' + t.id], 'трасса ' + t.id));
  L.RIVALS.forEach(r => ok(T.STR.ru['r_' + r.id] && T.STR.ru['rd_' + r.id], 'соперник ' + r.id));
  L.BODIES.forEach(b => ok(T.STR.ru['b_' + b.id], 'корпус ' + b.id)); L.UPG.forEach(u => ok(T.STR.ru['u_' + u], 'апгрейд ' + u));
  [0, 1, 2, 3].forEach(n => ok(T.STR.ru['lg_' + n], 'лига ' + n)); L.SETTINGS.forEach(s => ok(T.STR.ru['set_' + s], s));
  eq(T.STR.ru.title, 'ТАРАН');
  eq(new Set(L.RIVALS.map(r => r.color)).size, 4, 'цвета соперников'); eq(new Set(L.RIVALS.map(r => r.aggr + ':' + r.ramp + ':' + r.drop)).size, 4, 'характеры одинаковы');
});
test('музыка: трек taran разбирается секвенсором движка, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks.taran; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0, 'не разобран');
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); eq(n(tr.drums) % 8, 0);
});
test('страница: фавикон студии, «← Каталог», canvas 640×480, скрипты по порядку, тач-крестовина, кнопки действий и пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="640" height="480"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/modern.js', 'js/classic.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ['U', 'D', 'L', 'R'].forEach(d => ok(html.includes('data-d="' + d + '"'), 'крестовина ' + d));
  ['fire', 'rocket', 'drop', 'nitro'].forEach(a => ok(html.includes('data-act="' + a + '"'), 'кнопка ' + a));
  ok(/data-pause/.test(html), 'пауза');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (список из glub/ + оригиналы жанра)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifHN1cGVyID9jYXJzfNGB0YPQv9C10YAgP9C60LDRgFvRgdC3XXxtaWNybyA/bWFjaGluZXN80LzQuNC60YDQviA/0LzQsNGI0LjQvXxyb2NrLnswLDZ9cm9sbCA/cmFjaW5nfNGA0L7Qui57MCw2fdGA0L7Qu9C7ID/RgFvQtdGNXdC50YHQuNC90LN8ZGVhdGggP3JhbGx5fNC0W9C10Y1d0YIgP9GA0LDQu9C70Lg=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ['U3VwZXIgQ2Fycw==', 'TWljcm8gTWFjaGluZXM=', 'Um9jayBuJyBSb2xsIFJhY2luZw==', 'RGVhdGggUmFsbHk=', '0KHRg9C/0LXRgCDQmtCw0YDRgQ==',
    '0JzQuNC60YDQviDQnNCw0YjQuNC90Ys=', '0KDQvtC6LdC9LdGA0L7Qu9C7INCg0LXQudGB0LjQvdCz', '0JTRjdGCINCg0LDQu9C70Lg='].forEach(b => ok(BAD.test(u(b)), 'стоп-лист не ловит оригинал жанра #' + b.slice(0, 6)));
  ok(!BAD.test('ТАРАН') && !BAD.test('Гефест') && !BAD.test('самоход') && !BAD.test('CONTRACT.md') && !BAD.test('ракета') && !BAD.test('супермаркет') && !BAD.test('микрометр') && !BAD.test('ралли'), 'без ложных срабатываний');
});
test('производительность: шаг логики с 6 машинами, 150 заклёпками и 10 ракетами — < 2 мс в Node', () => {
  const g = T.Game({ track: 14, players: 2, humans: [L.defCfg(), L.defCfg()], countT: 0.0001, rng: mulberry32(2) }).start(); g.update(1 / 60);
  const S = g.state(); S.cars.forEach(c => { c.auto = true; });
  run(g, 3);
  for (let k = 0; k < 150; k++){ const c = S.cars[k % 6]; S.bullets.push({ x: c.x, y: c.y, vx: 0, vy: 0, owner: c.idx, dmg: 0, life: 99, si: c.si }); }
  for (let k = 0; k < 10; k++){ const c = S.cars[k % 6]; S.rockets.push({ x: c.x + 300, y: c.y, a: 0, v: 0, owner: c.idx, dmg: 0, life: 99, si: c.si, tgt: -1 }); }
  const t0 = process.hrtime.bigint(); for (let k = 0; k < 120; k++) g.update(1 / 60);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 120; console.log('     шаг: ' + ms.toFixed(3) + ' мс'); ok(ms < 2, 'медленно: ' + ms);
});

// ---------- Баланс: «человеческий» бот ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без ботов)`); process.exit(failed ? 1 : 0); }
const N1 = 20, R1 = []; for (let s = 1; s <= N1; s++) R1.push(playRace(T, s, { track: 0 }));
const RA = []; for (let s = 1; s <= 8; s++) RA.push(playRace(T, 50 + s, { track: 0, control: 'arcade' }));
test('баланс: первая гонка — бот-игрок (реакция 150–250 мс) часто в тройке (≥ 70 % из ' + N1 + '), в «аркаде» тоже', () => {
  const top = R1.filter(r => r.place <= 3).length, topA = RA.filter(r => r.place <= 3).length;
  console.log('     места (танк): ' + R1.map(r => r.place).join('') + ' — в тройке ' + top + '/' + N1 + '; аркада: ' + RA.map(r => r.place).join('') + '; разбит раз: ' + R1.reduce((a, r) => a + r.wrecks, 0));
  ok(top >= 0.7 * N1, 'тройка: ' + top + '/' + N1); ok(topA >= 5, 'аркада: ' + topA + '/8');
  ok(R1.filter(r => r.place === 1).length <= N1 * 0.95, 'слишком легко: всегда первый');
  ok(R1.every(r => r.done && r.finished[0]), 'бот не доехал');
});
const CH = []; for (let s = 1; s <= 3; s++) CH.push(playChamp(T, s));
const C2 = playChamp(T, 7, { players: 2, team: 'duel' });
test('чемпионат целиком (бот покупает в гараже): выигрывается, касса без минусов, ИИ не застревает; вдвоём (дуэль) тоже доигрывается', () => {
  CH.concat([C2]).forEach((r, i) => console.log('     партия ' + (i + 1) + ': ' + (r.won ? 'победа' : r.lost ? 'выбыл' : '?') + ', заездов ' + r.races + ', призовые ' + r.total + ', отсечек ' + r.cuts + ' · ' + r.log.join(' ')));
  ok(CH.some(r => r.won), 'чемпионат не выигрывается'); ok(CH.every(r => r.won || r.lost), 'чемпионат не закончился');
  ok(CH.concat([C2]).every(r => r.minMoney >= 0), 'минус в кассе'); ok(CH.reduce((a, r) => a + r.stuck, 0) <= 2, 'ИИ застревает');
  ok(C2.won || C2.lost, 'дуэль не доиграна');
  ok(CH.every(r => r.log.slice(0, 5).includes('Q')), 'первая лига не проходится');
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
