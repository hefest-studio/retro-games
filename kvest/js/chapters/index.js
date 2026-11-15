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
  var FILES = K.CHAPTER_FILES = { demo: ['ch1'], full: ['ch2'] };
  var LIST = [], BY = {};
  var OLD_SAVE = 'arcade.save.kvest', SAVE_PREFIX = 'arcade.save.kvest.', PROG = 'arcade.kvest.chapters';

  function register(ch) {
    if (!ch || !/^ch\d+$/.test(ch.id || '') || !ch.scenes || !ch.puzzles) { if (global.console) console.warn('МАЯЧНИЦА: неверная глава', ch && ch.id); return null; }
    if (BY[ch.id]) return BY[ch.id];
    ch.n = ch.n || +ch.id.slice(2);
    if (ch.map && K.logic && K.logic.withMap) ch.scenes = K.logic.withMap(ch.scenes, ch.map);
    else if (ch.map && K.Coast && !ch.scenes.some(function (s) { return s.map; })) ch.scenes = ch.scenes.concat([K.Coast.mapScene(ch.map)]);
    BY[ch.id] = ch; LIST.push(ch); LIST.sort(function (a, b) { return a.n - b.n; });
    return ch;
  }
  function files(build) { return build === 'full' ? FILES.demo.concat(FILES.full) : FILES.demo.slice(); }
  // главы, доступные изданию: демо — только глава 1 (даже если файл полной версии каким-то образом загрузился)
  function available(edition) { var ids = files(edition === 'full' ? 'full' : 'demo'); return LIST.filter(function (c) { return ids.indexOf(c.id) >= 0; }); }
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
  // ?chapter=2 | ?chapter=ch2 — выбрать и открыть главу (плейтест владельца)
  function fromQuery(search) { var m = /[?&]chapter=(?:ch)?(\d+)\b/.exec(String(search || '')); return m ? 'ch' + (+m[1]) : null; }

  K.Chapters = { FILES: FILES, OLD_SAVE: OLD_SAVE, PROG: PROG, register: register, files: files, available: available, get: get, next: next, use: use,
    list: function () { return LIST.slice(); }, saveKey: saveKey, migrate: migrate, progress: progress, setProgress: setProgress, unlocked: unlocked, fromQuery: fromQuery,
    missing: [], onError: function (id) { K.Chapters.missing.push(id); if (global.console) console.warn('МАЯЧНИЦА: нет файла главы ' + id); } };

  // глава 1 — данные публичного дерева (scenes.js + puzzles.js)
  if (K.SCENES && K.PUZZLES) register({ id: 'ch1', n: 1, title: null, scenes: K.SCENES, puzzles: K.PUZZLES, music: 'kvest' });
  use('ch1');

  // файлы глав полной версии — только в сборке 'full'
  var doc = global.document;
  if (!doc || !doc.write || doc.readyState !== 'loading') return;
  var build = K.Edition ? K.Edition.BUILD : 'demo';
  files(build).forEach(function (id) {
    if (id === 'ch1' || !/^ch\d+$/.test(id)) return;
    doc.write('<script src="./js/chapters/' + id + '.js" onerror="KVEST.Chapters.onError(\'' + id + '\')"><\/script>');
  });
})(typeof window !== 'undefined' ? window : globalThis);
