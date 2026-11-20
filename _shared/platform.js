/*! Гефест Arcade · platform.js — единый адаптер игровых площадок (Яндекс Игры, GamePush, свой сайт). v1.3.0
 * vanilla JS, 0 зависимостей. Источник — _shared/platform.js; в игру попадает копией js/platform.js через
 * tools/platform-build.mjs (сборка под площадку). На сайте arcade.hefest.ru игры его не подключают — движок без него
 * работает как раньше. Подключать ДО engine.js: движок (v2.5+) сам находит window.Platform и связывается с ним.
 *
 * Площадка: ?platform=yandex|gamepush|web в адресе страницы → ?platform=… в src самого platform.js (так его подключает
 * сборщик) → <meta name="arcade-platform" content="…"> → окружение (window.YaGames, домен Яндекс Игр) → web.
 * Ключи / ID проектов — только из <meta> (их ставит сборщик из своей конфигурации), в коде и в репо их нет:
 *   <meta name="gamepush-project-id" content="…">  <meta name="gamepush-public-token" content="…">
 *   <meta name="gamepush-save-field" content="arcade_save">  (поле игрока типа data, заводится в панели GamePush)
 *   <meta name="arcade-sdk-url" content="…">                 (необязательно: свой адрес SDK, например для теста)
 *
 * API (всё безопасно вызывать до init и без площадки; ошибки SDK не роняют игру):
 *   Platform.name                         'web' | 'yandex' | 'gamepush'
 *   Platform.init() → Promise             загрузить и инициализировать SDK (один раз; повторные вызовы — тот же Promise);
 *                                         SDK не загрузился (блокировщик, офлайн) за initTimeout — игра работает без него
 *   Platform.ready()                      «игра загружена, можно играть» (Яндекс LoadingAPI.ready / GamePush gameStart)
 *   Platform.gameplayStart() / gameplayStop()  — начало/конец активной игры (без повторов: шлёт только смену состояния)
 *   Platform.showRewarded(onReward) → Promise<bool>  — ролик за награду; onReward() вызывается ТОЛЬКО при успешном просмотре
 *   Platform.showInterstitial() → Promise<bool>      — полноэкранная реклама, не чаще interstitialGap секунд
 *                                         (Яндекс — 60, частоту ещё режет сама площадка; GamePush — 180: «не чаще раза в 3 минуты»)
 *   Platform.interstitialReady() / rewardedReady() → bool — показ сейчас возможен (SDK поднят, нет другого показа, интервал прошёл)
 *   Platform.save(key, data) → Promise    localStorage сразу + облако площадки (с задержкой saveDelay, пачкой);
 *   Platform.load(key) → Promise<data|null>  — после init: облако, при его отсутствии — localStorage;
 *   Platform.peek(key) → data|null        то же синхронно (что известно сейчас); Platform.flush() — отправить в облако сейчас
 *   Platform.lang() → 'ru'|'en'|'tr'|…|null — язык площадки (ISO 639-1); langFor(['ru','en']) — ближайший из поддерживаемых
 *   Platform.pauseHook(onPause, onResume) → unsubscribe — реклама/окно покупки/вкладка: игра на паузе, звук выключен;
 *                                         Platform.paused — сейчас пауза площадки
 *   Platform.allowExternalLinks           false на Яндексе и GamePush (если площадка не разрешила) — движок прячет ссылки
 *   Platform.hasAds                       есть ли реклама (web — нет: кнопки «за награду» игре лучше не показывать)
 *   --- v1.2 (сигнатуры SDK сверены с документацией 20.11.2026, ссылки — _shared/PLATFORMS.md, «Источники по SDK») ---
 *   Platform.leaderboard.available        таблица лидеров есть (после init; web — false)
 *     .submit(score, { board, extra }) → Promise<bool>  — отправить счёт (Яндекс leaderboards.setScore, не чаще 1 раза в с,
 *                                         только для вошедшего игрока; GamePush — поле игрока <board> + sync())
 *     .top({ board, limit, around, includeUser }) → Promise<{ entries:[{ rank, score, name, me }], me:{ rank, score }|null }>
 *     .me({ board }) → Promise<{ rank, score, name }|null>  — своё место; .open({ board }) → bool — окно площадки (GamePush)
 *     .canOpen (1.3)                    есть ли окно лидеров площадки (GamePush — да; Яндекс — нет: таблицу рисует игра)
 *                                         board по умолчанию 'score' (GamePush: поле игрока score = таблица Яндекса «score»)
 *   Platform.flags.get(defaults) → Promise<{ ключ: строка }>  — удалённая конфигурация (Яндекс getFlags, GamePush variables);
 *                                         defaults — значения в игре; .peek(key, def) — синхронно (что известно); .all()
 *   Platform.serverTime() → ms|null       серверное время (Яндекс serverTime(), GamePush gp.serverTime ISO); Platform.now() — оно или Date.now()
 *   Platform.review.canRequest() → Promise<bool>; .request() → Promise<bool>  — запрос оценки игры (1 раз за сессию)
 *   Platform.shortcut.canAdd() → Promise<bool>; .add() → Promise<bool>       — ярлык на рабочий стол / в избранное
 *   Platform.payments.available           покупки есть (после init)
 *     .setup({ <id>: { consumable } })    объявить товары; после init — проверка необработанных покупок (Яндекс 1.13.1):
 *                                         расходуемые → обработчики onPurchase(id) и consume; постоянные (no_ads) → owned
 *     .catalog() → Promise<[{ id, title, description, price, priceValue, currency, image }]>  — цена и валюта из SDK (1.13.2)
 *     .purchase(id, payload) → Promise<bool>  — окно покупки (игра на паузе); расходуемые — сразу обработчик + consume
 *     .owned(id) → bool; .onPurchase(fn(id)) → unsubscribe
 *   Platform.games.available; .list() → Promise<{ games:[{ id, title, url, icon, cover }], developerURL }>; .open(game) → bool
 *                                         (1.3: Яндекс — без текущей игры, environment.app.id; .native — окно коллекции площадки, GamePush)
 *                                         ссылки на свои игры только через SDK (Яндекс 8.4.1; GamePush — коллекции игр)
 *   Platform.sticky.show() / hide() → Promise<bool>  — стики-баннер (Яндекс: управление через API — опция в Консоли)
 *   Platform.setInterstitialGap(sec)      интервал полноэкранной (флаг площадки); не меньше минимума площадки (Яндекс 30, GamePush 180)
 *   ArcadePlatform.create(env)            отдельный экземпляр (тесты: env.win, env.doc, env.now, env.storage,
 *                                         env.setTimeout, env.loadScript, env.config)
 * Документ: _shared/PLATFORMS.md. Тесты: node _shared/tests/platform.test.mjs.
 */
(function (global) {
  'use strict';
  var VERSION = '1.3.0', NAMES = { web: 1, yandex: 1, gamepush: 1 };
  var YANDEX_SDK = '/sdk.js';                                   // Яндекс: относительный путь, отдаёт сама площадка
  var GAMEPUSH_SDK = 'https://gamepush.com/sdk/game-score.js';  // GamePush: загрузчик SDK (?projectId&publicToken&callback)
  var RU_LIKE = { ru: 1, be: 1, uk: 1, kk: 1, uz: 1 };          // носителям этих языков удобнее русская версия

  function param(search, k) { var m = new RegExp('[?&]' + k + '=([a-z]+)', 'i').exec(search || ''); return m ? m[1].toLowerCase() : null; }

  function create(env) {
    env = env || {};
    var win = env.win || global, doc = env.doc !== undefined ? env.doc : win.document;
    var now = env.now || function () { return Date.now(); };
    var later = env.setTimeout || function (f, ms) { return (win.setTimeout || setTimeout)(f, ms); };
    var cfg = Object.assign({ interstitialGap: null, initTimeout: 6000, saveDelay: 1500, prefix: 'arcade.pf.' }, env.config || {});
    var store = env.storage !== undefined ? env.storage : (function () { try { return win.localStorage; } catch (e) { return null; } })();

    function meta(name) { try { var m = doc && doc.querySelector && doc.querySelector('meta[name="' + name + '"]'); var v = m && m.getAttribute('content'); return v ? String(v).trim() : null; } catch (e) { return null; } }
    function ownScriptQuery() {
      try {
        var s = doc && doc.currentScript; var src = s && s.getAttribute && s.getAttribute('src');
        if (!src && doc && doc.querySelectorAll) { var all = doc.querySelectorAll('script[src*="platform.js"]'); if (all.length) src = all[all.length - 1].getAttribute('src'); }
        return src && src.indexOf('?') >= 0 ? src.slice(src.indexOf('?')) : '';
      } catch (e) { return ''; }
    }
    function detect() {
      var v = env.platform || param(win.location && win.location.search, 'platform'); if (NAMES[v]) return v;
      v = param(ownScriptQuery(), 'platform'); if (NAMES[v]) return v;
      v = (meta('arcade-platform') || '').toLowerCase(); if (NAMES[v]) return v;
      if (win.YaGames) return 'yandex';
      var host = (win.location && win.location.hostname) || '';
      if (/(^|\.)(yandex\.(ru|com|by|kz|uz|com\.tr|net)|playhop\.com)$/i.test(host)) return 'yandex';
      return 'web';
    }
    function loadScript(src) {
      if (env.loadScript) return env.loadScript(src);
      return new Promise(function (res, rej) {
        if (!doc || !doc.createElement) { rej(new Error('нет document')); return; }
        var s = doc.createElement('script'); s.src = src; s.async = true;
        s.onload = function () { res(); }; s.onerror = function () { rej(new Error('SDK не загрузился: ' + src)); };
        (doc.head || doc.documentElement).appendChild(s);
      });
    }
    function timeout(p, ms) { return new Promise(function (res, rej) { var done = false; later(function () { if (!done) { done = true; rej(new Error('SDK: таймаут ' + ms + ' мс')); } }, ms); p.then(function (v) { if (!done) { done = true; res(v); } }, function (e) { if (!done) { done = true; rej(e); } }); }); }
    function safe(fn) { try { return fn(); } catch (e) { P.errors.push(String(e && e.message || e)); return undefined; } }

    // ---------- пауза площадки: причины складываются (реклама + вкладка), хуки — на переходах «нет паузы» ↔ «пауза» ----------
    var hooks = [], reasons = {};
    function pause(r) { var was = P.paused; reasons[r] = 1; P.paused = true; if (!was) hooks.slice().forEach(function (h) { safe(function () { if (h[0]) h[0](r); }); }); }
    function resume(r) { if (!reasons[r]) return; delete reasons[r]; if (Object.keys(reasons).length) return; P.paused = false; hooks.slice().forEach(function (h) { safe(function () { if (h[1]) h[1](r); }); }); }

    // ---------- бэкенды: init → Promise; ready/start/stop; interstitial/rewarded → Promise<bool>; cloudLoad/cloudSave; lang ----------
    var B = {};
    B.web = function () {
      return { links: true, ads: false, init: function () { return Promise.resolve(); }, ready: function () {}, start: function () {}, stop: function () {},
        interstitial: function () { return Promise.resolve(false); }, rewarded: function () { return Promise.resolve(false); },
        cloudLoad: function () { return Promise.resolve(null); }, cloudSave: function () { return Promise.resolve(false); }, lang: function () { return null; },
        // v1.2 — заглушки (web и откат без SDK): всё «недоступно», промисы не падают
        lb: false, lbSubmit: function () { return Promise.resolve(false); }, lbTop: function () { return Promise.resolve({ entries: [], me: null }); },
        lbMe: function () { return Promise.resolve(null); }, lbOpen: function () { return false; }, lbNative: false, gamesNative: false,
        flags: function (d) { return Promise.resolve(Object.assign({}, d || {})); }, serverTime: function () { return null; },
        canReview: function () { return Promise.resolve(false); }, review: function () { return Promise.resolve(false); },
        canShortcut: function () { return Promise.resolve(false); }, shortcut: function () { return Promise.resolve(false); },
        pay: false, payList: function () { return Promise.resolve([]); }, payCatalog: function () { return Promise.resolve([]); },
        payBuy: function () { return Promise.resolve(null); }, payConsume: function () { return Promise.resolve(false); },
        games: false, gamesList: function () { return Promise.resolve({ games: [], developerURL: null }); }, gamesOpen: function () { return false; },
        sticky: function () { return Promise.resolve(false); } };
    };
    function str(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { if (o[k] != null) r[k] = String(o[k]); }); return r; }
    function rej(e) { return Promise.reject(e instanceof Error ? e : new Error(String(e && (e.code || e.message) || e))); }
    // Яндекс Игры, SDK v2 (yandex.ru/dev/games/doc): YaGames.init(); features.LoadingAPI.ready(); features.GameplayAPI.start/stop();
    // adv.showFullscreenAdv / showRewardedVideo({callbacks}); on('game_api_pause'|'game_api_resume'); getPlayer() → setData/getData;
    // environment.i18n.lang. Внешние ссылки запрещены требованиями (8.4.2, 8.4.4).
    B.yandex = function () {
      var ysdk = null, player = null;
      return { links: false, ads: true,
        init: function () {
          var load = win.YaGames ? Promise.resolve() : loadScript(meta('arcade-sdk-url') || YANDEX_SDK);
          return load.then(function () { if (!win.YaGames || !win.YaGames.init) throw new Error('нет YaGames'); return win.YaGames.init(); }).then(function (s) {
            ysdk = P.sdk = s;
            safe(function () { s.on('game_api_pause', function () { pause('platform'); }); s.on('game_api_resume', function () { resume('platform'); }); });
            return Promise.resolve(safe(function () { return s.getPlayer(); })).then(function (p) { player = p || null; }, function () { player = null; });
          });
        },
        ready: function () { safe(function () { var f = ysdk && ysdk.features; if (f && f.LoadingAPI) f.LoadingAPI.ready(); }); },
        start: function () { safe(function () { var f = ysdk && ysdk.features; if (f && f.GameplayAPI) f.GameplayAPI.start(); }); },
        stop: function () { safe(function () { var f = ysdk && ysdk.features; if (f && f.GameplayAPI) f.GameplayAPI.stop(); }); },
        interstitial: function () {
          return new Promise(function (res) {
            if (!ysdk || !ysdk.adv) { res(false); return; }
            var fin = function (ok) { resume('ad'); res(!!ok); };
            safe(function () { ysdk.adv.showFullscreenAdv({ callbacks: { onOpen: function () { pause('ad'); }, onClose: function (wasShown) { fin(wasShown); }, onError: function () { fin(false); }, onOffline: function () { fin(false); } } }); }) ;
          });
        },
        rewarded: function () {
          return new Promise(function (res) {
            if (!ysdk || !ysdk.adv) { res(false); return; }
            var got = false, done = false, fin = function () { if (done) return; done = true; resume('ad'); res(got); };
            safe(function () { ysdk.adv.showRewardedVideo({ callbacks: { onOpen: function () { pause('ad'); }, onRewarded: function () { got = true; }, onClose: fin, onError: function () { got = false; fin(); } } }); });
          });
        },
        cloudLoad: function () { return player && player.getData ? Promise.resolve(player.getData()).then(function (d) { return d && typeof d === 'object' ? d : null; }, function () { return null; }) : Promise.resolve(null); },
        cloudSave: function (obj) { return player && player.setData ? Promise.resolve(player.setData(obj, false)).then(function () { return true; }, function () { return false; }) : Promise.resolve(false); },
        lang: function () { return safe(function () { return ysdk && ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang; }) || null; },
        // --- v1.2 ---
        // Лидерборды: ysdk.leaderboards (getLeaderboards() устарел). setScore(name, score, extra?) — только вошедший игрок
        // (isAvailableMethod('leaderboards.setScore')), не чаще 1 раза в секунду; getEntries(name, { quantityTop ≤ 20,
        // includeUser, quantityAround ≤ 10 }) → { entries:[{ score, rank, player:{ publicName, uniqueID } }], userRank };
        // getPlayerEntry(name) — ошибка LEADERBOARD_PLAYER_NOT_PRESENT, если записи нет.
        get lb() { return !!(ysdk && ysdk.leaderboards); },
        lbSubmit: function (board, score, extra) {
          var L = ysdk && ysdk.leaderboards; if (!L) return Promise.resolve(false);
          var can = ysdk.isAvailableMethod ? Promise.resolve(safe(function () { return ysdk.isAvailableMethod('leaderboards.setScore'); })) : Promise.resolve(true);
          return can.then(function (yes) { if (!yes) return false; return Promise.resolve(L.setScore(board, score, extra)).then(function () { return true; }); });
        },
        lbTop: function (board, o) {
          var L = ysdk && ysdk.leaderboards; if (!L) return Promise.resolve({ entries: [], me: null });
          return Promise.resolve(L.getEntries(board, { quantityTop: o.limit, includeUser: o.includeUser, quantityAround: o.around })).then(function (r) {
            var me = null, uid = safe(function () { return player && player.getUniqueID && player.getUniqueID(); });
            var entries = ((r && r.entries) || []).map(function (e) { var p = e.player || {}, mine = !!(uid && p.uniqueID === uid) || (r.userRank > 0 && e.rank === r.userRank);
              var x = { rank: e.rank, score: e.score, name: p.publicName || '', me: mine }; if (mine) me = { rank: e.rank, score: e.score }; return x; });
            if (!me && r && r.userRank > 0) me = { rank: r.userRank, score: null };
            return { entries: entries, me: me };
          });
        },
        lbOpen: function () { return false; }, lbNative: false, // у Яндекса нет окна лидеров — таблицу рисует игра (движок: сцена «Лидеры»)
        lbMe: function (board) {
          var L = ysdk && ysdk.leaderboards; if (!L) return Promise.resolve(null);
          return Promise.resolve(L.getPlayerEntry(board)).then(function (e) { return e ? { rank: e.rank, score: e.score, name: (e.player && e.player.publicName) || '' } : null; },
            function (e) { if (e && (e.code === 'LEADERBOARD_PLAYER_NOT_PRESENT' || /NOT_PRESENT/.test(String(e.message || e)))) return null; throw e; });
        },
        // Удалённая конфигурация: await ysdk.getFlags({ defaultFlags }) → { ключ: строка } (удалённое важнее локального)
        flags: function (d) { if (!ysdk || !ysdk.getFlags) return Promise.resolve(Object.assign({}, d)); return Promise.resolve(ysdk.getFlags({ defaultFlags: d })).then(function (f) { return Object.assign({}, d, str(f)); }); },
        // Серверное время: ysdk.serverTime() → мс (одинаково для всех устройств)
        serverTime: function () { var t = safe(function () { return ysdk && ysdk.serverTime && ysdk.serverTime(); }); return typeof t === 'number' && isFinite(t) ? t : null; },
        // Оценка: feedback.canReview() → { value, reason }; requestReview() → { feedbackSent } (раз за сессию, сначала canReview)
        canReview: function () { var F = ysdk && ysdk.feedback; if (!F) return Promise.resolve(false); return Promise.resolve(F.canReview()).then(function (r) { return !!(r && r.value); }); },
        review: function () { return Promise.resolve(ysdk.feedback.requestReview()).then(function (r) { return !!(r && r.feedbackSent); }); },
        // Ярлык: shortcut.canShowPrompt() → { canShow }; showPrompt() → { outcome: 'accepted' | … }
        canShortcut: function () { var S = ysdk && ysdk.shortcut; if (!S) return Promise.resolve(false); return Promise.resolve(S.canShowPrompt()).then(function (r) { return !!(r && r.canShow); }); },
        shortcut: function () { return Promise.resolve(ysdk.shortcut.showPrompt()).then(function (r) { return !!(r && r.outcome === 'accepted'); }); },
        // Покупки: ysdk.payments (инициализируется при первом вызове). purchase({ id, developerPayload }) → { productID, purchaseToken };
        // getPurchases() → [IPurchase] (при каждом запуске, 1.13.1); getCatalog() → [{ id, title, description, imageURI, price,
        // priceValue, priceCurrencyCode }]; consumePurchase(purchaseToken) — расходуемые, после начисления.
        get pay() { return !!(ysdk && (ysdk.payments || ysdk.getPayments)); },
        _p: function () { if (ysdk.payments) return Promise.resolve(ysdk.payments); return Promise.resolve(ysdk.getPayments()); },
        payList: function () { return this._p().then(function (p) { return p.getPurchases(); }).then(function (l) { return (l || []).map(function (x) { return { id: x.productID, token: x.purchaseToken }; }); }); },
        payCatalog: function () { return this._p().then(function (p) { return p.getCatalog(); }).then(function (l) { return (l || []).map(function (x) {
          return { id: x.id, title: x.title || '', description: x.description || '', price: x.price || '', priceValue: x.priceValue, currency: x.priceCurrencyCode || '', image: x.imageURI || '',
            currencyImage: safe(function () { return x.getPriceCurrencyImage && x.getPriceCurrencyImage('small'); }) || '' }; }); }); },
        payBuy: function (id, payload) { return this._p().then(function (p) { var o = { id: id }; if (payload != null) o.developerPayload = String(payload); return p.purchase(o); })
          .then(function (x) { return x ? { id: x.productID || id, token: x.purchaseToken } : null; }); },
        payConsume: function (it) { return this._p().then(function (p) { return p.consumePurchase(it.token); }).then(function () { return true; }); },
        // Свои игры: features.GamesAPI.getAllGames() → { games:[{ appID, title, url, coverURL, iconURL }], developerURL }
        get games() { return !!(ysdk && ysdk.features && ysdk.features.GamesAPI); },
        gamesList: function () { var cur = safe(function () { return ysdk.environment && ysdk.environment.app && ysdk.environment.app.id; }); // 1.3: без текущей игры
          return Promise.resolve(ysdk.features.GamesAPI.getAllGames()).then(function (r) {
          return { games: ((r && r.games) || []).filter(function (g) { return cur == null || String(g.appID) !== String(cur); }).map(function (g) { return { id: g.appID, title: g.title, url: g.url, icon: g.iconURL, cover: g.coverURL }; }), developerURL: (r && r.developerURL) || null }; }); },
        gamesOpen: function (g) { var u = g && g.url; if (!u || !/^https:\/\/([a-z0-9-]+\.)*(yandex\.(ru|com|by|kz|uz|com\.tr|net)|playhop\.com)\//i.test(u)) return false; // только каталог Яндекс Игр (8.4.1)
          return !!safe(function () { return win.open(u, '_blank'); }); },
        // Стики-баннер: adv.showBannerAdv() / hideBannerAdv() → { stickyAdvIsShowing }. По умолчанию его ведёт площадка; методы
        // работают, если в Консоли включено «Использовать API для показа стики-баннера».
        sticky: function (on) { var A = ysdk && ysdk.adv; if (!A || !A.showBannerAdv) return Promise.resolve(false);
          return Promise.resolve(on ? A.showBannerAdv() : A.hideBannerAdv()).then(function (r) { return !!(r && r.stickyAdvIsShowing) === !!on; }); }
      };
    };
    // GamePush (docs.gamepush.com): загрузчик ?projectId=&publicToken=&callback=onGPInit → onGPInit(gp); await gp.player.ready;
    // gp.gameStart(); gp.gameplayStart/Stop(); gp.ads.showFullscreen() / showRewardedVideo() → Promise (успех);
    // gp.ads.on('start'|'close'); gp.on('pause'|'resume'); gp.player.get/set(поле)/sync(); gp.language; gp.platform.isExternalLinksAllowed.
    B.gamepush = function () {
      var gp = null, field = meta('gamepush-save-field') || 'arcade_save';
      var be = { links: false, ads: true,
        init: function () {
          var id = meta('gamepush-project-id'), tok = meta('gamepush-public-token');
          if (!id || !tok || /^(GP_|__|%|\{)/.test(id) || /^(GP_|__|%|\{)/.test(tok)) return Promise.reject(new Error('GamePush: не заданы ID проекта / публичный токен (meta gamepush-project-id, gamepush-public-token)'));
          return new Promise(function (res, rej) {
            var prev = win.onGPInit;
            win.onGPInit = function (inst) { if (typeof prev === 'function') safe(function () { prev(inst); }); res(inst); };
            var base = meta('arcade-sdk-url') || GAMEPUSH_SDK;
            loadScript(base + (base.indexOf('?') >= 0 ? '&' : '?') + 'projectId=' + encodeURIComponent(id) + '&publicToken=' + encodeURIComponent(tok) + '&callback=onGPInit').then(null, rej);
          }).then(function (inst) {
            gp = P.sdk = inst;
            safe(function () { gp.on('pause', function () { pause('platform'); }); gp.on('resume', function () { resume('platform'); }); });
            safe(function () { gp.ads.on('start', function () { pause('ad'); }); gp.ads.on('close', function () { resume('ad'); }); });
            be.links = !!safe(function () { return gp.platform && gp.platform.isExternalLinksAllowed === true; });
            return Promise.resolve(gp.player && gp.player.ready).then(null, function () {});
          });
        },
        ready: function () { safe(function () { gp && gp.gameStart && gp.gameStart(); }); },
        start: function () { safe(function () { gp && gp.gameplayStart && gp.gameplayStart(); }); },
        stop: function () { safe(function () { gp && gp.gameplayStop && gp.gameplayStop(); }); },
        interstitial: function () { if (!gp || !gp.ads) return Promise.resolve(false); pause('ad'); return Promise.resolve(safe(function () { return gp.ads.showFullscreen(); })).then(function (r) { resume('ad'); return r !== false; }, function () { resume('ad'); return false; }); },
        rewarded: function () { if (!gp || !gp.ads) return Promise.resolve(false); pause('ad'); return Promise.resolve(safe(function () { return gp.ads.showRewardedVideo(); })).then(function (r) { resume('ad'); return r === true; }, function () { resume('ad'); return false; }); },
        cloudLoad: function () { return Promise.resolve(safe(function () { var s = gp && gp.player && gp.player.get(field); if (!s) return null; try { var o = JSON.parse(s); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }) || null); },
        cloudSave: function (obj) { if (!gp || !gp.player) return Promise.resolve(false); return Promise.resolve(safe(function () { gp.player.set(field, JSON.stringify(obj)); return gp.player.sync(); })).then(function () { return true; }, function () { return false; }); },
        lang: function () { return safe(function () { return gp && gp.language; }) || null; },
        // --- v1.2 ---
        // Лидерборд GamePush строится по числовому полю игрока (по умолчанию score; при sync() поле score уходит и в таблицу
        // Яндекса с техническим именем «score»). fetch({ orderBy, order, limit, withMe }) → { players, topPlayers, player };
        // fetchPlayerRating({ orderBy }) → { player:{ position, … } }; open({ orderBy, withMe }) — окно площадки.
        get lb() { return !!(gp && gp.leaderboard); }, get lbNative() { return !!(gp && gp.leaderboard && gp.leaderboard.open); },
        lbSubmit: function (board, score) {
          if (!gp || !gp.player) return Promise.resolve(false);
          return Promise.resolve(safe(function () { var cur = +gp.player.get(board) || 0; if (score <= cur) return true; gp.player.set(board, score); return gp.player.sync(); })).then(function () { return true; });
        },
        lbTop: function (board, o) {
          return Promise.resolve(gp.leaderboard.fetch({ orderBy: [board], order: 'DESC', limit: o.limit, withMe: o.includeUser ? 'last' : 'none', showNearest: o.includeUser ? o.around : 0 })).then(function (r) {
            var myId = safe(function () { return gp.player.id; }), me = null;
            var entries = ((r && (r.players || r.topPlayers)) || []).map(function (p) { var mine = myId != null && p.id === myId; var x = { rank: p.position, score: p[board], name: p.name || '', me: mine }; if (mine) me = { rank: p.position, score: p[board] }; return x; });
            if (!me && r && r.player) me = { rank: r.player.position, score: r.player[board] };
            return { entries: entries, me: me };
          });
        },
        lbMe: function (board) { return Promise.resolve(gp.leaderboard.fetchPlayerRating({ orderBy: [board], order: 'DESC' })).then(function (r) { var p = r && r.player; return p ? { rank: p.position, score: p[board], name: p.name || '' } : null; }); },
        lbOpen: function (board) { if (!gp || !gp.leaderboard) return false; safe(function () { gp.leaderboard.open({ orderBy: [board], order: 'DESC', withMe: 'last' }); }); return true; },
        // Переменные игры (панель GamePush): variables.has(key) / get(key); перечислить нельзя — берём ключи из defaults
        flags: function (d) { var V = gp && gp.variables, out = Object.assign({}, d); if (!V) return Promise.resolve(out);
          return Promise.resolve(V.fetch ? safe(function () { return V.fetch(); }) : null).then(null, function () {}).then(function () {
            Object.keys(d).forEach(function (k) { safe(function () { if (V.has(k)) out[k] = String(V.get(k)); }); }); return out; }); },
        // gp.serverTime — серверное время, ISO 8601, только чтение
        serverTime: function () { var s = safe(function () { return gp && gp.serverTime; }), t = s ? Date.parse(s) : NaN; return isFinite(t) ? t : null; },
        // Отзыв: app.canRequestReview (bool), requestReview() → { success, rating, error } (Яндекс Игры и OK)
        canReview: function () { return Promise.resolve(!!safe(function () { return gp.app.canRequestReview; })); },
        review: function () { return Promise.resolve(gp.app.requestReview()).then(function (r) { return !!(r && r.success); }); },
        // Ярлык / избранное: app.canAddShortcut (bool), addShortcut() → bool (Яндекс Игры, VK)
        canShortcut: function () { return Promise.resolve(!!safe(function () { return gp.app.canAddShortcut; })); },
        shortcut: function () { return Promise.resolve(gp.app.addShortcut()).then(function (r) { return r === true; }); },
        // Покупки: payments.isAvailable; products [{ id, tag, name, description, icon, price, currency, currencySymbol }];
        // purchases [{ productId, payload }]; purchase({ tag }) → { product, purchase }; consume({ tag }); has(tag).
        // Наш id товара = tag в панели GamePush (например no_ads).
        get pay() { return !!safe(function () { return gp.payments.isAvailable; }); },
        _tag: function (pid) { var p = (safe(function () { return gp.payments.products; }) || []).filter(function (x) { return x.id === pid; })[0]; return p ? (p.tag || String(p.id)) : String(pid); },
        payList: function () { var self = this; return Promise.resolve((safe(function () { return gp.payments.purchases; }) || []).map(function (x) { return { id: self._tag(x.productId) }; })); },
        payCatalog: function () { return Promise.resolve((safe(function () { return gp.payments.products; }) || []).map(function (x) {
          return { id: x.tag || String(x.id), title: x.name || '', description: x.description || '', price: x.price != null ? x.price + ' ' + (x.currencySymbol || x.currency || '') : '', priceValue: x.price, currency: x.currency || '', image: x.icon || '' }; })); },
        payBuy: function (id, payload) { var o = { tag: id }; if (payload != null) o.payload = payload; return Promise.resolve(gp.payments.purchase(o)).then(function (r) { return r && (r.purchase || r.product) ? { id: id } : null; }); },
        payConsume: function (it) { return Promise.resolve(gp.payments.consume({ tag: it.id })).then(function () { return true; }); },
        // Коллекции игр: gamesCollections.fetch({ tag }) → { games:[{ id, name, description, icon, url }] }; open({ tag }) — окно площадки
        get games() { return !!(gp && gp.gamesCollections); }, get gamesNative() { return !!(gp && gp.gamesCollections && gp.gamesCollections.open); },
        gamesList: function () { return Promise.resolve(gp.gamesCollections.fetch({ tag: 'ALL' })).then(function (r) {
          return { games: ((r && r.games) || []).map(function (g) { return { id: g.id, title: g.name, url: g.url, icon: g.icon, cover: null }; }), developerURL: null }; }); },
        gamesOpen: function () { if (!gp || !gp.gamesCollections) return false; safe(function () { gp.gamesCollections.open({ tag: 'ALL' }); }); return true; },
        // Стики-баннер: ads.showSticky() / closeSticky(), ads.isStickyAvailable
        sticky: function (on) { var A = gp && gp.ads; if (!A || !A.showSticky) return Promise.resolve(false); if (on && A.isStickyAvailable === false) return Promise.resolve(false);
          safe(function () { if (on) A.showSticky(); else A.closeSticky(); }); return Promise.resolve(true); }
      };
      return be;
    };

    // ---------- общий фасад ----------
    var name = detect();
    if (cfg.interstitialGap == null) cfg.interstitialGap = name === 'gamepush' ? 180 : 60; // GamePush, чек-лист тестирования: реклама не чаще раза в 3 мин
    var be = B[name](), initP = null, readyWanted = false, readySent = false, active = false, wantActive = false;
    var cache = {}, dirty = false, saveT = 0, lastAd = -Infinity, adBusy = false;
    var P = { version: VERSION, name: name, allowExternalLinks: be.links, hasAds: be.ads, cloud: false, inited: false, paused: false, sdk: null, errors: [], config: cfg };

    function lsGet(k) { try { var v = store && store.getItem(cfg.prefix + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } }
    function lsSet(k, v) { try { if (store) store.setItem(cfg.prefix + k, JSON.stringify(v)); } catch (e) {} }

    P.init = function () {
      if (initP) return initP;
      initP = timeout(Promise.resolve().then(function () { return be.init(); }), cfg.initTimeout).then(function () {
        return be.cloudLoad().then(function (obj) { P.cloud = name !== 'web' && P.sdk != null; if (obj) Object.keys(obj).forEach(function (k) { cache[k] = obj[k]; }); });
      }).then(null, function (e) {
        P.errors.push(String(e && e.message || e)); P.sdk = null; P.cloud = false; P.hasAds = false; // без SDK: локальные сохранения, без рекламы
        be = Object.assign(B.web(), { links: be.links });
      }).then(function () {
        P.inited = true; P.allowExternalLinks = be.links;
        LB.available = !!be.lb; PAY.available = !!be.pay; P.games.available = !!be.games; // v1.2: что умеет площадка
        LB.canOpen = !!(be.lb && be.lbNative); P.games.native = !!(be.games && be.gamesNative); // 1.3: окна площадки (GamePush)
        if (readyWanted) P.ready();
        if (wantActive && !active) { active = true; be.start(); }
        return P;
      });
      return initP;
    };
    P.ready = function () { readyWanted = true; if (!P.inited || readySent) return; readySent = true; be.ready(); };
    P.gameplayStart = function () { wantActive = true; if (!P.inited || active || adBusy) return; active = true; be.start(); };
    P.gameplayStop = function () { wantActive = false; if (!P.inited || !active) return; active = false; be.stop(); };
    function around(show) { // реклама: стоп геймплея на время показа, затем — как было
      adBusy = true; var was = active; if (was) { active = false; be.stop(); }
      return show().then(null, function () { return false; }).then(function (ok) { adBusy = false; if (wantActive && !active) { active = true; be.start(); } return !!ok; });
    }
    P.showInterstitial = function () {
      if (!P.inited || !P.hasAds || adBusy) return Promise.resolve(false);
      var t = now(); if (t - lastAd < cfg.interstitialGap * 1000) return Promise.resolve(false);
      lastAd = t; return around(function () { return be.interstitial(); });
    };
    P.interstitialReady = function () { return !!(P.inited && P.hasAds && !adBusy && now() - lastAd >= cfg.interstitialGap * 1000); };
    P.rewardedReady = function () { return !!(P.inited && P.hasAds && !adBusy); };
    P.showRewarded = function (onReward) {
      if (!P.inited || !P.hasAds || adBusy) return Promise.resolve(false);
      return around(function () { return be.rewarded(); }).then(function (ok) { lastAd = now(); if (ok && typeof onReward === 'function') safe(onReward); return ok; });
    };
    P.peek = function (key) { if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key]; var v = lsGet(key); return v; };
    P.load = function (key) { return P.init().then(function () { return P.peek(key); }); };
    P.save = function (key, data) {
      cache[key] = data; lsSet(key, data); dirty = true;
      if (!saveT) saveT = later(function () { saveT = 0; P.flush(); }, cfg.saveDelay) || 1;
      return Promise.resolve(true);
    };
    P.flush = function () {
      if (!dirty) return Promise.resolve(false);
      return P.init().then(function () { if (!P.cloud) return false; dirty = false; var all = {}; Object.keys(cache).forEach(function (k) { all[k] = cache[k]; }); return be.cloudSave(all); });
    };
    P.lang = function () { var l = be.lang(); return l ? String(l).slice(0, 2).toLowerCase() : null; };
    P.langFor = function (supported) {
      var l = P.lang(); supported = supported || ['ru', 'en']; if (!l) return null;
      if (supported.indexOf(l) >= 0) return l; if (RU_LIKE[l] && supported.indexOf('ru') >= 0) return 'ru';
      return supported.indexOf('en') >= 0 ? 'en' : supported[0] || null;
    };
    P.pauseHook = function (onPause, onResume) { var h = [onPause, onResume]; hooks.push(h); return function () { var i = hooks.indexOf(h); if (i >= 0) hooks.splice(i, 1); }; };
    P.isActive = function () { return active; };
    // ---------- v1.2: лидерборды, флаги, серверное время, оценка, ярлык, покупки, свои игры, стики ----------
    function after(fn, dflt) { return P.init().then(function () { return fn(); }).then(null, function (e) { P.errors.push(String(e && (e.code || e.message) || e)); return dflt; }); }
    function dialog(fn) { pause('dialog'); return Promise.resolve().then(fn).then(function (r) { resume('dialog'); return r; }, function (e) { resume('dialog'); throw e; }); }
    var GAP_MIN = { yandex: 30, gamepush: 180, web: 0 };
    P.setInterstitialGap = function (sec) { sec = +sec; if (!isFinite(sec) || sec < 0) return cfg.interstitialGap; cfg.interstitialGap = Math.max(GAP_MIN[name] || 0, sec); return cfg.interstitialGap; };

    var lbLast = -Infinity, lbQ = null;
    var LB = P.leaderboard = {
      available: false, canOpen: false, board: 'score',
      // Яндекс: setScore не чаще 1 раза в секунду — частые вызовы склеиваются, уходит последний (наибольший) счёт
      submit: function (score, o) {
        o = o || {}; score = Math.max(0, Math.round(+score || 0)); var board = o.board || LB.board;
        return P.init().then(function () {
          if (!be.lb) return false;
          if (lbQ && lbQ.board === board) { lbQ.score = Math.max(lbQ.score, score); if (o.extra != null) lbQ.extra = String(o.extra); return lbQ.p; }
          var q = lbQ = { board: board, score: score, extra: o.extra != null ? String(o.extra) : undefined };
          q.p = new Promise(function (res) { later(function () { if (lbQ === q) lbQ = null; lbLast = now();
            Promise.resolve().then(function () { return be.lbSubmit(q.board, q.score, q.extra); }).then(function (r) { res(!!r); }, function (e) { P.errors.push(String(e && (e.code || e.message) || e)); res(false); }); },
            Math.max(0, lbLast + 1100 - now())); });
          return q.p;
        });
      },
      top: function (o) { o = o || {}; var opt = { limit: Math.min(20, Math.max(1, o.limit || 10)), around: Math.min(10, Math.max(1, o.around || 3)), includeUser: o.includeUser !== false };
        return after(function () { return be.lb ? be.lbTop(o.board || LB.board, opt) : { entries: [], me: null }; }, { entries: [], me: null }); },
      me: function (o) { o = o || {}; return after(function () { return be.lb ? be.lbMe(o.board || LB.board) : null; }, null); },
      open: function (o) { o = o || {}; return !!(P.inited && be.lb && safe(function () { return be.lbOpen(o.board || LB.board); })); }
    };

    var flagCache = {}, flagP = null;
    P.flags = {
      get: function (defaults) { var d = str(defaults); Object.keys(d).forEach(function (k) { if (!(k in flagCache)) flagCache[k] = d[k]; });
        return after(function () { return be.flags(d); }, d).then(function (f) { Object.keys(f || {}).forEach(function (k) { flagCache[k] = f[k]; }); return Object.assign({}, d, f); }); },
      peek: function (key, def) { return Object.prototype.hasOwnProperty.call(flagCache, key) ? flagCache[key] : (def === undefined ? null : def); },
      all: function () { return Object.assign({}, flagCache); }
    };

    P.serverTime = function () { return P.inited ? safe(function () { return be.serverTime(); }) || null : null; };
    P.now = function () { return P.serverTime() || Date.now(); };

    var reviewAsked = false;
    P.review = {
      canRequest: function () { return reviewAsked ? Promise.resolve(false) : after(function () { return be.canReview(); }, false); },
      request: function () { if (reviewAsked) return Promise.resolve(false);
        return P.review.canRequest().then(function (can) { if (!can) return false; reviewAsked = true; return dialog(function () { return be.review(); }).then(null, function (e) { P.errors.push(String(e && e.message || e)); return false; }); }); }
    };
    P.shortcut = {
      canAdd: function () { return after(function () { return be.canShortcut(); }, false); },
      add: function () { return P.shortcut.canAdd().then(function (can) { if (!can) return false; return dialog(function () { return be.shortcut(); }).then(null, function (e) { P.errors.push(String(e && e.message || e)); return false; }); }); }
    };

    // Покупки. Товары объявляет игра (setup); после init — проверка необработанных покупок (Яндекс 1.13.1, обязательна при каждом
    // запуске): расходуемые (consumable) — обработчики onPurchase(id) → consume; постоянные (no_ads и т. п.) — в owned.
    var products = {}, owned = {}, payHooks = [], restoreP = null, catalogP = null;
    function grant(id) { var okAll = true; payHooks.slice().forEach(function (h) { var r = safe(function () { return h(id); }); if (r === false) okAll = false; }); return okAll; }
    function settle(it) { // начислить и (для расходуемых) потребить
      if (products[it.id] && products[it.id].consumable) { if (!grant(it.id)) return Promise.resolve(false); return Promise.resolve().then(function () { return be.payConsume(it); }).then(function () { return true; }, function (e) { P.errors.push('consume: ' + (e && e.message || e)); return true; }); }
      var was = owned[it.id]; owned[it.id] = true; if (!was) grant(it.id); return Promise.resolve(true);
    }
    function restore() {
      if (restoreP) return restoreP;
      restoreP = after(function () { if (!be.pay) return false;
        return be.payList().then(function (l) { var chain = Promise.resolve(); (l || []).forEach(function (it) { chain = chain.then(function () { return settle(it); }); }); return chain.then(function () { return true; }); }); }, false);
      return restoreP;
    }
    var PAY = P.payments = {
      available: false,
      setup: function (map) { Object.keys(map || {}).forEach(function (id) { products[id] = Object.assign({ consumable: false }, products[id] || {}, map[id] || {}); }); return restore(); },
      ready: function () { return restore(); },
      catalog: function () { if (!catalogP) catalogP = after(function () { return be.pay ? be.payCatalog() : []; }, []).then(function (l) { if (!l.length) catalogP = null; return l; }); return catalogP; },
      purchase: function (id, payload) {
        if (!P.inited || !be.pay || adBusy) return Promise.resolve(false);
        if (owned[id] && !(products[id] && products[id].consumable)) return Promise.resolve(true);
        return dialog(function () { return be.payBuy(id, payload); }).then(function (it) { return it ? settle({ id: it.id || id, token: it.token }) : false; },
          function (e) { P.errors.push('purchase: ' + (e && (e.code || e.message) || e)); return false; });
      },
      owned: function (id) { return !!owned[id]; },
      onPurchase: function (fn) { payHooks.push(fn); return function () { var i = payHooks.indexOf(fn); if (i >= 0) payHooks.splice(i, 1); }; }
    };

    P.games = {
      available: false, native: false,
      list: function () { return after(function () { return be.games ? be.gamesList() : { games: [], developerURL: null }; }, { games: [], developerURL: null }); },
      open: function (g) { return !!(P.inited && be.games && safe(function () { return be.gamesOpen(g); })); }
    };
    P.sticky = {
      showing: false,
      show: function () { return after(function () { return P.hasAds ? be.sticky(true) : false; }, false).then(function (r) { P.sticky.showing = !!r; return !!r; }); },
      hide: function () { return after(function () { return be.sticky(false); }, false).then(function (r) { if (r) P.sticky.showing = false; return !!r; }); }
    };
    P._pause = pause; P._resume = resume; // для тестов и ручной проверки
    return P;
  }

  var Platform = create();
  Platform.create = create;
  global.ArcadePlatform = { create: create, version: VERSION };
  global.Platform = Platform;
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ArcadePlatform;
})(typeof window !== 'undefined' ? window : globalThis);
