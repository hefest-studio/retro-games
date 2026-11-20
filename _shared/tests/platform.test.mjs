/* _shared/tests/platform.test.mjs — единый адаптер площадок _shared/platform.js и его связка с движком v2.5 (Node, без
   зависимостей, моки SDK — _shared/tests/mocks/{yandex,gamepush}-sdk.js, настоящая сеть не используется).
   Проверяет: определение площадки (?platform, src platform.js, <meta>, окружение, по умолчанию web); web — без сети, без
   рекламы, localStorage; Яндекс — /sdk.js грузится только при platform=yandex, ready() один раз, gameplayStart/Stop без
   повторов, язык; реклама за награду — onReward только при успешном просмотре (досмотрел / пропустил / ошибка); полноэкранная —
   не чаще interstitialGap; пауза/звук — хуки на время рекламы и событий площадки (причины складываются); save/load — облако,
   откат на localStorage при отказе SDK и при таймауте; GamePush — ключи только из <meta>, без них — откат, адрес загрузчика,
   поле сохранения JSON, внешние ссылки по флагу площадки; движок: язык площадки, скрытие ссылок, gameplay по сценам,
   рекорд в облако, реклама на gameover, пауза цикла и звука; без platform.js движок работает как раньше.
   Запуск: node _shared/tests/platform.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, '_shared/platform.js'), 'utf8');
const ENGINE = fs.readFileSync(path.join(ROOT, '_shared/engine.js'), 'utf8');
const MOCK = { yandex: fs.readFileSync(path.join(HERE, 'mocks/yandex-sdk.js'), 'utf8'), gamepush: fs.readFileSync(path.join(HERE, 'mocks/gamepush-sdk.js'), 'utf8') };

function el(tag, attrs = {}) { return { tag, style: {}, innerHTML: '', _a: Object.assign({}, attrs), getAttribute(k) { return k in this._a ? this._a[k] : null; }, setAttribute(k, v) { this._a[k] = String(v); } }; }
function makeWin({ search = '', host = 'localhost', metas = {}, links = [], store = {}, mock = {}, scriptSrc = null, noPlatform = false } = {}) {
  const loads = [];
  const win = { console, Math, Object, Array, JSON, Error, Promise, Date, parseInt, parseFloat, Float32Array,
    location: { search, hostname: host, hash: '', protocol: 'https:' }, setTimeout, clearTimeout,
    localStorage: { _d: Object.assign({}, store), getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    __sdkMock: Object.assign({}, mock), __sdkLog: [] };
  const metaEls = Object.entries(metas).map(([n, c]) => el('meta', { name: n, content: c }));
  win.document = {
    currentScript: scriptSrc ? el('script', { src: scriptSrc }) : null, documentElement: { lang: 'ru' }, hidden: false, readyState: 'complete',
    querySelector(q) { const m = /^meta\[name="([^"]+)"\]$/.exec(q); if (m) return metaEls.find(e => e.getAttribute('name') === m[1]) || null; return null; },
    querySelectorAll(q) { if (q === 'a[href]') return links.filter(a => a.getAttribute('href') != null); if (q === 'a[data-catalog-back]') return links.filter(a => a.getAttribute('data-catalog-back') != null); if (q === '[data-en]') return links.filter(a => a.getAttribute('data-en') != null); return []; },
    addEventListener() {}, createElement() { return el('script'); }, head: { appendChild() {} } };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  if (!noPlatform) vm.runInContext(SRC, win, { filename: 'platform.js' });
  // loadScript: «грузит» мок вместо настоящего SDK (и запоминает адрес); fail — имитация блокировщика
  const mk = (env = {}) => win.ArcadePlatform.create(Object.assign({ win, doc: win.document, loadScript(src) { loads.push(src); if (env.fail) return Promise.reject(new Error('blocked')); if (env.hang) return new Promise(() => {}); vm.runInContext(MOCK[/gamepush|game-score/.test(src) ? 'gamepush' : 'yandex'], win); return Promise.resolve(); } }, env));
  return { win, loads, mk, log: win.__sdkLog, store: win.localStorage._d };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GP_META = { 'gamepush-project-id': '123', 'gamepush-public-token': 'tok' };

const queue = []; let passed = 0, failed = 0;
function test(name, fn) { queue.push([name, fn]); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

// ---------- определение площадки ----------
test('площадка: по умолчанию web; ?platform=yandex|gamepush; src platform.js?platform=; <meta arcade-platform>; окружение Яндекса', () => {
  eq(makeWin().mk().name, 'web');
  eq(makeWin({ search: '?a=1&platform=yandex' }).mk().name, 'yandex');
  eq(makeWin({ search: '?platform=GamePush' }).mk().name, 'gamepush');
  eq(makeWin({ search: '?platform=poki' }).mk().name, 'web', 'неизвестная площадка');
  eq(makeWin({ scriptSrc: './js/platform.js?platform=gamepush' }).mk().name, 'gamepush');
  eq(makeWin({ metas: { 'arcade-platform': 'yandex' } }).mk().name, 'yandex');
  eq(makeWin({ host: 'games.yandex.ru' }).mk().name, 'yandex');
  eq(makeWin({ search: '?platform=web', host: 'yandex.ru' }).mk().name, 'web', '?platform важнее окружения');
  const w = makeWin(); w.win.YaGames = {}; eq(w.mk().name, 'yandex');
  eq(makeWin().win.Platform.name, 'web', 'глобальный экземпляр');
});
test('глобальный API: Platform и ArcadePlatform.create, все методы на месте', () => {
  const P = makeWin().win.Platform;
  ['init', 'ready', 'gameplayStart', 'gameplayStop', 'showRewarded', 'showInterstitial', 'save', 'load', 'peek', 'flush', 'lang', 'langFor', 'pauseHook'].forEach(k => ok(typeof P[k] === 'function', k));
  ok(typeof P.allowExternalLinks === 'boolean' && P.leaderboard && P.leaderboard.available === false, 'allowExternalLinks / leaderboard');
});

// ---------- web ----------
test('web: init без сети, рекламы нет (награда не выдаётся), ссылки разрешены, save/load — localStorage', async () => {
  const w = makeWin(), P = w.mk(); await P.init();
  eq(w.loads, [], 'web не грузит скриптов'); ok(P.allowExternalLinks && !P.hasAds && !P.cloud);
  let got = 0; eq(await P.showRewarded(() => got++), false); eq(got, 0); eq(await P.showInterstitial(), false);
  await P.save('best.x', 42); eq(w.store['arcade.pf.best.x'], '42'); eq(await P.load('best.x'), 42);
  eq(makeWin({ store: { 'arcade.pf.k': '{"a":1}' } }).mk().peek('k'), { a: 1 }, 'чтение из localStorage');
  eq(P.lang(), null);
});

// ---------- Яндекс ----------
test('Яндекс: /sdk.js грузится только при platform=yandex; ready() один раз; gameplayStart/Stop — только смена состояния', async () => {
  const w = makeWin(), P = w.mk({ platform: 'yandex' });
  ok(P.allowExternalLinks === false && P.hasAds, 'до init: ссылки запрещены, реклама есть');
  P.ready(); P.gameplayStart(); eq(w.log, [], 'до init — ничего');
  await P.init(); eq(w.loads, ['/sdk.js']);
  P.ready(); P.ready(); P.gameplayStart(); P.gameplayStop(); P.gameplayStop(); P.gameplayStart();
  eq(w.log.filter(x => x !== 'getPlayer' && x !== 'getData'), ['init', 'ready', 'start', 'stop', 'start']);
  ok(P.cloud && P.sdk, 'облако');
});
test('Яндекс: язык площадки (ISO 639-1) → ближайший из ru/en: tr → en, be → ru', async () => {
  for (const [l, want] of [['ru', 'ru'], ['en', 'en'], ['tr', 'en'], ['be', 'ru'], ['kk', 'ru']]) {
    const P = makeWin({ mock: { lang: l } }).mk({ platform: 'yandex' }); await P.init(); eq(P.lang(), l); eq(P.langFor(['ru', 'en']), want, l);
  }
});
test('реклама за награду: onReward только при досмотре; пропуск и ошибка — без награды; на время ролика геймплей стоит', async () => {
  for (const [mode, want] of [['ok', 1], ['skip', 0], ['error', 0]]) {
    const w = makeWin({ mock: { rewarded: mode } }), P = w.mk({ platform: 'yandex' }); await P.init(); P.gameplayStart(); w.log.length = 0;
    let got = 0; const r = await P.showRewarded(() => got++);
    eq(got, want, mode); eq(r, !!want, mode + ' результат');
    eq(w.log[0], 'stop', mode + ': stop перед роликом'); eq(w.log[w.log.length - 1], 'start', mode + ': start после');
  }
});
test('полноэкранная реклама: не чаще interstitialGap (60 с), вторая подряд и во время показа — отказ; ошибка показа — false', async () => {
  let t = 1000000; const w = makeWin(), P = w.mk({ platform: 'yandex', now: () => t }); await P.init();
  const p1 = P.showInterstitial(); eq(await P.showInterstitial(), false, 'во время показа'); eq(await p1, true);
  t += 30000; eq(await P.showInterstitial(), false, 'через 30 с');
  t += 31000; eq(await P.showInterstitial(), true, 'через 61 с');
  eq(w.log.filter(x => x === 'fullscreen').length, 2);
  const w2 = makeWin({ mock: { fullscreen: 'error' } }), P2 = w2.mk({ platform: 'yandex' }); await P2.init(); eq(await P2.showInterstitial(), false);
  const P3 = makeWin().mk({ platform: 'yandex', config: { interstitialGap: 5 }, now: () => t }); await P3.init(); eq(await P3.showInterstitial(), true); t += 6000; eq(await P3.showInterstitial(), true, 'свой интервал');
});
test('пауза/звук: хуки на время рекламы; события площадки (game_api_pause/resume) и реклама вместе — одна пауза', async () => {
  const w = makeWin(), P = w.mk({ platform: 'yandex' }); await P.init(); const ev = [];
  const off = P.pauseHook(r => ev.push('pause:' + r), r => ev.push('resume:' + r));
  const p = P.showRewarded(() => {}); await sleep(5); ok(P.paused, 'во время ролика пауза');
  P.sdk._fire('game_api_pause'); P.sdk._fire('game_api_resume'); // вкладка мигнула во время ролика
  await p; eq(ev, ['pause:ad', 'resume:ad']); ok(!P.paused);
  P.sdk._fire('game_api_pause'); ok(P.paused); P.sdk._fire('game_api_resume'); eq(ev.slice(2), ['pause:platform', 'resume:platform']);
  off(); P.sdk._fire('game_api_pause'); eq(ev.length, 4, 'отписка');
});
test('save/load: облако площадки важнее localStorage; запись — сразу локально, в облако пачкой после saveDelay', async () => {
  const w = makeWin({ mock: { cloud: { 'best.g': 900 } }, store: { 'arcade.pf.best.g': '100', 'arcade.pf.lvl': '3' } });
  const P = w.mk({ platform: 'yandex', config: { saveDelay: 20 } }); await P.init();
  eq(await P.load('best.g'), 900, 'облако'); eq(await P.load('lvl'), 3, 'нет в облаке — localStorage'); eq(await P.load('nope'), null);
  await P.save('best.g', 1200); await P.save('opts', { snd: 0 }); eq(w.store['arcade.pf.best.g'], '1200', 'локально сразу');
  ok(!w.log.includes('setData'), 'облако — не сразу'); await sleep(60);
  eq(w.log.filter(x => x === 'setData').length, 1, 'одна пачка'); eq(w.win.__sdkMock.saved, { 'best.g': 1200, opts: { snd: 0 } });
});
test('отказ SDK (блокировщик / нет сети) и таймаут: игра работает — локальные сохранения, без рекламы, ссылки по-прежнему скрыты', async () => {
  for (const env of [{ fail: true }, { hang: true, config: { initTimeout: 40 } }]) {
    const w = makeWin(), P = w.mk(Object.assign({ platform: 'yandex' }, env)); await P.init();
    ok(P.inited && !P.hasAds && !P.cloud && P.errors.length, JSON.stringify(P.errors)); ok(P.allowExternalLinks === false, 'на Яндексе ссылки нельзя и без SDK');
    let got = 0; eq(await P.showRewarded(() => got++), false); eq(got, 0);
    await P.save('k', 5); eq(await P.load('k'), 5); P.ready(); P.gameplayStart();
  }
});

// ---------- GamePush ----------
test('GamePush: без ID проекта и токена в <meta> (или с плейсхолдером) — SDK не грузится, откат', async () => {
  for (const metas of [{}, { 'gamepush-project-id': 'GP_PROJECT_ID', 'gamepush-public-token': 'GP_PUBLIC_TOKEN' }]) {
    const w = makeWin({ metas }), P = w.mk({ platform: 'gamepush' }); await P.init();
    eq(w.loads, []); ok(!P.hasAds && /ID проекта/.test(P.errors[0]), JSON.stringify(P.errors));
  }
});
test('GamePush: загрузчик с projectId/publicToken/callback из <meta>; ready → gameStart; язык; ссылки по флагу площадки', async () => {
  const w = makeWin({ metas: GP_META, mock: { lang: 'ru' } }), P = w.mk({ platform: 'gamepush' }); await P.init();
  eq(w.loads, ['https://gamepush.com/sdk/game-score.js?projectId=123&publicToken=tok&callback=onGPInit']);
  P.ready(); P.gameplayStart(); P.gameplayStop(); eq(w.log, ['init', 'ready', 'start', 'stop']);
  eq(P.langFor(['ru', 'en']), 'ru'); ok(P.allowExternalLinks === false);
  const w2 = makeWin({ metas: GP_META, mock: { links: true } }), P2 = w2.mk({ platform: 'gamepush' }); await P2.init(); ok(P2.allowExternalLinks === true, 'площадка разрешила ссылки');
  const w3 = makeWin({ metas: Object.assign({ 'arcade-sdk-url': './mock-gp.js' }, GP_META) }), P3 = w3.mk({ platform: 'gamepush' }); await P3.init(); ok(/^\.\/mock-gp\.js\?projectId=123/.test(w3.loads[0]), 'свой адрес SDK');
});
test('GamePush: награда только при успехе; сохранения — JSON в поле игрока + sync; облако важнее localStorage', async () => {
  for (const [mode, want] of [['ok', 1], ['skip', 0]]) {
    const w = makeWin({ metas: GP_META, mock: { rewarded: mode } }), P = w.mk({ platform: 'gamepush' }); await P.init(); const ev = []; P.pauseHook(() => ev.push('p'), () => ev.push('r'));
    let got = 0; eq(await P.showRewarded(() => got++), !!want); eq(got, want, mode); eq(ev, ['p', 'r'], mode + ' пауза');
  }
  const w = makeWin({ metas: Object.assign({ 'gamepush-save-field': 'progress' }, GP_META), mock: { cloud: '{"best.g":7}', field: 'progress' }, store: { 'arcade.pf.best.g': '3' } });
  const P = w.mk({ platform: 'gamepush', config: { saveDelay: 10 } }); await P.init(); eq(await P.load('best.g'), 7);
  await P.save('best.g', 8); await sleep(40); eq(JSON.parse(w.win.__sdkMock.saved), { 'best.g': 8 }); ok(w.log.includes('sync'));
});

// ---------- связка с движком ----------
function engineEnv({ platform = null, search = '', mock = {}, metas = {}, store = {} } = {}) {
  const links = [el('a', { href: '../', 'data-catalog-back': '1', 'data-en': '← Catalog' }), el('a', { href: 'https://example.org/' }), el('a', { href: '#top' })];
  const w = makeWin({ search, mock, metas, links, store, noPlatform: !platform }); const win = w.win;
  let raf = null; const ac = { state: 'running', calls: [], suspend() { this.calls.push('suspend'); }, resume() { this.calls.push('resume'); }, createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: {}, type: '' }; }, createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }, destination: {} };
  Object.assign(win, { addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, requestAnimationFrame(f) { raf = f; return 1; }, cancelAnimationFrame() {}, performance: { now: () => 0 }, AudioContext: function () { return ac; } });
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true, save() {}, restore() {}, fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {} }) };
  win.document.querySelector = ((q0) => (q) => q === '#c' ? canvas : q0(q))(win.document.querySelector.bind(win.document));
  if (platform) win.Platform = w.mk({ platform, config: { saveDelay: 10 } });
  vm.runInContext(ENGINE, win, { filename: 'engine.js' });
  const g = win.Arcade.createGame({ canvas: '#c', width: 100, height: 100, gameId: 'tst', strings: { ru: { play: 'Играть' }, en: { play: 'Play' } } });
  return { w, win, g, links, ac, frame: (t) => raf && raf(t), log: w.log };
}
test('движок без platform.js: как раньше (g.platform = null, ссылки на месте, версия 2.5.0)', () => {
  const e = engineEnv(); ok(e.g.platform === null); ok(!e.links.some(a => a.style.display === 'none')); eq(e.win.Arcade.version, '2.5.0');
});
test('движок + web: ссылки не прячутся, язык — по правилу движка', async () => {
  const e = engineEnv({ platform: 'web' }); await e.win.Platform.init(); ok(e.g.platform); ok(!e.links.some(a => a.style.display === 'none')); eq(e.g.i18n.lang, 'ru');
});
test('движок + Яндекс: ссылки наружу и «← Каталог» скрыты (якоря — нет); язык площадки, но ?lang= важнее', async () => {
  const e = engineEnv({ platform: 'yandex', mock: { lang: 'en' } });
  ok(e.links[0].style.display === 'none' && e.links[1].style.display === 'none' && e.links[2].style.display !== 'none', 'ссылки');
  ok(e.links[0].getAttribute('data-platform-hidden') === '1');
  await e.win.Platform.init(); await sleep(0); eq(e.g.i18n.lang, 'en', 'язык площадки');
  const e2 = engineEnv({ platform: 'yandex', mock: { lang: 'en' }, search: '?lang=ru' }); await e2.win.Platform.init(); await sleep(0); eq(e2.g.i18n.lang, 'ru', '?lang важнее');
  const e3 = engineEnv({ platform: 'yandex', mock: { lang: 'de' } }); await e3.win.Platform.init(); await sleep(0); eq(e3.g.i18n.lang, 'en', 'de → en');
});
test('движок + Яндекс: start() → ready; сцена play → gameplayStart, pause/gameover → stop; рекорд — в облако; gameover — полноэкранная реклама', async () => {
  const e = engineEnv({ platform: 'yandex' }), g = e.g; g.useStandardScreens({ title: 'Т' }); g.scene('play', { update() {}, draw() {} });
  await e.win.Platform.init(); g.start('title'); g.goto('play'); g.goto('pause'); g.goto('play', { resume: true });
  eq(e.log.filter(x => ['ready', 'start', 'stop'].includes(x)), ['ready', 'start', 'stop', 'start']);
  g.state.score = 555; g.gameover(); await sleep(60);
  ok(e.log.includes('fullscreen'), 'реклама в паузе gameover'); eq(e.w.store['arcade.best.tst'], '555'); eq(e.w.store['arcade.pf.best.tst'], '555');
  ok(e.log.includes('setData') && e.win.__sdkMock.saved['best.tst'] === 555, 'рекорд в облаке');
  const e2 = engineEnv({ platform: 'yandex', mock: { cloud: { 'best.tst': 777 } }, store: { 'arcade.best.tst': '100' } }); await e2.win.Platform.init(); await sleep(0);
  eq(e2.g.state.best, 777, 'облачный рекорд больше локального');
  const e3 = engineEnv({ platform: 'yandex' }); e3.g.adBreaks = false; e3.g.useStandardScreens({}); await e3.win.Platform.init(); e3.g.gameover(); await sleep(40); ok(!e3.log.includes('fullscreen'), 'adBreaks:false');
});
test('движок + пауза площадки: цикл стоит (update не вызывается), звук выключен; после — продолжает и звук включается', async () => {
  const e = engineEnv({ platform: 'yandex' }), g = e.g; let n = 0; g.scene('play', { realtime: true, update() { n++; }, draw() {} });
  await e.win.Platform.init(); g.audio.unlocked = true; g.audio._ctx(); g.start('play');
  e.frame(16); e.frame(32); const n0 = n; ok(n0 >= 1, 'цикл идёт');
  e.win.Platform.sdk._fire('game_api_pause'); e.frame(48); e.frame(64); eq(n, n0, 'на паузе update не идёт'); ok(e.ac.calls.includes('suspend'), 'звук выключен');
  e.win.Platform.sdk._fire('game_api_resume'); e.frame(80); ok(n > n0, 'продолжили'); ok(e.ac.calls.includes('resume'), 'звук включён');
});

for (const [name, fn] of queue) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)); } }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
