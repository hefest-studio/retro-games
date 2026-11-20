/*! Гефест Arcade · platform.js — единый адаптер игровых площадок (Яндекс Игры, GamePush, свой сайт). v1.1.0
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
 *   Platform.leaderboard                  заготовка: { available:false, submit(name, score) → Promise<false>, open() }
 *   ArcadePlatform.create(env)            отдельный экземпляр (тесты: env.win, env.doc, env.now, env.storage,
 *                                         env.setTimeout, env.loadScript, env.config)
 * Документ: _shared/PLATFORMS.md. Тесты: node _shared/tests/platform.test.mjs.
 */
(function (global) {
  'use strict';
  var VERSION = '1.1.0', NAMES = { web: 1, yandex: 1, gamepush: 1 };
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
        cloudLoad: function () { return Promise.resolve(null); }, cloudSave: function () { return Promise.resolve(false); }, lang: function () { return null; } };
    };
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
        lang: function () { return safe(function () { return ysdk && ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang; }) || null; }
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
        lang: function () { return safe(function () { return gp && gp.language; }) || null; }
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
    // Лидерборд — заготовка: методы площадок не подключены (их API сверить с документацией перед включением)
    P.leaderboard = { available: false, submit: function () { return Promise.resolve(false); }, open: function () { return false; } };
    P._pause = pause; P._resume = resume; // для тестов и ручной проверки
    return P;
  }

  var Platform = create();
  Platform.create = create;
  global.ArcadePlatform = { create: create, version: VERSION };
  global.Platform = Platform;
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ArcadePlatform;
})(typeof window !== 'undefined' ? window : globalThis);
