/* _shared/tests/banned-words.test.mjs — проверка запрещённых слов tools/lib/banned-words.mjs (Яндекс 1.15, 8.2.2) и её связка со
   сборщиками: tools/platform-build.mjs (собранная игра) и tools/promo-build.mjs (checkTexts, режим --check).
   Без браузера и сети; временные сборки — во временной папке ОС. Запуск: node _shared/tests/banned-words.test.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText, scanBuild, scanPromo, jsStrings, htmlStrings } from '../../tools/lib/banned-words.mjs';
import { build } from '../../tools/platform-build.mjs';
import { checkTexts } from '../../tools/promo-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let passed = 0, failed = 0; const queue = [];
const test = (n, f) => queue.push([n, f]);
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); };
const ok = (c, m) => { if (!c) throw new Error(m || 'ложь'); };
const ids = (s, k) => scanText(s, k).map((f) => f.level + ':' + f.id);

test('RU/EN: слова 1.15 — ошибка (демо, demo, trial version, бета-версия, в разработке, early access, TODO)', () => {
  for (const s of ['Демо', 'Это демо-версия игры', 'демоверсия', 'Play the demo', 'Trial version', 'Бета-версия', 'beta', 'Игра в разработке', 'Early Access', 'TODO: текст', 'Lorem ipsum dolor'])
    ok(scanText(s).some((f) => f.level === 'error'), s + ' → ' + JSON.stringify(ids(s)));
});
test('границы слов по Юникоду: демон, демонстрация, топор, Todo (исп. «всё»), beta-распад в формуле — не ошибки', () => {
  for (const s of ['Демон пещеры', 'демонстрация силы', 'Топор и кирка', 'Todo desbloqueado', 'alpha * beta', 'Демократия'])
    ok(!scanText(s).some((f) => f.level === 'error'), s + ' → ' + JSON.stringify(ids(s)));
});
test('намёки — предупреждение: «в полной версии», «скоро», «coming soon», «в Steam»; исключения: стимпанк, «скоро волна», time trial, ключи i18n', () => {
  eq(ids('Продолжение — в полной версии'), ['warn:full-version']); eq(ids('Новые миссии — скоро'), ['warn:soon']); eq(ids('Coming soon'), ['warn:soon']);
  eq(ids('Вишлист в Steam'), ['warn:store']);
  for (const s of ['Стимпанк-шахта', 'Steam Tractor', 'Low steam — production slowed', 'Скоро волна!', 'Time trial', 'TRIAL COMPLETE', 'levels.placeholder', 'menu.demo.title']) eq(ids(s), [], s);
});
test('8.2.2: free/best/top/бесплатно — ошибка в названии, предупреждение в описании; исключения «рекорд», «кнопки вверху»', () => {
  for (const s of ['Free Bricks', 'Лучшая головоломка', 'Top Puzzle', 'Бесплатный пинбол', 'ТОП-1 аркада']) ok(scanText(s, 'name').some((f) => f.level === 'error' && f.req === '8.2.2'), s);
  ok(scanText('Каскад', 'name').length === 0); ok(!scanText('Free Bricks', 'game').length, 'в тексте игры 8.2.2 не проверяем');
  eq(scanText('The best free arcade', 'promo').map((f) => f.level), ['warn', 'warn']);
  eq(ids('Побей свой лучший результат', 'promo'), []); eq(ids('use the buttons at the top to pause', 'promo'), []); eq(ids('Free play mode', 'name'), []);
});
test('извлечение текста: JS — строки и шаблоны без комментариев и регулярных выражений; HTML — текст, title, data-en, meta description, инлайновый JS', () => {
  const js = "// demo в комментарии\n/* trial */ var re = /demo/g, a = 'Демо', b = \"x\\\"y\", c = `шаблон ${n + '!'} хвост`; var d = x / 2 / 3; f('beta');";
  eq(jsStrings(js).map((s) => s.value), ['Демо', 'x"y', 'шаблон ', '!', ' хвост', 'beta']);
  const html = '<title data-en="Demo">Игра</title><meta name="description" content="Версия (демо)"><p>Текст &laquo;в разработке&raquo;</p><!-- demo --><script>var t = "Trial version";</script><style>.demo{}</style>';
  const v = htmlStrings(html).map((s) => s.value); ok(v.includes('Demo') && v.includes('Версия (демо)') && v.includes('Текст «в разработке»') && v.includes('Trial version') && v.includes('Игра'), JSON.stringify(v));
  ok(!v.some((s) => /\.demo|<!--/.test(s)), 'CSS и комментарии не текст');
});
test('scanBuild: папка игры → ошибки с файлом и строкой; scanPromo: promo.json', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-')); fs.mkdirSync(path.join(d, 'js'));
  fs.writeFileSync(path.join(d, 'index.html'), '<!doctype html>\n<title>Игра</title>\n<p>Полная игра</p>\n');
  fs.writeFileSync(path.join(d, 'js/i18n.js'), "var S = {\n  ok: 'Играть',\n  tag: 'демо'\n};\n// demo\n");
  fs.writeFileSync(path.join(d, 'data.json'), '{"a":{"b":["Beta build"]}}');
  const r = scanBuild(d); eq(r.errors.length, 2, JSON.stringify(r.errors)); ok(/^js\/i18n\.js:3 «демо» \(Яндекс 1\.15\)/.test(r.errors.find((e) => e.startsWith('js/'))), r.errors.join('|'));
  ok(r.errors.some((e) => e.startsWith('data.json')), 'JSON'); fs.rmSync(d, { recursive: true, force: true });
  const P = { names: { ru: 'Каскад', en: 'Cascade Demo' }, texts: { ru: { about: 'Лучшая аркада' }, en: { short: 'Beta version' } }, captions: { ru: ['Скоро новые уровни'] }, tags: { en: ['free'] } };
  const q = scanPromo(P); eq(q.errors.length, 2, JSON.stringify(q.errors)); ok(q.errors[0].startsWith('promo.json:names.en «Demo»'), q.errors[0]); eq(q.warnings.length, 3, JSON.stringify(q.warnings));
});
test('promo-build checkTexts: запрещённое слово в названии — ошибка (сборка промо упадёт); пилотные promo.json чистые', () => {
  const P = { names: { ru: 'Каскад Демо', en: 'Cascade' }, texts: {}, categories: {} };
  ok(checkTexts(P).some((s) => /запрещённые слова/.test(s)), JSON.stringify(checkTexts(P)));
  const dir = path.resolve(process.env.PROMO_DIR || path.join(ROOT, '..', 'arcade-full', 'promo'));
  for (const slug of ['kaskad', 'otboynik', 'kladka']) { const f = path.join(dir, slug, 'promo.json'); if (!fs.existsSync(f)) continue; const W = scanPromo(JSON.parse(fs.readFileSync(f, 'utf8'))); eq(W.errors, [], slug); }
});
test('platform-build: ПРИИСК и ПОРУБЕЖЬЕ (демо-издания) под Яндекс/GamePush — сборка падает со словом и местом; под web — без проверки слов', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-pb-'));
  try {
    for (const slug of ['priisk', 'porubezhye']) for (const pl of ['yandex', 'gamepush']) {
      const r = build(slug, pl, out, { noZip: true }); ok(!r.ok, slug + '/' + pl + ' должна упасть');
      ok(r.errors.some((e) => /запрещённые слова/.test(e)) && r.errors.some((e) => /index\.html:\d+ «демо» \(Яндекс 1\.15\)/.test(e)), slug + ': ' + r.errors.slice(0, 3).join(' | '));
    }
    const w = build('priisk', 'web', out, { noZip: true }); ok(!w.errors.some((e) => /запрещённые/.test(e)), 'web: ' + w.errors.join('|'));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

for (const [n, f] of queue) { try { await f(); passed++; console.log('ok   ' + n); } catch (e) { failed++; console.log('FAIL ' + n + ' — ' + (e && e.message)); } }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
