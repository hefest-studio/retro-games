/* МАЯЧНИЦА · helpers.js — движок помощников (с главы 3): несколько героев, переключение, удержания. Без DOM, чистая логика;
   её же используют поиск по состояниям и бот в тестах.
   ГЕРОИ. Тая ('taya') есть всегда. Глава объявляет помощников: puzzles.heroes = [{ id: 'dog' | 'gull', need: [...] }]
   (need — когда помощник присоединился). Активный герой — st.hero (по умолчанию 'taya'); переключение — портрет в интерфейсе.
   Сцена может не пускать помощника: scene.heroes = ['taya', 'dog'] (чайка ждёт снаружи — её портрет погашен).
   ОТРЯД. Свободные герои ходят вместе с активным (идут следом). Кого сцена не пускает — ждёт «за кадром» и снова появляется,
   когда отряд выйдет туда, где ему можно. Поэтому положение свободных героев = сцена активного, в состоянии его хранить не нужно.
   ГЛАГОЛЫ. Правило с полем hero: 'dog' | ['dog', 'gull'] срабатывает только у этого героя; правило без hero — только у Таи
   (так главы 1–2 работают без изменений). Механизмы (widgets) крутит Тая. Выходы проходят все, если сцена назначения их пускает.
   УДЕРЖАНИЯ. puzzles.holds = [{ id, scene, hs, by: [герои], need, pose, at, puzzle, sfx }]: герой из by жмёт зону hs — и держит
   (рычаг, верёвку, лает на птиц…), пока его не отпустят: флаги held:<id> (держат) и by:<id>:<герой> (кто). Держащий остаётся
   в своей сцене, отряд может уйти; правила других героев проверяют need: ['held:<id>'] («X держит, пока Y действует»).
   Отпустить — сделать держащего активным (только в его сцене) и любое действие/шаг им, или нажать ту же зону ещё раз.
   until: [...] — держащий отпускает сам, когда дело сделано (мост привязан, люк больше не нужен); тогда он догоняет отряд.
   Когда помощник начал держать, управление само переходит к Тае (или к другому свободному герою в сцене). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  function has(st, c) { var neg = c.charAt(0) === '!'; if (neg) c = c.slice(1); var v = c.slice(0, 4) === 'inv:' ? st.inv.indexOf(c.slice(4)) >= 0 : !!st.flags[c]; return neg ? !v : v; }
  function ok(st, list) { if (!list) return true; for (var i = 0; i < list.length; i++) if (!has(st, list[i])) return false; return true; }
  var ICON = { taya: 'taya', dog: 'dog', gull: 'gull' };
  var ABILITY = { dog: 'scent', gull: 'overview' };

  function defs(P) { return (P && P.heroes) || []; }
  function list(P) { var a = ['taya']; defs(P).forEach(function (h) { if (h.id !== 'taya' && a.indexOf(h.id) < 0) a.push(h.id); }); return a; }
  function multi(P) { return defs(P).length > 0; }
  function def(P, id) { var d = defs(P); for (var i = 0; i < d.length; i++) if (d[i].id === id) return d[i]; return null; }
  function joined(P, st, id) { if (id === 'taya') return true; var d = def(P, id); return !!d && ok(st, d.need); }
  function allowed(sc, id) { return id === 'taya' || !sc || !sc.heroes || sc.heroes.indexOf(id) >= 0; }
  function holds(P) { return (P && P.holds) || []; }
  function hold(P, id) { var a = holds(P); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function holder(P, st, hid) { var hs = list(P); for (var i = 0; i < hs.length; i++) if (st.flags['by:' + hid + ':' + hs[i]]) return hs[i]; return null; }
  // что держит герой (определение удержания) или null
  function busy(P, st, id) { var a = holds(P); for (var i = 0; i < a.length; i++) if (st.flags['by:' + a[i].id + ':' + id]) return a[i]; return null; }
  function free(P, st, id) { return joined(P, st, id) && !busy(P, st, id); }
  // герой в сцене sc: свободный (идёт с отрядом) и сцена его пускает — или держит что-то именно здесь
  function present(P, st, sc, id) {
    if (!joined(P, st, id)) return false;
    var b = busy(P, st, id); if (b) return !!sc && b.scene === sc.id;
    return allowed(sc, id);
  }
  function heroOk(r, hero) { hero = hero || 'taya'; var h = r && r.hero; if (!h) return hero === 'taya'; return typeof h === 'string' ? h === hero : h.indexOf(hero) >= 0; }
  // удержание, которое начнёт герой hero нажатием зоны hs в сцене scene (если оно свободно и выполнено need)
  function holdFor(P, st, scene, hs, hero) {
    var a = holds(P);
    for (var i = 0; i < a.length; i++) { var h = a[i]; if (h.scene === scene && h.hs === hs && h.by.indexOf(hero || 'taya') >= 0 && !st.flags['held:' + h.id] && ok(st, h.need)) return h; }
    return null;
  }
  function start(P, st, h, hero) { st.flags['held:' + h.id] = true; st.flags['by:' + h.id + ':' + hero] = true; }
  function release(P, st, hid) { delete st.flags['held:' + hid]; list(P).forEach(function (id) { delete st.flags['by:' + hid + ':' + id]; }); }
  function heldList(P, st) { return holds(P).filter(function (h) { return st.flags['held:' + h.id]; }); }
  // отпустить те удержания, у которых выполнено until; → список [{ id, hero }]
  function autoRelease(P, st) { var out = []; heldList(P, st).forEach(function (h) { if (h.until && ok(st, h.until)) { out.push({ id: h.id, hero: holder(P, st, h.id) }); release(P, st, h.id); } }); return out; }

  K.Helpers = { ICON: ICON, ABILITY: ABILITY, list: list, multi: multi, def: def, joined: joined, allowed: allowed, holds: holds, hold: hold, holder: holder,
    busy: busy, free: free, present: present, heroOk: heroOk, holdFor: holdFor, start: start, release: release, heldList: heldList, autoRelease: autoRelease };
})(typeof window !== 'undefined' ? window : globalThis);
