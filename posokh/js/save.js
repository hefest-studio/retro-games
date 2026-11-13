/* ПОСОХ · сохранение забега (localStorage) и достижения.
   arcade.save.posokh — JSON v1: { v:1, cleared:{exp:1}, keys:{exp:1} (Ключи Звездочёта), items:{gear:1,…} (предметы-отмычки),
     relics:{astro:1,lens:1}, taken:{exp:[id…]} (что уже взято в экспедиции — не появляется снова), bank (казна, монет),
     lives, at (на какую экспедицию повёрнут глобус) }. Конец игры (жизни кончились) или финал — сохранение стирается,
     рекорд остаётся (arcade.best.posokh, движок). arcade.ach.posokh — { trueEnd:1, ends:N } (не стирается). */
(function (global) {
  'use strict';
  var PS = global.POSOKH = global.POSOKH || {};
  var KEY = 'arcade.save.posokh', ACH = 'arcade.ach.posokh', VER = 1;
  function exps() { return PS.levels ? PS.levels.ids : []; }
  function blank() { return { v: VER, cleared: {}, keys: {}, items: {}, relics: {}, taken: {}, bank: 0, lives: 3, at: 'mine' }; }
  function setOf(src, ok) { var o = {}; if (src && typeof src === 'object') for (var k in src) if (src[k] && ok.indexOf(k) >= 0) o[k] = 1; return o; }
  function migrate(o) {
    if (!o || typeof o !== 'object' || (o.v | 0) !== VER) return null;
    var E = exps(), p = blank();
    p.cleared = setOf(o.cleared, E); p.keys = setOf(o.keys, E);
    p.items = setOf(o.items, PS.levels ? PS.levels.ITEMS : []); p.relics = setOf(o.relics, PS.levels ? PS.levels.RELICS : []);
    if (o.taken && typeof o.taken === 'object') E.forEach(function (e) { if (Array.isArray(o.taken[e])) p.taken[e] = o.taken[e].filter(function (x) { return typeof x === 'number' || typeof x === 'string'; }).slice(0, 200); });
    p.bank = Math.max(0, Math.floor(+o.bank || 0));
    p.lives = Math.max(1, Math.min(9, (o.lives | 0) || 3));
    p.at = E.indexOf(o.at) >= 0 || o.at === 'obs' ? o.at : 'mine';
    return p;
  }
  function parse(raw) { if (!raw) return null; try { return migrate(JSON.parse(raw)); } catch (e) { return null; } }
  function serialize(p) { return JSON.stringify({ v: VER, cleared: p.cleared, keys: p.keys, items: p.items, relics: p.relics, taken: p.taken, bank: p.bank, lives: p.lives, at: p.at }); }
  function store(ls) {
    function get(k) { try { return ls.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { ls.setItem(k, v); } catch (e) {} }
    function del(k) { try { if (ls.removeItem) ls.removeItem(k); } catch (e) {} }
    return {
      has: function () { return !!parse(get(KEY)); },
      load: function () { return parse(get(KEY)) || blank(); },
      save: function (p) { set(KEY, serialize(p)); },
      wipe: function () { del(KEY); return blank(); },
      ach: function () { try { var a = JSON.parse(get(ACH) || '{}'); return a && typeof a === 'object' ? a : {}; } catch (e) { return {}; } },
      setAch: function (a) { set(ACH, JSON.stringify(a)); }
    };
  }
  // итог экспедиции (победа или отступление) → прогресс
  function apply(p, res) {
    var id = res.id;
    if (res.won) { p.cleared[id] = 1; if (res.key) p.keys[id] = 1; }
    if (res.item) p.items[res.item] = 1;
    if (res.relic) p.relics[res.relic] = 1;
    var t = p.taken[id] || []; (res.taken || []).forEach(function (x) { if (t.indexOf(x) < 0) t.push(x); }); p.taken[id] = t;
    p.bank += Math.max(0, res.bag | 0);
    if (res.lives != null) p.lives = Math.max(1, res.lives);
    p.at = id;
    return p;
  }
  function keyCount(p) { var n = 0; for (var k in p.keys) n++; return n; }
  function allKeys(p) { return keyCount(p) >= exps().length; }
  function trueEnd(p) { return (PS.levels ? PS.levels.RELICS : []).every(function (r) { return p.relics[r]; }); }
  PS.save = { KEY: KEY, ACH: ACH, VER: VER, blank: blank, migrate: migrate, parse: parse, serialize: serialize, store: store, apply: apply, keyCount: keyCount, allKeys: allKeys, trueEnd: trueEnd };
})(typeof window !== 'undefined' ? window : globalThis);
