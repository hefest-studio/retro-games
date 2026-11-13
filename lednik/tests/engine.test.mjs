/* ЛЕДНИК · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node lednik/tests/engine.test.mjs (QUICK=1 — без графов уровней и партий бота).
   Логика (js/*.js без DOM) грузится в node:vm с шимом window. */
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
const LD = sandbox.LEDNIK, L = LD.logic, K = L.K, T = L.T, MAP = LD.MAP, LV_ = LD.levels;
const { navFor, passability, playLevel, foxFrom } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const DT = 1 / 60;

// мини-уровень из ASCII (для физики): ряды снизу, сверху добиваются воздухом до 18
function mini(rows){ const w = rows[0].length, t = []; for (let i = 0; i < 18 - rows.length; i++) t.push('.'.repeat(w)); return { id: 'mini', r: 1, w, h: 18, t: t.concat(rows), items: [], enemies: [], camps: [], wind: [] }; }
function sim(W, P, sec, inp){ for (let i = 0; i < Math.round(sec * 60); i++) L.heroStep(W, P, typeof inp === 'function' ? inp(i, P) : inp, DT, null); return P; }
function mk(id, opts = {}){
  const ev = [];
  const game = LD.Game(Object.assign({ rng: L.mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts));
  game.startLevel(id);
  const S = game.state();
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, dy = 0, jump = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dy, jump); game.update(DT); } game.setInput(0, 0, false); }

// ---------- уровни и карта ----------
test('уровни: 3 края × (4 уровня + вожак) + 3 тайника; ряды одной ширины, есть старт и выход', () => {
  eq(LV_.LEVELS.length, 18);
  for (const r of [1, 2, 3]){
    const ls = LV_.LEVELS.filter(l => l.r === r);
    eq(ls.filter(l => l.n >= 1 && l.n <= 4).length, 4, 'край ' + r); eq(ls.filter(l => l.boss).length, 1); eq(ls.filter(l => l.secret).length, 1);
  }
  for (const id of LV_.ids){
    const LV = LV_.build(id);
    eq(LV.t.length, 18); LV.t.forEach(r => eq(r.length, LV.w, id));
    ok(LV.start, id + ' старт');
    if (LV.boss) eq(LV.w, 32, id + ': арена в один экран'); else { ok(LV.exit, id + ' выход'); ok(LV.camps.length >= 1, id + ' костёр'); }
  }
});
test('норма припасов — порог (≈70%), не 100%; у уровней с ключом ключ в кармане за щелью', () => {
  for (const id of LV_.ids){ const LV = LV_.build(id); if (LV.boss) continue;
    ok(LV.need >= Math.ceil(LV.total * 0.65) && LV.need < LV.total, id + ': ' + LV.need + '/' + LV.total); }
  for (const k of ['k1', 'k2', 'k3']){
    const ls = LV_.LEVELS.filter(l => l.key === k); eq(ls.length, 1, 'ключ ' + k + ' ровно в одном уровне');
    const LV = LV_.build(ls[0].id), key = LV.items.find(i => i.k === 'key'); ok(key, 'ключ лежит');
    ok(LV.t[key.ty].slice(0, key.tx).includes('%'), 'перед ключом — щель');
  }
});
test('карта: все узлы — уровни, рёбра ведут к существующим узлам; развилки в каждом крае', () => {
  eq(MAP.NODES.length, 18);
  MAP.NODES.forEach(n => ok(LV_.ids.includes(n.id), n.id));
  MAP.EDGES.forEach(e => { ok(MAP.node(e.a) && MAP.node(e.b), e.a + '→' + e.b); });
  for (const r of [1, 2, 3]){ const outs = MAP.EDGES.filter(e => e.a === r + '-2' && !e.key); ok(outs.length >= 2, 'развилка после ' + r + '-2'); }
});
test('карта: связность — без ключей открываются все обычные уровни и финал; тайники — только с ключом', () => {
  const p = { cleared: {}, keys: {} };
  for (let guard = 0; guard < 40; guard++){ let ch = false; for (const n of MAP.NODES) if (MAP.isOpen(p, n.id) && !p.cleared[n.id]){ p.cleared[n.id] = 1; ch = true; } if (!ch) break; }
  for (const n of MAP.NODES){ if (/S$/.test(n.id)) ok(!p.cleared[n.id], 'тайник ' + n.id + ' закрыт без ключа'); else ok(p.cleared[n.id], 'достижим ' + n.id); }
  ok(p.cleared[MAP.FINAL], 'финал');
  p.keys = { k1: 1, k2: 1, k3: 1 };
  for (const n of MAP.NODES) if (/S$/.test(n.id)) ok(MAP.isOpen(p, n.id), 'с ключом открыт ' + n.id);
  // с самого начала открыт только первый узел
  const p0 = { cleared: {}, keys: {} }; eq(MAP.NODES.filter(n => MAP.isOpen(p0, n.id)).map(n => n.id).join(), '1-1');
});
test('карта: ключ открывает тропу к тайнику, тайник — короткий путь к вожаку; ходьба по тропам симметрична', () => {
  const p = { cleared: { '1-1': 1, '1-2': 1 }, keys: {} };
  ok(!MAP.isOpen(p, '1-S')); ok(!MAP.neighbors(p, '1-1').includes('1-S'));
  p.keys.k1 = 1; ok(MAP.isOpen(p, '1-S')); ok(MAP.neighbors(p, '1-1').includes('1-S'));
  p.cleared['1-S'] = 1; ok(MAP.isOpen(p, '1-B'), 'вожак через тайник');
  for (const n of MAP.NODES) for (const m of MAP.neighbors(p, n.id)) ok(MAP.neighbors(p, m).includes(n.id), n.id + '↔' + m);
});

// ---------- физика ----------
const flat = c => mini([c.repeat(40), '#'.repeat(40), '#'.repeat(40)]);
test('физика: прыжок ≈ 4,8 клетки, удержание выше короткого нажатия', () => {
  const W = { LV: flat('#'), br: null, time: 0, wind: false };
  let P = L.newHero(100, 15 * T), top = P.y; sim(W, P, 1, (i, P) => { top = Math.min(top, P.y); return { dx: 0, dy: 0, jump: true }; });
  const hFull = (15 * T - top) / T; ok(hFull > 4.4 && hFull < 5, 'высота ' + hFull.toFixed(2));
  P = L.newHero(100, 15 * T); top = P.y; sim(W, P, 1, (i, P) => { top = Math.min(top, P.y); return { dx: 0, dy: 0, jump: i < 4 }; });
  ok((15 * T - top) / T < hFull - 1.5, 'короткий прыжок ниже');
});
test('физика льда: разгон выше, а остановка дольше, чем на снегу', () => {
  const Ws = { LV: flat('#'), br: null, time: 0, wind: false }, Wi = { LV: flat('='), br: null, time: 0, wind: false };
  const a = sim(Ws, L.newHero(40, 15 * T), 2, { dx: 1 }), b = sim(Wi, L.newHero(40, 15 * T), 3, { dx: 1 });
  ok(Math.abs(a.vx - K.RUN) < 1, 'снег ' + a.vx); ok(Math.abs(b.vx - K.ICE_MAX) < 1, 'лёд ' + b.vx); ok(b.ice && !a.ice);
  const x1 = a.x; sim(Ws, a, 2, { dx: 0 }); const x2 = b.x; sim(Wi, b, 3, { dx: 0 });
  ok(b.x - x2 > 4 * (a.x - x1), 'тормозной путь: снег ' + (a.x - x1).toFixed(0) + ', лёд ' + (b.x - x2).toFixed(0));
});
test('подкат: проезжает под сводом в одну клетку, в полный рост — нет; на льду катится дальше', () => {
  const LV = mini(['..........######################', '..........######################', '................................', '================================', '################################', '################################']);
  const W = { LV, br: null, time: 0, wind: false };
  let P = sim(W, L.newHero(40, 15 * T), 2, { dx: 1 }); ok(P.x < 10 * T, 'стоя упёрлась: ' + P.x);
  P = L.newHero(40, 15 * T); sim(W, P, 0.3, { dx: 1 }); sim(W, P, 0.3, { dx: 1, dy: 1 }); ok(P.slide && P.low); sim(W, P, 3, (i, P) => ({ dx: P.low && !P.slide ? 1 : 0 }));
  ok(P.x > 26 * T, 'проехала тоннель: ' + (P.x / T).toFixed(1));
  const Wsn = { LV: flat('#'), br: null, time: 0, wind: false }, Wice = { LV: flat('='), br: null, time: 0, wind: false };
  const s1 = L.newHero(40, 15 * T), s2 = L.newHero(40, 15 * T);
  for (const [w, p] of [[Wsn, s1], [Wice, s2]]){ sim(w, p, 0.2, { dx: 1 }); sim(w, p, 0.1, { dx: 1, dy: 1 }); sim(w, p, 2, { dx: 0 }); }
  ok(s2.x - s1.x > 3 * T, 'на льду дальше: ' + (s1.x / T).toFixed(1) + ' / ' + (s2.x / T).toFixed(1));
});
test('сугроб-ловушка: вязнет (медленно, низкий прыжок), но выбраться можно', () => {
  const LV = mini(['..................', '#####sssssss######', '#####sssssss######', '##################']);
  const W = { LV, br: null, time: 0, wind: false };
  const P = L.newHero(8 * T, 15 * T); P.ground = false; sim(W, P, 1.5, { dx: 0 });
  ok(P.drift && P.ground && Math.abs(P.y - 17 * T) < 0.1, 'утонула до дна: ' + P.y);
  sim(W, P, 0.5, { dx: 1 }); ok(Math.abs(P.vx) <= K.DRIFT_MAX + 0.01, 'медленно: ' + P.vx);
  let out = false; sim(W, P, 4, (i, P) => { if (P.y <= 15 * T + 0.1 && P.x > 12 * T) out = true; return { dx: 1, jump: i % 30 < 20 }; });
  ok(out, 'выбралась');
});
test('сосулька: лезет вверх, встаёт на верх столбика и спускается обратно', () => {
  const LV = mini(['....|#####', '....|.....', '....|.....', '....|.....', '....|.....', '##########', '##########', '##########']);
  const W = { LV, br: null, time: 0, wind: false };
  const P = L.newHero(4 * T + 8, 15 * T); sim(W, P, 0.1, { dy: -1 }); ok(P.climb, 'полезла');
  sim(W, P, 3, { dy: -1 }); ok(!P.climb && P.ground && Math.abs(P.y - 10 * T) < 0.1, 'наверху: ' + P.y);
  sim(W, P, 0.6, { dx: 1 }); ok(P.x > 5 * T && Math.abs(P.y - 10 * T) < 0.1, 'шагнула на уступ');
  sim(W, P, 0.6, { dx: -1 }); sim(W, P, 0.2, { dx: 0 }); P.x = 4 * T + 8;
  sim(W, P, 4, { dy: 1 }); ok(P.ground && Math.abs(P.y - 15 * T) < 0.1, 'спустилась: ' + P.y);
});
test('ледяной мост: держит на бегу, под стоящей трескается и ломается, потом нарастает снова', () => {
  const { game, S, has } = mk('2-2');
  const LV = S.LV, br = LV.t[15].indexOf('-');
  game._place(br + 3, 14); S.enemies = []; run(game, 0.1);
  ok(S.hero.ground, 'стоит на мосту');
  run(game, 2.2); ok(has('crack'), 'треснул'); ok(S.phase === 'dead' || S.hero.y > 15 * T, 'провалилась');
  run(game, 6); ok(Object.values(S.br).every(b => b.b <= 0), 'мост снова цел');
});
test('прорубь и пропасть — минус жизнь и возврат к костру/старту', () => {
  const { game, S, has } = mk('2-1');
  const c = S.LV.t[16].indexOf('~'); game._place(c, 13); run(game, 1);
  ok(has('die')); eq(S.lives, 2); run(game, 2); eq(S.phase, 'play'); eq(S.hearts, K.HEARTS);
  eq(Math.round(S.hero.x), S.LV.start.tx * T + 8, 'на старте');
});
test('шипы ранят (минус сердце), три раны — минус жизнь', () => {
  const { game, S, has } = mk('1-1'); const sp = S.LV.t[14].indexOf('^');
  game._place(sp, 13); run(game, 0.5); ok(has('hurt')); eq(S.hearts, 2);
  S.hero.inv = 0; game._hurt(0); S.hero.inv = 0; game._hurt(0); ok(has('die')); eq(S.lives, 2);
});
test('ветер: порыв сдвигает, пригнувшись — стоит на месте', () => {
  const LV = mini(['#'.repeat(40), '#'.repeat(40), '#'.repeat(40)]); LV.wind = [{ x0: 0, x1: 40 * T, dir: -1, period: 4, on: 1, phase: 0 }];
  const W = { LV, br: null, time: 0, wind: true };
  const a = sim(W, L.newHero(20 * T, 15 * T), 1, { dx: 0 }); ok(a.x < 20 * T - 30, 'сдуло: ' + a.x);
  const b = sim(W, L.newHero(20 * T, 15 * T), 1, { dy: 1 }); ok(Math.abs(b.x - 20 * T) < 1, 'пригнулась: ' + b.x);
  W.wind = false; const c = sim(W, L.newHero(20 * T, 15 * T), 1, { dx: 0 }); eq(c.x, 20 * T, 'без ветра');
});

// ---------- бумеранг, враги ----------
test('бумеранг летит вперёд и возвращается в руку', () => {
  const { game, S, has } = mk('1-1'); game._place(3, 14); S.enemies = [];
  ok(game.throwBoom()); ok(!game.throwBoom(), 'второй — нельзя, пока летит');
  let far = 0; for (let i = 0; i < 180 && S.boom; i++){ game.update(DT); if (S.boom) far = Math.max(far, S.boom.x - S.hero.x); }
  ok(!S.boom, 'вернулся'); ok(has('catch')); ok(far > 4 * T && far < 8 * T, 'дальность ' + (far / T).toFixed(1));
});
test('бумеранг оглушает котёнка; касание оглушённого — он убегает (+очки)', () => {
  const { game, S, has } = mk('1-1');
  game._place(3, 14); S.enemies = [{ i: 0, k: 'kitten', x: 7 * T, y: 15 * T, vx: 0, vy: 0, face: -1, st: 'walk', t: 0, alive: true, cd: 5, ground: true, w: 12, h: 12, sp: 0 }];
  game.throwBoom(); run(game, 0.6); ok(has('stun')); eq(S.enemies[0].st, 'stun');
  const sc = S.score; run(game, 1.5, 1); ok(has('flee')); eq(S.score - sc >= L.PTS.flee, true); eq(S.hearts, K.HEARTS, 'без урона');
});
test('котёнок бросается, жук колюч сверху, мамонтёнок пружинит и таранит', () => {
  let { game, S, has } = mk('1-1');
  game._place(3, 14); S.enemies = [{ i: 0, k: 'kitten', x: 7 * T, y: 15 * T, vx: 0, vy: 0, face: -1, st: 'walk', t: 0, alive: true, cd: 0, ground: true, w: 12, h: 12, sp: 0 }];
  run(game, 1.2); ok(has('growl')); ok(has('hurt'), 'котёнок допрыгнул');
  ({ game, S, has } = mk('1-1')); game._place(3, 14);
  S.enemies = [{ i: 0, k: 'beetle', x: 3 * T + 8, y: 15 * T, vx: 0, vy: 0, face: 1, st: 'walk', t: 0, alive: true, cd: 0, ground: true, w: 14, h: 10, sp: 0 }];
  S.hero.y = 12 * T; S.hero.ground = false; run(game, 0.6); ok(has('hurt'), 'жук колется');
  ({ game, S, has } = mk('2-4')); const LV = S.LV; game._place(3, 14);
  S.enemies = [{ i: 0, k: 'mammoth', x: 3 * T + 8, y: 15 * T, vx: 0, vy: 0, face: 1, st: 'reel', t: 5, alive: true, cd: 5, ground: true, w: 26, h: 20, sp: 0 }];
  S.hero.y = 11 * T; S.hero.ground = false; let top = 1e9; for (let i = 0; i < 90; i++){ game.update(DT); top = Math.min(top, S.hero.y); }
  ok(has('boing')); ok((15 * T - top) / T > 6.5, 'высокий отскок: ' + ((15 * T - top) / T).toFixed(1)); ok(!has('hurt'));
  ({ game, S, has } = mk('2-4')); game._place(3, 14);
  S.enemies = [{ i: 0, k: 'mammoth', x: 10 * T, y: 15 * T, vx: 0, vy: 0, face: -1, st: 'walk', t: 0, alive: true, cd: 0, ground: true, w: 26, h: 20, sp: 0 }];
  run(game, 2); ok(has('trumpet'), 'заметил'); ok(has('hurt'), 'протаранил');
});

// ---------- песец Бураш ----------
test('Бураш пролезает в щель и приносит ключ из кармана; Искре туда не пройти', () => {
  const { game, S, has } = mk('1-2'), LV = S.LV;
  const key = LV.items.find(i => i.k === 'key'), slit = LV.t[key.ty].lastIndexOf('%', key.tx);
  game._place(slit - 2, 14); S.enemies = [];
  run(game, 2, 1); ok(S.hero.x < slit * T, 'щель держит Искру');
  S.hero.face = 1; let n = 0;
  while (!S.keyGot && n++ < 4){ ok(game.callFox(), 'Бураш выбежал'); run(game, 3); }
  ok(S.keyGot, 'ключ у Искры'); ok(has('foxGrab') && has('key'));
});
test('Бураш не выбегает в прыжке; разведка открывает припас в сугробе', () => {
  const { game, S, has } = mk('1-2'); S.enemies = [];
  game._place(3, 14); S.hero.ground = false; S.hero.vy = -100; ok(!game.callFox()); ok(has('foxNo'));
  const LV = S.LV, hid = LV.items.find(i => i.hidden);
  ok(hid && !S.revealed[hid.id]);
  // ставим Искру у края сугроба: Бураш бежит по сугробу (ряд ног)
  const c0 = LV.t[15].indexOf('s'); game._place(c0 - 1, 14); run(game, 0.2);
  S.hero.face = 1; game.callFox(); run(game, 3);
  ok(LV.items.some(i => i.hidden && S.revealed[i.id]) || S.sup > 0, 'припас найден');
});

// ---------- выход, итог ----------
test('стойбище закрыто до нормы («нужно ещё N»), открыто при норме; 100% — бонус и жизнь', () => {
  let { game, S, has, ev } = mk('1-1'); S.enemies = [];
  const ex = S.LV.exit; game._place(ex.tx, ex.ty); run(game, 0.2);
  ok(has('need')); eq(S.phase, 'play'); eq(ev.find(e => e.t === 'need').d.left, S.LV.need);
  const sup = S.LV.items.filter(i => i.k !== 'key' && i.k !== 'heart');
  sup.slice(0, S.LV.need).forEach(i => game._collect(i)); ok(has('enough'));
  game._place(ex.tx - 1, ex.ty); run(game, 0.5, 1); eq(S.phase, 'clear'); const c = ev.find(e => e.t === 'clear').d; ok(!c.full); eq(c.bonus, L.PTS.clear);
  ({ game, S, has, ev } = mk('1-1')); S.enemies = [];
  S.LV.items.forEach(i => game._collect(i)); const lives = S.lives; game._place(ex.tx, ex.ty); run(game, 0.3);
  const c2 = ev.find(e => e.t === 'clear').d; ok(c2.full); eq(c2.bonus, L.PTS.clear + L.PTS.full); eq(S.lives, lives + 1);
});
test('вожаки: уязвимы только «сбитыми с толку», побеждаются бумерангом; уровень завершается', () => {
  for (const id of ['1-B', '2-B', '3-B']){
    const { game, S, has } = mk(id); const b = S.boss; ok(b && b.alive, id);
    game._place(4, 14); run(game, 1.5);
    b.hp = 1; b.st = 'walk'; b.t = 9; b.x = 9 * T; b.y = 15 * T;
    game.throwBoom(); run(game, 0.8); ok(b.alive, id + ': неуязвим в нападении');
    run(game, 2); b.st = b.k === 'fang' ? 'dazed' : b.k === 'shell' ? 'flipped' : 'rest'; b.t = 5; b.x = 9 * T; b.y = 15 * T; S.hero.inv = 9;
    S.hero.face = 1; game.throwBoom(); run(game, 1); ok(!b.alive && has('bossDown'), id + ': побеждён');
    run(game, 3); eq(S.phase, 'clear', id);
  }
});
test('жизни: 3 потери — конец игры', () => {
  const { game, S, has } = mk('1-1');
  for (let i = 0; i < 3; i++){ game._die('fall'); run(game, 2); }
  eq(S.phase, 'over'); ok(has('gameover'));
});

// ---------- сохранение ----------
function memLS(init){ const m = Object.assign({}, init); return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
test('сохранение: чистый старт, запись и чтение прогресса', () => {
  const ls = memLS(), st = LD.save.store(ls); const p = st.load();
  eq(p.at, '1-1'); eq(Object.keys(p.cleared).length, 0);
  LD.save.apply(p, '1-1', { full: true }); LD.save.apply(p, '1-2', { key: 'k1' }); p.at = '1-2'; st.save(p);
  const q = LD.save.store(ls).load(); ok(q.cleared['1-1'] && q.cleared['1-2'] && q.full['1-1'] && q.keys.k1); eq(q.at, '1-2');
  eq(JSON.parse(ls.m[LD.save.KEY]).v, 2);
});
test('сохранение: миграция v1 → v2 и переезд со старого ключа (старый удаляется)', () => {
  const v1 = JSON.stringify({ v: 1, done: ['1-1', '1-2', 'zzz'], stars: ['1-1', '1-3'], keys: ['k1', 'kx'], node: '1-2' });
  const ls = memLS({ [LD.save.OLD]: v1 }), p = LD.save.store(ls).load();
  ok(p.cleared['1-1'] && p.cleared['1-2'] && !p.cleared.zzz); ok(p.full['1-1'] && !p.full['1-3'], 'звезда без прохождения отброшена');
  ok(p.keys.k1 && !p.keys.kx); eq(p.at, '1-2');
  ok(!(LD.save.OLD in ls.m), 'старый ключ удалён'); eq(JSON.parse(ls.m[LD.save.KEY]).v, 2, 'записано в новом формате');
  const ls2 = memLS({ [LD.save.KEY]: v1 }); LD.save.store(ls2).load(); eq(JSON.parse(ls2.m[LD.save.KEY]).v, 2, 'v1 под новым ключом переписан');
});
test('сохранение: битые данные, будущая версия, закрытый узел — безопасный откат', () => {
  eq(LD.save.parse('{oops').at, '1-1'); eq(LD.save.parse(JSON.stringify({ v: 9, cleared: { '1-1': 1 } })).cleared['1-1'], undefined);
  eq(LD.save.parse(JSON.stringify({ v: 2, cleared: {}, full: {}, keys: {}, at: '3-B' })).at, '1-1', 'нельзя стоять на закрытом узле');
  const ls = memLS({ [LD.save.KEY]: 'мусор' }); eq(LD.save.store(ls).load().at, '1-1');
});

// ---------- музыка, тексты, имена ----------
test('музыка: оригинальный трек lednik подключается по gameId; карта и вожак — свои темы', () => {
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  for (const tr of [sandbox.Arcade.tracks.lednik, LD.MUSIC.map, LD.MUSIC.boss]){ ok(tr && tr.bpm > 0 && tr.melody && tr.bass && tr.drums); eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); }
  eq(LD.MUSIC.level, sandbox.Arcade.tracks.lednik);
});
test('i18n: у RU и EN одинаковые ключи; есть названия всех уровней, краёв, вожаков', () => {
  const ru = Object.keys(LD.STR.ru).sort(), en = Object.keys(LD.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (const id of LV_.ids) ok(LD.STR.ru['n_' + id] && LD.STR.en['n_' + id], id);
  for (const k of ['r1', 'r2', 'r3', 'b_fang', 'b_shell', 'b_owl', 'bd_fang', 'bd_shell', 'bd_owl']) ok(LD.STR.ru[k] && LD.STR.en[k], k);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifHByZWhpc3Rvcmlba2NdfNC/0YDQtdC4P9GB0YLQvtGA0Lhb0LrRh1180L/RgNC10YXQuNGB0YLQvtGA0Lhb0LrRh118Y29tbWFuZGVyID9rZWVufNC60L7QvCvQsNC90LTQtdGAID/QutC40L0=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('callFox()') && !BAD.test('Искра') && !BAD.test('Бураш') && !BAD.test('ледник') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест') && !BAD.test('доисторический'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- графы уровней и бот (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без графов и бота)'); process.exit(failed ? 1 : 0); }
const NAV = {};
test('проходимость: в каждом уровне по физике (лёд, подкат, сугробы, сосульки) достижимы выход и норма припасов, ключ — Бурашом', () => {
  const rows = [];
  for (const id of LV_.ids){
    const LV = LV_.build(id), r = passability(LD, LV); NAV[id] = r.nav;
    if (LV.boss){
      const floor = r.nav.nodes.filter(n => n.r === 15);
      ok(floor.length > 20 && floor.every(n => r.nav.reach.has(n.id)), id + ': арена связна');
      continue;
    }
    rows.push(id + ' ' + r.supOk + '/' + LV.total + '≥' + LV.need);
    ok(r.exitOk, id + ': выход недостижим');
    ok(r.supOk >= LV.need, id + ': собрать можно ' + r.supOk + ', норма ' + LV.need);
    ok(r.keyOk, id + ': ключ недоступен');
  }
  console.log('     припасы (достижимо/всего≥норма): ' + rows.join(', '));
});
test('проходимость: тоннели только подкатом, щели — только Бурашом (без них часть припасов недоступна)', () => {
  const LV = LV_.build('3-3'), nav = NAV['3-3'] || navFor(LD, LV), slideIds = nav.ACTS.map((a, i) => a.slide != null ? i : -1).filter(i => i >= 0);
  const tunnel = LV.items.filter(it => it.ty === 14 && LV.t[13].charAt(it.tx) === '#');
  ok(tunnel.length >= 8, 'припасы в тоннелях: ' + tunnel.length);
  // без подката (рёбра-подкаты выкинуты) тоннельные припасы не взять
  const got = new Set(); for (const [u] of nav.reach) for (const e of nav.edges[u]) if (!slideIds.includes(e.a)) e.items.forEach(i => got.add(i));
  ok(tunnel.every(it => !got.has(it.id)), 'без подката не взять');
  const L2 = LV_.build('1-2'), key = L2.items.find(i => i.k === 'key'), n2 = NAV['1-2'] || navFor(LD, L2);
  ok(![...n2.reach.keys()].some(u => n2.standItems[u].includes(key.id) || n2.edges[u].some(e => e.items.includes(key.id))), 'ключ ногами не взять');
  ok(n2.foxItems.some(l => l.includes(key.id)), 'а Бураш достанет');
});
test('бот без урона проходит каждый обычный и тайный уровень (норма → стойбище)', () => {
  const fails = [];
  for (const id of LV_.ids){ const spec = LV_.spec(id); if (spec.boss) continue;
    const r = playLevel(LD, id, 1, { god: true, nav: NAV[id], maxT: 300 }); if (!r.won) fails.push(id + '(' + r.sup + '/' + r.need + ')'); }
  ok(!fails.length, 'не прошёл: ' + fails.join(', '));
});
// «Человеческий» бот: реакция 150–250 мс, разброс нажатий, иногда не замечает врага. Цель: уровень 1 — почти всегда.
test('баланс: «человеческий» бот проходит уровень 1-1 в ≥ 90% партий', () => {
  const N = 20; let w = 0, deaths = 0; for (let s = 1; s <= N; s++){ const r = playLevel(LD, '1-1', s, { nav: NAV['1-1'] }); if (r.won) w++; deaths += r.deaths; }
  console.log('     1-1: побед ' + w + '/' + N + ', потерь жизней ' + deaths);
  ok(w >= 0.9 * N, 'слишком сложно: ' + w + '/' + N);
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
