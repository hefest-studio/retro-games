/* Гефест Arcade · _shared/campaign-core.js — общее ядро кампаний стратегий (v1.0). Источник — _shared/campaign-core.js
   (копия в игре — js/campaign-core.js, её обновляет build.sh по этой метке; руками копии не править).
   Без DOM, без зависимостей и без знания об игре: игра передаёт свою легенду карты, свои условия и действия, свой мир.
   Вынесено из ПОРУБЕЖЬЯ (js/scenario.js) и ПРИИСКа (js/campaign.js) — обе игры работают на нём (11.2026).

   Карта: K.parseMap(rows, { tiles, legend, ground, isPoint, under, unknown, id, cell }) — ASCII-сетка → { w, h, t, points }.
     tiles — символ → код клетки игры; клетка-точка (isPoint, по умолчанию «нет в tiles») и клетка-метка (under) берут код
     символа из legend[буква] или ground; unknown — код для неизвестного символа (не задан — ошибка); cell(k, i, j, ch, base) —
     хук игры (руда, высоты, узлы ресурсов).
   Точки и зоны: points = { 'K': [{ i, j }, …] }; точка — центр клеток (+0,5); зоны { at, r } (круг), { x, y, w, h }
     (прямоугольник клеток), { pts: ['1', 'H'] } (клетки этих букв); pointOf, cornerOf, inZone, zoneCenter, zoneRadius, zoneCells.
   Сценарий: состояние MS = K.create(def, flags) — { def, id, objs, byObj, fired, queue, flags, ui, winAt, reason, result, over,
     heroes, heroDead, spawned, killed }; привязка к игре H = K.handler({ ctx, now, end, conds, acts, … }) — см. handler().
     Общие условия: time, obj, since, flag, heroDead, killed, all/any/not. Общие действия: wait, if, say, msg, objective, flag,
     win, lose. Остальное — словари игры H.conds[t](ctx, c, MS) / H.acts[a](ctx, a, MS) (или запасные H.cond(c) / H.act(a),
     возврат undefined — «не знаю такого»). Триггеры { id, when, do, repeat }, цели { id, after, hidden, kind:'opt', done, fail,
     failText }, поражение def.lose [{ when, reason }], автопобеда (все обязательные цели; def.manualWin — только действием win),
     звёзды [победа, …def.stars].
   Прогресс: newSave/load/save/reset (localStorage через переданное хранилище, всё в try/catch), applyResult (лучшие звёзды и время,
     флаги, герои — ранен, если пал, ветераны), carried (def.carry — флаги прошлых миссий), xcarried (def.xcarry — флаги ЧУЖОЙ
     кампании как 'camp.flag' + 'camp.done'), wounded, unlockState (миссия, которая открывается флагами других кампаний).
   Финал по флагам: flagsMatch ({ флаг: значение | [значения] }), pick ({ key, значение: текст, other }), flagCond (дерево
     flag/all/any/not + свои типы), starsOf (звёзды кампании).
   Экспорт: global.HefestCampaign. */
(function (global) {
  'use strict';
  var K = { version: '1.0' };
  var has = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };

  function txt(o, lang) { return o == null ? '' : typeof o === 'string' ? o : (o[lang] || o.ru || ''); }

  // ---------- Карта ----------
  function parseMap(rows, o) {
    o = o || {};
    var tiles = o.tiles || {}, legend = o.legend || {}, ground = o.ground == null ? '.' : o.ground, pre = o.id != null ? 'карта ' + o.id : 'карта';
    var isPoint = o.isPoint || function (ch) { return !has(tiles, ch); }, under = o.under || isPoint, cell = o.cell || null, strictTiles = !has(o, 'unknown');
    var h = rows.length, w = rows[0].length, t = new Uint8Array(w * h), points = Object.create(null);
    for (var j = 0; j < h; j++) {
      if (rows[j].length !== w) throw new Error(pre + ': строка ' + j + ' длиной ' + rows[j].length + ', ждали ' + w);
      for (var i = 0; i < w; i++) {
        var ch = rows[j][i], k = j * w + i, base = ch;
        if (isPoint(ch)) (points[ch] = points[ch] || []).push({ i: i, j: j });
        if (under(ch)) base = legend[ch] || ground;
        var code = has(tiles, base) ? tiles[base] : undefined;
        if (code == null) { if (strictTiles) throw new Error(pre + ': неизвестная клетка «' + ch + '» (' + i + ',' + j + ')'); code = o.unknown; }
        t[k] = code;
        if (cell) cell(k, i, j, ch, base);
      }
    }
    return { w: w, h: h, t: t, points: points };
  }
  function scanPoints(rows, isPoint) {
    var pts = Object.create(null);
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) { var ch = rows[j][i]; if (isPoint(ch)) (pts[ch] = pts[ch] || []).push({ i: i, j: j }); }
    return pts;
  }
  function pointOf(MS, at) {
    if (at && typeof at === 'object') return { x: at.x, y: at.y };
    var cells = MS.points[at]; if (!cells) throw new Error('нет точки «' + at + '»');
    var x = 0, y = 0; cells.forEach(function (c) { x += c.i + 0.5; y += c.j + 0.5; });
    return { x: x / cells.length, y: y / cells.length };
  }
  function cornerOf(MS, at) { var c = MS.points[at]; if (!c) throw new Error('нет точки «' + at + '»'); var i = 1e9, j = 1e9; c.forEach(function (q) { i = Math.min(i, q.i); j = Math.min(j, q.j); }); return { i: i, j: j }; }
  function zoneOf(MS, z) { var o = typeof z === 'string' ? (MS.def.zones || {})[z] : z; if (!o) throw new Error('нет зоны «' + z + '»'); return o; }
  function ptsSet(MS, z) { if (!z._set) { z._set = Object.create(null); z._cells = []; [].concat(z.pts).forEach(function (k) { (MS.points[k] || []).forEach(function (c) { var key = c.i + ',' + c.j; if (!z._set[key]) { z._set[key] = 1; z._cells.push(c); } }); }); } return z; }
  // x, y — в клетках (дробные)
  function inZone(MS, z, x, y) {
    z = zoneOf(MS, z);
    if (z.pts) return !!ptsSet(MS, z)._set[Math.floor(x) + ',' + Math.floor(y)];
    if (z.at != null) { var p = pointOf(MS, z.at); return Math.hypot(x - p.x, y - p.y) <= (z.r || 3); }
    return x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
  }
  function zoneCenter(MS, z) {
    z = zoneOf(MS, z);
    if (z.pts) { var cs = ptsSet(MS, z)._cells, sx = 0, sy = 0; cs.forEach(function (c) { sx += c.i + 0.5; sy += c.j + 0.5; }); return { x: sx / Math.max(1, cs.length), y: sy / Math.max(1, cs.length) }; }
    if (z.at != null) return pointOf(MS, z.at);
    return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
  }
  function zoneRadius(MS, z) { z = zoneOf(MS, z); if (z.at != null) return z.r || 3; if (z.pts) return 1.5; return Math.max(z.w, z.h) / 2; }
  // клетки зоны в пределах карты w×h → [{ i, j }, …] (по строкам; у pts — в порядке точек)
  function zoneCells(MS, z, w, h) {
    z = zoneOf(MS, z); var out = [], x0, y0, x1, y1, inb = function (i, j) { return i >= 0 && j >= 0 && i < w && j < h; };
    if (z.pts) return ptsSet(MS, z)._cells.filter(function (c) { return inb(c.i, c.j); }).map(function (c) { return { i: c.i, j: c.j }; });
    if (z.at != null) { var p = pointOf(MS, z.at), r = z.r || 3; x0 = Math.floor(p.x - r); y0 = Math.floor(p.y - r); x1 = Math.ceil(p.x + r); y1 = Math.ceil(p.y + r); }
    else { x0 = z.x; y0 = z.y; x1 = z.x + z.w - 1; y1 = z.y + z.h - 1; }
    for (var j = y0; j <= y1; j++) for (var i = x0; i <= x1; i++) if (inb(i, j) && inZone(MS, z, i + 0.5, j + 0.5)) out.push({ i: i, j: j });
    return out;
  }

  // ---------- Сценарий: состояние и привязка к игре ----------
  // o.objectives === false — цели завести позже (K.objectives(MS)): например, после стартовых сил, чьи условия when их не видят
  function create(def, flags, o) {
    var MS = { def: def, id: def.id, objs: [], byObj: Object.create(null), fired: Object.create(null), queue: [], flags: Object.assign({}, def.flags || {}, flags || {}),
      ui: [], winAt: -1, reason: null, result: null, trigT: 0, over: false,
      heroes: Object.create(null), heroDead: Object.create(null), spawned: Object.create(null), killed: Object.create(null) };
    if (!o || o.objectives !== false) objectives(MS);
    return MS;
  }
  function objectives(MS) { (MS.def.objectives || []).forEach(function (o) { var st = { id: o.id, def: o, state: (o.after || o.hidden) ? 'hidden' : 'active', t: 0 }; MS.objs.push(st); MS.byObj[o.id] = st; }); return MS; }
  // spec: { ctx — мир игры (первый аргумент условий/действий), now() — время миссии, с; end(win) — исход (ядро зовёт один раз);
  //   over() — «миссия кончилась» по мнению игры (по умолчанию MS.over); conds / acts — словари игры; cond(c) / act(a) — запасные;
  //   tick(MS) — работа игры между триггерами и целями (раз в 0,25 с); sayLife (6 с), winDelay (2 с — действие win без delay),
  //   autoWinDelay (2 с — после всех обязательных целей), failReason ('obj' — причина при проваленной цели без failText);
  //   strict (true): после исхода шаг останавливается сразу, повторный win не переносит срок, исход ставится один раз.
  //   strict: false — порядок ПРИИСКа до ядра (триггеры и цели этого шага дорабатывают, проваленная цель задаёт причину поверх). }
  var DEF = { sayLife: 6, winDelay: 2, autoWinDelay: 2, failReason: 'obj', strict: true };
  function opt(H, k) { return H[k] !== undefined ? H[k] : DEF[k]; }   // H может быть и простым объектом { now, end, cond, act }
  function handler(spec) {
    var H = Object.assign({}, DEF, spec || {});
    H.conds = Object.assign(Object.create(null), spec && spec.conds); H.acts = Object.assign(Object.create(null), spec && spec.acts);
    if (typeof H.now !== 'function' || typeof H.end !== 'function') throw new Error('handler: нужны now() и end(win)');
    return H;
  }
  // добавить условия/действия игры поверх (новая механика — без правки ядра)
  function extend(H, more) { Object.keys((more && more.conds) || {}).forEach(function (k) { H.conds[k] = more.conds[k]; }); Object.keys((more && more.acts) || {}).forEach(function (k) { H.acts[k] = more.acts[k]; }); return H; }
  function over(MS, H) { return H.over ? !!H.over() : !!MS.over; }

  function cond(MS, H, c) {
    switch (c.t) {
      case 'time': { var t = H.now(); return t >= (c.gte || 0) && (c.lte == null || t <= c.lte); }
      case 'obj': { var ob = MS.byObj[c.id]; return !!ob && ob.state === (c.state || 'done'); }
      case 'since': { var so = MS.byObj[c.obj]; return !!so && so.state === (c.state || 'done') && H.now() - so.t >= c.gte; }
      case 'flag': return c.value == null ? !!MS.flags[c.key] : MS.flags[c.key] === c.value;
      case 'heroDead': return !!MS.heroDead[c.hero];
      // tag — тег или список тегов (сумма); type — только юниты этого типа (если игра считает 'тег:тип', см. noteKill)
      case 'killed': return [].concat(c.tag).reduce(function (s, tg) { return s + (MS.killed[tg + (c.type ? ':' + c.type : '')] || 0); }, 0) >= (c.gte || 1);
      case 'all': return c.of.every(function (x) { return cond(MS, H, x); });
      case 'any': return c.of.some(function (x) { return cond(MS, H, x); });
      case 'not': return !cond(MS, H, c.of);
    }
    if (has(H.conds, c.t)) return !!H.conds[c.t](H.ctx, c, MS);
    var r = H.cond ? H.cond(c) : undefined; if (r === undefined) throw new Error('неизвестное условие ' + c.t);
    return !!r;
  }
  function run(MS, H, list, from) {
    for (var n = from || 0; n < list.length; n++) {
      var a = list[n];
      if (a.a === 'wait') { MS.queue.push({ at: H.now() + a.s, list: list, from: n + 1 }); return; }
      if (a.a === 'if') { run(MS, H, (cond(MS, H, a.when) ? a.do : a.else) || []); continue; }   // ветка по условию (со своими wait)
      act(MS, H, a);
    }
  }
  function act(MS, H, a) {
    switch (a.a) {
      case 'say': MS.ui.push({ t: 'say', who: a.who, text: a.text, life: a.life || opt(H, 'sayLife') }); return;
      case 'msg': MS.ui.push({ t: 'msg', text: a.text, col: a.col }); return;
      case 'objective': setObj(MS, H, a.id, a.state || 'active'); return;
      case 'flag': MS.flags[a.key] = a.value == null ? true : a.value; return;
      case 'win': if (!over(MS, H) && (!opt(H, 'strict') || MS.winAt < 0)) MS.winAt = H.now() + (a.delay == null ? opt(H, 'winDelay') : a.delay); return;
      case 'lose': lose(MS, H, a.reason); return;
    }
    if (has(H.acts, a.a)) { H.acts[a.a](H.ctx, a, MS); return; }
    if (!H.act || H.act(a) === undefined) throw new Error('неизвестное действие ' + a.a);
  }
  function setObj(MS, H, id, state) {
    var ob = MS.byObj[id]; if (!ob || ob.state === state) return;
    ob.state = state; ob.t = H.now(); MS.ui.push({ t: 'obj', id: id, state: state });
    if (state === 'done') MS.objs.forEach(function (x) { if (x.def.after === id && x.state === 'hidden') { x.state = 'active'; x.t = H.now(); MS.ui.push({ t: 'obj', id: x.id, state: 'active' }); } });
    if (state === 'failed' && ob.def.kind !== 'opt') {
      var why = ob.def.failText || opt(H, 'failReason');
      if (!opt(H, 'strict')) { MS.over = true; MS.reason = why || null; H.end(false); } else lose(MS, H, why);
    }
  }
  function lose(MS, H, reason) { if (over(MS, H)) return; MS.over = true; MS.reason = reason || null; H.end(false); }
  // шаг: очередь wait, триггеры и цели (раз в 0,25 с), поражение по def.lose, победа — когда выполнены все обязательные цели
  // (или срок действия win)
  function step(MS, H, dt) {
    if (over(MS, H)) return;
    var strict = !!opt(H, 'strict'), done = function () { return strict && over(MS, H); };
    for (var n = MS.queue.length - 1; n >= 0; n--) { var q = MS.queue[n]; if (H.now() >= q.at) { MS.queue.splice(n, 1); run(MS, H, q.list, q.from); if (done()) return; } }
    MS.trigT -= dt;
    if (MS.trigT <= 0) {
      MS.trigT = 0.25;
      (MS.def.triggers || []).forEach(function (tr) {
        if (done()) return;
        var f = MS.fired[tr.id]; if (f && !tr.repeat) return; if (f && H.now() - f < tr.repeat) return;
        if (cond(MS, H, tr.when)) { MS.fired[tr.id] = H.now() || 1e-6; run(MS, H, tr.do); }
      });
      if (H.tick) H.tick(MS);
      MS.objs.forEach(function (ob) {
        if (ob.state !== 'active' || done()) return;
        if (ob.def.fail && cond(MS, H, ob.def.fail)) { setObj(MS, H, ob.id, 'failed'); return; }
        if (ob.def.done && cond(MS, H, ob.def.done)) setObj(MS, H, ob.id, 'done');
      });
      (MS.def.lose || []).forEach(function (l) { if (!over(MS, H) && cond(MS, H, l.when)) lose(MS, H, l.reason); });
      var mains = MS.objs.filter(function (ob) { return ob.def.kind !== 'opt'; });
      if (!done() && MS.winAt < 0 && !MS.def.manualWin && mains.length && mains.every(function (ob) { return ob.state === 'done'; })) MS.winAt = H.now() + opt(H, 'autoWinDelay');
    }
    if (!over(MS, H) && MS.winAt >= 0 && H.now() >= MS.winAt) { MS.over = true; H.end(true); }
  }
  // звёзды: [победа, …def.stars] — каждая проверяется на момент победы
  function stars(MS, H, win) { return [!!win].concat((MS.def.stars || []).map(function (s) { return !!win && cond(MS, H, s.when); })); }
  // учёт для условий killed / gone и героев (игра зовёт из своих событий)
  function noteSpawn(MS, tag) { if (tag) MS.spawned[tag] = (MS.spawned[tag] || 0) + 1; }
  function noteKill(MS, tag, type) { if (!tag) return; MS.killed[tag] = (MS.killed[tag] || 0) + 1; if (type) MS.killed[tag + ':' + type] = (MS.killed[tag + ':' + type] || 0) + 1; }
  function heroesOf(MS) { var out = {}; Object.keys(MS.heroes).forEach(function (h) { out[h] = { alive: !MS.heroDead[h] }; }); return out; }
  function setGroup(MS, gr, base) { var old = MS.groups[gr.tag] || {}; MS.groups[gr.tag] = Object.assign({ owner: 1, mode: 'hold', ri: 0 }, base || {}, { alerted: old.alerted || false }, gr); return MS.groups[gr.tag]; }

  // ---------- Прогресс кампании ----------
  // o: { vets — вести ветеранов (roster.vets), camp — пометка кампании в сохранении }
  function newSave(o) { var d = { v: 1, unlocked: 1, missions: {}, flags: {}, roster: { heroes: {} } }; if (o && o.vets) d.roster.vets = []; if (o && o.camp) d.camp = o.camp; return d; }
  function load(store, key, o) {
    var s = null;
    try { var raw = store && store.getItem(key); if (raw) s = JSON.parse(raw); } catch (e) { s = null; }
    if (!s || typeof s !== 'object' || s.v !== 1) return newSave(o);
    var d = newSave(o); d.unlocked = Math.max(1, s.unlocked | 0); d.missions = s.missions && typeof s.missions === 'object' ? s.missions : {}; d.flags = s.flags && typeof s.flags === 'object' ? s.flags : {};
    d.roster.heroes = (s.roster && s.roster.heroes) || {};
    if (o && o.vets) d.roster.vets = (s.roster && Array.isArray(s.roster.vets)) ? s.roster.vets : [];
    return d;
  }
  function save(store, key, data) { try { store && store.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; } }
  function reset(store, key, o) { try { store && store.removeItem(key); } catch (e) {} return newSave(o); }
  // победа: звёзды (лучшие), время (лучшее), потери, флаги, герои (пал — в следующей миссии ранен), ветераны; открывается миссия n + 1.
  // res: { id, n, win, stars[], time, lostU, lostB, flags{}, heroes{ type: { alive } }, vets[] }; o: { n — номер миссии (иначе res.n), vets — сколько хранить }
  function applyResult(data, res, o) {
    if (!res.win) return data;
    var old = data.missions[res.id] || { stars: [], time: 0 }, n = o && o.n !== undefined ? o.n : res.n;
    data.missions[res.id] = { stars: res.stars.map(function (s, i) { return !!(s || old.stars[i]); }), time: old.time ? Math.min(old.time, res.time) : res.time, lostU: res.lostU, lostB: res.lostB };
    Object.keys(res.flags || {}).forEach(function (k) { data.flags[k] = res.flags[k]; });
    Object.keys(res.heroes || {}).forEach(function (h) { data.roster.heroes[h] = { wounded: !res.heroes[h].alive }; });
    if (o && o.vets) data.roster.vets = (res.vets || []).slice(0, o.vets);
    if (n != null) data.unlocked = Math.max(data.unlocked, n + 1);
    return data;
  }
  function wounded(data, type) { var hs = data && data.roster && data.roster.heroes && data.roster.heroes[type]; return !!(hs && hs.wounded); }
  // флаги прошлых миссий: def.carry = ['grove'] — из сохранения кампании (если есть), иначе остаётся def.flags
  function carried(def, data) { var out = {}; (def.carry || []).forEach(function (k) { if (data && data.flags && data.flags[k] != null) out[k] = data.flags[k]; }); return out; }
  // флаги чужой кампании: def.xcarry = { copper: ['alliance'] } → 'copper.alliance'; 'copper.done' — сколько её миссий пройдено.
  // getSave(camp) — сохранение той кампании или null (не играли — флагов нет)
  function xcarried(def, getSave) {
    var out = {}; Object.keys(def.xcarry || {}).forEach(function (camp) {
      var sv = getSave(camp); if (!sv) return;
      out[camp + '.done'] = Object.keys(sv.missions || {}).length;
      def.xcarry[camp].forEach(function (k) { if (sv.flags && sv.flags[k] != null) out[camp + '.' + k] = sv.flags[k]; });
    });
    return out;
  }
  // миссия, открываемая другими кампаниями: unlock = { camp: { флаг: значение | [значения] } }; done(camp, save) — кампания пройдена.
  // → { open, camps: { camp: { done, match } } }
  function unlockState(unlock, getSave, done) {
    var camps = {}, open = true;
    Object.keys(unlock || {}).forEach(function (k) { var s = getSave(k), dn = done(k, s), mt = !!(s && flagsMatch(unlock[k], s.flags || {})); camps[k] = { done: dn, match: mt }; if (!dn || !mt) open = false; });
    if (!Object.keys(camps).length) open = false;
    return { open: open, camps: camps };
  }

  // ---------- Финал по флагам ----------
  function flagsMatch(when, flags) { return Object.keys(when || {}).every(function (k) { var v = when[k]; return Array.isArray(v) ? v.indexOf(flags[k]) >= 0 : flags[k] === v; }); }
  // текст или выбор по флагу: { key: 'ending', a: {ru,en}, b: {…}, other: {…} }
  function pick(o, flags) { if (!o) return null; if (o.key) return o[flags[o.key]] || o.other || null; return o; }
  // дерево условий по флагам кампании: { t: 'flag', key, value } | all/any/not { of }; ext(w) — свои типы игры (иначе false)
  function flagCond(w, flags, ext) {
    if (!w) return true;
    if (w.t === 'flag') return w.value == null ? !!flags[w.key] : flags[w.key] === w.value;
    if (w.t === 'all') return w.of.every(function (x) { return flagCond(x, flags, ext); });
    if (w.t === 'any') return w.of.some(function (x) { return flagCond(x, flags, ext); });
    if (w.t === 'not') return !flagCond(w.of, flags, ext);
    return ext ? !!ext(w) : false;
  }
  // звёзды кампании: по каждой миссии первые k звёзд (по умолчанию 3) → { rows: [{ n, id, stars, done }], total, max }
  function starsOf(list, data, k) {
    k = k || 3; var total = 0, max = 0;
    var rows = list.map(function (m) { var rec = data && data.missions && data.missions[m.id], st = []; for (var q = 0; q < k; q++) st.push(!!(rec && rec.stars && rec.stars[q])); st.forEach(function (x) { max++; if (x) total++; }); return { n: m.n, id: m.id, stars: st, done: !!rec }; });
    return { rows: rows, total: total, max: max };
  }
  // реестр миссий: заменить по id или добавить и отсортировать по n
  function upsert(list, def) { for (var n = 0; n < list.length; n++) if (list[n].id === def.id) { list[n] = def; return def; } list.push(def); list.sort(function (a, b) { return (a.n || 0) - (b.n || 0); }); return def; }
  // состояние узла карты кампании: 'done' | 'open' | 'closed'
  function nodeState(def, data) { if (data.missions[def.id]) return 'done'; return def.n <= data.unlocked ? 'open' : 'closed'; }

  K.txt = txt; K.parseMap = parseMap; K.scanPoints = scanPoints; K.pointOf = pointOf; K.cornerOf = cornerOf; K.zoneOf = zoneOf; K.inZone = inZone; K.zoneCenter = zoneCenter; K.zoneRadius = zoneRadius; K.zoneCells = zoneCells;
  K.create = create; K.objectives = objectives; K.handler = handler; K.extend = extend; K.over = over; K.cond = cond; K.run = run; K.act = act; K.setObj = setObj; K.lose = lose; K.step = step; K.stars = stars;
  K.noteSpawn = noteSpawn; K.noteKill = noteKill; K.heroesOf = heroesOf; K.setGroup = setGroup;
  K.newSave = newSave; K.load = load; K.save = save; K.reset = reset; K.applyResult = applyResult; K.wounded = wounded; K.carried = carried; K.xcarried = xcarried; K.unlockState = unlockState;
  K.flagsMatch = flagsMatch; K.pick = pick; K.flagCond = flagCond; K.starsOf = starsOf; K.upsert = upsert; K.nodeState = nodeState;
  global.HefestCampaign = K;
})(typeof window !== 'undefined' ? window : globalThis);
