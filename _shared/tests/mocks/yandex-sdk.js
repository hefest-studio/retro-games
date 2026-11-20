/* Мок Yandex Games SDK v2 для тестов _shared/platform.js (НЕ настоящий SDK; в сборки не попадает).
   Подменяет /sdk.js: window.YaGames.init() → ysdk с features.LoadingAPI/GameplayAPI, adv.showFullscreenAdv/showRewardedVideo,
   on/off('game_api_pause'|'game_api_resume'), getPlayer() → getData/setData, environment.i18n.lang.
   Управление: window.__sdkMock = { lang, rewarded: 'ok'|'skip'|'error', fullscreen: 'ok'|'error', cloud: {...}, adMs } — до загрузки.
   Журнал вызовов: window.__sdkLog (массив строк); ysdk._fire('game_api_pause') — имитация события площадки. */
(function (w) {
  'use strict';
  var M = w.__sdkMock = w.__sdkMock || {}, log = w.__sdkLog = w.__sdkLog || [], hs = {};
  var T = function (f) { (w.setTimeout || setTimeout)(f, M.adMs == null ? 30 : M.adMs); };
  var player = { getData: function (keys) { log.push('getData'); return Promise.resolve(Object.assign({}, M.cloud || {})); },
    setData: function (d, flush) { log.push('setData'); M.saved = JSON.parse(JSON.stringify(d)); return Promise.resolve(); } };
  var ysdk = {
    environment: { i18n: { lang: M.lang || 'ru' } },
    features: { LoadingAPI: { ready: function () { log.push('ready'); } }, GameplayAPI: { start: function () { log.push('start'); }, stop: function () { log.push('stop'); } } },
    on: function (ev, f) { (hs[ev] = hs[ev] || []).push(f); }, off: function (ev, f) { hs[ev] = (hs[ev] || []).filter(function (x) { return x !== f; }); },
    _fire: function (ev) { (hs[ev] || []).forEach(function (f) { f(); }); },
    getPlayer: function () { log.push('getPlayer'); return Promise.resolve(player); },
    adv: {
      showFullscreenAdv: function (o) { var c = (o && o.callbacks) || {}; log.push('fullscreen');
        if (M.fullscreen === 'error') { T(function () { c.onError && c.onError(new Error('mock')); }); return; }
        c.onOpen && c.onOpen(); T(function () { c.onClose && c.onClose(true); }); },
      showRewardedVideo: function (o) { var c = (o && o.callbacks) || {}; log.push('rewarded'); var mode = M.rewarded || 'ok';
        if (mode === 'error') { T(function () { c.onError && c.onError(new Error('mock')); }); return; }
        c.onOpen && c.onOpen(); T(function () { if (mode === 'ok') c.onRewarded && c.onRewarded(); c.onClose && c.onClose(); }); }
    }
  };
  w.YaGames = { init: function () { log.push('init'); return Promise.resolve(ysdk); } };
})(typeof window !== 'undefined' ? window : globalThis);
