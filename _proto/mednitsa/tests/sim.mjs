/* МЕДНИЦА · отчёт симулятора баланса: node _proto/mednitsa/tests/sim.mjs [--tps 3] [--days 30] [--no-event]
   1) первая сессия 40 мин: доход по минутам, время открытия цехов, «стены» (> 60 с без покупки/заказа);
   2) N дней: 40 мин в день 1, затем 3 сессии по 10 мин в день + офлайн между ними — по дням: переплавки, клейма, доход,
      открытые цеха горна и Речной верфи, «новые цели» дня (заказы, впервые открытый цех/чертёж, переплавка, заказ ярмарки)
      и самый долгий отрезок активной игры без новой цели. «Стена» — день без единой новой цели. */
import { simulate, longPlan, dayReport } from './bot.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const tps = arg('--tps', 3), days = arg('--days', 30), noEvent = process.argv.includes('--no-event');
const fmt = (n) => n < 1e3 ? n.toFixed(1) : n.toExponential(2);
const flags = noEvent ? { event_mode: 'off' } : null;

const a = simulate({ tps, flags, plan: [{ on: 40 * 60 }] });
console.log(`\n== Первая сессия (40 мин, ${tps} удара/с) ==`);
console.log('мин | доход/с | удар | уровни цехов горна | чертежи');
for (const p of a.log.perMin) if ([1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 35, 40].includes(p.min)) console.log(String(p.min).padStart(3), '|', fmt(p.income).padStart(9), '|', fmt(p.tap).padStart(8), '|', p.lv.slice(0, 10).join(' '), '|', p.ups);
console.log('цех открыт, мин:', Object.entries(a.log.unlock).map(([i, t]) => `${+i + 1}:${(t / 60).toFixed(1)}`).join('  '));
console.log('покупок:', a.log.buys.length, '· макс. пауза без действия, с:', Math.max(...a.log.gaps), '· «стены» (>60 с в первые 30 мин):', a.log.walls.length);
console.log('переплавка:', a.log.prestige.map(p => `${(p.active / 60).toFixed(1)} мин (+${p.gain})`).join(', ') || 'нет', '· доступно клейм сейчас:', a.E.prestigeGain(a.s));

const b = simulate({ tps, flags, plan: longPlan(days) });
console.log(`\n== ${days} дней: 40 мин в день 1, затем 3 сессии × 10 мин в день${noEvent ? ' (без ярмарки)' : ' (ярмарка сб–вс ×2)'} ==`);
console.log('цех открыт впервые (день): ' + Object.entries(b.log.unlockAt || {}).map(([i, t]) => `${+i + 1}:д${Math.floor(t / 86400) + 1}`).join(' '));
console.log('переплавки (день: клейм):', b.log.prestige.map(p => `д${Math.floor(p.at / 86400) + 1}:+${p.gain}`).join(' '));
console.log('день | переплавок | клейм    | доход/с   | горн | верфь | новых целей (заказы+цеха+чертежи+переплавки+ярмарка) | макс. без новой цели, мин');
const R = dayReport(b, days);
for (const r of R) console.log(String(r.day).padStart(4), '|', String(r.prestiges).padStart(10), '|', fmt(r.marks).padStart(8), '|', fmt(r.income).padStart(9), '|', String(r.forge).padStart(4), '|', String(r.wharf).padStart(5), '|',
  `${r.news} (${r.goals}+${r.shops}+${r.ups}+${r.pr}+${r.ev})`.padEnd(54), '|', r.gapMin.toFixed(0));
const walls = R.filter(r => r.day > 1 && r.news === 0).map(r => r.day);
console.log('дней-«стен» (ни одной новой цели):', walls.length ? walls.join(', ') : 'нет', '· ярмарка: заказов', b.log.events.length, '(+' + b.log.events.reduce((x, e) => x + e.marks, 0) + ' клейм)');
console.log('итог: уровни горна', b.s.lv.slice(0, 10).join(' '), '· верфи', b.s.lv.slice(10).join(' '), '· клейм', b.s.marks, '· чертежей', Object.keys(b.s.ups).length, '· доход/с', fmt(b.E.income(b.s)));
