/* ПОСОХ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node posokh/tests/engine.test.mjs (QUICK=1 — без графов проходимости и партий бота).
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
const PS = sandbox.POSOKH, L = PS.logic, K = L.K, T = L.T, LVS = PS.levels;
const { navFor, passability, playExp, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
const DT = 1 / 60;
// мини-уровень из ASCII (ряды снизу, сверху добиваются воздухом до 18)
function mini(rows){ const w = rows[0].length, t = []; for (let i = 0; i < 18 - rows.length; i++) t.push('.'.repeat(w)); const LV = { id: 'mini', w, h: 18, ceil: 0, t: t.concat(rows) }; return { LV, g: L.grid(LV) }; }
function sim(W, P, sec, inp, ev){ for (let i = 0; i < Math.round(sec * 60); i++) L.heroStep(W, P, typeof inp === 'function' ? inp(i, P) : inp, DT, ev || null); return P; }
function mk(id, carry, opts = {}){
  const ev = [];
  const game = PS.Game(Object.assign({ rng: mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts));
  game.start(id, carry || {});
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, dx = 0, dn = false, jump = false){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(dx, dn, jump); game.update(DT); } game.setInput(0, false, false); }
function memLS(){ const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }

// ---------- экспедиции ----------
test('экспедиции: 5 штук, у каждой старт, флажки, страж с решёткой, арена хозяина, тайник за треснувшим камнем или дверью', () => {
  eq(LVS.ids.join(), 'mine,swamp,ridge,tower,sunk');
  for (const id of LVS.ids){
    const LV = LVS.build(id);
    eq(LV.t.length, 18); LV.t.forEach(r => eq(r.length, LV.w, id));
    ok(LV.w >= 150, id + ' ширина ' + LV.w);
    ok(LV.start && LV.guardAt && LV.bossAt && LV.arenaX > 0, id);
    ok(LV.flags.length >= 2, id + ' флажки');
    ok(LV.t.some(r => r.includes('X')), id + ' решётка стража');
    ok(LV.bossAt.tx > LV.arenaX && LV.guardAt.tx < LV.arenaX, id + ': страж до арены, хозяин в ней');
    ok(LV.t.some(r => r.includes('c')) || LV.t.some(r => r.includes('D')), id + ' тайник');
    ok(LV.objs.some(o => o.k === 'chest'), id + ' сундук');
    ok(LV.total >= 2000, id + ' самоцветов на ' + LV.total);
    ok(LV.items.some(i => i.k === 'pie' || i.k === 'bigpie'), id + ' пирожки');
    ok(L.BOSS[LV.boss], id + ' хозяин ' + LV.boss);
  }
  eq(new Set(LVS.EXP.map(e => e.boss)).size, 5, 'у каждой экспедиции свой хозяин');
});
test('нелинейность: предмет одной экспедиции открывает дверь в другой (3 связи), реликвий две — обе за дверями', () => {
  eq(LVS.LINKS.length, 3);
  for (const l of LVS.LINKS){ ok(l.from !== l.to, l.item); const LV = LVS.build(l.to); ok(LV.t.some(r => r.includes('D')), 'дверь в ' + l.to); ok(LVS.build(l.from).items.some(i => i.k === 'item' && i.what === l.item), 'предмет в ' + l.from); }
  eq(LVS.RELICS.length, 2);
  for (const r of LVS.RELICS){ const id = Object.keys(LVS.RELIC).find(k => LVS.RELIC[k] === r); const LV = LVS.build(id); ok(LV.door && LV.items.some(i => i.k === 'relic' && i.what === r), r); }
});

// ---------- физика ----------
const flat = c => mini([c.repeat(40), '#'.repeat(40), '#'.repeat(40)]);
test('физика: прыжок ≈ 4 клетки, отпустил кнопку — ниже', () => {
  const W = flat('#');
  let P = L.newHero(100, 15 * T), top = P.y; sim(W, P, 1, (i, P) => { top = Math.min(top, P.y); return { dx: 0, jump: true }; });
  const h = (15 * T - top) / T; ok(h > 3.8 && h < 4.5, 'высота ' + h.toFixed(2));
  P = L.newHero(100, 15 * T); top = P.y; sim(W, P, 1, (i, P) => { top = Math.min(top, P.y); return { dx: 0, jump: i < 4 }; });
  ok((15 * T - top) / T < h - 1.5, 'короткий прыжок ниже');
});
test('пого: в прыжке ↓ — стойка на посохе; каждый отскок подряд выше прежнего (до предела ≈ 8 клеток)', () => {
  const W = flat('#'), P = L.newHero(100, 15 * T), tops = []; let prev = 0, bounces = 0;
  sim(W, P, 6, (i, P) => ({ dx: 0, dn: i > 5, jump: i < 30 }), (t) => { if (t === 'bounce') bounces++; });
  eq(P.ground, false, 'на посохе героиня не «стоит», а прыгает');
  const P2 = L.newHero(100, 15 * T); let vy0 = 0;
  for (let i = 0; i < 400; i++){ L.heroStep(W, P2, { dx: 0, dn: i > 5, jump: i < 30 }, DT, null); if (vy0 < 0 && P2.vy >= 0) tops.push((15 * T - P2.y) / T); vy0 = P2.vy; }
  ok(bounces >= 5, 'отскоков ' + bounces);
  for (let i = 2; i < 5; i++) ok(tops[i] > tops[i - 1] + 0.5, 'отскок ' + i + ': ' + tops.map(x => x.toFixed(1)).join(' '));
  ok(Math.max(...tops) > 7.5 && Math.max(...tops) < 8.5, 'предел ' + Math.max(...tops).toFixed(2));
  // отпустил ↓ — приземлилась, цепочка сброшена
  sim(W, P2, 2, { dx: 0, dn: false }); ok(P2.ground && P2.chain === 0 && !P2.pogo);
});
test('шипы: стоя — ранят; на посохе — отскок без урона', () => {
  const W = mini(['....................', '#####^^^^^^#########', '####################']);
  const evs = []; const P = L.newHero(8 * T, 10 * T); P.ground = false;
  sim(W, P, 2, { dx: 0, dn: true }, t => evs.push(t)); ok(evs.includes('bounce') && evs.includes('spikeBounce') && !evs.includes('spike'), evs.join());
  const ev2 = []; const Q = L.newHero(8 * T, 10 * T); Q.ground = false; sim(W, Q, 1, { dx: 0 }, t => ev2.push(t)); ok(ev2.includes('spike'), 'без посоха — урон');
});
test('мостки: снизу проходятся, сверху держат', () => {
  const W = mini(['..........', '...----...', '..........', '..........', '##########', '##########']);
  const P = L.newHero(5 * T, 16 * T); let top = 99; sim(W, P, 1.2, (i, P) => { top = Math.min(top, P.y); return { dx: 0, jump: i < 30 }; });
  ok(P.ground && Math.abs(P.y - 13 * T) < 0.1, 'стоит на мостках: ' + P.y);
});

// ---------- правила экспедиции ----------
test('пого по врагу: враг повержен, героиня отскакивает; касание сбоку — минус сердце', () => {
  const r = mk('mine'), S = r.S, e = S.enemies.filter(e => e.k === 'walker').sort((a, b) => a.x - b.x)[0];
  S.hero.x = e.x; S.hero.y = e.y - 40; S.hero.ground = false; S.hero.vy = 50; S.hero.inv = 0;
  run(r.game, 0.6, 0, true);
  ok(!e.alive && r.has('kill') && r.has('bounce'), 'повержен');
  const r2 = mk('mine'), S2 = r2.S, e2 = S2.enemies.filter(e => e.k === 'walker').sort((a, b) => a.x - b.x)[0];
  S2.hero.x = e2.x - 6; S2.hero.y = e2.y; S2.hero.inv = 0; run(r2.game, 0.1);
  eq(S2.hearts, K.HEARTS - 1, 'сердце'); ok(e2.alive);
});
test('удар посохом: ломает треснувший камень, отправляет камень в полёт (камень сбивает врага), сундук раскрывается самоцветами', () => {
  const r = mk('mine'), S = r.S, LV = S.LV;
  // треснувший камень: ищем c, встаём слева вплотную
  let cx = -1, cy = -1; LV.t.forEach((row, y) => { const x = row.indexOf('c'); if (x >= 0 && cx < 0){ cx = x; cy = y; } });
  S.hero = L.newHero((cx - 1) * T + 8, (cy + 1) * T + (L.tileAt(S.W, cx - 1, cy + 1) === '#' ? 0 : T)); S.hero.face = 1;
  while (!L.isSolid(L.tileAt(S.W, cx - 1, Math.round(S.hero.y / T)))) S.hero.y += T;
  run(r.game, 0.05); r.game.swing(); run(r.game, 0.05);
  ok(r.has('crack'), 'треснул'); eq(L.tileAt(S.W, cx, Math.floor((S.hero.y - 2) / T)), '.');
  // камень → в полёт
  const rock = S.objs.find(o => o.k === 'rock'); S.hero = L.newHero(rock.x - 12, rock.y); S.hero.face = 1;
  run(r.game, 0.4); r.game.swing(); run(r.game, 0.05); ok(rock.fly && rock.vx > 0, 'камень летит');
  const r3 = mk('mine'), S3 = r3.S, rk = S3.objs.find(o => o.k === 'rock');
  const e = S3.enemies.find(e => e.k === 'walker'); e.x = rk.x + 96; e.y = rk.y; e.vx = 0;
  S3.hero = L.newHero(rk.x - 12, rk.y); S3.hero.face = 1; run(r3.game, 0.05); r3.game.swing(); run(r3.game, 1);
  ok(!e.alive && r3.has('kill'), 'камень сбил врага');
  // сундук
  const r4 = mk('mine'), S4 = r4.S, ch = S4.objs.find(o => o.k === 'chest');
  S4.hero = L.newHero(ch.x - 12, ch.y); S4.hero.face = 1; run(r4.game, 0.05); r4.game.swing(); run(r4.game, 1.5);
  ok(!ch.alive && r4.has('chest'), 'сундук раскрылся'); ok(S4.loot.length > 0 || r4.count('gem') > 0, 'самоцветы выпали');
  const bag0 = S4.bag; S4.loot.forEach(g => { g.t = 1; S4.hero.x = g.x; S4.hero.y = g.y + 4; r4.game.update(DT); }); ok(S4.bag > bag0, 'подобраны');
});
test('пого по сундуку сверху тоже раскрывает его', () => {
  const r = mk('mine'), S = r.S, ch = S.objs.find(o => o.k === 'chest');
  S.hero.x = ch.x; S.hero.y = ch.y - 40; S.hero.ground = false; S.hero.vy = 60; S.hero.inv = 0; run(r.game, 0.5, 0, true);
  ok(!ch.alive && r.has('chest'));
});
test('дверь тайника: без предмета — стена, с предметом из другой экспедиции — открыта', () => {
  for (const l of LVS.LINKS){
    const a = mk(l.to, { items: {} }); ok(a.S.W.g.some(r => r.includes('D')), l.to + ' закрыта');
    const b = mk(l.to, { items: { [l.item]: 1 } }); ok(!b.S.W.g.some(r => r.includes('D')) && b.S.doorOpen, l.to + ' открыта');
  }
});
test('страж: решётка закрыта, пока он жив; хозяин: арена запирается, ключ после победы, взял ключ — экспедиция пройдена', () => {
  const r = mk('mine', { bank: 700 }), S = r.S, LV = S.LV;
  ok(S.W.g.some(row => row.includes('X')));
  S.hero.x = LV.guardAt.tx * T - 5 * T; run(r.game, 0.1); ok(S.guard.awake && r.has('guardWake'));
  // три удара сверху
  for (let k = 0; k < 8 && S.guard.alive; k++){ S.guard.inv = 0; S.hero.x = S.guard.x; S.hero.y = S.guard.y - S.guard.h - 20; S.hero.ground = false; S.hero.vy = 80; S.hero.inv = 5; run(r.game, 0.25, 0, true); }
  ok(!S.guard.alive && r.has('guardDown'), 'страж повержен, hp ' + S.guard.hp); ok(!S.W.g.some(row => row.includes('X')), 'решётка открыта');
  S.hero = L.newHero((LV.arenaX + 5) * T, (LV.h - 3) * T); run(r.game, 0.05);
  ok(S.boss.awake && S.W.g.some(row => row.includes('A')), 'арена заперта');
  r.game._killBoss(); ok(S.keyDrop && !S.W.g.some(row => row.includes('A')), 'ключ выпал, арена открыта');
  S.hero.inv = 9; for (let i = 0; i < 120 && S.phase === 'play'; i++){ S.hero.x = S.keyDrop.x; S.hero.y = S.keyDrop.y + 8; r.game.update(DT); }
  eq(S.phase, 'clear'); const res = r.ev.find(e => e.t === 'clear').d; ok(res.won && res.key && res.bag >= L.PTS.boss, JSON.stringify(res));
});
test('хозяева: у каждого свой характер (прыжки / плевки / рывки / пике / пар) и он ранит касанием', () => {
  const kinds = new Set();
  for (const id of LVS.ids){
    const r = mk(id), S = r.S, LV = S.LV;
    S.hero = L.newHero((LV.arenaX + 5) * T, (LV.h - 3) * T); S.hero.inv = 99; run(r.game, 6);
    const evs = r.ev.map(e => e.t); for (const t of ['leap', 'shoot', 'dash', 'thud']) if (evs.includes(t)) kinds.add(id + ':' + t);
    ok(S.boss.awake, id);
  }
  ok([...kinds].some(k => k.endsWith('dash')) && [...kinds].some(k => k.endsWith('shoot')) && [...kinds].some(k => k.endsWith('leap')), [...kinds].join());
});
test('жизни: три раны — минус жизнь и возврат к привалу; жизни кончились — конец игры', () => {
  const r = mk('mine', { lives: 2 }), S = r.S;
  for (let i = 0; i < 3; i++){ S.hero.inv = 0; r.game._hurt(); }
  eq(S.phase, 'dead'); eq(S.lives, 1); run(r.game, 2); eq(S.phase, 'play'); eq(S.hearts, K.HEARTS);
  r.game._die('test'); eq(S.phase, 'over'); ok(r.has('gameover'));
});
test('пирожки лечат, талисман даёт жизнь; самоцветы идут в мешок', () => {
  const r = mk('mine'), S = r.S;
  S.hearts = 1; const p = S.LV.items.find(i => i.k === 'pie'); S.hero.x = p.tx * T + 8; S.hero.y = (p.ty + 1) * T; run(r.game, 0.05); eq(S.hearts, 2);
  const l = S.LV.items.find(i => i.k === 'life'); const lv = S.lives; S.hero.x = l.tx * T + 8; S.hero.y = (l.ty + 1) * T; run(r.game, 0.05); eq(S.lives, lv + 1);
  const g = S.LV.items.find(i => i.k === 'big'); S.hero.x = g.tx * T + 8; S.hero.y = (g.ty + 1) * T; run(r.game, 0.05); ok(S.bag >= 500);
});
test('отступление в лагерь: из мешка остаётся половина, предметы и взятое сохраняются', () => {
  const r = mk('mine'), S = r.S;
  const it = S.LV.items.find(i => i.k === 'item'); S.hero.x = it.tx * T + 8; S.hero.y = (it.ty + 1) * T; run(r.game, 0.05);
  S.bag = 3000; const res = r.game.retreat();
  eq(res.bag, 1500); eq(res.lost, 1500); eq(res.item, 'gear'); ok(!res.won && res.retreat); ok(res.taken.includes(it.id));
  const p = PS.save.apply(PS.save.blank(), res); eq(p.bank, 1500); ok(p.items.gear && !p.keys.mine && p.taken.mine.includes(it.id));
  // взятое не появляется снова
  const r2 = mk('mine', { taken: p.taken.mine, items: p.items }); ok(r2.S.got[it.id]);
});

// ---------- сохранение ----------
test('сохранение: чистый старт, запись/чтение, итог экспедиции, достижение «истинный финал» переживает стирание забега', () => {
  const ls = memLS(), st = PS.save.store(ls);
  ok(!st.has()); const p = st.load(); eq(p.bank, 0); eq(p.at, 'mine');
  PS.save.apply(p, { id: 'swamp', won: true, key: true, bag: 4200, item: 'compass', taken: [1, 2, 'o0'], lives: 4 });
  st.save(p); ok(st.has());
  const q = st.load(); ok(q.keys.swamp && q.cleared.swamp && q.items.compass); eq(q.bank, 4200); eq(q.lives, 4); eq(q.at, 'swamp'); eq(q.taken.swamp.join(), '1,2,o0');
  eq(PS.save.keyCount(q), 1); ok(!PS.save.allKeys(q)); ok(!PS.save.trueEnd(q));
  LVS.ids.forEach(id => q.keys[id] = 1); q.relics = { astro: 1, lens: 1 }; ok(PS.save.allKeys(q) && PS.save.trueEnd(q));
  st.setAch({ trueEnd: 1, ends: 1 }); st.wipe(); ok(!st.has()); eq(st.ach().trueEnd, 1);
});
test('сохранение: битые данные, чужая версия, мусорные поля — безопасный откат', () => {
  const ls = memLS(), st = PS.save.store(ls);
  ls.setItem(PS.save.KEY, '{oops'); eq(st.load().bank, 0); ok(!st.has());
  ls.setItem(PS.save.KEY, JSON.stringify({ v: 99, bank: 5 })); eq(st.load().bank, 0);
  ls.setItem(PS.save.KEY, JSON.stringify({ v: 1, bank: -50, lives: 0, at: 'луна', keys: { mine: 1, xx: 1 }, items: { gear: 1, bomb: 1 }, taken: { mine: [1, {}, 'o1'] } }));
  const p = st.load(); eq(p.bank, 0); eq(p.lives, 3); eq(p.at, 'mine'); eq(Object.keys(p.keys).join(), 'mine'); eq(Object.keys(p.items).join(), 'gear'); eq(p.taken.mine.join(), '1,o1');
  const thr = { getItem(){ throw new Error('x'); }, setItem(){ throw new Error('x'); }, removeItem(){ throw new Error('x'); } };
  const s2 = PS.save.store(thr); eq(s2.load().bank, 0); s2.save(p); s2.wipe(); eq(JSON.stringify(s2.ach()), '{}');
});

// ---------- музыка, i18n, имена ----------
test('музыка: оригинальный трек posokh подключается по gameId; лагерь и хозяин — свои темы', () => {
  const Tr = sandbox.Arcade.tracks.posokh; ok(Tr && Tr.bpm > 0 && Tr.melody && Tr.bass && Tr.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  for (const tr of [Tr, PS.MUSIC.camp, PS.MUSIC.boss]){ eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); }
  ok(PS.MUSIC.camp !== Tr && PS.MUSIC.boss !== Tr);
});
test('i18n: у RU и EN одинаковые ключи; есть названия экспедиций, хозяев, стражей, предметов и реликвий', () => {
  const ru = Object.keys(PS.STR.ru).sort(), en = Object.keys(PS.STR.en).sort(); eq(ru.join(','), en.join(','));
  for (const E of LVS.EXP){ for (const k of ['x_' + E.id, 'xd_' + E.id, 'b_' + E.boss, 'bd_' + E.boss, 'g_' + E.guard]) ok(PS.STR.ru[k] && PS.STR.en[k], k); }
  for (const it of LVS.ITEMS) ok(PS.STR.ru['it_' + it] && PS.STR.ru['itd_' + it]); for (const r of LVS.RELICS) ok(PS.STR.en['rl_' + r]);
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8'), 'i');
  // дополнение для этой игры (оригинал жанра, его герои, правообладатели; с транслитом) — тоже в base64
  const BAD2 = new RegExp(Buffer.from('ZHVjayA/dGFsZXN8c2Nyb29nZXxtYyA/ZHVja3xkaXNuZXl80LTQsNC6ID/RgtC10LnQu9C3fNGB0LrRgNGD0LTQtnzQvNCw0LogP9C00LDQunzQtNC40YHQvdC1W9C50Y9dfNGD0YLQuNC90YvQtSDQuNGB0YLQvtGA0LjQuA==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const txt = fs.readFileSync(f, 'utf8'); for (const B of [BAD, BAD2]){ const m = txt.match(B); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); } }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)) && !BAD2.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  for (const w of ['Ярослава', 'посох', 'Звездочёт', 'Гефест', 'CONTRACT.md', 'Медные копи', 'Буревестник', 'макушки', 'дискета']) ok(!BAD.test(w) && !BAD2.test(w), 'ложное срабатывание: ' + w);
});

// ---------- проходимость (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без графов и бота)'); process.exit(failed ? 1 : 0); }
const NAV = {}, PASS = {};
for (const id of LVS.ids){ const LV = LVS.build(id); NAV[id] = navFor(PS, LV); PASS[id] = passability(PS, LV, NAV[id]); }
test('проходимость: в каждой экспедиции по физике (с пого) достижимы страж (до решётки) и арена хозяина — без предметов', () => {
  for (const id of LVS.ids){ const p = PASS[id]; ok(p.guardOk, id + ' страж'); ok(p.bossOk, id + ' арена'); }
});
test('проходимость: все самоцветы и пироги достижимы; предмет-отмычка — без чужих предметов; реликвия — только за дверью', () => {
  for (const id of LVS.ids){
    const p = PASS[id], LV = LVS.build(id);
    const miss = LV.items.filter(i => !p.all.got.has(i.id)); ok(!miss.length, id + ': недостижимы ' + miss.map(i => i.k + '@' + i.tx).join(' '));
    ok(p.itemOk, id + ' отмычка'); ok(p.relicOk, id + ' реликвия');
  }
});
test('пого — ключевая механика: в каждой экспедиции без посоха-пружины часть сокровищ недоступна', () => {
  for (const id of LVS.ids){
    const p = PASS[id], LV = LVS.build(id), noPogo = p.nav.itemsReach(e => !e.pogo);
    const lost = LV.items.filter(i => p.all.got.has(i.id) && !noPogo.got.has(i.id));
    ok(lost.length >= 2, id + ': без пого теряется только ' + lost.length);
  }
});
test('тайники за треснувшим камнем: с достижимого места героиня может ударить посохом по камню', () => {
  for (const id of LVS.ids){
    const p = PASS[id], cf = p.nav.crackFrom(), R = p.all.R, LV = LVS.build(id);
    const cracks = []; LV.t.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'c') cracks.push(x + ',' + y); }));
    for (const c of cracks) ok([...cf].some(k => k.startsWith(c + '|') && R.has(+k.split('|')[1])), id + ' камень ' + c);
  }
});
test('нелинейность без тупиков: в любом из 120 порядков экспедиций все 5 ключей берутся с первого захода, обе реликвии — не позже второго круга', () => {
  const ids = LVS.ids, perms = [];
  (function pr(a, rest){ if (!rest.length) perms.push(a); rest.forEach((x, i) => pr(a.concat(x), rest.slice(0, i).concat(rest.slice(i + 1)))); })([], ids);
  eq(perms.length, 120);
  // что даёт заход в экспедицию с набором предметов: ключ (если арена достижима), отмычка, реликвия (если дверь открыта)
  const visit = (id, have) => {
    const LV = LVS.build(id), p = PASS[id], open = LV.door && have[LV.door];
    const got = open ? p.all.got : p.noDoor.got, out = { key: open ? true : p.bossOk };
    LV.items.forEach(i => { if (got.has(i.id)){ if (i.k === 'item') out.item = i.what; if (i.k === 'relic') out.relic = i.what; } });
    return out;
  };
  for (const order of perms){
    const have = {}, keys = {}, relics = {};
    for (const id of order){ const v = visit(id, have); if (v.key) keys[id] = 1; if (v.item) have[v.item] = 1; if (v.relic) relics[v.relic] = 1; }
    eq(Object.keys(keys).length, 5, order.join('→'));
    for (const id of order){ const v = visit(id, have); if (v.relic) relics[v.relic] = 1; }
    eq(Object.keys(relics).length, 2, 'реликвии: ' + order.join('→'));
  }
});

// ---------- партии бота ----------
test('исполнимость: бот без урона проходит каждую экспедицию (страж, хозяин, ключ) в настоящей физике', () => {
  for (const id of LVS.ids){ const r = playExp(PS, id, 1, { god: true, nav: NAV[id], maxT: 400 }); ok(r.won, id + ': ' + JSON.stringify({ t: r.time, stuck: r.stuck, d: r.deaths })); }
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, разброс нажатий, иногда не замечает врага.
// 30 партий в первой выбранной экспедиции (Медные копи — глобус в лагере повёрнут к ним). Цель — «часто»: ≥ 70%.
const N = 30, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playExp(PS, 'mine', s, { nav: NAV.mine }));
test('баланс: «человеческий» бот проходит первую экспедицию в ≥ 70% партий, но не без потерь', () => {
  const n = BAL.filter(r => r.won).length, hurts = BAL.reduce((a, r) => a + r.hurts, 0), deaths = BAL.reduce((a, r) => a + r.deaths, 0);
  console.log('     Медные копи: ' + n + '/' + N + ' побед, ран ' + hurts + ', потерь жизни ' + deaths + ', ср. время ' + (BAL.reduce((a, r) => a + r.time, 0) / N).toFixed(0) + ' с');
  ok(n >= 0.7 * N, 'слишком сложно: ' + n + '/' + N); ok(hurts > N, 'слишком легко: ран ' + hurts);
  ok(!BAL.some(r => r.stuck), 'бот завис: ' + BAL.filter(r => r.stuck).map(r => r.seed).join());
});
test('баланс: остальные экспедиции «человеческому» боту тоже по силам (≥ 50% из 8 партий каждая)', () => {
  for (const id of LVS.ids.slice(1)){ let w = 0; for (let s = 1; s <= 8; s++) if (playExp(PS, id, s, { nav: NAV[id] }).won) w++; console.log('     ' + id + ': ' + w + '/8'); ok(w >= 4, id + ': ' + w + '/8'); }
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
