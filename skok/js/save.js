/* СКОК · сохранение прогресса (localStorage) и миграция старых форматов.
   Ключ arcade.save.skok, JSON v3 (переделка 2026-11: Верстак вместо карты мира):
     { v:3, cleared:{id:звёзды 1..3}, best:{id:лучший счёт уровня}, at }
     cleared — пройденные уровни и лучшие звёзды (★ деталь, ★ все гайки и короба, ★ без единого удара), best — рекорд уровня,
     at — последний выбранный уровень. Счёт игры (рекорд, таблица лидеров) — сумма лучших результатов уровней.
   v2 (до переделки: карта с лавками и бродягами, 5 уровней + крепость в крае) → v3: пройденные уровни 1–4 и крепости краёв
   переносятся (1 звезда), 5-е уровни краёв убраны; запас жизней/гаек/костюм/лавки/бродяги — отбрасываются; migrated = true —
   main.js один раз показывает сообщение. v1 (черновик) и черновой ключ arcade.skok.map — так же через v2. */
(function (global) {
  'use strict';
  var SK = global.SKOK = global.SKOK || {};
  var KEY = 'arcade.save.skok', OLD = 'arcade.skok.map', VER = 3;
  function levelIds() { return SK.levels ? SK.levels.ids.slice() : []; }
  function blank() { return { v: VER, cleared: {}, best: {}, at: '1-1' }; }
  function num(v, d, lo, hi) { v = +v; if (!isFinite(v)) return d; return Math.max(lo, Math.min(hi, Math.floor(v))); }
  function okAt(p) { if (typeof p.at !== 'string' || levelIds().indexOf(p.at) < 0 || (SK.MAP && !SK.MAP.isOpen(p, p.at))) p.at = '1-1'; }
  // старые id (r-1..r-5, r-F) → новые (r-1..r-4, r-F); r-5 и мини-игры/стычки — нет
  function oldId(id) { return /^[1-4]-[1-4F]$/.test(id) && levelIds().indexOf(id) >= 0 ? id : null; }
  function migrate(o) {
    if (!o || typeof o !== 'object') return null;
    var v = o.v | 0, p = blank(), L = levelIds(), k;
    if (v > VER || v < 1) return null;
    if (v === 3) {
      if (o.cleared && typeof o.cleared === 'object') for (k in o.cleared) if (L.indexOf(k) >= 0 && o.cleared[k]) p.cleared[k] = num(o.cleared[k], 1, 1, 3);
      if (o.best && typeof o.best === 'object') for (k in o.best) if (L.indexOf(k) >= 0) { var b = num(o.best[k], 0, 0, 1e7); if (b) p.best[k] = b; }
      p.at = o.at; okAt(p); return p;
    }
    var done = v === 1 ? (Array.isArray(o.done) ? o.done : null) : (o.cleared && typeof o.cleared === 'object' ? Object.keys(o.cleared).filter(function (x) { return o.cleared[x]; }) : null);
    if (!done) return null;
    done.forEach(function (id) { var n = oldId(id); if (n) p.cleared[n] = 1; });
    // открытый путь без «дыр»: уровень засчитан, только если засчитаны все предыдущие (иначе прогресс до первой дыры)
    var ok = true; L.forEach(function (id) { if (!ok) delete p.cleared[id]; else if (!p.cleared[id]) ok = false; });
    p.migrated = true; p.at = '1-1'; okAt(p);
    return p;
  }
  function parse(raw) { if (!raw) return blank(); try { return migrate(JSON.parse(raw)) || blank(); } catch (e) { return blank(); } }
  function serialize(p) { return JSON.stringify({ v: VER, cleared: p.cleared, best: p.best, at: p.at }); }
  function store(ls) {
    function get(k) { try { return ls.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { ls.setItem(k, v); } catch (e) {} }
    function del(k) { try { if (ls.removeItem) ls.removeItem(k); } catch (e) {} }
    return {
      load: function () {
        var raw = get(KEY), old = get(OLD);
        if (!raw && old) { raw = old; }
        if (old) del(OLD);
        var p = parse(raw);
        if (raw) { try { var o = JSON.parse(raw); if (!o || (o.v | 0) !== VER) set(KEY, serialize(p)); } catch (e) { set(KEY, serialize(p)); } }
        return p;
      },
      save: function (p) { set(KEY, serialize(p)); },
      reset: function () { var b = blank(); set(KEY, serialize(b)); return b; }
    };
  }
  // итог уровня → прогресс; возвращает true, если улучшен рекорд уровня
  function apply(p, id, stars, score) {
    p.cleared[id] = Math.max(p.cleared[id] | 0, stars | 0 || 1);
    var nb = (score | 0) > (p.best[id] | 0); if (nb) p.best[id] = score | 0;
    return nb;
  }
  function total(p) { var s = 0; for (var k in p.best) s += p.best[k] | 0; return s; }
  function stats(p) { var c = 0, st = 0; for (var k in p.cleared) { c++; st += p.cleared[k] | 0; } return { cleared: c, stars: st, total: levelIds().length, maxStars: levelIds().length * 3 }; }
  SK.save = { KEY: KEY, OLD: OLD, VER: VER, blank: blank, migrate: migrate, parse: parse, serialize: serialize, store: store, apply: apply, total: total, stats: stats };
})(typeof window !== 'undefined' ? window : globalThis);
