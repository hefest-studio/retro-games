/* ЛЕДНИК · прогресс карты мира (localStorage) и миграция старых форматов.
   Ключ arcade.save.lednik, JSON v2: { v:2, cleared:{id:1}, full:{id:1}, keys:{k1:1}, at:'1-1' }
     cleared — пройденные уровни, full — собраны все припасы (100%), keys — найденные ключи секретных троп, at — где стоит Искра.
   v1 — формат черновой сборки: { v:1, done:[id], stars:[id], keys:[k], node:id } — читается и переписывается в v2.
   Черновой ключ arcade.lednik.map (тот же v1) — при первом чтении переносится в новый ключ и удаляется. */
(function (global) {
  'use strict';
  var LD = global.LEDNIK = global.LEDNIK || {};
  var KEY = 'arcade.save.lednik', OLD = 'arcade.lednik.map', VER = 2;
  var KEYS = ['k1', 'k2', 'k3'];
  function ids() { return LD.levels ? LD.levels.ids : []; }
  function blank() { return { v: VER, cleared: {}, full: {}, keys: {}, at: '1-1' }; }
  function setOf(list, ok) { var o = {}; (list || []).forEach(function (x) { if (ok.indexOf(x) >= 0) o[x] = 1; }); return o; }
  function objOf(src, ok) { var o = {}; if (src && typeof src === 'object') for (var k in src) if (src[k] && ok.indexOf(k) >= 0) o[k] = 1; return o; }
  // любая версия → v2 (или null, если данные негодны)
  function migrate(o) {
    if (!o || typeof o !== 'object') return null;
    var v = o.v | 0, p = blank(), L = ids();
    if (v > VER) return null;
    if (v === 1) {
      if (!Array.isArray(o.done)) return null;
      p.cleared = setOf(o.done, L); p.full = setOf(o.stars, L); p.keys = setOf(o.keys, KEYS); p.at = o.node;
    } else if (v === 2) {
      p.cleared = objOf(o.cleared, L); p.full = objOf(o.full, L); p.keys = objOf(o.keys, KEYS); p.at = o.at;
    } else return null;
    for (var f in p.full) if (!p.cleared[f]) delete p.full[f];
    if (typeof p.at !== 'string' || L.indexOf(p.at) < 0 || (LD.MAP && !LD.MAP.isOpen(p, p.at))) p.at = '1-1';
    return p;
  }
  function parse(raw) { if (!raw) return blank(); try { return migrate(JSON.parse(raw)) || blank(); } catch (e) { return blank(); } }
  function serialize(p) { return JSON.stringify({ v: VER, cleared: p.cleared, full: p.full, keys: p.keys, at: p.at }); }
  // хранилище поверх localStorage (или любого {getItem,setItem,removeItem})
  function store(ls) {
    function get(k) { try { return ls.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { ls.setItem(k, v); } catch (e) {} }
    function del(k) { try { if (ls.removeItem) ls.removeItem(k); } catch (e) {} }
    return {
      load: function () {
        var raw = get(KEY), old = get(OLD);
        if (!raw && old) { var po = parse(old); set(KEY, serialize(po)); del(OLD); return po; }
        if (old) del(OLD);
        var p = parse(raw);
        if (raw) { try { var o = JSON.parse(raw); if (o && (o.v | 0) < VER) set(KEY, serialize(p)); } catch (e) {} }
        return p;
      },
      save: function (p) { set(KEY, serialize(p)); },
      reset: function () { set(KEY, serialize(blank())); return blank(); }
    };
  }
  // итог уровня → прогресс
  function apply(p, id, res) {
    p.cleared[id] = 1;
    if (res && res.full) p.full[id] = 1;
    if (res && res.key) p.keys[res.key] = 1;
    return p;
  }
  function stats(p) { var c = 0, f = 0, k = 0, x; for (x in p.cleared) c++; for (x in p.full) f++; for (x in p.keys) k++; return { cleared: c, full: f, keys: k }; }
  LD.save = { KEY: KEY, OLD: OLD, VER: VER, blank: blank, migrate: migrate, parse: parse, serialize: serialize, store: store, apply: apply, stats: stats };
})(typeof window !== 'undefined' ? window : globalThis);
