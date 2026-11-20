/* _shared/tests/i18n.test.mjs — единое правило языка движка v2.3 (Node, без зависимостей):
   • ?lang=en|ru в адресе — приоритет над сохранённым выбором, сохраняется в arcade.lang;
   • без параметра — сохранённый arcade.lang, иначе язык игры по умолчанию (opts.lang), иначе ru;
   • неверный ?lang= игнорируется; L/toggle сохраняет выбор; перевод DOM по data-en / data-ru;
   • заголовок/подзаголовок заставки в EN берутся из strings.en, даже если в cfg — русский литерал.
   • ссылка «← Каталог» (a[data-catalog-back], v2.4): RU → ../ , EN → ../en/ ; подпись и href следуют языку.
   • v2.8 — любые языки: языки игры = ключи strings (+ ru, en); ?lang= и сохранённый выбор — язык таблиц, иначе ru (ru/be/uk/kk/uz)
     или en (прочие известные коды), мусор игнорируется; L — по кругу; data-<язык> → data-en; каталог — EN для всех, кроме RU;
     встроенные строки движка TR/ES/PT (прочие — EN); pick({ru,en,…}); миграция arcade.lang.x пилотов; автоподбор кегля.
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
function makeEnv({ search = '', store = {}, dom = [], links = [], protocol = 'https:' } = {}) {
  const drawn = [];
  const win = {
    Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat, Date, console,
    location: { search, hash: '', protocol },
    localStorage: { _d: Object.assign({}, store), getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => 0 },
    matchMedia: () => ({ matches: false }),
  };
  const sizes = [];
  const ctx = { imageSmoothingEnabled: true, font: '', fillText(s) { drawn.push(String(s)); sizes.push([String(s), +((/(\d+)px/.exec(this.font) || [])[1] || 0)]); }, fillRect() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, strokeRect() {},
    measureText(s) { const m = /(\d+)px/.exec(this.font || ''); return { width: String(s).length * (m ? +m[1] : 16) * 0.6 }; } };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ctx };
  const docEl = { lang: 'ru' };
  const byAttr = (q) => { const m = /^\[data-([a-z]{2})\]$/.exec(q); return m ? dom.concat(links).filter((e) => e.getAttribute('data-' + m[1]) != null) : null; };
  win.document = { querySelector: () => canvas, querySelectorAll: (q) => (byAttr(q) || (q === 'a[data-catalog-back]' ? links : [])), documentElement: docEl, addEventListener() {}, hidden: false };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: 'engine.js' });
  const game = (o = {}) => win.Arcade.createGame(Object.assign({ canvas: '#c', width: 320, height: 200, gameId: 'tst',
    strings: { ru: { title: 'ИГРА', subtitle: 'Подзаголовок', play: 'Играть' }, en: { title: 'GAME', subtitle: 'Subtitle', play: 'Play' } } }, o));
  return { win, A: win.Arcade, store: win.localStorage._d, docEl, drawn, sizes, game };
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
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
test('?lang= с неизвестным кодом (мусор) игнорируется → сохранённый выбор', () => {
  const e = makeEnv({ search: '?lang=zz', store: { 'arcade.lang': 'ru' } });
  eq(e.game().i18n.lang, 'ru'); eq(e.store['arcade.lang'], 'ru');
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

// ---------- ссылка «← Каталог» (v2.4) ----------
const back = (html = '← Каталог', attrs = {}) => el(html, Object.assign({ href: '../', 'data-catalog-back': '1', 'data-en': '← Catalog' }, attrs));
test('каталог: RU — ссылка ведёт в ../ и подписана по-русски', () => {
  const a = back(); makeEnv({ links: [a] }).game();
  eq([a.getAttribute('href'), a.innerHTML, a.getAttribute('hreflang')], ['../', '← Каталог', 'ru']);
});
test('каталог: ?lang=en — ссылка ведёт в ../en/ и подписана по-английски', () => {
  const a = back(); makeEnv({ search: '?lang=en', links: [a] }).game();
  eq([a.getAttribute('href'), a.innerHTML, a.getAttribute('hreflang')], ['../en/', '← Catalog', 'en']);
});
test('каталог: сохранённый выбор en (без параметра) — тоже ../en/', () => {
  const a = back(); makeEnv({ store: { 'arcade.lang': 'en' }, links: [a] }).game();
  eq(a.getAttribute('href'), '../en/');
});
test('каталог: переключение языка в игре (L) обновляет href и подпись в обе стороны', () => {
  const a = back(); const g = makeEnv({ links: [a] }).game();
  g.i18n.toggle(); eq([a.getAttribute('href'), a.innerHTML], ['../en/', '← Catalog']);
  g.i18n.toggle(); eq([a.getAttribute('href'), a.innerHTML], ['../', '← Каталог']);
  g.i18n.set('en'); g.i18n.set('en'); eq(a.getAttribute('href'), '../en/', 'повторный set не дублирует en/');
});
test('каталог: ссылка без data-en — движок сам ставит английскую подпись и возвращает русскую', () => {
  const a = el('← Каталог', { href: '../', 'data-catalog-back': '1' }); const g = makeEnv({ search: '?lang=en', links: [a] }).game();
  eq([a.getAttribute('href'), a.innerHTML], ['../en/', '← Catalog']);
  g.i18n.toggle(); eq([a.getAttribute('href'), a.innerHTML], ['../', '← Каталог']);
});
test('каталог: ссылка со своей разметкой внутри и без data-en — меняется только href', () => {
  const a = el('&larr; <span class="lbl">Каталог</span>', { href: '../', 'data-catalog-back': '1' }); makeEnv({ search: '?lang=en', links: [a] }).game();
  eq([a.getAttribute('href'), a.innerHTML], ['../en/', '&larr; <span class="lbl">Каталог</span>']);
});
test('каталог: file:// — с index.html (без листинга папки); исходный ../index.html не ломает правило', () => {
  const a = back(), b = back('← Каталог', { href: '../index.html' });
  const g = makeEnv({ search: '?lang=en', links: [a, b], protocol: 'file:' }).game();
  eq([a.getAttribute('href'), b.getAttribute('href')], ['../en/index.html', '../en/index.html']);
  g.i18n.toggle(); eq([a.getAttribute('href'), b.getAttribute('href')], ['../index.html', '../index.html']);
});
test('каталог: catalogRoot — корень каталога из любого вида адреса', () => {
  const A = makeEnv().A;
  eq(['../', '../index.html', '../en/', '../en/index.html', '../../', '../?x=1', null, ''].map(A.catalogRoot), ['../', '../', '../', '../', '../../', '../', '../', '../']);
});
test('каталог: несколько ссылок на странице (шапка + экран конца) обновляются все', () => {
  const a = back(), b = back(); makeEnv({ search: '?lang=en', links: [a, b] }).game();
  eq([a.getAttribute('href'), b.getAttribute('href')], ['../en/', '../en/']);
});


// ---------- v2.8: любые языки из таблиц игры ----------
const ML = {
  ru: { title: 'ИГРА', play: 'Играть', only: 'только ru', foo: 'Фу' },
  en: { title: 'GAME', play: 'Play', foo: 'Foo', bar: 'Bar' },
  tr: { title: 'GAME', play: 'Oyna', foo: 'Fu' },
  es: { title: 'GAME', play: 'Jugar' },
  pt: { title: 'GAME', play: 'Jogar' },
};
const mgame = (e, o = {}) => e.game(Object.assign({ strings: JSON.parse(JSON.stringify(ML)) }, o));
test('v2.8: языки игры — ru, en + ключи таблиц по порядку; ?lang=tr|es|pt — язык таблиц, сохраняется', () => {
  for (const l of ['tr', 'es', 'pt']) { const e = makeEnv({ search: '?lang=' + l }); const g = mgame(e); eq(g.i18n.lang, l); eq(e.store['arcade.lang'], l); eq(g.t('play'), ML[l].play); eq(g.i18n.code(), l.toUpperCase()); }
  eq(mgame(makeEnv()).i18n.langs, ['ru', 'en', 'tr', 'es', 'pt']);
  eq(makeEnv().game().i18n.langs, ['ru', 'en'], 'игра RU/EN — как раньше');
  eq(makeEnv().game({ strings: { ru: { a: 1 }, 'pt-BR': { a: 2 }, x: {} } }).i18n.langs, ['ru', 'en'], 'не двухбуквенные ключи — не языки');
});
test('v2.8: перевода нет — строка игры EN (не русский fallback), встроенные строки движка — на языке, ключа нигде нет — fallback', () => {
  const g = mgame(makeEnv({ search: '?lang=tr' }));
  eq(g.t('bar'), 'Bar', 'EN таблица игры'); eq(g.t('bar', 'Бар'), 'Bar', 'EN важнее русского fallback'); eq(g.t('only', 'fb'), 'fb');
  eq([g.t('rw_title'), g.t('loading'), g.t('resume'), g.t('noads'), g.t('ui_lb')], ['BİR ŞANS DAHA?', 'Yükleniyor…', 'Devam et', 'Reklamsız', 'Liderler']);
  const es = mgame(makeEnv({ search: '?lang=es' })), pt = mgame(makeEnv({ search: '?lang=pt' }));
  eq([es.t('rw_continue'), es.t('pause'), pt.t('rw_no'), pt.t('menu')], ['Ver anuncio: continuar', 'PAUSA', 'Não, encerrar', 'Menu principal']);
  const de = makeEnv({ search: '?lang=de' }).game({ strings: { ru: {}, en: { play: 'Play' }, de: { play: 'Spielen' } } });
  eq([de.i18n.lang, de.t('play'), de.t('rw_title'), de.t('pause', 'PAUSE!')], ['de', 'Spielen', 'ONE MORE CHANCE?', 'PAUSE!'], 'язык без встроенных строк → EN');
  const ru = mgame(makeEnv()); eq([ru.t('play'), ru.t('pause'), ru.t('zz', 'х')], ['Играть', 'ПАУЗА', 'х'], 'RU как раньше');
  eq(makeEnv({ search: '?lang=en' }).game({ strings: { ru: {}, en: {} } }).t('play'), 'Play', 'EN без ключа play — встроенная EN, не «Играть»');
});
test('v2.8: игра RU/EN — ?lang=tr → EN (предпочтение tr сохраняется для других игр), ?lang=uk → RU, ?lang=de → EN; сохранённый tr → EN', () => {
  const e = makeEnv({ search: '?lang=tr' }); eq(e.game().i18n.lang, 'en'); eq(e.store['arcade.lang'], 'tr');
  eq(makeEnv({ search: '?lang=uk' }).game().i18n.lang, 'ru'); eq(makeEnv({ search: '?lang=de' }).game().i18n.lang, 'en');
  eq(makeEnv({ store: { 'arcade.lang': 'tr' } }).game().i18n.lang, 'en'); eq(mgame(makeEnv({ store: { 'arcade.lang': 'tr' } })).i18n.lang, 'tr');
  eq(makeEnv({ store: { 'arcade.lang': 'kk' } }).game().i18n.lang, 'ru'); eq(makeEnv({ search: '?lang=pt-BR' }).game().i18n.lang, 'en');
  eq(mgame(makeEnv({ search: '?lang=pt-BR' })).i18n.lang, 'pt');
});
test('v2.8: L — по кругу ru → en → tr → es → pt → ru; подпись «Язык: XX»; игра RU/EN — ru ↔ en', () => {
  const e = makeEnv({ search: '?lang=ru' }), g = mgame(e); g.useStandardScreens({}); const seen = [g.i18n.lang];
  for (let i = 0; i < 5; i++) seen.push(g.i18n.toggle()); eq(seen, ['ru', 'en', 'tr', 'es', 'pt', 'ru']);
  const m = g.menu.get('title'), it = m.items[m.indexOf('lang')]; g.i18n.set('es'); eq(it.label(), 'Idioma: ES'); eq(e.store['arcade.lang'], 'es');
  g.i18n.set('ru'); eq(it.label(), 'Язык: RU'); g.i18n.set('xx'); eq(g.i18n.lang, 'en', 'set мусора → en');
  const r = makeEnv().game(); r.useStandardScreens({}); const ri = r.menu.get('title').items[r.menu.get('title').indexOf('lang')];
  eq([ri.label(), r.i18n.toggle(), r.i18n.toggle()], ['Язык: RU', 'en', 'ru']);
});
test('v2.8: DOM — data-<язык>, нет — data-en, нет и его — исходник; <html lang>; RU возвращает исходник', () => {
  const a = el('Привет', { 'data-en': 'Hello', 'data-tr': 'Merhaba' }), b = el('Пока', { 'data-en': 'Bye' }), c = el('Только', { 'data-es': 'Solo' });
  const e = makeEnv({ search: '?lang=tr', dom: [a, b, c] }), g = mgame(e);
  eq([a.innerHTML, b.innerHTML, c.innerHTML, e.docEl.lang], ['Merhaba', 'Bye', 'Только', 'tr']);
  g.i18n.set('es'); eq([a.innerHTML, b.innerHTML, c.innerHTML], ['Hello', 'Bye', 'Solo']);
  g.i18n.set('ru'); eq([a.innerHTML, b.innerHTML, c.innerHTML, e.docEl.lang], ['Привет', 'Пока', 'Только', 'ru']);
});
test('v2.8: каталог — EN-каталог для всех языков, кроме RU; подпись data-<язык>', () => {
  const a = back('← Каталог', { 'data-tr': '← Katalog' }), g = mgame(makeEnv({ search: '?lang=tr', links: [a] }));
  eq([a.getAttribute('href'), a.innerHTML, a.getAttribute('hreflang')], ['../en/', '← Katalog', 'en']);
  g.i18n.set('pt'); eq([a.getAttribute('href'), a.innerHTML], ['../en/', '← Catalog']); g.i18n.set('ru'); eq([a.getAttribute('href'), a.innerHTML], ['../', '← Каталог']);
  const b = el('← Каталог', { href: '../', 'data-catalog-back': '1' }); mgame(makeEnv({ search: '?lang=es', links: [b] })); eq([b.getAttribute('href'), b.innerHTML], ['../en/', '← Catalog']);
});
test('v2.8: миграция пилотов v2.7 — arcade.lang=en + arcade.lang.x=tr → tr (ключ x удаляется); ?lang= — сбрасывает x', () => {
  const e = makeEnv({ store: { 'arcade.lang': 'en', 'arcade.lang.x': 'tr' } }); e.win.localStorage.removeItem = function (k) { delete this._d[k]; };
  eq(mgame(e).i18n.lang, 'tr'); eq(e.store['arcade.lang'], 'tr'); eq(e.store['arcade.lang.x'], undefined);
  const e2 = makeEnv({ store: { 'arcade.lang': 'ru', 'arcade.lang.x': 'es' } }); e2.win.localStorage.removeItem = function (k) { delete this._d[k]; };
  eq(mgame(e2).i18n.lang, 'ru', 'RU в arcade.lang главнее'); eq(e2.store['arcade.lang.x'], undefined);
  const e3 = makeEnv({ store: { 'arcade.lang': 'en', 'arcade.lang.x': 'pt' } }); eq(e3.game().i18n.lang, 'en', 'в игре RU/EN — EN');
});
test('v2.8: pick({ru,en,…}) — язык → en → ru; useRewardedBonus/usePlayers берут подпись по языку с откатом на EN', () => {
  const g = mgame(makeEnv({ search: '?lang=tr' }));
  eq([g.i18n.pick({ ru: 'а', en: 'b', tr: 'c' }), g.i18n.pick({ ru: 'а', en: 'b' }), g.i18n.pick({ ru: 'а' }), g.i18n.pick('s')], ['c', 'b', 'а', 's']);
  const r = mgame(makeEnv()); eq(r.i18n.pick({ ru: 'а', en: 'b' }), 'а');
  g.useStandardScreens({}); g.useRewardedBonus({ key: 'rwX', scene: 'pause', label: { ru: 'Реклама', en: 'Watch ad' }, grant() {} });
  eq(g._bonuses[0].item.label(), 'Watch ad');
  g.usePlayers({ bind: { p1: { left: ['ArrowLeft'] }, p2: { left: ['KeyA'] } }, hint: { ru: ['р1', 'р2'], en: ['e1', 'e2'] } });
  eq(g.menu._hints.title.call(g).map((x) => x.text), ['e1', 'e2']);
});
test('v2.8: автоподбор кегля — длинный заголовок overlay/пункт меню/подсказка уменьшаются, короткие — как раньше', () => {
  const e = makeEnv({ search: '?lang=tr' }), g = mgame(e); g.useStandardScreens({}); g.scene('play', {});
  e.sizes.length = 0; g.overlay('ÇOK UZUN BİR BAŞLIK METNİ BURADA', 'kısa'); const big = e.sizes.find((x) => x[0].startsWith('ÇOK'));
  ok(big[1] < 35 && big[1] >= 14 && big[0].length * big[1] * 0.6 <= 320 - 24, 'заголовок ужат: ' + big[1]);
  e.sizes.length = 0; g.overlay('OK', 'kısa'); eq(e.sizes.find((x) => x[0] === 'OK')[1], 35, 'короткий — min(44, W/9)');
  e.sizes.length = 0; g.menu.addItem({ key: 'long', label: 'Çok uzun bir menü maddesi metni burada duruyor' }); g.goto('title'); g.scenes.title.draw.call(g);
  const it = e.sizes.find((x) => /Çok uzun/.test(x[0])); ok(it[1] < 17 && it[1] >= 11, 'пункт меню ужат: ' + it[1]);
  eq(e.sizes.find((x) => /Oyna/.test(x[0]))[1], 17, 'короткий пункт — 17');
  eq(g.fitSize('abc', 0, 20), 20, 'maxWidth 0 — без подбора');
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
