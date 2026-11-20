/* ОТБОЙНИК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node otboynik/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) — в node:vm с шимом window.
   Покрытие: поле и пуск шара, подшаги/CCD (шар не проходит сквозь флипперы и стенки ни на какой скорости — до 20 000 px/с),
   удар флиппером, слив и ворота, механизмы (жук, тележка, стрекоза, таран), постройки (горн, колокольня, пружинная стенка,
   магнит, делитель), колода карт и улучшения, тилт с лимитом, волны и босс, защита от застревания, детерминизм,
   производительность, i18n, музыка (8–16 тактов, > 30 нот в окне), страница, правило имён (стоп-лист в base64);
   проходимость — «человеческим» ботом (tests/bot.mjs, реакция 150–250 мс). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/game.js', 'js/i18n.js', 'js/meta.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const G = sandbox.OTBOYNIK, L = G.logic;
const { playOtboynik, mulberry32 } = await import('./bot.mjs');
const { checkLangs } = await import('./langs.check.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Игра в фазе волны без врагов: баннер держим, чтобы никто не появлялся и волна не заканчивалась
function mk(opts = {}){
  const events = [];
  const game = G.Game(Object.assign({ seed: opts.seed || 1, onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S; game._beginWave(); S.queue = []; S.enemies = []; S.banner = 1e9; S.boss = null;
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
function ball(S, x, y, vx, vy){ const b = { x, y, vx, vy, fire: 0, still: 0, id: 99, trail: [] }; S.balls = [b]; return b; }
function upN(f){ const c = Math.cos(f.ang), s = Math.sin(f.ang); let nx = s, ny = -c; if (ny > 0){ nx = -nx; ny = -ny; } return [nx, ny]; }
function sideOf(f, b){ const [nx, ny] = upN(f), c = Math.cos(f.ang), s = Math.sin(f.ang), t = (b.x - f.x) * c + (b.y - f.y) * s;
  return { s: (b.x - f.x) * nx + (b.y - f.y) * ny, t }; }
function inside(b){   // шар внутри стола (грубо: рама и дуга)
  const A = L.ARC; if (b.x < 20 - 1 || b.x > L.OUT_X + 1) return false;
  if (b.y < A.cy){ const dx = (b.x - A.cx) / A.rx, dy = (b.y - A.cy) / A.ry; if (dx * dx + dy * dy > 1.02) return false; }
  return true;
}

// ---------- Поле и пуск ----------
test('поле: шар подаётся в дорожку пуска, лежит на дне, пуск выводит его в поле через заслонку и обратно в дорожку не падает', () => {
  const { game, S, has } = mk();
  S.balls = []; game._serve(); run(game, 1);
  const b = S.balls[0]; ok(game.waiting(), 'шар не ждёт пуска'); ok(Math.abs(b.y - L.LAUNCH_POS.y) < 2 && b.x > L.LANE_X, 'шар не на дне дорожки');
  ok(game.launch() && has('launch'), 'пуск'); let out = false;
  run(game, 3, () => { if (S.balls[0] && S.balls[0].x < L.LANE_X - 20) out = true; });
  ok(out, 'шар не вышел в поле');
  // сверху на заслонку: скатывается в поле
  ball(S, 455, 170, 0, 200); run(game, 1.2); ok(S.balls[0].x < L.LANE_X || S.balls[0].y < 234, 'шар провалился в дорожку сверху: ' + S.balls[0].x.toFixed(0) + ',' + S.balls[0].y.toFixed(0));
});
test('подшаги: за подшаг шар и конец флиппера сдвигаются не больше 0.35 радиуса шара', () => {
  const { game, S } = mk({ maxV: 1e9 });
  for (const v of [300, 2000, 9000, 20000]){ ball(S, 240, 300, v * 0.6, -v * 0.8); game._physics(1 / 60); ok(v / 60 / S.substeps <= L.STEP_MAX + 1e-9, 'шар: ' + v); }
  ok(24 * 1.24 * L.FL_LEN / 60 / S.substeps <= L.STEP_MAX + 1e-9, 'флиппер');
});
test('CCD: шар не проходит сквозь флиппер на высокой скорости — 1 200…20 000 px/с, 3 угла, 7 точек, флиппер внизу/поднят/в замахе', () => {
  let cases = 0;
  for (const side of ['L', 'R']) for (const mode of ['rest', 'up', 'swing']) for (const v of [1200, 3000, 8000, 20000]) for (const t of [0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 0.97]) for (const da of [-0.5, 0, 0.5]){
    const { game, S } = mk({ maxV: 1e9 }), f = S.flip[side];
    if (mode === 'up'){ f.ang = f.up; game.setFlip(side, true); }
    if (mode === 'swing') f.ang = (f.rest + f.up) / 2;   // флиппер в середине замаха и продолжает подниматься навстречу шару
    const c = Math.cos(f.ang), s = Math.sin(f.ang), [nx, ny] = upN(f);
    const px = f.x + c * L.FL_LEN * t, py = f.y + s * L.FL_LEN * t;
    const ax = Math.cos(da) * -nx - Math.sin(da) * -ny, ay = Math.sin(da) * -nx + Math.cos(da) * -ny;   // направление на флиппер
    const back = v / 60 * 0.6 + 20, b = ball(S, px - ax * back, py - ay * back, ax * v, ay * v);
    if (mode === 'swing') game.setFlip(side, true);
    let prev = sideOf(f, b); ok(prev.s > 0, 'старт не над флиппером');
    for (let fr = 0; fr < 4; fr++){
      game._physics(1 / 60);
      const q = sideOf(f, b);   // переход «над → под» в пределах тела флиппера = проскок
      ok(!(prev.s > 0 && q.s < 0 && q.t > 0 && q.t < L.FL_LEN * 0.92), `${side}/${mode}/${v}/${t}/${da}: шар прошёл сквозь флиппер (кадр ${fr}, s=${q.s.toFixed(1)})`);
      prev = q;
    }
    if (da === 0 && t < 0.9) ok(b.vx * nx + b.vy * ny > 0 || b.y < py - 30, 'шар не отскочил');
    ok(inside(b) || b.y > 700, 'вылет за стол');
    cases++;
  }
  ok(cases === 2 * 3 * 4 * 7 * 3, 'случаев ' + cases);
});
test('CCD: стенки и дуга держат шар на 20 000 px/с в 24 направлениях', () => {
  for (let k = 0; k < 24; k++){
    const { game, S } = mk({ maxV: 1e9 }), a = k / 24 * Math.PI * 2, b = ball(S, 230, 360, Math.cos(a) * 20000, Math.sin(a) * 20000);
    for (let fr = 0; fr < 6; fr++){ game._physics(1 / 60); ok(inside(b) || b.y > 640, 'вылет: направление ' + k + ' (' + b.x.toFixed(0) + ',' + b.y.toFixed(0) + ')'); }
  }
});
test('флиппер: удар по лежащему шару отправляет его вверх быстрее 800 px/с; «кованые флипперы» бьют сильнее', () => {
  const sp = [];
  for (const lvl of [0, 2]){
    const { game, S } = mk(), f = S.flip.L; S.flipLvl = lvl;
    const c = Math.cos(f.ang), s = Math.sin(f.ang), [nx, ny] = upN(f), b = ball(S, f.x + c * 55 + nx * (L.BR + L.FL_R), f.y + s * 55 + ny * (L.BR + L.FL_R), 0, 0);
    game.setFlip('L', true); for (let i = 0; i < 6; i++) game._physics(1 / 60);
    ok(b.vy < -800, 'слабый удар: ' + b.vy.toFixed(0)); sp.push(Math.hypot(b.vx, b.vy));
  }
  ok(sp[1] > sp[0], 'улучшение не усилило удар');
});
test('слив: последний шар ушёл — ворота −1 и новый шар в дорожке; при мульти-шаре потеря одного бесплатна', () => {
  const { game, S, has } = mk(), hp = S.hp;
  ball(S, 240, 740, 0, 300); run(game, 0.2); ok(has('drain') && S.hp === hp - 1, 'нет штрафа'); ok(S.balls.length === 1 && S.balls[0].x > L.LANE_X, 'шар не подан');
  const m = mk(); ball(m.S, 240, 740, 0, 300); m.S.balls.push({ x: 200, y: 300, vx: 0, vy: 0, fire: 0, still: 0, id: 5, trail: [] });
  run(m.game, 0.2); ok(!m.has('drain') && m.S.hp === L.HP0, 'мульти-шар оштрафован');
});

// ---------- Механизмы ----------
test('механизмы: идут к воротам и бьют по ним (жук −1, тележка −2, таран −4); ворота на нуле — конец игры', () => {
  for (const [type, dmg] of [['beetle', 1], ['cart', 2], ['ram', 4], ['fly', 1]]){
    const { game, S, has } = mk(); S.balls = []; S.banner = 0; S.queue = []; const e = game._spawn(type, 100, 120); S.balls = [];
    let t = 0; while (!e.dead && t < 60){ game.update(1 / 60); t += 1 / 60; }
    ok(e.gated, type + ' не дошёл'); eq(S.hp, L.HP0 - dmg, type);
    ok(t > 8 && t < 45, type + ': путь ' + t.toFixed(1) + ' с');
  }
  const { game, S, has } = mk(); game._hurtGate(L.HP0); ok(S.phase === 'over' && has('gameover'));
});
test('шар бьёт механизмы: жук — с одного удара, тележке и тарану нужно 2 и 4; раскалённый шар — двойной урон и поджог', () => {
  for (const [type, hits] of [['beetle', 1], ['cart', 2], ['ram', 4]]){
    const { game, S, has } = mk(); S.banner = 0; const e = game._spawn(type, 240, 300); e.mul = 0;
    let n = 0; for (let i = 0; i < 8 && !e.dead; i++){ ball(S, 240, e.y + e.r + 40, 0, -900); run(game, 0.2); n++; }
    ok(e.dead, type + ' жив'); eq(n, hits, type + ' ударов');
  }
  const { game, S } = mk(); S.banner = 0; const e = game._spawn('ram', 240, 300); e.mul = 0;
  const b = ball(S, 240, 360, 0, -900); b.fire = 5; run(game, 0.15); eq(e.hp, 2, 'урон огнём'); ok(e.burn > 0, 'не горит');
  run(game, 2.2); ok(e.hp <= 0 || e.dead, 'поджог не дожёг: ' + e.hp);
});
test('флиппер-взмах сбивает механизм у ворот', () => {
  const { game, S, has } = mk(); S.banner = 0; S.balls = []; const e = game._spawn('beetle', 200, 666); e.mul = 0;
  game.setFlip('L', true); run(game, 0.1); ok(e.dead && has('kill'), 'жук цел');
});

// ---------- Постройки и карты ----------
function build(game, S, id, slot, lvl){ const sp = L.SLOTS[slot], B = { type: id, lvl: lvl || 1, slot, x: sp.x, y: sp.y, r: L.BUILD[id].r || 0, flash: 0, cd: 0, id: 500 + slot };
  if (L.BUILD[id].seg) Object.assign(B, L.springSeg(B)); S.buildings.push(B); return B; }
test('горн поджигает шар, колокольня оглушает механизмы в радиусе, пружинная стенка отбивает с силой', () => {
  let m = mk(); let B = build(m.game, m.S, 'forge', 4); let b = ball(m.S, B.x, B.y + 60, 0, -700); run(m.game, 0.2); ok(b.fire > 3 && m.has('ignite'), 'горн');
  m = mk(); B = build(m.game, m.S, 'bell', 4); const near = m.game._spawn('beetle', B.x + 60, B.y), far = m.game._spawn('beetle', 60, 140);
  b = ball(m.S, B.x, B.y + 60, 0, -700); run(m.game, 0.2); ok(near.stun > 0 && !(far.stun > 0) && m.has('bell'), 'колокольня');
  m = mk(); B = build(m.game, m.S, 'spring', 4); b = ball(m.S, B.x, B.y + 40, 0, -500); run(m.game, 0.2);
  ok(b.vy > 250 && m.has('bump'), 'пружина не отбила: ' + b.vy.toFixed(0));
});
test('магнит тянет шар и замедляет механизмы; делитель выпускает шары до предела уровня', () => {
  let m = mk(); const M = build(m.game, m.S, 'magnet', 4); const b = ball(m.S, M.x + 70, M.y, 0, 0); m.game._physics(1 / 60);
  ok(b.vx < -1, 'не тянет'); const e = m.game._spawn('beetle', M.x + 40, M.y - 60); m.S.banner = 0; m.S.balls = []; const y0 = e.y; e.mul = 1; m.game.update(1);
  ok(e.y - y0 < L.ENEMY.beetle.speed * 0.8 && e.slow > 0, 'не вязнет');
  m = mk(); const D = build(m.game, m.S, 'splitter', 4, 1); ball(m.S, D.x, D.y + 60, 0, -700); run(m.game, 0.2); eq(m.S.balls.length, 2, 'ур.1 — 2 шара');
  D.split = 0; m.S.balls.forEach(q => { q.x = D.x; q.y = D.y + 60; q.vx = 0; q.vy = -700; }); run(m.game, 0.2); ok(m.S.balls.length <= 2, 'превышен предел ур.1');
});
test('механизмы обходят постройки, а не проходят сквозь', () => {
  const { game, S } = mk(); S.balls = []; S.banner = 0; const B = build(game, S, 'forge', 4), P = build(game, S, 'spring', 1);
  const es = [game._spawn('beetle', B.x, 150), game._spawn('cart', B.x + 5, 120), game._spawn('beetle', P.x, 120)]; es.forEach(e => { e.tx = e.x; });
  for (let i = 0; i < 60 * 45; i++){ game.update(1 / 60);
    es.forEach(e => { if (e.dead) return; ok(Math.hypot(e.x - B.x, e.y - B.y) > B.r + e.r - 2, 'внутри горна');
      const q = L.closest(P.a[0], P.a[1], P.b[0], P.b[1], e.x, e.y); ok(Math.hypot(e.x - q[0], e.y - q[1]) > e.r + 2, 'сквозь пружину'); }); }
  ok(es.every(e => e.dead), 'механизмы застряли');
});
test('колода: 3 разные карты; постройка → выбор места → на поле; улучшение до ур.3, дальше не предлагается; ремонт не выше предела', () => {
  const game = G.Game({ seed: 3 }).start(), S = game._S;
  for (let k = 0; k < 40; k++){ game._offer(); eq(new Set(S.offer.map(c => c.id)).size, S.offer.length, 'дубли'); ok(S.offer.length === 3, 'карт ' + S.offer.length); }
  S.offer = [{ id: 'forge', kind: 'build', lvl: 1 }]; S.sel = 0; ok(game.confirm() && S.phase === 'slot', 'нет выбора места');
  game.moveSel(1); const sl = S.slotSel; ok(game.confirm() && S.phase === 'wave', 'не поставлено'); eq(S.buildings[0].slot, sl); ok(!game.placeSlot(sl), 'занято');
  for (let i = 0; i < 5; i++){ S.phase = 'cards'; S.offer = [{ id: 'forge', kind: 'up', lvl: 2 }]; game.chooseCard(0); }
  for (let k = 0; k < 40; k++){ game._offer(); ok(!S.offer.some(c => c.id === 'forge'), 'горн ур.' + S.buildings[0].lvl + ' предложен'); }
  S.hp = S.hpMax - 1; S.phase = 'cards'; S.offer = [{ id: 'repair', kind: 'now', lvl: 1 }]; game.chooseCard(0); eq(S.hp, S.hpMax, 'ремонт');
  S.phase = 'cards'; S.offer = [{ id: 'flip', kind: 'up', lvl: 1 }]; game.chooseCard(0); eq(S.flipLvl, 1);
  // все места заняты — новых построек нет
  const g2 = G.Game({ seed: 4 }).start(), S2 = g2._S; L.BUILD_IDS.forEach((id, i) => build(g2, S2, id, i));
  for (let k = 0; k < 20; k++){ g2._offer(); ok(S2.offer.every(c => c.kind !== 'build'), 'постройка без места'); }
});

// ---------- Тилт, волны, босс ----------
test('тилт: две встряски толкают шар, третья подряд клинит флипперы на 3 с; шкала остывает', () => {
  const { game, S, has, count } = mk(); const b = ball(S, 240, 400, 0, 0);
  ok(game.tilt() && b.vy < -200, 'нет толчка'); game.tilt(); eq(count('tilt'), 2); ok(S.tiltLock <= 0);
  game.tilt(); ok(S.tiltLock > 2.9 && has('tiltLock'), 'нет блокировки');
  const f = S.flip.L, a0 = f.ang; game.setFlip('L', true); run(game, 0.3); ok(Math.abs(f.ang - f.rest) < 1e-6, 'флиппер работает в тилте');
  ok(!game.tilt(), 'встряска в тилте'); run(game, 3); game.setFlip('L', false); game.setFlip('L', true); run(game, 0.2); ok(Math.abs(f.ang - f.up) < 0.01, 'не разблокировался');
  const m = mk(); m.game.tilt(); m.game.tilt(); run(m.game, 6); m.game.tilt(); ok(m.S.tiltLock <= 0, 'шкала не остывает');
});
test('волны: состав растёт, новые механизмы по порядку (тележки с 2-й, стрекозы с 3-й, тараны с 4-й); после 10-й — карты и босс', () => {
  let prev = 0;
  for (let n = 1; n <= L.WAVES; n++){ const w = L.waveList(n, mulberry32(n)); ok(w.list.length > prev, 'не растёт'); prev = w.list.length;
    if (n < 2) ok(!w.list.includes('cart')); if (n < 3) ok(!w.list.includes('fly')); if (n < 4) ok(!w.list.includes('ram')); }
  ok(L.WAVES >= 8 && L.WAVES <= 12, 'волн ' + L.WAVES);
  const ev = []; const game = G.Game({ seed: 2, onEvent: (t) => ev.push(t) }).start(), S = game._S;
  game.chooseCard(0); if (S.phase === 'slot') game.placeSlot();
  S.queue = []; S.banner = 0; S.balls = []; run(game, 0.1); ok(S.phase === 'cards' && S.wave === 2 && ev.includes('waveClear'), 'волна не закрылась');
  S.wave = L.WAVES + 1; S.offer = [{ id: 'repair', kind: 'now', lvl: 1 }]; game.chooseCard(0); ok(S.boss && S.boss.hp > 20, 'нет босса');
});
test('босс: снимается ударами шара, оглушение колокольней замедляет; убит — победа; дошёл до ворот — поражение', () => {
  const game = G.Game({ seed: 5 }).start(), S = game._S; S.wave = L.WAVES + 1; S.offer = [{ id: 'repair', kind: 'now', lvl: 1 }]; game.chooseCard(0);
  S.banner = 0; const B = S.boss; let hits = 0;
  for (let i = 0; i < 80 && S.phase === 'wave'; i++){ B.y = 300; B.t = 0; ball(S, B.x, B.y + B.r + 60, 0, -1000); run(game, 0.2); hits++; S.enemies = []; }
  ok(S.phase === 'won' && B.dead, 'босс жив: ' + B.hp); ok(hits >= 18, 'слишком хрупкий: ' + hits);
  const g2 = G.Game({ seed: 6 }).start(), S2 = g2._S; S2.wave = L.WAVES + 1; S2.offer = [{ id: 'repair', kind: 'now', lvl: 1 }]; g2.chooseCard(0); S2.banner = 0; S2.balls = [];
  let t = 0; const y0 = S2.boss.y; S2.boss.stun = 5; run(g2, 2); const slow = S2.boss.y - y0;
  S2.boss.stun = 0; const y1 = S2.boss.y; run(g2, 2); ok(slow < (S2.boss.y - y1) * 0.6, 'оглушение не замедлило');
  while (S2.phase === 'wave' && t < 200){ S2.balls = []; S2.enemies = []; g2.update(1 / 20); t += 1 / 20; }
  ok(S2.phase === 'over', 'босс дошёл, а ворота целы'); ok(t > 50, 'босс слишком быстрый: ' + t.toFixed(0) + ' с');
});
test('застревание: неподвижный шар на поле через ~3.5 с подталкивается сам', () => {
  const { game, S, has } = mk(); const B = build(game, S, 'magnet', 4); const b = ball(S, B.x, B.y - L.BR - B.r - 1, 0, 0);
  run(game, 5); ok(has('nudge') || Math.hypot(b.x - B.x, b.y - B.y) > 60, 'шар лежит');
});
test('детерминизм: одинаковый сид — одинаковая партия бота', () => {
  const a = playOtboynik(G, 7, { waves: 2 }), b = playOtboynik(G, 7, { waves: 2 });
  eq(a.score, b.score); eq(a.time, b.time); eq(a.cards, b.cards);
});
test('производительность: 4 шара, 40 механизмов, 6 построек — шаг логики в Node < 2 мс', () => {
  const { game, S } = mk(); S.banner = 0; L.BUILD_IDS.forEach((id, i) => build(game, S, id, i)); build(game, S, 'forge', 5);
  const r = mulberry32(3); for (let i = 0; i < 40; i++){ const e = game._spawn(['beetle', 'cart', 'fly', 'ram'][i % 4], 60 + r() * 340, 120 + r() * 300); e.mul = 0.01; e.hp = 1e9; }
  S.balls = []; for (let i = 0; i < 4; i++) S.balls.push({ x: 100 + i * 70, y: 500, vx: 600 * (r() - 0.5), vy: -1400, fire: 3, still: 0, id: i, trail: [] });
  S.queue = ['beetle']; S.spawnT = 1e9;
  run(game, 0.5, i => { if (i % 10 === 0) S.balls.forEach(b => { if (b.y > 600){ b.vy = -1500; } }); });
  const t0 = process.hrtime.bigint(); run(game, 2, i => { if (i % 10 === 0) S.balls.forEach(b => { if (b.y > 600) b.vy = -1500; }); });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 120; console.log('     шаг: ' + ms.toFixed(3) + ' мс, шаров ' + S.balls.length + ', подшагов ' + S.substeps);
  ok(ms < 2, ms.toFixed(2) + ' мс');
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; есть карты, механизмы, подсказки; названия ОТБОЙНИК / BUMPERWRIGHT', () => {
  const ru = Object.keys(G.STR.ru).sort(), en = Object.keys(G.STR.en).sort(); eq(ru, en);
  ru.forEach(k => ok(String(G.STR.ru[k]).trim() && String(G.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score', 'tapstart'].forEach(k => ok(G.STR.ru[k], 'ключ движка ' + k));
  L.BUILD_IDS.concat(['repair', 'flip']).forEach(id => ok(G.STR.ru['c_' + id] && G.STR.ru['cd_' + id] && G.STR.en['cd_' + id], 'карта ' + id));
  Object.keys(L.ENEMY).forEach(k => ok(G.STR.ru['e_' + k], 'механизм ' + k));
  eq(G.STR.ru.title, 'ОТБОЙНИК'); eq(G.STR.en.title, 'BUMPERWRIGHT');
});
function musicEnv(){
  const listeners = {}, timers = []; let made = 0;
  function param(v){ return { value: v, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(x){ if (!(x > 0)) throw new Error('exp ramp ≤0'); }, setTargetAtTime(){} }; }
  function node(kind){ return { kind, connect(){}, disconnect(){}, start(){}, stop(){}, frequency: param(440), detune: param(0), gain: param(1), Q: param(1), type: '' }; }
  class FakeAC { constructor(){ this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; made++; }
    createOscillator(){ return node('osc'); } createGain(){ return node('gain'); } createBiquadFilter(){ return node('filter'); } createBufferSource(){ return node('noise'); }
    createBuffer(c, len){ return { getChannelData: () => new Float32Array(len) }; } resume(){} suspend(){} }
  const win = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt,
    localStorage: { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k, v){ this._d[k] = String(v); } },
    addEventListener(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); }, setInterval(fn){ timers.push(fn); return timers.length; }, clearInterval(id){ timers[id - 1] = null; },
    setTimeout(){ return 0; }, requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){}, performance: { now: () => 0 }, AudioContext: FakeAC };
  const canvas = { width: 100, height: 100, style: {}, addEventListener(){}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener(){}, hidden: false }; win.window = win; win.globalThis = win;
  vm.createContext(win); vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), win, { filename: 'engine.js' });
  return { win, fire: ev => (listeners[ev] || []).forEach(f => f({ code: 'Enter', preventDefault(){} })), tick: (ac, dt) => { ac.currentTime += dt; timers.forEach(t => t && t()); } };
}
test('музыка: трек otboynik — 8–16 тактов, голоса кратны мелодии, ноты в диапазоне, за 10 с в игре > 30 нот без ошибок (как _shared/tests/music.test.mjs)', () => {
  const env = musicEnv(), A = env.win.Arcade;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), env.win, { filename: 'music.js' });
  const t = A.tracks.otboynik; ok(t, 'нет Arcade.tracks.otboynik');
  const c = A.parseTrack(t), perBar = c.div * 4 === 12 ? 6 : c.div * 4, bars = c.melody.length / perBar;
  ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тактов ' + bars);
  ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'голоса не кратны');
  [...c.melody, ...c.bass].filter(Boolean).forEach(e => ok(e.f > 40 && e.f < 2200, 'нота вне диапазона ' + e.f));
  const g = A.createGame({ canvas: '#c', gameId: 'otboynik' }); g.useStandardScreens(); g.scene('play', {});
  env.fire('keydown'); g.goto('play'); for (let i = 0; i < 200; i++) env.tick(g.audio.ac, 0.05);
  const st = g.audio.music.stats; ok(st.scheduled > 30 && st.errors === 0, JSON.stringify(st));
  g.pause(); const n = st.scheduled; for (let i = 0; i < 20; i++) env.tick(g.audio.ac, 0.05); eq(g.audio.music.stats.scheduled, n, 'играет в паузе');
});
test('страница: фавикон студии, «← Каталог» (RU/EN), canvas 480×760, скрипты по порядку, кнопки встряски и паузы; engine.js = _shared/engine.js; без внешних ссылок', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(html.includes(fs.readFileSync(path.join(ROOT, '..', 'roy', 'index.html'), 'utf8').match(/<link rel="icon"[^>]+>/)[0]), 'фавикон не как у студии');
  ok(/<a class="back"[^>]*href="\.\.\/"[^>]*data-catalog-back="1"[^>]*data-en="← Catalog"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="480" height="760"/.test(html), 'canvas');
  eq([...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]), ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/meta.js', 'js/audio.js', 'js/render.js', 'js/main.js']);
  ok(/id="bTilt"/.test(html) && /id="bPause"/.test(html), 'тач-кнопки');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'внешние ссылки');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8'); ok(/a\.back\{position:fixed[^}]*z-index:3/.test(css), '«← Каталог» не поверх canvas');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория: общий список (как в otsek/) + пинбол/оборона
  const BASE = Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgg==', 'base64').toString('utf8');
  const PIN = Buffer.from('XGJiYXN0aW9uXGJ80LHQsNGB0YLQuNC+0L18c3BhY2UgP2NhZGV0fHBlZ2dsZXxraW5nZG9tID9ydXNofHBsYW50cyA/dnN8cGluYmFsbCA/Znh8ZGV2aWwnP3MgP2NydXNofGFsaWVuID9jcnVzaHxcYnNvbmljXGJ8XGLRgdC+0L3QuNC6XGJ8d2lsbGlhbXN8XGJiYWxseVxifHN0ZXJuIHBpbmJhbGx8Z290dGxpZWJ8cGluYm90fGJsb29uc3xyb2d1ZSA/bGVnYWN5fHNsYXkgP3RoZSA/c3BpcmV8YmFsYXRyb3xwZWdsaW58cGluYmFsbCA/Ym91bmNlcnxwaW5yb2d1ZQ==', 'base64').toString('utf8');
  const BAD = new RegExp(BASE + '|' + PIN, 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 11, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ['QnVtcGVyIEJhc3Rpb24=', 'U3BhY2UgQ2FkZXQ=', 'UGVnZ2xl', 'S2luZ2RvbSBSdXNo', 'UGFjLU1hbg=='].forEach(b => ok(BAD.test(u(b)), 'стоп-лист не ловит образец'));
  ok(!BAD.test('ОТБОЙНИК') && !BAD.test('BUMPERWRIGHT') && !BAD.test('Гефест') && !BAD.test('Копёр') && !BAD.test('заводной жук') && !BAD.test('флиппер') && !BAD.test('пинбол') && !BAD.test('balls') && !BAD.test('ball'), 'ложные срабатывания');
});

// ---------- Проходимость: «человеческий» бот ----------
test('реклама за награду: revive после поражения — ворота до половины, волна продолжается, враги оглушены; повторно без поражения — false; repair +6 до максимума', () => {
  const T = mk(), S = T.S; S.enemies = []; T.game._spawn('beetle', 240, 650); S.balls = []; S.hp = 1; T.game._hurtGate(1);
  eq(S.phase, 'over'); ok(T.has('gameover')); ok(T.game.revive(), 'revive'); eq(S.phase, 'wave'); eq(S.hp, Math.ceil(S.hpMax / 2)); ok(S.balls.length === 1, 'новый шар');
  ok(S.enemies.every(e => e.stun >= 2), 'оглушены'); eq(T.game.revive(), false, 'без поражения не действует');
  S.hp = S.hpMax - 2; ok(T.game.repair(6)); eq(S.hp, S.hpMax, 'не выше максимума'); eq(T.game.repair(6), false, 'целые ворота — бонус не нужен');
});

// ---------- мета-прогрессия: открытые карты и стартовая колода ----------
const MT = G.meta;
function memStore(init){ const m = new Map(Object.entries(init || {})); return { m, get: k => m.has(k) ? m.get(k) : null, set: (k, v) => m.set(k, String(v)) }; }
test('мета: карты открываются дальностью (горн и стенка сразу, колокольня 2, магнит 4, делитель 6); колоды — 3/5/7/9 и «Мастер» за победу', () => {
  eq(MT.pool(0).join(','), 'forge,spring'); eq(MT.pool(2).join(','), 'forge,spring,bell'); eq(MT.pool(11).length, 5);
  eq(MT.decks(0, 0).join(','), 'bench'); eq(MT.decks(5, 0).join(','), 'bench,forge,bell'); eq(MT.decks(11, 0).indexOf('master'), -1); ok(MT.decks(1, 1).indexOf('master') >= 0, 'мастер за победу');
  eq(MT.runOpts('magnet', 3, 0).deck, 'bench', 'закрытая колода → верстак'); eq(MT.runOpts('forge', 3, 0).starter.join(','), 'forge');
  eq(JSON.stringify(MT.next(0, 0)), JSON.stringify({ kind: 'card', id: 'bell', need: 2 })); eq(MT.next(3, 0).id, 'magnet'); eq(MT.next(11, 0).id, 'master'); eq(MT.next(11, 1), null);
  eq(MT.gained(1, 0, 5, 0).map(u => u.id).join(','), 'bell,magnet,forge,bell'); eq(MT.gained(11, 0, 11, 1).map(u => u.kind + ':' + u.id).join(','), 'deck:master');
  eq(MT.cycle('bench', 5, 0, 1), 'forge'); eq(MT.cycle('bench', 5, 0, -1), 'bell');
});
test('мета: в раздаче только открытые карты (ремонт и флипперы — всегда); стартовая колода ставит постройки на стол до 1-й раздачи', () => {
  for (let s = 1; s <= 30; s++) { const g2 = G.Game({ seed: s, pool: ['forge', 'spring'] }).start();
    g2.state().offer.forEach(c => ok(['forge', 'spring', 'repair', 'flip'].indexOf(c.id) >= 0, 'закрытая карта ' + c.id)); }
  const m = G.Game({ seed: 4, pool: MT.pool(11), starter: ['forge', 'bell'] }).start(), S = m.state();
  eq(S.buildings.map(b => b.type + '@' + b.slot).join(','), 'forge@4,bell@1'); eq(S.phase, 'cards');
  ok(!S.offer.some(c => c.kind === 'build' && (c.id === 'forge' || c.id === 'bell')), 'стартовые не предлагаются как новая постройка');
  const sp = G.Game({ seed: 2, starter: ['spring'] }).start().state().buildings[0]; ok(sp.seg && sp.a && sp.b, 'стенка — отрезок');
});
test('мета: прогресс сохраняется и восстанавливается (дальность/победы — max, колода — last); слияние двух устройств не теряет открытия', () => {
  const a = memStore({ [MT.KEYS.wave]: '4', [MT.KEYS.wins]: '0', [MT.KEYS.deck]: 'forge' }), b = memStore({ [MT.KEYS.wave]: '9', [MT.KEYS.wins]: '1' });
  const merged = {}; for (const k of [MT.KEYS.wave, MT.KEYS.wins]) merged[k] = String(Math.max(parseFloat(a.get(k)) || 0, parseFloat(b.get(k)) || 0));
  merged[MT.KEYS.deck] = a.get(MT.KEYS.deck);
  const st = memStore(merged), best = +st.get(MT.KEYS.wave), w = +st.get(MT.KEYS.wins);
  eq(MT.runOpts(st.get(MT.KEYS.deck), best, w).deck, 'forge'); ok(MT.decks(best, w).indexOf('master') >= 0 && MT.decks(best, w).indexOf('splitter') >= 0, 'всё открытое с двух устройств');
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/g\.persist\(WIN_KEY, 'max'\)/.test(main) && /g\.persist\(DECK_KEY, 'last'\)/.test(main) && /g\.persist\(WAVE_KEY, 'max'\)/.test(main), 'облако');
});
test('площадка (движок v2.8): таблица дальности otboynikWave, «Без рекламы» в меню и паузе, свои игры, ярлык, оценка, событие облака', () => {
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/g\.useLeaderboard\(\{ boards: \[\{ id: LB_WAVE/.test(main) && /LB_WAVE = 'otboynikWave'/.test(main) && /g\.leaderboard\.submit\(w, \{ board: LB_WAVE \}\)/.test(main), 'лидеры');
  ok(/g\.useNoAds\(\{ scene: \['title', 'pause'\], after: 'end' \}\)/.test(main) && /g\.useOwnGames\(\)/.test(main) && /g\.useShortcut\(\)/.test(main) && /g\.useReview\(/.test(main) && /g\.onCloud\(/.test(main), 'площадка');
  ok(!/ArcadeLangX/.test(main), 'lang-x не используется');
});
await checkLangs({ ROOT, test, ok, eq, STR: G.STR, title: 'BUMPERWRIGHT' });
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
const N = 20, RUNS = []; for (let s = 1; s <= N; s++) RUNS.push(playOtboynik(G, s));
test('бот (реакция 150–250 мс, зевает 12%) проходит не меньше 3 волн в ≥ 85% из ' + N + ' партий; Копра побеждает иногда (1…60%); без зависаний', () => {
  const dist = new Array(L.WAVES + 2).fill(0); RUNS.forEach(r => dist[r.passed]++);
  const n3 = RUNS.filter(r => r.passed >= 3).length, won = RUNS.filter(r => r.won).length;
  console.log('     волн отбито 0..' + (L.WAVES + 1) + ': ' + dist.join(',') + '; ≥3 волн: ' + n3 + '/' + N + '; побед ' + won + '; среднее время ' + (RUNS.reduce((a, r) => a + r.time, 0) / N / 60).toFixed(1) + ' мин; сливов ' + (RUNS.reduce((a, r) => a + r.drains, 0) / N).toFixed(1));
  ok(n3 >= 0.85 * N, 'слишком сложно: ' + n3); ok(!RUNS.some(r => r.stuck), 'зависание');
  ok(won <= 0.6 * N, 'слишком легко: побед ' + won); ok(won >= 1, 'Копра никто не одолел');
});
test('мета: новичок (открыты только горн и стенка) — бот всё равно проходит ≥ 3 волн в ≥ 80% партий', () => {
  let n3 = 0; for (let s = 1; s <= 10; s++) if (playOtboynik(G, s, { pool: MT.pool(0) }).passed >= 3) n3++; ok(n3 >= 8, 'новичку слишком сложно: ' + n3 + '/10');
});
test('бот без флипперов (только пуск) ворота не удерживает — флипперы решают', () => {
  const r = playOtboynik(G, 3, { miss: 1 }); ok(r.passed <= 2, 'и без флипперов прошёл ' + r.passed);
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
