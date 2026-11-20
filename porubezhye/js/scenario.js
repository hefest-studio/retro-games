/* ПОРУБЕЖЬЕ · js/scenario.js — ОБЩЕЕ ядро сценария миссий (без DOM и без знания об игре). Кандидат в _shared/campaign.js:
   то же самое (по смыслу) есть в ПРИИСКе (priisk/js/campaign.js) — точки и зоны карты, триггеры с очередью wait/if, цели
   с after/hidden/opt/fail, звёзды, прогресс кампании в localStorage, финал по флагам. Здесь оно отделено от правил игры:
   игра передаёт свои условия и действия (cond/act), ядро знает только общие.
   Точки: points = { 'K': [{ i, j }, …] } (клетки карты с этой буквой); точка — центр клеток (в клетках, +0,5).
   Зоны: { at:'K', r:6 } — круг; { x, y, w, h } — прямоугольник клеток; { pts:['1','2'] } — клетки этих букв.
   Общие условия: time { gte, lte }, obj { id, state }, since { obj, gte }, flag { key, value }, all/any/not { of }.
   Общие действия: wait { s }, if { when, do, else }, objective { id, state }, flag { key, value }, say/msg (в очередь ui),
   win { delay }, lose { reason }. Остальное — game.cond(c) / game.act(a) (возврат undefined — «не знаю такого»).
   Состояние миссии MS: { def, objs, byObj, fired, queue, flags, ui, winAt, reason, result }.
   Экспорт: global.HefestScenario (+ PORUB.scenario). */
(function (global) {
  'use strict';
  var S = {};

  function txt(o, lang) { return o == null ? '' : typeof o === 'string' ? o : (o[lang] || o.ru || ''); }

  // ---------- Точки и зоны ----------
  // rows — массив строк карты; isPoint(ch) — буква/цифра обозначает именованную точку
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
  // клетки зоны в пределах карты w×h → [[i, j], …]
  function zoneCells(MS, z, w, h) {
    z = zoneOf(MS, z); var out = [], x0, y0, x1, y1;
    if (z.pts) return ptsSet(MS, z)._cells.filter(function (c) { return c.i >= 0 && c.j >= 0 && c.i < w && c.j < h; }).map(function (c) { return [c.i, c.j]; });
    if (z.at != null) { var p = pointOf(MS, z.at), r = z.r || 3; x0 = Math.floor(p.x - r); y0 = Math.floor(p.y - r); x1 = Math.ceil(p.x + r); y1 = Math.ceil(p.y + r); }
    else { x0 = z.x; y0 = z.y; x1 = z.x + z.w - 1; y1 = z.y + z.h - 1; }
    for (var j = y0; j <= y1; j++) for (var i = x0; i <= x1; i++) if (i >= 0 && j >= 0 && i < w && j < h && inZone(MS, z, i + 0.5, j + 0.5)) out.push([i, j]);
    return out;
  }

  // ---------- Состояние, условия, действия ----------
  function create(def, flags) {
    var MS = { def: def, id: def.id, objs: [], byObj: Object.create(null), fired: Object.create(null), queue: [], flags: Object.assign({}, def.flags || {}, flags || {}),
      ui: [], winAt: -1, reason: null, result: null, trigT: 0, over: false };
    (def.objectives || []).forEach(function (o) { var st = { id: o.id, def: o, state: (o.after || o.hidden) ? 'hidden' : 'active', t: 0 }; MS.objs.push(st); MS.byObj[o.id] = st; });
    return MS;
  }
  // H — привязка к игре: { now(), cond(c) → bool|undefined, act(a) → true|undefined, end(win) }
  function cond(MS, H, c) {
    switch (c.t) {
      case 'time': { var t = H.now(); return t >= (c.gte || 0) && (c.lte == null || t <= c.lte); }
      case 'obj': { var ob = MS.byObj[c.id]; return !!ob && ob.state === (c.state || 'done'); }
      case 'since': { var so = MS.byObj[c.obj]; return !!so && so.state === (c.state || 'done') && H.now() - so.t >= c.gte; }
      case 'flag': return c.value == null ? !!MS.flags[c.key] : MS.flags[c.key] === c.value;
      case 'all': return c.of.every(function (x) { return cond(MS, H, x); });
      case 'any': return c.of.some(function (x) { return cond(MS, H, x); });
      case 'not': return !cond(MS, H, c.of);
    }
    var r = H.cond(c); if (r === undefined) throw new Error('неизвестное условие ' + c.t);
    return !!r;
  }
  function run(MS, H, list, from) {
    for (var n = from || 0; n < list.length; n++) {
      var a = list[n];
      if (a.a === 'wait') { MS.queue.push({ at: H.now() + a.s, list: list, from: n + 1 }); return; }
      if (a.a === 'if') { run(MS, H, (cond(MS, H, a.when) ? a.do : a.else) || []); continue; }
      act(MS, H, a);
    }
  }
  function act(MS, H, a) {
    switch (a.a) {
      case 'say': MS.ui.push({ t: 'say', who: a.who, text: a.text, life: a.life || 6 }); return;
      case 'msg': MS.ui.push({ t: 'msg', text: a.text, col: a.col }); return;
      case 'objective': setObj(MS, H, a.id, a.state || 'active'); return;
      case 'flag': MS.flags[a.key] = a.value == null ? true : a.value; return;
      case 'win': if (!MS.over && MS.winAt < 0) MS.winAt = H.now() + (a.delay == null ? 2 : a.delay); return;
      case 'lose': lose(MS, H, a.reason); return;
    }
    if (H.act(a) === undefined) throw new Error('неизвестное действие ' + a.a);
  }
  function setObj(MS, H, id, state) {
    var ob = MS.byObj[id]; if (!ob || ob.state === state) return;
    ob.state = state; ob.t = H.now(); MS.ui.push({ t: 'obj', id: id, state: state });
    if (state === 'done') MS.objs.forEach(function (x) { if (x.def.after === id && x.state === 'hidden') { x.state = 'active'; x.t = H.now(); MS.ui.push({ t: 'obj', id: x.id, state: 'active' }); } });
    if (state === 'failed' && ob.def.kind !== 'opt') lose(MS, H, ob.def.failText || 'obj');
  }
  function lose(MS, H, reason) { if (MS.over) return; MS.over = true; MS.reason = reason || null; H.end(false); }
  // шаг: очередь wait, триггеры и цели (раз в 0,25 с), победа — когда выполнены все обязательные цели (или действие win)
  function step(MS, H, dt) {
    if (MS.over) return;
    for (var n = MS.queue.length - 1; n >= 0; n--) { var q = MS.queue[n]; if (H.now() >= q.at) { MS.queue.splice(n, 1); run(MS, H, q.list, q.from); if (MS.over) return; } }
    MS.trigT -= dt;
    if (MS.trigT <= 0) {
      MS.trigT = 0.25;
      (MS.def.triggers || []).forEach(function (tr) {
        if (MS.over) return;
        var f = MS.fired[tr.id]; if (f && !tr.repeat) return; if (f && H.now() - f < tr.repeat) return;
        if (cond(MS, H, tr.when)) { MS.fired[tr.id] = H.now() || 1e-6; run(MS, H, tr.do); }
      });
      MS.objs.forEach(function (ob) {
        if (ob.state !== 'active' || MS.over) return;
        if (ob.def.fail && cond(MS, H, ob.def.fail)) { setObj(MS, H, ob.id, 'failed'); return; }
        if (ob.def.done && cond(MS, H, ob.def.done)) setObj(MS, H, ob.id, 'done');
      });
      (MS.def.lose || []).forEach(function (l) { if (!MS.over && cond(MS, H, l.when)) lose(MS, H, l.reason); });
      var mains = MS.objs.filter(function (ob) { return ob.def.kind !== 'opt'; });
      if (!MS.over && MS.winAt < 0 && !MS.def.manualWin && mains.length && mains.every(function (ob) { return ob.state === 'done'; })) MS.winAt = H.now() + 2;
    }
    if (!MS.over && MS.winAt >= 0 && H.now() >= MS.winAt) { MS.over = true; H.end(true); }
  }
  // звёзды: [победа, …def.stars] — каждая проверяется на момент победы
  function stars(MS, H, win) { return [!!win].concat((MS.def.stars || []).map(function (s) { return !!win && cond(MS, H, s.when); })); }

  // ---------- Прогресс кампании (localStorage через переданное хранилище, всё в try/catch) ----------
  function newSave() { return { v: 1, unlocked: 1, missions: {}, flags: {}, roster: { heroes: {} } }; }
  function load(store, key) {
    var s = null;
    try { var raw = store && store.getItem(key); if (raw) s = JSON.parse(raw); } catch (e) { s = null; }
    if (!s || typeof s !== 'object' || s.v !== 1) return newSave();
    var d = newSave(); d.unlocked = Math.max(1, s.unlocked | 0); d.missions = s.missions && typeof s.missions === 'object' ? s.missions : {}; d.flags = s.flags && typeof s.flags === 'object' ? s.flags : {};
    d.roster = { heroes: (s.roster && s.roster.heroes) || {} };
    return d;
  }
  function save(store, key, data) { try { store && store.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; } }
  function reset(store, key) { try { store && store.removeItem(key); } catch (e) {} return newSave(); }
  // res: { id, n, win, stars[], time, flags{}, heroes{ type: { alive } }, lostU, lostB }
  function applyResult(data, res) {
    if (!res.win) return data;
    var old = data.missions[res.id] || { stars: [], time: 0 };
    data.missions[res.id] = { stars: res.stars.map(function (s, i) { return !!(s || old.stars[i]); }), time: old.time ? Math.min(old.time, res.time) : res.time, lostU: res.lostU, lostB: res.lostB };
    Object.keys(res.flags || {}).forEach(function (k) { data.flags[k] = res.flags[k]; });
    Object.keys(res.heroes || {}).forEach(function (h) { data.roster.heroes[h] = { wounded: !res.heroes[h].alive }; });
    data.unlocked = Math.max(data.unlocked, (res.n || 0) + 1);
    return data;
  }
  // флаги прошлых миссий: def.carry = ['grove'] — из сохранения кампании
  function carried(def, data) { var out = {}; (def.carry || []).forEach(function (k) { if (data && data.flags && data.flags[k] != null) out[k] = data.flags[k]; }); return out; }

  S.txt = txt; S.scanPoints = scanPoints; S.pointOf = pointOf; S.cornerOf = cornerOf; S.zoneOf = zoneOf; S.inZone = inZone; S.zoneCenter = zoneCenter; S.zoneRadius = zoneRadius; S.zoneCells = zoneCells;
  S.create = create; S.cond = cond; S.run = run; S.act = act; S.setObj = setObj; S.lose = lose; S.step = step; S.stars = stars;
  S.newSave = newSave; S.load = load; S.save = save; S.reset = reset; S.applyResult = applyResult; S.carried = carried;
  global.HefestScenario = S;
  var P = global.PORUB = global.PORUB || {}; P.scenario = S;
})(typeof window !== 'undefined' ? window : globalThis);
