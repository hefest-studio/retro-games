/* ПРИИСК · tests/skirmish-ai.test.mjs — таблицы побед «ИИ против ИИ» по уровням сложности (Node, без зависимостей).
   Запуск: node priisk/tests/skirmish-ai.test.mjs [--full | --sizye] [--seeds N] [--maps gen,pass,isles,veins]
     без ключей — генерируемая карта, 10 сидов (~2–3 мин): «Трудный» против «Обычного» и «Обычный» против «Лёгкого»;
     --full — все четыре карты по 10 сидов (+ «Обычный» против «Обычного» и ИИ-Сизые трёх уровней против ИИ Медного Ключа;
     ~25 мин на 2 ядрах); --sizye — только строки ИИ-Сизых (все карты).
   Каждый сид играется дважды — уровень A за владельца 0 (низ-лево) и за владельца 1 (верх-право): у «Обычного» есть перекос
   в пользу владельца 0 (его постройки ставятся по кругу с востока — к жиле внизу слева, от неё вверху справа), поэтому
   проверяем обе стороны. Условие: A выигрывает ≥ 70% партий за каждую сторону; каждая партия кончается победой < 25 игровых мин.
   Шаг мира 1/30 с; ИИ владельца 0 — L.makeAI + L.aiTick, владельца 1 — ИИ мира (newWorld({ level })). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sb = { console, Math, setTimeout, clearTimeout, Date }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ['js/i18n.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
const L = sb.PRIISK.logic;
const SZONLY = process.argv.includes('--sizye'), FULL = SZONLY || process.argv.includes('--full'), si = process.argv.indexOf('--seeds'), N = si > 0 ? +process.argv[si + 1] : 10;
const MAX = 25 * 60, DT = 1 / 30;

function game(seed, l0, l1, extra) {
  const W = L.newWorld(Object.assign({ seed, level: l1 }, extra)), A0 = L.makeAI(W, 0, l0);
  for (let i = 0, n = Math.round(MAX / DT); i < n && W.winner < 0; i++) { L.aiTick(W, DT, A0); L.step(W, DT); W.events.length = 0; }
  return W;
}
let failed = 0;
function row(map, a, b, check) {
  const extra = map === 'gen' ? {} : { map }, res = { a0: 0, a1: 0, tmax: 0, tsum: 0, n: 0, draw: 0 };
  for (let s = 1; s <= N; s++) {
    const W0 = game(s, a, b, extra), W1 = game(s, b, a, extra);
    if (W0.winner === 0) res.a0++; if (W1.winner === 1) res.a1++;
    [W0, W1].forEach(W => { res.n++; res.tsum += W.time; res.tmax = Math.max(res.tmax, W.time); if (W.winner < 0) res.draw++; });
  }
  const pct0 = res.a0 / N, pct1 = res.a1 / N, all = (res.a0 + res.a1) / (2 * N);
  const okr = res.draw === 0 && res.tmax < MAX && (!check || (pct0 >= 0.7 && pct1 >= 0.7));
  if (!okr) failed++;
  console.log(`${okr ? 'ok  ' : 'FAIL'} | ${map.padEnd(5)} | ${(a + ' – ' + b).padEnd(15)} | ${String(res.a0).padStart(2)}/${N} | ${String(res.a1).padStart(2)}/${N} | ${Math.round(all * 100).toString().padStart(3)}% | ${(res.tsum / res.n / 60).toFixed(1).padStart(4)} | ${(res.tmax / 60).toFixed(1).padStart(4)} | ${res.draw}`);
}
console.log(`Таблица: A – B, побед A за владельца 0 / за владельца 1 (${N} сидов), всего %, средняя и наибольшая длина партии (мин), ничьих (25 мин)`);
console.log('     | карта | A – B           | за 0  | за 1  | всего | ср.  | макс | ничьи');
const mi = process.argv.indexOf('--maps'), maps = mi > 0 ? process.argv[mi + 1].split(',') : FULL ? ['gen', 'pass', 'isles', 'veins'] : ['gen'];
for (const m of SZONLY ? [] : maps) {
  row(m, 'hard', 'normal', true);
  row(m, 'normal', 'easy', true);
  if (FULL) row(m, 'normal', 'normal', false);
}
if (FULL) {
  // ИИ-Сизые (владелец 1, их механика) трёх уровней против ИИ Медного Ключа «Обычного» и «Лёгкого»: справка (без порога), партии кончаются
  console.log('\nИИ-Сизые (владелец 1) против ИИ Медного Ключа (владелец 0): побед Сизых из ' + Math.min(N, 5) + ', средняя длина');
  for (const m of maps) for (const cl of ['normal', 'easy']) {
    const cells = [];
    for (const lv of ['easy', 'normal', 'hard']) {
      let w = 0, t = 0, bad = 0; const k = Math.min(N, 5);
      for (let s = 1; s <= k; s++) { const W = game(s, cl, lv, Object.assign({ foe: 'sizye' }, m === 'gen' ? {} : { map: m })); if (W.winner === 1) w++; if (W.winner < 0) bad++; t += W.time; }
      if (bad) failed++;
      cells.push(`${lv}: ${w}/${k} · ${(t / k / 60).toFixed(1)} мин${bad ? ' · НИЧЬИХ ' + bad : ''}`);
    }
    console.log(`  ${m.padEnd(5)} против ${cl.padEnd(6)} | ${cells.join(' | ')}`);
  }
}
console.log(failed ? `\n${failed} строк(и) не прошли` : '\nвсё прошло');
process.exit(failed ? 1 : 0);
