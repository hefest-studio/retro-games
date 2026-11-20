/* tools/lib/banned-words.mjs — проверка запрещённых слов в собранной игре и в промо-текстах (Яндекс Игры, требования 1.15 и 8.2.2).
   Источники (сверено 20.11.2026):
     1.15 «Игра имеет завершённый вид и не находится в процессе разработки или предварительного тестирования» —
          https://yandex.ru/dev/games/doc/ru/concepts/requirements ; частая причина отказа: «остались следы разработки
          („demo“, „в разработке“, „trial version“)» — https://yandex.ru/dev/games/doc/ru/concepts/moderation
     8.2.2 «Название игры и связанные с ней материалы (описание, промоакции и т. д.) не вводят игрока в заблуждение»;
          в названии — «„free“, „top“, „best“, „бесплатно“, „бесплатный“ и т. п.» — там же (moderation).
   Что проверяется:
     игра (scanBuild): видимый игроку текст — текст и атрибуты HTML (title, alt, aria-label, placeholder, data-en, meta content),
       строковые литералы и шаблоны JS (комментарии и идентификаторы — нет), строки JSON. Слова 1.15 → ошибка; намёки на «полную версию»,
       «скоро», чужие магазины → предупреждение.
     промо (scanPromo): названия — слова 1.15 и 8.2.2 → ошибка; описания, подписи, теги — 1.15 → ошибка, 8.2.2 → предупреждение.
   Ложные срабатывания — в EXCEPTIONS (словарь исключений: id правила + регулярное выражение по тексту строки + причина).
   Списки — RU и EN; границы слов — по буквам Юникода (кириллица), поэтому «демон», «демонстрация», «топор» не срабатывают. */
import fs from 'node:fs';
import path from 'node:path';

const W = '(?<![\\p{L}\\p{N}_])', E = '(?![\\p{L}\\p{N}_])';
const rx = (body) => new RegExp(W + '(?:' + body + ')' + E, 'giu');

// level: 'error' — сборка падает; 'warn' — в отчёт. scope: 'game' — в тексте игры и промо; 'name' — только в названиях (ошибка),
// в остальных промо-текстах — предупреждение.
export const RULES = [
  // ---- 1.15: следы разработки / демо / тест ----
  { id: 'demo', req: '1.15', level: 'error', lang: 'ru', re: rx('демо(?:[- ]?верси\\p{L}*)?|демка|демки|демку|демо-режим\\p{L}*') },
  { id: 'demo', req: '1.15', level: 'error', lang: 'en', re: rx('demo(?:[- ]?version)?|demos') },
  { id: 'trial', req: '1.15', level: 'error', lang: 'ru', re: rx('пробн\\p{L}* верси\\p{L}*|тестов\\p{L}* верси\\p{L}*|ознакомительн\\p{L}* верси\\p{L}*|триал\\p{L}*') },
  { id: 'trial', req: '1.15', level: 'error', lang: 'en', re: rx('trial (?:version|mode|period|build)|free trial|test (?:version|build)|debug build') },
  { id: 'trial-soft', req: '1.15', level: 'warn', lang: 'en', re: rx('trial') },
  { id: 'beta', req: '1.15', level: 'error', lang: 'ru', re: rx('бета(?:[- ]?(?:верси\\p{L}*|тест\\p{L}*))?|альфа[- ]?(?:верси\\p{L}*|тест\\p{L}*)') },
  { id: 'beta', req: '1.15', level: 'error', lang: 'en', re: rx('beta(?:[- ]?(?:version|test\\w*|build))?|alpha[- ]?(?:version|test\\w*|build)|pre-?release|early access') },
  { id: 'wip', req: '1.15', level: 'error', lang: 'ru', re: rx('в разработке|ранн\\p{L}* доступ\\p{L}*') },
  { id: 'wip-soft', req: '1.15', level: 'warn', lang: 'ru', re: rx('заглушк\\p{L}*|не реализован\\p{L}*') },
  { id: 'wip', req: '1.15', level: 'error', lang: 'en', re: rx('in development|work in progress|wip|under construction|placeholder|lorem ipsum') },
  { id: 'todo', req: '1.15', level: 'error', lang: 'any', re: new RegExp(W + '(?:TODO|FIXME|XXX)' + E, 'gu') }, // только заглавными: исп./порт. «todo» = «всё»
  // ---- 1.15 (намёки на незавершённость / демо-издание) — предупреждение: решить вручную ----
  { id: 'full-version', req: '1.15', level: 'warn', lang: 'ru', re: rx('полн\\p{L}* верси\\p{L}*') },
  { id: 'full-version', req: '1.15', level: 'warn', lang: 'en', re: rx('full (?:version|game)') },
  { id: 'soon', req: '1.15', level: 'warn', lang: 'ru', re: rx('скоро|в работе|появ\\p{L}* позже') },
  { id: 'soon', req: '1.15', level: 'warn', lang: 'en', re: rx('coming soon|soon|in the works') },
  // ---- 8.4: отсылки к другим магазинам и площадкам — предупреждение ----
  { id: 'store', req: '8.4', level: 'warn', lang: 'any', re: rx('(?:on|in|на|в) steam|steam (?:store|page|wishlist|key|version)|steam-(?:версия|страниц\\p{L}*)|стиме?|itch\\.io|app ?store|google play|epic games store') },
  // ---- 8.2.2: вводящие в заблуждение слова (в названии — ошибка) ----
  { id: 'free', req: '8.2.2', level: 'error', scope: 'name', lang: 'ru', re: rx('бесплатн\\p{L}*|даром') },
  { id: 'free', req: '8.2.2', level: 'error', scope: 'name', lang: 'en', re: rx('free|free-to-play|f2p') },
  { id: 'best', req: '8.2.2', level: 'error', scope: 'name', lang: 'ru', re: rx('лучш\\p{L}*|топ(?:-?\\d+)?|№ ?1|номер один|самая|самый') },
  { id: 'best', req: '8.2.2', level: 'error', scope: 'name', lang: 'en', re: rx('best|top(?: ?\\d+)?|#1|no\\. ?1|number one|ultimate') }
];

// Словарь исключений: правило id + текст строки, в котором совпадение допустимо, + причина. Проверяется по всей строке/фразе.
export const EXCEPTIONS = [
  { id: 'best', re: /(?:personal |your |new )?best (?:score|time|result|run)|рекорд|лучш\p{L}* (?:результат|время|счёт|счет|попытк)/iu, why: '«лучший результат» = рекорд, описание механики (не название)' },
  { id: 'best', re: /(?:at|on|from|to|near) the top\b|(?:^|[^\p{L}])(?:top|верх)\p{L}*[- ](?:row|rows|edge|left|right|half|line|lane|wall|screen|score|scores|ten|ряд\p{L}*|кра\p{L}*|половин\p{L}*)/iu, why: '«top» как направление/таблица лидеров' },
  { id: 'best', re: /топ-?\d+ (?:игрок|таблиц|лидер)|в топе? таблиц|leaderboard top|top \d+ players/iu, why: 'таблица лидеров — механика' },
  { id: 'free', re: /free (?:play|mode|kick|fall|spin|move|camera)|свободн/iu, why: '«free play / free fall» — режим или физика, не цена' },
  { id: 'beta', re: /\b(?:alpha|beta|gamma|delta)\b[^.]*\b(?:alpha|beta|gamma|delta)\b/i, why: 'греческие буквы в формулах/параметрах' },
  { id: 'wip', re: /^(?:placeholder|todo)$/i, why: 'служебное значение атрибута, не текст для игрока' },
  { id: 'soon', re: /as soon as|как только|скоро (?:волна|атака|босс|рассвет|ночь|прибуд|подойд|нападут|ударит|обвал|землетряс)|грунт трещит|soon the|next wave soon/iu, why: '«скоро» в игровом событии, не про разработку' },
  { id: 'trial-soft', re: /time trial|trial complete|испытани/iu, why: '«time trial» — режим на время, «trial» — испытание в сюжете' },
  { id: '*', re: /^[a-z0-9_$-]+(?:\.[a-z0-9_$-]+)+$/i, why: 'ключ/путь (levels.placeholder, a.b.c) — идентификатор, не текст для игрока' },
  { id: 'store', re: /стимпанк|steampunk|steam (?:engine|boiler|pressure|vent)|пар\p{L}* машин/iu, why: 'пар/стимпанк — тема игры, не магазин Steam' }
];

function lineOf(text, idx) { let n = 1; for (let i = 0; i < idx && i < text.length; i++) if (text.charCodeAt(i) === 10) n++; return n; }

/** Проверить одну фразу. kind: 'game' | 'name' | 'promo'. → [{ id, req, level, word, text }] */
export function scanText(text, kind = 'game') {
  const out = [], s = String(text || ''); if (!s.trim()) return out;
  for (const r of RULES) {
    if (r.scope === 'name' && kind === 'game') continue;
    r.re.lastIndex = 0; let m;
    while ((m = r.re.exec(s))) {
      if (EXCEPTIONS.some((x) => (x.id === r.id || x.id === '*') && x.re.test(s))) break;
      const level = r.scope === 'name' && kind !== 'name' ? 'warn' : r.level;
      out.push({ id: r.id, req: r.req, level, word: m[0], text: s.length > 120 ? s.slice(Math.max(0, m.index - 50), m.index + 70) : s });
      if (m[0] === '') r.re.lastIndex++;
    }
  }
  return out;
}

// ---------- извлечение видимого текста ----------
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '']);
const REGEX_KW = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|delete|new|throw|yield|await)$/;
/** Строковые литералы и статические части шаблонов JS (без комментариев). → [{ value, index }] */
export function jsStrings(src) {
  const out = []; let i = 0; const n = src.length; const stack = []; // стек: 'tpl' — внутри `…${ ; число — глубина скобок
  let prev = ''; // последний значимый символ кода (для различения деления и регулярного выражения)
  const prevWordEnd = (k) => src.slice(Math.max(0, k - 12), k);
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, v = ''; while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') { v += src[j + 1] === 'n' ? ' ' : src[j + 1] || ''; j += 2; continue; } v += src[j++]; }
      out.push({ value: v, index: i }); i = j + 1; prev = 'a'; continue;
    }
    if (c === '`' || (c === '}' && stack.length && stack[stack.length - 1] === 0)) {
      if (c === '}') stack.pop();
      let j = i + 1, v = '', start = i;
      while (j < n && src[j] !== '`') { if (src[j] === '\\') { v += src[j + 1] || ''; j += 2; continue; } if (src[j] === '$' && src[j + 1] === '{') break; v += src[j++]; }
      if (v.trim()) out.push({ value: v, index: start });
      if (j < n && src[j] === '$') { stack.push(0); i = j + 2; prev = '{'; continue; }
      i = j + 1; prev = 'a'; continue;
    }
    if (c === '{' && stack.length) { stack[stack.length - 1]++; i++; prev = '{'; continue; }
    if (c === '}' && stack.length && stack[stack.length - 1] > 0) { stack[stack.length - 1]--; i++; prev = '}'; continue; }
    if (c === '/') {
      if (REGEX_PREV.has(prev) || REGEX_KW.test(prevWordEnd(i).trimEnd())) { // регулярное выражение — пропустить
        let j = i + 1, cls = false; while (j < n && src[j] !== '\n') { const d = src[j]; if (d === '\\') { j += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; j++; }
        i = j + 1; while (i < n && /[a-z]/i.test(src[i])) i++; prev = 'a'; continue;
      }
    }
    if (!/\s/.test(c)) prev = /[\w$\])]/.test(c) ? 'a' : c;
    i++;
  }
  return out;
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', laquo: '«', raquo: '»', hellip: '…' };
const decode = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m));
/** Видимый текст HTML: текст узлов, title/alt/aria-label/placeholder/data-en, meta content; инлайновые скрипты — как JS. */
export function htmlStrings(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const t = (/\stype=["']([^"']+)["']/i.exec(m[1]) || [])[1];
    if (!t || /javascript|module/i.test(t)) for (const s of jsStrings(m[2])) out.push({ value: s.value, index: m.index + m[0].indexOf(m[2]) + s.index });
  }
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const nm = (/\b(?:name|property)=["']([^"']+)["']/i.exec(m[0]) || [])[1] || '', c = /\bcontent=["']([^"']*)["']/i.exec(m[0]);
    if (c && /^(description|keywords|og:title|og:description|twitter:\w+|application-name|apple-mobile-web-app-title)$/i.test(nm)) out.push({ value: decode(c[1]), index: m.index });
  }
  for (const m of html.matchAll(/\s(?:title|alt|aria-label|placeholder|data-en|data-ru|value)=["']([^"']*)["']/gi)) out.push({ value: decode(m[1]), index: m.index });
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, (s) => ' '.repeat(s.length)).replace(/<style\b[\s\S]*?<\/style>/gi, (s) => ' '.repeat(s.length)).replace(/<!--[\s\S]*?-->/g, (s) => ' '.repeat(s.length));
  for (const m of body.matchAll(/>([^<]+)</g)) { const v = decode(m[1]).trim(); if (v) out.push({ value: v, index: m.index + 1 }); }
  return out;
}
function jsonStrings(src) { const out = []; let o; try { o = JSON.parse(src); } catch { return jsStrings(src); } (function walk(v) { if (typeof v === 'string') out.push({ value: v, index: 0 }); else if (v && typeof v === 'object') Object.values(v).forEach(walk); })(o); return out; }

/** Проверить папку собранной игры. → { errors: [строки], warnings: [строки], findings: [...] } */
export function scanBuild(dir) {
  const findings = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name, p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p, r); continue; }
      if (!/\.(html?|js|json)$/i.test(e.name)) continue;
      const src = fs.readFileSync(p, 'utf8');
      const strs = /\.html?$/i.test(e.name) ? htmlStrings(src) : /\.json$/i.test(e.name) ? jsonStrings(src) : jsStrings(src);
      for (const s of strs) for (const f of scanText(s.value, 'game')) findings.push(Object.assign({ file: r, line: lineOf(src, s.index) }, f));
    }
  })(dir, '');
  return summarize(findings);
}
/** Проверить промо (promo.json): names/display — как название; texts/captions/tags — как промо. */
export function scanPromo(P) {
  const findings = [], add = (where, v, kind) => { for (const f of scanText(v, kind)) findings.push(Object.assign({ file: 'promo.json', line: where }, f)); };
  for (const k of ['names', 'display']) for (const [l, v] of Object.entries((P && P[k]) || {})) add(k + '.' + l, v, 'name');
  for (const [l, T] of Object.entries((P && P.texts) || {})) for (const [k, v] of Object.entries(T || {})) add('texts.' + l + '.' + k, v, 'promo');
  for (const [l, arr] of Object.entries((P && P.captions) || {})) (arr || []).forEach((v, i) => add('captions.' + l + '[' + i + ']', v, 'promo'));
  for (const [l, arr] of Object.entries((P && P.tags) || {})) (arr || []).forEach((v, i) => add('tags.' + l + '[' + i + ']', v, 'promo'));
  return summarize(findings);
}
function summarize(findings) {
  const fmt = (f) => `${f.file}:${f.line} «${f.word}» (Яндекс ${f.req}) — ${JSON.stringify(f.text)}`;
  return { findings, errors: findings.filter((f) => f.level === 'error').map(fmt), warnings: findings.filter((f) => f.level === 'warn').map(fmt) };
}
export const HINT = 'Запрещённые слова (Яндекс 1.15 «завершённый вид»; 8.2.2 «название не вводит в заблуждение»): уберите слово из текста игры/промо ' +
  'или, если это ложное срабатывание, добавьте исключение в tools/lib/banned-words.mjs → EXCEPTIONS (id правила, регулярное выражение, причина).';
