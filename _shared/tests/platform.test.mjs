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
  ['submit', 'top', 'me', 'open'].forEach(k => ok(typeof P.leaderboard[k] === 'function', 'leaderboard.' + k));
  ok(typeof P.flags.get === 'function' && typeof P.serverTime === 'function' && typeof P.review.request === 'function' && typeof P.shortcut.add === 'function', 'v1.2: flags/serverTime/review/shortcut');
  ok(typeof P.payments.purchase === 'function' && typeof P.games.list === 'function' && typeof P.sticky.show === 'function' && P.version === '1.3.0', 'v1.2: payments/games/sticky, версия');
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
function engineEnv({ platform = null, search = '', mock = {}, metas = {}, store = {}, opts = {} } = {}) {
  const links = [el('a', { href: '../', 'data-catalog-back': '1', 'data-en': '← Catalog' }), el('a', { href: 'https://example.org/' }), el('a', { href: '#top' })];
  const w = makeWin({ search, mock, metas, links, store, noPlatform: !platform }); const win = w.win;
  let raf = null; const ac = { state: 'running', calls: [], suspend() { this.calls.push('suspend'); }, resume() { this.calls.push('resume'); }, createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: {}, type: '' }; }, createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }, destination: {} };
  const ls = {}; win.__fire = (ev) => (ls[ev] || []).forEach(f => f({ type: ev }));
  Object.assign(win, { addEventListener(ev, f) { (ls[ev] = ls[ev] || []).push(f); }, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, requestAnimationFrame(f) { raf = f; return 1; }, cancelAnimationFrame() {}, performance: { now: () => 0 }, AudioContext: function () { return ac; } });
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true, save() {}, restore() {}, fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {} }) };
  win.document.querySelector = ((q0) => (q) => q === '#c' ? canvas : q0(q))(win.document.querySelector.bind(win.document));
  if (platform) win.Platform = w.mk({ platform, config: { saveDelay: 10 } });
  vm.runInContext(ENGINE, win, { filename: 'engine.js' });
  const g = win.Arcade.createGame(Object.assign({ canvas: '#c', width: 100, height: 100, gameId: 'tst', strings: { ru: { play: 'Играть' }, en: { play: 'Play' } } }, opts));
  return { w, win, g, links, ac, frame: (t) => raf && raf(t), log: w.log };
}
test('движок без platform.js: как раньше (g.platform = null, ссылки на месте, версия 2.9.0, реклама за награду недоступна)', () => {
  const e = engineEnv(); ok(e.g.platform === null); ok(!e.links.some(a => a.style.display === 'none')); eq(e.win.Arcade.version, '2.9.0');
  ok(!e.g.canRewarded() && !e.g.adReady(), 'без площадки рекламы нет');
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
test('движок + Яндекс: start() → ready; сцена play → gameplayStart, pause/gameover → stop; рекорд — в облако; полноэкранная — по нажатию на экране gameover (действие игрока), не при входе', async () => {
  const e = engineEnv({ platform: 'yandex' }), g = e.g; g.useStandardScreens({ title: 'Т' }); g.scene('play', { update() {}, draw() {} });
  await e.win.Platform.init(); g.start('title'); g.goto('play'); g.goto('pause'); g.goto('play', { resume: true });
  eq(e.log.filter(x => ['ready', 'start', 'stop'].includes(x)), ['ready', 'start', 'stop', 'start']);
  g.state.score = 555; g.gameover(); await sleep(60);
  ok(!e.log.includes('fullscreen'), 'при входе в gameover рекламы нет'); g.current.press.call(g, 'action'); await sleep(60);
  ok(e.log.includes('fullscreen'), 'реклама после нажатия на gameover'); eq(g._sceneName, 'title'); eq(e.w.store['arcade.best.tst'], '555'); eq(e.w.store['arcade.pf.best.tst'], '555');
  ok(e.log.includes('setData') && e.win.__sdkMock.saved['best.tst'] === 555, 'рекорд в облаке');
  const e2 = engineEnv({ platform: 'yandex', mock: { cloud: { 'best.tst': 777 } }, store: { 'arcade.best.tst': '100' } }); await e2.win.Platform.init(); await sleep(0);
  eq(e2.g.state.best, 777, 'облачный рекорд больше локального');
  const e3 = engineEnv({ platform: 'yandex' }); e3.g.adBreaks = false; e3.g.useStandardScreens({}); await e3.win.Platform.init(); e3.g.gameover(); e3.g.current.press.call(e3.g, 'action'); await sleep(40); ok(!e3.log.includes('fullscreen'), 'adBreaks:false');
});
test('движок + пауза площадки: цикл стоит (update не вызывается), звук выключен; после — продолжает и звук включается', async () => {
  const e = engineEnv({ platform: 'yandex' }), g = e.g; let n = 0; g.scene('play', { realtime: true, update() { n++; }, draw() {} });
  await e.win.Platform.init(); g.audio.unlocked = true; g.audio._ctx(); g.start('play');
  e.frame(16); e.frame(32); const n0 = n; ok(n0 >= 1, 'цикл идёт');
  e.win.Platform.sdk._fire('game_api_pause'); e.frame(48); e.frame(64); eq(n, n0, 'на паузе update не идёт'); ok(e.ac.calls.includes('suspend'), 'звук выключен');
  e.win.Platform.sdk._fire('game_api_resume'); e.frame(80); ok(n > n0, 'продолжили'); ok(e.ac.calls.includes('resume'), 'звук включён');
});

// ---------- v2.6: реклама за награду в движке ----------
function playEnv(o = {}) { const e = engineEnv(Object.assign({ platform: 'yandex' }, o)), g = e.g; g.useStandardScreens({ lives: 3 }); let n = 0; g.scene('play', { realtime: true, update() { n++; }, draw() {} }); e.n = () => n; return e; }
test('v2.6: старт с площадкой — меню после init SDK (язык площадки уже применён), ready() после init; до init — экран загрузки', async () => {
  const e = engineEnv({ platform: 'yandex', mock: { lang: 'en' } }), g = e.g; g.useStandardScreens({}); g.scene('play', { draw() {} });
  g.start('title'); eq(g._sceneName, 'loading'); ok(!e.log.includes('ready'), 'ready до init');
  await e.win.Platform.init(); await sleep(5); eq(g._sceneName, 'title'); eq(g.i18n.lang, 'en', 'язык до меню'); ok(e.log.includes('ready'));
  ok(e.log.indexOf('ready') > e.log.indexOf('init'));
});
test('v2.6: g.rewarded — награда только при досмотре и ровно один раз; повторный вызов во время показа — false; цикл стоит и звук спит во время показа', async () => {
  for (const [mode, want] of [['ok', 1], ['skip', 0], ['error', 0]]) {
    const e = playEnv({ mock: { rewarded: mode, adMs: 40 } }), g = e.g; await e.win.Platform.init(); g.audio.unlocked = true; g.audio._ctx(); g.start('play'); await sleep(5);
    e.frame(16); e.frame(32); const n0 = e.n(); let got = 0;
    const p = g.rewarded({ reward() { got++; } }); await sleep(10);
    ok(g._adPause, mode + ': пауза во время показа'); e.frame(48); e.frame(64); eq(e.n(), n0, mode + ': update не идёт'); ok(e.ac.calls.includes('suspend'), mode + ': звук выключен');
    eq(await g.rewarded({ reward() { got += 10; } }), false, mode + ': второй показ поверх первого');
    const r = await p; eq(got, want, mode + ': награда'); eq(r, !!want, mode); ok(!g._adPause, 'пауза снята');
    e.frame(80); ok(e.n() > n0, mode + ': цикл продолжил');
  }
});
test('v2.6: «продолжить за рекламу» — один раз за партию; досмотр → revive и play; отказ ролика → gameover; на web экрана нет', async () => {
  const e = playEnv({ mock: { adMs: 10 } }), g = e.g; let rev = 0; g.useRewardedContinue({ revive() { rev++; } });
  await e.win.Platform.init(); g.start('title'); await sleep(5); g.scenes.title._menu.items[0].onSelect.call(g); eq(g._sceneName, 'play');
  g.gameover(); eq(g._sceneName, 'continue'); g._selectMenu(); await sleep(60); eq(rev, 1); eq(g._sceneName, 'play');
  g.gameover(); eq(g._sceneName, 'gameover', 'второй раз за партию — сразу gameover'); g.current.press.call(g, 'action');
  g.scenes.title._menu.items[0].onSelect.call(g); g.gameover(); eq(g._sceneName, 'continue', 'новая партия — снова можно');
  g.current._menu.sel = 1; g._selectMenu(); eq(g._sceneName, 'gameover', '«Нет» → gameover');
  const e2 = playEnv({ mock: { rewarded: 'skip', adMs: 10 } }); let r2 = 0; e2.g.useRewardedContinue({ revive() { r2++; } }); await e2.win.Platform.init(); e2.g.start('play'); await sleep(5);
  e2.g.gameover(); e2.g._selectMenu(); await sleep(40); eq(r2, 0, 'пропуск — без награды'); e2.g.scenes['continue'].update.call(e2.g, 2); eq(e2.g._sceneName, 'gameover');
  const e3 = playEnv({ platform: 'web' }); e3.g.useRewardedContinue({ revive() {} }); await e3.win.Platform.init(); e3.g.start('play'); await sleep(5); e3.g.gameover(); eq(e3.g._sceneName, 'gameover', 'web — без экрана рекламы');
});
test('v2.6: бонус за рекламу в меню паузы — виден только с рекламой и до получения; на web пункта нет', async () => {
  const e = playEnv({ mock: { adMs: 10 } }), g = e.g; let gr = 0; g.useRewardedBonus({ key: 'rwLife', label: { ru: 'Реклама: +1 жизнь', en: 'Ad: +1 life' }, grant() { gr++; } });
  await e.win.Platform.init(); g.start('play'); await sleep(5); g.pause(); ok(g.menu.items('pause').includes('rwLife'), JSON.stringify(g.menu.items('pause')));
  eq(g.menu.items('pause').indexOf('rwLife'), g.menu.items('pause').indexOf('menu') - 1, 'перед «В меню»');
  g.current._menu.sel = g.menu.items('pause').indexOf('rwLife'); g._selectMenu(); await sleep(40); eq(gr, 1); ok(!g.menu.items('pause').includes('rwLife'), 'после получения пункт убран');
  const e2 = playEnv({ platform: 'web' }); e2.g.useRewardedBonus({ key: 'rwLife', grant() {} }); await e2.win.Platform.init(); e2.g.start('play'); await sleep(5); e2.g.pause(); ok(!e2.g.menu.items('pause').includes('rwLife'), 'web — пункта нет');
});
test('v2.6: g.adBreak — частота по адаптеру (Яндекс 60 с, GamePush 180 с); на время показа цикл стоит; g.persist — ключ в облако (max)', async () => {
  let t = 5e6; const e = playEnv({ mock: { adMs: 20 } }); e.win.Platform = null; // not used
  const w = makeWin(), P = w.mk({ platform: 'yandex', now: () => t }); await P.init(); ok(P.interstitialReady()); await P.showInterstitial(); ok(!P.interstitialReady()); t += 61000; ok(P.interstitialReady());
  const w2 = makeWin({ metas: GP_META }), P2 = w2.mk({ platform: 'gamepush', now: () => t }); await P2.init(); eq(P2.config.interstitialGap, 180); await P2.showInterstitial(); t += 120000; ok(!P2.interstitialReady(), 'GP: 2 мин — рано'); t += 61000; ok(P2.interstitialReady());
  const e2 = playEnv({ mock: { adMs: 30, cloud: { 'ls.arcade.x.wave': '7' } }, store: { 'arcade.x.wave': '4' } }), g = e2.g; await e2.win.Platform.init(); await sleep(5);
  g.persist('arcade.x.wave', 'max'); eq(e2.w.store['arcade.x.wave'], '7', 'облако больше — взяли облачное'); g.storeSet('arcade.x.wave', 9); eq(e2.w.store['arcade.pf.ls.arcade.x.wave'], '"9"');
  g.start('play'); await sleep(5); const p = g.adBreak(); await sleep(5); ok(g._adPause, 'пауза на время рекламы'); eq(await p, true); ok(!g._adPause);
  eq(await g.adBreak(), false, 'вторая подряд — нет');
});

// ---------- v1.2: лидерборды, флаги, серверное время, оценка, ярлык, покупки, свои игры, стики ----------
test('v1.2 web: заглушки — лидерборд недоступен, флаги = значения игры, времени площадки нет, оценки/ярлыка/покупок/игр нет; сеть не трогается', async () => {
  const w = makeWin(), P = w.mk(); await P.init(); eq(w.loads, []);
  ok(!P.leaderboard.available); eq(await P.leaderboard.submit(100), false); eq(await P.leaderboard.top(), { entries: [], me: null }); eq(await P.leaderboard.me(), null); eq(P.leaderboard.open(), false);
  eq(await P.flags.get({ difficulty: 'normal', gap: 90 }), { difficulty: 'normal', gap: '90' }, 'флаги — строки'); eq(P.flags.peek('difficulty'), 'normal');
  eq(P.serverTime(), null); ok(Math.abs(P.now() - Date.now()) < 1000, 'now — часы устройства');
  eq(await P.review.request(), false); eq(await P.shortcut.add(), false);
  ok(!P.payments.available); await P.payments.setup({ no_ads: {} }); eq(await P.payments.purchase('no_ads'), false); eq(await P.payments.catalog(), []); ok(!P.payments.owned('no_ads'));
  eq(await P.games.list(), { games: [], developerURL: null }); eq(P.games.open({ url: 'https://yandex.ru/games/app/1' }), false); eq(await P.sticky.show(), false);
});
test('v1.2 Яндекс: лидерборд — setScore только вошедшему, частые вызовы склеиваются (≤ 1 раза в с, уходит наибольший); top/me; нет записи — null', async () => {
  const w = makeWin({ mock: { lb: { score: [{ id: 'a', name: 'Ая', score: 900 }, { id: 'b', name: 'Бо', score: 50 }] } } }), P = w.mk({ platform: 'yandex' });
  ok(!P.leaderboard.available, 'до init — недоступен'); await P.init(); ok(P.leaderboard.available);
  eq(await P.leaderboard.me(), null, 'записи игрока нет → null');
  const r = await Promise.all([P.leaderboard.submit(100), P.leaderboard.submit(300.4), P.leaderboard.submit(200)]); eq(r, [true, true, true]);
  eq(w.log.filter(x => x.startsWith('setScore')), ['setScore:score:300'], 'один вызов с наибольшим (округлённым) счётом');
  const t0 = Date.now(); await P.leaderboard.submit(400); ok(Date.now() - t0 >= 900, 'второй вызов — не раньше чем через ~1 с'); eq(w.log.filter(x => x.startsWith('setScore')).length, 2);
  const top = await P.leaderboard.top({ limit: 5 }); eq(top.entries.map(e => [e.rank, e.score, e.name, e.me]), [[1, 900, 'Ая', false], [2, 400, 'Я', true], [3, 50, 'Бо', false]]); eq(top.me, { rank: 2, score: 400 });
  eq(await P.leaderboard.me(), { rank: 2, score: 400, name: 'Я' });
  const w2 = makeWin({ mock: { auth: false } }), P2 = w2.mk({ platform: 'yandex' }); await P2.init(); eq(await P2.leaderboard.submit(5), false, 'не вошёл — false'); ok(!w2.log.some(x => x.startsWith('setScore')), 'setScore не вызывался');
  eq((await P2.leaderboard.top()).entries.length, 0, 'чтение без входа работает');
  eq(await P.leaderboard.top({ board: 'nope' }), { entries: [], me: null }, 'нет таблицы (404) — пусто, без исключения'); ok(P.errors.length, 'ошибка записана');
});
test('v1.2 GamePush: лидерборд — поле игрока score + sync (меньший счёт не отправляется); fetch/fetchPlayerRating; open — окно площадки', async () => {
  const w = makeWin({ metas: GP_META }), P = w.mk({ platform: 'gamepush' }); await P.init(); ok(P.leaderboard.available);
  eq(await P.leaderboard.submit(700), true); ok(w.log.includes('set:score:700') && w.log.includes('sync'));
  w.log.length = 0; await P.leaderboard.submit(600); ok(!w.log.some(x => x.startsWith('set:score')), 'меньший — не отправляем');
  const top = await P.leaderboard.top({ limit: 10 }); eq(top.entries.map(e => [e.rank, e.score, e.me]), [[1, 900, false], [2, 700, true], [3, 500, false]]); eq(top.me, { rank: 2, score: 700 });
  eq(await P.leaderboard.me(), { rank: 2, score: 700, name: 'Я' }); ok(P.leaderboard.open() && w.log.includes('lbOpen'));
});
test('v1.2 флаги: Яндекс getFlags({ defaultFlags }) — удалённое важнее; GamePush variables по ключам игры; peek/all', async () => {
  const w = makeWin({ mock: { flags: { difficulty: 'hard', ad_breaks: '0' } } }), P = w.mk({ platform: 'yandex' });
  eq(P.flags.peek('difficulty', 'x'), 'x', 'до get — значение по умолчанию вызова');
  eq(await P.flags.get({ difficulty: 'normal', lives: 3 }), { difficulty: 'hard', lives: '3', ad_breaks: '0' }); ok(w.log.includes('getFlags'));
  eq(P.flags.peek('difficulty'), 'hard'); eq(P.flags.all().lives, '3');
  const w2 = makeWin({ metas: GP_META, mock: { vars: { difficulty: 'easy', unknown: 'x' } } }), P2 = w2.mk({ platform: 'gamepush' });
  eq(await P2.flags.get({ difficulty: 'normal', lives: '3' }), { difficulty: 'easy', lives: '3' }); ok(w2.log.includes('varsFetch'));
});
test('v1.2 серверное время: Яндекс serverTime() → мс; GamePush serverTime ISO → мс; до init — null', async () => {
  const P = makeWin({ mock: { serverTime: 1767312000000 } }).mk({ platform: 'yandex' }); eq(P.serverTime(), null); await P.init(); eq(P.serverTime(), 1767312000000); eq(P.now(), 1767312000000);
  const P2 = makeWin({ metas: GP_META, mock: { serverTime: '2026-03-01T10:00:00.000Z' } }).mk({ platform: 'gamepush' }); await P2.init(); eq(P2.serverTime(), Date.parse('2026-03-01T10:00:00.000Z'));
});
test('v1.2 оценка и ярлык: Яндекс canReview → requestReview (раз за сессию, игра на паузе на время окна); shortcut canShowPrompt → showPrompt; GamePush app.*', async () => {
  const w = makeWin({ mock: { adMs: 20 } }), P = w.mk({ platform: 'yandex' }); await P.init(); const ev = []; P.pauseHook(r => ev.push('p:' + r), r => ev.push('r:' + r));
  eq(await P.review.canRequest(), true); const pr = P.review.request(); await sleep(5); ok(P.paused, 'пауза на время окна оценки'); eq(await pr, true); eq(ev, ['p:dialog', 'r:dialog']);
  eq(await P.review.request(), false, 'второй раз за сессию — нет'); eq(w.log.filter(x => x === 'requestReview').length, 1);
  eq(await P.shortcut.add(), true); ok(w.log.includes('showPrompt'));
  const P3 = makeWin({ mock: { canReview: false, shortcut: false } }).mk({ platform: 'yandex' }); await P3.init(); eq(await P3.review.request(), false, 'GAME_RATED'); eq(await P3.shortcut.add(), false, 'canShow:false');
  const w2 = makeWin({ metas: GP_META }), P2 = w2.mk({ platform: 'gamepush' }); await P2.init(); eq(await P2.review.request(), true); eq(await P2.shortcut.add(), true); ok(w2.log.includes('requestReview') && w2.log.includes('addShortcut'));
});
test('v1.2 покупки Яндекс: при старте getPurchases — расходуемые: обработчик → consumePurchase, постоянные (no_ads) → owned без consume; каталог с ценой из SDK; покупка/отмена; пауза на время окна', async () => {
  const w = makeWin({ mock: { adMs: 15, purchases: [{ productID: 'no_ads', purchaseToken: 'p1' }, { productID: 'coins100', purchaseToken: 'p2' }] } }), P = w.mk({ platform: 'yandex' });
  const got = []; P.payments.onPurchase(id => { got.push(id); });
  await P.init(); ok(P.payments.available); ok(!w.log.includes('getPurchases'), 'без setup покупки не трогаем');
  await P.payments.setup({ no_ads: {}, coins100: { consumable: true } }); ok(w.log.includes('getPurchases'), 'проверка необработанных (1.13.1)');
  eq(got, ['no_ads', 'coins100']); ok(P.payments.owned('no_ads')); ok(w.log.includes('consume:p2') && !w.log.includes('consume:p1'), w.log.join(','));
  const cat = await P.payments.catalog(); eq(cat.map(c => [c.id, c.price, c.currency]), [['no_ads', '49 YAN', 'YAN'], ['coins100', '10 YAN', 'YAN']]); eq(cat[0].currencyImage, '/yan-small.png');
  const ev = []; P.pauseHook(r => ev.push('p:' + r), r => ev.push('r:' + r));
  got.length = 0; const b = P.payments.purchase('coins100'); await sleep(5); ok(P.paused, 'пауза на время окна покупки'); eq(await b, true); eq(got, ['coins100']); ok(w.log.some(x => /^consume:t\d/.test(x)), 'расходуемая — consume после начисления'); eq(ev, ['p:dialog', 'r:dialog']);
  eq(await P.payments.purchase('no_ads'), true, 'уже куплено — true без окна'); eq(w.log.filter(x => x === 'purchase:no_ads').length, 0);
  w.win.__sdkMock.buy = 'cancel'; got.length = 0; eq(await P.payments.purchase('coins100'), false, 'отмена'); eq(got, []);
  const P2 = makeWin({ mock: { noPayments: true } }).mk({ platform: 'yandex' }); await P2.init(); ok(!P2.payments.available); eq(await P2.payments.purchase('no_ads'), false);
});
test('v1.2 покупки GamePush: purchases при старте → consume расходуемых; purchase({ tag }) → owned; каталог', async () => {
  const w = makeWin({ metas: GP_META, mock: { adMs: 10, purchases: [{ productId: 502 }] } }), P = w.mk({ platform: 'gamepush' }); const got = []; P.payments.onPurchase(id => got.push(id));
  await P.payments.setup({ no_ads: {}, coins100: { consumable: true } }); eq(got, ['coins100']); ok(w.log.includes('consume:coins100'));
  eq((await P.payments.catalog()).map(c => [c.id, c.price]), [['no_ads', '49 ян'], ['coins100', '10 ян']]);
  ok(!P.payments.owned('no_ads')); eq(await P.payments.purchase('no_ads'), true); ok(P.payments.owned('no_ads') && w.log.includes('purchase:no_ads') && !w.log.includes('consume:no_ads'));
});
test('v1.2 свои игры (8.4.1) и стики-баннер: Яндекс GamesAPI.getAllGames, открытие — только адреса Яндекс Игр; GamePush коллекции; sticky show/hide; setInterstitialGap — не ниже минимума', async () => {
  const w = makeWin(), opened = []; w.win.open = (u, t) => { opened.push([u, t]); return {}; }; const P = w.mk({ platform: 'yandex' }); await P.init(); ok(P.games.available);
  const l = await P.games.list(); eq(l.games[0], { id: '100001', title: 'Отбойник', url: 'https://yandex.ru/games/app/100001', icon: 'https://avatars/i', cover: 'https://avatars/c' }); eq(l.developerURL, 'https://yandex.ru/games/developer/1');
  ok(P.games.open(l.games[0])); eq(opened, [['https://yandex.ru/games/app/100001', '_blank']]); eq(P.games.open({ url: 'https://example.org/x' }), false, 'чужой адрес — нет');
  eq(await P.sticky.show(), true); ok(P.sticky.showing && w.log.includes('stickyShow')); eq(await P.sticky.hide(), true); ok(!P.sticky.showing && w.log.includes('stickyHide'));
  eq(P.setInterstitialGap(120), 120); eq(P.setInterstitialGap(5), 30, 'Яндекс — не чаще 30 с'); eq(P.setInterstitialGap('x'), 30, 'мусор — без изменений');
  const w2 = makeWin({ metas: GP_META }), P2 = w2.mk({ platform: 'gamepush' }); await P2.init(); eq((await P2.games.list()).games[0].title, 'Отбойник'); ok(P2.games.open() && w2.log.includes('gcOpen'));
  await P2.sticky.show(); ok(w2.log.includes('stickyShow')); eq(P2.setInterstitialGap(60), 180, 'GamePush — не чаще 3 мин');
});
test('v2.7 движок + площадка: потеря фокуса (blur, pagehide) → звук спит и пауза в игре; focus → звук возвращается; без площадки blur не трогает звук', async () => {
  const e = engineEnv({ platform: 'yandex' }), g = e.g; g.useStandardScreens({}); g.scene('play', { update() {}, draw() {} });
  await e.win.Platform.init(); g.audio.unlocked = true; g.audio._ctx(); g.start('play'); await sleep(5); eq(g._sceneName, 'play');
  e.ac.calls.length = 0; e.win.__fire('blur'); eq(g._sceneName, 'pause', 'blur → пауза'); ok(e.ac.calls.includes('suspend'), 'blur → звук спит'); ok(g.audio._away());
  e.ac.calls.length = 0; g.audio.unlock && g.audio.unlock(); e.win.__fire('focus'); ok(e.ac.calls.includes('resume'), 'focus → звук'); ok(!g.audio._away()); eq(g._sceneName, 'pause', 'игра ждёт «Продолжить»');
  g.goto('play', { resume: true }); e.ac.calls.length = 0; e.win.__fire('pagehide'); eq(g._sceneName, 'pause'); ok(e.ac.calls.includes('suspend'), 'pagehide → тишина'); e.win.__fire('pageshow'); ok(!g.audio._blur);
  g.goto('title'); e.win.__fire('blur'); eq(g._sceneName, 'title', 'вне игры сцена не меняется'); e.win.__fire('focus');
  const n = engineEnv(), g2 = n.g; g2.useStandardScreens({}); g2.scene('play', { update() {}, draw() {} }); g2.audio.unlocked = true; g2.audio._ctx(); g2.start('play'); n.ac.calls.length = 0;
  n.win.__fire('blur'); eq(g2._sceneName, 'play', 'без площадки — как раньше'); ok(!n.ac.calls.includes('suspend'));
});
test('v2.7 движок: g.flags — значения игры + удалённые (Яндекс getFlags); ad_breaks=0 выключает межстраничную, ad_interstitial_gap → интервал адаптера, rewarded_continue=0 — без «ещё шанса»', async () => {
  const e = engineEnv({ platform: 'yandex', mock: { flags: { difficulty: 'hard', ad_breaks: '0', ad_interstitial_gap: '150', rewarded_continue: '0' } }, opts: { flags: { difficulty: 'normal', speed: 1.5 } } }), g = e.g;
  eq(g.flags.get('difficulty'), 'normal', 'до ответа — значение игры'); eq(g.flags.num('speed'), 1.5);
  g.useStandardScreens({}); g.useRewardedContinue({ revive() {} }); g.scene('play', { draw() {} }); await e.win.Platform.init(); const f = await g.flags.ready;
  eq(f.difficulty, 'hard'); eq(g.flags.get('difficulty'), 'hard'); eq(e.win.Platform.config.interstitialGap, 150); ok(!g.adReady(), 'ad_breaks=0'); ok(g.canRewarded(), 'ролики за награду не трогаем');
  g.start('play'); await sleep(5); g.gameover(); eq(g._sceneName, 'gameover', 'rewarded_continue=0');
  const n = engineEnv({ opts: { flags: { difficulty: 'easy' } } }); eq(await n.g.flags.ready, Object.assign({}, n.g.flags.defaults)); eq(n.g.flags.get('difficulty'), 'easy', 'без площадки — значение игры');
});
test('v2.7 движок: «Без рекламы» — необработанная покупка при старте → межстраничной и стики нет, rewarded остаётся; покупка из меню (цена из SDK) → пункт исчезает, стики скрыт', async () => {
  const e = engineEnv({ platform: 'yandex', mock: { adMs: 10, purchases: [{ productID: 'no_ads', purchaseToken: 'p1' }] } }), g = e.g; g.useStandardScreens({}); g.useNoAds(); g.scene('play', { draw() {} });
  await e.win.Platform.init(); await g.flags.ready; await sleep(20);
  ok(g.noAds() && g.owned('no_ads'), 'куплено ранее'); ok(!g.adReady(), 'межстраничной нет'); ok(g.canRewarded(), 'rewarded — по желанию игрока'); ok(!e.log.includes('stickyShow') && e.log.includes('stickyHide'), 'стики не показывали и скрыли (на случай показа площадкой)');
  ok(!g.menu.items('title').includes('noads'), 'пункт покупки скрыт');
  const e2 = engineEnv({ platform: 'yandex', mock: { adMs: 10 }, opts: { sticky: true } }), g2 = e2.g; g2.useStandardScreens({}); g2.useNoAds(); g2.scene('play', { draw() {} });
  await e2.win.Platform.init(); await g2.flags.ready; await sleep(20); g2.goto('title'); await sleep(10); g2.goto('title');
  ok(e2.log.includes('stickyShow'), 'стики показан'); ok(g2.adReady(), 'межстраничная есть'); const items = g2.menu.items('title'); ok(items.includes('noads'), JSON.stringify(items));
  const it = g2.scenes.title._menu.items.find(x => x.key === 'noads'); ok(/Без рекламы · 49 YAN/.test(it.label()), it.label());
  it.onSelect.call(g2); await sleep(40); ok(g2.noAds(), 'куплено'); ok(e2.log.includes('stickyHide'), 'стики скрыт'); ok(!g2.adReady()); eq(await g2.adBreak(), false); g2.goto('title'); ok(!g2.menu.items('title').includes('noads'), 'пункт убран');
  const e3 = engineEnv({ platform: 'yandex', mock: { adMs: 10 } }); e3.g.useStandardScreens({}); await e3.win.Platform.init(); await e3.g.flags.ready; await sleep(20); ok(!e3.log.includes('stickyShow'), 'без opts.sticky игра стики не показывает');
  const n = engineEnv(); eq(await n.g.purchase('no_ads'), false, 'без площадки — false'); ok(!n.g.noAds());
});
test('v2.7 движок: расходуемый товар (useProducts + grant) при старте; g.leaderboard автоотправка рекорда; g.daily по серверному времени; g.requestReview/addShortcut/ownGames', async () => {
  let coins = 0; const e = engineEnv({ platform: 'yandex', mock: { purchases: [{ productID: 'coins100', purchaseToken: 'c1' }], serverTime: Date.UTC(2026, 0, 10, 12) }, opts: { leaderboard: 'score', products: { coins100: { consumable: true, grant() { coins += 100; } } } } }), g = e.g;
  g.useStandardScreens({}); await e.win.Platform.init(); await g.flags.ready; await sleep(10); eq(coins, 100); ok(e.log.includes('consume:c1'));
  ok(g.leaderboard.available()); g.state.score = 321; g.saveBest(); await sleep(1300); ok(e.log.includes('setScore:score:321'), e.log.join(','));
  const top = await g.leaderboard.top(); eq(top.me && top.me.score, 321);
  const d = g.daily('gift'); ok(d.ready && d.trusted); ok(d.claim()); ok(!d.claim(), 'второй раз в тот же день'); ok(!g.daily('gift').ready);
  eq(e.w.store['arcade.daily.tst.gift'], String(Math.floor((Date.UTC(2026, 0, 10, 12) + 3 * 3600000) / 86400000)));
  e.win.__sdkMock.serverTime = Date.UTC(2026, 0, 11, 22); ok(g.daily('gift').ready, 'новый день (UTC+3)');
  eq(await g.requestReview(), true); eq(await g.addShortcut(), true); eq((await g.ownGames()).games.length, 1);
  const n = engineEnv(); ok(!n.g.leaderboard.available()); eq(await n.g.leaderboard.submit(5), false); eq(await n.g.requestReview(), false); ok(!n.g.daily('x').trusted && n.g.daily('x').ready);
});

// ---------- v2.8 (движок) / 1.3 (адаптер) ----------
const ML = { ru: { play: 'Играть' }, en: { play: 'Play' }, tr: { play: 'Oyna' }, es: { play: 'Jugar' }, pt: { play: 'Jogar' } };
test('v2.8 язык площадки — любой язык таблиц игры (tr/es/pt), иначе en (ru/be/uk/kk/uz → ru); ?lang= важнее; меню — уже на языке', async () => {
  for (const [lang, want] of [['tr', 'tr'], ['es', 'es'], ['pt', 'pt'], ['de', 'en'], ['uk', 'ru']]) {
    const e = engineEnv({ platform: 'yandex', mock: { lang }, opts: { strings: JSON.parse(JSON.stringify(ML)) } }); e.g.useStandardScreens({}); e.g.start('title');
    await e.win.Platform.init(); await sleep(5); eq(e.g.i18n.lang, want, lang); eq(e.g._sceneName, 'title');
  }
  const r = engineEnv({ platform: 'yandex', mock: { lang: 'tr' } }); await r.win.Platform.init(); await sleep(0); eq(r.g.i18n.lang, 'en', 'игра RU/EN: tr → en');
  const u = engineEnv({ platform: 'gamepush', metas: GP_META, mock: { lang: 'pt' }, search: '?lang=es', opts: { strings: JSON.parse(JSON.stringify(ML)) } }); await u.win.Platform.init(); await sleep(0); eq(u.g.i18n.lang, 'es', '?lang важнее');
});
test('v2.8 лидеры: именованные таблицы submit(score, { board }) / submit(score, "имя"), top/me по таблице; Яндекс — своя сцена «Лидеры» (пункт меню после init, переключение таблиц ← →, назад); GamePush — окно площадки', async () => {
  const lb = { kaskad: [{ id: 'a', name: 'Ая', score: 900 }], kaskadDaily: [{ id: 'b', name: 'Бо', score: 50 }] };
  const e = engineEnv({ platform: 'yandex', mock: { lb } }), g = e.g; g.useStandardScreens({}); g.useLeaderboard({ boards: ['kaskad', { id: 'kaskadDaily', label: { ru: 'Испытание', en: 'Daily' } }] }); g.scene('play', { draw() {} });
  g.start('title'); ok(!g.menu.items('title').includes('lb'), 'до init пункта нет'); await e.win.Platform.init(); await sleep(5); g.goto('title');
  eq(g.menu.items('title').slice(0, 2), ['play', 'lb']);
  eq(await g.leaderboard.submit(500, { board: 'kaskad' }), true); await sleep(1150); eq(await g.leaderboard.submit(70, 'kaskadDaily'), true);
  ok(e.log.includes('setScore:kaskad:500') && e.log.includes('setScore:kaskadDaily:70'), e.log.join(','));
  eq((await g.leaderboard.top({ board: 'kaskad' })).entries.map(x => x.score), [900, 500]); eq((await g.leaderboard.me('kaskadDaily')).score, 70);
  ok(!g.leaderboard.native(), 'у Яндекса окна нет'); const it = g.scenes.title._menu.items.find(x => x.key === 'lb'); it.onSelect.call(g); eq(g._sceneName, 'leaders');
  await sleep(10); ok(e.log.includes('getEntries:kaskad'), 'загружена таблица kaskad'); g.scenes.leaders.draw.call(g);
  g.current.press.call(g, 'right'); await sleep(10); ok(e.log.includes('getEntries:kaskadDaily'), 'вторая таблица');
  const n = e.log.filter(x => x === 'getEntries:kaskad').length; g.current.press.call(g, 'left'); await sleep(5); eq(e.log.filter(x => x === 'getEntries:kaskad').length, n, 'кеш 60 с');
  eq(g.menu.items('leaders'), ['b_kaskad', 'b_kaskadDaily', 'back']); g.current._menu.sel = 2; g._selectMenu(); eq(g._sceneName, 'title', '«Назад»');
  g.goto('leaders', { board: 'kaskadDaily', back: 'title' }); g.current.press.call(g, 'pause'); eq(g._sceneName, 'title', 'P/Esc — назад');
  const p = engineEnv({ platform: 'gamepush', metas: GP_META }), pg = p.g; pg.useStandardScreens({}); pg.useLeaderboard({ boards: ['kladka'] }); await p.win.Platform.init(); await sleep(5); pg.goto('title');
  ok(pg.leaderboard.native()); ok(pg.leaderboard.open({ board: 'kladka' }) && p.log.includes('lbOpen'), 'GamePush — окно площадки'); eq(pg._sceneName, 'title');
  await pg.leaderboard.submit(321, { board: 'kladka' }); ok(p.log.includes('set') && p.log.includes('sync'), p.log.join(','));
  const w = engineEnv({ platform: 'web' }); w.g.useStandardScreens({}); w.g.useLeaderboard({}); await w.win.Platform.init(); await sleep(5); w.g.goto('title'); ok(!w.g.menu.items('title').includes('lb'), 'web — пункта нет'); ok(!w.g.leaderboard.open());
  const n0 = engineEnv(); n0.g.useStandardScreens({}); n0.g.useLeaderboard({}); n0.g.goto('title'); ok(!n0.g.menu.items('title').includes('lb'), 'без площадки — нет');
});
test('v2.8 «Без рекламы» в меню и паузе: цена из каталога в обоих; покупка из паузы → пункты исчезают, межстраничной нет; восстановление при запуске', async () => {
  const e = engineEnv({ platform: 'yandex', mock: { adMs: 10 }, opts: { strings: JSON.parse(JSON.stringify(ML)) }, search: '?lang=tr' }), g = e.g; g.useStandardScreens({}); g.useNoAds({ scene: ['title', 'pause'] }); g.scene('play', { draw() {} });
  await e.win.Platform.init(); await g.flags.ready; await sleep(20); g.goto('play'); g.pause(); await sleep(10); g.goto('pause');
  ok(g.menu.items('pause').includes('noads') && g.menu.items('title').includes('noads'), JSON.stringify([g.menu.items('title'), g.menu.items('pause')]));
  eq(g.menu.items('pause').indexOf('noads'), g.menu.items('pause').indexOf('menu') - 1, 'в паузе — перед «В меню»');
  const it = g.scenes.pause._menu.items.find(x => x.key === 'noads'); eq(it.label(), 'Reklamsız · 49 YAN', 'подпись на языке + цена из SDK');
  ok(g.adReady()); it.onSelect.call(g); await sleep(40); ok(g.noAds() && !g.adReady()); ok(e.log.includes('purchase:no_ads'));
  g.goto('pause'); g.goto('title'); ok(!g.menu.items('pause').includes('noads') && !g.menu.items('title').includes('noads'), 'пункты убраны'); ok(g._flashMsg && /Reklamlar/.test(g._flashMsg.text), 'сообщение «реклама отключена»');
  const purchases = e.win.__sdkMock.purchases.slice(); ok(purchases.some(x => x.productID === 'no_ads'), 'покупка в SDK');
  const e2 = engineEnv({ platform: 'yandex', mock: { purchases } }), g2 = e2.g; g2.useStandardScreens({}); g2.useNoAds({ scene: ['title', 'pause'] }); await e2.win.Platform.init(); await g2.flags.ready; await sleep(20);
  ok(g2.noAds() && !g2.adReady(), 'восстановлено при следующем запуске'); g2.goto('title'); ok(!g2.menu.items('title').includes('noads'));
});
test('v2.8 «Наши игры» (только через SDK): Яндекс — без текущей игры, сцена-список, открытие страницы каталога Яндекс Игр; GamePush — окно коллекции; web — нет', async () => {
  const games = [{ appID: '100000', title: 'Каскад', url: 'https://yandex.ru/games/app/100000' }, { appID: '100001', title: 'Отбойник', url: 'https://yandex.ru/games/app/100001' }];
  const e = engineEnv({ platform: 'yandex', mock: { games, appId: '100000' } }), g = e.g; const opened = []; e.win.open = (u) => { opened.push(u); return {}; };
  g.useStandardScreens({}); g.useOwnGames(); await e.win.Platform.init(); await sleep(5); g.goto('title'); await sleep(5); g.goto('title');
  ok(g.menu.items('title').includes('games'), JSON.stringify(g.menu.items('title'))); eq((await e.win.Platform.games.list()).games.map(x => x.id), ['100001'], 'текущая игра исключена');
  g.scenes.title._menu.items.find(x => x.key === 'games').onSelect.call(g); eq(g._sceneName, 'games'); eq(g.menu.items('games'), ['g_100001', 'back']);
  g._selectMenu(); eq(opened, ['https://yandex.ru/games/app/100001']); g.current._menu.sel = 1; g._selectMenu(); eq(g._sceneName, 'title');
  const only = engineEnv({ platform: 'yandex', mock: { games: [games[0]], appId: '100000' } }); only.g.useStandardScreens({}); only.g.useOwnGames(); await only.win.Platform.init(); await sleep(5); only.g.goto('title'); await sleep(5); only.g.goto('title');
  ok(!only.g.menu.items('title').includes('games'), 'других игр нет — пункта нет');
  const p = engineEnv({ platform: 'gamepush', metas: GP_META }); p.g.useStandardScreens({}); p.g.useOwnGames(); await p.win.Platform.init(); await sleep(5); p.g.goto('title'); await sleep(5); p.g.goto('title');
  const pi = p.g.scenes.title._menu.items.find(x => x.key === 'games'); ok(pi, 'GamePush: пункт есть'); pi.onSelect.call(p.g); ok(p.log.includes('gcOpen')); eq(p.g._sceneName, 'title');
  const w = engineEnv({ platform: 'web' }); w.g.useStandardScreens({}); w.g.useOwnGames(); await w.win.Platform.init(); await sleep(5); w.g.goto('title'); ok(!w.g.menu.items('title').includes('games'), 'web — нет');
});
test('v2.8 ярлык: пункт меню только если площадка позволяет; добавление → окно площадки (игра на паузе), пункт исчезает', async () => {
  const e = engineEnv({ platform: 'yandex' }), g = e.g; g.useStandardScreens({}); g.useShortcut(); await e.win.Platform.init(); await sleep(5); g.goto('title'); await sleep(5); g.goto('title');
  ok(g.menu.items('title').includes('shortcut'), JSON.stringify(g.menu.items('title')));
  g.scenes.title._menu.items.find(x => x.key === 'shortcut').onSelect.call(g); await sleep(20); g.goto('title'); await sleep(5); g.goto('title');
  ok(e.log.includes('showPrompt')); ok(!g.menu.items('title').includes('shortcut'), 'после добавления — нет');
  const n = engineEnv({ platform: 'yandex', mock: { shortcut: false } }); n.g.useStandardScreens({}); n.g.useShortcut(); await n.win.Platform.init(); await sleep(5); n.g.goto('title'); await sleep(5); n.g.goto('title'); ok(!n.g.menu.items('title').includes('shortcut'), 'нельзя — пункта нет');
});
test('v2.8 оценка: только после успеха (победа/рекорд) по выходу с финала, не раньше minSessions-й сессии и не чаще раза в gap сессий; вместо межстраничной; после отправки — никогда', async () => {
  const run = async (st, o = {}) => { const e = engineEnv({ platform: 'yandex', mock: { adMs: 5 }, store: st ? { 'arcade.review.tst': JSON.stringify(st) } : {} }), g = e.g; g.useStandardScreens({}); g.useReview(Object.assign({ minSessions: 2, gap: 2 }, o)); g.scene('play', { draw() {} });
    await e.win.Platform.init(); await sleep(5); return e; };
  let e = await run(null); e.g.goto('win'); e.g.current.press.call(e.g, 'action'); await sleep(30); ok(!e.log.includes('requestReview') && e.log.includes('fullscreen'), '1-я сессия — без оценки, реклама: ' + e.log.join(','));
  e = await run({ n: 1 }); e.g.state.score = 0; e.g.goto('gameover'); e.g.current.press.call(e.g, 'action'); await sleep(30); ok(!e.log.includes('requestReview'), 'поражение без рекорда — без оценки');
  e = await run({ n: 1 }); e.g.state.score = 10; e.g.goto('gameover'); e.g.current.press.call(e.g, 'action'); await sleep(30);
  ok(e.log.includes('requestReview') && !e.log.includes('fullscreen'), 'рекорд во 2-й сессии — оценка вместо рекламы: ' + e.log.join(','));
  const st = JSON.parse(e.w.store['arcade.review.tst']); eq([st.n, st.ask, st.done], [2, 2, 1]);
  e = await run({ n: 2, ask: 2 }); e.g.goto('win'); e.g.current.press.call(e.g, 'action'); await sleep(30); ok(!e.log.includes('requestReview') && e.log.includes('fullscreen'), 'gap 2: 3-я сессия после вопроса во 2-й — нет');
  e = await run({ n: 3, ask: 2 }); ok(JSON.parse(e.w.store['arcade.review.tst']).n === 4, 'счётчик сессий'); e.g.goto('win'); e.g.current.press.call(e.g, 'action'); await sleep(30); ok(e.log.includes('requestReview'), '4-я сессия — снова можно');
  e = await run({ n: 9, ask: 2, done: 1 }); e.g.goto('win'); e.g.current.press.call(e.g, 'action'); await sleep(30); ok(!e.log.includes('requestReview'), 'оценка отправлена — больше не спрашиваем');
  e = await run({ n: 5 }); e.g.goto('win'); e.g.current.press.call(e.g, 'action'); await sleep(30); e.w.log.length = 0; e.g.goto('win'); e.g.current.press.call(e.g, 'action'); await sleep(30); ok(!e.log.includes('requestReview'), 'раз за сессию');
});
test('v2.8 «облако слито»: g.onCloud(fn) — после init площадки с изменёнными ключами (и рекорд из облака); поздняя подписка — сразу; новый g.persist — снова; без площадки — один вызов с []', async () => {
  const e = engineEnv({ platform: 'yandex', mock: { cloud: { 'ls.arcade.x.w': '9', 'ls.arcade.x.d': 'deck2', 'best.tst': 500 } }, store: { 'arcade.x.w': '4', 'arcade.x.d': 'deck2' } }), g = e.g;
  g.persist('arcade.x.w', 'max'); g.persist('arcade.x.d', 'last'); const calls = []; g.onCloud((k) => calls.push(k.slice()));
  eq(calls, [], 'до init не зовётся'); await e.win.Platform.init(); await sleep(5);
  eq(calls, [['arcade.best.tst', 'arcade.x.w']]); eq(e.w.store['arcade.x.w'], '9'); eq(await g.cloudReady, ['arcade.best.tst', 'arcade.x.w']);
  const late = []; g.onCloud((k) => late.push(k)); await sleep(0); eq(late, [[]], 'поздняя подписка');
  e.win.Platform.save('ls.arcade.x.z', '3'); g.persist('arcade.x.z', 'max'); eq(calls[1], ['arcade.x.z'], 'новый ключ после init');
  const n = engineEnv(), nc = []; n.g.onCloud((k) => nc.push(k)); await sleep(0); eq(nc, [[]]); eq(await n.g.cloudReady, []);
});
for (const [name, fn] of queue) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)); } }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
