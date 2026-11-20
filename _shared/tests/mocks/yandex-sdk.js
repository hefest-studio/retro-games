/* Мок Yandex Games SDK v2 для тестов _shared/platform.js (НЕ настоящий SDK; в сборки не попадает).
   Подменяет /sdk.js: window.YaGames.init() → ysdk с features.LoadingAPI/GameplayAPI, adv.showFullscreenAdv/showRewardedVideo,
   on/off('game_api_pause'|'game_api_resume'), getPlayer() → getData/setData, environment.i18n.lang.
   v1.2: leaderboards.setScore/getEntries/getPlayerEntry, isAvailableMethod, getFlags({ defaultFlags }), serverTime(),
   feedback.canReview/requestReview, shortcut.canShowPrompt/showPrompt, payments.purchase/getPurchases/getCatalog/consumePurchase,
   features.GamesAPI.getAllGames, adv.showBannerAdv/hideBannerAdv — формы ответов как в документации (ссылки — _shared/PLATFORMS.md).
   Управление: window.__sdkMock = { lang, rewarded: 'ok'|'skip'|'error', fullscreen: 'ok'|'error', cloud: {...}, adMs,
     auth (true — игрок вошёл; по умолчанию true), flags: {...}, serverTime, canReview, shortcut, purchases: [{ productID, purchaseToken }],
     catalog: [...], buy: 'ok'|'cancel', noPayments, lb: { <board>: [{ score, name, id }] }, games: [...] } — до загрузки.
   Журнал вызовов: window.__sdkLog (массив строк); ysdk._fire('game_api_pause') — имитация события площадки. */
(function (w) {
  'use strict';
  var M = w.__sdkMock = w.__sdkMock || {}, log = w.__sdkLog = w.__sdkLog || [], hs = {};
  var T = function (f) { (w.setTimeout || setTimeout)(f, M.adMs == null ? 30 : M.adMs); };
  var authed = function () { return M.auth !== false; };
  var player = { getData: function (keys) { log.push('getData'); return Promise.resolve(Object.assign({}, M.cloud || {})); },
    setData: function (d, flush) { log.push('setData'); M.saved = JSON.parse(JSON.stringify(d)); return Promise.resolve(); },
    getUniqueID: function () { return 'me'; }, getMode: function () { return authed() ? '' : 'lite'; } };
  var lb = M.lb = M.lb || {}, purchases = M.purchases = M.purchases || [];
  function board(n) { if (n !== 'score' && !lb[n]) { var e = new Error('Leaderboard not found'); e.code = 404; throw e; } return lb[n] = lb[n] || []; }
  function ranked(n) { return board(n).slice().sort(function (a, b) { return b.score - a.score; }).map(function (e, i) { return { score: e.score, rank: i + 1, extraData: e.extra, player: { publicName: e.name || '', uniqueID: e.id } }; }); }
  var catalog = M.catalog || [{ id: 'no_ads', title: 'Без рекламы', description: 'Отключает рекламу', imageURI: '/no_ads.png', price: '49 YAN', priceValue: '49', priceCurrencyCode: 'YAN' },
    { id: 'coins100', title: '100 монет', description: '', imageURI: '', price: '10 YAN', priceValue: '10', priceCurrencyCode: 'YAN' }];
  catalog.forEach(function (p) { p.getPriceCurrencyImage = function (s) { return '/yan-' + (s || 'small') + '.png'; }; });
  var tok = 0, reviewed = false;
  var payments = {
    purchase: function (o) { log.push('purchase:' + o.id); return new Promise(function (res, rej) { T(function () {
      if ((M.buy || 'ok') !== 'ok') { var e = new Error('cancelled'); e.code = 'USER_CANCEL'; rej(e); return; }
      var p = { productID: o.id, purchaseToken: 't' + (++tok), developerPayload: o.developerPayload }; purchases.push(p); res(p); }); }); },
    getPurchases: function () { log.push('getPurchases'); return Promise.resolve(purchases.slice()); },
    getCatalog: function () { log.push('getCatalog'); return Promise.resolve(catalog.slice()); },
    consumePurchase: function (t) { log.push('consume:' + t); var i = purchases.findIndex(function (p) { return p.purchaseToken === t; }); if (i >= 0) purchases.splice(i, 1); return Promise.resolve(); }
  };
  var ysdk = {
    environment: { i18n: { lang: M.lang || 'ru' } },
    features: { LoadingAPI: { ready: function () { log.push('ready'); } }, GameplayAPI: { start: function () { log.push('start'); }, stop: function () { log.push('stop'); } },
      GamesAPI: { getAllGames: function () { log.push('getAllGames'); return Promise.resolve({ games: M.games || [{ appID: '100001', title: 'Отбойник', url: 'https://yandex.ru/games/app/100001', coverURL: 'https://avatars/c', iconURL: 'https://avatars/i' }], developerURL: 'https://yandex.ru/games/developer/1' }); },
        getGameByID: function (id) { return Promise.resolve({ isAvailable: true, game: { appID: String(id), title: 'X', url: 'https://yandex.ru/games/app/' + id } }); } } },
    on: function (ev, f) { (hs[ev] = hs[ev] || []).push(f); }, off: function (ev, f) { hs[ev] = (hs[ev] || []).filter(function (x) { return x !== f; }); },
    _fire: function (ev) { (hs[ev] || []).forEach(function (f) { f(); }); },
    getPlayer: function () { log.push('getPlayer'); return Promise.resolve(player); },
    isAvailableMethod: function (m) { return Promise.resolve(/^leaderboards\.(setScore|getPlayerEntry)$/.test(m) ? authed() : true); },
    leaderboards: {
      setScore: function (n, s, extra) { log.push('setScore:' + n + ':' + s); if (!authed()) return Promise.reject(new Error('NO_AUTH'));
        var b = board(n), me = b.filter(function (e) { return e.id === 'me'; })[0]; if (!me) b.push(me = { id: 'me', name: 'Я', score: s }); else me.score = s; me.extra = extra; M.lbTimes = (M.lbTimes || []).concat(Date.now()); return Promise.resolve(); },
      getEntries: function (n, o) { log.push('getEntries:' + n); var r = ranked(n), mine = r.filter(function (e) { return e.player.uniqueID === 'me'; })[0];
        return Promise.resolve({ leaderboard: { name: n }, ranges: [{ start: 0, size: Math.min(r.length, (o && o.quantityTop) || 5) }], userRank: (o && o.includeUser && mine) ? mine.rank : 0, entries: r.slice(0, (o && o.quantityTop) || 5) }); },
      getPlayerEntry: function (n) { log.push('getPlayerEntry:' + n); var mine = ranked(n).filter(function (e) { return e.player.uniqueID === 'me'; })[0];
        if (!mine) { var e = new Error('Player not present'); e.code = 'LEADERBOARD_PLAYER_NOT_PRESENT'; return Promise.reject(e); } return Promise.resolve(mine); },
      getDescription: function (n) { return Promise.resolve({ name: n, description: { sort_order: 'DESC' } }); }
    },
    getFlags: function (o) { log.push('getFlags'); return Promise.resolve(Object.assign({}, (o && o.defaultFlags) || {}, M.flags || {})); },
    serverTime: function () { return M.serverTime || 1767225600000; },
    feedback: { canReview: function () { return Promise.resolve(M.canReview === false ? { value: false, reason: 'GAME_RATED' } : reviewed ? { value: false, reason: 'REVIEW_WAS_REQUESTED' } : { value: true }); },
      requestReview: function () { log.push('requestReview'); reviewed = true; return new Promise(function (r) { T(function () { r({ feedbackSent: true }); }); }); } },
    shortcut: { canShowPrompt: function () { return Promise.resolve({ canShow: M.shortcut !== false }); },
      showPrompt: function () { log.push('showPrompt'); return Promise.resolve({ outcome: 'accepted' }); } },
    adv: {
      showFullscreenAdv: function (o) { var c = (o && o.callbacks) || {}; log.push('fullscreen');
        if (M.fullscreen === 'error') { T(function () { c.onError && c.onError(new Error('mock')); }); return; }
        c.onOpen && c.onOpen(); T(function () { c.onClose && c.onClose(true); }); },
      showRewardedVideo: function (o) { var c = (o && o.callbacks) || {}; log.push('rewarded'); var mode = M.rewarded || 'ok';
        if (mode === 'error') { T(function () { c.onError && c.onError(new Error('mock')); }); return; }
        c.onOpen && c.onOpen(); T(function () { if (mode === 'ok') c.onRewarded && c.onRewarded(); c.onClose && c.onClose(); }); },
      showBannerAdv: function () { log.push('stickyShow'); M.sticky = true; return Promise.resolve({ stickyAdvIsShowing: true }); },
      hideBannerAdv: function () { log.push('stickyHide'); M.sticky = false; return Promise.resolve({ stickyAdvIsShowing: false }); },
      getBannerAdvStatus: function () { return Promise.resolve({ stickyAdvIsShowing: !!M.sticky }); }
    }
  };
  if (!M.noPayments) ysdk.payments = payments;
  w.YaGames = { init: function () { log.push('init'); return Promise.resolve(ysdk); } };
})(typeof window !== 'undefined' ? window : globalThis);
