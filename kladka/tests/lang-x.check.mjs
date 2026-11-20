/* Проверки js/lang-x.js (TR / ES / PT поверх RU/EN движка) — общий файл для kaskad/otboynik/kladka (копии одинаковые).
   Настоящий engine.js игры в node:vm со шимами localStorage / location / canvas. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Песочница с движком игры и lang-x.js; search — строка адреса (?lang=…), mem — Map для localStorage, PF — заглушка площадки.
export function makeEngine(ROOT, { search = '', mem = new Map(), PF = null, strings, extra } = {}) {
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 10 })), set: (t, k, v) => ((t[k] = v), true) });
  const sb = { console, Math, Date, Promise, setTimeout, localStorage: ls, location: { search, protocol: 'http:' }, performance: { now: () => 0 },
    addEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false }) };
  sb.window = sb; sb.globalThis = sb; if (PF) sb.Platform = PF;
  vm.createContext(sb);
  for (const f of ['engine.js', 'js/lang-x.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  const canvas = { width: 10, height: 10, getContext: () => ctx2d, addEventListener() {} };
  const g = sb.Arcade.createGame({ canvas, width: 10, height: 10, gameId: 't', strings: JSON.parse(JSON.stringify(strings)) });
  g.useStandardScreens({});
  sb.ArcadeLangX.install(g, extra);
  return { g, mem, sb };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// Асинхронная часть (язык площадки) считается заранее, проверки — синхронные test(...).
export async function checkLangX({ ROOT, test, ok, eq, STR, STRX, title, skip = [] }) {
  const PF = { inited: false, init() { this.inited = true; return Promise.resolve(); }, pauseHook() {}, ready() {}, gameplayStart() {}, gameplayStop() {}, peek() { return null; }, save() {},
    lang() { return 'pt'; }, langFor(list) { return list.indexOf('en') >= 0 ? 'en' : list[0]; } };
  const pf = makeEngine(ROOT, { strings: STR, extra: STRX, PF }); await tick(); await tick();
  const PF2 = Object.assign({}, PF, { lang() { return 'de'; } }), mem2 = new Map([['arcade.lang', 'en'], ['arcade.lang.x', 'tr']]);
  const pf2 = makeEngine(ROOT, { strings: STR, extra: STRX, PF: PF2, mem: mem2 }); await tick(); await tick();

  test('lang-x: ?lang=tr|es|pt — перевод, нет ключа → EN; движок в режиме en; выбор сохраняется', () => {
    for (const l of ['tr', 'es', 'pt']) {
      const { g, mem } = makeEngine(ROOT, { search: '?lang=' + l, strings: STR, extra: STRX });
      eq(g.lang(), l); eq(g.i18n.lang, 'en', 'движок'); eq(g.t('play'), STRX[l].play); eq(g.t('title'), title, 'название внутри языка');
      eq(mem.get('arcade.lang.x'), l); eq(mem.get('arcade.lang'), 'en');
      eq(g.t('__nokey__', 'fb'), 'fb');
    }
  });
  test('lang-x: L циклом RU → EN → TR → ES → PT → RU; пункт меню «Язык: XX»', () => {
    const { g } = makeEngine(ROOT, { search: '?lang=ru', strings: STR, extra: STRX });
    const seen = [g.lang()]; for (let i = 0; i < 5; i++) { g.i18n.toggle(); seen.push(g.lang()); }
    eq(seen.join(','), 'ru,en,tr,es,pt,ru'); eq(g.t('play'), STR.ru.play, 'вернулись к RU');
    g.i18n.set('es'); const m = g.menu.get('title'), it = m.items[m.indexOf('lang')]; ok(/: ES$/.test(it.label()), it.label());
    g.i18n.set('en'); eq(g.t('play'), STR.en.play, 'EN без примеси перевода');
  });
  test('lang-x: сохранённый TR восстанавливается, если arcade.lang = en; RU в arcade.lang или ?lang=en — главнее', () => {
    const a = makeEngine(ROOT, { strings: STR, extra: STRX, mem: new Map([['arcade.lang', 'en'], ['arcade.lang.x', 'tr']]) }); eq(a.g.lang(), 'tr');
    const b = makeEngine(ROOT, { strings: STR, extra: STRX, mem: new Map([['arcade.lang', 'ru'], ['arcade.lang.x', 'tr']]) }); eq(b.g.lang(), 'ru');
    const c = makeEngine(ROOT, { search: '?lang=en', strings: STR, extra: STRX, mem: new Map([['arcade.lang', 'en'], ['arcade.lang.x', 'tr']]) });
    eq(c.g.lang(), 'en'); eq(c.mem.has('arcade.lang.x'), false, 'сброшен');
  });
  test('lang-x: язык площадки pt → PT (Яндекс 2.14); de → EN-откат, сохранённый TR снят', () => {
    eq(pf.g.lang(), 'pt'); eq(pf.g.t('play'), STRX.pt.play);
    eq(pf2.g.lang(), 'en'); eq(pf2.g.t('play'), STR.en.play);
  });
  test('lang-x: таблицы TR/ES/PT покрывают все ключи EN игры, строки непустые; движковые rw_*/loading переведены', () => {
    const need = Object.keys(STR.en).filter((k) => skip.indexOf(k) < 0).concat(['loading', 'rw_title', 'rw_continue', 'rw_no', 'rw_fail', 'rw_hint', 'rw_got']);
    for (const l of ['tr', 'es', 'pt']) for (const k of need) ok(STRX[l][k] != null && String(STRX[l][k]).trim(), l + '.' + k + ' нет перевода');
    for (const l of ['tr', 'es', 'pt']) for (const k of Object.keys(STRX[l])) ok(k in STR.en || /^(loading|rw_)/.test(k), l + '.' + k + ' — лишний ключ (нет в EN)');
  });
  test('lang-x: копии js/lang-x.js и tests/lang-x.check.mjs в kaskad/otboynik/kladka одинаковые', () => {
    for (const f of ['js/lang-x.js', 'tests/lang-x.check.mjs']) {
      const a = fs.readFileSync(path.join(ROOT, '..', 'kaskad', f), 'utf8');
      for (const s of ['otboynik', 'kladka']) eq(fs.readFileSync(path.join(ROOT, '..', s, f), 'utf8'), a, s + '/' + f);
    }
  });
}
