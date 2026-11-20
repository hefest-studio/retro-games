/* _shared/tests/metrics-report.test.mjs — tools/yandex-metrics-report.mjs: разбор выгрузки Консоли Яндекс Игр (гибкий маппинг
   столбцов, ; , табуляция, десятичная запятая, %, доли, мм:сс) → гейты плейбука §5.4 → markdown. Фикстура: tools/fixtures/yandex-metrics-sample.csv.
   Запуск: node _shared/tests/metrics-report.test.mjs */
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv, parseNum, parseDate, metricOf, load, evaluate, toMarkdown } from '../../tools/yandex-metrics-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIX = path.join(ROOT, 'tools/fixtures/yandex-metrics-sample.csv');
let passed = 0, failed = 0; const queue = [];
const test = (n, f) => queue.push([n, f]);
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); };
const ok = (c, m) => { if (!c) throw new Error(m || 'ложь'); };
const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;
const st = (r, name) => r.gates.find((g) => g.name.startsWith(name)).status;

test('разбор: разделитель, кавычки, BOM; числа «15,2 %», «1 234,5», мм:сс, «450 с»; даты ДД.ММ.ГГГГ и ISO', () => {
  const c = parseCsv('﻿Дата;"Рейтинг; итог"\n01.10.2026;"5"\n'); eq(c.delim, ';'); eq(c.header, ['Дата', 'Рейтинг; итог']); eq(c.rows, [['01.10.2026', '5']]);
  eq(parseCsv('date,value\n2026-10-01,0.15\n').delim, ','); eq(parseCsv('Дата\tИгроки\n1.10.26\t5').delim, '\t');
  eq(parseNum('15,2 %'), 15.2); eq(parseNum('1 234,5'), 1234.5); eq(parseNum('1,234.5'), 1234.5); eq(parseNum('—'), null); eq(parseNum('0,42 ₽'), 0.42);
  ok(near(parseNum('7:30', 'playtime'), 7.5)); ok(near(parseNum('450 с', 'playtime'), 7.5)); ok(near(parseNum('1:02:00', 'playtime'), 62));
  eq(parseDate('01.10.2026'), '2026-10-01'); eq(parseDate('1/9/26'), '2026-09-01'); eq(parseDate('2026-10-05T00:00'), '2026-10-05');
});
test('маппинг столбцов RU/EN по документации метрик; «Новые игроки» и «CTR обложки» — не гейтовые', () => {
  eq(metricOf('Возвращаемость 1‑ого дня, %'), 'd1'); eq(metricOf('Retention D1'), 'd1'); eq(metricOf('Время играния на игрока, мин'), 'playtime');
  eq(metricOf('CTR иконки в рекомендациях, %'), 'ctr'); eq(metricOf('Средний доход на одного игрока в день (ARPDAU), ₽'), 'arpdau'); eq(metricOf('Игроки'), 'dau');
  eq(metricOf('Новые игроки'), null); eq(metricOf('CTR обложки в рекомендациях'), null); eq(metricOf('Рейтинг'), 'rating'); eq(metricOf('Date'), 'date');
});
test('фикстура (широкая таблица из Консоли): все гейты W1 пройдены, W1+ — нет; итог «Продолжаем»; markdown-таблица', () => {
  const d = load([FIX]), r = evaluate(d); eq(r.period, { from: '2026-10-01', to: '2026-10-21', days: 21 });
  eq(r.facts.rating, 48); ok(near(r.facts.d1, 16.1, 0.5) && near(r.facts.playtime, 7.4, 0.5) && near(r.facts.ctr, 4.4, 0.3) && near(r.facts.arpdau, 0.41, 0.05), JSON.stringify(r.facts));
  for (const n of ['Рейтинг', 'DAU стабильно', 'D1', 'Время на игрока', 'CTR иконки', 'ARPDAU', 'DAU (среднее)']) eq(st(r, n), 'pass', n);
  eq(st(r, 'ARPDAU для платного'), 'fail'); ok(/^🟢 Продолжаем$/.test(r.verdict), r.verdict);
  const md = toMarkdown(r, { game: 'Отбойник' }); ok(md.includes('| W1 · выжить | Рейтинг | > 30 | 48 | ✅ |') && md.includes('**Итог:** 🟢 Продолжаем') && /Новые игроки/.test(md), md);
});
test('файлы отдельных виджетов (дата + «Значение», метрика по имени файла), доли → %, мало дней, рейтинг ≤ 30 две недели → стоп', () => {
  const days = (n, f) => Array.from({ length: n }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')},${f(i)}`).join('\n');
  const files = [{ name: 'Рейтинг.csv', text: 'Дата,Значение\n' + days(15, () => 28) }, { name: 'retention-d1.csv', text: 'date,value\n' + days(15, () => '0.12') },
    { name: 'arpdau.csv', text: 'date,value\n' + days(15, () => '0.2') }, { name: 'Игроки.csv', text: 'Дата,Значение\n' + days(15, () => 40) }];
  const r = evaluate(load(files)); ok(near(r.facts.d1, 12), 'доли → проценты: ' + r.facts.d1); eq(r.facts.lowStreak, 15);
  eq(st(r, 'Рейтинг'), 'fail'); eq(st(r, 'D1'), 'fail'); eq(st(r, 'CTR иконки'), 'nodata'); ok(/^🔴 Стоп/.test(r.verdict) && /15 дн\. подряд/.test(r.verdict), r.verdict);
  const short = evaluate(load([{ name: 'x.csv', text: 'Дата;Рейтинг;Игроки\n01.09.2026;50;20\n02.09.2026;52;25' }])); ok(short.notes.some((n) => /меньше минимальных 7 дней/.test(n)), JSON.stringify(short.notes));
  ok(/Под угрозой|Недостаточно|Выживает/.test(short.verdict), short.verdict);
  const low = evaluate(load([{ name: 'x.csv', text: 'Дата;Рейтинг;Игроки;Retention D1\n' + Array.from({ length: 8 }, (_, i) => `0${i + 1}.09.2026;25;20;20 %`).join('\n') }])); ok(/^🟠/.test(low.verdict), low.verdict);
});
test('--map: свой столбец; нет столбца даты — понятная ошибка; CLI печатает markdown и пишет --out', () => {
  const r = evaluate(load([{ name: 'a.csv', text: 'Дата;Мой ARPDAU\n01.09.2026;2,5' }], { map: { arpdau: 'Мой ARPDAU' } })); ok(near(r.facts.arpdau, 2.5));
  let err = null; try { load([{ name: 'b.csv', text: 'Неделя;Рейтинг\n45;5' }]); } catch (e) { err = e.message; } ok(/нет столбца даты/.test(err || ''), err);
  const out = execFileSync('node', [path.join(ROOT, 'tools/yandex-metrics-report.mjs'), FIX, '--game', 'Тест', '--days', '7']).toString();
  ok(out.startsWith('# Метрики — Тест: гейты плейбука §5.4') && /\(7 дн\.\)/.test(out), out.slice(0, 200));
});

for (const [n, f] of queue) { try { await f(); passed++; console.log('ok   ' + n); } catch (e) { failed++; console.log('FAIL ' + n + ' — ' + (e && e.message)); } }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
