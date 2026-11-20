/* МЕДНИЦА · отчёт симулятора баланса: node _proto/mednitsa/tests/sim.mjs [--tps 3] [--days 14]
   1) первая сессия 40 мин: доход по минутам, время открытия цехов, «стены» (> 60 с без покупки/заказа);
   2) N дней: 3 сессии по 10 мин в день + офлайн между ними — когда открываются цеха и сколько переплавок. */
import { simulate } from './bot.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const tps = arg('--tps', 3), days = arg('--days', 14);
const fmt = (n) => n < 1e3 ? n.toFixed(1) : n.toExponential(2);

const a = simulate({ tps, plan: [{ on: 40 * 60 }] });
console.log(`\n== Первая сессия (40 мин, ${tps} удара/с) ==`);
console.log('мин | доход/с | удар | уровни цехов | чертежи');
for (const p of a.log.perMin) if ([1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 35, 40].includes(p.min)) console.log(String(p.min).padStart(3), '|', fmt(p.income).padStart(9), '|', fmt(p.tap).padStart(8), '|', p.lv.join(' '), '|', p.ups);
console.log('цех открыт, мин:', Object.entries(a.log.unlock).map(([i, t]) => `${+i + 1}:${(t / 60).toFixed(1)}`).join('  '));
console.log('покупок:', a.log.buys.length, '· макс. пауза без действия, с:', Math.max(...a.log.gaps), '· «стены» (>60 с в первые 30 мин):', a.log.walls.length);
console.log('переплавка:', a.log.prestige.map(p => `${(p.active / 60).toFixed(1)} мин (+${p.gain})`).join(', ') || 'нет', '· доступно клейм сейчас:', a.E.prestigeGain(a.s));

const plan = [{ on: 40 * 60 }, { off: 4 * 3600 }];
for (let d = 0; d < days; d++) { plan.push({ on: 600 }, { off: 5 * 3600 }, { on: 600 }, { off: 5 * 3600 }, { on: 600 }, { off: 14 * 3600 - 1800 }); }
const b = simulate({ tps, plan });
console.log(`\n== ${days} дней: 40 мин в день 1, затем 3 сессии × 10 мин в день ==`);
console.log('цех открыт (активных мин):', Object.entries(b.log.unlock).map(([i, t]) => `${+i + 1}:${(t / 60).toFixed(0)}`).join('  '));
console.log('переплавки (день: клейм):', b.log.prestige.map(p => `д${Math.floor(p.at / 86400) + 1}:+${p.gain}`).join(' '));
const perDay = {}; for (const p of b.log.perMin) perDay[Math.floor(p.min / 30)] = p;
console.log('итог: уровни', b.s.lv.join(' '), '· клейм', b.s.marks, '· чертежей', Object.keys(b.s.ups).length, '· доход/с', fmt(b.E.income(b.s)));
