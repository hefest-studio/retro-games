/* МЕДНИЦА · tests/engine.test.mjs — автотесты без браузера (Node, без зависимостей).
   Запуск: node _proto/mednitsa/tests/engine.test.mjs   (QUICK=1 — без долгих симуляций)
   Экономика, симулятор баланса (кривая и «стены»), офлайн-доход и защита от перевода часов, ежедневный подарок,
   сохранение/облако (+ миграция v1 → v2 без верфи), флаги площадки, переплавка, заказы, посылка, Речная верфь (вторая мастерская),
   «Ярмарка выходного дня» (флаги event_*), строки RU/EN/TR/ES/PT, правило имён, симулятор 30 дней. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadEcon, simulate, cheapestWait, longPlan, dayReport } from './bot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sb = { console, Math, JSON }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ['js/config.js', 'js/econ.js', 'js/save.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
const M = sb.MEDNITSA, X = M.econ, CFG = M.CFG;
const E = X.Econ(CFG);

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function near(a, b, eps, m) { if (Math.abs(a - b) > eps * Math.max(1, Math.abs(b))) throw new Error((m || '') + ' ждали ≈' + b + ', получили ' + a); }
const T0 = 1767225600000;   // 01.01.2026 00:00 UTC

// ---------- конфиг ----------
test('конфиг: 10 цехов горна + 10 цехов верфи, цена и окупаемость первого уровня растут от цеха к цеху', () => {
  eq(CFG.WS.length, 20); eq(CFG.WS.filter(w => w.wk === 1).length, 10); ok(CFG.WS.slice(0, 10).every(w => w.wk === 0) && CFG.WS.slice(10).every(w => w.wk === 1), 'порядок: горн, потом верфь');
  for (let i = 1; i < 20; i++) { const a = CFG.WS[i - 1], b = CFG.WS[i]; ok(b.c0 > a.c0 * 5, 'цена ' + b.id); ok(b.c0 / b.inc > a.c0 / a.inc, 'окупаемость ' + b.id); ok(b.g >= a.g && b.g > 1.05 && b.g < 1.3, 'рост ' + b.id); }
  const ids = new Set(CFG.UPS.map(u => u.id)); eq(ids.size, CFG.UPS.length, 'id чертежей уникальны');
  CFG.UPS.forEach(u => { ok(u.need.ws >= 0 && u.need.ws < 20 && u.cost > 0 && u.x > 0, u.id); });
  const all = CFG.GOALS.concat(CFG.GOALS2), gids = new Set(all.map(g => g.id)); eq(gids.size, all.length, 'id заказов уникальны (горн + верфь)');
  all.forEach(g => ok(['lv', 'taps', 'earn', 'ups', 'chest', 'prestige', 'all', 'boost'].includes(g.type) && g.n > 0 && g.rw > 0, g.id));
  CFG.GOALS2.forEach(g => ok(g.wk === 1 && (g.type !== 'lv' || g.ws >= 10), 'заказ верфи ' + g.id));
  ok(CFG.wharf.unlock >= 3 && CFG.event.mult > 1, 'верфь и ярмарка в конфиге');
});

// ---------- экономика ----------
test('цена: n уровней = сумма геометрической прогрессии; maxBuy — сколько ровно хватает', () => {
  let sum = 0; for (let k = 0; k < 7; k++) sum += E.cost(2, 5 + k, 1);
  near(E.cost(2, 5, 7), sum, 1e-9);
  const s = E.newState(); s.lv[0] = 13;
  for (const c of [0, 5, 11.9, 12 * Math.pow(1.15, 13), 1e3, 1e6, 3.3e9]) {
    s.copper = c; const n = E.maxBuy(s, 0);
    ok(n === 0 || E.cost(0, 13, n) <= c * (1 + 1e-12), 'хватает на ' + n + ' при ' + c);
    ok(E.cost(0, 13, n + 1) > c, 'не хватает на ' + (n + 1) + ' при ' + c);
  }
});
test('покупка: списывает цену, режимы ×1/×10/MAX, следующий цех открывается после первого уровня предыдущего', () => {
  const s = E.newState(); s.copper = 11; eq(E.buy(s, 0, 1), 0, 'не хватает'); s.copper = 12;
  const r = E.buy(s, 0, 1); ok(r && r.first && r.n === 1); near(s.copper, 0, 1e-9);
  ok(!E.unlocked(s, 2), 'третий закрыт'); ok(E.unlocked(s, 1), 'второй открыт');
  s.copper = 1e3; eq(E.buy(s, 2, 1), 0, 'закрытый цех не покупается');
  s.copper = E.cost(0, 1, 10) - 1; eq(E.buy(s, 0, 10), 0, 'на ×10 не хватает — ничего'); s.copper += 1; eq(E.buy(s, 0, 10).n, 10); eq(s.lv[0], 11);
  s.copper = 1e5; const n = E.maxBuy(s, 0); eq(E.buy(s, 0, 'max').n, n); ok(s.copper < E.cost(0, s.lv[0], 1));
});
test('доход: этапы 10/25/50… удваивают цех, чертежи умножают, клейма +5% каждое', () => {
  const s = E.newState(); s.lv[0] = 9; const a = E.baseIncome(s); near(a, 9 * 0.6, 1e-9);
  s.lv[0] = 10; near(E.baseIncome(s), 10 * 0.6 * 2, 1e-9, 'этап 10');
  s.lv[0] = 25; near(E.baseIncome(s), 25 * 0.6 * 4, 1e-9, 'этап 25');
  s.ups.pipes0 = 1; near(E.baseIncome(s), 25 * 0.6 * 8, 1e-9, 'трубы ×2');
  s.marks = 10; near(E.baseIncome(s), 25 * 0.6 * 8 * 1.5, 1e-9, '10 клейм +50%');
  s.boostLeft = 30; near(E.income(s), E.baseIncome(s) * 2, 1e-9, 'форсаж ×2');
  const r = E.buy(Object.assign(E.newState(), { copper: 1e9, lv: [9, 0, 0, 0, 0, 0, 0, 0, 0, 0] }), 0, 1); ok(r.milestone, 'покупка 10-го уровня — этап');
});
test('удар по котлу: база 1, мехи ×2, наковальня +3% дохода в секунду', () => {
  const s = E.newState(); eq(E.tap(s), 1); eq(s.taps, 1); eq(s.copper, 1);
  s.ups.bellows = 1; eq(E.tapValue(s), 2);
  s.lv[1] = 10; s.ups.anvil = 1; near(E.tapValue(s), 2 + 0.03 * E.baseIncome(s), 1e-9);
});
test('чертежи: видны по уровню цеха, покупаются один раз', () => {
  const s = E.newState(); ok(!E.upsVisible(s).some(u => u.id === 'pipes0'));
  s.lv[0] = 5; ok(E.upsVisible(s).some(u => u.id === 'pipes0'));
  s.copper = 1e9; ok(E.buyUp(s, 'pipes0')); ok(!E.buyUp(s, 'pipes0'), 'второй раз нельзя'); ok(!E.upsVisible(s).some(u => u.id === 'pipes0'));
  ok(!E.buyUp(s, 'nope'));
});
test('advance: форсаж кончается посреди шага — доход считается по частям; посылка появляется и улетает', () => {
  const s = E.newState(); s.lv[0] = 10; const inc = E.baseIncome(s); s.boostLeft = 10; s.chestT = 1e9;
  E.advance(s, 30); near(s.copper, inc * 2 * 10 + inc * 20, 1e-9); eq(s.boostLeft, 0);
  const c = E.newState(); c.chestT = 2; let ev = E.advance(c, 3); eq(ev.chest, 'show'); eq(c.chestLive, CFG.chest.life);
  ev = E.advance(c, CFG.chest.life + 1); eq(ev.chest, 'gone'); eq(c.chestT, CFG.chest.every);
  c.chestLive = 5; c.lv[0] = 10; const free = E.chestReward(c, false); near(E.chestReward(c, true), free * CFG.chest.adMult, 1e-9);
  const before = c.copper; eq(E.openChest(c, false), free); near(c.copper - before, free, 1e-9); eq(E.openChest(c, false), 0, 'второй раз — нет');
  eq(c.chests, 1);
});

// ---------- офлайн-доход и часы ----------
function offState() { const s = E.newState(); s.lv[0] = 10; s.lv[1] = 5; s.lastSeen = T0; return s; }
test('офлайн: 1 ч → 50% дохода за час; 10 ч → предел 2 ч; «Запасной котёл» — 4 ч, «Сторож» — 70%', () => {
  let s = offState(), inc = E.baseIncome(s);
  let r = E.offline(s, T0 + 3600e3); near(r.sec, 3600, 1e-9); near(r.gain, inc * 0.5 * 3600, 1e-9); ok(!r.capped); eq(s.lastSeen, T0 + 3600e3);
  s = offState(); r = E.offline(s, T0 + 10 * 3600e3); near(r.sec, 7200, 1e-9); ok(r.capped);
  s = offState(); s.ups.spare = 1; r = E.offline(s, T0 + 10 * 3600e3); near(r.sec, 4 * 3600, 1e-9);
  s = offState(); s.ups.watch = 1; r = E.offline(s, T0 + 600e3); near(r.gain, inc * 0.7 * 600, 1e-9);
  s = offState(); const c0 = s.copper; eq(E.applyOffline(s, r, 2), r.gain * 2); near(s.copper - c0, r.gain * 2, 1e-9, '×2 за рекламу');
});
test('офлайн: меньше минуты — не офлайн (доход идёт обычным ходом), первая отметка — без дохода', () => {
  const s = offState(); const r = E.offline(s, T0 + 30e3); eq(r.sec, 0); near(r.away, 30, 1e-9); eq(r.gain, 0);
  const n = E.newState(); const r2 = E.offline(n, T0); eq(r2.gain, 0); eq(n.lastSeen, T0);
});
test('часы назад: дохода нет, отметка не уменьшается — «вперёд → забрал → назад» не повторяется', () => {
  const s = offState();
  // игрок перевёл часы на 8 ч вперёд — получил не больше предела (2 ч)
  let r = E.offline(s, T0 + 8 * 3600e3); near(r.sec, 7200, 1e-9);
  // вернул часы (реально прошло 10 мин) — ничего, отметка осталась «в будущем»
  r = E.offline(s, T0 + 600e3); ok(r.back); eq(r.gain, 0); eq(s.lastSeen, T0 + 8 * 3600e3);
  E.touch(s, T0 + 700e3); eq(s.lastSeen, T0 + 8 * 3600e3, 'touch не двигает назад');
  // снова вперёд на те же 8 ч — дохода нет: время от отметки 0
  r = E.offline(s, T0 + 8 * 3600e3); eq(r.gain, 0);
  // реальное время догнало отметку и ушло на час дальше — честный час
  r = E.offline(s, T0 + 9 * 3600e3); near(r.sec, 3600, 1e-9);
});
test('серверное время: офлайн считается от «сейчас» площадки, а не от часов устройства', () => {
  // «сейчас» в econ передаётся снаружи (g.serverTime()): подмена Date.now не влияет на расчёт
  const realNow = Date.now; try { Date.now = () => T0 + 400 * 86400e3; const s = offState(); const r = E.offline(s, T0 + 1800e3); near(r.sec, 1800, 1e-9); } finally { Date.now = realNow; }
});
test('ежедневный подарок: день по UTC+3, серия 1→7 с клеймом на 7-й, пропуск — заново, часы назад — не повторить', () => {
  const s = E.newState(), day0 = T0 + 12 * 3600e3;
  let d = E.daily(s, day0); ok(d.ready); eq(d.streak, 1); ok(E.claimDaily(s, day0)); ok(!E.daily(s, day0).ready); eq(E.claimDaily(s, day0 + 3600e3), null, 'в тот же день — нет');
  // граница дня — 21:00 UTC (00:00 МСК)
  ok(!E.daily(s, T0 + 20.9 * 3600e3).ready); ok(E.daily(s, T0 + 21.1 * 3600e3).ready);
  for (let k = 2; k <= 7; k++) { const r = E.claimDaily(s, day0 + (k - 1) * 86400e3); eq(r.streak, k); }
  eq(s.marks, 1, 'клеймо за 7-й день');
  eq(E.claimDaily(s, day0 + 7 * 86400e3).streak, 1, 'после 7 — новый круг');
  eq(E.claimDaily(s, day0 + 9 * 86400e3).streak, 1, 'пропуск дня — серия сначала');
  eq(E.claimDaily(s, day0 + 3 * 86400e3), null, 'часы назад — нельзя');
  ok(E.daily(s, day0).value >= CFG.dailyMin);
});

// ---------- заказы, переплавка ----------
test('заказы: видно 3, забрать можно только выполненный, награда — секунды дохода; после списка — бесконечные', () => {
  const s = E.newState(); let a = E.activeGoals(s); eq(a.length, 3); eq(a[0].goal.id, 'g1'); ok(!a[0].done);
  eq(E.claimGoal(s, 'g1'), 0, 'не выполнен'); s.lv[0] = 5; a = E.activeGoals(s); ok(a[0].done);
  const v = E.claimGoal(s, 'g1'); ok(v >= 25); eq(E.activeGoals(s)[0].goal.id, 'g2'); eq(E.claimGoal(s, 'g1'), 0, 'дважды нельзя');
  const far = E.goalAt(CFG.GOALS.length + 3); eq(far.type, 'all'); ok(far.n > 50);
});
test('переплавка: ∛-формула, минимум ' + CFG.prestige.minGain + ' клейм, сброс цехов/чертежей/меди, клейма и заказы остаются', () => {
  const s = E.newState(); s.lifeEarned = CFG.prestige.div / 8 * 0.99; ok(!E.canPrestige(s));
  s.lifeEarned = CFG.prestige.div / 8 * 1.01; eq(E.prestigeGain(s), 5); ok(E.canPrestige(s));
  s.lv = [50, 40, 30, 10, 0, 0, 0, 0, 0, 0]; s.ups = { pipes0: 1 }; s.copper = 1e6; s.goals = { g1: 1 };
  eq(E.prestige(s), 5); eq(s.marks, 5); eq(s.copper, 0); eq(s.lv.join(), Array(20).fill(0).join()); eq(Object.keys(s.ups).length, 0); ok(s.goals.g1); eq(s.prestiges, 1);
  eq(E.prestigeGain(s), 0, 'за то же заработанное — больше нет'); s.lifeEarned *= 8; eq(E.prestigeGain(s), 5, '×8 заработка → удвоение клейм');
  ok(E.earnForGain(Object.assign(E.newState(), { lifeEarned: 0 })) > 0);
});

// ---------- сохранение и облако ----------
function mem() { const m = {}; return { m, get: k => (k in m ? m[k] : null), set: (k, v) => { m[k] = v; } }; }
test('сохранение: запись/чтение, облако — копия, берётся дальше продвинутая (клейма → заработано → свежесть)', () => {
  const io = mem(), cl = mem(), cloud = { peek: k => cl.get(k), save: (k, v) => cl.set(k, v) };
  const sv = M.save.Saver(io, cloud), s = E.newState(); s.copper = 123; s.lifeEarned = 500;
  sv.write(s, T0, true); eq(JSON.parse(io.m[M.save.KEY]).copper, 123); eq(JSON.parse(cl.m[M.save.CLOUD]).copper, 123); eq(sv.pick().saved, T0);
  const other = E.newState(); other.marksEver = 3; other.lifeEarned = 10; cl.set(M.save.CLOUD, JSON.stringify(other));
  eq(sv.pick().marksEver, 3, 'облако с клеймами важнее');
  const a = { lv: [], marksEver: 1, lifeEarned: 9 }, b = { lv: [], marksEver: 1, lifeEarned: 10 }; eq(M.save.better(a, b), b);
  cl.set(M.save.CLOUD, '{битый'); eq(sv.pick().copper, 123, 'битое облако — локальное');
  eq(M.save.Saver(mem(), null).pick(), null, 'новой игры — null');
});
test('сохранение: в облако — не чаще раза в 15 с (лимит setData), принудительно — сразу', () => {
  let n = 0; const sv = M.save.Saver(mem(), { peek: () => null, save: () => { n++; } }), s = E.newState();
  sv.write(s, T0 + 16e3); sv.write(s, T0 + 20e3); sv.write(s, T0 + 25e3); eq(n, 1); sv.write(s, T0 + 26e3, true); eq(n, 2); sv.write(s, T0 + 50e3); eq(n, 3);
});
test('миграция: старое/неполное сохранение дополняется, мусор отбрасывается', () => {
  const s = E.normalize({ lv: [3, '2', -1], copper: 'x', marks: 2 });
  eq(s.lv.length, 20); eq(s.lv[1], 2); eq(s.lv[2], 0); eq(s.copper, 0); eq(s.marks, 2); eq(typeof s.ups, 'object'); eq(s.chestT, CFG.chest.first);
  eq(E.normalize(null).copper, 0); eq(M.save.parse('{"a":1}'), null, 'без lv — не сохранение');
});


// ---------- Речная верфь (вторая мастерская) ----------
const N1 = CFG.wharf.unlock;
test('верфь: закрыта до ' + N1 + '-й переплавки; открывается переплавкой навсегда (wharfNew — окно в игре)', () => {
  const s = E.newState(); s.lv[9] = 5; ok(!E.wharfOpen(s)); ok(!E.unlocked(s, 10), 'первый цех верфи закрыт'); eq(E.activeGoals(s, 3, 1).length, 0, 'заказов верфи нет');
  s.prestiges = N1 - 1; s.lifeEarned = 1e30; eq(E.prestige(s) > 0, true); eq(s.prestiges, N1); ok(s.wharf && s.wharfNew && E.wharfOpen(s), 'открыта');
  delete s.wharfNew; s.lifeEarned *= 1e3; E.prestige(s); ok(!s.wharfNew, 'окно — один раз'); ok(E.wharfOpen(s));
});
test('верфь: первый цех — после «Сердца Горна» в текущем забеге; дальше — по цепочке; переплавка сбрасывает и верфь', () => {
  const s = E.newState(); s.wharf = true; ok(!E.unlocked(s, 10), 'без сердца горна'); s.lv[9] = 1; ok(E.unlocked(s, 10)); ok(!E.unlocked(s, 11));
  s.copper = 1e40; const r = E.buy(s, 10, 1); ok(r && r.first, 'купили насос'); ok(E.unlocked(s, 11)); eq(E.wkOf(10), 1); eq(E.wsOf(1).join(), '10,11,12,13,14,15,16,17,18,19');
  s.lifeEarned = 1e30; E.prestige(s); eq(s.lv.slice(10).join(), '0,0,0,0,0,0,0,0,0,0'); ok(s.wharf, 'верфь остаётся открытой');
});
test('верфь: доход цехов верфи — с общими множителями (клейма, «Набор мастера», «всё ×»); чертежи верфи видны по её цехам', () => {
  const s = E.newState(); s.wharf = true; s.lv[9] = 1; s.lv[10] = 10; const a = E.wsIncome(s, 10) * E.allMult(s);
  near(a, 10 * CFG.WS[10].inc * 2, 1e-9, 'этап 10'); s.marks = 20; near(E.wsIncome(s, 10) * E.allMult(s), a * 2, 1e-9, '+100% от клейм');
  ok(E.upsVisible(s).some(u => u.id === 'seals10') && E.upsVisible(s).some(u => u.id === 'bell'), 'сальники и колокол');
  s.ups.ferry = 1; near(E.allMult(s), 2 * 3, 1e-9, 'паромная линия ×3');
});
test('верфь: заказы — свой список (видно 3, когда верфь открыта), «все цеха» считает только цеха своей мастерской', () => {
  const s = E.newState(); s.wharf = true; let a = E.activeGoals(s, 3, 1); eq(a.length, 3); eq(a[0].goal.id, 'r1'); ok(!a[0].done);
  s.lv[9] = 1; s.lv[10] = 1; ok(E.activeGoals(s, 3, 1)[0].done); ok(E.claimGoal(s, 'r1') > 0); eq(E.activeGoals(s, 3, 1)[0].goal.id, 'r2');
  for (let i = 0; i < 10; i++) s.lv[i] = 60; s.lv[10] = 3;
  eq(E.goalProgress(s, { type: 'all', n: 50 }), 60, 'горн: все ≥ 60 (верфь не мешает)'); eq(E.goalProgress(s, { type: 'all', wk: 1, n: 50 }), 0, 'верфь: следующий цех (колесо, ур. 0) тоже считается'); for (let i = 10; i < 20; i++) s.lv[i] = 7; s.lv[13] = 4; eq(E.goalProgress(s, { type: 'all', wk: 1, n: 50 }), 4);
  ok(E.goalAt(CFG.GOALS2.length + 2, 1).id.startsWith('rx'), 'бесконечные заказы верфи'); eq(E.goalsReady(s, 1) >= 0, true);
});
test('миграция v1 → v2: старое сохранение без верфи (10 уровней) — уровни верфи 0, верфь открыта, если переплавок уже ≥ ' + N1, () => {
  const old = { v: 1, copper: 5e9, runEarned: 1, lifeEarned: 1e15, marks: 300, marksEver: 300, prestiges: N1 + 2, lv: [50, 40, 30, 20, 10, 5, 3, 2, 1, 1], ups: { pipes0: 1 }, goals: { g1: 1 }, taps: 999, giftDay: 1, giftStreak: 2, lastSeen: T0, view: 1 };
  const io = mem(); io.set(M.save.KEY, JSON.stringify(old)); const s = E.normalize(M.save.Saver(io, null).pick());
  eq(s.v, CFG.version); eq(s.lv.length, 20); eq(s.lv.slice(0, 10).join(), '50,40,30,20,10,5,3,2,1,1'); eq(s.lv.slice(10).join(), '0,0,0,0,0,0,0,0,0,0');
  ok(s.wharf && E.wharfOpen(s), 'верфь открыта'); eq(s.view, 1); eq(s.copper, 5e9); eq(s.marks, 300); ok(s.goals.g1 && s.ups.pipes0, 'заказы и чертежи на месте'); eq(s.marksBonus, 0); eq(s.ev, null);
  ok(E.unlocked(s, 10), 'насос доступен (сердце горна построено)');
  const young = E.normalize({ v: 1, lv: [5, 1, 0, 0, 0, 0, 0, 0, 0, 0], prestiges: 2, view: 1 }); ok(!young.wharf && !E.wharfOpen(young)); eq(young.view, 0, 'вид верфи без верфи → горн');
  // записали v2 и прочитали снова — без потерь
  const sv = M.save.Saver(io, null); s.lv[12] = 7; sv.write(s, T0 + 1); const back = E.normalize(sv.pick()); eq(back.lv[12], 7); eq(back.lv.length, 20); ok(back.wharf);
});
test('офлайн с верфью: доход цехов верфи идёт и офлайн (50%, предел; «Причальный сарай» — 12 ч)', () => {
  const s = E.newState(); s.wharf = true; s.lv[9] = 1; s.lv[10] = 20; s.lastSeen = T0; const inc = E.baseIncome(s); ok(inc > E.wsIncome(s, 10), 'включает верфь');
  let r = E.offline(s, T0 + 3600e3); near(r.gain, inc * 0.5 * 3600, 1e-9);
  s.ups.moor = 1; r = E.offline(s, T0 + 3600e3 + 20 * 3600e3); near(r.sec, 12 * 3600, 1e-9); ok(r.capped);
});

// ---------- «Ярмарка выходного дня» (флаги event_*) ----------
const SAT = Date.UTC(2026, 10, 21, 12), FRI = Date.UTC(2026, 10, 20, 12), SUN_LATE = Date.UTC(2026, 10, 22, 20, 30), MON = Date.UTC(2026, 10, 22, 21, 30);
test('ярмарка: по умолчанию — сб и вс по UTC+3 (граница — полночь МСК), event_mode=off/on, event_mult — флагами без перевыпуска', () => {
  ok(E.eventInfo(SAT).on, 'суббота'); ok(!E.eventInfo(FRI).on, 'пятница'); ok(E.eventInfo(SUN_LATE).on, 'вс 23:30 МСК'); ok(!E.eventInfo(MON).on, 'пн 00:30 МСК');
  eq(E.eventInfo(SAT).id, E.eventInfo(SUN_LATE).id, 'одни выходные — одна ярмарка'); near(E.eventInfo(SUN_LATE).left, 1800, 1e-6, 'до конца — 30 мин');
  const off = X.Econ(X.applyFlags(CFG, k => ({ event_mode: 'OFF' })[k])); ok(!off.eventInfo(SAT).on, 'выключена флагом');
  const on = X.Econ(X.applyFlags(CFG, k => ({ event_mode: 'on', event_id: 'nov', event_mult: '3' })[k])); const i = on.eventInfo(FRI); ok(i.on, 'включена сейчас'); ok(/nov/.test(i.id)); eq(on.cfg.event.mult, 3);
  eq(X.applyFlags(CFG, () => '').event.mode, 'weekend', 'пустой флаг — значение конфига'); eq(CFG.event.mode, 'weekend', 'конфиг не тронут');
});
test('ярмарка: множитель дохода только пока идёт; особый заказ — заработать N минут дохода, награда — клейма «сверху» (переплавку не уменьшают)', () => {
  const E3 = X.Econ(CFG), s = E3.newState(); s.lv[0] = 20; s.lv[1] = 10; s.marksEver = 1000; s.marks = 1000; s.lifeEarned = 5e16;
  E3.eventSync(s, FRI); const base = E3.income(s); E3.eventSync(s, SAT); near(E3.income(s), base * CFG.event.mult, 1e-9, '×' + CFG.event.mult);
  ok(s.ev && s.ev.need > 0 && !s.ev.done); near(s.ev.need, Math.max(1000, E3.baseIncome(s) / CFG.event.mult * CFG.event.orderMin * 60), 1e-9, 'цель — от дохода без ярмарки');
  const pg = E3.prestigeGain(s); ok(!E3.eventReady(s)); eq(E3.claimEvent(s), 0, 'не выполнен');
  E3.eventSync(s, FRI); E3.earn(s, s.ev.need * 2); ok(!(s.ev.got > 0), 'в будни прогресс не идёт');
  E3.eventSync(s, SAT); E3.advance(s, CFG.event.orderMin * 60 / CFG.event.mult + 5); ok(E3.eventReady(s), 'выполнен за ~' + (CFG.event.orderMin / CFG.event.mult) + ' мин игры при ×' + CFG.event.mult);
  const g = E3.claimEvent(s); eq(g, Math.max(CFG.event.marksMin, Math.round(1000 * CFG.event.marksPct))); eq(s.marks, 1000 + g); eq(s.marksEver, 1000, 'marksEver не тронут'); eq(E3.prestigeGain(s), pg, 'будущая переплавка та же');
  eq(E3.claimEvent(s), 0, 'дважды нельзя'); E3.eventSync(s, SUN_LATE); eq(E3.claimEvent(s), 0, 'в воскресенье — тот же заказ');
  E3.eventSync(s, SAT + 7 * 86400e3); ok(s.ev && !s.ev.done && s.ev.got === 0, 'следующие выходные — новый заказ');
  const fresh = E3.normalize(JSON.parse(JSON.stringify(s))); eq(fresh.ev.id, s.ev.id, 'заказ ярмарки сохраняется');
});
test('ярмарка: офлайн-доход в выходные — тоже ×' + CFG.event.mult + ' (множитель на момент возврата)', () => {
  const E3 = X.Econ(CFG), s = E3.newState(); s.lv[0] = 10; s.lastSeen = FRI; E3.eventSync(s, FRI); const inc = E3.baseIncome(s);
  E3.eventSync(s, FRI + 1800e3); const r1 = E3.offline(s, FRI + 1800e3); near(r1.gain, inc * 0.5 * 1800, 1e-9);
  s.lastSeen = SAT - 1800e3; E3.eventSync(s, SAT); const r2 = E3.offline(s, SAT); near(r2.gain, inc * CFG.event.mult * 0.5 * 1800, 1e-9);
});

// ---------- флаги ----------
test('флаги площадки: предел офлайна, частота рекламы, масштаб цен/дохода; мусор игнорируется', () => {
  const c = X.applyFlags(CFG, k => ({ offline_cap_h: '4', ad_idle_gap: '600', cost_scale: '2', income_scale: 'abc', chest_every: '-5' })[k]);
  eq(c.offline.capH, 4); eq(c.ads.gapSec, 600); eq(c.costScale, 2); eq(c.incomeScale, 1); eq(c.chest.every, CFG.chest.every); eq(CFG.offline.capH, 2, 'исходный конфиг не тронут');
  const E2 = X.Econ(c); near(E2.cost(0, 0, 1), 24, 1e-9); const s = offState(); near(E2.offline(s, T0 + 10 * 3600e3).sec, 4 * 3600, 1e-9);
});

// ---------- формат ----------
test('числа: тыс/млн/млрд по-русски, K/M/B по-английски, после — aa, ab…', () => {
  eq(X.fmt(999, 'ru'), '999'); eq(X.fmt(1234, 'ru'), '1,23 тыс'); eq(X.fmt(1234, 'en'), '1.23K'); eq(X.fmt(5.5e6, 'en'), '5.5M'); eq(X.fmt(2e9, 'ru'), '2 млрд');
  eq(X.fmt(1e21, 'en'), '1aa'); eq(X.fmt(2.5, 'en'), '2.5'); eq(X.fmt(1.5e12, 'pt'), '1,5 tri');
  eq(X.fmtTime(3725, 'ru'), '1ч 2мин'); eq(X.fmtTime(65, 'en'), '1m 5s');
});

// ---------- строки ----------
test('строки: у EN/TR/ES/PT есть все ключи RU, подстановки совпадают; нет слов «демо/бета/trial» (Яндекс 1.15)', () => {
  const ru = M.STR.ru, BAN = /\b(demo|beta|trial|alpha|early access)\b|демо|бета|в разработке|скоро/i;
  for (const l of ['en', 'tr', 'es', 'pt']) for (const k of Object.keys(ru)) {
    ok(M.STR[l][k], l + ': нет ' + k);
    const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(); eq(ph(M.STR[l][k]), ph(ru[k]), l + '.' + k + ' подстановки');
  }
  for (const l of Object.keys(M.STR)) for (const [k, v] of Object.entries(M.STR[l])) ok(!BAN.test(v), l + '.' + k + ': «' + v + '»');
  for (const w of CFG.WS) ok(ru['ws_' + w.id], 'имя цеха ' + w.id);
  for (const u of CFG.UPS) ok(ru['up_' + u.id.replace(/\d+$/, '')], 'имя чертежа ' + u.id);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); ok(!BAN.test(html.replace(/<[^>]+>/g, ' ')), 'index.html');
});

// ---------- правило имён ----------
test('правило имён: в папке нет чужих названий игр/студий жанра и прочих из стоп-листа (регистронезависимо, транслит)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список студии + известные idle/merge игры и их студии)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFkdmVudHVyZSA/Y2FwaXRhbGlzdHxjb29raWUgP2NsaWNrZXJ80LrRg9C60LggP9C60LvQuNC60LXRgHxjbGlja2VyID9oZXJvZXN8ZWdnLD8gP2luY3xpZGxlID9taW5lcnxpZGxlID9mYWN0b3J5fGZhY3RvcnkgP2lkbGV8c3RlYW1wdW5rID9pZGxlfGlkbGUgP3NwaW5uZXJ8cmVhbG0gP2dyaW5kZXJ8YW50aW1hdHRlciA/ZGltZW5zaW9uc3x1bml2ZXJzYWwgP3BhcGVyY2xpcHN8cGFwZXJjbGlwfHRhcCA/dGl0YW5zfGJpdGNvaW4gP2JpbGxpb25haXJlfG1ha2UgP21vcmUhfGtpdHRlbnMgP2dhbWV8YSA/ZGFyayA/cm9vbXxjYW5keSA/Ym94fHRyaW1wc3xpZGxlID9zbGF5ZXJ8bWVyZ2UgP21hbnNpb258bWVyZ2UgP2RyYWdvbnN8bWVyZ2UgP21hZ2ljfGV2ZXJtZXJnZXx0cmF2ZWwgP3Rvd258Z2FyZGVuc2NhcGVzfGhvbWVzY2FwZXN8cGxheXJpeHzQv9C70LXQudGA0LjQutGBfGxvdmUgPyYgP3BpZXN8bWVyZ2UgP2NvdW50eXxtZXJnZSA/Z2FyZGVuc3xoeXBlciA/aGlwcG98a29saWJyaXxjb2RpZ2FtZXN8aWRsZSA/ZW1waXJlfGlkbGUgP3R5Y29vbnx0eWNvb2580YLQsNC50LrRg9C9fGNhcGl0YWxpc3R80LrQsNC/0LjRgtCw0LvQuNGB0YJ8c3VwZXJjZWxsfHp5bmdhfGtpbmdcLmNvbXxjYW5keSA/Y3J1c2h8dGFwID90YXAgP2Zpc2h8ZmFybXZpbGxlfGNsaWNrZXIgP3F1ZXN0fHN0ZWFtID90eWNvb24=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 10, 'файлов: ' + files.length);
  for (const f of files) { const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('МЕДНИЦА') && !BAD.test('BOILERWRIGHT') && !BAD.test('mednitsa') && !BAD.test('Самовар') && !BAD.test('кликер') && !BAD.test('Гефест'), 'без ложных срабатываний на наши слова');
  ok(BAD.test(Buffer.from('aWRsZSBtaW5lcg==', 'base64').toString()), 'стоп-лист ловит известные игры жанра');
});

// ---------- симулятор баланса ----------
if (process.env.QUICK) { console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без симулятора)'); process.exit(failed ? 1 : 0); }
const first = simulate({ tps: 3, plan: [{ on: 40 * 60 }] });
const unl = i => first.log.unlock[i] / 60;
test('баланс, первая сессия (3 удара/с): нет «стены» в первые 30 мин — самая дешёвая покупка всегда ближе 60 с', () => {
  eq(first.log.walls.length, 0, JSON.stringify(first.log.walls.slice(0, 3)));
});
test('баланс, первая сессия: цеха открываются постепенно (2-й < 1 мин, 5-й 3–12 мин, 6-й 10–25 мин, 7-й — позже 30 мин)', () => {
  ok(unl(1) < 1, '2-й ' + unl(1)); ok(unl(4) >= 3 && unl(4) <= 12, '5-й ' + unl(4)); ok(unl(5) >= 10 && unl(5) <= 25, '6-й ' + unl(5)); ok(!(unl(6) < 30), '7-й ' + unl(6));
});
test('баланс, первая сессия: переплавка доступна на 25–40 мин (+' + CFG.prestige.minGain + ' клейм), доход растёт ×20+ за 3→20 мин', () => {
  const p = first.log.prestige[0]; ok(p && p.active / 60 >= 25 && p.active / 60 <= 40, 'переплавка: ' + (p && p.active / 60));
  const at = m => first.log.perMin.find(x => x.min === m).income; ok(at(20) / at(3) >= 20, 'рост ' + at(20) / at(3));
});
test('баланс, медленный игрок (1 удар/с): тоже без «стены» в первые 30 мин', () => {
  const r = simulate({ tps: 1, prestige: false, plan: [{ on: 30 * 60 }] }); eq(r.log.walls.length, 0, JSON.stringify(r.log.walls.slice(0, 3)));
});
const days = simulate({ tps: 3, plan: longPlan(30) }), DR = dayReport(days, 30), dayOf = (t) => Math.floor(t / 86400) + 1;
test('баланс, 14 дней (3 сессии × 10 мин в день): все 10 цехов горна — со 2-го по 7-й день, переплавка хотя бы раз в 4 дня, без «взрыва» чисел', () => {
  ok(days.log.unlock[9] != null && dayOf(days.log.unlockAt[9]) <= 7, '10-й цех не открыт к 7-му дню'); ok(days.log.unlock[6] > 40 * 60, '7-й — не в первый день');
  const pr = days.log.prestige.map(p => Math.floor(p.at / 86400)); ok(pr.filter(x => x < 14).length >= 6, 'переплавок ' + pr.length);
  for (let d = 1; d + 4 <= 14; d += 4) ok(pr.some(x => x >= d && x < d + 4), 'нет переплавки в дни ' + (d + 1) + '–' + (d + 4));
  ok(DR[13].marks < 1e7 && isFinite(DR[13].income), 'клейм на 14-й день ' + DR[13].marks);
});
test('баланс, дни 10–30 (верфь): цеха верфи открываются постепенно — 1-й на 6–10-й день, 5-й к 20-му, ≥ 7 к 30-му, но не все 10 раньше 25-го', () => {
  const U = (i) => days.log.unlockAt && days.log.unlockAt[i] != null ? dayOf(days.log.unlockAt[i]) : 99;
  ok(U(10) >= 6 && U(10) <= 10, '1-й цех верфи: день ' + U(10)); ok(U(14) <= 20, '5-й: день ' + U(14)); ok(U(16) <= 30, '7-й: день ' + U(16)); ok(U(19) > 25, '10-й: день ' + U(19));
  for (let i = 11; i < 20; i++) ok(U(i) >= U(i - 1), 'порядок ' + i);
});
test('баланс, дни 10–30: новые цели каждый день (заказы, цеха, чертежи, переплавки, ярмарка) — не больше 2 дней-«стен», переплавка не реже раза в 4 дня', () => {
  const late = DR.filter(r => r.day >= 10); const walls = late.filter(r => r.news === 0).map(r => r.day); ok(walls.length <= 2, 'дни без новой цели: ' + walls.join(','));
  const pr = days.log.prestige.map(p => dayOf(p.at)); for (let d = 10; d + 3 <= 30; d += 4) ok(pr.some(x => x >= d && x < d + 4), 'нет переплавки в дни ' + d + '–' + (d + 3));
  ok(days.log.events.length >= 3, 'заказов ярмарки: ' + days.log.events.length);
  ok(isFinite(E.income(days.s)) && days.s.marks < 1e12, 'клейм к 30-му дню ' + days.s.marks);
});
test('бот: cheapestWait — 0, если что-то уже по карману', () => { const s = E.newState(); s.copper = 1e3; eq(cheapestWait(E, s), 0); });

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
