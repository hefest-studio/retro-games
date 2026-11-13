/* СКОК · сохранение прогресса (localStorage) и миграция старых форматов.
   Ключ arcade.save.skok, JSON v2:
     { v:2, cleared:{id:1}, secret:{id:1}, played:{id:1}, wand:{1:{at,dead},…}, at, lives, nuts, suit, suitHp, score }
     cleared — пройденные уровни, secret — уровни, пройденные через тайную дверь (открыта тайная тропа),
     played — сыгранные мини-игры (лавка-лотерея S, «угадай рычаг» R), wand — бродяги краёв (где стоит, побеждён ли),
     at — узел, где стоит Скок; lives/nuts/suit/score — запас между уровнями.
   v1 — формат черновой сборки: { v:1, done:[id], doors:[id], node, lives, nuts } — читается и переписывается в v2.
   Черновой ключ arcade.skok.map (тот же v1) — при первом чтении переносится в новый ключ и удаляется. */
(function (global) {
  'use strict';
  var SK = global.SKOK = global.SKOK || {};
  var KEY = 'arcade.save.skok', OLD = 'arcade.skok.map', VER = 2, LIVES = 5;
  var SUITS = ['apron', 'wings', 'armor', 'boots'];
  function levelIds() { return SK.levels ? SK.levels.ids.filter(function (id) { return !/-A$/.test(id); }) : []; }
  function gameIds() { return SK.MAP ? SK.MAP.NODES.filter(function (n) { return n.kind === 'shop' || n.kind === 'lever'; }).map(function (n) { return n.id; }) : []; }
  function nodeIds() { return SK.MAP ? SK.MAP.NODES.map(function (n) { return n.id; }) : []; }
  function blankWand() { var w = {}; for (var r = 1; r <= 4; r++) w[r] = { at: r + '-3', dead: 0 }; return w; }
  function blank() { return { v: VER, cleared: {}, secret: {}, played: {}, wand: blankWand(), at: '1-1', lives: LIVES, nuts: 0, suit: null, suitHp: 1, score: 0 }; }
  function setOf(list, ok) { var o = {}; (list || []).forEach(function (x) { if (ok.indexOf(x) >= 0) o[x] = 1; }); return o; }
  function objOf(src, ok) { var o = {}; if (src && typeof src === 'object') for (var k in src) if (src[k] && ok.indexOf(k) >= 0) o[k] = 1; return o; }
  function num(v, d, lo, hi) { v = +v; if (!isFinite(v)) return d; return Math.max(lo, Math.min(hi, Math.floor(v))); }
  // любая версия → v2 (или null, если данные негодны)
  function migrate(o) {
    if (!o || typeof o !== 'object') return null;
    var v = o.v | 0, p = blank(), L = levelIds();
    if (v > VER || v < 1) return null;
    if (v === 1) {
      if (!Array.isArray(o.done)) return null;
      p.cleared = setOf(o.done, L); p.secret = setOf(o.doors, L); p.at = o.node;
      p.lives = num(o.lives, LIVES, 1, 99); p.nuts = num(o.nuts, 0, 0, 99);
    } else {
      p.cleared = objOf(o.cleared, L); p.secret = objOf(o.secret, L); p.played = objOf(o.played, gameIds()); p.at = o.at;
      p.lives = num(o.lives, LIVES, 1, 99); p.nuts = num(o.nuts, 0, 0, 99); p.score = num(o.score, 0, 0, 1e9);
      p.suit = SUITS.indexOf(o.suit) >= 0 ? o.suit : null; p.suitHp = p.suit === 'apron' ? num(o.suitHp, 2, 1, 2) : 1;
      if (o.wand && typeof o.wand === 'object') for (var r = 1; r <= 4; r++) { var w = o.wand[r]; if (w && typeof w === 'object') p.wand[r] = { at: nodeIds().indexOf(w.at) >= 0 && w.at.charAt(0) === String(r) ? w.at : r + '-3', dead: w.dead ? 1 : 0 }; }
    }
    for (var s in p.secret) if (!p.cleared[s]) delete p.secret[s];
    if (typeof p.at !== 'string' || nodeIds().indexOf(p.at) < 0 || (SK.MAP && !SK.MAP.isOpen(p, p.at))) p.at = '1-1';
    return p;
  }
  function parse(raw) { if (!raw) return blank(); try { return migrate(JSON.parse(raw)) || blank(); } catch (e) { return blank(); } }
  function serialize(p) { return JSON.stringify({ v: VER, cleared: p.cleared, secret: p.secret, played: p.played, wand: p.wand, at: p.at, lives: p.lives, nuts: p.nuts, suit: p.suit, suitHp: p.suitHp, score: p.score }); }
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
      reset: function () { var b = blank(); set(KEY, serialize(b)); return b; }
    };
  }
  // итог уровня → прогресс
  function apply(p, id, res) {
    var lv = SK.levels && SK.levels.byId[id];
    if (lv && lv.ambush) { if (p.wand[lv.r]) p.wand[lv.r].dead = 1; return p; }
    p.cleared[id] = 1;
    if (res && res.secret) p.secret[id] = 1;
    return p;
  }
  function stats(p) { var c = 0, s = 0, w = 0, x; for (x in p.cleared) c++; for (x in p.secret) s++; for (x in p.wand) if (p.wand[x].dead) w++; return { cleared: c, secret: s, wand: w, total: levelIds().length }; }
  SK.save = { KEY: KEY, OLD: OLD, VER: VER, LIVES: LIVES, blank: blank, migrate: migrate, parse: parse, serialize: serialize, store: store, apply: apply, stats: stats };
})(typeof window !== 'undefined' ? window : globalThis);
