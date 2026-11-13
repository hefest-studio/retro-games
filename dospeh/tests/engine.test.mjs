/* ДОСПЕХ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node dospeh/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window.
   Проверяет: уровни и рецепты, физику (жёсткий прыжок, отвесный сход с края, лестницы), проходимость каждого уровня графом
   по настоящей физике (включая плоты и подъёмники во всех фазах), броню-здоровье, оружие, сундуки, таймер, жизни и продолжения,
   отметку, второй круг и Молот Горна, музыку, i18n, правило имён и партии «человеческого» бота. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, setTimeout, clearTimeout };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const D = sandbox.DOSPEH, L = D.logic, DT = 1 / 60;
const { playLevel, mulberry32, navFor } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function mk(o = {}){
  const ev = [];
  const game = D.Game({ rng: mulberry32(o.seed || 1), dmgMul: o.dmgMul, onEvent: (t, d) => ev.push({ t, d }) }).start();
  if (o.level != null || o.loop) game._level(o.level || 0, o.loop || 1);
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(typeof inp === 'function' ? inp(game.state()) : inp); game.update(DT); } game.setInput({}); }
function calm(S){ S.lv.rise = 1e9; S.lv.spawns.length = 0; S.lv.pits.length = 0; S.enemies = []; }
// ровный мир для физики: пол на ряду 13
function flat(w, fn){ const t = new Uint8Array(w * L.R); for (let c = 0; c < w; c++) for (let r = 13; r < L.R; r++) t[r * w + c] = L.SOL; if (fn) fn(t, w); return { W: w, R: L.R, t, plats: [] }; }

// ---------- уровни ----------
test('7 уровней (6 + финал): у каждого старт, отметка посередине, сундуки (первый — доспех), арена стража', () => {
  eq(D.LEVELS.length, 7);
  D.LEVELS.forEach((d, i) => {
    const lv = D.build(i);
    ok(lv.start && lv.arena && lv.cps.length === 1, d.key);
    ok(lv.cps[0].x > lv.start.x + 20 && lv.cps[0].x < lv.arena.x0 - 10, d.key + ': отметка в середине');
    ok(lv.chests.length >= 2 && lv.chests[0].c === 'arm', d.key + ': сундуки');
    ok(lv.W > 80 && lv.W < 230, d.key + ' ширина ' + lv.W);
    ok(['golem', 'crab', 'serpent', 'koshey'].includes(lv.arena.boss), d.key);
  });
  ok(D.LEVELS[6].final && D.build(6).arena.boss === 'koshey', 'финал — Кощей');
});
test('рецепт: неизвестный токен и слишком широкая пропасть — ошибка с именем уровня', () => {
  const save = D.LEVELS[0].r;
  try { D.LEVELS[0].r = 'S f5 zz B:golem'; let m = ''; try { D.build(0); } catch (e) { m = e.message; } ok(/wastes/.test(m) && /zz/.test(m), m);
    D.LEVELS[0].r = 'S f5 p4 f5 B:golem'; m = ''; try { D.build(0); } catch (e) { m = e.message; } ok(/пропасть/.test(m), m);
  } finally { D.LEVELS[0].r = save; }
});

// ---------- физика ----------
test('жёсткий прыжок: дуга фиксирована при толчке — ввод в полёте её не меняет; высота ≈ 2.5, длина ≈ 3.1 клетки', () => {
  const lv = flat(40), W = L.world(lv, 0, 0);
  const jump = (inAir) => { const h = L.newHero(10.5, 13); let top = 0; L.heroStep(W, h, { dx: 1, jump: true }, DT); for (let k = 0; k < 120 && !h.ground; k++){ L.heroStep(W, h, inAir, DT); top = Math.max(top, 13 - h.y); } return { x: h.x, top }; };
  const a = jump({ dx: 1 }), b = jump({ dx: -1 }), c = jump({ dx: 0, jump: true });
  ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.x - c.x) < 1e-9, 'приземление одно: ' + a.x + ' ' + b.x + ' ' + c.x);
  ok(a.top > 2.3 && a.top < 2.7, 'высота ' + a.top); ok(a.x - 10.5 > 2.9 && a.x - 10.5 < 3.3, 'длина ' + (a.x - 10.5));
  // прыжок на месте — на месте
  const h = L.newHero(10.5, 13); L.heroStep(W, h, { dx: 0, jump: true }, DT); for (let k = 0; k < 120 && !h.ground; k++) L.heroStep(W, h, { dx: 1 }, DT);
  ok(Math.abs(h.x - 10.5) < 1e-9, 'вертикальный прыжок не сносит: ' + h.x);
});
test('сход с края — отвесное падение (без инерции), удар о стену в полёте гасит ход', () => {
  const lv = flat(30, (t, w) => { for (let r = 0; r < L.R; r++) { t[r * w + 15] = 0; t[r * w + 16] = 0; t[r * w + 17] = 0; } for (let r = 10; r < 13; r++) t[r * w + 22] = L.SOL; });
  const W = L.world(lv, 0, 0), h = L.newHero(14.5, 13);
  let x0 = null; for (let k = 0; k < 200; k++){ L.heroStep(W, h, { dx: 1 }, DT); if (!h.ground && x0 === null) x0 = h.x; if (h.y > 15) break; }
  ok(x0 !== null && Math.abs(h.x - x0) < 1e-9, 'падает отвесно: ' + x0 + ' → ' + h.x);
  const h2 = L.newHero(20.5, 13); L.heroStep(W, h2, { dx: 1, jump: true }, DT); for (let k = 0; k < 120 && !h2.ground; k++) L.heroStep(W, h2, {}, DT);
  ok(h2.x < 22 - L.HW + 0.01, 'стена остановила: ' + h2.x);
});
test('лестница: ↑ поднимает на верх утёса, ↓ спускает обратно; прыжок с лестницы невозможен', () => {
  const lv = D.build(0), W = L.world(lv, 0, 0);
  let lc = -1, lr = -1; for (let c = 0; c < lv.W && lc < 0; c++) for (let r = 0; r < L.R; r++) if (lv.t[r * lv.W + c] === L.LAD){ lc = c; lr = r; break; }
  ok(lc > 0, 'есть лестница'); let rb = lr; while (lv.t[(rb + 1) * lv.W + lc] === L.LAD) rb++;
  const h = L.newHero(lc + 0.5, rb + 1);
  for (let k = 0; k < 300 && !(h.ground && !h.climb && k > 5); k++) L.heroStep(W, h, { up: true, jump: k > 3 && k % 2 === 0 }, DT);
  eq(h.y, lr, 'наверху'); ok(h.ground && !h.climb);
  for (let k = 0; k < 300 && !(h.ground && !h.climb && h.y === rb + 1); k++) L.heroStep(W, h, { down: true }, DT);
  eq(h.y, rb + 1, 'внизу');
});

// ---------- проходимость ----------
test('проходимость: от старта до арены каждого уровня есть путь по графу настоящей физики (прыжки с допуском ±0.08)', () => {
  for (let i = 0; i < 7; i++){ const N = navFor(D, i), s = N.nav.nodeAt(N.lv.start.x, N.lv.start.y); ok(s >= 0, 'старт'); ok(N.dist.has(s), N.lv.key + ': арена недостижима'); }
});
test('плоты и подъёмники: заученная переправа (реакция 0.25 с) удаётся при любой фазе прихода', () => {
  let n = 0;
  for (let i = 0; i < 7; i++){ const lv = D.build(i); lv.plats.forEach((p, k) => {
    const cyc = L.platPhase(p, 0).cyc;
    for (let t0 = 0; t0 < cyc; t0 += cyc / 16){
      const h = L.newHero(p.kind === 'h' ? p.x0 - 1.5 : p.x0 - 0.5, p.y0); let t = t0, st = {}, res = null;
      for (let s = 0; s < 60 * 30; s++){ const W = L.world(lv, t, DT), c = L.rideCtl(lv, k, st, h, t, 0.25); if (c.done || c.fail){ res = c; break; } L.heroStep(W, h, c, DT); t += DT; if (h.y > L.R) break; }
      ok(res && res.done, lv.key + ' плот ' + k + ' фаза ' + t0.toFixed(2) + ': ' + st.k); n++;
    }
  }); }
  ok(n >= 100, 'проверено переправ: ' + n);
});
test('исполнимость: бот без урона проходит каждый уровень в настоящей физике (прыжки, лестницы, плоты, страж)', () => {
  for (let i = 0; i < 7; i++) for (const s of [1, 2]){ const r = playLevel(D, s, { level: i, dmgMul: 0, noFoes: true, maxT: 400 }); ok(r.cleared && !r.deaths, D.LEVELS[i].key + ' сид ' + s + ': ' + JSON.stringify(r.why) + (r.stuck ? ' застрял ' + JSON.stringify(r.stuckAt) : '')); }
});

// ---------- броня ----------
test('броня — здоровье: 1-й удар сбивает доспех (герой жив, неуязвим), 2-й — гибель', () => {
  const { game, S, has } = mk(); calm(S);
  eq(S.hero.armor, 1); S.hero.inv = 0;
  game._hurt('riser', S.hero.x + 1); eq(S.hero.armor, 0); eq(S.phase, 'play'); ok(S.hero.inv > 1 && has('armorOff'));
  game._hurt('riser'); eq(S.phase, 'play', 'неуязвим после удара');
  run(game, 2); game._hurt('riser'); eq(S.phase, 'dead'); ok(has('die'));
  run(game, 2); eq(S.lives, 2); eq(S.phase, 'play'); eq(S.hero.armor, 1, 'после гибели — снова в доспехе');
});
test('сундук: открывается со 2-го попадания; доспех: без брони → доспех, «золото» на доспех → золотой', () => {
  const { game, S, has } = mk(); calm(S);
  const ch = S.chests[0]; game._place(ch.x - 3, ch.y); S.hero.face = 1;
  for (let k = 0; k < 2; k++){ game._throw(false); run(game, 0.5); }
  ok(ch.open && has('chest'), 'открыт'); ok(S.items.some(it => it.k === 'arm'));
  S.hero.armor = 0; game._pickup({ k: 'arm' }); eq(S.hero.armor, 1);
  game._pickup({ k: 'gold' }); eq(S.hero.armor, 2);
  S.hero.armor = 0; game._pickup({ k: 'gold' }); eq(S.hero.armor, 1, 'золото поверх фартука — только доспех');
});
test('ловушка в сундуке выпускает Шатуна', () => {
  const { game, S, has } = mk(); calm(S);
  game._openChest({ x: S.hero.x + 4, y: S.hero.y, c: 'trap', hp: 0 }); ok(has('trap') && S.enemies.some(e => e.type === 'brute'));
});
test('особый удар: только в золотом доспехе, удержание ≥ ' + L.CHARGE + ' с и отпускание', () => {
  for (const arm of [1, 2]){
    const { game, S, has } = mk(); calm(S); S.hero.armor = arm; S.hero.inv = 0;
    run(game, 0.1); run(game, L.CHARGE + 0.15, { fire: true }); run(game, 0.1);
    eq(has('special'), arm === 2, 'доспех ' + arm);
  }
  const { game, S } = mk(); calm(S); S.hero.armor = 2; S.weapon = 'blades'; run(game, 0.1); run(game, L.CHARGE + 0.1, { fire: true }); run(game, 0.05);
  ok(S.shots.filter(s => s.sp).length === 8, 'клинки — во все 8 сторон');
});

// ---------- оружие ----------
test('оружие: копьё — до 2 в полёте; топорик — дугой и насквозь; факел оставляет огонь на земле; клинки — тройка на короткую дистанцию', () => {
  let { game, S } = mk(); calm(S); S.weapon = 'spear';
  ok(game._throw(false) && game._throw(false) && !game._throw(false), 'копий в полёте не больше 2');
  ({ game, S } = mk()); calm(S); S.weapon = 'axe'; game._throw(false); const ax = S.shots[0]; ok(ax.vy < 0 && ax.g > 0 && ax.pierce, 'топорик дугой, насквозь');
  ({ game, S } = mk()); calm(S); S.weapon = 'torch'; game._throw(false); ok(!game._throw(false), 'факел один'); run(game, 1.2); ok(S.flames.length === 1, 'огонь на земле'); ok(!game._throw(false), 'пока горит — второго нет');
  ({ game, S } = mk()); calm(S); S.weapon = 'blades'; game._throw(false); eq(S.shots.length, 3); const x0 = S.hero.x; run(game, 0.5); eq(S.shots.length, 0, 'клинки летят недалеко'); void x0;
});
test('щит-отражатель гасит вражеские снаряды и возвращается', () => {
  const { game, S, has } = mk(); calm(S); S.weapon = 'shield'; S.hero.face = 1;
  S.eshots.push({ kind: 'slag', x: S.hero.x + 4, y: S.hero.y - 1.1, vx: -3, vy: 0, r: 0.3, life: 4 });
  game._throw(false); run(game, 0.6); ok(has('block') && !S.eshots.length, 'снаряд погашен');
  run(game, 1.5); eq(S.shots.length, 0, 'щит вернулся');
});
test('Молот Горна: только на втором круге (первый сундук каждого уровня), в выпадениях не бывает', () => {
  let { S } = mk({ level: 0, loop: 1 }); ok(!S.chests.some(c => c.c === 'hammer'), 'круг 1 — нет');
  for (let i = 0; i < 7; i++){ ({ S } = mk({ level: i, loop: 2 })); eq(S.chests[0].c, 'hammer', 'круг 2, уровень ' + i); }
  const { game, S: S2 } = mk(); game._pickup({ k: 'w:hammer' }); ok(S2.weapon !== 'hammer', 'подбор w:hammer игнорируется');
});

// ---------- таймер, жизни, продолжения, отметка ----------
test('таймер уровня: по истечении — гибель «время вышло»', () => {
  const { game, S, ev } = mk(); calm(S); S.timer = 1; run(game, 1.2); eq(S.phase, 'dead'); ok(ev.some(e => e.t === 'die' && e.d.why === 'time'));
});
test('отметка: после гибели — с наковальни-отметки, таймер заново', () => {
  const { game, S, has } = mk(); calm(S); const cp = S.lv.cps[0];
  game._place(cp.x + 0.2, cp.y); run(game, 0.1); ok(has('checkpoint') && S.cp === 0);
  S.timer = 50; S.hero.armor = 0; S.hero.inv = 0; game._hurt('riser'); run(game, 2);
  ok(Math.abs(S.hero.x - cp.x) < 0.01, 'респаун на отметке: ' + S.hero.x); ok(S.timer > L.TIME - 1, 'таймер заново: ' + S.timer);
});
test('жизни и продолжения: 0 жизней → «Продолжить?»; продолжение — 3 жизни, счёт 0, тот же уровень; отказ — конец', () => {
  const { game, S, has } = mk({ level: 2 }); calm(S); S.lives = 1; S.score = 1234;
  S.hero.armor = 0; S.hero.inv = 0; game._hurt('riser'); run(game, 2); eq(S.phase, 'cont'); ok(has('continueQ'));
  ok(game.continueGame()); eq(S.lives, L.LIVES); eq(S.score, 0); eq(S.li, 2); eq(S.conts, L.CONTS - 1); eq(S.phase, 'play');
  S.conts = 0; S.lives = 1; calm(S); S.hero.armor = 0; S.hero.inv = 0; game._hurt('riser'); run(game, 2); eq(S.phase, 'over', 'без продолжений — конец'); ok(has('gameover'));
});

// ---------- второй круг ----------
test('второй круг обязателен: победа над Кощеем на 1-м круге → холодное Сердце → круг 2 с уровня 1', () => {
  const { game, S, has } = mk({ level: 6 }); calm(S);
  game._place(S.lv.arena.x0 + 4, S.lv.arena.y); run(game, 0.1); ok(S.boss && S.boss.key === 'koshey');
  run(game, 2); game._bossDamage(999, 'spear'); eq(S.phase, 'clear'); run(game, 3.5); eq(S.phase, 'loopEnd'); ok(!has('win'), 'не победа');
  run(game, 7.2); eq(S.loop, 2); eq(S.li, 0); eq(S.phase, 'play'); ok(has('loop2'));
});
test('круг 2: ключ Кощея берёт только Молот Горна; у входа на арену — Молот на постаменте; победа — истинный финал', () => {
  const { game, S, has } = mk({ level: 6, loop: 2 }); calm(S);
  game._place(S.lv.arena.x0 + 4, S.lv.arena.y); run(game, 0.1);
  ok(S.items.some(it => it.k === 'hammer' && it.pedestal), 'молот на постаменте');
  run(game, 2); const hp = S.boss.hp; game._bossDamage(5, 'spear'); eq(S.boss.hp, hp, 'копьё — дзинь'); ok(has('clink'));
  game._bossDamage(3, 'hammer'); eq(S.boss.hp, hp - 3, 'молот бьёт');
  game._bossDamage(999, 'hammer'); run(game, 3.5); eq(S.phase, 'won'); ok(has('win'));
});
test('круг 1: Кощея берёт любое оружие', () => {
  const { game, S } = mk({ level: 6 }); calm(S); game._place(S.lv.arena.x0 + 4, S.lv.arena.y); run(game, 2.2);
  const hp = S.boss.hp; game._bossDamage(1, 'spear'); eq(S.boss.hp, hp - 1);
});
test('страж уровня роняет ключ; ключ — уровень пройден, бонус за время, следующий уровень в доспехе', () => {
  const { game, S, has } = mk({ level: 0 }); calm(S); game._place(S.lv.arena.x0 + 4, S.lv.arena.y); run(game, 2);
  game._bossDamage(999, 'spear'); const key = S.items.find(it => it.k === 'key'); ok(key, 'ключ');
  S.hero.armor = 0; game._place(key.x, S.lv.arena.y); run(game, 1.5); eq(S.phase, 'clear'); ok(has('clear'));
  run(game, 3.5); eq(S.li, 1); eq(S.hero.armor, 1);
});

// ---------- музыка, i18n ----------
test('музыка: Arcade.tracks.dospeh и тема стража — оригинальные треки в нотации движка', () => {
  const A = sandbox.Arcade, re = /^(?:[A-G][#b]?\d|-|\.|\|)$/;
  for (const tr of [A.tracks.dospeh, D.MUSIC.boss]){
    ok(tr.bpm > 60 && tr.div === 2, 'bpm/div');
    const mel = [].concat(tr.melody).join(' ').split(/\s+/).filter(Boolean), bass = tr.bass.split(/\s+/).filter(Boolean);
    ok(mel.every(x => re.test(x)) && bass.every(x => re.test(x)), 'ноты');
    ok(/^[ksho. |]+$/.test(tr.drums), 'ударные');
    const steps = s => s.split(/\s+/).filter(x => x && x !== '|').length;
    ok(steps([].concat(tr.melody).join(' ')) % 8 === 0 && steps(tr.bass) % 8 === 0, 'такты по 8 шагов');
  }
});
test('i18n: у RU и EN одинаковые ключи; есть имена уровней, стражей, оружия, врагов и причин гибели', () => {
  const ru = Object.keys(D.STR.ru).sort(), en = Object.keys(D.STR.en).sort(); eq(ru.join(','), en.join(','));
  D.LEVELS.forEach(d => ok(D.STR.ru['lv_' + d.key] && D.STR.en['b_' + d.key], d.key));
  L.WLIST.forEach(w => ok(D.STR.ru['w_' + w] && D.STR.en['w_' + w], w));
  Object.keys(L.FOE).forEach(f => ok(D.STR.ru['f_' + f] && D.STR.en['d_' + f], f));
  ['pit', 'liquid', 'time', 'slag', 'bubble', 'bolt', 'rust', 'boss'].forEach(k => ok(D.STR.ru['d_' + k], k));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория; вторая часть — оригиналы жанра этой игры
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8')
    + '|' + Buffer.from('Z2hvc3RzP1xXezAsM30nP24nP1xXezAsM31nb2JsaW5zfGdob3Vsc3xtYWthaSA/bXVyYXzQvNCw0LrQsNC50LzRg9GAfNC80LDQutCw0LjQvNGD0YB8XGJhcnRodXJ80LDRgNGC0YPRgHzQs9C+0YPQu9C3fNCz0L7QsdC70LjQvdGB', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('Гефест') && !BAD.test('доспех') && !BAD.test('author') && !BAD.test('artifact') && !BAD.test('Кощей') && !BAD.test('CONTRACT.md'), 'стоп-лист без ложных срабатываний на наши слова');
  ok(BAD.test(Buffer.from('R2hvdWxz', 'base64').toString()), 'стоп-лист ловит оригинал жанра');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, не сразу замечает часть врагов и снарядов, ошибается в месте толчка.
// Уровень 1 с 3 жизнями: цель — коридор 50–90% (сложно, но честно); остальные уровни — проходимы человеком (≥ 5%).
const N1 = 40;
test('баланс: бот проходит уровень 1 в 50–90% партий (3 жизни, без продолжений)', () => {
  const R = []; for (let s = 1; s <= N1; s++) R.push(playLevel(D, s, { level: 0 }));
  const n = R.filter(r => r.cleared).length, why = {}; R.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const lost = R.reduce((a, r) => a + r.armorLost, 0);
  console.log('     уровень 1: ' + n + '/' + N1 + '; сбитых доспехов ' + lost + '; гибели: ' + JSON.stringify(why));
  ok(n >= 0.5 * N1, 'слишком сложно: ' + n + '/' + N1); ok(n <= 0.9 * N1, 'слишком легко: ' + n + '/' + N1);
  ok(!R.some(r => r.stuck), 'бот застрял: ' + R.filter(r => r.stuck).map(r => r.seed).join(','));
});
test('баланс: уровни 2–7 проходимы «человеком» (≥ 5% партий), второй круг уровня 1 тяжелее первого', () => {
  const out = [];
  for (let i = 1; i < 7; i++){ let n = 0; for (let s = 1; s <= 20; s++) if (playLevel(D, s, { level: i }).cleared) n++; out.push(D.LEVELS[i].key + ' ' + n + '/20'); ok(n >= 1, D.LEVELS[i].key + ': ' + n + '/20'); }
  let a = 0, b = 0; for (let s = 1; s <= 20; s++){ if (playLevel(D, s, { level: 0 }).cleared) a++; if (playLevel(D, s, { level: 0, loop: 2 }).cleared) b++; }
  console.log('     ' + out.join(', ') + '; уровень 1: круг 1 — ' + a + '/20, круг 2 — ' + b + '/20');
  ok(b <= a, 'второй круг не легче');
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
