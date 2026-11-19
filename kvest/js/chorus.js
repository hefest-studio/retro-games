/* МАЯЧНИЦА · chorus.js — межсценовая головоломка «хор огней» и титры (движок глав, спринт 4). Без DOM, чистая логика.
   1) ХОР — состояние, которое собирают по нескольким сценам: голоса (огни маяков, колокола) стоят в разных местах главы, у каждого
      своя нота; чтобы сложилась мелодия, их надо «спеть» в порядке target. Ошибка — не тупик: огни мягко гаснут, начинай заново.
        puzzles.chorus = [{ id, target: [ноты…], show: [условия — когда показывать строку мелодии],
          voices: [{ id, scene, hs, note, need, hero, item, node, do }], onVoice, onMiss, onSolve, puzzle }]
      Голос = зона hs сцены scene (need — огонь готов; hero/item — кто и чем поёт; node — узел карты побережья, который он зажигает).
      Флаги: 'ch:<id>:<k>' — спето k нот (k = 1…n, копятся), 'lit:<id>:<голос>' — голос звучит, 'ch:<id>:done' — мелодия сложена.
      prepare(P) один раз превращает хор в обычные правила (поэтому поиск по состояниям, бот, подсказки и сохранения работают без
      изменений): верная нота — следующий флаг (последняя — onSolve и puzzle); голос уже звучит — просто звенит ещё раз; неверная —
      все флаги хора снимаются (onMiss). Действие ['voice', хор, голос, k] — событие 'voice' (нота — для звука и для колец тушью).
      Модель кадра: model.chorus = { id, n, k, notes: [спетые ноты], voices: [{ id, note, lit, order, here }], age, miss } — тема
      рисует строку мелодии хуком drawChorus (LAYOUT.chorus). На карте: узлы голосов несут state.note / lit / sung (какой по счёту),
      между спетыми подряд огнями — «нить мелодии» (kind songline).
   2) ТИТРЫ — после финала последней главы: строки берутся из словаря i18n (в самой игре слов нет): название, студия,
      «музыка: процедурная». KVEST.Credits.lines(t) → [{ key | text, size, gap }], DUR — сколько секунд идут. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  function has(st, c) { var neg = c.charAt(0) === '!'; if (neg) c = c.slice(1); var v = c.slice(0, 4) === 'inv:' ? st.inv.indexOf(c.slice(4)) >= 0 : !!st.flags[c]; return neg ? !v : v; }
  function ok(st, list) { if (!list) return true; for (var i = 0; i < list.length; i++) if (!has(st, list[i])) return false; return true; }

  function list(P) { return (P && P.chorus) || []; }
  function get(P, id) { var a = list(P); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function voice(c, vid) { for (var i = 0; i < c.voices.length; i++) if (c.voices[i].id === vid) return c.voices[i]; return null; }
  function fK(c, k) { return 'ch:' + c.id + ':' + k; }
  function fLit(c, v) { return 'lit:' + c.id + ':' + (v.id || v); }
  function fDone(c) { return 'ch:' + c.id + ':done'; }
  function progress(c, st) { var k = 0; while (k < c.target.length && st.flags[fK(c, k + 1)]) k++; return k; }
  function done(c, st) { return !!st.flags[fDone(c)]; }
  function clearActs(c) {
    var a = [], k; for (k = 1; k <= c.target.length; k++) a.push(['clear', fK(c, k)]);
    c.voices.forEach(function (v) { a.push(['clear', fLit(c, v)]); });
    return a;
  }
  // хор → обычные правила (в начало списка); один раз на главу
  function prepare(P) {
    if (!P || P._chorusReady || !list(P).length) return P;
    var gen = [];
    list(P).forEach(function (c) {
      var n = c.target.length;
      c.voices.forEach(function (v) {
        var base = (v.need || []).concat(['!' + fDone(c)]);
        function rule(need, acts, puzzle) { var r = { scene: v.scene, hs: v.hs, need: need, do: acts, chorus: c.id, voice: v.id }; if (v.item) r.item = v.item; if (v.hero) r.hero = v.hero; if (puzzle) r.puzzle = puzzle; gen.push(r); }
        for (var k = 0; k < n; k++) {
          if (c.target[k] !== v.note) continue;
          var last = k + 1 === n;
          rule(base.concat(k ? [fK(c, k)] : [], ['!' + fK(c, k + 1)]),
            [['set', fK(c, k + 1)], ['set', fLit(c, v)], ['voice', c.id, v.id, k]].concat(c.onVoice || [], v.do || [], last ? [['set', fDone(c)]].concat(c.onSolve || []) : []),
            last ? c.puzzle : null);
        }
        rule(base.concat([fLit(c, v)]), [['voice', c.id, v.id, -1]]);                       // уже звучит — звенит ещё раз
        rule(base, clearActs(c).concat([['voice', c.id, v.id, -2]], c.onMiss || []));      // не та нота — огни гаснут
      });
    });
    P.rules = gen.concat(P.rules);
    try { Object.defineProperty(P, '_chorusReady', { value: true, enumerable: false }); } catch (e) { P._chorusReady = true; }
    return P;
  }
  // голоса в порядке пения (те, что уже звучат)
  function sung(c, st) {
    var k = progress(c, st), out = [];
    for (var i = 0; i < k; i++) { var hit = null; c.voices.forEach(function (v) { if (!hit && v.note === c.target[i] && st.flags[fLit(c, v)] && out.indexOf(v) < 0) hit = v; }); if (hit) out.push(hit); }
    return out;
  }
  // строка мелодии для темы; rtc — { t, miss } (когда звучал последний голос / когда огни погасли), now — время игры
  function view(P, st, sceneId, rtc, now) {
    var a = list(P), c = null;
    for (var i = 0; i < a.length; i++) if (ok(st, a[i].show)) { c = a[i]; break; }
    if (!c) return null;
    var k = progress(c, st), order = sung(c, st), r = (rtc && rtc[c.id]) || {};
    return { id: c.id, n: c.target.length, k: k, done: done(c, st), notes: c.target.slice(0, k),
      voices: c.voices.map(function (v) { return { id: v.id, note: v.note, lit: !!st.flags[fLit(c, v)], order: order.indexOf(v) + 1, here: v.scene === sceneId, ready: ok(st, v.need) }; }),
      age: r.t == null ? 99 : now - r.t, miss: r.miss == null ? 99 : now - r.miss, last: r.last || null };
  }
  // карта: узлы голосов — нота, огонь, номер по счёту; между спетыми подряд — нить мелодии
  function decorate(P, map, st, objs) {
    if (!map || !list(P).length) return objs;
    var lines = [];
    list(P).forEach(function (c) {
      var order = sung(c, st);
      c.voices.forEach(function (v) {
        if (!v.node) return;
        for (var i = 0; i < objs.length; i++) if (objs[i].id === 'n_' + v.node) { var s = objs[i].state; s.note = v.note; s.voice = true; s.ready = ok(st, v.need); s.lit = !!st.flags[fLit(c, v)]; s.sung = order.indexOf(v) + 1; }
      });
      for (var j = 1; j < order.length; j++) {
        var a = node(map, order[j - 1].node), b = node(map, order[j].node); if (!a || !b) continue;
        lines.push({ id: 'song_' + c.id + '_' + j, kind: 'songline', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(1, Math.abs(a.x - b.x)), h: Math.max(1, Math.abs(a.y - b.y)), seed: j,
          state: { pts: [[a.x, a.y], [b.x, b.y]], i: j, done: done(c, st) } });
      }
    });
    if (!lines.length) return objs;
    var at = 0; while (at < objs.length && objs[at].kind === 'trail') at++;
    return objs.slice(0, at).concat(lines, objs.slice(at));
  }
  function node(map, id) { for (var i = 0; i < map.nodes.length; i++) if (map.nodes[i].id === id) return map.nodes[i]; return null; }

  K.Chorus = { list: list, get: get, voice: voice, fK: fK, fLit: fLit, fDone: fDone, progress: progress, done: done, prepare: prepare, sung: sung, view: view, decorate: decorate };

  // ---------- титры ----------
  // строки — ключи словаря i18n (оболочка подставляет язык); gap — отступ перед строкой, size — кегль
  var CREDITS = [
    { key: 'title', size: 54, gap: 0, accent: true }, { key: 'subtitle', size: 17, gap: 34 },
    { icon: 'tower', gap: 70 },
    { key: 'credStudioL', size: 13, gap: 64, dim: true }, { key: 'credStudio', size: 26, gap: 32 },
    { key: 'credMusicL', size: 13, gap: 62, dim: true }, { key: 'credMusic', size: 22, gap: 30 },
    { key: 'credArtL', size: 13, gap: 62, dim: true }, { key: 'credArt', size: 22, gap: 30 },
    { icon: 'whale', gap: 76 },
    { key: 'credThanks', size: 22, gap: 66, accent: true }
  ];
  var SPEED = 44, LEAD = 1.2;   // пикселей в секунду; пауза перед началом
  function creditsHeight() { var h = 0; CREDITS.forEach(function (l) { h += l.gap; }); return h; }
  // строки титров в момент t: y каждой (логические 960×540), a — прозрачность; done — титры прошли
  function credits(t) {
    // лента едет снизу вверх, пока последняя строка («спасибо») не встанет в середину листа, — и замирает
    var total = creditsHeight(), stopAt = 290 - total, y0 = 600 - Math.max(0, t - LEAD) * SPEED, hold = y0 < stopAt;
    if (hold) y0 = stopAt;
    var y = y0, out = [];
    CREDITS.forEach(function (l) { y += l.gap; var a = Math.max(0, Math.min(1, (560 - y) / 60)) * Math.max(0, Math.min(1, (y - 10) / 40)); out.push({ key: l.key || null, icon: l.icon || null, size: l.size || 18, accent: !!l.accent, dim: !!l.dim, y: y, a: a }); });
    var tStop = LEAD + (600 - stopAt) / SPEED;
    return { lines: out, held: hold, done: t >= tStop + 5, dur: tStop + 5 };
  }
  K.Credits = { LINES: CREDITS, SPEED: SPEED, at: credits, height: creditsHeight, keys: function () { return CREDITS.filter(function (l) { return l.key; }).map(function (l) { return l.key; }); } };
})(typeof window !== 'undefined' ? window : globalThis);
