/* ОРУЖЕЙНИК · прогресс: формат сохранения (localStorage), миграция старых версий и пароль.
   Сохранение — ключ arcade.save.oruzheynik, JSON { v:1, beaten:[8×bool], tanks:0..4, fort:0..3, tankGot:{} }.
   v0 — формат черновой сборки (без поля v, ярусов крепости было 4: fort 0..4) — читается и переписывается в v1.
   Пароль — 6 цифр 1..8: 8 бит побед + 3 бита фляг + 2 бита ярусов крепости + 5 бит контрольной суммы, перемешано. */
(function (global) {
  'use strict';
  var OZ = global.ORUZH = global.ORUZH || {};
  var KEY = 'arcade.save.oruzheynik', VER = 1, MAX_TANKS = 4, FORTS = 3;

  function blank() { return { v: VER, beaten: [false, false, false, false, false, false, false, false], tanks: 0, fort: 0, tankGot: {} }; }
  function clamp(n, a, b) { n = n | 0; return n < a ? a : n > b ? b : n; }
  // любая версия → v1 (или null, если данные негодны)
  function migrate(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.beaten) || o.beaten.length !== 8) return null;
    var v = o.v == null ? 0 : o.v | 0;
    if (v > VER) return null;
    var p = blank();
    p.beaten = o.beaten.map(Boolean);
    p.tanks = clamp(o.tanks, 0, MAX_TANKS);
    // v0: крепость из 4 ярусов (последний — отдельный финал); теперь финал — часть 3-го яруса
    p.fort = clamp(o.fort, 0, v === 0 ? 4 : FORTS); if (p.fort > FORTS) p.fort = FORTS;
    p.tankGot = o.tankGot && typeof o.tankGot === 'object' && !Array.isArray(o.tankGot) ? Object.assign({}, o.tankGot) : {};
    if (!p.beaten.every(Boolean)) p.fort = 0;     // ярусы крепости без всех трофеев невозможны
    return p;
  }
  function parse(raw) { if (!raw) return blank(); try { return migrate(JSON.parse(raw)) || blank(); } catch (e) { return blank(); } }
  function serialize(p) { return JSON.stringify({ v: VER, beaten: p.beaten.map(Boolean), tanks: p.tanks | 0, fort: p.fort | 0, tankGot: p.tankGot || {} }); }
  // хранилище поверх localStorage (или любого {getItem,setItem}); при чтении старой версии — сразу переписывает в новую
  function store(ls) {
    return {
      get: function () {
        var raw = null; try { raw = ls.getItem(KEY); } catch (e) {}
        if (raw) { try { var o = JSON.parse(raw); if (o && (o.v == null || o.v < VER)) { var p = migrate(o); if (p) { try { ls.setItem(KEY, serialize(p)); } catch (e) {} return serialize(p); } } } catch (e) {} }
        return raw;
      },
      set: function (s) { try { ls.setItem(KEY, s); } catch (e) {} }
    };
  }

  // ---------- пароль ----------
  function chk(v) { return ((v * 37 + 11) ^ (v >> 5) ^ (v >> 9)) & 31; }
  function encode(p) {
    var bits = 0, i;
    for (i = 0; i < 8; i++) if (p.beaten[i]) bits |= 1 << i;
    bits |= clamp(p.tanks, 0, MAX_TANKS) << 8;
    bits |= (p.beaten.every(Boolean) ? clamp(p.fort, 0, FORTS) : 0) << 11;
    var all = bits | (chk(bits) << 13), out = '';
    for (i = 0; i < 6; i++) { var d = (all >> (i * 3)) & 7; out += String(((d + i * 3 + 5) % 8) + 1); }
    return out;
  }
  function decode(code) {
    code = String(code || '').replace(/\D/g, '');
    if (!/^[1-8]{6}$/.test(code)) return null;
    var all = 0, i;
    for (i = 0; i < 6; i++) { var d = ((+code[i] - 1) - i * 3 - 5) % 8; if (d < 0) d += 8; all |= d << (i * 3); }
    var bits = all & 8191;
    if (((all >> 13) & 31) !== chk(bits)) return null;
    var p = blank();
    for (i = 0; i < 8; i++) p.beaten[i] = !!(bits & (1 << i));
    p.tanks = (bits >> 8) & 7; p.fort = (bits >> 11) & 3;
    if (p.tanks > MAX_TANKS || p.fort > FORTS) return null;
    if (p.fort && !p.beaten.every(Boolean)) return null;
    return p;
  }
  OZ.save = { KEY: KEY, VER: VER, blank: blank, migrate: migrate, parse: parse, serialize: serialize, store: store, encode: encode, decode: decode };
})(typeof window !== 'undefined' ? window : globalThis);
