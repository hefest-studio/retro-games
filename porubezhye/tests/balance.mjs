#!/usr/bin/env node
/* ПОРУБЕЖЬЕ · tests/balance.mjs — баланс скирмиша трёх родов: ИИ против ИИ, каждая пара рас на 6 сидах (сид — карта; нечётный — первая раса
   слева сверху, чётный — наоборот). Условие: ни одна раса не выигрывает в паре больше 70 % (≤ 4 из 6); партия кончается победой за 5–20 мин.
   Запуск: node porubezhye/tests/balance.mjs [пара, например wright-barrow]   (~3–5 мин на все три пары; без браузера). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sb = { console, Math, Array, Map, Set, Object, JSON, Uint8Array, Int32Array, Float32Array }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sb, { filename: 'game.js' });
const P = sb.PORUB, ONLY = process.argv[2] || null, SEEDS = [1, 2, 3, 4, 5, 6], NAME = { wright: 'Мастеровые', thicket: 'Живая чаща', barrow: 'Курганный род' };
const PAIRS = [['wright', 'thicket'], ['wright', 'barrow'], ['thicket', 'barrow']].filter(p => !ONLY || ONLY === p.join('-'));
let failed = 0; const rows = [];
for (const [A, B] of PAIRS) {
  const wins = { [A]: 0, [B]: 0 }, games = [];
  for (const s of SEEDS) {
    const left = s % 2 ? A : B, right = s % 2 ? B : A, g = P.create({ seed: s, playerRace: left, aiRace: right, aiBoth: true });
    while (g.winner < 0 && g.t < 25 * 60) g.update(1);
    const w = g.winner >= 0 ? g.races[g.winner] : null; if (w) wins[w]++;
    games.push((w ? NAME[w] : 'ничья') + ' ' + (g.t / 60).toFixed(1) + ' мин');
    if (!w || g.t < 5 * 60 || g.t > 20 * 60) { failed++; console.log('FAIL ' + A + '–' + B + ' сид ' + s + ': ' + (w || 'нет победителя') + ' за ' + (g.t / 60).toFixed(1) + ' мин'); }
  }
  const max = Math.max(wins[A], wins[B]), okp = max / SEEDS.length <= 0.7; if (!okp) failed++;
  rows.push(`${okp ? 'ok  ' : 'FAIL'} ${NAME[A]} ${wins[A]} : ${wins[B]} ${NAME[B]}  (${Math.round(max / SEEDS.length * 100)} % у сильнейшей) — ${games.join(', ')}`);
  console.log(rows[rows.length - 1]);
}
console.log(`\nбаланс: ${PAIRS.length} пар × ${SEEDS.length} сидов, ${failed ? failed + ' нарушений' : 'ни одна раса не выигрывает > 70 %'}`);
process.exit(failed ? 1 : 0);
