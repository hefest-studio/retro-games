/* _shared/tests/i18n.test.mjs — единое правило языка движка v2.3 (Node, без зависимостей):
   • ?lang=en|ru в адресе — приоритет над сохранённым выбором, сохраняется в arcade.lang;
   • без параметра — сохранённый arcade.lang, иначе язык игры по умолчанию (opts.lang), иначе ru;
   • неверный ?lang= игнорируется; L/toggle сохраняет выбор; перевод DOM по data-en / data-ru;
   • заголовок/подзаголовок заставки в EN берутся из strings.en, даже если в cfg — русский литерал.
   Запуск: node _shared/tests/i18n.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, '_shared/engine.js'), 'utf8');

function el(html, attrs = {}) {
  return { innerHTML: html, _a: Object.assign({}, attrs), getAttribute(k) { return k in this._a ? this._a[k] : null; }, setAttribute(k, v) { this._a[k] = String(v); } };
}
function makeEnv({ search = '', store = {}, dom = [] } = {}) {
  const drawn = [];
  const win = {
    Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat, Date, console,
    location: { search, hash: '' },
    localStorage: { _d: Object.assign({}, store), getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => 0 },
    matchMedia: () => ({ matches: false }),
  };
  const ctx = { imageSmoothingEnabled: true, fillText(s) { drawn.push(String(s)); }, fillRect() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, strokeRect() {}, measureText: () => ({ width: 10 }) };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ctx };
  const docEl = { lang: 'ru' };
  win.document = { querySelector: () => canvas, querySelectorAll: (q) => (q === '[data-en]' ? dom : []), documentElement: docEl, addEventListener() {}, hidden: false };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: 'engine.js' });
  const game = (o = {}) => win.Arcade.createGame(Object.assign({ canvas: '#c', width: 320, height: 200, gameId: 'tst',
    strings: { ru: { title: 'ИГРА', subtitle: 'Подзаголовок', play: 'Играть' }, en: { title: 'GAME', subtitle: 'Subtitle', play: 'Play' } } }, o));
  return { win, A: win.Arcade, store: win.localStorage._d, docEl, drawn, game };
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }

test('по умолчанию (нет параметра и сохранённого выбора) — ru', () => {
  const e = makeEnv(); eq(e.game().i18n.lang, 'ru'); eq(e.store['arcade.lang'], undefined, 'без выбора ничего не пишем');
});
test('?lang=en важнее сохранённого ru и сохраняется в arcade.lang', () => {
  const e = makeEnv({ search: '?lang=en', store: { 'arcade.lang': 'ru' } });
  eq(e.game().i18n.lang, 'en'); eq(e.store['arcade.lang'], 'en');
});
test('?lang=ru важнее сохранённого en', () => {
  const e = makeEnv({ search: '?x=1&lang=ru', store: { 'arcade.lang': 'en' } });
  eq(e.game().i18n.lang, 'ru'); eq(e.store['arcade.lang'], 'ru');
});
test('?lang=EN (регистр) и другие параметры рядом', () => {
  eq(makeEnv({ search: '?level=2&lang=EN&mute=1' }).game().i18n.lang, 'en');
});
test('?lang= с неизвестным языком игнорируется → сохранённый выбор', () => {
  const e = makeEnv({ search: '?lang=de', store: { 'arcade.lang': 'en' } });
  eq(e.game().i18n.lang, 'en'); eq(e.store['arcade.lang'], 'en');
});
test('?language=en и ?slang=en — не параметр языка', () => {
  eq(makeEnv({ search: '?language=en' }).game().i18n.lang, 'ru');
  eq(makeEnv({ search: '?slang=en' }).game().i18n.lang, 'ru');
});
test('без параметра — сохранённый выбор (обратная совместимость arcade.lang)', () => {
  eq(makeEnv({ store: { 'arcade.lang': 'en' } }).game().i18n.lang, 'en');
});
test('сохранённый выбор важнее opts.lang; opts.lang — умолчание игры вместо ru', () => {
  eq(makeEnv({ store: { 'arcade.lang': 'ru' } }).game({ lang: 'en' }).i18n.lang, 'ru');
  eq(makeEnv().game({ lang: 'en' }).i18n.lang, 'en');
});
test('мусор в arcade.lang игнорируется', () => {
  eq(makeEnv({ store: { 'arcade.lang': 'xx' } }).game().i18n.lang, 'ru');
});
test('toggle (L) переключает и сохраняет', () => {
  const e = makeEnv({ search: '?lang=en' }); const g = e.game();
  eq(g.i18n.toggle(), 'ru'); eq(e.store['arcade.lang'], 'ru');
});
test('Arcade.I18n недоступен снаружи, но правило — в createGame: несколько игр на странице согласованы', () => {
  const e = makeEnv({ search: '?lang=en' }); eq([e.game().i18n.lang, e.game().i18n.lang], ['en', 'en']);
});
test('DOM: data-en переводится, data-ru запоминает исходник, <html lang> следует языку', () => {
  const a = el('<b>КРОТ</b> — стрелки', { 'data-en': '<b>KROT</b> — arrows' }), b = el('язык', { 'data-ru': 'язык', 'data-en': 'language' });
  const e = makeEnv({ search: '?lang=en', dom: [a, b] }); const g = e.game();
  eq([a.innerHTML, b.innerHTML, e.docEl.lang], ['<b>KROT</b> — arrows', 'language', 'en']);
  g.i18n.toggle();
  eq([a.innerHTML, b.innerHTML, e.docEl.lang], ['<b>КРОТ</b> — стрелки', 'язык', 'ru']);
});
test('заставка: в EN заголовок/подзаголовок из strings.en, хотя в cfg — русский литерал', () => {
  const e = makeEnv({ search: '?lang=en' }); const g = e.game();
  g.useStandardScreens({ title: 'ИГРА', subtitle: 'Подзаголовок', lives: 1 }); g.scene('play', {});
  g.goto('title'); g.scenes.title.draw.call(g);
  eq(e.drawn.includes('GAME') && e.drawn.includes('Subtitle') && !e.drawn.includes('ИГРА'), true, String(e.drawn));
  e.drawn.length = 0; g.i18n.toggle(); g.scenes.title.draw.call(g);
  eq(e.drawn.includes('ИГРА') && e.drawn.includes('Подзаголовок'), true, String(e.drawn));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
