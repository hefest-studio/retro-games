/* МАЯЧНИЦА · js/chapters/index.js — реестр глав. Подключается после scenes.js/puzzles.js (данные главы 1) и до game.js/main.js.
   Глава = файл данных: { id, n, title: {ru, en}, scenes, puzzles, map?, music? } — регистрируется через KVEST.Chapters.register().
   Глава 1 («Погасший маяк») — scenes.js + puzzles.js публичного дерева; её регистрирует этот файл.
   FILES.demo — главы публичного дерева (демо в открытом каталоге); FILES.full — файлы, которые есть ТОЛЬКО в полной сборке
   (их кладёт поверх публичной игры приватный репозиторий arcade-full, см. его README и build.sh). Здесь — только id, без содержимого.
   Загрузка: в браузере — синхронно (document.write во время разбора страницы, порядок сохраняется); файлы full запрашиваются только
   в сборке с флагом 'full' (KVEST.Edition.BUILD), публичная страница их не запрашивает. Нет файла (404) — главы просто нет в меню.
   Сохранения — по главам: arcade.save.kvest.<id> (+ arcade.kvest.chapters — пройденные главы и выбранная). Старое сохранение
   пилота (arcade.save.kvest, только глава 1) при старте переносится в arcade.save.kvest.ch1 и удаляется — прогресс не теряется. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var FILES = K.CHAPTER_FILES = { demo: ['ch1'], full: ['ch2', 'ch3', 'ch4', 'ch5', 'ch6'] };
  var TOTAL = FILES.demo.length + FILES.full.length;   // глав в полной игре (экран выбора главы показывает все)
  var LIST = [], BY = {};
  var OLD_SAVE = 'arcade.save.kvest', SAVE_PREFIX = 'arcade.save.kvest.', PROG = 'arcade.kvest.chapters';

  function register(ch) {
    if (!ch || !/^ch\d+$/.test(ch.id || '') || !ch.scenes || !ch.puzzles) { if (global.console) console.warn('МАЯЧНИЦА: неверная глава', ch && ch.id); return null; }
    if (BY[ch.id]) return BY[ch.id];
    ch.n = ch.n || +ch.id.slice(2);
    if (K.Dream) K.Dream.prepare(ch.puzzles); if (K.Chorus) K.Chorus.prepare(ch.puzzles);   // живая тушь и хор огней → обычные правила (их видят игра, поиск и бот)
    if (ch.map && K.logic && K.logic.withMap) ch.scenes = K.logic.withMap(ch.scenes, ch.map);
    else if (ch.map && K.Coast && !ch.scenes.some(function (s) { return s.map; })) ch.scenes = ch.scenes.concat([K.Coast.mapScene(ch.map)]);
    BY[ch.id] = ch; LIST.push(ch); LIST.sort(function (a, b) { return a.n - b.n; });
    return ch;
  }
  // 'platform' — издание «для площадок» (arcade-full/platform): грузит все главы, доступ решает js/edition.js (покупка, K.Edition.paid)
  function files(build) { return build === 'full' || build === 'platform' ? FILES.demo.concat(FILES.full) : FILES.demo.slice(); }
  // главы, доступные изданию: демо — только глава 1 (даже если файл полной версии каким-то образом загрузился)
  function available(edition) { var ids = files(edition), E = K.Edition; return LIST.filter(function (c) { return ids.indexOf(c.id) >= 0 && !(E && E.paid && E.paid(c.id)); }); }
  function get(id) { return BY[id] || null; }
  function next(id, edition) { var av = available(edition), i = -1; av.forEach(function (c, j) { if (c.id === id) i = j; }); return i >= 0 && i + 1 < av.length ? av[i + 1] : null; }
  // активная глава: данные главы становятся K.SCENES / K.PUZZLES (их читают тема, эскизы тушью и оболочка)
  function use(id) { var ch = BY[id]; if (!ch) return null; K.SCENES = ch.scenes; K.PUZZLES = ch.puzzles; K.CHAPTER = ch; return ch; }

  // ---------- сохранения по главам ----------
  function saveKey(id) { return SAVE_PREFIX + id; }
  // перенос сохранения пилота: arcade.save.kvest → arcade.save.kvest.ch1 (если новой записи ещё нет), старый ключ удаляется
  function migrate(store) {
    try {
      var old = store.getItem(OLD_SAVE); if (old == null) return false;
      var o = null; try { o = JSON.parse(old); } catch (e) {}
      if (o && o.v === 1 && o.flags && store.getItem(saveKey('ch1')) == null) store.setItem(saveKey('ch1'), old);
      store.removeItem(OLD_SAVE); return true;
    } catch (e) { return false; }
  }
  function progress(store) {
    var p = null; try { p = JSON.parse(store.getItem(PROG) || 'null'); } catch (e) {}
    if (!p || typeof p !== 'object') p = {};
    if (!Array.isArray(p.done)) p.done = []; if (typeof p.sel !== 'string') p.sel = 'ch1';
    return p;
  }
  function setProgress(store, p) { try { store.setItem(PROG, JSON.stringify({ done: p.done, sel: p.sel })); } catch (e) {} }
  // открыта ли глава: первая — всегда; дальше — если пройдена предыдущая (или открыта явно параметром ?chapter=N)
  function unlocked(id, p, edition) {
    var av = available(edition), i = -1; av.forEach(function (c, j) { if (c.id === id) i = j; });
    if (i < 0) return false; if (i === 0) return true;
    return p.done.indexOf(av[i - 1].id) >= 0 || (p.open || []).indexOf(id) >= 0;
  }
  // сводка для экрана выбора главы: все главы игры по порядку (в демо главы 2+ — без названий: их файлов в сборке нет), у каждой —
  // открыта ли, пройдена ли, сколько головоломок решено (пройденная — все; иначе — по сохранению главы), и общий процент игры.
  // Главы, файла которых в сборке нет, считаются по среднему числу головоломок известных глав (процент — оценка, без чисел не из данных).
  function solvedIn(store, ch) {
    try { var o = JSON.parse(store.getItem(saveKey(ch.id)) || 'null'); if (!o || o.v !== 1 || !o.flags) return 0; return ch.puzzles.puzzles.filter(function (p) { return o.flags[p.id]; }).length; } catch (e) { return 0; }
  }
  function summary(store, edition, prog) {
    var p = prog || progress(store), av = available(edition), rows = [], solved = 0, total = 0, known = 0, kn = 0;
    var shown = K.Edition && K.Edition.shown ? K.Edition.shown(TOTAL) : TOTAL;   // площадка без покупок — только открытые главы
    for (var n = 1; n <= shown; n++) {
      var id = 'ch' + n, ch = BY[id] && av.indexOf(BY[id]) >= 0 ? BY[id] : null;
      if (!ch) { rows.push({ id: id, n: n, title: null, present: false, unlocked: false, done: false, solved: 0, total: 0 }); continue; }
      var tot = ch.puzzles.puzzles.length, done = p.done.indexOf(id) >= 0, sv = done ? tot : solvedIn(store, ch);
      rows.push({ id: id, n: n, title: ch.title || null, present: true, unlocked: unlocked(id, p, edition), done: done, solved: sv, total: tot });
      solved += sv; total += tot; known += tot; kn++;
    }
    var avg = kn ? known / kn : 0, miss = rows.filter(function (r) { return !r.present; }).length, all = total + miss * avg;
    return { rows: rows, solved: solved, total: total, chapters: shown, done: rows.filter(function (r) { return r.done; }).length, pct: all ? Math.round(solved / all * 100) : 0 };
  }
  // ?chapter=2 | ?chapter=ch2 — выбрать и открыть главу (плейтест владельца)
  function fromQuery(search) { var m = /[?&]chapter=(?:ch)?(\d+)\b/.exec(String(search || '')); return m ? 'ch' + (+m[1]) : null; }

  K.Chapters = { FILES: FILES, OLD_SAVE: OLD_SAVE, PROG: PROG, register: register, files: files, available: available, get: get, next: next, use: use,
    list: function () { return LIST.slice(); }, TOTAL: TOTAL, summary: summary, solvedIn: solvedIn, saveKey: saveKey, migrate: migrate, progress: progress, setProgress: setProgress, unlocked: unlocked, fromQuery: fromQuery,
    missing: [], onError: function (id) { K.Chapters.missing.push(id); if (global.console) console.warn('МАЯЧНИЦА: нет файла главы ' + id); } };

  // глава 1 — данные публичного дерева (scenes.js + puzzles.js)
  if (K.SCENES && K.PUZZLES) register({ id: 'ch1', n: 1, title: null, scenes: K.SCENES, puzzles: K.PUZZLES, music: 'kvest' });
  use('ch1');

  // файлы глав полной версии — только в сборке 'full'
  var doc = global.document;
  if (!doc || !doc.write || doc.readyState !== 'loading') return;
  var build = K.Edition && K.Edition.BUILD;   // нет издания — как публичная сборка (только глава 1)
  files(build).forEach(function (id) {
    if (id === 'ch1' || !/^ch\d+$/.test(id)) return;
    doc.write('<script src="./js/chapters/' + id + '.js" onerror="KVEST.Chapters.onError(\'' + id + '\')"><\/script>');
  });
})(typeof window !== 'undefined' ? window : globalThis);
