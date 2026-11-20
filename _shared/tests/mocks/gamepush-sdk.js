/* Мок GamePush SDK для тестов _shared/platform.js (НЕ настоящий SDK; в сборки не попадает).
   Вызывает window[callback](gp) (по умолчанию onGPInit), как загрузчик GamePush. gp: player.ready/get/set/sync, gameStart,
   gameplayStart/Stop, ads.showFullscreen/showRewardedVideo → Promise, ads.on('start'|'close'), on('pause'|'resume'),
   language, platform.isExternalLinksAllowed.
   v1.2: leaderboard.fetch/fetchPlayerRating/open, variables.fetch/has/get, serverTime (ISO), app.canRequestReview/requestReview,
   app.canAddShortcut/addShortcut, payments.isAvailable/products/purchases/purchase/consume/has, gamesCollections.fetch/open,
   ads.showSticky/closeSticky — формы ответов как в документации (ссылки — _shared/PLATFORMS.md).
   Управление: window.__sdkMock = { lang, rewarded: 'ok'|'skip', links, cloud: 'строка JSON', adMs, vars: {...}, serverTime: 'ISO',
     purchases: [{ productId }], buy: 'ok'|'cancel', noPayments, top: [{ id, name, score }] }.
   Журнал: window.__sdkLog; gp._fire('pause'). */
(function (w) {
  'use strict';
  var M = w.__sdkMock = w.__sdkMock || {}, log = w.__sdkLog = w.__sdkLog || [], hs = {}, ah = {}, fields = {};
  if (M.cloud) fields[M.field || 'arcade_save'] = M.cloud;
  var T = function (f) { (w.setTimeout || setTimeout)(f, M.adMs == null ? 30 : M.adMs); };
  function fire(map, ev, a) { (map[ev] || []).forEach(function (f) { f(a); }); }
  var products = [{ id: 501, tag: 'no_ads', name: 'Без рекламы', description: '', icon: '', price: 49, currency: 'YAN', currencySymbol: 'ян' },
    { id: 502, tag: 'coins100', name: '100 монет', description: '', icon: '', price: 10, currency: 'YAN', currencySymbol: 'ян' }];
  var purchases = M.purchases = M.purchases || [];
  var byTag = function (t) { return products.filter(function (p) { return p.tag === t || p.id === t; })[0]; };
  var vars = M.vars || {};
  var reviewed = false;
  var gp = {
    language: M.lang || 'en', platform: { type: 'MOCK', isExternalLinksAllowed: !!M.links },
    serverTime: M.serverTime || '2026-01-01T00:00:00.000Z',
    on: function (ev, f) { (hs[ev] = hs[ev] || []).push(f); }, _fire: function (ev) { fire(hs, ev); },
    gameStart: function () { log.push('ready'); }, gameplayStart: function () { log.push('start'); }, gameplayStop: function () { log.push('stop'); },
    player: { id: 7, ready: Promise.resolve(), get: function (k) { return fields[k] || ''; }, set: function (k, v) { fields[k] = v; log.push('set' + (k === 'score' ? ':score:' + v : '')); if (k !== 'score') M.saved = v; },
      sync: function () { log.push('sync'); return Promise.resolve(true); } },
    leaderboard: {
      fetch: function (o) { log.push('lbFetch'); var b = o.orderBy[0], all = (M.top || [{ id: 1, name: 'Ая', score: 900 }, { id: 2, name: 'Бо', score: 500 }]).slice();
        if (+fields[b]) all.push({ id: 7, name: 'Я', score: +fields[b] }); all.sort(function (a, c) { return c.score - a.score; });
        var ps = all.map(function (p, i) { var x = { id: p.id, name: p.name, avatar: '', position: i + 1 }; x[b] = p.score; return x; });
        var mine = ps.filter(function (p) { return p.id === 7; })[0];
        return Promise.resolve({ players: ps.slice(0, o.limit || 10), topPlayers: ps.slice(0, o.limit || 10), fields: [], player: o.withMe !== 'none' ? mine : undefined, abovePlayers: [], belowPlayers: [] }); },
      fetchPlayerRating: function (o) { log.push('lbRating'); return gp.leaderboard.fetch({ orderBy: o.orderBy, limit: 100, withMe: 'last' }).then(function (r) { return { player: r.player || { id: 7, position: 0 }, fields: [], abovePlayers: [], belowPlayers: [] }; }); },
      open: function (o) { log.push('lbOpen'); }
    },
    variables: { fetch: function () { log.push('varsFetch'); return Promise.resolve(); }, has: function (k) { return vars[k] != null && vars[k] !== ''; }, get: function (k) { return vars[k]; }, type: function () { return 'data'; } },
    app: { get canRequestReview() { return !reviewed; }, isAlreadyReviewed: false,
      requestReview: function () { log.push('requestReview'); reviewed = true; return Promise.resolve({ success: true, rating: 5 }); },
      canAddShortcut: true, addShortcut: function () { log.push('addShortcut'); return Promise.resolve(true); } },
    payments: { isAvailable: !M.noPayments, products: products, purchases: purchases,
      has: function (t) { var p = byTag(t); return !!(p && purchases.some(function (x) { return x.productId === p.id; })); },
      purchase: function (o) { log.push('purchase:' + o.tag); var p = byTag(o.tag); return new Promise(function (res, rej) { T(function () {
        if ((M.buy || 'ok') !== 'ok' || !p) { rej(new Error('player_cancelled')); return; } var pu = { productId: p.id, payload: o.payload }; purchases.push(pu); res({ product: p, purchase: pu }); }); }); },
      consume: function (o) { log.push('consume:' + o.tag); var p = byTag(o.tag), i = purchases.findIndex(function (x) { return x.productId === p.id; }); var pu = purchases[i]; if (i >= 0) purchases.splice(i, 1); return Promise.resolve({ product: p, purchase: pu }); } },
    gamesCollections: { fetch: function (o) { log.push('gcFetch'); return Promise.resolve({ id: 1, tag: 'ALL', name: 'All', description: '', games: [{ id: 11, name: 'Отбойник', description: '', icon: '', url: 'https://example.invalid/g/11' }] }); },
      open: function (o) { log.push('gcOpen'); } },
    ads: { on: function (ev, f) { (ah[ev] = ah[ev] || []).push(f); }, isStickyAvailable: true,
      showSticky: function () { log.push('stickyShow'); M.sticky = true; }, closeSticky: function () { log.push('stickyHide'); M.sticky = false; },
      showFullscreen: function () { log.push('fullscreen'); fire(ah, 'start'); return new Promise(function (r) { T(function () { fire(ah, 'close', true); r(true); }); }); },
      showRewardedVideo: function () { log.push('rewarded'); fire(ah, 'start'); var ok = (M.rewarded || 'ok') === 'ok'; return new Promise(function (r) { T(function () { fire(ah, 'close', ok); r(ok); }); }); } }
  };
  var cb = 'onGPInit';
  try { var s = w.document && w.document.currentScript; var m = s && /[?&]callback=([A-Za-z_$][\w$]*)/.exec(s.src || ''); if (m) cb = m[1]; } catch (e) {}
  if (M.callbackName) cb = M.callbackName;
  (w.setTimeout || setTimeout)(function () { log.push('init'); if (typeof w[cb] === 'function') w[cb](gp); }, 5);
})(typeof window !== 'undefined' ? window : globalThis);
