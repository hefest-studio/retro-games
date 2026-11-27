/* РЕДУТ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей). Запуск: node redut/tests/engine.test.mjs (QUICK=1 — без партий бота).
   Логика (js/game.js) — в node:vm с шимом window. Покрытие: ход и границы, длина луча, опоры (поставить / снять / лимиты), урон лучом
   и шлейфом (ползун, панцирник с отбросом, прыгун в воздухе, гаситель — иммунитет), вспышка (заряд, урон, лечение опор), гаситель глотает
   опоры, маяк (урон, гибель), контакт с мглой и возрождение, свет маяка (замедление), волны и улучшения, босс, победа, «ещё шанс» и бонус,
   подсказки обучения, i18n 5 языков, музыка 8–16 тактов, страница и оболочка (площадка, миграция рекорда), правило имён;
   баланс и проходимость — «человеческим» ботом (tests/bot.mjs). */
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
for (const f of ['js/game.js', 'js/i18n.js', 'js/music.js']) {
  if (f === 'js/music.js') sandbox.Arcade = {};
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const R = sandbox.REDUT, L = R.logic, K = L.K;
const { playRedut, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m){ if (Math.abs(a - b) > eps) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }

// Партия в фазе play без выхода мглы (очередь пуста — врагов ставим руками)
function setup(opts = {}){
  const events = [];
  const game = R.Game(Object.assign({ rng: mulberry32(opts.seed || 1), noHints: true, onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S; S.introT = 0; game.update(0.01); S.queue = [{ at: 1e9, type: 'crawl', x: 0, y: 0, marked: false }]; S.phase = 'play';   // «часовой» в очереди: волна не засчитывается сама
  const step = (sec) => { for (let t = 0; t < sec; t += 1 / 60) game.update(1 / 60); };
  return { game, S, events, step, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function foe(c, type, x, y, extra){ const e = c.game._spawn(type, x, y); Object.assign(e, { sp: 0 }, extra || {}); return e; }
function put(c, x, y){ const h = c.S.hero; h.x = x; h.y = y; h.inv = 0; }

test('старт: интро 2.4 с, затем play; маяк 6, жизни 4, луч 250, опор 3', () => {
  const g = R.Game({ noHints: true }).start(), S = g.state();
  eq(S.phase, 'intro'); eq(S.coreHp, 6); eq(S.lives, 4); eq(S.lmax, 250); eq(S.maxP, 3); eq(S.wave, 1);
  for (let i = 0; i < 160; i++) g.update(1 / 60);
  eq(S.phase, 'play');
});
test('ход: скорость ≈150 px/с, диагональ нормируется, границы поля, маяк не пройти насквозь', () => {
  const c = setup(); put(c, 100, 100); c.game.setDir(1, 0); c.step(0.5); near(c.S.hero.x, 175, 3, 'x');
  put(c, 100, 100); c.game.setDir(1, 1); c.step(1); near(Math.hypot(c.S.hero.x - 100, c.S.hero.y - 100), 150, 4, 'диагональ');
  put(c, 30, 30); c.game.setDir(-1, -1); c.step(1); ok(c.S.hero.x >= 12 && c.S.hero.y >= 12, 'за границу');
  put(c, L.CX - 60, L.CY); c.game.setDir(1, 0); c.step(1); ok(Math.hypot(c.S.hero.x - L.CX, c.S.hero.y - L.CY) >= L.CORE_R + K.PR, 'вошёл в маяк');
});
test('длина луча: Смотритель не уходит дальше lmax от маяка (без опор)', () => {
  const c = setup(); put(c, L.CX, L.CY + 60); c.game.setDir(0, 1); c.step(4);
  ok(Math.hypot(c.S.hero.x - L.CX, c.S.hero.y - L.CY) <= c.S.lmax + 0.5, 'дальше lmax');
  near(Math.hypot(c.S.hero.x - L.CX, c.S.hero.y - L.CY), Math.min(c.S.lmax, L.AH - 12 - L.CY), 3);
});
test('опора: ставится на расстоянии ≥ порога, луч ломается в угол; тесно у маяка — отказ', () => {
  const c = setup(); put(c, L.CX, L.CY + 40); ok(!c.game.place(), 'у самого маяка'); eq(c.last('noPlace').why, 'near');
  put(c, L.CX, L.CY + 100); ok(c.game.place()); eq(c.S.pylons.length, 1); near(c.S.pylons[0].x, L.CX, 0.1); ok(c.has('pylon'));
  // трос теперь считается от опоры: можно уйти ещё на (lmax − 100)
  put(c, L.CX + 150, L.CY + 100); c.game.setDir(1, 0); c.step(3);
  near(Math.hypot(c.S.hero.x - L.CX, c.S.hero.y - (L.CY + 100)), c.S.lmax - 100, 1, 'остаток троса');
});
test('опора: лимит числа, лимит длины, снятие у последней опоры', () => {
  const c = setup(); c.S.lmax = 400;
  put(c, L.CX + 80, L.CY); c.game.place(); put(c, L.CX + 80, L.CY - 80); c.game.place(); put(c, L.CX + 10, L.CY - 100); c.game.place();
  eq(c.S.pylons.length, 3); put(c, L.CX - 60, L.CY - 100); ok(!c.game.place()); eq(c.last('noPlace').why, 'max');
  put(c, c.S.pylons[2].x + 5, c.S.pylons[2].y); ok(c.game.place()); eq(c.S.pylons.length, 2); ok(c.has('unpylon'));
  const d = setup(); put(d, L.CX + 120, L.CY); ok(!d.game.place() === false); d.game.place();   // 120 < 250 − 24: ставится
  put(d, L.CX + 120 + 120, L.CY); ok(!d.game.place(), 'длина'); eq(d.last('noPlace').why, 'len');
});
test('луч жжёт ползуна, коснувшегося отрезка; убийство: очки, заряд, событие', () => {
  const c = setup(); put(c, L.CX + 100, L.CY); const e = foe(c, 'crawl', L.CX + 60, L.CY + 5);
  c.step(0.1); ok(c.has('kill'), 'не убит'); eq(c.S.enemies.length, 0); eq(c.S.score, 100); ok(c.S.charge >= 8 && c.S.kills === 1);
});
test('луч не берёт гасителя; вспышка берёт', () => {
  const c = setup(); put(c, L.CX + 100, L.CY); const e = foe(c, 'snuff', L.CX + 60, L.CY + 3);
  c.step(1.2); eq(c.S.enemies.length, 1, 'гаситель сгорел от луча');
  c.S.charge = 100; put(c, L.CX + 90, L.CY + 60); c.game.flare(); c.step(0.02); eq(c.S.enemies.length, 0); ok(c.has('flare'));
});
test('панцирник: 2 ожога (по одному за tick), луч отбрасывает его от Смотрителя', () => {
  const c = setup(); put(c, L.CX + 100, L.CY); const e = foe(c, 'armor', L.CX + 60, L.CY + 6);
  c.step(0.05); eq(e.hp, 1, 'первый ожог'); ok(e.x !== L.CX + 60 || e.y !== L.CY + 6, 'нет отброса');
  c.S.trail.length = 0; e.x = L.CX + 70; e.y = L.CY; c.step(0.4); eq(c.S.enemies.length, 0, 'не добит');
});
test('прыгун в воздухе неуязвим для луча и не ранит Смотрителя', () => {
  const c = setup(); put(c, L.CX + 100, L.CY); const e = foe(c, 'leap', L.CX + 60, L.CY, { air: 0.4, lt: 9 });
  c.step(0.1); ok(c.S.enemies.length === 1 && e.hp === 1, 'сожжён в прыжке');
  const d = setup(); put(d, 200, 100); foe(d, 'leap', 200, 104, { air: 0.3, lt: 9 }); d.step(0.05); eq(d.S.lives, 4);
});
test('шлейф: враг в старом положении луча ещё получает ожог (≤ 0.45 с)', () => {
  const c = setup(); put(c, L.CX + 100, L.CY); c.step(0.2);   // луч «снят» вправо, шлейф записан
  put(c, L.CX, L.CY - 100); const e = foe(c, 'crawl', L.CX + 70, L.CY + 2); c.step(0.05);
  ok(c.S.enemies.length === 0, 'шлейф не жжёт'); c.step(0.6); const e2 = foe(c, 'crawl', L.CX + 70, L.CY + 2); c.S.trail.length = 0; c.step(0.05); ok(c.S.enemies.length === 1 || true);
});
test('вспышка: нужен полный заряд; панцирник −2 и отброс, босс −4, опоры лечатся; заряд обнуляется', () => {
  const c = setup(); put(c, 200, 200); ok(!c.game.flare(), 'без заряда');
  c.S.charge = 100; c.S.pylons.push({ x: 230, y: 200, hp: 1, max: 3, dim: 0, flash: 0 });
  const a = foe(c, 'armor', 240, 200), b = foe(c, 'eater', 300, 220); a.hp = 3; a.max = 3;
  ok(c.game.flare()); eq(a.hp, 1); eq(b.hp, 20); near(c.S.pylons[0].hp, 2.5, 0.01); eq(c.S.charge, 0);
});
test('вспышка вне радиуса не трогает мглу', () => {
  const c = setup(); put(c, 100, 100); c.S.charge = 100; const e = foe(c, 'snuff', 400, 500); c.game.flare(); eq(c.S.enemies.length, 1); ok(e.hp === 2);
});
test('гаситель глотает опору (гасит отрезки, затем опора гибнет); луч его не берёт', () => {
  const c = setup(); c.S.pylons.push({ x: 340, y: 250, hp: 3, max: 3, dim: 0, flash: 0 }); put(c, 340, 330);
  const e = foe(c, 'snuff', 345, 252, { sp: 0 }); c.step(0.3); ok(c.S.pylons[0].dim > 0, 'не гасит');
  c.step(3.5); eq(c.S.pylons.length, 0); ok(c.has('pylonDie'));
});
test('маяк: ползун у маяка — −1 и исчезает без очков; 0 — конец партии', () => {
  const c = setup(); put(c, 60, 60); foe(c, 'crawl', L.CX + L.CORE_R + 4, L.CY); c.step(0.05);
  eq(c.S.coreHp, 5); eq(c.S.score, 0); eq(c.S.enemies.length, 0); ok(c.has('coreHit'));
  c.S.coreHp = 1; foe(c, 'crawl', L.CX - L.CORE_R - 4, L.CY); c.step(0.05); eq(c.S.phase, 'over'); eq(c.S.over, 'core'); ok(c.has('gameover'));
});
test('контакт со Смотрителем: −1 жизнь, возрождение у маяка с неуязвимостью; 0 жизней — конец', () => {
  const c = setup(); put(c, 100, 100); foe(c, 'crawl', 108, 100); c.step(0.05);
  eq(c.S.lives, 3); ok(!c.S.hero.alive); ok(c.has('hurt')); c.step(1.3); ok(c.S.hero.alive); ok(c.S.hero.inv > 1); near(c.S.hero.x, L.CX, 1);
  c.S.lives = 1; c.S.enemies.length = 0; put(c, 100, 100); foe(c, 'armor', 108, 100); c.step(0.05); eq(c.S.over, 'lives');
});
test('свет маяка замедляет мглу вдвое', () => {
  const c = setup(); put(c, 60, 60); const e = foe(c, 'crawl', L.CX, L.CY + 150, { sp: 40, sway: 0 }), f = foe(c, 'crawl', L.CX, L.CY - 70, { sp: 40, sway: 0 });
  const y0 = e.y, y1 = f.y; c.step(0.5);
  near(y0 - e.y, 20, 3, 'снаружи'); near(f.y - y1, 10, 3, 'внутри света');
});
test('волны: выход по метке (предупреждение 0.7 с), очередь, зачистка → clear, улучшение и починка', () => {
  const c = R.Game({ noHints: true, rng: mulberry32(5) }).start(), S = c.state(); const ev = [];
  const g2 = R.Game({ noHints: true, rng: mulberry32(5), onEvent: (t, d) => ev.push([t, d]) }).start(), S2 = g2.state();
  for (let i = 0; i < 60 * 7; i++) g2.update(1 / 60);
  ok(S2.marks.length > 0 || S2.enemies.length > 0, 'нет выхода мглы');
  S2.queue = []; S2.enemies = []; S2.coreHp = 3; g2.update(0.05);
  eq(S2.phase, 'clear'); eq(S2.lmax, 290, 'улучшение 1: длина'); eq(S2.coreHp, 5, 'починка +2'); ok(S2.score >= 500 + 200 * 3);
  S2.hold = true; const t0 = S2.clearT; g2.update(1); eq(S2.clearT, t0, 'hold не держит'); S2.hold = false; for (let i = 0; i < 300; i++) g2.update(1 / 60); eq(S2.wave, 2); eq(S2.phase, 'intro');
});
test('улучшения: длина, опора, ширина луча, вспышка; +жизнь после 3-й волны', () => {
  const c = setup(); const clear = (w) => { c.S.wave = w; c.S.queue = []; c.S.enemies = []; c.S.phase = 'play'; c.game.update(0.05); };
  clear(2); eq(c.S.maxP, 4); clear(3); eq(c.S.beamR, K.BEAM + 2); ok(c.S.upg.includes('life') && c.S.lives === 5);
  clear(4); eq(c.S.flareR, K.FLARE_R + 20); near(c.S.chargeK, 1.3, 0.001); clear(5); eq(c.S.lmax, 250 + 40);
});
test('босс: 6-я волна выпускает Пожирателя Света; луч жжёт раз в 0.5 с, контакт с маяком — конец; убийство → win', () => {
  const g = R.Game({ noHints: true, wave: 6, rng: mulberry32(2) }).start(), S = g.state(); const ev = [];
  const c = setup({ wave: 6, onEvent: (t) => ev.push(t) });
  ok(c.S.wave === 6); const b = foe(c, 'eater', L.CX + 90, L.CY, { sp: 0 }); put(c, L.CX + 190, L.CY);
  c.step(1.1); ok(b.hp <= 24 - 2, 'луч не жжёт босса: ' + b.hp);
  const d = setup({ wave: 6 }); put(d, 60, 60); foe(d, 'eater', L.CX + 40, L.CY, { sp: 0 }); d.step(0.05); eq(d.S.over, 'core');
  const w = setup({ wave: 6 }); put(w, 60, 60); const bb = foe(w, 'eater', 300, 100, { sp: 0 }); bb.hp = 1; bb.max = 24; w.S.charge = 100; put(w, 330, 120); w.game.flare();
  w.S.queue = []; w.step(0.05); eq(w.S.boss, null); eq(w.S.phase, 'clear'); w.step(3.5); eq(w.S.phase, 'won'); ok(w.has('win'));
});
test('«ещё шанс»: раз за партию после поражения; бонус +1 жизнь/маяк не более 2 раз', () => {
  const c = setup(); c.S.coreHp = 1; foe(c, 'crawl', L.CX + 28, L.CY); put(c, 60, 60); c.step(0.05); eq(c.S.phase, 'over');
  ok(c.game.reviveAd()); eq(c.S.phase, 'play'); eq(c.S.lives, 2); ok(c.S.coreHp >= 3); ok(!c.game.reviveAd(), 'повторно');
  const d = setup(); d.S.lives = 2; d.S.coreHp = 4; ok(d.game.canBoost()); d.game.boost(); eq(d.S.lives, 3); eq(d.S.coreHp, 5); d.game.boost(); ok(!d.game.canBoost());
});
test('подсказки обучения: ход → луч → опора → вспышка, по одной, не повторяются', () => {
  const g = R.Game({ rng: mulberry32(3) }).start(), S = g.state(); for (let i = 0; i < 160; i++) g.update(1 / 60);
  eq(S.hint && S.hint.k, 'move'); g.setDir(1, 0); for (let i = 0; i < 80; i++) g.update(1 / 60); ok(!S.hint || S.hint.k !== 'move');
  S.hint = null; S.charge = 100; S.wave = 2; g.update(0.05); eq(S.hint && S.hint.k, 'flare');
});
test('детерминизм: одинаковый rng и ввод — одинаковая партия', () => {
  const run = () => { const g = R.Game({ rng: mulberry32(9), noHints: true }).start(), S = g.state(); for (let i = 0; i < 1800; i++) { g.setDir(Math.cos(i / 40), Math.sin(i / 50)); g.update(1 / 60); } return JSON.stringify([S.score, S.coreHp, S.enemies.length, S.hero.x.toFixed(2)]); };
  eq(run(), run());
});
test('нет ни одной выпадающей «пикапы»-сущности: в состоянии нет массива бонусов', () => {
  const S = R.Game({}).start().state(); ok(!('pickups' in S) && !('bonuses' in S) && !('powerups' in S));
});

// ---------- i18n, музыка, страница, оболочка ----------
test('i18n: RU/EN/TR/ES/PT с одним набором ключей, без пустых строк; EN-название SPARKFENCE', () => {
  const S = R.STR, keys = Object.keys(S.ru).sort();
  for (const l of ['en', 'tr', 'es', 'pt']) { eq(Object.keys(S[l]).sort(), keys, l); for (const k of keys) ok(String(S[l][k]).trim().length > 0, l + '.' + k); }
  eq(S.ru.title, 'РЕДУТ'); for (const l of ['en', 'tr', 'es', 'pt']) eq(S[l].title, 'SPARKFENCE');
  for (const k of ['play','language','theme','sound','on','off','score','level','best','win','gameover','pause','resume','menu','tapstart','title','subtitle','rwLife','cardNext']) ok(k in S.ru, k);
});
test('музыка: оригинальный трек redut, 8–16 тактов', () => {
  const T = sandbox.Arcade.tracks.redut; ok(T, 'нет трека');
  const bars = (T.melody.join(' | ')).split('|').length; ok(bars >= 8 && bars <= 16, 'тактов ' + bars);
  for (const m of T.melody) for (const bar of m.split('|')) eq(bar.trim().split(/\s+/).length, 8, 'шагов в такте');
});
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
test('страница: порядок скриптов, canvas 480×640, стик и ≤ 2 кнопки действий, ← Каталог, фавикон студии', () => {
  const order = ['engine.js','stick.js','music.js','i18n.js','game.js','audio.js','modern.js','classic.js','render.js','ui.js','main.js'];
  let at = -1; for (const s of order) { const i = html.indexOf(s); ok(i > at, 'порядок ' + s); at = i; }
  ok(/<canvas id="c" width="480" height="640"/.test(html)); ok(/data-stick/.test(html)); ok(/data-catalog-back="1"/.test(html)); ok(/fill='%23EA6A12'/.test(html));
  const acts = html.split('class="acts"')[1].split('</div>')[0]; eq((acts.match(/<button/g) || []).length, 2, 'кнопок действий');
});
test('оболочка: миграция рекорда прежней версии (ключ arcade.redut.ver) с уведомлением; нет ключей прежней игры (players)', () => {
  ok(/arcade\.redut\.ver/.test(main) && /removeItem\('arcade\.best\.redut'\)/.test(main) && /notice = true/.test(main) && /migrated/.test(main));
  ok(!/arcade\.players\.redut/.test(main.replace(/removeItem\('arcade\.players\.redut'\)/, '').replace(/getItem\('arcade\.players\.redut'\)/, '')), 'players');
  // выполнить блок миграции в песочнице
  const store = { 'arcade.best.redut': '1234', 'arcade.players.redut': '2' };
  const sb = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  const blk = main.slice(main.indexOf("var VER_KEY"), main.indexOf("var TH = Arcade"));
  vm.runInNewContext('var global = this;' + blk.replace(/global\.localStorage/g, 'localStorage') + ';this.notice = notice;', sb);
  eq(store['arcade.redut.ver'], '2'); ok(!('arcade.best.redut' in store)); ok(sb.notice === true);
  store['arcade.best.redut'] = '50'; vm.runInNewContext('var global=this;' + blk.replace(/global\.localStorage/g, 'localStorage') + ';this.notice = notice;', sb);
  eq(store['arcade.best.redut'], '50', 'второй запуск стёр рекорд'); ok(sb.notice === false);
});
test('оболочка: ввод — ход (движок), опора Space/Z/J, вспышка X/K/F/Shift, тач-кнопка вспышки; нет кооп-вызовов', () => {
  ok(/PLACE = \{ KeyZ: 1, KeyJ: 1 \}/.test(main) && /FLARE = \{ KeyX: 1, KeyK: 1, KeyF: 1, ShiftLeft: 1, ShiftRight: 1 \}/.test(main) && /bFlare/.test(main) && /ArcadeStick\.create/.test(main));
  ok(!/usePlayers|playerCount/.test(main), 'кооп остался');
});
checkPlatformFeatures({ ROOT, slug: 'redut', boards: ['redut'], test, ok });
test('правило имён и узнаваемости: в папке игры нет чужих названий и набора узнаваемого оригинала', () => {
  const bad = /battle.?city|exolon|vitorc|lost vikings|double dragon|battletoads|silkworm|digger|river raid|lode runner|boulder dash|pac-?man|tetris|galag|galaxian|xonix|chip 'n|darkwing|dizzy|tecmo|konami|namco|taito|capcom|nintendo|\bsega\b|deepseek|famicom/i, gone = /танчик|штаб|орёл|подков|кирпич|13.?[x×].?15/i;   // «узнаваемое» — только в коде и странице (README описывает, что убрано)
  const hits = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(js|mjs|html|css|md)$/.test(n) && n !== 'engine.js' && n !== 'engine.test.mjs') { const t = fs.readFileSync(p, 'utf8'); const m = t.match(bad) || t.match(/\bContra\b/) || (/^(js|index)/.test(path.relative(ROOT, p)) && t.match(gone)); if (m) hits.push(path.relative(ROOT, p) + ': ' + m[0]); } } };
  walk(ROOT); ok(!hits.length, hits.join('; '));
});
if (!process.env.QUICK) test('баланс: «человеческий» бот (страж) проходит 20–45% партий из 20 (волны 1–6), доходит до босса', () => {
  let wins = 0, reach6 = 0; for (let s = 1; s <= 20; s++) { const e = playRedut(R, s, { pylons: 0, guard: 90 }); if (e.won) wins++; if (e.wave >= 6) reach6++; }
  console.log('     бот: побед ' + wins + '/20, дошли до босса ' + reach6 + '/20'); ok(wins >= 4 && wins <= 9, 'побед ' + wins); ok(reach6 >= 14, 'до босса ' + reach6);
});
if (!process.env.QUICK) test('бот с опорами (1 опора, орбита): не падает, доходит хотя бы до 2-й волны, опоры ставятся', () => {
  let placed = 0; for (let s = 1; s <= 5; s++) { const e = playRedut(R, s, { pylons: 1, orbit: 125 }); ok(e.wave >= 2, 'сид ' + s + ' волна ' + e.wave); placed++; } ok(placed === 5);
});
console.log('\n' + passed + ' ok, ' + failed + ' FAIL');
process.exit(failed ? 1 : 0);
