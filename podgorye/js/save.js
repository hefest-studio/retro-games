/* ПОДГОРЬЕ · save.js — три слота сохранений в localStorage, версия формата и миграции, рекорды.
   Ключи: arcade.podgorye.slot1..3 (JSON, v = SAVE_VERSION), arcade.besttime.podgorye (с), arcade.bestpct.podgorye (%).
   Старый формат v1 (один слот, ключ arcade.save.podgorye) при первом запуске переносится в свободный слот и удаляется.
   SV.migrate(obj) — любой известный формат → текущий; неизвестное/битое → null. store — { get(k,d), set(k,v), remove(k) }. */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};
  var VERSION = 2, SLOTS = 3, LEGACY = 'arcade.save.podgorye', TKEY = 'arcade.besttime.podgorye', PKEY = 'arcade.bestpct.podgorye';
  P.SAVE_VERSION = VERSION;
  function key(i) { return 'arcade.podgorye.slot' + i; }
  function defStore() {
    return {
      get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
      set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
      remove: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
    };
  }
  // v1: { version:1, abilities:{boots:true,…}, got:[id…], beaten:[boss…], lit:[forge…], seen:[room…], anvil, hp, cells, playTime }
  function fromV1(o) {
    var ab = []; for (var k in (o.abilities || {})) if (o.abilities[k]) ab.push(k);
    var vis = []; (o.seen || []).forEach(function (r) { vis[r] = 1; });
    return { v: 2, time: +o.playTime || 0, deaths: +o.deaths || 0, anvil: o.anvil | 0, hpMax: +o.hp || 5, tanks: +o.cells || 2, ab: ab,
      items: (o.got || []).slice(), forges: (o.lit || []).slice(), bosses: (o.beaten || []).slice(), opened: (o.broken || []).slice(), lifts: (o.lifts || []).slice(),
      ups: (o.upgrades || []).slice(), visited: vis, pct: +o.percent || 0, zone: 0 };
  }
  function valid(o) { return o && o.v === VERSION && Array.isArray(o.ab) && Array.isArray(o.items) && typeof o.anvil === 'number'; }
  function migrate(o) {
    if (!o || typeof o !== 'object') return null;
    if (o.v === VERSION) return valid(o) ? o : null;
    if (o.version === 1) { var m = fromV1(o); return valid(m) ? m : null; }
    return null;
  }
  function load(i, store) {
    store = store || defStore();
    var raw = store.get(key(i), null); if (!raw) return null;
    var o; try { o = JSON.parse(raw); } catch (e) { return null; }
    var m = migrate(o);
    if (m && o.v !== VERSION) store.set(key(i), JSON.stringify(m));   // записали в новом формате
    return m;
  }
  function save(i, data, store) { (store || defStore()).set(key(i), JSON.stringify(data)); }
  function clear(i, store) { (store || defStore()).remove(key(i)); }
  function list(store) { var out = []; for (var i = 1; i <= SLOTS; i++) out.push(load(i, store)); return out; }
  // перенос старого единственного слота
  function legacy(store) {
    store = store || defStore();
    var raw = store.get(LEGACY, null); if (!raw) return -1;
    var o; try { o = JSON.parse(raw); } catch (e) { store.remove(LEGACY); return -1; }
    var m = migrate(o); if (!m) { store.remove(LEGACY); return -1; }
    for (var i = 1; i <= SLOTS; i++) if (!store.get(key(i), null)) { save(i, m, store); store.remove(LEGACY); return i; }
    return -1;   // все слоты заняты — старый ключ оставляем
  }
  function records(store) { store = store || defStore(); var t = parseFloat(store.get(TKEY, '0')), p = parseInt(store.get(PKEY, '0'), 10); return { time: t > 0 ? t : null, pct: p > 0 ? p : 0 }; }
  function record(time, pct, store) {
    store = store || defStore(); var r = records(store), nt = false, np = false;
    if (!r.time || time < r.time) { store.set(TKEY, String(Math.round(time))); nt = true; }
    if (pct > r.pct) { store.set(PKEY, String(pct)); np = true; }
    return { time: nt, pct: np };
  }
  P.SV = { VERSION: VERSION, SLOTS: SLOTS, key: key, LEGACY: LEGACY, migrate: migrate, load: load, save: save, clear: clear, list: list, legacy: legacy, records: records, record: record, fromV1: fromV1 };
})(typeof window !== 'undefined' ? window : globalThis);
