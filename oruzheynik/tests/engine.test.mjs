/* ОРУЖЕЙНИК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node oruzheynik/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: этапы и их рецепты, физику (прыжок, подкат), проходимость каждого этапа графом по настоящей физике
   (вкл. мигающие блоки во всех фазах такта), цепочку слабостей (замкнута, однозначна), оружие, прогресс и крепость,
   повторные бои, сохранение/миграцию/пароль, музыку, i18n, правило имён и партии «человеческого» бота. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/save.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const OZ = sandbox.ORUZH, L = OZ.logic, DT = 1 / 60;
const { playStage, mulberry32, navFor } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function memStore(init){ const m = new Map(Object.entries(init || {})); return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
function mk(o = {}){
  const ev = [], ls = o.ls || memStore();
  const game = OZ.Game({ rng: mulberry32(o.seed || 1), dmgMul: o.dmgMul, store: OZ.save.store(ls), onEvent: (t, d) => ev.push({ t, d }) }).start();
  return { game, S: game.state(), ev, ls, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(typeof inp === 'function' ? inp(game.state()) : inp); game.update(DT); } game.setInput({}); }
// пустой мир для физики: пол на ряду 12, колонки по описанию
function flatWorld(w, fn){ const t = new Uint8Array(w * L.R); for (let c = 0; c < w; c++) for (let r = 12; r < L.R; r++) t[r * w + c] = L.SOL; if (fn) fn(t, w); return { W: w, t, grp: new Int8Array(w * L.R).fill(-1), open: true }; }

// ---------- этапы ----------
test('11 этапов: 8 цехов + 3 яруса крепости; у каждого старт, отметки, арена босса; мини-комнаты с воротами', () => {
  eq(OZ.STAGES.length, 11);
  OZ.STAGES.forEach((d, i) => {
    const lv = OZ.level(i); ok(lv.start && lv.arena && lv.cps.length >= 2, d.key);
    ok(lv.W > 80 && lv.W < 220, d.key + ' ширина ' + lv.W);
    if (lv.mini) { const W = lv.W; let gates = 0; for (let r = 0; r < L.R; r++) if (lv.t[r * W + lv.mini.x1] === L.GATE) gates++; eq(gates, 3, d.key + ' ворота мини-комнаты'); }
  });
  eq(OZ.STAGES.slice(0, 8).map(s => s.boss).join(','), L.BOSSES.join(','));
  eq(OZ.STAGES.slice(8).map(s => s.fort).join(','), '1,2,3');
  eq(OZ.STAGES[10].boss, 'rematch');
});
test('у каждого цеха свой набор врагов/препятствий (наборы не совпадают)', () => {
  const sig = OZ.STAGES.slice(0, 8).map((d, i) => { const lv = OZ.level(i); const types = [...new Set(lv.spawns.map(s => s.type))].sort().join('+'); const toks = [...new Set(d.r.split(/\s+/).map(t => t.replace(/[\d:-].*$/, '')))].sort().join(''); return types + '|' + toks + '|' + (lv.mini && lv.mini.type) + '|' + d.theme; });
  eq(new Set(sig).size, 8, sig.join(' / '));
});
test('неизвестный токен рецепта — понятная ошибка', () => {
  const bak = OZ.STAGES[0].r; OZ.STAGES[0].r = 'S f2 zz X';
  try { let err = null; try { OZ.buildLevel(0); } catch (e) { err = e; } ok(err && /неизвестный токен/.test(err.message)); } finally { OZ.STAGES[0].r = bak; }
});

// ---------- физика ----------
test('прыжок: полный — чуть выше 3 клеток, короткое нажатие — ниже; разбег перепрыгивает пропасть в 3 клетки, но не в 6', () => {
  const W = flatWorld(30);
  const full = L.newHero(5.5, 12); let top = 12;
  for (let f = 0; f < 120; f++){ L.heroStep(W, full, { dx: 0, jump: true, jumpPress: f === 0 }, DT, null); top = Math.min(top, full.y); }
  ok(12 - top > 3 && 12 - top < 3.5, 'полный прыжок ' + (12 - top).toFixed(2));
  const tap = L.newHero(5.5, 12); let top2 = 12;
  for (let f = 0; f < 120; f++){ L.heroStep(W, tap, { dx: 0, jump: f < 5, jumpPress: f === 0 }, DT, null); top2 = Math.min(top2, tap.y); }
  ok(12 - top2 < 2, 'короткий ' + (12 - top2).toFixed(2));
  const gap = n => { const w = flatWorld(30, (t, w) => { for (let c = 10; c < 10 + n; c++) for (let r = 12; r < L.R; r++) t[r * w + c] = 0; }); const r = L.simulate(w, 9.6, 12, { dx: 1, hold: 0.7, delay: 0 }, null); return r.ok && r.x > 10 + n; };
  ok(gap(3), 'пропасть 3'); ok(!gap(6), 'пропасть 6 — непрыгаема');
});
test('подкат: проходит в тоннель высотой 1 клетка, стоя туда не пройти; ↓+прыжок тоже даёт подкат', () => {
  const W = flatWorld(30, (t, w) => { for (let c = 12; c < 16; c++) for (let r = 0; r <= 10; r++) t[r * w + c] = L.SOL; });
  const h = L.newHero(9.5, 12); for (let f = 0; f < 60; f++) L.heroStep(W, h, { dx: 1 }, DT, null);
  ok(h.x < 12, 'стоя — упёрся: ' + h.x.toFixed(2));
  const s = L.newHero(9.5, 12); L.heroStep(W, s, { dx: 1, slidePress: true }, DT, null); for (let f = 0; f < 50; f++) L.heroStep(W, s, { dx: 1 }, DT, null);
  ok(s.x > 16, 'подкатом прошёл: ' + s.x.toFixed(2));
  const d = L.newHero(5.5, 12); L.heroStep(W, d, { dx: 0, down: true, jump: true, jumpPress: true }, DT, null); ok(d.slide && d.vy === 0, 'вниз+прыжок = подкат');
});
test('шипы и пропасть — гибель; мигающие блоки держат, пока горят', () => {
  const W = flatWorld(20, (t, w) => { t[11 * w + 8] = L.SPK; });
  const h = L.newHero(5.5, 12); for (let f = 0; f < 60 && !h.dead; f++) L.heroStep(W, h, { dx: 1 }, DT, null); eq(h.dead, 'spike');
  const P = flatWorld(20, (t, w) => { for (let c = 8; c < 20; c++) for (let r = 12; r < L.R; r++) t[r * w + c] = 0; });
  const p = L.newHero(5.5, 12); for (let f = 0; f < 200 && !p.dead; f++) L.heroStep(P, p, { dx: 1 }, DT, null); eq(p.dead, 'pit');
  ok(L.blinkOn(0, 0.5) && !L.blinkOn(0, 2.5) && L.blinkOn(1, 1.5), 'такт блоков');
});

// ---------- проходимость ----------
test('проходимость: в каждом этапе граф по физике ведёт от старта до арены босса (мини-комната, мигающие блоки во всех фазах)', () => {
  OZ.STAGES.forEach((d, i) => {
    const N = navFor(OZ, i), R = N.nav.reach(N.start);
    ok(N.start >= 0, d.key + ': старт не узел');
    ok(N.goals.some(gid => R.has(gid)), d.key + ': арена недостижима');
    ok(N.nav.blinkOk.every(Boolean), d.key + ': цепочка мигающих блоков не проходится при какой-то фазе такта');
    if (N.lv.mini) { const W = N.lv.W, inMini = [...R].some(id => id % W > N.lv.mini.x0 && id % W < N.lv.mini.x1); ok(inMini, d.key + ': мини-комната'); }
  });
});
test('исполнимость: бот без урона проходит каждый этап целиком в настоящей физике (путь графа + бои)', () => {
  OZ.STAGES.forEach((d, i) => { const r = playStage(OZ, 3, { stage: i, dmgMul: 0, maxT: 700 }); ok(r.cleared && !r.stuck, d.key + ': ' + JSON.stringify(r.stuckAt || r.at || r.t)); });
});

// ---------- слабости ----------
test('цепочка слабостей: биекция «8 Мастеров ↔ 8 трофеев», без своей слабости, один замкнутый круг из 8', () => {
  const B = L.BOSSES, owner = {}; B.forEach((b, i) => owner[L.WEAP[i + 1].k] = b);
  const weak = B.map(b => L.WEAK[b]);
  eq(new Set(weak).size, 8, 'у каждого Мастера своя слабость');
  weak.forEach((w, i) => { ok(owner[w], B[i] + ': слабость не трофей'); ok(owner[w] !== B[i], B[i] + ': слаб к своему же оружию'); });
  let cur = B[0], seen = [cur];
  for (let k = 0; k < 8; k++){ cur = owner[L.WEAK[cur]]; if (k < 7) { ok(seen.indexOf(cur) < 0, 'круг короче 8: ' + seen.join('→')); seen.push(cur); } }
  eq(cur, B[0], 'круг не замкнут: ' + seen.join('→'));
});
test('однозначность: по каждому Мастеру слабое оружие бьёт строго сильнее любого другого (и заряженного наруча)', () => {
  const { game } = mk();
  [...L.BOSSES, 'ladle', 'crane', 'walker', 'core'].forEach(b => {
    const wk = L.WEAK[b], dWeak = game._bossDamage(b, wk).d;
    ok(game._bossDamage(b, wk).weak, b);
    L.WEAP.forEach(w => { if (w.k === wk) return; [0, 1, 2].forEach(lv => { const d = game._bossDamage(b, w.k, lv).d; ok(d < dWeak, b + ': ' + w.k + ' lv' + lv + ' = ' + d + ' ≥ ' + dWeak); }); });
  });
});
test('бой: слабость сбивает Мастера быстрее (7 попаданий против 28 искрами), оглушает; победа даёт трофей', () => {
  const T = mk(); T.game.pick(0); T.game._startBoss(); run(T.game, 2);
  eq(T.S.bossState, 'fight'); const b = T.S.boss;
  T.game._hitBoss(L.WEAK.hammer); eq(b.hp, L.BOSS_HP - 4); ok(b.stun > 0, 'оглушение');
  let n = 1; while (!b.dead && n < 50){ T.game._hitBoss(L.WEAK.hammer); n++; } eq(n, 7);
  run(T.game, 3); eq(T.S.phase, 'got'); eq(T.S.gotW, 1); ok(T.S.prog.beaten[0] && T.game.owned(1));
  const T2 = mk(); T2.game.pick(1); T2.game._startBoss(); run(T2.game, 2); let m = 0; while (!T2.S.boss.dead && m < 99){ T2.game._hitBoss('spark', 0); m++; } eq(m, 28);
});

// ---------- оружие ----------
test('оружие: трофеи недоступны до победы; каждый тратит свой заряд, наруч — бесплатно; капсула заряда пополняет', () => {
  const T = mk(); T.game.pick(0); run(T.game, 0.5);
  ok(!T.game.selectWeapon(3), 'нельзя взять чужое оружие'); T.game._beatAll();
  for (let i = 1; i < L.WEAP.length; i++){
    ok(T.game.selectWeapon(i), L.WEAP[i].k); T.S.shots = []; const e0 = T.S.energy[i];
    ok(T.game._fire(0), 'выстрел ' + L.WEAP[i].k); ok(T.S.energy[i] < e0, 'заряд ' + L.WEAP[i].k);
  }
  T.game.selectWeapon(0); T.S.shots = []; T.game._fire(0); eq(T.S.energy[0], L.MAX_EN);
  T.game.selectWeapon(2); T.S.energy[2] = 0; ok(!T.game._fire(0), 'без заряда не стреляет');
  T.S.items.push({ k: 'en8', x: T.S.hero.x, y: T.S.hero.y, vy: 0, got: false, fixed: true }); run(T.game, 0.1); ok(T.S.energy[2] >= 10, 'капсула заряда');
});
test('наруч: удержание — заряд в 2 ступени; заряженный болт крупнее и пробивает', () => {
  const T = mk({ dmgMul: 0 }); T.game.pick(0); T.S.spawns = []; T.S.enemies = []; run(T.game, 0.5); T.S.shots = [];
  run(T.game, L.CH2 + 0.1, { fire: true }); run(T.game, 1 / 60, {});
  const big = T.S.shots.find(s => s.lv === 2); ok(big && big.pierce && big.dmg === 3, JSON.stringify(T.S.shots.map(s => s.lv)));
  ok(T.has('charge'), 'событие заряда');
});
test('молот-бумеранг возвращается в руку; щит-шестерня гасит вражеские снаряды', () => {
  const T = mk(); T.game.pick(0); run(T.game, 0.5); T.game._beatAll();
  T.game.selectWeapon(1); T.S.shots = []; T.game._fire(0); const s = T.S.shots[0]; let maxD = 0, back = false;
  for (let f = 0; f < 120 && T.S.shots.length; f++){ T.game.update(DT); maxD = Math.max(maxD, Math.abs(s.x - T.S.hero.x)); if (s.vx * T.S.hero.face < 0) back = true; }
  ok(back && maxD > 3 && T.S.shots.length === 0, 'бумеранг: дальность ' + maxD.toFixed(1) + ', вернулся ' + back);
  T.game.selectWeapon(2); T.S.eshots = [{ kind: 'bolt', x: T.S.hero.x + 1.5, y: T.S.hero.y - 0.8, vx: 0, vy: 0, r: 0.2, dmg: 3, life: 4 }];
  T.game._fire(0); run(T.game, 0.3); eq(T.S.eshots.length, 0, 'снаряд погашен');
});
test('фляги: подобранная фляга сохраняется и больше не появляется; F — полное здоровье', () => {
  const T = mk(); T.game.pick(1); run(T.game, 0.3);
  const tank = T.S.items.find(i => i.k === 'tank'); ok(tank, 'на этапе есть фляга');
  T.game._place(tank.x, tank.y); run(T.game, 0.1); eq(T.S.prog.tanks, 1);
  T.S.hero.hp = 5; ok(T.game.useTank()); eq(T.S.hero.hp, L.MAX_HP); eq(T.S.prog.tanks, 0);
  T.S.prog.tanks = 1; T.game._kill('pit'); run(T.game, 2.2); ok(!T.S.items.some(i => i.k === 'tank'), 'фляга не возродилась');
  const p = JSON.parse(T.ls.getItem(OZ.save.KEY)); ok(Object.keys(p.tankGot).length === 1);
});

// ---------- прогресс, крепость, финал ----------
test('жизни: гибель — с последней отметки, без жизней — конец игры (прогресс цел)', () => {
  const T = mk(); T.game.pick(2); run(T.game, 0.3); T.S.prog.beaten[5] = true;
  T.game._kill('pit'); run(T.game, 2); eq(T.S.lives, 2); eq(T.S.phase, 'stage');
  T.game._kill('pit'); run(T.game, 2); T.game._kill('pit'); run(T.game, 2); eq(T.S.phase, 'over'); ok(T.has('gameover'));
  T.game.newRun(); eq(T.S.lives, L.LIVES); eq(T.S.phase, 'select');
});
test('крепость закрыта до 8 трофеев; ярусы идут по очереди; финал: 8 повторных боёв → Шагающая Домна → Сердце → победа', () => {
  const T = mk(); ok(!T.game.canPick(8)); T.game._beatAll(); ok(T.game.canPick(8));
  T.game.pick(8); eq(T.S.lv.key, 'f1'); T.game._startBoss(); run(T.game, 2); while (!T.S.boss.dead) T.game._hitBoss(L.WEAK.ladle); run(T.game, 3); eq(T.S.phase, 'clear');
  run(T.game, 3); eq(T.S.lv.key, 'f2'); T.game._startBoss(); run(T.game, 2); while (!T.S.boss.dead) T.game._hitBoss(L.WEAK.crane); run(T.game, 6); eq(T.S.lv.key, 'f3');
  T.game._startBoss(); const order = [];
  for (let k = 0; k < 12 && !T.S.won; k++){ run(T.game, 2); order.push(T.S.boss.key); while (!T.S.boss.dead) T.game._hitBoss(L.WEAK[T.S.boss.key]); run(T.game, 3); }
  eq(order.join(','), L.BOSSES.concat(['walker', 'core']).join(','));
  ok(T.S.won && T.has('win')); eq(T.S.prog.fort, 3);
});
test('повторные бои: после гибели побеждённые в этом заходе Мастера не повторяются', () => {
  const T = mk(); T.game._beatAll(); T.S.prog.fort = 2; T.game.pick(8); eq(T.S.lv.key, 'f3');
  T.game._startBoss(); for (let k = 0; k < 3; k++){ run(T.game, 2); while (!T.S.boss.dead) T.game._hitBoss(L.WEAK[T.S.boss.key]); run(T.game, 3); }
  T.game._kill('boss'); run(T.game, 2.2); T.game._startBoss(); run(T.game, 0.1); eq(T.S.boss.key, L.BOSSES[3]);
});

// ---------- сохранение, миграция, пароль ----------
test('сохранение: победа над Мастером пишется в localStorage (v1) и читается новой игрой', () => {
  const ls = memStore(); const T = mk({ ls }); T.game.pick(4); T.game._startBoss(); run(T.game, 2); while (!T.S.boss.dead) T.game._hitBoss(L.WEAK.frost); run(T.game, 3);
  const raw = JSON.parse(ls.getItem(OZ.save.KEY)); eq(raw.v, 1); ok(raw.beaten[4]);
  const T2 = mk({ ls }); ok(T2.S.prog.beaten[4] && T2.game.owned(5));
});
test('миграция: формат черновой сборки (без версии, 4 яруса крепости) → v1 при первом чтении, данные не теряются', () => {
  const old = { beaten: [true, true, true, true, true, true, true, true], tanks: 3, fort: 4, tankGot: { 'gear:20.5': 1 } };
  const ls = memStore({ [OZ.save.KEY]: JSON.stringify(old) });
  const T = mk({ ls });
  eq(T.S.prog.fort, 3); eq(T.S.prog.tanks, 3); ok(T.S.prog.beaten.every(Boolean)); eq(T.S.prog.tankGot['gear:20.5'], 1);
  const now = JSON.parse(ls.getItem(OZ.save.KEY)); eq(now.v, 1, 'ключ переписан в новой версии'); eq(now.fort, 3);
  const part = OZ.save.migrate({ beaten: [true, false, false, false, false, false, false, false], tanks: 9, fort: 2 }); eq(part.tanks, 4); eq(part.fort, 0, 'крепость без 8 трофеев');
  eq(OZ.save.migrate({ v: 99, beaten: new Array(8).fill(true) }), null, 'будущая версия не портит данные');
  eq(OZ.save.parse('{мусор').beaten.filter(Boolean).length, 0);
});
test('пароль: 6 цифр 1–8, туда-обратно для всех комбинаций побед/фляг; опечатка — отказ', () => {
  let n = 0, bad = 0;
  for (let mask = 0; mask < 256; mask++) for (let t = 0; t <= 4; t++) for (let f = 0; f <= (mask === 255 ? 3 : 0); f++){
    const p = OZ.save.blank(); for (let i = 0; i < 8; i++) p.beaten[i] = !!(mask & (1 << i)); p.tanks = t; p.fort = f;
    const code = OZ.save.encode(p); ok(/^[1-8]{6}$/.test(code), code);
    const q = OZ.save.decode(code); ok(q && q.beaten.join() === p.beaten.join() && q.tanks === t && q.fort === f, code); n++;
    const typo = code.slice(0, 2) + (code[2] % 8 + 1) + code.slice(3); if (OZ.save.decode(typo)) bad++;
  }
  ok(n === 255 * 5 + 5 * 4, 'комбинаций ' + n); ok(bad / n < 0.05, 'опечаток принято: ' + bad + '/' + n);
  eq(OZ.save.decode('12'), null); eq(OZ.save.decode('999999'), null);
  const T = mk(); ok(T.game.applyPassword(OZ.save.encode(Object.assign(OZ.save.blank(), { beaten: [1, 0, 1, 0, 1, 0, 1, 0].map(Boolean) })))); ok(T.game.owned(1) && !T.game.owned(2) && T.game.owned(3));
});

// ---------- музыка, i18n ----------
test('музыка: оригинальные треки (цеха и бой) — 8 тактов, голоса кратны', () => {
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  [sandbox.Arcade.tracks.oruzheynik, OZ.MUSIC.boss].forEach(T => { ok(T && T.bpm > 0); eq(n(T.melody) % 8, 0); eq(n(T.melody) % n(T.bass), 0); eq(n(T.melody) % n(T.drums), 0); });
});
test('i18n: у RU и EN одинаковые ключи; есть имена всех Мастеров, цехов, оружия и врагов', () => {
  const ru = Object.keys(OZ.STR.ru).sort(), en = Object.keys(OZ.STR.en).sort(); eq(ru.join(','), en.join(','));
  [...L.BOSSES, 'ladle', 'crane', 'walker', 'core'].forEach(b => ok(OZ.STR.ru['b_' + b] && OZ.STR.en['b_' + b], b));
  L.BOSSES.forEach(b => ok(OZ.STR.ru['s_' + b], b)); L.WEAP.forEach(w => ok(OZ.STR.ru['w_' + w.k] && OZ.STR.en['w_' + w.k], w.k));
  L.WEAP.slice(1).forEach(w => ok(OZ.STR.ru['wd_' + w.k], 'описание ' + w.k));
  ['crawler', 'hopper', 'flyer', 'turret', 'golem', 'valve', 'drone'].forEach(f => ok(OZ.STR.ru['f_' + f], f));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifG1lZ2EgPy0/bWFufCg/PCFb0LAt0Y/RkV0p0LzQtdCz0LAgPy0/0Lxb0LXRjV3QvXxyb2NrID8tP21hbnwoPzwhW9CwLdGP0ZFdKdGA0L7QuiA/LT/QvFvQtdGNXdC9fFxid2lseVxifCg/PCFb0LAt0Y/RkV0p0LLQsNC50LvQuA==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Магнитчик') && !BAD.test('срок менее') && !BAD.test('mine') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, не замечает часть врагов, уворачивается не всегда, только наруч.
const N1 = 24, FIRST = []; for (let s = 1; s <= N1; s++) FIRST.push(playStage(OZ, s, { stage: 0 }));
test('баланс: бот проходит первый цех (только наручем) почти всегда — ≥ 85% партий, без «зависаний»', () => {
  const n = FIRST.filter(r => r.cleared).length, why = {}; FIRST.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const bt = FIRST.filter(r => r.bossT).map(r => r.bossT);
  console.log('     1-й цех: ' + n + '/' + N1 + '; гибели: ' + JSON.stringify(why) + '; бой с Мастером, с: ' + Math.min(...bt).toFixed(0) + '–' + Math.max(...bt).toFixed(0));
  ok(n >= 0.85 * N1, 'слишком сложно: ' + n + '/' + N1); ok(!FIRST.some(r => r.stuck), 'бот застрял');
});
test('баланс: каждый цех проходим ботом без трофеев (≥ 1 из 4 партий), бой с Мастером не короче 15 с', () => {
  const rows = [];
  for (let i = 0; i < 8; i++){ const rs = [1, 2, 3, 4].map(s => playStage(OZ, s, { stage: i })); const c = rs.filter(r => r.cleared).length; rows.push(OZ.STAGES[i].key + ' ' + c + '/4'); ok(c >= 1, OZ.STAGES[i].key + ': ' + c + '/4'); ok(rs.every(r => !r.bossT || r.bossT > 15), OZ.STAGES[i].key + ': слишком быстрый Мастер'); ok(!rs.some(r => r.stuck), 'застрял: ' + OZ.STAGES[i].key); }
  console.log('     ' + rows.join(' · '));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
