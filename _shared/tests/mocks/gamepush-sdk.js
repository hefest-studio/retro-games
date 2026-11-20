/* Мок GamePush SDK для тестов _shared/platform.js (НЕ настоящий SDK; в сборки не попадает).
   Вызывает window[callback](gp) (по умолчанию onGPInit), как загрузчик GamePush. gp: player.ready/get/set/sync, gameStart,
   gameplayStart/Stop, ads.showFullscreen/showRewardedVideo → Promise, ads.on('start'|'close'), on('pause'|'resume'),
   language, platform.isExternalLinksAllowed. Управление: window.__sdkMock = { lang, rewarded: 'ok'|'skip', links, cloud: 'строка JSON', adMs }.
   Журнал: window.__sdkLog; gp._fire('pause'). */
(function (w) {
  'use strict';
  var M = w.__sdkMock = w.__sdkMock || {}, log = w.__sdkLog = w.__sdkLog || [], hs = {}, ah = {}, fields = {};
  if (M.cloud) fields[M.field || 'arcade_save'] = M.cloud;
  var T = function (f) { (w.setTimeout || setTimeout)(f, M.adMs == null ? 30 : M.adMs); };
  function fire(map, ev, a) { (map[ev] || []).forEach(function (f) { f(a); }); }
  var gp = {
    language: M.lang || 'en', platform: { type: 'MOCK', isExternalLinksAllowed: !!M.links },
    on: function (ev, f) { (hs[ev] = hs[ev] || []).push(f); }, _fire: function (ev) { fire(hs, ev); },
    gameStart: function () { log.push('ready'); }, gameplayStart: function () { log.push('start'); }, gameplayStop: function () { log.push('stop'); },
    player: { ready: Promise.resolve(), get: function (k) { return fields[k] || ''; }, set: function (k, v) { fields[k] = v; log.push('set'); M.saved = v; },
      sync: function () { log.push('sync'); return Promise.resolve(true); } },
    ads: { on: function (ev, f) { (ah[ev] = ah[ev] || []).push(f); },
      showFullscreen: function () { log.push('fullscreen'); fire(ah, 'start'); return new Promise(function (r) { T(function () { fire(ah, 'close', true); r(true); }); }); },
      showRewardedVideo: function () { log.push('rewarded'); fire(ah, 'start'); var ok = (M.rewarded || 'ok') === 'ok'; return new Promise(function (r) { T(function () { fire(ah, 'close', ok); r(ok); }); }); } }
  };
  var cb = 'onGPInit';
  try { var s = w.document && w.document.currentScript; var m = s && /[?&]callback=([A-Za-z_$][\w$]*)/.exec(s.src || ''); if (m) cb = m[1]; } catch (e) {}
  if (M.callbackName) cb = M.callbackName;
  (w.setTimeout || setTimeout)(function () { log.push('init'); if (typeof w[cb] === 'function') w[cb](gp); }, 5);
})(typeof window !== 'undefined' ? window : globalThis);
