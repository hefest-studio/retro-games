/* Проверки языков RU/EN/TR/ES/PT пилотной игры на движке v2.8 (языки — ключи таблиц strings; бывшие js/lang-x.js и js/i18n-x.js
   удалены). Общий файл для kaskad/otboynik/kladka (копии одинаковые). Настоящий engine.js игры в node:vm со шимами
   localStorage / location / canvas. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Песочница с движком игры; search — строка адреса (?lang=…), mem — Map для localStorage, PF — заглушка площадки.
export function makeEngine(ROOT, { search = '', mem = new Map(), PF = null, strings } = {}) {
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 10 })), set: (t, k, v) => ((t[k] = v), true) });
  const sb = { console, Math, Date, Promise, setTimeout, localStorage: ls, location: { search, protocol: 'http:' }, performance: { now: () => 0 },
    addEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false }) };
  sb.window = sb; sb.globalThis = sb; if (PF) sb.Platform = PF;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), sb, { filename: 'engine.js' });
  const canvas = { width: 10, height: 10, getContext: () => ctx2d, addEventListener() {} };
  const g = sb.Arcade.createGame({ canvas, width: 10, height: 10, gameId: 't', strings: JSON.parse(JSON.stringify(strings)) });
  g.useStandardScreens({});
  return { g, mem, sb };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const X = ['tr', 'es', 'pt'];

// Асинхронная часть (язык площадки) считается заранее, проверки — синхронные test(...).
export async function checkLangs({ ROOT, test, ok, eq, STR, title, skip = [] }) {
  const PF = { inited: false, init() { this.inited = true; return Promise.resolve(); }, pauseHook() {}, ready() {}, gameplayStart() {}, gameplayStop() {}, peek() { return null; }, save() {},
    lang() { return 'pt'; }, langFor(list) { const l = this.lang(); return list.indexOf(l) >= 0 ? l : list.indexOf('en') >= 0 ? 'en' : list[0]; } };
  const pf = makeEngine(ROOT, { strings: STR, PF }); await tick(); await tick();
  const pf2 = makeEngine(ROOT, { strings: STR, PF: Object.assign({}, PF, { lang() { return 'de'; } }), mem: new Map([['arcade.lang', 'tr']]) }); await tick(); await tick();

  test('языки: таблицы игры — ru, en, tr, es, pt; ?lang=tr|es|pt — перевод, выбор сохраняется; название внутри языка — ' + title, () => {
    eq(Object.keys(STR).join(','), 'ru,en,tr,es,pt');
    for (const l of X) {
      const { g, mem } = makeEngine(ROOT, { search: '?lang=' + l, strings: STR });
      eq(g.i18n.lang, l); eq(g.t('play'), STR[l].play); eq(g.t('title'), title, 'название'); eq(mem.get('arcade.lang'), l);
      eq(g.t('__nokey__', 'fb'), 'fb');
      ok(g.t('rw_title') !== makeEngine(ROOT, { search: '?lang=en', strings: STR }).g.t('rw_title'), l + ': строки движка переведены (rw_title)');
    }
  });
  test('языки: L — по кругу RU → EN → TR → ES → PT → RU; пункт меню «Язык: XX»', () => {
    const { g } = makeEngine(ROOT, { search: '?lang=ru', strings: STR });
    const seen = [g.i18n.lang]; for (let i = 0; i < 5; i++) seen.push(g.i18n.toggle());
    eq(seen.join(','), 'ru,en,tr,es,pt,ru'); eq(g.t('play'), STR.ru.play, 'вернулись к RU');
    g.i18n.set('es'); const m = g.menu.get('title'), it = m.items[m.indexOf('lang')]; ok(/: ES$/.test(it.label()), it.label());
    g.i18n.set('en'); eq(g.t('play'), STR.en.play);
  });
  test('языки: сохранённый TR восстанавливается; миграция v2.7 (arcade.lang=en + arcade.lang.x=tr) → tr; ?lang=en главнее', () => {
    eq(makeEngine(ROOT, { strings: STR, mem: new Map([['arcade.lang', 'tr']]) }).g.i18n.lang, 'tr');
    const a = makeEngine(ROOT, { strings: STR, mem: new Map([['arcade.lang', 'en'], ['arcade.lang.x', 'es']]) }); eq(a.g.i18n.lang, 'es'); eq(a.mem.get('arcade.lang'), 'es'); eq(a.mem.has('arcade.lang.x'), false);
    const c = makeEngine(ROOT, { search: '?lang=en', strings: STR, mem: new Map([['arcade.lang', 'tr']]) }); eq(c.g.i18n.lang, 'en');
  });
  test('языки: язык площадки pt → PT (Яндекс 2.14); de → EN', () => {
    eq(pf.g.i18n.lang, 'pt'); eq(pf.g.t('play'), STR.pt.play);
    eq(pf2.g.i18n.lang, 'en'); eq(pf2.g.t('play'), STR.en.play);
  });
  test('языки: таблицы TR/ES/PT покрывают все ключи EN игры, строки непустые, лишних ключей нет', () => {
    const need = Object.keys(STR.en).filter((k) => skip.indexOf(k) < 0);
    for (const l of X) for (const k of need) ok(STR[l][k] != null && String(STR[l][k]).trim(), l + '.' + k + ' нет перевода');
    for (const l of X) for (const k of Object.keys(STR[l])) ok(k in STR.en, l + '.' + k + ' — лишний ключ (нет в EN)');
  });
  test('языки: js/lang-x.js и js/i18n-x.js удалены; копии tests/langs.check.mjs в kaskad/otboynik/kladka одинаковые', () => {
    for (const f of ['js/lang-x.js', 'js/i18n-x.js']) ok(!fs.existsSync(path.join(ROOT, f)), f + ' остался');
    const a = fs.readFileSync(path.join(ROOT, '..', 'kaskad', 'tests/langs.check.mjs'), 'utf8');
    for (const s of ['otboynik', 'kladka']) eq(fs.readFileSync(path.join(ROOT, '..', s, 'tests/langs.check.mjs'), 'utf8'), a, s);
  });
}
