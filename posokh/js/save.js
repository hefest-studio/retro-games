/* ПОСОХ · сохранение маршрута (localStorage) и достижения.
   arcade.save.posokh — JSON v2: { v:2, cleared:{exp:1} (пройденные участки), marks:{exp:[id…]} (снятые реперы — не пропадают),
     score (очки текущего маршрута), lives, at (на каком участке стоит отметка карты), note (показана ли плашка «игра обновлена») }.
   Участок открыт, если он первый или пройден предыдущий (или он сам). Конец жизней — очки маршрута сгорают (идут в рекорд движка
   arcade.best.posokh), пройденное и снятые реперы остаются. arcade.ach.posokh — { fullMap:1, ends:N } (не стирается).
   Миграция v1 (прежняя версия игры: Ключи Звездочёта, казна, предметы): пройденные экспедиции (keys/cleared) → cleared,
   остальное прежнее (казна, предметы, реликвии) отбрасывается; при первом запуске — плашка «Игра обновлена». */
(function (global) {
  'use strict';
  var PS = global.POSOKH = global.POSOKH || {};
  var KEY = 'arcade.save.posokh', ACH = 'arcade.ach.posokh', VER = 2;
  function exps() { return PS.levels ? PS.levels.ids : []; }
  function blank() { return { v: VER, cleared: {}, marks: {}, score: 0, lives: 3, at: 'mine', note: 1 }; }
  function setOf(src, ok) { var o = {}; if (src && typeof src === 'object') for (var k in src) if (src[k] && ok.indexOf(k) >= 0) o[k] = 1; return o; }
  function migrate(o) {
    if (!o || typeof o !== 'object') return null;
    var E = exps(), p = blank(), v = o.v | 0;
    if (v === 1) {   // прежняя игра: сохраняем только пройденные экспедиции
      p.cleared = setOf(o.keys, E); var c1 = setOf(o.cleared, E); for (var k in c1) p.cleared[k] = 1;
      p.note = 0; p.at = firstOpen(p);
      return p;
    }
    if (v !== VER) return null;
    p.cleared = setOf(o.cleared, E);
    if (o.marks && typeof o.marks === 'object') E.forEach(function (e) {
      if (Array.isArray(o.marks[e])) { var seen = {}; p.marks[e] = o.marks[e].filter(function (x) { if (typeof x !== 'number' || x < 0 || x > 9 || seen[x]) return false; seen[x] = 1; return true; }).sort(); }
    });
    p.score = Math.max(0, Math.min(1e7, Math.floor(+o.score || 0)));
    p.lives = Math.max(1, Math.min(9, (o.lives | 0) || 3));
    p.at = E.indexOf(o.at) >= 0 && isOpen(p, o.at) ? o.at : firstOpen(p);
    p.note = o.note ? 1 : 0;
    return p;
  }
  function parse(raw) { if (!raw) return null; try { return migrate(JSON.parse(raw)); } catch (e) { return null; } }
  function serialize(p) { return JSON.stringify({ v: VER, cleared: p.cleared, marks: p.marks, score: p.score, lives: p.lives, at: p.at, note: p.note ? 1 : 0 }); }
  function isOpen(p, id) { var E = exps(), i = E.indexOf(id); if (i < 0) return false; return i === 0 || !!p.cleared[id] || !!p.cleared[E[i - 1]]; }
  function firstOpen(p) { var E = exps(); for (var i = 0; i < E.length; i++) if (!p.cleared[E[i]]) return isOpen(p, E[i]) ? E[i] : E[0]; return E[E.length - 1]; }
  function store(ls) {
    function get(k) { try { return ls.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { ls.setItem(k, v); } catch (e) {} }
    return {
      has: function () { var p = parse(get(KEY)); return !!p && (p.score > 0 || clearedCount(p) > 0 || markCount(p) > 0); },
      load: function () { var raw = get(KEY), p = parse(raw); if (p && raw && JSON.parse(raw).v !== VER) set(KEY, serialize(p)); return p || blank(); },
      save: function (p) { set(KEY, serialize(p)); },
      wipe: function () { var b = blank(); set(KEY, serialize(b)); return b; },
      ach: function () { try { var a = JSON.parse(get(ACH) || '{}'); return a && typeof a === 'object' ? a : {}; } catch (e) { return {}; } },
      setAch: function (a) { set(ACH, JSON.stringify(a)); }
    };
  }
  // итог участка → прогресс
  function apply(p, res) {
    var id = res.id;
    if (res.won) p.cleared[id] = 1;
    var m = p.marks[id] || []; (res.marks || []).forEach(function (x) { if (m.indexOf(x) < 0) m.push(x); }); p.marks[id] = m.sort();
    if (res.score != null) p.score = Math.max(0, res.score | 0);
    if (res.lives != null) p.lives = Math.max(1, res.lives);
    p.at = id;
    return p;
  }
  // конец жизней: очки маршрута сгорают, жизни — заново; пройденное и реперы остаются
  function burn(p) { p.score = 0; p.lives = 3; return p; }
  function clearedCount(p) { var n = 0; for (var k in p.cleared) n++; return n; }
  function markCount(p, id) { var n = 0; for (var k in p.marks) if (!id || k === id) n += p.marks[k].length; return n; }
  function allCleared(p) { return clearedCount(p) >= exps().length; }
  function fullMap(p) { return markCount(p) >= exps().length * (PS.levels ? PS.levels.MARKS : 3); }
  PS.save = { KEY: KEY, ACH: ACH, VER: VER, blank: blank, migrate: migrate, parse: parse, serialize: serialize, store: store, apply: apply, burn: burn,
    isOpen: isOpen, firstOpen: firstOpen, clearedCount: clearedCount, markCount: markCount, allCleared: allCleared, fullMap: fullMap };
})(typeof window !== 'undefined' ? window : globalThis);
