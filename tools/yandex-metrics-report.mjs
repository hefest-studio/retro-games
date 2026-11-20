#!/usr/bin/env node
/* tools/yandex-metrics-report.mjs — отчёт по метрикам игры из выгрузки Консоли Яндекс Игр → таблица гейтов плейбука (markdown).
   Запуск:  node tools/yandex-metrics-report.mjs <файл.csv> [ещё.csv …] [--game "Отбойник"] [--days 14] [--out отчёт.md] [--map "rating=Мой столбец"]
   Формат выгрузки. Консоль отдаёт таблицу «по дням» с каждого виджета метрики (кнопка в правом верхнем углу виджета —
   https://yandex.ru/dev/games/doc/ru/concepts/analytics); точный формат файла (колонки, разделитель, формат дат) в документации
   не описан, поэтому маппинг гибкий:
     • широкая таблица: «Дата» + столбцы метрик (имена — RU/EN, как в документации метрик https://yandex.ru/dev/games/doc/ru/concepts/metric);
     • файл одного виджета: «Дата» + один столбец значения («Значение», «Value», …) — метрика угадывается по имени столбца или файла
       (например, «Рейтинг.csv», «arpdau.csv»); несколько файлов склеиваются по дате;
     • разделитель — ; , или табуляция (определяется сам), десятичная запятая, «15,2 %», доли (0,152), время «7:30» / «7,5 мин» / «450 с»;
     • свой столбец — --map metric=Имя столбца (metric: rating, d1, playtime, ctr, arpdau, dau).
   Гейты — плейбук «Яндекс Игры» §5.4 (claude/research/yandex-games-playbook-2026-11.md), основания:
     рейтинг > 30 (п. 2.13: ≤ 30 три недели подряд — снятие с публикации); D1 ≥ 15 %, время на игрока ≥ 7 мин, CTR иконки ≥ 4 %
     (ориентиры практиков); ARPDAU ≥ 0,3 ₽ (наш нижний гейт), ≥ 1,5 ₽ (платное продвижение) и > 2 ₽ при рейтинге 80+ (ощутимый доход) —
     https://yandex.ru/dev/games/doc/ru/liveops ; DAU ≥ 10 (рейтинг считается при > 10 игроков в день) и ≥ 100 (наш гейт);
     минимальный период наблюдения — 7 дней, данные отстают на 2–3 дня (concepts/analytics).
   Тест: node _shared/tests/metrics-report.test.mjs (фикстура tools/fixtures/yandex-metrics-sample.csv). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- имена столбцов (нижний регистр, без пунктуации) → метрика ----------
export const ALIASES = {
  date: ['дата', 'день', 'date', 'day', 'период', 'period'],
  rating: ['рейтинг', 'рейтинг игры', 'rating', 'game rating', 'score'],
  d1: ['возвращаемость 1-ого дня', 'возвращаемость 1ого дня', 'возвращаемость 1 дня', 'возвращаемость первого дня', 'retention d1', 'retention 1 day', 'retention day 1', 'd1', 'r1', 'удержание d1', 'retention 1d', 'day 1 retention'],
  playtime: ['время играния на игрока', 'время игры на игрока', 'время на игрока', 'playtime per player', 'play time per player', 'average playtime', 'время играния на одного игрока', 'avg playtime'],
  ctr: ['ctr иконки в рекомендациях', 'ctr иконки', 'ctr icon', 'icon ctr', 'ctr иконки в рекомендации', 'ctr icon in recommendations', 'ctr'],
  arpdau: ['средний доход на одного игрока в день arpdau', 'arpdau', 'средний доход на игрока в день', 'доход на игрока в день'],
  dau: ['игроки', 'уникальные игроки', 'уникальные игроки в день', 'dau', 'players', 'daily active users', 'игроков в день'],
  value: ['значение', 'value', 'значение метрики', 'metric value']
};
const norm = (s) => String(s || '').replace(/^﻿/, '').toLowerCase().replace(/ё/g, 'е').replace(/[‑–—\-_()«»"'.,:;%₽]/g, ' ').replace(/\s+/g, ' ').trim();
export function metricOf(header) {
  const h = norm(header); if (!h) return null;
  for (const [k, list] of Object.entries(ALIASES)) if (list.some((a) => norm(a) === h)) return k;
  if (/(^| )(нов\S*|new)( |$)/.test(h)) return null; // «Новые игроки», «New players» — не DAU
  for (const [k, list] of Object.entries(ALIASES)) if (k !== 'value' && list.some((a) => norm(a).length > 3 && h.includes(norm(a)))) return k; // «CTR иконки в рекомендациях, %»
  return null;
}

// ---------- CSV ----------
export function parseCsv(text) {
  text = String(text).replace(/^﻿/, '');
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const outside = first.replace(/"[^"]*"/g, '');
  const delim = ['\t', ';', ','].map((d) => [d, outside.split(d).length - 1]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === delim) { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; } else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return { delim, header: (rows[0] || []).map((s) => s.trim()), rows: rows.slice(1) };
}
export function parseNum(v, kind) {
  let s = String(v == null ? '' : v).trim().replace(/ /g, ' '); if (!s || s === '—' || s === '-' || /^n\/?a$/i.test(s)) return null;
  if (kind === 'playtime') {
    const hms = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s); if (hms) return hms[3] != null ? +hms[1] * 60 + +hms[2] + +hms[3] / 60 : +hms[1] + +hms[2] / 60;
    const sec = /^([\d\s.,]+)\s*(с|сек|s|sec)\.?$/i.exec(s); if (sec) return num(sec[1]) / 60;
    const h = /^([\d\s.,]+)\s*(ч|h)\.?$/i.exec(s); if (h) return num(h[1]) * 60;
  }
  const pct = /%/.test(s); const n = num(s.replace(/[%₽$€]|руб\.?|мин\.?|min/gi, '')); if (n == null) return null;
  return pct ? n : n;
}
function num(s) { s = String(s).replace(/\s/g, ''); if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); else s = s.replace(',', '.'); const n = parseFloat(s); return isFinite(n) ? n : null; }
export function parseDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(s))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Загрузить файлы → { byDate: { 'YYYY-MM-DD': { metric: number } }, columns: [{ file, column, metric }], unknown: [...] } */
export function load(files, opts = {}) {
  const byDate = {}, columns = [], unknown = [], map = opts.map || {};
  const pctRaw = {}; // метрика → все значения (чтобы понять: доли 0–1 или проценты)
  for (const f of files) {
    const text = typeof f === 'string' ? fs.readFileSync(f, 'utf8') : f.text, name = typeof f === 'string' ? path.basename(f) : f.name;
    const { header, rows } = parseCsv(text);
    const di = header.findIndex((h) => metricOf(h) === 'date'); if (di < 0) throw new Error(name + ': нет столбца даты (ждали «Дата» / «Date»; есть: ' + header.join(', ') + ')');
    const fileMetric = metricOf(name.replace(/\.(csv|tsv|txt)$/i, '').replace(/[-_]+/g, ' '));
    header.forEach((h, i) => {
      if (i === di) return;
      let m = Object.keys(map).find((k) => norm(map[k]) === norm(h)) || metricOf(h);
      if (m === 'value' || (!m && header.length === 2)) m = fileMetric;
      if (!m || m === 'date' || m === 'value') { unknown.push(name + ': ' + h); return; }
      columns.push({ file: name, column: h, metric: m });
      for (const r of rows) { const d = parseDate(r[di]); if (!d) continue; const v = parseNum(r[i], m); if (v == null) continue;
        (byDate[d] = byDate[d] || {})[m] = v; if (/%/.test(r[i])) (pctRaw[m] = pctRaw[m] || { pct: true }); else (pctRaw[m] = pctRaw[m] || {}); }
    });
  }
  // D1 и CTR: если все значения ≤ 1 и знака % не было — это доли → в проценты
  for (const m of ['d1', 'ctr']) { const vals = Object.values(byDate).map((x) => x[m]).filter((v) => v != null);
    if (vals.length && !(pctRaw[m] && pctRaw[m].pct) && vals.every((v) => v <= 1)) Object.values(byDate).forEach((x) => { if (x[m] != null) x[m] = +(x[m] * 100).toFixed(4); }); }
  return { byDate, columns, unknown };
}

const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
/** Гейты §5.4 по данным load(). opts.days — последние N дней. → { period, facts, gates, verdict, notes } */
export function evaluate(data, opts = {}) {
  let dates = Object.keys(data.byDate).sort(); if (opts.days) dates = dates.slice(-opts.days);
  const series = (m) => dates.map((d) => data.byDate[d][m]).filter((v) => v != null);
  const last = (m) => { const s = series(m); return s.length ? s[s.length - 1] : null; };
  let low = 0; for (let i = dates.length - 1; i >= 0; i--) { const v = data.byDate[dates[i]].rating; if (v == null) continue; if (v <= 30) low++; else break; } // дней подряд с рейтингом ≤ 30 в конце периода
  const F = { rating: last('rating'), ratingAvg: avg(series('rating')), lowStreak: low, d1: avg(series('d1')), playtime: avg(series('playtime')), ctr: avg(series('ctr')),
    arpdau: avg(series('arpdau')), dau: avg(series('dau')), dauMin: series('dau').length ? Math.min(...series('dau')) : null };
  const G = [];
  const g = (group, name, rule, fact, pass, why) => G.push({ group, name, rule, fact, status: fact == null ? 'nodata' : pass ? 'pass' : 'fail', why });
  const f1 = (v, u = '', d = 1) => v == null ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('ru-RU') + u;
  g('W1 · выжить', 'Рейтинг', '> 30', F.rating == null ? null : f1(F.rating, '', 0) + (F.lowStreak ? ` (≤ 30 — ${F.lowStreak} дн. подряд)` : ''), F.rating > 30, 'п. 2.13: ≤ 30 три недели — снятие');
  g('W1 · выжить', 'DAU стабильно', '≥ 10 каждый день', F.dauMin == null ? null : 'мин. ' + f1(F.dauMin, '', 0), F.dauMin >= 10, 'рейтинг считается при > 10 игроков в день');
  g('W1 · продолжаем', 'D1 (возвращаемость 1-го дня)', '≥ 15 %', F.d1 == null ? null : f1(F.d1, ' %'), F.d1 >= 15, 'ориентир практиков');
  g('W1 · продолжаем', 'Время на игрока', '≥ 7 мин', F.playtime == null ? null : f1(F.playtime, ' мин'), F.playtime >= 7, 'ориентир практиков');
  g('W1 · продолжаем', 'CTR иконки', '≥ 4 %', F.ctr == null ? null : f1(F.ctr, ' %', 2), F.ctr >= 4, '«ниже 4 % игра пылится»');
  g('W1 · продолжаем', 'ARPDAU', '≥ 0,3 ₽', F.arpdau == null ? null : f1(F.arpdau, ' ₽', 2), F.arpdau >= 0.3, 'наш нижний гейт');
  g('W1 · продолжаем', 'DAU (среднее)', '≥ 100', F.dau == null ? null : f1(F.dau, '', 0), F.dau >= 100, 'наш гейт');
  g('W1+ · вкладываемся', 'ARPDAU для платного продвижения', '≥ 1,5 ₽ и зелёный рейтинг', F.arpdau == null ? null : f1(F.arpdau, ' ₽', 2), F.arpdau >= 1.5, 'liveops; порог «зелёного» рейтинга не опубликован — смотреть окраску в Консоли');
  g('W1+ · вкладываемся', 'Ощутимый доход / LiveOps-приоритет', 'рейтинг ≥ 80 и ARPDAU > 2 ₽', F.arpdau == null || F.rating == null ? null : f1(F.rating, '', 0) + ' / ' + f1(F.arpdau, ' ₽', 2), F.rating >= 80 && F.arpdau > 2, 'liveops');
  const stop = (F.lowStreak >= 14) || (F.d1 != null && F.d1 < 10);
  const st = (grp) => G.filter((x) => x.group === grp);
  const all = (grp) => st(grp).every((x) => x.status === 'pass'), any = (grp, s) => st(grp).some((x) => x.status === s);
  let verdict;
  if (stop) verdict = '🔴 Стоп / переделка: ' + [F.lowStreak >= 14 ? `рейтинг ≤ 30 уже ${F.lowStreak} дн. подряд` : null, F.d1 != null && F.d1 < 10 ? 'D1 < 10 %' : null].filter(Boolean).join(', ') + ' → обновление той же игры (не новый ID, п. 3.6, 1.24)';
  else if (any('W1 · выжить', 'fail')) verdict = '🟠 Под угрозой снятия (2.13): поднять рейтинг — время игры, возвраты, аудитория';
  else if (all('W1 · выжить') && all('W1 · продолжаем')) verdict = all('W1+ · вкладываемся') ? '🟢 LiveOps-приоритет: контент, языки, письмо в «Популярные»' : any('W1+ · вкладываемся', 'pass') ? '🟢 Продолжаем; можно тест платного продвижения (проверить зелёный рейтинг)' : '🟢 Продолжаем';
  else if (any('W1 · выжить', 'nodata') && any('W1 · продолжаем', 'nodata') && !any('W1 · продолжаем', 'fail')) verdict = '⚪ Недостаточно данных';
  else verdict = '🟡 Выживает, но гейты «продолжаем» не пройдены: патч по метрикам (баланс, обучение, rewarded-точки)';
  const notes = [];
  if (dates.length < 7) notes.push(`период ${dates.length} дн. — меньше минимальных 7 дней наблюдения (Консоль)`);
  if (!dates.length) notes.push('нет строк с датами');
  notes.push('данные Консоли отстают на 2–3 дня; рейтинг появляется ≈ через 2 недели после публикации');
  if (data.unknown && data.unknown.length) notes.push('столбцы без гейта (не используются): ' + data.unknown.join('; ') + '; свой столбец для метрики гейта — --map metric=Столбец');
  return { period: { from: dates[0] || null, to: dates[dates.length - 1] || null, days: dates.length }, facts: F, gates: G, verdict, notes };
}

export function toMarkdown(r, opts = {}) {
  const icon = { pass: '✅', fail: '❌', nodata: '— нет данных' };
  const lines = [`# Метрики${opts.game ? ' — ' + opts.game : ''}: гейты плейбука §5.4`, '',
    `Период: ${r.period.from || '—'} … ${r.period.to || '—'} (${r.period.days} дн.)${opts.source ? ' · источник: ' + opts.source : ''}`, '',
    `**Итог:** ${r.verdict}`, '', '| Гейт | Метрика | Порог | Факт | Статус | Основание |', '|---|---|---|---|---|---|'];
  for (const x of r.gates) lines.push(`| ${x.group} | ${x.name} | ${x.rule} | ${x.fact == null ? '—' : x.fact} | ${icon[x.status]} | ${x.why} |`);
  lines.push('', 'Правило «стоп / переделка»: рейтинг ≤ 30 две недели подряд **или** D1 < 10 % → обновление той же игры (не новый ID).', '');
  if (r.notes.length) { lines.push('Примечания:'); r.notes.forEach((n) => lines.push('- ' + n)); lines.push(''); }
  lines.push('Средние — по дням периода; рейтинг — последнее значение. Сгенерировано tools/yandex-metrics-report.mjs.');
  return lines.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), files = [], opts = { map: {} }; let out = null;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--game') opts.game = a[++i]; else if (a[i] === '--days') opts.days = +a[++i]; else if (a[i] === '--out') out = a[++i];
    else if (a[i] === '--map') { const [k, ...v] = String(a[++i] || '').split('='); if (!ALIASES[k] || !v.length) { console.error('--map metric=Столбец; metric: ' + Object.keys(ALIASES).filter((x) => x !== 'date' && x !== 'value').join(', ')); process.exit(2); } opts.map[k] = v.join('='); }
    else files.push(a[i]);
  }
  if (!files.length) { console.error('использование: node tools/yandex-metrics-report.mjs <выгрузка.csv> [ещё.csv …] [--game "Имя"] [--days N] [--out отчёт.md] [--map metric=Столбец]'); process.exit(2); }
  let data; try { data = load(files, opts); } catch (e) { console.error('ошибка: ' + e.message); process.exit(2); }
  const md = toMarkdown(evaluate(data, opts), { game: opts.game, source: files.map((f) => path.basename(f)).join(', ') });
  if (out) { fs.writeFileSync(out, md); console.log('отчёт → ' + out); } else process.stdout.write(md);
}
