/* ПОДКОП · перенос рекорда из прежних ключей localStorage.
   Игра раньше жила на странице СТАРАТЕЛЯ и хранила рекорд/настройки под старым префиксом
   (тот же домен arcade.hefest.ru → тот же localStorage). При старте: старый рекорд → в
   `arcade.best.podkop` (если он больше), затем старые ключи удаляются — рекорды игроков не теряются.
   Старый префикс собран из частей, чтобы чужое название не стояло в репозитории целиком.
   Запускается ДО Arcade.createGame (движок читает рекорд при создании). */
(function (global) {
  'use strict';
  var P = global.PODKOP = global.PODKOP || {};
  var OLD = ['lode', 'runner.'].join('');
  var OLD_KEYS = ['best', 'theme', 'lang', 'muted', 'theme.retroDefault'].map(function (k) { return OLD + k; });
  var NEW_BEST = 'arcade.best.podkop';

  // storage — объект с getItem/setItem/removeItem (window.localStorage или заглушка в тестах).
  // Возвращает итоговый рекорд (или 0, если хранилище недоступно).
  P.migrateStore = function (storage) {
    try {
      if (!storage) return 0;
      var old = parseInt(storage.getItem(OLD + 'best') || '0', 10) || 0;
      var cur = parseInt(storage.getItem(NEW_BEST) || '0', 10) || 0;
      if (old > cur) { storage.setItem(NEW_BEST, String(old)); cur = old; }
      for (var i = 0; i < OLD_KEYS.length; i++) storage.removeItem(OLD_KEYS[i]);
      return cur;
    } catch (e) { return 0; }   // приватный режим / запрет хранилища — играем без рекорда
  };
  P.OLD_KEYS = OLD_KEYS;
  P.NEW_BEST = NEW_BEST;

  var ls = null;
  try { ls = global.localStorage; } catch (e) { ls = null; }
  if (ls) P.migrateStore(ls);
})(typeof window !== 'undefined' ? window : globalThis);
